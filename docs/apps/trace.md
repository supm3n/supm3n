# IP Trace (`/trace`)

Shows visitors their IP and what every website can see about them: a dotted world map zooms in on their approximate location while a log types out real facts, ending on a card with a copy button.

## Files
- `src/pages/trace/index.astro`, `src/styles/trace.css`: layout. Below 960px everything stacks (map, log, card); above, the map is full-bleed with the log bottom-left and the card on the right.
- `src/scripts/trace/trace.js`: the timeline. Fetches `/api/whoami`, types log lines, fills the card, drives the map. Device details (OS, browser, GPU, screen, time zone) are read in the browser and never sent.
- `src/scripts/trace/worldMap.js`: canvas renderer. Each frame, land is drawn into a tiny mask canvas (one pixel per dot), so the dot grid stays fixed while the Mercator map zooms underneath. The camera moves the visitor's point linearly to the focus while zoom grows exponentially, so the point never leaves the screen.
- `functions/api/whoami.js`: returns the caller's IP and `request.cf` fields (location, ASN/ISP, edge colo, protocol, TLS). Nothing stored. Edge coordinates come from `src/data/cf-colos.json`.
- `public/data/world.json`: Natural Earth 110m countries with ISO alpha-2 codes, built by `scripts/build-world-map.mjs` (run instructions in its header).

## Notes
- `astro dev` doesn't run Functions, so the page shows its failure state locally. Use `npx wrangler pages dev ./dist`; locally there is no `cf-connecting-ip`, so `ip` is null.
- 110m lacks ~70 small states and territories (MT, MC, many islands). For those there is no country highlight; the map zooms to a fixed level around the point.
- Skip button and `prefers-reduced-motion` jump straight to the end state.
- Map data: rings crossing the antimeridian (Russia, Fiji) are unwrapped to continuous longitudes in the build script; raw ±180 jumps draw a fake land band across the map. Regenerate with the script, don't hand-edit `world.json`.
- Land test reads mask alpha, not colour: `getImageData` is not premultiplied, so anti-aliased slivers read full red.
- The clock check compares UTC offsets, not zone names (browsers report legacy IDs like `Asia/Calcutta`; neighbours share offsets).
