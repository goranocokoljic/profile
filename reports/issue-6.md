# Issue #6 — AI engineering section (tr-harness and PureContext)

- **PR:** #21 — https://github.com/goranocokoljic/profile/pull/21
- **Branch:** feature/issue-6-ai-engineering-section
- **Merged to:** develop on 2026-09-22
- **Review:** 1 cycle(s) · 0 blocker(s) fixed · 4 medium finding(s) deferred
- **Status:** merged

## What was built
- The homepage now has the `#ai` section after Platform: intro, 9-step dev flow, PureContext card, review-lenses card with the "Finished" quote, limits card with 5 controls, QA zone (8-step flow, 3 principles), 5 findings, and the ownership block with the closing quote.
- Flows are `<ol>`, pills/controls/findings are `<ul>`, both quotes are `<blockquote>`. Step numbers are `aria-hidden`.
- The PureContext link opens in a new tab with `rel="noopener"` and a screen-reader-only "(opens in a new tab)".
- The strings that the reference hard-codes in HTML (loop pill names, PureContext URL, new-tab label) live in `site.markup`. The schema only accepts an https URL.
- `.eyebrow`, `.mini-label`, `.text-link`, `.visually-hidden` base rules are in `global.scss`.

## Acceptance criteria
- [x] Visual match at both widths (screenshot comparison with the reference at 1440 and 390; one deliberate deviation: the two cards stack at ≤900px).
- [x] Smoke: 9 dev steps, 8 QA steps, 5 lenses, 5 controls, 3 principles, 5 findings; PureContext link points to `https://github.com/goranocokoljic/pure-context`.
- [x] Heading order h2 → h3 → h4, verified by an axe run (`@axe-core/playwright` added, as allowed).
- [x] `#ai` selected-work target assertion is live.

## Key files changed
- `src/components/AiEngineering.astro` — the new section: markup plus scoped styles ported from the reference.
- `src/data/site.ts`, `src/data/site.schema.ts` — `markup.pureContextHref`, `newTabLabel`, `changeSafetyLoop`.
- `src/styles/global.scss` — shared utility classes.
- `src/pages/index.astro` — mounts the section after Platform.
- `tests/ai.spec.ts` — counts, copy, link, quotes, axe (heading order and a full run), layout at 1440/900/901/390.
- `tests/smoke.spec.ts` — section order; `fixme` replaced by an explicit `PENDING_TARGETS` list (`#vismedic` only).
- `package.json` — `@axe-core/playwright` dev dependency.

## Review outcome
- **Blockers fixed:** none (0 Critical, 0 High).
- **Deferred (non-blocking):** SO-2/SEC-1/TST-1 (full axe run disables `color-contrast`; `--teal` on `--bg` is 4.49:1, site-wide), SO-1/OR-1/SEC-6 (global utilities vs. scoped copies in older sections; comment overstates it), TST-2 (600px breakpoint not pinned), plus 15 Low. The full list is in the PR comment.
- **Rejected:** OR-2, OR-5 (required by review-KB lessons), SEC-3 (issue specifies `rel="noopener"`).
- **Unresolved blockers:** none.
- Full reviews: `reviews/issue-6-multi-pass-*.md`

## How it was tested
- Criterion → test: counts → `ai section flows, pills and lists have the reference counts, in order`; link → `the PureContext link points to the repo and opens in a new tab`; heading order → `ai section headings go h2 → h3 → h4 and axe finds no heading-order issue`; visual → column counts and computed styles at 1440 and 390, plus the 900/901 flip; `#ai` target → pending-target loop in `smoke.spec.ts`.
- Edge cases: the schema rejects http, `javascript:`, relative, hash and empty URLs; no overflow at 390; the new-tab note is clipped, not hidden.
- Gate: `npm run check` (0 errors, 0 warnings, 13 unit tests), `npm run build` (no warnings), `npm test` (61 passed). No coverage tool exists in this repo.
- Cloudflare "Workers Builds" check fails on this PR and also on #19 and #20. That failure existed before this change.
