import React, { useState } from 'react';
import { SegmentedTabs } from '../../design-system/ui';

export function DocumentationWorkspace() {
  const [section, setSection] = useState<'studio' | 'engine' | 'isa' | 'hdl'>('studio');

  return (
    <div className="h-full overflow-y-auto bg-[#F7F5FF]">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#141226]">ChipCraft Engineering Documentation</h2>
            <p className="text-sm text-[#64748B] mt-0.5">
              Technical reference for the simulation engine, schematic editor shortcuts, 8-bit CPU ISA, and HDL subset.
            </p>
          </div>
          <SegmentedTabs
            value={section}
            onChange={setSection}
            options={[
              { value: 'studio', label: 'Circuit Studio' },
              { value: 'engine', label: 'Simulation Engine' },
              { value: 'isa', label: '8-Bit CPU ISA' },
              { value: 'hdl', label: 'HDL Subset' },
            ]}
          />
        </div>

        {section === 'studio' && (
          <div className="bg-white border border-[#E4DFF7] rounded-lg p-6 space-y-6 text-sm text-[#334155]">
            <div>
              <h3 className="text-base font-bold text-[#141226]">Schematic Editing & Keyboard Shortcuts</h3>
              <p className="mt-1 text-xs text-[#64748B]">
                Drag components from the left library or click any part to drop it onto the canvas. Drag from an output pin circle to an input pin circle to route a validated wire.
              </p>
            </div>
            <table className="w-full text-xs font-mono border border-[#E4DFF7]">
              <thead className="bg-[#F7F5FF] text-[#475569]">
                <tr>
                  <th className="py-2 px-3 text-left border-b border-[#E4DFF7]">Shortcut / Gesture</th>
                  <th className="py-2 px-3 text-left border-b border-[#E4DFF7]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EEFC]">
                {[
                  ['Ctrl+K / Cmd+K', 'Open Command Palette (jump workspaces or load examples)'],
                  ['Mouse Wheel', 'Zoom schematic canvas toward cursor'],
                  ['Drag Empty Canvas', 'Pan schematic viewport'],
                  ['Shift + Drag Canvas', 'Marquee box-select multiple components'],
                  ['R', 'Rotate selected rotatable components 90° clockwise'],
                  ['Delete / Backspace', 'Delete selected components or selected wire'],
                  ['Ctrl+Z / Ctrl+Y', 'Undo and Redo circuit graph edits'],
                  ['Ctrl+C / Ctrl+V / Ctrl+D', 'Copy, Paste, and Duplicate selected sub-circuits'],
                ].map(([k, desc]) => (
                  <tr key={k}>
                    <td className="py-2 px-3 font-semibold text-[#141226]">{k}</td>
                    <td className="py-2 px-3 font-sans text-[#475569]">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {section === 'engine' && (
          <div className="bg-white border border-[#E4DFF7] rounded-lg p-6 space-y-5 text-xs text-[#334155] leading-relaxed">
            <h3 className="text-base font-bold text-[#141226]">Deterministic 5-Value Simulation Engine</h3>
            <p>
              ChipCraft runs an isolated TypeScript digital logic solver directly in the browser with no remote calls. Every net carries a typed <code>BusValue</code> composed of 5-value logic states:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 font-mono">
              {[
                ['HIGH (1)', '#16A34A', 'Driven logic high'],
                ['LOW (0)', '#64748B', 'Driven logic low'],
                ['UNKNOWN (X)', '#B45309', 'Floating / uninitialized'],
                ['HI-Z (Z)', '#0891B2', 'Tri-state disconnected'],
                ['ERROR (E)', '#DC2626', 'Bus contention / invalid SR'],
              ].map(([name, color, note]) => (
                <div key={name} className="p-3 bg-[#F7F5FF] border border-[#E4DFF7] rounded-md">
                  <div className="font-bold" style={{ color }}>{name}</div>
                  <div className="font-sans text-[#64748B] mt-1">{note}</div>
                </div>
              ))}
            </div>
            <p>
              <strong>Two-Phase Sequential Semantics:</strong> On each simulation tick, the engine first iterates combinational gates until all nets settle (or flags a <code>COMBINATIONAL_LOOP</code> error after 48 passes if an unstable loop such as a self-wired NOT gate is present). Next, sequential blocks (D/JK/T Flip-Flops, 4-Bit Registers, Counters, Clock Dividers, and RAM) sample settled inputs on a rising clock edge (<code>0 → 1</code>), then combinational outputs re-settle.
            </p>
          </div>
        )}

        {section === 'isa' && (
          <div className="bg-white border border-[#E4DFF7] rounded-lg p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#141226]">Educational 8-Bit CPU Instruction Set</h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Fixed 2-byte instructions stored at 0x00–0x7F; 4 general-purpose 8-bit registers (R0–R3); 256 bytes of RAM (0x80–0xFF recommended for data); status flags Z, C, N.
              </p>
            </div>
            <table className="w-full text-xs font-mono border border-[#E4DFF7]">
              <thead className="bg-[#F7F5FF] text-[#475569]">
                <tr>
                  <th className="py-2 px-3 text-left border-b border-[#E4DFF7]">Mnemonic</th>
                  <th className="py-2 px-3 text-left border-b border-[#E4DFF7]">Syntax</th>
                  <th className="py-2 px-3 text-left border-b border-[#E4DFF7]">Operation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EEFC]">
                {[
                  ['LOADI', 'LOADI Rd, imm8', 'Load immediate 8-bit value into Rd'],
                  ['LOAD', 'LOAD Rd, addr', 'Load byte from RAM[addr] into Rd'],
                  ['STORE', 'STORE Rs, addr', 'Store Rs into RAM[addr]'],
                  ['ADD / ADDI', 'ADD Rd, Rs / ADDI Rd, imm', '8-bit addition; updates Z, C, N flags'],
                  ['SUB', 'SUB Rd, Rs', 'Rd ← Rd - Rs; updates Z, C (borrow), N flags'],
                  ['AND / OR / XOR', 'AND Rd, Rs', 'Bitwise logic between Rd and Rs'],
                  ['NOT / SHL / SHR', 'NOT Rd / SHL Rd / SHR Rd', 'Unary bitwise invert or 1-bit shift'],
                  ['JUMP / JZ / JNZ', 'JNZ LABEL', 'Unconditional or Zero-flag conditional branch'],
                  ['OUT / HALT', 'OUT Rs / HALT', 'Write register to output port or stop clock'],
                ].map(([op, syn, desc]) => (
                  <tr key={op}>
                    <td className="py-2 px-3 font-bold text-[#5B4CE6]">{op}</td>
                    <td className="py-2 px-3 text-[#141226]">{syn}</td>
                    <td className="py-2 px-3 font-sans text-[#475569]">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {section === 'hdl' && (
          <div className="bg-white border border-[#E4DFF7] rounded-lg p-6 space-y-4 text-xs text-[#334155] leading-relaxed">
            <h3 className="text-base font-bold text-[#141226]">Educational Verilog-Subset Specification</h3>
            <p>
              HDL Studio implements a local recursive-descent parser, evaluator, and gate-level netlist synthesizer for combinational 1-bit Verilog-style modules.
            </p>
            <pre className="p-4 bg-[#F7F5FF] border border-[#E4DFF7] rounded-md font-mono text-xs text-[#141226] overflow-x-auto">
{`module full_adder(
    input wire a,
    input wire b,
    input wire cin,
    output wire sum,
    output wire cout
);
wire p;
assign p = a ^ b;
assign sum = p ^ cin;
assign cout = (a & b) | (p & cin);
endmodule`}
            </pre>
            <p className="text-[#64748B]">
              <strong>Explicit Scope Notice:</strong> ChipCraft HDL Studio is an educational combinational subset. Procedural <code>always</code> blocks, <code>reg</code> variables, multi-bit vectors <code>[7:0]</code>, hierarchical sub-module instantiation, and SystemVerilog constructs are intentionally rejected with clear diagnostics rather than silently ignored.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
