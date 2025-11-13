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

  // IMPROVED: Longer cache duration (15 minutes instead of 2)
  // This helps stay under the 25 requests/day limit
  const CACHE_DURATION = 900; // 15 minutes
  
  // Cache key includes function+interval+symbol
  const cache = caches.default;
  const cacheKey = new Request(`https://cache.supm3n/${sym}/${fn}/${interval}`);
  const cached = await cache.match(cacheKey);
  
  if (cached) {
    console.log(`Cache HIT for ${sym}`);
    return new Response(cached.body, { 
      headers: { 
        'Content-Type': 'application/json', 
        'Cache-Control': `public, max-age=${CACHE_DURATION}`,
        'X-Cache-Status': 'HIT'
      } 
    });
  }

  console.log(`Cache MISS for ${sym} - fetching from Alpha Vantage`);
  const res = await fetch(upstream);
  const text = await res.text();
  let data;
  
  try {
    data = JSON.parse(text);
  } catch (e) {
    // Upstream returned non-JSON (HTML error or similar)
    const body = {
      error: 'upstream_not_json',
      status: res.status,
      message: 'Upstream returned a non-JSON response',
      snippet: text.slice(0, 200)
    };
    return new Response(JSON.stringify(body), { 
      status: 502, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  // Handle Alpha Vantage informative responses
  // Check for rate limiting (Note field typically contains rate limit message)
  if (data.Note) {
    const noteMessage = typeof data.Note === 'string' ? data.Note : JSON.stringify(data.Note);
    return new Response(JSON.stringify({ 
      error: 'rate_limited', 
      message: noteMessage,
      code: 'RATE_LIMIT_EXCEEDED',
      suggestion: 'The free Alpha Vantage API allows 25 requests per day. Please try again tomorrow or upgrade to a premium API key.'
    }), { 
      status: 429, 
      headers: { 
        'Content-Type': 'application/json',
        'Retry-After': '86400' // Retry after 24 hours
      } 
    });
  }
  
  // Check for error messages from Alpha Vantage
  if (data['Error Message']) {
    return new Response(JSON.stringify({ 
      error: 'upstream_error', 
      message: data['Error Message'],
      code: 'ALPHA_VANTAGE_ERROR'
    }), { 
      status: 400, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
  
  // Check for information messages (often API key issues)
  if (data.Information) {
    return new Response(JSON.stringify({ 
      error: 'information', 
      message: data.Information,
      code: 'API_INFO'
    }), { 
      status: 400, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
  
  // Check if response has expected data structure
  const hasTimeSeries = data['Time Series (Daily)'] || 
                       data['Time Series (Digital Currency Daily)'] ||
                       data['Time Series (5min)'] ||
                       data['Time Series (60min)'] ||
                       data['Weekly Time Series'] ||
                       data['Monthly Time Series'];
  
  if (!hasTimeSeries && Object.keys(data).length > 0) {
    // Response doesn't have expected structure
    return new Response(JSON.stringify({ 
      error: 'unexpected_response', 
      message: 'The API returned an unexpected response format. This may indicate an API key issue or service problem.',
      data: data,
      code: 'UNEXPECTED_FORMAT'
    }), { 
      status: 502, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  // Success: return the upstream JSON and cache it
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
