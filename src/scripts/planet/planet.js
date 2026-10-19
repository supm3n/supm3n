// src/scripts/planet/planet.js
// Page controller for /planet: loads data, keeps the clocks ticking and
// fills the panels. Sun and moon are computed in the browser; quakes, orbits
// and the visitor's approximate location come from our own /api routes.

import { PlanetMap, quakeRadius } from "./planetMap.js";
import {
  subsolar, sublunar, sunElevation, daylightState, nextSunEvent, moonInfo,
  makeSat, satPosition, groundTrack,
} from "./astro.js";

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");
const HOUR = 3600e3;

const fmtLat = (lat) => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}`;
const fmtLon = (lon) => `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`;
const fmtPos = (p) => `${fmtLat(p.lat)} ${fmtLon(p.lon)}`;

function fmtDuration(ms) {
  const m = Math.max(0, Math.round(ms / 60e3));
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
}

function fmtAgo(time, now) {
  const m = Math.max(0, Math.round((now - time) / 60e3));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)}h ago`;
}

let regionNames = null;
try {
  regionNames = new Intl.DisplayNames(["en"], { type: "region" });
} catch { /* old browsers: show codes */ }
const countryName = (a2) => {
  try {
    return (a2 && regionNames?.of(a2)) || a2;
  } catch {
    return a2;
  }
};

