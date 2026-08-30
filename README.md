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

- **v65 — the art reaches the other screen a season's training is chosen on.**
  v64 put the twelve scenes on the growth wheel, which is one of *two* places a
  season's training gets picked. The other is the offseason **"Choose Your
  Training"** board — the twelve programs behind `PLAY N-GAME SEASON` — and it was
  still showing ⚖️ 💨 🏋️ 🎞️ 🎯 🦘 🫁 🔥 🧘 💥 🏃 🧊. It is rendered by the legacy
  career app, in a different scope and at a different time from the wheel, so two
  things had to move: the `.gv64-*` rules were hoisted out of the wheel overlay's
  own `<style>` (where they existed only while the wheel was open) into one
  document-level sheet, and `skillIco()`/`sart()` are exported as
  `window.RIB_SKILL_ICO`/`RIB_SKILL_ART`.

  The board has its own twelve keys, so it addresses the cells through a
  `SKILL_ALIAS` table rather than being renamed to match the wheel's theme ids.
  Each program is paired with the scene that actually **depicts** it, which is why
  two pairings read oddly next to their key names: the program keyed `lab` is the
  Recovery Lab and takes the ice-bath scene (packed as `social`), and the program
  keyed `grind` is The Grind and takes the tyre-flip scene (packed as `lab`).
  Twelve onto twelve, one each — no picture appears twice on a board that shows
  every program at once.

  Two things this turned up. A DOM icon no longer waits on `SART.ready`: a CSS
  background does not need our decode the way a canvas blit does, and gating on it
  raced the board, which can render on the same tick as page load. And the atlas
  gutter went **4% → 9%**: a CSS background addresses these cells by percentage at
  whatever DPR the device has and samples a little past the boundary, so at 4% every
  tile wore a green sliver of its neighbour's grass down its edge. The wider gutter
  doubles as the icon's hold-off from its rounded plate, so neither consumer needs
  padding of its own, and it dropped the baked sheet 392KB → 327KB. The packer also
  labels each quadrant's ink into connected components now and discards the ones
  that both touch a quadrant border and are small next to the main scene — scenes
  that overhang the 2×2 split were dragging a neighbour's grass into the crop.
  Covered by `scripts/skillartcheck.mjs`.

- **v64 — the training themes get drawn instead of typed.** Every training option
  carried an emoji: 🏋️ 💨 🎞️ 🧤 🪜 🧘 🎓 🎉 🦘 🧠 🎯 🔥. They were doing real work —
  the only thing telling two options apart at a glance — but an emoji is the
  platform's font, not the game's art. It renders differently on every device, sits
  in a different colour world from everything around it, and is a blob at the size
  the wheel draws an icon.

  Twelve isometric scenes replace them, one per theme, packed from the uploaded
  sheets by `scripts/spritekit/pack_skills.mjs`. Two things that packer has to do
  beyond slicing: the scenes do not fill their quadrants and are not centred in
  them, so each is **tight-cropped to its own ink** and then fitted to a uniform
  cell by its longest side — crop to the grid instead and every icon lands at a
  different visual weight for no reason but where the artist put it. And the flat
  navy ground is keyed at full size **before** the downscale; scaling first
  resamples it into every edge as a navy halo.

  The art reaches all four places a theme is named — the wheel face, the option
  list, the roll pop-up's header and the result card — and everything falls back to
  the emoji it replaced if the sheet never decodes.

  **On the wheel face** the scenes are drawn nearly twice the size the emoji were,
  each on its own soft shadow. A wedge is a saturated field and isometric art laid
  straight onto one disappears into it; the shadow is what lets the scene sit on
  top of the colour instead of in it.

  **The option rows got rebuilt around the art**: a 44px scene tile, then a
  two-column body with the name and the odds on one baseline (tabular figures, so
  the percentages line up down the list) and the effect and risk lines under it.

  Nine of the twelve themes are depicted squarely. **`lab`, `mentor` and `social`
  have no scene of their own in the set** and take the nearest thing it offers —
  they are the three to re-art or re-assign, and the mapping is one `ORDER` array
  in the packer.

  `wheelcheck` gains six assertions: every theme has a cell, every row shows art
  rather than the emoji fallback, each option shows its *own* scene, the wheel face
  draws them too — and, importantly, that no scene reaches the ring at 0.30R where
  the same check measures the arcs by hue, so the art cannot quietly invalidate the
  geometry test sharing its canvas.

- **v63 — the bowl closes, the crowd speaks, and the outcome is rolled once.**

  **One roll, not two.** The landed option row strobed red / neutral / green nine
  times before the result appeared. That *was* the outcome animation, back when
  there was nowhere else to play it — but v62 gave the outcome its own pop-up with
  a needle that runs across the bands, so the strobe now spoils the result twice
  over and flashes bands that never came up. The row just marks what the wheel
  landed on.

  **The north end is a bowl, not a third wall.** It was a straight band across the
  back of the end zone, butted against two sidelines that ran all the way to the
  end line — which left an open wedge of nothing at each corner and a hard
  right-angle turn where a stadium has a sweep. The sidelines stop a corner radius
  short now and the end is one continuous curve: a superellipse in (depth,
  lateral), `u = (FW − CR) + (CR + EZG)·(1 − |t|^n)^(1/n)`. Two properties earn it
  — its ends land *on* the sideline ends so the bowl closes with no seam, and its
  slope there is vertical in `t`, so it leaves the sideline running parallel to it
  and the join is tangent-continuous.

  The corner has to buy its radius from somewhere: with the bowl's back only 16
  units behind the end line, a 130-unit corner cut the diagonal so tightly the
  stand passed within a few units of the field's own corner — closer than the
  sidelines are allowed anywhere along their length, and it registered as crowd on
  the pitch. `crowdEndGap` goes 16 → 44 and the exponent 3.5 → 5, plus a hard
  guarantee: wherever the curve is laterally inside the touchlines it is forced
  behind the end line. With the shipped dials that guard never binds.

  **One crowd, one size.** Height and texture scale are the same number seen
  twice, and it was being solved *per wall* — each wall forced the strip to span it
  exactly once and took whatever height fell out. The long sidelines got tall
  stands with big spectators; the short north end got a stand a third the height
  with spectators to match. A different crowd on the same terrace, forty yards
  away. The sidelines set the size now and every other wall is given the texture
  span that matches it (`dc = stripH·seg/(HH·k)`), so the end simply uses less of
  the strip. The dev check pins `stand height / k` to one number all the way round.

  The rake also moved from per-section to per-point: a section-wide lean notches
  the skyline at every boundary the moment it starts turning, which is exactly what
  the corners make it do.

  **The stands say something.** The crowd already got louder — heat, and a roar
  that rolls along the terrace as a wave — but nobody in it ever said anything.
  Short shouts now pop out of the sections nearest the play, ride up off the
  terrace and fade. Deliberately small (a floor on the font size, because a corner
  section draws at k = 0.43 and 15·k there is six pixels of nothing), capped so
  they never compete with the field, behind a cooldown so a busy play gets a shout
  rather than a running commentary, and only ever from a stand the camera can
  actually see — sorting by field position alone handed every line to the near
  sidelines, which are the sections the perspective throws furthest out of frame.
  Anchored on the section's own mid sample rather than its bounding box, whose
  corners hang out over the turf.

  Dials: `crowdCornerR` 130, `crowdBowlN` 5, `crowdEndGap` 44, `crowdEndMin` 8,
  `crowdVoiceGapMs` 1100, `crowdVoiceMs` 1500, `crowdVoiceMin` .34,
  `crowdVoiceMinPx` 9, `crowdVoiceMaxPx` 14, `crowdVoiceMax` 4.

  `wheelcheck` also stops asserting the wrong thing about the pregame wheel. It
  used to drive an entire career all the way to a live field and fail if it did not
  get there — which fails on the career, not on the wheel: a role battle or a story
  beat can sit in the way, and a "PLAY WEEK" button walks the season on rather than
  continuing this one. What v41 actually broke was the plan being committed in
  silence, so that is what is asserted now, deterministically: resolving the wheel
  commits `chooseGamePlanV11` exactly once, with the plan the wheel landed on, and
  takes its overlay down. Reaching the field is reported instead of asserted. Six
  consecutive clean runs, each committing the plan it landed on.

  `crowdcheck` is up to 55 assertions: the north end must *curve* (its depth varies,
  its corners sit nearer the camera and further out than its back), the crowd must
  be one size everywhere, and the voices must be on camera, readable, short,
  rationed and self-clearing. The intrusion scan now covers the curved end too —
  and it round-trips its own depth inversion, because rows above the far end line
  have no depth that maps to them and the bisection there was handing back the
  touchlines from the *wrong* end of the field, reporting a stand at the top of the
  frame as sitting on the near twenty.

