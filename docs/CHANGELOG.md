# CHANGELOG — Running It Back / GRIDIRON

The project history, newest first. This is the "Recent changes" list that used to live in `README.md`,
moved here verbatim in v150 D (README keeps the last few releases in one paragraph each). Add a new entry
at the TOP — a `/* ===== vNN NAME ===== */` banner in the code, an entry here, and (for a new system) an
anchor line in `docs/ANCHORS.md`.

Names in older entries are the career app's pre-v149 C minified names (`q`, `ms`/`no`, `Yr`, `tt`…);
`docs/NAMES.md` translates them. "index.html" in entries before v149 A means the one-file game, now
`index.html` + `src/` (`docs/LAYOUT.md`).

<!-- new entries go here, newest first -->

- **v153 E — the kit reads, the sheet fits, the thumb fits, the unknown is black.** The profile card's player wore the
  art's own navy torso and socks whatever the team or the equipped uniform was (the borrowed recolour skipped every
  pixel darker than the navy's median) with blotchy grey-blue sleeves, on a near-black box: the card now recolours the
  figure itself — navy is the jersey (the helmet shell inside the helmet only), gold the pants and arms, each re-shaded
  around its own median so a black kit keeps its folds and a white one its creases, patterns painted before the scale —
  on a lit studio wall with a rim light. The SKILLS sheet fits one phone screen: a one-line header (the points, the OVR),
  the pricing paragraph behind HOW PRICES WORK, and PHYSICAL / BALL SKILLS / MENTAL as a segmented control, each group
  with every row on screen — the live metric, the v67 cap readout over a soft-cap bar, KEY badges, 40px steppers. Every
  career screen was measured at 400x860 and lifted to 11px type and 36px tap targets (the top bar's chips and buttons,
  the section tabs, the bar, the dock's chips, the (i) cards, chips, selects, sliders; the wordmark squeezed to "R."
  gives way to the screen's name on the ticker); the stats screen's leaders table gets its own tab instead of a
  three-row box. Locked Legacy medals are solid black silhouettes — in the book, the detail panel, the trophy case's
  next milestone and the milestone card. Looks and layout only: no gameplay number moves. `v153Echeck`.

- **v152 A.2 — the medal gets the spotlight, the book turns, the band plays on arrival.** The profile card wears the
  Legacy medal in its own framed, glowing box beside the name (tap: the trophy case). The collection book turns real
  pages: a two-faced leaf lifts, curls and falls over the spine (or swings back in), with a paper swish, a landing thump,
  a buzz and the new page's medals popping in; drag it with a finger, tap the dog-eared corners, or jump tiers and it
  riffles. The pour is rank by rank: a spark rides the bar, the bar charges near the top (a riser, the medal trembles),
  the hit stops time (flash, rays, the swap, the number rolls, RANK UP ×N, haptics), the bar drains and refills, and it
  ends on the total stamped in and a fanfare — inside a ~6.5 s budget however many ranks. The career-end pour has its
  own LEGACY XP tab (folded into THE END it played unseen), pulsing until opened. The music now asks to start at load:
  where autoplay is allowed (the native shell always) the anthem plays with no tap; where it is refused, the first tap
  starts it as before — a faked click cannot unlock sound.

- **v152 A — the Legacy Rank.** A permanent account rank above every career, from the owner's 500 medal sheets. The
  art is re-ordered, not shipped as drawn: each medal's metal is read off its pixels, every bronze and silver medal
  climbs ranks 1-200 by size, and ranks 201-500 are gold and enamel only — crowns, wings, gems, eagles and lions —
  ending on the drawn 500, Ultimate Legacy, with an endless Legacy Level past it. Legacy XP is paid every season
  (the level, the grade, titles, playoff wins, awards, the ring) and at the career's end (the stage reached, the
  seasons, the peak), multiplied by Chaos; it never resets and is never spent. Every tenth rank pays a PP bounty
  (x3 on the 50s, x10 at 500). The season report and the career-end screen pour the XP into the bar and every rank
  crossed swaps the medal (it splits and flies, the new one slams in with sparks and a clink); every tenth rank is a
  full-screen milestone, every fiftieth a new tier, and Rank 500 is a blackout, a six-shard assembly, the hit and
  the crowd, with the family's history behind it. The rank sits by the name on the menu, the top bar, career setup,
  the boards and the profile, which gains THE TROPHY CASE and THE COLLECTION BOOK (ten pages, every medal earned —
  when and by whom — and the rest as silhouettes with their cost). An old save's Hall is credited once.
  `src/31-legacy.js`, the ledger in 07, `scripts/build-legacy-medals.py`; `v152Acheck`.

- **v151 E.2 — the band is heard, not just playing.** On iOS the music could start "playing" in silence (context running, element playing, playhead moving, nothing out) until MUTE / UNMUTE suspended and resumed the context. `src/30-music.js` now listens on the master's analyser: past the file's lead-in with the fade up and a ~0 peak for 900 ms is a stall (`state().stalled`), and the next trusted tap runs the same suspend/resume + replay inside the gesture (`kick`, at most 4; `state().kicks`). Once the band has been heard the watch stands down. Test hook `RIB_MUSIC._silenceV151E2()`.

- **v151 E.1 — the first tap starts the band.** The music waited for a gesture, but it treated the first `pointerdown` as the start even when the browser refused it (iOS Safari does not count a press as activation) and then stopped listening, so it stayed silent until a Settings toggle. `src/30-music.js` now keeps the gesture listeners until the sound is really running (`audible()`: context running, deck playing), re-primes the parked deck on the next gesture, and retries on a click. Probe: a refused first play now recovers on the same tap's click.

- **v151 A — the free game is the game, and the store is a ladder.** The owner chose the hybrid model and the
  module is built for it (still switched OFF until the providers exist): Ad Free $3.99 ⊂ Pro Career $8.99 (permanent
  4×, +3 season skips a day, advanced filters) ⊂ Founder $14.99 (the founder cosmetic bundle), upgrades priced at the
  difference, a $9.99 Season Career Pass per season, cosmetic packs $1.99–$4.99 and `unlock_all_team_style`,
  expansions listed as coming soon and never sold, and rewarded ads that only buy conveniences (4× for 20 minutes, one
  more season skip, a 24-hour cosmetic trial — 4 a day). The career-payout PP double is gone, and a catalogue guard
  refuses any product that would grant PP, prestige, stats, rolls, gear or wheel spins. The progression gates are part
  of the free game and apply with the store off: 3× (and, while the store is off, 4×) on reaching the UFF, My Plays
  Only after the first finished career, season skips a day from lifetime PP (1 at 1,000, 3 at 100,000, …), and new
  sort/search/position filters on the leaders, standings and Hall of Fame. `v151Acheck`; `docs/MONETIZATION.md`.
- **v151 E — the band plays.** The owner's "Brass Anthem" (moved to `public/audio/brass_anthem.m4a`; it is Opus in an MP4
  box, 48 kHz stereo, 153.57 s) now plays on a gapless loop through the whole game — menu, career screens, live game —
  from `src/30-music.js` (`window.RIB_MUSIC`). The file does not loop by itself (160 ms of silence at the head, a ringing
  note cut at the tail), so it is STREAMED by two `<audio>` decks routed through WebAudio and crossfaded across measured
  loop points (the incoming deck starts in the file's own silent lead-in, and the fade is keyed to its real playhead) —
  nothing is decoded, so the page holds the 2.5 MB file and two small decode windows instead of 59 MB of PCM (measured
  renderer +2 MB vs +35 MB for the decoded-buffer version; Chrome's audio-service process, +78 MB on desktop, starts for
  any sound at all). Loudness is normalised in code (−18.2 → −20 dBFS RMS). It waits for a gesture, fades in, pauses with
  the tab / the app and ducks under the coach, the vault and the broadcast stingers. The other sound paths opt into one
  effects gain per audio context (`RIB_MUSIC.sfxOut(ctx)`, a one-line bannered edit in 05, 07, the coach and the vault),
  so Settings has a SOUND tab: Mute all, Music, Music volume (default 50%), Sound effects (the save's `sound`), Effects
  volume, Coach's voice — and a speaker button in the career top bar and on the main menu mutes everything.
  **No ffmpeg on the build box:** the `.mp3` fallback was made by decoding the m4a in Chromium and encoding with
  `lameenc` (pip, 128 kbps); with ffmpeg it is `ffmpeg -i public/audio/brass_anthem.m4a -b:a 128k public/audio/brass_anthem.mp3`.
  The m4a is precached best-effort after the shell; the mp3 is never precached. Menu files baked as `v151e`.
  `v151Echeck.mjs` (suite `audio`, smoke).

- **v151 D THE HIT IS WON AT THE ANGLE** — the live field's feel. *No flying in*: v146 A's walk-on gave a far-off named tackler up to 590 px/s of added pace; `approachV151D` caps his approach at 1.45x his own top speed and makes the whistle WAIT (the carrier eases into the same spot) when the play is too short, the choreographer's closer and step are capped at his legs, and FieldSim's `mv` budgets one stride a tick — named tacklers over 1.6x their speed in the last 1.2 s fell from 25% to ~5% of tackles (p90 2.0x → 1.4x), contact still at ≤9 px. *Angles*: v143's approach grade is amplified and reaches truck/stiff-arm; stop rate per commit bad line → good line 54→77% became 45→82% with the overall rate unchanged (61%); a bad-line whiff is an overrun that brakes, plants and turns. *The push*: a dominant tackler drives the carrier back before they fall (`pushV151D`, both moving together). *Recovery*: every stumble eases back to full stride with a counter-lean and a hitch. *Run cycle*: paced by the ground his own body covers (frames per sprite-px 0.106/0.111/0.118 at 1x/2x/4x — was a cap that skated past 139 px/s). *Moves*: the spin turns through the sheet's facings, the juke is plant + dip + hop + burst, the side step a shuffle. *Skin*: the recolour no longer paints skin in the team's secondary colour; each man wears one of eight natural tones (deterministic per name, `player.skinTone` to choose), on its own layer so cosmetics' kits compose. `v151Dcheck`.

- **v151 B — he looks the part.** Cosmetics and a profile, selling status and never power. `src/28-cosmetics.js`
  (`window.RIB_COSMETICS`) holds 79 items in nine categories — uniforms (incl. a historical bundle), helmets, card
  frames, touchdown celebrations, stadium themes, vault themes, profile banners, trophy shelves, recap themes — from
  five sources (free, earned by eight achievements, season-pass tiers, shop packs at the owner's prices, the Founder
  bundle). Everything is really drawn: the uniform and helmet re-dress the you-player's own textures on the live field
  (patterns, helmet shell / stripe / decal / finish; never the opponent's or his team-mates') and the menu's kit masks;
  a celebration plays on his touchdowns; a stadium theme repaints the bowl's band and washes the stands at home; a vault
  theme grades the room, tints the coins and hangs motes. New PROFILE view (menu legacy card, hub, locker) with the
  drawn character in his kit, team colours and crest, the bank, honours, titles by level, MVPs, Hall, lineage and the
  equipped frame / banner / shelf; `profile()` / `renderCard()` are what the leaderboard shows. The Locker gained a
  STYLE tab. The Team Creator's crests and palettes are gated: five free picks (shared), then 10 PP doubling, or a
  one-time `unlock_all_team_style` while monetization is on; the look a save wears is grandfathered. No sim number
  moves (seeded games identical, all equipped vs none). `docs/COSMETICS.md`; `v151Bcheck`.
- **v151 C — the season is an event.** Two competitive seasons a year (UTC Jan 1 / Jul 1, "Season 1 · Kickoff"): each has its own career boards and a 30-tier CAREER PASS (a free track of 11 cosmetics, a premium track of 30 — the $9.99 pass, sold by the commerce module, still off), 20 season challenges and 3 weekly ones, all rotated by the season id. XP comes from watching the career (games, live games, wins, seasons, titles, awards, promotions, career ends, the Daily Challenge, Score Attack) — nothing on the pass changes a snap, a stat or a payout. The leaderboards rank whole careers on thirteen boards (All-Time Career Score, Season, Weekly, Best QB / RB / WR / TE / OL / DEF, Most Championships, Craziest Career, Fastest to the League, Best Without Prestige), labelled LOCAL until a server exists; a row opens that career's profile and how its score adds up. A season's end archives its board and your finish into a trophy case that is never wiped, resets the pass and the season board, and greets the next boot with a "Season N begins" recap. Careers are never touched. Menu: SEASON PASS and LEADERBOARDS tiles; the hub carries a countdown chip. `docs/SEASONS.md`, `v151Ccheck`.
- **v150 A — the bugs the audit found.** Names can't run code: `cleanNameV150` cleans every input (name box, family
  name, Team Creator, leaderboard handle), `cleanSaveV150` cleans a save at boot, and 19 screen templates print names
  through `escHtml`. The v42 growth dials save. The declare's one-shot stakes sit beside the button. The three
  career-end screens have tabs and fit the phone. Import goes through storage and a reload so `boot()` migrates it,
  after a shape check; a corrupt save boots from a backup and says so. Every confirm, prompt and pop-up is an in-app
  dialog. `v150Acheck.mjs`.

- **v150 C — the hooks are in, the switch is still off.** The monetization hooks now live in the game code: the speed
  guard and clamp, an optional 3× flag, the career payout double, a cosmetic gate for NEW content only, a STORE tile on
  the menu, Restore Purchases in Settings, and Android back closing the store's sheets. With monetization off (the
  default) each is the identity — `v150Ccheck` proves it against a boot with the module blocked. `docs/MONETIZATION.md`
  now has a launch checklist (web build off, store builds on via injected config).

- **v150 D — the map fits on a page.** CLAUDE.md, loaded into every agent session, was 957 lines /
  ~14k words (~25k tokens) and still said the game was "one file, ~6,500 lines". It is now a one-page map
  (the layout, how to find things, the dev loop, the house rules, the gotchas that have bitten) and points
  at: `docs/ANCHORS.md` (the anchor encyclopedia, grouped by subsystem, with the `src/` file each anchor is
  in and today's names — `scripts/anchorcheck.mjs`, in `smoke`, proves every anchor still occurs where it
  says and that every path the agent docs name exists), `docs/AGENT-WORKFLOW.md` (the fast path, parallel
  workers, writing a check), this file (the README's history, moved verbatim), and `docs/CHECKS.md`, whose
  "which suite for which change" appendix is now generated from `scripts/checks.json`
  (`scripts/checks-table.mjs`) instead of a hand-kept table in CLAUDE.md. `docs/ARCHITECTURE.md`'s block
  table is keyed to the `src/` files; `scripts/README.md` covers the runner, the manifest, `lib/env.mjs`
  and `readable/`. New suite `rows` (v148); a few suites gained the checks the old table listed for them.
- **v149 C — the code reads.** The career app (`src/07-career-app.js`) and the season rosters were
  formatted (Prettier) and 406 top-level bindings renamed from minifier output to real names
  (`o` → `state`, `q` → `render`, `Yr` → `simGameV2`, `ms`/`no` → `screenGameOver`/`screenWin`…), each step
  proven not to change the program (same AST; every reference resolves to the same binding). Every
  `window.*` name is unchanged. `docs/NAMES.md` is the map; `scripts/readable/` the tools.
- **v149 B — one command runs the area.** `scripts/run-checks.mjs` runs the ~120 checks by suite from
  `scripts/checks.json`, in parallel, each job on its own dev server (`scripts/lib/serve.mjs`), and judges
  every failure against `scripts/known-failures.json` (KNOWN vs NEW). `--since <ref>` picks the suites a
  diff touches. Every check reads its URL through `scripts/lib/env.mjs` (`GAME_URL`). `docs/CHECKS.md`.
- **v149 A — the file becomes a folder.** The 9.9 MB `index.html` is a 54 KB page plus `src/NN-*.js`
  (every inline block moved byte for byte into a classic script at the same position), `src/styles/`,
  `src/vendor/phaser.min.js`, and the sheets as files in `public/`. `scripts/layoutcheck.mjs` gates it and
  can rebuild the old monolith byte-identically. `docs/LAYOUT.md`.
- **v149 E — the store is wired, and switched off.** `src/27-monetize.js` is `window.RIB_MONETIZE`: a
  provider-agnostic monetization module behind ONE master switch, `MONETIZE_ENABLED`, that ships `false` —
  while off it defines the API and does nothing else (no wrapper, no DOM, no timer, no storage write;
  `v149Echeck.mjs` proves it against a boot with the file blocked). Switched on (`?monetize=1` on a dev host
  only, or an injected `RIB_MONETIZE_CONFIG`) it gates 4× behind a `speed4` entitlement (opt-in rewarded ad:
  20 minutes; PRO: permanent; grandfathered for a device that already had a career), offers "double this
  payout" on the career-end screens, adds a STORE chip to the shell's top bar and a Store / PRO screen, and
  keeps entitlements in their own versioned, tagged localStorage key — never in the save. Providers: a
  working `mock`, and stubs for AdMob, RevenueCat (StoreKit / Play Billing) and a Stripe web path.
  `docs/MONETIZATION.md` is the model, catalogue, policy notes, in-game hook list and the owner's decisions;
  `docs/COMMERCIAL.md`'s "premium $2.99, no ads, no IAP" row is now marked open.
- **v149 D — it installs.** The built site is a PWA and the repo is ready for Capacitor. `vite build` and the Pages
  assembly finish with `scripts/lib/pwa.mjs`: the page gets `<meta name="rib-sw">` and a `sw.js` (template
  `pwa/sw.js`) precaching the page, every `src/` file as stamped, the menu and every sheet (~13 MB, by content
  revision; the film encodes stream). Navigations are network-first, so v106.1's freshness reload is unchanged and
  its `cache:'reload'` fetch passes through; offline, the last page and a career keep going. A deploy is a new
  worker that re-fetches only what moved. `src/26-platform.js` (loaded last, attaches to existing hooks, edits no
  game code) adds `ribDialog` (in-app confirm / prompt / alert / frame), `ribSave` (export to a file, import
  through a reload so the boot migrates it, and a rolling backup of the last five distinct saves — session start,
  each new season, every 10 minutes — restorable from Settings › Save File & Backups), `ribHaptics`, and the native
  shell: Android back walks the views and exits at the menu (never out of a live game or a decision), the v106.1
  probe is held, no worker, `navigator.vibrate` → Capacitor Haptics, keep-awake in a live game (Wake Lock on the
  web), a blank `window.open` becomes an in-app frame, and the save is mirrored to Preferences against an iOS
  purge. New icons are cut from the film's crest (`scripts/build-app-icons.py`, `resources/` for
  `@capacitor/assets`); `capacitor.config.json` points at `dist/` with Capacitor 8 + plugins in `package.json`
  (`npm run cap:sync|cap:android|cap:ios`). `docs/APP-STORE.md` is the release checklist (accounts, signing, sizes,
  age rating, data safety, loot boxes — earned, never sold — trademark, and the art-provenance finding:
  132 source images carry OpenAI "AI-generated" credentials, `docs/ART-PROVENANCE.md`), with `docs/PRIVACY.md` /
  `docs/TERMS.md` templates. Gate: `scripts/v149Dcheck.mjs`.

- **v148 — the lines hold to the goal line.** Near the end zone being attacked the field was squashed top to
  bottom: the row density (`VB` — canvas rows per unit of ground) was re-capped every snap so the WHOLE field
  fit the 2800-row warp canvas measured from the anchor, and the anchor rides the LOS, so the further the drive
  got the lower it went — 6.91 at the own 20, 4.72 at midfield, 2.68 on the goal line at the shipped depth.
  Widths never read it, so at the goal line the ground at the LOS was 39% as tall as it was wide: yard lines,
  hashes and numbers crowded under full-size players and the end zone came out a third of its depth, and every
  zoom (the v145 follow cams most of all, which ride up to 4.6× on exactly that stretch) blew the squash up to
  fill the frame. The density is now ONE number for the drive — the one the field has with the anchor at the
  own 25 (`rowRefYdV148`), which is the ideal isotropic density at the shipped depth — and the canvas is paid
  for by ground nobody can see: past `rowKeepYdV148` (25) yards behind the backfield the ground recedes like a
  pinhole looking the other way (rows and widths together, `L` in closed form so the near end line lands on the
  old budget row). The far end line still sits on `NSTOP`; turf, sprites, stands and the LOS / first-down
  overlays all read the same `s` and `C`. `window.__V148`; `TU("v148", 0)` restores the per-snap cap.
  `scripts/v148check.mjs` (99 assertions; 8–10 fail with the kill switch — the drive-long density, the aspect, the goal-to-5 depth, and the squashed 10-yard line wobbling across the frame).

- **v147 — the league is the UFF, and nine fixes from the phone.**
  **The UFF.** The league is the United Football Federation now — every string a player reads (the game,
  the menu, the guide, the coach) says UFF; code names keep their old spelling (`DFL_V123`,
  `dflClubV123`, `dflMvpTitle`).
  **A · The career runs to the end, and ends when you say.** In the UFF and the Interstellar League you can
  retire at any time: a 🌅 Life & Retire chip on the hub, Retire in the life screen's dock (the v146 E shell
  used to clip it out of its card; `qs` hid it under 30), and Retire Instead on the club screen. Sim the
  Rest of the Season plays the regular season, the playoffs and lands on the report card in one tap. An old
  v11 offer list that silently stopped every sim now opens the three-club screen, and a mid-sim cut pauses
  and resumes after you sign. From the UFF up, no story decision interrupts the season: the season event,
  Rivalry Week, life events and midseason crossroads are answered off screen (`TU("storyProV147")`) and
  logged. `v147Acheck.mjs`.
  **B · The menu wears the coin.** Prestige on the main menu — and on the in-game header chip — is the
  Vault's gold coin, not a star or a medal. The OVR ring's glow now sits exactly at the end of the coloured
  bar (it rode the ring's outer rim, off the band), and the gold lap past the soft max finally draws (a
  registered `inherits:false` property never reached its pseudo-element). The Lombardi-style trophy on the
  milestones card is replaced by an original UFF federation-shield trophy (`build-uff-trophy.mjs`).
  `v147Bcheck.mjs`.
  **C · The gear has a roll.** Every gear piece rolls 0–3 modifiers by rarity (Common 0–1, Rare 1, Epic 2,
  Legendary/Mythic 3), once, seeded by its id and scaled by rarity and the level it dropped at; old pieces
  are given theirs once. Fifty modifiers, each a real hook: 17 attribute bonuses (the live sim's `_raw` +
  `effAttrsV85`), 17 per-stat production lines (the season line `is()`), and 16 more (injury chance and
  time, fatigue gain, recovery, coach trust, snaps, variance, fate odds, PP, soft caps, upgrade points,
  training, age decline, clutch, call-up, team quality), capped per key via `TU`. The Conditioning gear
  effect finally works. The Locker shows rarity, modifier lines, a compare view and your total gear
  bonuses, and fits the phone shell. `v147Ccheck.mjs`.
  **D · The camera holds still at 4×.** At 4× the predictive lead was four times as long (wall-time
  velocity), nothing filtered the camera's target for speed, and the zoom target moved four times as fast —
  the picture shook 2–2.5× as much as at 1×. The focus velocity and lead are in play time now, the pan
  target rides a g-h filter fed forward into the spring, the zoom target is low-passed, follow cams get a
  dead zone, and a live edge-open reads where the camera actually is. The identity at 1×;
  `TU("camRateV147",0)` restores the old camera. Measured on the same replayed plays: 4×/1× steadiness
  1.8–2.6× → 0.5–1.0× across Broadcast, Tight, Follow Me and Follow Ball, with the ball in frame.
  `v147Dcheck.mjs`.
