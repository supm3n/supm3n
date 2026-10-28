// Black-peg Mastermind engine: a secret of N positions, each one of K symbols (repeats
// allowed); every guess is answered only with the number of exact-position matches.
// createEngine(N, K) returns the solver for one size. Codes are int arrays 0..K-1.
// At N=10, K=12 every strategy makes the same guesses (same rng draws) as the original
// single-size engine this was ported from.

export const LIMITS = { minN: 2, maxN: 12, minK: 2, maxK: 16 };
export const SYMBOLS = 'ABCDEFGHIJKLMNOP';

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash multipliers for the per-guess match digits of a DP state.
const HMUL = (function () { const a = new Int32Array(64); let x = 0x2545F491; for (let j = 0; j < 64; j++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; a[j] = x | 1; } return a; })();

// plogp[c] = -(c/n) log2(c/n): entropy term for a response bucket holding c of the n codes.
// Depends only on n, so it is shared by every engine size.
const plogpCache = new Map();
function getPlogp(n) {
  let a = plogpCache.get(n); if (a) return a;
  a = new Float64Array(n + 1); for (let c = 1; c <= n; c++) { const p = c / n; a[c] = -p * Math.log2(p); }
  if (n <= 640 || n === 1500) plogpCache.set(n, a);
  return a;
}

