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

for (const path of PAGES) {
  for (const scheme of SCHEMES) {
    for (const width of WIDTHS) {
      test(`${path} (${scheme}) at ${width}px has no overflow and no clipped text`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        if (path === '/build') await expect(page.locator('#dashboard .kpis .tile')).toHaveCount(6);
        expect(await layoutDefects(page)).toEqual([]);
      });
    }
  }
}

// Visual baselines, one set per platform. Screenshots differ between
// operating systems (font rasterising; Inter is not installed on Linux), so
// there are two committed sets: Windows (where tr-harness runs the gate) and
// Linux, rendered in the Playwright container that CI also runs in
// (.github/workflows/ci.yml). Refresh the Linux set with
// `npm run test:baselines:linux`. Other platforms report the tests as skipped.
//
// The homepage is light only (color-scheme: light; the reference defines no
// dark palette), so it has light baselines only. It is shot above and below
// the build-story section: the build-record card shows the latest run, so its
// height changes with every harness run and would move everything below it.
// /build is shot on the frozen Toprope dataset, so the whole dashboard, light
// and dark, is under the baseline; only the "data updated" time (file mtime)
// is masked.
const comparesScreenshots = ['win32', 'linux'].includes(process.platform);
const SHOTS = [
  ...WIDTHS.map((width) => ({ path: '/', scheme: 'light' as const, width })),
  ...SCHEMES.flatMap((scheme) => WIDTHS.map((width) => ({ path: '/build', scheme, width }))),
];

for (const { path, scheme, width } of SHOTS) {
  test(`${path} (${scheme}) at ${width}px matches its baseline`, async ({ page }) => {
    test.skip(!comparesScreenshots, 'baselines exist for Windows and Linux only; see the comment above');
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width, height: 900 });
    const name = `${slug(path)}-${scheme}-${width}`;
    if (path === '/') {
      await page.goto('/');
      const { top, bottom, height } = await page.locator('#build-story').evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top + scrollY, bottom: r.bottom + scrollY, height: document.documentElement.scrollHeight };
      });
      await expect(page).toHaveScreenshot(`${name}-above.png`, { fullPage: true, clip: { x: 0, y: 0, width, height: top } });
      await expect(page).toHaveScreenshot(`${name}-below.png`, {
        fullPage: true,
        clip: { x: 0, y: bottom, width, height: height - bottom },
      });
    } else {
      await page.goto('/build#dataset=toprope');
      await expect(page.locator('#dashboard .kpis .value').first()).toHaveText('172');
      await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, mask: [page.locator('#dashboard .asof')] });
    }
  });
}

// WCAG 2.5.5: on touch screens every control that is not a link inside a
// run of text takes at least 44 × 44 px. Probed with elementFromPoint 21px
// from the centre in each direction (inside a 44px box, with 1px for the
// rounding of fractional positions), so it measures the real hit area
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
            const probes = [[cx, cy - 21], [cx, cy + 21], [cx - 21, cy], [cx + 21, cy]];
            const hits = probes.map(([x, y]) => document.elementFromPoint(x, y));
            if (!hits.every((hit) => hit && (hit === el || el.contains(hit)))) {
              misses.push(`${el.tagName.toLowerCase()} "${el.textContent!.trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
            }
          }
          return { count: controls.length, misses };
        });
        expect(small.count).toBeGreaterThan(5);
        expect(small.misses).toEqual([]);
        // The grown dashboard buttons (touch-size) must not break the layout.
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        expect(await layoutDefects(page)).toEqual([]);
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
// of each control must be exactly its edge colour. The header CV link has no
// fill or border, so its rows guard against one being added off the grid; the
// header's own 1px rule cannot be crisp at these scales (1px is 1.25 / 1.5
// device pixels), whatever the layout, so it is not sampled.
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
          if (edge !== 'header') {
            // The source fix: the button box starts and ends on whole device pixels.
            for (const css of [box.y, box.y + box.height]) {
              expect(Math.abs(css * dpr - Math.round(css * dpr)), `${selector} edge at ${css}px`).toBeLessThan(0.01);
            }
          }
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

test('CI runs in the Playwright image the Linux baselines are rendered in', () => {
  const { version } = JSON.parse(readFileSync('node_modules/@playwright/test/package.json', 'utf8')) as { version: string };
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  expect(ci).toContain(`image: mcr.microsoft.com/playwright:v${version}-noble`);
});
