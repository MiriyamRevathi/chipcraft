import type {
  CircuitNode,
  ComponentCategory,
  ComponentSpec,
  ComponentType,
  CustomICDefinition,
  PinDefinition,
} from '../../types/circuit';

export const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  input: 'Inputs',
  logic: 'Logic Gates',
  arithmetic: 'Arithmetic',
  sequential: 'Sequential',
  output: 'Outputs',
  advanced: 'Advanced ICs',
  custom: 'Custom ICs',
};

export const CATEGORY_ORDER: ComponentCategory[] = [
  'input',
  'logic',
  'arithmetic',
  'sequential',
  'output',
  'advanced',
  'custom',
];

let activeCustomICRegistry: Record<string, CustomICDefinition> = {};

export function setActiveCustomICRegistry(registry: Record<string, CustomICDefinition>): void {
  activeCustomICRegistry = registry;
}

export function getActiveCustomICRegistry(): Record<string, CustomICDefinition> {
  return activeCustomICRegistry;
}

export function getCustomICForNode(
  node: CircuitNode,
  customIcs?: Record<string, CustomICDefinition>
): CustomICDefinition | undefined {
  if (node.type !== 'CUSTOM_IC' || !node.customIcId) return undefined;
  return (customIcs ?? activeCustomICRegistry)[node.customIcId];
}

