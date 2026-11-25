import React, { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { SignalState } from '../../types/circuit';
import {
  logicAnd,
  logicNand,
  logicNor,
  logicNot,
  logicOr,
  logicXnor,
  logicXor,
} from '../../engine/signals/signalModel';
import { parseHDL, synthesizeHDLToCircuit, generateHDLTruthTable } from '../../engine/hdl/hdlEngine';
import { useChipCraftStore } from '../../state/useChipCraftStore';
import { Button, SegmentedTabs } from '../../design-system/ui';

type LabGateType = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'XNOR' | 'BUFFER';

interface GateLesson {
  type: LabGateType;
  name: string;
  expression: string;
  unary?: boolean;
  description: string;
  useCase: string;
  evalFn: (a: SignalState, b: SignalState) => SignalState;
}

const GATE_LESSONS: GateLesson[] = [
  {
    type: 'AND',
    name: 'AND Gate',
    expression: 'Y = A · B',
    description: 'Outputs HIGH (1) strictly when all inputs are HIGH.',
    useCase: 'Signal masking, enable gating, and binary carry generation.',
    evalFn: (a, b) => logicAnd([a, b]),
  },
  {
    type: 'OR',
    name: 'OR Gate',
    expression: 'Y = A + B',
    description: 'Outputs HIGH (1) if at least one input is HIGH.',
    useCase: 'Combining interrupt requests and sum-of-products logic.',
    evalFn: (a, b) => logicOr([a, b]),
  },
  {
    type: 'NOT',
    name: 'NOT Gate (Inverter)',
    expression: 'Y = ¬A',
    unary: true,
    description: 'Inverts the binary logic level of its single input.',
    useCase: 'Active-LOW control signals and two’s complement subtraction.',
    evalFn: (a) => logicNot(a),
  },
  {
    type: 'NAND',
    name: 'NAND Gate',
    expression: 'Y = ¬(A · B)',
    description: 'Functionally complete universal gate: outputs LOW only when all inputs are HIGH.',
    useCase: 'Any digital circuit or CPU can be constructed exclusively from NAND gates.',
    evalFn: (a, b) => logicNand([a, b]),
  },
  {
    type: 'NOR',
    name: 'NOR Gate',
    expression: 'Y = ¬(A + B)',
    description: 'Universal gate: outputs HIGH only when every input is LOW.',
    useCase: 'Zero-flag detection in ALUs and cross-coupled SR latches.',
    evalFn: (a, b) => logicNor([a, b]),
  },
  {
    type: 'XOR',
    name: 'XOR Gate',
    expression: 'Y = A ⊕ B',
    description: 'Exclusive-OR: outputs HIGH when inputs are different.',
    useCase: 'Binary addition (Sum bit), parity generation, and bit toggling.',
    evalFn: (a, b) => logicXor([a, b]),
  },
  {
    type: 'XNOR',
    name: 'XNOR Gate',
    expression: 'Y = ¬(A ⊕ B)',
    description: 'Equivalence detector: outputs HIGH when both inputs share the same state.',
    useCase: 'Single-bit equality comparators and address match circuits.',
    evalFn: (a, b) => logicXnor([a, b]),
  },
  {
    type: 'BUFFER',
    name: 'Buffer',
    expression: 'Y = A',
    unary: true,
    description: 'Restores signal strength and isolates loading without altering logic value.',
    useCase: 'Bus driving, clock tree distribution, and propagation delay matching.',
    evalFn: (a) => a,
  },
];

export function LogicGateLab() {
  const [tab, setTab] = useState<'explorer' | 'experiments' | 'boolean'>('explorer');
  const [selectedGate, setSelectedGate] = useState<LabGateType>('AND');
  const [inA, setInA] = useState<0 | 1>(1);
  const [inB, setInB] = useState<0 | 1>(1);

  // Experiment states
  const [expA, setExpA] = useState<0 | 1>(1);
  const [expB, setExpB] = useState<0 | 1>(0);
  const [nandTarget, setNandTarget] = useState<'NOT' | 'AND' | 'OR'>('AND');

  // Boolean Expression Converter
  const [boolExpr, setBoolExpr] = useState('(a & b) | (~a & c)');

  const loadCircuitDocument = useChipCraftStore((s) => s.loadCircuitDocument);
  const setWorkspace = useChipCraftStore((s) => s.setWorkspace);

  const lesson = GATE_LESSONS.find((g) => g.type === selectedGate) ?? GATE_LESSONS[0];
  const sigA: SignalState = inA ? 'HIGH' : 'LOW';
  const sigB: SignalState = inB ? 'HIGH' : 'LOW';
  const liveOut = lesson.evalFn(sigA, sigB);

  const truthRows = useMemo(() => {
    if (lesson.unary) {
      return [0, 1].map((a) => ({
        a,
        b: null as number | null,
        out: lesson.evalFn(a ? 'HIGH' : 'LOW', 'LOW') === 'HIGH' ? 1 : 0,
      }));
    }
    return [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ].map(([a, b]) => ({
      a,
      b,
      out: lesson.evalFn(a ? 'HIGH' : 'LOW', b ? 'HIGH' : 'LOW') === 'HIGH' ? 1 : 0,
    }));
  }, [lesson]);

  // Real NAND-only universal gate evaluation
  const nandExpResult = useMemo(() => {
    const a: SignalState = expA ? 'HIGH' : 'LOW';
    const b: SignalState = expB ? 'HIGH' : 'LOW';
    if (nandTarget === 'NOT') {
      const y = logicNand([a, a]);
      return { gates: 1, formula: 'NAND(A, A)', expected: logicNot(a), actual: y };
    }
    if (nandTarget === 'AND') {
      const n1 = logicNand([a, b]);
      const y = logicNand([n1, n1]);
      return { gates: 2, formula: 'NAND(NAND(A, B), NAND(A, B))', expected: logicAnd([a, b]), actual: y };
    }
    const na = logicNand([a, a]);
    const nb = logicNand([b, b]);
    const y = logicNand([na, nb]);
    return { gates: 3, formula: 'NAND(NAND(A, A), NAND(B, B))', expected: logicOr([a, b]), actual: y };
  }, [expA, expB, nandTarget]);

  // Boolean Expression -> Parsed HDL AST -> Truth Table & Circuit Synthesis
  const boolSynthesis = useMemo(() => {
    const vars = Array.from(new Set(boolExpr.match(/\b[a-dA-D]\b/g)?.map((v) => v.toLowerCase()) ?? ['a', 'b'])).sort();
    const hdlSource = `module boolean_expr(\n${vars.map((v) => `  input wire ${v},`).join('\n')}\n  output wire y\n);\nassign y = ${boolExpr.toLowerCase()};\nendmodule`;
    const parsed = parseHDL(hdlSource);
    const table = parsed.success && parsed.ast ? generateHDLTruthTable(parsed.ast, 4) : [];
    return { vars, parsed, table };
  }, [boolExpr]);

  const handleSynthesizeToStudio = () => {
    if (!boolSynthesis.parsed.ast) return;
    const doc = synthesizeHDLToCircuit(boolSynthesis.parsed.ast);
    doc.name = `Expr: ${boolExpr}`;
    loadCircuitDocument(doc, null);
    setWorkspace('circuit-studio');
  };

  return (
    <div className="h-full overflow-y-auto bg-[#F7F5FF]">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#141226]">Interactive Digital Logic Laboratory</h2>
            <p className="text-sm text-[#64748B] mt-0.5">
              Manipulate inputs, verify truth tables, build universal NAND circuits, and convert Boolean formulas into live schematics.
            </p>
          </div>
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            options={[
              { value: 'explorer', label: 'Gate Explorer' },
              { value: 'experiments', label: 'Guided Experiments' },
              { value: 'boolean', label: 'Boolean to Circuit' },
            ]}
          />
        </div>

        {/* TAB 1: GATE EXPLORER */}
        {tab === 'explorer' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Gate selector sidebar */}
            <div className="lg:col-span-3 bg-white border border-[#E4DFF7] rounded-lg p-2 space-y-1 h-fit">
              {GATE_LESSONS.map((g) => {
                const active = g.type === selectedGate;
                return (
                  <button
                    key={g.type}
                    type="button"
                    onClick={() => setSelectedGate(g.type)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#F2EFFF] text-[#5B4CE6] font-semibold'
                        : 'text-[#334155] hover:bg-[#F7F5FF]'
                    }`}
                  >
                    <span className="text-sm">{g.name}</span>
                    <span className="font-mono text-[11px] opacity-80">{g.expression}</span>
                  </button>
                );
              })}
            </div>

            {/* Live interactive gate stage + truth table */}
            <div className="lg:col-span-9 space-y-6">
              <div className="bg-white border border-[#E4DFF7] rounded-lg p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-7 space-y-4">
                  <div>
                    <div className="text-lg font-bold text-[#141226]">{lesson.name}</div>
                    <div className="font-mono text-sm text-[#5B4CE6] mt-0.5">{lesson.expression}</div>
                  </div>
                  <p className="text-sm text-[#475569] leading-relaxed">{lesson.description}</p>
                  <p className="text-xs text-[#64748B]">Engineering role: {lesson.useCase}</p>

                  {/* Interactive Gate Diagram */}
                  <div className="bg-[#F7F5FF] border border-[#E4DFF7] rounded-lg p-4">
                    <svg viewBox="0 0 420 150" className="w-full h-auto">
                      {/* Input A Wire */}
                      <line
                        x1={95}
                        y1={lesson.unary ? 75 : 52}
                        x2={170}
                        y2={lesson.unary ? 75 : 52}
                        stroke={inA ? '#16A34A' : '#64748B'}
                        strokeWidth={3}
                      />
                      {/* Input B Wire */}
                      {!lesson.unary && (
                        <line
                          x1={95}
                          y1={98}
                          x2={170}
                          y2={98}
                          stroke={inB ? '#16A34A' : '#64748B'}
                          strokeWidth={3}
                        />
                      )}
                      {/* Output Wire */}
                      <line
                        x1={262}
                        y1={75}
                        x2={330}
                        y2={75}
                        stroke={liveOut === 'HIGH' ? '#16A34A' : '#64748B'}
                        strokeWidth={3}
                      />

                      {/* Toggle A */}
                      <g onClick={() => setInA((v) => (v ? 0 : 1))} className="cursor-pointer">
                        <rect
                          x={16}
                          y={lesson.unary ? 55 : 32}
                          width={79}
                          height={40}
                          rx={7}
                          fill={inA ? '#DCFCE7' : '#FFFFFF'}
                          stroke={inA ? '#16A34A' : '#CBD5E1'}
                          strokeWidth={1.8}
                        />
                        <text
                          x={55}
                          y={lesson.unary ? 80 : 57}
                          textAnchor="middle"
                          className="font-mono text-xs font-bold"
                          fill="#141226"
                        >
                          A = {inA}
                        </text>
                      </g>

                      {/* Toggle B */}
                      {!lesson.unary && (
                        <g onClick={() => setInB((v) => (v ? 0 : 1))} className="cursor-pointer">
                          <rect
                            x={16}
                            y={78}
                            width={79}
                            height={40}
                            rx={7}
                            fill={inB ? '#DCFCE7' : '#FFFFFF'}
                            stroke={inB ? '#16A34A' : '#CBD5E1'}
                            strokeWidth={1.8}
                          />
                          <text
                            x={55}
                            y={103}
                            textAnchor="middle"
                            className="font-mono text-xs font-bold"
                            fill="#141226"
                          >
                            B = {inB}
                          </text>
                        </g>
                      )}

                      {/* Gate Body */}
                      {lesson.type === 'AND' || lesson.type === 'NAND' ? (
                        <g>
                          <path
                            d="M 168 38 L 218 38 A 37 37 0 0 1 218 112 L 168 112 Z"
                            fill="#FFFFFF"
                            stroke="#141226"
                            strokeWidth={2}
                          />
                          {lesson.type === 'NAND' && (
                            <circle cx={261} cy={75} r={6} fill="#FFFFFF" stroke="#141226" strokeWidth={2} />
                          )}
                        </g>
                      ) : lesson.type === 'NOT' || lesson.type === 'BUFFER' ? (
                        <g>
                          <polygon
                            points="168,40 250,75 168,110"
                            fill="#FFFFFF"
                            stroke="#141226"
                            strokeWidth={2}
                          />
                          {lesson.type === 'NOT' && (
                            <circle cx={257} cy={75} r={6} fill="#FFFFFF" stroke="#141226" strokeWidth={2} />
                          )}
                        </g>
                      ) : (
                        <g>
                          {(lesson.type === 'XOR' || lesson.type === 'XNOR') && (
                            <path
                              d="M 160 40 Q 174 75 160 110"
                              fill="none"
                              stroke="#141226"
                              strokeWidth={2}
                            />
                          )}
                          <path
                            d="M 170 38 Q 184 75 170 112 Q 226 112 254 75 Q 226 38 170 38 Z"
                            fill="#FFFFFF"
                            stroke="#141226"
                            strokeWidth={2}
                          />
                          {(lesson.type === 'NOR' || lesson.type === 'XNOR') && (
                            <circle cx={261} cy={75} r={6} fill="#FFFFFF" stroke="#141226" strokeWidth={2} />
                          )}
                        </g>
                      )}

                      <text
                        x={208}
                        y={79}
                        textAnchor="middle"
                        className="font-mono text-xs font-bold"
                        fill="#334155"
                      >
                        {lesson.type}
                      </text>

                      {/* Output Indicator */}
                      <rect
                        x={330}
                        y={53}
                        width={76}
                        height={44}
                        rx={8}
                        fill={liveOut === 'HIGH' ? '#DCFCE7' : '#FFFFFF'}
                        stroke={liveOut === 'HIGH' ? '#16A34A' : '#CBD5E1'}
                        strokeWidth={1.8}
                      />
                      <text
                        x={368}
                        y={79}
                        textAnchor="middle"
                        className="font-mono text-sm font-bold"
                        fill={liveOut === 'HIGH' ? '#15803D' : '#475569'}
                      >
                        Y = {liveOut === 'HIGH' ? '1' : '0'}
                      </text>
                    </svg>
                  </div>
                </div>

                {/* Live Truth Table */}
                <div className="md:col-span-5">
                  <div className="text-xs font-semibold text-[#141226] mb-2">Truth Table</div>
                  <table className="w-full text-sm font-mono tabular-nums border border-[#E4DFF7] rounded-lg overflow-hidden">
                    <thead className="bg-[#F1EEFC] text-xs text-[#475569]">
                      <tr>
                        <th className="py-2 px-3 text-center border-b border-[#E4DFF7]">A</th>
                        {!lesson.unary && (
                          <th className="py-2 px-3 text-center border-b border-[#E4DFF7]">B</th>
                        )}
                        <th className="py-2 px-3 text-center border-b border-[#E4DFF7]">OUTPUT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4DFF7]">
                      {truthRows.map((row, idx) => {
                        const isCurrent = row.a === inA && (lesson.unary || row.b === inB);
                        return (
                          <tr
                            key={idx}
                            onClick={() => {
                              setInA(row.a as 0 | 1);
                              if (row.b !== null) setInB(row.b as 0 | 1);
                            }}
                            className={`cursor-pointer transition-colors ${
                              isCurrent ? 'bg-[#F2EFFF] font-bold text-[#4A3BD6]' : 'hover:bg-[#F7F5FF]'
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center">{row.a}</td>
                            {!lesson.unary && <td className="py-2.5 px-3 text-center">{row.b}</td>}
                            <td
                              className={`py-2.5 px-3 text-center ${
                                row.out === 1 ? 'text-[#16A34A] font-bold' : 'text-[#64748B]'
                              }`}
                            >
                              {row.out}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="text-[11px] text-[#64748B] mt-2">
                    Click any row to apply that input combination immediately.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GUIDED EXPERIMENTS */}
        {tab === 'experiments' && (
          <div className="space-y-6">
            {/* Shared experiment input toggles */}
            <div className="bg-white border border-[#E4DFF7] rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-[#141226]">Experiment Stimulus Inputs</div>
                <div className="text-xs text-[#64748B]">Toggle A and B to observe all live experiments simultaneously</div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant={expA ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setExpA((v) => (v ? 0 : 1))}
                >
                  Input A = {expA}
                </Button>
                <Button
                  variant={expB ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setExpB((v) => (v ? 0 : 1))}
                >
                  Input B = {expB}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Experiment 1: Compare AND, OR, XOR */}
              <div className="bg-white border border-[#E4DFF7] rounded-lg p-5 space-y-4">
                <div>
                  <div className="text-base font-semibold text-[#141226]">
                    01. Compare AND, OR, and XOR Side-by-Side
                  </div>
                  <p className="text-xs text-[#64748B] mt-1">
                    Notice how OR and XOR agree for (0,0), (0,1), and (1,0), but diverge at (1,1) where XOR drops back to 0.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 font-mono text-center">
                  {[
                    { name: 'AND (A·B)', val: expA & expB },
                    { name: 'OR (A+B)', val: expA | expB },
                    { name: 'XOR (A⊕B)', val: expA ^ expB },
                  ].map((item) => (
                    <div
                      key={item.name}
                      className={`p-4 rounded-lg border ${
                        item.val ? 'bg-[#ECFDF5] border-[#16A34A]' : 'bg-[#F7F5FF] border-[#E4DFF7]'
                      }`}
                    >
                      <div className="text-[11px] text-[#475569]">{item.name}</div>
                      <div
                        className={`text-2xl font-bold mt-1 ${
                          item.val ? 'text-[#16A34A]' : 'text-[#64748B]'
                        }`}
                      >
                        {item.val}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Experiment 2: Universal NAND-Only Construction */}
              <div className="bg-white border border-[#E4DFF7] rounded-lg p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-base font-semibold text-[#141226]">
                      02. Universal NAND-Only Synthesis
                    </div>
                    <p className="text-xs text-[#64748B] mt-1">
                      Build NOT, AND, and OR strictly using 2-input NAND gates.
                    </p>
                  </div>
                  <SegmentedTabs
                    value={nandTarget}
                    onChange={setNandTarget}
                    options={[
                      { value: 'NOT', label: 'NOT' },
                      { value: 'AND', label: 'AND' },
                      { value: 'OR', label: 'OR' },
                    ]}
                  />
                </div>

                <div className="bg-[#F7F5FF] border border-[#E4DFF7] rounded-lg p-4 space-y-2 font-mono text-xs">
                  <div className="text-[#475569]">
                    NAND Equivalent ({nandExpResult.gates} gate{nandExpResult.gates > 1 ? 's' : ''}):{' '}
                    <span className="text-[#141226] font-semibold">{nandExpResult.formula}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#E4DFF7]">
                    <span>
                      Expected {nandTarget}({expA}
                      {nandTarget === 'NOT' ? '' : `, ${expB}`}):{' '}
                      <strong className="text-[#141226]">
                        {nandExpResult.expected === 'HIGH' ? '1' : '0'}
                      </strong>
                    </span>
                    <span className="text-[#16A34A] font-bold">
                      NAND Network Output = {nandExpResult.actual === 'HIGH' ? '1' : '0'} (Match)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BOOLEAN EXPRESSION TO CIRCUIT */}
        {tab === 'boolean' && (
          <div className="bg-white border border-[#E4DFF7] rounded-lg p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-[#141226]">
                  Convert Boolean Expression into a Working Circuit
                </h3>
                <p className="text-xs text-[#64748B] mt-1">
                  Use variables <code className="font-mono">a, b, c, d</code> and operators{' '}
                  <code className="font-mono">&amp;</code> (AND), <code className="font-mono">|</code> (OR),{' '}
                  <code className="font-mono">^</code> (XOR), <code className="font-mono">~</code> (NOT).
                </p>
              </div>
              <Button
                variant="primary"
                disabled={!boolSynthesis.parsed.success}
                onClick={handleSynthesizeToStudio}
              >
                <span>Open Synthesized Circuit in Studio</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                '(a & b) | (~a & c)',
                '(a ^ b) ^ c',
                '~(a & b)',
                '(a | b) & (~c)',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setBoolExpr(preset)}
                  className="px-2.5 py-1 text-xs font-mono bg-[#F1EEFC] hover:bg-[#E4DFF7] text-[#334155] rounded cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={boolExpr}
              onChange={(e) => setBoolExpr(e.target.value)}
              aria-label="Boolean expression"
              className="w-full px-3.5 py-2.5 font-mono text-sm bg-[#F7F5FF] border border-[#E4DFF7] rounded-lg focus:outline-none focus:border-[#5B4CE6]"
            />

            {!boolSynthesis.parsed.success ? (
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-md text-xs text-[#B91C1C]">
                {boolSynthesis.parsed.errors[0]?.message} — {boolSynthesis.parsed.errors[0]?.suggestion}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono tabular-nums border border-[#E4DFF7]">
                  <thead className="bg-[#F1EEFC] text-[#475569]">
                    <tr>
                      {boolSynthesis.vars.map((v) => (
                        <th key={v} className="py-2 px-3 text-center border-b border-[#E4DFF7]">
                          {v.toUpperCase()}
                        </th>
                      ))}
                      <th className="py-2 px-3 text-center border-b border-[#E4DFF7] text-[#5B4CE6]">
                        Y = {boolExpr}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4DFF7]">
                    {boolSynthesis.table.map((row, idx) => (
                      <tr key={idx} className="hover:bg-[#F7F5FF]">
                        {boolSynthesis.vars.map((v) => (
                          <td key={v} className="py-1.5 px-3 text-center">
                            {row.inputs[v]}
                          </td>
                        ))}
                        <td
                          className={`py-1.5 px-3 text-center font-bold ${
                            row.outputs.y === 1 ? 'text-[#16A34A]' : 'text-[#64748B]'
                          }`}
                        >
                          {row.outputs.y}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
