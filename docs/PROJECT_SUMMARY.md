# Supm3n Project Summary

## Project Overview

**Supm3n** is a portfolio website showcasing lean tools, fast visuals, and internet contraptions. The project consists of:
- **Main landing page** (`landingpage/`) - Portfolio homepage with projects showcase
- **Stock Viewer** (`stock-viewer/`) - Real-time stock price viewer and tracker
- **Shared component system** - Reusable components for all projects
- **Project template** - Quick-start template for new projects

## Project Structure

```
Supm3n/
├── landingpage/                # Main portfolio site (deployed to https://supm3n.com)
│   ├── shared/                # Shared components served at https://supm3n.com/shared/
│   │   ├── components/        # Header, footer, breadcrumbs HTML fragments
│   │   ├── styles/            # Shared CSS (variables, component primitives)
│   │   └── scripts/           # Shared JS (theme, breadcrumbs, utils, loader)
│   ├── assets/                # Landing page assets (styles, scripts, icons, logo)
│   ├── functions/             # Cloudflare Pages Functions (API endpoints)
│   ├── index.html             # Homepage
│   ├── projects.html          # Projects listing page
│   └── wrangler.toml          # Cloudflare Pages config
│
├── stock-viewer/              # Stock chart viewer (https://stocks.supm3n.com)
│   ├── assets/                # Project assets
│   ├── functions/             # Price lookup worker (Cloudflare Pages Function)
│   ├── index.html             # Main page (uses shared components)
│   └── wrangler.toml          # Cloudflare Pages config
│
├── settleup/                  # Expense splitting app (https://settleup.supm3n.com)
│   ├── assets/                # Project assets (icons, styles)
│   ├── index.html             # Main app page (inline header/footer)
│   ├── styles.css             # App-specific styles with theme support
│   └── wrangler.toml          # Cloudflare Pages config
│
├── python-playground/         # Browser-based Python REPL (https://python.supm3n.com)
│   ├── assets/                # Pyodide loader, styles, icons
│   ├── HOW_TO_ADD_PROGRAMS.md # Guide for extending bundled examples
│   ├── index.html             # Main experience (uses shared components)
│   └── wrangler.toml          # Cloudflare Pages config
│
├── snake/                     # Snake game (https://snake.supm3n.com)
│   ├── assets/                # Game logic, responsive styles, icons
│   ├── index.html             # Game shell + inline shared-component overrides
│   ├── PROJECT_SUMMARY.md     # Deep-dive documentation for the project
│   └── wrangler.toml          # Cloudflare Pages config
│
├── PROJECT_TEMPLATE/          # Template for new projects
│   ├── index.html             # Starter HTML wired to shared components
│   └── README.md              # Template documentation
│
├── deploy-landingpage.cmd     # Cloudflare Pages deploy helper
├── deploy-stock-viewer.cmd    # Cloudflare Pages deploy helper
├── deploy-python-playground.cmd
└── deploy-snake.cmd
```

## Key Features Implemented

### 1. Shared Component System
- **Location**: `landingpage/shared/` (deployed to `https://supm3n.com/shared/`)
- **Purpose**: Centralized components, styles, and scripts for all projects
- **Components**:
  - Header with navigation and theme toggle
  - Footer with links
  - Breadcrumbs navigation
  - Theme system (dark/light mode)
  - Utility functions library
- **Usage Patterns**:
  - **Dynamic Loading**: Projects use `Supm3nComponents.init()` to load components via fetch
  - **Inline Components**: Some projects (settleup, snake) use inline HTML for better performance
  - **Hybrid Approach**: Projects can mix both strategies (e.g., inline header, dynamic footer)

### 2. Component Loader
- **Script**: `landingpage/shared/scripts/components.js`
- **Usage**: Projects load components dynamically via `Supm3nComponents.init()`
- **Base URL**: `https://supm3n.com/shared`
- **Features**:
  - Lazy loading of components
  - Automatic theme script injection
  - Breadcrumb generation
  - Utility functions loading

### 3. Loading Skeletons
- **Implementation**: Skeleton loaders for project cards
- **Location**: `landingpage/assets/styles.css` (skeleton classes)
- **Usage**: Shows animated placeholders while content loads
- **Classes**: `.skeleton-project-card`, `.skeleton-project-icon`, etc.

### 4. Unified Navigation
- **Header**: Shared across all projects with links back to main site
- **Breadcrumbs**: Auto-generated based on URL path
- **Theme Toggle**: Persistent across all projects via localStorage

