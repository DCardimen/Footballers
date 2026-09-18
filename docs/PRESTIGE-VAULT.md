# The Prestige Vault — architecture note

Written **before** any code, from the code as it actually is (v136 head). Every claim
below was read out of `index.html` / `public/` rather than assumed from an older doc.

## 1. What the currency actually is

The account state is the module-level `o` in the career-app block. Its shape comes from
`Zs()` (`grep -n 'function Zs()' index.html`):

```js
{ prestige: 0, pp: 0, tree: {}, bestLevel: 0, careers: 0, ... }
```

- **`o.prestige`** — the account RANK. Since v130 it is drawn as **HONORS 🎖️**, not stars.
  It is a decimal (`+(o.prestige + l * TU("prestigeGainMult", .2)).toFixed(1)`), it gates
  tree nodes through `honorReqV130(req)` / `Xa(node)`, and it is **never spent**.
- **`o.pp`** — the SPENDABLE Prestige Points. Integer. This, and only this, is the vault's
  balance.
- **`o.tree`** — `{ nodeKey: level }`. The purchased upgrades.
- **`o.ppBankV136`** — v136 C's bank. PP credited mid-career is **not spendable**; it sits
  here until the career settles. `bankingV136()` is the live-and-unsettled test,
  `bankPPV136(n, why)` banks or pays, `bankedV136()` reads it, `flushBankV136()` moves it
  into `o.pp` at both settles (`ms` = cut, `no` = won). The vault shows banked PP as
  *pending*, outside the balance.

So: account rank and spendable points are separate, exactly as the brief says. There is no
`S.prestige` / `S.pp` in the game app — `S` in `public/rib-menu.js` is the **menu feed
snapshot** (`window.__RIB_MENU_DATA_V89()`), a read-only projection with `S.pp` and
`S.prestige` on it. Mutating `S` would do nothing. The authoritative path is `o`.

## 2. The authoritative upgrade transaction

`ot` is the flat node table (built from the branch table `sa`). Three functions own a purchase:

| Function | Role |
|---|---|
| `M(key)` | current level of a node (`o.tree[key] \|\| 0`) |
| `At(node)` | **the price of the next level** — `cost * mult^level`, ×0.75 on a path's cheap branch, `Math.max(1, Math.round(...))`. Always a positive integer. |
| `Xa(node)` | the gate — honors requirement and/or prerequisite node level |
| `Yl(key)` | **the purchase**, wired to the global as `window.buy` |

```js
function Yl(e){ const t=ot[e];
  if(M(e)>=t.max) return;
  if(!Xa(t)){ F("Locked — meet the requirement first"); return }
  const s=At(t);
  if(o.pp<s){ F("Not enough PP"); return }
  o.pp-=s, o.tree[e]=(o.tree[e]||0)+1, I(), F(t.name+" → Lv "+o.tree[e]), ps(), an()
}
```

**Upgrades are ATOMIC.** There is no partial funding anywhere in the tree: one call, one
level, one debit. The vault therefore must *not* invent permanent partial payment — it
animates funding progress against a **pending, uncommitted** reservation and calls `Yl(key)`
**exactly once** at the end. `window.__recallPrestigeV14(key)` is the existing refund path
(it decrements the level and credits `At(n)` back); the vault does not touch it.

`I()` is the save (`GridironStorage.save(o)` else `localStorage`). `an()` repaints the
topbar chip (`#prestigeCount` / `#ppCount`). `ps()` re-renders the shop screen.

## 3. Navigation

`q()` is the router: a flat `if (e === "<view>") return <render>()` chain over `o.view`.
`te(view)` (global `window.go`) sets `o.view`, saves, and calls `q()`. The shop is
`o.view === "shop"` → `ps()`, whose node rows call `buy('<key>')`.

Two DOM containers: `#screen` and `#dock`, inside `#app`, under a `.topbar` that carries the
`.prestige-chip` (`onclick="go('shop')"`). The main menu is a separate overlay
(`public/rib-menu*.js`) whose PRESTIGE tile routes through `window.go`.

