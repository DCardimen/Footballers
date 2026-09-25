# GRIDIRON / "Running It Back" — engineering audit

Snapshot audited: `claude/camera-follow-player-90d8o0` @ `adfd250` (v148), `index.html` = 9,881,076 bytes,
26,637 lines, 35 `<script>` blocks, 22 `<style>` blocks. All measurements were taken on a frozen copy
(`/tmp/claude-0/audit/index.snapshot.html`, served on :5199) so the concurrent restructuring could not move
the ground. Browser numbers are headless Chromium with **no GPU** on a shared 4-core box that other agents
were also using — treat absolute frame times as pessimistic and use them for *relative* comparisons.

Effort: **S** < half a day, **M** 1–3 days, **L** a week+. Risk = chance of breaking gameplay.

---

## 0. The ten things that matter most

| # | Finding | Evidence | Fix | Effort / Risk | Value |
|---|---|---|---|---|---|
| 1 | **62% of `index.html` is base64 that is ALSO shipped in `public/`** and the inlined copy always wins | 13 data URLs = 6,101,891 bytes (4.6 MB gzipped — base64 barely compresses). `v22.src = window.__RIB_ATLAS_V22 \|\| window.__RIB_ASSET("rib_atlas_v22.png")` (same pattern for crowd/refs/side/plan/skill/wheel/logos). The PNGs in `public/` (4.5 MB) are never fetched | Delete the `window.__RIB_*` data-URL assignments (one line each, blk 5 ~line 6445–6454), keep the `__RIB_ASSET()` fallback that already exists | **S / low** | index.html 9.9 MB → ~3.8 MB; every grep/diff/LLM read of the file stops drowning in base64; parse time −30–40%; repo growth per commit drops sharply |
| 2 | **The render function `q` has 11 layers** (base + 10 monkey-patch wrappers), `tt` 6, `et` 5, `kt` 5, `He` 4, and `wt` was *replaced wholesale* three times (two earlier versions are dead) | §1.1 | Collapse each wrapper chain into one function with named hooks (`onRender`, `afterSeason`, …) | **M / med** | The #1 source of "my change didn't show up" and order bugs |
| 3 | **Player name → stored XSS** (self-XSS today, real XSS the day names are shared) | Name set with `oninput="setPlayerNameV96(this.value)"`, stored raw (`.slice(0,24)` only); only 2 templates use `${S(e.name)}` while 46 interpolate `${e.name}`/`${t.name}`/`${a.name}` raw (not all of those are the player, but the hub is). Probe: name `<img src onerror=__x=1>` → `window.__x === 1` on the hub | Escape at input (strip `<>&"'`) **and** route every name through `S()` | **S / low** | Blocks leaderboard/cloud/share-card features and store review risk |
| 4 | **Four state accessors, one of them undefined** | `o` (closure), `window.S` (getter), `window.__GRIDIRON_AUDIT__.getState()`, `window.__getGridironState()`; `window.o` is `undefined` at runtime but is referenced by 6 in-game blocks and **84 check scripts**. The v42 Settings growth dials write `window.o.settings…` in `onchange` → **TypeError, never saved** (verified: `Cannot read properties of undefined (reading 'settings')`) | One `window.GAME = { state(), save(), render(), go() }`; alias `window.o` as a getter until scripts migrate | **S / low** | Fixes a live bug; removes a class of silently-dead probes |
| 5 | **The live field forces Phaser's CANVAS renderer** and creates **2,601–2,639 canvases / ~1,636 textures** (~20–26 megapixels of canvas backing store ≈ 80–105 MB) including one **1200×2800** warp canvas | `new mt.Game({ type: mt.CANVAS, … })` (bridge `mount()`); probe counts via `document.createElement` hook; stable across 3 games (no per-game leak) | Try `mt.AUTO`/WEBGL behind a TU switch; atlas the 40-palette recolours instead of one canvas per sprite×palette; halve the warp canvas | **M–L / med** | Mobile memory (iOS WebView kills tabs ~300–400 MB), battery, 4× frame time |
| 6 | **The menu costs ~250 ms a frame at tablet width without a GPU** | rAF on the career menu: 400×860 → 28 fps, 900×1100 → **5.5 fps**; disabling CSS animations/transitions → 12.5, disabling filters/box-shadows → **50 fps**. 22 `filter:` (18 `drop-shadow`) and 23 infinite animations in `rib-menu-v89.css` | Pre-bake drop-shadows into the webp art; pause infinite animations when idle / off-screen; honour `prefers-reduced-motion` already wired | **S–M / low** | Root cause of 2 of the 3 `menufxcheck` failures; battery on low-end Android |
| 7 | **14 permanent polling loops + 11 `MutationObserver`s on `document.body` (subtree)** that re-decorate screens after every render | §2.4 table | Replace with a single post-render hook on the (flattened) `render()` | **M / med** | CPU/battery; removes the "inject after render" pattern that makes screens nondeterministic |
| 8 | **CLAUDE.md is ~13.8k words (~20k tokens) loaded into every agent turn**; 75 version bullets, many a paragraph long | `wc`: 938 lines; anchors section lines 11–808 | Rewrite to ≤150 lines + a generated `docs/INDEX.md`; move per-version detail to `docs/features/` | **S / none** | Every LLM session starts ~20k tokens lighter and reads what it needs |
| 9 | **Saves are unversioned in practice and trivially editable** | `migrate()` in `GridironStorage` only stamps `schemaVersion`; migrations are ~100 scattered `x==null&&(x=default)` guards (`la`, `at`, `ve`, `gt`, `ii`…); import (`Pr`) accepts any base64 JSON with a `prestige` key and skips the boot migrations; `window.RIB_TUNE.prestigeGainMult = 1e6` from the console works | Real `schemaVersion` + ordered migration list; checksum + "modified save" flag; never make paid entitlements depend on the save | **M / low** | Monetization and support prerequisites |
| 10 | **~460 silently swallowed exceptions** | `catch(e){}` / `catch{}` / `catch(_){}` ≈ 452 in index.html; no remote error reporting at all | A `report(e, where)` helper that at least counts + ring-buffers errors (exposed on the audit hook, shipped to Sentry-like later) | **S / low** | Bugs like #4 become visible |

---

## 1. LLM-maintainability

### 1.1 Wrapper stacks (monkey-patch layers), in source order

Pattern: `const X=f; f=function(){ …X(…)… }` inside the career-app IIFE (block 7, `(function(){"use strict"; class Po…`).
Counted with `/tmp/claude-0/audit/wrap.py` + a `f=function` reassignment scan; line numbers are *block 7* lines of the snapshot.

**`q` — the view renderer (`window.render`) — base + 10 wrappers = 11 layers**

