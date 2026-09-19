#!/usr/bin/env node
// Dev-cycle dashboard — zero-dependency live server.
// Reads dev-cycle-analytics/*.jsonl fresh on every /api/data request,
// so the page always reflects the latest harness run. No build step.
//
// Usage:  node server.mjs [--port 8090] [--data <path-to-dev-cycle-analytics>]

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const PORT = Number(argValue('--port', process.env.TR_DASHBOARD_PORT || 8090));
const DATA_DIR = path.resolve(
  argValue('--data', process.env.TR_ANALYTICS_DIR || path.join(__dirname, '..', 'dev-cycle-analytics'))
);
const INDEX_HTML = path.join(__dirname, 'public', 'index.html');

async function readJsonl(file) {
  const full = path.join(DATA_DIR, file);
  let raw;
  try {
    raw = await readFile(full, 'utf8');
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
  const info = await stat(full).catch(() => null);
  return { rows, skipped, mtime: info ? info.mtime.toISOString() : null };
}

async function buildPayload() {
  const [tasks, reviewCycles, epics, lessons] = await Promise.all([
    readJsonl('tasks.jsonl'),
    readJsonl('review-cycles.jsonl'),
    readJsonl('epics.jsonl'),
    readJsonl('review-lessons.jsonl'),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    dataDir: DATA_DIR,
    files: {
      tasks: { count: tasks.rows.length, skipped: tasks.skipped, mtime: tasks.mtime },
      reviewCycles: { count: reviewCycles.rows.length, skipped: reviewCycles.skipped, mtime: reviewCycles.mtime },
      epics: { count: epics.rows.length, skipped: epics.skipped, mtime: epics.mtime },
      lessons: { count: lessons.rows.length, skipped: lessons.skipped, mtime: lessons.mtime },
    },
    tasks: tasks.rows,
    reviewCycles: reviewCycles.rows,
    epics: epics.rows,
    lessons: lessons.rows,
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/api/data') {
      const payload = await buildPayload();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(payload));
      return;
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const html = await readFile(INDEX_HTML);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Server error: ${err.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`Dev-cycle dashboard:  http://localhost:${PORT}`);
  console.log(`Analytics dir:        ${DATA_DIR}`);
});
