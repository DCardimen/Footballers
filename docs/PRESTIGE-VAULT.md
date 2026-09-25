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
| `scripts/vaultcheck.mjs` | The gate: 96 assertions. |
| `scripts/vaultshot.mjs` / `vaultspend.mjs` / `vaultdoor.mjs` / `vaultphys.mjs` | Cameras, not checks. |

Into `index.html` went **~40 lines**, in one banner block (`v137 THE VAULT IS WHERE THE
POINTS LIVE`) beside `__GRIDIRON_AUDIT__`, plus four one-token edits: the shop row's BUY
now calls `vaultBuy`, the shop's dock gained a **Visit the Vault** button, the topbar chip's
`+` opens it, and both career-end docks offer to show the payout landing.

**The door on the right is gone.** A second leaf was parked half off the right edge as set
dressing and it read as a mistake rather than as a door: cropped by the frame, at a scale
that fought the room's own perspective, and close enough to the hoard to crowd it. The room
art already has a vault door on the far wall, which is the one the opening sequence swings.

## The hoard

One central mound, never four towers, built from individual coin sprites — and **mostly
stacked**. Loose discs alone read as a brown blob past about a dozen: there is no vertical
structure for the eye to catch, so a hundred coins and a thousand look the same. Money in a
vault is stacked. Two thirds of slots are therefore **columns** — k coins of one
denomination (you sort your money) off the `flat` sprite, each a coin's thickness above the
last, the column wandering as it climbs because a stack of coins is never plumb, and a third
of the taller ones carrying a coin lying askew across the top. The rest stay loose and
tilted, which is what keeps the heap looking poured rather than stocked.

**It is a PILE, and it is taller than it is wide.** Height alone was never enough: v137 E
raised the peak 40% and the heap still read as a puddle, because the *footprint* was
growing with it. Measured on a 412px phone at the large-collection state, the drawn hoard
was 400 CSS px across and 131 tall — **3.05 : 1**. A heap of anything reads as a heap at
about 2 : 1. So the footprint came in 15% (`MOUND.R` tops out at 0.85) and the peak went up
30% (`MOUND.H` to 1.26), which lands it at **1.99 : 1** with exactly the same coins in it.
The flank is fuller too (`cos^0.92` rather than `cos`), because a heap carries most of its
mass low down and a thin shoulder was the other half of why this looked like spilled change.

**It has a front and a back.** `PILE.dz` was `0.150` — the whole hoard occupied a tenth of
the room's depth, so every coin sat at nearly the same distance from the camera and there
was no near and no far to read. At `0.26` the pile has real depth, and a coin's drawn size
now goes as `k^1.28` rather than `k`, which widens the near/far size spread across the
hoard from **1.28x to 1.67x**. The exponent is picked so that a coin at the pile's own
depth is exactly the size it always was, so nothing downstream needed re-tuning.

**And it tapers.** A column's height keys on how much headroom it has *and* how far out it
sits. Keyed on headroom alone — which is what it did — the tallest columns in the hoard
stood on its outer lip, where headroom is greatest, and the pile came out with vertical
walls and a flat top. A drum, not a mound.

**A column is made of things, and each has a side.** The per-coin rise was 0.086 of a
diameter with the edge pass turned down to 0.55, so a stack of eight stood 0.60 diameters
tall and the discs in it had almost no visible thickness. They are `STACK_RISE` = 0.118
apart now and each draws its full edge, so the gap between two discs is filled by the *side*
of the lower one: the same eight coins, 0.83 diameters of column, and you can count them.
The light ramps smoothly up the column rather than stepping once at 58%, which is most of
what says "column" rather than "discs at different heights".

A column's height is also keyed on how **low** in the heap it sits, not how near the middle:
tall stacks at the base and the front, short ones out on the slope and at the crown. Keyed
on the radius instead — which is what it did first — the tallest columns land on the peak
and the hoard grows a picket fence.

