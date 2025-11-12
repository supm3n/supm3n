# Projects & Deploy Settings

Each directory maps to a Cloudflare Pages project (Git-integrated). Pushing to the default branch triggers build & deploy.

## landingpage/  → supm3n.com
- **Root directory:** `landingpage/`
- **Build:** none (static) unless you add one later
- **Publish includes:** `_headers`, `shared/*`, index and static files
- **Serves shared assets:** `https://supm3n.com/shared/*` (consumed by other sites)

## projects/disasters/  → disasters.supm3n.com
- **Root directory:** `projects/disasters/`
- **Build:** depends on app; for Pages Functions, ensure `/functions` is present
- **Notes:** If function responses need custom headers, set them in code (static `_headers` only applies to static assets)

## projects/stock-viewer/  → stocks.supm3n.com
- **Root directory:** `projects/stock-viewer/`
- **Build:** none or project-specific

## projects/snake/  → snake.supm3n.com
- **Root directory:** `projects/snake/`
- **Build:** none or project-specific

## projects/settleup/  → settleup.supm3n.com
- **Root directory:** `projects/settleup/`
- **Build:** none or project-specific
