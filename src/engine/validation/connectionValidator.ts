import type {
  CircuitNode,
  CircuitWire,
  CustomICDefinition,
  SimulationIssue,
} from '../../types/circuit';
import { getNodePins } from '../gates/componentCatalog';

export interface ConnectionValidationResult {
  valid: boolean;
  reason?: string;
  suggestion?: string;
  normalized?: {
    fromNodeId: string;
    fromPinId: string;
    toNodeId: string;
    toPinId: string;
  };
}

export function validateNewConnection(
  nodes: CircuitNode[],
  wires: CircuitWire[],
  sourceNodeId: string,
  sourcePinId: string,
  targetNodeId: string,
  targetPinId: string,
  customIcs?: Record<string, CustomICDefinition>
): ConnectionValidationResult {
  if (sourceNodeId === targetNodeId && sourcePinId === targetPinId) {
    return {
      valid: false,
      reason: 'Cannot connect a pin to itself.',
      suggestion: 'Drag from an output pin to an input pin on a component.',
    };
  }

  const nodeA = nodes.find((n) => n.id === sourceNodeId);
  const nodeB = nodes.find((n) => n.id === targetNodeId);
  if (!nodeA || !nodeB) {
    return {
      valid: false,
      reason: 'Referenced component no longer exists.',
      suggestion: 'Retry connecting two active components on the canvas.',
    };
  }

  const pinA = getNodePins(nodeA, customIcs).find((p) => p.id === sourcePinId);
  const pinB = getNodePins(nodeB, customIcs).find((p) => p.id === targetPinId);
  if (!pinA || !pinB) {
    return {
      valid: false,
      reason: 'Invalid pin reference.',
      suggestion: 'Connect directly to a highlighted pin terminal.',
    };
  }

  if (pinA.direction === pinB.direction) {
    if (pinA.direction === 'output') {
      return {
        valid: false,
        reason: 'Cannot connect two output pins directly (short-circuit risk).',
        suggestion: 'Connect an output pin to an input pin, or combine outputs through a logic gate.',
      };
    }
    return {
      valid: false,
      reason: 'Cannot connect two input pins without a signal driver.',
      suggestion: 'Connect each input pin to an output terminal.',
    };
  }

  // Normalize so from = output, to = input
  const fromNode = pinA.direction === 'output' ? nodeA : nodeB;
  const fromPin = pinA.direction === 'output' ? pinA : pinB;
  const toNode = pinA.direction === 'input' ? nodeA : nodeB;
  const toPin = pinA.direction === 'input' ? pinA : pinB;

  if (fromPin.width !== toPin.width) {
    return {
      valid: false,
      reason: `Bit-width mismatch: ${fromNode.label}.${fromPin.label} is ${fromPin.width}-bit, but ${toNode.label}.${toPin.label} expects ${toPin.width}-bit.`,
      suggestion:
        fromPin.width === 4
          ? 'Use a 4-Bit Bus Splitter to break a 4-bit bus into 1-bit wires.'
          : 'Use a 4-Bit Bus Merger to combine 1-bit wires into a 4-bit bus.',
    };
  }

  const duplicate = wires.some(
    (w) =>
      w.fromNodeId === fromNode.id &&
      w.fromPinId === fromPin.id &&
      w.toNodeId === toNode.id &&
      w.toPinId === toPin.id
  );
  if (duplicate) {
    return {
      valid: false,
      reason: 'These two pins are already connected.',
      suggestion: 'Select the existing wire if you want to remove it.',
    };
  }

  const existingDriver = wires.find(
    (w) => w.toNodeId === toNode.id && w.toPinId === toPin.id
  );
  if (existingDriver) {
    return {
      valid: false,
      reason: `Input pin ${toNode.label}.${toPin.label} already has a driving wire.`,
      suggestion:
        'Disconnect the existing wire first, or combine multiple signals through an OR/AND/MUX gate.',
    };
  }

  return {
    valid: true,
    normalized: {
      fromNodeId: fromNode.id,
      fromPinId: fromPin.id,
      toNodeId: toNode.id,
      toPinId: toPin.id,
    },
  };
}

export function auditCircuitGraph(
  nodes: CircuitNode[],
  wires: CircuitWire[],
  customIcs?: Record<string, CustomICDefinition>
): SimulationIssue[] {
  const issues: SimulationIssue[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inputDrivers = new Map<string, CircuitWire[]>();

  for (const wire of wires) {
    const fromNode = nodeMap.get(wire.fromNodeId);
    const toNode = nodeMap.get(wire.toNodeId);
    if (!fromNode || !toNode) {
      issues.push({
        id: `orphan-${wire.id}`,
        severity: 'error',
        code: 'INVALID_CONNECTION',
        wireId: wire.id,
        message: `Wire ${wire.id} references a deleted component.`,
        suggestion: 'Remove the broken wire.',
      });
      continue;
    }

    const fromPin = getNodePins(fromNode, customIcs).find((p) => p.id === wire.fromPinId);
    const toPin = getNodePins(toNode, customIcs).find((p) => p.id === wire.toPinId);
    if (!fromPin || !toPin || fromPin.direction !== 'output' || toPin.direction !== 'input') {
      issues.push({
        id: `dir-${wire.id}`,
        severity: 'error',
        code: 'INVALID_CONNECTION',
        wireId: wire.id,
        message: `Invalid wire direction between ${fromNode.label} and ${toNode.label}.`,
        suggestion: 'Wires must route from an output pin to an input pin.',
      });
      continue;
    }

    if (fromPin.width !== toPin.width) {
      issues.push({
        id: `width-${wire.id}`,
        severity: 'error',
        code: 'WIDTH_MISMATCH',
        wireId: wire.id,
        message: `Bit-width mismatch (${fromPin.width}-bit → ${toPin.width}-bit) between ${fromNode.label}.${fromPin.label} and ${toNode.label}.${toPin.label}.`,
        suggestion: 'Insert a Bus Splitter or Bus Merger between mismatched widths.',
      });
    }

    const key = `${wire.toNodeId}:${wire.toPinId}`;
    const list = inputDrivers.get(key) ?? [];
    list.push(wire);
    inputDrivers.set(key, list);
  }

  for (const [key, list] of inputDrivers.entries()) {
    if (list.length > 1) {
      const [nodeId, pinId] = key.split(':');
      const node = nodeMap.get(nodeId);
      issues.push({
        id: `multi-${key}`,
        severity: 'error',
        code: 'MULTIPLE_DRIVERS',
        nodeId,
        message: `Multiple wires (${list.length}) drive input ${node?.label ?? nodeId}.${pinId}.`,
        suggestion: 'Disconnect extra wires or use a Multiplexer / Logic Gate to combine signals.',
      });
    }
  }

  return issues;
}
