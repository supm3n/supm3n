# Project Template

This is a template for creating new Supm3n projects with shared components and styling.

## Features

- ✅ Shared header and footer components
- ✅ Unified navigation with breadcrumbs
- ✅ Theme toggle (dark/light mode)
- ✅ Consistent styling via CSS variables
- ✅ Shared utility functions
- ✅ Responsive design

## Setup

1. Copy this template to your new project directory
2. Update the `<title>` and meta tags in `index.html`
3. Customize `assets/styles.css` for project-specific styles
4. Add your project-specific JavaScript
5. Deploy!

## Shared Components

The template automatically loads:
- **Header**: Navigation with theme toggle
- **Footer**: Links and branding
- **Breadcrumbs**: Automatic breadcrumb generation
- **Theme System**: Dark/light mode support
- **Utilities**: Helper functions in `Supm3nUtils`

## Customization

### Disable Components

```javascript
await Supm3nComponents.init({
  header: true,
  footer: true,
  breadcrumbs: false, // Disable breadcrumbs
  styles: false,
  utils: true
});
```

### Using Utilities

```javascript
// Escape HTML
const safe = Supm3nUtils.escapeHtml(userInput);

// Format names
const formatted = Supm3nUtils.formatName('my-project'); // "My Project"

// Debounce
const debounced = Supm3nUtils.debounce(() => {
  // Your function
}, 300);
```

## File Structure

```
project-name/
├── index.html          # Main HTML file
├── assets/
│   ├── styles.css      # Project-specific styles
│   └── script.js       # Project-specific JavaScript
├── functions/          # Cloudflare Functions (optional)
└── wrangler.toml       # Cloudflare Pages config
```

## Styling

Use CSS variables for consistent theming:

```css
.my-element {
  background: var(--color-surface-1);
  color: var(--color-text-primary);
  padding: var(--space-md);
  border-radius: 12px;
  border: 1px solid var(--glass-border);
}
```

## Navigation

The header automatically includes:
- Link back to main site (supm3n.com)
- Navigation to Projects page
- Theme toggle button

Breadcrumbs automatically generate based on the current page path.

