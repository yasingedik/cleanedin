# Task: #20 behavior fixtures and baseline

- Issue: https://github.com/yasingedik/cleanedin/issues/20
- Prerequisites: architecture PR #37 and harness PR #38 merged into the integration branch.
- Base: `develop/modular-extension` at `4dceea71bcc255aa98bbe84bcb06a224e1343a3d`.
- Working branch: `test/20-behavior-baseline`.
- Scope: characterize current behavior, add meaningful input/render/persistence
  coverage, and save repeatable performance scenarios before moving runtime code.
- No product semantics, module ownership or dependency changes are intended.

| Acceptance criterion | Implementation / check | Evidence |
| --- | --- | --- |
| CI executes unit, fixtures, security and installed Chromium | Shared full harness, expanded suites | Pending final CI |
| Actual rendering, input and persistence assertions | Fixture pipeline, badge safety and popup import/export E2E | Local fixtures/security pass; E2E requires final CI |
| No private fixture data | Authored synthetic HTML and reserved example domains | Manual review |
| Preserve behavior and document existing failures | Frozen expected outcomes and known-gap reproductions | Known gaps documented in baseline guide with #26/#29/#30 links |
| Repeatable performance measurements with environment | Component pipeline workload, counters and saved JSON | Three samples plus warmup saved with runtime/workload/lockfile hashes |

## Baseline

The clean base checkout passed `ai:context`, `ai:doctor`, and `ai:check` on
Node 24.19.0 / npm 11.9.0 / Linux x64: six harness, 89 unit, five fixture and
67 security tests, lint, typecheck and build. Chromium is not installed in the
local environment; installed-extension validation will use GitHub Actions.
The security command-selection gap was already fixed by #38.

## Steps

- [x] Verify merged prerequisites and run the actual current baseline.
- [x] Add category, decision, DOM and known-gap characterization fixtures.
- [x] Add render security and installed-extension input/persistence assertions.
- [x] Run and save deterministic workload measurements with environment details.
- [ ] Run final harness/CI, review diff and open PR to the integration branch.

## Handoff

Do not treat issue #19's stale open state as missing code: its PR is merged.
The expanded local quick profile passes: six harness tests, 89 unit tests,
64 fixture tests in three files, 70 security tests in four files, lint, types
and build. `test:baseline` also passes. CI will execute the four installed
Chromium tests and upload both validation/performance reports. Final commit and
CI links belong in the PR; do not claim local Chromium execution.

The [baseline guide](../../baselines/issue20/README.md) records the current
attribute/text observation gap, comment fact leakage and nested-media behavior.
Production code remains unchanged. The next action is to verify the PR's final
CI and accept it into `develop/modular-extension`; #21 is next after acceptance.