**A coin takes up space.** Slots were sampled independently, so nothing stopped two of them
landing on the same spot — and at 1700 coins in a footprint this size, plenty did.
Coincident coins are invisible *as coins*: they composite into one brighter blob. A slot now
claims a volume (`CLAIM`, a 0.092-unit minimum centre separation in the mound's own space,
enforced through a hash grid so the build stays linear) and a candidate that lands inside
one already claimed is re-rolled. It is not sphere packing — a heap of discs overlaps
heavily and should — it is a floor on how close two centres may be.

**A coin rests on what it landed on.** `sink` ran 0.55 to 1.0, so half the hoard was parked
at half the height of the surface it was supposed to have landed on: the heap was hollow at
the top and packed at the bottom, which is the shape of a mat. It settles a little now and
no more (0.80–1.0). The coins that end up deep are the ones later coins are poured *on top
of*, which is how a real heap buries its own history.

**The inside of the pile is dark.** Brightness used to key on a slot's own height, which is
not the same thing as how buried it is: a coin at 0.4 is on the *surface* of a quarter-full
vault and under half a metre of money in a full one, and it was drawn identically in both.
`ao` is the coin's height as a fraction of the heap's surface at its own (x, z) **right
now**, so the crown catches the room and the interior goes properly dark. That darkness is
the single thing that makes a heap of discs read as having a volume rather than as a
texture, and it costs one `surfaceAt` per drawn coin.

**Every coin presses into what it lies on.** A small contact shadow under each one, scaled
by `ao`. Without it every coin floats on the one behind it and the pile has no interior. It
is free on the deep layer, which is baked.

**Coins have an edge.** Every coin draws its own silhouette once, darkened, a fraction below
its face: the cheapest honest way to give a disc a side, and the thing that makes the hoard
read as metal rather than as printed circles (`THICK`, per sprite kind; a column uses a
fraction of it because the step already does most of the work).

The budget is counted in **coins, not slots** — a stack of eight costs eight — so the draw
call count is bounded whatever mix of stacks and singles comes out, and `n` keeps meaning
the one thing it should. `cum[i]` is the running total, so the slots for n coins are still a
prefix and nothing reshuffles. Below **60 PP** the vault draws your coins one for one,
because at that size you can count them and a vault showing thirteen when you own seven is
lying about the only thing on the screen.

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

**Adaptive**: the scene watches its own frame time. The worst case is the biggest hoard on a
high-density phone mid-avalanche — about 270 live surface coins plus a couple of
hundred loose bodies, each drawing a face *and* an edge, which measures out near a thousand
`drawImage` calls a frame and falls to the mid thirties. Past 21 ms it drops the edge pass
and caps the bodies, and comes back under 14.5 ms. The flip deliberately does **not** move
the live band or force a re-bake: doing either re-draws 1700 sprites on the very frame the
scene decided it was behind, which is a 160 ms stall caused by trying to avoid one.

**Bounded**: 1050 / 1700 / 2400 coins by device pixels and memory. Two layers — a baked deep
canvas re-drawn only when the quantised count moves, and a live surface of ≤16% drawn every
frame — so a 16× pour re-bakes a few times a second rather than sixty. Coins are pre-shaded
into four brightness steps at load, so the hoard is a straight run of `drawImage` calls.

## Rotation

A coin spinning about an axis is exactly `scaleX = |cos t|`, so the FACE and BACK sprites are
squeezed through the EDGE sprite procedurally. The supplied 12-frame spin rows were measured
and are **not** a monotonic rotation — the cell widths run 56, 46, 38, 23, 17, 20, 55, 54,
50, 52, 54, 64 px, so the sequence pops at the sixth frame and never narrows again. Four
sprites per denomination instead of forty-eight, no seam, and the spin axis can vary per coin.

## The money is loose — drag, the avalanche and RESTOCK

The layout is deterministic and that has to stay true, so nothing here ever moves a slot. A
disturbed coin gets a row in a sparse **displacement map** — its own position, velocity and
sleep state — and the renderer draws it there instead. Clear the map and the hoard is
exactly the hoard again, which is what RESTOCK does.

