# Deploy & Build

## Git-connected (recommended)
- **Root directory (advanced)** = `projects/<name>`
- **Build command** = (empty) or `exit 0`
- **Build output directory** = (empty)
- Add secrets in **Settings → Variables and Secrets** (Production, and Preview if desired)
- Attach custom domain `<name>.supm3n.com`

## Direct Upload (optional)
Use `wrangler pages deploy <folder> --project-name <project>` from repo root (see `/deploy/*.cmd`).

## Local Dev
```
npx wrangler pages dev projects\disasters
```
Then open the local URL printed by Wrangler.
