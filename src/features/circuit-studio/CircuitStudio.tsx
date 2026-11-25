import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  StepForward,
  RotateCcw,
  Undo2,
  Redo2,
  Copy,
  ClipboardPaste,
  Files,
  RotateCw,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Save,
  Download,
  Upload,
  Search,
  ChevronLeft,
  ChevronRight,
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Plus,
  SaveAll,
  Table2,
  Cpu,
} from 'lucide-react';
import { useChipCraftStore } from '../../state/useChipCraftStore';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  COMPONENT_CATALOG,
  getNodePins,
} from '../../engine/gates/componentCatalog';
import type { ComponentCategory, ComponentType, CustomICDefinition } from '../../types/circuit';
import { BUILT_IN_EXAMPLES } from '../../templates/circuitTemplates';
import { formatBusBinary, formatBusHex, primarySignal, signalChar } from '../../engine/signals/signalModel';
import { analyzeCircuitTruthTable } from '../../engine/simulation/truthTableAnalyzer';
import {
  collectReferencedCustomICs,
  extractSubcircuitDraft,
  serializeCustomICToJSON,
  type SubcircuitDraftResult,
} from '../../engine/subcircuit/customIcEngine';
import { serializeProjectToJSON, CURRENT_SCHEMA_VERSION } from '../../storage/projectStorage';
import { Button, SegmentedTabs, SignalReadout } from '../../design-system/ui';
import { CircuitCanvas } from './CircuitCanvas';
import { PackageCustomICModal } from './PackageCustomICModal';

