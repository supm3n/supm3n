// src/scripts/planet/planetMap.js
// Dotted world map for /planet, built on the same idea as /trace's renderer:
// land is rasterised into a tiny mask (one pixel per dot cell) and dots sit on
// a fixed screen grid. Here the camera never moves, so the mask is built once
// per resize and each dot is shaded by the sun's elevation above it.
// Two canvases: "base" (dots, redrawn every ~30 s) and "overlay" (markers,
// quakes, ISS; redrawn every second or while something animates).

import { sunElevation } from "./astro.js";

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const LAT_TOP = 80;
const LAT_BOTTOM = -56;
const LEVELS = 16;
const HOUR = 3600e3;

const clamp01 = (t) => Math.max(0, Math.min(1, t));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const mercY = (lat) =>
  -Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * DEG) / 2));

// Brightness (0 night .. 1 day) for a sun elevation, with visible steps at
// civil (-6°), nautical (-12°) and astronomical (-18°) twilight
const STOPS = [[-18, 0], [-12, 0.1], [-6, 0.26], [-0.833, 0.5], [6, 0.82], [15, 1]];
function daylight(h) {
  if (h <= STOPS[0][0]) return 0;
  for (let i = 1; i < STOPS.length; i++) {
    const [h1, v1] = STOPS[i];
    if (h <= h1) {
      const [h0, v0] = STOPS[i - 1];
      return lerp(v0, v1, (h - h0) / (h1 - h0));
    }
  }
  return 1;
}

// Dot colours per brightness level; a faint warm tint around sunset
function palette(t) {
  const warm = Math.max(0, 1 - Math.abs(t - 0.42) / 0.2) * 0.32;
  const land = [
    lerp(lerp(71, 214, t), 251, warm),
    lerp(lerp(85, 222, t), 191, warm),
    lerp(lerp(110, 232, t), 120, warm),
    lerp(0.16, 0.88, t),
  ];
  const ocean = [lerp(100, 148, t), lerp(116, 163, t), lerp(150, 184, t), lerp(0.04, 0.24, t)];
  const css = ([r, g, b, a]) => `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${a.toFixed(3)})`;
  return { land: css(land), ocean: css(ocean) };
}
const PALETTE = Array.from({ length: LEVELS }, (_, i) => palette(i / (LEVELS - 1)));