| # | alias | block-7 line | what the layer does |
|---|---|---|---|
| 0 | `function q()` | — | view → screen dispatcher (`if(e==="hub")return Er()…`, 27 views) |
| 1 | `Ql` | 4552 (v67/v95 region) | `ve(); Ql(); Aa()` — ensure experience95, then hub decorations |
| 2 | `kc` | 4932 (v11 world) | `la(e)`, inject `.world-card` on hub |
| 3 | `Mc` | 4938 (v103) | inject `.weekly-loop-card` on hub/season |
| 4 | `Cc` | 4938 (v103) | inject `.live-loop-strip` on live |
| 5 | `ld` | 5027 | `Re(o.player); ld(); rd()` |
| 6 | `_qV136` | 5043 (v136 B) | append coach-summary row |
| 7 | `Ad` | 5274 (v12 life) | `ks(); if(view==="life"){St();return} Ad(); Ed()` |
| 8 | `_qV146` | 5277 (v146 E) | `shellPreV146(); try{_qV146()}finally{shellPostV146()}` |
| 9 | `q0V146B` | 5410 (v146 B) | redirect a cut-out player to `gameover` / `club` |
| 10 | `q0V147` | 5517 (v147 A) | `migrateOffersV147`, auto-answer story/life queues at level ≥7 |

Everything in 2–7 is "render, then find a node with `querySelector` and `insertAdjacentHTML` next to it" — there are **105 `insertAdjacentHTML`** calls in the app. Order is decided by *where in the file the wrapper sits*, not by intent.

**Other stacks** (base + wrappers):

| fn | meaning | layers | aliases (line) |
|---|---|---|---|
| `tt` | season roll (`simSeason`, 10.2 KB base) | 6 | `ic` 4552, `uc` 4581 (age cut `dc`), `Hc` 4965 (pro contract), `ad` 5017 (potential ceiling), `tt0V146B` 5399 (cut strike) |
| `et` | per-game performance roll | 5 | `ac` 4552 (tree perf), `cc` 4558 (age), `_pfxEt` 4905 (persona), `wc` 4932 (temp-effect injuries) |
| `kt` | new player | 5 | `nc` 4552, `Ac` 4938 (origins), `cd` 5266 (v12), `kt146C` 5546 (trust) |
| `He` | after-week pulse (`processWeek95`) | 4 | `uo` 4932, `Sc` 4938, `Rd` 5274 (finance) |
| `lt` | play week (`window.playWeek`) | 3 | `Jl` 4552, `xc` 4938 |
| `wt` | sim remaining weeks | base + `Zl` wrap (4552) → **replaced** by a stub (v11, 4932: "Play games individually") → **replaced** by a full v90 loop (5017) → **replaced** by a near-identical copy with a `offersV146B` break (5274) → wrapped by `wt0V147` (5513). The base, `Zl` and the first two replacements are dead code, and the two live copies are copy-paste duplicates |
| `fs`, `Ea`, `Aa`, `na`, `Yt`, `G`, `Se` | season finish, live-game finish, hub decor, advance level, start week, tree fx, path fx | 3 each (`fs`: `fsV122`, `ec`; `Ea`: `Xl`, `origEa` in the v13 post-game block; `na`: `hc`, `na0V146B`; `G`: `Lc` → `ai` cap) |

Not wrapped (the brief asked): `go` (= `te`, `window.go=te`), `Yr` (`window.__simGameV2`, one 85 KB function), `buildPlayScript` (wrapped once, by `contactV146`); there is no `fireEvent`.

**Fix (M):** for each stack, write the flattened function once with explicit, named phases
(`render(view){ pre(); SCREENS[view](); decorate[view]?.(); post() }`), keep the old names as
aliases, and delete the `const X=f; f=function` lines. Do `q` and `wt` first (they have the worst
ordering/deadness). Guard with `bootviewcheck`, `walk`, `v146Echeck`, `v147Acheck`.

### 1.2 Churn: what recent work actually touches

`git log -p --since="30 days ago" -- index.html` (128 non-merge commits): **46,330 lines inserted vs 1,386 deleted** —
the file only grows; features are appended and wrapped, almost never edited in place.
249 changed lines were longer than 5,000 characters (a one-character edit inside them is a whole-line diff/conflict).

Changed-line hits (comments and strings stripped): `TU(` 2,345 · `o.` 1,008 · `f(` 576 · `A[` 413 ·
`x("` 286 · `I()` 233 · `M("` 186 · `F(` 171 · `S(` 151 · `G("` 127 · `q()` 122.
Among 2–3-letter career-app globals: `ae` 198, `et` 168, `ee` 137, `Se` 116, `Ee` 112, `pt` 108, `ms` 108,
`Ne` 91, `Le` 90, `tt` 80, `Oe` 78, `Ze` 78, `ht` 77, `ot` 74, `Ie` 69, `mn` 68, `He` 65, `lt` 64, `wt` 64
(some short names collide with FieldSim/renderer locals, so treat the long tail as indicative).

### 1.3 De-minification: the 50 names that would pay back most

Ranked by references inside the career-app IIFE (rolldown AST, `top.json`; ref counts are scope-naive).
"Audit key" is the name `window.__GRIDIRON_AUDIT__` already exports for it — strong evidence of intent.

