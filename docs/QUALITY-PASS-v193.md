# v193 — THE QUALITY PASS (the ten points, and what shipped)

The owner, the night before shipping: "a major quality pass … a 10 point plan to enhance the visuals, appeal,
satisfaction, UI … do not overhaul the main menu or parts that feel done … balance patch is necessary … there
should always be something to sink points into … chaos to feel powerful … explain the bloodline mechanic …
the prestige math screen … the season menu should show prestige gain … pregame should include your team and
what prestige bonuses go to which players … roll the gameplan before the game … colour the gameplan odds …
sell items for prestige, item levels … a better way to scroll the items menu, quick select by position …
remove +all stats per game."

The main menu, the coach, the vault, the Locker's STYLE tab, the Legacy book and the broadcast's look were
left alone: they read as done. Everything below is what a player touches between two games.

## The ten points

| # | Point | Where it shows | Shipped as |
|---|---|---|---|
| 1 | **The payout is a receipt.** A career's end shows every term of the prestige maths — base by level, seasons, titles, the multiplier (tap to unfold), the chaos share, Family Legacy, the flat bank by source, the Prestige cards — then the big number counts up into the Vault. | `screenGameOver`, `screenWin` | v193 D |
| 2 | **The season tells you what it is worth.** A PRESTIGE THIS SEASON card on the season screen: the pot now vs the last season's end, what moved it, what a title would pay, and THE FULL MATH. | `screenSeason` | v193 D |
| 3 | **Your team is on the sheet.** A YOUR TEAM page in the pregame: all 22, each man with the OVR your prestige gives him (team nodes, Locker Room, the plan), the you-player marked, and the team's before → after. | the pregame wizard | v193 B |
| 4 | **The plan shows its odds and rolls in front of you.** Every plan tile is shaded green / yellow / red by its click odds and says the %; the scout's pick stays marked but the default pick follows the green when the scout's is not; ROLL THE PLAN reveals the held roll before kickoff and the projected score moves. | pregame page 5 | v193 B |
| 5 | **Gear grows, sells, and sorts itself.** Items have a level (+5 every season, +1% to every bonus a level), sell for PP by the level they were received at, a position quick-select bar, and a list that scrolls. | the Locker | v193 A |
| 6 | **Skin is skin.** No cell of a man's sprite comes out in the kit's second colour; the you-player picks his tone. | the broadcast, the position screen | v193 C |
| 7 | **The broadcast's bar tells the truth.** KICKOFF, PAT, 2-PT TRY and & GOAL instead of "1st & 10"; the catch sequence carries its number; a camera throw is logged once instead of freezing silently. | the live watch | v193 C |
| 8 | **Navigation that cannot strand you.** The tier and club choices are sealed from the bottom nav, Prestige is always reachable from the menu, every tab lights where it should, the Hall's back after a UFF win returns to the win. The hub's origin card no longer wraps one word a line. | the shell | v193 C |
| 9 | **Always something to buy, and chaos that pays.** SPEND NOW on the tree lists what you can afford (or how far the cheapest is); a near-flat FOREVER sink in the Locker Room; the Chaos card says what it costs and pays in live numbers, and every chaos point now grows every future player. | the prestige tree, Rings & Chaos | v193 E |
| 10 | **How the scouts decide.** One explainer, three doors (the hub, the Recruiting Board, the BLOODLINE POTENTIAL card): recruit ★ vs national rank vs bloodline potential vs Legacy medals, with this player's numbers; a top-1% season rolls at ≥ 99%. | the hub, the board, the tree | v193 E |

## The balance patch

- **"+N% to every attribute a game" is gone.** `perfFlat` reached the sim only in the watched game before v190, and
  as a share of the man after it; the owner never saw it work and did not want it. Twin Engines, Zen Focus, Trash
  Talk, Aura, Eternal Form, The Wall and Glass Cannon keep their keys (saves keep their levels) and get effects the
  game already reads; the gear's Conditioning piece migrates to growth. `v193 E`.
- **Scaling stays slow.** No branch price moved. What changed is that the cheap sinks are visible (SPEND NOW) and
  there is one that never runs out at a near-flat price.
- **Chaos.** The card was lying ("+10% per level, per stat"); it now shows `chaosOppBoost`, the PP multiplier with
  the share banked by level, Legacy XP, gear rarity, eras — and the new growth bump per point.
- **The call to College.** A top-1% season could miss at 97% and the miss was final. The floor is 99% for the top 1%
  and 95% for the top 5% (`v193Erank`).

## What is next (not this pass)

- A career-best celebration on the post-game card (the box score's best line ever, with the medal pour).
- Haptics on the big moments (a title, a medal, a roll that clicks) through `src/26-platform.js`.
- The Recruiting Board redrawn around the explainer's four numbers.
- The gear level on the item's art (a small plate), and a set bonus for three pieces of one rarity.
