import React, { useMemo, useState } from 'react';
import { RotateCcw, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import {
  MEMORY_TEMPLATES,
  readMemoryCell,
  writeMemoryCell,
  type MemoryOperationEvent,
  type MemoryTemplateId,
} from '../../engine/memory/memoryEngine';
import { Button } from '../../design-system/ui';

export function MemoryLab() {
  const [templateId, setTemplateId] = useState<MemoryTemplateId>('ram-16');
  const template = useMemo(
    () => MEMORY_TEMPLATES.find((t) => t.id === templateId) ?? MEMORY_TEMPLATES[0],
    [templateId]
  );

  const [data, setData] = useState<number[]>(() => template.initialData());
  const [address, setAddress] = useState(0);
  const [dataInput, setDataInput] = useState(0x42);
  const [chipSelect, setChipSelect] = useState(true);
  const [outputEnable, setOutputEnable] = useState(true);
  const [writeEnable, setWriteEnable] = useState(true);
  const [lastReadValue, setLastReadValue] = useState<number | null>(template.initialData()[0]);
  const [page, setPage] = useState(0);
  const [history, setHistory] = useState<MemoryOperationEvent[]>([]);

  const handleSelectTemplate = (id: MemoryTemplateId) => {
    const next = MEMORY_TEMPLATES.find((t) => t.id === id) ?? MEMORY_TEMPLATES[0];
    setTemplateId(id);
    const fresh = next.initialData();
    setData(fresh);
    setAddress(0);
    setPage(0);
    setLastReadValue(fresh[0]);
    setHistory([]);
  };

  const handleRead = () => {
    const res = readMemoryCell(data, address, chipSelect, outputEnable);
    setLastReadValue(res.value);
    setHistory((h) => [{ id: Date.now() + Math.random(), ...res.event }, ...h].slice(0, 40));
  };

  const handleWrite = () => {
    const res = writeMemoryCell(data, address, dataInput, chipSelect, writeEnable, template.readOnly);
    setData(res.nextData);
    if (res.success && outputEnable) setLastReadValue(dataInput & 0xff);
    setHistory((h) => [{ id: Date.now() + Math.random(), ...res.event }, ...h].slice(0, 40));
  };

  const handleReset = () => {
    const fresh = template.initialData();
    setData(fresh);
    setLastReadValue(fresh[address] ?? 0);
    setHistory((h) =>
      [
        {
          id: Date.now(),
          op: 'RESET' as const,
          address,
          value: 0,
          note: `Reset ${template.name} to initial pattern`,
        },
        ...h,
      ].slice(0, 40)
    );
  };

  const pageSize = Math.min(64, template.sizeBytes);
  const totalPages = Math.ceil(template.sizeBytes / pageSize);
  const pageStart = page * pageSize;

  const addrBits = Array.from({ length: template.addressBits }, (_, i) => {
    const bitIdx = template.addressBits - 1 - i;
    return { bitIdx, val: (address >> bitIdx) & 1 };
  });

  return (
    <div className="h-full overflow-y-auto bg-[#F7F5FF]">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Template Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#141226]">Interactive Memory Laboratory</h2>
            <p className="text-sm text-[#64748B] mt-0.5">{template.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {MEMORY_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelectTemplate(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                  t.id === templateId
                    ? 'bg-[#5B4CE6] text-white border-[#5B4CE6]'
                    : 'bg-white text-[#334155] border-[#E4DFF7] hover:bg-[#F1EEFC]'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* Bus & Control Signals + Address Decoder Visual */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Interactive Address / Data / Control Panel */}
          <div className="lg:col-span-5 bg-white border border-[#E4DFF7] rounded-lg p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#141226]">Bus & Control Signals</h3>
              <span className="text-xs font-mono text-[#64748B]">
                {template.sizeBytes} bytes · {template.addressBits}-bit addr ·{' '}
                {template.readOnly ? 'Read-Only' : 'Read/Write'}
              </span>
            </div>

            {/* Interactive Address Bit Toggles */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#475569]">Address Bus (Click bits)</span>
                <span className="font-mono font-semibold text-[#5B4CE6] tabular-nums">
                  0x{address.toString(16).toUpperCase().padStart(3, '0')} (Dec {address})
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {addrBits.map((b) => (
                  <button
                    key={b.bitIdx}
                    type="button"
                    onClick={() => {
                      const next = address ^ (1 << b.bitIdx);
                      if (next < template.sizeBytes) {
                        setAddress(next);
                        setPage(Math.floor(next / pageSize));
                      }
                    }}
                    className={`w-10 py-1.5 rounded border font-mono text-xs transition-colors cursor-pointer ${
                      b.val
                        ? 'bg-[#F2EFFF] border-[#5B4CE6] text-[#4A3BD6] font-bold'
                        : 'bg-[#F7F5FF] border-[#E4DFF7] text-[#64748B]'
                    }`}
                  >
                    <div className="text-[9px] opacity-70">A{b.bitIdx}</div>
                    <div>{b.val}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Data Input Bus */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#475569]">Data Input Bus (8-bit)</span>
                <span className="font-mono font-semibold text-[#141226] tabular-nums">
                  0x{dataInput.toString(16).toUpperCase().padStart(2, '0')} · {dataInput.toString(2).padStart(8, '0')}₂
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={dataInput}
                  onChange={(e) => setDataInput(Math.max(0, Math.min(255, Number(e.target.value) || 0)))}
                  aria-label="Data input decimal value"
                  className="w-24 px-2.5 py-1.5 font-mono text-xs bg-[#F7F5FF] border border-[#E4DFF7] rounded-md"
                />
                <div className="flex-1 flex gap-1">
                  {[7, 6, 5, 4, 3, 2, 1, 0].map((bit) => {
                    const on = ((dataInput >> bit) & 1) === 1;
                    return (
                      <button
                        key={bit}
                        type="button"
                        onClick={() => setDataInput((v) => v ^ (1 << bit))}
                        className={`flex-1 py-1.5 rounded border font-mono text-xs cursor-pointer ${
                          on
                            ? 'bg-[#5B4CE6] border-[#5B4CE6] text-white font-bold'
                            : 'bg-[#F7F5FF] border-[#E4DFF7] text-[#475569]'
                        }`}
                      >
                        {on ? '1' : '0'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Control Lines CS, OE, WE */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'CS (Chip Sel)', val: chipSelect, toggle: () => setChipSelect((v) => !v) },
                { label: 'OE (Read En)', val: outputEnable, toggle: () => setOutputEnable((v) => !v) },
                {
                  label: 'WE (Write En)',
                  val: writeEnable && !template.readOnly,
                  disabled: template.readOnly,
                  toggle: () => setWriteEnable((v) => !v),
                },
              ].map((ctrl) => (
                <button
                  key={ctrl.label}
                  type="button"
                  disabled={ctrl.disabled}
                  onClick={ctrl.toggle}
                  className={`py-2 px-2 rounded-md border text-xs font-mono transition-colors cursor-pointer disabled:opacity-45 ${
                    ctrl.val
                      ? 'bg-[#DCFCE7] border-[#16A34A] text-[#15803D] font-bold'
                      : 'bg-[#F7F5FF] border-[#E4DFF7] text-[#64748B]'
                  }`}
                >
                  {ctrl.label}: {ctrl.val ? '1' : '0'}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button variant="primary" size="sm" onClick={handleRead}>
                <ArrowUpFromLine className="w-3.5 h-3.5" />
                Execute Read
              </Button>
              <Button variant="secondary" size="sm" onClick={handleWrite}>
                <ArrowDownToLine className="w-3.5 h-3.5" />
                Execute Write
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </Button>
            </div>
          </div>

          {/* Address Decoder & Data Bus Visualization */}
          <div className="lg:col-span-7 bg-white border border-[#E4DFF7] rounded-lg p-5 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#141226]">Address Decoder & Data Bus Signal Flow</h3>
              <span className="font-mono text-xs text-[#141226] tabular-nums">
                Data Out:{' '}
                <strong className={lastReadValue !== null ? 'text-[#16A34A]' : 'text-[#0891B2]'}>
                  {lastReadValue !== null
                    ? `0x${lastReadValue.toString(16).toUpperCase().padStart(2, '0')} (${lastReadValue.toString(2).padStart(8, '0')}₂)`
                    : 'HIGH-Z (Disconnected)'}
                </strong>
              </span>
            </div>

            <div className="bg-[#F7F5FF] border border-[#E4DFF7] rounded-lg p-3">
              <svg viewBox="0 0 640 190" className="w-full h-auto">
                {/* Address Bus */}
                <line
                  x1={140}
                  y1={75}
                  x2={230}
                  y2={75}
                  stroke={chipSelect ? '#5B4CE6' : '#CBD5E1'}
                  strokeWidth={3}
                />
                {/* Word-line active fanout from decoder to array */}
                {[0, 1, 2, 3].map((row) => {
                  const isActiveRow = chipSelect && (address & 0x03) === row;
                  const y = 42 + row * 28;
                  return (
                    <line
                      key={row}
                      x1={350}
                      y1={y}
                      x2={420}
                      y2={y}
                      stroke={isActiveRow ? '#16A34A' : '#CBD5E1'}
                      strokeWidth={isActiveRow ? 3 : 1.5}
                    />
                  );
                })}
                {/* Data Bus Out */}
                <line
                  x1={555}
                  y1={85}
                  x2={620}
                  y2={85}
                  stroke={chipSelect && outputEnable ? '#16A34A' : '#06B6D4'}
                  strokeWidth={3}
                  strokeDasharray={chipSelect && outputEnable ? undefined : '5 4'}
                />

                {/* Address Register */}
                <rect x={16} y={40} width={124} height={70} rx={7} fill="#FFFFFF" stroke="#5B4CE6" strokeWidth={1.6} />
                <text x={78} y={64} textAnchor="middle" className="font-mono text-[10px] font-semibold" fill="#475569">
                  ADDRESS BUS
                </text>
                <text x={78} y={89} textAnchor="middle" className="font-mono text-sm font-bold" fill="#5B4CE6">
                  0x{address.toString(16).toUpperCase().padStart(3, '0')}
                </text>

                {/* Binary Decoder Block */}
                <rect
                  x={230}
                  y={26}
                  width={120}
                  height={118}
                  rx={7}
                  fill={chipSelect ? '#F2EFFF' : '#FFFFFF'}
                  stroke={chipSelect ? '#5B4CE6' : '#94A3B8'}
                  strokeWidth={1.6}
                />
                <text x={290} y={54} textAnchor="middle" className="font-mono text-[10px] font-bold" fill="#141226">
                  {template.addressBits}-to-{template.sizeBytes}
                </text>
                <text x={290} y={72} textAnchor="middle" className="font-mono text-[10px]" fill="#475569">
                  ADDRESS DECODER
                </text>
                <text x={290} y={102} textAnchor="middle" className="font-mono text-[11px] font-semibold" fill={chipSelect ? '#16A34A' : '#DC2626'}>
                  CS={chipSelect ? '1' : '0'} · WL[{address}]
                </text>

                {/* Storage Cell Array */}
                <rect x={420} y={26} width={135} height={118} rx={7} fill="#FFFFFF" stroke="#334155" strokeWidth={1.6} />
                <text x={487} y={52} textAnchor="middle" className="font-mono text-[10px] font-bold" fill="#141226">
                  {template.name.toUpperCase()}
                </text>
                <text x={487} y={84} textAnchor="middle" className="font-mono text-lg font-bold" fill="#141226">
                  0x{(data[address] ?? 0).toString(16).toUpperCase().padStart(2, '0')}
                </text>
                <text x={487} y={106} textAnchor="middle" className="font-mono text-[10px]" fill="#64748B">
                  {(data[address] ?? 0).toString(2).padStart(8, '0')}₂
                </text>
                <text x={487} y={128} textAnchor="middle" className="font-mono text-[10px]" fill="#475569">
                  OE={outputEnable ? '1' : '0'} · WE={writeEnable && !template.readOnly ? '1' : '0'}
                </text>

                {/* Control bus line */}
                <text x={320} y={174} textAnchor="middle" className="font-mono text-[11px]" fill="#64748B">
                  {chipSelect
                    ? `Word-line #${address} decoded → cell stores decimal ${data[address] ?? 0}`
                    : 'Chip Select (CS) is LOW — decoder inactive and outputs are floating (High-Z)'}
                </text>
              </svg>
            </div>
          </div>
        </div>

        {/* Memory Cell Matrix + Operation Log */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white border border-[#E4DFF7] rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#141226]">
                Memory Matrix (Click any cell to select address)
              </h3>
              {totalPages > 1 && (
                <div className="flex items-center gap-1 text-xs">
                  {Array.from({ length: Math.min(totalPages, 16) }, (_, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => setPage(pIdx)}
                      className={`px-2 py-1 rounded font-mono cursor-pointer ${
                        page === pIdx
                          ? 'bg-[#5B4CE6] text-white'
                          : 'bg-[#F1EEFC] text-[#475569] hover:text-[#141226]'
                      }`}
                    >
                      P{pIdx}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 font-mono text-xs tabular-nums">
              {Array.from({ length: pageSize }, (_, idx) => {
                const cellAddr = pageStart + idx;
                const val = data[cellAddr] ?? 0;
                const selected = cellAddr === address;
                return (
                  <button
                    key={cellAddr}
                    type="button"
                    onClick={() => {
                      setAddress(cellAddr);
                      setDataInput(val);
                      if (chipSelect && outputEnable) setLastReadValue(val);
                    }}
                    className={`p-2 rounded-md border text-left transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#F2EFFF] border-[#5B4CE6] ring-1 ring-[#5B4CE6]'
                        : 'bg-[#F7F5FF] border-[#E4DFF7] hover:border-[#94A3B8]'
                    }`}
                  >
                    <div className="text-[10px] text-[#64748B]">
                      {templateId === 'reg-bank'
                        ? `R${cellAddr}`
                        : `0x${cellAddr.toString(16).toUpperCase().padStart(2, '0')}`}
                    </div>
                    <div className="text-sm font-bold text-[#141226] mt-0.5">
                      0x{val.toString(16).toUpperCase().padStart(2, '0')}
                    </div>
                    <div className="text-[9px] text-[#64748B]">
                      {val.toString(2).padStart(8, '0')}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4 bg-white border border-[#E4DFF7] rounded-lg p-5 flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-[#141226]">Bus Transaction Log</h3>
            <div className="flex-1 max-h-[340px] overflow-y-auto divide-y divide-[#F1EEFC]">
              {history.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#64748B]">
                  Execute Read or Write cycles above to inspect bus activity.
                </div>
              ) : (
                history.map((ev) => (
                  <div key={ev.id} className="py-2 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span
                        className={
                          ev.op === 'WRITE'
                            ? 'text-[#5B4CE6] font-bold'
                            : ev.op === 'READ'
                              ? 'text-[#16A34A] font-bold'
                              : ev.op === 'BLOCKED'
                                ? 'text-[#DC2626] font-bold'
                                : 'text-[#64748B] font-bold'
                        }
                      >
                        {ev.op}
                      </span>
                      <span className="text-[#64748B]">
                        @0x{ev.address.toString(16).toUpperCase().padStart(2, '0')}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#475569] mt-0.5">{ev.note}</div>
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
