import type { ActiveDatapath, CPUState } from '../../types/cpu';
import { decodeInstructionBytes } from './assembler';

const IDLE_PATH: ActiveDatapath = {
  pcToMem: false,
  memToIr: false,
  irToControl: false,
  regToAlu: false,
  aluToReg: false,
  aluToFlags: false,
  regToMem: false,
  memToReg: false,
  branchTaken: false,
};

export function createInitialCPUState(memoryImage?: number[]): CPUState {
  const mem = memoryImage
    ? [...memoryImage.slice(0, 256)]
    : Array.from({ length: 256 }, () => 0);
  while (mem.length < 256) mem.push(0);

  return {
    registers: [0, 0, 0, 0],
    pc: 0,
    ir: 0,
    irText: 'READY',
    memory: mem,
    flags: { Z: false, C: false, N: false },
    addressBus: 0,
    dataBus: 0,
    outputPort: 0,
    outputHistory: [],
    cycle: 0,
    halted: false,
    stage: 'IDLE',
    activePath: { ...IDLE_PATH },
    error: null,
    trace: [],
  };
}

export function stepCPU(state: CPUState): CPUState {
  if (state.halted) return state;
  if (state.pc < 0 || state.pc >= 255) {
    return {
      ...state,
      halted: true,
      stage: 'HALTED',
      error: `Program Counter out of bounds (0x${state.pc.toString(16).toUpperCase()}).`,
    };
  }

  const pcBefore = state.pc;
  const byte0 = state.memory[pcBefore] ?? 0;
  const byte1 = state.memory[pcBefore + 1] ?? 0;
  const ir = (byte0 << 8) | byte1;
  const decoded = decodeInstructionBytes(byte0, byte1);

  const regs: [number, number, number, number] = [...state.registers];
  const memory = [...state.memory];
  const flags = { ...state.flags };
  let nextPc = (pcBefore + 2) & 0xff;
  let addressBus = pcBefore;
  let dataBus = byte1;
  let outputPort = state.outputPort;
  const outputHistory = [...state.outputHistory];
  let halted = false;
  let stage: CPUState['stage'] = 'EXECUTE';
  let summary = '';

  const activePath: ActiveDatapath = {
    ...IDLE_PATH,
    pcToMem: true,
    memToIr: true,
    irToControl: true,
  };

  const updateFlags = (value: number, carry = false) => {
    const byte = value & 0xff;
    flags.Z = byte === 0;
    flags.C = carry;
    flags.N = (byte & 0x80) !== 0;
    activePath.aluToFlags = true;
  };

  switch (decoded.opcode) {
    case 'NOP': {
      summary = 'No operation';
      break;
    }
    case 'LOADI': {
      regs[decoded.destReg] = decoded.operand & 0xff;
      dataBus = decoded.operand & 0xff;
      activePath.aluToReg = true;
      updateFlags(regs[decoded.destReg], false);
      stage = 'WRITEBACK';
      summary = `R${decoded.destReg} ← ${regs[decoded.destReg]}`;
      break;
    }
    case 'LOAD': {
      const addr = decoded.operand & 0xff;
      const val = memory[addr] ?? 0;
      regs[decoded.destReg] = val;
      addressBus = addr;
      dataBus = val;
      activePath.memToReg = true;
      updateFlags(val, false);
      stage = 'MEMORY';
      summary = `R${decoded.destReg} ← RAM[0x${addr.toString(16).toUpperCase().padStart(2, '0')}] (${val})`;
      break;
    }
    case 'STORE': {
      const addr = decoded.operand & 0xff;
      const val = regs[decoded.destReg];
      memory[addr] = val;
      addressBus = addr;
      dataBus = val;
      activePath.regToMem = true;
      stage = 'MEMORY';
      summary = `RAM[0x${addr.toString(16).toUpperCase().padStart(2, '0')}] ← R${decoded.destReg} (${val})`;
      break;
    }
    case 'ADD': {
      const raw = regs[decoded.destReg] + regs[decoded.srcReg];
      regs[decoded.destReg] = raw & 0xff;
      dataBus = regs[decoded.destReg];
      activePath.regToAlu = true;
      activePath.aluToReg = true;
      updateFlags(raw, raw > 0xff);
      summary = `R${decoded.destReg} ← R${decoded.destReg} + R${decoded.srcReg} = ${regs[decoded.destReg]}`;
      break;
    }
    case 'ADDI': {
      const raw = regs[decoded.destReg] + decoded.operand;
      regs[decoded.destReg] = raw & 0xff;
      dataBus = regs[decoded.destReg];
      activePath.regToAlu = true;
      activePath.aluToReg = true;
      updateFlags(raw, raw > 0xff);
      summary = `R${decoded.destReg} ← R${decoded.destReg} + ${decoded.operand} = ${regs[decoded.destReg]}`;
      break;
    }
    case 'SUB': {
      const borrow = regs[decoded.destReg] < regs[decoded.srcReg];
      const raw = (regs[decoded.destReg] - regs[decoded.srcReg]) & 0xff;
      regs[decoded.destReg] = raw;
      dataBus = raw;
      activePath.regToAlu = true;
      activePath.aluToReg = true;
      updateFlags(raw, borrow);
      summary = `R${decoded.destReg} ← R${decoded.destReg} - R${decoded.srcReg} = ${raw}`;
      break;
    }
    case 'AND': {
      regs[decoded.destReg] = regs[decoded.destReg] & regs[decoded.srcReg];
      dataBus = regs[decoded.destReg];
      activePath.regToAlu = true;
      activePath.aluToReg = true;
      updateFlags(regs[decoded.destReg], false);
      summary = `R${decoded.destReg} ← R${decoded.destReg} & R${decoded.srcReg} = 0x${regs[decoded.destReg].toString(16).toUpperCase().padStart(2, '0')}`;
      break;
    }
    case 'OR': {
      regs[decoded.destReg] = regs[decoded.destReg] | regs[decoded.srcReg];
      dataBus = regs[decoded.destReg];
      activePath.regToAlu = true;
      activePath.aluToReg = true;
      updateFlags(regs[decoded.destReg], false);
      summary = `R${decoded.destReg} ← R${decoded.destReg} | R${decoded.srcReg} = 0x${regs[decoded.destReg].toString(16).toUpperCase().padStart(2, '0')}`;
      break;
    }
    case 'XOR': {
      regs[decoded.destReg] = regs[decoded.destReg] ^ regs[decoded.srcReg];
      dataBus = regs[decoded.destReg];
      activePath.regToAlu = true;
      activePath.aluToReg = true;
      updateFlags(regs[decoded.destReg], false);
      summary = `R${decoded.destReg} ← R${decoded.destReg} ^ R${decoded.srcReg} = 0x${regs[decoded.destReg].toString(16).toUpperCase().padStart(2, '0')}`;
      break;
    }
    case 'NOT': {
      regs[decoded.destReg] = ~regs[decoded.destReg] & 0xff;
      dataBus = regs[decoded.destReg];
      activePath.regToAlu = true;
      activePath.aluToReg = true;
      updateFlags(regs[decoded.destReg], false);
      summary = `R${decoded.destReg} ← ~R${decoded.destReg} = 0x${regs[decoded.destReg].toString(16).toUpperCase().padStart(2, '0')}`;
      break;
    }
    case 'SHL': {
      const carry = (regs[decoded.destReg] & 0x80) !== 0;
      regs[decoded.destReg] = (regs[decoded.destReg] << 1) & 0xff;
      dataBus = regs[decoded.destReg];
      activePath.regToAlu = true;
      activePath.aluToReg = true;
      updateFlags(regs[decoded.destReg], carry);
      summary = `R${decoded.destReg} ← R${decoded.destReg} << 1 = ${regs[decoded.destReg]}`;
      break;
    }
    case 'SHR': {
      const carry = (regs[decoded.destReg] & 0x01) !== 0;
      regs[decoded.destReg] = (regs[decoded.destReg] >> 1) & 0xff;
      dataBus = regs[decoded.destReg];
      activePath.regToAlu = true;
      activePath.aluToReg = true;
      updateFlags(regs[decoded.destReg], carry);
      summary = `R${decoded.destReg} ← R${decoded.destReg} >> 1 = ${regs[decoded.destReg]}`;
      break;
    }
    case 'JUMP': {
      nextPc = decoded.operand & 0xff;
      addressBus = nextPc;
      activePath.branchTaken = true;
      summary = `PC ← 0x${nextPc.toString(16).toUpperCase().padStart(2, '0')}`;
      break;
    }
    case 'JZ': {
      if (flags.Z) {
        nextPc = decoded.operand & 0xff;
        addressBus = nextPc;
        activePath.branchTaken = true;
        summary = `Z=1 → PC ← 0x${nextPc.toString(16).toUpperCase().padStart(2, '0')}`;
      } else {
        summary = 'Z=0 → branch not taken';
      }
      break;
    }
    case 'JNZ': {
      if (!flags.Z) {
        nextPc = decoded.operand & 0xff;
        addressBus = nextPc;
        activePath.branchTaken = true;
        summary = `Z=0 → PC ← 0x${nextPc.toString(16).toUpperCase().padStart(2, '0')}`;
      } else {
        summary = 'Z=1 → branch not taken';
      }
      break;
    }
    case 'OUT': {
      outputPort = regs[decoded.destReg];
      outputHistory.push(outputPort);
      dataBus = outputPort;
      summary = `OUT ← R${decoded.destReg} (${outputPort})`;
      break;
    }
    case 'HALT': {
      halted = true;
      nextPc = pcBefore;
      stage = 'HALTED';
      summary = 'Processor halted cleanly';
      break;
    }
  }

  const cycle = state.cycle + 1;
  const traceEntry = {
    cycle,
    pc: pcBefore,
    instruction: decoded.disassembly,
    summary,
    registers: [...regs] as [number, number, number, number],
    flags: { ...flags },
  };

  return {
    registers: regs,
    pc: nextPc,
    ir,
    irText: decoded.disassembly,
    memory,
    flags,
    addressBus,
    dataBus,
    outputPort,
    outputHistory: outputHistory.slice(-32),
    cycle,
    halted,
    stage,
    activePath,
    error: null,
    trace: [traceEntry, ...state.trace].slice(0, 80),
  };
}
