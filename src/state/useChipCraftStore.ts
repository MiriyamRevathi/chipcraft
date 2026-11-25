import { create } from 'zustand';
import type {
  CircuitDocument,
  CircuitNode,
  CircuitWire,
  ComponentType,
  CustomICDefinition,
  ProjectRecord,
  SimulationResult,
  UserSettings,
  WaveformSample,
  WorkspaceId,
} from '../types/circuit';
import {
  COMPONENT_CATALOG,
  getNodePins,
  setActiveCustomICRegistry,
} from '../engine/gates/componentCatalog';
import { simulateCircuit } from '../engine/simulation/simulator';
import { validateNewConnection } from '../engine/validation/connectionValidator';
import {
  collectReferencedCustomICs,
  parseImportedCustomICJSON,
  validateCustomICDefinition,
  type ExternalBoundaryWireLink,
} from '../engine/subcircuit/customIcEngine';
import { BUILT_IN_EXAMPLES, cloneCircuitDocument, createBlankCircuit } from '../templates/circuitTemplates';
import {
  checkLocalFileBackend,
  clearAllCustomICs,
  clearAllProjects,
  CURRENT_SCHEMA_VERSION,
  deleteCustomIC as dbDeleteCustomIC,
  deleteProject as dbDeleteProject,
  listCustomICs,
  listProjects,
  loadCompletedChallenges,
  loadUserSettings,
  saveCompletedChallenge,
  saveCustomIC as dbSaveCustomIC,
  saveProject as dbSaveProject,
  saveUserSettings,
} from '../storage/projectStorage';
import { runClockBurstOffThread } from '../workers/workerClient';

export interface ToastNotice {
  id: string;
  tone: 'info' | 'success' | 'warning' | 'error';
  title: string;
  detail?: string;
}

interface HistorySnapshot {
  nodes: CircuitNode[];
  wires: CircuitWire[];
}

export interface ReplaceSelectionContext {
  absorbedNodeIds: string[];
  boundaryLinks: ExternalBoundaryWireLink[];
  centroid: { x: number; y: number };
}

interface ChipCraftState {
  workspace: WorkspaceId;
  commandPaletteOpen: boolean;
  mobileNavOpen: boolean;

  // Active Circuit Studio document & history
  circuit: CircuitDocument;
  activeProjectId: string | null;
  selectedNodeIds: string[];
  selectedWireId: string | null;
  clipboard: { nodes: CircuitNode[]; wires: CircuitWire[] } | null;
  past: HistorySnapshot[];
  future: HistorySnapshot[];

  // Live simulation state
  simRunning: boolean;
  clockHigh: boolean;
  clockHz: number;
  simTick: number;
  simulation: SimulationResult;
  waveforms: WaveformSample[];

  // Reusable Custom ICs
  customIcs: Record<string, CustomICDefinition>;
  customIcsLoaded: boolean;

  // Local projects & user state
  projects: ProjectRecord[];
  projectsLoaded: boolean;
  localDiskBackendAvailable: boolean;
  completedChallenges: string[];
  settings: UserSettings;
  toasts: ToastNotice[];

  // Cross-workspace shared buffers
  hdlCodeDraft: string;
  cpuAssemblyDraft: string;

  // Actions
  setWorkspace: (ws: WorkspaceId) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  pushToast: (toast: Omit<ToastNotice, 'id'>) => void;
  dismissToast: (id: string) => void;

  // Circuit actions
  loadCircuitDocument: (doc: CircuitDocument, projectId?: string | null) => void;
  newBlankCircuit: (name?: string) => void;
  renameCircuit: (name: string) => void;
  addNode: (type: ComponentType, x: number, y: number, customIcId?: string) => CircuitNode | null;
  moveNodes: (moves: Array<{ id: string; x: number; y: number }>, recordHistory?: boolean) => void;
  updateNode: (id: string, patch: Partial<CircuitNode>) => void;
  toggleNodeInput: (id: string, bitIndex?: number) => void;
  rotateSelectedNodes: () => void;
  deleteSelection: () => void;
  setSelection: (nodeIds: string[], wireId?: string | null) => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  duplicateSelection: () => void;
  connectPins: (fromNodeId: string, fromPinId: string, toNodeId: string, toPinId: string) => boolean;
  deleteWire: (wireId: string) => void;
  undo: () => void;
  redo: () => void;