### 5. Python Playground Experience
- [Pyodide](https://pyodide.org/) powered, runs Python directly in-browser
- Curated example library with helper docs (`python-playground/HOW_TO_ADD_PROGRAMS.md`)
- Custom command runner UI with keyboard shortcuts (`Ctrl/Cmd + Enter`)
- Reuses shared header/footer/breadcrumbs for brand consistency

### 6. Snake Game Experience
- Responsive HTML5 canvas with mobile-first controls (touch, mouse, keyboard)
- Local storage backed high-score tracking and pause/resume flow
- Aggressive layout tuning to keep the board centred on small viewports
- Inline overrides ensure shared components render even if CDN cache lags

### 7. Shared Component Override Strategy
- `Supm3nComponents.init` still bootstraps header, breadcrumbs, footer
- Snake project rehydrates header links + logo after init to avoid stale markup
- Minimal snake footer replaces the shared footer to maximise vertical space
- Cache-busting query strings (`/assets/styles.css?v=...`) prevent stale CSS after redeploys

## Technical Details

### Shared Components System

**How it works:**
1. Shared files are in `landingpage/shared/`
2. When landing page is deployed, these are accessible at `https://supm3n.com/shared/`
3. Projects reference these URLs to load components dynamically
4. Component loader (`components.js`) injects HTML into empty containers

**Usage in projects:**
```html
<!-- Load shared styles -->
<link rel="stylesheet" href="https://supm3n.com/shared/styles/variables.css">
<link rel="stylesheet" href="https://supm3n.com/shared/styles/components.css">

<!-- Empty containers for components -->
<header class="site-header"></header>
<footer class="site-footer"></footer>
<nav class="breadcrumbs" id="breadcrumbs"></nav>

<!-- Component loader -->
<script src="https://supm3n.com/shared/scripts/components.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    await Supm3nComponents.init({
      header: true,
      footer: true,
      breadcrumbs: true,
      styles: false, // Already loaded in <head>
      utils: true
    });
  });
</script>
```

#### Snake-specific overrides
- `snake/index.html` ships with an inline `<style>` block that clamps header/footer layout and appends a cache-busting query string (`/assets/styles.css?v=...`). Increment the version whenever snake CSS changes so Cloudflare/CDN caches serve the new file immediately.
- A `DOMContentLoaded` hook runs right after `Supm3nComponents.init(...)` to guarantee the header has the Supm3n logo and canonical navigation links—even if the shared component HTML is temporarily stale or cached.
- The same hook replaces the injected footer with a trimmed `.snake-footer-content` layout so the board stays centred. On narrow or short screens the footer is hidden entirely to reclaim vertical space.
- If the global navigation ever changes, update the `links` array in `snake/index.html` to keep the reconstructed header in sync.

### CSS Variables System

All projects use consistent CSS variables defined in `landingpage/shared/styles/variables.css`:
- Colors (dark/light theme support)
- Typography (fluid scales)
- Spacing
- Layout
- Effects (shadows, glass morphism)
- Transitions

**Theme-Aware CSS Pattern:**
Projects must implement theme switching by:
1. Using CSS variables from shared `variables.css` (loaded via CDN)
2. Defining `[data-theme="light"]` selector to override dark mode variables
3. Using `@media (prefers-color-scheme: light)` for system preference fallback

**Example Implementation:**
```css
:root {
  --bg: #0b0c10;  /* Dark mode default */
  --fg: #e6e9f0;
}

/* Light mode override */
[data-theme="light"] {
  --bg: #fafafa;
  --fg: #0b0c10;
}

/* System preference fallback */
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    --bg: #fafafa;
    --fg: #0b0c10;
  }
}
```

**Projects Using This Pattern:**
- `settleup/styles.css` - Uses shared variables with local overrides
- `stock-viewer/assets/styles.css` - Theme-aware with cache-busting
- All projects should follow this pattern for consistent theming

### Theme System (Unified - November 2025)

- **Implementation**: ES Module (`type="module"`) for all theme scripts
- **Storage**: Cookie (`Domain=.supm3n.com`) + localStorage fallback
- **Cross-subdomain sync**: Cookie ensures theme persists across all subdomains
- **Default**: Respects system preference if no saved preference
- **Toggle**: Button in header (supports `#themeToggle`, `#theme-toggle`, `[data-theme-toggle]`)
- **Persistence**: Works across all projects and subdomains
- **Script**: `landingpage/shared/scripts/theme.js` (ES module, early application)
- **Implementation**: Theme toggle sets `data-theme="light"` or `data-theme="dark"` on `<html>` element
- **CSS Variables**: All projects must use CSS variables that respond to `[data-theme="light"]` selector
- **Important**: Projects must define light mode overrides using `[data-theme="light"]` selector in their CSS
- **Cache Busting**: All assets use unified version query strings (e.g., `?v=20251109`)

**Recent Improvements (November 2025)**:
- ✅ Removed legacy theme code from `landingpage/assets/script.js`
- ✅ Fixed Snake to load theme.js as ES module (was causing parse errors)
- ✅ Normalized toggle button selectors across all projects
- ✅ Reordered SettleUp CSS includes (shared variables first)
- ✅ Unified cache-buster versions across all projects
- ✅ Cross-subdomain cookie sync for theme persistence

See `docs/THEME_SYSTEM.md` for complete implementation guide.

### Stock Viewer Specifics

- **API Limit**: 25 requests per day (free tier)
- **Behavior**: No API calls on page load
- **Loading**: Only when "Load Chart" button is clicked
- **Input Methods**: 
  - Dropdown selection (predefined stocks)
  - Custom input field (any symbol)
  - Both work independently
- **API Key**: Must be set as `ALPHA_KEY` environment variable in Cloudflare Pages
  - Go to: Cloudflare Dashboard → Pages → stock-viewer → Settings → Environment variables
  - Add secret: `ALPHA_KEY` with your Alpha Vantage API key
- **Theme Support**: Fully theme-aware with light/dark mode switching
- **Cache Busting**: CSS file uses version query string (`?v=20251109`) - increment on CSS changes

### Projects Catalogue Pipeline
- Client fetch order: `/api/projects` (Cloudflare DNS discovery) → fallback to `/projects.json` if the API fails.
- `landingpage/assets/projects.js` normalises the payload shape (`[...]` or `{ projects: [...] }`) and logs the outcome for easier debugging.
- Homepage featured projects use a lightweight helper in `landingpage/index.html` with the same fallback logic.
- Keep `landingpage/projects.json` as a top-level array; update it (and the homepage feature list) whenever you add or rename a project.
- Redeploy the landing page after any change to the catalogue so Cloudflare’s cache and the DNS discovery stay in sync.

## Deployment

### Landing Page
```bash
cd landingpage
wrangler pages deploy . --project-name landingpage
```
Or use: `deploy-landingpage.cmd`

**Deploys to**: `https://supm3n.com/`
**Shared components available at**: `https://supm3n.com/shared/`

### Stock Viewer
```bash
cd stock-viewer
wrangler pages deploy . --project-name stock-viewer
```
Or use: `deploy-stock-viewer.cmd`

**Deploys to**: `https://stocks.supm3n.com/` (or configured subdomain)

### Python Playground
```bash
cd python-playground
wrangler pages deploy . --project-name python-playground
```
Or use: `deploy-python-playground.cmd`

**Deploys to**: `https://python.supm3n.com/`

### Snake
```bash
cd snake
wrangler pages deploy . --project-name snake
```
Or use: `deploy-snake.cmd`

**Deploys to**: `https://snake.supm3n.com/`

> **Tip:** Snake appends `?v=20241108` to `assets/styles.css` for cache busting. Update the version string whenever you change the CSS so fresh styles roll out with the next deploy.

### Settleup
```bash
cd settleup
wrangler pages deploy . --project-name settleup
```
Or use: `deploy-settleup.cmd`

**Deploys to**: `https://settleup.supm3n.com/`

> **Note:** Settleup uses inline header/footer (not shared components) for better performance and styling control.

## Important Files

### Landing Page
- `landingpage/index.html` - Homepage (hardcoded header/footer, doesn't use component loader)
- `landingpage/projects.html` - Projects listing page
- `landingpage/assets/projects.js` - Projects manager with filtering, search, skeletons
- `landingpage/assets/styles.css` - Main styles (includes skeleton styles)
- `landingpage/assets/script.js` - Theme toggle, command palette, scroll reveal
- `landingpage/functions/api/projects.js` - API endpoint (auto-discovers projects from DNS)

### Stock Viewer
- `stock-viewer/index.html` - Main page (uses shared components, cache-busted CSS)
- `stock-viewer/assets/script.js` - Stock chart logic
- `stock-viewer/assets/styles.css` - Project-specific styles with theme support
- `stock-viewer/functions/api/price/[symbol]/index.js` - Stock price API (requires ALPHA_KEY env var)

### Settleup
- `settleup/index.html` - Main app page (inline header/footer, no shared component loader)
- `settleup/styles.css` - App styles with theme support using shared CSS variables
- `settleup/assets/icons/` - Favicon files (copied from landingpage)
- `settleup/wrangler.toml` - Cloudflare Pages configuration

### Python Playground
- `python-playground/index.html` - Pyodide loader + shared components
- `python-playground/assets/script.js` - Example catalogue + REPL wiring
- `python-playground/assets/styles.css` - Editor + layout styling
- `python-playground/HOW_TO_ADD_PROGRAMS.md` - Contributor guide for new examples

### Snake
- `snake/index.html` - Game shell, inline shared-component overrides, cache-busted stylesheet link
- `snake/assets/script.js` - `SnakeGame` class (input handling, game loop, rendering)
- `snake/assets/styles.css` - Responsive layout + footer/header clamps
- `snake/PROJECT_SUMMARY.md` - Deep reference for future maintainers

### Shared Components
- `landingpage/shared/components/header.html` - Navigation header
- `landingpage/shared/components/footer.html` - Footer
- `landingpage/shared/components/breadcrumbs.html` - Breadcrumb container
- `landingpage/shared/styles/variables.css` - CSS variables
- `landingpage/shared/styles/components.css` - Component styles
- `landingpage/shared/scripts/components.js` - Component loader
- `landingpage/shared/scripts/theme.js` - Theme toggle
- `landingpage/shared/scripts/breadcrumbs.js` - Breadcrumb logic
- `landingpage/shared/scripts/utils.js` - Utility functions

## Design System

### Colors
- **Base (Dark)**: `#0B0C10`
- **Surface 1**: `#0F1115`
- **Surface 2**: `#151820`
- **Text Primary**: `#E6E9F0`
- **Text Muted**: `#A9B1C6`
- **Accent Start**: `#7C3AED` (Purple)
- **Accent End**: `#06B6D4` (Cyan)
- **Red Cape**: `#EF4444` (Logo glow)

### Typography
- **Font**: Inter (sans-serif), JetBrains Mono (monospace)
- **Fluid scales**: Responsive text sizes using `clamp()`
- **Sizes**: xs, sm, base, lg, xl, 2xl, 3xl, 4xl

### Spacing
- xs: 0.5rem
- sm: 1rem
- md: 1.5rem
- lg: 2rem
- xl: 3rem
- 2xl: 4rem

## Creating New Projects

1. Copy `PROJECT_TEMPLATE/` to new project directory
2. Update `index.html` with project-specific content
3. Add project-specific styles to `assets/styles.css`
4. Add project-specific JavaScript
5. Deploy as new Cloudflare Pages project
6. Components will automatically load from `https://supm3n.com/shared/`

## Notes

- **Landing page** doesn't use the component loader (it's the source of shared components)
- **Component Loading Strategy**: Projects can use either:
  - **Shared components** (via `Supm3nComponents.init()`) - Good for consistency, requires network fetch
  - **Inline components** (hardcoded in HTML) - Better performance, more control (used by settleup, snake)
- **Theme preference** is shared across all projects via localStorage
- **Theme Implementation**: All projects must implement `[data-theme="light"]` CSS selector to support theme switching
- **Breadcrumbs** auto-generate based on URL path and hostname
- **Loading skeletons** improve perceived performance
- **API rate limits** are respected (stock viewer only loads on demand)
- **Snake** reconstructs shared navigation + footer inline; keep the `links` array and footer copy in `snake/index.html` aligned with the main site
- **Settleup** uses inline header/footer for better styling control and performance
- **Landing page projects** fall back to `landingpage/projects.json` if `/api/projects` fails — keep the JSON in array form (`[ ... ]`) to avoid runtime errors
- **Deploy scripts** use `npx wrangler pages deploy` (not global `wrangler` command)
- **Cache Busting**: When updating CSS/JS files, increment version query strings (e.g., `?v=20251109`) to force browser reload
- **Stock Viewer API key** must be set as `ALPHA_KEY` environment variable in Cloudflare Pages (not in wrangler.toml)

## Future Enhancements

- Project detail pages
- Enhanced project metadata (screenshots, tech stack, status)
- Project registry system
- Analytics dashboard
- RSS/JSON feed for projects

