-- Complete FCF Patch from Financial Data stock analysis.com.txt
-- All values in millions converted to actual dollars (* 1,000,000)
-- Applies ONLY to quarters where we have reference data

-- NVIDIA FCF Updates  (line 89 from reference file)
-- Q3 2026 (Oct 26, 2025) = 22,113 million - Already done as test
-- Q2 2026 (Jul 27, 2025) = 13,470 million - Already done as test  
-- Q1 2026 (Apr 27, 2025) = 26,187 million - Already done as test (was 22,113, corrected)
UPDATE company_quarterly SET free_cash_flow = 26187000000 WHERE ticker = 'NVDA' AND period_end = '2025-04-30';

-- Q4 2025 (Jan 26, 2025) = 15,552 million
UPDATE company_quarterly SET free_cash_flow = 15552000000 WHERE ticker = 'NVDA' AND period_end = '2025-01-31';

-- Q3 2025 (Oct 27, 2024) = 16,814 million  
UPDATE company_quarterly SET free_cash_flow = 16814000000 WHERE ticker = 'NVDA' AND period_end = '2024-10-31';

-- Q2 2025 (Jul 28, 2024) = 13,511 million
UPDATE company_quarterly SET free_cash_flow = 13511000000 WHERE ticker = 'NVDA' AND period_end = '2024-07-31';

-- Q1 2025 (Apr 28, 2024) = 14,976 million
UPDATE company_quarterly SET free_cash_flow = 14976000000 WHERE ticker = 'NVDA' AND period_end = '2024-04-30';

-- Q4 2024 (Jan 28, 2024) = 11,245 million
UPDATE company_quarterly SET free_cash_flow = 11245000000 WHERE ticker = 'NVDA' AND period_end = '2024-01-31';

-- Q3 2024 (Oct 29, 2023) = 7,054 million
UPDATE company_quarterly SET free_cash_flow = 7054000000 WHERE ticker = 'NVDA' AND period_end = '2023-10-31';

-- Q2 2024 (Jul 30, 2023) = 6,059 million
UPDATE company_quarterly SET free_cash_flow = 6059000000 WHERE ticker = 'NVDA' AND period_end = '2023-07-31';

-- Q1 2024 (Apr 30, 2023) = 2,663 million
UPDATE company_quarterly SET free_cash_flow = 2663000000 WHERE ticker = 'NVDA' AND period_end = '2023-04-30';

-- Q4 2023 (Jan 29, 2023) = 1,739 million
UPDATE company_quarterly SET free_cash_flow = 1739000000 WHERE ticker = 'NVDA' AND period_end = '2023-01-31';

-- Q3 2023 (Oct 30, 2022) = -138 million (negative!)
UPDATE company_quarterly SET free_cash_flow = -138000000 WHERE ticker = 'NVDA' AND period_end = '2022-10-31';

-- Q2 2023 (Jul 31, 2022) = 837 million
UPDATE company_quarterly SET free_cash_flow = 837000000 WHERE ticker = 'NVDA' AND period_end = '2022-07-31';

-- Q1 2023 (May 1, 2022) = 1,370 million
UPDATE company_quarterly SET free_cash_flow = 1370000000 WHERE ticker = 'NVDA' AND period_end = '2022-04-30';

-- Q4 2022 (Jan 30, 2022) = 2,760 million
UPDATE company_quarterly SET free_cash_flow = 2760000000 WHERE ticker = 'NVDA' AND period_end = '2022-01-31';

-- Q3 2022 (Oct 31, 2021) = 1,297 million  
UPDATE company_quarterly SET free_cash_flow = 1297000000 WHERE ticker = 'NVDA' AND period_end = '2021-10-31';

-- Q2 2022 (Aug 1, 2021) = 2,499 million
UPDATE company_quarterly SET free_cash_flow = 2499000000 WHERE ticker = 'NVDA' AND period_end = '2021-07-31';

-- Q1 2022 (May 2, 2021) = 1,576 million
UPDATE company_quarterly SET free_cash_flow = 1576000000 WHERE ticker = 'NVDA' AND period_end = '2021-04-30';

-- Q4 2021 (Jan 31, 2021) = 1,784 million
UPDATE company_quarterly SET free_cash_flow = 1784000000 WHERE ticker = 'NVDA' AND period_end = '2021-01-31';

-- Note: AAPL and AMZN FCF data not available in the reference file
-- The file only contains NVIDIA financial data
