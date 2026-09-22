# Issue #13 — `record-run` script and telemetry commit contract

- **PR:** #29 — https://github.com/goranocokoljic/profile/pull/29
- **Branch:** feature/issue-13-record-run-script
- **Merged to:** develop on 2026-09-23
- **Review:** 2 cycle(s) · 2 blocker(s) fixed · 5 medium finding(s) deferred
- **Status:** merged

## What was built
- `scripts/record-run.mjs <issue> [--attempt n] [--no-push]`: a manual repair path for a run record. It does not compete with the runner's own commit. It refreshes the issue's entry in `data/build/site/meta.json` via `gh`, runs the exporter and a structural check, and commits only when something changed. The commit uses the runner's author (`tr-harness telemetry`) and message format.
- Before a push, the script fetches `origin/develop`. It refuses when local `develop` is behind, or when it holds unpushed commits that are not telemetry records. It also pushes a record commit that an earlier failed push left behind.
- A `meta.json` that does not parse is an error. The script never rewrites it as a one-entry file. Nothing is written before the structural check passes.
- `docs/telemetry.md`: describes the runner's own commit step (no wiring step needed), the repair script, and the README paragraph.
- Dry-run test `scripts/record-run.test.mjs`: runs against a throwaway git repository and a local bare `origin`, seeded from `tests/fixtures/record-run/`. It is part of `npm run test:data`.

## Acceptance criteria
- [x] `node scripts/record-run.mjs 13 --no-push` on the real analytics, after this run's merge, produces exactly one commit with the specified message. The human runs it; the PR describes how to check. I did the same check on #12 on the feature branch: one commit, then reverted.
- [x] Second invocation: "already recorded", exit 0, no commit.

## Key files changed
- `scripts/record-run.mjs`: the repair script. It reuses `readJsonl`, `fetchMeta`, `buildPayload` and `writeJson` from the exporter.
- `scripts/record-run.test.mjs`: 23 tests. They cover the function in temp repos, the push path to a bare origin, and the helpers and CLI exit codes.
- `tests/fixtures/record-run/`: two attempts for #13 (offset timestamps, a billed amount over $1,000) and one other issue.
- `docs/telemetry.md`: the contract.
- `package.json`: adds the test to `test:data`.

## Review outcome
- **Blockers fixed:**
  - SO-1/SEC-2 (cycle 1): "already recorded" was judged against local HEAD, so a rerun after a failed push reported success. It now compares against `origin/develop` and pushes pending record commits.
  - TST-1 (cycle 1): no test proved a successful push. Added bare-origin tests.
- **Also fixed in cycle 1 (Medium/Low):**
  - The push no longer publishes unrelated unpushed commits (SO-2/SEC-1).
  - An unparseable `meta.json` is no longer rewritten (SEC-3).
  - The structural check now catches skipped JSONL lines (SO-3/OR-1).
  - `gh` is asked once, not twice (OR-2).
  - No writes happen before the check passes (SO-6).
  - Tests run with hermetic git config (TST-4).
  - The check-failure path is tested (TST-3).
- **Deferred (non-blocking), cycle 2:**
  - SO-1/SEC-1: `--no-push` has no branch guard.
  - OR-1: most checks in `checkPayload` cannot fail.
  - OR-2: the in-memory meta patch into the payload.
  - TST-1: the CLI-level "already recorded" test.
  - 15 Low findings, listed in the PR comment.
- **Unresolved blockers:** none
- Full reviews: `reviews/issue-13-multi-pass-*.md`

## How it was tested
- Criterion 1: `recordRun › refreshes meta.json and makes exactly one telemetry commit`. It checks the commit count +1, the exact message, the author and committer, that only `meta.json` is in the commit, and that `gh` is asked once. The push variant is covered by `commits and pushes the record to develop`.
- Criterion 2: `second invocation: already recorded, no commit`, and the same check in the push variant (remote HEAD unchanged).
- Unhappy paths covered:
  - no task record, or an unknown attempt
  - `gh` missing, or `gh` not listing the issue
  - an unparseable or non-object `meta.json`
  - a JSONL line that does not parse (the structural check fails, nothing is written)
  - off-`develop`, no reachable origin, local behind origin, or unpushed non-telemetry commits
  - a pending record left by a failed push
  - unrelated staged work
  - bad arguments
  - offset timestamps
  - `$1,234.57` and `$0.00` formatting
- Gate: `npm run check` (0 errors, 0 warnings, 44 node tests), `npm run build` (no new warnings) and `npm run test` (127 Playwright tests) all pass. CI `gate` passes. The Cloudflare "Workers Builds" check fails, as it did on PRs #27 and #28.
- Coverage (`node --test --experimental-test-coverage`): `scripts/record-run.mjs` has 99.55% line and 93.14% branch coverage. The only uncovered line is the CLI print for non-`recorded` results (deferred TST-1).
- Manual check: on the feature branch, `node scripts/record-run.mjs 12 --no-push` made one telemetry commit (`meta.json` +6 lines). The second call printed "already recorded" and exited 0. That trial commit was reverted and is not in the squash.
