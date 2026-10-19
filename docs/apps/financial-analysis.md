# Financial Analysis

Quarterly fundamentals (revenue, net income, margins, EPS, cash flow) for 9 large US tech companies, charted with Chart.js. Route: `/financial-analysis`.

## Files
| Path | Role |
|---|---|
| `src/pages/financial-analysis/index.astro` | Page, ticker picker, summary stats |
| `src/scripts/financial-charts.js` | Chart.js setup |
| `src/styles/financials.css` | Styles |
| `functions/api/financials/[ticker].js` | Read API (D1) |
| `functions/api/cron/update.js` | Pulls new filings from sec-api.io into D1 (`?key=CRON_SECRET`) |
| `src/components/DashboardControls.astro` | Hidden admin panel (Ctrl+Shift+U) that calls the update |
| `company_quarterly_big9_resolved_v2.csv` | Source history (SEC FSDS-derived) |
| `src/scripts/convert-csv-to-sql.js` | CSV → `src/seed_financials.sql` (batched inserts, 50 rows) |
| `scripts/verify_financials.js` | Compares a D1 dump with `docs/reference/` data and writes `patches/fix_financial_data.sql` |
| `src/scripts/sec-logic.js` | Reference parsing logic; not imported (the cron has its own copy) |

## Table `company_quarterly` (D1 `supm3n-db`, binding `DB`)
Primary key `adsh` (SEC accession no.). Columns: `ticker, company_name, cik, form ("10-Q"/"10-K"), fy, fp ("Q1".."Q3"/"FY"), period_end, filed_at, revenue, operating_income, net_income, diluted_eps, operating_cash_flow, capex, net_margin, operating_margin, free_cash_flow` (USD; margins and FCF are computed).

## Updating data
1. Open any page and press Ctrl+Shift+U.
2. Enter `CRON_SECRET`, then click "Scan Updates".
3. The cron reads `MAX(filed_at)`, asks sec-api.io for newer filings (10 per run), skips known `adsh`, and parses XBRL with fixed tag priority.

Fiscal years: AAPL ends Sept, MSFT ends June, NVDA ends Jan (Feb = FY+1); everyone else uses the calendar year (`FISCAL_OFFSETS` in the cron).

Full reseed:
```bash
node src/scripts/convert-csv-to-sql.js
npx wrangler d1 execute supm3n-db --remote --file=src/seed_financials.sql
```

## Known issues
- Data is only as fresh as the last manual update. As of 2026-10 the latest rows are from mid-2025.
- The read API returns `10-Q` rows only, so Q4 is always missing and year boundaries skip a quarter.
- The "vs previous" deltas compare against the previous row (quarter over quarter), not year over year.
- Missing EPS/CapEx are plotted as 0 instead of gaps.

## Troubleshooting
- `SQLITE_TOOBIG` on seed: keep the converter's 50-row batching.
- 401 from update: wrong `CRON_SECRET` (re-enter it, or reset it in Cloudflare settings).
- Wrong quarter/duplicates: check `getFiscalPeriod` in the cron.
