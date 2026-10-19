// src/scripts/sky/sky.js
// /sky: the visitor's sky right now. Location comes from /api/whoami (rough,
// from the IP) or, if they ask, from the browser's geolocation, which never
// leaves the page. Satellite orbits come from /api/tle (CelesTrak, cached).

import { makeObserver, solarSystem, starVectors, starsHorizon, sunState, skyPhase } from "./astro.js";
import { parseSats, dropDocked, Topo, altAz, isSunlit, compass, findPasses } from "./sats.js";
import { Dome, drawMoon } from "./dome.js";

const $ = (id) => document.getElementById(id);
const TRAIL_STEP = 2000; // ms between trail points
const TRAIL_LEN = 30; // points: one minute of trail
const INTRO_MS = 2600;

// ---------- formatting (in the observed location's time zone) ----------
const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let tz, fmtTime, fmtClock, fmtDay, fmtKey;

function validZone(zone) {
  try {
    if (zone) new Intl.DateTimeFormat(undefined, { timeZone: zone });
    return zone || browserZone;
  } catch {
    return browserZone;
  }
}

function setZone(zone) {
  tz = validZone(zone);
  const o = { timeZone: tz };
  fmtTime = new Intl.DateTimeFormat(undefined, { ...o, hour: "2-digit", minute: "2-digit" });
  fmtClock = new Intl.DateTimeFormat(undefined, { ...o, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  fmtDay = new Intl.DateTimeFormat(undefined, { ...o, weekday: "short", day: "numeric", month: "short" });
  fmtKey = new Intl.DateTimeFormat("en-CA", { ...o, year: "numeric", month: "2-digit", day: "2-digit" });
}
setZone(browserZone);

const sameDay = (a, b) => fmtKey.format(a) === fmtKey.format(b);

function fmtWhen(d, now = new Date()) {
  if (sameDay(d, now)) return `Today ${fmtTime.format(d)}`;
  if (sameDay(d, new Date(now.getTime() + 86_400_000))) return `Tomorrow ${fmtTime.format(d)}`;
  return `${fmtDay.format(d)} ${fmtTime.format(d)}`;
}

function fmtSpan(ms, seconds = false) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (seconds) return m > 0 ? `${m}m ${String(sec).padStart(2, "0")}s` : `${sec}s`;
  return m > 0 ? `${m}m` : "<1m";
}

const fmtDeg = (v) => `${v.toFixed(1)}°`;
const fmtLat = (v) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? "N" : "S"}`;
const fmtLon = (v) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? "E" : "W"}`;
// Satellite status, same words as the legend
const STATUS_TEXT = { visible: "Visible now", sunlit: "Too bright to see", shadow: "In shadow" };
const STATUS_TAG = { visible: "visible now", sunlit: "too bright", shadow: "in shadow" };
// Crewed stations and the craft that visit them
const isCrewed = (sat) =>
  sat.iss || /^(CSS \(TIANHE\)|ISS |SHENZHOU|TIANZHOU|SOYUZ|PROGRESS|CREW DRAGON|DRAGON|CYGNUS|STARLINER|AXIOM)/i.test(sat.name);

// What it takes to see a planet: naked eye, binoculars or a telescope
const aid = (p) => (p.mag > 6 ? "telescope" : !p.eye || p.mag > 5 ? "binoculars" : null);
const fmtMag = (m) => (m < 0 ? `−${Math.abs(m).toFixed(1)}` : m.toFixed(1));

const DIRS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
const dirWord = (az) => DIRS[Math.round(az / 45) % 8];
// "high in the south", "low in the west", "almost overhead"
function position(alt, az) {
  if (alt >= 75) return "almost overhead";
  return `${alt >= 50 ? "high " : alt < 20 ? "low " : ""}in the ${dirWord(az)}`;
}

function setText(el, text) {
  if (el && el.textContent !== text) el.textContent = text;
}

