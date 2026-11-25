export type MemoryTemplateId = 'ram-16' | 'ram-256' | 'ram-1k' | 'reg-bank' | 'rom-16';

export interface MemoryTemplateSpec {
  id: MemoryTemplateId;
  name: string;
  sizeBytes: number;
  addressBits: number;
  readOnly: boolean;
  description: string;
  initialData: () => number[];
}

export interface MemoryOperationEvent {
  id: number;
  op: 'READ' | 'WRITE' | 'RESET' | 'BLOCKED';
  address: number;
  value: number;
  note: string;
}

export const MEMORY_TEMPLATES: MemoryTemplateSpec[] = [
  {
    id: 'ram-16',
    name: '16-Byte RAM',
    sizeBytes: 16,
    addressBits: 4,
    readOnly: false,
    description: '4-bit addressed static RAM bank (0x00–0x0F). Ideal for inspecting address decoding line-by-line.',
    initialData: () => [0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80],
  },
  {
    id: 'ram-256',
    name: '256-Byte RAM',
    sizeBytes: 256,
    addressBits: 8,
    readOnly: false,
    description: '8-bit addressable main memory page (0x00–0xFF), matching the ChipCraft 8-bit CPU address space.',
    initialData: () => Array.from({ length: 256 }, (_, i) => (i < 16 ? i * 16 + i : 0)),
  },
  {
    id: 'ram-1k',
    name: '1KB Educational Memory',
    sizeBytes: 1024,
    addressBits: 10,
    readOnly: false,
    description: '10-bit addressed 1024-byte memory organized into four 256-byte pages with bank selection.',
    initialData: () => Array.from({ length: 1024 }, (_, i) => (i % 64 === 0 ? 0xaa : 0)),
  },
  {
    id: 'reg-bank',
    name: '8-Register Bank',
    sizeBytes: 8,
    addressBits: 3,
    readOnly: false,
    description: 'Fast 8×8-bit CPU register file (R0–R7) addressed by a 3-to-8 binary decoder.',
    initialData: () => [0x00, 0x01, 0x05, 0x0a, 0x10, 0x2a, 0x7f, 0xff],
  },
  {
    id: 'rom-16',
    name: '16-Byte Lookup ROM',
    sizeBytes: 16,
    addressBits: 4,
    readOnly: true,
    description: 'Read-only 7-segment display lookup table (0–F). Write attempts are blocked by hardware write protection.',
    initialData: () => [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f, 0x77, 0x7c, 0x39, 0x5e, 0x79, 0x71],
  },
];

export function readMemoryCell(
  data: number[],
  address: number,
  chipSelect: boolean,
  outputEnable: boolean
): { value: number | null; event: Omit<MemoryOperationEvent, 'id'> } {
  if (!chipSelect) {
    return {
      value: null,
      event: {
        op: 'BLOCKED',
        address,
        value: 0,
        note: 'CS=0 (Chip deselected — Data Bus is High-Z)',
      },
    };
  }
  if (!outputEnable) {
    return {
      value: null,
      event: {
        op: 'BLOCKED',
        address,
        value: 0,
        note: 'OE=0 (Output drivers disabled — Data Bus is High-Z)',
      },
    };
  }
  if (address < 0 || address >= data.length) {
    return {
      value: null,
      event: {
        op: 'BLOCKED',
        address,
        value: 0,
        note: `Address 0x${address.toString(16).toUpperCase()} out of bounds (max 0x${(data.length - 1).toString(16).toUpperCase()})`,
      },
    };
  }
  const value = data[address] & 0xff;
  return {
    value,
    event: {
      op: 'READ',
      address,
      value,
      note: `Read 0x${value.toString(16).toUpperCase().padStart(2, '0')} (${value}) from [0x${address.toString(16).toUpperCase().padStart(2, '0')}]`,
    },
  };
}

export function writeMemoryCell(
  data: number[],
  address: number,
  value: number,
  chipSelect: boolean,
  writeEnable: boolean,
  readOnly: boolean
): { nextData: number[]; success: boolean; event: Omit<MemoryOperationEvent, 'id'> } {
  const byte = value & 0xff;
  if (readOnly) {
    return {
      nextData: data,
      success: false,
      event: {
        op: 'BLOCKED',
        address,
        value: byte,
        note: 'ROM is read-only; write cycle ignored.',
      },
    };
  }
  if (!chipSelect || !writeEnable) {
    return {
      nextData: data,
      success: false,
      event: {
        op: 'BLOCKED',
        address,
        value: byte,
        note: !chipSelect ? 'CS=0 (Chip deselected)' : 'WE=0 (Write Enable inactive)',
      },
    };
  }
  if (address < 0 || address >= data.length) {
    return {
      nextData: data,
      success: false,
      event: {
        op: 'BLOCKED',
        address,
        value: byte,
        note: `Address out of range (0..${data.length - 1})`,
      },
    };
  }

  const nextData = [...data];
  nextData[address] = byte;
  return {
    nextData,
    success: true,
    event: {
      op: 'WRITE',
      address,
      value: byte,
      note: `Wrote 0x${byte.toString(16).toUpperCase().padStart(2, '0')} (${byte}) to [0x${address.toString(16).toUpperCase().padStart(2, '0')}]`,
    },
  };
}
