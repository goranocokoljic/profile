#!/usr/bin/env node
// Build-record exporter — JSONL analytics -> public/build/data.json.
//
// Runs as `prebuild`, so `astro build` always ships fresh data. Zero
// dependencies, Node 22. Mirrors buildPayload() in
// design-reference/dashboard/server.mjs, but for two datasets:
//
//   site     data/build/site/     this repo's harness runs (grows)
//   toprope  data/build/toprope/  frozen tr-harness track record (never modified)
//
// Each dataset reads tasks.jsonl, review-cycles.jsonl, epics.jsonl and
// review-lessons.jsonl with the same tolerant parser as the reference: blank
// lines are ignored, unparseable lines are skipped and counted in
// `files.<name>.skipped`, a missing file is an empty list. A missing or empty
// dataset directory is a valid dataset with empty arrays, never an error.
//
// `summary` holds review totals summed over review-cycles.jsonl:
// `findingsBySeverity` (the five recorded severities plus the derived
// `blocker` = critical + high, never summed from the rows), `findingsTotal`,
// `dispositions` only when at least one cycle recorded them, and
// `dispositionsCoverage` = {cycles, ofCycles}: how many cycle records carry
// dispositions, out of all of them. Dispositions are partial, so they are
// data for the per-run view, not a headline number.
//
// Stripped at export time from the toprope snapshot only: `file_globs` on
// lessons (paths into a private codebase; everything else is kept as recorded).
//
// Issue metadata (site dataset only): `meta` maps issue -> {title, url, pr, prUrl}.
// The committed data/build/site/meta.json is the base. With `gh` on PATH, live
// data (one `gh issue list` + one `gh pr list` call) is laid over it; without
// gh, or when gh fails (Cloudflare build, no auth, offline), the committed file
// is used as is. The build never fails on metadata; issues with no meta are
// listed in the output. `npm run build:meta` refreshes meta.json locally.
//
// Usage:
//   node scripts/export-build-data.mjs              write public/build/data.json
//   node scripts/export-build-data.mjs --write-meta refresh data/build/site/meta.json

import { spawnSync } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const FILES = {
  tasks: 'tasks.jsonl',
  reviewCycles: 'review-cycles.jsonl',
  epics: 'epics.jsonl',
  lessons: 'review-lessons.jsonl',
};

export const DATASETS = {
  site: { dir: 'data/build/site', label: 'This site', frozen: false, meta: true },
  toprope: {
    dir: 'data/build/toprope',
    label: 'tr-harness on Toprope · Jun–Aug 2026',
    frozen: true,
    meta: false,
    stripLessonKeys: ['file_globs'],
  },
};

export const META_FILE = 'meta.json';
export const OUT_FILE = 'public/build/data.json';

export async function readJsonl(file) {
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    return { rows: [], skipped: 0, mtime: null };
  }
  const rows = [];
  let skipped = 0;
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      rows.push(JSON.parse(trimmed));
    } catch {
      skipped++;
    }
  }
  const info = await stat(file).catch(() => null);
  return { rows, skipped, mtime: info ? info.mtime.toISOString() : null };
}

function omitKeys(row, keys) {
  if (!keys.length || row === null || typeof row !== 'object') return row;
  const copy = { ...row };
  for (const key of keys) delete copy[key];
  return copy;
}

// Runs `gh` and returns parsed JSON, or null when gh is missing or fails.
export function ghJson(args) {
  const res = spawnSync('gh', args, { encoding: 'utf8', timeout: 30_000, windowsHide: true });
  if (res.error || res.status !== 0) return null;
  try {
    return JSON.parse(res.stdout);
  } catch {
    return null;
  }
}

// Live metadata for `issues`, or null when gh is unavailable. The PR is the
// latest merged one GitHub lists as closing the issue (`Closes #n`).
// `runGh` is `ghJson`; tests pass a stub.
export function fetchMeta(issues, runGh = ghJson) {
  if (!issues.length) return {};
  const ghIssues = runGh(['issue', 'list', '--state', 'all', '--limit', '1000', '--json', 'number,title,url']);
  if (!Array.isArray(ghIssues)) return null;
  const prs = runGh([
    'pr', 'list', '--state', 'merged', '--limit', '1000', '--json', 'number,url,mergedAt,closingIssuesReferences',
  ]);
  if (!Array.isArray(prs)) return null;
  const meta = {};
  for (const n of issues) {
    const issue = ghIssues.find((i) => i.number === n);
    if (!issue) continue;
    const pr = prs
      .filter((p) => p.closingIssuesReferences?.some((ref) => ref.number === n))
      .sort((a, b) => String(b.mergedAt ?? '').localeCompare(String(a.mergedAt ?? '')))[0];
    meta[n] = { title: issue.title, url: issue.url, pr: pr?.number ?? null, prUrl: pr?.url ?? null };
  }
  return meta;
}

