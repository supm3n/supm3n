// Tests for the black-peg Mastermind engine and worker (plain node, no deps).
// Run: npm run test:blackpeg
import assert from 'node:assert/strict';
import { LIMITS, SYMBOLS, mulberry32, createEngine } from '../src/scripts/blackpeg/engine.js';
import { handle } from '../src/scripts/blackpeg/worker.js';

let failures = 0;
function test(name, fn) {
  const t0 = performance.now();
  try { fn(); console.log('ok   ' + name + '  (' + (performance.now() - t0).toFixed(0) + ' ms)'); }
  catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + (e.stack || e)); }
}

function allCodes(N, K) {
  const out = [], c = new Array(N).fill(0);
  for (;;) {
    out.push(c.slice());
    let i = N - 1; while (i >= 0 && c[i] === K - 1) c[i--] = 0;
    if (i < 0) return out; c[i]++;
  }
}
const key = c => c.join(',');

test('LIMITS and SYMBOLS', () => {
  assert.deepEqual(LIMITS, { minN: 2, maxN: 12, minK: 2, maxK: 16 });
  assert.equal(SYMBOLS, 'ABCDEFGHIJKLMNOP');
  assert.throws(() => createEngine(1, 4)); assert.throws(() => createEngine(4, 17));
  const E = createEngine(4, 6);
  assert.equal(E.LET, 'ABCDEF');
  assert.equal(E.toStr([0, 5, 2, 2]), 'AFCC'); assert.deepEqual(E.fromStr('afcc'), [0, 5, 2, 2]);
  assert.equal(E.score([0, 1, 2, 3], [0, 2, 2, 1]), 2);
});

test('Space matches brute force on small sizes (total, enumerate, sample)', () => {
  const rng = mulberry32(12345);
  for (let N = 2; N <= 5; N++) for (let K = 2; K <= 5; K++) {
    const E = createEngine(N, K), all = allCodes(N, K);
    for (let trial = 0; trial < 25; trial++) {
      const Q = Math.floor(rng() * 6);
      const hist = [];
      // half the histories come from a real secret (non-empty space), half are random answers
      const secret = all[Math.floor(rng() * all.length)];
      for (let j = 0; j < Q; j++) {
        const g = all[Math.floor(rng() * all.length)];
        hist.push({ g, r: trial % 2 ? E.score(g, secret) : Math.floor(rng() * (N + 1)) });
      }
      const brute = all.filter(c => E.consistent(c, hist));
      const sp = new E.Space(hist);
      assert.equal(sp.total, brute.length, `total N=${N} K=${K} hist=${JSON.stringify(hist)}`);
      const en = sp.enumerate();
      assert.deepEqual(new Set(en.map(key)), new Set(brute.map(key)), 'enumerate set');
      assert.equal(en.length, brute.length, 'enumerate has no duplicates');
      for (let k = 0; k < 20 && brute.length; k++) assert.ok(E.consistent(sp.sample(rng), hist), 'sample is consistent');
      if (!brute.length) assert.equal(sp.sample(rng), null);
    }
  }
});

test('Space with many guesses (multi-word bitmasks) and large sizes', () => {
  const E = createEngine(5, 3), all = allCodes(5, 3), rng = mulberry32(7);
  const secret = [0, 1, 2, 1, 0], hist = [];
  for (let j = 0; j < 40; j++) { const g = all[Math.floor(rng() * all.length)]; hist.push({ g, r: E.score(g, secret) }); }
  assert.equal(new E.Space(hist).total, all.filter(c => E.consistent(c, hist)).length);
  const B = createEngine(12, 16);
  assert.equal(new B.Space([]).total, 16 ** 12);
  assert.equal(new B.Space([{ g: new Array(12).fill(0), r: 0 }]).total, 15 ** 12);
});

