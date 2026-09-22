import astro from 'eslint-plugin-astro';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: [
      'dist/',
      '.astro/',
      'node_modules/',
      'design-reference/',
      'data/',
      'dev-cycle-logs/',
      'test-results/',
      'playwright-report/',
      // Harness machinery, copied as-is and owned outside this site.
      'scripts/kb/',
      'scripts/dev-cycle/',
    ],
  },
  ...tsPlugin.configs['flat/recommended'],
  ...astro.configs.recommended,
];
