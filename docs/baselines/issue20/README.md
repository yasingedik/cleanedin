# Behavior and performance baseline for #20

This baseline supports the modular refactor in [issue #20](https://github.com/yasingedik/cleanedin/issues/20).
It characterizes extension 0.1.11, settings schema 6, at the integration branch
revision `4dceea71bcc255aa98bbe84bcb06a224e1343a3d`. This change adds tests and
measurement tooling; it does not change `src/`, the manifest or dependencies.

## Verified starting point

The clean checkout passed `npm run ai:context`, `npm run ai:doctor` and
`npm run ai:check`. [baseline-quick.json](baseline-quick.json) records the exact
clean revision, source fingerprint, commands, durations and environment:
Node 24.19.0, npm 11.9.0, Linux x64. Discovery/execution showed six harness
tests, 89 unit tests in nine files, five fixture tests in one file and 67 security
tests in three files. Lint, typecheck and the production build also passed.

The [integration baseline CI run](https://github.com/yasingedik/cleanedin/actions/runs/34620540021)
passed on that same source revision. Installed Chromium extension coverage uses
synthetic local pages and a temporary test copy of the extension with expanded
test host matches. It does not prove live LinkedIn or Firefox/Safari compatibility.
Local Chromium was unavailable, so installed-extension evidence is provided by
CI rather than claimed as a local result.

## Coverage added

| Area | Evidence |
| --- | --- |
| All 17 categories and ordered multiple labels | `tests/fixtures/baseline/categories.html` and `behavior-baseline.test.ts` |
| False positives | Promotion announcement, avatar-only image, internal link, following-up prose and plain unknown fixtures |
| Defaults and category precedence | Only ads hidden by default; Show does not override another Hide; registry tie order and primary reason sequence |
| Value filters | Include any-match, exclude substrings, literal regex-like text, case/whitespace normalization, empty/off lists, actor and mentioned names, whole-name boundaries, body cutoff |
| Relationships and age | All four connection levels, all four profile types, missing age, equality, exceeding limit and fixed-clock absolute timestamps |
| Rendering and reveal | Outer card hiding, badge content/count, disabled cleanup, reveal across reevaluation/replacement and explicit reset |
| DOM and identity | Separate render/feature roots, comments inside/outside extraction scope, quoted nested posts, missing fields, deterministic fallback identities |
| Mutation limitation | `observer-baseline.test.ts` reproduces stale state after attribute/text changes and recovery after element insertion |
| Security output | `tests/security/render-output.test.ts` checks the actual badge DOM and reveal action using literal HTML/script-like keywords |
| Real input and persistence | `tests/e2e/settings-baseline.spec.ts` edits a textarea, checks durable storage and feed visibility, reopens controls, reads a downloaded export, imports mixed data, checks literal badge rendering and verifies failed JSON imports preserve settings |

All new HTML is authored synthetic data composed from known selector shapes.
Fixture actors, content, numeric post IDs and profile paths are fictional. Asset
URLs use reserved example domains. No private profiles, captures, tokens or
account data are included. These fixtures establish repeatable cases, not proof
of coverage of every current LinkedIn variant.

Run these with `npm run test:fixtures`, `npm run test:security` and the installed
extension `npm run test:e2e` suite after building. The existing unit tests remain
part of the shared harness. The PR's final CI run is the authority for final test
counts and the tested commit.

## Known gaps recorded, not silently repaired

| Reproduction | Current result | Follow-up |
| --- | --- | --- |
| Change only a post attribute or existing text node | Observer does not reevaluate it; adding an element later triggers reevaluation | [#29](https://github.com/yasingedik/cleanedin/issues/29) |
| Place comments inside the selected feature root | Actor names skip comment authors, but comment text/media, timestamp and profile link can affect other extracted facts and decisions | [#26](https://github.com/yasingedik/cleanedin/issues/26), with uncertainty policy in [#30](https://github.com/yasingedik/cleanedin/issues/30) |
| Embed a quoted post containing video | Parent extraction includes quoted text and classification includes video | [#26](https://github.com/yasingedik/cleanedin/issues/26) |

These tests intentionally pass on the current limitation. The owning issue must
change the expectation with a documented fix and regression evidence; passing
these tests is not a claim that the limitations are correct product behavior.
No pre-existing test failure was observed in the baseline suites.

## Repeatable performance workload

Run `npm run test:baseline`. It uses one Vitest worker, the real discovery,
extraction, classification, decision, rendering and observer components, and a
synthetic fixture generator. It saves `.ai/reports/performance.json`; the full
AI harness runs it in CI and uploads the JSON alongside the validation report.
Keep [performance.json](performance.json) as the original reference, not an
automatically overwritten result of subsequent refactors.

| Scenario | Fixed workload | Expected work and final state |
| --- | --- | --- |
| Growing feed | Append to 25, then 50, then 100 posts; every other post is an ad | 25, 25, then 50 new evaluations; 13, 25, then 50 hidden posts/badges |
| Settings changes | Four disable/enable passes over 100 posts | 400 evaluations; every disabled pass reveals all posts; final 50 hidden posts/badges |
| Repeated mutations | Add 100 elements across ten of 100 posts in one burst | One observer callback, ten evaluations, 50 hidden posts/badges |

One identical warmup precedes three measured repetitions. The report includes
every raw timing and min/median/max, deterministic work counters, Node/OS/CPU and
Vitest/jsdom versions, source HEAD/dirty state, and fingerprints of runtime,
lockfile and workload source. The runtime fingerprint identifies the unchanged
production code even though the new benchmark was first run with uncommitted
test files. The workload fingerprint identifies those test definitions.

The saved local run measured these medians. These are jsdom workload timings,
not estimates of how long a user waits in Chrome.

| Scenario | Median wall time |
| --- | --- |
| Grow from 0 to 25 posts | 72.834 ms |
| Grow from 25 to 50 posts | 92.049 ms |
| Grow from 50 to 100 posts | 205.856 ms |
| Four settings passes over 100 posts | 1,111.713 ms |
| Burst of 100 element additions across ten posts | 128.751 ms |

Timings use a real monotonic clock, while debounce timers advance virtually.
They include scenario setup, discovery, component work and assertion overhead.
They exclude browser layout/paint, actual 80ms debounce waiting, extension APIs,
the full content controller and startup. Settings passes deliberately perform
full extraction again, matching today's reevaluation work; they do not assume
the future fact cache already exists. Growing-feed timings are incremental,
not cumulative. Observer startup is settled before timing the mutation burst.

Compare timings only on comparable machines with the same workload and dependency
versions. Inspect counters and outcome assertions as well as time. There is no
flaky wall-time CI threshold in this baseline. Browser responsiveness, long-task
budgets and release performance claims require the later browser validation.
