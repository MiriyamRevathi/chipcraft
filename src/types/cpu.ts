export type CPUOpcode =
  | 'NOP'
  | 'LOAD'
  | 'LOADI'
  | 'STORE'
  | 'ADD'
  | 'ADDI'
  | 'SUB'
  | 'AND'
  | 'OR'
  | 'XOR'
  | 'NOT'
  | 'SHL'
  | 'SHR'
  | 'JUMP'
  | 'JZ'
  | 'JNZ'
  | 'OUT'
  | 'HALT';

export interface EncodedInstruction {
  address: number;
  opcode: CPUOpcode;
  destReg: number; // 0..3 (R0..R3)
  srcReg: number; // 0..3
  operand: number; // 0..255 immediate or memory address
  sourceLine: number;
  sourceText: string;
  machineHex: string; // 2-byte educational encoding shown in memory
}

export interface AssemblerError {
  line: number;
  message: string;
  suggestion: string;
}

export interface AssemblerResult {
  success: boolean;
  instructions: EncodedInstruction[];
  labels: Record<string, number>;
  memoryImage: number[]; // 256 bytes (2 bytes per instruction + data)
  errors: AssemblerError[];
}

export type DatapathStage = 'IDLE' | 'FETCH' | 'DECODE' | 'EXECUTE' | 'MEMORY' | 'WRITEBACK' | 'HALTED';

export interface ActiveDatapath {
  pcToMem: boolean;
  memToIr: boolean;
  irToControl: boolean;
  regToAlu: boolean;
  aluToReg: boolean;
  aluToFlags: boolean;
  regToMem: boolean;
  memToReg: boolean;
  branchTaken: boolean;
}

export interface ExecutionTraceEntry {
  cycle: number;
  pc: number;
  instruction: string;
  summary: string;
  registers: [number, number, number, number];
  flags: { Z: boolean; C: boolean; N: boolean };
}

export interface CPUState {
  registers: [number, number, number, number]; // R0..R3 (8-bit 0..255)
  pc: number; // Program Counter (byte address, steps by 2)
  ir: number; // 16-bit fetched instruction word
  irText: string;
  memory: number[]; // 256 bytes
  flags: {
    Z: boolean; // Zero
    C: boolean; // Carry
    N: boolean; // Negative (MSB=1)
  };
  addressBus: number;
  dataBus: number;
  outputPort: number;
  outputHistory: number[];
  cycle: number;
  halted: boolean;
  stage: DatapathStage;
  activePath: ActiveDatapath;
  error: string | null;
  trace: ExecutionTraceEntry[];
}
