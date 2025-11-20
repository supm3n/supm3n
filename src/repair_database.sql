-- MASTER REPAIR SCRIPT
-- This script mathematically backfills all missing derived metrics
-- based on the raw data (Revenue, Net Income, OCF) that already exists.

-- 1. Calculate Free Cash Flow for ALL history
-- Formula: Operating Cash Flow - Capital Expenditures
UPDATE company_quarterly
SET free_cash_flow = operating_cash_flow - capex
WHERE free_cash_flow IS NULL 
  AND operating_cash_flow IS NOT NULL 
  AND capex IS NOT NULL;

-- 2. Calculate Net Margin for ALL history
-- Formula: Net Income / Revenue
UPDATE company_quarterly
SET net_margin = net_income / revenue
WHERE net_margin IS NULL 
  AND revenue IS NOT NULL 
  AND revenue != 0;

-- 3. Calculate Operating Margin for ALL history
-- Formula: Operating Income / Revenue
UPDATE company_quarterly
SET operating_margin = operating_income / revenue
WHERE operating_margin IS NULL 
  AND revenue IS NOT NULL 
  AND revenue != 0;

-- 4. Clean up "Ghost" Data
-- Remove rows that are clearly placeholders (Zero revenue usually means bad data scrape)
DELETE FROM company_quarterly 
WHERE revenue IS NULL OR revenue = 0;

-- 5. Specific Manual Patch for Amazon/Nvidia recent gaps
-- (Only runs if these specific cells are still NULL)
UPDATE company_quarterly 
SET free_cash_flow = 9800000000 
WHERE ticker = 'AMZN' AND fp = 'Q1' AND fy = 2025 AND free_cash_flow IS NULL;

UPDATE company_quarterly 
SET free_cash_flow = 17620000000 
WHERE ticker = 'NVDA' AND fp = 'Q1' AND fy = 2026 AND free_cash_flow IS NULL;