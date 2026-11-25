import type { CircuitDocument, CircuitNode, SequentialNodeState } from '../types/circuit';
import { simulateCircuit } from '../engine/simulation/simulator';
import { busToNumber } from '../engine/signals/signalModel';

export type ChallengeDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface ChallengeTestVector {
  inputs: Record<string, number>; // Map input node label -> value
  expected: Record<string, number>; // Map output node label -> expected numeric value
  clockPulse?: boolean; // If true, toggle clock LOW -> HIGH -> LOW before checking
}

export interface ChallengeSpec {
  id: string;
  title: string;
  difficulty: ChallengeDifficulty;
  summary: string;
  requirements: string[];
  hints: string[];
  starterCircuit: CircuitDocument;
  vectors: ChallengeTestVector[];
}

export interface ChallengeVectorResult {
  index: number;
  inputs: Record<string, number>;
  expected: Record<string, number>;
  actual: Record<string, number | null>;
  passed: boolean;
}

export interface ChallengeEvaluation {
  passed: boolean;
  passedCount: number;
  totalCount: number;
  missingTerminals: string[];
  results: ChallengeVectorResult[];
}

const t0 = 1730000000000;

export const CHALLENGES: ChallengeSpec[] = [
  // ============== BEGINNER ==============
  {
    id: 'ch-and',
    title: 'Build an AND Gate Circuit',
    difficulty: 'Beginner',
    summary: 'Wire inputs A and B so output Y turns HIGH only when both A and B are 1.',
    requirements: [
      'Keep input switches labeled A and B and output indicator labeled Y.',
      'Connect A and B through an AND gate (or equivalent NAND + NOT) to Y.',
    ],
    hints: [
      'Drag an AND gate from the Logic Gates section onto the canvas.',
      'Wire A → AND.A, B → AND.B, and AND.Y → Y.',
    ],
    starterCircuit: {
      id: 'ch-and',
      name: 'Challenge: AND Gate',
      description: 'Wire A and B to produce A AND B on Y.',
      createdAt: t0,
      updatedAt: t0,
      version: 1,
      nodes: [
        { id: 'a', type: 'TOGGLE_SWITCH', label: 'A', x: 80, y: 100, rotation: 0, value: 0 },
        { id: 'b', type: 'TOGGLE_SWITCH', label: 'B', x: 80, y: 190, rotation: 0, value: 0 },
        { id: 'y', type: 'OUTPUT_PIN', label: 'Y', x: 440, y: 145, rotation: 0 },
      ],
      wires: [],
    },
    vectors: [
      { inputs: { A: 0, B: 0 }, expected: { Y: 0 } },
      { inputs: { A: 0, B: 1 }, expected: { Y: 0 } },
      { inputs: { A: 1, B: 0 }, expected: { Y: 0 } },
      { inputs: { A: 1, B: 1 }, expected: { Y: 1 } },
    ],
  },
  {
    id: 'ch-or',
    title: 'Build an OR Gate Circuit',
    difficulty: 'Beginner',
    summary: 'Construct a circuit where output Y is HIGH when either A, B, or both are HIGH.',
    requirements: [
      'Preserve input labels A, B and output label Y.',
      'Verify all 4 truth-table combinations.',
    ],
    hints: ['Place an OR gate between switches A, B and output Y.'],
    starterCircuit: {
      id: 'ch-or',
      name: 'Challenge: OR Gate',
      description: 'Wire A and B to produce A OR B on Y.',
      createdAt: t0,
      updatedAt: t0,
      version: 1,
      nodes: [
        { id: 'a', type: 'TOGGLE_SWITCH', label: 'A', x: 80, y: 100, rotation: 0, value: 0 },
        { id: 'b', type: 'TOGGLE_SWITCH', label: 'B', x: 80, y: 190, rotation: 0, value: 0 },
        { id: 'y', type: 'OUTPUT_PIN', label: 'Y', x: 440, y: 145, rotation: 0 },
      ],
      wires: [],
    },
    vectors: [
      { inputs: { A: 0, B: 0 }, expected: { Y: 0 } },
      { inputs: { A: 0, B: 1 }, expected: { Y: 1 } },
      { inputs: { A: 1, B: 0 }, expected: { Y: 1 } },
      { inputs: { A: 1, B: 1 }, expected: { Y: 1 } },
    ],
  },
  {
    id: 'ch-not',
    title: 'Build a NOT Inverter',
    difficulty: 'Beginner',
    summary: 'Invert signal A so output Y is always the logical complement of A.',
    requirements: ['Output Y must be 1 when A=0, and 0 when A=1.'],
    hints: ['Place a NOT gate (or wire both inputs of a NAND gate to A).'],
    starterCircuit: {
      id: 'ch-not',
      name: 'Challenge: NOT Inverter',
      description: 'Invert input A onto output Y.',
      createdAt: t0,
      updatedAt: t0,
      version: 1,
      nodes: [
        { id: 'a', type: 'TOGGLE_SWITCH', label: 'A', x: 80, y: 140, rotation: 0, value: 0 },
        { id: 'y', type: 'OUTPUT_PIN', label: 'Y', x: 420, y: 140, rotation: 0 },
      ],
      wires: [],
    },
    vectors: [
      { inputs: { A: 0 }, expected: { Y: 1 } },
      { inputs: { A: 1 }, expected: { Y: 0 } },
    ],
  },
  {
    id: 'ch-xor',
    title: 'Build an XOR Circuit',
    difficulty: 'Beginner',
    summary: 'Produce output Y=1 only when A and B have opposite logic levels.',
    requirements: [
      'Use an XOR gate or build XOR from AND, OR, and NOT gates.',
      'Pass all 4 input states.',
    ],
    hints: ['XOR outputs 1 for (0,1) and (1,0), and 0 for (0,0) and (1,1).'],
    starterCircuit: {
      id: 'ch-xor',
      name: 'Challenge: XOR Circuit',
      description: 'Compute A XOR B.',
      createdAt: t0,
      updatedAt: t0,
      version: 1,
      nodes: [
        { id: 'a', type: 'TOGGLE_SWITCH', label: 'A', x: 80, y: 100, rotation: 0, value: 0 },
        { id: 'b', type: 'TOGGLE_SWITCH', label: 'B', x: 80, y: 190, rotation: 0, value: 0 },
        { id: 'y', type: 'OUTPUT_PIN', label: 'Y', x: 440, y: 145, rotation: 0 },
      ],
      wires: [],
    },
    vectors: [
      { inputs: { A: 0, B: 0 }, expected: { Y: 0 } },
      { inputs: { A: 0, B: 1 }, expected: { Y: 1 } },
      { inputs: { A: 1, B: 0 }, expected: { Y: 1 } },
      { inputs: { A: 1, B: 1 }, expected: { Y: 0 } },
    ],
  },

  // ============== INTERMEDIATE ==============
  {
    id: 'ch-half-adder',
    title: 'Build a Half Adder',
    difficulty: 'Intermediate',
    summary: 'Add two 1-bit inputs A and B to produce SUM (A ⊕ B) and CARRY (A · B).',
    requirements: [
      'Connect A and B to drive both SUM and CARRY outputs.',
      'All 4 binary addition states must match.',
    ],
    hints: [
      'SUM = A XOR B, CARRY = A AND B.',
      'You can branch wires from A and B to both gates, or use the Half Adder IC.',
    ],
    starterCircuit: {
      id: 'ch-half-adder',
      name: 'Challenge: Half Adder',
      description: 'Add A + B into SUM and CARRY.',
      createdAt: t0,
      updatedAt: t0,
      version: 1,
      nodes: [
        { id: 'a', type: 'TOGGLE_SWITCH', label: 'A', x: 80, y: 100, rotation: 0, value: 0 },
        { id: 'b', type: 'TOGGLE_SWITCH', label: 'B', x: 80, y: 200, rotation: 0, value: 0 },
        { id: 's', type: 'OUTPUT_PIN', label: 'SUM', x: 480, y: 100, rotation: 0 },
        { id: 'c', type: 'OUTPUT_PIN', label: 'CARRY', x: 480, y: 200, rotation: 0 },
      ],
      wires: [],
    },
    vectors: [
      { inputs: { A: 0, B: 0 }, expected: { SUM: 0, CARRY: 0 } },
      { inputs: { A: 0, B: 1 }, expected: { SUM: 1, CARRY: 0 } },
      { inputs: { A: 1, B: 0 }, expected: { SUM: 1, CARRY: 0 } },
      { inputs: { A: 1, B: 1 }, expected: { SUM: 0, CARRY: 1 } },
    ],
  },
  {
    id: 'ch-full-adder',
    title: 'Build a Full Adder',
    difficulty: 'Intermediate',
    summary: 'Add three 1-bit inputs A, B, and CIN to output SUM and COUT.',
    requirements: [
      'Handle all 8 combinations of (A, B, CIN).',
      'SUM = A ⊕ B ⊕ CIN, COUT = (A·B) + (CIN·(A⊕B)).',
    ],
    hints: ['Chain two XOR gates for SUM, or place a Full Adder block from Arithmetic.'],
    starterCircuit: {
      id: 'ch-full-adder',
      name: 'Challenge: Full Adder',
      description: 'Add A + B + CIN.',
      createdAt: t0,
      updatedAt: t0,
      version: 1,
      nodes: [
        { id: 'a', type: 'TOGGLE_SWITCH', label: 'A', x: 70, y: 80, rotation: 0, value: 0 },
        { id: 'b', type: 'TOGGLE_SWITCH', label: 'B', x: 70, y: 160, rotation: 0, value: 0 },
        { id: 'cin', type: 'TOGGLE_SWITCH', label: 'CIN', x: 70, y: 240, rotation: 0, value: 0 },
        { id: 's', type: 'OUTPUT_PIN', label: 'SUM', x: 520, y: 110, rotation: 0 },
        { id: 'cout', type: 'OUTPUT_PIN', label: 'COUT', x: 520, y: 210, rotation: 0 },
      ],
      wires: [],
    },
    vectors: [
      { inputs: { A: 0, B: 0, CIN: 0 }, expected: { SUM: 0, COUT: 0 } },
      { inputs: { A: 0, B: 0, CIN: 1 }, expected: { SUM: 1, COUT: 0 } },
      { inputs: { A: 0, B: 1, CIN: 0 }, expected: { SUM: 1, COUT: 0 } },
      { inputs: { A: 0, B: 1, CIN: 1 }, expected: { SUM: 0, COUT: 1 } },
      { inputs: { A: 1, B: 0, CIN: 0 }, expected: { SUM: 1, COUT: 0 } },
      { inputs: { A: 1, B: 0, CIN: 1 }, expected: { SUM: 0, COUT: 1 } },
      { inputs: { A: 1, B: 1, CIN: 0 }, expected: { SUM: 0, COUT: 1 } },
      { inputs: { A: 1, B: 1, CIN: 1 }, expected: { SUM: 1, COUT: 1 } },
    ],
  },
  {
    id: 'ch-mux',
    title: 'Build a 2:1 Multiplexer',
    difficulty: 'Intermediate',
    summary: 'Route D0 to Y when SEL=0, and route D1 to Y when SEL=1.',
    requirements: ['Y = (¬SEL · D0) + (SEL · D1) across all 8 input states.'],
    hints: ['Use a 2:1 Multiplexer component or construct it with NOT, 2×AND, and OR gates.'],
    starterCircuit: {
      id: 'ch-mux',
      name: 'Challenge: 2:1 Multiplexer',
      description: 'Select between D0 and D1 via SEL.',
      createdAt: t0,
      updatedAt: t0,
      version: 1,
      nodes: [
        { id: 'd0', type: 'TOGGLE_SWITCH', label: 'D0', x: 70, y: 80, rotation: 0, value: 0 },
        { id: 'd1', type: 'TOGGLE_SWITCH', label: 'D1', x: 70, y: 160, rotation: 0, value: 0 },
        { id: 'sel', type: 'TOGGLE_SWITCH', label: 'SEL', x: 70, y: 240, rotation: 0, value: 0 },
        { id: 'y', type: 'OUTPUT_PIN', label: 'Y', x: 500, y: 160, rotation: 0 },
      ],
      wires: [],
    },
    vectors: [
      { inputs: { D0: 0, D1: 0, SEL: 0 }, expected: { Y: 0 } },
      { inputs: { D0: 1, D1: 0, SEL: 0 }, expected: { Y: 1 } },
      { inputs: { D0: 0, D1: 1, SEL: 0 }, expected: { Y: 0 } },
      { inputs: { D0: 1, D1: 1, SEL: 0 }, expected: { Y: 1 } },
      { inputs: { D0: 0, D1: 0, SEL: 1 }, expected: { Y: 0 } },
      { inputs: { D0: 1, D1: 0, SEL: 1 }, expected: { Y: 0 } },
      { inputs: { D0: 0, D1: 1, SEL: 1 }, expected: { Y: 1 } },
      { inputs: { D0: 1, D1: 1, SEL: 1 }, expected: { Y: 1 } },
    ],
  },
  {
    id: 'ch-4bit-adder',
    title: 'Construct a 4-Bit Adder',
    difficulty: 'Intermediate',
    summary: 'Add 4-bit unsigned buses A and B with carry-out detection.',
    requirements: [
      'Wire 4-bit inputs A and B to a 4-Bit Adder.',
      'Connect sum bus to SUM display and carry-out to COUT.',
    ],
    hints: ['Drag a 4-Bit Adder from Arithmetic and wire A, B, SUM, and COUT.'],
    starterCircuit: {
      id: 'ch-4bit-adder',
      name: 'Challenge: 4-Bit Adder',
      description: '4-bit parallel binary adder.',
      createdAt: t0,
      updatedAt: t0,
      version: 1,
      nodes: [
        { id: 'a', type: 'BINARY_INPUT', label: 'A', x: 60, y: 90, rotation: 0, value: 0 },
        { id: 'b', type: 'BINARY_INPUT', label: 'B', x: 60, y: 200, rotation: 0, value: 0 },
        { id: 'sum', type: 'BINARY_DISPLAY', label: 'SUM', x: 480, y: 100, rotation: 0 },
        { id: 'cout', type: 'OUTPUT_PIN', label: 'COUT', x: 480, y: 210, rotation: 0 },
      ],
      wires: [],
    },
    vectors: [
      { inputs: { A: 3, B: 4 }, expected: { SUM: 7, COUT: 0 } },
      { inputs: { A: 9, B: 6 }, expected: { SUM: 15, COUT: 0 } },
      { inputs: { A: 10, B: 8 }, expected: { SUM: 2, COUT: 1 } },
      { inputs: { A: 15, B: 15 }, expected: { SUM: 14, COUT: 1 } },
    ],
  },
  {
    id: 'ch-comparator',
    title: 'Create a 4-Bit Comparator',
    difficulty: 'Intermediate',
    summary: 'Compare 4-bit numbers A and B, driving GT (A>B), EQ (A=B), and LT (A<B).',
    requirements: ['Wire A and B through a 4-Bit Comparator to GT, EQ, and LT outputs.'],
    hints: ['Place a 4-Bit Comparator from Arithmetic and connect all 5 pins.'],
    starterCircuit: {
      id: 'ch-comparator',
      name: 'Challenge: 4-Bit Comparator',
      description: 'Compare two 4-bit buses.',
      createdAt: t0,
      updatedAt: t0,
      version: 1,
      nodes: [
        { id: 'a', type: 'BINARY_INPUT', label: 'A', x: 60, y: 100, rotation: 0, value: 0 },
        { id: 'b', type: 'BINARY_INPUT', label: 'B', x: 60, y: 200, rotation: 0, value: 0 },
        { id: 'gt', type: 'OUTPUT_PIN', label: 'GT', x: 480, y: 80, rotation: 0 },
        { id: 'eq', type: 'OUTPUT_PIN', label: 'EQ', x: 480, y: 155, rotation: 0 },
        { id: 'lt', type: 'OUTPUT_PIN', label: 'LT', x: 480, y: 230, rotation: 0 },
      ],
      wires: [],
    },
    vectors: [
      { inputs: { A: 5, B: 5 }, expected: { GT: 0, EQ: 1, LT: 0 } },
      { inputs: { A: 9, B: 3 }, expected: { GT: 1, EQ: 0, LT: 0 } },
      { inputs: { A: 2, B: 14 }, expected: { GT: 0, EQ: 0, LT: 1 } },
    ],
  },

  // ============== ADVANCED ==============
  {
    id: 'ch-alu',
    title: 'Construct a 4-Bit ALU',
    difficulty: 'Advanced',
    summary: 'Wire a 4-Bit ALU so operands A, B and opcode OP compute ADD (0), SUB (1), AND (2), and XOR (4) with Zero flag Z.',
    requirements: [
      'Connect A, B, and OP to a 4-Bit ALU.',
      'Connect Y output to RESULT and zero flag to Z.',
    ],
    hints: ['Drag a 4-Bit ALU from Advanced ICs and match A, B, OP, Y, and Z pins.'],
    starterCircuit: {
      id: 'ch-alu',
      name: 'Challenge: 4-Bit ALU',
      description: 'Multi-operation 4-bit ALU verification.',
      createdAt: t0,
      updatedAt: t0,
      version: 1,
      nodes: [
        { id: 'a', type: 'BINARY_INPUT', label: 'A', x: 50, y: 70, rotation: 0, value: 0 },
        { id: 'b', type: 'BINARY_INPUT', label: 'B', x: 50, y: 155, rotation: 0, value: 0 },
        { id: 'op', type: 'BINARY_INPUT', label: 'OP', x: 50, y: 240, rotation: 0, value: 0 },
        { id: 'res', type: 'BINARY_DISPLAY', label: 'RESULT', x: 490, y: 110, rotation: 0 },
        { id: 'z', type: 'OUTPUT_PIN', label: 'Z', x: 490, y: 215, rotation: 0 },
      ],
      wires: [],
    },
    vectors: [
      { inputs: { A: 5, B: 3, OP: 0 }, expected: { RESULT: 8, Z: 0 } },
      { inputs: { A: 6, B: 6, OP: 1 }, expected: { RESULT: 0, Z: 1 } },
      { inputs: { A: 12, B: 10, OP: 2 }, expected: { RESULT: 8, Z: 0 } },
      { inputs: { A: 5, B: 3, OP: 4 }, expected: { RESULT: 6, Z: 0 } },
    ],
  },
  {
    id: 'ch-register',
    title: 'Build a Loadable 4-Bit Register',
    difficulty: 'Advanced',
    summary: 'Capture 4-bit input D on a rising clock edge when LD=1, and hold value when LD=0.',
    requirements: [
      'Wire D, LD, and CLK to a 4-Bit Register.',
      'Connect Q output to OUT display.',
    ],
    hints: ['Use a 4-Bit Register from Sequential components.'],
    starterCircuit: {
      id: 'ch-register',
      name: 'Challenge: 4-Bit Register',
      description: 'Synchronous 4-bit register test.',
      createdAt: t0,
      updatedAt: t0,
      version: 1,
      nodes: [
        { id: 'd', type: 'BINARY_INPUT', label: 'D', x: 60, y: 80, rotation: 0, value: 0 },
        { id: 'ld', type: 'TOGGLE_SWITCH', label: 'LD', x: 80, y: 170, rotation: 0, value: 1 },
        { id: 'clk', type: 'CLOCK', label: 'CLK', x: 75, y: 245, rotation: 0 },
        { id: 'out', type: 'BINARY_DISPLAY', label: 'OUT', x: 480, y: 145, rotation: 0 },
      ],
      wires: [],
    },
    vectors: [
      { inputs: { D: 9, LD: 1 }, clockPulse: true, expected: { OUT: 9 } },
      { inputs: { D: 3, LD: 0 }, clockPulse: true, expected: { OUT: 9 } },
      { inputs: { D: 14, LD: 1 }, clockPulse: true, expected: { OUT: 14 } },
    ],
  },
  {
    id: 'ch-counter',
    title: 'Build a Synchronous 4-Bit Counter',
    difficulty: 'Advanced',
    summary: 'Increment output COUNT on every rising clock edge while EN=1, and reset to 0 when RST=1.',
    requirements: ['Wire EN, CLK, and RST to a 4-Bit Counter driving COUNT.'],
    hints: ['Drag a 4-Bit Counter from Sequential and wire EN, CLK, RST, and Q → COUNT.'],
    starterCircuit: {
      id: 'ch-counter',
      name: 'Challenge: 4-Bit Counter',
      description: 'Synchronous up-counter verification.',
      createdAt: t0,
      updatedAt: t0,
      version: 1,
      nodes: [
        { id: 'en', type: 'TOGGLE_SWITCH', label: 'EN', x: 70, y: 80, rotation: 0, value: 1 },
        { id: 'clk', type: 'CLOCK', label: 'CLK', x: 66, y: 160, rotation: 0 },
        { id: 'rst', type: 'TOGGLE_SWITCH', label: 'RST', x: 70, y: 240, rotation: 0, value: 0 },
        { id: 'cnt', type: 'BINARY_DISPLAY', label: 'COUNT', x: 480, y: 150, rotation: 0 },
      ],
      wires: [],
    },
    vectors: [
      { inputs: { EN: 1, RST: 0 }, clockPulse: true, expected: { COUNT: 1 } },
      { inputs: { EN: 1, RST: 0 }, clockPulse: true, expected: { COUNT: 2 } },
      { inputs: { EN: 0, RST: 0 }, clockPulse: true, expected: { COUNT: 2 } },
      { inputs: { EN: 1, RST: 1 }, clockPulse: true, expected: { COUNT: 0 } },
    ],
  },
  {
    id: 'ch-control-decoder',
    title: 'Build an Instruction Control Decoder',
    difficulty: 'Advanced',
    summary: 'Decode 2-bit opcode (OP1, OP0) into four one-hot control lines (NOP, ADD, LOAD, STORE) gated by EN.',
    requirements: [
      'Wire OP0, OP1, and EN to produce active-HIGH lines on Y0, Y1, Y2, Y3.',
    ],
    hints: ['Use a 2-to-4 Decoder from Advanced ICs with A0=OP0, A1=OP1, EN=EN.'],
    starterCircuit: {
      id: 'ch-control-decoder',
      name: 'Challenge: Control Decoder',
      description: '2-to-4 instruction opcode decoder.',
      createdAt: t0,
      updatedAt: t0,
      version: 1,
      nodes: [
        { id: 'op0', type: 'TOGGLE_SWITCH', label: 'OP0', x: 70, y: 85, rotation: 0, value: 0 },
        { id: 'op1', type: 'TOGGLE_SWITCH', label: 'OP1', x: 70, y: 160, rotation: 0, value: 0 },
        { id: 'en', type: 'TOGGLE_SWITCH', label: 'EN', x: 70, y: 235, rotation: 0, value: 1 },
        { id: 'y0', type: 'OUTPUT_PIN', label: 'Y0', x: 480, y: 60, rotation: 0 },
        { id: 'y1', type: 'OUTPUT_PIN', label: 'Y1', x: 480, y: 125, rotation: 0 },
        { id: 'y2', type: 'OUTPUT_PIN', label: 'Y2', x: 480, y: 190, rotation: 0 },
        { id: 'y3', type: 'OUTPUT_PIN', label: 'Y3', x: 480, y: 255, rotation: 0 },
      ],
      wires: [],
    },
    vectors: [
      { inputs: { OP0: 0, OP1: 0, EN: 1 }, expected: { Y0: 1, Y1: 0, Y2: 0, Y3: 0 } },
      { inputs: { OP0: 1, OP1: 0, EN: 1 }, expected: { Y0: 0, Y1: 1, Y2: 0, Y3: 0 } },
      { inputs: { OP0: 0, OP1: 1, EN: 1 }, expected: { Y0: 0, Y1: 0, Y2: 1, Y3: 0 } },
      { inputs: { OP0: 1, OP1: 1, EN: 1 }, expected: { Y0: 0, Y1: 0, Y2: 0, Y3: 1 } },
      { inputs: { OP0: 1, OP1: 1, EN: 0 }, expected: { Y0: 0, Y1: 0, Y2: 0, Y3: 0 } },
    ],
  },
];

