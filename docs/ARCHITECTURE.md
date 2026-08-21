# GRIDIRON — Codebase Map

The entire game ships as one self-contained `index.html` (~6,500 lines): Phaser
bundled inline, sprite atlas + field art baked as data URLs, and all game code
in a series of inline `<script>` blocks. There is no build-time module graph —
**the fastest way to navigate is by grep anchor**, not by line number (line
numbers drift with every change; the banner comments don't).

```bash
grep -n '^<script\|^</script>' index.html        # block boundaries
grep -n '/\* =====' index.html                    # section banners
```

## Script blocks, in file order

Line numbers are approximate (as of the stat-credit-truth commit); the **anchor**
column is the stable way in.

| ~Lines | Anchor (grep for this) | What lives here |
|---|---|---|
| 147–197 | `// error surfacing` | Boot shims: splash error surfacing, localStorage shim for sandboxed iframes. |
| 199 | `RIB_TUNE: every gameplay dial` | `TU(key, default)` — every gameplay dial reads through this; retune live via `window.RIB_TUNE[key] = …`. |
| 202–1356 | `GRIDIRON play choreography engine` | `buildPlayScript(payload, cfg)` — the **legacy choreographer**: pure keyframe builder (no Phaser/DOM) used as the render fallback when no FieldSim log matches (~10–13% of plays). Has its own tackle-motion/gang-pulldown code — cosmetic only, never stats. |
| 1357–2127 | `GRIDIRON FieldSim — agent-based play resolution` | **FieldSim** — the engine that resolves plays AND records the render log. See breakdown below. **v55 ROUTE TREE** (`ROUTE_TREE` / `mkRoute` / `R_DEEP`,`R_MED`,`R_SHORT`): 45 shapes × 3 releases × 3 depth tiers = 405 combinations; each shape declares a `tail` (go / across / out / settle) so a finished route keeps working instead of parking. Every pool name must exist in `ROUTE_TREE` — `cross` once did not and fell through to a straight line. Debug capture via `window.__ROUTE_DEBUG`; guarded by `scripts/routecheck.mjs`. **v56 REACTION** (`routeReactDelayV56`, the `rxq`/`iq` split, `RX_POS_V56`, and the perception-action hold in `mv`): `reactMs` is consumed at last — a defender whose intent swings past `TU("reactGate")` keeps steering on the old heading for `reactMs` scaled by the swing, with a refractory window. **Defence only** — offensive players are executing a called plan, not reacting. Only the steering vector is held; holding the remembered intent too makes every tick re-trigger and the defence stops covering entirely. Guarded by `scripts/reactioncheck.mjs`, which asserts the scoreboard alongside the timings. |
| 2138–3538 | `GRIDIRON live-field bridge v3` | Minified Phaser bundle (**do not edit**), then the broadcast renderer: `LiveField` scene, `PJ` sim→screen projection, `fireEvent` (event → on-field FX/pop-text), sprite pose state machine (`tackleSeq`, dive/grab frames). `RIB ART` atlas + 40-palette team recolor. **v45 REFEREE CREW** (`spawnRefs`/`updateRefs`/`placeRef` + `refThrowFlag`/`refSignalTD`/`refWhistle`/`refNearest`, anchor `v45 REFEREE CREW`): a render-only 7-official layer in `this.refs` (never sim actors, no stats) that trails the ball, throws flags, whistles the dead ball and signals scores. **v49 REF ART** (anchor `v49 REF ART`): the crew is drawn from its own officials sheet (`RIB_META_REF` / `ribCellRef` / `ribRegisterRefs`, `window.__RIB_REFS_V49`, 64px cells) — NOT recolored, since officials wear one kit; `ribRegisterTeam` short-circuits for `team === "ref"` once the sheet decodes, and the old `ribZebra` player recolor stays registered only as the never-decoded fallback. **v57 CROWD** (anchors `v57 CROWD ART` and `v57 CROWD STANDS`): real stands in the apron outside both sidelines, from their own sheet (`RIB_META_CROWD` / `ribCrowdStrip`, `window.__RIB_CROWD_V57`) in three density tiers x idle/cheer. A stand is a WALL, so it cannot go in `warpField`'s row loop (one depth per row); `buildCrowd`/`crowdSection` sweep the sideline in COLUMNS instead — sample depths spaced uniformly in screen Y (`crowdInvertC`, the same bisection `warpField` uses), project each through `PJ` for a ground point and the ratio `k`, and map the art onto the resulting thin quads with a three-point affine, so the tiers converge on the yard lines' own vanishing point. The source column advances with the **integral of k**, not field distance — advancing it linearly squeezes each spectator horizontally where the sideline foreshortens; ∝k makes the horizontal texture scale match the vertical one. Height then derives from the art's aspect (`crowdHeightK` trims it), and `crowdDecks` stacks the strip — by the **seating pitch** from `cellmap[4]`, not the cell height, or turf shows through between decks. Cheering is an alpha CROSSFADE per section (`updateCrowd`), not a redraw — geometry rebuilds once per snap, the crowd reacts every frame. `crowdReact` (called from `fireEvent`) starts a roar at the play and `crowdCheer` rolls it down the sideline as a wave. **Gotcha:** `crowdDepth` (3.45) must stay above `fieldLines` (3.4) and below the ground shadows under players (3.5) — the LOS/first-down markers paint on the ground past the sideline, and the stand has to OCCLUDE that reach rather than be painted over. `crowdGap` is the **team area**: apron reserved for benches/coaches/players a later system can populate. Render-only: no sim actor, no stats. Guarded by `scripts/crowdcheck.mjs`. |
| 3539–3636 | `rib-v1520-phaser-launcher` | Phaser boot/launcher. |
| 3638–5513 | `v18 CHOICE EXPANSION` | The **career app** (dense, mostly one statement per line): screens/state (`o`), story arcs, roster builder `Wr`, stat-line builder `qi`, and the **v16 emergent game engine** `Yr` (see below). **v52 NATIONAL RANK**: one population model — `NAT_POOL(level)` is `A[level].slots`, `POS_POOL` is that split 9 ways, and both the leaders board (`kr`/`Ii`) and the rank card (`sn`) read them, so no two screens can quote different denominators. `sn()` anchors standing on `kr()` — the leaders board's own production rank — and scales it by the rating **in rank space** (percentile space is useless in the tail). Debug surface: `window.__RANK_V52`; guarded by `scripts/rankcheck.mjs`. |
| — | `v51 PREGAME WHEEL` | The weekly game-plan decision, rolled on the shared wheel instead of v41's silent auto-pick. Reads the deck off the rendered `.gameplan-overlay` (id, icon, `--planColor`, UPSIDE/CONTROL/RISK bars), weights by the same appetite formula as the v16.6 story wheel, resolves with `bandOdds`, and grants a one-game effect via `applyOutcome`. Shortlists a 10-plan deck to 6 (scout pick pinned) and states the cut. Falls back to the v41 auto-pick if the deck can't be parsed. Note `chooseGamePlanV11` is itself wrapped by the v1514 players-to-watch panel, so choosing a plan opens that before the match. |
| — | `v50 SPEED THROUGH` / `v50 SPIN WHEEL` / `v50 FIT ROLL` | The decision layer, three separate systems. **SPEED THROUGH** (`window.__DECIDE_SPEED_V50`): every rolling decision schedules its delays through `DS.wait()`, so a tap anywhere multiplies the *remainder* by `TU("decideSpeed", 5)`; shared by the v16.6 story wheel and the v50 growth wheel. **SPIN WHEEL** (`drawWheel`/`spinWheel` in the v42 block — `spinWheel` is the shared renderer, `showWheel` its growth adapter): a real canvas wheel where each option's **wedge arc is its personality weight** (`o.w/tot`), landing on the seeded pick so careers still replay identically. **FIT ROLL** (`jiveOf`/`bandOdds`/`jiveTraits`): the +/neutral/− band is its OWN roll — near-even thirds for a character with no opinion, swung hard by `jive` (the landed theme's weight against a neutral persona's, using the theme's own weight function). Prestige, coach trust, form, fatigue and tier risk survive as a bounded ±.22 nudge. The wheel draws from its own art sheet (`RIB_META_WHEEL` / `wart()` / `window.__RIB_WHEEL_V50`, rect-based cellmap — rim, hub, four pointer-deflection frames, twelve theme icons, three outcome seals), and every draw falls back to the procedural shape it replaces. The wedge under the pointer pops (`liveWedge`, `TU("wheelIconPop")`). Palette: one deep base hex per theme in `WCOL`, every tint/shade derived via `wshade()` (radial ramp + vignette + outer-half sheen); the dev check classifies the face by HUE, which uniform scaling preserves, so shading can change freely without breaking it. Dials: `growth_jive` in Settings, `TU("decideSpeed")`, `TU("wheelIconPop")`. |
| 5518–5548 | `__GRIDIRON_CONTACT_MODEL_V156` | Standalone contact-model formula + self-check sweep (exported for unit checking). |
| 5549–5651 | `v15.7: exact team-rating rosters` | Roster/mismatch tuning. |
| 5655–5720 | `v15.8: persistent season rosters` | Season roster persistence + prestige roster department. |
| 5727–5872 | `v15.13: consecutive-play football recovery` | Play-flow recovery + pregame top-five screen. |
| 5874–6112 | `rib-v1520-phaser-runtime` | Per-player appearance/sizing, the football, `GEAR_OVERLAY_ENABLED` toggle. |
| 6113–6192 | `RIB DEV HARNESS` | Live tuning + measurement; run `DEV.help()` in the console for its map. |
| 6193–6326 | `v16.6 PERSONALITY SLIDERS` | Character creation sliders (`player.personaV13`). |
| 6358–6477 | `v16.6 STORY-ARC WHEEL` | Personality-weighted decision wheel. |

