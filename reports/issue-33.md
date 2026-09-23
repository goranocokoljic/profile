# Issue #33 — Build record: findings by severity, honest trend wording, number alignment

- **PR:** #36 — https://github.com/goranocokoljic/profile/pull/36
- **Branch:** feat/issue-33-findings-severity
- **Merged to:** develop on 2026-09-23
- **Review:** 1 cycle · 0 blockers fixed · 4 medium findings deferred (12 low deferred or rejected)
- **Status:** merged

## What was built
- The exporter writes `summary.findingsBySeverity` (five severities plus the derived `blocker`), `summary.findingsTotal`, and `summary.dispositions` (only when a cycle recorded them) for each dataset.
- The homepage build-record card shows `n blocker/high · n medium · n low/style` under REVIEW FINDINGS, plus `n fixed before merge` when dispositions exist.
- The /build "Review findings" tile shows the same breakdown for both datasets and follows the filters. The KPI row has a footnote that explains what a finding is.
- The trend-chart footnote is per dataset and no longer makes a causal claim. All new copy is in `site.ts` under `pages.build.findingsBreakdown` and `pages.build.footnotes`, and the schema rejects a typed site run count.

## Acceptance criteria
- [x] The severities sum to `findingsTotal`, which equals Σ `findings.total`. This is asserted in the exporter's structural check.
- [x] The homepage and /build KPIs show identical numbers and breakdown for `site`. The cross-page test is extended.
- [x] The words "proof" and "paying off" no longer appear under the trend chart.
- [x] No component holds the footnote strings.
- [x] `npm run check`, `build` and `test` are green (183 Playwright tests).

## Key files changed
- `scripts/export-build-data.mjs`: adds `summarizeReviews()`, which builds `dataset.summary`.
- `src/build/stats.ts`: `computeKpis` now returns `bySeverity`. Adds `sumSeverities` and `findingsBreakdown`.
- `src/build/format.ts`: adds `fmtBreakdown`, the one formatter both pages use. A no-break space keeps each number with its label.
- `src/build/render.ts`, `src/build/charts.ts`: add the KPI sub-line, the KPI footnote and the per-dataset trend note.
- `src/components/BuildRecord.tsx` (+ scss), `src/build/summary.ts`: add the card sub-lines.
- `src/data/site.ts`, `site.schema.ts`: add the new copy, with a no-digits guard on the site trend footnote.
- Visual baselines (win32 + Linux) are regenerated. They also pick up the role-fit copy change from a71e86f.

## Review outcome
- **Blockers fixed:** none (cycle 1 had zero Critical/High).
- **Deferred (non-blocking):**
  - SO-1/SEC-1: "fixed before merge" covers only 3 of 17 site cycles.
  - DUP-2: `fixed` comes from the cycle sum, and no test checks it against the task sum.
  - TST-1: the empty-state sub-line dash is not tested.
  - The Low findings are listed in the PR comment.
- **Rejected on purpose:** DUP-1/OR-3 (the prebuild runs plain node and cannot import `stats.ts`) and SO-4 (the wording is set by the issue).
- **Unresolved blockers:** none.
- **Out-of-diff observations:** recorded in the review file only. `dev-docs/parking-lot.md` was not written, because CLAUDE.md forbids changes under `dev-docs/`.
- Full reviews: `reviews/issue-33-multi-pass-*.md`

## How it was tested
- Criterion 1: `assertDatasetShape` in `scripts/export-build-data.test.mjs`, plus unit tests for `summarizeReviews` (no cycles, mixed/null dispositions, null rows) and a check that the exporter summary equals `computeKpis`.
- Criterion 2: `tests/build-story.spec.ts` checks that the card matches the /build tile and that the parts sum to `findingsTotal`. It covers the fixed line present, absent and in the empty state. The toprope breakdown is pinned in `build-dashboard.spec.ts`.
- Criteria 3–4: the footnote browser test for both datasets, and `site.test.ts` (no causal claim, digit guard both ways).
- The repo has no `test:coverage` script, so coverage was not measured. Every new function has direct unit tests.
- I checked the card by screenshot at 1440px and 390px.
