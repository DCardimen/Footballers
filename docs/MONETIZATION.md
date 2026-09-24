# MONETIZATION — v149 E, "THE STORE IS WIRED, AND SWITCHED OFF" · v150 C, "THE HOOKS ARE IN, THE SWITCH IS STILL OFF"

`src/27-monetize.js` is the monetization foundation: one provider-agnostic module, `window.RIB_MONETIZE`,
behind **one master switch that ships `false`**. While it is off the file defines the API object and does
nothing else — no wrapper, no DOM, no style, no timer, no listener, no observer, no storage write — and
`scripts/v149Echeck.mjs` proves that against a boot with the file blocked. **Nothing changes for any
player until the owner flips it.** Since v150 C the game carries the hooks (§8) — each one the identity while the
switch is off, which `scripts/v150Ccheck.mjs` proves against the same blocked boot.

This page is the model, the catalogue, the honesty about client-side limits, the provider steps per
platform, the store-policy notes, the in-game hooks (H1–H11) and where they live, how to launch it (§9), and the
decisions only the owner can make.
`docs/AUDIT.md` §3 is the analysis it grew out of.

---

## 1. The model

| | What | Why |
|---|---|---|
| **Free, always** | The whole game. Every career, level, position, mode, screen. 1× and 2× play speed. **Every setting that is free today** — *My plays only* (`onlyInvolved`), *skip opponent drives* (`skipOpp`), fast sim (`fastSim`), the camera and weather pickers, the Team Creator. | A premium-quality sim that is free to play is the offer. Taking away something a player already had reads as a bait-and-switch and costs reviews. |
| **Rewarded (opt-in ad)** | `▶ Watch an ad: 4× for 20 min` (under the live speed row, and in the store). `▶ Watch an ad: double this payout` on the two career-end screens (doubles the career SETTLE, once a career, capped). | The player chooses the ad and chooses when. No forced interstitials, ever, and never inside a play. A daily cap (6) keeps it from becoming the game. |
| **Paid, one time** | **Running It Back PRO** (~$5.99): no ads, permanent 4×, extra save slots when they ship, a "supports the dev" mark. | One clean non-consumable is the simplest thing to review, restore and explain. |
| **Paid, cosmetic** (later) | Kit / crest / end-zone packs — deterministic, listed, previewable. | Clean entitlement targets; they change nothing on the field. Listed as "SOON" until content exists. |
| **Membership** (maybe, later) | Only with server-side value: cloud save, seasonal cosmetics, verified daily boards. | A subscription with nothing a server does is hard to justify to a player or to App Review. Flag `features.membership`, off. |
| **Never sold** | Gear or gear rolls; wheel spins, re-rolls, "fate" odds; Prestige Points; prestige-tree power; anything random; any setting that is free today. | See §2. |

### The speed ladder
Today the live row is ½× / 1× / 2× / 4× and **4× is free**. The owner's ladder is 1–2× free, 3× earned by
playing, 4× paid or rewarded. What is built: `features.gateSpeed4` locks 4× behind `speed4` (ad, Pro,
membership, or **grandfathered** — see decision D1). v150 C adds the 3× rung as a flag: `features.speed3` puts a
3× button between 2× and 4× (off by default — the row is then byte-for-byte the old one), and `features.gateSpeed3`
makes it need `speed3` (or `speed4`). What is still not built: the "earned by playing" rule that grants `speed3`
(decision D10) — until there is one, leave `gateSpeed3` off or nobody can reach 3×.

---

## 2. What is never sold, and why

- **No loot boxes.** Gear drops roll rarity off `ba` weights and v147 C rolls modifiers; the season,
  story, plan and rivalry "wheels" are rolls. Selling any of them — or a re-roll, or better odds — is a paid
  random item: both stores then require published odds, Belgium bans it, the Netherlands restricts it, and
  several app-review guidelines treat "spin" + IAP as gambling-adjacent. The store screen says so in its
  footer: *Never for sale: gear, gear rolls, wheel spins, re-rolls or Prestige Points.*
- **No pay-to-win.** PP buys prestige-tree nodes that change on-field results (`perfFlat`, `ppMult`, the
  Impossible branch up to 10M PP). Selling PP or node levels is pay-to-win the moment any board is ranked.
  Today's ranked boards — Score Attack and the Daily Challenge (`docs/LEADERBOARDS.md`) — do **not** read the
  career's prestige or PP, so the rewarded PP double does not reach them. **If a career / PP board is ever
  added, boosted careers must be excluded or the boost turned off** (decision D3).
