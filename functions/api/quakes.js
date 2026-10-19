// functions/api/quakes.js
// Earthquakes of the last 24 hours from the USGS M2.5+ feed, trimmed and cached
// at the edge so visitors never contact USGS.
// GET /api/quakes → [{ id, mag, place, time, lon, lat, depth, url }], newest first
//
// Why M2.5+ and not the M1+ "all_day" feed: outside the US, USGS only lists
// events from about M4, so the extra M1-2.5 events are all from US regional
// networks (California, Alaska, Nevada...). They triple the payload and pile
// dots onto a few spots instead of showing the planet.

const FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
const TTL = 5 * 60; // USGS regenerates the feed every minute; 5 min is plenty

const round = (v, d) => (typeof v === 'number' && isFinite(v) ? Number(v.toFixed(d)) : null);

export const onRequestGet = async (context) => {
  const cache = caches.default;
  const cacheKey = new Request('https://supm3n-cache/quakes/2.5_day');
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let data;
  try {
    const upstream = await fetch(FEED, { headers: { Accept: 'application/geo+json' } });
    if (!upstream.ok) {
      return Response.json({ error: `USGS returned ${upstream.status}` }, { status: 502 });
    }
    data = await upstream.json();
  } catch {
    return Response.json({ error: 'USGS fetch failed' }, { status: 502 });
  }

  const quakes = (data.features || [])
    .filter((f) => f?.properties?.type === 'earthquake' && Array.isArray(f.geometry?.coordinates))
    .map((f) => {
      const p = f.properties;
      const [lon, lat, depth] = f.geometry.coordinates;
      return {
        id: String(f.id),
        mag: round(p.mag, 1),
        place: p.place || null,
        time: p.time,
        lon: round(lon, 3),
        lat: round(lat, 3),
        depth: round(depth, 1),
        url: typeof p.url === 'string' && p.url.startsWith('https://earthquake.usgs.gov/') ? p.url : null,
      };
    })
    .filter((q) => q.mag != null && q.lon != null && q.lat != null && typeof q.time === 'number')
    .sort((a, b) => b.time - a.time);

  const response = Response.json(quakes, {
    headers: { 'Cache-Control': `public, max-age=${TTL}` },
  });
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
};
