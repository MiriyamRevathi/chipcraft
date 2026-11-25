import { describe, it, expect } from 'vitest';
import {
  busEquals,
  busToNumber,
  formatBusBinary,
  formatBusHex,
  logicAnd,
  logicNand,
  logicNor,
  logicNot,
  logicOr,
  logicXnor,
  logicXor,
  makeBit,
  makeBus,
  makeErrorBus,
  makeHighZBus,
  makeUnknownBus,
  primarySignal,
  resolveBitDrivers,
  resolveBusDrivers,
  signalColor,
  signalLabel,
} from '../engine/signals/signalModel';
import { auditCircuitGraph, validateNewConnection } from '../engine/validation/connectionValidator';
import {
  COMPONENT_CATALOG,
  getNodeDimensions,
  getNodePins,
  getPinAbsolutePosition,
} from '../engine/gates/componentCatalog';
import { assembleProgram, decodeInstructionBytes, CPU_PROGRAM_PRESETS } from '../engine/cpu/assembler';
import { createInitialCPUState, stepCPU } from '../engine/cpu/cpuEngine';
import { HDL_PRESETS, evaluateHDLModule, generateHDLTruthTable, parseHDL } from '../engine/hdl/hdlEngine';
import { simulateCircuit } from '../engine/simulation/simulator';
import type { CircuitNode, CircuitWire } from '../types/circuit';

describe('Signal Model — Five-Valued Logic & Bus Helpers', () => {
  it('constructs and converts 1-bit and multi-bit buses accurately', () => {
    const b = makeBus(4, 0b1010);
    expect(b.width).toBe(4);
    expect(busToNumber(b)).toBe(10);
    expect(formatBusBinary(b)).toBe('1010');
    expect(formatBusHex(b)).toBe('0xA');
    expect(busEquals(b, makeBus(4, 10))).toBe(true);
    expect(busEquals(b, makeBus(4, 5))).toBe(false);
    expect(busEquals(b, makeBus(3, 2))).toBe(false);

    expect(busToNumber(makeUnknownBus(4))).toBeNull();
    expect(formatBusHex(makeUnknownBus(4))).toBe('X');
    expect(formatBusBinary(undefined)).toBe('X');
  });

  it('resolves primarySignal precedence and multi-driver bus contention', () => {
    expect(primarySignal(undefined)).toBe('UNKNOWN');
    expect(primarySignal(makeErrorBus(2))).toBe('ERROR');
    expect(primarySignal(makeUnknownBus(2))).toBe('UNKNOWN');
    expect(primarySignal(makeHighZBus(2))).toBe('HIGH_IMPEDANCE');
    expect(primarySignal(makeBit('HIGH'))).toBe('HIGH');
    expect(primarySignal(makeBit('LOW'))).toBe('LOW');

    expect(resolveBitDrivers([])).toEqual({ state: 'UNKNOWN', contention: false });
    expect(resolveBitDrivers(['HIGH_IMPEDANCE'])).toEqual({ state: 'HIGH_IMPEDANCE', contention: false });
    expect(resolveBitDrivers(['HIGH', 'HIGH_IMPEDANCE'])).toEqual({ state: 'HIGH', contention: false });
    expect(resolveBitDrivers(['HIGH', 'LOW'])).toEqual({ state: 'ERROR', contention: true });

    const busRes = resolveBusDrivers([makeBus(4, 0b0101), makeBus(4, 0b0110)], 4);
    expect(busRes.contention).toBe(true);
    expect(busRes.value.bits).toEqual(['ERROR', 'ERROR', 'HIGH', 'LOW']);
  });

  it('evaluates five-valued gate primitives including controlling values and labels', () => {
    expect(logicNot('HIGH')).toBe('LOW');
    expect(logicNot('LOW')).toBe('HIGH');
    expect(logicNot('ERROR')).toBe('ERROR');
    expect(logicNot('UNKNOWN')).toBe('UNKNOWN');

    expect(logicAnd(['LOW', 'UNKNOWN'])).toBe('LOW');
    expect(logicAnd(['HIGH', 'UNKNOWN'])).toBe('UNKNOWN');
    expect(logicAnd(['HIGH', 'ERROR'])).toBe('ERROR');

    expect(logicOr(['HIGH', 'UNKNOWN'])).toBe('HIGH');
    expect(logicOr(['LOW', 'UNKNOWN'])).toBe('UNKNOWN');

    expect(logicXor(['HIGH', 'LOW'])).toBe('HIGH');
    expect(logicXor(['HIGH', 'HIGH'])).toBe('LOW');
    expect(logicXor(['HIGH', 'UNKNOWN'])).toBe('UNKNOWN');

    expect(logicNand(['HIGH', 'HIGH'])).toBe('LOW');
    expect(logicNor(['LOW', 'LOW'])).toBe('HIGH');
    expect(logicXnor(['LOW', 'LOW'])).toBe('HIGH');

    expect(signalColor('HIGH')).toBe('#16A34A');
    expect(signalLabel('HIGH_IMPEDANCE')).toBe('Hi-Z (Z)');
  });
});

