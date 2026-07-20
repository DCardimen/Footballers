# RUNNING IT BACK — Life of a Player

A football career-simulation game (Phaser + canvas). The live game is
**GRIDIRON v15.21**.

## ▶ Play / read the current build

`index.html` is fully self-contained (Phaser + all art baked inline), so it runs
straight from the browser — no install. The GitHub Pages workflow
(`.github/workflows/pages.yml`) redeploys it on **every push**, so this link
always serves the newest committed build:

**▶ Play the latest build:** <https://dcardimen.github.io/Footballers/>

> First-time setup (one click): repo **Settings → Pages → Build and deployment →
> Source: GitHub Actions**. After that the link stays live and self-updates on
> every push.

## Develop

```bash
npm install
npm run dev      # Vite dev server with hot reload at http://localhost:5173
npm run build    # production build -> dist/
npm run shot     # screenshot the running game (headless) for quick validation
```

**Start here when editing code:**

- **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** — the codebase map: every
  `<script>` block in `index.html` with its grep anchor, the two engines
  (FieldSim resolver vs legacy choreographer), the stat-credit flow, the render
  path, and the known gotchas.
- **[`scripts/README.md`](scripts/README.md)** — catalog of the headless dev
  checks (`node scripts/<name>.mjs` against the running dev server) and how to
  write a new one.
- **[`CLAUDE.md`](CLAUDE.md)** — the condensed version of both, plus the house
  rules (stat-credit truth, `TU()` tunables, which check to run for which
  change).

The whole game ships as a single self-contained `index.html` (baked sprite
atlas + field art as data URLs, Phaser bundled inline). The readable systems
worth knowing about live in these inline `<script>` blocks:

- **Play choreography engine** — `buildPlayScript(payload, cfg)` builds every
  actor's keyframes, the ball flight, and the event stream for a play. Pure, no
  Phaser/DOM. This is where running, contact, tackling and gang-tackle logic live.
- **`LiveField` Phaser scene** — plays the script back: projects sim coords to
  the north-south broadcast view (`PJ`), drives sprite facing/animation
  (`placeMarker` / `faceMarker`), and turns events into on-field FX (`fireEvent`).
- **`rib-v1520-phaser-runtime`** — per-player appearance/sizing and the football.

Every gameplay dial reads through `TU(key, default)`, so values can be retuned
live via `window.RIB_TUNE[key] = ...` without touching code.

## Recent changes

- **v26 — uploaded field image with an adjustable 2.5D perspective.** The field surface
  is now a real IMAGE (`window.__RIB_FIELD`, `scene.fieldSpr`) instead of the procedurally
  drawn v25 turf. A flat overhead field PNG is baked in, pre-rotated to the game's vertical
  north-south orientation, and it supplies ALL the turf, stripes, yard lines, numbers and
  end zones. `PJ()` is orthographic (screen position linear along and across the field), so
  the image and every player share ONE flat plane; the 2.5D look comes entirely from a CSS
  perspective **tilt** applied to the whole `#field` canvas (image + players + lines tilt
  together), so nothing ever misaligns. `drawField` no longer paints turf — it only lays
  the moving LOS (blue) + first-down (gold) markers over the image. The Settings card gains
  a live **"Field perspective (2.5D)"** slider (0 = flat top-down → higher = a leaning 3D
  broadcast angle) alongside player size / spread / zoom. To swap the field art, replace
  the `window.__RIB_FIELD` data URL (a 360×700 image, drawn at scale 2).

