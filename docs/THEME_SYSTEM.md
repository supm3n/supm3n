# Theme & Shared Assets

## Structure
- Shared CSS/ESM live in `landingpage/shared`.
- They are served from `https://supm3n.com/shared/*`.

## CORS & caching
The `_headers` file in the landingpage **publish output** enables cross-site imports and long-term caching.

```
/shared/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, OPTIONS
  Cross-Origin-Resource-Policy: cross-origin
  Cache-Control: public, max-age=31536000, immutable
```

## Cache busting
- Use a version query (e.g., `?v=20251112`) on `<link>`/`<script type="module">` tags in sub-sites.
- When assets change: deploy `landingpage` first, then bump `?v=` in sub-sites.

## Optional future improvement
- Switch to **hashed filenames** (e.g., `theme.abc123.css`) + a small manifest to eliminate `?v=` and fully decouple deploy order.
