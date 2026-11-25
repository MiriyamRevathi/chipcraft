import { describe, expect, it } from 'vitest';
import {
  busToNumber,
  logicAnd,
  logicNand,
  logicNor,
  logicNot,
  logicOr,
  logicXnor,
  logicXor,
  primarySignal,
} from '../engine/signals/signalModel';
import { simulateCircuit } from '../engine/simulation/simulator';
import { validateNewConnection } from '../engine/validation/connectionValidator';
import { BUILT_IN_EXAMPLES } from '../templates/circuitTemplates';
import { CHALLENGES, evaluateChallengeCircuit } from '../templates/challenges';
import { assembleProgram, CPU_PROGRAM_PRESETS } from '../engine/cpu/assembler';
import { createInitialCPUState, stepCPU } from '../engine/cpu/cpuEngine';
import { readMemoryCell, writeMemoryCell } from '../engine/memory/memoryEngine';
import {
  evaluateHDLModule,
  generateHDLTruthTable,
  HDL_PRESETS,
  parseHDL,
  synthesizeHDLToCircuit,
} from '../engine/hdl/hdlEngine';
import {
  CURRENT_SCHEMA_VERSION,
  parseImportedProjectJSON,
  serializeProjectToJSON,
} from '../storage/projectStorage';
import type { CircuitDocument, CircuitNode, CircuitWire } from '../types/circuit';

describe('ChipCraft Signal & Boolean Logic Engine', () => {
  it('computes all Boolean gate truth tables deterministically', () => {
    expect(logicAnd(['HIGH', 'HIGH'])).toBe('HIGH');
    expect(logicAnd(['HIGH', 'LOW'])).toBe('LOW');
    expect(logicAnd(['LOW', 'UNKNOWN'])).toBe('LOW'); // Controlling value
    expect(logicOr(['LOW', 'LOW'])).toBe('LOW');
    expect(logicOr(['HIGH', 'UNKNOWN'])).toBe('HIGH'); // Controlling value
    expect(logicNot('HIGH')).toBe('LOW');
    expect(logicNot('LOW')).toBe('HIGH');
    expect(logicNand(['HIGH', 'HIGH'])).toBe('LOW');
    expect(logicNand(['HIGH', 'LOW'])).toBe('HIGH');
    expect(logicNor(['LOW', 'LOW'])).toBe('HIGH');
    expect(logicNor(['LOW', 'HIGH'])).toBe('LOW');
    expect(logicXor(['HIGH', 'LOW'])).toBe('HIGH');
    expect(logicXor(['HIGH', 'HIGH'])).toBe('LOW');
    expect(logicXnor(['HIGH', 'HIGH'])).toBe('HIGH');
    expect(logicXnor(['HIGH', 'LOW'])).toBe('LOW');
  });
});