- **v25 — 3D field, group tackling, hit-stick, named temp boosts, realistic
  progression, and randomized team colors.** A large gameplay + presentation pass:
  - **Procedural perspective field.** The flat baked field art is retired; the turf,
    mowing stripes, converging sidelines, yard lines, hash marks and yard NUMBERS are
    now drawn live through `PJ()` so they foreshorten with depth. Depth anchors at the
    OFFENSIVE BACKFIELD and resets every snap, so the offense reads the same large size
    at the line no matter the yard line. New **Field radius** slider tunes the falloff
    for players and field together.
  - **Group tackling.** A live "hands-on" swarm count chokes every evasion and scales
    the gang-wrap odds — two men bring you down fast, three is mostly a wrap (kills the
    600-yard-back outlier; team rushing ~71→~55/game, gang tackles 26%→~66%).
  - **Height tackle geometry + hit stick.** High tackles fold both men together; low
    shoestring tackles let the carrier's momentum stumble him forward. A violent truck
    (offense) or big-stick tackle (defense) flings the loser with the baked dive→down
    sprite frames and a freeze-frame.
  - **Named temporary stat boosts.** The "+X% ALL stats" edge is gone. The personality
    wheel and story/game-plan rolls now grant 1–2 varied, position-relevant NAMED stat
    buffs for a single game (some at the player's MAX); incidents dock one stat. All
    persistent/season-long boosts are removed (prestige tree kept). The pregame lists
    YOUR STATS as bars with the temp boost in a separate colour (green / gold MAX).
  - **Bonkers national leaders + realistic funnel.** The top of the country posts
    ~260–340 rush and ~490 pass yds/game at the elite ranks (leaderboard only — the
    player's game sim is untouched). Advancement is now percentile-gated per level:
    reach youth on a coin flip, tighten through HS, then only a sliver make college →
    combine → the pros.
  - **Team colours actually randomize.** The team-creator block was throwing at load
    (a cross-`<script>` `TEAM_PALETTES` reference), so every team fell back to the
    default palette; fixed, so each career rolls a fresh look and the in-canvas jerseys
    follow it.
  - **Personality screen fits on one page** — all 8 trait rows visible without
    scrolling at any viewport, Lock-In button always in view.

- **v24 — field depth that resets at the LOS, 30% slower base movement, rating-
  driven cuts, and tackle height leverage.** A broadcast + feel pass:
  - **Depth perception resets at the line of scrimmage.** `PJ()` still places every
    player's screen-Y linearly with field position (so they stand on the correct
    baked yard line), but the depth CUE — how big a man reads and how far the
    sidelines splay — is now measured from the scrimmage (`LOS_U`), not the fixed
    field ends. `LOS_U` is refreshed every snap in `drawField`, so the framing snaps
    back to the same reference each play: the carrier is the same size at the line
    whether the ball's on the 5 or the 45, and everyone up/downfield looms nearer or
    recedes smaller relative to HIM. Span is a live dial (`TU("depthSpan",620)`).
  - **Field depth overlay.** `drawField` paints a foreshortened depth ramp over the
    turf — the downfield end sinks into shadow and a soft ground-glow pools at the
    LOS — so the field reads as receding into the distance from the scrimmage.
  - **Base movement 30% slower for everyone** (`TU("basePlayRate",0.7)`, applied in
    the render `update` loop). A more deliberate, readable pace where cuts, jukes and
    pursuit angles land as real moves; the user's 1×/2× control multiplies on top and
    the stall watchdog was widened to match.
  - **Cutting / jukes / spins are rating-driven and fluid.** Which move beats a
    tackler is now chosen by ratings (spin favors agility, jump-cut juke favors
    quickness), the carrier's elusiveness (`agi`/`quickness`) rides on the `cut`
    event, and the renderer scales the animation's crispness and recovery speed off
    it — an elite back's move is fast and clean, a scrub's is slow and wobbly. The
    agility→speed-retention coupling through a hard plant was widened (`0.0022→0.0026`,
    mirrored in `turnTest`).
  - **Tackle variability with height.** Every agent carries a real height (inches;
    the you-player's actual body when on the roster, otherwise a role base + jitter).
    Contact leverage reads off the tackler-vs-carrier gap: a shorter man gets under
    the pads and wins the wrap, a taller man tackles high and gets ducked, hurdled,
    trucked and stiff-armed more — a small per-inch swing on every branch, and the
    per-play jitter makes each rep a slightly different collision.

- **v23.1 — character-driven story arcs, scramble warnings, pregame game-plan
  suggestions.** Four gameplay systems:
  - **Story-arc auto choices are no longer generic.** Removed the rest-of-season
    "Season Momentum" boost entirely (it compounded a flat rating bump into every
    game). The auto-picked choice now resolves into a SINGLE-GAME outcome driven
    by the kid's **character** (coach trust): good kids stack reliable, modest,
    *varied* positives; problem children (low trust / high clash) roll a real
    off-field **incident** — out too late, late to practice, told off a coach,
    blew off film, ran his mouth — that costs `−4..−14%` stats for the game AND
    `−2..−8` coach trust, shown red in the roll popup. Bolder picks widen both
    tails. The next-game boost is now also applied in **live** games (`lt`), not
    just quick-sim.
  - **Scramble warning ❗.** When a defender breaks through the line and bears
    down on the QB (`pressureAlert`/`freeRusher`), a pulsing red exclamation mark
    floats over that defender's head as a child of his marker (tracks + depth-
    scales with him), telegraphing the scramble/sack a beat early. Cleared when
    the ball comes out or the play resets.
  - **Pregame game-plan suggestions.** The pregame panel now offers **3 scenarios**
    built from the opponent's scouted weak units (their secondary → *Air It Out*,
    their front seven → *Pound the Rock*, plus *Stay Balanced*), each showing a
    concrete pass/run split (~60–75% pass on the air plan). You pitch one to the
    coordinator.
  - **Coach adoption + Field General prestige + play-mix injection.** The coach
    adopts your suggestion in proportion to your standing — coach trust, recent
    form, and a new **Field General** prestige node (+18%/level, max 4). The
    adopted pass rate is blended into the sim's per-play `passP` for that game
    (`window.__gameScriptBiasV23`), so your read actually bends the script
    (verified: a run-lean call → 38% pass vs a pass-lean call → 58% pass). An
    impact bar shows exactly how much of your suggestion the coach took and the
    resulting game-script pass/run split.
