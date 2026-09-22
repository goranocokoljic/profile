// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://go-profile.goran-ocokoljic.workers.dev',
  build: {
    // The site must work under CSP `default-src 'self'`, which blocks inline <style>.
    inlineStylesheets: 'never',
  },
});
