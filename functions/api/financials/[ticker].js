export async function onRequest(context) {
    const { env, params } = context;
    const ticker = params.ticker.toUpperCase();

    try {
        if (!env.DB) {
            throw new Error("Database binding 'DB' not found. Check wrangler.toml");
        }

        const stmt = env.DB.prepare(`
            SELECT 
                ticker,
                company_name,
                fp,
                fy,
                period_end,
                filed_at,
                revenue,
                net_income,
                operating_cash_flow,
                capex as capital_expenditures, 
                free_cash_flow,
                diluted_eps as eps_diluted,
                net_margin,
                operating_margin
            FROM company_quarterly 
            WHERE ticker = ? 
            ORDER BY period_end ASC
        `);

        const { results } = await stmt.bind(ticker).all();

        if (!results || results.length === 0) {
            return new Response(JSON.stringify({ error: `No data found for ${ticker}` }), {
                status: 404,
                headers: { "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify(results), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (err) {
        console.error(`API Error for ${ticker}:`, err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}