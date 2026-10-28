// Module worker for the black-peg Mastermind page. Every message is { id, type, N, K, ... };
// every reply is { id, ...result } or { id, error }. 'sim' also streams { id, progress }
// replies (one per finished game) before its final reply.
// handle(msg, post) is pure so it can be tested from node; onmessage is only attached
// when this file runs inside a worker.
import { LIMITS, mulberry32, createEngine } from './engine.js';

// Fixed number per strategy: game g's random stream depends on it, not on which
// strategies are ticked. Append-only.
export const STRAT_NO = { entropy: 0, randomConsistent: 1, countBinary: 2, countSingle: 3 };
const MAX_GUESSES = 200;
const LIST_MAX = 30;

const engines = new Map();
function engineFor(N, K) {
  const key = N + 'x' + K;
  let E = engines.get(key);
  if (!E) { E = createEngine(N, K); engines.set(key, E); }
  return E;
}

// Run seed -> game g's secret, and the random stream a strategy uses in game g.
export function gameSecret(E, seed, g) {
  const r = mulberry32((seed ^ Math.imul(g + 1, 2654435761)) >>> 0);
  const s = []; for (let i = 0; i < E.N; i++) s.push(Math.floor(r() * E.K)); return s;
}
export function gameRngSeed(seed, g, strat) { return (seed + g * 7919 + STRAT_NO[strat] * 104729) >>> 0; }

class InputError extends Error {}
const fail = msg => { throw new InputError(msg); };
const isInt = x => Number.isInteger(x);

function parseCode(E, s, what) {
  if (typeof s !== 'string' || s.length !== E.N) fail(what + ' must be ' + E.N + ' symbols long');
  const c = E.fromStr(s);
  if (c.some(x => x < 0)) fail(what + ' may only use ' + E.LET);
  return c;
}
function parseHist(E, hist) {
  if (!Array.isArray(hist)) fail('hist must be an array');
  return hist.map((x, i) => {
    if (!x || typeof x !== 'object') fail('guess ' + (i + 1) + ' is malformed');
    const g = parseCode(E, x.g, 'guess ' + (i + 1));
    if (!isInt(x.r) || x.r < 0 || x.r > E.N) fail('answer ' + (i + 1) + ' must be a whole number from 0 to ' + E.N);
    return { g, r: x.r };
  });
}
function parseStrategy(E, id) {
  if (!Object.prototype.hasOwnProperty.call(STRAT_NO, id)) fail('unknown strategy ' + id);
  if (!E.available(id)) fail(id + ' needs more symbols than positions');
  return id;
}

function suggest(E, m) {
  const hist = parseHist(E, m.hist);
  const rng = mulberry32(m.seed >>> 0);
  const sp = new E.Space(hist);
  const total = sp.total;
  if (total === 0) return { total: 0, guess: null, consistent: false, H: 0, marg: [], margExact: true, list: [] };
  const b = E.entropyGuess(hist, rng, { samples: 800, starts: 16, space: sp });
  // marginals: exact when few codes remain, else from a uniform sample
  let codes, margExact = false;
  if (total <= 5000) { codes = sp.enumerate(); margExact = true; }
  else { codes = []; for (let k = 0; k < 3000; k++) codes.push(sp.sample(rng)); }
  const marg = [];
  for (let i = 0; i < E.N; i++) { const a = new Array(E.K).fill(0); for (const c of codes) a[c[i]]++; marg.push(a.map(x => x / codes.length)); }
  return {
    total, guess: E.toStr(b.guess), consistent: E.consistent(b.guess, hist), H: b.H, marg, margExact,
    list: total <= LIST_MAX ? codes.map(E.toStr) : [],
  };
}

function count(E, m) {
  const sp = new E.Space(parseHist(E, m.hist));
  return { total: sp.total, list: sp.total <= LIST_MAX ? sp.enumerate().map(E.toStr) : [] };
}

// Plays the listed game numbers; everything about game g follows from (seed, g, N, K),
// so any worker can play any game.
function sim(E, m, id, post) {
  if (!Array.isArray(m.strategies) || m.strategies.length === 0) fail('strategies must be a non-empty array');
  const strats = m.strategies.map(s => parseStrategy(E, s));
  if (!Array.isArray(m.idx) || m.idx.some(g => !isInt(g) || g < 0)) fail('idx must be an array of game numbers');
  const seed = m.seed >>> 0;
  const out = [];
  for (const g of m.idx) {
    const secret = gameSecret(E, seed, g);
    const ns = {};
    for (const s of strats) ns[s] = E.playGame(s, secret, mulberry32(gameRngSeed(seed, g, s)), {}, MAX_GUESSES).n;
    const row = { g, secret: E.toStr(secret), ns };
    out.push(row);
    post({ id, progress: row });
  }
  return { out };
}

function play(E, m) {
  const strat = parseStrategy(E, m.strategy);
  const secret = parseCode(E, m.secret, 'secret');
  const r = E.playGame(strat, secret, mulberry32(m.seed >>> 0), {}, MAX_GUESSES);
  const steps = [], hist = [];
  for (const x of r.log) { hist.push(x); steps.push({ g: E.toStr(x.g), r: x.r, left: new E.Space(hist).total }); }
  return { steps };
}

const HANDLERS = { suggest, count, sim, play };

export function handle(m, post) {
  const id = m && m.id;
  try {
    if (!m || typeof m !== 'object') fail('message must be an object');
    const { N, K } = m;
    if (!isInt(N) || N < LIMITS.minN || N > LIMITS.maxN) fail('N must be a whole number from ' + LIMITS.minN + ' to ' + LIMITS.maxN);
    if (!isInt(K) || K < LIMITS.minK || K > LIMITS.maxK) fail('K must be a whole number from ' + LIMITS.minK + ' to ' + LIMITS.maxK);
    const h = Object.prototype.hasOwnProperty.call(HANDLERS, m.type) ? HANDLERS[m.type] : null;
    if (!h) fail('unknown message type ' + m.type);
    post({ id, ...h(engineFor(N, K), m, id, post) });
  } catch (e) {
    post({ id, error: e instanceof InputError ? e.message : 'internal error: ' + (e && e.message ? e.message : String(e)) });
  }
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = e => handle(e.data, msg => self.postMessage(msg));
}
