// src/scripts/sec-logic.js

/**
 * 1. FISCAL CALENDAR CONFIG
 * Defines the month offset to calculate strict FY/FP.
 * Offset = Number of months to SUBTRACT from calendar month to get fiscal month.
 * If result is negative, we wrap around.
 */
const FISCAL_OFFSETS = {
    "AAPL": 9,  // FY ends Sept (Month 9). Oct (10) is Q1.
    "MSFT": 6,  // FY ends June (Month 6). July (7) is Q1.
    "NVDA": 1,  // FY ends Jan (Month 1). Feb (2) is Q1.
    // AMZN, GOOGL, META, TSLA, AVGO*, BRK.B are mostly Calendar or close enough 
    // *AVGO ends Oct/Nov usually, but we'll treat standard for simplicity unless strict.
    "DEFAULT": 0
};

export function getFiscalPeriod(ticker, periodEndDate) {
    const date = new Date(periodEndDate);
    const calMonth = date.getMonth() + 1; // 1-12
    const calYear = date.getFullYear();

    const offset = FISCAL_OFFSETS[ticker] || 0;

    // Fiscal Month calculation (1-12)
    let fiscalMonth = calMonth - offset;
    let fiscalYear = calYear;

    if (fiscalMonth <= 0) {
        fiscalMonth += 12;
        // If the fiscal month wrapped around, usually the FY is the *next* calendar year
        // e.g. Apple Oct 2023 is Q1 2024.
        if (offset > 0) fiscalYear += 1;
    } else {
        // Special case for NVDA: Jan 2025 is FY2025. Feb 2024 is Q1 2025.
        // If offset is small (like 1), wrapping logic handles it.
    }

    // Determine Quarter
    let fp = 'Q?';
    if (fiscalMonth <= 3) fp = 'Q1';
    else if (fiscalMonth <= 6) fp = 'Q2';
    else if (fiscalMonth <= 9) fp = 'Q3';
    else fp = 'Q4';

    return { fy: fiscalYear, fp };
}

/**
 * 2. PRIORITY TAGS (US GAAP)
 */
export const TAGS = {
    revenue: ["RevenueFromContractWithCustomerExcludingAssessedTax", "RevenueFromContractWithCustomerIncludingAssessedTax", "Revenues", "Revenue", "SalesRevenueNet", "NetSales"],
    operating_income: ["OperatingIncomeLoss"],
    net_income: ["NetIncomeLoss", "ProfitLoss"],
    diluted_eps: ["EarningsPerShareDiluted"],
    operating_cash_flow: ["NetCashProvidedByUsedInOperatingActivities"],
    capex: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets", "CapitalExpendituresIncurredButNotYetPaid"]
};

/**
 * 3. DURATION & CONTEXT RESOLVER
 */
export function resolveMetric(xbrlJson, metricName, formType, periodOfReport) {
    const tagList = TAGS[metricName];
    if (!tagList) return null;

    const isAnnual = formType.includes("10-K");
    // 10-K = ~365 days. 10-Q = ~90 days.
    const targetDays = isAnnual ? 360 : 90;

    for (const tag of tagList) {
        const items = xbrlJson[tag];
        if (!items || !Array.isArray(items)) continue;

        const candidate = items.find(item => {
            // 1. Must be USD
            if (item.unit && !item.unit.includes("USD")) return false;

            // 2. Must be Consolidated (No segments)
            // The API returns segment as an object. Empty keys = consolidated.
            if (item.segment && Object.keys(item.segment).length > 0) return false;

            // 3. Duration Check
            // We only care about duration for Flows (Rev, Inc, CF), not Snapshots (Cash)
            if (!item.startTime || !item.endTime) return false; // Skip instant contexts

            const days = (new Date(item.endTime) - new Date(item.startTime)) / (1000 * 3600 * 24);

            // Allow 15 day margin of error (e.g., 89 days vs 92 days)
            if (Math.abs(days - targetDays) > 20) return false;

            // 4. End Date Match
            // The fact must end on the reporting date (approx)
            // Using string comparison usually works if format is YYYY-MM-DD
            if (item.endTime !== periodOfReport) return false;

            return true;
        });

        if (candidate) return parseFloat(candidate.value);
    }
    return null;
}