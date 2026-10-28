// Shared helpers for the black-peg Mastermind page: storage, worker channel,
// peg rendering, inline confirms, statistics.
import { LIMITS, SYMBOLS } from './engine.js';

export { LIMITS, SYMBOLS };

export const $ = (id) => document.getElementById(id);
export const fmt = (n) => Math.round(n).toLocaleString('en-US');

export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// localStorage, never trusted to exist (private windows, blocked storage).
export const store = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  },
  del(key) {
    try { localStorage.removeItem(key); } catch (_) {}
  },
};

// Strategy ids match the engine's STRATS. Count strategies need a symbol that is
// surely absent to use as filler, which only exists when K > N (mirrors engine.available).
export const STRATEGIES = [
  {
    id: 'entropy',
    name: 'Max information',
    desc: 'Picks the guess whose answer is hardest to predict, so every answer tells you as much as possible.',
    recommended: true,
  },
  {
    id: 'randomConsistent',
    name: 'Any possible code',
    desc: 'Guesses a random code that still fits every answer so far.',
  },
  {
    id: 'countBinary',
    name: 'Count, then halve',
    desc: 'Counts each symbol with one-symbol guesses, then halves its possible positions using a missing symbol as filler.',
    needsFiller: true,
  },
  {
    id: 'countSingle',
    name: 'Count, then one by one',
    desc: 'Counts each symbol, then tests the positions one at a time.',
    needsFiller: true,
  },
];
export const strategyName = (id) => (STRATEGIES.find((s) => s.id === id) || { name: id }).name;
export const strategyNo = (id) => STRATEGIES.findIndex((s) => s.id === id);
export const isAvailable = (id, N, K) => {
  const s = STRATEGIES.find((x) => x.id === id);
  return !!s && (!s.needsFiller || K > N);
};
export const FILLER_REASON = 'Needs more symbols than positions, so that one symbol is surely missing to use as filler.';

// ---------- codes ----------
export const symbolsText = (K) => `${SYMBOLS[0]} to ${SYMBOLS[K - 1]}`;

export function cleanCode(text, N, K) {
  const allowed = SYMBOLS.slice(0, K);
  let out = '';
  for (const ch of String(text || '').toUpperCase()) {
    if (allowed.includes(ch)) out += ch;
    if (out.length >= N) break;
  }
  return out;
}

export function isCode(s, N, K) {
  return typeof s === 'string' && s.length === N && cleanCode(s, N, K) === s;
}

export function randomCode(N, K) {
  const buf = new Uint32Array(N);
  try { crypto.getRandomValues(buf); } catch (_) { for (let i = 0; i < N; i++) buf[i] = Math.floor(Math.random() * 2 ** 32); }
  let s = '';
  for (let i = 0; i < N; i++) s += SYMBOLS[buf[i] % K];
  return s;
}

export const scoreCodes = (g, s) => {
  let m = 0;
  for (let i = 0; i < g.length; i++) if (g[i] === s[i]) m++;
  return m;
};

export const randomSeed = () => Math.floor(Math.random() * 2 ** 32) >>> 0;

// A seed can be a number or any text (hashed), so "test-1" works too.
export function parseSeed(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  if (/^\d{1,10}$/.test(t) && +t < 2 ** 32) return +t;
  let h = 2166136261;
  for (const ch of t) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export const sup = (n) => String(n).split('').map((d) => SUP[+d]).join('');

export function totalCodes(N, K) {
  return BigInt(K) ** BigInt(N);
}

// ---------- pegs ----------
// A row of pegs for a code string. Empty positions (' ' or '') draw as holes.
// opts.size: 'lg' | 'md' | 'sm'; opts.hits: secret string to ring the exact hits;
// opts.label: start of the aria-label; opts.pop: animate in once.
export function pegRow(code, opts = {}) {
  const { size = 'md', hits = null, label = 'Code', pop = false } = opts;
  const row = document.createElement('div');
  row.className = `bp-pegs bp-pegs-${size}`;
  row.style.setProperty('--n', code.length);
  row.setAttribute('role', 'img');
  const letters = [];
  const hitPos = [];
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const idx = SYMBOLS.indexOf(ch);
    const peg = document.createElement('span');
    peg.setAttribute('aria-hidden', 'true');
    if (idx < 0 || ch === ' ') {
      peg.className = 'bp-peg is-empty';
      letters.push('empty');
    } else {
      peg.className = `bp-peg s${idx}`;
      peg.textContent = ch;
      letters.push(ch);
      if (hits && hits[i] === ch) { peg.classList.add('is-hit'); hitPos.push(i + 1); }
    }
    if (pop) { peg.classList.add('bp-pop'); peg.style.setProperty('--d', `${i * 18}ms`); }
    row.appendChild(peg);
  }
  let text = `${label}: ${letters.join(' ')}`;
  if (hits) text += hitPos.length ? `. Hits at position${hitPos.length > 1 ? 's' : ''} ${hitPos.join(', ')}` : '. No hits';
  row.setAttribute('aria-label', text);
  return row;
}

