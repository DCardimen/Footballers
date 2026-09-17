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
- `v112 A THE CHASE IS ALWAYS READY` / `v112 THE FRAME HE HAS, AND THE FRAME HE IS GOING TO GET` /
  `v112 TWO CARDS FROM A POOL OF TEN` / `v112 THE PRICE OF WALKING AWAY` /
  `v112 THE PREGAME, ONE DECISION AT A TIME` / `v112 THE HIT HAS WEIGHT` — the v91 loading sheet is
  requested in the FIRST breath of the head, before the CSS, and v94's `load()` ADOPTS those two
  promises instead of starting its own (still exactly two requests a session; `window.__V112_A` is
  the stopwatch, `?noWarmV112` restores the cold path, and the loader's bar sweeps on the
  COMPOSITOR so it does not freeze with the main thread). `player.body` is now explicitly the
  PROJECTED ADULT frame and `bodyNowV112(body, age)` derives today's — never rolled, never stored,
  no save migration — while scouting, OVR, rank and the declare keep reading the projection (the
  screen says so). The second trait is a choice of two cards from `TRAIT_POOL_V112`
  (`traitAutoV112` resolves it if the player just locks a position, so the flow cannot wedge).
  Abandoning an unfinished career arms `o.rerollV112`: −5% on every attribute through
  `condMultV54` — the one multiplier the live sim, `effAttrsV85`, the silent week and the live
  booking all already agree on — warned before the new man is created and cleared only by a
  promotion. The pregame is a four-page wizard over the SAME blocks (`gsUsageBlockV23` /
  `gsFocusBlockV23` / `gsPlanBlockV23`, every id and handler intact) ending on the impact page and
  the effective sheet. And the violent tail of contact is a real projectile: `launchV112` answers
  one number off figures `contact()` already computed (no roll, no state, no spot moved), the
  renderer derives hang and peak from that one `flyVz` so they cannot fight each other, and the
  drawn body LAGS the script's own position rather than inventing ground. And the stadium sits
  right: `lightScaleV112` / `lightDropV112` / `lightFlipV112` make the masts half-size, lower and
  mirrored (the drop added AFTER v98's `min()` so v99's key-light row stays snap-stable, and
  `lightRigV98` derives every lamp from the mast so the rigs follow for free), `bowlTrimV112` lays
  a blue base band through each wall's own foot polyline and cuts an arched vomitory into the FAR
  bowl, `starsV112` bakes a fixed-seed star field behind the skyline at depth 0.6 (the v100 dial
  governs it), and `nearCapV112` caps `PERSP_BACKMAX` at the anchor's own scale so the near edge
  stops smearing — 11.08 → 7.70 canvas px per art row, with nothing downfield of the anchor moving.
  And the camera finds the BALL rather than the carrier — `camFocusV112` reads possession every
  frame (the holder while a man holds it, the football the moment it is away, easing toward
  `camLandV112` so it arrives with the flight), `camTightV112` tightens by how far the nearest
  tackler actually is, `camZoomFitV112` never opens wider than the pre-snap frame the FIELD VIEW
  dials already set, and `CAM_MODES_V112` (Broadcast / Tight / Wide / Fixed, plus `fxCamZoom`) is
  the one place a behaviour is described. Hooks: `window.__V112_A`, `__V112_B()`, `__V112_C`,
  `__V112_D`, `__V112_E` / `__CAM_MODES_V112`, `__V112_F` / `__V112_F_SIM`. `v112Acheck.mjs`,
  `v112Bcheck.mjs`, `v112Ccheck.mjs`, `v112Dcheck.mjs`, `v112Echeck.mjs`, `v112Fcheck.mjs`
- `v127 DOOR TWO CAN LOAD ITS OWN FILM` (in the v94 live-loader mount, beside `LIVE_FILM_FROM`) —
  `F.take()` is the fast path, not the only one: with nothing parked, door two builds its own
  `<video>` on `__V114.src` (cached) rather than falling back to the chase forever. A self-built
  element seeks to the seam on `loadedmetadata` (its `duration` is NaN at mount) and does not claim
  the stage until `atSeam()`, so the loader never shows the film's opening black; its audition is
  `LIVE_FILM_OWN_MS` (2.6s) rather than `LIVE_FILM_START_MS`, and it is parked on the way out.
  Nothing is built when `F.failed` / `F.off` / `F.rm`. `__LIVELOAD_V94.lastFilmMs` / `.lastFilmOwn`;
  `v127check.mjs`, then `v115check.mjs`, `v114check.mjs`, `splashcheck.mjs`
