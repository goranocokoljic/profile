import { test, expect, type Page } from '@playwright/test';
import { site } from '../src/data/site';

// #34: the Vue → React transfer argument is made once on the homepage, not
// twice. The build-story section describes this site's own stack, so it is
// left out of the count.
const bodyTextOutsideBuildStory = (page: Page) =>
  page.locator('body').evaluate((body) => {
    const copy = body.cloneNode(true) as HTMLElement;
    copy.querySelector('#build-story')?.remove();
    copy.querySelectorAll('script, style, template').forEach((el) => el.remove());
    return copy.textContent ?? '';
  });

const count = (text: string, word: string) => text.match(new RegExp(`\\b${word}\\b`, 'g'))?.length ?? 0;

test('the homepage names React once and Astro once outside the build story', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#build-story')).toHaveCount(1);
  const text = await bodyTextOutsideBuildStory(page);
  expect(count(text, 'React')).toBe(1);
  expect(count(text, 'Astro')).toBe(1);
  // The one mention is the platform callout, as "React Router".
  expect(text).toContain('React Router');
  await expect(page.locator('main')).not.toContainText(/never the hard part/i);
});

test('the counter counts whole words only', () => {
  expect(count('React, React Router and Reactive', 'React')).toBe(2);
  expect(count('Astro Astronomy', 'Astro')).toBe(1);
  expect(count('', 'Astro')).toBe(0);
});

// Words per rendered line of an element, measured with ranges so the page's
// DOM is not changed. Lines are grouped by the top of each word's box.
const wordsPerLine = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => {
    const lines = new Map<number, number>();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const value = node.nodeValue ?? '';
      for (const m of value.matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const top = Math.round(range.getBoundingClientRect().top);
        lines.set(top, (lines.get(top) ?? 0) + 1);
      }
    }
    return [...lines.entries()].sort(([a], [b]) => a - b).map(([, n]) => n);
  });

for (const width of [1280, 1440, 1680]) {
  test(`at ${width}px no hero headline line ends on a single word`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('.hero h1')).toHaveCSS('text-wrap-style', 'balance');
    await expect(page.locator('.hero .hero-support')).toHaveCSS('text-wrap-style', 'pretty');
    // Each span is its own block, so each has its own last line.
    for (const [i, text] of [site.hero.headlineStart, site.hero.headlineEmphasis].entries()) {
      const lines = await wordsPerLine(page, `.hero h1 > span:nth-child(${i + 1})`);
      expect(lines.reduce((a, b) => a + b, 0), text).toBe(text.split(/\s+/).length);
      if (lines.length > 1) expect(lines.at(-1), `${width}px: ${text} → ${lines.join('/')}`).toBeGreaterThanOrEqual(2);
    }
  });
}
