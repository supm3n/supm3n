# Architecture

## Overview
Static Astro 7 site on Cloudflare Pages. Cloudflare builds on every push to `main` (`npm run build` → `dist/`), on the Node version pinned in `.nvmrc`. The few server needs (API keys, database) are handled by Cloudflare Pages Functions in `functions/`.

```
Browser ── static pages (dist/) ── Cloudflare Pages
   └── /api/* ── functions/api/* ── Twelve Data · D1 (supm3n-db) · sec-api.io
```

## Shell
- `src/layouts/MainLayout.astro`: `<head>`, theme bootstrap, the animated particle background `<canvas>`, the header and footer, and the hidden admin panel (`DashboardControls.astro`).
- `src/scripts/theme.js`: dark is the default. Light/dark is saved in localStorage plus a `theme` cookie and applied as `data-theme` on `<html>`.
- Colors: tokens in `src/styles/theme.css` (`--color-accent-start/end`, `--glass-*`, `--glitch-*`, particle colors). The accent is the logo's red. Chart series use blue (`#0ea5e9`) so data never reads as "loss red".
- `src/components/ProjectCard.astro`: one shared card. A document-level `mousemove` sets `--mouse-x/y` on each card for the border glow and spotlight.

## Apps
| Route | What | Data / external |
|---|---|---|
| `/stock-viewer` | Price history chart | `/api/price/[symbol]` → Twelve Data (cached 15 min), Chart.js bundled from npm |
| `/financial-analysis` | Quarterly fundamentals, big-9 tech | `/api/financials/[ticker]` → D1. See `apps/financial-analysis.md` |
| `/settleup` | Expense splitter | none; in-page only |
| `/snake` | Snake | high score in localStorage |
| `/trace` | Your IP and connection info on a zooming dotted map | `/api/whoami` (request.cf), `public/data/world.json`. See `apps/trace.md` |
| `/planet` | Day/night, 24h earthquakes, ISS on the dotted map | `/api/quakes` (USGS), `/api/tle` (CelesTrak), `/api/whoami`. See `apps/planet.md` |
| `/sky` | Live all-sky view for the visitor's location | `/api/whoami`, `/api/tle`, `public/data/stars.json`, astronomy-engine + satellite.js. See `apps/sky.md` |
| `/fingerprint` | Browser fingerprint signals turned into a sigil | none; browser only, sends nothing. See `apps/fingerprint.md` |
| `/entropy` | Falling-sand automaton | Web Worker (`src/components/entropy/worker.ts`) |
| `/black-peg-mastermind` | Black-peg Mastermind solver and strategy simulator | none; Web Worker (`src/scripts/blackpeg/worker.js`), sends nothing. See `apps/black-peg-mastermind.md` |

Adding an app: create `src/pages/<app>/index.astro` using `MainLayout`, then add an entry to `src/data/projects.js`.

## Functions & secrets
| Function | Purpose | Env |
|---|---|---|
| `functions/api/price/[symbol].js` | Proxies Twelve Data; maps crypto tickers (BTC → BTC/USD) | `TWELVE_DATA_KEY` |
| `functions/api/financials/[ticker].js` | Reads `company_quarterly` from D1 | `DB` binding |
| `functions/api/cron/update.js` | Pulls new SEC filings into D1; requires `?key=` | `SEC_API_KEY`, `CRON_SECRET`, `DB` |
| `functions/api/tle.js` | Satellite TLEs from CelesTrak (`?group=stations\|visual\|starlink`), edge-cached 4h | none |
| `functions/api/quakes.js` | USGS earthquakes of the last day, trimmed, edge-cached | none |
| `functions/api/whoami.js` | Returns the caller's own IP and `request.cf` info; nothing stored | none |

Secrets live in the Cloudflare dashboard. For local function testing, put them in `.dev.vars` (gitignored) and run `npx wrangler pages dev ./dist`. The D1 binding is in `wrangler.toml`.

## Repo hygiene
- `docs/reference/` holds raw data dumps used by `scripts/verify_financials.js`. They are large; don't open them casually.
- Root and `src/*.sql`, `patches/`, and the CSV are Financial Analysis data and ETL artifacts (see its doc).