export const COMPONENT_CATALOG: Record<ComponentType, ComponentSpec> = {
  // ================= INPUTS =================
  TOGGLE_SWITCH: {
    type: 'TOGGLE_SWITCH',
    name: 'Toggle Switch',
    shortName: 'SW',
    category: 'input',
    description: 'Manual 1-bit binary toggle input (0 or 1). Click on canvas to switch state.',
    width: 72,
    height: 44,
    rotatable: true,
    pins: [{ id: 'out', label: 'OUT', direction: 'output', width: 1, side: 'right', offset: 0.5 }],
  },
  PUSH_BUTTON: {
    type: 'PUSH_BUTTON',
    name: 'Push Button',
    shortName: 'BTN',
    category: 'input',
    description: 'Momentary 1-bit input switch. Hold or click to pulse HIGH.',
    width: 72,
    height: 44,
    rotatable: true,
    pins: [{ id: 'out', label: 'OUT', direction: 'output', width: 1, side: 'right', offset: 0.5 }],
  },
  BINARY_INPUT: {
    type: 'BINARY_INPUT',
    name: '4-Bit Input',
    shortName: 'IN4',
    category: 'input',
    description: '4-bit parallel binary input register (0x0 to 0xF). Click bits to toggle.',
    width: 108,
    height: 54,
    rotatable: false,
    pins: [{ id: 'out', label: 'D[3:0]', direction: 'output', width: 4, side: 'right', offset: 0.5 }],
  },
  CLOCK: {
    type: 'CLOCK',
    name: 'Clock Signal',
    shortName: 'CLK',
    category: 'input',
    description: 'Periodic square-wave clock generator driving sequential circuits.',
    width: 80,
    height: 44,
    rotatable: true,
    pins: [{ id: 'out', label: 'CLK', direction: 'output', width: 1, side: 'right', offset: 0.5 }],
  },
  CONST_0: {
    type: 'CONST_0',
    name: 'Constant 0 (GND)',
    shortName: '0',
    category: 'input',
    description: 'Permanent logic LOW (0) reference source.',
    width: 56,
    height: 36,
    rotatable: true,
    pins: [{ id: 'out', label: '0', direction: 'output', width: 1, side: 'right', offset: 0.5 }],
  },
  CONST_1: {
    type: 'CONST_1',
    name: 'Constant 1 (VCC)',
    shortName: '1',
    category: 'input',
    description: 'Permanent logic HIGH (1) reference source.',
    width: 56,
    height: 36,
    rotatable: true,
    pins: [{ id: 'out', label: '1', direction: 'output', width: 1, side: 'right', offset: 0.5 }],
  },

  // ================= LOGIC GATES =================
  AND: {
    type: 'AND',
    name: 'AND Gate',
    shortName: 'AND',
    category: 'logic',
    description: 'Outputs HIGH only when all inputs are HIGH (Y = A · B).',
    width: 88,
    height: 56,
    rotatable: true,
    configurableInputs: true,
    pins: [
      { id: 'a', label: 'A', direction: 'input', width: 1, side: 'left', offset: 0.28 },
      { id: 'b', label: 'B', direction: 'input', width: 1, side: 'left', offset: 0.72 },
      { id: 'y', label: 'Y', direction: 'output', width: 1, side: 'right', offset: 0.5 },
    ],
  },
  OR: {
    type: 'OR',
    name: 'OR Gate',
    shortName: 'OR',
    category: 'logic',
    description: 'Outputs HIGH when at least one input is HIGH (Y = A + B).',
    width: 88,
    height: 56,
    rotatable: true,
    configurableInputs: true,
    pins: [
      { id: 'a', label: 'A', direction: 'input', width: 1, side: 'left', offset: 0.28 },
      { id: 'b', label: 'B', direction: 'input', width: 1, side: 'left', offset: 0.72 },
      { id: 'y', label: 'Y', direction: 'output', width: 1, side: 'right', offset: 0.5 },
    ],
  },
  NOT: {
    type: 'NOT',
    name: 'NOT Gate (Inverter)',
    shortName: 'NOT',
    category: 'logic',
    description: 'Inverts its input signal (Y = ¬A).',
    width: 76,
    height: 48,
    rotatable: true,
    pins: [
      { id: 'a', label: 'A', direction: 'input', width: 1, side: 'left', offset: 0.5 },
      { id: 'y', label: 'Y', direction: 'output', width: 1, side: 'right', offset: 0.5 },
    ],
  },
  NAND: {
    type: 'NAND',
    name: 'NAND Gate',
    shortName: 'NAND',
    category: 'logic',
    description: 'Universal gate: outputs LOW only when all inputs are HIGH (Y = ¬(A · B)).',
    width: 92,
    height: 56,
    rotatable: true,
    configurableInputs: true,
    pins: [
      { id: 'a', label: 'A', direction: 'input', width: 1, side: 'left', offset: 0.28 },
      { id: 'b', label: 'B', direction: 'input', width: 1, side: 'left', offset: 0.72 },
      { id: 'y', label: 'Y', direction: 'output', width: 1, side: 'right', offset: 0.5 },
    ],
  },
  NOR: {
    type: 'NOR',
    name: 'NOR Gate',
    shortName: 'NOR',
    category: 'logic',
    description: 'Universal gate: outputs HIGH only when all inputs are LOW (Y = ¬(A + B)).',
    width: 92,
    height: 56,
    rotatable: true,
    configurableInputs: true,
    pins: [
      { id: 'a', label: 'A', direction: 'input', width: 1, side: 'left', offset: 0.28 },
      { id: 'b', label: 'B', direction: 'input', width: 1, side: 'left', offset: 0.72 },
      { id: 'y', label: 'Y', direction: 'output', width: 1, side: 'right', offset: 0.5 },
    ],
  },
  XOR: {
    type: 'XOR',
    name: 'XOR Gate',
    shortName: 'XOR',
    category: 'logic',
    description: 'Outputs HIGH when an odd number of inputs are HIGH (Y = A ⊕ B).',
    width: 92,
    height: 56,
    rotatable: true,
    configurableInputs: true,
    pins: [
      { id: 'a', label: 'A', direction: 'input', width: 1, side: 'left', offset: 0.28 },
      { id: 'b', label: 'B', direction: 'input', width: 1, side: 'left', offset: 0.72 },
      { id: 'y', label: 'Y', direction: 'output', width: 1, side: 'right', offset: 0.5 },
    ],
  },
  XNOR: {
    type: 'XNOR',
    name: 'XNOR Gate',
    shortName: 'XNOR',
    category: 'logic',
    description: 'Equivalence gate: outputs HIGH when inputs match (Y = ¬(A ⊕ B)).',
    width: 96,
    height: 56,
    rotatable: true,
    configurableInputs: true,
    pins: [
      { id: 'a', label: 'A', direction: 'input', width: 1, side: 'left', offset: 0.28 },
      { id: 'b', label: 'B', direction: 'input', width: 1, side: 'left', offset: 0.72 },
      { id: 'y', label: 'Y', direction: 'output', width: 1, side: 'right', offset: 0.5 },
    ],
  },
  BUFFER: {
    type: 'BUFFER',
    name: 'Buffer',
    shortName: 'BUF',
    category: 'logic',
    description: 'Passes input signal directly to output with signal isolation (Y = A).',
    width: 72,
    height: 48,
    rotatable: true,
    pins: [
      { id: 'a', label: 'A', direction: 'input', width: 1, side: 'left', offset: 0.5 },
      { id: 'y', label: 'Y', direction: 'output', width: 1, side: 'right', offset: 0.5 },
    ],
  },

  // ================= ARITHMETIC =================
  HALF_ADDER: {
    type: 'HALF_ADDER',
    name: 'Half Adder',
    shortName: 'HA',
    category: 'arithmetic',
    description: 'Adds two 1-bit values, producing Sum (A ⊕ B) and Carry (A · B).',
    width: 112,
    height: 76,
    rotatable: false,
    pins: [
      { id: 'a', label: 'A', direction: 'input', width: 1, side: 'left', offset: 0.3 },
      { id: 'b', label: 'B', direction: 'input', width: 1, side: 'left', offset: 0.7 },
      { id: 's', label: 'SUM', direction: 'output', width: 1, side: 'right', offset: 0.3 },
      { id: 'c', label: 'CARRY', direction: 'output', width: 1, side: 'right', offset: 0.7 },
    ],
  },
  FULL_ADDER: {
    type: 'FULL_ADDER',
    name: 'Full Adder',
    shortName: 'FA',
    category: 'arithmetic',
    description: 'Adds A, B, and Carry-In (Cin) producing Sum and Carry-Out (Cout).',
    width: 116,
    height: 92,
    rotatable: false,
    pins: [
      { id: 'a', label: 'A', direction: 'input', width: 1, side: 'left', offset: 0.22 },
      { id: 'b', label: 'B', direction: 'input', width: 1, side: 'left', offset: 0.5 },
      { id: 'cin', label: 'CIN', direction: 'input', width: 1, side: 'left', offset: 0.78 },
      { id: 's', label: 'SUM', direction: 'output', width: 1, side: 'right', offset: 0.32 },
      { id: 'cout', label: 'COUT', direction: 'output', width: 1, side: 'right', offset: 0.68 },
    ],
  },
  HALF_SUBTRACTOR: {
    type: 'HALF_SUBTRACTOR',
    name: 'Half Subtractor',
    shortName: 'HS',
    category: 'arithmetic',
    description: 'Subtracts B from A producing Difference (A ⊕ B) and Borrow (¬A · B).',
    width: 116,
    height: 76,
    rotatable: false,
    pins: [
      { id: 'a', label: 'A', direction: 'input', width: 1, side: 'left', offset: 0.3 },
      { id: 'b', label: 'B', direction: 'input', width: 1, side: 'left', offset: 0.7 },
      { id: 'd', label: 'DIFF', direction: 'output', width: 1, side: 'right', offset: 0.3 },
      { id: 'bo', label: 'BORR', direction: 'output', width: 1, side: 'right', offset: 0.7 },
    ],
  },
  FULL_SUBTRACTOR: {
    type: 'FULL_SUBTRACTOR',
    name: 'Full Subtractor',
    shortName: 'FS',
    category: 'arithmetic',
    description: 'Subtracts B and Borrow-In (Bin) from A producing Diff and Borrow-Out.',
    width: 116,
    height: 92,
    rotatable: false,
    pins: [
      { id: 'a', label: 'A', direction: 'input', width: 1, side: 'left', offset: 0.22 },
      { id: 'b', label: 'B', direction: 'input', width: 1, side: 'left', offset: 0.5 },
      { id: 'bin', label: 'BIN', direction: 'input', width: 1, side: 'left', offset: 0.78 },
      { id: 'd', label: 'DIFF', direction: 'output', width: 1, side: 'right', offset: 0.32 },
      { id: 'bout', label: 'BOUT', direction: 'output', width: 1, side: 'right', offset: 0.68 },
    ],
  },
  ADDER_4BIT: {
    type: 'ADDER_4BIT',
    name: '4-Bit Adder',
    shortName: 'ADD4',
    category: 'arithmetic',
    description: 'Ripple-carry 4-bit binary adder: computes A[3:0] + B[3:0] + Cin.',
    width: 132,
    height: 100,
    rotatable: false,
    pins: [
      { id: 'a', label: 'A[3:0]', direction: 'input', width: 4, side: 'left', offset: 0.22 },
      { id: 'b', label: 'B[3:0]', direction: 'input', width: 4, side: 'left', offset: 0.52 },
      { id: 'cin', label: 'CIN', direction: 'input', width: 1, side: 'left', offset: 0.82 },
      { id: 'sum', label: 'S[3:0]', direction: 'output', width: 4, side: 'right', offset: 0.35 },
      { id: 'cout', label: 'COUT', direction: 'output', width: 1, side: 'right', offset: 0.72 },
    ],
  },
  MUX_2TO1: {
    type: 'MUX_2TO1',
    name: '2:1 Multiplexer',
    shortName: 'MUX',
    category: 'arithmetic',
    description: 'Routes D0 when SEL=0, or D1 when SEL=1, to output Y.',
    width: 108,
    height: 88,
    rotatable: false,
    pins: [
      { id: 'd0', label: 'D0', direction: 'input', width: 1, side: 'left', offset: 0.24 },
      { id: 'd1', label: 'D1', direction: 'input', width: 1, side: 'left', offset: 0.54 },
      { id: 'sel', label: 'SEL', direction: 'input', width: 1, side: 'left', offset: 0.82 },
      { id: 'y', label: 'Y', direction: 'output', width: 1, side: 'right', offset: 0.5 },
    ],
  },
  DEMUX_1TO2: {
    type: 'DEMUX_1TO2',
    name: '1:2 Demultiplexer',
    shortName: 'DMUX',
    category: 'arithmetic',
    description: 'Routes input D to Y0 (SEL=0) or Y1 (SEL=1).',
    width: 108,
    height: 84,
    rotatable: false,
    pins: [
      { id: 'd', label: 'IN', direction: 'input', width: 1, side: 'left', offset: 0.32 },
      { id: 'sel', label: 'SEL', direction: 'input', width: 1, side: 'left', offset: 0.72 },
      { id: 'y0', label: 'Y0', direction: 'output', width: 1, side: 'right', offset: 0.32 },
      { id: 'y1', label: 'Y1', direction: 'output', width: 1, side: 'right', offset: 0.72 },
    ],
  },
  COMPARATOR_4BIT: {
    type: 'COMPARATOR_4BIT',
    name: '4-Bit Comparator',
    shortName: 'CMP4',
    category: 'arithmetic',
    description: 'Compares two 4-bit unsigned numbers A and B (A>B, A=B, A<B).',
    width: 132,
    height: 98,
    rotatable: false,
    pins: [
      { id: 'a', label: 'A[3:0]', direction: 'input', width: 4, side: 'left', offset: 0.32 },
      { id: 'b', label: 'B[3:0]', direction: 'input', width: 4, side: 'left', offset: 0.68 },
      { id: 'gt', label: 'A>B', direction: 'output', width: 1, side: 'right', offset: 0.22 },
      { id: 'eq', label: 'A=B', direction: 'output', width: 1, side: 'right', offset: 0.5 },
      { id: 'lt', label: 'A<B', direction: 'output', width: 1, side: 'right', offset: 0.78 },
    ],
  },

  // ================= SEQUENTIAL =================
  SR_LATCH: {
    type: 'SR_LATCH',
    name: 'SR Latch',
    shortName: 'SR',
    category: 'sequential',
    description: 'Asynchronous Set-Reset latch storing 1 bit. S=1 sets Q=1, R=1 resets Q=0.',
    width: 106,
    height: 78,
    rotatable: false,
    pins: [
      { id: 's', label: 'S', direction: 'input', width: 1, side: 'left', offset: 0.3 },
      { id: 'r', label: 'R', direction: 'input', width: 1, side: 'left', offset: 0.7 },
      { id: 'q', label: 'Q', direction: 'output', width: 1, side: 'right', offset: 0.3 },
      { id: 'qb', label: 'Q̄', direction: 'output', width: 1, side: 'right', offset: 0.7 },
    ],
  },
  D_LATCH: {
    type: 'D_LATCH',
    name: 'D Latch',
    shortName: 'DLAT',
    category: 'sequential',
    description: 'Level-sensitive data latch: transparent when EN=1, holds state when EN=0.',
    width: 106,
    height: 78,
    rotatable: false,
    pins: [
      { id: 'd', label: 'D', direction: 'input', width: 1, side: 'left', offset: 0.3 },
      { id: 'en', label: 'EN', direction: 'input', width: 1, side: 'left', offset: 0.7 },
      { id: 'q', label: 'Q', direction: 'output', width: 1, side: 'right', offset: 0.3 },
      { id: 'qb', label: 'Q̄', direction: 'output', width: 1, side: 'right', offset: 0.7 },
    ],
  },
  D_FF: {
    type: 'D_FF',
    name: 'D Flip-Flop',
    shortName: 'D-FF',
    category: 'sequential',
    description: 'Rising-edge triggered D flip-flop with asynchronous reset (RST).',
    width: 112,
    height: 92,
    rotatable: false,
    pins: [
      { id: 'd', label: 'D', direction: 'input', width: 1, side: 'left', offset: 0.24 },
      { id: 'clk', label: 'CLK', direction: 'input', width: 1, side: 'left', offset: 0.54 },
      { id: 'rst', label: 'RST', direction: 'input', width: 1, side: 'left', offset: 0.82 },
      { id: 'q', label: 'Q', direction: 'output', width: 1, side: 'right', offset: 0.32 },
      { id: 'qb', label: 'Q̄', direction: 'output', width: 1, side: 'right', offset: 0.68 },
    ],
  },
  JK_FF: {
    type: 'JK_FF',
    name: 'JK Flip-Flop',
    shortName: 'JK-FF',
    category: 'sequential',
    description: 'Rising-edge JK flip-flop: 00 hold, 01 reset, 10 set, 11 toggle.',
    width: 112,
    height: 96,
    rotatable: false,
    pins: [
      { id: 'j', label: 'J', direction: 'input', width: 1, side: 'left', offset: 0.22 },
      { id: 'clk', label: 'CLK', direction: 'input', width: 1, side: 'left', offset: 0.5 },
      { id: 'k', label: 'K', direction: 'input', width: 1, side: 'left', offset: 0.78 },
      { id: 'q', label: 'Q', direction: 'output', width: 1, side: 'right', offset: 0.32 },
      { id: 'qb', label: 'Q̄', direction: 'output', width: 1, side: 'right', offset: 0.68 },
    ],
  },
  T_FF: {
    type: 'T_FF',
    name: 'T Flip-Flop',
    shortName: 'T-FF',
    category: 'sequential',
    description: 'Rising-edge toggle flip-flop: toggles Q on clock edge when T=1.',
    width: 112,
    height: 92,
    rotatable: false,
    pins: [
      { id: 't', label: 'T', direction: 'input', width: 1, side: 'left', offset: 0.24 },
      { id: 'clk', label: 'CLK', direction: 'input', width: 1, side: 'left', offset: 0.54 },
      { id: 'rst', label: 'RST', direction: 'input', width: 1, side: 'left', offset: 0.82 },
      { id: 'q', label: 'Q', direction: 'output', width: 1, side: 'right', offset: 0.32 },
      { id: 'qb', label: 'Q̄', direction: 'output', width: 1, side: 'right', offset: 0.68 },
    ],
  },
  REGISTER_4BIT: {
    type: 'REGISTER_4BIT',
    name: '4-Bit Register',
    shortName: 'REG4',
    category: 'sequential',
    description: '4-bit parallel load register. Latches D[3:0] on rising CLK when LOAD=1.',
    width: 136,
    height: 108,
    rotatable: false,
    pins: [
      { id: 'd', label: 'D[3:0]', direction: 'input', width: 4, side: 'left', offset: 0.2 },
      { id: 'load', label: 'LD', direction: 'input', width: 1, side: 'left', offset: 0.44 },
      { id: 'clk', label: 'CLK', direction: 'input', width: 1, side: 'left', offset: 0.66 },
      { id: 'rst', label: 'RST', direction: 'input', width: 1, side: 'left', offset: 0.86 },
      { id: 'q', label: 'Q[3:0]', direction: 'output', width: 4, side: 'right', offset: 0.5 },
    ],
  },
  COUNTER_4BIT: {
    type: 'COUNTER_4BIT',
    name: '4-Bit Counter',
    shortName: 'CNT4',
    category: 'sequential',
    description: 'Synchronous 4-bit binary up-counter (0..15) with Enable, Clock, Reset, and Overflow.',
    width: 136,
    height: 102,
    rotatable: false,
    pins: [
      { id: 'en', label: 'EN', direction: 'input', width: 1, side: 'left', offset: 0.22 },
      { id: 'clk', label: 'CLK', direction: 'input', width: 1, side: 'left', offset: 0.52 },
      { id: 'rst', label: 'RST', direction: 'input', width: 1, side: 'left', offset: 0.82 },
      { id: 'q', label: 'Q[3:0]', direction: 'output', width: 4, side: 'right', offset: 0.35 },
      { id: 'ovf', label: 'OVF', direction: 'output', width: 1, side: 'right', offset: 0.72 },
    ],
  },

  // ================= OUTPUTS =================
  LED: {
    type: 'LED',
    name: 'LED Indicator',
    shortName: 'LED',
    category: 'output',
    description: '1-bit visual light indicator illuminating when input is HIGH.',
    width: 68,
    height: 44,
    rotatable: true,
    pins: [{ id: 'in', label: 'IN', direction: 'input', width: 1, side: 'left', offset: 0.5 }],
  },
  BINARY_DISPLAY: {
    type: 'BINARY_DISPLAY',
    name: '4-Bit Display',
    shortName: 'BIN4',
    category: 'output',
    description: 'Displays a 4-bit bus simultaneously in binary, decimal, and hex.',
    width: 112,
    height: 54,
    rotatable: false,
    pins: [{ id: 'in', label: 'D[3:0]', direction: 'input', width: 4, side: 'left', offset: 0.5 }],
  },
  SEVEN_SEGMENT: {
    type: 'SEVEN_SEGMENT',
    name: '7-Segment Display',
    shortName: '7SEG',
    category: 'output',
    description: 'Hexadecimal 7-segment LED display driven by a 4-bit input bus (0–F).',
    width: 82,
    height: 98,
    rotatable: false,
    pins: [{ id: 'in', label: 'D[3:0]', direction: 'input', width: 4, side: 'left', offset: 0.5 }],
  },
  OUTPUT_PIN: {
    type: 'OUTPUT_PIN',
    name: 'Output Pin',
    shortName: 'OUT',
    category: 'output',
    description: 'Named 1-bit circuit output terminal used for inspection and challenge testing.',
    width: 72,
    height: 44,
    rotatable: true,
    pins: [{ id: 'in', label: 'IN', direction: 'input', width: 1, side: 'left', offset: 0.5 }],
  },
  PROBE: {
    type: 'PROBE',
    name: 'Digital Probe',
    shortName: 'PRB',
    category: 'output',
    description: 'Non-intrusive logic analyzer probe that records transitions to Signal Analyzer.',
    width: 78,
    height: 40,
    rotatable: false,
    pins: [{ id: 'in', label: 'SIG', direction: 'input', width: 1, side: 'left', offset: 0.5 }],
  },

  // ================= ADVANCED =================
  ALU_4BIT: {
    type: 'ALU_4BIT',
    name: '4-Bit ALU',
    shortName: 'ALU4',
    category: 'advanced',
    description: '4-bit Arithmetic Logic Unit. OP: 0=ADD, 1=SUB, 2=AND, 3=OR, 4=XOR, 5=NOT A, 6=SHL, 7=SHR.',
    width: 146,
    height: 124,
    rotatable: false,
    pins: [
      { id: 'a', label: 'A[3:0]', direction: 'input', width: 4, side: 'left', offset: 0.2 },
      { id: 'b', label: 'B[3:0]', direction: 'input', width: 4, side: 'left', offset: 0.5 },
      { id: 'op', label: 'OP[3:0]', direction: 'input', width: 4, side: 'left', offset: 0.8 },
      { id: 'y', label: 'Y[3:0]', direction: 'output', width: 4, side: 'right', offset: 0.26 },
      { id: 'zero', label: 'Z', direction: 'output', width: 1, side: 'right', offset: 0.56 },
      { id: 'carry', label: 'C', direction: 'output', width: 1, side: 'right', offset: 0.82 },
    ],
  },
  ROM_16X4: {
    type: 'ROM_16X4',
    name: 'ROM (16×4)',
    shortName: 'ROM',
    category: 'advanced',
    description: '16-address × 4-bit Read-Only Memory table. Editable lookup table in Inspector.',
    width: 132,
    height: 92,
    rotatable: false,
    defaultProps: {
      data: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    },
    pins: [
      { id: 'addr', label: 'A[3:0]', direction: 'input', width: 4, side: 'left', offset: 0.35 },
      { id: 'oe', label: 'OE', direction: 'input', width: 1, side: 'left', offset: 0.72 },
      { id: 'dout', label: 'D[3:0]', direction: 'output', width: 4, side: 'right', offset: 0.5 },
    ],
  },
  RAM_16X4: {
    type: 'RAM_16X4',
    name: 'RAM (16×4)',
    shortName: 'RAM',
    category: 'advanced',
    description: '16-address × 4-bit synchronous Read/Write Memory. Writes DIN on rising CLK when WE=1.',
    width: 142,
    height: 118,
    rotatable: false,
    pins: [
      { id: 'addr', label: 'A[3:0]', direction: 'input', width: 4, side: 'left', offset: 0.18 },
      { id: 'din', label: 'DI[3:0]', direction: 'input', width: 4, side: 'left', offset: 0.42 },
      { id: 'we', label: 'WE', direction: 'input', width: 1, side: 'left', offset: 0.65 },
      { id: 'clk', label: 'CLK', direction: 'input', width: 1, side: 'left', offset: 0.85 },
      { id: 'dout', label: 'DO[3:0]', direction: 'output', width: 4, side: 'right', offset: 0.5 },
    ],
  },
  BUS_SPLITTER: {
    type: 'BUS_SPLITTER',
    name: '4-Bit Bus Splitter',
    shortName: 'SPLIT',
    category: 'advanced',
    description: 'Splits a 4-bit bus into four individual 1-bit wires (B0..B3).',
    width: 96,
    height: 100,
    rotatable: false,
    pins: [
      { id: 'in', label: 'IN[3:0]', direction: 'input', width: 4, side: 'left', offset: 0.5 },
      { id: 'b0', label: 'B0', direction: 'output', width: 1, side: 'right', offset: 0.17 },
      { id: 'b1', label: 'B1', direction: 'output', width: 1, side: 'right', offset: 0.39 },
      { id: 'b2', label: 'B2', direction: 'output', width: 1, side: 'right', offset: 0.61 },
      { id: 'b3', label: 'B3', direction: 'output', width: 1, side: 'right', offset: 0.83 },
    ],
  },
  BUS_MERGER: {
    type: 'BUS_MERGER',
    name: '4-Bit Bus Merger',
    shortName: 'MERGE',
    category: 'advanced',
    description: 'Combines four 1-bit signals (B0..B3) into a 4-bit bus.',
    width: 96,
    height: 100,
    rotatable: false,
    pins: [
      { id: 'b0', label: 'B0', direction: 'input', width: 1, side: 'left', offset: 0.17 },
      { id: 'b1', label: 'B1', direction: 'input', width: 1, side: 'left', offset: 0.39 },
      { id: 'b2', label: 'B2', direction: 'input', width: 1, side: 'left', offset: 0.61 },
      { id: 'b3', label: 'B3', direction: 'input', width: 1, side: 'left', offset: 0.83 },
      { id: 'out', label: 'OUT[3:0]', direction: 'output', width: 4, side: 'right', offset: 0.5 },
    ],
  },
  CLOCK_DIVIDER: {
    type: 'CLOCK_DIVIDER',
    name: 'Clock Divider',
    shortName: 'DIV',
    category: 'advanced',
    description: 'Divides input clock frequency by /2 and /4 on rising edges.',
    width: 112,
    height: 82,
    rotatable: false,
    pins: [
      { id: 'clk', label: 'CLK', direction: 'input', width: 1, side: 'left', offset: 0.32 },
      { id: 'rst', label: 'RST', direction: 'input', width: 1, side: 'left', offset: 0.72 },
      { id: 'div2', label: '/2', direction: 'output', width: 1, side: 'right', offset: 0.32 },
      { id: 'div4', label: '/4', direction: 'output', width: 1, side: 'right', offset: 0.72 },
    ],
  },
  DECODER_2TO4: {
    type: 'DECODER_2TO4',
    name: '2-to-4 Decoder',
    shortName: 'DEC24',
    category: 'advanced',
    description: 'Activates one of four outputs (Y0..Y3) based on 2-bit address (A1, A0) when EN=1.',
    width: 118,
    height: 106,
    rotatable: false,
    pins: [
      { id: 'a0', label: 'A0', direction: 'input', width: 1, side: 'left', offset: 0.22 },
      { id: 'a1', label: 'A1', direction: 'input', width: 1, side: 'left', offset: 0.5 },
      { id: 'en', label: 'EN', direction: 'input', width: 1, side: 'left', offset: 0.78 },
      { id: 'y0', label: 'Y0', direction: 'output', width: 1, side: 'right', offset: 0.17 },
      { id: 'y1', label: 'Y1', direction: 'output', width: 1, side: 'right', offset: 0.39 },
      { id: 'y2', label: 'Y2', direction: 'output', width: 1, side: 'right', offset: 0.61 },
      { id: 'y3', label: 'Y3', direction: 'output', width: 1, side: 'right', offset: 0.83 },
    ],
  },
  ENCODER_4TO2: {
    type: 'ENCODER_4TO2',
    name: '4-to-2 Priority Encoder',
    shortName: 'ENC42',
    category: 'advanced',
    description: 'Encodes highest active input (I3..I0) into 2-bit output (Y1, Y0) plus Valid flag.',
    width: 118,
    height: 106,
    rotatable: false,
    pins: [
      { id: 'i0', label: 'I0', direction: 'input', width: 1, side: 'left', offset: 0.17 },
      { id: 'i1', label: 'I1', direction: 'input', width: 1, side: 'left', offset: 0.39 },
      { id: 'i2', label: 'I2', direction: 'input', width: 1, side: 'left', offset: 0.61 },
      { id: 'i3', label: 'I3', direction: 'input', width: 1, side: 'left', offset: 0.83 },
      { id: 'y0', label: 'Y0', direction: 'output', width: 1, side: 'right', offset: 0.24 },
      { id: 'y1', label: 'Y1', direction: 'output', width: 1, side: 'right', offset: 0.52 },
      { id: 'v', label: 'V', direction: 'output', width: 1, side: 'right', offset: 0.8 },
    ],
  },
  CUSTOM_IC: {
    type: 'CUSTOM_IC',
    name: 'Custom Subcircuit IC',
    shortName: 'IC',
    category: 'custom',
    description: 'User-packaged reusable subcircuit integrated circuit with independent internal state.',
    width: 132,
    height: 92,
    rotatable: false,
    pins: [],
  },
};

