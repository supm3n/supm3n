// src/scripts/fingerprint/signals.js
// Browser fingerprint collectors for /fingerprint. Everything runs locally:
// no network requests, nothing written to storage.

export async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// ---------- Canvas ----------

function drawCanvas() {
  const c = document.createElement("canvas");
  c.width = 240;
  c.height = 60;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no 2d");
  const g = ctx.createLinearGradient(0, 0, 240, 60);
  g.addColorStop(0, "#ef4444");
  g.addColorStop(0.5, "#22d3ee");
  g.addColorStop(1, "#a78bfa");
  ctx.fillStyle = "#0b0d12";
  ctx.fillRect(0, 0, 240, 60);
  ctx.fillStyle = g;
  ctx.fillRect(6, 6, 90, 22);
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "rgba(255, 102, 0, 0.8)";
  ctx.beginPath();
  ctx.arc(60, 34, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(0, 200, 255, 0.7)";
  ctx.beginPath();
  ctx.arc(84, 30, 18, 0, Math.PI * 1.6);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.textBaseline = "alphabetic";
  ctx.font = "15px 'Times New Roman', serif";
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText("Cwm fjordbank glyphs vext quiz", 100, 22);
  ctx.font = "italic 13px Arial, sans-serif";
  ctx.fillStyle = "rgba(34, 211, 238, 0.85)";
  ctx.fillText("sphinx of black quartz \u{1F98A}\u{1F308}", 104, 44);
  ctx.strokeStyle = "rgba(239, 68, 68, 0.9)";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(4, 56);
  ctx.bezierCurveTo(60, 20, 140, 70, 236, 40);
  ctx.stroke();
  ctx.shadowColor = "#fbbf24";
  ctx.shadowBlur = 6;
  ctx.font = "18px monospace";
  ctx.fillStyle = "#fbbf24";
  ctx.fillText("☃Ω", 210, 26);
  return c.toDataURL();
}

async function canvasSignal() {
  const a = drawCanvas();
  const b = drawCanvas();
  const hashA = await sha256(a);
  const hashB = await sha256(b);
  const noisy = hashA !== hashB;
  return {
    display: noisy ? `noisy · ${hashA.slice(0, 8)} ≠ ${hashB.slice(0, 8)}` : `render ${hashA.slice(0, 12)}`,
    raw: hashA,
    noisy,
    image: a,
  };
}

// ---------- WebGL ----------

function cleanGpu(raw) {
  if (!raw) return null;
  const angle = raw.match(/^ANGLE \((.*)\)$/);
  if (angle) raw = angle[1].split(", ")[1] || angle[1];
  return raw
    .replace(/\s*\(0x[0-9a-f]+\)/i, "")
    .replace(/\s*Direct3D.*$/i, "")
    .replace(/\s*vs_\d_\d.*$/i, "")
    .replace(/^ANGLE Metal Renderer:\s*/i, "")
    .trim();
}

function webglSignal() {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) return { display: "not available", raw: "none", stable: true };
  try {
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const params = [
      "MAX_TEXTURE_SIZE", "MAX_RENDERBUFFER_SIZE", "MAX_VIEWPORT_DIMS", "MAX_VERTEX_ATTRIBS",
      "MAX_VARYING_VECTORS", "MAX_VERTEX_UNIFORM_VECTORS", "MAX_FRAGMENT_UNIFORM_VECTORS",
      "MAX_COMBINED_TEXTURE_IMAGE_UNITS", "MAX_TEXTURE_IMAGE_UNITS", "MAX_CUBE_MAP_TEXTURE_SIZE",
      "ALIASED_LINE_WIDTH_RANGE", "ALIASED_POINT_SIZE_RANGE", "SHADING_LANGUAGE_VERSION",
    ].map((p) => {
      const v = gl.getParameter(gl[p]);
      return `${p}=${v && typeof v === "object" ? Array.from(v).join(",") : v}`;
    });
    const exts = (gl.getSupportedExtensions() || []).slice().sort();
    const name = cleanGpu(String(renderer)) || "unknown GPU";
    return {
      display: `${name} · ${plural(exts.length, "extension")}`,
      raw: [vendor, renderer, ...params, ...exts].join("|"),
    };
  } finally {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

// ---------- Audio ----------

async function renderAudio() {
  const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx(1, 5000, 44100);
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = 10000;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -50;
  comp.knee.value = 40;
  comp.ratio.value = 12;
  comp.attack.value = 0;
  comp.release.value = 0.25;
  osc.connect(comp);
  comp.connect(ctx.destination);
  osc.start(0);
  const buffer = await new Promise((resolve, reject) => {
    ctx.oncomplete = (e) => resolve(e.renderedBuffer);
    const p = ctx.startRendering();
    if (p && p.then) p.then(resolve, reject);
  });
  const data = buffer.getChannelData(0);
  let sum = 0;
  for (let i = 4500; i < 5000; i++) sum += Math.abs(data[i]);
  return sum;
}

async function audioSignal() {
  const a = await renderAudio();
  if (a === null) return { display: "not available", raw: "none" };
  const b = await renderAudio();
  const noisy = a !== b;
  return {
    display: noisy ? "noisy · differs each read" : `sum ${a.toFixed(9)}`,
    raw: String(a),
    noisy,
  };
}

// ---------- Fonts ----------

const FONTS = [
  "Arial", "Arial Black", "Arial Narrow", "Bahnschrift", "Calibri", "Cambria", "Candara",
  "Cascadia Code", "Comic Sans MS", "Consolas", "Constantia", "Corbel", "Courier New",
  "Franklin Gothic Medium", "Gabriola", "Georgia", "Impact", "Ink Free", "Leelawadee UI",
  "Lucida Console", "Lucida Sans Unicode", "Malgun Gothic", "Microsoft YaHei", "MS Gothic",
  "Palatino Linotype", "Segoe Print", "Segoe Script", "Segoe UI", "Sitka Text", "Sylfaen",
  "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana", "Yu Gothic",
  "American Typewriter", "Apple Chancery", "Avenir", "Avenir Next", "Baskerville", "Chalkboard",
  "Didot", "Futura", "Geneva", "Gill Sans", "Helvetica", "Helvetica Neue", "Hoefler Text",
  "Marker Felt", "Menlo", "Monaco", "Optima", "Skia",
  "Cantarell", "DejaVu Sans", "Droid Sans", "Fira Sans", "Inter", "JetBrains Mono",
  "Liberation Sans", "Noto Sans", "Roboto", "Source Code Pro", "Ubuntu",
];

function fontsSignal() {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) throw new Error("no 2d");
  const sample = "mmmmmmmmmmlli WwQ@#&1ij 0Oo";
  const bases = ["monospace", "serif", "sans-serif"];
  const measure = (font) => {
    ctx.font = `48px ${font}`;
    const m = ctx.measureText(sample);
    return `${m.width.toFixed(2)}:${(m.actualBoundingBoxAscent ?? 0).toFixed(2)}`;
  };
  const base = bases.map(measure);
  const found = FONTS.filter((f) => bases.some((b, i) => measure(`"${f}", ${b}`) !== base[i]));
  const shown = found.slice(0, 3).join(", ");
  return {
    display: found.length
      ? `${found.length} of ${FONTS.length} · ${shown}${found.length > 3 ? "…" : ""}`
      : `0 of ${FONTS.length} detected`,
    raw: found.join("|"),
    count: found.length,
  };
}

// ---------- Screen ----------

function screenSignal() {
  const dpr = window.devicePixelRatio || 1;
  const s = window.screen;
  return {
    display: `${s.width}×${s.height} · @${+dpr.toFixed(2)}x · ${s.colorDepth}-bit`,
    raw: [s.width, s.height, s.availWidth, s.availHeight, dpr, s.colorDepth, s.pixelDepth].join("|"),
  };
}

// ---------- Time zone and locale ----------

function timezoneSignal() {
  const opts = Intl.DateTimeFormat().resolvedOptions();
  const offsetMin = -new Date().getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "−";
  const abs = Math.abs(offsetMin);
  const off = `UTC${sign}${Math.floor(abs / 60)}${abs % 60 ? `:${String(abs % 60).padStart(2, "0")}` : ""}`;
  const number = new Intl.NumberFormat().format(1234567.891);
  const date = new Intl.DateTimeFormat(undefined, { dateStyle: "short" }).format(new Date(2001, 1, 3));
  const hc = new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hourCycle;
  return {
    display: `${opts.timeZone} · ${off} · ${opts.locale} · ${number}`,
    // January and July offsets instead of today's, so daylight saving does not change it
    raw: [
      opts.timeZone, opts.locale, opts.calendar, opts.numberingSystem, hc, number, date,
      new Date(2024, 0, 1).getTimezoneOffset(), new Date(2024, 6, 1).getTimezoneOffset(),
    ].join("|"),
    offsetMin: -new Date(2024, 0, 1).getTimezoneOffset(),
  };
}

// ---------- Languages ----------

function languagesSignal() {
  const langs = navigator.languages?.length ? [...navigator.languages] : [navigator.language];
  return { display: langs.join(", "), raw: langs.join("|"), count: langs.length };
}

// ---------- Platform and browser ----------

function uaGuess(ua) {
  const os = /Windows/.test(ua) ? "Windows"
    : /iPhone|iPad/.test(ua) ? "iOS"
    : /Mac OS X/.test(ua) ? "macOS"
    : /Android/.test(ua) ? "Android"
    : /CrOS/.test(ua) ? "ChromeOS"
    : /Linux/.test(ua) ? "Linux"
    : "unknown OS";
  const m = ua.match(/(Edg|OPR|Firefox|FxiOS|CriOS|Chrome|Version)\/(\d+)/);
  const names = { Edg: "Edge", OPR: "Opera", FxiOS: "Firefox", CriOS: "Chrome", Version: "Safari" };
  const browser = m ? `${names[m[1]] || m[1]} ${m[2]}` : "unknown browser";
  return { os, browser, browserName: browser.split(" ")[0] };
}

async function platformSignal() {
  const ua = navigator.userAgent;
  const uad = navigator.userAgentData;
  let { os, browser, browserName } = uaGuess(ua);
  let arch = "";
  if (uad) {
    const brand = uad.brands?.find((b) => !/not.?a.?brand|chromium/i.test(b.brand))
      || uad.brands?.find((b) => /chromium/i.test(b.brand));
    if (brand) {
      browserName = brand.brand.replace(/^Google /, "").replace(/^Microsoft /, "");
      browser = `${browserName} ${brand.version}`;
    }
    try {
      const hi = await uad.getHighEntropyValues(["platformVersion", "architecture", "bitness"]);
      os = uad.platform || os;
      if (os === "Windows" && hi.platformVersion) {
        os = parseInt(hi.platformVersion, 10) >= 13 ? "Windows 11" : "Windows 10";
      }
      if (hi.architecture) arch = `${hi.architecture}${hi.bitness ? ` ${hi.bitness}-bit` : ""}`;
    } catch {
      /* high-entropy values refused: keep the basic guess */
    }
  }
  return {
    display: [browser, os, arch].filter(Boolean).join(" · "),
    // Version numbers stay out of the hash so the sigil survives browser updates
    raw: [browserName, os, arch, navigator.platform].join("|"),
  };
}

// ---------- Hardware ----------

function cpuSignal() {
  const n = navigator.hardwareConcurrency;
  if (!n) return { display: "hidden", raw: "hidden", count: 0 };
  return { display: plural(n, "logical core"), raw: String(n), count: n };
}

function memorySignal() {
  const gb = navigator.deviceMemory;
  if (!gb) return { display: "not reported", raw: "none", gb: 0 };
  // Browsers round down to a power of two and cap the value, so big machines
  // read the same (64 GB shows as the cap)
  return { display: `${gb} GB${gb >= 8 ? " or more" : ""}, as your browser reports it`, raw: String(gb), gb };
}

function touchSignal() {
  const n = navigator.maxTouchPoints || 0;
  return { display: n ? plural(n, "touch point") : "no touch screen", raw: String(n), count: n };
}

// ---------- Media features ----------

const MEDIA = [
  ["dark", "(prefers-color-scheme: dark)"],
  ["reduced motion", "(prefers-reduced-motion: reduce)"],
  ["more contrast", "(prefers-contrast: more)"],
  ["forced colors", "(forced-colors: active)"],
  ["HDR", "(dynamic-range: high)"],
  ["P3 color", "(color-gamut: p3)"],
  ["fine pointer", "(pointer: fine)"],
  ["coarse pointer", "(pointer: coarse)"],
  ["hover", "(hover: hover)"],
  ["inverted", "(inverted-colors: inverted)"],
  ["reduced transparency", "(prefers-reduced-transparency: reduce)"],
];

function mediaSignal() {
  const on = MEDIA.filter(([, q]) => matchMedia(q).matches).map(([name]) => name);
  if (!matchMedia("(prefers-color-scheme: dark)").matches) on.unshift("light");
  return { display: on.join(" · ") || "defaults", raw: on.join("|"), flags: on.length };
}

// ---------- Math quirks ----------

function mathSignal() {
  const results = [
    Math.tan(-1e300), Math.sinh(1), Math.cosh(10), Math.expm1(1), Math.log1p(10),
    Math.cbrt(100), Math.atanh(0.5), Math.acosh(1e300), Math.exp(10), Math.pow(Math.PI, -100),
    Math.sin(1e37), Math.atan2(0.5, 0.11),
  ];
  return { display: `tan(−1e300) = ${results[0].toPrecision(10)}`, raw: results.join("|") };
}

// ---------- Codecs ----------

const CODECS = [
  'video/mp4; codecs="avc1.42E01E"', 'video/mp4; codecs="hev1.1.6.L93.B0"', 'video/mp4; codecs="av01.0.05M.08"',
  'video/webm; codecs="vp8"', 'video/webm; codecs="vp9"', 'video/webm; codecs="av01.0.05M.08"',
  'video/ogg; codecs="theora"', 'video/x-matroska', "application/vnd.apple.mpegurl",
  'audio/mp4; codecs="mp4a.40.2"', 'audio/mp4; codecs="ac-3"', 'audio/mp4; codecs="ec-3"',
  'audio/mp4; codecs="flac"', "audio/mpeg", 'audio/ogg; codecs="vorbis"', 'audio/ogg; codecs="opus"',
  'audio/webm; codecs="opus"', 'audio/wav; codecs="1"', "audio/aac", "audio/x-m4a",
];

function codecsSignal() {
  const v = document.createElement("video");
  const answers = CODECS.map((t) => {
    const play = v.canPlayType(t);
    const mse = window.MediaSource?.isTypeSupported?.(t) ? "m" : "";
    return `${play}${mse}`;
  });
  const yes = answers.filter((a) => a && a !== "m").length;
  return { display: `${yes} of ${CODECS.length} formats playable`, raw: answers.join("|"), count: yes };
}

// ---------- Storage and privacy flags (read only, nothing written) ----------

function storageSignal() {
  const has = (name) => {
    try {
      return !!window[name];
    } catch {
      return false;
    }
  };
  const flags = [
    ["cookies", navigator.cookieEnabled],
    ["localStorage", has("localStorage")],
    ["sessionStorage", has("sessionStorage")],
    ["IndexedDB", has("indexedDB")],
    ["PDF viewer", navigator.pdfViewerEnabled],
    ["Do Not Track", navigator.doNotTrack === "1" || window.doNotTrack === "1"],
    ["GPC", navigator.globalPrivacyControl === true],
  ];
  const on = flags.filter(([, v]) => v).map(([k]) => k);
  return {
    display: on.join(" · ") || "everything off",
    raw: flags.map(([k, v]) => `${k}=${!!v}`).join("|"),
    flags: flags.map(([, v]) => !!v),
  };
}

// ---------- WebGPU ----------

async function webgpuSignal() {
  if (!navigator.gpu) return { display: "not available", raw: "none" };
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return { display: "no adapter", raw: "no-adapter" };
  let info = adapter.info;
  if (!info && adapter.requestAdapterInfo) info = await adapter.requestAdapterInfo();
  info = info || {};
  const features = [...(adapter.features || [])].sort();
  const limits = ["maxTextureDimension2D", "maxBufferSize", "maxComputeWorkgroupStorageSize", "maxBindGroups"]
    .map((k) => adapter.limits?.[k]);
  const name = [info.vendor, info.architecture].filter(Boolean).join(" · ") || "adapter found";
  return {
    display: `${name} · ${plural(features.length, "feature")}`,
    raw: [info.vendor, info.architecture, info.device, info.description, ...features, ...limits].join("|"),
  };
}

// ---------- Registry ----------
// bits: rough population estimates from public fingerprinting studies, not measured here.

export const SIGNALS = [
  { id: "canvas", label: "Canvas render", bits: 9, run: canvasSignal,
    why: "The same drawing comes out a few pixels different depending on your GPU, drivers and font smoothing." },
  { id: "webgl", label: "Graphics card", bits: 7, run: webglSignal,
    why: "WebGL names your GPU outright and lists its exact limits and extensions." },
  { id: "audio", label: "Audio stack", bits: 5, run: audioSignal,
    why: "A silent test tone is processed in memory; tiny floating-point differences reveal the audio engine." },
  { id: "fonts", label: "Installed fonts", bits: 7, run: fontsSignal,
    why: "Text is measured in dozens of fonts. Which ones exist depends on your OS and what you installed." },
  { id: "screen", label: "Screen", bits: 5, run: screenSignal,
    why: "Resolution, usable area, pixel ratio and color depth. Browser zoom changes the pixel ratio." },
  { id: "timezone", label: "Time zone & locale", bits: 4, run: timezoneSignal,
    why: "Where your clock is set and how you write numbers and dates narrows down region and settings." },
  { id: "languages", label: "Languages", bits: 4, run: languagesSignal,
    why: "Your preferred languages, in order. Unusual combinations stand out fast." },
  { id: "platform", label: "Browser & OS", bits: 3, run: platformSignal,
    why: "Shown with versions, but versions stay out of the sigil so it survives updates." },
  { id: "cpu", label: "CPU threads", bits: 2, run: cpuSignal,
    why: "How many tasks your processor runs at once. One dot per thread in the sigil." },
  { id: "memory", label: "Memory", bits: 1.5, run: memorySignal,
    why: "Browsers round your RAM down and cap it on purpose, so it can read lower than you have. Still a rough sorting key." },
  { id: "touch", label: "Touch points", bits: 1, run: touchSignal,
    why: "How many fingers the screen can track. Separates phones, tablets and laptops." },
  { id: "media", label: "Display preferences", bits: 2, run: mediaSignal,
    why: "Dark mode, reduced motion, contrast, HDR and pointer type. Accessibility settings leak too." },
  { id: "math", label: "Math quirks", bits: 1, run: mathSignal,
    why: "Edge cases of sin, tan or cosh round differently across engines and CPUs." },
  { id: "codecs", label: "Media codecs", bits: 2, run: codecsSignal,
    why: "Which video and audio formats can play depends on browser, OS and licensing." },
  { id: "storage", label: "Storage & privacy flags", bits: 1, run: storageSignal,
    why: "Whether cookies and storage are allowed, and whether you send Do Not Track. Only read, never written." },
  // Adapter lookup can be slow or flaky on a cold start, so it is drawn but kept out of the ID
  { id: "webgpu", label: "WebGPU adapter", bits: 4, run: webgpuSignal, timeout: 4000, inId: false,
    why: "The newer graphics API describes your GPU family. Drawn, but kept out of the ID because it can be slow to answer." },
];

// Runs one collector; never throws. Result: { status: ok|noisy|blocked, display, hash, data }
export async function collect(signal) {
  try {
    const data = await withTimeout(Promise.resolve().then(signal.run), signal.timeout || 2500);
    const hash = await sha256(`${signal.id}:${data.raw}`);
    return { status: data.noisy ? "noisy" : "ok", display: data.display, hash, data };
  } catch (err) {
    return {
      status: "blocked",
      display: err?.message === "timeout" ? "blocked (timed out)" : "blocked",
      hash: null,
      data: {},
    };
  }
}
