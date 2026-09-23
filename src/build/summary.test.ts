import { test, expect } from '@playwright/test';
import { computeKpis } from './stats';
import { RECENT_RUNS, summarize } from './summary';
import type { Dataset, Task } from './types';

// The homepage card's numbers. The browser test checks them against the
// /build KPI row on the real data; these pin the cases it does not have.

function task(over: Partial<Task> = {}): Task {
  return {
    issue: 1, attempt: 1, ts: '2026-07-01T10:00:00Z', outcome: 'ok', model_asked: 'opus', model_ran: 'claude-opus-5-5',
    total_sec: 600, billed_cost_usd: 2, phases: [], review: null, review_cycles: [], ...over,
  };
}

const info = { count: 0, skipped: 0, mtime: null };

const noFindings = { findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0, style: 0, blocker: 0 }, findingsTotal: 0, dispositionsCoverage: { cycles: 0, ofCycles: 0 } };

function dataset(tasks: Task[], meta: Dataset['meta'] = {}, summary: Dataset['summary'] = noFindings): Dataset {
  return {
    label: 'site', frozen: false, files: { tasks: info, reviewCycles: info, epics: info, lessons: info },
    tasks, reviewCycles: [], epics: [], lessons: [], summary, meta,
  };
}

const findings = (n: number) => ({ critical: 0, high: n, medium: 0, low: 0, style: 0 });
const review = (n: number): Task['review'] => ({ cycles_run: 1, max_cycles: 3, total_review_sec: 1, total_fix_sec: 1, findings_total: findings(n) });

test('an empty dataset has zero totals, no latest run and no recent runs', () => {
  expect(summarize(dataset([]))).toEqual({
    tasksCompleted: 0, successfulRuns: 0, findings: 0, breakdown: { blocker: 0, medium: 0, low: 0 },
    wallSec: 0, billedUsd: 0, latest: null, recent: [],
  });
});

test('totals equal the /build KPI numbers for the same tasks', () => {
  const tasks = [
    task({ issue: 1, outcome: 'failed', billed_cost_usd: 1.5, total_sec: 100, review: review(3) }),
    task({ issue: 1, attempt: 2, outcome: 'ok', billed_cost_usd: 2.25, total_sec: 200, review: review(4) }),
    task({ issue: 2, outcome: 'incomplete', billed_cost_usd: 4, total_sec: 50 }),
  ];
  const s = summarize(dataset(tasks));
  const k = computeKpis(tasks);
  expect([s.successfulRuns, s.findings, s.wallSec, s.billedUsd]).toEqual([k.ok, k.findings, k.wall, k.cost]);
  expect([s.successfulRuns, s.findings, s.wallSec, s.billedUsd]).toEqual([1, 7, 350, 7.75]);
});

test('tasks completed counts distinct issues with an ok run, not runs', () => {
  const tasks = [
    task({ issue: 1, outcome: 'ok' }),
    task({ issue: 1, attempt: 2, outcome: 'ok' }),
    task({ issue: 2, outcome: 'failed' }),
    task({ issue: 3, outcome: 'ok' }),
  ];
  const s = summarize(dataset(tasks));
  expect(s.tasksCompleted).toBe(2);
  expect(s.successfulRuns).toBe(3);
});

test('the latest run is the newest by instant, not by string, with its meta', () => {
  // 23:30+02:00 is 21:30Z: earlier than 22:00Z though it sorts later as text.
  const tasks = [
    task({ issue: 4, ts: '2026-07-01T23:30:00+02:00', outcome: 'ok' }),
    task({ issue: 5, ts: '2026-07-01T22:00:00Z', outcome: 'failed' }),
  ];
  const meta = { '5': { title: 'Five', url: 'https://github.com/o/r/issues/5', pr: 9, prUrl: 'https://github.com/o/r/pull/9' } };
  expect(summarize(dataset(tasks, meta)).latest).toEqual({
    issue: 5, title: 'Five', url: 'https://github.com/o/r/issues/5', pr: 9, prUrl: 'https://github.com/o/r/pull/9',
    outcome: 'failed', ts: '2026-07-01T22:00:00Z',
  });
});

test('a latest run without meta has null title and links', () => {
  const latest = summarize(dataset([task({ issue: 7 })], undefined)).latest;
  expect(latest).toMatchObject({ issue: 7, title: null, url: null, pr: null, prUrl: null });
});

test(`recent holds at most ${RECENT_RUNS} runs, newest first`, () => {
  const tasks = Array.from({ length: 7 }, (_, i) =>
    task({ issue: i + 1, ts: `2026-07-0${i + 1}T10:00:00Z`, billed_cost_usd: i + 1, outcome: i % 2 ? 'failed' : 'ok' }),
  );
  const recent = summarize(dataset(tasks)).recent;
  expect(recent.map((r) => r.issue)).toEqual([7, 6, 5, 4, 3]);
  expect(recent[1]).toEqual({ issue: 6, attempt: 1, outcome: 'failed', billedUsd: 6 });
});

test('the findings breakdown groups the per-task severities the /build KPI sums', () => {
  const r = (critical: number, high: number, medium: number, low: number, style: number): Task['review'] => ({
    cycles_run: 1, max_cycles: 3, total_review_sec: 1, total_fix_sec: 1, findings_total: { critical, high, medium, low, style },
  });
  const s = summarize(dataset([task({ review: r(1, 2, 3, 4, 5) }), task({ issue: 2, review: r(0, 1, 0, 0, 1) })]));
  expect(s.breakdown).toEqual({ blocker: 4, medium: 3, low: 10 });
  expect(s.breakdown.blocker + s.breakdown.medium + s.breakdown.low).toBe(s.findings);
});

// #39: dispositions cover a few cycles only, so the card carries no aggregate of them.
test('the summary carries no dispositions aggregate, even when the dataset has one', () => {
  const dispositions = { fixed: 18, rejected_intentional: 0, rejected_wrong: 1, deferred: 35 };
  const s = summarize(dataset([task()], {}, { ...noFindings, dispositions, dispositionsCoverage: { cycles: 1, ofCycles: 4 } }));
  expect(Object.keys(s).sort()).toEqual(['billedUsd', 'breakdown', 'findings', 'latest', 'recent', 'successfulRuns', 'tasksCompleted', 'wallSec']);
});
