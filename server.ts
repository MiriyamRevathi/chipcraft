import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

const PROJECTS_DIR = path.resolve(process.cwd(), 'data', 'projects');
const CUSTOM_ICS_DIR = path.resolve(process.cwd(), 'data', 'custom-ics');
const MAX_PAYLOAD_BYTES = '2mb';
const ALLOWED_PROJECT_KINDS = new Set(['circuit', 'logic', 'cpu', 'memory', 'hdl']);
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function sanitizeId(raw: string): string | null {
  const cleaned = raw.trim();
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

function resolveConfinedJsonPath(baseDir: string, rawId: string): { id: string; filePath: string } | null {
  const safeId = sanitizeId(rawId);
  if (!safeId) return null;
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(resolvedBase, `${safeId}.json`);
  if (!resolvedPath.startsWith(resolvedBase + path.sep)) {
    return null;
  }
  return { id: safeId, filePath: resolvedPath };
}

function stripUnsafeKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripUnsafeKeys);
  }
  if (value && typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(k)) continue;
      clean[k] = stripUnsafeKeys(v);
    }
    return clean;
  }
  return value;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readJsonRecordsFromDir(dir: string): Promise<Array<Record<string, unknown>>> {
  await ensureDir(dir);
  const entries = await fs.readdir(dir);
  const records: Array<Record<string, unknown>> = [];
  for (const file of entries) {
    if (!file.endsWith('.json')) continue;
    const resolved = path.resolve(dir, file);
    if (!resolved.startsWith(path.resolve(dir) + path.sep)) continue;
    try {
      const raw = await fs.readFile(resolved, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && typeof parsed.id === 'string') {
        records.push(parsed as Record<string, unknown>);
      }
    } catch {
      // Skip corrupted individual JSON files without failing the list endpoint
    }
  }
  records.sort((a, b) => Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0));
  return records;
}

