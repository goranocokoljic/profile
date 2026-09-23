# Issue #14 — Responsive, accessibility and performance pass; README first screen

- **PR:** #31 — https://github.com/goranocokoljic/profile/pull/31
- **Branch:** feature/issue-14-responsive-a11y-perf-pass
- **Merged to:** develop on 2026-09-23
- **Review:** 3 cycle(s) · 4 blocker(s) fixed · 1 rejected with a measured constraint · Medium/Low findings deferred (PR #31 comment)
- **Status:** merged

## What was built
- **Hero buttons.** At 125% and 150% display scaling, the hero buttons had a light strip along one edge. Now they sit on whole screen pixels at those scales.
  - The hero column sits on a 4px grid: rounded line heights and a 48px button.
  - A pixel test at deviceScaleFactor 1.25 and 1.5 checks the button edges.
- **Teal text contrast.** Teal text now passes AA contrast. It uses the new token `--teal-text` (#0C7C72). Fills and rules keep `--teal`.
  - axe finds no serious or critical issue on `/` or `/build`, in light or dark, at 390 or 1440.
  - The old axe exclusions are gone.
- **Touch targets.** Every control has a 44px hit area on touch screens. The page looks the same with a mouse.
  - Links get a transparent overlay (`touch-target`).
  - Buttons grow (`touch-size`).
- **Visual baselines.** There are baselines for `/` and `/build` at 390, 768, 1024 and 1440, one set for Windows and one for Linux.
  - CI now runs in the Playwright container that renders the Linux set, so CI compares them.
  - `npm run test:baselines:linux` refreshes the Linux set.
- **README first screen.** It has a run table generated from `data/build/site/tasks.jsonl`: #13 to #9, each attempt 1.
  - `npm run readme:runs` writes the table. A unit test checks every row against the data.

## Acceptance criteria
- [x] All previous smoke tests plus the new visual baselines are green: 177/177 on Windows and in the Linux CI container.
- [x] The README run table is generated from real data, not typed. It shows issues #13, #12, #11, #10 and #9.
- [x] The PR description lists every visual defect found and fixed, with before/after. Images: `docs/screenshots/issue-14/`.

## Key files changed
- `src/components/Hero.astro`: the 4px grid for the hero column and the 48px buttons.
- `src/styles/tokens.scss`: the `--teal-text` token and the `touch-target` / `touch-size` mixins.
- Components and `global.scss`: teal text uses `--teal-text`, and controls use the mixins.
- `src/build/charts.ts`: table scrollers can take keyboard focus.
- `src/build/readme.ts`, `scripts/readme-run-table.mjs`, `scripts/pick-task.mjs`: the README table. The rule that picks one run record is now shared with `record-run`.
- `tests/polish.spec.ts`: the layout, screenshot, touch, axe, page weight, font and DPR-edge tests.
- `scripts/linux-baselines.mjs`, `.github/workflows/ci.yml`: the Linux baselines, and CI running in the Playwright image.

## Review outcome
- **Blockers fixed:**
  - Cycle 1:
    - Dark baselines were identical to light, so `/build` is now shot on frozen data.
    - Screenshot tests passed silently off Windows; they now report as skipped.
  - Cycle 2:
    - Homepage baselines would break when the run card changed height; the page is now shot above and below the card.
    - CI never compared baselines; there are now Linux baselines, with CI in the same image.
  - Cycle 3: two different "latest attempt" rules; there is now one shared `pickTask`.
- **Rejected:** "the header CV edge check cannot fail" (cycles 1 and 2). The header's 1px rule is 1.25 or 1.5 screen pixels at those scales, so no layout can make it sharp. I measured this. The check is kept as the issue asked.
- **Deferred (non-blocking):** listed in the PR #31 comment. The main ones:
  - no baseline for the island
  - timezone-dependent win32 `/build` cells
  - no touch test above 900px
  - the README table goes stale with no refresh path
- **Unresolved blockers:** none.
- Full reviews: `reviews/issue-14-multi-pass-*.md`

## How it was tested
- **Hero edges:**
  - `polish.spec.ts` › deviceScaleFactor 1.25/1.5 at 1440, 1024 and 390.
  - It checks that the box sits on whole device pixels, and that the edge rows equal the fill or border colour.
  - The old build fails it: rgb(188,217,212) against rgb(13,128,117).
- **axe:** 8 full-page runs, plus the section tests, now with contrast checks on.
- **Touch:** `elementFromPoint` probes ±21px from the centre at 390 and 768 with a touch pointer, plus a layout check.
- **Weight:** a cold load of `/` is about 193 KB with every image loaded, against a 1 MB budget. System fonts only, with no font requests.
- **README:**
  - `readme.test.ts` checks the committed table against `tasks.jsonl`, plus the escaping, retries, broken `ts` and CRLF cases.
  - `readme-run-table.test.mjs` checks the file I/O: bad lines, an empty file, missing markers.
- **Coverage:** the repo has no `test:coverage` script. Node coverage for the README script earlier in the run was 92–97%.
- **Gate:**
  - `npm run check`: 0 errors.
  - `npm run build`: 0 warnings.
  - CI gate: green in the container.
  - Cloudflare "Workers Builds": fails on every PR, as before.
