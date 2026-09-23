import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import config from '../astro.config.mjs';
import { site } from '../src/data/site';

// Open Graph / Twitter share tags, checked on the build output: link
// scrapers read the HTML as shipped and never run JS.
const SITE = config.site!;

function meta(html: string, key: string): string[] {
  const re = new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`, 'g');
  return [...html.matchAll(re)].map((m) => m[1].replace(/&amp;/g, '&'));
}

// Width and height from a JPEG's first start-of-frame marker; null if the
// file is not a JPEG.
function jpegSize(buf: Buffer): { width: number; height: number } | null {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    // SOF0–SOF15, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

test('jpegSize reads a JPEG frame and rejects other files', () => {
  // SOI, APP0 (length 4), SOF0 for 630 high × 1200 wide.
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, 0x02, 0x76, 0x04, 0xb0, 3]);
  expect(jpegSize(jpeg)).toEqual({ width: 1200, height: 630 });
  expect(jpegSize(Buffer.from('RIFF....WEBPVP8 '))).toBeNull();
  expect(jpegSize(Buffer.from([0xff, 0xd8, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
});

const pages = [
  { file: 'dist/index.html', path: '/', copy: site.pages.home },
  { file: 'dist/build/index.html', path: '/build/', copy: site.pages.build },
];

for (const { file, path, copy } of pages) {
  test(`${file} has share tags with a 1200×630 JPEG og:image`, () => {
    const html = readFileSync(file, 'utf8');

    const images = meta(html, 'og:image');
    expect(images).toHaveLength(1);
    const image = images[0];
    expect(image.startsWith(SITE.replace(/\/?$/, '/'))).toBe(true);
    expect(meta(html, 'twitter:image')).toEqual([image]);

    const local = `dist${new URL(image).pathname}`;
    expect(existsSync(local)).toBe(true);
    expect(jpegSize(readFileSync(local))).toEqual({ width: 1200, height: 630 });
    expect(meta(html, 'og:image:width')).toEqual(['1200']);
    expect(meta(html, 'og:image:height')).toEqual(['630']);
    expect(meta(html, 'og:image:alt')).toEqual([site.pages.shareImageAlt]);

    const title = /<title>([^<]*)<\/title>/.exec(html)![1].replace(/&amp;/g, '&');
    expect(title).toBe(copy.title);
    expect(meta(html, 'og:title')).toEqual([title]);
    expect(meta(html, 'twitter:title')).toEqual([title]);
    expect(meta(html, 'og:description')).toEqual([copy.description]);
    expect(meta(html, 'twitter:description')).toEqual([copy.description]);
    expect(meta(html, 'description')).toEqual([copy.description]);
    expect(meta(html, 'twitter:card')).toEqual(['summary_large_image']);
    expect(meta(html, 'og:type')).toEqual(['website']);

    const url = new URL(path, SITE).href;
    expect(meta(html, 'og:url')).toEqual([url]);
    const canonical = [...html.matchAll(/<link rel="canonical" href="([^"]*)"/g)].map((m) => m[1]);
    expect(canonical).toEqual([url]);
  });
}
