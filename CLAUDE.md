# GRIDIRON / "Running It Back" — agent quick-start

A football career-sim: one player's life from Pee Wee to the UFF (and the Interstellar League), every snap
resolved by an agent-based engine (FieldSim) and watchable on a Phaser pixel-art broadcast. Plain browser
JavaScript — classic `<script>` files, no modules, no framework, no build step in dev. `scripts/*check.mjs`
are headless Playwright (or pure-Node) checks.

## The layout (`docs/LAYOUT.md`)

`index.html` (markup, three tiny inline scripts, the baked menu block) loads, in this order:

| file | what lives there |
|---|---|
| `src/03-splash.js` | boot splash, the title film, the loading chase, the live game's loader (both "doors") |
| `src/04-engine.js` | `RIB_TUNE` / `TU()`, the legacy choreographer `buildPlayScript`, **FieldSim** (agents, contact, the throw, stat truth) |
| `src/vendor/phaser.min.js` | Phaser — **never edit** (it hands itself over as `window.__RIB_PHASER_V149`) |
| `src/05-field-renderer.js` | the broadcast: `LiveField`, `PJ` projection, camera, stadium, crowd, sideline, badges, sprites |
| `src/06-phaser-launcher.js` | `window.GridironStorage` (save/backup) + `window.GridironPhaser` |
| `src/07-career-app.js` | **the career app** (~30k lines): state, every screen, the season, prestige, gear, and the game engine `simGameV2` |
| `08`–`10` | contact model, team-rating rosters, persistent season rosters |
| `src/11-pregame-v1513.js` | the pregame wizard's pages |
| `12`–`21` | gear overlay, `DEV` harness, personality, speed-through, story / pregame / growth wheels, Score Attack, leaderboards, Daily Challenge |
| `22`–`25` | hub sections, dock, bottom nav, the v146 E shell |
| `src/26-platform.js` / `src/27-monetize.js` / `src/29-seasons.js` / `src/30-music.js` | PWA + native shell (loaded last) / monetization (**OFF**) / seasons, the Career Pass, the trophy case / the music + every sound's level (`RIB_MUSIC`) |
| `src/styles/*.css`, `public/` | the app CSS; the menu, coach and vault (`public/rib-menu*`, `rib-vault*`), sheets, film, art |

## Finding things

- **Grep the banner:** every system has `/* ===== vNN NAME ===== */` — `grep -rn "v146 E THE MENUS" src/`.
  **`docs/ANCHORS.md` lists every anchor by subsystem**, with its file, hooks and check. Never navigate by line number.
- **Names:** `07` was minified until v149 C. Old notes, comments and commit messages say `q`, `ms`/`no`, `Yr`,
  `tt`, `o`…; `docs/NAMES.md` maps them (`render`, `screenGameOver`/`screenWin`, `simGameV2`, `simSeason`, `state`).
- **The public API is `window.*`** — those names were never renamed; checks, `public/*.js`, other `src/` files
  and inline `onclick="…"` call them (`window.go`, `window.buy`, `window.__simGameV2`, `window.__GRIDIRON_AUDIT__`,
  the `window.__V1NN` hooks each version publishes). Don't rename one without grepping `scripts/` and `public/`.
- **State:** `state` inside `07`; outside it `window.__getGridironState()` / `__GRIDIRON_AUDIT__.getState()`.
  **`window.o` does not exist** (old checks still write to it; that is a no-op).
- **Deep dives:** `docs/ARCHITECTURE.md` (FieldSim, the game engine, the render path, the stat-credit flow, screens).

## Dev loop (`docs/CHECKS.md`)

```bash
npm install                                        # once (in a worktree: ln -s <main>/node_modules node_modules)
npm run dev                                        # vite on :5173 — to play/look; the runner does not need it
npm run check:smoke                                # ~5 min, 20 checks — before every commit
node scripts/run-checks.mjs --since main --jobs 4  # the suites your diff touches (banners/files → suites)
node scripts/run-checks.mjs <suite|check> --jobs 4 # one area (`--list` shows the 72 suites) or named checks
node scripts/<name>check.mjs                       # one check by hand against :5173 (or GAME_URL)
```

- The runner starts its own vite per job (ports from `--base-port`, default 5400 — use your own range when
  others are running); `GAME_URL=http://localhost:5173/` makes every job share a server you already have.
- Results: `PASS` / `INFO` / `KNOWN` (fails on main too — `scripts/known-failures.json`) / **`NEW` (you)** /
  `FLAKY` / `TIMEOUT`. Only NEW and TIMEOUT fail the run. Never add a known-failure for something you broke.
- Which suite covers what: `--list`, or the generated appendix of `docs/CHECKS.md`.
- Chromium is `/opt/pw-browsers/chromium` (wired through `scripts/lib/env.mjs`) — never `playwright install`.

## House rules

- **Stat-credit truth.** The you-player's stats trace to plays whose resolved actors name him (`pe(X.tackler)`,
  `pe(X.assist)`, `pe(skr)`) — never proximity, never a `Math.random()` side roll. `creditcheck` enforces it.
- **Gameplay numbers go through `TU("name", default)`**, never bare constants (retune live via `window.RIB_TUNE`).
  A new behaviour gets a kill switch (`TU("vNNNx", 0)` restores the old path) when it changes the sim.
