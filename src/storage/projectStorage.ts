import type { CustomICDefinition, ProjectRecord, UserSettings } from '../types/circuit';

const DB_NAME = 'chipcraft_local_db';
const DB_VERSION = 2;
const STORE_PROJECTS = 'projects';
const STORE_CUSTOM_ICS = 'custom_ics';
const SETTINGS_KEY = 'chipcraft_settings_v1';
const CHALLENGES_KEY = 'chipcraft_completed_challenges_v1';
const FALLBACK_PROJECTS_KEY = 'chipcraft_projects_fallback_v1';
const FALLBACK_CUSTOM_ICS_KEY = 'chipcraft_custom_ics_fallback_v1';

export const CURRENT_SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: UserSettings = {
  snapToGrid: true,
  showGrid: true,
  gridSize: 20,
  wireStyle: 'orthogonal',
  showPinLabels: true,
  defaultClockHz: 2,
  reducedMotion: false,
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CUSTOM_ICS)) {
        db.createObjectStore(STORE_CUSTOM_ICS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

function readFallbackArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeFallbackArray<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors in restricted sandboxes
  }
}

async function fetchBackendProjects(): Promise<ProjectRecord[] | null> {
  if (typeof fetch === 'undefined') return null;
  try {
    const res = await fetch('/api/projects');
    if (!res.ok) return null;
    const data = (await res.json()) as { projects?: ProjectRecord[] };
    return Array.isArray(data.projects) ? data.projects : null;
  } catch {
    return null;
  }
}

