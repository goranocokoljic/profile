import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { site } from '../src/data/site';
import { fmtDur, fmtUsd } from '../src/build/format';
import type { Payload } from '../src/build/types';

for (const path of ['/', '/build']) {
  test(`${path} renders with one h1 and no console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    const response = await page.goto(path);

    expect(response?.status()).toBe(200);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test('/build shows the intro and the build-record dashboard', async ({ page }) => {
  const { build } = site.pages;
  await page.goto('/build');
  await expect(page).toHaveTitle(build.title);
  const intro = page.locator('main .build-intro');
  await expect(intro.locator('.eyebrow')).toHaveText(build.eyebrow);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(intro.locator('h1')).toHaveText(build.heading);
  await expect(intro.locator('p:not(.eyebrow)')).toHaveText([...build.intro]);
  await expect(page.locator('#dashboard .kpis .tile')).toHaveCount(6);
  // The intro sits between the header and the dashboard.
  const order = await page.locator('body > header, .build-intro, #dashboard, body > footer').evaluateAll((els) =>
    els.map((el) => el.id || el.className || el.tagName.toLowerCase()),
  );
  expect(order.map((o) => o.split(' ')[0])).toEqual(['site-header', 'build-intro', 'dashboard', 'site-footer']);
});

for (const [width, pad] of [[1440, '84px'], [390, '58px']] as const) {
  test(`/build intro uses the site type scale at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/build');
    const intro = page.locator('.build-intro');
    await expect(intro).toHaveCSS('padding-top', pad);
    await expect(intro.locator('.eyebrow')).toHaveCSS('font-size', '12px');
    await expect(intro.locator('.eyebrow')).toHaveCSS('text-transform', 'uppercase');
    await expect(intro.locator('h1')).toHaveCSS('font-size', width === 1440 ? '67.68px' : '46px');
    await expect(intro.locator('p:not(.eyebrow)').first()).toHaveCSS('font-size', '17px');
  });
}

test('/build toggle switches the runs count to the toprope dataset', async ({ page }) => {
  const { build } = site.pages;
  await page.goto('/build');
  const toggle = page.getByRole('group', { name: build.datasetLabel });
  await expect(toggle).toBeVisible();
  const runs = page.locator('#dashboard .kpis .value').first();
  const before = await runs.innerText();
  await toggle.getByRole('button', { name: build.datasets.toprope }).click();
  await expect(runs).toHaveText('172');
  expect(before).not.toBe('172');
});

test.describe('/build without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows the intro and a table of the site runs', async ({ page }) => {
    const { build } = site.pages;
    const { tasks, meta } = (JSON.parse(readFileSync('dist/build/data.json', 'utf8')) as Payload).datasets.site;
    await page.goto('/build');
    await expect(page.locator('h1')).toHaveText(build.heading);
    await expect(page.locator('.build-intro p:not(.eyebrow)')).toHaveText([...build.intro]);
    await expect(page.locator('#dashboard')).toBeEmpty();
    const table = page.locator('table.noscript-runs');
    await expect(table).toBeVisible();
    await expect(table.locator('caption')).toHaveText(build.noscript.caption);
    const c = build.noscript.columns;
    await expect(table.locator('thead th')).toHaveText([c.issue, c.outcome, c.duration, c.billed]);
    await expect(table.locator('tbody tr')).toHaveCount(tasks.length);
    const newest = [...tasks].sort((a, b) => b.ts.localeCompare(a.ts))[0];
    const first = table.locator('tbody tr').first().locator('td');
    await expect(first).toHaveText([`#${newest.issue}`, newest.outcome, fmtDur(newest.total_sec), fmtUsd(newest.billed_cost_usd)]);
    const url = meta?.[String(newest.issue)]?.url;
    if (url) await expect(first.first().getByRole('link')).toHaveAttribute('href', url);
  });
});

test('viewport allows safe-area layout', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    /viewport-fit=cover/,
  );
});

test('reference tokens reach the page at runtime', async ({ page }) => {
  await page.goto('/');
  const teal = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--teal').trim(),
  );
  expect(teal.toUpperCase()).toBe('#0D8075');
});

