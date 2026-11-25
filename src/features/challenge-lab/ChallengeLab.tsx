import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Lightbulb,
  RotateCcw,
  Play,
  Plus,
} from 'lucide-react';
import {
  CHALLENGES,
  evaluateChallengeCircuit,
  type ChallengeDifficulty,
  type ChallengeEvaluation,
} from '../../templates/challenges';
import type { CircuitDocument, ComponentType } from '../../types/circuit';
import { cloneCircuitDocument } from '../../templates/circuitTemplates';
import { simulateCircuit } from '../../engine/simulation/simulator';
import { validateNewConnection } from '../../engine/validation/connectionValidator';
import { COMPONENT_CATALOG } from '../../engine/gates/componentCatalog';
import { useChipCraftStore } from '../../state/useChipCraftStore';
import { CircuitCanvas } from '../circuit-studio/CircuitCanvas';
import { Button, SegmentedTabs } from '../../design-system/ui';

const QUICK_PARTS: ComponentType[] = [
  'AND',
  'OR',
  'NOT',
  'NAND',
  'NOR',
  'XOR',
  'HALF_ADDER',
  'FULL_ADDER',
  'ADDER_4BIT',
  'MUX_2TO1',
  'COMPARATOR_4BIT',
  'ALU_4BIT',
  'REGISTER_4BIT',
  'COUNTER_4BIT',
  'DECODER_2TO4',
];