- **v62 — personality gets a grip, and the roll shows its work.** Two complaints
  with one cause: the wedges came out near-even however the sliders were set, and
  when a roll went badly there was one sentence of hand-waving about why.

  **The second roll is its own pop-up.** Whether a commitment *pays* was always a
  separate roll from *what* you commit to, but it resolved as a bar that quietly
  appeared with a result card under it — no moment. It now opens its own panel
  over the wheel: the three bands, a needle that sweeps and settles in the one
  that came up, then the verdict and the result. Tap-to-speed-up reaches it (the
  pop-up is a child of the armed overlay), and it is a child of `#growthV42`, so
  tearing that out still takes everything with it.

  **The ledger adds up.** Every theme weight in the file is linear in the persona
  sliders (`w = 1 + Σ c·slider`), so a trait's contribution is exactly
  `w(persona) − w(persona with that one slider back at neutral)`, and those
  contributions **sum** to the distance from neutral. `traitLedger` / `jiveFrom`
  compute them and convert each to the percentage points it moves the PAYS band,
  using the slope `bandOdds` itself uses. The rows plus the form-and-risk line
  equal the number printed on the bar — it is arithmetic, not an attribution
  story.

  **A plan is not just how bold it is.** The pregame wheel could only see
  upside/control/risk, and "Rest & Recover", "Film Marathon", "Do the Dirty Work"
  and "Disciplined Execution" all sit at about the same place on those axes — so
  they all drew the same wedge and the wheel came out 18/18/18/19 in the wild.
  `PLAN_KIND` classifies a plan by what it *asks* of the player (rest / study /
  grind / shine / system / team, matched on the name and tags the staff panel
  already rendered) and weights it with the same shape of linear trait formula the
  growth themes use — which also means the roll pop-up can show a real ledger for
  it. A plan the classifier does not recognise still resolves on boldness alone.

  **And the grip is sharper.** Wedges are the appetite raised to
  `TU("wheelPersonaPow")` (1.85) / `TU("planPersonaPow")` (1.7), so "he likes this
  a bit more" becomes an arc you can see. Measured on a fixed five-plan deck:

  | | Rest & Recover | Chase the Highlight | Dirty Work | Film | Disciplined |
  |---|---|---|---|---|---|
  | driven, hot-headed, hard-headed | **3.9%** | **67.2%** | 19.8% | 5.2% | 3.9% |
  | cerebral, coachable, patient | **36.5%** | **3.8%** | 6.3% | 22.2% | 31.3% |

  With a floor: `TU("wheelWedgeFloor")` (.035) lifts every share so sharpening can
  never shave an option down to an arc of two degrees. A character who would
  basically never do a thing still has to be able to *see* it on the wheel.

  `wheelcheck` gains six assertions on exactly that claim — the hot-head hardly
  ever rolls onto a recovery day, the cerebral kid rests far more readily, and no
  plan is sharpened into an invisible wedge — driven off `window.__PLAN_V62` with
  named plans and named personalities rather than whatever deck a live career
  happens to deal.

- **v61 — the decision wheel in dark metal.** The v50 art sheet's hardware is a
  cast gold ring with cabochon studs, a gold football boss and a matching gold
  spike. Against this app's near-black cards it read as a prize wheel bolted onto
  a broadcast UI — heavy, bright, and spending a third of the disc on rim instead
  of on the odds the wheel exists to show.

  The hardware is drawn now rather than blitted: a slim graphite ring with the
  anisotropic sweep turned metal actually has (a conic gradient, with a linear
  fallback where `createConicGradient` is missing), a key light across the upper
  left laid down *under* that sweep — over it, the broad ramp washes the specular
  lobes flat and the ring goes plastic — concentric tool marks for the turned
  finish, a machined hub, and a steel blade pointer that keeps the old flapper's
  deflection with one rotation instead of four gold sprites.

  Two things follow. The rim is a fifth the thickness, so the **face** gets the
  space back: `Rw` goes 0.74R → 0.915R and the wheel now paints 74% of its canvas
  instead of a little over half. And every bright element is a specular highlight
  on dark metal rather than a fill, so the wheel sits down into the page instead
  of glowing off it.

  The wedge **hues are untouched** — each arc *is* its option's personality
  weight, so the face is only re-lit, never recoloured. The radial ramp is pulled
  down about a stop and a half (`1.5/1.0/0.45` → `0.92/0.54/0.20` of base) so the
  colour survives as sheen on black lacquer rather than as poster paint.
  `wheelcheck` ring-samples that face by hue at 0.30R and still measures every arc
  to within 0pp of the weight that asked for it.

  The gold set is still in the sheet: `TU("wheelArtHardware")` = 1 puts it back,
  rim proportions and all. New dial `wheelBladeKick` (.38) is how far the pointer
  is pushed back by the spin.

- **v60 — the stands get a third dimension.** v59 put the crowd on screen; it was
  still a flat sheet of texture standing on edge. Five cues, all render-only, all
  on dials.

  **Rake.** A stand's back row is both higher *and further from the field* than its
  front row, so in this projection the top of the stand belongs **outboard** of its
  own base, not straight above it. The slice transform already maps the art through
  a 3-point affine; the third mapping was "(c,0) → straight up", and it is now
  "(c,0) → up and out by `crowdRake * h`". One extra term in `setTransform`, no new
  geometry, and the wall stops reading as a billboard. It leans away from the field
  only — the dev check asserts the inboard edge does not move by a single pixel, so
  the team area is untouched.

  It also fixes something that was quietly broken: the sections nearest the camera
  are where the sideline runs almost straight down the screen, and without a rake
  their box collapsed to a seven-pixel sliver that drew nothing at all. Raked, they
  have width and draw. Crowd pixels on screen roughly double.

  **Aerial perspective.** The far end of a bank of seating is a long way away and
  reads that way — down in contrast, pulled toward the colour of the sky behind it.
  Each section gets a gradient ramped between its own end depths and clipped to what
  is already drawn (`source-atop`), so it is smooth within a section and continuous
  across the joins — neighbours share their boundary sample. An end-zone wall sits
  at one depth and comes out as a flat tint, which is correct there. A touch of
  `crowdSideShade` on one bank keeps the two sides from reading as one plane.

  **Tier overhangs.** A hard line at a deck boundary says "two textures butt here".
  A shadow falling from it across the back rows of the deck below says "one deck is
  in front of the other", which is the entire reason for stacking them.

  **A front fascia and a back wall.** The strip ran straight into the turf at the
  bottom and stopped at whatever silhouette the art's back railing left at the top.
  It now has a shadowed base to stand on, and a rear wall above the top deck with
  the coping catching light — laid down *under* the crowd, so the cheer pose's arms
  and flags still break the skyline over it.

  Dials: `crowdRake` .24, `crowdHaze` .4 (`crowdHazeNear` 1.05 / `crowdHazeFar`
  .34), `crowdSideShade` .09, `crowdOverhang` .24, `crowdFascia` .12,
  `crowdBackWall` .6. `crowdcheck` gains an A/B against `crowdRake = 0` (every
  section must lean outboard, none may lean in) and one against `crowdHaze = 0`.

  **On zoom.** The play camera runs `zoomLockMin` .6 → `zoomLockMax` 2.4 around a
  ~0.9 base. Lateral spread is `1.885*k*(HALF+GAP)` against a half-frame of
  `360/zoom`, so the stands fill the edges of the frame at the base zoom, open into
  the whole bowl at .6, and leave frame entirely past about 1.2 — a tight broadcast
  shot is all turf, which is what a tight broadcast shot looks like. Nothing to fix
  there; it is the perspective doing its job.

