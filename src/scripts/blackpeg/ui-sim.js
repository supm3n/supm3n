// "Compare strategies": a pool of workers plays the same secrets with every
// chosen method, then shows averages, spread and a paired comparison.
import {
  $, fmt, Channel, makeWorker, pegRow, historyRow, STRATEGIES, strategyName, isAvailable,
  FILLER_REASON, cleanCode, isCode, randomCode, randomSeed, parseSeed, summarize, fmtTime, symbolsText,
} from './ui-common.js';

const SLICE_MS = 250; // target work per message: keeps Stop quick and the load even
const MAX_GAMES = 100000;
const swatchVar = (id) => `var(--bp-s${STRATEGIES.findIndex((s) => s.id === id)})`;

export function createSim() {
  const el = {
    strats: $('c-strats'),
    games: $('c-games'),
    seed: $('c-seed'),
    run: $('c-run'),
    stop: $('c-stop'),
    bar: $('c-progress'),
    progText: $('c-prog-text'),
    note: $('c-note'),
    results: $('c-results'),
    table: $('c-table'),
    chart: $('c-chart'),
    wStrat: $('w-strat'),
    wSecret: $('w-secret'),
    wRand: $('w-rand'),
    wPlay: $('w-play'),
    wErr: $('w-err'),
    wNote: $('w-note'),
    wLog: $('w-log'),
  };
  const watchCh = new Channel();
  let N = 0, K = 0;
  let run = null; // the active run, if any
  let last = null; // last summary, for redrawing the chart on resize
  const want = Object.fromEntries(STRATEGIES.map((s) => [s.id, true]));

  // ---------- strategy picker ----------
  const boxes = {};
  for (const [i, s] of STRATEGIES.entries()) {
    const label = document.createElement('label');
    label.className = 'bp-strat';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = s.id;
    cb.checked = true;
    cb.addEventListener('change', () => { want[s.id] = cb.checked; });
    const body = document.createElement('span');
    body.className = 'bp-strat-body';
    const name = document.createElement('span');
    name.className = 'bp-strat-name';
    const sw = document.createElement('span');
    sw.className = 'bp-swatch';
    sw.style.background = `var(--bp-s${i})`;
    sw.setAttribute('aria-hidden', 'true');
    name.append(sw, document.createTextNode(s.name));
    if (s.recommended) {
      const tag = document.createElement('span');
      tag.className = 'bp-tag';
      tag.textContent = 'Recommended';
      name.appendChild(tag);
    }
    const desc = document.createElement('span');
    desc.className = 'bp-strat-desc';
    desc.textContent = s.desc;
    const why = document.createElement('span');
    why.className = 'bp-strat-why';
    why.textContent = FILLER_REASON;
    why.hidden = true;
    body.append(name, desc, why);
    label.append(cb, body);
    el.strats.appendChild(label);
    boxes[s.id] = { cb, label, why };
  }

  function updateAvailability() {
    for (const s of STRATEGIES) {
      const b = boxes[s.id];
      const ok = isAvailable(s.id, N, K);
      b.cb.disabled = !ok;
      b.cb.checked = ok && want[s.id];
      b.label.classList.toggle('is-off', !ok);
      b.why.hidden = ok;
    }
    const prev = el.wStrat.value;
    el.wStrat.textContent = '';
    for (const s of STRATEGIES) {
      if (!isAvailable(s.id, N, K)) continue;
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = s.name;
      el.wStrat.appendChild(o);
    }
    if ([...el.wStrat.options].some((o) => o.value === prev)) el.wStrat.value = prev;
  }

  // ---------- run ----------
  function estimateMs(id) {
    // First guess per game; replaced by the measured time after the first batch.
    if (id === 'countBinary' || id === 'countSingle') return 0.2;
    const scale = Math.max(0.05, (N * N * K) / 1200);
    return (id === 'entropy' ? 60 : 30) * scale;
  }

  function startRun() {
    if (run) return;
    const ids = STRATEGIES.map((s) => s.id).filter((id) => isAvailable(id, N, K) && boxes[id].cb.checked);
    if (!ids.length) { el.note.textContent = 'Tick at least one method.'; return; }
    const games = Math.max(1, Math.min(MAX_GAMES, parseInt(el.games.value, 10) || 200));
    el.games.value = games;
    const typed = parseSeed(el.seed.value);
    const seed = typed == null ? randomSeed() : typed;
    const cores = navigator.hardwareConcurrency || 4;
    // every core but one, so the page stays responsive (all of them on 1–2 core machines)
    const size = cores <= 2 ? cores : cores - 1;
    const pool = [];
    try {
      for (let k = 0; k < size; k++) pool.push(makeWorker());
    } catch (_) {
      pool.forEach((w) => w.terminate());
      el.note.textContent = 'This browser cannot run background workers, so the comparison is not available.';
      return;
    }

    const M = {};
    ids.forEach((id) => { M[id] = { n: new Array(games), next: 0, pre: 0, ms: estimateMs(id), measured: false }; });
    const r = {
      ids, games, seed, typed: typed != null, pool, M, N, K,
      inflight: 0, draining: false, finished: false, t0: performance.now(), lastDraw: 0, jobSeq: 1,
    };
    run = r;
    el.run.disabled = true;
    el.stop.disabled = false;
    el.stop.textContent = 'Stop';
    el.bar.style.width = '0';
    el.progText.textContent = '';
    el.note.textContent = `Running ${fmt(games)} game${games === 1 ? '' : 's'} per method on ${pool.length} worker${pool.length === 1 ? '' : 's'}…`;

    for (const w of pool) {
      w.onmessage = (e) => onMessage(r, w, e.data || {});
      w.onerror = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!r.finished) { finish(r, true); el.note.textContent = 'A worker stopped unexpectedly, so the run ended early.'; }
      };
      send(r, w);
    }
  }

  // Counting methods first (they finish almost at once), then the slow method furthest behind.
  function take(r) {
    if (r.draining) return null;
    let id = r.ids.find((x) => (x === 'countBinary' || x === 'countSingle') && r.M[x].next < r.games);
    if (!id) {
      for (const x of r.ids) {
        const m = r.M[x];
        if (m.next >= r.games) continue;
        if (!id || m.next < r.M[id].next) id = x;
      }
    }
    if (!id) return null;
    const m = r.M[id];
    const n = Math.max(1, Math.min(2000, Math.floor(SLICE_MS / Math.max(m.ms, 0.01))));
    const idx = [];
    while (idx.length < n && m.next < r.games) idx.push(m.next++);
    return { id, idx, t: performance.now() };
  }

  function send(r, w) {
    const job = take(r);
    if (!job) return false;
    job.msgId = r.jobSeq++;
    w.job = job;
    r.inflight++;
    w.postMessage({ type: 'sim', id: job.msgId, N: r.N, K: r.K, strategies: [job.id], idx: job.idx, seed: r.seed });
    return true;
  }

  function onMessage(r, w, m) {
    if (r.finished || 'progress' in m) return;
    const job = w.job;
    if (!job || m.id !== job.msgId) return;
    w.job = null;
    r.inflight--;
    if (m.error) {
      finish(r, true);
      el.note.textContent = `The run stopped with an error: ${m.error}`;
      return;
    }
    const s = r.M[job.id];
    for (const o of m.out || []) s.n[o.g] = o.ns[job.id];
    while (s.pre < r.games && s.n[s.pre] !== undefined) s.pre++;
    const per = (performance.now() - job.t) / job.idx.length;
    s.ms = s.measured ? 0.7 * s.ms + 0.3 * per : per;
    s.measured = true;
    progress(r);
    const all = r.ids.every((id) => r.M[id].pre >= r.games);
    if (performance.now() - r.lastDraw > 400 || all) { r.lastDraw = performance.now(); draw(summary(r)); }
    if (all) { finish(r, false); return; }
    if (!send(r, w) && r.draining && !r.inflight) finish(r, true);
  }

  function progress(r) {
    let done = 0, leftMs = 0;
    for (const id of r.ids) { done += r.M[id].pre; leftMs += (r.games - r.M[id].pre) * r.M[id].ms; }
    const common = Math.min(...r.ids.map((id) => r.M[id].pre));
    el.bar.style.width = `${(done / (r.games * r.ids.length)) * 100}%`;
    const secs = (performance.now() - r.t0) / 1000;
    let txt = `${fmt(common)} / ${fmt(r.games)} games · ${fmtTime(secs)} elapsed`;
    if (r.draining) txt += ' · finishing games in progress';
    else if (common < r.games) txt += ` · about ${fmtTime(leftMs / 1000 / r.pool.length)} left`;
    el.progText.textContent = txt;
  }

  // Everything shown uses games 0..common-1, which every method finished, so all
  // methods are compared on exactly the same secret codes.
  function summary(r) {
    const common = Math.min(...r.ids.map((id) => r.M[id].pre));
    const rows = [];
    if (!common) return { rows, common, N: r.N, K: r.K };
    for (const id of r.ids) rows.push({ id, vals: r.M[id].n.slice(0, common), st: summarize(r.M[id].n.slice(0, common)) });
    let best = rows[0];
    for (const x of rows) if (x.st.mean < best.st.mean) best = x;
    for (const x of rows) {
      if (x === best) { x.diff = null; continue; }
      x.diff = summarize(x.vals.map((v, g) => v - best.vals[g]));
    }
    return { rows, common, bestId: best.id, N: r.N, K: r.K };
  }

  function finish(r, stopped) {
    if (r.finished) return;
    r.finished = true;
    r.pool.forEach((w) => w.terminate());
    if (run === r) run = null;
    el.run.disabled = false;
    el.stop.disabled = true;
    el.stop.textContent = 'Stop';
    const sm = summary(r);
    const secs = (performance.now() - r.t0) / 1000;
    if (sm.common) draw(sm);
    el.progText.textContent = sm.common ? `${fmt(sm.common)} / ${fmt(r.games)} games · took ${fmtTime(secs)}` : '';
    const seedTxt = r.typed ? ` Seed ${r.seed}.` : ` Seed ${r.seed}: enter it as the seed to repeat this run exactly.`;
    if (!sm.common) el.note.textContent = 'Stopped before any game finished for every method.';
    else if (stopped) el.note.textContent = `Stopped. Showing the first ${fmt(sm.common)} games, which every method finished, at ${r.N} × ${r.K}.${seedTxt}`;
    else el.note.textContent = `Done: ${fmt(sm.common)} games per method at ${r.N} × ${r.K}, the same secret codes for every method. Took ${fmtTime(secs)} on ${r.pool.length} worker${r.pool.length === 1 ? '' : 's'}.${seedTxt}`;
  }

  function stopRun() {
    const r = run;
    if (!r) return;
    if (!r.draining) {
      r.draining = true;
      el.stop.textContent = 'Stop now';
      progress(r);
      if (!r.inflight) finish(r, true);
    } else finish(r, true);
  }

  function cancelRun() {
    if (run) { const r = run; r.finished = true; r.pool.forEach((w) => w.terminate()); run = null; }
    el.run.disabled = false;
    el.stop.disabled = true;
    el.stop.textContent = 'Stop';
    el.bar.style.width = '0';
    el.progText.textContent = '';
  }

  // ---------- results ----------
  const pm = (hw) => (Number.isFinite(hw) ? ` <span class="bp-pm">± ${hw.toFixed(2)}</span>` : '');
  const num = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

  function draw(sm) {
    if (!sm.common) return;
    last = sm;
    el.results.hidden = false;
    const sorted = sm.rows.slice().sort((a, b) => a.st.mean - b.st.mean);
    let h = '<caption class="bp-sr">Guesses needed per game, by method</caption>';
    h += '<thead><tr><th scope="col">Method</th><th scope="col">Games</th><th scope="col">Average</th><th scope="col">Median</th>'
      + '<th scope="col">95% of games within</th><th scope="col">Best</th><th scope="col">Worst</th><th scope="col">Extra vs best</th></tr></thead><tbody>';
    for (const x of sorted) {
      const best = x.id === sm.bestId;
      const extra = best ? '<span class="bp-tag">Best</span>' : `${x.diff.mean >= 0 ? '+' : '−'}${Math.abs(x.diff.mean).toFixed(2)}${pm(x.diff.hw)}`;
      h += `<tr class="${best ? 'is-best' : ''}"><th scope="row"><span class="bp-swatch" style="background:${swatchVar(x.id)}" aria-hidden="true"></span>${strategyName(x.id)}</th>`
        + `<td>${fmt(x.st.n)}</td><td><b>${x.st.mean.toFixed(2)}</b>${pm(x.st.hw)}</td><td>${num(x.st.median)}</td><td>${x.st.p95}</td>`
        + `<td>${x.st.min}</td><td>${x.st.max}</td><td>${extra}</td></tr>`;
    }
    h += '</tbody>';
    el.table.innerHTML = h;
    drawChart(sm, sorted);
  }

  // Small multiples: one histogram per method on a shared x axis.
  function drawChart(sm, rows) {
    const W = Math.max(300, Math.min(1600, el.chart.clientWidth || 700));
    const L = 12, R = 12, rowH = 88, top = 4;
    let lo = Infinity, hi = -Infinity;
    for (const x of rows) { lo = Math.min(lo, x.st.min); hi = Math.max(hi, x.st.max); }
    const span = hi - lo + 1;
    const plotW = W - L - R;
    const bw = plotW / span;
    const counts = rows.map((x) => { const c = new Map(); for (const v of x.vals) c.set(v, (c.get(v) || 0) + 1); return c; });
    let maxShare = 0;
    rows.forEach((x, k) => { for (const c of counts[k].values()) maxShare = Math.max(maxShare, c / x.vals.length); });
    const H = top + rows.length * rowH + 30;
    let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Distribution of guesses needed per game for each method">`;
    rows.forEach((x, k) => {
      const y0 = top + k * rowH;
      const base = y0 + rowH - 12;
      // name line, then a band for the mean label, then the bars: the label never sits on a bar
      const ph = rowH - 46;
      const col = swatchVar(x.id);
      svg += `<text class="bp-ch-lab" x="${L}" y="${y0 + 13}">${strategyName(x.id)}</text>`;
      svg += `<line class="bp-ch-axis" x1="${L}" x2="${W - R}" y1="${base}" y2="${base}"/>`;
      for (const [v, c] of counts[k]) {
        const share = c / x.vals.length;
        const bh = Math.max(1, (share / maxShare) * ph);
        const bx = L + (v - lo) * bw;
        svg += `<rect x="${(bx + 0.5).toFixed(1)}" y="${(base - bh).toFixed(1)}" width="${Math.max(1, bw - 1).toFixed(1)}" height="${bh.toFixed(1)}" rx="1.5" style="fill:${col}">`
          + `<title>${strategyName(x.id)}: ${v} guesses in ${(share * 100).toFixed(1)}% of games</title></rect>`;
      }
      const mx = L + (x.st.mean - lo + 0.5) * bw;
      svg += `<line class="bp-ch-mean" x1="${mx.toFixed(1)}" x2="${mx.toFixed(1)}" y1="${base - ph - 14}" y2="${base + 3}"/>`;
      const anchor = mx > W - 90 ? 'end' : 'start';
      svg += `<text class="bp-ch-txt" x="${(mx + (anchor === 'end' ? -5 : 5)).toFixed(1)}" y="${base - ph - 4}" text-anchor="${anchor}">avg ${x.st.mean.toFixed(1)}</text>`;
    });
    const axY = top + rows.length * rowH + 6;
    const step = [1, 2, 5, 10, 20, 50].find((s) => (span / s) * 34 <= plotW) || 100;
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      svg += `<text class="bp-ch-txt" x="${(L + (v - lo + 0.5) * bw).toFixed(1)}" y="${axY + 8}" text-anchor="middle">${v}</text>`;
    }
    svg += `<text class="bp-ch-txt" x="${W - R}" y="${axY + 22}" text-anchor="end">guesses needed →</text></svg>`;
    el.chart.innerHTML = svg;
  }

  let resizeTimer = 0;
  if (typeof ResizeObserver === 'function') {
    let lastW = 0;
    new ResizeObserver(() => {
      const w = el.chart.clientWidth;
      if (!last || Math.abs(w - lastW) < 8) return;
      lastW = w;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (last) drawChart(last, last.rows.slice().sort((a, b) => a.st.mean - b.st.mean)); }, 120);
    }).observe(el.chart);
  }

  // ---------- watch one game ----------
  let watchSeq = 0;
  async function watch() {
    const secret = el.wSecret.value.trim();
    if (!isCode(secret, N, K)) { el.wErr.textContent = `Enter exactly ${N} letters, ${symbolsText(K)}.`; return; }
    const strategy = el.wStrat.value;
    if (!strategy) return;
    el.wErr.textContent = '';
    watchCh.cancel();
    const t = ++watchSeq;
    el.wPlay.disabled = true;
    el.wNote.textContent = 'Playing…';
    el.wLog.textContent = '';
    try {
      const m = await watchCh.call({ type: 'play', N, K, strategy, secret, seed: randomSeed() });
      m.steps.forEach((x, i) => el.wLog.appendChild(historyRow(i, x.g, x.r, N, { left: x.left, hits: secret })));
      const n = m.steps.length;
      const won = n && m.steps[n - 1].r === N;
      el.wNote.textContent = won
        ? `${strategyName(strategy)} found ${secret} in ${n} guess${n === 1 ? '' : 'es'}.`
        : `${strategyName(strategy)} stopped after ${n} guesses without finding it.`;
    } catch (e) {
      if ((e && e.cancelled) || t !== watchSeq) return;
      el.wNote.textContent = `Could not play this game here (${e && e.message ? e.message : 'unknown error'}).`;
    } finally {
      if (t === watchSeq) el.wPlay.disabled = false;
    }
  }

  el.run.addEventListener('click', startRun);
  el.stop.addEventListener('click', stopRun);
  el.wPlay.addEventListener('click', watch);
  el.wRand.addEventListener('click', () => { el.wSecret.value = randomCode(N, K); el.wErr.textContent = ''; });
  el.wSecret.addEventListener('input', () => {
    const v = cleanCode(el.wSecret.value, N, K);
    if (v !== el.wSecret.value) el.wSecret.value = v;
    el.wErr.textContent = '';
  });
  el.wSecret.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); watch(); } });

  return {
    setSize(n, k) {
      const hadResults = !!last || !!run;
      cancelRun();
      watchCh.cancel();
      N = n;
      K = k;
      last = null;
      el.results.hidden = true;
      el.table.textContent = '';
      el.chart.textContent = '';
      el.note.textContent = hadResults ? `Size changed to ${N} × ${K}. Press Run to compare at this size.` : 'Pick the methods, then press Run.';
      updateAvailability();
      el.wSecret.maxLength = N;
      el.wSecret.value = randomCode(N, K);
      el.wErr.textContent = '';
      el.wNote.textContent = '';
      el.wLog.textContent = '';
      el.wPlay.disabled = false;
    },
    isRunning: () => !!run,
  };
}
