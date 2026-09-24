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

Every row of the CLAUDE.md "Verify before committing" table is a suite (rows about the same area
share one): `career-uff` (v147 A), `menu-coin` (v147 B), `gear` (v147 C), `camera` (v147 D / v112 E /
v145), `league`, `contact` (v146 A), `cuts` (v146 B), `impossible` (v146 C), `plan` (v146 D), `shell`
(v146 E), `field` (v144), `statinfo` (v142), `sim-keys` (v141), `boot` (v140), `combine` / `age` (v139),
`vault` (v137), `tackle` (v143 + contact physics), `lineage` / `pp-bank` / `summary` (v136 D/C/B),
`pregame` (v136 A / v112 D / v126), `wheel` (v135), `goals` (v134), `grow`, `grades`, `coach`, `loader`,
`menu`, `reads`, `credit`, `slots`, `sim`, `injury`, `ovr`, `between-plays`, `coverage`, `rank`,
`badges`, `kits`, `lights`, `playbook`, `endzones`, `field-art`, `story`, `snaps`, `origin`, `launch`,
`position`, `feel`, `stride`, `throw`, `pile`, `plant`, `catch`, `crew`, `clock`, `names`, `honors`,
`emblems`, `training`, `rivalry`, `crowd`, `declare`, `modes`, `ui`. Plus:

- `smoke` — fast and broad, 18 checks, none over ~3 min, all passing (or KNOWN) on main: `namecheck`,
  `walk`, `shot`, `menu-integration-check`, `honorcheck`, `freshcheck`, `v85check`, `v146Echeck` (the
  shell), `v112Dcheck` (the pregame), `v144check` (the live field), `simcheck` (the engine), `v110check`
  (who makes the play), `v146Bcheck` (the UFF career), `v147Ccheck` (gear), `scrollcheck`, `v142check`,
  `agecheck`, `traincheck`. 4m52s wall at `--jobs 4` (18m40s of check time). Run it before any commit.
  (`bootviewcheck` is the v140 gate but takes ~9 min — `--since` adds it whenever index.html changed.)
- `fast` — every check not marked `slow` (generated).
- `full` — every check in the manifest (generated).

The build steps in the Verify table (`bake-menu-into-index.mjs`, `build-*-art`) and the look-at-it
utilities (`menushot.mjs`, `vaultshot.mjs`, `growshot.mjs`, …) are not checks and are not run; do those
by hand when the table says so. Env-var variants (`READ_POS=WR MODES=0,1,4,5 v147Dcheck`,
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
4. Add a row to `scripts/README.md`, and the Verify-table row in CLAUDE.md.
5. `node scripts/run-checks.mjs <name>` — it must come back `PASS`.
