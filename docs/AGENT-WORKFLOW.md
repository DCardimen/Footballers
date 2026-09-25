# AGENT WORKFLOW — the fast path through a change

For Claude Code (and anyone else) working in this repo. CLAUDE.md is the map; this is the route.

## The fast path for a typical request

1. **Find it.** Name the system, then grep its banner across `src/` (and `public/` for the menu, coach and vault):
   ```bash
   grep -rn "v146 E THE MENUS" src/                  # a banner you know
   grep -rn "/\* ===== v14[0-9]" src/ | cut -c1-120   # the banners of a version range
   grep -rn "__V147D\|camRateV147" src/ scripts/     # a hook or a function name
   ```
   `docs/ANCHORS.md` says which file and which section each system is in, the hooks it publishes, and the
   check that guards it. If a note or comment uses an old one- or two-letter name (`q`, `ms`, `Yr`, `tt`…),
   look it up in `docs/NAMES.md` before grepping — the binding in `07` has a real name now.
2. **Read only the neighbourhood.** `07` is ~30k lines, `05` ~15k: read the banner's region (`Read` with an
   offset, or `grep -n` then a window), not the file. `docs/ARCHITECTURE.md` explains the engines and the
   render path when the region is not enough.
3. **Change it** in the file the banner is in. New gameplay numbers through `TU("name", default)`; functions a
   screen calls by bare name as hoisted `function` declarations (v140); stat credit only from resolved actors.
4. **Verify.** `node scripts/run-checks.mjs --since main --jobs 4` picks the suites your diff touches (by banner
   tags and `fooV123` identifiers in the changed hunks, and by file globs); `--dry` shows what and why. Read a
   `NEW` failure in its log (`<out>/<check>.log`); rerun a timing check alone before believing it (load). Finish
   with `npm run check:smoke` if `--since` picked something narrow.
5. **Record it.** A new system: a banner, a line at the top of its section in `docs/ANCHORS.md`, an entry at the
   top of `docs/CHANGELOG.md` (and roll README's "Recent releases" if it is a release), and its check in
   `scripts/checks.json` (then `node scripts/checks-table.mjs`). `node scripts/anchorcheck.mjs` proves the anchor
   and every path you wrote in the agent docs resolve.

A one-line tweak does not need step 5; a new behaviour does.

## Parallel workers

- **One git worktree per worker**, each on its own branch. A fresh worktree has no `node_modules`:
  `ln -s <main checkout>/node_modules node_modules`.
- **Give each worker its own port range**: `node scripts/run-checks.mjs smoke --jobs 3 --base-port 5560` (each job
  probes upward from `base + 3·job`). Never share the main session's `5173`, and never `pkill -f vite` — the
  runner's servers are started through vite's API precisely so a stray pkill does not take them down.
- **Or share one server**: start one `npm run dev -- --port 5561` and point every job at it with
  `GAME_URL=http://localhost:5561/`. Every check reads its URL through `scripts/lib/env.mjs`; each launches its
  own throwaway Chromium profile, so localStorage and service workers are never shared.
- **The CPU is shared.** `--jobs 3` or `4` on a 4-core box, not more; `loadSensitive` checks wobble when several
  workers run at once — a NEW failure on one of them should be rerun alone.
- **Merging:** workers touching `07` should stay inside their banners (it is formatted, so edits in different
  functions merge cleanly). `scripts/checks.json` is one file everyone edits: add entries, do not reorder, then
  regenerate the table. Docs: add your line at the top of the right `docs/ANCHORS.md` section and your entry
  at the top of `docs/CHANGELOG.md` (the `<!-- new … go here -->` markers).
- A branch cut before v149 A (one-file `index.html`) or v149 C (minified `07`): port it with
  `scripts/layout-split.mjs` and `scripts/readable/*` (`docs/LAYOUT.md`, `docs/NAMES.md`).

## Writing a new check

1. `scripts/<name>check.mjs`. Take the URL and the browser from `scripts/lib/env.mjs`:
   ```js
   import { gameUrl, launch } from './lib/env.mjs'
   const browser = await launch()
   const page = await browser.newPage()
   const errors = []; page.on('pageerror', e => errors.push(String(e)))
   await page.goto(gameUrl())
   ```
   Never hard-code a port. Drive the exposed hooks (`window.__simGameV2`, `window.__FieldSim`,
   `window.RIB_TUNE`, `window.__GRIDIRON_AUDIT__`, your version's `window.__V1NN`) rather than pixels where you can.
   A check that needs no browser (pure Node, like `readcheck`, `namecheck`, `layoutcheck`, `anchorcheck`) is
   faster and deterministic — prefer it when the logic can be loaded without the page.
2. **Print the one convention:** one line per assertion, label first (the baseline matches it by text), evidence
   after it, then one JSON line, and exit 1 on any failure or page error:
   ```
   ok   the carrier goes down with a man on him  offset 0.6px
   FAIL every badge decodes at its stated size  2 of 15: tackle, sack
   {"pass":12,"fail":1,"pageErrors":0}
   ```
3. Register it in `scripts/checks.json`: `checks.<name>` (`file`, `desc`, `areas`, `runtimeSec`, `slow`,
   `needsServer`, `pureNode`, `flaky: []`) and its name in each suite's `checks` (and `smoke` if it is fast,
   broad and green on main). Then `node scripts/checks-table.mjs`.
4. A row in `scripts/README.md`; `node scripts/run-checks.mjs <name>` must come back `PASS`.

Screenshots go to per-script names (`scripts/_<name>_*.png`) so parallel runs do not overwrite each other.
