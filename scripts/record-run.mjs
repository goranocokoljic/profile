#!/usr/bin/env node
// Manual repair path for a harness run record.
//
// tr-harness.ps1 already commits the run record after every attempt
// (Publish-Analytics, see docs/tr-harness.md -> "Analytics"). This script does
// not compete with it: it refreshes data/build/site/meta.json for one issue via
// gh, runs the exporter and a structural check of its payload, and commits +
// pushes only when something actually changed. Same author and message format
// as the runner, so the history reads as one stream. Contract: docs/telemetry.md.
//
// Usage:
//   node scripts/record-run.mjs <issue> [--attempt n] [--no-push]
//
// Exit codes: 0 recorded, pushed or already recorded, 1 failed, 2 usage error.

import { spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  DATASETS,
  FILES,
  META_FILE,
  OUT_FILE,
  buildPayload,
  fetchMeta,
  ghJson,
  readJsonl,
  writeJson,
} from './export-build-data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const AUTHOR = { name: 'tr-harness telemetry', email: 'telemetry@tr-harness.noreply' };
export const BRANCH = 'develop';
const USAGE = 'usage: node scripts/record-run.mjs <issue> [--attempt n] [--no-push]';

export class UsageError extends Error {}

const positiveInt = (s) => (/^[1-9]\d*$/.test(s) ? Number(s) : null);

export function parseArgs(argv) {
  const opts = { issue: null, attempt: null, push: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--no-push') opts.push = false;
    else if (arg === '--attempt') {
      opts.attempt = positiveInt(argv[++i] ?? '');
      if (opts.attempt === null) throw new UsageError('--attempt needs a positive integer');
    } else if (opts.issue === null && positiveInt(arg) !== null) opts.issue = positiveInt(arg);
    else throw new UsageError(`unexpected argument: ${arg}`);
  }
  if (opts.issue === null) throw new UsageError('missing <issue>');
  return opts;
}

// The task record to name in the commit: the requested attempt, else the
// latest one. Timestamps carry a local UTC offset, so compare them as dates.
export function pickTask(tasks, issue, attempt = null) {
  const mine = tasks.filter((t) => t?.issue === issue && (attempt === null || t.attempt === attempt));
  const time = (t) => Date.parse(t.ts) || 0;
  return mine.sort((a, b) => (b.attempt ?? 0) - (a.attempt ?? 0) || time(b) - time(a))[0] ?? null;
}

// Same format as Publish-Analytics in tr-harness.ps1.
export function commitMessage(task) {
  const billed = Number(task.billed_cost_usd ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `chore(build): record run for #${task.issue} (attempt ${task.attempt}, ${task.outcome}, $${billed})`;
}

// Problems with the exported payload, or [] when it is sound: every dataset has
// an array per JSONL file whose length matches its count, no JSONL line was
// skipped as unparseable, and the site dataset holds the issue's task record.
export function checkPayload(payload, issue) {
  const problems = [];
  for (const name of Object.keys(DATASETS)) {
    const d = payload?.datasets?.[name];
    if (!d) {
      problems.push(`dataset ${name} is missing`);
      continue;
    }
    for (const key of Object.keys(FILES)) {
      if (!Array.isArray(d[key])) problems.push(`${name}.${key} is not an array`);
      else if (d.files?.[key]?.count !== d[key].length) problems.push(`${name}.${key} count does not match its rows`);
      if (d.files?.[key]?.skipped) problems.push(`${name}.${key} has ${d.files[key].skipped} unparseable line(s)`);
    }
  }
  if (!payload?.datasets?.site?.tasks?.some?.((t) => t?.issue === issue)) {
    problems.push(`site dataset has no task record for #${issue}`);
  }
  return problems;
}

function git(root, args, env = {}) {
  const res = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, ...env },
  });
  if (res.error) throw new Error(`git ${args[0]}: ${res.error.message}`);
  if (res.status !== 0) throw new Error(`git ${args.join(' ')}: ${res.stderr.trim()}`);
  return res.stdout.trim();
}

const exists = (file) => access(file).then(() => true, () => false);