- `v126 THE OPPONENT HAS A FACE, AND HE WEARS ON YOU` (beside `oppMulV111`) — `oppReadV126(opp, pl)`
  is the scouting profile the next-opponent card shows (tier, rating gap, offence/defence,
  physicality, and tempo/hitting/pressure in words); the RECOMMENDED COUNTER is gone, because the
  pregame wizard makes that call. `oppWearSayV126(pl, wk)` is the condition card's sentence — it
  names the side, their rating and physicality, your durability, each one's multiplier and the
  fatigue and injury they come to. `oppMulV111` now reads `physicality` (generated since v11, never
  used). The pregame sheet's bars (`pregamePlayerStatsV25`) fill to `drSoftCap`, not `we()`, with
  the over-cap run in gold and a tick at the cap. And the v75 sectioner has a `season` config —
  📅 SCHEDULE / 🎯 OPPONENT / 🩹 BODY / ⚔️ ROLE, with `nofold: ["sched"]` so the fixtures never end up
  behind a closed accordion. The coach's `body` spotlight points at the BODY TAB.
  `v112Dcheck.mjs`, `v111Bcheck.mjs`, `scrollcheck.mjs`, `coachcheck.mjs`, `namecheck.mjs`
- `v125 THE TOP OF THE COUNTRY IS ABSURD` (beside `NAT_POOL` / `br` / `kr`) — the elite line is
  per-LEVEL now, not a flat `/.85` at every level. `ELITE_NFL_V125[level]` is the national leader's
  production as a multiple of the DFL baseline (`per[7]`) — 5× at Pee Wee, 2.6× at Varsity —
  `eliteRV125(level, statDef)` turns that into the multiple of THIS level's own baseline, and
  `eliteSlopeV125` is what `br()` divides by. `Ni()` (the generated top 25) draws off the same
  number. Rate and lower-is-better stats keep 1.85, and 1.85 is the floor, so no level gets easier.
  `window.__V125`; `v125check.mjs`, then `rankcheck.mjs`, `v88check.mjs`, `declarecheck.mjs`
- `v124 THE PROGRAM CUTS BOTH WAYS` / `v124 THE COACH NAMES A STAT` (both beside the `pt` program
  table) — the harder programs TRADE a named attribute for the one they build (it rides the same
  `cost` field the season roll and `tpPanelV113` already read), and the four volatile ones are a
  roll: `PLAN_FATE_V124` gives odds and two outcomes, `planFateSeasonV124` resolves it ONCE a season
  onto `player.planFateV124` (a hit waives the trade and multiplies `Tt`; a miss doubles the trade
  and cuts `Tt`), `planFateExpectV124` is what the PREVIEW shows so the bars sit between the two,
  and the odds move with `fateOdds` / `fateReroll` / `fateHedge` / `fateDestiny` — the same four
  prestige nodes the game-plan roll reads. `Hi()` (recommendTraining) no longer short-circuits to
  conditioning: `trainScoreV124` scores the whole sheet by position weight, room under the SOFT cap
  and lag, and `trainWhyV124` is the sentence. `window.__V124`; `traincheck.mjs`
- `v123 THE LEAGUE HAS A MAP` (the `Ga` / `er` pools, beside `Xs()` / `Xe()`) — 120 invented towns
  and 88 mascots, and EVERY mascot matches a `LOGO_RULES` pattern, so the crest is always the animal
  in the name (it used to hash, which is how a Buffaloes side wore the eagle). `Xe(team)` is
  level-shaped: youth = `Town Mascot`, college = `Town` + `COLLEGE_V123`, level 7+ = a club from
  `DFL_V123` (fifty, built by `dflClubV123`, fixed per save). No generated name is a real NFL or
  major college team. `window.__NAMES_V123`; `namecheck.mjs` (pure Node) is the gate
- `v122 A` (the result-view injector) / `v122 THE SEASON DEBRIEF` (above `SEASON_LOG_MAX`) — the
  depth card anchored on `.season-grade`, the grade LETTER inside the 112px `.grade-ring`, so it
  rendered INSIDE the ring and smeared over the whole report screen; it anchors on the CARD now.
  `capV122()` reads the week rows in front of the season roll (it clears them), `buildV122()` joins
  them to `seasonStats` + `__RANK_V52.sn()` and returns `{head, focus, notes[] (weighted), rank,
  chance, need, seasonsLeft}`; `window.__DEBRIEF_V122`. The coach says it: a `build()` stop makes
  its lines when it opens, `every: true` exempts it from the seen-set, it fires on the report card
  with the tour ON or OFF (once a season, `rib.debriefSeen.v122`), and its SKIP writes
  `rib.debriefOff.v122` without touching the tour switch. `coachcheck.mjs` (it plays a season)
