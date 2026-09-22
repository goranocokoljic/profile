import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import sharp from 'sharp';

// The #14 pass over the whole site: layout at four widths in both colour
// schemes, touch target size, axe, page weight, and whole-pixel button edges.

const PAGES = ['/', '/build'] as const;
const WIDTHS = [390, 768, 1024, 1440] as const;
const SCHEMES = ['light', 'dark'] as const;
const slug = (path: string) => (path === '/' ? 'home' : 'build');

// Layout defects the eye would call broken: a page wider than the viewport,
// something poking out of it (tables scroll inside .scroll-x on purpose), or
// text cut off by its own box.
async function layoutDefects(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const name = (el: Element) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`;
    const defects: string[] = [];
    if (document.documentElement.scrollWidth > width) defects.push(`page scrolls sideways: ${document.documentElement.scrollWidth}px`);
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('.scroll-x, .visually-hidden')) continue;
      const r = el.getBoundingClientRect();
      if (r.width && (r.left < -0.5 || r.right > width + 0.5)) defects.push(`outside the viewport: ${name(el)}`);
      const cs = getComputedStyle(el);
      const clips = cs.overflowX === 'hidden' || cs.overflowY === 'hidden' || cs.textOverflow === 'ellipsis';
      const hasText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
      if (clips && hasText && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) {
        defects.push(`clipped text: ${name(el)}`);
      }
    }
    return defects;
  });
}

// Screenshots differ between operating systems (font rasterising, and Inter
// is not installed on the Linux CI runner), so the committed baselines are
// the Windows ones and only Windows compares against them. The layout checks
// above run everywhere. Run-dependent data is masked: it changes with every
// harness run.
const comparesScreenshots = process.platform === 'win32';

for (const path of PAGES) {
  for (const scheme of SCHEMES) {
    for (const width of WIDTHS) {
      test(`${path} (${scheme}) at ${width}px has no overflow, no clipped text and matches its baseline`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        if (path === '/build') await expect(page.locator('#dashboard .kpis .tile')).toHaveCount(6);
        expect(await layoutDefects(page)).toEqual([]);
        if (!comparesScreenshots) return;
        const name = `${slug(path)}-${scheme}-${width}.png`;
        if (path === '/') {
          await expect(page).toHaveScreenshot(name, { fullPage: true, mask: [page.locator('astro-island')] });
        } else {
          // The dashboard grows with every run; its layout is checked above.
          await expect(page).toHaveScreenshot(name, { mask: [page.locator('#dashboard')] });
        }
      });
    }
  }
}

// WCAG 2.5.5: on touch screens every control that is not a link inside a
// run of text takes at least 44 × 44 px. Probed with elementFromPoint 20px
// from the centre in each direction, so it measures the real hit area
// (the touch-target mixin grows it with ::after), not the box.
test.describe('touch targets', () => {
  test.use({ hasTouch: true });

  for (const path of PAGES) {
    for (const width of [390, 768]) {
      test(`${path} at ${width}px: every control has a 44px hit area`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        if (path === '/build') await expect(page.locator('#dashboard .kpis .tile')).toHaveCount(6);
        const small = await page.evaluate(() => {
          const inText = (el: Element) =>
            getComputedStyle(el).display === 'inline' && el.parentElement!.closest('p, li, td, dd, figcaption, caption');
          const controls = [...document.querySelectorAll('a[href], button')].filter(
            (el) => el.getClientRects().length && !inText(el),
          );
          const misses: string[] = [];
          for (const el of controls) {
            // instant: the page sets scroll-behavior: smooth.
            el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const probes = [[cx, cy - 20], [cx, cy + 20], [cx - 20, cy], [cx + 20, cy]];
            const hits = probes.map(([x, y]) => document.elementFromPoint(x, y));
            if (!hits.every((hit) => hit && (hit === el || el.contains(hit)))) {
              misses.push(`${el.tagName.toLowerCase()} "${el.textContent!.trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
            }
          }
          return { count: controls.length, misses };
        });
        expect(small.count).toBeGreaterThan(5);
        expect(small.misses).toEqual([]);
      });
    }
  }

  test('a fine pointer keeps the reference geometry: no hit-area overlay', async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: false });
    const page = await context.newPage();
    await page.goto('/');
    const after = await page.locator('.header-cv').evaluate((el) => getComputedStyle(el, '::after').content);
    expect(after).toBe('none');
    await context.close();
  });
});

