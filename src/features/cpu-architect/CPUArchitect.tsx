import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  StepForward,
  RotateCcw,
  Wrench,
  Save,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { assembleProgram, CPU_PROGRAM_PRESETS } from '../../engine/cpu/assembler';
import { createInitialCPUState, stepCPU } from '../../engine/cpu/cpuEngine';
import type { AssemblerResult, CPUState } from '../../types/cpu';
import { useChipCraftStore } from '../../state/useChipCraftStore';
import { Button } from '../../design-system/ui';

function toHex2(n: number): string {
  return (n & 0xff).toString(16).toUpperCase().padStart(2, '0');
}

function toBin8(n: number): string {
  return (n & 0xff).toString(2).padStart(8, '0');
}

export function CPUArchitect() {
  const cpuAssemblyDraft = useChipCraftStore((s) => s.cpuAssemblyDraft);
  const saveCustomProject = useChipCraftStore((s) => s.saveCustomProject);
  const pushToast = useChipCraftStore((s) => s.pushToast);

  const [assembly, setAssembly] = useState(
    cpuAssemblyDraft || CPU_PROGRAM_PRESETS[0].assembly
  );
  const [asmResult, setAsmResult] = useState<AssemblerResult>(() =>
    assembleProgram(cpuAssemblyDraft || CPU_PROGRAM_PRESETS[0].assembly)
  );
  const [cpu, setCpu] = useState<CPUState>(() =>
    createInitialCPUState(assembleProgram(cpuAssemblyDraft || CPU_PROGRAM_PRESETS[0].assembly).memoryImage)
  );
  const [running, setRunning] = useState(false);
  const [speedHz, setSpeedHz] = useState(4);
  const [memRegion, setMemRegion] = useState<'code' | 'data'>('data');

  useEffect(() => {
    if (cpuAssemblyDraft) {
      setAssembly(cpuAssemblyDraft);
      const res = assembleProgram(cpuAssemblyDraft);
      setAsmResult(res);
      if (res.success) {
        setCpu(createInitialCPUState(res.memoryImage));
      }
    }
  }, [cpuAssemblyDraft]);

  useEffect(() => {
    if (!running || cpu.halted) {
      if (cpu.halted && running) setRunning(false);
      return;
    }
    const ms = Math.max(50, Math.round(1000 / speedHz));
    const id = window.setInterval(() => {
      setCpu((prev) => {
        if (prev.halted) return prev;
        return stepCPU(prev);
      });
    }, ms);
    return () => window.clearInterval(id);
  }, [running, cpu.halted, speedHz]);

  const handleAssembleAndLoad = (source = assembly) => {
    setRunning(false);
    const res = assembleProgram(source);
    setAsmResult(res);
    if (res.success) {
      setCpu(createInitialCPUState(res.memoryImage));
      pushToast({
        tone: 'success',
        title: `Assembled ${res.instructions.length} instructions into RAM`,
        detail: 'Program loaded starting at 0x00.',
      });
    } else {
      pushToast({
        tone: 'error',
        title: `Assembly failed (${res.errors.length} error${res.errors.length > 1 ? 's' : ''})`,
        detail: res.errors[0]?.message,
      });
    }
  };

  const handleReset = () => {
    setRunning(false);
    setCpu(createInitialCPUState(asmResult.success ? asmResult.memoryImage : undefined));
  };

  const handleSaveCpuProject = () => {
    void saveCustomProject({
      id: `cpu-${Date.now()}`,
      name: `8-Bit CPU Program (${asmResult.instructions.length} ops)`,
      kind: 'cpu',
      description: 'Saved 8-bit educational CPU assembly program.',
      createdAt: Date.now(),
      cpuAssembly: assembly,
    });
  };

  const p = cpu.activePath;
  const lineCol = (active: boolean) => (active ? '#5B4CE6' : '#CBD5E1');
  const boxFill = (active: boolean) => (active ? '#F2EFFF' : '#FFFFFF');
  const boxStroke = (active: boolean) => (active ? '#5B4CE6' : '#94A3B8');

  const memStart = memRegion === 'code' ? 0x00 : 0x80;

  return (
    <div className="h-full overflow-y-auto bg-[#F7F5FF]">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Top Control Bar */}
        <div className="bg-white border border-[#E4DFF7] rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={running ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => setRunning((r) => !r)}
              disabled={!asmResult.success || cpu.halted}
            >
              {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{running ? 'Pause' : 'Run CPU'}</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setRunning(false);
                setCpu((prev) => stepCPU(prev));
              }}
              disabled={!asmResult.success || cpu.halted}
            >
              <StepForward className="w-3.5 h-3.5" />
              <span>Step Instruction</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </Button>

            <span className="w-px h-4 bg-[#E4DFF7] mx-1" aria-hidden="true" />

            <label className="flex items-center gap-2 text-xs text-[#475569]">
              <span>Clock</span>
              <input
                type="range"
                min={1}
                max={20}
                value={speedHz}
                onChange={(e) => setSpeedHz(Number(e.target.value))}
                className="w-20 accent-[#5B4CE6]"
              />
              <span className="font-mono text-[#141226] tabular-nums w-12">{speedHz} Hz</span>
            </label>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
            <span className="text-[#475569]">
              Cycle <strong className="text-[#141226]">{cpu.cycle}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-[#475569]">
              Stage <strong className="text-[#5B4CE6]">{cpu.stage}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-[#475569]">
              OUT <strong className="text-[#16A34A]">{cpu.outputPort} (0x{toHex2(cpu.outputPort)})</strong>
            </span>
            <Button variant="secondary" size="sm" onClick={handleSaveCpuProject}>
              <Save className="w-3.5 h-3.5" />
              <span>Save Program</span>
            </Button>
          </div>
        </div>

        {/* Visual Datapath + Registers Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Interactive Datapath Architecture SVG */}
          <div className="xl:col-span-8 bg-white border border-[#E4DFF7] rounded-lg p-5 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#141226]">
                  Educational 8-Bit CPU Datapath
                </h2>
                <p className="text-xs text-[#64748B]">
                  Active buses and functional units illuminate during each executed instruction. Educational ISA (not a commercial processor).
                </p>
              </div>
              <div className="text-xs font-mono text-[#141226] tabular-nums">
                IR: <span className="text-[#5B4CE6] font-semibold">{cpu.irText}</span>
              </div>
            </div>

            <div className="bg-[#F7F5FF] border border-[#E4DFF7] rounded-lg p-3 overflow-x-auto">
              <svg viewBox="0 0 760 300" className="w-full min-w-[620px] h-auto">
                {/* Address Bus */}
                <path
                  d="M 130 66 H 210"
                  stroke={lineCol(p.pcToMem)}
                  strokeWidth={p.pcToMem ? 3 : 2}
                  fill="none"
                />
                {/* Mem -> IR */}
                <path
                  d="M 350 66 H 410"
                  stroke={lineCol(p.memToIr)}
                  strokeWidth={p.memToIr ? 3 : 2}
                  fill="none"
                />
                {/* IR -> Control Unit */}
                <path
                  d="M 480 96 V 136"
                  stroke={lineCol(p.irToControl)}
                  strokeWidth={p.irToControl ? 3 : 2}
                  fill="none"
                />
                {/* Regs -> ALU */}
                <path
                  d="M 350 218 H 430"
                  stroke={lineCol(p.regToAlu)}
                  strokeWidth={p.regToAlu ? 3 : 2}
                  fill="none"
                />
                {/* ALU -> Regs feedback */}
                <path
                  d="M 505 268 V 286 H 275 V 264"
                  stroke={lineCol(p.aluToReg)}
                  strokeWidth={p.aluToReg ? 3 : 2}
                  fill="none"
                />
                {/* ALU -> Flags */}
                <path
                  d="M 578 218 H 628"
                  stroke={lineCol(p.aluToFlags)}
                  strokeWidth={p.aluToFlags ? 3 : 2}
                  fill="none"
                />
                {/* Mem <-> Regs data path */}
                <path
                  d="M 280 112 V 172"
                  stroke={lineCol(p.memToReg || p.regToMem)}
                  strokeWidth={p.memToReg || p.regToMem ? 3 : 2}
                  fill="none"
                />
                {/* Branch path Control -> PC */}
                <path
                  d="M 628 164 H 715 V 22 H 75 V 36"
                  stroke={lineCol(p.branchTaken)}
                  strokeWidth={p.branchTaken ? 3 : 1.5}
                  strokeDasharray={p.branchTaken ? undefined : '4 4'}
                  fill="none"
                />

                {/* PC Box */}
                <g>
                  <rect
                    x={20}
                    y={36}
                    width={110}
                    height={64}
                    rx={7}
                    fill={boxFill(p.pcToMem || p.branchTaken)}
                    stroke={boxStroke(p.pcToMem || p.branchTaken)}
                    strokeWidth={1.8}
                  />
                  <text x={75} y={56} textAnchor="middle" className="font-mono text-[10px] font-semibold" fill="#475569">
                    PROGRAM CTR
                  </text>
                  <text x={75} y={82} textAnchor="middle" className="font-mono text-base font-bold" fill="#141226">
                    0x{toHex2(cpu.pc)}
                  </text>
                </g>

                {/* Memory Box */}
                <g>
                  <rect
                    x={210}
                    y={36}
                    width={140}
                    height={76}
                    rx={7}
                    fill={boxFill(p.pcToMem || p.memToReg || p.regToMem)}
                    stroke={boxStroke(p.pcToMem || p.memToReg || p.regToMem)}
                    strokeWidth={1.8}
                  />
                  <text x={280} y={56} textAnchor="middle" className="font-mono text-[10px] font-semibold" fill="#475569">
                    256B RAM
                  </text>
                  <text x={280} y={76} textAnchor="middle" className="font-mono text-xs font-bold" fill="#141226">
                    ADDR: 0x{toHex2(cpu.addressBus)}
                  </text>
                  <text x={280} y={95} textAnchor="middle" className="font-mono text-xs text-[#64748B]" fill="#64748B">
                    DATA: 0x{toHex2(cpu.dataBus)}
                  </text>
                </g>

                {/* IR Box */}
                <g>
                  <rect
                    x={410}
                    y={36}
                    width={140}
                    height={60}
                    rx={7}
                    fill={boxFill(p.memToIr)}
                    stroke={boxStroke(p.memToIr)}
                    strokeWidth={1.8}
                  />
                  <text x={480} y={55} textAnchor="middle" className="font-mono text-[10px] font-semibold" fill="#475569">
                    INSTRUCTION REG
                  </text>
                  <text x={480} y={78} textAnchor="middle" className="font-mono text-xs font-bold" fill="#141226">
                    0x{cpu.ir.toString(16).toUpperCase().padStart(4, '0')}
                  </text>
                </g>

                {/* Control Unit */}
                <g>
                  <rect
                    x={410}
                    y={136}
                    width={218}
                    height={46}
                    rx={7}
                    fill={boxFill(p.irToControl)}
                    stroke={boxStroke(p.irToControl)}
                    strokeWidth={1.8}
                  />
                  <text x={519} y={156} textAnchor="middle" className="font-mono text-[10px] font-semibold" fill="#475569">
                    CONTROL UNIT & DECODER
                  </text>
                  <text x={519} y={173} textAnchor="middle" className="font-mono text-[11px] font-bold" fill="#5B4CE6">
                    {cpu.irText}
                  </text>
                </g>

                {/* Register File */}
                <g>
                  <rect
                    x={210}
                    y={172}
                    width={140}
                    height={92}
                    rx={7}
                    fill={boxFill(p.regToAlu || p.aluToReg || p.memToReg || p.regToMem)}
                    stroke={boxStroke(p.regToAlu || p.aluToReg || p.memToReg || p.regToMem)}
                    strokeWidth={1.8}
                  />
                  <text x={280} y={190} textAnchor="middle" className="font-mono text-[10px] font-semibold" fill="#475569">
                    REGISTER FILE
                  </text>
                  {cpu.registers.map((val, idx) => (
                    <text
                      key={idx}
                      x={idx % 2 === 0 ? 248 : 312}
                      y={idx < 2 ? 216 : 244}
                      textAnchor="middle"
                      className="font-mono text-xs font-bold"
                      fill="#141226"
                    >
                      R{idx}:{toHex2(val)}
                    </text>
                  ))}
                </g>

                {/* ALU */}
                <g>
                  <rect
                    x={430}
                    y={202}
                    width={148}
                    height={66}
                    rx={7}
                    fill={boxFill(p.regToAlu || p.aluToReg)}
                    stroke={boxStroke(p.regToAlu || p.aluToReg)}
                    strokeWidth={1.8}
                  />
                  <text x={504} y={224} textAnchor="middle" className="font-mono text-[10px] font-semibold" fill="#475569">
                    8-BIT ALU
                  </text>
                  <text x={504} y={248} textAnchor="middle" className="font-mono text-sm font-bold" fill="#141226">
                    BUS: 0x{toHex2(cpu.dataBus)}
                  </text>
                </g>

                {/* Flags */}
                <g>
                  <rect
                    x={628}
                    y={202}
                    width={112}
                    height={66}
                    rx={7}
                    fill={boxFill(p.aluToFlags)}
                    stroke={boxStroke(p.aluToFlags)}
                    strokeWidth={1.8}
                  />
                  <text x={684} y={224} textAnchor="middle" className="font-mono text-[10px] font-semibold" fill="#475569">
                    STATUS FLAGS
                  </text>
                  <text x={684} y={248} textAnchor="middle" className="font-mono text-xs font-bold" fill="#141226">
                    Z:{cpu.flags.Z ? '1' : '0'} C:{cpu.flags.C ? '1' : '0'} N:{cpu.flags.N ? '1' : '0'}
                  </text>
                </g>

                {/* Clock & Output Port */}
                <g>
                  <rect x={20} y={172} width={110} height={92} rx={7} fill="#FFFFFF" stroke="#CBD5E1" strokeWidth={1.5} />
                  <text x={75} y={194} textAnchor="middle" className="font-mono text-[10px] font-semibold" fill="#475569">
                    OUTPUT PORT
                  </text>
                  <text x={75} y={226} textAnchor="middle" className="font-mono text-xl font-bold" fill="#16A34A">
                    {cpu.outputPort}
                  </text>
                  <text x={75} y={248} textAnchor="middle" className="font-mono text-[10px]" fill="#64748B">
                    0x{toHex2(cpu.outputPort)}
                  </text>
                </g>
              </svg>
            </div>
          </div>

          {/* Live Registers & Flags Table */}
          <div className="xl:col-span-4 bg-white border border-[#E4DFF7] rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-[#141226]">Registers & Status Flags</h3>
            <table className="w-full text-xs font-mono tabular-nums">
              <thead className="text-[#64748B] border-b border-[#E4DFF7]">
                <tr>
                  <th className="py-1.5 text-left">REG</th>
                  <th className="py-1.5 text-right">DEC</th>
                  <th className="py-1.5 text-right">HEX</th>
                  <th className="py-1.5 text-right">BINARY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EEFC]">
                {cpu.registers.map((val, idx) => (
                  <tr key={idx}>
                    <td className="py-2 font-semibold text-[#5B4CE6]">R{idx}</td>
                    <td className="py-2 text-right text-[#141226]">{val}</td>
                    <td className="py-2 text-right text-[#141226]">0x{toHex2(val)}</td>
                    <td className="py-2 text-right text-[#64748B]">{toBin8(val)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 font-semibold text-[#141226]">PC</td>
                  <td className="py-2 text-right text-[#141226]">{cpu.pc}</td>
                  <td className="py-2 text-right text-[#141226]">0x{toHex2(cpu.pc)}</td>
                  <td className="py-2 text-right text-[#64748B]">{toBin8(cpu.pc)}</td>
                </tr>
              </tbody>
            </table>

            <div className="border-t border-[#E4DFF7] pt-3 grid grid-cols-3 gap-2 font-mono text-xs text-center">
              {[
                { label: 'ZERO (Z)', on: cpu.flags.Z },
                { label: 'CARRY (C)', on: cpu.flags.C },
                { label: 'NEG (N)', on: cpu.flags.N },
              ].map((f) => (
                <div
                  key={f.label}
                  className={`py-2 px-1 rounded border ${
                    f.on ? 'bg-[#F2EFFF] border-[#5B4CE6] text-[#4A3BD6] font-bold' : 'bg-[#F7F5FF] border-[#E4DFF7] text-[#64748B]'
                  }`}
                >
                  {f.label}: {f.on ? '1' : '0'}
                </div>
              ))}
            </div>

            {cpu.outputHistory.length > 0 && (
              <div className="border-t border-[#E4DFF7] pt-3">
                <div className="text-xs font-medium text-[#475569] mb-1">OUT Port Stream</div>
                <div className="font-mono text-xs text-[#15803D] bg-[#F7F5FF] border border-[#E4DFF7] rounded p-2">
                  {cpu.outputHistory.join(', ')}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom 3-Column Section: Assembly Editor, RAM Inspector, Execution Trace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Assembly Program Editor */}
          <div className="lg:col-span-5 bg-white border border-[#E4DFF7] rounded-lg p-5 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#141226]">Assembly Editor</h3>
              <div className="flex items-center gap-2">
                <select
                  aria-label="Load CPU preset program"
                  defaultValue=""
                  onChange={(e) => {
                    const preset = CPU_PROGRAM_PRESETS.find((x) => x.id === e.target.value);
                    if (preset) {
                      setAssembly(preset.assembly);
                      handleAssembleAndLoad(preset.assembly);
                    }
                    e.target.value = '';
                  }}
                  className="text-xs bg-[#F7F5FF] border border-[#E4DFF7] rounded px-2 py-1 cursor-pointer"
                >
                  <option value="" disabled>
                    Load Program...
                  </option>
                  {CPU_PROGRAM_PRESETS.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name}
                    </option>
                  ))}
                </select>
                <Button variant="primary" size="sm" onClick={() => handleAssembleAndLoad()}>
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Assemble & Load</span>
                </Button>
              </div>
            </div>

            <textarea
              value={assembly}
              onChange={(e) => setAssembly(e.target.value)}
              spellCheck={false}
              rows={14}
              aria-label="8-bit CPU assembly code"
              className="w-full font-mono text-xs leading-relaxed bg-[#F7F5FF] border border-[#E4DFF7] rounded-lg p-3 text-[#141226] focus:outline-none focus:border-[#5B4CE6] resize-y"
            />

            {asmResult.success ? (
              <div className="flex items-center gap-2 text-xs text-[#15803D]">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Assembled {asmResult.instructions.length} instructions ({asmResult.instructions.length * 2} bytes) with zero errors.
                </span>
              </div>
            ) : (
              <div className="space-y-1.5 bg-[#FEF2F2] border border-[#FECACA] rounded-md p-3">
                {asmResult.errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-[#B91C1C]">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div>
                      <strong>Line {err.line}:</strong> {err.message}{' '}
                      <span className="text-[#991B1B]">{err.suggestion}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live 256-Byte Memory Inspector */}
          <div className="lg:col-span-4 bg-white border border-[#E4DFF7] rounded-lg p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#141226]">256-Byte Memory</h3>
              <div className="inline-flex rounded-md border border-[#E4DFF7] overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setMemRegion('code')}
                  className={`px-2.5 py-1 cursor-pointer ${
                    memRegion === 'code' ? 'bg-[#5B4CE6] text-white' : 'bg-white text-[#475569]'
                  }`}
                >
                  Code 0x00–0x7F
                </button>
                <button
                  type="button"
                  onClick={() => setMemRegion('data')}
                  className={`px-2.5 py-1 cursor-pointer ${
                    memRegion === 'data' ? 'bg-[#5B4CE6] text-white' : 'bg-white text-[#475569]'
                  }`}
                >
                  Data 0x80–0xFF
                </button>
              </div>
            </div>

            <div className="grid grid-cols-8 gap-1 font-mono text-[11px] tabular-nums">
              {Array.from({ length: 64 }, (_, offset) => {
                const addr = memStart + offset;
                const val = cpu.memory[addr] ?? 0;
                const isPc = addr === cpu.pc || addr === cpu.pc + 1;
                const isAddrBus = addr === cpu.addressBus && cpu.cycle > 0;
                return (
                  <div
                    key={addr}
                    title={`RAM[0x${toHex2(addr)}] = ${val} (0x${toHex2(val)})`}
                    className={`py-1.5 text-center rounded border ${
                      isPc
                        ? 'bg-[#EDE9FE] border-[#5B4CE6] text-[#4A3BD6] font-bold'
                        : isAddrBus
                          ? 'bg-[#DCFCE7] border-[#16A34A] text-[#15803D] font-bold'
                          : val !== 0
                            ? 'bg-[#F7F5FF] border-[#CBD5E1] text-[#141226] font-semibold'
                            : 'bg-white border-[#F1EEFC] text-[#94A3B8]'
                    }`}
                  >
                    {toHex2(val)}
                  </div>
                );
              })}
            </div>
            <div className="text-[11px] text-[#64748B]">
              Showing 0x{toHex2(memStart)}–0x{toHex2(memStart + 63)}. Blue = PC instruction bytes; Green = active memory access.
            </div>
          </div>

          {/* Execution History Trace */}
          <div className="lg:col-span-3 bg-white border border-[#E4DFF7] rounded-lg p-5 flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-[#141226]">Execution Trace</h3>
            <div className="flex-1 max-h-[340px] overflow-y-auto divide-y divide-[#F1EEFC]">
              {cpu.trace.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#64748B]">
                  Click <strong>Step Instruction</strong> or <strong>Run CPU</strong> to inspect executed instructions.
                </div>
              ) : (
                cpu.trace.map((entry) => (
                  <div key={entry.cycle} className="py-2 text-xs font-mono">
                    <div className="flex items-center justify-between text-[#141226]">
                      <span className="font-semibold">{entry.instruction}</span>
                      <span className="text-[11px] text-[#64748B]">
                        #{entry.cycle} @0x{toHex2(entry.pc)}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#475569] mt-0.5">{entry.summary}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