export function ChallengeLab() {
  const settings = useChipCraftStore((s) => s.settings);
  const completedChallenges = useChipCraftStore((s) => s.completedChallenges);
  const markChallengeCompleted = useChipCraftStore((s) => s.markChallengeCompleted);
  const pushToast = useChipCraftStore((s) => s.pushToast);

  const [difficultyFilter, setDifficultyFilter] = useState<ChallengeDifficulty | 'All'>('All');
  const [activeId, setActiveId] = useState(CHALLENGES[0].id);
  const [showHints, setShowHints] = useState(false);

  const challenge = useMemo(
    () => CHALLENGES.find((c) => c.id === activeId) ?? CHALLENGES[0],
    [activeId]
  );

  // Per-challenge local working circuit
  const [drafts, setDrafts] = useState<Record<string, CircuitDocument>>(() => {
    const map: Record<string, CircuitDocument> = {};
    for (const ch of CHALLENGES) {
      map[ch.id] = cloneCircuitDocument(ch.starterCircuit, ch.starterCircuit.name);
    }
    return map;
  });

  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<ChallengeEvaluation | null>(null);
  const [undoStack, setUndoStack] = useState<CircuitDocument[]>([]);
  const [redoStack, setRedoStack] = useState<CircuitDocument[]>([]);

  const activeCircuit = drafts[challenge.id] ?? challenge.starterCircuit;

  const liveSim = useMemo(
    () => simulateCircuit(activeCircuit.nodes, activeCircuit.wires, { clockHigh: false }),
    [activeCircuit]
  );

  const updateDraft = (updater: (doc: CircuitDocument) => CircuitDocument, recordUndo = true) => {
    setDrafts((prev) => {
      const current = prev[challenge.id] ?? cloneCircuitDocument(challenge.starterCircuit);
      if (recordUndo) {
        setUndoStack((s) => [...s.slice(-29), current]);
        setRedoStack([]);
      }
      return {
        ...prev,
        [challenge.id]: updater(current),
      };
    });
    setEvaluation(null);
  };

  const handleChallengeUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((r) => [activeCircuit, ...r.slice(0, 29)]);
    setDrafts((prev) => ({ ...prev, [challenge.id]: previous }));
    setEvaluation(null);
  };

  const handleChallengeRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setRedoStack((r) => r.slice(1));
    setUndoStack((s) => [...s.slice(-29), activeCircuit]);
    setDrafts((prev) => ({ ...prev, [challenge.id]: next }));
    setEvaluation(null);
  };

  const handleChallengeRotate = () => {
    if (selectedNodeIds.length === 0) return;
    const sel = new Set(selectedNodeIds);
    updateDraft((doc) => ({
      ...doc,
      nodes: doc.nodes.map((n) => {
        if (!sel.has(n.id) || !COMPONENT_CATALOG[n.type].rotatable) return n;
        return { ...n, rotation: ((n.rotation + 90) % 360) as 0 | 90 | 180 | 270 };
      }),
    }));
  };

  const handleAddPart = (type: ComponentType, x = 250, y = 140) => {
    const spec = COMPONENT_CATALOG[type];
    updateDraft((doc) => ({
      ...doc,
      nodes: [
        ...doc.nodes,
        {
          id: `ch_${type.toLowerCase()}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 4)}`,
          type,
          label: `${spec.shortName}${doc.nodes.length + 1}`,
          x: Math.round(x / 20) * 20,
          y: Math.round(y / 20) * 20,
          rotation: 0,
          value: 0,
        },
      ],
    }));
  };

  const handleConnect = (fn: string, fp: string, tn: string, tp: string) => {
    const check = validateNewConnection(activeCircuit.nodes, activeCircuit.wires, fn, fp, tn, tp);
    if (!check.valid || !check.normalized) {
      pushToast({ tone: 'error', title: check.reason ?? 'Invalid wire connection', detail: check.suggestion });
      return false;
    }
    updateDraft((doc) => ({
      ...doc,
      wires: [
        ...doc.wires,
        {
          id: `cw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 4)}`,
          ...check.normalized!,
        },
      ],
    }));
    return true;
  };

  const handleDeleteSelection = () => {
    // Protect required starter input/output terminals from accidental deletion
    const requiredLabels = new Set([
      ...Object.keys(challenge.vectors[0].inputs),
      ...Object.keys(challenge.vectors[0].expected),
    ]);
    const delSet = new Set(
      selectedNodeIds.filter((id) => {
        const node = activeCircuit.nodes.find((n) => n.id === id);
        return node && !requiredLabels.has(node.label.toUpperCase());
      })
    );
    updateDraft((doc) => ({
      ...doc,
      nodes: doc.nodes.filter((n) => !delSet.has(n.id)),
      wires: doc.wires.filter(
        (w) => w.id !== selectedWireId && !delSet.has(w.fromNodeId) && !delSet.has(w.toNodeId)
      ),
    }));
    setSelectedNodeIds([]);
    setSelectedWireId(null);
  };

  const handleRunVerification = () => {
    const result = evaluateChallengeCircuit(challenge, activeCircuit);
    setEvaluation(result);
    if (result.passed) {
      markChallengeCompleted(challenge.id);
      pushToast({
        tone: 'success',
        title: `Challenge Passed: ${challenge.title}`,
        detail: `All ${result.totalCount} test vectors verified accurately.`,
      });
    } else {
      pushToast({
        tone: 'warning',
        title: `Verification Failed (${result.passedCount}/${result.totalCount} vectors passed)`,
        detail:
          result.missingTerminals.length > 0
            ? `Missing required terminals: ${result.missingTerminals.join(', ')}`
            : 'Inspect the mismatched rows below and check your wiring.',
      });
    }
  };

  const filteredList = CHALLENGES.filter(
    (c) => difficultyFilter === 'All' || c.difficulty === difficultyFilter
  );

  return (
    <div className="h-full flex flex-col lg:flex-row bg-[#F7F5FF] overflow-hidden">
      {/* Left Challenge List */}
      <aside className="w-full lg:w-72 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-[#E4DFF7] flex flex-col max-h-56 lg:max-h-none overflow-hidden">
        <div className="p-3 border-b border-[#E4DFF7] space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#141226]">Engineering Challenges</span>
            <span className="font-mono text-[#16A34A] font-semibold tabular-nums">
              {completedChallenges.length}/{CHALLENGES.length} solved
            </span>
          </div>
          <SegmentedTabs
            value={difficultyFilter}
            onChange={setDifficultyFilter}
            className="w-full justify-between"
            options={[
              { value: 'All', label: 'All' },
              { value: 'Beginner', label: 'Beg' },
              { value: 'Intermediate', label: 'Int' },
              { value: 'Advanced', label: 'Adv' },
            ]}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredList.map((ch) => {
            const solved = completedChallenges.includes(ch.id);
            const active = ch.id === challenge.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => {
                  setActiveId(ch.id);
                  setSelectedNodeIds([]);
                  setSelectedWireId(null);
                  setEvaluation(null);
                  setShowHints(false);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-md transition-colors flex items-start justify-between gap-2 cursor-pointer ${
                  active ? 'bg-[#F2EFFF] text-[#4A3BD6]' : 'hover:bg-[#F7F5FF] text-[#141226]'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{ch.title}</div>
                  <div className="text-[11px] text-[#64748B]">
                    {ch.difficulty} · {ch.vectors.length} test vectors
                  </div>
                </div>
                {solved && <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main Challenge Workbench */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Brief & Verification Controls */}
        <div className="shrink-0 bg-white border-b border-[#E4DFF7] px-5 py-3.5 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs text-[#64748B]">
                {challenge.difficulty} Challenge · {challenge.vectors.length} deterministic test vectors
              </div>
              <h2 className="text-base font-bold text-[#141226]">{challenge.title}</h2>
              <p className="text-xs text-[#475569] mt-0.5">{challenge.summary}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowHints((h) => !h)}>
                <Lightbulb className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>{showHints ? 'Hide Hints' : 'Hints'}</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setDrafts((prev) => ({
                    ...prev,
                    [challenge.id]: cloneCircuitDocument(challenge.starterCircuit),
                  }));
                  setEvaluation(null);
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Starter</span>
              </Button>
              <Button variant="primary" size="sm" onClick={handleRunVerification}>
                <Play className="w-3.5 h-3.5" />
                <span>Verify Circuit</span>
              </Button>
            </div>
          </div>

          {showHints && (
            <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-md text-xs text-[#92400E] space-y-1">
              {challenge.hints.map((h, i) => (
                <div key={i}>• {h}</div>
              ))}
            </div>
          )}

          {/* Quick-Add Component Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <span className="text-[11px] font-medium text-[#64748B] shrink-0 mr-1">Add part:</span>
            {QUICK_PARTS.map((type) => (
              <button
                key={type}
                type="button"
                draggable
                onDragStart={(e) => e.dataTransfer.setData('application/chipcraft-component', type)}
                onClick={() => handleAddPart(type, 260 + (activeCircuit.nodes.length % 4) * 20, 140)}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono bg-[#F7F5FF] hover:bg-[#F2EFFF] hover:text-[#5B4CE6] border border-[#E4DFF7] rounded whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                {COMPONENT_CATALOG[type].shortName}
              </button>
            ))}
          </div>
        </div>

        {/* Embedded Interactive Circuit Canvas */}
        <div className="flex-1 min-h-[260px] relative">
          <CircuitCanvas
            circuit={activeCircuit}
            simulation={liveSim}
            settings={settings}
            selectedNodeIds={selectedNodeIds}
            selectedWireId={selectedWireId}
            onSelect={(n, w) => {
              setSelectedNodeIds(n);
              setSelectedWireId(w ?? null);
            }}
            onAddNode={handleAddPart}
            onMoveNodes={(moves) => {
              const map = new Map(moves.map((m) => [m.id, m]));
              updateDraft((doc) => ({
                ...doc,
                nodes: doc.nodes.map((n) => {
                  const m = map.get(n.id);
                  return m ? { ...n, x: Math.round(m.x / 20) * 20, y: Math.round(m.y / 20) * 20 } : n;
                }),
              }));
            }}
            onConnectPins={handleConnect}
            onToggleInput={(id, bit) => {
              updateDraft((doc) => ({
                ...doc,
                nodes: doc.nodes.map((n) => {
                  if (n.id !== id) return n;
                  if (n.type === 'BINARY_INPUT' && bit !== undefined) {
                    return { ...n, value: (n.value ?? 0) ^ (1 << bit) };
                  }
                  return { ...n, value: n.value ? 0 : 1 };
                }),
              }));
            }}
            onDeleteSelection={handleDeleteSelection}
            onRotateSelection={handleChallengeRotate}
            onCopy={() => {}}
            onPaste={() => {}}
            onDuplicate={() => {}}
            onUndo={handleChallengeUndo}
            onRedo={handleChallengeRedo}
          />
        </div>

        {/* Verification Results Drawer */}
        {evaluation && (
          <div className="shrink-0 max-h-52 overflow-y-auto bg-white border-t border-[#E4DFF7] px-5 py-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span
                className={`flex items-center gap-1.5 font-semibold ${
                  evaluation.passed ? 'text-[#16A34A]' : 'text-[#DC2626]'
                }`}
              >
                {evaluation.passed ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                {evaluation.passed
                  ? 'Verification Passed — Circuit matches specification!'
                  : `Verification Failed (${evaluation.passedCount}/${evaluation.totalCount} vectors matched)`}
              </span>
              <span className="font-mono text-[#64748B]">Exhaustive Simulation Check</span>
            </div>

            {evaluation.results.length > 0 && (
              <table className="w-full text-xs font-mono tabular-nums border border-[#E4DFF7]">
                <thead className="bg-[#F7F5FF] text-[#64748B]">
                  <tr>
                    <th className="py-1.5 px-2 text-left border-b border-[#E4DFF7]">#</th>
                    <th className="py-1.5 px-2 text-left border-b border-[#E4DFF7]">Inputs</th>
                    <th className="py-1.5 px-2 text-left border-b border-[#E4DFF7]">Expected</th>
                    <th className="py-1.5 px-2 text-left border-b border-[#E4DFF7]">Actual</th>
                    <th className="py-1.5 px-2 text-right border-b border-[#E4DFF7]">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1EEFC]">
                  {evaluation.results.map((r) => (
                    <tr key={r.index} className={r.passed ? '' : 'bg-[#FEF2F2]'}>
                      <td className="py-1 px-2 text-[#64748B]">{r.index}</td>
                      <td className="py-1 px-2">
                        {Object.entries(r.inputs)
                          .map(([k, v]) => `${k}=${v}`)
                          .join(' ')}
                      </td>
                      <td className="py-1 px-2 text-[#141226]">
                        {Object.entries(r.expected)
                          .map(([k, v]) => `${k}=${v}`)
                          .join(' ')}
                      </td>
                      <td className="py-1 px-2 text-[#141226]">
                        {Object.entries(r.actual)
                          .map(([k, v]) => `${k}=${v === null ? 'X' : v}`)
                          .join(' ')}
                      </td>
                      <td
                        className={`py-1 px-2 text-right font-semibold ${
                          r.passed ? 'text-[#16A34A]' : 'text-[#DC2626]'
                        }`}
                      >
                        {r.passed ? 'PASS' : 'FAIL'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
