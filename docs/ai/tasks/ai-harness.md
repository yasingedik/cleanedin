# Task: repository AI development harness

## Source and scope

- Requested by the maintainer after merging [PR #37](https://github.com/yasingedik/cleanedin/pull/37),
  before continuing the modular-release issue sequence.
- Base: `develop/modular-extension` at `f41fb1d85d0d009ef4ac31d8418d6cc5e4f37407`.
- Working branch: `chore/ai-development-harness`; PR target is the integration branch.
- Outcome: agents can discover the repo contract, plan one issue, execute common
  checks and hand off evidence without depending on earlier chat history.
- Scope excludes extension behavior changes, new architecture implementation,
  automatic AI execution and release automation.

## Acceptance evidence

| Requirement | Implementation | Validation |
| --- | --- | --- |
| Shared agent context and architecture constraints | Root AGENTS.md and thin Copilot instructions | Reviewed against merged architecture and release contract |
| Repeatable issue execution and handoff | AI guide, task template and PR template | This note exercises the task template structure |
| Discover environment and commands | `ai:context`, `ai:doctor` | Both executed successfully with Node 24.19.0 / npm 11.9.0 on Linux x64 |
| Reuse local and CI validation | `ai:check`, quick/docs/full profiles; CI full profile | Initial quick run passed lint, types, 89 unit, 5 fixture, 67 security tests and build |
| Honest machine-readable results | Persisted reports with revision, fingerprints, results and timing | Six harness tests pass, including child failure, missing/terminated commands, stale report replacement and source mutation |
| Preserve evidence in CI | Always-run JSON artifact upload | Verify full-profile run and uploaded artifact on this PR before accepting |

## Decisions and baseline

- Use built-in Node APIs; add no runtime or development dependencies.
- Keep policy in architecture/release docs; the harness links to those contracts.
- Invoke the active npm CLI with Node and argument arrays, without shell string
  construction. Expose only fixed profiles, not arbitrary commands from issues.
- Run the existing security suite now. #20 remains responsible for richer
  characterization, behavior/persistence assertions and performance measurements.
- Local Chromium installation timed out at the Playwright download host. This is
  an environment limitation, not a passing browser test. CI must provide the
  installed-extension evidence; do not weaken that gate.
- The harness's failure-path tests intentionally print failed nested runs. Their
  enclosing Node test results must pass; do not confuse this with extension failures.

## Handoff

- [x] Repository instructions, workflow and executable harness implemented.
- [x] Quick validation and six harness tests executed locally.
- Final source revision, full-profile results and artifact evidence belong in
  the associated PR and CI runs, avoiding self-referential commit IDs in this file.
- Next action: review and merge the harness PR into `develop/modular-extension`,
  then resume #20 after checking its current criteria and prerequisite evidence.
- GitHub is authoritative for acceptance and merge status.
