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

## 🚀 Getting Started

To run this portfolio locally, you need Node.js installed.

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/supm3n/supm3n.git](https://github.com/supm3n/supm3n.git)
    cd supm3n
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The site will be available at `http://localhost:4321`.

4.  **Environment Variables:**
    Create a `.env` file in the root for API keys (e.g., for the Stock Viewer):
    ```env
    ALPHA_KEY=your_alpha_vantage_key
    ```

## 🛠 How to Add a New Tool

This is a monorepo structure. To add a new mini-project:

1.  Create a new directory in `src/pages/my-new-tool`.
2.  Create an `index.astro` file inside that folder.
3.  Import the `MainLayout` to keep styling consistent.
4.  Add the project metadata to `src/pages/projects.astro` so it appears in the grid.