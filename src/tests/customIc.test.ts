import { describe, it, expect, afterAll } from 'vitest';
import express from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import { BUILT_IN_EXAMPLES } from '../templates/circuitTemplates';
import {
  extractSubcircuitDraft,
  recalculatePinLayout,
  detectCustomICCycle,
  validateCustomICDefinition,
  serializeCustomICToJSON,
  parseImportedCustomICJSON,
} from '../engine/subcircuit/customIcEngine';
import { simulateCircuit } from '../engine/simulation/simulator';
import { analyzeCircuitTruthTable } from '../engine/simulation/truthTableAnalyzer';
import { primarySignal } from '../engine/signals/signalModel';
import type { CircuitDocument, CircuitNode, CircuitWire, CustomICDefinition } from '../types/circuit';
import { createApiRouter } from '../../server';

function makeHalfAdderIC(id = 'ic-ha-test'): CustomICDefinition {
  const halfAdder = BUILT_IN_EXAMPLES.find((e) => e.id === 'ex-half-adder')!.document;
  const extracted = extractSubcircuitDraft(
    halfAdder,
    halfAdder.nodes.map((n) => n.id),
    {},
    'Half Adder IC'
  );
  if (!extracted.ok) {
    throw new Error(extracted.error);
  }
  return {
    ...extracted.draft,
    id,
    shortName: 'HA',
  };
}

