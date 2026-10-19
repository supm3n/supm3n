// src/scripts/fingerprint/sigil.js
// Turns signal hashes into a deterministic SVG emblem. Each signal owns one
// concentric band; the combined fingerprint sets the symmetry order and accent.

const C = 200; // centre of the 400x400 viewBox
const TAU = Math.PI * 2;
const RED = "#ef4444";
const CYAN = "#22d3ee";
const WHITE = "#e2e8f0";
const MUTED = "#94a3b8";

// Accent hue comes from the fingerprint, inside a few ranges that sit well on the dark stage
const ACCENT_RANGES = [[36, 46], [262, 286], [150, 166], [318, 334], [196, 206]];

const f = (n) => Math.round(n * 100) / 100;

// sfc32 seeded from the first 128 bits of a hex hash
function rng(hex) {
  let a = parseInt(hex.slice(0, 8), 16) | 0;
  let b = parseInt(hex.slice(8, 16), 16) | 0;
  let c = parseInt(hex.slice(16, 24), 16) | 0;
  let d = parseInt(hex.slice(24, 32), 16) | 0;
  const next = () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  const r = () => next();
  r.range = (lo, hi) => lo + next() * (hi - lo);
  r.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  r.bit = (p = 0.5) => next() < p;
  return r;
}

// Angle 0 points up, clockwise
const pt = (r, a) => [f(C + r * Math.sin(a)), f(C - r * Math.cos(a))];

