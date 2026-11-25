import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ArrowRight, FilePlus, Cpu, Layers, Save, Play } from 'lucide-react';
import { useChipCraftStore } from '../state/useChipCraftStore';
import { BUILT_IN_EXAMPLES } from '../templates/circuitTemplates';
import type { WorkspaceId } from '../types/circuit';

interface CommandItem {
  id: string;
  group: string;
  label: string;
  detail: string;
  run: () => void;
}

const WORKSPACE_LIST: Array<{ id: WorkspaceId; label: string; detail: string }> = [
  { id: 'home', label: 'Home', detail: 'Overview, quick starts, and live demo circuit' },
  { id: 'circuit-studio', label: 'Circuit Studio', detail: 'Interactive digital schematic editor and simulator' },
  { id: 'logic-lab', label: 'Logic Gate Lab', detail: 'Truth tables, Boolean expressions, and gate experiments' },
  { id: 'cpu-architect', label: 'CPU Architect', detail: '8-bit educational processor, assembler, and live datapath' },
  { id: 'memory-lab', label: 'Memory Lab', detail: 'RAM, ROM, register banks, and address decoding' },
  { id: 'signal-analyzer', label: 'Signal Analyzer', detail: 'Multi-track digital waveform viewer and cursor timing' },
  { id: 'hdl-studio', label: 'HDL Studio', detail: 'Educational Verilog-subset editor, simulator, and synthesizer' },
  { id: 'chip-explorer', label: 'Chip Explorer', detail: 'Transistors to CPU architecture hierarchy and CMOS sandbox' },
  { id: 'challenge-lab', label: 'Challenge Lab', detail: 'Automated engineering challenges with vector verification' },
  { id: 'project-library', label: 'Project Library', detail: 'Local IndexedDB projects, templates, JSON export/import' },
  { id: 'documentation', label: 'Documentation', detail: 'ISA manual, gate reference, HDL grammar, and shortcuts' },
  { id: 'settings', label: 'Settings', detail: 'Canvas grid, routing style, clock speed, and storage' },
];

export function CommandPalette() {
  const open = useChipCraftStore((s) => s.commandPaletteOpen);
  const setOpen = useChipCraftStore((s) => s.setCommandPaletteOpen);
  const setWorkspace = useChipCraftStore((s) => s.setWorkspace);
  const newBlankCircuit = useChipCraftStore((s) => s.newBlankCircuit);
  const loadCircuitDocument = useChipCraftStore((s) => s.loadCircuitDocument);
  const saveCurrentCircuitProject = useChipCraftStore((s) => s.saveCurrentCircuitProject);
  const runSimulationStep = useChipCraftStore((s) => s.runSimulationStep);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const items = useMemo<CommandItem[]>(() => {
    const actions: CommandItem[] = [
      {
        id: 'act-new',
        group: 'Actions',
        label: 'Create New Blank Circuit',
        detail: 'Start a fresh schematic in Circuit Studio',
        run: () => newBlankCircuit(),
      },
      {
        id: 'act-save',
        group: 'Actions',
        label: 'Save Active Circuit Locally',
        detail: 'Persist current circuit into IndexedDB storage',
        run: () => {
          void saveCurrentCircuitProject();
        },
      },
      {
        id: 'act-step',
        group: 'Actions',
        label: 'Step Clock Pulse',
        detail: 'Advance Circuit Studio clock by one half-cycle',
        run: () => runSimulationStep(true),
      },
    ];

    const workspaces: CommandItem[] = WORKSPACE_LIST.map((ws) => ({
      id: `ws-${ws.id}`,
      group: 'Workspaces',
      label: ws.label,
      detail: ws.detail,
      run: () => setWorkspace(ws.id),
    }));

    const examples: CommandItem[] = BUILT_IN_EXAMPLES.map((ex) => ({
      id: `ex-${ex.id}`,
      group: 'Built-In Examples',
      label: `Open Example: ${ex.name}`,
      detail: `${ex.category} · ${ex.difficulty}`,
      run: () => {
        loadCircuitDocument(ex.document, null);
        setWorkspace('circuit-studio');
      },
    }));

    return [...actions, ...workspaces, ...examples];
  }, [loadCircuitDocument, newBlankCircuit, runSimulationStep, saveCurrentCircuitProject, setWorkspace]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.detail.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q)
    );
  }, [items, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const execute = (item: CommandItem) => {
    item.run();
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-[#141226]/35 backdrop-blur-[1px]"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      <div
        className="w-full max-w-xl bg-white border border-[#E4DFF7] rounded-xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E4DFF7]">
          <Search className="w-4 h-4 text-[#5B587A] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter' && filtered[activeIndex]) {
                e.preventDefault();
                execute(filtered[activeIndex]);
              }
            }}
            placeholder="Jump to workspace, load an example circuit, or run an action..."
            className="w-full text-sm text-[#141226] placeholder:text-[#8782A6] focus:outline-none bg-transparent"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs font-mono text-[#5B587A] hover:text-[#141226] px-1.5 py-0.5 border border-[#E4DFF7] rounded cursor-pointer"
          >
            ESC
          </button>
        </div>

        <div className="max-h-[380px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#5B587A]">
              No matching workspaces, examples, or actions.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const active = idx === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => execute(item)}
                  className={`w-full flex items-center justify-between gap-4 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                    active ? 'bg-[#F2EFFF] text-[#5B4CE6]' : 'text-[#141226] hover:bg-[#FAF9FF]'
                  }`}
                >
                  <div className="min-w-0 flex items-center gap-3">
                    {item.group === 'Actions' ? (
                      item.id === 'act-save' ? (
                        <Save className="w-4 h-4 shrink-0 text-[#5B587A]" />
                      ) : item.id === 'act-step' ? (
                        <Play className="w-4 h-4 shrink-0 text-[#5B587A]" />
                      ) : (
                        <FilePlus className="w-4 h-4 shrink-0 text-[#5B587A]" />
                      )
                    ) : item.group === 'Built-In Examples' ? (
                      <Layers className="w-4 h-4 shrink-0 text-[#5B587A]" />
                    ) : (
                      <Cpu className="w-4 h-4 shrink-0 text-[#5B587A]" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{item.label}</div>
                      <div className="text-xs text-[#5B587A] truncate">
                        {item.group} · {item.detail}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-60" />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
