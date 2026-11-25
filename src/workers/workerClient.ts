import type {
  CircuitNode,
  CircuitWire,
  CustomICDefinition,
  SequentialNodeState,
  SimulationResult,
} from '../types/circuit';
import { simulateCircuit } from '../engine/simulation/simulator';

export interface BatchBurstStep {
  clockHigh: boolean;
  result: SimulationResult;
}

interface WorkerBatchResponse {
  requestId: number;
  steps?: BatchBurstStep[];
  result?: SimulationResult;
}

let workerInstance: Worker | null = null;
let requestCounter = 1;
const pending = new Map<number, (data: WorkerBatchResponse) => void>();

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (!workerInstance) {
    try {
      workerInstance = new Worker(new URL('./simulation.worker.ts', import.meta.url), {
        type: 'module',
      });
      workerInstance.onmessage = (e: MessageEvent<WorkerBatchResponse>) => {
        const resolver = pending.get(e.data.requestId);
        if (resolver) {
          pending.delete(e.data.requestId);
          resolver(e.data);
        }
      };
      workerInstance.onerror = () => {
        workerInstance = null;
      };
    } catch {
      return null;
    }
  }
  return workerInstance;
}

export async function runClockBurstOffThread(
  nodes: CircuitNode[],
  wires: CircuitWire[],
  startClockHigh: boolean,
  previousStates: Record<string, SequentialNodeState>,
  ticks: number,
  customIcs?: Record<string, CustomICDefinition>
): Promise<BatchBurstStep[]> {
  const worker = getWorker();
  if (!worker) {
    return runClockBurstSync(nodes, wires, startClockHigh, previousStates, ticks, customIcs);
  }

  const requestId = requestCounter++;
  return new Promise<BatchBurstStep[]>((resolve) => {
    const timeout = setTimeout(() => {
      if (pending.has(requestId)) {
        pending.delete(requestId);
        resolve(runClockBurstSync(nodes, wires, startClockHigh, previousStates, ticks, customIcs));
      }
    }, 2500);

    pending.set(requestId, (data) => {
      clearTimeout(timeout);
      if (data.steps) {
        resolve(data.steps);
      } else {
        resolve(runClockBurstSync(nodes, wires, startClockHigh, previousStates, ticks, customIcs));
      }
    });

    worker.postMessage({
      mode: 'burst',
      requestId,
      nodes,
      wires,
      clockHigh: startClockHigh,
      previousStates,
      customIcs,
      ticks,
    });
  });
}

export function runClockBurstSync(
  nodes: CircuitNode[],
  wires: CircuitWire[],
  startClockHigh: boolean,
  previousStates: Record<string, SequentialNodeState>,
  ticks: number,
  customIcs?: Record<string, CustomICDefinition>
): BatchBurstStep[] {
  const steps: BatchBurstStep[] = [];
  let clk = startClockHigh;
  let states = previousStates;
  for (let i = 0; i < ticks; i++) {
    clk = !clk;
    const result = simulateCircuit(nodes, wires, {
      clockHigh: clk,
      previousStates: states,
      customIcs,
    });
    states = result.nodeStates;
    steps.push({ clockHigh: clk, result });
  }
  return steps;
}
