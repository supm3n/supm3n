# supm3n — Projects Monorepo

This repository hosts the main site and multiple hobby projects. All projects are built from this single monorepo and deployed to Cloudflare Pages.

## Structure

-   **`build.js`**: The master build script that builds all projects.
-   **`landingpage/`**: Source code for `supm3n.com`.
    -   **`landingpage/shared/`**: Contains shared assets (CSS, JS) and HTML components (`header.html`, `footer.html`) used by all projects.
-   **`projects/`**: Source code for all sub-projects (e.g., `disasters`, `snake`).
-   **`dist/`**: The (git-ignored) output folder. The build script places all final, deployable sites here.
-   **`docs/`**: All documentation.
-   **`deploy/`**: DEPRECATED legacy deployment scripts.

---

## Deployment (Git-integrated)

This monorepo uses a unified build script (`build.js`) to generate all sites. Pushing to the default branch triggers Cloudflare to build and deploy each project.

**All** Cloudflare Pages projects should be configured with the following settings:

-   **Root directory:** `/` (the root of the repo)
-   **Build command:** `npm install && node build.js`
-   **Build output directory:** `dist/<project_name>` (e.g., `dist/landingpage` or `dist/disasters`)

This system ensures that shared components (like the header) are injected into every page at build time.

### Live Sites

| Pages Project | Build Output Directory | Domain |
| :--- | :--- | :--- |
| `landingpage` | `dist/landingpage` | `supm3n.com` |
| `disasters` | `dist/disasters` | `disasters.supm3n.com` |
| `stocks-viewer` | `dist/stock-viewer` | `stocks.supm3n.com` |
| `snake` | `dist/snake` | `snake.supm3n.com` |
| `settleup` | `dist/settleup` | `settleup.supm3n.com` |

### Shared Assets (`/shared/*`)

Shared assets are handled by the build script and are copied from `landingpage/shared` into the `dist/landingpage/shared` folder. The `landingpage/_headers` file ensures they are served with the correct CORS and cache policies.

### Local Development

Use the `dev:*` scripts in `package.json` to run a single project locally. These scripts use `wrangler pages dev` and point to the *source* directories (not `dist`).
Example:
`npm run dev:disasters`

### Notes

-   `deploy/deploy-*.cmd` scripts are **legacy** and no longer used. Do not use them.
-   To add a new project, you must add it to the `projects` array in `build.js` and set up its Cloudflare project with the build settings above.