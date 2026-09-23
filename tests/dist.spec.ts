import { test, expect } from '@playwright/test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

// Static checks on the build output. No browser needed.
for (const file of ['dist/index.html', 'dist/build/index.html']) {
  test(`${file} exists and loads nothing from the network`, () => {
    expect(existsSync(file)).toBe(true);
    const html = readFileSync(file, 'utf8');
    expect(html).not.toMatch(/<script[^>]+src=["']?(https?:)?\/\//i);
    // rel="canonical" names the page's own URL; browsers do not fetch it.
    expect(html).not.toMatch(/<link(?![^>]*\brel="canonical")[^>]+href=["']?(https?:)?\/\//i);
  });

  test(`${file} has no inline styles or scripts (CSP default-src 'self')`, () => {
    const html = readFileSync(file, 'utf8');
    expect(html).not.toMatch(/<style[\s>]/i);
    // A JSON data block is not executed, so CSP does not apply to it.
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/json")[^>]*>/i);
  });
}

// The payload is inlined in the page, not fetched, and must stay under 1.5 MB.
test('dist/build/index.html inlines the payload and stays under 1.5 MB', () => {
  const html = readFileSync('dist/build/index.html', 'utf8');
  expect(Buffer.byteLength(html)).toBeLessThan(1.5 * 1024 * 1024);
  const blocks = [...html.matchAll(/<script type="application\/json" id="build-data">([\s\S]*?)<\/script>/g)];
  expect(blocks).toHaveLength(1);
  const body = blocks[0][1];
  // `<` is escaped, so recorded text cannot close the block early.
  expect(body).not.toContain('<');
  expect(JSON.parse(body)).toEqual(JSON.parse(readFileSync('dist/build/data.json', 'utf8')));
});

// The prebuild exporter's payload ships next to the /build page.
test('dist/build/data.json ships both build-record datasets', () => {
  const payload = JSON.parse(readFileSync('dist/build/data.json', 'utf8'));
  expect(Object.keys(payload.datasets).sort()).toEqual(['site', 'toprope']);
  expect(payload.datasets.toprope.frozen).toBe(true);
  expect(payload.datasets.toprope.tasks).toHaveLength(172);
});

// The /build dashboard renders the embedded payload: no polling, no fetch,
// and its script stays small.
test('the /build script makes no requests, never polls and is under 60 KB gzipped', () => {
  const html = readFileSync('dist/build/index.html', 'utf8');
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  expect(srcs).toHaveLength(1);
  const js = readFileSync(`dist${srcs[0]}`);
  const source = js.toString('utf8');
  expect(source).not.toMatch(/\bfetch\s*\(/);
  expect(source).not.toMatch(/\bsetInterval\s*\(/);
  expect(source).not.toMatch(/XMLHttpRequest|EventSource|WebSocket/);
  expect(gzipSync(js).length).toBeLessThan(60 * 1024);
});

// Every text file in dist/, relative paths.
const distTextFiles = () => readdirSync('dist', { recursive: true, encoding: 'utf8' }).filter((f) => /\.(html|js|mjs|css|json|txt|xml|svg|webmanifest)$/i.test(f));

// #34: the phrase read as dismissive of the target stack; it must not ship
// anywhere in the build output.
test('"never the hard part" does not appear anywhere in dist/', () => {
  const files = distTextFiles();
  expect(files).toContain('index.html');
  for (const f of files) expect(readFileSync(join('dist', f), 'utf8'), f).not.toMatch(/never the hard part/i);
});

// #39: "n fixed before merge" summed dispositions from a few review cycles
// against a findings total from all of them. It must not ship, and src/ may
// name it only in a comment that explains the removal. The payload's recorded
// review lessons may quote it as history (#33's lesson does); that is data,
// not UI, so the lessons are taken out before the check. The /build page
// inlines the same payload, which the check reads from data.json instead.
const FIXED_LINE = /fixed before merge/i;
const PAYLOAD_TAG = /<script type="application\/json" id="build-data">[\s\S]*?<\/script>/;

const withoutLessons = (json: string): string => {
  const payload = JSON.parse(json) as { datasets: Record<string, { lessons: unknown }> };
  for (const d of Object.values(payload.datasets)) d.lessons = [];
  return JSON.stringify(payload);
};

test('"fixed before merge" does not appear on either page or anywhere in dist/', () => {
  const files = distTextFiles();
  expect(files).toEqual(expect.arrayContaining(['index.html', join('build', 'index.html'), join('build', 'data.json')]));
  expect(readFileSync('dist/build/index.html', 'utf8')).toMatch(PAYLOAD_TAG);
  for (const f of files) {
    const raw = readFileSync(join('dist', f), 'utf8');
    const text = f === join('build', 'data.json') ? withoutLessons(raw) : raw.replace(PAYLOAD_TAG, '');
    expect(text, f).not.toMatch(FIXED_LINE);
  }
});

test('the lesson filter removes only the lessons', () => {
  const payload = JSON.stringify({ datasets: { site: { lessons: [{ rationale: 'fixed before merge' }], tasks: [{ note: 'kept' }] } } });
  expect(withoutLessons(payload)).not.toMatch(FIXED_LINE);
  expect(withoutLessons(payload)).toContain('kept');
  expect(withoutLessons(payload.replace('kept', 'fixed before merge'))).toMatch(FIXED_LINE);
});

const COMMENT_LINE = /^\s*(\/\/|\/?\*)/;

test('the comment-line check tells comments from code', () => {
  for (const l of ['// n fixed before merge', '  * fixed before merge', '/** fixed before merge */']) expect(l, l).toMatch(COMMENT_LINE);
  for (const l of ["fixed:'fixed before merge' },", '<dd>{n} fixed before merge</dd>', "const s = 'x'; // fixed before merge"]) {
    expect(l, l).not.toMatch(COMMENT_LINE);
  }
});

test('"fixed before merge" appears in src/ only on comment lines', () => {
  const hits = readdirSync('src', { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.(ts|tsx|astro|mjs|scss)$/.test(f))
    .flatMap((f) => readFileSync(join('src', f), 'utf8').split('\n').filter((l) => FIXED_LINE.test(l)).map((l) => [f, l.trim()]));
  expect(hits.filter(([, l]) => !COMMENT_LINE.test(l))).toEqual([]);
});
