import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

// Content lives only in src/data/site.ts. Flag any template text node or
// quoted prose (two or more words) in pages and components.
const ROOTS = ['src/pages', 'src/components'];

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.(astro|tsx?)$/.test(e.name) ? [p] : [];
  });
}

function inlineCopy(source: string): string[] {
  const hits: string[] = [];
  const parts = source.split(/^---$/m);
  const template = parts.length >= 3 ? parts.slice(2).join('---') : source;
  const frontmatter = parts.length >= 3 ? parts[1] : '';
  // Text between tags that is not only whitespace or an {expression}.
  for (const m of template.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)) hits.push(m[1].trim());
  // Quoted prose: string literals and attribute values with a space and letters.
  for (const m of (frontmatter + template).matchAll(/(["'`])([A-Za-z][^"'`\n]*\s[^"'`\n]*[A-Za-z])\1/g)) {
    hits.push(m[2]);
  }
  return hits;
}

test('inlineCopy detects text nodes and quoted prose', () => {
  expect(inlineCopy('---\n---\n<h1>Hello there</h1>')).toEqual(['Hello there']);
  expect(inlineCopy('---\n---\n<Base title="Build record" />')).toEqual(['Build record']);
  expect(inlineCopy('---\nconst a = 1;\n---\n<h1>{site.hero.x}</h1>\n<p class="a b">{y}</p>')).toEqual(['a b']);
});

test('no content strings under src/pages or src/components', () => {
  const offenders = ROOTS.flatMap(files).flatMap((f) =>
    inlineCopy(readFileSync(f, 'utf8')).map((hit) => `${f}: ${hit}`),
  );
  expect(offenders).toEqual([]);
});
