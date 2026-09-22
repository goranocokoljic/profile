# Issue #10 — Port the dashboard renderer with a dataset toggle

- **PR:** #25 — https://github.com/goranocokoljic/profile/pull/25
- **Branch:** feature/issue-10-dashboard-renderer
- **Merged to:** develop on 2026-09-22
- **Review:** 1 cycle · 0 blockers fixed · 9 medium finding(s) deferred (plus 20 low)
- **Status:** merged

## What was built
- `/build` now shows the full build-record dashboard: the reference dashboard ported to TypeScript under `src/build/` (KPI row, cost per day, cycle-1 trend, phase medians + est-cost share, severity columns, runs table with expandable rows, epics, lessons). Every chart has its table twin.
- The payload is embedded in the page at build time, so there is no `fetch` and no polling. The script is 10.2 KB gzipped.
- The dataset switch (This site | tr-harness on Toprope) is kept in `#dataset=…`. It has an empty state and `—` KPIs when a dataset has no runs.
- Site runs link to their GitHub issue, and a new PR column links to the merged PR. Expanded rows add a Dispositions table.
- The colours are mapped onto the site tokens in `src/styles/dashboard.scss`, with a dark variant scoped to the dashboard.

## Acceptance criteria
- [x] Toprope reproduces the reference numbers: 172 runs, 83%, $3,731, 163h 28m, $15.71, 2,735 findings. These are identical to the reference, which was run on the same data.
- [x] No fetch, no setInterval, no external resources. The /build JS is 10.2 KB gzipped, under the 60 KB limit.
- [x] Light and dark themes are correct. Screenshots: `reports/issue-10/build-light.png` and `reports/issue-10/build-dark.png`.
- [x] The toggle, period filter, sort headers and row expanders are all keyboard-operable. axe finds no serious or critical issues in light or dark.

## Key files changed
- `src/build/{format,stats,dom,charts,runs,lessons,render,dashboard}.ts`: the port. `stats.ts` holds the pure number logic.
- `src/pages/build.astro`: embeds the payload and boots `renderDashboard`.
- `src/styles/dashboard.scss`: the reference CSS, scoped to `.dash`, with variables mapped to tokens.
- `src/data/site.ts` and `site.schema.ts`: dataset labels and the empty-state copy.
- `tests/build-dashboard.spec.ts`, `tests/dist.spec.ts`, `src/build/stats.test.ts`: the tests.

## Review outcome
- **Blockers fixed:** none. The review found 0 critical and 0 high.
- **Deferred (non-blocking):**
  - Medium: SO-1 (resize rebuild), SO-2 (reference wording kept in the renderer), OR-1, OR-2, TST-1..4.
  - Low: 20 items, listed in the PR #25 comment.
- **Rejected:**
  - OR-3 was wrong. Astro does not escape `<` in attributes.
  - SO-3 was intentional. The site is light-only, so only the dashboard goes dark.
- **Unresolved blockers:** none.
- Full reviews: `reviews/issue-10-multi-pass-*.md`

## How it was tested
- **Parity:** the real reference dashboard runs in the same browser, with `/api/data` routed to the same payload. KPIs, the as-of line, all 4 chart tables, epics, lessons and every runs row are compared for both datasets. The toprope KPIs are also pinned.
- **Other browser tests:**
  - the hash toggle: default, reload, manual edit, and an unknown value
  - the empty state, using a rewritten payload
  - meta links and the PR column, with and without meta or a PR
  - the keyboard flow with focus restore
  - the detail row with and without dispositions
  - runtime CSP `default-src 'self'` with no violations and no off-origin requests
  - the tooltip
  - the theme tokens and a live colour-scheme switch
  - axe in light and dark
  - no overflow at 390px
- **Dist test:** the /build script contains no fetch, setInterval or XHR, and is under 60 KB gzipped.
- **Unit tests:** the formatters, KPIs (empty input, ok-only median), filters, zero-activity days, phase shares, the rolling trend, PR sorting and hash parsing.
- **Gate:** `npm run check` passes. `npm run build` passes with no warnings. `npm test` passes 105/105.
- **Coverage:** the repo has no `test:coverage` script, so there are no per-file coverage numbers.
