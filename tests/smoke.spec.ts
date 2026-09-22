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
