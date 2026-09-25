# SEASONS — v151 C, "THE SEASON IS AN EVENT"

Competitive seasons, the Career Pass, the career leaderboards and the trophy case. The owner's model: a ~6-month
SEASON turns each reset into an event — **careers are never wiped; season boards reset, trophies persist; monetize
status, never performance.**

| piece | file | hook |
|---|---|---|
| calendar, rollover, pass, challenges, trophy case, the SEASON & PASS screen, the event card, the hub chip | `src/29-seasons.js` | `window.RIB_SEASONS`, `window.__seasonsUI`, `seasonsOpenV151C(tab)` |
| career boards, Career Score, the backend adapter, the CAREERS mode of the leaderboard view, the profile sheet | `src/20-leaderboards.js` (the `v151 C` block) | `window.__lb.career`, `window.__lbCareerUI`, `__lbUI.mode()` |
| the hand-off of a finished career; the `seasons` view route | `src/07-career-app.js` (`seasonsCareerEndV151C`, beside `hofWings`) | `window.__seasonsQV151C` (the queue), `window.__escHtmlV151C` |
| menu doors | `public/rib-menu.js` (`seasonTilesV151C`), `public/rib-menu-navigation.js` (`seasons`, `boards`) | baked with `RIB_MENU_VERSION=v151c` |
| check | `scripts/v151Ccheck.mjs` (suite `seasons`) | |

Storage lives **outside the save**: `rib.seasons.v1` (`{v:1, cur, s:{<season>:{xp, premium, claimed, m, done, wk, log, meta}},
hist, trophies, obs, pending, event}`) and `rib.lb.careers.v1` (`{v:1, entries:[…]}`, max 500). A new career, a hard
reset or an imported save neither grants nor loses anything here.

## 1. The calendar

- Two seasons a year, starting **UTC Jan 1 and Jul 1**. Season 1 starts at the epoch, **Jul 1 2026**; before it the id
  is `pre1` ("Preseason").
- `seasonAt(ts)` → `{id: "s<N>", number, theme, name: "Season N · <Theme>", start, end, daysLeft}`. Themes rotate:
  Kickoff, Two-Minute Drill, Blitz, Red Zone, Hail Mary, Iron Man, Goal Line, Overtime, Audible, Dynasty.
- Override anything with `window.RIB_SEASONS_CONFIG = {epoch, months, tiers, xpPerTier, themes, now}` set before the
  file loads (`now` is a function — the check fakes the clock with it). `RIB_SEASONS.dev.setNow(ts)` does the same live.

## 2. The rollover (`tick()`, run at boot, on every API read and every 1.5 s)

On the first boot in a new season:
1. **Archive** the old season: its board (top 10 of the careers stamped with its id), the best career, the category
   leaders, the pass tier/XP, premium owned → `history()[0]`.
2. **Trophies**: a season-finish medal off the best Career Score (Legend ≥ 3000, Diamond ≥ 2000, Platinum ≥ 1400,
   Gold ≥ 900, Silver ≥ 500, Bronze > 0), the pass tier reached, a "played" badge.
3. **Reset**: a fresh pass record (XP 0, nothing claimed); the season board is empty because it filters on the new id.
4. **The card**: `pendingEvent()` → the "Season N begins" card (`#ss151Event`) with last season's recap, shown once the
   splash is gone and never over the live broadcast; `dismissEvent()` keeps it dismissed.

The careers — the save, the all-time board, every entry — are never touched. Placement is honest about being LOCAL:
"#1 of N local careers"; `pct` (top %) stays `null` until a server can rank a population.

## 3. Career Score and the boards

**Career Score** (from the Hall of Fame snapshot `hofSnapV134` + the enshrined row):

```
LEVEL_PTS[level reached]   Pee Wee 0 · 40 · 90 · 150 · 230 · 330 · 450 · UFF 600 · Interstellar 800
+ 4 × peak OVR + 60 × titles + 150 × UFF rings + 8 × playoff wins + 2 × wins
+ 15 × awards + 40 × MVPs (MVP / Player of the Year in the season log) + 5 × seasons + 200 if he made the UFF
```

**Craziest Career** ("chaos"): `12·level + 15·traits + 20·(generation−1) + 8·distinct award kinds
+ ½·(best − worst season grade average) + 30 if cut after winning a title + 25 if playing at 35+ + 40 if in the UFF by 21
+ 20 for 20+ seasons`.

**Fastest to the League**: seasons played before the first UFF season (or all of them if the career ended on reaching
it); UFF careers only, ascending.

| category | ranks | filter |
|---|---|---|
| All-Time Career Score | score | — |
| Season Leaderboard | score | `seasonId` = the season (past seasons in the Pro season picker) |
| Weekly Challenge Career | score | finished this UTC ISO week (the week the weekly challenges run on) |
| Best QB / RB / WR / TE / OL / DEF | score | position (DEF = DL, LB, CB, S) |
| Most Championships | titles + UFF rings (tie: score) | — |
| Craziest Career | chaos | — |
| Fastest to the League | seasons to the UFF, ascending | reached the UFF |
| Best Career Without Prestige | score | zero prestige nodes owned when it ended |

A career is recorded **once, when it ends** (`enshrineHof` in both settles → `seasonsCareerEndV151C` → the queue →
`RIB_SEASONS.flush()` → `__lb.career.record`). The career being played shows as a "NOW PLAYING · WOULD RANK #n" line
(`__lb.career.live()`). Each entry stores name, pos, level, team (school, name, colour strings, logo index), the
honours, the score parts, and a `profile` snapshot (`RIB_COSMETICS.profile()` + `equipped()` if present) so a row can
render the player card (`RIB_COSMETICS.renderCard(profile, {compact:true})`, else a plain row with the crest) and a tap
opens that career's profile sheet (score breakdown, stats, trophies; "Profile" calls `RIB_COSMETICS.openProfile()` when
the cosmetics module offers it).

