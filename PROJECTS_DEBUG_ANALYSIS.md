# Projects Display – Debug Summary & Guardrails (Nov 2025)

This document records the historical failure where projects stopped rendering and outlines the guardrails now in place to prevent a regression. Use it as a quick checklist before/after altering the projects catalogue or deployment pipeline.

---

## Current Behaviour

1. **Primary source** – `landingpage/functions/api/projects.js` queries Cloudflare DNS for subdomains.  
2. **Fallback** – if the API returns anything other than `200`, the client falls back to `landingpage/projects.json`.  
3. **Resilience** – `landingpage/assets/projects.js` normalises whatever shape comes back (`[...]`, `{ projects: [...] }`, `null`) and logs helpful diagnostics in the console.  
4. **Homepage widget** – `landingpage/index.html` contains a lightweight fetch helper that mirrors the same fallback logic for the featured-project panel.  
5. **Project cards** – both homepage and `/projects` view expect `projects.json` to be an array of objects; ordering matters for the homepage feature list.

---

## Regression Checklist

Run this after touching anything related to project discovery or when a deploy lands:

1. **Inspect `/projects.json`** – keep the file as a top-level array (`[ { ... } ]`). Add new projects to both `projects.json` and the homepage’s featured list when relevant.  
2. **Validate project shape** – each object needs at minimum `{ name, description, url, tag, favicon }`. Missing keys will surface as console warnings.  
3. **Check the logs** – open DevTools, reload `/projects`; you should see messages like `✅ Projects array normalised (count: 3)`. Red/yellow logs warrant investigation.  
4. **API smoke test** – hit `https://supm3n.com/api/projects`. If it returns `404`, DNS discovery failed; the client will still work via `projects.json`, but consider redeploying to restore the function.  
5. **Deployment order** – redeploy `landingpage/` whenever `projects.json`, shared components, or the loader change. Redeploy individual projects afterwards so the DNS discovery sees the new subdomains.

---

## Known Pitfalls & Fixes

| Symptom | Likely Cause | Fix |
| --- | --- | --- |
| `TypeError: this.projects.map is not a function` | `projects.json` shipped as an object (`{ projects: [...] }`) or stale bundle | Redeploy landing page; ensure JSON root is an array |
| Homepage still shows old project list after deploy | Browser/CDN cache of `projects.json` | Hard refresh; purge in Cloudflare Pages dashboard if needed |
| `/api/projects` intermittently 404s | DNS enumeration hitting permission limits | Confirm `CF_API_TOKEN` secret and `ZONE_ID` in dashboard |
| New project missing from `/projects` filters | `tag` missing or mis-typed | Update the entry and redeploy landing page |

---

## Files to Keep in Sync

- `landingpage/projects.json` – canonical list; used for both fallback and feature ordering.  
- `landingpage/assets/projects.js` – array normalisation + filtering logic; redeploy if logs or behaviour change.  
- `landingpage/index.html` – homepage fetch helper; keep featured-project IDs aligned with `projects.json`.  
- `PROJECT_SUMMARY.md` – project tree and notes for other contributors (update when adding/removing projects).  
- `snake/index.html` – inline nav links; update the `links` array if you rename any routes.

---

## Deployment Tips

1. Delete local `node_modules/` folders (or add `.wranglerignore`) before running `deploy-*.cmd`; Wrangler uploads everything in scope.  
2. If you modify `landingpage/assets/projects.js`, redeploy `landingpage/` first, then the individual project you added (e.g. `deploy-snake.cmd`).  
3. Cloudflare caches `projects.json` aggressively. Append `?v=<timestamp>` when manually verifying or purge via dashboard if the old version persists.  
4. When adding a project:  
   - Deploy the new project (`deploy-snake.cmd`, `deploy-python-playground.cmd`, etc.).  
   - Update and redeploy `landingpage/`.  
   - Verify `/projects` and homepage featured list.

---

## Console Debug Messages (What “Good” Looks Like)

- `✅ Projects array normalised (count: N)` – JSON parsed successfully.  
- `ℹ️ Filtering projects` / `ℹ️ Rendering projects` – normal UI flow.  
- `⚠️ Projects fallback engaged (using /projects.json)` – API failed but fallback kicked in.  
- `🚨 CRITICAL: Projects is STILL not an array` – deploy is out-of-sync or JSON malformed; fix immediately.

---

## Action Items When Things Break

1. **Malformed data** → Fix `projects.json`, redeploy landing page, hard refresh.  
2. **Missing project** → Ensure domain deployed successfully; rerun DNS discovery by redeploying landing page.  
3. **API failure** → Check Cloudflare Pages Functions logs; validate secrets (`ZONE_ID`, `CF_API_TOKEN`).  
4. **UI still stale** → Purge Cloudflare cache for `/projects.json` or bump a query string.

---

Keeping these guardrails in place ensures future models (and humans!) have a clear path to diagnose project display issues without repeating the original outage.***
