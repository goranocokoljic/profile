import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { site } from '../src/data/site';

const { ai, markup } = site;
const section = (page: Page) => page.locator('main section#ai');
const columnCount = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
const numbered = (items: readonly string[]) => items.map((_, i) => String(i + 1).padStart(2, '0'));

test('ai section flows, pills and lists have the reference counts, in order', async ({ page }) => {
  await page.goto('/');
  const ai$ = section(page);
  // #34: the nine-step dev flow duplicated the build-story loop and is no
  // longer rendered; ai.devFlow stays in site.ts as unrendered data.
  await expect(ai$.locator('ol.flow-stack')).toHaveCount(0);
  await expect(ai$.locator('.ai-dev-grid > *')).toHaveCount(1);
  await expect(ai$.locator('.ai-dev-grid > .ai-dev-copy')).toHaveCount(1);

  const qaFlow = ai$.locator('ol.qa-flow > li');
  await expect(qaFlow).toHaveCount(8);
  await expect(qaFlow.locator('strong')).toHaveText(ai.qaFlow);
  await expect(qaFlow.locator('span')).toHaveText(numbered(ai.qaFlow));

  const lenses = ai$.locator('.review-card ul.lens-row > li');
  await expect(lenses).toHaveCount(5);
  await expect(lenses).toHaveText(ai.lenses);

  const loop = ai$.locator('.context-card ul.lens-row > li');
  await expect(loop).toHaveText(markup.changeSafetyLoop);

  const controls = ai$.locator('ul.control-flow > li');
  await expect(controls).toHaveCount(5);
  await expect(controls.locator('strong')).toHaveText(ai.controls.map(([name]) => name));
  await expect(controls.locator('span')).toHaveText(ai.controls.map(([, detail]) => detail));

  const principles = ai$.locator('.qa-principles > article');
  await expect(principles).toHaveCount(3);
  await expect(principles.locator('h4')).toHaveText(ai.qaPrinciples.map((p) => p.title));
  await expect(principles.locator('p')).toHaveText(ai.qaPrinciples.map((p) => p.body));

  const findings = ai$.locator('.findings-panel ul > li');
  await expect(findings).toHaveCount(5);
  await expect(findings).toHaveText(ai.findings);
});

test('ai flow step numbers are hidden from assistive tech, the ol carries the order', async ({ page }) => {
  await page.goto('/');
  for (const span of await section(page).locator('ol > li > span').all()) {
    await expect(span).toHaveAttribute('aria-hidden', 'true');
  }
});

test('ai section shows all of its copy from site.ts', async ({ page }) => {
  await page.goto('/');
  const ai$ = section(page);
  await expect(ai$).toHaveAccessibleName(ai.title);
  await expect(ai$.locator('.eyebrow')).toHaveText(ai.eyebrow);
  await expect(ai$.locator('h2')).toHaveText(ai.title);
  await expect(ai$.locator('.ai-intro-copy p')).toHaveText([ai.intro1, ai.intro2]);
  await expect(ai$.locator('.mini-label')).toHaveText([
    ai.devLabel,
    ai.contextLabel,
    ai.reviewLabel,
    ai.limitsLabel,
    ai.qaLabel,
    ai.findingsLabel,
  ]);
  await expect(ai$.locator('h3')).toHaveText([
    ai.devTitle,
    ai.contextTitle,
    ai.reviewTitle,
    ai.limitsTitle,
    ai.qaTitle,
    ai.findingsTitle,
    ai.ownershipTitle,
  ]);
  await expect(ai$.locator('.ai-dev-copy > p:not(.mini-label)')).toHaveText(ai.devBody);
  await expect(ai$.locator('.context-card > p:not(.mini-label)')).toHaveText(ai.contextBody);
  await expect(ai$.locator('.review-card > p:not(.mini-label)')).toHaveText(ai.reviewBody);
  await expect(ai$.locator('.limits-copy > p:not(.mini-label)')).toHaveText(ai.limitsBody);
  await expect(ai$.locator('.qa-copy > p:not(.mini-label)')).toHaveText(ai.qaBody);
  await expect(ai$.locator('.ai-close p')).toHaveText(ai.ownershipBody);
});

test('the two italic quotes are blockquotes', async ({ page }) => {
  await page.goto('/');
  const quotes = section(page).locator('blockquote');
  await expect(quotes).toHaveCount(2);
  await expect(quotes.nth(0).locator('p')).toHaveText([ai.finished, ai.finishedBody]);
  await expect(quotes.nth(1)).toHaveText(ai.closing);
  await expect(quotes.nth(0).locator('.finished-quote')).toHaveCSS('font-style', 'italic');
  await expect(quotes.nth(1)).toHaveCSS('font-style', 'italic');
});

test('the PureContext link points to the repo and opens in a new tab', async ({ page }) => {
  await page.goto('/');
  const link = section(page).locator('.context-card a');
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute('href', 'https://github.com/goranocokoljic/pure-context');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /\bnoopener\b/);
  await expect(link).toHaveAccessibleName(`${ai.contextLink} ${markup.newTabLabel}`);
  // The new-tab note is for screen readers only: clipped to 1px, not display: none.
  const note = (await link.locator('.visually-hidden').boundingBox())!;
  expect(note.width).toBeLessThanOrEqual(1);
  expect(note.height).toBeLessThanOrEqual(1);
});