export function createApiRouter() {
  const router = express.Router();

  // Baseline security headers for API responses
  router.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.get('/health', async (_req, res) => {
    try {
      await Promise.all([ensureDir(PROJECTS_DIR), ensureDir(CUSTOM_ICS_DIR)]);
      const [projectFiles, icFiles] = await Promise.all([
        fs.readdir(PROJECTS_DIR),
        fs.readdir(CUSTOM_ICS_DIR),
      ]);
      res.json({
        ok: true,
        storage: 'local-filesystem',
        projectCount: projectFiles.filter((f) => f.endsWith('.json')).length,
        customIcCount: icFiles.filter((f) => f.endsWith('.json')).length,
      });
    } catch {
      res.status(500).json({ ok: false, error: 'Local storage health check failed.' });
    }
  });

  // ===== LOCAL PROJECTS =====
  router.get('/projects', async (_req, res) => {
    try {
      const projects = await readJsonRecordsFromDir(PROJECTS_DIR);
      res.json({ projects });
    } catch {
      res.status(500).json({ error: 'Failed to read local project directory.' });
    }
  });

  router.put('/projects/:id', async (req, res) => {
    const resolved = resolveConfinedJsonPath(PROJECTS_DIR, req.params.id);
    if (!resolved) {
      res.status(400).json({ error: 'Invalid project ID format.' });
      return;
    }

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ error: 'Project payload must be a JSON object.' });
      return;
    }
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 120) {
      res.status(400).json({ error: 'Project name must be between 1 and 120 characters.' });
      return;
    }
    const kind = typeof body.kind === 'string' ? body.kind : 'circuit';
    if (!ALLOWED_PROJECT_KINDS.has(kind)) {
      res.status(400).json({ error: 'Invalid project kind.' });
      return;
    }
    if (body.circuit !== undefined) {
      if (
        !body.circuit ||
        typeof body.circuit !== 'object' ||
        Array.isArray(body.circuit) ||
        !Array.isArray((body.circuit as Record<string, unknown>).nodes) ||
        !Array.isArray((body.circuit as Record<string, unknown>).wires)
      ) {
        res.status(400).json({ error: 'Circuit payload must include nodes and wires arrays.' });
        return;
      }
    }

    try {
      await ensureDir(PROJECTS_DIR);
      const sanitizedBody = stripUnsafeKeys(body) as Record<string, unknown>;
      const record = {
        ...sanitizedBody,
        id: resolved.id,
        name,
        kind,
        updatedAt: typeof body.updatedAt === 'number' ? body.updatedAt : Date.now(),
      };
      await fs.writeFile(resolved.filePath, JSON.stringify(record, null, 2), 'utf-8');
      res.json({ project: record });
    } catch {
      res.status(500).json({ error: 'Failed to persist project file locally.' });
    }
  });

  router.delete('/projects/:id', async (req, res) => {
    const resolved = resolveConfinedJsonPath(PROJECTS_DIR, req.params.id);
    if (!resolved) {
      res.status(400).json({ error: 'Invalid project ID format.' });
      return;
    }
    try {
      await ensureDir(PROJECTS_DIR);
      await fs.rm(resolved.filePath, { force: true });
      res.json({ deleted: true, id: resolved.id });
    } catch {
      res.status(500).json({ error: 'Failed to delete local project file.' });
    }
  });

  router.delete('/projects', async (_req, res) => {
    try {
      await ensureDir(PROJECTS_DIR);
      const entries = await fs.readdir(PROJECTS_DIR);
      await Promise.all(
        entries
          .filter((f) => f.endsWith('.json'))
          .map((f) => fs.rm(path.resolve(PROJECTS_DIR, f), { force: true }))
      );
      res.json({ cleared: true });
    } catch {
      res.status(500).json({ error: 'Failed to clear local projects directory.' });
    }
  });

  // ===== LOCAL CUSTOM ICS =====
  router.get('/custom-ics', async (_req, res) => {
    try {
      const customIcs = await readJsonRecordsFromDir(CUSTOM_ICS_DIR);
      res.json({ customIcs });
    } catch {
      res.status(500).json({ error: 'Failed to read local custom ICs directory.' });
    }
  });

  router.put('/custom-ics/:id', async (req, res) => {
    const resolved = resolveConfinedJsonPath(CUSTOM_ICS_DIR, req.params.id);
    if (!resolved) {
      res.status(400).json({ error: 'Invalid custom IC ID format.' });
      return;
    }

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ error: 'Custom IC payload must be a JSON object.' });
      return;
    }
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const shortName = typeof body.shortName === 'string' ? body.shortName.trim() : '';
    if (!name || name.length > 100 || !shortName || shortName.length > 10) {
      res.status(400).json({ error: 'Custom IC requires a valid name and 1-10 character shortName.' });
      return;
    }
    if (!Array.isArray(body.pins) || !Array.isArray(body.nodes) || !Array.isArray(body.wires)) {
      res.status(400).json({ error: 'Custom IC must include pins, nodes, and wires arrays.' });
      return;
    }

    try {
      await ensureDir(CUSTOM_ICS_DIR);
      const sanitizedBody = stripUnsafeKeys(body) as Record<string, unknown>;
      const record = {
        ...sanitizedBody,
        id: resolved.id,
        name,
        shortName,
        updatedAt: typeof body.updatedAt === 'number' ? body.updatedAt : Date.now(),
      };
      await fs.writeFile(resolved.filePath, JSON.stringify(record, null, 2), 'utf-8');
      res.json({ customIc: record });
    } catch {
      res.status(500).json({ error: 'Failed to persist custom IC file locally.' });
    }
  });

  router.delete('/custom-ics/:id', async (req, res) => {
    const resolved = resolveConfinedJsonPath(CUSTOM_ICS_DIR, req.params.id);
    if (!resolved) {
      res.status(400).json({ error: 'Invalid custom IC ID format.' });
      return;
    }
    try {
      await ensureDir(CUSTOM_ICS_DIR);
      await fs.rm(resolved.filePath, { force: true });
      res.json({ deleted: true, id: resolved.id });
    } catch {
      res.status(500).json({ error: 'Failed to delete custom IC file.' });
    }
  });

  router.delete('/custom-ics', async (_req, res) => {
    try {
      await ensureDir(CUSTOM_ICS_DIR);
      const entries = await fs.readdir(CUSTOM_ICS_DIR);
      await Promise.all(
        entries
          .filter((f) => f.endsWith('.json'))
          .map((f) => fs.rm(path.resolve(CUSTOM_ICS_DIR, f), { force: true }))
      );
      res.json({ cleared: true });
    } catch {
      res.status(500).json({ error: 'Failed to clear custom ICs directory.' });
    }
  });

  return router;
}

export async function createAppServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.use(express.json({ limit: MAX_PAYLOAD_BYTES }));

  // Clean 400 error response for malformed JSON request bodies
  app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, next: NextFunction) => {
    if (err && (err.type === 'entity.parse.failed' || err.status === 400)) {
      res.status(400).json({ error: 'Malformed JSON request body.' });
      return;
    }
    if (err && err.type === 'entity.too.large') {
      res.status(413).json({ error: 'Payload exceeds maximum allowed size of 2MB.' });
      return;
    }
    next(err);
  });

  app.use('/api', createApiRouter());

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return app;
}

function parseCliFlag(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return undefined;
}

const currentFilePath = fileURLToPath(import.meta.url);
const isDirectRun =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === path.resolve(currentFilePath);

if (isDirectRun) {
  const cliPort = parseCliFlag('--port');
  const cliHost = parseCliFlag('--host');
  const PORT = Number(cliPort ?? process.env.PORT ?? 3000);
  const HOST = cliHost ?? '0.0.0.0';
  createAppServer()
    .then((app) => {
      app.listen(PORT, HOST, () => {
        console.log(`ChipCraft local server listening on http://${HOST}:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to start ChipCraft server:', err);
      process.exit(1);
    });
}
