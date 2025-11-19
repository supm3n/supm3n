### CONTRIBUTING.md (Developer Guide)

```markdown
# Developer Guide

## 📂 Project Architecture

### Frontend (Astro)
-   **Global Visuals:** The site uses a global `<canvas>` element for the "Particle Network" background. This is initialized in `src/layouts/MainLayout.astro`.
-   **Theme System:** Located in `src/styles/theme.css`. This file defines the "Deep Space" palette, Glassmorphism variables (`--glass-bg`), and Glitch effect colors.
-   **Components:**
    -   `Header.astro`: Sticky glassmorphic navigation.
    -   `ProjectCard.astro`: Implements a JS-based "Spotlight" effect where borders glow based on mouse position.
    -   `Footer.astro`: Minimalist sitemap with a large watermark.

### Styling Guidelines
When adding new pages (like SettleUp or Snake), ensure containers use the glass variables to remain readable over the moving background:
-   **Background:** Use `var(--glass-bg)` or `rgba(0,0,0,0.8)` for contrast.
-   **Backdrop:** Always add `backdrop-filter: blur(12px)` to panels.
-   **Text:** Use `var(--color-text-primary)` and `var(--color-text-muted)`.

### Backend (Cloudflare Functions)
We use Cloudflare Pages Functions for server-side logic to avoid exposing API keys on the client.

-   **Location:** `/functions/api/`
-   **Stock API:** The stock viewer proxies requests to Alpha Vantage via `functions/api/price/[symbol].js`.
-   **Caching:** Responses are cached using the Cache API to prevent hitting rate limits.

## 🧪 Testing
-   **SettleUp:** Contains an internal sanity test function `runTests()` accessible via the browser console.