export function evaluateChallengeCircuit(
  challenge: ChallengeSpec,
  circuit: CircuitDocument
): ChallengeEvaluation {
  const missingTerminals: string[] = [];
  const sampleVector = challenge.vectors[0];

  const findByLabel = (label: string, nodes: CircuitNode[]) =>
    nodes.find((n) => n.label.trim().toUpperCase() === label.toUpperCase());

  for (const inLabel of Object.keys(sampleVector.inputs)) {
    if (!findByLabel(inLabel, circuit.nodes)) missingTerminals.push(`Input "${inLabel}"`);
  }
  for (const outLabel of Object.keys(sampleVector.expected)) {
    if (!findByLabel(outLabel, circuit.nodes)) missingTerminals.push(`Output "${outLabel}"`);
  }

  if (missingTerminals.length > 0) {
    return {
      passed: false,
      passedCount: 0,
      totalCount: challenge.vectors.length,
      missingTerminals,
      results: [],
    };
  }

  let seqStates: Record<string, SequentialNodeState> = {};
  const results: ChallengeVectorResult[] = [];

  for (let i = 0; i < challenge.vectors.length; i++) {
    const vec = challenge.vectors[i];
    const testNodes: CircuitNode[] = circuit.nodes.map((n) => {
      const upper = n.label.trim().toUpperCase();
      if (vec.inputs[upper] !== undefined) {
        return { ...n, value: vec.inputs[upper] };
      }
      return n;
    });

    let simResult = simulateCircuit(testNodes, circuit.wires, {
      clockHigh: false,
      previousStates: seqStates,
    });
    seqStates = simResult.nodeStates;

    if (vec.clockPulse) {
      // Rising edge
      simResult = simulateCircuit(testNodes, circuit.wires, {
        clockHigh: true,
        previousStates: seqStates,
      });
      seqStates = simResult.nodeStates;
      // Falling edge
      simResult = simulateCircuit(testNodes, circuit.wires, {
        clockHigh: false,
        previousStates: seqStates,
      });
      seqStates = simResult.nodeStates;
    }

    const actual: Record<string, number | null> = {};
    let rowPass = true;

    for (const [outLabel, expectedVal] of Object.entries(vec.expected)) {
      const outNode = findByLabel(outLabel, testNodes);
      if (!outNode) {
        actual[outLabel] = null;
        rowPass = false;
        continue;
      }
      const bus = simResult.pinValues[`${outNode.id}:in`];
      const numeric = bus ? busToNumber(bus) : null;
      actual[outLabel] = numeric;
      if (numeric !== expectedVal) {
        rowPass = false;
      }
    }

    results.push({
      index: i + 1,
      inputs: vec.inputs,
      expected: vec.expected,
      actual,
      passed: rowPass,
    });
  }

  const passedCount = results.filter((r) => r.passed).length;
  return {
    passed: passedCount === results.length && results.length > 0,
    passedCount,
    totalCount: results.length,
    missingTerminals: [],
    results,
  };
}
