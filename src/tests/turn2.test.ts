import { describe, it, expect, afterAll } from 'vitest';
import express from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import { BUILT_IN_EXAMPLES } from '../templates/circuitTemplates';
import { analyzeCircuitTruthTable } from '../engine/simulation/truthTableAnalyzer';
import { runClockBurstOffThread, runClockBurstSync } from '../workers/workerClient';
import { busToNumber } from '../engine/signals/signalModel';
import { createApiRouter } from '../../server';

describe('Circuit Truth Table Analyzer', () => {
  it('computes all 4 rows for the Half Adder example deterministically', () => {
    const halfAdder = BUILT_IN_EXAMPLES.find((e) => e.id === 'ex-half-adder');
    expect(halfAdder).toBeDefined();

    const table = analyzeCircuitTruthTable(halfAdder!.document);
    expect(table.inputLabels).toEqual(['A', 'B']);
    expect(table.outputLabels).toEqual(['SUM', 'CARRY']);
    expect(table.rows).toHaveLength(4);
    expect(table.truncated).toBe(false);

    for (const row of table.rows) {
      const a = row.inputs['A'];
      const b = row.inputs['B'];
      expect(row.outputs['SUM']).toBe((a ^ b) === 1 ? 'HIGH' : 'LOW');
      expect(row.outputs['CARRY']).toBe((a & b) === 1 ? 'HIGH' : 'LOW');
    }
  });

  it('computes all 8 rows for the Full Adder example', () => {
    const fullAdder = BUILT_IN_EXAMPLES.find((e) => e.id === 'ex-full-adder');
    expect(fullAdder).toBeDefined();

    const table = analyzeCircuitTruthTable(fullAdder!.document);
    expect(table.inputLabels).toEqual(['A', 'B', 'CIN']);
    expect(table.outputLabels).toEqual(['SUM', 'COUT']);
    expect(table.rows).toHaveLength(8);

    for (const row of table.rows) {
      const total = row.inputs['A'] + row.inputs['B'] + row.inputs['CIN'];
      expect(row.outputs['SUM']).toBe((total & 1) === 1 ? 'HIGH' : 'LOW');
      expect(row.outputs['COUT']).toBe(total >= 2 ? 'HIGH' : 'LOW');
    }
  });

  it('returns an informative reason when no switch inputs are present', () => {
    const table = analyzeCircuitTruthTable({
      id: 'empty',
      name: 'Empty',
      description: '',
      nodes: [],
      wires: [],
      createdAt: 0,
      updatedAt: 0,
      version: 1,
    });
    expect(table.rows).toHaveLength(0);
    expect(table.reason).toContain('Toggle Switch');
  });
});

describe('Off-Thread / Deterministic Clock Burst Simulation', () => {
  it('advances the 4-bit Binary Counter deterministically across 8 half-cycles (4 rising edges)', async () => {
    const counterEx = BUILT_IN_EXAMPLES.find((e) => e.id === 'ex-4bit-counter');
    expect(counterEx).toBeDefined();

    const doc = counterEx!.document;
    const syncSteps = runClockBurstSync(doc.nodes, doc.wires, false, {}, 8);
    expect(syncSteps).toHaveLength(8);

    // Every rising edge (odd half-cycles: indices 0, 2, 4, 6 when starting from false) increments Q
    const counterNode = doc.nodes.find((n) => n.type === 'COUNTER_4BIT')!;
    const finalBus = syncSteps[syncSteps.length - 1].result.pinValues[`${counterNode.id}:q`];
    expect(busToNumber(finalBus)).toBe(4);

    // Off-thread wrapper falls back cleanly in Node/Vitest and matches sync results
    const asyncSteps = await runClockBurstOffThread(doc.nodes, doc.wires, false, {}, 8);
    expect(asyncSteps).toHaveLength(8);
    expect(busToNumber(asyncSteps[7].result.pinValues[`${counterNode.id}:q`])).toBe(4);
  });
});

describe('Local File-Backed Express API (No Database)', () => {
  const testId = 'vitest_local_file_proj';
  const testFilePath = path.resolve(process.cwd(), 'data', 'projects', `${testId}.json`);
  let server: http.Server;
  let baseUrl: string;

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await fs.rm(testFilePath, { force: true });
  });

  it('serves /api/health, persists JSON to ./data/projects, validates IDs, and deletes cleanly', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', createApiRouter());

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;

    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/api/health`);
    expect(healthRes.status).toBe(200);
    const health = (await healthRes.json()) as { ok: boolean; storage: string };
    expect(health.ok).toBe(true);
    expect(health.storage).toBe('local-filesystem');

    // 2. Reject invalid ID (path traversal / illegal characters)
    const badRes = await fetch(`${baseUrl}/api/projects/..bad!id`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: '..bad!id', name: 'Invalid', kind: 'circuit' }),
    });
    expect(badRes.status).toBe(400);

    // 3. Save valid project to local filesystem
    const putRes = await fetch(`${baseUrl}/api/projects/${testId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: testId,
        name: 'Vitest Local Circuit',
        kind: 'circuit',
        description: 'Persisted to local disk JSON',
        updatedAt: 1700000000000,
      }),
    });
    expect(putRes.status).toBe(200);

    // Verify file physically exists on disk
    const rawOnDisk = await fs.readFile(testFilePath, 'utf-8');
    expect(JSON.parse(rawOnDisk).name).toBe('Vitest Local Circuit');

    // 4. List projects includes the saved record
    const listRes = await fetch(`${baseUrl}/api/projects`);
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as { projects: Array<{ id: string; name: string }> };
    expect(listData.projects.some((p) => p.id === testId && p.name === 'Vitest Local Circuit')).toBe(true);

    // 5. Delete project removes the file
    const delRes = await fetch(`${baseUrl}/api/projects/${testId}`, { method: 'DELETE' });
    expect(delRes.status).toBe(200);
    const existsAfterDelete = await fs
      .access(testFilePath)
      .then(() => true)
      .catch(() => false);
    expect(existsAfterDelete).toBe(false);
  });
});
