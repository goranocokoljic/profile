import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

// Static checks on the build output. No browser needed.
for (const file of ['dist/index.html', 'dist/build/index.html']) {
  test(`${file} exists and loads nothing from the network`, () => {
    expect(existsSync(file)).toBe(true);
    const html = readFileSync(file, 'utf8');
    expect(html).not.toMatch(/<script[^>]+src=["']?(https?:)?\/\//i);
    expect(html).not.toMatch(/<link[^>]+href=["']?(https?:)?\/\//i);
  });

  test(`${file} has no inline styles or scripts (CSP default-src 'self')`, () => {
    const html = readFileSync(file, 'utf8');
    expect(html).not.toMatch(/<style[\s>]/i);
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);
  });
}

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
