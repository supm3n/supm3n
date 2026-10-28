// "Solve my game": the player copies the suggested guess into their own game,
// taps the score it showed, and the solver narrows the codes down.
import {
  $, fmt, store, SYMBOLS, Channel, pegRow, pegChip, historyRow, inlineConfirm,
  cleanCode, isCode, symbolsText, randomSeed, totalCodes, reducedMotion,
} from './ui-common.js';

export function createSolve() {
  const ch = new Channel();
  const el = {
    view: $('panel-solve'),
    label: $('s-guess-label'),
    guess: $('s-guess'),
    copy: $('s-copy'),
    copyMsg: $('s-copy-msg'),
    back: $('s-pick-back'),
    info: $('s-info'),
    scores: $('s-scores'),
    own: $('s-own'),
    ownInput: $('s-own-input'),
    ownPreview: $('s-own-preview'),
    ownErr: $('s-own-err'),
    undo: $('s-undo'),
    reset: $('s-reset'),
    total: $('s-total'),
    count: $('s-count'),
    status: $('s-status'),
    candsBox: $('s-cands-box'),
    cands: $('s-cands'),
    history: $('s-history'),
    historyEmpty: $('s-history-empty'),
    heat: $('s-heat'),
    heatNote: $('s-heat-note'),
  };
  const confirm = inlineConfirm($('s-confirm'));

  let N = 0, K = 0;
  let hist = []; // [{ g: 'ABCD', r: 2, left?: number }]
  let suggestion = null; // string from the worker
  let picked = null; // a candidate the player chose instead
  let busy = false;
  let total = null;
  let token = 0;
  let copyTimer = 0;

  const key = () => `bp-solve-v1-${N}x${K}`;
  const save = () => store.set(key(), { hist });
  const solved = () => hist.length > 0 && hist[hist.length - 1].r === N;
  const current = () => picked || suggestion;

  function load() {
    const v = store.get(key());
    if (!v || !Array.isArray(v.hist)) return [];
    const out = [];
    for (const x of v.hist) {
      if (!x || !isCode(x.g, N, K) || !Number.isInteger(x.r) || x.r < 0 || x.r > N) return [];
      out.push({ g: x.g, r: x.r, left: Number.isFinite(x.left) ? x.left : undefined });
    }
    return out;
  }

  // ---------- rendering ----------
  function buildScores() {
    el.scores.textContent = '';
    el.scores.style.maxWidth = `${(N + 1) * 5}rem`;
    for (let k = 0; k <= N; k++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bp-score' + (k === N ? ' is-full' : '');
      b.textContent = k;
      b.setAttribute('aria-label', `${k} of ${N} in the right place`);
      b.addEventListener('click', () => submit(k));
      el.scores.appendChild(b);
    }
    layoutScores();
  }

  // One row when 0..N fits, otherwise rows of equal length (e.g. 7 + 6 for N = 12).
  function layoutScores() {
    const w = el.scores.clientWidth;
    if (!w || !N) return;
    const n = N + 1, gap = 6, minW = 44;
    const fit = Math.max(1, Math.floor((w + gap) / (minW + gap)));
    const cols = Math.ceil(n / Math.ceil(n / fit));
    el.scores.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(layoutScores).observe(el.scores);

  function setScoresEnabled(on) {
    for (const b of el.scores.querySelectorAll('button')) b.disabled = !on;
  }

  function showGuess(code, label) {
    const node = pegRow(code || ' '.repeat(N), { size: 'lg', label: label || 'Suggested guess' });
    el.guess.replaceChildren(node);
  }

  function renderHistory() {
    el.history.textContent = '';
    hist.forEach((x, i) => el.history.appendChild(historyRow(i, x.g, x.r, N, { left: x.left ?? null })));
    el.historyEmpty.hidden = hist.length > 0;
    el.count.textContent = hist.length;
    el.undo.disabled = hist.length === 0;
    el.reset.disabled = hist.length === 0;
  }

  function renderHeat(marg, exact) {
    const t = el.heat;
    t.textContent = '';
    const cap = document.createElement('caption');
    cap.className = 'bp-sr';
    cap.textContent = 'Chance of each symbol (rows) at each position (columns)';
    t.appendChild(cap);
    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    const corner = document.createElement('th');
    corner.scope = 'col';
    corner.innerHTML = '<span class="bp-sr">Symbol</span>';
    hr.appendChild(corner);
    for (let i = 0; i < N; i++) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = i + 1;
      th.title = `Position ${i + 1}`;
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    t.appendChild(thead);
    const tb = document.createElement('tbody');
    for (let c = 0; c < K; c++) {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';
      th.appendChild(pegChip(c));
      const sr = document.createElement('span');
      sr.className = 'bp-sr';
      sr.textContent = SYMBOLS[c];
      th.appendChild(sr);
      tr.appendChild(th);
      for (let i = 0; i < N; i++) {
        const p = marg ? Math.max(0, Math.min(1, marg[i][c] || 0)) : 0;
        const td = document.createElement('td');
        td.className = `s${c}`;
        td.dataset.c = c;
        td.dataset.p = p;
        td.style.setProperty('--p', p.toFixed(3));
        if (p >= 0.995) { td.classList.add('is-sure'); td.textContent = SYMBOLS[c]; }
        else if (p >= 0.1) td.textContent = Math.round(p * 100);
        else if (p > 0) td.classList.add('is-low');
        else td.classList.add('is-zero');
        const pct = p >= 0.995 ? 'certain' : p <= 0 ? 'impossible' : `${(p * 100).toFixed(1)}%`;
        td.title = `${SYMBOLS[c]} at position ${i + 1}: ${pct}`;
        td.setAttribute('aria-label', td.title);
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    inkHeat();
    if (!marg) el.heatNote.textContent = 'No code fits your answers, so there is nothing to show.';
    else if (exact) el.heatNote.textContent = 'Exact chance of each symbol at each position, over every code that still fits. Numbers are percent.';
    else el.heatNote.textContent = 'Chance of each symbol at each position, estimated from a large random sample of the codes that still fit. Numbers are percent.';
  }

  // Each cell shows its peg colour at opacity p over the cell colour. Pick black
  // or white text, whichever has more contrast on that blend (always >= 4.58:1).
  function inkHeat() {
    const cs = getComputedStyle(el.heat);
    const rgb = (name) => {
      const m = /^#([0-9a-f]{6})$/i.exec(cs.getPropertyValue(name).trim());
      return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null;
    };
    const lum = (c) => {
      const [r, g, b] = c.map((x) => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const base = rgb('--bp-cell');
    if (!base) return;
    for (const td of el.heat.querySelectorAll('td')) {
      const c = Number(td.dataset.c), p = Number(td.dataset.p);
      const peg = rgb(`--bp-p${c}`);
      if (!peg) continue;
      const L = lum(peg.map((v, i) => v * p + base[i] * (1 - p)));
      // black wins when (L + 0.05) / 0.05 > 1.05 / (L + 0.05)
      const dark = (L + 0.05) ** 2 > 0.0525;
      td.classList.toggle('is-ink-dark', dark);
      td.classList.toggle('is-ink-light', !dark);
      td.classList.toggle('is-strong', p >= 0.5);
    }
  }
  new MutationObserver(inkHeat).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function uniformMarg() {
    return Array.from({ length: N }, () => new Array(K).fill(1 / K));
  }

  function codeMarg(code) {
    return Array.from({ length: N }, (_, i) => {
      const a = new Array(K).fill(0);
      a[SYMBOLS.indexOf(code[i])] = 1;
      return a;
    });
  }

  function renderCands(list) {
    el.cands.textContent = '';
    if (!list || !list.length || list.length < 2) { el.candsBox.hidden = true; return; }
    for (const code of list) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bp-cand';
      b.dataset.code = code;
      b.setAttribute('aria-pressed', String(code === picked));
      b.setAttribute('aria-label', `Use ${code.split('').join(' ')} as my next guess`);
      b.appendChild(pegRow(code, { size: 'xs', label: 'Candidate' }));
      b.addEventListener('click', () => pick(code));
      li.appendChild(b);
      el.cands.appendChild(li);
    }
    el.candsBox.hidden = false;
  }

  function renderCurrent() {
    if (picked) {
      showGuess(picked, 'Your chosen guess');
      el.label.textContent = 'Your pick from the list';
    } else if (suggestion) {
      showGuess(suggestion, 'Suggested guess');
    }
    el.back.hidden = !picked;
    for (const b of el.cands.querySelectorAll('.bp-cand')) {
      b.setAttribute('aria-pressed', String(b.dataset.code === picked));
    }
  }

  // ---------- flow ----------
  async function refresh() {
    save();
    renderHistory();
    picked = null;
    el.back.hidden = true;
    el.copyMsg.textContent = '';

    if (solved()) {
      suggestion = hist[hist.length - 1].g;
      total = 1;
      showGuess(suggestion, 'Cracked code');
      el.label.textContent = 'Cracked';
      el.info.textContent = '';
      el.total.textContent = '1';
      el.status.textContent = `Solved in ${hist.length} guess${hist.length === 1 ? '' : 'es'}. Press New game to start again.`;
      el.candsBox.hidden = true;
      renderHeat(codeMarg(suggestion), true);
      setScoresEnabled(false);
      el.copy.disabled = false;
      el.view.classList.remove('is-thinking');
      return;
    }

    const t = ++token;
    busy = true;
    setScoresEnabled(false);
    el.copy.disabled = true;
    el.view.classList.add('is-thinking');
    el.status.textContent = 'Thinking…';
    let m;
    try {
      m = await ch.call({ type: 'suggest', N, K, hist: hist.map(({ g, r }) => ({ g, r })), seed: randomSeed() });
    } catch (e) {
      if (e && e.cancelled) return;
      if (t !== token) return;
      busy = false;
      el.view.classList.remove('is-thinking');
      el.status.textContent = `The solver could not run here (${e && e.message ? e.message : 'unknown error'}). Try reloading the page.`;
      return;
    }
    if (t !== token) return;
    busy = false;
    el.view.classList.remove('is-thinking');
    total = m.total;
    el.total.textContent = fmt(total);
    if (hist.length) {
      hist[hist.length - 1].left = total;
      save();
      renderHistory();
    }

    if (total === 0) {
      suggestion = null;
      showGuess(null, 'No guess');
      el.label.textContent = 'No code fits';
      el.info.textContent = '';
      el.status.textContent = 'No code fits all of these scores, so one of them was probably entered wrong. Use Undo last to step back to it and enter it again.';
      el.candsBox.hidden = true;
      renderHeat(null, true);
      return;
    }

    suggestion = m.guess;
    showGuess(suggestion, 'Suggested guess');
    el.label.textContent = total === 1 ? 'This is the code' : hist.length === 0 ? 'Start with this guess' : 'Type this into your game';
    if (total === 1) el.info.textContent = 'Only one code fits all your answers.';
    else {
      const bits = Number.isFinite(m.H) ? `about ${m.H.toFixed(1)} bits` : 'some information';
      el.info.textContent = `Its answer should tell you ${bits}. ` + (m.consistent
        ? 'It could be the secret itself.'
        : 'It cannot be the secret: it is built to split the remaining codes as evenly as possible.');
    }
    if (hist.length === 0) el.status.textContent = 'Every first guess is about equally good. Enter this one in your game, then tap the score it shows.';
    else if (total === 1) el.status.textContent = 'Only one code is left. Enter it to finish.';
    else el.status.textContent = `${fmt(total)} codes still fit your answers (${Math.log2(total).toFixed(1)} bits of uncertainty left).`;
    renderCands(Array.isArray(m.list) ? m.list : []);
    renderHeat(m.marg || uniformMarg(), !!m.margExact);
    setScoresEnabled(true);
    el.copy.disabled = false;
  }

  function submit(r) {
    if (busy || solved() || total === 0) return;
    let g = current();
    const typed = el.ownInput.value.trim();
    if (el.own.open && typed) {
      if (!isCode(typed, N, K)) {
        el.ownErr.textContent = `Enter exactly ${N} letters, ${symbolsText(K)}.`;
        el.ownInput.focus();
        return;
      }
      g = typed;
    }
    if (!g) return;
    el.ownErr.textContent = '';
    el.ownInput.value = '';
    el.ownPreview.textContent = '';
    el.own.open = false;
    confirm.close();
    hist.push({ g, r });
    ch.cancel();
    refresh();
  }

  function pick(code) {
    picked = code === picked ? null : code;
    renderCurrent();
    if (!picked) el.label.textContent = 'Type this into your game';
    el.guess.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
  }

  // ---------- events ----------
  el.ownInput.addEventListener('input', () => {
    const v = cleanCode(el.ownInput.value, N, K);
    if (el.ownInput.value !== v) el.ownInput.value = v;
    el.ownErr.textContent = '';
    el.ownPreview.replaceChildren(v ? pegRow(v.padEnd(N, ' '), { size: 'xs', label: 'Typed guess' }) : '');
  });
  el.ownInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); el.ownErr.textContent = 'Now tap the score your game showed.'; }
  });
  el.undo.addEventListener('click', () => {
    if (!hist.length) return;
    confirm.close();
    hist.pop();
    ch.cancel();
    refresh();
  });
  el.reset.addEventListener('click', () => {
    if (!hist.length) return;
    confirm.ask(`Clear all ${hist.length} guess${hist.length === 1 ? '' : 'es'} and start a new game?`, 'Clear', () => {
      hist = [];
      ch.cancel();
      refresh();
    });
  });
  el.back.addEventListener('click', () => {
    picked = null;
    renderCurrent();
    el.label.textContent = hist.length === 0 ? 'Start with this guess' : total === 1 ? 'This is the code' : 'Type this into your game';
  });
  el.copy.addEventListener('click', () => {
    const s = current();
    if (!s) return;
    const done = (ok) => {
      el.copyMsg.textContent = ok ? `Copied ${s}` : s;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => { el.copyMsg.textContent = ''; }, 2500);
    };
    try { navigator.clipboard.writeText(s).then(() => done(true), () => done(false)); } catch (_) { done(false); }
  });

  return {
    setSize(n, k, { restore = false } = {}) {
      if (N && !restore) store.del(key());
      N = n;
      K = k;
      ch.cancel();
      confirm.close();
      hist = restore ? load() : [];
      suggestion = null;
      picked = null;
      total = Number(totalCodes(N, K));
      el.total.textContent = fmt(total);
      el.ownInput.value = '';
      el.ownInput.maxLength = N;
      el.ownInput.placeholder = SYMBOLS.slice(0, Math.min(N, K)).padEnd(N, SYMBOLS[0]);
      el.ownPreview.textContent = '';
      el.ownErr.textContent = '';
      buildScores();
      showGuess(null, 'Suggested guess');
      renderHeat(uniformMarg(), true);
      refresh();
    },
    hasGuesses: () => hist.length > 0,
  };
}