- **v23 — team-strength variance, QB read progression, 2.5D camera, flat-stat
  cleanup.** A batch of seven gameplay/feel changes:
  - **Wider team OVR variance.** `Wr`'s quality math now spreads opponents from
    roughly −10% below the per-level base to +30% above it (deterministic per
    week via `__oppMulForV22(name)` so the pregame preview and the live game
    agree), with per-player roll noise on top. Prestige/upgrades lift *your*
    team past the strongest opponents (up to ~+20% above), via a prestige factor
    `_prF` folded into the us-quality term and a widened per-player clamp.
  - **Every "+performance" bonus is now a flat stat boost.** Gear
    ("Conditioning +X to ALL stats"), prestige nodes, **and the personality
    Win-Now / Me-First traits** all feed `perfFlat`, which is applied inside the
    sim's attribute accessor (`_raw`) as a real +N to every attribute for the
    game — so it shows up as actual production (and flows into the box-score
    grade) instead of an abstract rating bump. The old personality rating-bump
    (`et` wrapper) was removed to avoid double-counting; `varMult`/`injMult`
    personality effects stay. Verified: +12 flat → +15 pass yds, +16 rush yds,
    +0.4 TD/game for a QB.
  - **QB read progression.** The QB now scans his vision cone THROUGH a short
    read progression during the drop — a couple of decoy reads (covered → red
    cone) before landing on the actual target (green when open) — and can only
    release to the man he is focused on at that instant. Built in the FieldSim
    pass setup (`readProg`) and driven by the per-tick `look` emit. Verified:
    2–3 distinct reads on most pass plays, ~98% of throws land on the
    last-focused receiver.
  - **2.5D camera — resets to the line every play, more depth, bigger scale.**
    `animatePlay` now re-centers on the fresh line of scrimmage right after
    `drawField` refreshes `focusPt` (the pre-play `resetCamera` in `softStop`
    fired before the LOS updated). Perspective defaults raised: tilt 15→20,
    depth 0.15→0.38, player size 1.0→1.32, with the Settings sliders' ranges
    widened to match.
  - **Defender teleport fixed.** The punt returner used to hard-snap to the
    catch spot (`returner.x = landX`); replaced with a hang-time flight + small
    catch nudge, plus a general single-frame step clamp (`choreoMaxStep`) on the
    choreographer's frames. A beaten/trailing defender who can't run the carrier
    down no longer kick-sprints back into the play, so offenses that get behind
    the coverage keep their real chance to score.
  - **Team colors vary each new career.** A fresh run rerolls the team
    palette/logo (`__randomizeTeamLookV22`, called from `Di`) unless the user
    has explicitly set them (`userSetV22`).
- **v22.2 — pregame OVRs now match the team you actually play.** The pregame
  generated its display roster from a separate scouting-scale generator
  (`__GRIDIRON_GENERATE_ROSTER_V157`), whose numbers were unrelated to the
  in-game opponent that `Wr`/`__simGameV2` builds around the per-level base — so
  the shown overalls were way off (e.g. opponent shown ~24 with top-5 in the
  30s, but actually played at ~17 with top-5 ~20). Added
  `window.__previewMatchupV22(pos, perf)` that builds the matchup with the SAME
  `Wr` the game uses, and rewired `showPregame` to display its team OVRs +
  top-5. The win % and composition notes now derive from those same OVRs, so the
  whole panel is internally consistent and matches the game (verified: preview
  18/18 vs actual game 18/18).
- **v22.1 — sprite overlay made ADDITIVE (revert the base-look override).** v22
  had replaced the base run cycle + idle for every player with the detailed art,
  which changed the whole look. Reverted: **base run/idle are the original cells
  again** (`__RIB_FRAMES` back to 8, `RIB_META_V22` no longer carries `run_*`/
  `idle_*`). The overlay now only **enhances motion moments** by overriding the
  named action cells the engine already builds those textures from:
  - **Tackle-to-ground + dive** — `dive0-3`, `down0-1`, `grab` from the
    diving-tackle sheet (auto-override; drives the `tackleSeq`/`dive`/`down` poses).
  - **Cutting/plant** — a dedicated `cut_<dir>` frame from the cuts sheet
    overrides ONLY the `cut` state (base run frame 2 untouched).
  Everything else stays the original sprite. Repack with
  `node scripts/spritekit/pack.mjs && node scripts/spritekit/bake.mjs`. Renderer
  only (creditcheck 0 violations, render path ~87–90%).
