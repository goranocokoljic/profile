import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test, expect } from '@playwright/test';
import { z } from 'zod';
import { SiteSchema, type Site } from './site.schema';

// Import site.ts here rather than at the top, so a failed parse is reported as
// a readable path list instead of a raw ZodError dump.
async function loadSite(): Promise<Site> {
  try {
    return (await import('./site')).site;
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new Error(`src/data/site.ts does not match SiteSchema:\n${z.prettifyError(err)}`);
    }
    throw err;
  }
}

function referenceCopy(): unknown {
  const source = readFileSync('design-reference/site/content.js', 'utf8');
  const sandbox: { window: { siteCopy?: unknown } } = { window: {} };
  runInNewContext(source, sandbox);
  return sandbox.window.siteCopy;
}

// Every string leaf with its dotted path.
function strings(value: unknown, path = 'site'): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}.${i}`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => strings(v, `${path}.${k}`));
  }
  return [];
}

// buildStory metric values are empty in the reference; build data fills them.
const PLACEHOLDER = /^site\.buildStory\.metrics\.\d+\.1$/;

test('site.ts parses against the schema', async () => {
  const site = await loadSite();
  expect(site.hero.headlineStart.length).toBeGreaterThan(0);
});

test('copy matches content.js verbatim', async () => {
  const { pages, ...copy } = await loadSite();
  expect(pages.home.title).toBeTruthy();
  expect(copy).toEqual(referenceCopy());
});

test('every string is non-empty', async () => {
  const empty = strings(await loadSite())
    .filter(([path, value]) => value.length === 0 && !PLACEHOLDER.test(path))
    .map(([path]) => path);
  expect(empty).toEqual([]);
});

test('the only empty strings are the build-metric placeholders', async () => {
  const empty = strings(await loadSite()).filter(([, value]) => value.length === 0);
  const site = await loadSite();
  expect(empty.map(([path]) => path)).toEqual(
    site.buildStory.metrics.map((_, i) => `site.buildStory.metrics.${i}.1`),
  );
});

test('every selected-work href is an in-page anchor', async () => {
  const { selected } = await loadSite();
  expect(selected.items.length).toBeGreaterThan(0);
  for (const item of selected.items) expect(item.href).toMatch(/^#/);
});

test('a missing key fails with an error naming its path', async () => {
  const copy = structuredClone(await loadSite()) as Record<string, Record<string, unknown>>;
  delete copy.hero.eyebrow;
  const result = SiteSchema.safeParse(copy);
  expect(result.success).toBe(false);
  expect(z.prettifyError(result.error!)).toContain('at hero.eyebrow');
});

test('an unknown key, an empty string and a bad href are rejected', async () => {
  const site = await loadSite();
  const withExtra = { ...site, hero: { ...site.hero, typo: 'x' } };
  const withEmpty = { ...site, nav: { ...site.nav, work: '' } };
  const withBadHref = structuredClone(site);
  withBadHref.selected.items[0].href = 'platform';

  expect(SiteSchema.safeParse(withExtra).success).toBe(false);
  expect(SiteSchema.safeParse(withEmpty).success).toBe(false);
  const bad = SiteSchema.safeParse(withBadHref);
  expect(bad.success).toBe(false);
  expect(z.prettifyError(bad.error!)).toContain('at selected.items[0].href');
});
