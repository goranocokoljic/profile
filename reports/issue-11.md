# Issue #11 — `/build` page

- **PR:** #26 — https://github.com/goranocokoljic/profile/pull/26
- **Branch:** feature/issue-11-build-page
- **Merged to:** develop on 2026-09-22
- **Review:** 1 cycle · 0 blockers fixed · 2 medium finding(s) deferred (plus 16 low)
- **Status:** merged

## What was built
- `/build` now has an intro above the dashboard. It has the eyebrow "HOW THIS SITE WAS BUILT", the `h1` "Build record" and two paragraphs. The copy is in `site.pages.build` (`eyebrow`, `intro`, `noscript`).
- The payload is now inlined as `<script type="application/json" id="build-data">`. Before, it was a 600 KB `data-payload` attribute. `<` is escaped. The client script reads the block, removes it and renders the dashboard. There is no runtime request.
- With JavaScript off, a `<noscript>` table lists the site runs: issue, outcome, duration and billed. It uses the dashboard's own formatters.
- The hero "See how this page was built" button now links to `/build`. The header nav already linked to `/build`.

## Acceptance criteria
- [x] `/build` renders both datasets from inlined data with JS enabled. With JS disabled, it shows the intro and a `<noscript>` table of the site runs.
- [x] Smoke: the page has one `h1`. The toggle exists. Switching to toprope changes the runs count text.
- [x] The HTML is 603 KB, under the 1.5 MB limit. `review_cycles` did not need to move.

## Key files changed
- `src/pages/build.astro`: the intro, the JSON data block, the noscript table and the scoped styles.
- `src/data/site.ts`, `src/data/site.schema.ts`: the intro and noscript copy.
- `src/components/Hero.astro`: the secondary CTA now goes to `/build`.
- `tests/smoke.spec.ts`: tests for the intro, the type scale at 1440 and 390 px, the toggle and the no-JS view.
- `tests/dist.spec.ts`: tests that the HTML is under 1.5 MB, that there is one escaped JSON block and that it round-trips. The inline-script check now allows only JSON data blocks.
- `tests/build-dashboard.spec.ts`, `tests/contact.spec.ts`: payload rewriting for the new block, an axe exclusion scoped to the eyebrow, and `#build` removed from the pending-links list.

## Review outcome
- **Blockers fixed:** none. The review found 0 critical and 0 high.
- **Deferred (non-blocking):**
  - Medium:
    - TST-1: the empty-dataset noscript branch has no test.
    - TST-2: the noscript link assertion is conditional.
  - Low: SO-1..5, SEC-1..3, OR-1, OR-3, TST-3..7, DUP-1, DUP-3. They are listed in the PR #26 comment.
- **Unresolved blockers:** none.
- **Parking lot:** out-of-diff observations went into the PR comment, not `dev-docs/parking-lot.md`. CLAUDE.md forbids edits under `dev-docs/`.
- Full reviews: `reviews/issue-11-multi-pass-*.md`

## How it was tested
- **Criterion 1:**
  - `smoke.spec.ts` "/build shows the intro and the build-record dashboard"
  - "/build without JavaScript › shows the intro and a table of the site runs"
  - `dist.spec.ts` "inlines the payload and stays under 1.5 MB"
  - the existing parity, CSP and no-request tests in `build-dashboard.spec.ts`
- **Criterion 2:** `smoke.spec.ts` "/build toggle switches the runs count to the toprope dataset", and the one-`h1` checks.
- **Criterion 3:** `dist.spec.ts` checks the byte size.
- **Gate:** `npm run check` passes with 0 errors and 0 warnings. `npm run build` passes with no warnings. `npm test` passes 110/110.
- **Coverage:** the repo has no `test:coverage` script, so there are no per-file numbers.