  // Custom IC actions
  refreshCustomICs: () => Promise<void>;
  saveCustomICDefinition: (
    def: CustomICDefinition,
    replaceContext?: ReplaceSelectionContext
  ) => Promise<{ ok: true; ic: CustomICDefinition } | { ok: false; errors: string[] }>;
  importCustomICFromJSON: (
    rawText: string
  ) => Promise<{ ok: true; ic: CustomICDefinition } | { ok: false; error: string }>;
  removeCustomICDefinition: (id: string) => Promise<void>;

  // Simulation actions
  runSimulationStep: (toggleClock?: boolean) => void;
  runClockBurst: (ticks: number) => Promise<void>;
  setSimRunning: (running: boolean) => void;
  setClockHz: (hz: number) => void;
  resetSimulation: () => void;
  clearWaveforms: () => void;

  // Project library actions
  refreshProjects: () => Promise<void>;
  saveCurrentCircuitProject: (asNewName?: string) => Promise<ProjectRecord>;
  saveCustomProject: (project: Omit<ProjectRecord, 'schemaVersion' | 'updatedAt'>) => Promise<ProjectRecord>;
  removeProject: (id: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<void>;
  openProject: (project: ProjectRecord) => void;
  resetAllLocalData: () => Promise<void>;

  // Challenge & Settings actions
  markChallengeCompleted: (challengeId: string) => void;
  updateSettings: (patch: Partial<UserSettings>) => void;
  setHdlCodeDraft: (code: string) => void;
  setCpuAssemblyDraft: (asm: string) => void;
}

const initialCircuit = cloneCircuitDocument(BUILT_IN_EXAMPLES[3].document); // Half Adder as welcoming live default
const initialSimulation = simulateCircuit(initialCircuit.nodes, initialCircuit.wires, {
  clockHigh: false,
});

function captureWaveformSample(
  tick: number,
  circuit: CircuitDocument,
  sim: SimulationResult,
  customIcs: Record<string, CustomICDefinition>
): WaveformSample {
  const signals: WaveformSample['signals'] = {};
  for (const node of circuit.nodes) {
    const pins = getNodePins(node, customIcs);
    for (const pin of pins) {
      const key = `${node.id}:${pin.id}`;
      if (sim.pinValues[key]) {
        signals[key] = sim.pinValues[key];
      }
    }
  }
  return { tick, signals };
}

function snapCoord(v: number, settings: UserSettings): number {
  if (!settings.snapToGrid) return Math.round(v);
  return Math.round(v / settings.gridSize) * settings.gridSize;
}

function toCustomIcMap(list: CustomICDefinition[]): Record<string, CustomICDefinition> {
  const map: Record<string, CustomICDefinition> = {};
  for (const ic of list) {
    map[ic.id] = ic;
  }
  return map;
}

export const useChipCraftStore = create<ChipCraftState>((set, get) => ({
  workspace: 'home',
  commandPaletteOpen: false,
  mobileNavOpen: false,

  circuit: initialCircuit,
  activeProjectId: null,
  selectedNodeIds: [],
  selectedWireId: null,
  clipboard: null,
  past: [],
  future: [],

  simRunning: true,
  clockHigh: false,
  clockHz: loadUserSettings().defaultClockHz,
  simTick: 0,
  simulation: initialSimulation,
  waveforms: [captureWaveformSample(0, initialCircuit, initialSimulation, {})],

  customIcs: {},
  customIcsLoaded: false,

  projects: [],
  projectsLoaded: false,
  localDiskBackendAvailable: false,
  completedChallenges: loadCompletedChallenges(),
  settings: loadUserSettings(),
  toasts: [],

  hdlCodeDraft: '',
  cpuAssemblyDraft: '',

  setWorkspace: (workspace) => set({ workspace, mobileNavOpen: false }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),

  pushToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...toast, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4200);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  loadCircuitDocument: (doc, projectId = null) => {
    const customIcs = get().customIcs;
    const cloned = cloneCircuitDocument(doc);
    cloned.id = doc.id;
    const sim = simulateCircuit(cloned.nodes, cloned.wires, { clockHigh: false, customIcs });
    set({
      circuit: cloned,
      activeProjectId: projectId,
      selectedNodeIds: [],
      selectedWireId: null,
      past: [],
      future: [],
      clockHigh: false,
      simTick: 0,
      simulation: sim,
      waveforms: [captureWaveformSample(0, cloned, sim, customIcs)],
    });
  },

  newBlankCircuit: (name = 'Untitled Circuit') => {
    const doc = createBlankCircuit(name);
    get().loadCircuitDocument(doc, null);
    set({ workspace: 'circuit-studio' });
  },

  renameCircuit: (name) =>
    set((s) => ({
      circuit: { ...s.circuit, name, updatedAt: Date.now() },
    })),

  addNode: (type, x, y, customIcId) => {
    const state = get();
    if (type === 'CUSTOM_IC') {
      const ic = customIcId ? state.customIcs[customIcId] : undefined;
      if (!ic) {
        state.pushToast({
          tone: 'error',
          title: 'Custom IC not found',
          detail: 'Select a saved Custom IC from the library.',
        });
        return null;
      }
      const count =
        state.circuit.nodes.filter((n) => n.type === 'CUSTOM_IC' && n.customIcId === ic.id)
          .length + 1;
      const node: CircuitNode = {
        id: `icnode_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
        type: 'CUSTOM_IC',
        customIcId: ic.id,
        label: `${ic.shortName}${count}`,
        x: snapCoord(x, state.settings),
        y: snapCoord(y, state.settings),
        rotation: 0,
      };
      const nextNodes = [...state.circuit.nodes, node];
      const nextCircuit = { ...state.circuit, nodes: nextNodes, updatedAt: Date.now() };
      const sim = simulateCircuit(nextNodes, state.circuit.wires, {
        clockHigh: state.clockHigh,
        previousStates: state.simulation.nodeStates,
        customIcs: state.customIcs,
      });
      set({
        past: [...state.past.slice(-39), { nodes: state.circuit.nodes, wires: state.circuit.wires }],
        future: [],
        circuit: nextCircuit,
        selectedNodeIds: [node.id],
        selectedWireId: null,
        simulation: sim,
      });
      return node;
    }

    const spec = COMPONENT_CATALOG[type];
    const count = state.circuit.nodes.filter((n) => n.type === type).length + 1;
    const node: CircuitNode = {
      id: `${type.toLowerCase()}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      type,
      label: `${spec.shortName}${count}`,
      x: snapCoord(x, state.settings),
      y: snapCoord(y, state.settings),
      rotation: 0,
      value: 0,
      props: spec.defaultProps ? { ...spec.defaultProps } : undefined,
    };

    const nextNodes = [...state.circuit.nodes, node];
    const nextCircuit = { ...state.circuit, nodes: nextNodes, updatedAt: Date.now() };
    const sim = simulateCircuit(nextNodes, state.circuit.wires, {
      clockHigh: state.clockHigh,
      previousStates: state.simulation.nodeStates,
      customIcs: state.customIcs,
    });

    set({
      past: [...state.past.slice(-39), { nodes: state.circuit.nodes, wires: state.circuit.wires }],
      future: [],
      circuit: nextCircuit,
      selectedNodeIds: [node.id],
      selectedWireId: null,
      simulation: sim,
    });
    return node;
  },

  moveNodes: (moves, recordHistory = false) => {
    const state = get();
    const moveMap = new Map(moves.map((m) => [m.id, m]));
    const nextNodes = state.circuit.nodes.map((n) => {
      const m = moveMap.get(n.id);
      if (!m) return n;
      return {
        ...n,
        x: snapCoord(m.x, state.settings),
        y: snapCoord(m.y, state.settings),
      };
    });
    set({
      past: recordHistory
        ? [...state.past.slice(-39), { nodes: state.circuit.nodes, wires: state.circuit.wires }]
        : state.past,
      future: recordHistory ? [] : state.future,
      circuit: { ...state.circuit, nodes: nextNodes, updatedAt: Date.now() },
    });
  },

  updateNode: (id, patch) => {
    const state = get();
    const nextNodes = state.circuit.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n));
    const updatedNode = nextNodes.find((n) => n.id === id);
    const validPinIds = updatedNode
      ? new Set(getNodePins(updatedNode, state.customIcs).map((p) => p.id))
      : null;
    const nextWires = validPinIds
      ? state.circuit.wires.filter(
          (w) =>
            (w.fromNodeId !== id || validPinIds.has(w.fromPinId)) &&
            (w.toNodeId !== id || validPinIds.has(w.toPinId))
        )
      : state.circuit.wires;

    const nextCircuit = { ...state.circuit, nodes: nextNodes, wires: nextWires, updatedAt: Date.now() };
    const sim = simulateCircuit(nextNodes, nextWires, {
      clockHigh: state.clockHigh,
      previousStates: state.simulation.nodeStates,
      customIcs: state.customIcs,
    });
    const nextTick = state.simTick + 1;

    set({
      past: [...state.past.slice(-39), { nodes: state.circuit.nodes, wires: state.circuit.wires }],
      future: [],
      circuit: nextCircuit,
      simulation: sim,
      simTick: nextTick,
      waveforms: [
        ...state.waveforms.slice(-119),
        captureWaveformSample(nextTick, nextCircuit, sim, state.customIcs),
      ],
    });
  },

  toggleNodeInput: (id, bitIndex) => {
    const state = get();
    const node = state.circuit.nodes.find((n) => n.id === id);
    if (!node) return;
    let nextVal = node.value ?? 0;
    if (node.type === 'BINARY_INPUT' && bitIndex !== undefined) {
      nextVal = nextVal ^ (1 << bitIndex);
    } else if (node.type === 'TOGGLE_SWITCH' || node.type === 'PUSH_BUTTON') {
      nextVal = nextVal ? 0 : 1;
    } else {
      return;
    }
    const nextNodes = state.circuit.nodes.map((n) => (n.id === id ? { ...n, value: nextVal } : n));
    const nextCircuit = { ...state.circuit, nodes: nextNodes, updatedAt: Date.now() };
    const sim = simulateCircuit(nextNodes, state.circuit.wires, {
      clockHigh: state.clockHigh,
      previousStates: state.simulation.nodeStates,
      customIcs: state.customIcs,
    });
    const nextTick = state.simTick + 1;
    set({
      circuit: nextCircuit,
      simulation: sim,
      simTick: nextTick,
      waveforms: [
        ...state.waveforms.slice(-119),
        captureWaveformSample(nextTick, nextCircuit, sim, state.customIcs),
      ],
    });
  },

  rotateSelectedNodes: () => {
    const state = get();
    if (state.selectedNodeIds.length === 0) return;
    const selectedSet = new Set(state.selectedNodeIds);
    const nextNodes = state.circuit.nodes.map((n) => {
      if (!selectedSet.has(n.id)) return n;
      if (!COMPONENT_CATALOG[n.type].rotatable) return n;
      const nextRot = ((n.rotation + 90) % 360) as CircuitNode['rotation'];
      return { ...n, rotation: nextRot };
    });
    set({
      past: [...state.past.slice(-39), { nodes: state.circuit.nodes, wires: state.circuit.wires }],
      future: [],
      circuit: { ...state.circuit, nodes: nextNodes, updatedAt: Date.now() },
    });
  },

  deleteSelection: () => {
    const state = get();
    if (state.selectedNodeIds.length === 0 && !state.selectedWireId) return;
    const delSet = new Set(state.selectedNodeIds);
    const nextNodes = state.circuit.nodes.filter((n) => !delSet.has(n.id));
    const nextWires = state.circuit.wires.filter(
      (w) =>
        w.id !== state.selectedWireId &&
        !delSet.has(w.fromNodeId) &&
        !delSet.has(w.toNodeId)
    );
    const nextCircuit = { ...state.circuit, nodes: nextNodes, wires: nextWires, updatedAt: Date.now() };
    const sim = simulateCircuit(nextNodes, nextWires, {
      clockHigh: state.clockHigh,
      previousStates: state.simulation.nodeStates,
      customIcs: state.customIcs,
    });
    set({
      past: [...state.past.slice(-39), { nodes: state.circuit.nodes, wires: state.circuit.wires }],
      future: [],
      circuit: nextCircuit,
      selectedNodeIds: [],
      selectedWireId: null,
      simulation: sim,
    });
  },

  setSelection: (selectedNodeIds, selectedWireId = null) =>
    set({ selectedNodeIds, selectedWireId }),

  copySelection: () => {
    const state = get();
    if (state.selectedNodeIds.length === 0) return;
    const selSet = new Set(state.selectedNodeIds);
    const nodes = state.circuit.nodes.filter((n) => selSet.has(n.id)).map((n) => ({ ...n }));
    const wires = state.circuit.wires
      .filter((w) => selSet.has(w.fromNodeId) && selSet.has(w.toNodeId))
      .map((w) => ({ ...w }));
    set({ clipboard: { nodes, wires } });
    state.pushToast({
      tone: 'info',
      title: `Copied ${nodes.length} component${nodes.length > 1 ? 's' : ''}`,
    });
  },

  pasteClipboard: () => {
    const state = get();
    if (!state.clipboard || state.clipboard.nodes.length === 0) return;
    const idMap = new Map<string, string>();
    const newNodes: CircuitNode[] = state.clipboard.nodes.map((n, idx) => {
      const newId = `${n.type.toLowerCase()}_cp_${Date.now().toString(36)}_${idx}`;
      idMap.set(n.id, newId);
      return {
        ...n,
        id: newId,
        label: `${n.label}_copy`,
        x: n.x + 40,
        y: n.y + 40,
      };
    });
    const newWires: CircuitWire[] = state.clipboard.wires.map((w, idx) => ({
      ...w,
      id: `w_cp_${Date.now().toString(36)}_${idx}`,
      fromNodeId: idMap.get(w.fromNodeId) ?? w.fromNodeId,
      toNodeId: idMap.get(w.toNodeId) ?? w.toNodeId,
    }));

    const nextNodes = [...state.circuit.nodes, ...newNodes];
    const nextWires = [...state.circuit.wires, ...newWires];
    const nextCircuit = { ...state.circuit, nodes: nextNodes, wires: nextWires, updatedAt: Date.now() };
    const sim = simulateCircuit(nextNodes, nextWires, {
      clockHigh: state.clockHigh,
      previousStates: state.simulation.nodeStates,
      customIcs: state.customIcs,
    });
    set({
      past: [...state.past.slice(-39), { nodes: state.circuit.nodes, wires: state.circuit.wires }],
      future: [],
      circuit: nextCircuit,
      selectedNodeIds: newNodes.map((n) => n.id),
      selectedWireId: null,
      simulation: sim,
    });
  },

  duplicateSelection: () => {
    get().copySelection();
    get().pasteClipboard();
  },

  connectPins: (fromNodeId, fromPinId, toNodeId, toPinId) => {
    const state = get();
    const validation = validateNewConnection(
      state.circuit.nodes,
      state.circuit.wires,
      fromNodeId,
      fromPinId,
      toNodeId,
      toPinId,
      state.customIcs
    );
    if (!validation.valid || !validation.normalized) {
      state.pushToast({
        tone: 'error',
        title: validation.reason ?? 'Invalid wire connection',
        detail: validation.suggestion,
      });
      return false;
    }
    const newWire: CircuitWire = {
      id: `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      ...validation.normalized,
    };
    const nextWires = [...state.circuit.wires, newWire];
    const nextCircuit = { ...state.circuit, wires: nextWires, updatedAt: Date.now() };
    const sim = simulateCircuit(state.circuit.nodes, nextWires, {
      clockHigh: state.clockHigh,
      previousStates: state.simulation.nodeStates,
      customIcs: state.customIcs,
    });
    const nextTick = state.simTick + 1;
    set({
      past: [...state.past.slice(-39), { nodes: state.circuit.nodes, wires: state.circuit.wires }],
      future: [],
      circuit: nextCircuit,
      simulation: sim,
      simTick: nextTick,
      waveforms: [
        ...state.waveforms.slice(-119),
        captureWaveformSample(nextTick, nextCircuit, sim, state.customIcs),
      ],
    });
    return true;
  },

  deleteWire: (wireId) => {
    const state = get();
    const nextWires = state.circuit.wires.filter((w) => w.id !== wireId);
    const nextCircuit = { ...state.circuit, wires: nextWires, updatedAt: Date.now() };
    const sim = simulateCircuit(state.circuit.nodes, nextWires, {
      clockHigh: state.clockHigh,
      previousStates: state.simulation.nodeStates,
      customIcs: state.customIcs,
    });
    set({
      past: [...state.past.slice(-39), { nodes: state.circuit.nodes, wires: state.circuit.wires }],
      future: [],
      circuit: nextCircuit,
      selectedWireId: null,
      simulation: sim,
    });
  },

  undo: () => {
    const state = get();
    if (state.past.length === 0) return;
    const prev = state.past[state.past.length - 1];
    const nextCircuit = { ...state.circuit, nodes: prev.nodes, wires: prev.wires, updatedAt: Date.now() };
    const sim = simulateCircuit(prev.nodes, prev.wires, {
      clockHigh: state.clockHigh,
      previousStates: state.simulation.nodeStates,
      customIcs: state.customIcs,
    });
    set({
      past: state.past.slice(0, -1),
      future: [{ nodes: state.circuit.nodes, wires: state.circuit.wires }, ...state.future.slice(0, 39)],
      circuit: nextCircuit,
      simulation: sim,
      selectedNodeIds: [],
      selectedWireId: null,
    });
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;
    const next = state.future[0];
    const nextCircuit = { ...state.circuit, nodes: next.nodes, wires: next.wires, updatedAt: Date.now() };
    const sim = simulateCircuit(next.nodes, next.wires, {
      clockHigh: state.clockHigh,
      previousStates: state.simulation.nodeStates,
      customIcs: state.customIcs,
    });
    set({
      past: [...state.past.slice(-39), { nodes: state.circuit.nodes, wires: state.circuit.wires }],
      future: state.future.slice(1),
      circuit: nextCircuit,
      simulation: sim,
      selectedNodeIds: [],
      selectedWireId: null,
    });
  },

  // ================= CUSTOM IC ACTIONS =================
  refreshCustomICs: async () => {
    const list = await listCustomICs();
    const map = toCustomIcMap(list);
    setActiveCustomICRegistry(map);
    const state = get();
    const sim = simulateCircuit(state.circuit.nodes, state.circuit.wires, {
      clockHigh: state.clockHigh,
      previousStates: state.simulation.nodeStates,
      customIcs: map,
    });
    set({ customIcs: map, customIcsLoaded: true, simulation: sim });
  },

  saveCustomICDefinition: async (def, replaceContext) => {
    const state = get();
    const validation = validateCustomICDefinition(def, state.customIcs);
    if (!validation.valid) {
      state.pushToast({
        tone: 'error',
        title: 'Cannot package Custom IC',
        detail: validation.errors[0],
      });
      return { ok: false, errors: validation.errors };
    }

    const saved = await dbSaveCustomIC(def);
    const nextCustomIcs = { ...state.customIcs, [saved.id]: saved };
    setActiveCustomICRegistry(nextCustomIcs);

    if (replaceContext && replaceContext.absorbedNodeIds.length > 0) {
      const absorbedSet = new Set(replaceContext.absorbedNodeIds);
      const remainingNodes = state.circuit.nodes.filter((n) => !absorbedSet.has(n.id));
      const remainingWires = state.circuit.wires.filter(
        (w) => !absorbedSet.has(w.fromNodeId) && !absorbedSet.has(w.toNodeId)
      );

      const newNode: CircuitNode = {
        id: `icnode_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
        type: 'CUSTOM_IC',
        customIcId: saved.id,
        label: `${saved.shortName}1`,
        x: snapCoord(replaceContext.centroid.x, state.settings),
        y: snapCoord(replaceContext.centroid.y, state.settings),
        rotation: 0,
      };

      const reattachedWires: CircuitWire[] = [];
      replaceContext.boundaryLinks.forEach((link, idx) => {
        if (absorbedSet.has(link.externalNodeId)) return;
        if (link.direction === 'into-ic') {
          reattachedWires.push({
            id: `w_ic_${Date.now().toString(36)}_${idx}`,
            fromNodeId: link.externalNodeId,
            fromPinId: link.externalPinId,
            toNodeId: newNode.id,
            toPinId: link.customIcPinId,
          });
        } else {
          reattachedWires.push({
            id: `w_ic_${Date.now().toString(36)}_${idx}`,
            fromNodeId: newNode.id,
            fromPinId: link.customIcPinId,
            toNodeId: link.externalNodeId,
            toPinId: link.externalPinId,
          });
        }
      });

      const nextNodes = [...remainingNodes, newNode];
      const nextWires = [...remainingWires, ...reattachedWires];
      const nextCircuit = {
        ...state.circuit,
        nodes: nextNodes,
        wires: nextWires,
        updatedAt: Date.now(),
      };
      const sim = simulateCircuit(nextNodes, nextWires, {
        clockHigh: state.clockHigh,
        previousStates: state.simulation.nodeStates,
        customIcs: nextCustomIcs,
      });

      set({
        customIcs: nextCustomIcs,
        past: [...state.past.slice(-39), { nodes: state.circuit.nodes, wires: state.circuit.wires }],
        future: [],
        circuit: nextCircuit,
        selectedNodeIds: [newNode.id],
        selectedWireId: null,
        simulation: sim,
      });
    } else {
      set({ customIcs: nextCustomIcs });
    }

    state.pushToast({
      tone: 'success',
      title: `Packaged Custom IC "${saved.name}"`,
      detail: `${saved.pins.length} pins · Saved to local library and component palette.`,
    });
    return { ok: true, ic: saved };
  },