- **No take-aways.** *My plays only*, *skip opponent drives* and fast sim are free Settings toggles. They
  stay free. If more depth is sold later, sell NEW depth (e.g. "sim to my next snap").
- **No forced ads.** No interstitials, no banners, nothing that interrupts a play. Rewarded only.

---

## 3. The catalogue (suggested prices)

Prices are display strings for the web/mock path; on iOS/Android the store's own localized price replaces
them (RevenueCat / StoreKit / Play Billing return it).

| Product id | Kind | Price | Grants (entitlement keys) | Flag |
|---|---|---|---|---|
| `rib.pro` | non-consumable | **$5.99** (range $4.99–$7.99) | `pro`, `noAds`, `speed4` (permanent), `saveSlots` = 3 | `features.pro` |
| `rib.cosmetic.kits1` | non-consumable | $1.99 | `cos_kits1` | `features.cosmetics` (off) |
| `rib.member.monthly` | subscription | $1.99 / month | `member`, `noAds`, `speed4` (31-day periods) | `features.membership` (off) |

| Rewarded placement | Reward | Where |
|---|---|---|
| `speed4` | `speed4` for `rewarded.speed4Minutes` (20) minutes — a second ad **extends** | live speed row chip, the locked 4× button's sheet, the store |
| `ppDouble` | `ppDouble`, 1 use: the career settle is paid again, capped at `rewarded.ppDoubleMax` (250,000) | the career-end screens (`gameover`, `win`) |

Daily cap: `rewarded.dailyCap` = 6 rewarded ads per local day, all placements together.

---

## 4. The API

```js
const M = window.RIB_MONETIZE
M.enabled                         // false unless switched on
M.config                          // the merged configuration (flags, prices, placements, provider keys)
M.has(key)                        // sync; false while OFF
M.until(key)                      // ms timestamp, Infinity for permanent, 0 if not held
M.value(key)                      // e.g. value("saveSlots") → 3
M.grant(key, {until|minutes|periodDays, uses, value, source})   // what providers call; refused while OFF
M.revoke(key), M.consume(key), M.list(), M.onChange(cb) → unsubscribe
M.speedAllowed(s)                 // THE speed question; true for every speed while OFF
M.clampSpeed(s)                   // v150 C (H3): s if allowed, else the fastest allowed below it (2× today); s while OFF
M.speedLocked(s)                  // v150 C (H1): the game's setSpeed() hands a refused tap here → the offer sheet
M.back()                          // v150 C (H11): close the top store / ad / checkout sheet; false if none (or OFF)
M.restoreUI()                     // v150 C (H10): RESTORE PURCHASES with a toast; re-draws Settings
M.claimPayoutBoost(amount, ctx)   // the in-game payout hook: returns the EXTRA PP (0 while OFF / no ppDouble)
M.showRewarded(placement) → Promise<{rewarded, reward?, reason?}>
M.purchase(productId)     → Promise<{ok, productId, reason?, pending?}>
M.restore()               → Promise<{ok, restored:[productId]}>
M.track(event, props), M.addAnalyticsSink(fn)
M.registerProvider(name, adapter), M.providers, M.provider
M.openStore(), M.closeStore()
M.tampered                        // true if the entitlement store failed its tag this session
M.hooks                           // {speed:"game", payout:"game", buy:true} while ON ({} while OFF)
M.dev                             // dev hosts only: advance(ms) fake clock, reset(), events, now()
```

**The game reads only `enabled` / `has()` / `list()` / `speedAllowed()` / `clampSpeed()` / `claimPayoutBoost()` /
`config.features`, and calls `speedLocked()` / `back()` / `restoreUI()` / `openStore()` — every one of them behind
`enabled`.** A reward is granted
only when the provider reports `rewarded:true` (the ad was watched to the end); an early close grants nothing.

### Analytics
`track()` records to an in-memory ring (last 60 events, `M.dev.events` on a dev host) and calls any sink added
with `addAnalyticsSink`. **No sink is added, so no data leaves the device.** Adding one (TelemetryDeck,
Plausible, Firebase…) is a privacy-label change on both stores. Events emitted: `monetize_on`, `ent_grant`,
`ent_consume`, `ent_tamper`, `ad_offer_accepted`, `ad_rewarded`, `ad_not_rewarded`, `purchase_start`,
`purchase_ok`, `purchase_fail`, `restore_start`, `restore_done`, `store_open`, `speed_locked_tap`,
`prestige_buy`, `pp_double`.