## FieldSim (the play resolver) — `/* ===== GRIDIRON FieldSim`

Local coordinate system: LOS at `lx = 0`, offense attacks +x, `YD = 5.88` px per
yard, `TICK = 33` ms per sim step. Key pieces, in order:

- `makeAgents(kOff, tDef, att, picks)` — builds 22 agents from the two rosters.
  The user's roster player **always takes the field at his position slot**
  (`youPending`), so `agent.player.you` is the ground-truth identity for stat
  credit. `picks.off/def` pin specific roster players to formation slots.
- `sim(kind, kOff, tDef, att, picks, opts)` — the tick loop. Trench pairing
  (shed/swim/pancake), routes + coverage, the carry loop, and `emit(type, extra)`
  which appends to the play's `events` array — **the stat layer and the renderer
  both read these events**.
- `contact()` (anchor: `returns: "cooldown" | "whiff"`) — one committed tackler at
  a time; resolves whiff / hurdle / stiff-arm / truck / stagger / tackle.
  Computes `supIds` (support wrappers within 16px) and the `gang` roll, and emits
  the final `tackle` event with `tackler`, `sup`, `gang`, `youIn`, `kb`, `drive`.
  **`youIn` is only set when the stop is gang-assisted AND the you-player is one
  of the supporting wrappers** — proximity alone is not participation.
  **v19 physics:** the truck/broken and wrap branches resolve from a head-to-head
  of speed AND strength/tackling — a carrier who wins both flings the tackler back
  along his line of motion (`brokenTackle`), a defender who wins drives the carrier
  back (`kb` knockback), and a carrier who keeps his legs gets a forward `drive`.
  `kb` (backward) and `drive` (forward) are applied to the tackled man during the
  post-whistle coast, so he finishes his motion instead of freezing on contact.
  The commit is split: the defender leaps at `TU("tackleLaunchDist",30)` (~2 sprite
  lengths) and the grab/collision resolves at `TU("tackleGrabDist",16)`.
