# Running the dev checks (v149 B — ONE COMMAND RUNS THE AREA)

`scripts/*check.mjs` are ~120 headless Playwright checks (catalogued in `scripts/README.md`). This page is
about running them: one command per area, in parallel, with a baseline that says whether a failure is
yours.

```bash
node scripts/run-checks.mjs smoke --jobs 4          # ~5 min: menu, shell, pregame, live field, engine…
node scripts/run-checks.mjs camera                  # one area (a suite from scripts/checks.json)
node scripts/run-checks.mjs v147Dcheck v145check    # named checks (".mjs" optional)
node scripts/run-checks.mjs --since main            # the suites your diff touches
node scripts/run-checks.mjs full --jobs 4 --retry-flaky --timeout 2400
node scripts/run-checks.mjs --list                  # every suite, its size and what it covers
```

npm shortcuts: `npm run check -- <suite>`, `npm run check:smoke`, `npm run check:area -- camera`,
`npm run check:since` (against `main`), `npm run check:fast`, `npm run check:full`, `npm run check:list`.

**No `npm run dev` needed.** The runner starts its own dev server per job on a free port from
`--base-port` (default 5400; each job probes upward from `base + 3·job`), waits for the first page to
come back (a full html transform — several seconds on a loaded box), and stops it at the end. The
server is `scripts/lib/serve.mjs`: the same vite and `vite.config.js`, started through vite's API, so
its command line does not contain "vite" — during the baseline somebody's `pkill -f vite` took every
dev server on the box down mid-run. Before each check the runner makes sure its server still takes a
connection and starts another if not, and a check that died on `ERR_CONNECTION_REFUSED` is re-run once
(that is infrastructure, not a flake). Set `GAME_URL` to reuse a server you already have running
instead (`GAME_URL=http://localhost:5173/ node scripts/run-checks.mjs smoke`) — every job then shares it.

## Flags

| flag | what it does |
|---|---|
| `--jobs N` / `-j N` | parallel checks (default `min(4, cpus)`). One vite server per job. |
| `--base-port P` | first port to probe for the servers (default 5400). |
| `--retry-flaky` | a check that fails with something NEW runs once more; if the retry is clean it is reported `FLAKY` (not a failure) with the first try's assertions listed. |
| `--since <ref>` | picks suites from the diff between `<ref>` and the working tree (committed or not, plus untracked files); `--since A..B` compares two commits. See below. |
| `--timeout S` | per-check wall limit in seconds. Default: the manifest's `timeoutSec`, else `max(300, 3 × runtimeSec)`. |
| `--out DIR` | where logs go (default `$TMPDIR/gridiron-checks/<timestamp>/`). |
| `--json` | print the summary as JSON instead of the table (it is always written to `<out>/summary.json`). |
| `--dry` | print what would run, with the reason each check was picked and its estimate, and stop. |
| `--report DIR` | re-judge an earlier run's logs against the CURRENT parser and baseline, without running anything. |
| `--record-known` | append every NEW failing assertion to `scripts/known-failures.json` (edit the notes afterwards). |
| `--list` | the suites. |

## What you get

Every check's whole stdout+stderr goes to `<out>/<check>.log` (`<check>.retry.log` for a retry,
`_server_<port>.log` for a server, with its start and exit stamped), plus a `<check>.result.json` as each one lands and `summary.json`
at the end. The console gets one progress line per check as it finishes, then a table and the
details:

```
check                    status    time  result
v90check                 KNOWN      21s  10 ok / 1 fail / exit 1
v147Dcheck               PASS     3m12s  41 ok / 0 fail
...
KNOWN v90check
     · the OVR ring fills ovr/250 of the circle  ovr=24 arc=0.615  — the ring fills to softMaxOvr since v134
```

| status | meaning |
|---|---|
| `PASS` | exit 0, no failing assertion, no page errors, at least one passing assertion (or `VERDICT: PASS`). |
| `INFO` | exit 0 and nothing failed, but the script prints no assertions at all (a report such as `simcheck`, `tacklecheck`, `renderpathcheck`, or `walk` / `shot`). Read its log. |
| `KNOWN` | it failed, and **every** failing item matches `scripts/known-failures.json` — it was failing on main before you. |
| `NEW` | at least one failing item is not in the baseline. **This is you** (or a new flake — see `--retry-flaky`). |
| `FLAKY` | failed, then passed on the `--retry-flaky` rerun. |
| `TIMEOUT` | killed at the time limit (the whole process group, so no Chromium is left behind). |

The exit code is 1 only if something is `NEW` or `TIMEOUT`. `FIXED?` under a check means a
baseline entry did not fail this run — prune it if it stays gone.

### How a result is read

The existing checks print in several house styles; the runner normalises all of them to
pass / fail counts + failing assertion lines + page errors + exit code:

- `ok   <label>` / `FAIL <label>` lines (also `PASS`, `OK`, `✓`/`✗`) — one assertion each;
- a one-line JSON object with numeric `pass` and `fail` (and `pageErrors` or `errors`);
- `N passed, M failed`, `N ok, M failed`, `N/M passed`;
- `VERDICT: PASS` / `VERDICT: FAIL [..json array of labels..]`;
- the page-error line in every spelling (`page errors: none`, `page errors: 0`, `page errors:` + a list,
  `PAGE ERRORS:`, `no page errors`, `JS pageerrors: none`, `ERRORS:`); any page error is a failure;
- `>> <step> -> MISS` (a click-through step that found no button) is counted as a navigation miss,
  shown in the table, and is **not** a failure by itself;
- a non-zero exit with no failing line becomes `exit N: <last lines of the log>`.

## Suites

`scripts/checks.json` has two maps. `checks.<name>`: `file`, `desc`, `areas` (the suites it is in),
`runtimeSec` (the best clean sample from the baseline runs, 3–4 jobs on a 4-core box at load 8–33 —
alone it is usually faster), `slow` (over 6 min: `blowoutcheck`, `bootviewcheck`, `coachcheck`,
`postgamecheck`, `v105check`, `v109Bcheck`, `v111Acheck`, `v112Echeck`, `v146Acheck`, `v146Dcheck`,
`v147Acheck`, `v147Dcheck`; never in `smoke`), `needsServer`, `pureNode`, `loadSensitive` (failed at
high load, passed on a quieter rerun), `flaky` (assertion labels seen flipping — documentation only;
only `known-failures.json` excuses a failure), and optional `args` / `env` / `timeoutSec` / `note`.
The runner schedules longest-first, and a check's default time limit is `max(300 s, 3 × runtimeSec)`.
`suites.<name>`: `desc`, `checks`, `anchors` (the banner tags / text that map a diff to it) and
`files` (globs).

