import React, { useMemo, useState } from 'react';
import {
  Plus,
  Cpu,
  Binary,
  FolderOpen,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { useChipCraftStore } from '../../state/useChipCraftStore';
import { BUILT_IN_EXAMPLES } from '../../templates/circuitTemplates';
import { simulateCircuit } from '../../engine/simulation/simulator';
import { primarySignal, signalColor } from '../../engine/signals/signalModel';
import { Button } from '../../design-system/ui';

export function HomeWorkspace() {
  const setWorkspace = useChipCraftStore((s) => s.setWorkspace);
  const newBlankCircuit = useChipCraftStore((s) => s.newBlankCircuit);
  const loadCircuitDocument = useChipCraftStore((s) => s.loadCircuitDocument);
  const projects = useChipCraftStore((s) => s.projects);
  const openProject = useChipCraftStore((s) => s.openProject);

  // Live working Half Adder circuit powered by the real simulation engine
  const [demoA, setDemoA] = useState<0 | 1>(1);
  const [demoB, setDemoB] = useState<0 | 1>(1);

  const demoSim = useMemo(() => {
    const base = BUILT_IN_EXAMPLES[3].document; // Half Adder
    const nodes = base.nodes.map((n) => {
      if (n.id === 'sw_a') return { ...n, value: demoA };
      if (n.id === 'sw_b') return { ...n, value: demoB };
      return n;
    });
    return simulateCircuit(nodes, base.wires, { clockHigh: false });
  }, [demoA, demoB]);

  const sigA = primarySignal(demoSim.pinValues['sw_a:out']);
  const sigB = primarySignal(demoSim.pinValues['sw_b:out']);
  const sigSum = primarySignal(demoSim.pinValues['g_xor:y']);
  const sigCarry = primarySignal(demoSim.pinValues['g_and:y']);

  const quickStarts = [
    {
      title: '01. First AND Gate',
      summary: 'Connect two toggle switches to a 2-input AND gate and observe deterministic output.',
      action: () => {
        loadCircuitDocument(BUILT_IN_EXAMPLES[0].document, null);
        setWorkspace('circuit-studio');
      },
    },
    {
      title: '02. Build a Half Adder',
      summary: 'Combine XOR and AND gates to compute 1-bit binary Sum and Carry.',
      action: () => {
        loadCircuitDocument(BUILT_IN_EXAMPLES[3].document, null);
        setWorkspace('circuit-studio');
      },
    },
    {
      title: '03. Build a 4-Bit ALU',
      summary: 'Run ADD, SUB, AND, OR, XOR, and shift instructions on 4-bit operand buses.',
      action: () => {
        loadCircuitDocument(BUILT_IN_EXAMPLES[10].document, null);
        setWorkspace('circuit-studio');
      },
    },
    {
      title: '04. Build an 8-Bit CPU',
      summary: 'Assemble machine instructions, step the clock, and inspect live registers and RAM.',
      action: () => setWorkspace('cpu-architect'),
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#F7F5FF]">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-12">
        {/* Hero Split: Engineering Headline + Live Simulated Half Adder Workbench */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="text-xs font-mono text-[#5B4CE6] tracking-wide">
                Design. Connect. Simulate. Understand.
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#141226] leading-tight">
                Your hardware ideas start here.
              </h2>
              <p className="text-[15px] text-[#4E4A6D] leading-relaxed max-w-xl">
                Design digital circuits, build processors, analyze waveforms, write educational HDL,
                and simulate hardware directly in your browser. Everything executes locally with
                deterministic Boolean logic, IndexedDB, and local file storage.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button variant="primary" onClick={() => newBlankCircuit('New Circuit')}>
                <Plus className="w-4 h-4" />
                Create New Circuit
              </Button>
              <Button variant="secondary" onClick={() => setWorkspace('cpu-architect')}>
                <Cpu className="w-4 h-4 text-[#5B4CE6]" />
                Build a CPU
              </Button>
              <Button variant="secondary" onClick={() => setWorkspace('logic-lab')}>
                <Binary className="w-4 h-4 text-[#0891B2]" />
                Open Logic Gate Lab
              </Button>
              <Button variant="ghost" onClick={() => setWorkspace('project-library')}>
                <FolderOpen className="w-4 h-4" />
                Explore Examples
              </Button>
            </div>
          </div>

          {/* Live Interactive Digital Circuit Demonstration */}
          <div className="lg:col-span-6 bg-white border border-[#E4DFF7] rounded-xl p-5 flex flex-col justify-between shadow-[0_1px_2px_rgba(91,76,230,0.05)]">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#F1EEFC]">
              <div>
                <div className="text-sm font-semibold text-[#141226]">
                  Live Half Adder Simulation
                </div>
                <div className="text-xs text-[#5B587A]">
                  Click switches A or B below — signals calculate in real time
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  loadCircuitDocument(BUILT_IN_EXAMPLES[3].document, null);
                  setWorkspace('circuit-studio');
                }}
                className="text-xs font-medium text-[#5B4CE6] hover:underline whitespace-nowrap cursor-pointer"
              >
                Edit in Studio →
              </button>
            </div>

            <div className="py-4">
              <svg viewBox="0 0 520 210" className="w-full h-auto" role="group" aria-label="Interactive Half Adder schematic">
                {/* Wires A & B to XOR and AND */}
                <path
                  d="M 105 55 H 190 V 45 H 245"
                  fill="none"
                  stroke={signalColor(sigA)}
                  strokeWidth={2.5}
                />
                <path
                  d="M 165 55 V 135 H 245"
                  fill="none"
                  stroke={signalColor(sigA)}
                  strokeWidth={2.5}
                />
                <circle cx={165} cy={55} r={3.5} fill={signalColor(sigA)} />

                <path
                  d="M 105 155 H 190 V 165 H 245"
                  fill="none"
                  stroke={signalColor(sigB)}
                  strokeWidth={2.5}
                />
                <path
                  d="M 185 155 V 73 H 245"
                  fill="none"
                  stroke={signalColor(sigB)}
                  strokeWidth={2.5}
                />
                <circle cx={185} cy={155} r={3.5} fill={signalColor(sigB)} />

                {/* Outputs */}
                <path
                  d="M 332 59 H 410"
                  fill="none"
                  stroke={signalColor(sigSum)}
                  strokeWidth={2.5}
                />
                <path
                  d="M 332 150 H 410"
                  fill="none"
                  stroke={signalColor(sigCarry)}
                  strokeWidth={2.5}
                />

                {/* Switch A */}
                <g
                  onClick={() => setDemoA((v) => (v ? 0 : 1))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDemoA((v) => (v ? 0 : 1));
                    }
                  }}
                  className="cursor-pointer focus:outline-none"
                  role="button"
                  tabIndex={0}
                  aria-pressed={demoA === 1}
                  aria-label={`A = ${demoA} — Toggle input A`}
                >
                  <rect
                    x={20}
                    y={33}
                    width={85}
                    height={44}
                    rx={8}
                    fill={demoA ? '#DCFCE7' : '#F8FAFC'}
                    stroke={demoA ? '#16A34A' : '#CBD5E1'}
                    strokeWidth={1.8}
                  />
                  <text x={44} y={59} className="font-mono text-xs font-semibold" fill="#0F172A">
                    A = {demoA}
                  </text>
                </g>

                {/* Switch B */}
                <g
                  onClick={() => setDemoB((v) => (v ? 0 : 1))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDemoB((v) => (v ? 0 : 1));
                    }
                  }}
                  className="cursor-pointer focus:outline-none"
                  role="button"
                  tabIndex={0}
                  aria-pressed={demoB === 1}
                  aria-label={`B = ${demoB} — Toggle input B`}
                >
                  <rect
                    x={20}
                    y={133}
                    width={85}
                    height={44}
                    rx={8}
                    fill={demoB ? '#DCFCE7' : '#F8FAFC'}
                    stroke={demoB ? '#16A34A' : '#CBD5E1'}
                    strokeWidth={1.8}
                  />
                  <text x={44} y={159} className="font-mono text-xs font-semibold" fill="#0F172A">
                    B = {demoB}
                  </text>
                </g>

                {/* XOR Gate */}
                <g transform="translate(240, 30)">
                  <path
                    d="M 6 5 Q 16 29 6 53"
                    fill="none"
                    stroke="#334155"
                    strokeWidth={1.8}
                  />
                  <path
                    d="M 14 4 Q 24 29 14 54 Q 68 54 92 29 Q 68 4 14 4 Z"
                    fill="#FFFFFF"
                    stroke="#334155"
                    strokeWidth={1.8}
                  />
                  <text x={48} y={33} textAnchor="middle" className="font-mono text-[11px] font-bold" fill="#334155">
                    XOR
                  </text>
                </g>

                {/* AND Gate */}
                <g transform="translate(244, 122)">
                  <path
                    d="M 4 4 L 54 4 A 24 24 0 0 1 54 52 L 4 52 Z"
                    fill="#FFFFFF"
                    stroke="#334155"
                    strokeWidth={1.8}
                  />
                  <text x={42} y={32} textAnchor="middle" className="font-mono text-[11px] font-bold" fill="#334155">
                    AND
                  </text>
                </g>

                {/* SUM LED */}
                <g transform="translate(410, 37)">
                  <rect width={90} height={44} rx={8} fill="#FFFFFF" stroke="#E2E8F0" strokeWidth={1.5} />
                  <circle
                    cx={24}
                    cy={22}
                    r={10}
                    fill={sigSum === 'HIGH' ? '#22C55E' : '#E2E8F0'}
                    stroke={sigSum === 'HIGH' ? '#15803D' : '#94A3B8'}
                    strokeWidth={1.5}
                  />
                  <text x={44} y={26} className="font-mono text-xs font-semibold" fill="#0F172A">
                    S = {sigSum === 'HIGH' ? '1' : '0'}
                  </text>
                </g>

                {/* CARRY LED */}
                <g transform="translate(410, 128)">
                  <rect width={90} height={44} rx={8} fill="#FFFFFF" stroke="#E2E8F0" strokeWidth={1.5} />
                  <circle
                    cx={24}
                    cy={22}
                    r={10}
                    fill={sigCarry === 'HIGH' ? '#22C55E' : '#E2E8F0'}
                    stroke={sigCarry === 'HIGH' ? '#15803D' : '#94A3B8'}
                    strokeWidth={1.5}
                  />
                  <text x={44} y={26} className="font-mono text-xs font-semibold" fill="#0F172A">
                    C = {sigCarry === 'HIGH' ? '1' : '0'}
                  </text>
                </g>
              </svg>
            </div>

            <div className="pt-3 border-t border-[#F1EEFC] flex items-center justify-between text-xs font-mono text-[#4E4A6D] tabular-nums">
              <span>
                {demoA} + {demoB} = {(demoA + demoB).toString(2).padStart(2, '0')}₂ (Decimal {demoA + demoB})
              </span>
              <span className="text-[#5B587A]">SUM = A ⊕ B · CARRY = A · B</span>
            </div>
          </div>
        </section>

        {/* Quick-Start Guided Tracks */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-semibold text-[#141226]">Quick-Start Lab Tracks</h3>
            <span className="text-xs text-[#5B587A]">Launch working circuits in one click</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickStarts.map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={item.action}
                className="group text-left bg-white border border-[#E4DFF7] hover:border-[#5B4CE6] rounded-lg p-5 transition-colors flex flex-col justify-between gap-4 cursor-pointer"
              >
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-[#141226] group-hover:text-[#5B4CE6] transition-colors">
                    {item.title}
                  </div>
                  <p className="text-xs text-[#5B587A] leading-relaxed">{item.summary}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-[#5B4CE6]">
                  <span>Open lab</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Recent Local Projects (IndexedDB + Local Disk) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[#141226]">Recent Local Projects</h3>
            <button
              type="button"
              onClick={() => setWorkspace('project-library')}
              className="text-xs font-medium text-[#5B4CE6] hover:underline cursor-pointer"
            >
              Manage Project Library →
            </button>
          </div>
          {projects.length === 0 ? (
            <div className="bg-white border border-[#E4DFF7] rounded-lg px-6 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-[#141226]">No locally saved projects yet</div>
                <p className="text-xs text-[#5B587A] mt-1">
                  Projects you save in Circuit Studio, CPU Architect, or HDL Studio are stored privately on your machine.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => newBlankCircuit('My First Circuit')}>
                Create First Project
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {projects.slice(0, 6).map((proj) => (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() => openProject(proj)}
                  className="text-left bg-white border border-[#E4DFF7] hover:border-[#5B4CE6] rounded-lg p-4 transition-colors space-y-2 cursor-pointer"
                >
                  <div className="text-sm font-semibold text-[#141226] truncate">{proj.name}</div>
                  <p className="text-xs text-[#5B587A] line-clamp-2">{proj.description}</p>
                  <div className="flex items-center gap-2 text-[11px] text-[#5B587A] pt-1 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(proj.updatedAt).toLocaleDateString()}</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{proj.kind}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Built-In Circuit Templates */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-semibold text-[#141226]">Built-In Hardware Examples</h3>
            <span className="text-xs text-[#5B587A]">12 verified schematics ready to simulate</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BUILT_IN_EXAMPLES.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => {
                  loadCircuitDocument(ex.document, null);
                  setWorkspace('circuit-studio');
                }}
                className="group text-left bg-white border border-[#E4DFF7] hover:border-[#5B4CE6] rounded-lg p-4 transition-colors flex flex-col justify-between gap-3 cursor-pointer"
              >
                <div className="space-y-1.5">
                  <div className="text-sm font-semibold text-[#141226] group-hover:text-[#5B4CE6]">
                    {ex.name}
                  </div>
                  <div className="text-xs text-[#5B587A]">
                    {ex.category} · {ex.difficulty} · {ex.document.nodes.length} parts
                  </div>
                  <p className="text-xs text-[#4E4A6D] leading-relaxed pt-1">{ex.description}</p>
                </div>
                <div className="text-xs font-medium text-[#5B4CE6]">Simulate in Studio →</div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
