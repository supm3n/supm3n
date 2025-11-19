// functions/api/price/[symbol].js

export const onRequest = async (context) => {
  const { params, env } = context;

  // 1. Clean up the symbol
  let symbol = (params.symbol || '').toUpperCase().trim();
  if (!symbol) {
    return new Response(JSON.stringify({ error: 'Missing symbol' }), { status: 400 });
  }

  // 2. Handle Crypto Mapping
  const cryptoMap = new Set(['BTC', 'ETH', 'XRP', 'DOGE', 'SOL', 'ADA', 'MATIC']);
  if (cryptoMap.has(symbol)) {
    symbol = `${symbol}/USD`;
  }

  // 3. Build URL (Twelve Data)
  const apiKey = env.TWELVE_DATA_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server missing API Key' }), { status: 500 });
  }

  // FIX: Increased outputsize to 5000 (API Max) to show ~20 years of history
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=5000&apikey=${apiKey}`;

  // 4. Check Cache
  const cache = caches.default;
  const cacheKey = new Request(url);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  // 5. Fetch
  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.code && data.code !== 200) {
      return new Response(JSON.stringify({ error: data.message }), { status: 400 });
    }
    if (!data.values) {
      return new Response(JSON.stringify({ error: 'No data found' }), { status: 404 });
    }

    // 6. Transform Data
    const cleanData = data.values.map(item => ({
      date: item.datetime,
      close: parseFloat(item.close)
    })).reverse();

    const jsonResponse = new Response(JSON.stringify(cleanData), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=900',
        'Access-Control-Allow-Origin': '*'
      }
    });

    context.waitUntil(cache.put(cacheKey, jsonResponse.clone()));
    return jsonResponse;

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Fetch failed', details: err.message }), { status: 500 });
  }
};