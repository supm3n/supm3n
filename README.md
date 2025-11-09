# Supm3n

Personal portfolio and mini‑projects deployed to Cloudflare Pages.

## Sites

- Main: https://supm3n.com/
- Stocks: https://stocks.supm3n.com/
- Python Playground: https://python.supm3n.com/
- Snake: https://snake.supm3n.com/

## Docs

- Project overview: `PROJECT_SUMMARY.md`
- Theme system guide: `THEME_SYSTEM.md` (for AI models)
- Deployment notes: `DEPLOYMENT_ANALYSIS.md`
- Improvements backlog: `IMPROVEMENTS.md`

## Local commands

```bash
# Dev
npx wrangler pages dev ./landingpage
npx wrangler pages dev ./stock-viewer
npx wrangler pages dev ./python-playground
npx wrangler pages dev ./snake

# Deploy
npm run deploy:landingpage
npm run deploy:stock-viewer
npm run deploy:python
npm run deploy:snake
```

## Notes

- Shared components live in `landingpage/shared` and are served at `/shared/*` on the main site.
- Before deploying, ensure `node_modules/` are ignored and bump cache‑bust versions (e.g. `?v=20251109`) if shared assets changed.
- **Theme System**: All projects must implement `[data-theme="light"]` CSS selector for theme switching. See `THEME_SYSTEM.md` for details.
- **Deploy Scripts**: Use `npx wrangler pages deploy` (scripts already updated).
- **Stock Viewer API**: Requires `ALPHA_KEY` environment variable in Cloudflare Pages (not in code).


