import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  BLOCK_END,
  BLOCK_START,
  blockIssues,
  findBlock,
  latestAttempts,
  renderRunTable,
  replaceBlock,
} from './readme';
import type { Dataset, Task } from './types';

function task(over: Partial<Task> = {}): Task {
  return {
    issue: 1, attempt: 1, ts: '2026-07-01T10:00:00Z', outcome: 'ok', model_asked: 'opus', model_ran: 'claude-opus-5-5',
    total_sec: 600, billed_cost_usd: 2, phases: [], review: null, review_cycles: [], ...over,
  };
}

const review = (cycles: number, high: number, low: number): Task['review'] => ({
  cycles_run: cycles, max_cycles: 3, total_review_sec: 1, total_fix_sec: 1,
  findings_total: { critical: 0, high, medium: 0, low, style: 0 },
});

const rows = (block: string) => block.split('\n').filter((l) => l.startsWith('| ')).slice(2);

test('the committed README table is rendered from the real site task records', () => {
  const tasks = readFileSync('data/build/site/tasks.jsonl', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Task);
  const meta = JSON.parse(readFileSync('data/build/site/meta.json', 'utf8')) as Dataset['meta'];
  const block = findBlock(readFileSync('README.md', 'utf8').replace(/\r\n/g, '\n'));
  expect(block, 'README.md has the run-table block').not.toBeNull();
  const issues = blockIssues(block!);
  expect(issues.length).toBeGreaterThan(0);
  // Fails when a row is typed by hand or a number drifts from tasks.jsonl.
  expect(block).toBe(renderRunTable(tasks, meta, issues));
});

test('a row shows outcome, cycles, summed findings, billed cost and wall time', () => {
  const block = renderRunTable([task({ issue: 7, review: review(2, 3, 4), billed_cost_usd: 6.6518, total_sec: 870.1 })], {}, [7]);
  expect(rows(block)).toEqual(['| #7 | ok | 2 | 7 | $6.65 | 15m |']);
  expect(block.startsWith(BLOCK_START)).toBe(true);
  expect(block.endsWith(BLOCK_END)).toBe(true);
});

test('a run without a review shows zero cycles and zero findings', () => {
  expect(rows(renderRunTable([task({ outcome: 'failed' })], {}, [1]))).toEqual(['| #1 | failed | 0 | 0 | $2.00 | 10m |']);
});

test('the issue cell links the title from meta and escapes table and link syntax', () => {
  const meta: Dataset['meta'] = { '4': { title: 'a | b [c]', url: 'https://example.com/4', pr: null, prUrl: null } };
  const [row] = rows(renderRunTable([task({ issue: 4 })], meta, [4]));
  expect(row.startsWith('| [#4 a \\| b \\[c\\]](https://example.com/4) |')).toBe(true);
  expect(blockIssues(renderRunTable([task({ issue: 4 })], meta, [4]))).toEqual([4]);
});

test('an issue with no task record is an error, not an empty row', () => {
  expect(() => renderRunTable([task()], {}, [99])).toThrow('#99');
});

test('latestAttempts keeps the highest attempt per issue, newest instant first', () => {
  const picked = latestAttempts([
    task({ issue: 1, attempt: 1, ts: '2026-07-01T10:00:00Z' }),
    task({ issue: 1, attempt: 2, ts: '2026-07-01T12:00:00Z' }),
    // 11:30Z: first as a string, second as an instant. Sorts by Date.parse.
    task({ issue: 2, attempt: 1, ts: '2026-07-01T13:30:00+02:00' }),
    task({ issue: 3, attempt: 1, ts: '2026-07-01T11:00:00Z' }),
  ]);
  expect(picked.map((t) => [t.issue, t.attempt])).toEqual([[1, 2], [2, 1], [3, 1]]);
});

test('replaceBlock swaps only the block, keeps $ literally and normalises CRLF', () => {
  const block = renderRunTable([task({ billed_cost_usd: 6.65 })], {}, [1]);
  const readme = `# T\r\n\r\n${BLOCK_START}\r\nold\r\n${BLOCK_END}\r\n\r\nafter $& $1\r\n`;
  expect(replaceBlock(readme, block)).toBe(`# T\n\n${block}\n\nafter $& $1\n`);
});

test('a README without the markers is an error', () => {
  expect(findBlock('# no table')).toBeNull();
  expect(() => replaceBlock('# no table', 'x')).toThrow('run-table');
});
