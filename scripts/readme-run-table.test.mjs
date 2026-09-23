// node --test for the README run-table writer's file I/O, against a throwaway
// root. The rendering itself is tested in src/build/readme.test.ts.

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { writeRunTable } from './readme-run-table.mjs';

let root;
let site;

const task = (issue, hour, extra = {}) => ({
  issue, attempt: 1, ts: `2026-07-01T${String(hour).padStart(2, '0')}:00:00Z`, outcome: 'ok',
  model_asked: 'opus', model_ran: 'claude-opus-5-5', total_sec: 600, billed_cost_usd: 1,
  phases: [], review: null, review_cycles: [], ...extra,
});

const writeTasks = (lines) => writeFile(path.join(site, 'tasks.jsonl'), lines.join('\n') + '\n');
const readme = () => readFile(path.join(root, 'README.md'), 'utf8');

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'readme-run-table-'));
  site = path.join(root, 'data', 'build', 'site');
  await mkdir(site, { recursive: true });
  await writeTasks([1, 2, 3, 4, 5, 6].map((n) => JSON.stringify(task(n, n))));
  await writeFile(path.join(site, 'meta.json'), JSON.stringify({ 6: { title: 'Six', url: 'https://example.com/6', pr: null, prUrl: null } }));
  await writeFile(path.join(root, 'README.md'), '# R\r\n\r\n<!-- run-table:start -->\r\nstale\r\n<!-- run-table:end -->\r\n\r\ntail\r\n');
});

afterEach(() => rm(root, { recursive: true, force: true }));

test('writes the latest five runs, newest first, and keeps the rest of the README', async () => {
  const runs = await writeRunTable({ root });
  assert.deepEqual(runs.map((r) => r.issue), [6, 5, 4, 3, 2]);
  const text = await readme();
  assert.match(text, /^# R\n\n<!-- run-table:start -->\n\| Issue \|/);
  const rows = text.split('\n').filter((l) => /^\| \[?#\d/.test(l));
  assert.deepEqual(rows.map((l) => l.match(/#(\d+)/)[1]), ['6', '5', '4', '3', '2']);
  assert.equal(rows[0], '| [#6 Six](https://example.com/6) | 1 | ok | 0 | 0 | $1.00 | 10m |');
  assert.doesNotMatch(text, /stale/);
  assert.match(text, /<!-- run-table:end -->\n\ntail\n$/);
});

test('a tasks.jsonl line that does not parse fails and leaves the README alone', async () => {
  const before = await readme();
  await writeTasks([JSON.stringify(task(1, 1)), '{broken']);
  await assert.rejects(writeRunTable({ root }), /1 line\(s\) do not parse/);
  assert.equal(await readme(), before);
});

test('no task records fails instead of writing an empty table', async () => {
  const before = await readme();
  await rm(path.join(site, 'tasks.jsonl'));
  await assert.rejects(writeRunTable({ root }), /no task records/);
  assert.equal(await readme(), before);
});

test('a README without the markers is an error', async () => {
  await writeFile(path.join(root, 'README.md'), '# no table\n');
  await assert.rejects(writeRunTable({ root }), /run-table/);
});