  importCustomICFromJSON: async (rawText) => {
    const parsed = parseImportedCustomICJSON(rawText);
    if (!parsed.ok) {
      get().pushToast({ tone: 'error', title: 'Custom IC Import Failed', detail: parsed.error });
      return { ok: false, error: parsed.error };
    }

    const currentMap = { ...get().customIcs };
    for (const dep of parsed.dependencies) {
      currentMap[dep.id] = dep;
    }

    const validation = validateCustomICDefinition(parsed.customIc, currentMap);
    if (!validation.valid) {
      const msg = validation.errors.join(' ');
      get().pushToast({ tone: 'error', title: 'Invalid Custom IC Definition', detail: msg });
      return { ok: false, error: msg };
    }

    for (const dep of parsed.dependencies) {
      await dbSaveCustomIC(dep);
    }
    const saved = await dbSaveCustomIC(parsed.customIc);
    currentMap[saved.id] = saved;
    setActiveCustomICRegistry(currentMap);
    set({ customIcs: currentMap });
    get().pushToast({
      tone: 'success',
      title: `Imported Custom IC "${saved.name}"`,
      detail: 'Available immediately in the Custom ICs component palette.',
    });
    return { ok: true, ic: saved };
  },

  removeCustomICDefinition: async (id) => {
    await dbDeleteCustomIC(id);
    const state = get();
    const nextMap = { ...state.customIcs };
    const removed = nextMap[id];
    delete nextMap[id];
    setActiveCustomICRegistry(nextMap);
    const sim = simulateCircuit(state.circuit.nodes, state.circuit.wires, {
      clockHigh: state.clockHigh,
      previousStates: state.simulation.nodeStates,
      customIcs: nextMap,
    });
    set({ customIcs: nextMap, simulation: sim });
    get().pushToast({
      tone: 'info',
      title: `Deleted Custom IC "${removed?.name ?? id}"`,
    });
  },

