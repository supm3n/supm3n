# Shared Theme & Components

- `landingpage/shared/styles/variables.css` → theme variables + color scheme
- `landingpage/shared/styles/components.css` → base components
- `landingpage/shared/scripts/theme.js` → dark/light toggle
- `landingpage/shared/scripts/utils.js` → helpers (e.g., navigation highlight)
- `landingpage/shared/scripts/components.js` → mounts header/footer via `<header class="site-header"></header>`

## Required Markup & Scripts
- In `<head>`: link variables.css, components.css, theme.js, utils.js
- In `<body>`: `<header class="site-header"></header>`
- After header: `<script src="https://supm3n.com/shared/scripts/components.js?..."></script>`
- Bottom: the `Supm3nComponents.init(...)` block (same as stock-viewer)
