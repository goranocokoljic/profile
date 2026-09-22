import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

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