  // ================= SIMULATION =================
  runSimulationStep: (toggleClock = true) => {
    const state = get();
    const nextClock = toggleClock ? !state.clockHigh : state.clockHigh;
    const sim = simulateCircuit(state.circuit.nodes, state.circuit.wires, {
      clockHigh: nextClock,
      previousStates: state.simulation.nodeStates,
      customIcs: state.customIcs,
    });
    const nextTick = state.simTick + 1;
    set({
      clockHigh: nextClock,
      simTick: nextTick,
      simulation: sim,
      waveforms: [
        ...state.waveforms.slice(-119),
        captureWaveformSample(nextTick, state.circuit, sim, state.customIcs),
      ],
    });
  },

  runClockBurst: async (ticks) => {
    const state = get();
    const steps = await runClockBurstOffThread(
      state.circuit.nodes,
      state.circuit.wires,
      state.clockHigh,
      state.simulation.nodeStates,
      ticks,
      state.customIcs
    );
    if (steps.length === 0) return;

    const latest = get();
    let tick = latest.simTick;
    const addedSamples: WaveformSample[] = [];
    for (const step of steps) {
      tick += 1;
      addedSamples.push(captureWaveformSample(tick, latest.circuit, step.result, latest.customIcs));
    }
    const last = steps[steps.length - 1];
    set({
      clockHigh: last.clockHigh,
      simTick: tick,
      simulation: last.result,
      waveforms: [...latest.waveforms, ...addedSamples].slice(-120),
    });
  },

