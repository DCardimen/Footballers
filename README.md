# RUNNING IT BACK — Life of a Player

A football career-simulation game (Phaser + canvas): one player's life from Pee Wee to the UFF and the
Interstellar League — the seasons, the body, the decisions, the lineage — with every snap resolved by an
agent-based play engine (FieldSim) and watchable on a pixel-art broadcast field.

## ▶ Play the current build

**<https://dcardimen.github.io/Footballers/>** — the GitHub Pages workflow (`.github/workflows/pages.yml`)
redeploys on every push, so the link always serves the newest committed build (and the page reloads itself
once when it notices a newer deploy, v106.1). It installs as a PWA (v149 D).

> First-time setup (one click): repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Run it locally

```bash
npm install
npm run dev            # Vite dev server at http://localhost:5173
npm run build          # production build -> dist/ (also the Capacitor webDir)
npm run check:smoke    # the ~5-minute smoke suite of headless checks (starts its own servers)
npm run shot           # screenshot the running game
```

The game is `index.html` + `src/NN-*.js` (classic scripts in load order), `src/styles/`, and the sheets,
menu, vault and film in `public/` — see [`docs/LAYOUT.md`](docs/LAYOUT.md).

## Deploy / ship

- **Web:** push — Pages runs `scripts/assemble-pages.mjs` (content-hashed references, `rib-build.json`,
  the service worker).
- **Android / iOS:** Capacitor 8 — `npm run cap:sync`, `npm run cap:android`, `npm run cap:ios`; the release
  checklist is [`docs/APP-STORE.md`](docs/APP-STORE.md).
- **Monetization** is wired but OFF ([`docs/MONETIZATION.md`](docs/MONETIZATION.md)).

## Working on the code

- [`CLAUDE.md`](CLAUDE.md) — the one-page map: layout, how to find things, the dev loop, house rules, gotchas.
- [`docs/ANCHORS.md`](docs/ANCHORS.md) — every system by subsystem: its banner, its file, its hooks, its check.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — deep dives: FieldSim, the game engine, the render path, the
  stat-credit flow, the screens.
- [`docs/CHECKS.md`](docs/CHECKS.md) / [`scripts/README.md`](scripts/README.md) — the check runner and the
  catalogue of checks.
- [`docs/AGENT-WORKFLOW.md`](docs/AGENT-WORKFLOW.md) — the fast path for a change, parallel workers, writing a check.
- [`docs/NAMES.md`](docs/NAMES.md) — the career app's old minified names → today's.

Every gameplay dial reads through `TU(key, default)`, so values can be retuned live via
`window.RIB_TUNE[key] = …`.

## Recent releases

The full history, newest first, is [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — add new entries there.

- **v191 — prices, the Locker Room, the gang goes down.** The core tree costs ×24 and Impossible ×8 (from ×6 / ×500); a new FOREVER Locker Room branch hands +1 OVR a level to your teammates; in group tackles every tackler now goes to the ground and gets up, every tackle lands with a hitstop and flash, missed tackles are real launches, and late defenders dive and miss. `v191check`.
- **v190 — every prestige upgrade does what it says.** The per-game stat nodes now work in Quick Play and sims (as a % of every attribute), maxed nodes pay their stated numbers, team nodes name a teammate-rating % (up to +15%), the medal PP windfall scales with your careers, and the Legacy medal card and pot sit at the top of the season report. `v190check`.
- **v189 — one stat line.** The Quick Play card shows the same YOUR GAME stats as the live card (and the season counts simmed weeks); new medal rewards pop up before your next game; the banked PP shows at the season's end as a filling pot and rains into the Vault when the career ends. `v189check`.
- **v188 — no real team's look.** Every kit palette is an original pair (they were exact NFL colours) and `namecheck` guards it; the Bengal uniform is the Snow Tiger, the Longhorns / Razorbacks / Buccaneers are the Steers / Warthogs / Corsairs, the Griddy is Heel Clicks. `docs/IP-AUDIT.md`.
- **v187 — medal looks are earned.** Every 10 medals earns a look automatically (rarer as the medals climb, worn at once), no longer a reward choice; one ring re-picks every medal reward. `v187check`.
- **v186 — rings are earned.** A UFF ring goes to a starter who carried the season (an average of 60+), an
  Interstellar ring to a dominant one (85+). Chaos locks in once a career is played under it. The Apex and the
  Impossible cost ×50 / ×500 and pay ×1.5 / ×2. The Interstellar League is rated 700, about 100 hours between arriving
  and its ring, with ✨ Stardust and the Star Forge out there. Reward cards pay later: Upgrade Point and Prestige cards add a percentage paid at the season's or the career's end, the coach card is +1, and rare / epic / legendary cards are 1 in 20 / 200 / 1,000. The post-game card leads with YOUR GAME, the season screen
  has MY TEAM, and the gap between plays is tighter. `v186check`.
- **v185 — the chaos loop.** Chaos is a second prestige. Turn it up and the next careers start from Pee Wee in a much
  harder world, where opponents gain a share of their own level's rating and the scouts and rankings see it too. They
  get cut in high school or college, but bank several times the PP of a calm career. Within a career or two they are
  back in the UFF, and a ring at full chaos raises the capacity by 3, one notch harder. Every number is a beta dial,
  and the estimate models the loop. `v185check`.
- **v180 — the board at any speed.** The jumbotron's celebration plays its whole course at 4× (the next snap used to cut
  it off); the floodlights default to 60%; the camera keeps the play in the middle of the frame wherever the snap; a
  gang tackle is half a tackle each. `v180check`.