- **Whatever you touch responds.** Picking used to search the last 22% of the slot list and
  return whichever of those had its centre nearest the finger, *with no distance limit*.
  Two things were wrong with that, and both of them are the "sometimes it just doesn't
  respond" you can feel: coins outside that window — most of the hoard, and all of the
  baked deep layer — could not be picked at all, and because the nearest candidate always
  won, a press on one of those silently grabbed a coin somewhere else, often off the far
  side of the pile. Both read as dead touch. It now walks the painter's order **backwards**
  (nearest the camera first, which is the order your eye picks a coin out of a heap in) and
  returns the first coin whose drawn body actually contains the point; a column is tested
  as the whole column, base to top, because that is what you aim at. Only if nothing is
  under the finger at all does it fall back to a nearest-centre search, and that now covers
  the whole hoard. The hoard's own touch box is measured off the coins that are actually
  drawn rather than guessed from the mound's formula, because a box that runs short is
  another way for a press to do nothing.

  A coin in the **baked deep layer** can be picked too, which it could not be before: the
  bake is keyed on a counter (`_deepSeq`) that ticks whenever a coin enters or leaves that
  layer, so the frame you lift one the layer is repainted without it. Measured over a grid
  across the whole hoard, **217 of 217** sample points that have a coin drawn on them pick
  a coin that covers that point, and **93 of them are in the deep layer**. `vaultcheck.mjs`
  asserts all of it.
- **Drag.** A press on the hoard is an invest hold; a press that then *travels* is a drag of
  the coin under the finger. The pour is not delayed waiting to find out — the first tap
  pays immediately, because a laggy tap is worse than an extra coin — but past 13 px the
  hold is released and the gesture becomes a drag. The coin lags the hand by its own weight
  rather than sticking to it, and leaves it with the speed the hand had.
- **The avalanche.** Lifting a coin out of a heap does not leave a hole in it: the coins
  around the gap give way into it. `disturb(gx, gz, strength)` wakes every surface coin
  within `DIST_R` of the point and hands it **energy** — `DIST_E` at the centre, falling off
  smoothly (`f²(3−2f)`) to nothing at the rim, so there is no hard edge to the disturbance.
  The reach is an ellipse, because the hoard's floor is one. Both a lift (`startDrag`) and a
  hard landing (`landed`) raise one, the second scaled by how hard the coin came down.

  The physics that matters is **static friction**. A hoard at rest holds its own shape —
  coins in a heap interlock, which is why a pile of discs stands at an angle no single disc
  would hold alone. So the slope acts **only on a coin that still holds disturbance
  energy**, and in proportion to it: `drive = energy / (MU × grip)`. Weighting the slope
  unconditionally made every woken coin creep downhill and the pile quietly slumped; never
  weighting it meant nothing ever slid. Energy decays with a time constant of `E_DECAY`
  (≈260 ms), so a disturbance is over in about a quarter of a second.

  **How far one coin is allowed to slide is the whole of "some a lot, some a little", and it
  has to be a granted allowance rather than a single cap.** This is the correction v137 F
  had to make. With a single `SLIDE_MAX`, the cap turned out to be the *only* thing deciding
  the distance: the slope sets how fast a coin gets going, but under light rolling friction
  it keeps gaining speed for the whole ~700 ms the disturbance lasts, so every coin — steep
  flank or flat shoulder — ran into the same cap and stopped in the same place. Measured, a
  coin on a flat shoulder travelled 0.165 and one on the steep flank 0.152: backwards, and
  both pinned to the cap. Dropping the slope constant by 14× did not change it, which is
  what proved the cap was the mechanism rather than the physics.

  So `grantSlide` gives each coin an allowance when it is disturbed, off the gradient of the
  heap **under it** divided by its own grip. The gradient has to be measured in the mound's
  own slot space, not the room's: the room is 1.20 wide and 0.26 deep in ground units, so a
  step across the pile's depth is worth seven across its width, and measuring there made 22
  of 24 coins in an avalanche come out at the maximum gradient whether the heap under them
  fell away at 0.04 or at 1.43. In slot space both axes are the circle the mound is actually
  built on. A light coin on the steep flank gets the full run (0.175), a billion-point coin
  on a flat shoulder barely shifts (0.030 / 2.19). Measured now: the steepest third of an
  avalanche travels **0.141** against the flattest third's **0.081** — 1.74× — and the same
  shake moves bronze 0.068, gold 0.038, blue 0.032.

  **A sliding coin follows the slope; it does not take off down it.** On a flank this steep,
  one frame of drive carries a coin further sideways than gravity pulls it down in the same
  frame, so a coin that started on the surface ended the frame *above* it and went
  ballistic — and once airborne it is not on the ground, so the slope stops acting on it
  entirely. It got one frame of push and then coasted: 0.018 of a ground unit, under three
  pixels.

  **And a shaken coin is on a leash.** `SLIDE_MAX` caps only the *driven* part of a journey,
  so a coin could spend its energy, get flicked off a column, and then coast — in the air,
  where nothing brakes it — for half the room. A disturbed coin may not get further than
  `LEASH` from the spot it was shaken at; at the limit the *outward* component of its
  velocity is removed outright, because damping alone does not hold a line (a coin at the
  speed cap covers 0.048 a frame and a 14%-per-frame decay lets it coast a third of a unit
  past the limit). It can still slide along the leash or come back in, which is what a coin
  caught by the coins around it does. A coin you are dragging or have thrown is not on it —
  that is your hand, not the heap.

  Two further things the retune turned up. Resting coins were in a permanent **micro-bounce**
  — the bounce gate was two frames of gravity, which every settled coin crosses every frame
  it sits there — which shows up as a shimmer and silently *inverted* the weight order of an
  avalanche, because a light coin bounces higher and so spent more of its slide airborne and
  undriven. And the leash's brake zone has to be **narrow**: starting it at 60% of the leash
  braked almost every coin, and a brake applied to everything is just a second speed limit.

  `vaultcheck.mjs` asserts the seat order, the weight order, that nothing leaves the picture,
  and that an *undisturbed* woken coin sits at its angle of repose instead of creeping.
