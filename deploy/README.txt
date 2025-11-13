###############################################################
# DEPRECATED - DO NOT USE
###############################################################

These scripts are legacy helpers for the old "Direct Upload" system.

This repository now uses a unified Git-integrated build system.
All deployments are handled automatically by Cloudflare Pages when you push to the `main` branch.

Please see the root `README.md` or `docs/DEPLOYMENT.md` for the correct build and deployment configuration.

# Deploy scripts (Windows .cmd)

These helpers assume the scripts live in `Supm3n/deploy/` and that your repo root
is the parent folder. They use `wrangler pages deploy` with a specified subfolder.

## Important
- If a Pages project is **Git-connected**, you normally **do not** use these scripts.
  Just commit and `git push` to trigger Cloudflare's build from the `Root directory`.
- These scripts are most useful for **Direct Upload** projects or one-off emergency deploys.

## Scripts
- deploy-landingpage.cmd      → deploys `landingpage/` to project `landingpage`
- deploy-settleup.cmd         → deploys `projects/settleup/` to project `settleup`
- deploy-snake.cmd            → deploys `projects/snake/` to project `snake`
- deploy-stock-viewer.cmd     → deploys `projects/stock-viewer/` to project `stock-viewer`
- deploy-disasters.cmd        → deploys `projects/disasters/` to project `disasters`

Each script checks for `index.html` inside the source dir and for `wrangler` being installed.

## Local preview
For local dev, you can also run:
    npx wrangler pages dev <folder>
from the repo root. Example:
    npx wrangler pages dev projects\disasters