describe('Phase 1 — Reusable Subcircuit IC Packaging', () => {
  it('auto-detects external pins from a full circuit selection and supports pin renaming & side positioning', () => {
    const halfAdder = BUILT_IN_EXAMPLES.find((e) => e.id === 'ex-half-adder')!.document;
    const res = extractSubcircuitDraft(
      halfAdder,
      halfAdder.nodes.map((n) => n.id),
      {},
      'My Half Adder'
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const { draft } = res;
    // Switches and LEDs become external pins; internal core keeps XOR and AND gates
    expect(draft.nodes).toHaveLength(2);
    expect(draft.pins.filter((p) => p.direction === 'input').map((p) => p.label)).toEqual(['A', 'B']);
    expect(draft.pins.filter((p) => p.direction === 'output').map((p) => p.label)).toEqual([
      'SUM',
      'CARRY',
    ]);

    // Rename pins and assign custom sides (top/bottom/left/right)
    const customizedPins = draft.pins.map((pin) => {
      if (pin.label === 'A') return { ...pin, label: 'X', side: 'top' as const };
      if (pin.label === 'CARRY') return { ...pin, label: 'COUT', side: 'bottom' as const };
      return pin;
    });
    const layout = recalculatePinLayout(customizedPins);
    expect(layout.width).toBeGreaterThanOrEqual(116);
    expect(layout.height).toBeGreaterThanOrEqual(72);
    expect(layout.pins.find((p) => p.label === 'X')?.side).toBe('top');
    expect(layout.pins.find((p) => p.label === 'COUT')?.side).toBe('bottom');
  });

  it('auto-detects boundary-crossing wires when selecting only internal gates (preserving boundary links)', () => {
    const halfAdder = BUILT_IN_EXAMPLES.find((e) => e.id === 'ex-half-adder')!.document;
    // Select only XOR and AND gates, excluding switches and LEDs
    const res = extractSubcircuitDraft(halfAdder, ['g_xor', 'g_and'], {}, 'Gate Core');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const { draft, boundaryLinks, absorbedNodeIds } = res;
    expect(absorbedNodeIds).toEqual(['g_xor', 'g_and']);
    expect(draft.nodes).toHaveLength(2);
    // 2 external inputs (from sw_a, sw_b) with fanout to both XOR and AND, plus 2 external outputs
    const inputs = draft.pins.filter((p) => p.direction === 'input');
    const outputs = draft.pins.filter((p) => p.direction === 'output');
    expect(inputs).toHaveLength(2);
    expect(outputs).toHaveLength(2);
    expect(inputs[0].internalTargets.length).toBe(2);
    expect(inputs[1].internalTargets.length).toBe(2);
    expect(boundaryLinks.length).toBeGreaterThanOrEqual(4);
  });

  it('simulates multiple placed instances of a combinational Custom IC independently', () => {
    const ha = makeHalfAdderIC('ic-ha-multi');
    const customIcs: Record<string, CustomICDefinition> = { [ha.id]: ha };
    const inPins = ha.pins.filter((p) => p.direction === 'input');
    const outPins = ha.pins.filter((p) => p.direction === 'output');

    const nodes: CircuitNode[] = [
      { id: 'sw1a', type: 'TOGGLE_SWITCH', label: 'A1', x: 0, y: 0, rotation: 0, value: 1 },
      { id: 'sw1b', type: 'TOGGLE_SWITCH', label: 'B1', x: 0, y: 60, rotation: 0, value: 0 },
      { id: 'ic1', type: 'CUSTOM_IC', label: 'HA1', x: 160, y: 20, rotation: 0, customIcId: ha.id },
      { id: 'sw2a', type: 'TOGGLE_SWITCH', label: 'A2', x: 0, y: 180, rotation: 0, value: 1 },
      { id: 'sw2b', type: 'TOGGLE_SWITCH', label: 'B2', x: 0, y: 240, rotation: 0, value: 1 },
      { id: 'ic2', type: 'CUSTOM_IC', label: 'HA2', x: 160, y: 200, rotation: 0, customIcId: ha.id },
    ];
    const wires: CircuitWire[] = [
      { id: 'w1', fromNodeId: 'sw1a', fromPinId: 'out', toNodeId: 'ic1', toPinId: inPins[0].pinId },
      { id: 'w2', fromNodeId: 'sw1b', fromPinId: 'out', toNodeId: 'ic1', toPinId: inPins[1].pinId },
      { id: 'w3', fromNodeId: 'sw2a', fromPinId: 'out', toNodeId: 'ic2', toPinId: inPins[0].pinId },
      { id: 'w4', fromNodeId: 'sw2b', fromPinId: 'out', toNodeId: 'ic2', toPinId: inPins[1].pinId },
    ];

    const sim = simulateCircuit(nodes, wires, { clockHigh: false, customIcs });
    // Instance 1: 1 + 0 => SUM=1, CARRY=0
    expect(primarySignal(sim.pinValues[`ic1:${outPins[0].pinId}`])).toBe('HIGH');
    expect(primarySignal(sim.pinValues[`ic1:${outPins[1].pinId}`])).toBe('LOW');
    // Instance 2: 1 + 1 => SUM=0, CARRY=1
    expect(primarySignal(sim.pinValues[`ic2:${outPins[0].pinId}`])).toBe('LOW');
    expect(primarySignal(sim.pinValues[`ic2:${outPins[1].pinId}`])).toBe('HIGH');
  });

  it('maintains completely independent internal sequential state across multiple instances of a stateful Custom IC', () => {
    // Build a 1-bit D Flip-Flop circuit and package it into a Custom IC
    const dffCircuit: CircuitDocument = {
      id: 'c-dff-src',
      name: 'Latch Cell',
      description: '',
      createdAt: 0,
      updatedAt: 0,
      version: 1,
      nodes: [
        { id: 'sw_d', type: 'TOGGLE_SWITCH', label: 'D', x: 40, y: 40, rotation: 0, value: 0 },
        { id: 'sw_clk', type: 'TOGGLE_SWITCH', label: 'CLK', x: 40, y: 120, rotation: 0, value: 0 },
        { id: 'dff', type: 'D_FF', label: 'FF', x: 200, y: 60, rotation: 0 },
        { id: 'led_q', type: 'LED', label: 'Q', x: 360, y: 60, rotation: 0 },
      ],
      wires: [
        { id: 'w_d', fromNodeId: 'sw_d', fromPinId: 'out', toNodeId: 'dff', toPinId: 'd' },
        { id: 'w_clk', fromNodeId: 'sw_clk', fromPinId: 'out', toNodeId: 'dff', toPinId: 'clk' },
        { id: 'w_q', fromNodeId: 'dff', fromPinId: 'q', toNodeId: 'led_q', toPinId: 'in' },
      ],
    };

    const extracted = extractSubcircuitDraft(
      dffCircuit,
      dffCircuit.nodes.map((n) => n.id),
      {},
      'Bit Register IC'
    );
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;

    const regIc = extracted.draft;
    const customIcs: Record<string, CustomICDefinition> = { [regIc.id]: regIc };
    const pinD = regIc.pins.find((p) => p.label === 'D')!.pinId;
    const pinClk = regIc.pins.find((p) => p.label === 'CLK')!.pinId;
    const pinQ = regIc.pins.find((p) => p.label === 'Q')!.pinId;

    const makeNodes = (d1: 0 | 1, clk1: 0 | 1, d2: 0 | 1, clk2: 0 | 1): CircuitNode[] => [
      { id: 'd1', type: 'TOGGLE_SWITCH', label: 'D1', x: 0, y: 0, rotation: 0, value: d1 },
      { id: 'c1', type: 'TOGGLE_SWITCH', label: 'C1', x: 0, y: 50, rotation: 0, value: clk1 },
      { id: 'r1', type: 'CUSTOM_IC', label: 'REG1', x: 140, y: 20, rotation: 0, customIcId: regIc.id },
      { id: 'd2', type: 'TOGGLE_SWITCH', label: 'D2', x: 0, y: 150, rotation: 0, value: d2 },
      { id: 'c2', type: 'TOGGLE_SWITCH', label: 'C2', x: 0, y: 200, rotation: 0, value: clk2 },
      { id: 'r2', type: 'CUSTOM_IC', label: 'REG2', x: 140, y: 170, rotation: 0, customIcId: regIc.id },
    ];
    const wires: CircuitWire[] = [
      { id: 'w1', fromNodeId: 'd1', fromPinId: 'out', toNodeId: 'r1', toPinId: pinD },
      { id: 'w2', fromNodeId: 'c1', fromPinId: 'out', toNodeId: 'r1', toPinId: pinClk },
      { id: 'w3', fromNodeId: 'd2', fromPinId: 'out', toNodeId: 'r2', toPinId: pinD },
      { id: 'w4', fromNodeId: 'c2', fromPinId: 'out', toNodeId: 'r2', toPinId: pinClk },
    ];

    // Step 1: Initialize both registers with CLK=0, D1=1, D2=0
    const s1 = simulateCircuit(makeNodes(1, 0, 0, 0), wires, { clockHigh: false, customIcs });
    expect(primarySignal(s1.pinValues[`r1:${pinQ}`])).toBe('LOW');
    expect(primarySignal(s1.pinValues[`r2:${pinQ}`])).toBe('LOW');

    // Step 2: Rising edge on REG1 ONLY (C1=1, C2=0) -> REG1 latches 1, REG2 stays 0
    const s2 = simulateCircuit(makeNodes(1, 1, 0, 0), wires, {
      clockHigh: false,
      previousStates: s1.nodeStates,
      customIcs,
    });
    expect(primarySignal(s2.pinValues[`r1:${pinQ}`])).toBe('HIGH');
    expect(primarySignal(s2.pinValues[`r2:${pinQ}`])).toBe('LOW');

    // Step 3: Drop C1=0, change D1=0 (REG1 must hold 1!), set D2=1 and pulse C2=1 -> REG2 latches 1
    const s3 = simulateCircuit(makeNodes(0, 0, 1, 1), wires, {
      clockHigh: false,
      previousStates: s2.nodeStates,
      customIcs,
    });
    expect(primarySignal(s3.pinValues[`r1:${pinQ}`])).toBe('HIGH');
    expect(primarySignal(s3.pinValues[`r2:${pinQ}`])).toBe('HIGH');

    // Step 4: Pulse C1=1 with D1=0 -> REG1 resets to 0, while REG2 keeps holding 1!
    const s4 = simulateCircuit(makeNodes(0, 1, 0, 0), wires, {
      clockHigh: false,
      previousStates: s3.nodeStates,
      customIcs,
    });
    expect(primarySignal(s4.pinValues[`r1:${pinQ}`])).toBe('LOW');
    expect(primarySignal(s4.pinValues[`r2:${pinQ}`])).toBe('HIGH');
  });

  it('supports nested Custom ICs (Full Adder built from two nested Half Adder ICs + OR gate)', () => {
    const ha = makeHalfAdderIC('ic-ha-nested');
    const customIcs: Record<string, CustomICDefinition> = { [ha.id]: ha };
    const haIn = ha.pins.filter((p) => p.direction === 'input');
    const haOut = ha.pins.filter((p) => p.direction === 'output');

    // Build a Full Adder circuit out of two Half Adder Custom ICs and an OR gate
    const fullAdderViaICs: CircuitDocument = {
      id: 'c-fa-nested',
      name: 'Full Adder',
      description: 'Nested Half Adder ICs',
      createdAt: 0,
      updatedAt: 0,
      version: 1,
      nodes: [
        { id: 'sw_a', type: 'TOGGLE_SWITCH', label: 'A', x: 0, y: 0, rotation: 0, value: 0 },
        { id: 'sw_b', type: 'TOGGLE_SWITCH', label: 'B', x: 0, y: 60, rotation: 0, value: 0 },
        { id: 'sw_cin', type: 'TOGGLE_SWITCH', label: 'CIN', x: 0, y: 120, rotation: 0, value: 0 },
        { id: 'ha1', type: 'CUSTOM_IC', label: 'HA1', x: 140, y: 20, rotation: 0, customIcId: ha.id },
        { id: 'ha2', type: 'CUSTOM_IC', label: 'HA2', x: 300, y: 40, rotation: 0, customIcId: ha.id },
        { id: 'or1', type: 'OR', label: 'OR1', x: 460, y: 100, rotation: 0, inputCount: 2 },
        { id: 'led_s', type: 'LED', label: 'SUM', x: 600, y: 40, rotation: 0 },
        { id: 'led_c', type: 'LED', label: 'COUT', x: 600, y: 110, rotation: 0 },
      ],
      wires: [
        { id: 'w1', fromNodeId: 'sw_a', fromPinId: 'out', toNodeId: 'ha1', toPinId: haIn[0].pinId },
        { id: 'w2', fromNodeId: 'sw_b', fromPinId: 'out', toNodeId: 'ha1', toPinId: haIn[1].pinId },
        { id: 'w3', fromNodeId: 'ha1', fromPinId: haOut[0].pinId, toNodeId: 'ha2', toPinId: haIn[0].pinId },
        { id: 'w4', fromNodeId: 'sw_cin', fromPinId: 'out', toNodeId: 'ha2', toPinId: haIn[1].pinId },
        { id: 'w5', fromNodeId: 'ha1', fromPinId: haOut[1].pinId, toNodeId: 'or1', toPinId: 'a' },
        { id: 'w6', fromNodeId: 'ha2', fromPinId: haOut[1].pinId, toNodeId: 'or1', toPinId: 'b' },
        { id: 'w7', fromNodeId: 'ha2', fromPinId: haOut[0].pinId, toNodeId: 'led_s', toPinId: 'in' },
        { id: 'w8', fromNodeId: 'or1', fromPinId: 'y', toNodeId: 'led_c', toPinId: 'in' },
      ],
    };

    // Package the Full Adder itself as a nested Custom IC!
    const faExtracted = extractSubcircuitDraft(
      fullAdderViaICs,
      fullAdderViaICs.nodes.map((n) => n.id),
      customIcs,
      'Full Adder IC'
    );
    expect(faExtracted.ok).toBe(true);
    if (!faExtracted.ok) return;

    const faIc: CustomICDefinition = { ...faExtracted.draft, id: 'ic-fa-nested', shortName: 'FA' };
    customIcs[faIc.id] = faIc;

    const validation = validateCustomICDefinition(faIc, customIcs);
    expect(validation.valid).toBe(true);

    // Mount the nested Full Adder IC in a top-level testbench and verify all 8 truth table rows
    const faIn = faIc.pins.filter((p) => p.direction === 'input');
    const faOut = faIc.pins.filter((p) => p.direction === 'output');
    const testbench: CircuitDocument = {
      id: 'c-tb',
      name: 'FA Testbench',
      description: '',
      createdAt: 0,
      updatedAt: 0,
      version: 1,
      nodes: [
        { id: 'a', type: 'TOGGLE_SWITCH', label: 'A', x: 0, y: 0, rotation: 0, value: 0 },
        { id: 'b', type: 'TOGGLE_SWITCH', label: 'B', x: 0, y: 50, rotation: 0, value: 0 },
        { id: 'c', type: 'TOGGLE_SWITCH', label: 'CIN', x: 0, y: 100, rotation: 0, value: 0 },
        { id: 'dut', type: 'CUSTOM_IC', label: 'FA', x: 160, y: 40, rotation: 0, customIcId: faIc.id },
        { id: 's', type: 'LED', label: 'SUM', x: 340, y: 30, rotation: 0 },
        { id: 'co', type: 'LED', label: 'COUT', x: 340, y: 90, rotation: 0 },
      ],
      wires: [
        { id: 't1', fromNodeId: 'a', fromPinId: 'out', toNodeId: 'dut', toPinId: faIn[0].pinId },
        { id: 't2', fromNodeId: 'b', fromPinId: 'out', toNodeId: 'dut', toPinId: faIn[1].pinId },
        { id: 't3', fromNodeId: 'c', fromPinId: 'out', toNodeId: 'dut', toPinId: faIn[2].pinId },
        { id: 't4', fromNodeId: 'dut', fromPinId: faOut[0].pinId, toNodeId: 's', toPinId: 'in' },
        { id: 't5', fromNodeId: 'dut', fromPinId: faOut[1].pinId, toNodeId: 'co', toPinId: 'in' },
      ],
    };

    const table = analyzeCircuitTruthTable(testbench, customIcs);
    expect(table.rows).toHaveLength(8);
    for (const row of table.rows) {
      const total = row.inputs['A'] + row.inputs['B'] + row.inputs['CIN'];
      expect(row.outputs['SUM']).toBe((total & 1) === 1 ? 'HIGH' : 'LOW');
      expect(row.outputs['COUT']).toBe(total >= 2 ? 'HIGH' : 'LOW');
    }
  });

  it('prevents direct and indirect circular subcircuit dependencies both at validation and simulation runtime', () => {
    const icA: CustomICDefinition = {
      id: 'ic-cycle-a',
      name: 'Cycle A',
      shortName: 'CYA',
      description: '',
      width: 120,
      height: 80,
      pins: [
        {
          pinId: 'p_in',
          label: 'IN',
          direction: 'input',
          width: 1,
          side: 'left',
          offset: 0.5,
          internalTargets: [{ nodeId: 'n_b', pinId: 'p_in' }],
        },
        {
          pinId: 'p_out',
          label: 'OUT',
          direction: 'output',
          width: 1,
          side: 'right',
          offset: 0.5,
          internalTargets: [{ nodeId: 'n_b', pinId: 'p_out' }],
        },
      ],
      nodes: [{ id: 'n_b', type: 'CUSTOM_IC', label: 'B', x: 0, y: 0, rotation: 0, customIcId: 'ic-cycle-b' }],
      wires: [],
      createdAt: 0,
      updatedAt: 0,
      schemaVersion: 1,
    };

    const icB: CustomICDefinition = {
      ...icA,
      id: 'ic-cycle-b',
      name: 'Cycle B',
      shortName: 'CYB',
      nodes: [{ id: 'n_a', type: 'CUSTOM_IC', label: 'A', x: 0, y: 0, rotation: 0, customIcId: 'ic-cycle-a' }],
    };

    // Direct self-cycle check
    const selfCycle = detectCustomICCycle(
      'ic-self',
      [{ id: 'x', type: 'CUSTOM_IC', label: 'S', x: 0, y: 0, rotation: 0, customIcId: 'ic-self' }],
      {}
    );
    expect(selfCycle.hasCycle).toBe(true);

    // Indirect cycle A -> B -> A check
    const indirect = detectCustomICCycle('ic-cycle-b', icB.nodes, { 'ic-cycle-a': icA });
    expect(indirect.hasCycle).toBe(true);
    expect(indirect.reason).toMatch(/circular/i);

    const validation = validateCustomICDefinition(icB, { 'ic-cycle-a': icA });
    expect(validation.valid).toBe(false);

    // Runtime simulator guard emits CIRCULAR_SUBCIRCUIT issue rather than stack overflowing
    const sim = simulateCircuit(
      [{ id: 'top', type: 'CUSTOM_IC', label: 'TOP', x: 0, y: 0, rotation: 0, customIcId: 'ic-cycle-a' }],
      [],
      { clockHigh: false, customIcs: { 'ic-cycle-a': icA, 'ic-cycle-b': icB } }
    );
    expect(sim.issues.some((i) => i.code === 'CIRCULAR_SUBCIRCUIT')).toBe(true);
  });

  it('serializes and imports Custom IC definitions as JSON including nested dependencies', () => {
    const ha = makeHalfAdderIC('ic-export-ha');
    const json = serializeCustomICToJSON(ha, { [ha.id]: ha });
    const parsed = parseImportedCustomICJSON(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.customIc.id).toBe(ha.id);
    expect(parsed.customIc.pins).toHaveLength(ha.pins.length);
    expect(parsed.customIc.nodes).toHaveLength(ha.nodes.length);

    const bad = parseImportedCustomICJSON('{"not": "an ic"}');
    expect(bad.ok).toBe(false);
  });
});

describe('Phase 1 & 3 — Local Custom IC File API & Security Hardening', () => {
  const testIcId = 'vitest_custom_ic_01';
  const testIcPath = path.resolve(process.cwd(), 'data', 'custom-ics', `${testIcId}.json`);
  let server: http.Server;
  let baseUrl: string;

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await fs.rm(testIcPath, { force: true });
  });

  it('persists Custom ICs to ./data/custom-ics, sets security headers, rejects traversal & malformed JSON, and strips unsafe keys', async () => {
    const app = express();
    app.disable('x-powered-by');
    app.use(express.json({ limit: '2mb' }));
    app.use('/api', createApiRouter());

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;

    // 1. Security headers check
    const healthRes = await fetch(`${baseUrl}/api/health`);
    expect(healthRes.status).toBe(200);
    expect(healthRes.headers.get('x-content-type-options')).toBe('nosniff');
    expect(healthRes.headers.get('referrer-policy')).toBe('no-referrer');
    expect(healthRes.headers.get('x-powered-by')).toBeNull();

    // 2. Reject path traversal on custom-ics endpoint
    const traversalRes = await fetch(`${baseUrl}/api/custom-ics/..%2Fevil`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Evil', shortName: 'EV', pins: [], nodes: [], wires: [] }),
    });
    expect(traversalRes.status).toBeGreaterThanOrEqual(400);
    expect(traversalRes.status).toBeLessThan(500);

    // 3. Reject invalid Custom IC payload (missing pins/nodes)
    const invalidRes = await fetch(`${baseUrl}/api/custom-ics/${testIcId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Incomplete' }),
    });
    expect(invalidRes.status).toBe(400);

    // 4. Save valid Custom IC with a __proto__ injection attempt in JSON string
    const ha = makeHalfAdderIC(testIcId);
    const rawPayloadWithProto = JSON.stringify(ha).replace(
      '{',
      '{"__proto__":{"polluted":true},'
    );
    const putRes = await fetch(`${baseUrl}/api/custom-ics/${testIcId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: rawPayloadWithProto,
    });
    expect(putRes.status).toBe(200);

    // Verify file exists on disk and does not contain __proto__ pollution
    const diskText = await fs.readFile(testIcPath, 'utf-8');
    expect(diskText).not.toContain('polluted');

    // 5. List custom ICs includes our saved IC
    const listRes = await fetch(`${baseUrl}/api/custom-ics`);
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as { customIcs: CustomICDefinition[] };
    expect(listData.customIcs.some((c) => c.id === testIcId)).toBe(true);

    // 6. Delete custom IC cleanly removes disk file
    const delRes = await fetch(`${baseUrl}/api/custom-ics/${testIcId}`, { method: 'DELETE' });
    expect(delRes.status).toBe(200);
    await expect(fs.access(testIcPath)).rejects.toThrow();
  });
});
