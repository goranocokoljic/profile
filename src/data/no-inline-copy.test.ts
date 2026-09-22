import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import ts from 'typescript';

// Content lives only in src/data/site.ts. Best-effort guard: it scans pages
// and components for template text, prose-bearing attributes and prose-like
// string literals (in frontmatter, .ts/.tsx and template expressions).
// Limit: a multi-word lowercase literal in script is flagged even when it is
// a class list — put class lists in `class` / `class:list`, which are skipped.
const REPO = fileURLToPath(new URL('../../', import.meta.url));
const ROOTS = ['src/pages', 'src/components'];

// Attributes whose values are markup, never copy. Literals inside their
// expressions are skipped too.
const MARKUP_ATTRS = new Set([
  'class', 'class:list', 'classname', 'id', 'href', 'src', 'srcset', 'sizes', 'style',
  'media', 'd', 'viewbox', 'transform', 'preserveaspectratio', 'gradientunits',
  'points', 'action', 'rel', 'key',
]);
// Attributes read by people or assistive tech: any word counts.
const PROSE_ATTRS = new Set(['alt', 'title', 'aria-label', 'aria-description', 'placeholder', 'label', 'set:text']);

type Context = 'markup' | 'prose' | 'default';

function attrContext(name: string): Context {
  const key = name.toLowerCase();
  if (PROSE_ATTRS.has(key)) return 'prose';
  if (MARKUP_ATTRS.has(key) || /^(data|is|set|client|on)[-:]/.test(key)) return 'markup';
  return 'default';
}

const hasLetter = (s: string): boolean => /\p{L}/u.test(s.replace(/&#?\w+;/g, ''));
// Prose: two or more word tokens (a letter first, then only letters and
// punctuation). Rules out `en-US`, `width=device-width, …`, `translate(4, 4)`.
const looksLikeProse = (s: string): boolean =>
  s.split(/\s+/).filter((w) => /^\p{L}[\p{L}'’.,!?;:—–-]*$/u.test(w)).length >= 2;

function literalHit(value: string, context: Context): boolean {
  if (context === 'markup') return false;
  return context === 'prose' ? hasLetter(value) : looksLikeProse(value);
}

// Literals and JSX in TypeScript/TSX source.
function scriptCopy(source: string, tsx: boolean, context: Context = 'default'): string[] {
  const kind = tsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(tsx ? 'x.tsx' : 'x.ts', source, ts.ScriptTarget.Latest, true, kind);
  const hits: string[] = [];
  const visit = (node: ts.Node, ctx: Context): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isJsxText(node)) {
      if (hasLetter(node.text)) hits.push(node.text.replace(/\s+/g, ' ').trim());
      return;
    }
    if (ts.isJsxAttribute(node)) {
      const attrCtx = attrContext(node.name.getText(file));
      if (node.initializer) visit(node.initializer, attrCtx);
      return;
    }
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      if (literalHit(node.text, ctx)) hits.push(node.text);
    }
    ts.forEachChild(node, (child) => visit(child, ctx));
  };
  visit(file, context);
  return hits;
}

// Index just past the `}` that closes the `{` at `start`.
function closeBrace(s: string, start: number): number {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}' && --depth === 0) return i + 1;
  }
  return s.length;
}

