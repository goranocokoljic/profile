# Issue #30 — Open Graph share tags and a 1200×630 portrait share image

- **PR:** #32 — https://github.com/goranocokoljic/profile/pull/32
- **Branch:** feat/issue-30-og-share-tags
- **Merged to:** develop on 2026-09-23
- **Review:** 1 cycle · 0 blockers fixed · 4 medium findings deferred
- **Status:** merged

## What was built
- Every page now has `og:*`, `twitter:*` and `<link rel="canonical">` tags with absolute URLs built from `site` in astro.config.mjs.
- A 1200×630 JPEG share image (61 kB, quality 80) is generated at build time from `src/assets/goran-hero.jpg` with `getImage`. The source photo is already greyscale, so no extra step or dependency was needed.
- `Base.astro` now requires `description` and accepts an optional `image` override.
- `site.ts` has the three new strings from the issue: `pages.home.description`, `pages.build.description`, `pages.shareImageAlt`.

## Acceptance criteria
- [x] `og:image` is one absolute JPEG URL; the file is the portrait cropped to 1200×630 (checked by eye).
- [ ] Viber / WhatsApp / LinkedIn preview — not verified: no preview debugger access from the run, and the change was not deployed yet.
- [x] No external requests, no new dependency, homepage still has one island.
- [x] `npm run check` and `npm run build` green (0 build warnings). `npm run test` green except 2 screenshot tests that already fail on develop (see below).

## Key files changed
- `src/layouts/Base.astro` — share tags, canonical, build-time share image.
- `src/data/site.ts`, `src/data/site.schema.ts` — the three new strings and schema fields.
- `src/pages/index.astro`, `src/pages/build.astro` — pass `description` to `Base`.
- `tests/share.spec.ts` — new dist checks for every share tag and the JPEG size.
- `tests/dist.spec.ts` — the "no external link" check skips `rel="canonical"`.

## Review outcome
- **Blockers fixed:** none (none found).
- **Deferred (non-blocking):** SO-1 centre crop cuts head top and chin; TST-1 no fixture test for the loosened dist regex; OR-2 optional JPEG helper self-test; 11 Low items (see PR comment).
- **Rejected as intentional:** OR-1 twitter:title/description/image and SO-4/TST-4 `image` prop — both asked for by the issue.
- **Unresolved blockers:** none.
- Full reviews: `reviews/issue-30-multi-pass-*.md`

## How it was tested
- `tests/share.spec.ts`, for `/` and `/build`: one `og:image`, absolute, under `site`; file exists in `dist/` and is a 1200×630 JPEG (SOF header parse); `og:title` = `twitter:title` = `<title>`; descriptions equal `site.ts`; `twitter:card` = `summary_large_image`; `og:url` = canonical = `new URL(path, site)`; `og:image:alt`, width, height.
- Unit test for the JPEG reader: valid frame, WebP header, truncated JPEG.
- Existing tests still cover one island and no network requests.
- Coverage: the repo has no `test:coverage` script; coverage is the criterion → test mapping above.
- Pre-existing failure: `tests/polish.spec.ts` home "below" screenshots (390/768px locally, 390/1024px in CI) fail on develop since 54e1477. The clip starts at the build-record card's bottom, which moves by 1px when a new run is recorded.
