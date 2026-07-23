# GRIDIRON (Footballers) — agent quick-start

Football career-sim game. **Everything is one file**: `index.html` (~6,500
lines — Phaser bundled inline, art baked as data URLs, game code in inline
`<script>` blocks). `scripts/*.mjs` are headless Playwright dev checks.

**Read `docs/ARCHITECTURE.md` before editing `index.html`** — it maps every
script block, the two engines, the stat-credit flow, and the known gotchas.
`scripts/README.md` catalogs the dev-check scripts.

## Navigate by anchor, never by line number

Line numbers drift; banner comments don't. Key anchors in `index.html`:

- `RIB_TUNE: every gameplay dial` — `TU(key, default)` live tunables
- `GRIDIRON play choreography engine` — legacy render-only choreographer
- `GRIDIRON FieldSim — agent-based play resolution` — the real play resolver
  (agents, contact/tackling, stat truth: `who ACTUALLY made the stop`)
- `v16 EMERGENT GAME ENGINE` — `Yr` / `window.__simGameV2`: full games,
  play-calling, the you-player's box score `P`
- `GRIDIRON live-field bridge v3` — broadcast renderer (after a minified
  Phaser bundle — **never edit the bundle**)
- `RIB DEV HARNESS` — console `DEV.help()`

## Dev loop

```bash
npm install            # once
npm run dev            # vite on :5173 — leave running for all checks
node scripts/<check>.mjs
```

Chromium for Playwright is at `/opt/pw-browsers/chromium` (already wired into
every script — don't run `playwright install`).

## Verify before committing

Run the checks that cover what you touched (each prints JSON + `page errors`):

| You changed… | Run |
|---|---|
| tackling / contact physics | `tacklecheck.mjs`, `jukecheck.mjs` |
| stat credit / box score | `creditcheck.mjs`, `statcreditcheck.mjs` |
| game engine / play-calling / yardage | `simcheck.mjs` |
| anything sim-side that should be visible | `renderpathcheck.mjs` |
| injuries | `injurycheck.mjs` |
| team emblems / palettes / identity | `emblemcheck.mjs` |
| UI / screens | `shot.mjs` (screenshot), `walk.mjs` (click-through) |

## House rules

- **Stat-credit truth**: the you-player's stats must trace to plays where the
  resolved actors name him (`pe(X.tackler)`, `pe(X.assist)`, `pe(skr)`) — never
  proximity, never `Math.random()` side rolls. `creditcheck.mjs` enforces
  credited ≤ sim-truth + sacks.
- New gameplay numbers go through `TU("name", default)`, not bare constants.
- Match the local code density: the career-app block is dense one-liners;
  FieldSim is spacious with comments. Blend in.
- New systems get a `/* ===== vNN NAME ===== */` banner and a "Recent changes"
  entry in `README.md`.
- Don't edit the minified Phaser region or baked data-URL assets.
