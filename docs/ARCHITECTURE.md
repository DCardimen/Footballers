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
he pulls clear (`S.alert`). Around them: stands with a crowd on two
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
  `scripts/build-menu-art.py` (polygon per garment in percent of the original art, keyed
  inside for skin and lit background, eroded before feathering, and clipped to a traced
  full-body `BODY` polygon; the pads are polygon-only because a tan pad in shadow keys like
  an arm). The build asserts that no finished mask carries alpha outside the traced
  body, so a placement error fails the build instead of reaching the page. To move a garment, draw
  a 5% grid over the picture and edit the polygon; judge the result with
  `scripts/kitshot.mjs`, which paints the kit crimson and gold — the default slate palette
  hides leaks. The mask URL is inline on the element on purpose: a `url()` in a custom
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
