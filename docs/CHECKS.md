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
vaultcheck               KNOWN    4m05s  94 ok / 1 fail / exit 1
v147Dcheck               PASS     3m12s  41 ok / 0 fail
...
KNOWN vaultcheck
     · a RELOAD mid-pour loses nothing and buys nothing  [5000,4992]  — GAME: hide/blur commit a funded reservation
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
  { "check": "vaultcheck", "pattern": "^a RELOAD mid-pour loses nothing and buys nothing",
    "note": "why it fails, GAME or CHECK, and where the fix goes", "since": "2026-09-24", "flaky": false }
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

### The baseline now (v150 B — THE BASELINE GOES TO ZERO)

The 2026-09-24 baseline on `ca9db0a` had 46 entries. v150 B asked of each one: is the GAME wrong, or the CHECK? Most
were checks — stale since a later version changed the thing they measure on purpose, sampling one seed of a noisy
statistic, or waiting on the wall clock on a box shared by four jobs. Those were fixed in the check, each change carrying
a comment that cites the version it follows. One was a real stat-credit hole, closed in the engine. What is left in
`known-failures.json` is the game being wrong somewhere this pass did not own, or an assertion that is a wall-clock frame
rate by nature:

| check | assertion (pattern) | | why it is still here |
|---|---|---|---|
| `declarecheck` | the season-result declare card states the one-shot stakes | always | GAME: the stakes live in a hidden report-card tab (AUDIT §2.1) — the v150 A worker's |
| `declarecheck` | the epitaph fits inside v75's scroll budget on a phone | always | GAME: `declineResult` has no sectioner config since v146 E — the v150 A worker's |
| `vaultcheck` | a RELOAD mid-pour loses nothing and buys nothing | always | GAME: `visibilitychange`/`blur` call `release()`, which COMMITS a fully-funded reservation, so a reload (or backgrounding) mid-hold buys the upgrade — v137 says it must drop it. Fix in `public/rib-vault.js` + a menu bake |
| `vaultcheck` | frame rate under a 16x pour / goes to sleep / RESTOCK | sometimes | fps and settle timers in wall time |
| `v104check` | every pose that can show a number carries a band read off the art | always | GAME (renderer): v109 B's `catchseq` cells are numbered (`detailedAction` misses `catchseq`) but never banded |
| `heroflashcheck` | no spawn lands on the player | sometimes | one spawn on the kit mask's feathered edge (alpha 19 > 8) in the baseline; not reproduced since |
| `v112Acheck` | every byte of the sheet had landed | sometimes | a network-vs-first-script race, not a budget |

#### What happened to the other 39