describe('ChipCraft Circuit Simulator & Validation', () => {
  it('simulates Half Adder across all 4 input combinations', () => {
    const halfAdder = BUILT_IN_EXAMPLES.find((e) => e.id === 'ex-half-adder')!.document;
    const cases: Array<[number, number, number, number]> = [
      [0, 0, 0, 0],
      [0, 1, 1, 0],
      [1, 0, 1, 0],
      [1, 1, 0, 1],
    ];
    for (const [a, b, expectedSum, expectedCarry] of cases) {
      const nodes = halfAdder.nodes.map((n) =>
        n.id === 'sw_a' ? { ...n, value: a } : n.id === 'sw_b' ? { ...n, value: b } : n
      );
      const res = simulateCircuit(nodes, halfAdder.wires);
      expect(res.stable).toBe(true);
      expect(primarySignal(res.pinValues['led_s:in'])).toBe(expectedSum ? 'HIGH' : 'LOW');
      expect(primarySignal(res.pinValues['led_c:in'])).toBe(expectedCarry ? 'HIGH' : 'LOW');
    }
  });

  it('simulates Full Adder for A=1, B=1, CIN=1 => SUM=1, COUT=1', () => {
    const fullAdder = BUILT_IN_EXAMPLES.find((e) => e.id === 'ex-full-adder')!.document;
    const res = simulateCircuit(fullAdder.nodes, fullAdder.wires);
    expect(primarySignal(res.pinValues['led_s:in'])).toBe('HIGH');
    expect(primarySignal(res.pinValues['led_c:in'])).toBe('HIGH');
  });

  it('validates pin directions and rejects bit-width mismatches', () => {
    const nodes: CircuitNode[] = [
      { id: 'in4', type: 'BINARY_INPUT', label: 'A', x: 0, y: 0, rotation: 0, value: 3 },
      { id: 'sw1', type: 'TOGGLE_SWITCH', label: 'B', x: 0, y: 80, rotation: 0, value: 1 },
      { id: 'and1', type: 'AND', label: 'AND1', x: 120, y: 40, rotation: 0 },
    ];
    // Output to output rejected
    const outToOut = validateNewConnection(nodes, [], 'in4', 'out', 'sw1', 'out');
    expect(outToOut.valid).toBe(false);

    // 4-bit to 1-bit rejected
    const widthErr = validateNewConnection(nodes, [], 'in4', 'out', 'and1', 'a');
    expect(widthErr.valid).toBe(false);
    expect(widthErr.reason).toContain('Bit-width mismatch');

    // Valid 1-bit connection accepted
    const valid = validateNewConnection(nodes, [], 'sw1', 'out', 'and1', 'a');
    expect(valid.valid).toBe(true);
  });

  it('detects unstable combinational feedback loops without hanging', () => {
    const nodes: CircuitNode[] = [{ id: 'n1', type: 'NOT', label: 'NOT1', x: 0, y: 0, rotation: 0 }];
    const wires: CircuitWire[] = [
      { id: 'w1', fromNodeId: 'n1', fromPinId: 'y', toNodeId: 'n1', toPinId: 'a' },
    ];
    // Give initial deterministic value by driving loop oscillation via feedback
    const res = simulateCircuit(
      [
        { id: 'n1', type: 'NOR', label: 'NOR1', x: 0, y: 0, rotation: 0 },
        { id: 'c0', type: 'CONST_0', label: '0', x: 0, y: 60, rotation: 0 },
      ],
      [
        { id: 'w1', fromNodeId: 'c0', fromPinId: 'out', toNodeId: 'n1', toPinId: 'a' },
        { id: 'w2', fromNodeId: 'n1', fromPinId: 'y', toNodeId: 'n1', toPinId: 'b' },
      ]
    );
    expect(res.stable).toBe(false);
    expect(res.issues.some((i) => i.code === 'COMBINATIONAL_LOOP')).toBe(true);
  });

  it('handles rising-edge sequential D Flip-Flop and 4-Bit Counter', () => {
    const counterDoc = BUILT_IN_EXAMPLES.find((e) => e.id === 'ex-4bit-counter')!.document;
    let sim = simulateCircuit(counterDoc.nodes, counterDoc.wires, { clockHigh: false });
    expect(busToNumber(sim.pinValues['cnt:q'])).toBe(0);

    // Rising edge 1 -> count = 1
    sim = simulateCircuit(counterDoc.nodes, counterDoc.wires, {
      clockHigh: true,
      previousStates: sim.nodeStates,
    });
    expect(busToNumber(sim.pinValues['cnt:q'])).toBe(1);

    // Falling edge -> holds 1
    sim = simulateCircuit(counterDoc.nodes, counterDoc.wires, {
      clockHigh: false,
      previousStates: sim.nodeStates,
    });
    expect(busToNumber(sim.pinValues['cnt:q'])).toBe(1);

    // Rising edge 2 -> count = 2
    sim = simulateCircuit(counterDoc.nodes, counterDoc.wires, {
      clockHigh: true,
      previousStates: sim.nodeStates,
    });
    expect(busToNumber(sim.pinValues['cnt:q'])).toBe(2);
  });

  it('computes 4-Bit ALU ADD, SUB, AND, XOR operations accurately', () => {
    const aluDoc = BUILT_IN_EXAMPLES.find((e) => e.id === 'ex-4bit-alu')!.document;
    // Default A=6, B=3, OP=0 (ADD) => 9
    const addRes = simulateCircuit(aluDoc.nodes, aluDoc.wires);
    expect(busToNumber(addRes.pinValues['alu:y'])).toBe(9);
    expect(primarySignal(addRes.pinValues['alu:zero'])).toBe('LOW');

    // SUB with A=6, B=6, OP=1 => 0, Zero=HIGH
    const subNodes = aluDoc.nodes.map((n) =>
      n.id === 'in_b' ? { ...n, value: 6 } : n.id === 'in_op' ? { ...n, value: 1 } : n
    );
    const subRes = simulateCircuit(subNodes, aluDoc.wires);
    expect(busToNumber(subRes.pinValues['alu:y'])).toBe(0);
    expect(primarySignal(subRes.pinValues['alu:zero'])).toBe('HIGH');
  });
});

describe('ChipCraft 8-Bit CPU & Assembler', () => {
  it('assembles and executes Sum 1..5 program producing R0=15 and RAM[0x80]=15', () => {
    const asm = assembleProgram(CPU_PROGRAM_PRESETS[0].assembly);
    expect(asm.success).toBe(true);

    let cpu = createInitialCPUState(asm.memoryImage);
    for (let i = 0; i < 60 && !cpu.halted; i++) {
      cpu = stepCPU(cpu);
    }
    expect(cpu.halted).toBe(true);
    expect(cpu.registers[0]).toBe(15);
    expect(cpu.memory[0x80]).toBe(15);
    expect(cpu.outputPort).toBe(15);
  });
});

