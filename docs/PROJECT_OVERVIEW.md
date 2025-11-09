# Supm3n Project Overview

**Last Updated:** November 2025  
**Purpose:** This document provides a comprehensive overview of the Supm3n portfolio website for AI agents and developers. Read this first to understand the project structure, architecture, and recent improvements.

---

## 🎯 What is Supm3n?

**Supm3n** is a personal portfolio website showcasing lean tools, fast visuals, and internet contraptions. It consists of:

- **Main landing page** (`supm3n.com`) - Portfolio homepage with projects showcase
- **Subdomain projects** - Independent mini-apps deployed as separate Cloudflare Pages:
  - `stocks.supm3n.com` - Real-time stock price viewer
  - `settleup.supm3n.com` - Expense splitting calculator
  - `snake.supm3n.com` - Classic Snake game
- **Shared component system** - Centralized components, styles, and scripts served from the main domain

---

## 🏗️ Architecture Overview

### Deployment Model

All projects are deployed as **separate Cloudflare Pages projects**:

```
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Pages Projects                              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  landingpage  →  https://supm3n.com/                    │
│  stock-viewer  →  https://stocks.supm3n.com/            │
│  settleup      →  https://settleup.supm3n.com/          │
│  snake         →  https://snake.supm3n.com/             │
│                                                          │
│  Shared assets served from:                             │
│  https://supm3n.com/shared/*                            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **Shared Components via CDN**: Components are served from `supm3n.com/shared/` and loaded dynamically by subdomain projects
2. **Independent Deployments**: Each project deploys separately, allowing independent updates
3. **No Build Step**: Static HTML/CSS/JS files deployed directly (no bundlers or transpilers)
4. **Cloudflare Pages Functions**: API endpoints for dynamic features (stock prices, project discovery)

---

## 📁 Project Structure

```
Supm3n/
├── landingpage/              # Main portfolio site
│   ├── shared/              # Shared components (served at /shared/*)
│   │   ├── components/      # HTML fragments (header, footer, breadcrumbs)
│   │   ├── styles/          # Shared CSS (variables, components)
│   │   └── scripts/         # Shared JS (theme, components, utils)
│   ├── assets/              # Landing page assets
│   ├── functions/           # Cloudflare Pages Functions (API)
│   ├── index.html           # Homepage
│   ├── projects.html        # Projects listing
│   └── wrangler.toml        # Cloudflare Pages config
│
├── stock-viewer/            # Stock chart viewer
│   ├── assets/              # Project assets
│   ├── functions/           # Price lookup API
│   ├── index.html           # Main page
│   └── wrangler.toml
│
├── settleup/               # Expense splitting app
│   ├── assets/             # Project assets
│   ├── scripts/            # Local theme script
│   ├── styles/             # Local theme CSS
│   ├── index.html          # Main app page
│   └── wrangler.toml
│
├── snake/                  # Snake game
│   ├── assets/             # Game logic & styles
│   ├── index.html          # Game shell
│   └── wrangler.toml
│
├── docs/                   # Documentation
│   ├── PROJECT_OVERVIEW.md  # This file
│   ├── PROJECT_SUMMARY.md  # Detailed technical docs
│   ├── THEME_SYSTEM.md      # Theme implementation guide
│   ├── DEPLOYMENT_ANALYSIS.md
│   └── IMPROVEMENTS.md
│
├── deploy-*.cmd            # Deployment scripts
└── README.md               # Quick reference
```

---

## 🎨 Theme System (Unified - November 2025)

### Overview

The theme system provides **consistent light/dark mode** across all sites and subdomains with:
- **ES Module** implementation (`theme.js` as `type="module"`)
- **Cross-subdomain persistence** via cookie (`Domain=.supm3n.com`)
- **localStorage fallback** for same-domain persistence
- **Early application** to prevent flash of unstyled content
- **Global CSS variables** for consistent theming

### How It Works

1. **Theme Script** (`landingpage/shared/scripts/theme.js`):
   - Runs immediately on page load (IIFE)
   - Reads cookie → localStorage → system preference
   - Sets `data-theme` attribute on `<html>` element
   - Exports `toggleTheme()` function for button binding

2. **CSS Variables** (`landingpage/shared/styles/variables.css`):
   - Defines global variables: `--bg`, `--fg`, `--surface`, `--link`, `--border`
   - Light mode overrides via `[data-theme="light"]` selector
   - System preference fallback via `@media (prefers-color-scheme: light)`

3. **Project Implementation**:
   - Load shared `variables.css` in `<head>`
   - Load `theme.js` as module: `<script type="module" src="..."></script>`
   - Bind toggle button: `import { toggleTheme } from '...'; button.addEventListener('click', toggleTheme)`
   - Use CSS variables (not hardcoded colors)

### Recent Fixes (November 2025)

✅ **Removed legacy theme code** from `landingpage/assets/script.js`  
✅ **Fixed Snake** - Changed to ESM module loading (was causing "Unexpected token 'export'" error)  
✅ **Normalized toggle selectors** - All pages support `#themeToggle`, `#theme-toggle`, `[data-theme-toggle]`  
✅ **Reordered SettleUp CSS** - Shared variables load first, then local overrides  
✅ **Unified cache-busters** - All assets use `?v=20251109`  
✅ **Cross-subdomain sync** - Cookie with `Domain=.supm3n.com` ensures theme persists across all subdomains

