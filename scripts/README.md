# Dev scripts

Headless Playwright helpers. All of them drive the running dev server —
start `npm run dev` first, then `node scripts/<name>.mjs` from the repo root.
Chromium is launched from `/opt/pw-browsers/chromium` (pre-installed; no
`playwright install` needed). Every check prints JSON plus a `page errors`
line — treat any page error as a failure even if the numbers look right.

`movementcheck.mjs` and `equaltalentcheck.mjs` are the exceptions. The movement
check loads the pure choreography/FieldSim block directly in Node and can compare
an older revision with `node scripts/movementcheck.mjs --git-ref=<commit>`.
The equal-talent check launches Chromium but injects the real engine directly,
so it does not need a dev server; set `CHROME_PATH` when Chromium is elsewhere.

## Checks (assert game behavior)

| Script | What it verifies |
|---|---|
| `creditcheck.mjs` | **Tackle-credit truth.** Sims 60 games as an LB, wraps `__FieldSim.run/pass` to record who the sim actually named tackler/assist, and asserts the credited tackle stat never exceeds sim-truth + sacks. Exits non-zero on violation. |
| `statcreditcheck.mjs` | Box score may only credit plays the user's roster actor actually made or was in the pile for (all stats, several positions). |
| `tacklecheck.mjs` | Solo/gang tackle split (~70/30 target) and whiff / truck / stiff-arm / stagger / big-hit rates across ~3,000 run plays. |
| `jukecheck.mjs` | Stat gaps drive evasion: one-on-one juke probability across superstar/scrub matchups. |
| `simcheck.mjs` | Batch-runs the emergent game engine (`window.__simGameV2`) — score, pace, and yardage distributions. |
| `equaltalentcheck.mjs` | Loads the real full-game engine with exact mirrored rosters and asserts fair wins, realistic scoring, YPC, completion/YPA, interceptions, sacks, and blowout frequency. Runs without a dev server. |
| `realismprobe.mjs` | The v30 realism dashboard over 60 full games: yards-per-carry + run-distance histogram, sacks/scrambles, punts vs FG attempts, penalty counts BY TYPE (holding/DPI/face-mask are flag-on-the-play), and average scores. Run after any tuning that touches the run game, kicking decisions, or penalties. |
| `movementcheck.mjs` | Ten seeded 120-play batches (1,200 plays total): exact sideline spots, no out-of-field frames, first-frame offensive TD/pick-six crossings, route-break reactions, directional cuts/bad angles, low/mid/elite acceleration curves, and run/pass/YAC stability. Pure Node; no server required. |
| `renderpathcheck.mjs` | Fraction of plays rendering from the FieldSim agent log vs falling back to the legacy choreographer (healthy: ~87–90%). Run when sim changes don't show on screen. |
| `growthcheck.mjs` | v42 Growth Decisions entertainment probe: Monte-Carlos the outcome generator (mix, magnitudes, durations, permanents, story variety) via `window.__GROWTH_V42.simulate`. |
| `injurycheck.mjs` | Serious injuries force DNP weeks, heal on schedule, clear the worn flag. |
| `menu-integration-check.mjs` | Redesigned main menu on the real `index.html`: generated art applied (blob URLs), routes out via GOALS/HALL and returns to an identical menu, no page errors or failed requests. `MENU_INTEGRATION_URL` overrides the target. |
| `emblemcheck.mjs` | v44 team emblems: every generated team nickname resolves to the right emblem (Wolves → wolf), every emblem's matched palette index exists, the packed sheet loads, and a driven live game shows emblem chips in the scoreboard plus the home crest composited into the field art. |

## Utilities (look at the game)

| Script | What it does |
|---|---|
| `shot.mjs` | Boot headless and screenshot: `node scripts/shot.mjs [out.png] [url]` (also `npm run shot`). |
| `walk.mjs` | Click through screens by button text: `node scripts/walk.mjs "START NEW CAREER" "ARCH" …`, screenshotting each step. |
| `explore.mjs` | Dump visible buttons/text of the current screen — find the exact labels `walk.mjs`/checks should click. |
| `live.mjs` | Boot into a live game and capture frames of the broadcast view. |
| `scroll.mjs` | Phone-viewport scroll-through screenshots (layout/overflow checks). |
| `crop.mjs` | High-DPI cropped screenshots of a screen region. |
| `menu-preview-shot.mjs` | Screenshot + layout metrics of the standalone `menu-preview.html` (`?menuPreview=1` sample data). |
| `bake-menu-into-index.mjs` | Rewrites the `RIB_DIRECT_MENU_*` marker blocks in `index.html` to reference the versioned menu CSS/JS in `public/`. |
| `assemble-pages.mjs` | Builds the exact GitHub Pages site into `_site/` (root index + `public/` + generated menu sheets) and verifies the baked menu references. |
| `spritekit/pack_logos.mjs` | Rebuilds `public/rib_logos_v44.png` from the three `art/football-logo-sheet-*.png` masters (90 emblems, 10×9 grid of 128px cells, index order = sheet order). Re-run only if the master sheets change. |

## Writing a new check

Copy the shape of `tacklecheck.mjs` / `creditcheck.mjs`:

1. `addInitScript` kills the tutorial/onboard overlay.
2. Click through career creation by button text (see `explore.mjs` for labels).
3. In `page.evaluate`, drive the exposed hooks — `window.__simGameV2(perf, pos)`
   for full games, `window.__FieldSim` (wrap `.run`/`.pass` to observe every
   resolved play), `window.RIB_TUNE` to pin tunables.
4. Print a JSON summary, report `page errors`, exit non-zero on failure.
