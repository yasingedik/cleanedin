# Contributing

Thanks for contributing to CleanedIn.

## Development Workflow

1. Fork the repo and create a branch from `main`.
2. Install dependencies and run local checks.
3. Add or update tests for behavior changes.
4. Open a pull request with a clear summary and validation notes.

## Local Setup

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run test:fixtures
npm run build
```

Run `npm run test:e2e` for browser-level changes.
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
