# Supm3n Project Template

This is the official template for creating new projects in the Supm3n ecosystem. It includes all the shared styling, navigation, and functionality needed for a consistent experience across all Supm3n sites.

## Quick Start

1. **Copy this directory** to your new project location
2. **Update `index.html`**:
   - Replace `Project Name` with your project name
   - Update `<meta name="description">` with your project description
   - Update Open Graph meta tags (title, description, URL)
   - Replace `https://project.supm3n.com/` with your actual subdomain
   - Update `?v=YYYYMMDD` to today's date (e.g., `?v=20251110`)
3. **Add your content** to the `<main>` section
4. **Create project-specific styles** in `assets/styles.css`
5. **Add JavaScript** (if needed) in `assets/script.js`

## What's Included Automatically

### 🎨 Visual Design
- **Background gradient** - Animated multi-color gradient that adapts to light/dark theme
- **Header with navigation** - Logo, Home/Projects/Uses links, and theme toggle
- **Active nav highlighting** - Current page is automatically highlighted with a gradient underline
- **Dark/Light theme** - Automatic theme switching with user preference saving

### 🛠️ Functionality
- **Automatic navigation state** - The `utils.js` automatically adds the `.active` class to the current page link
- **Theme persistence** - User's theme choice is saved in localStorage
- **Responsive design** - Mobile-friendly header and navigation

### 📦 Shared Resources

All projects load these shared resources from `https://supm3n.com/shared/`:

1. **`variables.css`** - CSS custom properties (colors, spacing, fonts)
2. **`components.css`** - Header, nav, footer, buttons, and the animated background gradient
3. **`theme.js`** - Dark/light theme switching logic
4. **`utils.js`** - Navigation highlighting and utility functions

## File Structure

```
your-project/
├── index.html              # Main HTML file (use the template)
├── assets/
│   ├── styles.css          # Your project-specific styles
│   ├── script.js           # Your project-specific JavaScript
│   └── icons/              # Favicons (copy from another project)
│       ├── favicon.ico
│       ├── apple-touch-icon.png
│       └── android-chrome-*.png
├── site.webmanifest        # PWA manifest (copy and update)
├── wrangler.toml           # Cloudflare Pages config
└── README.md               # Your project documentation
```

## Header HTML (Copy this exactly)

```html
<header class="site-header" role="banner">
  <div class="container header-inner">
    <a class="brand" href="https://supm3n.com/" aria-label="Supm3n Home">
      <img src="https://supm3n.com/assets/logo.png" alt="Supm3n logo" class="brand-logo" />
    </a>
    <nav class="main-nav" role="navigation" aria-label="Main navigation">
      <a class="nav-link" href="https://supm3n.com/">Home</a>
      <a class="nav-link" href="https://supm3n.com/projects">Projects</a>
      <a class="nav-link" href="https://supm3n.com/uses">Uses</a>
    </nav>
    <button class="theme-toggle" id="themeToggle" aria-label="Toggle theme">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
      </svg>
    </button>
  </div>
</header>
```

**Important**: Use this exact HTML structure. The `.active` class and gradient underline will be added automatically by `utils.js`.

## Customization

### Project-Specific Styles

Add your custom styles in `assets/styles.css`. You can override any shared styles or add new ones:

```css
/* Example: Custom button styles for your project */
.my-project-button {
  background: linear-gradient(135deg, var(--color-accent-start), var(--color-accent-end));
  padding: var(--space-md) var(--space-lg);
  border-radius: 12px;
}
```

### Available CSS Variables

From `shared/styles/variables.css`:
- Colors: `--color-text-primary`, `--color-text-muted`, `--color-accent-start`, `--color-accent-end`, `--color-surface-1`, `--color-surface-2`, `--color-surface-3`
- Spacing: `--space-xs`, `--space-sm`, `--space-md`, `--space-lg`, `--space-xl`, `--space-2xl`
- Typography: `--text-xs`, `--text-sm`, `--text-base`, `--text-lg`, `--text-xl`
- Effects: `--glass-bg`, `--glass-border`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`

## Cache Busting

Always use cache-busting query strings for shared resources:

```html
<link rel="stylesheet" href="https://supm3n.com/shared/styles/components.css?v=20251110">
```

Update the `?v=YYYYMMDD` parameter when:
- You update any shared files
- You deploy changes to the main site
- You want to force browsers to fetch fresh assets

## Deployment

1. Create a Cloudflare Pages project for your subdomain
2. Deploy using Wrangler: `wrangler pages deploy . --project-name=your-project`
3. Set up custom domain: `your-project.supm3n.com`

## Questions?

See existing projects for reference:
- `settleup/` - Expense splitting app
- `snake/` - Snake game
- `stock-viewer/` - Stock chart viewer

All use this exact same header structure and shared resources!
