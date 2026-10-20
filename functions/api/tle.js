// functions/api/tle.js
// Satellite orbit data (TLE) from CelesTrak, cached at the edge so visitors
// never contact CelesTrak and we stay within its fetch limits.
// GET /api/tle?group=stations|visual|starlink → [{ name, line1, line2 }]
//
// If CelesTrak can't be reached, serve the group's last good copy (TLEs stay
// usable for days); with none, `stations` falls back to ARISS (ISS only).

const GROUPS = new Set(['stations', 'visual', 'starlink']);
const TTL = 4 * 60 * 60; // CelesTrak updates a few times a day
const STALE_TTL = 3 * 24 * 60 * 60;
const FALLBACK_TTL = 30 * 60;
const FAILURE_TTL = 10 * 60; // CelesTrak hangs rather than refusing; don't make every visitor wait
const ISS_FALLBACK = 'https://live.ariss.org/iss.txt';

async function fetchTle(url) {
  const upstream = await fetch(url, {
    headers: { 'User-Agent': 'supm3n.com (TLE cache, refreshes every 4h)' },
    signal: AbortSignal.timeout(5000),
  });
  if (!upstream.ok) throw new Error(`${new URL(url).host} returned ${upstream.status}`);

  const lines = (await upstream.text()).split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
  const sats = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    if (lines[i + 1]?.startsWith('1 ') && lines[i + 2]?.startsWith('2 ')) {
      sats.push({ name: lines[i].trim(), line1: lines[i + 1], line2: lines[i + 2] });
    }
  }
  if (!sats.length) throw new Error(`${new URL(url).host} returned no TLEs`);
  return sats;
}

export const onRequestGet = async ({ request }) => {
  const group = new URL(request.url).searchParams.get('group') || 'stations';
  if (!GROUPS.has(group)) {
    return Response.json({ error: 'Unknown group' }, { status: 400 });
  }

  const cache = caches.default;
  const cacheKey = new Request(`https://supm3n-cache/tle/${group}`);
  const staleKey = new Request(`https://supm3n-cache/tle-stale/${group}`);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const errors = [];
  try {
    const sats = await fetchTle(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`);
    const response = Response.json(sats, { headers: { 'Cache-Control': `public, max-age=${TTL}` } });
    await cache.put(cacheKey, response.clone());
    await cache.put(staleKey, Response.json(sats, { headers: { 'Cache-Control': `public, max-age=${STALE_TTL}` } }));
    return response;
  } catch (err) {
    errors.push(err.message || String(err));
  }

  const stale = await cache.match(staleKey);
  if (stale) return new Response(stale.body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

  if (group === 'stations') {
    try {
      const sats = await fetchTle(ISS_FALLBACK);
      // Short cache so CelesTrak is retried soon
      const response = Response.json(sats, { headers: { 'Cache-Control': `public, max-age=${FALLBACK_TTL}` } });
      await cache.put(cacheKey, response.clone());
      return response;
    } catch (err) {
      errors.push(err.message || String(err));
    }
  }

  const failure = Response.json({ error: 'TLE fetch failed', details: errors }, {
    status: 502,
    headers: { 'Cache-Control': `public, max-age=${FAILURE_TTL}` },
  });
  await cache.put(cacheKey, failure.clone()).catch(() => {});
  return failure;
};
