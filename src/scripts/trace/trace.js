// src/scripts/trace/trace.js
// Timeline for /trace: fetch the visitor's connection info from /api/whoami,
// type it into the log, and zoom the map in on their approximate location.
// Device details are read in the browser and never sent anywhere.

import { WorldMap, formatLat, formatLon } from "./worldMap.js";

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function distanceKm(a, b) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

function gpuName() {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    let raw = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    if (!raw) return null;
    // "ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 (0x2704) Direct3D11 ..., D3D11)" -> "NVIDIA GeForce RTX 4080"
    const angle = raw.match(/^ANGLE \((.*)\)$/);
    if (angle) raw = angle[1].split(", ")[1] || angle[1];
    return raw
      .replace(/\s*\(0x[0-9a-f]+\)/i, "")
      .replace(/\s*Direct3D.*$/i, "")
      .replace(/^ANGLE Metal Renderer:\s*/i, "")
      .trim();
  } catch {
    return null;
  }
}

function deviceInfo() {
  const ua = navigator.userAgent;
  const os = /Windows/.test(ua) ? "Windows"
    : /iPhone|iPad/.test(ua) ? "iOS"
    : /Mac OS X/.test(ua) ? "macOS"
    : /Android/.test(ua) ? "Android"
    : /Linux/.test(ua) ? "Linux"
    : null;
  const browser = /Edg(iOS|A)?\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Firefox\/|FxiOS\//.test(ua) ? "Firefox"
    : /Chrome\/|CriOS\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : null;
  const dpr = window.devicePixelRatio || 1;
  return {
    os,
    browser,
    threads: navigator.hardwareConcurrency || null,
    gpu: gpuName(),
    screen: `${screen.width}×${screen.height}${dpr !== 1 ? ` @${+dpr.toFixed(2)}x` : ""}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

// Compare current UTC offsets, not names: browsers still report legacy IDs
// (Asia/Calcutta vs Asia/Kolkata) and neighbours share offsets (Berlin, Rome)
function sameOffset(a, b) {
  try {
    const offset = (timeZone) =>
      new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value;
    return offset(a) === offset(b);
  } catch {
    return a === b;
  }
}

async function fetchWhoami() {
  try {
    const t0 = performance.now();
    const res = await fetch("/api/whoami", { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    return { data, ms: Math.round(performance.now() - t0) };
  } catch {
    return null;
  }
}

// Best of three small requests, so a cold start doesn't count
async function measureRtt() {
  let best = Infinity;
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    try {
      await fetch("/api/whoami", { cache: "no-store", signal: AbortSignal.timeout(4000) });
    } catch {
      return null;
    }
    best = Math.min(best, performance.now() - t0);
  }
  return Math.round(best);
}

export function initTrace() {
  const canvas = $("map");
  const log = $("log");
  const statusEl = $("status");
  const skipBtn = $("skip");
  const ipEl = $("ip");
  const copyBtn = $("copy");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let map = null;
  let fast = reduceMotion;
  let run = 0;
  let currentIp = null;
  const worldReq = fetch("/data/world.json")
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  function layout() {
    if (!map) return;
    map.resize();
    const c = canvas.getBoundingClientRect();
    if (window.innerWidth >= 960) {
      // Settle the target in the open area left of the card
      const free = $("card").getBoundingClientRect().left - c.left;
      map.setFocus(free / 2 + 24, c.height * 0.4, free - 64, c.height * 0.75);
    } else {
      map.setFocus(c.width / 2, c.height / 2, c.width, c.height);
    }
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 150);
  });

  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = `status ${cls || ""}`;
  }

  async function line(key, value, cls = "") {
    const li = document.createElement("li");
    if (cls) li.className = cls;
    const k = document.createElement("span");
    k.className = "k";
    k.textContent = key;
    const v = document.createElement("span");
    v.className = "v";
    v.setAttribute("aria-hidden", "true");
    // Screen readers get the whole line once instead of every typed character
    const sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = String(value);
    li.append(k, v, sr);
    log.append(li);
    log.scrollTop = log.scrollHeight;
    const text = String(value);
    const perChar = Math.min(14, 420 / Math.max(1, text.length));
    for (let i = 1; i <= text.length; i++) {
      if (fast) break;
      v.textContent = text.slice(0, i);
      await sleep(perChar);
    }
    v.textContent = text;
    log.scrollTop = log.scrollHeight;
    if (!fast) await sleep(140);
  }

  function fact(id, text, note) {
    const dd = $(id);
    dd.textContent = text;
    if (note) {
      const span = document.createElement("span");
      span.className = "note";
      span.textContent = ` ${note}`;
      dd.append(span);
    }
    dd.classList.add("fresh");
    setTimeout(() => dd.classList.remove("fresh"), 900);
  }

  // The IP settles in from random digits, left to right
  async function revealIp(ip) {
    currentIp = ip;
    ipEl.classList.toggle("v6", ip.includes(":"));
    const steps = fast ? 0 : 18;
    for (let s = 0; s < steps && !fast; s++) {
      const fixed = Math.floor((ip.length * s) / steps);
      ipEl.textContent =
        ip.slice(0, fixed) +
        ip
          .slice(fixed)
          .replace(/[0-9a-f]/gi, () => "0123456789abcdef"[Math.floor(Math.random() * (ip.includes(":") ? 16 : 10))]);
      await sleep(32);
    }
    // IPv6 may wrap: allow breaks only after colons (copy uses the raw value)
    ipEl.textContent = ip.replace(/:/g, ":\u200b");
    copyBtn.disabled = false;
  }

  function resetUI() {
    $("app-headline").textContent = "What every website can see about you.";
    log.replaceChildren();
    ipEl.textContent = "···.···.···.···";
    ipEl.classList.remove("v6");
    copyBtn.disabled = true;
    copyBtn.textContent = "Copy";
    $("ip-version").hidden = true;
    for (const id of ["f-loc", "f-net", "f-edge", "f-conn", "f-tz", "f-device"]) $(id).textContent = "—";
    $("outro").hidden = true;
    $("outro-text").hidden = false;
  }

  async function trace() {
    const id = ++run;
    const alive = () => id === run;
    fast = reduceMotion;
    resetUI();
    setStatus("tracing", "running");
    skipBtn.hidden = fast;
    const infoReq = fetchWhoami();

    const world = await worldReq;
    if (world && !map) {
      map = new WorldMap(canvas, world);
      map.onFrame = () => {
        $("hud").textContent = `MERCATOR · ×${map.zoomLevel().toFixed(1)}`;
      };
      layout();
    }
    if (map) {
      map.reset();
      map.fast = fast;
      map.tween("reveal", 1, 1400);
    }

    await line("trace", "reading what your browser already sends…");
    const res = await infoReq;
    if (!alive()) return;
    if (!res) {
      await line("error", "/api/whoami unreachable. Try again in a moment.", "bad");
      if (!alive()) return;
      setStatus("failed", "failed");
      skipBtn.hidden = true;
      $("outro-text").hidden = true;
      $("outro").hidden = false;
      return;
    }

    const d = res.data;
    const device = deviceInfo();
    const where = d.city || d.country;
    if (where) {
      $("app-headline").textContent = `Every website you open sees you in ${where}${d.isp ? `, on ${d.isp}` : ""}.`;
    }
    await line("request", `GET /api/whoami → 200 in ${res.ms} ms`);

    // Edge: the Cloudflare data centre that answered
    const e = d.edge;
    let edgeText = null;
    if (e) {
      edgeText = `Cloudflare ${e.code}${e.city ? ` · ${e.city}` : ""}${e.country ? `, ${e.country}` : ""}`;
      await line("edge", edgeText);
      fact("f-edge", edgeText);
      if (map && e.lat != null) {
        map.setEdge({ lat: e.lat, lon: e.lon, code: e.code });
        map.tween("edge", 1, 500);
      }
    }

    // Who you are on the network
    if (d.ip) {
      await line("source", `${d.ip} (IPv${d.ipVersion})`);
      $("ip-version").textContent = `IPv${d.ipVersion}`;
      $("ip-version").hidden = false;
      revealIp(d.ip);
    }
    if (d.isp || d.asn) {
      const net = [d.isp, d.asn ? `AS${d.asn}` : null].filter(Boolean).join(" · ");
      await line("network", net);
      fact("f-net", net);
    }

    // Where: lock on, then zoom in
    const place = [d.city, d.region, d.country].filter(Boolean).join(", ");
    if (d.latitude != null && d.longitude != null) {
      await line("locate", "triangulating from IP registry data…");
      if (map) {
        map.setTarget({ lat: d.latitude, lon: d.longitude, country: d.country });
        await Promise.all([map.tween("lock", 1, 900), map.tween("hl", 1, 1200)]);
        await map.tween("fly", 1, 2600);
        map.tween("ping", 1, 1100);
      }
      await line("position", `${formatLat(d.latitude)} ${formatLon(d.longitude)}${place ? ` · ${place}` : ""}`);
      fact("f-loc", place || `${formatLat(d.latitude)} ${formatLon(d.longitude)}`, "(approximate)");

      if (e && e.lat != null) {
        const km = distanceKm({ lat: d.latitude, lon: d.longitude }, e);
        if (map) await map.tween("route", 1, 900);
        await line("route", `you → ${e.code}: ~${km.toLocaleString()} km`);
        fact("f-edge", `${edgeText} · ~${km.toLocaleString()} km away`);
      }
    } else if (place) {
      await line("position", place);
      fact("f-loc", place, "(approximate)");
    }
    if (!alive()) return;

    // How: protocol and latency
    const rtt = await measureRtt();
    const conn = [d.protocol, d.tls, rtt != null ? `${rtt} ms round trip` : null].filter(Boolean).join(" · ");
    if (conn) {
      await line("link", conn);
      fact("f-conn", conn);
    }

    // Clock check: an IP time zone that differs from the browser's hints at a VPN
    if (d.timezone) {
      const same = sameOffset(d.timezone, device.timezone);
      await line(
        "clock",
        same
          ? `IP says ${d.timezone}, your clock agrees (${device.timezone})`
          : `IP says ${d.timezone}, your clock says ${device.timezone}`,
        same ? "" : "bad",
      );
      fact("f-tz", same ? d.timezone : `${d.timezone} vs ${device.timezone}`, same ? "(matches your clock)" : "(VPN or travelling?)");
    }

    const dev = [
      device.os,
      device.browser,
      device.threads ? `${device.threads} threads` : null,
      device.gpu,
      device.screen,
    ].filter(Boolean).join(" · ");
    await line("device", dev);
    fact("f-device", dev);

    await line("done", "trace complete", "ok");
    if (!alive()) return;
    setStatus("complete", "done");
    skipBtn.hidden = true;
    $("outro").hidden = false;
  }

  skipBtn.addEventListener("click", () => {
    fast = true;
    map?.finish();
    skipBtn.hidden = true;
  });

  copyBtn.addEventListener("click", async () => {
    if (!currentIp) return;
    try {
      await navigator.clipboard.writeText(currentIp);
      copyBtn.textContent = "Copied";
    } catch {
      copyBtn.textContent = "Copy failed";
    }
    setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
  });

  $("replay").addEventListener("click", () => trace());

  trace();
}
