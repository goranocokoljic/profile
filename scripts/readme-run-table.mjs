#!/usr/bin/env node
// Writes the README's run table from data/build/site/tasks.jsonl (+ meta.json
// for issue titles). The rendering lives in src/build/readme.ts; this is the
// file I/O around it. Run through `npm run readme:runs`, which adds Node's
// type stripping so the .ts module loads.
//
//   npm run readme:runs            the latest 5 runs
//   npm run readme:runs -- 13 12   exactly these issues, in this order

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DATASETS, readJsonl, readMetaFile, FILES, META_FILE } from './export-build-data.mjs';
import { DEFAULT_ROWS, latestAttempts, renderRunTable, replaceBlock } from '../src/build/readme.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function writeRunTable({ root = ROOT, issues = [] } = {}) {
  const dir = path.join(root, DATASETS.site.dir);
  const { rows: tasks } = await readJsonl(path.join(dir, FILES.tasks));
  const meta = await readMetaFile(path.join(dir, META_FILE));
  const picked = issues.length ? issues : latestAttempts(tasks).slice(0, DEFAULT_ROWS).map((t) => t.issue);
  const file = path.join(root, 'README.md');
  const readme = await readFile(file, 'utf8');
  await writeFile(file, replaceBlock(readme, renderRunTable(tasks, meta, picked)));
  return picked;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const issues = process.argv.slice(2).map(Number);
  if (issues.some((n) => !Number.isInteger(n) || n <= 0)) {
    console.error('usage: npm run readme:runs [-- <issue> ...]');
    process.exit(2);
  }
  const picked = await writeRunTable({ issues });
  console.log(`readme-run-table: README.md shows #${picked.join(', #')}`);
}
