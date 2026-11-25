import type {
  BusValue,
  CircuitNode,
  CircuitWire,
  CustomICDefinition,
  SequentialNodeState,
  SignalState,
  SimulationIssue,
  SimulationResult,
} from '../../types/circuit';
import { getActiveCustomICRegistry, getNodePins } from '../gates/componentCatalog';
import { MAX_CUSTOM_IC_DEPTH } from '../subcircuit/customIcEngine';
import {
  busEquals,
  busToNumber,
  logicAnd,
  logicNand,
  logicNor,
  logicNot,
  logicOr,
  logicXnor,
  logicXor,
  makeBit,
  makeBus,
  makeErrorBus,
  makeHighZBus,
  makeUnknownBus,
  primarySignal,
  resolveBusDrivers,
} from '../signals/signalModel';
import { auditCircuitGraph } from '../validation/connectionValidator';

export interface SimulationOptions {
  clockHigh?: boolean;
  previousStates?: Record<string, SequentialNodeState>;
  maxIterations?: number;
  customIcs?: Record<string, CustomICDefinition>;
  /** Internal: injected boundary input signals when evaluating a packaged subcircuit */
  externalInputs?: Record<string, BusValue>;
  /** Internal: active subcircuit recursion stack for circular dependency detection */
  _icCallStack?: string[];
  /** Internal: controls whether nested sequential elements commit state during this pass */
  _commitSequential?: boolean;
}

const MAX_ITERATIONS_DEFAULT = 48;

function pinKey(nodeId: string, pinId: string): string {
  return `${nodeId}:${pinId}`;
}

function cloneNodeState(st: SequentialNodeState): SequentialNodeState {
  const clonedSub: Record<string, SequentialNodeState> | undefined = st.subcircuitStates
    ? Object.fromEntries(
        Object.entries(st.subcircuitStates).map(([k, v]) => [k, cloneNodeState(v)])
      )
    : undefined;
  return {
    ...st,
    memory: st.memory ? [...st.memory] : undefined,
    subcircuitStates: clonedSub,
  };
}

function getDefaultNodeState(node: CircuitNode): SequentialNodeState {
  if (node.type === 'RAM_16X4') {
    const initial = Array.isArray(node.props?.data)
      ? (node.props.data as number[]).slice(0, 16)
      : Array.from({ length: 16 }, () => 0);
    while (initial.length < 16) initial.push(0);
    return { q: 'LOW', qBar: 'HIGH', prevClk: 'LOW', memory: initial };
  }
  return {
    q: 'LOW',
    qBar: 'HIGH',
    regValue: 0,
    prevClk: 'LOW',
    dividerCount: 0,
  };
}

function readInputBit(
  pinValues: Record<string, BusValue>,
  nodeId: string,
  pinId: string,
  fallback: SignalState = 'UNKNOWN'
): SignalState {
  const val = pinValues[pinKey(nodeId, pinId)];
  if (!val || val.bits.length === 0) return fallback;
  return val.bits[0];
}

function readInputBus(
  pinValues: Record<string, BusValue>,
  nodeId: string,
  pinId: string,
  width: number
): BusValue {
  return pinValues[pinKey(nodeId, pinId)] ?? makeUnknownBus(width);
}

