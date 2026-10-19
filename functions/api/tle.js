// functions/api/tle.js
// Satellite orbit data (TLE) from CelesTrak, cached at the edge so visitors
// never contact CelesTrak and we stay within its fetch limits.
// GET /api/tle?group=stations|visual|starlink → [{ name, line1, line2 }]

const GROUPS = new Set(['stations', 'visual', 'starlink']);
const TTL = 4 * 60 * 60; // CelesTrak updates a few times a day

export const onRequestGet = async ({ request }) => {
  const group = new URL(request.url).searchParams.get('group') || 'stations';
  if (!GROUPS.has(group)) {
    return Response.json({ error: 'Unknown group' }, { status: 400 });
  }

  const cache = caches.default;
  const cacheKey = new Request(`https://supm3n-cache/tle/${group}`);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const upstream = await fetch(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`);
  if (!upstream.ok) {
    return Response.json({ error: `CelesTrak returned ${upstream.status}` }, { status: 502 });
  }

  const lines = (await upstream.text()).split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
  const sats = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    if (lines[i + 1]?.startsWith('1 ') && lines[i + 2]?.startsWith('2 ')) {
      sats.push({ name: lines[i].trim(), line1: lines[i + 1], line2: lines[i + 2] });
    }
  }

  const response = Response.json(sats, {
    headers: { 'Cache-Control': `public, max-age=${TTL}` },
  });
  await cache.put(cacheKey, response.clone());
  return response;
};
