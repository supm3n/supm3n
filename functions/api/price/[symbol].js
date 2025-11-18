// functions/api/price/[symbol].js

export const onRequest = async (context) => {
  const { request, params, env } = context;
  const url = new URL(request.url);
  let fn = (url.searchParams.get('function') || 'TIME_SERIES_DAILY').toUpperCase();
  const interval = url.searchParams.get('interval') || '';
  const symbol = (params.symbol || '').toUpperCase();

  if (!symbol) {
    return new Response(JSON.stringify({ error: 'Missing symbol' }), { 
      status: 400, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  // Normalize common typos
  const sym = symbol === 'APPL' ? 'AAPL' : symbol;

  // Access API Key from Environment Variables
  const key = env.ALPHA_KEY;
  
  if (!key) {
    return new Response(JSON.stringify({ 
      error: 'Server missing ALPHA_KEY',
      message: 'API key not configured. Please contact site administrator.'
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  // Only allow known functions
  const allowed = new Set([
    'TIME_SERIES_INTRADAY',
    'TIME_SERIES_DAILY',
    'TIME_SERIES_WEEKLY',
    'TIME_SERIES_MONTHLY',
    'TIME_SERIES_DAILY_ADJUSTED'
  ]);
  if (!allowed.has(fn)) fn = 'TIME_SERIES_DAILY';

  let upstream = `https://www.alphavantage.co/query?function=${fn}&symbol=${encodeURIComponent(sym)}&apikey=${key}`;
  if (fn === 'TIME_SERIES_INTRADAY') {
    const iv = interval || '60min';
    upstream += `&interval=${encodeURIComponent(iv)}`;
  }

  // Cache duration (15 minutes) to save API calls
  const CACHE_DURATION = 900; 
  
  const cache = caches.default;
  const cacheKey = new Request(`https://cache.supm3n/${sym}/${fn}/${interval}`);
  
  // Check Cloudflare Cache
  const cached = await cache.match(cacheKey);
  if (cached) {
    const newRes = new Response(cached.body, cached);
    newRes.headers.set('X-Cache-Status', 'HIT');
    return newRes;
  }

  // Fetch from Alpha Vantage
  const res = await fetch(upstream);
  const text = await res.text();
  let data;
  
  try {
    data = JSON.parse(text);
  } catch (e) {
    return new Response(JSON.stringify({
      error: 'upstream_not_json',
      status: res.status,
      message: 'Upstream returned a non-JSON response',
    }), { 
      status: 502, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  // Handle Rate Limits
  if (data.Note) {
    return new Response(JSON.stringify({ 
      error: 'rate_limited', 
      message: data.Note,
      suggestion: 'The free Alpha Vantage API allows 25 requests per day.'
    }), { 
      status: 429, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
  
  if (data['Error Message']) {
    return new Response(JSON.stringify({ 
      error: 'upstream_error', 
      message: data['Error Message'],
    }), { 
      status: 400, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
  
  // Success
  const okResp = new Response(JSON.stringify(data), { 
    headers: { 
      'Content-Type': 'application/json', 
      'Cache-Control': `public, max-age=${CACHE_DURATION}`,
      'X-Cache-Status': 'MISS'
    } 
  });
  
  context.waitUntil(cache.put(cacheKey, okResp.clone()));
  return okResp;
};