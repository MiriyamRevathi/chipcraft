# ChipCraft — Virtual Chip Designer

**Design. Simulate. Analyze. Build Digital Circuits.**

ChipCraft is a browser-based digital electronics and computer architecture laboratory. It provides an interactive environment for designing logic circuits, packaging reusable custom ICs, simulating digital systems, exploring CPU architecture, analyzing signals, writing HDL, and learning digital hardware engineering.

Built with React, TypeScript, Vite, and a local Node.js backend, ChipCraft runs completely locally—no Gemini API, external AI endpoint, API key, cloud service, or database is required. Leftover template dependencies (`@google/genai` and `dotenv`) have been removed from `package.json`.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Workspaces](#workspaces)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Simulation Engine](#simulation-engine)
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

Users can construct circuits using visual components, connect logic gates, package subcircuits into reusable custom ICs, observe signal behavior, build an 8-bit CPU, explore memory systems, analyze waveforms, and experiment with a Verilog-subset HDL environment.

The application combines interactive circuit design with deterministic simulation engines and local project persistence.

### Core Principles

- **Local-first:** Processing, projects, and custom ICs remain on the user's machine.
- **Zero external AI or keys:** No Gemini API, external AI endpoint, or API credentials are required (`@google/genai` and `dotenv` removed from `package.json`).
- **No database:** Uses browser storage (IndexedDB with `localStorage` fallback) and local JSON files.
- **Deterministic simulation:** Identical inputs and initial states produce reproducible results.
- **Modular architecture:** Simulation engines and workspaces are independently organized and code-split for fast startup.
- **Educational and practical:** Designed for learning, experimentation, and digital engineering.

---

## Features

### Digital Circuit Design

- Interactive schematic editor.
- Component placement, duplication, copy/paste, and rotation.
- Wire connections and pin mapping.
- Circuit validation (pin direction, bit-width checks, and cycle detection).
- Live circuit simulation.
- Project saving, loading, and Save As functionality.
- Truth table analysis.

### Reusable Custom Subcircuit ICs

- Package an entire circuit or a selected region of gates into a reusable `CUSTOM_IC` component (`PackageCustomICModal` and `customIcEngine`).
- Auto-detection of external I/O pins and boundary-crossing wires when packaging a partial selection.
- Pin customization: rename pins, reorder pins, and assign placement sides (`left`, `right`, `top`, `bottom`).
- Multi-instance simulation with isolated internal sequential state per placed Custom IC instance.
- Nested Custom IC composition (supporting up to 12 nesting levels) with direct/indirect circular dependency detection at both validation time and simulation runtime (`CIRCULAR_SUBCIRCUIT`).
- JSON serialization/import for Custom ICs (including nested dependencies) and persistence to IndexedDB and `./data/custom-ics/`.

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
- Undo, redo, and component rotation.

### Project Library

- IndexedDB project persistence.
- Local JSON export and import.
- Local backend file persistence (`./data/projects/`).
- Project management.

### Additional Features

- Documentation workspace.
- Settings workspace.
- Accessible Command Palette (`combobox`/`listbox` ARIA + focus restoration).
- Keyboard navigation across tabs, modals, and canvas tools.
- Lazy-loaded workspace code splitting.
- Light lavender and white interface.

---

## Workspaces

ChipCraft includes 12 workspaces:

| Workspace       | Purpose                                     |
| --------------- | ------------------------------------------- |
| Home            | Dashboard and live Half Adder simulation    |
| Circuit Studio  | Visual circuit design and custom IC studio  |
| Logic Gate Lab  | Logic gate experiments                      |
| CPU Architect   | 8-bit CPU and assembler                     |
| Memory Lab      | Memory simulation                           |
| Signal Analyzer | Waveform analysis                           |
| HDL Studio      | HDL parsing and synthesis                   |
| Chip Explorer   | Chip and CMOS exploration                   |
| Challenge Lab   | Interactive vector-verified challenges      |
| Project Library | Project management                          |
| Documentation   | Learning and reference                      |
| Settings        | Application configuration                   |

---

## Technology Stack

| Technology   | Purpose                                                |
| ------------ | ------------------------------------------------------ |
| React 19     | User interface with lazy-loaded workspace chunks       |
| TypeScript   | Type safety                                            |
| Vite 8       | Development and build tooling                          |
| Tailwind CSS | Styling                                                |
| Zustand 5    | Application state management                           |
| Vitest 5     | Unit and integration testing                           |
| Node.js      | Local backend runtime                                  |
| Express 4    | Local REST API                                         |
| IndexedDB    | Browser-side project & custom IC persistence           |
| Web Workers  | Off-thread clock burst simulation                      |
| SVG / Canvas | Circuit and signal visualization                       |
| Playwright   | Browser E2E test suite (`e2e/chipcraft.spec.ts`)       |

---

## Architecture

ChipCraft follows a modular frontend and local-backend architecture.

```text
ChipCraft
│
├── Frontend (src/)
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   │
│   ├── components/
│   │   ├── AppShell.tsx
│   │   ├── CommandPalette.tsx
│   │   └── ErrorBoundary.tsx
│   │
│   ├── design-system/
│   │   └── ui.tsx
│   │
│   ├── features/
│   │   ├── home/
│   │   ├── circuit-studio/
│   │   ├── logic-lab/
│   │   ├── cpu-architect/
│   │   ├── memory-lab/
│   │   ├── signal-analyzer/
│   │   ├── hdl-studio/
│   │   ├── chip-explorer/
│   │   ├── challenge-lab/
│   │   ├── project-library/
│   │   ├── documentation/
│   │   └── settings/
│   │
│   ├── engine/
│   │   ├── signals/
│   │   ├── gates/
│   │   ├── validation/
│   │   ├── simulation/
│   │   ├── subcircuit/
│   │   ├── cpu/
│   │   ├── memory/
│   │   └── hdl/
│   │
│   ├── state/
│   ├── storage/
│   ├── templates/
│   ├── types/
│   ├── workers/
│   └── tests/
│       ├── engine.test.ts
│       ├── turn2.test.ts
│       ├── customIc.test.ts
│       ├── security.test.ts
│       └── comprehensive.test.ts
│
├── E2E & Accessibility Suite
│   ├── playwright.config.ts
│   └── e2e/
│       ├── chipcraft.spec.ts
│       └── accessibility.spec.ts
│
└── Local Backend
    ├── server.ts
    ├── Express REST API (/api)
    └── data/
        ├── projects/
        └── custom-ics/
```

---

## Simulation Engine

ChipCraft uses a deterministic digital logic simulation engine.

### Five-Valued Logic System

The simulation engine supports five signal states:

| Signal         | Meaning                             |
| -------------- | ----------------------------------- |
| HIGH           | Logic 1                             |
| LOW            | Logic 0                             |
| UNKNOWN        | Unknown or unresolved state         |
| HIGH_IMPEDANCE | High-impedance state                |
| ERROR          | Invalid or conflicting signal state |

### Engine Capabilities

- 43 catalog entries (42 built-in digital components plus `CUSTOM_IC` for user-packaged subcircuits).
- Pin direction and bus bit-width validation.
- Edge-triggered sequential states with isolated per-instance state for Custom ICs.
- Combinational cycle detection and circular subcircuit dependency detection.
- Deterministic signal propagation and multi-tick clock burst simulation.
- Exhaustive truth table generation for combinational circuits (including nested Custom ICs).

---

## Local Storage

ChipCraft does not require a traditional database or cloud account.

It uses two synchronized local persistence mechanisms:

**Browser storage**

- IndexedDB (`projects`, `custom_ics`, and `settings` stores, with `localStorage` fallback).
- Local project and custom IC retrieval.
- JSON import and export with prototype-key stripping and schema validation.

**Backend file storage**

- Express-based local REST API (`server.ts`).
- Local JSON files stored in `./data/projects/` and `./data/custom-ics/`.
- Confined path resolution, strict ID validation (`/^[a-zA-Z0-9_-]{1,80}$/`), 2 MB payload limit, circuit structure checks, and unsafe key stripping (`__proto__`, `constructor`, `prototype`).

### Backend Endpoints

| Method | Endpoint              | Purpose                        |
| ------ | --------------------- | ------------------------------ |
| GET    | `/api/health`         | Backend & local storage status |
| GET    | `/api/projects`       | List saved projects            |
| PUT    | `/api/projects/:id`   | Create or update a project     |
| DELETE | `/api/projects/:id`   | Delete a project               |
| DELETE | `/api/projects`       | Clear all saved projects       |
| GET    | `/api/custom-ics`     | List saved custom ICs          |
| PUT    | `/api/custom-ics/:id` | Create or update a custom IC   |
| DELETE | `/api/custom-ics/:id` | Delete a custom IC             |
| DELETE | `/api/custom-ics`     | Clear all saved custom ICs     |

---

## Installation

### Prerequisites

- Node.js (LTS recommended)
- npm
- A modern browser

### Install Dependencies

```bash
npm install
```

> **Note:** If `npm install` reports an optional peer dependency conflict between `vite` and `esbuild`, run:
>
> ```bash
> npm install --legacy-peer-deps
> ```

No `.env` file or API keys are needed.

### Available Scripts (`package.json`)

| Script              | Command                            | Purpose                                        |
| ------------------- | ---------------------------------- | ---------------------------------------------- |
| `npm run dev`       | `tsx server.ts`                    | Start Express API + Vite dev server on `:3000` |
| `npm run start`     | `NODE_ENV=production tsx server.ts` | Serve built `dist/` + Express API             |
| `npm run build`     | `vite build`                       | Build production frontend bundle into `dist/`  |
| `npm run preview`   | `vite preview`                     | Preview built frontend bundle                  |
| `npm run lint`      | `tsc --noEmit`                     | Run TypeScript type checking                   |
| `npm test`          | `vitest run`                       | Run unit and integration test suite            |
| `npm run test:e2e`  | `playwright test`                  | Run Playwright E2E & WCAG accessibility suite  |
| `npm run verify`    | `npm run lint && npm test && npm run build` | Run type check, Vitest, and production build |
| `npm run clean`     | `rm -rf dist server.js`            | Remove build artifacts                         |

### Custom Host / Port

`server.ts` defaults to `0.0.0.0:3000` and supports `--port`, `--host`, or `PORT`:

```bash
npx tsx server.ts --port 3010 --host 127.0.0.1
```

---

## Development

Recommended development workflow:

1. Start the local server with `npm run dev` (serves both the Vite frontend and Express `/api` endpoints).
2. Open `http://localhost:3000` (or your configured `--port`) in your browser.
3. Create a circuit in Circuit Studio.
4. Add components, connect pins, or package selections into reusable Custom ICs.
5. Run the simulation and truth table analyzer.
6. Inspect timing diagrams in Signal Analyzer.
7. Save and export projects in Project Library.

---

## Testing

ChipCraft uses Vitest for unit and integration tests and Playwright for browser end-to-end verification.

### Unit & Integration Tests (Vitest)

```bash
npm test
# or: npx vitest run
```

Test suites in `src/tests/`:

- `src/tests/engine.test.ts` (13 tests): Boolean gate truth tables, Half/Full Adder simulation, pin/bit-width validation, combinational loop detection, sequential D Flip-Flop & 4-Bit Counter, 4-Bit ALU, 8-Bit CPU & Assembler, Memory Engine, HDL parser/evaluator/synthesizer, Challenge verification, and JSON export/import.
- `src/tests/turn2.test.ts` (5 tests): Truth table analyzer, off-thread/synchronous clock burst simulation, and Express `/api/health` + `/api/projects` local file persistence.
- `src/tests/customIc.test.ts` (8 tests): Custom IC subcircuit extraction, boundary-crossing wire preservation, pin customization & layout recalculation, multi-instance combinational & sequential state isolation, nested Custom ICs, circular dependency detection (`detectCustomICCycle` & `CIRCULAR_SUBCIRCUIT`), JSON serialization/import, and `/api/custom-ics` security hardening & disk persistence.
- `src/tests/security.test.ts` (5 tests): JSON import array-root rejection, name-length limits, prototype-key sanitization, HTTP security headers (`X-Frame-Options`, `Cross-Origin-Resource-Policy`, `X-Content-Type-Options`), circuit payload validation, CPU assembler syntax & out-of-bounds PC checks, Memory Engine edge cases, and 2:1 Multiplexer truth table generation.
- `src/tests/comprehensive.test.ts` (10 tests): Five-valued signal model & bus driver contention resolution, `validateNewConnection` & `auditCircuitGraph`, `componentCatalog` pin rotation & configurable gate sizing, Bus Merger/Splitter, 2-to-4 Decoder, Half Subtractor, 4-bit Comparator, T Flip-Flop, Fibonacci CPU execution, and all built-in HDL presets.

### TypeScript Check & Production Build

```bash
npm run verify  # tsc --noEmit && vitest run && vite build
```

### Playwright End-to-End & WCAG Accessibility Tests

`e2e/chipcraft.spec.ts` and `e2e/accessibility.spec.ts` (`@axe-core/playwright`) launch ChipCraft on an isolated configurable port (`E2E_PORT`, defaulting to `3100`) and resolve either Playwright Chromium or a locally installed Chrome/Edge executable:

```bash
npm run test:e2e
```

### Latest Verified Status

- **Vitest:** 41/41 tests passing across 5 test files (`engine.test.ts`, `turn2.test.ts`, `customIc.test.ts`, `security.test.ts`, `comprehensive.test.ts`).
- **Playwright E2E & WCAG:** 11/11 tests passing (`e2e/chipcraft.spec.ts` and `e2e/accessibility.spec.ts` with 0 critical/serious WCAG 2.1 A/AA violations).
- **TypeScript (`npx tsc --noEmit`):** Passing with 0 errors.
- **Production Build (`npm run build`):** Passing with workspace code-splitting (`index` main chunk `340.65 kB` / `100.28 kB` gzip; 0 chunk warnings).
- **Dependencies:** `@google/genai` and `dotenv` removed from `package.json`; zero API keys or external services required.

---

## Keyboard Shortcuts

| Shortcut                       | Scope          | Action                               |
| ------------------------------ | -------------- | ------------------------------------ |
| `Ctrl + K` / `Cmd + K`         | Global         | Open Command Palette                 |
| `ArrowLeft` / `ArrowRight`     | Tab Lists      | Switch between tabs with focus       |
| `R`                            | Circuit Canvas | Rotate selected component(s)         |
| `Delete` / `Backspace`         | Circuit Canvas | Delete selected component(s) or wire |
| `Ctrl + Z` / `Cmd + Z`         | Circuit Canvas | Undo                                 |
| `Ctrl + Y` / `Ctrl + Shift + Z`| Circuit Canvas | Redo                                 |
| `Ctrl + C` / `Cmd + C`         | Circuit Canvas | Copy selection                       |
| `Ctrl + V` / `Cmd + V`         | Circuit Canvas | Paste selection                      |
| `Ctrl + D` / `Cmd + D`         | Circuit Canvas | Duplicate selection                  |
| `Escape`                       | Modals/Canvas  | Close dialog / cancel wire / deselect|

---

## Privacy and Security

ChipCraft is designed around local-first operation.

- No Gemini API or external AI endpoint is used.
- No cloud database is required.
- No external API keys or `.env` secrets are required.
- Project and Custom IC files are stored locally in IndexedDB and `./data/`.
- Simulation processing runs locally in the browser and Web Workers.
- Imported JSON files strip unsafe keys (`__proto__`, `constructor`, `prototype`), enforce object roots, and validate project/circuit structures.
- Express API enforces ID sanitization, confined filesystem paths, 2 MB JSON size limits, prototype-key stripping, and `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-origin`, `Permissions-Policy`, and `Cache-Control: no-store` headers.

The local backend should remain bound to localhost (`127.0.0.1`) unless deliberate network access is intended.

---

## Development Roadmap

### Completed and Verified

- [x] React 19 + TypeScript + Vite 8 foundation
- [x] Five-valued logic simulation engine
- [x] Circuit Studio
- [x] Logic Gate Lab
- [x] CPU Architect and assembler
- [x] Memory Lab
- [x] Signal Analyzer
- [x] HDL Studio
- [x] Chip Explorer
- [x] Challenge Lab
- [x] Project Library
- [x] Local Express backend (`/api/projects` & `/api/custom-ics`)
- [x] Web Worker simulation integration
- [x] Circuit Save As
- [x] Truth Table Analyzer
- [x] Light lavender and white theme
- [x] Reusable custom subcircuit IC packaging (`PackageCustomICModal` & `customIcEngine`)
- [x] Nested custom IC support (up to 12 levels)
- [x] Custom IC circular dependency validation & runtime guard
- [x] Removal of unused `@google/genai` and `dotenv` dependencies (100% key-free local operation)
- [x] Playwright browser E2E suite verified (`e2e/chipcraft.spec.ts`, 10/10 passing)
- [x] Keyboard navigation & WAI-ARIA accessibility improvements across workspaces
- [x] Automated `axe-core` WCAG 2.1 A/AA regression test (`e2e/accessibility.spec.ts`) & contrast fixes
- [x] Workspace lazy-loading bundle optimization (`React.lazy` + `Suspense`) & `CircuitCanvas` memoization
- [x] Security hardening for JSON imports and Express API headers/validation
- [x] Expanded unit test coverage (`41/41` Vitest tests across 5 files) & `CHANGELOG.md`

### Planned

- [ ] Enable GitHub Actions CI workflow (`.github/workflows/ci.yml` requires `workflow` token scope to push)
- [ ] Canvas virtualization profiling for very large schematics
- [ ] Automated semantic version tagging on release

---

## Project Goals

ChipCraft aims to provide a self-contained, reproducible digital hardware learning and experimentation platform.

Core goals include:

- Advanced digital circuit design.
- Reusable and composable custom hardware components.
- CPU architecture experimentation.
- Memory architecture simulation.
- HDL-based circuit development.
- Advanced waveform analysis.
- Educational challenges.
- Reproducible local simulation workflows.

---

**ChipCraft — Your Digital Hardware Laboratory.**

Design circuits. Understand logic. Simulate systems. Explore computing.
