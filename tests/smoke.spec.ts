import { test, expect, type Page } from '@playwright/test';
import { site } from '../src/data/site';

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

test('/build shows the empty state', async ({ page }) => {
  await page.goto('/build');
  await expect(page.locator('h1')).toHaveText('Build record');
  await expect(page.locator('main p')).toHaveText('No runs recorded yet.');
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
    expect(hrefs).toEqual(['/#work', '/#build', '/#about', '/#contact']);
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
  await expect(hero.getByRole('link', { name: site.hero.secondary })).toHaveAttribute('href', '#build');
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

test('the homepage ships no client JS', async ({ page }) => {
  // Update when the BuildRecord island (the one allowed island) lands.
  await page.goto('/');
  await expect(page.locator('script')).toHaveCount(0);
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
  expect(classes.slice(0, 3)).toEqual(['hero', 'role-fit', 'selected-work']);
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

// The targets land with #5 (platform), #6 (ai) and #7 (vismedic).
test.fixme('selected-work hrefs resolve to elements on the page', async ({ page }) => {
  await page.goto('/');
  for (const item of site.selected.items) {
    await expect(page.locator(item.href)).toHaveCount(1);
  }
});

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
    expect(style.color).toBe('rgb(13, 128, 117)');
    expect(style.border).toBe('rgb(13, 128, 117)');
    expect(style.color).not.toBe(resting);
  }
});

test('selected-work links take the teal hover state', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const link = page.locator('#work a.selected-link').first();
  await link.hover();
  await expect(link).toHaveCSS('color', 'rgb(13, 128, 117)');
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