const INPUT_NAMES = ['a', 'b', 'c', 'd'];

export function getNodePins(
  node: CircuitNode,
  customIcs?: Record<string, CustomICDefinition>
): PinDefinition[] {
  if (node.type === 'CUSTOM_IC') {
    const ic = getCustomICForNode(node, customIcs);
    if (!ic) return [];
    return ic.pins.map((p) => ({
      id: p.pinId,
      label: p.label,
      direction: p.direction,
      width: p.width,
      side: p.side,
      offset: p.offset,
    }));
  }

  const spec = COMPONENT_CATALOG[node.type];
  if (!spec) return [];
  if (spec.configurableInputs && node.inputCount && node.inputCount > 2) {
    const count = Math.min(4, Math.max(2, node.inputCount));
    const inputPins: PinDefinition[] = [];
    for (let i = 0; i < count; i++) {
      const id = INPUT_NAMES[i];
      inputPins.push({
        id,
        label: id.toUpperCase(),
        direction: 'input',
        width: 1,
        side: 'left',
        offset: (i + 1) / (count + 1),
      });
    }
    const outputPins = spec.pins.filter((p) => p.direction === 'output');
    return [...inputPins, ...outputPins];
  }
  return spec.pins;
}

export function getNodeDimensions(
  node: CircuitNode,
  customIcs?: Record<string, CustomICDefinition>
): { width: number; height: number } {
  if (node.type === 'CUSTOM_IC') {
    const ic = getCustomICForNode(node, customIcs);
    if (ic) return { width: ic.width, height: ic.height };
    return { width: 132, height: 92 };
  }

  const spec = COMPONENT_CATALOG[node.type];
  if (!spec) return { width: 88, height: 56 };
  const extraHeight =
    spec.configurableInputs && node.inputCount && node.inputCount > 2
      ? (node.inputCount - 2) * 14
      : 0;
  return { width: spec.width, height: spec.height + extraHeight };
}

