# IP look-alike audit (v188)

A best-effort scan for anything in the game that sits close to a real league, team, brand or person — names, logos,
colours, uniforms, celebrations. **This is not a legal opinion.** Before a commercial release, have an IP lawyer review
the shipped build and the title, and confirm the rights to the AI-generated art (`docs/ART-PROVENANCE.md`).

## What was scanned

- Every player-facing string in `src/`, `public/*.js` and `index.html`: NFL / NCAA / Super Bowl / Pro Bowl / Heisman /
  ESPN / Madden / bowl games / conferences / brands (Nike, Adidas, Gatorade, Riddell …), famous players' names.
- The league's names: the 120+ towns, the 88 mascots, the 50 UFF clubs, the college suffixes (`scripts/namecheck.mjs`
  already blocked any real NFL / major college city + mascot pair and any NFL host city).
- The team emblems (`public/rib_logos_v44.png`, 90 cells) and the kit palette each emblem wears (`TEAM_PALETTES`,
  `LOGO_DB` in `src/05-field-renderer.js`).
- The Locker's uniforms, crowns, wings, celebrations (`src/28-cosmetics.js`).
- The app icon, the title film's poster, the coach, the badges.

## What was found, and what changed

| finding | risk | change |
|---|---|---|
| The 40 base kit palettes were **exact NFL hex pairs** (Jaguars teal/gold, Chargers powder blue/gold, Bengals orange/black, Raiders black/silver, Ravens, Vikings, Seahawks, 49ers, Dolphins, Eagles, Giants, Steelers, Saints, Colts, Jets, Panthers …), and several emblems wore their namesake's colours (the Jaguar in Jaguars teal/gold, the lightning Bolt in Chargers blue/gold, the Pirate with crossed swords in Raiders black/silver, the Tiger in orange/black, the Longhorn skull in Texas burnt orange `#BF5700`) | **high** — name + emblem + colours is a team's trade dress | All 40 replaced with original pairs; palette 52 (Longhorn) brown/cream; six more nudged off near-misses; the Panther, Jaguar and Boar emblems moved to unrelated palettes. **`namecheck` now fails** if any palette's two colours sit within ΔRGB 40 of a real NFL or major college team's pair (32 NFL + 22 college). |
| "Bengal" uniform — orange jersey, black tiger stripes, black pants | high — the Bengals' signature look | Renamed **Snow Tiger**: pale steel jersey, ice-blue stripes, slate pants (owners keep it — same id). |
| "Tiger Stripe" uniform — orange with black stripes | medium | Renamed **Jungle Stripe**, olive jersey. |
| Mascots "Longhorns", "Razorbacks", "Buccaneers" — each the signature of one famous team | medium | **Steers**, **Warthogs**, **Corsairs** (same emblems). |
| "Griddy" celebration ("HIT THE GRIDDY") — a named signature dance its creator has litigated over | medium | Renamed **Heel Clicks** ("HEEL CLICKS!"). |
| "PRO BOWL MONEY" (the UFF market-value tier) | low–medium (NFL mark) | **ALL-STAR MONEY**. |
| "Madden" in two code comments; "90 real logos" in an emblem comment | none to the player (comments) | Reworded. |

## What was checked and left as is

- **The emblems themselves** are original, generic esports-style mascot art (wolf, bear, tiger, eagle, knight, viking …);
  none copies a real team's logo design. With the palettes changed, none wears a real team's colours.
- **Generic mascot words** (Tigers, Eagles, Bears, Lions, Panthers, Vikings, Trojans, Spartans, Broncos …) on fictional
  towns — used by thousands of schools; `namecheck` blocks the real city/school pairings.
- **The trophy** is the game's own (v-menu: "instead of a Lombardi look-alike").
- **Celebrations** "Moonwalk", "The Worm", "The Robot", "Bow & Arrow" — generic dance names.
- **Uniforms** "Royal Black & Gold", "Throwback '79", "Ironmen '58", "Mud Bowl '72", "Pinstripe Navy" — generic.
- **Player names** are drawn from small generic pools; no famous player's full name appears anywhere.
- **"SEC" / "ACC"** in the code are the secondary and acceleration, never conferences.
- **The league is the UFF** in every string (CLAUDE.md).

## Still the owner's to do

1. **The title.** "Running It Back" / "GRIDIRON" — run a trademark search (USPTO / EUIPO, app stores) before shipping.
2. **AI-generated art.** 142 shipped or source images carry a generative-AI record (`docs/ART-PROVENANCE.md`). Generated
   art can echo real marks it was trained on; the owner must confirm the rights per group, and spot-check the menu,
   vault and legacy sheets by eye.
3. **Audio and fonts.** Not covered here — confirm the licences of `public/audio` and `public/fonts`.
