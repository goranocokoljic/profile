# Issue #12 — Homepage build-record card (React island)

- **PR:** #27 — https://github.com/goranocokoljic/profile/pull/27
- **Branch:** feature/issue-12-build-record-card
- **Merged to:** develop on 2026-09-23
- **Review:** 2 cycle(s) · 1 blocker(s) fixed · 8 medium finding(s) deferred
- **Status:** merged

## What was built
- The homepage has a new "How this page was built" section (`#build-story`). It sits between VisMedic and Background, as in the reference. It has the eyebrow, headline, intro, triad, 8-step flow, body text and the build-record card. All copy comes from `site.ts`.
- The card's live part is `BuildRecord.tsx`, the one React island on the homepage (`client:visible`). It shows five KPIs, the latest run with issue and PR links, a button that shows the last 5 runs, and "Inspect the full build →". With no runs it shows "No runs recorded yet." and `—` for each KPI.
- The card's numbers come from `src/build/summary.ts` at build time. It reuses `computeKpis`, so the card and the `/build` KPI row cannot disagree.
- Astro writes the island runtime as inline code, and CSP `default-src 'self'` blocks inline code. `scripts/externalize-inline.mjs` moves that code into files under `/_astro/` after the build.
- The hero "See how this page was built" button now goes to `#build-story`.

## Acceptance criteria
- [x] KPI numbers equal the `/build` KPI row for the same dataset. A Playwright test reads both pages.
- [x] The homepage visually matches the reference `.build-story` section. Computed styles are compared with the reference at 1440 and 390 px.
- [x] There is only one hydrated island on `/` (exactly one `astro-island`).

## Key files changed
- `src/components/BuildStory.astro`: the section markup and its scoped styles.
- `src/components/BuildRecord.tsx` and `BuildRecord.module.scss`: the island (KPIs, latest run, toggle, runs table, empty state).
- `src/build/summary.ts`: the card data. It sorts runs by instant, not by string.
- `src/build/load.ts`: the shared payload reader. `/build` uses it too.
- `scripts/externalize-inline.mjs`: moves inline island code out of the HTML for CSP.
- `src/data/site.ts`, `site.schema.ts`: the card copy in `markup.buildRecord`. The lengths of `triad`, `flow` and `metrics` are pinned.
- `src/styles/global.scss`: `.mono-label` is now a global utility.
- `astro.config.mjs`, `tsconfig.json`, `package.json`: the React integration and the JSX settings. New dependencies: `@astrojs/react`, `react` and `react-dom` (allowed by the issue). Also `@types/react` and `@types/react-dom`, which `@astrojs/react` needs as peers.

## Review outcome
- **Blockers fixed:** DUP-1 (cycle 1). `.mono-label` was copied into the section and into the island's module. It is now in `global.scss`.
- **Also fixed:**
  - Cycle 1:
    - TST-1: the size budget now sums the imported chunks.
    - TST-5: the Billed column is asserted.
    - TST-11: `aria-controls` and the Enter key are tested.
  - Cycle 2:
    - TST-1: the `aria-controls` check is now non-null.
    - TST-2: the `.mono-label` type is pinned.
- **Deferred (non-blocking):**
  - Medium:
    - OR-1: the CTA could live outside the island.
    - OR-2: the value in each `metrics` tuple is dead.
    - SO-1: the regex rewrite has no self-check, and CSP is tested on `/` only.
    - DUP-2: the `/build` noscript table sorts by string.
    - DUP-3: the CSP test helper is copied.
    - DUP-4: the column labels are in `site.ts` twice.
    - TST-2 (c1): the empty and no-meta states are tested through a props rewrite.
    - TST-3 (c1): the fit test uses live data.
  - Low: the rest are listed in the PR #27 comment.
- **Unresolved blockers:** none.
- **Parking lot:** the out-of-diff notes went into the PR comment. CLAUDE.md forbids edits under `dev-docs/`.
- Full reviews: `reviews/issue-12-multi-pass-*.md`

## How it was tested
- **Criterion 1:** `tests/build-story.spec.ts` › "card KPIs equal the /build KPI row for the site dataset". `src/build/summary.test.ts` checks the totals against `computeKpis` and against fixed values.
- **Criterion 2:** "build story matches the reference at 1440px / 390px" compares 15 parts with the served reference. "KPI values fit their columns" runs at 1440/1000/700/390. Screenshots are in `docs/screenshots/issue-12/`.
- **Criterion 3:** "/ has exactly one hydrated island, /build has none". Also the smoke test "the homepage ships no client JS but the build-record island".
- **Edge cases:**
  - the empty dataset (dashes and the empty text)
  - a latest run with no metadata (no links)
  - a latest run with issue and PR links
  - the toggle (aria-expanded, hidden state, Enter key)
  - sorting by instant across time-zone offsets
  - at most 5 recent runs
  - CSP `default-src 'self'` with no violations and no outside requests
  - the component and its imports under 6 KB gzipped (about 5.4 KB)
  - axe on the section
  - node tests for `externalize()`
- **Gate:** `npm run check` has 0 errors. `npm run build` has no warnings. `npm test` passed 127/127.
- **Coverage:** the repo has no `test:coverage` script, so there are no per-file numbers.
- **Note:** the GitHub CI gate and the Cloudflare build were still pending when the PR was merged.
