// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import externalizeInline from './scripts/externalize-inline.mjs';

export default defineConfig({
  output: 'static',
  site: 'https://go-profile.goran-ocokoljic.workers.dev',
  // externalizeInline last: it rewrites the finished HTML.
  integrations: [react(), externalizeInline()],
  build: {
    // The site must work under CSP `default-src 'self'`, which blocks inline <style>.
    inlineStylesheets: 'never',
  },
});
