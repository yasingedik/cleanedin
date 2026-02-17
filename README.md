# CleanedIn

CleanedIn is a Manifest V3 extension that filters LinkedIn feed noise with compact, rule-based controls.

## What It Does

- Category filters with per-category `Show/Hide` switches:
  - ads/promoted, suggested, recommended-for-you
  - reactions (`liked`, `loved`, `supported`, `celebrated`, `funny`, `insightful`)
  - commented, followed/following, reposted/shared
  - media (`video`, `poll`, `image`, `link`, `carousel`)
- Identity filters:
  - connection levels (`following`, `1st`, `2nd`, `3rd+`)
  - profile types (`individual`, `group`, `company`, `other`)
  - explicit hidden-name list
- Value filters with `Off/Hide` controls:
  - include keywords
  - exclude keywords
  - age limit in days
- Hidden badges with context:
  - matched keyword/name
  - matched connection/profile type
  - category + actor context for reaction/repost-style posts
- Popup sections are collapsible, compact, and remember open/closed state.

## Scope

- Browsers: Chrome + Edge (MV3)
- Target surface: LinkedIn feed routes only
- Not affiliated with LinkedIn Corporation

## Local Setup

### Prerequisites

- Node.js `>=18` (Node 22 used in CI)
- npm

### Install

```bash
npm ci
```

### Build

```bash
npm run build
```

### Load Unpacked

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer Mode.
3. Click **Load unpacked**.
4. Select `dist/`.

Detailed guide: `docs/local-browser-testing.md`.

## Quality Checks

```bash
npm run lint
npm run typecheck
npm run test
npm run test:fixtures
npm run build
npm run test:e2e
```

## Store Packages (Chrome + Edge)

- Workflow: `.github/workflows/store-packages.yml`
- Trigger:
  - manual (`workflow_dispatch`)
  - or push a version tag (`v*`)
- Output artifacts:
  - `cleanedin-chrome-vX.Y.Z.zip`
  - `cleanedin-edge-vX.Y.Z.zip`

Release steps are documented in `docs/release-checklist.md`.

## Privacy Policy

- Privacy policy page: `docs/privacy-policy.html`
- Recommended hosted URL (GitHub Pages): `https://<github-username>.github.io/<repo-name>/privacy-policy.html`
- This extension does not collect or transmit browsing data to developer servers.
- To host from GitHub:
  1. Open repository **Settings** -> **Pages**.
  2. Under **Build and deployment**, choose **Deploy from a branch**.
  3. Select branch `main` and folder `/docs`, then **Save**.

## Repository Layout

- `src/background/`: service worker
- `src/content/`: root detection, extraction, classifier, decision engine, rendering
- `src/popup/`: popup UI + settings persistence
- `src/shared/`: schema, migrations, storage wrappers, shared types
- `tests/`: unit, fixtures, e2e, and security tests
- `docs/`: operational documentation

## Roadmap

See `ROADMAP.md` (includes mobile companion app exploration).

## Contributing and Support

- Contributing: `CONTRIBUTING.md`
- Security: `SECURITY.md`
- Support: `SUPPORT.md`
- Code of Conduct: `CODE_OF_CONDUCT.md`

## License

GPL-3.0-or-later. See `LICENSE`.
