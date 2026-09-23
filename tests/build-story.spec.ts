import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { site } from '../src/data/site';
import { fmtUsd } from '../src/build/format';
import type { Payload } from '../src/build/types';

const { buildStory, markup } = site;
const card = markup.buildRecord;
const breakdown = site.pages.build.findingsBreakdown;
const section = (page: Page) => page.locator('main section#build-story');
const trail = (page: Page) => section(page).locator('article.task-trail');
const payload = (): Payload => JSON.parse(readFileSync('dist/build/data.json', 'utf8'));

// The island hydrates on visibility; Astro drops `ssr` once it has.
async function hydrated(page: Page): Promise<void> {
  await trail(page).scrollIntoViewIfNeeded();
  await expect(page.locator('astro-island:not([ssr])')).toHaveCount(1);
}

// The findings KPI's sub-lines on the card: the breakdown, then "n fixed before merge".
// No-break spaces (number to label) read as plain spaces here.
const cardFindingsSubs = async (page: Page) =>
  (await trail(page).locator('dl > div').nth(2).locator('dd + dd').allTextContents()).map((t) => t.replace(/ /g, ' '));

const cardKpis = (page: Page) =>
  trail(page)
    .locator('dl > div')
    .evaluateAll((els) => els.map((el) => [el.querySelector('dt')!.textContent, el.querySelector('dd')!.textContent]));

test('build story is #build-story, after VisMedic and before background, with its copy from site.ts', async ({ page }) => {
  await page.goto('/');
  const s = section(page);
  await expect(s).toHaveAccessibleName(buildStory.title);
  await expect(s.locator('.eyebrow')).toHaveText(buildStory.eyebrow);
  await expect(s.locator('h2')).toHaveText(buildStory.title);
  await expect(s.locator('.build-story-top p')).toHaveText(buildStory.intro);
  await expect(s.locator('.intent-triad li')).toHaveText([...buildStory.triad]);
  await expect(s.locator('.build-pipeline li span')).toHaveText(buildStory.flow.map((_, i) => String(i + 1).padStart(2, '0')));
  await expect(s.locator('.build-pipeline li strong')).toHaveText([...buildStory.flow]);
  await expect(s.locator('.build-story-mid > div > p')).toHaveText(buildStory.body);
  await expect(trail(page).locator(':scope > .mono-label')).toHaveText(card.label);
  await expect(trail(page).locator('h3')).toHaveText(buildStory.trailTitle);
  await expect(trail(page).locator(':scope > p')).toHaveText(buildStory.trailNote);
  await expect(trail(page).getByRole('link', { name: buildStory.cta })).toHaveAttribute('href', '/build');
  const order = await page.locator('main > section[id]').evaluateAll((els) => els.map((el) => el.id));
  expect(order.slice(order.indexOf('build-story') - 1, order.indexOf('build-story') + 2)).toEqual(['vismedic', 'build-story', 'about']);
});

test('the hero secondary action scrolls to the build story', async ({ page }) => {
  await page.goto('/');
  await page.locator('main .hero').getByRole('link', { name: site.hero.secondary }).click();
  await expect(page).toHaveURL(/#build-story$/);
  await expect(section(page)).toBeInViewport();
});

test('/ has exactly one hydrated island, /build has none', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('astro-island')).toHaveCount(1);
  await expect(page.locator('astro-island')).toHaveAttribute('client', 'visible');
  await page.goto('/build');
  await expect(page.locator('astro-island')).toHaveCount(0);
});

