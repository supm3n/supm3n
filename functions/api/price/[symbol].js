// functions/api/price/[symbol].js

export const onRequest = async (context) => {
  const { request, params, env } = context;
  const url = new URL(request.url);
  const interval = url.searchParams.get('interval') || '';

  // 1. Clean up the symbol
  let symbol = (params.symbol || '').toUpperCase().trim();
  if (!symbol) {
    return new Response(JSON.stringify({ error: 'Missing symbol' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 2. Handle Common Mapping/Typos
  if (symbol === 'APPL') symbol = 'AAPL';

  // 3. Determine if it's Crypto or Stock
  // Add any other coins you want to support here
  const cryptoList = new Set(['BTC', 'ETH', 'XRP', 'DOGE', 'SOL', 'ADA', 'DOT', 'MATIC']);
  const isCrypto = cryptoList.has(symbol);

  // 4. Select the correct API Function
  // Stocks use TIME_SERIES_DAILY, Crypto uses DIGITAL_CURRENCY_DAILY
  let fn = isCrypto ? 'DIGITAL_CURRENCY_DAILY' : 'TIME_SERIES_DAILY';

  // Override if 'function' or 'interval' was explicitly passed in query params (for advanced use)
  const queryFn = url.searchParams.get('function');
  if (queryFn) fn = queryFn.toUpperCase();

  // 5. Build the Upstream URL
  const key = env.ALPHA_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: 'Server missing ALPHA_KEY' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let upstream = `https://www.alphavantage.co/query?function=${fn}&symbol=${encodeURIComponent(symbol)}&apikey=${key}`;

  // Crypto requires a 'market' parameter (e.g., USD)
  if (fn.includes('DIGITAL_CURRENCY')) {
    upstream += `&market=USD`;
  }

  // 6. Cache Configuration
  const CACHE_DURATION = 900; // 15 minutes
  const cache = caches.default;
  const cacheKey = new Request(upstream); // Use upstream URL as cache key for uniqueness

  // Check Cache
  const cached = await cache.match(cacheKey);
  if (cached) {
    const newRes = new Response(cached.body, cached);
    newRes.headers.set('X-Cache-Status', 'HIT');
    return newRes;
  }

  // 7. Fetch from Alpha Vantage
  try {
    const res = await fetch(upstream);
    const text = await res.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Upstream Not JSON', details: text.substring(0, 100) }), { status: 502 });
    }

    // Handle API Errors / Rate Limits
    if (data.Note) {
      // Rate limit hit
      return new Response(JSON.stringify({ error: 'rate_limited', message: data.Note }), { status: 429 });
    }
    if (data['Error Message']) {
      return new Response(JSON.stringify({ error: 'upstream_error', message: data['Error Message'] }), { status: 400 });
    }

    // 8. Return & Cache
    const okResp = new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${CACHE_DURATION}`,
        'X-Cache-Status': 'MISS'
      }
    });

    context.waitUntil(cache.put(cacheKey, okResp.clone()));
    return okResp;

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Fetch Failed', message: err.message }), { status: 500 });
  }
};