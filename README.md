# ChipCraft — Virtual Chip Designer

**Design. Simulate. Analyze. Build Digital Circuits.**

ChipCraft is a browser-based digital electronics and computer architecture laboratory. It provides an interactive environment for designing logic circuits, simulating digital systems, exploring CPU architecture, analyzing signals, writing HDL, and learning digital hardware engineering.

Built with React 19, TypeScript, Vite, and a local Node.js backend, ChipCraft runs locally without external AI services, API keys, cloud services, or a traditional database.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Workspaces](#workspaces)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Simulation Engine](#simulation-engine)
- [Custom IC System](#custom-ic-system)
- [Local Storage](#local-storage)
- [Installation](#installation)
- [Development](#development)
- [Testing](#testing)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Privacy and Security](#privacy-and-security)
- [Development Roadmap](#development-roadmap)
- [Project Goals](#project-goals)

---

## Overview

ChipCraft transforms a web browser into a digital electronics engineering laboratory.

Users can construct circuits using visual components, connect logic gates, observe signal behavior, build an 8-bit CPU, explore memory systems, analyze waveforms, and experiment with a Verilog-subset HDL environment.

The application combines interactive circuit design with deterministic simulation engines and local project persistence.

### Core Principles

- **Local-first:** Processing and project data remain on the user's machine.
- **No API keys:** No external AI or API credentials are required.
- **No database:** Uses IndexedDB and local JSON file storage.
- **Deterministic simulation:** Identical inputs and initial states produce reproducible results.
- **Modular architecture:** Simulation engines and workspaces are independently organized.
- **Privacy-focused:** No required cloud accounts or external AI services.
- **Educational and practical:** Designed for learning, experimentation, and digital engineering.

---

## Features

### Digital Circuit Design

- Interactive schematic editor.
- Component placement and rotation.
- Wire connections and pin mapping.
- Circuit validation.
- Live circuit simulation.
- Project saving and loading.
- Save As functionality.
- Truth Table Analyzer.

### Logic Gate Laboratory

- Digital logic gate exploration.
- Combinational logic experiments.
- Sequential logic experiments.
- Signal behavior visualization.

### CPU Architect

- 8-bit CPU architecture environment.
- Instruction assembler.
- CPU execution simulation.
- Register and execution-state inspection.

### Memory Laboratory

- Memory read and write operations.
- Memory visualization.
- Address-based data inspection.

### Signal Analyzer

- Digital waveform visualization.
- Multi-tick simulation capture.
- Off-thread simulation using Web Workers.
- Deterministic synchronous fallback.

### HDL Studio

- Verilog-subset parser.
- Combinational logic evaluation.
- Truth table generation.
- HDL-to-circuit synthesis for supported constructs.

### Chip Explorer

- Digital hardware exploration.
- CMOS sandbox.
- Interactive component demonstrations.

### Challenge Lab

- Interactive circuit-building challenges.
- Automated vector-based verification.
- Challenge editing history.
- Undo and redo.
- Component rotation.

### Project Library

- IndexedDB project persistence.
- Local JSON export and import.
- Local backend file persistence.
- Project management.

### Custom IC Testing

- Custom IC-related automated test coverage.
- Custom IC functionality is developed and validated through the dedicated custom IC test suite.

### Additional Features

- Documentation workspace.
- Settings workspace.
- Command palette.
- Keyboard navigation.
- Light lavender and white interface.

---

## Workspaces

| Workspace       | Purpose                       |
| --------------- | ----------------------------- |
| Home            | Dashboard and live simulation |
| Circuit Studio  | Visual circuit design         |
| Logic Gate Lab  | Logic gate experiments        |
| CPU Architect   | 8-bit CPU and assembler       |
| Memory Lab      | Memory simulation             |
| Signal Analyzer | Waveform analysis             |
| HDL Studio      | HDL parsing and synthesis     |
| Chip Explorer   | Chip and CMOS exploration     |
| Challenge Lab   | Interactive challenges        |
| Project Library | Project management            |
| Documentation   | Learning and reference        |
| Settings        | Application configuration     |

---

## Technology Stack

| Technology   | Purpose                          |
| ------------ | -------------------------------- |
| React 19     | User interface                   |
| TypeScript   | Type safety                      |
| Vite         | Development and build tooling    |
| Tailwind CSS | Styling                          |
| Zustand      | Application state management     |
| Vitest       | Unit and integration testing     |
| Node.js      | Local backend runtime            |
| Express      | Local REST API                   |
| IndexedDB    | Browser-side project persistence |
| Web Workers  | Off-thread simulation            |
| SVG / Canvas | Circuit and signal visualization |
| Playwright   | Planned browser E2E testing      |

---

## Architecture

ChipCraft follows a modular frontend and local-backend architecture.

```text
ChipCraft
│
├── Frontend
│   ├── React 19
│   ├── TypeScript
│   ├── Vite
│   ├── Tailwind CSS
│   ├── Zustand
│   │
│   ├── src/features/
│   │   ├── Home/
│   │   ├── CircuitStudio/
│   │   ├── LogicGateLab/
│   │   ├── CPUArchitect/
│   │   ├── MemoryLab/
│   │   ├── SignalAnalyzer/
│   │   ├── HDLStudio/
│   │   ├── ChipExplorer/
│   │   ├── ChallengeLab/
│   │   ├── ProjectLibrary/
│   │   ├── Documentation/
│   │   └── Settings/
│   │
│   ├── src/engine/
│   │   ├── signals/
│   │   ├── gates/
│   │   ├── validation/
│   │   ├── simulation/
│   │   ├── cpu/
│   │   ├── memory/
│   │   └── hdl/
│   │
│   ├── src/storage/
│   ├── src/workers/
│   ├── src/templates/
│   └── src/tests/
│
└── Local Backend
    ├── server.ts
    ├── Express REST API
    └── data/
        └── projects/
```

*This is a logical architecture overview. Consult the actual source tree for exact filenames and directory names.*

---

## Simulation Engine

ChipCraft uses a deterministic digital logic simulation engine.

### Five-Valued Logic System

| Signal         | Meaning                             |
| -------------- | ----------------------------------- |
| HIGH           | Logic 1                             |
| LOW            | Logic 0                             |
| UNKNOWN        | Unknown or unresolved state         |
| HIGH_IMPEDANCE | High-impedance state                |
| ERROR          | Invalid or conflicting signal state |

### Engine Capabilities

- 41 digital components.
- Pin and bus validation.
- Edge-triggered sequential states.
- Combinational cycle detection.
- Deterministic signal propagation.
- Circuit validation.
- Multi-tick simulation.
- Truth table generation.

---

## Custom IC System

ChipCraft includes a dedicated custom IC development and testing area.

The custom IC test suite is located at:

```text
src/tests/customIc.test.ts
```

Custom IC functionality should be documented according to the actual implemented capabilities. Features such as nested ICs, dependency validation, independent instance state, and reusable packaging should only be described as supported after their implementation and tests are verified.

---

## Local Storage

ChipCraft does not require a traditional database.

It uses two local persistence mechanisms.

### Browser Storage

- IndexedDB for project persistence.
- Local project retrieval.
- JSON import and export.

### Backend File Storage

- Express-based local REST API.
- JSON project files.
- Project creation, reading, updating, and deletion.
- Sanitized project file handling.

### Backend Endpoints

| Method | Endpoint            | Purpose              |
| ------ | ------------------- | -------------------- |
| GET    | `/api/health`       | Backend health check |
| GET    | `/api/projects`     | List projects        |
| POST   | `/api/projects`     | Create a project     |
| GET    | `/api/projects/:id` | Retrieve a project   |
| PUT    | `/api/projects/:id` | Update a project     |
| DELETE | `/api/projects/:id` | Delete a project     |

---

## Installation

### Prerequisites

- Node.js (LTS recommended)
- npm
- A modern browser
- Git (optional)

### Clone the Repository

```bash
git clone <your-repository-url>
cd chipcraft
```

### Install Dependencies

```bash
npm install
```

### Start Development

```bash
npm run dev
```

Use the scripts configured in `package.json` to start the frontend and backend. If they run separately, start both processes as configured by the project.

### Start Local Backend

The backend can be started using:

```bash
npx tsx server.ts --port 3010 --host 127.0.0.1
```

The exact port and startup arguments depend on the current server configuration.

### Production Build

```bash
npm run build
```

### TypeScript Validation

```bash
npx tsc --noEmit
```

---

## Development

Recommended development workflow:

1. Start the frontend and local backend.
2. Open the application in your browser.
3. Create a circuit in Circuit Studio.
4. Add components and connect pins.
5. Run the simulation.
6. Inspect results in Signal Analyzer.
7. Save the project in Project Library.
8. Run automated tests after making changes.

---

## Testing

ChipCraft uses Vitest for automated unit and integration testing.

### Run All Tests

```bash
npx vitest run
```

### Run Tests in Watch Mode

```bash
npx vitest
```

### Run Production Build

```bash
npm run build
```

### Run TypeScript Validation

```bash
npx tsc --noEmit
```

### Verified Test Suites

| Test File          | Purpose                                   |
| ------------------ | ----------------------------------------- |
| `engine.test.ts`   | Core simulation engine                    |
| `turn2.test.ts`    | Integration and application functionality |
| `customIc.test.ts` | Custom IC functionality                   |

### Latest Reported Verification

\<badge color="success">26/26 tests passed\</badge>

- 3 test files passed.
- 26 individual tests passed.
- TypeScript validation completed without errors.
- Gemini-related template dependencies removed.
- `@google/genai` removed from `package.json`.
- `dotenv` removed from `package.json`.

These results reflect the latest reported development checkpoint. Run the commands above to verify the current source before release.

---

## Keyboard Shortcuts

| Shortcut | Action               |
| -------- | -------------------- |
| Ctrl + K | Open Command Palette |

Additional shortcuts may be introduced in future releases.

---

## Privacy and Security

ChipCraft is designed around local-first operation

- No external AI endpoints are required.
- No cloud database is required.
- No external API keys are required.
- Project files can be stored locally.
- Simulation processing is performed locally.
- Browser storage uses IndexedDB.
- Backend project persistence uses local JSON files.

The local backend should remain bound to localhost unless deliberate network access is configured.

File paths, project identifiers, request sizes, and imported project content should be validated to prevent unsafe file operations and malformed data.

---

## Development Roadmap

### Completed and Reported

- [x] React 19 + TypeScript + Vite foundation
- [x] Five-valued digital logic engine
- [x] 41 digital components
- [x] Circuit Studio
- [x] Logic Gate Lab
- [x] CPU Architect and assembler
- [x] Memory Lab
- [x] Signal Analyzer
- [x] HDL Studio
- [x] Chip Explorer
- [x] Challenge Lab
- [x] Project Library
- [x] Local Express backend
- [x] Local JSON project storage
- [x] IndexedDB persistence
- [x] Web Worker simulation integration
- [x] Circuit Save As
- [x] Truth Table Analyzer
- [x] Challenge undo and redo
- [x] Light lavender and white theme
- [x] Custom IC test suite
- [x] Removal of unused Gemini template dependencies

### Remaining and Planned

- [ ] Comprehensive custom IC feature verification
- [ ] Advanced nested custom IC support, if not already implemented
- [ ] Playwright browser E2E suite
- [ ] Comprehensive accessibility testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Production release preparation

---

## Project Goals

ChipCraft aims to become a comprehensive digital hardware learning and experimentation platform.

Long-term goals include:

- Advanced digital circuit design.
- Reusable custom hardware components.
- CPU architecture experimentation.
- Memory architecture simulation.
- HDL-based circuit development.
- Advanced waveform analysis.
- Educational challenges.
- Reproducible simulation workflows.
- Local-first digital engineering tools.

---

## License

Choose and add an appropriate open-source license before publishing this project publicly.

---

**ChipCraft — Your Digital Hardware Laboratory.**

Design circuits. Understand logic. Simulate systems. Explore computing.
