# supm3n — Projects Monorepo

This repository hosts the main site and multiple hobby projects. Everything uses the shared theme/components from **landingpage/shared** and deploys to Cloudflare Pages.

## Structure
```
landingpage/                  # supm3n.com (serves /shared/* assets used by all projects)
projects/
  disasters/                  # disasters.supm3n.com (Cloudflare Pages + Functions)
  stock-viewer/               # stocks.supm3n.com
  snake/                      # snake.supm3n.com
  settleup/                   # settleup.supm3n.com
deploy/                       
  deploy-*.cmd                # optional direct-upload helpers (prefer Git-connected builds)
docs/                         # developer + ops documentation (this folder)
```

## Live sites
- **supm3n.com** → landing page, shared assets
- **disasters.supm3n.com** → Disaster Explorer (quakes + wildfires)
- **stocks.supm3n.com** → Stock Chart Viewer
- **snake.supm3n.com** → Snake
- **settleup.supm3n.com** → SettleUp

See `docs/PROJECTS.md` for details per project and deployment settings.
