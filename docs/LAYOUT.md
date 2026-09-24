# LAYOUT — where the game lives (v149 A, "THE FILE BECOMES A FOLDER")

Until v149 A the whole game was one 9.9MB `index.html` (26.6k lines: 35 `<script>` blocks, 14
`<style>` blocks, 6.1MB of base64 sheets). It is now a 54KB page plus a folder. **Nothing about
the game changed**: every block moved byte for byte into a classic script file that is loaded by a
`<script src>` standing exactly where the inline block stood, in the same order, with the same
attributes. `node scripts/layoutcheck.mjs --against adfd250 --at 703499b` rebuilds the last
monolithic `index.html` (adfd250, v148) from the split commit's layout (sheets re-baked) and it is
byte-identical. The one deliberate edit after the split is the removal of 16.8KB of HTML-mangled
Phaser source that a bad bake had left in the markup between two blocks (the parser read it as
stray end tags, so it never rendered); `layoutcheck.mjs` and `bake-menu-into-index.mjs` now refuse
code in the page's markup (`strayCodeInPage`).

Banner anchors (`/* ===== vNN NAME ===== */`) did not move relative to each other — search for them
across `src/` instead of `index.html` (`grep -rn "v146 E THE MENUS" src/`).

## The files, in load order

| # | File | Size | What it is | Anchors inside (not exhaustive) |
|---|---|---|---|---|
| 0 | `index.html` (inline, head) | 3K | v112 A head warm: requests the v91 loading sheet in the first breath, before the CSS | `v112 A THE CHASE IS ALWAYS READY` |
| – | `index.html` `<style>` | 40B | only `@import"./public/fonts/fonts.css"` — the head of the old first style block | |
| – | `src/styles/00-app.css` | 92K | the app's main stylesheet (tokens, every screen) — the rest of that first block | |
| – | `index.html` `<style id="rib-v1520-phaser-css">` | 0.4K | the v15.20 canvas sizing (kept inline: it has an id) | |
| – | `src/styles/02-live-sim.css` | 24K | `/* v13 compact live-sim UI */` and later live-field CSS | |
| – | `public/rib-menu*.css`, `rib-vault.css` | | the menu/vault sheets, baked by `bake-menu-into-index.mjs` (unchanged) | |
| 1 | `index.html` (inline, beside `<video id="splashFilm">`) | 1.4K | v114 film picker | `v114: the film's source` |
| 2 | `index.html` (inline) | 3.5K | error surfacing + v101 `window.__RIB_ASSET` | `v101 ONE ASSET ROOT` |
| 3 | `src/03-splash.js` | 62K | the boot splash, the film, the loader, both doors | `v114 THE SPLASH IS A FILM`, `v116 THE FILM LOOPS`, `v94 THE CHASE`, `v121`, `v132 THE INTRO FILM IS THE LOADER`, `v115 THE FILM AT BOTH DOORS` |
| 4 | `src/04-engine.js` | 376K | the play engine: tunables, choreographer, FieldSim | `RIB_TUNE`, `GRIDIRON play choreography engine`, `GRIDIRON FieldSim`, `v81 …`, `v82 …`, `v87 WHO IS ON HIM`, `v109 …`, `v110`, `v117`, `v129`, `v143`, `v146 A` |
| 5a | `src/vendor/phaser.min.js` | 1.2MB | the minified Phaser bundle. **Never edit.** Ends with `window.__RIB_PHASER_V149=Mt(Lt)` | |
| 5b | `src/05-field-renderer.js` | 658K | `GRIDIRON live-field bridge v3` — the broadcast renderer; starts `const mt=window.__RIB_PHASER_V149;` | `v44 TEAM EMBLEMS`, `v57 CROWD`, `v78 SIDELINE`, `v86 BETWEEN THE WHISTLES`, `v91`–`v108`, `v112 …` camera/stadium, `v118 THE MESH`, `v144 …`, `v145`, `v147 D`, `RIB_META_V91/V92`, `RIB_BADGES_V95` |
| 6 | `src/06-phaser-launcher.js` | 6K | `<script id="rib-v1520-phaser-launcher">` — save/backup + `window.GridironPhaser` | |
| 7 | `src/07-career-app.js` | 928K | the career app (dense one-liners): state, screens, the season, prestige, the boot render | `v16 EMERGENT GAME ENGINE`, `v85 …`, `v88`, `v122`–`v142`, `v140 THE BOOT CANNOT TAKE THE REST OF THE FILE WITH IT`, `v146 B/C/D/E`, `v147 A/C`, `__GRIDIRON_AUDIT__` |
| – | `index.html` `<style>` ×3 | 13K | `tp-v113` board, v142 info card, v15.3 team creator | |
| 8 | `src/08-contact.js` | 2K | `window.__GRIDIRON_CONTACT_MODEL_V156` | |
| 9 | `src/09-rosters-v157.js` | 10K | `v15.7: exact team-rating rosters` | |
| 10 | `src/10-season-rosters-v158.js` | 11K | `v15.8: persistent season rosters` | |
| 11 | `src/11-pregame-v1513.js` | 92K | `v15.13` recovery + the pregame wizard | `v23 PREGAME`, `v111`, `v112 THE PREGAME, ONE DECISION AT A TIME`, `v135`, `v136 A`, `v146 D` (the pages) |
| 12 | `src/12-gear-overlay.js` | 19K | `<script id="rib-v1520-phaser-runtime">` — `PLAYER GEAR OVERLAY TOGGLE` | |
| 13 | `src/13-dev-harness.js` | 8K | `RIB DEV HARNESS` (`DEV.help()`) | |
| 14 | `src/14-personality.js` | 15K | `v16.6 PERSONALITY SLIDERS`, `v20 TWO-SIDED PERSONALITY` | |
| 15 | `src/15-speed-through.js` | 2K | `v50 SPEED THROUGH` | |
| 16 | `src/16-story-wheel.js` | 13K | `v16.6 STORY-ARC WHEEL` | |
| 17 | `src/17-pregame-wheel.js` | 22K | `v51 PREGAME WHEEL`, `v62 PLAN KINDS`, `v85 THE DECISION, WITH NO WHEEL ATTACHED`, `v135 THE WHEEL SPINS ON THE FIFTH PAGE`, `v146 D THE PLAN IS YOURS (the choice)` | |
| 18 | `src/18-growth-wheel.js` | 74K | `v42 GROWTH DECISIONS`, the wheel, `v64 SKILL`/`v66 PLAN` art (`RIB_META_SKILL/PLAN/WHEEL`), `v139` | |
| 19 | `src/19-score-attack.js` | 14K | `v46 SCORE ATTACK` | |
| 20 | `src/20-leaderboards.js` | 14K | `v47 LEADERBOARDS` | |
| 21 | `src/21-daily-challenge.js` | 12K | `v48 DAILY CHALLENGE` (mirror of `scripts/daily-engine.mjs`) | |
| 22 | `src/22-hub-sections.js` | 21K | `v75 HUB SECTIONS`, `v97 THE FOLD` | |
| 23 | `src/23-dock.js` | 2K | `v139 THE DOCK IS NOT A LID` | |
| 24 | `src/24-bottom-nav.js` | 5K | `v139 THE BOTTOM OF THE SCREEN IS THE WAY AROUND` | |
| – | `index.html` `<style id="shellV146css">` | 8K | the v146 E shell's look (kept inline: it has an id) | |
| 25 | `src/25-shell.js` | 16K | `v146 E THE MENUS LIVE AT THE BOTTOM, AND NOTHING SCROLLS` | |
| 27 | `src/27-monetize.js` | 47K | `window.RIB_MONETIZE` — the monetization module, **OFF** by default (v149 E, a new file, not a split block; docs/MONETIZATION.md) | `v149 E THE STORE IS WIRED, AND SWITCHED OFF` |
| – | `public/rib-menu*.js`, `rib-vault*.js` | | the menu, the coach, the vault — unchanged, baked by `bake-menu-into-index.mjs` | |
| 26 | `src/26-platform.js` | 30K | `v149 D IT INSTALLS` — the platform layer: worker registration, `ribDialog`, `ribSave` (file + rolling backups), `ribHaptics`, the native shell (back button, keep-awake, freshness held, Preferences mirror). Loaded LAST so no older block index moves; `bake-menu-into-index.mjs` may put the menu block after it — it copes with either order | `v149 D` |

