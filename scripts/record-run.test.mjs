// node --test dry run of the manual record-run repair path, against a
// throwaway git repository seeded from tests/fixtures/record-run/. gh is
// stubbed and nothing is pushed.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  AUTHOR,
  UsageError,
  checkPayload,
  commitMessage,
  parseArgs,
  pickTask,
  recordRun,
} from './record-run.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(ROOT, 'tests', 'fixtures', 'record-run');
const SCRIPT = path.join(ROOT, 'scripts', 'record-run.mjs');
const SITE = path.join('data', 'build', 'site');
const HUMAN = {
  GIT_AUTHOR_NAME: 'Test Human',
  GIT_AUTHOR_EMAIL: 'human@example.invalid',
  GIT_COMMITTER_NAME: 'Test Human',
  GIT_COMMITTER_EMAIL: 'human@example.invalid',
};

// gh as the exporter calls it: `issue list` then `pr list`.
function ghStub({ title = 'record-run script', pr = 30 } = {}) {
  const calls = [];
  const run = (args) => {
    calls.push(args.slice(0, 2).join(' '));
    if (args[0] === 'issue') {
      return [
        { number: 12, title: 'Homepage build-record card (React island)', url: 'https://github.com/o/r/issues/12' },
        { number: 13, title, url: 'https://github.com/o/r/issues/13' },
      ];
    }
    return [
      {
        number: pr,
        url: `https://github.com/o/r/pull/${pr}`,
        mergedAt: '2026-09-23T10:00:00Z',
        closingIssuesReferences: [{ number: 13 }],
      },
    ];
  };
  run.calls = calls;
  return run;
}
const noGh = () => null;
const quiet = () => {};

function git(cwd, args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...HUMAN } });
  assert.equal(res.status, 0, `git ${args.join(' ')}: ${res.stderr}`);
  return res.stdout.trim();
}

const commitCount = (cwd) => Number(git(cwd, ['rev-list', '--count', 'HEAD']));

let repo;

beforeEach(async () => {
  repo = await mkdtemp(path.join(tmpdir(), 'record-run-'));
  git(repo, ['init', '-q', '-b', 'develop']);
  await cp(FIXTURE, path.join(repo, SITE), { recursive: true });
  await writeFile(path.join(repo, '.gitignore'), 'public/build/data.json\n');
  git(repo, ['add', '.']);
  git(repo, ['commit', '-q', '-m', 'seed']);
});

afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe('recordRun (dry run, --no-push)', () => {
  test('refreshes meta.json and makes exactly one telemetry commit', async () => {
    const before = commitCount(repo);
    const result = await recordRun({ issue: 13, push: false }, { root: repo, runGh: ghStub(), log: quiet });

    assert.equal(result.status, 'recorded');
    assert.equal(commitCount(repo), before + 1);
    assert.equal(git(repo, ['log', '-1', '--format=%s']), 'chore(build): record run for #13 (attempt 2, ok, $1,234.57)');
    assert.equal(git(repo, ['log', '-1', '--format=%an <%ae>|%cn <%ce>']), `${AUTHOR.name} <${AUTHOR.email}>|${AUTHOR.name} <${AUTHOR.email}>`);
    assert.deepEqual(git(repo, ['show', '--name-only', '--format=', 'HEAD']).split('\n'), ['data/build/site/meta.json']);

    const meta = JSON.parse(await readFile(path.join(repo, SITE, 'meta.json'), 'utf8'));
    assert.deepEqual(meta['13'], {
      title: 'record-run script',
      url: 'https://github.com/o/r/issues/13',
      pr: 30,
      prUrl: 'https://github.com/o/r/pull/30',
    });
    assert.equal(meta['12'].pr, 27, 'other issues keep their committed entry');
    assert.equal(git(repo, ['status', '--porcelain']), '', 'tree is clean; the payload is not committed');
  });

  test('second invocation: already recorded, no commit', async () => {
    await recordRun({ issue: 13, push: false }, { root: repo, runGh: ghStub(), log: quiet });
    const before = git(repo, ['rev-parse', 'HEAD']);

    const result = await recordRun({ issue: 13, push: false }, { root: repo, runGh: ghStub(), log: quiet });
    assert.equal(result.status, 'already-recorded');
    assert.match(result.message, /^already recorded: #13 attempt 2$/);
    assert.equal(git(repo, ['rev-parse', 'HEAD']), before);
  });

  test('commits a run record the runner left uncommitted, with the report', async () => {
    await writeFile(path.join(repo, SITE, 'epics.jsonl'), '{"epic":1}\n');
    await mkdir(path.join(repo, 'reports'));
    await writeFile(path.join(repo, 'reports', 'issue-13.md'), '# Issue #13\n');
    await writeFile(path.join(repo, 'unrelated.txt'), 'not mine\n');
    git(repo, ['add', 'unrelated.txt']);

    await recordRun({ issue: 13, attempt: 1, push: false }, { root: repo, runGh: noGh, log: quiet });

    assert.equal(git(repo, ['log', '-1', '--format=%s']), 'chore(build): record run for #13 (attempt 1, failed, $2.10)');
    assert.deepEqual(git(repo, ['show', '--name-only', '--format=', 'HEAD']).split('\n').sort(), [
      'data/build/site/epics.jsonl',
      'reports/issue-13.md',
    ]);
    assert.equal(git(repo, ['diff', '--cached', '--name-only']), 'unrelated.txt', 'unrelated staged work is left alone');
  });

  test('without gh: meta.json is left unchanged and says so', async () => {
    const lines = [];
    const result = await recordRun({ issue: 13, push: false }, { root: repo, runGh: noGh, log: (l) => lines.push(l) });
    assert.equal(result.status, 'already-recorded');
    assert.ok(lines.some((l) => l.includes('gh is unavailable')));
  });

  test('gh does not list the issue: meta.json is left unchanged', async () => {
    const lines = [];
    const run = () => [];
    const result = await recordRun({ issue: 13, push: false }, { root: repo, runGh: run, log: (l) => lines.push(l) });
    assert.equal(result.status, 'already-recorded');
    assert.ok(lines.some((l) => l.includes('does not list issue #13')));
  });

  test('no task record for the issue: fails and commits nothing', async () => {
    const before = commitCount(repo);
    await assert.rejects(recordRun({ issue: 99, push: false }, { root: repo, runGh: ghStub(), log: quiet }), /no task record for #99/);
    await assert.rejects(
      recordRun({ issue: 13, attempt: 5, push: false }, { root: repo, runGh: ghStub(), log: quiet }),
      /no task record for #13 attempt 5/,
    );
    assert.equal(commitCount(repo), before);
  });

  test('push refuses to run off develop, before touching anything', async () => {
    git(repo, ['checkout', '-q', '-b', 'feature/x']);
    const gh = ghStub();
    await assert.rejects(recordRun({ issue: 13, push: true }, { root: repo, runGh: gh, log: quiet }), /on branch feature\/x/);
    assert.deepEqual(gh.calls, []);
    assert.equal(git(repo, ['status', '--porcelain']), '');
  });

  test('push failure is reported after the local commit', async () => {
    // No `origin` remote in the throwaway repo, so the push fails.
    await assert.rejects(recordRun({ issue: 13, push: true }, { root: repo, runGh: ghStub(), log: quiet }), /git push/);
    assert.match(git(repo, ['log', '-1', '--format=%s']), /^chore\(build\): record run for #13/);
  });
});

describe('parseArgs', () => {
  test('issue, attempt and --no-push in any order', () => {
    assert.deepEqual(parseArgs(['13']), { issue: 13, attempt: null, push: true });
    assert.deepEqual(parseArgs(['--no-push', '13', '--attempt', '2']), { issue: 13, attempt: 2, push: false });
  });

  test('rejects missing, malformed and extra arguments', () => {
    for (const argv of [[], ['0'], ['13x'], ['-1'], ['13', '14'], ['13', '--attempt'], ['13', '--attempt', '0'], ['13', '--push']]) {
      assert.throws(() => parseArgs(argv), UsageError, argv.join(' '));
    }
  });
});

describe('pickTask', () => {
  const tasks = [
    { issue: 13, attempt: 1, ts: '2026-09-23T01:10:00+02:00' },
    { issue: 13, attempt: 2, ts: '2026-09-23T00:50:00+00:00' },
    { issue: 14, attempt: 3, ts: '2026-09-24T00:00:00+00:00' },
  ];

  test('latest attempt by default, the requested one otherwise', () => {
    assert.equal(pickTask(tasks, 13).attempt, 2);
    assert.equal(pickTask(tasks, 13, 1).attempt, 1);
    assert.equal(pickTask(tasks, 13, 3), null);
    assert.equal(pickTask([], 13), null);
  });

  test('same attempt recorded twice: the later timestamp wins, compared as dates', () => {
    const twice = [
      { issue: 13, attempt: 1, ts: '2026-10-25T02:30:00+02:00', outcome: 'failed' },
      { issue: 13, attempt: 1, ts: '2026-10-25T02:10:00+01:00', outcome: 'ok' },
    ];
    assert.equal(pickTask(twice, 13).outcome, 'ok');
  });
});

describe('commitMessage', () => {
  test('matches the runner format, two decimals', () => {
    assert.equal(commitMessage({ issue: 12, attempt: 1, outcome: 'ok', billed_cost_usd: 10.5031 }), 'chore(build): record run for #12 (attempt 1, ok, $10.50)');
    assert.equal(commitMessage({ issue: 9, attempt: 3, outcome: 'incomplete' }), 'chore(build): record run for #9 (attempt 3, incomplete, $0.00)');
  });
});

describe('checkPayload', () => {
  const dataset = (tasks) => ({
    files: { tasks: { count: tasks.length }, reviewCycles: { count: 0 }, epics: { count: 0 }, lessons: { count: 0 } },
    tasks,
    reviewCycles: [],
    epics: [],
    lessons: [],
  });

  test('a sound payload has no problems', () => {
    const payload = { datasets: { site: dataset([{ issue: 13 }]), toprope: dataset([]) } };
    assert.deepEqual(checkPayload(payload, 13), []);
  });

  test('names a missing dataset, a count mismatch, a non-array and a missing task', () => {
    const site = dataset([{ issue: 12 }]);
    site.files.tasks.count = 2;
    site.epics = null;
    const problems = checkPayload({ datasets: { site } }, 13);
    assert.deepEqual(problems, [
      'site.tasks count does not match its rows',
      'site.epics is not an array',
      'dataset toprope is missing',
      'site dataset has no task record for #13',
    ]);
  });
});

describe('CLI', () => {
  test('usage error exits 2 and commits nothing', () => {
    const res = spawnSync(process.execPath, [SCRIPT, '--attempt', 'x'], { encoding: 'utf8' });
    assert.equal(res.status, 2);
    assert.match(res.stderr, /usage: node scripts\/record-run\.mjs <issue>/);
  });

  test('unknown issue exits 1', () => {
    const res = spawnSync(process.execPath, [SCRIPT, '999999', '--no-push'], { encoding: 'utf8' });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /no task record for #999999/);
  });
});