- **v146 — five things you asked for in one batch.**
  **A · Every man who goes down was taken down.** The broadcast folded the carrier the instant the
  dead-ball `tackle` fired, wherever the named tackler stood — on ~15–20% of stops that was 1.5 to 25+
  yards away. Causes: the v139 cut (the tackler named on the cut made the stop later, downfield), the
  sack a quarterback TAKES (resolved with the rusher ~3 yd off), the choreographer's snap-and-slide,
  and hit sticks at arm's length. The quarterback who eats the ball now braces on his spot and the
  sack is only booked when a man is on him, named by who actually arrives; `contactV146` walks the
  named tackler onto the carrier over the approach, glues them after the hit so they go down
  together, lets a hit-stick hitter drive through and stay up, and gives a script that stops dead on
  the tackle a short coast so the fall reads. Score-neutral over 4 seeds (21.47 → 21.21 pts, 173.2 →
  173.2 yds). `v146Acheck.mjs`.
  **B · Two strikes in the DFL, and you pick the team.** A DFL cut is a strike, counted per season:
  the first costs you your club (pick one of three teams that want you as a backup, on fewer snaps),
  the second ends the career. The v10 season-end cut roll that `longLeash` / `survivor` tune had been
  cleared by a v11 wrapper and never fired; it is a real strike again. New Franchise node **Second
  Chances** survives one more cut per level. Every DFL signing (entering the league, after a cut, free
  agency) is a choice of three offers — club and crest, team OVR, role, snap share, depth, coach
  trust — and the choice is real: name/crest/colours everywhere, the club's quality in both the
  watched and the simmed game, the snap share the engine uses. `v146Bcheck.mjs`.
  **C · The hoard buys the impossible.** A 13-node **Impossible** prestige branch (100K–10M PP) that
  bends the over-cap price ladder (Crack the Wall: ×5 past 250 → ×4/×3/×2; Move the Wall to 350;
  Long Bands; The Price Ceiling), raises every soft cap, and adds season points, coach trust, fatigue
  relief, faster healing, recruit stars, PP, stat production and potential. **Evergreen** (never age)
  is removed and refunded once. `v146Ccheck.mjs`.
  **D · The plan is yours, and the numbers say what it costs.** The weekly game plan is CHOSEN on page
  5 of the pregame — a board of every plan, each card spelling out what it does, what it costs, its
  roll odds and its variance (the old wheel is `TU("planWheelV146",1)`). Every pregame page shows the
  projected box score for this game with an 80% range and a VARIANCE figure, computed by playing the
  week in the real engine behind the wizard. A plan's volatility now really widens the stats (a form
  swing), and the watched live game plays on the same inputs as the booked one. `v146Dcheck.mjs`.
  **E · The menus live at the bottom, and nothing scrolls.** Every career screen wears the main
  menu's frame: crest, wordmark and honors chip fixed at the top with the career ticker under them;
  one panel that never scrolls the page (long lists scroll inside their own box); the section tabs
  moved from the top of the page to a strip just above the bottom bar, and each screen's buttons are
  one primary plus a slim row of chips. The prestige tree's bottom options went from half the phone
  to 13%. Every screen opens at the top (`#app` kept the last screen's scroll; the tab strip's
  `scrollIntoView` pushed it further). `v146Echeck.mjs`, `v146Eshot.mjs`.
- **v145 — the camera follows HIM.** Settings › FIELD VIEW › Camera has two more behaviours after
  Broadcast / Tight / Wide / Fixed (appended, so a saved choice keeps its mode). **Follow Me** locks on
  the you-player's own marker from the huddle to the whistle — a receiver running a deep route stays
  big in the middle of the screen and the field scrolls under him; a snap he is not on the field for
  follows the ball. **Follow Ball** is the same lock on whoever (or whatever) has the ball. Both ride
  the v28/v109 perspective lock at full strength (`lock: 1` — his drawn size held constant as he moves
  through the perspective), keep him near dead centre (`keep`), hold the locked size through a throw
  or a bounce instead of snapping back to the loose frame, and do not open up for the whistle's
  gather (`camFollowPostK`). Two limits moved for them only: the zoom ceiling (`camFollowCeilK` 4.6,
  `camFollowLockMax` 3.6), so he does not shrink as he runs deep, and the camera's side bounds
  (`camFollowSidePx` 180, `camSideV145`) — the near rows are painted ~240 px wider than the old 0..FW
  bounds, and a man split out on the near sideline was a man no pan could reach. Every other mode
  keeps 0..FW. `v145check.mjs`.