A file's number is the index its block had among the old `<script>` elements, so anything that
still says "block 7" (e.g. `equaltalentcheck.mjs` loading blocks `[0,1,2,3,4,7]`) means
`src/07-career-app.js`.

The small `<style>` blocks in the body (1–8K each, beside the feature scripts they dress) stay
inline; they are cheap, some carry ids code may look up, and moving them buys nothing.

## Why a few things stayed inline

- **The v112 A head warm** (script 0) must start the v91 sheet's fetch in the first breath of the
  head, before any stylesheet; an external file would wait for its own fetch first.
- **The v114 film picker** (script 1) chooses the film's source *beside* the `<video>`, before the
  preload scanner can start a fetch the page cannot take back; it reads the element just parsed.
- **Error surfacing + `window.__RIB_ASSET`** (script 2) — 3.5K that every later file leans on; it
  is armed before the first external script is even requested.
- **The font `@import`** — `./public/fonts/fonts.css` is relative to the *document*; inside
  `src/styles/` it would resolve to `src/styles/public/…`. It stays in its own tiny `<style>` in
  front of `00-app.css`, which is the same cascade position an `@import` has.

## The rules that make this safe

- **Classic scripts, same order, no `defer`/`async`/`type=module`.** Each file is its own script
  element exactly as its block was, so global scope, per-script function hoisting, and "a throw
  aborts only the rest of *this* block" (v140) are unchanged. `layoutcheck.mjs` refuses a `defer`,
  `async` or module tag. Nothing in the game uses `document.currentScript` or `document.write`
  during load (the team creator's `w.document.write` is a popup window).
- **Phaser is not a global named `Phaser`.** It never was; `src/12-gear-overlay.js` has a bare
  `Phaser.Geom` path that must keep behaving as it always did. The bundle hands its one export to
  the bridge through `window.__RIB_PHASER_V149`.
- **Every `src/` tag carries `vite-ignore`.** Vite's build then leaves the tag as written (and
  strips the attribute); `vite.config.js` copies `src/` into `dist/src/` and stamps each reference
  `?v=<content hash>`. In dev, `vite.config.js` serves `src/` **raw**, ahead of Vite's own
  middleware — Vite's transform would otherwise reformat every `.js` outside `public/` and replace
  `process.env`.