  setSimRunning: (simRunning) => set({ simRunning }),
  setClockHz: (clockHz) => set({ clockHz: Math.max(0.5, Math.min(20, clockHz)) }),

  resetSimulation: () => {
    const state = get();
    const sim = simulateCircuit(state.circuit.nodes, state.circuit.wires, {
      clockHigh: false,
      previousStates: {},
      customIcs: state.customIcs,
    });
    set({
      clockHigh: false,
      simTick: 0,
      simulation: sim,
      waveforms: [captureWaveformSample(0, state.circuit, sim, state.customIcs)],
    });
  },

  clearWaveforms: () => {
    const state = get();
    set({
      simTick: 0,
      waveforms: [captureWaveformSample(0, state.circuit, state.simulation, state.customIcs)],
    });
  },

  refreshProjects: async () => {
    const [projects, customIcList, health] = await Promise.all([
      listProjects(),
      listCustomICs(),
      checkLocalFileBackend(),
    ]);
    const customIcs = toCustomIcMap(customIcList);
    setActiveCustomICRegistry(customIcs);
    set({
      projects,
      projectsLoaded: true,
      customIcs,
      customIcsLoaded: true,
      localDiskBackendAvailable: health.available,
    });
  },

  saveCurrentCircuitProject: async (asNewName) => {
    const state = get();
    const now = Date.now();
    const id = asNewName
      ? `proj-${now}-${Math.random().toString(36).slice(2, 6)}`
      : state.activeProjectId ?? `proj-${now}`;
    const name = asNewName ?? state.circuit.name;
    const circuitCopy = { ...state.circuit, name, updatedAt: now };
    const embeddedCustomIcs = collectReferencedCustomICs(circuitCopy.nodes, state.customIcs);

    const record: ProjectRecord = {
      id,
      name,
      kind: 'circuit',
      description:
        circuitCopy.description ||
        `${circuitCopy.nodes.length} components, ${circuitCopy.wires.length} wires`,
      createdAt: circuitCopy.createdAt,
      updatedAt: now,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      circuit: circuitCopy,
      embeddedCustomIcs: embeddedCustomIcs.length > 0 ? embeddedCustomIcs : undefined,
    };

    const saved = await dbSaveProject(record);
    const projects = await listProjects();
    set({ circuit: circuitCopy, activeProjectId: saved.id, projects });
    state.pushToast({
      tone: 'success',
      title: `Saved "${saved.name}" locally`,
      detail: state.localDiskBackendAvailable
        ? 'Persisted to IndexedDB and local disk (./data/projects).'
        : 'Persisted in IndexedDB browser storage.',
    });
    return saved;
  },

