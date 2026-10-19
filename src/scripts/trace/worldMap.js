// Dotted Mercator world map for /trace.
// Each frame the land is rasterised into a tiny mask canvas (one pixel per dot
// cell), so the dot grid stays fixed on screen while the map zooms under it.

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const LAT_TOP = 80;
const LAT_BOTTOM = -56;
const LEVELS = 8;

const clamp01 = (t) => Math.max(0, Math.min(1, t));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const mercY = (lat) =>
  -Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * DEG) / 2));
const project = (lon, lat) => [lon * DEG, mercY(lat)];

export const formatLat = (lat) => `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}`;
export const formatLon = (lon) => `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;

// Ray casting on a flat [lon, lat, lon, lat, ...] ring
function pointInRing(ring, lon, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function ringBounds(ring) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < ring.length; i += 2) {
    const [x, y] = project(ring[i], ring[i + 1]);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1 };
}

// Points along the great circle from a to b, as [lon, lat]
function greatCircle(a, b, steps = 64) {
  const vec = ({ lat, lon }) => [
    Math.cos(lat * DEG) * Math.cos(lon * DEG),
    Math.cos(lat * DEG) * Math.sin(lon * DEG),
    Math.sin(lat * DEG),
  ];
  const va = vec(a), vb = vec(b);
  const omega = Math.acos(Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2])));
  if (omega < 1e-6) return [[a.lon, a.lat], [b.lon, b.lat]];
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const s1 = Math.sin((1 - t) * omega) / Math.sin(omega);
    const s2 = Math.sin(t * omega) / Math.sin(omega);
    const v = [0, 1, 2].map((k) => s1 * va[k] + s2 * vb[k]);
    let lon = Math.atan2(v[1], v[0]) / DEG;
    // Keep longitudes continuous so a route over the antimeridian doesn't jump
    if (pts.length) lon += Math.round((pts[pts.length - 1][0] - lon) / 360) * 360;
    pts.push([lon, Math.asin(v[2]) / DEG]);
  }
  return pts;
}

export class WorldMap {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.mask = document.createElement("canvas");
    this.mctx = this.mask.getContext("2d", { willReadFrequently: true });
    this.font = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() || "monospace";

    // Country outlines as Path2D in projected units; the mask transform scales them
    this.countries = world.countries.map(({ a2, rings }) => {
      const path = new Path2D();
      for (const ring of rings) {
        for (let i = 0; i < ring.length; i += 2) {
          const [x, y] = project(ring[i], ring[i + 1]);
          i === 0 ? path.moveTo(x, y) : path.lineTo(x, y);
        }
        path.closePath();
      }
      return { a2, rings, path };
    });

    this.focus = null; // css px point where the target settles, set by the page
    this.target = null;
    this.edge = null;
    this.highlight = null;
    this.s = { reveal: 0, lock: 0, hl: 0, fly: 0, edge: 0, route: 0, ping: 0 };
    this.tweens = new Map();
    this.raf = 0;
    this.fast = false;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.w = rect.width;
    this.h = rect.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.gap = this.w < 600 ? 5 : 7;
    this.cols = Math.ceil(this.w / this.gap);
    this.rows = Math.ceil(this.h / this.gap);
    this.mask.width = this.cols;
    this.mask.height = this.rows;

    // World view: whole map between LAT_TOP and LAT_BOTTOM, centred
    const yTop = mercY(LAT_TOP), yBottom = mercY(LAT_BOTTOM);
    this.z0 = Math.min(this.w / TAU, this.h / (yBottom - yTop)) * 0.96;
    this.c0 = { x: 0, y: (yTop + yBottom) / 2 };
    this.render();
  }

  // Zoom so the visitor's landmass fills about half of the free area
  setFocus(x, y, freeW, freeH) {
    this.focus = { x, y, w: freeW, h: freeH };
    this.render();
  }

  setTarget({ lat, lon, country }) {
    const c = this.countries.find((k) => k.a2 === country) || null;
    const containing = c ? c.rings.filter((r) => pointInRing(r, lon, lat)) : [];
    const ring =
      containing.sort((a, b) => a.length - b.length)[0] ||
      (c ? c.rings.reduce((a, b) => (b.length > a.length ? b : a)) : null);
    const [wx, wy] = project(lon, lat);
    this.target = { lat, lon, wx, wy, bounds: ring ? ringBounds(ring) : null };
    this.highlight = c;
    this.updateRoute();
  }

  setEdge(edge) {
    this.edge = edge;
    this.updateRoute();
  }

  updateRoute() {
    this.route = this.edge && this.target ? greatCircle(this.edge, this.target) : null;
  }

  // Largest zoom that keeps the whole landmass in the free area, with the
  // visitor (not the landmass centre) at the focus point
  zoomFactor() {
    const t = this.target;
    const b = t?.bounds;
    if (!b) return 8;
    const freeW = this.focus?.w || this.w;
    const freeH = this.focus?.h || this.h;
    const halfW = Math.max(t.wx - b.x0, b.x1 - t.wx, 1e-4);
    const halfH = Math.max(t.wy - b.y0, b.y1 - t.wy, 1e-4);
    const f = Math.min((freeW * 0.45) / (halfW * this.z0), (freeH * 0.45) / (halfH * this.z0));
    return Math.max(2.5, Math.min(12, f));
  }

  // Screen x = (worldX - tx) * z + px. While flying, the target's screen point
  // moves linearly to the focus and the zoom grows exponentially, so the
  // target never leaves the screen.
  camera() {
    const { z0, c0 } = this;
    const cx = this.w / 2, cy = this.h / 2;
    if (!this.target) return { z: z0, tx: c0.x, ty: c0.y, px: cx, py: cy };
    const t = this.target;
    const f = this.s.fly;
    const p0x = (t.wx - c0.x) * z0 + cx;
    const p0y = (t.wy - c0.y) * z0 + cy;
    const fx = this.focus?.x ?? cx;
    const fy = this.focus?.y ?? cy;
    return { z: z0 * Math.pow(this.zoomFactor(), f), tx: t.wx, ty: t.wy, px: lerp(p0x, fx, f), py: lerp(p0y, fy, f) };
  }

  toScreen(cam, lon, lat) {
    const [wx, wy] = project(lon, lat);
    return [(wx - cam.tx) * cam.z + cam.px, (wy - cam.ty) * cam.z + cam.py];
  }

  zoomLevel() {
    return this.target ? Math.pow(this.zoomFactor(), this.s.fly) : 1;
  }

  // --- Animation ---
  tween(key, to, ms) {
    return new Promise((resolve) => {
      const running = this.tweens.get(key);
      if (running) running.resolve();
      if (this.fast || ms <= 0) {
        this.tweens.delete(key);
        this.s[key] = to;
        this.render();
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
      for (const [key, t] of this.tweens) {
        const p = clamp01((now - t.start) / t.ms);
        this.s[key] = lerp(t.from, t.to, ease(p));
        if (p >= 1) {
          this.tweens.delete(key);
          t.resolve();
        }
      }
      this.render();
      this.raf = this.tweens.size ? requestAnimationFrame(step) : 0;
    };
    this.raf = requestAnimationFrame(step);
  }

  // Skip: jump every running and future tween to its end
  finish() {
    this.fast = true;
    for (const [key, t] of this.tweens) {
      this.s[key] = t.to;
      t.resolve();
    }
    this.tweens.clear();
    this.render();
  }

  reset() {
    for (const t of this.tweens.values()) t.resolve();
    this.tweens.clear();
    this.fast = false;
    this.target = this.edge = this.highlight = this.route = null;
    Object.assign(this.s, { lock: 0, hl: 0, fly: 0, edge: 0, route: 0, ping: 0 });
    this.render();
  }

  // --- Drawing ---
  render() {
    if (!this.w) return;
    this.onFrame?.();
    const { ctx, mctx, gap, cols, rows, s } = this;
    const cam = this.camera();

    // 1. Land mask: opaque = land, yellow = the visitor's country
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, cols, rows);
    const k = cam.z / gap;
    mctx.setTransform(k, 0, 0, k, (cam.px - cam.tx * cam.z) / gap, (cam.py - cam.ty * cam.z) / gap);
    mctx.fillStyle = "#f00";
    for (const c of this.countries) mctx.fill(c.path, "evenodd");
    if (this.highlight && s.hl > 0) {
      mctx.fillStyle = "#ff0";
      mctx.fill(this.highlight.path, "evenodd");
    }
    const mask = mctx.getImageData(0, 0, cols, rows).data;

    // 2. Dots, batched into a few brightness buckets
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const [mx, my] = this.target ? this.toScreen(cam, this.target.lon, this.target.lat) : [0, 0];
    const glowR = Math.max(80, Math.min(this.w, this.h) * 0.22);
    const r = gap * 0.2;
    const buckets = Array.from({ length: LEVELS * 2 }, () => new Path2D());
    const ocean = new Path2D();
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const idx = (j * cols + i) * 4;
        const x = (i + 0.5) * gap;
        const y = (j + 0.5) * gap;
        // getImageData is not premultiplied, so test coverage (alpha), not colour
        if (mask[idx + 3] < 128) {
          if ((i + j) % 2 === 0) ocean.rect(x - 0.5, y - 0.5, 1, 1);
          continue;
        }
        let glow = 0;
        if (this.target && s.hl > 0) {
          const dx = x - mx, dy = y - my;
          glow = s.hl * Math.exp(-(dx * dx + dy * dy) / (glowR * glowR));
        }
        const cat = mask[idx + 1] > 127 ? 1 : 0;
        const p = buckets[cat * LEVELS + Math.min(LEVELS - 1, Math.round(glow * (LEVELS - 1)))];
        p.moveTo(x + r, y);
        p.arc(x, y, r, 0, TAU);
      }
    }
    ctx.fillStyle = "rgba(148, 163, 184, 0.07)";
    ctx.fill(ocean);
    for (let b = 0; b < buckets.length; b++) {
      const t = (b % LEVELS) / (LEVELS - 1);
      const land = [148, 163, 184, 0.3];
      let c = land.map((v, n) => lerp(v, [226, 232, 240, 0.85][n], t));
      if (b >= LEVELS) {
        const red = [239, 68, 68, 0.8].map((v, n) => lerp(v, [255, 190, 190, 1][n], t));
        c = land.map((v, n) => lerp(v, red[n], s.hl));
      }
      ctx.fillStyle = `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${c[3].toFixed(3)})`;
      ctx.fill(buckets[b]);
    }

    // 3. Intro: dots appear in a ring growing from the centre
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

    if (!this.target) return;
    this.drawRoute(cam);
    this.drawEdge(cam);
    this.drawTarget(mx, my);
  }

  drawRoute(cam) {
    const { ctx, s } = this;
    if (!this.route || s.route <= 0) return;
    const pts = this.route.map(([lon, lat]) => this.toScreen(cam, lon, lat));
    const n = Math.max(1, Math.round((pts.length - 1) * s.route));
    ctx.save();
    ctx.strokeStyle = "rgba(34, 211, 238, 0.85)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    pts.slice(0, n + 1).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    if (s.route < 1) {
      const [hx, hy] = pts[n];
      ctx.fillStyle = "#a5f3fc";
      ctx.beginPath();
      ctx.arc(hx, hy, 3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawEdge(cam) {
    const { ctx, s } = this;
    if (!this.edge || s.edge <= 0) return;
    const [x, y] = this.toScreen(cam, this.edge.lon, this.edge.lat);
    const size = 5 * s.edge;
    ctx.save();
    ctx.globalAlpha = s.edge;
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size, y);
    ctx.closePath();
    ctx.fill();
    // Put the code on the far side when the edge sits right next to the visitor
    ctx.font = `600 11px ${this.font}`;
    const [tx, ty] = this.toScreen(cam, this.target.lon, this.target.lat);
    const near = Math.hypot(tx - x, ty - y) < 48;
    const left = near && tx >= x;
    const label = this.edge.code;
    ctx.fillText(label, left ? x - 9 - ctx.measureText(label).width : x + 9, near && ty <= y ? y + 16 : y - 7);
    ctx.restore();
  }

  drawTarget(mx, my) {
    const { ctx, s, w, h } = this;
    if (s.lock <= 0) return;
    const red = "239, 68, 68";
    ctx.save();
    ctx.font = `10px ${this.font}`;

    // Crosshair lines slide in from the top and right edges
    const lx = lerp(w, mx, s.lock);
    const ly = lerp(0, my, s.lock);
    const gapPx = 22;
    ctx.strokeStyle = `rgba(${red}, ${0.35 * Math.min(1, s.lock * 3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, ly); ctx.lineTo(lx - gapPx, ly);
    ctx.moveTo(lx + gapPx, ly); ctx.lineTo(w, ly);
    ctx.moveTo(lx, 0); ctx.lineTo(lx, ly - gapPx);
    ctx.moveTo(lx, ly + gapPx); ctx.lineTo(lx, h);
    ctx.stroke();

    // Brackets close in on the point
    const b = lerp(70, 14, s.lock);
    const arm = 6;
    ctx.strokeStyle = `rgba(${red}, ${s.lock})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const cx = lx + sx * b, cy = ly + sy * b;
      ctx.moveTo(cx, cy - sy * arm); ctx.lineTo(cx, cy); ctx.lineTo(cx - sx * arm, cy);
    }
    ctx.stroke();

    if (s.lock >= 1) {
      ctx.fillStyle = `rgb(${red})`;
      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, TAU);
      ctx.fill();

      // Coordinate read-outs at the line ends
      ctx.fillStyle = `rgba(${red}, 0.8)`;
      ctx.fillText(formatLat(this.target.lat), 8, my - 6);
      ctx.fillText(formatLon(this.target.lon), mx + 6, h - 8);
      ctx.font = `700 11px ${this.font}`;
      ctx.fillText("YOU", mx + 20, my - 18);
    }

    // One ring that expands and fades when the zoom lands
    if (s.ping > 0 && s.ping < 1) {
      ctx.strokeStyle = `rgba(${red}, ${1 - s.ping})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx, my, 6 + s.ping * 54, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
}
