import type {
  CircuitNode,
  CircuitWire,
  CustomICDefinition,
  SequentialNodeState,
} from '../types/circuit';
import { simulateCircuit } from '../engine/simulation/simulator';

export interface WorkerSimRequest {
  mode?: 'single' | 'burst';
  requestId: number;
  nodes: CircuitNode[];
  wires: CircuitWire[];
  clockHigh: boolean;
  previousStates: Record<string, SequentialNodeState>;
  customIcs?: Record<string, CustomICDefinition>;
  ticks?: number;
}

self.onmessage = (event: MessageEvent<WorkerSimRequest>) => {
  const {
    mode = 'single',
    requestId,
    nodes,
    wires,
    clockHigh,
    previousStates,
    customIcs,
    ticks = 8,
  } = event.data;

  if (mode === 'burst') {
    const steps = [];
    let clk = clockHigh;
    let states = previousStates;
    const count = Math.max(1, Math.min(64, ticks));
    for (let i = 0; i < count; i++) {
      clk = !clk;
      const result = simulateCircuit(nodes, wires, {
        clockHigh: clk,
        previousStates: states,
        customIcs,
      });
      states = result.nodeStates;
      steps.push({ clockHigh: clk, result });
    }
    self.postMessage({ requestId, steps });
    return;
  }

  const result = simulateCircuit(nodes, wires, { clockHigh, previousStates, customIcs });
  self.postMessage({ requestId, result });
};