Every row of the old CLAUDE.md "Verify before committing" table is a suite (rows about the same area
share one; the table itself is now the generated appendix at the end of this page): `career-uff` (v147 A), `menu-coin` (v147 B), `gear` (v147 C), `camera` (v147 D / v112 E /
v145), `league`, `contact` (v146 A), `cuts` (v146 B), `impossible` (v146 C), `plan` (v146 D), `shell`
(v146 E), `field` (v144), `statinfo` (v142), `sim-keys` (v141), `boot` (v140), `combine` / `age` (v139),
`vault` (v137), `tackle` (v143 + contact physics), `lineage` / `pp-bank` / `summary` (v136 D/C/B),
`pregame` (v136 A / v112 D / v126), `wheel` (v135), `goals` (v134), `grow`, `grades`, `coach`, `loader`,
`menu`, `reads`, `credit`, `slots`, `sim`, `injury`, `ovr`, `between-plays`, `coverage`, `rank`,
`badges`, `kits`, `lights`, `playbook`, `endzones`, `field-art`, `story`, `snaps`, `origin`, `launch`,
`position`, `feel`, `stride`, `throw`, `pile`, `plant`, `catch`, `crew`, `clock`, `names`, `honors`,
`emblems`, `training`, `rivalry`, `crowd`, `declare`, `modes`, `ui`, `rows` (v148), `layout` (v149 A),
`pwa` (v149 D), `monetize` (v149 E), `docs` (v150 D). Plus:

- `smoke` — fast and broad, 18 checks, none over ~3 min, all passing (or KNOWN) on main: `namecheck`,
  `walk`, `shot`, `menu-integration-check`, `honorcheck`, `freshcheck`, `v85check`, `v146Echeck` (the
  shell), `v112Dcheck` (the pregame), `v144check` (the live field), `simcheck` (the engine), `v110check`
  (who makes the play), `v146Bcheck` (the UFF career), `v147Ccheck` (gear), `scrollcheck`, `v142check`,
  `agecheck`, `traincheck` (+ the pure-Node `layoutcheck` and `anchorcheck`, seconds each). 4m52s wall at `--jobs 4` (18m40s of check time). Run it before any commit.
  (`bootviewcheck` is the v140 gate but takes ~9 min — `--since` adds it whenever index.html changed.)
- `fast` — every check not marked `slow` (generated).
- `full` — every check in the manifest (generated).

The build steps (`bake-menu-into-index.mjs`, `build-*-art`) and the look-at-it utilities (`menushot.mjs`,
`vaultshot.mjs`, `growshot.mjs`, …) are not checks and are not run; a suite lists them in its optional
`steps` / `look` fields (the appendix's "by hand" column) — do those yourself. Env-var variants (`READ_POS=WR MODES=0,1,4,5 v147Dcheck`,
`POS=QB,DL,S v146Dcheck`, `WHEEL=1 v112Dcheck`) are passed straight through: set them on the runner's
command line and every check sees them.

### `--since`

For each changed file:

1. a changed `scripts/<check>.mjs` runs that check;
2. a file matching a suite's `files` glob pulls the suite (`public/rib-vault*` → `vault`,
   `public/rib-menu*` → `menu`, `public/coach/**` → `coach`, …);
3. any other `.html` / `.js` / `.css` (index.html, or the files it is split into) is read hunk by hunk:
   for each changed line the runner trims the prefix and suffix it shares with the line it replaced
   (the career block is one-liners thousands of characters long), then takes the nearest banner or
   marker comment before the change (`/* ===== v147 D THE CAMERA …`, `// v147 D: …`), any banner inside
   it, and every `vNN` tag / `fooV123` identifier in the changed segment, and matches them against each
   suite's `anchors` (a lettered tag like `v147 d` needs the letter; a bare `v144` matches any `v144 x`).
   An index.html change also always runs `bootviewcheck` (the v140 rule);
4. a change to the harness (`scripts/lib/`, `run-checks.mjs`), `vite.config.js` or `package.json` → `smoke`;
5. nothing mapped → `smoke`.

`--dry` shows what was picked and why. It is a heuristic — for a one-line tweak it picks one or two
suites; for a sweeping commit (a rename across the file) it picks most of them, which is correct.

## The baseline — `scripts/known-failures.json`

```json
{ "failures": [
  { "check": "v90check", "pattern": "the OVR ring fills ovr/250 of the circle",
    "note": "why it fails on main", "since": "2026-09-24", "flaky": false }
] }
```

`pattern` is a regular expression tested against each failing item of that check (`"check": "*"`
applies to all). `flaky: true` marks an assertion that fails only sometimes on main — it is accepted
when it fails and not reported as `FIXED?` when it passes.

