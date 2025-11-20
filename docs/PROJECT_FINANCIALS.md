Project: Financial Analysis Dashboard

1. Overview

This module is a financial data visualization tool integrated into the supm3n Astro website. It displays historical fundamental data (Revenue, Net Income, Margins, Cash Flow) for 9 major US tech companies ("The Big 9").

URL: /financial-analysis
Goal: Provide a "glass-morphism" tech-aesthetic dashboard for fundamental analysis, backed by a serverless SQL database.

2. Architecture & Tech Stack

Stack

Framework: Astro (Static Site Generation)

Styling: CSS Variables (Global Theme) + Scoped CSS

Database: Cloudflare D1 (Serverless SQLite)

Backend: Cloudflare Pages Functions (/functions directory)

Visualization: Chart.js

Deployment: Cloudflare Pages

Data Flow

Source: Historical data is sourced from SEC FSDS filings, processed into a CSV (company_quarterly_big9_resolved_v2.csv).

Ingestion: CSV is converted to SQL (src/scripts/convert-csv-to-sql.js) and seeded into D1.

API (Read): The frontend requests data via /api/financials/[ticker]. This edge function queries D1 and returns JSON.

API (Write/Update): A secured cron function (/api/cron/update) queries sec-api.io for new filings and updates D1.

Frontend: Javascript fetches JSON and renders Chart.js canvases.

3. Database Schema (Cloudflare D1)

Binding Name: DB (Accessed in code via env.DB)
Table Name: company_quarterly

Column

Type

Description

ticker

TEXT

Stock Symbol (e.g., "NVDA")

company_name

TEXT

Full legal name

cik

INTEGER

SEC Central Index Key

adsh

TEXT

PRIMARY KEY. SEC Accession Number (Unique Filing ID)

form

TEXT

"10-Q" or "10-K"

fy

INTEGER

Fiscal Year

fp

TEXT

Fiscal Period ("Q1", "Q2", "Q3", "FY")

period_end

TEXT

Date (YYYY-MM-DD) of period end

filed_at

TEXT

Date (YYYY-MM-DD) of filing

revenue

REAL

Revenue in USD

operating_income

REAL

Operating Income in USD

net_income

REAL

Net Income in USD

diluted_eps

REAL

Diluted EPS in USD

operating_cash_flow

REAL

Operating Cash Flow in USD

capex

REAL

Capital Expenditures in USD

net_margin

REAL

Calculated: Net Income / Revenue

operating_margin

REAL

Calculated: Op Income / Revenue

free_cash_flow

REAL

Calculated: OCF - Capex

4. Key Files & Directory Structure

/
├── company_quarterly_big9_resolved_v2.csv  # SOURCE TRUTH (Historical Data)
├── wrangler.toml                           # Cloudflare Config (D1 Binding)
├── functions/
│   └── api/
│       ├── financials/
│       │   └── [ticker].js                # Public Read API
│       └── cron/
│           └── update.js                  # Secured Write/Update API
└── src/
    ├── components/
    │   └── DashboardControls.astro             # Hidden Admin UI (Ctrl+Shift+U)
    ├── layouts/
    │   └── MainLayout.astro                # Includes DashboardControls
    ├── pages/
    │   └── financial-analysis/
    │       └── index.astro                 # Main Dashboard Page
    ├── scripts/
    │   ├── convert-csv-to-sql.js           # ETL Script (CSV -> SQL)
    │   ├── financial-charts.js             # Chart.js Logic
    │   └── sec-logic.js                    # (Reference) Parsing Logic
    └── seed_financials.sql                 # Generated SQL Seed file


5. Operational Workflows

A. Initial Setup / Resetting Database

If the schema changes or data is corrupted, follow this reset procedure:

Generate SQL from CSV:
The conversion script handles Windows line-endings and batches inserts.

node src/scripts/convert-csv-to-sql.js


Execute Seed (Production):

npx wrangler d1 execute supm3n-db --remote --file=src/seed_financials.sql


B. Update Logic (The "Sniper" System)

To save API credits (limit 100), the system uses a "Sniper" query strategy via functions/api/cron/update.js.

Check DB: Query D1 for the global MAX(filed_at) date.

Single API Call: Query sec-api.io for filings newer than that date for the target tickers.

Filter: If a filing exists in D1 (by adsh), skip it.

Download: Only fetch XBRL JSON for truly new filings.

Parse & Insert: Extract metrics using strict tag priority and fiscal year logic.

Fiscal Year Logic:

AAPL: FY ends Sept. (Oct = FY+1)

MSFT: FY ends June. (July = FY+1)

NVDA: FY ends Jan. (Feb = FY+1)

Others: Calendar Year.

C. Triggering Updates (Admin Mode)

The update process is manual to control costs.

Go to https://supm3n.com (or any page).

Press Ctrl + Shift + U.

Enter the CRON_SECRET password.

Click "Scan Updates".

View logs in the modal window.

6. Deployment & Secrets

Secrets Required (Cloudflare Dashboard):

SEC_API_KEY: Your sec-api.io token.

CRON_SECRET: A custom password to protect the update button.

Deployment Command:

npm run build
git add .
git commit -m "deploy: update"
git push


Configuration (wrangler.toml):
Ensure the project points to the correct D1 database ID.

[[d1_databases]]
binding = "DB"
database_name = "supm3n-db"
database_id = "99747b6f-466d-4c63-956c-c01e2ffcb21f"


7. Troubleshooting

Error: DashboardControls is not defined

Fix: Ensure src/layouts/MainLayout.astro has the import statement AND the <DashboardControls /> tag inside the body.

Error: SQLITE_TOOBIG

Fix: Ensure src/scripts/convert-csv-to-sql.js uses batching (50 rows).

Error: Duplicate Data / Wrong Quarter

Fix: Check functions/api/cron/update.js. Ensure the getFiscalPeriod function logic matches the reference in src/scripts/sec-logic.js.

Error: Unauthorized (401)

Fix: Re-enter the CRON_SECRET in the Admin modal, or update it in Cloudflare Settings.