- **v59 — the stands stop cutting people in half, and come into frame.** Three
  fixes to what the crowd actually looks like on screen.

  **Nobody sits in the stairway.** The architecture pass draws the flights *on
  top* of the finished stand (`source-atop`, so no mark can spill onto the turf),
  and the art seats spectators wherever it likes — so every flight sliced whoever
  was in its way, leaving a column of half heads down both cheeks of all twelve of
  them, worst in the packed tier where there is a fan in every seat. The stairs
  are not the problem; people sitting in the aisle is. `ribCrowdAisle()` builds
  one narrow column of bare seating by walking the tier's cell **scanline by
  scanline** and copying the emptiest stretch of that same line — the art's real
  bench pixels, from the row they belong to, so riser, seat face and shadow line
  all stay put. Per-scanline is what makes it work: a stand that never empties out
  at any single x still empties out at *some* x on every individual row. The strip
  lays that patch into every aisle on every deck before the flights are drawn.
  One patch everywhere is also what makes the flights consistent — identical
  width, identical bench, identical pitch, all the way through the stand.

  Where the aisle's outer edge meets the seating it still has to fall through
  somebody in the packed tier (there is no gap to land in), so that edge gets a
  **handrail**: a shadow line and a lit rail drawn over the two columns the cut
  lands on. The edge stops reading as a chopped spectator and starts reading as a
  fan standing at the rail.

  **One kind of stairway, not two.** The master is a stand drawn end to end and it
  *ends* on a stairwell — a diagonal flight with its own handrail at each edge of
  the cell. Tiling the cell whole therefore scattered a second, unrelated stair
  system through the stand: at the cell's rhythm rather than the flights', sliding
  sideways deck to deck with the tile offset, and mirrored into a facing pair at
  every other seam. `ribCrowdTrim()` measures those end blocks (a stairwell has no
  faces in it, so the leading and trailing face-free columns bound it exactly) and
  the strip tiles the **seating only**. Copies butt at their natural width rather
  than stretching to keep the old tile count, so nobody is widened. The trim is
  taken as the max over the tier's two poses — idle and cheer are crossfaded and
  must overlay pixel for pixel, and a trim that differed between them would slide
  the whole stand sideways every time the crowd stood up.

  **The apron comes back in.** `crowdGap` goes 112 → 56, undoing half of v58's
  widening. The apron is the one dial that decides whether the stands are on
  screen at all: lateral spread grows as `1.885*k`, so the front row sits
  `1.885*k*(HALF+GAP)` px from the centre line while the camera only ever shows
  ~400 of them. At 112 the near half of both stands was outside the frame and all
  that survived was a sliver in the top corners, which reads as a smudge, not as a
  stadium. 56 still leaves a real team area — the dev check holds it to at least
  40 world units, about five yards, enough for a bench, a coaching box and players
  standing at the boundary — and puts a proper bank of crowd down both edges of
  the frame.

  `scripts/crowdcheck.mjs` gains three assertions: skin per column inside the
  stair columns against skin per column across the seating (the aisles have to be
  empty), and that every flight sits on the same pitch.

- **v58 — the stands become a stadium.** Three things the sideline stands were
  missing, plus the room to build on them.

  **A bowl, not two walls.** The sweep is generalised from "a sideline" to a
  **wall** — a line of ground points the stand stands on — so an end-zone stand
  is the same code with the samples running across the field instead of down it.
  On an end-zone wall every sample sits at one depth, so `k` is constant and the
  k-integral mapping reduces to the linear one, which is correct there.

  Only the **far** end zone gets a wall. These stands are billboards, so "up the
  screen" means "further away"; a wall behind the *near* end line is behind the
  camera and rises out of the bottom of the frame straight over the field it is
  meant to sit behind. The camera swings ends with possession and the walls
  rebuild every snap, so both real end zones get their stands — each while it is
  the one being attacked.

  That needed **headroom**. `NSTOP`, the field's top margin inside the warp
  canvas, was 30px — invisible, and therefore fine, until something had to live
  up there. The end-zone stand projects *above* the far end line and was landing
  at negative world y, outside the camera bounds, drawing nothing. It is 340 now,
  and everything above the far end line is painted as the dark **beyond** the
  stadium rather than by stretching the field art's top row across it. The
  projection shifts down uniformly and the camera centres on `focusPt`, which
  moves with it, so framing is unchanged.

  **Double the sideline.** `crowdGap` goes 56 → 112 — about 14 yards, deep enough
  for a bench row, a coaching box in front of it and players standing at the
  boundary. This costs crowd coverage and that trade is the point.

  **Architecture.** Four identical decks stacked is a texture, not a stadium: it
  reads flat because nothing says where one tier ends and the next begins. A new
  pass draws the parts of a stand that are not crowd — the **concourse** walkway
  at every tier, the **stairways** climbing through the seating, and the
  **vomitory** tunnels opening onto each concourse. Two things make it read as
  one building: the stairways line up vertically through every deck (the crowd art
  is slid sideways deck to deck so faces do not repeat, but structure does not
  move between floors, and that unbroken line is most of the 3D read), and it is
  drawn in strip space, so the perspective sweep warps it along with everything
  else. A stairway is sized off the *tile*, which is a fixed number of people
  across, so it stays one spectator wide whether the strip is stretched down a
  sideline or across an end zone.

  Also: the stand is now laid down as **solid structure first**, with the crowd
  art on top. The master's stairwell leaves sloped transparent wedges and
  mirroring tiles puts one at every seam — on screen they were turf showing
  *through* the crowd. Concrete underneath means the art can have all the holes it
  likes.

  Four assertions in `crowdcheck` were measuring the wrong thing and are corrected
  rather than kept green: the sideline intrusion scan was including end-zone
  sections (which sit beyond an end line, where there is no field on their rows at
  all — they get their own containment test); the concourse test hunted for "the
  darkest rows" and found the transparent headroom, then the art's own dark rows,
  instead of the rows the walkways are actually drawn on; and the decay test
  raced ambient cheering, which put sections on their feet mid-measurement.

- **v57 — a crowd in the stands, and it reacts to the game.** The broadcast view
  was full-bleed turf: `warpField()` stretches the field art's outermost grass
  pixels across the margins so there is never a horizon. But the perspective
  leaves a margin that *widens* toward the far end — the playing surface narrows
  with distance while the canvas does not — and that margin is the apron outside
  the sideline. It now holds real stands.

  The uploaded sheet is six full-width bleacher strips: three density tiers
  (sparse / mid / packed) x two poses (idle / cheer, the packed cheer adding
  flags). Tier is picked from the level being played at — a high-school bleacher
  is not a sold-out pro deck.

  **A stand is a wall, not ground**, so it could not be baked into `warpField`'s
  row loop: that loop paints one depth per output row, and a wall occupies many
  rows at a single depth. It is drawn as a column sweep instead — the same trick
  from the other side. The sideline is sampled at a series of depths; each sample
  projects through `PJ` to a ground point and carries the perspective ratio `k`,
  so the stand's on-screen height there is just `crowdHeight*k`. Consecutive
  samples bound a thin quad and a three-point affine maps the matching slice of
  art onto it. Because `PJ` is a genuine projective map, the tiers stay straight
  and converge on the same vanishing point the yard lines do. Samples are spaced
  uniformly in **screen Y** (uniform in the `C(u)` integral, inverted by the same
  bisection `warpField` uses) rather than in yards — spacing by yards spends most
  of the slices on the near end, which is off the side of the frame.

  The source column advances with the **integral of `k`, not with field distance**.
  Advancing it linearly squeezes every *spectator* horizontally wherever the
  sideline foreshortens, which turned the far half of the stand into vertical
  smears. Real perspective does not distort a person: it scales them by `k` and
  packs *more* of them into the same screen length. Advancing at a rate ∝ `k`
  makes the horizontal texture scale `k²/k = k`, matching the vertical scale, so
  the art keeps its drawn proportions all the way down the sideline. Height then
  follows from the art's own aspect rather than being dialled in separately, and
  the stand gets tall enough to read by **stacking decks** — the master draws
  about five rows of seats and a stadium has many more — which adds height without
  stretching anybody. Decks stack by the **seating pitch**, not the cell height
  (the cell carries headroom for the cheer pose's arms; stacking by it puts a band
  of turf through the crowd), with a few px of overlap because the fringe erode
  leaves the back railing thin.

  Cheering is a **crossfade**, never a redraw: geometry is rebuilt only when the
  perspective is (once per snap, 1.8ms), while the crowd reacts every frame by
  moving alpha (0.008ms). Sections carry their own heat, so `fireEvent` feeding
  `crowdReact` starts a roar **at the play** and rolls it out along the sideline,
  thinning as it goes, instead of the whole stadium flipping on like a light
  switch. Only the cheer layer bobs — both cells carry the same bleachers, so
  bobbing the idle layer too would visibly wobble the concrete.

  Three things the art and the geometry forced:
  1. **Keying alpha is not enough.** A keyed pixel keeps its magenta RGB, and the
     downscale resamples colour across it, blending the matte back in as a purple
     rim. The colour has to die with the alpha. The back railing on several
     strips is also drawn in a *dark* magenta the bright key never sees and the
     erode cannot reach without eating the rail — that cast is desaturated in
     place instead.
  2. **The poses must be bottom-aligned in same-size cells.** The cheer strips are
     taller (arms and flags go up, the seats do not move); centre them and the
     whole stand visibly sinks as the crowd sits back down.
  3. **The stand has to sit above the line markers, not dodge them.** The LOS and
     first-down markers paint on the ground out to `F_BOT+lineExtend`, and a stand
     inside that reach got the blue and gold stripes drawn straight across the
     crowd. Widening the apron past `lineExtend` "fixed" it and was the wrong fix:
     ground beyond the stand's front row is *behind* the bleachers, so the stand
     should occlude those stripes. `crowdDepth` now sits just above `fieldLines`
     (and below the ground shadows under the players), which frees the apron to be
     whatever the sideline actually needs.

  The apron is now a deliberate **team area** — wide enough (~9 yards) to hold
  benches, coaches, the players not on the field and the chain crew, so that a
  later system can populate the sideline without the stands having to move.

  Render-only, like the officials: no sim actor, no stat, no event of its own.
  Guarded by `scripts/crowdcheck.mjs`, which asserts the stands recede and
  converge, that **no drawn pixel** touches the playing surface or the line
  extension (measured on pixels, not the bounding box — a diagonal band's box
  necessarily overhangs the field), that the roar arrives as a wave and decays,
  that the cheer layer moves while the bleachers do not, and that a blocked sheet
  degrades to plain grass with no page errors.

