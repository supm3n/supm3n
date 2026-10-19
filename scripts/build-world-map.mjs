// Builds public/data/world.json (country polygons + ISO alpha-2) for the /trace dotted map.
// Run from the repo root:
//   npm install --no-save world-atlas topojson-client i18n-iso-countries
//   node scripts/build-world-map.mjs
// Output: {"countries":[{"a2":"DE","rings":[[lon,lat,lon,lat,...],...]},...]}
import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';
import countries from 'i18n-iso-countries';

const topo = JSON.parse(readFileSync('node_modules/world-atlas/countries-110m.json', 'utf8'));
const byName = { Kosovo: 'XK' };
const r = (n) => Math.round(n * 100) / 100;

// Rings that cross the antimeridian jump from 180 to -180; keep longitudes
// continuous (e.g. 181) so they don't draw a band across the whole map
const unwrap = (ring) => {
  let offset = 0;
  return ring.map(([lon, lat], i) => {
    if (i > 0) {
      const d = lon - ring[i - 1][0];
      if (d > 180) offset -= 360;
      else if (d < -180) offset += 360;
    }
    return [lon + offset, lat];
  });
};

const out = [];
for (const f of feature(topo, topo.objects.countries).features) {
  if (f.properties.name === 'Antarctica') continue;
  const a2 = f.id != null ? countries.numericToAlpha2(String(f.id).padStart(3, '0')) || null : byName[f.properties.name] || null;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rings = polys.flat().map((ring) => unwrap(ring).flatMap(([lon, lat]) => [r(lon), r(lat)]));
  out.push({ a2, rings });
}
writeFileSync('public/data/world.json', JSON.stringify({ countries: out }));
const have = new Set(out.map((c) => c.a2));
console.log('countries', out.length, 'null a2', out.filter((c) => !c.a2).length);
console.log('missing:', Object.keys(countries.getAlpha2Codes()).filter((c) => !have.has(c)).join(' '));