The vault is therefore a **new view** (`o.view === "vault"`), reached three ways: the shop's
dock, the topbar chip, and an upgrade row's buy button. Wrapping `q()` to add a case is the
established pattern here (v136 B does exactly that for the coach's summary row).

## 4. Assets and the build

- `window.__RIB_ASSET(p)` resolves every runtime sheet document-relative under `public/`.
  Never a bare `/x.png`. New sheets go in `public/vault/`.
- `vite.config.js` mirrors `public/` into `dist/public/` so `vite build` matches the deploy
  layout (`scripts/assemble-pages.mjs`) and the Capacitor shell.
- `scripts/bake-menu-into-index.mjs` injects `public/*.css` / `public/*.js` as `<link>` /
  `<script src>` tags between markers, versioned by `RIB_MENU_VERSION`. **The menu files are
  not inlined** — which is the pattern the vault uses: its renderer, stylesheet, animation
  controller and integration adapter live in `public/`, not in the 9.6 MB `index.html`.

## 5. Numeric constraints

`o.pp` is an integer throughout (`Math.round` at every credit; `At()` rounds). It is saved as
JSON. **No BigInt** — it would not survive `JSON.stringify`. The vault does all transaction
arithmetic in integers and keeps the animated *display* number separate from the committed
`o.pp`, which changes exactly once, inside `Yl`.

The four coin denominations (Bronze 1 / Silver 1,000 / Gold 1,000,000 / Electric Blue
1,000,000,000) are a **visual decomposition of the single `o.pp` integer**, not four
balances. Real balances in this game are two- to four-digit, so the vault's display scale is
derived from the actual balance rather than assuming the concept art's 1.25B.

---

# The Prestige Vault — how it is built

## Files

| File | What it is |
|---|---|
| `public/rib-vault.js` | The whole screen: the hoard model, the camera, the renderer, the animation controller and the transaction controller. Knows nothing about the career app. |
| `public/rib-vault-audio.js` | The sound system. WebAudio synthesis — see **Audio** below. |
| `public/rib-vault-bridge.js` | The integration adapter. The only file that knows both sides. |
| `public/rib-vault.css` | The stylesheet. Everything scoped under `#ribVault`. |
| `public/vault/*.webp` + `manifest.json` | 50 production sprites and their manifest. |
| `scripts/vaultcut.py` | The extraction library (border flood → opening → largest component → hole fill → feather). |
| `scripts/build-vault-art.py` | Drives the cutter over every cell; writes `public/vault/` and the manifest. `--proof` writes `art/vault-proof/` to look at. |
| `scripts/vaultcheck.mjs` | The gate: 52 assertions. |
| `scripts/vaultshot.mjs` / `vaultspend.mjs` / `vaultdoor.mjs` | Cameras, not checks. |

Into `index.html` went **~40 lines**, in one banner block (`v137 THE VAULT IS WHERE THE
POINTS LIVE`) beside `__GRIDIRON_AUDIT__`, plus four one-token edits: the shop row's BUY
now calls `vaultBuy`, the shop's dock gained a **Visit the Vault** button, the topbar chip's
`+` opens it, and both career-end docks offer to show the payout landing.

## The hoard

One central mound, never four towers, built from individual coin sprites.

`MAX` slots are generated **once** from a fixed seed (`buildSlots`). Slot *i* is born at
fullness `u = (i+.5)/MAX` and placed on the surface of the mound **as it is at u** — radius
`R(u)`, height `H(u) · prof(q) · lobe(θ)`. Because the mound only ever grows, a coin born
early is inside every later mound, so the pile has body rather than being a shell, and
**N coins are always slots 0..N-1**. That is the whole of the spatial-continuity guarantee:
spending lowers N and coins leave from the top and the outside; earning raises it and they
land on top; nothing reshuffles, ever. Paint order is computed once, far to near.

`prof` is a cosine shoulder, not a cone — a cone put a spire on the pile, which is the one
shape a heap of discs never makes. 8.5% of slots are **spill**: coins thrown off the foot of
the heap, without which the mound has a cut-out silhouette.

**N** comes from `fullnessOf(pp)`, eight anchors interpolated in log space. They are the
brief's eight illustrative states and they are *presentation only* — no economic milestone
lives there, and the exact balance is always printed above the pile.

**The mix** is each face's share of your **value**, softened (`^0.62`), with a 2.2% floor for
any face you really hold and **blue capped at 10% by count**. One coin worth a billion among
a hundred worth a million each is the honest picture of that balance, and it is what the
reference hero shows. `breakdown()` is the exact decomposition and it is what the details
drawer prints; `vaultcheck` asserts it conserves the balance to the point.

**Bounded**: 620 / 980 / 1350 slots by device pixels and memory. Two layers — a baked deep
canvas re-drawn only when the quantised count moves, and a live surface of ≤16% drawn every
frame — so a 16× pour re-bakes a few times a second rather than sixty. Coins are pre-shaded
into four brightness steps at load, so the hoard is a straight run of `drawImage` calls.

## Rotation

A coin spinning about an axis is exactly `scaleX = |cos t|`, so the FACE and BACK sprites are
squeezed through the EDGE sprite procedurally. The supplied 12-frame spin rows were measured
and are **not** a monotonic rotation — the cell widths run 56, 46, 38, 23, 17, 20, 55, 54,
50, 52, 54, 64 px, so the sequence pops at the sixth frame and never narrows again. Four
sprites per denomination instead of forty-eight, no seam, and the spin axis can vary per coin.

## Spending

`press` → `pour(n)`. A tap is 2% of the price. A hold ramps 1× → 2× → 4× → 8× → 16× at 0,
420, 950, 1550 and 2300 ms, and each stage's `rate` is a share of **the upgrade's price** per
second, so a 300 PP Apex node and an 8 PP first level both pour in about the same time and
neither needs a thousand taps. `throwCoin` picks a **real surface slot** near the touch and
launches a coin from its screen point, wearing **the face of the coin that was there** — a
bronze coin rising out of a silver hoard is the tell that a flight is decorative.

## Transactions

The game's upgrades are **atomic**: `Yl(key)` debits the price and adds one level in one
call, and there is no partial-funding rule anywhere in the tree. The vault does not invent
one.

`pending` is a reservation held **entirely inside this screen**. The committed balance only
ever changes inside `commit()`, which calls the game's own handler exactly once, guarded by
`committed`, and which **verifies the result**: it reads `o.pp` and the node's level before
and after and reports a purchase only if the money really moved by the price and the level
really rose. A refusal inside the game can never leave the vault claiming a sale.

- cancel / back / navigate away → the reservation is dropped; nothing was ever debited.
- reload mid-pour → the same, for free: nothing was written.
- skip → the same one commit, immediately.
- a second commit → refused.
- `pending` is clamped to `min(cost, balance)`, so PP cannot go negative and an upgrade
  cannot be granted for less than its price.
- every number is an integer; no BigInt reaches the JSON save.
- **banked PP never reaches this screen** — the bridge passes `o.pp` alone, and v136's bank
  is drawn as pending, outside the balance.
- the payout presentation reads the balance the game **already holds** and animates up to
  it, so replaying it can never mint a point.

## Audio

**No playable audio file was supplied with this feature and none is generated.** The art
pack's "AUDIO VISUALIZATION & TIMING GUIDE" sheet is pictures of waveforms with durations
printed under them; those are images. Every sound is **synthesised in WebAudio at runtime**,
voiced against that sheet's own timings. A coin strike is a stack of inharmonic partials
(the modes of a thin disc are not integer multiples) through a bandpass with a scrape
transient in front; bronze is low and dull, silver bright and short, gold round and long,
blue a struck bell. Pitch, level and decay are jittered per strike. At 8× and 16× the mix
crossfades to a continuous stream bed with sparse accents, because a hundred discrete voices
a second is static. Voices are pooled with a hard ceiling and a minimum gap; mute persists in
`rib.vaultMute.v137`; the context is armed on the opening gesture.

`window.__RIB_VAULT_AUDIO.manifest()` names the fourteen categories a real recording session
would replace one for one: `vault_mechanism`, `door_move`, `coin_bronze`, `coin_silver`,
`coin_gold`, `coin_blue`, `coin_detach`, `coin_flight`, `coin_stream`, `coin_land`,
`pile_settle`, `upgrade_receive`, `upgrade_complete`, `career_payout`.

## The door

One leaf sprite under an affine transform, plus one rotating wheel and eight translating
bolts. The leaf's geometry never changes between frames, which is the thing the brief rules
out. It plays once per install (`rib.vaultDoor.v137`), is skippable by tapping, and is
skipped outright under reduced motion. At rest the door is **baked into the room** on the far
wall, behind the hoard, where it costs nothing and stops occluding the pile it stands behind.

## Asset notes, and what the artwork could not give

- **The room art is misspelled.** At native resolution the empty-room cell's left banner
  reads `NISCIPLIHE / PROGKESS / PRESTIOS / IMMORTALITY` — the word PRESTIGE is wrong in the
  artwork. `clean_banners()` paints the lettering out with the panel's own cloth (per-column
  30th percentile; a blur leaves a bright bar where the text was and an edge-row
  interpolation smears the crown down the panel — both were tried and looked at) and the
  renderer draws all eight words itself in Oswald.