- **A hold shakes the money.** Pressing on a heap of coins and having it sit there perfectly
  still was the most inert thing this screen did. A hold now disturbs the hoard under the
  finger on its own clock (`SHAKE_MS`, ~11 Hz — running it per frame just pins every coin at
  full energy and the heap boils) and harder as the multiplier climbs, so at 16x the pile is
  visibly working, which is also the clearest read you get that the pour has gone up a gear.
  It runs whether or not an upgrade is selected, because pressing the money should move the
  money.
- **Dragging ploughs.** A coin hauled across the top of a heap does not pass through it — it
  shoves what it crosses out of the way and leaves a furrow. It fires on distance travelled
  rather than per pointer event, so a slow drag disturbs the same ground once and a fast one
  leaves an evenly spaced wake.
- **Weight.** Gravity is the same for every coin — that is physics — but nothing else is:
  `MASS` (bronze 1.00 → blue 2.40) sets bounce, grip, how much of a fling a coin carries,
  and how it sounds when it lands. A billion-point coin should feel like picking up a bar.
- **The throw.** `fling` is a velocity in ground units **per millisecond**, measured against
  the clock and clamped (`THROW_V`, `THROW_VY`). A pointermove stream is 60–120 Hz and
  irregular, so a per-event displacement used as a velocity leaves a coin travelling at the
  sample rate times its real speed.
- **A column comes apart.** A stack used to be one rigid body: shake the heap under it and
  the whole tower slid across the floor like a bar of soap and stood there intact.
  A driven column now **sheds from the top** — one coin at a time becomes its own body,
  pushed off the way the heap is giving way, and it falls and rolls down the slope while the
  column under it gets visibly shorter. Shedding has to be fast (`SHED_RATE`) or the towers
  survive the trip; a disturbed column is in pieces inside about a third of a second. A
  shard is keyed apart from the slot it came from, so that slot keeps drawing the coins
  still in it.
