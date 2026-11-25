import type {
  CircuitDocument,
  CircuitNode,
  CircuitWire,
  ComponentType,
  CustomICDefinition,
  CustomICPinMapping,
  CustomICPinTarget,
  PinSide,
} from '../../types/circuit';
import { getNodePins } from '../gates/componentCatalog';

export const MAX_CUSTOM_IC_DEPTH = 12;
export const CUSTOM_IC_SCHEMA_VERSION = 1;

const PORT_INPUT_TYPES = new Set<ComponentType>([
  'TOGGLE_SWITCH',
  'PUSH_BUTTON',
  'BINARY_INPUT',
  'CLOCK',
]);

const PORT_OUTPUT_TYPES = new Set<ComponentType>([
  'LED',
  'OUTPUT_PIN',
  'PROBE',
  'BINARY_DISPLAY',
  'SEVEN_SEGMENT',
]);

const OPTIONAL_INTERNAL_PINS = new Set(['rst', 'cin', 'bin', 'en', 'oe', 'load', 'op']);

export interface ExternalBoundaryWireLink {
  externalNodeId: string;
  externalPinId: string;
  customIcPinId: string;
  direction: 'into-ic' | 'out-of-ic';
}

export interface SubcircuitDraftResult {
  ok: true;
  draft: CustomICDefinition;
  /** External wires that can be re-attached if the user replaces the selection with an IC instance */
  boundaryLinks: ExternalBoundaryWireLink[];
  /** Node IDs from the original selection that were absorbed (core + selected I/O ports) */
  absorbedNodeIds: string[];
  /** Center position of the selected region on canvas */
  centroid: { x: number; y: number };
}

export interface SubcircuitDraftError {
  ok: false;
  error: string;
}

export function recalculatePinLayout(pins: CustomICPinMapping[]): {
  pins: CustomICPinMapping[];
  width: number;
  height: number;
} {
  const bySide: Record<PinSide, CustomICPinMapping[]> = {
    left: [],
    right: [],
    top: [],
    bottom: [],
  };

  for (const pin of pins) {
    bySide[pin.side].push(pin);
  }

  const offsetById = new Map<string, number>();
  (['left', 'right', 'top', 'bottom'] as PinSide[]).forEach((side) => {
    const list = bySide[side];
    list.forEach((p, idx) => {
      const count = list.length;
      if (side === 'left' || side === 'right') {
        // Reserve top header band (~24px) by mapping offsets into [0.28 .. 0.88] when multiple pins exist
        const start = count === 1 ? 0.56 : 0.28;
        const end = count === 1 ? 0.56 : 0.88;
        const offset = count === 1 ? 0.56 : start + (idx / (count - 1)) * (end - start);
        offsetById.set(p.pinId, Number(offset.toFixed(4)));
      } else {
        const offset = (idx + 1) / (count + 1);
        offsetById.set(p.pinId, Number(offset.toFixed(4)));
      }
    });
  });

  const maxVerticalPins = Math.max(bySide.left.length, bySide.right.length, 1);
  const maxHorizontalPins = Math.max(bySide.top.length, bySide.bottom.length, 0);

  const longestLeft = bySide.left.reduce((m, p) => Math.max(m, p.label.length), 0);
  const longestRight = bySide.right.reduce((m, p) => Math.max(m, p.label.length), 0);

  const width = Math.max(
    132,
    Math.min(280, Math.max(78 + (longestLeft + longestRight) * 6.5, maxHorizontalPins * 46 + 40))
  );
  const height = Math.max(
    84,
    Math.min(340, 34 + maxVerticalPins * 26 + (bySide.bottom.length > 0 ? 18 : 0))
  );

  const updatedPins = pins.map((p) => ({
    ...p,
    offset: offsetById.get(p.pinId) ?? 0.5,
  }));

  return {
    pins: updatedPins,
    width: Math.round(width),
    height: Math.round(height),
  };
}

