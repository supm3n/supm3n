# Supm3n Project Template

This template uses the monorepo's central build system (`build.js`) to automatically inject the shared header and footer.

## Quick Start

1.  **Copy this directory** to `projects/your-new-project`.
2.  **Add your project to `build.js`**: Open the root `build.js` file and add your project to the `projects` array:
    ```javascript
    const projects = [
      // ... other projects
      { name: 'your-new-project', path: 'projects/your-new-project' }
    ];
    ```
3.  **Update `index.html`**:
    * It already contains `{{HEADER_PLACEHOLDER}}` and `{{FOOTER_PLACEHOLDER}}`. Leave these as-is.
    * Update your `<title>` and `<meta name="description">` tags.
    * Add your project's content to the `<main>` section.
4.  **Add your scripts/styles** in the `assets/` folder.
5.  **Add Theme Toggle (Required)**: Make sure the theme script is in the `<head>` and the toggle handler script is at the bottom of `index.html` (they are already in this template).

## Shared Resources

Your page's `<head>` should load the shared assets:

```html
<link rel="stylesheet" href="[https://supm3n.com/shared/styles/variables.css?v=YYYYMMDD](https://supm3n.com/shared/styles/variables.css?v=YYYYMMDD)">
<script type="module" src="[https://supm3n.com/shared/scripts/theme.js?v=YYYYMMDD](https://supm3n.com/shared/scripts/theme.js?v=YYYYMMDD)"></script>

<script src="[https://supm3n.com/shared/scripts/utils.js?v=YYYYMMDD](https://supm3n.com/shared/scripts/utils.js?v=YYYYMMDD)"></script>

<link rel="stylesheet" href="[https://supm3n.com/shared/styles/components.css?v=YYYYMMDD](https://supm3n.com/shared/styles/components.css?v=YYYYMMDD)">
And your <body> should include the theme click handler at the end:

HTML

  <script type="module">
    import { toggleTheme } from '[https://supm3n.com/shared/scripts/theme.js?v=YYYYMMDD](https://supm3n.com/shared/scripts/theme.js?v=YYYYMMDD)';
    (document.getElementById('theme-toggle')
      || document.getElementById('themeToggle')
      || document.querySelector('[data-theme-toggle]'))
      ?.addEventListener('click', toggleTheme);
  </script>
Deployment
Create a new Cloudflare Pages project.

Set the Root directory to /.

Set the Build command to npm install && node build.js.

Set the Build output directory to dist/your-new-project.

Attach your custom domain.