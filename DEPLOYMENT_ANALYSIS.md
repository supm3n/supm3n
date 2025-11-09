# Deployment Scripts Analysis

## ✅ What Gets Deployed

Each deployment script:
1. Changes to the project folder (`cd` into `landingpage/`, `stock-viewer/`, etc.)
2. Runs `wrangler pages deploy .` which deploys **only** the current directory
3. **Root directory files are NOT deployed** - they stay local

## 📁 Files in Root Directory (NOT Deployed)

These files are **NOT** uploaded because each script changes to the project folder first:

- ✅ `deploy-*.cmd` - Deployment scripts (local only)
- ✅ `IMPROVEMENTS.md` - Documentation (local only)
- ✅ `PROJECT_SUMMARY.md` - Documentation (local only)
- ✅ `PROJECTS_DEBUG_ANALYSIS.md` - Documentation (local only)
- ✅ `package.json` (root) - Root package.json (local only)
- ✅ `node_modules/` (root) - Root dependencies (local only)
- ✅ `PROJECT_TEMPLATE/` - Template folder (local only)

**These are safe** - they never get deployed.

## 📦 What Each Project Deploys

### Landing Page (`landingpage/`)
**Deploys:**
- ✅ All HTML files (`index.html`, `projects.html`, etc.)
- ✅ `assets/` folder (styles, scripts, icons, logo)
- ✅ `functions/` folder (API endpoints)
- ✅ `shared/` folder (components, styles, scripts)
- ✅ `projects.json` (project list)
- ✅ `wrangler.toml` (configuration)
- ✅ `site.webmanifest`
- ✅ `_redirects`, `404.html`

**Remember to remove/ignore before deploy:**
- ❌ `node_modules/` (delete locally or add to `.wranglerignore`)
- ❌ `package.json`, `package-lock.json` (not required for static output)
- ❌ `README.md`, `PAGE_TEMPLATE.html` (local documentation/templates)

**Special considerations:**
- `projects.json` must remain a top-level array; homepage and `/projects` both rely on that shape.
- Redeploy the landing page after adding a new project so the catalogue and shared components stay in sync.

### Stock Viewer (`stock-viewer/`)
**Deploys:**
- ✅ `index.html`
- ✅ `assets/` folder
- ✅ `functions/` folder (API endpoint)
- ✅ `wrangler.toml`
- ✅ `site.webmanifest`

**Remember to remove/ignore before deploy:**
- ❌ `node_modules/` (if present)
- ❌ Documentation files

### Snake (`snake/`)
**Deploys:**
- ✅ `index.html`
- ✅ `assets/` folder
- ✅ `wrangler.toml`
- ✅ `site.webmanifest`

**Remember to remove/ignore before deploy:**
- ❌ `node_modules/` (if present)
- ❌ Documentation files

**Special considerations:**
- `index.html` injects inline header/footer overrides; update the `links` array if the global navigation changes.
- The stylesheet link includes `?v=20241108`; bump the version when you change `assets/styles.css` so caches refresh.

### Python Playground (`python-playground/`)
**Deploys:**
- ✅ `index.html`
- ✅ `assets/` folder
- ✅ `wrangler.toml`
- ✅ `site.webmanifest`

**Remember to remove/ignore before deploy:**
- ❌ `node_modules/` (if present)
- ❌ Documentation files

## 🔒 Security Note

**⚠️ IMPORTANT**: `stock-viewer/wrangler.toml` has `ALPHA_KEY` hardcoded. This should be moved to Cloudflare dashboard as a **secret** instead of being in the config file.

**Current (insecure):**
```toml
[vars]
ALPHA_KEY = "2ZR17ME4YRIRQS51"
```

**Should be:**
1. Remove from `wrangler.toml`
2. Add as secret in Cloudflare dashboard → Pages → stock-viewer → Settings → Environment variables
3. Access via `env.ALPHA_KEY` in the function

## ✅ Deployment Checklist

Run through these quick checks before executing any `deploy-*.cmd` script:

1. **Prune local clutter** – delete any `node_modules/` directories or add them to `.wranglerignore`; Wrangler will upload everything in the directory otherwise.
2. **Bump snake CSS version** – if you touched `snake/assets/styles.css`, increment the `?v=` value in `snake/index.html` so browsers fetch the new stylesheet.
3. **Verify project data** – keep `landingpage/projects.json` in array form (`[ ... ]`) and ensure `/landingpage/assets/projects.js` was redeployed if you added projects.
4. **Keep navigation in sync** – if the global nav changes, update the `links` array in `snake/index.html` so the inline override rebuilds the right menu.
5. **Deploy from root scripts** – run the appropriate `deploy-*.cmd`; each script echoes the directory it’s pushing so you can confirm the scope.

## 📊 Summary

**Your deployment scripts are correct!** ✅

- ✅ They `cd` into the target project before deploying, so root files stay local
- ✅ Each project keeps its own `wrangler.toml`, assets, and functions
- ✅ Root-level docs and tooling aren’t published unless you copy them into a project
- ✅ Separate scripts exist for landing page, stock viewer, python playground, and snake

**No changes needed to deployment scripts** - they're working as intended!

## 🔧 Optional Improvements

1. **Move API keys to secrets** (security best practice)
2. **Add `.gitignore`** if using Git (excludes `node_modules/`, `.wrangler/`, etc.)
3. **Consider build process** if you want to minify/optimize before deployment

