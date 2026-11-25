import type { AssemblerError, AssemblerResult, CPUOpcode, EncodedInstruction } from '../../types/cpu';

export const OPCODE_MAP: Record<CPUOpcode, number> = {
  NOP: 0x00,
  LOAD: 0x01,
  LOADI: 0x02,
  STORE: 0x03,
  ADD: 0x04,
  ADDI: 0x05,
  SUB: 0x06,
  AND: 0x07,
  OR: 0x08,
  XOR: 0x09,
  NOT: 0x0a,
  SHL: 0x0b,
  SHR: 0x0c,
  JUMP: 0x0d,
  JZ: 0x0e,
  JNZ: 0x0f,
  OUT: 0x10,
  HALT: 0x1f,
};

export const OPCODE_REVERSE: Record<number, CPUOpcode> = Object.fromEntries(
  Object.entries(OPCODE_MAP).map(([k, v]) => [v, k as CPUOpcode])
);

export interface CPUProgramPreset {
  id: string;
  name: string;
  description: string;
  assembly: string;
}

export const CPU_PROGRAM_PRESETS: CPUProgramPreset[] = [
  {
    id: 'sum-1-to-5',
    name: 'Sum 1 to 5 (Loop + Memory)',
    description: 'Accumulates 1 + 2 + 3 + 4 + 5 = 15 into R0, stores result at memory 0x80, and outputs it.',
    assembly: `; Sum numbers 1 through 5 using a countdown loop
; R0 = accumulator, R1 = counter, R2 = decrement step (1)

      LOADI R0, 0      ; acc = 0
      LOADI R1, 5      ; counter = 5
      LOADI R2, 1      ; step = 1

LOOP: ADD   R0, R1     ; acc += counter
      SUB   R1, R2     ; counter -= 1
      JNZ   LOOP       ; repeat while counter != 0

      STORE R0, 0x80   ; store final sum (15) at RAM[0x80]
      OUT   R0         ; display R0 on output port
      HALT`,
  },
  {
    id: 'fibonacci',
    name: 'Fibonacci Sequence (8-bit)',
    description: 'Generates Fibonacci terms (1, 1, 2, 3, 5, 8, 13, 21...) storing the final term in RAM.',
    assembly: `; Compute the 7th Fibonacci number
; R0 = a, R1 = b, R2 = next, R3 = loop counter

      LOADI R0, 1      ; a = 1
      LOADI R1, 1      ; b = 1
      LOADI R3, 6      ; iterations

FIB:  OUT   R0         ; emit current Fibonacci number
      LOADI R2, 0
      ADD   R2, R0     ; next = a
      ADD   R2, R1     ; next = a + b
      LOADI R0, 0
      ADD   R0, R1     ; a = b
      LOADI R1, 0
      ADD   R1, R2     ; b = next
      ADDI  R3, 255    ; R3 = R3 - 1 (mod 256)
      JNZ   FIB

      STORE R0, 0x80   ; save final term at 0x80
      OUT   R0
      HALT`,
  },
  {
    id: 'bitwise-alu',
    name: 'Bitwise & Shift ALU Demo',
    description: 'Exercises AND, OR, XOR, NOT, SHL, and SHR instructions with observable register updates.',
    assembly: `; Demonstrate ALU bitwise logic and shifts
      LOADI R0, 0x3C   ; 0011_1100 (60)
      LOADI R1, 0x0F   ; 0000_1111 (15)
      AND   R0, R1     ; R0 = 0x0C (12)
      STORE R0, 0x80
      OR    R0, R1     ; R0 = 0x0F (15)
      SHL   R0         ; R0 = 0x1E (30)
      XOR   R0, R1     ; R0 = 0x11 (17)
      NOT   R1         ; R1 = 0xF0 (240)
      SHR   R1         ; R1 = 0x78 (120)
      OUT   R0
      STORE R0, 0x81
      HALT`,
  },
  {
    id: 'memory-add',
    name: 'Load, Add & Store Memory',
    description: 'Stores two values into RAM, reads them back into registers, adds them, and writes back.',
    assembly: `; Memory Load/Store verification program
      LOADI R0, 24     ; R0 = 24
      LOADI R1, 18     ; R1 = 18
      STORE R0, 0x90   ; RAM[0x90] = 24
      STORE R1, 0x91   ; RAM[0x91] = 18
      LOAD  R2, 0x90   ; R2 = RAM[0x90]
      LOAD  R3, 0x91   ; R3 = RAM[0x91]
      ADD   R2, R3     ; R2 = 42 (0x2A)
      STORE R2, 0x92   ; RAM[0x92] = 42
      OUT   R2
      HALT`,
  },
];

