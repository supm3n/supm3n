// src/scripts/sky/dome.js
// All-sky chart on two stacked canvases: a base layer (sky tint, grid, stars,
// Sun, Moon, planets) redrawn about once a minute, and a live layer
// (satellites, trails, highlight) redrawn every frame.
// Projection: zenith at the centre, horizon on the rim, north up and east on
// the LEFT, as when lying on your back looking up with your head to the south.

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;

// Sky colour by sun altitude: night → astronomical → nautical → civil → day
const SKY = [
  [-18, [6, 8, 14]],
  [-12, [9, 13, 26]],
  [-6, [14, 23, 44]],
  [0, [22, 37, 66]],
  [12, [27, 48, 84]],
];
function skyColor(sunAlt) {
  if (sunAlt <= SKY[0][0]) return SKY[0][1];
  for (let i = 1; i < SKY.length; i++) {
    if (sunAlt <= SKY[i][0]) {
      const t = (sunAlt - SKY[i - 1][0]) / (SKY[i][0] - SKY[i - 1][0]);
      return SKY[i][1].map((c, k) => lerp(SKY[i - 1][1][k], c, t));
    }
  }
  return SKY[SKY.length - 1][1];
}
const rgb = (c, a = 1) => `rgba(${c.map(Math.round).join(",")},${a})`;

// Faintest magnitude shown at full strength, by sun altitude (rough naked eye)
const limitingMag = (sunAlt) => lerp(-1.5, 4.8, clamp01((-sunAlt - 1) / 15));

// Subtle star tint from B-V colour index
const BV = [
  [-0.3, [196, 214, 255]],
  [0.0, [226, 234, 255]],
  [0.4, [255, 250, 242]],
  [0.8, [255, 242, 222]],
  [1.2, [255, 230, 200]],
  [1.8, [255, 214, 176]],
];
function starColor(bv) {
  if (bv == null) return "rgb(235,240,255)";
  if (bv <= BV[0][0]) return rgb(BV[0][1]);
  for (let i = 1; i < BV.length; i++) {
    if (bv <= BV[i][0]) {
      const t = (bv - BV[i - 1][0]) / (BV[i][0] - BV[i - 1][0]);
      return rgb(BV[i][1].map((c, k) => lerp(BV[i - 1][1][k], c, t)));
    }
  }
  return rgb(BV[BV.length - 1][1]);
}

export const vecFromAltAz = (alt, az) => [
  Math.cos(alt * DEG) * Math.sin(az * DEG),
  Math.cos(alt * DEG) * Math.cos(az * DEG),
  Math.sin(alt * DEG),
];

// Moon disc with the lit side towards screen angle `ang` (radians)
export function drawMoon(ctx, x, y, r, fraction, ang) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = "rgba(71, 85, 105, 0.55)";
  ctx.fill();
  if (fraction > 0.005) {
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    ctx.ellipse(0, 0, r * Math.abs(1 - 2 * fraction), r, 0, Math.PI / 2, -Math.PI / 2, fraction < 0.5);
    ctx.fillStyle = "#e7e5e4";
    ctx.fill();
  }
  ctx.restore();
}

export class Dome {
  constructor(base, live) {
    this.base = base;
    this.live = live;
    this.bctx = base.getContext("2d");
    this.lctx = live.getContext("2d");
    this.font = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() || "monospace";
    this.hits = [];
    this.satHits = [];
  }

  // Screen angle of the Moon's lit limb: it faces the Sun along the great
  // circle between them, so step a little that way and see where it lands.
  moonAngle(sun, moon) {
    const m = vecFromAltAz(moon.alt, moon.az);
    const s = vecFromAltAz(sun.alt, sun.az);
    const d = s[0] * m[0] + s[1] * m[1] + s[2] * m[2];
    const tv = [s[0] - d * m[0], s[1] - d * m[1], s[2] - d * m[2]];
    const tl = Math.hypot(...tv) || 1;
    const q = m.map((v, i) => v + (0.02 * tv[i]) / tl);
    const [qx, qy] = this.projectVec(q[0], q[1], q[2]);
    const [mx, my] = this.projectVec(m[0], m[1], m[2]);
    return Math.atan2(qy - my, qx - mx);
  }