  saveCustomProject: async (project) => {
    // Also restore any embedded custom ICs from imported projects
    if (project.embeddedCustomIcs && project.embeddedCustomIcs.length > 0) {
      const nextMap = { ...get().customIcs };
      for (const ic of project.embeddedCustomIcs) {
        if (!nextMap[ic.id]) {
          await dbSaveCustomIC(ic);
          nextMap[ic.id] = ic;
        }
      }
      setActiveCustomICRegistry(nextMap);
      set({ customIcs: nextMap });
    }

    const saved = await dbSaveProject({
      ...project,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      updatedAt: Date.now(),
    });
    const projects = await listProjects();
    set({ projects });
    get().pushToast({ tone: 'success', title: `Saved "${saved.name}" to Project Library` });
    return saved;
  },

  removeProject: async (id) => {
    await dbDeleteProject(id);
    const projects = await listProjects();
    set((s) => ({
      projects,
      activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
    }));
    get().pushToast({ tone: 'info', title: 'Project deleted from local storage' });
  },

  renameProject: async (id, name) => {
    const existing = get().projects.find((p) => p.id === id);
    if (!existing) return;
    await dbSaveProject({
      ...existing,
      name,
      circuit: existing.circuit ? { ...existing.circuit, name } : undefined,
    });
    const projects = await listProjects();
    set({ projects });
  },

