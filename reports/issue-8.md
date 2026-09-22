# Issue #8 — Background and contact sections

- **PR:** #23 — https://github.com/goranocokoljic/profile/pull/23
- **Branch:** feature/issue-8-background-contact
- **Merged to:** develop on 2026-09-22
- **Review:** 1 cycle(s) · 0 blocker(s) fixed · 6 medium finding(s) deferred
- **Status:** merged

## What was built
- The homepage now has `#about` (Background): an eyebrow, an h2, a paragraph and a CV line, in one column at most 820px wide and centred.
- The homepage now has `#contact`: a dark band with the headline, supporting text, a CV link, GitHub / PureContext / LinkedIn (new tab, `rel="noopener"`, and a hidden "(opens in a new tab)"), a `mailto:` email and the location. The existing footer continues the band.
- The dark band colours are now `--dark-*` custom properties in `tokens.scss`. The footer uses them too.
- The header link "How this was built" now goes to `/build`, as planned in #12. Every nav link resolves.
- The homepage now matches the reference except for the build-story / build-record section (#12).

## Acceptance criteria
- [x] Visual match; dark band tokens come from `tokens.scss`, no hardcoded hex.
- [x] All nav anchors (`#work #build #about #contact`) resolve; the #4 assertion is fully live.
- [x] Homepage complete relative to the reference except the build-record card (#12). A full-page screenshot at 1440px is in `docs/screenshots/issue-8/home-1440.jpg` and in the PR.

## Key files changed
- `src/components/Background.astro`, `src/components/Contact.astro` — the two new sections.
- `src/styles/tokens.scss` — the dark band tokens. `src/styles/global.scss` — the shared `.section-title`.
- `src/data/site.ts`, `site.schema.ts` — `githubHref`, `linkedinHref`, `backgroundCvLink`; `contact.email` is now checked as an email.
- `src/components/Header.astro` — the nav build link goes to `/build`. `src/components/Footer.astro` — hex values replaced with tokens.
- `src/pages/index.astro` — mounts both sections before the footer.
- `tests/contact.spec.ts` (new), `tests/smoke.spec.ts` — the exact section list and the new nav href.

## Review outcome
- **Blockers fixed:** none. OR-1 (High) was rejected as intentional: #8 requires the nav anchors to resolve, and #12 says nav `#build` goes to `/build`.
- **Deferred (non-blocking):** DUP-1 (the `#fbfbf9` alt-band tint is not a token), OR-2 (`.section-title` vs scoped copies), OR-3 (overlapping link tests), TST-1 (no negative schema tests for the new hrefs and email), TST-2 (hex-guard scope and footer token colours), TST-3 (untested `:focus-visible`), plus 6 Low. The full list is in the PR comment.
- **Unresolved blockers:** none.
- Full reviews: `reviews/issue-8-multi-pass-*.md`

## How it was tested
- Visual match → computed-style tests at 1440 (padding, colours, heading size and letter-spacing, 820px centred column, 2-column grid) and at 390 (1 column, 42px contact h2, no overflow), the hover test, and the test that the footer sits flush in the dark band. The screenshots against the reference matched at both widths (`docs/screenshots/issue-8/`).
- No hex → a test that scans the Contact and Footer style blocks.
- Nav anchors → on `/` and `/build`, each nav link returns 200 and its `section[id]` exists. All in-page links resolve except the pending `#build` hero CTA (#12).
- Content → the copy, hrefs, target/rel, mailto and location match `site.ts`, and there are no dead links. axe passes on both sections.
- Gate: `npm run check` passed. `npm run build` passed with no warnings. `npm test` passed 83 of 83. CI `gate` passed. There is no coverage tool (`npm run test:coverage` is not defined). The Cloudflare "Workers Builds" check fails, as it did on earlier PRs.
