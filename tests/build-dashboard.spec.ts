import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Payload } from '../src/build/types';
import { site } from '../src/data/site';

const { build } = site.pages;
const payload = (): Payload => JSON.parse(readFileSync('dist/build/data.json', 'utf8'));
const dash = (page: Page) => page.locator('#dashboard');
const tiles = (root: Locator) =>
  root.locator('.tile').evaluateAll((els) => els.map((el) => (el as HTMLElement).innerText.split('\n')));

// The reference dashboard, served from this origin with /api/data answering
// from the same payload the site ships. Both render in the same browser and
// time zone, so every number must agree.
async function openReference(page: Page, dataset: 'toprope' | 'site'): Promise<void> {
  const ds = payload().datasets[dataset];
  const html = readFileSync('design-reference/dashboard/index.html', 'utf8');
  await page.route('**/__reference', (route) => route.fulfill({ contentType: 'text/html', body: html }));
  await page.route('**/api/data', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ tasks: ds.tasks, reviewCycles: ds.reviewCycles, epics: ds.epics, lessons: ds.lessons, files: ds.files }),
    }),
  );
  await page.goto('/__reference');
  await expect(page.locator('#kpis .tile')).toHaveCount(6);
}

// Serves /build with the embedded payload rewritten, for states the real data
// does not have.
async function routeBuildPayload(page: Page, edit: (p: Payload) => void): Promise<void> {
  await page.route('**/build', async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    const next = html.replace(/(<script type="application\/json" id="build-data">)([\s\S]*?)(<\/script>)/, (_, open: string, raw: string, close: string) => {
      const p = JSON.parse(raw) as Payload;
      edit(p);
      return open + JSON.stringify(p).replace(/</g, '\\u003c') + close;
    });
    await route.fulfill({ response, body: next });
  });
}

const tableTexts = (root: Locator) =>
  root.locator('table.data tr').evaluateAll((rows) => rows.map((r) => (r as HTMLElement).innerText.replace(/\s+/g, ' ').trim()));

for (const dataset of ['toprope', 'site'] as const) {
  test(`${dataset} dataset reproduces the reference dashboard's numbers`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openReference(page, dataset);
    const refKpis = await tiles(page.locator('#kpis'));
    const refAsof = await page.locator('#asof').innerText();
    const refCards: Record<string, string[]> = {};
    for (const id of ['cost', 'trend', 'phases', 'sev']) {
      await page.locator(`#card-${id} .tbl-toggle`).click();
      refCards[id] = await tableTexts(page.locator(`#card-${id}`));
    }
    const refEpics = await tableTexts(page.locator('#card-epics'));
    const refLessons = await tableTexts(page.locator('#card-lessons'));
    const refRuns = await page.locator('#card-runs tbody tr').count();

    await page.goto(`/build#dataset=${dataset}`);
    const root = dash(page);
    // The findings tile's sub-line is this site's breakdown, not the
    // reference's "caught across all cycles"; label and value still match.
    const ours = await tiles(root.locator('.kpis'));
    expect(ours.map(([l, v, sub]) => (l === 'Review findings' ? [l, v] : [l, v, sub]))).toEqual(
      refKpis.map(([l, v, sub]) => (l === 'Review findings' ? [l, v] : [l, v, sub])),
    );
    await expect(root.locator('.asof')).toHaveText(refAsof);
    const cards = root.locator('.grid').first().locator('.card');
    for (const [i, id] of ['cost', 'trend', 'phases', 'sev'].entries()) {
      await cards.nth(i).getByRole('button', { name: 'table' }).click();
      expect(await tableTexts(cards.nth(i)), id).toEqual(refCards[id]);
    }
    const bottom = root.locator('.grid-bottom .card');
    expect(await tableTexts(bottom.nth(0))).toEqual(refEpics);
    expect(await tableTexts(bottom.nth(1))).toEqual(refLessons);
    await expect(root.locator('table.runs tbody tr')).toHaveCount(refRuns);
  });
}

test('toprope KPI tiles show the recorded track record', async ({ page }) => {
  // Pinned so a renderer change that moves both sides of the parity test together still fails.
  await page.goto('/build#dataset=toprope');
  const values = await dash(page).locator('.kpis .value').allInnerTexts();
  expect(values).toEqual(['172', '83%', '$3,731', '163h 28m', '$15.71', '2,735']);
});