// Ray casting on a flat [lon, lat, lon, lat, ...] ring
function pointInRing(ring, lon, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const quakeRadius = (mag, small) => Math.max(2, 2 + (mag - 2.5) * 2.2) * (small ? 0.6 : 1);

export class PlanetMap {
  constructor(base, overlay, world) {
    this.base = base;
    this.overlay = overlay;
    this.bctx = base.getContext("2d");
    this.octx = overlay.getContext("2d");
    this.font = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() || "monospace";

    this.countries = world.countries.map(({ a2, rings }) => {
      const path = new Path2D();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const ring of rings) {
        for (let i = 0; i < ring.length; i += 2) {
          const x = ring[i] * DEG, y = mercY(ring[i + 1]);
          i === 0 ? path.moveTo(x, y) : path.lineTo(x, y);
          x0 = Math.min(x0, ring[i]); x1 = Math.max(x1, ring[i]);
          y0 = Math.min(y0, ring[i + 1]); y1 = Math.max(y1, ring[i + 1]);
        }
        path.closePath();
      }
      return { a2, rings, path, box: [x0, y0, x1, y1] };
    });

    this.sun = { lat: 0, lon: 0 };
    this.moon = null;
    this.quakes = [];
    this.sats = []; // [{ key, label, pos, track, trackAt, main }]
    this.you = null;
    this.selected = null;
    this.hover = null;
    this.s = { reveal: 1, night: 1, quakes: 1, marks: 1, ping: 1 };
    this.tweens = new Map();
    this.raf = 0;
  }

  // box: the area (css px, relative to canvas) that the latitudes latTop to
  // latBottom must fit into. Land outside that range is still drawn if it's
  // on the canvas (e.g. under the desktop panel row).
  resize(box, latTop = LAT_TOP, latBottom = LAT_BOTTOM) {
    const rect = this.base.getBoundingClientRect();
    this.w = rect.width;
    this.h = rect.height;
    if (!this.w || !this.h) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [this.base, this.overlay]) {
      c.width = Math.round(this.w * this.dpr);
      c.height = Math.round(this.h * this.dpr);
    }
    this.small = this.w < 600;
    this.gap = this.small ? 4 : 6;
    this.cols = Math.ceil(this.w / this.gap);
    this.rows = Math.ceil(this.h / this.gap);

    const b = box || { x: 0, y: 0, w: this.w, h: this.h };
    const yTop = mercY(latTop), yBottom = mercY(latBottom);
    this.z = Math.min(b.w / TAU, b.h / (yBottom - yTop));
    this.ox = b.x + b.w / 2;
    this.oy = b.y + b.h / 2 - ((yTop + yBottom) / 2) * this.z;
    this.x0 = this.ox - Math.PI * this.z; // map's left and right edge (lon ±180)
    this.x1 = this.ox + Math.PI * this.z;

    this.buildGrid();
    this.renderBase();
    this.renderOverlay();
  }

  // Land mask and per-cell coordinates; only changes with the layout
  buildGrid() {
    const { cols, rows, gap, z } = this;
    const mask = document.createElement("canvas");
    mask.width = cols;
    mask.height = rows;
    const m = mask.getContext("2d", { willReadFrequently: true });
    m.fillStyle = "#f00";
    // Some rings are unwrapped past ±180 (Russia, Fiji); draw shifted copies
    // so those bits land on the other side of the map
    for (const off of [-TAU, 0, TAU]) {
      m.setTransform(z / gap, 0, 0, z / gap, (this.ox + off * z) / gap, this.oy / gap);
      for (const c of this.countries) m.fill(c.path, "evenodd");
    }
    const data = m.getImageData(0, 0, cols, rows).data;

    this.land = new Uint8Array(cols * rows);
    // getImageData is not premultiplied, so test coverage (alpha), not colour
    for (let n = 0; n < cols * rows; n++) this.land[n] = data[n * 4 + 3] >= 128 ? 1 : 0;

    this.colLon = new Float64Array(cols);
    this.colIn = new Uint8Array(cols);
    for (let i = 0; i < cols; i++) {
      const x = (i + 0.5) * gap;
      this.colLon[i] = (x - this.ox) / z / DEG;
      this.colIn[i] = x >= this.x0 && x <= this.x1 ? 1 : 0;
    }
    this.rowLat = new Float64Array(rows);
    for (let j = 0; j < rows; j++) {
      const wy = ((j + 0.5) * gap - this.oy) / z;
      this.rowLat[j] = (2 * Math.atan(Math.exp(-wy)) - Math.PI / 2) / DEG;
    }
  }

  toScreen(lon, lat) {
    return [this.ox + lon * DEG * this.z, this.oy + mercY(lat) * this.z];
  }

  // Country code under a point, or null over water
  countryAt(lon, lat) {
    for (const c of this.countries) {
      for (const l of [lon, lon + 360, lon - 360]) {
        const [x0, y0, x1, y1] = c.box;
        if (l < x0 || l > x1 || lat < y0 || lat > y1) continue;
        let inside = false;
        for (const ring of c.rings) if (pointInRing(ring, l, lat)) inside = !inside;
        if (inside) return c.a2;
      }
    }
    return null;
  }

  // --- Animation (same tween pattern as /trace) ---
  tween(key, to, ms) {
    return new Promise((resolve) => {
      const running = this.tweens.get(key);
      if (running) running.resolve();
      if (ms <= 0) {
        this.tweens.delete(key);
        this.s[key] = to;
        this.draw(key);
        resolve();
        return;
      }
      this.tweens.set(key, { from: this.s[key], to, ms, start: performance.now(), resolve });
      this.loop();
    });
  }

  loop() {
    if (this.raf) return;
    const step = (now) => {
      let base = false;
      for (const [key, t] of this.tweens) {
        const p = clamp01((now - t.start) / t.ms);
        this.s[key] = key === "ping" ? lerp(t.from, t.to, p) : lerp(t.from, t.to, ease(p));
        if (key === "reveal" || key === "night") base = true;
        if (p >= 1) {
          this.tweens.delete(key);
          t.resolve();
        }
      }
      if (base) this.renderBase();
      this.renderOverlay();
      this.raf = this.tweens.size ? requestAnimationFrame(step) : 0;
    };
    this.raf = requestAnimationFrame(step);
  }

  draw(key) {
    if (key === "reveal" || key === "night") this.renderBase();
    this.renderOverlay();
  }

  // --- Base layer: dots shaded by sun elevation ---
  renderBase() {
    if (!this.land) return;
    const { bctx: ctx, gap, cols, rows, s, sun } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    // Intro: the night side grows out of the anti-solar point
    const lift = (1 - s.night) * 100;
    const r = gap * 0.22;
    const land = Array.from({ length: LEVELS }, () => new Path2D());
    const ocean = Array.from({ length: LEVELS }, () => new Path2D());
    for (let i = 0; i < cols; i++) {
      if (!this.colIn[i]) continue;
      const lon = this.colLon[i];
      const x = (i + 0.5) * gap;
      for (let j = 0; j < rows; j++) {
        const isLand = this.land[j * cols + i];
        if (!isLand && (i + j) % 2) continue;
        const h = sunElevation(sun, this.rowLat[j], lon) + lift;
        const lvl = Math.round(daylight(h) * (LEVELS - 1));
        const y = (j + 0.5) * gap;
        if (isLand) {
          land[lvl].moveTo(x + r, y);
          land[lvl].arc(x, y, r, 0, TAU);
        } else {
          ocean[lvl].rect(x - 0.5, y - 0.5, 1, 1);
        }
      }
    }
    for (let l = 0; l < LEVELS; l++) {
      ctx.fillStyle = PALETTE[l].ocean;
      ctx.fill(ocean[l]);
      ctx.fillStyle = PALETTE[l].land;
      ctx.fill(land[l]);
    }

    // Intro: dots appear in a ring growing from the centre
    if (s.reveal < 1) {
      const rr = s.reveal * Math.hypot(this.w, this.h) * 0.6;
      ctx.globalCompositeOperation = "destination-in";
      if (rr <= 1) {
        ctx.fillStyle = "rgba(0,0,0,0)";
      } else {
        const g = ctx.createRadialGradient(this.w / 2, this.h / 2, 0, this.w / 2, this.h / 2, rr);
        g.addColorStop(0, "#000");
        g.addColorStop(Math.max(0, 1 - 120 / rr), "#000");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
      }
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.globalCompositeOperation = "source-over";
    }
  }

  // --- Overlay ---
  renderOverlay() {
    if (!this.land) return;
    const { octx: ctx, s } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    this.labels = [];
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.x0, 0, this.x1 - this.x0, this.h);
    ctx.clip();

    if (s.marks > 0) {
      ctx.globalAlpha = s.marks;
      for (const sat of this.sats) if (sat.main) this.drawTrack(sat);
      this.drawSun();
      this.drawMoon();
      ctx.globalAlpha = 1;
    }
    this.drawQuakes();
    if (s.marks > 0) {
      ctx.globalAlpha = s.marks;
      this.drawYou();
      for (const sat of this.sats) this.drawSat(sat);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  label(text, x, y, color) {
    const ctx = this.octx;
    ctx.font = `600 10px ${this.font}`;
    const w = ctx.measureText(text).width;
    // Keep labels inside the map
    let lx = x;
    if (lx + w > this.x1 - 4) lx = x - w - 24;
    if (lx < this.x0 + 4) lx = x + 10;
    // Step down or up if another label is already there (YOU vs a satellite)
    const hits = (ly) => this.labels.some((r) => lx < r.x + r.w && r.x < lx + w + 6 && ly - 9 < r.y + 13 && r.y < ly + 4);
    const ly = [y, y + 15, y - 15, y + 30].find((v) => !hits(v)) ?? y;
    this.labels.push({ x: lx - 3, y: ly - 9, w: w + 6 });
    ctx.fillStyle = "rgba(5, 6, 8, 0.6)";
    ctx.fillRect(lx - 3, ly - 9, w + 6, 13);
    ctx.fillStyle = color;
    ctx.fillText(text, lx, ly);
  }

  drawSun() {
    const ctx = this.octx;
    const [x, y] = this.toScreen(this.sun.lon, this.sun.lat);
    ctx.fillStyle = "rgba(251, 191, 36, 0.16)";
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(251, 191, 36, 0.8)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k * TAU) / 8;
      ctx.moveTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7);
      ctx.lineTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10);
    }
    ctx.stroke();
    if (!this.small) this.label("SUN", x + 15, y + 4, "rgba(253, 230, 138, 0.9)");
  }

  drawMoon() {
    if (!this.moon) return;
    const ctx = this.octx;
    const [x, y] = this.toScreen(this.moon.lon, this.moon.lat);
    ctx.strokeStyle = "rgba(226, 232, 240, 0.75)";
    ctx.fillStyle = "rgba(226, 232, 240, 0.12)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, TAU);
    ctx.fill();
    ctx.stroke();
    if (!this.small) this.label("MOON", x + 10, y + 4, "rgba(226, 232, 240, 0.75)");
  }

  drawYou() {
    if (!this.you) return;
    const ctx = this.octx;
    const [x, y] = this.toScreen(this.you.lon, this.you.lat);
    ctx.strokeStyle = "rgba(239, 68, 68, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const cx = x + sx * 8, cy = y + sy * 8;
      ctx.moveTo(cx, cy - sy * 4); ctx.lineTo(cx, cy); ctx.lineTo(cx - sx * 4, cy);
    }
    ctx.stroke();
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, TAU);
    ctx.fill();
    this.label("YOU", x + 13, y - 9, "rgba(252, 165, 165, 0.95)");
  }

  // Ground track: solid behind, dashed ahead, continuous over the antimeridian
  drawTrack(sat) {
    if (!sat.track?.length || !sat.pos) return;
    const ctx = this.octx;
    const tNow = (Date.now() - sat.trackAt) / 1000;
    const past = [], future = [];
    for (const p of sat.track) (p.t <= tNow ? past : future).push([p.lon, p.lat]);
    past.push([sat.pos.lon, sat.pos.lat]);
    future.unshift([sat.pos.lon, sat.pos.lat]);
    const line = (pts) => {
      const unwrapped = [];
      for (const [lon, lat] of pts) {
        let l = lon;
        if (unwrapped.length) l += Math.round((unwrapped[unwrapped.length - 1][0] - l) / 360) * 360;
        unwrapped.push([l, lat]);
      }
      ctx.beginPath();
      for (const off of [-360, 0, 360]) {
        unwrapped.forEach(([lon, lat], i) => {
          const [x, y] = this.toScreen(lon + off, lat);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
      }
      ctx.stroke();
    };
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = "rgba(34, 211, 238, 0.55)";
    line(past);
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = "rgba(34, 211, 238, 0.4)";
    line(future);
    ctx.setLineDash([]);
  }

  drawSat(sat) {
    if (!sat.pos) return;
    const ctx = this.octx;
    const [x, y] = this.toScreen(sat.pos.lon, sat.pos.lat);
    const color = sat.main ? "34, 211, 238" : "165, 180, 252";
    ctx.fillStyle = `rgba(${color}, 0.18)`;
    ctx.beginPath();
    ctx.arc(x, y, sat.main ? 9 : 7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgb(${color})`;
    ctx.beginPath();
    ctx.arc(x, y, sat.main ? 3.5 : 2.5, 0, TAU);
    ctx.fill();
    const text = sat.main && !this.small
      ? `${sat.label} ${Math.round(sat.pos.alt)} km · ${sat.pos.speed.toFixed(2)} km/s`
      : sat.label;
    this.label(text, x + 12, y - 8, `rgba(${color}, 0.95)`);
  }

  // Quakes: size = magnitude, brightness = age. During the intro they pop in
  // in the order they happened.
  drawQuakes() {
    const { octx: ctx, s } = this;
    const qs = this.quakes;
    if (!qs.length || s.quakes <= 0) return;
    const now = Date.now();
    const n = qs.length;
    // Oldest first so fresh ones sit on top
    for (let k = n - 1; k >= 0; k--) {
      const q = qs[k];
      const order = (n - 1 - k) / Math.max(1, n - 1);
      const p = clamp01((s.quakes - order * 0.85) / 0.15);
      if (p <= 0) continue;
      const age = clamp01((now - q.time) / (24 * HOUR));
      const [x, y] = this.toScreen(q.lon, q.lat);
      const r = quakeRadius(q.mag, this.small) * easeOut(p);
      const dim = this.selected && this.selected !== q.id ? 0.45 : 1;
      ctx.fillStyle = `rgba(239, 68, 68, ${(lerp(0.7, 0.14, age) * dim).toFixed(3)})`;
      ctx.strokeStyle = `rgba(252, 165, 165, ${(lerp(0.95, 0.3, age) * dim).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // One ping for quakes from the last hour, once, after the intro
      if (s.ping < 1 && now - q.time < HOUR) {
        ctx.strokeStyle = `rgba(239, 68, 68, ${(1 - s.ping).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, r + s.ping * 36, 0, TAU);
        ctx.stroke();
      }
    }
    for (const id of [this.hover, this.selected]) {
      const q = id && qs.find((k) => k.id === id);
      if (!q) continue;
      const [x, y] = this.toScreen(q.lon, q.lat);
      ctx.strokeStyle = id === this.selected ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, quakeRadius(q.mag, this.small) + 5, 0, TAU);
      ctx.stroke();
    }
  }

  // Nearest quake to a screen point, generous for touch
  quakeAt(x, y, touch) {
    let best = null, bestD = Infinity;
    for (const q of this.quakes) {
      const [qx, qy] = this.toScreen(q.lon, q.lat);
      const r = quakeRadius(q.mag, this.small);
      const d = Math.hypot(qx - x, qy - y);
      if (d <= Math.max(r + 4, touch ? 20 : 8) && d - r < bestD) {
        best = q;
        bestD = d - r;
      }
    }
    return best;
  }
}
