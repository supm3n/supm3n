// astro.config.mjs
import { defineConfig } from 'astro/config';

export default defineConfig({
  build: {
    // Removed "format: 'file'" to prevent redirect conflicts
  }
});