async function syncProjectToBackend(project: ProjectRecord): Promise<boolean> {
  if (typeof fetch === 'undefined') return false;
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function deleteProjectFromBackend(id: string): Promise<void> {
  if (typeof fetch === 'undefined') return;
  try {
    await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {
    // Offline or test environment: IndexedDB remains authoritative
  }
}

async function fetchBackendCustomICs(): Promise<CustomICDefinition[] | null> {
  if (typeof fetch === 'undefined') return null;
  try {
    const res = await fetch('/api/custom-ics');
    if (!res.ok) return null;
    const data = (await res.json()) as { customIcs?: CustomICDefinition[] };
    return Array.isArray(data.customIcs) ? data.customIcs : null;
  } catch {
    return null;
  }
}

async function syncCustomICToBackend(ic: CustomICDefinition): Promise<boolean> {
  if (typeof fetch === 'undefined') return false;
  try {
    const res = await fetch(`/api/custom-ics/${encodeURIComponent(ic.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ic),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function deleteCustomICFromBackend(id: string): Promise<void> {
  if (typeof fetch === 'undefined') return;
  try {
    await fetch(`/api/custom-ics/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {
    // Offline fallback
  }
}

export async function checkLocalFileBackend(): Promise<{
  available: boolean;
  projectCount: number;
  customIcCount: number;
}> {
  if (typeof fetch === 'undefined') return { available: false, projectCount: 0, customIcCount: 0 };
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return { available: false, projectCount: 0, customIcCount: 0 };
    const data = (await res.json()) as {
      ok?: boolean;
      projectCount?: number;
      customIcCount?: number;
    };
    return {
      available: Boolean(data.ok),
      projectCount: data.projectCount ?? 0,
      customIcCount: data.customIcCount ?? 0,
    };
  } catch {
    return { available: false, projectCount: 0, customIcCount: 0 };
  }
}

export async function listProjects(): Promise<ProjectRecord[]> {
  let localRows: ProjectRecord[] = [];
  try {
    const db = await openDatabase();
    localRows = await new Promise<ProjectRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as ProjectRecord[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    localRows = readFallbackArray<ProjectRecord>(FALLBACK_PROJECTS_KEY);
  }

  // Merge with local disk projects from Node.js Express file storage if reachable
  const diskRows = await fetchBackendProjects();
  if (diskRows && diskRows.length > 0) {
    const merged = new Map<string, ProjectRecord>();
    for (const p of localRows) merged.set(p.id, p);
    for (const p of diskRows) {
      const existing = merged.get(p.id);
      if (!existing || p.updatedAt >= existing.updatedAt) {
        merged.set(p.id, p);
      }
    }
    return Array.from(merged.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  return localRows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveProject(project: ProjectRecord): Promise<ProjectRecord> {
  const stamped: ProjectRecord = {
    ...project,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: Date.now(),
  };
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      tx.objectStore(STORE_PROJECTS).put(stamped);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const existing = readFallbackArray<ProjectRecord>(FALLBACK_PROJECTS_KEY).filter(
      (p) => p.id !== stamped.id
    );
    writeFallbackArray(FALLBACK_PROJECTS_KEY, [stamped, ...existing]);
  }
  await syncProjectToBackend(stamped);
  return stamped;
}

export async function deleteProject(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      tx.objectStore(STORE_PROJECTS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const existing = readFallbackArray<ProjectRecord>(FALLBACK_PROJECTS_KEY).filter(
      (p) => p.id !== id
    );
    writeFallbackArray(FALLBACK_PROJECTS_KEY, existing);
  }
  await deleteProjectFromBackend(id);
}

export async function clearAllProjects(): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      tx.objectStore(STORE_PROJECTS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    writeFallbackArray(FALLBACK_PROJECTS_KEY, []);
  }
  if (typeof fetch !== 'undefined') {
    try {
      await fetch('/api/projects', { method: 'DELETE' });
    } catch {
      // Ignore if running standalone without Node server
    }
  }
}

// ================= CUSTOM IC LOCAL STORAGE =================

export async function listCustomICs(): Promise<CustomICDefinition[]> {
  let localRows: CustomICDefinition[] = [];
  try {
    const db = await openDatabase();
    localRows = await new Promise<CustomICDefinition[]>((resolve, reject) => {
      const tx = db.transaction(STORE_CUSTOM_ICS, 'readonly');
      const store = tx.objectStore(STORE_CUSTOM_ICS);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as CustomICDefinition[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    localRows = readFallbackArray<CustomICDefinition>(FALLBACK_CUSTOM_ICS_KEY);
  }

  const diskRows = await fetchBackendCustomICs();
  if (diskRows && diskRows.length > 0) {
    const merged = new Map<string, CustomICDefinition>();
    for (const ic of localRows) merged.set(ic.id, ic);
    for (const ic of diskRows) {
      const existing = merged.get(ic.id);
      if (!existing || ic.updatedAt >= existing.updatedAt) {
        merged.set(ic.id, ic);
      }
    }
    return Array.from(merged.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  return localRows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveCustomIC(ic: CustomICDefinition): Promise<CustomICDefinition> {
  const stamped: CustomICDefinition = {
    ...ic,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: Date.now(),
  };
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CUSTOM_ICS, 'readwrite');
      tx.objectStore(STORE_CUSTOM_ICS).put(stamped);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const existing = readFallbackArray<CustomICDefinition>(FALLBACK_CUSTOM_ICS_KEY).filter(
      (item) => item.id !== stamped.id
    );
    writeFallbackArray(FALLBACK_CUSTOM_ICS_KEY, [stamped, ...existing]);
  }
  await syncCustomICToBackend(stamped);
  return stamped;
}

export async function deleteCustomIC(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CUSTOM_ICS, 'readwrite');
      tx.objectStore(STORE_CUSTOM_ICS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const existing = readFallbackArray<CustomICDefinition>(FALLBACK_CUSTOM_ICS_KEY).filter(
      (item) => item.id !== id
    );
    writeFallbackArray(FALLBACK_CUSTOM_ICS_KEY, existing);
  }
  await deleteCustomICFromBackend(id);
}

export async function clearAllCustomICs(): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CUSTOM_ICS, 'readwrite');
      tx.objectStore(STORE_CUSTOM_ICS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    writeFallbackArray(FALLBACK_CUSTOM_ICS_KEY, []);
  }
  if (typeof fetch !== 'undefined') {
    try {
      await fetch('/api/custom-ics', { method: 'DELETE' });
    } catch {
      // Ignore if running standalone
    }
  }
}

export function serializeProjectToJSON(project: ProjectRecord): string {
  return JSON.stringify(
    {
      format: 'chipcraft-project',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      project,
    },
    null,
    2
  );
}

export function parseImportedProjectJSON(
  rawText: string
): { ok: true; project: ProjectRecord } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, error: 'Invalid JSON syntax. Please select a valid ChipCraft .json export file.' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'File root must be a JSON object.' };
  }

  const envelope = parsed as Record<string, unknown>;
  const candidate =
    envelope.format === 'chipcraft-project' && envelope.project && typeof envelope.project === 'object'
      ? (envelope.project as Record<string, unknown>)
      : envelope;

  const version = Number(envelope.schemaVersion ?? candidate.schemaVersion ?? 1);
  if (Number.isNaN(version) || version > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Unsupported project schema version (${version}). This version of ChipCraft supports up to v${CURRENT_SCHEMA_VERSION}.`,
    };
  }

  if (typeof candidate.name !== 'string' || !candidate.name.trim()) {
    return { ok: false, error: 'Project file is missing a valid "name" field.' };
  }

  const validKinds = ['circuit', 'logic', 'cpu', 'memory', 'hdl'];
  const kind = validKinds.includes(String(candidate.kind))
    ? (candidate.kind as ProjectRecord['kind'])
    : 'circuit';

  if (kind === 'circuit' && candidate.circuit) {
    const c = candidate.circuit as Record<string, unknown>;
    if (!Array.isArray(c.nodes) || !Array.isArray(c.wires)) {
      return { ok: false, error: 'Corrupted circuit data: "nodes" and "wires" must be arrays.' };
    }
  }

  const now = Date.now();
  const safeProject: ProjectRecord = {
    id: `imported-${now}-${Math.random().toString(36).slice(2, 6)}`,
    name: candidate.name.trim(),
    kind,
    description: typeof candidate.description === 'string' ? candidate.description : 'Imported project',
    createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    circuit: candidate.circuit as ProjectRecord['circuit'],
    hdlCode: typeof candidate.hdlCode === 'string' ? candidate.hdlCode : undefined,
    cpuAssembly: typeof candidate.cpuAssembly === 'string' ? candidate.cpuAssembly : undefined,
    memoryData: Array.isArray(candidate.memoryData) ? (candidate.memoryData as number[]) : undefined,
    embeddedCustomIcs: Array.isArray(candidate.embeddedCustomIcs)
      ? (candidate.embeddedCustomIcs as CustomICDefinition[])
      : undefined,
  };

  return { ok: true, project: safeProject };
}

export function loadUserSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveUserSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

export function loadCompletedChallenges(): string[] {
  try {
    const raw = localStorage.getItem(CHALLENGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCompletedChallenge(challengeId: string): string[] {
  const current = new Set(loadCompletedChallenges());
  current.add(challengeId);
  const arr = Array.from(current);
  try {
    localStorage.setItem(CHALLENGES_KEY, JSON.stringify(arr));
  } catch {
    // Ignore storage errors
  }
  return arr;
}