export function CircuitStudio() {
  const circuit = useChipCraftStore((s) => s.circuit);
  const simulation = useChipCraftStore((s) => s.simulation);
  const settings = useChipCraftStore((s) => s.settings);
  const selectedNodeIds = useChipCraftStore((s) => s.selectedNodeIds);
  const selectedWireId = useChipCraftStore((s) => s.selectedWireId);
  const pastCount = useChipCraftStore((s) => s.past.length);
  const futureCount = useChipCraftStore((s) => s.future.length);
  const simRunning = useChipCraftStore((s) => s.simRunning);
  const clockHigh = useChipCraftStore((s) => s.clockHigh);
  const clockHz = useChipCraftStore((s) => s.clockHz);
  const simTick = useChipCraftStore((s) => s.simTick);

  const renameCircuit = useChipCraftStore((s) => s.renameCircuit);
  const addNode = useChipCraftStore((s) => s.addNode);
  const moveNodes = useChipCraftStore((s) => s.moveNodes);
  const updateNode = useChipCraftStore((s) => s.updateNode);
  const toggleNodeInput = useChipCraftStore((s) => s.toggleNodeInput);
  const rotateSelectedNodes = useChipCraftStore((s) => s.rotateSelectedNodes);
  const deleteSelection = useChipCraftStore((s) => s.deleteSelection);
  const setSelection = useChipCraftStore((s) => s.setSelection);
  const copySelection = useChipCraftStore((s) => s.copySelection);
  const pasteClipboard = useChipCraftStore((s) => s.pasteClipboard);
  const duplicateSelection = useChipCraftStore((s) => s.duplicateSelection);
  const connectPins = useChipCraftStore((s) => s.connectPins);
  const deleteWire = useChipCraftStore((s) => s.deleteWire);
  const undo = useChipCraftStore((s) => s.undo);
  const redo = useChipCraftStore((s) => s.redo);
  const runSimulationStep = useChipCraftStore((s) => s.runSimulationStep);
  const setSimRunning = useChipCraftStore((s) => s.setSimRunning);
  const setClockHz = useChipCraftStore((s) => s.setClockHz);
  const resetSimulation = useChipCraftStore((s) => s.resetSimulation);
  const saveCurrentCircuitProject = useChipCraftStore((s) => s.saveCurrentCircuitProject);
  const loadCircuitDocument = useChipCraftStore((s) => s.loadCircuitDocument);
  const newBlankCircuit = useChipCraftStore((s) => s.newBlankCircuit);
  const customIcs = useChipCraftStore((s) => s.customIcs);
  const saveCustomICDefinition = useChipCraftStore((s) => s.saveCustomICDefinition);
  const importCustomICFromJSON = useChipCraftStore((s) => s.importCustomICFromJSON);
  const removeCustomICDefinition = useChipCraftStore((s) => s.removeCustomICDefinition);
  const setWorkspace = useChipCraftStore((s) => s.setWorkspace);
  const pushToast = useChipCraftStore((s) => s.pushToast);

  const [libSearch, setLibSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ComponentCategory | 'all'>('all');
  const [leftOpen, setLeftOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 1024
  );
  const [rightOpen, setRightOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 1200
  );
  const [inspectorTab, setInspectorTab] = useState<'properties' | 'truth'>('properties');
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const [packageDraft, setPackageDraft] = useState<SubcircuitDraftResult | null>(null);
  const icImportInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!saveAsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSaveAsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveAsOpen]);

  const truthTable = useMemo(
    () => (inspectorTab === 'truth' ? analyzeCircuitTruthTable(circuit, customIcs) : null),
    [circuit, customIcs, inspectorTab]
  );

  const viewportApiRef = useRef<{
    zoomIn: () => void;
    zoomOut: () => void;
    fitToView: () => void;
    getZoom: () => number;
  } | null>(null);

  const filteredComponents = useMemo(() => {
    const q = libSearch.trim().toLowerCase();
    return Object.values(COMPONENT_CATALOG).filter((spec) => {
      if (spec.type === 'CUSTOM_IC') return false;
      if (activeCategory !== 'all' && spec.category !== activeCategory) return false;
      if (!q) return true;
      return (
        spec.name.toLowerCase().includes(q) ||
        spec.shortName.toLowerCase().includes(q) ||
        spec.description.toLowerCase().includes(q)
      );
    });
  }, [libSearch, activeCategory]);

  const filteredCustomIcs = useMemo(() => {
    if (activeCategory !== 'all' && activeCategory !== 'custom') return [];
    const q = libSearch.trim().toLowerCase();
    return Object.values(customIcs)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .filter((ic) => {
        if (!q) return true;
        return (
          ic.name.toLowerCase().includes(q) ||
          ic.shortName.toLowerCase().includes(q) ||
          ic.description.toLowerCase().includes(q)
        );
      });
  }, [customIcs, libSearch, activeCategory]);

  const selectedNode = useMemo(
    () =>
      selectedNodeIds.length === 1
        ? circuit.nodes.find((n) => n.id === selectedNodeIds[0]) ?? null
        : null,
    [circuit.nodes, selectedNodeIds]
  );

  const selectedCustomIcDef = useMemo(
    () => (selectedNode?.customIcId ? customIcs[selectedNode.customIcId] ?? null : null),
    [selectedNode, customIcs]
  );

  const selectedWire = useMemo(
    () => (selectedWireId ? circuit.wires.find((w) => w.id === selectedWireId) ?? null : null),
    [circuit.wires, selectedWireId]
  );

  const errorCount = simulation.issues.filter((i) => i.severity === 'error').length;
  const warningCount = simulation.issues.filter((i) => i.severity === 'warning').length;

  const handleQuickAdd = (type: ComponentType, customIcId?: string) => {
    const offset = (circuit.nodes.length % 6) * 24;
    addNode(type, 220 + offset, 140 + offset, customIcId);
  };

  const handleOpenPackageModal = () => {
    const targetIds =
      selectedNodeIds.length > 0 ? selectedNodeIds : circuit.nodes.map((n) => n.id);
    if (targetIds.length === 0) {
      pushToast({
        tone: 'warning',
        title: 'Nothing to package',
        detail: 'Place components on the canvas or select a subcircuit first.',
      });
      return;
    }
    const result = extractSubcircuitDraft(circuit, targetIds, customIcs, `${circuit.name} IC`);
    if (!result.ok) {
      pushToast({
        tone: 'error',
        title: 'Cannot package subcircuit',
        detail: result.error,
      });
      return;
    }
    setPackageDraft(result);
  };

  const handleExportCustomIc = (ic: CustomICDefinition) => {
    const json = serializeCustomICToJSON(ic, customIcs);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ic.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'custom-ic'}.chipcraft-ic.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast({ tone: 'success', title: `Exported Custom IC "${ic.name}"` });
  };

  const handleImportCustomIcFile = async (file: File) => {
    try {
      const text = await file.text();
      await importCustomICFromJSON(text);
    } catch {
      pushToast({ tone: 'error', title: 'Failed to read Custom IC file' });
    }
  };

  const handleExportJson = () => {
    const embeddedCustomIcs = collectReferencedCustomICs(circuit.nodes, customIcs);
    const json = serializeProjectToJSON({
      id: circuit.id,
      name: circuit.name,
      kind: 'circuit',
      description: circuit.description,
      createdAt: circuit.createdAt,
      updatedAt: Date.now(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      circuit,
      embeddedCustomIcs: embeddedCustomIcs.length > 0 ? embeddedCustomIcs : undefined,
    });
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${circuit.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'circuit'}.chipcraft.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast({ tone: 'success', title: `Exported "${circuit.name}.chipcraft.json"` });
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#F7F5FF] overflow-hidden">
      {/* Top CAD Toolbar */}
      <div className="shrink-0 bg-white border-b border-[#E4DFF7] px-3 py-2 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setLeftOpen((o) => !o)}
            title={leftOpen ? 'Hide component library' : 'Show component library'}
            className="p-1.5 text-[#475569] hover:text-[#141226] hover:bg-[#F1EEFC] rounded cursor-pointer"
          >
            {leftOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          <input
            type="text"
            value={circuit.name}
            onChange={(e) => renameCircuit(e.target.value)}
            aria-label="Circuit name"
            className="text-sm font-semibold text-[#141226] bg-transparent hover:bg-[#F7F5FF] focus:bg-white border border-transparent focus:border-[#5B4CE6] rounded px-2 py-1 w-40 sm:w-52 focus:outline-none"
          />

          <select
            aria-label="Load example circuit"
            defaultValue=""
            onChange={(e) => {
              const val = e.target.value;
              if (val === '__blank__') {
                newBlankCircuit();
              } else {
                const ex = BUILT_IN_EXAMPLES.find((x) => x.id === val);
                if (ex) loadCircuitDocument(ex.document, null);
              }
              e.target.value = '';
            }}
            className="text-xs text-[#334155] bg-[#F7F5FF] border border-[#E4DFF7] rounded-md px-2 py-1.5 cursor-pointer focus:outline-none focus:border-[#5B4CE6]"
          >
            <option value="" disabled>
              Load Template...
            </option>
            <option value="__blank__">+ Blank Circuit</option>
            {BUILT_IN_EXAMPLES.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name} ({ex.category})
              </option>
            ))}
          </select>
        </div>

        {/* Edit & Viewport Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={undo} disabled={pastCount === 0} title="Undo (Ctrl+Z)">
            <Undo2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={redo} disabled={futureCount === 0} title="Redo (Ctrl+Y)">
            <Redo2 className="w-3.5 h-3.5" />
          </Button>
          <span className="w-px h-4 bg-[#E4DFF7] mx-1" aria-hidden="true" />
          <Button
            variant="ghost"
            size="sm"
            onClick={copySelection}
            disabled={selectedNodeIds.length === 0}
            title="Copy (Ctrl+C)"
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={pasteClipboard} title="Paste (Ctrl+V)">
            <ClipboardPaste className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={duplicateSelection}
            disabled={selectedNodeIds.length === 0}
            title="Duplicate (Ctrl+D)"
          >
            <Files className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={rotateSelectedNodes}
            disabled={selectedNodeIds.length === 0}
            title="Rotate 90° (R)"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={deleteSelection}
            disabled={selectedNodeIds.length === 0 && !selectedWireId}
            title="Delete selection (Del)"
          >
            <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
          </Button>
          <span className="w-px h-4 bg-[#E4DFF7] mx-1" aria-hidden="true" />
          <Button variant="ghost" size="sm" onClick={() => viewportApiRef.current?.zoomOut()} title="Zoom out">
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => viewportApiRef.current?.zoomIn()} title="Zoom in">
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => viewportApiRef.current?.fitToView()} title="Fit circuit">
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Package IC, Save, Save As & Export */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenPackageModal}
            disabled={circuit.nodes.length === 0}
            title={
              selectedNodeIds.length > 0
                ? `Package ${selectedNodeIds.length} selected component(s) as reusable Custom IC`
                : 'Package current circuit as reusable Custom IC'
            }
          >
            <Cpu className="w-3.5 h-3.5 text-[#5B4CE6]" />
            <span>Package IC</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportJson} title="Export JSON">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Export</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSaveAsName(`${circuit.name} Copy`);
              setSaveAsOpen(true);
            }}
            title="Save a copy under a new name"
          >
            <SaveAll className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Save As</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void saveCurrentCircuitProject()}
            title="Save locally in IndexedDB and disk storage"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save</span>
          </Button>
          <button
            type="button"
            onClick={() => setRightOpen((o) => !o)}
            title={rightOpen ? 'Hide inspector' : 'Show inspector'}
            aria-label={rightOpen ? 'Hide inspector panel' : 'Show inspector panel'}
            className="p-1.5 text-[#5B587A] hover:text-[#141226] hover:bg-[#F3F0FF] rounded cursor-pointer"
          >
            {rightOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Inline Save As Modal */}
      {saveAsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#141226]/35 px-4"
          onClick={() => setSaveAsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-as-title"
        >
          <div
            className="w-full max-w-sm bg-white border border-[#E4DFF7] rounded-xl shadow-lg p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 id="save-as-title" className="text-sm font-bold text-[#141226]">
                Save Circuit As
              </h3>
              <p className="text-xs text-[#5B587A] mt-0.5">
                Creates a new local copy persisted in IndexedDB and local disk storage.
              </p>
            </div>
            <input
              type="text"
              value={saveAsName}
              onChange={(e) => setSaveAsName(e.target.value)}
              aria-label="New circuit name"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && saveAsName.trim()) {
                  void saveCurrentCircuitProject(saveAsName.trim());
                  setSaveAsOpen(false);
                }
              }}
              autoFocus
              className="w-full px-3 py-2 text-sm bg-[#F7F5FF] border border-[#E4DFF7] rounded-md focus:outline-none focus:border-[#5B4CE6]"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSaveAsOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!saveAsName.trim()}
                onClick={() => {
                  void saveCurrentCircuitProject(saveAsName.trim());
                  setSaveAsOpen(false);
                }}
              >
                Save Copy
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Package Custom IC Modal */}
      {packageDraft && (
        <PackageCustomICModal
          draftResult={packageDraft}
          existingCustomIcs={customIcs}
          onClose={() => setPackageDraft(null)}
          onSave={async (def, replaceSelection) => {
            await saveCustomICDefinition(
              def,
              replaceSelection
                ? {
                    absorbedNodeIds: packageDraft.absorbedNodeIds,
                    boundaryLinks: packageDraft.boundaryLinks,
                    centroid: packageDraft.centroid,
                  }
                : undefined
            );
          }}
        />
      )}

      {/* Main 3-Column Studio Body */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* LEFT PANEL: Component Library */}
        {leftOpen && (
          <aside className="w-64 shrink-0 bg-white border-r border-[#E4DFF7] flex flex-col min-h-0">
            <div className="p-3 border-b border-[#E4DFF7] space-y-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={libSearch}
                  onChange={(e) => setLibSearch(e.target.value)}
                  placeholder="Search 41 components..."
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-[#F7F5FF] border border-[#E4DFF7] rounded-md text-[#141226] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#5B4CE6]"
                />
              </div>

              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  className={`px-2 py-1 text-[11px] font-medium rounded cursor-pointer ${
                    activeCategory === 'all'
                      ? 'bg-[#5B4CE6] text-white'
                      : 'bg-[#F1EEFC] text-[#475569] hover:text-[#141226]'
                  }`}
                >
                  All
                </button>
                {CATEGORY_ORDER.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2 py-1 text-[11px] font-medium rounded cursor-pointer ${
                      activeCategory === cat
                        ? 'bg-[#5B4CE6] text-white'
                        : 'bg-[#F1EEFC] text-[#475569] hover:text-[#141226]'
                    }`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {/* Custom ICs Palette Section */}
              {(activeCategory === 'all' || activeCategory === 'custom') && (
                <div className="mb-2 pb-2 border-b border-[#F1EEFC] space-y-1">
                  <div className="px-2 py-1 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-[#5B4CE6]">
                      Custom ICs ({Object.keys(customIcs).length})
                    </span>
                    <input
                      ref={icImportInputRef}
                      type="file"
                      accept=".json,application/json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleImportCustomIcFile(file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => icImportInputRef.current?.click()}
                      title="Import Custom IC JSON file"
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-[#5B4CE6] hover:underline cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      Import IC
                    </button>
                  </div>

                  {filteredCustomIcs.length === 0 ? (
                    <div className="px-2.5 py-2 text-[11px] text-[#5B587A] bg-[#FAF9FF] border border-dashed border-[#E4DFF7] rounded-md">
                      {Object.keys(customIcs).length === 0
                        ? 'No custom ICs saved yet. Click "Package IC" in the toolbar to create one.'
                        : `No custom ICs match "${libSearch}".`}
                    </div>
                  ) : (
                    filteredCustomIcs.map((ic) => (
                      <div
                        key={ic.id}
                        draggable
                        data-custom-ic-palette={ic.id}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/chipcraft-custom-ic', ic.id);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => handleQuickAdd('CUSTOM_IC', ic.id)}
                        className="group flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-md border border-[#E4DFF7] bg-[#FAF9FF] hover:border-[#5B4CE6] hover:bg-[#F2EFFF] cursor-grab active:cursor-grabbing transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#141226] truncate flex items-center gap-1.5">
                            <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-[#EDE9FE] text-[#4A3BD6]">
                              {ic.shortName}
                            </span>
                            <span className="truncate">{ic.name}</span>
                          </div>
                          <div className="text-[10px] text-[#5B587A] truncate mt-0.5">
                            {ic.pins.length} pins · {ic.nodes.length} internal parts
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportCustomIc(ic);
                            }}
                            title={`Export ${ic.name} as JSON`}
                            aria-label={`Export Custom IC ${ic.name}`}
                            className="p-1 text-[#5B587A] hover:text-[#5B4CE6] rounded cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void removeCustomICDefinition(ic.id);
                            }}
                            title={`Delete ${ic.name}`}
                            aria-label={`Delete Custom IC ${ic.name}`}
                            className="p-1 text-[#5B587A] hover:text-[#DC2626] rounded cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {filteredComponents.map((spec) => (
                <div
                  key={spec.type}
                  draggable
                  data-palette-component={spec.type}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/chipcraft-component', spec.type);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => handleQuickAdd(spec.type)}
                  className="group flex items-center justify-between gap-2 px-2.5 py-2 rounded-md border border-transparent hover:border-[#E4DFF7] hover:bg-[#F7F5FF] cursor-grab active:cursor-grabbing transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[#141226] truncate">{spec.name}</div>
                    <div className="text-[11px] text-[#64748B] truncate">
                      {CATEGORY_LABELS[spec.category]} · {spec.pins.length} pins
                    </div>
                  </div>
                  <span
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#5B4CE6] transition-opacity"
                    title="Click or drag onto canvas"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </span>
                </div>
              ))}
              {filteredComponents.length === 0 && filteredCustomIcs.length === 0 && (
                <div className="p-4 text-center text-xs text-[#64748B]">
                  No components match "{libSearch}".
                </div>
              )}
            </div>
          </aside>
        )}

        {/* CENTER: Interactive Schematic Canvas */}
        <div className="flex-1 min-w-0 h-full relative">
          <CircuitCanvas
            circuit={circuit}
            simulation={simulation}
            settings={settings}
            selectedNodeIds={selectedNodeIds}
            selectedWireId={selectedWireId}
            onSelect={setSelection}
            onAddNode={(t, x, y, customIcId) => {
              addNode(t, x, y, customIcId);
            }}
            onMoveNodes={moveNodes}
            onConnectPins={connectPins}
            onToggleInput={toggleNodeInput}
            onDeleteSelection={deleteSelection}
            onRotateSelection={rotateSelectedNodes}
            onCopy={copySelection}
            onPaste={pasteClipboard}
            onDuplicate={duplicateSelection}
            onUndo={undo}
            onRedo={redo}
            viewportApiRef={viewportApiRef}
          />
        </div>

        {/* RIGHT PANEL: Properties & Truth Table Inspector */}
        {rightOpen && (
          <aside className="w-72 shrink-0 bg-white border-l border-[#E4DFF7] flex flex-col min-h-0 overflow-y-auto">
            <div className="px-3 py-2.5 border-b border-[#E4DFF7] flex items-center justify-between gap-2">
              <SegmentedTabs
                value={inspectorTab}
                onChange={setInspectorTab}
                className="w-full justify-between"
                options={[
                  { value: 'properties', label: 'Inspector' },
                  { value: 'truth', label: 'Truth Table' },
                ]}
              />
            </div>

            {inspectorTab === 'truth' && truthTable ? (
              <div className="p-3.5 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#141226]">
                  <Table2 className="w-3.5 h-3.5 text-[#5B4CE6]" />
                  <span>Live Circuit Truth Table</span>
                </div>
                {truthTable.reason ? (
                  <p className="text-xs text-[#5B587A] leading-relaxed">{truthTable.reason}</p>
                ) : (
                  <>
                    <p className="text-[11px] text-[#5B587A]">
                      Evaluated deterministically across {truthTable.rows.length} switch states.
                      {truthTable.truncated ? ' (Showing first 5 switch inputs.)' : ''}
                    </p>
                    <div className="overflow-x-auto border border-[#E4DFF7] rounded-md">
                      <table className="w-full text-[11px] font-mono tabular-nums">
                        <thead className="bg-[#F7F5FF] text-[#5B587A]">
                          <tr>
                            {truthTable.inputLabels.map((lbl) => (
                              <th key={lbl} className="py-1.5 px-2 text-center border-b border-[#E4DFF7]">
                                {lbl}
                              </th>
                            ))}
                            {truthTable.outputLabels.map((lbl) => (
                              <th
                                key={lbl}
                                className="py-1.5 px-2 text-center border-b border-[#E4DFF7] text-[#5B4CE6]"
                              >
                                {lbl}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F1EEFC]">
                          {truthTable.rows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-[#F7F5FF]">
                              {truthTable.inputLabels.map((lbl) => (
                                <td key={lbl} className="py-1 px-2 text-center text-[#3D3A57]">
                                  {row.inputs[lbl]}
                                </td>
                              ))}
                              {truthTable.outputLabels.map((lbl) => {
                                const st = row.outputs[lbl];
                                return (
                                  <td
                                    key={lbl}
                                    className={`py-1 px-2 text-center font-bold ${
                                      st === 'HIGH'
                                        ? 'text-[#16A34A]'
                                        : st === 'ERROR'
                                          ? 'text-[#DC2626]'
                                          : st === 'UNKNOWN'
                                            ? 'text-[#B45309]'
                                            : 'text-[#64748B]'
                                    }`}
                                  >
                                    {signalChar(st)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            ) : selectedNode ? (
              <div className="p-4 space-y-5">
                <div>
                  <div className="text-sm font-semibold text-[#141226]">
                    {selectedNode.type === 'CUSTOM_IC' && selectedCustomIcDef
                      ? selectedCustomIcDef.name
                      : COMPONENT_CATALOG[selectedNode.type].name}
                  </div>
                  <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                    {selectedNode.type === 'CUSTOM_IC' && selectedCustomIcDef
                      ? selectedCustomIcDef.description ||
                        `Reusable custom subcircuit (${selectedCustomIcDef.nodes.length} internal components, ${selectedCustomIcDef.wires.length} internal wires).`
                      : COMPONENT_CATALOG[selectedNode.type].description}
                  </p>
                  {selectedNode.type === 'CUSTOM_IC' && selectedCustomIcDef && (
                    <div className="mt-2 px-2.5 py-2 bg-[#FAF9FF] border border-[#E4DFF7] rounded-md text-[11px] font-mono text-[#4E4A6D] space-y-0.5">
                      <div>Chip ID: {selectedCustomIcDef.shortName}</div>
                      <div>
                        Internal: {selectedCustomIcDef.nodes.length} parts ·{' '}
                        {selectedCustomIcDef.wires.length} wires
                      </div>
                      <button
                        type="button"
                        onClick={() => handleExportCustomIc(selectedCustomIcDef)}
                        className="mt-1 inline-flex items-center gap-1 text-[#5B4CE6] hover:underline font-sans font-medium cursor-pointer"
                      >
                        <Download className="w-3 h-3" /> Export IC JSON
                      </button>
                    </div>
                  )}
                </div>

                {/* Label & Position */}
                <div className="space-y-3">
                  <label className="block">
                    <span className="block text-xs font-medium text-[#475569] mb-1">
                      Component Label
                    </span>
                    <input
                      type="text"
                      value={selectedNode.label}
                      onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#F7F5FF] border border-[#E4DFF7] rounded-md focus:outline-none focus:border-[#5B4CE6]"
                    />
                  </label>

                  {COMPONENT_CATALOG[selectedNode.type].configurableInputs && (
                    <label className="block">
                      <span className="block text-xs font-medium text-[#475569] mb-1">
                        Input Pins (2–4)
                      </span>
                      <select
                        value={selectedNode.inputCount ?? 2}
                        onChange={(e) =>
                          updateNode(selectedNode.id, { inputCount: Number(e.target.value) })
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#F7F5FF] border border-[#E4DFF7] rounded-md"
                      >
                        <option value={2}>2 inputs (A, B)</option>
                        <option value={3}>3 inputs (A, B, C)</option>
                        <option value={4}>4 inputs (A, B, C, D)</option>
                      </select>
                    </label>
                  )}

                  {selectedNode.type === 'TOGGLE_SWITCH' && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-medium text-[#475569]">Logic State</span>
                      <Button
                        size="sm"
                        variant={selectedNode.value ? 'primary' : 'secondary'}
                        onClick={() => toggleNodeInput(selectedNode.id)}
                      >
                        {selectedNode.value ? 'HIGH (1)' : 'LOW (0)'}
                      </Button>
                    </div>
                  )}

                  {selectedNode.type === 'BINARY_INPUT' && (
                    <label className="block">
                      <span className="block text-xs font-medium text-[#475569] mb-1">
                        4-Bit Value (0–15)
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={15}
                        value={selectedNode.value ?? 0}
                        onChange={(e) =>
                          updateNode(selectedNode.id, {
                            value: Math.max(0, Math.min(15, Number(e.target.value) || 0)),
                          })
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#F7F5FF] border border-[#E4DFF7] rounded-md"
                      />
                    </label>
                  )}

                  {selectedNode.type === 'ROM_16X4' && (
                    <div>
                      <div className="text-xs font-medium text-[#475569] mb-1.5">
                        ROM Lookup Table (16 × 4-bit hex)
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {Array.from({ length: 16 }, (_, addr) => {
                          const table = Array.isArray(selectedNode.props?.data)
                            ? (selectedNode.props.data as number[])
                            : Array.from({ length: 16 }, (_, i) => i);
                          const val = (table[addr] ?? 0) & 0x0f;
                          return (
                            <label
                              key={addr}
                              className="flex flex-col text-[10px] font-mono text-[#64748B]"
                            >
                              <span>{addr.toString(16).toUpperCase()}:</span>
                              <input
                                type="text"
                                maxLength={1}
                                value={val.toString(16).toUpperCase()}
                                onChange={(e) => {
                                  const parsed = parseInt(e.target.value, 16);
                                  const next = [...table];
                                  next[addr] = Number.isNaN(parsed) ? 0 : parsed & 0x0f;
                                  updateNode(selectedNode.id, {
                                    props: { ...selectedNode.props, data: next },
                                  });
                                }}
                                className="px-1.5 py-1 text-xs font-mono text-center bg-[#F7F5FF] border border-[#E4DFF7] rounded"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Live Pin States */}
                <div className="border-t border-[#E4DFF7] pt-4">
                  <div className="text-xs font-semibold text-[#141226] mb-2">Live Pin Signals</div>
                  <div className="divide-y divide-[#F1EEFC]">
                    {getNodePins(selectedNode, customIcs).map((pin) => {
                      const bus = simulation.pinValues[`${selectedNode.id}:${pin.id}`];
                      const sig = primarySignal(bus);
                      return (
                        <div key={pin.id} className="py-1.5 flex items-center justify-between gap-2">
                          <div className="text-xs font-mono text-[#334155]">
                            {pin.label}{' '}
                            <span className="text-[#94A3B8]">
                              ({pin.direction === 'input' ? 'IN' : 'OUT'}
                              {pin.width > 1 ? ` ${pin.width}b` : ''})
                            </span>
                          </div>
                          {pin.width > 1 ? (
                            <span className="font-mono text-xs text-[#141226] tabular-nums">
                              {formatBusBinary(bus)} · {formatBusHex(bus)}
                            </span>
                          ) : (
                            <SignalReadout state={sig} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : selectedWire ? (
              <div className="p-4 space-y-4">
                <div className="text-sm font-semibold text-[#141226]">Wire Connection</div>
                <div className="text-xs font-mono text-[#475569] space-y-1">
                  <div>
                    From:{' '}
                    <span className="text-[#141226]">
                      {circuit.nodes.find((n) => n.id === selectedWire.fromNodeId)?.label}.
                      {selectedWire.fromPinId}
                    </span>
                  </div>
                  <div>
                    To:{' '}
                    <span className="text-[#141226]">
                      {circuit.nodes.find((n) => n.id === selectedWire.toNodeId)?.label}.
                      {selectedWire.toPinId}
                    </span>
                  </div>
                  <div className="pt-2">
                    Live Signal:{' '}
                    <SignalReadout state={primarySignal(simulation.wireValues[selectedWire.id])} />
                  </div>
                </div>
                <Button variant="danger" size="sm" onClick={() => deleteWire(selectedWire.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                  Disconnect Wire
                </Button>
              </div>
            ) : (
              <div className="p-4 space-y-4 text-xs text-[#64748B]">
                <p>Select a component or wire on the canvas to inspect live pin signals and edit properties.</p>
                <div className="border-t border-[#E4DFF7] pt-3 space-y-2">
                  <div className="font-semibold text-[#141226]">Circuit Summary</div>
                  <div className="flex justify-between font-mono tabular-nums">
                    <span>Components</span>
                    <span className="text-[#141226]">{circuit.nodes.length}</span>
                  </div>
                  <div className="flex justify-between font-mono tabular-nums">
                    <span>Wires</span>
                    <span className="text-[#141226]">{circuit.wires.length}</span>
                  </div>
                  <div className="flex justify-between font-mono tabular-nums">
                    <span>Solver Passes</span>
                    <span className="text-[#141226]">{simulation.iterations}</span>
                  </div>
                  <div className="flex justify-between font-mono tabular-nums">
                    <span>Network Stability</span>
                    <span className={simulation.stable ? 'text-[#16A34A]' : 'text-[#DC2626]'}>
                      {simulation.stable ? 'Settled' : 'Oscillating'}
                    </span>
                  </div>
                </div>
                <div className="border-t border-[#E4DFF7] pt-3 space-y-1.5">
                  <div className="font-semibold text-[#141226]">Quick Controls</div>
                  <p>Click Toggle Switches or 4-Bit Input buttons directly on the canvas to flip bits.</p>
                  <p>Drag from any output pin circle to an input pin circle to route a wire.</p>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* BOTTOM BAR: Simulation Controls & Output Console */}
      <div className="shrink-0 bg-white border-t border-[#E4DFF7]">
        <div className="px-3 py-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant={simRunning ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => setSimRunning(!simRunning)}
            >
              {simRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{simRunning ? 'Pause Clock' : 'Run Clock'}</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => runSimulationStep(true)}
              title="Toggle clock edge and advance one tick"
            >
              <StepForward className="w-3.5 h-3.5" />
              <span>Step Clock</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={resetSimulation} title="Reset sequential latches and counters">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </Button>

            <span className="w-px h-4 bg-[#E4DFF7] mx-1" aria-hidden="true" />

            <label className="flex items-center gap-2 text-xs text-[#475569]">
              <span>Clock</span>
              <input
                type="range"
                min={0.5}
                max={10}
                step={0.5}
                value={clockHz}
                onChange={(e) => setClockHz(Number(e.target.value))}
                className="w-20 accent-[#5B4CE6]"
              />
              <span className="font-mono text-[#141226] tabular-nums w-12">{clockHz.toFixed(1)} Hz</span>
            </label>

            <span className="hidden sm:inline text-xs font-mono text-[#64748B] tabular-nums">
              CLK={clockHigh ? '1' : '0'} · Tick {simTick}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setConsoleOpen((o) => !o)}
              className="flex items-center gap-2 text-xs font-medium text-[#334155] hover:text-[#141226] cursor-pointer"
            >
              {errorCount > 0 ? (
                <AlertCircle className="w-3.5 h-3.5 text-[#DC2626]" />
              ) : warningCount > 0 ? (
                <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
              )}
              <span className="tabular-nums">
                {errorCount} errors · {warningCount} warnings
              </span>
            </button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setWorkspace('signal-analyzer')}
            >
              <Activity className="w-3.5 h-3.5 text-[#5B4CE6]" />
              <span>Signal Analyzer</span>
            </Button>
          </div>
        </div>

        {/* Diagnostics Output Console */}
        {consoleOpen && simulation.issues.length > 0 && (
          <div className="max-h-28 overflow-y-auto border-t border-[#E4DFF7] bg-[#F7F5FF] px-4 py-2 space-y-1.5">
            {simulation.issues.map((issue) => (
              <div key={issue.id} className="flex items-start gap-2 text-xs">
                {issue.severity === 'error' ? (
                  <AlertCircle className="w-3.5 h-3.5 text-[#DC2626] mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <span className="font-medium text-[#141226]">{issue.message}</span>{' '}
                  <span className="text-[#64748B]">{issue.suggestion}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
