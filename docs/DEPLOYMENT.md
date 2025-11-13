# Deployment & Build Strategy

## Monorepo Build (Git-integrated)

All sites are **Git-integrated** Cloudflare Pages projects. A push to the default branch builds and deploys all sites using a central build script.

### Cloudflare Pages Settings

All projects **must** use the following configuration in the Cloudflare Dashboard:

-   **Root directory (advanced):** `/`
-   **Build command:** `npm install && node build.js`
-   **Build output directory:** `dist/<project_name>`
    -   Example for `disasters`: `dist/disasters`
    -   Example for `landingpage`: `dist/landingpage`

### How It Works

1.  **Root directory (`/`)**: This tells Cloudflare to run the build from the repo root, where `package.json` and `build.js` live.
2.  **Build command (`npm install && node build.js`)**: This installs dependencies and then runs our master build script.
3.  **`build.js`**: This script:
    -   Reads the shared `header.html` and `footer.html`.
    -   Loops through all defined projects.
    -   Copies all assets (CSS, JS, images, functions) for each project into a `dist/<project_name>` folder.
    -   Injects the header and footer HTML into each project's `.html` files, replacing the `{{HEADER_PLACEHOLDER}}` and `{{FOOTER_PLACEHOLDER}}` tags.
4.  **Build output directory (`dist/<project_name>`)**: This tells Cloudflare to deploy *only* the specific subfolder from the `dist` directory that corresponds to this project.

### Local Development

Use `wrangler pages dev` pointing at the *source* directory (not `dist`):
`npx wrangler pages dev ./projects/disasters`
(Or use the `npm run dev:*` scripts in the root `package.json`)

### `wrangler.toml`

If a project has a `wrangler.toml` file, its `pages_build_output_dir` setting will override the UI. Ensure it is also set correctly:
`pages_build_output_dir = "dist/<project_name>"`