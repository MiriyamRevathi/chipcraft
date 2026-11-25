import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Cpu, AlertCircle, X } from 'lucide-react';
import type { CustomICDefinition, CustomICPinMapping, PinSide } from '../../types/circuit';
import {
  recalculatePinLayout,
  validateCustomICDefinition,
  type SubcircuitDraftResult,
} from '../../engine/subcircuit/customIcEngine';
import { Button } from '../../design-system/ui';

interface PackageCustomICModalProps {
  draftResult: SubcircuitDraftResult;
  existingCustomIcs: Record<string, CustomICDefinition>;
  onClose: () => void;
  onSave: (def: CustomICDefinition, replaceSelection: boolean) => Promise<void>;
}

const SIDES: PinSide[] = ['left', 'right', 'top', 'bottom'];

export function PackageCustomICModal({
  draftResult,
  existingCustomIcs,
  onClose,
  onSave,
}: PackageCustomICModalProps) {
  const [name, setName] = useState(draftResult.draft.name);
  const [shortName, setShortName] = useState(draftResult.draft.shortName);
  const [description, setDescription] = useState(draftResult.draft.description);
  const [pins, setPins] = useState<CustomICPinMapping[]>(draftResult.draft.pins);
  const [replaceSelection, setReplaceSelection] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const layout = useMemo(() => recalculatePinLayout(pins), [pins]);

  const candidateDef: CustomICDefinition = useMemo(
    () => ({
      ...draftResult.draft,
      name: name.trim(),
      shortName: shortName.trim().toUpperCase().slice(0, 10),
      description: description.trim(),
      width: layout.width,
      height: layout.height,
      pins: layout.pins,
      updatedAt: Date.now(),
    }),
    [draftResult.draft, name, shortName, description, layout]
  );

  const liveValidation = useMemo(
    () => validateCustomICDefinition(candidateDef, existingCustomIcs),
    [candidateDef, existingCustomIcs]
  );

  const updatePin = (idx: number, patch: Partial<CustomICPinMapping>) => {
    setPins((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
    setSubmitErrors([]);
  };

  const movePin = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= pins.length) return;
    setPins((prev) => {
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateCustomICDefinition(candidateDef, existingCustomIcs);
    if (!check.valid) {
      setSubmitErrors(check.errors);
      return;
    }
    setSaving(true);
    try {
      await onSave(candidateDef, replaceSelection);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const errors = submitErrors.length > 0 ? submitErrors : liveValidation.errors;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#141226]/40 backdrop-blur-[1px] p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="package-ic-title"
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] bg-white border border-[#E4DFF7] rounded-xl shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E4DFF7] flex items-center justify-between gap-3 bg-[#FAF9FF]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EDE9FE] text-[#5B4CE6] flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 id="package-ic-title" className="text-sm font-bold text-[#141226]">
                Package Subcircuit as Reusable Custom IC
              </h2>
              <p className="text-xs text-[#5B587A]">
                {draftResult.draft.nodes.length} internal components · {draftResult.draft.wires.length}{' '}
                internal wires · {pins.length} external pins detected
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Package Custom IC dialog"
            className="p-1.5 text-[#5B587A] hover:text-[#141226] hover:bg-[#EFEBFD] rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Metadata & Pin Editor */}
            <div className="lg:col-span-7 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="sm:col-span-2 block">
                  <span className="block text-xs font-medium text-[#3D3A57] mb-1">IC Name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setSubmitErrors([]);
                    }}
                    placeholder="e.g. Half Adder IC"
                    aria-label="Custom IC Name"
                    className="w-full px-3 py-1.5 text-sm bg-[#F7F5FF] border border-[#E4DFF7] rounded-md text-[#141226] focus:outline-none focus:border-[#5B4CE6]"
                    autoFocus
                  />
                </label>

                <label className="block">
                  <span className="block text-xs font-medium text-[#3D3A57] mb-1">
                    Chip Label (1–10)
                  </span>
                  <input
                    type="text"
                    maxLength={10}
                    value={shortName}
                    onChange={(e) => {
                      setShortName(e.target.value.toUpperCase());
                      setSubmitErrors([]);
                    }}
                    placeholder="HA"
                    aria-label="Custom IC Chip Label"
                    className="w-full px-3 py-1.5 text-sm font-mono uppercase bg-[#F7F5FF] border border-[#E4DFF7] rounded-md text-[#141226] focus:outline-none focus:border-[#5B4CE6]"
                  />
                </label>
              </div>

              <label className="block">
                <span className="block text-xs font-medium text-[#3D3A57] mb-1">Description</span>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe this reusable subcircuit..."
                  aria-label="Custom IC Description"
                  className="w-full px-3 py-1.5 text-xs bg-[#F7F5FF] border border-[#E4DFF7] rounded-md text-[#141226] focus:outline-none focus:border-[#5B4CE6]"
                />
              </label>

              {/* External Pin Configuration Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#141226]">
                    External Pin Mapping ({pins.length})
                  </span>
                  <span className="text-[11px] text-[#5B587A]">
                    Rename pins or assign side positions
                  </span>
                </div>

                <div className="border border-[#E4DFF7] rounded-lg divide-y divide-[#F1EEFC] max-h-60 overflow-y-auto">
                  {pins.map((pin, idx) => (
                    <div
                      key={pin.pinId}
                      className="px-3 py-2 flex items-center gap-2 bg-white hover:bg-[#FAF9FF]"
                    >
                      <span
                        className={`text-[10px] font-mono font-semibold w-10 shrink-0 ${
                          pin.direction === 'input' ? 'text-[#5B4CE6]' : 'text-[#16A34A]'
                        }`}
                      >
                        {pin.direction === 'input' ? 'IN' : 'OUT'}
                        {pin.width > 1 ? ` ${pin.width}b` : ''}
                      </span>

                      <input
                        type="text"
                        value={pin.label}
                        onChange={(e) => updatePin(idx, { label: e.target.value })}
                        aria-label={`Pin label for ${pin.pinId}`}
                        className="flex-1 min-w-0 px-2 py-1 text-xs font-mono bg-[#F7F5FF] border border-[#E4DFF7] rounded focus:outline-none focus:border-[#5B4CE6]"
                      />

                      <select
                        value={pin.side}
                        onChange={(e) => updatePin(idx, { side: e.target.value as PinSide })}
                        aria-label={`Pin side for ${pin.label}`}
                        className="px-2 py-1 text-xs bg-[#F7F5FF] border border-[#E4DFF7] rounded text-[#3D3A57] focus:outline-none focus:border-[#5B4CE6]"
                      >
                        {SIDES.map((s) => (
                          <option key={s} value={s}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => movePin(idx, -1)}
                          disabled={idx === 0}
                          title="Move pin up"
                          aria-label={`Move ${pin.label} up`}
                          className="p-1 text-[#5B587A] hover:text-[#141226] disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => movePin(idx, 1)}
                          disabled={idx === pins.length - 1}
                          title="Move pin down"
                          aria-label={`Move ${pin.label} down`}
                          className="p-1 text-[#5B587A] hover:text-[#141226] disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={replaceSelection}
                  onChange={(e) => setReplaceSelection(e.target.checked)}
                  className="w-4 h-4 accent-[#5B4CE6] cursor-pointer"
                />
                <span className="text-xs text-[#3D3A57]">
                  Replace selected components on canvas with an instance of this Custom IC
                </span>
              </label>

              {errors.length > 0 && (
                <div
                  role="alert"
                  className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg space-y-1 text-xs text-[#B91C1C]"
                >
                  {errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Live Generated IC Symbol Preview */}
            <div className="lg:col-span-5 flex flex-col">
              <div className="text-xs font-semibold text-[#141226] mb-2">Generated IC Symbol</div>
              <div className="flex-1 min-h-[220px] bg-[#F7F5FF] border border-[#E4DFF7] rounded-lg flex items-center justify-center p-4">
                <svg
                  viewBox={`-36 -30 ${layout.width + 72} ${layout.height + 60}`}
                  className="w-full max-w-[260px] h-auto"
                  role="img"
                  aria-label="Preview of generated Custom IC symbol"
                >
                  {/* Chip Body */}
                  <rect
                    x={8}
                    y={4}
                    width={layout.width - 16}
                    height={layout.height - 8}
                    rx={7}
                    fill="#FFFFFF"
                    stroke="#5B4CE6"
                    strokeWidth={1.8}
                  />
                  {/* Header Band */}
                  <path
                    d={`M 9 11 Q 9 5 15 5 L ${layout.width - 15} 5 Q ${layout.width - 9} 5 ${layout.width - 9} 11 L ${layout.width - 9} 26 L 9 26 Z`}
                    fill="#EDE9FE"
                  />
                  {/* IC Notch */}
                  <path
                    d={`M ${layout.width / 2 - 7} 5 A 7 7 0 0 0 ${layout.width / 2 + 7} 5`}
                    fill="#F7F5FF"
                    stroke="#5B4CE6"
                    strokeWidth={1.2}
                  />
                  <line x1={8} y1={26} x2={layout.width - 8} y2={26} stroke="#DDD6FE" strokeWidth={1} />
                  <text
                    x={layout.width / 2}
                    y={20}
                    textAnchor="middle"
                    className="font-mono text-[10px] font-bold"
                    fill="#4A3BD6"
                  >
                    {candidateDef.shortName || 'IC'}
                  </text>

                  {/* Pins */}
                  {layout.pins.map((p) => {
                    const px =
                      p.side === 'left'
                        ? 0
                        : p.side === 'right'
                          ? layout.width
                          : p.offset * layout.width;
                    const py =
                      p.side === 'top'
                        ? 0
                        : p.side === 'bottom'
                          ? layout.height
                          : p.offset * layout.height;
                    const stroke = p.direction === 'input' ? '#5B4CE6' : '#16A34A';
                    return (
                      <g key={p.pinId}>
                        {p.side === 'left' && (
                          <>
                            <line x1={0} y1={py} x2={8} y2={py} stroke={stroke} strokeWidth={1.8} />
                            <text
                              x={13}
                              y={py + 3}
                              textAnchor="start"
                              className="font-mono text-[9px]"
                              fill="#3D3A57"
                            >
                              {p.label}
                            </text>
                          </>
                        )}
                        {p.side === 'right' && (
                          <>
                            <line
                              x1={layout.width - 8}
                              y1={py}
                              x2={layout.width}
                              y2={py}
                              stroke={stroke}
                              strokeWidth={1.8}
                            />
                            <text
                              x={layout.width - 13}
                              y={py + 3}
                              textAnchor="end"
                              className="font-mono text-[9px]"
                              fill="#3D3A57"
                            >
                              {p.label}
                            </text>
                          </>
                        )}
                        {p.side === 'top' && (
                          <>
                            <line x1={px} y1={0} x2={px} y2={5} stroke={stroke} strokeWidth={1.8} />
                            <text
                              x={px}
                              y={-8}
                              textAnchor="middle"
                              className="font-mono text-[9px]"
                              fill="#3D3A57"
                            >
                              {p.label}
                            </text>
                          </>
                        )}
                        {p.side === 'bottom' && (
                          <>
                            <line
                              x1={px}
                              y1={layout.height - 4}
                              x2={px}
                              y2={layout.height}
                              stroke={stroke}
                              strokeWidth={1.8}
                            />
                            <text
                              x={px}
                              y={layout.height - 10}
                              textAnchor="middle"
                              className="font-mono text-[9px]"
                              fill="#3D3A57"
                            >
                              {p.label}
                            </text>
                          </>
                        )}
                        <circle
                          cx={px}
                          cy={py}
                          r={p.width > 1 ? 5 : 4}
                          fill="#FFFFFF"
                          stroke={stroke}
                          strokeWidth={1.8}
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>
              <p className="text-[11px] text-[#5B587A] mt-2 leading-relaxed">
                Each placed instance of this IC simulates with its own independent internal sequential
                state and supports nested subcircuits.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 border-t border-[#E4DFF7] bg-[#FAF9FF] flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={saving || !liveValidation.valid}
            >
              {saving ? 'Packaging...' : 'Create Custom IC'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
