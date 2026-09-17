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
| — | `v94 THE CHASE` | The loading screen, its own `<script>` right after the boot shims so it animates while the Phaser bundle is still parsing. A 2D canvas chase drawn from the v91 field sheet (fetched as `public/rib_field_v91.png` + `rib_field_v91.json`, recoloured with `ribRecolor`'s bands). `window.__CHASE_V94.make()` runs it on any canvas; `window.__splashDoneV94()` is the door the career app's `go()` knocks on, `window.__SPLASH_V94` / `window.__LIVELOAD_V94` the dev hooks. See **The chase (v94)** below. |
| — | `v101 ONE ASSET ROOT` | The boot shims' last block: `window.__RIB_ASSET(p)` resolves every runtime sheet against the DOCUMENT, under `public/` — so the same string works served from a root, from a Pages sub-path, from `dist/` and from the Capacitor shell. Data URLs and absolute URLs pass straight through, and the per-sheet `window.__RIB_*` overrides still win. `vite.config.js` mirrors `public/` into `dist/public/` so `vite build` and `scripts/assemble-pages.mjs` produce the same layout. **Every new sheet goes through this, never a bare `/x.png` or `./public/x.png`.** |
| 199 | `RIB_TUNE: every gameplay dial` | `TU(key, default)` — every gameplay dial reads through this; retune live via `window.RIB_TUNE[key] = …`. |
| 202–1356 | `GRIDIRON play choreography engine` | `buildPlayScript(payload, cfg)` — the **legacy choreographer**: pure keyframe builder (no Phaser/DOM) used as the render fallback when no FieldSim log matches (~10–13% of plays). Has its own tackle-motion/gang-pulldown code — cosmetic only, never stats. |
| 1357–2127 | `GRIDIRON FieldSim — agent-based play resolution` | **FieldSim** — the engine that resolves plays AND records the render log. See breakdown below. **v55 ROUTE TREE** (`ROUTE_TREE` / `mkRoute` / `R_DEEP`,`R_MED`,`R_SHORT`): 45 shapes × 3 releases × 3 depth tiers = 405 combinations; each shape declares a `tail` (go / across / out / settle) so a finished route keeps working instead of parking. Every pool name must exist in `ROUTE_TREE` — `cross` once did not and fell through to a straight line. Debug capture via `window.__ROUTE_DEBUG`; guarded by `scripts/routecheck.mjs`. **v56 REACTION** (`routeReactDelayV56`, the `rxq`/`iq` split, `RX_POS_V56`, and the perception-action hold in `mv`): `reactMs` is consumed at last — a defender whose intent swings past `TU("reactGate")` keeps steering on the old heading for `reactMs` scaled by the swing, with a refractory window. **Defence only** — offensive players are executing a called plan, not reacting. Only the steering vector is held; holding the remembered intent too makes every tick re-trigger and the defence stops covering entirely. Guarded by `scripts/reactioncheck.mjs`, which asserts the scoreboard alongside the timings. |
| 2138–3538 | `GRIDIRON live-field bridge v3` | Minified Phaser bundle (**do not edit**), then the broadcast renderer: `LiveField` scene, `PJ` sim→screen projection, `fireEvent` (event → on-field FX/pop-text), sprite pose state machine (`tackleSeq`, dive/grab frames). `RIB ART` atlas + 40-palette team recolor. **v45 REFEREE CREW** (`spawnRefs`/`updateRefs`/`placeRef` + `refThrowFlag`/`refSignalTD`/`refWhistle`/`refNearest`, anchor `v45 REFEREE CREW`): a render-only 7-official layer in `this.refs` (never sim actors, no stats) that trails the ball, throws flags, whistles the dead ball and signals scores. **v49 REF ART** (anchor `v49 REF ART`): the crew is drawn from its own officials sheet (`RIB_META_REF` / `ribCellRef` / `ribRegisterRefs`, `window.__RIB_REFS_V49`, 64px cells) — NOT recolored, since officials wear one kit; `ribRegisterTeam` short-circuits for `team === "ref"` once the sheet decodes, and the old `ribZebra` player recolor stays registered only as the never-decoded fallback. **v57 CROWD** (anchors `v57 CROWD ART` and `v57 CROWD STANDS`): real stands in the apron outside both sidelines, from their own sheet (`RIB_META_CROWD` / `ribCrowdStrip`, `window.__RIB_CROWD_V57`) in three density tiers x idle/cheer. A stand is a WALL, so it cannot go in `warpField`'s row loop (one depth per row); `buildCrowd`/`crowdSection` sweep each WALL of the bowl in COLUMNS instead — sample depths spaced uniformly in screen Y (`crowdInvertC`, the same bisection `warpField` uses), project each through `PJ` for a ground point and the ratio `k`, and map the art onto the resulting thin quads with a three-point affine, so the tiers converge on the yard lines' own vanishing point. The source column advances with the **integral of k**, not field distance — advancing it linearly squeezes each spectator horizontally where the sideline foreshortens; ∝k makes the horizontal texture scale match the vertical one. Height then derives from the art's aspect (`crowdHeightK` trims it), and `crowdDecks` stacks the strip — by the **seating pitch** from `cellmap[4]`, not the cell height, or turf shows through between decks. Cheering is an alpha CROSSFADE per section (`updateCrowd`), not a redraw — geometry rebuilds once per snap, the crowd reacts every frame. `crowdReact` (called from `fireEvent`) starts a roar at the play and `crowdCheer` rolls it down the sideline as a wave. v58 generalises the sweep to a **wall list** — two sidelines plus the FAR end zone (a near-end wall is behind the camera and, being a billboard, would rise over the field). End-zone walls sit at one depth, so `k` is constant and the k-integral mapping reduces to linear there. `NSTOP` is **340**, not 30: the end-zone stand projects ABOVE the far end line and needs headroom inside the world, and `warpField` paints that band as the dark beyond the stadium rather than stretching the art's top row. `ribCrowdArchitecture` adds concourses / stairways / vomitories in strip space (stairs align vertically across decks — that unbroken line is the 3D read), and the strip lays **solid structure down first** so the art's stairwell wedges and tile seams cannot show turf through the crowd. **v59 CROWD AISLES** (anchor `v59 CROWD AISLES`): the flights are drawn over the finished stand, so the seats under them are cleared first — `ribCrowdAisle` builds one bare-bench column by taking, per SCANLINE, the emptiest stretch of that same line of the tier's cell (per-scanline is the trick: a stand with no empty column anywhere still has an empty stretch on every individual row), and the strip lays that one patch into every aisle on every deck. Same patch everywhere = the flights are identical and evenly pitched; `ribCrowdStairs` is the single source of the layout both the clear and the draw read. The aisle's outer edge carries a handrail because in the packed tier that edge has to fall through someone. `ribCrowdTrim` measures the cell's own end stairwells (a stairwell has no faces in it) and the strip tiles the SEATING only, so the art's diagonal end flights stop scattering a second stair system through the stand; the trim is the max over the tier's two poses or the crossfade would slide. `crowdGap` was 56, not 112 — lateral spread is `1.885*k*(HALF+GAP)` against a ~400px half-frame, so the apron decides whether the stands are on camera at all (v78 takes it to 104, because the team area now has something in it). **v63 BOWL + VOICES**: the far end is no longer a flat wall — the sidelines stop `crowdCornerR` short and the end is one superellipse sweep (`crowdBowlN`) whose ends land ON the sideline ends with matching slope, so the bowl closes tangent-continuously; `crowdEndGap` is 44 (not 16) because a big corner radius cuts the field's corner otherwise, and a hard guard forces the curve behind the end line wherever it is laterally inside the touchlines. HH is now solved ONCE from the sidelines and every other wall gets the texture span that matches it (`dc = stripH*seg/(HH*k)`) — solving it per wall is what made the end-zone crowd a third the size of the sideline crowd. Rake is per POINT (per section notches the skyline at the corners). `crowdBubble` pops short crowd shouts from on-camera sections only, anchored on each section's `mx/my` mid sample. **v60 CROWD 2.5D**: the slice affine's third mapping carries a RAKE — `(c,0)` lands `crowdRake*h` OUTBOARD of the base rather than straight above it, so the stand leans away from the field as it rises (outboard only; the dev check asserts the inboard edge never moves). It also un-degenerates the near sections, whose box collapsed to a ~7px sliver that drew nothing. Each section then gets an aerial-perspective gradient ramped between its own end depths under `source-atop` (smooth inside a section, continuous across joins since neighbours share a boundary sample; flat on an end-zone wall, where k is constant), plus `crowdSideShade` to split the two banks. `ribCrowdArchitecture` adds the tier overhang shadow under every concourse and the front fascia; `ribCrowdStrip` lays a rear wall into the headroom above the top deck BEFORE the art, so cheer arms still break its skyline. Zoom: stands fill the frame edges at the ~0.9 base, open to the whole bowl at `zoomLockMin` 0.6, and leave frame past ~1.2. **Gotcha:** `crowdDepth` (3.45) must stay above `fieldLines` (3.4) and below the ground shadows under players (3.5) — the LOS/first-down markers paint on the ground past the sideline, and the stand has to OCCLUDE that reach rather than be painted over. `crowdGap` is the **team area**: the apron v78 populates, and it doubles as the on-screen framing dial (see v59). Render-only: no sim actor, no stats. Guarded by `scripts/crowdcheck.mjs`. **v78 SIDELINE** (anchors `v78 SIDELINE ART` and `v78 SIDELINE`): the apron itself, filled. One rect-keyed sheet (`RIB_META_SIDE` / `ribCellSide` / `ribRegisterSide`, `window.__RIB_SIDE_V78`, packed by `scripts/spritekit/pack_sideline.mjs`) holds 83 cells — ten coaches, ten trainers, benches, hydration, medical, equipment racks, storage, coaching tech, the chain crew's markers. `buildSideline` (called from `drawField` right after `buildCrowd`, so it rides the same rebuilt perspective) lays them out in three lanes measured outward from the touchline as fractions of `crowdGap`: `sideLaneEdge` (.32, the boundary — coaches, trainers, backups), `sideLaneBench` (.62, the bench row) and `sideLaneKit` (.88, equipment). Positions are a fraction `t` along a team area spanning the 25 to the 25 (`sideAreaYd`), so retuning the apron or the span moves the whole sideline together. Everything is a BILLBOARD through `crowdProject` — deliberately NOT the crowd's slice affine, since a stand is one continuous hundred-yard surface that has to be mapped while a trunk is a metre wide and reads from any angle. `sideArtScale` (.5) is the one number tying the sheet to the players: the art packs a standing figure at ~92px, twice the 48px player cell. **The staff are not recolored** (one drawn kit, same reason as v49's officials); the **backups are the sim's own player textures**, so `ribRegisterTeam` already dressed them, and a bench is keyed on a WORLD side of the stadium — key it on the screen side and both teams change benches at every change of possession. **Gotcha:** `sideDepth` must sit between `crowdDepth` (3.45) and the ground FX (3.5), so a bench occludes the stand and the LOS line extension behind it while a player on the field always draws in front of the furniture. The layout is SEEDED (`sideRng`) because the geometry is rebuilt at every snap and an unseeded sideline reshuffles the bench on every play; only `sideChainCrew` moves, off `_lastField` and the payload's `down`. **v79 LIGHT & LIFE** (same anchors): the band is GROUNDED — `sideShadow` puts a contact ellipse under every sprite, `sideShadeBase`/`sideRelight` run everything through the players' own v29 depth-falloff + ball-spotlight tint plus the crowd's aerial fade and `crowdSideShade`, and warpField paints the white boundary border, the dashed coaches' box and the kit-row grounding shade into the turf (they are ground, so they ride the row loop; lateral placement is the exact PJ formula, `canvas x = CW/2 + (v−MIDY)·1.30·spread·OA·k`). SEATED + WATCHING: seating is COMPACT (two-seaters, stools, chairs; the five-man bench cells stay packed but unplaced — a full-side-view bench laid as a billboard runs ACROSS a lane that runs up-screen and reads angled ninety degrees wrong), each sitter rides his seat's own u with a positive `dbias` (in front, backrest behind him), `setCrop` at the knee plus a small drop so he ends at the seat line instead of pushing his feet through the turf, in PROFILE facing the touchline (`fieldFlip` — unflipped side art faces screen-left, so flip on the screen-left bank, resolved through VDIR because the camera swinging ends is exactly when "toward the field" flips). Standing backups default to the same watching profile (`sideWatchP`, one in five turned for texture). FACING: `face` art mirrors per BANK on the same rule. **v80 LATERAL CALIBRATION + FACING** (anchor `v80 LATERAL CALIBRATION` in PJ): the art paints its touchlines to true scale, ~16% wider than the raw lateral map put F_TOP/F_BOT, so the sim "stepped out" four yards inside the painted boundary; `latCal` (1.16) scales the one place world-lateral becomes screen-x (PJ, crowdProject, the sideline clamp, the warpField apron paint), so the sim boundary lands ON the painted line — `sidePaintHalf` collapses to 206 (= the sim half-width, equal by construction) and sidelinecheck's luminance probe gates the coincidence. **Gotcha:** `crowdProject` carries NO VDIR mirror (PJ does) — a bank's screen side IS its world side, always; facing logic must never carry a VDIR term, and the first cut did, which turned the whole sideline away from the ball for half of every game. The check asserts each bank's mirror by SIGN. **v79.2 THE PAINTED LINE**: the field ART paints its touchline ~35 world units outside the sim's F_TOP/F_BOT (v72 reconciled the rows, never the columns), so everything here anchors on `sidePaintHalf` (240.5, measured off the warp canvas; /spread because the FX scales the projection's lateral map but not the art's) instead of HALF — lanes, chain crew, yard markers, the turf paint, and the pylons, which stand ON the painted corners via `onLine` (the one exemption). Every other placement runs through an off-the-field CLAMP in `sideItem`/`sidePlayer`: the sprite's whole drawn box (full frame width — conservative) is pushed outboard until it clears the paint by `sideLineMargin`, so no retune or jitter can put a shoulder over the boundary; `sidelinecheck` measures the worst per-sprite overhang in screen px. The v79 solid white border is deleted — it painted a phantom boundary in the grass between the two lines. ALIVE: `sideReact` (fed from fireEvent beside `crowdReact`) drives a decaying excitement into the sway; `updateSideline` also scatters boundary figures ahead of an out-of-bounds carrier (screen-space `_scat`, the seeded layout never moves) and throttles `sideRelight` so the spotlight rides the ball; a knot of people anchors to `losU` and walks with the drive; Yr exposes its weather roll as `window.__WX_V79` (rain → ponchos, no towels; snow → extra heaters, no fans). `ribSideStaffTint`/`ribRegisterSideTeams` (in the ART block) recolor ONLY the staff kit's drawn navy to each team's primary — multiplying the whole sprite is what turns khakis and skin to mud, and is why v78 shipped untinted. The seed now includes the season week (per-game variety); bob phases are index-seeded (a rebuild used to reroll `Math.random()` phases and teleport every figure mid-sway); a per-lane separation pass holds a minimum gap; sub-4px far-end props are culled (people and field markers exempt, `keep`). `updateSideline` is one sine per figure — still the whole animation. Guarded by `scripts/sidelinecheck.mjs`. **v95 THE CALLOUT WALL** (`BADGE_BOOK_V95` / `BADGE_PROMO_V95` / `BADGE_V95`, anchor `v95 THE CALLOUT WALL`, just before `class Dt`): the drawn badges as a tiered presentation layer over the field, fed from `fireEvent`, `celebrate`, `badgesPresnapV95` and `badgesWhistleV95`. See **The callout wall (v95)** below. |
| 3539–3636 | `rib-v1520-phaser-launcher` | Phaser boot/launcher. |
| 3638–5513 | `v18 CHOICE EXPANSION` | The **career app** (dense, mostly one statement per line): screens/state (`o`), story arcs, roster builder `Wr`, stat-line builder `qi`, and the **v16 emergent game engine** `Yr` (see below). **v52 NATIONAL RANK**: one population model — `NAT_POOL(level)` is `A[level].slots`, `POS_POOL` is that split 9 ways, and both the leaders board (`kr`/`Ii`) and the rank card (`sn`) read them, so no two screens can quote different denominators. `sn()` anchors standing on `kr()` — the leaders board's own production rank — and scales it by the rating **in rank space** (percentile space is useless in the tail). Debug surface: `window.__RANK_V52`; guarded by `scripts/rankcheck.mjs`. **v77 THE DECLARE IS THE CAREER** (anchor `v77 THE DECLARE IS THE CAREER`): both declare paths — `Ar()` from the hub and `Vl()` from the season-result card — now route a miss through `failDeclareV77`, which ends the career instead of banking a Determination bonus and granting another season. `Ol()` (view `declineResult`) is no longer a two-mode screen; it is the epitaph, and it reads `careerTotalsV77` / `bestSeasonV77` out of **`seasonLogV77`**, a new per-season archive written once from `fs()` (the game previously kept only `seasonStats` — the season just finished — and `career`, one row per LEVEL, so "your best season" was unanswerable). Rates flagged in `Ne[pos].stats` are AVERAGED across the seasons they were measured in; everything else is summed. Story overlays are suppressed on `declineResult` for the same reason they are on `gameover`. Debug surface `window.__CAREER_V77`; guarded by `scripts/declarecheck.mjs`. |
| — | `v51 PREGAME WHEEL` | The weekly game-plan decision, rolled on the shared wheel instead of v41's silent auto-pick. Reads the deck off the rendered `.gameplan-overlay` (id, icon, `--planColor`, UPSIDE/CONTROL/RISK bars), weights by the same appetite formula as the v16.6 story wheel, resolves with `bandOdds`, and grants a one-game effect via `applyOutcome`. Shortlists a 10-plan deck to 6 (scout pick pinned) and states the cut. Falls back to the v41 auto-pick if the deck can't be parsed. Note `chooseGamePlanV11` is itself wrapped by the v1514 players-to-watch panel, so choosing a plan opens that before the match. |
| — | `v50 SPEED THROUGH` / `v50 SPIN WHEEL` / `v50 FIT ROLL` | The decision layer, three separate systems. **SPEED THROUGH** (`window.__DECIDE_SPEED_V50`): every rolling decision schedules its delays through `DS.wait()`, so a tap anywhere multiplies the *remainder* by `TU("decideSpeed", 5)`; shared by the v16.6 story wheel and the v50 growth wheel. **SPIN WHEEL** (`drawWheel`/`spinWheel` in the v42 block — `spinWheel` is the shared renderer, `showWheel` its growth adapter): a real canvas wheel where each option's **wedge arc is its personality weight** (`o.w/tot`), landing on the seeded pick so careers still replay identically. **FIT ROLL** (`jiveOf`/`bandOdds`/`jiveTraits`): the +/neutral/− band is its OWN roll — near-even thirds for a character with no opinion, swung hard by `jive` (the landed theme's weight against a neutral persona's, using the theme's own weight function). Prestige, coach trust, form, fatigue and tier risk survive as a bounded ±.22 nudge. **v62 PERSONALITY GRIP** (anchors `v62 PERSONALITY GRIP`, `v62 THE SECOND ROLL`, `v62 PLAN KINDS`): wedges are the appetite raised to `wheelPersonaPow`/`planPersonaPow`, then lifted to `wheelWedgeFloor` so nothing sharpens into an invisible arc. `traitLedger` exploits the fact that every theme/plan weight is LINEAR in the sliders — a trait's contribution is `w(P) − w(P with that slider at 5)` and they SUM to the whole — and `jiveFrom` turns that into jive plus a per-trait ledger in points-on-PAYS. The band roll now opens its own pop-up (`#gv62roll`, a child of `#growthV42` so teardown is unchanged) with a needle that settles in the band that came up. The pregame wheel classifies each plan by `PLAN_KIND` (what it ASKS of the player) instead of by boldness alone, which is what stopped four different plans drawing the same wedge. Debug surface `window.__PLAN_V62`. **v61 WHEEL FINISH** (anchor `v61 WHEEL FINISH`): the rim, hub and pointer are DRAWN, not blitted — `wrim`/`whub`/`wblade` plus the shared `wsweep` conic (linear fallback). The key light goes down BEFORE the sweep or the lobes wash flat. Slim ring means `Rw` is 0.915R (0.74R only when `TU("wheelArtHardware")` restores the gold sheet set), and the wedge ramp is pulled toward black — hues are untouched because `wheelcheck` classifies the face by HUE at 0.30R, and uniform scaling preserves it. **v64 SKILL ART** (anchor `v64 SKILL ART`): the twelve training themes are drawn from `RIB_META_SKILL` / `window.__RIB_SKILL_V64` (uniform 144px cells, 4x3) instead of emoji. `sart()` blits a cell to a canvas (the wheel face, on its own soft shadow so it reads over a saturated wedge); `skillIco()` returns the DOM markup for the option rows, roll-pop-up header and result card, addressing the SAME atlas from CSS via a `--skillArt` background on the root plus a per-theme `background-position` — one image, no canvas per row. Everything falls back to the emoji when the sheet has not decoded. Mapping lives in `ORDER` in `scripts/spritekit/pack_skills.mjs`; `lab`, `mentor` and `social` have no scene of their own and take a near fit. **v65** (same anchor): the art also reaches the OTHER screen a season's training is chosen on — the legacy career app's offseason "Choose Your Training" board (`jr()`, view `training`, entered by `window.startSeason`). That board lives in a different scope, so the `.gv64-*` rules were hoisted out of the wheel overlay into one document-level `#gv64css` sheet and `skillIco`/`sart` are exported as `window.RIB_SKILL_ICO`/`RIB_SKILL_ART`; the board's own twelve keys reach the cells through `SKILL_ALIAS` (`tp_*` → cell), paired by what each scene DEPICTS, which is why `tp_lab` (Recovery Lab) takes the ice-bath cell packed as `social` and `tp_grind` takes the tyre-flip cell packed as `lab`. A DOM icon no longer waits on `SART.ready` (only on `SART.failed`) — a CSS background does not need our decode, and gating on it raced a board that can render on the same tick as page load. The atlas gutter is 9%, not 4%: a CSS background addresses cells by percentage at the device's DPR and samples past the boundary, so a thin gutter put a sliver of the neighbouring scene down every tile; it also serves as the hold-off from the tile's corner radius, so neither consumer pads, and `TU("wheelSkillPx", 2.19)` re-enlarges the wheel-face blit to match. Covered by `scripts/skillartcheck.mjs`. The wheel draws from its own art sheet (`RIB_META_WHEEL` / `wart()` / `window.__RIB_WHEEL_V50`, rect-based cellmap — rim, hub, four pointer-deflection frames, twelve theme icons, three outcome seals), and every draw falls back to the procedural shape it replaces. The wedge under the pointer pops (`liveWedge`, `TU("wheelIconPop")`). Palette: one deep base hex per theme in `WCOL`, every tint/shade derived via `wshade()` (radial ramp + vignette + outer-half sheen); the dev check classifies the face by HUE, which uniform scaling preserves, so shading can change freely without breaking it. Dials: `growth_jive` in Settings, `TU("decideSpeed")`, `TU("wheelIconPop")`. |
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
- **v81 BALL AWARENESS** (anchors `v81 BALL AWARENESS — the defence has to FIND the ball`
  and `v81 THE POINT OF ATTACK`, both inside `sim()`; the renderer's cases sit under
  `v81 BALL AWARENESS — you can watch the defence find the ball`): every defender gets
  `_readMs` (awareness-led, position-scaled, jittered) and `_seenAt = declareT + _readMs`,
  where `declareT` is when the play declares itself — early for a straight run, the late
  mesh for a draw, the QB pulling the ball back for play action. `seesBall(a)` gates the
  carry loop: until it is true a man plays his ASSIGNMENT (LB read step, safety keys the
  back, force corner squats, freed rusher chases what he can see); once the ball is past
  the line (`ballVisibleLx`) everyone sees it. `keyTick()` emits `keyLook` at the snap
  (the renderer's "?"), `keyRead` when the diagnosis lands, `keyBite` for a man who bit
  on a fake. After the read: linebackers FIT their gap at the line (`lbFitLx`) before
  they chase; the play-side safety fills while the other is the roof (`_roof`); pursuit
  runs a COMMITTED LINE (`_aimX/_aimY/_aimUntil`, refreshed on `angleRefreshMs` less
  awareness — always every tick inside `angleLockGap` and for the last man). Blocks:
  `rollBlockV81(o, r)` at the mesh returns stalemate / push / drive / lost / pancake with
  a wash direction away from `holeY` (the concept picks the gap via `GAP_Y`); the carry
  loop plays the block out over `blockPlayMs`, frees the rusher on a lost block, and
  RELEASES a lineman once the ball is `releasePastPx` past him, after which he climbs
  to the nearest live defender (`climbReachPx`, `_climbedBy` prevents stacking). The
  back attacks `holeY` first and re-reads gaps every `laneHoldMs`. Receivers stalk-block
  (`stalkReachPx`, capped by `stalkHoldMax`); the backside receiver runs his corner off.
  A HELD defender (`held`) crawls but can still fall off onto a runner inside
  `heldReachPx`. **Gotchas found here:** (1) the committed-tackler role
  (`committerId`) must belong to a CLOSING man — a released lineman trailing the play
  used to take it from launch range and the support rule then held every other
  defender a stride off the carrier (untouched 80-yard runs); it now requires
  `commitMinVel`, is taken over by anyone closer, and drops on `commitDropGap` /
  `commitMaxMs`. (2) The per-tick pancake roll in `pancakeTick` was `.0009*(edge-10)`,
  which flattened a man on a third of a dominant line's snaps; `pancakeTickK` is .00012.
  (3) Passive second-level defenders (a safety holding a 44px cushion) are what turns a
  broken tackle into a touchdown — the roof is ONE safety, and he pursues once the ball
  is out. The you-player's stats are untouched: awareness (recognition), quickness
  (redirect) and discipline (fake resistance) are the three that pay here, the same
  three the v56 route-break reaction uses. `__FieldSim.run` takes the concept
  (`inside|sweep|power|draw`) and `.pass` ctx carries `pa`; `Yr` rolls play action on
  early downs (`paRate`) and prefixes "Play action — ". Debug: `window.__V81_TRACE = []`
  collects per-tick pursuit rows (id, gap, committer, aim, vel). Guarded by
  `scripts/readcheck.mjs`.
- **v82 — the ten systems** (anchors `v82 THE FRONT HAS A PLAN`, `v82 DISGUISE`, `v82 THE CHIP`,
  `v82 THE TWIST`, `v82 THE PROTECTION CALL`, `v82 STEP UP`, `v82 THE SACK HE TAKES`,
  `v82 BALL SKILLS`, `v82 3.5) BOUNCE`, `v82 EFFORT`, `v82 THE PILE`, `v82 THE BACK HAS EYES`,
  `v82 LEVERAGE`, `v82 SPECIAL TEAMS`). Pass setup rolls `stunt` (looper + penetrator, resolved
  at `stuntLoopMs` by a pass-off roll off the two linemen's awareness), `spy` (an LB on a QB
  with `spyQbSpd`+ speed, attacking once the pocket moves), `protection` (`slideReadBase`
  + centre awareness; a read slide lets a lineman pick the blitzer up at `slidePickP`, a
  missed one sends the back the wrong way for `wrongSlideMs`), `chipper` (the TE holds the
  edge for `chipUntilMs` — chipped rushers cannot shed) and `disguise` (a robber rotates at
  `rotateAt`; press corners jam at t=200 on `jamBase` vs agility, `jamMs` slows the route,
  `jamSep`/`beatPressSep` move the window; a rotation over the target's route fools the QB on
  `disguiseFoolBase` less awareness and costs `disguiseSep`). The QB climbs on edge pressure
  (`stepUpPx`), rolls on `rolloutRate` (throws count as moving), and takes the sack on
  `takeSackP` when smart (`sackSmartAware`) — `out.sack`/`out.sacker` flow through
  `__FieldSim.pass` to `b()` in `Yr`, which books it like a trench sack; the choreographer
  accepts a `sack` event for the pass log. Catch point: `boxK` (body between man and ball),
  `comebackK` (underthrow), `swatP` on a contested window (`contestSep`, `swatBase`).
  Contact adds `bounce` (glancing side hits, `bounceBase`) before the stagger; the coast
  adds `pilePush` (cosmetic — yards are booked before it). Pursuit: `jogGap`/`farSideY`
  drop a beaten or far-side man to `jogPace`, `tiredGas` costs `tiredPace`; the last man
  never jogs. Run game: `liveIn` projects each defender `lookaheadS` ahead along his
  committed line, `sealed` gaps behind a held blocker sort first, `press` fires when the
  designed hole is closed and the back bounces; `rollBlockV81` rolls `reachP` and flips the
  wash (`lev: "lost"`) when the head does not get across. **Balance gotcha:** every evasion
  after the first is cut by `evadeRepeatK` — without it an elite back strung together four
  one-on-ones and the check roster ran at 10 YPC while the in-game roster ran at 3.
  **Special teams** (`sim("punt"|"kickoff"|"fg")`): formations are laid over the eleven
  standard slots (QB = kicker/punter, RB = holder/personal protector, S = returner, WRs =
  gunners/wings) so the you-player keeps his slot; phases `kickset` (protection vs
  `kRushers`, wings on the edge, `kickBlockPx`/`kickBlockP` at `puntKickMs`/`fgKickMs`) →
  `kickfly` (coverage runs `_laneY` narrowing on the returner, jammers via `blockTick`,
  the returner settles and fair-catches inside `fairCatchPx` on `fairCatchP`) → the carry
  phase with `isKick` tweaks (linemen are chasers, the last man by `dirSign`, `held`
  coverage, the return team blocks with `blockTick`, `goalLx` ends a housed return). **The
  sim clock runs ~2.5x real** (a sprint is 25 yd/s), so hang times are `puntHangBase`
  ~1.25s and `kickoffHangBase` ~0.9s, and a field goal is kicked at 640ms — the first cut
  used real-time hangs and 85% of field goals were blocked. `__FieldSim.punt/kickoff/fg`
  return `{ret, fair, blocked, td}` / `{blocked, good}` and push logs with kind = event;
  `Yr` calls them from the punt branch, `kickoffTo` (which now pushes an `event:"kickoff"`
  play when the sim resolved it) and the FG branch; the choreographer's `kindWant` takes
  kick logs. Special-teams tackles are deliberately not credited to the box score
  (`creditcheck`'s sim truth counts scrimmage wraps).
- **v83 BLOCK FACING + 2.5D** (renderer anchor `v83 BLOCK FACING + 2.5D`, next to `faceMarker`):
  `pairUp(i, j)` / `unpair(i)` keep `m._pair` from the sim's engagement events; in
  `placeMarker` an engaged marker faces its partner in SCREEN space (through `PJ`, so it
  is NS-aware), takes the block state whenever it is slow and paired, cycles the block
  frames at `blockDriveFrameMs` when the pair moves faster than `driveSpd`, is nudged
  `engageSpread` px to a stable side (lower slot left), and — offence only — lifts by
  `engageLift` in depth. A pair breaks itself when the two drift past `engageBreakPx`.
  The sim side is only events: `engage {pairs}` at the snap (scrimmage and kicks),
  `stuntPassOff {pairs}` on a passed-off twist, `pickup {by, on}`, `disengage {who, by}`
  when a lineman releases once the ball is past him.
- `breakProb`, `turnTest` — pure formula hooks for unit checks.
- `fieldGoalRows()` / `fieldArtY(u)` (anchor `v72 END-ZONE MAPPING`) — the turf art
  is sampled by its GOAL LINES, not by its full height. The art has a real ten-yard
  end zone at each end AND an apron outside it, so mapping the image's height onto
  the world's width put every painted yard line off the sim's own. The rows are
  measured off `RIB.fieldBase` — **not** `RIB.fieldImg`, which v44 has composited
  the home crest onto at the 50, and a crest is not grass.
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
- **…and naming him is not enough (v117).** Tracing the stat to a named actor only
  works if that actor is a man who is really out there, once. The agent builder
  (`v117 ONE MAN, ONE SLOT`, in FieldSim's `makeAgents`) used to draw roster players
  out of a per-position pool without removing them, so the you-player — placed first,
  then left in the pool the later slots at his position draw from — was fielded as two
  or three defenders on the same snap. Every check above passed, because the sim did
  name the man who made the stop; he was simply standing in a team-mate's slot. The
  draw removes what it hands out now, named picks reserve their slots before any body
  is drawn, and his slot is rolled among his position's slots rather than always being
  the first that matches. `scripts/v117check.mjs` is the gate: **if you touch how the
  eleven are filled, no roster player may hold two markers on one snap.**
- Sacks/scrambles are resolved **outside** FieldSim (trench-rating rolls), which
  is why the sacker `skr` is picked at this layer and credit follows `pe(skr)`.

## The margin curve (v76) — where a scoreline comes from

Two code paths produce a score and they must agree, because the player picks which
one runs: **watching** a week runs the live engine `Yr`, **simming** it runs the
quick generator `ia()`. Both are anchored on the same quantity — the **scoreboard
team OVR gap**, `c.us.ovr - c.opp.ovr`, the badges either side of the live score —
and both target the same curve: **~0.7 points of margin per OVR of gap, both ways.**

- `Wr(...)` builds both rosters and returns `{us, opp, usQ, oppQ}`. `usQ` reaches
  1.65 (`.42 + seed*.35 + prF*1.05`) while `oppQ` caps at .84, and every player
  attribute derives from that factor — which is the structural reason a prestiged
  save could field a different class of football team. **v76 does not change this.**
  An earlier cut compressed the two toward a midpoint and it failed twice: the two
  factors are not on the same scale, so the opponent's strength became a function of
  *our* prestige and `teamqualcheck` fell from 9.0x to 2.6x; and it compressed the
  BADGE too, collapsing the matchup range from +28 to +15, which deletes lopsided
  fixtures rather than making them closer.
- `teamPairV76(player, opts)` mirrors that arithmetic for the quick path so both
  paths agree on the badge. Exported as `window.__TEAMPAIR_V76`.
- **`prF` (the prestige/roster/tree factor) routes the TREE's share through
  `TU("teamQualK")`.** Without that the v68 team-quality nerf only ever applied to
  the score generator — the tree's effect on the live *roster* escaped it entirely.

The four levers all live in `Yr`'s closure and all act on the GAME, never the team
sheet. `_gapV76` is the gap **from the perspective of whoever has the ball** and
`_leadV76` their lead, both refreshed once per play in the drive loop:

| lever | what it damps | note |
|---|---|---|
| `dampV76(yards)` | explosive-play yardage | cut-only; a two-sided version cancelled itself out |
| third-down term inside `dampV76` | conversion rate | proportional to the gap, not a cliff |
| `toV76()` | the takeaway swing (INT + both fumble rolls) | **continuous** in the gap, so it keeps working past the range it was tuned at |
| `gtV76()` / `standV76()` | garbage time, goal-line stands | keyed on the lead *relative to what the matchup should produce* |

`toV76()` is published as `window.__toMultV76` because FieldSim resolves the
interception and has no view of drive state — the same pattern as
`window.__youStatBoostPctV20`.

Two gotchas worth knowing before retuning:

- **Yardage alone plateaus.** Across a 3.7x range of its own dial the margin barely
  moved past a slope of ~1.9. Play count and punts are *identical* between a -5.8
  and a +14.5 gap; the compounding that yardage cannot reach lives in third-down
  conversion and takeaways.
- **A saturating damper switches itself off.** Anything shaped `min(gap/FULL, 1)`
  stops damping past `FULL`, which is exactly where the blowouts are. `toV76` and
  `standV76`'s cap are continuous in the gap for that reason.

`blowoutcheck.mjs` is the gate. It scores **measured band means**, not a line
fitted across the whole range — the relationship is convex, so one straight line is
dragged up by the tail and misreports the ordinary band underneath it. Past +18 the
curve is reported but deliberately **not gated**.

## Render path (why some changes "don't show up")

Plays are resolved up-front (each pushing a log to `__FieldSim._Q`), then the
broadcast view replays them: `takeLog(sig)` matches a play to its sim log; on a
miss it falls back to `buildPlayScript` choreography. If you change sim behavior
and can't see it on screen, run `node scripts/renderpathcheck.mjs` — the sim →
render hit rate should be ~87–90%.

## The silent week (v85) — how a simmed game is booked

Anchor `v85 THE WHEEL SPINS IN THE BACKGROUND` (career block, just before the v11
`Object.assign(window,{chooseOriginV11…})` export) and `v85 THE DECISION, WITH NO
WHEEL ATTACHED` (inside the v51 pregame-wheel IIFE).

A played week runs one chain: `$t` renders the plan deck (`bs`) → the v51 wheel
reads it, picks by personality and rolls the fit band → `chooseGamePlanV11` (wrapped
by v1514's pregame panel and v50's fate roll) → `Nc` → `ca(e,week,plan)` books the
engine game (`__aiSeasonGame` → `__simGameV2`) → `Yt` → `po` (the pre-v11 `lt`)
marks the week played. `silentWeekV85(e,w)` runs that same chain with the UI told
to stand down: it renders `bs(false)` into a detached element, hands it to
`__PREGAME_V51.silentPlan` (`decidePlan` + `applyDecision`, the wheel's own math),
records `w.wheelV85`, sets `window.__silentSimV85` so the v1514 wrapper calls
straight through, and calls `chooseGamePlanV11(plan,false)`. Quick play goes through
it from `$t` (dial `quickSilent`); "Sim Remaining" is the v11/v12 `wt` wrappers
looping it, stopping where a played season stops (a story or life decision queued,
an NFL offer on the table). Do not add a third `wt`: the v12 wrapper is the one
that runs.

The live week books twice by design: `ca()` pre-books an engine game when the plan
is chosen, `lt(true)` runs a second `Yr` for the broadcast, and `Ea` →
`bookLiveGameV85` overwrites the pre-booked stat line and score with the game that
was watched, moving `perf` by the grade difference (`gradeGame`, the same dev/win
terms `__aiSeasonGame` uses). Anything that reads a played week's `statLine` after
a live game gets the broadcast's box score.

## The sheet (v85) — effective values and the projection

Anchor `v85 THE BODY ON THE SHEET, AND THE SEASON AHEAD` (just before `Vr`).
`effAttrsV85(e)` = `round(attr × condMultV54(e)) + this game's _tempStatBuffsV25`;
`bodyBadgeV85(e)` is `bodyLedgerV73` in one line; `projectSeasonGainsV85(e)` is
`tt(e)`'s gain formula with the dice removed (expected season average from the
weeks played and the `et` mean for the weeks left, playoff wins from
`playoffState`, injuries so far, training focus/priority/cost, the ceiling `k` and
the diminishing term, the fractional `growthBank` carry). **If the gain formula in
`tt` changes, change it here too** — the projection is a copy, not a call, because
`tt` mutates the player. `sheetCtxV85` memoises both per render (keyed on fatigue,
injury, buffs, training, weeks played, attribute sum). `projectSeasonGainsV85(e,training,preseason)` also serves the offseason board
(`jr`): `training` projects a program other than the chosen one, `preseason` treats
the whole schedule as ahead (the board is chosen before the weeks exist). `Vr` draws the cut/lift as
`.loss`/`.gain` segments on the track and the projection as a hollow `.proj`
extension with a `▹+N` label; the same effective values feed
`pregamePlayerStatsV25`.

## Between the whistles (v86) — the renderer's post-play, pre-snap and tackle styles

Anchor `v86 BETWEEN THE WHISTLES` (in `LiveField`, right after `update`). A play's
script ends at `S.duration`; before v86 `update` posted the ribbon and called
`complete()` 260 ms later, and the next play's glide started from the tackle frame.
Now `update` returns early into `updatePostV86` while `P.post` is set: `startPostV86`
marks who is grounded (`tackleSeq`/`down`/`dive`/`pancakeSeq` or a recent
`_groundT`), gives each marker an `up` delay (tackler first, carrier later) and a
gather target on his own side of the spot (`P._refBX/_refBY`, the crew's ball
spot), releases grabs/blocks/pairs, leaves the ball on the ground at the spot, and
`complete()` fires when the phase's `ms` elapse. `postPlayMsV86` returns 0 (the old
path) for kicks, scores, penalties and reduced motion. Everything else is a hook:
`presnapV86` (called while `!P.snapped`, keyed off the script's `snap` event time),
`qbTickV86` (after actor interpolation; sets `m._dropback`, the hitch tween,
`m._lean`), `case "tackle"` classifies `tstyle` from the tackler's bearing against
the carrier's heading `m.hd` and handles the QB slide, `case "tip"` runs the reach,
the ball block sets `m._lookAt` on the target while the ball is up, and
`placeMarker` honours `_dropback` / `_lookAt` for facing, `_lean` for rotation and
stretches `m.shadow` by `payload.quarter`. Wear lives in `this.wearV86` (field
space; `addWearV86` merges nearby marks) and is redrawn by `drawWearV86` from
`animatePlay` after `drawField`, wiped in `renderStatic` or when the quarter goes
backwards. Per-play marker flags are reset in the glide loop of `animatePlay`.
Counters for the check live on `window.__V86`.

## Credit by alignment (v87) — who is on the target

Anchor `v87 WHO IS ON HIM` (FieldSim `sim()` pass setup) and `v87 THE QB SEES THE
LANE` (the throw block). The engine's pass resolver `b()` still picks a target `g`
(the you-receiver gets a targeting share) and a defender `N`, but `N` is only the
box score's expectation: `pass()` no longer moves him into a coverage slot and the
sim assigns `coverA` as the CB/S/LB aligned closest to the target at the snap. `N`
itself never picks the you-player (`others=T.def.filter(z=>!z.you)`), so the formula
fallback cannot credit you either. A pass break-up is `X.swat` (the sim's swat by
`X.cover`), the legacy run fumble names nobody, and pressured passes now go through
the sim (`ctx.pressured` reaches `underPressure`). In the choreography and the
bridge, `pickFrom` returns the FIRST slot of your position (your roster slot), the
legacy target is your slot only when `payload.involved`, and `userDefId` (the
fallback's "you make the stop") also requires `payload.involved`.

The QB: at the throw decision, `laneAhead` is true when no unengaged defender sits
within `scrLaneYd` ahead and `scrLaneHalf` across; with the primary not open
(`sep < scrSep`) he tucks it with probability `scrOppBase` + athleticism − a spy
penalty, emitting `scramble{opportunity:true, lane:true}`; `pass()` books it as
`X.scramble` and the engine's new branch mirrors the formula scramble with the
tackler named by the sim. The check-down goes to the back only if he has released
and is ahead of the passer; any target behind the passer is re-read to the best
graded man ahead (`_gradesV87`) or thrown away. The `throw` event carries `behind`
for the check.

The safety: before the downs bookkeeping, a run/pass/scramble/sack whose
`pre.pos + de <= 0` scores two for the defense, spots the ball at the 1 and flips
possession as a free kick to the other side's ~40 (`flip`), with `safety:true` on
the play and "SAFETY" in the desc (the ribbon reads it).

The huddle: `planHuddleV87` runs inside `animatePlay`'s glide branch and stores
`P.hud={a,b,cx,cy}`; the gliding branch of `update` jogs each marker to `m._hud`,
holds it facing the middle until `b`, then `huddleBreakV87` and the existing jog to
`m._jog`. `drawGoalpostsV87` is painted after `drawField` in both `animatePlay` and
`renderStatic`.

## The call-up (v88) — promotion odds

Anchor `v88 THE CALL-UP FOLLOWS THE RANKING` (career block, next to `Ar`).
`rankCurveV88(rank, of, level)` is the whole model: `top = (rank-1)/of` against the
level's advancing share `ADV_V88[level]`, through `50 + 49.5·tanh((adv-top)/(adv·advSoft))`.
`rankChanceV88(e)` feeds it `sn(e, ae(e))` (the same rank the hub shows);
`declareChanceV88(e)` is `max(min(97, base + declareBonus), rankChance)` where `base`
is the season's own `seasonStats.chance` when it belongs to this level and
position, else `qt(ae(e), level)`. `__natAdvFloor` is kept as an alias so older
callers still work, and `qt`'s internal floor is the same curve (it used to pass a
season rating into `sn` as an OVR). `Ar` (hub declare), `Vl` (season-screen
declare), the season screen's button and the hub card all call `declareChanceV88`.

## v116 — the film loops

Anchor `v116 THE FILM LOOPS` (inside the `v114 THE SPLASH IS A FILM` block — it is the same
controller, so there is no second place for the film's rules to live). The loading film no longer
stops. Both doors run it, and neither of them ever shows a still.

**The seam.** `LOOP_FROM_V116 = 6.5` seconds. The sting comes out of black, throws the streak
across the frame and finishes assembling the wordmark at about 6.5s; from there to the end at
14.5s it is the wordmark breathing under drifting cloud. So the last frame can run straight back
into 6.5s: measured on the shipped mp4, the last frame and the frame at 6.5s differ by **3.4/255**
averaged over the picture, which is under the noise the cloud is already moving by. Everything
else in the film — the black, the streak, the landing — is a one-time intro that plays once per
page load and is never seen again.

**Why not `loop` on the element.** Two reasons, both fatal on their own: a native loop rewinds to
zero, which is the second of near-black the film opens on, and it *swallows* the `ended` event.
`ended` is the thing that tells the controller to rewind, so the element stays `loop = false` and
`loopBack(v)` does it by hand — seek to `LOOP_FROM_V116`, `play()`. It falls back to 0 for a film
too short to have a tail, so swapping a shorter asset in cannot strand the playhead past its own
duration.

**One looper, two doors.** `loopBack` is exposed as `__V114.loopBack(v)` because door two plays
*this very element* (v115 parks and lends it). Door two's own `ended` listener is the belt to that
brace, and calling it twice is a no-op: `loopBack` does not re-seek a playhead already sitting on
the seam.

**What the door waits for now.** It was "the app is ready **and** the film has ended". With no end
to wait for, it is "the app is ready **and** the intro has LANDED" — `V.landed`, set the first
time the playhead passes the seam (`FILM_WAIT_INTRO = false` drops it the moment the app is ready
instead). The reason is unchanged: a sting cut mid-swoosh reads as broken. The effect is that the
splash is *shorter* than it was — the curtain can drop at ~6.5s instead of waiting out the whole
film — and any load that runs longer than that is covered by the loop rather than by a frozen
frame. `FILM_CAP_MS` (14s) is still the outside edge.

**The bar** keeps its `.20 / .10 / .30 / .40` weights, but the playhead's share now counts down to
the **seam**, not to the end: past the seam the film is looping and is no longer counting down to
anything, so a bar that kept reading the playhead would run backwards every time round.

**Door two starts at the seam.** `LIVE_FILM_FROM` is `__V114.loopFrom` rather than v115's old
1.15s. The live loader may only be open for a second and a half, and the seam is by definition the
point where the picture is finished and stays that way — so every frame that door can show is the
landed wordmark, and it rides the same loop if the door stays open past 14.5s.

`window.__V114` gains `loopFrom`, `landed`, `landedMs`, `loops`, `lastLoopMs` and `loopBack()`;
`waitEnd` is now `waitIntro`. `scripts/v114check.mjs` gates it — including a boot that defers the
app's own knock on the door by 20s, so the film can be watched running its whole length and going
round again.

## v115 — the film at both doors

Anchor `v115 THE FILM AT BOTH DOORS` (inside door two's `mount`, in the v94 block). The live
game's loader over `.field-wrap` plays the same title sting the boot splash does — as a
**backdrop** filling the loader box (`.rib-liveload-film-v115`), not as a card beside the text.

`object-fit` is **contain**, not cover: cover filled the box but cropped a 16:9 sting into a
portrait `.field-wrap`, cutting the wordmark off at both ends. The loader's ground already wears
the film's own black, so the letterbox it leaves has no visible edge. Two consequences follow
from that and are handled here: the caption cannot be flex-centred any more (it would land exactly
on the logo) so under `.film` it is absolutely positioned in the band below the picture, where the
scrim is darkest; and the loading bar is `display: none` over the film — the sting is the picture,
and the caption already says where the boot is up to (TAKING THE FIELD / WARMING UP / KICKOFF).

**Why it could not just call `play()`.** Door two mounts at the single worst moment on the main
thread: the Phaser scene booting, the sheets registering, the crowd taking its seats. A media
element's load does not *start* until the main thread lets it. Measured on a fresh element here:

```
play@23218      rs=0 ns=2 t=0.00
waiting@23218   rs=0 ns=2 t=0.00
loadstart@25884 rs=0 ns=2 t=0.00      <- 2.7s after play(), on a door open for ~4s
```

The film that is supposed to survive the jam could not get *started* through it. So the element
door one already loaded is kept rather than destroyed:

- `__V114.park()` — called from door one's `finish()` before the splash is removed — pauses the
  `<video>`, detaches it and holds it on `__V114.parked`. Fully buffered, decoder warm.
- `__V114.take(cls)` hands it to door two, which inserts it as the loader's first child.
- `__V114.give(v)` parks it again when the loader closes, so the next game gets the same warm
  element. One decoded film for the whole session, and no second request for it.

**Claim before the seek.** `claimed()` runs synchronously when the taken element already has
`readyState >= 2`, *then* the playhead is moved. A seek drops readyState for a beat, and asking
after it handed the door to the v94 chase for no reason.

**The hand-off.** A plain opacity fade left the loader sitting on the field for 400ms looking like
a dropped frame. The exit is ordered instead, and the order is the whole effect:

1. the caption drops away and goes first (`.26s`, `translateY(12px) scale(.96)`);
2. the film keeps its opacity and **swells** to `scale(1.09)` over `.66s`;
3. the layer itself fades last, after a `.12s` beat — so the wordmark is still solid while the
   grass comes up behind it, and it is the last thing off the screen.

The film is parked (`give()`) only when that finishes, not when `finish()` is called: parking it up
front detached the `<video>` instantly and left an empty black layer to fade, which is exactly the
dropped-frame look this replaces. The removal timeout (720ms) covers `.12 + .5`, and
`prefers-reduced-motion` drops the transforms.

**Three deliberate differences from door one:**

| | door one (boot) | door two (live) |
|---|---|---|
| waits for the film | yes — for the intro to LAND (`FILM_WAIT_INTRO`, v116) | **no** — the door opens on the scene standing and the first play built; holding it for 14.5s would front-load every game |
| starts at | 0 (the black, the streak, the landing) | `LIVE_FILM_FROM` = v116's seam (6.5s) — the finished wordmark, so a door open for 1.5s shows a picture |
| element | its own, loaded from the picker's `src` | the parked one |

`LIVE_FILM_START_MS` (1.2s) is door two's audition: no frame by then and the v94 chase mounts as
it always did. And if door one never played the film at all — reduced motion, `?noFilmV114`, no
codec — `__V114.on` is false, nothing is parked, and door two is exactly the pre-v115 chase.

**The splash's own framing**, fixed in the same pass: the film ran as a rounded, shadowed card on
`#splash`'s blue-grey ground (`#182338`→`#0d141d`) while the film's own border pixels sit around
rgb(4,8,11) — so the card edge was a visible seam and everything around it read as dead space.
Under `.film` the splash now wears that same black, and the film runs the full viewport width with
no radius and no shadow. The space left above and below is inherent: a 16:9 film on a 19.5:9 phone
is width-limited, and filling it would crop the wordmark — but it is now the same black as the
picture, so there is no edge to see.

## v114 — the splash is a film

Anchor `v114 THE SPLASH IS A FILM` (in the body's first `<script>`, immediately before the v94
chase engine, so door one can consult it). It replaces what the BOOT splash draws. Door two —
the live game's loader over `.field-wrap` — is untouched and still runs the chase: a title sting
belongs at app boot, not between plays.

**The asset.** `scripts/build-splash-film.mjs` cuts three files from
`art/splash/rib_loop_master_v116.mp4` (a 1920x1080 HEVC master, 20 MB for 14.5s):

| file | what it is for |
|---|---|
| `public/rib_film_v116.mp4` | H.264, 960x540, CRF 26, no audio, **`+faststart`** — the shipping path |
| `public/rib_film_v116.webm` | VP9, same frame — a browser with no H.264 (which includes Playwright's Chromium, and is the only reason `v114check` can watch a frame arrive) |
| `public/rib_film_v116.jpg` | the last frame, as the `prefers-reduced-motion` still |

Two things about the master make the re-cut non-optional. It is **HEVC**, which most of the
browsers this game runs in cannot decode at all. And its `moov` atom sits *after* `mdat`, so a
browser could not show one frame until the whole 20 MB had landed — a loading screen that spends
the load loading. `+faststart` moves `moov` to the front; H.264 at 960x540 CRF 26 takes 20 MB to
~1.4 MB. Both are what make the file a loading screen at all, and `v114check` asserts the
faststart off the bytes.

**Getting it there first, without paying for it twice.** The source is set by a small picker
inline immediately after the `<video>`, while the parser is still on the splash markup — it reads
`prefers-reduced-motion` and `?noFilmV114`, and on the paths that will not show the film it simply
never assigns a `src`. The two obvious alternatives were both tried and both rejected for the same
reason: a `<link rel="preload" as="video">` in the head and `<source>` children in the markup each
start a fetch the page cannot take back, and on a fast link the ~900 KB *completes* before any
script could abort it — so a reduced-motion user downloaded a film they were never shown.
(`media="(prefers-reduced-motion: no-preference)"` on the link is not honoured early enough to
lean on; `v114check` caught it doing so intermittently.) Deciding beside the element costs a few
milliseconds against the preload scanner — measured at 2.4-3.9s to first frame in the dev
container, against 4.5s for a `src` assigned from the main module — and buys a guarantee.
`stopLoad()` remains as the belt to those braces. The picker is also where H.264 vs VP9 is chosen,
via `canPlayType`, so exactly one of the two files is ever fetched.

**Why a film and not the chase.** Video decode is not on the main thread. The megabytes of inline
bundle below compile in one task, and the v94 chase — a rAF loop — stalls dead on exactly that
(it is what `__V112_A.mounts[n].maxGapMs` measures). The film does not drop a frame of it.

**The door.** `V.appReady(finish)` is called from `__splashDoneV94`. The curtain drops when the
app is ready **and** the film's intro has landed on the wordmark, capped by `FILM_CAP_MS` (14s) —
see **v116** above, which replaced "and the film has ended" when the film stopped having an end.
`FILM_WAIT_INTRO = false` drops it the moment the app is ready instead — one constant. The cost
is honest: a cold boot is paced by the film's 6.5s intro rather than the chase's 2.6s floor.

**Never stranding the boot.** `V.verdict(cb)` is answered exactly once — the film claimed the
stage (a first frame on screen) or gave it up. Door one does not mount the chase until that
verdict, so the two can never run together, and a film that cannot get a frame up inside
`FILM_START_MS` (3s) hands back to the chase exactly as it was. `?noFilmV114` forces that path.

**The bar.** Two layers over one groove. `.splash-loader i` is v112 A's compositor sweep,
unchanged — still the one thing that moves while the bundle compiles. `.splash-loader b` is a
determinate fill weighted `buffered .20 / v91 sheet .10 / app door .30 / playhead .40`, monotonic,
reaching 1 exactly when both conditions for leaving are met. It is a `transform` with a 1.3s ease,
so the glide to each new target runs on the compositor too and a jam mid-transition does not
freeze it either. The playhead is in there deliberately: once the bytes are in, the thing still
being waited on *is* the film, and a bar that sat at 90% through six seconds of sting would be
telling the truth about bytes and lying about the wait. (v116 stops that share at the seam — past
it there is nothing left to count down to.)

`window.__V114` exposes `on`, `failed`, `settled`, `ended`, `played`, `codec`, `progress`,
`firstFrameMs`, `endedMs`, `verdict()`, `appReady()` and v116's `loopFrom`, `landed`, `loops`,
`loopBack()`.

## v113 — the training board is a grid, and the choice is two taps

Anchor `v113 THE BOARD IS A GRID, AND THE CHOICE IS TWO TAPS` (the last block inside the
career app's IIFE, after the v15.3 patch layer). It replaces `jr`, the offseason
"Choose Your Training" screen, and nothing else: the twelve programs in `pt`, their
projections through `projectSeasonGainsV85`, the v67 cap badges and `Ir`
(`window.chooseTraining`, the commit) are all untouched.

- **The grid.** `.tp-grid-v113` is `repeat(4, 1fr)` — twelve programs, four across and
  three down, each tile the v64 scene at 46px, the program's name and its risk word.
  The tiles are still `.train-card` elements and their `onclick` still names the
  program key in the first quoted token, because `capcheck.mjs` and
  `skillartcheck.mjs` pull it out with `/\D*'(\w+)'.*/` — a regex that stops at the
  first digit, which is why the handlers are `previewTraining` / `confirmTraining`
  and not `...V113`.
- **The preview.** A tile calls `previewTraining(key)`: it sets `tpSelV113` and
  re-renders, so the sheet below (`tpPanelV113`) redraws for that program. Nothing is
  written to the player — `projectSeasonGainsV85(e, key, true)` is asked about a
  program, not told about one. The panel keeps everything the old card carried (the
  scene, the `.train-meta` verdict line, the focus `.train-chip`s with their v67
  badges, the cost chips) and adds the sheet: one `tpRowV113` per attribute, priority
  stats first.
- **The bar.** A row is drawn against that stat's **soft cap** (`drSoftCap`), not the
  absolute wall — at 12 of an eventual 250 every bar read as a sliver, and the number
  that governs this season is the cap the next point starts costing more at. A stat
  already past its cap stretches the scale to `cur + gain` and keeps a `.tp-capt-v113`
  tick where the cap sits. The light-blue `.tp-up-v113` segment is the season this
  program would add; on the stats the program actually pushes it carries `.flash` and
  pulses on a 2.6s cycle (held still under `prefers-reduced-motion`). A cost is the
  red `.tp-dn-v113` segment. `.track`'s groove is written as `.attr .track`, so the
  sheet's bar carries its own groove/`>i` rules and borrows only the global `.g-lo>i`
  fill colours.
- **The commit.** The dock's one button calls `confirmTraining()`, which is
  `Ir(tpSelV113)` — the event roll and the season behind it are exactly what they
  were. `Br` (`window.startSeason`) clears `tpSelV113` so a fresh trip to the board
  starts on `Hi(e)`'s suggestion again, which is also why the sheet is never empty.

Dev checks: the click-throughs that used to stop at `click('Balanced Program')` now
click `CONFIRM TRAINING` after it (65 scripts), and `capcheck.mjs` / `v85check.mjs`
preview all twelve tiles in turn instead of reading twelve cards at once.
`window.__V113` exposes `sel`, `preview`, `panel` and `row`.

## v112 — the start, the decision, the weight of a hit

Six independent passes, written on separate worktrees against one rule: **nothing here is allowed
to move the scoreboard.**

### A — the chase is always ready

Anchor `v112 A THE CHASE IS ALWAYS READY` (the first `<script>` in the head). Hook
`window.__V112_A`. Gate `scripts/v112Acheck.mjs`.

The loading screen is drawn from the v91 field sheet, and nothing asked for that sheet until v94's
own `<script>` ran — which is after ~100KB of document and every stylesheet in the head, because an
inline script waits on the styles above it. Cold on a throttled link, the request left at 1.23s and
the first animated frame landed at 3.09s: a loading screen that spends the load loading.

The sheet is now requested in the first breath of the head, before the CSS. The bytes leave at
~40ms, and **v94's `load()` ADOPTS the two promises in `window.__RIB_WARM_V112`** rather than
starting its own, so the page still makes exactly two requests for the sheet in a whole session.
The cells are cut and recoloured once into module scope, so every later loading scene — the live
game's loader above all — starts on the frame it is mounted. 3.09s → 2.15s cold; 63ms for a second
scene. `?noWarmV112` puts the old cold path back for a comparison.

What this cannot buy is the main thread: the inline bundle below compiles in one long task and no
rAF loop outruns it (the stall shows on `__V112_A.mounts[n].maxGapMs`). Which is why the loader's
own bar moved to `transform` — it used to animate `margin-left`, laid out on the main thread, so
the one moving thing on the page froze with everything else. Same sweep, on the compositor: 80
distinct composited pictures through a deliberate 1.2s jam, where `margin-left` gave 4.

### C — who you start as

Anchors `v112 THE FRAME HE HAS, AND THE FRAME HE IS GOING TO GET`, `v112 TWO CARDS FROM A POOL OF
TEN`, `v112 THE PRICE OF WALKING AWAY`. Hook `window.__V112_C`. Gate `scripts/v112Ccheck.mjs`.

**The body.** `player.body` keeps its name and every gameplay read it already had — it is the
**projected adult frame**. `bodyNowV112(body, age)` derives what he is today from one growth curve:
`HT_FRAC_V112` / `WT_FRAC_V112`, muscle at `wf ** TU("growMusclePow", .55)`, between
`TU("growYoungAge", 8)` and `TU("growAdultAge", 22)`. It is **derived at read time — never rolled,
never stored, no save migration** — so it walks up to the projection as the career ages and *is*
the projection from 22 on. A 6'2"/230 projection reads 4'5" · 67 lb at 8, 5'1"/101 at 12,
5'10"/158 at 15, 6'1"/199 at 17. Every print site is age-true: the position screen, the hub, the
menu continue card and `__RIB_MENU_DATA_V89` (which gained `heightProj` / `weightProj` /
`grownV112`).

**Fit still reads the projection, deliberately.** `pa()` feeds `en()` → OVR → national rank →
promotion odds → the declare → the silent score model. On a real rolled 8-year-old, `pa(proj,QB)`
is +6 against `pa(now,QB)` −20, and OVR 17 against 1 — reading the boy's frame would collapse every
young player's rating and move the scoreboard hard. It is also the existing semantics stated
honestly: `body` never changed with age before, so it was always a career-long constant. Scouting
an eight-year-old *is* scouting his projection, and the screen now says so.

**The trait.** The first trait is still `Ai()`'s guaranteed-good roll. The second is a decision:
`TU("traitOfferN", 2)` cards drawn from `TRAIT_POOL_V112` on the position screen, tagged UPSIDE or
DOUBLE-EDGED; tap one and the other is gone. Locking a position without picking runs
`traitAutoV112`, so the flow can never wedge and `walk.mjs` / `scoreneutralcheck.mjs` still walk
straight through. `glassBones` and `butterFingers` stay fully defined and are still read by the
injury, wear and performance models, but they have **no spawn point at creation** any more — a card
that is nothing but a downside is not a choice.

**The reroll.** Abandoning an unfinished career costs `TU("rerollPenaltyPct", 5)` on every attribute
until the next man is promoted one level. The mechanism is `condMultV54`, not
`_tempStatBuffsV25` — those are per-game, per-stat and cleared between games, while `condMultV54` is
the one multiplier both halves already agree on (`_raw` multiplies every you-player attribute by it
in the live sim, `effAttrsV85` returns it as `.mult`, the silent week does `perf*condMultV54(e)`,
the live booking does `delta*condMultV54(e)`). It now returns its old value × `rerollMulV112(e)`.
`Di()` gates on `rerollGateV112()` so the warning comes **before** the new man exists; the ledger
`o.rerollV112` survives a prestige reset the way `o.milestones` does (`Hl()` only nulls
`o.player`); a second reroll re-arms at the new man's level rather than stacking. A career that
ENDS is never charged: both endings set `player._settled`, and `abandonedV112()` is "a player exists
**and** is not settled".

### B — the stadium

Anchors `v112 THE LIGHTS SIT LOWER, SMALLER, AND FACE THE OTHER WAY` (in `buildStadiumV92`),
`v112 THE FOOT OF THE BOWL, AND THE WAY OUT` (`bowlTrimV112`, at the end of `buildCrowd`),
`v112 THE SKY HAS STARS` (`starsV112`, from `warpField`'s sky fill), `v112 THE CAMERA STOPS
CLOSING IN BEHIND THE BACKFIELD` (`buildPersp`) and `v112 THE NEAR EDGE IS AN EDGE, NOT A SMEAR`
(`warpField`'s row loop). Hook `window.__V112_B()`. Gate `scripts/v112Bcheck.mjs`.

**The lights.** Three dials on the same four masts, each separable: `lightScaleV112` (.5) is how
much of the v98 mast is drawn, `lightDropV112` (44) walks the whole rig down the screen so the
fixtures tuck into the top of the bowl instead of filling the sky, and `lightFlipV112` (1) takes
the other drawn face off the sheet so a mast's lamp bank hangs on the opposite side of its pole.
The drop is added **after** v98's `min()`, not inside it, so the foot row stays exactly as stable
between snaps as before — v99's key light reads that row, and a key light that hops is a shadow
that swims. Everything the lamps do follows by construction, because `lightRigV98` derives head,
bloom and beam from `displayHeight` / `_bx` / `_by`: height 257→128, width 205→103, foot 300→344,
faces `1100`→`0011`, bloom ×0.50, beams re-aimed 535/480→387/338. The **pool** is deliberately not
halved — the pool is the light on the grass, not the fixture — and rides `lightPoolKV112` if it
ever should be. All four pools still fall on the v103 turf quad; the key light moved 105→246 at the
same x and still sits at its own mast's 0.76 head; no mast art reaches the grass.

**The foot of the bowl, and the way out.** `bowlTrimV112` draws a blue base band as a ribbon
through every wall's own foot polyline — `baseBandColV112` #1a4694 at `baseBandFracV112` (.068) of
the stand's height *at each sample* — so it sweeps the bowl's corners instead of sitting as a
rectangle: one constant 16.6 / 16.6 / 16.7 in stand-heights all the way round, bowing 24.9px off
its own chord over 349px. The entrance is an arched vomitory in the **far** bowl, 34% along and
left of centre: the far wall is the only one whose base is on camera at every anchoring the game
produces (the sideline bases run off the bottom of the frame), and dead centre is behind the
goalpost upright. It is built from the bowl's own `crowdProject` samples so it rides the
projection; the terrace height rolls off at both jambs so the stand closes over it, and the base
band breaks across it.

**The near edge, diagnosed rather than patched.** The art *is* sampled correctly — v72's goal-line
mapping is right, nothing samples past the usable rows, and Chrome already interpolates the
fractional source row. The cause is `PERSP_BACKMAX = 1.2`: behind the anchor `s` is pinned there,
so the near band is laid out at 1.44× the anchor row's density and 1.2× its width, drawing 360×700
art at ~11 canvas px per art row — that is the streak. `nearCapV112` (1.0) says the plain thing
instead: past the backfield the camera stops closing in, and the ground behind it is drawn at the
anchor's own scale. **Nothing downfield of the anchor moves** — `VB`, the row budget, is still
measured against v28's own backdrop so it cannot change branch, and past the clamp point both
integrals lose exactly the same amount, so `total - C(u)` is unchanged. Below the near end line the
loop now walks down the apron the art paints and then falls into the dark, instead of copying one
scanline down the canvas. Measured, canvas px per art row: depth 0 `3.23 → 3.23` (the cap never
engages), 0.4 `5.65 → 3.92`, **0.78 (shipped) `11.08 → 7.70`**, 0.9 `11.07 → 10.08`; the painted
end line 37px → 25px. **Honest limit: −31%, not elimination.** The residue is the field art being
upsampled ~7× near the camera, set by `VB`, which cannot be cut without changing the apparent
camera tilt for every sprite. `nearCapV112` at `PERSP_BACKMAX` puts v28 back exactly.

**The stars.** `starsV112` bakes them into the warp canvas at depth 0.6, so the bowl (3.45), the
masts (3.2) and the screen (3.30) occlude them, off one fixed seed — the warp re-bakes per snap,
and a re-rolled sky is television static. They are packed into the strip just above the bowl's
skyline, the only sky the camera actually shows. There is no day/night setting in the game (v98
made it a night game), so the v100 lighting dial governs them: 190 stars at 100%, 0 at 200%.

**Four repo assertions were pinned to numbers this change legitimately moves.** They were
re-instrumented, not relaxed, each with a comment saying what it used to read: `v92check`
hard-coded v98's un-flipped face convention (it now reads `lightFlipV112`, and still requires the
two masts on a side to agree with each other and differ from the other side); `v98check` used
"100px above the foot" as a stand-in for "at the lamp head" (it now measures the head off the
mast's own height — and the revised assertion scores 29/0 on the untouched base build, exactly as
the original does); `v98check` and `v100check` read the near corner at `cv.height - 60`, which is
now the dark band below the ground (they now read `lastTurfY - 60`); and `v102check` asserted the
literal `y === 300` (it now asserts the invariant — one row, shared by all four, equal to v98's row
less `lightDropV112`).

### D — the pregame, one decision at a time

Anchor `v112 THE PREGAME, ONE DECISION AT A TIME`. Hook `window.__V112_D`. Gate
`scripts/v112Dcheck.mjs`.

The pregame screen said everything at once — scouting report, stat sheet, the v111 involvement
ladder with its two cost panels and driver chips, the coordinator's line, the impact bar and three
focus cards — in one column three phone-screens long. Every one of those is worth reading and none
of them was read, because the thumb was already on its way to the button at the bottom.

It is now four pages, one decision each: **YOUR INVOLVEMENT** (the five-step ladder and what this
week prices), **YOUR FOCUS** (three position cards at ×1.2, one tap or none), **THE SCOUT & THE
PLAN** (informational — it asks nothing and NEXT is always live), **THE IMPACT** (involvement,
focus, the body's swing, the wear this week bills and any lingering cut, then the stat sheet showing
the EFFECTIVE numbers he carries onto the field).

**Nothing about the model moved.** Pages 1-3 are `gsUsageBlockV23` / `gsFocusBlockV23` /
`gsPlanBlockV23` — the very markup the long column used, every id and handler intact — so
`week.usageV111`, `week.focusV111`, `_gameScriptV23` and `__gameScriptBiasV23` are written exactly
as before, and every number on page 4 is read back through `window.__V111.forecast(...)` the same
guarded way the ladder reads it. The player is never trapped: the defaults (normal, no focus) are
the game precisely as it was, BACK walks the pages in reverse and off the screen from page 1, and
CONTINUE TO MATCH is on every page.

### E — the camera finds the ball

Anchors `v112 THE CAMERA FINDS THE BALL`, `v112 THE FRAME TIGHTENS ON HIM`, `v112 THE BALL STAYS IN
THE PICTURE` and `v112 THE CAMERA HAS OPTIONS` (the mode table beside `FW`, the scene methods, and
"(the panel)" in the career block). Hook `window.__V112_E`; `window.__CAM_MODES_V112` is the one
place a behaviour is described, and the Settings panel reads it. Gate `scripts/v112Echeck.mjs`.

The frame followed `P.carrierId`, and `carrierId` survives the throw — so for the whole flight of a
pass and the whole hang of a punt the camera sat on the man who had just let the ball go.
`camFocusV112` reads possession fresh every frame: the **holder** while a man holds it (so a fumble
recovery, which the sim never names a carrier for, is followed too), the **ball itself** the moment
it is in the air or on the grass, and on a flight the frame eases toward where that flight comes
down (`camLandV112`, read once off the script's own ball frames) so it *arrives* with the ball. The
v98 handover cut keys off the focus man now, so it fires on a recovery as well, and a kick's
pre-snap frame starts on the deep man — the punter stands fourteen yards behind the spot, and the
old frame spent the whole long snap chasing him.

`camTightV112` reads how far the nearest man who could tackle him actually is
(`camSpaceNearPx` / `camSpaceFarPx`), modulated by his speed (`camTightSpdFloor`); in traffic it
returns exactly 1, and it only moves the spring's **target** — there is no second lerp fighting
v109's spring. The v109 lead keeps its direction but is bounded to `camKeepFracX` / `camKeepFracY`
of the half frame, and `camEdgeFrac` opens the zoom for a man the camera's own bounds cannot pan to
(the near sideline *projects past* the painted field) instead of scrolling off the art.
`camZoomFitV112` floors every zoom at the renderer's own pre-snap frame, so nothing v112 does opens
wider than a picture the game already drew. At the tackle, `camHitV112` arms a smaller step out
(`camHitOutK` 0.90) and `camPostV109` holds it in front of the whistle's wide for `camHitPostMs`, so
the hit reads as its own beat and *then* the frame opens for the gather.

`CAM_MODES_V112` is **Broadcast / Tight / Wide / Fixed** in Settings › FIELD VIEW, each with its own
zoom, pull-in bite, lead and spring stiffness, plus a **Camera zoom strength** slider (`fxCamZoom`).
Both ride `window.__FIELD_FX`, which the camera re-reads every frame, so a pick is live before the
panel closes; Fixed shares the OS reduced-motion path (`camOffV112`).

A bug underneath it: `__pushFieldFx()` ran *before* `mc()` rebinds `o` to the loaded save, so
`fxDepth`, `fxLight` and `fxZoom` all came back at their defaults after a reload. It is pushed again
once the save is in — every FIELD VIEW dial persists now.

Measured with the same instrument on v111: carry p90 **374px** off frame and max **713px**, and on a
punt the camera sat **700–800px** off the returner for a second after the catch. Now carry mean
**97px** / max 283px, kick mean 60px, and the ball is off frame on 0.78% of 7277 sampled frames.

One assertion in `v112Echeck` was re-instrumented after the merge: the four behaviours were compared
on one pooled mean of each mode's carry-frame zoom, and a single round that happened to draw a long
run in open space moves that mean by more than the behaviours differ from each other — it failed
about one run in three on a build it was right about. It now takes the **median of each behaviour's
per-round mean over nine rounds**, which is the question the assertion means to ask: on a typical
carry, does Tight sit closer. The thresholds are unchanged.

### F — the hit has weight

Anchors `v112 THE HIT HAS WEIGHT` (the sim block after `wrapInV109`, the renderer block, and the
call sites). Hooks `window.__V112_F` and `window.__V112_F_SIM.launch`. Gate
`scripts/v112Fcheck.mjs`.

`launchV112` is pure arithmetic over numbers `contact()` already computed — `hit.impact`, the
strength differential, the knock-back it booked, `lev`, `behind`, `handsOn`, and both men's mass out
of `WT`. It answers **one number**: `vz`, the vertical speed he left the ground with. No
`Math.random()`, no state written, no spot moved; it rides the existing events as `flyWho` /
`flyVz` / `flyPow`. Gates: `launchMinKb` (a hit that does not move him cannot launch him),
`launchMaxHands` (nobody is launched out of a crowd), a `behind` penalty, and `launchGate`. **The
v103 grip never launches** — a man who was carried and set down did not leave his feet.

In the renderer, `flyStartV112` replaces the old fixed `_launchUntil` / `_launchH` hump for violent
hits. Hang is `2·vz/g` and peak is `vz²/2g`, so the height and the duration are the same measurement
seen twice and cannot fight each other. The ground is not invented: the drawn body simply **lags the
script's own position** by the ground it has not covered yet, so he flies back along the line the
sim already knocked him down, lands short, bounces, and skids the last `launchSkid` into the booked
spot — the lag is zero the frame the skid ends. He lands in `down`, where v86's gather and the
get-up path already pick a man up, and the flight re-asserts its own pose each frame so a stray
timer cannot stand him up in mid-air. He is cleared at `q.rose`, at the end of the post phase, in
`animatePlay`'s glide reset, and by `updatePostV86`, which lands a still-flying man before anything
else moves him — nobody is ever carried into the next snap airborne. The v95 BIG HIT badge waits out
the flight's own hang (`flyBadgeMsV112`) instead of covering the arc it is celebrating.

2.4% of resolved contacts launch — about 3.4 a game, the violent tail. Neutrality is proved rather
than argued: with `Math.random` pinned to a seeded generator, eight games with the launch off and on
are **byte-identical** — same score, same event and same yard on every play.

## v110 — the man who is there

Anchors `v110 THE MAN WHO IS THERE` (four of them: the `seesBall` proximity read, the support-hold
rule, the commit handover in the pursuit block, and the catch-point contest). Hook `window.__V110`
(`.takeovers`, `.laps`, `.nearReads`, `.ballMen`). Gate `scripts/v110check.mjs`.

The complaint this answers: a defender looks like he is in position to make a play and does not.
Measured before the change, over ~700 simmed plays:

| measurement | before | after |
|---|---|---|
| the nearest defender at the stop was the tackler | 89.1% | 90.5% |
| a man idle inside 2 yards of the stop | 2.1% | 1.4% |
| a man idle inside 3 yards of the stop | 13.4% | 4.9% |
| a defender other than the cover man nearest the arriving ball | 11.4%, and he could do nothing | he plays it |

Five rules, all of which say the same thing — **where a man is standing beats what he was assigned
or what his clock says**:

- **The ball at your feet is not a diagnosis.** v81 gives every defender a read clock and until it
  lands he plays his ASSIGNMENT: the linebacker takes his read step at `lbReadLx`, the safety stays
  over the top. The clock had no proximity term, so a carrier could run within a yard of a
  linebacker who was still reading and go straight past him. Inside `TU("seeBallPx", 20)` the read
  lands NOW and the renderer gets its `keyRead` with `near: true`.
- **Support never holds the closest man.** The hold read `gap > cmGap - 4`, so a defender up to
  four pixels *closer* to the ball than the committed man still settled into a support spot and
  watched. He holds now only if he is genuinely farther off, and never inside
  `TU("supportNeverHoldPx", 12)`.
- **The commit follows whoever is closest**, measured after the step, not whoever claimed it first
  (`TU("commitTakePx", 3)`). `commitMinVel` still stops a trailing lineman claiming a tackle from
  range, but it no longer stops a man standing in the hole the carrier is running into — a
  stationary man in the gap is the most in-position defender on the field. The same rule frees a
  BLOCKED man who is closer than the committer to fall off onto the carrier.
- **A defender the carrier runs into makes the play**, commit or no commit
  (`TU("contactAnyPx", 11)`). Only the committer could resolve contact before, so a man a yard and
  a half off the ball did nothing at all.
- **At the catch point the ball belongs to whoever is standing on it.** Only the assigned coverage
  man could break a pass up or intercept it, so a safety sitting ON the catch point had no way to
  touch the ball. The contest now goes to the nearest defender when he is meaningfully closer
  (`TU("ballManTakePx", 4)`, `TU("ballManReachPx", 24)`) and it is HIS ratings that decide it; he
  is the man who returns the interception, and `out.coverPlayer` names him so the box score credits
  the man who made the play rather than the man who was assigned. This swaps the identity of the
  contester rather than adding a roll, which is why the rates hold.

Support also **closes** rather than parks: the ring drawn by v109 C2 now tightens the longer the
committer has had hold (`supportCloseMs`, `supportCloseK`, `supportClosePace`), floored at
`supportFloorPx` just outside contact range so the convergence stays a picture and not a second
tackler.

**What it cost the scoreboard:** nothing meaningful. Yards per carry 4.98 → 4.92, points 23.91 →
24.16, completion 74.0%, turnovers 0.28 → 0.30 over 300 games.

## v109 — the game looks real

A suite of feel-only changes across the pass, contact, movement and game-flow layers. The rule the
whole pass is built on: **the scoreboard does not move.** Every change is timing, geometry, an event
the renderer can draw, or a field on a row. Where a number that feeds an outcome had to change, its
MEAN was held (the flight model) or its distribution was left untouched and only its direction
shaped (the throw's miss). `scripts/scoreneutralcheck.mjs` is the gate: it prints one JSON row of
every outcome number, and the suite is measured before and after on 300 games.

**The noise floor matters.** Across 300-game runs of the SAME build, points move by up to a point in
either direction. Judge points on the mean of two runs; hold `snaps`, `compPct`, `ypc`, `ypa`,
`turn` and `sacks` tight.

### A — the ball has a speed

Anchors `v109 THE BALL HAS A SPEED` (beside `STYLE_K_V101`), `v109 THE ARC FOLLOWS THE HANG`,
`v109 THE BALL COMES DOWN STEEPER THAN IT WENT UP` (inside `rec()`), `v109 THE THROW EVENT TELLS THE
TRUTH ABOUT THE BALL`, `v109 A HURRIED MISS HAS A DIRECTION`, `v109 A BAD BALL CAN LEAVE THE FIELD`,
`v109 A THROWAWAY IS THROWN`, `v109 THE BALL HAS A SPEED (the picture)`.

`flightMsV101` was `distance × a constant`, clamped at 390 ms — so a 3-yard swing, a 5-yard slant
and an 8-yard hitch all hung for exactly the same time, and the floor did most of the work. It is
now `TU("throwReleaseMs", 200) + distance / ballVelV109(arm, style)`: the time the ball spends
leaving the hand, plus its flight at a real velocity (`ballVelBullet` .425, `ballVelTouch` .327,
`ballVelLob` .228 px per sim-ms, `ballVelArmK` scaling by the arm — 59 / 45 / 32 mph once the 2.5×
sim clock is taken back out). Fitted so every style's MEAN over the real distribution of throw
distances lands on the old ladder's within half a percent; `flightMsLegacyV109` keeps the old line
for the audit. Short balls hang a shade longer, deep balls arrive sooner.

The apex follows from the hang instead of from a per-style line in route depth (`apexPxV109`,
`arcGravK`, capped per style so a rope stays a rope), and `rec()` draws the height as two quarter-
sines meeting at `TU("arcApexFrac", .55)` — the ball climbs longer than it falls, and comes down
the steeper leg. The landing point, `dur` and every callback are unchanged.

The `throw` event now carries what the ball actually does: `dur` (the real flight, not the lead
solve's `hang`), `vel`, `velMph`, `apex`, `wobble` (0..1 off panic, an off-platform throw and a
broken pocket), `platform` (`set`/`roll`/`slide`/`hurried`) and `errDir`. The renderer drives the
spin rate off `vel` and the wobble amplitude off `wobble`, so a rope's laces blur and a hurried
ball visibly wobbles where a clean one is a tight spiral; `__RIB20_syncFootballFx` reads the same
number instead of its own bullet/lob/touch ladder.

The miss around the aim point was isotropic — a ball thrown off the back foot was as likely to sail
long as to die short. `errMag` is **untouched** (the same draw, so the cone, `locationQuality`,
`catchP`, `intP` and `swatP` see an identical distribution of how far the ball lands from the spot);
only `errAng` moved, biased back along the throw and against the receiver's heading with a
probability set by panic, movement and pressure. Measured: 2% biased on a calm set throw, 52% under
real panic.

Both throwaway paths emitted `throwaway` + `incomplete` on the same tick with no flight at all — the
ball teleported to one fixed spot at the top of the picture and the arm never moved (the v107 wind-up
only reads `throw` events). `throwAwayV109` builds a real bullet flight past the NEAR sideline,
emits `throw{away:true}` first, and books the `incomplete` (`oob:true, away:true`) from the flight's
own `done()`, trimmed to land before `HARD`. Separately the BALL's landing spot is no longer clamped
inside the paint: an errant ball goes where the miss put it and the incompletion carries `oob`.
Players stay clamped, and every outcome number is still read at the in-bounds spot (`cyIn`).

Hook `window.__V109_A` (`.flightMs(distPx, thr, style)`, `.last`, `.byStyle`). Check `v109Acheck.mjs`.

### C1 — the hit has a point

Anchors `v109 THE HIT HAS A POINT` (before `contact()`; `commitSeqV109`, `hitGeoV109`, `bobbleV109`,
`wrapInV109`), `v109 THE PILE HAS A SHAPE` and `v109 THE HEARTBEAT` (in the grip tick),
`v109 THE FUMBLE COMES LOOSE` (`recoverV109`), and the renderer's `v109 THE GANG CONVERGES` /
`THE PILE HAS A HEARTBEAT` / `THE FUMBLE COMES LOOSE` / `BALL SECURITY IS VISIBLE` cases plus
`v109 THE HIT HAS A POINT (renderer)`.

Every contact event used to report the carrier's centre and nothing else, and `tackleLunge` carried
no id — so the renderer paired a lunge to its outcome by proximity and mis-paired whenever two men
arrived in the same tick. `hitGeoV109` stamps `cid` (a monotonic commit sequence), `ix, iy` (the
midpoint of the two bodies), `nx, ny` (the unit normal), `impact` (|cMom − dMom|) and `side` on the
lunge and on every event that resolves it — `tackleWhiff`, `hurdle` (+`clearance`), `stiffarm`
(+`armEdge`), `brokenTackle`, `bounce`, `stagger`, `tackleHit`, `grab`, `tackle`. `hitFx` draws at
the impact point, squashed along the normal and sized by `impactFxK`; the shake, the scuff and the
turf wear ride the same numbers.

`supIds` were collected for stat credit and never moved, so a "gang tackle" could render as one man
wrapping while two others stood five yards away. `wrapInV109` nudges each supporter toward the
carrier along HIS OWN approach ray and emits `wrapIn {who, carrier, x, y, bearing, cid}`; the
renderer folds them into the heap in arrival order. Credit (`supIds`, `gang`, `youIn`) and the spot
are untouched.

The grip pile was a rigid comb — every pile the same shape, a man who arrived from the left placed
on the right if he happened to be joiner 1. Joiners now keep the bearing they arrived on and lerp in
along it (`pileFanRad`, `pileRadiusPx`, `pileSettleMs`); `pileOn` carries `angle`, `mom`, `n`; and
the grip beats `drag {carrier, by, x, y, pull, n, strain, vel, cid}` every `TU("dragSayMs", 99)` so
the picture can churn and visibly slow as men join.

A strip ended the play on the tick it was rolled: the ball never came loose on screen and nobody
dove for it. The `defRec` roll, the spot and the `out.fumble` fields are byte-identical, but the
play now runs 8–15 ticks of loose ball — `looseBall {x, y, vx, vy, by, cid}`, the ball wandering
inside `looseWanderPx`, the pre-decided side's nearest man converging, then `recover {by, x, y, ms,
defRec, side, strip, cid}`. `TU("looseV109", 0)` restores the same-tick ending. And a hard hit can
now bobble the ball — `ballLoose {..., secured: true}`, scaled by low `ballControl`, with **no**
possession change and no new strip roll.

Hook `window.__V109_C1`. Check `v109C1check.mjs`.

### C2 — the feet plant

Anchors `v109 THE FEET PLANT — the turn is EMITTED` (in `mv()`), `— the gather, the plant, the
carrot that scales`, `— down men go down`, `— the support FANS`, `— the jog RESUMES`, `— the coast`,
and on the renderer side `— the renderer looks ahead for the cut` (`plantV109`, beside
`windupV107`), `— he leans into it, the facing turns through the crossover` (`faceAngV109`,
`leanV109`, `cadenceV109`, `sideV109`, `stumbleV109`, after `faceMarker`) and `— the sim's plant,
turn, down and effort`.

The back re-read his lane every `laneHoldMs` and `mv()` steered into a 60-px jump at full gear the
same tick, so a hard cut reached the field as a slide between two keyframes. A lane that moves more
than `plantLaneDeltaPx` is now a plant: a two-tick gather at `plantGatherMult`, an exit burst that
pays the ground back, and a `plant {who, x, y, fromY, toY, deg, hard, vel}`. `mv()` also finally
emits its own `turn {who, deg, dir, vel}` (gated so an A-B-A flip-flop or a stationary man never
fires one), and `carryAimAhead` scales with gear so only the curvature into the lane moves. The
renderer looks `plantLookFrames` ahead in the actor's own path for a heading swing and draws the
never-used `plant_<dd>` cell into `cut_<dd>` with the cadence stalled.

`m._lean` was drawn every frame and set only for the QB tuck and drags; `leanV109` now gives every
running man one from his smoothed heading rate (`leanK`, `leanMax`, `leanDecay`), never overriding a
foreign lean. The drawn facing is rate-limited (`faceStepRad`) so a 180° reversal passes through the
side profile instead of flipping in one frame.

Trucked and pancaked men used to `continue` — frozen on a pixel, then back to full pursuit.
`downSlideV109` slides them along their overshoot for `downSlideMs` and emits `down {who, x, y,
until, cause}`; the coast rotates their heading onto the push and brakes them by position mass
(`brakeMassOL` .78 through `brakeMassDB` 1.15). Support men held on one of exactly two spots and
stacked; each now holds on its own approach ray. `effort{kind:"jog"}` latched forever, so a man cut
back into made the tackle in the jog animation — it clears now with `effort{kind:"resume"}`. And a
`stagger`, a `bounce` or a run through contact puts the man on the never-used `hurt_<dd>` cells for
a `stumbleMs` broken stride, leaning away from the hit.

Hook `window.__V109_C2`. Check `v109C2check.mjs`.

### D — the game has a clock

Anchors `v109 THE GAME HAS A CLOCK` (the engine helpers `rowMetaV109`, `hdrV109`, `flushWarnV109`,
`simOobV109`, `runDirV109`, `tkTxtV109`, hook `window.__V109_D`), `v109 THE EXTRA POINT IS A PLAY`
(`pushTryV109`), `v109 THE CLOCK TELLS THE TRUTH`, `v109 THE STICKS COME OUT` (both the engine's
`measureV109`/`fdV109` and the claim region's first-down emit), `v109 THE FLAG HAS THREE BEATS`,
and `v109 THE SCOREBUG COUNTS THE TIMEOUTS` (`ribPaintTimeoutsV109`).

The try was a string suffix — `tryAfter()` mutated the score and the scoreboard jumped 0→7 on the
touchdown row with no kick ever shown. It now makes the *identical* rolls in the identical order and
returns the verdict; the touchdown row books 6 and `pushTryV109` books the 1 or 2 on its own
`{event:"xp"|"twopt", scored, try:{kind,good,pts,dist}}` row, rendered from the FG family's sim log.
Two neutrality guards: the sim writes stamina and wear back onto the 22 men it uses, so the tanks
are snapshotted and restored around a kick the base game never simulated, and a sim "block" that
would contradict the verdict drops its log instead of being drawn.

`stops` was computed and thrown away and `oob` was a blind roll unrelated to where the carrier
finished. Every snap row now carries `clockStopped`, `secs` and `runoff`; out-of-bounds is read from
the sim log first (`simOobV109`) with the blind roll reduced to `p' = (p_target − p_sim)/(1 − p_sim)`
so the AGGREGATE rate is unchanged. New header-like rows: a two-minute `warning` (decorative — it
consumes no seconds and does not alter the runoff), `period` at each quarter turn, a pregame `toss`,
and `timeout` — which used to be text welded onto the previous row's `desc` after it was booked.
`toLeft` rides every row and the scorebug shows three pips a side.

Penalty rows carry a structured `foul {name, on, side, player, yards, spot, result}` (the result
derived from the existing math only — no new decline logic), and the flag choreography runs in four
beats: the culprit moves, the flag flies, the crew announces, the formation re-spots. A spot inside
`measureYd` of the sticks sets `measure` and brings the chains out before the FIRST DOWN badge. Punt
and kickoff rows carry their result, gross, return and net; run and pass descriptions finally name
the direction and the tackler ("rushes off tackle right for 4, tackled by X"), with `tackler`,
`assist`, `dir` and `tacklerSim` on the row — a formula-promoted run with no sim truth names a
plausible defender, flagged `tacklerSim:false`, and never the you-player and never a stat. The
`P.ff`/`P.fum` NaN (incremented from undefined since v30) is fixed.

Hook `window.__V109_D`. Check `v109Dcheck.mjs`.

### B — the receiver finds the ball

Anchors `v109 THE RECEIVER FINDS THE BALL` (the fly branch's find, `ballTrack`, the reach; the route
block's `steerV109`; the `catchseq` registration in `ribRegisterTeam`), `v109 THE HANDS GO UP`,
`v109 AN INCOMPLETION HAS A REASON`, `v109 A PASS BREAK-UP IS CONTACT`, `v109 THE PUMP FAKE`.

The target was driven at the landing spot from the instant of release — and driven *twice* a tick,
once by the fly branch and once by the route block, so he covered double ground and stood under the
ball long before it came down. He now runs his ROUTE until `_ballFoundAt`, a real find time off his
awareness plus a penalty when the ball is over his shoulder, and emits `ballTrack {who, x, y, late,
ms, shoulder}`. `capTo` is untouched, so the catch point and every roll are identical; once he has
found it the pre-v109 steering resumes exactly as before, because standing the route block down for
the whole flight moved where he was against his man at the catch and cost two yards an attempt.

The hands used to close ~300 ms *after* the ball was in the body. The fly branch now emits
`reach {by, x, y, kind, at, contested}` at `TU("reachLeadMs", 180)` out, and this is where the
sheet's 46 `catchseq` cells — cut long ago, registered by nobody — finally get used: `catchseq_<dn|
dr|up><0..3>_<0..3>` is registered per kit and the reach's `kind` picks the variant. `catch` only
CONFIRMS possession, and the tuck holds `catchhold_*` before the run cycle resumes.

An incompletion now says what it was, classified strictly AFTER the existing rolls and changing
none of them: `drop` (well placed, nobody in his hands, the man open), `swat`, `contested`, or
`overthrow`/`short`/`behind` from the sign of the miss — plus `away` for agent A's thrown
throwaway. The renderer pops the reason and draws a drop as a real bobble off the hands. A break-up
carries `contact:true` and the side the arm came from, the defender's arm goes through the hands,
and `boxOut` and `comeback` — emitted and discarded since v82 — got real cases at last.

And the quarterback pumps: a covered read from a clean pocket rolls `TU("pumpRate", .18)`, freezes
the nearest ZONE defender briefly through v56's existing steering hold, and the renderer plays the
throw's frames 0-3 and aborts before the release. The fake is exactly as long as v107's wind-up
lead, so `TU("pumpBeforeThrowMs", 900)` keeps the two apart and the abort is pinned to the fake's
own `seqT` — without that a fake still holding `forceState` ate the next real release.

Hook `window.__V109_B`. Check `v109Bcheck.mjs`.

### E — the broadcast

Anchors `v109 THE BROADCAST CAMERA`, `v109 THE LEADING THIRD`, `v109 THE BROADCAST (agent E)`
(`v109E()`, `caseV109`, `camSpringV109`, `camPostV109`), `v109 SHADOWS STAY UNDER THE BODIES`,
`v109 TEAMMATES HELP EACH OTHER UP`, `v109 CELEBRATION VARIETY, AND A BENCH THAT SURGES`,
`v109 THE BENCH SURGES`, `v109 THE HUDDLE BREAKS LIKE A HUDDLE`, `v109 THE CREW SPOTS THE BALL, AND
THE STICKS MOVE`, `v109 THE QUARTERBACK'S EYES`, `v109 THE FRONT'S CHESS`, `v109 WALK`.
Renderer-only: no sim event added or removed, so the scoreboard cannot move.

The follow was an exponential lerp behind a dead-band — it stalled on small corrections and
micro-stepped on large ones — and v28's carrier lock scaled zoom by `1/perspK(carrier)` so the
runner never changed size, the opposite of a broadcast. Pan and zoom now ride one critically damped
spring with a capped acceleration, the carrier is framed in the leading third along his heading,
the perspective lock is softened so a man coming down the near sideline grows, and the whistle
pulls the frame WIDE onto the spot for the whole post phase. The v98 handover cut and the v71 flag
focus stiffen the spring rather than swapping constants.

One expected improvement turned out to be wrong and is documented rather than faked: pile bodies do
NOT float off their shadows, because `m.shadow` and `m.fill` are children of the container
`resolveOverlaps` nudges. What the nudge did leave stale was the cast itself and — genuinely broken
— the ring, plumbob and name tag, which are not children and were repositioned by a formula that
dropped the plumbob's float and both objects' scale. All of that is now re-derived at the nudged
position.

The rest of the between-whistles life: the nearest standing teammate walks over on the drawn walk
cycle and holds a hand out while a downed man runs his get-up (inside the existing post-play
budget, never lengthening it); two or three teammates join the scorer on staggered starts from
random frames while the opposition walks off and the v78 bench surges toward the touchline; the
huddle breaks by position — line, then backs, receivers, quarterback last — each man walking the
first stride out of the ring; an official runs to the dead-ball spot, plants, points and the ball
is set down as he does; a first down walks the chain crew's down marker and both rods to the new
line; and a row flagged `measure` brings both wing officials in with a chain drawn between them.

The quarterback's eyes turn to each read and come back square before the arm arms, and eight sim
events the renderer had always ignored — `pickup`, `blitz`, `linebackerDrop`, `penetrate`,
`doubleTeam`, `pocketSlide`, `spring`, `cutback` — finally reach the picture.

Hook `window.__V109_E`. Check `v109Echeck.mjs`.

### What the six parts cost each other

Three seams only the merged build could show, all fixed here rather than in a worktree:

- A's throwaway became a real thrown ball, and it was the one incompletion B's classifier never
  saw. It now carries `reason: "away"`.
- B's tuck was timed from the catch event, but B's own reach starts the catch sequence ~180 ms
  earlier, so the window was spent by the time the hands closed and the tuck drew zero frames. It
  now starts at the frame the sequence ends.
- E's eye turn was gated to finish 400 ms + the wind-up's 340 ms before the throw — wider than the
  whole drop on a timing route, so every read was skipped; E's celebration joined only men within
  260 px, so a long touchdown left the scorer alone; and E's measurement moved the wings only when
  they were not already signalling, which with D's `measure` flag live was every time.

## v120 — the coach decides your snaps, fatigue is a slope, and the coach points

Anchors `v120 THE COACH DECIDES YOUR SNAPS` (beside `USE_V111`, in the v111 involvement block) and
`v120 FATIGUE IS A SLOPE` (beside `condMultV54`).

**The snaps.** `shareOfV111(k, pl)` is now `trustShareV120(pl)` × the rung: `trustV120` is
`coachTrust / 100`, `trustShareV120` = `trustShareMin` (.30) + `trustShareSpan` (.70) × trust,
clamped .2–1 — a stranger at trust 28 gets about half the unit's snaps at NORMAL, a man at 100 gets
them all. LIMITED and REDUCED still multiply that by their rung (.55, .75). HEAVY and EVERY SNAP
ASK for more: `askOverV120` (.25, .5) is how much more; `askSayV120` grants `1 + over × (askSayFloor
.35 + .65 × trust)` of it, so at low trust the ask buys little and at full trust all of it, never
past 1; `askMulV120` = `1 + over × askDistrustK (1.0) × (1 − trust)` is the price of asking, and it
multiplies the WORK that `costV111` bills (in `forecastV111` and, whatever he actually played, in
`chargeV111`) and the injury chance itself (`injChanceV54` reads `opts.askMul`, or the week's own
dial when a game-day caller passes only `{wk}`), so the pregame forecast, the post-game bill and the
roll agree. `usageV111()` carries `askMul`, `forecastV111()` adds an "Asking above your share" part
when it is above 1, the ledger's note says what the coach gave and that the asking costs body, and
the panel's heading says NORMAL is the share he trusts you with, and `fatigueRowsV120(f)` adds two
rows to WHAT IT COSTS — `Fatigue now → after` and `Every stat +5% → −3%`, read off `fatigueMulV120`
at both numbers. The sim's substitution
(`_share111`, `_slot111`) and the post-game `snapShare` read the same share, so the hub's Snap Share
and the grade caps follow trust the way the guide always said they did. `window.__V120` is the hook.

**The slope.** `fatigueMulV120(fat, inj)`: `condFresh` (1.05) at or under `freshFatigue` (25);
1 to `fatSlopeFrom` (40); then linear to `condWornMax` (.80) at 100 — −10% at 70, the old step's
value, so nothing at the old line moved; playing hurt is `min(m, condWorn .90)`. `condMultV54`
returns it times the reroll debt; the body ledger's row reads FRESH LEGS / WEARING DOWN (40–69) /
WORN DOWN (70+) / PLAYING HURT off the same multiplier; the season projection's `mAfter` and the
live box's head label read it too. `window.__fatigueMulV120`.

**The coach points.** A line with `tap: true` sets `st.tap`: `spotOn()` adds `.tap` to the
cut-out (a pulsing gold outline) and places `[data-c-tap]`, the bouncing TAP HERE hand, just above
the target (below it, flipped, when the target is at the top of the screen), re-measured every
frame with the cut-out. Two more spotlight specs: `parent:<selector>` (the block around a hint —
the name on the position screen) and `find:<regex>` (the smallest visible element in `#screen` /
`#app` whose text matches — the 🏟 team line on the hub card). `scan()` does not open a stop while
`#momentBanner.go` or `#cinemaFlash.go` is on: the game's own pop-ups (a persona moment, a flash)
were firing under the dim while he talked about something else. The lines name the team and its
colours, the renameable name, NORMAL as the snaps he trusts you with, and end on HOW TO PLAY for the
AI, the strategies and the numbers.

## v119 — the coach, and the DFL

Anchor `v119 THE COACH` (`public/rib-menu-coach.js`; the styles in `rib-menu-coach.css`;
the switch tile in `rib-menu.js`'s `renderMenu`; the `coach` action in `rib-menu-navigation.js`;
both files in `bake-menu-into-index.mjs`'s lists). The art: `scripts/build-coach-art.py` cuts the
three uploaded sheets (five rows by two columns each — the left column mouth closed, the right
mouth open, one pose a row; a FIXED grid, because rows touch on one sheet and an alpha-band split
merges them; the largest blob per cell, because a fixed cell can carry a sliver of the neighbour)
into `public/coach/<pose>_{a,b}.webp` at 360px tall, plus `tile.webp`, the head off the welcome
pose, for the menu. **`_b` is `_a` with only the mouth set on it**: the sheets' two drawings of a
pose were drawn twice — the body, the brow, the eyes and the tilt of the head all differ — so
flipping between them twitched the whole man, and pasting the whole head snapped between two
faces. `face_box()` finds the face in each cell (the biggest skin blob under the cap's centre — a
raised hand beside the head, or the cap's gold stripe, would otherwise pass for it), `dark_blobs()`
lists the dark strokes inside the lower half of the face that touch none of its edges (so the
outline, the mic and the brows drop out), `open_mouth()` takes the widest thin one on the closed
cell as the closed mouth (with any stroke beside it — a frown is the lip line and the shadow under
it) and the biggest one on the open cell as the open mouth (its interior with the lips). It ERASES
the closed strokes first — a skin fill sampled from the ring around them, feathered — then fills
and dilates the open blob by 3 px, feathers it over 3 px, and blends it onto the closed drawing
HUNG from the closed mouth line — the open upper lip on the line, the jaw dropping below it, so the
mouth never climbs toward the nose; and it refuses to write a pose in which any pixel of the closed
strokes is still dark beside the open mouth (`SystemExit`: a coach with two mouths). So the open
mouth is over the closed one in every pose, no line peeks out above it, and nothing else changes (`coachcheck.mjs` proves the differing pixels sit in one small box low in the
head, with the silhouette identical). The cutter writes `art/coach/coach_pairs.png`, every pose
closed beside open: look at it after a cut. The fifteen poses: whoa, thinkcap, armscrossed,
clipboard, relaxed, firedup, listen, shrug, flex, stop, welcome, tip, point, thumbsup, open.

**The stops.** `STOPS` is thirteen `{id, title, sub, when(ctx), lines, delay?, last?}`, in the order a
first week meets them (plus `prestige`, which is not part of the week: it fires whenever the tree
is opened, view `upgrade`, off the menu's TRAINING tile); a line is `{p, t, s?}` — pose, text, an optional spotlight key into `S`.
`ctx()` reads the page: the audit state's `view` (`window.__GRIDIRON_AUDIT__.getState()` — the
state is never `window.o`), the menu overlay, `#personaV13`, `#growthV42` (the wheel), `#pregameV1513`,
`#pgOverlayV13`, the live scene's markers, and the seen set. The stops and what they key on:
`menu` (the overlay up, no personality sheet), `persona` (`#personaV13`), `position` (view
`choosePos`), `hub` (view `hub`), `wheel` (`#growthV42` shown — the season-commitment wheel comes
up OVER the training board off PLAY SEASON, spins itself, rolls the fit, and its CONTINUE
`#gv42go` is only in the page once the roll is in), `training` (view `training`, no wheel),
`season` (view `season`, no wheel / pregame / post card), `plan` (the weekly-plan wheel — the same
`#growthV42` off PLAY WEEK, before the wizard, told apart by its title reading PREGAME), `pregame`
(`#pregameV1513`, no wheel), `live`
(markers on the scene and view `live`, `delay` 2600 so the loader has left), `result`
(`#pgOverlayV13`), `recovery` (the season screen again, once `result` is seen; `last`). The text is
PLAIN: a football coach talking to a jock who may not follow a long sentence — what the screen
does, what to do about it, three or four short lines a stop, almost no numbers (the guide has the
numbers; `coachcheck.mjs` allows four lines with a digit in the whole script and no line over 170
characters) — and it says the things a rookie must hear: a fatigued guy plays worse, so play fewer
snaps and let him recover; every position wants a different mix of skills and the mix is his to
work out; prestige is what a finished career leaves behind, spent under TRAINING on the next guy.
It must stay the guide's truth in fewer words: nothing the guide does not say. `estimateMs()` is the scripted
length at the pace constants (`TYPE_MS` 18 a character, `PUNCT_MS` after a stop, `HOLD_MS` +
`HOLD_PER_CHAR` × length to read it): a couple of minutes over the whole week, and `coachcheck.mjs`
holds it between 1.5 and 6.

**Finding the stop.** `currentStop()` is the first stop whose `when(ctx)` holds AND that is not in
the seen set (`rib.coachSeen.v119`, a JSON array) — the season screen fits `season` before the game
and `recovery` after it, and skipping the seen one is what lets the second fire. `scan()` runs on a
MutationObserver over body (class and style changes included) and a 500 ms tick: while the welcome
cards are up it waits; while a stop is open, or the splash is still up, it does nothing; with the
store at `'on'` it arms the current stop and opens it `delay || 650` ms later, re-checking that the
screen has not moved on in between. `next()` on a stop's last line marks it seen and closes
(`'gotit'`), or, on the `last` stop, `finish('done')`. The `menu` stop closes on
`rib-menu-unmounted`; every other stop is the player's to read and tap through, because it is modal
over the screen he is about to use.

**The talking head.** `type()` writes the line a character at a time and `blip()`s each letter;
`flap()` swaps the `<img>` between `<pose>_a` and `<pose>_b` in the shape of speech while
`st.typing` — an open of 45–120 ms, a close of 55–140 ms, a further 90–240 ms shut when the letter
just typed was a space or a stop (six times in ten), a close cut to half now and then (the double
snap) — and `done()` leaves it closed; `voice.mouthLog` keeps the last eighty beats and the check
proves their spread. **The voice** is WebAudio with no sound file: `voiceCtx()` makes one
AudioContext on open (every open follows a gesture) and a master gain at 0.16; `blip(ch, pos, len)`
plays one pitched blip per letter at most every `BLIP_GAP` (42 ms, a syllable rate) — a sawtooth
at `118 Hz × 2^(semi/12)` with a square an octave under, through a bandpass whose centre and Q
depend on the letter (vowels lower and narrower), `semi` = +4 for a vowel, the letter's own step
(`code % 7 − 3`), a sentence contour (`sin(k·π)·2 − 2k`, lifting +3 late in a question) and a
little jitter; vowels run 75–115 ms and slide down, consonants 45–70 ms and slide up, and
s/f/h/t/k/p/x add a 30 ms high-passed noise burst. VOICE (`setVoice`, `rib.coachVoice.v119`) mutes;
reduced motion keeps him quiet. `show()` sets the crumb (`n / 13 · TITLE`), the bar, the stop, the
pose and the spotlight, then types (the crumb counts `n / 13`); the NEXT button reads `GOT IT ›` on a stop's last line and
`DONE ✓` on the last stop's. `tap()` (the bubble, the coach, Space, Enter, →) finishes a typing line
or moves on; `next()` / `back()` walk the lines; AUTO (`setAuto`) is the hold-then-next, and the
last line of a stop never auto-advances (the player has a screen to use); SKIP and Escape call
`finish('skip')`. Focus is trapped inside the dialog; `aria-live` on the text.

**The dim and the spotlight.** `.rib-coach-dim` is the plain dim; `spotOn(key)` shows
`.rib-coach-spot`, a rounded box whose `box-shadow: 0 0 0 200vmax` IS the dim with a hole in it.
`S` maps a key to a selector, or to `text:<pattern>` matched against the visible buttons (`Lock In
Personality`, `Play \d+-Game Season`, `CONFIRM TRAINING`, `Play Week \d+ Live`, `^NEXT`), so the
same key finds the button on any week. The target is scrolled — by the nearest scrollable ancestor
or the window — into the band between the header and the bubble's top (the middle of a phone screen
is under the bubble), and re-measured every animation frame (screens re-render their innerHTML, so
the element is re-queried, never held). A target that is not there YET keeps the plain dim and the
frame loop keeps looking — the wheel's CONTINUE arrives seconds after the stop opens, and the cut-out
lands on it when it does. `body.rib-coach-open` desaturates the page a little so the coach reads
as the foreground.

**The switch.** `state()` is `localStorage['rib.coachTour.v119']`: nothing stored (a fresh install —
the tile reads ON, and the walk follows the welcome cards), `'on'` (switched on by hand or by the
cards — the stops follow the screens), `'off'`. `toggle()` (the tile): open → `finish('skip')`;
`'on'` and idle → off; otherwise clear the seen set, store `'on'`, and open the current stop
(`'tile'`). `finish()` stores `'off'` and closes, so the week never plays twice by accident; the
tile's face is flipped in place by `refreshTile()` and read again by every `renderMenu`.

**The first visit.** The game's own three welcome cards (`hr()`, `.onboard`, `#onNext`) had been
appended at z-index 190 under the v89 menu overlay at 9999 since the menu arrived: nobody ever saw
them, and the dev checks' `window.o.tutorialSeen = true` has always been a no-op (the state is
never on `window.o`; only their `.onboard` removal does anything). v119 lifts `.onboard` to 10000,
so a new player reads the cards. `scan()` counts clicks on `#onNext` in the capture phase and, once
the cards are gone after three of them with the switch not OFF, clears the seen set, stores `'on'`
and opens the menu stop 500 ms later (`openedBy: 'welcome'`); the checks, removing the cards
unclicked, never reach that. `?coachTour` does the same at the first mount (`'query'`); a store of
`'on'` cut short by a reload opens the current unseen stop again (`'page'`) — until `finish()` stores
`'off'`.

**The DFL.** Every `\bNFL\b` in the game's copy (index.html outside the data URLs, the menu, the
guide, the check messages) is `DFL`, and `Pro Bowler` is `All-Star`. Identifiers stayed
(`nflReached`, `continueNFL`, the `"nfl"` mastery key, `nflSeasons`): they are code. The level names
are `DFL Combine` and `The DFL`, and the menu's level regex in `rib-menu.js` was moved with them.

`window.__RIB_COACH`: `open(opts)`, `close`, `toggle`, `next`, `back`, `tap`, `skip`, `setAuto`,
`setEnabled`, `enabled`, `isOpen`, `chapter`, `line`, `typing`, `flips`, `spot`, `auto`,
`chapters`, `poses`, `estimateMs()`, `key`, and the counters `opens` / `closes` / `openedBy` /
`closedBy` / `linesShown` / `last`. `scripts/coachcheck.mjs` is the gate.

## v118 — the quarterback's own sheets, and the mesh

Anchors `v118 THE QUARTERBACK'S OWN SHEETS` (`scripts/build-field-art.py`) and `v118 THE MESH`
(`meshV118` / `meshOffsetV118`, beside `startExchangeV108`); the v118 lines in the v108 tables,
`ribRegisterTeam`, `exchangeV108`, `handV105`, the placement loop and `placeMarker`; `qbRun` in
`buildPlayScript`.

**The sheets.** `art/field/qb_handoff_v118.png`, `qb_toss_v118.png`, `qb_throw_right_v118.png`
(six rear-view frames each) and `qb_throw_cross_v118.png` (two frames and a loose ball). The cutter
scales each by its helmet — `helmet_w` is the navy touching the top of the figure, the outline keeps
it off the jersey and the gold stripe splits it, so it is every navy blob starting within 6% of the
highest one; measured 0.34 of the standing height on all four sheets — to `HELM44`, the helmet a
44 px man wears (taken off the handoff sheet's upright turn), and then the two throws share one
shrink (`fit_k`) and the two exchanges another. `ball_or_hand` finds, per cut cell, the ball where
`DRAWN` says the cell draws one (the largest brown blob plus what a glove split off it; the brown is
read off the RAW sheet by `ball_mask`, before `normalize_palette` pulls the sheet's gold onto the
atlas's hue — the ball's brown sits inside that band and would have come out gold and taken the
PANTS' colour in the kit recolour, so `slice_sheet(keep_ball=True)` restores those pixels) or the
throwing hand where it does not (the highest glove, the right one when level, the shoes excluded);
`cell_offset` maps that through cell_of's own transform and the script prints `HAND_V108` /
`BALL_DRAWN_V108` for index.html. The cycles: `handoff_up0..4` = the turn, the ball out low in
both hands, at arm's length in both, ONE HAND AT FULL STRETCH (cell 3, `rel`), the empty hand;
`handoffL_up0..4` the same cut mirrored; `toss_up0..4` = the turn, the wind at the hip, the ball out,
THE RELEASE (the loose ball dropped at the slice), the empty hand; `throwR_up0..5` = the set (no
ball drawn — the offset is the right hip, declared), cocked at the right shoulder, at the ear, the
ear held, the release (the arm straight up, the loose ball dropped), the follow turned to the throw;
`throwL_up0..5` = throwR's cells 0-3 and then the cross sheet's release and follow. Not cut: the
belly frame on both exchange sheets (reads as a man facing the camera), the right throw's frame 3
(an open hand before the ball has left), the uploaded left-handed throw
(`art/file_000000007d18…png`) and the screenshot; `throw_dir_a` and `exchange_quarter` are still
sliced for the record but no cell is named from them.

**The reach goes to the side the back is on.** `EX_V108.handoffL` (`st: "handoffL"`, registered as
`spr_<kit>_up_handoffL<i>`). `exchangeV108` now works out `sdx` BEFORE choosing the cycle: a back off
his left takes the mirrored reach (two hands on the ball through it, so no hand is the wrong one);
the pitch is never mirrored (a pitch is thrown, he throws right-handed), so a far or called toss to
the left is the two-handed reach with the ball flown as a pitch. `handV105` picks the same way, and
its hook record follows the DRAWN cycle (`E.st`), not the flight. `skippedLeft` stays 0.

**The mesh.** The sim stages none: at its `handoff` event the back is standing in his alignment
(measured 40 script px = 5-7 yd to the side, both men nearly stationary since the snap; FieldSim's
snap at 165 ms and handoff at 429, the choreographer's at 660 → 1023/1485). `meshV118(P)` runs first
in the tick and plans once per script: the two men's frames at the event, the gap, and a step along
the QB→back line of `min(gap − meshReachYd, meshMaxYdPerS × window, meshStepYd)` yards
(`PLAY_W / 100` px each), the window being snap + `meshDelayMs` to the event. `meshOffsetV118(P, T)`
turns that into an offset — smoothstep in over the window, held `meshHoldMs`, smoothstep out over
`meshReturnMs` — that the placement loop ADDS to actor 8's interpolated position before
`placeMarker`; `m._meshFaceV118` is set while it is non-zero and `placeMarker` holds his facing on
`up` for it (the same line the dropback uses). Nothing in the sim moves; no yard changes; a defender
runs the frames he always ran. `P._meshV118.far` (the gap left after the step is more than the reach)
is read by the lookahead and by `handV105` as a second reason for `toss` — the cycle AND the flight
(`tossMs`, `tossArc`) — because a ball crossing five yards of grass is a pitch whatever the call
sheet says. FieldSim's 264 ms window allows a 1.7 yd step, so most of its runs are pitched;
the choreographer's 825 ms sweep window closes the whole gap and gets the hand.

**The keeper.** `buildPlayScript`'s `qbRun` made EVERY run of the user's own offense a QB carry when
the career position was QB ("Pierce rushes inside" drawn as the quarterback running, no handoff
event at all); it now also needs the row to name him (`/\bYOU\b/`).

`window.__V118`: `meshes`, `far`, `near`, `offsetFrames`, `last` / `steps` (`gapYd`, `stepYd`,
`winMs`, `far`). `scripts/v108check.mjs` is the gate (the new assertions are marked v118), and
`scripts/build-field-art.mjs` prints the tables to paste. The run cycle every player wears is still
run8's wider build; the QB sheets are slimmer, and the seam shows where he leaves the exchange for
the run frames.

## v108 — the exchange, and which way he throws

Anchor `v108 THE EXCHANGE, AND WHICH WAY HE THROWS` (the module-level tables, just above
`ribRegisterTeam`), the v108 lines inside `startThrowV107`, `exchangeV108` / `startExchangeV108`
(beside `windupV107`), the `handSeq` case in `placeMarker`, and the v108 comments in the ball
block. 22 new cells: `throwR_up0..5`, `throwL_up0..5`, `handoff_up0..4`, `toss_up0..4` — all `up`,
all rear views, registered per kit as `spr_<kit>_up_throwR<i>` / `_throwL<i>` / `_handoff<i>` /
`_toss<i>`.

**Which way he throws.** v107 turned the thrower onto the target with `faceMarker`, and because
`faceMarker` never flips an `up` man (one rear drawing, and a mirror of it puts the ball in the
wrong hand), a quarterback throwing at a receiver straight in front of him came out on the QUARTER
cycle, arm across his body, facing away from the man he was looking at. The sheet now carries the
rear throw twice — the ball leaving right, and the same throw drawn across the body to the left —
so `startThrowV107` picks the ARM instead of the facing whenever the target is inside
`TU("throwDirConeDeg", 70)` off straight ahead (`dy < 0` and `atan2(|dx|, -dy) ≤ cone`): `dir` is
`"R"` for a target to his screen-right — the dead-straight ball included, he is a right-hander —
and `"L"` to his left, `m.dirKey` stays `up`, `m.flip` stays false. Anything wider, or behind him,
goes through the v107 turn exactly as before and records `dir: null`. `m._thrDirV108` rides the
sequence, `placeMarker`'s `throwSeq` branch draws `throw<dir><frame>`, and the release is still
frame `TU("throwReleaseFrame", 4)` on the tick the flight starts (residual 0 ms) — the back-dating
is untouched. Each `__V107.throws` record now carries `dir` and `targetDx`.

**The exchange.** v105 made the handoff and the pitch a ball travelling between two hands, but the
quarterback's body ran its ordinary frames through it. `exchangeV108(P)`, called beside
`windupV107`, scans the script once per play for `handoff` events and starts the drawn cycle
`frameMs × releaseFrame` early, back-dating `seqT` the same way the arm does, so the frame that
lets go is drawn ON the event: `handoff_up` frame 2 (the ball at arm's length) at
`TU("handoffFrameMs", 70)`, or `toss_up` frame 3 (the release) at `TU("tossFrameMs", 80)` when the
play description is in the sweep family — `TOSS_CALL_V108`, the one regex `handV105` reads too, so
the wind-up starts before the event knows. `m.forceState = "handSeq"` with `m._exV108`
(`{st, cyc, n, rel, fm}`); `placeMarker` clamps the frame and hands the man back to his run/idle
states when the cycle runs out, so he carries out the fake. `handV105("handoff")` starts the same
cycle when the lookahead found nothing (frame 0 at the event) and books the frame the hand actually
opened on. Both drawn exchanges are RIGHT-handed, and the sheet's one left-handed exchange is a
different build, so a back coming off the quarterback's left is skipped
(`TU("exchangeSideMinPx", -3)`, measured against the back's position at the event from the script's
own frames): that play keeps the pre-v108 picture, run frames with the ball drawn by v105.

**One football, never two.** v107 hid the renderer's ball across frames 0-3 of any drawn throw
cycle, which is only true of the front and quarter cycles — the rear throw is drawn from behind
and the ball is hidden by the body until it is cocked at the ear. `BALL_DRAWN_V108` is the measured
table (`throw_up: [3]`, `throw_dn`/`throw_ur`: `[0,1,2,3]`, `throwR_up`/`throwL_up`: `[2,3]`,
`handoff_up`: `[1,2]`, `toss_up`: `[0]`); `cycleV108(m)` is the one place the cycle and its frame
are worked out, read by the ball block and the hook alike. On a frame the cell draws the ball ours
is scaled to zero (scale, not `setVisible` — the v1513 guard forces visible and alpha back every
update); on a frame it does not, ours is shown and mounted at `HAND_V108[cyc][frame]`, the ball's
position in that cell in CELL pixels off its centre, measured off the atlas. The offsets apply on
hidden frames too, so an exchange's flight starts from the hand the drawing put it in. The audit
runs off the sprite itself right after `setScale`: `window.__V108.ballDoubled` (the cell drew one
and ours is visible) and `.ballMissing` (neither, while the man still holds it) must both stay 0.

`window.__V108`: `throws` (the same records `__V107.throws` holds, with `dir`/`targetDx`),
`handoffs` / `tosses` (`{t, eventT, frameAtEvent, toss, sideDx}`), `handoffFrames` / `tossFrames`,
`ballFrames` / `ballDoubled` / `ballMissing` / `last`, and `skippedLeft` (exchanges left undrawn
because the back came off his left). `scripts/v108check.mjs` is the proof — it drives the live
game at its fastest speed setting and, if one game does not throw both ways, takes the next week
live and keeps watching.

## v107.1 — the sheen flashes twice, the flashes stay on the crowd

**The sheen.** `.rib9-sheen` sweeps a highlight band across the wordmark through a mask of the
wordmark's own alpha, `background-size: 260%`, position animated 120% → −120%. Two things made a
second, slow flash: `background-repeat` was the default, so a second copy of the band sat 260%
behind the first and crossed the letters at the end of the travel (−81% → −120%), and that end is
where the cubic-bezier decelerates — the copy crawled (284 ms for the real flash, then a 60 s
crawl, measured). The band is `no-repeat` now and `rib9sheen` is a lead hold, sweep A (the
original curve and travel), a `steps(1,end)` beat that jumps the band back while it is off the
element, sweep B identical, and a hold; the timing function sits on the sweep keyframes so the
holds are holds. `.rib9-brand b` gets the same rhythm; because its gradient IS the letters'
colour (`background-clip: text`), flat gold is laid under the gradient so the word never vanishes
between passes. `scripts/sheencheck.mjs` drives the CSSAnimation's `currentTime` and measures
both crossings: 284 ms and 284 ms on the wordmark, 581 and 581 on the brand.

**The flashes.** `startHeroFx` drew camera flashes, the shimmer band, the lamps and the sun at
fractions of the CANVAS BOX, while the photograph under them is `object-fit: cover` and cropped
differently at every aspect — and the x-range (16–42% and 58–84% of the box) reached the tunnel
walls at every width. `v107.1 THE FLASHES ARE ONLY OVER THE CROWD` puts every one of them in
PICTURE percent: `CROWD_V107_1` is two polygons, the tiers either side of the man inside the
tunnel mouth, traced off row-wise luminance (wall ≤ 41 and neutral, tier 110–200 and warm) with
the inner edges taken from the v106 kit masks plus a margin; `HERO_LAMPS` sits on the real lamp
row; the sun at the mouth. `heroPicBoxV107_1()` is `coverBox` on the hero picture (times the
breath's midpoint, since the canvas does not ride `rib9breathe`), read on resize and applied every
frame, so a flash mid-pop moves with a resize and a spawn that would fall outside the current
box is skipped. `window.__RIB_MENU_FX_V102` exposes `flashLog` (last 200 spawns, picture and box
coordinates), `crowd`, `box`, `lamps`, `sun`; `scripts/heroflashcheck.mjs` reads the picture
pixel under every spawn at three widths and proves it is crowd. Menu stamp → `v107.1-menu`.

## v107 — the arm, the drop, the stance

Anchor `v107 THE ARM, THE DROP, THE STANCE` (in `ribRegisterTeam`, where the throw registers),
`v107 THE ARM` (`windupV107` / `startThrowV107`, next to `qbTickV86`) and the v107 comments in
`placeMarker` and in the ball block's hand offset.

**The throw wears its facing.** The v91 sheet carries `throw_up0..5`, `throw_dn0..5` and
`throw_ur0..5`; `ribRegisterTeam` builds `spr_<kit>_<dd>_throw0..5` from the cycle that matches
the facing, and the two facings nobody drew borrow the nearest real one — `sd` takes the quarter
(`throw_ur`: the arm already comes across the body, and the atlas's sd and ur cells are both
drawn looking left, so `faceMarker`'s flip works on either) and `dr` takes the front
(`throw_dn`: the only cycle facing the camera). `RIB.throwV107` records which facings are drawn
and which are borrowed; when the atlas is absent (`?noV91`) every facing falls back to the baked,
facing-less `throw0..5` exactly as before, and `throwSeq` keeps forcing `m.flip = false` for them,
because one drawing cannot be mirrored into a second facing. With a drawn cycle the flip is left
alone, so a quarterback throwing to his left mirrors.

**The hand follows the art.** On a drawn cycle the throwing arm is the artist's, not the anatomy's:
the v105 held-ball offset takes `handX` from the CELL (`throw_up` right, `throw_dn` and `throw_ur`
left) and crosses it when a quarter facing is mirrored for a man working right, instead of from
`handed`. The windup arm also rides the FRAMES now
(`(tms - seqT) / (throwFrameMs × throwReleaseFrame)`) instead of a 430 ms clock of its own: cocked
at the ear on frame 3, through the ball on frame 4. And because frames 0–3 of every drawn cycle
already carry a football in the hand, the renderer's own ball is **scaled to zero** across them —
two footballs otherwise — and comes back on the release frame, which is the frame the flight
starts. (Scale, not `setVisible`: the v1513 ball guard forces visible and alpha back every update.)
`carry_up` is the same situation standing still — it is cut with the ball in the screen-right hand,
so ours is pinned there whatever hand the man throws with, and the two read as one.

**The release is armed by a lookahead.** The legacy choreographer emits `windup` 300 ms before
the ball — one frame short of the 340 the six frames need — and FieldSim, the path that renders
~9 plays in 10, emits none at all, so on the ordinary play the quarterback never wound up. Both
paths now go through `windupV107(P)`, called beside `qbTickV86`: it scans `P.script.events` once
per play for the non-kick `throw`s, and `throwFrameMs × throwReleaseFrame` before one it calls
`startThrowV107`, which turns the thrower onto the target (facing AND flip), sets
`forceState = "throwSeq"` and BACK-DATES `seqT` so frame 4 is drawn the same tick the flight
starts. The `windup` event case now only does the ball bookkeeping and starts the sequence if the
lookahead somehow did not. Measured residual between the drawn release and the flight: 0 ms.

**The dropback is a backpedal.** `qbTickV86` already sets `m._dropback`; `placeMarker` now draws
`backpedal0..5` for a dropping man facing `up` when the kit has the cells, paced by the ground he
covers the way the run frames are (`TU("backpedalFrameMs", 110)`, `TU("backpedalSpd", 58)`), and
falls back to the run frames without the atlas. Rear-view art, so it is the offense only. The flag
itself needed a hold: v86 tests ONE frame's backward delta, which flickers as the interpolation
crosses it (and vanishes entirely at a slow playback rate, where the per-frame step is smaller than
the threshold), so the pose flickered with it — `TU("dropHoldMs", 200)` keeps the drop alive a beat
past the last backward step and the backpedal reads as one continuous movement.

**The stances.** The sheet is drawn from behind, which means it dresses the OFFENSE (`m.homeDir`
is `up` for actors 0–10) and nothing on the defense — a defender faces the camera, and faking his
backpedal or idle with rear-view art would be a lie. Pre-snap the offensive line shows `stance3_up` — the center too (the sheet's
centre-over-the-ball pose is not cut: its arms read wrong; `centerV105` puts the ball under him)
and the skill men `ready_up` in place of `idle_up`; a man standing still with the ball shows
`carry_up`. Each is gated on the texture existing, so `?noV91` keeps `stance`/`stance2`/`idle`.
The defensive line keeps `stance`/`stance2` either way.

`window.__V107` carries `map` (the facing → cell table), `v91`, `throws` (the last 24, each
`{facing, flip, src, frames, releaseFrame, flightStartMs, residualMs}`) and the
`backpedalFrames` / `readyFrames` / `stance3Frames` / `carryFrames` counters.
`scripts/v107check.mjs` is the proof.

## v106.1 — the page knows when it is stale

The site is static on GitHub Pages, which sends `cache-control: max-age=600`: a browser that opens
`index.html` keeps it for ten minutes without asking. Every menu file and every kit mask is fetched
at a `?v=<stamp>` baked into that page (`scripts/bake-menu-into-index.mjs`), so a stale page means
a stale menu wearing a stale kit — and a change that merged and deployed reads as "nothing
changed" to anyone who looks inside those ten minutes, or who reopens a tab the browser restored.

`scripts/assemble-pages.mjs` writes the build's version (the commit sha on Pages) into the copied
page as `<meta name="rib-build">` and into `rib-build.json` beside it. `freshV106` in
`public/rib-menu.js` runs once, on the menu's first mount: it fetches `rib-build.json` with
`cache: 'no-store'` (past the browser cache; the Pages CDN is purged on deploy) and compares. Same
version: `fresh`, nothing happens. Newer: it records the served version in `sessionStorage`,
fetches `location.href` with `cache: 'reload'` so the fresh page lands in the cache the reload
reads, and calls `location.reload()`. If the reloaded page still carries the old version (a CDN
lagging the json) the record says it already reloaded for this build and it stops: `gave-up`,
never a loop. A page without the meta (`npm run dev`, a `file:` build) is `skipped`; the
Capacitor bundle ships page and json together, so they always agree. `?stayStale` leaves the
verdict on `window.__RIB_FRESH_V106` without reloading. `scripts/freshcheck.mjs` proves all of it
against a throwaway static server. The rule that remains: every change to a menu file needs a
new `RIB_MENU_VERSION`, or the browser keeps the old file under the old stamp.

## v106 — the kit is cut from the picture

The main menu's team colours are recoloured copies of three photographs clipped by alpha masks
(see v89 MAIN MENU below). Until v106 the masks were hand-placed polygons at 1% of the picture,
and every pass that moved a vertex fixed one edge and broke another: the jersey past the sleeves,
the pants on the crowd, the helmet in the lights, grey cuffs and a grey waist, and the whole lit
flank of the portrait shell left gold. **A polygon is not an outline. The picture is.**

Each photograph now has its own segmenter in `scripts/`, run in order by `build-menu-art.py`
and runnable alone; each writes its masks straight into `public/menu/` and prints its own
coverage and bleed report:

- **`menu-kit-hero.py`** (`art/menu/hero_tunnel_wall.png`). Every garment is bounded by four
  curves. A prior in percent says roughly where each runs; `trace()` walks it in 0.2% steps and
  casts a ray across the boundary, taking the OUTERMOST strong luminance step within a small
  radius — outermost, so the lit rim on the fabric's own edge counts as fabric — then a median
  filter kills outliers. Where the edge is undetectable (a hem crossing a scan line flat; the
  black-on-black arm/torso seam) the radius is 0 and the prior is used directly. Each row of each
  garment is a single interval, so `garment = span(xL..xR) ∩ y≥top(x) ∩ y≤bottom(x)`; jersey and
  pants share ONE waist curve so they meet with no seam. GrabCut was tried and rejected: it took
  the bright wedge of tunnel floor between torso and arm.
- **`menu-kit-card.py`** (`art/menu/card_continue.png`). The kit is neutral grey under hard
  side light while arms, crowd, sky and grass carry colour, so RELATIVE chroma
  `(max−min)/luma` separates garment from everything else where luminance cannot. Each boundary
  is snapped row-by-row to the strongest neutral/chromatic step near its prior with a cost for
  leaving it, median-filtered, and laid head-to-tail into two closed outlines (helmet, body);
  the leg gap is subtracted and jersey/pants split along the measured hem crease. The neck between
  the shell's rear pad and the collar is bare skin and is out; so is the sliver of sky between
  the facemask strap and the shoulder.
- **`menu-kit-portrait.py`** (`art/menu/portrait_helmet.png`, through the same crop the build
  uses). No colour key can work here — the lit flank reads as dim as the glow behind it — so the
  shell's silhouette is a radial rim trace (the outermost bright sample over a 222° arc, median
  filtered) closed by a traced cut along the visor's edge and the bottom lip; the facemask is a
  white top-hat lattice (keeps the tubes, drops the glass and its reflections) closed across and
  along each bar. The visor glass stays untinted on purpose.

Output is the same in all three: a full-resolution boolean, BOX-resized to half (exact coverage,
no ringing), a ~0.9px blur, RGBA WEBP with RGB zero. Each script asserts alpha is zero beyond a
few source pixels of its traced kit, and names any `menu-mask-check.mjs` probe that sits off the
garment it measured (nine did, all on the old polygons' overshoot; they were moved). The menu
build stamp moved to `v106-kit` so cached masks are refetched. To adjust an edge: change the
prior curve in the script, rerun it, and look at the overlay and edge crops it writes
(`MENU_KIT_DEBUG=<dir>`), then `menu-kit-shot.mjs` on the live menu.

## v105.2 — the kit follows the team

`ribRegisterTeam` registers kits by **palette**: `"off"` from the user's team palette (in
`ribActivate`), `"def"` from the opponent's (`ribSyncOpp`), `"you"` as a copy of one of those
(`ribSyncYouKitV96`). The renderer dressed each marker by **side** — `setTeam(m, a.side === "off"
? "off" : "def")` — which is only right when the user's team has the ball. On the opponent's
possessions the sides swap relative to the palettes: their offense wore the user's colours, the
user's defense wore theirs, and `highlight()` then keyed the you-player's kit off `d.team` —
`"def"` — so a user playing defense wore the opponent's palette too.

A marker now has two fields. `m.team` is the **side** (`off` / `def` / `you`); the engaged-pair
depth lift (`m.team !== "def"`), the fallback labels and every gameplay rule keep reading it.
`m.kit` is the **palette** it wears; `kitForV105_2(side, et)` returns `"off"` for the user's team
and `"def"` for the opponent from `et.offense !== "them"`, `setTeam(m, team, kit)` and
`marker(..., kit)` carry it, and `placeMarker` builds every texture key from `m.kit || m.team`.
`highlight()` sets `d.kitSide` from the kit the man arrived in, so `ribSyncYouKitV96` copies
his own team's palette whichever side of the ball he plays. The sideline's `sidePlayer(team, …)`
already meant palette by `team` (a backup wears the kit of the sideline he stands on) and is
untouched. `window.__V105_2.you` reports the you-player's side and kit for the check.

## v105 — the ball has a handler

**What was wrong.** Before the snap the ball sprite sat on the sim's ground spot at the line at
depth 9 — *above* the trench markers (4 + sy·0.02 ≈ 8.4 there) — so it drew across the center's
waist with the QB standing right behind him: he looked like he already had it. `case "snap"` then
set `ballHolderId = 8` and the ball was in his hand the same frame. `case "handoff"` did the same
to the back. No exchange had any motion.

**The hand** (`v105 THE BALL HAS A HANDLER`, `handV105` / `handPosV105`). An exchange opens a hand:
`P._hand = { x0, y0, t0, ms, arc, kind, toss }`, where (x0, y0) is where the ball is drawn the frame
the event fires. Every frame after, the ball block computes the holder-mounted resting position as
before, and `handPosV105` returns the point between the hand's origin and THAT position — so the
target is re-aimed every frame and a QB dropping back still receives the snap in his hand. A snap
eases out (fast away, settling); a handoff and a toss travel evenly with a sine lift of `arc`. A
toss is a CALL — the playbook's sweep family (toss, jet, outside zone, pin and pull, reverse), read
off `payload.desc` — longer (`tossMs` + `tossMsPerPx`·d), higher (`tossArc`), with the sprite on
the v91 tumble frames; every other exchange is a quick low flick timed by the gap (`handoffMs` +
`handoffMsPerPx`·d), because the sim stages no mesh: the QB drifts while the back is already on
his path, so the two are a few yards apart when the sim switches the carrier. A throw closes any
open hand (`P._hand = null`) and records `P._thrower` for the flame. Kicks keep the sim's own
long-snap flight (`snapCatch`); a kickoff has no snap.

**Under center.** During the huddle glide (`P.t < P.delay`) the ball is placed on the grass at the
spot, ground size, at `ballGroundDepth` (3.9 — above the shadows at 3.5, below every marker).
Once the offense is set, `centerV105` (actor 5, when no holder, not snapped, not a kick) becomes
the holder with `ox = 0, oy = ballUnderCenterY`, depth a hair behind him.

**The trail** (`trailV105`). One `Graphics` (`this.ballTrailG`, destroyed with the actors), cleared
every frame, redrawn from `P._trailV105` — the ball's screen positions over the last `trailMs`.
Drawn only when `why` is set: a hand (`snap`/`hand`), a flight, a kick, a loose ball, or a HOT
carrier above `trailCarrySpd`. Tapered to the tail; one pale strand for a gust (cream for the
snap); in flight two strands pushed off the path across its own direction by a sine of each
point's age, in antiphase — the double helix that reads as the seam turning (`spiralR`,
`spiralRate`); for a hot ball three strands (red glow, orange, near-white core) with a flicker,
plus embers spawned every `emberEveryMs` that drift up and die.

**The heat book** (`heatV105`, called from `complete()`; `hotV105` reads it). Keyed
`us:<idx>` / `them:<idx>` on the scene (it lives for the game). A completion heats the arm (+1,
+2 big); an incompletion, sack or turnover cools it (−1); the man who finished with the ball is
heated by the play's size; everyone else on that offense cools by `heatCool`. `heatHot` (3) is the
line, `heatCap` the ceiling. At the snap a man over the line who has not yet said so pops
**ON FIRE!** (`_heatSaidV105`, cleared when he cools).

**The perspective default** moved from 0.45 to 0.78 in the three places it lived (`buildPersp`,
the Settings row, `__pushFieldFx`); a saved `fxDepth` still wins.

`window.__V105`: `hands`, `snap`, `handoff`, `tosses`, `lastHand`, `trailFrames`, `flameFrames`,
`plays`, `heat`.

## v104 — the number on the jersey

Three separate problems lived in four lines of `placeMarker`: the label was created at a fixed
`"10px"`, `setFontSize`'d to `"8px"` / `"9px"` / `"10px"` and `setY`'d to `+0.5` / `+1.5` / `-3`
on every marker on every frame.

**It bled into the pants.** `-3` and `+1.5` are offsets from the sprite's own centre, which on a
48px cell is row 24 — the bottom of the shirt on a front-facing idle, and *inside the trousers* on
an up-facing one. Every rear pose, idle and block alike, wore its number half on the waistband.

**It was the wrong size, inconsistently.** The label sat inside the marker container, so it was
multiplied by the v27 perspective (0.71 near the far end line, 1.22 at the near one) — correct, the
man shrinks too — but NOT by `m.body`'s own scale, which the v20 build traits set per position
(`POS_SIZE`: a nose tackle is 1.19 × 1.12, a corner 0.93 × 0.99). So the same numerals read
painted-on on a lineman and oversized on a small defensive back, and near the camera a 10px raster
was being upsampled by a fifth.

**And it cost a frame.** `Text.setFontSize` re-renders the text canvas, so ~100 of them were
re-rasterized every tick to set a value that had not changed.

**The bands** (`v104 THE NUMBER ON THE JERSEY`, `numBandV104`). `ribRegisterTeam`'s `put()` scans
each SOURCE cell once — before the recolour, so one answer serves every team — for the same two
hue bands `ribRecolor` keys on, plus the silhouette width per row. Three landmarks come out:

- **The waistband**: the first row the secondary (pants) colour owns outright — `S >= 6 && P <= 2`,
  holding for four rows. The `P <= 2` gate is what keeps it off the chest: a gold sleeve trim or a
  jersey stripe always has jersey around it.
- **The collar**, read two ways because neither alone covers every pose. PINCH is the narrowest row
  just under the head — right on most poses, fooled by a celebration with both arms flung out,
  where the widest rows *are* the shoulders. BREAK is the last row still no wider than the helmet
  itself — right on those, but it runs away down the body in a throwing pose whose torso is barely
  wider than the head. The higher of the two is the answer.
- **Where the shirt runs out**, which is not always the trousers: a lineman in a three-point stance
  has his legs tucked behind him, so the pants colour never shows until his shins while the jersey
  stops at his elbows. The band's floor is the last row still carrying jersey.

Cached in `RIB.numBandSrc` (by source cell) and `RIB.numBandTex` (by texture key). Poses that never
show a number — on the ground, a dive, a detailed catch/juke — may come back `null`;
`NUM_BAND_FALLBACK_V104` covers a texture that arrives without one.

**The placement** (`numPlaceV104`, called from `placeMarker` only when the number is visible). The
numeral is hung from the WAIST — the stable landmark, ±1 row across a whole run cycle, where the
collar wanders two — at `numFrontRise` (6) rows for the chest and `numRearRise` (8) for the back,
which is what puts the rear number on the shoulder blades instead of the belt. Its height is
`numCellH` (6) **cell rows, constant**, so it cannot breathe frame to frame; a shirt too short for
it gives up its `numWaistGap` breathing room first, and only a doubled-over pose shrinks the
numeral. Everything is multiplied by `m.body.scaleY`, so the number is painted on the shirt rather
than floating at a fixed screen size in front of it, and clamped at both ends so the ink can reach
neither the pants nor the helmet. `numWidthK` keeps a two-digit number inside the chest it is
written on.

**The raster** (`numStyleV104`, `numFontV104`). The label is built once at `numFontPx` (20) and
`setScale`d DOWN per frame, which is the sharp direction and removes the per-frame re-rasterize.
`numFontV104` measures the text object's own canvas for the digits' INK box — a text object centres
its *line* box, and the digits sit below that centre by whatever descender room the face carries —
so the number lands where the art says regardless of which font actually resolved; `document.fonts.
ready` invalidates the measurement. `numStroke` (2.2 at the base size) is the thin dark outline that
keeps a white numeral readable over a pale kit.

`window.__V104` carries `.bands` (the whole per-texture map), `.font`, `.last` and `.cell(srcName)`,
which hands a check the source art so `v104check.mjs` can re-derive a band rather than trust the
cached one.

## v103 — the grab, the pile, the strip, and the line that works

**The grab** (`v103 THE GRAB` in `contact()`, `v103 THE GRIP TICK` at the top of the carry block).
`contact()` step 5 no longer emits the tackle and returns `"tackle"`. Unless the collision was a
hit stick or a wrap into a waiting crowd (`handsOn >= gripMaxHands`) it opens `c._grip` and returns
`"grip"`; the chaser loops break on that and hand the carrier to the grip tick, which runs before
anything else in the carry block and `rec(); continue`s so no other defender touches him.

The grip tick, once per tick: **travels** the pair (his gear is capped by `gripVelCap` — a man with
another man on his back does not coast to a stop over ten yards — and the tackler's position is
*written from the carrier's*, which is what makes the two sprites read as one thing sliding);
**piles on** anyone who gets inside `gripJoinPx`, shortening the grip; **strips** the ball
(`out.fumble`, see below); flags a **horse collar** on a grab from dead behind (`flagCand.hc`,
rolled by the engine at `hcFlagP` like the face mask); lets him **strain** for the sticks when he is
inside `secondEffortYd` of the marker or the goal line (which is why the run ctx now carries
`down`/`toGo`/`fieldPos`); lets him **break** out of the wrap; and finally **lands**, emitting the
tackle with `dragged`, `dragYd`, `dragMs`, `strain`. `endTackle` skips its blind fall-forward fudge
when `c._wasGripped`, because the drag just played that out for real.

Two things are deliberate here. Whether the stop is **booked** as assisted is rolled ONCE when the
first man joins, on the same `gangOpen`/`gangBox` + `handsOn * gangHandsK` odds the instantaneous
path uses — the pile is physical, but brushing it is not being in on the tackle, and without the
roll the solo/gang split collapses to fifty-fifty. And `youIn` requires the stop to be genuinely
assisted AND you to be one of the men with hands on; `creditcheck` fails the build if that drifts.
`gripV103` at 0 restores the instantaneous tackle exactly.

**The strip.** A run fumble used to be pre-rolled in the engine *outside* FieldSim — nobody named,
nothing animated, the comment even says "no coin-flip credit". The grip tick strips the ball at the
pile and returns `out.fumble = {by, forcedBy, defRec, yards}`, which `run()`/`pass()` carry out as
`X.fumble` and the engine books through the ordinary `flip` path, keeping the render log so the
fumble is *seen*. The pre-roll survives at `fumblePreK` for what the sim cannot see (the mesh-point
muff). Forcing a fumble credits `P.ff`, never `P.tackle` — there is no tackle event to trace.

**The line** (`v103 THE LINE BLOCKS FOR HIM`, `v103 THE TRENCH BREAKS UP`). v81's "find a job" only
ran on called RUNS and picked the body nearest the LINEMAN, so on a catch-and-run the whole front
stood and watched. It now runs on any carry the offence has and scores candidates by distance to
the BALL (`climbBallW`) ahead of distance to the blocker, gets between the man and the carrier, and
re-emits `block` with `sustain` on a heartbeat so the broadcast can hold the engagement. On the
other side, once the carrier is `trenchBreakPx` past the line there is nothing left to block: the
shed odds jump by `trenchBreakK` and the release emits `disengage {chase:true}`.

**After the whistle** (`v103 THE WHISTLE IS NOT THE END OF THE CONTACT`). v86 released every grab,
block and stance on the same frame. For `lateContactMs` the men at the spot keep their grip and
churn on their own phase (`m._late`), the two or three nearest men who were still closing cross the
last yards and shove in (`P.post.late`, a puff, a jolt and a knock of the camera), and only then
does the v86 gather run — `postPlayMs` was lengthened to leave room for both halves.

**`retagSimLog(y)`.** `takeLog` matches a queued play log to the play being rendered by its EXACT
yardage, so every time the engine reshaped a sim's yards afterwards (`dampV76`'s margin brake is
the common one) the log it had just pushed could never match again: the play fell back to the
legacy choreographer, none of the agent sim reached the screen, and the orphan sat in the queue
getting in the way of later matches. The log is still the right log; only the number moved, so it
is retagged. **Any future post-sim yardage reshape must call this** — it took plays rendered from
the real sim from 57% to 80% on passes.

## v102 — the mirrored lights, the slowed moment, the living menu

**The lights are mirrored** (`buildMirrorMastsV102`, called at the end of the far loop in
`buildStadiumV92`). The far four stay in `ST.towers` exactly as v92/v98/v99 built them (fixed row,
two sway, the key light at index 2) — every existing check and `keyLightV99` read them unchanged.
The mirror lives in `ST.mirror` / `ST.mirrorLights`: the near four take the far masts' lateral
fractions, invert `crowdProject`'s lateral scale to get their crowd-space `vv`, and project them
at `u = -crowdEndGap` (the near end line's apron), scaled by the near end's `k` relative to the
far end's (capped at `mirrorScaleCap`). `lightRigV98` gained a store argument and per-mast
aim/pool overrides (`tw._aimX/_aimY/_poolX/_poolY/_poolK`) so a near mast lights the near half.
`lightRigsV101` returns all eight (flag `near`), so the men's shading and the fill shadow read
every mast.

v102 also stood a mast behind each touchline stand at midfield, anchored to the drawn stand
SECTION. **v103 removed them.** Those stands are diagonal billboards, and the crowd builder
documents that such a band's bounding box necessarily overhangs the playing surface — so
anchoring inside it put a pole on the grass, bleeding over the sideline at any ordinary play
zoom; projecting the foot further out instead put it on the apron in front of the benches. The
near and far masts already light the whole field.

**Nothing stands on the grass** (`turfRowsV103` / `onTurfV103`), and in the end nothing stands at
the near end at all. The first guard tested a world rectangle — is the foot inside `0..FW` ×
`NSTOP..NSTOP+NSH`? — and that is the wrong shape. `PJ` fans the playing surface out toward the
camera: some 400 scene px across at the far end line, **1200** at the near one, reaching down to
y ≈ 2254. So the two inner NEAR masts, whose feet sit at y = 2497 and whose art is three times
far-mast size, passed the rectangle with room to spare while their lamp banks were drawn squarely
on the near-end turf — the bleed a player reported on the right touchline.

`turfRowsV103` samples the real quad instead (`TU("turfProbeRows", 24)` rows, each the screen span
of the two painted touchlines at that depth, sorted by y because `VDIR` flips which end is which);
`onTurfV103(box)` walks the bands between consecutive rows and asks whether the box crosses any of
them, with a deliberately small `TU("mastClearPx", 8)` tolerance — a scene pixel at the far end
line is worth several yards of depth, so a generous margin there would condemn the far masts,
which stand honestly behind the end line. The rows are re-read at the top of
`buildMirrorMastsV102`, so they follow the perspective sliders.

A mast that bleeds is kept as a LIGHT and not drawn: `tw._litOnly` hides the mast and (through
`lightRigV98`'s `litOnly` argument) the bloom around its lamp bank — a glow with no lamp under it
is the same lie — while the beam and the pool stay, because those *are* the light.
`lightRigsV101` and `lightLiveAllV102` both accept `tw.visible || tw._litOnly`, so a lit-only mast
still shades the men and still breathes.

**`mirrorMastsV102` then went to 0.** Asked for lights on the north side of the ground only, the
whole mirrored bank is off at its dial's default: `ST.mirror` is empty, `lightRigsV101` counts the
far four, and the near half is lit by them and by the turf's own baked wash, as in v98. The bank
below the dial is unchanged and one number away, and the guard is what keeps it honest if it comes
back. `window.__V92.turf()` and `window.__V92.onTurf()` are what `v102check.mjs` reads.
The crowd deliberately builds no near bowl (billboards would paint over the field), and the near
masts inherit that: they are behind the camera; their pools, beams and fill are what shows.

**The light breathes** (`lightLiveV102(tw)` per mast, `lightLiveAllV102()` for the whole ground,
cached per tick on `ST.t`): a few percent of slow multi-octave shimmer on the mast's own phase,
plus a sputter every 14–40 s per mast — a 80–170 ms dip of 18–35 %, sometimes twice, showing a
different sheet frame while it dips. Every rig's glow/beam/pool alpha, `shadowMulV100` and
`lightAtV101` multiply by it; `keyLightV99` does not, so shadow DIRECTION never moves. The v98/v99
"holds steady" assertions became "breathes inside a band" (range < 45 % of mean; ≤ 2 frames per
mast; v92's 30 s watch allows a handful of frame changes). `lightLiveV102` at 0 restores v99.

**The moment slows down** (`slomoV102(P, delta)` in `update`, `slomoDrawV102`). The rate line
multiplies `basePlayRate` by `min(cineScale, antic)`. The system walks `P.script.events` ahead
of `T` for the next event in `slomoBookV102` (catch, highpoint, contest, pick, swat, fumble, td,
a `cut` whose `kind` is a move, stiffarm, hurdle, brokenTackle, stagger, tackleHit, pancake,
toetap, firstdown — each with its own floor), merges anything inside `slomoMergeMs` into one
window (capped at `slomoMaxMs`), then eases the clock down over `slomoLeadMs` BEFORE `start`,
holds the floor through `end`, eases up over `slomoTailMs`, and arms a `slomoCoolMs` cooldown.
The letterbox is a DOM overlay (`.rib-slomo-v102` in `.field-wrap`, `--k` = depth) — a
scroll-factor-0 graphic would still take the follow camera's zoom — with the moment named on the
bar; a gold ring (`slomoRing`, depth 3.9) pulls onto the men named by the window's events; a zoom
punch lands at `start`. `window.__SLOMO_V102` counts windows, kinds, `minRate`, `bars`.
Render-only; reduced motion or `slomoV102` = 0 returns 1 and clears the overlay.

**The menu is alive** (`public/rib-menu.js`: `heroFxMarkup`, `startHeroFx`, `stopHeroFx`;
`public/rib-menu-v89.css`: the `rib9*` keyframes). The hero gains a `.rib9-hero-fx` layer: five
`.rib9-lamp` glows at `HERO_LAMPS` (each with its own flicker duration/delay and an 11 s sputter),
`.rib9-sun` + `.rib9-sun-rays` (a conic-gradient ray wheel, masked, 46 s rotation), and a canvas
loop — 46 dust motes drifting on a gusting wind, camera flashes popping across the stands band,
a shimmer sweeping the tiers. `.rib9-hero-img` and the portrait breathe (a 4.4 s scale), the
swash flutters, the jersey and brand gold sweep, and `.rib9-sheen` is a screen-blended gradient
masked by the wordmark itself — the mask URL is built document-absolute (`artUrl`) because a
`url()` handed through a custom property resolves against the STYLESHEET. `startHeroFx` runs
from `applyDynamic`; `stopHeroFx` from `unmountMenu`; the loop idles while `document.hidden` and
never starts under reduced motion. `window.__RIB_MENU_FX_V102` is the hook.

## v101 — the asset root, the playbook, the lead, the second cast

**One asset root.** `window.__RIB_ASSET(name)` (boot shims) is the only way a sheet is asked
for. Before it, half the sheets asked for `/rib_x.png` and half for `./public/rib_x.png`; the
first 404s under a Pages sub-path, the second 404s out of `vite build`, and both fail the same
silent way — `Image.onerror` shrugs and the drawn players never register, leaving a field of
blanks. Every `.png`/`.json`/`.webp` the game fetches at runtime now goes through it.

**The playbook** (`PLAYBOOK_V101`, `pickPlayV101`, just above `Yr`). Forty-two named calls —
eighteen runs, twenty-four passes. A play declares the FAMILY it belongs to (`base`, one of the
original nine concepts, so every downstream consumer keeps its vocabulary), what the sim should
do with it (`gap` for a run — its point of attack, read by `holeGapKey`; `routes` for a pass —
shape names from the v55 tree, read where receivers are assigned), a commentary `tag`, and a
`fit(ctx)` weight over `{down, toGo, pos, quarter, margin, hurry}`. The old if/else chain still
runs and its answer becomes a `playbookBiasK` thumb on the scale rather than a verdict. The
called routes go to the primary and **one** complementary receiver; everyone else keeps rolling
the whole 405-combination tree, which is what stops a bigger playbook from shrinking the route
board. `TU("playbookV101", 0)` puts the nine families back.

**The lead** (`v101 THE LEAD`, in FieldSim's pass setup). Three separable numbers:
- *the guess* — `leadPointV101` walks the receiver forward along **his own route**
  (`walkRouteV101`, waypoint by waypoint, then off the last leg's heading) for as long as the
  ball will hang, re-times the flight to that further spot and walks him again; two passes
  converge on the intercept point. A lob hangs longer so it needs a bigger lead, which falls out
  of the solve rather than being a case;
- *the execution* — `leadSkillV101` is how much of that lead he actually puts on the ball
  (throwing + awareness, minus panic and throwing on the move, plus noise). Under 1 and the ball
  is behind him;
- *the cone* — `coneYdV101`, the miss in yards: arm, depth, `(1 - protection)`, panic, throwing
  on the move, minus separation. `windowV101` grades it green/yellow/red from separation AND
  protection AND the cone, so green means "open and throwable", not just "open".
`protV101` reads the pocket as one number (free rushers, how close the nearest is, slides,
climbs, rollouts) and `qb._panicV101` accumulates during the drop — rising while someone is
bearing down, jumping on a hit, bleeding off when it cleans up, with composure (discipline,
grit, awareness) setting both its slope and its ceiling. The style ladder (lob / touch / bullet)
reads depth, the cover man's **leverage** (under the route → throw over it; over the top →
throw under it on a line), pressure and panic. All of it is emitted on `throw` and, live, on
`look` — which is where the drawn v20 vision cone gets its width, so the wedge on screen IS the
accuracy cone. `window.__V101.last` is the last throw; `throwprobe`-style wrapping of
`__FieldSim.pass` is how `v101check` measures it.

**The light moves on him** (`v101 THE LIGHT MOVES ON HIM`, next to v99/v100). v99's key light is
untouched — same single, non-wobbling cast, same geometry. Added around it: `castFillV101`, a
second and much fainter shadow from the nearest mast that is NOT the key (so the cast fans as a
man crosses the field, and it is the first thing to go as the v100 dial comes down); a **speed
smear** that stretches the key shadow along its own axis and thins it at a sprint; and
`lightAtV101` / `shadeTintV101`, which light the players off the actual **lamp pools** (ambient
floor plus quadratic falloff per mast, lengthwise distance squashed because the masts stand
behind the far end) instead of v29's fixed grey depth ramp. `TU("shadeV101", 0)` restores v29,
`TU("fillShadowV101", 0)` drops the second cast.

**The sim loads behind the door** (`v101 THE SIM LOADS BEHIND THE DOOR`). v97 held the first play
at the loader's door and then started it — load, then run. Now the wait does the work:
`GridironPhaser.animate` calls `__LIVELOAD_V94.ensure()` (a synchronous mount, so the hold never
loses the race with the DOM insert the career app makes in the same breath), then
`bridge().prewarm(payload)` — which mounts Phaser and runs `scene.prebuildV101`, caching the
play's whole `buildPlayScript` against its own payload. `simReady()` tells the loader; the door
opens only once the field is standing AND that build is done (ceiling 4.2s), and `animatePlay`
finds the script already made. `window.__PREWARM_V101` counts `built / hits / misses`.

**The stands have a vocabulary** (`emoBookV101`). One emoji list per moment — 💥 for a sack, 😡
for a flag, 🥞 for a pancake, 🎉 for the score — falling back to v98's two pools for anything
unnamed. Fifteen more event types reach `crowdReact` (sack, safety, swat, flag, juke, spin,
truck, scramble, blitz…), a big moment jumps the anti-chatter gap (`crowdEmojiBigGapK`), and the
shout bubbles carry a matching face.

**Whole numbers on the sheet** (`W1`). Every player-facing number on the skills surfaces is
rounded where it is DRAWN, so the model keeps its precision and no row ever reads `13.4 → 12.8`.
A sub-point per-game swing on the personality chips is stated in words instead of as `-0.1`.

## The chase (v94) — the loading screen, and the live game's loader

One engine, two doors. `window.__CHASE_V94` (its own `<script>` right after the boot shims,
so it runs while the Phaser bundle is still parsing) loads the v91 cell map and atlas once
(`load()`, a cached promise) and `make(canvas, opts)` runs a chase on any canvas: a beat
loop at the display's frame rate — `sprint` (the defender closes, capped at 18px behind),
`look` (the runner draws `run_dr` flipped, down-left reads as over the shoulder; the
defender bursts), then `juke` (`plant_sd` → `cut_sd`, a lane change of `laneGap`; the
defender `dive_sd` → `fall_sd` → the eight `getup_dr` frames) or `spin` (the runner's body
turns through `run_sd` flipped → `run_dn` → `run_sd` → `run_up` → `run_sd` flipped over
320ms while the defender `plant_sd` grabs air and staggers through `hurt_dr0/1`),
`recover` (he catches back up) and `sprint` again, `loops` counting each full cycle. The
beats roll (80% a look first; juke or spin 60/40). The run cycle is locked to the ground covered — one frame per `T.stride` turf px of
movement, not a timer — so a faster man's legs turn faster and nobody's feet slide; the
body lifts twice a cycle on the stride phase, leans in with speed, and lands on whole
device pixels so the sprite never shimmers between frames. When the defender is upright
inside `T.closeAt` turf px behind him (`S.close`), an exclamation pip pops in over his head
(`alertMark`, ease-out-back, jittering and hopping while the man is on him) and fades when
he pulls clear (`S.alert`). The sprites draw at `scale` 1.9. **The cast** (`castIn` /
`stepCast`, `S.cast`, up to `castMax`): on every sprint and recovery another defender comes
in on an angle — from the stands side or the near touchline, alternating — on a pursuit line
to the runner (`run_ur` / `run_dr` while he closes, `run_sd` once level), dives when he gets
there, misses, gets up and jogs out of the shot. **The exit is a run-through**: at the
crossing (`S.crossed`) the chalk flashes, confetti bursts and the caption says TOUCHDOWN, but
the runner keeps running at 1.45× while the camera holds at the goal line, so he runs out of
the shot instead of celebrating. `opts.fullCycle === false` lets a door open after `minMs`
at the first quiet beat without a whole cycle — the live game's loader uses it. Around them: stands with a crowd on two
parallax layers (rolled once, `crowd()`), yard numbers every ten, a camera that keeps the
runner at 38% of the strip, bobs with the stride (`camY`) and shakes on the dive
(`shake`), speed lines and a stretched shadow at full tilt, afterimages (`ghosts`) through
the cut and the spin, grass tufts off the plant and the fall, and a chalk caption calling
the beat (`CAPS`). The ball is `ball_spin0` drawn small BEFORE the body, tucked behind the
far arm, so only a sliver shows past the elbow — not a spinning prop.

**The exit** (`setBeat("exit")`) is the touchdown: the end zone paints in `crossAt` ms
ahead (navy, "THE LEAGUE" in gold), the defender's last dive misses, the runner crosses
(`S.crossed`), the chalk flashes white, confetti bursts, the caption says TOUCHDOWN and
the `celebrate_dr` frames cycle until `exitMs`, then `opts.onDone`. `ctrl.arm()` is the
door: the exit waits for the arm, `minMs`, **one full cycle** (`loops >= 1`) and a beat that
is not a move (sprint or recover), so the door never opens mid-juke and never before the
whole choreography has played once.

**Door one, the splash** (`window.__SPLASH_V94`). `#splash` holds a `.splash-stage` with
`<canvas id="splashChase">` and the old football behind it; when the sheet lands the
splash gains `chase` (CSS swaps the canvas in) and a chase starts with `minMs` 2600. The
career app's `go()` used to add `gone` at 1100ms; it now calls `window.__splashDoneV94()`,
which arms the chase (or, before the sheet lands, arms it the moment it does, with the old
1100ms fallback if it never does). `onDone` runs the old `gone` fade and removes the node.
Reduced motion draws one posed frame and leaves on arm. `#splash` sits at z-index 10050
because the v89 menu's overlay layer is 9999 and the splash now outlives the first paint
of the menu.

**Door two, the live game** (`window.__LIVELOAD_V94`). A MutationObserver on `#screen`
waits for a `.field-wrap` to arrive (the live view rendering) and mounts
`.rib-liveload-v94` over it — the same gradient as the splash, a chase canvas, the
matchup read off the scorebug ("STORM vs RANGERS"), "TAKING THE FIELD" and a bar — with
`minMs` 1700. It polls for `window.__gridironScene` with markers (the Phaser bridge
mounts on the first draw, registers the sheets, seats the crowd), flips the caption to
KICKOFF and arms the chase; the exit beat plays and the overlay fades. A wrap is tagged
so it shows once per live view; the field being torn down, or 9 seconds with no scene,
ends it. Reduced motion skips it. `scripts/splashcheck.mjs` boots three ways and then
drives into a live game for the loader.

## The callout wall (v95) — the badges over the field

Fifteen hand-drawn badges in `art/badges/` (three sheets on a near-black ground) are cut
by `scripts/build-badge-art.py` — alpha recovered from distance to the ground colour, an
un-blend so glows keep their colour, blobs found on a dilated solid mask, a short row
split at its thinnest column when two badges' streaks touch — into `public/badges/
<name>.webp` (max 480px wide, ~85KB each, fetched lazily and preloaded on the first
play) and the manifest `RIB_BADGES_V95` (name → [w, h]).

**Data first.** `BADGE_BOOK_V95` is one row per badge: `tier`, `prio`, `entrance`,
`hold`, and the optional `freeze` / `punch` / `slow` (the scene's own `hitStop`,
`zoomPunch` and `slowMoment`), `shake`, `dim`, `rays`, `flash`, `streak`, `lines`,
`flag`, `ball`, `ring`, `particles {kind, colors, n}`, `sound`, `pulse`, `snap`. A new
badge is a new row plus a `show()` call.

**Three tiers, two lanes.** Tier 1 (TOUCHDOWN, TURNOVER, GAME CHANGER, FIELD GOAL) is the
takeover at dead centre: the freeze and the punch land first (`gameplayFx`, the badge
waits `freeze` ms), then the dim, the conic rays, the slam (`0.65 → 1.1 → 1`, or the
anchor flight when the event has a field position), the crowd flash at arrival,
particles off the badge's edges, slow motion under it, a fast zoom-and-fade out. Tier 2
(INTERCEPTED, FUMBLE, FLAG, BIG PLAY, BREAKAWAY, SACK, BIG HIT) is the stinger: each
`entrance` is its own keyframe set (streak with a blue sweep, wobble with the v91 ball
tumbling loose, a flag that whips on first, slam from below, speed lines, crush from
above, one-frame flash with a shockwave ring); it sits at the upper or lower middle —
whichever half the play is NOT in — nudged toward the play's side, and leaves by
shrinking toward the scorebug. Tier 3 (FIRST DOWN, 4TH DOWN, GOAL LINE, MISSED) is the
scorebug panel (`.rib-hud-v95`): the badge small beside its context ("18-yard
reception", "2 yards to go", "Ball on the 2", "47-yard attempt"), sliding in under the
scoreboard and retracting; a pulsing border for 4TH DOWN / GOAL LINE, a red snap-line for
MISSED. Tiers 1–2 share the `stage` lane, tier 3 has the `hud` lane, so a panel and a
stinger can share the screen.

**The anchor.** `originOf` maps a sim position through `PJ` and the camera's `worldView`
onto the canvas rect inside the host, so a badge first flashes small over the player and
flies to its mark — the graphic originates from the play.

**The queue.** `show(kind, {sub, token, force, hold, x, y, scene})`: a `token` fires once
(one per moment per play, keyed on `P.__ballTokenV1514`); a kind never repeats inside
`TU("badgeRepeatMs")`; a bigger `prio` cuts the current badge short (`retire(cut)`); a
smaller one waits (queue depth `TU("badgeQueueMax")`, lowest dropped); and when
`BADGE_PROMO_V95` has `"<on screen>><arriving>"` the badge on screen **morphs** — a
rotateY flip, the image and caption swap, the mark moves — instead of stacking:
INTERCEPTED → TURNOVER (captioned INTERCEPTION) → TOUCHDOWN (PICK SIX); BIG PLAY →
TOUCHDOWN; FUMBLE → TOUCHDOWN (SCOOP AND SCORE); anything → GAME CHANGER.

**Where it fires.** `badgesPresnapV95(et, losAbs)` at play start (captures the
scoreboard for the lead-change test, the FG distance, and fires 4TH DOWN / GOAL LINE
for a played-out down); `fireEvent` cases `pick`, `fumble`, `recover` (defence),
`tackle` (`e.sack`, `e.hitStick`), `brokenTackle` (`e.hitStick`), `firstdown`, `flag`,
`fgResult`, `td` (BREAKAWAY on a 40+ score, before the crossing); `hitFx` when the sim's
`e.bigHit` is set (not every stop for no gain); `celebrate` (TOUCHDOWN, anchored on the
crossing); and `badgesWhistleV95(P)` at `S.duration` — TURNOVER (interception, defensive
recovery, on downs), BREAKAWAY / BIG PLAY by yards, GAME CHANGER (Q4 lead change, or a
takeaway inside one score). It returns true when a badge told the result so the ribbon
stays down; the ribbon still posts for ordinary gains. The retired pop-text (TOUCHDOWN!,
INTERCEPTED!, FUMBLE!, SACKED!, FIRST DOWN ✓, FLAG ON THE PLAY, BIG HIT!, HIT STICK!,
IT'S GOOD! / NO GOOD) is gone; the small stuff (JUKE!, SWIM MOVE!, TOE TAP!) keeps its
pop-text. The audio cues are short WebAudio stingers on the game's own `settings.sound`.
`scripts/badgecheck.mjs` decodes every file, drives the queue (cut-in, token, repeat,
promotion, both lanes, clear) and watches a live run.

## v100 — the lighting dial

- **THE SETTING** (`Fi()`'s FIELD VIEW rows, `__pushFieldFx`, `fieldFxReset`): `fxLight`, 0–2 in
  0.05 steps, default 1, rendered by the shared `.fx-row` markup and read back through
  `window.__fxFmt` as a whole percent. It rides `window.__FIELD_FX.light` like every other field
  dial, so moving it runs the ordinary `applyFieldFx` → `refreshPersp` → `drawField` path, which
  re-bakes the turf; the lamps and shadows pick it up on the next frame with no rebuild at all.
- **WHAT IT MULTIPLIES** (`lightMulV100`, `bakedMulV100`, `shadowMulV100` on the scene):
  - the masts' `glow` / `beam` / `pool` alphas in `updateStadiumV92`, hidden outright below 1%;
  - the tower sprites' own tint (`0.28 + 0.72 × dial`, capped at white) — the sheet paints its
    bulbs lit, so without this the masts still glowed over a dead field at 0;
  - the baked wash and pools in `lightFieldV98`, through `bakedMulV100`: linear down to 0, but
    only `TU("lightBakedTopK", .6)` of the excess above 1, because the wash is broad enough that a
    linear top end clips the far end zone to white;
  - the vignette, INVERSELY (`× clamp(2 - dial, .35, 1.5)`) — the corners go deeper as the lights
    come down;
  - every shadow's alpha (`castShadowV99`, the goalpost frame, `sideShadow`) through
    `shadowMulV100` = `clamp(0.35 + 0.65 × dial, 0.2, 1.6)`, whose floor is what keeps a man
    grounded with the floodlights out.
- `window.__V99.dial()` reports `{light, shadow, setting}` for the check.

## v99 — the shadows fall, from one light post

- **THE KEY LIGHT** (`keyLightV99`): one mast is the light everything casts from —
  `TU("keyLightIdx", 2)`, chosen because mast 2 is one of the two that do not sway — read at
  its FIXED base (`tw._bx/_by`, not the drawn, swaying `x`) plus `lightHeadFrac` for the lamp
  head. Without the stadium art it falls back to a point above the far end
  (`keyLightFallbackX/Up`), so the cast is identical with the sheet blocked. Cached in
  `this._klV99`, cleared once per `update` tick and once per `drawField`, so a frame reads the
  light once however many things cast.
- **THE CAST** (`shadowVecV99`, `castShadowV99`): `shadowVecV99(gx, gy)` returns the unit
  vector from the light to that ground point, a `reach` (0 at the far end line, 1 at the near
  edge of the world) and a `slope` — `TU("shadowSlope", .7) * (0.45 + reach * 1.35)`, times the
  v86 per-quarter stretch (`shadowStretchQ`), which now lives here so exactly one system writes
  these properties. A shadow's length is the object's own height times that slope, which is
  what makes tall things throw long and low things barely mark the grass.
  `castShadowV99(sh, gx, gy, h, {lift, base, y0, a})` writes an ellipse that is parented to a
  sprite's container: rotation to the cast direction, the ellipse pushed out to sit between the
  feet and the tip, `scaleX = (base + len) / base`, alpha faded by `reach` (`shadowFade`). The
  container's perspective scale cancels, so nothing has to be undone for depth.
- **WHO CASTS**: players (`placeMarker`, height `shadowManH`, `shadowDownK` while he is on the
  ground), officials (`placeRef`, and the flag heave's hop counts as lift), the ball
  (`ballShadK` × the drawn air height — the shadow runs out from under it), the goalposts
  (below) and every sideline sprite (`sideShadow`, length from the sprite's own
  `displayHeight` × `sideShadowK`).
- **LIFT** (`lift` in `castShadowV99`): a launched tackler's parabola used to carry his shadow
  up with him because the shadow is a child of the lifted container. `placeMarker` now keeps the
  lift (`liftV99`) and hands it over, so the shadow is pushed back down to the grass, shrunk and
  faded (`shadowAirMin`, `shadowAirFade`) — the leap reads as a leap.
- **THE GOALPOSTS** (`drawGoalpostsV87` + `postShadG` at `TU("postShadDepth", 3.44)`, under the
  players and under the posts): the whole H is projected point by point away from the light —
  the mast, the crossbar and both uprights, each as a tapering quad (`postShadK`, `postShadA`),
  plus a socket ellipse at the foot. `window.__V99.posts()` reports each end keyed `near`/`far`
  by its own `reach` (which end is near flips with `VDIR`, so field x is the wrong key).
- **THE LAMPS HOLD** (`updateStadiumV92`): the v92 frame walk and the v98 glow/beam/pool
  breathing are off by default — one frame per face (the brightest the sheet has, `HOLDF`) and
  one steady output, so the stadium light and everything it casts stay still.
  `TU("lightCycleV99", 1)` puts the old walk back. `v92check` and `v98check` assert the hold.
- **THE CARD'S PROMISE IS BINDING** (`week.coachPreview98`): `showPostGame` books the coach-trust
  swing it displays, and `He()` applies that number when it is there instead of recomputing from
  a rating the sim re-derives after Continue — the two used to disagree by a point.
- **Read by the checks**: `window.__V99` — `key()`, `cast(x, y)`, `man(i)`, `ball()`, `posts()`.

## v98 — under the lights, the scorebug in the kits, the stands react, the handover cut

- **THE MASTS STAY PUT** (`buildStadiumV92`): the four towers used to stand on the bowl's
  remeasured bottom edge, which wanders by twenty-odd pixels between plays because the
  perspective re-anchors at every snap (`ANCHOR_U` in `drawField`). Their feet now sit on a
  fixed row, `NSTOP - TU("lightFootUp", 40)`, at a fixed scale (`TU("lightKS", 1.07)`) — inside
  the bowl's band at every anchoring the game produces, so the stand still hides them — and
  only follow the bowl up (`Math.min`) if it ever rises above that row. `tw._bx/_by` hold the
  base; `tw._sway` (`[0, 1, 0, 0.7]`) says which masts move. `updateStadiumV92` drifts a
  swaying mast by `TU("lightSwayPx", 2.4)` and leans it `TU("lightSwayDeg", 0.9)` from the
  foot on a slow two-sine curve (`TU("lightSwayMs", 3400)`).
- **THE LAMPS** (`lightTexV98`, `lightRigV98`, in `updateStadiumV92`): three canvas textures
  drawn once per scene — a radial glow, a cone beam (narrow at the head, wide and faint
  where it lands, soft at both edges) and an elliptical pool. Each mast gets one of each in
  `ST.lights[i]`, all ADD-blended and warm-tinted: the glow at the lamp head
  (`TU("lightHeadFrac", 0.76)` of the cell up, leaning `TU("lightHeadX", 0.08)` toward the
  field) at `depT + 0.01`; the beam from the head rotated at the patch of field the mast
  faces (`TU("beamAimX", 0.1)`, `TU("beamAimDown", 300)`), reaching `TU("beamReach", 0.8)`
  of the way, at `crowdDepth + 0.006` so it crosses in front of the stand and under the
  players; the pool at `depth 0.62`, between the grass (0.6) and the paint (0.8). Alpha
  breathes per mast on its own phase (`TU("lightGlowA", .62)`, `TU("lightBeamA", .2)`,
  `TU("fieldPoolLiveA", .11)`); the feed camera ignores the glows and beams.
- **THE FIELD IS LIT** (`lightFieldV98`, called at the end of `warpField`): baked on the warped
  canvas below `NSTOP`, so it rides the perspective for free — a `lighter` wash from the far
  end (`TU("fieldWashA", .15)` over `TU("fieldWashReach", .48)` of the field), a radial pool
  under each mast (`TU("fieldPoolA", .12)`, `TU("fieldPoolR", 430)`), then a `source-over`
  vignette toward the edges and the near corners (`TU("fieldVignA", .34)`). `TU("fieldLightV98",
  0)` switches it off. The sky gradient above the far end line is `#010204 → #080b10`.
- **THE SCOREBUG WEARS THE KITS** (`ribOppPalV98`, `ribPaintScorebugV98`, after `ribSyncOpp`):
  the v44 emblem/palette walk moved into `ribOppPalV98(opp)`; `ribPaintScorebugV98` sets
  `--sbUs1/2/Sc` and `--sbThem1/2/Sc` on the root (the score colour is the primary mixed
  toward white until its luminance clears `TU("sbScoreLum", .62)`). Both scoreboard CSS
  blocks (the base rules and the broadcast restyle with `!important`) read the variables
  through `color-mix`, with the old green/red as fallbacks. The live markup calls
  `window.__ribPaintScorebugV98(oppName)` as it renders, so the bug is dressed before the
  scene boots; `ribSyncOpp` repaints on every fixture. `window.__SCOREBUG_V98` is the record.
- **GONE FROM THE LIVE SCREEN**: the `.field-legend` row and the `.live-pulse` COACH TRUST /
  FAN HYPE boxes (the CSS stays, the markup and the render-hook insertion are removed).
- **THE COACH'S READ ON THE CARD** (`window.__coachSwingV98(perf, won)`, `He()`,
  `showPostGame`): `He()` records the swing it applies in `week.coachDelta98`; the card
  previews the same formula (`won ? 3 + max(0, n) : -3 + n`, `n = clamp(round((perf-58)/8),
  -6, 7)`, clamped to 0–100 against the current trust) in `#pgCoachV98` under the rank strip,
  or quotes the recorded swing when the week is already counted. `v98check` asserts the
  quoted swing is the one that lands.
- **THE STANDS REACT** (`crowdEmojiV98`, from `crowdReact` at `TU("crowdEmojiMin", .3)`): a
  handful of emoji text objects rise off the sections nearest the play — on camera first, or
  the nearest sections held `TU("crowdEmojiHoldMs", 500)` and living half again as long when
  the lock is tight on a runner, so the pull-back at the whistle finds them still rising.
  Good moments draw from 🔥🙌👏🎉💪😱🏈🤯, bad ones from 😩🤦😤😬🙈💔😡; `TU("crowdEmojiN", 3)` /
  `TU("crowdEmojiBig", 6)` per moment, away reactions at `TU("crowdEmojiAwayK", .6)`, capped at
  `TU("crowdEmojiMax", 12)` live, one burst per `TU("crowdEmojiGapMs", 650)`. `updateCrowd`
  pops, wobbles, lifts and fades them; `clearCrowd` destroys them. `window.__EMOJI_V98`
  counts. Render-only, like the bubbles.
- **THE HANDOVER CUT** (the follow camera in `update`): when `P.carrierId` changes to a new
  actor mid-play (handoff, catch, pick, punt fielded — not the snap itself), `P._camCut` opens
  for `TU("camCutMs", 520)`; while it eases out (`cut = 1 - q²`) the pan blends toward
  `TU("camCutPan", .2)`, the zoom lerp toward `TU("camCutZoomLerp", .22)`, the lead cap grows
  1.3× and the lead gains `TU("camCutLead", 70)` px (scaled by the carrier's perspective)
  in the play's direction. `resetCamera` clears it between plays; `window.__CAMCUT_V98`
  counts the cuts.
- **THE DEPTH SLIDER** steps by 0.01 (1%), still 0–0.9.

## v97 — the loader first, names, whole numbers, prestige, the wall, the fold, the end zones

- **THE LOADER GOES FIRST** (`GridironPhaser.animate` + `__LIVELOAD_V94.whenClear`): while the
  live game's loader is up, the first `animate` call parks its arguments on the loader's
  `waiters` and returns; `finish()` releases them, so the play starts the moment the chase has
  run its exit. Header plays (drive markers, no animation) still tick underneath the overlay.
- **THE PALETTE'S NAME** (`palNameV97`, in the team creator next to `getCustom`): every
  palette tile carries "Primary & Secondary", each colour named by hue and depth (Navy / Royal
  / Sky, Maroon / Crimson / Rose, Forest / Green / Mint, Silver / White ...); also the tile's
  title.
- **WHOLE NUMBERS ON THE SHEET**: the only decimals in the skill menus were the four combine
  clocks (40-yd dash, 20-yd shuttle, 3-cone, 10-yd split, e.g. "4.32s"). They are speeds now
  — Top speed, Shuttle speed, 3-cone speed, 10-yd burst, all whole mph from the same curves
  (distance / time × 2.045) — so the sheet reads 19 mph, not 4.32s.
- **PRESTIGE IS RARE, AND QUIETER**: both career-end awards add `Qs(...) ×
  TU("prestigeGainMult", 0.2)` (one decimal kept on `o.prestige`; the chip rounds to a
  tenth), and `ht(prestige)` — the one curve every prestige-scaled bonus reads (starting
  attributes, potential, the ratings floor in `kt`/`Wr`) — returns `× TU("prestigeEffectMult",
  0.2)`; `drPrestigePct` fell from 5% to 1% a star. PP and the legacy tree are untouched.
- **THE 250 WALL** (`drCost`, `qo`): 250 was the ABSOLUTE limit (`qo`, read by `we()`); it is a
  soft one now — `qo` lifts to 999 and from `TU("drWallAt", 250)` every point costs
  `TU("drWallMult", 5)` times the band price (a 24-point band reads 120). The sheet's
  diminishing-returns note says so. `window.__drCostV97` / `window.__htV97` are the check hooks.
- **THE CONTINUE CARD'S TINT** (`scripts/build-menu-art.py`): the helmet and pants boxes on
  the continue card hugged the lit right two-thirds of the shell and stopped at the inseam;
  they now take the whole shell (neutral cap 236) and both outer thighs (the cloth filter
  keeps the gloves and skin out), and the silhouette was widened to match. Only
  `card_continue_mask_s.webp` changed.
- **THE FOLD** (`fold` / `foldAll` / `FOLD`, in the v75 sectioner): a hub tab measured taller
  than the viewport while showing becomes an accordion — every block after the first folds
  behind a header cut from its own heading (`headingOf`); a tap opens one and folds the
  others, remembered per view and section across re-renders. A tab that fits stays a stack.
- **THE SHEET IN THREE** (`UP_GROUPS_V97` / `toggleUpGroupV97`, next to `un`): the upgrade
  sheet's rows sit in three folding cards — PHYSICAL, BALL SKILLS, MENTAL (anything unlisted
  lands in OTHER) — the one with the most KEY stats open first; `alloc` still updates rows in
  place.
- **THE TWO END ZONES** (`ribSyncEndZonesV93` / `ribPaintEndZonesV93`): `RIB._ezV93.ends`
  holds a colour pair and a label per end — far: the user's palette and TOUCHDOWN
  (`TU("ezFarLabel")`), near: the opponent's palette (`RIB.defPal`) and name, rotated to face
  their bench. `scripts/v93check.mjs` asserts the pair at home and on the road.

## v96 — his own kit, a name of his own, the stat box, the read radius

- **HIS OWN KIT** (`ribSyncYouKitV96`, next to `ribSyncOpp`): the you-player used to wear a
  gold-and-navy "you" kit no matter whose team he was on. `highlight(d, isMe)` now records
  `d.kitSide` ("off" is the user's palette, "def" the opponent's — the renderer keys kits by
  side) and re-registers the "you" textures as a copy of that side's palette (cached on
  `RIB.youKitV96`, so it recolours only when the side or the palette changes). The label is
  white like everyone else's; `teamColor` and the fallback tint follow `kitSide`. The plumbob
  is what says which one he is.
- **A NAME OF HIS OWN** (`window.setPlayerNameV96` / `rerollNameV96`, next to `Lr`): the
  position screen's name is an input prefilled with the rolled name (24 chars, whitespace
  folded, empty ignored) with a 🎲 to roll another; every keystroke saves.
- **THE STAT BOX SHOWS THE REST** (`flMinorV96`, next to `fl`): under the three big tiles the
  live box carries a minor line of every stat the full box (`cl`) knows that the tiles
  don't (CAR / AVG / LONG / FUM for a back, TGT / REC / LONG for a receiver, TFL / QB HIT / FF
  for the front...), refreshed on every play beside the tiles.
- **THE READ RADIUS** (`visionRadiusV96`, the banner before FieldSim): field vision as a
  radius, a yard a point from 75 — 74 and under reads as before, 75 reads one yard further,
  76 two, 77 three, capped by `TU("visionRadiusMax")`. It stretches the lookahead the back
  projects every defender along in the lane read (`ahead` in v82 THE BACK HAS EYES, at
  `TU("lookaheadPerYdV96")` per yard). The upgrade sheet's Vision line quotes it ("Read
  radius: 3 yd") in place of the old made-up yards-after-contact figure.

## Screens and their shapes (v73–v75)

Three of the screens below are assembled by a long chain of patch layers, each of
which inserts its card into `#screen` by querying for a neighbour. Anything that
reshapes those screens has to sit **on top** of that chain rather than inside it.

- `v75 HUB SECTIONS` (last inline `<script>` in the file, anchor `v75 HUB SECTIONS`)
  — the hub and the prestige tree are split into tabbed sections. It is purely a
  presentation pass: it moves the blocks the screen already rendered into
  containers, adds no card and rewrites no markup. It hooks a **MutationObserver +
  sweep** rather than the render-wrapper chain, because every render rebuilds
  `#screen` from scratch and the tab strip goes with it; the next sweep re-sections
  whatever is there. Classification is by class, then by text for the blocks that
  carry none, then by **inheriting the block above** — which is what keeps the
  "Attributes" heading, its sheet and its footnote together as one run. The same
  block carries the row-height compaction for the two screens that are one long
  list each (the upgrade sheet, the training board), since a tab strip has nothing
  to split there. Measured by `scripts/scrollcheck.mjs`, which finds the element
  that actually scrolls — `<html>` carries `overflow:hidden`, so the document never
  is.
- **OVR is open-ended (v85).** `en()` runs past 99 and `$s()` names the tiers above it.
  Rosters (`Wr`), rivals, `teamPairV76`, the v15.7 exact rosters and the hub bars are
  clamped at 999, not 99 — new displays must not reintroduce a 99 cap. The sim-side
  attribute generator `h()` in `Wr` and the you-player's `qr()` stay on 5–99 on
  purpose: they feed the engine, not the screen.
- `v73 BODY LEDGER` (next to the v54 availability model) — `bodyLedgerV73(player)`
  is the one read of what the body is worth in the next game. It quotes
  `condMultV54` and `injChanceV54` directly, and measures the marginal value of a
  durability point by asking the real chance function with the stat one higher.
  `bodyCostV73` is recorded in the weekly resolver either side of the multiplier,
  which is the only place the charge is knowable.
- `v93 THE HOME END ZONES` (next to `ribApplyFieldLogo`) — `ribPaintEndZonesV93(ctx, base)`
  fills the two end-zone bands of the FLAT art (`ribEndZoneBandsV93`: rows measured on the
  shipped 360x700 art, `TU("ezFarY0")` etc., scaled with the art) in the home primary, a
  faint weave, and the home name in the secondary (rotated at the near end). It runs inside
  `ribApplyFieldLogo` before the crest, so the warp carries it. `ribSyncEndZonesV93(scene)`
  builds the key `(home, palette, name)` from `window.__homeGameV93` (set by the career app
  when a live week starts, from the week's `home` flag; `homeWeekV93(w, i)` alternates by
  index for saves without one), the user's palette, and `RIB.defPal` (remembered by
  `ribSyncOpp` — the opponent's jersey palette), and recomposites only when the key changes.
  `ribSyncOpp` calls it on every sync, including its cached early-return path. Debug:
  `window.__V93 = { home, key, name, cols, sample(end), set(home) }`.
- `v92 THE LIGHTS AND THE BIG SCREEN` (two blocks: the loader/registration next to
  `ribRegisterSide`, the scene methods next to `clearCrowd`) — `RIB_META_V92` is GENERATED by
  `scripts/build-stadium-art.py` (`build-stadium-art.mjs` runs it) and the lights ship as a
  Phaser sprite sheet (`rib_lights_v92`, 128×160 cells, row 0 heads left, row 1 heads right,
  six frames per row). `buildStadiumV92()` runs at the tail of `buildCrowd()`: it measures the
  bowl's BACK wall (the sections across the middle of the frame — the corners curve toward
  the camera and stand lower on screen) and plants four tower images (depth just under
  `crowdDepth`, masts inside the bowl band, heads above its top; `lightH`, `lightSink`) and the
  screen (a bezel graphics on two legs above the bowl's top edge; `jumboW/H/Lift`). The feed
  is a second camera (`this.cameras.add`, name `jumboV92`) that ignores the stadium's own
  objects; `updateStadiumV92(delta)` walks the lamp frames (`lightFrameMs`) and every frame
  re-derives the camera's viewport from where the panel's WORLD rect lands on the main camera
  (`(R - worldView) * zoom`, clipped to the canvas), follows the ball (`jumboViewW` world px
  across the panel, `jumboLerp`), and hides the camera whenever the panel is off the main
  camera — a second camera re-renders the display list, so it only runs while somebody can
  see it. `stadiumWhistleV92()` (called where `P.done` is set) snapshots the viewport's own
  pixels with `renderer.snapshotArea` into `jumbo_still_v92` and shows it with a push-in tween
  (`jumboPushIn/Ms`); `stadiumLiveV92()` (called from `animatePlay`) brings the feed back.
  `window.__V92` carries `loaded/on/towers/bowl`, `screen()` and `towerBoxes()`. `?noV92`
  skips the sheet (the screen still builds; it needs no art). The posts: `postH`/`uprightH`
  defaults (46/150) in `drawGoalpostsV87`, and `drawUprights` (the FG highlight) now draws the
  same geometry. Whole numbers: `Vt` and the career table always round; `jt` prints a full
  locale number; `z`/`yo` print whole millions; the training board's `gv`/`rng` round; the
  prestige multipliers print as a percentage bonus. The rolled values behind them (rate stats
  at one decimal in the save, `Kr()`'s item magnitudes, `projectSeasonGainsV85`) are untouched —
  only the display rounds, so rank math and item power did not move.
- `v91 THE FIELD SHEETS` (next to the v22 overlay) — `RIB_META_V91` is GENERATED into
  `index.html` between `RIB_META_V91_BEGIN/END` markers by `scripts/build-field-art.py`
  (`build-field-art.mjs` runs it); never hand-edit it. `ribCellV91(name)` sits in front of
  `ribCellV22` and `ribCell` inside `ribRegisterTeam`'s `put`, so any cell the atlas
  carries under an existing name (run_dn3, cut_sd, catch_up1) upgrades that state for
  every team through the same `ribRecolor`, and new names register new states per facing
  (plant, fall, divex, getup0..7, celebrate0..3, hurt0..1, walk0..1, catchhold). The
  get-up rides the existing `getupSeq` (eight frames when the sheet is in), the v21.2
  crouch-then-stand recovery becomes `getupSeq` when the sheet is in, `celebrateSeq` loops
  for `celebrateMs` from `celebrate()`. The ball: `ribBallV91` builds a sprite of
  `spr_ball_spin0` at the two call sites that used to call `__RIB20_createFootball`, and
  `ballFrameV91(kind,k)` swaps frames and returns each spin frame's drawn tilt
  (`RIB_META_V91._ballAngles`, measured from the alpha's principal axis at build time) so
  flight rotation is heading minus tilt. The build script keys the new art for the
  recolour (`kit_ready`: navy and gold shadows below `ribRecolor`'s L=38 floor are lifted
  to it, so a shadow comes out as a darker primary instead of surviving as navy;
  `normalize_palette`: the sheets' orange pants, hue 24–46, are rebuilt at hue 46 so the
  gold band catches them). Cells are cut with a BOX resize, an unsharp mask and a hard
  alpha threshold (v91.1) — the renderer scales sprites with nearest-neighbour, so a soft
  fringe reads as blur; the figure is normalised to 44px like the baked atlas. **The idle
  is the get-up sheet's standing frame** (`idle_<dd>`, `idle_sd` = `idle_dr`), never the
  run sheet's plant. `?noV91` on the URL skips the sheet (A/B). In the draw-time state
  machine the unpile only forces `getupSeq` when the man is not already in `celebrateSeq`.
  The sheet is fetched from `./public/rib_field_v91.png` (relative, so GitHub Pages'
  subpath works). Six later sheets add 27 cells (238 in all) that no renderer state reads yet:
  `throw_<dd>0..5` for `up` (throw_back), `dn` (throw_front) and `ur` (throw_quarter_a),
  `backpedal_up0..5`, `ready_up`, `stance3_up` and `carry_up` (stances; its centre-over-the-ball
  pose is left out, the arms read wrong). The throw
  frames run set / grip / stride / cocked at the ear / RELEASE (the hand empty) / follow, so the
  ball leaves on frame 4 in every facing; the loose ball the sheets draw in flight is dropped at
  the slice because the renderer carries its own (v105). `throw_ur*` and `carry_up` are cut
  MIRRORED: the atlas draws sd/dr/ur looking left and `faceMarker` flips them for a man moving
  right (`m.flip = dx > 0`), and the bridge hangs the ball off a rear-facing right-hander's
  screen-right hand. `throw_quarter_b.png` and `snap_catch_mini.png` are in `art/field/` but
  deliberately uncut (off-model lean, half-scale figures, facings that change inside a group).
- `v90 THE ROLLS HAPPEN IN THE BACKGROUND` (next to `silentWeekV85`) — `autoStoryV90(e,w)`
  drains `storyDecisionQueueV11` on the sim-the-rest path by picking a choice with
  `pickStoryChoiceV90` (sorted by `baseChance`; `TU("autoStoryStyle",0)` safest → boldest)
  and resolving it through `zn`, the same resolver the story card's button calls, so the
  arc's stage, history and `decisionCount` advance identically. The v85 `wt` wrapper
  calls it before each week instead of breaking on a queued stage. Rolls are recorded on
  the week as `autoRollsV90` and exposed as `window.__V90.last`. The post-game decision
  system (`decisionQueue`, `resolveDecision102`) is dead code: nothing queues it and no
  resolver exists, and `Re()` clears it on load — do not build on it.
- **v89 MAIN MENU** — the menu is the one part of the app that is NOT inline: it
  ships as `public/rib-menu*.{css,js}` linked from `index.html` by
  `scripts/bake-menu-into-index.mjs` (`RIB_MENU_VERSION=v89`; the file lists at the top
  of that script and of `scripts/assemble-pages.mjs` are the manifest). Four files:
  `rib-menu-v89-runtime.js` warms the four big pictures and lifts the
  `html.rib-assets-ready` opacity gate (2.5 s fallback), `rib-menu-boot.js` bridges the
  legacy controls, `rib-menu.js` renders the Bible layout (`.rib9-*` classes) from
  `window.__RIB_MENU_DATA_V89()` — the feed in `index.html` right after `window.__V85`
  that reads state, player, season, objectives and team identity (`__GRIDIRON_TEAM_CUSTOM__`)
  — and `rib-menu-navigation.js` routes clicks: `data-rib-action="view:<name>"` goes
  through `window.go(name)`, `home` scrolls to the top, and the legacy names
  (continue, new, prestige, goals, hall, locker, settings) still click the hidden legacy
  control by text. `rib-menu-v89.css` is the whole visual system (dark charcoal, gold
  hairlines, Oswald + Barlow Condensed; the reset uses `:where(#rib-main-menu-v2)` so
  class rules win); `rib-menu.css` only hides `#app` while the overlay is open. Art:
  originals in `art/menu/`, shipped WebP in `public/menu/`. **Team tints are placed in
  picture units** (`data-tint="cx,cy,rx,ry"` fractions of the image) and `layoutArt()`
  maps them onto the rendered `object-fit:cover` crop in pixels on mount and resize,
  reading `object-position` back from the stylesheet so the two can never disagree, so
  (a tint is a masked duplicate `<img>` of the photograph recoloured by `recolorFilter(hex)`
  — grayscale → sepia → hue-rotate to the team hue → saturate/brightness from the colour —
  so no blend mode is involved; `?blendTint` renders the older colour+multiply layers for
  comparison; `which` picks primary or secondary, so the jersey / helmet / pants split is a
  kit rule in `renderMenu`, not a colour choice),
  and every tint is clipped by a **silhouette mask** cut from the picture. Since v106 the masks
  are MEASURED, not placed: `scripts/menu-kit-hero.py`, `menu-kit-card.py` and
  `menu-kit-portrait.py` (run by `build-menu-art.py`, each standalone too) trace every garment's
  edge off the source art — see "v106 — the kit is cut from the picture" above for the method —
  and assert on their own run that no alpha lands beyond a few pixels of the traced kit, so a
  mis-sited curve fails the build instead of reaching the page. `scripts/menu-mask-check.mjs`
  holds each garment on probe points in percent of the picture, both on the shipped alpha and on
  the live render with the tints hidden and shown; `scripts/menu-kit-shot.mjs` screenshots the
  three pictures in vivid forced colours — the default slate palette hides leaks, so look at
  those. On the hero, the picture, its two tints, the lift and the name/number sit
  in `.rib9-hero-art`, and THAT layer carries the v102 breath: the tints used to sit still under
  a picture scaling by two percent, so the recoloured kit drifted off its own outline every
  four seconds. The mask URL is inline on the element on purpose: a `url()` in a custom
  property resolves against the stylesheet in Chrome and the document in Firefox,
  the jersey stays tinted whatever the box's aspect; the same math positions the jersey
  name/number on the hero (`data-at`). Do not go back to percentage masks — the crop
  moves under them.
  **Menu art is cut, not authored, in this repo**: `public/menu/*.webp` are all derived
  from the originals in `art/menu/` by `scripts/build-menu-art.mjs` — badges cropped to
  their coin by edge energy, icons to their own alpha, the swash's matting fringe eroded
  and its red speckle pulled back to gold, the photographs downscaled. Run that script
  after dropping new art in `art/menu/`; never hand-edit `public/menu/`. The hero
  photograph is `hero_tunnel_wall.png` (the wall slogan is painted into the picture, so
  the menu must not also draw it), and `hero_tunnel.png` is the earlier plain version. The signature face (Caveat) is declared by `rib-menu-v89.css` itself,
  not by the game's `@import` of `public/fonts/fonts.css`, so the menu can carry faces
  the rest of the game does not use (Caveat for the signature, Graduate for the jersey
  numbers). The emblem on the portrait helmet is lit by a child layer whose mask is the
  emblem's own sprite crop, built by restating the `background-*` rules as `mask-*`. Trait quality is a **signed** field: `good: 1` is a
  strength, `0` is mixed and `-1` is a flaw, so a truthiness test puts flaws on gold
  badges — filter with `> 0`. Milestone completion dates come from `objectiveStampsV89`
  on the player, written both by the objective-completion loop and by the feed the first
  time it observes an objective satisfied; saves from before v89.1 have no stamp and
  read DONE.

## Verification workflow

```bash
npm run dev                        # leave running; all checks drive it headlessly
node scripts/readcheck.mjs        # v81 ball awareness: reads, fakes, blocks, the run curve (pure Node)
node scripts/creditcheck.mjs      # tackle credit ≤ sim truth (this repo's invariant)
node scripts/statcreditcheck.mjs  # box score credits only involved plays (all stats)
node scripts/tacklecheck.mjs      # solo/gang split, whiff/truck/stiff-arm rates
node scripts/simcheck.mjs         # score/pace/yardage distributions
node scripts/renderpathcheck.mjs  # sim-log → screen hit rate
node scripts/blowoutcheck.mjs     # v76 margin curve, both score paths
node scripts/teamqualcheck.mjs    # v68 prestige-tree nerf holds at ~10x
node scripts/equaltalentcheck.mjs # mirrored rosters are actually fair
node scripts/refcheck.mjs         # v45/v49 officiating crew + ref art
node scripts/crowdcheck.mjs       # v57 stands: perspective, roar wave, fallback
node scripts/gamerunprobe.mjs     # v81 balance probe: in-game run/pass stats by concept (GAME_URL for a base build)
node scripts/readshot.mjs         # v81 visual QA: framebuffer captures of the live game
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