  duplicateProject: async (id) => {
    const existing = get().projects.find((p) => p.id === id);
    if (!existing) return;
    const now = Date.now();
    const copy: ProjectRecord = {
      ...existing,
      id: `proj-${now}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${existing.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
      circuit: existing.circuit ? cloneCircuitDocument(existing.circuit, `${existing.name} (Copy)`) : undefined,
    };
    await dbSaveProject(copy);
    const projects = await listProjects();
    set({ projects });
    get().pushToast({ tone: 'success', title: `Duplicated "${existing.name}"` });
  },

  openProject: (project) => {
    if (project.embeddedCustomIcs && project.embeddedCustomIcs.length > 0) {
      const nextMap = { ...get().customIcs };
      let changed = false;
      for (const ic of project.embeddedCustomIcs) {
        if (!nextMap[ic.id]) {
          nextMap[ic.id] = ic;
          changed = true;
          void dbSaveCustomIC(ic);
        }
      }
      if (changed) {
        setActiveCustomICRegistry(nextMap);
        set({ customIcs: nextMap });
      }
    }

    if (project.kind === 'hdl' && project.hdlCode) {
      set({ hdlCodeDraft: project.hdlCode, workspace: 'hdl-studio' });
      return;
    }
    if (project.kind === 'cpu' && project.cpuAssembly) {
      set({ cpuAssemblyDraft: project.cpuAssembly, workspace: 'cpu-architect' });
      return;
    }
    if (project.kind === 'memory') {
      set({ workspace: 'memory-lab' });
      return;
    }
    if (project.circuit) {
      get().loadCircuitDocument(project.circuit, project.id);
      set({ workspace: 'circuit-studio' });
    }
  },

  resetAllLocalData: async () => {
    await Promise.all([clearAllProjects(), clearAllCustomICs()]);
    localStorage.removeItem('chipcraft_completed_challenges_v1');
    setActiveCustomICRegistry({});
    set({
      projects: [],
      customIcs: {},
      activeProjectId: null,
      completedChallenges: [],
    });
    get().pushToast({ tone: 'info', title: 'Cleared all locally stored projects, custom ICs, and progress' });
  },

  markChallengeCompleted: (challengeId) => {
    const updated = saveCompletedChallenge(challengeId);
    set({ completedChallenges: updated });
  },

  updateSettings: (patch) => {
    const next = { ...get().settings, ...patch };
    saveUserSettings(next);
    set({ settings: next, clockHz: patch.defaultClockHz ?? get().clockHz });
  },

  setHdlCodeDraft: (hdlCodeDraft) => set({ hdlCodeDraft }),
  setCpuAssemblyDraft: (cpuAssemblyDraft) => set({ cpuAssemblyDraft }),
}));
