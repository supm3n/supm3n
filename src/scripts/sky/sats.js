// src/scripts/sky/sats.js
// Satellites via SGP4 (satellite.js): topocentric positions, sunlit test, ISS passes.
// Positions are east/north/up vectors in km from the observer.

// See lib/satellite.js for why satellite.js isn't imported by package name
import { twoline2satrec, propagate, gstime, eciToEcf, geodeticToEcf } from "../lib/satellite.js";

const DEG = Math.PI / 180;
const EARTH_R = 6378.137;

export function parseSats(list) {
  const seen = new Set();
  const sats = [];
  for (const { name, line1, line2 } of list) {
    const norad = line1.slice(2, 7).trim();
    if (seen.has(norad)) continue;
    seen.add(norad);
    let satrec;
    try {
      satrec = twoline2satrec(line1, line2);
    } catch {
      continue;
    }
    if (satrec.error) continue;
    const clean = name.trim();
    sats.push({
      id: `sat-${norad}`,
      norad,
      name: clean,
      label: /^ISS \(ZARYA\)/.test(clean) ? "ISS" : /^CSS \(TIANHE\)/.test(clean) ? "Tiangong" : clean,
      iss: norad === "25544",
      satrec,
    });
  }
  return sats;
}

// Modules docked to a station share its orbit: keep only the first of any
// cluster within a few km (CelesTrak lists ISS (ZARYA) and CSS (TIANHE) first).
export function dropDocked(sats, date) {
  const kept = [];
  const pos = [];
  for (const s of sats) {
    const p = eci(s, date);
    if (!p) continue;
    if (pos.some((q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) < 5)) continue;
    kept.push(s);
    pos.push(p);
  }
  return kept;
}

function eci(sat, date) {
  const pv = propagate(sat.satrec, date);
  const p = pv && pv.position;
  return p && typeof p === "object" && Number.isFinite(p.x) ? p : null;
}

export class Topo {
  constructor(lat, lon) {
    this.lat = lat;
    this.lon = lon;
    const phi = lat * DEG, lam = lon * DEG;
    this.ecf = geodeticToEcf({ latitude: phi, longitude: lam, height: 0 });
    this.sp = Math.sin(phi); this.cp = Math.cos(phi);
    this.sl = Math.sin(lam); this.cl = Math.cos(lam);
  }

  // { e, n, u, r: ECI position } or null if SGP4 fails (decayed, bad TLE)
  look(sat, date) {
    const r = eci(sat, date);
    if (!r) return null;
    const f = eciToEcf(r, gstime(date));
    const dx = f.x - this.ecf.x, dy = f.y - this.ecf.y, dz = f.z - this.ecf.z;
    return {
      e: -this.sl * dx + this.cl * dy,
      n: -this.sp * this.cl * dx - this.sp * this.sl * dy + this.cp * dz,
      u: this.cp * this.cl * dx + this.cp * this.sl * dy + this.sp * dz,
      r,
    };
  }
}

export function altAz(v) {
  const range = Math.hypot(v.e, v.n, v.u);
  let az = Math.atan2(v.e, v.n) / DEG;
  if (az < 0) az += 360;
  return { alt: Math.asin(v.u / range) / DEG, az, range };
}

// Cylindrical Earth shadow. sunDir: unit vector to the Sun (J2000 ~ TEME here,
// the ~0.4° frame difference is irrelevant for a shadow test).
export function isSunlit(r, sunDir) {
  const d = r.x * sunDir[0] + r.y * sunDir[1] + r.z * sunDir[2];
  if (d >= 0) return true;
  const px = r.x - d * sunDir[0], py = r.y - d * sunDir[1], pz = r.z - d * sunDir[2];
  return Math.hypot(px, py, pz) > EARTH_R;
}

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export const compass = (az, points = 8) => {
  const step = 16 / points;
  return POINTS[(Math.round(az / (22.5 * step)) * step) % 16];
};

// Passes above the horizon over the next `days`, peaking at >= minPeak degrees.
// sunAt(date) -> { alt, dir } gives observer sun altitude and Sun unit vector.
export function findPasses(sat, topo, start, days, sunAt, minPeak = 10) {
  const STEP = 20_000;
  const altAt = (t) => {
    const v = topo.look(sat, new Date(t));
    return v ? altAz(v).alt : -90;
  };
  // Crossing between t0 (below) and t1 (above) or vice versa, to ~1 s
  const cross = (t0, t1) => {
    const up0 = altAt(t0) >= 0;
    while (t1 - t0 > 1000) {
      const m = (t0 + t1) / 2;
      if (altAt(m) >= 0 === up0) t0 = m; else t1 = m;
    }
    return (t0 + t1) / 2;
  };

  const passes = [];
  const end = start + days * 86_400_000;
  let prevT = start, prevAlt = altAt(start);
  let rise = prevAlt >= 0 ? start : null;
  for (let t = start + STEP; t <= end; t += STEP) {
    const alt = altAt(t);
    if (prevAlt < 0 && alt >= 0) rise = cross(prevT, t);
    if (prevAlt >= 0 && alt < 0 && rise != null) {
      const set = cross(prevT, t);
      const pass = describePass(sat, topo, rise, set, sunAt);
      if (pass && pass.peak >= minPeak) passes.push(pass);
      rise = null;
    }
    prevT = t;
    prevAlt = alt;
  }
  return passes;
}

function describePass(sat, topo, rise, set, sunAt) {
  const samples = [];
  const n = Math.max(8, Math.ceil((set - rise) / 5000));
  for (let i = 0; i <= n; i++) {
    const t = rise + ((set - rise) * i) / n;
    const v = topo.look(sat, new Date(t));
    if (v) samples.push({ t, v, ...altAz(v) });
  }
  if (samples.length < 2) return null;
  let top = samples[0];
  for (const s of samples) if (s.alt > top.alt) top = s;

  // Visible: sunlit, at least 10° up, while the observer's sky is dark
  let visible = false;
  let firstVis = null;
  for (const s of samples) {
    if (s.alt < 10) continue;
    const sun = sunAt(new Date(s.t));
    if (sun.alt < -6 && isSunlit(s.v.r, sun.dir)) {
      visible = true;
      firstVis ??= s.t;
    }
  }
  const first = samples[0], last = samples[samples.length - 1];
  return {
    rise: new Date(rise),
    set: new Date(set),
    peak: top.alt,
    peakTime: new Date(top.t),
    from: compass(first.az),
    to: compass(last.az),
    duration: set - rise,
    visible,
    visibleFrom: firstVis && new Date(firstVis),
  };
}