- **The room is what you can see.** `limAt(gz)` inverts the projection at the coin's own
  depth, so a coin stops at the edge of the *frame* whatever the aspect ratio. Deriving the
  wall from the slot list's own outermost spill instead put it at gx 1.99 on a phone where
  the screen edge is about 0.8 — a shake slid 77 of 90 coins clean off the side. And `gz` is
  held to the hoard's own depth, because a coin free to wander into the back of the room is
  drawn high and small by the perspective, which is what "floating in the air" was: nothing
  was ever airborne, it was standing on the floor behind the heap. The hoard's own spill
  legitimately sits past the frame edge, so a coin that *wakes* out there is not teleported
  in — it simply cannot go further out, and once it comes inside it is held inside.
- **RESTOCK.** Every disturbed coin flies home to its slot and the columns get their shed
  coins back; shards are deleted, since they have no home. Press it on an already tidy hoard
  and it **re-pours** instead: a fresh seed, a visibly different heap of exactly the same
  money. Neither touches a Prestige Point or changes the coin count, and `vaultcheck.mjs`
  asserts both.

Only coins in the live surface band can be disturbed — the deep layer is a baked canvas and
moving one of its coins would cost a re-bake per frame. That is also the honest limit: you
can push the money on top of the pile around, not the money underneath it. Bodies are capped
at `MAX_BODIES` and they **sleep** — but only after `STILL_FRAMES` consecutive quiet frames
*and* only when nothing is driving them. A column sheds only when something is pushing it
*sideways*: including the vertical velocity in that test meant the first frame of gravity
after a wake shed a coin off every column in the hoard, untouched. A bare `speed < threshold` test sleeps a coin on the very
frame it breaks loose, before it has accelerated, and zeroes the velocity it was just given.

`surfaceAt(gx, gz)` takes **world** ground units and converts into and out of the slot space
the mound functions are defined in. A body stores `gx = slot.x × PILE.dx` and
`gz = slot.z × PILE.dz`; evaluating the mound directly on those compares a radius scaled by
1.20 in x and 0.150 in z against a radius in neither, and every coin is handed a surface
height with nothing to do with the heap it is sitting on.

A coin **buried** in the heap is resting on the coins around it, not on the surface above it,
so the floor is never above where the coin already was — it can land on the surface, it can
never be lifted onto it. And the physics room is sized from the hoard's own reach
(`slots.ex/ez`) rather than a constant, or the spilled coins on the heap's foot start outside
the walls and get teleported inward the first time they wake.

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

## Payday — your run becomes wealth (v153 C)

Earned PP used to be in the pile the moment the vault opened. Now the vault **shows it
arriving**, once, as a reward sequence, and only then is the pile the new pile.

**What triggers it.** The career settle (`screenGameOver` / `screenWin`) has already put the
PP on `state.pp`, counted the career (`careersCompleted`) and saved — and the save raises
v151 A's lifetime-earned counter (`ppLifetimeV151A`, which only ever goes up). The bridge's
`pending()` owes a payday when **a career has settled since the vault last played one**; its
size is the lifetime PP earned **since the vault last showed a balance** (every ordinary
open brings that up to date), so the whole run — the payout, the bank, any bounty on the
way — lands as one shower. A first sight with no record at all takes the settled player's
own `_vaultPayV137`. A different save (fewer careers, a lower lifetime) resets the record
rather than replaying anything. Whichever door opens the vault — the tree's *Visit the
Vault*, the top-bar chip, a BUY row, the win screen's button — the payday plays first.

**Why it cannot replay or mint.** What was shown lives in `rib.vaultPay.v153` — presentation
state, OUTSIDE the save, like `rib.legacy.v152` — and it is written **before** the sequence
starts, so leaving mid-shower, reopening, or reloading never plays it again. The vault's own
`balance` is `to`, the game's real number, from the first frame; the sequence only moves the
*displayed* number and the hoard's *drawn* balance from `from = to − gain` up to it. Nothing
in it reads or writes `state`. `payout(n)` (the old hook) plays a pending award, and
otherwise a presentation-only replay of `n` that records nothing.

**The pacing** — one coin, a handful, a shower, an avalanche, silence, CLINK:

1. The room darkens (a vignette centred on the pile) and holds the **old** balance ~0.4 s.
2. `+1,284 PRESTIGE` appears above the pile with a slow gold pulse.
3. One coin drops from the top and lands near the centre; a light haptic, a clink.
4. A short pause, then the shower. Its rate is a jackpot building: it starts sparse and
   climbs for ~70% of its length (`buildSchedule` inverts that rate's running total), then
   thins, so the last few arrive on their own — and those fall 1.3x slower.
5. The balance counts up **as coins land** (each carries a share of the gain; the first 2%,
   the last 8%), rapidly but never ahead of them, and never to the total before the last coin.
6. A silence (`gap`), then the final coin — the largest, gold (blue for a billion+), spinning
   slowly — lands with a heavy CLINK: the total locks, a warm ring runs out across the floor,
   a band sweeps it, the door on the far wall answers, a highlight crosses the number.
7. Only now are RESTOCK / DETAILS / CHOOSE AN UPGRADE live (they were there, dimmed, asleep).

**Size is logarithmic in the gain** (`paydayPlan`): tiny (<25) 8-15 coins, ~2 s to the lock ·
small (<250) 20-35 · medium (<2.5K) 40-70 · large (<50K) 80-120 · huge 120-180 · a **new
personal record** (the biggest award this device has shown, after the first) or a 100M+ award
is the **prestige storm**: 200 coins, god-rays over the peak, a longer finale, a heavy haptic,
and NEW PRESTIGE RECORD. One coin never stands for one point; 40x the PP is well under 2x the
coins.

**Each coin is physical** (screen space, one pooled object): its own start X and height, fall
time, size, spin speed and direction about its axis (the procedural `|cos|` squeeze through
the edge sprite, as everywhere in the vault), in-plane tumble, bounce height and landing
scatter. A shadow under it firms up and widens as it nears the floor. On impact it squashes
a little, bounces once or twice lower each time, turns from the tumbling face to the `flat`
sprite as it lies down, rests, and fades into the hoard — whose drawn balance has risen under
it. **Mid-depth coins land on the very slots the grown hoard reveals** (the slots between
`coinsFor(from)` and `coinsFor(to)`, in reveal order), so a coin comes to rest exactly where
the pile then shows one; with no new slot to show (a small gain on a big pile) they land on
the live surface. **Far** coins (~22%) are smaller, darker, and drawn before the hoard so the
heap hides them; **near** ones (~12%) are larger, pre-blurred (a down-and-up copy of the
sprite, once per face) with a short smear, and land at the pile's foot — never down among the
controls. Now and then one bounces **at the camera** (it grows as it comes forward), one
valuable coin spins slowly on its way down, a face swinging square to the camera flashes a
glint, and major impacts throw dust and sparks. Not every coin: the strongest effects are kept
for the storm and the finale.

**Performance.** `MAX_LIVE` (150) coin objects and `MAX_PARTS` (200) particles allocated once
per sequence and reused (when the pool is full the coin lying still longest merges early);
all of it is `drawImage` on the scene's one canvas, into the frame the scene already draws
(wrappers on `drawHoard` / `drawFlyers` / `drawAir`), and a coin out of frame is not drawn.
The rain honours the scene's adaptive `lite` flag (no rims, no smear, only the big bursts).
The hoard's balance is pushed at most every 90 ms, so the deep layer re-bakes a few times a
second, not per coin. A local seeded PRNG (`M.rng`) — nothing is drawn from the game's random
stream.

**Sound** (`rib-vault-audio.js`, same bus, compressor and `RIB_MUSIC.sfxOut`): a distant coin
is a light high tick, one on the pile a medium clink, a near / heavy / gold one an impact with
a thud under it — pitch and level jittered per strike, through the rain's own pool (`RAIN_MAX`
= 9 at once, a floor between two; the rest are counted as dropped, never stacked). Under the
peak a cascade bed swells with the impact rate; under a large award a very quiet riser climbs
a fifth and **resolves** on the final coin, which is one heavy CLINK (a low thud, a long gold
ring, a shimmer). **Haptics** (`ribHaptics.impact`): LIGHT on the first coin, a LIGHT on a big
near impact at most every 320 ms, MEDIUM at the lock (HEAVY for a record or a storm).