| # | now | proposed | refs | evidence |
|---|---|---|---|---|
| 1 | `o` | `state` | 1061 | `let o=null`; `Zs()` builds `{prestige,pp,tree,…,player,view}`; audit `getState:()=>o` |
| 2 | `f` | `clamp99` | 432 | `f=(e,t=1,a=99)=>Math.max(t,Math.min(a,e))` |
| 3 | `L` | `clamp` | 249 | `L=(e,t,a)=>Math.max(t,Math.min(a,e))` |
| 4 | `x` | `byId` | 233 | `x=e=>document.getElementById(e)` |
| 5 | `S` | `escHtml` | 189 | replaces `& < > " '` |
| 6 | `M` | `nodeLvl` | 167 | `o.tree[e]\|\|0`; audit `nodeLvl:M` |
| 7 | `F` | `toast` | 147 | writes `#toast`, 1.9 s |
| 8 | `W` | `pick` | 116 | `W=e=>e[Math.floor(Math.random()*e.length)]` |
| 9 | `I` | `saveGame` | 113 | `GridironStorage.save(o)` / `localStorage.setItem(tn,…)` |
| 10 | `A` | `LEVELS` | 112 | `[{key:"peewee",name:"Pee Wee",…}]`; audit `LEVELS:A` |
| 11 | `E` | `choiceDef` | 100 | `E=(id,label,description,risk,baseChance,success,failure)=>({…})` |
| 12 | `z` | `fmtMoney` | 79 | `$…K/$…M` |
| 13 | `Le` | `ATTR_INFO` | 72 | `{speed:{name:"Speed",metric:{…}}…}` |
| 14 | `q` | `render` | 71 | view dispatcher; `window.render=q` |
| 15 | `G` | `treeFx` | 68 | sums `ot[a].fx[e]*o.tree[a]`; audit `treeFx:G` |
| 16 | `D` | `randRange` | 67 | `D=(e,t)=>e+Math.random()*(t-e)` |
| 17 | `ae` | `playerOvr` | 52 | `en(e.attrs,e.pos,e.body)`; audit `playerOVR:ae` |
| 18 | `ee` | `ATTR_KEYS` | 51 | `Object.keys(Le)`; audit `ATTRS:ee` |
| 19 | `Ee` | `POSITIONS` | 50 | `{QB:{name:"Quarterback",w:{…}}}`; audit `POSITIONS:Ee` |
| 20 | `Z` | `liveCtl` | 44 | `{idx,speed,playing,anim,t}` — the live playback controller |
| 21 | `we` | `attrCap` | 40 | `qo+G("capPlus")+Ie()*3` |
| 22 | `te` | `goView` | 40 | `o.view=e,I(),q()`; `window.go=te` |
| 23 | `re` | `lifeV12` | 34 | builds/returns `e.lifeV12` (pro-life finances) |
| 24 | `le` | `randInt` | 34 | `Math.floor(D(e,t+1))` |
| 25 | `Ne` | `POS_STATS` | 29 | per-position stat lines with `per[level]` baselines |
| 26 | `ks` | `ensureV12` | 29 | audit `ensureV12:ks` |
| 27 | `pt` | `PROGRAMS` | 28 | training programs; audit `TRAINING:pt` |
| 28 | `ot` | `TREE_NODES` | 27 | audit `TREE_NODES:ot` |
| 29 | `dt` | `TRAITS` | 27 | `{xfactor:{…},lateBloomer:{…}}` |
| 30 | `us` | `seasonGoals` | 27 | returns `[{id:"grade",desc:"Post a season grade of 62+",pp…}]` — **the audit API calls it `genContracts`, which is wrong** |
| 31 | `ye` | `momentBanner` | 26 | `#momentBanner` + `#cinemaFlash` |
| 32 | `fe` | `seededRng` | 25 | `new Po(Co(keys.join("\|")))` |
| 33 | `mn` | `ageProfile` | 25 | `{key:"child",name:"YOUTH DEVELOPMENT",perf,inj,…}` |
| 34 | `Se` | `pathVal` | 21 | persona/path value; audit `pathVal:Se` |
| 35 | `Oe` | `hasTrait` | 21 | audit `hasTrait:Oe` |
| 36 | `lt` | `playWeek` | 20 | `window.playWeek=lt` |
| 37 | `rt` | `scoutOpponent` | 19 | seeded opponent profile (`Lo`/`ja` strengths/weaknesses) |
| 38 | `ve` | `hypeState` | 19 | ensures `o.experience95={coach,hype,streak,…}` |
| 39 | `sa` | `TREE` | 18 | prestige branches; audit `TREE:sa` |
| 40 | `Xe` | `teamName` | 18 | level-shaped club name (v123) |
| 41 | `Re` | `ensureV11` | 18 | audit `ensureV11:Re` |
| 42 | `Je` | `originOf` | 17 | `It.find(t=>t.id===e.originV11)` |
| 43 | `Ie` | `chaosTotal` | 16 | sums `o.chaos` |
| 44 | `et` | `rollGamePerf` | 16 | the per-game perf roll (5 layers) |
| 45 | `tt` | `simSeason` | 16 | audit `simSeason:tt` |
| 46 | `He` | `afterWeek` | 15 | audit `processWeek95:He` |
| 47 | `kt` | `newPlayer` | 11 | audit `newPlayer:kt` |
| 48 | `ms` / `no` | `screenCut` / `screenWin` | 12 / 3 | audit `screenGameOver`, `screenWin` — **these renderers also pay out PP, drop gear and write the lineage** |
| 49 | `wt` | `simRestOfSeason` | 13 | `window.simRemainingWeeks=wt` |
| 50 | `Zs` / `mc` / `dr` / `tn` | `freshState` / `boot` / `loadSave` / `SAVE_KEY` | 4–7 | audit `freshState:Zs`; `tn="gridiron_save_v1"` |

Also worth naming in the same pass: `Er` screenHub, `sl` screenSeason, `Al` screenResult (11 KB), `jr`
screenTraining, `Lr` screenChoosePos, `Fi` screenSettings, `ps` screenPrestige, `ts` screenLocker, `St`
screenLife, `Mn` screenMenuLegacy, `ml` setLiveSpeed, `hl` startLivePlayback, `Ia` liveTick, `to` endLive,
`ln` dropGear, `Kr` rollGear, `ba` RARITIES, `on` GEAR_SLOTS, `Ze` gearFx, `Yl` buyNode, `At` nodeCost,
`Xa` nodeUnlocked, `Pr` importSave, `Cr` eraseSave, `es` completeChallenges, `zt` CHALLENGES, `Vi`
grantMilestone, `sn` nationalRank, `ca` resolveWeek, `ls` buildSchedule, `La` startSeasonGames, `na`
advanceLevel, `qt` advanceChance, `Bt`/`ss` maxSeasons/minSeasons, `Nt` STORY_ARCS, `Za` SEASON_EVENTS,
`yt` GAME_PLANS, `cs` SEASON_MODS, `It` ORIGINS, `mt` PATHS, `Ga` TOWNS, `er` MASCOTS.

**How to do it safely (M):** the career app parses cleanly with `rolldown/parseAst` (already in
`node_modules`). Write `scripts/rename.mjs` that renames *top-level bindings of the block-7 IIFE* by AST
(scope-aware — `o`, `e`, `t` are also locals everywhere, so no regex), and rewrites the same identifiers
inside `onclick="…"` template strings (105 distinct global handlers) from an explicit allow-list. Keep a
`window.X` alias for every name a check or `public/*.js` reads. Do it in one commit with no other changes,
then run the full check list. Expected payback: every future prompt stops paying the "what is `He`?" tax.

### 1.4 Dead and retired code

| What | Evidence | Size | Action |
|---|---|---|---|
| Inlined images that are never the fallback | §0 #1 | 6.1 MB | delete |
| `Kn()` | `function Kn(e,t,a){return null; …` (the rest is unreachable) | 1.2 KB | delete |
| Earlier `wt` implementations and the `Zl` wrapper | §1.1 | ~3 KB | delete |
| 39 `window.*` globals **read by nothing** (game, public, or checks) | e.g. `__GRIDIRON_SIMULATE_V153/V156/V157/V158`, `__GRIDIRON_V14__`, `__GRIDIRON_POSTGAME_V13__`, `__NtV18`, `__ZaV18`, `__gameOddsV20`, `quickSimSeason`, `screenHof`, `screenLocker`, `screenDynasty`, `watchLive`, `breakthroughTakeover104`, `onblur`/`onfocus` | — | delete (list in `unused` output of the probe) |
| 38 more globals read **only by check scripts** | — | — | move under one `window.__DEV` namespace |
| ~100 version kill-switches (`TU("xxxV1NN", 1)`) whose OFF path ships | 102 version-named 0/1 dials, e.g. `planWheelV146` (keeps the whole old plan wheel alive), `ppBankV136`, `v147C`, `contactV146`, `sackCloseV146`, `looseV109`, `gripV103` | large | retire any switch older than ~10 versions whose OFF path no check compares against (the sim-feel checks *do* use some OFF paths for A/B — keep those) |
| 1,482 distinct `TU` keys, 1,806 calls | most are read exactly once; defaults live at the call site | — | generate `TUNING.md`/`tuning.json` from source; lint for duplicates |
| **`TU` key collisions** — one key, two meanings | `pileRadiusPx` = 9 (FieldSim pile join) **and** 26 (renderer pile); `wearMax` = 24 (stamina gas cap, FieldSim) **and** 160 (turf-wear decal count, renderer); `measureHoldMs` 900 vs 1100 | — | rename one side of each (retuning one silently retunes the other) |
| Stale workflow | `.github/workflows/bake-main-menu-index.yml` runs on `agent/main-menu-direct-index-v3` and greps for `rib-menu-assets.css`, which no longer exists | — | delete |
| Root clutter | `ChatGPT Image Jul 14…png`, `Screenshot_…ChatGPT.jpg`, five `* pixel art.png`, `menu-preview*`, `reload.png` in the repo root | — | move to `art/` |