describe('Connection Validator & Component Catalog', () => {
  const nodes: CircuitNode[] = [
    { id: 'sw1', type: 'TOGGLE_SWITCH', label: 'A', x: 0, y: 0, rotation: 0 },
    { id: 'sw2', type: 'TOGGLE_SWITCH', label: 'B', x: 0, y: 80, rotation: 0 },
    { id: 'bin', type: 'BINARY_INPUT', label: 'IN4', x: 0, y: 160, rotation: 0 },
    { id: 'and1', type: 'AND', label: 'AND1', x: 160, y: 40, rotation: 0, inputCount: 3 },
    { id: 'led1', type: 'LED', label: 'Y', x: 320, y: 40, rotation: 0 },
  ];

  it('rejects self-pins, same-direction pins, width mismatches, duplicates, and multi-drivers', () => {
    expect(validateNewConnection(nodes, [], 'sw1', 'out', 'sw1', 'out').valid).toBe(false);
    expect(validateNewConnection(nodes, [], 'sw1', 'out', 'sw2', 'out').valid).toBe(false);
    expect(validateNewConnection(nodes, [], 'and1', 'a', 'led1', 'in').valid).toBe(false);
    expect(validateNewConnection(nodes, [], 'bin', 'out', 'led1', 'in').reason).toContain('Bit-width mismatch');

    // Dragging input -> output normalizes cleanly
    const ok = validateNewConnection(nodes, [], 'and1', 'a', 'sw1', 'out');
    expect(ok.valid).toBe(true);
    expect(ok.normalized).toEqual({ fromNodeId: 'sw1', fromPinId: 'out', toNodeId: 'and1', toPinId: 'a' });

    const existing: CircuitWire[] = [
      { id: 'w1', fromNodeId: 'sw1', fromPinId: 'out', toNodeId: 'and1', toPinId: 'a' },
    ];
    expect(validateNewConnection(nodes, existing, 'sw1', 'out', 'and1', 'a').valid).toBe(false);
    expect(validateNewConnection(nodes, existing, 'sw2', 'out', 'and1', 'a').valid).toBe(false);
  });

  it('audits orphan wires, width mismatches, and multiple drivers on a circuit graph', () => {
    const brokenWires: CircuitWire[] = [
      { id: 'w_orphan', fromNodeId: 'missing', fromPinId: 'out', toNodeId: 'led1', toPinId: 'in' },
      { id: 'w_width', fromNodeId: 'bin', fromPinId: 'out', toNodeId: 'led1', toPinId: 'in' },
      { id: 'w_d1', fromNodeId: 'sw1', fromPinId: 'out', toNodeId: 'and1', toPinId: 'a' },
      { id: 'w_d2', fromNodeId: 'sw2', fromPinId: 'out', toNodeId: 'and1', toPinId: 'a' },
    ];
    const issues = auditCircuitGraph(nodes, brokenWires);
    expect(issues.some((i) => i.code === 'INVALID_CONNECTION')).toBe(true);
    expect(issues.some((i) => i.code === 'WIDTH_MISMATCH')).toBe(true);
    expect(issues.some((i) => i.code === 'MULTIPLE_DRIVERS')).toBe(true);
  });

  it('computes catalog pins, configurable gate heights, and rotated pin positions', () => {
    expect(Object.keys(COMPONENT_CATALOG)).toHaveLength(43);
    const and3 = nodes[3];
    expect(getNodePins(and3).filter((p) => p.direction === 'input')).toHaveLength(3);
    expect(getNodeDimensions(and3).height).toBeGreaterThan(COMPONENT_CATALOG.AND.height);

    const rot90: CircuitNode = { id: 'n90', type: 'NOT', label: 'N', x: 100, y: 100, rotation: 90 };
    const rot180: CircuitNode = { id: 'n180', type: 'NOT', label: 'N', x: 100, y: 100, rotation: 180 };
    const rot270: CircuitNode = { id: 'n270', type: 'NOT', label: 'N', x: 100, y: 100, rotation: 270 };
    expect(getPinAbsolutePosition(rot90, 'y').side).toBe('bottom');
    expect(getPinAbsolutePosition(rot180, 'y').side).toBe('left');
    expect(getPinAbsolutePosition(rot270, 'y').side).toBe('top');
  });
});

