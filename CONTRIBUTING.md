# Contributing

Thanks for contributing to CleanedIn.

## Development Workflow

1. Fork the repo and create a branch from `main` for ordinary maintenance.
   For modular-release issues #19 through #36, branch from
   `develop/modular-extension` and target that branch in your PR. Follow the
   [modular workflow](docs/modular-release.md#development-and-integration) and
   [module boundaries](docs/architecture.md#module-ownership-and-allowed-dependencies).
   Merge prerequisite issue PRs there before starting dependent work; reserve
   `main` for the final reviewed integration PR.
2. Install dependencies and run local checks.
3. Add or update tests for behavior changes.
4. Open a pull request with a clear summary and validation notes.

## Local Setup

For AI-assisted work, start with [AGENTS.md](AGENTS.md) and the
[AI development harness](docs/ai/README.md). Its shared validation commands also
work for human contributors and are used by CI.

```bash
npm ci
npm run ai:check
```

Run `npm run ai:check -- --full` for browser-level changes after installing
Chromium; see the harness guide for Linux Xvfb setup.
For manual browser validation, follow `docs/local-browser-testing.md`.

## Coding Guidelines

- Use TypeScript strict-mode compatible code.
- Keep modules focused and composable.
- Prefer structural selectors and avoid brittle DOM assumptions.
- Preserve existing naming and formatting conventions.

## Testing Expectations

Changes should include the most relevant test updates:

- Unit tests for pure logic changes
- Fixture tests for classifier/rule behavior
- E2E coverage for user-facing workflow changes

## Pull Request Checklist

- [ ] Change is scoped and documented
- [ ] Lint and typecheck pass
- [ ] Tests pass (or rationale provided)
- [ ] New behavior has regression coverage

## Reporting Bugs

Use the bug report issue template and include:

- Browser and version
- Repro steps
- Expected vs actual behavior
- Screenshots or DOM snippets when possible

## Feature Requests

Use the feature request template with problem statement, proposal, and tradeoffs.