test('homepage h1 is the hero headline from site.ts', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(site.pages.home.title);
  const spans = page.locator('h1 > span');
  await expect(spans).toHaveText([site.hero.headlineStart, site.hero.headlineEmphasis]);
  await expect(spans.nth(1)).toHaveClass('headline-emphasis');
  await expect(page.locator('h1')).toHaveText(`${site.hero.headlineStart} ${site.hero.headlineEmphasis}`);
});

for (const path of ['/', '/build']) {
  test(`${path} header has the four section links and the CV link`, async ({ page }) => {
    await page.goto(path);
    const header = page.locator('body > header');
    const nav = header.getByRole('navigation', { name: site.markup.navLabel });
    await expect(nav.getByRole('link')).toHaveText([
      site.nav.work,
      site.nav.build,
      site.nav.about,
      site.nav.contact,
    ]);
    const hrefs = await nav.getByRole('link').evaluateAll((links) =>
      links.map((a) => a.getAttribute('href')),
    );
    expect(hrefs).toEqual(['/#work', '/build', '/#about', '/#contact']);
    const cv = header.getByRole('link', { name: site.nav.cv });
    await expect(cv).toHaveAttribute('href', site.markup.cvHref);
    await expect(header.getByRole('link', { name: site.markup.homeLabel })).toHaveText(
      `${site.markup.monogram}.`,
    );
  });

  test(`${path} footer shows the monogram and the footer line`, async ({ page }) => {
    await page.goto(path);
    const footer = page.locator('body > footer');
    const home = footer.getByRole('link', { name: site.markup.homeLabel });
    await expect(home).toHaveText(`${site.markup.monogram}.`);
    await expect(home).toHaveAttribute('href', '/#top');
    await expect(footer).toContainText(site.contact.footer);
  });
}

test('the monogram target #top exists on the homepage', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main#top')).toHaveCount(1);
});

test('header stays at the top of the viewport while scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto('/');
  await page.mouse.wheel(0, 800);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  const box = await page.locator('body > header').boundingBox();
  expect(box?.y).toBe(0);
});

for (const [width, headerHeight] of [[1440, 82], [390, 70]]) {
  test(`anchor targets clear the ${headerHeight}px sticky header at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const header = await page.locator('body > header').boundingBox();
    expect(header?.height).toBe(headerHeight);
    const padding = await page.evaluate(() => getComputedStyle(document.documentElement).scrollPaddingTop);
    expect(padding).toBe(`${headerHeight}px`);
  });
}

test('hero shows its copy, actions and build note', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('main .hero');
  await expect(hero.locator('.eyebrow')).toHaveText(site.hero.eyebrow);
  await expect(hero.locator('.hero-support')).toHaveText(site.hero.supporting);
  await expect(hero.getByRole('link', { name: site.hero.primary })).toHaveAttribute('href', '#work');
  await expect(hero.getByRole('link', { name: site.hero.secondary })).toHaveAttribute('href', '#build-story');
  await expect(hero.getByRole('link', { name: site.hero.cv })).toHaveAttribute('href', site.markup.cvHref);
  await expect(hero.locator('.build-note')).toHaveText(site.hero.buildNote);
});

test('portrait has alt text, intrinsic dimensions and a greyscale filter', async ({ page }) => {
  await page.goto('/');
  const img = page.locator('.hero-photo-wrap img');
  await expect(img).toHaveAttribute('alt', site.markup.portraitAlt);
  await expect(img).toHaveAttribute('width', '1365');
  await expect(img).toHaveAttribute('height', '2048');
  expect(await img.evaluate((el) => getComputedStyle(el).filter)).toBe('grayscale(1)');
  expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
});

test('the CV link resolves to a file', async ({ request }) => {
  const response = await request.get(site.markup.cvHref);
  expect(response.status()).toBe(200);
});

test('the homepage ships no client JS but the build-record island', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('astro-island')).toHaveCount(1);
  // Only Astro's island runtime and its client:visible directive, moved out
  // of line for the CSP by scripts/externalize-inline.mjs.
  const srcs = await page.locator('script').evaluateAll((els) => els.map((el) => el.getAttribute('src')));
  expect(srcs).toHaveLength(2);
  for (const src of srcs) expect(src).toMatch(/^\/_astro\/inline\.[0-9a-f]{10}\.js$/);
});

// CLS 0 by construction: the hero reserves its own space, so the portrait
// loading, or failing to load, never moves anything.
const IMAGES = /\.(webp|jpe?g|png|avif)$/;
const layoutBoxes = (page: Page) =>
  page.evaluate(() =>
    ['.hero-copy', '.hero-photo-wrap', 'body > footer'].map((selector) => {
      const r = document.querySelector(selector)!.getBoundingClientRect();
      return { selector, x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  );

for (const [width, photoHeight] of [[1440, 665], [390, 420]]) {
  test(`the portrait cannot shift layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route(IMAGES, (route) => route.abort());
    await page.goto('/', { waitUntil: 'load' });
    const withoutImage = await layoutBoxes(page);
    expect(withoutImage[1].height).toBeGreaterThanOrEqual(photoHeight);

    await page.unroute(IMAGES);
    await page.reload({ waitUntil: 'load' });
    await page.locator('.hero-photo').evaluate((img: HTMLImageElement) => img.decode());
    expect(await layoutBoxes(page)).toEqual(withoutImage);
  });
}