| check | verdict | fix |
|---|---|---|
| `availabilitycheck` ×2 | CHECK, stale since v120 | asserts v120's fatigue slope (−10% at 70, −15% at 85, neutral to 40, hurt ≥ −10%) and that `condMultV54` IS `fatigueMulV120` |
| `badgecheck`, `bobcheck` (live field), `v104check` (cascade), `v93check` (`teamNames` throw), `v108check`, `v92check` | CHECK, wall-clock nav | `scripts/lib/live.mjs` `waitLive()`: wait for the field on game state for up to 90s, finishing a pregame wizard left standing; v93 fails once, cleanly, if the field never comes |
| `bobcheck` (lift / turn) | CHECK, since v144 A | measured in the marker's own units (backs out the age × depth scale) over one spin of the marker's clock |
| `bodycheck` | CHECK, since v120 | "ordinary" is fatigue 35 (inside v120's flat band); 50 must sit between neutral and worn |
| `crowdcheck` north end | CHECK | floor 200 → 60: the count is camera geometry (120–182 every run); the claim is that the end is scanned |
| `crowdcheck` roar | CHECK, wall clock | waits on the crowd's own clock `C.t` |
| `emblemcheck` | CHECK, since v112 D | walks the wizard to the scout page before measuring the chips |
| `endzonecheck` | CHECK, resolution | tolerance max(0.6 yd, 1.5 canvas px): at the far goal line a yard is 1.12px and the 1.09 yd was one row — the stripe |
| `equaltalentcheck` ×2 | CHECK, since v120 | the benchmark player is a trusted starter (`coachTrust: 100`) — at 50 a backup took ~35% of his snaps and broke the mirror |
| `gatecheck` | CHECK, since v146 D | page 5 is the plan BOARD by default; asserts the board (or, with `WHEEL=1`, the v135 wheel) is ungated |
| `growthcheck` | CHECK | the neutral band is `max(2, amt × .45)` by design; floors per band; the script now prints assertions |
| `heroflashcheck` (requests / loop) | CHECK | `net::ERR_ABORTED` from the page's own navigation is not a broken asset; "running" = frames advancing |
| `menufxcheck` ×3 | CHECK | nine tiles (v139 PRESTIGE); the spark vs `ringArcV147B`'s head from the inline target, not the mid-transition computed value; the ember loop "advances" |
| `movecheck` ×2 | CHECK | the side step is the QUICK back's and the juke the AGILE one's by design (`stepsV139`), so "all three" is across both; the hang dial is exactly 80ms |
| `movementcheck` | CHECK, stale reference | the v37 numbers were never met in the repo's history (PR #102 already read 56.0% / 4.02 / 6.62); re-anchored on the sandbox's own v150 reading, same ±12% |
| `postgamecheck` | CHECK | the week tap falls back to the button's own click when the pointer route times out (the fixed dock under load) |
| `rankcheck` | CHECK | the rank prints through `fmtInt` ("#1,234 of 48,000"); the regex reads the commas |
| `readcheck` | CHECK, one seed | play action vs dropback on four seeded streams (1,280 attempts a side): 9.54 vs 9.28 |
| `sidelinecheck` ×2 | CHECK | far/near by the band's own screen thirds, not fixed pixel rows; the decay waits on scene time; rain is compared with a CLEAR base |
| `starimpactcheck` | CHECK | loads `src/07-career-app.js` (the rosters live there since v141); the star is a trusted starter |
| `stridecheck` | CHECK, sample size | 400 throws a level (seeds 7/11/12/13 all ladder .08 → .15 → .27) |
| `v101check` | CHECK (load) | door two's prebuild is asserted when the door had the chance; closed by its 9s watchdog with the main thread held (13s in one probe), it prints SKIP with the evidence |
| `v104check` size band | CHECK, since v144 A | the age factor is backed out of the number's pixel height |
| `v110check` | CHECK (+ an engine hole) | see v110 below |
| `v112Acheck` budgets, `v127check`, `splashcheck`, `coachcheck` | CHECK, wall clock | budgets × `scripts/lib/load.mjs` `loadScale()` (1-minute load per core, exactly 1 on a quiet box, printed) and waits on game state |
| `v112Ccheck` | CHECK, since v120 | `condMultV54` must be bit-identical to `fatigueMulV120` with no penalty |
| `v136check` | CHECK | waits for the coach's line to finish typing |
| `v141check` | CHECK, one game | the 250-vs-350 band takes four games a cell (79/79) |
| `v144check` C / D | CHECK | the shuffle's speed in SCENE time (`_idleClockV144`), waiting the play out on game state for up to 90s; the pads measured from one fresh draw |
| `v90check` | CHECK, since v134 | the ring fills to `softMaxOvr`, as `ringArcV147B` says |
| `v92check` | CHECK | waits for the replay still to be captured; one straddling sample of the feed camera is the race, not a leak |
| `v93check` lettering | CHECK, since v97 | the far end is TOUCHDOWN in the USER's colours home or away; counted against that secondary |

**v110 — the credit.** The `1 wrong` in 2 of 3 runs was the check: it compared the booked credit with `FS.pass`'s 6th
argument (the engine's pre-rolled cover pick) and called a match wrong, but the sim's coverage man is `coverA`, chosen by
alignment, and when the nearest man to the ball happened to BE the engine's pick the credit was right (4 of 4 such cases
over 20 seeds × 10 games; 429 of 429 picks and break-ups credited to the agent the sim says made them, 0 wrong). The engine
did have a hole in the same line — `ballMan.player || ballPlayerV110` fell through to `coverA.player` and then to the
engine's pick if the man who played the ball had no roster player — which never fired with full rosters but is exactly what
the stat-credit rule forbids; it is closed (`ballByV110`, `X.coverBy`, `__V110.lastBall`). A seeded A/B of FieldSim pass
plays, HEAD vs the change, is byte-identical (no draw is spent, nothing moves).

**Two helpers for new checks.** `scripts/lib/live.mjs` `waitLive(page, ms)` waits for the live field on game state (and
finishes a pregame wizard left standing). `scripts/lib/load.mjs` `loadScale()` is the factor to stretch a wall-clock budget
by: the 1-minute load average per core, exactly 1 on a quiet box, `LOAD_SCALE=1` to force the strict numbers. Measure in
the game's own clock where there is one (`sc.time.now`, the crowd's `C.t`, `_idleClockV144`, a marker's `tms`) — Phaser
replaces a frame longer than ~200ms with one nominal step, so game time runs slower than the wall under load.

**Load-sensitive** (`loadSensitive: true` in the manifest — failed at load ~25 during the 2026-09-24 baseline, passed on a
quieter rerun; a failure prints a hint to rerun alone): `badgecheck`, `bobcheck`, `coachcheck`, `crowdcheck`, `emblemcheck`,
`heroflashcheck`, `kitsidecheck`, `menufxcheck`, `sidelinecheck`, `skillartcheck`, `splashcheck`, `v103check`, `v104check`,
`v107check`, `v108check`, `v109Acheck`, `v109C1check`, `v111Acheck`, `v112Acheck`, `v112Bcheck`, `v112Echeck`, `v114check`,
`v115check`, `v127check`, `v136check`, `v147Acheck`, `v92check`, `v93check`, `v99check`, `vaultcheck`. v150 B moved the
ones in the baseline off the wall clock (game-state waits, game-time measurement, `loadScale()` budgets); the flag stays as
documentation, because a check that drives the live field is still the first thing a starved box slows down.

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
