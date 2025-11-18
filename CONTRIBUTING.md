# Developer Guide

## 📂 Project Architecture

### Frontend (Astro)
-   **Global Styles:** Located in `src/styles/global.css`. Note that SettleUp uses a harmonized theme system via CSS variables found in `theme.css`.
-   **Shared Components:** `Header.astro` and `Footer.astro` are used across all pages.

### Backend (Cloudflare Functions)
We use Cloudflare Pages Functions for server-side logic to avoid exposing API keys on the client.

-   **Location:** `/functions/api/`
-   **Stock API:** The stock viewer proxies requests to Alpha Vantage via `functions/api/price/[symbol].js`.
-   **Caching:** Responses are cached using the Cache API to prevent hitting rate limits.

## 🧪 Testing
-   **SettleUp:** Contains an internal sanity test function `runTests()` accessible via the browser console.