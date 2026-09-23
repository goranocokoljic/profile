#!/usr/bin/env node
// Writes the README's run table from data/build/site/tasks.jsonl (+ meta.json
// for issue titles): the latest attempt of the five most recent issues. The
// rendering lives in src/build/readme.ts; this is the file I/O around it. Run
// through `npm run readme:runs`, which adds Node's type stripping so the .ts
// module loads.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DATASETS, readJsonl, readMetaFile, FILES, META_FILE } from './export-build-data.mjs';
import { DEFAULT_ROWS, latestAttempts, renderRunTable, replaceBlock } from '../src/build/readme.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function writeRunTable({ root = ROOT } = {}) {
  const dir = path.join(root, DATASETS.site.dir);
  const { rows: tasks, skipped } = await readJsonl(path.join(dir, FILES.tasks));
  if (skipped) throw new Error(`${FILES.tasks}: ${skipped} line(s) do not parse`);
  if (!tasks.length) throw new Error(`${FILES.tasks}: no task records`);
  const meta = await readMetaFile(path.join(dir, META_FILE));
  const runs = latestAttempts(tasks)
    .slice(0, DEFAULT_ROWS)
    .map((t) => ({ issue: t.issue, attempt: t.attempt }));
  const file = path.join(root, 'README.md');
  const readme = await readFile(file, 'utf8');
  await writeFile(file, replaceBlock(readme, renderRunTable(tasks, meta, runs)));
  return runs;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runs = await writeRunTable();
  console.log(`readme-run-table: README.md shows ${runs.map((r) => `#${r.issue}/${r.attempt}`).join(', ')}`);
}
