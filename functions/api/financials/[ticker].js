// functions/api/financials/[ticker].js
export const onRequest = async (context) => {
    const { params, env } = context;

    // 1. Validation
    const ticker = (params.ticker || '').toUpperCase().trim();
    if (!ticker) {
        return new Response(JSON.stringify({ error: 'Missing ticker symbol' }), { status: 400 });
    }

    // 2. Database Query (Cloudflare D1)
    // Note: You must bind your D1 database to the variable 'DB' in wrangler.toml
    if (!env.DB) {
        return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500 });
    }

    try {
        // Query matching the schema in summary.md
        const stmt = env.DB.prepare(`
      SELECT * FROM company_quarterly 
      WHERE ticker = ? 
      ORDER BY period_end ASC
    `).bind(ticker);

        const { results } = await stmt.all();

        if (!results || results.length === 0) {
            return new Response(JSON.stringify({ error: `No data found for ${ticker}` }), { status: 404 });
        }

        // 3. Return JSON
        return new Response(JSON.stringify(results), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: 'Database query failed', details: err.message }), { status: 500 });
    }
};