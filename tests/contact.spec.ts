import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { site } from '../src/data/site';

const { background, contact, markup } = site;
const about = (page: Page) => page.locator('main section#about');
const contactSection = (page: Page) => page.locator('main section#contact');
const INK = 'rgb(17, 19, 24)';

// In-page links that have no target yet, and the issue that adds it. The test
// fails when one of these starts to resolve, so that issue must update the list.
const PENDING_TARGETS: Record<string, string> = {};

for (const path of ['/', '/build']) {
  test(`${path} every header nav link resolves`, async ({ page, request }) => {
    await page.goto(path);
    const hrefs = await page
      .getByRole('navigation', { name: markup.navLabel })
      .getByRole('link')
      .evaluateAll((links) => links.map((a) => a.getAttribute('href')!));
    expect(hrefs).toHaveLength(4);
    for (const href of hrefs) {
      const [pathname, hash] = href.split('#');
      const response = await request.get(pathname || '/');
      expect(response.status(), href).toBe(200);
      if (!hash) continue;
      await page.goto(`${pathname}#${hash}`);
      await expect(page.locator(`main section[id="${hash}"]`), href).toHaveCount(1);
    }
  });
}

test('every in-page link on the homepage resolves, except the pending list', async ({ page }) => {
  await page.goto('/');
  const hashes = await page
    .locator('a[href^="#"], a[href^="/#"]')
    .evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute('href')!.replace(/^\//, '')))]);
  const unresolved: string[] = [];
  for (const hash of hashes) {
    if ((await page.locator(`[id="${hash.slice(1)}"]`).count()) === 0) unresolved.push(hash);
  }
  expect(unresolved.sort()).toEqual(Object.keys(PENDING_TARGETS).sort());
});

test('background is #about with its copy from site.ts and a CV link', async ({ page, request }) => {
  await page.goto('/');
  const section = about(page);
  await expect(section).toHaveClass(/background-section/);
  await expect(section).toHaveAccessibleName(background.title);
  await expect(section.locator('.eyebrow')).toHaveText(background.eyebrow);
  await expect(section.locator('h2')).toHaveText(background.title);
  await expect(section.locator('.background-paragraphs p')).toHaveText(background.paragraphs);
  const cvLine = section.locator('.cv-line');
  await expect(cvLine).toHaveText(`${background.cv} ${markup.backgroundCvLink}`);
  const cv = cvLine.getByRole('link', { name: markup.backgroundCvLink });
  await expect(cv).toHaveAttribute('href', markup.cvHref);
  expect((await request.get(markup.cvHref)).status()).toBe(200);
});

test('contact is #contact with its copy, links, email and location', async ({ page }) => {
  await page.goto('/');
  const section = contactSection(page);
  await expect(section).toHaveClass(/contact-section/);
  await expect(section).toHaveAccessibleName(contact.title);
  await expect(section.locator('h2')).toHaveText(contact.title);
  await expect(section.locator('.contact-grid > div > p')).toHaveText(contact.supporting);

  const links = section.locator('.contact-links a');
  await expect(links).toHaveCount(5);
  const expected = [
    { name: contact.cv, href: markup.cvHref, external: false },
    { name: `${contact.github} ${markup.newTabLabel}`, href: markup.githubHref, external: true },
    { name: `${contact.purecontext} ${markup.newTabLabel}`, href: markup.pureContextHref, external: true },
    { name: `${contact.linkedin} ${markup.newTabLabel}`, href: markup.linkedinHref, external: true },
    { name: contact.email, href: `mailto:${contact.email}`, external: false },
  ];
  for (const [i, link] of expected.entries()) {
    const a = links.nth(i);
    await expect(a).toHaveAccessibleName(link.name);
    await expect(a).toHaveAttribute('href', link.href);
    if (link.external) {
      await expect(a).toHaveAttribute('target', '_blank');
      await expect(a).toHaveAttribute('rel', /\bnoopener\b/);
    } else {
      await expect(a).not.toHaveAttribute('target', /./);
    }
  }
  await expect(links.last()).toHaveClass(/email-link/);
  await expect(section.locator('.location')).toHaveText(contact.location);
  // No dead links in the band.
  await expect(section.locator('a[href="#"], a:not([href])')).toHaveCount(0);
});

test('the footer follows the contact section inside the same dark band', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const section = contactSection(page);
  const footer = page.locator('body > footer');
  await expect(section).toHaveCSS('background-color', INK);
  await expect(footer).toHaveCSS('background-color', INK);
  const s = (await section.boundingBox())!;
  const f = (await footer.boundingBox())!;
  expect(Math.abs(f.y - (s.y + s.height))).toBeLessThanOrEqual(1);
  await expect(section).toHaveCSS('padding-bottom', '72px');
});