**See `docs/THEME_SYSTEM.md` for detailed implementation guide.**

---

## ☁️ Cloudflare Pages Configuration

### Projects & Domains

| Project Name | Domain | Deploy Script | Notes |
|-------------|--------|---------------|-------|
| `landingpage` | `supm3n.com` | `deploy-landingpage.cmd` | Serves shared components at `/shared/*` |
| `stock-viewer` | `stocks.supm3n.com` | `deploy-stock-viewer.cmd` | Requires `ALPHA_KEY` env var |
| `settleup` | `settleup.supm3n.com` | `deploy-settleup.cmd` | Uses local theme files |
| `snake` | `snake.supm3n.com` | `deploy-snake.cmd` | Inline component overrides |

### Deployment Process

1. **Each project deploys independently**:
   ```bash
   cd landingpage
   npx wrangler pages deploy . --project-name landingpage
   ```

2. **Deploy scripts** (in root directory):
   - `deploy-landingpage.cmd` - Deploys main site
   - `deploy-stock-viewer.cmd` - Deploys stock viewer
   - `deploy-settleup.cmd` - Deploys expense app
   - `deploy-snake.cmd` - Deploys game

3. **Important**: Always deploy `landingpage` first when updating shared components, as other projects depend on `/shared/*` assets.

### Environment Variables

**Stock Viewer** requires:
- `ALPHA_KEY` - Alpha Vantage API key (set in Cloudflare Dashboard → Pages → stock-viewer → Settings → Environment variables)

**Note**: Do NOT commit API keys to `wrangler.toml`. Use Cloudflare Dashboard secrets.

### Cloudflare Pages Functions

**Location**: `{project}/functions/api/`

- **Landing Page**: `/api/projects` - Auto-discovers projects from DNS
- **Stock Viewer**: `/api/price/[symbol]` - Fetches stock prices (requires `ALPHA_KEY`)

**How Functions Work**:
- Files in `functions/api/` become API endpoints
- Example: `functions/api/projects.js` → `https://supm3n.com/api/projects`
- Use `export async function onRequest(context)` for GET requests

---

## 🔧 Shared Component System

### Purpose

Centralized components, styles, and scripts that all projects can use, reducing duplication and ensuring consistency.

### Location

**Source**: `landingpage/shared/`  
**Served at**: `https://supm3n.com/shared/`

### Components

1. **Header** (`components/header.html`) - Navigation with theme toggle
2. **Footer** (`components/footer.html`) - Site footer with links
3. **Breadcrumbs** (`components/breadcrumbs.html`) - Auto-generated navigation

### Usage Patterns

**Pattern 1: Dynamic Loading** (stock-viewer, snake):
```html
<!-- Load component loader -->
<script src="https://supm3n.com/shared/scripts/components.js"></script>
<script>
  Supm3nComponents.init({
    header: true,
    footer: true,
    breadcrumbs: true
  });
</script>
```

**Pattern 2: Inline Components** (settleup):
```html
<!-- Hardcoded header/footer in HTML for better performance -->
<header class="site-header">...</header>
```

**Pattern 3: Hybrid** (snake):
- Uses dynamic loader but overrides with inline styles/scripts for critical rendering

### Component Loader (`components.js`)

**Features**:
- Auto-detects dev vs production (uses local `/shared` or CDN `https://supm3n.com/shared`)
- Retry logic with exponential backoff
- Fallback components if fetch fails
- Version cache-busting (`?v=20251109`)

---

## 🎨 Design System

### Colors

**Dark Mode (Default)**:
- Base: `#0B0C10`
- Surface 1: `#0F1115`
- Surface 2: `#151820`
- Text Primary: `#E6E9F0`
- Text Muted: `#A9B1C6`
- Accent Start: `#7C3AED` (Purple)
- Accent End: `#06B6D4` (Cyan)

**Light Mode**:
- Base: `#FAFAFA`
- Surface 1: `#FFFFFF`
- Surface 2: `#F5F5F5`
- Text Primary: `#0B0C10`
- Text Muted: `#4A5568`

### Typography

- **Font**: Inter (sans-serif), JetBrains Mono (monospace)
- **Fluid scales**: Responsive text using `clamp()`
- **Sizes**: xs, sm, base, lg, xl, 2xl, 3xl, 4xl

### CSS Variables

