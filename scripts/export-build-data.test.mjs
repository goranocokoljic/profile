// node --test check for the build-record exporter: the payload is structurally
// valid and every count matches the non-empty line count of its JSONL file.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { computeKpis } from '../src/build/stats.ts';
import {
  DATASETS,
  FILES,
  SEVERITIES,
  buildDataset,
  buildPayload,
  fetchMeta,
  readJsonl,
  resolveMeta,
  summarizeReviews,
} from './export-build-data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'export-build-data.mjs');
// gh unavailable: every test that reaches gh takes the fallback path.
const noGh = () => null;
const NO_GH = { runGh: noGh };

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

// The environment with PATH pointing at an empty directory: no gh. Node itself
// is spawned by absolute path.
function envWithoutGh() {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toUpperCase() !== 'PATH'));
  env.PATH = emptyBin;
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
  // Review summary: the severities sum to the total, which is the sum of the
  // recorded per-cycle totals; blocker is derived, not summed.
  const { findingsBySeverity: sev, findingsTotal } = d.summary;
  assert.equal(SEVERITIES.reduce((a, k) => a + sev[k], 0), findingsTotal, 'severities sum to findingsTotal');
  assert.equal(findingsTotal, d.reviewCycles.reduce((a, c) => a + (c.findings?.total ?? 0), 0), 'findingsTotal = sum of findings.total');
  assert.equal(sev.blocker, sev.critical + sev.high, 'blocker = critical + high');
  assert.equal('dispositions' in d.summary, d.reviewCycles.some((c) => c.dispositions), 'dispositions only when recorded');
}

let tmp;
let emptyBin;
before(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), 'export-build-data-'));
  emptyBin = await mkdtemp(path.join(tmpdir(), 'export-build-data-bin-'));
});
after(async () => {
  await rm(tmp, { recursive: true, force: true });
  await rm(emptyBin, { recursive: true, force: true });
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

  // The homepage card reads summary.dispositions; the card and /build KPI
  // breakdowns come from computeKpis over tasks. Both sources must agree.
  test('summary severities equal the /build KPI sums over tasks', () => {
    for (const [name, d] of Object.entries(payload.datasets)) {
      const k = computeKpis(d.tasks);
      const { blocker, ...sev } = d.summary.findingsBySeverity;
      assert.deepEqual(sev, k.bySeverity, name);
      assert.equal(d.summary.findingsTotal, k.findings, name);
      assert.equal(blocker, k.bySeverity.critical + k.bySeverity.high, name);
    }
  });

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

  test('summarizeReviews: no cycles is all zeros with no dispositions key', () => {
    assert.deepEqual(summarizeReviews([]), {
      findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0, style: 0, blocker: 0 },
      findingsTotal: 0,
    });
  });

  test('summarizeReviews: sums severities and only the cycles that recorded dispositions', () => {
    const f = (critical, high, medium, low, style) => ({ critical, high, medium, low, style, blocker: 99, total: critical + high + medium + low + style });
    const s = summarizeReviews([
      { findings: f(1, 2, 3, 4, 5), dispositions: { fixed: 3, rejected_intentional: 1, rejected_wrong: 0, deferred: 11 } },
      { findings: f(0, 1, 0, 2, 0), dispositions: null },
      { findings: f(2, 0, 1, 0, 0) },
      { findings: null },
      null,
      { findings: f(0, 0, 0, 1, 0), dispositions: { fixed: 1, rejected_intentional: 0, rejected_wrong: 2, deferred: 0 } },
    ]);
    assert.deepEqual(s.findingsBySeverity, { critical: 3, high: 3, medium: 4, low: 7, style: 5, blocker: 6 });
    assert.equal(s.findingsTotal, 22);
    assert.deepEqual(s.dispositions, { fixed: 4, rejected_intentional: 1, rejected_wrong: 2, deferred: 11 });
  });

  test('summarizeReviews: cycles whose dispositions are all null omit the key', () => {
    const s = summarizeReviews([{ findings: { critical: 0, high: 1, medium: 0, low: 0, style: 0 }, dispositions: null }]);
    assert.equal('dispositions' in s, false);
    assert.equal(s.findingsTotal, 1);
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
    assert.equal(fetchMeta([1], noGh), null);
    assert.deepEqual(fetchMeta([], noGh), {});
  });
});

