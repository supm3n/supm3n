// Cloudflare Pages Function: /api/events
// Aggregates hazards and returns normalized events for the current map bbox.
// Hazards supported: earthquakes (USGS), wildfires (FIRMS).
// Query params:
//   hazards   = csv of eq,wf
//   bbox      = west,south,east,north (floats)
//   since     = e.g., '24h' | '48h' (earthquakes time window)
//   official_only = 'true' | 'false' (server may still fetch both and filter client-side)
//
// ENV bindings (set in Cloudflare Pages Project → Settings → Environment variables):
//   FIRMS_MAP_KEY  (required to enable wildfire results)

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const hazards = (url.searchParams.get('hazards') || 'eq,wf').split(',').map(s => s.trim());
    const bboxStr = url.searchParams.get('bbox') || '-180,-90,180,90';
    const since = url.searchParams.get('since') || '48h';
    const officialOnly = url.searchParams.get('official_only') === 'true';
    const bbox = bboxStr.split(',').map(parseFloat);
    const meta = { updated_at: new Date().toISOString(), stale: false };

    const tasks = [];
    if (hazards.includes('eq')) tasks.push(fetchUSGS(bbox, since));
    if (hazards.includes('wf')) tasks.push(fetchFIRMS(context.env, bbox, 2)); // 2 days
    const results = await Promise.allSettled(tasks);

    let events = [];
    for (const r of results) {
      if (r.status === 'fulfilled') events = events.concat(r.value);
      else console.warn('Source failed', r.reason);
    }

    // Optional server-side filter for official-only (both USGS and FIRMS are official/scientific)
    if (officialOnly) {
      events = events.filter(ev => (ev.source || []).some(s => s.kind === 'official' || s.kind === 'scientific'));
    }

    // Basic de-dup (only relevant for quakes if multiple sources are added later)
    events = dedupe(events);

    return json({ events, meta });
  } catch (err) {
    console.error(err);
    return json({ events: [], meta: { error: String(err) } }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

// ---- USGS (earthquakes) ----
async function fetchUSGS(bbox, since) {
  // Use GeoJSON summary feeds for performance. since='24h'|'48h'|... → choose feed.
  // Feeds: all_hour, all_day, 2.5_day, 4.5_day, significant_day, etc.
  // We'll use '2.5_day' to keep volume moderate and useful.
  const feed = '2.5_day';
  const url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${feed}.geojson`;
  const res = await fetch(url, { headers: { 'accept': 'application/geo+json,application/json' } });
  if (!res.ok) throw new Error('USGS feed error');
  const gj = await res.json();
  const [w,s,e,n] = bbox;
  const now = Date.now();
  const maxAgeMs = parseSince(since);

  const events = (gj.features || [])
    .filter(f => {
      const [lon, lat] = f.geometry?.coordinates || [];
      if (lon < w || lon > e || lat < s || lat > n) return false;
      const t = f.properties?.time ? Number(f.properties.time) : 0;
      return now - t <= maxAgeMs;
    })
    .map(f => {
      const [lon, lat, depth] = f.geometry?.coordinates || [];
      const mag = f.properties?.mag;
      const title = f.properties?.title || f.properties?.place || 'Earthquake';
      const id = f.id || f.properties?.code || cryptoRandomId();
      const updated = f.properties?.updated ? new Date(f.properties.updated).toISOString() : new Date().toISOString();
      return {
        id: `eq-${id}`,
        type: 'earthquake',
        title,
        status: 'ongoing',
        when: { detected: new Date(f.properties?.time || Date.now()).toISOString(), updated },
        where: {
          point: [lon, lat],
          place: f.properties?.place || null
        },
        severity: {
          raw: { mw: mag ?? null, depth_km: depth ?? null },
          normalized: normalizeEq(mag)
        },
        source: [{
          name: 'USGS',
          kind: 'official',
          url: f.properties?.url || `https://earthquake.usgs.gov/earthquakes/eventpage/${id}`,
          freshness_s: Math.round((Date.now() - new Date(updated).getTime())/1000)
        }],
        links: { official: [f.properties?.url || `https://earthquake.usgs.gov/earthquakes/eventpage/${id}`] }
      };
    });

  return events;
}

function normalizeEq(mag) {
  if (mag == null) return 0;
  // Map Mw 3.0 → 0, 8.0 → 100
  const min = 3.0, max = 8.0;
  const x = Math.max(min, Math.min(max, mag));
  return Math.round(((x - min) / (max - min)) * 100);
}

