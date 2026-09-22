# Issue #1 — Scaffold Astro project with tokens, layout and CI gate

- **PR:** #15 — https://github.com/goranocokoljic/profile/pull/15
- **Branch:** feat/issue-1-scaffold-astro
- **Merged to:** develop on 2026-09-22
- **Review:** 1 cycle · 0 blockers fixed · 4 medium fixed · 14 low deferred
- **Status:** merged

## What was built
- An Astro 5 static site at the repo root, with strict TypeScript and SCSS.
- `src/styles/tokens.scss` holds all 12 reference custom properties, plus SCSS breakpoints, gutters, spacing, radii and the type scale. `global.scss` holds the reset and base type.
- `Base.astro` layout (`viewport-fit=cover`, safe-area padding, light only), plus placeholder `/` and `/build` pages.
- `check` (astro check, tsc, eslint, stylelint) and `test` (Playwright against `astro preview`), plus a GitHub Actions CI gate.

## Acceptance criteria
- [x] `npm ci && npm run check && npm run build && npm run test` pass locally and in CI.
- [x] `dist/index.html` and `dist/build/index.html` exist and contain no `<script src="http`.
- [x] The tokens file contains every `--*` property from the reference, proven by test and grep diff.
- [x] Lockfile committed. `node_modules`, `dist`, `.astro`, `dev-cycle-logs/` are ignored.

## Key files changed
- `astro.config.mjs`: static output, site URL, `inlineStylesheets: 'never'` for the CSP rule.
- `src/styles/tokens.scss`, `src/styles/global.scss`: tokens and base styles ported from the reference.
- `src/layouts/Base.astro`, `src/pages/*.astro`: layout and placeholder pages.
- `tests/*.spec.ts`, `playwright.config.ts`: smoke, dist and token-parity tests.
- `.github/workflows/ci.yml`: CI on PR and on push to develop.
- `wrangler.jsonc`: Worker name changed to `go-profile`, to match the Cloudflare service.

## Review outcome
- **Blockers fixed:** none (no Critical/High findings).
- **Medium fixed:**
  - SEC-1: inline CSS vs CSP.
  - TST-1: runtime token check.
  - TST-2/SO-1: Playwright no longer reuses a running server.
  - OR-1: redundant ESLint parser block removed.
- **Deferred (non-blocking):** SEC-2, SEC-3/TST-4/SO-4, SEC-4, SO-3, SEC-5/TST-5/OR-7, TST-3, TST-6, OR-2/SO-2, OR-3, OR-4/SO-5, OR-5, OR-6, SO-6, TST-2 remainder (stale dist locally). Listed on PR #15.
- **Unresolved blockers:** none.
- **Open outside the repo:** the Cloudflare `Workers Builds: go-profile` check fails. Its log is only in the Cloudflare dashboard.
- Full reviews: `reviews/issue-1-multi-pass-*.md`

## How it was tested
- One h1, status 200 and no console errors on `/` and `/build`: `tests/smoke.spec.ts`.
- `/build` empty state and `viewport-fit=cover` meta: `tests/smoke.spec.ts`.
- Tokens reach the page at runtime (`--teal`): `tests/smoke.spec.ts`.
- dist files exist, with no external script or link and no inline style or script: `tests/dist.spec.ts`.
- Token parity, name and value: `tests/tokens.spec.ts`. Checked that it fails when `--lime` is removed.
- 10 Playwright tests pass. No unit runner or coverage tool exists in this project. The CLAUDE.md gate is check, build and test.
