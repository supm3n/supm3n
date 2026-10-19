# Planet Now (`/planet`)

The dotted world map with live day and night, the last 24 hours of earthquakes (M2.5+) and the ISS with its ground track.

## Files
- `src/pages/planet/index.astro`, `src/styles/planet.css`: on desktop the map fills the left side with the panels in a sidebar; on phones everything stacks. Nothing is drawn over the map. It spans 80°N to 56°S, so the ISS (up to 51.6°) is always on it.
- `src/scripts/planet/planet.js`: loads data, fills panels and the live headline, refreshes on a timer.
- `src/scripts/planet/planetMap.js`: same land-mask idea as Trace's `worldMap.js`, but the camera is fixed, so the mask is built once per resize and each dot is shaded by the Sun's elevation.
- `src/scripts/planet/astro.js`: subsolar point and ISS position (satellite.js via `src/scripts/lib/satellite.js`).
- `functions/api/quakes.js`: USGS `2.5_day` feed, trimmed, edge-cached 5 min. `functions/api/tle.js`: CelesTrak groups, cached 4 h (shared with /sky).

## Notes
- Locally, open `/planet?stub` to use `stub.js` (one day of real events, times kept relative to now).
- satellite.js is imported via `src/scripts/lib/satellite.js`; its package entry pulls in a WASM build that breaks the static build.
