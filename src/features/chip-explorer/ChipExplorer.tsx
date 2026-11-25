import React, { useState } from 'react';
import { ArrowRight, ZoomIn, ZoomOut } from 'lucide-react';
import { useChipCraftStore } from '../../state/useChipCraftStore';
import { BUILT_IN_EXAMPLES } from '../../templates/circuitTemplates';
import { Button, SegmentedTabs } from '../../design-system/ui';

interface ArchitectureLayer {
  id: string;
  level: number;
  name: string;
  scale: string;
  summary: string;
  composedOf: string;
  buildsInto: string;
  keyInsight: string;
  blocks: Array<{ label: string; sub: string; x: number; y: number; w: number; h: number }>;
  links: Array<[number, number, number, number]>;
  labAction?: { label: string; exampleId?: string; workspace: 'circuit-studio' | 'cpu-architect' | 'memory-lab' | 'logic-lab' };
}

const ARCH_LAYERS: ArchitectureLayer[] = [
  {
    id: 'transistors',
    level: 1,
    name: 'Transistors (CMOS Switches)',
    scale: 'Nanometer switches',
    summary: 'Complementary PMOS and NMOS field-effect transistors act as voltage-controlled switches connecting outputs to VDD (HIGH) or GND (LOW).',
    composedOf: 'Doped silicon channels, gate oxide, source/drain terminals',
    buildsInto: 'Inverters, NAND, NOR, and transmission gates',
    keyInsight: 'CMOS draws almost zero static current because the pull-up (PMOS) and pull-down (NMOS) networks are never simultaneously conducting in steady state.',
    blocks: [
      { label: 'VDD (+V)', sub: 'Logic 1 Rail', x: 220, y: 16, w: 120, h: 36 },
      { label: 'PMOS Pull-Up', sub: 'Conducts when Gate=0', x: 200, y: 74, w: 160, h: 46 },
      { label: 'Output Node Y', sub: 'Driven to 1 or 0', x: 430, y: 126, w: 130, h: 44 },
      { label: 'NMOS Pull-Down', sub: 'Conducts when Gate=1', x: 200, y: 158, w: 160, h: 46 },
      { label: 'GND (0V)', sub: 'Logic 0 Rail', x: 220, y: 224, w: 120, h: 36 },
    ],
    links: [
      [280, 52, 280, 74],
      [280, 120, 280, 158],
      [280, 142, 430, 148],
      [280, 204, 280, 224],
    ],
  },
  {
    id: 'gates',
    level: 2,
    name: 'Logic Gates',
    scale: '2–6 transistors per gate',
    summary: 'Transistor networks abstracted into deterministic Boolean primitives: NOT, NAND, NOR, AND, OR, and XOR.',
    composedOf: 'Matched PMOS/NMOS pull-up and pull-down pairs',
    buildsInto: 'Adders, multiplexers, decoders, and flip-flops',
    keyInsight: 'NAND and NOR are functionally complete — every combinational and sequential processor block can be built exclusively from NAND gates.',
    blocks: [
      { label: 'Inputs A, B', sub: 'Binary signals', x: 30, y: 105, w: 110, h: 54 },
      { label: 'XOR Gate', sub: 'Sum = A ⊕ B', x: 210, y: 45, w: 130, h: 56 },
      { label: 'AND Gate', sub: 'Carry = A · B', x: 210, y: 155, w: 130, h: 56 },
      { label: 'Half Adder Out', sub: '2-bit binary result', x: 420, y: 105, w: 130, h: 54 },
    ],
    links: [
      [140, 122, 210, 73],
      [140, 142, 210, 183],
      [340, 73, 420, 122],
      [340, 183, 420, 142],
    ],
    labAction: { label: 'Open Logic Gate Lab', workspace: 'logic-lab' },
  },
  {
    id: 'flipflops',
    level: 3,
    name: 'Latches & Flip-Flops',
    scale: '1-bit state storage',
    summary: 'Cross-coupled feedback gates capture and hold a single bit across clock cycles, enabling sequential state machines.',
    composedOf: 'Cross-coupled NAND/NOR latches + edge-triggering clock gates',
    buildsInto: 'Registers, shift registers, and binary counters',
    keyInsight: 'Edge-triggered D flip-flops isolate stages so combinational logic has an entire clock period to settle before the next state is sampled.',
    blocks: [
      { label: 'Data Input D', sub: 'Next-state bit', x: 30, y: 60, w: 120, h: 48 },
      { label: 'Clock Edge', sub: 'Rising 0 → 1', x: 30, y: 150, w: 120, h: 48 },
      { label: 'Master Latch', sub: 'Captures D', x: 210, y: 95, w: 120, h: 66 },
      { label: 'Slave Latch', sub: 'Holds Q stable', x: 380, y: 95, w: 120, h: 66 },
    ],
    links: [
      [150, 84, 210, 118],
      [150, 174, 210, 145],
      [330, 128, 380, 128],
    ],
    labAction: { label: 'Simulate D Flip-Flop', exampleId: 'ex-d-ff', workspace: 'circuit-studio' },
  },
  {
    id: 'registers',
    level: 4,
    name: 'Registers & Counters',
    scale: '4-bit to 64-bit word storage',
    summary: 'Parallel arrays of D flip-flops sharing a common clock and load-enable line store multi-bit operands and program counters.',
    composedOf: 'N parallel D flip-flops + write-enable multiplexers',
    buildsInto: 'Register files, instruction registers, and program counters',
    keyInsight: 'CPU register files provide single-cycle read/write access at the top of the memory hierarchy.',
    blocks: [
      { label: 'D[3:0] Bus', sub: 'Parallel input', x: 30, y: 100, w: 110, h: 58 },
      { label: 'FF3 · FF2 · FF1 · FF0', sub: 'Shared CLK & LOAD', x: 205, y: 80, w: 175, h: 98 },
      { label: 'Q[3:0] Output', sub: 'Stored word', x: 445, y: 100, w: 115, h: 58 },
    ],
    links: [
      [140, 129, 205, 129],
      [380, 129, 445, 129],
    ],
    labAction: { label: 'Simulate 4-Bit Counter', exampleId: 'ex-4bit-counter', workspace: 'circuit-studio' },
  },
  {
    id: 'alu',
    level: 5,
    name: 'Arithmetic Logic Unit (ALU)',
    scale: 'Combinational execution core',
    summary: 'Combines parallel adders, bitwise logic units, shifters, and output multiplexers to compute arithmetic and logical operations.',
    composedOf: 'Full adders, bitwise AND/OR/XOR arrays, and opcode multiplexer',
    buildsInto: 'Processor execution datapath',
    keyInsight: 'Every ALU operation simultaneously generates status flags (Zero, Carry, Negative) used by conditional branch instructions.',
    blocks: [
      { label: 'Operands A, B', sub: 'From Register File', x: 25, y: 95, w: 120, h: 64 },
      { label: 'Adder / Subtractor', sub: 'A ± B', x: 210, y: 40, w: 145, h: 52 },
      { label: 'Logic & Shifter', sub: 'AND, OR, XOR, SHL', x: 210, y: 155, w: 145, h: 52 },
      { label: 'Result MUX + Flags', sub: 'Y, Zero, Carry', x: 425, y: 95, w: 145, h: 64 },
    ],
    links: [
      [145, 115, 210, 66],
      [145, 140, 210, 181],
      [355, 66, 425, 115],
      [355, 181, 425, 140],
    ],
    labAction: { label: 'Simulate 4-Bit ALU', exampleId: 'ex-4bit-alu', workspace: 'circuit-studio' },
  },
  {
    id: 'control-unit',
    level: 6,
    name: 'Control Unit & Decoders',
    scale: 'Instruction orchestration',
    summary: 'Decodes the fetched opcode bits from the Instruction Register into control signals that steer multiplexers, ALU opcodes, and memory enables.',
    composedOf: 'Instruction decoders, finite-state sequencers, and flag comparators',
    buildsInto: 'Complete Fetch-Decode-Execute processor',
    keyInsight: 'The control unit does not compute data itself — it coordinates which registers read, what the ALU executes, and whether the PC branches.',
    blocks: [
      { label: 'Instruction Reg', sub: 'Opcode bits [7:3]', x: 25, y: 55, w: 130, h: 52 },
      { label: 'Flags (Z, C, N)', sub: 'Branch conditions', x: 25, y: 150, w: 130, h: 52 },
      { label: 'Opcode Decoder', sub: 'Combinational / FSM', x: 225, y: 95, w: 145, h: 66 },
      { label: 'Control Signals', sub: 'WE, RegLd, ALUOp, Br', x: 435, y: 95, w: 145, h: 66 },
    ],
    links: [
      [155, 81, 225, 118],
      [155, 176, 225, 142],
      [370, 128, 435, 128],
    ],
    labAction: { label: 'Simulate 2-to-4 Decoder', exampleId: 'ex-decoder', workspace: 'circuit-studio' },
  },
  {
    id: 'memory-hierarchy',
    level: 7,
    name: 'Memory Hierarchy & Buses',
    scale: 'Registers → SRAM → Main RAM',
    summary: 'Balances access speed against capacity across CPU registers, on-chip cache, and addressable RAM connected over shared address, data, and control buses.',
    composedOf: 'Address decoders, bit-cell arrays, sense amplifiers, and tri-state bus drivers',
    buildsInto: 'Stored-program computer systems',
    keyInsight: 'Shared buses reduce wire count dramatically, relying on Chip Select (CS) and Output Enable (OE) tri-state control so only one device drives the bus at once.',
    blocks: [
      { label: 'CPU Registers', sub: '1 cycle · Bytes', x: 35, y: 40, w: 140, h: 54 },
      { label: 'On-Chip SRAM', sub: 'Fast lookup · KB', x: 225, y: 100, w: 140, h: 54 },
      { label: 'Main Memory', sub: 'Addressable RAM/ROM', x: 415, y: 160, w: 150, h: 54 },
    ],
    links: [
      [175, 67, 225, 127],
      [365, 127, 415, 187],
    ],
    labAction: { label: 'Open Memory Lab', workspace: 'memory-lab' },
  },
  {
    id: 'cpu-architecture',
    level: 8,
    name: 'Complete Processor Architecture',
    scale: 'Fetch → Decode → Execute',
    summary: 'Unifies Program Counter, Memory, Instruction Register, Control Unit, Register File, ALU, and Clock into a programmable stored-program machine.',
    composedOf: 'All lower abstraction layers synchronized by a global clock network',
    buildsInto: 'Microcontrollers, SoCs, and general-purpose computers',
    keyInsight: 'Every complex software application ultimately executes as sequential binary transitions across these deterministic hardware blocks.',
    blocks: [
      { label: 'Program Counter', sub: 'Next instruction addr', x: 25, y: 40, w: 130, h: 52 },
      { label: 'Memory (RAM)', sub: 'Code & Data', x: 225, y: 40, w: 130, h: 52 },
      { label: 'Control + IR', sub: 'Decode opcode', x: 425, y: 40, w: 135, h: 52 },
      { label: 'Register File', sub: 'R0 – R3', x: 120, y: 165, w: 140, h: 58 },
      { label: '8-Bit ALU + Flags', sub: 'Compute & Branch', x: 345, y: 165, w: 160, h: 58 },
    ],
    links: [
      [155, 66, 225, 66],
      [355, 66, 425, 66],
      [290, 92, 190, 165],
      [260, 194, 345, 194],
      [492, 92, 425, 165],
    ],
    labAction: { label: 'Launch 8-Bit CPU Architect', workspace: 'cpu-architect' },
  },
];