// Numeric safety for the largest size (12 x 16): K^N <= 16^12 ~ 2.8e14 < 2^53, so code
// counts and climber memo keys are exact; match digits (<= 12) fit Int8, symbols (< 16) Uint8.
export function createEngine(N, K) {
  if (!Number.isInteger(N) || N < LIMITS.minN || N > LIMITS.maxN) throw new RangeError('N must be an integer in ' + LIMITS.minN + '..' + LIMITS.maxN);
  if (!Number.isInteger(K) || K < LIMITS.minK || K > LIMITS.maxK) throw new RangeError('K must be an integer in ' + LIMITS.minK + '..' + LIMITS.maxK);
  const LET = SYMBOLS.slice(0, K);

  function score(g, s) { let m = 0; for (let i = 0; i < N; i++) if (g[i] === s[i]) m++; return m; }
  const toStr = c => c.map(x => LET[x]).join('');
  const fromStr = s => s.toUpperCase().split('').map(ch => LET.indexOf(ch));

  // ---------- Exact space of codes consistent with history ----------
  // DP over positions; state = vector of matches so far per past guess. Forward BFS layer by
  // layer (flat typed arrays, open-addressing hash per layer) meets a backward pass in the
  // middle; every count is an exact integer (< 2^53).
  // Feasibility of placing a pattern uses two bitmasks per state:
  //   F = guesses already at their score (pattern may not add a match to them),
  //   R = guesses that need a match at every remaining position (pattern must add one).
  class Space {
    constructor(hist) {
      this.h = hist; const Q = hist.length; this.Q = Q;
      this.r = hist.map(x => x.r);
      // per position: symbols grouped by which past guesses they would match
      this.pat = [];
      for (let i = 0; i < N; i++) {
        const map = new Map();
        for (let c = 0; c < K; c++) {
          const js = [];
          for (let j = 0; j < Q; j++) if (hist[j].g[i] === c) js.push(j);
          const key = js.join(',');
          if (!map.has(key)) map.set(key, { js, letters: [] });
          map.get(key).letters.push(c);
        }
        this.pat.push([...map.values()]);
      }
      let P = 1; const w = [];
      for (let j = 0; j < Q; j++) { w.push(P); P *= (this.r[j] + 1); }
      // num: states keyed by an exact mixed-radix number; otherwise compared digit by digit
      this.num = P <= 2 ** 52;
      const NW = (Q + 31) >>> 5 || 1; this.NW = NW;
      for (const pats of this.pat) for (const p of pats) {
        p.mask = new Uint8Array(Q); let inc = 0, hinc = 0; const bw = new Int32Array(NW);
        for (const j of p.js) { p.mask[j] = 1; inc += w[j]; hinc = (hinc + HMUL[j & 63]) | 0; bw[j >>> 5] |= 1 << (j & 31); }
        p.inc = inc; p.hinc = hinc; p.bw = bw; p.bits = bw[0]; p.nl = p.letters.length;
      }
      this.states = 0;
      let ok = true; for (const r of this.r) if (r < 0 || r > N) ok = false;
      this.L = null;
      this.total = ok ? this._build() : 0;
    }
    _newLayer(cap, np) {
      const Q = this.Q, tsz = 1 << Math.max(4, 32 - Math.clz32(cap * 2 - 1));
      return { n: 0, cap, np, dig: new Int8Array(cap * Q || 1), key: new Float64Array(cap), hash: new Int32Array(cap),
        tab: new Int32Array(tsz), tmask: tsz - 1, edge: null, cnt: null };
    }
    _grow(L) {
      const Q = this.Q, cap = L.cap * 2;
      const dig = new Int8Array(cap * Q || 1); dig.set(L.dig); L.dig = dig;
      const key = new Float64Array(cap); key.set(L.key); L.key = key;
      const hash = new Int32Array(cap); hash.set(L.hash); L.hash = hash;
      L.cap = cap;
      const tsz = L.tab.length * 2, tab = new Int32Array(tsz), tm = tsz - 1;
      for (let s = 0; s < L.n; s++) { let slot = Math.imul(L.hash[s], 0x9E3779B1) >>> 0 & tm; while (tab[slot]) slot = (slot + 1) & tm; tab[slot] = s + 1; }
      L.tab = tab; L.tmask = tm;
    }
    // index of the state with digits dig[o..o+Q) + sg*mask (key ck, hash ch) in layer C, or -1
    _find(C, ck, ch, dig, o, mk, sg) {
      const Q = this.Q; let slot = Math.imul(ch, 0x9E3779B1) >>> 0 & C.tmask;
      for (;;) {
        const t = C.tab[slot]; if (t === 0) return -1;
        const c = t - 1;
        if (C.hash[c] === ch) {
          if (this.num) { if (C.key[c] === ck) return c; }
          else { const co = c * Q, cd = C.dig; let eq = true; for (let j = 0; j < Q; j++) if (cd[co + j] !== dig[o + j] + sg * mk[j]) { eq = false; break; } if (eq) return c; }
        }
        slot = (slot + 1) & C.tmask;
      }
    }
    _insert(C, ck, ch, dig, o, js, sg) {
      const Q = this.Q;
      if (C.n === C.cap) this._grow(C);
      let slot = Math.imul(ch, 0x9E3779B1) >>> 0 & C.tmask; while (C.tab[slot]) slot = (slot + 1) & C.tmask;
      const idx = C.n++;
      C.tab[slot] = idx + 1; C.key[idx] = ck; C.hash[idx] = ch;
      const co = idx * Q, cd = C.dig; for (let j = 0; j < Q; j++) cd[co + j] = dig[o + j];
      for (let t = 0; t < js.length; t++) cd[co + js[t]] += sg;
      return idx;
    }
    // Expand layer L through the patterns of position `pos`.
    // Forward (sg=+1): child = st + mask, needs st+mask <= r and st+mask + (N-pos-1) >= r.
    // Backward (sg=-1): state = matches still needed; parent = need - mask, needs
    //   0 <= need-mask <= pos. Calls emit(s, k, idx) for each feasible transition.
    _expand(L, pos, sg, nextNp, emit) {
      const Q = this.Q, num = this.num, NW = this.NW, rr = this.rr;
      const pats = this.pat[pos], np = pats.length;
      const C = this._newLayer(Math.max(16, Math.min(L.n * np, L.n * 4)), nextNp);
      const pbits = this._pbits[pos], phinc = this._phinc[pos], pinc = this._pinc[pos];
      const single = NW === 1, Fw = this._Fw, Rw = this._Rw;
      const rem1 = N - pos;
      for (let s = 0; s < L.n; s++) {
        const o = s * Q, dig = L.dig;
        let F = 0, R = 0;
        if (sg > 0) {
          if (single) { for (let j = 0; j < Q; j++) { const d = dig[o + j], rj = rr[j]; if (d === rj) F |= 1 << j; else if (rj - d === rem1) R |= 1 << j; } }
          else { Fw.fill(0); Rw.fill(0); for (let j = 0; j < Q; j++) { const d = dig[o + j], rj = rr[j]; if (d === rj) Fw[j >>> 5] |= 1 << (j & 31); else if (rj - d === rem1) Rw[j >>> 5] |= 1 << (j & 31); } }
        } else {
          const top = pos + 1;
          if (single) { for (let j = 0; j < Q; j++) { const d = dig[o + j]; if (d === 0) F |= 1 << j; else if (d === top) R |= 1 << j; } }
          else { Fw.fill(0); Rw.fill(0); for (let j = 0; j < Q; j++) { const d = dig[o + j]; if (d === 0) Fw[j >>> 5] |= 1 << (j & 31); else if (d === top) Rw[j >>> 5] |= 1 << (j & 31); } }
        }
        const pk = L.key[s], ph = L.hash[s];
        for (let k = 0; k < np; k++) {
          const p = pats[k];
          if (single) { const b = pbits[k]; if ((b & F) !== 0 || (R & ~b) !== 0) continue; }
          else { const bw = p.bw; let feas = true; for (let t = 0; t < NW; t++) if ((bw[t] & Fw[t]) !== 0 || (Rw[t] & ~bw[t]) !== 0) { feas = false; break; } if (!feas) continue; }
          const ck = num ? pk + sg * pinc[k] : 0, ch = (ph + sg * phinc[k]) | 0;
          let idx = this._find(C, ck, ch, dig, o, p.mask, sg);
          if (idx < 0) idx = this._insert(C, ck, ch, dig, o, p.js, sg);
          emit(s, k, idx);
        }
      }
      return C;
    }
    _build() {
      const Q = this.Q, r = this.r, NW = this.NW;
      const rr = new Int8Array(Q || 1); for (let j = 0; j < Q; j++) rr[j] = r[j]; this.rr = rr;
      this._Fw = new Int32Array(NW); this._Rw = new Int32Array(NW);
      this._pbits = []; this._phinc = []; this._pinc = [];
      for (let i = 0; i < N; i++) {
        const pats = this.pat[i], np = pats.length;
        const pb = new Int32Array(np), ph = new Int32Array(np), pi = new Float64Array(np);
        for (let k = 0; k < np; k++) { pb[k] = pats[k].bits; ph[k] = pats[k].hinc; pi[k] = pats[k].inc; }
        this._pbits.push(pb); this._phinc.push(ph); this._pinc.push(pi);
      }
      const npOf = i => (i < N ? this.pat[i].length : 0);
      const fl = [], bl = new Array(N + 1);
      // forward root: all zeros
      const F0 = this._newLayer(16, npOf(0)); F0.n = 1; F0.key[0] = 0; F0.hash[0] = 0; F0.tab[Math.imul(0, 0x9E3779B1) >>> 0 & F0.tmask] = 1;
      fl.push(F0);
      // backward root at boundary N: need = r
      const BN = this._newLayer(16, 0); BN.n = 1;
      { let k0 = 0, h0 = 0, wv = 1; for (let j = 0; j < Q; j++) { BN.dig[j] = r[j]; k0 += r[j] * wv; wv *= r[j] + 1; h0 = (h0 + Math.imul(r[j], HMUL[j & 63])) | 0; }
        BN.key[0] = this.num ? k0 : 0; BN.hash[0] = h0; BN.tab[Math.imul(h0, 0x9E3779B1) >>> 0 & BN.tmask] = 1; }
      BN.cnt = new Float64Array([1]);
      bl[N] = BN;
      // grow whichever side is cheaper until they meet
      let f = 0, b = N;
      while (f < b) {
        const Lf = fl[f], Lb = bl[b];
        if (Lf.n === 0 || Lb.n === 0) return 0;
        if (Lf.n * Lf.np <= Lb.n * npOf(b - 1)) {
          const np = Lf.np, edge = new Int32Array(Lf.n * np).fill(-1);
          const C = this._expand(Lf, f, 1, npOf(f + 1), (s, k, idx) => { edge[s * np + k] = idx; });
          Lf.edge = edge; fl.push(C); f++;
        } else {
          const pos = b - 1, pats = this.pat[pos];
          let tri = new Int32Array(3 * Math.max(64, Math.min(Lb.n * npOf(pos), Lb.n * 6))), nt = 0;
          const C = this._expand(Lb, pos, -1, npOf(pos), (s, k, idx) => {
            if (nt + 3 > tri.length) { const t2 = new Int32Array(tri.length * 2); t2.set(tri); tri = t2; }
            tri[nt++] = idx; tri[nt++] = k; tri[nt++] = s;
          });
          // C's states are parents (boundary pos); edges parent --pattern k at pos--> child in Lb
          const np = pats.length, edge = new Int32Array(C.n * np).fill(-1), cnt = new Float64Array(C.n), cc = Lb.cnt;
          for (let t = 0; t < nt; t += 3) { const par = tri[t], k = tri[t + 1], ch = tri[t + 2]; edge[par * np + k] = ch; cnt[par] += cc[ch] * pats[k].nl; }
          C.edge = edge; C.cnt = cnt; C.np = np; bl[pos] = C; b--;
        }
      }
      // meet at boundary m = f = b: map forward states onto backward ones (same vector)
      const m = f, Fm = fl[m], Bm = bl[m];
      const layers = new Array(N + 1);
      for (let i = m; i <= N; i++) layers[i] = bl[i];
      // m >= 1 always: at f = 0 the forward root (1 state) is never costlier than a non-empty backward layer
      const link = new Int32Array(Fm.n), z = new Int8Array(Q || 1);
      for (let s = 0; s < Fm.n; s++) link[s] = this._find(Bm, this.num ? Fm.key[s] : 0, Fm.hash[s], Fm.dig, s * Q, z, 0);
      // forward layers 0..m-1: redirect edges into layer m to backward indices; counts backward
      for (let i = m - 1; i >= 0; i--) {
        const Lc = fl[i], np = Lc.np, edge = Lc.edge, pats = this.pat[i];
        if (i === m - 1) for (let t = 0; t < edge.length; t++) if (edge[t] >= 0) edge[t] = link[edge[t]];
        const cc = (i === m - 1 ? Bm : fl[i + 1]).cnt, cnt = new Float64Array(Lc.n);
        for (let s = 0; s < Lc.n; s++) {
          let v = 0;
          for (let k = 0; k < np; k++) { const e = edge[s * np + k]; if (e < 0) continue; const sub = cc[e]; if (sub) v += sub * pats[k].nl; }
          cnt[s] = v;
        }
        Lc.cnt = cnt; layers[i] = Lc;
      }
      this.states = 0; for (const l of layers) this.states += l.n;
      this.L = layers;
      return layers[0].cnt[0];
    }
    // uniform random consistent code (null if none)
    sample(rng) {
      if (!this.total) return null;
      const layers = this.L; const code = []; let s = 0;
      for (let i = 0; i < N; i++) {
        const Lc = layers[i], np = Lc.np, edge = Lc.edge, cc = layers[i + 1].cnt, pats = this.pat[i];
        const tot = Lc.cnt[s]; let x = rng() * tot;
        let chosen = -1, lastK = -1, csub = 0, lsub = 0;
        const base = s * np;
        for (let k = 0; k < np; k++) {
          const e = edge[base + k]; if (e < 0) continue;
          const sub = cc[e]; if (!sub) continue;
          lastK = k; lsub = sub;
          const wt = sub * pats[k].nl;
          if (x < wt) { chosen = k; csub = sub; break; }
          x -= wt;
        }
        if (chosen < 0) { chosen = lastK; csub = lsub; x = 0; }
        const p = pats[chosen];
        let li = Math.floor(x / csub); if (li >= p.nl) li = p.nl - 1;
        code.push(p.letters[li]);
        s = edge[base + chosen];
      }
      return code;
    }
    // all consistent codes (up to limit), in lexicographic pattern order
    enumerate(limit = Infinity) {
      const out = []; const code = new Array(N);
      if (!this.total) return out;
      const layers = this.L, pat = this.pat;
      const rec = (i, s) => {
        if (i === N) { out.push(code.slice()); return; }
        const Lc = layers[i], np = Lc.np, edge = Lc.edge, cc = layers[i + 1].cnt, pats = pat[i];
        for (let k = 0; k < np; k++) {
          const e = edge[s * np + k]; if (e < 0) continue;
          if (!cc[e]) continue;
          const lt = pats[k].letters;
          for (let t = 0; t < lt.length; t++) { code[i] = lt[t]; rec(i + 1, e); if (out.length >= limit) return; }
        }
      };
      rec(0, 0);
      return out;
    }
  }

  function consistent(g, hist) { for (const x of hist) if (score(x.g, g) !== x.r) return false; return true; }

  // ---------- Entropy helpers ----------
  function entropyFromHist(hist, n) {
    let H = 0; for (let v = 0; v <= N; v++) { const c = hist[v]; if (c) { const p = c / n; H -= p * Math.log2(p); } } return H;
  }

  // Fast information search over a set of codes: steepest-ascent hill climbing over
  // single-symbol changes. Per climb we keep m[s] (matches of code s with the current guess),
  // cnt[i][c][v] = #codes with symbol c at position i and m = v, and T[v] = histogram of m.
  // The response histogram for "symbol c at position i" is then
  //   T[v] - cnt[i][a][v] + cnt[i][a][v+1] - cnt[i][c][v] + cnt[i][c][v-1]   (a = current symbol)
  // A move only touches codes having the old or new symbol at that position.
  const CW = N + 3; // stride of one cnt row: slot 0 and N+2 stay zero (v-1 / v+1 guards)
  // makeClimber(secrets) or makeClimber(null, parentCol, idx): the latter climbs over the
  // codes parentCol[.][idx[t]] (a subset / resample of a parent climber's codes, in that order)
  function makeClimber(secrets, pcol, idx) {
    const n = secrets ? secrets.length : idx.length;
    const col = [];
    if (secrets) for (let i = 0; i < N; i++) { const a = new Uint8Array(n); for (let s = 0; s < n; s++) a[s] = secrets[s][i]; col.push(a); }
    else for (let i = 0; i < N; i++) { const a = new Uint8Array(n), p = pcol[i]; for (let s = 0; s < n; s++) a[s] = p[idx[s]]; col.push(a); }
    const plogp = getPlogp(n);
    // per (position, symbol) list of codes: blist[bstart[i*K+c] .. bstart[i*K+c+1])
    const bstart = new Int32Array(N * K + 1), blist = new Int32Array(n * N), offs = new Int32Array(n * N);
    for (let i = 0; i < N; i++) { const ci = col[i]; for (let s = 0; s < n; s++) bstart[i * K + ci[s] + 1]++; }
    for (let t = 1; t <= N * K; t++) bstart[t] += bstart[t - 1];
    { const fill = bstart.slice(0, N * K); for (let i = 0; i < N; i++) { const ci = col[i]; for (let s = 0; s < n; s++) { const c = ci[s]; blist[fill[i * K + c]++] = s; offs[s * N + i] = (i * K + c) * CW + 1; } } }
    const cnt = new Int32Array(N * K * CW), T = new Int32Array(CW), m = new Int32Array(n), base = new Int32Array(N + 1);
    const evalH = (g, mm, hh) => {
      hh.fill(0); mm.fill(0);
      for (let i = 0; i < N; i++) { const t1 = bstart[i * K + g[i] + 1]; for (let t = bstart[i * K + g[i]]; t < t1; t++) mm[blist[t]]++; }
      for (let s = 0; s < n; s++) hh[mm[s]]++;
      return entropyFromHist(hh, n);
    };
    const hh0 = new Int32Array(N + 1);
    // Trajectory memo: the climb is deterministic given the current guess, so once a climb
    // from state g ended naturally after r more moves, any later climb reaching g with >= r
    // iterations left ends identically. Keys are g in base K (exact, K^N < 2^53).
    const memo = new Map(); const pathK = []; const PK = [];
    for (let i = 0, p = 1; i < N; i++, p *= K) PK.push(p);
    const climb = (g0, maxIter = 40) => {
      const g = g0.slice();
      let key = 0; for (let i = 0; i < N; i++) key += g[i] * PK[i];
      let e = memo.get(key);
      if (e !== undefined && e.rem <= maxIter) return { g: e.g.slice(), H: e.H };
      let H = evalH(g, m, hh0);
      if (maxIter <= 0) return { g, H };
      cnt.fill(0); T.fill(0);
      for (let s = 0; s < n; s++) { const ms = m[s]; T[ms + 1]++; const o = s * N; for (let i = 0; i < N; i++) cnt[offs[o + i] + ms]++; }
      pathK.length = 0; pathK.push(key);
      let iter = 0, natural = false, hit = false, tail = 0, endG = null, endH = 0;
      for (; iter < maxIter; iter++) {
        if (iter > 0) { e = memo.get(key); if (e !== undefined && e.rem <= maxIter - iter) { natural = true; hit = true; tail = e.rem; endG = e.g; endH = e.H; break; } pathK.push(key); }
        let bestH = H + 1e-9, bi = -1, bc = -1;
        // histogram entries outside [lo-1, hi+1] (lo/hi = min/max of m) are zero for every
        // candidate; skipping their +0 terms leaves every float sum unchanged
        let lo = 0; while (T[lo + 1] === 0) lo++;
        let hi = N; while (T[hi + 1] === 0) hi--;
        const v0 = lo > 0 ? lo - 1 : 0, v1 = hi < N ? hi + 1 : N;
        for (let i = 0; i < N; i++) {
          const a = g[i], A = (i * K + a) * CW;
          let hb = 0;
          for (let v = v0; v <= v1; v++) { const b = T[v + 1] - cnt[A + v + 1] + cnt[A + v + 2]; base[v] = b; hb += plogp[b]; }
          const bi0 = i * K;
          for (let c = 0; c < K; c++) {
            if (c === a) continue;
            let h2;
            if (bstart[bi0 + c] === bstart[bi0 + c + 1]) h2 = hb; // symbol absent at i: histogram = base
            else { const C = (bi0 + c) * CW; h2 = 0; for (let v = v0; v <= v1; v++) h2 += plogp[base[v] - cnt[C + v + 1] + cnt[C + v]]; }
            if (h2 > bestH) { bestH = h2; bi = i; bc = c; }
          }
        }
        if (bi < 0) { natural = true; break; }
        const a = g[bi]; g[bi] = bc; H = bestH; key += (bc - a) * PK[bi];
        let t1 = bstart[bi * K + a + 1];
        for (let t = bstart[bi * K + a]; t < t1; t++) {
          const s = blist[t], ms = m[s]; m[s] = ms - 1; T[ms + 1]--; T[ms]++;
          const o = s * N; for (let i = 0; i < N; i++) { const f = offs[o + i] + ms; cnt[f]--; cnt[f - 1]++; }
        }
        t1 = bstart[bi * K + bc + 1];
        for (let t = bstart[bi * K + bc]; t < t1; t++) {
          const s = blist[t], ms = m[s]; m[s] = ms + 1; T[ms + 1]--; T[ms + 2]++;
          const o = s * N; for (let i = 0; i < N; i++) { const f = offs[o + i] + ms; cnt[f]--; cnt[f + 1]++; }
        }
      }
      if (natural) {
        if (endG === null) { endG = g.slice(); endH = H; }
        // moves from pathK[0] to the natural end: pathK holds every visited state, minus the
        // memoised one we stopped at (which is `tail` moves from the end)
        const M = hit ? pathK.length + tail : pathK.length - 1;
        for (let t = 0; t < pathK.length; t++) if (!memo.has(pathK[t])) memo.set(pathK[t], { g: endG, H: endH, rem: M - t });
        if (hit) return { g: endG.slice(), H: endH };
      }
      return { g, H };
    };
    return { n, col, evalH, climb };
  }

  // Best guess by information gain: hill climbing from several starting points over a
  // uniform sample of the remaining codes (or all of them when few enough).
  // opt: samples (500), enumLimit (3000), starts (12); opt.space reuses a Space built for hist.
  function entropyGuess(hist, rng, opt = {}) { return entropyGuessSp(hist, rng, opt, opt.space || new Space(hist)); }
  function entropyGuessSp(hist, rng, opt, sp) {
    const S = opt.samples || 500, ENUM = opt.enumLimit || 3000, STARTS = opt.starts || 12;
    if (sp.total === 0) return { guess: null, total: 0 };
    if (sp.total === 1) return { guess: sp.enumerate(1)[0], total: 1, H: 0, consistent: true };
    let secrets, full = false;
    if (sp.total <= ENUM) { secrets = sp.enumerate(); full = true; }
    else { secrets = []; for (let k = 0; k < S; k++) secrets.push(sp.sample(rng)); }
    const n = secrets.length;
    if (full && n === 2) return { guess: secrets[0], total: 2, H: 1, consistent: true };
    const C = makeClimber(secrets), col = C.col, evalH = C.evalH, climb = C.climb;
    // marginals
    const marg = []; for (let i = 0; i < N; i++) { const m = new Float64Array(K); for (let s = 0; s < n; s++) m[col[i][s]]++; for (let c = 0; c < K; c++) m[c] /= n; marg.push(m); }

    const starts = [];
    for (let k = 0; k < Math.min(STARTS, n); k++) starts.push(secrets[Math.floor(rng() * n)].slice());
    for (let k = 0; k < STARTS; k++) {
      const g = []; for (let i = 0; i < N; i++) { let x = rng(), c = 0; for (; c < K - 1; c++) { x -= marg[i][c]; if (x < 0) break; } g.push(rng() < 0.3 ? Math.floor(rng() * K) : c); }
      starts.push(g);
    }
    let best = null;
    const winBonus = full ? 1 / n : 0;
    for (const s0 of starts) {
      const r = climb(s0);
      const cons = consistent(r.g, hist);
      const sc = r.H + (cons ? winBonus * 2 + 1e-6 : 0);
      if (!best || sc > best.sc) best = { guess: r.g, H: r.H, sc, consistent: cons };
    }
    // when the set is small, also try every consistent code directly
    if (full && n <= 400) {
      const m = new Int8Array(n), hh = new Int32Array(N + 1);
      for (const g of secrets) { const H = evalH(g, m, hh); const sc = H + winBonus * 2 + 1e-6; if (sc > best.sc) best = { guess: g, H, sc, consistent: true }; }
    }
    best.total = sp.total; best.marg = marg; best.sampled = !full;
    return best;
  }

  // Two-step lookahead: score each strong candidate by the information in its own answer
  // plus the expected information of the best follow-up guess after each possible answer.
  // Small endgames (<= 3000 codes) use the standard solver.
  // Not exposed in the UI for now (slow); nothing calls it.
  function lookaheadGuess(hist, rng, opt = {}) {
    const S = opt.samples || 1500, TOP = opt.top || 6, SUB = opt.sub || 250;
    const sp = new Space(hist);
    if (sp.total <= 3000) return entropyGuessSp(hist, rng, {}, sp);
    const secrets = []; for (let k = 0; k < S; k++) secrets.push(sp.sample(rng));
    const n = secrets.length, C = makeClimber(secrets);
    const pick = arr => arr[Math.floor(rng() * arr.length)];
    const starts = [];
    for (let k = 0; k < 16; k++) starts.push(pick(secrets).slice());
    for (let k = 0; k < 8; k++) { const g = []; for (let i = 0; i < N; i++) g.push(rng() < 0.3 ? Math.floor(rng() * K) : pick(secrets)[i]); starts.push(g); }
    const cands = [], seen = new Set();
    for (const s0 of starts) { const r = C.climb(s0); const key = toStr(r.g); if (!seen.has(key)) { seen.add(key); cands.push(r); } }
    cands.sort((a, b) => b.H - a.H);
    let best = null;
    // buckets hold indices into `secrets`
    const mm = new Int32Array(n), hh = new Int32Array(N + 1), pcol = C.col;
    const bucketIdx = []; for (let v = 0; v <= N; v++) bucketIdx.push(new Int32Array(n));
    const blen = new Int32Array(N + 1);
    const pickI = (arr, len) => arr[Math.floor(rng() * len)];
    for (const c of cands.slice(0, TOP)) {
      C.evalH(c.g, mm, hh); blen.fill(0);
      for (let s = 0; s < n; s++) { const v = mm[s]; bucketIdx[v][blen[v]++] = s; }
      let v2 = c.H;
      for (let v = 0; v <= N; v++) {
        const BL = blen[v], B = bucketIdx[v];
        if (BL < 8) continue;
        let sub;
        if (BL > SUB) { sub = new Int32Array(SUB); for (let k = 0; k < SUB; k++) sub[k] = pickI(B, BL); }
        else sub = B.slice(0, BL);
        const Cb = makeClimber(null, pcol, sub); let bh = 0;
        for (let t = 0; t < 3; t++) { const r = Cb.climb(secrets[pickI(sub, sub.length)].slice(), 12); if (r.H > bh) bh = r.H; }
        v2 += BL / n * bh;
      }
      if (!best || v2 > best.v) best = { g: c.g, v: v2, H: c.H };
    }
    return { guess: best.g, total: sp.total, H: best.H, consistent: consistent(best.g, hist), sampled: true };
  }

  // ---------- Strategies (generators: yield guess, receive score) ----------
  const STRATS = {};

  // Information-maximising guesses (best found).
  STRATS.entropy = function* (rng, opt) {
    const hist = [];
    while (true) { const b = entropyGuess(hist, rng, opt); const r = yield b.guess; hist.push({ g: b.guess, r }); }
  };

  // Always guess a uniformly random code that is still possible.
  STRATS.randomConsistent = function* (rng) {
    const hist = [];
    while (true) { const sp = new Space(hist); const g = sp.sample(rng); const r = yield g; hist.push({ g, r }); }
  };

  // Smarter human: count every symbol, then binary-search each symbol's positions using a
  // symbol known to be absent as filler (needs K > N so one is guaranteed absent).
  STRATS.countBinary = function* () {
    const cnt = new Array(K).fill(0); let sum = 0;
    for (let c = 0; c < K - 1 && sum < N; c++) { const r = yield new Array(N).fill(c); cnt[c] = r; sum += r; }
    if (sum < N) cnt[K - 1] = N - sum;
    const dead = cnt.findIndex(x => x === 0);
    const code = new Array(N).fill(-1);
    let U = []; for (let i = 0; i < N; i++) U.push(i);
    const letters = []; for (let c = 0; c < K; c++) if (cnt[c] > 0) letters.push(c);
    letters.sort((a, b) => cnt[a] - cnt[b]);
    for (let li = 0; li < letters.length; li++) {
      const c = letters[li];
      if (li === letters.length - 1) { for (const i of U) code[i] = c; break; }
      const found = [];
      const locate = function* (set, k) {
        if (k === 0) return;
        if (k === set.length) { for (const i of set) found.push(i); return; }
        const A = set.slice(0, Math.ceil(set.length / 2)), B = set.slice(A.length);
        const g = new Array(N).fill(dead); for (const i of A) g[i] = c;
        const r = yield g;
        yield* locate(A, r); yield* locate(B, k - r);
      };
      yield* locate(U, cnt[c]);
      for (const i of found) code[i] = c;
      U = U.filter(i => !found.includes(i));
    }
    yield code;
  };

  // Human baseline: count every symbol, then place position by position (needs K > N).
  STRATS.countSingle = function* () {
    const cnt = new Array(K).fill(0); let sum = 0;
    for (let c = 0; c < K - 1 && sum < N; c++) { const r = yield new Array(N).fill(c); cnt[c] = r; sum += r; }
    if (sum < N) cnt[K - 1] = N - sum;
    const dead = cnt.findIndex(x => x === 0);
    const code = new Array(N).fill(-1), rem = cnt.slice();
    for (let i = 0; i < N; i++) {
      const cands = []; for (let c = 0; c < K; c++) if (rem[c] > 0) cands.push(c);
      cands.sort((a, b) => rem[b] - rem[a]);
      while (cands.length > 1) {
        const g = new Array(N).fill(dead); g[i] = cands[0];
        const r = yield g; if (r === 1) break; cands.shift();
      }
      code[i] = cands[0]; rem[cands[0]]--;
    }
    yield code;
  };

  // Count strategies need a guaranteed-absent filler symbol, i.e. K > N.
  function available(id) {
    if (!Object.prototype.hasOwnProperty.call(STRATS, id)) return false;
    if (id === 'countBinary' || id === 'countSingle') return K > N;
    return true;
  }

  function playGame(stratName, secret, rng, opt, maxGuesses = 200) {
    const gen = STRATS[stratName](rng, opt);
    let res = gen.next(); let n = 0; const log = [];
    while (!res.done) {
      const g = res.value; n++; const r = score(g, secret); log.push({ g, r });
      if (r === N || n >= maxGuesses) break;
      res = gen.next(r);
    }
    return { n, log, solved: log.length > 0 && log[log.length - 1].r === N };
  }

  return { N, K, LET, score, toStr, fromStr, Space, consistent, entropyGuess, lookaheadGuess, STRATS, playGame, available };
}
