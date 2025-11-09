# Theme System Documentation

## Overview

The Supm3n portfolio uses a unified theme system that allows users to toggle between light and dark modes across all projects. The theme preference is persisted in localStorage and synchronized across all subdomains.

## How It Works

### 1. Theme Toggle Script

**Location**: `landingpage/shared/scripts/theme.js`

The theme toggle script:
- Sets `data-theme="light"` or `data-theme="dark"` on the `<html>` element
- Stores preference in `localStorage.getItem('theme')`
- Respects system preference if no saved preference exists
- Updates the theme icon (sun/moon) in the header

### 2. CSS Variable System

**Location**: `landingpage/shared/styles/variables.css`

The shared CSS variables file defines:
- Dark mode colors (default)
- Light mode color overrides
- System preference fallback

**Key Variables:**
```css
:root {
  --color-base: #0B0C10;              /* Dark background */
  --color-surface-1: #0F1115;         /* Dark surface */
  --color-text-primary: #E6E9F0;      /* Light text */
  /* ... more variables ... */
}

[data-theme="light"] {
  --color-base: var(--color-base-light);      /* Light background */
  --color-surface-1: var(--color-surface-1-light);
  --color-text-primary: var(--color-text-primary-light);
  /* ... more overrides ... */
}
```

### 3. Project Implementation

Each project must implement theme support by:

#### A. Loading Shared Variables

Projects should load the shared variables CSS:
```html
<link rel="stylesheet" href="https://supm3n.com/shared/styles/variables.css?v=20251108">
```

#### B. Defining Theme-Aware CSS

Projects must define light mode overrides using the `[data-theme="light"]` selector:

```css
/* Default (dark mode) */
:root {
  --bg: #0b0c10;
  --fg: #e6e9f0;
  --card: #151820;
}

/* Light mode override */
[data-theme="light"] {
  --bg: #fafafa;
  --fg: #0b0c10;
  --card: #ffffff;
}

/* System preference fallback (optional but recommended) */
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    --bg: #fafafa;
    --fg: #0b0c10;
    --card: #ffffff;
  }
}
```

#### C. Using CSS Variables

All color values should use CSS variables, not hardcoded colors:

```css
/* ✅ Good - uses variables */
body {
  background: var(--bg);
  color: var(--fg);
}

.card {
  background: var(--card);
  border: 1px solid var(--glass-border);
}

/* ❌ Bad - hardcoded colors */
body {
  background: #0b0c10;  /* Won't change with theme */
  color: #e6e9f0;
}
```

## Implementation Examples

### Example 1: Stock Viewer

**File**: `stock-viewer/assets/styles.css`

```css
:root { 
  --bg:#0b0c10; 
  --fg:#e6e9f0; 
  --card:#151820; 
  --surface-1:#0f1115;
  --glass-border:rgba(255,255,255,.08);
}

/* Light mode overrides */
[data-theme="light"] {
  --bg:#fafafa;
  --fg:#0b0c10;
  --card:#ffffff;
  --surface-1:#f5f5f5;
  --glass-border:rgba(0,0,0,.08);
}

/* System preference fallback */
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    --bg:#fafafa;
    --fg:#0b0c10;
    --card:#ffffff;
    --surface-1:#f5f5f5;
    --glass-border:rgba(0,0,0,.08);
  }
}
```

**Cache Busting**: The CSS file is loaded with a version query string:
```html
<link rel="stylesheet" href="/assets/styles.css?v=20251109">
```

### Example 2: Settleup

**File**: `settleup/styles.css`

```css
:root {
  /* Use shared color variables from the main site */
  --bg: var(--color-base, #0B0C10);
  --panel-bg: var(--color-surface-1, #0F1115);
  --text: var(--color-text-primary, #E6E9F0);
  --muted: var(--color-text-muted, #A9B1C6);
}

/* Light mode overrides */
[data-theme="light"] {
  --bg: var(--color-base-light, #FAFAFA);
  --panel-bg: var(--color-surface-1-light, #FFFFFF);
  --text: var(--color-text-primary-light, #0B0C10);
  --muted: var(--color-text-muted-light, #4A5568);
}
```

**Note**: Settleup references shared variables with fallback values, ensuring it works even if shared CSS fails to load.

## Common Issues and Solutions

### Issue 1: Theme Toggle Only Changes Header

**Symptom**: Clicking theme toggle changes header colors but not page content.

**Cause**: Project CSS doesn't have `[data-theme="light"]` selector.

**Solution**: Add light mode overrides to project CSS file:
```css
[data-theme="light"] {
  /* Override all color variables */
}
```

### Issue 2: CSS Changes Not Reflecting

**Symptom**: Updated CSS doesn't appear after deployment.

**Cause**: Browser cache is serving old CSS file.

**Solution**: 
1. Add cache-busting query string to CSS link: `?v=20251109`
2. Increment version number when CSS changes
3. Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)

### Issue 3: Theme Doesn't Persist

**Symptom**: Theme resets to default on page reload.

**Cause**: Theme script not loaded or localStorage blocked.

**Solution**: 
1. Ensure `theme.js` is loaded: `<script src="https://supm3n.com/shared/scripts/theme.js"></script>`
2. Check browser console for errors
3. Verify localStorage is enabled in browser

### Issue 4: Inconsistent Colors Across Projects

**Symptom**: Different projects show different shades of the same color.

**Cause**: Projects using hardcoded colors instead of shared variables.

**Solution**: 
1. Replace hardcoded colors with CSS variables
2. Use shared variables from `variables.css` when possible
3. Define project-specific variables that reference shared ones

## Best Practices

1. **Always Use CSS Variables**: Never hardcode colors in CSS
2. **Define Light Mode Overrides**: Always include `[data-theme="light"]` selector
3. **Use Shared Variables**: Reference `variables.css` variables when possible
4. **Cache Busting**: Add version query strings to CSS files
5. **Test Both Themes**: Verify light and dark modes work correctly
6. **System Preference**: Include `@media (prefers-color-scheme: light)` fallback
7. **Fallback Values**: Provide fallback colors in `var()` calls: `var(--color-base, #0B0C10)`

## Testing Checklist

When implementing theme support in a new project:

- [ ] Theme toggle button is visible in header
- [ ] Clicking toggle switches between light/dark modes
- [ ] All page elements change color (not just header)
- [ ] Theme preference persists after page reload
- [ ] Theme respects system preference on first visit
- [ ] CSS variables are used (no hardcoded colors)
- [ ] Light mode overrides are defined
- [ ] System preference fallback is included
- [ ] Cache-busting version is set on CSS file
- [ ] Works across different browsers

## Files Reference

- **Theme Script**: `landingpage/shared/scripts/theme.js`
- **Shared Variables**: `landingpage/shared/styles/variables.css`
- **Shared Components CSS**: `landingpage/shared/styles/components.css`
- **Stock Viewer CSS**: `stock-viewer/assets/styles.css`
- **Settleup CSS**: `settleup/styles.css`

## Related Documentation

- See `PROJECT_SUMMARY.md` for overall project structure
- See `IMPROVEMENTS.md` for future enhancements
- See component documentation for header/footer implementation

