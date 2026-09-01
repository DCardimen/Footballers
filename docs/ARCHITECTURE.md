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
| 2138–3538 | `GRIDIRON live-field bridge v3` | Minified Phaser bundle (**do not edit**), then the broadcast renderer: `LiveField` scene, `PJ` sim→screen projection, `fireEvent` (event → on-field FX/pop-text), sprite pose state machine (`tackleSeq`, dive/grab frames). `RIB ART` atlas + 40-palette team recolor. **v45 REFEREE CREW** (`spawnRefs`/`updateRefs`/`placeRef` + `refThrowFlag`/`refSignalTD`/`refWhistle`/`refNearest`, anchor `v45 REFEREE CREW`): a render-only 7-official layer in `this.refs` (never sim actors, no stats) that trails the ball, throws flags, whistles the dead ball and signals scores. **v49 REF ART** (anchor `v49 REF ART`): the crew is drawn from its own officials sheet (`RIB_META_REF` / `ribCellRef` / `ribRegisterRefs`, `window.__RIB_REFS_V49`, 64px cells) — NOT recolored, since officials wear one kit; `ribRegisterTeam` short-circuits for `team === "ref"` once the sheet decodes, and the old `ribZebra` player recolor stays registered only as the never-decoded fallback. **v57 CROWD** (anchors `v57 CROWD ART` and `v57 CROWD STANDS`): real stands in the apron outside both sidelines, from their own sheet (`RIB_META_CROWD` / `ribCrowdStrip`, `window.__RIB_CROWD_V57`) in three density tiers x idle/cheer. A stand is a WALL, so it cannot go in `warpField`'s row loop (one depth per row); `buildCrowd`/`crowdSection` sweep each WALL of the bowl in COLUMNS instead — sample depths spaced uniformly in screen Y (`crowdInvertC`, the same bisection `warpField` uses), project each through `PJ` for a ground point and the ratio `k`, and map the art onto the resulting thin quads with a three-point affine, so the tiers converge on the yard lines' own vanishing point. The source column advances with the **integral of k**, not field distance — advancing it linearly squeezes each spectator horizontally where the sideline foreshortens; ∝k makes the horizontal texture scale match the vertical one. Height then derives from the art's aspect (`crowdHeightK` trims it), and `crowdDecks` stacks the strip — by the **seating pitch** from `cellmap[4]`, not the cell height, or turf shows through between decks. Cheering is an alpha CROSSFADE per section (`updateCrowd`), not a redraw — geometry rebuilds once per snap, the crowd reacts every frame. `crowdReact` (called from `fireEvent`) starts a roar at the play and `crowdCheer` rolls it down the sideline as a wave. v58 generalises the sweep to a **wall list** — two sidelines plus the FAR end zone (a near-end wall is behind the camera and, being a billboard, would rise over the field). End-zone walls sit at one depth, so `k` is constant and the k-integral mapping reduces to linear there. `NSTOP` is **340**, not 30: the end-zone stand projects ABOVE the far end line and needs headroom inside the world, and `warpField` paints that band as the dark beyond the stadium rather than stretching the art's top row. `ribCrowdArchitecture` adds concourses / stairways / vomitories in strip space (stairs align vertically across decks — that unbroken line is the 3D read), and the strip lays **solid structure down first** so the art's stairwell wedges and tile seams cannot show turf through the crowd. **v59 CROWD AISLES** (anchor `v59 CROWD AISLES`): the flights are drawn over the finished stand, so the seats under them are cleared first — `ribCrowdAisle` builds one bare-bench column by taking, per SCANLINE, the emptiest stretch of that same line of the tier's cell (per-scanline is the trick: a stand with no empty column anywhere still has an empty stretch on every individual row), and the strip lays that one patch into every aisle on every deck. Same patch everywhere = the flights are identical and evenly pitched; `ribCrowdStairs` is the single source of the layout both the clear and the draw read. The aisle's outer edge carries a handrail because in the packed tier that edge has to fall through someone. `ribCrowdTrim` measures the cell's own end stairwells (a stairwell has no faces in it) and the strip tiles the SEATING only, so the art's diagonal end flights stop scattering a second stair system through the stand; the trim is the max over the tier's two poses or the crossfade would slide. `crowdGap` was 56, not 112 — lateral spread is `1.885*k*(HALF+GAP)` against a ~400px half-frame, so the apron decides whether the stands are on camera at all (v78 takes it to 104, because the team area now has something in it). **v63 BOWL + VOICES**: the far end is no longer a flat wall — the sidelines stop `crowdCornerR` short and the end is one superellipse sweep (`crowdBowlN`) whose ends land ON the sideline ends with matching slope, so the bowl closes tangent-continuously; `crowdEndGap` is 44 (not 16) because a big corner radius cuts the field's corner otherwise, and a hard guard forces the curve behind the end line wherever it is laterally inside the touchlines. HH is now solved ONCE from the sidelines and every other wall gets the texture span that matches it (`dc = stripH*seg/(HH*k)`) — solving it per wall is what made the end-zone crowd a third the size of the sideline crowd. Rake is per POINT (per section notches the skyline at the corners). `crowdBubble` pops short crowd shouts from on-camera sections only, anchored on each section's `mx/my` mid sample. **v60 CROWD 2.5D**: the slice affine's third mapping carries a RAKE — `(c,0)` lands `crowdRake*h` OUTBOARD of the base rather than straight above it, so the stand leans away from the field as it rises (outboard only; the dev check asserts the inboard edge never moves). It also un-degenerates the near sections, whose box collapsed to a ~7px sliver that drew nothing. Each section then gets an aerial-perspective gradient ramped between its own end depths under `source-atop` (smooth inside a section, continuous across joins since neighbours share a boundary sample; flat on an end-zone wall, where k is constant), plus `crowdSideShade` to split the two banks. `ribCrowdArchitecture` adds the tier overhang shadow under every concourse and the front fascia; `ribCrowdStrip` lays a rear wall into the headroom above the top deck BEFORE the art, so cheer arms still break its skyline. Zoom: stands fill the frame edges at the ~0.9 base, open to the whole bowl at `zoomLockMin` 0.6, and leave frame past ~1.2. **Gotcha:** `crowdDepth` (3.45) must stay above `fieldLines` (3.4) and below the ground shadows under players (3.5) — the LOS/first-down markers paint on the ground past the sideline, and the stand has to OCCLUDE that reach rather than be painted over. `crowdGap` is the **team area**: the apron v78 populates, and it doubles as the on-screen framing dial (see v59). Render-only: no sim actor, no stats. Guarded by `scripts/crowdcheck.mjs`. **v78 SIDELINE** (anchors `v78 SIDELINE ART` and `v78 SIDELINE`): the apron itself, filled. One rect-keyed sheet (`RIB_META_SIDE` / `ribCellSide` / `ribRegisterSide`, `window.__RIB_SIDE_V78`, packed by `scripts/spritekit/pack_sideline.mjs`) holds 83 cells — ten coaches, ten trainers, benches, hydration, medical, equipment racks, storage, coaching tech, the chain crew's markers. `buildSideline` (called from `drawField` right after `buildCrowd`, so it rides the same rebuilt perspective) lays them out in three lanes measured outward from the touchline as fractions of `crowdGap`: `sideLaneEdge` (.32, the boundary — coaches, trainers, backups), `sideLaneBench` (.62, the bench row) and `sideLaneKit` (.88, equipment). Positions are a fraction `t` along a team area spanning the 25 to the 25 (`sideAreaYd`), so retuning the apron or the span moves the whole sideline together. Everything is a BILLBOARD through `crowdProject` — deliberately NOT the crowd's slice affine, since a stand is one continuous hundred-yard surface that has to be mapped while a trunk is a metre wide and reads from any angle. `sideArtScale` (.5) is the one number tying the sheet to the players: the art packs a standing figure at ~92px, twice the 48px player cell. **The staff are not recolored** (one drawn kit, same reason as v49's officials); the **backups are the sim's own player textures**, so `ribRegisterTeam` already dressed them, and a bench is keyed on a WORLD side of the stadium — key it on the screen side and both teams change benches at every change of possession. **Gotcha:** `sideDepth` must sit between `crowdDepth` (3.45) and the ground FX (3.5), so a bench occludes the stand and the LOS line extension behind it while a player on the field always draws in front of the furniture. The layout is SEEDED (`sideRng`) because the geometry is rebuilt at every snap and an unseeded sideline reshuffles the bench on every play; only `sideChainCrew` moves, off `_lastField` and the payload's `down`. **v79 LIGHT & LIFE** (same anchors): the band is GROUNDED — `sideShadow` puts a contact ellipse under every sprite, `sideShadeBase`/`sideRelight` run everything through the players' own v29 depth-falloff + ball-spotlight tint plus the crowd's aerial fade and `crowdSideShade`, and warpField paints the white boundary border, the dashed coaches' box and the kit-row grounding shade into the turf (they are ground, so they ride the row loop; lateral placement is the exact PJ formula, `canvas x = CW/2 + (v−MIDY)·1.30·spread·OA·k`). SEATED + WATCHING: seating is COMPACT (two-seaters, stools, chairs; the five-man bench cells stay packed but unplaced — a full-side-view bench laid as a billboard runs ACROSS a lane that runs up-screen and reads angled ninety degrees wrong), each sitter rides his seat's own u with a positive `dbias` (in front, backrest behind him), `setCrop` at the knee plus a small drop so he ends at the seat line instead of pushing his feet through the turf, in PROFILE facing the touchline (`fieldFlip` — unflipped side art faces screen-left, so flip on the screen-left bank, resolved through VDIR because the camera swinging ends is exactly when "toward the field" flips). Standing backups default to the same watching profile (`sideWatchP`, one in five turned for texture). FACING: `face` art mirrors per BANK on the same rule. **v80 LATERAL CALIBRATION + FACING** (anchor `v80 LATERAL CALIBRATION` in PJ): the art paints its touchlines to true scale, ~16% wider than the raw lateral map put F_TOP/F_BOT, so the sim "stepped out" four yards inside the painted boundary; `latCal` (1.16) scales the one place world-lateral becomes screen-x (PJ, crowdProject, the sideline clamp, the warpField apron paint), so the sim boundary lands ON the painted line — `sidePaintHalf` collapses to 206 (= the sim half-width, equal by construction) and sidelinecheck's luminance probe gates the coincidence. **Gotcha:** `crowdProject` carries NO VDIR mirror (PJ does) — a bank's screen side IS its world side, always; facing logic must never carry a VDIR term, and the first cut did, which turned the whole sideline away from the ball for half of every game. The check asserts each bank's mirror by SIGN. **v79.2 THE PAINTED LINE**: the field ART paints its touchline ~35 world units outside the sim's F_TOP/F_BOT (v72 reconciled the rows, never the columns), so everything here anchors on `sidePaintHalf` (240.5, measured off the warp canvas; /spread because the FX scales the projection's lateral map but not the art's) instead of HALF — lanes, chain crew, yard markers, the turf paint, and the pylons, which stand ON the painted corners via `onLine` (the one exemption). Every other placement runs through an off-the-field CLAMP in `sideItem`/`sidePlayer`: the sprite's whole drawn box (full frame width — conservative) is pushed outboard until it clears the paint by `sideLineMargin`, so no retune or jitter can put a shoulder over the boundary; `sidelinecheck` measures the worst per-sprite overhang in screen px. The v79 solid white border is deleted — it painted a phantom boundary in the grass between the two lines. ALIVE: `sideReact` (fed from fireEvent beside `crowdReact`) drives a decaying excitement into the sway; `updateSideline` also scatters boundary figures ahead of an out-of-bounds carrier (screen-space `_scat`, the seeded layout never moves) and throttles `sideRelight` so the spotlight rides the ball; a knot of people anchors to `losU` and walks with the drive; Yr exposes its weather roll as `window.__WX_V79` (rain → ponchos, no towels; snow → extra heaters, no fans). `ribSideStaffTint`/`ribRegisterSideTeams` (in the ART block) recolor ONLY the staff kit's drawn navy to each team's primary — multiplying the whole sprite is what turns khakis and skin to mud, and is why v78 shipped untinted. The seed now includes the season week (per-game variety); bob phases are index-seeded (a rebuild used to reroll `Math.random()` phases and teleport every figure mid-sway); a per-lane separation pass holds a minimum gap; sub-4px far-end props are culled (people and field markers exempt, `keep`). `updateSideline` is one sine per figure — still the whole animation. Guarded by `scripts/sidelinecheck.mjs`. |
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
- `v73 BODY LEDGER` (next to the v54 availability model) — `bodyLedgerV73(player)`
  is the one read of what the body is worth in the next game. It quotes
  `condMultV54` and `injChanceV54` directly, and measures the marginal value of a
  durability point by asking the real chance function with the stat one higher.
  `bodyCostV73` is recorded in the weekly resolver either side of the multiplier,
  which is the only place the charge is knowable.
- `v74 MENU POLISH` (`public/rib-menu-v74.css`, loaded last by
  `scripts/bake-menu-into-index.mjs`) — the menu is the one part of the app that is
  NOT inline: it ships as `public/rib-menu*.{css,js}` linked from `index.html`. The
  shell is its own scroll container (the app puts `overflow:hidden` on `<html>`),
  and hero and content flex in opposite directions so neither a short nor a tall
  window leaves a dead band. Several menu elements are **sprite crops with boxes
  tuned to their cells** (`.rib-hero-mark`, `.rib-hero-player`, `.rib-nav-icon`,
  `.rib-legacy-stat i`) — resizing those boxes in percentages destroys the crop.

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
