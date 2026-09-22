# Issue #5 — Platform engineering section

- **PR:** #20 — https://github.com/goranocokoljic/profile/pull/20
- **Branch:** feature/issue-5-platform-section
- **Merged to:** develop on 2026-09-22
- **Review:** 1 cycle(s) · 0 blocker(s) fixed · 3 medium finding(s) deferred (plus 11 low deferred, 2 low rejected as already done)
- **Status:** merged

## What was built
- `Platform.astro` (`id="platform"`): eyebrow, `h2`, two intro paragraphs, role tag row, the platform-evolution diagram, the "important shift" copy, three metrics (the note shows only where `site.ts` has one), the ownership block and the closing pull-quote.
- The diagram is HTML and CSS only: a `figure` with a `figcaption`, portal and foundation boxes as list items, and CSS arrows hidden from screen readers. A visually hidden sentence describes the diagram. That sentence is new copy, so it is in `site.markup.platformDiagramSummary`.
- At 900px and below the page is one column, and the diagram is one vertical stack of boxes.
- The section is mounted after `SelectedWork`. The `#platform` link target test now runs. The `#ai` and `#vismedic` targets stay `fixme` until #6 and #7.

## Acceptance criteria
- [x] Visual match at both widths; diagram degrades to a vertical stack ≤ 900 px. (At ≤ 600px the reference hides 3 portals in a 2-column grid. This build keeps all 5 in one column, as the issue asks. The section is about 340px taller at 390px.)
- [x] All copy comes from `site.platform`. Zero literals.
- [x] Smoke: metrics count = 3; diagram has 5 portal boxes and 4 foundation boxes.

## Key files changed
- `src/components/Platform.astro` — new section, ported from `.platform-*` in the reference CSS.
- `src/data/site.ts`, `src/data/site.schema.ts` — new `markup.platformDiagramSummary` string.
- `src/pages/index.astro` — mounts `Platform` after `SelectedWork`.
- `tests/smoke.spec.ts` — 9 new platform tests; the single link-target `fixme` split into one test per target.

## Review outcome
- **Blockers fixed:** none
- **Deferred (non-blocking):** SO-1 (grid counts not pinned in the schema), DUP-1/OR-5/SO-2 (third scoped `.eyebrow`), TST-1 (`columnCount` passes on non-grid elements). 11 Low findings are listed in the PR comment.
- **Unresolved blockers:** none
- Full reviews: `reviews/issue-5-multi-pass-*.md`
- Note: the Cloudflare "Workers Builds" check fails on this PR, as it did on #18 and #19. The repo `gate` check passed.
- Out-of-diff notes went into the PR comment, because `dev-docs/parking-lot.md` is in a folder the harness must not change.

## How it was tested
- Copy → `platform section shows all of its copy from site.ts`, plus the existing no-inline-copy guard.
- Box counts, HTML-only diagram → `platform diagram has 5 portal boxes and 4 foundation boxes, built in HTML`.
- Screen-reader summary → `platform diagram has a visually hidden summary for screen readers`.
- Metrics = 3, optional note → `platform shows three metrics, with a note only where site.ts has one`.
- Layout → 1440px two-column test, stack tests at 900px and 390px (box order, no overflow), the 901/900 breakpoint edge, and the 390px metrics column.
- Order → `homepage sections sit in order after the hero`; `#platform` link target test.
- Results: `npm run check` 0 errors and 0 warnings; `npm run build` no warnings; `npm run test` 46 passed, 2 fixme.
- Coverage: the repo has no coverage tool (`test:coverage` does not exist).
- Manual: screenshots next to `design-reference/site/index.html`. At 1440px the section height is the same (1322.9px) and it looks the same.
