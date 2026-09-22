import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Every custom property in the reference CSS must exist in tokens.scss with
// the same value. Prints the missing/changed set on failure.
function customProperties(css: string): Map<string, string> {
  const props = new Map<string, string>();
  for (const [, name, value] of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    props.set(name, value.trim());
  }
  return props;
}

test('tokens.scss defines every reference custom property', () => {
  const reference = customProperties(readFileSync('design-reference/site/styles.css', 'utf8'));
  const tokens = customProperties(readFileSync('src/styles/tokens.scss', 'utf8'));

  expect(reference.size).toBeGreaterThan(0);
  const diff = [...reference]
    .filter(([name, value]) => tokens.get(name) !== value)
    .map(([name, value]) => `${name}: reference "${value}", tokens "${tokens.get(name) ?? 'missing'}"`);
  expect(diff).toEqual([]);
});