export function ChipExplorer() {
  const [layerIdx, setLayerIdx] = useState(0);
  const [cmosMode, setCmosMode] = useState<'inverter' | 'nand'>('inverter');
  const [cmosA, setCmosA] = useState<0 | 1>(0);
  const [cmosB, setCmosB] = useState<0 | 1>(1);

  const loadCircuitDocument = useChipCraftStore((s) => s.loadCircuitDocument);
  const setWorkspace = useChipCraftStore((s) => s.setWorkspace);

  const layer = ARCH_LAYERS[layerIdx];

  // Conceptual CMOS switch-level evaluation
  const invPmosOn = cmosA === 0;
  const invNmosOn = cmosA === 1;
  const invOut = invPmosOn ? 1 : 0;

  const nandPmosA = cmosA === 0;
  const nandPmosB = cmosB === 0;
  const nandNmosA = cmosA === 1;
  const nandNmosB = cmosB === 1;
  const nandPullUp = nandPmosA || nandPmosB;
  const nandPullDown = nandNmosA && nandNmosB;
  const nandOut = nandPullUp && !nandPullDown ? 1 : 0;

  const handleOpenLab = () => {
    if (!layer.labAction) return;
    if (layer.labAction.exampleId) {
      const ex = BUILT_IN_EXAMPLES.find((e) => e.id === layer.labAction?.exampleId);
      if (ex) loadCircuitDocument(ex.document, null);
    }
    setWorkspace(layer.labAction.workspace);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#F7F5FF]">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Section 1: Zoomable Chip Abstraction Hierarchy */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#141226]">Chip Abstraction Hierarchy</h2>
              <p className="text-sm text-[#64748B] mt-0.5">
                Zoom across 8 layers of digital engineering — from CMOS transistor switches up to a complete stored-program processor.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={layerIdx === 0}
                onClick={() => setLayerIdx((i) => Math.max(0, i - 1))}
              >
                <ZoomIn className="w-3.5 h-3.5" />
                Zoom In (Lower Level)
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={layerIdx === ARCH_LAYERS.length - 1}
                onClick={() => setLayerIdx((i) => Math.min(ARCH_LAYERS.length - 1, i + 1))}
              >
                <ZoomOut className="w-3.5 h-3.5" />
                Zoom Out (Higher Level)
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Level Selector Ladder */}
            <div className="lg:col-span-4 bg-white border border-[#E4DFF7] rounded-lg p-2 space-y-1">
              {ARCH_LAYERS.map((item, idx) => {
                const active = idx === layerIdx;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setLayerIdx(idx)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#F2EFFF] text-[#5B4CE6] font-semibold'
                        : 'text-[#334155] hover:bg-[#F7F5FF]'
                    }`}
                  >
                    <span className="text-xs sm:text-sm truncate">
                      {String(item.level).padStart(2, '0')}. {item.name}
                    </span>
                    <span className="text-[11px] font-mono opacity-75 shrink-0 ml-2">L{item.level}</span>
                  </button>
                );
              })}
            </div>

            {/* Interactive Layer Diagram + Engineering Breakdown */}
            <div className="lg:col-span-8 bg-white border border-[#E4DFF7] rounded-lg p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-mono text-[#5B4CE6]">
                    Level {layer.level} of {ARCH_LAYERS.length} · {layer.scale}
                  </div>
                  <h3 className="text-lg font-bold text-[#141226] mt-0.5">{layer.name}</h3>
                </div>
                {layer.labAction && (
                  <Button variant="primary" size="sm" onClick={handleOpenLab}>
                    <span>{layer.labAction.label}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>

              <p className="text-sm text-[#475569] leading-relaxed">{layer.summary}</p>

              {/* Architectural Block Diagram */}
              <div className="bg-[#F7F5FF] border border-[#E4DFF7] rounded-lg p-4">
                <svg viewBox="0 0 600 270" className="w-full h-auto">
                  {layer.links.map(([x1, y1, x2, y2], idx) => (
                    <line
                      key={idx}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#5B4CE6"
                      strokeWidth={2}
                      strokeOpacity={0.65}
                    />
                  ))}
                  {layer.blocks.map((b, idx) => (
                    <g key={idx}>
                      <rect
                        x={b.x}
                        y={b.y}
                        width={b.w}
                        height={b.h}
                        rx={7}
                        fill="#FFFFFF"
                        stroke="#334155"
                        strokeWidth={1.6}
                      />
                      <text
                        x={b.x + b.w / 2}
                        y={b.y + b.h / 2 - 3}
                        textAnchor="middle"
                        className="font-mono text-[11px] font-bold"
                        fill="#141226"
                      >
                        {b.label}
                      </text>
                      <text
                        x={b.x + b.w / 2}
                        y={b.y + b.h / 2 + 13}
                        textAnchor="middle"
                        className="font-sans text-[10px]"
                        fill="#64748B"
                      >
                        {b.sub}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 bg-[#F7F5FF] border border-[#E4DFF7] rounded-md space-y-1">
                  <div className="font-semibold text-[#141226]">Built From</div>
                  <div className="text-[#475569]">{layer.composedOf}</div>
                </div>
                <div className="p-3.5 bg-[#F7F5FF] border border-[#E4DFF7] rounded-md space-y-1">
                  <div className="font-semibold text-[#141226]">Combines Into</div>
                  <div className="text-[#475569]">{layer.buildsInto}</div>
                </div>
              </div>

              <p className="text-xs text-[#334155] border-t border-[#E4DFF7] pt-3 leading-relaxed">
                <strong>Key Architecture Principle:</strong> {layer.keyInsight}
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Interactive CMOS Transistor-Level Educational Sandbox */}
        <section className="bg-white border border-[#E4DFF7] rounded-lg p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-[#141226]">
                Conceptual CMOS Transistor-Level Sandbox
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Switch-level PMOS/NMOS conduction model for educational intuition (ideal binary switch abstraction — not analog SPICE semiconductor physics).
              </p>
            </div>
            <SegmentedTabs
              value={cmosMode}
              onChange={setCmosMode}
              options={[
                { value: 'inverter', label: 'CMOS Inverter (NOT)' },
                { value: 'nand', label: 'CMOS 2-Input NAND' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-7 bg-[#F7F5FF] border border-[#E4DFF7] rounded-lg p-4">
              {cmosMode === 'inverter' ? (
                <svg viewBox="0 0 520 260" className="w-full h-auto">
                  {/* VDD Rail */}
                  <line x1={180} y1={22} x2={340} y2={22} stroke="#DC2626" strokeWidth={2.5} />
                  <text x={260} y={16} textAnchor="middle" className="font-mono text-xs font-bold" fill="#DC2626">
                    VDD (Logic 1)
                  </text>

                  {/* Pull-up path */}
                  <line x1={260} y1={22} x2={260} y2={58} stroke={invPmosOn ? '#16A34A' : '#94A3B8'} strokeWidth={3} />
                  <line x1={260} y1={108} x2={260} y2={130} stroke={invPmosOn ? '#16A34A' : '#94A3B8'} strokeWidth={3} />

                  {/* Pull-down path */}
                  <line x1={260} y1={130} x2={260} y2={154} stroke={invNmosOn ? '#5B4CE6' : '#94A3B8'} strokeWidth={3} />
                  <line x1={260} y1={204} x2={260} y2={236} stroke={invNmosOn ? '#5B4CE6' : '#94A3B8'} strokeWidth={3} />

                  {/* GND Rail */}
                  <line x1={180} y1={236} x2={340} y2={236} stroke="#334155" strokeWidth={2.5} />
                  <text x={260} y={252} textAnchor="middle" className="font-mono text-xs font-bold" fill="#334155">
                    GND (Logic 0)
                  </text>

                  {/* Input Gate Line */}
                  <path
                    d="M 105 130 H 150 V 83 H 192 M 150 130 V 179 H 192"
                    fill="none"
                    stroke={cmosA ? '#16A34A' : '#64748B'}
                    strokeWidth={2.5}
                  />

                  {/* Output Line */}
                  <line
                    x1={260}
                    y1={130}
                    x2={395}
                    y2={130}
                    stroke={invOut ? '#16A34A' : '#475569'}
                    strokeWidth={3}
                  />
                  <circle cx={260} cy={130} r={4.5} fill={invOut ? '#16A34A' : '#475569'} />

                  {/* Input Toggle */}
                  <g onClick={() => setCmosA((v) => (v ? 0 : 1))} className="cursor-pointer">
                    <rect
                      x={18}
                      y={108}
                      width={88}
                      height={44}
                      rx={7}
                      fill={cmosA ? '#DCFCE7' : '#FFFFFF'}
                      stroke={cmosA ? '#16A34A' : '#CBD5E1'}
                      strokeWidth={1.8}
                    />
                    <text x={62} y={134} textAnchor="middle" className="font-mono text-xs font-bold" fill="#141226">
                      Vin = {cmosA}
                    </text>
                  </g>

                  {/* PMOS Block */}
                  <rect
                    x={198}
                    y={58}
                    width={124}
                    height={50}
                    rx={7}
                    fill={invPmosOn ? '#DCFCE7' : '#FFFFFF'}
                    stroke={invPmosOn ? '#16A34A' : '#94A3B8'}
                    strokeWidth={1.8}
                  />
                  <circle cx={193} cy={83} r={5} fill="#FFFFFF" stroke="#334155" strokeWidth={1.5} />
                  <text x={260} y={80} textAnchor="middle" className="font-mono text-xs font-bold" fill="#141226">
                    PMOS
                  </text>
                  <text x={260} y={96} textAnchor="middle" className="font-mono text-[10px]" fill={invPmosOn ? '#15803D' : '#64748B'}>
                    {invPmosOn ? 'ON (Closed)' : 'OFF (Open)'}
                  </text>

                  {/* NMOS Block */}
                  <rect
                    x={198}
                    y={154}
                    width={124}
                    height={50}
                    rx={7}
                    fill={invNmosOn ? '#EDE9FE' : '#FFFFFF'}
                    stroke={invNmosOn ? '#5B4CE6' : '#94A3B8'}
                    strokeWidth={1.8}
                  />
                  <text x={260} y={176} textAnchor="middle" className="font-mono text-xs font-bold" fill="#141226">
                    NMOS
                  </text>
                  <text x={260} y={192} textAnchor="middle" className="font-mono text-[10px]" fill={invNmosOn ? '#4A3BD6' : '#64748B'}>
                    {invNmosOn ? 'ON (Closed)' : 'OFF (Open)'}
                  </text>

                  {/* Output Indicator */}
                  <rect
                    x={395}
                    y={108}
                    width={104}
                    height={44}
                    rx={7}
                    fill={invOut ? '#DCFCE7' : '#FFFFFF'}
                    stroke={invOut ? '#16A34A' : '#CBD5E1'}
                    strokeWidth={1.8}
                  />
                  <text x={447} y={134} textAnchor="middle" className="font-mono text-xs font-bold" fill={invOut ? '#15803D' : '#334155'}>
                    Vout = {invOut}
                  </text>
                </svg>
              ) : (
                <svg viewBox="0 0 520 260" className="w-full h-auto">
                  <line x1={130} y1={20} x2={370} y2={20} stroke="#DC2626" strokeWidth={2.5} />
                  <text x={250} y={14} textAnchor="middle" className="font-mono text-xs font-bold" fill="#DC2626">
                    VDD (Parallel PMOS Pull-Up Network)
                  </text>

                  {/* Parallel PMOS branches */}
                  <line x1={190} y1={20} x2={190} y2={120} stroke={nandPmosA ? '#16A34A' : '#CBD5E1'} strokeWidth={2.5} />
                  <line x1={310} y1={20} x2={310} y2={120} stroke={nandPmosB ? '#16A34A' : '#CBD5E1'} strokeWidth={2.5} />
                  <line x1={190} y1={120} x2={395} y2={120} stroke={nandOut ? '#16A34A' : '#475569'} strokeWidth={3} />

                  {/* Series NMOS branch */}
                  <line x1={250} y1={120} x2={250} y2={240} stroke={nandPullDown ? '#5B4CE6' : '#CBD5E1'} strokeWidth={2.5} />
                  <line x1={160} y1={240} x2={340} y2={240} stroke="#334155" strokeWidth={2.5} />
                  <text x={250} y={255} textAnchor="middle" className="font-mono text-xs font-bold" fill="#334155">
                    GND (Series NMOS Pull-Down Network)
                  </text>

                  {/* PMOS A & B */}
                  <rect x={140} y={44} width={100} height={46} rx={6} fill={nandPmosA ? '#DCFCE7' : '#FFFFFF'} stroke={nandPmosA ? '#16A34A' : '#94A3B8'} strokeWidth={1.6} />
                  <text x={190} y={64} textAnchor="middle" className="font-mono text-[10px] font-bold" fill="#141226">PMOS (A={cmosA})</text>
                  <text x={190} y={79} textAnchor="middle" className="font-mono text-[10px]" fill={nandPmosA ? '#15803D' : '#64748B'}>{nandPmosA ? 'ON' : 'OFF'}</text>

                  <rect x={260} y={44} width={100} height={46} rx={6} fill={nandPmosB ? '#DCFCE7' : '#FFFFFF'} stroke={nandPmosB ? '#16A34A' : '#94A3B8'} strokeWidth={1.6} />
                  <text x={310} y={64} textAnchor="middle" className="font-mono text-[10px] font-bold" fill="#141226">PMOS (B={cmosB})</text>
                  <text x={310} y={79} textAnchor="middle" className="font-mono text-[10px]" fill={nandPmosB ? '#15803D' : '#64748B'}>{nandPmosB ? 'ON' : 'OFF'}</text>

                  {/* Series NMOS A & B */}
                  <rect x={195} y={138} width={110} height={38} rx={6} fill={nandNmosA ? '#EDE9FE' : '#FFFFFF'} stroke={nandNmosA ? '#5B4CE6' : '#94A3B8'} strokeWidth={1.6} />
                  <text x={250} y={161} textAnchor="middle" className="font-mono text-[10px] font-bold" fill="#141226">NMOS A: {nandNmosA ? 'ON' : 'OFF'}</text>

                  <rect x={195} y={188} width={110} height={38} rx={6} fill={nandNmosB ? '#EDE9FE' : '#FFFFFF'} stroke={nandNmosB ? '#5B4CE6' : '#94A3B8'} strokeWidth={1.6} />
                  <text x={250} y={211} textAnchor="middle" className="font-mono text-[10px] font-bold" fill="#141226">NMOS B: {nandNmosB ? 'ON' : 'OFF'}</text>

                  {/* Output */}
                  <rect x={395} y={98} width={105} height={44} rx={7} fill={nandOut ? '#DCFCE7' : '#FFFFFF'} stroke={nandOut ? '#16A34A' : '#CBD5E1'} strokeWidth={1.8} />
                  <text x={447} y={124} textAnchor="middle" className="font-mono text-xs font-bold" fill={nandOut ? '#15803D' : '#334155'}>
                    Y = {nandOut}
                  </text>
                </svg>
              )}
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={cmosA ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setCmosA((v) => (v ? 0 : 1))}
                >
                  Toggle Input A = {cmosA}
                </Button>
                {cmosMode === 'nand' && (
                  <Button
                    variant={cmosB ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setCmosB((v) => (v ? 0 : 1))}
                  >
                    Toggle Input B = {cmosB}
                  </Button>
                )}
              </div>

              <div className="p-4 bg-[#F7F5FF] border border-[#E4DFF7] rounded-lg space-y-2 text-xs text-[#334155] leading-relaxed">
                {cmosMode === 'inverter' ? (
                  <>
                    <div className="font-semibold text-[#141226]">
                      Active Conduction Path: {invOut ? 'VDD → PMOS → Vout (HIGH)' : 'Vout → NMOS → GND (LOW)'}
                    </div>
                    <p>
                      When <strong>Vin = {cmosA}</strong>, the PMOS transistor is{' '}
                      <strong>{invPmosOn ? 'conducting' : 'cutoff'}</strong> and the NMOS transistor is{' '}
                      <strong>{invNmosOn ? 'conducting' : 'cutoff'}</strong>, driving <strong>Vout = {invOut}</strong>.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="font-semibold text-[#141226]">
                      Active Path: {nandOut ? 'Parallel PMOS pulls Y to VDD (HIGH)' : 'Series NMOS A + B pull Y to GND (LOW)'}
                    </div>
                    <p>
                      Because the two NMOS switches are in series, output Y drops to 0 <em>only</em> when both A=1 and B=1 simultaneously.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
