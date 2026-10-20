# Decisions

Newest first. One entry per decision: what, and why. Add new entries at the top.

## 2026-10-20 · Astro 7, with v5 whitespace kept
Upgraded Astro 5 → 6 → 7 (Vite 8). Astro 7 needs Node ≥ 22.22, newer than Cloudflare's default build image, so `.nvmrc` pins it. `compressHTML: true` keeps the old whitespace handling: the new `'jsx'` default glued inline elements together (card tags read `[LIVE]`, Settle Up's buttons touched). Output was checked against the v5 build: same page text, same CSS once minifier differences are normalized, same sitemap.

## 2026-10-20 · `overflow-x: clip` on html and body
`hidden` on body made it a scroll container, which silently broke every `position: sticky` (the Fingerprint sigil). `clip` stops sideways scrolling without that; `hidden` stays as the fallback line for old browsers.

## 2026-10-20 · Live apps share a header and a "More like this" row
Trace, Fingerprint, Above You and Planet Now use `AppHeader.astro` (label, headline, one line of context) and end with `RelatedApps.astro`. Each page swaps the headline for its one live fact once data arrives, so the first thing read is the answer, not the app name.

## 2026-10-20 · Live data apps fetch through our own Functions
Planet Now and Above You need CelesTrak orbits and USGS earthquakes. Both are fetched by Pages Functions and edge-cached (4h / 5min), so visitors' browsers never contact them and we stay within CelesTrak's fetch limits. Astronomy is computed client-side with astronomy-engine and satellite.js (bundled, no CDN).

## 2026-10-19 · Trace uses real request data, not a lookup service
IP Trace was a fake "hacking" sequence around an ipapi.co lookup. It now reads `request.cf` in its own Pages Function (`/api/whoami`), so no third party sees visitors, there is no rate limit, and every log line is true. The ending says so: nobody hacked you, this is what every site can see.

## 2026-10-19 · Touch gets plain content
Hover-only effects must not hide content on touch: the Uses text scramble only runs with `(hover: hover) and (pointer: fine)`. On phones (<600px) the financial charts show the last 16 quarters, and the stock chart uses 4 short date ticks.

## 2026-10-19 · Calm card hover
Replaced the scanner beam, shaking icon and pulsing dot with a cursor-following border glow and a soft spotlight. The effects looked gimmicky; no looping animations, and `prefers-reduced-motion` is respected.

## 2026-10-19 · Red accent, blue chart data
The accent moved from purple to the logo's cape red, with the glitch effect in red/cyan to match the logo. Financial chart series use the logo's blue, because red revenue bars next to green would read as losses.

## 2026-10-19 · Header uses a cropped logo mark
`src/assets/logo-mark.png` (256px, cropped to the ringed figure) replaces the 1024px full logo. The original was mostly padding and glow, so the figure was unreadable at 40px.

## 2026-10-19 · Privacy page lists every third party that sees visitor IPs
IP Trace calls ipapi.co from the browser, and the chart pages load Chart.js from jsDelivr. The privacy page names them and states that nothing is stored server-side. Any new client-side third party must be added there.

## 2026-10-19 · Pseudonymous site
The site and repo stay under the `supm3n` handle only. No links or text tie them to other personal projects. Commits use the GitHub noreply email, and pushes go over an SSH deploy key scoped to this repo, so no other GitHub account is involved.

## 2025-11 · Financial data: seeded D1 plus manual updates
History is seeded into D1 from an SEC-derived CSV. New filings are pulled on demand via the hidden admin panel, not on a schedule, to stay within sec-api.io's ~100-call limit.

## 2025-11 · Astro + Cloudflare Pages
Moved from vanilla JS to Astro static output. API keys stay server-side in Pages Functions; the edge Cache API keeps third-party calls within rate limits.