---

## 5. Entitlements, and what a client-only game cannot promise

- **Stored outside the save.** `localStorage["rib.monetize.ents.v1"]` =
  `{v:1, e:{key:{until,uses,value,source,at}}, caps:{day,ads}, gf, tag}`. The game save
  (`gridiron_save_v1`) never mentions it: a new career, a hard reset (`Cr`) and an imported save (`Pr`) neither
  grant nor take an entitlement (`v149Echeck` asserts all three).
- **Versioned** (`v:1`); a future `v:2` reader migrates or discards.
- **Integrity tag**: FNV-1a over a salt + the body. A hand-edited store fails the tag and is discarded
  (`tampered` is set, `ent_tamper` tracked); `restore()` brings real purchases back from the provider.
- **This is not security.** The salt is in the shipped source and anyone with devtools can call `grant()` or
  recompute the tag. That is acceptable for a single-player game — the same player can already edit the
  save and every `RIB_TUNE` dial. What it must not be is the source of truth for money:
  - **Native:** the store is the truth. RevenueCat (or StoreKit 2 / Play Billing with your own server)
    verifies the receipt; the local store is a cache, re-filled by `restore()` at boot.
  - **Web:** a Stripe Payment Link takes money but proves nothing to the page. Grant only after a server
    check (`config.web.verifyUrl`: POST the Checkout session id → signed `{ok, productIds}`), e.g. a Supabase
    edge function beside `verify-daily`. **That endpoint does not exist yet, so the web provider never
    grants.**
  - Strip `M.dev`, `DEV`, `__GRIDIRON_AUDIT__.setState` and `RIB_TUNE` writes from store builds (AUDIT §3.3) —
    not for security, so casual tampering is not a console one-liner.
- **Grandfathering**: the first time monetization runs ON on a device, if that device already has a career
  (a save with a player, a finished career, PP, or a best level), it is granted `speed4` permanently
  (`source:"grandfather"`). Decided once, recorded as `gf`.

---

## 6. Providers

An adapter is `{ name, available(), init(api), showRewarded(placement), purchase(product), restore() }`. The
module grants; an adapter only reports what the platform said. Select with `config.provider`.

| Provider | Status | What it is |
|---|---|---|
| `mock` | **working** (dev / checks) | A countdown "ad" (`mock.adMs`, `?monetizeAdMs=` on dev hosts) with CLOSE — NO REWARD; a checkout dialog that charges nothing; its own record of purchases (`rib.monetize.mock.v1`) so `restore()` works. |
| `none` | working | Offers nothing, sells nothing. |
| `admob` | stub, runs only with the plugin | `@capacitor-community/admob` rewarded video. |
| `revenuecat` | stub, runs only with the plugin | `@revenuecat/purchases-capacitor` — StoreKit 2 + Play Billing behind one API, with receipt validation. |
| `admob+revenuecat` | stub | The store-build pairing: AdMob shows, RevenueCat sells. |
| `web` | stub, never grants | Stripe Payment Link + the future `verifyUrl`. |

### Android (Google Play) — AdMob + RevenueCat
1. Capacitor first (docs/COMMERCIAL.md §1). `npm i @capacitor-community/admob @revenuecat/purchases-capacitor && npx cap sync`.
2. AdMob: create the app and a **Rewarded** ad unit; put the App ID in `AndroidManifest.xml`
   (`com.google.android.gms.ads.APPLICATION_ID`), the unit id in `config.native.admobRewardedId.android`.
   Consent: the UMP flow (`AdMob.requestConsentInfo()` / `showConsentForm()`) before the first ad for
   EEA/UK users. Use Google's test unit ids until release.
3. Play Console: create `rib.pro` as a one-time product (and the subscription if D5 says yes); link Play to
   RevenueCat (service-account JSON); in RevenueCat create entitlement `pro` → product `rib.pro`, and an
   offering containing it. Put the **public** Android SDK key in `config.native.revenuecatApiKey.android`.