export function getPinAbsolutePosition(
  node: CircuitNode,
  pinId: string,
  customIcs?: Record<string, CustomICDefinition>
): { x: number; y: number; side: PinDefinition['side'] } {
  const pins = getNodePins(node, customIcs);
  const pin = pins.find((p) => p.id === pinId);
  const { width, height } = getNodeDimensions(node, customIcs);
  if (!pin) return { x: node.x, y: node.y, side: 'right' };

  // Local position relative to top-left of unrotated node
  let lx = 0;
  let ly = 0;
  switch (pin.side) {
    case 'left':
      lx = 0;
      ly = pin.offset * height;
      break;
    case 'right':
      lx = width;
      ly = pin.offset * height;
      break;
    case 'top':
      lx = pin.offset * width;
      ly = 0;
      break;
    case 'bottom':
      lx = pin.offset * width;
      ly = height;
      break;
  }

  // Rotate around center of node
  const cx = width / 2;
  const cy = height / 2;
  const dx = lx - cx;
  const dy = ly - cy;
  const rot = node.rotation || 0;
  let rx = dx;
  let ry = dy;
  let side = pin.side;

  const sides: PinDefinition['side'][] = ['right', 'bottom', 'left', 'top'];
  const sideIdx = sides.indexOf(pin.side);

  if (rot === 90) {
    rx = -dy;
    ry = dx;
    side = sides[(sideIdx + 1) % 4];
  } else if (rot === 180) {
    rx = -dx;
    ry = -dy;
    side = sides[(sideIdx + 2) % 4];
  } else if (rot === 270) {
    rx = dy;
    ry = -dx;
    side = sides[(sideIdx + 3) % 4];
  }

  return {
    x: node.x + cx + rx,
    y: node.y + cy + ry,
    side,
  };
}
