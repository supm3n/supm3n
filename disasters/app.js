// Disaster Explorer — MVP for supm3n.com/disasters
// Uses shared CSS/JS from supm3n.com/shared (adjust includes in index.html if filenames differ).
// Frontend calls a Cloudflare Pages Function at /api/events to fetch normalized events.
// Hazards: earthquakes (USGS) and wildfires (FIRMS via proxy).
// Challenge checks implemented: default sort=recent, official-only toggle, freshness badge, viewport filtering, 24–72h window.

const map = L.map('map', { zoomControl: true }).setView([20, 0], 2);

// Base tiles (no API key): Carto Voyager or OSM. Using OSM here.
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const markers = L.markerClusterGroup();
map.addLayer(markers);

const listEl = document.getElementById('list');
const statusEl = document.getElementById('statusText');
const staleBadgeEl = document.getElementById('staleBadge');

const state = {
  hazards: new Set(['eq', 'wf']),
  sort: 'recent', // 'severe'
  officialOnly: false,
  dataUpdatedAt: null,
  events: [],
};

// Shared header initializer (if your shared JS exposes one)
document.addEventListener('DOMContentLoaded', () => {
  if (window.supm3n && typeof window.supm3n.init === 'function') {
    window.supm3n.init({ current: 'disasters' });
  }
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('change', () => {
    if (chip.checked) state.hazards.add(chip.value); else state.hazards.delete(chip.value);
    refresh();
  });
});

document.getElementById('sortSelect').addEventListener('change', (e) => {
  state.sort = e.target.value;
  render();
});

document.getElementById('officialOnly').addEventListener('change', (e) => {
  state.officialOnly = e.target.checked;
  render();
});

document.getElementById('searchBtn').addEventListener('click', () => {
  const q = document.getElementById('searchBox').value.trim();
  if (!q) return;
  // Very naive search: forward to Nominatim geocoding.
  geocode(q).then(center => { if (center) map.setView(center, 6); });
});

map.on('moveend', () => refresh());

async function geocode(q) {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'json');
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' }});
    const arr = await res.json();
    if (arr && arr.length) {
      const best = arr[0];
      return [parseFloat(best.lat), parseFloat(best.lon)];
    }
  } catch (e) {
    console.warn('Geocode failed', e);
  }
}

function getBBox() {
  const b = map.getBounds();
  // west,south,east,north
  return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map(n => +n.toFixed(4)).join(',');
}

async function refresh() {
  statusEl.textContent = 'Loading…';
  const bbox = getBBox();
  const hazards = Array.from(state.hazards).join(',');
  const params = new URLSearchParams({ hazards, bbox, since: '48h' }); // 24–72h window; use 48h here
  if (state.officialOnly) params.set('official_only', 'true');

  try {
    const res = await fetch(`/api/events?${params.toString()}`);
    if (!res.ok) throw new Error('API error');
    const payload = await res.json();
    state.events = Array.isArray(payload.events) ? payload.events : [];
    state.dataUpdatedAt = payload.meta?.updated_at || null;
    const stale = payload.meta?.stale || false;
    staleBadgeEl.classList.toggle('badge--hidden', !stale);
    render();
    statusEl.textContent = `Loaded ${state.events.length} events`;
  } catch (e) {
    console.error(e);
    statusEl.textContent = 'Failed to load events';
  }
}

function render() {
  // Filter by official-only if toggled
  let events = state.events.filter(ev => {
    if (state.officialOnly) {
      return (ev.source || []).some(s => s.kind === 'official' || s.kind === 'scientific');
    }
    return true;
  });

  // Sort
  if (state.sort === 'severe') {
    events.sort((a, b) => (b.severity?.normalized || 0) - (a.severity?.normalized || 0) || new Date(b.when?.updated || 0) - new Date(a.when?.updated || 0));
  } else {
    events.sort((a, b) => new Date(b.when?.updated || 0) - new Date(a.when?.updated || 0));
  }

  // Map markers
  markers.clearLayers();
  events.forEach(ev => {
    if (!ev.where?.point) return;
    const [lon, lat] = ev.where.point;
    const icon = getIcon(ev.type);
    const m = L.marker([lat, lon], { title: ev.title, icon });
    m.on('click', () => showCard(ev));
    markers.addLayer(m);
  });

  // List
  listEl.innerHTML = '';
  events.forEach(ev => listEl.appendChild(renderCard(ev)));
}

