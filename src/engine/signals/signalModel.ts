import type { BusValue, SignalState } from '../../types/circuit';

export function makeBit(state: SignalState): BusValue {
  return { width: 1, bits: [state] };
}

export function makeBus(width: number, value: number): BusValue {
  const bits: SignalState[] = [];
  for (let i = 0; i < width; i++) {
    bits.push(((value >> i) & 1) === 1 ? 'HIGH' : 'LOW');
  }
  return { width, bits };
}

export function makeUnknownBus(width: number): BusValue {
  return { width, bits: Array.from({ length: width }, () => 'UNKNOWN' as SignalState) };
}

export function makeHighZBus(width: number): BusValue {
  return { width, bits: Array.from({ length: width }, () => 'HIGH_IMPEDANCE' as SignalState) };
}

export function makeErrorBus(width: number): BusValue {
  return { width, bits: Array.from({ length: width }, () => 'ERROR' as SignalState) };
}

export function busToNumber(bus: BusValue): number | null {
  let result = 0;
  for (let i = 0; i < bus.bits.length; i++) {
    const b = bus.bits[i];
    if (b === 'HIGH') {
      result |= 1 << i;
    } else if (b !== 'LOW') {
      return null;
    }
  }
  return result;
}

export function primarySignal(bus: BusValue | undefined): SignalState {
  if (!bus || bus.bits.length === 0) return 'UNKNOWN';
  if (bus.bits.includes('ERROR')) return 'ERROR';
  if (bus.bits.includes('UNKNOWN')) return 'UNKNOWN';
  if (bus.bits.every((b) => b === 'HIGH_IMPEDANCE')) return 'HIGH_IMPEDANCE';
  if (bus.bits.includes('HIGH')) return 'HIGH';
  return 'LOW';
}

export function busEquals(a: BusValue | undefined, b: BusValue | undefined): boolean {
  if (!a || !b) return false;
  if (a.width !== b.width) return false;
  for (let i = 0; i < a.width; i++) {
    if (a.bits[i] !== b.bits[i]) return false;
  }
  return true;
}

export function resolveBitDrivers(drivers: SignalState[]): { state: SignalState; contention: boolean } {
  const active = drivers.filter((d) => d !== 'HIGH_IMPEDANCE');
  if (active.length === 0) {
    return { state: drivers.length > 0 ? 'HIGH_IMPEDANCE' : 'UNKNOWN', contention: false };
  }
  if (active.includes('ERROR')) {
    return { state: 'ERROR', contention: true };
  }
  const hasHigh = active.includes('HIGH');
  const hasLow = active.includes('LOW');
  if (hasHigh && hasLow) {
    return { state: 'ERROR', contention: true };
  }
  if (active.includes('UNKNOWN')) {
    return { state: 'UNKNOWN', contention: false };
  }
  return { state: hasHigh ? 'HIGH' : 'LOW', contention: false };
}

export function resolveBusDrivers(drivers: BusValue[], width: number): { value: BusValue; contention: boolean } {
  if (drivers.length === 0) {
    return { value: makeUnknownBus(width), contention: false };
  }
  const bits: SignalState[] = [];
  let contention = false;
  for (let i = 0; i < width; i++) {
    const bitDrivers = drivers.map((d) => d.bits[i] ?? 'LOW');
    const resolved = resolveBitDrivers(bitDrivers);
    bits.push(resolved.state);
    if (resolved.contention) contention = true;
  }
  return { value: { width, bits }, contention };
}

// Boolean 5-value logic primitives
export function logicNot(a: SignalState): SignalState {
  if (a === 'HIGH') return 'LOW';
  if (a === 'LOW') return 'HIGH';
  if (a === 'ERROR') return 'ERROR';
  return 'UNKNOWN';
}

export function logicAnd(inputs: SignalState[]): SignalState {
  if (inputs.length === 0) return 'UNKNOWN';
  if (inputs.includes('ERROR')) return 'ERROR';
  if (inputs.includes('LOW')) return 'LOW'; // Controlling value for AND
  if (inputs.every((s) => s === 'HIGH')) return 'HIGH';
  return 'UNKNOWN';
}

export function logicOr(inputs: SignalState[]): SignalState {
  if (inputs.length === 0) return 'UNKNOWN';
  if (inputs.includes('ERROR')) return 'ERROR';
  if (inputs.includes('HIGH')) return 'HIGH'; // Controlling value for OR
  if (inputs.every((s) => s === 'LOW')) return 'LOW';
  return 'UNKNOWN';
}

export function logicXor(inputs: SignalState[]): SignalState {
  if (inputs.length === 0) return 'UNKNOWN';
  if (inputs.includes('ERROR')) return 'ERROR';
  if (inputs.some((s) => s === 'UNKNOWN' || s === 'HIGH_IMPEDANCE')) return 'UNKNOWN';
  const highCount = inputs.filter((s) => s === 'HIGH').length;
  return highCount % 2 === 1 ? 'HIGH' : 'LOW';
}

export function logicNand(inputs: SignalState[]): SignalState {
  return logicNot(logicAnd(inputs));
}

export function logicNor(inputs: SignalState[]): SignalState {
  return logicNot(logicOr(inputs));
}

export function logicXnor(inputs: SignalState[]): SignalState {
  return logicNot(logicXor(inputs));
}

export function signalChar(s: SignalState): string {
  switch (s) {
    case 'HIGH':
      return '1';
    case 'LOW':
      return '0';
    case 'HIGH_IMPEDANCE':
      return 'Z';
    case 'ERROR':
      return 'E';
    default:
      return 'X';
  }
}

export function formatBusBinary(bus: BusValue | undefined): string {
  if (!bus) return 'X';
  return [...bus.bits].reverse().map(signalChar).join('');
}

export function formatBusHex(bus: BusValue | undefined): string {
  if (!bus) return 'X';
  const num = busToNumber(bus);
  if (num === null) return 'X';
  const hexDigits = Math.ceil(bus.width / 4);
  return '0x' + num.toString(16).toUpperCase().padStart(hexDigits, '0');
}

export function signalColor(state: SignalState): string {
  switch (state) {
    case 'HIGH':
      return '#16A34A'; // Success green for energized logic HIGH
    case 'LOW':
      return '#64748B'; // Crisp engineering slate for LOW
    case 'HIGH_IMPEDANCE':
      return '#06B6D4'; // Accent cyan for Hi-Z
    case 'ERROR':
      return '#DC2626'; // Danger red for contention / error
    case 'UNKNOWN':
    default:
      return '#F59E0B'; // Warning amber for floating / unknown
  }
}

export function signalLabel(state: SignalState): string {
  switch (state) {
    case 'HIGH':
      return 'HIGH (1)';
    case 'LOW':
      return 'LOW (0)';
    case 'HIGH_IMPEDANCE':
      return 'Hi-Z (Z)';
    case 'ERROR':
      return 'ERROR (E)';
    case 'UNKNOWN':
    default:
      return 'FLOATING (X)';
  }
}
