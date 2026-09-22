import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { site } from '../src/data/site';

const { vismedic, markup } = site;
const section = (page: Page) => page.locator('main section#vismedic');
const archive = [markup.vismedicArchive.consultation, markup.vismedicArchive.booking, markup.vismedicArchive.calendar];
const IMAGE_BUDGET = 600 * 1024;

// Lazy images load only near the viewport: bring each one into view, then wait
// until every image on the page has decoded.
async function loadAllImages(page: Page) {
  for (const img of await page.locator('img').all()) await img.scrollIntoViewIfNeeded();
  await expect
    .poll(() => page.locator('img').evaluateAll((imgs) => imgs.every((i) => (i as HTMLImageElement).complete)))
    .toBe(true);
}

test('vismedic smoke: 3 archive figures, 1 award figure, 4 recognition rows, 4 meta rows', async ({ page }) => {
  await page.goto('/');
  const v = section(page);
  await expect(v.locator('.archive-grid > figure')).toHaveCount(3);
  await expect(v.locator('figure.ring-photo')).toHaveCount(1);
  await expect(v.locator('figure')).toHaveCount(4);
  await expect(v.locator('.recognition-list > div')).toHaveCount(4);
  await expect(v.locator('.vismedic-meta > div')).toHaveCount(4);
});

test('vismedic shows all of its copy from site.ts', async ({ page }) => {
  await page.goto('/');
  const v = section(page);
  await expect(v).toHaveAccessibleName(vismedic.title);
  await expect(v.locator('.eyebrow')).toHaveText(vismedic.eyebrow);
  await expect(v.locator('h2')).toHaveText(vismedic.title);
  await expect(v.locator('.vismedic-intro')).toHaveText(vismedic.intro);
  await expect(v.locator('.vismedic-meta dt')).toHaveText(vismedic.meta.map(([label]) => label));
  await expect(v.locator('.vismedic-meta dd')).toHaveText(vismedic.meta.map(([, value]) => value));
  await expect(v.locator('.archive-section .mini-label')).toHaveText(vismedic.archiveLabel);
  await expect(v.locator('.archive-grid figcaption')).toHaveText(archive.map((f) => f.caption));
  await expect(v.locator('h3')).toHaveText(vismedic.realTitle);
  await expect(v.locator('.adoption-copy > p')).toHaveText([vismedic.realBody, vismedic.hipaa]);
  await expect(v.locator('.recognition-list dt')).toHaveText(vismedic.recognition.map(([award]) => award));
  await expect(v.locator('.recognition-list dd')).toHaveText(vismedic.recognition.map(([, result]) => result));
  await expect(v.locator('.ring-photo figcaption')).toHaveText(markup.vismedicAward.caption);
  await expect(v.locator('blockquote')).toHaveText(vismedic.closing);
});

test('vismedic images are lazy, async, sized, with alt text and a webp source', async ({ page }) => {
  await page.goto('/');
  const v = section(page);
  const alts = [...archive.map((f) => f.alt), markup.vismedicAward.alt];
  const imgs = v.locator('figure picture > img');
  await expect(imgs).toHaveCount(4);
  for (const [i, img] of (await imgs.all()).entries()) {
    await expect(img).toHaveAttribute('alt', alts[i]);
    await expect(img).toHaveAttribute('loading', 'lazy');
    await expect(img).toHaveAttribute('decoding', 'async');
    await expect(img).toHaveAttribute('width', /^\d+$/);
    await expect(img).toHaveAttribute('height', /^\d+$/);
    await expect(img).toHaveAttribute('src', /\.jpg$/);
    const source = img.locator('xpath=preceding-sibling::source');
    await expect(source).toHaveAttribute('type', 'image/webp');
    await expect(source).toHaveAttribute('srcset', /\.webp \d+w/);
  }
});

test('vismedic mounts after the ai section', async ({ page }) => {
  await page.goto('/');
  const ids = await page.locator('main > section[id]').evaluateAll((s) => s.map((el) => el.id));
  expect(ids.indexOf('vismedic')).toBe(ids.indexOf('ai') + 1);
});