- `finishCarry(why)` — out-of-bounds / whistle finishes. Credits the *nearest*
  opponent as tackler; no assist on OOB.
- Stat truth extraction (anchor: `who ACTUALLY made the stop`) — after the play,
  the last `tackle` event is mapped back to roster players:
  `out.tackler` / `out.assist`. This is the **only** source of tackle credit.
- `breakProb`, `turnTest` — pure formula hooks for unit checks.
- `window.__FieldSim` — the public API: `.pass(...)` / `.run(...)` resolve a play
  and push its render log onto the FIFO `_Q`; `.takeLog(sig)` is how the renderer
  claims a log (it **searches** by `(kind, off, yards, intercepted)` rather than
  popping the head — see the render-path fix notes in the README).

## The emergent game engine `Yr` — `/* ===== v16 EMERGENT GAME ENGINE`

`window.__simGameV2(perf, pos)` = `Yr`. Resolves a full game play-by-play on a
real clock and returns `{plays, usScore, themScore, stat, team, oppTeam, roster}`.
Inside it:

- `Wr(...)` builds both rosters; the you-player is injected at his position.
- `B(w, concept)` / `b(w, concept)` — run/pass resolvers. They call
  `__FieldSim.run/pass` when available and fall back to a pure formula.
  **Gotcha:** the v16.1 "gash promotion" can replace a sim-resolved short run
  with a synthesized longer one (`dropSimLog()` + new `base`) — the synthesized
  play has **no tackler truth**, so it must never credit the you-player a tackle.