// Text, attributes and {expressions} in an Astro template. Expressions are
// parsed as TSX, so literals and JSX inside them are checked too.
function templateCopy(template: string): string[] {
  const t = template.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ');
  const hits: string[] = [];
  let text = '';
  const flush = (): void => {
    if (hasLetter(text)) hits.push(text.replace(/\s+/g, ' ').trim());
    text = '';
  };
  const expression = (body: string, context: Context): void => {
    hits.push(...scriptCopy(`(${body}\n)`, true, context));
  };

  let i = 0;
  while (i < t.length) {
    if (t[i] === '{') {
      flush();
      const end = closeBrace(t, i);
      expression(t.slice(i + 1, end - 1), 'default');
      i = end;
    } else if (t[i] === '<' && /[A-Za-z/]/.test(t[i + 1] ?? '')) {
      flush();
      const name = /^<\/?[\w.:-]*/.exec(t.slice(i))![0];
      i += name.length;
      // Attributes until `>`: name, optionally = "…" | '…' | {…}.
      while (i < t.length && t[i] !== '>') {
        const attr = /^[^\s=>/{]+/.exec(t.slice(i));
        if (!attr) {
          if (t[i] === '{') i = closeBrace(t, i); // spread: {...props}
          else i++;
          continue;
        }
        i += attr[0].length;
        const eq = /^\s*=\s*/.exec(t.slice(i));
        if (!eq) continue;
        i += eq[0].length;
        const q = t[i];
        if (q === '"' || q === "'") {
          const end = t.indexOf(q, i + 1);
          const value = t.slice(i + 1, end);
          if (literalHit(value, attrContext(attr[0]))) hits.push(value);
          i = end + 1;
        } else if (q === '{') {
          const end = closeBrace(t, i);
          expression(t.slice(i + 1, end - 1), attrContext(attr[0]));
          i = end;
        }
      }
      i++;
    } else {
      text += t[i++];
    }
  }
  flush();
  return hits;
}

function inlineCopy(source: string, ext: 'astro' | 'ts' | 'tsx' = 'astro'): string[] {
  let hits: string[];
  if (ext !== 'astro') {
    hits = scriptCopy(source, ext === 'tsx');
  } else {
    const fence = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    hits = [
      ...scriptCopy(fence ? fence[1] : '', false),
      ...templateCopy(fence ? source.slice(fence[0].length) : source),
    ];
  }
  return [...new Set(hits)];
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
  expect(inlineCopy(astro('<p>{open ? "Hide details" : "Show details"}</p>'))).toEqual(['Hide details', 'Show details']);
  expect(inlineCopy(astro('<Base title="Build record — Goran Ocokoljić" />'))).toEqual(['Build record — Goran Ocokoljić']);
  expect(inlineCopy(astro('<button aria-label="Close" />'))).toEqual(['Close']);
  expect(inlineCopy(astro('<button aria-label={`Close ${name}`} />'))).toEqual(['Close ']);
  expect(inlineCopy(astro('<img alt="20+ portals" />'))).toEqual(['20+ portals']);
  expect(inlineCopy(astro('<Card heading="no runs recorded yet" />'))).toEqual(['no runs recorded yet']);
  expect(inlineCopy(astro('<p set:text="Plain words here" />'))).toEqual(['Plain words here']);
  expect(inlineCopy(astro('<p>{x}</p>', "const s = 'I don\\'t ship broken';"))).toEqual(["I don't ship broken"]);
  expect(inlineCopy(astro('<p>{x}</p>', "const f = ['entered state lost after a failed save'];"))).toEqual([
    'entered state lost after a failed save',
  ]);
  expect(inlineCopy('export default () => <p className="a b" aria-label={"Close dialog"}>Runs: {n}</p>;', 'tsx')).toEqual([
    'Close dialog',
    'Runs:',
  ]);
  expect(inlineCopy("export const label = { text: 'Download the CV now' };", 'ts')).toEqual(['Download the CV now']);
});

test('inlineCopy ignores markup, code and data references', () => {
  const clean = astro(
    [
      '<header class="site-header container" data-x="Some Thing">',
      '  <a href="#platform" rel="noopener noreferrer" target="_blank">{site.nav.work}</a>',
      '  <img src={img} alt="" loading="lazy" decoding="async" />',
      '  <Section tone="dark" class:list={["a b", { "is dark": isDark }]} style={{ "--n": n }} {...rest} />',
      '  {a > b && c < d ? <span>{x}</span> : cond ? <b /> : null}',
      '  <svg viewBox="0 0 10 10" preserveAspectRatio="xMidYMid meet"><g transform="translate(4, 4)" /></svg>',
      '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
      '  <span>{a}&nbsp;&middot;&nbsp;{b}</span>',
      '  <!-- A comment with words -->',
      '</header>',
      '<style>h1 { font-family: "Inter Tight", sans-serif; }</style>',
      '<script>if (a > b && c < d) run();</script>',
    ].join('\n'),
    "import Base from '../layouts/Base.astro';\nimport { site } from '../data/site';\nconst usd = new Intl.NumberFormat('en-US', { currency: 'USD' });",
  );
  expect(inlineCopy(clean)).toEqual([]);
  expect(inlineCopy('const f = (x: number) => x < y ? x : y;\nexport default () => <p className="a b">{f(1)}</p>;', 'tsx')).toEqual([]);
  expect(inlineCopy('export function fmt(n: number): string {\n  return n.toFixed(2);\n}', 'ts')).toEqual([]);
});

test('no content strings under src/pages or src/components', () => {
  const scanned = ROOTS.flatMap((root) => {
    try {
      return files(join(REPO, root));
    } catch {
      return []; // src/components does not exist until the first section lands
    }
  });
  expect(scanned.length).toBeGreaterThan(0);
  const offenders = scanned.flatMap((f) => {
    const ext = f.endsWith('.astro') ? 'astro' : f.endsWith('.tsx') ? 'tsx' : 'ts';
    return inlineCopy(readFileSync(f, 'utf8'), ext).map((hit) => `${relative(REPO, f)}: ${hit}`);
  });
  expect(offenders).toEqual([]);
});