test('vismedic has no axe violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).include('#vismedic').analyze();
  expect(results.violations).toEqual([]);
});

for (const width of [1440, 390]) {
  test(`homepage image bytes stay under 600 KB at ${width}px`, async ({ page }) => {
    const sizes = new Map<string, number>();
    page.on('response', async (response) => {
      if (response.request().resourceType() !== 'image') return;
      sizes.set(response.url(), (await response.body()).length);
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await loadAllImages(page);
    await expect.poll(() => sizes.size).toBe(await page.locator('img').count());
    const total = [...sizes.values()].reduce((a, b) => a + b, 0);
    test.info().annotations.push({ type: 'image bytes', description: `${width}px: ${total} bytes` });
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(IMAGE_BUDGET);
  });

  test(`at ${width}px no vismedic image overflows its figure`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await loadAllImages(page);
    for (const figure of await section(page).locator('figure').all()) {
      const box = (await figure.boundingBox())!;
      const img = (await figure.locator('img').boundingBox())!;
      expect(img.width).toBeGreaterThan(0);
      expect(img.height).toBeGreaterThan(0);
      expect(img.x).toBeGreaterThanOrEqual(box.x);
      expect(img.y).toBeGreaterThanOrEqual(box.y);
      expect(img.x + img.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
      expect(img.y + img.height).toBeLessThanOrEqual(box.y + box.height + 0.5);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
}

const columnCount = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);

test('at 1440px the archive is a two-row grid of 280px rows, main shot spanning both', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const v = section(page);
  await expect(v).toHaveCSS('padding-top', '110px');
  await expect(v).toHaveCSS('padding-bottom', '95px');
  await expect(v).toHaveCSS('background-color', 'rgb(251, 251, 249)');
  await expect(v.locator('h2')).toHaveCSS('font-size', '67.68px');
  await expect(v.locator('.vismedic-intro')).toHaveCSS('font-size', '18px');
  await expect(v.locator('.vismedic-meta dt').first()).toHaveCSS('font-family', /IBM Plex Mono/);
  expect(await columnCount(page, '.vismedic-opening')).toBe(2);
  expect(await columnCount(page, '.adoption-grid')).toBe(2);
  expect(await columnCount(page, '.archive-grid')).toBe(2);
  await expect(v.locator('.archive-grid')).toHaveCSS('grid-template-rows', '280px 280px');
  const figures = v.locator('.archive-grid > figure');
  const main = (await figures.nth(0).boundingBox())!;
  const top = (await figures.nth(1).boundingBox())!;
  const bottom = (await figures.nth(2).boundingBox())!;
  expect(main.height).toBeCloseTo(576, 0);
  expect(top.height).toBeCloseTo(280, 0);
  expect(bottom.y).toBeCloseTo(top.y + 296, 0);
  expect(top.x).toBeGreaterThan(main.x + main.width);
  const img = v.locator('.archive-image').first();
  await expect(img).toHaveCSS('object-fit', 'cover');
  await expect(img).toHaveCSS('object-position', '0% 0%');
  await expect(v.locator('blockquote')).toHaveCSS('font-size', '25px');
});

test('at 390px the archive is one column of 260px figures', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/');
  const v = section(page);
  expect(await columnCount(page, '.vismedic-opening')).toBe(1);
  expect(await columnCount(page, '.adoption-grid')).toBe(1);
  expect(await columnCount(page, '.archive-grid')).toBe(1);
  for (const figure of await v.locator('.archive-grid > figure').all()) {
    await expect(figure).toHaveCSS('height', '260px');
  }
  await expect(v.locator('blockquote')).toHaveCSS('font-size', '21px');
  await expect(v.locator('blockquote')).toHaveCSS('padding-left', '24px');
});

test('the archive grid collapses at the 900px breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 901, height: 900 });
  await page.goto('/');
  expect(await columnCount(page, '.archive-grid')).toBe(2);
  await page.setViewportSize({ width: 900, height: 900 });
  expect(await columnCount(page, '.archive-grid')).toBe(1);
  await expect(section(page).locator('.archive-grid > figure').first()).toHaveCSS('height', '260px');
});
