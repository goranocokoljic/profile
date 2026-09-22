# Issue #4 — "Why this role, specifically" and selected-work index

- **PR:** #19 — https://github.com/goranocokoljic/profile/pull/19
- **Branch:** feature/issue-4-role-fit-selected-work
- **Merged to:** develop on 2026-09-22
- **Review:** 1 cycle(s) · 0 blocker(s) fixed · 3 medium finding(s) deferred (plus 12 low)
- **Status:** merged

## What was built
- `RoleFit.astro`: teal kicker rule, `h2`, intro, and a 2×2 grid of `h3` items numbered `01`–`04` in mono teal. One column at ≤ 900px; smaller top padding and intro at ≤ 600px.
- `SelectedWork.astro`: mono label and three links (number, title, `↘` arrow hidden from screen readers). Teal text and border on hover and on keyboard focus, plus the global focus outline. The section has `id="work"`, so the header "Work" link and the hero "See the work" button land here.
- Both sections are mounted after `Hero` in `src/pages/index.astro`. All copy comes from `site.roleFit` and `site.selected`.

## Acceptance criteria
- [x] Visual match at both widths. Headings are `h2` (section) and `h3` (items).
- [x] Keyboard focus visible on every link.

## Key files changed
- `src/components/RoleFit.astro` — new section, ported from `.role-fit` in the reference CSS.
- `src/components/SelectedWork.astro` — new section, ported from `.selected-work`, with a `:focus-visible` state added to the hover state.
- `src/pages/index.astro` — mounts both after `Hero`.
- `tests/smoke.spec.ts` — 10 new smoke tests (one is `test.fixme`).

## Review outcome
- **Blockers fixed:** none
- **Deferred (non-blocking):** SO-1/SEC-1/TST-7 (link-target `fixme` has no trigger), TST-1 (visual match only checked by column counts), SO-2/OR-1/DUP-1 (`.eyebrow` scoped in two components). 12 Low findings are listed in the PR comment.
- **Unresolved blockers:** none
- Full reviews: `reviews/issue-4-multi-pass-*.md`
- Note: the Cloudflare "Workers Builds" check fails on this PR and on #18 too. It is not caused by this change. The repo `gate` check passed.

## How it was tested
- 4 role-fit items in order, with `h2`/`h3` → `role fit shows its h2, intro and the four numbered items in order`, `homepage headings step down without skipping a level`.
- Mounted after `Hero` → `homepage sections sit in order after the hero`.
- `#work`, 3 links, hrefs from `site.ts` → `selected work is #work and lists three numbered links`.
- Focus visible → `selected-work links show a visible focus ring and the hover colour on focus` (real keyboard focus on each link).
- Hover → `selected-work links take the teal hover state`.
- Layout → column checks at 1440px and 390px (with no horizontal overflow), and the 901px/900px boundary.
- Link targets exist → `test.fixme` until #5, #6 and #7 add `#platform`, `#ai` and `#vismedic`.
- Results: `npm run check` 0 errors and 0 warnings; `npm run build` has no warnings; `npm run test` 36 passed, 1 fixme.
- Coverage: the repo has no coverage tool (`test:coverage` does not exist). Both new files are covered by the tests above.
- Manual: screenshots next to `design-reference/site/index.html` at 1440px and 390px. Section heights are the same (896px and 1557px) and the layout looks the same.
