// Astro integration: moves the inline <script> and <style> blocks Astro writes
// for hydrated islands (the astro-island runtime, the client:visible directive
// and the `astro-island { display: contents }` rule) into files under
// /_astro/. The site must run under CSP `default-src 'self'`, which blocks
// inline code, and Astro 5 has no option to emit these as files.
//
// A classic <script src> without async/defer runs in document order and
// blocks like the inline one did, so behaviour is unchanged. JSON data blocks
// (`type="application/json"`) are not executed and stay inline.

import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = /<script>([\s\S]*?)<\/script>/g;
const STYLE = /<style>([\s\S]*?)<\/style>/g;

/**
 * Rewrites one HTML document. `write(ext, body)` stores a file and returns its
 * site path. Only attribute-less <script> and <style> tags are touched.
 */
export function externalize(html, write) {
  return html
    .replace(SCRIPT, (_, body) => `<script src="${write('js', body)}"></script>`)
    .replace(STYLE, (_, body) => `<link rel="stylesheet" href="${write('css', body)}">`);
}

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith('.html'))
    .map((e) => join(e.parentPath, e.name));
}

export default function externalizeInline() {
  return {
    name: 'externalize-inline',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const assets = join(root, '_astro');
        mkdirSync(assets, { recursive: true });
        const written = new Set();
        const write = (ext, body) => {
          const name = `inline.${createHash('sha256').update(body).digest('hex').slice(0, 10)}.${ext}`;
          if (!written.has(name)) {
            writeFileSync(join(assets, name), body);
            written.add(name);
          }
          return `/_astro/${name}`;
        };
        for (const file of htmlFiles(root)) {
          const html = readFileSync(file, 'utf8');
          const out = externalize(html, write);
          if (out !== html) writeFileSync(file, out);
        }
        if (written.size) logger.info(`moved ${written.size} inline block(s) to /_astro/`);
      },
    },
  };
}