**Updating it.** When you fix one, delete its entry (the runner's `FIXED?` note tells you which).
When main has a failure you did not cause and cannot fix now: run the check, then either add the
entry by hand or `node scripts/run-checks.mjs <check> --record-known` and replace the recorded note
with the reason. Never add an entry for something your own change broke. `--report <dir>` re-reads a
previous run so you can iterate on the file without re-running anything.

### The baseline on main (2026-09-24, `ca9db0a`)

Established by the full suite at `--jobs 4` (the box at load 15–33 with other agents' runs), then every failing
check re-run twice at `--jobs 3`. **Always** = failed on every run that got far enough to test it;
**sometimes** = the `flaky: true` entries.

| check | assertion (pattern) | | why |
|---|---|---|---|
| `availabilitycheck` | worn or injured is -10% stats | always | stale: v120 made fatigue a slope (fatigueMulV120) — worn now reads 0.85, not the flat 0.90 this asserts |
| `availabilitycheck` | in between is neutral | always | stale: v120's slope puts a mid-fatigue man at 0.967, not 1.0 |
| `badgecheck` | (live field is up\|the wall mounts inside .field-wrap\|watched a run of plays\|a badge was on screen during the run) | sometimes | its click-through (PLAN -> null) often never reaches the live field since the v146 D plan board; 3 of 4 tries failed, one passed |
| `bobcheck` | (the crystal floats above the head\|it turns — the silhouette changes\|the live field is up\|it draws over the players\|a gassed player gets a different crystal) | sometimes | +5.5px above the sprite root / 0.55px width swing on the run that reached the field; the other runs never reached it (a crash in the probe) |
| `bobcheck` | exit 1: page.evaluate | sometimes | the probe throws when the live field never comes up |
| `bodycheck` | an ordinary body reads neutral | always | reads -1.93 (NET NEGATIVE) on every run |
| `crowdcheck` | and the scan now covers the curved north end too | always | the scan count (182 / 120 / 120) is under the check's floor on every run |
| `crowdcheck` | (crowdCheer raises section heat\|cheer layer alpha follows heat\|heat decays back down after the roar) | sometimes | peak 0 — the roar never registered on 2 of 4 tries (timing) |
| `declarecheck` | the season-result declare card states the one-shot stakes | always | copy drift on the declare card |
| `declarecheck` | the epitaph fits inside v75's scroll budget on a phone | always | 2.15 screens, every run |
| `emblemcheck` | pregame: 2 emblem chips, 44px | sometimes | the chips measure 0x0 (w:0,h:0) — 3 of 4 tries |
| `endzonecheck` | the painted far goal line lands where the projection puts the sim far goal line | always | 1.09 yards apart on every run |
| `equaltalentcheck` | (all rosters are exact mirrors\|featured player matches team talent) | always | both runs; it loads index.html's blocks by index ([0,1,2,3,4,7]) — recheck after the index.html split lands |
| `gatecheck` | the weekly plan wheel inside the pregame wizard is NOT gated | always | stale since v146 D: page 5 is the plan BOARD, there is no wheel to find (wheel:false) |
| `growthcheck` | exit 1 | always | magnitude.min is 2 (< 3) in the v42 Monte Carlo; the script has no assertion lines, only exitCode. (Before v149 B it did not even launch: chromium.launch() had no executablePath.) |
| `heroflashcheck` | \d+ failure(s) counted with no assertion line | always | the script adds every failed request to `fail`; 27–32 menu/coach/vault images come back requestfailed (aborted) on every run |
| `heroflashcheck` | (the hero canvas loop is running\|no spawn lands on the player) | sometimes | 55 frames / mask alpha 19 — one run each |
| `menufxcheck` | v89's contract holds — eight tiles, seven links | always | 9 tiles since the coach tile — stale count |
| `menufxcheck` | the OVR spark sits at the head of the arc | always | arc 0 -> 165deg / 0.014 -> 180deg / 0.35 -> 148deg: every run (v147 B ringArcV147B) |
| `menufxcheck` | the ember loop is running | sometimes | a frame count (3 -> 7, 5 -> 6): load-sensitive |
| `movecheck` | all three moves are in the game | always | [41.3, 0, 58.7] / [45.2, 0, 54.8] — the middle move never fires |
| `movecheck` | and he hangs there longer for it | always | 360ms -> 440ms, every run |
| `movementcheck` | movementcheck failed: .*from the v37 calibration | always | completion% -16, air YPA -14, YAC/completion +63 against the v37 calibration (pure Node, deterministic) |
| `postgamecheck` | a live game reaches the post-game card | always | its click-through never reaches the card (both runs) |
| `rankcheck` | the leaders screen still states a rank and a population | always | every run |
| `readcheck` | play action pays out at least even with a straight dropback | always | 9.35 vs 10.56 YPA (pure Node, seeded — identical every run) |
| `sidelinecheck` | the far end of the sideline sits in dimmer air than the near end | sometimes | 570 < 646 failed, 578 < 644 passed — a knife edge |
| `sidelinecheck` | (and the reaction dies back down\|rain breaks out the ponchos) | sometimes | timing; one run each |
| `starimpactcheck` | exit 1: Error: Could not install the star-gap benchmark hook | always | the hook it wraps is gone; the check never starts |
| `stridecheck` | college a lot more than high school | always | 0.114 -> 0.105 (pure Node, identical every run) |
| `v101check` | (the first play was choreographed while the loading chase was still running\|and the door opened onto that already-built play) | always | built 0 / misses 1 on every run — v132 took the chase out of door two |
| `v104check` | (every pose that can show a number carries a band read off the art\|and it stays inside a sane on-screen size band) | always | the catchseq3 poses carry no band; size band 2.03..11.20px (the one run that reached the field) |
| `v104check` | (the broadcast is live with markers on the field\|every registered player texture was scanned\|and it is the SAME numeral pose to pose\|and the old fixed offset really was in the pants\|numbers were drawn front and back\|the label is rasterized ONCE) | sometimes | the cascade when its click-through does not reach the live field |
| `v108check` | (and a toss played toss_up0..4\|a handoff played handoff_up0..4\|one football through every drawn frame) | sometimes | sample-size: 0/1 tosses in a short watch; 3 of 4 tries |
| `v112Acheck` | (every byte of the sheet had landed\|COLD: the first animated frame\|the splash door paints within the budget\|the mount keeps drawing frames\|a later scene is a synchronous start\|it had a picture up with nothing left to load\|and that picture is the film loader) | sometimes | millisecond budgets (700ms / 250ms / 150ms) on a box at load 15–30; unverified on an idle one |
| `v112Ccheck` | with no penalty condMultV54 is bit-identical to its pre-v112 constants | always | stale: v120's fatigue slope changed those constants (0.967 / 0.833 / 1.05) |
| `v127check` | (door two still plays the FILM\|and it built that element itself\|it gets the picture up inside its audition\|and starts at v116.s seam) | sometimes | film=false chase=false on both tries of the baseline run; unverified on an idle box |
| `v110check` | and the credit follows the man who made the play, never the man who was assigned | sometimes | `1 wrong` in 2 of 3 runs (4 followed · 1 wrong; 1 followed · 1 wrong) — a rare interception/break-up credited to the assigned man. Stat-credit truth: worth a real look, not just a baseline entry |
| `v144check` | D: (both goalposts are drawn standing in a pad\|and there is one at each end of the field) | sometimes | `1 pads` on 1 of 3 runs — the far post was off the frame when it looked |
| `v141check` | DFL RB 250 vs 350 (speed\|grit) >= 3 apart under the carrier ceiling | always | 64 -> 66.7 / 64.5 -> 67.4: the v141 RB knee (simKneeTopPosV141) squeezes them under 3 |
| `v90check` | the OVR ring fills ovr/250 of the circle | always | the ring fills to softMaxOvr since v134, not /250 |
| `v92check` | the whistle freezes the feed into a replay still | sometimes | 2 of 3 tries |
| `v93check` | TOUCHDOWN at the far end and the opponent's name at the near are both lettered | always | far=0 — the far end zone's lettering is not found |
| `v93check` | exit 1: page.evaluate: TypeError: Cannot read properties of undefined (reading 'teamNames') | sometimes | the probe throws when the live field is not up yet |
| `vaultcheck` | a RELOAD mid-pour loses nothing and buys nothing | always | [5000, 4992] — 8 PP debited across the reload, every run |
| `vaultcheck` | (the vault holds a usable frame rate under a 16x pour\|and then it goes to sleep, so a settled hoard costs nothing\|RESTOCK puts the shed coins back in their columns) | sometimes | fps / settle timing on a loaded box; one run each |

**Load-sensitive** (`loadSensitive: true` in the manifest — failed at load ~25 during the baseline, passed on a quieter
rerun, so they are NOT in the baseline and a failure prints a hint to rerun alone): `badgecheck`, `bobcheck`, `coachcheck`, `crowdcheck`, `emblemcheck`, `heroflashcheck`, `kitsidecheck`, `menufxcheck`, `sidelinecheck`, `skillartcheck`, `splashcheck`, `v103check`, `v104check`, `v107check`, `v108check`, `v109Acheck`, `v109C1check`, `v111Acheck`, `v112Acheck`, `v112Bcheck`, `v112Echeck`, `v114check`, `v115check`, `v127check`, `v136check`, `v147Acheck`, `v92check`, `v93check`, `v99check`, `vaultcheck`.

`blowoutcheck` did not finish inside 40 minutes at that load (1,600 live games) and has no baseline; run it alone,
or `BLOW_N=400`.


### How long

| run | wall | check time |
|---|---|---|
| `smoke --jobs 4` | 4m52s | 18m40s |
| `full --jobs 4 --retry-flaky --timeout 2400` (119 checks, load 15–33) | 2h09m42s | 8h26m (with ~40 retries and a 2×40 min `blowoutcheck` timeout) |
| the manifest's serial estimate for `full` | — | ~4h50m (of which `blowoutcheck` ~45 min) |

`fast` (everything not `slow`) is the practical "run it all" on a 4-core box.

## Parallel runs do not interfere

- every job has its own vite server and port (5400+ by default; the main session's 5173 is never used);
- every check launches its own Chromium with a fresh throwaway profile (`chromium.launch()`), so
  localStorage, IndexedDB and the service worker are never shared;
- `SPLASH_URL`, `MENU_URL`, `SIDE_URL`, `MENU_INTEGRATION_URL`, `DECLARE_URL`, `URL` and `BASE_URL` are
  scrubbed from each check's environment so every script lands on its job's server;
- the screenshots some checks write (`scripts/_*.png`, `_splash_*.png` …) have per-script names.

What they DO share is the CPU. Timing-sensitive checks (frame rates, film playheads, camera lag,
chase animations) are the first to wobble when the box is loaded; that is what `--retry-flaky` and
the `flaky` flags are for. On a 4-core box, `--jobs 4` is the ceiling.

## One URL source — `scripts/lib/env.mjs`

```js
import { GAME_URL, gameUrl, CHROME, launch } from './lib/env.mjs'
GAME_URL                 // process.env.GAME_URL, else http://localhost:${PORT || 5173}/
gameUrl('?stayStale')    // resolved against GAME_URL (works if GAME_URL ends in / or in index.html)
CHROME                   // CHROME_PATH, PLAYWRIGHT_CHROMIUM, /opt/pw-browsers/chromium, else Playwright's own
await launch()           // chromium.launch({ executablePath: CHROME })
```

Every check reads the game's address through it, so `GAME_URL=http://localhost:5401/ node
scripts/v144check.mjs` points any script at any server — no port-swapped copies. With nothing set,
every script behaves exactly as before: `npm run dev` on 5173, `node scripts/<check>.mjs`.

## Adding a check

1. Write `scripts/<name>check.mjs`. Take the URL from `scripts/lib/env.mjs` (never hard-code a port),
   launch Chromium with `CHROME` / `launch()`.
2. Print in the ONE convention for new checks:

   ```
   ok   <what is true>  <evidence>
   FAIL <what should be true>  <evidence>
   ...
   {"pass":12,"fail":0,"pageErrors":0}
   ```

   one `ok`/`FAIL` line per assertion (label first, so the baseline can match it by text; keep numbers
   after the label), a final one-line JSON with `pass`, `fail`, `pageErrors`, and `process.exit(1)` on
   any failure or page error. Screenshots go to a per-script name (`scripts/_<name>_*.png`) or a
   directory from an env var.
3. Add it to `scripts/checks.json`: an entry in `checks` (desc, areas, `runtimeSec`, `slow`,
   `needsServer`, `pureNode`) and its name in each suite it belongs to (and `smoke` if it is fast and
   broad). A check in no suite still runs under `full` / `fast`.
4. Add a row to `scripts/README.md`, then `node scripts/checks-table.mjs` to regenerate the appendix below
   (`anchorcheck` fails while it is stale).
5. `node scripts/run-checks.mjs <name>` — it must come back `PASS`.

<!-- CHECKS-TABLE:BEGIN (generated by scripts/checks-table.mjs from scripts/checks.json — do not edit by hand) -->

## Appendix — which suite for which change (generated)

Every suite in `scripts/checks.json` (75 suites, 129 checks; `fast` and `full` are
generated by the runner). `node scripts/run-checks.mjs --since main` picks these for you from the diff; run
one by name with `node scripts/run-checks.mjs <suite> --jobs 4`. "Pulled by" is what `--since` matches (banner
tags / text in a changed hunk, or a changed file glob). The last column is by hand: builds to run first,
env-var variants, and screenshot utilities to LOOK with — the runner does none of those.

| suite | for a change to… | checks | pulled by | by hand |
|---|---|---|---|---|
| `smoke` | fast and broad — boot to menu, the shell, a career screen or five, the pregame, the live field, the engine; every check here is under ~3 min and passes on main. Run before every commit. | `namecheck`, `walk`, `shot`, `menu-integration-check`, `honorcheck`, `v85check`, `v146Echeck`, `v112Dcheck`, `v144check`, `simcheck`, `v110check`, `v146Bcheck`, `v147Ccheck`, `scrollcheck`, `freshcheck`, `v142check`, `agecheck`, `traincheck`, `layoutcheck`, `anchorcheck`, `v150Acheck` | — |  |
| `docs` | v150 D — the agent docs: CLAUDE.md, docs/ANCHORS.md, the READMEs; anchors and paths still resolve | `anchorcheck`, `layoutcheck` | `v150 D`, `CLAUDE.md`, `README.md`, `docs/**`, `scripts/README.md`, `scripts/checks.json` |  |
| `career-uff` | v147 A — retiring above college, sim the rest at 7+, stale offers, auto-answered story decisions | `v147Acheck`, `v146Bcheck`, `rivalcheck`, `v90check`, `v85check`, `v136check`, `declarecheck`, `v88check`, `bootviewcheck`, `v146Echeck`, `walk` | `v147 A` |  |
| `menu-coin` | v147 B — the menu prestige coin, the OVR ring arc and spark, the milestones trophy | `v147Bcheck`, `menu-integration-check`, `menufxcheck`, `heroflashcheck`, `sheencheck`, `honorcheck`, `freshcheck`, `menu-mask-check` | `v147 B`, `scripts/build-uff-trophy.mjs`, `public/menu/**` | first: `node scripts/build-uff-trophy.mjs` (if the trophy art changed); `RIB_MENU_VERSION=<stamp> node scripts/bake-menu-into-index.mjs` (any `public/rib-menu*` / `rib-vault*` file) · look: `CAREER=1 node scripts/menushot.mjs` |
| `gear` | v147 C — gear rolled modifiers, catalogue, migration, locker | `v147Ccheck`, `bootviewcheck`, `v85check`, `creditcheck`, `statcreditcheck`, `injurycheck`, `v146Echeck`, `v146Dcheck`, `walk`, `menu-integration-check` | `v147 C` |  |
| `camera` | v147 D / v112 E / v145 — what the camera follows, how tight, the play-rate camera, follow cams | `v147Dcheck`, `v112Echeck`, `v145check`, `v109Echeck`, `v86check`, `v98check`, `v105check`, `renderpathcheck`, `sidelinecheck`, `v144check`, `v148check` | `v147 D`, `v112 E`, `v145`, `CAM_MODES`, `camSpring` | also: `READ_POS=WR MODES=0,1,4,5` for `v147Dcheck` |
| `league` | any league name a player reads (the UFF) | `coachcheck`, `v146Bcheck`, `menu-integration-check`, `walk` | `UFF`, `DFL_V123` |  |
| `contact` | v146 A — who is on him when he goes down, the fall together, the taken sack | `v146Acheck`, `v143check`, `scoreneutralcheck`, `tacklecheck`, `jukecheck`, `creditcheck`, `v103check`, `v109C1check`, `v112Fcheck`, `renderpathcheck`, `v86check`, `v110check`, `v151Dcheck` | `v146 A`, `v151 D` |  |
| `cuts` | v146 B — UFF cuts, the strike count, Second Chances, the three-offer club screen | `v146Bcheck`, `declarecheck`, `v88check`, `bootviewcheck`, `namecheck`, `v111Bcheck`, `v85check`, `menu-integration-check`, `honorcheck`, `walk` | `v146 B` |  |
| `impossible` | v146 C — the Impossible branch, the over-cap price, the wall, the Evergreen refund | `v146Ccheck`, `agecheck`, `capcheck`, `vaultcheck`, `honorcheck`, `v134check`, `v136check`, `bootviewcheck`, `walk` | `v146 C` |  |
| `plan` | v146 D — the weekly plan board, projection / variance, form swing, the live game inputs | `v146Dcheck`, `v112Dcheck`, `wheelcheck`, `coachcheck`, `v136check`, `v111Bcheck`, `v111Acheck`, `v85check`, `rivalcheck`, `traincheck`, `simcheck`, `bootviewcheck`, `walk` | `v146 D` | also: `POS=QB,DL,S` for `v146Dcheck` (default RB,WR,LB) |
| `shell` | v146 E — the shell: fixed top bar, bottom tabs, the page that never scrolls, the report card tabs | `v146Echeck`, `scrollcheck`, `bootviewcheck`, `coachcheck`, `v112Dcheck`, `gatecheck`, `menu-integration-check`, `vaultcheck`, `walk` | `v146 E` | look: `node scripts/v146Eshot.mjs` |
| `field` | v144 — sprite scale by age, stall watchdog, between-plays shuffle, goalpost pad, apron, pylons, weather | `v144check`, `v112Bcheck`, `sidelinecheck`, `v98check`, `v99check`, `v100check`, `v92check`, `v102check`, `crowdcheck`, `v93check`, `v86check`, `v87check`, `renderpathcheck`, `v91check`, `v104check`, `v105check`, `v107check`, `v108check`, `kitsidecheck`, `v117check`, `badgecheck`, `v109Echeck`, `scrollcheck`, `bootviewcheck`, `walk`, `shot`, `v148check` | `v144` |  |
| `statinfo` | v142 — the ⓘ beside a stat, the stat cards, adding an attribute | `v142check`, `bootviewcheck`, `walk`, `shot`, `scrollcheck`, `capcheck` | `v142` |  |
| `sim-keys` | v141 — which sheet stats reach the sim, attribute scale past 250, star floor, durability | `v141check`, `scoreneutralcheck`, `equaltalentcheck`, `creditcheck`, `statcreditcheck`, `v117check`, `simcheck`, `injurycheck` | `v141` |  |
| `boot` | v140 — the top level of the career block, the boot, functions a rendered screen calls by bare name | `bootviewcheck`, `splashcheck`, `walk`, `vaultcheck`, `menu-integration-check`, `shot`, `v150Acheck` | `v140`, `safeBootV140` |  |
| `combine` | v139 — the combine drills, weeks, board, leaders tab | `combinecheck`, `v88check`, `declarecheck`, `rankcheck`, `coachcheck`, `simcheck`, `v85check` | `COMBINE_V139`, `THE COMBINE` |  |
| `age` | v139 — age curve, endgame nodes, grade floor, honors payout, surname, bottom nav, wheel gate, tiers, carrier moves | `agecheck`, `tiercheck`, `gatecheck`, `movecheck`, `coachcheck`, `wheelcheck`, `v112Dcheck`, `v136check`, `honorcheck`, `scrollcheck`, `menu-integration-check`, `emblemcheck`, `walk` | `v139` |  |
| `vault` | v137 — the Prestige Vault: hoard, spend, door, payout, sprites | `vaultcheck`, `honorcheck`, `v134check`, `coachcheck`, `menu-integration-check`, `v136check`, `freshcheck` | `v137`, `public/rib-vault*`, `public/vault/**`, `scripts/build-vault-art.py`, `scripts/vaultcut.py` | first: `python3 scripts/build-vault-art.py --proof` (if a cell moved — then LOOK at `art/vault-proof/`); `RIB_MENU_VERSION=<stamp> node scripts/bake-menu-into-index.mjs` (any `public/rib-menu*` / `rib-vault*` file) · look: `vaultshot.mjs` / `WIDE=1 vaultshot.mjs` / `vaultspend.mjs` / `vaultdoor.mjs` / `vaultphys.mjs` |
| `tackle` | v143 + contact physics — approach angle, windup, low/mid/high, what each aim costs | `v143check`, `scoreneutralcheck`, `tacklecheck`, `jukecheck`, `creditcheck`, `v103check`, `v109C1check`, `v112Fcheck`, `renderpathcheck`, `v86check`, `v151Dcheck` | `v143`, `hitGeoV109`, `v151 D` | first: `scoreneutralcheck` over several seeds, against the OFF spread (the aim roll changes sample paths) |
| `lineage` | v136 D — the lineage: the son, the surname, family years | `v136check`, `coachcheck`, `menu-integration-check`, `honorcheck`, `declarecheck`, `walk` | `v136 D` |  |
| `pp-bank` | v136 C — when PP is paid: the bank, the settle, the career-end card | `v136check`, `v134check`, `v85check`, `origincheck` | `v136 C` |  |
| `summary` | v136 B — the COACH'S SUMMARY button and its AUTO switch | `coachcheck`, `v112Dcheck` | `v136 B` |  |
| `pregame` | v136 A / v112 D / v126 — the pregame wizard's pages, rivalry spin, next-opponent card, wear copy | `v136check`, `v112Dcheck`, `wheelcheck`, `rivalcheck`, `v111Bcheck`, `coachcheck`, `walk`, `scrollcheck`, `namecheck`, `splashcheck`, `shot` | `v136 A`, `v112 D`, `v126` | also: `WHEEL=1` for `v112Dcheck` |
| `wheel` | v135 — the game-plan wheel, the held roll, the fifth pregame page | `v112Dcheck`, `wheelcheck`, `coachcheck`, `v111Bcheck`, `v85check`, `walk`, `scrollcheck` | `v135` |  |
| `goals` | v134 — goal payouts, Hall of Fame box scores, Apex branch, ring soft max, season strip | `v134check`, `coachcheck`, `growcheck`, `menufxcheck`, `menu-integration-check`, `honorcheck`, `stridecheck`, `rivalcheck`, `v85check`, `declarecheck`, `walk` | `v134` |  |
| `grow` | v132 / v133 / v134 — the offseason body screen, the growth figure and its art | `growcheck`, `coachcheck`, `declarecheck`, `walk` | `v132 A YEAR`, `v133 THE BOY`, `GROW_V132`, `growDraw`, `public/grow/**`, `scripts/build-grow-art.py` | first: `python3 scripts/build-grow-art.py` (if the figure's art changed) · look: `growshot.mjs` / `VET=42 growshot.mjs` |
| `grades` | v133 — the training board's grades, tiers, the pick | `gradecheck`, `traincheck`, `capcheck`, `skillartcheck`, `scrollcheck`, `coachcheck` | `v133 THE COACH GRADES` | look: `BOARD=1 growshot.mjs` |
| `coach` | v119 / v122 / v133 — the coach: stops, talking head, spotlights, voice, the season debrief | `coachcheck`, `faqcheck`, `menu-integration-check`, `walk`, `v85check`, `postgamecheck`, `declarecheck` | `v119`, `v122`, `v133 THE COACH HAS`, `public/rib-menu-coach*`, `public/coach/**`, `scripts/build-coach-art.py` | first: `python3 scripts/build-coach-art.py` (if a sheet changed); `RIB_MENU_VERSION=<stamp> node scripts/bake-menu-into-index.mjs` (any `public/rib-menu*` / `rib-vault*` file) |
| `loader` | v94 / v112 A / v114–v116 / v121 / v127 / v132 — the splash, the film, the live game's loader | `splashcheck`, `v114check`, `v115check`, `v127check`, `v112Acheck`, `shot`, `walk`, `v86check`, `renderpathcheck` | `v94`, `v112 A`, `v114`, `v115`, `v116`, `v121`, `v127`, `v132 THE INTRO`, `v132 THE FILM`, `public/rib_film*`, `scripts/build-splash-film.mjs` | first: `node scripts/build-splash-film.mjs` (if the film changed; `+faststart`) |
| `menu` | v89 / v102 / v106 / v106.1 / v107.1 / v132 — the main menu, its feed, effects, masks, staleness | `menu-integration-check`, `menufxcheck`, `heroflashcheck`, `sheencheck`, `menu-mask-check`, `freshcheck`, `v102check`, `honorcheck` | `v89`, `v106`, `v107.1`, `v132 A THOUSAND`, `RIB_DIRECT_MENU`, `public/rib-menu*`, `public/menu/**`, `scripts/menu-kit-*.py`, `scripts/build-menu-art.*`, `scripts/bake-menu-into-index.mjs`, `scripts/assemble-pages.mjs` | first: `RIB_MENU_VERSION=<stamp> node scripts/bake-menu-into-index.mjs` (any `public/rib-menu*` / `rib-vault*` file); `python3 scripts/build-menu-art.py` (or the one `menu-kit-*.py`) for the kit masks · look: `CAREER=1 node scripts/menushot.mjs`; `node scripts/menu-kit-shot.mjs`; `node scripts/menu-preview-shot.mjs` |
| `reads` | v81 / v82 — defender reads, blocking, pursuit, the point of attack | `readcheck`, `movementcheck`, `simcheck`, `reactioncheck` | `v81`, `v82`, `GRIDIRON FieldSim` |  |
| `credit` | stat credit / the box score | `creditcheck`, `statcreditcheck` | `v16 EMERGENT`, `who ACTUALLY made the stop` |  |
| `slots` | v117 — who is on the field, duplicate players, which slot he lines up in | `v117check`, `creditcheck`, `statcreditcheck`, `v110check`, `scoreneutralcheck`, `simcheck` | `v117` |  |
| `sim` | game engine / play-calling / yardage, and whether it is visible | `simcheck`, `renderpathcheck`, `scoreneutralcheck`, `blowoutcheck`, `teamqualcheck`, `yardfitcheck`, `starimpactcheck` | `v16 EMERGENT`, `GRIDIRON FieldSim`, `GRIDIRON play choreography` |  |
| `injury` | injuries and availability | `injurycheck`, `availabilitycheck` | `v54`, `materializeInjuryV18` |  |
| `ovr` | v85 — OVR scale, the silent sim path, the attribute sheet | `v85check`, `bodycheck`, `wheelcheck` | `v85` |  |
| `between-plays` | v86 — the renderer between plays, tackle looks | `v86check` | `v86` |  |
| `coverage` | v87 — pass coverage / credit, QB scramble & targets, the safety, the huddle | `v87check`, `creditcheck`, `simcheck` | `v87` |  |
| `rank` | v88 / v125 — national rank, promotion odds, the declare | `v125check`, `rankcheck`, `v88check`, `declarecheck`, `v85check` | `v88`, `v125` |  |
| `badges` | v95 — the callout badges | `badgecheck`, `v86check` | `v95`, `public/badges/**`, `scripts/build-badge-art.*` | first: `node scripts/build-badge-art.mjs` (if a badge changed) |
| `kits` | v96 / v104 / v105 / v105.2 — kits, jersey numbers, the ball between hands, the heat book | `kitsidecheck`, `v104check`, `v105check`, `v86check`, `sidelinecheck`, `v91check`, `v92check`, `v99check`, `crowdcheck`, `renderpathcheck`, `bobcheck` | `v96`, `v104`, `v105` |  |
| `lights` | v92 / v98 / v99 / v100 / v102 / v112 B — the lights, shadows, lighting dial, stadium, masts | `v102check`, `v98check`, `v99check`, `v92check`, `v86check`, `v100check`, `sidelinecheck`, `crowdcheck`, `postgamecheck`, `v112Bcheck`, `menu-integration-check` | `v92`, `v98`, `v99`, `v100`, `v102`, `v112 B`, `scripts/build-stadium-art.*` | first: `scripts/build-stadium-art.*` (if the stadium art changed) |
| `playbook` | v101 — asset paths, the playbook, the throw, shading, prebuild, crowd emoji | `v101check`, `simcheck`, `readcheck`, `routecheck`, `v99check` | `v101` |  |
| `endzones` | v72 / v93 — the painted end zones, home and away | `v93check`, `endzonecheck`, `v86check` | `v93`, `v72` |  |
| `field-art` | v91 / v107 / v108 / v118 — field sheets, QB sheets, throw facing, the exchange, the mesh | `v91check`, `v107check`, `v108check`, `v105check`, `v104check`, `renderpathcheck`, `v86check`, `kitsidecheck` | `v91`, `v107`, `v108`, `v118`, `scripts/build-field-art.*` | first: `node scripts/build-field-art.mjs` — read the printed `HAND_V108` / `BALL_DRAWN_V108` back into `src/05-field-renderer.js` |
| `story` | v90 — story rolls on the silent path, the upgrade sheet numbers | `v90check`, `v85check` | `v90` |  |
| `snaps` | v111 / v120 — the pregame ladder's snaps, coach trust, the fatigue slope | `v111Acheck`, `v111Bcheck`, `v111Ccheck`, `v112Dcheck`, `v85check`, `creditcheck`, `simcheck`, `scoreneutralcheck`, `faqcheck` | `v111`, `v120` |  |
| `origin` | v112 C / v131 — body now vs projected, the trait choice, the reroll penalty, origin cards | `origincheck`, `v112Ccheck`, `v112Dcheck`, `declarecheck`, `walk`, `bodycheck`, `v85check`, `menu-integration-check`, `simcheck`, `creditcheck` | `v112 C`, `v131` |  |
| `launch` | v112 F — a big hit taking a man off his feet | `v112Fcheck`, `v103check`, `v109C1check`, `tacklecheck`, `readcheck`, `renderpathcheck`, `scoreneutralcheck` | `v112 F` |  |
| `position` | v110 — being in position decides the play | `v110check`, `creditcheck`, `tacklecheck`, `readcheck`, `v103check`, `scoreneutralcheck` | `v110` |  |
| `feel` | anything in the live sim's FEEL (contact, possession, ball speed, catching, tackling, the clock) — v109 | `scoreneutralcheck`, `v109Acheck`, `v109Bcheck`, `v109C1check`, `v109C2check`, `v109Dcheck`, `v109Echeck` | `v109` | first: run `scoreneutralcheck` FIRST and keep the before row; compare several seeds against the OFF spread |
| `stride` | v129 — the ball in stride | `stridecheck`, `scoreneutralcheck`, `v109Bcheck`, `v101check`, `routecheck`, `simcheck` | `v129` |  |
| `throw` | v109 A — the throw's flight, arc, wobble, throwaway | `v109Acheck`, `v101check`, `v107check`, `v105check`, `simcheck` | `v109 THE BALL` |  |
| `pile` | v103 / v109 C1 — the grab, the pile, the strip, impact geometry, the bobble | `v109C1check`, `v103check`, `readcheck`, `tacklecheck`, `creditcheck`, `simcheck`, `renderpathcheck`, `v86check` | `v103`, `v109 THE HIT` |  |
| `plant` | v109 C2 — the plant, the lean, down men, the stumble | `v109C2check`, `readcheck`, `jukecheck`, `tacklecheck`, `v86check` | `v109 THE FEET` |  |
| `catch` | v109 B — the receiver's track, the reach and tuck, break-ups | `v109Bcheck`, `v87check`, `v107check`, `v91check`, `routecheck` | — |  |
| `crew` | v109 E — the camera crew, the huddle, celebrations, the QB eyes | `v109Echeck`, `v86check`, `v98check`, `refcheck`, `sidelinecheck` | — |  |
| `clock` | v109 D — the clock, the try, timeouts, the flag, the chains | `v109Dcheck`, `simcheck`, `postgamecheck`, `badgecheck`, `refcheck`, `walk` | `v109 THE GAME HAS A CLOCK`, `v109 THE STICKS`, `v109 THE FLAG` |  |
| `names` | v123 — school / college / club names and crests | `namecheck`, `emblemcheck`, `menu-integration-check`, `walk`, `v150Acheck` | `v123` |  |
| `honors` | v130 — the account rank, the prestige-tree gates, anything drawing a ★ | `honorcheck`, `menu-integration-check`, `walk`, `shot` | `v130` |  |
| `emblems` | team emblems / palettes / identity | `emblemcheck` | `v44`, `v153`, `LOGO_RULES`, `public/rib_logos*` |  |
| `training` | v64 / v113 / v124 — training programs, skill art, the training board | `traincheck`, `skillartcheck`, `wheelcheck`, `capcheck`, `v85check`, `scrollcheck`, `coachcheck`, `growthcheck`, `walk`, `shot` | `v113`, `v124`, `v64`, `public/rib_skill*` |  |
| `rivalry` | v128 — Rivalry Week | `rivalcheck`, `simcheck`, `v85check`, `injurycheck`, `walk` | `v128` |  |
| `crowd` | v57 / v78 — the crowd, the sideline, the team area | `crowdcheck`, `sidelinecheck`, `refcheck` | `v57`, `v78`, `SIDELINE`, `public/rib_crowd*`, `public/rib_side*` |  |
| `declare` | the declare / career-end screens | `declarecheck`, `v150Acheck` | `declare` |  |
| `modes` | v46 / v47 / v48 — Score Attack, leaderboards, Daily Challenge | `hscheck`, `lbcheck`, `dailycheck` | `v46`, `v47`, `v48`, `scripts/daily-engine.mjs` |  |
| `ui` | UI / screens — screenshot and click-through | `shot`, `walk` | — | look: `node scripts/shot.mjs` |
| `layout` | v149 A — the src/ split, the build and the deploy | `layoutcheck`, `bootviewcheck`, `freshcheck`, `menu-integration-check`, `walk` | `v149 A`, `index.html`, `vite.config.js`, `scripts/assemble-pages.mjs`, `scripts/lib/layout.mjs` |  |
| `monetize` | v149 E / v150 C — the monetization module and its in-game hooks (switched off by default) | `v149Echeck`, `v150Ccheck`, `bootviewcheck`, `walk`, `menu-integration-check`, `layoutcheck`, `honorcheck`, `vaultcheck` | `v149 E`, `v150 C`, `RIB_MONETIZE`, `src/27-monetize.js` |  |
| `pwa` | v149 D — the PWA, service worker, platform layer and Capacitor config | `v149Dcheck`, `bootviewcheck`, `freshcheck`, `splashcheck`, `walk`, `menu-integration-check`, `layoutcheck`, `v150Acheck` | `v149 D`, `src/26-platform.js`, `pwa/sw.js`, `scripts/lib/pwa.mjs`, `vite.config.js`, `scripts/assemble-pages.mjs`, `capacitor.config.json` |  |
| `rows` | v148 — the row density, the squash near the end zone, the far-behind taper, what paint and overlays register to near either goal line | `v148check`, `v144check`, `v112Bcheck`, `v93check`, `v99check`, `v92check`, `v145check`, `v112Echeck`, `v86check`, `sidelinecheck`, `renderpathcheck` | `v148`, `rowRefYdV148`, `rowKeepYdV148` | also: `KILL=1` for `v148check` shows the old failures |
| `v150a` | v150 A — the bugs the audit found: name escaping/sanitising, the growth dials, the declare stakes, import through boot, corrupt-save recovery, ribDialog at every confirm/prompt | `v150Acheck`, `declarecheck`, `bootviewcheck`, `v146Echeck`, `v147Acheck`, `v112Ccheck`, `v149Dcheck`, `v149Echeck`, `honorcheck`, `walk`, `menu-integration-check` | `v150 A`, `cleanNameV150`, `cleanSaveV150`, `checkSaveV150`, `askV150`, `setGrowthDialV150`, `__saveRecoveredV150`, `scripts/v150Acheck.mjs` |  |
| `seasons` | v151 C — competitive seasons, the Career Pass, the career leaderboards, the trophy case (src/29-seasons.js, src/20-leaderboards.js v151 C) | `v151Ccheck`, `lbcheck`, `dailycheck`, `bootviewcheck`, `menu-integration-check`, `v146Echeck`, `v150Ccheck`, `layoutcheck`, `walk` | `v151 C`, `RIB_SEASONS`, `src/29-seasons.js`, `src/20-leaderboards.js`, `docs/SEASONS.md` |  |
| `cosmetics` | v151 B — cosmetics and the profile: RIB_COSMETICS, the kit / helmet / celebration / stadium / vault hooks, the Locker's STYLE tab, the PROFILE view, the Team Creator's gated crests and colours (src/28-cosmetics.js) | `v151Bcheck`, `v151Ccheck`, `kitsidecheck`, `emblemcheck`, `vaultcheck`, `bootviewcheck`, `menu-integration-check`, `v146Echeck`, `layoutcheck`, `walk` | `v151 B`, `RIB_COSMETICS`, `src/28-cosmetics.js`, `docs/COSMETICS.md` |  |

<!-- CHECKS-TABLE:END -->