describe('Simulator — Arithmetic, Bus, Decoder & Sequential Blocks', () => {
  it('simulates 4-bit Bus Merger -> Bus Splitter round-trip and 2-to-4 Decoder', () => {
    const nodes: CircuitNode[] = [
      { id: 'b0', type: 'CONST_1', label: '1', x: 0, y: 0, rotation: 0 },
      { id: 'b1', type: 'CONST_0', label: '0', x: 0, y: 40, rotation: 0 },
      { id: 'b2', type: 'CONST_1', label: '1', x: 0, y: 80, rotation: 0 },
      { id: 'b3', type: 'CONST_0', label: '0', x: 0, y: 120, rotation: 0 },
      { id: 'mrg', type: 'BUS_MERGER', label: 'M', x: 100, y: 40, rotation: 0 },
      { id: 'spl', type: 'BUS_SPLITTER', label: 'S', x: 220, y: 40, rotation: 0 },
      { id: 'dec', type: 'DECODER_2TO4', label: 'DEC', x: 100, y: 200, rotation: 0 },
    ];
    const wires: CircuitWire[] = [
      { id: 'w0', fromNodeId: 'b0', fromPinId: 'out', toNodeId: 'mrg', toPinId: 'b0' },
      { id: 'w1', fromNodeId: 'b1', fromPinId: 'out', toNodeId: 'mrg', toPinId: 'b1' },
      { id: 'w2', fromNodeId: 'b2', fromPinId: 'out', toNodeId: 'mrg', toPinId: 'b2' },
      { id: 'w3', fromNodeId: 'b3', fromPinId: 'out', toNodeId: 'mrg', toPinId: 'b3' },
      { id: 'wb', fromNodeId: 'mrg', fromPinId: 'out', toNodeId: 'spl', toPinId: 'in' },
      { id: 'da', fromNodeId: 'b0', fromPinId: 'out', toNodeId: 'dec', toPinId: 'a0' },
      { id: 'db', fromNodeId: 'b1', fromPinId: 'out', toNodeId: 'dec', toPinId: 'a1' },
      { id: 'den', fromNodeId: 'b0', fromPinId: 'out', toNodeId: 'dec', toPinId: 'en' },
    ];
    const sim = simulateCircuit(nodes, wires);
    expect(busToNumber(sim.pinValues['mrg:out'])).toBe(0b0101);
    expect(primarySignal(sim.pinValues['spl:b0'])).toBe('HIGH');
    expect(primarySignal(sim.pinValues['spl:b1'])).toBe('LOW');
    expect(primarySignal(sim.pinValues['spl:b2'])).toBe('HIGH');
    expect(primarySignal(sim.pinValues['spl:b3'])).toBe('LOW');
    expect(primarySignal(sim.pinValues['dec:y1'])).toBe('HIGH');
    expect(primarySignal(sim.pinValues['dec:y0'])).toBe('LOW');
  });

  it('simulates Half Subtractor, 4-bit Comparator, and T Flip-Flop toggling', () => {
    const combNodes: CircuitNode[] = [
      { id: 'a', type: 'CONST_0', label: 'A', x: 0, y: 0, rotation: 0 },
      { id: 'b', type: 'CONST_1', label: 'B', x: 0, y: 40, rotation: 0 },
      { id: 'hs', type: 'HALF_SUBTRACTOR', label: 'HS', x: 100, y: 20, rotation: 0 },
      { id: 'inA', type: 'BINARY_INPUT', label: 'A4', x: 0, y: 120, rotation: 0, value: 9 },
      { id: 'inB', type: 'BINARY_INPUT', label: 'B4', x: 0, y: 180, rotation: 0, value: 5 },
      { id: 'cmp', type: 'COMPARATOR_4BIT', label: 'CMP', x: 140, y: 140, rotation: 0 },
    ];
    const combWires: CircuitWire[] = [
      { id: 'w1', fromNodeId: 'a', fromPinId: 'out', toNodeId: 'hs', toPinId: 'a' },
      { id: 'w2', fromNodeId: 'b', fromPinId: 'out', toNodeId: 'hs', toPinId: 'b' },
      { id: 'w3', fromNodeId: 'inA', fromPinId: 'out', toNodeId: 'cmp', toPinId: 'a' },
      { id: 'w4', fromNodeId: 'inB', fromPinId: 'out', toNodeId: 'cmp', toPinId: 'b' },
    ];
    const comb = simulateCircuit(combNodes, combWires);
    // 0 - 1 => DIFF=1, BORROW=1
    expect(primarySignal(comb.pinValues['hs:d'])).toBe('HIGH');
    expect(primarySignal(comb.pinValues['hs:bo'])).toBe('HIGH');
    // 9 > 5 => GT=1, EQ=0, LT=0
    expect(primarySignal(comb.pinValues['cmp:gt'])).toBe('HIGH');
    expect(primarySignal(comb.pinValues['cmp:eq'])).toBe('LOW');

    const tffNodes: CircuitNode[] = [
      { id: 't1', type: 'CONST_1', label: 'T', x: 0, y: 0, rotation: 0 },
      { id: 'clk', type: 'CLOCK', label: 'CLK', x: 0, y: 60, rotation: 0 },
      { id: 'ff', type: 'T_FF', label: 'TFF', x: 120, y: 20, rotation: 0 },
    ];
    const tffWires: CircuitWire[] = [
      { id: 'wt', fromNodeId: 't1', fromPinId: 'out', toNodeId: 'ff', toPinId: 't' },
      { id: 'wc', fromNodeId: 'clk', fromPinId: 'out', toNodeId: 'ff', toPinId: 'clk' },
    ];
    const s0 = simulateCircuit(tffNodes, tffWires, { clockHigh: false });
    const s1 = simulateCircuit(tffNodes, tffWires, { clockHigh: true, previousStates: s0.nodeStates });
    const s2 = simulateCircuit(tffNodes, tffWires, { clockHigh: false, previousStates: s1.nodeStates });
    const s3 = simulateCircuit(tffNodes, tffWires, { clockHigh: true, previousStates: s2.nodeStates });
    expect(primarySignal(s1.pinValues['ff:q'])).toBe('HIGH');
    expect(primarySignal(s3.pinValues['ff:q'])).toBe('LOW');
  });
});

