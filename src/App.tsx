import React, { Suspense, lazy } from 'react';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useChipCraftStore } from './state/useChipCraftStore';
import { HomeWorkspace } from './features/home/HomeWorkspace';

const CircuitStudio = lazy(() =>
  import('./features/circuit-studio/CircuitStudio').then((m) => ({ default: m.CircuitStudio }))
);
const LogicGateLab = lazy(() =>
  import('./features/logic-lab/LogicGateLab').then((m) => ({ default: m.LogicGateLab }))
);
const CPUArchitect = lazy(() =>
  import('./features/cpu-architect/CPUArchitect').then((m) => ({ default: m.CPUArchitect }))
);
const MemoryLab = lazy(() =>
  import('./features/memory-lab/MemoryLab').then((m) => ({ default: m.MemoryLab }))
);
const SignalAnalyzer = lazy(() =>
  import('./features/signal-analyzer/SignalAnalyzer').then((m) => ({ default: m.SignalAnalyzer }))
);
const HDLStudio = lazy(() =>
  import('./features/hdl-studio/HDLStudio').then((m) => ({ default: m.HDLStudio }))
);
const ChipExplorer = lazy(() =>
  import('./features/chip-explorer/ChipExplorer').then((m) => ({ default: m.ChipExplorer }))
);
const ChallengeLab = lazy(() =>
  import('./features/challenge-lab/ChallengeLab').then((m) => ({ default: m.ChallengeLab }))
);
const ProjectLibrary = lazy(() =>
  import('./features/project-library/ProjectLibrary').then((m) => ({ default: m.ProjectLibrary }))
);
const DocumentationWorkspace = lazy(() =>
  import('./features/documentation/DocumentationWorkspace').then((m) => ({
    default: m.DocumentationWorkspace,
  }))
);
const SettingsWorkspace = lazy(() =>
  import('./features/settings/SettingsWorkspace').then((m) => ({ default: m.SettingsWorkspace }))
);

function WorkspaceFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="h-full w-full flex items-center justify-center bg-[#F7F5FF] text-sm text-[#5B587A]"
    >
      Loading workspace...
    </div>
  );
}

export default function App() {
  const workspace = useChipCraftStore((s) => s.workspace);
  const setWorkspace = useChipCraftStore((s) => s.setWorkspace);

  const renderWorkspace = () => {
    switch (workspace) {
      case 'home':
        return <HomeWorkspace />;
      case 'circuit-studio':
        return <CircuitStudio />;
      case 'logic-lab':
        return <LogicGateLab />;
      case 'cpu-architect':
        return <CPUArchitect />;
      case 'memory-lab':
        return <MemoryLab />;
      case 'signal-analyzer':
        return <SignalAnalyzer />;
      case 'hdl-studio':
        return <HDLStudio />;
      case 'chip-explorer':
        return <ChipExplorer />;
      case 'challenge-lab':
        return <ChallengeLab />;
      case 'project-library':
        return <ProjectLibrary />;
      case 'documentation':
        return <DocumentationWorkspace />;
      case 'settings':
        return <SettingsWorkspace />;
      default:
        return <HomeWorkspace />;
    }
  };

  return (
    <AppShell>
      <ErrorBoundary key={workspace} onReset={() => setWorkspace('home')}>
        <Suspense fallback={<WorkspaceFallback />}>{renderWorkspace()}</Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}
