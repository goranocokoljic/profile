import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { site } from '../src/data/site';

const { decisions } = site.pages.build;
const { markup } = site;
const section = (page: Page) => page.locator('main section.decisions');

test('/build has the decisions section with six items and one repo link', async ({ page }) => {
  await page.goto('/build');
  await expect(section(page).locator('h2')).toHaveText(decisions.heading);
  const items = section(page).locator('article.decision');
  await expect(items).toHaveCount(6);
  await expect(items.locator('h3')).toHaveText(decisions.items.map((i) => i.title));
  await expect(items.locator('p')).toHaveText(decisions.items.map((i) => i.body));

  const links = section(page).locator('a');
  await expect(links).toHaveCount(1);
  await expect(links).toHaveAttribute('href', markup.repoHref);
  await expect(links).toHaveAttribute('target', '_blank');
  await expect(links).toHaveAttribute('rel', /\bnoopener\b/);
  await expect(links).toHaveText(`${decisions.sourceLink} ${markup.newTabLabel}`);
});

test('the decisions sit after the intro and before the dashboard', async ({ page }) => {
  await page.goto('/build');
  const order = await page
    .locator('.build-intro, section.decisions, #dashboard')
    .evaluateAll((els) => els.map((el) => el.id || el.classList[0]));
  expect(order).toEqual(['build-intro', 'decisions', 'dashboard']);
});

test('decisions headings go h2 → h3 and axe finds no violations in the section', async ({ page }) => {
  await page.goto('/build');
  const levels = await section(page)
    .locator('h1, h2, h3, h4, h5, h6')
    .evaluateAll((hs) => hs.map((h) => Number(h.tagName[1])));
  expect(levels).toEqual([2, 3, 3, 3, 3, 3, 3]);

  const results = await new AxeBuilder({ page }).include('section.decisions').analyze();
  expect(results.violations).toEqual([]);
  expect(results.passes.map((r) => r.id)).toContain('heading-order');
});

// Same type scale and spacing as the role-fit grid on the homepage: read the
// homepage's computed values and compare, at desktop and phone width.
const PROPS = {
  section: ['padding-top', 'padding-bottom'],
  h2: ['font-size', 'line-height', 'letter-spacing'],
  grid: ['grid-template-columns', 'column-gap', 'row-gap'],
  h3: ['font-size', 'margin-bottom'],
  p: ['font-size', 'line-height', 'color'],
} as const;
type Part = keyof typeof PROPS;

async function styles(page: Page, selectors: Record<Part, string>): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const part of Object.keys(PROPS) as Part[]) {
    const values = await page.locator(selectors[part]).first().evaluate(
      (el, props) => props.map((p) => getComputedStyle(el).getPropertyValue(p)),
      [...PROPS[part]],
    );
    PROPS[part].forEach((p, i) => (out[`${part} ${p}`] = values[i]));
  }
  return out;
}

// 768 sits just under the 900px switch to one column.
for (const [width, columns] of [[1440, 2], [768, 1], [390, 1]] as const) {
  test(`decisions use the role-fit type scale and ${columns} column(s) at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const roleFit = await styles(page, {
      section: 'section.role-fit',
      h2: '.role-fit h2',
      grid: '.role-grid',
      h3: '.role-item h3',
      p: '.role-item p',
    });
    await page.goto('/build');
    const ours = await styles(page, {
      section: 'section.decisions',
      h2: '.decisions h2',
      grid: '.decision-grid',
      h3: '.decision h3',
      p: '.decision p',
    });
    // The role-fit grid has an ordinal column inside each item, so its track
    // widths differ; compare the track count instead.
    const tracks = (v: string) => v.split(' ').length;
    expect(tracks(ours['grid grid-template-columns'])).toBe(columns);
    expect(tracks(roleFit['grid grid-template-columns'])).toBe(columns);
    delete ours['grid grid-template-columns'];
    delete roleFit['grid grid-template-columns'];
    expect(ours).toEqual(roleFit);
  });
}

// Each item is a claim about this repository. These fail when the file that
// backs a claim stops backing it, so the copy cannot silently go stale.
test.describe('the decisions are true of the repository', () => {
  const read = (f: string) => readFileSync(f, 'utf8');

  test('Astro, static output: the config prerenders every route', () => {
    expect(read('astro.config.mjs')).toMatch(/output:\s*'static'/);
  });

  test('One island: the homepage has one astro-island and loads only its runtime', () => {
    const html = read('dist/index.html');
    expect(html.match(/<astro-island\b/g)).toHaveLength(1);
    // Only Astro's island runtime, externalized under /_astro/: no other script.
    const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const tag of scripts) expect(tag).toMatch(/\bsrc="\/_astro\/[^"]+"/);
  });

  test('Cloudflare Worker with static assets: wrangler.jsonc has assets and no server entry', () => {
    const config = read('wrangler.jsonc');
    expect(config).toMatch(/"assets":\s*\{\s*"directory":\s*"\.\/dist"/);
    expect(config).not.toMatch(/"main"\s*:/);
  });

  test('Typed content: site.ts is parsed against the schema at import', () => {
    expect(read('src/data/site.ts')).toMatch(/export const site = SiteSchema\.parse\(/);
  });

  test('Checks on every PR: CI runs check, build and test on pull requests', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toMatch(/^\s*pull_request:/m);
    for (const step of ['npm run check', 'npm run build', 'npm run test']) expect(ci).toContain(`run: ${step}`);
    const check = JSON.parse(read('package.json')).scripts.check as string;
    for (const tool of ['astro check', 'tsc', 'eslint', 'stylelint']) expect(check).toContain(tool);
    expect(read('tests/polish.spec.ts')).toMatch(/const WIDTHS = \[\d+, \d+, \d+, \d+\] as const;/);
  });
});