test('at 1440px the nav shows and the hero has two columns', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.desktop-nav')).toBeVisible();
  const copy = (await page.locator('.hero-copy').boundingBox())!;
  const photo = (await page.locator('.hero-photo-wrap').boundingBox())!;
  expect(photo.x).toBeGreaterThanOrEqual(copy.x + copy.width - 1);
  expect(Math.abs(photo.y - copy.y)).toBeLessThanOrEqual(1);
});

test('at 390px the nav collapses and the portrait sits below the copy', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.desktop-nav')).toBeHidden();
  await expect(page.locator('.header-cv')).toBeVisible();
  const copy = await page.locator('.hero-copy').boundingBox();
  const photo = await page.locator('.hero-photo-wrap').boundingBox();
  expect(photo!.y).toBeGreaterThanOrEqual(copy!.y + copy!.height);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test('role fit shows its h2, intro and the four numbered items in order', async ({ page }) => {
  await page.goto('/');
  const section = page.locator('main .role-fit');
  await expect(section).toHaveCount(1);
  await expect(section.locator('h2')).toHaveText(site.roleFit.title);
  await expect(section.locator('.role-intro')).toHaveText(site.roleFit.intro);
  const items = section.locator('.role-item');
  await expect(items).toHaveCount(4);
  await expect(items.locator('.role-index')).toHaveText(['01', '02', '03', '04']);
  await expect(items.locator('h3')).toHaveText(site.roleFit.items.map((item) => item.title));
  await expect(items.locator('p')).toHaveText(site.roleFit.items.map((item) => item.body));
});

test('homepage sections sit in order after the hero', async ({ page }) => {
  await page.goto('/');
  const classes = await page.locator('main > section').evaluateAll((sections) =>
    sections.map((s) => s.classList[0]),
  );
  expect(classes).toEqual([
    'hero',
    'role-fit',
    'selected-work',
    'platform-section',
    'ai-section',
    'vismedic-section',
    'build-story',
    'background-section',
    'contact-section',
  ]);
});

test('homepage headings step down without skipping a level', async ({ page }) => {
  await page.goto('/');
  const levels = await page
    .locator('h1, h2, h3, h4, h5, h6')
    .evaluateAll((hs) => hs.map((h) => Number(h.tagName[1])));
  expect(levels[0]).toBe(1);
  for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeLessThanOrEqual(levels[i - 1] + 1);
});

test('selected work is #work and lists three numbered links', async ({ page }) => {
  await page.goto('/');
  const section = page.locator('main section#work');
  await expect(section).toHaveClass(/selected-work/);
  await expect(section).toHaveAccessibleName(site.selected.label);
  await expect(section.locator('.eyebrow')).toHaveText(site.selected.label);
  const links = section.locator('a.selected-link');
  await expect(links).toHaveCount(3);
  await expect(links.locator('.selected-number')).toHaveText(site.selected.items.map((item) => item.number));
  await expect(links.locator('strong')).toHaveText(site.selected.items.map((item) => item.title));
  const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(hrefs).toEqual(site.selected.items.map((item) => item.href));
  for (const item of site.selected.items) {
    await expect(section.getByRole('link', { name: `${item.number} ${item.title}` })).toBeVisible();
  }
});

for (const item of site.selected.items) {
  test(`selected-work link ${item.href} resolves to a section on the page`, async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(`main section${item.href}`)).toHaveCount(1);
  });
}