test('the findings tile shows the severity breakdown for both datasets', async ({ page }) => {
  const b = build.findingsBreakdown;
  for (const dataset of ['site', 'toprope'] as const) {
    const { findingsBySeverity: sev } = payload().datasets[dataset].summary;
    await page.goto(`/build#dataset=${dataset}`);
    const tile = dash(page).locator('.kpis .tile', { hasText: 'Review findings' });
    const n = (x: number) => x.toLocaleString('en-US');
    await expect(tile.locator('.sub')).toHaveText(`${n(sev.blocker)} ${b.blocker} · ${n(sev.medium)} ${b.medium} · ${n(sev.low + sev.style)} ${b.low}`);
  }
  // Pinned, so an exporter and renderer drifting together still fails.
  await expect(dash(page).locator('.kpis .tile', { hasText: 'Review findings' }).locator('.sub')).toHaveText(`256 ${b.blocker} · 854 ${b.medium} · 1,625 ${b.low}`);
});

test('the KPI row and the trend chart carry the footnotes from site.ts', async ({ page }) => {
  for (const dataset of ['site', 'toprope'] as const) {
    await page.goto(`/build#dataset=${dataset}`);
    await expect(dash(page).locator('.kpis + .footnote')).toHaveText(build.footnotes.kpis);
    const trend = dash(page).locator('.card', { has: page.getByRole('heading', { name: 'Findings in review cycle 1 per run' }) });
    await expect(trend.locator('.footnote')).toHaveText(build.footnotes.trend[dataset]);
    await expect(trend.locator('.footnote')).not.toContainText(/proof|paying off/i);
  }
});

test('the runs table matches the reference row for row', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openReference(page, 'toprope');
  const ref = await page.locator('#card-runs tbody tr').evaluateAll((rows) => rows.map((r) => (r as HTMLElement).innerText.replace(/\s+/g, ' ').trim()));
  await page.goto('/build#dataset=toprope');
  const ours = await dash(page).locator('table.runs tbody tr').evaluateAll((rows) => rows.map((r) => (r as HTMLElement).innerText.replace(/\s+/g, ' ').trim()));
  expect(ours).toEqual(ref);
});

