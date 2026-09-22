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

const HEADER = ['Issue', 'Outcome', 'Review cycles', 'Findings', 'Billed', 'Wall time'];

/** The latest attempt per issue, newest run first. */
export function latestAttempts(tasks: readonly Task[]): Task[] {
  const byIssue = new Map<number, Task>();
  for (const t of tasks) {
    const seen = byIssue.get(t.issue);
    if (!seen || t.attempt > seen.attempt) byIssue.set(t.issue, t);
  }
  return [...byIssue.values()].sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
}

// A title may hold `|` (splits the cell) or `[` `]` (breaks the link label).
const cell = (text: string) => text.replace(/[|[\]]/g, '\\$&');

function issueCell(t: Task, meta: Dataset['meta']): string {
  const m = meta?.[String(t.issue)];
  const label = m?.title ? `#${t.issue} ${cell(m.title)}` : `#${t.issue}`;
  return m?.url ? `[${label}](${m.url})` : label;
}

/** The block between the markers, for the given issues in the given order. */
export function renderRunTable(tasks: readonly Task[], meta: Dataset['meta'], issues: readonly number[]): string {
  const latest = new Map(latestAttempts(tasks).map((t) => [t.issue, t]));
  const rows = issues.map((issue) => {
    const t = latest.get(issue);
    if (!t) throw new Error(`no task record for issue #${issue}`);
    return [
      issueCell(t, meta),
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
    line(HEADER.map((_, i) => (i >= 2 ? '---:' : '---'))),
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

/** Issue numbers of the rows in a rendered block, in row order. */
export function blockIssues(block: string): number[] {
  return [...block.matchAll(/^\| \[?#(\d+)/gm)].map((m) => Number(m[1]));
}

export function replaceBlock(readme: string, block: string): string {
  const current = findBlock(readme.replace(/\r\n/g, '\n'));
  if (current === null) throw new Error(`README has no ${BLOCK_START} … ${BLOCK_END} block`);
  // A function, so `$` in the block (every billed cost) is never a pattern.
  return readme.replace(/\r\n/g, '\n').replace(current, () => block);
}
