# Architecture Overview

- **Hosting**: Cloudflare Pages (one project per subdomain).
- **Shared assets**: `landingpage/shared` served from `https://supm3n.com/shared/*`.
- **Monorepo**: Each app lives under `projects/<name>/` with its own Pages project.
- **Styling**: CSS variables + components from shared bundle; dark/light theme via `theme.js`.
- **CSP**: Tight defaults. Keep vendor CSS local (e.g., Leaflet CSS) and allow jsDelivr for JS if needed.

## File-based Functions
Pages Functions live under `functions/` in a project’s root:
```
projects/<name>/functions/api/*.js   →  /api/*
```
Each file exports `onRequestGet`, `onRequestPost`, etc.
