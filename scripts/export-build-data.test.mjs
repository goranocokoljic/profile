// node --test check for the build-record exporter: the payload is structurally
// valid and every count matches the non-empty line count of its JSONL file.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DATASETS,
  FILES,
  buildDataset,
  buildPayload,
  fetchMeta,
  prForIssue,
  readJsonl,
} from './export-build-data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'export-build-data.mjs');
// Never resolves, so every test that reaches gh takes the fallback path.
const NO_GH = { ghCommand: 'gh-not-installed-for-tests' };

async function nonEmptyLines(file) {
  try {
    return (await readFile(file, 'utf8')).split('\n').filter((l) => l.trim());
  } catch {
    return [];
  }
}

async function readRows(file) {
  return (await nonEmptyLines(file)).map((l) => JSON.parse(l));
}

// The environment with PATH reduced to node's own directory: no gh.
function envWithoutGh() {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toUpperCase() !== 'PATH'));
  env.PATH = path.dirname(process.execPath);
  return env;
}

function assertDatasetShape(d) {
  assert.equal(typeof d.label, 'string');
  assert.equal(typeof d.frozen, 'boolean');
  for (const key of Object.keys(FILES)) {
    assert.ok(Array.isArray(d[key]), `${key} is an array`);
    assert.equal(d.files[key].count, d[key].length, `files.${key}.count matches rows`);
    assert.equal(typeof d.files[key].skipped, 'number');
    assert.ok(d.files[key].mtime === null || !Number.isNaN(Date.parse(d.files[key].mtime)));
  }
}

