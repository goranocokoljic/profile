# Issue #41 — Hero: remove the .build-note-rule background that reads as a line under the button

- **PR:** #42 — https://github.com/goranocokoljic/profile/pull/42
- **Branch:** feature/issue-41-hero-build-note-rule
- **Merged to:** develop on 2026-09-24
- **Review:** 1 cycle (focused: SEC, TST) · 0 blockers fixed · 1 medium finding deferred (plus 6 low)
- **Status:** merged

## What was built
- The grey 34 × 1 px bar under the hero buttons is gone. `.build-note-rule` no longer has a `background`. The span and its `margin-bottom` stay, so the build note does not move.
- A new pixel test checks the band between the hero actions and the build-note text. Every row in the band must be page background, at `deviceScaleFactor` 1 and 1.25, light and dark, at 390, 768, 1024 and 1440 px.
- All homepage visual baselines were re-rendered for Windows, and for Linux in the CI container.
- The #39 "fixed before merge" dist test no longer trips on recorded issue titles. It was already failing on develop, because the build-record card shows #39's title.

## Acceptance criteria
- [x] No visible line between the hero buttons and the build note at 390, 768, 1024 and 1440 px, light and dark. The new assertion passes at both scale factors.
- [x] The build note's position is unchanged. The top is 864 / 804 / 888 / 868 px, before and after.
- [x] `npm run check`, `npm run build` and `npm run test` are green: 220 tests passed, and CI `gate` passed.

## Key files changed
- `src/components/Hero.astro`: removed one declaration, `background: #8f999b`.
- `tests/polish.spec.ts`: added the band pixel test (16 cases). The band starts at the lowest hero action, including the link underline, because at 390 and 1024 px the actions wrap below the primary button.
- `tests/dist.spec.ts`: removes recorded issue titles before the "fixed before merge" check, and adds a self-test for that filter.
- `tests/__screenshots__/polish.spec.ts/home-light-*`: refreshed baselines. `390-above` was already stale from the role-fit copy change. `768-below` and `1440-below` were already failing on develop from a sub-pixel shift.

## Review outcome
- **Blockers fixed:** none
- **Deferred (non-blocking):** TST-1 (medium: no automated geometry guard for the note's position). SEC-1 (the title exemption comes from data, not pinned to #39). SEC-2. SEC-3/TST-2. TST-3. TST-4. SEC-4/TST-5. All are listed in a PR comment.
- **Unresolved blockers:** none
- Full reviews: `reviews/issue-41-multi-pass-*.md`

## How it was tested
- **No line:** the new band test fails in all 16 cases with the grey background put back, and passes in all 16 without it.
- **Position unchanged:** measured with a throwaway Playwright script before and after the change. The values are identical.
- **Coverage:** this repo has no `test:coverage` script. The changed source is one CSS declaration.