function parseRegister(token: string | undefined): number | null {
  if (!token) return null;
  const clean = token.trim().toUpperCase();
  if (clean === 'R0') return 0;
  if (clean === 'R1') return 1;
  if (clean === 'R2') return 2;
  if (clean === 'R3') return 3;
  return null;
}

function parseNumberOrLabel(
  token: string | undefined,
  labels: Record<string, number>
): number | null {
  if (!token) return null;
  const clean = token.trim();
  if (labels[clean.toUpperCase()] !== undefined) {
    return labels[clean.toUpperCase()];
  }
  if (/^0x[0-9a-fA-F]+$/.test(clean)) {
    return parseInt(clean.slice(2), 16) & 0xff;
  }
  if (/^0b[01_]+$/.test(clean)) {
    return parseInt(clean.slice(2).replace(/_/g, ''), 2) & 0xff;
  }
  if (/^-?\d+$/.test(clean)) {
    return parseInt(clean, 10) & 0xff;
  }
  return null;
}

export function assembleProgram(source: string): AssemblerResult {
  const lines = source.split('\n');
  const labels: Record<string, number> = {};
  const parsedLines: Array<{ lineNum: number; raw: string; op: string; args: string[] }> = [];
  const errors: AssemblerError[] = [];

  // Pass 1: Collect labels & clean instruction lines
  let currentAddress = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const withoutComment = lines[i].split(';')[0].split('//')[0].trim();
    if (!withoutComment) continue;

    let remainder = withoutComment;
    const colonIdx = remainder.indexOf(':');
    if (colonIdx !== -1) {
      const labelName = remainder.slice(0, colonIdx).trim().toUpperCase();
      if (!/^[A-Z_][A-Z0-9_]*$/.test(labelName)) {
        errors.push({
          line: lineNum,
          message: `Invalid label syntax "${labelName}".`,
          suggestion: 'Labels must start with a letter or underscore (e.g., LOOP:).',
        });
        continue;
      }
      labels[labelName] = currentAddress;
      remainder = remainder.slice(colonIdx + 1).trim();
      if (!remainder) continue;
    }

    const parts = remainder.split(/\s+/);
    const op = parts[0].toUpperCase();
    const argStr = remainder.slice(parts[0].length).trim();
    const args = argStr
      ? argStr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    parsedLines.push({ lineNum, raw: withoutComment, op, args });
    currentAddress += 2; // Fixed 2-byte instruction width
    if (currentAddress > 128) {
      errors.push({
        line: lineNum,
        message: 'Program exceeds 128-byte instruction memory space (0x00–0x7F).',
        suggestion: 'Keep program under 64 instructions so 0x80–0xFF remains free for RAM data.',
      });
      break;
    }
  }

  // Pass 2: Encode instructions into 256-byte memory image
  const memoryImage = Array.from({ length: 256 }, () => 0);
  const instructions: EncodedInstruction[] = [];

  for (let idx = 0; idx < parsedLines.length; idx++) {
    const item = parsedLines[idx];
    const addr = idx * 2;
    const opcode = item.op as CPUOpcode;
    const opNum = OPCODE_MAP[opcode];

    if (opNum === undefined) {
      errors.push({
        line: item.lineNum,
        message: `Unknown instruction "${item.op}".`,
        suggestion: `Supported opcodes: ${Object.keys(OPCODE_MAP).join(', ')}.`,
      });
      continue;
    }

    let destReg = 0;
    let srcReg = 0;
    let operand = 0;

    const requireReg = (argIdx: number, role: string): number | null => {
      const reg = parseRegister(item.args[argIdx]);
      if (reg === null) {
        errors.push({
          line: item.lineNum,
          message: `${opcode} expects a valid ${role} register (R0–R3), got "${item.args[argIdx] ?? 'nothing'}".`,
          suggestion: 'Use one of R0, R1, R2, or R3.',
        });
      }
      return reg;
    };

    const requireImm = (argIdx: number, role: string): number | null => {
      const val = parseNumberOrLabel(item.args[argIdx], labels);
      if (val === null) {
        errors.push({
          line: item.lineNum,
          message: `${opcode} expects a valid ${role} (number, 0xHEX, or label), got "${item.args[argIdx] ?? 'nothing'}".`,
          suggestion: 'Provide an 8-bit integer (0–255), hex (0x80), or defined label.',
        });
      }
      return val;
    };

    switch (opcode) {
      case 'NOP':
      case 'HALT':
        break;
      case 'LOAD':
      case 'LOADI':
      case 'STORE':
      case 'ADDI': {
        const rd = requireReg(0, 'destination');
        const imm = requireImm(1, opcode === 'LOADI' || opcode === 'ADDI' ? 'immediate' : 'address');
        if (rd === null || imm === null) continue;
        destReg = rd;
        operand = imm;
        break;
      }
      case 'ADD':
      case 'SUB':
      case 'AND':
      case 'OR':
      case 'XOR': {
        const rd = requireReg(0, 'destination');
        const rs = requireReg(1, 'source');
        if (rd === null || rs === null) continue;
        destReg = rd;
        srcReg = rs;
        operand = rs;
        break;
      }
      case 'NOT':
      case 'SHL':
      case 'SHR':
      case 'OUT': {
        const rd = requireReg(0, 'target');
        if (rd === null) continue;
        destReg = rd;
        break;
      }
      case 'JUMP':
      case 'JZ':
      case 'JNZ': {
        const target = requireImm(0, 'branch target');
        if (target === null) continue;
        operand = target;
        break;
      }
    }

    // 2-byte encoding:
    // Byte 0: [opcode (5 bits: 7..3)] [destReg (2 bits: 2..1)] [reserved (0)]
    // Byte 1: operand (8 bits) OR srcReg in low 2 bits
    const byte0 = ((opNum & 0x1f) << 3) | ((destReg & 0x03) << 1);
    const byte1 = operand & 0xff;
    memoryImage[addr] = byte0;
    memoryImage[addr + 1] = byte1;

    instructions.push({
      address: addr,
      opcode,
      destReg,
      srcReg,
      operand,
      sourceLine: item.lineNum,
      sourceText: item.raw,
      machineHex: `${byte0.toString(16).toUpperCase().padStart(2, '0')} ${byte1
        .toString(16)
        .toUpperCase()
        .padStart(2, '0')}`,
    });
  }

  return {
    success: errors.length === 0,
    instructions,
    labels,
    memoryImage,
    errors,
  };
}