export async function readMetaFile(file) {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function issueNumbers(tasks) {
  const seen = new Set();
  for (const t of tasks) if (Number.isInteger(t?.issue)) seen.add(t.issue);
  return [...seen].sort((a, b) => a - b);
}

// The committed meta.json, overlaid with live gh metadata when available.
// `live` is null when gh is unavailable.
export async function resolveMeta(dir, tasks, runGh = ghJson) {
  const committed = await readMetaFile(path.join(dir, META_FILE));
  const live = fetchMeta(issueNumbers(tasks), runGh);
  return { meta: { ...committed, ...live }, live: live !== null };
}

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'style'];
export const DISPOSITIONS = ['fixed', 'rejected_intentional', 'rejected_wrong', 'deferred'];

const sumKeys = (rows, keys) => Object.fromEntries(keys.map((k) => [k, rows.reduce((a, r) => a + (Number(r?.[k]) || 0), 0)]));

export function summarizeReviews(cycles) {
  const bySeverity = sumKeys(cycles.map((c) => c?.findings), SEVERITIES);
  const summary = {
    findingsBySeverity: { ...bySeverity, blocker: bySeverity.critical + bySeverity.high },
    findingsTotal: SEVERITIES.reduce((a, k) => a + bySeverity[k], 0),
  };
  const recorded = cycles.map((c) => c?.dispositions).filter((d) => d && typeof d === 'object');
  if (recorded.length) summary.dispositions = sumKeys(recorded, DISPOSITIONS);
  summary.dispositionsCoverage = { cycles: recorded.length, ofCycles: cycles.length };
  return summary;
}

export async function buildDataset(dir, config, { runGh = ghJson } = {}) {
  const keys = Object.keys(FILES);
  const read = await Promise.all(keys.map((k) => readJsonl(path.join(dir, FILES[k]))));
  const dataset = { label: config.label, frozen: config.frozen, files: {} };
  keys.forEach((k, i) => {
    const { rows, skipped, mtime } = read[i];
    dataset.files[k] = { count: rows.length, skipped, mtime };
    dataset[k] = rows;
  });
  const strip = config.stripLessonKeys ?? [];
  dataset.lessons = dataset.lessons.map((row) => omitKeys(row, strip));
  dataset.summary = summarizeReviews(dataset.reviewCycles);
  if (config.meta) dataset.meta = (await resolveMeta(dir, dataset.tasks, runGh)).meta;
  return dataset;
}

export async function buildPayload({ root = ROOT, datasets = DATASETS, runGh = ghJson } = {}) {
  const payload = { generatedAt: new Date().toISOString(), datasets: {} };
  for (const [name, config] of Object.entries(datasets)) {
    payload.datasets[name] = await buildDataset(path.join(root, config.dir), config, { runGh });
  }
  return payload;
}

// `pretty` for committed files that people diff; the shipped payload is compact.
export async function writeJson(file, value, { pretty = false } = {}) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, pretty ? 2 : undefined)}\n`);
}

async function main(argv) {
  if (argv.includes('--write-meta')) {
    const dir = path.join(ROOT, DATASETS.site.dir);
    const { rows } = await readJsonl(path.join(dir, FILES.tasks));
    const { meta, live } = await resolveMeta(dir, rows);
    if (!live) {
      console.error('build:meta: gh is unavailable or failed; meta.json left unchanged.');
      process.exitCode = 1;
      return;
    }
    await writeJson(path.join(dir, META_FILE), meta, { pretty: true });
    console.log(`build:meta: wrote ${Object.keys(meta).length} issues to ${DATASETS.site.dir}/${META_FILE}`);
    return;
  }
  const payload = await buildPayload();
  await writeJson(path.join(ROOT, OUT_FILE), payload);
  for (const [name, d] of Object.entries(payload.datasets)) {
    const counts = Object.entries(d.files)
      .map(([k, f]) => `${k} ${f.count}${f.skipped ? ` (${f.skipped} skipped)` : ''}`)
      .join(', ');
    console.log(`export-build-data: ${name}: ${counts}`);
    if (d.meta) {
      const missing = issueNumbers(d.tasks).filter((n) => !d.meta[n]);
      if (missing.length) {
        console.log(`export-build-data: ${name}: no issue meta for #${missing.join(', #')} (run npm run build:meta)`);
      }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv.slice(2));
}
