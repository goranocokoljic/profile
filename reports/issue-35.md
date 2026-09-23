# Issue #35 — /build: technical decisions for this site

- **PR:** #38 — https://github.com/goranocokoljic/profile/pull/38
- **Branch:** feat/issue-35-build-decisions
- **Merged to:** develop on 2026-09-23
- **Review:** 2 cycle(s) · 1 blocker(s) fixed · 4 medium finding(s) deferred
- **Status:** merged

## What was built
- A "Technical decisions" section on `/build`, between the intro and the dashboard: six decisions, each an `h3` and a paragraph, in two columns (one column at ≤ 900 px), with the role-fit type scale and spacing.
- One "Source →" link to https://github.com/goranocokoljic/profile (new tab, `rel="noopener"`).
- Copy in `site.pages.build.decisions`; the URL in `site.markup.repoHref` (https only). The schema pins the list to six items.
- One claim was corrected: the One-island body now says the card is the only interactive, data-driven element "on the homepage" and "everything else there is HTML and CSS", because `/build` runs the dashboard script.

## Acceptance criteria
- [x] Every claim is true of the repository; the PR cites the backing file for each (`astro.config.mjs`, `dist/index.html` island and scripts, `tests/dist.spec.ts`, `wrangler.jsonc`, `src/data/site.ts` + `site.schema.ts`, `.github/workflows/ci.yml` + `package.json` + `tests/polish.spec.ts`). "Cloudflare builds develop on every push" rests on the Cloudflare dashboard setting, stated in the PR.
- [x] Smoke: `/build` has the section with 6 items and one repo link; heading order valid; axe clean.
- [x] Homepage unchanged: no homepage file or baseline touched.
- [x] `npm run check` and `npm run build` green; CI `gate` (Linux) green. Local Windows run: one pre-existing failure, see below.

## Key files changed
- `src/components/Decisions.astro` — new section component.
- `src/pages/build.astro` — mounts it after the intro, before `#dashboard`.
- `src/data/site.ts`, `src/data/site.schema.ts` — `pages.build.decisions` and `markup.repoHref`.
- `tests/decisions.spec.ts` — smoke, order, headings + axe, role-fit style parity at 1440/768/390, and per-claim guards.
- `src/data/site.test.ts` — `repoHref` negative cases; six-item length.
- `tests/__screenshots__/polish.spec.ts/build-*` — `/build` baselines re-rendered (win32 locally, Linux in the CI container).

## Review outcome
- **Blockers fixed:** SEC-1 (cycle 1) — "Everything else is HTML and CSS" was false on `/build`; claim scoped to the homepage. Also in that pass: 768 px one-column test case (TST-1), script check by source not count (SO-3/TST-4).
- **Deferred (non-blocking):** DUP-1/SO-3/OR-3 scoped copy of RoleFit styles (extract to `global.scss` in a homepage issue); SO-1/SEC-2/SEC-3 deploy and "same green" claims rest on external config; SEC-1 (cycle 2) "nothing is fetched from anywhere" wording; OR-1/OR-2 test scope; SO-2/SEC-4 loose One-island guard; TST-1..4, OR-4, OR-5, SEC-5, SO-4 minor test points. Listed on the PR.
- **Parked out-of-diff:** `CLAUDE.md` still says "Cloudflare Pages"; `public/build/data.json` still copied to dist; local `home-light-1024-below-win32.png` is 1 px stale on develop. (`dev-docs/parking-lot.md` not written: CLAUDE.md forbids edits under `dev-docs/`.)
- **Unresolved blockers:** none
- Full reviews: `reviews/issue-35-multi-pass-*.md`

## How it was tested
- Six items / one link / attributes → `tests/decisions.spec.ts` "…six items and one repo link".
- Position → "the decisions sit after the intro and before the dashboard".
- Heading order + axe → "decisions headings go h2 → h3 and axe finds no violations"; also `tests/polish.spec.ts` page-wide axe, both schemes.
- Type scale and columns → computed styles equal to the homepage role-fit grid at 1440 (2 columns), 768 and 390 (1 column).
- Claims → one guard per backing file in "the decisions are true of the repository".
- Schema → `site.test.ts`: `repoHref` rejects http, `javascript:`, relative, anchor, empty; items reject 5 and 7.
- Coverage: the repo has no `test:coverage` script, so line coverage was not measured.
- Local Windows: 199 passed, 1 failed (`/ (light) at 1024px`, `home-light-1024-below-win32.png`, 1066 vs 1067 px). Fails the same on develop without this change; homepage baselines left untouched per the issue. CI `gate` passed.
- Manual: screenshots of the section at 1440 and 390 px checked by eye.