- **The Pages deploy** (`scripts/assemble-pages.mjs`) copies `src/` into `_site/`, stamps every
  reference with its content hash (Pages caches for ten minutes, and v106.1's one reload must not
  come back to stale scripts), and lists the layout in `rib-build.json`. Nothing needs bumping by
  hand when a `src/` file changes; `RIB_MENU_VERSION` is still only for the menu files.
- **The sheets are files.** `window.__RIB_LOGOS_V44 / __RIB_FIELD / __RIB_ATLAS / __RIB_ATLAS_V22 /
  __RIB_REFS_V49 / __RIB_WHEEL_V50 / __RIB_CROWD_V57 / __RIB_PLAN_V66 / __RIB_SKILL_V64 /
  __RIB_SIDE_V78` are `window.__RIB_ASSET("<file>")` now (`DATA_ASSETS` in `scripts/lib/layout.mjs`).
  Every reader already loaded them through `new Image()` + `onload` and re-registers live scenes
  when a sheet lands, so a network fetch instead of a data-URL decode changes only *when* they
  arrive, not what happens. `rib_atlas_base.png` and `rib_field_base.jpg` are new files; the other
  eight were already in `public/`, byte-identical.

## Tools

- `scripts/lib/layout.mjs` — `readGameHtml()` (the old monolith rebuilt, block for block; `{ bake:
  true }` re-bakes the sheets, `{ gitRef }` reads a commit, pre-split refs included),
  `scriptBlocks()`, `layoutFiles()`, `findLayoutFile(needle)` (the one file holding a marker — use
  it in anything that writes generated code), `stampLayoutRefs()`, `bakeSheet()`.
- `scripts/layoutcheck.mjs` — pure Node gate: every `src/` file named exists and is loaded once,
  the tags say `vite-ignore` and are classic, the Phaser bundle's pinned sha1, the bridge's one
  hand-off, every sheet wired through `__RIB_ASSET`, no big data URL crept back,
  no code leaked into the markup. `--against adfd250 --at 703499b` adds the byte-identity proof of
  the split against the last monolithic `index.html`.
- `scripts/layout-split.mjs <monolith.html>` — the splitter itself, kept for porting a branch that
  still edits the one big file: `git show <branch>:index.html > /tmp/mono.html`, run it, and the
  branch's edits land in the right `src/` files (`git diff` shows them). Run on `adfd250`'s
  `index.html` it reproduces the split commit exactly. It warns about the stray markup `accd794`
  removed; delete it again.
- Generated-code writers now write `src/`: `build-field-art.py` (`RIB_META_V91`),
  `build-stadium-art.py` (`RIB_META_V92`), `build-badge-art.py` (`RIB_BADGES_V95`) →
  `src/05-field-renderer.js`; the spritekit `bake_*.mjs` refresh `RIB_META_REF/CROWD/SIDE` in
  `src/05-field-renderer.js` and `RIB_META_SKILL/PLAN/WHEEL` in `src/18-growth-wheel.js`, and no
  longer inline a data URL (the PNG in `public/` is the asset). `bake-menu-into-index.mjs` still
  rewrites only its two marked regions of `index.html`.

## Adding code

- A change to an existing system: edit the `src/` file its banner is in.
- A new system: put it in the file of the block it extends (new banner, as always). A genuinely new
  top-level block becomes a new `src/NN-name.js` with its own `<script src="./src/NN-name.js"
  vite-ignore></script>` at the position it must run — then run `layoutcheck.mjs`.
- Markup, the three inline scripts and the small styles: `index.html`.

## The build outputs (v149 D)

`vite build` (dist/, the Capacitor `webDir`) and `scripts/assemble-pages.mjs` (_site/, GitHub Pages) both finish with
`scripts/lib/pwa.mjs`'s `writeServiceWorker(outDir)`: `<meta name="rib-sw" content="./sw.js">` goes into the page and
`sw.js` = a content-hashed precache manifest + `pwa/sw.js`. `src/26-platform.js` registers the worker only when that
meta is present, so `vite` dev and the checks that run on it never have one. The manifest and icon `<link>`s in the
head carry `vite-ignore`, or vite build hashes them into `/assets/` and the manifest's relative icon paths break.
