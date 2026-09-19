# Genki application — Lead Web Engineer

This is my application for the Lead Web Engineer role at Genki, built as software.
The site is a one-page portfolio (platform engineering, AI engineering, VisMedic)
plus a `/build` page that shows how the site itself was made.

Every change to this repository is one GitHub issue, implemented autonomously by
**tr-harness**: read issue → branch → implement → build & test → open PR →
independent multi-lens review → fix → verify state → merge. The human part is the
intent: the content, the design reference, `CLAUDE.md` and the issues themselves.
Everything else is in the PRs, with the review threads left as they happened.

- Live site: _(Cloudflare Pages URL after the first merge)_
- Build record: `/build` — every run's duration, billed cost, review cycles and
  findings, for this repo and, as a frozen comparison, for the 170+ runs tr-harness
  did on my previous project
- Harness manual: [`docs/tr-harness.md`](docs/tr-harness.md)
- Related: [PureContext](https://github.com/goranocokoljic/pure-context), the MCP
  server that gives the agents compact code context and a change-safety loop

## Layout

```
src/                  Astro site (static), one React island for the build-record card
scripts/              export-build-data.mjs (JSONL → payload), record-run.mjs (telemetry commit)
data/build/site/      analytics for this repository's runs — committed, grows per run
data/build/toprope/   frozen tr-harness track record from another project — read-only
design-reference/     the approved prototype and the dashboard this site re-implements
dev-docs/             review rules the agents import
docs/                 tr-harness manual, telemetry contract
tr-harness.ps1        the runner (human-owned; agents never edit it)
```

## Running locally

```
npm ci
npm run dev        # site with live reload
npm run check      # astro check, tsc, eslint, stylelint
npm run test       # Playwright smoke tests
npm run build      # prebuild exports data/build/**/*.jsonl → public/build/data.json
```

## About the numbers on `/build`

`billed_cost_usd` per run is the authoritative figure. Per-phase and per-cycle
costs are estimates apportioned from the run total and are labelled as such.
Durations and findings counts are measured. Commits authored by *tr-harness
telemetry* are automated records of runs, not code changes.

## Status

Repository skeleton committed by hand. Tasks #1–#14 are queued for tr-harness;
this README's first screen will show a real run record once the queue has run.