- `v121 THE FOOTBALL IS THE LAST RESORT` (in the splash boot, beside `mountChase()`) — the 🏈 in
  `.splash-stage` is `display:none` until `ballStandsIn()` adds `#splash.ball`, which needs the film
  to have stood down AND the v91 sheet to have failed. It used to paint at first paint and hide when
  the film or the chase claimed the stage, which flashed an old-looking loader for a second before
  the sting. `splashcheck.mjs`, `v112Acheck.mjs`
- `v120 THE COACH DECIDES YOUR SNAPS` (beside `USE_V111`) / `v120 FATIGUE IS A SLOPE` (beside
  `condMultV54`) — NORMAL on the pregame ladder is the share the coach trusts you with
  (`trustShareV120`: ~half at trust 28, all at 100), LIMITED/REDUCED multiply it, HEAVY/EVERY ASK for
  more (`askSayV120` grants a part, more with trust, never past 1; `askMulV120` multiplies the wear
  and the injury roll for the asking, fading at full trust — `forecastV111`, `chargeV111` and
  `injChanceV54` all read it). `fatigueMulV120` is the one fatigue multiplier: +5% fresh, nothing to
  40, a straight line to −20% at 100 (−10% at 70), hurt ≥ −10%; `condMultV54`, the ledger row
  (WEARING DOWN / WORN DOWN), the projection and the pregame's WHAT IT COSTS (`fatigueRowsV120`:
  fatigue before → after, every stat before → after) read it. The coach: `tap: true` lines put the TAP HERE
  hand (`[data-c-tap]`) over the target and pulse the cut-out; `find:` / `parent:` spotlight specs;
  `scan()` waits for `#momentBanner.go` / `#cinemaFlash.go`. `window.__V120`, `__fatigueMulV120`;
  `v111Acheck.mjs`, `v111Bcheck.mjs`, `v112Dcheck.mjs`, `coachcheck.mjs`
- `v119 THE COACH` (`public/rib-menu-coach.js` + `rib-menu-coach.css`, baked like the other
  menu files) — the talking head who pops in on every screen of a first week, over the dimmed page:
  `STOPS` (thirteen, in the order the week meets them — menu, prestige (view `upgrade`, off the
  TRAINING tile, any time), persona, position, hub, wheel, training, season, plan, pregame, live,
  result, recovery — each `when(ctx)` keyed on the page: the audit state's `view`, `#personaV13`,
  `#growthV42`, `#pregameV1513`, the scene's markers, `#pgOverlayV13`; three or four SHORT lines a
  stop in plain jock-talk, almost no numbers — the guide has those — and always the fatigue, the
  skill-mix and the prestige points), `currentStop()` (the
  first unseen stop that fits — `rib.coachSeen.v119`), `scan()` (MutationObserver + 500 ms tick;
  opens after `delay || 650` ms; waits while the welcome cards are up), `S` (the spotlight targets:
  a selector, or `text:` and a button pattern), the pace constants (`TYPE_MS` / `HOLD_MS` /
  `HOLD_PER_CHAR`; `estimateMs()` must stay inside 2–6 min for the week), `flap()` (the mouth:
  `<pose>_a` / `<pose>_b` off `public/coach/`, cut by `scripts/build-coach-art.py` — `_b` is `_a` with
  only the MOUTH set on it, the closed line erased and the open mouth hung from it, so nothing else moves and no pose has two mouths; look at
  `art/coach/coach_pairs.png` after a cut; in the shape of speech, never a metronome),
  `blip()` (the voice: one WebAudio blip per letter at a syllable rate, no sound file; VOICE mutes,
  `rib.coachVoice.v119`), `spotOn()` (a box-shadow cut-out re-measured every frame; it WAITS for a
  target that is not there yet), `toggle()` (the menu switch `rib9-tile-coach`,
  `data-rib-action="coach"`; ON walks the week, GOT IT closes a stop, DONE / SKIP switch OFF,
  `rib.coachTour.v119`), the first visit (the game's welcome cards — lifted above the menu overlay in
  v119, they were buried at z-index 190 — clicked through three times hand to the coach; `?coachTour`
  forces it). The game's state is NOT `window.o`. Two wheels share `#growthV42`: the season
  commitment comes up OVER the training board off PLAY SEASON, the weekly plan off PLAY WEEK before
  the wizard (its title reads PREGAME); both spin themselves — `#gv42go` is CONTINUE, not a spin
  button. The
  league is the DFL in every string a player reads — never write NFL into game copy.
  `window.__RIB_COACH`; `coachcheck.mjs` (it plays the whole first week)
