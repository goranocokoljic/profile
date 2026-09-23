import { test, expect } from '@playwright/test';
import { datasetFromHash } from './dashboard';
import { fmtBreakdown, fmtCtx, fmtDateTime, fmtDur, fmtUsd, inkFor, median, niceTicks, shortModel } from './format';
import { runColumns, sortRuns } from './runs';
import {
  computeKpis,
  costByDay,
  cycleOneTrend,
  filterEpics,
  filterTasks,
  findingsBreakdown,
  phaseStats,
  severityByDay,
  type TaskRow,
} from './stats';
import type { Epic, Findings, Payload, Phase, Task } from './types';

// Pure parts of the dashboard. The browser tests compare the rendered page
// with the reference; these pin the edge cases the real data does not hit.

const phase = (name: Phase['phase'], duration_sec: number, est_cost_usd: number): Phase => ({
  phase: name, duration_sec, est_cost_usd, out_tokens: 0, in_tokens: 0, turns: 1, tool_calls: 1, peak_ctx_tokens: 1000,
});

function task(over: Partial<Task> = {}): Task {
  return {
    issue: 1, attempt: 1, ts: '2026-07-01T10:00:00Z', outcome: 'ok', model_asked: 'opus', model_ran: 'claude-opus-5-5',
    total_sec: 600, billed_cost_usd: 2, phases: [], review: null, review_cycles: [], ...over,
  };
}

const rows = (tasks: Task[]): TaskRow[] => filterTasks(tasks, 'all', 'all');

test('formatters match the reference output', () => {
  expect([fmtUsd(null), fmtUsd(NaN), fmtUsd(3.456), fmtUsd(123.4), fmtUsd(3731.2)]).toEqual(['—', '—', '$3.46', '$123', '$3,731']);
  expect([fmtDur(undefined), fmtDur(42.4), fmtDur(600), fmtDur(3600), fmtDur(588_480)]).toEqual(['—', '42s', '10m', '1h ', '163h 28m']);
  expect([fmtCtx(null), fmtCtx(68_497)]).toEqual(['—', '68k']);
  expect(fmtDateTime(new Date(2026, 6, 4, 9, 5))).toBe('Jul 4, 09:05');
  expect([shortModel('claude-opus-5-5'), shortModel(''), shortModel(null)]).toEqual(['opus-5-5', '—', '—']);
  expect([median([]), median([3, 1, 2]), median([4, 1, 3, 2])]).toEqual([null, 2, 2.5]);
  expect(niceTicks(0, 4)).toEqual([0, 1]);
  expect(niceTicks(370, 4)).toEqual([0, 100, 200, 300, 400]);
  expect([inkFor('#0d366b'), inkFor('#b7d3f6'), inkFor('teal')]).toEqual(['#ffffff', '#0b0b0b', '#ffffff']);
});

test('KPIs: empty input gives zeros and a null median', () => {
  expect(computeKpis([])).toEqual({ runs: 0, ok: 0, incomplete: 0, failed: 0, cost: 0, wall: 0, medCost: null, findings: 0,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0, style: 0 },
  });
});

test('KPIs: median is over ok runs only; findings sum every severity', () => {
  const findings = { critical: 1, high: 2, medium: 3, low: 4, style: 5 };
  const review = { cycles_run: 1, max_cycles: 3, total_review_sec: 0, total_fix_sec: 0, findings_total: findings };
  const k = computeKpis([
    task({ billed_cost_usd: 1, review }),
    task({ billed_cost_usd: 3 }),
    task({ billed_cost_usd: 100, outcome: 'failed', total_sec: 60 }),
    task({ billed_cost_usd: 5, outcome: 'incomplete' }),
  ]);
  expect(k).toEqual({ runs: 4, ok: 2, incomplete: 1, failed: 1, cost: 109, wall: 1860, medCost: 2, findings: 15, bySeverity: findings });
});

test('KPIs: severities sum per key across tasks and skip tasks with no review', () => {
  const review = (f: Findings): Task['review'] => ({ cycles_run: 1, max_cycles: 3, total_review_sec: 0, total_fix_sec: 0, findings_total: f });
  const k = computeKpis([
    task({ review: review({ critical: 1, high: 2, medium: 3, low: 4, style: 5 }) }),
    task({ review: null }),
    task({ review: review({ critical: 0, high: 10, medium: 0, low: 1, style: 2 }) }),
  ]);
  expect(k.bySeverity).toEqual({ critical: 1, high: 12, medium: 3, low: 5, style: 7 });
  expect(k.findings).toBe(28);
});

test('findings breakdown groups critical+high and low+style, and formats in that order', () => {
  const b = findingsBreakdown({ critical: 2, high: 12, medium: 114, low: 1340, style: 1 });
  expect(b).toEqual({ blocker: 14, medium: 114, low: 1341 });
  const copy = { blocker: 'blocker/high', medium: 'medium', low: 'low/style', fixed: 'fixed before merge' };
  expect(fmtBreakdown(b, copy)).toBe('14 blocker/high · 114 medium · 1,341 low/style');
  expect(fmtBreakdown(findingsBreakdown({ critical: 0, high: 0, medium: 0, low: 0, style: 0 }), copy)).toBe('0 blocker/high · 0 medium · 0 low/style');
});