let tmp;
before(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), 'export-build-data-'));
});
after(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('committed datasets', () => {
  let payload;
  before(async () => {
    payload = await buildPayload(NO_GH);
  });

  test('payload has generatedAt and both datasets', () => {
    assert.ok(!Number.isNaN(Date.parse(payload.generatedAt)));
    assert.deepEqual(Object.keys(payload.datasets).sort(), ['site', 'toprope']);
  });

  for (const name of Object.keys(DATASETS)) {
    test(`${name}: every count equals the JSONL line count, nothing skipped`, async () => {
      const d = payload.datasets[name];
      assertDatasetShape(d);
      for (const [key, file] of Object.entries(FILES)) {
        const expected = (await nonEmptyLines(path.join(ROOT, DATASETS[name].dir, file))).length;
        assert.equal(d[key].length, expected, `${name}.${key}`);
        assert.equal(d.files[key].skipped, 0, `${name}.${key} skipped`);
      }
    });
  }

  test('toprope is the frozen 172-run snapshot', () => {
    const d = payload.datasets.toprope;
    assert.equal(d.frozen, true);
    assert.equal(d.label, 'tr-harness on Toprope · Jun–Aug 2026');
    assert.equal(d.tasks.length, 172);
    assert.equal(d.meta, undefined);
  });

  test('toprope lessons lose file_globs and keep every other field', async () => {
    const raw = await readRows(path.join(ROOT, DATASETS.toprope.dir, FILES.lessons));
    const exported = payload.datasets.toprope.lessons;
    assert.ok(raw.some((l) => 'file_globs' in l), 'fixture has file_globs to strip');
    raw.forEach((row, i) => {
      assert.ok(!('file_globs' in exported[i]));
      const rest = Object.fromEntries(Object.entries(row).filter(([k]) => k !== 'file_globs'));
      assert.deepEqual(exported[i], rest);
    });
  });

  test('site lessons are exported as recorded', async () => {
    const d = payload.datasets.site;
    assert.equal(d.frozen, false);
    assert.equal(d.label, 'This site');
    assert.deepEqual(d.lessons, await readRows(path.join(ROOT, DATASETS.site.dir, FILES.lessons)));
  });

  test('site meta falls back to the committed meta.json without gh', async () => {
    const committed = JSON.parse(await readFile(path.join(ROOT, DATASETS.site.dir, 'meta.json'), 'utf8'));
    assert.deepEqual(payload.datasets.site.meta, committed);
    for (const m of Object.values(payload.datasets.site.meta)) {
      assert.equal(typeof m.title, 'string');
      assert.match(m.url, /^https:\/\/github\.com\/.+\/issues\/\d+$/);
      assert.ok(m.pr === null || Number.isInteger(m.pr));
    }
  });
});

describe('edge cases', () => {
  test('an empty dataset directory is a valid dataset with empty arrays', async () => {
    const d = await buildDataset(tmp, DATASETS.site, NO_GH);
    assertDatasetShape(d);
    for (const key of Object.keys(FILES)) {
      assert.deepEqual(d[key], []);
      assert.deepEqual(d.files[key], { count: 0, skipped: 0, mtime: null });
    }
    assert.deepEqual(d.meta, {});
  });

  test('a missing dataset directory is not an error', async () => {
    const d = await buildDataset(path.join(tmp, 'does-not-exist'), DATASETS.toprope, NO_GH);
    assert.deepEqual(d.tasks, []);
    assert.equal(d.files.lessons.count, 0);
  });

  test('bad lines are skipped and counted, blank lines ignored', async () => {
    const dir = await mkdtemp(path.join(tmp, 'bad-'));
    await writeFile(path.join(dir, FILES.tasks), '{"issue":1}\n\n{not json\r\n  \n{"issue":2}\r\n[1,\n');
    const r = await readJsonl(path.join(dir, FILES.tasks));
    assert.deepEqual(r.rows, [{ issue: 1 }, { issue: 2 }]);
    assert.equal(r.skipped, 2);
    assert.ok(!Number.isNaN(Date.parse(r.mtime)));
  });

  test('a malformed meta.json yields empty meta', async () => {
    const dir = await mkdtemp(path.join(tmp, 'meta-'));
    await writeFile(path.join(dir, 'meta.json'), '[1, 2]');
    assert.deepEqual((await buildDataset(dir, DATASETS.site, NO_GH)).meta, {});
    await writeFile(path.join(dir, 'meta.json'), '{oops');
    assert.deepEqual((await buildDataset(dir, DATASETS.site, NO_GH)).meta, {});
  });

  test('fetchMeta returns null when gh is unavailable, {} when there is nothing to ask', () => {
    assert.equal(fetchMeta([1], NO_GH), null);
    assert.deepEqual(fetchMeta([], NO_GH), {});
  });
});

describe('prForIssue', () => {
  const prs = [
    { number: 15, url: 'u15', body: 'Closes #1\n', headRefName: 'feature/issue-1-scaffold', mergedAt: '2026-09-01' },
    { number: 16, url: 'u16', body: 'Closes #12', headRefName: 'feature/issue-12-x', mergedAt: '2026-09-02' },
    { number: 17, url: 'u17', body: 'fixes #3', headRefName: 'other', mergedAt: '2026-09-03' },
    { number: 18, url: 'u18', body: '', headRefName: 'feat/issue-3-retry', mergedAt: '2026-09-05' },
  ];

  test('matches Closes #n without matching a longer number', () => {
    assert.equal(prForIssue(prs, 1)?.number, 15);
    assert.equal(prForIssue(prs, 12)?.number, 16);
  });

  test('matches by branch name and prefers the latest merge', () => {
    assert.equal(prForIssue(prs, 3)?.number, 18);
  });

  test('returns undefined when no PR closed the issue', () => {
    assert.equal(prForIssue(prs, 2), undefined);
    assert.equal(prForIssue([{ number: 1, body: null, headRefName: null }], 2), undefined);
  });
});

describe('CLI without gh on PATH', () => {
  test('writes public/build/data.json and exits 0', async () => {
    const res = spawnSync(process.execPath, [SCRIPT], { env: envWithoutGh(), encoding: 'utf8' });
    assert.equal(res.status, 0, res.stderr);
    const payload = JSON.parse(await readFile(path.join(ROOT, 'public', 'build', 'data.json'), 'utf8'));
    assertDatasetShape(payload.datasets.site);
    assertDatasetShape(payload.datasets.toprope);
    assert.equal(payload.datasets.toprope.tasks.length, 172);
  });

  test('--write-meta fails loudly and leaves meta.json untouched', async () => {
    const metaFile = path.join(ROOT, DATASETS.site.dir, 'meta.json');
    const before = await readFile(metaFile, 'utf8');
    const res = spawnSync(process.execPath, [SCRIPT, '--write-meta'], { env: envWithoutGh(), encoding: 'utf8' });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /gh is unavailable/);
    assert.equal(await readFile(metaFile, 'utf8'), before);
  });
});