All projects use shared CSS variables from `variables.css`:
- `--bg`, `--fg` - Background and foreground
- `--surface` - Card/surface backgrounds
- `--link` - Link colors
- `--border` - Border colors
- `--muted` - Muted text colors

---

## 📝 Key Files Reference

### Landing Page
- `landingpage/index.html` - Homepage
- `landingpage/projects.html` - Projects listing
- `landingpage/assets/projects.js` - Project manager with filtering
- `landingpage/functions/api/projects.js` - Projects API endpoint

### Shared Components
- `landingpage/shared/scripts/theme.js` - Theme toggle (ES module)
- `landingpage/shared/scripts/components.js` - Component loader
- `landingpage/shared/styles/variables.css` - Global CSS variables
- `landingpage/shared/styles/components.css` - Component styles

### Stock Viewer
- `stock-viewer/index.html` - Main page
- `stock-viewer/functions/api/price/[symbol]/index.js` - Price API

### SettleUp
- `settleup/index.html` - Main app (inline components)
- `settleup/scripts/theme.js` - Local theme module
- `settleup/styles/theme-base.css` - Local theme variables

### Snake
- `snake/index.html` - Game shell with inline overrides
- `snake/assets/script.js` - Game logic

---

## 🚀 Quick Start for New Agents

### Understanding the Codebase

1. **Start here**: Read `docs/PROJECT_OVERVIEW.md` (this file)
2. **Architecture**: Read `docs/PROJECT_SUMMARY.md` for detailed technical docs
3. **Theme system**: Read `docs/THEME_SYSTEM.md` if working on theming
4. **Deployment**: Read `docs/DEPLOYMENT_ANALYSIS.md` for deployment details

### Common Tasks

**Adding a new project**:
1. Copy `PROJECT_TEMPLATE/` to new directory
2. Update `index.html` with project content
3. Add `wrangler.toml` with project name
4. Create `deploy-{project}.cmd` script
5. Deploy via Cloudflare Pages

**Updating shared components**:
1. Edit files in `landingpage/shared/`
2. Deploy landing page first: `deploy-landingpage.cmd`
3. Other projects will automatically use updated components

**Fixing theme issues**:
1. Ensure `theme.js` loads as `type="module"`
2. Check CSS has `[data-theme="light"]` selector
3. Verify toggle button binding includes all selector variants
4. Test cross-subdomain persistence

**Deploying changes**:
1. Update cache-buster versions (`?v=20251109`)
2. Run appropriate `deploy-*.cmd` script
3. Verify deployment in Cloudflare Dashboard

---

## 🔍 Recent Improvements (November 2025)

### Theme Unification

**Problem**: Theme system was inconsistent across projects:
- Snake loaded theme.js as non-module (parse error)
- Legacy theme code in landingpage conflicted with shared module
- Toggle selectors varied between projects
- CSS load order issues in SettleUp

**Solution**: Unified theme system with:
- ✅ All projects load theme.js as ES module
- ✅ Removed legacy theme code from landingpage
- ✅ Normalized toggle button selectors
- ✅ Reordered CSS includes (shared first, then local)
- ✅ Unified cache-buster versions
- ✅ Cross-subdomain cookie sync (`Domain=.supm3n.com`)

**Files Changed**:
- `landingpage/assets/script.js` - Removed legacy init, kept icon updater
- `landingpage/shared/scripts/components.js` - Version bump, breadcrumbs fix
- All HTML files - Updated toggle selectors
- `snake/index.html` - Fixed to ESM, added binder
- `settleup/index.html` - Reordered CSS includes

**Commit**: `fd77609` - "Unify theme across supm3n.com + subdomains"

---

## 📚 Documentation Files

- **`docs/PROJECT_OVERVIEW.md`** (this file) - High-level overview for new agents
- **`docs/PROJECT_SUMMARY.md`** - Detailed technical documentation
- **`docs/THEME_SYSTEM.md`** - Complete theme implementation guide
- **`docs/DEPLOYMENT_ANALYSIS.md`** - Deployment process and scripts
- **`docs/IMPROVEMENTS.md`** - Future enhancements and recommendations
- **`README.md`** - Quick reference and local commands

---

## ⚠️ Important Notes

1. **Always deploy landingpage first** when updating shared components
2. **Never commit API keys** - Use Cloudflare Dashboard secrets
3. **Cache-busting**: Increment `?v=` version when updating CSS/JS
4. **Theme system**: All projects must use CSS variables, not hardcoded colors
5. **Component loading**: Projects can use dynamic loading or inline components
6. **Python Playground**: Has been deleted (removed from repo)

---

## 🎯 Next Steps for New Agents

1. Read this overview to understand the project structure
2. Check `docs/PROJECT_SUMMARY.md` for detailed technical information
3. Review `docs/THEME_SYSTEM.md` if working on theming
4. Check `git log` for recent changes and context
5. Test locally using `npx wrangler pages dev ./{project}`

---

**Questions?** Check the documentation files in `docs/` or review the code comments in the relevant files.