- `P` — the you-player's accumulating box score for the game; `pe(w)` (`w && w.you`)
  is the only test for "is this the user". `qi(pos, P, r)` shapes `P` into the
  final stat line.
- **Stat-credit truth** (the invariant this file must keep): every `P.tackle++`,
  `P.sack++`, etc. must trace to a play whose resolved actors name the
  you-player (`pe(X.tackler) || pe(X.assist)`, `pe(skr)` for sacks). No random
  side rolls that hand the player a teammate's stat. Guarded by
  `scripts/creditcheck.mjs` and `scripts/statcreditcheck.mjs`.
- Sacks/scrambles are resolved **outside** FieldSim (trench-rating rolls), which
  is why the sacker `skr` is picked at this layer and credit follows `pe(skr)`.

## Render path (why some changes "don't show up")

Plays are resolved up-front (each pushing a log to `__FieldSim._Q`), then the
broadcast view replays them: `takeLog(sig)` matches a play to its sim log; on a
miss it falls back to `buildPlayScript` choreography. If you change sim behavior
and can't see it on screen, run `node scripts/renderpathcheck.mjs` — the sim →
render hit rate should be ~87–90%.

## Verification workflow

```bash
npm run dev                        # leave running; all checks drive it headlessly
node scripts/creditcheck.mjs      # tackle credit ≤ sim truth (this repo's invariant)
node scripts/statcreditcheck.mjs  # box score credits only involved plays (all stats)
node scripts/tacklecheck.mjs      # solo/gang split, whiff/truck/stiff-arm rates
node scripts/simcheck.mjs         # score/pace/yardage distributions
node scripts/renderpathcheck.mjs  # sim-log → screen hit rate
node scripts/refcheck.mjs         # v45/v49 officiating crew + ref art
node scripts/crowdcheck.mjs       # v57 stands: perspective, roar wave, fallback
```

See `scripts/README.md` for the full catalog (including screenshot/exploration
helpers). Chromium is pre-installed at `/opt/pw-browsers/chromium`; every script
already points at it.

## Conventions

- **Tunables, not constants.** Any gameplay number someone might retune goes
  through `TU("name", default)` so it's live-adjustable via `RIB_TUNE`.
- **Stat-credit truth.** Stats are credited from resolved actors, never from
  proximity or random rolls (see the invariant above).
- **Match the local density.** The career app block is written one dense
  statement per line; FieldSim is written spaciously with banner comments.
  Match whichever region you're editing.
- **Don't touch the Phaser bundle** (the minified region at the top of the
  live-field bridge block) or the baked data-URL assets.
- **Version-stamp new systems** in a banner comment (`v18 …`) and summarize the
  change in the README's "Recent changes" — that log is the project history.
