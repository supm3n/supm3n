// astro.config.mjs
import { defineConfig } from 'astro/config';

export default defineConfig({
  build: {
    // This creates 'projects.html' instead of 'projects/index.html'
    // It fixes 404 issues on some Cloudflare configurations
    format: 'file'
  }
});