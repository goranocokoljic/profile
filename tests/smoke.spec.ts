import { test, expect } from '@playwright/test';
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
  const h1 = page.locator('h1');
  await expect(h1).toHaveText(`${site.hero.headlineStart} ${site.hero.headlineEmphasis}`);
  await expect(h1.locator('.headline-emphasis')).toHaveText(site.hero.headlineEmphasis);
});