- **Anything a rendered screen calls by bare name is a hoisted `function` declaration**, never `window.x = …`
  (v140: the boot draws the saved view from the top level of `07`; a throw there bricks the save). `bootviewcheck`.
- **`07` stays formatted with real names.** Write readable code with descriptive names; match the local density
  (FieldSim is spacious and commented). Checks that grep `07` use `\s*` where the formatter may break a line.
- **New systems:** a `/* ===== vNN NAME ===== */` banner, a line in `docs/ANCHORS.md` (its section, at the top),
  an entry at the top of `docs/CHANGELOG.md` (README keeps the last ~5 releases), and a check in `scripts/checks.json`.
  A new top-level file is `src/NN-name.js` + its `<script src vite-ignore>` tag — then run `layoutcheck`.
- **The league is the UFF** (United Football Federation) in every string a player reads — never NFL or DFL.
  Code names keep their old spelling (`DFL_V123`, `dflClubV123`, `dflMvpTitle`, `nflStateV11`).
- **Monetization:** `MONETIZE_ENABLED` ships `false` and OFF must stay a complete no-op (no wrapper, DOM, timer,
  listener or storage write — `v149Echeck` diffs it). Entitlements never live in the save. **Never sell gear,
  rolls, wheel spins, PP, or a setting that is free today.** `docs/MONETIZATION.md`.
- **Saves go through `GridironStorage.save`** (v149 D wraps it for backups). New confirms/prompts use `ribDialog`.
- **The menu, coach and vault files** (`public/rib-menu*`, `public/rib-vault*`) are baked into `index.html`:
  after changing one, `RIB_MENU_VERSION=<stamp> node scripts/bake-menu-into-index.mjs`, or the old file stays cached.
- **Layout changes** (a new `src/` file, a moved tag, anything in `index.html`'s script order): `layoutcheck`.
- Never edit `src/vendor/`; sheets are files in `public/` loaded through `window.__RIB_ASSET(path)`.
- Generated code has a generator — edit the script, not its output (`RIB_META_V91/V92`, `RIB_BADGES_V95`,
  `HAND_V108`, the checks appendix, `docs/ART-PROVENANCE.md`).

## Gotchas that have bitten (one line each — the entry in `docs/ANCHORS.md` has the why)

- Any post-sim **yardage reshape must go through `retagSimLog`**, or the play loses its animation (v103, v146 A).
- **`rollGamePerf` (`et`) moves coach trust** — anything that samples games (projections, probes) must restore the player (v146 D).
- **Randomness changes sample paths:** v143's aim roll and v146 A's sack spend extra `Math.random()` draws, so
  compare several seeds against the OFF spread, never one run against one run (`scoreneutralcheck`).
- **Measure the camera in WALL time on PAIRED replays** — play-time normalisation hides lag; unpaired live runs differ 2× (v147 D).
- **Interstellar is level 8** — every `level >= 7` rule (cuts, offers, story-pro, retire) applies to it too (v147 A).
- **Sprites are scaled by the level's age** (v144 A) — anything reading a screen distance as sim units must back `_ageKV144` out.
- **Measure field density with `PJ` at the LOS**, not a screen spacing (v148).
- **`--rib-ovr2` is `inherits:false`** — a pseudo-element must say `--rib-ovr2: inherit` or draws nothing (v147 B).
- **A per-frame cache guard checks the cached VALUE**, not just the frame number (v144 H `wxV144`).
- **Idle motion jitters around the whistle's spot** (`_idleHomeV144`), never where the man wandered, or 22 men converge (v144 C).
- **The sky stops at the bowl's top, not `NSTOP`** — the far apron rows above the end line are turf (v144 E).
- **Never route "+N a level" through `pointsFlat` / `coachStart`** — `prestigeCap()` caps them (v146 C).
- **A new gear stat must name a hook the game already reads** (v147 C); PP buys go through `window.buy` only (v137).
- **`simSeason`/`render`/`rollGamePerf` are wrapper stacks** (`const X = f; f = function…`) — the last wrapper
  in the file runs first; a change "that does not show up" is usually shadowed by a later layer (`docs/AUDIT.md` §1.1).
- **Timing checks wobble under load** (`loadSensitive` in the manifest): rerun a NEW failure alone before chasing it.
- `v142`'s stat cards quote numbers from the code that reads each stat — a retune must update `STAT_INFO_V142`.

## Docs

| doc | for |
|---|---|
| `docs/ANCHORS.md` | every system: banner, file, hooks, check — grouped by subsystem |
| `docs/AGENT-WORKFLOW.md` | the fast path for a request, parallel workers (worktrees, ports), writing a check |
| `docs/ARCHITECTURE.md` | how the engines, the render path and the screens work |
| `docs/LAYOUT.md` / `docs/NAMES.md` | the `src/` split / the old → new name map |
| `docs/CHECKS.md` / `scripts/README.md` | the runner, suites, baseline / the catalogue of checks and utilities |
| `docs/CHANGELOG.md` | the history, newest first (the README's old "Recent changes") |
| `docs/AUDIT.md` | the engineering audit: wrapper stacks, dead code, risks, roadmap |
| `docs/MONETIZATION.md` / `docs/APP-STORE.md` / `docs/COMMERCIAL.md` | the store module / shipping to the stores / the plan |
| `docs/PRESTIGE-VAULT.md` / `docs/LEADERBOARDS.md` / `docs/SEASONS.md` | the vault's physics and money / the online boards / seasons, the Career Pass, the career boards |
