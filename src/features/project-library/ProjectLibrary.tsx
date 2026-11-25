import React, { useMemo, useRef, useState } from 'react';
import {
  Plus,
  Upload,
  Download,
  Copy,
  Trash2,
  FolderOpen,
  Search,
  Edit3,
  Check,
  AlertCircle,
  Cpu,
} from 'lucide-react';
import { useChipCraftStore } from '../../state/useChipCraftStore';
import { BUILT_IN_EXAMPLES } from '../../templates/circuitTemplates';
import { parseImportedProjectJSON, serializeProjectToJSON } from '../../storage/projectStorage';
import { serializeCustomICToJSON } from '../../engine/subcircuit/customIcEngine';
import type { CustomICDefinition, ProjectKind, ProjectRecord } from '../../types/circuit';
import { Button, SegmentedTabs } from '../../design-system/ui';

export function ProjectLibrary() {
  const projects = useChipCraftStore((s) => s.projects);
  const projectsLoaded = useChipCraftStore((s) => s.projectsLoaded);
  const customIcs = useChipCraftStore((s) => s.customIcs);
  const customIcsLoaded = useChipCraftStore((s) => s.customIcsLoaded);
  const importCustomICFromJSON = useChipCraftStore((s) => s.importCustomICFromJSON);
  const removeCustomICDefinition = useChipCraftStore((s) => s.removeCustomICDefinition);
  const newBlankCircuit = useChipCraftStore((s) => s.newBlankCircuit);
  const openProject = useChipCraftStore((s) => s.openProject);
  const removeProject = useChipCraftStore((s) => s.removeProject);
  const renameProject = useChipCraftStore((s) => s.renameProject);
  const duplicateProject = useChipCraftStore((s) => s.duplicateProject);
  const saveCustomProject = useChipCraftStore((s) => s.saveCustomProject);
  const loadCircuitDocument = useChipCraftStore((s) => s.loadCircuitDocument);
  const setWorkspace = useChipCraftStore((s) => s.setWorkspace);
  const pushToast = useChipCraftStore((s) => s.pushToast);
  const localDiskBackendAvailable = useChipCraftStore((s) => s.localDiskBackendAvailable);

  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | ProjectKind>('all');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const icFileInputRef = useRef<HTMLInputElement>(null);

  const customIcList = useMemo(
    () => Object.values(customIcs).sort((a, b) => b.updatedAt - a.updatedAt),
    [customIcs]
  );

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (kindFilter !== 'all' && p.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
  }, [projects, query, kindFilter]);

  const handleExportProject = (proj: ProjectRecord) => {
    const json = serializeProjectToJSON(proj);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${proj.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'project'}.chipcraft.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast({ tone: 'success', title: `Exported "${proj.name}"` });
  };

  const handleImportFile = async (file: File) => {
    setImportError(null);
    try {
      const text = await file.text();
      const parsed = parseImportedProjectJSON(text);
      if (!parsed.ok) {
        setImportError(parsed.error);
        pushToast({ tone: 'error', title: 'Import Failed', detail: parsed.error });
        return;
      }
      await saveCustomProject(parsed.project);
      pushToast({
        tone: 'success',
        title: `Imported "${parsed.project.name}"`,
        detail: 'Saved to local IndexedDB Project Library.',
      });
    } catch {
      setImportError('Failed to read the selected file.');
    }
  };

  const handleExportCustomIc = (ic: CustomICDefinition) => {
    const json = serializeCustomICToJSON(ic, customIcs);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ic.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'custom-ic'}.chipcraft-ic.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast({ tone: 'success', title: `Exported Custom IC "${ic.name}"` });
  };

  const handleImportCustomIc = async (file: File) => {
    setImportError(null);
    try {
      const text = await file.text();
      const res = await importCustomICFromJSON(text);
      if (!res.ok) {
        setImportError(res.error);
      }
    } catch {
      setImportError('Failed to read the selected Custom IC file.');
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#F7F5FF]">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-10">
        {/* Top Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#141226]">Local Project Library</h2>
            <p className="text-sm text-[#5B587A] mt-0.5">
              {localDiskBackendAvailable
                ? 'Synced locally to browser IndexedDB and local disk JSON files (./data/projects). Export or import JSON anytime.'
                : 'Stored privately in browser IndexedDB storage. Export or import JSON files at any time.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
                e.target.value = '';
              }}
            />
            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-3.5 h-3.5" />
              Import JSON
            </Button>
            <Button variant="primary" size="sm" onClick={() => newBlankCircuit('New Circuit')}>
              <Plus className="w-3.5 h-3.5" />
              New Circuit Project
            </Button>
          </div>
        </div>

        {importError && (
          <div className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-lg flex items-start gap-2.5 text-xs text-[#B91C1C]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>Could not import project file:</strong> {importError}
            </div>
          </div>
        )}

        {/* Saved Local Projects Section */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-[#8782A6] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search local projects..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#E4DFF7] rounded-md focus:outline-none focus:border-[#5B4CE6]"
              />
            </div>

            <SegmentedTabs
              value={kindFilter}
              onChange={setKindFilter}
              options={[
                { value: 'all', label: `All (${projects.length})` },
                { value: 'circuit', label: 'Circuits' },
                { value: 'cpu', label: 'CPU' },
                { value: 'hdl', label: 'HDL' },
              ]}
            />
          </div>

          {!projectsLoaded ? (
            <div className="bg-white border border-[#E4DFF7] rounded-lg px-6 py-10 text-center space-y-2">
              <div className="w-6 h-6 border-2 border-[#E4DFF7] border-t-[#5B4CE6] rounded-full animate-spin mx-auto" />
              <div className="text-xs text-[#5B587A]">Loading local project library...</div>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="bg-white border border-[#E4DFF7] rounded-lg px-6 py-10 text-center space-y-3">
              <FolderOpen className="w-7 h-7 text-[#8782A6] mx-auto" />
              <div className="text-sm font-medium text-[#141226]">
                {projects.length === 0
                  ? 'Your local library is empty'
                  : 'No projects match your current filter'}
              </div>
              <p className="text-xs text-[#5B587A] max-w-md mx-auto">
                Click Save inside Circuit Studio, CPU Architect, or HDL Studio—or import a `.chipcraft.json` file above.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-[#E4DFF7] rounded-lg divide-y divide-[#E4DFF7]">
              {filteredProjects.map((proj) => (
                <div
                  key={proj.id}
                  className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF9FF] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    {renamingId === proj.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && renameDraft.trim()) {
                              void renameProject(proj.id, renameDraft.trim());
                              setRenamingId(null);
                            }
                          }}
                          className="px-2 py-1 text-sm font-medium bg-white border border-[#5B4CE6] rounded focus:outline-none"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            if (renameDraft.trim()) void renameProject(proj.id, renameDraft.trim());
                            setRenamingId(null);
                          }}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openProject(proj)}
                        className="text-sm font-semibold text-[#141226] hover:text-[#5B4CE6] text-left truncate block cursor-pointer"
                      >
                        {proj.name}
                      </button>
                    )}
                    <div className="text-xs text-[#5B587A] mt-0.5 truncate">
                      <span className="capitalize">{proj.kind}</span> · {proj.description} · Updated{' '}
                      {new Date(proj.updatedAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="secondary" size="sm" onClick={() => openProject(proj)}>
                      Open
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Rename project"
                      onClick={() => {
                        setRenamingId(proj.id);
                        setRenameDraft(proj.name);
                      }}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Duplicate project"
                      onClick={() => void duplicateProject(proj.id)}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Export JSON"
                      onClick={() => handleExportProject(proj)}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Delete project"
                      onClick={() => void removeProject(proj.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Reusable Custom ICs Section */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#141226]">
                Reusable Custom ICs ({customIcList.length})
              </h3>
              <p className="text-xs text-[#5B587A] mt-0.5">
                Packaged subcircuits saved locally and available directly in the Circuit Studio palette.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={icFileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportCustomIc(file);
                  e.target.value = '';
                }}
              />
              <Button variant="secondary" size="sm" onClick={() => icFileInputRef.current?.click()}>
                <Upload className="w-3.5 h-3.5" />
                Import Custom IC JSON
              </Button>
            </div>
          </div>

          {!customIcsLoaded ? (
            <div className="bg-white border border-[#E4DFF7] rounded-lg px-6 py-8 text-center text-xs text-[#5B587A]">
              Loading Custom IC definitions...
            </div>
          ) : customIcList.length === 0 ? (
            <div className="bg-white border border-[#E4DFF7] rounded-lg px-6 py-8 text-center space-y-2">
              <Cpu className="w-6 h-6 text-[#8782A6] mx-auto" />
              <div className="text-sm font-medium text-[#141226]">No Custom ICs packaged yet</div>
              <p className="text-xs text-[#5B587A] max-w-md mx-auto">
                Open any design in Circuit Studio and click "Package IC" to turn selected components into a reusable chip.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {customIcList.map((ic) => (
                <div
                  key={ic.id}
                  className="bg-white border border-[#E4DFF7] rounded-lg p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-[#141226] truncate">{ic.name}</div>
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EDE9FE] text-[#4A3BD6] shrink-0">
                        {ic.shortName}
                      </span>
                    </div>
                    <div className="text-xs text-[#5B587A] font-mono">
                      {ic.pins.length} pins · {ic.nodes.length} parts · {ic.wires.length} wires
                    </div>
                    {ic.description && (
                      <p className="text-xs text-[#4E4A6D] line-clamp-2 pt-1">{ic.description}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#F1EEFC]">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setWorkspace('circuit-studio')}
                    >
                      Use in Studio
                    </Button>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Export Custom IC JSON"
                        onClick={() => handleExportCustomIc(ic)}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Delete Custom IC"
                        onClick={() => void removeCustomICDefinition(ic.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Built-In Working Examples */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-semibold text-[#141226]">Built-In Reference Examples (12)</h3>
            <span className="text-xs text-[#5B587A]">Every example opens live in Circuit Studio</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BUILT_IN_EXAMPLES.map((ex) => (
              <div
                key={ex.id}
                className="bg-white border border-[#E4DFF7] rounded-lg p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-[#141226]">{ex.name}</div>
                  <div className="text-xs text-[#5B587A]">
                    {ex.category} · {ex.difficulty} · {ex.document.nodes.length} components
                  </div>
                  <p className="text-xs text-[#4E4A6D] leading-relaxed pt-1">{ex.description}</p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      loadCircuitDocument(ex.document, null);
                      setWorkspace('circuit-studio');
                    }}
                  >
                    Open in Studio
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