- `v118 THE QUARTERBACK'S OWN SHEETS` (in `build-field-art.py`) / `v118 THE MESH` (beside
  `startExchangeV108`) — the handoff, the pitch and the throw both ways are cut from
  `art/field/qb_*_v118.png`, scaled by the HELMET (`helmet_w`, `HELM44`), the ball found per cell
  (`ball_or_hand` → `HAND_V108`, `BALL_DRAWN_V108`, printed at cut time), the football's brown kept
  through the gold normalisation (`keep_ball`). The left throw is the right throw's first four
  cells plus the cross-body release and follow — he throws right-handed whichever way the ball
  goes. `handoffL_up*` is the reach mirrored for a back off his left (`EX_V108.handoffL`); the pitch
  is never mirrored. `meshV118` plans, once per script, how far the quarterback's DRAWN position
  steps toward the back before the `handoff` event (`meshMaxYdPerS`, `meshStepYd`, `meshReachYd`),
  `meshOffsetV118` applies it in the placement loop, `m._meshFaceV118` holds his facing, and
  `P._meshV118.far` turns an exchange the step could not close into a pitch (the toss cycle and the
  toss flight). Nothing in the sim moves. `window.__V118`; `v108check.mjs`
- `v117 ONE MAN, ONE SLOT` / `v117 AND HE ROTATES THROUGH THEM` — the eleven markers are filled by
  drawing roster players out of a per-position pool, and the draw now REMOVES what it hands out, so
  nobody is fielded twice on a snap (`placed`, `drop()`). The named picks — the carrier, the target,
  the quarterback — reserve their slots before the first body is drawn, and so does the you-player,
  whose slot (`youSlot`) is ROLLED among his position's slots each snap instead of always being the
  first index that matches. Both halves are the same bug: the you-player was on the field as two or
  three linebackers at once on 56% of his defensive snaps, and every stop those ghosts made was
  booked to him off a team-mate's alignment, while his own marker stood in the quietest slot of the
  three. Credit paths tightened with it: an interception is `pe(X.cover)` and nothing else (the
  `Math.random()<.5` fallback is gone), and a face mask / horse collar flagged on YOU marks the row
  `involved`. Score-neutral (24.43 → 24.38 combined points over 600 games a side). `v117check.mjs`
- `v116 THE FILM LOOPS` — the loading film never stops, at either door. `LOOP_FROM_V116` (6.5s) is
  the SEAM: the streak has finished landing on the wordmark by then, and everything after it is the
  wordmark breathing under cloud, so the last frame runs straight back into 6.5s (measured 3.4/255
  mean difference — invisible). `loop` stays FALSE on the element, because a native loop rewinds to
  the black at zero AND swallows the `ended` event that triggers the rewind; `loopBack(v)` does it
  by hand and is shared with door two through `__V114.loopBack` (door two plays that very element).
  The intro is a one-time thing, so the door now waits for `V.landed` — the playhead passing the
  seam — instead of an end that never comes (`FILM_WAIT_INTRO`), which makes the splash SHORTER
  than v114's (~6.5s, not the whole film) and hands anything longer to the loop. The bar's playhead
  share counts down to the seam for the same reason, and `LIVE_FILM_FROM` is now the seam itself, so
  door two opens on the finished wordmark. Asset: `public/rib_film_v116.{mp4,webm,jpg}`, cut by
  `scripts/build-splash-film.mjs` from `art/splash/rib_loop_master_v116.mp4` (20MB of 1080p HEVC →
  ~1.4MB of 960x540 H.264 — the master is undecodable in most browsers AND `moov`-last, so the
  re-cut is not optional). `window.__V114` carries `loopFrom` / `landed` / `loops` / `loopBack()`;
  `v114check.mjs` is the gate — it defers the app's own knock by 20s so the loop can be watched