- **v22 — real sprite-art integration (stage 1: run + idle).** The player run
  cycle and idle now render from the uploaded high-fidelity pixel-art sheets
  (`art/source/`) instead of the chunky baked cells. A reusable asset pipeline
  lives in `scripts/spritekit/`:
  - `analyze.mjs` / `survey.mjs` — detect each sheet's grid and per-row facing.
  - `slice.mjs` — trim frames (drop-shadow-aware).
  - `recolor_test.mjs` — proves the detailed art recolors through the existing
    `ribRecolor` keys (navy→primary, gold→secondary) — it does, cleanly.
  - `pack.mjs` — flood-fills out the white matte + shadow, bottom-aligns feet,
    downscales to the engine's 48×48 cell, and packs a second atlas
    (`public/rib_atlas_v22.png`) + `art/atlas_v22.cellmap.json`.
  - `bake.mjs` — inlines that atlas into `index.html` as
    `window.__RIB_ATLAS_V22` (data URL) so it works offline in the single file.
  Runtime wiring: `ribCellV22` + a preference in `ribRegisterTeam`'s `put()` make
  the overlay cells override the baked ones by name through the SAME recolor
  path, so every team still recolors. If the overlay is ever absent the game
  falls back to the original atlas — it can't be broken by its absence. Renderer
  only (creditcheck 0 violations, render path ~84–87%). Remaining sheets
  (get-up, catches, diving tackle, block/pancake, stiff-arm/hurdle) are sliced
  and ready to add in follow-up stages; QB throw + pre-snap stance still use the
  original cells.
- **v21.2 — animation fluidity pass (broadcast renderer).** Closes the most
  jarring gaps in the on-field motion using the existing sprite atlas cells plus
  the renderer's own launch/puff mechanisms — no new art required:
  - **Get-up recovery.** A downed player no longer teleports upright. The pose
    machine (`placeMarker`) tracks the last frame he was on the turf and, once
    he's free and roughly stationary, plays a brief crouch (`stance`) → stand
    (`idle`) recovery before normal states resume. Tunables `getupMs`,
    `getupSpd`.
  - **High-point catches & picks.** Receptions and interceptions now LEAP for the
    ball — the arms-up `catch` cell plus a launch-parabola hop, then a settle —
    instead of a flat static grab. Tunables `catchHopMs`, `catchHopH`,
    `catchHoldMs`.
  - **Impact & motion turf.** Tackles kick up a spray of turf the instant the
    body grounds (once per takedown); hard cuts/jukes and fast runs kick dust
    (`runDustSpd`). All screenshot-tested; render-path hit rate unchanged
    (~88–92%). NOTE: this delivers the *fluidity* the five commissioned sprite
    sheets target; baking those exact sheets in still requires the source PNG
    files on disk (they were supplied as chat images only).