export function decodeInstructionBytes(byte0: number, byte1: number): {
  opcode: CPUOpcode;
  destReg: number;
  srcReg: number;
  operand: number;
  disassembly: string;
} {
  const opNum = (byte0 >> 3) & 0x1f;
  const destReg = (byte0 >> 1) & 0x03;
  const opcode = OPCODE_REVERSE[opNum] ?? 'NOP';
  const operand = byte1 & 0xff;
  const srcReg = operand & 0x03;
  const hexOp = '0x' + operand.toString(16).toUpperCase().padStart(2, '0');

  let disassembly: string = opcode;
  switch (opcode) {
    case 'NOP':
    case 'HALT':
      disassembly = opcode;
      break;
    case 'LOAD':
    case 'STORE':
      disassembly = `${opcode} R${destReg}, [${hexOp}]`;
      break;
    case 'LOADI':
    case 'ADDI':
      disassembly = `${opcode} R${destReg}, ${operand}`;
      break;
    case 'ADD':
    case 'SUB':
    case 'AND':
    case 'OR':
    case 'XOR':
      disassembly = `${opcode} R${destReg}, R${srcReg}`;
      break;
    case 'NOT':
    case 'SHL':
    case 'SHR':
    case 'OUT':
      disassembly = `${opcode} R${destReg}`;
      break;
    case 'JUMP':
    case 'JZ':
    case 'JNZ':
      disassembly = `${opcode} ${hexOp}`;
      break;
  }

  return { opcode, destReg, srcReg, operand, disassembly };
}
