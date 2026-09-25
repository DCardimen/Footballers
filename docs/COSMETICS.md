# COSMETICS — v151 B, "HE LOOKS THE PART"

`src/28-cosmetics.js` is the cosmetics module, `window.RIB_COSMETICS`. The rule it is built on is the owner's:
**sell status, never power.** Every item changes what a player LOOKS like — on the live field, on the menu's
pictures, on his profile card, on a leaderboard row — and nothing the sim reads. The module never calls
`Math.random()` (the celebrations and camo roll their own PRNG), so a live game's random stream is the same
whatever he wears; `v151Bcheck` sims seeded games with nothing equipped and with everything he owns equipped and
asserts the box scores are identical.

## The API (the contract other workers build against)

```js
const C = window.RIB_COSMETICS
C.catalog()            // [{id, cat, name, rarity, price?, packs:[packId], source, tier?, ach?, preview(el)}]
C.owned(id)            // free: always · earned/pass: the store · shop: RIB_MONETIZE.has("cos:<id>"|"cos:<packId>") · founder: has("founder")
C.grant(id, source)    // earned/pass → the store (once; earned is toasted) · shop/founder → RIB_MONETIZE.grant("cos:<id>") (refused while OFF)
C.grantPack(packId, source)
C.equip(slot, id)      // refuses an item he does not own; id null = the slot's default
C.equipped(slot)       // falls back to the default when the equipped item is no longer owned
C.packs()              // [{id, name, price, productId, founder, items:[ids]}]
C.onChange(cb)         // → unsubscribe
C.profile()            // the compact JSON the leaderboard stores (below)
C.renderCard(data, el|{el, compact})   // the player card markup; with an element it also draws the character
C.teamStyle            // the Team Creator's gate (below)
C.checkEarned()        // re-read the achievements now (also runs at boot and after every save)
```

Slots (`C.slots`): `uniform`, `helmet`, `frame`, `celebration`, `stadium`, `vault`, `banner`, `shelf`, `recap`.
Every slot's default is a free item that changes nothing (the team kit, the stadium as painted, the classic hoard…).

### Storage
`localStorage["rib.cosmetics.v1"]` = `{v:1, owned:{id:{source,at}}, equipped:{slot:id}, ach:{id:at}, ts:{l,p,free,paid,gf}}`.
It is **outside the career save**: a new career, a season reset, a wiped or imported save neither grant nor take a
look. Shop and founder items are never written here — their entitlements live in `RIB_MONETIZE`
(`docs/MONETIZATION.md`), and with monetization OFF they are neither listed nor grantable. Free, earned and pass items
are a live, free feature whatever the switch.

### `profile()`
`{v, name, pos, level, levelName, age, ovr, team:{school,name,colors,logo}, club, careers, bank:{pp,honors},
titles, rings, mvps, awards, hof, uffTitles, interstellarTitles, titlesByLevel, gen, surname, bestScore, careerScore,
teamStyle:{unlocked,total,all}, achievements:[ids], cosmetics:{frame,banner,shelf,uniform,helmet,recap,kit}}` — no PII
beyond the in-game name. `kit` is the drawn look (`j`/`p`/`t`/`pat`/`ps` jersey, pants, trim, pattern, pant stripe;
`hs`/`hst`/`hf`/`hd`/`hdk` helmet shell, stripe, finish, decal) so another device can draw him. `renderCard` treats the
data as hostile: every string is escaped, every id is looked up in the catalogue (unknown → the default), colours must
be `#rrggbb` or are dropped.

## The catalogue

| Category | Items | Free | Earned | Pass (tier) | Shop (pack) | Founder |
|---|---|---|---|---|---|---|
| Uniforms (14) | Team Kit, Road Whites | ✓ | Blackout (UFF), Gold Standard (title) | Field Camo (8), Electric Blue (20) | Pinstripe Navy, Split Decision, Sunset Fade (Uniform Pack); Leatherhead '24, Ironmen '58, Mud Bowl '72, Neon '94 (Historical) | Founder's Kit |
| Helmets (12) | Team Shell, Matte Black, Gloss White | ✓ | Chrome Gold (MVP), Event Horizon (Interstellar) | Lone Star (14) | Carbon Fibre, Ice Shell, Crimson Metallic (Helmet Pack); Leather Cap '24, Single Bar '58 (Historical) | Founder's Chrome |
| Card frames (10) | Broadcast, Brushed Steel | ✓ | Gold (title), Platinum (Hall), Cosmic (Interstellar) | Carbon (4) | On Fire (animated), Championship Ring, Diamond Cut (Card Frames Pack) | Founder (animated) |
| TD celebrations (9) | Confetti, Spotlight | ✓ | Gold Rain (100 TDs) | Seeing Stars (12), Team Smoke (24) | Fireworks, Lightning Strike, Scorched Earth (Celebration Pack) | The Crown |
| Stadiums (8) | Home Colours, Midnight Bowl | ✓ | Black & Gold (UFF) | Ice Bowl (16), Crimson Cauldron (28) | Neon Night, Old Field (one pack each) | Founders' Field |
| Vault themes (7) | Classic Hoard | ✓ | Obsidian (Hall), Nebula (Interstellar) | Glacier (18) | Rose Gold, Emerald (one pack each) | Founder's Reserve |
| Banners (7) | Charcoal, Gridiron | ✓ | Friday Lights (title), The Family Name (gen 3) | Sunset Drive (2), Aurora (22) | — | Founder |
| Trophy shelf (6) | Oak, Steel Rack | ✓ | Gilded (ring), Marble Hall (Hall) | Glass Case (10) | — | Founder's Cabinet |
| Recap themes (6) | Broadcast, Newsprint | ✓ | Gold Edition (title) | Neon Replay (6), Chalkboard (26) | — | Founder's Edition |