function getIcon(type) {
  const color = type === 'earthquake' ? '#e89a4a' : (type === 'wildfire' ? '#ff5757' : '#6aa0ff');
  const svg = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='${color}'><circle cx='12' cy='12' r='8'/></svg>`);
  return L.icon({
    iconUrl: 'data:image/svg+xml;utf8,' + svg,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
}

function renderCard(ev) {
  const el = document.createElement('article');
  el.className = 'event-card';
  const updatedAgo = timeAgo(ev.when?.updated || ev.when?.detected);
  const sevChip = severityChip(ev);
  const sourceLabel = (ev.source && ev.source[0]) ? firstCap(ev.source[0].kind) : 'Unknown';

  el.innerHTML = `
    <h3>${escapeHtml(ev.title || prettyTitle(ev))}</h3>
    <div class="event-meta">
      <span class="chip-badge">${escapeHtml(ev.type)}</span>
      <span class="chip-badge">${sevChip}</span>
      <span>${updatedAgo}</span>
      <span>Source: ${escapeHtml(sourceLabel)}</span>
    </div>
    <div class="event-actions">
      <button class="btn" data-action="focus">Focus on map</button>
      ${ev.links?.official?.[0] ? `<a class="btn" href="${ev.links.official[0]}" target="_blank" rel="noopener">Official page</a>` : ''}
    </div>
  `;

  el.querySelector('[data-action="focus"]').addEventListener('click', () => {
    if (ev.where?.point) {
      const [lon, lat] = ev.where.point;
      map.setView([lat, lon], 7, { animate: true });
    }
  });

  el.addEventListener('mouseenter', () => {
    if (ev.where?.point) {
      const [lon, lat] = ev.where.point;
      // subtle pan (no zoom) to draw attention
      map.panTo([lat, lon], { animate: true, duration: 0.25 });
    }
  });

  return el;
}

function showCard(ev) {
  // On desktop click marker → scroll to the card
  const cards = Array.from(listEl.querySelectorAll('.event-card'));
  const idx = cards.findIndex(card => card.querySelector('h3')?.textContent === (ev.title || prettyTitle(ev)));
  if (idx >= 0) cards[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function severityChip(ev) {
  if (ev.type === 'earthquake') {
    const mw = ev.severity?.raw?.mw ?? ev.metrics?.mw;
    return mw ? `Mw ${mw.toFixed(1)}` : 'Mw —';
  }
  if (ev.type === 'wildfire') {
    const frp = ev.severity?.raw?.frp;
    const conf = ev.severity?.raw?.confidence;
    return frp ? `FRP ${Math.round(frp)}${conf ? ' · ' + conf : ''}` : (conf ? conf : 'FRP —');
  }
  return '—';
}

function prettyTitle(ev) {
  if (ev.type === 'earthquake') {
    const place = ev.where?.place || '';
    const mw = ev.severity?.raw?.mw;
    return (mw ? `M${mw.toFixed(1)} ` : '') + (place || 'Earthquake');
  }
  if (ev.type === 'wildfire') {
    const place = ev.where?.place || '';
    return (place ? `${place} — ` : '') + 'Wildfire hotspot';
  }
  return ev.type;
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return `${days} d ago`;
}

function firstCap(s='') { return s.slice(0,1).toUpperCase() + s.slice(1); }
function escapeHtml(s='') { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// Initial load
refresh();
// Periodically refresh to keep data current (10 min)
setInterval(refresh, 10 * 60 * 1000);