- **v144 — the ground, the sky, the gap between plays, and the age of the man on the field.**
  Eight things, all of them things you look at.
  **The pause at the whistle.** When a play finished the renderer had no play in hand, so `update()`
  returned early and twenty-two men stood perfectly still until the next snap built — then sprinted
  to the line. `idleBetweenV144` runs in that gap: each man picks a loose spot a step from where the
  WHISTLE left him, walks to it at `idleShuffleSpeed`, waits a random beat and picks another off
  that same home. The leash matters — two earlier cuts drifted, one building the target off the
  ball spot and one pulling 16% toward the new line per pick, and both walked all twenty-two men
  into one band around the football over a long gap. Measured, that took the near/far spread from
  ~390px to ~50px, which is the thing that makes the near men read as near. Under 120px a second
  across four separate gaps — a shuffle, not a run, and the field keeps its depth.
  **The play that fast-forwarded to its own result.** At half speed a long handoff play would cut to
  the yardage line without showing the run. The stall watchdog was budgeted as
  `script.duration * 2 + 4000` — in SCRIPT milliseconds, against a clock running at
  `basePlayRate * speed`. At 0.5× a 3.6s script with a 1.3s delay and the post-play gather really
  takes ~30s of wall clock and the watchdog fired at 24s, calling `complete()` mid-play. It is
  budgeted against the real rate now (`watchdogSlowestSpeed`, `postPlayMs`, the play's own delay)
  and published on `window.__V144.watchdog`, and the check asserts the budget beats the slowest
  speed the game offers.
  **The uprights stand in something.** `postPadV144` wraps a blue padded socket round each post's
  foot, drawn from the post's own base and scale so it follows the projection, in the field pass and
  in the field-goal overlay both (depth 6 — without the second call it vanished for the whole kick).
  **Grass on all four sides.** The two long sides always bled turf to the frame edge; the two ENDS
  did not. North, `if (target <= 0) continue` threw away every row above the far end line, so the
  five yards of apron the art paints beyond that end zone were never drawn and the stands sat
  straight on the end line. South, the painting simply stopped and fell into black. North draws the
  real painted apron now; south keeps going by ping-ponging a band of the art's own apron rows —
  real grass with real grain, so there is no seam where the continuation starts and no repeat line
  where a wrap would have jumped back — and recedes under a partial darkening instead of a wall.
  **One pylon a corner.** There were eight, which is what the real game uses, but the goal-line
  pylon and the end-line pylon behind it are eleven yards apart in depth and the broadcast camera
  foreshortened them into one doubled, thick-looking marker at every corner. The goal-line pair
  stays — they mark the plane the ball has to cross. `TU("pylonAllCornersV144", 1)` restores eight.
  **Two more tunnels.** `bowlTrimV112`'s entrance cut is a closure now, so the middle arch is joined
  by a rectangular vomitory in each upper corner of the far bowl, facing the corners of the field,
  with strokes on the jambs.
  **Weather, and a time of day.** The sim has rolled rain, wind, snow or clear since v79 and it
  really does move the passing, the kicking and the fumble rolls — but the only thing that ever
  SHOWED it was the sideline swapping towels for ponchos. `wxV144()` is the one read (resolved once
  a frame and cached, because the sky bake, the lamps and the particle layer all ask): rain and snow
  are a retained Graphics of drops in normalised camera space, so they ride the zoom, the handover
  cut and the shake for free, and they do not stop for the whistle. A sunny afternoon takes the sky
  to blue, the stars out, the lamps and their pools down to `dayLampMulV144`, most of the vignette
  off — and lays one flat sheet of sun across the whole turf, because with the four masts down the
  afternoon field was otherwise DARKER than the floodlit one. Settings › FIELD VIEW carries the
  five options (Auto is the week's own roll); pinning one moves nothing the sim reads.
  **The age of the man on the field.** An eight-year-old's game was a pro game with the names
  changed. `LIVE_AGE_K_V144` scales every sprite by the level's own cohort age — 52% at Pee Wee,
  99% by the declare, full in the DFL — read ONCE a snap and stamped on the marker rather than
  looked up twenty-two times a frame. The scale rides `p.s`, so the shadow, the jersey number, the
  tackle hop, the launch arc and the ball in his hand all follow for free; the shrink comes off the
  HEAD (the container's ground plane is local y=24), so a smaller man stands on the same grass
  instead of sinking into it. The one place it had to be backed out is the v118 mesh probe, which
  reads a screen distance as sim units.
  `v144check.mjs` is the gate (42 assertions).

- **v143 — the tackle is a move, not a collision.** A stop resolved in one tick: the committer
  arrived inside `tackleGrabDist` and `contact()` rolled the whole thing off ratings and a height
  gap. Three things a real tackle has were missing, and all three are things you can see.
  **The angle.** `behind` was the only geometry that counted, so a man flying across the carrier's
  face at forty-five degrees and one breaking down square in front of him rolled identical numbers.
  `angleQV143` grades the line he is actually on — his own motion against the vector to where the
  carrier is GOING. It has to be taken on the APPROACH: measured at the collision the lead point is
  further away than the carrier is and the reading is noise (mean dot 0.08), while frozen when he
  enters the watch window it is a real signal (0.63). Measured, men at speed with chase-downs
  excluded: a bad line stops the carrier **54%** of the time, a good one **73%**.
  **The windup.** A defender who has had time to gather makes the tackle he is supposed to make;
  one still at a dead sprint is lunging, and a lunge misses. `windupV143` is the time he needs
  (tackling and discipline buy it, closing speed spends it) against the time he has had. The window
  opens at 64px, not at the commit — from `tackleLaunchDist` there are only ~54ms left, less than
  any man needs. SET stops **79%**, RUSHED **58%**.
  **Low, medium and high.** `style` existed but was a CONSEQUENCE, derived from the height gap after
  the wrap had landed and read only by the picture. It is a CHOICE now (`aimPickV143`), taken before
  any roll off the height gap, the carrier's speed and power, the space, and whether he is set — and
  each aim really is a different tackle. LOW beats speed and cannot be trucked, but gets hurdled
  (6.1% vs 1.4%) and lets the carrier fall forward (drive 4.8 vs 0.04). MID is the form tackle, the
  best wrap there is, and the one men mostly make (44% of attempts). HIGH kills forward progress and
  is the only aim that strips or delivers a big stick, but it is what gets ducked and run through.
  The aim rides `hit`, so it reaches every event for free and the renderer draws three different
  dives — a cut is long and flat, a chest hit short and tall.
  **Score-neutral, measured properly.** The aim costs a `Math.random()`, so ON and OFF take
  different paths through the stream even under a fixed seed — seeding buys reproducibility, not
  pairing, and the first single-run comparison reported a +73% swing in sacks and 13 points of
  field-goal rate that were both pure resampling. Signed off instead on 12 OFF runs against 6 ON
  runs of 150 games each (2,700 games) with a permutation test: points −2.6% (p=0.31), touchdowns
  −2.6% (p=0.36), yards −2.1% (p=0.42), plays −0.8% (p=0.55), sacks ±0.0% (p=1.00), turnovers +6%
  (p=0.41). Nothing is significant after correcting for the fourteen metrics tested; the largest
  single reading is yards-per-carry at −2.9% (p=0.038, and 1-in-14 at that threshold is expected).
  `scoreneutralcheck.mjs` takes `SEED` and `TUNE` now so this is repeatable.
  `TU("v143", 0)` restores the old engine exactly, down to not spending the extra roll.
  `window.__V143`; `scripts/v143check.mjs` is the gate (20/20).

- **v142 — every stat says what it does.** An ⓘ sits beside every attribute on all four screens
  that list them (the hub's SKILLS sheet, the SKILLS screen, the pregame sheet and the offseason
  board's preview). Tapping it opens a card with a plain-language line, the player's own value, his
  soft cap and that stat's real-world metric, then two sections written off the code that reads it:
  what it does **on the field** and what it does **through the season**, plus a closing note.
  The detail is the mechanic, not flavour — v141 put all seventeen on the field, so the card can say
  that quickness sets reaction time off a 295 ms base at 2.4 ms a point, that catching is worth
  about a third of a percent of catch probability per point, that vision's read radius starts paying
  above 75, and that durability does exactly one thing during a play and everything else between
  them. It also tells you whether the stat is KEY for **your** position, merely counts toward your
  rating, or is not part of it at all. Closes on the ✕, the backdrop or Escape, and opening it
  spends nothing. Same pass retired the old `AI_NOTES` append, which glued a thirteen-stat blurb onto
  each row's one-line `desc`: it pushed the line past its width, so every note read as
  "…sets your marker's top speed i…" and the four stats it had no entry for looked inert.
  It is behind `TU("aiNoteV142", 0)`. `window.__V142`; `scripts/v142check.mjs` is the gate.

- **v141 — every stat is on the field.** FieldSim's `makeAgents` asks the engine's attribute
  accessor for eighteen keys by name, and the you-player's roster entry (`qr()`) carried twelve — one
  of them under the wrong name (`accel`, asked for as `acceleration`). Nine sheet stats never reached
  the agent at all: quickness, throwing, vision, jumping, stamina, grit, discipline, ball control and
  the sustained half of acceleration. The accessor's fallback answered a flat 45 for every man on the
  field, and the league normalise (`51 + (v − leagueAvgOVR) × 1.15`, clamped 20–95) turned that
  constant into ~80 at Pee Wee and the 20 floor at the DFL — measured: every DFL quarterback threw
  as a 21, every DFL defender reacted in 409 ms, every Pee Wee kid was a composed genius, and the
  AI roster (`h()` in `Wr`) had the same twelve keys, so it was inert for everyone. The twelve that
  did arrive went through `99·(1−e^(−v/78))`, which puts 250 at 95 and 350 at 98 — three roster
  points for the hundred sheet points the 5x wall charges — and then through `_starScale`'s
  position floors (a back kept 18% of his edge over his own peers). A DFL back at 250 and at 350 ran
  for 59 and 63 yards; a DFL quarterback threw for 78 at every sheet value.
  Now: `simScaleV141` is the one curve a sheet value takes onto the roster — OVR's own curve below
  the wall, continued past it (250 → ~116, 350 → ~172) — and `qr()` emits all eighteen keys (the
  `accel` / `hands` / `power` aliases kept); `h()` generates them for the AI with position bumps
  (`TU("aiQbThrowBumpV141")` is the quarterback's); the accessor's fallback is the man's OWN OVR,
  which normalises to league-average rather than a level-dependent constant; the normalise eases
  through a soft knee to 99 (`kneeV141`: `TU("simKneeV141", 80)` / `TU("simKneeTailV141", 22)`)
  instead of stopping at 95; no position's star floor sits under `TU("starFloorMinV141", .6)`;
  durability is a FieldSim read (`dur` — how much speed a carrier keeps through a glancing hit or a
  stagger, `TU("durKeepK")`) and its injury curve keeps working past 100 (`TU("injResistPastK")`,
  `TU("injResistFloor")`); the quarterback's composure pivot is `TU("composurePivotV141", 30)`.
  The you-player at a ball-carrier position gets a LOWER ceiling (`TU("simKneeTopPosV141", {RB:72,
  WR:76, TE:76})`): past a ~20-point edge over the tacklers every whiff, hurdle and broken-tackle
  roll saturates and they stack, and a back at 90 ran for 440 a game. Only the you-player — an AI
  back at Pee Wee sits at 85 by the normalise and the game was tuned on that. The reaction base is
  a dial (`TU("reactBaseMs", 295)`; it was a bare 340 read against a quickness that sat at 80 for
  kids and 21 for pros).
  Measured on the agent, DFL linebacker: 250 → 64 and 350 → 87 (was 36 and 45); a DFL back 63 → 68
  under his ceiling; the AI at 45–57 at every level on every key. Box scores, DFL, 20 games a cell:
  a back at 250 / 350 runs for 118 / 190 (was 59 / 63), a receiver 118 / 228 (was 35 / 38), a
  linebacker 10.7 / 14.6 tackles (was 6.1 / 7.3). The scoreboard: DFL equal-talent total 53.4 (was
  52.2) with pass yards per attempt 7.0–7.4 (was 4.7, failing the realism band) and completions
  69–71% (was 60%); Pee Wee score-neutral total 20.9 (was 24.7) with 8.1 yards per attempt (was
  9.4) and 72% completions (was 74%) — kids no longer throw with an 80 arm, and that is the whole
  gap; `aiQbThrowBumpV141` and `reactBaseMs` are the dials if it should come back. Kill-switches
  `TU("v141Keys", 0)` / `TU("v141Fallback", 0)` restore the old roster and the flat 45.
  `window.__V141`; `scripts/v141check.mjs` is the gate. Same pass:
  `equaltalentcheck.mjs` loaded script blocks 0–4 and patched a needle that lives in block 7, so it
  had been throwing before its first game; it loads the engine block again.
- **v140 — a dead splash, and the one line that caused it.** A career that ended left the save
  sitting on `End of the Road` (or `WELCOME TO THE DFL`), and from then on the game would not boot:
  `ERROR: Uncaught ReferenceError: vaultPayBtnV137 is not defined`, the loading bar stuck, every
  reload the same, forever — because the save kept restoring the screen that threw. Shipped in v137
  with the Prestige Vault and live ever since.
  The cause is an ordering trap, not a typo. The career app **restores the saved view and draws it
  from the top level of its own script block**, three separate times (`mc()`, and two later `q()`
  calls), hundreds of lines above the end of that block. `ms` and `no` — the two career-end
  screens — put `vaultPayBtnV137(e)` in their markup, and it was a `window.x = …` **assignment**
  600 lines below them. Function *declarations* hoist; assignments do not. So the screen drawn at
  boot reached for a function that did not exist yet, and the ReferenceError did not merely fail to
  draw a button: it **aborted the rest of the block**, so `window.__GRIDIRON_AUDIT__`, the v137
  vault glue and the whole patch layer never existed. The game was dead before it started.
  Two fixes, because one of them is the class and one is the instance. The v137 glue
  (`vaultPayBtnV137`, `vaultBuy`, `openVaultV137`, `vaultPayoutV137`) is a hoisted `function`
  declaration now, so a screen drawn at boot cannot outrun it. And every top-level boot render goes
  through `safeBootV140`, which catches and retries the render on a **deferred task** — by which
  time the block has finished, so the same render just works, which is the whole bug — and falls
  back to the menu if it still will not draw. Nothing is swallowed: both attempts go to the console.
  Saves are untouched, so a bricked career comes straight back.
  `bootviewcheck.mjs` is the gate: it writes a real save on each of the fourteen views the game
  persists, reloads cold, and asserts the block ran to its end, the vault glue is callable and the
  page is not dead. 7/0 here; 2/5 on the build that is live.

- **v139 — the numbers the screens promise.** A run of fixes where the picture and the sheet had
  drifted apart. The broadcast now obeys the box score (`fitLogYardsV139` cuts the animation at the
  spot the credited yards name, measured against the CARRIER, so an 80-yard picture on a 30-yard gain
  is gone), and `retagSimLog` verifies it is retagging its OWN play before it writes — it was
  corrupting roughly a quarter of the queued logs. The OVR ring on the main menu is a ring again
  (`radial-gradient(circle …)` sizes to farthest-corner, which swallowed the whole arc). A stellar
  season's acceptance rate tops out at 99, not 97. The season grade is floored against the call-up
  chance (`gradeFloorV139`), because a man the game says is a lock to move up is not having an F
  season. The honors the career-end card promises are the honors the account actually gets
  (`honorPayV139`: the card printed `Qs()` raw and the settle credited a fifth of it, against a
  prestige tree whose gates run to 30). **The years take a real cut now** — past the athletic prime
  every physical attribute loses 5% a season, steepening to 16% through the bands `mn()` already
  described, at every level and not just the DFL (`ageCutV139`, the one cut, taken inside `dc` so the
  v132 year-older screen shows every point of it) — and a five-figure endgame tier answers it:
  Second Wind (5,000 PP) reads the curve a year younger per level to eight, Early Declaration
  (10,000) takes a season off the minimum at this level, and four more sinks above them. The dock is
  no longer a lid: `.screen` reserved a flat 108px for a `position:fixed` dock that is 325px tall on
  the prestige tree, so the bottom of the node list could not be reached — the reserve is measured
  off the dock now (`--dockH-v139`). And the line keeps ONE surname: from the second generation the
  name box edits the first name only, the family name sits beside it, and changing it in Settings
  retrofits the living player, every father on the books and the Hall of Fame.
  The chrome moved with it: the topbar chip carries what is BANKED for the end of the career, the
  main menu has a PRESTIGE tile beside the coach's switch (the tree's only door was a header chip),
  the RUNNING IT BACK wordmark is off the career screens and left to the main menu, and the man on
  the year-older screen finally wears the team's palette — the recolour was guarded on a function
  that lives in another script block and is not on `window`, so it had never once run.
  And the program you commit to is the teams you face: a tier's `comp` moved exactly one number —
  the divisor that decides how hard it is to stand out nationally — so the schedule was identical
  at a Blue-Blood and a Mid-Major. It shifts the opponents themselves now, each card states the
  average opponent OVR it will actually generate, and the extra recruit ★ is paid at the end of a
  season you graded C or better instead of being handed over at the door.
  And the season no longer rolls your career focus while you are still reading the training board:
  `cfg.gate` puts one beat in front of the commitment wheel — it is built and drawn, then held
  behind a card that asks, and it spins when you say so. The gate's button carries the wheel's own
  `gv42go`, so everything that drives that wheel by tapping until the overlay clears keeps working
  with one extra tap. The coach also finally mentions the extra-season nodes, and what they cost
  you in DFL years.
  The team creator stops handing you two empty boxes, too: it offers five whole names — level-shaped
  off v123's own 120 towns, 88 mascots, college suffixes and fifty DFL clubs — re-rolled every time
  you pick a palette, and tapping one fills both fields.
  And the bottom of the screen is the way around: a five-item bar (hub / season / skills / tree /
  menu) under the dock, because every destination used to live behind a hamburger in the one corner
  of a phone a thumb cannot reach. Settings tabs instead of running 1.9 screens deep, long
  explanations clamp to three lines with a MORE on them, and the hub's dock stops repeating the two
  buttons the bar already carries.
  In the live game the carrier has THREE ways to beat a man — the spin, the juke and a SIDE STEP,
  picked off his own ratings from the roll the whiff already took, so the sim's random stream is
  untouched — the committed tackle's leap is sized by its own closing force instead of a flat 17px,
  and a whiffed diver finishes his arc and LANDS instead of snapping to the turf a fifth of a
  second after leaving his feet.
  Two bugs fell out of it. `flyStartV112` cleared `_launchUntil` but not `_launchH`, so a stale
  lunge height leaked into a v112 F flight and put a launched man above his own arc; and
  `fitLogYardsV139` DROPPED every event past its cut, which threw away a stripped ball's
  `looseBall` and `recover` and the drags a stop beat — nothing is discarded now, an event past the
  cut is re-timed onto it. v109C1check goes 6 fails → 0 (main fails 1-2 intermittently).
  And the DFL Combine is a combine. It was up to three more seasons of football games against
  "COMBINE FIELD", graded like any other week, with a national leaders board that invented
  twenty-five rushing lines for a year in which nobody played a down. It is ONE year now (`Bt`),
  its six weeks ARE the six drills every scout writes down (`A[6].games` is six; the v11 schedule
  builder names each week for its drill instead of drawing an opponent), and the numbers are
  measured off the attributes a combine measures — speed, acceleration, strength, jumping,
  quickness, agility — on the same curves the skills sheet already prints, reported as a time, a
  rep count or inches (`COMBINE_V139`, `combineResultV139`). The season screen opens on that board,
  the leaders tab shows those numbers instead of invented box scores, and the coach reads the week
  back to you — your forty, your best drill, the one that will get brought up in the room, and the
  stat to build to move it. `window.__COMBINE_V139`; `combinecheck.mjs`.
  One regression fell out of the gate, too: the coach opened his WHEEL stop over the READY TO ROLL
  card and his spotlight landed on the gate's button, so a first week stalled there — he waits the
  gate out now (`c.gate`), and coachcheck walks it the way a player does.
  `agecheck.mjs`, `tiercheck.mjs`, `gatecheck.mjs`, `movecheck.mjs`, `yardfitcheck.mjs`,
  `honorcheck.mjs`, `growcheck.mjs`, `v136check.mjs`, `emblemcheck.mjs`, `scrollcheck.mjs`

- **v137 — the Prestige Vault: your points, where you can see them.** Prestige Points stopped being a
  number on a chip and became a room. `o.pp` is drawn as ONE mixed hoard — bronze (1 PP), silver
  (1,000), gold (1,000,000) and electric blue (1,000,000,000), all in the same pile — on the floor of a
  black-and-gold vault with a circular door on the wall behind it. Tapping the money peels a coin off
  the hoard and throws it at the upgrade you are funding; holding pours, and the pour accelerates
  1x → 2x → 4x → 8x → 16x until the mound visibly collapses, the receiving core charges, and the
  upgrade unlocks. Earning runs the other way: a finished career offers to show the payout falling in
  and the pile growing. **The economy did not move.** Upgrades in this game are atomic — `Yl` debits
  the price and adds one level in one call — so the vault holds a RESERVATION inside its own screen,
  calls the game's own `buy` exactly once at the end, and then verifies that `o.pp` and the node's
  level really moved before it claims a sale. Cancel, navigate away, background the app or reload
  mid-pour and nothing was ever debited; skip and the same one purchase happens immediately. v136's
  banked PP is shown as pending and is never spendable, and replaying the payout presentation creates
  no PP. Prices, gates, rewards and the banking rules are untouched. **The money is physical**:
  most of the hoard is stacked in columns rather than scattered loose, every coin draws its own edge
  so it reads as metal rather than a printed circle, and each denomination carries a weight that sets
  how it bounces, how far a shove carries it and how it sounds when it lands. It stands as a PILE that
  is taller than it is wide on screen — the footprint pulled in and the peak pushed up until the drawn
  hoard went from 3:1 to 2:1, because height alone was never the problem, the footprint was growing
  with it — and it has a FRONT AND A BACK: the pile occupies real depth now and a coin's drawn size
  falls off with distance hard enough to read, so the money at the back is visibly further away. Every
  coin claims a volume, so no two sit in the same place; the inside of the heap goes dark by how
  buried it is; every coin presses a shadow into what it lies on; and a column is a countable stack of
  discs with a visible side to each one. You can pick a coin up and drag it off the heap, and when you
  do, the heap GIVES WAY into the gap: the coins around it are shaken loose and slide down the slope,
  the towers among them shedding from the top. How far each one goes is where it was sitting — a coin
  on the steep flank runs, one on a flat shoulder barely shifts — and how heavy it is, so the same
  shake moves a bronze coin furthest and a billion-point coin least. It is all held by real static
  friction: the slope acts only on a coin that has actually been shaken loose, so an undisturbed hoard
  sits at its angle of repose instead of creeping downhill, a disturbance is over in about a quarter
  of a second, no coin travels more than a fraction of the heap's width, and nothing that was in the
  picture is ever pushed out of it. **Pressing and holding shakes the money** under your finger, and
  harder as the multiplier climbs; **dragging a coin ploughs a furrow** through whatever it is hauled
  across. And **whatever you touch responds**: a press now returns the nearest coin whose drawn body
  actually covers the point, anywhere in the hoard — including the coins in the baked deep layer,
  which could not be picked at all before, and which is why a press sometimes appeared to do nothing.
  RESTOCK puts every disturbed coin back — or, on an already tidy
  hoard, pours the same money into a different heap.
  None of it touches a Prestige Point. The hoard is a seeded slot list
  that never reshuffles — coin *i* is born at a fixed fullness on the mound as it is at that fullness,
  so spending takes coins off the top and the outside and everything else stays exactly where it was;
  eight illustrative states run from an empty floor to an overflowing room, capped at a bounded number
  of sprites that falls on weaker devices. The screen is `public/rib-vault*.js/.css` (baked in like the
  menu), 50 sprites cut out of the supplied concept sheets by `scripts/build-vault-art.py`, and about
  forty lines of glue in `index.html`. Two honest notes: the supplied room art misspells PRESTIGE, so
  its lettering is painted out and the renderer draws the words itself; and no audio file was supplied,
  so every sound is synthesised in WebAudio and `__RIB_VAULT_AUDIO.manifest()` names what a real
  recording would replace. `docs/PRESTIGE-VAULT.md` is the write-up, `docs/vault-shots/` the pictures,
  `scripts/vaultcheck.mjs` the gate (96 assertions, 60 fps under a 16x pour).

- **v136 — the lineage: the prestige system is a father's lesson to his son.** Four asks. **THE LINEAGE
  (D)**: a career ends and the next player is the SON — a new first name, the family's surname, the
  generation counted (`o.lineageV136`: gen, surname, one father record per finished or abandoned career
  with the league he reached and how it ended, and the running count of years the family has spent on
  the field). `familyV136()` is what every screen reads: the hub's hero row (2ND GENERATION · THE FOX
  LINE · 14 FAMILY YEARS · son of …), a card on the position screen, the tree reframed as THE INHERITANCE
  (what the family learned, handed down to every son), the career-end cards ("his son picks it up" /
  "Hand It to His Son"), a family-line card in the Hall of Fame, the menu's GEN chip and ticker line, and
  the coach: the persona stop opens on the old man (which league he made, proud or "learn from his
  mistakes"), the position stop makes the name joke (different first name — his mother's call — same
  last name, same chin) and counts the family's years, the menu and prestige stops say whose the
  inheritance is. **THE ESTATE (C)**: PP is only recovered at the END of a career — every mid-career
  credit (goals, titles, milestones, DFL seasons, nemesis, the locker, the daily) goes through
  `bankPPV136` into `o.ppBankV136`, the two settles flush it with the career's own payout, the tree and
  the goals board say what is banked, and the career-end card says how much of the total was. **THE
  SUMMARY BUTTON (B)**: 🗣️ COACH'S SUMMARY sits under the grade on the report card and opens the season
  debrief on demand, with an AUTO switch beside it (`rib.debriefOff.v122` — SKIP on the debrief still
  flips it) that is completely separate from the tour. **THE PAGES (A)**: the effective sheet is the LAST
  pregame page (YOUR SHEET, headed by THE WEEK, SETTLED), page 5 keeps the plan wheel and WHAT THE WHEEL
  DID, and a rivalry game gets a RIVALRY WEEK page after it: the five approaches on the wheel, every
  locked one left off, the winner written into `player.eventChoice` from that game on. The season-start
  event screen only introduces the rivalry now (`rivalDeferV136`), and `ca()` resolves a pending
  approach off screen on a rivalry week reached without the page. A landed inline wheel retires every
  id it carries so the next wheel can mount. `v136check.mjs`; `v112Dcheck.mjs`, `wheelcheck.mjs`,
  `rivalcheck.mjs`, `coachcheck.mjs`, `v111Bcheck.mjs`, `v134check.mjs` updated.

- **v135 — the wheel spins on the fifth page, and never on its own.** The game-plan wheel used to
  open the moment PLAY WEEK was tapped: a sweep saw the staff's deck, tore it out and spun over the
  season screen before the pregame wizard, and the midseason crossroads fired on a timer after a
  game, on whatever screen it found — so the wheel read as something that appeared at random. Now
  the deck is read and the decision rolled the moment it appears (`holdPlanV135`, the SAME dice,
  rolled once a week and HELD, so leaving the wizard and coming back cannot re-roll it), the wizard
  opens straight away, and its **fifth page** spins the wheel INTO the page (`spinWheel`'s host mode:
  the same card, no fixed backdrop; the fit-roll pop-up still covers the viewport and its CONTINUE
  closes only the pop-up, leaving the landed wheel and its result standing). NEXT waits while the
  wheel is in the air, and once the roll is in the page names the final stat — the plan, the band,
  and every stat it moves as before → after on the effective sheet, with the sheet itself under it.
  `commitHeldV135` applies the swing exactly once on CONTINUE TO MATCH, seen or skipped; BACK off
  the page mid-spin parks the wheel and it respins to the same pick. A queued crossroads
  (`player._crossroadsV135`, written by the post-game watcher instead of shown) spins on that page
  first. The season-commitment wheel over the training board is untouched. The coach's stops follow:
  BEFORE KICKOFF says five steps, and THE WEEKLY PLAN comes after it, over the wheel on page 5.
  `TU("wheelOnPageV135",0)` restores the overlay before the wizard. `v112Dcheck.mjs`,
  `wheelcheck.mjs`, `coachcheck.mjs`.

- **v134 — the goals are worth chasing, the busts have a box score, the Apex shelf, and the coach only
  where he belongs.** Eleven asks. **THE GOALS**: `zt` rescaled top to bottom — a DFL title as the
  game's MVP is `dflMvpTitle` (10,000 PP), the Interstellar title as its MVP is `galaxyMvpTitle`
  (1,000,000 PP), 100 OVR is 1,500, the star call 2,500, and the board prints the numbers with commas
  and a line of sub copy under each. **THE BUSTS**: every enshrined career keeps `hofSnapV134` — totals,
  the season log, the top six attributes, awards, origin, traits, levels reached — and a HALL OF FAME row
  taps open to `hofCardV134`. **THE APEX**: an eleventh prestige branch of high-cost, rule-changing
  nodes (Evergreen slows the decline, Borrowed Time adds retirement years, Clean Slate waives the
  reroll penalty, Throw Him Open lifts `strideOddsV129`, Grudge Match raises the rivalry stakes,
  Trainer's Room downgrades one season-ender a career, Reputation lowers every honors gate, Compound
  Interest multiplies last season's gains, Franchise Player starts coach trust at 42, Bloodline rides
  the dynasty line, Oracle fixes the fate roll). The prestige tree no longer needs a click to render
  (the v75 sectioner folded its NODES section; `nofold: ["nodes"]`). **THE MENU**: the diagonal
  sweep and the continue card's streak are gone; the OVR ring fills to `softMaxOvrV134` (the OVR of a
  man sitting on every soft cap) and a second gold arc runs past it; the season strip carries the
  position's main stats summed off the played weeks (`seasonLine`); the helmet crest wears the
  helmet's scratches. **THE GROWTH FIGURE**: `growDrawHiV134` draws the offseason body from
  `public/grow/idle_dn_hi.png` (native resolution, cut by `scripts/build-grow-art.py`) in the team's
  colours, with the 48px cell as the fallback. **THE COACH**: the prestige tree is its own stop off
  the menu's PRESTIGE button (view `shop`) and one of the first things he shows; the skill-point
  sheet (view `upgrade`) has a stop about skills that never says prestige; CAREER is its own stop on
  the way back; and the debrief's last line is `closerV134` — disappointed when the year fell ten
  under the bar or below the grade, proud of the play, the development or the heart when it earned it,
  plain otherwise. `v134check.mjs`, `coachcheck.mjs`, `growcheck.mjs`, `menufxcheck.mjs`.

- **v133 — the coach grades the board, the boy in the picture, and a coach with a mouth on him.** Three
  things. **THE COACH GRADES THE BOARD**: the offseason board suggested one program off the single
  furthest-behind stat and said nothing about the other eleven. Every program is graded now, from what a
  season of it would actually do to THIS sheet: `attrTierV133` grades one attribute under one program —
  GREEN when it is a stat the position is graded on (its four heaviest weights, or a body stat that is
  breaking down) with room under its soft cap and a real gain, BLUE when the gain is real but the stat is
  secondary or near its cap, RED when it is at its cap, secondary, or barely moves — read RELATIVE to the
  sheet's best gain, because a gain is a fraction of a point at Pee Wee and several in the DFL.
  `trainGradeV133` sums a program's focus stats by the position's weights into a value (trading a key
  stat drags it down) and `boardGradesV133` ranks the board: GREEN pushes several key stats with room,
  BLUE is a solid gain, RED is minor or mostly capped, Balanced is BLUE by nature. The pick (`Hi`) is the
  best graded value now, not the single top stat — a breaking body still goes to Conditioning. The tiles
  wear the tier as a colour and a pill (KEY ×3 / SOLID / MINOR / CAPPED), the pick wears a COACH'S PICK
  ribbon and a pulse, the sheet's bars are shaded per attribute and sorted green > blue > red, and the
  coach's note says why in a line with the runner-up. **THE BOY IN THE PICTURE**: the growth screen's
  hand-drawn SVG is the game's own man now — the v91 sheet's front-facing idle, cut and recoloured in
  the team's colours by the chase's `cell()` (lent out on `__CHASE_V94.cell`), drawn in two pieces so his
  PROPORTIONS follow his age (`growStageV133`): a child is small with a helmet too big for him, a teen
  is all limbs, a college man is drawn to scale; he breathes (`gwBreath`), the ghost is last year's shape.
  **A MOUTH ON HIM**: a coach line has a MOOD (`moodOf`) — brash on a barked pose, an exclamation or the
  vocabulary in `BRASH_RE`, calm on the soft poses — and the voice follows it: brash is lower, louder,
  faster, driven through a waveshaper so it rasps, with a bark on the first letter of a word; calm is
  rounder through a lowpass; every line gets a word accent, a settling at the end of a sentence and a
  breath before it. And forty-odd QUIPS for the laugh, one thrown in on about a third of the lines as a
  tag on the bubble, barked. `gradecheck.mjs`, `growcheck.mjs`, `coachcheck.mjs`; `growshot.mjs`
  (`BOARD=1` shoots the board too).
- **v132 — the sting at every door, a year older, and a thousand hours on the menu.** Three things.
  **The live game's loader is the intro film, and it is up on the first paint.** Door two used to be
  the v94 chase with the film auditioning over it, and whenever the film missed its 1.2s window (a
  main thread busy compiling Phaser, an emptied park, a cold decode) the chase stayed for the whole
  door — the old loading screen a player kept meeting in front of live games. The chase is gone from
  that door. The loader is the sting in three layers that agree on one picture: the STILL of the
  landed wordmark (`rib_film_v116.jpg`, the film's own last frame) under everything, set before the
  element is in the document, so the picture is on the loader's first paint whatever the film is
  doing; the FILM over it from v116's seam, which is that same picture in motion; the matchup below.
  The film is warm by construction — `__V114.take()` hands out the parked element or the STANDBY
  `__V114.warm()` builds the moment the splash leaves with nothing parked, so a game is a seek and a
  play, never a load. Reduced motion and `?noFilmV114` get the still alone. And the door opens on
  the scene standing and the first play built (v101) after a short minimum (`LIVE_MIN_MS`, a film
  seen for `LIVE_SEEN_MS`, a cold decode given `LIVE_FILM_WAIT_MS`) — it used to sit on the 9s
  watchdog whenever the film was up, because only the chase's own beat ever opened it.
  **A YEAR OLDER** (`growShowV132`, over the report card): the season roll turns the man a year
  older, moves his frame along the v112 growth curve and, past his prime, takes attributes off him,
  and the report card never showed any of it. Now a screen opens over the report card the first time
  it renders for a finished season: the age counts up, the figure grows from last year's frame to
  this year's against a height rule with both marks on it, height / weight / muscle count up beside
  it with their deltas stamped, then what the season built and — from the veteran years — WHAT THE
  YEARS TOOK, in red, in the age profile's own words. Every number is read back from the functions
  the sheet uses (`bodyNowV112`, `zs`, `seasonStats.gains` / `ageChanges` / `ageProfile`). Tap to
  fast-forward; the button hands over; the coach waits at his door. Once a season
  (`player.growSeenV132`); `?noGrowV132` / `TU("growScreenV132",0)` switch it off.
  **A THOUSAND HOURS** on the main menu: a ticker of the career's own headlines under the top bar,
  embers drifting up the whole page under the cards, a stadium light sweeping across it, a bead of
  light running the topbar's rule, film grain, a light leak and the odd flashbang on the hero,
  pointer parallax on the hero (the picture leans away, the wordmark toward; the phone's tilt where
  the browser hands it over without a prompt), a gloss and a 3D tilt on the tiles, an energy ring on
  the CAREER tile, a spark riding the head of the OVR arc, a radar ping on the week that is up, the
  played weeks popping in one after another, the name in the brand's metal, a headlight crossing the
  continue card with a NEXT UP pin. All of it dies under `prefers-reduced-motion`. Also fixed on the
  way: HOME was clipped off the nav at tablet widths. `growcheck.mjs`, `menufxcheck.mjs`,
  `v115check.mjs`, `v127check.mjs`; `growshot.mjs` for the eyes.
- **v131 — the price of starting over, in numbers.** When a career ends and you roll another one,
  two screens decide the next man and neither of them gave you a number. The **origin draft** —
  three cards, or four with the Expanded Origin Draft — described itself in prose ("Starts behind
  physically, then develops faster after 16", "Better scouting clarity and stronger matchup
  counters"), while every one of those is an exact edit to the sheet that `As` applies and not one
  of the numbers was shown. `originSayV131` builds each card's list from its own `effects`, in the
  same order they are applied, so a card cannot promise something the game does not do —
  `−3 to Speed, Acceleration & Quickness · +6 Durability · +12 recovery`. Which is also how three
  dead keys turned up: `pressure` (the Prodigy's "harsher evaluations"), `clutch` (the Small-Town
  Prospect's whole identity) and `versatility` were in the data and read by **nothing**. Two are
  real now — `pressNeedV131` raises the promotion bar the Prodigy is judged against, `clutchV131` is
  a genuine +7 rating in playoff and rivalry games and nothing in a routine week — and the third
  always was real, just delivered under another name (the position-change button is gated on that
  origin). And the **reroll penalty**, the −5% on every attribute for abandoning a man unfinished,
  sat on the position screen and the hub card and nowhere near the pregame — the screen you read
  right before playing the season it is charging you for. It is on the pregame stat sheet now, and
  named on the wizard's impact page with its exact percentage. `window.__V131`;
  `scripts/origincheck.mjs` is the gate.

- **v130 — Honors, not stars.** The game had two star ratings and they meant nothing like each
  other. One is the **recruit rating** — the 1–5 stars on a player, the thing scouts give him, the
  thing `drSoftCap` reads. The other was the **account's prestige**, drawn with the same ★ and
  quoted the same way: the header chip said `★3`, the prestige tree said `🔒 Needs ★8 prestige`, the
  path screen said `Reach ★6 prestige`. Two currencies wearing one symbol is not a UI problem, it is
  a rules problem — a player reading "Needs ★8" reasonably concludes he needs an eight-star recruit,
  which does not exist. The account's rank has its own name and its own mark now: **HONORS 🎖️**.
  Nothing about the model moves — `o.prestige` is still the number, `Li()` is still the threshold
  curve, PP is still what you spend — but every place that drew a ★ for it draws a medal and says
  Honors, a locked node reads `🔒 Needs 🎖️ 8 HONORS — you have 4`, the header chip carries a tooltip
  saying which one it is *not*, and the ★ is left to mean the recruit rating and only that. The node
  requirement key is `honors` too, with the old `stars` still read so a save or a patch layer
  written against it keeps working. `window.__V130`; `scripts/honorcheck.mjs` is the gate.

- **v129 — the ball in stride.** `leadSkillV101` is the fraction of the computed lead the passer
  actually gets on the ball, and it sits around .46–.7 for almost everybody. That is the right
  *average* — most throws in football are a step behind — but it meant the game had no **best**
  case: a ninety-awareness arm throwing to a burner who had beaten his man still put the ball where
  the man *was*, and the receiver came back for it. There was no ball thrown in stride anywhere in
  the league. There is one now, and it is a decision the passer makes rather than a dice roll on
  top of one. `strideOddsV129` is how often *this* quarterback, throwing to *this* receiver, commits
  to the spot: the base rate is the **level** — Pee Wee is zero (a nine-year-old quarterback does
  not throw a man open), middle school starts to see it, high school a few a game, college far more,
  the DFL a staple — and it moves with the four things that decide it on a field: whether he can
  read it before it happens (awareness), whether he can put it there (arm), whether the man can run
  to it (speed), and whether that man has actually won (separation). A hurried, moving or panicking
  passer never throws one; committing to a spot is the opposite of getting rid of it. When it lands,
  three things change and nothing else does: the lead goes to **full**, so the ball arrives where he
  is going rather than where he was (measured 1.00 vs 0.66, and 3.7yd of lead vs 1.9yd); the cone
  **tightens** (0.88yd vs 1.54yd), because a throw you decided on before the break is a throw you
  are not steering; and the receiver runs **through** it — his route walk gets a longer tail, since
  he is being led past his last waypoint on purpose, and he does not break stride to track it. The
  catch, pick and swat rolls are the same rolls; what improves is *where the ball is*, which is
  exactly what "in stride" means — 70% caught against 60%, with YAC following on its own because
  YAC is emergent. Score-neutral: the difference against the previous build is smaller than the
  run-to-run variance of the same build. `window.__V129`; `scripts/stridecheck.mjs` is the gate.

- **v128 — rivalry week means something.** Rivalry Week offered five choices and told you nothing
  about any of them. "+Big performance, real injury risk" is not a number; "Safe, solid game" is not
  a number; and "Needs strong Grit or it backfires" named **84 Grit at Middle School** — a line
  essentially nobody clears — so the option was a trap that silently took a −1.6× rating penalty
  when you picked it. There was also no rivalry *game*: the stage was a season-wide modifier wearing
  a fixture's name, and one of its five effects (`rank`) was read by nothing at all. Now:
  **every option states its effects as numbers**, built from its own `eff` so the card can never
  drift from the model — the rating it adds to every game, the injury multiplier, the attributes it
  pays at season's end, the chance the staff sits you for it. **Variance is a real multiplier**
  (`eff.varMult`), applied to every game's rating around 50 exactly the way the persona sliders do
  it, and the card says what wide *means*: the good games get better **and** the bad ones get worse.
  **Every option but the safe one is locked** behind an attribute at a reachable line (+9 a level,
  not the old +22): the card says the number you need and the number you have, and `chooseEvent`
  refuses it — a choice you cannot make beats a choice that punishes you for making it.
  **And the fixture is real**: one mid-season week is THE rivalry, against a side ~27% stronger than
  the rest of the slate and hitting 18% harder, and it is the only rivalry on the schedule.
  Everything it pays lands **double** — the coach-trust swing, the injury roll, and a real bonus to
  the season's attribute growth if you win it. One more fix fell out of it: the season choice's own
  rating swing rode the *silent* path only, so the week you actually played never saw it and the
  card promised a number the game did not pay. `window.__V128`; `scripts/rivalcheck.mjs` is the gate.

- **v127 — door two can load its own film.** v115 made the live game's loader *borrow* the element
  the boot splash loaded — one decoded film a session, no second request. Taking it is the fast
  path, but it was the **only** path: with nothing parked (the splash left before the film played,
  an earlier game still holding it, a reload putting a fresh document in front of a warm HTTP cache)
  door two fell silently back to the v94 chase for the rest of the session — the "the video isn't
  playing on the live loader" case. It builds its own `<video>` on the same URL now. That URL is in
  the browser cache, so it is a decode rather than a download; it is given to `give()` on the way
  out, so from the second game on there *is* a parked element again. Two details make it look like
  the borrowed one rather than a cold start: a self-built element has `duration` of NaN for a beat,
  so the seek to v116's seam is skipped — it seeks on `loadedmetadata` instead, and does **not**
  claim the stage until the playhead is at the seam, because claiming earlier would put the film's
  opening second of near-black on the loader, which is exactly what this door exists not to do. Its
  audition is longer than a borrowed film's (2.6s vs 1.2s), and with the film off for a real reason
  — reduced motion, `?noFilmV114`, no codec — nothing is built and the chase runs unchanged.
  `__LIVELOAD_V94.lastFilmMs` / `.lastFilmOwn`; `scripts/v127check.mjs` is the gate.

- **v126 — the opponent has a face, he wears on you, and the season screen is four tabs.** Four
  things about the two screens you come back to every week. **The opponent card** was a name, a
  confidence dial, a fog count and a RECOMMENDED COUNTER — a game plan the player has not chosen
  himself since the pregame wizard took the call, so the one concrete line on the card was the one
  thing it could not act on, while everything worth knowing about the side you are about to play was
  generated and thrown away. `oppReadV126` reads it back: the tier and the rating gap in points,
  offence and defence as separate numbers, physicality, and tempo / hitting / pressure in words
  rather than raw 0–100 dials. **Wear and tear** now names its causes: the ledger has always priced
  the opponent (`oppMulV111`) and your body (`durMulV111`) and never said either, so the number had
  no cause — `oppWearSayV126` names the side, their rating against yours, how hard they hit, your
  durability, the multiplier each contributes, and the fatigue and injury they add up to for the
  next game. And `oppMulV111` reads the opponent's **physicality** for the first time (it has been
  generated since v11 and never used), so a side that hits at 90 really does leave you in a
  different state than a finesse side of the same rating. **The pregame bars** were drawn against
  `we()`, the absolute wall — 250 at prestige — so a Pee Wee's 12 was a 5% sliver and every stat on
  the sheet looked identical and hopeless. They fill to the stat's **soft cap** now, with anything
  past it in **gold** on a stretched scale and a tick left where the cap sits. **The season screen**
  gets the v75 hub treatment: 1,878px of role battle, scouting report, body ledger, press strip and
  schedule on an 844px phone becomes four icon tabs — 📅 SCHEDULE · 🎯 OPPONENT · 🩹 BODY · ⚔️ ROLE
  — one screen each, schedule first. Also: opponents and the standings board draw from the v123
  pools now instead of nine hard-coded lists of five that held Ducks, Dallas, Miami and Denver.

- **v125 — the top of the country is absurd.** One line decided every national rank in the game:
  `br()` mapped production onto its quality factor with `(a/(n*s)-.45)/.85`, so the #1 player in
  America was whoever produced **1.85× his level's baseline — at every level**, Pee Wee to DFL. A
  perf-75 season put you top five in the country; a perf-85 season finished #1 of 1.8 million kids.
  The board never looked wrong because it generated its own top 25 off the same `.85`. It was just
  far too easy. The elite line is per-level now, written in the unit the whole game already shares —
  a multiple of the DFL per-game baseline, `per[7]`. The national leader at **Pee Wee puts up five
  times what a DFL starter does**: 425 receiving yards a game, 525 rushing. The multiple slides down
  through the grades (4.2×, 3.4×, 3.0×, **2.6× at Varsity**) to something merely great in college and
  the pros. `eliteRV125` turns that into the multiple of *this* level's own baseline that `br()`
  should call 1.65, and `Ni()` draws its top 25 off the same number, so the board shows the stats the
  rank now demands. Nothing else moves: the median is still the median, rate stats and
  lower-is-better stats keep the old line (a yards-per-carry is not five times anything), and the
  floor is the old 1.85, so no level ever gets *easier*. The season that used to finish #1 in Pee Wee
  now finishes **#85,189**. `window.__V125`; `scripts/v125check.mjs` is the gate.

- **v124 — the program cuts both ways, and the coach names a stat.** Two things about training.
  **The trade**: twelve programs were twelve flavours of the same promise — pick one, get its
  stats — and the only price was a stray `-1 Stamina` on two of them, so "HIGH RISK" meant nothing
  you could point at afterwards. The harder programs *trade* now: explosion work costs top-end
  speed, the weight room costs time in the film room, the track costs mass off the frame, the grind
  costs your body and your discipline. That price rides the same `cost` field the season roll and
  the v113 preview sheet already read, so the board draws it in red and the season charges it — it
  just has weight now, and the sheet says it in a sentence as well as in chips.
  **The roll**: the four volatile programs (Full-Contact Camp, The Grind, Track Club, Explosion &
  Hops) are a real roll with stated odds. It **lands** and the trade is waived entirely and every
  priority stat grows ×1.35–×1.9; it **misses** and the trade *doubles* and growth is cut to
  ×0.45–×0.7. The odds are yours to move: Weighted Coin lifts them, Loaded Dice rolls twice and
  keeps the better, House Money turns a miss into a partial payout, Scripted Destiny rewrites one
  failure a season — the same four prestige nodes the game-plan roll already reads. The roll happens
  once a season, is stamped on the player (`player.planFateV124`), and the preview sheet shows the
  *expected* season so a volatile program's bars sit honestly between its two outcomes.
  **The coach**: `recommendTraining` opened with `if (injuryResist < 30 + level*20) return
  "conditioning"` — a line almost nobody clears (70 at level 2), so the coach said CONDITIONING
  every season of every career whatever you played. Gone. `trainScoreV124` scores the whole sheet —
  how much the position is graded on that stat, how much room it still has under its **soft cap** (a
  capped stat is worth nothing: the next point costs 4), and how far it lags — and `trainWhyV124`
  says the answer in one line: the stat, the reason, and where it stands against its cap.
  `window.__V124`; `scripts/traincheck.mjs` is the gate.

- **v123 — the league has a map, and the crest matches the name.** Two halves of one bug. The
  world only knew fifteen towns and fifteen mascots, so the same handful of school names came round
  every season of every career; and the mascot was drawn with no regard for the crest, so a
  "Buffaloes" side could wear the eagle — `logoForName` hashes any name it has no `LOGO_RULES`
  pattern for, and eleven of the fifteen old mascots had none. Now: **120 invented towns** and
  **88 mascots**, and every one of those mascots is matched by a rule, so the emblem a side wears is
  always the animal or figure in its name — proved mascot by mascot, against the packed sheet, by
  `scripts/namecheck.mjs`. The name is level-shaped too: a youth side is `Town Mascot`, a college is
  `Town State / Tech / A&M / Poly / …`, and the DFL is a fixed fifty-club league (`DFL_V123`,
  `dflClubV123`) drawn once per save, so the pro league a career climbs into holds still while the
  schools below it keep rolling. No generated name — youth, college or pro — is a real NFL or major
  college team, and no town is an NFL host city; `namecheck.mjs` enforces all three.

- **v122 — the report card is one card, and the coach reads your year back.** Two things, one
  screen. **The jumble**: on the season result screen the depth-chart card was injected with
  `insertAdjacentHTML("afterend")` against `.season-grade` — which is the grade LETTER, inside the
  112px circular `.grade-ring` — so the whole card was rendered *inside the ring*, overflowing
  across the report card and every card under it. It anchors on the report CARD now
  (`.season-grade`'s `closest('.card')`), and the result screen has no overlapping boxes at all.
  **The debrief** (`v122 THE SEASON DEBRIEF`): the report card was a grade, a record, a promotion
  bar and fourteen attribute rows, and no verdict. `capV122()` reads the week rows BEFORE the roll
  clears them — the rating, the fatigue at each kickoff, the weekly-plan roll's band, the game-plan
  swing, the snaps and the injuries — `buildV122()` joins that to the season's own stats, and
  `window.__DEBRIEF_V122` hands the coach a head line, a focus for next season and a weighted list
  of notes: did fatigue linger (and what the slope cost), did you beat or miss the bar they set for
  you, did the dice go against you, where do you rank nationally and at your position, are you on
  track for the next level (the bar, your rating, the call-up percentage, the seasons left), did
  you get on the field enough, and what the body cost you. He says the record, the loudest four
  notes and the program to run next season — every line that season's own numbers, none of it
  written in advance. It is **not** part of the first-week walk: a report card comes round every
  season, so it fires on every one (once — `rib.debriefSeen.v122`) whether the tour is on or off,
  wears its own crumb and bar rather than a step count, and its SKIP silences the debrief alone
  (`rib.debriefOff.v122`) without touching the tour switch. A stop may now `build()` its lines when
  it opens, which is what made a written-on-the-spot stop possible. `coachcheck.mjs` plays a whole
  season to the report card and proves the layout and every claim above. Menu stamp →
  `v122-debrief3`.

- **v121 — the football is the last resort, not the first frame.** The 🏈 in the boot splash's stage
  (`.splash-ball`) was painted the moment the document parsed and hidden again when the film or the
  chase claimed the stage, so every boot flashed a static emoji on a bare card for the second before
  the title sting started — it read as an older loading screen showing under the new one. It is
  `display:none` in CSS now and asked for by one class (`#splash.ball`), added only when BOTH have
  stood down: the film declined (reduced motion aside — that path shows the film's own last frame)
  AND the v91 sheet never arrived, so there is no chase to draw. That is the one case the football
  was ever for, and `splashcheck.mjs` / `v112Acheck.mjs` still prove it stands in there.
  `ballStandsIn()` beside `mountChase()` is the whole change.

- **v120 — the coach decides your snaps, fatigue is a slope, and the coach points.** Three things.
  **The coach decides your snaps** (`v120 THE COACH DECIDES YOUR SNAPS`, beside `USE_V111`): NORMAL
  on the pregame screen used to be every snap the unit takes from game one; it is now the share the
  coach trusts you with — `trustShareV120` runs from about a third at trust 0 to all of them at 100,
  so a stranger's first game is played on about half the snaps and the share climbs as trust does
  (the sim's own substitution, `_share111`, and the post-game bill read the same number). Below
  NORMAL the dial still sells snaps back. Above it you ASK for more: `askSayV120` gives you a part of
  the extra, more the more he trusts you, never past every snap, and `askMulV120` multiplies the wear
  and the injury roll for the asking — the forecast, the bill (`chargeV111`) and the game-day roll
  alike, through `injChanceV54` — fading to nothing at full trust. More trust is more say, and only
  ever for more snaps. The panel says so, the ledger names the multiplier as a part ("Asking above
  your share"), WHAT IT COSTS shows the fatigue before and after the game and what that does to
  every stat (`fatigueRowsV120`), and the guide has the rule. **Fatigue is a slope** (`v120 FATIGUE IS A SLOPE`,
  `fatigueMulV120`): fresh under 25 is still +5%, nothing to 40, then a straight line down to −20%
  on every attribute at 100 — which passes −10% at the old worn line of 70, so a body at 70 plays as
  it did — and playing hurt is at least −10%. One function, read by `condMultV54` (the sim, the
  sheet, the silent week), the body ledger's row (now WEARING DOWN before WORN DOWN) and the season
  projection. **The coach points**: a line that wants a tap (`tap: true`) puts a bouncing gold TAP
  HERE hand over the thing and pulses the cut-out gold, he waits for the game's own moment banners
  and cinema flashes before opening a stop (they were firing under him), he names the team and its
  colours on the hub and the name he can rename on the position screen (`find:` and `parent:`
  spotlight specs), he says NORMAL is the snaps he trusts you with, and the last stop sends the
  player to HOW TO PLAY for the AI, the strategies and the numbers. `window.__V120`,
  `window.__fatigueMulV120`; `v111Acheck.mjs` / `v111Bcheck.mjs` updated to the new ladder;
  `coachcheck.mjs` proves the hand. Menu stamp → `v120-snaps2`.

- **v119 — the coach, and the DFL.** Two things. **The league is the DFL** everywhere a
  player reads it: every `NFL` string in the game text, the menu, the guide and the check messages
  is `DFL` now (identifiers such as `nflReached`, `continueNFL()` and the `"nfl"` mastery key are
  untouched — they are code, not copy), and the `Pro Bowler` tier is `All-Star`. The team nicknames
  were already scrubbed in an earlier pass. **The coach**: the three uploaded coach sheets
  (five poses each, drawn mouth-closed and mouth-open) are cut by `scripts/build-coach-art.py`
  into `public/coach/<pose>_{a,b}.webp` — fifteen poses, plus a head crop for the menu tile — and
  the open-mouth drawing is the CLOSED drawing with only the MOUTH set on it: the sheets' own
  pairs were drawn twice (the body, the brow and the tilt of the head all differ), so the cutter
  finds the open cell's mouth inside its face, erases the closed drawing's own mouth line under a
  skin fill, lifts the open mouth as a feathered blob and hangs it from where that line was (the jaw drops, nothing climbs toward the nose) — nothing
  but the mouth moves, in every pose, and the cutter refuses any pose where a stroke of the closed
  mouth survives beside the open one (`art/coach/coach_pairs.png` is the proof sheet it writes). `public/rib-menu-coach.js` (`v119 THE COACH`, with
  `rib-menu-coach.css`, both baked by `bake-menu-into-index.mjs`) is a talking head who **pops in
  on every screen of a first week**, says three or four lines about THAT screen, and leaves:
  thirteen `STOPS` — the main menu (and PRESTIGE: what a finished career leaves you, spent under
  TRAINING), the personality roll, the position pick (every position wants a different mix of
  skills, and the mix is yours to work out), the hub, the season-commitment wheel, the training
  board, the season screen (YOUR BODY: a fatigued guy plays worse, so play fewer snaps and let him
  recover), the weekly-plan wheel, the four-step pregame, the broadcast, the post-game card, the
  season screen after the game, and the prestige tree whenever it is opened — a couple of minutes
  of talk in all, spread over the week, PLAIN: a coach talking to a jock who may not follow a long
  sentence, what the screen does and what to do about it, almost no numbers (the guide has the
  numbers), never the whole guide. `scan()` reads the page (the audit state's `view`, `#personaV13`,
  `#growthV42`, `#pregameV1513`, the scene's markers, `#pgOverlayV13`) on a MutationObserver and a
  half-second tick, opens the first unseen stop that fits after a short delay, and remembers each
  one in `rib.coachSeen.v119` so no screen hears him twice; the last stop switches him off. A line
  TYPES while his picture flips between the closed and open mouth in the shape of speech (a
  syllable open, a beat closed, a longer close at a word gap or a stop, the odd double snap — never
  a metronome), and he has a VOICE: a muddle of pitched blips, one per letter, synthesised on the
  spot with WebAudio, no sound file — a gruff low base, each letter its own step, vowels warmer and
  longer, a breath of noise on the fricatives, a sentence that rises and settles, a question that
  lifts; VOICE in the bubble mutes him (`rib.coachVoice.v119`), and reduced-motion keeps him quiet.
  A line can cut a spotlight into the dim over the thing it names (the CAREER tile, the position
  cards, PLAY SEASON, the wheel's CONTINUE — which the cut-out WAITS for, the roll not being in
  yet — CONFIRM, YOUR BODY, PLAY WEEK, the speed buttons), scrolled into the band above the bubble;
  tapping the bubble finishes a line, NEXT / BACK / the arrow keys move, GOT IT closes a stop,
  SKIP or Escape switches him off. The door is a **switch on the menu** (`rib9-tile-coach`,
  `data-rib-action="coach"`, routed by `rib-menu-navigation.js`): ON walks the week — the menu stop
  the moment it is switched on and, on a first visit, right after the game's own three welcome
  cards are clicked through. Those cards had been buried under the v89 menu overlay since it
  arrived (z-index 190 against 9999 — nobody ever saw them, and the checks' `window.o.tutorialSeen`
  trick was a no-op because the state is never on `window.o`); v119 lifts them above the menu, so a
  new player reads the three cards and then meets the coach. The walk switches itself OFF when it
  ends or is skipped (remembered in `rib.coachTour.v119`); an ON switch tapped while he is idle
  turns it OFF, and OFF tapped starts the week over; a stop cut short by a reload plays again at
  the next mount. The dev checks remove the cards without a click and never meet him; `?coachTour`
  switches him on at the first mount. `window.__RIB_COACH` is the hook and `scripts/coachcheck.mjs`
  the gate — it plays the whole first week through to the post-game card and back. Menu stamp →
  `v119-coach-plain`.

- **v118 — the quarterback's own sheets, and the mesh.** Four sheets drawn for the quarterback
  alone landed in `art/field/` (`qb_handoff_v118`, `qb_toss_v118`, `qb_throw_right_v118`,
  `qb_throw_cross_v118`) and `scripts/build-field-art.py` cuts them into the cells v108 already
  wears: `handoff_up0..4` is now the turn, the ball carried out LOW with both hands, at arm's
  length, ONE HAND AT FULL STRETCH (cell 3, on the sim's `handoff` event) and the empty hand;
  `toss_up0..4` the turn, the wind at the hip, the ball out, THE RELEASE and the empty hand;
  `throwR_up0..5` the set, the ball cocked at the RIGHT shoulder, at the ear (held a frame), the
  release with the arm straight up and the follow to the throw; and `throwL_up0..5` the same
  first four cells — he is a right-hander whichever way the ball goes — then the cross-body
  release (the right arm over and across, the ball leaving to his left) and the follow with that
  arm finishing on the left hip. Not cut, on purpose: the uploaded left-handed throw, the two
  belly frames (they read as a man facing the camera), the right throw's open-hand frame 3, and
  the old `throw_dir_a` / `exchange_quarter` cycles they replace (the old left throw rose on his
  left arm; the old reach came up to shoulder height and read as a pass). Every sheet is scaled
  by its HELMET to the atlas's (the cutter measures 0.34 of the standing height on all four), so
  the exchange lands on the atlas's 44 px and the throws share one shrink; the cutter also finds
  the ball (or the throwing hand) in every cut cell and prints `HAND_V108` / `BALL_DRAWN_V108`,
  and the football keeps its own brown through the sheet's gold normalisation (`keep_ball`).
  **The reach goes to the side the back is on**: `handoffL_up0..4` is the same reach mirrored
  (two hands on the ball through it, so no hand is the wrong one) for a back off the
  quarterback's LEFT, which v108 could only skip — `EX_V108.handoffL`, chosen by `sideDx` in
  the lookahead and the fallback alike; the pitch is not mirrored, because a pitch is thrown and
  he throws right-handed. **The mesh** (`v118 THE MESH`, `meshV118` / `meshOffsetV118` beside
  the exchange): the sim stages none — at its `handoff` event the back stands in his alignment
  five to seven yards to the side and neither man has moved since the snap, so the ball crossed
  the gap on its own and every handoff read as a short pass whatever the arm did. The
  quarterback's DRAWN position now steps toward where the back will be, as far as a jog allows
  in the snap-to-event window (`meshMaxYdPerS` 6.5, `meshStepYd` 5, never inside `meshReachYd`
  2.2), holds through the reach and eases back (`meshHoldMs`, `meshReturnMs`); his facing holds
  `up` while he steps (`m._meshFaceV118`). Nothing in the sim moves. What the step cannot close
  decides the picture: a back still out of arm's reach is PITCHED to (the toss cycle to his
  right, the two-handed reach to his left, the toss flight either way — `P._meshV118.far`),
  because a ball crossing five yards of grass is a pitch whatever the call sheet says; a back
  the step reached gets the hand. FieldSim's 264 ms window makes most of its runs pitches; the
  legacy choreographer's longer windows are hands. Same pass: a QB career no longer turns every
  run of his own offense into a keeper in the choreographer (`qbRun` needs the row to name him).
  `window.__V118` is the hook; `v108check.mjs` gates it (the mesh planned on every handoff play,
  the quarterback drawn on it, nothing skipped for the side). The run cycle every player wears
  is still the run8 sheet's — a wider build than these — and is untouched.

- **v117 — one man, one slot.** The you-player was being credited with tackles his team-mates
  made, and the reason was not the stat layer: it was the formation. Every snap, the eleven
  markers are filled by drawing roster players out of a pool by position, and the draw never
  removed what it had already handed out — so one player could be handed two slots at once. The
  you-player was the man it doubled, every time, because he is placed first and then left in the
  very pool the later slots at his position draw from. Measured over thirty games as a
  linebacker: on 56% of his defensive snaps he was on the field as **two or three linebackers at
  the same time**. Each of those copies was a real agent that pursued, wrapped and made stops,
  and the sim honestly named whichever one got there — so the credit passed every truth check in
  the repo while being, in plain terms, somebody else's tackle made from somebody else's
  alignment. A man now leaves his pool the moment he is placed, and the named picks (the
  carrier, the target, the quarterback) reserve their slots before the first body is drawn, so a
  quarterback keeper can no longer put one man at the RB alignment *and* under centre.
  Fixing that alone would have quietly halved his production, because it exposed the second half
  of the same bug: he was nailed to the FIRST slot in the list that matched his position, and the
  slots are not equal work. The three linebacker spots sit at different depths, and the weak-side
  one he always got makes under a third of the stops the man over the ball makes (103 against
  341, over forty games). A team-mate never notices — he is drawn at random and sees all three
  across a season — so the duplicate ghosts had been covering the busy spots while his own marker
  stood in the quiet one. He now rolls into one of his position's slots per snap, the same draw
  everyone else gets. Net effect on his line: 5.6 credited tackles a game against 6.8 of
  sim-truth becomes 4.7 against 6.4 — fewer stops, all of them his, taken from every alignment he
  actually plays. Two smaller credit fixes rode along: an interception was handed to you on a
  straight `Math.random() < .5` whenever the play named no cover man (a team-mate's pick, and his
  pick six, booked to you by a coin flip), and a face mask or horse collar flagged on YOU now
  marks the play as one you were in, the way the holding and pass-interference rows already did.
  Scoring is untouched — 24.43 combined points a game before, 24.38 after, over 600 games either
  side. `v117check.mjs` is the new gate.

- **v116 — the film loops.** The loading film no longer stops on its last frame; it runs its whole
  length once and then plays the tail again, and again, for as long as the loading lasts. The seam
  is 6.5 seconds: the streak has finished landing on the wordmark by then, and everything after it
  is the wordmark breathing under drifting cloud — so the last frame can run straight back into
  6.5s without anything jumping (measured, the two frames differ by 3.4/255 averaged over the
  picture). The element's own `loop` stays off, because a native loop would rewind to the second of
  near-black the film opens on *and* would swallow the `ended` event the rewind hangs off; the seek
  is done by hand, and both doors share the one looper, since the live game's loader plays the very
  same element. What the boot door waits for changed with it: it used to wait for the film to end,
  which no longer happens, so it waits for the intro to LAND instead. That makes the splash shorter
  than it was — the curtain can drop at about 6.5s rather than sitting through the whole sting —
  and any load that runs longer is covered by the loop rather than by a frozen frame. The live
  loader starts at the seam for the same reason: a door that may only be open for a second and a
  half now opens on the finished wordmark. New film, too — a 14.5s 1080p HEVC master, re-cut to
  ~1.4MB of 960x540 H.264 (plus the VP9 sibling and the reduced-motion still), because HEVC is
  undecodable in most of the browsers this game runs in and the master's `moov` atom sat last.

- **v115 — the film at both doors.** The live game's loader plays the sting too, as a backdrop under
  the matchup rather than a card beside it — the whole frame, not a crop, with the caption in the
  band below it and no loading bar over the picture, handed off to the game by the wordmark swelling
  and clearing last. Three things are deliberately not the same
  as the boot splash: it does not wait for the film (the door opens on the scene standing and the
  first play built — holding it for the full 14.5s would put twelve seconds in front of every
  game), it starts past the black lead-in (v116: at the seam) so a door that may only be open for a
  second and a half shows a picture on its first frame, and it reuses the element the splash already loaded. That last one is
  the whole trick. Door two mounts at the worst moment on the main thread — Phaser booting — and a
  media element's load does not *start* until the main thread lets it: measured, `play()` at 23218ms
  and `loadstart` 2.7 seconds later, on a door open for four. So the buffered element is parked when
  the splash leaves and lent to the loader, then parked again: one decoded film for the whole
  session, no second request. The same pass fixed the splash's own framing — the film ran as a
  rounded, shadowed card on a blue-grey ground while its own frames are near-black, so the card edge
  read as a seam and everything around it as dead space. The ground now wears the film's measured
  black (rgb(4,8,11) at its edges) and the film runs full-bleed with no radius and no shadow.

- **v114 — the splash is a film.** The boot splash plays the title sting instead of drawing the
  v94 chase: out of black, a light streak across the frame, and it lands on the wordmark, where it
  **stops** — no loop, the last frame held for as long as the load still needs. Three things had to
  be true before a film could be a loading screen rather than one more thing to wait for. It has to
  *arrive* first: the master's `moov` atom sat behind `mdat`, so nothing could be drawn until the
  last byte landed — `scripts/build-splash-film.mjs` re-cuts it with `+faststart` and takes 7.7 MB
  down to ~900 KB, and a picker inline beside the `<video>` sets its one source while the parser is
  still on the splash markup — not a `<source>` or a head preload, because those start a fetch the
  page cannot take back, and the paths that refuse the film would pay ~900 KB for it anyway. It has
  to *keep playing when the main thread does not* — which is the real argument for a film here,
  since video decode is off the main thread and the megabytes of inline bundle compiling below
  never drop a frame of it, where a rAF chase stalls on exactly that. And it can never *strand the
  boot*: no frame within three seconds — a 404, a missing codec, a browser that refuses to autoplay
  — and the stage goes back to the v94 chase. `prefers-reduced-motion` gets the film's last frame as
  a still, and never downloads a byte of the film itself. The loading
  bar underneath is two layers over one groove: v112 A's compositor sweep, untouched, still the one
  thing that moves while the bundle compiles, and a real determinate fill behind it — the film's
  buffered fraction, the v91 sheet landing, the app knocking, the film's own playhead, monotonic
  and full exactly when the curtain may drop.

- **v113 — the training board is a grid, and the choice is two taps.** The offseason
  "Choose Your Training" board listed twelve programs as full-width cards, so picking a
  season's work meant scrolling two thousand pixels holding four numbers in your head — and
  the tap that finally showed you what a program *does* was the same tap that committed the
  season to it. The twelve scenes are one screen now, four across and three down, and the tap
  is split: a tile **previews**, redrawing the sheet under the grid with one bar per attribute
  — where the stat stands today and the season this program would add on top of it, the stats
  it actually pushes marked in light blue and pulsing on a slow 2.6s cycle (held still under
  `prefers-reduced-motion`), the stats it charges marked in red. The dock's **CONFIRM
  TRAINING** is the commit, and it still runs through the unchanged `chooseTraining`, so the
  event roll and the season behind it are exactly what they were. The bars are drawn against
  each stat's **soft cap** rather than the absolute wall: at 12 of an eventual 250 every bar
  read as a sliver, and the cap is the number that actually governs the season — a stat
  already past it stretches the scale to fit and keeps a tick where the cap sits.

- **v112 — the start, the decision, the weight of a hit.** Six passes written in parallel against
  one rule: **the scoreboard does not move.** (1) *The chase is always ready.* The loading screen is
  drawn from the v91 field sheet, and nothing asked for that sheet until v94's own script ran —
  after a hundred kilobytes of document and every stylesheet — so cold on a throttled link the
  request left at 1.23s and the first animated frame landed at 3.09s. The sheet is now asked for in
  the first breath of the head and v94 adopts that request instead of making its own: 3.09s → 2.15s
  cold, 63ms for a second scene. The loader's bar moved onto the compositor, so the one moving thing
  on the page no longer freezes with the boot — 80 distinct composited pictures through a 1.2s jam
  where the old `margin-left` sweep gave 4. (2) *Who you start as.* An eight-year-old is no longer
  6'2" and 230lb: `player.body` is now explicitly the frame he PROJECTS to, and today's frame is
  derived from it by age at read time — 4'5" and 67lb at eight, walking up to the projection by
  twenty-two — shown on every screen with the projection in gold beneath it. Scouting still grades
  the projection, because that is what OVR, national rank and the declare have always read, and the
  screen says so. The second trait is now a choice of two cards drawn from a pool of ten, tagged
  upside or double-edged. And abandoning a career you do not like costs something: a named warning
  before the new man is created, then −5% on every attribute — in games and on the sheet — until he
  is promoted one level. (3) *The pregame, one decision at a time.* The screen that stacked the
  scouting report, the stat sheet, the involvement ladder, the coordinator's plan and three focus
  cards into one column three phone-screens long is now four pages with one decision on each, ending
  on a panel that states everything the week has done to him and the effective numbers he carries
  onto the field. Nothing about the model moved — the pages are the same blocks with every id and
  handler intact — and CONTINUE TO MATCH is on every page, so a man on his tenth season is one tap
  from the field. (4) *The stadium.* The floodlight masts are half the size, sit lower and are
  mirrored, so they read as fixtures above the bowl instead of two banks filling the top corners;
  a blue base band runs through every stand's own foot polyline, sweeping the corners rather than
  sitting as a rectangle, and an arched tunnel is cut into the far terrace; a fixed-seed star field
  sits behind the skyline, dimming as the lighting dial rises. The smeared bottom of the picture was
  diagnosed rather than patched — the art is sampled correctly; the near band was being laid out at
  1.44× the anchor row's density and drawing 360×700 art at eleven canvas pixels per art row — so
  past the backfield the camera now stops closing in: 11.08 → 7.70 px per art row, the painted end
  line 37px → 25px, and nothing downfield of the anchor moves. Honest limit: −31%, not elimination.
  (5) *The camera finds the ball.* The frame followed the carrier, and the carrier is still the
  carrier after he throws — so for the whole flight of a pass and the whole hang of a punt the camera
  sat on the man who had just let go of the ball. It now reads possession every frame: the holder
  while a man holds it, the football itself the moment it is away, easing toward where the flight
  comes down so it arrives with the ball. It tightens on a runner by how far the nearest tackler
  actually is, steps out at the hit and opens at the whistle, and never opens wider than the picture
  the FIELD VIEW dials already set. Four behaviours in Settings — Broadcast, Tight, Wide, Fixed —
  plus a zoom-strength slider. Measured: the ball sat 374px off centre at the 90th percentile of a
  carry before, and 97px on average now; on a punt the camera used to be 700–800px off the returner
  for a second after the catch. (6) *The hit has weight.* The violent tail of contact — 2.4% of
  resolved contacts, about three a game — now launches a man as a real projectile: the sim answers
  one number off figures the collision already computed, the renderer derives the hang and the peak
  from that same number so they cannot disagree, and the drawn body lags the script's own position
  rather than inventing ground, so he flies back along the line the sim already knocked him down,
  lands short, bounces and skids into the booked spot. Nobody is ever drawn in the air when the next
  play starts. **Score-neutrality is proved, not argued:** with the random source pinned, eight games
  with the launch off and on are byte-identical — same score, same event and same yard on every play
  — and over 300 games the merged build reads 25.4 points, 4.96 yards a carry and 74.8% completions
  against the pre-v109 baseline's 24.7, 5.15 and 75.3%, inside the probe's own noise band. Gates:
  `v112Acheck.mjs`, `v112Bcheck.mjs`, `v112Ccheck.mjs`, `v112Dcheck.mjs`, `v112Echeck.mjs`,
  `v112Fcheck.mjs`.

- **v110 — the man who is there.** A defender who looks like he is in position to make a play, and
  does not, is the one thing that reads as broken however good the rest looks. Measured over ~700
  plays, at the moment of the stop the nearest defender was the tackler 89% of the time — but 13%
  of men inside three yards of the ball had no part in the play at all, and at the catch point a
  defender other than the assigned coverage man was the nearest man to the ball 11% of the time
  with no way to touch it. Five rules now say the same thing: **where a man is standing beats what
  he was assigned and what his clock says.** A read lands the instant the ball is within a yard or
  so of him, because nobody stands that close to a football still diagnosing the play. Support
  holds only if it is genuinely farther off than the man committed to the tackle, never when it is
  closer. The commit is handed to whoever is actually closest, measured after the step rather than
  awarded to whoever claimed it first — so a linebacker standing in the hole can own it, and a
  blocked man who is nearer than the committer can still fall off onto the carrier. A defender the
  carrier runs straight into makes contact whether or not he owns the commit. And at the catch
  point the ball belongs to whoever is standing on it: the nearest defender contests it with his
  own ratings, returns the interception and takes the credit, where before only the assigned
  coverage man could touch the ball. Support also closes on the tackle now instead of parking a
  ring around it. After: 90.5% of stops made by the nearest man, 1.4% idle inside two yards, 4.9%
  inside three. The scoreboard barely moved — yards per carry 4.98 to 4.92, points 23.9 to 24.2
  over 300 games. `v110check.mjs` is the gate.

- **v109 — the game looks real.** Twenty-nine changes across the pass, contact, movement, game-flow
  and broadcast layers, built to one rule: **the scoreboard does not move.** Everything here is
  timing, geometry, an event the renderer can finally draw, or a field on a play row; where a number
  that feeds an outcome had to change, its mean was held or its distribution was left alone and only
  its direction shaped. `scripts/scoreneutralcheck.mjs` is the new gate — one JSON row of every
  outcome number, measured over 300 games before and after.

  **The ball has a speed.** A throw was `distance × a constant` with a 390 ms floor under it, so a
  3-yard swing, a 5-yard slant and an 8-yard hitch all hung for exactly the same time. It is now a
  RELEASE plus a VELOCITY — 59 / 45 / 32 mph by style once the 2.5× sim clock is taken back out —
  fitted so every style's mean over the real distribution of throw distances lands on the old
  ladder's within half a percent. The apex follows from the hang instead of from route depth, and
  the ball climbs longer than it falls. The `throw` event carries what the ball actually does
  (`dur`, `vel`, `velMph`, `apex`, `wobble`, `platform`), so a rope's laces blur and a hurried ball
  visibly wobbles where a clean one is a tight spiral. A hurried or off-platform miss is biased
  behind and short — the same *magnitude* distribution, which is what keeps every catch and
  interception roll still. And a throwaway is a real thrown ball now, past the near sideline, with
  the arm winding up on it; an errant ball can land out of bounds at last.

  **The receiver finds the ball.** He was driven at the landing spot from the instant of release,
  twice a tick, so he stood under it long before it came down. He runs his route until he finds the
  ball on his own clock — later over his shoulder — and his head turns, and so does the head of the
  man covering him. The hands go up *before* the ball arrives, on a `reach`, and the sheet's 46
  `catchseq` cells (cut long ago, registered by nobody) finally draw the catch; `catch` only
  confirms it, and there is a tuck before he runs. An incompletion now says what it was — dropped,
  swatted, contested, overthrown, short, behind, thrown away — classified after the rolls, changing
  none of them. A break-up is contact, with the arm coming from a side. And the quarterback pumps.

  **The hit has a point.** Every contact event reported the carrier's centre and nothing else, and
  a lunge carried no id, so the renderer paired a lunge to its outcome by proximity and mis-paired
  whenever two men arrived in one tick. Every hit now carries its impact point, its normal, its
  weight and a commit id, and the effects are drawn there, oriented and sized by the collision. The
  gang converges instead of freezing five yards apart; the pile keeps each joiner's approach
  bearing and beats a heartbeat while it drags; a strip runs a real loose ball with men diving on
  it, recovered by the same pre-rolled side; and a hard hit can bobble the ball with no possession
  change.

  **The feet plant.** A hard cut used to reach the field as a slide between two keyframes. The back
  gathers and plants, the never-used `plant_` cells get drawn, men lean into a turn and cross over
  instead of flipping 180° in a frame, a trucked man slides and gets up on a clock rather than
  freezing on a pixel, support fans on its own approach rays, a jogging man announces when he is
  running again, and a hit leaves a stumble on the never-used `hurt_` cells.

  **The game has a clock.** The extra point was a string suffix — the scoreboard jumped 0→7 with no
  kick ever shown; it is its own play now, off the identical rolls. Every snap row says whether the
  clock stopped and why, out-of-bounds is read from the sim log instead of a blind roll, and the
  two-minute warning, the period, the coin toss and the timeout are rows (with three pips a side on
  the scorebug) rather than text welded onto the previous play. The flag is thrown, announced and
  re-spotted in beats; a spot inside a yard of the sticks brings the chains out; punts, kickoffs and
  field goals carry their numbers; and a run finally names its direction and its tackler.

  **The broadcast.** The camera is a critically damped spring that frames the carrier in the leading
  third and pulls wide on the whistle, and the runner is allowed to grow as he comes toward the near
  sideline. Teammates walk over to help a man up, two or three join the scorer (and the bench
  surges), the huddle breaks by position with the quarterback last, an official runs to the spot and
  points as the ball is set down, the chain crew walks a new line, and eight sim events the renderer
  had always ignored — the blitz pickup, the linebacker's drop, the twist, the pocket slide — reach
  the picture at last.

  Guarded by `v109Acheck`, `v109Bcheck`, `v109C1check`, `v109C2check`, `v109Dcheck`, `v109Echeck`
  and `scoreneutralcheck`; `docs/ARCHITECTURE.md` has the per-part map, the tunables and the three
  seams the six parts cost each other.

- **v108 — the exchange, and which way he throws.** `scripts/build-field-art.py` cuts 22 more
  cells out of two of the new sheets (238 → 261), all rear views like the rest of them:
  `throwR_up0..5` and `throwL_up0..5` from `throw_dir_a` — the same six-frame throw drawn twice,
  the ball leaving to the man's screen-RIGHT in one and coming across his body to his LEFT in the
  other (a drawn cross-body throw, not row 0 mirrored: `faceMarker` never flips an `up` man, so
  both sides had to be cut) — and `handoff_up0..4` / `toss_up0..4` from `exchange_quarter`: the
  reach, the ball in the hand, THE BALL AT ARM'S LENGTH, the hand already empty, the hand coming
  back; and the pitch's belly, hip, swing, RELEASE and follow. Deliberately not cut, for the
  reasons in the build script's comments: `exchange_mini.png` (69-98px figures against 146-179 on
  every other sheet, frames that repeat instead of moving, and rows whose boxes link through the
  column of thrown balls), `throw_dir_b.png` (the same right-handed throw drawn smaller and
  mushier, the arm never extending; its row 3 is a throw ON THE RUN, which has no state),
  `throw_dir_a` rows 2-3 (the release frame's ball is fused to the glove; and a windup with no
  ball in any frame), and `exchange_quarter` rows 1-5 and 7 (throws whose ball vanishes between
  the cock and the release; a squatter build). No take-the-handoff frame for the back and no
  scramble cycle come out of any of them.

  The renderer wears them (`v108 THE EXCHANGE, AND WHICH WAY HE THROWS`). **Which way he throws:**
  in `startThrowV107` a quarterback facing `up` whose target is in front of him — inside
  `TU("throwDirConeDeg", 70)` off straight ahead — now keeps that facing and picks the ARM,
  `throwR` for a target to his screen-right (the dead-straight ball too: he is a right-hander),
  `throwL` for one to his left, instead of being turned onto the quarter cycle to throw at a man
  he is looking straight at. Outside the cone, or behind him, the old turn still happens. The
  release is still frame 4 on the tick the flight starts (residual 0 ms). **The exchange:** the
  same kind of lookahead as the arm (`exchangeV108` / `startExchangeV108`, beside `windupV107`)
  starts the reach two frames before the sim's own `handoff` event — three for a pitch — so the
  frame that lets the ball go is drawn ON the event: `handoff_up` frame 2 at
  `TU("handoffFrameMs", 70)`, `toss_up` frame 3 at `TU("tossFrameMs", 80)`, the call read off the
  play description by the same regex v105's hand uses. Both drawn exchanges are right-handed, so
  a back coming off the quarterback's LEFT keeps the pre-v108 picture (run frames, ball only) —
  `TU("exchangeSideMinPx", -3)`. **One football:** `BALL_DRAWN_V108` replaces v107's flat "hide
  ours on frames 0-3" with a per-cycle list MEASURED off the atlas (the rear throw only really
  shows the ball cocked at the ear on frame 3; the front and quarter cycles carry it 0-3;
  `throwR`/`throwL` 2-3; the handoff 1-2; the pitch 0), and on a frame the cell does not draw one
  the renderer's ball rides the cell's own hand at the offset in `HAND_V108`, measured off the
  same pixels. `window.__V108` counts `ballDoubled` and `ballMissing` — both stay 0 — and carries
  the throws with their `dir`, the handoffs and the tosses with the frame each event landed on.
  `scripts/v108check.mjs` is the proof; v104's number bands read cleanly off all 22 new cells.

- **v107.1 — the sheen flashes twice, the flashes stay on the crowd.** Two menu fixes. The
  wordmark's sheen (`.rib9-sheen`) tiled its highlight band, so after the flash the user liked
  a second copy crawled across the letters in the easing's slow tail (measured: a 284 ms flash,
  then a 60 s crawl); the band is `no-repeat` now and `rib9sheen` is two identical sweeps a cycle,
  each the original curve over the original travel, a beat between, a hold after — 284 ms and
  284 ms. The header brand's gold (`rib9brand`) gets the same rhythm, with flat gold under the
  gradient so the letters never vanish between passes. The hero's camera flashes, shimmer, lamps
  and sun were placed in the BOX's coordinates while the photograph is cover-cropped under them,
  so at a phone width the flashes popped on the tunnel walls; `v107.1 THE FLASHES ARE ONLY OVER
  THE CROWD` (`public/rib-menu.js`) places them in PICTURE percent — two traced crowd polygons
  either side of the man, `CROWD_V107_1`, inside the tunnel mouth and off the v106 kit masks —
  and maps through the cover box every frame (`heroPicBoxV107_1`). `scripts/sheencheck.mjs`
  measures both flashes off the computed background position; `scripts/heroflashcheck.mjs`
  reads every spawn back and proves the picture pixel under it is bright warm crowd at three
  widths. Menu stamp → `v107.1-menu`.

- **v107 — the arm, the drop, the stance.** Six new sheets landed in `art/field/`, and
  `scripts/build-field-art.py` now cuts 27 more cells out of four of them (211 → 238): a
  six-frame throw in three facings — `throw_up0..5` (throw_back), `throw_dn0..5` (throw_front)
  and `throw_ur0..5` (throw_quarter_a, cut mirrored like every other sd/dr/ur cell, since the
  renderer flips those for a man working right) — plus `backpedal_up0..5`, and `ready_up`,
  `stance3_up` and `carry_up` from the stances sheet (the sheet's centre-over-the-ball pose is
  left out: its arms read wrong at 44px). The packer keeps the 211 cells that already shipped
  byte-identical: they are quantized on their own, as before, and the new cells are mapped onto
  that palette and appended — the whole-atlas quantize had drifted the old kit's colours off the
  recolour's hue bands, and navy showed through on every team. Every throw cycle reads
  0 set, 1 grip, 2 stride, 3 the ball cocked at the ear, 4 THE RELEASE (the arm through, the
  hand empty), 5 the follow. The ball each sheet draws in flight is a loose blob beside the man
  and the renderer carries its own (v105), so it is DROPPED at the slice (`min_px=4000`) instead
  of being merged the way `catch_throw` merges a held one; a ball still in a hand is part of the
  pose and stays. `art/field/throw_quarter_b.png` (the figures lean at a different angle every
  frame and the release frames fuse the loose ball to the arm) and `art/field/snap_catch_mini.png`
  (half-size figures, and the facing changes inside one group) are deliberately not cut — no cell
  in the atlas comes from either.

  The renderer now wears all of it. `ribRegisterTeam` registers `spr_<kit>_<dd>_throw0..5` from
  the drawn cycle for `up`, `dn` and `ur`; the two facings nobody drew borrow the nearest real
  one — `sd` the quarter (the arm already comes across the body) and `dr` the front (the only
  cycle facing the camera) — and without the atlas (`?noV91`) the baked, facing-less frames stand
  in exactly as before. `throwSeq` stopped forcing `m.flip = false` when the facing has a drawn
  cycle, so a throw to his left mirrors, and the v105 hand the ball rides in follows both the
  facing and that flip. The arm is armed by a LOOKAHEAD (`windupV107`/`startThrowV107`, called
  beside `qbTickV86`): the choreographer's `windup` fires 300 ms before the ball and FieldSim —
  the path that renders about nine plays in ten — never emitted one at all, so the sequence is
  now back-dated off the script's own `throw` event and frame 4 is drawn the tick the flight
  starts (residual 0 ms; `TU("throwFrameMs", 85)`, `TU("throwReleaseFrame", 4)`). Frames 0-3 of a
  drawn cycle already hold a football, so the renderer's own ball is scaled away across them and
  comes back on the release. A dropback is drawn as `backpedal0..5` paced by the ground he covers
  (`TU("backpedalFrameMs", 110)`) instead of the run cycle played facing the line, and v86's
  one-frame backward test is held a beat (`TU("dropHoldMs", 200)`) so the pose stops flickering. Pre-snap the offensive line, the center included, is in
  `stance3_up` (the ball sits under the center from v105), the skill men wait in
  `ready_up`, and a man standing still with the ball has it tucked in `carry_up` — all rear-view
  art, so the defense keeps the old two-point stance and idle. `window.__V107` is the hook and
  `scripts/v107check.mjs` is the proof.

- **v106.1 — the page knows when it is stale.** GitHub Pages lets a browser keep `index.html`
  for ten minutes after a deploy, and every menu file and every kit mask is stamped by THAT page,
  so a phone that opened the site inside those minutes showed the old menu in the old kit and
  only a hard refresh got it out — which is how a merged, deployed kit fix read as "no change".
  `scripts/assemble-pages.mjs` now writes the build's version into the page
  (`<meta name="rib-build">`) as well as into `rib-build.json` beside it, and on the menu's first
  mount `freshV106` (`public/rib-menu.js`) reads that json past every cache; if the site has moved
  on it pulls the fresh page into the cache and reloads ONCE, remembering the build it reloaded for
  so it can never loop. Only at the menu, never mid-game; a page without the meta (vite dev, a
  `file:` build) never asks; `?stayStale` holds the reload. `scripts/freshcheck.mjs` serves the
  assembled site from a throwaway server with Pages' caching and proves all four cases.

- **v106 — the kit is cut from the picture.** The team colours on the main menu's three
  photographs (the tunnel hero, the continue card, the helmet portrait) were laid over hand-placed
  polygons, and a polygon at 1% is not an outline: the jersey ran past both sleeves onto the
  tunnel, the pants onto the crowd beside the hips, the helmet into the floodlights, while the
  cuffs, the shoulder band, the waist, the lower legs and the whole lit flank of the portrait
  shell stayed grey. Each picture now has its own segmenter — `scripts/menu-kit-hero.py`,
  `menu-kit-card.py`, `menu-kit-portrait.py`, run by `build-menu-art.py` — that MEASURES the
  garment's edge off the photograph (a prior curve per boundary, snapped to the outermost strong
  luminance or neutral-chroma step, median-filtered, closed into one outline per garment; the
  portrait's shell is a radial rim trace and its facemask a top-hat lattice) and asserts, on its
  own run, that no alpha lands beyond a few pixels of the traced kit. Jersey and pants share one
  waist curve so they meet with no grey seam; the neck between shell and collar, the visor glass,
  the gloves and every gap of background are out. The menu build stamp moved to `v106-kit` so a
  phone that cached the old masks fetches these. `scripts/menu-mask-check.mjs` probes were moved
  onto the real garment edges (nine of them sat on the old polygons' overshoot, i.e. on
  background); `scripts/menu-kit-shot.mjs` screenshots the three pictures in vivid forced colours.

- **v105.2 — the kit follows the team.** The kits are registered by palette — `"off"` is the
  user's team's colours, `"def"` the opponent's — but every marker was dressed by its SIDE, so on
  any play where the user's team was defending, the opponent's offense wore the user's colours
  and the user's defense the opponent's; v96 then dressed the you-player to match the wrong
  side, which is how a linebacker in a red-and-blue programme ended up watching the other team
  wear red and blue. A marker now carries its side (`m.team`, which the depth and gameplay rules
  keep reading) and its kit (`m.kit`, the palette it wears) separately, and the kit is chosen
  from possession (`kitForV105_2`). `scripts/kitsidecheck.mjs` watches a linebacker's game
  across both possessions and proves each eleven wears its own colours and the you-player his.

- **v105 — the ball has a handler.** The football used to appear in the quarterback's hand the
  instant the snap fired: before it the sprite sat on the sim's ground spot at the line, drawn
  OVER the center's waist, and `snap` simply switched the holder — so on the broadcast the QB
  started with it, and every exchange after that was the same one-frame teleport. Now the ball
  is always in somebody's hands or in the air between two pairs of them. While the offense jogs
  to the line it is **on the grass at the spot**, under everybody; when the center sets it is
  **under center**, at his feet; the snap is a **hand** — a zap from the center's spot to
  wherever the QB's hand is that frame, re-aimed every frame so a QB already dropping back still
  receives it; a handoff is a hand from the QB's hand to the back's, and a long one is a
  **toss**, on a higher arc, tumbling end over end. The **trail** is the motion itself: a
  tapered ribbon of the ball's last quarter second, drawn only while it genuinely travels — a
  gust for an ordinary ball, wound into a **double helix** in flight (the spiral), and
  **burning** — flame core, ember sparks — when the man who threw or carries it is HOT. Heat is
  bookkept per offense per actor at the end of every play: big gains and scores heat a man up,
  empty plays cool everyone down, `heatHot` is the line, and a man who crosses it says **ON
  FIRE!** when he next lines up with the ball. All render-only: no sim frame, stat or event is
  touched. **The default field perspective is now 78%** (was 45%), so most of the field is in
  the frame. And the main menu's kit masks were fixed but could not be SEEN: `index.html`
  pinned the menu files at `?v=v90` and the pictures carried no version at all, so any browser
  that had opened the menu once kept the old masks; the baked build stamp now rides every art
  URL (`?v=`), and `index.html` is re-baked. (Pages deploys from `main`, so a branch cannot
  show on the live link until it merges.) And because github.io caches `index.html` for minutes
  while a script URL that has rolled over is refetched, a phone can run the NEW menu script
  against the OLD stylesheet for a while — which, with the hero's art layer unknown to the old
  sheet, collapsed the hero and left the recoloured picture loose on the page at 1600px. The
  layer is now boxed by an inline style, `layoutArt` sizes off the framed section rather than
  the layer, and a picture with no crop to follow hides its copies instead; `menu-mask-check`
  runs a third context that serves the current sheet with that rule stripped and proves the
  kit still sits on the picture.

- **v104 — the number on the jersey.** The number a player wears was a flat text object at a
  hard-coded size and a hard-coded offset, guessed once against one pose and re-set on every
  marker on every frame. It showed. The **back number bled into the pants** — hung below the
  sprite's own centre, it landed on the waistband, so every up-facing man, idle or blocking,
  wore his number half on his trousers. And it was **sized in screen pixels while the body is
  scaled twice** (the perspective curve, then the per-position build — a nose tackle is a fifth
  wider and a sixth taller than a corner), so the same numerals read painted-on down one end of
  the field and oversized on a small defensive back at the other. Now **the art says where the
  number goes**: every player cell is scanned once, when its texture is cut, for the two kit
  bands the recolour already keys on — the **waistband** where the trousers take over, the
  **collar** where the helmet gives way to the pads, and the row where the jersey simply runs
  out (a lineman in a three-point stance has his legs tucked behind him, so his shirt ends at
  his elbows and the pants never show at all). Every pose, every facing, gets its own band. The
  number is then hung from that waist at a height held **constant in cell rows** — it cannot
  breathe through a run cycle — clamped so the ink can never reach either the pants or the
  collar, and multiplied by the body's own build so it is painted on the shirt rather than
  floating at a fixed size in front of it. The back number moved up onto the **shoulder blades**
  where it belongs. It is rasterized once at a larger size and scaled *down*, which is the sharp
  direction and also stops ~100 text canvases being re-rendered every tick, and it carries a thin
  dark outline so a white numeral still reads over a pale kit.
  **The kit on the main menu, too.** The team colours on the hero and the continue card go on
  through masks cut from the photographs, and those masks were cut wrong: the continue card's
  pants ran three percent wide of the hips on both sides, so the secondary colour landed on the
  crowd beside him; and the highlight key-outs meant to keep the floodlights off the shell were
  taking the sleeve hems and the helmet's lit rim with them, so those stayed grey. On the hero the
  tunnel light is warm enough that lit fabric keys like skin, so the whole lit right side —
  sleeve, hip, rim — was being cut. Every garment is now **traced on the real outline at 1%**, the
  hero carries polygons alone, the gap between the legs is open air rather than a filled hole, and
  the hero's picture, kit and name **breathe as one layer** (the tints used to sit still under a
  picture that scales by two percent every four seconds). `scripts/menu-mask-check.mjs` proves it
  on probe points off the pictures — mask alpha, then the live render at two sizes with and
  without the tint layers.

- **v103 — the grab, and everything it made possible.** A tackle used to be instantaneous: the
  wrap landed and the play was dead on that pixel, with the drive and the knock-back playing out
  afterwards as decoration on a spot already booked. Now a landed wrap opens a **GRIP** and the two
  men **travel together** — his legs still going, the tackler hanging on and being dragged — until
  the momentum is gone and they land. Where they land is the spot. It is a yard or so of real
  ground (never ten), and the fall-forward fudge it replaces was removed so the yard is not paid
  twice. Everything else grew out of that. Men **PILE ON**: anyone who gets hands on joins the heap
  and rides along, shortening the grip — though whether the stop is *booked* as assisted is still
  rolled on the old odds, so the solo/gang split holds. The ball gets **PUNCHED OUT** at the pile,
  and unlike the blind pre-roll it replaces, the sim NAMES who stripped it and who fell on it —
  and keeps its render log, so a fumble finally animates. A carrier inside a couple of yards of the
  marker **STRAINS** for it, which is where third-and-one is decided. Once in a while he **RIPS
  CLEAN OUT** of the wrap and the play is live again. A grab from dead behind can catch the
  **HORSE COLLAR**. **After the whistle the contact does not stop**: for most of a second the pile
  churns, the men holding on keep holding on, and anyone still closing arrives and shoves in before
  everybody lets go and gathers. **The line works**: offensive linemen block on every carry rather
  than only on called runs, and pick the man threatening the *ball* rather than the nearest body,
  sustaining the block instead of touching and releasing; defenders rip off their blocks and chase
  once the ball is past them. The picture keeps up — the drag is drawn with the pair locked and the
  turf coming up under them, camera shake and spray are scaled by the collision the sim actually
  measured, and the new moments get their callouts, their crowd and their slow motion.
  Two long-standing bugs fell out on the way: a blitzer whose blocker was pancaked deref'd null and
  killed the play, and **every time the engine reshaped a sim's yardage the matching render log was
  orphaned** — that play fell back to the legacy choreographer and none of the agent sim reached
  the screen. Retagging the log instead lifted the share of plays rendered from the real sim from
  57% to 80% on passes. **The lights are on the north side of the ground, and nowhere else.**
  v102 had mirrored the far bank to the near corners and stood one behind each touchline stand;
  both were drawn on the grass. The touchline pair was hopeless — those stands are diagonal
  billboards whose bounding box necessarily overhangs the playing surface, so anchoring inside it
  put a pole on the twenty — and the near pair, three times far-mast size and standing behind the
  camera, had its lamp banks drawn across the near-end turf. The whole mirrored bank is off at its
  dial's default now; the far four and the turf's own baked wash light the field, as in v98.
  The guard that keeps it that way is worth its own note, because the first attempt got it wrong:
  it tested a world rectangle, and the playing surface is not one. `PJ` **fans** it out toward the
  camera — some 400 scene px across at the far end line, **1200** at the near one — so art standing on
  the near-end grass sits outside `0..FW` × `NSTOP..NSTOP+NSH` and sailed through. `turfRowsV103`
  samples the real quad through `PJ` and `onTurfV103` walks a sprite's box against it, band by
  band, with a deliberately small tolerance (a pixel at the far end line is worth several yards of
  depth). Anything that would bleed is kept as a **light and not drawn** — its bloom dark with it,
  its beam and pool still falling on the grass, still shading the men and still breathing.
  `node scripts/v103check.mjs`.
- **v102 — the lights mirrored and breathing, the moment slowed, the menu alive.** Four masts stood
  behind the far bowl and nothing lit the near half. **Four mirrored masts** stand now — the far four's
  lateral positions carried through the crowd's own projection to the near corners (taller, because
  the near end is nearer; behind the camera most of the time, which is right — what you see of them
  is their light: pools on the near half, beams, and a fill shadow from the camera side for a man
  down there). (A pair behind the touchline stands shipped with v102 and was removed again — see
  v103 below.) All eight are real lights in the field the men are shaded by. And every lamp **breathes**: a few percent of slow, per-mast,
  multi-octave shimmer plus a rare **sputter** (one bulb dipping for a tenth of a second, a different
  sheet frame while it dips) — never the old six-frame strobe; the key light's position never moves,
  so shadows keep their direction and only their weight rides the breath. `lightLiveV102` at 0 puts
  the v99 stillness back. **The moment slows down**: the play is scripted before it runs, so the
  renderer reads the catch point, the juke, the stiff-arm, the hurdle, the truck, the big hit, the
  pancake, the pick and the score *ahead of time* and eases the clock DOWN into them (to 0.35–0.5×),
  holds through the beat, and eases back — a letterbox drops in with the clock, a gold ring pulls
  onto the men in the moment, a zoom punch lands on the beat. v37's reactive half-second is still
  there underneath. **The menu is alive**: five floodlights flicker on their own clocks on the hero's
  far rim, camera flashes pop across the stands and a shimmer runs the tiers, the player (and the
  helmet portrait) breathes, a sun with slow-turning rays burns at the tunnel mouth, dust lifts
  through the light on the wind and the swash flutters, and a sheen sweeps the wordmark through the
  wordmark's own mask. Reduced motion switches all of it off. `node scripts/v102check.mjs`.
- **v101 — one asset root, the playbook, the lead, the second shadow.** Seven things, one pass.
  **The blank players are fixed**: the sheets had drifted into two URL conventions — `/rib_x.png`
  (the server root) and `./public/rib_x.png` (the folder the deploy ships) — and neither is right
  everywhere, so on a `vite build` the drawn player sheet, the stadium lights, the badges and the
  whole menu bundle 404'd into an index.html fallback and every man on the field fell back to a
  blank. One resolver (`window.__RIB_ASSET`) now answers for all of them, against the document, so
  the same string works from a root, from a Pages sub-path, from `dist/` and from the Capacitor
  shell — and `vite build` mirrors `public/` so the two layouts finally agree.
  **The playbook is forty-two calls** instead of nine families: Counter Trey, Wham, Pin & Pull,
  Mesh, Y-Cross, Dagger, Yankee, Sluggo, the screens, the sneak. Each names its own **point of
  attack** (runs) or the **routes it is built out of** (passes), both fed straight into the
  FieldSim, and each is weighted by the situation — the goal line pulls Iso and the Sneak forward,
  third-and-long pulls the draw and the screens, a two-minute deficit pulls Four Verticals. The
  commentary says what was called. Every play still belongs to one of the nine original families,
  so nothing downstream had to learn a new vocabulary.
  **The throw is a guess about the future.** The ball used to be aimed at the receiver's last
  waypoint — a dot decided before he got near it. Now the quarterback walks him forward along his
  own route for as long as the ball will hang, re-times the flight to that further spot and walks
  him again; a lob needs a bigger lead than a bullet to the same window and that falls out of the
  solve. How much of that lead he actually gets on the ball is a separate skill, so a raw passer
  under pressure throws it **behind** him. The miss around the spot is the **cone**, and the cone
  is what the broadcast draws: it opens with pressure, panic, depth and a poor arm, and closes to
  a tight **green** wedge when the pocket holds and the receiver has won. Panic is its own live
  reading — it builds while someone is bearing down, jumps on a hit, bleeds off when the pocket
  cleans up, and composure sets both its slope and its ceiling.
  **Shading and shadows move.** A second, softer cast from a different mast fans away from the key
  light's, the key shadow **smears** along its own axis at a sprint, and the men are lit by the
  **lamp pools** rather than by a fixed grey depth ramp, so running through a pool warms a man and
  the gap between lamps cools him. v99's one-key-light geometry is untouched.
  **The loader stops being dead time**: the field mounts and the first play's whole script is
  choreographed *while* the chase is running, the loader is told when that finishes, and the door
  only opens once both are ready — so the fade-out crosses into live football instead of a blank
  field that then has to think. **The stands got a vocabulary**: every moment has its own emoji
  (💥 for a sack, 😡 for a flag, 🎉 for the score) and the shout bubbles carry one too, with fifteen
  more moments the crowd used to sit through in silence. And **the skills sheet prints whole
  points** — no row reads 13.4 → 12.8 any more. `node scripts/v101check.mjs`.
- **v100 — the lighting dial.** Settings › FIELD VIEW carries a **Lighting intensity** slider,
  0–200% in 5% steps. It is not a brightness filter over the finished picture — it is the
  strength of the light itself, so it moves everything the light is responsible for and nothing
  else: the wash and pools baked on the turf, the glow, beams and pools off the masts, the masts'
  own brightness, and how deep every shadow falls. Two details keep the ends of its travel
  honest — the falloff into the corners **deepens** as the lights come down (a dark stadium is
  not evenly dark), and shadows keep a floor of ambient weight at 0 so nobody floats off the
  grass with the floodlights out. The turf takes the whole dial on the way down and only part of
  it on the way up, so 200% reads as floodlit rather than as white paper. `node scripts/v100check.mjs`.
- **v99 — the shadows fall, from one light post.** Everything on the grass now casts a real
  shadow, and all of it from **one key light** — deliberately a mast that does not sway, read
  from its fixed base, so a shadow never wobbles or hunts between sources. Direction is the
  vector from that light to the object's feet, so shadows **swing around a man as he crosses
  the field** and rake the same way for everything on it. Length is the object's **own
  height** times a slope that opens with distance from the light: the **goalposts** lay a
  whole H across the end zone at the near end and barely mark the grass at the far one,
  a coach on the sideline throws a streak, a pylon almost nothing. A man **in the air** — a
  launched tackler, an official's flag hop — leaves his shadow **on the ground**, shrinking
  and softening under him, and a **ball in flight** runs out from under its own shadow, which
  is the one cue that says how high a throw really got. A man **on the ground** has no height
  left to cast. The **lamps hold** now: one frame per mast and one steady output instead of
  cycling, so the stadium light (and everything it casts) stays still. `shadowsV99=0` switches
  the whole cast off. Also: the coach-trust swing the post-game card quotes is now **binding** —
  the week is finalised against the number the player was shown, not a rating re-derived after
  Continue. `node scripts/v99check.mjs`.
- **v98 — under the lights, and the stands react.** The floodlight masts **stay put**: they
  stand on a fixed row above the far end line instead of the bowl's remeasured foot (the
  perspective re-anchors at every snap, and the masts used to hop with it), and **two of the
  four sway** slowly in the wind. Every lamp head carries a **glow, a beam onto the field and
  a pool on the turf**, all breathing on the mast's own phase; the turf itself is **lit** — a
  warm wash from the far end, a pool under each mast and a falloff into the near corners —
  and the sky above the stadium is **darker**. The live **scorebug wears the two kits'
  palettes** (ours left, theirs right, the score lifted from the primary, the secondary as a
  stripe) instead of green and red; the colour legend and the COACH TRUST / FAN HYPE bars are
  **gone** from the live screen. The **post-game card says what the coach made of it**
  (`COACH TRUST +2 · 50 → 52 · EARNED IT`), the exact swing that then lands. The **stands throw
  emoji** at the play — flames and raised hands for the home crowd's moments, groans and
  facepalms when it goes against them, more of them for the bigger plays. The **camera cuts to
  the new carrier** on a handoff, a catch, a pick or a fielded punt: a short re-frame that
  pans and zooms faster than the cruising follow and leads him the way the play is going.
  The **depth slider steps by 1%** (71, 72 … 90). `node scripts/v98check.mjs`.
- **v97 — the loader goes first, the palette's name, whole numbers, rare prestige, the 250
  wall, the fold, both end zones.** A live game now **loads, then runs**: the first play
  waits at the loader's door until the chase has run its exit. Every uniform palette in the
  team creator carries its **name** by the convention *Primary & Secondary* (Navy & Gold,
  Crimson & Silver). The skill menus show **whole numbers only**: the four combine clocks
  became speeds (Top speed, Shuttle speed, 3-cone speed, 10-yd burst, all in mph). **Prestige
  is rare and quiet**: a career-end pays a fifth of a star, and every bonus that scales on
  prestige (starting attributes, the potential ceiling, the ratings floor, the soft-cap share)
  reads a fifth of what it did. Every attribute meets **the 250 wall**: 250 was the absolute limit; it is a soft one now —
  the limit lifts to 999 and from 250 a point costs five times the band price. The **continue card's tint** now fills the whole helmet shell and
  both legs. A hub tab longer than the phone **folds** into an accordion (one tap opens a
  panel and folds the rest) and the upgrade sheet is **three folding groups** (Physical, Ball
  skills, Mental) instead of a seventeen-row wall. On the live field the far end zone says
  **TOUCHDOWN** in the user's colours and the near one wears **the opponent's name in the
  opponent's colours**, lettered to face their bench.
- **v96 — his own kit, a name of his own, the stat box, the read radius.** The you-player
  wears **his team's kit** now instead of a gold-and-navy one of his own — the plumbob is
  what marks him. The position screen lets you **name him**: the rolled name is a starting
  point in an editable field with a 🎲 to roll another. The live **stat box** carries the
  not-crucial stats under the three big tiles (CAR / AVG / LONG / FUM, TGT / REC, TFL / QB
  HIT / FF...), refreshed every play. **Field vision is a radius**: from 75 every point reads
  a yard further down the line (75 → 1, 76 → 2, 77 → 3...), the back's lane read projects
  the defenders that much further ahead, and the sheet quotes it. The chase loading screen
  is **smaller**, defenders **come in from the angles** on every sprint and recovery (dive,
  miss, get up, jog out), and at the goal line he **runs straight through the shot** instead
  of celebrating; the live game's loader opens its door at the first quiet beat.
- **v95 — the callout wall.** The big moments are drawn badges now, not a line of
  Oswald over the turf: TOUCHDOWN, TURNOVER, FIELD GOAL, GAME CHANGER, FIRST DOWN, 4TH
  DOWN, GOAL LINE, MISSED, INTERCEPTED, FUMBLE, FLAG, BIG PLAY, BREAKAWAY, SACK and BIG
  HIT (`art/badges/`, cut by `scripts/build-badge-art.py` into `public/badges/`). It is a
  presentation system, data-driven from `BADGE_BOOK_V95`: **tier 1** takes the screen
  over (an impact freeze, a camera punch, the field dims, rays turn behind the badge as it
  slams in, confetti or sparks leave its edges, the crowd flash, slow motion underneath, a
  fast zoom out); **tier 2** is a directional stinger with its own motion — a streak, a
  wobble with the ball spinning loose, a flag that whips on first, a slam from below, speed
  lines, a crush from above, a one-frame flash with a shockwave — entering from the side
  the play happened on and sitting clear of the carrier; **tier 3** is a scorebug panel with
  its context ("18-yard reception", "2 yards to go", "Ball on the 2", "47-yard attempt").
  A badge with a field position first flashes small over the player and flies to its
  mark. Related badges **promote** instead of stacking: INTERCEPTED flips into TURNOVER,
  then into TOUCHDOWN captioned PICK SIX; BIG PLAY +38 into TOUCHDOWN. One queue: a bigger
  moment cuts in, a smaller one waits or is dropped, a moment fires once. Short synthesised
  stingers on the sound setting. `scripts/badgecheck.mjs` covers the files, the queue and a
  live run.
- **v94 — the chase.** The loading screen is a play. A ball carrier in the you-kit sprints
  across a strip of turf with a defender on his heels, drawn on a plain canvas from the v91
  field sheet while the Phaser bundle is still parsing: he looks back over his shoulder, the
  defender bursts, he plants and cuts a lane over (the defender dives, eats turf and gets up
  through the drawn get-up) or **spins** through four facings (the defender grabs air and
  staggers), the defender catches back up, and it goes again — the beats roll each load, and
  the door never opens before one **full cycle** has played. The **exit is the touchdown**:
  the end zone paints in, the last dive misses, he crosses, the chalk flashes, confetti, the
  celebration, the fade. Around them: stands with a parallax crowd, yard numbers, a camera
  that bobs with the stride and shakes on the dive, speed lines at full tilt, afterimages
  through the cut and the spin, grass tufts off the plant, chalk captions calling the beat
  ("LOOKS BACK...", "SPIN MOVE!", "HE'S GONE"), and the ball **tucked behind the far arm** —
  a sliver of leather, not a spinning prop. The run cycle is locked to the ground covered
  rather than a timer, so a faster man's legs turn faster, no foot slides, and the body
  lifts and leans with the stride; an exclamation pip pops over his head whenever the
  defender is on his heels. The same engine is the **live game's loader**:
  when a live game opens, the chase runs over the field with the matchup ("STORM vs
  RANGERS · TAKING THE FIELD") until the broadcast scene is up, then plays its touchdown
  and fades. Reduced motion draws one posed frame; a sheet that never lands keeps the old
  football and the old timing. `scripts/splashcheck.mjs` boots three ways and drives into a
  live game.
- **v93 — the home end zones.** The field says whose ground it is. Every week is a
  fixture now: week 1 at home, alternating (playoffs alternate by round), and the
  schedule reads `vs` or `@`. Both end zones are painted in the **home team's colours
  with the home team's name** — yours at home, the opponent's (the same palette their
  jerseys wear) on the road, the near one upside down as on the art — replacing the
  shipped navy TOUCHDOWN / END ZONE bands. The paint goes on the flat field art next to
  the midfield crest, so the perspective warp carries it like the turf.
  `scripts/v93check.mjs` asserts the schedule, the paint at home and away on the flat
  art and on the broadcast field, and the lettering.
- **v92 — the lights, the big screen, real posts, whole numbers.** The dark band v57
  painted above the far end line now holds a stadium: **four floodlight towers** from the
  uploaded lights sheet (`art/field/lights.png`, cut by `scripts/build-stadium-art.mjs` into
  `public/rib_lights_v92.png`) stand behind the far bowl with their masts hidden by the
  crowd and their lamp heads in the sky, turned in toward the field and breathing through
  the sheet's six frames; and a **big screen** hangs centred above the far stand carrying a
  second Phaser camera, the broadcast feed following the ball, which **freezes on the whistle
  into a replay still** (a snapshot of the feed's own pixels, with a slow push-in) and goes
  live again at the snap. Both are placed from the bowl sections the crowd builder just
  built, so they ride the same perspective, and the feed camera switches itself off whenever
  the screen is out of the main camera's frame. The **goalposts** stand at real proportions
  (crossbar on a post, uprights five times taller than before; the field-goal highlight lights
  the same posts). And **every number the player reads is whole**: the stat formatter, the
  box-score averages, the training board's "+0.8 to +1", injury risk, percentiles, the body
  sheet, the roster averages, money, ranks and the prestige multipliers (now "+55%", not
  "×1.55") all round, and the prestige-shop copy says "half a percent" instead of "+0.5%".
  The four sprint times on the attribute sheet keep their hundredths, because a whole-second
  forty is not a number. `scripts/v92check.mjs` asserts the stadium's geometry, the feed
  camera, the replay still, the posts, and walks every career screen failing on any decimal.
  `?noV92` runs the sky as it was.
- **v91 — the field sheets.** Eight hand-drawn sheets in the game's own chibi style
  (`art/field/`) are cut by `scripts/build-field-art.mjs` into one 48px-cell atlas,
  `public/rib_field_v91.png`, whose cells are named in the renderer's vocabulary so the
  existing per-team recolour registers them by the names it already asks for. What
  changed on the field: an **eight-frame run cycle at five facings** (the sheet's eight;
  the renderer mirrors the rest) with a drawn plant, cut, dive and fall per facing; an
  **eight-frame directional get-up** that replaces the crouch-then-stand recovery after
  every tackle; a **four-frame celebration** the scorer plays for two and a half seconds
  after a touchdown; hurt and walk frames per facing; catch frames per facing from the
  catch sheet; and a **football drawn from the sheet**, a spiral whose laces turn through
  twelve frames while the sprite rotates by heading minus each frame's drawn tilt, and an
  end-over-end tumble on kicks and loose balls, replacing the procedural container. The
  sheet loads on its own clock like the crowd and the sideline, so until it lands the v22
  overlay and the baked atlas stand exactly as before. `scripts/v91check.mjs` drives a
  live game and asserts the atlas decoded and registered for every team, the recolour
  reached the new art, and the renderer actually used the new states. **v91.1** after
  the first look ("worse, especially the QB"): the idle is the get-up sheet's standing
  frame, an upright man with his arms at his sides, not the run sheet's plant (a crouch
  with a dust cloud that read as a scramble under every quarterback); the cells are cut
  with a box filter, sharpened and their alpha hardened so the edges are pixel edges
  like the old atlas rather than a soft fringe, at the old atlas's figure height; the
  sheets' orange pants are keyed into the recolour's gold band so the defence wears its
  secondary instead of tan; the celebration outranks the unpile; and `?noV91` on the URL
  runs the field without the sheet for a side-by-side. Not wired yet:
  the two-body tackle sequences (the renderer draws each man separately, so they need a
  composite pass), the sixteen helmet angles and the layered kit sheet.

- **v90 — the rolls happen in the background.** At the NFL a story arc queues a stage
  every few games, and each stage wanted a choice and a dice roll before sim-the-rest
  would continue, so a season could not be skipped. On the silent path the choice is now
  made by a rule (`TU("autoStoryStyle",0)`: 0 takes the safest option, 1 the boldest) and
  the roll is the game's own roll, so the arc advances exactly as if the card had been
  clicked. Every roll is written on the week (`autoRollsV90`) and counted in the toast
  (`3 story rolls: 2 up, 1 down`), so nothing is hidden, only unattended; quick play,
  where the player is present, still shows the card. The upgrade sheet shows whole
  numbers and spending a point lands on a whole number (growth leaves attributes
  fractional; 41.37 showed as 41.37000001 and became 42.37). The menu's OVR ring fills
  `ovr/250` of the circle, since ratings run past 99. The continue card's jersey wears
  the name on the upper back and a larger, sharper block number.
  **The kit colour is a recolour, not a blend.** The team tint is now a masked duplicate of
  the photograph with a CSS filter chain derived from the team colour (grey it, sepia it,
  swing the hue, then set saturation and brightness from the colour), so the shell's
  curvature and the fabric's folds come from the picture itself and nothing depends on
  compositor blend-mode support, which is where a phone can silently draw no colour at
  all. The blend-layer path stays behind `?blendTint` for comparison.

- **v89.7 — the first screen is the six choices.** The archetype and the quote leave the
  player card for one compact strip at the foot of the page, and the six tiles move up
  to sit directly under the card, so on load a phone shows the hero, the helmet card and
  all six choices without scrolling. The jersey numbers wear a varsity block face
  (Graduate, served from the menu's own sheet), the continue card's player carries the
  same name and number as the hero, and its shoulder pads are polygon-only in the
  mask like the hero's. The helmet emblem sits higher on the shell, tilted with it, and
  carries a shading layer masked by its own sprite so it is lit the way the shell is.
  The wordmark is darkened to sit in the tunnel's light, the swash moves a touch right,
  and the tagline is gone.

- **v89.6 — nothing bleeds.** The hero helmet's far edge sits inside the shell and its
  mask is eroded a step further than the cloth, since a feathered edge over the bright
  tunnel mouth read as a halo in the team colour. `scripts/build-menu-art.py` now
  asserts, on every build, that every finished mask is fully transparent outside the
  traced body (it reports the worst alpha it found; the build fails above 8 of 255), so
  colour cannot leave the player without the build saying so. Shading reviewed at full
  size in both palettes: the fabric's folds, the shadow across the back and the printed
  number all survive the tint.

- **v89.5 — the kit, cut properly.** The silhouette masks are rebuilt on the real
  outline: every garment polygon is placed on a 2% grid over the picture, the shoulder
  pads are polygons with no colour key at all (a tan pad in warm shadow keys exactly
  like an arm, and no arm lies inside a pad), the torso keeps a skin key that uses
  chroma and luminance together so shadowed fabric is never mistaken for skin, and
  any pocket a garment encloses is filled outright. Every garment is then clipped to a
  traced full-body silhouette, so colour cannot leave the player even where a polygon
  is a hair off. Masks are cut at half resolution with a tighter close, so their edge
  is a line rather than a stair, and the tint strength sits between the two settings
  tried before. The lit strip between arm and torso is keyed out by brightness below
  the pad line. Judged in crimson and gold with `scripts/kitshot.mjs`, and in the
  overlay diagnostics that paint each mask over the art with the body outline drawn.

- **v89.4 — the kit stays on the player.** The team tint is confined to the uniform
  by silhouette masks cut from each photograph's own pixels (`hero_mask_p/_s`,
  `card_continue_mask_p/_s`, `portrait_helmet_mask_s` in `public/menu/`), built by
  `scripts/build-menu-art.mjs`: a hand-placed polygon per garment, keyed inside so
  skin and the lit background between arm and torso stay out, eroded inward so a
  feathered edge never glows over a bright background. The jersey and its shoulder
  pads wear the primary, the helmet and pants the secondary, on the hero, the portrait
  and the continue card. The mask URL is set inline on the element, because a `url()`
  inside a custom property resolves against the stylesheet in Chrome and the document
  in Firefox. The painted wall slogan is lifted with a masked overlay so it reads on a
  phone, and the emblem sits on the upper shell of the portrait helmet.
  `scripts/kitshot.mjs` renders the kit in crimson and gold, which is how the leaks
  the default slate palette had hidden were found.

- **v89.3 — the wordmark on the wall, a kit in team colours.** The drawn wordmark
  now lies on the left tunnel wall: its far edge recedes toward the mouth and the
  block climbs, mirroring the paint on the right wall, with the swash under it and
  the tagline below, the whole block pulled left and away from the player. The name
  and number on the back are printed on the fabric rather than laid over it: a
  hard-light blend with a gradient fill lets the folds and the shadow of the jersey
  show through the lettering. The team tint is a kit now, not a wash — every tint is
  two layers, a hue layer (`mix-blend-mode: color`) that colours the white and grey
  fabric while keeping its lighting and a multiply layer that deepens it — and it is
  applied as a uniform: the jersey wears the primary, the helmet and pants the
  secondary, on the hero, the portrait and the continue card alike.

- **v89.2 — the art lands.** The four pieces v89.1 could not fix in code are in:
  the drawn wordmark (chrome RUNNING over gold IT BACK) replaces the CSS type in
  the hero, the tagline sits on a real pair of gold swashes, the tunnel photograph
  now carries DISCIPLINE BUILDS FREEDOM painted on its wall in perspective (so the
  menu no longer floats that text over the scene), and the legacy panel wears six
  drawn icons instead of hand-cut SVG paths. `scripts/build-menu-art.mjs` is the
  pipeline: it cuts every shipped `public/menu/*.webp` from the originals in
  `art/menu/`, cropping badges to their coin, icons to their own alpha, eroding the
  matting fringe off the swash, and downscaling the photographs. Re-run it after
  dropping new art in. The crop maths now reads `object-position` from the
  stylesheet rather than a duplicated data attribute, so a tint can no longer drift
  from the picture it tints.

- **v89.1 — the menu against the reference, everything that was not art.** A pass
  comparing the built menu with the mockup, fixing the code half of the gap. The
  jersey name and number now sit on the player's back in jersey white with an
  outline and a slight perspective, instead of floating in the team's accent colour.
  The prestige chip moved off the tunnel floor into the top bar, where the reference
  keeps its chrome. The helmet portrait and the trait medallions are re-cut from the
  same source art: the helmet now fills its frame and each badge is a tight round
  coin rather than a small disc adrift in its own glow. A flaw no longer wears a gold
  badge (`good: -1` is truthy, so Glass Bones was being presented as a strength); the
  card falls back to position perks. The OVR ring keeps a visible track and a minimum
  arc, so a young player is a dial rather than an empty hole. The quote varies per
  player instead of once per origin, and the signature is a real hand (Caveat, served
  from the menu's own sheet so the game's typography is untouched). Milestones now
  lead with this season's concrete goals and carry the date each one was met, from a
  new `objectiveStampsV89` record. The season card fills its row, a sat-out week says
  DID NOT PLAY instead of showing a dash and three zeroes, a loss is a colour rather
  than a red cross, the legacy tiles stretch to fill and their labels fit on one line,
  the trophy plate sits on the trophy's base, and the footer is a signature line
  again. Still outstanding, because they need art: the logo lockup, the painted wall
  slogan, the tagline swash and the six legacy icons.

- **v89 — the main menu, from the Bible.** The main menu is rebuilt to the reference
  mockup (`art/menu/bible.jpg`) with the art the mockup was made from: a top bar with
  the brand and the nav (HOME · CAREER · GOALS · HALL · LEADERBOARDS · SETTINGS), the
  tunnel hero with the title, the player card (helmet portrait with the team emblem,
  name / position / number / height / weight, stars, the OVR ring, archetype with three
  gold trait badges, a per-origin quote signed by the player), Continue Career (year,
  week, next opponent, record), Season Progress (a dot per game, wins / losses / sat-out,
  the latest game with a position-aware stat line), Your Legacy (prestige, careers, NFL
  reached, interstellar, hall points, iconic moments), Career Milestones (the objectives:
  three done, the rest pending with their legacy-point reward), six tiles and a footer.
  Every number comes from the game's own feed, `window.__RIB_MENU_DATA_V89`, not a text
  scrape; team colors tint the jersey and the helmet in the art through a multiply mask
  placed in picture pixels, and the jersey number is stable per name. Phones stack in
  reading order; tablets and wider go two-column. Originals live in `art/menu/` (the ten
  component sheets in `art/ui/` for reference), the shipped copies are downscaled WebP in
  `public/menu/` (249 KB in total). The old sheets and blob-URL asset runtime are gone.
  `scripts/menu-integration-check.mjs` and `menushot.mjs` are rewritten for the new
  structure. The Pages deploy verifies the v89 files (it asserted the deleted
  `rib-menu-assets.css` and failed, so nothing published); the three old source
  sprite sheets nothing loads any more moved to `art/ui/` and left the deploy.

- **v88 — the call-up follows the ranking.** A national #1 by double the stats could
  post a stellar year and still be left out of the league, because the declare roll
  used a synthetic season rating (`qt` without the season) and the national-rank
  floor at the combine wanted the top 0.3% of 1,500 — rank 4 or better — before the
  ranking counted for anything. One curve now answers every screen: your national
  rank against the SHARE of this level's pool that actually moves up (`ADV_V88`: 9%
  of college reaches the combine, about a third of the combine sticks, a handful of
  the league gets the interstellar call). #1 in the country is ~98%, a top-100
  finish is 90%+, the last man inside the share is a coin flip, well outside it is
  single digits, and the rating roll still stands as a floor for a player whose
  numbers beat his rank. The hub card, the season screen and the roll itself all
  read `declareChanceV88`, so the number you saw is the number that decides, and the
  card now names your rank. `scripts/v88check.mjs` asserts the curve and the
  integration. Dials: `advShareK`, `advSoft`.

- **v87 — credit by alignment, the huddle, the posts, the safety, and a quarterback who
  sees the lane.** Playing WR or LB you were being credited for other people's
  plays, and the fix was in three places. The engine handed the sim a "cover" pick
  that was YOUR defender 45% of the time whatever your position, and the sim put
  that man on the target — so a linebacker "covered" go routes and the tackle after
  the catch was truthfully yours. Pass break-ups were a second 60% roll, the run
  fumble a 45% roll, and pressured passes skipped the sim entirely. Now the man on
  the target is the coverage defender aligned closest to him at the snap, the
  engine's pick never names you, a break-up on your sheet is a swat the sim named
  you for, the legacy fumble names nobody, and pressured passes go through the sim.
  On screen, the legacy choreography featured a RANDOM body of your position and
  made you the tackler on every defensive snap: the featured body is now your slot
  and the fallback only animates you making the play when the book says you did.
  Then four additions: both sides HUDDLE on the way to the line (the offense seven
  yards back around the QB, the defense five yards on its side; hold, break, jog —
  skipped for kicks and the hurry-up), GOALPOSTS stand at both end lines every snap,
  a SAFETY is scored when a play ends behind the goal line (two points, a free kick
  to the other side), and the QB SCRAMBLES ON OPPORTUNITY — nothing open and no
  unblocked defender in the lane ahead of him is a run (a spy makes him think
  twice), booked like a scramble with the tackler named by the sim — and never
  throws to a target behind him: a back still in protection is not the check-down,
  he finds a man ahead or throws it away. `scripts/v87check.mjs` measures all of it.

- **v86 — between the whistles: seven animations, no new art.** Live frames showed
  the play was mostly right and the moments around it were wrong: both lines
  frozen at the old line of scrimmage while the run ended 25 yards away, a tackle
  that ended as a static pile until the next glide, 22 statues before every snap.
  Everything here is built from frames the sheets already carry plus tweens and the
  graphics layer the renderer already draws dust with, and none of it touches the
  sim. (1) POST-PLAY: the whistle opens a short phase (`postPlayMs`) in which the
  pile unpiles — tackler first with a push-off, carrier a beat later — the ball is
  left at the spot for the crew, and everyone jogs toward the ball on his own side
  of it. (2) PRE-SNAP: the QB looks down the line and claps, receivers look in for
  the signal and turn back upfield, the defensive front sways in its stance while
  the offensive line holds dead still. (3) THE QB: a dropback is drawn as a
  backpedal facing the line, he hitches when he settles, a scramble leans into the
  run, and a scramble caught past the line slides with the tackler pulling up.
  (4) TACKLE STYLES from the geometry the sim resolved: caught from behind is a
  drag-down, met square with knock-back is a knock-back, low or from the side at
  speed is a fall forward; the plain fold remains. (5) THE BALL IN THE AIR: the
  target runs with his head turned to the ball, and a tipped ball pulls every
  nearby body into a reach. (6) FIELD WEAR + SHADOWS: tackles, piles, cuts and every
  snap wear the turf, stored in field space and re-projected each snap; player
  shadows stretch and drift a little further each quarter. `scripts/v86check.mjs`
  watches a live game and measures all of it (the 22 men are closer to the ball at
  the end of a post-play phase than at the whistle).

- **v85 — ratings past 99, the wheel in the background, the body on the sheet, and
  the season ahead.** Four things the career screens were not saying. (1) OVR is
  open-ended everywhere, on the same curve: the you-player's `en()` already ran past
  99 (Transcendent 100+, Interstellar 140+, GALAXY-CLASS 180+) but every roster
  player, team rating, rival, the scoreboard pair (`teamPairV76`), the v15.7 exact
  rosters and the "Reach N OVR" goal were clamped at 99, so a prestiged career read
  a league of 99s by college. The clamps are lifted (the sim-side attribute
  generator in `Wr` keeps its own 5–99 range, so play balance is untouched) and the
  menu's OVR ring shows the number as it is. (2) A quick-played week and "Sim
  Remaining Regular Season" now roll the v51 plan wheel with nothing drawn:
  `decidePlan` (the wheel's own math, split out of `rollPlan`) picks the plan by
  personality and rolls the fit band, `applyDecision` composes the swing, and the
  pick goes through `chooseGamePlanV11` so the v50 fate roll and `ca()` book the
  week exactly as a played week is booked — engine stat line, plan, condition,
  injuries materialised. The schedule row carries a chip saying what the wheel did
  (🎡 RED ZONE PACKAGE · CLICKED). A watched live game now overwrites the game
  `ca()` pre-booked (`bookLiveGameV85`): the box score you saw is the one the season
  counts, and the rating moves by the difference in grade. (3) The attribute sheet
  shows what you take onto the field: every attribute has its EFFECTIVE value for
  the next game (`condMultV54` — worn or hurt −10%, fresh +5% — plus the wheel's
  swing) in red or green with the cut drawn on the track, under an injury-risk
  badge (% this game, games expected missed, fatigue) read off `bodyLedgerV73`. The
  pregame YOUR STATS list carries the same. (4) Every attribute also shows where the
  season is taking it: `projectSeasonGainsV85` runs the season resolver's own gain
  formula as an expected value from the current training program, the games played
  and the games left (no dice), drawn as a hollow green extension with a `▹+N`
  label. The offseason training board uses the same projection: each program now
  states flat expected gains for the season ("FOCUS STATS +3 to +4 · OTHERS +1",
  a `+N` on every focus chip) instead of "PRIORITY +10%", which read as nothing
  once attributes ran into the hundreds. `scripts/v85check.mjs` asserts all of it
  against the game.

- **v84 — the main menu is one kit.** The v74 menu was art-driven but read as pieces
  from different kits: thick gold picture-frames around the cards, brushed-metal nav
  tiles with border-image corners, line icons beside 3D icons, a black band between
  the stadium floor and the tagline, and a HUD in its own black bar.
  `public/rib-menu-v84.css` (loaded last by the bake) turns it into one system: dark
  glass panels with a 1px gold hairline and an inner top-light, one radius scale and
  one spacing rhythm, gold reserved for hairlines, the numbers that matter and the
  single CTA surface; the hero bleeds under a frosted, transparent HUD and its
  stadium band is cropped so the floor melts into the page; the tagline is a
  small-caps rule; the OVR dial is a pure-CSS ring with the live arc; the legacy grid
  is six quiet tiles with every icon from the same 3D sheet (CAREERS and NFL REACHED
  take the helmet and shield the nav buttons already cut); the secondary row and the
  nav strip share one glass pill; the shine sweep is CTA-only; and a footer line
  finishes the screen without adding height the fit check would count. The DOM is
  untouched and `menu-integration-check.mjs` passes as is. `scripts/menushot.mjs`
  captures the live menu at any set of phone sizes.

- **v83 — blockers square up to their man, and both bodies read.** The renderer
  used to hold an engaged lineman on his pre-snap facing for the whole block, so a
  guard washing his man sideways or a tight end sealing an end was drawn square to
  the line; and an engaged pair stood on one screen column with the nearer sprite
  hiding the other. The sim now announces who has hands on whom (`engage` at the
  snap, `block` / `blockWin` / `pickup` / `chip` as blocks land, `shed` / `swim` /
  `pancake` / `stuntWin` / `disengage` as they end) and each man in a pair FACES his
  partner every frame — the up, down or side block frames by the direction to him
  — with the block frames cycling faster while the pair is moving (a drive or a
  wash, `blockDriveFrameMs`) than in a stalemate. Paired sprites are nudged apart
  laterally on screen (`engageSpread`) and the offensive man lifts a hair in depth
  (`engageLift`), so the lineman no longer vanishes under the defender the sim
  glues a few px downfield of him. Anchor `v83 BLOCK FACING + 2.5D`;
  `scripts/readshot.mjs` now also captures a trench frame (`_read_block.png`).

- **v82 — ten more ways the sim reads like football.** THE FRONT HAS A PLAN:
  the pass rush runs TWISTS (the interior man crashes outside, the edge loops
  into the vacated lane; the line has to pass it off — `passOffBase` — or the
  looper comes free), a SPY mirrors a mobile quarterback instead of dropping,
  and the offence answers with a PROTECTION CALL (the centre reads the blitz
  side and slides; read it wrong and the back is alone from the wrong side) and
  a CHIP from the tight end. DISGUISE: safeties show two-high and ROTATE one
  down as a robber after the snap (a quarterback who graded his reads off the
  old picture and does not see it — awareness — loses the window), and corners
  PRESS and jam the release. THE POCKET: the quarterback steps up into edge
  pressure instead of sliding into the other edge, runs designed ROLLOUTS, and a
  smart one TAKES THE SACK with nothing open and a man on him — booked like a
  trench sack, sacker named by the sim. BALL SKILLS: box-outs, working back to
  an underthrown ball, and a corner who plays the hands (a SWAT) or the ball.
  CONTACT: a glancing hit can BOUNCE off the runner while the tackler goes down
  reaching, and a late man adds his push to the PILE after the whistle. EFFORT:
  a man who has lost the footrace or is on the far side with the ball going
  away JOGS; an empty tank costs a step. THE BACK HAS EYES: gaps are judged by
  where defenders WILL be (their committed lines projected), a gap behind a
  blocker who has his man is the one to press, and a closed hole is bounced.
  LEVERAGE: a won block only washes the man away from the hole if the blocker
  gets his head across — a lost reach seals him INTO it. SPECIAL TEAMS run on
  the engine: punts, kickoffs and field goals are agent plays (the long snap,
  protection against a real rush, blocks when a free man reaches the kick point,
  the kick's own flight, coverage lanes narrowing on the returner, gunners vs
  jammers, a fair catch when the coverage is on him, a wedge, the return and
  the tackle) and the broadcast renders them from their logs — kickoffs are now
  plays in the drive log. The game engine keeps its level-scaled leg and its rare
  rolls; the sim decides the block, the fair catch and the return. Balance: a
  back who has already made two men miss finds the third one gets him
  (`evadeRepeatK`), which is what let elite and ordinary backs share one set of
  dials. Special-teams tackles are not booked to the box score. Every system is
  asserted by `scripts/readcheck.mjs`; `gamerunprobe.mjs` reads the in-game
  balance and `readshot.mjs` captures the broadcast.

- **v81 — the defence has to FIND the ball.** Every defender used to know who had
  it the instant the sim did: the carry loop handed all eleven the carrier's exact
  position every tick, so the whole defence converged like it had read the play
  sheet. Now each man reads KEYS on his own clock (`_readMs`, awareness-led, with
  position and a jitter) and plays his assignment until he has diagnosed the
  play — linebackers hold their gap with a read step, then FIT downhill at the
  line before they chase; the play-side safety fills the alley while the other
  stays over the top as the roof; the force corner squats on the edge; a freed
  rusher chases what he can see. Once the ball is past the line it is in plain
  sight and everyone goes looking for a job. Fakes move the moment the play
  declares itself: a DRAW drops the QB and pass-sets the line before the late
  mesh, PLAY ACTION rides a real fake to the back, and a linebacker or safety
  who BITES steps the wrong way first (`fakeBiteBase`, cut by awareness and
  discipline) and finds the ball later. Play action pays out on the reveal
  (`paBiteSep`, `paVacateSep`) and the play-caller calls it on early downs
  (`paRate`). Pursuit runs COMMITTED LINES: a chaser picks an intercept point and
  runs his line to it, re-reading on an awareness clock (`angleRefreshMs`), so a
  cut or a bounce leaves the bad slant you can see. THE POINT OF ATTACK: a run has
  a designated hole (the concept picks the gap), each lineman rolls his block at
  the mesh — stalemate / push / drive / lost / the rare PANCAKE — and won blocks
  wash their men away from the hole so the gap visibly opens (`holeOpen`); the
  back attacks the hole first and reads from there; linemen release once the
  ball is past them and climb to the next man, the TE and receivers stalk-block,
  and the backside receiver runs his corner off. Two latent bugs surfaced by the
  spacing: a released lineman trailing the play could hold the "committed
  tackler" role and the support rule then held every other defender a stride
  off the runner (untouched 80s) — the role now needs a closing, moving man and
  drops when he falls off; and the v16.3 per-tick pancake rate flattened someone
  on a third of a dominant line's snaps (`pancakeTickK`). On screen: a "?" floats
  over each defender still reading and drops the tick he finds it, bites,
  driven blocks and the lane pop, and the you-player's own reads are called out.
  Guarded by `scripts/readcheck.mjs` (pure Node, no server).

- **v80 — the ball reaches the boundary, and the sideline watches it get there.**
  Two fixes, one cause each. LATERAL CALIBRATION: the field art draws its
  painted touchlines to true scale, ~16% wider than the raw lateral map put the
  sim's F_TOP/F_BOT — a carrier "stepped out" four yards inside the painted
  boundary. v72 reconciled art and world vertically (by goal lines) and never
  laterally; `latCal` (1.16, inside PJ/crowdProject — the one place
  world-lateral becomes screen-x) is the missing counterpart, so the sim's
  boundary now lands ON the painted line at every depth, within the line's own
  stroke width on both banks. The world stretches to meet the art, not the
  reverse: the art, the yard numbers and the crowd mapping are untouched, and
  `sidelinecheck`'s luminance probe (`sidePaintHalf` = 206 = the sim
  half-width, now equal by construction) fails if the two ever drift apart.
  FACING: `crowdProject` carries no VDIR mirror — a bank's screen side IS its
  world side, always — but the v79 facing logic "corrected" for a camera swing
  that never reaches the sideline, so every profile and every three-quarter
  face spent half of each game turned away from the football. The VDIR terms
  are gone: sitters, standing backups, coaches, trainers and all directional
  furniture now open toward the field from both banks in both possession
  states, and the check asserts the mirror by SIGN per bank ("they differ" was
  also true when both faced away).

- **v79.2 — the painted line is the line.** The field art paints its touchline
  ~35 world units OUTSIDE the sim's F_TOP/F_BOT — the sim plays inside a
  slightly narrower field than the art draws (the rows were reconciled in v72,
  the columns never were). The sideline was anchored on the SIM's line, which
  parked the whole team area visibly on the painted playing surface, and the
  v79 turf border painted a phantom second boundary in the grass between the
  two lines. Everything now measures from `sidePaintHalf` (240.5 world units,
  measured off the warp canvas, constant in depth because art and projection
  share the same k): the lanes, the chain crew, the yardage markers, the
  coaches' box and kit shade, and the pylons — which stand ON the painted
  corners, the one sprite allowed to. The phantom border is deleted. And it is
  now guaranteed, not just laid out: every sprite placement clamps outboard
  until its whole drawn BOX clears the painted line, and `sidelinecheck`
  measures the worst overhang in screen pixels across all ~175 sprites (worst
  offender after the clamp: −6px, i.e. six pixels of daylight).

- **v79 — sideline light & life.** v78 proved the team area; v79 makes it sit in
  the stadium instead of on it. Every sprite now casts a contact shadow and runs
  through the SAME lighting the players get — the v29 depth falloff and ball
  spotlight — plus the crowd's aerial fade and bank shade, so the band no longer
  reads brighter than the game either side of it. The turf itself gets the frame
  a team area needs: warpField paints the white boundary border, the dashed
  coaches' box and a grounding shade under the equipment row (all three are
  ground, so they ride the row loop the stands cannot). The benches are occupied
  and everyone is WATCHING THE FIELD: seating is compact two-seaters, stools and
  chairs repeated down the lane (the five-man bench sheets are drawn in full side
  view, and laid as billboards they ran ACROSS a lane that runs up the screen —
  furniture angled ninety degrees wrong, so they stay in the trunk), and every
  sitter rides his own seat's field depth, cropped at the knee so he ends at the
  seat line, in profile facing the touchline. Standing backups watch in profile
  too (one in five turned away — a sideline that ALL faces one way reads as a
  paper doll chain), and every piece of three-quarter art (benches, racks,
  carts, tables) mirrors per bank so its open side faces the field from either
  sideline, whichever end the camera shoots from. The sideline is alive: fireEvent feeds it the same play the crowd hears
  and a touchdown scales the idle sway into a bench-clearing bounce; a carrier
  heading out of bounds scatters the boundary figures near his landing spot; a
  knot of coaches and backups is anchored to the LOS and walks the line with the
  drive; and Yr's weather roll finally reaches the renderer (`__WX_V79`) — rain
  breaks out ponchos and strikes the towel service, snow doubles the heaters and
  sends the fans away. Tidy-ups: staff jackets recolor to each team's primary by
  masking the drawn navy only (khakis and skin never tint, which is what
  multiplying the whole sprite would do); clustered placement replaces the ruled
  rows; a separation pass stops trunks intersecting; far-end props under ~4px
  are culled instead of rendering as mush; bob phases are seeded, so a snap
  rebuild no longer teleports every figure mid-sway; and the layout seed
  includes the season week, so every stadium stops laying out identically.
  All render-only. `scripts/sidelinecheck.mjs` grew a v79 section covering every
  claim above.

- **v78 — the sideline is a sideline.** v57 cut an apron between the touchline and
  the stands and called it "the team area … so a later system can populate it".
  This is that system. Five uploaded sheets (coaches, trainers, benches, hydration,
  medical, equipment racks, storage, coaching tech, the chain crew's markers) are
  packed into one atlas by `scripts/spritekit/pack_sideline.mjs` and laid out in
  three CATEGORISED lanes running outward from the line: the boundary the coaches
  work and the backups watch from, the bench row with the hydration and the
  trainers' cart, and the equipment row behind it. The backups are the sim's own
  player sprites, so each bench wears its own team's kit; the staff wear one drawn
  kit for the same reason the officials do. The apron widens from 56 world units
  to 104 to hold all three lanes — the stands move back with it. Pylons stand on
  all eight end-zone corners, the yardage markers on their own yard lines, and the
  chain crew follows the ball: the down box shows the down actually being played
  and the two sticks stand on the line of scrimmage and on the line to gain. The layout is
  SEEDED, because the geometry is rebuilt at every snap and an unseeded sideline
  would reshuffle the bench on every play. Render-only — no sim actor, no stat.
  Guarded by `scripts/sidelinecheck.mjs`.

- **v77 — a failed declare ends the career.** Failing a declare used to bank a
  Determination bonus and hand you another season, so the biggest decision in the
  game had no downside: there was never a reason not to declare the moment the
  button lit up. A miss now ends the career on the spot, on both paths that offer
  the roll, and both screens state the stakes before it. The decline screen becomes
  the epitaph — career totals and the single best season — which needed a record
  the save did not keep: `seasonStats` is only the season just finished and
  `career` holds one row per LEVEL, so "your best season" was not a question the
  game could answer. `seasonLogV77` is that archive, one compact row per finished
  season. Rates are averaged rather than summed; eight years of 4.8 YPC is not
  38.4. Guarded by `scripts/declarecheck.mjs`.

- **v76 — a talent edge is worth points, not a scoreline.** A prestiged save could
  beat a team 10 OVR worse by 28.6 on average, with a quarter of those games ending
  five scores apart and one sample finishing on 151 points. The target is ~0.7 points
  of margin per OVR of scoreboard gap, both ways, with a rare statement win still on
  the table. The diagnostic ruled out the obvious cause first: between a -5.8 and a
  +14.5 gap the play count (156 vs 158) and the punts (12.4 vs 12.2) were identical,
  so nothing was buying extra possessions — the whole margin came from yards per play
  (2.42 to 5.39) and, once those were damped, from the two things yards do not touch,
  third-down conversion (43% vs 23%) and takeaways (0.12 vs 1.15 a game). So v76 is
  four levers on the GAME — explosive-play yardage, third down, the takeaway swing,
  and a garbage-time script — plus a rewritten quick generator that models the margin
  directly, so a simmed week and a watched week now agree on the same curve. Measured
  over 2,600 games: a +10..+14 edge wins by 8.5 (target 8.5), five-score blowouts run
  at 1.3% of games, and the worst game in the sample is 61 points rather than 151.
  A +10 edge can still produce a 31-point night, which is the point.

  Two things it deliberately does not do. It does not touch the ROSTERS: an earlier
  cut compressed the two teams' quality factors toward a midpoint, which cost the v68
  team-quality nerf its meaning (`teamqualcheck` fell from 9.0x to 2.6x) and collapsed
  the matchup range from +28 to +15 — that does not make blowouts closer, it deletes
  the fixtures they happen in. And it does not chase the extreme tail: past a +18 gap
  the margin is reported by `blowoutcheck.mjs` but not gated, because a defense whose
  players are 25 OVR worse at every position cannot be damped into a competitive one
  without lying about the team sheet.

  It did surface one real hole while proving that. The prestige tree fed the roster
  builder through `prF` at full strength, so the v68 nerf — which the tree was meant
  to run through — only ever applied to the score generator; the tree's effect on the
  live roster escaped it entirely. That channel now runs through `TU("teamQualK")`
  like the rest, which is what put `teamqualcheck` back at exactly 10.0x.

  For the you-player this costs production only where it should. Banded by gap, at
  parity his scrimmage yards move -5.4% and his game grade -1.0; in a big mismatch
  they fall 56% and 13.2. Awards, national rank and promotion are unaffected either
  way — they read `is(pos, perf, level)`, a formula off the perf grade, not the live
  box score, and the box score reaches perf only through a term capped at +-13.

- **v75 — the career loop stops being a scroll.** Measured on a 390x844 phone, the
  **hub** — the screen the loop returns to after every single action — laid out to
  3898px. That is 3.6 screens: on arrival you see the top of the hero card and
  nothing else. The prestige tree was 2.4 screens with 862px of specialization and
  rewards cards sitting *above* the branch row. Neither is a case of too much
  content; a stack is the wrong shape for eighteen blocks. The hub is grouped into
  five tabbed sections (NOW / BODY / SKILLS / TEAM / STORY), the tree into two
  (NODES / PERKS) with its header held above the strip. Purely presentation: it
  moves blocks the screen already rendered and rewrites none of them, which is what
  lets it sit on top of a dozen patch layers that insert into `#screen` by querying
  for their neighbours. Two screens are one long list each, so they get their row
  height back instead — the upgrade row went from 100px to 62. Hub 3.62 → 0.25
  screens, tree 2.42 → 1.15, training 1.72 → 1.33, upgrade 1.55 → 1.30. Guarded by
  `scripts/scrollcheck.mjs`.

- **v74 — the main menu fits, scrolls, and says what it is.** The shell laid out to
  1045px inside a 900px window while both `<html>` and the menu root carried
  `overflow:hidden`, so the bottom row of buttons was unreachable; the compact scale
  was gated on `max-width:519.98px` although the shell is capped at 520px at *every*
  width; and a rigid hero plus a fixed content block left 92px of dead black at
  390x844. The shell is its own scroll container, the compact scale is simply the
  scale, and hero and content flex in opposite directions so neither end leaves a
  band. The HUD's two unlabelled pills became labelled PRESTIGE/PP chips plus a
  settings control, the two legacy tiles with no cell on the icon sheet take the
  line icon, and the career name is held to one line (the card is aspect-locked to
  its sprite frame, so a second line pushes the label out of it). Asserted at four
  window heights in `scripts/menu-integration-check.mjs`.

- **v73 — the injury section answers the question it exists for.** The condition
  card reported fatigue, recovery capacity and mental load: three *inputs* to the
  availability model and none of them what a player needs to decide anything. It
  now leads with one signed NET figure — the rating this body adds to or takes off
  the next game, against the player's own recent average — itemises where it came
  from, prices the week's risk in expected games missed, and quotes what the next
  point of `injuryResist` buys, measured by asking the real `injChanceV54` with the
  stat one higher rather than re-deriving its formula. The weekly resolver records
  `bodyCostV73` either side of the multiplier, so a bad grade caused by the body
  says so on the card and on the schedule row. No model changes. `scripts/bodycheck.mjs`.

- **v72 — the painted field and the simulated field are one field.** `warpField`
  mapped the turf art's full HEIGHT onto the world's full width, which assumed the
  painted end zones are exactly `EZ` deep and that the art has no apron outside
  them. It has a real ten-yard end zone at each end *and* ~6 yards of grass beyond,
  so the painted hundred yards covered 542 world px against the sim's 588 — a
  carrier the sim had at the 0 was drawn four yards deep in the end zone. The art is
  mapped by its GOAL LINES now, measured off the image (from `fieldBase`, not
  `fieldImg`: v44 composites the home crest onto the latter and a crest is not
  grass). 0.2 yards apart on screen, down from 4.2. `scripts/endzonecheck.mjs`.

- **v71 — a flag takes the camera.** v45/v49 got the crew throwing a real flag and
  the broadcast ignored it: the camera stayed on the ball carrier, who by then is
  standing still. The follow re-points at the official and the zoom pushes in ~1.6x
  on an ease-in / hold / ease-out envelope, with the predictive lead suppressed; the
  official swells, shivers and drops a ring off his feet. Focus and swell share one
  clock (`endFlagFocus`) so a play that dies mid-swell cannot leave him permanently
  40% bigger. New block in `scripts/refcheck.mjs`.

- **v70 — the you-marker moves off the turf and onto the head.** v18 stacked four
  gold effects on the ground, in the busiest part of the frame — and inside a pile
  the aura is *under* the pile. It is a Sims-style crystal above the head now, drawn
  per frame because the rotation IS the silhouette changing shape, with the near
  crease sweeping across two shaded facets. A gassed player gets a red crystal. The
  plain foot ring every other player has stays. `scripts/bobcheck.mjs`.

- **v69 — emblems are found by their own ink, not by the grid line.** The packer
  sliced each sheet on a rigid 5x6 grid and contain-fit the whole square, so crests
  sat wherever the artist left them and several overhanging emblems dragged a sliver
  of a neighbour's logo into the cell. The sheet is labelled into connected
  components once and each is assigned to the cell its centroid falls in, so
  overhang follows its own emblem and can never follow anyone else's. `emblemcheck`
  now asserts the atlas directly: every cell centred, filled, empty pad ring.

- **v68 — team quality is a nudge, not a cheat code.** Over 6000 games a maxed
  team-quality tree took a level-5 career from a 71.4% win rate to 97.7%. The whole
  prestige contribution runs through `TU("teamQualK", .1)`: +1.3 points a game
  instead of +13.6, 75.8% instead of 97.7%. The `bornLeader` trait is untouched —
  it is not bought. `scripts/teamqualcheck.mjs`.

- **v67 — the price of a point, stated where the choice is made.** v21 charges 1
  skill point per +1 below a stat's soft cap and 2, 3, 4… above it, but only the
  upgrade screen said so and only in a hover title. Every focus stat on the
  offseason board now carries the price of its next +1, every program a one-line
  verdict, and every upgrade row a permanent readout. `scripts/capcheck.mjs` also
  asserts each badge quotes what `drCost` would actually charge.

- **v66 — the weekly game-plan wheel gets drawn, not typed.** The pregame plan is
  the decision met every week and its wedges still carried platform emoji — two of
  the ten plans shared the same glyph. Ten isometric scenes replace them, one per
  plan, packed and keyed like the v64 training scenes; the mapping is one-to-one so
  there is no near-fit to call out. Face, option rows, roll pop-up header and result
  card all address the same atlas. Guarded by the plan-art block in `wheelcheck`.

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
