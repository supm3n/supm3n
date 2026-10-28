// "Play": the computer picks a secret, the player guesses, and each guess is
// answered with the count of exact hits only.
import {
  $, fmt, SYMBOLS, Channel, pegRow, historyRow, setLeft, inlineConfirm,
  cleanCode, randomCode, scoreCodes, randomSeed, totalCodes, symbolsText, strategyName,
} from './ui-common.js';

export function createPlay() {
  const countCh = new Channel(); // cheap counts after each guess
  const hintCh = new Channel(); // hints and the solver comparison, cancellable on their own
  const el = {
    view: $('panel-play'),
    board: $('p-board'),
    boardEmpty: $('p-board-empty'),
    compose: $('p-compose'),
    slots: $('p-slots'),
    palette: $('p-palette'),
    input: $('p-input'),
    submit: $('p-submit'),
    clear: $('p-clear'),
    err: $('p-err'),
    total: $('p-total'),
    count: $('p-count'),
    hints: $('p-hints'),
    status: $('p-status'),
    result: $('p-result'),
    secretBox: $('p-secret-box'),
    secret: $('p-secret'),
    hint: $('p-hint'),
    reveal: $('p-reveal'),
    newBtn: $('p-new'),
    hintBox: $('p-hint-box'),
    hintPegs: $('p-hint-pegs'),
    hintNote: $('p-hint-note'),
    hintUse: $('p-hint-use'),
  };
  const confirm = inlineConfirm($('p-confirm'));

  let N = 0, K = 0;
  let secret = '';
  let hist = []; // [{ g, r, left }]
  let draft = []; // symbol index or null per position
  let hints = 0;
  let state = 'playing'; // 'playing' | 'won' | 'revealed'
  let hintGuess = null;
  let active = false;
  let game = 0; // bumps on every new game so late replies are ignored

  const draftText = () => draft.map((x) => (x == null ? '' : SYMBOLS[x])).join('');
  const draftFull = () => draft.every((x) => x != null);

  // ---------- composer ----------
  function buildPalette() {
    el.palette.textContent = '';
    for (let c = 0; c < K; c++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `bp-peg bp-peg-btn s${c}`;
      b.textContent = SYMBOLS[c];
      b.setAttribute('aria-label', `Add ${SYMBOLS[c]}`);
      b.addEventListener('click', () => addSymbol(c));
      el.palette.appendChild(b);
    }
    layoutPalette();
  }

  // Rows of equal length instead of a lone peg on the last row (e.g. 6 + 6 for K = 12).
  function layoutPalette() {
    const w = el.palette.clientWidth;
    if (!w || !K) return;
    const first = el.palette.firstElementChild;
    const sz = first ? first.offsetWidth : 40;
    const gap = parseFloat(getComputedStyle(el.palette).columnGap) || 8;
    const fit = Math.max(1, Math.floor((w + gap) / (sz + gap)));
    el.palette.style.setProperty('--cols', Math.ceil(K / Math.ceil(K / fit)));
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(layoutPalette).observe(el.palette);

  function renderSlots(popAt = -1) {
    el.slots.textContent = '';
    el.slots.style.setProperty('--n', N);
    const next = draft.indexOf(null);
    draft.forEach((x, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      if (x == null) {
        b.className = 'bp-peg bp-slot is-empty' + (i === next ? ' is-next' : '');
        b.setAttribute('aria-label', `Position ${i + 1}: empty`);
        b.disabled = state !== 'playing';
      } else {
        b.className = `bp-peg bp-slot s${x}` + (i === popAt ? ' bp-pop' : '');
        b.textContent = SYMBOLS[x];
        b.setAttribute('aria-label', `Position ${i + 1}: ${SYMBOLS[x]}. Press to clear`);
        b.disabled = state !== 'playing';
        b.addEventListener('click', () => { draft[i] = null; syncDraft(); });
      }
      el.slots.appendChild(b);
    });
    el.submit.disabled = !draftFull() || state !== 'playing';
  }

  function syncDraft(popAt = -1, fromInput = false) {
    if (!fromInput) el.input.value = draftText();
    el.err.textContent = '';
    renderSlots(popAt);
  }

  function addSymbol(c) {
    if (state !== 'playing') return;
    const i = draft.indexOf(null);
    if (i < 0) { el.err.textContent = 'All positions are filled. Press Guess, or tap a slot to clear it.'; return; }
    draft[i] = c;
    syncDraft(i);
  }

  function removeLast() {
    for (let i = N - 1; i >= 0; i--) {
      if (draft[i] != null) { draft[i] = null; syncDraft(); return; }
    }
  }

  function setDraft(code) {
    draft = Array.from({ length: N }, (_, i) => (i < code.length ? SYMBOLS.indexOf(code[i]) : null));
    syncDraft();
  }

  // ---------- board ----------
  function renderBoard(popLast = false) {
    el.board.textContent = '';
    hist.forEach((x, i) => el.board.appendChild(
      historyRow(i, x.g, x.r, N, { left: x.left, pop: popLast && i === hist.length - 1 }),
    ));
    el.boardEmpty.hidden = hist.length > 0;
    el.count.textContent = hist.length;
    el.hints.textContent = hints;
  }

  function setTotal(n) {
    el.total.textContent = n == null ? '…' : fmt(n);
  }

  function setControls() {
    const playing = state === 'playing';
    el.hint.disabled = !playing;
    el.reveal.disabled = !playing;
    el.input.disabled = !playing;
    el.clear.disabled = !playing;
    for (const b of el.palette.querySelectorAll('button')) b.disabled = !playing;
    el.compose.classList.toggle('is-off', !playing);
    renderSlots();
  }

  function hideHint() {
    hintCh.cancel();
    hintGuess = null;
    el.hintBox.hidden = true;
    el.hint.textContent = 'Hint';
  }

  function submitGuess() {
    if (state !== 'playing') return;
    const g = draftText();
    if (!draftFull()) {
      el.err.textContent = `Fill all ${N} positions first (${symbolsText(K)}).`;
      return;
    }
    const r = scoreCodes(g, secret);
    const entry = { g, r, left: r === N ? 1 : null };
    hist.push(entry);
    hideHint();
    confirm.close();
    draft = new Array(N).fill(null);
    if (r === N) {
      state = 'won';
      setTotal(1);
    } else {
      setTotal(null);
      requestCount(entry);
    }
    renderBoard(true);
    syncDraft();
    setControls();
    if (state === 'won') onWin();
    else el.status.textContent = `${r} of ${N} in the right place.` + (r === 0 ? ' None of those symbols belong where you put them.' : '');
  }

  async function requestCount(entry) {
    const g0 = game;
    const histNow = hist.map(({ g, r }) => ({ g, r }));
    try {
      const m = await countCh.call({ type: 'count', N, K, hist: histNow });
      if (g0 !== game) return;
      entry.left = m.total;
      if (hist[hist.length - 1] === entry) setTotal(m.total);
      const idx = hist.indexOf(entry);
      const row = el.board.children[idx];
      if (row) setLeft(row.querySelector('.bp-left'), m.total);
      if (state === 'playing' && hist[hist.length - 1] === entry) {
        el.status.textContent = `${entry.r} of ${N} in the right place. ${m.total === 1 ? 'Only one code fits now.' : `${fmt(m.total)} codes still fit.`}`;
      }
    } catch (e) {
      if (e && e.cancelled) return;
      if (g0 !== game) return;
      el.status.textContent = 'Could not count the remaining codes here. You can keep playing.';
    }
  }

  async function onWin() {
    const n = hist.length;
    el.status.textContent = `Cracked in ${n} guess${n === 1 ? '' : 'es'}!`;
    el.result.hidden = false;
    el.result.textContent = '';
    const p = document.createElement('p');
    p.className = 'bp-result-main';
    p.textContent = `You found it in ${n} guess${n === 1 ? '' : 'es'}` + (hints ? ` with ${hints} hint${hints === 1 ? '' : 's'}.` : ', no hints.');
    const cmp = document.createElement('p');
    cmp.className = 'bp-help';
    cmp.textContent = `Asking the ${strategyName('entropy')} solver to play the same secret…`;
    el.result.append(p, cmp);
    showSecret();
    const g0 = game;
    try {
      const m = await hintCh.call({ type: 'play', N, K, strategy: 'entropy', secret, seed: randomSeed() });
      if (g0 !== game) return;
      const s = m.steps.length;
      cmp.textContent = `On this secret the ${strategyName('entropy')} solver needed ${s} guess${s === 1 ? '' : 'es'}.`;
    } catch (e) {
      if (e && e.cancelled) return;
      if (g0 === game) cmp.textContent = '';
    }
  }

  function showSecret() {
    el.secret.replaceChildren(pegRow(secret, { size: 'md', label: 'Secret code' }));
    el.secretBox.hidden = false;
  }

  function reveal() {
    if (state !== 'playing') return;
    state = 'revealed';
    hideHint();
    confirm.close();
    showSecret();
    el.status.textContent = `The secret was ${secret}. Press New secret to play again.`;
    setControls();
  }

  async function hint() {
    if (state !== 'playing') return;
    hintCh.cancel();
    const g0 = game;
    const len = hist.length;
    el.hint.disabled = true;
    el.hint.textContent = 'Thinking…';
    try {
      const m = await hintCh.call({ type: 'suggest', N, K, hist: hist.map(({ g, r }) => ({ g, r })), seed: randomSeed() });
      if (g0 !== game || hist.length !== len || state !== 'playing') return;
      hints++;
      el.hints.textContent = hints;
      hintGuess = m.guess;
      if (!hintGuess) { el.hintBox.hidden = true; return; }
      el.hintPegs.replaceChildren(pegRow(hintGuess, { size: 'md', label: 'Hint' }));
      el.hintNote.textContent = m.total === 1
        ? 'Only one code fits, so this is the secret.'
        : m.consistent
          ? `${fmt(m.total)} codes still fit. This guess could be the secret.`
          : `${fmt(m.total)} codes still fit. This guess cannot be the secret, but its answer splits them well.`;
      el.hintBox.hidden = false;
    } catch (e) {
      if (e && e.cancelled) return;
      if (g0 === game) el.status.textContent = 'The hint could not be worked out here.';
    } finally {
      if (g0 === game) {
        el.hint.textContent = 'Hint';
        el.hint.disabled = state !== 'playing';
      }
    }
  }

  function newGame() {
    game++;
    countCh.cancel();
    hideHint();
    confirm.close();
    secret = randomCode(N, K);
    hist = [];
    hints = 0;
    state = 'playing';
    draft = new Array(N).fill(null);
    el.result.hidden = true;
    el.secretBox.hidden = true;
    setTotal(Number(totalCodes(N, K)));
    el.status.textContent = 'A new secret is ready. Make your first guess.';
    renderBoard();
    syncDraft();
    setControls();
  }

  // ---------- events ----------
  el.input.addEventListener('input', () => {
    const v = cleanCode(el.input.value, N, K);
    if (v !== el.input.value) el.input.value = v;
    draft = Array.from({ length: N }, (_, i) => (i < v.length ? SYMBOLS.indexOf(v[i]) : null));
    syncDraft(-1, true);
  });
  el.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submitGuess(); }
  });
  el.submit.addEventListener('click', submitGuess);
  el.clear.addEventListener('click', () => { draft = new Array(N).fill(null); syncDraft(); });
  el.hint.addEventListener('click', hint);
  el.hintUse.addEventListener('click', () => { if (hintGuess) setDraft(hintGuess); el.submit.focus(); });
  el.reveal.addEventListener('click', reveal);
  el.newBtn.addEventListener('click', () => {
    if (state === 'playing' && hist.length) {
      confirm.ask(`Start over with a new secret? Your ${hist.length} guess${hist.length === 1 ? '' : 'es'} will be cleared.`, 'New secret', newGame);
    } else newGame();
  });

  // Keyboard play: letters fill the next slot, Backspace removes, Enter guesses.
  document.addEventListener('keydown', (e) => {
    if (!active || state !== 'playing') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && t !== document && t !== document.body && t.id !== 'tab-play' && !el.view.contains(t)) return;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.key === 'Backspace') { e.preventDefault(); removeLast(); return; }
    if (e.key === 'Enter') {
      if (t && t.tagName === 'BUTTON') return;
      e.preventDefault();
      submitGuess();
      return;
    }
    if (e.key.length === 1) {
      const c = SYMBOLS.indexOf(e.key.toUpperCase());
      if (c >= 0 && c < K) { e.preventDefault(); addSymbol(c); }
    }
  });

  return {
    setSize(n, k) {
      N = n;
      K = k;
      el.input.maxLength = N;
      el.input.placeholder = `${N} letters, ${symbolsText(K)}`;
      buildPalette();
      newGame();
    },
    setActive(on) { active = on; },
    hasGuesses: () => state === 'playing' && hist.length > 0,
  };
}