  resize() {
    const size = Math.round(this.base.parentElement.clientWidth);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [this.base, this.live]) {
      c.width = Math.round(size * dpr);
      c.height = Math.round(size * dpr);
    }
    this.dpr = dpr;
    this.size = size;
    this.c = size / 2;
    this.R = size / 2 - (size < 420 ? 20 : 26);
    this.k = Math.max(0.8, Math.min(1.35, this.R / 180));
  }

  project(alt, az) {
    const rho = ((90 - alt) / 90) * this.R;
    return [this.c - rho * Math.sin(az * DEG), this.c - rho * Math.cos(az * DEG)];
  }

  projectVec(e, n, u) {
    const alt = Math.atan2(u, Math.hypot(e, n)) / DEG;
    const rho = ((90 - alt) / 90) * this.R;
    const h = Math.hypot(e, n) || 1;
    return [this.c - (rho * e) / h, this.c - (rho * n) / h];
  }

  // ---- Base layer ----
  // scene: { sunAlt, sun, moon, planets, stars, starAltAz, names, lines, hrIndex } (any may be missing)
  // t: intro progress 0..1
  drawBase(scene, t = 1) {
    const ctx = this.bctx;
    const { c, R, k } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.size, this.size);
    this.hits = [];

    const pGrid = easeOut(clamp01(t / 0.35));
    const pStars = clamp01((t - 0.3) / 0.35);
    const pBodies = clamp01((t - 0.55) / 0.3);
    const sunAlt = scene.sun ? scene.sun.alt : -30;

    // Sky disc
    ctx.save();
    ctx.globalAlpha = pGrid;
    const sky = skyColor(sunAlt);
    const g = ctx.createRadialGradient(c, c, 0, c, c, R);
    g.addColorStop(0, rgb(sky));
    g.addColorStop(1, rgb(sky.map((v) => v * 0.72)));
    ctx.beginPath();
    ctx.arc(c, c, R, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();

    // Warm twilight glow on the horizon under the Sun
    if (scene.sun && sunAlt > -18 && sunAlt < 12) {
      const a = 0.22 * (1 - Math.abs(sunAlt + 3) / 15);
      if (a > 0) {
        const [gx, gy] = this.project(0, scene.sun.az);
        const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, R * 0.95);
        glow.addColorStop(0, `rgba(251, 146, 60, ${a})`);
        glow.addColorStop(1, "rgba(251, 146, 60, 0)");
        ctx.save();
        ctx.clip();
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, this.size, this.size);
        ctx.restore();
      }
    }
    ctx.restore();

    this.drawGrid(ctx, pGrid);

    // Stars and constellation figures
    const stars = scene.stars;
    if (stars && scene.starAltAz && pStars > 0) {
      const lim = limitingMag(sunAlt);
      const night = clamp01((-sunAlt - 6) / 10);
      const pos = scene.starAltAz;

      if (scene.lines && night > 0) {
        ctx.strokeStyle = `rgba(148, 163, 184, ${0.22 * night * pStars})`;
        ctx.lineWidth = 0.8;
        ctx.save();
        this.clipDisc(ctx);
        ctx.beginPath();
        for (const fig of scene.lines) {
          for (const [a, b] of fig.segs) {
            const i = scene.hrIndex.get(a), j = scene.hrIndex.get(b);
            if (i == null || j == null) continue;
            if (pos[i * 2] < 0 && pos[j * 2] < 0) continue;
            const [x1, y1] = this.project(pos[i * 2], pos[i * 2 + 1]);
            const [x2, y2] = this.project(pos[j * 2], pos[j * 2 + 1]);
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
          }
        }
        ctx.stroke();
        ctx.restore();
      }

      for (let i = 0; i < stars.length; i++) {
        const alt = pos[i * 2];
        if (alt < 0) continue;
        const [hr, , , mag, bv] = stars[i];
        const vis = clamp01(lim - mag + 0.6);
        const alpha = (0.1 + 0.9 * vis) * pStars;
        if (alpha < 0.03) continue;
        const [x, y] = this.project(alt, pos[i * 2 + 1]);
        const r = Math.max(0.55, Math.min(3.6, 2.9 - 0.5 * mag)) * k;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = starColor(bv);
        if (mag < 1.2 && vis > 0.5) {
          const halo = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 3.2);
          halo.addColorStop(0, "rgba(226, 232, 240, 0.22)");
          halo.addColorStop(1, "rgba(226, 232, 240, 0)");
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(x, y, r * 3.2, 0, TAU);
          ctx.fill();
          ctx.fillStyle = starColor(bv);
        }
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
        const name = scene.names?.[hr];
        if (name) {
          this.hits.push({ id: `star-${hr}`, kind: "star", name, mag, alt, az: pos[i * 2 + 1], x, y, r: r + 2 });
          if (mag < 1.0 && vis > 0.6 && R > 140) {
            ctx.globalAlpha = 0.45 * alpha;
            ctx.font = `${10 * Math.min(1.1, k)}px ${this.font}`;
            ctx.fillStyle = "#94a3b8";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(name, x + r + 4, y);
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    if (pBodies > 0) this.drawBodies(ctx, scene, pBodies);
  }

  // Label beside a marker, flipped to the left near the western rim
  label(ctx, text, x, y, off) {
    const flip = x > this.c + this.R * 0.55;
    ctx.textAlign = flip ? "right" : "left";
    ctx.fillText(text, flip ? x - off : x + off, y);
  }

  clipDisc(ctx) {
    ctx.beginPath();
    ctx.arc(this.c, this.c, this.R, 0, TAU);
    ctx.clip();
  }

  drawGrid(ctx, p) {
    const { c, R, k } = this;
    ctx.save();
    // Altitude rings at 30° and 60°
    ctx.globalAlpha = p;
    ctx.setLineDash([2, 5]);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.16)";
    ctx.lineWidth = 1;
    for (const alt of [30, 60]) {
      ctx.beginPath();
      ctx.arc(c, c, (R * (90 - alt)) / 90, 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Spokes every 45°
    ctx.strokeStyle = "rgba(148, 163, 184, 0.07)";
    ctx.beginPath();
    for (let az = 0; az < 360; az += 45) {
      const [x, y] = this.project(0, az);
      ctx.moveTo(c, c);
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Horizon rim, drawn in clockwise from north during the intro
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(148, 163, 184, 0.42)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(c, c, R, -Math.PI / 2, -Math.PI / 2 + TAU * p);
    ctx.stroke();

    // Ticks every 10°
    ctx.globalAlpha = p;
    ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
    ctx.beginPath();
    for (let az = 0; az < 360; az += 10) {
      const long = az % 90 === 0 ? 7 : az % 30 === 0 ? 4.5 : 2.5;
      const [x1, y1] = this.project(0, az);
      const s = Math.sin(az * DEG), co = Math.cos(az * DEG);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + s * long, y1 + co * long);
    }
    ctx.stroke();

    // Cardinal letters outside the rim (east on the left: we look up)
    ctx.font = `600 ${11 * Math.min(1.15, k)}px ${this.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const off = this.size < 420 ? 11 : 15;
    for (const [lbl, az] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]]) {
      const x = c - (R + off) * Math.sin(az * DEG);
      const y = c - (R + off) * Math.cos(az * DEG);
      ctx.fillStyle = lbl === "N" ? "#ef4444" : "#94a3b8";
      ctx.fillText(lbl, x, y);
    }
    // Altitude ring labels along the north-west spoke
    ctx.font = `${9 * Math.min(1.1, k)}px ${this.font}`;
    ctx.fillStyle = "rgba(148, 163, 184, 0.45)";
    for (const alt of [30, 60]) {
      const [x, y] = this.project(alt, 315 + 4);
      ctx.fillText(`${alt}°`, x, y);
    }
    ctx.restore();
  }

  drawBodies(ctx, scene, p) {
    const { k } = this;
    ctx.save();
    ctx.globalAlpha = p;
    ctx.font = `${11 * Math.min(1.1, k)}px ${this.font}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    for (const pl of scene.planets || []) {
      if (pl.alt < -0.5) continue;
      const [x, y] = this.project(Math.max(0, pl.alt), pl.az);
      const r = (pl.eye ? Math.max(1.8, Math.min(3.6, 2.6 - 0.35 * pl.mag)) : 1.3) * k;
      ctx.fillStyle = pl.color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      if (pl.eye) {
        ctx.strokeStyle = pl.color;
        ctx.globalAlpha = p * 0.35;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, r + 3.5 * k, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = p * 0.9;
        this.label(ctx, pl.name, x, y, r + 6 * k);
        ctx.globalAlpha = p;
      }
      this.hits.push({ id: pl.id, kind: "planet", name: pl.name, x, y, r: r + 3 });
    }

    const moon = scene.moon;
    if (moon && moon.alt > -0.5) {
      const [x, y] = this.project(Math.max(0, moon.alt), moon.az);
      const r = 6 * k;
      const halo = ctx.createRadialGradient(x, y, r, x, y, r * 3);
      halo.addColorStop(0, `rgba(231, 229, 228, ${0.05 + 0.12 * moon.fraction})`);
      halo.addColorStop(1, "rgba(231, 229, 228, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, r * 3, 0, TAU);
      ctx.fill();
      drawMoon(ctx, x, y, r, moon.fraction, this.moonAngle(scene.sun, moon));
      ctx.fillStyle = "#cbd5e1";
      ctx.globalAlpha = p * 0.9;
      this.label(ctx, "Moon", x, y, r + 6 * k);
      ctx.globalAlpha = p;
      this.hits.push({ id: "moon", kind: "moon", name: "Moon", x, y, r: r + 2 });
    }

    const sun = scene.sun;
    if (sun && sun.alt > -0.5) {
      const [x, y] = this.project(Math.max(0, sun.alt), sun.az);
      const r = 6 * k;
      const glow = this.bctx.createRadialGradient(x, y, r * 0.5, x, y, r * 4);
      glow.addColorStop(0, "rgba(253, 230, 138, 0.35)");
      glow.addColorStop(1, "rgba(253, 230, 138, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * 4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#fde68a";
      ctx.globalAlpha = p * 0.9;
      this.label(ctx, "Sun", x, y, r + 6 * k);
      this.hits.push({ id: "sun", kind: "sun", name: "Sun", x, y, r: r + 2 });
    }
    ctx.restore();
  }

  // ---- Live layer ----
  // sats: [{ id, label, iss, station, v:{e,n,u}, status, trail:[{e,n,u}] }]
  drawLive(sats, highlight, p = 1) {
    const ctx = this.lctx;
    const { k } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.size, this.size);
    this.satHits = [];
    const labels = [];
    let hl = null;

    if (p > 0) {
      ctx.save();
      this.clipDisc(ctx);
      ctx.globalAlpha = p;
      ctx.lineCap = "round";

      // Trails: oldest part faintest, drawn in a few alpha bands
      for (const s of sats) {
        const pts = s.trail.concat([s.v]).map((v) => this.projectVec(v.e, v.n, v.u));
        if (pts.length < 2) continue;
        const color = s.iss ? "239, 68, 68" : s.station ? "34, 211, 238" : "226, 232, 240";
        const base = s.status === "shadow" ? 0.18 : 0.38;
        const BANDS = 5;
        const per = Math.ceil((pts.length - 1) / BANDS);
        ctx.lineWidth = (s.iss ? 1.6 : 1.1) * k;
        for (let b = 0; b < BANDS; b++) {
          const i0 = b * per;
          const i1 = Math.min(pts.length - 1, i0 + per);
          if (i0 >= i1) continue;
          ctx.strokeStyle = `rgba(${color}, ${(base * (b + 1)) / BANDS})`;
          ctx.beginPath();
          ctx.moveTo(pts[i0][0], pts[i0][1]);
          for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(pts[i][0], pts[i][1]);
          ctx.stroke();
        }
      }

      for (const s of sats) {
        if (s.v.u < 0) continue;
        const [x, y] = this.projectVec(s.v.e, s.v.n, s.v.u);
        const r = (s.iss ? 3.2 : s.station ? 2.6 : 1.8) * k;
        const color = s.iss ? "#ef4444" : s.station ? "#22d3ee" : s.status === "visible" ? "#f8fafc" : "#94a3b8";
        if (s.status === "shadow") {
          ctx.strokeStyle = color;
          ctx.globalAlpha = p * (s.iss || s.station ? 0.8 : 0.55);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, TAU);
          ctx.stroke();
        } else {
          ctx.fillStyle = color;
          ctx.globalAlpha = p * (s.status === "visible" || s.iss || s.station ? 1 : 0.75);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, TAU);
          ctx.fill();
        }
        if (s.named) labels.push([s.label, color, x, y, r + 6 * k]);
        ctx.globalAlpha = p;
        this.satHits.push({ id: s.id, kind: "sat", name: s.label, x, y, r: r + 3 });
      }
      ctx.restore();

      // Station labels outside the clip so they never get cut at the rim
      ctx.save();
      ctx.globalAlpha = p * 0.9;
      ctx.font = `600 ${11 * Math.min(1.1, k)}px ${this.font}`;
      ctx.textBaseline = "middle";
      for (const [text, color, x, y, off] of labels) {
        ctx.fillStyle = color;
        this.label(ctx, text, x, y, off);
      }
      ctx.restore();
    }

    // Highlight ring
    if (highlight) {
      hl = this.satHits.find((h) => h.id === highlight) || this.hits.find((h) => h.id === highlight) || null;
      if (hl) {
        ctx.strokeStyle = "rgba(34, 211, 238, 0.9)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(hl.x, hl.y, Math.max(9, hl.r + 6) * Math.min(1.2, k), 0, TAU);
        ctx.stroke();
      }
    }
    return hl;
  }

  // Nearest object within a finger's reach of (x, y) in CSS px
  hitTest(x, y) {
    let best = null, bestD = Infinity;
    for (const h of this.satHits.concat(this.hits)) {
      const d = Math.hypot(h.x - x, h.y - y) - h.r;
      // Prefer planets/Sun/Moon/satellites over stars at similar distance
      const score = h.kind === "star" ? d + 4 : d;
      if (score < bestD) { bestD = score; best = h; }
    }
    return bestD < 16 ? best : null;
  }
}
