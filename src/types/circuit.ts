export type SignalState = 'LOW' | 'HIGH' | 'UNKNOWN' | 'HIGH_IMPEDANCE' | 'ERROR';

export interface BusValue {
  width: number;
  bits: SignalState[]; // LSB at index 0
}

export type PinDirection = 'input' | 'output';

export type PinSide = 'left' | 'right' | 'top' | 'bottom';

export interface PinDefinition {
  id: string;
  label: string;
  direction: PinDirection;
  width: number; // 1, 2, 4, or 8 bits
  side: PinSide;
  offset: number; // 0..1 normalized position along side
}

export type ComponentCategory =
  | 'input'
  | 'logic'
  | 'arithmetic'
  | 'sequential'
  | 'output'
  | 'advanced'
  | 'custom';

export type ComponentType =
  // Input
  | 'TOGGLE_SWITCH'
  | 'PUSH_BUTTON'
  | 'BINARY_INPUT'
  | 'CLOCK'
  | 'CONST_0'
  | 'CONST_1'
  // Logic
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'NAND'
  | 'NOR'
  | 'XOR'
  | 'XNOR'
  | 'BUFFER'
  // Arithmetic
  | 'HALF_ADDER'
  | 'FULL_ADDER'
  | 'HALF_SUBTRACTOR'
  | 'FULL_SUBTRACTOR'
  | 'ADDER_4BIT'
  | 'MUX_2TO1'
  | 'DEMUX_1TO2'
  | 'COMPARATOR_4BIT'
  // Sequential
  | 'SR_LATCH'
  | 'D_LATCH'
  | 'D_FF'
  | 'JK_FF'
  | 'T_FF'
  | 'REGISTER_4BIT'
  | 'COUNTER_4BIT'
  // Output
  | 'LED'
  | 'BINARY_DISPLAY'
  | 'SEVEN_SEGMENT'
  | 'OUTPUT_PIN'
  | 'PROBE'
  // Advanced
  | 'ALU_4BIT'
  | 'ROM_16X4'
  | 'RAM_16X4'
  | 'BUS_SPLITTER'
  | 'BUS_MERGER'
  | 'CLOCK_DIVIDER'
  | 'DECODER_2TO4'
  | 'ENCODER_4TO2'
  // Reusable User-Packaged Subcircuit IC
  | 'CUSTOM_IC';

export interface ComponentSpec {
  type: ComponentType;
  name: string;
  shortName: string;
  category: ComponentCategory;
  description: string;
  width: number;
  height: number;
  rotatable: boolean;
  configurableInputs?: boolean;
  pins: PinDefinition[];
  defaultProps?: Record<string, unknown>;
}

export interface CustomICPinTarget {
  nodeId: string;
  pinId: string;
}

export interface CustomICPinMapping {
  pinId: string;
  label: string;
  direction: PinDirection;
  width: number;
  side: PinSide;
  offset: number;
  /** For input pins: one or more internal destination pins driven by this external input */
  internalTargets: CustomICPinTarget[];
  /** For output pins: the single internal source pin driving this external output */
  internalSource?: CustomICPinTarget;
}

export interface CustomICDefinition {
  id: string;
  name: string;
  shortName: string;
  description: string;
  width: number;
  height: number;
  pins: CustomICPinMapping[];
  nodes: CircuitNode[];
  wires: CircuitWire[];
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}

export interface CircuitNode {
  id: string;
  type: ComponentType;
  label: string;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  inputCount?: number; // For multi-input logic gates (2..4)
  value?: number; // For switches, buttons, binary inputs (0..15), clock state
  customIcId?: string; // Reference to CustomICDefinition.id when type === 'CUSTOM_IC'
  props?: Record<string, unknown>; // ROM data, ALU op, probe name, etc.
}

export interface CircuitWire {
  id: string;
  fromNodeId: string;
  fromPinId: string;
  toNodeId: string;
  toPinId: string;
  label?: string;
}

export interface CircuitDocument {
  id: string;
  name: string;
  description: string;
  nodes: CircuitNode[];
  wires: CircuitWire[];
  createdAt: number;
  updatedAt: number;
  version: number;
}

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface SimulationIssue {
  id: string;
  severity: IssueSeverity;
  code:
    | 'INVALID_CONNECTION'
    | 'WIDTH_MISMATCH'
    | 'MULTIPLE_DRIVERS'
    | 'FLOATING_INPUT'
    | 'COMBINATIONAL_LOOP'
    | 'UNSTABLE_CIRCUIT'
    | 'SIMULATION_TIMEOUT'
    | 'CIRCULAR_SUBCIRCUIT'
    | 'MISSING_CUSTOM_IC';
  message: string;
  suggestion: string;
  nodeId?: string;
  wireId?: string;
}

export interface SequentialNodeState {
  q: SignalState;
  qBar?: SignalState;
  regValue?: number;
  prevClk: SignalState;
  dividerCount?: number;
  memory?: number[];
  /** Isolated per-instance internal sequential states for CUSTOM_IC nodes (supports arbitrary nesting) */
  subcircuitStates?: Record<string, SequentialNodeState>;
}

export interface SimulationResult {
  pinValues: Record<string, BusValue>; // key: `${nodeId}:${pinId}`
  wireValues: Record<string, BusValue>; // key: wireId
  nodeStates: Record<string, SequentialNodeState>;
  issues: SimulationIssue[];
  iterations: number;
  stable: boolean;
  timestamp: number;
}

export interface WaveformSample {
  tick: number;
  signals: Record<string, BusValue>; // key: trackId (`${nodeId}:${pinId}`)
}

export interface WaveformTrack {
  id: string; // `${nodeId}:${pinId}`
  nodeId: string;
  pinId: string;
  label: string;
  width: number;
}

export type ProjectKind = 'circuit' | 'logic' | 'cpu' | 'memory' | 'hdl';

export interface ProjectRecord {
  id: string;
  name: string;
  kind: ProjectKind;
  description: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
  circuit?: CircuitDocument;
  hdlCode?: string;
  cpuAssembly?: string;
  memoryData?: number[];
  /** Optional embedded custom IC definitions used by this circuit for portable JSON export/import */
  embeddedCustomIcs?: CustomICDefinition[];
}

export type WorkspaceId =
  | 'home'
  | 'circuit-studio'
  | 'logic-lab'
  | 'cpu-architect'
  | 'memory-lab'
  | 'signal-analyzer'
  | 'hdl-studio'
  | 'chip-explorer'
  | 'challenge-lab'
  | 'project-library'
  | 'documentation'
  | 'settings';

export interface UserSettings {
  snapToGrid: boolean;
  showGrid: boolean;
  gridSize: number;
  wireStyle: 'orthogonal' | 'bezier';
  showPinLabels: boolean;
  defaultClockHz: number;
  reducedMotion: boolean;
}
