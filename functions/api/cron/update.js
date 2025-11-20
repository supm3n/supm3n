// functions/api/cron/update.js



/**

 * --- INLINED LOGIC FOR STABILITY ---

 * We inline the tag dictionary and fiscal logic here to ensure the Edge Function

 * runs without dependency issues on Cloudflare Pages.

 */



const FISCAL_OFFSETS = {

    "AAPL": 9, "MSFT": 6, "NVDA": 1, "DEFAULT": 0

};



const TAGS = {

    revenue: ["RevenueFromContractWithCustomerExcludingAssessedTax", "RevenueFromContractWithCustomerIncludingAssessedTax", "Revenues", "Revenue", "SalesRevenueNet", "NetSales"],

    operating_income: ["OperatingIncomeLoss"],

    net_income: ["NetIncomeLoss", "ProfitLoss"],

    diluted_eps: ["EarningsPerShareDiluted"],

    operating_cash_flow: ["NetCashProvidedByUsedInOperatingActivities"],

    capex: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets", "CapitalExpendituresIncurredButNotYetPaid"]

};



function getFiscalPeriod(ticker, periodEndDate) {

    const date = new Date(periodEndDate);

    const calMonth = date.getMonth() + 1; // 1-12

    const calYear = date.getFullYear();



    const endMonth = FISCAL_OFFSETS[ticker] || FISCAL_OFFSETS["DEFAULT"];



    let fiscalYear = calYear;

    if (calMonth > endMonth) {

        fiscalYear += 1;

    }



    // Wrap NVDA case (Jan 2025 = FY25)

    if (ticker === "NVDA" && calMonth === 1) fiscalYear = calYear;



    let fiscalMonthIndex = calMonth - endMonth;

    if (fiscalMonthIndex <= 0) fiscalMonthIndex += 12;



    let fp = 'Q?';

    if (fiscalMonthIndex <= 3) fp = 'Q1';

    else if (fiscalMonthIndex <= 6) fp = 'Q2';

    else if (fiscalMonthIndex <= 9) fp = 'Q3';

    else fp = 'Q4';



    return { fy: fiscalYear, fp };

}



function resolveMetric(xbrlJson, metricName, formType, periodOfReport) {

    const tagList = TAGS[metricName];

    if (!tagList) return null;



    const isAnnual = formType.includes("10-K");

    const targetDays = isAnnual ? 360 : 90;



    for (const tag of tagList) {

        const items = xbrlJson[tag];

        if (!items || !Array.isArray(items)) continue;



        const candidate = items.find(item => {

            if (item.unit && !item.unit.includes("USD")) return false;

            if (item.segment && Object.keys(item.segment).length > 0) return false;

            if (!item.startTime || !item.endTime) return false;

            if (item.endTime !== periodOfReport) return false;



            const days = (new Date(item.endTime) - new Date(item.startTime)) / (1000 * 3600 * 24);

            if (Math.abs(days - targetDays) > 20) return false;



            return true;

        });



        if (candidate) return parseFloat(candidate.value);

    }

    return null;

}



export const onRequest = async (context) => {

    const { request, env } = context;

    const url = new URL(request.url);



    const SEC_TOKEN = env.SEC_API_KEY;

    const ADMIN_KEY = env.CRON_SECRET;

    const TARGET_TICKERS = ["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "AVGO", "META", "BRK.B", "TSLA"];



    const key = url.searchParams.get('key');

    if (!ADMIN_KEY || key !== ADMIN_KEY) return new Response("Unauthorized", { status: 401 });

    if (!SEC_TOKEN) return new Response("Server Config Error: Missing SEC_API_KEY", { status: 500 });



    let startDate = "2025-06-01";

    try {

        if (env.DB) {

            const dbRes = await env.DB.prepare("SELECT MAX(filed_at) as d FROM company_quarterly").first();

            if (dbRes && dbRes.d) startDate = dbRes.d;

        }

    } catch (e) { }



    const queryPayload = {

        query: `ticker:(${TARGET_TICKERS.join(' ')}) AND formType:(\"10-Q\", \"10-K\") AND filedAt:{${startDate} TO 2026-12-31}`,

        from: "0",

        size: "10",

        sort: [{ filedAt: { order: "asc" } }]

    };



    try {

        const searchRes = await fetch(`https://api.sec-api.io?token=${SEC_TOKEN}`, {

            method: 'POST',

            body: JSON.stringify(queryPayload),

            headers: { 'Content-Type': 'application/json' }

        });

        const searchJson = await searchRes.json();



        if (!searchJson.filings || searchJson.filings.length === 0) {

            return new Response(JSON.stringify({ status: "No new filings", checked_after: startDate }, null, 2));

        }



        const log = [];



        for (const filing of searchJson.filings) {

            const { ticker, accessionNo, formType, filedAt, periodOfReport, linkToXbrl, companyName, cik } = filing;



            const exists = await env.DB.prepare("SELECT adsh FROM company_quarterly WHERE adsh = ?").bind(accessionNo).first();

            if (exists) {

                log.push({ ticker, result: "Skipped (Duplicate)", adsh: accessionNo });

                continue;

            }



            if (!linkToXbrl) {

                log.push({ ticker, result: "Skipped (No XBRL)" });

                continue;

            }



            const xbrlRes = await fetch(`https://api.sec-api.io/xbrl-to-json?token=${SEC_TOKEN}&xbrlUrl=${linkToXbrl}`);

            const xbrl = await xbrlRes.json();



            const rev = resolveMetric(xbrl, 'revenue', formType, periodOfReport) || 0;

            const opInc = resolveMetric(xbrl, 'operating_income', formType, periodOfReport) || 0;

            const netInc = resolveMetric(xbrl, 'net_income', formType, periodOfReport) || 0;

            const eps = resolveMetric(xbrl, 'diluted_eps', formType, periodOfReport) || 0;

            const ocf = resolveMetric(xbrl, 'operating_cash_flow', formType, periodOfReport) || 0;

            const capex = Math.abs(resolveMetric(xbrl, 'capex', formType, periodOfReport) || 0);



            const netMargin = rev ? (netInc / rev) : 0;

            const opMargin = rev ? (opInc / rev) : 0;

            const fcf = ocf - capex;



            const { fy, fp } = getFiscalPeriod(ticker, periodOfReport);

            const finalFp = formType === '10-K' ? 'FY' : fp;

            const cleanFiled = filedAt.split('T')[0];



            await env.DB.prepare(`

            INSERT INTO company_quarterly (

                ticker, company_name, cik, adsh, form, fy, fp, period_end, filed_at,

                revenue, operating_income, net_income, diluted_eps,

                operating_cash_flow, capex,

                net_margin, operating_margin, free_cash_flow

            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

        `).bind(

                ticker, companyName, cik, accessionNo, formType, fy, finalFp, periodOfReport, cleanFiled,

                rev, opInc, netInc, eps, ocf, capex, netMargin, opMargin, fcf

            ).run();



            log.push({ ticker, result: "Inserted", fy, fp: finalFp, revenue: rev });

        }



        return new Response(JSON.stringify({ status: "Success", updates: log }, null, 2));



    } catch (e) {

        return new Response(JSON.stringify({ error: e.message }), { status: 500 });

    }

};