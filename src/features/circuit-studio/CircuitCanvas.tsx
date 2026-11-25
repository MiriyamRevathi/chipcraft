import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CircuitDocument,
  CircuitNode,
  ComponentType,
  PinDefinition,
  SimulationResult,
  UserSettings,
} from '../../types/circuit';
import {
  getNodeDimensions,
  getPinAbsolutePosition,
} from '../../engine/gates/componentCatalog';
import { formatBusBinary, primarySignal, signalColor } from '../../engine/signals/signalModel';
import { ComponentSymbol } from './ComponentSymbol';

interface CircuitCanvasProps {
  circuit: CircuitDocument;
  simulation: SimulationResult;
  settings: UserSettings;
  selectedNodeIds: string[];
  selectedWireId: string | null;
  onSelect: (nodeIds: string[], wireId?: string | null) => void;
  onAddNode: (type: ComponentType, x: number, y: number, customIcId?: string) => void;
  onMoveNodes: (moves: Array<{ id: string; x: number; y: number }>, recordHistory?: boolean) => void;
  onConnectPins: (fromNodeId: string, fromPinId: string, toNodeId: string, toPinId: string) => boolean;
  onToggleInput: (nodeId: string, bitIndex?: number) => void;
  onDeleteSelection: () => void;
  onRotateSelection: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onUndo: () => void;
  onRedo: () => void;
  viewportApiRef?: React.MutableRefObject<{
    zoomIn: () => void;
    zoomOut: () => void;
    fitToView: () => void;
    getZoom: () => number;
  } | null>;
}

function buildWirePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  style: 'orthogonal' | 'bezier'
): string {
  if (style === 'bezier') {
    const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  }
  // Clean orthogonal Manhattan wire routing
  const midX = x1 + (x2 - x1) / 2;
  if (x2 >= x1 + 16) {
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  }
  const offset = 24;
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} L ${x1 + offset} ${y1} L ${x1 + offset} ${midY} L ${x2 - offset} ${midY} L ${x2 - offset} ${y2} L ${x2} ${y2}`;
}

export function CircuitCanvas({
  circuit,
  simulation,
  settings,
  selectedNodeIds,
  selectedWireId,
  onSelect,
  onAddNode,
  onMoveNodes,
  onConnectPins,
  onToggleInput,
  onDeleteSelection,
  onRotateSelection,
  onCopy,
  onPaste,
  onDuplicate,
  onUndo,
  onRedo,
  viewportApiRef,
}: CircuitCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [zoom, setZoom] = useState(1);

  const [draggingNodes, setDraggingNodes] = useState<{
    startMouse: { x: number; y: number };
    initialPositions: Array<{ id: string; x: number; y: number }>;
    moved: boolean;
  } | null>(null);

  const [panning, setPanning] = useState<{
    startMouse: { x: number; y: number };
    startPan: { x: number; y: number };
  } | null>(null);

  const [marquee, setMarquee] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  const [pendingWire, setPendingWire] = useState<{
    nodeId: string;
    pin: PinDefinition;
    startX: number;
    startY: number;
    currX: number;
    currY: number;
  } | null>(null);

  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  const fitToView = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || circuit.nodes.length === 0) {
      setPan({ x: 40, y: 40 });
      setZoom(1);
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of circuit.nodes) {
      const { width, height } = getNodeDimensions(n);
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y - 16);
      maxX = Math.max(maxX, n.x + width);
      maxY = Math.max(maxY, n.y + height);
    }
    const pad = 64;
    const contentW = Math.max(200, maxX - minX + pad * 2);
    const contentH = Math.max(160, maxY - minY + pad * 2);
    const nextZoom = Math.max(0.45, Math.min(1.25, Math.min(rect.width / contentW, rect.height / contentH)));
    const nextPanX = (rect.width - (maxX - minX) * nextZoom) / 2 - minX * nextZoom;
    const nextPanY = (rect.height - (maxY - minY) * nextZoom) / 2 - minY * nextZoom;
    setZoom(nextZoom);
    setPan({ x: nextPanX, y: nextPanY });
  }, [circuit.nodes]);

  useEffect(() => {
    if (viewportApiRef) {
      viewportApiRef.current = {
        zoomIn: () => setZoom((z) => Math.min(2.4, Number((z * 1.15).toFixed(2)))),
        zoomOut: () => setZoom((z) => Math.max(0.35, Number((z / 1.15).toFixed(2)))),
        fitToView,
        getZoom: () => zoom,
      };
    }
  }, [viewportApiRef, fitToView, zoom]);

  // Keyboard shortcuts when canvas or workspace is focused
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDeleteSelection();
      } else if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onRotateSelection();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        onRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        onCopy();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        onPaste();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        onDuplicate();
      } else if (e.key === 'Escape') {
        setPendingWire(null);
        onSelect([], null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    onCopy,
    onDeleteSelection,
    onDuplicate,
    onPaste,
    onRedo,
    onRotateSelection,
    onSelect,
    onUndo,
  ]);

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.09 : 1 / 1.09;
    const nextZoom = Math.max(0.35, Math.min(2.5, zoom * factor));
    const scaleChange = nextZoom / zoom;
    setPan({
      x: mouseX - (mouseX - pan.x) * scaleChange,
      y: mouseY - (mouseY - pan.y) * scaleChange,
    });
    setZoom(nextZoom);
  };

  const handleBgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 1 || (e.button === 0 && !e.shiftKey)) {
      if (e.button === 0) onSelect([], null);
      setPanning({
        startMouse: { x: e.clientX, y: e.clientY },
        startPan: { ...pan },
      });
    } else if (e.button === 0 && e.shiftKey) {
      const w = screenToWorld(e.clientX, e.clientY);
      setMarquee({ x1: w.x, y1: w.y, x2: w.x, y2: w.y });
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, node: CircuitNode) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    let nextSelected = selectedNodeIds;
    if (e.shiftKey) {
      nextSelected = selectedNodeIds.includes(node.id)
        ? selectedNodeIds.filter((id) => id !== node.id)
        : [...selectedNodeIds, node.id];
      onSelect(nextSelected, null);
    } else if (!selectedNodeIds.includes(node.id)) {
      nextSelected = [node.id];
      onSelect(nextSelected, null);
    }

    const initialPositions = circuit.nodes
      .filter((n) => nextSelected.includes(n.id))
      .map((n) => ({ id: n.id, x: n.x, y: n.y }));

    setDraggingNodes({
      startMouse: { x: e.clientX, y: e.clientY },
      initialPositions,
      moved: false,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (pendingWire) {
      const pt = screenToWorld(e.clientX, e.clientY);
      setPendingWire({ ...pendingWire, currX: pt.x, currY: pt.y });
      return;
    }

    if (draggingNodes) {
      const dx = (e.clientX - draggingNodes.startMouse.x) / zoom;
      const dy = (e.clientY - draggingNodes.startMouse.y) / zoom;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2 || draggingNodes.moved) {
        const moves = draggingNodes.initialPositions.map((p) => ({
          id: p.id,
          x: p.x + dx,
          y: p.y + dy,
        }));
        onMoveNodes(moves, !draggingNodes.moved);
        if (!draggingNodes.moved) {
          setDraggingNodes({ ...draggingNodes, moved: true });
        }
      }
      return;
    }

    if (marquee) {
      const pt = screenToWorld(e.clientX, e.clientY);
      setMarquee({ ...marquee, x2: pt.x, y2: pt.y });
      return;
    }

    if (panning) {
      setPan({
        x: panning.startPan.x + (e.clientX - panning.startMouse.x),
        y: panning.startPan.y + (e.clientY - panning.startMouse.y),
      });
    }
  };

  const handleMouseUp = () => {
    if (marquee) {
      const minX = Math.min(marquee.x1, marquee.x2);
      const maxX = Math.max(marquee.x1, marquee.x2);
      const minY = Math.min(marquee.y1, marquee.y2);
      const maxY = Math.max(marquee.y1, marquee.y2);
      const hits = circuit.nodes
        .filter((n) => {
          const { width, height } = getNodeDimensions(n);
          return n.x + width >= minX && n.x <= maxX && n.y + height >= minY && n.y <= maxY;
        })
        .map((n) => n.id);
      onSelect(hits, null);
      setMarquee(null);
    }
    setDraggingNodes(null);
    setPanning(null);
    setPendingWire(null);
  };

  const nodeMap = useMemo(() => new Map(circuit.nodes.map((n) => [n.id, n])), [circuit.nodes]);
  const selectedNodeSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

  const handlePinMouseDown = useCallback(
    (_e: React.MouseEvent, nodeId: string, pin: PinDefinition) => {
      const node = nodeMap.get(nodeId);
      if (!node) return;
      const pos = getPinAbsolutePosition(node, pin.id);
      setPendingWire({
        nodeId,
        pin,
        startX: pos.x,
        startY: pos.y,
        currX: pos.x,
        currY: pos.y,
      });
    },
    [nodeMap]
  );

  const handlePinMouseUp = useCallback(
    (_e: React.MouseEvent, nodeId: string, pin: PinDefinition) => {
      setPendingWire((current) => {
        if (!current) return null;
        onConnectPins(current.nodeId, current.pin.id, nodeId, pin.id);
        return null;
      });
    },
    [onConnectPins]
  );

  const handleDrop = (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    const customIcId = e.dataTransfer.getData('application/chipcraft-custom-ic');
    if (customIcId) {
      const pos = screenToWorld(e.clientX, e.clientY);
      onAddNode('CUSTOM_IC', pos.x - 66, pos.y - 46, customIcId);
      return;
    }
    const compType = e.dataTransfer.getData('application/chipcraft-component') as ComponentType;
    if (!compType) return;
    const pos = screenToWorld(e.clientX, e.clientY);
    onAddNode(compType, pos.x - 44, pos.y - 28);
  };

  const wireGeometries = useMemo(
    () =>
      circuit.wires.flatMap((wire) => {
        const fromNode = nodeMap.get(wire.fromNodeId);
        const toNode = nodeMap.get(wire.toNodeId);
        if (!fromNode || !toNode) return [];
        const p1 = getPinAbsolutePosition(fromNode, wire.fromPinId);
        const p2 = getPinAbsolutePosition(toNode, wire.toPinId);
        return [
          {
            wire,
            fromLabel: fromNode.label,
            toLabel: toNode.label,
            d: buildWirePath(p1.x, p1.y, p2.x, p2.y, settings.wireStyle),
          },
        ];
      }),
    [circuit.wires, nodeMap, settings.wireStyle]
  );

  const gridStep = settings.gridSize * zoom;

  return (
    <div className="relative w-full h-full bg-[#F7F5FF] overflow-hidden select-none">
      <svg
        ref={svgRef}
        className={`w-full h-full ${panning ? 'cursor-grabbing' : pendingWire ? 'cursor-crosshair' : 'cursor-default'}`}
        onWheel={handleWheel}
        onMouseDown={handleBgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={handleDrop}
        role="application"
        aria-label="Digital Circuit Schematic Canvas"
      >
        <defs>
          <pattern
            id="chipcraft-grid"
            width={gridStep}
            height={gridStep}
            patternUnits="userSpaceOnUse"
            x={pan.x % gridStep}
            y={pan.y % gridStep}
          >
            <circle cx={1} cy={1} r={1} fill="#D5CEF0" />
          </pattern>
        </defs>

        {settings.showGrid && <rect width="100%" height="100%" fill="url(#chipcraft-grid)" />}

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Wires Layer */}
          {wireGeometries.map(({ wire, fromLabel, toLabel, d }) => {
            const bus = simulation.wireValues[wire.id];
            const sig = primarySignal(bus);
            const col = signalColor(sig);
            const isBus = (bus?.width ?? 1) > 1;
            const isSelected = selectedWireId === wire.id;

            return (
              <g
                key={wire.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect([], wire.id);
                }}
                className="cursor-pointer"
              >
                {/* Wider invisible hit target for easy wire selection */}
                <path d={d} fill="none" stroke="transparent" strokeWidth={12} />
                {isSelected && (
                  <path
                    d={d}
                    fill="none"
                    stroke="#5B4CE6"
                    strokeWidth={isBus ? 7 : 5}
                    opacity={0.28}
                    strokeLinecap="round"
                  />
                )}
                <path
                  d={d}
                  fill="none"
                  stroke={isSelected ? '#5B4CE6' : col}
                  strokeWidth={isBus ? 3.5 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={sig === 'HIGH_IMPEDANCE' ? '6 4' : undefined}
                >
                  <title>
                    {fromLabel}.{wire.fromPinId} → {toLabel}.{wire.toPinId} ({formatBusBinary(bus)})
                  </title>
                </path>
              </g>
            );
          })}

          {/* Pending Wire Preview */}
          {pendingWire && (
            <path
              d={buildWirePath(
                pendingWire.startX,
                pendingWire.startY,
                pendingWire.currX,
                pendingWire.currY,
                settings.wireStyle
              )}
              fill="none"
              stroke="#5B4CE6"
              strokeWidth={2}
              strokeDasharray="5 4"
              className="pointer-events-none"
            />
          )}

          {/* Components Layer */}
          {circuit.nodes.map((node) => (
            <g
              key={node.id}
              onMouseDown={(e) => handleNodeMouseDown(e, node)}
              className="cursor-move"
            >
              <ComponentSymbol
                node={node}
                selected={selectedNodeSet.has(node.id)}
                pinValues={simulation.pinValues}
                showPinLabels={settings.showPinLabels}
                onPinMouseDown={handlePinMouseDown}
                onPinMouseUp={handlePinMouseUp}
                onToggleInput={onToggleInput}
              />
            </g>
          ))}

          {/* Marquee Selection Rectangle */}
          {marquee && (
            <rect
              x={Math.min(marquee.x1, marquee.x2)}
              y={Math.min(marquee.y1, marquee.y2)}
              width={Math.abs(marquee.x2 - marquee.x1)}
              height={Math.abs(marquee.y2 - marquee.y1)}
              fill="#5B4CE6"
              fillOpacity={0.08}
              stroke="#5B4CE6"
              strokeWidth={1}
              strokeDasharray="4 3"
              className="pointer-events-none"
            />
          )}
        </g>
      </svg>

      {/* Quiet Canvas HUD Overlay */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 px-2.5 py-1 bg-white/95 border border-[#E4DFF7] rounded-md text-[11px] font-mono text-[#5B587A] tabular-nums">
        <span>{Math.round(zoom * 100)}%</span>
        <span aria-hidden="true">·</span>
        <span>{circuit.nodes.length} parts</span>
        <span aria-hidden="true">·</span>
        <span>{circuit.wires.length} wires</span>
        <span className="hidden sm:inline" aria-hidden="true">·</span>
        <span className="hidden sm:inline">Drag pin-to-pin to wire · Shift+drag to box-select</span>
      </div>

      {/* Signal Legend */}
      <div className="pointer-events-none absolute bottom-3 right-3 hidden md:flex items-center gap-3 px-2.5 py-1 bg-white/95 border border-[#E4DFF7] rounded-md text-[11px] font-mono text-[#4E4A6D]">
        <span className="text-[#16A34A] font-semibold">1 HIGH</span>
        <span className="text-[#64748B] font-semibold">0 LOW</span>
        <span className="text-[#B45309] font-semibold">X FLOAT</span>
        <span className="text-[#0891B2] font-semibold">Z HI-Z</span>
        <span className="text-[#DC2626] font-semibold">E ERR</span>
      </div>
    </div>
  );
}
