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

// #34: the phrase read as dismissive of the target stack; it must not ship
// anywhere in the build output.
test('"never the hard part" does not appear anywhere in dist/', () => {
  const text = /\.(html|js|mjs|css|json|txt|xml|svg|webmanifest)$/i;
  const files = (readdirSync('dist', { recursive: true }) as string[]).filter((f) => text.test(f));
  expect(files).toContain('index.html');
  for (const f of files) expect(readFileSync(join('dist', f), 'utf8'), f).not.toMatch(/never the hard part/i);
});