const SIZES = [[2, 2, 40], [3, 2, 40], [4, 6, 30], [5, 8, 20], [6, 4, 15], [8, 10, 6], [10, 12, 3], [12, 16, 2]];
for (const [N, K, games] of SIZES) {
  test(`every available strategy solves ${N}x${K} (${games} games each)`, () => {
    const E = createEngine(N, K), rng = mulberry32(N * 100 + K);
    const ids = Object.keys(E.STRATS).filter(E.available);
    if (K <= N) assert.deepEqual(ids, ['entropy', 'randomConsistent'], 'count strategies unavailable when K <= N');
    else assert.equal(ids.length, 4);
    const stats = {};
    for (let t = 0; t < games; t++) {
      const secret = []; for (let i = 0; i < N; i++) secret.push(Math.floor(rng() * K));
      for (const id of ids) {
        const r = E.playGame(id, secret, mulberry32(t * 31 + 1), {}, 200);
        assert.ok(r.solved, `${id} failed on ${E.toStr(secret)}`);
        assert.ok(r.n <= 200);
        assert.equal(E.score(r.log[r.log.length - 1].g, secret), N);
        (stats[id] = stats[id] || []).push(r.n);
      }
    }
    console.log('     avg guesses: ' + ids.map(id => id + ' ' + (stats[id].reduce((a, b) => a + b, 0) / games).toFixed(2)).join(', '));
  });
}

test('timing: suggest at 12x16 after 3 guesses, entropy game at 10x12', () => {
  const E = createEngine(12, 16), rng = mulberry32(99);
  const secret = []; for (let i = 0; i < 12; i++) secret.push(Math.floor(rng() * 16));
  const hist = [];
  for (let j = 0; j < 3; j++) { const g = []; for (let i = 0; i < 12; i++) g.push(Math.floor(rng() * 16)); hist.push({ g: E.toStr(g), r: E.score(g, secret) }); }
  let reply, t0 = performance.now();
  handle({ id: 1, type: 'suggest', N: 12, K: 16, hist, seed: 5 }, m => { reply = m; });
  const ts = performance.now() - t0;
  assert.ok(!reply.error, reply.error);
  console.log(`     suggest 12x16 after 3 guesses: ${ts.toFixed(0)} ms (total ${reply.total.toExponential(3)}, H ${reply.H.toFixed(3)} bits)`);
  const E10 = createEngine(10, 12), s10 = E10.fromStr('ABCDEFGHIJ');
  t0 = performance.now();
  const r = E10.playGame('entropy', s10, mulberry32(1), {}, 200);
  console.log(`     entropy game 10x12: ${(performance.now() - t0).toFixed(0)} ms, ${r.n} guesses`);
  assert.ok(r.solved);
});

test('worker: suggest', () => {
  const out = [];
  handle({ id: 'a', type: 'suggest', N: 4, K: 6, hist: [{ g: 'AABB', r: 1 }, { g: 'CDEF', r: 2 }], seed: 3 }, m => out.push(m));
  assert.equal(out.length, 1); const m = out[0];
  assert.equal(m.id, 'a'); assert.ok(!m.error, m.error);
  const E = createEngine(4, 6), hist = [{ g: E.fromStr('AABB'), r: 1 }, { g: E.fromStr('CDEF'), r: 2 }];
  assert.equal(m.total, new E.Space(hist).total);
  assert.equal(typeof m.guess, 'string'); assert.equal(m.guess.length, 4);
  assert.equal(m.consistent, E.consistent(E.fromStr(m.guess), hist));
  assert.equal(typeof m.H, 'number'); assert.ok(m.H >= 0);
  assert.equal(m.marg.length, 4); for (const row of m.marg) { assert.equal(row.length, 6); assert.ok(Math.abs(row.reduce((a, b) => a + b, 0) - 1) < 1e-9); }
  assert.equal(m.margExact, true);
  assert.equal(m.list.length, m.total <= 30 ? m.total : 0);
  for (const s of m.list) assert.ok(E.consistent(E.fromStr(s), hist));
  // impossible history -> total 0, guess null
  handle({ id: 'b', type: 'suggest', N: 4, K: 6, hist: [{ g: 'AAAA', r: 0 }, { g: 'AAAA', r: 1 }], seed: 3 }, m2 => out.push(m2));
  assert.equal(out[1].total, 0); assert.equal(out[1].guess, null); assert.deepEqual(out[1].list, []);
  // big empty space: sampled marginals
  handle({ id: 'c', type: 'suggest', N: 10, K: 12, hist: [], seed: 1 }, m3 => out.push(m3));
  assert.equal(out[2].total, 12 ** 10); assert.equal(out[2].margExact, false); assert.deepEqual(out[2].list, []);
});

