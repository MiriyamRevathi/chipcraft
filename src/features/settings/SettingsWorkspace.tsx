import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useChipCraftStore } from '../../state/useChipCraftStore';
import { Button, SegmentedTabs } from '../../design-system/ui';

export function SettingsWorkspace() {
  const settings = useChipCraftStore((s) => s.settings);
  const updateSettings = useChipCraftStore((s) => s.updateSettings);
  const projects = useChipCraftStore((s) => s.projects);
  const customIcCount = useChipCraftStore((s) => Object.keys(s.customIcs).length);
  const completedChallenges = useChipCraftStore((s) => s.completedChallenges);
  const localDiskBackendAvailable = useChipCraftStore((s) => s.localDiskBackendAvailable);
  const resetAllLocalData = useChipCraftStore((s) => s.resetAllLocalData);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="h-full overflow-y-auto bg-[#F7F5FF]">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-[#141226]">Workspace Preferences</h2>
          <p className="text-sm text-[#5B587A] mt-0.5">
            Settings are stored locally on your machine with zero cloud sync, API keys, or external accounts.
          </p>
        </div>

        <div className="bg-white border border-[#E4DFF7] rounded-lg divide-y divide-[#E4DFF7]">
          {/* Snap to Grid */}
          <div className="p-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-[#141226]">Snap Components to Grid</div>
              <div className="text-xs text-[#5B587A]">Aligns dragged components to neat engineering coordinates.</div>
            </div>
            <input
              type="checkbox"
              checked={settings.snapToGrid}
              onChange={(e) => updateSettings({ snapToGrid: e.target.checked })}
              aria-label="Snap components to grid"
              className="w-4 h-4 accent-[#5B4CE6] cursor-pointer"
            />
          </div>

          {/* Show Grid */}
          <div className="p-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-[#141226]">Show Schematic Dot Grid</div>
              <div className="text-xs text-[#5B587A]">Display alignment dots across the Circuit Studio canvas.</div>
            </div>
            <input
              type="checkbox"
              checked={settings.showGrid}
              onChange={(e) => updateSettings({ showGrid: e.target.checked })}
              aria-label="Show schematic dot grid"
              className="w-4 h-4 accent-[#5B4CE6] cursor-pointer"
            />
          </div>

          {/* Show Pin Labels */}
          <div className="p-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-[#141226]">Show IC Pin Labels</div>
              <div className="text-xs text-[#5B587A]">Render pin names (CLK, RST, SUM, COUT) on arithmetic and sequential blocks.</div>
            </div>
            <input
              type="checkbox"
              checked={settings.showPinLabels}
              onChange={(e) => updateSettings({ showPinLabels: e.target.checked })}
              aria-label="Show IC pin labels"
              className="w-4 h-4 accent-[#5B4CE6] cursor-pointer"
            />
          </div>

          {/* Wire Routing Style */}
          <div className="p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-[#141226]">Wire Routing Geometry</div>
              <div className="text-xs text-[#5B587A]">Choose 90° orthogonal PCB traces or smooth cubic Bezier curves.</div>
            </div>
            <SegmentedTabs
              ariaLabel="Wire routing geometry"
              value={settings.wireStyle}
              onChange={(wireStyle) => updateSettings({ wireStyle })}
              options={[
                { value: 'orthogonal', label: 'Orthogonal (90°)' },
                { value: 'bezier', label: 'Smooth Bezier' },
              ]}
            />
          </div>

          {/* Default Clock Frequency */}
          <div className="p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-[#141226]">Default Clock Frequency</div>
              <div className="text-xs text-[#5B587A]">Clock oscillator rate for sequential Circuit Studio designs.</div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0.5}
                max={10}
                step={0.5}
                value={settings.defaultClockHz}
                onChange={(e) => updateSettings({ defaultClockHz: Number(e.target.value) })}
                aria-label="Default clock frequency in Hertz"
                aria-valuetext={`${settings.defaultClockHz.toFixed(1)} Hz`}
                className="w-32 accent-[#5B4CE6]"
              />
              <span className="font-mono text-xs font-semibold text-[#141226] tabular-nums w-14 text-right">
                {settings.defaultClockHz.toFixed(1)} Hz
              </span>
            </div>
          </div>
        </div>

        {/* Local Storage Summary & Reset */}
        <div className="bg-white border border-[#E4DFF7] rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-[#141226]">
                {localDiskBackendAvailable
                  ? 'Local Storage (IndexedDB + Local Disk ./data/projects)'
                  : 'Local Browser Storage (IndexedDB)'}
              </h3>
              <p className="text-xs text-[#5B587A] mt-0.5 font-mono tabular-nums">
                {projects.length} saved project{projects.length === 1 ? '' : 's'} · {customIcCount}{' '}
                custom IC{customIcCount === 1 ? '' : 's'} · {completedChallenges.length} completed
                challenge{completedChallenges.length === 1 ? '' : 's'} ·{' '}
                {localDiskBackendAvailable ? 'Local Express file API active' : 'Browser-only mode'}
              </p>
            </div>
            {!confirmClear ? (
              <Button variant="secondary" size="sm" onClick={() => setConfirmClear(true)}>
                <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                Clear Local Data
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    void resetAllLocalData();
                    setConfirmClear(false);
                  }}
                >
                  Confirm Delete All
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