test('card KPIs equal the /build KPI row for the site dataset', async ({ page }) => {
  await page.goto('/build');
  const tiles = await page
    .locator('#dashboard .kpis .tile')
    .evaluateAll((els) => els.map((el) => ['.label', '.value', '.sub'].map((s) => el.querySelector(s)!.textContent!)));
  const tile = (label: string) => tiles.find(([l]) => l === label)!;
  const okRuns = /^(\d+) ok/.exec(tile('Runs')[2])![1];
  // /build has no tile for distinct completed issues; count them from the data.
  const tasks = payload().datasets.site.tasks;
  const completed = new Set(tasks.filter((t) => t.outcome === 'ok').map((t) => t.issue)).size;
  expect(tasks.length).toBeGreaterThan(0);

  await page.goto('/');
  await hydrated(page);
  expect(await cardKpis(page)).toEqual([
    [buildStory.metrics[0][0], String(completed)],
    [buildStory.metrics[1][0], okRuns],
    [buildStory.metrics[2][0], tile('Review findings')[1]],
    [buildStory.metrics[3][0], tile('Wall time')[1]],
    [buildStory.metrics[4][0], tile('Billed cost')[1]],
  ]);
  // Same breakdown under both findings KPIs, and it adds up to the value.
  const summary = payload().datasets.site.summary;
  const subs = await cardFindingsSubs(page);
  expect(subs[0]).toBe(tile('Review findings')[2].replace(/ /g, ' '));
  const parts = /^([\d,]+) \S+ · ([\d,]+) \S+ · ([\d,]+) \S+$/.exec(subs[0])!.slice(1).map((n) => Number(n.replace(/,/g, '')));
  expect(parts.reduce((a, n) => a + n, 0)).toBe(summary.findingsTotal);
  expect(parts[0]).toBe(summary.findingsBySeverity.blocker);
  expect(subs.slice(1)).toEqual(summary.dispositions ? [`${summary.dispositions.fixed.toLocaleString('en-US')} ${breakdown.fixed}`] : []);
});

test('the toggle shows and hides the last 5 runs', async ({ page }) => {
  const recent = [...payload().datasets.site.tasks].sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts)).slice(0, 5);
  await page.goto('/');
  await hydrated(page);
  const toggle = trail(page).getByRole('button', { name: card.showRuns });
  const runs = trail(page).getByRole('table', { name: card.runsCaption });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(runs).toBeHidden();

  await toggle.click();
  const hide = trail(page).getByRole('button', { name: card.hideRuns });
  await expect(hide).toHaveAttribute('aria-expanded', 'true');
  await expect(runs).toBeVisible();
  await expect(runs.locator('thead th')).toHaveText([card.columns.issue, card.columns.outcome, card.columns.billed]);
  const rows = await runs.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent)));
  expect(rows).toEqual(recent.map((t) => [`#${t.issue}`, t.outcome, fmtUsd(t.billed_cost_usd)]));
  const controls = await hide.getAttribute('aria-controls');
  expect(controls).toBeTruthy();
  await expect(runs).toHaveAttribute('id', controls!);

  await hide.press('Enter');
  await expect(runs).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

// Serves / with the island's summary prop replaced, for states the real data
// does not have. Astro serialises props as [type, value] pairs (0 plain,
// 1 array). The new text differs from the server HTML, so React renders the
// card from these props on hydration.
async function routeSummary(page: Page, summary: object): Promise<void> {
  const ser = (v: unknown): unknown =>
    Array.isArray(v) ? [1, v.map(ser)] : v && typeof v === 'object' ? [0, Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ser(x)]))] : [0, v];
  await page.route((url) => url.pathname === '/', async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/(<astro-island[^>]*? props=")([^"]*)(")/, (_, open: string, raw: string, close: string) => {
      const props = JSON.parse(raw.replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
      props.summary = ser(summary);
      return open + JSON.stringify(props).replace(/&/g, '&amp;').replace(/"/g, '&quot;') + close;
    });
    await route.fulfill({ response, body: html });
  });
}

const totals = { tasksCompleted: 3, successfulRuns: 4, findings: 12, breakdown: { blocker: 2, medium: 3, low: 7 }, fixed: 5, wallSec: 3600, billedUsd: 9.5 };
const run = { issue: 98, attempt: 1, outcome: 'failed', billedUsd: 1.25 };

