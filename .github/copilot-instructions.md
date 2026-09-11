# CleanedIn repository instructions

Read and follow [AGENTS.md](../AGENTS.md) before making changes. It is the shared
source for the code map, behavior constraints, validation and handoff workflow.
Read [the architecture](../docs/architecture.md) and
[release contract](../docs/modular-release.md) for modular-release tasks.

Modular work branches from and targets `develop/modular-extension`. Verify the
current issue's prerequisites are merged. Work on the requested scope and keep
acceptance evidence in the PR; do not merge or publish without authorization.

Use Node 24 and `npm ci`. Run `npm run ai:context`, `npm run ai:doctor`, then
`npm run ai:check` for implementation changes. Use `npm run ai:check -- --full`
with installed Chromium and a display for browser validation; Linux CI uses Xvfb.
The shared [AI workflow](../docs/ai/README.md) explains profiles and reports.
Do not claim a browser/device check passed if it was not actually run.
