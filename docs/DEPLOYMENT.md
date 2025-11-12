# Deployment

## How deployments happen
All sites are **Git-integrated** Cloudflare Pages projects. A push to the default branch builds and deploys the corresponding folder.

## Order of operations with shared assets
- Keep `?v=YYYYMMDD` on shared CSS/JS imports.
- When changing a shared file:
  1) Deploy `landingpage` (supm3n.com).
  2) Update sub-sites to reference the new `?v=`.

This prevents sub-sites from pointing at files that aren’t live yet.

## Headers & caching
- `_headers` must be present in the **published output** for a project.
- For `/shared/*` we use:
  ```
  /shared/*
    Access-Control-Allow-Origin: *
    Access-Control-Allow-Methods: GET, OPTIONS
    Cross-Origin-Resource-Policy: cross-origin
    Cache-Control: public, max-age=31536000, immutable
  ```

## Secrets
- **Not required** for Git-integrated Pages builds.
- Keep DNS/Zone credentials only if you have workflows that edit DNS (not typical for Pages).
