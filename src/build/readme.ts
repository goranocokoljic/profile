// The README's run table, rendered from the site's task records so the README
// never carries hand-typed numbers. Pure: `scripts/readme-run-table.mjs` does
// the file I/O and `readme.test.ts` checks the committed README against it.
//
// Imports carry the `.ts` extension so Node (type stripping) can run this
// module directly from the script, not only through Vite.

import { fmtDur, fmtUsd } from './format.ts';
import { findingsSum } from './stats.ts';
import type { Dataset, Task } from './types.ts';

export const BLOCK_START = '<!-- run-table:start -->';
export const BLOCK_END = '<!-- run-table:end -->';
export const DEFAULT_ROWS = 5;

const HEADER = ['Issue', 'Attempt', 'Outcome', 'Review cycles', 'Findings', 'Billed', 'Wall time'];

/** One row of the table: a task record is keyed by issue and attempt. */
export interface RunKey {
  issue: number;
  attempt: number;
}

const byInstantDesc = (a: Task, b: Task) => Date.parse(b.ts) - Date.parse(a.ts);

/**
 * The latest attempt per issue, newest run first. A re-recorded attempt
 * resolves to its newest record, the same rule as record-run's pickTask.
 */
export function latestAttempts(tasks: readonly Task[]): Task[] {
  const byIssue = new Map<number, Task>();
  for (const t of tasks) {
    const seen = byIssue.get(t.issue);
    if (!seen || t.attempt > seen.attempt || (t.attempt === seen.attempt && byInstantDesc(t, seen) < 0)) {
      byIssue.set(t.issue, t);
    }
  }
  return [...byIssue.values()].sort(byInstantDesc);
}

// A title may hold `|` (splits the cell) or `[` `]` (breaks the link label).
const cell = (text: string) => text.replace(/[|[\]]/g, '\\$&');

function issueCell(t: Task, meta: Dataset['meta']): string {
  const m = meta?.[String(t.issue)];
  const label = m?.title ? `#${t.issue} ${cell(m.title)}` : `#${t.issue}`;
  return m?.url ? `[${label}](${m.url})` : label;
}

/**
 * The block between the markers, one row per run in the given order. Rows
 * name their attempt, so a later retry of a listed issue does not change them.
 */
export function renderRunTable(tasks: readonly Task[], meta: Dataset['meta'], runs: readonly RunKey[]): string {
  const rows = runs.map(({ issue, attempt }) => {
    const t = latestAttempts(tasks.filter((r) => r.issue === issue && r.attempt === attempt))[0];
    if (!t) throw new Error(`no task record for issue #${issue} attempt ${attempt}`);
    return [
      issueCell(t, meta),
      String(t.attempt),
      t.outcome,
      String(t.review?.cycles_run ?? 0),
      String(findingsSum(t.review?.findings_total)),
      fmtUsd(t.billed_cost_usd),
      fmtDur(t.total_sec),
    ];
  });
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  return [
    BLOCK_START,
    line(HEADER),
    line(HEADER.map((_, i) => (i >= 3 ? '---:' : '---'))),
    ...rows.map(line),
    BLOCK_END,
  ].join('\n');
}

/** The committed block, or null when the README has no markers. */
export function findBlock(readme: string): string | null {
  const start = readme.indexOf(BLOCK_START);
  const end = readme.indexOf(BLOCK_END, start);
  if (start < 0 || end < 0) return null;
  return readme.slice(start, end + BLOCK_END.length);
}

/** The runs in a rendered block, in row order. */
export function blockRuns(block: string): RunKey[] {
  return [...block.matchAll(/^\| \[?#(\d+).*? \| (\d+) \|/gm)].map((m) => ({ issue: Number(m[1]), attempt: Number(m[2]) }));
}

export function replaceBlock(readme: string, block: string): string {
  const text = readme.replace(/\r\n/g, '\n');
  const current = findBlock(text);
  if (current === null) throw new Error(`README has no ${BLOCK_START} … ${BLOCK_END} block`);
  const start = text.indexOf(current);
  return text.slice(0, start) + block + text.slice(start + current.length);
}
