# Projects Matrix

Last updated: **2025-11-12**

| Project        | Path                         | Domain                    | Functions | Env Vars             | Notes |
|----------------|------------------------------|---------------------------|-----------|----------------------|-------|
| landingpage    | `landingpage/`               | supm3n.com                | No        | —                    | Hosts `/shared/*` for theme/components |
| disasters      | `projects/disasters/`        | disasters.supm3n.com      | Yes       | `FIRMS_MAP_KEY`      | USGS + NASA FIRMS feeds |
| stock-viewer   | `projects/stock-viewer/`     | stocks.supm3n.com         | No*       | `ALPHA_KEY` (if used)| Uses Chart.js; add a small Function if you need to proxy secrets |
| snake          | `projects/snake/`            | snake.supm3n.com          | No        | —                    | Static |
| settleup       | `projects/settleup/`         | settleup.supm3n.com       | No        | —                    | Static |

\* If you want to keep API keys private, add a tiny Pages Function (see `docs/shared/ADD_FUNCTION.md`).

## Standard Head & Init (copy-paste)
Use the same includes across projects (adjust titles/OG/URLs):
- Theme variables: `https://supm3n.com/shared/styles/variables.css?...`
- Theme script: `https://supm3n.com/shared/scripts/theme.js?...`
- Utilities: `https://supm3n.com/shared/scripts/utils.js?...`
- Components CSS: `https://supm3n.com/shared/styles/components.css?...`
- Components loader (after header placeholder): `https://supm3n.com/shared/scripts/components.js?...`

Header placeholder must be: `<header class="site-header"></header>`
Initialize like stocks (wait → `Supm3nComponents.init({...})`, then `Supm3nUtils.initNavigation()`).