test('worker: count', () => {
  let m; handle({ id: 2, type: 'count', N: 3, K: 3, hist: [{ g: 'ABC', r: 2 }] }, x => { m = x; });
  assert.equal(m.id, 2); assert.equal(m.total, 6); assert.equal(m.list.length, 6);
});

test('worker: sim streams progress and is deterministic', () => {
  const run = () => { const out = []; handle({ id: 3, type: 'sim', N: 4, K: 6, strategies: ['entropy', 'countBinary'], idx: [0, 1, 2], seed: 42 }, x => out.push(x)); return out; };
  const a = run(), b = run();
  assert.equal(a.length, 4);
  for (let i = 0; i < 3; i++) { assert.equal(a[i].id, 3); assert.equal(a[i].progress.g, i); assert.equal(a[i].progress.secret.length, 4); }
  const fin = a[3]; assert.equal(fin.out.length, 3);
  for (const row of fin.out) for (const id of ['entropy', 'countBinary']) assert.ok(row.ns[id] >= 1 && row.ns[id] <= 200);
  assert.deepEqual(a, b);
  // a game's secret and a strategy's guesses do not depend on which strategies are ticked
  const solo = []; handle({ id: 4, type: 'sim', N: 4, K: 6, strategies: ['countBinary'], idx: [1], seed: 42 }, x => solo.push(x));
  assert.equal(solo[1].out[0].secret, fin.out[1].secret); assert.equal(solo[1].out[0].ns.countBinary, fin.out[1].ns.countBinary);
});

test('worker: play', () => {
  let m; handle({ id: 5, type: 'play', N: 5, K: 8, strategy: 'entropy', secret: 'HACAB', seed: 9 }, x => { m = x; });
  assert.ok(!m.error, m.error);
  const last = m.steps[m.steps.length - 1];
  assert.equal(last.g, 'HACAB'); assert.equal(last.r, 5); assert.equal(last.left, 1);
  for (let i = 1; i < m.steps.length; i++) assert.ok(m.steps[i].left <= m.steps[i - 1].left);
});

test('worker: errors', () => {
  const errs = [];
  const cases = [
    { id: 6, type: 'suggest', N: 13, K: 6, hist: [] },
    { id: 7, type: 'suggest', N: 4, K: 6, hist: [{ g: 'ABCG', r: 1 }] },
    { id: 8, type: 'suggest', N: 4, K: 6, hist: [{ g: 'ABC', r: 1 }] },
    { id: 9, type: 'count', N: 4, K: 6, hist: [{ g: 'ABCD', r: 5 }] },
    { id: 10, type: 'sim', N: 6, K: 4, strategies: ['countSingle'], idx: [0], seed: 1 },
    { id: 11, type: 'play', N: 4, K: 6, strategy: 'lookahead', secret: 'ABCD', seed: 1 },
    { id: 12, type: 'nope', N: 4, K: 6 },
  ];
  for (const c of cases) handle(c, x => errs.push(x));
  assert.equal(errs.length, cases.length);
  errs.forEach((e, i) => { assert.equal(e.id, cases[i].id); assert.equal(typeof e.error, 'string', JSON.stringify(e)); });
  console.log('     e.g. ' + errs.map(e => JSON.stringify(e.error)).slice(0, 3).join(' | '));
});

console.log(failures ? `\n${failures} test(s) failed` : '\nall tests passed');
process.exit(failures ? 1 : 0);
