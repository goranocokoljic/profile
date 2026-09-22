# Issue #3 — Header, hero and footer

- **PR:** #18 — https://github.com/goranocokoljic/profile/pull/18
- **Branch:** feature/issue-3-header-hero-footer
- **Merged to:** develop on 2026-09-22
- **Review:** 2 cycle(s) · 1 blocker(s) fixed · 6 medium finding(s) deferred
- **Status:** merged

## What was built
- A sticky header: the "GO." text monogram, four section links from `site.nav` and the "Download CV" link. The header respects the safe-area inset, and the nav hides below 900px as in the reference.
- The hero: eyebrow, two-part `h1` with the gradient emphasis, supporting text, two CTAs, CV link and build note. The portrait goes through `astro:assets` (webp srcset) and is greyscaled by a CSS filter.
- A footer (monogram + footer line) on a dark band, and a shared `Monogram` component used by the header and the footer.
- Header and footer on `/` and `/build`; hero on `/`.
- A new `site.markup` block for strings the reference hard-codes in HTML (monogram, aria-labels, portrait alt, CV path). It is excluded from the verbatim content.js test.
- `scroll-padding-top` tied to new header-height tokens, so anchors land below the sticky header.

## Acceptance criteria
- [x] Visual match to the reference hero at 1440 and 390 px. Playwright screenshots of both sites are in `docs/screenshots/issue-3/` and in the PR body.
- [x] CLS is 0 by construction. The portrait is out of flow inside a fixed min-height figure, with explicit `width`/`height`. A test blocks images and compares layout boxes. Lighthouse was not run (the `lighthouse` package is not allowed).
- [x] No client-side JavaScript: the built `/` has zero `<script>` elements (asserted).

## Key files changed
- `src/components/Header.astro`, `Hero.astro`, `Footer.astro`, `Monogram.astro`: the three sections and the shared mark, with styles ported from `styles.css`.
- `src/data/site.schema.ts`, `site.ts`, `site.test.ts`: the `markup` block, with a validated `cvHref` path.
- `src/styles/tokens.scss`, `global.scss`: header-height tokens and `scroll-padding-top`.
- `src/pages/index.astro`, `build.astro`: the components are mounted.
- `tests/smoke.spec.ts`: header, hero, footer, sticky, CLS, no-JS and layout tests.
- `src/assets/goran-hero.jpg`: the portrait, copied from the reference.

## Review outcome
- **Blockers fixed:**
  - TST-1: the CLS test could not fail. It is now an image-blocked vs loaded layout-box comparison, and a mutation probe confirmed it fails at 390px.
- **Also fixed in cycle 1:**
  - sticky-header anchor offset (SO-1/SEC-2)
  - restored `-webkit-background-clip` (SEC-1)
  - shared Monogram (OR-1/DUP-2)
  - duplicate h1 test (OR-2)
  - 1440 layout, `/build` nav and `#top` tests (TST-2/4/6/7)
- **Deferred (non-blocking):**
  - Mediums:
    - `.eyebrow`/`.text-link` are scoped to Hero; promote them to global (DUP-1/2). The `.text-link:hover` rule is not ported.
    - computed-style visual checks (TST-1)
    - `background-clip` assertion (TST-2)
    - `markup` values are not checked against the reference HTML (TST-3, overlaps #17)
    - the smoke suite could be trimmed (OR-1)
  - Plus 15 Lows. They are listed in the PR comment.
- **Design decision for the owner:** `--gradient-end` and `--teal` contrast is under AA. These are the reference tokens and are unchanged.
- **Unresolved blockers:** none.
- Parking lot not written: `dev-docs/` is read-only per CLAUDE.md. The PR comment holds the list.
- Full reviews: `reviews/issue-3-multi-pass-*.md`

## How it was tested
- Criterion → test mapping is in the PR test plan.
- Edge cases covered:
  - image blocked vs loaded at 1440 and 390
  - header on both pages, with root-relative hrefs
  - `cvHref` rejects `#`, relative, protocol-relative, absolute and `javascript:` values
  - CV file returns 200
  - no horizontal overflow at 390
  - scroll-padding equals the header height at both breakpoints
- Gate results:
  - `npm run check`: 0 errors, 12 unit tests.
  - `npm run build`: no warnings.
  - `npm test`: 27 passed.
- Coverage: the repo has no coverage tool (`test:coverage` does not exist). Every new file is exercised by the tests above.
- Manual: side-by-side screenshots against the reference. A mutation probe on the CLS test showed it fails when the hero stops reserving the portrait's space.
- Incident: a cycle-1 reviewer's throwaway worktree cleanup deleted `node_modules/.bin`. It was restored with `npm ci` from the unchanged lockfile.