4. `config.provider = "admob+revenuecat"`; call `restore()` at boot (cheap with RevenueCat's cache).
5. Data safety form: AdMob collects device identifiers / ad data — declare it.

### iOS (App Store) — AdMob + RevenueCat (StoreKit 2)
1. Same plugins. AdMob App ID in `Info.plist` (`GADApplicationIdentifier`) plus the `SKAdNetworkItems` list.
2. **ATT**: only if personalised ads are used — then `NSUserTrackingUsageDescription` and the ATT prompt
   before the first ad (`AdMob.requestTrackingAuthorization()`); otherwise request non-personalised ads and
   skip the prompt. UMP for EEA/UK either way.
3. App Store Connect: `rib.pro` as a **Non-Consumable** IAP; RevenueCat with the App Store Connect API key /
   shared secret; entitlement `pro`. Public iOS SDK key → `config.native.revenuecatApiKey.ios`.
4. A **Restore Purchases** button is required — the store screen has one.
5. Privacy nutrition label: AdMob → "Identifiers", "Usage Data", possibly "Used to Track You".

### Without RevenueCat
StoreKit 2 (a small Swift plugin or `cordova-plugin-purchase`) and Google Play Billing Library 6+ each need a
server that verifies the transaction / purchase token before granting (App Store Server API; Play Developer
API `purchases.products.get`) and acknowledges Play purchases within 3 days or they refund. Write a provider
adapter with the same five methods.

### Web (PWA / GitHub Pages)
Stripe Payment Link per product in `config.web.paymentLinks`; set the link's success URL back to the game with
`?session_id={CHECKOUT_SESSION_ID}`; build `verifyUrl` (retrieve the Checkout Session with the secret key
server-side, return signed product ids); then make the web provider grant on a verified response. Ads on the
web would need AdSense-for-games / H5 rewarded ads — not stubbed; the web provider offers none.

---

## 7. Store-policy notes

- **Apple 3.1.1**: digital goods and features unlocked inside an iOS app must use In-App Purchase. The web
  (Stripe) path must never appear in the iOS build — select the provider per platform; do not show "buy on the
  web" links in the iOS app (the US anti-steering carve-out is narrow and changing; do not rely on it).
- **Google Play Payments policy**: Play Billing for digital goods in Play-distributed apps (user-choice
  billing only where enrolled).
- **Rewarded ads** must be opt-in, clearly labelled with the reward before the ad, and the reward granted
  only on completion — all three are what the module does.
- **Consent**: UMP (GDPR/UK), ATT (iOS, only for tracking), US state privacy notices via UMP as well.
- **Kids / Families**: a career that starts at "Pee Wee" can attract under-13s. If the store age rating or
  audience includes children, Google Families policy and Apple's Kids category forbid personalised ads and
  restrict ad SDKs — request non-personalised ads (`tagForChildDirectedTreatment` /
  `tagForUnderAgeOfConsent`) or add a neutral age gate. Decision D6.
- **Odds disclosure**: not needed while nothing random is sold. It becomes mandatory the day it is.
- **Privacy labels**: "Data Not Collected" is truthful only while no ad SDK and no analytics sink ship.
  Turning ads on changes both stores' forms. A privacy-policy URL is required either way.

---

## 8. The hooks

v150 C put the hooks IN the game. Every in-game hook asks `mzV150C()` (src/07-career-app.js) — or, outside the
career block, `window.RIB_MONETIZE && RIB_MONETIZE.enabled` — first, and that is false unless the module exists AND
says it is on. **With the switch off each hook is the identity**: the same speed, the same markup, the same payout,
not one field written. `scripts/v150Ccheck.mjs` proves it against a boot with `27-monetize.js` blocked (the live speed
row, the Settings screen and the menu's tiles byte-for-byte; both career-end payouts to the PP and the player's
fields), and `scripts/v149Echeck.mjs` still proves the module itself makes no timer, listener, observer, element or
storage write. The in-game helpers are hoisted `function` declarations beside `bankPPV136` under the banner
`v150 C THE HOOKS ARE IN, THE SWITCH IS STILL OFF`, because screens restored at boot call them by bare name (v140);
`window.__V150C` is the module's handle on the game's side (`mz`, `clamp`, `speed3`, `cosOk`, `payout(ctx, pay)`).

### In the game (v150 C)

| # | File · function | What it does | OFF |
|---|---|---|---|
| H1 | `src/07-career-app.js` · `setSpeed(e)` — its first statement | a speed `speedAllowed()` refuses returns before `liveCtl.speed` moves and goes to `RIB_MONETIZE.speedLocked(e)` (the offer sheet; a gated 3× only says it is earned). Covers the buttons AND every caller by bare name, so the module no longer wraps `window.setSpeed` | `mzV150C()` is null → the old body |
| H2 | `src/07-career-app.js` · the live template's speed list (`["2","2×","▶▶"]` …) | `...(speed3V150C() ? [["3","3×","▶▶▸"]] : [])` — the 3× rung, only with `features.speed3`; `gateSpeed3` gates it on `speed3` | spreads `[]` → ½× / 1× / 2× / 4×, byte-for-byte |
| H3 | `src/07-career-app.js` · `startLivePlayback()` — `speed:` | `speedClampV150C(...)` → `RIB_MONETIZE.clampSpeed(s)`: a carried 4× with no `speed4` restarts at 2× the moment playback (re)starts, not a second later on the module's tick | returns `s` |
| H4 | `src/07-career-app.js` · `screenGameOver()` — the settle chain, after `_vaultPayV137` | `payoutBoostV150C(e, r, "gameover")`: records the settle (`e._payV150C`) and, if a `ppDouble` is held, pays it again (capped) onto `state.pp` and `_vaultPayV137`, marks `_ppDoubledV149E`; the card's PP EARNED adds `_ppDoubledV149E` | returns 0, writes nothing (the card adds `undefined \|\| 0`) |
| H5 | `src/07-career-app.js` · `screenWin()` — the same place | `payoutBoostV150C(e, n, "win")` | as H4 |
| H6 | `src/07-career-app.js` · `bankPPV136(n, why)` | **none — deliberately** (a comment says so). Season PP is never boosted; only the settle is | — |
| H8 | `src/07-career-app.js` · `screenSettings()` camera / weather rows, `window.camModeSet112`, `window.wxModeSet144` | an entry tagged `cos: "cos_…"` is not drawn and its setter refuses it until `has(cos)`. **No existing entry is tagged** — only NEW content can be gated (decision D9) | untagged → always shown |
| H9 | `public/rib-menu.js` · `storeTileV150C()` in the tile nav; `public/rib-menu-navigation.js` · `activate('store')` | a STORE tile after PRESTIGE (`legacy_crown`, "PRO · 4× BOOST" / "PRO ✓ · RESTORE"), opens `RIB_MONETIZE.openStore()`. Baked with `RIB_MENU_VERSION=v150c` | `''` → the tiles are byte-for-byte the old ones |
| H10 | `src/07-career-app.js` · `screenSettings()` → `storeRowV150C()`; `src/22-hub-sections.js` puts it in the SAVE tab | a 🛒 STORE & PURCHASES card: what this device holds, RESTORE PURCHASES (`RIB_MONETIZE.restoreUI()`), Open the Store | `""` |
| H11 | `src/26-platform.js` · `back()` — first line | `RIB_MONETIZE.back()`: the ad (forfeits the reward, as CLOSE does), the checkout (cancelled), the offer sheet, the store — the top one closes and back stops there | skipped |
| H7 | `src/06-phaser-launcher.js` · `var SAVE='gridiron_save_v1'` | **documented only** — see below | — |

### Still installed by the module (only while ON), from outside the game's files

| Hook | How | Why it is still outside |
|---|---|---|
| **Prestige purchase** | wraps `window.buy` (analytics only: `prestige_buy`) | there is no hook for it, and nothing about the purchase changes — the tree is never for sale |
| **Speed row UI** | MutationObserver on `.speed-row` | the `▶ AD` / `PRO` badge on 4×, a dimmed gated 3×, the offer chip under the row and its countdown |
| **Career-end chip** | the same observer on views `gameover` / `win` | "▶ Watch an ad: double this payout"; a watched ad calls `window.__V150C.payout(view, settle)`, which pays, saves and redraws the card (a settle drawn by the boot restore runs before the module loads, so the module passes the settle it reads off `_vaultPayV137 − _ppBankV136`) |
| **Store entry on career screens** | `.topbar` (the v146 E shell) | a STORE / PRO ✓ chip |
| **Expiry tick** | a 1 s interval | a timed 4× that runs out steps the live game down through `setSpeed(clampSpeed(s))` |

### H7 — save slots (not built)

Pro promises "3 extra save slots (when slots ship)" (`value("saveSlots")` = 3). Slots are not a one-liner: the key
`gridiron_save_v1` is read and written in four places — `src/06-phaser-launcher.js` (`GridironStorage`, plus
`…_backup`), `src/07-career-app.js` (`SAVE_KEY`, the Settings size line, export/import), `src/26-platform.js`
(`ribSave`, the rolling backups, the native Preferences mirror) and the module's own grandfather test — and the
v106.1 / v140 boot restores the saved VIEW from it. The shape that fits: slot 1 stays `gridiron_save_v1` forever
(no migration), slot n is `gridiron_save_v1_slot<n>`, `localStorage["rib.saveSlot.v1"]` names the active one,
`GridironStorage` resolves the key per call (everything else already goes through it — the platform wraps
`GridironStorage.save`), a slot switch is a save + reload (like `ribSave`'s import), and the picker lives in Settings ›
SAVE. The number of slots is `1 + (RIB_MONETIZE.enabled ? RIB_MONETIZE.value("saveSlots") : 0)`; a slot that loses
its entitlement stays readable, never deleted. Checks to write with it: `bootviewcheck` on every slot, `v149Dcheck`'s
backups per slot.

---

## 9. How to turn it on

- **Try it (dev):** `npm run dev`, open `http://localhost:5173/?monetize=1` (add `&monetizeAdMs=1500` for short
  mock ads). Or `localStorage["rib.monetize.dev.v149"]="1"`. The flag is honoured **only** on `localhost`,
  `127.0.0.1`, `[::1]`, `0.0.0.0` or `file:` — a shipped build ignores it. `?monetize=0` forces it off.
  `RIB_MONETIZE.dev.reset()` clears the entitlement and mock stores; `dev.advance(ms)` moves its clock.
- **Turn a feature off without code:** any `features.*` flag in the injected config.
- **Verify:** `node scripts/run-checks.mjs v149Echeck v150Ccheck` (the OFF proofs + the ON flows); then with the switch
  OFF, `bootviewcheck`, `walk`, `menu-integration-check`, `layoutcheck`, `honorcheck`, `vaultcheck`. The existing
  checks drive the live game at its fastest button (4×): run them with the switch OFF, or on a Pro / grandfathered
  device.

### How to launch — the checklist

**The rule: leave `var MONETIZE_ENABLED = false;` in `src/27-monetize.js` alone, forever.** Each build turns it on
(or not) by injecting `window.RIB_MONETIZE_CONFIG` from a script that runs BEFORE `./src/27-monetize.js` in
`index.html`. The config is merged over the defaults (objects deep, arrays replaced), so a build names only what it
changes. `v150Ccheck` section 5 boots exactly this way.

| Build | Config it injects | Provider | Notes |
|---|---|---|---|
| **Web (GitHub Pages / PWA)** | nothing — **OFF** | — | The shipped web game stays free and ad-free with every speed. If D8 ever says yes: `{enabled:true, provider:"web", features:{gateSpeed4:false, rewardedSpeed:false, rewardedPP:false}, web:{paymentLinks:{…}, verifyUrl:"…"}}` — and only once `verifyUrl` exists |
| **Android (Play)** | `{enabled:true, provider:"admob+revenuecat", native:{revenuecatApiKey:{android:"goog_…"}, admobRewardedId:{android:"ca-app-pub-…/…"}}}` | AdMob + RevenueCat | + `features.gateSpeed4` per D1 |
| **iOS (App Store)** | `{enabled:true, provider:"admob+revenuecat", native:{revenuecatApiKey:{ios:"appl_…"}, admobRewardedId:{ios:"ca-app-pub-…/…"}}}` | AdMob + RevenueCat | never `"web"` (Apple 3.1.1) |

1. **Decide D1–D10** (§10). At minimum: D1 (is 4× gated), D2 (model), D4 (price), D6 (audience → ad personalisation).
2. **Write the per-build config file** — e.g. `native/monetize.config.js` = `window.RIB_MONETIZE_CONFIG = {…}` — and
   have the Capacitor build copy it into `dist/` and add `<script src="./monetize.config.js"></script>` right before
   the `27-monetize.js` tag (a small step in the build script or a post-`vite build` patch; the web build does not
   do it). The keys are PUBLIC SDK keys; no secret belongs in the page.
3. **Strip the dev surface from store builds** (AUDIT §3.3): the `?monetize` / `rib.monetize.dev.v149` flag is already
   dev-host-only, but also drop `M.dev`, `DEV`, `__GRIDIRON_AUDIT__.setState` and `RIB_TUNE` writes.
4. **Providers** (§6): install `@capacitor-community/admob` and `@revenuecat/purchases-capacitor`, `npx cap sync`;
   AdMob app + a Rewarded unit per platform (Google's test ids until release); the App ID in `AndroidManifest.xml` /
   `Info.plist` (+ `SKAdNetworkItems`); UMP consent before the first ad; ATT only for personalised ads.
5. **Products**: `rib.pro` as a one-time product (Play) / Non-Consumable (App Store); in RevenueCat an entitlement
   `pro` → `rib.pro` and a current offering holding it (`native.entitlementMap` maps it back); the membership and the
   cosmetic pack only when their flags (`features.membership`, `features.cosmetics`) and content exist.
6. **Restore at boot**: call `RIB_MONETIZE.restore()` once after launch in the store builds (RevenueCat caches it) —
   the entitlement store is a cache, the store is the truth. RESTORE PURCHASES is on the store screen and in
   Settings › SAVE (H10) — Apple requires it reachable.
7. **Store forms**: Play Data safety and the App Store privacy label change the day AdMob ships (identifiers, usage
   data, possibly tracking); a privacy-policy URL either way; the age rating / Families / Kids answer per D6.
8. **Sandbox pass** on a real device per platform: a rewarded ad watched through (4× for 20 min; the chip counts
   down; it expires back to 2×), one closed early (nothing), the payout double on both career-end screens (once),
   Pro bought (no ads, 4× for good), the app deleted and reinstalled → RESTORE brings Pro back, Android back closes
   each sheet (H11), and a device that already had a career keeps 4× (grandfathered, if D1 gates it).
9. **Before release**: `node scripts/run-checks.mjs v149Echeck v150Ccheck bootviewcheck walk menu-integration-check
   honorcheck vaultcheck layoutcheck smoke`; then real ad unit ids, production RevenueCat keys, and a staged rollout.

---

## 10. Decisions the owner must make

| # | Decision | Default in the code | Notes |
|---|---|---|---|
| D1 | **Is 4× gated at all?** It is free today. | `gateSpeed4: true` + `grandfatherSpeed4: true` | Gating it on the existing web build is a take-away for current players (grandfathering softens it only for devices that already have a career). Options: gate only in the store builds (inject `gateSpeed4:false` on the web), or keep 4× free and sell a new 8× / "sim to my next snap". |
| D2 | **Business model**: free + rewarded + Pro, or premium $2.99 (docs/COMMERCIAL.md's old plan), or both (premium on iOS, free+ads on Android). | free + rewarded + Pro | A paid app with ads reviews badly; do not do both on one platform. |
| D3 | **The PP double** — keep it? | on, capped 250k, once a career, settle only | Not pay-to-win today (no ranked board reads career PP). Must go, or boosted careers must be flagged unranked, if a career board is ever added. |
| D4 | Pro price (and whether Pro users still see the optional PP-double ad) | $5.99; `proKeepsPPAd:false` | "No ads" is cleaner; keeping the one opt-in ad for Pro is defensible but muddies the promise. |
| D5 | Membership | off | Only with server features (cloud save, seasonal cosmetics). |
| D6 | Audience / age rating → ad personalisation | not decided | Pee Wee framing may attract under-13s: non-personalised ads, or an age gate. |
| D7 | Rewarded-ad daily cap and the 20-minute window | 6 a day, 20 min | Tune after real data. |
| D8 | Web purchases at all | web provider never grants | Needs the verification endpoint and a Stripe account; must be excluded from the iOS build. |
| D9 | New cosmetic content (a camera, a weather look, a kit) while monetization is OFF — shown or hidden? | hidden until owned (`cosOkV150C`); OFF = not offered | With the store off there is nothing to buy it with; the alternative is to ship it free on the web build. No existing entry is tagged either way. |
| D10 | The 3× rung: shown at all (`features.speed3`), and how it is earned (`gateSpeed3` + an earn rule granting `speed3`) | both off | Needs an earn rule (e.g. a milestone calling `RIB_MONETIZE.grant("speed3")`) and a `v147Dcheck` row at 3× before it ships. |