// The committed meta.json. Unlike the exporter's tolerant reader, a file that
// exists but does not parse is an error: rewriting it would drop every entry.
async function readMetaStrict(file) {
  if (!(await exists(file))) return {};
  let parsed;
  try {
    parsed = JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    throw new Error(`${META_FILE} is not valid JSON (${err.message}); fix it first`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${META_FILE} is not a JSON object; fix it first`);
  return parsed;
}

// With push on, local develop must contain origin/develop, and anything it has
// on top must be telemetry records (a record whose push failed earlier), so a
// repair never publishes someone's unpushed work.
function checkPushBase(root) {
  const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch !== BRANCH) throw new Error(`on branch ${branch}; check out ${BRANCH} or pass --no-push`);
  git(root, ['fetch', '-q', 'origin', BRANCH]);
  if (git(root, ['rev-list', '--count', `HEAD..origin/${BRANCH}`]) !== '0') {
    throw new Error(`local ${BRANCH} is behind origin/${BRANCH}; pull first`);
  }
  const ahead = git(root, ['log', '--format=%ae', `origin/${BRANCH}..HEAD`]).split('\n').filter(Boolean);
  if (ahead.some((email) => email !== AUTHOR.email)) {
    throw new Error(`local ${BRANCH} has unpushed commits that are not telemetry records; push or drop them first`);
  }
}

// Runs the repair. Returns { status, message } where status is 'recorded'
// (committed), 'pushed' (nothing new, but an earlier record commit was still
// unpushed) or 'already-recorded'. Throws on any failure; nothing is written
// or committed before the structural check passes. `runGh` is ghJson; `log`
// receives progress lines. Tests pass stubs and a temporary repository as `root`.
export async function recordRun({ issue, attempt = null, push = true }, { root = ROOT, runGh = ghJson, log = console.log } = {}) {
  const siteDir = path.join(root, DATASETS.site.dir);
  const { rows: tasks } = await readJsonl(path.join(siteDir, FILES.tasks));
  const task = pickTask(tasks, issue, attempt);
  if (!task) {
    throw new Error(`no task record for #${issue}${attempt === null ? '' : ` attempt ${attempt}`} in ${DATASETS.site.dir}/${FILES.tasks}`);
  }
  if (push) checkPushBase(root);

  // 1. meta.json for this issue. Without gh the committed entry is kept.
  const metaFile = path.join(siteDir, META_FILE);
  const meta = await readMetaStrict(metaFile);
  const live = fetchMeta([issue], runGh);
  if (live === null) log(`record-run: gh is unavailable or failed; ${META_FILE} left unchanged.`);
  else if (!live[issue]) log(`record-run: gh does not list issue #${issue}; ${META_FILE} left unchanged.`);
  const nextMeta = live?.[issue] ? { ...meta, [issue]: live[issue] } : null;

  // 2. Exporter and structural check. gh was asked once above, so the exporter
  // runs offline and gets the refreshed meta. The payload itself is gitignored.
  const payload = await buildPayload({ root, runGh: () => null });
  if (nextMeta) payload.datasets.site.meta = nextMeta;
  const problems = checkPayload(payload, issue);
  if (problems.length) throw new Error(`structural check failed:\n  ${problems.join('\n  ')}`);
  if (nextMeta) await writeJson(metaFile, nextMeta, { pretty: true });
  await writeJson(path.join(root, OUT_FILE), payload);

  // 3. Commit only when something changed.
  const report = `reports/issue-${issue}.md`;
  const paths = [DATASETS.site.dir, ...((await exists(path.join(root, report))) ? [report] : [])];
  git(root, ['add', '--', ...paths]);
  const changed = git(root, ['status', '--porcelain', '--', ...paths]) !== '';
  const message = commitMessage(task);
  if (changed) {
    git(root, ['commit', '-q', '-m', message, '--', ...paths], {
      GIT_AUTHOR_NAME: AUTHOR.name,
      GIT_AUTHOR_EMAIL: AUTHOR.email,
      GIT_COMMITTER_NAME: AUTHOR.name,
      GIT_COMMITTER_EMAIL: AUTHOR.email,
    });
    log(`record-run: committed "${message}"`);
  }

  // 4. Push this commit and any record commit an earlier failed push left behind.
  const pending = push ? Number(git(root, ['rev-list', '--count', `origin/${BRANCH}..HEAD`])) : 0;
  if (pending) {
    git(root, ['push', '-q', 'origin', `HEAD:${BRANCH}`]);
    log(`record-run: pushed ${pending} commit(s) to ${BRANCH}`);
  }
  if (changed) return { status: 'recorded', message };
  if (pending) return { status: 'pushed', message: `pushed ${pending} unpushed record commit(s) for #${issue}` };
  return { status: 'already-recorded', message: `already recorded: #${issue} attempt ${task.attempt}` };
}

async function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    console.error(`record-run: ${err.message}\n${USAGE}`);
    process.exitCode = 2;
    return;
  }
  try {
    const result = await recordRun(opts);
    if (result.status !== 'recorded') console.log(`record-run: ${result.message}`);
  } catch (err) {
    console.error(`record-run: ${err.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv.slice(2));
}
