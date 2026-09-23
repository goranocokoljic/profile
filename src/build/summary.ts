// The homepage build-record card's numbers, computed at build time from the
// site dataset. Pure: no DOM, no file access. Totals come from computeKpis so
// the card and the /build KPI row cannot disagree.

import { computeKpis, findingsBreakdown } from './stats';
import type { Dataset, FindingsBreakdown, Outcome } from './types';

export const RECENT_RUNS = 5;

export interface LatestRun {
  issue: number;
  /** From meta.json; `null` when the issue has no recorded metadata. */
  title: string | null;
  url: string | null;
  pr: number | null;
  prUrl: string | null;
  outcome: Outcome;
  ts: string;
}

export interface RecentRun {
  issue: number;
  attempt: number;
  outcome: Outcome;
  /** Authoritative billed cost of the run. */
  billedUsd: number;
}

export interface BuildSummary {
  /** Distinct issues with at least one ok run. */
  tasksCompleted: number;
  /** Runs with outcome ok; the "N ok" on the /build Runs tile. */
  successfulRuns: number;
  findings: number;
  /** The findings KPI's sub-line, from the same per-task totals as `findings`. */
  breakdown: FindingsBreakdown;
  /** Findings the fixer fixed before merge; `null` when no cycle recorded dispositions. */
  fixed: number | null;
  wallSec: number;
  billedUsd: number;
  /** `null` when no run is recorded. */
  latest: LatestRun | null;
  /** Newest first, at most RECENT_RUNS. */
  recent: RecentRun[];
}

export function summarize(ds: Dataset): BuildSummary {
  const k = computeKpis(ds.tasks);
  // By instant, not by string: recorded timestamps carry different offsets.
  const newest = [...ds.tasks].sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
  const last = newest[0];
  const meta = last ? ds.meta?.[String(last.issue)] : undefined;
  return {
    tasksCompleted: new Set(ds.tasks.filter((t) => t.outcome === 'ok').map((t) => t.issue)).size,
    successfulRuns: k.ok,
    findings: k.findings,
    breakdown: findingsBreakdown(k.bySeverity),
    fixed: ds.summary.dispositions?.fixed ?? null,
    wallSec: k.wall,
    billedUsd: k.cost,
    latest: last
      ? {
          issue: last.issue,
          title: meta?.title ?? null,
          url: meta?.url ?? null,
          pr: meta?.pr ?? null,
          prUrl: meta?.prUrl ?? null,
          outcome: last.outcome,
          ts: last.ts,
        }
      : null,
    recent: newest.slice(0, RECENT_RUNS).map((t) => ({
      issue: t.issue,
      attempt: t.attempt,
      outcome: t.outcome,
      billedUsd: t.billed_cost_usd,
    })),
  };
}