- `v115 THE FILM AT BOTH DOORS` — the live game's loader over `.field-wrap` plays the sting too, as a
  BACKDROP under the matchup (`.rib-liveload-film-v115`, `object-fit:contain` — `cover` cropped the
  wordmark off the sides, and the ground already wears the film's black so the letterbox is
  invisible; the caption moves to the band BELOW the picture, where centring it would land it on
  the logo, and the loading bar is `display:none` here — the sting is the picture). The hand-off is
  ordered: the caption drops (.26s), the film keeps its face and swells to 1.09 (.66s), the layer
  goes LAST after a .12s beat, and the film is parked only when that finishes — parking it up front
  detached the `<video>` and left an empty black layer to fade. Three differences from door one, all deliberate: it does NOT wait for the film (the
  door opens on the scene standing and the first play built — holding it for 14.5s would front-load
  every game), it starts at `LIVE_FILM_FROM` (v116: the seam, the landed wordmark), and it uses the
  element door one already loaded. That last one is the whole trick: door two mounts while Phaser is compiling,
  and a media element's load does not START until the main thread lets it (measured: `play()` then
  `loadstart` **2.7s** later, on a door open for four). So `__V114.park()` keeps the buffered element
  when the splash leaves and `take()`/`give()` lend it out — one decoded film per session, no second
  request. `claimed()` fires BEFORE the seek (a seek drops readyState and would hand the door to the
  chase for nothing). No film at door one — reduced motion, `?noFilmV114`, no codec — means no film
  here either, and the v94 chase runs unchanged. Same pass matched the splash's ground to the film's
  own black (measured rgb(4,8,11) at its edges) and ran the film full-bleed with no radius or shadow,
  because a rounded card on a blue-grey ground put a visible seam around it. `v115check.mjs` is the
  gate; `splashcheck.mjs` case 4 now boots `?noFilmV114` so it keeps testing the chase there
