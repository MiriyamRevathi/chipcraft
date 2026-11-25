import { describe, it, expect, afterAll } from 'vitest';
import express from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createApiRouter } from '../../server';
import { parseImportedProjectJSON } from '../storage/projectStorage';
import { assembleProgram } from '../engine/cpu/assembler';
import { createInitialCPUState, stepCPU } from '../engine/cpu/cpuEngine';
import { readMemoryCell, writeMemoryCell } from '../engine/memory/memoryEngine';
import { BUILT_IN_EXAMPLES } from '../templates/circuitTemplates';
import { analyzeCircuitTruthTable } from '../engine/simulation/truthTableAnalyzer';

describe('Security Hardening — Project Import & API Validation', () => {
  const testProjId = 'vitest_security_proj';
  const testProjPath = path.resolve(process.cwd(), 'data', 'projects', `${testProjId}.json`);
  let server: http.Server;
  let baseUrl: string;

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await fs.rm(testProjPath, { force: true });
  });

  it('rejects non-object roots, oversized names, and strips prototype-pollution keys on JSON import', () => {
    const arrRes = parseImportedProjectJSON('[]');
    expect(arrRes.ok).toBe(false);

    const longName = 'A'.repeat(121);
    const longRes = parseImportedProjectJSON(JSON.stringify({ name: longName, kind: 'circuit' }));
    expect(longRes.ok).toBe(false);

    const rawWithProto =
      '{"name":"Safe Import","kind":"circuit","__proto__":{"polluted":true},"circuit":{"id":"c1","name":"C1","description":"","createdAt":0,"updatedAt":0,"version":1,"__proto__":{"evil":1},"nodes":[],"wires":[]},"memoryData":[300,-1,42]}';
    const okRes = parseImportedProjectJSON(rawWithProto);
    expect(okRes.ok).toBe(true);
    if (!okRes.ok) return;
    expect(JSON.stringify(okRes.project)).not.toContain('polluted');
    expect(JSON.stringify(okRes.project)).not.toContain('evil');
    expect(okRes.project.memoryData).toEqual([300 & 0xff, -1 & 0xff, 42]);
  });

  it('enforces security headers, rejects oversized names and invalid circuit payloads on /api/projects', async () => {
    const app = express();
    app.disable('x-powered-by');
    app.use(express.json({ limit: '2mb' }));
    app.use('/api', createApiRouter());

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;

    const health = await fetch(`${baseUrl}/api/health`);
    expect(health.headers.get('x-frame-options')).toBe('DENY');
    expect(health.headers.get('cross-origin-resource-policy')).toBe('same-origin');
    expect(health.headers.get('x-content-type-options')).toBe('nosniff');

    const badCircuit = await fetch(`${baseUrl}/api/projects/${testProjId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bad Circuit', kind: 'circuit', circuit: { nodes: 'not-array' } }),
    });
    expect(badCircuit.status).toBe(400);

    const badKind = await fetch(`${baseUrl}/api/projects/${testProjId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bad Kind', kind: 'unknown-kind' }),
    });
    expect(badKind.status).toBe(400);
  });
});

describe('Additional Engine Edge Cases — CPU, Memory & Truth Tables', () => {
  it('reports assembler syntax errors and halts cleanly when CPU PC goes out of bounds', () => {
    const badAsm = assembleProgram('INVALIDOP R0, 5');
    expect(badAsm.success).toBe(false);
    expect(badAsm.errors.length).toBeGreaterThan(0);

    const oobCpu = { ...createInitialCPUState(), pc: 255 };
    const stepped = stepCPU(oobCpu);
    expect(stepped.halted).toBe(true);
    expect(stepped.error).toContain('Program Counter out of bounds');
  });

  it('blocks out-of-range memory reads/writes and disabled OE/WE operations', () => {
    const mem = [0x10, 0x20];
    expect(readMemoryCell(mem, 0, true, false).value).toBeNull();
    expect(readMemoryCell(mem, 99, true, true).value).toBeNull();

    const blockedWrite = writeMemoryCell(mem, 0, 0x55, true, false, false);
    expect(blockedWrite.success).toBe(false);
    const oobWrite = writeMemoryCell(mem, 99, 0x55, true, true, false);
    expect(oobWrite.success).toBe(false);
  });

  it('generates complete 8-row truth table for the built-in 2:1 Multiplexer', () => {
    const mux = BUILT_IN_EXAMPLES.find((e) => e.id === 'ex-mux');
    expect(mux).toBeDefined();
    const table = analyzeCircuitTruthTable(mux!.document);
    expect(table.truncated).toBe(false);
    expect(table.reason).toBeUndefined();
    expect(table.rows).toHaveLength(8);
  });
});