### 1.5 Duplicated logic

* The **PP multiplier** `(1+M("endorse")*.2+M("agent")*.15+M("brand")*.35+M("goat")*.5+G("ppMult")+Ze("ppMult")+gearV147("ppGain")+Ca()*.05+Zt("ring")*.03)*Us(e)*Se("ppMult",1)*(Oe(e,"showman")…` is written out twice, in `ms` and `no`. A 2× PP booster would have to be added to both → make it `ppMultiplier(player)`.
* The **sim-rest loop** (`wt`) exists as two near-identical copies (v90 and v146 B).
* **State accessors** re-implemented per block: `state()` (blk 10), `getState` (blk 11), `ST()` (blks 17, 18), `var S = window.S || window.o` (blk 24).
* **HTML escapers**: `S()` in the app plus 6 separate `esc` definitions across blocks/`public/*.js`; **clamp** helpers: `f`, `L` plus 12 `clamp`/`cl` definitions.
* **Block-index coupling in checks**: `equaltalentcheck`, `starimpactcheck`, `v141check` load `[0,1,2,3,4,7].map(i => scripts[i])` — any block insertion silently loads the wrong code (the current restructure will break them).
* **Check URL plumbing**: 120 scripts hard-code `localhost:5173`; the override is spelled `GAME_URL` (46), `URL` (10), `SPLASH_URL` (5), `MENU_INTEGRATION_URL`, `DECLARE_URL`, `SIDE_URL`, `MENU_URL`, `BASE_URL` — or not at all (v90, v92, v93, emblem). One `scripts/_env.mjs` would let every check run against any build.

### 1.6 Giant lines (merge-conflict magnets)

55 non-data lines are longer than 2,000 characters (1.29 MB total). Outside the Phaser bundle the worst are
career-app lines: line 15165 (30 KB, `function As…`), 19079 (27 KB, `flMinorV96`), 15229 (26 KB, `Ns`),
15201 (25 KB, begins with the dead `Kn`), 20045 (15 KB), 15419 (14 KB, the `sa` tree table), 20381 (12 KB).
Two CSS lines are 68 KB and 16 KB (lines 80 and 76). Any two agents touching the career app almost
certainly touch the same physical line. **Fix (S):** run `js-beautify` (already a devDependency) over
the career-app block and the two CSS lines in the same commit as the rename; keep Phaser untouched.

Also note line 21856: 16,856 characters of HTML-mangled Phaser source (`</h.length;e++)if(r.hasownproperty(h[e]))…`)
sitting **between `</script>` and `<style>`**. The browser parses it as end tags and it currently renders
nothing (probe: `document.body.innerHTML.includes('hasownproperty') === false`), but it is garbage
from a bad bake — delete it.

### 1.7 CLAUDE.md

Today: 938 lines, ~13.8k words, 75 version bullets (many 20–40 lines), a 105-row check table. It is
excellent institutional memory but it is loaded into *every* agent context and most of it is irrelevant
to any one task.

Proposed structure (≤150 lines):

1. **What this is** (5 lines) and the file map *after* the split (§6 wave 1).
2. **How state works**: one accessor, the save, the render pipeline, where hooks go.
3. **Rules** (the existing House rules + "never wrap, add a named hook", "names through `escHtml`",
   "no bare constants — `TU`", "no `window.x=` for render-time functions").
4. **How to find things**: `docs/INDEX.md` (generated from `/* ===== vNN … */` banners: anchor → file →
   one-line summary → hooks → checks), `rg -n "vNNN "`.
5. **How to verify**: `npm run check -- <area>` driven by `scripts/checks.json` (area → scripts), replacing the 105-row table.
6. Pointers: `docs/ARCHITECTURE.md` (2,803 lines — split per subsystem), `docs/features/vNNN-*.md` (the current bullets, moved verbatim).

Expected saving: ~18k tokens per session, and less "the doc says X" drift (e.g. CLAUDE.md still says the
file is "~6,500 lines"; it is 26,637).

---

## 2. Correctness risks and bugs

### 2.1 Confirmed bugs