- **v179 — the long road.** Prestige paced for a long game, with choices that matter: the UFF scouts judge POTENTIAL —
  the growth ceiling your prestige tree builds (Freak, Prime Genes, Superhuman, the ceiling nodes) — so a balanced
  expert reaches the UFF in about 9 hours, most players in 12–14, a careless tree in about 47. Every Legacy medal deals a
  choice of two rewards; every 10th medal and every new era a face-down choice of two unique permanent upgrades. PP
  reads K / M / B / T. Every big declare is two rolls — the season, then the scouts' verdict (and the GM's second look) — so
  even a strong bloodline sweats it; the Interstellar Call judges potential too. `v179check`.
- **v178 — the weekly paycheck.** Upgrade points are paid every game (simmed ×1, watched ×2) instead of all at the
  season end, with a reward reel on the post-game card: the coach's receipt (why trust moved), win-streak heat, weekly
  orders, practice reps, a card flip, the scouts' stock and the season pace; THIS WEEK on the season screen. `v178check`.
- **v176 — the number is sewn on.** Jersey numbers are printed into the shirt on the sprite's own pixels: centred on
  the back under the helmet, on the chest under the facemask, covered by an arm or the ball, shaded with the fabric, in
  the kit's colours (and his number font's); the profile figure's chest the same way. `numsewcheck`.
- **v175 — the camera finds the screen.** The stadium screen stays in its spot; the badge art (TOUCHDOWN, TURNOVER,
  BIG PLAY …) plays on it, and after a big moment the camera slowly pans up to it while the players settle, then back
  for the snap. `screenpancheck`.
- **v174 — the palette.** Every look in one place: the Locker's STYLE tab (and the top bar's 🎨) is one page with
  the live card on top and a row for the uniform, the team colours and crest, the helmet, the celebration, the banner
  and every other look — each showing what he wears; open one, tap a look to wear it. `src/28-cosmetics.js`; `palettecheck`.
- **v173 — the pile is the button.** In the Prestige Vault you tap the pile itself: it lights up, real coins jump off
  it and clink back down, "+N PP" pops, the quarter marks chime and shake the room; holding is still the pour, and the
  money is exactly what it was. `public/rib-vault*`; `v173check`.
- **v172 — the big board.** The stadium's screen hangs at the top of the broadcast on every snap, behind the players:
  the scoreboard between plays, and a touchdown, turnover or big play takes it over in the team's colours (the man, the
  yards) and stays up into the next snap. `src/05-field-renderer.js`; `jumbocheck`.
- **v171 — the matchup call.** Every opponent has a face (a named star, a weak link, a unit to fear and one to
  attack) and the pregame's plan page opens on the calls against it — shut down their star, load the box, send the
  house, pick on their weak corner — each with real engine effects, its own line to beat, risk, reward and swing. Your
  say (trust, chemistry, Field General) opens 2-5 of them; the plan's rating lifts the whole team. Focus cards roll
  every week, the involvement rung sets how hard you play, specialization is gone. `matchupcheck`.
- **v170 — the spray menu.** Hold any bottom-bar button and its pages spray out; slide onto one, slide onto its page,
  let go — 43 destinations two slides away. On a phone every page is one page with one scroll, with a section bar you
  can tap or swipe. `src/34-spray.js`; `spraycheck`.
- **v169 — big on a phone.** No text under 12px on a phone (prose at 14-15px), a short phone folds the ticker,
  bigger tabs, buttons and rows, training three a row with its details in view, and a post-game card that scrolls with
  Continue always reachable. `src/33-phone.js`; `phonecheck`.
- **v168 — the season, redrawn.** Explanations live behind ⓘ buttons (a bottom sheet with the same words), long tabs
  end on a ‹ previous · next › pager, and the season screen opens on a hero in the main menu's style — crest, record,
  league place, the playoff race as pips, the next matchup — with a LEAGUE tab, crests on every fixture, a post-game
  season strip, the hub's season strip and the report's final standings. `src/32-season-ui.js`; `v168check`.