test('selected-work links show a visible focus ring and the hover colour on focus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const links = page.locator('#work a.selected-link');
  const resting = await links.first().evaluate((a) => getComputedStyle(a).color);
  for (let i = 0; i < (await links.count()); i++) {
    const link = links.nth(i);
    await link.focus();
    // Keyboard focus, so :focus-visible applies.
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    const style = await link.evaluate((a) => {
      const s = getComputedStyle(a);
      return { outline: s.outlineStyle, width: s.outlineWidth, color: s.color, border: s.borderBottomColor };
    });
    expect(style.outline).toBe('solid');
    expect(style.width).toBe('2px');
    expect(style.color).toBe('rgb(12, 124, 114)');
    expect(style.border).toBe('rgb(13, 128, 117)');
    expect(style.color).not.toBe(resting);
  }
});

test('selected-work links take the teal hover state', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const link = page.locator('#work a.selected-link').first();
  await link.hover();
  await expect(link).toHaveCSS('color', 'rgb(12, 124, 114)');
  await expect(link).toHaveCSS('border-bottom-color', 'rgb(13, 128, 117)');
});

for (const [width, roleColumns, workColumns] of [[1440, 2, 3], [390, 1, 1]]) {
  test(`at ${width}px role fit has ${roleColumns} column(s) and selected work ${workColumns}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const columns = (selector: string) =>
      page.locator(selector).evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(await columns('.role-grid')).toBe(roleColumns);
    expect(await columns('.selected-grid')).toBe(workColumns);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
}

test('role fit collapses to one column at the 900px breakpoint', async ({ page }) => {
  const columns = () =>
    page.locator('.role-grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  await page.setViewportSize({ width: 901, height: 900 });
  await page.goto('/');
  expect(await columns()).toBe(2);
  await page.setViewportSize({ width: 900, height: 900 });
  expect(await columns()).toBe(1);
});

test('platform section shows all of its copy from site.ts', async ({ page }) => {
  const { platform } = site;
  await page.goto('/');
  const section = page.locator('main section#platform');
  await expect(section).toHaveAccessibleName(platform.title);
  await expect(section.locator('.eyebrow')).toHaveText(platform.eyebrow);
  await expect(section.locator('h2')).toHaveText(platform.title);
  await expect(section.locator('.platform-copy p:not(.eyebrow)')).toHaveText([platform.intro1, platform.intro2]);
  await expect(section.locator('.platform-role li')).toHaveText(platform.roleLabels);
  await expect(section.locator('figcaption')).toHaveText(platform.diagram.label);
  await expect(section.locator('.platform-core strong')).toHaveText(platform.diagram.coreTitle);
  await expect(section.locator('.platform-core small')).toHaveText(platform.diagram.coreDetail);
  await expect(section.locator('h3')).toHaveText([platform.shiftTitle, platform.ownershipTitle]);
  await expect(section.locator('.shift-copy p')).toHaveText(platform.shiftBody);
  await expect(section.locator('.ownership-block p')).toHaveText(platform.ownershipBody);
  await expect(section.locator('blockquote')).toHaveText(platform.closing);
});

test('platform diagram has 5 portal boxes and 4 foundation boxes, built in HTML', async ({ page }) => {
  await page.goto('/');
  const diagram = page.locator('#platform figure.platform-diagram');
  const portals = diagram.locator('.portal-row > li');
  const foundation = diagram.locator('.foundation-row > li');
  await expect(portals).toHaveCount(5);
  await expect(foundation).toHaveCount(4);
  await expect(portals).toHaveText(site.platform.diagram.portals);
  await expect(foundation).toHaveText(site.platform.diagram.foundation);
  await expect(diagram.locator('img, svg, canvas')).toHaveCount(0);
  const connectors = diagram.locator('.connector');
  await expect(connectors).toHaveCount(2);
  for (const connector of await connectors.all()) {
    await expect(connector).toHaveAttribute('aria-hidden', 'true');
  }
});

test('platform diagram has a visually hidden summary for screen readers', async ({ page }) => {
  await page.goto('/');
  const figure = page.locator('#platform figure.platform-diagram');
  const summary = figure.locator('.visually-hidden');
  await expect(summary).toHaveText(site.markup.platformDiagramSummary);
  // Clipped to 1px, but not display: none, so it stays in the accessibility tree.
  const box = (await summary.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(1);
  expect(box.height).toBeLessThanOrEqual(1);
  const tree = await figure.ariaSnapshot();
  expect(tree).toContain(site.markup.platformDiagramSummary);
});

test('platform shows three metrics, with a note only where site.ts has one', async ({ page }) => {
  await page.goto('/');
  const metrics = page.locator('#platform .metrics > .metric');
  await expect(metrics).toHaveCount(3);
  await expect(metrics.locator('strong')).toHaveText(site.platform.metrics.map((m) => m.value));
  await expect(metrics.locator('span')).toHaveText(site.platform.metrics.map((m) => m.label));
  const notes = site.platform.metrics.flatMap((m) => (m.note ? [m.note] : []));
  expect(notes.length).toBeGreaterThan(0);
  for (const [i, metric] of site.platform.metrics.entries()) {
    const note = metrics.nth(i).locator('small');
    if (metric.note) await expect(note).toHaveText(metric.note);
    else await expect(note).toHaveCount(0);
  }
});

const columnCount = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);

test('at 1440px platform has two columns and the diagram rows sit side by side', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  expect(await columnCount(page, '.platform-grid')).toBe(2);
  expect(await columnCount(page, '.portal-row')).toBe(5);
  expect(await columnCount(page, '.foundation-row')).toBe(4);
  expect(await columnCount(page, '.metrics')).toBe(3);
  expect(await columnCount(page, '.platform-lower')).toBe(2);
  const copy = (await page.locator('.platform-copy').boundingBox())!;
  const visual = (await page.locator('.platform-visual').boundingBox())!;
  expect(visual.x).toBeGreaterThanOrEqual(copy.x + copy.width - 1);
  const portals = page.locator('.portal-row > li');
  const first = (await portals.first().boundingBox())!;
  const last = (await portals.last().boundingBox())!;
  expect(Math.abs(last.y - first.y)).toBeLessThanOrEqual(1);
});

for (const width of [900, 390]) {
  test(`at ${width}px the platform diagram is a vertical stack`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    expect(await columnCount(page, '.platform-grid')).toBe(1);
    expect(await columnCount(page, '.platform-lower')).toBe(1);
    // Every box, top to bottom: the portals, the core, then the foundation.
    const boxes = await page
      .locator('.architecture-diagram')
      .locator('.portal-row > li, .platform-core, .foundation-row > li')
      .evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, width: r.width, height: r.height };
        }),
      );
    expect(boxes).toHaveLength(10);
    for (const box of boxes) {
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
    }
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].top).toBeGreaterThanOrEqual(boxes[i - 1].bottom);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
}

test('the platform diagram switches to a stack at the 900px breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 901, height: 900 });
  await page.goto('/');
  expect(await columnCount(page, '.portal-row')).toBe(5);
  expect(await columnCount(page, '.foundation-row')).toBe(4);
  await page.setViewportSize({ width: 900, height: 900 });
  expect(await columnCount(page, '.portal-row')).toBe(1);
  expect(await columnCount(page, '.foundation-row')).toBe(1);
});

test('at 390px the platform metrics stack in one column', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/');
  expect(await columnCount(page, '.metrics')).toBe(1);
});
