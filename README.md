# Supm3n

Personal portfolio and mini‑projects deployed to Cloudflare Pages.

## Sites

- Main: https://supm3n.com/
- Stocks: https://stocks.supm3n.com/
- SettleUp: https://settleup.supm3n.com/
- Snake: https://snake.supm3n.com/

## Docs

- **Start here**: `docs/PROJECT_OVERVIEW.md` - Comprehensive overview for new agents
- Project details: `docs/PROJECT_SUMMARY.md` - Detailed technical documentation
- Theme system: `docs/THEME_SYSTEM.md` - Theme implementation guide
- Deployment: `docs/DEPLOYMENT_ANALYSIS.md` - Deployment process
- Improvements: `docs/IMPROVEMENTS.md` - Future enhancements

## Local Development

```bash
# Dev (run from project root)
npx wrangler pages dev ./landingpage
npx wrangler pages dev ./stock-viewer
npx wrangler pages dev ./settleup
npx wrangler pages dev ./snake

# Deploy (use deploy scripts in root)
deploy-landingpage.cmd
deploy-stock-viewer.cmd
deploy-settleup.cmd
deploy-snake.cmd
```

## Quick Notes

- **Shared components** live in `landingpage/shared` and are served at `https://supm3n.com/shared/*`
- **Theme system** is unified across all sites (ES modules, cross-subdomain sync). See `docs/THEME_SYSTEM.md`
- **Deployment**: Each project deploys separately via Cloudflare Pages. Always deploy `landingpage` first when updating shared components.
- **Cache-busting**: Bump version query strings (e.g. `?v=20251109`) when updating CSS/JS
- **Stock Viewer API**: Requires `ALPHA_KEY` environment variable in Cloudflare Pages Dashboard (not in code)
- **Python Playground**: Has been removed from the repository

## Cloudflare Pages Projects

All projects are deployed as separate Cloudflare Pages:
- `landingpage` → `supm3n.com` (also serves `/shared/*` assets)
- `stock-viewer` → `stocks.supm3n.com`
- `settleup` → `settleup.supm3n.com`
- `snake` → `snake.supm3n.com`

See `docs/PROJECT_OVERVIEW.md` for architecture details.