test('the latest run links to its issue and PR when both are known', async ({ page }) => {
  await routeSummary(page, {
    ...totals,
    latest: { issue: 99, title: 'Known issue', url: 'https://github.com/o/r/issues/99', pr: 120, prUrl: 'https://github.com/o/r/pull/120', outcome: 'ok', ts: '2026-07-01T22:00:00Z' },
    recent: [run],
  });
  await page.goto('/');
  await hydrated(page);
  const latest = trail(page).locator('p', { hasText: card.latest });
  await expect(latest).toHaveText(`${card.latest} #99 Known issue · ok · ${card.pr} #120 · 2026-07-01`);
  await expect(latest.getByRole('link', { name: '#99' })).toHaveAttribute('href', 'https://github.com/o/r/issues/99');
  await expect(latest.getByRole('link', { name: `${card.pr} #120` })).toHaveAttribute('href', 'https://github.com/o/r/pull/120');
  expect((await cardKpis(page)).map(([, v]) => v)).toEqual(['3', '4', '12', '1h ', '$9.50']);
  expect(await cardFindingsSubs(page)).toEqual([
    `2 ${breakdown.blocker} · 3 ${breakdown.medium} · 7 ${breakdown.low}`,
    `5 ${breakdown.fixed}`,
  ]);
});

test('a latest run with no metadata shows its number without links', async ({ page }) => {
  await routeSummary(page, {
    ...totals,
    latest: { issue: 97, title: null, url: null, pr: null, prUrl: null, outcome: 'incomplete', ts: '2026-07-02T08:00:00Z' },
    recent: [run],
  });
  await page.goto('/');
  await hydrated(page);
  const latest = trail(page).locator('p', { hasText: card.latest });
  await expect(latest).toHaveText(`${card.latest} #97 · incomplete · 2026-07-02`);
  await expect(latest.getByRole('link')).toHaveCount(0);
});

test('with no recorded dispositions the card shows the breakdown but no fixed line', async ({ page }) => {
  await routeSummary(page, {
    ...totals,
    fixed: null,
    latest: { issue: 97, title: null, url: null, pr: null, prUrl: null, outcome: 'ok', ts: '2026-07-02T08:00:00Z' },
    recent: [run],
  });
  await page.goto('/');
  await hydrated(page);
  expect(await cardFindingsSubs(page)).toEqual([`2 ${breakdown.blocker} · 3 ${breakdown.medium} · 7 ${breakdown.low}`]);
});

test('with no runs the card shows dashes and the empty state', async ({ page }) => {
  await routeSummary(page, {
    tasksCompleted: 0, successfulRuns: 0, findings: 0, breakdown: { blocker: 0, medium: 0, low: 0 }, fixed: null, wallSec: 0, billedUsd: 0, latest: null, recent: [],
  });
  await page.goto('/');
  await hydrated(page);
  await expect(trail(page).getByText(card.empty, { exact: true })).toBeVisible();
  expect((await cardKpis(page)).map(([, v]) => v)).toEqual(['—', '—', '—', '—', '—']);
  expect(await cardFindingsSubs(page)).toEqual([]);
  await expect(trail(page).getByRole('button')).toHaveCount(0);
  await expect(trail(page).getByRole('link', { name: buildStory.cta })).toBeVisible();
});

test('/ hydrates the card under CSP default-src self with no outside requests', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.route((url) => url.pathname === '/', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': "default-src 'self'" } });
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __csp: string[] }).__csp ??= [];
      (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  await page.goto('/');
  await hydrated(page);
  await trail(page).getByRole('button', { name: card.showRuns }).click();
  await expect(trail(page).getByRole('table')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? [])).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.filter((u) => !u.startsWith(origin))).toEqual([]);
});

// The component and every chunk it imports (format helpers, the React
// runtime shim, the CSS-module map). The renderer (react-dom client) is the
// framework cost, not the component's, and is left out.
test('the island component and its imports are under 6 KB gzipped', () => {
  const html = readFileSync('dist/index.html', 'utf8');
  const entry = /<astro-island[^>]*? component-url="\/_astro\/([^"]+)"/.exec(html)![1];
  const seen = new Set<string>();
  const walk = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    const js = readFileSync(`dist/_astro/${file}`, 'utf8');
    for (const m of js.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)) walk(m[1]);
  };
  walk(entry);
  expect(seen.size).toBeGreaterThan(1);
  const total = [...seen].reduce((a, f) => a + gzipSync(readFileSync(`dist/_astro/${f}`)).length, 0);
  expect(total).toBeLessThan(6 * 1024);
});

