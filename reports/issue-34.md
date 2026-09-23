# Issue #34 — Copy and typography: balanced hero, one framework mention, drop the AI flow list

- **PR:** #37 — https://github.com/goranocokoljic/profile/pull/37
- **Branch:** feat/issue-34-hero-balance-ai-flow
- **Merged to:** develop on 2026-09-23
- **Review:** 1 cycle (focused: SEC, TST) · 0 blockers · 1 medium fixed · 5 low deferred
- **Status:** merged

## What was built
- The hero `h1` uses `text-wrap: balance`. At 1280/1440/1680px "on." no longer sits alone on the last line (before: 2/3/1 words per line in the emphasis span).
- The hero supporting paragraph uses `text-wrap: pretty`.
- The nine-step `ol.flow-stack` is gone from the AI section, with its styles. The heading and body above it stay, in the reference's two-column grid.
- `ai.devFlow` stays in `site.ts` and the schema as unrendered data (the verbatim content test needs it). The schema has a comment that says so.
- The copy changes (role-fit 01, platform callout) were already in develop from the human commit a71e86f.

## Acceptance criteria
- [x] One "React" (as "React Router") and one "Astro" in homepage body text outside the build story.
- [x] "never the hard part" is not in `dist/`.
- [x] No single-word last line in the hero `h1` at 1280, 1440 and 1680px.
- [x] Visual diff changes only in the hero and the AI section. Role-fit and platform baselines were not stale.
- [x] `npm run check`, `npm run build`, `npm run test` green (189 tests).

## Key files changed
- `src/components/Hero.astro` — `text-wrap: balance` on h1, `pretty` on the support paragraph.
- `src/components/AiEngineering.astro` — flow list markup and `.flow-stack`/`.flow-step` styles removed.
- `src/data/site.schema.ts` — comment: `devFlow` is unrendered since #34.
- `tests/copy.spec.ts` (new) — framework word count, hero line measurement at three widths.
- `tests/dist.spec.ts` — the phrase is absent from every text file in `dist/`.
- `tests/ai.spec.ts` — asserts the flow list is gone.
- `tests/__screenshots__/polish.spec.ts/home-light-*` — win32 and linux baselines refreshed.

## Review outcome
- **Blockers fixed:** none (none found).
- **Fixed anyway:** TST-1 (Medium; the word counter now joins text nodes with a space, with a realistic-markup self-test), SEC-3 (regex escape), SEC-2 (typed `readdirSync`).
- **Deferred (non-blocking):** SEC-1, TST-2, TST-3, TST-4, TST-5 (all Low). They are listed in the PR comment.
- **Unresolved blockers:** none.
- Full reviews: `reviews/issue-34-multi-pass-*.md`

## How it was tested
- Framework count → `tests/copy.spec.ts` "names React once and Astro once" + counter self-test (adjacent `<li>` fixture, build-story and script excluded).
- Phrase absent → `tests/dist.spec.ts` "never the hard part does not appear anywhere in dist/".
- Hero last line → `tests/copy.spec.ts` "at {1280,1440,1680}px no hero headline line ends on a single word". It measures DOM ranges and checks the word total. It fails when `text-wrap: wrap` is forced (checked by hand).
- Visual criterion → baselines on develop matched at 390/1024/1440 (768 "below" was already 1px off). After the change, a row-by-row diff of old and new "above" shots: the first changes are in the hero, the next in `.ai-dev-grid`. Role-fit, work, platform and the AI intro have no changes. Below the removed list there are only thin anti-aliasing bands from a sub-pixel shift. The same shift rewrote three "below" shots (±1px height).
- Coverage: the repo has no `test:coverage` script, so line coverage was not measured.
- CI: the PR was merged while its `gate` check was pending. CI on develop after the merge (run 35917402823) is green: 189 tests, including the Linux baselines. The develop run before this change (#33) was red on the 1024px homepage baseline; the refreshed baselines fix that.
