import type {
  CircuitDocument,
  CircuitNode,
  CustomICDefinition,
  SignalState,
} from '../../types/circuit';
import { simulateCircuit } from './simulator';
import { primarySignal } from '../signals/signalModel';

export interface CircuitTruthRow {
  inputs: Record<string, 0 | 1>;
  outputs: Record<string, SignalState>;
}

export interface CircuitTruthTableResult {
  inputLabels: string[];
  outputLabels: string[];
  rows: CircuitTruthRow[];
  truncated: boolean;
  reason?: string;
}

const MAX_SWITCH_INPUTS = 5;

export function analyzeCircuitTruthTable(
  doc: CircuitDocument,
  customIcs?: Record<string, CustomICDefinition>
): CircuitTruthTableResult {
  const switches = doc.nodes.filter(
    (n) => n.type === 'TOGGLE_SWITCH' || n.type === 'PUSH_BUTTON'
  );
  const outputs = doc.nodes.filter(
    (n) => n.type === 'LED' || n.type === 'OUTPUT_PIN' || n.type === 'PROBE'
  );

  if (switches.length === 0) {
    return {
      inputLabels: [],
      outputLabels: [],
      rows: [],
      truncated: false,
      reason: 'Add at least one Toggle Switch or Push Button to generate a truth table.',
    };
  }

  if (outputs.length === 0) {
    return {
      inputLabels: switches.map((s) => s.label),
      outputLabels: [],
      rows: [],
      truncated: false,
      reason: 'Add at least one LED, Output Pin, or Digital Probe to observe outputs.',
    };
  }

  const truncated = switches.length > MAX_SWITCH_INPUTS;
  const activeSwitches = switches.slice(0, MAX_SWITCH_INPUTS);

  // Deduplicate display labels cleanly if user named two pins identically
  const labelFor = (node: CircuitNode, list: CircuitNode[]) => {
    const same = list.filter((x) => x.label === node.label);
    return same.length > 1 ? `${node.label}#${same.indexOf(node) + 1}` : node.label;
  };

  const inputLabels = activeSwitches.map((s) => labelFor(s, activeSwitches));
  const outputLabels = outputs.map((o) => labelFor(o, outputs));

  const total = 1 << activeSwitches.length;
  const rows: CircuitTruthRow[] = [];

  for (let mask = 0; mask < total; mask++) {
    const bitMap = new Map<string, number>();
    const inputRecord: Record<string, 0 | 1> = {};

    activeSwitches.forEach((sw, idx) => {
      const bit = ((mask >> (activeSwitches.length - 1 - idx)) & 1) as 0 | 1;
      bitMap.set(sw.id, bit);
      inputRecord[inputLabels[idx]] = bit;
    });

    const testNodes = doc.nodes.map((n) =>
      bitMap.has(n.id) ? { ...n, value: bitMap.get(n.id) } : n
    );
    const sim = simulateCircuit(testNodes, doc.wires, { clockHigh: false, customIcs });

    const outputRecord: Record<string, SignalState> = {};
    outputs.forEach((outNode, idx) => {
      outputRecord[outputLabels[idx]] = primarySignal(sim.pinValues[`${outNode.id}:in`]);
    });

    rows.push({ inputs: inputRecord, outputs: outputRecord });
  }

  return {
    inputLabels,
    outputLabels,
    rows,
    truncated,
  };
}
