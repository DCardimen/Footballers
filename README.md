# RUNNING IT BACK — Life of a Player

A football career-simulation game (Phaser + canvas). The live game is
**GRIDIRON v15.21**.

## Develop

```bash
npm install
npm run dev      # Vite dev server with hot reload at http://localhost:5173
npm run build    # production build -> dist/
npm run shot     # screenshot the running game (headless) for quick validation
```

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
  - Dev: `node scripts/tacklecheck.mjs` reports the solo/gang split and
    whiff/truck/big-hit rates (current tune: ~70% solo, ~13% whiff, ~13% big hit).
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
