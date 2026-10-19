# Supm3n

Half-finished ideas and too much CSS. A personal collection of small web apps at [supm3n.com](https://supm3n.com).

| App | |
|---|---|
| [Settle Up](https://supm3n.com/settleup) | Split expenses between friends; nothing is saved |
| [Stocks Viewer](https://supm3n.com/stock-viewer) | Price history charts (Twelve Data) |
| [Snake](https://supm3n.com/snake) | The classic |
| [IP Trace](https://supm3n.com/trace) | Over-the-top animated IP lookup |
| [Entropy Grid](https://supm3n.com/entropy) | Falling-sand cellular automaton |
| [Financial Analysis](https://supm3n.com/financial-analysis) | Quarterly fundamentals from SEC filings |

Built with [Astro](https://astro.build) and deployed on Cloudflare Pages; API-backed apps use Pages Functions and D1.

## Run locally
```bash
npm install
npm run dev      # http://localhost:4321
npm run build
```
The `/api/*` routes are Pages Functions and don't run under `astro dev`. To test them, add secrets to `.dev.vars` and run `npx wrangler pages dev ./dist`.

## Docs
- [Architecture](docs/architecture.md): how the pieces fit, functions and secrets
- [Decisions](docs/decisions.md): why things are the way they are
- [Financial Analysis](docs/apps/financial-analysis.md): data pipeline and updates
