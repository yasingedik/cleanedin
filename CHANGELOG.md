# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- Initial MV3 extension scaffold
- Feed observation, extraction, classifier, decision, and rendering pipeline
- Popup settings UI with local/sync storage support
- Unit and fixture tests
- Extension-loaded Playwright E2E harness with deterministic local fixtures
- Donation support section in popup with configurable providers
- GitHub funding metadata (`.github/FUNDING.yml`)

### Changed

- Migrated linting to ESLint flat config
- Moved manifest copying into Vite build plugin for build/watch determinism
- Updated CI to run deterministic install, build, and Chromium Playwright e2e lane

### Fixed

- Feed observer now attaches when root mounts late and reattaches after root detach
- Removed fragile text-only ad/engagement classification fallbacks (precision-first)
- Reduced image false positives from zero-dimension/weak image signals
- Improved age parsing for ISO timestamps and aggregated relative time tokens
- Isolated temporary reveal/badge rendering to root-scoped state
