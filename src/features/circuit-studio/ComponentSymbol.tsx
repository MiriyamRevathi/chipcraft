import React from 'react';
import type { BusValue, CircuitNode, PinDefinition } from '../../types/circuit';
import {
  COMPONENT_CATALOG,
  getCustomICForNode,
  getNodeDimensions,
  getNodePins,
} from '../../engine/gates/componentCatalog';
import { busToNumber, formatBusBinary, primarySignal, signalColor } from '../../engine/signals/signalModel';

// 7-segment display bitmask for hex digits 0..F (a, b, c, d, e, f, g)
const SEVEN_SEG_MAP: Record<number, number> = {
  0x0: 0b0111111,
  0x1: 0b0000110,
  0x2: 0b1011011,
  0x3: 0b1001111,
  0x4: 0b1100110,
  0x5: 0b1101101,
  0x6: 0b1111101,
  0x7: 0b0000111,
  0x8: 0b1111111,
  0x9: 0b1101111,
  0xa: 0b1110111,
  0xb: 0b1111100,
  0xc: 0b0111001,
  0xd: 0b1011110,
  0xe: 0b1111001,
  0xf: 0b1110001,
};

interface ComponentSymbolProps {
  node: CircuitNode;
  selected: boolean;
  pinValues: Record<string, BusValue>;
  showPinLabels: boolean;
  onPinMouseDown: (e: React.MouseEvent, nodeId: string, pin: PinDefinition) => void;
  onPinMouseUp: (e: React.MouseEvent, nodeId: string, pin: PinDefinition) => void;
  onToggleInput: (nodeId: string, bitIndex?: number) => void;
}