test('dataset switch defaults to this site and is reflected in the URL hash', async ({ page }) => {
  await page.goto('/build');
  const group = page.getByRole('group', { name: build.datasetLabel });
  const siteBtn = group.getByRole('button', { name: build.datasets.site });
  const toprope = group.getByRole('button', { name: build.datasets.toprope });
  await expect(siteBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(toprope).toHaveAttribute('aria-pressed', 'false');
  const siteRuns = payload().datasets.site.tasks.length;
  await expect(dash(page).locator('.kpis .value').first()).toHaveText(String(siteRuns));

  await toprope.click();
  await expect(page).toHaveURL(/#dataset=toprope$/);
  await expect(toprope).toHaveAttribute('aria-pressed', 'true');
  await expect(dash(page).locator('.kpis .value').first()).toHaveText('172');

  // Linkable: a fresh load of the URL keeps the selection.
  await page.reload();
  await expect(page.getByRole('button', { name: build.datasets.toprope })).toHaveAttribute('aria-pressed', 'true');

  // Editing the hash by hand switches too; an unknown dataset is ignored.
  await page.evaluate(() => (location.hash = 'dataset=site'));
  await expect(page.getByRole('button', { name: build.datasets.site })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/build#dataset=nope');
  await expect(page.getByRole('button', { name: build.datasets.site })).toHaveAttribute('aria-pressed', 'true');
});

test('a site dataset with no runs shows the empty state and dashes', async ({ page }) => {
  await routeBuildPayload(page, (p) => {
    p.datasets.site.tasks = [];
  });
  await page.goto('/build');
  const root = dash(page);
  await expect(root.locator('.empty-dataset')).toHaveText(build.empty);
  await expect(root.locator('.empty-dataset')).toBeVisible();
  await expect(root.locator('.kpis .value')).toHaveText(['—', '—', '—', '—', '—', '—']);
  await expect(root.getByRole('heading', { name: 'Runs' })).toBeHidden();
  await expect(root.locator('.grid').first()).toBeHidden();
  await expect(page.getByRole('button', { name: build.datasets.site })).toHaveAttribute('aria-pressed', 'true');

  // The other dataset still renders in full.
  await page.getByRole('button', { name: build.datasets.toprope }).click();
  await expect(root.locator('.empty-dataset')).toBeHidden();
  await expect(root.locator('table.runs')).toBeVisible();
});

test('site runs link the issue and the merged PR; toprope cells stay plain', async ({ page }) => {
  const { site: ds } = payload().datasets;
  await page.goto('/build');
  const runs = dash(page).locator('table.runs');
  await expect(runs.locator('thead th')).toHaveText(['', 'Issue', 'PR', 'Date', 'Att.', 'Outcome', 'Model', 'Duration', 'Billed', 'Cycles', 'Findings'].map((l) => new RegExp(`^${l.replace('.', '\\.')}`)));
  const issue = ds.tasks[0].issue;
  const meta = ds.meta![String(issue)];
  const row = runs.locator(`tr[data-run^="${issue}|"]`).first();
  await expect(row.getByRole('link', { name: `#${issue}`, exact: true })).toHaveAttribute('href', meta.url);
  await expect(row.getByRole('link', { name: `#${meta.pr}`, exact: true })).toHaveAttribute('href', meta.prUrl!);

  await page.goto('/build#dataset=toprope');
  await expect(dash(page).locator('table.runs thead th')).toHaveCount(10);
  await expect(dash(page).locator('table.runs a')).toHaveCount(0);
});

test('an issue without meta and a run without a PR render plain cells', async ({ page }) => {
  await routeBuildPayload(page, (p) => {
    const meta = p.datasets.site.meta!;
    const [first, second] = p.datasets.site.tasks.map((t) => String(t.issue));
    delete meta[first];
    meta[second] = { ...meta[second], pr: null, prUrl: null };
  });
  await page.goto('/build');
  const ds = payload().datasets.site;
  const cells = (issue: number) => dash(page).locator(`table.runs tr[data-run^="${issue}|"]`).first().locator('td');
  await expect(cells(ds.tasks[0].issue).nth(1)).toHaveText(`#${ds.tasks[0].issue}`);
  await expect(cells(ds.tasks[0].issue).nth(1).locator('a')).toHaveCount(0);
  await expect(cells(ds.tasks[1].issue).nth(2)).toHaveText('—');
});

test('keyboard: toggle, period, sort headers and row expanders are operable', async ({ page }) => {
  await page.goto('/build');
  const root = dash(page);

  const toprope = page.getByRole('button', { name: build.datasets.toprope });
  await toprope.focus();
  await page.keyboard.press('Enter');
  await expect(toprope).toHaveAttribute('aria-pressed', 'true');
  // Redraws keep focus on the control that was used.
  await expect(page.getByRole('button', { name: build.datasets.toprope })).toBeFocused();

  const period = page.getByRole('group', { name: 'Period' });
  await page.keyboard.press('Tab');
  await expect(period.getByRole('button', { name: 'All time' })).toBeFocused();
  await period.getByRole('button', { name: '90d' }).focus();
  await page.keyboard.press('Space');
  await expect(period.getByRole('button', { name: '90d' })).toHaveAttribute('aria-pressed', 'true');

  await period.getByRole('button', { name: 'All time' }).focus();
  await page.keyboard.press('Enter');
  const billed = root.locator('table.runs thead').getByRole('button', { name: /^Billed/ });
  await billed.focus();
  await page.keyboard.press('Enter');
  await expect(root.locator('table.runs th', { has: page.getByRole('button', { name: /^Billed/ }) })).toHaveAttribute('aria-sort', 'ascending');
  await expect(root.locator('table.runs thead').getByRole('button', { name: /^Billed/ })).toBeFocused();
  const costs = await root.locator('table.runs tbody tr.expandable td:nth-child(8)').allInnerTexts();
  const nums = costs.map((c) => Number(c.replace(/[$,]/g, '')));
  expect(nums).toEqual([...nums].sort((a, b) => a - b));
  await page.keyboard.press('Enter');
  await expect(root.locator('table.runs th[aria-sort]')).toHaveAttribute('aria-sort', 'descending');

  const expander = root.locator('button.expander').first();
  await expander.focus();
  await page.keyboard.press('Enter');
  await expect(root.locator('button.expander').first()).toHaveAttribute('aria-expanded', 'true');
  await expect(root.locator('button.expander').first()).toBeFocused();
  await expect(root.locator('tr.detail-row')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(root.locator('tr.detail-row')).toHaveCount(0);
});

test('expanded run shows phases, review cycles and dispositions', async ({ page }) => {
  const task = payload().datasets.site.tasks.find((t) => t.review?.dispositions_total)!;
  await page.goto('/build');
  const row = dash(page).locator(`tr[data-run="${task.issue}|${task.ts}"]`);
  await row.locator('td').nth(3).click();
  const detail = dash(page).locator('tr.detail-row .detail');
  await expect(detail.locator('h3')).toHaveText(['Time by phase', 'Phases', 'Review cycles', 'Dispositions']);
  await expect(detail.getByRole('img', { name: 'Time by phase' }).locator('rect')).toHaveCount(task.phases.filter((p) => p.duration_sec > 0).length);
  const tables = detail.locator('table.data');
  await expect(tables.nth(0).locator('tbody tr')).toHaveCount(task.phases.length);
  await expect(tables.nth(1).locator('tbody tr')).toHaveCount(task.review_cycles.length);
  const d = task.review!.dispositions_total!;
  await expect(tables.nth(2).locator('tbody tr').last()).toHaveText(
    ['Total', d.fixed, d.rejected_intentional, d.rejected_wrong, d.deferred].join(''),
  );
  await expect(detail.locator('.footnote')).toContainText('phase costs are estimates');

  // A second click on the row closes it.
  await row.locator('td').nth(3).click();
  await expect(dash(page).locator('tr.detail-row')).toHaveCount(0);
});

test('a toprope run without dispositions shows no dispositions table', async ({ page }) => {
  const task = payload().datasets.toprope.tasks.find((t) => !t.review?.dispositions_total && !t.review_cycles.some((c) => c.dispositions))!;
  await page.goto('/build#dataset=toprope');
  await dash(page).locator(`tr[data-run="${task.issue}|${task.ts}"] button.expander`).click();
  await expect(dash(page).locator('tr.detail-row h3')).not.toContainText(['Dispositions']);
});

test('the estimate wording matches the reference footnotes', async ({ page }) => {
  await page.goto('/build#dataset=toprope');
  const notes = await dash(page).locator('.footnote').allInnerTexts();
  expect(notes).toEqual(
    expect.arrayContaining([
      'Totals use billed_cost_usd (authoritative). Hover a column for the day’s runs.',
      'Bottom bar: average share of estimated cost per phase — estimates show proportions only; all $ totals elsewhere use billed cost.',
    ]),
  );
});

test('/build makes no network requests beyond its own files and runs under CSP', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  const violations: string[] = [];
  await page.route('**/build', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': "default-src 'self'" } });
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __csp: string[] }).__csp ??= [];
      (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  await page.goto('/build#dataset=toprope');
  await expect(dash(page).locator('table.runs')).toBeVisible();
  // Hover and expand, so tooltips and detail rows draw too.
  await dash(page).locator('svg[aria-label="Billed cost per day"] rect[tabindex="0"]').first().hover();
  await dash(page).locator('button.expander').first().click();
  violations.push(...(await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? [])));
  expect(violations).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.filter((u) => !u.startsWith(origin))).toEqual([]);
  expect(requests.filter((u) => u.includes('data.json'))).toEqual([]);
});

test('hovering a cost column shows the day tooltip', async ({ page }) => {
  await page.goto('/build#dataset=toprope');
  await dash(page).locator('svg[aria-label="Billed cost per day"] rect[tabindex="0"]').first().hover();
  const tip = dash(page).locator('.tooltip');
  await expect(tip).toBeVisible();
  await expect(tip.locator('.tt-lab').first()).toHaveText('billed');
  await page.mouse.move(0, 0);
  await expect(tip).toBeHidden();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme} theme maps the dashboard colours onto the site tokens`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/build#dataset=toprope');
    const root = dash(page);
    const vars = await root.evaluate((el) => {
      const cs = getComputedStyle(el);
      const doc = getComputedStyle(document.documentElement);
      const v = (name: string, from = cs) => from.getPropertyValue(name).trim().toLowerCase();
      return {
        page: v('--page'),
        series1: v('--series-1'),
        bg: v('--bg', doc),
        ink: v('--ink', doc),
        teal: v('--teal', doc),
        accent: v('--dark-accent', doc),
        background: cs.backgroundColor,
      };
    });
    if (scheme === 'light') {
      expect(vars.page).toBe(vars.bg);
      expect(vars.series1).toBe(vars.teal);
      expect(vars.background).toBe('rgb(247, 247, 245)');
    } else {
      expect(vars.page).toBe(vars.ink);
      expect(vars.series1).toBe(vars.accent);
      expect(vars.background).toBe('rgb(17, 19, 24)');
    }
    // SVG fills are read from the variables at draw time.
    const bar = root.locator('svg[aria-label="Billed cost per day"] path').first();
    await expect(bar).toHaveAttribute('fill', new RegExp(vars.series1, 'i'));
    await expect(root.locator('.tile').first()).toHaveCSS('font-size', '14px');
    await expect(root.locator('.tile .value').first()).toHaveCSS('font-size', '26px');
    await root.screenshot({ path: info.outputPath(`build-${scheme}.png`) });
  });

  test(`axe finds no serious or critical issues on /build (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/build');
    await dash(page).locator('button.expander').first().click();
    await dash(page).getByRole('button', { name: 'table' }).first().click();
    const results = await new AxeBuilder({ page }).include('main').analyze();
    const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
}

test('the theme follows a live colour-scheme change', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/build#dataset=toprope');
  const bar = dash(page).locator('svg[aria-label="Billed cost per day"] path').first();
  const light = await bar.getAttribute('fill');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(bar).not.toHaveAttribute('fill', light!);
});

test('at 390px the dashboard stacks and the page does not scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/build#dataset=toprope');
  const cols = await dash(page).locator('.grid').first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(cols).toBe(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