test('dark band styles read colour tokens, not hex literals', () => {
  for (const file of ['src/components/Contact.astro', 'src/components/Footer.astro']) {
    const style = readFileSync(file, 'utf8').split('<style')[1];
    expect(style.match(/#[0-9a-f]{3,8}\b/gi), file).toBeNull();
  }
});

test('at 1440px background and contact match the reference layout', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const bg = about(page);
  await expect(bg).toHaveCSS('padding-top', '110px');
  await expect(bg).toHaveCSS('padding-bottom', '110px');
  await expect(bg).toHaveCSS('background-color', 'rgb(251, 251, 249)');
  await expect(bg.locator('h2')).toHaveCSS('font-size', '67.68px');
  await expect(bg.locator('h2')).toHaveCSS('letter-spacing', '-3.384px');
  await expect(bg.locator('.eyebrow')).toHaveCSS('font-family', /IBM Plex Mono/);
  await expect(bg.locator('.background-paragraphs p')).toHaveCSS('color', 'rgb(97, 104, 113)');
  await expect(bg.locator('.cv-line a')).toHaveCSS('color', 'rgb(13, 128, 117)');
  const grid = (await bg.locator('.background-grid').boundingBox())!;
  expect(grid.width).toBe(820);
  expect(Math.round(grid.x)).toBe((1440 - 820) / 2);

  const c = contactSection(page);
  await expect(c).toHaveCSS('padding-top', '100px');
  await expect(c.locator('h2')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(c.locator('h2')).toHaveCSS('font-size', '67.68px');
  await expect(c.locator('.contact-grid > div > p')).toHaveCSS('color', 'rgb(183, 190, 193)');
  await expect(c.locator('.contact-grid > div > p')).toHaveCSS('font-size', '17px');
  await expect(c.locator('.email-link')).toHaveCSS('color', 'rgb(124, 214, 203)');
  await expect(c.locator('.location')).toHaveCSS('color', 'rgb(157, 165, 169)');
  const columns = await c
    .locator('.contact-grid')
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(2);
});

test('at 390px contact stacks to one column with a 42px heading and nothing overflows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const c = contactSection(page);
  const columns = await c
    .locator('.contact-grid')
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(1);
  await expect(c.locator('h2')).toHaveCSS('font-size', '42px');
  const copy = (await c.locator('.contact-grid > div').first().boundingBox())!;
  const links = (await c.locator('.contact-links').boundingBox())!;
  expect(links.y).toBeGreaterThanOrEqual(copy.y + copy.height);
  await expect(about(page).locator('h2')).toHaveCSS('font-size', '46px');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test('contact links take the accent colour on hover', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const link = contactSection(page).locator('.contact-links a').first();
  await expect(link).toHaveCSS('border-bottom-color', 'rgb(89, 96, 100)');
  await link.hover();
  await expect(link).toHaveCSS('color', 'rgb(124, 214, 203)');
  await expect(link).toHaveCSS('border-bottom-color', 'rgb(124, 214, 203)');
});

test('background and contact pass axe', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).include('#about').include('#contact').analyze();
  expect(results.violations).toEqual([]);
});