test('every new-tab link in the ai section has rel=noopener', async ({ page }) => {
  await page.goto('/');
  const blank = section(page).locator('a[target="_blank"]');
  expect(await blank.count()).toBeGreaterThan(0);
  for (const a of await blank.all()) await expect(a).toHaveAttribute('rel', /\bnoopener\b/);
});

test('ai section headings go h2 → h3 → h4 and axe finds no heading-order issue', async ({ page }) => {
  await page.goto('/');
  const levels = await section(page)
    .locator('h1, h2, h3, h4, h5, h6')
    .evaluateAll((hs) => hs.map((h) => Number(h.tagName[1])));
  expect(levels[0]).toBe(2);
  expect(new Set(levels)).toEqual(new Set([2, 3, 4]));
  for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeLessThanOrEqual(levels[i - 1] + 1);

  const results = await new AxeBuilder({ page }).include('#ai').withRules(['heading-order']).analyze();
  expect(results.violations).toEqual([]);
  expect(results.passes.map((r) => r.id)).toContain('heading-order');
});

for (const width of [1440, 390]) {
  test(`axe finds no violations in the ai section at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    // Teal text uses --teal-text since #14, so color-contrast is checked too.
    const results = await new AxeBuilder({ page }).include('#ai').analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  });
}

test('at 1440px the ai section lays out in the reference columns', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  for (const [selector, count] of [
    ['.ai-intro', 2],
    ['.ai-dev-grid', 2],
    ['.ai-two-col', 2],
    ['.limits-row', 2],
    ['.control-flow', 5],
    ['.qa-grid', 2],
    ['.qa-flow', 8],
    ['.qa-principles', 3],
    ['.findings-panel', 2],
    ['.findings-panel ul', 2],
    ['.ai-close', 2],
  ] as const) {
    expect(await columnCount(page, `#ai ${selector}`), selector).toBe(count);
  }
  const ai$ = section(page);
  await expect(ai$).toHaveCSS('padding-top', '110px');
  await expect(ai$.locator('h2')).toHaveCSS('font-size', '67.68px');
  await expect(ai$.locator('.ai-dev-copy h3')).toHaveCSS('font-size', '31px');
  await expect(ai$.locator('.ai-intro-copy')).toHaveCSS('font-size', '17px');
  await expect(ai$.locator('.mini-label').first()).toHaveCSS('font-size', '10px');
  await expect(ai$.locator('.mini-label').first()).toHaveCSS('color', 'rgb(12, 124, 114)');
  expect(await ai$.locator('.mini-label').first().evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/IBM Plex Mono/);
  await expect(ai$.locator('.qa-zone')).toHaveCSS('background-color', 'rgb(251, 251, 249)');
  await expect(ai$.locator('.closing-quote')).toHaveCSS('font-size', '23px');
  await expect(ai$.locator('.closing-quote')).toHaveCSS('padding-left', '36px');
  // Cards sit side by side with a rule between them.
  const [context, review] = await ai$.locator('.ai-card').all();
  const a = (await context.boundingBox())!;
  const b = (await review.boundingBox())!;
  expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
  await expect(review).toHaveCSS('border-left-width', '1px');
});

test('at 390px the ai section is a single column with no overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/');
  for (const selector of [
    '.ai-intro',
    '.ai-dev-grid',
    '.ai-two-col',
    '.limits-row',
    '.control-flow',
    '.qa-grid',
    '.qa-flow',
    '.qa-principles',
    '.findings-panel',
    '.findings-panel ul',
    '.ai-close',
  ]) {
    expect(await columnCount(page, `#ai ${selector}`), selector).toBe(1);
  }
  const ai$ = section(page);
  await expect(ai$.locator('h2')).toHaveCSS('font-size', '46px');
  await expect(ai$.locator('.ai-intro')).toHaveCSS('row-gap', '40px');
  await expect(ai$.locator('.ai-card').first()).toHaveCSS('padding-top', '40px');
  await expect(ai$.locator('.ai-card').nth(1)).toHaveCSS('border-top-width', '1px');
  await expect(ai$.locator('.ai-card').nth(1)).toHaveCSS('border-left-width', '0px');
  await expect(ai$.locator('.closing-quote')).toHaveCSS('padding-left', '24px');
  await expect(ai$.locator('.text-link')).toHaveCSS('margin-top', '8px');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test('between 600px and 900px the control and QA flows use two columns', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto('/');
  expect(await columnCount(page, '#ai .control-flow')).toBe(2);
  expect(await columnCount(page, '#ai .qa-flow')).toBe(2);
  expect(await columnCount(page, '#ai .ai-two-col')).toBe(1);
  await page.setViewportSize({ width: 901, height: 900 });
  expect(await columnCount(page, '#ai .control-flow')).toBe(5);
  expect(await columnCount(page, '#ai .qa-flow')).toBe(8);
  expect(await columnCount(page, '#ai .ai-two-col')).toBe(2);
});
