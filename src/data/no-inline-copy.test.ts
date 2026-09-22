import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import ts from 'typescript';

// Content lives only in src/data/site.ts. This scans pages and components for
// visible text: template text nodes, prose-bearing attributes, and prose-like
// string literals in frontmatter or .tsx.
const REPO = fileURLToPath(new URL('../../', import.meta.url));
const ROOTS = ['src/pages', 'src/components'];

// Attributes whose values are markup, never copy.
const MARKUP_ATTRS = new Set([
  'class', 'class:list', 'classname', 'id', 'href', 'src', 'srcset', 'sizes', 'rel',
  'target', 'type', 'lang', 'dir', 'charset', 'name', 'loading', 'decoding',
  'fetchpriority', 'role', 'for', 'htmlfor', 'width', 'height', 'media', 'viewbox',
  'd', 'fill', 'stroke', 'xmlns', 'style', 'tabindex', 'method', 'action',
  'autocomplete', 'inputmode', 'crossorigin', 'referrerpolicy', 'http-equiv',
  'aria-hidden', 'aria-current', 'aria-expanded', 'aria-controls',
  'aria-labelledby', 'aria-describedby', 'key',
]);
// Attributes whose values are read by people or assistive tech: any word counts.
const PROSE_ATTRS = new Set(['alt', 'title', 'aria-label', 'aria-description', 'placeholder', 'label']);

const hasLetter = (s: string): boolean => /\p{L}/u.test(s);
// Prose: has a letter and is not a plain lowercase token list (class names, keywords).
const looksLikeProse = (s: string): boolean =>
  hasLetter(s) && !/^\s*[a-z0-9_:/.-]*(\s+[a-z0-9_:/.-]+)*\s*$/.test(s);

function attrHit(name: string, value: string): boolean {
  const key = name.toLowerCase();
  if (MARKUP_ATTRS.has(key) || /^(data|is|set|client|stroke|on)[-:]/.test(key)) return false;
  return PROSE_ATTRS.has(key) ? hasLetter(value) : looksLikeProse(value);
}

// String literals and JSX in TypeScript source (frontmatter or a .tsx file).
function scriptCopy(source: string, tsx: boolean): string[] {
  const file = ts.createSourceFile('x.tsx', source, ts.ScriptTarget.Latest, true, tsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const hits: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isJsxText(node)) {
      if (hasLetter(node.text)) hits.push(node.text.trim());
    } else if (ts.isJsxAttribute(node)) {
      if (node.initializer && ts.isStringLiteral(node.initializer)) {
        if (attrHit(node.name.getText(file), node.initializer.text)) hits.push(node.initializer.text);
      }
      return;
    } else if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      if (looksLikeProse(node.text)) hits.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return hits;
}

const TAG = /<\/?[A-Za-z][\w.:-]*((?:[^>"'{}]|"[^"]*"|'[^']*'|\{[^{}]*\})*)>/y;

// Text nodes and attributes in an Astro template.
function templateCopy(template: string): string[] {
  const hits: string[] = [];
  const t = template.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ');

  // A text run is template text only when it opens after a tag or a closing
  // `}` and ends at a tag or an opening `{`. Runs that start just inside `{`
  // or end at `}` are expression code (`{a > b && <x/>}`, `{... : null}`).
  let run = '';
  let opensAsText = true;
  const flush = (closesAsText: boolean): void => {
    if (opensAsText && closesAsText && hasLetter(run)) hits.push(run.replace(/\s+/g, ' ').trim());
    run = '';
  };
  for (let i = 0; i < t.length; ) {
    TAG.lastIndex = i;
    const tag = TAG.exec(t);
    if (tag) {
      flush(true);
      for (const a of tag[1].matchAll(/([A-Za-z_:@][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
        const value = a[2] ?? a[3];
        if (attrHit(a[1], value)) hits.push(value);
      }
      opensAsText = true;
      i += tag[0].length;
    } else if (t[i] === '{' || t[i] === '}') {
      flush(t[i] === '{');
      opensAsText = t[i] === '}';
      i++;
    } else {
      run += t[i++];
    }
  }
  flush(true);
  return hits;
}

function inlineCopy(source: string, tsx = false): string[] {
  if (tsx) return scriptCopy(source, true);
  const fence = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const frontmatter = fence ? fence[1] : '';
  const template = fence ? source.slice(fence[0].length) : source;
  return [...new Set([...scriptCopy(frontmatter, false), ...templateCopy(template)])];
}

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.(astro|tsx?)$/.test(e.name) ? [p] : [];
  });
}

const astro = (template: string, frontmatter = ''): string => `---\n${frontmatter}\n---\n${template}`;

test('inlineCopy finds copy in text, attributes and literals', () => {
  expect(inlineCopy(astro('<h1>Hello there</h1>'))).toEqual(['Hello there']);
  expect(inlineCopy(astro('<p>Hi</p>'))).toEqual(['Hi']);
  expect(inlineCopy(astro('<p>Built by {name} in Belgrade</p>'))).toEqual(['Built by', 'in Belgrade']);
  expect(inlineCopy(astro('<ul>{items.map((i) => <li>Item {i}</li>)}</ul>'))).toEqual(['Item']);
  expect(inlineCopy(astro('<Base title="Build record — Goran Ocokoljić" />'))).toEqual(['Build record — Goran Ocokoljić']);
  expect(inlineCopy(astro('<button aria-label="Close" />'))).toEqual(['Close']);
  expect(inlineCopy(astro('<img alt="20+ portals" />'))).toEqual(['20+ portals']);
  expect(inlineCopy(astro('<Card heading="No runs recorded yet." />'))).toEqual(['No runs recorded yet.']);
  expect(inlineCopy(astro('<p>{x}</p>', "const s = 'I don\\'t ship broken';"))).toEqual(["I don't ship broken"]);
  expect(inlineCopy(astro('<p>{x}</p>', 'const s = `Hello ${name}`;'))).toEqual(['Hello ']);
  expect(inlineCopy('export default () => <p className="a b">Runs: {n}</p>;', true)).toEqual(['Runs:']);
});

test('inlineCopy ignores markup, code and data references', () => {
  const clean = astro(
    [
      '<header class="site-header container" data-x="Some Thing">',
      '  <a href="#platform" rel="noopener noreferrer" target="_blank">{site.nav.work}</a>',
      '  <img src={img} alt="" loading="lazy" decoding="async" />',
      '  <Section tone="dark" class:list={["a b", x]} />',
      '  {a > b && c < d ? <span>{x}</span> : null}',
      '  <!-- A comment with words -->',
      '</header>',
      '<style>h1 { font-family: "Inter Tight", sans-serif; }</style>',
      '<script>if (a > b && c < d) run();</script>',
    ].join('\n'),
    "import Base from '../layouts/Base.astro';\nimport { site } from '../data/site';\nconst cls = 'hero container';",
  );
  expect(inlineCopy(clean)).toEqual([]);
  expect(inlineCopy('const f = (x: number) => x < y ? x : y;\nexport default () => <p className="a b">{f(1)}</p>;', true)).toEqual([]);
});

test('no content strings under src/pages or src/components', () => {
  const scanned = ROOTS.flatMap((root) => {
    try {
      return files(join(REPO, root));
    } catch {
      return [];
    }
  });
  expect(scanned.length).toBeGreaterThan(0);
  const offenders = scanned.flatMap((f) =>
    inlineCopy(readFileSync(f, 'utf8'), f.endsWith('.tsx')).map((hit) => `${relative(REPO, f)}: ${hit}`),
  );
  expect(offenders).toEqual([]);
});
