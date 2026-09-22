# Issue #9 — Build-record data: exporter, payload schema and frozen snapshot

- **PR:** #24 — https://github.com/goranocokoljic/profile/pull/24
- **Branch:** feature/issue-9-build-data-exporter
- **Merged to:** develop on 2026-09-22
- **Review:** 2 cycle(s) · 1 blocker(s) fixed · 2 medium finding(s) deferred
- **Status:** merged

## What was built
- `scripts/export-build-data.mjs` reads the four JSONL files for `data/build/site/` and `data/build/toprope/` with the reference tolerant parser and writes `public/build/data.json` (`{ generatedAt, datasets: { site, toprope } }`).
- Site issue meta (`title`, `url`, `pr`, `prUrl`) comes from `gh` laid over the committed `data/build/site/meta.json`; without `gh` the committed file is used and the build still passes. `npm run build:meta` refreshes the file.
- Toprope lessons lose `file_globs` at export time; all other fields are kept.
- `prebuild` runs the exporter; `npm run check` now also runs `npm run test:data` (`node --test`).
- `src/build/types.ts` holds the payload types (Task, Phase, Review, ReviewCycle, Epic, Lesson, Dataset, Payload).

## Acceptance criteria
- [x] Exporter on `data/build/toprope/` yields `tasks.length === 172`; `reviewCycles` 240, `epics` 5, `lessons` 130 equal the line counts; `skipped` = 0.
- [x] Empty `data/build/site/` yields a valid dataset with empty arrays, not an error.
- [x] `npm run build` green with and without `gh` on PATH.

## Key files changed
- `scripts/export-build-data.mjs` — the exporter and `--write-meta` mode.
- `scripts/export-build-data.test.mjs` — 18 `node --test` checks.
- `src/build/types.ts` — hand-written payload types.
- `data/build/site/meta.json` — committed meta fallback for issues 1–8.
- `package.json` — `prebuild`, `build:meta`, `test:data`; `check` runs `test:data`.
- `tests/dist.spec.ts` — the built site ships `build/data.json` with both datasets.

## Review outcome
- **Blockers fixed:** TST-1 (cycle 1) — the live gh path had no test; `gh` is now an injectable runner with success, partial-failure and not-found tests. Also fixed in the same pass: PR linking now uses `closingIssuesReferences` (OR-1/SEC-4/TST-2), `--write-meta` merges over the committed file (SEC-3), issues with no meta are listed at build time (SO-2), no-gh CLI tests use an empty PATH directory (SEC-5/TST-7), dist spec asserts 172 (SO-5/TST-4).
- **Deferred (non-blocking):** SO-1 (mtime is checkout time), TST-1 (real `ghJson` failure branches), plus 16 Low — listed on PR #24.
- **Rejected:** cycle 1 SEC-1 (private file names in lesson rationales) — issue scope says strip only `file_globs` and keep everything else.
- **Unresolved blockers:** none
- Full reviews: `reviews/issue-9-multi-pass-*.md`

## How it was tested
- Criterion 1 → `toprope: every count equals the JSONL line count, nothing skipped`, `toprope is the frozen 172-run snapshot`, CLI test, and `tests/dist.spec.ts`.
- Criterion 2 → `an empty dataset directory is a valid dataset with empty arrays`, `a missing dataset directory is not an error`.
- Criterion 3 → CLI test with PATH set to an empty directory; by hand, `env PATH="<node dir>:/usr/bin" npm run build` exit 0 with `gh` not found, and a normal build with `gh`.
- Edge cases: malformed and blank/CRLF lines, malformed `meta.json`, gh partial failure, issue unknown to gh, no closing PR, live-over-committed merge, `--write-meta` without gh leaves the file alone.
- Coverage (`node --test --experimental-test-coverage`): `export-build-data.mjs` 96.6% lines, 88.4% branches. Uncovered: the real `gh` spawn and the missing-meta log line.
- Gate: `npm run check` pass, `npm run build` pass with no new warnings, `npm test` 84/84 pass. The repo has no `test:coverage` script.
- Note: the Cloudflare "Workers Builds: go-profile" check fails in 0s on this PR and on PRs #22 and #23. It is not caused by this change. The GitHub `gate` check passed.