Filters: category and position are always free. The advanced filters (level reached, past-season picker, sort by
recent) are free while monetization is off and need `pro` when it is on (`__lb.career.advancedUnlocked()`).

**XSS:** every string is escaped at render with the game's `escHtml` (`window.__escHtmlV151C`), and every stored or
imported entry is sanitised on the way in (`__lb.career.clean`: markup characters and control characters stripped,
lengths and depths capped, prototype keys dropped; team colours kept only when they parse as colours).

## 4. The Career Pass

- **30 tiers × 1,000 XP.** Free track: 11 rewards (tiers 1, 2, 4, 6, 8, 10, 13, 16, 20, 25, 30). Premium track: one a
  tier (30). Kinds: banner, card frame, title, badge, nameplate, profile icon, celebration, kit trim — rarity common /
  rare (8+) / epic (15+) / legendary (25+). Ids `pass.<season>.<track>.<tier>`, generated per season from its theme.
- **Cosmetic only.** `validateReward` refuses any kind outside that list and any field named pp, xp, stat, attr, gear,
  reroll, boost, ovr, perf, prestige, honors, speed, roll, spin, coin. Nothing is granted but through
  `RIB_COSMETICS.grant(id, "pass", descriptor)`; with no cosmetics module the claim is kept in `pending()` and flushed when
  it appears.
- **Premium** is owned when `RIB_MONETIZE.has("pass:<seasonId>")` or after `grantPremium(seasonId)` (what the commerce
  module calls after a purchase; `buyPremium()` asks it via `purchasePass(id)` or `purchase("pass:<id>")`). While the
  store is off the premium column reads "PREMIUM TRACK · COMING SOON" and the free track works the same.

**XP** (observed, never computed from — `observe()` diffs the career and writes nothing into it; no `Math.random()`):

| event | XP |
|---|---|
| a game played (not sat out) | 50, +100 if watched live (`liveBookedV85`), +50 for a win |
| a season logged | 250, +600 a title, +80 an award, +200 an MVP |
| a promotion | 400 |
| a career ended | 500, +500 if he made the UFF |
| a Daily Challenge / a Score Attack run (through `window.__lb`) | 300 / 150 |
| a new generation of the line | 300 |

**Challenges**: 20 season challenges drawn (seeded by the season id) from a pool of 28 — games, live games, wins,
seasons, titles, promotions, careers, the UFF, dailies, Score Attack runs, awards, MVPs, yards, touchdowns, defensive
plays, a new generation — and 3 weekly ones from a pool of 10 (seeded by the ISO week). Completing one adds its XP.

## 5. The backend

There is no server. Boards are **LOCAL** (your careers on this device) and say so on screen. The adapter:

```js
__lb.career.submit(entry)        // → {ok}
__lb.career.fetch(board, opts)   // → rows; opts {seasonId, week, pos, level, sort, limit}
__lb.career.adapters.local       // localStorage
__lb.career.adapters.remote(cfg) // used only when window.__LB_CONFIG.careerUrl is set
```

The **remote** design (not deployed):

- `POST /careers/submit` `{entry, proof, device, name}`; `GET /careers/board?cat&season&week&pos&level&limit`.
- **Signed submissions**: the device registers a key pair (or the platform identity — Game Center / Play Games, the
  `window.__LB_IDENTITY` seam in 20) and signs `hash(entry.proof)`; the server stores one public key per device.
- **Server-side validation**: the client's score is ignored. The server recomputes Career Score from the proof (the
  season log from `hofSnapV134`: per-season level, OVR, wins, titles, awards) and rejects impossible careers (sanity
  bounds per level: max seasons, max OVR by age, wins ≤ games, titles ≤ seasons, awards per season). Seeded runs — the
  Daily Challenge already works this way (`supabase/functions/verify-daily`) — can be REPLAYED; a career cannot yet,
  so career boards should stay "friends / personal" or be marked unranked until the sim can replay from a seed
  (`docs/AUDIT.md` §3.3).
- **Rate limits**: one career submission per device per 10 minutes, 20 a day; boards cached 60 s.
- **Moderation**: names through a profanity/impersonation filter on submit, a report button on each row, hidden-until-
  reviewed after N reports; names are escaped on every client regardless.
- **Seasons** are server-authoritative once online (the server's clock decides the rollover and the archive; the
  client's `seasonAt` is the offline fallback) and a season's archive gives each device its true top %.

## 6. Where it shows

- Main menu: **SEASON PASS** tile (`S1 · 99 DAYS LEFT · TIER 3`) and **LEADERBOARDS** tile; the header's LEADERBOARDS
  link also opens the career boards. Score Attack's own boards are the second mode of the same view.
- The SEASON & PASS screen (view `seasons`, in the v146 E shell): SEASON (countdown, this week, last season, past
  seasons) · PASS (tiers with claim buttons, challenges) · TROPHIES (the profile card, the case) · BOARDS.
- The career hub's dock: `🎟 S1 · 99D · T3`.

## 7. Verify

`node scripts/v151Ccheck.mjs` (or `node scripts/run-checks.mjs seasons --jobs 4`): calendar, rollover with a faked
clock, Career Score determinism, every board, a real career end restored at boot, pass XP, claims through a
cosmetics stub, premium gating, the validator, XSS, 400×860 fit. Screenshots land in `$SHOTS` (default
`/tmp/claude-0/shots`).
