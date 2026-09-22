// The numbers behind every view, split out of the reference script's render
// functions so they can be unit-tested against the reference. Pure: no DOM.

import { dayKey, median } from './format';
import type { Epic, Findings, PhaseName, Task } from './types';

export type Period = 'all' | '90' | '30' | '7';
export type OutcomeFilter = 'all' | 'ok' | 'problems';

export type Dated<T> = T & { date: Date };
export type TaskRow = Dated<Task>;

export const PHASE_ORDER: PhaseName[] = ['read', 'branch', 'implement', 'build+test', 'pr', 'review', 'merge'];
export const SEVERITIES: (keyof Findings)[] = ['critical', 'high', 'medium', 'low', 'style'];

function cutoffFor(period: Period, now: Date): Date | null {
  if (period === 'all') return null;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - Number(period));
  return cutoff;
}

export function filterTasks(tasks: Task[], period: Period, outcome: OutcomeFilter, now = new Date()): TaskRow[] {
  const cutoff = cutoffFor(period, now);
  return tasks
    .map((t) => ({ ...t, date: new Date(t.ts) }))
    .filter((t) => {
      if (cutoff && t.date < cutoff) return false;
      if (outcome === 'ok' && t.outcome !== 'ok') return false;
      if (outcome === 'problems' && t.outcome === 'ok') return false;
      return true;
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function filterEpics(epics: Epic[], period: Period, now = new Date()): Dated<Epic>[] {
  const cutoff = cutoffFor(period, now);
  return epics
    .map((e) => ({ ...e, date: new Date(e.ts) }))
    .filter((e) => !cutoff || e.date >= cutoff)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function findingsSum(f: Findings | null | undefined): number {
  return f ? SEVERITIES.reduce((a, k) => a + (f[k] || 0), 0) : 0;
}

export interface Kpis {
  runs: number;
  ok: number;
  incomplete: number;
  failed: number;
  cost: number;
  wall: number;
  medCost: number | null;
  findings: number;
}

export function computeKpis(tasks: Task[]): Kpis {
  const ok = tasks.filter((t) => t.outcome === 'ok');
  return {
    runs: tasks.length,
    ok: ok.length,
    incomplete: tasks.filter((t) => t.outcome === 'incomplete').length,
    failed: tasks.filter((t) => t.outcome === 'failed').length,
    cost: tasks.reduce((a, t) => a + (t.billed_cost_usd || 0), 0),
    wall: tasks.reduce((a, t) => a + (t.total_sec || 0), 0),
    medCost: median(ok.map((t) => t.billed_cost_usd).filter((v) => v != null)),
    findings: tasks.reduce((a, t) => a + findingsSum(t.review?.findings_total), 0),
  };
}

/* ---------------------------------------------------- daily grouping */
export function groupByDay(tasks: TaskRow[]): Map<string, TaskRow[]> {
  const map = new Map<string, TaskRow[]>();
  for (const t of tasks) {
    const k = dayKey(t.date);
    const list = map.get(k);
    if (list) list.push(t);
    else map.set(k, [t]);
  }
  return map;
}

/** Every calendar day from the first to the last task, gaps included. Tasks sorted by date. */
export function dayRange(tasks: TaskRow[]): Date[] {
  if (!tasks.length) return [];
  const first = tasks[0].date;
  const last = tasks[tasks.length - 1].date;
  const days: Date[] = [];
  const d = new Date(first.getFullYear(), first.getMonth(), first.getDate());
  const end = new Date(last.getFullYear(), last.getMonth(), last.getDate());
  while (d <= end) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export interface CostDay {
  date: Date;
  value: number;
  runs: number;
  issues: string[];
}

export function costByDay(tasks: TaskRow[]): CostDay[] {
  const byDay = groupByDay(tasks);
  return dayRange(tasks).map((date) => {
    const g = byDay.get(dayKey(date)) ?? [];
    return {
      date,
      value: g.reduce((a, t) => a + (t.billed_cost_usd || 0), 0),
      runs: g.length,
      issues: g.map((t) => '#' + t.issue),
    };
  });
}

export interface SevDay {
  date: Date;
  sums: Findings;
  total: number;
}

export function severityByDay(tasks: TaskRow[]): SevDay[] {
  const byDay = groupByDay(tasks);
  return dayRange(tasks).map((date) => {
    const sums: Findings = { critical: 0, high: 0, medium: 0, low: 0, style: 0 };
    for (const t of byDay.get(dayKey(date)) ?? []) {
      const f = t.review?.findings_total;
      if (f) for (const k of SEVERITIES) sums[k] += f[k] || 0;
    }
    return { date, sums, total: findingsSum(sums) };
  });
}

export interface PhaseStat {
  name: PhaseName;
  median: number | null;
  total: number;
  /** Average share of estimated cost, normalised so all phases sum to 1. */
  share: number;
}

export function phaseStats(tasks: Task[]): PhaseStat[] {
  const perPhase = PHASE_ORDER.map((name) => {
    const durs: number[] = [];
    const estShares: number[] = [];
    for (const t of tasks) {
      if (!Array.isArray(t.phases)) continue;
      const p = t.phases.find((x) => x.phase === name);
      if (p && p.duration_sec != null) durs.push(p.duration_sec);
      const totalEst = t.phases.reduce((a, x) => a + (x.est_cost_usd || 0), 0);
      if (p && totalEst > 0) estShares.push((p.est_cost_usd || 0) / totalEst);
    }
    return {
      name,
      median: median(durs),
      total: durs.reduce((a, b) => a + b, 0),
      share: estShares.length ? estShares.reduce((a, b) => a + b, 0) / estShares.length : 0,
    };
  });
  const shareSum = perPhase.reduce((a, p) => a + p.share, 0) || 1;
  for (const p of perPhase) p.share = p.share / shareSum;
  return perPhase;
}

export const TREND_WINDOW = 5;

export interface TrendPoint {
  date: Date;
  issue: number;
  v: number;
  roll: number;
}

export function cycleOneTrend(tasks: TaskRow[]): TrendPoint[] {
  const pts: TrendPoint[] = [];
  for (const t of tasks) {
    const c1 = Array.isArray(t.review_cycles) ? t.review_cycles.find((c) => c.review_cycle === 1) : null;
    if (c1 && c1.findings) pts.push({ date: t.date, issue: t.issue, v: c1.findings.total || 0, roll: 0 });
  }
  pts.forEach((p, i) => {
    const slice = pts.slice(Math.max(0, i - TREND_WINDOW + 1), i + 1);
    p.roll = slice.reduce((a, q) => a + q.v, 0) / slice.length;
  });
  return pts;
}