function arc(r, a0, a1) {
  const [x0, y0] = pt(r, a0);
  const [x1, y1] = pt(r, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0} ${y0}A${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

const line = (r0, r1, a, attrs) => {
  const [x0, y0] = pt(r0, a);
  const [x1, y1] = pt(r1, a);
  return `<line class="s" pathLength="1" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" ${attrs}/>`;
};
const path = (d, attrs) => `<path class="s" pathLength="1" d="${d}" ${attrs}/>`;
const circle = (r, attrs) => `<circle class="s" pathLength="1" cx="${C}" cy="${C}" r="${r}" ${attrs}/>`;
const dot = (r, a, size, attrs) => {
  const [x, y] = pt(r, a);
  return `<circle class="f" cx="${x}" cy="${y}" r="${f(size)}" ${attrs}/>`;
};
const poly = (pts, attrs) =>
  `<path class="s" pathLength="1" d="M${pts.map((p) => p.join(" ")).join("L")}Z" ${attrs}/>`;

// Segments of one sector (0..1), mirrored around the sector middle for a seal-like symmetry
function mirroredSegments(r, cuts, keepP = 0.8) {
  const pts = [0];
  for (let i = 0; i < cuts; i++) pts.push(r.range(0.06, 0.46));
  pts.sort((x, y) => x - y);
  pts.push(0.5);
  const half = [];
  for (let i = 0; i < pts.length - 1; i++) {
    if (pts[i + 1] - pts[i] < 0.03) continue;
    if (i === 0 || r.bit(keepP)) half.push([pts[i], pts[i + 1]]);
  }
  const out = [];
  for (const [u0, u1] of half) {
    if (u1 === 0.5) out.push([u0, 1 - u0]);
    else out.push([u0, u1], [1 - u1, 1 - u0]);
  }
  return out;
}

// ---------- Parts (outermost first) ----------
// Each returns SVG markup. ctx: { n, sector, accent, data }

const PARTS = {
  storage(r, { data }) {
    // One rivet per flag on the inner frame: filled when allowed, hollow when not
    const flags = data.flags || Array.from({ length: 7 }, () => r.bit());
    const start = r.range(0, TAU / flags.length);
    return flags.map((on, i) => {
      const a = start + (i * TAU) / flags.length;
      const [x, y] = pt(178, a);
      const s = 3.4;
      const d = `M${x} ${f(y - s)}L${f(x + s)} ${y}L${x} ${f(y + s)}L${f(x - s)} ${y}Z`;
      return on
        ? `<path class="f" d="${d}" fill="${CYAN}"/>`
        : `<path class="s" pathLength="1" d="${d}" fill="#050608" stroke="${CYAN}" stroke-width="1.1"/>`;
    }).join("");
  },

  screen(r, { n, sector }) {
    const k = Math.max(4, Math.round(84 / n));
    const lengths = [12];
    for (let j = 1; j < k; j++) lengths.push(r.bit(0.25) ? 8 : r.bit(0.5) ? 5 : 3);
    // mirror the tick pattern inside each sector
    for (let j = 1; j < k; j++) lengths[k - j] = Math.max(lengths[j], lengths[k - j]);
    let out = "";
    for (let i = 0; i < n * k; i++) {
      const j = i % k;
      const a = (i * sector) / k;
      const major = j === 0;
      out += line(174 - lengths[j], 174, a,
        `stroke="${WHITE}" stroke-width="${major ? 1.6 : 1}" stroke-opacity="${major ? 0.95 : 0.55}"`);
    }
    return out;
  },

  timezone(r, { data }) {
    // 24 hour marks, UTC at the top; your offset gets the red pointer
    const offH = data.offsetMin !== undefined ? Math.round(data.offsetMin / 60) : r.int(-11, 12);
    const here = ((offH % 24) + 24) % 24;
    let out = "";
    for (let h = 0; h < 24; h++) {
      const a = (h * TAU) / 24;
      if (h === here) continue;
      out += r.bit(0.55)
        ? dot(155, a, 1.5, `fill="${CYAN}"`)
        : `<circle class="s" pathLength="1" cx="${pt(155, a)[0]}" cy="${pt(155, a)[1]}" r="1.9" fill="none" stroke="${CYAN}" stroke-width="0.9"/>`;
    }
    const a = (here * TAU) / 24;
    const [tx, ty] = pt(150, a);
    const [lx, ly] = pt(160, a - 0.035);
    const [rx, ry] = pt(160, a + 0.035);
    out += `<path class="f" d="M${tx} ${ty}L${lx} ${ly}L${rx} ${ry}Z" fill="${RED}"/>`;
    out += `<circle class="s" pathLength="1" cx="${pt(155, a)[0]}" cy="${pt(155, a)[1]}" r="5.5" fill="none" stroke="${RED}" stroke-width="1"/>`;
    return out;
  },

  canvas(r, { n, sector }) {
    const segs = mirroredSegments(r, r.int(2, 3), 0.85);
    const thinSegs = mirroredSegments(r, r.int(1, 2), 0.6);
    const gap = 0.02;
    let out = "";
    for (let i = 0; i < n; i++) {
      const base = i * sector;
      for (const [u0, u1] of segs) {
        out += path(arc(144, base + (u0 + gap) * sector, base + (u1 - gap) * sector),
          `fill="none" stroke="${RED}" stroke-width="7"`);
      }
      for (const [u0, u1] of thinSegs) {
        out += path(arc(151, base + (u0 + gap) * sector, base + (u1 - gap) * sector),
          `fill="none" stroke="${RED}" stroke-width="0.8" stroke-opacity="0.7"`);
      }
    }
    return out;
  },

  codecs(r, { n, sector }) {
    const segs = mirroredSegments(r, r.int(2, 4), 0.7);
    let out = "";
    for (let i = 0; i < n; i++) {
      const base = i * sector;
      for (const [u0, u1] of segs) {
        out += path(arc(133, base + (u0 + 0.025) * sector, base + (u1 - 0.025) * sector),
          `fill="none" stroke="${CYAN}" stroke-width="1.6" stroke-linecap="round"`);
      }
      out += dot(133, base, 1.6, `fill="${CYAN}"`);
    }
    return out;
  },

  webgl(r, { n, sector }) {
    let out = circle(125, `fill="none" stroke="${WHITE}" stroke-width="0.9" stroke-opacity="0.8"`);
    out += circle(118, `fill="none" stroke="${WHITE}" stroke-width="0.9" stroke-opacity="0.8"`);
    const rungs = [];
    const count = r.int(1, 3);
    for (let j = 0; j < count; j++) rungs.push(r.range(0.08, 0.46));
    for (let i = 0; i < n; i++) {
      const base = i * sector;
      for (const u of rungs) {
        out += line(118, 125, base + u * sector, `stroke="${WHITE}" stroke-width="1.2"`);
        out += line(118, 125, base + (1 - u) * sector, `stroke="${WHITE}" stroke-width="1.2"`);
      }
      const [x, y] = pt(121.5, base);
      out += `<rect class="f" x="${f(x - 2.6)}" y="${f(y - 2.6)}" width="5.2" height="5.2" fill="${CYAN}" transform="rotate(${f((base * 180) / Math.PI + 45)} ${x} ${y})"/>`;
    }
    return out;
  },

  webgpu(r, { n, sector, accent }) {
    const shape = r.int(0, 2);
    const size = r.range(4, 6.5);
    const filled = r.bit(0.6);
    let out = "";
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) * sector;
      const paint = filled
        ? `fill="${accent}" fill-opacity="0.85" stroke="${accent}" stroke-width="1"`
        : `fill="none" stroke="${accent}" stroke-width="1.2"`;
      if (shape === 0) {
        out += poly([pt(108 + size, a), pt(108 - size * 0.7, a - (size * 0.9) / 108), pt(108 - size * 0.7, a + (size * 0.9) / 108)], paint);
      } else if (shape === 1) {
        out += poly([pt(108 + size, a), pt(108, a + size / 108), pt(108 - size, a), pt(108, a - size / 108)], paint);
      } else {
        const [x, y] = pt(108, a);
        out += `<circle class="s" pathLength="1" cx="${x}" cy="${y}" r="${f(size * 0.7)}" ${paint}/>`;
      }
    }
    return out;
  },

  fonts(r, { n, sector, data }) {
    const count = Math.min(5, Math.max(2, 1 + Math.round((data.count ?? r.int(6, 40)) / 12)));
    const stars = [];
    for (let j = 0; j < count; j++) stars.push([r.range(0.06, 0.47), r.range(88, 101), r.range(1.1, 2.3)]);
    stars.sort((p, q) => p[0] - q[0]);
    let out = "";
    for (let i = 0; i < n; i++) {
      const base = i * sector;
      for (const side of [0, 1]) {
        const pts = stars.map(([u, rad]) => pt(rad, base + (side ? 1 - u : u) * sector));
        out += `<path class="s" pathLength="1" d="M${pts.map((p) => p.join(" ")).join("L")}" fill="none" stroke="${CYAN}" stroke-width="0.7" stroke-opacity="0.6"/>`;
        stars.forEach(([u, rad, s]) => {
          out += dot(rad, base + (side ? 1 - u : u) * sector, s, `fill="${WHITE}"`);
        });
      }
    }
    return out;
  },

  audio(r, { n }) {
    const a1 = r.range(2.2, 4.6);
    const a2 = r.range(0.6, 2.2);
    const p1 = r.range(0, TAU);
    const p2 = r.range(0, TAU);
    const wave = (shift, amp) => {
      const pts = [];
      for (let i = 0; i <= 360; i++) {
        const t = (i / 360) * TAU;
        const rad = 78 + amp * (a1 * Math.sin(n * t + p1 + shift) + a2 * Math.sin(2 * n * t + p2));
        pts.push(pt(rad, t));
      }
      return `M${pts.map((p) => p.join(" ")).join("L")}Z`;
    };
    return path(wave(0, 1), `fill="none" stroke="${RED}" stroke-width="1.4" stroke-linejoin="round"`)
      + path(wave(Math.PI, 0.7), `fill="none" stroke="${RED}" stroke-width="0.8" stroke-opacity="0.45"`);
  },

  math(r, { n, sector }) {
    const m = n >= 7 ? n : n * 2;
    const k = r.int(2, Math.max(2, Math.floor((m - 1) / 2)));
    const rot = r.bit() ? 0 : sector / 2;
    let d = "";
    for (let i = 0; i < m; i++) {
      const [x0, y0] = pt(66, rot + (i * TAU) / m);
      const [x1, y1] = pt(66, rot + (((i + k) % m) * TAU) / m);
      d += `M${x0} ${y0}L${x1} ${y1}`;
    }
    return path(d, `fill="none" stroke="${WHITE}" stroke-width="0.8" stroke-opacity="0.55"`);
  },

  languages(r, { n, sector, data }) {
    const nest = Math.min(3, Math.max(1, data.count ?? r.int(1, 3)));
    const w = r.range(0.18, 0.32);
    const closed = r.bit(0.4);
    let out = "";
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) * sector;
      for (let j = 0; j < nest; j++) {
        const tip = 62 - j * 3.6;
        const back = tip - 6;
        const pts = [pt(back, a - w * sector * 0.5), pt(tip, a), pt(back, a + w * sector * 0.5)];
        const d = `M${pts.map((p) => p.join(" ")).join("L")}${closed && j === 0 ? "Z" : ""}`;
        out += path(d, `fill="none" stroke="${CYAN}" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"`);
      }
    }
    return out;
  },

  platform(r, { n, sector, accent }) {
    const rot = r.bit() ? 0 : sector / 2;
    const outer = Array.from({ length: n }, (_, i) => pt(48, rot + i * sector));
    const inner = Array.from({ length: n }, (_, i) => pt(r.bit(0.5) ? 44 : 41, rot + (i + 0.5) * sector));
    return poly(outer, `fill="none" stroke="${accent}" stroke-width="1.3" stroke-linejoin="round"`)
      + poly(inner, `fill="none" stroke="${accent}" stroke-width="0.8" stroke-opacity="0.55" stroke-linejoin="round"`);
  },

  cpu(r, { data }) {
    // One dot per logical core
    const count = Math.min(64, Math.max(1, data.count || r.int(2, 16)));
    const size = Math.min(1.7, ((TAU * 37.5) / count) * 0.3);
    const start = r.range(0, TAU / count);
    let out = "";
    for (let i = 0; i < count; i++) out += dot(37.5, start + (i * TAU) / count, size, `fill="${WHITE}"`);
    return out;
  },

  media(r, { n, sector, accent }) {
    const w = r.range(0.22, 0.42) * sector;
    const bulge = r.range(0.45, 0.7);
    let out = "";
    for (let i = 0; i < n; i++) {
      const a = i * sector;
      const [bx, by] = pt(14, a);
      const [tx, ty] = pt(33, a);
      const [lx, ly] = pt(14 + 19 * bulge, a - w);
      const [rx, ry] = pt(14 + 19 * bulge, a + w);
      out += `<path class="s" pathLength="1" d="M${bx} ${by}Q${lx} ${ly} ${tx} ${ty}Q${rx} ${ry} ${bx} ${by}Z" fill="${accent}" fill-opacity="0.14" stroke="${accent}" stroke-width="1"/>`;
    }
    return out;
  },

  memory(r, { data }) {
    // log scale: 0.25 GB is a sliver, 32 GB closes the ring
    const frac = data.gb ? Math.min(1, Math.max(0.08, (Math.log2(data.gb) + 2) / 7)) : r.range(0.2, 1);
    let out = circle(9.5, `fill="none" stroke="${RED}" stroke-width="2.2" stroke-opacity="0.2"`);
    out += frac >= 1
      ? circle(9.5, `fill="none" stroke="${RED}" stroke-width="2.2"`)
      : path(arc(9.5, 0, frac * TAU), `fill="none" stroke="${RED}" stroke-width="2.2" stroke-linecap="round"`);
    return out;
  },

  touch(r, { data }) {
    const count = Math.min(10, data.count ?? 0);
    if (!count) return `<circle class="f" cx="${C}" cy="${C}" r="1.8" fill="${WHITE}"/>`;
    let out = `<circle class="f" cx="${C}" cy="${C}" r="1.4" fill="${WHITE}"/>`;
    for (let i = 0; i < count; i++) out += dot(4.6, (i * TAU) / count, 0.9, `fill="${WHITE}"`);
    return out;
  },
};

