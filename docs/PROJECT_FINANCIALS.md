# **Project: Financial Analysis Dashboard**

## **1\. Overview**

This module is a financial data visualization tool integrated into the supm3n Astro website. It displays historical fundamental data (Revenue, Net Income, Margins, Cash Flow) for 9 major US tech companies ("The Big 9").

URL: /financial-analysis  
Goal: Provide a "glass-morphism" tech-aesthetic dashboard for fundamental analysis, backed by a serverless SQL database.

## **2\. Architecture & Tech Stack**

### **Stack**

* **Framework:** Astro (Static Site Generation)  
* **Styling:** CSS Variables (Global Theme) \+ Scoped CSS  
* **Database:** Cloudflare D1 (Serverless SQLite)  
* **Backend:** Cloudflare Pages Functions (/functions directory)  
* **Visualization:** Chart.js  
* **Deployment:** Cloudflare Pages

### **Data Flow**

1. **Source:** Historical data is sourced from SEC FSDS filings, processed into a CSV (company\_quarterly\_big9\_resolved\_v2.csv).  
2. **Ingestion:** CSV is converted to SQL (src/scripts/convert-csv-to-sql.js) and seeded into D1.  
3. **API:** The frontend requests data via /api/financials/\[ticker\].  
4. **Edge Function:** The API function queries the D1 database and returns JSON.  
5. **Frontend:** Javascript fetches JSON and renders Chart.js canvases.

## **3\. Database Schema (Cloudflare D1)**

Binding Name: DB (Accessed in code via env.DB)  
Table Name: company\_quarterly

| Column | Type | Description |
| :---- | :---- | :---- |
| ticker | TEXT | Stock Symbol (e.g., "NVDA") |
| company\_name | TEXT | Full legal name |
| cik | INTEGER | SEC Central Index Key |
| adsh | TEXT | **PRIMARY KEY**. SEC Accession Number (Unique Filing ID) |
| form | TEXT | "10-Q" or "10-K" |
| fy | INTEGER | Fiscal Year |
| fp | TEXT | Fiscal Period ("Q1", "Q2", "Q3", "FY") |
| period\_end | TEXT | Date (YYYY-MM-DD) of period end |
| filed\_at | TEXT | Date (YYYY-MM-DD) of filing |
| revenue | REAL | Revenue in USD |
| operating\_income | REAL | Operating Income in USD |
| net\_income | REAL | Net Income in USD |
| diluted\_eps | REAL | Diluted EPS in USD |
| operating\_cash\_flow | REAL | Operating Cash Flow in USD |
| capex | REAL | Capital Expenditures in USD |
| net\_margin | REAL | Calculated: Net Income / Revenue |
| operating\_margin | REAL | Calculated: Op Income / Revenue |
| free\_cash\_flow | REAL | Calculated: OCF \- Capex |

## **4\. Key Files & Directory Structure**

/  
├── company\_quarterly\_big9\_resolved\_v2.csv  \# SOURCE TRUTH (Do not edit manually)  
├── wrangler.toml                           \# Cloudflare Config (D1 Binding)  
├── functions/  
│   └── api/  
│       └── financials/  
│           └── \[ticker\].js                \# Edge API Endpoint (Queries D1)  
└── src/  
    ├── pages/  
    │   └── financial-analysis/  
    │       └── index.astro                 \# Main Dashboard Page  
    ├── scripts/  
    │   ├── convert-csv-to-sql.js           \# ETL Script (CSV \-\> SQL)  
    │   └── financial-charts.js             \# Chart.js Logic & Config  
    ├── styles/  
    │   └── financials.css                  \# Dashboard specific styling  
    └── seed\_financials.sql                 \# Generated SQL Seed file (Artifact)

## **5\. Operational Workflows**

### **A. Initial Setup / Resetting Database**

If the schema changes or data is corrupted, follow this reset procedure:

1. Generate SQL from CSV:  
   The conversion script handles Windows line-endings and batches inserts to avoid SQLite limits.  
   node src/scripts/convert-csv-to-sql.js

2. **Execute Seed (Local):**  
   npx wrangler d1 execute supm3n-db \--local \--file=src/seed\_financials.sql

3. **Execute Seed (Production/Remote):**  
   npx wrangler d1 execute supm3n-db \--remote \--file=src/seed\_financials.sql

### **B. Local Development**

Because this project uses Cloudflare-specific bindings (env.DB), standard npm run dev will **not** work for API calls.

**Correct Command:**

\# Builds the static site to /dist and serves it with D1 binding  
npm run build  
npx wrangler pages dev dist \--local \--d1 supm3n-db

### **C. Deployment**

Pushing to the main branch on GitHub triggers Cloudflare Pages.

* **Requirement:** wrangler.toml must contain the correct database\_id for the production database.  
* **Requirement:** The production D1 database must have been seeded via the \--remote command (see Workflow A).

## **6\. Future Integration: SEC API (Planned)**

Current Status: Manual CSV Ingestion.  
Planned Status: Automated fetching via sec-api.io.  
**Implementation Logic (To be built):**

1. **Trigger:** Scheduled Worker (Cron) or Admin Button.  
2. **Check:** Query MAX(filed\_at) for each ticker in D1.  
3. **Fetch:** Call SEC API for filings \> last\_filed\_at.  
4. **Parse:** Map XBRL tags to the schema (Revenue, Net Income, etc.).  
5. **Insert:** INSERT INTO company\_quarterly ... directly into D1.

**Crucial Note:** The database schema was designed to be agnostic. It does not care if the row came from the historical CSV or the live API, as long as the adsh (Accession Number) is unique.

## **7\. Troubleshooting Common Errors**

**Error: SQLITE\_TOOBIG**

* **Cause:** Too many rows in a single INSERT statement.  
* **Fix:** Ensure src/scripts/convert-csv-to-sql.js is using batching (e.g., 50 rows per batch).

**Error: near ")": syntax error**

* **Cause:** Windows \\r\\n line endings in the CSV leaving a hanging carriage return.  
* **Fix:** Ensure the conversion script uses .trim() on raw file content and rows.

**Error: GET /api/financials/... 500 Internal Server Error**

* **Cause:** D1 Database not bound.  
* **Fix:** Check wrangler.toml has binding \= "DB". If local, ensure \--d1 supm3n-db flag is used.