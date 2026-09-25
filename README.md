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