function makeUniqueLabel(raw: string, used: Set<string>, fallbackPrefix: string): string {
  const base = (raw || fallbackPrefix).trim().replace(/\s+/g, '_').slice(0, 14) || fallbackPrefix;
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let idx = 2;
  while (used.has(`${base}_${idx}`)) idx++;
  const unique = `${base}_${idx}`;
  used.add(unique);
  return unique;
}

export function extractSubcircuitDraft(
  circuit: CircuitDocument,
  selectedNodeIds: string[],
  customIcs: Record<string, CustomICDefinition>,
  defaultName = 'Custom IC'
): SubcircuitDraftResult | SubcircuitDraftError {
  if (selectedNodeIds.length === 0) {
    return {
      ok: false,
      error: 'Select one or more components on the canvas before packaging as a Custom IC.',
    };
  }

  const selectedSet = new Set(selectedNodeIds);
  const selectedNodes = circuit.nodes.filter((n) => selectedSet.has(n.id));
  if (selectedNodes.length === 0) {
    return { ok: false, error: 'Selected components could not be found in the active circuit.' };
  }

  const nodeMap = new Map(circuit.nodes.map((n) => [n.id, n]));
  const portInputNodes = selectedNodes.filter((n) => PORT_INPUT_TYPES.has(n.type));
  const portOutputNodes = selectedNodes.filter((n) => PORT_OUTPUT_TYPES.has(n.type));
  const coreNodes = selectedNodes.filter(
    (n) => !PORT_INPUT_TYPES.has(n.type) && !PORT_OUTPUT_TYPES.has(n.type)
  );

  if (coreNodes.length === 0) {
    return {
      ok: false,
      error:
        'Selection must include at least one logic gate, arithmetic block, sequential element, or subcircuit IC (not only switches or LEDs).',
    };
  }

  const coreSet = new Set(coreNodes.map((n) => n.id));
  const portInputSet = new Set(portInputNodes.map((n) => n.id));
  const portOutputSet = new Set(portOutputNodes.map((n) => n.id));

  // Internal wires: solely between core nodes
  const internalWires: CircuitWire[] = circuit.wires
    .filter((w) => coreSet.has(w.fromNodeId) && coreSet.has(w.toNodeId))
    .map((w) => ({ ...w }));

  const internallyDrivenInputKeys = new Set(
    internalWires.map((w) => `${w.toNodeId}:${w.toPinId}`)
  );
  const internallyUsedOutputKeys = new Set(
    internalWires.map((w) => `${w.fromNodeId}:${w.fromPinId}`)
  );

  const usedLabels = new Set<string>();
  const detectedPins: CustomICPinMapping[] = [];
  const boundaryLinks: ExternalBoundaryWireLink[] = [];
  let inIdx = 0;
  let outIdx = 0;

  // Track which core inputs/outputs are already accounted for by boundary nets
  const accountedCoreInputs = new Set<string>(internallyDrivenInputKeys);
  const accountedCoreOutputs = new Set<string>(internallyUsedOutputKeys);

  // 1A. Selected input port nodes (switches/buttons/binary inputs/clocks) driving core nodes
  for (const portNode of portInputNodes) {
    const outgoing = circuit.wires.filter(
      (w) => w.fromNodeId === portNode.id && coreSet.has(w.toNodeId)
    );
    if (outgoing.length === 0) continue;
    const portOutPin = getNodePins(portNode, customIcs).find((p) => p.direction === 'output');
    const width = portOutPin?.width ?? 1;
    const pinId = `in_${inIdx++}`;
    const label = makeUniqueLabel(portNode.label, usedLabels, `IN${inIdx}`);
    const targets: CustomICPinTarget[] = outgoing.map((w) => {
      accountedCoreInputs.add(`${w.toNodeId}:${w.toPinId}`);
      return { nodeId: w.toNodeId, pinId: w.toPinId };
    });

    detectedPins.push({
      pinId,
      label,
      direction: 'input',
      width,
      side: 'left',
      offset: 0.5,
      internalTargets: targets,
    });
  }

  // 1B. Wires entering core nodes from OUTSIDE the selection (grouped by external source net)
  const incomingBoundaryGroups = new Map<
    string,
    { fromNode: CircuitNode; fromPinId: string; width: number; targets: CustomICPinTarget[] }
  >();
  for (const w of circuit.wires) {
    if (!selectedSet.has(w.fromNodeId) && coreSet.has(w.toNodeId)) {
      const fromNode = nodeMap.get(w.fromNodeId);
      if (!fromNode) continue;
      const fromPin = getNodePins(fromNode, customIcs).find((p) => p.id === w.fromPinId);
      const key = `${w.fromNodeId}:${w.fromPinId}`;
      const existing = incomingBoundaryGroups.get(key);
      if (existing) {
        existing.targets.push({ nodeId: w.toNodeId, pinId: w.toPinId });
      } else {
        incomingBoundaryGroups.set(key, {
          fromNode,
          fromPinId: w.fromPinId,
          width: fromPin?.width ?? 1,
          targets: [{ nodeId: w.toNodeId, pinId: w.toPinId }],
        });
      }
      accountedCoreInputs.add(`${w.toNodeId}:${w.toPinId}`);
    }
  }
  for (const group of incomingBoundaryGroups.values()) {
    const pinId = `in_${inIdx++}`;
    const rawLabel = PORT_INPUT_TYPES.has(group.fromNode.type)
      ? group.fromNode.label
      : `${group.fromNode.label}_${group.fromPinId.toUpperCase()}`;
    const label = makeUniqueLabel(rawLabel, usedLabels, `IN${inIdx}`);
    detectedPins.push({
      pinId,
      label,
      direction: 'input',
      width: group.width,
      side: 'left',
      offset: 0.5,
      internalTargets: group.targets,
    });
    boundaryLinks.push({
      externalNodeId: group.fromNode.id,
      externalPinId: group.fromPinId,
      customIcPinId: pinId,
      direction: 'into-ic',
    });
  }

  // 1C. Unconnected required input pins on core nodes
  for (const node of coreNodes) {
    const pins = getNodePins(node, customIcs);
    for (const pin of pins) {
      if (pin.direction !== 'input') continue;
      const key = `${node.id}:${pin.id}`;
      if (accountedCoreInputs.has(key)) continue;
      if (OPTIONAL_INTERNAL_PINS.has(pin.id)) continue;
      const pinId = `in_${inIdx++}`;
      const label = makeUniqueLabel(
        coreNodes.length === 1 ? pin.label : `${node.label}_${pin.label}`,
        usedLabels,
        `IN${inIdx}`
      );
      detectedPins.push({
        pinId,
        label,
        direction: 'input',
        width: pin.width,
        side: 'left',
        offset: 0.5,
        internalTargets: [{ nodeId: node.id, pinId: pin.id }],
      });
      accountedCoreInputs.add(key);
    }
  }

  // 2A. Selected output port nodes (LED / OUTPUT_PIN / PROBE / Display) driven by core nodes
  for (const portNode of portOutputNodes) {
    const incoming = circuit.wires.find(
      (w) => w.toNodeId === portNode.id && coreSet.has(w.fromNodeId)
    );
    if (!incoming) continue;
    const srcNode = nodeMap.get(incoming.fromNodeId);
    const srcPin = srcNode
      ? getNodePins(srcNode, customIcs).find((p) => p.id === incoming.fromPinId)
      : undefined;
    const pinId = `out_${outIdx++}`;
    const label = makeUniqueLabel(portNode.label, usedLabels, `OUT${outIdx}`);
    accountedCoreOutputs.add(`${incoming.fromNodeId}:${incoming.fromPinId}`);

    detectedPins.push({
      pinId,
      label,
      direction: 'output',
      width: srcPin?.width ?? 1,
      side: 'right',
      offset: 0.5,
      internalTargets: [],
      internalSource: { nodeId: incoming.fromNodeId, pinId: incoming.fromPinId },
    });
  }

  // 2B. Wires leaving core nodes to OUTSIDE the selection (grouped by core source pin)
  const outgoingBoundaryGroups = new Map<
    string,
    {
      fromNode: CircuitNode;
      fromPinId: string;
      width: number;
      externalDests: Array<{ node: CircuitNode; pinId: string }>;
    }
  >();
  for (const w of circuit.wires) {
    if (coreSet.has(w.fromNodeId) && !selectedSet.has(w.toNodeId)) {
      const fromNode = nodeMap.get(w.fromNodeId);
      const toNode = nodeMap.get(w.toNodeId);
      if (!fromNode || !toNode) continue;
      const fromPin = getNodePins(fromNode, customIcs).find((p) => p.id === w.fromPinId);
      const key = `${w.fromNodeId}:${w.fromPinId}`;
      const existing = outgoingBoundaryGroups.get(key);
      if (existing) {
        existing.externalDests.push({ node: toNode, pinId: w.toPinId });
      } else {
        outgoingBoundaryGroups.set(key, {
          fromNode,
          fromPinId: w.fromPinId,
          width: fromPin?.width ?? 1,
          externalDests: [{ node: toNode, pinId: w.toPinId }],
        });
      }
      accountedCoreOutputs.add(key);
    }
  }
  for (const group of outgoingBoundaryGroups.values()) {
    const pinId = `out_${outIdx++}`;
    const primaryDest = group.externalDests[0]?.node;
    const rawLabel =
      primaryDest && PORT_OUTPUT_TYPES.has(primaryDest.type)
        ? primaryDest.label
        : `${group.fromNode.label}_${group.fromPinId.toUpperCase()}`;
    const label = makeUniqueLabel(rawLabel, usedLabels, `OUT${outIdx}`);

    detectedPins.push({
      pinId,
      label,
      direction: 'output',
      width: group.width,
      side: 'right',
      offset: 0.5,
      internalTargets: [],
      internalSource: { nodeId: group.fromNode.id, pinId: group.fromPinId },
    });

    for (const dest of group.externalDests) {
      boundaryLinks.push({
        externalNodeId: dest.node.id,
        externalPinId: dest.pinId,
        customIcPinId: pinId,
        direction: 'out-of-ic',
      });
    }
  }

  // 2C. Unconnected output pins on core nodes
  for (const node of coreNodes) {
    if (node.type === 'CONST_0' || node.type === 'CONST_1') continue;
    const pins = getNodePins(node, customIcs);
    for (const pin of pins) {
      if (pin.direction !== 'output') continue;
      const key = `${node.id}:${pin.id}`;
      if (accountedCoreOutputs.has(key)) continue;
      const pinId = `out_${outIdx++}`;
      const label = makeUniqueLabel(
        coreNodes.length === 1 ? pin.label : `${node.label}_${pin.label}`,
        usedLabels,
        `OUT${outIdx}`
      );
      detectedPins.push({
        pinId,
        label,
        direction: 'output',
        width: pin.width,
        side: 'right',
        offset: 0.5,
        internalTargets: [],
        internalSource: { nodeId: node.id, pinId: pin.id },
      });
      accountedCoreOutputs.add(key);
    }
  }

  if (detectedPins.length === 0) {
    return {
      ok: false,
      error:
        'Could not detect any external input or output pins for the selected circuit. Ensure the selection has inputs or outputs.',
    };
  }

  // Normalize internal node coordinates around (40, 40)
  const minX = Math.min(...coreNodes.map((n) => n.x));
  const minY = Math.min(...coreNodes.map((n) => n.y));
  const normalizedCoreNodes: CircuitNode[] = coreNodes.map((n) => ({
    ...n,
    x: n.x - minX + 40,
    y: n.y - minY + 40,
    props: n.props ? JSON.parse(JSON.stringify(n.props)) : undefined,
  }));

  const layout = recalculatePinLayout(detectedPins);
  const now = Date.now();
  const id = `ic_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const shortName = defaultName
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 6) || 'IC';

  const centroidX = Math.round(
    selectedNodes.reduce((sum, n) => sum + n.x, 0) / selectedNodes.length
  );
  const centroidY = Math.round(
    selectedNodes.reduce((sum, n) => sum + n.y, 0) / selectedNodes.length
  );

  // Absorbed nodes include core nodes plus any selected port nodes that were actually wired to core nodes
  const absorbedNodeIds = selectedNodes
    .filter((n) => coreSet.has(n.id) || portInputSet.has(n.id) || portOutputSet.has(n.id))
    .map((n) => n.id);

  return {
    ok: true,
    draft: {
      id,
      name: defaultName,
      shortName,
      description: `Packaged subcircuit (${normalizedCoreNodes.length} internal components, ${layout.pins.length} pins).`,
      width: layout.width,
      height: layout.height,
      pins: layout.pins,
      nodes: normalizedCoreNodes,
      wires: internalWires,
      createdAt: now,
      updatedAt: now,
      schemaVersion: CUSTOM_IC_SCHEMA_VERSION,
    },
    boundaryLinks,
    absorbedNodeIds,
    centroid: { x: centroidX, y: centroidY },
  };
}

export function detectCustomICCycle(
  candidateId: string,
  internalNodes: CircuitNode[],
  customIcs: Record<string, CustomICDefinition>
): { hasCycle: boolean; reason?: string; cyclePath?: string[] } {
  const dfs = (nodes: CircuitNode[], stack: string[]): string[] | null => {
    if (stack.length > MAX_CUSTOM_IC_DEPTH) {
      return [...stack, 'MAX_DEPTH'];
    }
    for (const node of nodes) {
      if (node.type !== 'CUSTOM_IC' || !node.customIcId) continue;
      const refId = node.customIcId;
      if (stack.includes(refId)) {
        return [...stack, refId];
      }
      const nested = customIcs[refId];
      if (nested) {
        const hit = dfs(nested.nodes, [...stack, refId]);
        if (hit) return hit;
      }
    }
    return null;
  };

  const hit = dfs(internalNodes, [candidateId]);
  if (!hit) return { hasCycle: false };
  if (hit[hit.length - 1] === 'MAX_DEPTH') {
    return {
      hasCycle: true,
      reason: `Custom IC nesting exceeds maximum allowed depth of ${MAX_CUSTOM_IC_DEPTH} levels.`,
      cyclePath: hit,
    };
  }
  return {
    hasCycle: true,
    reason: `Circular subcircuit dependency detected (${hit.join(' → ')}).`,
    cyclePath: hit,
  };
}

export function validateCustomICDefinition(
  def: CustomICDefinition,
  existingIcs: Record<string, CustomICDefinition>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!def.name.trim()) {
    errors.push('IC name is required.');
  }
  if (!def.shortName.trim() || def.shortName.trim().length > 10) {
    errors.push('IC chip short label must be between 1 and 10 characters.');
  }
  if (!Array.isArray(def.nodes) || def.nodes.length === 0) {
    errors.push('Custom IC must contain at least one internal component.');
  }
  if (!Array.isArray(def.pins) || def.pins.length === 0) {
    errors.push('Custom IC must expose at least one external pin.');
  }

  const seenLabels = new Set<string>();
  const validSides: PinSide[] = ['left', 'right', 'top', 'bottom'];
  for (const pin of def.pins ?? []) {
    const lbl = pin.label.trim();
    if (!lbl) {
      errors.push(`Pin "${pin.pinId}" must have a non-empty label.`);
    } else if (seenLabels.has(lbl.toUpperCase())) {
      errors.push(`Duplicate pin label "${lbl}". Pin labels must be unique.`);
    } else {
      seenLabels.add(lbl.toUpperCase());
    }
    if (!validSides.includes(pin.side)) {
      errors.push(`Pin "${pin.label}" has an invalid side "${pin.side}".`);
    }
  }

  const cycleCheck = detectCustomICCycle(def.id, def.nodes ?? [], existingIcs);
  if (cycleCheck.hasCycle && cycleCheck.reason) {
    errors.push(cycleCheck.reason);
  }

  return { valid: errors.length === 0, errors };
}

export function collectReferencedCustomICs(
  nodes: CircuitNode[],
  customIcs: Record<string, CustomICDefinition>
): CustomICDefinition[] {
  const collected = new Map<string, CustomICDefinition>();
  const visit = (list: CircuitNode[], depth: number) => {
    if (depth > MAX_CUSTOM_IC_DEPTH) return;
    for (const node of list) {
      if (node.type === 'CUSTOM_IC' && node.customIcId) {
        const ic = customIcs[node.customIcId];
        if (ic && !collected.has(ic.id)) {
          collected.set(ic.id, ic);
          visit(ic.nodes, depth + 1);
        }
      }
    }
  };
  visit(nodes, 0);
  return Array.from(collected.values());
}

export function serializeCustomICToJSON(
  ic: CustomICDefinition,
  customIcs: Record<string, CustomICDefinition> = {}
): string {
  const dependencies = collectReferencedCustomICs(ic.nodes, customIcs).filter(
    (dep) => dep.id !== ic.id
  );
  return JSON.stringify(
    {
      format: 'chipcraft-custom-ic',
      schemaVersion: CUSTOM_IC_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      customIc: ic,
      dependencies,
    },
    null,
    2
  );
}

export function parseImportedCustomICJSON(
  rawText: string
):
  | { ok: true; customIc: CustomICDefinition; dependencies: CustomICDefinition[] }
  | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, error: 'Invalid JSON syntax. Select a valid .ic.json or .chipcraft.json file.' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Custom IC file root must be a JSON object.' };
  }

  const envelope = parsed as Record<string, unknown>;
  const candidate =
    envelope.format === 'chipcraft-custom-ic' &&
    envelope.customIc &&
    typeof envelope.customIc === 'object'
      ? (envelope.customIc as Record<string, unknown>)
      : envelope;

  const sanitizeDef = (obj: Record<string, unknown>): CustomICDefinition | null => {
    if (
      typeof obj.name !== 'string' ||
      !obj.name.trim() ||
      !Array.isArray(obj.pins) ||
      !Array.isArray(obj.nodes) ||
      !Array.isArray(obj.wires)
    ) {
      return null;
    }
    const now = Date.now();
    const rawId = typeof obj.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(obj.id)
      ? obj.id
      : `ic_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const pins = obj.pins as CustomICPinMapping[];
    const layout = recalculatePinLayout(pins);
    return {
      id: rawId,
      name: obj.name.trim(),
      shortName:
        typeof obj.shortName === 'string' && obj.shortName.trim()
          ? obj.shortName.trim().slice(0, 10)
          : obj.name.trim().slice(0, 6).toUpperCase(),
      description: typeof obj.description === 'string' ? obj.description : 'Imported custom IC',
      width: typeof obj.width === 'number' ? obj.width : layout.width,
      height: typeof obj.height === 'number' ? obj.height : layout.height,
      pins: layout.pins,
      nodes: obj.nodes as CircuitNode[],
      wires: obj.wires as CircuitWire[],
      createdAt: typeof obj.createdAt === 'number' ? obj.createdAt : now,
      updatedAt: now,
      schemaVersion: CUSTOM_IC_SCHEMA_VERSION,
    };
  };

  const mainIc = sanitizeDef(candidate);
  if (!mainIc) {
    return {
      ok: false,
      error: 'Custom IC file is missing required fields (name, pins, nodes, wires).',
    };
  }

  const dependencies: CustomICDefinition[] = [];
  if (Array.isArray(envelope.dependencies)) {
    for (const rawDep of envelope.dependencies) {
      if (rawDep && typeof rawDep === 'object') {
        const dep = sanitizeDef(rawDep as Record<string, unknown>);
        if (dep) dependencies.push(dep);
      }
    }
  }

  return { ok: true, customIc: mainIc, dependencies };
}
