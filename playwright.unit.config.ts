import { defineConfig } from '@playwright/test';

// Browserless unit tests (e.g. the content schema), run by `npm run check`.
export default defineConfig({
  testDir: 'src',
  testMatch: '**/*.test.ts',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
});
