# Supm3n

Personal hobby site: Astro 5 (static) + Cloudflare Pages Functions. Each mini-app lives in `src/pages/<app>/`. Pushing to `main` deploys supm3n.com.

## Commands
- `npm run dev` → http://localhost:4321. `functions/` (the `/api/*` routes) does not run here; test API-backed apps on the live site or with `npx wrangler pages dev ./dist` (secrets in `.dev.vars`).
- `npm run build` must pass before committing.

## Where things are
- `src/pages/<app>/index.astro` app pages; shared shell `src/layouts/MainLayout.astro`, `src/components/Header.astro`, `Footer.astro`
- `src/data/projects.js` cards on `/` and `/projects`
- `src/styles/theme.css` color tokens; loads after `global.css`, so its `:root` wins. Change colors here, not per page.
- `functions/api/` Pages Functions (price proxy, financials read, cron update)
- `docs/architecture.md` how it fits together · `docs/decisions.md` why · `docs/apps/` per-app notes

## Rules
- Privacy: the site is pseudonymous. Never add links, names or text tying it to the owner's other projects or real identity, including in docs and commit messages.
- Commits: local git identity is already `supm3n` + GitHub noreply email; don't change it. Push via the `origin` SSH remote (`github-supm3n` alias); don't switch it to HTTPS.
- API keys stay in Pages Functions env vars, never in client code.
- If a page starts sending visitor data to a new third party, update `src/pages/privacy.astro`.
- Animations stay calm: no looping/shaking effects; respect `prefers-reduced-motion`.
- Notable decision → one short entry at the top of `docs/decisions.md`.

## Don't read
`docs/reference/` (multi-MB dumps), `*.sql`, `*.csv`, `dist/`, `.wrangler/`, `package-lock.json`.

## Gotchas
- After editing scoped CSS, the dev browser can keep stale styles from HMR. Reload the page, or restart dev if that doesn't help.
- Financial data only updates when triggered manually (Ctrl+Shift+U admin panel). See `docs/apps/financial-analysis.md`.