// Hover bands, [centre radius, width]; together they tile the whole disc
const BANDS = {
  storage: [178, 6], screen: [168, 12], timezone: [155, 8], canvas: [144, 14], codecs: [133, 8],
  webgl: [121.5, 15], webgpu: [107, 14], fonts: [93, 14], audio: [78, 16], math: [65, 10],
  languages: [55, 10], platform: [45, 10], cpu: [37, 6], media: [23, 22], memory: [9, 8], touch: [2.5, 5],
};

export const PART_COLORS = {
  storage: CYAN, screen: WHITE, timezone: CYAN, canvas: RED, codecs: CYAN, webgl: WHITE,
  webgpu: "accent", fonts: WHITE, audio: RED, math: WHITE, languages: CYAN, platform: "accent",
  cpu: WHITE, media: "accent", memory: RED, touch: WHITE,
};

function frame() {
  return `<defs>
      <radialGradient id="fp-disc" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#111722"/>
        <stop offset="70%" stop-color="#0a0d13"/>
        <stop offset="100%" stop-color="#050608" stop-opacity="0"/>
      </radialGradient>
      <path id="fp-ring" d="M${C} ${C - 184}A184 184 0 1 1 ${C - 0.01} ${C - 184}"/>
    </defs>
    <circle cx="${C}" cy="${C}" r="198" fill="url(#fp-disc)"/>
    <g class="frame" fill="none" stroke="${WHITE}">
      <circle cx="${C}" cy="${C}" r="196" stroke-width="0.6" stroke-opacity="0.35"/>
      <circle cx="${C}" cy="${C}" r="178" stroke-width="0.8" stroke-opacity="0.45"/>
      <circle cx="${C}" cy="${C}" r="86" stroke-width="0.5" stroke-opacity="0.18"/>
    </g>`;
}

