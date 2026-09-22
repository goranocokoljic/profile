import { test } from 'node:test';
import assert from 'node:assert/strict';
import { externalize } from './externalize-inline.mjs';

// Records every block handed to `write` and returns a fake path for it.
function recorder() {
  const blocks = [];
  const write = (ext, body) => {
    blocks.push([ext, body]);
    return `/_astro/f${blocks.length}.${ext}`;
  };
  return { blocks, write };
}

test('inline scripts and styles become files, in order', () => {
  const { blocks, write } = recorder();
  const html = '<p>a</p><style>x{display:contents}</style><script>(()=>{a()})();</script><script>b()</script>';
  assert.equal(
    externalize(html, write),
    '<p>a</p><link rel="stylesheet" href="/_astro/f3.css"><script src="/_astro/f1.js"></script><script src="/_astro/f2.js"></script>',
  );
  assert.deepEqual(blocks, [['js', '(()=>{a()})();'], ['js', 'b()'], ['css', 'x{display:contents}']]);
});

test('scripts and styles with attributes are left alone', () => {
  const { blocks, write } = recorder();
  const html =
    '<script type="application/json" id="d">{"a":"<b>"}</script><script type="module" src="/_astro/m.js"></script><style lang="x">y{}</style>';
  assert.equal(externalize(html, write), html);
  assert.deepEqual(blocks, []);
});

test('a page with no inline blocks is returned unchanged', () => {
  const { write } = recorder();
  assert.equal(externalize('<main>No inline code</main>', write), '<main>No inline code</main>');
});
