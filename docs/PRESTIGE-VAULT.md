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
