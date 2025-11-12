# Disaster Explorer

Recent earthquakes + wildfire hotspots. Map + viewport-linked list.

**Path**: `projects/disasters/`
**Domain**: disasters.supm3n.com
**Functions**: Yes (`/functions/api/events.js`)
**Secrets**: `FIRMS_MAP_KEY`

## Data sources
- **USGS Earthquakes**: summary `2.5_day` GeoJSON (no key). Filtered by bbox & time window.
- **NASA FIRMS**: `area/csv` endpoint with MAP KEY; source `VIIRS_SNPP_NRT` (1–2 days).

## API: `/api/events`
**Query params**
- `hazards`: comma list (e.g., `eq,wf`) — `eq`=earthquake, `wf`=wildfire
- `bbox`: west,south,east,north (e.g., `-180,-90,180,90`)
- `since`: freshness window, e.g., `24h` or `48h`
- `official_only`: `true` to filter to official/scientific sources

**Response**
```jsonc
{
  "events": [
    {
      "id": "eq-...",
      "type": "earthquake" | "wildfire",
      "title": "string",
      "status": "ongoing",
      "when": { "detected": "ISO", "updated": "ISO" },
      "where": { "point": [lon, lat], "place": "string|null" },
      "severity": { "raw": { ... }, "normalized": 0-100 },
      "source": [ { "name": "USGS", "kind": "official|scientific", "url": "..." } ],
      "links": { "official": ["..."] }
    }
  ],
  "meta": { "updated_at": "ISO", "stale": false }
}
```

**Severity**
- Earthquakes: based on magnitude (`Mw`) → normalized 0–100
- Wildfires: based on FRP (log-scaled) + confidence

## UI behavior
- Map uses Leaflet + MarkerCluster.
- Viewport-linked: moving/zooming refetches `/api/events` with current `bbox`.
- Sort: Most recent (default) or Most severe.
- Toggle: Official sources only (keeps USGS/FIRMS).
- Status line shows “Loaded N events” and “Feed stale” if detected.

## CSP & assets
- CSP is strict. Keep Leaflet CSS local in `/assets/vendor/`. JS via jsDelivr is allowed.
- Shared includes from `https://supm3n.com/shared/*` must be present (see `docs/PROJECTS.md`).

## Secrets
- `FIRMS_MAP_KEY` (set in Pages → Settings → Variables and Secrets → Production).

## Testing URLs
- `/api/events?hazards=eq&bbox=-180,-90,180,90&since=24h`
- `/api/events?hazards=wf&bbox=-180,-90,180,90&since=48h`
