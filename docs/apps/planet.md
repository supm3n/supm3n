# Planet Now (`/planet`)

The dotted world map with live day and night, the last 24 hours of earthquakes (M2.5+) and the ISS with its ground track.

## Files
- `src/pages/planet/index.astro`, `src/styles/planet.css`: full-width map (76°N to 40°S) with a panel row below.
- `src/scripts/planet/planet.js`: loads data, fills panels and the live headline, refreshes on a timer.
- `src/scripts/planet/planetMap.js`: same land-mask idea as Trace's `worldMap.js`, but the camera is fixed, so the mask is built once per resize and each dot is shaded by the Sun's elevation.
- `src/scripts/planet/astro.js`: subsolar point and ISS position (satellite.js via `src/scripts/lib/satellite.js`).
- `functions/api/quakes.js`: USGS `2.5_day` feed, trimmed, edge-cached 5 min. `functions/api/tle.js`: CelesTrak groups, cached 4 h (shared with /sky).

## Notes
- Locally, open `/planet?stub` to use `stub.js` (one day of real events, times kept relative to now).
- satellite.js is imported via `src/scripts/lib/satellite.js`; its package entry pulls in a WASM build that breaks the static build.
