# Issue #2 — Typed content layer ported from the reference `content.js`

- **PR:** #16 — https://github.com/goranocokoljic/profile/pull/16
- **Branch:** feature/issue-2-typed-content-layer
- **Merged to:** develop on 2026-09-22
- **Review:** 3 cycle(s) · 4 blocker(s) fixed · 11 medium/low finding(s) deferred
- **Status:** merged

## What was built
- A strict zod schema (`SiteSchema`) that mirrors every key of `siteCopy`, including arrays and tuples. A missing, misspelt or empty key fails the parse and names its path.
- `src/data/site.ts` holds the copy verbatim from `content.js`, plus a small `pages` block for page titles and the `/build` empty state.
- Both pages now read every string from `site`; the homepage `h1` is `hero.headlineStart` + `hero.headlineEmphasis`.
- Browserless unit tests (`npm run test:unit`, now the last step of `npm run check`), including a best-effort guard that fails when copy appears in `src/pages` or `src/components`.
- New dependency: `zod` (allowed by the issue).

## Acceptance criteria
- [x] Deleting one key in `site.ts` makes `npm run check` fail with a readable zod error naming the path (`→ at hero.eyebrow`). Demonstrated and reverted.
- [x] No content string under `src/components` or `src/pages` (guard test; proven by restoring the old pages, which it flags).
- [x] `npm run check` / `build` / `test` green.

## Key files changed
- `src/data/site.schema.ts` — the strict schema; `href` must be `#id`.
- `src/data/site.ts` — the copy, parsed at import.
- `src/data/site.test.ts` — parse, verbatim match against `content.js`, non-empty strings, hrefs, readable path errors.
- `src/data/no-inline-copy.test.ts` — copy guard for pages and components, with self-tests both ways.
- `playwright.unit.config.ts`, `package.json` — `test:unit` wired into `check`.
- `src/pages/index.astro`, `src/pages/build.astro`, `tests/smoke.spec.ts` — strings from `site`; h1 smoke assertion.

## Review outcome
- **Blockers fixed:** cycle 1 — copy guard flagged multi-class attributes (SO-1/OR-1/TST-2) and missed real copy such as the removed page title (TST-1). Cycle 2 — `.ts` files scanned as Astro templates (TST-1); nested braces in attributes broke the tag scan (TST-2).
- **Also fixed:** guard hang on an unterminated attribute (cycle 3 SEC-1), `set:text`/`set:html` scanned, cwd-independent paths, expression literals scanned.
- **Deferred (non-blocking):** home for HTML-only reference copy (SO-1/TST-3 → issue #17), single-word literal false negatives (TST-1), guard trim (OR-1), and 8 Low items. Listed in the PR comment.
- **Unresolved blockers:** none.
- Parking lot not written: `dev-docs/` is read-only per CLAUDE.md; the PR comment holds the list.
- Full reviews: `reviews/issue-2-multi-pass-*.md`

## How it was tested
- Criterion → test mapping is in the PR test plan.
- Edge cases: unknown key, empty string, bad href, missing key, non-zod error passthrough, unterminated attribute, text beside expressions, ternary literals, SVG/meta/entities not flagged.
- Coverage: the repo has no coverage tool (`test:coverage` does not exist; adding one needs a dependency). Every new module has direct tests.
- Manual: deletion demo (`npm run check` exit 1 with `→ at hero.eyebrow`); guard run against the pre-change pages flags all five hard-coded strings.