test('filters: period cutoff, outcome buckets and date order', () => {
  const now = new Date('2026-07-31T12:00:00Z');
  const tasks = [
    task({ issue: 3, ts: '2026-07-30T00:00:00Z', outcome: 'failed' }),
    task({ issue: 1, ts: '2026-06-01T00:00:00Z' }),
    task({ issue: 2, ts: '2026-07-28T00:00:00Z', outcome: 'incomplete' }),
  ];
  expect(filterTasks(tasks, 'all', 'all', now).map((t) => t.issue)).toEqual([1, 2, 3]);
  expect(filterTasks(tasks, '7', 'all', now).map((t) => t.issue)).toEqual([2, 3]);
  expect(filterTasks(tasks, 'all', 'ok', now).map((t) => t.issue)).toEqual([1]);
  expect(filterTasks(tasks, 'all', 'problems', now).map((t) => t.issue)).toEqual([2, 3]);
  const epic = { ts: '2026-06-01T00:00:00Z' } as Epic;
  expect(filterEpics([epic], '30', now)).toEqual([]);
  expect(filterEpics([epic], 'all', now)).toHaveLength(1);
});

test('daily views fill zero-activity days between runs', () => {
  const tasks = rows([
    task({ issue: 1, ts: '2026-07-01T10:00:00', billed_cost_usd: 2 }),
    task({ issue: 2, ts: '2026-07-01T15:00:00', billed_cost_usd: 3 }),
    task({ issue: 3, ts: '2026-07-04T10:00:00', billed_cost_usd: 1 }),
  ]);
  const days = costByDay(tasks);
  expect(days.map((d) => [d.date.getDate(), d.runs, d.value])).toEqual([[1, 2, 5], [2, 0, 0], [3, 0, 0], [4, 1, 1]]);
  expect(days[0].issues).toEqual(['#1', '#2']);
  expect(severityByDay(tasks).map((d) => d.total)).toEqual([0, 0, 0, 0]);
  expect(costByDay([])).toEqual([]);
});

test('phase stats: median time and normalised est-cost share', () => {
  const tasks = [
    task({ phases: [phase('read', 10, 1), phase('review', 30, 3)] }),
    task({ phases: [phase('read', 20, 0), phase('review', 40, 0)] }),
  ];
  const stats = Object.fromEntries(phaseStats(tasks).map((p) => [p.name, p]));
  expect(stats.read).toMatchObject({ median: 15, total: 30, share: 0.25 });
  expect(stats.review).toMatchObject({ median: 35, total: 70, share: 0.75 });
  expect(stats.merge).toMatchObject({ median: null, total: 0, share: 0 });
});

test('cycle-1 trend skips runs without a first cycle and rolls over five runs', () => {
  const cycle = (total: number) => ({ review_cycle: 1, findings: { total } }) as Task['review_cycles'][number];
  const tasks = rows([1, 2, 3, 4, 5, 6].map((v, i) => task({ issue: i, ts: `2026-07-0${i + 1}T00:00:00Z`, review_cycles: [cycle(v)] })).concat(task({ ts: '2026-07-09T00:00:00Z' })));
  const pts = cycleOneTrend(tasks);
  expect(pts).toHaveLength(6);
  expect(pts.map((p) => p.roll)).toEqual([1, 1.5, 2, 2.5, 3, 4]);
});

test('runs: the PR column appears only with meta; sorting uses the PR number', () => {
  expect(runColumns(undefined).map((c) => c.label)).not.toContain('PR');
  const meta = { 1: { title: 'a', url: 'u1', pr: 20, prUrl: 'p' }, 2: { title: 'b', url: 'u2', pr: 10, prUrl: 'p' } };
  expect(runColumns(meta).map((c) => c.label).slice(0, 3)).toEqual(['', 'Issue', 'PR']);
  const tasks = rows([task({ issue: 1 }), task({ issue: 2 }), task({ issue: 3 })]);
  expect(sortRuns(tasks, { key: '_pr', dir: 1 }, meta).map((t) => t.issue)).toEqual([3, 2, 1]);
  expect(sortRuns(tasks, { key: 'issue', dir: -1 }, meta).map((t) => t.issue)).toEqual([3, 2, 1]);
});

test('dataset hash: known keys only', () => {
  const payload = { datasets: { site: {}, toprope: {} } } as unknown as Payload;
  expect(datasetFromHash('#dataset=toprope', payload)).toBe('toprope');
  expect(datasetFromHash('dataset=site', payload)).toBe('site');
  expect(datasetFromHash('#dataset=constructor', payload)).toBeNull();
  expect(datasetFromHash('#dataset=', payload)).toBeNull();
  expect(datasetFromHash('', payload)).toBeNull();
});