- **v56 — reaction time is driven by the stat that claims to drive it.** Three
  faults, found by reading every reaction path in the sim:
  1. **`reactMs` was dead code.** Every agent was built with
     `reactMs: max(100, 340 − (quick−50)×2.4)` — commented "quickness: first-step
     latency" — and the identifier appeared **exactly once in the file**. Nothing
     read it. Agents re-aimed instantly every tick; the only brake on a direction
     change was turn radius, which is *agility*.
  2. **The clamp ate the bottom half of the stat range.** The route-break delay was
     capped hard at 390ms, so on a 90° break every defender below the blend's ~46
     produced the *same* 390ms — awareness 10 and awareness 45 were the same
     player, a 17ms spread across 40 points. It now eases into a higher ceiling:
     461 / 427 / 372 / 181ms at stat 10 / 30 / 50 / 99.
  3. **Recognition and reaction were one blend.** Reading a break is awareness;
     redirecting once you have read it is quickness. They are scored separately
     now — `iq` (58% awareness) still drives the bad-bite chance, `rxq` (55%
     quickness) drives the delay.

  Also: the roster's quickness value is the **team average ±8**, so it came out
  69–88 for every defender on the field — a nose tackle and a corner were handed
  the same reaction. Reaction is now **position-aware** (CB 1.14 → DT 0.86), which
  is the one place position is not a detail.

  The first version of the latency **broke the defence completely** — it held the
  agent's remembered *intent* as well as its steering vector, so every tick
  re-measured against a stale heading and re-triggered, and defenders never
  escaped. Games finished **251-249** while every reaction assertion still passed.
  The scoreboard is now part of `reactioncheck`'s contract.

- **v55 — a real route tree, and receivers who actually run it.** The builder had
  **ten** shapes and a `default` that drew a straight line — and `cross`, which the
  concept layer picks for both medium *and* short calls, had **no case at all**, so
  every crosser in the game was silently run as a go. Receivers also parked on
  their final waypoint and stood dead still for the rest of the play, visible in
  the sim log as a frozen path; that is most of what "players don't follow routes"
  looked like on screen.

  A route is now three choices — one of **45 shapes** (the full tree, plus double
  moves, whips, pivots, option routes and the behind-the-line family), a **release**
  off the line that bends the stem before the break, and a **depth tier** that
  moves the break point rather than just the length. **45 × 3 × 3 = 405
  combinations**, against the previous 10. Every shape also declares a **tail** —
  what the receiver does once the route is finished: verticals keep climbing,
  curls settle back toward the ball, crossers keep working across, and nothing
  aims at a point off the field, which was pinning receivers against the paint
  where they stopped dead again.

  Measured over a real FieldSim sample: **343 distinct combinations reach the
  field across 772 receivers, all 45 shapes get called, and 99.5% of 2,040
  waypoints are hit — in sequence, none out of order.** Guarded by
  `scripts/routecheck.mjs`.

- **v54 — injuries that actually cost you games, scaled by who you play.** Games
  were never missed, and the reason was not one bug but **five layers of
  suppression stacked on each other** — measured over full seasons the `injured`
  flag never fired once:
  1. `et()`'s per-game chance was `(12 − injuryResist×0.25)%` clamped to a **0.5%
     floor**, which every developed player sits on;
  2. the week plan's own rate (the "1.2% injury" on the plan cards) was rolled as
     a **second independent gate** on top of it — a relative risk treated as an
     absolute probability;
  3. the single-week resolver computed the model's answer and then **discarded
     it**, rolling its own ~1–5% instead;
  4. `rollInjuryV18` returned `null` for **65%** of the injuries that survived;
  5. the age band **cancelled 82%** of what was left outright.
  And `materializeInjuryV18` was only ever called from the sim-season path, so a
  normally-played week never got a severity or a `weeksRemaining` at all —
  `mustSitV18` could never become true.

  Chance now keys on **who you are playing**: the gap between your rating and the
  opponent's, so 20–30 points of class above them roughly halves the risk and
  being outmatched raises it. Fatigue, `injuryResist`, perks, prestige and
  personality all still multiply in. Severity is split so an **average season
  misses one or two games** (~1.35 measured), while **losing a whole season stays
  under 1%**. Being worn down now skews the roll toward *worse* injuries — it was
  inverted, and had been making tired players safer. Same release: health is worth
  a flat swing either way — **+5% when fresh and clean, −10% when worn or
  injured** — rather than only ever a penalty. Guarded by
  `scripts/availabilitycheck.mjs`.

- **v53 — the post-game card leads with the season.** After a whistle the card
  opened with the game grade and the single-game box, and the season line sat at
  the bottom, below the fold on a phone. What a player wants first is where the
  year now stands, so **SEASON TOTALS** moved to the top, directly under the
  result, with the grade and this-game box as detail underneath. The green
  "+ from this game" deltas still ride on the season row, so leading with the
  total loses nothing. The season line now also states **how many games it covers
  and the record** — a stat line means little without knowing whether it is one
  game or eight. That record has to be built from the live scoreboard rather than
  `weekResults`: the week is only finalised *after* the card is dismissed, so
  reading `wr.won` showed a win as 0–1 on its own card. Guarded by
  `scripts/postgamecheck.mjs`, which plays two live weeks and checks the game is
  counted once, not twice.

- **v52 — the stat leaders and the national rank now describe the same world.**
  A player the **leaders board** had inside the national top 20 mid-season was
  told he was **#200k of 420k** by the rank card on the very same screen. Two
  separate faults:
  1. **Three population tables for one population.** `A[].slots` on the level
     table, a hardcoded array inside `sn()`, and `Ii` for the leaders board. `Ii`
     turned out to be `A[].slots/9` at nearly every level — the board was right —
     while `sn()`'s copy had drifted badly: Middle School quoted **420,000**
     against the table's **600,000**, JV 95k against 280k, Varsity 42k against
     110k. Everything now derives from `A[].slots`, with the positional pool
     exactly that split nine ways.
  2. **Standing ignored production.** `sn()` ranked on the overall rating alone,
     through a logistic centred on `A[level].need-8` — which is almost exactly
     where a developing player sits mid-season, because OVR only reaches `need` at
     the *end* of a level. It parked nearly everyone at the 50th percentile
     regardless of what they were doing on the field. Standing is now anchored on
     the leaders board's own answer (`kr`, the same function that ranks the board)
     with the rating scaling it, and the work is done in **rank space, not
     percentile space** — out in the tail a tenth of a percentile is the
     difference between #18 and #4,000, so a percentile blend could never have
     held the two screens together. With no stat line yet, the rating still
     carries it alone. Guarded by `scripts/rankcheck.mjs`.

