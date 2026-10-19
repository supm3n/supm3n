# Decisions

Newest first. One entry per decision: what, and why. Add new entries at the top.

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
