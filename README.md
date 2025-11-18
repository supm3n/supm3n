# Supm3n Portfolio & Monorepo

This repository hosts the personal portfolio and hobby projects for **Supm3n**. It serves as a monorepo for various web tools and games, migrated from a Vanilla JS setup to **Astro** for better performance and maintainability.

![Astro](https://img.shields.io/badge/astro-%232C2052.svg?style=for-the-badge&logo=astro&logoColor=white)
![Cloudflare Pages](https://img.shields.io/badge/Cloudflare%20Pages-F38020?style=for-the-badge&logo=Cloudflare%20Pages&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)

## 🏗 Architecture

The site acts as a shell for multiple independent mini-projects. It uses **Astro** for the static site generation (SSG) and **Cloudflare Pages Functions** for server-side logic (API proxying).

-   **Framework:** [Astro](https://astro.build) (Static Build)
-   **Styling:** Global CSS variables (Theme) + Scoped Component Styles.
-   **Deployment:** Cloudflare Pages (Git Integration).
-   **Backend:** Cloudflare Functions (`/functions` directory) running on the Edge.

## 📂 Directory Structure

For AI Context: Projects are located in `src/pages/[project-name]`. Shared logic is in `src/layouts`.

```text
/
├── functions/              # Cloudflare Edge Functions (Backend API)
│   └── api/
│       └── price/          # Stock Viewer API Proxy & Caching
├── public/                 # Static assets (icons, logos, manifest)
├── src/
│   ├── components/         # Shared UI (Header, Footer)
│   ├── layouts/            # MainLayout (Handles <head>, Theme, Navigation)
│   ├── scripts/            # Client-side logic (Theme toggling)
│   ├── styles/             # Global CSS and Variables
│   └── pages/              # Routes
│       ├── index.astro     # Landing Page
│       ├── projects.astro  # Project directory list
│       ├── settleup/       # Project: SettleUp (Expense Splitter)
│       ├── snake/          # Project: Snake Game
│       └── stock-viewer/   # Project: Stock Chart Viewer
└── astro.config.mjs        # Astro configuration