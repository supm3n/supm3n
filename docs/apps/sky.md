# Above You (`/sky`)

An all-sky chart for the visitor's location right now: stars, Sun, Moon, planets and satellites, plus a Highlights card and an "Up now" list.

## Files
- `src/pages/sky/index.astro`, `src/styles/sky.css`: layout. All selectors are scoped under `#main-content.sky` (an unscoped `.moon-icon` once broke the header's theme toggle).
- `src/scripts/sky/sky.js`: loads location (`/api/whoami`) and orbits (`/api/tle`), builds highlights, the list and pass predictions.
- `src/scripts/sky/astro.js`: Sun, Moon, planets and star positions via astronomy-engine.
- `src/scripts/sky/sats.js`: SGP4 via `src/scripts/lib/satellite.js`, sunlit test, pass finder.
- `src/scripts/sky/dome.js`: two-canvas renderer. Zenith in the centre, north up, east on the left (looking up).
- `public/data/stars.json`: ~1000 Yale BSC5 stars to mag 4.6, built by `scripts/build-stars.mjs`.

## Notes
- Under `astro dev` the APIs don't run, so `dev-stub.js` (Greenwich + a TLE snapshot) is loaded automatically, only when `import.meta.env.DEV`.
- Location is IP-based by default; "Use precise location" stays in the browser.
- Times are shown in the location's time zone, not the device's.