export function scaffoldSvg() {
  return frame();
}

// seeds: { [signalId]: { hash, data, muted } }, idHash: combined fingerprint hex
export function buildSigil(seeds, idHash) {
  const g = rng(idHash);
  const n = 5 + Math.floor(g() * 8); // symmetry order 5..12
  const [lo, hi] = ACCENT_RANGES[Math.floor(g() * ACCENT_RANGES.length)];
  const accent = `hsl(${Math.round(lo + g() * (hi - lo))} 85% 66%)`;
  const ctx = { n, sector: TAU / n, accent };

  let parts = "";
  let hits = "";
  for (const id of Object.keys(PARTS)) {
    const seed = seeds[id];
    if (!seed) continue;
    const inner = PARTS[id](rng(seed.hash), { ...ctx, data: seed.data || {} });
    // Left out of the ID: faded and dashed. Dashes need real lengths, so drop pathLength there
    parts += seed.muted
      ? `<g class="part muted" data-part="${id}"><g opacity="0.4" stroke-dasharray="3 2.5">${inner.replaceAll(' pathLength="1"', "")}</g></g>`
      : `<g class="part" data-part="${id}"><g>${inner}</g></g>`;
    const [rad, w] = BANDS[id];
    hits += `<circle data-hit="${id}" cx="${C}" cy="${C}" r="${rad}" fill="none" stroke="transparent" stroke-width="${w}"/>`;
  }

  const groups = idHash.toUpperCase().match(/.{4}/g).join(" · ");
  const ring = `<g class="part" data-part="id"><text class="f" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="8.4" fill="${MUTED}" letter-spacing="1"><textPath href="#fp-ring" textLength="1150" lengthAdjust="spacing">FINGERPRINT · ${groups} ·</textPath></text></g>`;

  return {
    n,
    accent,
    markup: `${frame()}<g class="parts">${ring}${parts}</g><g class="hits">${hits}</g>`,
  };
}

// Standalone SVG text for download: static, no hover layer, with a background
export function exportSvg(svgEl, size = 1024) {
  const clone = svgEl.cloneNode(true);
  clone.querySelector(".hits")?.remove();
  clone.removeAttribute("class");
  clone.removeAttribute("aria-hidden");
  clone.querySelectorAll("[class]").forEach((el) => el.removeAttribute("class"));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", size);
  clone.setAttribute("height", size);
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", "400");
  bg.setAttribute("height", "400");
  bg.setAttribute("fill", "#050608");
  clone.insertBefore(bg, clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
}
