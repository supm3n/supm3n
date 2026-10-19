// src/scripts/fingerprint/fingerprint.js
// Page controller for /fingerprint: runs the collectors, fills the signal list,
// assembles the sigil and handles highlight + downloads. No network, no storage.

import { SIGNALS, collect, sha256 } from "./signals.js";
import { buildSigil, scaffoldSvg, exportSvg, PART_COLORS } from "./sigil.js";

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = el("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function initFingerprint() {
  const svg = $("sigil");
  const list = $("signals");
  const statusEl = $("fp-status");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rows = {};
  let hovered = null;
  let pinned = null;
  let shortId = "";

  svg.innerHTML = scaffoldSvg();

  // ---------- Rows ----------
  for (const s of SIGNALS) {
    const li = el("li");
    const btn = el("button", "sig pending");
    btn.type = "button";
    btn.dataset.id = s.id;
    btn.setAttribute("aria-pressed", "false");

    const top = el("span", "sig-top");
    const sw = el("span", "sig-swatch");
    sw.setAttribute("aria-hidden", "true");
    const label = el("span", "sig-label", s.label);
    const tag = el("span", "sig-tag");
    const bits = el("span", "sig-bits");
    bits.title = "How much this narrows you down: a rough estimate from public studies";
    const bar = el("span", "bits-bar");
    bar.setAttribute("aria-hidden", "true");
    const fill = el("i");
    fill.style.width = `${Math.min(100, (s.bits / 10) * 100)}%`;
    bar.append(fill);
    const scale = s.bits >= 6 ? "very identifying" : s.bits >= 3 ? "somewhat" : "barely";
    bits.append(bar, el("span", "", scale));
    top.append(sw, label, tag, bits);

    const value = el("span", "sig-value", "reading…");
    const why = el("span", "sig-why", s.why);
    btn.append(top, value, why);
    li.append(btn);
    list.append(li);
    rows[s.id] = { btn, value, tag, sw, scale };

    btn.addEventListener("pointerenter", () => setHover(s.id));
    btn.addEventListener("pointerleave", () => setHover(null));
    btn.addEventListener("focus", () => setHover(s.id));
    btn.addEventListener("blur", () => setHover(null));
    btn.addEventListener("click", () => {
      setPinned(pinned === s.id ? null : s.id);
      // Reveal a row that was partly off screen or under the header
      if (pinned) btn.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  // ---------- Highlight ----------
  // The panel under the sigil shows the hovered or pinned detail, so it can be
  // read without scrolling to its row in the list
  const pick = $("fp-pick");
  function showPick(id) {
    pick.querySelector(".pick-empty").hidden = !!id;
    pick.querySelector(".pick-body").hidden = !id;
    if (!id) return;
    const s = SIGNALS.find((x) => x.id === id);
    const r = rows[id];
    pick.querySelector(".pick-label").textContent = s.label;
    pick.querySelector(".pick-scale").textContent = [r.scale, r.tag.textContent].filter(Boolean).join(" · ");
    pick.querySelector(".pick-value").textContent = results[id]?.display ?? "reading…";
    pick.querySelector(".pick-why").textContent = s.why;
  }

  function paint() {
    const active = hovered || pinned;
    showPick(rows[active] ? active : null);
    svg.classList.toggle("focusing", !!active);
    svg.querySelectorAll(".part").forEach((p) => p.classList.toggle("on", p.dataset.part === active));
    for (const [id, r] of Object.entries(rows)) {
      r.btn.classList.toggle("hot", id === active);
      r.btn.setAttribute("aria-pressed", String(id === pinned));
    }
  }
  function setHover(id) {
    hovered = id;
    paint();
  }
  function setPinned(id) {
    pinned = id;
    paint();
  }

  svg.addEventListener("pointerover", (e) => {
    const id = e.target.closest?.("[data-hit]")?.dataset.hit;
    if (id) setHover(id);
  });
  svg.addEventListener("pointerleave", () => setHover(null));
  svg.addEventListener("click", (e) => {
    const id = e.target.closest?.("[data-hit]")?.dataset.hit;
    if (!id) return setPinned(null);
    setPinned(pinned === id ? null : id);
    // Desktop: the sigil stays in view, so also bring the row into view.
    // Phones show the detail under the sigil instead of scrolling away.
    if (pinned && window.innerWidth >= 960) {
      rows[id].btn.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && pinned) setPinned(null);
  });

  // ---------- Collect ----------
  const results = {};
  const order = [];

  async function run() {
    let done = 0;
    statusEl.textContent = `Reading details · 0/${SIGNALS.length}`;
    await Promise.all(SIGNALS.map(async (s) => {
      const res = await collect(s);
      results[s.id] = res;
      order.push(s.id);
      done++;
      statusEl.textContent = `Reading details · ${done}/${SIGNALS.length}`;
      fillRow(s.id, res);
    }));

    const stable = SIGNALS.filter((s) => results[s.id].status === "ok" && s.inId !== false);
    const idHash = await sha256(stable.map((s) => `${s.id}:${results[s.id].hash}`).join("\n"));

    // Noisy or blocked signals get a fixed stand-in seed, so their band never changes the sigil
    const seeds = {};
    for (const s of SIGNALS) {
      const r = results[s.id];
      const ok = r.status === "ok";
      seeds[s.id] = {
        hash: ok ? r.hash : await sha256(`stand-in:${s.id}`),
        data: ok ? r.data : {},
        muted: !ok || s.inId === false,
      };
    }

    const sigil = buildSigil(seeds, idHash);
    svg.style.setProperty("--fp-accent", sigil.accent);
    list.style.setProperty("--fp-accent", sigil.accent);
    for (const [id, r] of Object.entries(rows)) {
      const c = PART_COLORS[id];
      r.sw.style.background = c === "accent" ? sigil.accent : c;
    }

    if (!reduceMotion) svg.classList.add("assembling");
    svg.innerHTML = sigil.markup;
    paint();

    statusEl.textContent = "Assembling sigil…";
    for (const id of order) {
      const part = svg.querySelector(`.part[data-part="${id}"]`);
      if (!part) continue;
      part.classList.add("shown");
      if (!reduceMotion) await sleep(130);
    }
    svg.querySelector('.part[data-part="id"]')?.classList.add("shown");
    if (!reduceMotion) await sleep(900);
    svg.classList.remove("assembling");

    shortId = idHash.slice(0, 16).match(/.{4}/g).join("·");
    $("fp-id").textContent = shortId;
    $("fp-id").classList.remove("empty");
    statusEl.textContent = `Done · ${stable.length} of ${SIGNALS.length} details used for your ID`;
    svg.setAttribute("aria-label", `Your sigil: an emblem with ${sigil.n}-point symmetry, made from your browser's details`);
    $("app-headline").textContent = `${stable.length} details about your browser add up to one ID.`;
    ["dl-svg", "dl-png", "copy-id"].forEach((b) => ($(b).disabled = false));

    const noisy = SIGNALS.filter((s) => results[s.id].status === "noisy").map((s) => s.label.toLowerCase());
    if (noisy.length) {
      $("fp-noise").hidden = false;
      $("fp-noise").textContent =
        `Your browser adds noise to ${noisy.join(" and ")} reads. Good for privacy. `
        + "Those rings are drawn faded and dashed and left out of your ID, so the sigil stays the same.";
    }
  }

  function fillRow(id, res) {
    const r = rows[id];
    r.btn.classList.remove("pending");
    r.btn.classList.add(res.status);
    r.value.textContent = res.display;
    if (res.status === "noisy") r.tag.textContent = "noisy · left out";
    if (res.status === "blocked") r.tag.textContent = "left out";
    else if (SIGNALS.find((s) => s.id === id).inId === false) r.tag.textContent = "not in ID";
    if (id === "canvas" && res.data.image) {
      const img = el("img", "sig-thumb");
      img.src = res.data.image;
      img.alt = "The test image your browser drew";
      img.width = 120;
      img.height = 30;
      r.value.prepend(img);
    }
  }

  // ---------- Downloads ----------
  $("dl-svg").addEventListener("click", () => {
    const text = exportSvg(svg, 1024);
    download(new Blob([text], { type: "image/svg+xml" }), `fingerprint-${shortId.replace(/·/g, "")}.svg`);
  });

  $("dl-png").addEventListener("click", async () => {
    const size = 2048;
    const url = URL.createObjectURL(new Blob([exportSvg(svg, size)], { type: "image/svg+xml" }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = el("canvas");
      c.width = size;
      c.height = size;
      c.getContext("2d").drawImage(img, 0, 0, size, size);
      const blob = await new Promise((res) => c.toBlob(res, "image/png"));
      if (blob) download(blob, `fingerprint-${shortId.replace(/·/g, "")}.png`);
    } catch {
      statusEl.textContent = "PNG export failed in this browser. The SVG download still works.";
    } finally {
      URL.revokeObjectURL(url);
    }
  });

  $("copy-id").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(shortId);
      $("copy-id").textContent = "Copied";
      setTimeout(() => ($("copy-id").textContent = "Copy"), 1400);
    } catch {
      /* clipboard refused: nothing to do */
    }
  });

  run();
}