### Packs (the commerce worker sells them and calls `grantPack` / `grant`)

| Pack id | Name | Price | Items | Suggested product id |
|---|---|---|---|---|
| `pack_uniforms1` | Uniform Pack | $1.99 | 3 uniforms | `rib.cos.uniforms1` |
| `pack_helmets1` | Helmet Pack | $1.99 | 3 helmets | `rib.cos.helmets1` |
| `pack_celebrations1` | Touchdown Celebration Pack | $2.99 | 3 celebrations | `rib.cos.celebrations1` |
| `pack_stadium_neon` / `pack_stadium_oldfield` | Stadium Theme | $2.99 each | 1 stadium | `rib.cos.stadium_*` |
| `pack_frames1` | Card Frames Pack | $1.99 | 3 frames | `rib.cos.frames1` |
| `pack_vault_rose` / `pack_vault_emerald` | Vault Theme | $2.99 each | 1 vault theme | `rib.cos.vault_*` |
| `pack_historical` | Historical Uniform Bundle | $4.99 | 4 uniforms + 2 helmets | `rib.cos.historical` |
| `founder` | Founder Bundle | (commerce) | 9 founder items, owned while `has("founder")` | — |

Entitlement keys honoured: `cos:<itemId>`, `cos:<packId>`, `founder` (or `cos:founder`), `cos:team_style_all`.

### Earned (free) — `ACH` in the module
`title` first championship at any level · `ring` a UFF ring · `mvp` MVP / Player of the Year · `td100` 100 touchdowns
in one career · `uff` reached the UFF · `interstellar` reached the Interstellar League · `gen3` third generation ·
`hof` a career in the Hall of Fame. All read off the account's own state (`account()`: the current player, the Hall's
box scores, the lineage) at boot, after every `GridironStorage.save`, and when the profile opens; each grants its items
once with a toast.

## Rendering hooks

| Category | Where | What |
|---|---|---|
| uniform / helmet | `src/05` `ribSyncYouKitV96` → `cosKitV151B` → `fieldKit(teamCols, oppCols)` | the "you" textures only, re-registered with the uniform's palette and `kitDeco` as `ribRegisterTeam`'s deco (it now receives the pose, v104's measured collar/waist and the raw cell): jersey pattern, pant stripe, helmet shell/stripe/decal/finish. A jersey too close to the opponent's (`cosKitClashV151B`, 90) is not worn that game. `window.__COS_FIELD_V151B.resync(scene)` re-dresses him mid-game |
| uniform / helmet (menu) | `src/07` feed `team.colors` → `cosColorsV151B` → `menuColors` | `[jersey, pants, helmet]`; `public/rib-menu.js` gives the portrait's helmet mask `colors[2]`; the growth figure reads the same feed |
| celebration | `src/05` `celebrate()` | on HIS touchdown only: particles + a callout (`celebrate(scene, x, y)`) |
| stadium | `src/05` `bowlTrimV112` → `stadiumTheme()` | on home games (`__homeGameV93 !== false`): the base band, its lip, the tunnels' frame, a wash of the theme colour over the stands (`cosCrowdWashV151B`, .2 — a Graphics fill, not a sprite tint: the canvas renderer re-tints tinted sprites every frame). `__WX_V79` is never touched |
| vault | `public/rib-vault.js` `bakeRoom`, `frame`, `coinImg`, `Vault.open` | room graded toward the theme colour, coins = `vaultTint` copies shaded like the originals, `.rv-cos-v151b` motes |
| frame / banner / shelf | `renderCard` | CSS on the card (`.fr-*`, the banner background, `.sh-*`) |
| recap | `html[data-cos-recap]` on views `result` / `declineResult` / `gameover` / `win` | a skin over the report card and career-end cards |

Screens: view **`profile`** (`screenProfileV151B` in 07 → `window.__profileRenderV151B`), reachable from the menu's
legacy card (`view:profile`), the hub dock and the Locker; the Locker's **STYLE** tab (`cosStyleBlockV151B`, the v75
sectioner's `locker` config); `cosOpenStyleV151B()` opens it.

## The Team Creator's crests and colours (`C.teamStyle`)

Each crest and each palette is one unlock. **Five free picks, shared** between the two (`teamStyleFreeV151B`); after
that an unlock costs PP — **10, 20, 40, 80…, doubling with each paid one** (`teamStyleCostV151B`), debited from
`state.pp` by `spendPPV151B` (07). Picking in the creator is a free preview; **Save Team** asks (`ribDialog`) to spend
the pick or the PP and refuses if short. The look a save already wears (its custom logo + palette and every per-level
pick) is grandfathered on first sight and counts toward the five. With monetization ON, **UNLOCK ALL** buys
`unlock_all_team_style` (entitlement `cos:team_style_all`). Looks the league assigns (the per-level rotation, a new
career's random look, a UFF club's colours) are never gated. The unlock count is on the profile.

## Adding an item

1. Add a row to `ITEMS` in `src/28-cosmetics.js` with a unique `id`, its `cat`, `name`, `rarity`, `source` and the
   category's data field (`k` uniform, `h` helmet, `css` frame/shelf/recap, `c` celebration, `st` stadium, `vt` vault,
   `bg` banner). Earned items name an `ach`, pass items a `tier`, shop items their `packs`.
2. A new pattern / finish / celebration kind / frame needs its drawing in `kitDeco` + `drawCharacter`, `celebrate`, or
   the CSS block — the catalogue alone does not draw anything new.
3. Run `node scripts/v151Bcheck.mjs` (every item must draw a preview; nine categories, six each).
