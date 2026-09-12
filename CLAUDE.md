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
- `v81 BALL AWARENESS` / `v81 THE POINT OF ATTACK` — defenders find the ball on
  their own clock, fakes, committed pursuit lines, rolled blocks, the hole
- `v82 THE FRONT HAS A PLAN` / `v82 DISGUISE` / `v82 SPECIAL TEAMS` — stunts, spy,
  protection calls, chips, rotation/press, the pocket, ball skills, bounce/pile,
  effort, the back's lookahead, leverage, and punts/kickoffs/FGs as agent plays
- `v16 EMERGENT GAME ENGINE` — `Yr` / `window.__simGameV2`: full games,
  play-calling, the you-player's box score `P`
- `GRIDIRON live-field bridge v3` — broadcast renderer (after a minified
  Phaser bundle — **never edit the bundle**)
- `v85 THE WHEEL SPINS IN THE BACKGROUND` / `v85 THE DECISION, WITH NO WHEEL
  ATTACHED` / `v85 THE BODY ON THE SHEET` — the silent week (quick play, sim the
  rest), live-game booking, effective attributes, the season projection
- `v87 WHO IS ON HIM` / `v87 THE QB SEES THE LANE` / `v87 SAFETY` / `v87 THE HUDDLE,
  THE POSTS, THE SAFETY` — coverage by alignment (no coin-flip credit), opportunity
  scrambles, no backward throws, the safety, the huddle glide, goalposts
- `v88 THE CALL-UP FOLLOWS THE RANKING` — promotion odds from national rank
  against the level's advancing share; `declareChanceV88` is the one number
- `v107.1 THE FLASHES ARE ONLY OVER THE CROWD` — the hero's camera flashes, shimmer, lamps and sun
  live in PICTURE percent (`CROWD_V107_1`, `HERO_LAMPS`) and map through the cover box each frame
  (`heroPicBoxV107_1`); `window.__RIB_MENU_FX_V102.flashLog/.crowd/.box` is what the check reads.
  The wordmark sheen is two identical sweeps a cycle (`rib9sheen`, `no-repeat`; `rib9brand` too)
  in `public/rib-menu-v89.css`. `heroflashcheck.mjs` and `sheencheck.mjs` are the proofs
