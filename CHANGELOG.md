# Changelog

All notable changes to ChipCraft are documented in this file.

## Unreleased

### Added
- Comprehensive unit test coverage across signal modeling, connection validation, component catalog sizing/rotation, arithmetic/sequential simulation blocks, CPU presets, assembler diagnostics, and HDL presets (`src/tests/comprehensive.test.ts`).
- Security hardening tests and engine edge-case coverage (`src/tests/security.test.ts`).
- Isolated Playwright E2E configuration with configurable `E2E_PORT` and local Chrome/Edge executable resolution (`playwright.config.ts`).
- `npm run verify` script in `package.json` running type checking, Vitest, and production build.

### Changed
- **Performance:** Lazy-loaded workspace routes via `React.lazy` and `Suspense` in `src/App.tsx`, and memoized wire geometries, lookup maps, and pin callbacks in `CircuitCanvas.tsx`.
- **Accessibility:** Added WAI-ARIA `combobox`/`listbox` semantics and focus restoration in `CommandPalette`, roving focus and arrow-key navigation in `SegmentedTabs`, dialog roles on the mobile navigation drawer, `aria-label`/`aria-expanded` attributes across `CircuitStudio` toolbar controls, and accessible labels/valuetext in `SettingsWorkspace`.
- **Security:** Added prototype-key stripping, array-root rejection, and field bounds validation on JSON project imports (`src/storage/projectStorage.ts`), plus `X-Frame-Options: DENY`, `Cross-Origin-Resource-Policy: same-origin`, and circuit payload validation in `server.ts`.
- **Key-Free Local Execution:** Removed unused `@google/genai` and `dotenv` dependencies from `package.json`.
