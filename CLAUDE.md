# CLAUDE.md — profile page

@dev-docs/review-rules.md

## What this repository is

A one-page application site for the Lead Web Engineer role, plus a
`/build` page that shows how the site itself was built. The site is developed
autonomously by tr-harness, one GitHub issue per run. The **content and design
are fixed**: `design-reference/site/` is the source of truth for what every
section looks like and says. Your job is to implement it well, not to redesign it.

## Stack (do not deviate without an issue that says so)

- Astro 5, static output (`output: 'static'`), TypeScript strict
- Styles: SCSS. Global tokens in `src/styles/tokens.scss` (ported from
  `design-reference/site/styles.css`). Component styles scoped in `.astro` files
  or `*.module.scss`. No Tailwind, no CSS-in-JS.
- Exactly **one** React island is allowed: the build-record card
  (`src/components/BuildRecord.tsx`). Everything else is `.astro`.
- `/build` dashboard renderer: vanilla TypeScript + inline SVG, ported from
  `design-reference/dashboard/index.html`. No chart library.
- Images through `astro:assets`.
- Package manager: npm. Node 22. Lockfile committed.
- No runtime network requests. No external scripts, fonts or styles. The site
  must work with a CSP of `default-src 'self'`.
- Deploy target: Cloudflare Pages, production branch `develop`, output `dist`.

## Repository layout

```
src/
  pages/index.astro, build.astro
  layouts/Base.astro
  components/<Section>.astro, BuildRecord.tsx
  data/site.ts                 typed content (zod schema in site.schema.ts)
  build/                       dashboard renderer + payload types
  styles/tokens.scss, global.scss
scripts/
  export-build-data.mjs        JSONL -> public/build/data.json (runs in `prebuild`)
  record-run.mjs               appends a harness run to data/build/site/
data/build/site/               live analytics for this repo (COMMITTED)
data/build/toprope/            frozen tr-harness track record (never modified)
design-reference/              read-only reference, never imported at runtime
tests/                         Playwright smoke tests
```

## Definition of done for every issue

1. `npm run check` passes (astro check + tsc + eslint + stylelint).
2. `npm run build` passes with zero warnings that were not there before.
3. `npm run test` (Playwright) passes; if you added a section, you added a
   smoke assertion for it.
4. The section matches `design-reference/site/index.html` at 1440px and at 390px
   width. "Matches" means same structure, spacing rhythm, type scale and colour
   tokens; pixel-identical is not required, visibly different is a failure.
5. No new dependency unless the issue explicitly allows it. If you need one,
   stop and print `DEVCYCLE_FAIL: needs dependency <name> — <why>`.
6. The PR description states what was implemented, what you verified and how,
   and anything you deliberately left out.

## Conventions

- Content lives **only** in `src/data/site.ts`. Components never contain copy.
- Every section is its own component and its own issue; do not "fix" a
  neighbouring section while you're there — file a follow-up note in the PR.
- Accessibility baseline: semantic landmarks, one `h1`, headings in order,
  focus visible, all images with alt (decorative → `alt=""`), colour contrast
  AA, no motion that can't be turned off.
- Performance baseline: no client JS on the homepage except the build-record
  island; fonts self-hosted or system stack; images `loading="lazy"` below the fold.
- Commits: conventional commits. Branch: `feat/issue-<n>-<slug>`.
- Never modify `tr-harness.ps1`, anything under `.claude/`, `dev-docs/`,
  `design-reference/`, or `data/build/toprope/`.

## Build record data — what's real and what's estimated

`billed_cost_usd` per task is authoritative. `est_cost_usd` per phase/cycle is an
apportionment and must be labelled as an estimate everywhere it is shown. Cache
tokens are never summed. Durations and findings counts are measured. Keep the
same wording the reference dashboard uses in its footnotes.

## Tone for anything user-visible

Plain, specific, no marketing adjectives. Copy comes from `site.ts`; if a UI
string is needed that isn't there (an empty state, a table header), write it in
the same register: "No runs recorded yet." not "Coming soon!".
