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

- **v172 — the big board.** The stadium's screen hangs at the top of the broadcast on every snap, behind the players:
  the scoreboard between plays, and a touchdown, turnover or big play takes it over in the team's colours (the man, the
  yards) and stays up into the next snap. `src/05-field-renderer.js`; `jumbocheck`.
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