- **v51 — the wheel is where the player actually is.** v50 put the spin wheel on
  the season/midseason growth decision only, so the surface met *every week* —
  the **pregame plan** — still showed nothing at all: `v41 SINGLE PREGAME` deleted
  the plan panel and auto-picked the scout's pick in silence, with no wheel, no
  odds and nothing to speed through. The plan is now **rolled on the same wheel**,
  weighted by the same personality appetite the story wheel uses (so the two
  surfaces can never disagree about who the kid is) and resolved by the same fit
  roll, with the band granting a real single-game effect through the existing
  growth pipeline. The deck is read off the panel the game already rendered — id,
  icon, colour and the UPSIDE / CONTROL / RISK bars — so this stays a presentation
  layer that invents no plans and changes no plan maths, and it falls straight
  back to v41's silent auto-pick if the deck can't be parsed. The staff can offer
  ten plans and ten wedges is an unreadable wheel, so his instincts shortlist the
  six best-fitting (always keeping the scout's pick) and the panel **says** what
  was cut. Same release: the wheel renderer is split into a shared `spinWheel`
  that knows about wedges and nothing about where the options came from — both
  callers feed it one shape. Guarded by `scripts/wheelcheck.mjs`, which now drives
  a real week and asserts the wheel is on screen pregame, shortlists readably,
  keeps the scout pick, speeds up on tap, and **still starts the match**.

- **v50 — SPEED THROUGH + a real SPIN WHEEL + the FIT ROLL as its own system.**
  Three changes to the decision layer, which rolls itself and used to leave the
  player nothing to do but wait. **Speed through:** every rolling decision now
  schedules its delays through `window.__DECIDE_SPEED_V50.wait()`, so a tap
  anywhere multiplies the *remainder* of the animation by `TU("decideSpeed", 5)`
  — it lands mid-spin, not at the next stage, and one shared rate covers both the
  v16.6 story/pregame sweep and the growth wheel. **Spin wheel:** the growth
  decision is now an actual canvas wheel where **each option's wedge arc is its
  personality weight**, so the odds are the picture — a relentless, brash kid
  sees a fat "Underground 7-on-7s" wedge and a sliver of "Mobility Mornings",
  and a cerebral one sees the same wheel inverted. The maths did not change
  (`genOptions` always weighted on persona); it is finally visible, and it still
  lands on the seeded pick so careers replay identically. **Fit roll:** the
  +/neutral/− outcome is split out into its own roll (`jiveOf` / `bandOdds`),
  shown as its own panel *before* the result. Left alone it is a near-even
  three-way split — a character with no strong opinions is at the mercy of the
  dice — but **jive**, how far the landed theme sits from what a neutral
  personality would want, swings it hard: ~74% pays off at full jive, ~72%
  backfires at the opposite end. Prestige, coach trust, form, fatigue and tier
  risk survive as a bounded nudge instead of setting the odds (tier risk is now
  centred on the mean tier, which is what had been quietly pushing every roll
  negative). Also fixes a latent bug where an overlay torn out of the DOM by a
  screen change wedged `showing` true and silently swallowed every later
  decision. The wheel is drawn from its own art sheet — gold bulb rim, football
  hub, four pointer-deflection frames that settle upright as the wheel stops,
  twelve pixel-art theme icons and three wax outcome seals
  (`scripts/spritekit/pack_wheel.mjs` → `bake_wheel.mjs`,
  `window.__RIB_WHEEL_V50`) — with every element falling back to the procedural
  shape it replaces, so a sheet that never decodes still gives a complete wheel.
  The wedge under the pointer **pops**: its icon grows and rides outward, so you
  feel the pointer tick across the wheel instead of just watching it turn. Each
  theme carries one **deep jewel base**, and every tint and shade on the face is
  derived from it — a radial ramp lit near the hub and falling to near-black at
  the rim, a vignette, and a sheen clipped to the outer half — so the wheel reads
  as a dished, lacquered surface rather than a pie chart, and nothing can drift
  out of key. The live wedge burns brighter instead of getting a white wash, and
  the others dim by **darkening** rather than fading toward the page, so a landed
  wheel is one lit wedge on a dark field. Dials:
  `growth_jive` in Settings, `TU("decideSpeed")`, `TU("wheelIconPop")`. Guarded
  by `scripts/wheelcheck.mjs`.

- **v49 — REAL REFEREE ART.** The officiating crew was the *player* atlas
  recolored white with stripes painted on per pixel (`ribZebra`) and a drawn
  ellipse for a cap. It now runs on its own hand-drawn officials sheet
  (`art/source/referee crew pixel art.png` → `public/rib_refs_v49.png`, baked as
  `window.__RIB_REFS_V49`): five screen directions of eight-frame run cycles, a
  four-frame standing weight-shift, the six-frame flag heave, the loose flag
  itself, both-arms-up for a score, the dead-ball whistle and the extended point.
  Cells are **64px** (the arms-up signal is taller than a 48 cell) but the feet
  land on the players' foot line, so a ref and a player standing together match;
  officials pack a shade shorter than players, who wear pads. The sheet skips the
  recolor pipeline entirely — officials wear one kit — so `ribRegisterTeam`
  short-circuits for the `ref` team, which also drops ~200 unused zebra canvases
  per scene (refs never block, juke, dive or catch). Same release, the crew works
  the dead ball: `setSpot` (the one hook every dead-ball path already runs
  through) pulls the nearest free official into a whistle, a converted first down
  draws the point signal, an official **plants** while signalling instead of
  sliding downfield, the flag now leaves his hand on the heave frame and tumbles
  through an arc, and a score plus a dead ball land on two different men. Banner
  `v49 REF ART` + `v45 REFEREE CREW`; built by `scripts/spritekit/pack_refs.mjs`
  → `bake_refs.mjs`; guarded by `scripts/refcheck.mjs`.

- **v48 — DAILY CHALLENGE + server-replay anti-cheat + offline fonts.** A
  once-a-day Score Attack variant on a **deterministic seeded engine**: everyone
  worldwide gets the same UTC-day seed, plays 5 rounds (Steady vs Glory), one
  attempt per day. Because it's deterministic, the daily board is **cheat-proof**
  — the client submits only `(daySeed, choices)` and the server re-runs the exact
  engine to compute the score (`supabase/functions/verify-daily/`, mirrored by
  `scripts/replay.mjs`). The engine has one canonical copy
  (`scripts/daily-engine.mjs`) mirrored inline in `index.html` and in the Edge
  Function; `scripts/dailycheck.mjs` enforces byte-parity across a 160-case
  matrix. Adds a `daily` leaderboard board/tab (banner `v48 DAILY CHALLENGE`;
  router `o.view==="daily"` → `window.__dailyRender`). Same release: **fonts are
  now self-hosted** (`public/fonts/`) instead of the Google-Fonts CDN, so the app
  works fully offline (store-ready). Guarded by `scripts/dailycheck.mjs` +
  `scripts/replay.mjs`.
- **v47 — LEADERBOARDS.** Online high-score boards for Score Attack behind a
  **pluggable backend** — the whole UI and submit flow run offline against a local
  mock board today and flip to a real server by config. Isolated appended block
  (banner `v47 LEADERBOARDS`): `window.__lb.submit/top`, the board screen
  (`window.__lbRender`, router `o.view==="leaderboard"`, reached from the menu +
  the Score Attack over-screen), with Global / Weekly / Per-position tabs. Score
  Attack auto-submits each run via `persistBest()`. Set `window.__LB_CONFIG`
  (Supabase URL + anon key) to go online; `window.__LB_IDENTITY` is the seam for
  Game Center / Play Games sign-in. Server-side anti-cheat lives in
  `supabase/schema.sql` (`submit_score` RPC: range/position/name/rate-limit
  checks). Setup runbook: [`docs/LEADERBOARDS.md`](docs/LEADERBOARDS.md). Guarded
  by `scripts/lbcheck.mjs`.
- **v46 — SCORE ATTACK + commercial packaging.** A single-player high-score mode
  ("The Gauntlet"): pick a position, play endless one-game rounds, choose Steady
  vs Go-for-glory each round, beat a rising score bar to survive, and chase a
  persistent best. It's a self-contained appended `<script>` block (banner
  `v46 SCORE ATTACK`) driven entirely by the exported engine
  (`window.__simGameV2`) — it never touches career state. Reached from the menu
  (`go('highscore')` → router branch → `window.__hsRender(o)`); best score/streak
  persist to the save (`o.highScore` / `o.highStreak`). Scoring is calibrated in
  `scripts/hsprobe.mjs` and behavior is guarded by `scripts/hscheck.mjs`. Same
  release: an **IP-safety pass** swapped every real NFL nickname in `er`
  (player's team) and `Dt()` (opponents) for fictional names (real cities kept),
  plus **installable-app packaging** — `public/manifest.webmanifest`, a maskable
  icon set (`scripts/genicons.mjs` from `public/icon.svg`), head install meta, and
  a `capacitor.config.json` for wrapping to iOS/Android. See
  [`docs/COMMERCIAL.md`](docs/COMMERCIAL.md) for the store roadmap.
- **v45 — REFEREE CREW.** A seven-official crew now works every live play in the
  broadcast view (`LiveField` scene: `spawnRefs` / `updateRefs` / `placeRef` +
  the `refThrowFlag` / `refSignalTD` helpers, all after `resolveOverlaps`). The
  officials are a render-only layer — not sim actors, no stats, never in
  `this.markers` — kept in `this.refs`. They wear a dedicated **`ref` recolor
  team** (white kit, then `ribZebra` paints the striped shirt over the chest
  band; `ribRegisterTeam` gained an optional `deco` hook that persists across the
  v22-overlay reload). Each frame every official eases toward a role-based mark
  keyed on the ball-carrier (referee in the offensive backfield, umpire off the
  middle, two wings on the LOS, two deep on the numbers, back judge deepest),
  **runs when the players run at ~85% of ball speed** (`TU("refSpeedFrac")`), and
  is repelled out of any nearby body so he stays off the pile. A `flag` event now
  pulls the nearest official into a flag-heave animation (falling back to the old
  dropped flag only before the atlas decodes), and a score raises the nearest
  official's arms via `celebrate()`. `refcheck.mjs` verifies the crew.
- **v44.1 — EMBLEM DELIVERY + LIVE CREATOR PREVIEW.** The emblem sheet is now
  **baked into `index.html`** as `window.__RIB_LOGOS_V44` (the v22-atlas
  pattern) — v44 loaded it from `/rib_logos_v44.png`, which 404s on the GitHub
  Pages subpath and `file://`, so no logos appeared outside vite dev. One shared
  injected CSS rule (`.emblem-v44`) carries the multi-MB URL; per-element styles
  are %-based sprite cells (`background-size:1000% 900%`), so the same emblem
  call scales cleanly from a 20px chip to a 100px crest and creator tiles stay
  inside their buttons at every viewport. The Team Creator gained a **live
  identity preview** card (jersey in the selected palette + emblem + palette
  swatches) that re-renders on every palette pick, emblem pick, and team-name
  keystroke (typing "Wolves" pulls up the wolf until you hand-pick otherwise),
  and the pregame Top Talent Matchup screen now shows both teams' emblems.
  `emblemcheck.mjs` grew into a full surface audit: baked delivery, tile/chip/
  crest geometry and containment at 520px and 320px, preview reactivity, and
  the ✓-marked matched palette. `pack_logos.mjs` re-bakes the data URL whenever
  the sheet is rebuilt.

- **v44 — TEAM EMBLEMS.** The three uploaded logo sheets (animals / warriors /
  concepts) are packed into `public/rib_logos_v44.png` (90 emblems, built by
  `scripts/spritekit/pack_logos.mjs`) and wired through the whole identity
  pipeline. Every team auto-matches its emblem by name — Wolves take the field
  under the wolf, Storm under the thundercloud, Chargers under the bolt — with a
  deterministic per-name fallback for nicknames no emblem covers. Every emblem
  carries a matched uniform palette (13 new palettes were added, `TEAM_PALETTES`
  40 → 53, for combos the original set didn't have), so team colors follow the
  crest by default: your team's kit auto-matches its emblem unless you've saved
  an explicit look, and `ribSyncOpp` now dresses the opponent in their emblem's
  palette (the v20 distinguishability walk still prevents kit clashes). The live
  scoreboard chips show both teams' emblems, and the HOME team's crest (home =
  even season week) is composited onto the flat field art at the 50
  (`__setFieldLogoV44`, dials: `TU("fieldLogoSize"/"fieldLogoAlpha")`), riding
  the v27 `warpField()` perspective for free. The Team Creator now shows the 90
  real emblems; picking one selects and ✓-marks its matched palette (still
  overridable), and the uniform preview wears the real crest. Guarded by
  `scripts/emblemcheck.mjs`.

- **v42 — Growth Decisions.** Championship-moment prompts and story arcs are
  gone; in their place, ONE system: an auto-rolled, personality-weighted
  commitment wheel at season start (Train Harder with a fatigue tax, Live in
  the Film Room, Every Optional Session, Speed Camp, Run the Social Scene,
  Keep It Balanced) plus 2-3 seeded midseason decisions. Outcomes grant
  +-3..10 on 3-5 position-aware stats lasting 5 games, a season, or multiple
  seasons by severity - best rolls mint small permanents (+1..3). Prestige
  stretches positive durations and shrinks negatives; repeat commitments form
  habits and bad rolls set up redemption bumps. Effects compose into the same
  `_tempStatBuffsV25` array the sim consumes (the pregame panel shows exactly
  what counts), decrement only on played games, and surface as hub chips with
  games-remaining. Settings gains three dials: midseason frequency, outcome
  luck bias, and game-day debuff softening. `scripts/growthcheck.mjs` is the
  entertainment probe (outcome mix 66% positive, durations 50/31/15/5 across
  5-game/season/multi-season/permanent, 24 distinct outcome stories).

- **v41 — presentation + run-game + single-pregame pass.** Renderer: side-profile
  sprites never show a jersey number (any state), linemen keep theirs in the
  pre-snap stance, sprite depth ties break on a stable per-marker epsilon (no
  z-flicker through engaged bodies), and trench pairs get a wider separation
  berth (`sepRadiusLine`). FieldSim: gang piles still churn but the carry caps
  shorter (`pileDriveMax`), open-field misses spring more clean breakaways
  (`bpOpenBonus`/`bpOpenCap`), and a new sideline-economy rule (`oobWideY`,
  `oobGap`, `oobBailP`) has a strung-out runner step out of bounds when the
  angle is lost instead of cutting back into the pursuit — validated to hold
  the spreadsheets (YPC 5.64→5.59, solo/gang 72/28→73/27, whiff/broken rates
  unchanged). Pregame: post-game story decisions no longer queue, the career
  storyline never blocks starting a game, and the legacy game-plan overlay
  auto-resolves silently (same trust/personality buff-or-incident roll the
  wheel made) — the only pregame stop is the v1513 matchup screen: one manual
  selection (the game script) and one temp-stats panel, which is exactly what
  the sim consumes.

- **Main menu: 9-slice art frames + texture swatches for every button.** The
  asset runtime now exports measured sheet cells as standalone images (button
  frames, texture swatches, the gold spike divider, the chevron), so the
  career buttons use true `border-image` 9-slice frames — authentic art
  corners and rims at any size — filled with the sheet's gold-leaf / brushed
  navy swatches at uniform scale (no more mid-band crops or squashed grain).
  The CTA gets a standalone 3D chevron that launches on press with a shine
  dash, the legacy card interior is backed by the stadium swatch with gold
  spike dividers flanking the title, and the duplicate NEW CAREER button
  hides in the no-career state (PRESTIGE spans the row at capped height).
- **Main menu: stable CONTINUE CAREER + CTA redesign + aligned legacy grid.**
  Root-caused the vanishing CONTINUE button: the game's `#app` is
  `visibility:hidden` while the menu overlay is open, and `innerText` reads
  empty on hidden trees, so every sync after the first flipped `hasCareer`
  off and rebuilt the menu (replaying the entrance stagger with the CTA at
  opacity 0). Scraping now uses `textContent`, the menu builds once and
  applies targeted updates only (label/action swap included), and the CTA
  falls through to START NEW CAREER if no continue target exists. The gold
  band got a redesign — gloss overlay, heavier embossed Oswald, tighter
  tracking — and the YOUR LEGACY numbers are now pixel-aligned: number rows
  pinned to a fixed top so all six sit on identical centered baselines with
  icons as consistent left badges, immune to label wrapping.
- **Main menu interactive animations.** The menu is now alive: stadium
  floodlights flicker on independent clocks, a glistening sweep crosses the
  gold CTA (echoed faintly on the secondary row), the career card gleams once
  on mount, the football divider glints, filled stars pop in left-to-right,
  and the OVR ring fills as a live conic arc driven by the player's actual
  overall (color-ramped by quality) while the big numbers count up on first
  reveal. Buttons squash-and-bloom on press (gold for the CTA, blue for navy
  buttons) with a 150 ms route delay so the feedback lands, plus
  `:focus-visible` rings for keyboard. Rendering was reworked to build-once +
  targeted text updates so live data changes never restart animations, all
  reveals wait for the asset runtime, and everything respects
  `prefers-reduced-motion`. Also: the no-career card now reads "Begin at age
  8" (matching the real career start).
- **Main menu game-quality pass (reference fidelity).** The asset runtime now
  de-fringes sprite edges (white-matte alpha correction beside removed
  background), killing the white halos around the player, crest, football and
  HUD coin. Hero recomposed to the design reference: crest sits clear above a
  beveled-gold wordmark (`drop-shadow` extrude — `text-shadow` paints over
  background-clipped fills), the player silhouette is larger with a bottom
  fade, four CSS floodlight glows match the reference, and the hero fades into
  the content column. Career card rows now mirror the reference
  (league | position, stars | height | weight, no dangling separators in the
  no-career state), HUD/coin/pill sized up with a white counter, control
  typography retuned at every breakpoint, and a ≤344px block keeps small
  phones inside the art frames.
- **Main menu quality pass (responsive sprite crops).** The redesigned menu's
  generated-art crops are now percentage-based with aspect-locked panels, so
  the hero, career card, legacy grid, and buttons stay aligned to the sprite
  sheets at every viewport width (previously only exact 358px phones lined up;
  desktop spilled content outside the frames). Fixed the
  `#rib-main-menu-v2 button{font:inherit}` specificity bug that forced every
  menu button to the page's 16px body font, and retuned the ≥520px layout to
  the art's proportions. `menu-integration-check.mjs` now defaults to the real
  `index.html`.
- **v40 — position-aware single-star impact.** A player who sits 20 OVR above
  otherwise equal teammates now creates a position-specific matchup edge instead
  of multiplying every related play into a blowout. The compression curve is
  monotonic from +10 onward, so increasing an outlier from +10 to +20 cannot
  accidentally reduce his effective attribute advantage. Elite DL, LB, and S
  outliers earn extra responsibility in pass rush, run fits, and deep coverage
  for either team—not only the user roster—and sack credit still belongs to the
  actual rusher. The QB calibration targets a 7–8 point swing at +20. A final
  endgame fine-tune reduces the LB attribute factor from .30 to .27 and its
  extra front-seven weight from .12 to .10, while raising CB from .25 to .28.
  That targets roughly +3.5–4 points for a +20 LB and about +3 for a +20 CB.

  The table is the measured paired point-differential swing immediately before
  that final LB/CB fine-tune, versus the exact same seeded game with no star
  (90 games per position/gap, 4,050 full-game simulations). Small adjacent
  reversals are within normal score variance, not hard-coded spreads:

  | Position | +10 OVR | +20 OVR | +30 OVR | +40 OVR |
  |---|---:|---:|---:|---:|
  | QB | +4.0 | **+6.8** | +8.0 | +12.7 |
  | RB | +1.2 | +2.0 | +6.7 | +6.6 |
  | WR | +0.4 | +3.5 | +4.4 | +8.8 |
  | TE | +3.2 | +2.4 | +5.1 | +6.5 |
  | OL | +2.1 | +4.0 | +3.5 | +3.5 |
  | DL | +0.4 | +5.9 | +5.4 | +5.6 |
  | LB | +3.9 | **+4.6** | +7.0 | +9.3 |
  | CB | +1.5 | +2.6 | +3.1 | +3.2 |
  | S | +4.4 | +4.0 | +6.1 | +6.1 |

  `GAPS=10,20,30,40 npm run check:star` reproduces the ladder and reports
  paired/projected standard errors and 95% intervals. All extreme-score guards
  remain in the assertion mode.

- **v39 — equal-talent game calibration.** Full games now have a deterministic
  mirrored-roster benchmark covering wins, scoring, rushing, passing,
  interceptions, sacks, drives, shutouts, and blowout frequency. Tied play-cap
  games no longer default to the user team, normal dropbacks create more
  realistic depth and catch rates, and the run curve converts more genuinely
  sustained blocks into medium gains. In 240 exact-mirror games the sides
  finished at 50.4% wins, 23.9–24.3 points, 3.53–3.53 YPC, 62.6–62.3%
  completions, 5.52–5.55 pass YPA, 0.84–0.67 interceptions, and 2.86–2.90
  sacks; no team reached 60 points and no game approached 100.

- **v38 — whole-field acceleration.** Every movement command now requests a
  target gear instead of multiplying velocity instantly. Acceleration and burst
  control launches and restarts; agility governs speed retained through cuts and
  braking; fatigue, contact, blocking pace, pursuit, routes, sprint bursts, pile
  drive, and post-whistle coast all enter the same curve. Fallback ball carriers
  no longer bypass acceleration, and FieldSim contact now changes the velocity it
  actually uses. A deterministic low/mid/elite acceleration profile is included
  in the ten-run movement check so rating progression and balance stay measurable.

- **v37 — exact boundary planes, movement IQ, and cinematic contact.** Goal lines
  and sidelines are now zero-width planes resolved at the first interpolated
  crossing point: fast runners cannot skip a line, out-of-bounds spots land on
  the stripe, and touchdowns/pick-sixes present on the frame the carrier breaks
  the goal line. Route breaks now force rating-based coverage read/reaction
  delays; low-awareness defenders can bite on the receiver's old direction,
  while disciplined defenders stay square. Pursuit angles retain the last-man
  safeguard but can be compromised by directional cutbacks and jukes; successful
  jukes now move the runner into a real lateral lane instead of playing a cosmetic
  animation. High-point catches, interceptions, tackles, hurdles, stiff-arms, and
  broken tackles receive a single non-stacking one-second cinematic window at
  50% speed. The renderer uses field coordinates—not sprite-local coordinates—
  for goal-line presentation, and all new timing/AI values are live `TU()` dials.

- **v36 — hand-mounted football and real rotation dynamics.** Possessed balls now
  sit on a visible carrying arm instead of rendering through a player's center;
  the QB keeps the ball in one throwing hand through tuck, cock, extension, and
  release, with a short hand-to-flight blend that removes the center-point snap.
  Airborne footballs keep their nose on the velocity vector while the laces,
  seam, highlight, and profile roll around the long axis at bullet-, touch-, or
  lob-specific rates. Tips wobble, kicks and fumbles turn end-over-end, held-ball
  shadows are suppressed, and carrier-facing depth decides whether the ball sits
  just in front of or behind the torso. This is a presentation-only pass: play
  outcomes, catches, turnovers, yardage, and scoring are unchanged.

- **v33 — read, throw, and location-driven passing.** QBs now scan a
  rating-limited progression and grade each visible throwing window green,
  yellow, or red before deciding; awareness expands the scan and reduces bad
  reads without eliminating them. Releases select bullet, touch, or lob
  trajectories with slower, style-specific acceleration and arc. The replay
  lights the actual target location, and throwing, awareness, depth, pressure,
  and movement determine placement error around it. Receiver and defender
  arrival times, sideline/end-zone location, separation, and help coverage now
  drive catches, immediate tackles, and interception danger. League-specific
  arm caps prevent young QBs from making adult-distance throws. A 300-game
  calibration held completion rate at 64.3% (64.2% before), YPA at 6.7 (6.88),
  and attempts at 30.4 (31.1) while keeping scoring in the prior range.

- **v32 — calibrated simulation realism.** Opening-level games now use six-minute
  youth quarters and a run-heavy play mix, scaling toward 15-minute/pro-style
  football by league. Matchup strength is compressed to reduce noncompetitive
  results. RB workload rotates naturally; run blocking creates more 3–6 yard
  gains instead of relying on stuffs plus synthetic breakaways. Pressure now
  produces sacks, scrambles, throwaways, batted balls, stationary pressured
  throws and throws on the move—the last two carry separate accuracy and
  interception penalties mitigated by QB awareness. Ordinary fumbles, strip
  sacks and muffed punts create contested recovery scrums instead of automatic
  turnovers. Defensive holding, OPI and roughing require matching play events.
  Kick blocks and return touchdowns are substantially rarer. In a 300-game
  opening-level calibration, average margin fell 18.6→13.4, 21-point blowouts
  38%→22%, turnovers 3.35→1.73/game, stuff rate 43%→34%, third downs
  32%→36%, return TDs 0.20→0.033/game, and blocked kicks 0.26→0.08/game.

- **v31 — 15-part situational realism pass.** Team personnel now creates an
  offensive identity and matchup-specific play mix; field position changes
  risk tolerance; route depth trades completion rate for interception and
  explosive-play risk; QB awareness, mobility, protection and concept depth
  jointly determine sacks and sack loss; strip sacks and run fumbles use the
  actual players plus weather; rain, wind and snow affect passing, kicking and
  ball security; fourth-down decisions account for leverage and roster edge;
  kickoff touchbacks/returns and punt returns use league level, conditions and
  returner skill; pre-snap penalties respond more strongly to discipline and
  hurry-up stress; and snap/runoff timing now reflects the play type. The
  realism probe accepts `CHROME_PATH` and `GAME_URL` for portable headless runs.

- **v30 — the 8-item realism pass (measured with the new `scripts/realismprobe.mjs`).**
  **(1) No phantom tacklers:** an out-of-bounds/whistle finish only credits a defender
  genuinely at the ball (`tackleCreditPx`) — otherwise the tackle event names no one and
  no stat is granted. **(2) Real fatigue:** collisions now burn gas on both players
  (`gasHitCostC/D`), and GAME WEAR permanently sinks each player's tank ceiling with
  accumulated workload (`wearK`/`wearMax`, slower for high stamina) — fourth-quarter legs
  are genuinely heavier; wear resets each game. **(3) Run game lifted from 2.6 → ~4.7-5
  ypc** (team rush 50 → ~70-95): the v16.1 synthetic gash promotion is halved now that the
  sim breaks its own long runs, offset by a SAFETY ROOF (the deep safety stays a cushion
  over the ball until the runner is truly through, `safetyRoofLx`/`safetyCushion`) and a
  LAST-MAN RULE (the deepest live defender always runs the textbook angle — busted
  pursuit can't auto-house). **(4) Sacks ~2.3/team and scrambles ~1.4/team per game**
  (from 1.2/0.75) via the trench-roll bases. **(5) Tackle finishes:** both-fall 73% → ~32%
  and big hits 14% → ~7%; a tackler who clearly wins the wrap now STAYS ON HIS FEET
  (`stayUp` on the tackle event; the renderer holds his grab standing over the runner).
  **(6) Edge contain:** wide defenders hold outside leverage and funnel runs back inside
  until the carrier clears the box; low discipline abandons the assignment
  (`containWideY/LxMax/Depth/Wide`). **(7) Kicking game:** legs are `42 + level·17` yards
  and accuracy floors are realistic — FG attempts up ~2.5×, punts 13.9 → ~10 per game.
  **(8) Flag-on-the-play penalties:** the sim records what an official could have flagged
  (a blocker beaten instantly = HOLDING candidate, tight contact on an incomplete deep
  ball = DPI candidate, a wrap from dead behind = FACE MASK candidate) and the game layer
  rolls the call (`holdFlagP`/`dpiFlagP`/`fmFlagP`) — holding is now the most common flag
  and every in-play penalty names a player who did something real; the random pre-play
  block is reduced to genuine pre-snap fouls. Invariants: `creditcheck` 0 violations,
  `statcreditcheck` clean, render path 87-91%.

- **v29 — tackling realism pass: solo-first stops, pursuit IQ, overshoot, pile strength,
  held wraps, broadcast lighting.** Measured with `tacklecheck.mjs`: stops were 64%
  gang piles; they are now **67% solo** — gang odds start low (`gangOpen`/`gangBox`) and
  only climb with genuine hands on the carrier, while support holds a leverage spot a
  full stride off the tackle (`supportHold`) instead of stacking the pile (the
  choreographer fallback's pushback scrum is likewise gated to short-yardage concepts,
  `pilePushP`). Pursuit angles are now stat-driven: awareness + discipline roll one
  signed per-play angle error (`angleErrK`) — elite defenders run near-perfect intercept
  lines, low-IQ defenders overrun the spot or take a chase angle, plus a lateral
  misjudgment (`angleLatPx`) that fades as the gap closes. A defender beaten by a juke,
  spin, or cutback no longer freezes: his momentum carries him PAST the move
  (`overshootMs`) before he can gather and re-pursue. When a stop IS a group push, raw
  strength now dominates: the combined grip of every wrapper vs the carrier's power
  (`pileStrK`) swings the collision, and a carrier who wins that contest churns the pile
  forward for extra yards (`pileDriveK`). Renderer: the wrap-up GRAB is held for the
  whole drag/drive/knockback fight (`grabHoldMs`/`grabHoldK`, `wrapGrabMs`) instead of a
  150 ms blink, and an assisted stop shows the support man latching on before joining
  the pile. The LOS/first-down stripes run to the broadcast edge (`lineExtend`), and
  players get dynamic lighting — ambient falls off into the far field (`lightDepth`)
  with a soft spotlight riding the ball (`lightSpotR`/`lightAmb`), quantized so the
  canvas tint path isn't thrashed. Invariants re-verified: `creditcheck` 0 violations,
  `statcreditcheck` clean, `simcheck` distributions unchanged, render path 84–91%.

- **v28.1 — defense no longer plays a whole game as white fallback figures.**
  `ribSyncOpp` cached the opponent name globally and early-returned when it hadn't
  changed — but the live view remounts the Phaser game, wiping every texture while the
  cache survived, so the `"def"` sprite set was never re-registered and all 11 defenders
  stayed on `rib_player_fallback` until the next opponent. The skip now also requires the
  current scene to actually own the def textures (`spr_def_dn_idle` exists), otherwise it
  falls through and re-registers. Verified headlessly: all 402 expected team texture keys
  present and zero fallback-textured markers across full live drives.

- **v28 — true projective perspective + carrier-locked camera.** v27's piecewise size
  curve (linear taper, then a hard floor) was not a real perspective map, so straight
  field lines bent into a visible mid-field kink — "the far half of the field warps."
  The curve is now a genuine pinhole: lateral scale `s(u) = 1/(1 + q·(u − anchor))`
  with row spacing integrating `s²`, which is exactly a projective map — every straight
  line in the field art stays straight on screen, verified to sub-pixel residuals. The
  `fxDepth`/`fxRadius` dials keep their meaning (scale is `1 − fxDepth` at `fxRadius`
  world px past the anchor); behind the anchor the view expands like a real camera,
  capped at `PERSP_BACKMAX`. And the camera now **locks onto the ball carrier**: it
  follows him (predictive lead intact) and the zoom rides `1/perspK(carrier)`
  (`zoomLockMin/Max/Lerp` dials), so his on-screen size stays constant on every play
  while the field visibly rescales around him as he moves through the perspective.

- **v27 — consistent in-renderer perspective, billboard sprites, ball arcs, predictive
  camera.** The CSS `rotateX` canvas tilt is fully retired. One size curve `s(u)` (anchored
  at the offensive backfield each snap, `fxDepth` slider 0–0.9) now drives EVERYTHING:
  player sprite scale, x-spread, row spacing, and the field image itself — `warpField()`
  re-bakes the uploaded field art through the same curve into a canvas texture every snap
  (rows compress + narrow going north, edge pixels stretched so grass always fills the
  frame; a horizon is impossible). Numbers and players on the same yard line shrink by the
  identical ratio, and sprites stay upright — true 2.5D billboards. Plus: **throw arcs**
  (airborne ball climbs up to ~64px with a mid-flight swell, `ballAirCap`/`ballAirK`),
  **stronger smooth carrier zoom** (`zoomPlay` 1.2→1.34 + `zoomCarrier` once someone has
  the ball), and a **predictive camera** that leads along the ball's smoothed velocity
  (`camLeadMs`/`camLeadMax`) instead of a fixed offset, resetting between plays.

- **v26.4 — stronger, self-scaling field perspective.** The `perspective()` distance behind
  the tilt was hardwired at a mild `540px`, so far yard numbers barely shrank. It now
  auto-tightens as the tilt rises — `perspective(max(300, 1500 − tilt·38)px) rotateX(tilt°)`
  — so one **"Field perspective (2.5D)"** slider goes flat → dramatic and the far (north)
  numbers shrink hard into the distance. Default tilt raised to **30** (range 0–42). Power
  users can still pin the distance directly via `fxPersp` (0 = auto).

- **v26.3 — players foreshorten with depth (true 2.5D).** On the image field, players used
  to draw the same size everywhere, so the scene read flat. `PJ()` now scales player SIZE by
  depth — near (offensive-backfield / camera) players read big and downfield players shrink —
  while their feet POSITION stays orthographic so they still sit exactly on the CSS-tilted
  field image. Depth is anchored at the backfield and reset each snap (the offense is the same
  size at every line of scrimmage). New **"Player depth scale"** slider (`fxDepth`, default
  0.4) controls how aggressively far players shrink; 0 restores the old uniform size.

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
