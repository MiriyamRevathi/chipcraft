import React, { useEffect, useMemo, useState } from 'react';
import {
  Play,
  ArrowRight,
  Save,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  evaluateHDLModule,
  generateHDLTruthTable,
  HDL_PRESETS,
  parseHDL,
  synthesizeHDLToCircuit,
} from '../../engine/hdl/hdlEngine';
import { useChipCraftStore } from '../../state/useChipCraftStore';
import { Button } from '../../design-system/ui';

export function HDLStudio() {
  const hdlCodeDraft = useChipCraftStore((s) => s.hdlCodeDraft);
  const loadCircuitDocument = useChipCraftStore((s) => s.loadCircuitDocument);
  const setWorkspace = useChipCraftStore((s) => s.setWorkspace);
  const saveCustomProject = useChipCraftStore((s) => s.saveCustomProject);
  const pushToast = useChipCraftStore((s) => s.pushToast);

  const [code, setCode] = useState(hdlCodeDraft || HDL_PRESETS[1].code);
  const [vectorInputs, setVectorInputs] = useState<Record<string, 0 | 1>>({});

  useEffect(() => {
    if (hdlCodeDraft) setCode(hdlCodeDraft);
  }, [hdlCodeDraft]);

  const parseResult = useMemo(() => parseHDL(code), [code]);

  const inputPorts = useMemo(
    () => parseResult.ast?.ports.filter((p) => p.direction === 'input') ?? [],
    [parseResult.ast]
  );
  const outputPorts = useMemo(
    () => parseResult.ast?.ports.filter((p) => p.direction === 'output') ?? [],
    [parseResult.ast]
  );

  const manualOutput = useMemo(() => {
    if (!parseResult.ast) return {};
    const vec: Record<string, 0 | 1> = {};
    for (const p of inputPorts) {
      vec[p.name] = vectorInputs[p.name] ?? 0;
    }
    return evaluateHDLModule(parseResult.ast, vec);
  }, [parseResult.ast, inputPorts, vectorInputs]);

  const truthTable = useMemo(() => {
    if (!parseResult.ast) return [];
    return generateHDLTruthTable(parseResult.ast, 5);
  }, [parseResult.ast]);

  const handleSynthesize = () => {
    if (!parseResult.ast) return;
    const doc = synthesizeHDLToCircuit(parseResult.ast);
    loadCircuitDocument(doc, null);
    setWorkspace('circuit-studio');
    pushToast({
      tone: 'success',
      title: `Synthesized module "${parseResult.ast.name}" to Circuit Studio`,
      detail: `Generated ${doc.nodes.length} components and ${doc.wires.length} wires.`,
    });
  };

  const handleSaveHDL = () => {
    void saveCustomProject({
      id: `hdl-${Date.now()}`,
      name: parseResult.ast ? `HDL: ${parseResult.ast.name}` : 'HDL Module Draft',
      kind: 'hdl',
      description: 'Saved educational Verilog-subset HDL module.',
      createdAt: Date.now(),
      hdlCode: code,
    });
  };

  const lines = code.split('\n');

  return (
    <div className="h-full overflow-y-auto bg-[#F7F5FF]">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Top Action Bar */}
        <div className="bg-white border border-[#E4DFF7] rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Load HDL preset module"
              defaultValue=""
              onChange={(e) => {
                const pr = HDL_PRESETS.find((x) => x.id === e.target.value);
                if (pr) {
                  setCode(pr.code);
                  setVectorInputs({});
                }
                e.target.value = '';
              }}
              className="text-xs bg-[#F7F5FF] border border-[#E4DFF7] rounded-md px-2.5 py-1.5 cursor-pointer"
            >
              <option value="" disabled>
                Load HDL Example...
              </option>
              {HDL_PRESETS.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.name}
                </option>
              ))}
            </select>

            <Button
              variant="primary"
              size="sm"
              disabled={!parseResult.success}
              onClick={handleSynthesize}
            >
              <span>Synthesize to Circuit Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {parseResult.success ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-[#15803D]">
                <CheckCircle2 className="w-4 h-4" />
                Valid Module ({parseResult.ast?.name})
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-medium text-[#DC2626]">
                <AlertCircle className="w-4 h-4" />
                {parseResult.errors.length} Syntax Error{parseResult.errors.length > 1 ? 's' : ''}
              </span>
            )}
            <Button variant="secondary" size="sm" onClick={handleSaveHDL}>
              <Save className="w-3.5 h-3.5" />
              Save HDL
            </Button>
          </div>
        </div>

        {/* Main 2-Column Split: Code Editor + Testbench/Truth Table */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Code Editor & Diagnostics */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-white border border-[#E4DFF7] rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[#E4DFF7] bg-[#F7F5FF] flex items-center justify-between text-xs">
                <span className="font-mono font-semibold text-[#141226]">
                  {parseResult.ast ? `${parseResult.ast.name}.v` : 'module.v'}
                </span>
                <span className="text-[#64748B]">Educational Verilog-Subset Editor</span>
              </div>

              <div className="flex font-mono text-xs leading-6 bg-white">
                <div
                  aria-hidden="true"
                  className="select-none py-3 px-3 text-right text-[#94A3B8] bg-[#F7F5FF] border-r border-[#E4DFF7] tabular-nums"
                >
                  {lines.map((_, idx) => (
                    <div key={idx}>{idx + 1}</div>
                  ))}
                </div>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  spellCheck={false}
                  rows={Math.max(15, lines.length + 2)}
                  aria-label="HDL source code"
                  className="flex-1 p-3 font-mono text-xs leading-6 text-[#141226] focus:outline-none resize-y"
                />
              </div>
            </div>

            {/* Parser Diagnostics */}
            {(parseResult.errors.length > 0 || parseResult.warnings.length > 0) && (
              <div className="bg-white border border-[#E4DFF7] rounded-lg p-4 space-y-2">
                <div className="text-xs font-semibold text-[#141226]">Diagnostics</div>
                {parseResult.errors.map((err, i) => (
                  <div key={`e-${i}`} className="flex items-start gap-2 text-xs text-[#B91C1C]">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div>
                      <strong>Line {err.line}:</strong> {err.message}{' '}
                      <span className="text-[#64748B]">{err.suggestion}</span>
                    </div>
                  </div>
                ))}
                {parseResult.warnings.map((warn, i) => (
                  <div key={`w-${i}`} className="flex items-start gap-2 text-xs text-[#B45309]">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div>
                      <strong>Line {warn.line}:</strong> {warn.message}{' '}
                      <span className="text-[#64748B]">{warn.suggestion}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Clear Capability Boundary Notice */}
            <div className="bg-white border border-[#E4DFF7] rounded-lg p-4 space-y-2 text-xs">
              <div className="font-semibold text-[#141226]">Supported Educational Subset & Limitations</div>
              <p className="text-[#475569] leading-relaxed">
                <strong>Supported:</strong> <code className="font-mono">module ... endmodule</code>, scalar{' '}
                <code className="font-mono">input wire</code> / <code className="font-mono">output wire</code>,
                internal <code className="font-mono">wire</code>, continuous{' '}
                <code className="font-mono">assign</code> with <code className="font-mono">&amp; | ^ ~ ~&amp; ~| ~^ ?:</code>,
                constants <code className="font-mono">1&apos;b0</code>/<code className="font-mono">1&apos;b1</code>, and direct
                gate-level synthesis to Circuit Studio.
              </p>
              <p className="text-[#64748B] leading-relaxed">
                <strong>Not supported:</strong> Full IEEE 1364 Verilog / SystemVerilog features including{' '}
                <code className="font-mono">always</code> blocks, <code className="font-mono">reg</code>, multi-bit
                vector slicing <code className="font-mono">[7:0]</code>, hierarchical module instantiation, or timing
                delays (<code className="font-mono">#5</code>).
              </p>
            </div>
          </div>

          {/* Interactive Testbench + Complete Truth Table */}
          <div className="lg:col-span-6 space-y-6">
            {/* Interactive Testbench Vector Panel */}
            <div className="bg-white border border-[#E4DFF7] rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#141226]">Interactive Testbench Probe</h3>
                <span className="flex items-center gap-1 text-xs text-[#64748B]">
                  <Play className="w-3 h-3 text-[#16A34A]" />
                  Live combinational evaluation
                </span>
              </div>

              {parseResult.success && parseResult.ast ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-[#475569]">Stimulus Inputs</div>
                    <div className="flex flex-wrap gap-2">
                      {inputPorts.map((p) => {
                        const val = vectorInputs[p.name] ?? 0;
                        return (
                          <button
                            key={p.name}
                            type="button"
                            onClick={() =>
                              setVectorInputs((prev) => ({ ...prev, [p.name]: val ? 0 : 1 }))
                            }
                            className={`px-3 py-2 rounded-md border font-mono text-xs cursor-pointer transition-colors ${
                              val
                                ? 'bg-[#DCFCE7] border-[#16A34A] text-[#15803D] font-bold'
                                : 'bg-[#F7F5FF] border-[#E4DFF7] text-[#334155]'
                            }`}
                          >
                            {p.name} = {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-[#475569]">Simulated Outputs</div>
                    <div className="flex flex-wrap gap-2">
                      {outputPorts.map((p) => {
                        const val = manualOutput[p.name] ?? 'X';
                        return (
                          <div
                            key={p.name}
                            className={`px-3 py-2 rounded-md border font-mono text-xs ${
                              val === 1
                                ? 'bg-[#F2EFFF] border-[#5B4CE6] text-[#4A3BD6] font-bold'
                                : 'bg-[#F7F5FF] border-[#E4DFF7] text-[#475569]'
                            }`}
                          >
                            {p.name} = {val}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[#64748B]">
                  Fix the syntax errors on the left to run testbench vectors.
                </div>
              )}
            </div>

            {/* Exhaustive Truth Table */}
            <div className="bg-white border border-[#E4DFF7] rounded-lg p-5 space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-[#141226]">Simulated Truth Table</h3>
                <span className="text-xs font-mono text-[#64748B] tabular-nums">
                  {truthTable.length} vectors evaluated
                </span>
              </div>

              {parseResult.success && parseResult.ast && truthTable.length > 0 ? (
                <div className="max-h-[340px] overflow-auto border border-[#E4DFF7] rounded-md">
                  <table className="w-full text-xs font-mono tabular-nums">
                    <thead className="bg-[#F1EEFC] sticky top-0 text-[#475569]">
                      <tr>
                        {inputPorts.slice(0, 5).map((p) => (
                          <th key={p.name} className="py-2 px-3 text-center border-b border-[#E4DFF7]">
                            {p.name}
                          </th>
                        ))}
                        {outputPorts.map((p) => (
                          <th
                            key={p.name}
                            className="py-2 px-3 text-center border-b border-[#E4DFF7] text-[#5B4CE6]"
                          >
                            {p.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1EEFC]">
                      {truthTable.map((row, idx) => (
                        <tr
                          key={idx}
                          onClick={() => setVectorInputs(row.inputs)}
                          className="hover:bg-[#F2EFFF] cursor-pointer"
                        >
                          {inputPorts.slice(0, 5).map((p) => (
                            <td key={p.name} className="py-1.5 px-3 text-center text-[#334155]">
                              {row.inputs[p.name]}
                            </td>
                          ))}
                          {outputPorts.map((p) => (
                            <td
                              key={p.name}
                              className={`py-1.5 px-3 text-center font-bold ${
                                row.outputs[p.name] === 1
                                  ? 'text-[#16A34A]'
                                  : row.outputs[p.name] === 'X'
                                    ? 'text-[#B45309]'
                                    : 'text-[#64748B]'
                              }`}
                            >
                              {row.outputs[p.name]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-[#64748B]">
                  No simulation table available until module syntax is valid.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
