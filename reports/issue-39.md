# Issue #39 — Build record: drop the 'fixed before merge' line; disposition coverage is partial

- **PR:** #40 — https://github.com/goranocokoljic/profile/pull/40
- **Branch:** feature/issue-39-drop-fixed-line
- **Merged to:** develop on 2026-09-24
- **Review:** 1 cycle(s) · 0 blocker(s) fixed · 7 finding(s) deferred (1 medium, 6 low) · 1 rejected as wrong
- **Status:** merged

## What was built
- The homepage build-record card no longer shows "n fixed before merge" under REVIEW FINDINGS. Only the severity split line is left.
- `summary.fixed` (card summary) and the `findingsBreakdown.fixed` copy key (site.ts + schema) are gone.
- The exporter now writes `summary.dispositionsCoverage = { cycles, ofCycles }` next to `summary.dispositions`, derived from the cycle records. Site today: `{4, 21}`; toprope: `{74, 240}`.
- The homepage "below the card" visual baselines (win32 + linux) were refreshed; the card is one line shorter, so the page below moved by 1px.

## Acceptance criteria
- [x] "fixed before merge" appears nowhere under `dist/` or `src/` except in a comment explaining why it was removed. Exception kept on purpose: the recorded #33 review lesson quotes the phrase as history inside the payload's `lessons` data; the dist test excludes recorded lessons only.
- [x] Homepage card and `/build` KPI row still show identical severity splits for the `site` dataset.
- [x] `public/build/data.json` carries `summary.dispositions` and `summary.dispositionsCoverage` = `{cycles: 4, ofCycles: 21}` for `site`, derived.
- [x] `npm run check/build/test` green.

## Key files changed
- `src/components/BuildRecord.tsx` — second sub-line removed.
- `src/build/summary.ts` — `fixed` removed from `BuildSummary`.
- `src/build/types.ts` — `FindingsBreakdownCopy.fixed` removed; `dispositions` and new `dispositionsCoverage` documented.
- `src/data/site.ts`, `src/data/site.schema.ts` — copy key removed; schema comment says why.
- `scripts/export-build-data.mjs` — adds `dispositionsCoverage`.
- `tests/dist.spec.ts`, `tests/build-story.spec.ts`, `scripts/export-build-data.test.mjs`, `src/build/*.test.ts` — tests updated and added.

## Review outcome
- **Blockers fixed:** none (cycle 1 found zero Critical/High).
- **Deferred (non-blocking):** OR-1/SO-3/TST-4 brittle key-list test (Medium); SEC-1 `ofCycles` counts non-object rows; SEC-2/SO-2/TST-3 test repeats exporter predicate; SEC-4/TST-1 comment-line regex gaps; SO-1 lesson exemption broader than needed; OR-2 single-use exported type; OR-3 redundant assertion. Posted on PR #40.
- **Rejected (wrong):** SEC-3/TST-2/OR-4 — `tests/dist.spec.ts:33` already asserts the inline payload equals `data.json`.
- **Unresolved blockers:** none
- Full reviews: `reviews/issue-39-multi-pass-*.md`

## How it was tested
- Phrase absent in dist: `tests/dist.spec.ts` › `"fixed before merge" does not appear on either page or anywhere in dist/`, with self-test `the lesson filter removes only the lessons`.
- Phrase only in src comments: `"fixed before merge" appears in src/ only on comment lines`, with two-way self-test `the comment-line check tells comments from code`.
- Card/KPI parity: `tests/build-story.spec.ts` first test (card has exactly one findings sub-line, equal to the `/build` tile's); `tests/build-dashboard.spec.ts` findings tile test unchanged.
- Coverage derivation: `scripts/export-build-data.test.mjs` structural check on both committed datasets, plus `summarizeReviews` fixtures pinning `{0,0}`, `{2,6}`, `{0,1}`.
- Results: check 0, build 0 with no warnings, Playwright 203 passed, CI gate passed. No `test:coverage` script exists, so line coverage was not measured.
- Cloudflare "Workers Builds" check reports fail on this PR and on the prior PR #38 too; not caused by this change.