// ---- FIRMS (wildfires) ----
async function fetchFIRMS(env, bbox, dayRange = 1) {
  const MAP_KEY = env?.FIRMS_MAP_KEY;
  if (!MAP_KEY) return []; // key not configured → skip fires
  // Use VIIRS SNPP NRT as a starter. Endpoint (CSV):
  // /api/area/csv/[MAP_KEY]/[SOURCE]/[AREA_COORDINATES]/[DAY_RANGE]
  const [w,s,e,n] = bbox;
  const source = 'VIIRS_SNPP_NRT';
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(MAP_KEY)}/${source}/${w},${s},${e},${n}/${dayRange}`;
  const res = await fetch(url, { headers: { 'accept': 'text/csv' } });
  if (!res.ok) {
    // Some regions require smaller bbox; do not fail the whole response.
    console.warn('FIRMS fetch failed', res.status);
    return [];
  }
  const csv = await res.text();
  // Parse CSV (simple split; fields documented in FIRMS). Expect headers.
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];
  const headers = lines[0].split(',');
  const idx = (name) => headers.indexOf(name);
  const i_lat = idx('latitude'), i_lon = idx('longitude'), i_brightness = idx('bright_ti4') !== -1 ? idx('bright_ti4') : idx('brightness');
  const i_conf = idx('confidence'), i_acq_date = idx('acq_date'), i_acq_time = idx('acq_time'), i_sat = idx('satellite'), i_inst = idx('instrument');

  const events = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    const lat = parseFloat(row[i_lat]);
    const lon = parseFloat(row[i_lon]);
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;
    const frp = row[idx('frp')] ? parseFloat(row[idx('frp')]) : null;
    const conf = row[i_conf] || null;
    const when = (row[i_acq_date] && row[i_acq_time]) ? new Date(`${row[i_acq_date]}T${pad4(row[i_acq_time])}Z`).toISOString() : new Date().toISOString();
    events.push({
      id: `wf-${row[idx('latitude')]}-${row[idx('longitude')]}-${row[i_acq_date]}-${row[i_acq_time]}`,
      type: 'wildfire',
      title: `Wildfire hotspot — ${row[i_sat] || ''} ${row[i_inst] || ''}`.trim(),
      status: 'ongoing',
      when: { detected: when, updated: when },
      where: { point: [lon, lat], place: null },
      severity: {
        raw: { frp: Number.isFinite(frp) ? frp : null, confidence: conf || null },
        normalized: normalizeFrp(frp, conf)
      },
      source: [{
        name: 'NASA FIRMS',
        kind: 'scientific',
        url: 'https://firms.modaps.eosdis.nasa.gov/',
        freshness_s: Math.round((Date.now() - new Date(when).getTime())/1000)
      }],
      links: { official: [] }
    });
  }
  return events;
}

function pad4(t) {
  const s = String(t).padStart(4, '0');
  return s.slice(0,2) + ':' + s.slice(2);
}

function parseCSVLine(line) {
  // Simple CSV parser that handles quoted commas
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      out.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function normalizeFrp(frp, conf) {
  if (!Number.isFinite(frp)) return 0;
  // Log scale-ish: 1→0, 1000→100
  const min = 1, max = 1000;
  const clamped = Math.max(min, Math.min(max, frp));
  let score = Math.round((Math.log10(clamped) - Math.log10(min)) / (Math.log10(max) - Math.log10(min)) * 100);
  if (conf && /low/i.test(conf)) score = Math.max(0, score - 10);
  if (conf && /high/i.test(conf)) score = Math.min(100, score + 10);
  return score;
}

function parseSince(s) {
  const m = /^([0-9]+)\s*(h|d)$/.exec(s);
  if (!m) return 48 * 3600 * 1000;
  const num = parseInt(m[1], 10);
  const unit = m[2];
  return (unit === 'd' ? num * 24 : num) * 3600 * 1000;
}

function dedupe(events) {
  const key = (ev) => `${ev.type}:${ev.where?.point?.map(n=>n.toFixed(2)).join(',')}:${(ev.when?.detected||'').slice(0,13)}`;
  const seen = new Set();
  const out = [];
  for (const ev of events) {
    const k = key(ev);
    if (!seen.has(k)) { seen.add(k); out.push(ev); }
  }
  return out;
}

function cryptoRandomId() {
  const arr = new Uint8Array(8);
  (globalThis.crypto || require('crypto').webcrypto).getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}
