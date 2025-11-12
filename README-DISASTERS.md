# Disasters — Supm3n (Cloudflare Pages project)

Minimal MVP to show **earthquakes** (USGS) and **wildfire hotspots** (NASA FIRMS) on a map with a viewport-linked list.

## Folder
```
disasters/
  index.html
  app.js
  styles.css
  functions/
    api/
      events.js    # Cloudflare Pages Function → /api/events
```

## Shared assets
This page uses your shared theme from `https://supm3n.com/shared/*`. Update the filenames in `index.html` if they differ.
- Deploy `landingpage` first if you changed shared assets, then deploy `disasters`.

## Local dev
```
npx wrangler pages dev ./disasters
```

## Deploy
Create a new Cloudflare Pages project pointing to the `disasters` subdirectory.
Optionally add `deploy-disasters.cmd` to match your repo pattern.

## Environment variables (Pages → Settings → Environment Variables)
- `FIRMS_MAP_KEY` = **your key** (enables wildfires via FIRMS). Without it, only earthquakes are shown.

## API: /api/events
Query params:
- `hazards` = `eq,wf`
- `bbox` = `west,south,east,north` (floats)
- `since` = e.g. `24h` | `48h`
- `official_only` = `true|false`

Returns:
```json
{ "events": [{id,type,title,when,where,severity,source,links}], "meta": { "updated_at": "...", "stale": false } }
```

## Notes
- Challenge checks included: default sort **Most recent**, **Official-only** toggle, freshness badges, 24–72h window, viewport filtering.
- FIRMS: using **VIIRS_SNPP_NRT** via `/api/area/csv/{MAP_KEY}/{SOURCE}/{bbox}/{day_range}`.
- USGS: using `summary/2.5_day.geojson` and filtering by bbox/time.
