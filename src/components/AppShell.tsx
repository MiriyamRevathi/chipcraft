import React, { useEffect } from 'react';
import {
  Home,
  CircuitBoard,
  Binary,
  Cpu,
  HardDrive,
  Activity,
  FileCode2,
  Layers,
  Trophy,
  FolderOpen,
  BookOpen,
  Settings,
  Search,
  Menu,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
} from 'lucide-react';
import { useChipCraftStore } from '../state/useChipCraftStore';
import type { WorkspaceId } from '../types/circuit';
import { CommandPalette } from './CommandPalette';
import { KeyHint } from '../design-system/ui';

interface NavEntry {
  id: WorkspaceId;
  label: string;
  section: 'Design' | 'Architecture' | 'Learn' | 'Workspace';
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ENTRIES: NavEntry[] = [
  { id: 'home', label: 'Home', section: 'Design', icon: Home },
  { id: 'circuit-studio', label: 'Circuit Studio', section: 'Design', icon: CircuitBoard },
  { id: 'logic-lab', label: 'Logic Gate Lab', section: 'Design', icon: Binary },
  { id: 'signal-analyzer', label: 'Signal Analyzer', section: 'Design', icon: Activity },
  { id: 'cpu-architect', label: 'CPU Architect', section: 'Architecture', icon: Cpu },
  { id: 'memory-lab', label: 'Memory Lab', section: 'Architecture', icon: HardDrive },
  { id: 'hdl-studio', label: 'HDL Studio', section: 'Architecture', icon: FileCode2 },
  { id: 'chip-explorer', label: 'Chip Explorer', section: 'Learn', icon: Layers },
  { id: 'challenge-lab', label: 'Challenge Lab', section: 'Learn', icon: Trophy },
  { id: 'project-library', label: 'Project Library', section: 'Workspace', icon: FolderOpen },
  { id: 'documentation', label: 'Documentation', section: 'Workspace', icon: BookOpen },
  { id: 'settings', label: 'Settings', section: 'Workspace', icon: Settings },
];

const WORKSPACE_TITLES: Record<WorkspaceId, { title: string; subtitle: string }> = {
  home: {
    title: 'Engineering Workspace',
    subtitle: 'Design. Connect. Simulate. Understand.',
  },
  'circuit-studio': {
    title: 'Circuit Studio',
    subtitle: 'Interactive digital schematic editor & deterministic simulator',
  },
  'logic-lab': {
    title: 'Logic Gate Lab',
    subtitle: 'Interactive Boolean algebra, truth tables, and universal gate synthesis',
  },
  'cpu-architect': {
    title: 'CPU Architect',
    subtitle: 'Educational 8-bit processor, assembler, and live datapath inspection',
  },
  'memory-lab': {
    title: 'Memory Lab',
    subtitle: 'RAM, ROM, register banks, and address bus decoding',
  },
  'signal-analyzer': {
    title: 'Signal Analyzer',
    subtitle: 'Multi-channel digital logic timing diagrams from live simulation',
  },
  'hdl-studio': {
    title: 'HDL Studio',
    subtitle: 'Educational Verilog-subset editor, truth-table evaluator, and gate synthesizer',
  },
  'chip-explorer': {
    title: 'Chip Explorer',
    subtitle: 'Hierarchical architecture diagrams from CMOS switches to full processors',
  },
  'challenge-lab': {
    title: 'Challenge Lab',
    subtitle: 'Vector-verified hardware design challenges',
  },
  'project-library': {
    title: 'Project Library',
    subtitle: 'Local IndexedDB workspace projects, templates, and JSON export/import',
  },
  documentation: {
    title: 'Documentation',
    subtitle: 'Architecture manual, instruction set reference, and HDL specification',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Canvas grid, wire routing, simulation timing, and local storage',
  },
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const workspace = useChipCraftStore((s) => s.workspace);
  const setWorkspace = useChipCraftStore((s) => s.setWorkspace);
  const setCommandPaletteOpen = useChipCraftStore((s) => s.setCommandPaletteOpen);
  const mobileNavOpen = useChipCraftStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useChipCraftStore((s) => s.setMobileNavOpen);
  const refreshProjects = useChipCraftStore((s) => s.refreshProjects);
  const toasts = useChipCraftStore((s) => s.toasts);
  const dismissToast = useChipCraftStore((s) => s.dismissToast);
  const simRunning = useChipCraftStore((s) => s.simRunning);
  const clockHz = useChipCraftStore((s) => s.clockHz);
  const runSimulationStep = useChipCraftStore((s) => s.runSimulationStep);
  const circuitNodes = useChipCraftStore((s) => s.circuit.nodes);

  // Load persisted IndexedDB projects on boot
  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  // Global Cmd+K / Ctrl+K and Escape shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      } else if (e.key === 'Escape' && mobileNavOpen) {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setCommandPaletteOpen, mobileNavOpen, setMobileNavOpen]);

  // Periodic clock tick when active circuit contains a CLOCK source and simulation is running
  const hasClockNode = circuitNodes.some((n) => n.type === 'CLOCK');
  useEffect(() => {
    if (!simRunning || !hasClockNode) return;
    const halfPeriodMs = Math.max(40, Math.round(500 / clockHz));
    const timer = window.setInterval(() => {
      runSimulationStep(true);
    }, halfPeriodMs);
    return () => window.clearInterval(timer);
  }, [simRunning, hasClockNode, clockHz, runSimulationStep]);

  const sections: Array<NavEntry['section']> = ['Design', 'Architecture', 'Learn', 'Workspace'];
  const headerInfo = WORKSPACE_TITLES[workspace];

  const renderNavLinks = () => (
    <nav aria-label="Primary Workspaces" className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
      {sections.map((section) => (
        <div key={section}>
          <div className="px-2.5 mb-1.5 text-[11px] font-semibold tracking-wide text-[#64748B]">
            {section}
          </div>
          <div className="space-y-0.5">
            {NAV_ENTRIES.filter((n) => n.section === section).map((item) => {
              const Icon = item.icon;
              const active = workspace === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setWorkspace(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#F2EFFF] text-[#5B4CE6]'
                      : 'text-[#3D3A57] hover:bg-[#F7F5FF] hover:text-[#141226]'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${active ? 'text-[#5B4CE6]' : 'text-[#7A7699]'}`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="h-screen w-screen flex bg-[#F7F5FF] text-[#141226] overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:px-3 focus:py-2 focus:bg-[#5B4CE6] focus:text-white focus:rounded-md focus:text-xs focus:font-semibold"
      >
        Skip to main content
      </a>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-60 shrink-0 bg-white border-r border-[#E4DFF7]">
        <div className="h-14 px-4 flex items-center border-b border-[#E4DFF7]">
          <button
            type="button"
            onClick={() => setWorkspace('home')}
            className="flex items-center gap-2.5 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B4CE6] rounded"
          >
            <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect x="6" y="6" width="16" height="16" rx="3" fill="#5B4CE6" />
              <rect x="10" y="10" width="8" height="8" rx="1.5" fill="#FFFFFF" />
              <path
                d="M10 2V6M18 2V6M10 22V26M18 22V26M2 10H6M2 18H6M22 10H26M22 18H26"
                stroke="#5B4CE6"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span className="font-bold text-[17px] tracking-tight text-[#141226] whitespace-nowrap">
              ChipCraft
            </span>
          </button>
        </div>
        {renderNavLinks()}
        <div className="p-3 border-t border-[#E4DFF7]">
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-[#5B587A] bg-[#F7F5FF] hover:bg-[#EFEBFD] border border-[#E4DFF7] rounded-md transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 shrink-0" />
              Quick Command
            </span>
            <KeyHint>⌘K</KeyHint>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden flex bg-[#141226]/40"
          onClick={() => setMobileNavOpen(false)}
        >
          <aside
            className="w-64 max-w-[82vw] h-full bg-white border-r border-[#E4DFF7] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-14 px-4 flex items-center justify-between border-b border-[#E4DFF7]">
              <span className="font-bold text-base tracking-tight text-[#141226]">ChipCraft</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation menu"
                className="p-1.5 text-[#5B587A] hover:text-[#141226] rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderNavLinks()}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="h-14 shrink-0 bg-white border-b border-[#E4DFF7] px-4 lg:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-1.5 -ml-1 text-[#5B587A] hover:text-[#141226] rounded-md hover:bg-[#F3F0FF] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex items-baseline gap-3">
              <h1 className="text-[15px] font-semibold text-[#141226] truncate">
                {headerInfo.title}
              </h1>
              <span className="hidden md:inline text-xs text-[#5B587A] truncate">
                {headerInfo.subtitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-xs text-[#5B587A] bg-[#F7F5FF] hover:bg-[#EFEBFD] border border-[#E4DFF7] rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-[#7A7699]" />
              <span>Search or jump</span>
              <KeyHint>Ctrl+K</KeyHint>
            </button>
            {workspace !== 'circuit-studio' && (
              <button
                type="button"
                onClick={() => setWorkspace('circuit-studio')}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#5B4CE6] hover:bg-[#4A3BD6] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Open Studio
              </button>
            )}
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="flex-1 min-h-0 overflow-hidden relative focus:outline-none">
          {children}
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette />

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
        >
          {toasts.map((t) => {
            const Icon =
              t.tone === 'success'
                ? CheckCircle2
                : t.tone === 'error'
                  ? AlertCircle
                  : t.tone === 'warning'
                    ? AlertTriangle
                    : Info;
            const iconColor =
              t.tone === 'success'
                ? 'text-[#16A34A]'
                : t.tone === 'error'
                  ? 'text-[#DC2626]'
                  : t.tone === 'warning'
                    ? 'text-[#F59E0B]'
                    : 'text-[#5B4CE6]';
            return (
              <div
                key={t.id}
                role={t.tone === 'error' ? 'alert' : 'status'}
                className="pointer-events-auto bg-white border border-[#E4DFF7] rounded-lg shadow-md px-3.5 py-3 flex items-start gap-2.5"
              >
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-[#141226]">{t.title}</div>
                  {t.detail && <div className="text-xs text-[#5B587A] mt-0.5">{t.detail}</div>}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(t.id)}
                  aria-label="Dismiss notification"
                  className="text-[#8782A6] hover:text-[#141226] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
