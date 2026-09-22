// node --test for the README run-table writer, against a throwaway root.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { writeRunTable } from './readme-run-table.mjs';

let root;

const task = (issue, hour, extra = {}) => ({
  issue, attempt: 1, ts: `2026-07-01T${String(hour).padStart(2, '0')}:00:00Z`, outcome: 'ok',
  model_asked: 'opus', model_ran: 'claude-opus-5-5', total_sec: 600, billed_cost_usd: 1,
  phases: [], review: null, review_cycles: [], ...extra,
});

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'readme-run-table-'));
  const site = path.join(root, 'data', 'build', 'site');
  await mkdir(site, { recursive: true });
  const tasks = [1, 2, 3, 4, 5, 6].map((n) => task(n, n));
  await writeFile(path.join(site, 'tasks.jsonl'), tasks.map((t) => JSON.stringify(t)).join('\n') + '\n');
  await writeFile(path.join(site, 'meta.json'), JSON.stringify({ 6: { title: 'Six', url: 'https://example.com/6', pr: null, prUrl: null } }));
  await writeFile(path.join(root, 'README.md'), '# R\r\n\r\n<!-- run-table:start -->\r\nstale\r\n<!-- run-table:end -->\r\n\r\ntail\r\n');
});

afterEach(() => rm(root, { recursive: true, force: true }));

test('without issues it writes the latest five runs, newest first, and keeps the rest', async () => {
  assert.deepEqual(await writeRunTable({ root }), [6, 5, 4, 3, 2]);
  const readme = await readFile(path.join(root, 'README.md'), 'utf8');
  assert.match(readme, /^# R\n\n<!-- run-table:start -->\n\| Issue \|/);
  assert.match(readme, /\n\| \[#6 Six\]\(https:\/\/example\.com\/6\) \| ok \| 0 \| 0 \| \$1\.00 \| 10m \|\n\| #5 \|/);
  assert.doesNotMatch(readme, /stale|\| #1 \|/);
  assert.match(readme, /<!-- run-table:end -->\n\ntail\n$/);
});

test('given issues it writes exactly those, in that order', async () => {
  assert.deepEqual(await writeRunTable({ root, issues: [2, 6] }), [2, 6]);
  const readme = await readFile(path.join(root, 'README.md'), 'utf8');
  const rows = readme.split('\n').filter((l) => /^\| \[?#\d/.test(l));
  assert.equal(rows.length, 2);
  assert.match(rows[0], /^\| #2 \|/);
});

test('an issue with no record fails and leaves the README alone', async () => {
  const before = await readFile(path.join(root, 'README.md'), 'utf8');
  await assert.rejects(writeRunTable({ root, issues: [99] }), /#99/);
  assert.equal(await readFile(path.join(root, 'README.md'), 'utf8'), before);
});

test('a README without the markers is an error', async () => {
  await writeFile(path.join(root, 'README.md'), '# no table\n');
  await assert.rejects(writeRunTable({ root }), /run-table/);
});

test('the CLI rejects an argument that is not an issue number, before touching anything', () => {
  const script = fileURLToPath(new URL('./readme-run-table.mjs', import.meta.url));
  const run = spawnSync(process.execPath, ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', script, 'abc'], { encoding: 'utf8' });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /usage: npm run readme:runs/);
});
