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
  subpath works).
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
  and every tint is clipped by a **silhouette mask** cut from the picture in
  `scripts/build-menu-art.py` (a polygon per garment in percent of the original art, **traced on
  the real outline at 1%** since v104 — the old boxes ran the card's pants three percent wide of
  the hips, which put the secondary colour on the crowd. The card keys skin out inside the polygon
  by chroma alone (`skinless`; a highlight on the fabric is fabric, so there is no luminance cap
  any more — that cap was what dropped the sleeve hems and the shell's lit rim); the hero is
  polygon-only, because its warm tunnel light makes lit fabric as chromatic as skin. `fill_holes`
  floods in a one-pixel margin so a gap that runs off the frame, like the one between two legs,
  is open air and not a hole. Masks are feathered, not eroded, and clipped to the traced full-body
  `BODY` polygon unioned with the garments themselves). The build asserts that no finished mask
  carries alpha outside the traced body, so a placement error fails the build instead of reaching
  the page. To move a garment, draw a 1% grid over the picture (a zoomed crop with `PIL`, as the
  v104 pass did) and edit the polygon; `scripts/menu-mask-check.mjs` holds each garment on probe
  points off that grid, both on the shipped alpha and on the live render with the tints hidden
  and shown, so a retrace that misses a hem or spills onto the crowd fails a check rather than
  the eye. `scripts/kitshot.mjs` paints the kit crimson and gold for a look — the default slate
  palette hides leaks. On the hero, the picture, its two tints, the lift and the name/number sit
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