function evaluateNode(
  node: CircuitNode,
  pinValues: Record<string, BusValue>,
  state: SequentialNodeState,
  clockHigh: boolean,
  commitSequential: boolean,
  customIcs: Record<string, CustomICDefinition>,
  icCallStack: string[],
  collectedSubIssues: SimulationIssue[]
): { outputs: Record<string, BusValue>; nextState: SequentialNodeState } {
  const outputs: Record<string, BusValue> = {};
  const nextState: SequentialNodeState = cloneNodeState(state);

  switch (node.type) {
    // ============ INPUTS ============
    case 'TOGGLE_SWITCH':
    case 'PUSH_BUTTON': {
      outputs.out = makeBit((node.value ?? 0) ? 'HIGH' : 'LOW');
      break;
    }
    case 'BINARY_INPUT': {
      outputs.out = makeBus(4, (node.value ?? 0) & 0x0f);
      break;
    }
    case 'CLOCK': {
      const clkState: SignalState = clockHigh ? 'HIGH' : 'LOW';
      outputs.out = makeBit(clkState);
      break;
    }
    case 'CONST_0': {
      outputs.out = makeBit('LOW');
      break;
    }
    case 'CONST_1': {
      outputs.out = makeBit('HIGH');
      break;
    }

    // ============ LOGIC GATES ============
    case 'NOT': {
      outputs.y = makeBit(logicNot(readInputBit(pinValues, node.id, 'a')));
      break;
    }
    case 'BUFFER': {
      const a = readInputBit(pinValues, node.id, 'a');
      outputs.y = makeBit(a === 'HIGH_IMPEDANCE' ? 'UNKNOWN' : a);
      break;
    }
    case 'AND':
    case 'OR':
    case 'NAND':
    case 'NOR':
    case 'XOR':
    case 'XNOR': {
      const pins = getNodePins(node, customIcs).filter((p) => p.direction === 'input');
      const vals = pins.map((p) => readInputBit(pinValues, node.id, p.id));
      let res: SignalState = 'UNKNOWN';
      if (node.type === 'AND') res = logicAnd(vals);
      else if (node.type === 'OR') res = logicOr(vals);
      else if (node.type === 'NAND') res = logicNand(vals);
      else if (node.type === 'NOR') res = logicNor(vals);
      else if (node.type === 'XOR') res = logicXor(vals);
      else if (node.type === 'XNOR') res = logicXnor(vals);
      outputs.y = makeBit(res);
      break;
    }

    // ============ ARITHMETIC ============
    case 'HALF_ADDER': {
      const a = readInputBit(pinValues, node.id, 'a');
      const b = readInputBit(pinValues, node.id, 'b');
      outputs.s = makeBit(logicXor([a, b]));
      outputs.c = makeBit(logicAnd([a, b]));
      break;
    }
    case 'FULL_ADDER': {
      const a = readInputBit(pinValues, node.id, 'a');
      const b = readInputBit(pinValues, node.id, 'b');
      const cin = readInputBit(pinValues, node.id, 'cin', 'LOW');
      const cinEffective = cin === 'UNKNOWN' ? 'LOW' : cin;
      const axb = logicXor([a, b]);
      outputs.s = makeBit(logicXor([axb, cinEffective]));
      outputs.cout = makeBit(logicOr([logicAnd([a, b]), logicAnd([axb, cinEffective])]));
      break;
    }
    case 'HALF_SUBTRACTOR': {
      const a = readInputBit(pinValues, node.id, 'a');
      const b = readInputBit(pinValues, node.id, 'b');
      outputs.d = makeBit(logicXor([a, b]));
      outputs.bo = makeBit(logicAnd([logicNot(a), b]));
      break;
    }
    case 'FULL_SUBTRACTOR': {
      const a = readInputBit(pinValues, node.id, 'a');
      const b = readInputBit(pinValues, node.id, 'b');
      const bin = readInputBit(pinValues, node.id, 'bin', 'LOW');
      const binEff = bin === 'UNKNOWN' ? 'LOW' : bin;
      const axb = logicXor([a, b]);
      outputs.d = makeBit(logicXor([axb, binEff]));
      outputs.bout = makeBit(
        logicOr([logicAnd([logicNot(a), b]), logicAnd([logicNot(axb), binEff])])
      );
      break;
    }
    case 'ADDER_4BIT': {
      const aVal = busToNumber(readInputBus(pinValues, node.id, 'a', 4));
      const bVal = busToNumber(readInputBus(pinValues, node.id, 'b', 4));
      const cinRaw = readInputBit(pinValues, node.id, 'cin', 'LOW');
      const cinBit = cinRaw === 'HIGH' ? 1 : 0;
      if (aVal === null || bVal === null) {
        outputs.sum = makeUnknownBus(4);
        outputs.cout = makeBit('UNKNOWN');
      } else {
        const total = aVal + bVal + cinBit;
        outputs.sum = makeBus(4, total & 0x0f);
        outputs.cout = makeBit(total > 15 ? 'HIGH' : 'LOW');
      }
      break;
    }
    case 'MUX_2TO1': {
      const d0 = readInputBit(pinValues, node.id, 'd0');
      const d1 = readInputBit(pinValues, node.id, 'd1');
      const sel = readInputBit(pinValues, node.id, 'sel');
      if (sel === 'LOW') outputs.y = makeBit(d0);
      else if (sel === 'HIGH') outputs.y = makeBit(d1);
      else if (d0 === d1 && (d0 === 'HIGH' || d0 === 'LOW')) outputs.y = makeBit(d0);
      else outputs.y = makeBit(sel === 'ERROR' ? 'ERROR' : 'UNKNOWN');
      break;
    }
    case 'DEMUX_1TO2': {
      const d = readInputBit(pinValues, node.id, 'd');
      const sel = readInputBit(pinValues, node.id, 'sel');
      if (sel === 'LOW') {
        outputs.y0 = makeBit(d);
        outputs.y1 = makeBit('LOW');
      } else if (sel === 'HIGH') {
        outputs.y0 = makeBit('LOW');
        outputs.y1 = makeBit(d);
      } else {
        outputs.y0 = makeBit('UNKNOWN');
        outputs.y1 = makeBit('UNKNOWN');
      }
      break;
    }
    case 'COMPARATOR_4BIT': {
      const aVal = busToNumber(readInputBus(pinValues, node.id, 'a', 4));
      const bVal = busToNumber(readInputBus(pinValues, node.id, 'b', 4));
      if (aVal === null || bVal === null) {
        outputs.gt = makeBit('UNKNOWN');
        outputs.eq = makeBit('UNKNOWN');
        outputs.lt = makeBit('UNKNOWN');
      } else {
        outputs.gt = makeBit(aVal > bVal ? 'HIGH' : 'LOW');
        outputs.eq = makeBit(aVal === bVal ? 'HIGH' : 'LOW');
        outputs.lt = makeBit(aVal < bVal ? 'HIGH' : 'LOW');
      }
      break;
    }

    // ============ SEQUENTIAL ============
    case 'SR_LATCH': {
      const s = readInputBit(pinValues, node.id, 's', 'LOW');
      const r = readInputBit(pinValues, node.id, 'r', 'LOW');
      let q = state.q;
      let qb = state.qBar ?? logicNot(q);
      if (s === 'HIGH' && r === 'HIGH') {
        q = 'ERROR';
        qb = 'ERROR';
      } else if (s === 'HIGH' && r !== 'HIGH') {
        q = 'HIGH';
        qb = 'LOW';
      } else if (r === 'HIGH' && s !== 'HIGH') {
        q = 'LOW';
        qb = 'HIGH';
      }
      if (commitSequential) {
        nextState.q = q;
        nextState.qBar = qb;
      }
      outputs.q = makeBit(q);
      outputs.qb = makeBit(qb);
      break;
    }
    case 'D_LATCH': {
      const d = readInputBit(pinValues, node.id, 'd', 'LOW');
      const en = readInputBit(pinValues, node.id, 'en', 'LOW');
      let q = state.q;
      if (en === 'HIGH' && (d === 'HIGH' || d === 'LOW')) {
        q = d;
      }
      const qb = logicNot(q);
      if (commitSequential) {
        nextState.q = q;
        nextState.qBar = qb;
      }
      outputs.q = makeBit(q);
      outputs.qb = makeBit(qb);
      break;
    }
    case 'D_FF': {
      const d = readInputBit(pinValues, node.id, 'd', 'LOW');
      const clk = readInputBit(pinValues, node.id, 'clk', 'LOW');
      const rst = readInputBit(pinValues, node.id, 'rst', 'LOW');
      let q = state.q;
      if (rst === 'HIGH') {
        q = 'LOW';
      } else if (commitSequential && state.prevClk === 'LOW' && clk === 'HIGH') {
        q = d === 'HIGH' ? 'HIGH' : 'LOW';
      }
      const qb = logicNot(q);
      if (commitSequential) {
        nextState.q = q;
        nextState.qBar = qb;
        nextState.prevClk = clk === 'HIGH' ? 'HIGH' : 'LOW';
      }
      outputs.q = makeBit(q);
      outputs.qb = makeBit(qb);
      break;
    }
    case 'JK_FF': {
      const j = readInputBit(pinValues, node.id, 'j', 'LOW');
      const k = readInputBit(pinValues, node.id, 'k', 'LOW');
      const clk = readInputBit(pinValues, node.id, 'clk', 'LOW');
      let q = state.q;
      if (commitSequential && state.prevClk === 'LOW' && clk === 'HIGH') {
        if (j === 'HIGH' && k === 'LOW') q = 'HIGH';
        else if (j === 'LOW' && k === 'HIGH') q = 'LOW';
        else if (j === 'HIGH' && k === 'HIGH') q = q === 'HIGH' ? 'LOW' : 'HIGH';
      }
      const qb = logicNot(q);
      if (commitSequential) {
        nextState.q = q;
        nextState.qBar = qb;
        nextState.prevClk = clk === 'HIGH' ? 'HIGH' : 'LOW';
      }
      outputs.q = makeBit(q);
      outputs.qb = makeBit(qb);
      break;
    }
    case 'T_FF': {
      const t = readInputBit(pinValues, node.id, 't', 'LOW');
      const clk = readInputBit(pinValues, node.id, 'clk', 'LOW');
      const rst = readInputBit(pinValues, node.id, 'rst', 'LOW');
      let q = state.q;
      if (rst === 'HIGH') {
        q = 'LOW';
      } else if (commitSequential && state.prevClk === 'LOW' && clk === 'HIGH' && t === 'HIGH') {
        q = q === 'HIGH' ? 'LOW' : 'HIGH';
      }
      const qb = logicNot(q);
      if (commitSequential) {
        nextState.q = q;
        nextState.qBar = qb;
        nextState.prevClk = clk === 'HIGH' ? 'HIGH' : 'LOW';
      }
      outputs.q = makeBit(q);
      outputs.qb = makeBit(qb);
      break;
    }
    case 'REGISTER_4BIT': {
      const dVal = busToNumber(readInputBus(pinValues, node.id, 'd', 4));
      const load = readInputBit(pinValues, node.id, 'load', 'HIGH');
      const clk = readInputBit(pinValues, node.id, 'clk', 'LOW');
      const rst = readInputBit(pinValues, node.id, 'rst', 'LOW');
      let regVal = state.regValue ?? 0;
      if (rst === 'HIGH') {
        regVal = 0;
      } else if (
        commitSequential &&
        state.prevClk === 'LOW' &&
        clk === 'HIGH' &&
        (load === 'HIGH' || load === 'UNKNOWN') &&
        dVal !== null
      ) {
        regVal = dVal & 0x0f;
      }
      if (commitSequential) {
        nextState.regValue = regVal;
        nextState.prevClk = clk === 'HIGH' ? 'HIGH' : 'LOW';
      }
      outputs.q = makeBus(4, regVal);
      break;
    }
    case 'COUNTER_4BIT': {
      const en = readInputBit(pinValues, node.id, 'en', 'HIGH');
      const clk = readInputBit(pinValues, node.id, 'clk', 'LOW');
      const rst = readInputBit(pinValues, node.id, 'rst', 'LOW');
      let regVal = state.regValue ?? 0;
      if (rst === 'HIGH') {
        regVal = 0;
      } else if (
        commitSequential &&
        state.prevClk === 'LOW' &&
        clk === 'HIGH' &&
        en !== 'LOW'
      ) {
        regVal = (regVal + 1) & 0x0f;
      }
      if (commitSequential) {
        nextState.regValue = regVal;
        nextState.prevClk = clk === 'HIGH' ? 'HIGH' : 'LOW';
      }
      outputs.q = makeBus(4, regVal);
      outputs.ovf = makeBit(regVal === 15 ? 'HIGH' : 'LOW');
      break;
    }

    // ============ OUTPUTS ============
    case 'LED':
    case 'BINARY_DISPLAY':
    case 'SEVEN_SEGMENT':
    case 'OUTPUT_PIN':
    case 'PROBE': {
      // Pure sink nodes (no output pins)
      break;
    }

    // ============ ADVANCED ============
    case 'ALU_4BIT': {
      const aVal = busToNumber(readInputBus(pinValues, node.id, 'a', 4));
      const bVal = busToNumber(readInputBus(pinValues, node.id, 'b', 4));
      const opBus = readInputBus(pinValues, node.id, 'op', 4);
      const opVal = busToNumber(opBus) ?? (typeof node.props?.op === 'number' ? node.props.op : 0);
      if (aVal === null || bVal === null) {
        outputs.y = makeUnknownBus(4);
        outputs.zero = makeBit('UNKNOWN');
        outputs.carry = makeBit('UNKNOWN');
      } else {
        let res = 0;
        let carry = false;
        switch (opVal & 0x07) {
          case 0: // ADD
            res = aVal + bVal;
            carry = res > 15;
            res &= 0x0f;
            break;
          case 1: // SUB
            carry = aVal < bVal;
            res = (aVal - bVal) & 0x0f;
            break;
          case 2: // AND
            res = aVal & bVal;
            break;
          case 3: // OR
            res = aVal | bVal;
            break;
          case 4: // XOR
            res = aVal ^ bVal;
            break;
          case 5: // NOT A
            res = ~aVal & 0x0f;
            break;
          case 6: // SHL
            carry = (aVal & 0x08) !== 0;
            res = (aVal << 1) & 0x0f;
            break;
          case 7: // SHR
            carry = (aVal & 0x01) !== 0;
            res = (aVal >> 1) & 0x0f;
            break;
        }
        outputs.y = makeBus(4, res);
        outputs.zero = makeBit(res === 0 ? 'HIGH' : 'LOW');
        outputs.carry = makeBit(carry ? 'HIGH' : 'LOW');
      }
      break;
    }
    case 'ROM_16X4': {
      const oe = readInputBit(pinValues, node.id, 'oe', 'HIGH');
      if (oe === 'LOW') {
        outputs.dout = makeHighZBus(4);
      } else {
        const addr = busToNumber(readInputBus(pinValues, node.id, 'addr', 4));
        const table = Array.isArray(node.props?.data)
          ? (node.props.data as number[])
          : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
        outputs.dout = addr === null ? makeUnknownBus(4) : makeBus(4, (table[addr] ?? 0) & 0x0f);
      }
      break;
    }
    case 'RAM_16X4': {
      const addr = busToNumber(readInputBus(pinValues, node.id, 'addr', 4));
      const din = busToNumber(readInputBus(pinValues, node.id, 'din', 4));
      const we = readInputBit(pinValues, node.id, 'we', 'LOW');
      const clk = readInputBit(pinValues, node.id, 'clk', 'LOW');
      const mem = nextState.memory ?? Array.from({ length: 16 }, () => 0);

      if (
        commitSequential &&
        state.prevClk === 'LOW' &&
        clk === 'HIGH' &&
        we === 'HIGH' &&
        addr !== null &&
        din !== null
      ) {
        mem[addr & 0x0f] = din & 0x0f;
      }
      if (commitSequential) {
        nextState.memory = mem;
        nextState.prevClk = clk === 'HIGH' ? 'HIGH' : 'LOW';
      }
      outputs.dout = addr === null ? makeUnknownBus(4) : makeBus(4, mem[addr & 0x0f] ?? 0);
      break;
    }
    case 'BUS_SPLITTER': {
      const bus = readInputBus(pinValues, node.id, 'in', 4);
      outputs.b0 = makeBit(bus.bits[0] ?? 'UNKNOWN');
      outputs.b1 = makeBit(bus.bits[1] ?? 'UNKNOWN');
      outputs.b2 = makeBit(bus.bits[2] ?? 'UNKNOWN');
      outputs.b3 = makeBit(bus.bits[3] ?? 'UNKNOWN');
      break;
    }
    case 'BUS_MERGER': {
      outputs.out = {
        width: 4,
        bits: [
          readInputBit(pinValues, node.id, 'b0', 'LOW'),
          readInputBit(pinValues, node.id, 'b1', 'LOW'),
          readInputBit(pinValues, node.id, 'b2', 'LOW'),
          readInputBit(pinValues, node.id, 'b3', 'LOW'),
        ],
      };
      break;
    }
    case 'CLOCK_DIVIDER': {
      const clk = readInputBit(pinValues, node.id, 'clk', 'LOW');
      const rst = readInputBit(pinValues, node.id, 'rst', 'LOW');
      let count = state.dividerCount ?? 0;
      if (rst === 'HIGH') {
        count = 0;
      } else if (commitSequential && state.prevClk === 'LOW' && clk === 'HIGH') {
        count = (count + 1) & 0x03;
      }
      if (commitSequential) {
        nextState.dividerCount = count;
        nextState.prevClk = clk === 'HIGH' ? 'HIGH' : 'LOW';
      }
      outputs.div2 = makeBit((count & 1) === 1 ? 'HIGH' : 'LOW');
      outputs.div4 = makeBit((count & 2) === 2 ? 'HIGH' : 'LOW');
      break;
    }
    case 'DECODER_2TO4': {
      const a0 = readInputBit(pinValues, node.id, 'a0');
      const a1 = readInputBit(pinValues, node.id, 'a1');
      const en = readInputBit(pinValues, node.id, 'en', 'HIGH');
      if (en === 'LOW') {
        outputs.y0 = makeBit('LOW');
        outputs.y1 = makeBit('LOW');
        outputs.y2 = makeBit('LOW');
        outputs.y3 = makeBit('LOW');
      } else if (
        (a0 !== 'HIGH' && a0 !== 'LOW') ||
        (a1 !== 'HIGH' && a1 !== 'LOW')
      ) {
        outputs.y0 = makeBit('UNKNOWN');
        outputs.y1 = makeBit('UNKNOWN');
        outputs.y2 = makeBit('UNKNOWN');
        outputs.y3 = makeBit('UNKNOWN');
      } else {
        const idx = (a1 === 'HIGH' ? 2 : 0) + (a0 === 'HIGH' ? 1 : 0);
        outputs.y0 = makeBit(idx === 0 ? 'HIGH' : 'LOW');
        outputs.y1 = makeBit(idx === 1 ? 'HIGH' : 'LOW');
        outputs.y2 = makeBit(idx === 2 ? 'HIGH' : 'LOW');
        outputs.y3 = makeBit(idx === 3 ? 'HIGH' : 'LOW');
      }
      break;
    }
    case 'ENCODER_4TO2': {
      const i0 = readInputBit(pinValues, node.id, 'i0', 'LOW');
      const i1 = readInputBit(pinValues, node.id, 'i1', 'LOW');
      const i2 = readInputBit(pinValues, node.id, 'i2', 'LOW');
      const i3 = readInputBit(pinValues, node.id, 'i3', 'LOW');
      if (i3 === 'HIGH') {
        outputs.y1 = makeBit('HIGH');
        outputs.y0 = makeBit('HIGH');
        outputs.v = makeBit('HIGH');
      } else if (i2 === 'HIGH') {
        outputs.y1 = makeBit('HIGH');
        outputs.y0 = makeBit('LOW');
        outputs.v = makeBit('HIGH');
      } else if (i1 === 'HIGH') {
        outputs.y1 = makeBit('LOW');
        outputs.y0 = makeBit('HIGH');
        outputs.v = makeBit('HIGH');
      } else if (i0 === 'HIGH') {
        outputs.y1 = makeBit('LOW');
        outputs.y0 = makeBit('LOW');
        outputs.v = makeBit('HIGH');
      } else {
        outputs.y1 = makeBit('LOW');
        outputs.y0 = makeBit('LOW');
        outputs.v = makeBit('LOW');
      }
      break;
    }
    case 'CUSTOM_IC': {
      const icId = node.customIcId;
      const ic = icId ? customIcs[icId] : undefined;
      if (!ic) {
        collectedSubIssues.push({
          id: `missing-ic-${node.id}`,
          severity: 'error',
          code: 'MISSING_CUSTOM_IC',
          nodeId: node.id,
          message: `Custom IC definition "${icId ?? 'unknown'}" for ${node.label} was not found.`,
          suggestion: 'Re-import the custom IC JSON definition or remove this component instance.',
        });
        break;
      }

      if (icCallStack.includes(ic.id) || icCallStack.length >= MAX_CUSTOM_IC_DEPTH) {
        collectedSubIssues.push({
          id: `circular-ic-${node.id}`,
          severity: 'error',
          code: 'CIRCULAR_SUBCIRCUIT',
          nodeId: node.id,
          message: `Circular or excessively deep custom IC dependency detected in "${ic.name}".`,
          suggestion: 'Remove self-referential or cyclic custom IC nesting.',
        });
        for (const p of ic.pins) {
          if (p.direction === 'output') {
            outputs[p.pinId] = makeErrorBus(p.width);
          }
        }
        break;
      }

      // Map external input pin buses into internal node destination pins
      const externalInputs: Record<string, BusValue> = {};
      for (const p of ic.pins) {
        if (p.direction !== 'input') continue;
        const bus = readInputBus(pinValues, node.id, p.pinId, p.width);
        for (const target of p.internalTargets) {
          externalInputs[pinKey(target.nodeId, target.pinId)] = bus;
        }
      }

      const subRes = simulateCircuit(ic.nodes, ic.wires, {
        clockHigh,
        previousStates: state.subcircuitStates ?? {},
        customIcs,
        externalInputs,
        _icCallStack: [...icCallStack, ic.id],
        _commitSequential: commitSequential,
      });

      if (commitSequential) {
        nextState.subcircuitStates = subRes.nodeStates;
      }

      for (const p of ic.pins) {
        if (p.direction !== 'output') continue;
        if (p.internalSource) {
          const srcKey = pinKey(p.internalSource.nodeId, p.internalSource.pinId);
          outputs[p.pinId] = subRes.pinValues[srcKey] ?? makeUnknownBus(p.width);
        } else {
          outputs[p.pinId] = makeUnknownBus(p.width);
        }
      }

      // Propagate critical subcircuit errors (cycles, circular dependencies, missing nested ICs)
      for (const subIssue of subRes.issues) {
        if (
          subIssue.severity === 'error' &&
          (subIssue.code === 'COMBINATIONAL_LOOP' ||
            subIssue.code === 'CIRCULAR_SUBCIRCUIT' ||
            subIssue.code === 'MISSING_CUSTOM_IC')
        ) {
          collectedSubIssues.push({
            ...subIssue,
            id: `${node.id}:${subIssue.id}`,
            nodeId: node.id,
            message: `[${node.label}] ${subIssue.message}`,
          });
        }
      }
      break;
    }
  }

  return { outputs, nextState };
}