- **v21.1 — rolled personalities + prestige adjustment points.** Your starting
  personality is now ROLLED (bell-ish, centered on neutral, tails possible) —
  the white tick on each slider marks what the dice gave you. Free slider
  points are gone: what you get are **adjustment points** — **+1 per
  prestige** (plus Identity Coach's +2/level) — so early careers largely play
  the hand they're dealt, and stacked-prestige runs can fully sculpt an
  identity. Moving a slider back toward its rolled value is always free; the
  rolled baseline is kept on `player.personaRolledV21`.
- **v21 — diminishing-returns training (no hard stat wall).** The "At potential
  ceiling" hard stop is gone. Each stat now has a **soft cap**: +1 costs 1 point
  below it, then **2, 3, 4…** per band of `drBandWidth` (10) above it, forever.
  The soft cap = potential ceiling × (star base % + fixed % per prestige) × the
  stat's personality ceiling multiplier — `drStarBase` (60% at 1★) +
  `drStarStep` (+6.25%/★, 85% at 5★) + `drPrestigePct` (+5% per prestige,
  uncapped), so stars and stacked prestige massively raise the cheap zone over
  the course of the meta-game. Auto: Key Stats / Auto: Balanced pay the same
  escalated costs cheapest-first (they never buy a 3-pt band while a 1-pt stat
  is open), undo refunds exactly what each step paid, and the Train screen
  shows the live cost on every + button (gold 2-3 pts, red 4+), gold stat
  values past their soft cap, and per-stat soft caps in the tooltips.
- **v20 — stamina/gassed system, two-sided personality, honest pregame odds, QB
  vision cone, and a fix batch.**
  - **Gassed stamina loop (FieldSim).** The sprint gas tank now persists play to
    play on the roster player (`_gasV20`). Sprints cost real gas
    (`gasSprintCost`); emptying the tank makes the player **GASSED** for
    `gassedPlays` (default 5) recovery plays — moderately slower
    (`gassedSpeedMul`) — with both the recovery-play count and between-play regen
    scaling with the **stamina** stat. **Stamina IQ:** low-awareness players torch
    their burst at random moments (`gasIQDumb`/`gasDumbSprintP`); smart players
    protect a reserve unless they're the ballcarrier (`gasIQSmart`/
    `gasSmartReserve`). The broadcast pops "GASSED"/"TANK EMPTY" over the
    you-player.
  - **Two-sided personality sliders.** Every trait now has two real identities:
    each side raises the MAX-LEVEL ceiling of its own stats (+10%/pt) AND carries
    its own drawback — injury risk, boom/bust variance, coach clashes, stamina
    burn, or slower starts — aggregated into `player.personaFxV20` and wired into
    the game (perf baseline, variance, injury rolls, FieldSim gas). Two new
    Mental-branch prestige nodes modify the system: **Sports Psychologist**
    (softens drawbacks 15%/lvl) and **Identity Coach** (+2 slider points).
  - **Roll-result popups.** Every wheel roll (pregame game plans and story
    decisions) now pops a card naming what was rolled, which personality trait
    tipped the wheel, and its concrete effects.
  - **Next-game boost = real stats.** The old "+N perf" next-game boost is now
    **+N% to ALL attributes for that game**, applied inside the sim's attribute
    accessor and allowed to exceed the player's normal caps.
  - **Honest pregame.** The pregame now shows a **% win chance** calibrated
    against actual `__simGameV2` win rates (`window.__gameOddsV20`), both team
    OVRs on the sim's own per-level scale (no more 17-vs-43 scale mixing), and a
    unit-by-unit composition summary of how the game is likely to play out.
  - **QB vision cone.** During the dropback the sim emits `look` events and the
    broadcast draws a cone from the QB to his current read — green when the
    receiver is open, red when covered — swinging as he cycles reads.
  - **National board thresholds.** The stat-leaders screen shows which national
    rank tiers (top #18 / #1.8k / #18k / …) map to which promotion odds, with
    your current rank highlighted.
  - **Fixes.** Dock "Back" buttons no longer reference the unexported state
    global (they threw and appeared dead); the opponent's jersey palette can
    never collide with your team's; the scouting/game-plan overlay is compacted
    to fit one screen with the plan deck scrolling internally.
- **Speed-vs-power tackle physics + realism pass (v19).**
  - **Physics-based collisions.** A tackle now launches from ~2 sprite-lengths out
    (`tackleLaunchDist`), the defender GRABS the carrier on contact
    (`tackleGrabDist`), and the outcome is decided by a head-to-head of **speed AND
    strength/tackling**: a carrier who wins both runs *through* the tackler and
    flings him backward along the carrier's line of motion (broken tackle); a
    defender who wins drives the carrier back and can level him; an even hit drops
    both where they meet. Nobody freezes on contact — a won collision **drags the
    pile forward** for real forward progress and a lost one flings the carrier back,
    both decaying to a stop across the post-whistle coast. Tunables:
    `tackleLaunchDist`, `tackleGrabDist`. (`node scripts/tacklecheck.mjs`: ~71%
    solo, ~11% big hit, ~6% broken.)
  - **Real penalties.** The single generic flag is replaced by typed fouls (False
    Start, Holding, OPI, Delay, Offside, Encroachment, Defensive Holding, DPI,
    Face Mask, …) with correct consequences — offensive fouls replay the down,
    defensive holding/PI/face-mask are automatic first downs, DPI is a spot foul —
    each naming the actual player, with undisciplined (low-awareness) teams drawing
    more flags. Penalties are now tracked for **both** teams.
  - **Bell-cow RB + RB2.** The offense runs a two-back set; carrier selection is
    weighted so a feature back handles the load (a lead RB now sees ~15+ carries a
    game instead of splitting evenly with the QB), and carries/receptions are
    **counted**, not derived from yardage.
  - **Level-scaled kicking.** FG range, kick accuracy, punt distance, and PAT
    reliability all scale with league level — pee-wee teams shank chip shots, punt
    short, and go for two more often; pro legs hit from distance.
  - **Special-teams chaos.** Blocked FGs and punts, muffed punts, punt- and
    kickoff-return touchdowns, and onside kicks (when a team scores but is still
    trailing late) now occur.
  - **Timeouts.** Each team gets 3 per half; the trailing team burns them late to
    stop the clock, shown in the play log.
  - **Honest matchup label.** The pregame Top-Talent header reflects the real
    team-OVR spread (Heavy Favorite → Toss-Up → Heavy Underdog) instead of a
    player-level threshold.
  - **Symmetric team stats.** The opponent box now carries third-down conversions,
    time of possession, penalties, and sacks — the full telecast line.
  - **Result-matched commentary.** Your-player run/catch flavor is bucketed by the
    actual yardage (stuffed / short / chunk / breakaway) instead of a random line.
  - **Correct down & distance.** The play payload carries the **pre-snap** down and
    distance, so the scoreboard and the renderer's coverage shell read the right
    situation (was showing the post-play down).
  - **Unique names.** Generated rosters are de-duplicated within a matchup.
- **Tackle stat-credit truth (v18.1).** Your player was racking up tackles he
  didn't make. Four dishonest credit paths are gone:
  - Being within ~4.4 yards of the pile at the whistle counted as an "assist"
    (and an assist counts as a tackle). You're now only "in on the stop" when
    the tackle is genuinely gang-assisted **and** you're one of the supporting
    wrappers (the same 16px radius the gang roll uses). Out-of-bounds finishes
    credit no assist at all.
  - Run plays with no sim-named tackler (formula fallback / promoted gash runs)
    gave you the tackle on a 50% coin flip — removed; no truth, no credit.
  - Sacks credited you via an independent 40–42% roll even when the play text
    named a teammate — credit now follows the named sacker.
  - Clock-safety downs credited a hard-coded actor slot (`def4`) instead of the
    nearest defender.
  - Net effect for an LB: ~14 → ~7.5 tackles/game, now matching what the sim
    actually attributes. Dev: `node scripts/creditcheck.mjs` asserts credited
    tackles never exceed sim truth + sacks.
- **UI + character overhaul (v16.6).**
  - **Readable scoreboard.** The live scoreboard was a vertical column that clipped
    the score under the logo/name and let the QTR number dominate. It's now a row
    with the two **scores as the big numbers flanking the clock** — score · CLOCK ·
    score — so the score reads at a glance.
  - **Real routes in playback.** FieldSim receivers used to run straight lines (even
    the target). Every receiver now runs an **actual concept-based route** (go/post/
    out/dig/slant/curl/corner/screen…), the throw goes to the target's break, and
    plays look distinct snap to snap.
  - **Pregame overalls fixed.** The pregame "Top Talent" screen fell back to generic
    "Team Captain" placeholders because the roster generator used a different state
    accessor and never populated. It now generates + persists real players, so both
    teams show real names and ratings.
  - **8 personality sliders (replaces archetypes).** Character creation is now 8
    trait sliders — Aggression, Football IQ, Composure (EQ), Long-Term Focus, Work
    Ethic, Loyalty, Confidence, Coachability — each 0–10, neutral 5, with **10
    shift-points** (sum of moves from neutral ≤ 10, capped so you can't max one).
    Some give a clearly-shown flat **starting-attribute boost** (aggressive/physical
    builds read higher); high aggression/brashness raises **clash risk → lower coach
    trust & snap share**; IQ/EQ/coachability/loyalty lower it. Stored on
    `player.personaV13`.
  - **Persona boosts are percentage-capped (v16.7).** Each trait's starting-attribute
    boost is now a share of a **±30% tilt** off the attribute's prestige-inclusive
    base — so a stat can be at most **30% higher** than its built base, and the
    prestige menu (which raises the base) raises the absolute boost while the ceiling
    stays 30%. The story-arc **wheel spins noticeably faster** now, too.
  - **Story arcs are rolled, not chosen.** When a story-arc / decision popup appears,
    each option gets a **personality-weighted %** and a wheel-of-fortune arrow sweeps
    and lands on one. Aggressive/brash builds rarely land on the safe option (but it
    keeps a floor, so it's still possible). Reads `player.personaV13`.
- **Render-path fix (v16.4) — the agent-sim changes now actually reach the screen.**
  Most run/pass plays are meant to render from the FieldSim agent log (frames +
  events), but a queue bug meant only **~21%** of them did — the other ~4 in 5
  silently fell back to the older `buildPlayScript` choreographer, so the new
  tackle physics, jukes, stiff-arm, stagger, short sprint, swim moves and pancakes
  were invisible on most plays. Two fixes:
  - `dropSimLog()` popped the wrong end of the queue (`shift()` removed the oldest
    log instead of `pop()`-ing the play's own just-pushed one), desyncing everything.
  - `takeLog()` only matched the queue **head**, so any play that doesn't push a log
    (sacks, scrambles, fumbles, scores) permanently desynced the FIFO. It now
    **searches** the queue for a matching `(kind, off, yards)` log, order-independent.
  - Result: **~87–90%** of plays now render from the agent sim. Diagnose with
    `node scripts/renderpathcheck.mjs`. (Render-only — resolved outcomes unchanged.)
- **Short sprint, line-play overhaul & pre-snap preview (v16.3).**
  - **Short sprint.** The ballcarrier and his single nearest pursuer can kick a
    ~0.5s burst worth up to **+20%** speed (its length extended by awareness +
    acceleration + stamina, then a recovery). It fires for evasion, on a broken
    tackle, and to run down a breakaway. A small **draining stamina bar** appears
    over the player's head only while the burst is active. Tunable: `RIB_TUNE.sprintBoost`.
  - **Line-play overhaul.** An O-lineman who wins a real **mismatch pancakes** his
    man — the rusher is stunned flat for a few seconds and the blocker peels off to
    double-team another rusher. The two widest D-linemen are **edge rushers (DEs)**:
    they bend the corner to shape the pocket and can beat the tackle with a fast
    **SWIM MOVE** (finesse: quickness + agility). More momentum in the trench.
  - **Pre-snap play preview (your team only).** During the pre-snap beat the field
    overlays the play's **design — never the outcome** — then clears at the snap.
    Your offense: every route, OL block direction, the RB's aim. Your defense: the
    coverage read (man vs zone), safety deep zones, LB box.
- **Tackling & contact physics (v16.2).** Most run/pass plays render from the
  FieldSim agent log, whose carry loop used to swarm every defender onto the
  ballcarrier (so almost every stop read as a group effort) and resolved contact
  as a plain proximity check. The carry phase now models real tackling:
  - **Momentum + strength collisions.** Weight (by position) × velocity gives each
    player's momentum; a contact resolves to a **whiff** (shifty back dodges in
    space), a **truck / broken tackle** (carrier power wins — the defender is
    knocked down and stays down), a **big-stick or both-fall** collision (violent
    even momentum), or a clean **wrap**. Clear stat gaps show: a strong/fast back
    trucks a weak defender, a great tackler wraps up cleanly.
  - **Solo by default (~70/30).** Only one defender commits to a tackle at a time;
    others hold off the pile. A stop is credited as an assisted/gang tackle only
    when a second defender is genuinely in on it — landing near the NFL ~70% solo
    / ~30% assisted split instead of a pile on every play.
  - **More evasion.** Elusive backs (agility/quickness) bend their path *away* from
    the nearest closing defender to avoid the wrap, and force more missed tackles,
    jukes/spins, and broken tackles — all rendered in the broadcast view
    (JUKE!/MISSED TACKLE!/BROKEN! + dive/grab/pull-down poses).
  - **Stat gaps swing every contact, capped below 100%.** The juke and truck rolls
    scale hard with the attribute mismatch so a huge discrepancy dynamically shows:
    a one-on-one juke runs ~26% for an even matchup, ~62% for a star vs a weak
    defender, ~80% (the ceiling) for a generational back vs a scrub, and floors near
    ~2% for a weak back vs an elite defender. Trucks scale the same way on strength
    + momentum.
  - **Stiff-arm** — the carrier's strength wards the tackler off at the point of
    attack (works even at low speed, unlike a truck); the defender is shoved off and
    stumbles, the runner slows a touch and keeps going (STIFF ARM!).
  - **Glancing contact matters.** A defender who makes contact but can't wrap up
    grazes the carrier — a **stagger** that costs the runner a step (bleeds speed,
    easier to bring down next hit) and stumbles the defender, instead of a binary
    miss-or-tackle (SHAKES IT OFF!).
  - Dev: `node scripts/tacklecheck.mjs` reports the solo/gang split and
    whiff/truck/stiff-arm/stagger/big-hit rates (current tune: ~72% solo, ~13% whiff,
    ~5% broken, ~5% stiff-arm, ~8% stagger); `node scripts/jukecheck.mjs` shows how
    stat gaps drive juke rates across superstar/scrub matchups.
- **Emergent game engine (v16).** Live games are no longer scripted outcome-first
  (the old engine pre-decided the final score, shuffled a list of predetermined
  drive outcomes, and backfilled plays to match). Every drive is now resolved
  play-by-play — FieldSim agents when available — and the final score *emerges*:
  - **Real game clock.** Quarters count down (default 9 min, `RIB_TUNE.qtrMinutes`),
    the clock stops on incompletions/out-of-bounds/scores, trailing teams go
    hurry-up late, leading teams milk it and kneel out the win. The HUD shows the
    clock next to QTR; ties go to sudden-death OT (shown as "OT").
  - **Alternating possessions + field-position continuity.** Coin toss, opening
    and second-half kickoffs, touchbacks/returns, punts with gross/return/net
    and coffin-corner downing, missed-FG spots, and turnovers at the spot of the
    pick/fumble. Drive headers announce where the ball is ("at the own 25").
  - **Situational play-calling.** Down-and-distance pass/run tendencies,
    distance-based FG probability, analytics-style 4th-down go-for-it,
    end-of-half FG steals, PATs and late-game two-point chart.
  - **Per-play sacks, scrambles, and strip-sacks** resolved from OL blocking vs
    DL rush ratings (they were previously only a pre-rolled box-score number).
  - **League-relative attributes.** Play resolvers see attributes normalized
    around the league average, so a high-school game plays like real football
    and outcomes ride on *relative* roster strength.
  - **The score you watch is the score that counts.** The emergent live result
    is written back to the week's record/standings (previously the standings
    used a separate pre-rolled score that could disagree with the watched game).
  - **Situational play-calling & concepts (v16.1).** Each snap picks a concept
    from the game state — deep shot, screen, quick game, fade at the goal line,
    draw on 3rd-and-long, power in short yardage, sweep to the edge. The concept
    is shown in the play-by-play ("Deep shot — …", "Screen — …") *and* fed to the
    resolver, so a shot actually throws deep (fewer completions, more air yards)
    and a screen stays short and YAC-heavy.
  - **Realistic yardage distributions (v16.1).** The agent sim compressed runs
    into a 0-5 yard spike; runs now carry a real shape — ~7% stuffed behind the
    line (backfield penetration driven by the DL-vs-OL trench mismatch), a fat
    6-24 yard middle, and the occasional breakaway (carrier burst/speed vs the
    front seven). Completed passes split into **air yards vs YAC**, tracked and
    shown in the live team-stats box.
  - Dev: `window.__simGameV2(perf, pos)` runs a full game headless;
    `node scripts/simcheck.mjs` batch-runs 60 games and prints distributions
    (current tune: ~22-17 avg score, run mean ~3.9 with a full tail, pass
    mean ~12 air+YAC).
- **Player gear overlay removed (temporarily).** A vector "appearance" layer used
  to draw a second procedural player (helmet shell, facemask, visor, sleeves,
  gloves, neck roll, back plate, towel, knee pads, high socks, …) on top of the
  baked pixel-art sprite, which read as cluttered. It is now disabled — the clean
  baked sprites stand on their own.
  - **To re-enable:** set `GEAR_OVERLAY_ENABLED = true` at the top of the
    `rib-v1520-phaser-runtime` script. All the machinery (traits, front/rear
    groups, per-frame flipping) is still present and untouched; consider trimming
    `traitsFor()` / `__RIB20_applyAppearance()` to just the accessories you want
    before turning it back on so it complements the sprite instead of doubling it.
    Per-position body sizing is not gear and stays on either way.
- **Field art un-mirrored.** The baked field texture is stored horizontally
  flipped (TOUCHDOWN/END ZONE and every yard number read backwards); it is now
  drawn with `setFlipX(true)` so text and numbers read correctly. The turf is
  left/right symmetric, so hash marks and yard lines stay aligned to play.
- **Running directions** verified against the fixed field: the offense always
  attacks the top of the screen (rear-facing sprites), the defense faces down,
  and sprite facing tracks screen-space motion via `faceMarker`.
- **Tackle motion + whiff.** The closing defender now commits a diving/wrapping
  tackle attempt (`tackleLunge` → `tackleHit` or `tackleWhiff`). He can whiff on a
  shifty, full-speed back — but committing is what brings runners down: a landed
  lunge wraps early, and even a whiff staggers the carrier so support cleans up
  (attempting a tackle increases the odds of a stop).
  - Tunables: `lungeReach`, `supportReach`, `whiffMs`, `staggerMs`.
- **Multi-tackler speed / pull-down.** More hands on a full-speed carrier kill his
  speed faster: two men drop it fast, three collapse it. Three tacklers wrestle a
  runner down in ~1s, two take longer, and a **clearly stronger** carrier drags the
  pile for extra time before going down.
  - Tunables: `gangMismatch`, `pull2Ms`, `pull3Ms`, `pileFloor`, `contactSlow`.

The provided `TACKLE` / `RUNNING GRAB` / `CATCH` sprite sheets are reference art
for these animations; the runtime currently animates the vector/baked sprites
rather than blitting the sheets directly. A drop-in loader for a 3×11 sheet
already exists: `window.__GRIDIRON_LOAD_SHEET(srcOrDataURL, "off"|"def"|"you")`.
