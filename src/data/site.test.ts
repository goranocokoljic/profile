import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test, expect } from '@playwright/test';
import { z } from 'zod';
import { SiteSchema, type Site } from './site.schema';

// Turn a ZodError into a readable list of paths; anything else passes through.
function readable<T>(load: () => T | Promise<T>): Promise<T> {
  return Promise.resolve()
    .then(load)
    .catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        throw new Error(`src/data/site.ts does not match SiteSchema:\n${z.prettifyError(err)}`);
      }
      throw err;
    });
}

// Import site.ts here rather than at the top, so a failed parse is reported
// through `readable` instead of as a raw ZodError dump.
const loadSite = (): Promise<Site> => readable(async () => (await import('./site')).site);

function referenceCopy(): unknown {
  const source = readFileSync(new URL('../../design-reference/site/content.js', import.meta.url), 'utf8');
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

test('site.ts parses against the schema', async () => {
  await expect(loadSite()).resolves.toBeDefined();
});

test('copy matches content.js verbatim', async () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { pages, markup, ...copy } = await loadSite();
  expect(copy).toEqual(referenceCopy());
});

test('every string is non-empty except the build-metric placeholders', async () => {
  // buildStory metric values are empty in the reference; build data fills them.
  const site = await loadSite();
  const empty = strings(site)
    .filter(([, value]) => value.length === 0)
    .map(([path]) => path);
  expect(empty).toEqual(site.buildStory.metrics.map((_, i) => `site.buildStory.metrics.${i}.1`));
});

test('every selected-work href is an in-page anchor', async () => {
  const { selected } = await loadSite();
  expect(selected.items.length).toBeGreaterThan(0);
  for (const item of selected.items) expect(item.href).toMatch(/^#/);
});

test('a missing key fails with a readable error naming its path', async () => {
  const site = await loadSite();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { eyebrow, ...hero } = site.hero;
  const broken = { ...site, hero };
  const failure = readable(() => SiteSchema.parse(broken));
  await expect(failure).rejects.toThrow('src/data/site.ts does not match SiteSchema');
  await expect(failure).rejects.toThrow('→ at hero.eyebrow');
});

test('non-zod errors pass through unchanged', async () => {
  await expect(readable(() => { throw new Error('boom'); })).rejects.toThrow(/^boom$/);
});

test('an unknown key, an empty string and a bad href are rejected at their path or key', async () => {
  const site = await loadSite();
  const withBadHref = structuredClone(site);
  withBadHref.selected.items[0].href = 'platform';
  const cases: [unknown, string][] = [
    [{ ...site, hero: { ...site.hero, typo: 'x' } }, 'Unrecognized key: "typo"'],
    [{ ...site, nav: { ...site.nav, work: '' } }, 'at nav.work'],
    [withBadHref, 'at selected.items[0].href'],
  ];
  for (const [input, path] of cases) {
    const result = SiteSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(z.prettifyError(result.error!)).toContain(path);
  }
});

test('markup.cvHref accepts only a site-relative file path', async () => {
  const site = await loadSite();
  const parse = (cvHref: string) => SiteSchema.safeParse({ ...site, markup: { ...site.markup, cvHref } });
  expect(parse('/goran-ocokoljic-cv.pdf').success).toBe(true);
  expect(parse('/files/cv.pdf').success).toBe(true);
  for (const bad of ['#', 'cv.pdf', '//evil.example/cv.pdf', 'https://example.com/cv.pdf', 'javascript:alert(1)', '/']) {
    const result = parse(bad);
    expect(result.success, bad).toBe(false);
    expect(z.prettifyError(result.error!)).toContain('at markup.cvHref');
  }
});

test('markup.pureContextHref accepts only an absolute https URL', async () => {
  const site = await loadSite();
  const parse = (pureContextHref: string) =>
    SiteSchema.safeParse({ ...site, markup: { ...site.markup, pureContextHref } });
  expect(parse('https://github.com/goranocokoljic/pure-context').success).toBe(true);
  for (const bad of ['http://github.com/x', 'javascript:alert(1)', '/pure-context', '#ai', '']) {
    const result = parse(bad);
    expect(result.success, bad).toBe(false);
    expect(z.prettifyError(result.error!)).toContain('at markup.pureContextHref');
  }
});

test('markup.repoHref accepts only an absolute https URL', async () => {
  const site = await loadSite();
  const parse = (repoHref: string) => SiteSchema.safeParse({ ...site, markup: { ...site.markup, repoHref } });
  expect(parse('https://github.com/goranocokoljic/profile').success).toBe(true);
  for (const bad of ['http://github.com/goranocokoljic/profile', 'javascript:alert(1)', '/profile', '#decisions', '']) {
    const result = parse(bad);
    expect(result.success, bad).toBe(false);
    expect(z.prettifyError(result.error!)).toContain('at markup.repoHref');
  }
});

test('pages.build.decisions holds exactly six items', async () => {
  const site = await loadSite();
  const { build } = site.pages;
  const parse = (items: Site['pages']['build']['decisions']['items']) =>
    SiteSchema.safeParse({ ...site, pages: { ...site.pages, build: { ...build, decisions: { ...build.decisions, items } } } });
  expect(parse(build.decisions.items).success).toBe(true);
  for (const items of [build.decisions.items.slice(0, 5), [...build.decisions.items, build.decisions.items[0]]]) {
    const result = parse(items);
    expect(result.success, `${items.length} items`).toBe(false);
    expect(z.prettifyError(result.error!)).toContain('at pages.build.decisions.items');
  }
});

test('pages.build.footnotes.trend.site rejects a typed run count', async () => {
  const site = await loadSite();
  const { build } = site.pages;
  const parse = (text: string) =>
    SiteSchema.safeParse({ ...site, pages: { ...site.pages, build: { ...build, footnotes: { ...build.footnotes, trend: { ...build.footnotes.trend, site: text } } } } });
  expect(parse(build.footnotes.trend.site).success).toBe(true);
  for (const bad of ['Trend over 15 runs.', 'Across 3 runs; a signal.', '']) {
    const result = parse(bad);
    expect(result.success, bad).toBe(false);
    expect(z.prettifyError(result.error!)).toContain('at pages.build.footnotes.trend.site');
  }
});

test('the trend footnotes make no causal claim', async () => {
  const { trend } = (await loadSite()).pages.build.footnotes;
  for (const note of Object.values(trend)) expect(note).not.toMatch(/proof|proves|paying off/i);
});