**Interaction.** A tap anywhere on the room (not a button) during the sequence accelerates it
(x2.6); a second tap skips straight to the locked final state. It is caught before the canvas's
own handler, so it can never start a pour. After it settles, a press on the pile shifts the top
layer (v137 F's hold-shake) and it, and a drag across the pile, answer with a quiet metal `wiggle`.

**Reduced motion**: no fall, no shake, no particles, no sweep — six coins fade in on the pile
while the number counts up quickly, and the final pulse is a fade (~1.5 s).

**Beyond a pile — the reserve.** At extreme totals the wealth outgrows one heap: columns of
coin either side at 100M, crates at 1B, sacks at 10B, the crates stacked at 100B, a treasury
along the back wall at 1T (`RESERVE`, `RESERVE_AT`, `drawReserveV153`). It is set dressing at
the **sides** and back of the room, behind the hoard, so the pile, the number and the controls
stay clear; each new layer fades in as the balance crosses it, and every piece is drawn once
into its own small canvas.

`RIB_TUNE.v153C = 0` turns the sequence off. Hooks: `__RIB_VAULT_DEV.payday()` (the state),
`payTap()`, `payStep(ms, draw)` / `payFreeze(on)` (drive the sequence's clock in fixed steps —
how `v153Ccheck` stays exact on a loaded box), `reserve()`, `window.__V153C`,
`__RIB_VAULT_BRIDGE.pending()` / `paydayRecord()`, `__RIB_VAULT_AUDIO.stats()`.

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

A cue sheet: `.00-.24` the lock wheel turns a turn and a quarter; `.20-.46` eight bolts draw
**in**, toward the hub, which is what unlocking is; `.46-.92` the leaf pivots and sweeps
out; `.72-1.0` the room comes up behind it and the camera settles out of a 6% push.

The leaf, its wheel and its bolts are drawn inside **one transform**, so they are a single
rigid body throughout — the wheel cannot drift off the hub and the bolts cannot detach from
the door they are holding shut. The pivot is a horizontal squash anchored on the **hinge**
rather than the centre: a door turning away from you projects exactly that way, and
anchoring it at the centre is what makes a swing read as a slide. The interface is faded out
for the first three quarters, because an interface sitting over a shut door is the single
thing that gives an opening away. It plays once per install (`rib.vaultDoor.v137`), is skippable by tapping, and is
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

## A note on `coachcheck.mjs`

It is the longest check in the repo — it plays a whole first week, live game included, and
drives the UI by clicking text. It is **stochastic and it flakes**: on this branch it came
back 86/0, 79/7, 79/7, 86/0 across four runs, with the failures all being the same stall at
the pregame's CONTINUE TO MATCH, and the same build passed cleanly on the runs either side.
The vault is an overlay that is not even built until it is first opened, and nothing in the
physics runs while it is closed, so a failure there is worth re-running before it is worth
believing. If it stalls repeatedly at the *same* step, that is a different matter.

## Dev loop

```bash
python3 scripts/build-vault-art.py --proof   # re-cut the sprites, write the proof sheets
npm run dev
node scripts/vaultcheck.mjs                  # the gate
node scripts/vaultshot.mjs                   # the eight wealth states
WIDE=1 node scripts/vaultshot.mjs            # desktop
KEY=oracle node scripts/vaultspend.mjs       # a real spend, photographed
node scripts/vaultdoor.mjs                   # the opening and the payout
node scripts/vaultphys.mjs                   # a coin in hand, the shake, the furrow, the restock
node scripts/v153Ccheck.mjs                  # the payday (v153 C)
node scripts/v153Cshot.mjs                   # ...photographed: GAINS=12,1284,250000 RECORD=1 REDUCED=1
```

Hooks: `window.__RIB_VAULT`, `__RIB_VAULT_BRIDGE`, `__RIB_VAULT_MODEL`, `__RIB_VAULT_SCENE`,
`__RIB_VAULT_AUDIO`, `__RIB_VAULT_PHYS`, `__RIB_VAULT_DEV`, and `window.__V137` on the
game's side.
