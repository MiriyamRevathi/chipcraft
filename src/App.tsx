import React from 'react';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useChipCraftStore } from './state/useChipCraftStore';
import { HomeWorkspace } from './features/home/HomeWorkspace';
import { CircuitStudio } from './features/circuit-studio/CircuitStudio';
import { LogicGateLab } from './features/logic-lab/LogicGateLab';
import { CPUArchitect } from './features/cpu-architect/CPUArchitect';
import { MemoryLab } from './features/memory-lab/MemoryLab';
import { SignalAnalyzer } from './features/signal-analyzer/SignalAnalyzer';
import { HDLStudio } from './features/hdl-studio/HDLStudio';
import { ChipExplorer } from './features/chip-explorer/ChipExplorer';
import { ChallengeLab } from './features/challenge-lab/ChallengeLab';
import { ProjectLibrary } from './features/project-library/ProjectLibrary';
import { DocumentationWorkspace } from './features/documentation/DocumentationWorkspace';
import { SettingsWorkspace } from './features/settings/SettingsWorkspace';

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
        {renderWorkspace()}
      </ErrorBoundary>
    </AppShell>
  );
}