describe('live gh metadata', () => {
  const ghIssues = [
    { number: 1, title: 'One', url: 'https://github.com/o/r/issues/1' },
    { number: 3, title: 'Three', url: 'https://github.com/o/r/issues/3' },
    { number: 12, title: 'Twelve', url: 'https://github.com/o/r/issues/12' },
  ];
  const prs = [
    { number: 15, url: 'pr15', mergedAt: '2026-09-01T00:00:00Z', closingIssuesReferences: [{ number: 1 }] },
    { number: 16, url: 'pr16', mergedAt: '2026-09-02T00:00:00Z', closingIssuesReferences: [{ number: 12 }] },
    { number: 17, url: 'pr17', mergedAt: '2026-09-03T00:00:00Z', closingIssuesReferences: [{ number: 3 }] },
    { number: 18, url: 'pr18', mergedAt: '2026-09-05T00:00:00Z', closingIssuesReferences: [{ number: 3 }] },
    { number: 19, url: 'pr19', mergedAt: '2026-09-06T00:00:00Z' },
  ];
  // Answers `gh issue list` / `gh pr list` from fixtures; `fail` names a call that fails.
  const fakeGh = (fail) => (args) => (args[0] === fail ? null : args[0] === 'issue' ? ghIssues : prs);

  test('builds title, url and the closing PR for each issue', () => {
    assert.deepEqual(fetchMeta([1, 3, 12], fakeGh()), {
      1: { title: 'One', url: 'https://github.com/o/r/issues/1', pr: 15, prUrl: 'pr15' },
      3: { title: 'Three', url: 'https://github.com/o/r/issues/3', pr: 18, prUrl: 'pr18' },
      12: { title: 'Twelve', url: 'https://github.com/o/r/issues/12', pr: 16, prUrl: 'pr16' },
    });
  });

  test('an issue with no closing PR gets null pr, an issue gh does not know is left out', () => {
    const noPrs = (args) => (args[0] === 'issue' ? ghIssues : []);
    assert.deepEqual(fetchMeta([1, 99], noPrs), {
      1: { title: 'One', url: 'https://github.com/o/r/issues/1', pr: null, prUrl: null },
    });
  });

  test('either gh call failing means no live meta', () => {
    assert.equal(fetchMeta([1], fakeGh('issue')), null);
    assert.equal(fetchMeta([1], fakeGh('pr')), null);
  });

  test('resolveMeta lays live meta over the committed file and keeps committed-only issues', async () => {
    const dir = await mkdtemp(path.join(tmp, 'resolve-'));
    await writeFile(
      path.join(dir, 'meta.json'),
      JSON.stringify({ 1: { title: 'Old', url: 'old', pr: null, prUrl: null }, 5: { title: 'Five', url: 'u5', pr: 2, prUrl: 'p2' } }),
    );
    const tasks = [{ issue: 1 }, { issue: 1 }, { issue: '3' }, {}];
    const asked = [];
    const { meta, live } = await resolveMeta(dir, tasks, (args) => {
      asked.push(args[0]);
      return fakeGh()(args);
    });
    assert.equal(live, true);
    assert.deepEqual(asked, ['issue', 'pr']);
    assert.deepEqual(meta, {
      1: { title: 'One', url: 'https://github.com/o/r/issues/1', pr: 15, prUrl: 'pr15' },
      5: { title: 'Five', url: 'u5', pr: 2, prUrl: 'p2' },
    });
    assert.deepEqual(await resolveMeta(dir, tasks, noGh), {
      meta: { 1: { title: 'Old', url: 'old', pr: null, prUrl: null }, 5: { title: 'Five', url: 'u5', pr: 2, prUrl: 'p2' } },
      live: false,
    });
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
