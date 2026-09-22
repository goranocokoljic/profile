# Application site — Lead Web Engineer

This is my application for a Lead Web Engineer role, built as software: a
one-page portfolio (platform engineering, AI engineering, VisMedic) plus a
`/build` page that shows how the site itself was made. Every change is one
GitHub issue, implemented, reviewed and merged autonomously by **tr-harness**.

`issue → branch → implement → build & test → PR → multi-lens review → fix → merge → record`

Five recent runs (latest attempt per issue), rendered from
`data/build/site/tasks.jsonl` by `npm run readme:runs`. A unit test checks
every row against that file; `/build` always has the full, current record.

<!-- run-table:start -->
| Issue | Outcome | Review cycles | Findings | Billed | Wall time |
| --- | --- | ---: | ---: | ---: | ---: |
| [#13 `record-run` script and telemetry commit contract](https://github.com/goranocokoljic/profile/issues/13) | ok | 1 | 27 | $6.65 | 15m |
| [#12 Homepage build-record card (React island)](https://github.com/goranocokoljic/profile/issues/12) | ok | 1 | 44 | $10.50 | 33m |
| [#11 `/build` page](https://github.com/goranocokoljic/profile/issues/11) | ok | 1 | 22 | $3.71 | 8m |
| [#10 Port the dashboard renderer with a dataset toggle](https://github.com/goranocokoljic/profile/issues/10) | ok | 1 | 33 | $8.93 | 23m |
| [#9 Build-record data: exporter, payload schema and frozen snapshot](https://github.com/goranocokoljic/profile/issues/9) | ok | 1 | 26 | $6.29 | 12m |
<!-- run-table:end -->

- Build record: [`/build`](https://go-profile.goran-ocokoljic.workers.dev/build) —
  every run's duration, billed cost, review cycles and findings, for this repo
  and, as a frozen comparison, for the 170+ runs tr-harness did on my previous
  project
- Harness manual: [`docs/tr-harness.md`](docs/tr-harness.md)
- Related: [PureContext](https://github.com/goranocokoljic/pure-context), the MCP
  server that gives the agents compact code context and a change-safety loop

Commits authored by *tr-harness telemetry* are automated records of runs, not
code changes. The contract is in [`docs/telemetry.md`](docs/telemetry.md).

The human part is the intent: the content, the design reference, `CLAUDE.md`
and the issues themselves. Everything else is in the PRs, with the review
threads left as they happened.

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
npm run readme:runs  # refresh the run table above from data/build/site/tasks.jsonl
```

## About the numbers on `/build`

`billed_cost_usd` per run is the authoritative figure. Per-phase and per-cycle
costs are estimates apportioned from the run total and are labelled as such.
Durations and findings counts are measured.
