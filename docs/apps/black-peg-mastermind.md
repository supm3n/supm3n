# Black-Peg Mastermind (`/black-peg-mastermind`)

Solver and simulator for black-peg Mastermind: a secret of N positions from K symbols (repeats allowed), where each guess is answered only with how many positions match exactly. Sizes 2–12 positions × 2–16 symbols (letters A–P, drawn as coloured pegs). Everything runs in the browser, in a Web Worker; nothing is sent.

## Files
- `src/pages/black-peg-mastermind/index.astro`, `src/styles/blackpeg.css`: layout and styles.
- `src/scripts/blackpeg/app.js`: game size bar, mode tabs, size in the URL (`?n=&k=`) and localStorage. The modes are `ui-solve.js`, `ui-play.js` and `ui-sim.js` (Compare runs a pool of workers); `ui-common.js` has the worker channel, peg drawing and statistics.
- `src/scripts/blackpeg/engine.js`: `createEngine(N, K)`. Scoring, exact counting of remaining codes (DP over per-guess match tallies), uniform sampling, `entropyGuess` (hill climb over single-symbol changes) and the strategy generators (`STRATS`).
- `src/scripts/blackpeg/worker.js`: module worker; caches one engine per (N, K).
- `src/components/blackpeg/HowItWorks.astro`: explanation, FAQ and JSON-LD (WebApplication + FAQPage, built from the same FAQ list as the visible text).
- `scripts/test-blackpeg.mjs`: engine tests (`npm run test:blackpeg`).

## Notes
- Worker messages, all `{ id, type, N, K, ... }` → `{ id, ...result }` or `{ id, error }`:
  - `suggest` `{ hist, seed }` → exact `total`, next `guess`, its expected bits `H`, per-position symbol probabilities `marg`, and `list` when ≤ 30 codes remain.
  - `count` `{ hist }` → `total` (and `list`); cheap, used by Play.
  - `sim` `{ strategies, idx, seed }` → guesses per strategy per game. Every strategy plays the same secrets; seeds come from `(seed, game, STRAT_NO)`, and `STRAT_NO` is append-only so old seeds replay.
  - `play` `{ strategy, secret, seed }` → the steps of one game.
- Two-step lookahead is hidden and never computed: it matched Max information within noise at about 3× the cost. `lookaheadGuess` stays in the engine, unused.
- The prototype's luck correction (control variates) was tuned for 10 × 12 only, so it was dropped along with auto-stop. Compare reports plain averages with a 95% CI, median, 95th percentile, worst and paired extra guesses vs the best strategy.
- The count strategies need a symbol that is certainly absent, so they are only offered when K > N.
- Reference averages at 10 × 12: Max information ≈ 17.9, Any possible code ≈ 18.5, Count then halve ≈ 30.0, Count then one by one ≈ 32.8.