export const ComponentSymbol = React.memo(function ComponentSymbol({
  node,
  selected,
  pinValues,
  showPinLabels,
  onPinMouseDown,
  onPinMouseUp,
  onToggleInput,
}: ComponentSymbolProps) {
  const spec = COMPONENT_CATALOG[node.type];
  const { width: w, height: h } = getNodeDimensions(node);
  const pins = getNodePins(node);

  const strokeColor = selected ? '#5B4CE6' : '#3B3654';
  const strokeW = selected ? 2 : 1.5;

  const getPinBus = (pinId: string) => pinValues[`${node.id}:${pinId}`];

  const renderBody = () => {
    switch (node.type) {
      // ===== INPUTS =====
      case 'TOGGLE_SWITCH': {
        const isHigh = Boolean(node.value);
        return (
          <g
            onClick={(e) => {
              e.stopPropagation();
              onToggleInput(node.id);
            }}
            className="cursor-pointer"
          >
            <rect
              x={4}
              y={4}
              width={w - 14}
              height={h - 8}
              rx={6}
              fill={isHigh ? '#DCFCE7' : '#FFFFFF'}
              stroke={isHigh ? '#16A34A' : strokeColor}
              strokeWidth={strokeW}
            />
            <rect
              x={12}
              y={h / 2 - 9}
              width={32}
              height={18}
              rx={9}
              fill={isHigh ? '#16A34A' : '#CBD5E1'}
            />
            <circle cx={isHigh ? 35 : 21} cy={h / 2} r={6.5} fill="#FFFFFF" />
            <text
              x={w - 20}
              y={h / 2 + 4}
              textAnchor="middle"
              className="font-mono text-[11px] font-bold select-none"
              fill={isHigh ? '#15803D' : '#475569'}
            >
              {isHigh ? '1' : '0'}
            </text>
          </g>
        );
      }

      case 'PUSH_BUTTON': {
        const isHigh = Boolean(node.value);
        return (
          <g
            onMouseDown={(e) => {
              e.stopPropagation();
              if (!isHigh) onToggleInput(node.id);
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
              if (isHigh) onToggleInput(node.id);
            }}
            className="cursor-pointer"
          >
            <rect
              x={4}
              y={4}
              width={w - 14}
              height={h - 8}
              rx={6}
              fill={isHigh ? '#EDE9FE' : '#FFFFFF'}
              stroke={isHigh ? '#5B4CE6' : strokeColor}
              strokeWidth={strokeW}
            />
            <circle
              cx={(w - 6) / 2}
              cy={h / 2}
              r={12}
              fill={isHigh ? '#5B4CE6' : '#E9E4FA'}
              stroke={isHigh ? '#4A3BD6' : '#9B94BD'}
              strokeWidth={1.5}
            />
            <text
              x={(w - 6) / 2}
              y={h / 2 + 3.5}
              textAnchor="middle"
              className="font-mono text-[10px] font-bold select-none"
              fill={isHigh ? '#FFFFFF' : '#334155'}
            >
              {isHigh ? '1' : '0'}
            </text>
          </g>
        );
      }

      case 'BINARY_INPUT': {
        const val = (node.value ?? 0) & 0x0f;
        return (
          <g>
            <rect
              x={4}
              y={4}
              width={w - 12}
              height={h - 8}
              rx={6}
              fill="#FFFFFF"
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
            {[3, 2, 1, 0].map((bit, idx) => {
              const bitOn = ((val >> bit) & 1) === 1;
              const bx = 10 + idx * 20;
              return (
                <g
                  key={bit}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleInput(node.id, bit);
                  }}
                  className="cursor-pointer"
                >
                  <rect
                    x={bx}
                    y={10}
                    width={17}
                    height={20}
                    rx={3}
                    fill={bitOn ? '#5B4CE6' : '#F3F0FF'}
                    stroke={bitOn ? '#4A3BD6' : '#D5CEF0'}
                    strokeWidth={1}
                  />
                  <text
                    x={bx + 8.5}
                    y={23.5}
                    textAnchor="middle"
                    className="font-mono text-[10px] font-semibold select-none"
                    fill={bitOn ? '#FFFFFF' : '#475569'}
                  >
                    {bitOn ? '1' : '0'}
                  </text>
                </g>
              );
            })}
            <text
              x={(w - 8) / 2}
              y={43}
              textAnchor="middle"
              className="font-mono text-[10px] fill-[#64748B] select-none"
            >
              0x{val.toString(16).toUpperCase()} ({val})
            </text>
          </g>
        );
      }

      case 'CLOCK': {
        const outSig = primarySignal(getPinBus('out'));
        const high = outSig === 'HIGH';
        return (
          <g>
            <rect
              x={4}
              y={4}
              width={w - 12}
              height={h - 8}
              rx={6}
              fill={high ? '#ECFDF5' : '#FFFFFF'}
              stroke={high ? '#16A34A' : strokeColor}
              strokeWidth={strokeW}
            />
            <path
              d="M14 28 H22 V16 H32 V28 H42 V16 H52 V28 H58"
              fill="none"
              stroke={high ? '#16A34A' : '#5B4CE6'}
              strokeWidth={1.8}
              strokeLinejoin="round"
            />
          </g>
        );
      }

      case 'CONST_0':
      case 'CONST_1': {
        const isOne = node.type === 'CONST_1';
        return (
          <g>
            <rect
              x={4}
              y={4}
              width={w - 12}
              height={h - 8}
              rx={5}
              fill={isOne ? '#DCFCE7' : '#F1F5F9'}
              stroke={isOne ? '#16A34A' : strokeColor}
              strokeWidth={strokeW}
            />
            <text
              x={(w - 6) / 2}
              y={h / 2 + 4}
              textAnchor="middle"
              className="font-mono text-xs font-bold select-none"
              fill={isOne ? '#15803D' : '#334155'}
            >
              {isOne ? '1' : '0'}
            </text>
          </g>
        );
      }

      // ===== LOGIC GATES (IEEE / ANSI SVG SHAPES) =====
      case 'AND':
      case 'NAND': {
        const isNeg = node.type === 'NAND';
        const r = h / 2 - 4;
        const bodyRight = isNeg ? w - 18 : w - 10;
        const d = `M 14 4 L ${bodyRight - r} 4 A ${r} ${r} 0 0 1 ${bodyRight - r} ${h - 4} L 14 ${h - 4} Z`;
        return (
          <g>
            <path d={d} fill="#FFFFFF" stroke={strokeColor} strokeWidth={strokeW} />
            {isNeg && (
              <circle
                cx={bodyRight + 5}
                cy={h / 2}
                r={4.5}
                fill="#FFFFFF"
                stroke={strokeColor}
                strokeWidth={strokeW}
              />
            )}
            <text
              x={bodyRight / 2 + 4}
              y={h / 2 + 3.5}
              textAnchor="middle"
              className="font-mono text-[10px] font-semibold fill-[#475569] select-none"
            >
              {node.type}
            </text>
          </g>
        );
      }

      case 'OR':
      case 'NOR':
      case 'XOR':
      case 'XNOR': {
        const isNeg = node.type === 'NOR' || node.type === 'XNOR';
        const isXor = node.type === 'XOR' || node.type === 'XNOR';
        const leftX = isXor ? 20 : 14;
        const tipX = isNeg ? w - 18 : w - 10;
        const d = `M ${leftX} 4 Q ${leftX + 10} ${h / 2} ${leftX} ${h - 4} Q ${tipX - 18} ${h - 4} ${tipX} ${h / 2} Q ${tipX - 18} 4 ${leftX} 4 Z`;
        return (
          <g>
            {isXor && (
              <path
                d={`M ${leftX - 6} 5 Q ${leftX + 4} ${h / 2} ${leftX - 6} ${h - 5}`}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeW}
              />
            )}
            <path d={d} fill="#FFFFFF" stroke={strokeColor} strokeWidth={strokeW} />
            {isNeg && (
              <circle
                cx={tipX + 5}
                cy={h / 2}
                r={4.5}
                fill="#FFFFFF"
                stroke={strokeColor}
                strokeWidth={strokeW}
              />
            )}
            <text
              x={(leftX + tipX) / 2 - 2}
              y={h / 2 + 3.5}
              textAnchor="middle"
              className="font-mono text-[10px] font-semibold fill-[#475569] select-none"
            >
              {node.type}
            </text>
          </g>
        );
      }

      case 'NOT':
      case 'BUFFER': {
        const isNeg = node.type === 'NOT';
        const tipX = isNeg ? w - 18 : w - 10;
        return (
          <g>
            <polygon
              points={`14,6 ${tipX},${h / 2} 14,${h - 6}`}
              fill="#FFFFFF"
              stroke={strokeColor}
              strokeWidth={strokeW}
              strokeLinejoin="round"
            />
            {isNeg && (
              <circle
                cx={tipX + 5}
                cy={h / 2}
                r={4.5}
                fill="#FFFFFF"
                stroke={strokeColor}
                strokeWidth={strokeW}
              />
            )}
          </g>
        );
      }

      // ===== OUTPUTS =====
      case 'LED': {
        const sig = primarySignal(getPinBus('in'));
        const isHigh = sig === 'HIGH';
        const isErr = sig === 'ERROR';
        const fill = isHigh ? '#22C55E' : isErr ? '#EF4444' : '#E2E8F0';
        const ring = isHigh ? '#15803D' : isErr ? '#B91C1C' : '#94A3B8';
        return (
          <g>
            <rect
              x={8}
              y={4}
              width={w - 12}
              height={h - 8}
              rx={6}
              fill="#FFFFFF"
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
            {isHigh && (
              <circle cx={w / 2 + 2} cy={h / 2} r={14} fill="#22C55E" opacity={0.22} />
            )}
            <circle
              cx={w / 2 + 2}
              cy={h / 2}
              r={10}
              fill={fill}
              stroke={ring}
              strokeWidth={1.6}
            />
            <text
              x={w / 2 + 2}
              y={h / 2 + 3.5}
              textAnchor="middle"
              className="font-mono text-[9px] font-bold select-none"
              fill={isHigh || isErr ? '#FFFFFF' : '#475569'}
            >
              {isHigh ? '1' : sig === 'LOW' ? '0' : sig === 'ERROR' ? 'E' : 'X'}
            </text>
          </g>
        );
      }

      case 'OUTPUT_PIN':
      case 'PROBE': {
        const sig = primarySignal(getPinBus('in'));
        const col = signalColor(sig);
        const isProbe = node.type === 'PROBE';
        return (
          <g>
            <rect
              x={8}
              y={4}
              width={w - 12}
              height={h - 8}
              rx={isProbe ? 14 : 5}
              fill={sig === 'HIGH' ? '#ECFDF5' : '#FFFFFF'}
              stroke={selected ? '#5B4CE6' : col}
              strokeWidth={strokeW}
            />
            <text
              x={w / 2 + 2}
              y={h / 2 + 4}
              textAnchor="middle"
              className="font-mono text-xs font-bold select-none"
              fill={col}
            >
              {sig === 'HIGH' ? '1' : sig === 'LOW' ? '0' : sig === 'ERROR' ? 'ERR' : 'X'}
            </text>
          </g>
        );
      }

      case 'BINARY_DISPLAY': {
        const bus = getPinBus('in');
        const bin = formatBusBinary(bus);
        const num = bus ? busToNumber(bus) : null;
        return (
          <g>
            <rect
              x={8}
              y={4}
              width={w - 12}
              height={h - 8}
              rx={6}
              fill="#0F172A"
              stroke={selected ? '#5B4CE6' : '#3B3654'}
              strokeWidth={strokeW}
            />
            <text
              x={w / 2 + 2}
              y={24}
              textAnchor="middle"
              className="font-mono text-[13px] font-semibold select-none"
              fill="#38BDF8"
            >
              {bin}
            </text>
            <text
              x={w / 2 + 2}
              y={41}
              textAnchor="middle"
              className="font-mono text-[10px] select-none"
              fill="#94A3B8"
            >
              {num === null ? 'UNKNOWN' : `0x${num.toString(16).toUpperCase()} · DEC ${num}`}
            </text>
          </g>
        );
      }

      case 'SEVEN_SEGMENT': {
        const bus = getPinBus('in');
        const num = bus ? busToNumber(bus) : null;
        const mask = num !== null ? (SEVEN_SEG_MAP[num & 0x0f] ?? 0) : 0;
        const on = (bit: number) => ((mask >> bit) & 1) === 1;
        const segColor = (bit: number) => (on(bit) ? '#EF4444' : '#1E293B');
        const ox = 24;
        const oy = 14;
        return (
          <g>
            <rect
              x={8}
              y={4}
              width={w - 12}
              height={h - 8}
              rx={6}
              fill="#0F172A"
              stroke={selected ? '#5B4CE6' : '#3B3654'}
              strokeWidth={strokeW}
            />
            {/* a */}
            <rect x={ox + 5} y={oy} width={28} height={5} rx={2} fill={segColor(0)} />
            {/* b */}
            <rect x={ox + 33} y={oy + 5} width={5} height={27} rx={2} fill={segColor(1)} />
            {/* c */}
            <rect x={ox + 33} y={oy + 38} width={5} height={27} rx={2} fill={segColor(2)} />
            {/* d */}
            <rect x={ox + 5} y={oy + 65} width={28} height={5} rx={2} fill={segColor(3)} />
            {/* e */}
            <rect x={ox} y={oy + 38} width={5} height={27} rx={2} fill={segColor(4)} />
            {/* f */}
            <rect x={ox} y={oy + 5} width={5} height={27} rx={2} fill={segColor(5)} />
            {/* g */}
            <rect x={ox + 5} y={oy + 32} width={28} height={5} rx={2} fill={segColor(6)} />
          </g>
        );
      }

      case 'CUSTOM_IC': {
        const ic = getCustomICForNode(node);
        const headerLabel = ic?.shortName ?? 'IC?';
        const isMissing = !ic;
        return (
          <g>
            <rect
              x={8}
              y={4}
              width={w - 16}
              height={h - 8}
              rx={7}
              fill="#FFFFFF"
              stroke={isMissing ? '#DC2626' : selected ? '#5B4CE6' : '#5B4CE6'}
              strokeWidth={selected ? 2.2 : 1.6}
            />
            <path
              d={`M 9 11 Q 9 5 15 5 L ${w - 15} 5 Q ${w - 9} 5 ${w - 9} 11 L ${w - 9} 26 L 9 26 Z`}
              fill={isMissing ? '#FEF2F2' : '#EDE9FE'}
            />
            {/* DIP Package Alignment Notch */}
            <path
              d={`M ${w / 2 - 7} 5 A 7 7 0 0 0 ${w / 2 + 7} 5`}
              fill="#F7F5FF"
              stroke={isMissing ? '#DC2626' : '#5B4CE6'}
              strokeWidth={1.1}
            />
            <line
              x1={8}
              y1={26}
              x2={w - 8}
              y2={26}
              stroke={isMissing ? '#FECACA' : '#DDD6FE'}
              strokeWidth={1}
            />
            <text
              x={w / 2}
              y={20}
              textAnchor="middle"
              className="font-mono text-[10px] font-bold select-none"
              fill={isMissing ? '#DC2626' : '#4A3BD6'}
            >
              {headerLabel}
            </text>
          </g>
        );
      }

      // ===== IC BLOCKS (ARITHMETIC, SEQUENTIAL, ADVANCED) =====
      default: {
        const isSeq = spec.category === 'sequential';
        const isAdv = spec.category === 'advanced';
        const headerFill = isSeq ? '#F2EFFF' : isAdv ? '#ECFEFF' : '#F8F6FF';
        const headerText = isSeq ? '#4A3BD6' : isAdv ? '#0E7490' : '#3B3654';
        return (
          <g>
            <rect
              x={8}
              y={4}
              width={w - 16}
              height={h - 8}
              rx={6}
              fill="#FFFFFF"
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
            <path
              d={`M 9 10 Q 9 5 14 5 L ${w - 14} 5 Q ${w - 9} 5 ${w - 9} 10 L ${w - 9} 24 L 9 24 Z`}
              fill={headerFill}
            />
            <line x1={8} y1={24} x2={w - 8} y2={24} stroke="#E4DFF7" strokeWidth={1} />
            <text
              x={w / 2}
              y={18}
              textAnchor="middle"
              className="font-mono text-[10px] font-bold select-none"
              fill={headerText}
            >
              {spec.shortName}
            </text>
          </g>
        );
      }
    }
  };

  return (
    <g transform={`translate(${node.x}, ${node.y})`} data-node-id={node.id} data-node-type={node.type}>
      {/* Node Name Caption */}
      <text
        x={w / 2}
        y={-6}
        textAnchor="middle"
        className="font-mono text-[10px] font-medium fill-[#475569] select-none pointer-events-none"
      >
        {node.label}
      </text>

      {/* Rotatable Body + Pins */}
      <g transform={node.rotation ? `rotate(${node.rotation} ${w / 2} ${h / 2})` : undefined}>
        {renderBody()}

        {/* Interactive Pins */}
        {pins.map((pin) => {
          const px = pin.side === 'left' ? 0 : pin.side === 'right' ? w : pin.offset * w;
          const py = pin.side === 'top' ? 0 : pin.side === 'bottom' ? h : pin.offset * h;
          const bus = getPinBus(pin.id);
          const sig = primarySignal(bus);
          const pinCol = signalColor(sig);
          const isBus = pin.width > 1;
          const isClkPin = pin.id === 'clk';

          return (
            <g key={pin.id}>
              {/* Lead stub */}
              {pin.side === 'left' && (
                <line
                  x1={0}
                  y1={py}
                  x2={12}
                  y2={py}
                  stroke={pinCol}
                  strokeWidth={isBus ? 2.6 : 1.5}
                />
              )}
              {pin.side === 'right' && (
                <line
                  x1={w - 10}
                  y1={py}
                  x2={w}
                  y2={py}
                  stroke={pinCol}
                  strokeWidth={isBus ? 2.6 : 1.5}
                />
              )}
              {pin.side === 'top' && (
                <line
                  x1={px}
                  y1={0}
                  x2={px}
                  y2={6}
                  stroke={pinCol}
                  strokeWidth={isBus ? 2.6 : 1.5}
                />
              )}
              {pin.side === 'bottom' && (
                <line
                  x1={px}
                  y1={h - 6}
                  x2={px}
                  y2={h}
                  stroke={pinCol}
                  strokeWidth={isBus ? 2.6 : 1.5}
                />
              )}

              {/* Clock edge triangle marker for sequential blocks */}
              {isClkPin && pin.side === 'left' && (
                <polygon
                  points={`8,${py - 4} 15,${py} 8,${py + 4}`}
                  fill="none"
                  stroke="#334155"
                  strokeWidth={1.2}
                />
              )}

              {/* Pin Label inside IC blocks */}
              {showPinLabels &&
                (spec.category === 'arithmetic' ||
                  spec.category === 'sequential' ||
                  spec.category === 'advanced' ||
                  spec.category === 'custom') && (
                  <text
                    x={
                      pin.side === 'left'
                        ? isClkPin
                          ? 18
                          : 13
                        : pin.side === 'right'
                          ? w - 13
                          : px
                    }
                    y={
                      pin.side === 'top'
                        ? 14
                        : pin.side === 'bottom'
                          ? h - 9
                          : py + 3
                    }
                    textAnchor={
                      pin.side === 'left'
                        ? 'start'
                        : pin.side === 'right'
                          ? 'end'
                          : 'middle'
                    }
                    className="font-mono text-[9px] fill-[#5B587A] select-none pointer-events-none"
                  >
                    {pin.label}
                  </text>
                )}

              {/* Clickable Pin Terminal */}
              <circle
                cx={px}
                cy={py}
                r={isBus ? 5.5 : 4.5}
                fill="#FFFFFF"
                stroke={pinCol}
                strokeWidth={2}
                data-pin-node={node.id}
                data-pin-id={pin.id}
                data-pin-dir={pin.direction}
                className="cursor-crosshair hover:fill-[#EDE9FE] transition-colors"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onPinMouseDown(e, node.id, pin);
                }}
                onMouseUp={(e) => {
                  e.stopPropagation();
                  onPinMouseUp(e, node.id, pin);
                }}
              >
                <title>
                  {node.label}.{pin.label} ({pin.direction}, {pin.width}-bit): {formatBusBinary(bus)}
                </title>
              </circle>
            </g>
          );
        })}
      </g>
    </g>
  );
});
