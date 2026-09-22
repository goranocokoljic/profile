# Issue #7 — VisMedic section with optimised archive images

- **PR:** #22 — https://github.com/goranocokoljic/profile/pull/22
- **Branch:** feature/issue-7-vismedic-section
- **Merged to:** develop on 2026-09-22
- **Review:** 1 cycle(s) · 0 blocker(s) fixed · 5 medium finding(s) deferred
- **Status:** merged

## What was built
- The homepage now has the `#vismedic` section after the AI section: headline and intro, a 4-row meta list, three archive screenshots, the "beyond the prototype" block with a 4-row recognition list and the award photo, and the closing pull-quote.
- All four images go through `astro:assets` `<Picture>`: a webp `<source>` plus a jpg fallback, explicit width and height, `loading="lazy"`, `decoding="async"`, and `srcset`/`sizes` worked out from the grid.
- The archive grid uses the reference v3 CSS: two 280px rows at desktop, one column of 260px figures at 900px and below, `object-fit: cover`, top-left position.
- Alt text and captions live in `site.markup.vismedicArchive` / `vismedicAward` (a strict, keyed schema: always three archive figures).
- A new global `.pull-quote` class holds the reference's base quote style.

## Acceptance criteria
- [x] Total image bytes on the homepage < 600 KB: 97 KB at 1440px, 59 KB at 390px (DPR 1); 260 KB at 1440px DPR 2, 249 KB at 390px DPR 3 (measured by hand).
- [x] Visual match at 1440 and 390 (screenshot comparison with the reference); no image overflows its figure.
- [x] Smoke: 3 archive figures, 1 award figure, 4 recognition rows, 4 meta rows.
- [x] `#vismedic` selected-work target is live (pending-target list removed from `tests/smoke.spec.ts`).

## Key files changed
- `src/components/VisMedic.astro` — the new section, with scoped styles ported from the reference.
- `src/assets/vismedic/*.png` — source images, copied from `design-reference/site/assets/vismedic/`.
- `src/data/site.ts`, `src/data/site.schema.ts` — alt text and captions for the four figures.
- `src/styles/global.scss` — shared `.pull-quote` class.
- `src/pages/index.astro` — mounts the section after `AiEngineering`.
- `tests/vismedic.spec.ts` — counts, copy, image attributes, byte budget, overflow, layout at 1440/900/901/390, axe.
- `tests/smoke.spec.ts` — section order; `#vismedic` is no longer pending.

## Review outcome
- **Blockers fixed:** none (0 Critical, 0 High).
- **Deferred (non-blocking):** OR-1/SO-1/DUP-2 (`.pull-quote` has one user; Platform and AI keep scoped copies), DUP-1 (section h2/h3 rules copied, not shared), TST-1 (budget test runs at DPR 1 only), TST-2 (jpg fallback bytes not measured), OR-2/TST-5 (duplicate order test), plus 13 Low. Full list in the PR comment.
- **Unresolved blockers:** none.
- Full reviews: `reviews/issue-7-multi-pass-*.md` (the file holds a condensed copy of each lens section).

## How it was tested
- Criterion → test: budget → `homepage image bytes stay under 600 KB at 1440px / 390px`; no overflow → `at 1440px / 390px no vismedic image overflows its figure`; smoke counts → `vismedic smoke: 3 archive figures, 1 award figure, 4 recognition rows, 4 meta rows`; visual match → the 1440px grid test (padding, background, type sizes, 280px rows, object-fit/position), the 390px test (260px figures, quote size) and the 900/901 breakpoint test; target → `selected-work link #vismedic resolves to a section on the page`.
- Also: image attributes and webp source, copy from `site.ts`, axe on the section.
- Gate: `npm run check` passed (0 errors, 13 unit tests), `npm run build` passed with no warnings, `npm test` 72 passed. No coverage tool exists in this repo (`npm run test:coverage` is not defined).
- The Cloudflare "Workers Builds" check fails on this PR. It also failed on #19, #20 and #21, so this PR did not cause it.