// Every page, both schemes, phone and desktop: nothing serious or critical.
// "Needs review" items (axe's incomplete list, mostly contrast it cannot
// compute over gradients and images) are attached to the report.
for (const path of PAGES) {
  for (const scheme of SCHEMES) {
    for (const width of [390, 1440]) {
      test(`axe: ${path} (${scheme}) at ${width}px has no serious or critical violations`, async ({ page }, info) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        if (path === '/build') await expect(page.locator('#dashboard .kpis .tile')).toHaveCount(6);
        const results = await new AxeBuilder({ page }).analyze();
        const bad = results.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
        expect(bad).toEqual([]);
        const review = results.incomplete.map((v) => `${v.id} (${v.nodes.length})`).join(', ');
        info.annotations.push({ type: 'axe needs review', description: review || 'none' });
      });
    }
  }
}

test('/ cold load transfers under 1 MB, images included', async ({ page }, info) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  let bytes = 0;
  cdp.on('Network.loadingFinished', (e) => (bytes += e.encodedDataLength));
  await page.goto('/', { waitUntil: 'networkidle' });
  // Lazy images load only near the viewport: walk the page to the end.
  for (let y = 0; y < (await page.evaluate(() => document.body.scrollHeight)); y += 600) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(50);
  }
  await page.waitForLoadState('networkidle');
  info.annotations.push({ type: 'transfer', description: `${bytes} bytes` });
  expect(bytes).toBeGreaterThan(50_000);
  expect(bytes).toBeLessThan(1_000_000);
});

test('fonts are the system stack, or self-hosted with font-display: swap', async ({ page }) => {
  const fontRequests: string[] = [];
  page.on('request', (r) => r.resourceType() === 'font' && fontRequests.push(r.url()));
  for (const path of PAGES) await page.goto(path, { waitUntil: 'networkidle' });
  const faces = readdirSync('dist/_astro')
    .filter((f) => f.endsWith('.css'))
    .flatMap((f) => readFileSync(`dist/_astro/${f}`, 'utf8').match(/@font-face\s*{[^}]*}/g) ?? []);
  expect(faces.filter((face) => !/font-display:\s*swap/.test(face))).toEqual([]);
  expect(fontRequests.filter((url) => !url.startsWith('http://localhost'))).toEqual([]);
  if (!faces.length) expect(fontRequests).toEqual([]);
});

// #14 defect: at 125% / 150% display scaling the hero's primary button showed
// a lighter strip along its bottom edge. Its box started between device
// pixels, so the edge row was anti-aliased. The outermost device-pixel rows
// of each control must be exactly its edge colour.
const EDGES = [
  { selector: '.hero .button-primary', edge: 'background-color' },
  { selector: '.hero .button-secondary', edge: 'border-bottom-color' },
  { selector: '.header-cv', edge: 'header' },
] as const;

const rgb = (css: string) => css.match(/\d+/g)!.slice(0, 3).map(Number);

for (const dpr of [1.25, 1.5]) {
  test.describe(`deviceScaleFactor ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr });

    for (const width of [1440, 1024, 390]) {
      test(`hero buttons and header CV link have clean top and bottom edges at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto('/', { waitUntil: 'networkidle' });
        const { data, info } = await sharp(await page.screenshot()).raw().toBuffer({ resolveWithObject: true });
        const rowColour = (row: number, x0: number, x1: number) => {
          const sum = [0, 0, 0];
          for (let x = x0; x < x1; x++) {
            const i = (row * info.width + x) * info.channels;
            for (let c = 0; c < 3; c++) sum[c] += data[i + c];
          }
          return sum.map((v) => Math.round(v / (x1 - x0)));
        };
        for (const { selector, edge } of EDGES) {
          const el = page.locator(selector);
          const box = (await el.boundingBox())!;
          const want = rgb(
            edge === 'header'
              ? await page.locator('.site-header').evaluate((h) => getComputedStyle(h).backgroundColor)
              : await el.evaluate((e, prop) => getComputedStyle(e).getPropertyValue(prop), edge),
          );
          // The middle 40% of the width: clear of the rounded corners.
          const x0 = Math.round((box.x + box.width * 0.3) * dpr);
          const x1 = Math.round((box.x + box.width * 0.7) * dpr);
          const top = Math.floor(box.y * dpr);
          const bottom = Math.ceil((box.y + box.height) * dpr) - 1;
          for (const [side, row] of [['top', top], ['bottom', bottom]] as const) {
            const got = rowColour(row, x0, x1);
            const off = Math.max(...got.map((v, c) => Math.abs(v - want[c])));
            expect(off, `${selector} ${side} row is rgb(${got}) not rgb(${want})`).toBeLessThanOrEqual(2);
          }
        }
      });
    }
  });
}
