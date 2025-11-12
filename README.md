# supm3n — Projects Monorepo

This repository hosts the main site and multiple hobby projects. All projects share theme/components from **landingpage/shared** and deploy to Cloudflare Pages.

## Structure
```
landingpage/                  # supm3n.com (serves /shared/* assets used by all projects)
projects/
  disasters/                  # disasters.supm3n.com (Cloudflare Pages + Functions)
  stock-viewer/               # stocks.supm3n.com
  snake/                      # snake.supm3n.com
  settleup/                   # settleup.supm3n.com
deploy/                       
  deploy-*.cmd                # legacy helpers (no longer used for landingpage)
docs/                         # developer + ops documentation
```

## Live sites
- **supm3n.com** → landing page, shared assets
- **disasters.supm3n.com** → Disaster Explorer (quakes + wildfires)
- **stocks.supm3n.com** → Stock Chart Viewer
- **snake.supm3n.com** → Snake
- **settleup.supm3n.com** → SettleUp

See `docs/PROJECTS.md` for per-project settings.

---

## Deployment (Git-integrated)

All sites are Cloudflare Pages projects connected to this repo (monorepo). Pushing to the default branch builds & deploys automatically:

| Directory                   | Pages project            | Domain                   |
|----------------------------|--------------------------|--------------------------|
| `landingpage/`             | `supm3n-com`             | `supm3n.com`             |
| `projects/disasters/`      | `disasters-supm3n-com`   | `disasters.supm3n.com`   |
| `projects/stock-viewer/`   | `stocks-supm3n-com`      | `stocks.supm3n.com`      |
| `projects/snake/`          | `snake-supm3n-com`       | `snake.supm3n.com`       |
| `projects/settleup/`       | `settleup-supm3n-com`    | `settleup.supm3n.com`    |

> Each Pages project uses the **root directory** shown above. If a project has a build step, ensure its **build output** contains `_headers`.

### Shared assets (`/shared/*`)
- Served from `https://supm3n.com/shared/*` (in `landingpage/shared`).
- CORS + caching are set via `_headers` in the published output:
  ```
  /shared/*
    Access-Control-Allow-Origin: *
    Access-Control-Allow-Methods: GET, OPTIONS
    Cross-Origin-Resource-Policy: cross-origin
    Cache-Control: public, max-age=31536000, immutable
  ```
- Keep query-versioning on asset URLs (e.g., `?v=20251112`) for cache busting. Update `landingpage` first, then bump `?v=` in sub-sites.

### Local development
- Static dev: open the folder in a static server or run `npx wrangler pages dev ./<folder>`.
- Pages Functions (e.g., `projects/disasters`): `npx wrangler pages dev ./projects/disasters`.

### Troubleshooting
- If a sub-site can’t load shared ESM/CSS: check the `https://supm3n.com/shared/...` response headers for `Access-Control-Allow-Origin` and long-term `Cache-Control`.
- If you see stale assets: bump the `?v=` query in the referring site.

## Notes
- `deploy/deploy-*.cmd` are **legacy** (kept for reference). They are not used by `landingpage` now that it’s Git-integrated.
