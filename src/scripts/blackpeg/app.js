// Black-peg Mastermind page: the shared game size bar, the mode tabs, and the
// three modes (Solve, Play, Compare strategies) in their own modules.
import { $, store, LIMITS, sup, totalCodes, inlineConfirm, symbolsText } from './ui-common.js';
import { createSolve } from './ui-solve.js';
import { createPlay } from './ui-play.js';
import { createSim } from './ui-sim.js';

const DEFAULT = { N: 10, K: 12 };
const SIZE_KEY = 'bp-size-v1';
const TABS = ['solve', 'play', 'simulate'];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const validSize = (n, k) => Number.isInteger(n) && Number.isInteger(k)
  && n >= LIMITS.minN && n <= LIMITS.maxN && k >= LIMITS.minK && k <= LIMITS.maxK;

function initialSize() {
  const q = new URLSearchParams(location.search);
  if (q.has('n') || q.has('k')) {
    const n = clamp(parseInt(q.get('n'), 10) || DEFAULT.N, LIMITS.minN, LIMITS.maxN);
    const k = clamp(parseInt(q.get('k'), 10) || DEFAULT.K, LIMITS.minK, LIMITS.maxK);
    return { N: n, K: k };
  }
  const s = store.get(SIZE_KEY);
  if (s && validSize(s.N, s.K)) return { N: s.N, K: s.K };
  return { ...DEFAULT };
}

export function initBlackPeg() {
  const root = document.querySelector('.bp');
  if (!root) return;

  const solve = createSolve();
  const play = createPlay();
  const sim = createSim();
  const sizeConfirm = inlineConfirm($('size-confirm'));

  // ---------- size ----------
  let size = initialSize();
  let pending = null; // size waiting for confirmation

  function writeUrl() {
    try {
      const u = new URL(location.href);
      if (size.N === DEFAULT.N && size.K === DEFAULT.K) { u.searchParams.delete('n'); u.searchParams.delete('k'); }
      else { u.searchParams.set('n', size.N); u.searchParams.set('k', size.K); }
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    } catch (_) {}
  }

  function renderSize(s) {
    $('size-n').textContent = s.N;
    $('size-k').textContent = s.K;
    for (const b of root.querySelectorAll('.bp-step')) {
      const dim = b.dataset.dim, step = +b.dataset.step;
      const v = s[dim] + step;
      b.disabled = dim === 'N' ? v < LIMITS.minN || v > LIMITS.maxN : v < LIMITS.minK || v > LIMITS.maxK;
    }
    for (const c of root.querySelectorAll('.bp-chip')) {
      c.setAttribute('aria-pressed', String(+c.dataset.n === s.N && +c.dataset.k === s.K));
    }
    const total = totalCodes(s.N, s.K);
    $('size-count').textContent = `${s.K}${sup(s.N)} = ${total.toLocaleString('en-US')} possible codes`;
    $('size-symbols').textContent = `Symbols ${symbolsText(s.K)} · ${(s.N * Math.log2(s.K)).toFixed(1)} bits`;
  }

  function applySize(s, { initial = false } = {}) {
    size = s;
    pending = null;
    store.set(SIZE_KEY, size);
    if (!initial) writeUrl();
    renderSize(size);
    root.style.setProperty('--bp-n', size.N);
    root.style.setProperty('--bp-half', Math.ceil(size.N / 2));
    root.dataset.len = size.N > 6 ? 'long' : 'short';
    solve.setSize(size.N, size.K, { restore: initial });
    play.setSize(size.N, size.K);
    sim.setSize(size.N, size.K);
  }

  function requestSize(s) {
    if (!validSize(s.N, s.K)) return;
    if (s.N === size.N && s.K === size.K) {
      pending = null;
      sizeConfirm.close();
      renderSize(size);
      return;
    }
    const lose = [];
    if (solve.hasGuesses()) lose.push('your Solve game');
    if (play.hasGuesses()) lose.push('your Play game');
    if (sim.isRunning()) lose.push('the running comparison');
    if (!lose.length) { sizeConfirm.close(); applySize(s); return; }
    pending = s;
    renderSize(s);
    const what = lose.length > 1 ? `${lose.slice(0, -1).join(', ')} and ${lose[lose.length - 1]}` : lose[0];
    sizeConfirm.ask(
      `Switch to ${s.N} × ${s.K}? This clears ${what}.`,
      'Switch size',
      () => applySize(s),
      () => { pending = null; renderSize(size); },
    );
  }

  for (const b of root.querySelectorAll('.bp-step')) {
    b.addEventListener('click', () => {
      const base = pending || size;
      const next = { ...base };
      next[b.dataset.dim] += +b.dataset.step;
      requestSize(next);
    });
  }
  for (const c of root.querySelectorAll('.bp-chip')) {
    c.addEventListener('click', () => requestSize({ N: +c.dataset.n, K: +c.dataset.k }));
  }

  // ---------- tabs ----------
  const tabs = TABS.map((t) => $(`tab-${t}`));

  function select(name, { focus = false, writeHash = false } = {}) {
    if (!TABS.includes(name)) name = 'solve';
    TABS.forEach((t, i) => {
      const on = t === name;
      tabs[i].setAttribute('aria-selected', String(on));
      tabs[i].tabIndex = on ? 0 : -1;
      $(`panel-${t}`).hidden = !on;
    });
    if (focus) tabs[TABS.indexOf(name)].focus();
    play.setActive(name === 'play');
    if (writeHash) {
      try { history.replaceState(history.state, '', `${location.pathname}${location.search}#${name}`); } catch (_) {}
    }
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(TABS[i], { writeHash: true }));
    tab.addEventListener('keydown', (e) => {
      let j = -1;
      if (e.key === 'ArrowRight') j = (i + 1) % TABS.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + TABS.length) % TABS.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = TABS.length - 1;
      if (j < 0) return;
      e.preventDefault();
      select(TABS[j], { focus: true, writeHash: true });
    });
  });

  window.addEventListener('hashchange', () => {
    const h = location.hash.slice(1);
    if (TABS.includes(h)) select(h);
  });

  // ---------- start ----------
  const h = location.hash.slice(1);
  select(TABS.includes(h) ? h : 'solve');
  applySize(size, { initial: true });
  // A size from the URL is kept in the URL; a remembered one is not added to it.
  if (new URLSearchParams(location.search).has('n')) writeUrl();
}

