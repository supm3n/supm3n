-- Manual FCF updates for NVDA based on reference data
-- Q3 2026 (Apr 2025) = 22,113 million = 22113000000
UPDATE company_quarterly SET free_cash_flow = 22113000000 WHERE ticker = 'NVDA' AND fp = 'Q1' AND fy = 2026;

-- Q2 2026 (Jan 2025) = 13,470 million = 13470000000  
UPDATE company_quarterly SET free_cash_flow = 13470000000 WHERE ticker = 'NVDA' AND fp = 'Q3' AND fy = 2025;

-- Q1 2026 (Oct 2024) = 15,552 million = 15552000000
UPDATE company_quarterly SET free_cash_flow = 15552000000 WHERE ticker = 'NVDA' AND fp = 'Q2' AND fy = 2025;
