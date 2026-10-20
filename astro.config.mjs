// astro.config.mjs
import { defineConfig } from 'astro/config';
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: 'https://supm3n.com',
  build: {
    // Removed "format: 'file'" to prevent redirect conflicts
  },
  // Astro 7 defaults to 'jsx' whitespace rules, which drop spaces between inline elements.
  compressHTML: true,

  integrations: [sitemap()]
});