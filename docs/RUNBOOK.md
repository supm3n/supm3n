# Ops Runbook

## Common tasks

### Roll out a shared CSS/JS change
1) Commit to `landingpage/shared`.
2) Push → Cloudflare builds & deploys supm3n.com.
3) Update sub-sites to use the new `?v=` and push.

### Debug: sub-site can’t load shared ESM/CSS
- Open the failing request in DevTools → Network.
- Ensure the response from `supm3n.com/shared/...` includes:
  - `Access-Control-Allow-Origin: *`
  - `Cache-Control: public, max-age=31536000, immutable`
- If missing, confirm `_headers` exists in the landingpage **published output**.

### Revert a bad deploy
- Revert/checkout a previous commit in Git and push.
- Cloudflare will rebuild and roll back.

### Add a new project
- Create a new folder (e.g., `projects/newapp/`).
- In Cloudflare Pages, create a new Git-integrated project with **root directory** set to that folder.
- Attach `subdomain.supm3n.com`.

## Notes
- `_headers` only applies to **static** responses. For Pages Functions, set headers in code.