async function getJson(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const STATE_TEXT = {
  day: "Daylight",
  civil: "Civil twilight",
  nautical: "Nautical twilight",
  astronomical: "Astronomical twilight",
  night: "Night",
};

// SVG path of the lit part of the moon as seen from the northern hemisphere
function moonPath(angle, r = 10) {
  const rx = Math.abs(Math.cos(angle * (Math.PI / 180))) * r;
  const waxing = angle < 180;
  const lit = waxing ? 1 : 0;
  const term = waxing ? (angle < 90 ? 0 : 1) : (angle < 270 ? 0 : 1);
  return `M0 ${-r} A${r} ${r} 0 0 ${lit} 0 ${r} A${rx.toFixed(2)} ${r} 0 0 ${term} 0 ${-r}Z`;
}

export async function initPlanet() {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wrap = $("map-wrap");
  const tip = $("tip");
  const list = $("quake-list");

  // Dev only: /planet?stub fills the page with sample data (astro dev has no /api)
  const stub = import.meta.env.DEV && new URLSearchParams(location.search).has("stub")
    ? await import("./stub.js")
    : null;

  const worldReq = getJson("/data/world.json");
  const quakesReq = stub ? Promise.resolve(stub.stubQuakes()) : getJson("/api/quakes");
  const tleReq = stub ? Promise.resolve(stub.stubTle()) : getJson("/api/tle?group=stations");
  const whoReq = stub ? Promise.resolve(stub.stubWhoami()) : getJson("/api/whoami");

  const world = await worldReq;
  if (!world) {
    $("map-note").hidden = false;
    return;
  }
  const map = new PlanetMap($("base"), $("overlay"), world);

  let quakes = null;
  let sats = [];
  let you = null;

  // --- Layout ---
  function layout() {
    const c = wrap.getBoundingClientRect();
    lastSize = `${Math.round(c.width)}x${Math.round(c.height)}`;
    if (window.innerWidth >= 960) {
      // As wide as possible: 76°N sits at the top and 40°S at the top of the
      // panel row (fixed height in planet.css, so this doesn't jump); the
      // mostly empty southern ocean runs on under the panels.
      const panelsTop = $("panels").getBoundingClientRect().top - c.top;
      map.resize({ x: 0, y: 8, w: c.width, h: Math.max(200, panelsTop - 8) }, 76, -40);
    } else {
      // Below the title block
      const top = document.querySelector(".planet .stage-title").getBoundingClientRect().bottom - c.top + 4;
      map.resize({ x: 0, y: top, w: c.width, h: c.height - top });
    }
    if (selectedQuake()) showTip(selectedQuake());
    else hideTip();
  }
  // Re-fit on window resizes and when the title block changes height (the
  // live headline can wrap to more lines on phones)
  let resizeTimer;
  let lastSize = "";
  new ResizeObserver(() => {
    const r = wrap.getBoundingClientRect();
    const size = `${Math.round(r.width)}x${Math.round(r.height)}`;
    if (size === lastSize) return;
    lastSize = size;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 150);
  }).observe(wrap);

  // --- Sun, moon, clock ---
  function updateSky(now) {
    map.sun = subsolar(now);
    map.moon = sublunar(now);
    const moon = moonInfo(now);
    $("sun-pos").textContent = `Overhead at ${fmtPos(map.sun)}`;
    $("sun-over").textContent = overText(map.sun);
    $("moon-phase").textContent = `${moon.name} · ${Math.round(moon.lit * 100)}% lit`;
    $("moon-pos").textContent = `Overhead at ${fmtPos(map.moon)}`;
    $("moon-lit").setAttribute("d", moonPath(moon.angle));
  }

  // Rough ocean name for a point that isn't over land
  function oceanAt(lon, lat) {
    if (lat < -60) return "the Southern Ocean";
    if (lat > 66) return "the Arctic";
    if (lon >= 20 && lon < 146 && lat < 30) return "the Indian Ocean";
    if ((lon >= -70 && lon < 20) || (lon >= -100 && lon < -70 && lat > 17)) return "the Atlantic";
    return "the Pacific";
  }

  // One live sentence for the page headline, once the data has settled
  let headlineReady = false;
  function updateHeadline() {
    if (!headlineReady) return;
    const parts = [];
    if (quakes) {
      const n = quakes.length;
      parts.push(n === 0 ? "No M2.5+ earthquakes in the last day."
        : `${n} earthquake${n === 1 ? "" : "s"} in the last day.`);
    }
    if (you) {
      const state = daylightState(sunElevation(map.sun, you.lat, you.lon));
      parts.push(state === "day" ? "It's daytime where you are."
        : state === "night" ? "It's night where you are." : "It's twilight where you are.");
    } else {
      const a2 = map.countryAt(map.sun.lon, map.sun.lat);
      parts.push(`It's noon over ${a2 ? countryName(a2) : oceanAt(map.sun.lon, map.sun.lat)} right now.`);
    }
    const text = parts.join(" ");
    const el = $("app-headline");
    if (el && el.textContent !== text) el.textContent = text;
  }

  function overText(p) {
    const a2 = map.countryAt(p.lon, p.lat);
    return a2 ? `over ${countryName(a2)}` : "over water";
  }

  function updateClock(now) {
    $("utc").textContent = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
    $("utc-date").textContent = now.toLocaleDateString("en-GB", {
      timeZone: "UTC", weekday: "short", day: "numeric", month: "short",
    });
  }

  // --- You ---
  function updateYou(now) {
    if (!you) return;
    try {
      $("you-time").textContent = now.toLocaleTimeString("en-GB", {
        timeZone: you.timezone || undefined, hour: "2-digit", minute: "2-digit",
      });
    } catch {
      $("you-time").textContent = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    }
    const elev = sunElevation(map.sun, you.lat, you.lon);
    const state = daylightState(elev);
    $("you-state").textContent = `${STATE_TEXT[state]} · sun ${Math.abs(elev).toFixed(0)}° ${elev >= 0 ? "up" : "below the horizon"}`;
    $("you-state").dataset.state = state;
  }

  function updateYouEvent(now) {
    if (!you) return;
    const elev = sunElevation(map.sun, you.lat, you.lon);
    const kind = elev > -0.833 ? "set" : "rise";
    const t = nextSunEvent(you.lat, you.lon, now, kind);
    $("you-next").textContent = t
      ? `The sun ${kind}s for you in ${fmtDuration(t - now)}`
      : kind === "set" ? "The sun doesn't set for you today" : "The sun doesn't rise for you today";
  }

  // --- Satellites ---
  function updateSats(now, track) {
    for (const sat of map.sats) {
      sat.pos = satPosition(sat.sat, now);
      if (track && sat.main) {
        sat.track = groundTrack(sat.sat, now);
        sat.trackAt = now.getTime();
      }
    }
    map.sats.forEach((s) => {
      const el = $(`sat-${s.key}`);
      if (el && s.pos) {
        el.querySelector(".v").textContent = `${Math.round(s.pos.alt)} km · ${s.pos.speed.toFixed(2)} km/s`;
        el.querySelector(".sub").textContent = `${fmtPos(s.pos)} · ${overText(s.pos)}`;
      }
    });
  }

  // --- Quakes ---
  const selectedQuake = () => quakes?.find((q) => q.id === map.selected) || null;

  function renderQuakes() {
    const now = Date.now();
    list.replaceChildren();
    if (!quakes) {
      $("quake-summary").textContent = "The earthquake feed is unavailable right now.";
      $("quake-note").hidden = false;
      return;
    }
    $("quake-note").hidden = true;
    const strongest = [...quakes].sort((a, b) => b.mag - a.mag || b.time - a.time);
    const top = strongest[0];
    $("quake-count").textContent = String(quakes.length);
    // Detail line under the headline: the strongest quake
    const summary = $("quake-summary");
    if (top) {
      const mag = document.createElement("span");
      mag.className = "hl";
      mag.textContent = `M${top.mag.toFixed(1)}`;
      const where = top.place ? ` ${top.place.replace(/^\d+\s?km\s+\w+\s+of\s+/i, "near ")}` : ` at ${fmtPos(top)}`;
      summary.replaceChildren("Strongest: ", mag, `${where}, ${fmtAgo(top.time, now)}`);
    } else {
      summary.textContent = "No M2.5+ quakes in the last 24 hours.";
    }
    for (const q of strongest.slice(0, 5)) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quake-item";
      btn.dataset.id = q.id;
      btn.setAttribute("aria-pressed", String(map.selected === q.id));
      const mag = document.createElement("span");
      mag.className = "mag";
      mag.textContent = `M${q.mag.toFixed(1)}`;
      const place = document.createElement("span");
      place.className = "place";
      place.textContent = q.place || fmtPos(q);
      const ago = document.createElement("span");
      ago.className = "ago";
      ago.dataset.time = q.time;
      ago.textContent = fmtAgo(q.time, now);
      btn.append(mag, place, ago);
      btn.addEventListener("click", () => {
        select(map.selected === q.id ? null : q.id);
        // On phones the map is above the list: bring it into view
        if (map.selected && window.innerWidth < 960) {
          wrap.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        }
      });
      li.append(btn);
      list.append(li);
    }
  }

  function select(id) {
    map.selected = id;
    for (const b of list.querySelectorAll(".quake-item")) b.setAttribute("aria-pressed", String(b.dataset.id === id));
    const q = selectedQuake();
    q ? showTip(q) : hideTip();
    map.renderOverlay();
  }

  function showTip(q) {
    const [x, y] = map.toScreen(q.lon, q.lat);
    tip.querySelector(".tip-mag").textContent = `M${q.mag.toFixed(1)}`;
    tip.querySelector(".tip-place").textContent = q.place || fmtPos(q);
    tip.querySelector(".tip-meta").textContent =
      `${q.depth != null ? `${q.depth} km deep · ` : ""}${fmtAgo(q.time, Date.now())}`;
    const link = tip.querySelector("a");
    const ok = typeof q.url === "string" && q.url.startsWith("https://earthquake.usgs.gov/");
    link.hidden = !ok;
    if (ok) link.href = q.url;
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    const r = quakeRadius(q.mag, map.small) + 8;
    let left = x - w / 2;
    left = Math.max(8, Math.min(wrap.clientWidth - w - 8, left));
    let top = y - r - h;
    if (top < 8) top = y + r;
    // Desktop: a quake under the panel row gets its tooltip just above the row
    if (window.innerWidth >= 960) {
      const panelsTop = $("panels").getBoundingClientRect().top - wrap.getBoundingClientRect().top;
      top = Math.min(top, panelsTop - h - 8);
    }
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }

  function hideTip() {
    tip.hidden = true;
  }

  // Hover (mouse) and tap (touch) on the map
  const overlay = $("overlay");
  overlay.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || !quakes) return;
    const rect = overlay.getBoundingClientRect();
    const q = map.quakeAt(e.clientX - rect.left, e.clientY - rect.top, false);
    const id = q?.id || null;
    overlay.style.cursor = q ? "pointer" : "";
    if (id === map.hover) return;
    map.hover = id;
    if (q) showTip(q);
    else if (selectedQuake()) showTip(selectedQuake());
    else hideTip();
    map.renderOverlay();
  });
  overlay.addEventListener("pointerleave", () => {
    if (!map.hover) return;
    map.hover = null;
    selectedQuake() ? showTip(selectedQuake()) : hideTip();
    map.renderOverlay();
  });
  overlay.addEventListener("click", (e) => {
    if (!quakes) return;
    const rect = overlay.getBoundingClientRect();
    const q = map.quakeAt(e.clientX - rect.left, e.clientY - rect.top, e.pointerType !== "mouse");
    select(q ? q.id : null);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && map.selected) select(null);
  });

  // --- Ticks (paused while the tab is hidden) ---
  const satEvery = reduceMotion ? 5000 : 1000;
  let timers = [];
  let lastSat = 0, lastTrack = 0, lastSlow = 0, lastQuakeFetch = Date.now();

  function tick() {
    const now = new Date();
    const t = now.getTime();
    updateClock(now);
    let overlayDirty = false;
    if (t - lastSlow >= 30e3) {
      // Terminator moves ~0.25° a minute: every 30 s is plenty
      lastSlow = t;
      updateSky(now);
      map.renderBase();
      updateYouEvent(now);
      updateHeadline();
      // Refresh the "3h ago" texts in place so keyboard focus stays put
      for (const el of list.querySelectorAll(".ago")) el.textContent = fmtAgo(+el.dataset.time, t);
      overlayDirty = true;
    }
    if (map.sats.length && t - lastSat >= satEvery - 50) {
      lastSat = t;
      const track = t - lastTrack >= 60e3;
      if (track) lastTrack = t;
      updateSats(now, track);
      overlayDirty = true;
    }
    updateYou(now);
    if (!stub && t - lastQuakeFetch >= 5 * 60e3) {
      lastQuakeFetch = t;
      getJson("/api/quakes").then((data) => {
        if (!Array.isArray(data)) return;
        quakes = data;
        map.quakes = data;
        if (map.selected && !selectedQuake()) select(null);
        renderQuakes();
        updateHeadline();
        map.renderOverlay();
      });
    }
    if (overlayDirty && !map.raf) map.renderOverlay();
  }

  function start() {
    stop();
    lastSlow = lastSat = lastTrack = 0;
    tick();
    timers.push(setInterval(tick, 1000));
  }
  function stop() {
    timers.forEach(clearInterval);
    timers = [];
  }
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));

  // --- Go ---
  const now = new Date();
  updateClock(now);
  updateSky(now);
  if (!reduceMotion) Object.assign(map.s, { reveal: 0, night: 0, quakes: 0, marks: 0 });
  layout();
  if (!document.hidden) start();

  const intro = reduceMotion
    ? Promise.resolve()
    : map.tween("reveal", 1, 900).then(() => map.tween("night", 1, 1500));

  // Location
  whoReq.then((who) => {
    const lat = who?.latitude, lon = who?.longitude;
    if (typeof lat !== "number" || typeof lon !== "number") {
      $("you-note").textContent = "Your approximate location isn't available right now.";
      $("you-body").hidden = true;
      return;
    }
    you = { lat, lon, timezone: who.timezone };
    map.you = { lat, lon };
    const placeName = [who.city, who.country ? countryName(who.country) : null].filter(Boolean).join(", ");
    $("you-place").textContent = placeName || fmtPos(you);
    $("you-body").hidden = false;
    $("you-note").textContent = "Approximate, from your IP address. Nothing is stored.";
    updateYou(new Date());
    updateYouEvent(new Date());
    map.renderOverlay();
  });

  // Satellites
  tleReq.then((tle) => {
    const want = [
      { key: "iss", label: "ISS", match: /^ISS \(ZARYA\)/, main: true },
      { key: "css", label: "TIANGONG", match: /^CSS \(TIANHE\)/, main: false },
    ];
    for (const w of want) {
      const row = Array.isArray(tle) ? tle.find((s) => w.match.test(s.name)) : null;
      const sat = row && makeSat(row);
      if (sat) map.sats.push({ ...w, sat, pos: null, track: null, trackAt: 0 });
    }
    if (!map.sats.length) {
      $("sat-note").hidden = false;
      for (const w of want) $(`sat-${w.key}`).hidden = true;
      return;
    }
    for (const w of want) $(`sat-${w.key}`).hidden = !map.sats.some((s) => s.key === w.key);
    const n = new Date();
    updateSats(n, true);
    lastSat = lastTrack = n.getTime();
    map.renderOverlay();
  });

  await intro;
  if (!reduceMotion) map.tween("marks", 1, 600);

  // Quakes pop in in the order they happened, then fresh ones ping once
  const data = await quakesReq;
  quakes = Array.isArray(data) ? data : null;
  map.quakes = quakes || [];
  renderQuakes();
  await whoReq;
  headlineReady = true;
  updateHeadline();
  if (!quakes || reduceMotion) {
    map.s.quakes = 1;
    map.renderOverlay();
    return;
  }
  await map.tween("quakes", 1, Math.min(2200, 600 + quakes.length * 25));
  if (quakes.some((q) => Date.now() - q.time < HOUR)) {
    map.s.ping = 0;
    map.tween("ping", 1, 1400);
  }
}
