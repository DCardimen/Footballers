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
| uniform / helmet | `src/05` `ribSyncYouKitV96` → `cosKitV151B` → `fieldKit(teamCols, oppCols)` | the "you" textures — and since v159 A his whole team's "off" textures (below) — re-registered with the uniform's palette and `kitDeco` as `ribRegisterTeam`'s deco (it now receives the pose, v104's measured collar/waist and the raw cell): jersey pattern, pant stripe, helmet shell/stripe/decal/finish. A jersey too close to the opponent's (`cosKitClashV151B`, 90) is not worn that game. `window.__COS_FIELD_V151B.resync(scene)` re-dresses him mid-game |
| uniform / helmet (menu) | `src/07` feed `team.colors` → `cosColorsV151B` → `menuColors` | `[jersey, pants, helmet]`; `public/rib-menu.js` gives the portrait's helmet mask `colors[2]`; the growth figure reads the same feed |
| celebration | `src/05` `celebrate()` | on HIS touchdown only: particles + a callout (`celebrate(scene, x, y)`); since v161 A his body plays one of three drawn celebrations (flex / backflip / ball spike, `fieldBodyV161A`, picked from the play's token) under the equipped effect |
| stadium | `src/05` `bowlTrimV112` → `stadiumTheme()` | on home games (`__homeGameV93 !== false`): the base band, its lip, the tunnels' frame, a wash of the theme colour over the stands (`cosCrowdWashV151B`, .2 — a Graphics fill, not a sprite tint: the canvas renderer re-tints tinted sprites every frame). `__WX_V79` is never touched |
| vault | `public/rib-vault.js` `bakeRoom`, `frame`, `coinImg`, `Vault.open` | room graded toward the theme colour, coins = `vaultTint` copies shaded like the originals, `.rv-cos-v151b` motes |
| frame / banner / shelf | `renderCard` | CSS on the card (`.fr-*`, the banner background, `.sh-*`) |
| recap | `html[data-cos-recap]` on views `result` / `declineResult` / `gameover` / `win` | a skin over the report card and career-end cards |

Screens: view **`profile`** (`screenProfileV151B` in 07 → `window.__profileRenderV151B`), reachable from the menu's
legacy card (`view:profile`), the hub dock and the Locker; the Locker's **STYLE** tab (`cosStyleBlockV151B`, the v75
sectioner's `locker` config); `cosOpenStyleV151B()` opens it.

## v153 G — the full locker: footprints, wings, crowns, auras, number fonts

Five more slots (`trail`, `wings`, `crown`, `aura`, `numfont`; defaults `trail_none`, `wings_none`, `crown_none`,
`aura_none`, `nf_team` draw nothing) and a bigger catalogue: 12 more jerseys (new patterns `chevron`, `stripes`,
`shoulders`, `checker`, `sash`, `tiger`), 9 more helmets (finishes `satin`, `pearl`; stripe kinds `sk: "twin" | "wide"`),
10 more card frames (`neon`, `wood`, `frost`, `circuit`, `emerald`, `royal`, `lava`, `holo`, `angel`, `void`) and 7 more
celebrations (`shock`, `snow`, `pixel`, `meteor`, `rainbow`, `halo`, `feathers` — `CEL_V153G`). Static items are free
basics, earned unlocks on the existing achievements, and founder pieces (never listed while monetization is OFF); the
Career Pass generates the rest every season (`passLookV153G` draws the reward's named `style`).

| kind | field | styles |
|---|---|---|
| footprints | `tr: {kind, col[]}` | flame, ice, sparks, lightning, stars, smoke, rainbow, pixels, petals, comet, ghost (afterimage) |
| wings | `w: {kind, col:[main, shade, edge]}` | angel, seraph, bat, crystal, flame (phoenix), mech, pixel, monarch |
| crown | `cr: {kind, col:[metal, jewel, shade]}` | crown, king, halo, laurel, circlet, horns, flame, star |
| aura | `au: {kind, col}` | glow, pulse, flicker, frost, void |
| number font | `nf: {style, font, col, stroke}` | varsity, block, stencil, gold, neon, chrome, retro |

**Drawn from code, no art files.** `wingArt(w, frame)` / `crownArt(cr, frame)` rasterise pixel art at one pixel per
sprite pixel (a feathered wing is an arm with flight feathers hung from it and a covert band; bat, crystal, mech and
monarch have their own shapes; everything gets a 1px outline) and are cached per look; the field registers each as a
texture once (`cos153g_<hash>`). **On the field** (`fieldFx(scene, m, p)`, called by src/05's `cosFxV153G` from
`placeMarker` for the you-marker): the aura is an additive glow at the bottom of his container, the wings two images in
his container (behind the body facing the camera, over it facing away; flapping on the scene clock, folding a little at a
sprint, hidden while he is down), the crown its own image at depth 23.05 so the plumbob floating over his head does not
hide it, the number font his label's face/colour/stroke (restored on unequip), and the footprints one Graphics at depth
3.9 fed a point per ~2 sprite pixels moved, each particle aging out over ~520 ms (the afterimage uses three tinted copies
of his own frame). Geometry comes from the ink of his current frame (`headGeoV153G`), so everything follows the pose,
the age scale and the perspective. **On the card** (`cardFlair`): two extra canvases around the figure (aura + wings
behind, the crown in front), the figure and its layers stepping back to 80% for headroom — never inside
`drawCharacter`. **Nothing here spends `Math.random`** (particle jitter is an integer hash of the point's sequence
number) and nothing reads or writes a sim value; `window.__V153G` is what `v153Gcheck` reads (`fx` counters,
`lastTrail`, `card`, `freeze` to hold the drawn footprints still for a screenshot).

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

## v156 C — earned looks, member looks, super looks (the owner's call)

The owner made the nicer, appearance-changing looks harder to get: most behind the **membership**, a few free but
"waaay later", angel wings incredibly hard, and mythic **super** looks for the season ladder's super challenges
(`docs/SEASONS.md` §8). The tables above are the v151 B / v153 G sources; `RULES_V156C` in `src/28-cosmetics.js`
re-sources through getters (`source`, `ach`, `rarity`), so TU `v156Ccos` 0 puts every item back.

Two new sources: `member` (owned while the store is ON and `has("member")` / `has("founder")`; OFF: listed, locked
"🔒 Membership", never owned / granted / equipped, no store call) and `super` (granted only by `grant(id, "super")` from
a super challenge). **Grandfathered**: the first load of the store under v156 C snapshots every owned id and every
earned item whose old achievement was hit into `gf156` (`{v:1, …, v156C, gf156:{id:1}}`); those stay owned.

| new source | items |
|---|---|
| **member** (39) | uni_blackout, uni_gold_std, uni_tiger, uni_royal_chev, uni_mvp_white, uni_marble · hel_chrome_gold, hel_interstellar, hel_ruby, hel_marble · frame_platinum, frame_cosmic, frame_lava, frame_holo, frame_angel · cel_goldrain, cel_meteor, cel_halo, cel_feathers · vault_obsidian, vault_nebula · shelf_marble · trail_flame, trail_lightning, trail_ghost, trail_stars · wings_crystal, wings_bat, wings_mech, wings_seraph · crown_gold, crown_horns, crown_halo, crown_flame, crown_star · aura_gold, aura_flame, aura_void · nf_chrome |
| **earned, waaay later** | uni_nebula, frame_void (`legacy300`: Legacy medal 300) · crown_mvp (`rings3`: 3 UFF titles across careers) · crown_king, wings_phoenix (`rings5`: 5 UFF titles) · ban_lineage, aura_holy (`gen5`: the fifth generation) |
| **super** (mythic) | wings_angel (Interstellar title at all nine positions) · crown_ladder "Ladder Laurel" (top 10 for 10 days) · aura_supernova "Supernova" (League MVP + Interstellar title inside 14 seasons) · trail_goldrush "Gold Rush" (10 UFF titles) · frame_ultimate "The Ultimate" (Legacy medal 500) |
| unchanged earned | frame_gold, ban_lights, recap_gold, trail_comet, nf_gold (title) · shelf_gold, hel_emerald, frame_emerald, trail_petals (ring) · std_blackgold, nf_neon (UFF) · uni_heritage, hel_heritage, frame_royal, cel_rainbow, trail_rainbow (gen 3) |

Achievements tightened: `hof` needs a Hall career that made the UFF (was any finished career); `mvp` needs a League MVP
(college or higher — a high-school Player of the Year no longer counts). `account()` adds `hofWon`, `leagueMvps`,
`uffRings`, `legacyMedal`. The Career Pass no longer draws angel-style wings. `scripts/v156Ccheck.mjs`.

## v157 B — auras alive, trails you can spot

The owner: "make 19 more [auras], up the coolness. Animated auras on the profile page … Add 15 SICK looking footprint
trails. These help distinguish your character in a fast moving game." All of it is the `v157 B AURAS ALIVE, TRAILS YOU
CAN SPOT` block in `src/28-cosmetics.js` plus a few one-line hooks in v153 G's code (the field fx, the card flair, the
Locker preview, the trail drawer). Looks only; no `Math.random` (every particle is a function of the clock and an integer
hash of its index), no sim value.

| | items (source) |
|---|---|
| **auras** (19, `au.fx` → `AFX_V157B`) | free: Smoke & Embers, Sakura Drift · earned: Toxic Cloud (UFF), Code Rain (League MVP), Galaxy Swirl (Interstellar), Blood Moon (`rings3`), Heaven's Pillar (`legacy300`) · **member**: Crystal Orbit, Neon Grid, Shadow Tendrils, Inferno Pillar, Solar Corona, Money Shower, Aurora Borealis, Ghost Flames, Thunderhead, Void Rift, Plasma Ring, Prism |
| **footprints** (15, `tr.fx` → `TFX_V157B`) | free: Confetti Pop, Pixel Hearts · earned: Toxic Slime (UFF), Lava Cracks (`rings3`), Rune Glyphs (`gen5`) · **member**: Neon Light Wall, Ice Shards, Shadow Smoke, Cherry Blossoms, Lightning Cleats, Gold Coins, Galaxy Dust, Prism Burst, **Inferno** and **Meteor Strike** (the two big statement trails, taller than Scorched Cleats) |

- **Drawing.** One painter interface (`rect` / `circ` / `seg` / `tri` / `ring` / `ell` / `ellS`) over a Phaser Graphics
  (`gAdapterV157B`) and a 2D canvas (`cAdapterV157B`); v153 G's adapters delegate to them. An aura draws two layers,
  behind him and in front (orbits pass in front on their near half). Each item keeps a v153 G `kind` (the glow / trail it
  falls back to).
- **Profile card.** Every aura animates, the v153 G ones too (`LEGACY_V157B`): two canvases `.pc-au-v157b` beside
  cardFlair's; the figure steps back (`pc-shrink-v153g`) and the aura's geometry is mapped onto it (TU `v157BcardU`).
- **Locker.** Aura and footprint previews animate (the prints stream away behind him), drawn at 2× (TU `v157BpvRes`).
- **One rAF loop** (`ANIM_V157B`, ~25 fps TU `v157Bfps`, at most TU `v157BcardMax` 6 cards) skips off-screen canvases and
  stops when none is connected. `prefers-reduced-motion`: one still frame.
- **Live field.** A new aura adds two Graphics children to his container (TU `v157BauraFieldQ` 0.6 of the particles, cap
  TU `v157BauraCap` 90); a new trail draws through v153 G's one trail Graphics, newest first, capped at TU `v157BtrailCap`
  160 primitives a frame, its tail `life` per trail.
- **Kill switches.** TU `v157Baura` 0 → v153 G's static glow everywhere; TU `v157Btrail` 0 → the new trails draw their
  base `kind`, the previews are still. `window.__V157B` (`ids`, `sample(id, t)`, `animating`, `field`, `card`);
  `scripts/v157Bcheck.mjs`.
## v157 C — one face everywhere, and earned profile icons

- **One figure.** `drawFigureV157C(cv, age, face)` (= `drawCharacter` + his number on the chest in the equipped number
  font) is what the profile card, the year-older (growth) screen and the live screen's position badge draw, from
  `faceV157C()` (kit / uniform, helmet, number font, jersey number, wings / crown / aura). The growth man is the
  profile man, pixel for pixel, at the same age (`v157Ccheck`). On the field a number font is drawn bigger with a
  heavier outline (TU `nfScaleV157C`, `nfStrokeV157C`). Kill switch TU `v157Cfig`.
- **Profile icons are earned — never sold, never free.** 84 icons (`ICON_RULES_V157C`): titles at every level
  ×1/3/5/10 (UFF and Interstellar one rarity up), League MVPs, a Legacy medal of each colour, generations 2/3/5, the UFF
  at each position, rings at 3 / 9 positions, 25–200 touchdowns and 5K–20K yards in a career, the Hall (1 / 5 UFF
  careers), each super challenge, and the SEASON CHALLENGES (1 / 5 / 10 / 25 / 50 completed, a 20/20 season, six named
  challenges). Each is `source: "earned"`; its rule lives in `ACH_BY["icon:<id>"]` (so the Locker says "Earn it: …")
  but not in `ACH` (the profile's achievement chips are unchanged). The Career Pass draws no icons any more — its icon
  tiers are badges (src/29 `passKindV157C`, TU `v157Cicons`); a pass icon a device already owned stays an icon
  (`rawKind` + `gfIconV157C`). Art: a glyph on a two-colour disc with a tag (`.ico157`).
- **Adding an icon:** one `iconV157C(id, name, glyph, ringColour, discColour, tag, rarity, desc, test)` line in
  `buildIconsV157C`; `test(I)` reads `iconAccountV157C` (titles by level, MVPs, Legacy medal, gen, UFF positions,
  ring positions, best-career TDs / yards, Hall careers, super challenges done, `RIB_SEASONS.challengeTotals()`).

## v159 A — the whole team wears it, in its own colours or the team's, numbers printed on the shirt

- **The whole team.** `src/05` `ribTeamKitV159A` registers the "off" textures — what the user's eleven wear on both
  sides of the ball (v105.2) and our sideline's backups — with `fieldKit`'s kit and deco, once per kit key
  (`RIB.offKitV159A`, the team's base palette `RIB.baseOffV159A` + the cosmetic stamp). "you" is then a pixel copy
  (`ribCloneTeamV159A`), not a second recolour. The opponent's "def" textures are never touched. TU `v159Ateam` 0: his
  textures only (v151 B).
- **Colours: Uniform's own · Team palette.** A choice next to the uniforms in the Locker's Style panel, stored as
  `uniColV159A` in `rib.cosmetics.v1` (outside the save). In "Team palette" `uniModeV159A` (the first thing `resolveU`
  does, so the field, the card figure, growth, the live badge, the menu hero and the previews all follow) keeps the
  uniform's pattern and maps jersey = primary, pants / trim / pant stripe = secondary (a shade of the primary when the
  two would blur). The clash rule does not apply: the jersey is the team's own. TU `v159Apal` 0 hides the choice.
- **Printed numbers.** The profile chest number is drawn on its own layer, wrapped round the chest, clipped to the source
  art's torso where the body was drawn, multiplied by the jersey's shading and softened at the fold lines
  (`chestNumV159A` / `printV159A`); the team face picks its ink from the kit (`inkForV159A`). On the field every man's
  number (`numPlaceV104` → `RIB_COSMETICS.numInk`) takes the kit's contrast, a jersey-shadow outline, alpha TU
  `v159AnumA` and a quarter-view turn; side views still hide it. TU `v159Anum` 0: the old sticker. `v159Acheck`.

## v174 — the palette: every look in one place

The Locker's STYLE tab is **the palette** (`stylePanel` → `paletteHTMLV174`): the live card on top, then one row per
section in three groups — ON THE FIELD (uniform, TEAM COLOURS, TEAM CREST, helmet, celebration, number font, footprints,
aura, wings, crown), HIS CARD (banner, frame, title, badge, nameplate, profile icon, trophy shelf), HIS WORLD (stadium,
recap, vault). A row shows the equipped look's own preview, its name and owned/listed; one section is open at a time and
its grid is v151 B's (`.cos-item-v151b`, tap to equip). TEAM COLOURS holds v159 A's uniform-colour choice and every team
palette, TEAM CREST every emblem — a tap there is the Team Creator's save through its gate (`teamStyle`, above), the
other half kept as he wears it. Doors: `cosOpenStyleV151B(sec)` (the profile's "🎨 The Palette", the spray's STYLE),
`cosCatV151B(c)`, the top bar's 🎨 on the career screens (at TEAM COLOURS), a link in the Team Creator. Entitlements
are untouched. TU `v174palette` 0: the tabbed panel and the 🎨 Team Creator. `palettecheck`.

## v177 I/J/K — ten celebrations, ten uniforms, ten banners (super)

All thirty are **super** looks (mythic, source `super`): never sold, never on a pass, granted only by `grant(id, "super")`
from a **super ladder** (rows in the super challenges section, `RIB_SUPER.progress()`; stored in `rib.super.v1` → `l177`,
never the save). Each ladder pays its next look every step of an account-wide count across careers (the Hall's boxes and
the live career, monotonic):

| ladder | counts | step (TU) | pays, in order |
|---|---|---|---|
| The Showman | touchdowns | 60 (`superTdStepV177I`) | cel_moonwalk, cel_griddy, cel_robot, cel_phone, cel_worm, cel_nap, cel_archer, cel_saber, cel_leap, cel_quake |
| The Dynasty Closet | championships, any level | 5 (`superTitleStepV177I`) | uni_throwback, uni_carbon, uni_digicamo, uni_bengal, uni_ice, uni_tron, uni_lava, uni_chrome, uni_galaxy, uni_royal |
| The Long Haul | seasons played | 15 (`superSeasonStepV177I`) | ban_sakura, ban_coderain, ban_circuit, ban_abyss, ban_comets, ban_floodlights, ban_prism, ban_hyperspace, ban_eclipse, ban_finale |

- **Celebrations** — `c.body` names a drawn body (`public/celebrations/cel_v177i*`, built by
  `scripts/build-celebration-moves.py` from the owner's three sheets; regenerate, never hand-edit), `c.kind` a v159 C
  effect (`v177moon`, `v177worm`, `v177leap`, `v177quake`, `v177griddy`, `v177arrow`, `v177robot`, `v177nap`,
  `v177phone`, `v177saber`). `celebrateBody(scene, cm, { name: "moonwalk" })` plays a body by name;
  `API.celebrateMoves` lists them, `API.celebrateBodyOf(id)` maps an item.
- **Uniforms** — `k.pat` is a v177 J design (`chrome`, `lava`, `galaxy`, `carbon`, `digicamo`, `bengal`, `grid`,
  `crystal`, `royal`, `throwback`), drawn in field pixels on the sprite and the card; they take the team palette like
  every uniform.
- **Banners** — `b158` is a v177 K painter (`coderain`, `floodlights`, `hyperspace`, `finale`, `sakura`, `eclipse`,
  `circuit`, `abyss`, `comets`, `prism`), `bg` the still fallback.

## v177 F/G/H — ten new footsteps, ten new wings, every hat floats

All twenty new looks are **super** (mythic): only a super challenge grants one (`grant(id, "super")`); they are listed
"Super challenge: …" while locked, never sold, never member. Each of the ten new super challenges (`SUPER_V177F`, on
v156 C's list and its SEASON-tab section) pays one wing and one footprint:

| super challenge | goal (TU) | wings (kind) | footprints (fx) |
|---|---|---|---|
| Two Hundred | 200 TDs in one career (`superTdsV177F`) | wings_koi "Koi Pond" | trail_ink "Sumi Ink" |
| Five-Time MVP | 5 League MVPs (`superMvpsV177F`) | wings_aurora "Aurora Veil" | trail_constellation "Constellation" |
| Interstellar Dynasty | 5 Interstellar titles (`superIslV177F`) | wings_peacock "Peacock Train" | trail_bloom "Wildbloom" |
| Hall of Ten | 10 UFF Hall careers (`superHofV177F`) | wings_sunburst "Art Deco Sunburst" | trail_film "Film Reel" |
| Hundred Challenges | 100 season challenges (`superChalV177F`) | wings_neon "Neon Sign" | trail_datamosh "Datamosh" |
| Eighth Generation | generation 8 (`superGenV177F`) | wings_blades "Thousand Blades" | trail_cranes "Paper Cranes" |
| Forty Titles | 40 titles at any level (`superTitlesV177F`) | wings_maple "Autumn Maple" | trail_frostbite "Frostbite" |
| Trophy Room | 150 awards (`superAwardsV177F`) | wings_quetzal "Quetzal" | trail_sands "Sands of Time" |
| Forged in Legacy | Legacy medal 400 (`superLegacyV177F`) | wings_magma "Magma Glass" | trail_chrome "Liquid Chrome" |
| Thirty Careers | 30 finished careers (`superCareersV177F`) | wings_bass "Bass Drop" | trail_gravity "Gravity Well" |

- **Footprints** (`FX_V177F` → v157 B's `TFX_V157B`, drawn `k`× bigger so they read at broadcast size, TU
  `v177FtrailScale`): v157 B's painter, its newest-first cap (TU `v157BtrailCap`), its animated Locker preview. TU
  `v177Ftrail` 0: each draws its base v153 G `kind`.
- **Wings** (`WINGS_V177G` → v157 A's `WINGS_V157A`, families in v159 D's `FAM_V159D`): up to six frames each through
  `wingFrameV157A`. TU `v177Gwings` 0: frame 0.
- **Every hat floats** (v177 H): every crown's baseline sits `hatLiftPxV177H` (3.2) sprite px over the helmet top and
  bobs (`hatBobPxV177H`, `hatBobMsV177H`), with a soft shadow and a glow of its colour on the helmet; the field's plumbob
  rises over it (`hatPlumbV177H`). TU `v177Hfloat` 0: v153 G's seating. `scripts/v177FGHcheck.mjs`.
