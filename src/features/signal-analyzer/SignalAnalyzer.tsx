import React, { useMemo, useState } from 'react';
import {
  StepForward,
  Play,
  Pause,
  Trash2,
  ZoomIn,
  ZoomOut,
  Plus,
} from 'lucide-react';
import { useChipCraftStore } from '../../state/useChipCraftStore';
import { getNodePins } from '../../engine/gates/componentCatalog';
import {
  formatBusBinary,
  formatBusHex,
  primarySignal,
  signalColor,
  signalLabel,
} from '../../engine/signals/signalModel';
import type { WaveformTrack } from '../../types/circuit';
import { Button } from '../../design-system/ui';

export function SignalAnalyzer() {
  const circuit = useChipCraftStore((s) => s.circuit);
  const waveforms = useChipCraftStore((s) => s.waveforms);
  const simRunning = useChipCraftStore((s) => s.simRunning);
  const setSimRunning = useChipCraftStore((s) => s.setSimRunning);
  const runSimulationStep = useChipCraftStore((s) => s.runSimulationStep);
  const runClockBurst = useChipCraftStore((s) => s.runClockBurst);
  const clearWaveforms = useChipCraftStore((s) => s.clearWaveforms);
  const setWorkspace = useChipCraftStore((s) => s.setWorkspace);
  const [burstBusy, setBurstBusy] = useState(false);

  const [stepPx, setStepPx] = useState(44);
  const [cursorIndex, setCursorIndex] = useState<number>(Math.max(0, waveforms.length - 1));
  const [hiddenTracks, setHiddenTracks] = useState<Record<string, boolean>>({});

  // Build available tracks directly from active Circuit Studio nodes
  const allTracks = useMemo<WaveformTrack[]>(() => {
    const list: WaveformTrack[] = [];
    for (const node of circuit.nodes) {
      const pins = getNodePins(node);
      for (const pin of pins) {
        // Show outputs of inputs/clocks/gates/sequential + inputs of LEDs/probes/outputs
        const interesting =
          pin.direction === 'output' ||
          node.type === 'LED' ||
          node.type === 'PROBE' ||
          node.type === 'OUTPUT_PIN' ||
          node.type === 'BINARY_DISPLAY';
        if (!interesting) continue;
        list.push({
          id: `${node.id}:${pin.id}`,
          nodeId: node.id,
          pinId: pin.id,
          label: `${node.label}.${pin.label}`,
          width: pin.width,
        });
      }
    }
    return list;
  }, [circuit.nodes]);

  const visibleTracks = useMemo(
    () => allTracks.filter((t) => !hiddenTracks[t.id]),
    [allTracks, hiddenTracks]
  );

  const clampedCursor = Math.min(cursorIndex, Math.max(0, waveforms.length - 1));
  const activeSample = waveforms[clampedCursor];
  const chartWidth = Math.max(560, waveforms.length * stepPx + 60);

  const toggleTrack = (id: string) => {
    setHiddenTracks((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="h-full flex flex-col bg-[#F7F5FF] overflow-hidden">
      {/* Analyzer Toolbar */}
      <div className="shrink-0 bg-white border-b border-[#E4DFF7] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              runSimulationStep(true);
              setCursorIndex(waveforms.length);
            }}
          >
            <StepForward className="w-3.5 h-3.5" />
            <span>Capture Clock Edge</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={burstBusy}
            onClick={async () => {
              setBurstBusy(true);
              await runClockBurst(16);
              setBurstBusy(false);
              setCursorIndex(Math.min(119, waveforms.length + 15));
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{burstBusy ? 'Simulating...' : 'Capture 16 Ticks (Worker)'}</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSimRunning(!simRunning)}
          >
            {simRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{simRunning ? 'Pause Auto' : 'Auto Run'}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={clearWaveforms}>
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Buffer</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#64748B] tabular-nums">
            Circuit: <strong className="text-[#141226]">{circuit.name}</strong> · {waveforms.length} samples
          </span>
          <Button variant="ghost" size="sm" onClick={() => setStepPx((p) => Math.max(20, p - 8))} title="Zoom out time axis">
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setStepPx((p) => Math.min(96, p + 8))} title="Zoom in time axis">
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setWorkspace('circuit-studio')}>
            Back to Schematic
          </Button>
        </div>
      </div>

      {/* Main Split: Signal Selector | Waveform Canvas | Cursor Measurement Inspector */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Track Selector */}
        <aside className="w-full lg:w-60 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-[#E4DFF7] overflow-y-auto max-h-40 lg:max-h-none p-3 space-y-2">
          <div className="text-xs font-semibold text-[#141226]">Tracked Signals ({visibleTracks.length}/{allTracks.length})</div>
          {allTracks.length === 0 ? (
            <p className="text-xs text-[#64748B]">Add components in Circuit Studio to record signals.</p>
          ) : (
            <div className="space-y-1">
              {allTracks.map((tr) => {
                const checked = !hiddenTracks[tr.id];
                const curBus = activeSample?.signals[tr.id];
                const sig = primarySignal(curBus);
                return (
                  <label
                    key={tr.id}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-[#F7F5FF] cursor-pointer text-xs"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTrack(tr.id)}
                        className="accent-[#5B4CE6]"
                      />
                      <span className="font-mono text-[#141226] truncate">{tr.label}</span>
                    </span>
                    <span className="font-mono text-[11px] font-semibold" style={{ color: signalColor(sig) }}>
                      {tr.width > 1 ? formatBusHex(curBus) : formatBusBinary(curBus)}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </aside>

        {/* Waveform Timeline Viewport */}
        <div className="flex-1 min-w-0 overflow-auto bg-white p-4">
          {visibleTracks.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-[#64748B]">
              Select one or more signals on the left to visualize waveforms.
            </div>
          ) : (
            <div className="min-w-fit">
              {/* Time Axis Header */}
              <div className="flex border-b border-[#E4DFF7] pb-1.5 mb-2">
                <div className="w-36 shrink-0 text-xs font-mono font-semibold text-[#64748B]">
                  SIGNAL / TICK
                </div>
                <div className="relative" style={{ width: chartWidth }}>
                  <div className="flex">
                    {waveforms.map((sample, idx) => (
                      <button
                        key={sample.tick + '-' + idx}
                        type="button"
                        onClick={() => setCursorIndex(idx)}
                        style={{ width: stepPx }}
                        className={`shrink-0 text-left text-[11px] font-mono tabular-nums pl-1 rounded cursor-pointer ${
                          idx === clampedCursor
                            ? 'text-[#5B4CE6] font-bold bg-[#F2EFFF]'
                            : 'text-[#64748B] hover:text-[#141226]'
                        }`}
                      >
                        t{sample.tick}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Waveform Rows */}
              <div className="divide-y divide-[#F1EEFC]">
                {visibleTracks.map((track) => {
                  const rowH = 44;
                  const yHigh = 8;
                  const yLow = 34;
                  const yMid = 21;

                  // Build single-bit step path
                  let pathD = '';
                  if (track.width === 1) {
                    waveforms.forEach((sample, idx) => {
                      const x = idx * stepPx;
                      const sig = primarySignal(sample.signals[track.id]);
                      const y = sig === 'HIGH' ? yHigh : sig === 'LOW' ? yLow : yMid;
                      if (idx === 0) {
                        pathD += `M ${x} ${y} L ${x + stepPx} ${y}`;
                      } else {
                        pathD += ` L ${x} ${y} L ${x + stepPx} ${y}`;
                      }
                    });
                  }

                  return (
                    <div key={track.id} className="flex items-center py-1">
                      <div className="w-36 shrink-0 pr-3">
                        <div className="font-mono text-xs font-medium text-[#141226] truncate">
                          {track.label}
                        </div>
                        <div className="font-mono text-[10px] text-[#64748B]">
                          {track.width > 1 ? `${track.width}-bit bus` : '1-bit logic'}
                        </div>
                      </div>

                      <svg
                        width={chartWidth}
                        height={rowH}
                        className="shrink-0 bg-[#F7F5FF] rounded cursor-crosshair"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const relX = e.clientX - rect.left;
                          const idx = Math.floor(relX / stepPx);
                          if (idx >= 0 && idx < waveforms.length) setCursorIndex(idx);
                        }}
                      >
                        {/* Vertical tick grid */}
                        {waveforms.map((_, idx) => (
                          <line
                            key={idx}
                            x1={idx * stepPx}
                            y1={0}
                            x2={idx * stepPx}
                            y2={rowH}
                            stroke="#E4DFF7"
                            strokeWidth={1}
                          />
                        ))}

                        {/* 1-bit waveform step trace */}
                        {track.width === 1 ? (
                          <>
                            <path
                              d={pathD}
                              fill="none"
                              stroke="#5B4CE6"
                              strokeWidth={2}
                              strokeLinejoin="miter"
                            />
                            {waveforms.map((sample, idx) => {
                              const sig = primarySignal(sample.signals[track.id]);
                              if (sig === 'UNKNOWN' || sig === 'ERROR' || sig === 'HIGH_IMPEDANCE') {
                                return (
                                  <rect
                                    key={idx}
                                    x={idx * stepPx + 1}
                                    y={12}
                                    width={stepPx - 2}
                                    height={18}
                                    fill={signalColor(sig)}
                                    opacity={0.22}
                                  />
                                );
                              }
                              return null;
                            })}
                          </>
                        ) : (
                          /* Multi-bit bus waveform capsules */
                          waveforms.map((sample, idx) => {
                            const bus = sample.signals[track.id];
                            const x = idx * stepPx;
                            return (
                              <g key={idx}>
                                <polygon
                                  points={`${x + 3},22 ${x + 7},8 ${x + stepPx - 5},8 ${x + stepPx - 1},22 ${x + stepPx - 5},36 ${x + 7},36`}
                                  fill="#F2EFFF"
                                  stroke="#5B4CE6"
                                  strokeWidth={1.3}
                                />
                                <text
                                  x={x + stepPx / 2}
                                  y={26}
                                  textAnchor="middle"
                                  className="font-mono text-[10px] font-semibold"
                                  fill="#1E3A8A"
                                >
                                  {formatBusHex(bus)}
                                </text>
                              </g>
                            );
                          })
                        )}

                        {/* Active Measurement Cursor */}
                        <line
                          x1={clampedCursor * stepPx + stepPx / 2}
                          y1={0}
                          x2={clampedCursor * stepPx + stepPx / 2}
                          y2={rowH}
                          stroke="#DC2626"
                          strokeWidth={1.5}
                          strokeDasharray="3 2"
                        />
                      </svg>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Cursor Measurement Readout Panel */}
        <aside className="w-full lg:w-64 shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-[#E4DFF7] p-4 overflow-y-auto space-y-3">
          <div>
            <h3 className="text-xs font-semibold text-[#141226]">Cursor Measurement</h3>
            <div className="text-xs font-mono text-[#DC2626] mt-0.5 tabular-nums">
              Tick t{activeSample?.tick ?? 0} (Sample #{clampedCursor + 1})
            </div>
          </div>

          <div className="divide-y divide-[#F1EEFC]">
            {visibleTracks.map((tr) => {
              const bus = activeSample?.signals[tr.id];
              const sig = primarySignal(bus);
              return (
                <div key={tr.id} className="py-2 flex items-center justify-between text-xs font-mono">
                  <span className="text-[#334155] truncate pr-2">{tr.label}</span>
                  <span className="font-semibold shrink-0" style={{ color: signalColor(sig) }}>
                    {tr.width > 1
                      ? `${formatBusBinary(bus)} (${formatBusHex(bus)})`
                      : signalLabel(sig)}
                  </span>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
