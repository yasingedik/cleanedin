# AI development harness

This harness gives coding agents a common entry point, a repeatable validation
loop and reviewable evidence. It uses Node's built-in APIs and existing project
tools. It does not call an AI service, need an API key, or run an autonomous issue
queue. The same commands work for a human contributor.

## First run

```bash
nvm use
npm ci
npm run ai:context
npm run ai:doctor
npm run ai:check
```

If you do not use nvm, install Node 24 directly. `ai:context` reads the current
checkout and prints revision/worktree metadata, npm scripts and documentation
entry points. `ai:doctor` checks Node, Git, required documentation and installed
dependencies; it reports Chromium executable/display availability separately.
A successful doctor is environment readiness for quick checks, not a test result
or proof that OS browser libraries are installed. Neither command installs tools,
fetches GitHub issues or changes branches. The worktree fingerprint excludes
ignored local captures; it hashes nonignored source without printing its content.

For the complete installed Chromium extension run:

```bash
npx playwright install --with-deps chromium
xvfb-run --auto-servernum npm run ai:check -- --full
```

The Xvfb wrapper is for Linux without a display. On a desktop with a display use
`npm run ai:check -- --full` directly. Browser installation needs network access
and may require permission to install OS libraries. In a restricted environment,
run the available checks and report the browser blocker; do not replace extension
tests with ordinary webpage tests or mark them passed. The existing test helper
uses a temporary extension/profile and synthetic local pages, and widens host
matches only in that temporary test copy. It never needs a LinkedIn login.

## Validation profiles

| Command | Checks, in execution order | Use |
| --- | --- | --- |
| `npm run ai:check -- --docs` | Doctor, harness self-tests, working-diff whitespace | Documentation-only work |
| `npm run ai:check` | Docs profile, lint, typecheck, unit, fixtures, security, build | Runtime/tooling changes and local iteration |
| `npm run ai:check -- --full` | Quick profile, production dependency audit, installed Chromium E2E | CI and browser acceptance evidence |

All profiles fail on the first failed check and record remaining checks as skipped.
Use `npm run test:security` to run the existing security suite independently.
Profiles are defined in `scripts/ai-harness.mjs`; CI calls the full profile so
local and CI command selection cannot diverge. `git diff --check HEAD` covers
staged and unstaged tracked edits, not committed PR changes or untracked files.
Review the complete PR diff as well. Docs checks do not validate Markdown links,
diagrams or behavior. The full profile's audit requires network access.

Each invocation replaces `.ai/reports/docs.json`, `quick.json` or `full.json` for
that profile. Reports contain start/end revision and worktree fingerprints,
Node/npm/OS details, commands, durations, exit codes and explicit pass/fail/skip
states. A running report is persisted before checks begin and after each check,
so an interrupted process cannot leave the previous successful report in place.
Reports are local ignored artifacts; CI uploads them even on failure. Test output
streams to the terminal/CI log and is not copied into the JSON report. Review any
logs before sharing them. A changed worktree during validation fails the run.

Fingerprints include nonignored tracked/untracked file content and modes. They
identify the tested working tree, not a signed attestation or an installable
artifact checksum. Ignored build outputs are excluded. Do not run concurrent
harness invocations in one checkout; use separate worktrees. A report with dirty
state describes uncommitted changes, not just its HEAD commit. Rerun on committed
code or link CI before claiming a commit passed. Local quick reports cannot satisfy
the full profile or the release's separate browser/device gates.

## Issue loop

1. Read [AGENTS.md](../../AGENTS.md), the current issue and its native blocking
   dependencies. Check merged implementation evidence on GitHub. For the modular
   release, start from the latest `develop/modular-extension` on a short-lived
   branch and target the integration branch in the PR.
2. Copy [task-template.md](task-template.md) to `docs/ai/tasks/<issue>-<slug>.md`
   for multi-step work. Write scope, acceptance-to-test mapping, relevant modules
   and known baseline failures. This is a durable handoff, not a second issue tracker.
3. Reproduce relevant behavior before editing. Implement one coherent issue;
   add meaningful tests and follow the architecture ownership table.
4. Run focused checks, then the required profile. Compare actual outcomes with
   acceptance criteria, review the diff and update the task note. Record blockers
   as blockers, not passes. Never silently rewrite baseline behavior.
5. Open a PR with the issue, base branch, acceptance evidence and CI results.
   Wait for review/merge authorization. Resume the next dependent issue only after
   its prerequisite is accepted into the integration branch.

To start an agent, use: "Read AGENTS.md and implement issue #N on a branch from
develop/modular-extension. Verify prerequisites, maintain a task note, run the
relevant harness profile, and open a PR to the integration branch."

## Ownership and limits

`AGENTS.md` is the shared instruction source; `.github/copilot-instructions.md`
is a small Copilot entry point. GitHub documents both repository instructions and
agent instruction files in its [custom instructions guide](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions).
Support depends on the agent/client; explicitly ask an unfamiliar agent to read
AGENTS.md. Instructions guide agents but are not access controls.

This preparatory change runs the previously omitted security suite and closes
that command-selection gap from #20. Issue #20 still owns characterization
fixtures, actual UI/persistence assertions, performance scenarios and baseline
measurements. Module import enforcement, WXT manifests, browser API contracts and
Firefox/Safari/device coverage arrive in their planned issues. A green harness
today does not mean those capabilities exist.

When a later issue changes build entrypoints or test commands, update the profile,
its self-tests, agent code map and this guide in the same PR. Keep policies in the
architecture/release docs; link them here instead of creating competing copies.