| Bug | Evidence | Fix | Effort |
|---|---|---|---|
| Stored XSS via player name | §0 #3 (probe `probe/save.mjs`) | escape at input + `S()` everywhere; add a check that renders every screen with a hostile name | S |
| v42 growth dials in Settings throw and never save | `onchange="(window.o.settings=…)"`; `window.o` is undefined → `TypeError` (probe `probe/settings2.mjs`) | use `window.S` or a `setGrowthDial()` global | S |
| Declare stakes invisible at the moment of the declare | the only on-screen "One shot" is inside a `.hubv75-sec` with `display:none` (the report card's non-GRADE tab), and the result screen's dock (`DECLARE FOR YOUTH LEAGUE · 83%` …) carries no stakes line (`dockHas: false`) — probe `checks/declaredbg.mjs` | put the stakes on the declare button's label or in the GRADE tab | S |
| Uniform preview opens a pop-up | `window.open('','gridironUniformPreview','width=430,height=720')` | render in an in-app overlay (pop-ups are blocked or leave the app in a WebView) | S |
| Save import skips migrations | `Pr()` sets `o=t` and only defaults `o.tree`; `mc()`'s migrations (e.g. `evergreenRefundV146`, the v11 `shop→tree` map) run only at boot | route import through the same `migrate()` as load, then reload | S |
| Render functions with side effects | `ms()`/`no()` (views `gameover`/`win`) pay PP, drop gear (`ln(…,"Career-end drop")`), write the Hall of Fame and lineage — guarded only by `e._settled`. v140's whole story (boot-time render outrunning `window.x=` assignments) comes from this | move settlement into `endCareer()`; screens only read | M |

### 2.2 Save-data robustness

* **Size is fine:** fresh 4.2 KB; after a first live game 12.1 KB (+ 9.2 KB backup). Growth is capped (`o.hof` ≤ 60, `ppBankLogV136` ≤ 40, `autoDecisionsV147` ≤ 30, inventory ≤ 40). The 9.9 MB app does **not** live in localStorage, so quota is not the risk.
* **Every save does `structuredClone(state)` + `JSON.stringify` twice (backup copy) + two `setItem`s**, and `I()` is called from 113 sites (several per action). At 12–50 KB that is cheap on desktop but it is synchronous main-thread work on every tap; debounce to once per frame/turn.
* `GridironStorage.save` has **no try/catch**; `I()` catches and only `console.warn`s, so a quota/private-mode failure is invisible to the player. Surface it.
* **Backup = previous save**, written unconditionally before every save. If a bad state is saved twice (common — saves are frequent) the backup is bad too. Keep a rolling "last good at session start" copy instead.
* **Versioning**: `SCHEMA=1`, `migrate()` stamps it; `Ws()` bumps `schemaVersion` to `oi` and sets `featureFlagsV12`. Real migrations are lazy `x==null&&(x=…)` defaults spread over dozens of `ensure` functions (`la`, `at`, `ve`, `gt`, `Re`, `ks`, `ii`…). That works for additive fields but cannot express a rename or a unit change. **Fix (M):** `MIGRATIONS=[…]` keyed by version, run on load and on import, with a check that loads a fixture save from each past version (keep 5–6 fixtures in `scripts/fixtures/`).
* **Corrupt save**: a JSON parse failure falls back to the backup, then to a fresh state — good. A save that parses but renders badly is handled by `safeBootV140` (retry, then menu). Good; keep `bootviewcheck`.
* **Capacitor**: WebView localStorage can be evicted on iOS under storage pressure; use `@capacitor/preferences` or Filesystem for the canonical copy and keep localStorage as a cache (M).

### 2.3 Error handling at boot
Block 2 (`// error surfacing`) and the launcher (block 6) turn `window.error` into a toast (throttled 30 s, suppressed while the splash is up); `safeBootV140` guards the three boot renders. There is **no persistent error log and no remote reporting**, and ~452 empty `catch` blocks hide the rest. Add `window.__errors` (ring buffer, counted per site) and include it in the audit hook; wire Sentry (or a tiny `fetch` beacon) at store time.

### 2.4 Timers, observers, listeners

At the menu: 15 live intervals, 113 JS listeners, 1,818 DOM nodes (CDP). On the live field: 16 intervals, up to 1,218 listeners and ~94k nodes (CDP count, includes detached) after the first game, falling back to ~28–32k — heavy `innerHTML` churn. Canvases/textures/intervals do **not** grow across games (3 games: 2,601 canvases, 1,614–1,637 textures, 16 intervals) — no leak found there.

Permanent pollers (never cleared):

| where | period | job |
|---|---|---|
| blk 7 (school hook, v15.3) | 900 ms | watch `o.player.level` for the team-customisation prompt |
| blk 14 personality sliders | 400 ms | `maybeShow()` |
| blk 16 story wheel | 500 ms | `scan()` |
| blk 17 v51 pregame wheel | 400 ms | `sweep` |
| blk 18 v42 growth (×2) | ? | in-season decisions; settings/chips injection ("polled injection, same pattern as other late blocks") |
| blk 22 v75 sectioner | 300 ms | `sweep` |
| blk 23 v139 dock | 400 ms | `sync` |
| blk 24 v139 nav | 400 ms | `tick` |
| blk 25 v146 E shell | 500 / 700 / 5000 ms | `hook`, `sync`, ticker |
| `rib-menu-boot.js` | 650 ms | `sync` |
| `rib-menu.js` | 900 ms | `syncMenu` |
| `rib-menu-coach.js` | 500 ms | `scan` |

Plus 17 `MutationObserver`s, 11 of them on `document.body` with `subtree:true`. Together they are the
"decorate after render" architecture: each late block watches the DOM and patches what `q()` drew. On
the live screen the commentary and box score mutate every play, waking every observer. **Fix (M):** one
`afterRender(view)` event from the flattened `render()`; blocks subscribe instead of polling.

### 2.5 Mobile hazards

* Canvas memory (§0 #5): 1200×2800 warp canvas (13.4 MB alone) + ~2,600 canvases for the recolour engine.
* JS heap 33 MB at the menu, 104–137 MB during a live game (headless).
* `navigator.vibrate` (4 call sites) does nothing on iOS — use `@capacitor/haptics`.
* `confirm()` ×6 and `prompt()` ×3 (backup code, erase) — work in Capacitor but look like web dialogs; replace with in-game modals.
* The splash film: `muted playsinline` is correct; the `<link rel=preload as=video>` and `<link rel=preload>` tags have no `href` (dead).

### 2.6 The pre-existing failing checks — root causes

Run against the frozen snapshot (`/tmp/claude-0/audit/checks/log_*.txt`, `solo_*.txt`).

| Check / assertion | Result here | Root cause | Who is wrong | Fix |
|---|---|---|---|---|
| `declarecheck` "declare card states the one-shot stakes" | FAIL | Stakes text exists but is in a hidden report-card tab (`hubv75-sec` `display:none`); the result dock has no warning line | **Game** (UX regression) | show the stakes next to the button (label or dock `.small`) |
| `declarecheck` "epitaph fits … 2.15 screens" | FAIL (2.15) | v146 E made `#screen` the one scrolling panel between a fixed top bar and a fixed bottom stack, so the same content is 2.15× the (smaller) panel; `declineResult` got no v75 sectioner config (only `hub/result/season/settings/shop` have one) | **Game** (unsectioned long view) — or the budget is stale | add a `declineResult` sectioner config (EPITAPH / TOTALS / LOG), keep the 1.35 budget |
| `v90check` "OVR ring fills ovr/250" | FAIL (`ovr=26 arc=0.650`) | since v134/v147 B the ring fills to the soft max (`ringArcV147B(ring, ovr, softMax)`: 26/40 = .65) | **Check** (stale) | assert against `window.__V147B.ringArc(null, ovr, softMax).k` |
| `v141check` "DFL RB 250 vs 350 speed/grit ≥ 3" | FAIL (64→66.7, 64.5→67.4) | deterministic but single-game (`CELLS=1`); passes at v141, v146 B and v146 D, first fails after the v146 merge train (v146 A's extra random draws in the sack/contact path) — a sample-path shift, exactly what CLAUDE.md warns about for v143/v146 A | **Check** (single seed) | default `CELLS=4` — verified: passes 79/79 at HEAD |
| `sidelinecheck` "far end dimmer air" | FAIL (`570 < 646` — the averages are right) | the assertion also needs `nNear > 4` sprites with `y > 900` px; absolute pixel rows no longer match the v144/v148 layout (probe: 144 sprites with y<700, only 11 with y>900 in a different framing; in the check's framing ≤4) | **Check** (hard-coded pixel rows) | split far/near by `vv < midy` (as the facing check already does) |
| `sidelinecheck` "reaction dies back down" | FAIL (1 → 0.95 / 0.86) | decay is time-based (`0.5^(dt/1.3s)`), but Phaser's `TimeStep` replaces frames > ~200 ms with one nominal step, so game time runs slower than the 1.2 s wall-clock wait when the CANVAS renderer drops below ~5 fps (headless, no GPU) | **Check** (wall-clock wait) + a perf smell | wait on scene time (`sc.time.now`) or step `updateSide` with a synthetic delta |
| `menufxcheck` "eight tiles" | FAIL (9 tiles) | v139 added a ninth tile | **Check** (stale) | expect 9 (or read the count from the menu's own tile list) |
| `menufxcheck` "ember loop is running" / "OVR spark at the head of the arc" | FAIL (4→6 frames; `arc 0`) | the menu renders at 4–5 fps at the check's 900×1100 viewport (§0 #6), so the ember counter barely moves and the ring's `--rib-ovr` transition (1.1 s) has not started when sampled (the inline value is right: `0.333…`) | **Both** — check is timing-sensitive, the menu is genuinely expensive | cut animated filters/shadows; make the check wait for `transitionend` and assert on frames per *wall second* ≥ a low bar |
| `emblemcheck` "pregame emblem chips 0×0" | FAIL | the chips exist and are sprite-backed but live on a v112 D wizard page that is not shown (`display:none` → 0×0) | **Check** (stale since the wizard) | advance to the page with `.pregame-team-v1513` (or use `__V112_D` to jump) before measuring |
| `v93check` far-end TOUCHDOWN lettering | PASS here (11/11) | intermittent — depends on the home/away fixture and light/weather roll | **Check** (nondeterministic) | pin `__WX_V79` and `homeWeekV93` in the check |
| `v92check` "whistle replay still" | not reproduced; one other assertion failed: "feed camera only renders while the far end is in frame" `on=44 inFrame=43` | the renderer gates the feed camera one frame behind the check's own rect test | **Check** tolerance (or gate on the same frame) | allow a 1-sample lag, or compute visibility after the camera update |
| `vaultcheck` "reload mid-pour" | PASS here (96/96) | timing-dependent (reload during an animation) | **Check** (flaky) | wait for the pour's own `done` flag rather than a timeout |

Confirmation for `v141check`: the same HEAD snapshot with `CELLS=4` passes **79/79** (RB speed 56.2 → 67.9, grit 59.1 → 67.7; `bis_head_cells4.txt`). Bisect with `CELLS=1`: pass at `f2233ff` (v141), `441ee38` (v146 B), `5ccb8b0` (v146 D); fail at `3eb8e6d`/`b0bb01e` (after the v146 merge train). Make `CELLS=4` the default.

---

## 3. Monetization readiness

### 3.1 Where entitlements plug in (existing seams)

| Offer | Seam today | Notes |
|---|---|---|
| **Play speed ladder** (1–2× free, 3× earned, 4× paid) | the live speed row is one template in the live screen: `[["0.5","½×"],["1","1×"],["2","2×"],["4","4×"]].map(… onclick="setSpeed(r)")`; `setSpeed` = `ml(e){Z.speed=e…}`; default `Z.speed = ut("fastSim") ? 2 : 1` in `hl()`; the camera reads speed through `camRateV147()` | add `3`, and gate in `ml()` with `ent.has("speed4")`; keep 4× reachable for the sim checks via `TU`. v147 D's paired-replay camera work means 3× needs a `v147Dcheck` row |
| **2× PP** booster | PP is minted in few places: `bankPPV136(n, why)` (milestones `Vi`, challenges `es`, per-season), the two settles in `ms()`/`no()` (`o.pp+=r` after `flushBankV136()`), the respec refund and the Evergreen refund | multiply in *one* `ppMultiplier()` (see §1.5) and in `bankPPV136`; record `why:"boost"` in `ppBankLogV136` so the vault can show it |
| **"See only my plays" / skip opponent drives** | already a **free** Settings toggle (`onlyInvolved`, `skipOpp`, `fastSim` in `Fi()`) | gating a feature players already have reads as a take-away — gate only *new* depth (e.g. "only my plays + auto-advance", or an instant "sim to my next snap") |
| **Prestige tree** | `sa` (branches) / `ot` (nodes) / `At` (cost) / `Xa` (unlock rules incl. HONORS) / `Yl` (the one purchase, also `window.buy`, used atomically by the Vault) | a Pro unlock can add a *branch* or cosmetic nodes; never sell PP directly for tree power (pay-to-win in a game with leaderboards) |
| **Gear drops** | `ln(e,"Career-end drop")` → `Kr(e)` rarity roll off `ba` weights (Common 52 / Rare 30 / Epic 13 / Legendary / Mythic), v147 C modifier rolls | **do not sell rolls** — random paid items are loot boxes (odds disclosure on both stores; banned in Belgium, restricted NL). Sell deterministic cosmetics only |
| **Cosmetics** | team palettes/crests (Team Creator, `gridironTeamCustomV153`, 40 palettes in the recolour engine), `CAM_MODES_V112` (Broadcast/Tight/Wide/Fixed/Follow Me/Follow Ball), `WX_MODES_V144`, the Vault coin art, end-zone paint (`ribSyncEndZonesV93`) | these are clean entitlement targets: a list of ids + an `ent.has(id)` check at the picker |
| **Rewarded ad** (20 min of 4× or 2× PP) | none | needs a timer entitlement (`{id, until}`) persisted outside the save (see 3.3) |

### 3.2 A provider-agnostic `monetize` module

```js
// public/rib-monetize.js  (baked like the menu files; no game logic inside)
window.RIB_MONETIZE = {
  init({ provider, catalog }),             // provider: "none" | "web-stub" | "capacitor-revenuecat" | "capacitor-admob" …
  entitlements(),                          // → { pro:true, speed4:true, boost2x:{until:1727…}, cosmetics:{kitGold:true} }
  has(id), until(id),                      // sync, cached; never throws; false while loading
  onChange(fn),                            // re-render hooks (the flattened render() subscribes)
  showRewarded({ placement, reward }),     // → Promise<{granted:boolean, reward}> ; reward = {id:"boost2x", minutes:20}
  purchase(productId),                     // → Promise<{ok, entitlements, receipt?}>
  restore(),                               // → Promise<entitlements>   (required by Apple)
  receipts(),                              // opaque, for server validation later
  canShowAds(), consent(),                 // UMP/ATT state; kids/age gate
  debug: { grant(id, minutes), revoke(id) } // dev only, stripped in store builds
};
```

Rules: the game reads **only** `has()/until()`; entitlements are stored by the provider (RevenueCat /
StoreKit / Play Billing) and cached in a separate storage key, **never inside `gridiron_save_v1`** (a save
import or erase must not grant or lose purchases). A `web-stub` provider makes every check runnable
offline (`?ent=pro,speed4`).

### 3.3 Anti-tamper reality

Everything is client-side: the save is plain JSON in localStorage, importable via base64 (`Pr()` checks only for a `prestige` key), and `window.RIB_TUNE` retunes any of 1,482 dials from the console (e.g. `prestigeGainMult`). You cannot stop a determined player from editing *single-player* progress, and you should not try. Consequences:
* Paid entitlements must come from the store receipt, not the save (above).
* **Leaderboards can only be trusted where the server can replay**: the Daily Challenge already does this (`supabase/functions/verify-daily`, deterministic seed, `choices` replay). Career/PP boards cannot be verified — keep them "friends/personal" or label them unranked. Score Attack global boards rely on `submit_score()` range checks + rate limits only.
* Strip `DEV`, `__GRIDIRON_AUDIT__.setState`, `RIB_TUNE` writes and the 38 check-only globals from store builds, or gate them behind a dev flag — not for security, but so casual tampering is not a console one-liner.

### 3.4 Pay-to-win flags

* Selling 4× speed or "only my plays": convenience, fine.
* **2× PP** accelerates the prestige tree, whose nodes change on-field results (`G("perfFlat")`, `startAll`, `ppMult`, the v146 C Impossible branch up to 10M PP). With any competitive board, that is pay-to-win. Keep boosters away from anything ranked, or exclude boosted careers from boards.
* Gear modifiers (`gearV147`) change the sim; never sell gear or gear rolls.
* The owner's own `docs/COMMERCIAL.md` still says "Premium, one-time $2.99 (no ads, no IAP)" — update it before anyone implements a different plan from it.

### 3.5 Staged plan
1. **Stage 0 (S):** `RIB_MONETIZE` with the `none`/`web-stub` providers, `has()` wired into the speed row, the PP multiplier, the camera/weather pickers. Ship nothing paid.
2. **Stage 1 (M):** Pro unlock (one IAP, non-consumable) = 4× speed + cosmetic kits/camera modes + a "support the dev" badge; `restore()`; RevenueCat or native billing via Capacitor.
3. **Stage 2 (M):** Rewarded ads (AdMob via Capacitor, UMP consent, ATT on iOS) for a **timed** 3×/4× or 2× PP (unranked careers only). Frequency cap; no ads in the live play loop.
4. **Stage 3 (L):** optional membership only if there is server-side value (cloud save, seasonal cosmetics, verified daily boards).

---

## 4. App-store readiness

### 4.1 PWA
* `manifest.webmanifest`: name, `display: standalone`, `orientation: portrait`, icons 192/512 + maskable 512 + SVG — good. `id: "/Footballers/"` and `start_url: "../"` are GitHub-Pages-path specific.
* **No service worker** (`navigator.serviceWorker.controller` false; none registered) → no offline, no install prompt on Android Chrome. Add a Workbox-style SW that precaches `index.html` + the ~60 runtime files (M). With the data URLs removed (§0 #1) the precache is ~6–7 MB.
* No `beforeinstallprompt` handling; iOS relies on "Add to Home Screen".
* `freshV106` fetches `rib-build.json` past the cache and reloads once — keep for web, **disable in Capacitor** (the bundle cannot go stale).

### 4.2 Capacitor / TWA concerns
* `capacitor.config.json` exists (`appId com.runningitback.game`, `webDir _site`), but `@capacitor/*` is not installed and no `ios/`/`android/` projects exist.
* **Size**: `_site` = index.html (9.9 MB) + all of `public/` (13 MB, including the duplicated PNGs and both film encodes) → ~23 MB uncompressed before native overhead. After §0 #1 and dropping the unused PNG/film duplicates: ~12 MB.
* **Hardware back (Android)**: `popstate`/`hashchange` handlers exist in the menu files, but Capacitor needs `App.addListener('backButton', …)` mapped to the in-game back (`ys()`/dock back) — otherwise back exits the app.
* **Safe areas**: 35 `safe-area-inset` uses; `viewport-fit=cover`; `ios.contentInset: "always"` makes WKWebView inset the scroll view itself, which can stack with the CSS `env(safe-area-inset-*)` padding the shell already applies — verify on a notched device and prefer `"never"` + CSS.
* **Audio**: all sound is WebAudio synthesis (blips, vault) — needs a user gesture to resume the `AudioContext` in WKWebView; check the first tap resumes it.
* **External links / pop-ups**: the uniform-preview `window.open` (§2.1). No outbound `http` links found.
* **Orientation**: portrait in the manifest; also lock in `Info.plist` / `AndroidManifest.xml`.
* **Haptics**: `navigator.vibrate` → `@capacitor/haptics`.
* **Storage**: see §2.2 (Preferences/Filesystem for the canonical save; export/import already exists as a base64 code).
* **WebView perf**: CANVAS renderer + 2,600 canvases + the menu's animated filters are the risk on low-end Android WebView (§5).

### 4.3 Store policy risks
* **Trademarks**: player-facing strings are clean — "NFL" appears only in code identifiers/comments (`ELITE_NFL_V125`, `continueNFL`), "Lombardi" only in comments that say the trophy is *not* a Lombardi look-alike, "Madden" only in renderer comments. League is "UFF"; towns and 50 pro clubs are generated (`dflClubV123`); v123 moved from real cities to 120 invented towns (COMMERCIAL.md still says real cities). Mascot pool still includes words that are also NFL nicknames when paired with a city (Broncos, Eagles, Panthers, Vikings, Buccaneers) — the town list is invented so the pairs are not real teams; `namecheck.mjs` is the gate. Name generator includes "Brady" as a first name — fine alone; avoid generating famous full names (add a deny-list check).
* **Art provenance**: repo root has `ChatGPT Image …png` and `…ChatGPT.jpg`; COMMERCIAL.md says "all art produced by the owner". Keep a provenance note per asset; AI-assisted art is allowed on both stores, but ownership questions come up in disputes.
* **Loot-box-like mechanics**: gear rarity drops (`ba` weights) and many "wheels" (season commitment, story arc, plan, rivalry). Fine while nothing random is sold. If any paid currency ever buys a spin/reroll/gear, both stores require odds disclosure and some jurisdictions restrict it — avoid.
* **Gambling-adjacent language**: "SPIN THE WHEEL", "roll" — acceptable for a sports sim with no purchase attached; do not attach IAP to wheel screens.
* **Ads**: AdMob + UMP (EU consent) + ATT (iOS, only if using IDFA) + Families policy if the age rating targets kids (a football career from "Pee Wee" may attract under-13s → avoid personalised ads; consider an age gate).
* **Privacy**: today there is no analytics and no network use except optional leaderboards (Supabase) and the build-freshness fetch → "Data Not Collected" is truthful until ads/leaderboards go live; a privacy policy URL is required anyway. Leaderboard device id (`rib_lb_device`) and handle count as identifiers once enabled.
* **Age rating**: cartoon sports violence (big hits, "launch" physics, injuries) → IARC Everyone/E10+, Apple 9+ probably; "Showtime", financial sim (investing, house buying) is fine.

### 4.4 Operations
* **Crash/error reporting**: none (§2.3). Add Sentry (Capacitor SDK) or a minimal beacon; include `__errors` ring buffer.
* **Analytics**: none; if added, privacy-light (TelemetryDeck/Plausible-style), and update the labels.
* **Save backup / cloud sync**: export/import code exists (`prompt`-based). Add iCloud/Play Games Saved Games or a Supabase row keyed by platform id later; conflict rule = higher `careers` + `totalSeasons` wins.
* **Versioning/build numbers**: `package.json` is `0.1.0`; the page carries `rib-build` (commit sha) and `RIB_MENU_VERSION` (`v147uff`) and the title still says "v15.20". Adopt semver in `package.json`, derive `versionCode`/`CFBundleVersion` from CI run number, show it in Settings.

---

## 5. Performance

### 5.1 Load size

| Part | Raw | gzip | Notes |
|---|---|---|---|
| index.html total | 9.88 MB | 5.81 MB | GitHub Pages gzips HTML |
| — inlined images (13 data URLs) | 6.10 MB | 4.61 MB | duplicates of `public/*.png`; biggest: side 736 KB, wheel 732 KB, atlas_v22 559 KB, crowd 373 KB, plan 335 KB, logos 2.55 MB (base64) |
| — Phaser (full minified build) | 1.21 MB | 330 KB | the renderer uses only the CANVAS renderer, Graphics (27 `add.graphics`), Text (14), Image (14), Rectangle, Container, Tweens (51), Textures, Cameras — no physics, loader, input, sound, particles or sprites. A custom build could drop a large share |
| — broadcast renderer / bridge (block 5 after Phaser) | 661 KB | 219 KB | 8,766 lines |
| — career app (block 7) | 928 KB | 333 KB | |
| — FieldSim + choreographer (block 4) | 376 KB | 129 KB | |
| — everything else (CSS 209 KB, other blocks, HTML) | ~720 KB | ~200 KB | |
| `public/` runtime fetched at menu | 59 requests, 3.1 MB | — | film webm 1.31 MB, wordmark 141 KB, field 139 KB, vault.js 134 KB, lights 98 KB, menu.js 71 KB… |

### 5.2 Time to menu / live (localhost, headless, contended CPU)
* DOMContentLoaded ~1.07 s, `load` ~1.16 s; menu visible **~6.8 s** — the splash deliberately waits for the film intro to land (~6.5 s, v116 `FILM_WAIT_INTRO`). With `?noFilmV114` + tracing the main thread spent **ParseHTML 3.3–3.9 s** and EvaluateScript 2.0–2.4 s (the single biggest EvaluateScript is block 5, 1.2–1.8 s: Phaser + the renderer + 6 MB of string literals); image decode 1.3–2.5 s. These traces ran alongside other agents' browsers, so read them as proportions: the HTML parse of the 9.9 MB document is the largest single cost, which is what §0 #1 removes.
* Live game: from "CONTINUE TO MATCH" to the scene standing **3.1 s**, first snap **4.4 s** (the loader film covers it).

### 5.3 Memory
JS heap: 33 MB at the menu → 104–137 MB during a live game (performance.memory). Canvas backing store on the live field ≈ 19–26 MPx (77–105 MB at 4 B/px), 1,614–1,639 Phaser textures, no growth across three games.

### 5.4 Frame time on the live field (CANVAS renderer, no GPU, 400×860)
* 1×: 36 fps, p50 16.7 ms, p95 50 ms, p99 167 ms, 54 frames > 33 ms in 12 s, 2.0 s of long tasks.
* 4×: **19.6 fps, p50 33 ms, p95 83 ms, p99 483 ms**, max 883 ms, 2.9 s of long tasks in 12 s.
  (A second run with more background load: 1× 18 fps, 4× 4 fps — the renderer degrades sharply under CPU pressure, which is what a low-end phone is.)
* The 4× cost is dominated by per-play script building (FieldSim + choreography + `contactV146`/`meshV118` passes) arriving 4× as often, plus canvas redraw of ~1,600 textured sprites. Candidates: build the next play's script in an idle callback/worker during the current play (the loader already prebuilds the first one — `prewarm`), and WEBGL.

---

## 6. Roadmap

### Wave 1 — make every future change cheaper (1–2 weeks, mostly S)
1. **Delete the inlined images** (`window.__RIB_*` data URLs) — the `__RIB_ASSET` fallbacks already work. Delete line 21856's garbage. (S, low risk, −6.1 MB, and every grep/diff becomes readable.)
2. **Split `index.html` by block into real files** (`src/fieldsim.js`, `src/renderer.js`, `src/career/*.js`, `src/css/*.css`, `vendor/phaser.min.js`) loaded as classic scripts in the *same order*; `assemble-pages.mjs` can inline them again for the store build if a single file is still wanted. Give checks a loader that reads by **file name**, not block index (fixes `equaltalentcheck`, `starimpactcheck`, `v141check`). (M, low risk if order is kept — the other workers are on this now.)
3. **One state accessor** (`window.GAME.state()`), `window.o` alias getter, fix the v42 dial bug. (S)
4. **`scripts/_env.mjs`** (one `GAME_URL`), `scripts/checks.json` (area → scripts), `npm run check -- <area>`; fix the 7 stale/fragile checks in §2.6 so red means red. (S–M)
5. **CLAUDE.md → ≤150 lines** + generated `docs/INDEX.md` + `docs/features/`. (S)
6. **Beautify + AST rename** of the career app (top 50 names, §1.3), in a commit of its own. (M)

### Wave 2 — flatten the architecture (2–4 weeks, M)
7. Flatten the wrapper stacks (`q`, `wt`, `tt`, `et`, `kt`, `He`) into named phases; delete dead `wt`/`Kn`/39 unused globals.
8. Replace the 14 pollers + 11 body observers with an `afterRender(view)` bus.
9. Move settlement out of `ms()`/`no()` into `endCareer()`; one `ppMultiplier()`.
10. Escape every name (`S()`), sanitize at input, add a hostile-name screen walk to `bootviewcheck`.
11. Save: debounced save, real migrations + fixtures, import through migrations, error surfaced.
12. Retire version kill-switches older than ~v130 that no check A/Bs; rename the colliding `TU` keys; generate `tuning.json`.

### Wave 3 — performance for phones (2–3 weeks, M–L)
13. Menu: bake drop-shadows, pause idle infinite animations, cap the ambient canvas.
14. Live field: try WEBGL (`mt.AUTO`) behind a `TU` switch; atlas the palette recolours; shrink the warp canvas; build the next play off the critical path.
15. Phaser custom build.

### Wave 4 — store (3–4 weeks)
16. Capacitor projects, back button, safe-area config, haptics plugin, Preferences-backed save, disable `freshV106` in-app, uniform preview overlay, replace `confirm`/`prompt`.
17. Service worker for the PWA/TWA path.
18. Sentry/beacon, version numbers, privacy policy, age rating, provenance notes, update COMMERCIAL.md.

### Wave 5 — monetization (after Wave 4)
19. `RIB_MONETIZE` stub → Pro unlock (speed 4×, cosmetics) → rewarded timed boosts for unranked careers → (maybe) membership with cloud save. Keep every random reward unpurchasable.

---

## Appendix — artifacts

All under `/tmp/claude-0/audit/`: `index.snapshot.html` (frozen input), `blkNN.js` (script blocks with
base64 replaced by `<len>`), `app.js` (career app body), `top.json` (930 top-level bindings with ref counts),
`shortnames.txt`, `wrap.py`, `ast.mjs`, `dead.mjs`, `probe/*.mjs` (boot, live, save/XSS, settings, trace),
`checks/*.mjs` + `log_*.txt`/`solo_*.txt` (the nine checks re-pointed at the snapshot), `bis_*.txt`
(the `v141check` bisect), `menu.png`, `live.png`.