export function pegChip(idx) {
  const peg = document.createElement('span');
  peg.className = `bp-peg bp-chip-peg s${idx}`;
  peg.textContent = SYMBOLS[idx];
  peg.setAttribute('aria-hidden', 'true');
  return peg;
}

export function scoreBadge(r, N, { pop = false } = {}) {
  const b = document.createElement('span');
  b.className = 'bp-badge' + (r === N ? ' is-full' : r === 0 ? ' is-zero' : '');
  if (pop) b.classList.add('bp-pop');
  const num = document.createElement('b');
  num.textContent = `${r} / ${N}`;
  const txt = document.createElement('span');
  txt.textContent = ' in place';
  b.append(num, txt);
  return b;
}

// One history row: number, pegs, score badge, codes left.
export function historyRow(i, g, r, N, { left = null, hits = null, pop = false, label = 'Guess' } = {}) {
  const li = document.createElement('li');
  li.className = 'bp-hrow';
  const n = document.createElement('span');
  n.className = 'bp-hrow-n';
  n.textContent = i + 1;
  n.setAttribute('aria-hidden', 'true');
  const meta = document.createElement('span');
  meta.className = 'bp-hrow-meta';
  const lf = document.createElement('span');
  lf.className = 'bp-left';
  setLeft(lf, left);
  meta.append(scoreBadge(r, N, { pop }), lf);
  const pegs = document.createElement('span');
  pegs.className = 'bp-hrow-pegs';
  pegs.appendChild(pegRow(g, { size: 'sm', hits, label: `${label} ${i + 1}` }));
  li.append(n, pegs, meta);
  return li;
}

export function setLeft(el, left) {
  if (left == null) { el.textContent = '…'; el.title = 'Counting codes still possible'; return; }
  el.textContent = `${fmt(left)} left`;
  el.title = `${fmt(left)} code${left === 1 ? '' : 's'} still possible after this answer`;
}

// ---------- inline confirm (no window.confirm) ----------
export function inlineConfirm(box) {
  const msg = box.querySelector('.bp-confirm-msg');
  const yes = box.querySelector('[data-yes]');
  const no = box.querySelector('[data-no]');
  let action = null;
  let onCancel = null;
  const close = () => { box.hidden = true; action = null; const c = onCancel; onCancel = null; return c; };
  yes.addEventListener('click', () => { const a = action; close(); if (a) a(); });
  no.addEventListener('click', () => { const c = close(); if (c) c(); });
  return {
    ask(text, yesText, fn, cancelFn = null) {
      msg.textContent = text;
      if (yesText) yes.textContent = yesText;
      action = fn;
      onCancel = cancelFn;
      box.hidden = false;
      no.focus({ preventScroll: true });
    },
    close() { box.hidden = true; action = null; onCancel = null; },
    get open() { return !box.hidden; },
  };
}

// ---------- worker channel ----------
// One module worker with request ids. cancel() terminates it, so any pending
// work stops at once; the next call starts a fresh worker.
export function makeWorker() {
  return new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
}

export class Channel {
  constructor() {
    this.w = null;
    this.seq = 1;
    this.pending = new Map();
  }

  call(msg, onProgress) {
    const id = this.seq++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress });
      try {
        this.worker().postMessage({ ...msg, id });
      } catch (e) {
        this.pending.delete(id);
        reject(e);
      }
    });
  }

  worker() {
    if (this.w) return this.w;
    const w = makeWorker();
    w.onmessage = (e) => {
      const m = e.data || {};
      const p = this.pending.get(m.id);
      if (!p) return;
      if ('progress' in m) { if (p.onProgress) p.onProgress(m.progress); return; }
      this.pending.delete(m.id);
      if (m.error) p.reject(new Error(m.error));
      else p.resolve(m);
    };
    w.onerror = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      if (this.w === w) { w.terminate(); this.w = null; }
      this.failAll(new Error('The solver stopped unexpectedly.'));
    };
    this.w = w;
    return w;
  }

  failAll(err) {
    const all = [...this.pending.values()];
    this.pending.clear();
    for (const p of all) p.reject(err);
  }

  cancel() {
    if (this.w) { this.w.terminate(); this.w = null; }
    const err = new Error('cancelled');
    err.cancelled = true;
    this.failAll(err);
  }
}

// ---------- statistics ----------
export function summarize(values) {
  const a = values.slice().sort((x, y) => x - y);
  const n = a.length;
  if (!n) return null;
  let s = 0, s2 = 0;
  for (const x of a) { s += x; s2 += x * x; }
  const mean = s / n;
  const sd = n > 1 ? Math.sqrt(Math.max(0, (s2 - n * mean * mean) / (n - 1))) : NaN;
  const mid = Math.floor(n / 2);
  return {
    n,
    mean,
    hw: n > 1 ? 1.96 * sd / Math.sqrt(n) : NaN,
    median: n % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2,
    p95: a[Math.max(0, Math.ceil(0.95 * n) - 1)],
    min: a[0],
    max: a[n - 1],
  };
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}