- **The room is an upscale.** The empty-vault cell is 506×512 and has to fill a phone, so it
  is Lanczos-upscaled 2.6× with a restrained unsharp. It is a dark, hazy, softly lit room —
  the one subject that survives one — and every crisp element over it (the ceiling lights,
  the floor rings, the banner words, the light pool, every coin) is drawn at device
  resolution. A higher-resolution empty-room render is the single most valuable remaining art
  need.
- **Not shipped, because they could not be cut cleanly:** the ceiling light strip (the cell
  merges three strips and a caption), the door hinge (a 48 px sliver), and the "gold trails"
  cell (the box that reads GOLD TRAILS contains the blue neon set). Ceiling lights, floor
  rings, coin trails and tap ripples are drawn procedurally instead — resolution-independent,
  and they cannot read as an obviously repeated asset.
- **The half-buried pile coin** cell has neighbouring coins baked into it by design and was
  not used; burial is achieved by overlap and paint order instead.
- The small coin stacks keep a one-or-two-pixel reflection nub at their foot. They are used
  only sunk in the hoard, where the foot is buried.
- The pre-rendered 8-state pile images on the concept sheets are **not** used at runtime. The
  brief asks for a constructed pile; they served as a silhouette reference.

## Dev loop

```bash
python3 scripts/build-vault-art.py --proof   # re-cut the sprites, write the proof sheets
npm run dev
node scripts/vaultcheck.mjs                  # the gate
node scripts/vaultshot.mjs                   # the eight wealth states
WIDE=1 node scripts/vaultshot.mjs            # desktop
KEY=oracle node scripts/vaultspend.mjs       # a real spend, photographed
node scripts/vaultdoor.mjs                   # the opening and the payout
```

Hooks: `window.__RIB_VAULT`, `__RIB_VAULT_BRIDGE`, `__RIB_VAULT_MODEL`, `__RIB_VAULT_SCENE`,
`__RIB_VAULT_AUDIO`, `__RIB_VAULT_DEV`, and `window.__V137` on the game's side.