- **v167 — the league is real.** A season is a league of named, rated teams on a round-robin: the strong teams rise
  up the standings, the playoff field is the top of the table, and the title game is against one of the best teams with
  its real record on the scorebug (no more 0-11 champions-elect). `leaguecheck`.
- **v166 — the AI plays football.** Blocks hold on leverage and ratings (a sealed defender is out of the play), every
  route is live, zones are places on the field, rushers pick moves and tackles set for them, passers feel the pocket,
  backs choose their moves, the defense pursues as one, both coordinators adapt (the offense answers the blitz and the
  key), fourth downs are priced in expected points, a star is keyed off his film, and special teams think. `blockcheck`,
  `livecheck`, `zonecheck`, `rushcheck`, `pocketcheck`, `cmovecheck`, `teamdefcheck`, `occheck`, `gmcheck`, `repcheck`,
  `stcheck`.
- **v165 — the smarter you are, the smarter you play.** Awareness, vision and discipline no longer stop at a ceiling
  on the field: past it they become football IQ, and every decision reads it — the quarterback's scan and audible,
  the back's lane and his open-field read, the receiver's break, a defender's read, angle and fake, and the
  duel of eyes at the catch point. Passers work their progressions off the live field, defenses play man, cover 2
  and cover 3 that a sharp passer reads before the snap, and backs run behind their blockers. Each level's game
  is smarter than the one below. Each defense has a coordinator who blitzes by situation, keys what is beating it
  (and you), and gets burned by play action and the hot read; the play-by-play says when the call decided it.
  `iqcheck`, `dccheck`.
- **v163 A — the game never stops.** One bad frame no longer freezes a live game: the frame loop survives it, a
  texture swapped under a sprite is rebound, and a wall-clock watch on every play restarts a stopped field or moves the
  game on. `v163Acheck`.
- **v162 — the handover is smooth; the helmet is the helmet.** A change of possession no longer re-bakes the field three
  times or recolours his kit twice (a bake on screen is reused, the stands' cheer layers repaint after the snap); the
  profile figure's helmet is read off the art, so its jaw flaps no longer take the jersey's colour. `v162Acheck`, `v162Bcheck`.
- **v161 A — they celebrate like they mean it.** Three drawn touchdown celebrations — the flex, the backflip, the ball
  spike — picked at random on his touchdowns, in his kit, with real arcs, a smooth spin and a bouncing ball.
  `scripts/build-celebration-sheets.py`; `v161Acheck`.
- **v153 D — the goal on the wall.** The menu holds up the UFF CHAMPIONS trophy until it is won, then INTERSTELLAR
  CHAMPIONS; the Legacy medal hovers in its own box under the logo; a PROFILE tile; PRESTIGE is the gold coin; the
  players breathe. `v153Dcheck`.
- **v152 A — the Legacy Rank.** 500 medals in one climb above every career (bronze and silver only in 1-200),
  Legacy XP every season and at the end, a milestone every tenth rank, the pour and the medal swap, Rank 500's own
  sequence, and the profile's trophy case and collection book. `src/31-legacy.js`; `v152Acheck`.
- **v150 D — the map fits on a page.** CLAUDE.md is one page; the anchor encyclopedia is `docs/ANCHORS.md`
  (grouped by subsystem, proven by `scripts/anchorcheck.mjs`), the history moved to `docs/CHANGELOG.md`, and the
  "which check for which change" table is generated from `scripts/checks.json`.
- **v149 — the file becomes a folder, and the game ships.** A: `index.html` split into `src/` (byte-identical,
  `layoutcheck`). B: `scripts/run-checks.mjs` runs the checks by suite, in parallel, against a known-failures
  baseline. C: the career app formatted and its 406 minified names made readable (`docs/NAMES.md`). D: a PWA
  and a Capacitor shell — service worker, in-app dialogs, save files and rolling backups, haptics, the Android
  back button. E: a monetization module, switched off.
- **v148 — the lines hold to the goal line.** One row density for the whole drive, so the field no longer
  squashes near the end zone being attacked; the canvas budget is paid behind the backfield instead.
- **v147 — the league is the UFF.** The United Football Federation everywhere a player reads; retire any time
  from the UFF and sim a whole season in one tap; the menu wears the Vault's coin; gear rolls 0–3 real modifiers;
  the camera holds still at 4×.
- **v146 — five things in one batch.** Every man who goes down was taken down (no phantom tackles); two strikes
  in the UFF and you pick your club; the Impossible prestige branch; the weekly plan is chosen on a board with a
  projected box score; every career screen in one shell with the menus at the bottom and nothing scrolling.