export function simulateCircuit(
  nodes: CircuitNode[],
  wires: CircuitWire[],
  options: SimulationOptions = {}
): SimulationResult {
  const clockHigh = options.clockHigh ?? false;
  const maxIterations = options.maxIterations ?? MAX_ITERATIONS_DEFAULT;
  const prevStates = options.previousStates ?? {};
  const customIcs = options.customIcs ?? getActiveCustomICRegistry();
  const externalInputs = options.externalInputs ?? {};
  const icCallStack = options._icCallStack ?? [];
  const allowSequentialCommit = options._commitSequential ?? true;

  const issues: SimulationIssue[] = auditCircuitGraph(nodes, wires, customIcs);
  const subIssueMap = new Map<string, SimulationIssue>();
  const pinValues: Record<string, BusValue> = {};
  const wireValues: Record<string, BusValue> = {};
  const workingStates: Record<string, SequentialNodeState> = {};

  // Initialize states and default pin values
  for (const node of nodes) {
    workingStates[node.id] = prevStates[node.id]
      ? cloneNodeState(prevStates[node.id])
      : getDefaultNodeState(node);

    for (const pin of getNodePins(node, customIcs)) {
      const key = pinKey(node.id, pin.id);
      pinValues[key] = externalInputs[key] ?? makeUnknownBus(pin.width);
    }
  }

  // Group valid wires by destination input pin
  const incomingWires = new Map<string, CircuitWire[]>();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (const wire of wires) {
    const fromNode = nodeMap.get(wire.fromNodeId);
    const toNode = nodeMap.get(wire.toNodeId);
    if (!fromNode || !toNode) continue;
    const fromPin = getNodePins(fromNode, customIcs).find((p) => p.id === wire.fromPinId);
    const toPin = getNodePins(toNode, customIcs).find((p) => p.id === wire.toPinId);
    if (!fromPin || !toPin || fromPin.width !== toPin.width) continue;

    const destKey = pinKey(wire.toNodeId, wire.toPinId);
    const list = incomingWires.get(destKey) ?? [];
    list.push(wire);
    incomingWires.set(destKey, list);
  }

  // Step 1: Settle combinational network BEFORE committing sequential clock edges
  let iterations = 0;
  let stable = false;

  const propagateWires = () => {
    let changed = false;
    // Re-apply external subcircuit boundary inputs if present
    for (const [k, bus] of Object.entries(externalInputs)) {
      if (!busEquals(pinValues[k], bus)) {
        pinValues[k] = bus;
        changed = true;
      }
    }
    for (const [destKey, wList] of incomingWires.entries()) {
      const [toNodeId, toPinId] = destKey.split(':');
      const toNode = nodeMap.get(toNodeId);
      if (!toNode) continue;
      const toPin = getNodePins(toNode, customIcs).find((p) => p.id === toPinId);
      if (!toPin) continue;

      const driverBuses = wList.map(
        (w) => pinValues[pinKey(w.fromNodeId, w.fromPinId)] ?? makeUnknownBus(toPin.width)
      );
      const { value, contention } = resolveBusDrivers(driverBuses, toPin.width);
      const finalBus = contention ? makeErrorBus(toPin.width) : value;

      if (!busEquals(pinValues[destKey], finalBus)) {
        pinValues[destKey] = finalBus;
        changed = true;
      }
      for (const w of wList) {
        wireValues[w.id] = pinValues[pinKey(w.fromNodeId, w.fromPinId)] ?? makeUnknownBus(toPin.width);
      }
    }
    return changed;
  };

  const recordSubIssues = (list: SimulationIssue[]) => {
    for (const iss of list) {
      subIssueMap.set(iss.id, iss);
    }
  };

  // Phase A: Propagate input sources & combinational logic using existing sequential Q
  for (let i = 0; i < maxIterations; i++) {
    iterations++;
    let changed = false;
    for (const node of nodes) {
      const localSubIssues: SimulationIssue[] = [];
      const { outputs } = evaluateNode(
        node,
        pinValues,
        workingStates[node.id],
        clockHigh,
        false,
        customIcs,
        icCallStack,
        localSubIssues
      );
      recordSubIssues(localSubIssues);
      for (const [pId, bus] of Object.entries(outputs)) {
        const key = pinKey(node.id, pId);
        if (!busEquals(pinValues[key], bus)) {
          pinValues[key] = bus;
          changed = true;
        }
      }
    }
    if (propagateWires()) changed = true;
    if (!changed) {
      stable = true;
      break;
    }
  }

  // Phase B: Commit sequential clock edges & latches with settled inputs (when allowed)
  const committedStates: Record<string, SequentialNodeState> = {};
  let seqChanged = false;
  if (allowSequentialCommit) {
    for (const node of nodes) {
      const localSubIssues: SimulationIssue[] = [];
      const { outputs, nextState } = evaluateNode(
        node,
        pinValues,
        workingStates[node.id],
        clockHigh,
        true,
        customIcs,
        icCallStack,
        localSubIssues
      );
      recordSubIssues(localSubIssues);
      committedStates[node.id] = nextState;
      for (const [pId, bus] of Object.entries(outputs)) {
        const key = pinKey(node.id, pId);
        if (!busEquals(pinValues[key], bus)) {
          pinValues[key] = bus;
          seqChanged = true;
        }
      }
    }
  } else {
    for (const node of nodes) {
      committedStates[node.id] = workingStates[node.id];
    }
  }

  // Phase C: Re-settle combinational paths after sequential outputs updated
  if (seqChanged) {
    stable = false;
    for (let i = 0; i < maxIterations; i++) {
      iterations++;
      let changed = propagateWires();
      for (const node of nodes) {
        const localSubIssues: SimulationIssue[] = [];
        const { outputs } = evaluateNode(
          node,
          pinValues,
          committedStates[node.id],
          clockHigh,
          false,
          customIcs,
          icCallStack,
          localSubIssues
        );
        recordSubIssues(localSubIssues);
        for (const [pId, bus] of Object.entries(outputs)) {
          const key = pinKey(node.id, pId);
          if (!busEquals(pinValues[key], bus)) {
            pinValues[key] = bus;
            changed = true;
          }
        }
      }
      if (!changed) {
        stable = true;
        break;
      }
    }
  }

  // Final wire value sync
  for (const wire of wires) {
    const src = pinValues[pinKey(wire.fromNodeId, wire.fromPinId)];
    if (src) wireValues[wire.id] = src;
  }

  // Merge collected subcircuit issues
  for (const subIssue of subIssueMap.values()) {
    issues.push(subIssue);
  }

  // Detect structural combinational feedback cycles (excluding sequential state-holding nodes)
  const sequentialTypes = new Set([
    'SR_LATCH',
    'D_LATCH',
    'D_FF',
    'JK_FF',
    'T_FF',
    'REGISTER_4BIT',
    'COUNTER_4BIT',
    'CLOCK_DIVIDER',
    'RAM_16X4',
  ]);

  const icHasSequential = (icId: string, seen = new Set<string>()): boolean => {
    if (seen.has(icId)) return false;
    seen.add(icId);
    const ic = customIcs[icId];
    if (!ic) return false;
    return ic.nodes.some(
      (n) =>
        sequentialTypes.has(n.type) ||
        (n.type === 'CUSTOM_IC' && n.customIcId ? icHasSequential(n.customIcId, seen) : false)
    );
  };

  const isSequentialNode = (node: CircuitNode) =>
    sequentialTypes.has(node.type) ||
    (node.type === 'CUSTOM_IC' && node.customIcId ? icHasSequential(node.customIcId) : false);

  const combAdj = new Map<string, string[]>();
  for (const wire of wires) {
    const fromNode = nodeMap.get(wire.fromNodeId);
    const toNode = nodeMap.get(wire.toNodeId);
    if (!fromNode || !toNode) continue;
    if (isSequentialNode(fromNode) || isSequentialNode(toNode)) continue;
    const list = combAdj.get(fromNode.id) ?? [];
    list.push(toNode.id);
    combAdj.set(fromNode.id, list);
  }

  let hasCombinationalCycle = false;
  const visitState = new Map<string, 0 | 1 | 2>(); // 0 unvisited, 1 visiting, 2 done
  const dfsCycle = (id: string): boolean => {
    visitState.set(id, 1);
    for (const next of combAdj.get(id) ?? []) {
      const st = visitState.get(next) ?? 0;
      if (st === 1) return true;
      if (st === 0 && dfsCycle(next)) return true;
    }
    visitState.set(id, 2);
    return false;
  };
  for (const node of nodes) {
    if (!isSequentialNode(node) && (visitState.get(node.id) ?? 0) === 0) {
      if (dfsCycle(node.id)) {
        hasCombinationalCycle = true;
        break;
      }
    }
  }

  if (!stable || hasCombinationalCycle) {
    stable = false;
    issues.push({
      id: 'loop-detected',
      severity: 'error',
      code: 'COMBINATIONAL_LOOP',
      message: hasCombinationalCycle
        ? 'Combinational feedback loop detected without a clocked sequential element.'
        : `Simulation did not settle within ${maxIterations} propagation cycles (oscillation detected).`,
      suggestion:
        'Break direct combinational feedback loops (such as a gate wired back to its own input) or insert a Flip-Flop / Register to synchronize the feedback path.',
    });
  }

  // Flag floating inputs on logic/arithmetic/output nodes as informational warnings
  // (Skip floating warnings inside nested subcircuits where external pins may intentionally float)
  if (icCallStack.length === 0) {
    for (const node of nodes) {
      const pins = getNodePins(node, customIcs);
      for (const pin of pins) {
        if (pin.direction !== 'input') continue;
        const key = pinKey(node.id, pin.id);
        const connected = (incomingWires.get(key)?.length ?? 0) > 0 || key in externalInputs;
        const optionalPin =
          pin.id === 'rst' ||
          pin.id === 'cin' ||
          pin.id === 'bin' ||
          pin.id === 'en' ||
          pin.id === 'oe' ||
          pin.id === 'load' ||
          pin.id === 'op';
        if (!connected && !optionalPin && primarySignal(pinValues[key]) === 'UNKNOWN') {
          issues.push({
            id: `float-${key}`,
            severity: 'warning',
            code: 'FLOATING_INPUT',
            nodeId: node.id,
            message: `Floating input ${node.label}.${pin.label} is not connected to any driver.`,
            suggestion: `Wire ${node.label}.${pin.label} to a switch, gate output, or Constant 0/1.`,
          });
        }
      }
    }
  }

  return {
    pinValues,
    wireValues,
    nodeStates: committedStates,
    issues,
    iterations,
    stable,
    timestamp: Date.now(),
  };
}
