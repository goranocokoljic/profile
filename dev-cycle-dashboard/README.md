# Dev-cycle dashboard

Live-served visual dashboard for harness run analytics. Standalone — no
dependencies, no build step, nothing imported from the toprope app.

## Run

```
node dev-cycle-dashboard/server.mjs
```

Then open http://localhost:8090.

Options:

| Flag / env | Default | Meaning |
|---|---|---|
| `--port` / `TR_DASHBOARD_PORT` | `8090` | HTTP port |
| `--data` / `TR_ANALYTICS_DIR` | `../dev-cycle-analytics` (relative to this folder) | Analytics JSONL directory |

## What it shows

- **KPI row** — runs, success rate, billed cost, wall time, median cost/run, findings caught
- **Billed cost per day** — column chart (uses `billed_cost_usd` only; phase `est_cost_usd` is never summed as truth)
- **Cycle-1 findings trend** — findings on the first review pass per run + rolling average; falling = the review KB is paying off
- **Where the time goes** — median duration per phase + average estimated-cost share
- **Findings by severity per day** — stacked columns, darker = more severe
- **Runs table** — sortable; click a row to expand per-phase timing, turns, tool calls, peak context, and review-cycle detail
- **Epics** and the **review-lessons KB** registry

Data is re-read from the JSONL files on every request; the page also polls
every 30 s and re-renders when the files change. Every chart has a table-view
twin (the `table` toggle on each card). Light and dark theme follow the OS.