- `v114 THE SPLASH IS A FILM` — the boot splash plays the title sting (`public/rib_film_v116.mp4`,
  the VP9 `.webm` sibling for a browser with no H.264, the `.jpg` last frame for reduced motion; all
  three cut by `scripts/build-splash-film.mjs` from `art/splash/rib_loop_master_v116.mp4`, **`+faststart`
  or it is not a loading screen**). The source is chosen by a picker inline BESIDE the `<video>`, not
  by a `<source>` in the markup or a `<link rel=preload>` in the head: both of those start a fetch
  the page cannot take back, and on a fast link the ~900KB completes before any script could abort
  it — so the paths that refuse the film (reduced motion, `?noFilmV114`) would pay for a file they
  never show. Deciding beside the element costs a few ms against the preload scanner and buys a
  guarantee; `stopLoad()` is the belt to that braces. The splash leaves when the app is ready AND
  the film's intro has landed (v116's `FILM_WAIT_INTRO`, capped by
  `FILM_CAP_MS`; `FILM_START_MS` is the audition — no frame by then and the v94 chase takes the stage
  back, which is also the `?noFilmV114` path). The loader bar is two layers: v112 A's compositor
  sweep (`.splash-loader i`, untouched) over a determinate fill (`.splash-loader b`, a composited
  transform) weighted buffered/sheet/door/playhead (the playhead counting down to v116's seam).
  Door two — the live game's loader — is still the chase. `window.__V114` is the hook; `v114check.mjs` is the gate and `splashcheck.mjs` now
  boots `?noFilmV114` so it keeps testing the fallback
- `v113 THE BOARD IS A GRID, AND THE CHOICE IS TWO TAPS` — the offseason "Choose Your Training"
  board is the twelve programs as icons, four across and three down, and a tile PREVIEWS rather
  than commits: `tpPanelV113` redraws the sheet under the grid for that program — one bar per
  attribute, drawn against its **soft cap** (`drSoftCap`, not `we()`, so a young player's bars are
  not slivers; a stat past its cap stretches the scale and keeps a tick where the cap sits) with
  the season it would add as a light-blue segment that pulses on a 2.6s cycle on the stats the
  program actually pushes. The dock's `confirmTraining()` is the commit, and it is still `Ir`.
  The tiles stay `.train-card` with the key in the first quoted token of their onclick (the
  checks' regex stops at a digit — hence `previewTraining`, not `previewTrainingV113`).
  `window.__V113` is the hook; `capcheck.mjs`, `skillartcheck.mjs`, `v85check.mjs`
- `v110 THE MAN WHO IS THERE` — position on the field decides who makes the play. A read lands the
  moment the ball is inside `TU("seeBallPx", 20)` (a man does not stand a yard from the football
  still diagnosing it), support holds only if it is genuinely FARTHER off than the committer, the
  commit is handed to whoever is closest measured after the step (`commitTakePx`; a stationary man
  in the gap can now own it, and a BLOCKED man who is closer can fall off onto the carrier), a
  defender the carrier runs into resolves contact with no commit at all (`contactAnyPx`), and at
  the catch point the nearest defender — not just the assigned cover man — plays the ball, returns
  the interception and takes the credit (`ballManTakePx`/`ballManReachPx`, `out.coverPlayer`).
  Support CLOSES instead of parking. `window.__V110` is the hook, `v110check.mjs` the gate
- `v109 THE BALL HAS A SPEED` / `v109 THE HIT HAS A POINT` / `v109 THE FEET PLANT` /
  `v109 THE GAME HAS A CLOCK` — the realism suite. The throw is a RELEASE plus a VELOCITY
  (`flightMsV101` rewritten, `ballVelV109`, `apexPxV109`, the arc derived from the hang and peaking
  at `TU("arcApexFrac")`), the `throw` event carries `dur/vel/velMph/apex/wobble/platform/errDir`
  and the picture spins and wobbles off them, a hurried miss is biased behind-and-short (the
  MAGNITUDE distribution is untouched — that is what keeps `catchP`/`intP`/`swatP` still),
  and a throwaway is a real thrown ball that can land out of bounds. Contact carries its own
  geometry (`hitGeoV109`: `cid`, `ix/iy`, `nx/ny`, `impact`, `side` on every lunge and every event
  that resolves it), the gang CONVERGES (`wrapInV109`), the pile keeps each joiner's approach
  bearing and beats a `drag` while it travels, a strip runs a real loose-ball scramble to the
  SAME pre-rolled recovery (`recoverV109`, `looseV109` off restores the old same-tick ending), and
  a hard hit can bobble the ball with no possession change. The feet gather and PLANT before a cut
  (`plantV109` looks ahead in the script), men lean into a turn and cross over instead of flipping
  180° in a frame (`leanV109`/`faceAngV109`), a trucked man slides and gets up on a clock rather
  than freezing on a pixel, support fans on its own approach rays, a jog RESUMES, and a hit leaves
  a stumble. The game keeps a real clock: the extra point is its OWN row (`pushTryV109`, same rolls),
  `clockStopped`/`secs`/`runoff`/`toLeft`/`period` ride every row, out-of-bounds is read from the
  sim log first, the two-minute warning / period / coin-toss / timeout are rows, the flag is thrown,
  announced and re-spotted, a spot inside a yard brings the chains, and punts, kicks and tacklers
  finally have their numbers. **Score-neutral by construction** — `scoreneutralcheck.mjs` is the gate
- `v108 THE EXCHANGE, AND WHICH WAY HE THROWS` — the rear throw is drawn twice, so a quarterback
  facing `up` picks the ARM instead of turning: `throwR_up*` for a target to his screen-right (the
  straight ball too), `throwL_up*` across the body to his left, inside `TU("throwDirConeDeg", 70)`
  off straight ahead (wider or behind him still goes through v107's turn; `dir` rides
  `__V107.throws`). The exchange is drawn too — `exchangeV108` / `startExchangeV108` beside
  `windupV107` back-date `handoff_up0..4` (`TU("handoffFrameMs", 70)`, frame 2 ON the event) and
  `toss_up0..4` (`TU("tossFrameMs", 80)`, frame 3; the sweep-family regex `TOSS_CALL_V108` decides
  before the event) onto `forceState = "handSeq"`; both are right-handed, so a back off his LEFT
  keeps the pre-v108 picture (`TU("exchangeSideMinPx", -3)`). `BALL_DRAWN_V108` is the MEASURED
  per-cycle list of frames whose cell draws a football (v107's flat 0-3 was only true of the front
  and quarter cycles) and `HAND_V108` mounts ours on the cell's own hand on the frames it does
  not — never two, never none: `window.__V108.ballDoubled`/`.ballMissing` stay 0. `v108check.mjs`
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
| who is actually on the field — the eleven markers, duplicate players, which slot he lines up in (v117) | `v117check.mjs`, then `creditcheck.mjs`, `statcreditcheck.mjs`, `v110check.mjs`, `scoreneutralcheck.mjs`, `simcheck.mjs` |
| game engine / play-calling / yardage | `simcheck.mjs` |
| anything sim-side that should be visible | `renderpathcheck.mjs` |
| injuries | `injurycheck.mjs` |
| OVR scale / the silent sim path / the attribute sheet (v85) | `v85check.mjs`, `bodycheck.mjs`, `wheelcheck.mjs` |
| the broadcast renderer between plays / tackle looks (v86) | `v86check.mjs`, `readshot.mjs` |
| pass coverage / credit, QB scramble & targets, the safety, the huddle (v87) | `v87check.mjs`, `creditcheck.mjs`, `simcheck.mjs` |
| what it takes to rank nationally / the leaders board's own numbers (v125) | `v125check.mjs`, then `rankcheck.mjs`, `v88check.mjs`, `declarecheck.mjs`, `v85check.mjs` |
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
| the loading film's loop — the seam, the rewind, what the door waits for (v116) | `v114check.mjs`, then `v115check.mjs`, `splashcheck.mjs`, `v112Acheck.mjs` |
| whether the live game's loader gets the film up, with or without one parked (v127) | `v127check.mjs`, then `v115check.mjs`, `v114check.mjs`, `splashcheck.mjs` |
| the live game's loader playing the film — the parked element, the offset, the door (v115) | `v115check.mjs`, then `v114check.mjs`, `splashcheck.mjs`, `v86check.mjs` |
| the boot splash's film — the asset, the door, the bar (v114) | `v114check.mjs`, then `splashcheck.mjs`, `shot.mjs` |
| the loading screen / the splash's door (v94) | `splashcheck.mjs`, `shot.mjs`, `walk.mjs` |
| the end-zone paint / home and away fixtures (v93) | `v93check.mjs`, `v86check.mjs` |
| the stadium behind the bowl / the big screen / the posts / number formatting (v92) | `v92check.mjs`, `v86check.mjs` |
| the field sheets / the v91 atlas / player and ball frames (v91) | `v91check.mjs`, `v86check.mjs`, `renderpathcheck.mjs` |
| the silent path's story rolls / the upgrade sheet's numbers / the menu ring (v90) | `v90check.mjs`, `v85check.mjs` |
| the main menu / its feed / menu art (v89) | `menu-integration-check.mjs`, `menushot.mjs` (`CAREER=1`), `menu-preview-shot.mjs` |
| the pregame ladder's snaps, the asking-above-your-share price, coach trust's say, the fatigue slope (v120) | `v111Acheck.mjs`, `v111Bcheck.mjs`, `v112Dcheck.mjs`, then `v85check.mjs`, `creditcheck.mjs`, `simcheck.mjs`, `scoreneutralcheck.mjs`, `faqcheck.mjs` |
| the season report card's layout, the season debrief and what the coach says about your year (v122) | `coachcheck.mjs` (it plays a whole season to the report card), then `v85check.mjs`, `postgamecheck.mjs`, `declarecheck.mjs`, `walk.mjs` |
| the coach — the switch, the stops and which screen each keys on, the talking head, the spotlights, the TAP HERE hand, the first-visit start; any DFL / league copy (v119) | `python3 scripts/build-coach-art.py` (if a sheet changed), `RIB_MENU_VERSION=<stamp> node scripts/bake-menu-into-index.mjs` (any menu file), then `coachcheck.mjs`, `faqcheck.mjs`, `menu-integration-check.mjs`, `walk.mjs` |
| which way the throw goes / the drawn handoff and pitch / which frames draw the ball (v108) | `v108check.mjs`, then `v107check.mjs`, `v86check.mjs`, `v105check.mjs`, `v91check.mjs`, `kitsidecheck.mjs` (LB), `v104check.mjs` |
| the QB sheets — the reach, the pitch, the throw both ways, the mesh step, hand vs pitch (v118) | `node scripts/build-field-art.mjs` (read the printed `HAND_V108` / `BALL_DRAWN_V108` back into index.html), then `v108check.mjs`, `v107check.mjs`, `v105check.mjs`, `v91check.mjs`, `v104check.mjs`, `renderpathcheck.mjs` |
| the wordmark sheen / the camera flashes, lamps and sun on the hero (v107.1) | `sheencheck.mjs`, `heroflashcheck.mjs`, then `v102check.mjs`, `menu-integration-check.mjs`, `menu-mask-check.mjs` |
| the throw's facing / the release's timing / the dropback / the pre-snap stances (v107) | `v107check.mjs`, then `v86check.mjs`, `v105check.mjs`, `v91check.mjs`, `renderpathcheck.mjs`, `kitsidecheck.mjs` (LB) |
| the loading animation's readiness / the warm in the head / the loader bar (v112 A) | `v112Acheck.mjs`, then `splashcheck.mjs`, `renderpathcheck.mjs`, `v86check.mjs` |
| the body he has vs the body he projects to / the trait choice / the reroll penalty (v112 C) | `v112Ccheck.mjs`, then `bodycheck.mjs`, `v85check.mjs`, `menu-integration-check.mjs`, `simcheck.mjs`, `creditcheck.mjs`, `walk.mjs` |
| the pregame wizard's pages, its defaults and the way into the game (v112 D) | `v112Dcheck.mjs`, then `v111Bcheck.mjs`, `walk.mjs`, `splashcheck.mjs` |
| the masts / the bowl's base band and entrance / the stars / the near edge's distortion (v112 B) | `v112Bcheck.mjs`, then `v98check.mjs`, `v99check.mjs`, `v100check.mjs`, `v102check.mjs`, `v92check.mjs`, `v86check.mjs`, `crowdcheck.mjs`, `sidelinecheck.mjs` |
| the camera — what it follows, how tight, and the Settings behaviours (v112 E) | `v112Echeck.mjs`, then `v109Echeck.mjs`, `v86check.mjs`, `v98check.mjs`, `v105check.mjs`, `renderpathcheck.mjs`, `sidelinecheck.mjs` |
| a big hit taking a man off his feet — the launch, the arc, the landing (v112 F) | `v112Fcheck.mjs`, then `v103check.mjs`, `v109C1check.mjs`, `tacklecheck.mjs`, `readcheck.mjs`, `renderpathcheck.mjs`, `scoreneutralcheck.mjs` |
| whether being in position decides the play — stops, break-ups, interceptions (v110) | `v110check.mjs`, then `creditcheck.mjs`, `tacklecheck.mjs`, `readcheck.mjs`, `v103check.mjs`, `scoreneutralcheck.mjs` |
| anything in the live sim's FEEL (contact, possession, ball speed, catching, tackling, the clock) | `scoreneutralcheck.mjs` FIRST (keep the before row), then the v109 checks below |
| the throw's flight, arc, wobble or a throwaway (v109 A) | `v109Acheck.mjs`, then `v101check.mjs`, `v107check.mjs`, `v105check.mjs`, `simcheck.mjs` |
| impact geometry, the gang, the pile, the loose fumble, the bobble (v109 C1) | `v109C1check.mjs`, then `v103check.mjs`, `tacklecheck.mjs`, `creditcheck.mjs`, `renderpathcheck.mjs` |
| the plant, the lean, down men, pursuit pace, the stumble (v109 C2) | `v109C2check.mjs`, then `readcheck.mjs`, `jukecheck.mjs`, `tacklecheck.mjs`, `v86check.mjs` |
| the receiver's track, the reach and tuck, incompletion reasons, break-ups, the pump (v109 B) | `v109Bcheck.mjs`, then `v87check.mjs`, `v107check.mjs`, `v91check.mjs`, `routecheck.mjs` |
| the camera, the crew, the huddle, celebrations, the QB's eyes (v109 E) | `v109Echeck.mjs`, then `v86check.mjs`, `v98check.mjs`, `refcheck.mjs`, `sidelinecheck.mjs` |
| the clock, the try, timeouts, the flag, the chains, play descriptions (v109 D) | `v109Dcheck.mjs`, then `simcheck.mjs`, `postgamecheck.mjs`, `badgecheck.mjs`, `refcheck.mjs`, `walk.mjs` |
| the deploy reaching a browser / the build meta / the one-time reload (v106.1) | `freshcheck.mjs` (no dev server), then `menu-integration-check.mjs`, `menu-mask-check.mjs` |
| the team kit on the menu pictures / the hero, continue-card and portrait masks (v106) | `python3 scripts/build-menu-art.py` (or the one `menu-kit-*.py`), then `menu-mask-check.mjs`, `menu-kit-shot.mjs` (look at the shots), `menu-integration-check.mjs`, `v102check.mjs`, `menushot.mjs` (`CAREER=1`) |
| a school, college or DFL club's name, or which crest it wears (v123) | `namecheck.mjs`, then `emblemcheck.mjs`, `menu-integration-check.mjs`, `walk.mjs` |
| team emblems / palettes / identity | `emblemcheck.mjs` |
| training / skill art, the skill atlas | `skillartcheck.mjs`, `wheelcheck.mjs` |
| the training programs — what a program trades away, the fate roll and its odds, or what the coach recommends (v124) | `traincheck.mjs`, then `capcheck.mjs`, `v85check.mjs`, `skillartcheck.mjs`, `scrollcheck.mjs`, `coachcheck.mjs` |
| the next-opponent card, the wear-and-tear copy, the pregame bars or the season screen's tabs (v126) | `v112Dcheck.mjs`, `v111Bcheck.mjs`, `scrollcheck.mjs`, `coachcheck.mjs`, then `namecheck.mjs`, `walk.mjs`, `shot.mjs` |
| the offseason training board — the grid, the preview sheet, the confirm (v113) | `skillartcheck.mjs`, `capcheck.mjs`, `v85check.mjs`, then `walk.mjs`, `scrollcheck.mjs`, `shot.mjs` |
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