// The reference page, served from this origin, so both render with the same
// fonts and viewport.
async function openReference(page: Page): Promise<void> {
  await page.route('**/__ref/**', (route) => {
    const file = new URL(route.request().url()).pathname.replace('/__ref/', '') || 'index.html';
    const type = file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html';
    return route.fulfill({ contentType: type, body: readFileSync(`design-reference/site/${file}`) });
  });
  await page.goto('/__ref/index.html');
}

// Computed styles the reference and the site must share, per element.
const PROPS = ['padding-top', 'padding-bottom', 'background-color', 'font-size', 'font-family', 'grid-template-columns', 'min-height', 'letter-spacing'];
const PARTS: [string, string, string][] = [
  ['section', '.build-story', ''],
  ['eyebrow', '.build-story .eyebrow', '.eyebrow'],
  ['title', '.build-story h2', 'h2'],
  ['intro', '.build-story-top p', '.build-story-top p'],
  ['triad', '.intent-triad', '.intent-triad'],
  ['triad item', '.intent-triad > *', '.intent-triad > *'],
  ['pipeline', '.build-pipeline', '.build-pipeline'],
  ['step', '.build-pipeline > *', '.build-pipeline > *'],
  ['step number', '.build-pipeline span', '.build-pipeline span'],
  ['mid', '.build-story-mid', '.build-story-mid'],
  ['card', '.task-trail', '.task-trail'],
  ['card label', '.task-trail .mono-label', '.task-trail > .mono-label'],
  ['card title', '.task-trail h3', '.task-trail h3'],
  ['card note', '.task-trail > p', '.task-trail > p'],
  ['kpi label', '.glance-metrics span', '.task-trail dt'],
];

const styleOf = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el, props) => {
    const cs = getComputedStyle(el);
    // Column counts, not track sizes: the widths differ with content.
    return props.map((p) => (p === 'grid-template-columns' ? String(cs.gridTemplateColumns.split(' ').length) : cs.getPropertyValue(p)));
  }, PROPS);

for (const width of [1440, 390]) {
  test(`build story matches the reference at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openReference(page);
    const ref: Record<string, string[]> = {};
    for (const [name, refSel] of PARTS) ref[name] = await styleOf(page, refSel);
    await page.goto('/');
    for (const [name, , ourSel] of PARTS) expect(await styleOf(page, `#build-story ${ourSel}`.trim()), name).toEqual(ref[name]);
    // The island's latest-run label uses the same global .mono-label type.
    const label = trail(page).locator('p .mono-label');
    for (const p of ['font-family', 'font-size', 'font-weight']) await expect(label).toHaveCSS(p, await trail(page).locator(':scope > .mono-label').evaluate((el, q) => getComputedStyle(el).getPropertyValue(q), p));
    // Five KPI columns on desktop, one on a phone, as the reference's .glance-metrics.
    expect(await page.locator('#build-story dl').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(width === 1440 ? 5 : 1);
  });
}

// The reference shows no KPI values; real ones must fit their columns at
// every width, including the narrowest two-column desktop.
for (const width of [1440, 1000, 700, 390]) {
  test(`KPI values fit their columns at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await hydrated(page);
    const spill = await trail(page)
      .locator('dl > div')
      .evaluateAll((els) =>
        els.map((el) => {
          const box = el.getBoundingClientRect();
          const pad = parseFloat(getComputedStyle(el).paddingRight);
          const dd = el.querySelector('dd')!;
          const range = document.createRange();
          range.selectNodeContents(dd);
          return range.getBoundingClientRect().right - (box.right - pad);
        }),
      );
    for (const s of spill) expect(s).toBeLessThanOrEqual(0);
  });
}

test('axe finds no serious or critical issues in the build story', async ({ page }) => {
  await page.goto('/');
  await hydrated(page);
  await trail(page).getByRole('button', { name: card.showRuns }).click();
  const results = await new AxeBuilder({ page }).include('#build-story').analyze();
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
});