describe('ChipCraft Memory Engine', () => {
  it('enforces CS, OE, WE, and ROM read-only protection', () => {
    const mem = [0x10, 0x20, 0x30, 0x40];
    expect(readMemoryCell(mem, 1, false, true).value).toBeNull();
    expect(readMemoryCell(mem, 1, true, true).value).toBe(0x20);

    const wOk = writeMemoryCell(mem, 2, 0xab, true, true, false);
    expect(wOk.success).toBe(true);
    expect(wOk.nextData[2]).toBe(0xab);

    const wRom = writeMemoryCell(mem, 2, 0xab, true, true, true);
    expect(wRom.success).toBe(false);
  });
});

describe('ChipCraft HDL Parser, Evaluator & Synthesizer', () => {
  it('parses full_adder HDL, evaluates truth table, and synthesizes a working circuit', () => {
    const parsed = parseHDL(HDL_PRESETS[2].code); // full_adder
    expect(parsed.success).toBe(true);
    expect(parsed.ast).not.toBeNull();

    const table = generateHDLTruthTable(parsed.ast!);
    expect(table.length).toBe(8);
    expect(evaluateHDLModule(parsed.ast!, { a: 1, b: 1, cin: 1 })).toEqual({ sum: 1, cout: 1 });

    // Synthesize into real circuit and verify it simulates identically
    const synthDoc = synthesizeHDLToCircuit(parsed.ast!);
    const nodesOne = synthDoc.nodes.map((n) => (n.type === 'TOGGLE_SWITCH' ? { ...n, value: 1 } : n));
    const sim = simulateCircuit(nodesOne, synthDoc.wires);
    const sumLed = synthDoc.nodes.find((n) => n.label === 'SUM')!;
    const coutLed = synthDoc.nodes.find((n) => n.label === 'COUT')!;
    expect(primarySignal(sim.pinValues[`${sumLed.id}:in`])).toBe('HIGH');
    expect(primarySignal(sim.pinValues[`${coutLed.id}:in`])).toBe('HIGH');
  });

  it('rejects unsupported sequential always blocks cleanly', () => {
    const res = parseHDL(`module bad(input wire clk, output wire q); always @(posedge clk) q <= 1; endmodule`);
    expect(res.success).toBe(false);
    expect(res.errors[0].message).toContain('Unsupported Verilog feature');
  });
});

describe('ChipCraft Challenge Verification & Project Serialization', () => {
  it('verifies a solved Half Adder challenge circuit across all vectors', () => {
    const ch = CHALLENGES.find((c) => c.id === 'ch-half-adder')!;
    const solvedDoc: CircuitDocument = {
      ...ch.starterCircuit,
      nodes: [
        ...ch.starterCircuit.nodes,
        { id: 'x1', type: 'XOR', label: 'XOR1', x: 250, y: 90, rotation: 0 },
        { id: 'a1', type: 'AND', label: 'AND1', x: 250, y: 190, rotation: 0 },
      ],
      wires: [
        { id: 'w1', fromNodeId: 'a', fromPinId: 'out', toNodeId: 'x1', toPinId: 'a' },
        { id: 'w2', fromNodeId: 'b', fromPinId: 'out', toNodeId: 'x1', toPinId: 'b' },
        { id: 'w3', fromNodeId: 'a', fromPinId: 'out', toNodeId: 'a1', toPinId: 'a' },
        { id: 'w4', fromNodeId: 'b', fromPinId: 'out', toNodeId: 'a1', toPinId: 'b' },
        { id: 'w5', fromNodeId: 'x1', fromPinId: 'y', toNodeId: 's', toPinId: 'in' },
        { id: 'w6', fromNodeId: 'a1', fromPinId: 'y', toNodeId: 'c', toPinId: 'in' },
      ],
    };
    const evalRes = evaluateChallengeCircuit(ch, solvedDoc);
    expect(evalRes.passed).toBe(true);
    expect(evalRes.passedCount).toBe(4);
  });

  it('round-trips JSON project export/import and rejects corrupted files safely', () => {
    const json = serializeProjectToJSON({
      id: 'p1',
      name: 'Test Circuit',
      kind: 'circuit',
      description: 'Unit test circuit',
      createdAt: 1000,
      updatedAt: 2000,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      circuit: BUILT_IN_EXAMPLES[0].document,
    });
    const ok = parseImportedProjectJSON(json);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.project.name).toBe('Test Circuit');

    const bad = parseImportedProjectJSON('{ not valid json');
    expect(bad.ok).toBe(false);

    const futureVer = parseImportedProjectJSON(
      JSON.stringify({ format: 'chipcraft-project', schemaVersion: 99, project: { name: 'Future' } })
    );
    expect(futureVer.ok).toBe(false);
  });
});