- `v107 THE ARM, THE DROP, THE STANCE` — the v91 sheet's own throw per facing
  (`RIB.throwV107`: `up`/`dn`/`ur` drawn, `sd` borrows the quarter, `dr` the front; `?noV91`
  keeps the baked facing-less frames and their forced `flip=false`), the release armed by a
  LOOKAHEAD into the script's `throw` (`windupV107` / `startThrowV107` beside `qbTickV86`,
  `seqT` back-dated so frame 4 is drawn the tick the flight starts — FieldSim emits no
  `windup` at all), the v105 hand taken from the CELL (and the renderer's own ball scaled away
  across frames 0-3, which already draw one), the dropback drawn as `backpedal0..5`
  (`TU("backpedalFrameMs", 110)`, held past the last backward step by `TU("dropHoldMs", 200)`
  because v86's one-frame test flickers), and the offense's own pre-snap:
  `stance3_up` on the whole line (the drawn centre pose is not used), `ready_up` on the skill men,
  `carry_up` on a man standing with the ball. Rear-view art — the defense gets none of it.
  `window.__V107` is the hook
- `v106.1 THE PAGE KNOWS WHEN IT IS STALE` — `freshV106` in `public/rib-menu.js`: at the menu's
  first mount the page compares its own `<meta name="rib-build">` (written by
  `scripts/assemble-pages.mjs`) with `rib-build.json` fetched past the cache, and reloads once when
  the site has moved on (`window.__RIB_FRESH_V106` is the verdict; `?stayStale` holds it).
  `freshcheck.mjs` is the proof. Bump `RIB_MENU_VERSION` (`bake-menu-into-index.mjs`) whenever a
  menu file changes, or the old file stays cached under its old stamp
- `v106 THE KIT IS CUT FROM THE PICTURE` — the main menu's team colours ride pixel-measured masks:
  `scripts/menu-kit-hero.py` / `menu-kit-card.py` / `menu-kit-portrait.py` (one per photograph,
  run by `build-menu-art.py`) trace each garment's edge off the source art and write
  `public/menu/*_mask_{p,s}.webp`; `_p` is the jersey (primary), `_s` helmet + pants (secondary).
  Never hand-place a polygon again — edit the prior curves in the script, rerun, look at the
  overlay it writes. `menu-mask-check.mjs` holds the probes; `menu-kit-shot.mjs` shows the kit
- `v105.2 THE KIT FOLLOWS THE TEAM` — `m.team` is the SIDE (off/def/you; depth and gameplay
  rules read it), `m.kit` is the PALETTE the marker wears ("off" = the user's team, "def" = the
  opponent, chosen from possession by `kitForV105_2(side, et)`); `setTeam(m, team, kit)`,
  `marker(..., kit)`. `kitsidecheck.mjs` (READ_POS=LB) is the proof
- `v105 THE BALL HAS A HANDLER` — `handV105` / `handPosV105` (the snap, the handoff, the toss:
  a ball chasing the hand it is owed, re-aimed every frame), `trailV105` (the ribbon, the spiral
  in flight, the flame + embers for a hot man), `heatV105` / `hotV105` (the per-offense heat book
  written in `complete()`; `heatHot` is the line), the glide-phase ball on the grass at
  `ballGroundDepth`, the pre-snap ball under CENTER (actor 5, `ballUnderCenterY`);
  `window.__V105` is the hook. Field perspective defaults to 0.78 (`fxDepth`)
- `v104 THE NUMBER ON THE JERSEY` — the kit bands read off each drawn cell at register time
  (`numBandV104`, cached per SOURCE cell in `RIB.numBandSrc`, per texture key in `RIB.numBandTex`):
  the waistband, the collar, and the row the jersey itself runs out on. `numPlaceV104` hangs the
  number from that waist at a constant height in cell rows, clamped inside the band, scaled by the
  body's own build; `numFontV104` measures the raster's INK (not its line box) so it lands exactly.
  `window.__V104` is the hook (`.bands`, `.last`, `.cell(srcName)` for the source art)
  The same pass moved the hero's picture, tints and name into `.rib9-hero-art`, the layer that
  breathes together (the menu kit's masks themselves are v106 now)
- `v103 THE GRAB` / `v103 THE GRIP TICK` / `v103 THE WHISTLE IS NOT THE END OF THE CONTACT` /
  `v103 THE LINE BLOCKS FOR HIM` / `v103 THE TRENCH BREAKS UP` / `v103 KEEP THE PICTURE` — a landed
  wrap opens `c._grip` and returns `"grip"` instead of `"tackle"`; the grip tick at the top of the
  carry block travels the pair, piles men on, strips the ball (`out.fumble`, which the engine books
  as a NAMED turnover), strains for the sticks, breaks, and finally emits the tackle with
  `dragged/dragYd/strain`. `retagSimLog(y)` re-tags a queued log when `dampV76` reshapes the yards
  (do this for ANY post-sim yardage reshape, or the play loses its animation). Renderer: the
  `grab`/`pileOn`/`gripBreak`/`secondEffort` cases, `m._dragging`, `P.gripPair`, and the late
  contact in `startPostV86`/`updatePostV86` (`m._late`, `P.post.late`); `window.__V103` is the hook
- `v102 THE LIGHTS ARE MIRRORED, AND THEY BREATHE` / `v102 THE MOMENT SLOWS DOWN` / `v102 THE MENU
  IS ALIVE` — `buildMirrorMastsV102` (the mirrored bank; **off at its default since v103** —
  `TU("mirrorMastsV102", 0)` — so the lights are the far four in `ST.towers` and nothing else.
  `turfRowsV103` / `onTurfV103` read the painted turf as a FAN through `PJ`, not a rectangle, and
  keep any mast's ART off it; one that would bleed is kept as a light, `tw._litOnly`, and not drawn), `lightLiveV102` / `lightLiveAllV102` (the shimmer and the sputter; every
  rig, `shadowMulV100` and `lightAtV101` ride it; `window.__V92.mirror()/live()`); `slomoV102` /
  `slomoDrawV102` (windows read ahead from `P.script.events`, the `.rib-slomo-v102` letterbox,
  `window.__SLOMO_V102`); the hero FX in `public/rib-menu.js` (`startHeroFx`/`stopHeroFx`,
  `window.__RIB_MENU_FX_V102`) with the keyframes in `public/rib-menu-v89.css`
- `v101 ONE ASSET ROOT` / `v101 THE PLAYBOOK` / `v101 THE LEAD` / `v101 THE LIGHT MOVES ON HIM` /
  `v101 THE SIM LOADS BEHIND THE DOOR` / `v101 THE STANDS HAVE A VOCABULARY` /
  `v101 WHOLE NUMBERS ON THE SHEET` — `window.__RIB_ASSET(p)` is the one URL every sheet asks
  through (document-relative, under `public/`; `vite.config.js` mirrors the folder into `dist/`);
  `PLAYBOOK_V101` / `pickPlayV101` are the 42 named calls, feeding `opts.gap` (runs) and
  `opts.routes` (passes) into FieldSim; `leadPointV101` / `walkRouteV101` / `leadSkillV101` /
  `coneYdV101` / `protV101` / `windowV101` are the throw (`window.__V101.last` is the last one);
  `fillLightV101` / `castFillV101` / `lightAtV101` / `shadeTintV101` are the second cast and the
  light on the man; `prebuildV101` / `bridge.prewarm` / `__LIVELOAD_V94.simReady` build the play
  behind the loader; `emoBookV101` is the crowd's per-moment emoji; `W1` rounds the skills sheet
- `v100 THE LIGHTING DIAL` — Settings › FIELD VIEW's **Lighting intensity** (`fxLight` →
  `window.__FIELD_FX.light`): `lightMulV100` (the lamps and the masts' tint), `bakedMulV100`
  (the turf's wash and pools, softened above 100%, with the vignette moving the other way) and
  `shadowMulV100` (how deep every shadow falls, with an ambient floor at 0)
- `v99 THE SHADOWS FALL` — one key light post (`keyLightV99`, a mast that does not sway, read
  at its fixed base) and everything on the grass casts from it: `shadowVecV99` / `castShadowV99`
  (players, officials, the ball, the sideline), the goalposts' whole H on `postShadG`, a lifted
  man's shadow left on the ground, and the lamps holding one frame instead of cycling
  (`lightCycleV99`); `window.__V99` is what the checks read
- `v98 UNDER THE LIGHTS` / `v98 THE SCOREBUG WEARS THE KITS` / `v98 THE STANDS REACT` /
  `v98 THE HANDOVER CUT` — the masts on a fixed row (`lightFootUp`, two sway), the lamp rigs
  (`lightRigV98`: glow, beam, pool), the lit turf (`lightFieldV98` in `warpField`), the darker
  sky, the scorebug in the two palettes (`ribPaintScorebugV98`, `--sbUs*`/`--sbThem*`), the
  emoji off the stands (`crowdEmojiV98`), the camera's re-frame on a new carrier (`P._camCut`),
  the coach-trust swing on the post-game card (`__coachSwingV98`, `week.coachDelta98`)
- `v97 THE LOADER GOES FIRST` / `v97 THE FOLD` / `v97 THE 250 WALL` — the live sim waits at the
  loader's door (`__LIVELOAD_V94.whenClear`), a hub tab longer than the phone folds
  (`fold`/`FOLD` in the v75 sectioner), the upgrade sheet in three groups (`UP_GROUPS_V97`),
  `palNameV97`, prestige at `TU("prestigeGainMult")` / `TU("prestigeEffectMult")`, the wall at
  `TU("drWallAt")`, both end zones in `RIB._ezV93.ends`
- `v96 HIS OWN KIT` / `v96 A NAME OF HIS OWN` / `v96 THE READ RADIUS` — the you-player in
  his team's palette (`ribSyncYouKitV96`, `m.kitSide`), the editable name on the position
  screen (`setPlayerNameV96`), the live box's minor line (`flMinorV96`), and field vision as
  a yard-a-point radius from 75 (`visionRadiusV96`, `TU("visionRadiusFrom")`)
- `v95 THE CALLOUT WALL` — the drawn badges over the live field as a tiered presentation
  system: `BADGE_BOOK_V95` (one data row per badge), `BADGE_PROMO_V95` (the morphs),
  `BADGE_V95.show()`, `badgesPresnapV95` / `badgesWhistleV95`; art in `art/badges/`, cut by
  `scripts/build-badge-art.mjs` into `public/badges/`
- `v94 THE CHASE` — the loading screen and the live game's loader: one canvas chase engine
  (`window.__CHASE_V94.make()`) from the v91 sheet in its own `<script>` right after the
  boot shims; `window.__splashDoneV94()` is the door `go()` uses, `window.__LIVELOAD_V94`
  mounts the same chase over `.field-wrap` while the broadcast boots
- `v93 THE HOME END ZONES` — the end zones painted in the home team's colours and name on
  the flat art; `ribSyncEndZonesV93`, `window.__homeGameV93`, `homeWeekV93`
- `v92 THE LIGHTS AND THE BIG SCREEN` — floodlight towers and the replay screen above the
  far bowl, the feed camera, the taller posts; `RIB_META_V92` is generated by
  `scripts/build-stadium-art.mjs`
- `v91 THE FIELD SHEETS` — the drawn run cycle, get-up, celebration and ball on the
  broadcast field; `RIB_META_V91` is generated by `scripts/build-field-art.mjs`
- `v90 THE ROLLS HAPPEN IN THE BACKGROUND` — story stages answered and rolled on the
  silent path; `autoStoryV90`, `TU("autoStoryStyle")`
- `v89 THE MENU'S OWN FEED` — `window.__RIB_MENU_DATA_V89()`, everything the main
  menu shows; the menu itself is `public/rib-menu*.{css,js}` + `public/menu/*.webp`
  (see `docs/ARCHITECTURE.md`, v89 MAIN MENU)
- `v86 BETWEEN THE WHISTLES` — the renderer's post-play phase (unpile, gather),
  pre-snap life, QB dropback/hitch/tuck/slide, tackle styles, look-back, field wear
- `v78 SIDELINE` / `v78 SIDELINE ART` — the team area outside both touchlines:
  staff, backups, benches, equipment, the chain crew
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
| defender reads / blocking / pursuit (v81) | `readcheck.mjs` (pure Node), then `movementcheck.mjs`, `simcheck.mjs` |
| stat credit / box score | `creditcheck.mjs`, `statcreditcheck.mjs` |
| game engine / play-calling / yardage | `simcheck.mjs` |
| anything sim-side that should be visible | `renderpathcheck.mjs` |
| injuries | `injurycheck.mjs` |
| OVR scale / the silent sim path / the attribute sheet (v85) | `v85check.mjs`, `bodycheck.mjs`, `wheelcheck.mjs` |
| the broadcast renderer between plays / tackle looks (v86) | `v86check.mjs`, `readshot.mjs` |
| pass coverage / credit, QB scramble & targets, the safety, the huddle (v87) | `v87check.mjs`, `creditcheck.mjs`, `simcheck.mjs` |
| promotion odds / the declare (v88) | `v88check.mjs`, `declarecheck.mjs`, `rankcheck.mjs` |
| the callout badges / the moments the field shouts (v95) | `badgecheck.mjs`, `v86check.mjs` |
| which eleven wears which kit / the you-player's colours on defense (v105.2) | `kitsidecheck.mjs` (LB), then `v104check.mjs`, `v105check.mjs`, `v86check.mjs`, `sidelinecheck.mjs` |
| the ball between the hands / the trail, the spiral, the flame / the heat book / the perspective default (v105) | `v105check.mjs`, then `v86check.mjs`, `v91check.mjs`, `sidelinecheck.mjs`, `v92check.mjs`, `v99check.mjs`, `crowdcheck.mjs` |
| jersey numbers on the live field (v104) | `v104check.mjs`, then `v86check.mjs`, `v91check.mjs`, `renderpathcheck.mjs` |
| the grab / the pile / the strip / blocking / post-whistle contact (v103) | `v103check.mjs`, then `readcheck.mjs`, `tacklecheck.mjs`, `creditcheck.mjs`, `simcheck.mjs`, `renderpathcheck.mjs`, `v86check.mjs` |
| the mirrored masts / the breathing light / the slow-motion moment / the living menu (v102) | `v102check.mjs`, then `v98check.mjs`, `v99check.mjs`, `v92check.mjs`, `v86check.mjs`, `menu-integration-check.mjs` |
| asset paths / the playbook / the throw / dynamic shading / the loader's prebuild / crowd emoji / whole numbers (v101) | `v101check.mjs`, then `simcheck.mjs`, `readcheck.mjs`, `routecheck.mjs`, `v99check.mjs` |
| the lighting dial / how bright the stadium burns (v100) | `v100check.mjs`, `v99check.mjs`, `v98check.mjs` |
| shadows / the key light / the goalpost frame / the lamps holding (v99) | `v99check.mjs`, `v92check.mjs`, `v86check.mjs`, `sidelinecheck.mjs` |
| the lights / the lit turf / the scorebug colours / crowd emoji / the handover cut / the coach row (v98) | `v98check.mjs`, `v92check.mjs`, `crowdcheck.mjs`, `postgamecheck.mjs` |
| the loading screen / the splash's door (v94) | `splashcheck.mjs`, `shot.mjs`, `walk.mjs` |
| the end-zone paint / home and away fixtures (v93) | `v93check.mjs`, `v86check.mjs` |
| the stadium behind the bowl / the big screen / the posts / number formatting (v92) | `v92check.mjs`, `v86check.mjs` |
| the field sheets / the v91 atlas / player and ball frames (v91) | `v91check.mjs`, `v86check.mjs`, `renderpathcheck.mjs` |
| the silent path's story rolls / the upgrade sheet's numbers / the menu ring (v90) | `v90check.mjs`, `v85check.mjs` |
| the main menu / its feed / menu art (v89) | `menu-integration-check.mjs`, `menushot.mjs` (`CAREER=1`), `menu-preview-shot.mjs` |
| the wordmark sheen / the camera flashes, lamps and sun on the hero (v107.1) | `sheencheck.mjs`, `heroflashcheck.mjs`, then `v102check.mjs`, `menu-integration-check.mjs`, `menu-mask-check.mjs` |
| the throw's facing / the release's timing / the dropback / the pre-snap stances (v107) | `v107check.mjs`, then `v86check.mjs`, `v105check.mjs`, `v91check.mjs`, `renderpathcheck.mjs`, `kitsidecheck.mjs` (LB) |
| the deploy reaching a browser / the build meta / the one-time reload (v106.1) | `freshcheck.mjs` (no dev server), then `menu-integration-check.mjs`, `menu-mask-check.mjs` |
| the team kit on the menu pictures / the hero, continue-card and portrait masks (v106) | `python3 scripts/build-menu-art.py` (or the one `menu-kit-*.py`), then `menu-mask-check.mjs`, `menu-kit-shot.mjs` (look at the shots), `menu-integration-check.mjs`, `v102check.mjs`, `menushot.mjs` (`CAREER=1`) |
| team emblems / palettes / identity | `emblemcheck.mjs` |
| training / skill art, the skill atlas | `skillartcheck.mjs`, `wheelcheck.mjs` |
| the crowd, the sideline, the team area | `crowdcheck.mjs`, `sidelinecheck.mjs` |
| the declare / career-end screens | `declarecheck.mjs` |
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