// ---------- data ----------
async function getJson(url, ms = 8000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function loadWhoami() {
  const d = await getJson("/api/whoami");
  if (d && Number.isFinite(d.latitude) && Number.isFinite(d.longitude)) return { data: d, stub: false };
  if (import.meta.env.DEV) {
    const stub = await import("./dev-stub.js");
    return { data: stub.whoami, stub: true };
  }
  return null;
}

async function loadTles() {
  const [stations, visual] = await Promise.all([getJson("/api/tle?group=stations"), getJson("/api/tle?group=visual")]);
  if (Array.isArray(stations) || Array.isArray(visual)) {
    return { list: [...(stations || []), ...(visual || [])], stations: new Set((stations || []).map((s) => s.line1.slice(2, 7).trim())), stub: false };
  }
  if (import.meta.env.DEV) {
    const { tle } = await import("./dev-stub.js");
    return { list: [...tle.stations, ...tle.visual], stations: new Set(tle.stations.map((s) => s.line1.slice(2, 7).trim())), stub: true };
  }
  return null;
}

export function initSky() {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dome = new Dome($("dome-base"), $("dome-live"));
  const wrap = $("dome-wrap");
  const tip = $("tip");

  const S = {
    loc: null,
    obs: null,
    topo: null,
    stars: null,
    starVecs: null,
    starAltAz: null,
    hrIndex: null,
    solar: null,
    sats: [],
    satsState: "loading", // loading | ready | failed
    up: new Map(), // id -> { sat, v, aa, status }
    trails: new Map(), // id -> [{ t, e, n, u }]
    passes: null,
    passesAt: 0,
    hover: null,
    selected: null,
    introStart: null,
    introDone: reduceMotion,
  };

  const scene = () => ({
    sun: S.solar?.sun,
    moon: S.solar?.moon,
    planets: S.solar?.planets,
    stars: S.stars?.stars,
    names: S.stars?.names,
    lines: S.stars?.lines,
    hrIndex: S.hrIndex,
    starAltAz: S.loc ? S.starAltAz : null,
  });

  const introT = (now) => (S.introDone ? 1 : clampIntro(now));
  function clampIntro(now) {
    if (S.introStart == null) return 0;
    const t = (now - S.introStart) / INTRO_MS;
    if (t >= 1) S.introDone = true;
    return Math.min(1, t);
  }

  // ---------- slow updates ----------
  function minuteUpdate() {
    if (!S.loc) return;
    const now = new Date();
    S.solar = solarSystem(now, S.obs);
    if (S.starVecs) starsHorizon(S.starVecs, now, S.obs, S.starAltAz);
    if (S.introDone) dome.drawBase(scene(), 1);
    renderSun();
    renderMoon();
    renderUp();
    renderHeadline();
    renderHighlights();
    if (S.sats.length && Date.now() - S.passesAt > 30 * 60_000) computePasses();
  }

  function computePasses() {
    const iss = S.sats.find((s) => s.iss);
    if (!iss || !S.topo) {
      S.passes = [];
      renderPasses();
      return;
    }
    const obs = S.obs;
    const topo = S.topo;
    // Let the first frames paint before the ~3-day scan
    setTimeout(() => {
      if (S.topo !== topo) return;
      S.passes = findPasses(iss, topo, Date.now() - 15 * 60_000, 3, (d) => sunState(d, obs)).filter((p) => p.set > Date.now());
      S.passesAt = Date.now();
      renderPasses();
      renderHeadline();
      renderHighlights();
    }, 60);
  }

  // ---------- satellites ----------
  function statusOf(r, aa) {
    if (!S.solar || !isSunlit(r, S.solar.sunDir)) return "shadow";
    return S.solar.sun.alt < -6 && aa.alt > 0 ? "visible" : "sunlit";
  }

  function backfill(sat, now) {
    const pts = [];
    const last = Math.floor(now / TRAIL_STEP) * TRAIL_STEP;
    for (let i = TRAIL_LEN - 1; i >= 0; i--) {
      const t = last - i * TRAIL_STEP;
      const v = S.topo.look(sat, new Date(t));
      if (v) pts.push({ t, e: v.e, n: v.n, u: v.u });
    }
    return pts;
  }

  // Full sweep: which satellites are near or above the horizon, sunlit or not
  function sweep(now = Date.now()) {
    if (!S.topo || !S.sats.length) return;
    const date = new Date(now);
    const seen = new Set();
    for (const sat of S.sats) {
      const v = S.topo.look(sat, date);
      if (!v) continue;
      const aa = altAz(v);
      const trail = S.trails.get(sat.id);
      // Keep drawing for a minute after setting so the trail slides off the rim
      if (aa.alt < -8 && !(trail && aa.alt < 0 && trail.some((p) => p.u > 0))) continue;
      seen.add(sat.id);
      S.up.set(sat.id, { sat, v, aa, status: statusOf(v.r, aa) });
      if (!trail) {
        S.trails.set(sat.id, backfill(sat, now));
      } else {
        const t = Math.floor(now / TRAIL_STEP) * TRAIL_STEP;
        if (!trail.length || t > trail[trail.length - 1].t) {
          const tv = S.topo.look(sat, new Date(t));
          if (tv) trail.push({ t, e: tv.e, n: tv.n, u: tv.u });
          while (trail.length > TRAIL_LEN) trail.shift();
        }
      }
    }
    for (const id of S.up.keys()) {
      if (!seen.has(id)) {
        S.up.delete(id);
        S.trails.delete(id);
      }
    }
  }

  // Exact positions for the visible handful, every frame
  function liveSats(now) {
    const date = new Date(now);
    const out = [];
    for (const [id, st] of S.up) {
      let v = st.v;
      if (!reduceMotion) {
        const fresh = S.topo.look(st.sat, date);
        if (fresh) v = fresh;
      }
      out.push({
        id,
        label: st.sat.label,
        iss: st.sat.iss,
        station: st.sat.station && !st.sat.iss,
        named: st.sat.label !== st.sat.name, // ISS and Tiangong get a label on the dome
        v,
        status: st.status,
        trail: S.trails.get(id) || [],
      });
    }
    // ISS on top
    return out.sort((a, b) => (a.iss ? 1 : 0) - (b.iss ? 1 : 0));
  }

  // ---------- frame ----------
  let raf = 0;
  function frame() {
    raf = 0;
    const intro = !S.introDone;
    const t = introT(performance.now());
    if (intro) dome.drawBase(scene(), t);
    const satP = S.introDone ? 1 : Math.max(0, (t - 0.75) / 0.25);
    const hl = dome.drawLive(S.loc ? liveSats(Date.now()) : [], currentId(), satP);
    placeTip(hl);
    if (!reduceMotion || !S.introDone) schedule();
  }
  const schedule = () => {
    if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
  };
  const drawOnce = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  // ---------- timers ----------
  let secTimer = 0, minTimer = 0;
  function startTimers() {
    stopTimers();
    const period = reduceMotion ? 10_000 : 1000;
    secTimer = setInterval(() => {
      sweep();
      renderClock();
      renderUp();
      renderPasses();
      renderHighlights();
      if (reduceMotion) drawOnce();
    }, period);
    minTimer = setInterval(minuteUpdate, 60_000);
  }
  function stopTimers() {
    clearInterval(secTimer);
    clearInterval(minTimer);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopTimers();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else {
      S.trails.clear();
      S.up.clear();
      minuteUpdate();
      sweep();
      renderClock();
      renderUp();
      startTimers();
      reduceMotion ? drawOnce() : schedule();
    }
  });

  // ---------- highlight / tooltip ----------
  const currentId = () => S.hover ?? S.selected;

  function describe(id) {
    if (!S.solar) return null;
    if (id === "sun") {
      const s = S.solar.sun;
      return { name: "Sun", lines: [`alt ${fmtDeg(s.alt)} · ${compass(s.az, 16)}`, skyPhase(s.alt)] };
    }
    if (id === "moon") {
      const m = S.solar.moon;
      return { name: "Moon", lines: [`${m.phaseName} · ${Math.round(m.fraction * 100)}% lit`, `alt ${fmtDeg(m.alt)} · ${compass(m.az, 16)}`] };
    }
    const pl = S.solar.planets.find((p) => p.id === id);
    if (pl) return { name: pl.name, lines: [`mag ${fmtMag(pl.mag)}${aid(pl) ? ` · needs ${aid(pl) === "telescope" ? "a telescope" : "binoculars"}` : ""}`, `alt ${fmtDeg(pl.alt)} · ${compass(pl.az, 16)}`] };
    const st = S.up.get(id);
    if (st) {
      const height = Math.hypot(st.v.r.x, st.v.r.y, st.v.r.z) - 6371;
      const status = STATUS_TEXT[st.status];
      return { name: st.sat.label === "ISS" ? "ISS (Space Station)" : st.sat.label, lines: [`${Math.round(height)} km up · ${status}`, `alt ${fmtDeg(st.aa.alt)} · ${compass(st.aa.az, 16)}`] };
    }
    const hit = dome.hits.find((h) => h.id === id && h.kind === "star");
    if (hit) return { name: hit.name, lines: [`star · mag ${fmtMag(hit.mag)}`, `alt ${fmtDeg(hit.alt)} · ${compass(hit.az, 16)}`] };
    return null;
  }

  let tipKey = "";
  function placeTip(hl) {
    const id = currentId();
    const info = hl && id ? describe(id) : null;
    if (!info) {
      if (!tip.hidden) tip.hidden = true;
      tipKey = "";
      return;
    }
    const key = `${info.name}|${info.lines.join("|")}`;
    if (key !== tipKey) {
      tip.innerHTML = "";
      const b = document.createElement("strong");
      b.textContent = info.name;
      tip.append(b);
      for (const l of info.lines) {
        const s = document.createElement("span");
        s.textContent = l;
        tip.append(s);
      }
      tipKey = key;
    }
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = hl.x + 14, y = hl.y - h - 10;
    if (x + w > dome.size - 4) x = hl.x - w - 14;
    if (y < 4) y = hl.y + 14;
    tip.style.transform = `translate(${Math.round(Math.max(4, x))}px, ${Math.round(y)}px)`;
  }

  function setHover(id) {
    if (S.hover === id) return;
    S.hover = id;
    syncListHighlight();
    drawOnce();
  }
  function setSelected(id) {
    S.selected = S.selected === id ? null : id;
    syncListHighlight();
    drawOnce();
  }
  function syncListHighlight() {
    const id = currentId();
    for (const li of $("up-list").children) li.classList.toggle("on", li.dataset.id === id);
  }

  const live = $("dome-live");
  const local = (e) => {
    const r = live.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  live.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const hit = dome.hitTest(...local(e));
    live.style.cursor = hit ? "pointer" : "";
    setHover(hit ? hit.id : null);
  });
  live.addEventListener("pointerleave", () => setHover(null));
  live.addEventListener("click", (e) => {
    const hit = dome.hitTest(...local(e));
    if (hit) setSelected(hit.id);
    else if (S.selected) setSelected(S.selected);
  });

  // ---------- panels ----------
  function renderClock() {
    setText($("loc-time"), fmtClock.format(new Date()));
    if (S.solar) {
      const sun = S.solar.sun;
      const now = Date.now();
      const next = [sun.rise && { k: "Sunrise", d: sun.rise }, sun.set && { k: "Sunset", d: sun.set }]
        .filter(Boolean)
        .sort((a, b) => a.d - b.d)[0];
      setText($("sun-next"), next ? `${next.k} in ${fmtSpan(next.d - now)} · ${fmtTime.format(next.d)}` : sun.alt > 0 ? "Sun stays up today" : "Sun stays down today");
    }
  }

  function renderSun() {
    const sun = S.solar.sun;
    setText($("sun-alt"), fmtDeg(sun.alt));
    setText($("sun-phase"), skyPhase(sun.alt));
    setText($("loc-sky"), skyPhase(sun.alt));
    setText($("sun-rise"), sun.rise ? fmtWhen(sun.rise) : "—");
    setText($("sun-set"), sun.set ? fmtWhen(sun.set) : "—");
    renderClock();
  }

  function renderMoon() {
    const m = S.solar.moon;
    setText($("moon-name"), m.phaseName);
    setText($("moon-illum"), `${Math.round(m.fraction * 100)}% lit`);
    setText($("moon-alt"), m.alt > 0 ? `${fmtDeg(m.alt)} up, ${compass(m.az, 16)}` : "Below the horizon");
    setText($("moon-rise"), m.rise ? fmtWhen(m.rise) : "—");
    setText($("moon-set"), m.set ? fmtWhen(m.set) : "—");
    const c = $("moon-icon");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = 44;
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    // Same orientation as on the dome when it's up; otherwise the textbook view for this hemisphere
    const waxing = m.phaseAngle < 180;
    const fallback = (waxing ? 0 : Math.PI) + (S.loc.lat < 0 ? Math.PI : 0);
    drawMoon(ctx, size / 2, size / 2, 17, m.fraction, m.alt > -0.5 ? dome.moonAngle(S.solar.sun, m) : fallback);
  }

  // What's up: Sun, Moon, planets, then satellites (ISS, stations, visible first).
  // Each item says whether it is worth showing before "Show all".
  function upItems() {
    const items = [];
    if (!S.solar) return items;
    const { sun, moon, planets } = S.solar;
    if (sun.alt > -0.833) items.push({ id: "sun", name: "Sun", meta: `${fmtDeg(sun.alt)} ${compass(sun.az)}`, swatch: "#fde68a", key: true });
    if (moon.alt > -0.833) items.push({ id: "moon", name: "Moon", meta: `${fmtDeg(moon.alt)} ${compass(moon.az)}`, tag: `${Math.round(moon.fraction * 100)}%`, swatch: "#e7e5e4", key: true });
    for (const p of planets) {
      if (p.alt < 0) continue;
      items.push({ id: p.id, name: p.name, meta: `${fmtDeg(p.alt)} ${compass(p.az)}`, tag: aid(p) || `mag ${fmtMag(p.mag)}`, swatch: p.color, dim: !!aid(p), key: !aid(p) });
    }
    const sats = [...S.up.values()].filter((s) => s.aa.alt > 0);
    const rank = (s) => (s.sat.iss ? 0 : s.sat.station ? 1 : s.status === "visible" ? 2 : s.status === "sunlit" ? 3 : 4);
    sats.sort((a, b) => rank(a) - rank(b) || b.aa.alt - a.aa.alt);
    for (const s of sats) {
      items.push({
        id: s.sat.id,
        name: s.sat.label,
        meta: `${fmtDeg(s.aa.alt)} ${compass(s.aa.az)}`,
        tag: STATUS_TAG[s.status],
        tagClass: s.status,
        swatch: s.sat.iss ? "#ef4444" : s.sat.station ? "#22d3ee" : s.status === "visible" ? "#f8fafc" : "#94a3b8",
        hollow: s.status === "shadow",
        key: isCrewed(s.sat),
      });
    }
    return items;
  }

  let showAll = false;
  $("up-toggle").addEventListener("click", () => {
    showAll = !showAll;
    renderUp();
  });

  function renderUp() {
    const list = $("up-list");
    if (!S.loc) return;
    const all = upItems();
    const items = showAll ? all : all.filter((it) => it.key || it.id === S.selected);
    // Update rows in place so hover and focus survive the per-second refresh
    const rows = new Map([...list.children].map((li) => [li.dataset.id, li]));
    const order = [];
    for (const it of items) {
      let li = rows.get(it.id);
      if (!li) {
        li = document.createElement("li");
        li.dataset.id = it.id;
        li.innerHTML = `<button type="button"><i class="sw"></i><span class="nm"></span><span class="mt"></span><span class="tg"></span></button>`;
        const btn = li.firstChild;
        btn.addEventListener("mouseenter", () => setHover(it.id));
        btn.addEventListener("mouseleave", () => setHover(null));
        btn.addEventListener("focus", () => setHover(it.id));
        btn.addEventListener("blur", () => setHover(null));
        btn.addEventListener("click", () => setSelected(it.id));
      }
      rows.delete(it.id);
      const sw = li.querySelector(".sw");
      sw.style.setProperty("--c", it.swatch);
      sw.classList.toggle("hollow", !!it.hollow);
      li.classList.toggle("dim", !!it.dim);
      setText(li.querySelector(".nm"), it.name);
      setText(li.querySelector(".mt"), it.meta);
      const tg = li.querySelector(".tg");
      setText(tg, it.tag || "");
      tg.className = `tg ${it.tagClass || ""}`;
      order.push(li);
    }
    for (const li of rows.values()) li.remove();
    order.forEach((li, i) => {
      if (list.children[i] !== li) list.insertBefore(li, list.children[i] || null);
    });
    syncListHighlight();

    const note =
      S.satsState === "loading" ? "Loading satellites…"
      : S.satsState === "failed" ? "Satellite data is unavailable right now, so satellites are hidden."
      : !items.length ? "Nothing bright up right now apart from the stars." : "";
    setText($("up-note"), note);
    $("up-note").hidden = !note;
    setText($("up-count"), showAll ? String(all.length) : `${items.length} of ${all.length}`);
    const toggle = $("up-toggle");
    toggle.hidden = all.length === items.length && !showAll;
    setText(toggle, showAll ? "Show highlights only" : `Show all ${all.length} objects`);
    toggle.setAttribute("aria-expanded", String(showAll));
  }

  // "tonight at 19:42", "tomorrow at 05:39", "Thu 22 Oct at 04:05"
  function whenPhrase(d) {
    const now = new Date();
    if (sameDay(d, now)) {
      const set = S.solar?.sun.set;
      return `${set && d > set && sameDay(set, now) ? "tonight" : "today"} at ${fmtTime.format(d)}`;
    }
    if (sameDay(d, new Date(now.getTime() + 86_400_000))) return `tomorrow at ${fmtTime.format(d)}`;
    return `${fmtDay.format(d)} at ${fmtTime.format(d)}`;
  }

  function issState(now) {
    if (S.satsState !== "ready" || !S.passes) return null;
    const upcoming = S.passes.filter((p) => p.set > now);
    return {
      cur: upcoming.find((p) => p.rise <= now),
      nextVisible: upcoming.find((p) => p.visible && p.rise > now),
    };
  }

  // One live sentence for the page headline
  function renderHeadline() {
    if (!S.solar) return;
    const now = Date.now();
    const { sun, moon, planets } = S.solar;
    const best = planets.filter((p) => !aid(p) && p.alt > 10).sort((a, b) => a.mag - b.mag)[0];
    let lead;
    if (sun.alt > -6) {
      const when = sun.alt > -0.833 ? "Daytime" : "Twilight";
      lead = moon.alt > 5 ? `${when}: the Moon is up in the ${dirWord(moon.az)}.`
        : best?.id === "venus" ? `${when}: Venus is ${position(best.alt, best.az)}.`
        : sun.alt > 0 ? `${when}: the Sun is ${position(sun.alt, sun.az)}.`
        : `${when}: the first stars are coming out.`;
    } else {
      lead = best ? `${best.name} is ${position(best.alt, best.az)}.`
        : moon.alt > 5 ? `The Moon is ${position(moon.alt, moon.az)}, ${Math.round(moon.fraction * 100)}% lit.`
        : "A dark, moonless sky: good for stars.";
    }
    let iss = "";
    const st = issState(now);
    if (st?.cur) iss = st.cur.visible ? "The ISS is passing over now, look up." : "The ISS is passing over now.";
    else if (st?.nextVisible) {
      const nv = st.nextVisible;
      iss = nv.rise - now < 12 * 3600_000 ? `The ISS passes in ${fmtSpan(nv.rise - now)}, visible.` : `Next visible ISS pass ${whenPhrase(nv.rise)}.`;
    }
    const text = iss && lead.length + iss.length < 95 ? `${lead} ${iss}` : lead;
    setText($("app-headline"), text);
  }

  // Two to four plain-language facts, most interesting first
  let hlKey = "";
  function renderHighlights() {
    const list = $("hl-list");
    if (!S.solar) return;
    const now = Date.now();
    const { sun, moon, planets } = S.solar;
    const first = [], later = [];

    const st = issState(now);
    if (st?.cur) {
      const c = st.cur;
      first.push({ c: "#ef4444", b: "ISS overhead now", t: `, sets in ${fmtSpan(c.set - now)}. ${c.visible ? "Visible: a steady, bright moving point." : "Not visible this time."}` });
    } else if (st?.nextVisible) {
      const nv = st.nextVisible;
      const item = { c: "#ef4444", b: `ISS visible ${whenPhrase(nv.rise)}`, t: ` (in ${fmtSpan(nv.rise - now)}), up to ${Math.round(nv.peak)}°, ${nv.from} to ${nv.to}, about ${Math.max(1, Math.round(nv.duration / 60000))} min.` };
      (nv.rise - now < 24 * 3600_000 ? first : later).push(item);
    } else if (st) {
      later.push({ c: "#ef4444", b: "No visible ISS passes", t: " in the next 3 days." });
    }

    const up = planets.filter((p) => !aid(p) && p.alt > 3).sort((a, b) => a.mag - b.mag).slice(0, 2);
    for (const p of up) {
      const bright = p.mag < -1.5 ? ", very bright" : p.mag < 0.5 ? ", bright" : "";
      const note = sun.alt > -6 && p.id !== "venus" ? " (best after dark)" : "";
      first.push({ c: p.color, b: p.name, t: ` is ${position(p.alt, p.az)}${bright}${note}.` });
    }

    const next = [sun.rise && { k: "Sunrise", d: sun.rise }, sun.set && { k: "Sunset", d: sun.set }].filter(Boolean).sort((a, b) => a.d - b.d)[0];
    if (next && next.d - now < 3 * 3600_000) {
      first.push({ c: "#fde68a", b: `${next.k} in ${fmtSpan(next.d - now)}`, t: ` (${fmtTime.format(next.d)}).` });
    }

    const pct = Math.round(moon.fraction * 100);
    const moonWhere = moon.alt > 0
      ? `, ${position(moon.alt, moon.az)}${moon.set ? `, sets ${whenPhrase(moon.set).replace(/^today at /, "at ")}` : ""}.`
      : moon.rise ? `, rises ${whenPhrase(moon.rise)}.` : ", below the horizon.";
    first.push({ c: "#e7e5e4", b: "Moon", t: `: ${moon.phaseName.toLowerCase()}, ${pct}% lit${moonWhere}` });

    const rising = planets.filter((p) => p.rise && p.rise.date - now < 6 * 3600_000).sort((a, b) => a.mag - b.mag)[0];
    if (rising) later.push({ c: rising.color, b: `${rising.name} rises ${whenPhrase(rising.rise.date).replace(/^today /, "")}`, t: ` in the ${dirWord(rising.rise.az)}.` });

    const items = first.concat(later).slice(0, 4);
    const night = sun.alt < -0.833 || (sun.set && sun.set - now < 4 * 3600_000 && sun.set < (sun.rise ?? Infinity));
    setText($("hl-h"), night ? "Tonight's highlights" : "Highlights");

    const key = items.map((i) => i.b + i.t).join("|");
    if (key === hlKey) return;
    hlKey = key;
    list.innerHTML = "";
    for (const it of items) {
      const li = document.createElement("li");
      li.style.setProperty("--c", it.c);
      const b = document.createElement("strong");
      b.textContent = it.b;
      li.append(b, it.t);
      list.append(li);
    }
  }

  function renderPasses() {
    const box = $("iss-next"), when = $("iss-when"), list = $("iss-list");
    if (S.satsState === "failed") {
      setText(box, "—");
      setText(when, "ISS orbit data is unavailable right now.");
      return;
    }
    if (!S.passes) return;
    const now = Date.now();
    const upcoming = S.passes.filter((p) => p.set > now);
    const cur = upcoming.find((p) => p.rise <= now);
    const next = upcoming.find((p) => p.rise > now);
    if (cur) {
      setText(box, `Overhead now`);
      setText(when, `Sets in ${fmtSpan(cur.set - now, true)} · peak ${Math.round(cur.peak)}° · ${cur.from} → ${cur.to}${cur.visible ? " · visible" : ""}`);
    } else if (next) {
      setText(box, `in ${fmtSpan(next.rise - now, true)}`);
      const vis = upcoming.find((p) => p.visible && p.rise > now);
      const also = !next.visible && vis ? ` Next visible: ${fmtWhen(vis.rise)}, peak ${Math.round(vis.peak)}°.` : "";
      setText(when, `${fmtWhen(next.rise)} · peak ${Math.round(next.peak)}° · ${next.visible ? "visible" : "not visible (daylight or in shadow)."}${also}`);
    } else {
      setText(box, "—");
      setText(when, "No passes above 10° in the next 3 days.");
    }
    if (cur || next) $("iss-panel").classList.toggle("live", !!cur);

    const key = upcoming.map((p) => +p.rise).join(",");
    if (list.dataset.key === key) return;
    list.dataset.key = key;
    list.innerHTML = "";
    for (const p of upcoming.slice(0, 12)) {
      const li = document.createElement("li");
      li.className = p.visible ? "vis" : "";
      const top = document.createElement("div");
      top.className = "ps-top";
      const t = document.createElement("span");
      t.className = "ps-time";
      t.textContent = fmtWhen(p.rise);
      top.append(t);
      const badge = document.createElement("span");
      badge.className = `ps-badge ${p.visible ? "yes" : ""}`;
      badge.textContent = p.visible ? "Visible" : "Not visible";
      top.append(badge);
      const sub = document.createElement("div");
      sub.className = "ps-sub";
      sub.textContent = `Max ${Math.round(p.peak)}° · ${p.from} → ${p.to} · ${fmtSpan(p.duration, true)}`;
      li.append(top, sub);
      list.append(li);
    }
    if (!upcoming.length) {
      const li = document.createElement("li");
      li.className = "ps-empty";
      li.textContent = "No passes above 10° in the next 3 days.";
      list.append(li);
    }
  }

  // ---------- location ----------
  function setLocation(loc) {
    S.loc = loc;
    setZone(loc.zone);
    $("iss-list").dataset.key = ""; // re-render pass times in the new zone
    S.obs = makeObserver(loc.lat, loc.lon);
    S.topo = new Topo(loc.lat, loc.lon);
    S.up.clear();
    S.trails.clear();
    S.passesAt = 0;
    S.passes = null;
    $("dome-empty").hidden = true;
    $("sky-app").classList.remove("no-loc");

    setText($("loc-name"), loc.name);
    setText($("loc-coords"), `${fmtLat(loc.lat)} ${fmtLon(loc.lon)}`);
    setText($("loc-note"), loc.note);
    setText($("loc-tz"), tz.replace(/_/g, " "));

    minuteUpdate();
    sweep();
    renderUp();
    if (S.satsState === "ready") computePasses();
    if (S.introStart == null && !reduceMotion) {
      S.introStart = performance.now();
      schedule();
    } else {
      dome.drawBase(scene(), 1);
      reduceMotion ? drawOnce() : schedule();
    }
  }

  function noLocation() {
    $("dome-empty").hidden = false;
    $("sky-app").classList.add("no-loc");
    setText($("loc-name"), "Location unavailable");
    setText($("loc-coords"), "—");
    setText($("loc-note"), "We couldn't get an approximate location from your connection.");
    setText($("up-note"), "Waiting for a location.");
    setText($("app-headline"), "Share a location to see your sky.");
    $("hl-list").innerHTML = "<li>Share a location to see what's worth a look.</li>";
    setText($("iss-when"), "Waiting for a location.");
    if (S.introStart == null && !reduceMotion) {
      S.introStart = performance.now();
      schedule();
    } else {
      dome.drawBase(scene(), 1);
    }
  }

  const preciseBtn = $("precise");
  const emptyBtn = $("empty-locate");
  function askPrecise() {
    if (!("geolocation" in navigator)) {
      setText($("loc-note"), "This browser can't share a location.");
      return;
    }
    for (const b of [preciseBtn, emptyBtn]) b.disabled = true;
    setText(preciseBtn, "Locating…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        for (const b of [preciseBtn, emptyBtn]) b.disabled = false;
        setText(preciseBtn, "Update precise location");
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          name: "Your precise location",
          zone: browserZone,
          note: "From your device. It stays in this browser and is never sent anywhere.",
        });
      },
      (err) => {
        for (const b of [preciseBtn, emptyBtn]) b.disabled = false;
        setText(preciseBtn, "Use precise location");
        const msg = err.code === 1 ? "Location permission was declined." : "Couldn't get a location from your device.";
        setText($("loc-note"), S.loc ? `${msg} Still using ${S.loc.name}.` : msg);
        setText($("empty-msg"), msg);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60_000 }
    );
  }
  preciseBtn.addEventListener("click", askPrecise);
  emptyBtn.addEventListener("click", askPrecise);

  // ---------- layout ----------
  let resizeTimer;
  function layout() {
    dome.resize();
    dome.drawBase(scene(), introT(performance.now()));
    drawOnce();
  }
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 80);
  }).observe(wrap);
  dome.resize();

  // ---------- boot ----------
  setText($("loc-tz"), tz.replace(/_/g, " "));
  renderClock();
  startTimers();

  const starsReq = getJson("/data/stars.json").then((d) => {
    if (!d) return;
    S.stars = d;
    S.starVecs = starVectors(d.stars);
    S.starAltAz = new Float64Array(d.stars.length * 2);
    S.hrIndex = new Map(d.stars.map((s, i) => [s[0], i]));
  });

  const tleReq = loadTles().then((res) => {
    if (!res) {
      S.satsState = "failed";
      return;
    }
    const sats = dropDocked(parseSats(res.list), new Date());
    for (const s of sats) s.station = res.stations.has(s.norad);
    S.sats = sats;
    S.satsState = "ready";
    if (res.stub) $("stub-note").hidden = false;
  });

  Promise.all([loadWhoami(), starsReq]).then(([who]) => {
    if (who) {
      const d = who.data;
      const place = [d.city, d.region && d.region !== d.city ? d.region : null, d.country].filter(Boolean).join(", ");
      setLocation({
        lat: d.latitude,
        lon: d.longitude,
        name: place || "Your approximate location",
        zone: d.timezone,
        note: who.stub
          ? "Dev stub: /api/whoami isn't running, so this is a stand-in location."
          : "Approximate, from your IP address. Good enough for the sky; use precise location for exact satellite passes.",
      });
      if (who.stub) $("stub-note").hidden = false;
    } else {
      noLocation();
    }
    tleReq.then(() => {
      renderUp();
      if (S.satsState === "ready" && S.loc) {
        sweep();
        computePasses();
      } else renderPasses();
      drawOnce();
    });
  });
}

