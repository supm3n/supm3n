# AI GUIDE — How to read this repo

This monorepo hosts multiple apps. Key facts for tooling:

- Shared assets live under `landingpage/shared` and are fetched from `https://supm3n.com/shared/*`.
- Each app under `projects/<name>/` may have a `functions/` directory for Pages Functions.
- Disasters app exposes **GET** `/api/events` with the schema in `docs/projects/disasters/README.md`.

Machine-readable manifest: `docs/projects/manifest.json`.
