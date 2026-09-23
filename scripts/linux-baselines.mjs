#!/usr/bin/env node
// Renders the Linux visual baselines (tests/polish.spec.ts) in the same
// Playwright container CI runs in, so CI compares like with like. Needs Docker.
// The repository is mounted read-only and copied inside the container, so the
// host's node_modules and dist are never touched; only the *-linux.png
// baselines are copied back.
//
//   npm run test:baselines:linux

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(path.join(ROOT, 'node_modules/@playwright/test/package.json'), 'utf8')).version;
export const IMAGE = `mcr.microsoft.com/playwright:v${version}-noble`;
const SHOTS = 'tests/__screenshots__/polish.spec.ts';

const inside = [
  'set -e',
  'mkdir /work && cd /src',
  'tar --exclude=./node_modules --exclude=./dist --exclude=./.git -cf - . | tar -xf - -C /work',
  'cd /work && npm ci --no-audit --no-fund',
  'npm run build',
  `rm -f ${SHOTS}/*-linux.png`,
  'npx playwright test tests/polish.spec.ts -g "matches its baseline" --update-snapshots',
  `cp ${SHOTS}/*-linux.png /out/`,
].join(' && ');

const run = spawnSync(
  'docker',
  ['run', '--rm', '-v', `${ROOT}:/src:ro`, '-v', `${path.join(ROOT, SHOTS)}:/out`, IMAGE, 'bash', '-c', inside],
  { stdio: 'inherit' },
);
process.exit(run.status ?? 1);
