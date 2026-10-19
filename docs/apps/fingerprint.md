# Fingerprint (`/fingerprint`)

Reads 16 details a browser gives away without cookies (canvas, WebGL, audio, fonts, screen, time zone…), hashes them into one ID and draws it as a sigil. Everything runs in the browser; nothing is sent.

## Files
- `src/pages/fingerprint/index.astro`, `src/styles/fingerprint.css`: layout. Sigil and ID on the left (sticky on desktop), signal list and "How to blend in" tips on the right (stacked on mobile). The box under the sigil shows the hovered or tapped detail, so it can be read without scrolling to the list.
- `src/scripts/fingerprint/signals.js`: the signal collectors and `sha256`.
- `src/scripts/fingerprint/sigil.js`: deterministic SVG. Each signal owns one ring; the combined hash sets the symmetry and accent.
- `src/scripts/fingerprint/fingerprint.js`: runs collection, fills the list, links list rows to rings, SVG/PNG download, copy.

## Notes
- Signals that are noisy (randomised by Brave/Firefox) or left out of the ID are drawn dashed, and the status says how many were used.
- "Very identifying / somewhat / barely" are rough per-signal estimates from public fingerprinting studies, not measured on visitors.