describe('CPU Assembler & HDL Engine Coverage', () => {
  it('executes Fibonacci preset and decodes encoded instruction bytes accurately', () => {
    const fib = CPU_PROGRAM_PRESETS.find((p) => p.id === 'fibonacci')!;
    const asm = assembleProgram(fib.assembly);
    expect(asm.success).toBe(true);

    let cpu = createInitialCPUState(asm.memoryImage);
    for (let i = 0; i < 120 && !cpu.halted; i++) {
      cpu = stepCPU(cpu);
    }
    expect(cpu.halted).toBe(true);
    expect(cpu.outputHistory).toEqual([1, 1, 2, 3, 5, 8, 13]);
    expect(cpu.memory[0x80]).toBe(13);

    const decoded = decodeInstructionBytes(asm.memoryImage[0], asm.memoryImage[1]);
    expect(decoded.opcode).toBe('LOADI');
    expect(decoded.destReg).toBe(0);
    expect(decoded.operand).toBe(1);
  });

  it('rejects invalid label syntax, unknown branch targets, and evaluates all built-in HDL presets', () => {
    const badLabel = assembleProgram('1BAD: NOP');
    expect(badLabel.success).toBe(false);
    const unk = assembleProgram('JUMP NOWHERE');
    expect(unk.success).toBe(false);

    for (const preset of HDL_PRESETS) {
      const parsed = parseHDL(preset.code);
      expect(parsed.success).toBe(true);
      const table = generateHDLTruthTable(parsed.ast!);
      expect(table.length).toBeGreaterThan(0);
    }
    const muxParsed = parseHDL('module inv(input wire a, output wire y); assign y = ~a; endmodule');
    expect(muxParsed.success).toBe(true);
    expect(evaluateHDLModule(muxParsed.ast!, { a: 0 })).toEqual({ y: 1 });
  });
});
