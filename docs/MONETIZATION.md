# MONETIZATION — v149 E, "THE STORE IS WIRED, AND SWITCHED OFF"

`src/27-monetize.js` is the monetization foundation: one provider-agnostic module, `window.RIB_MONETIZE`,
behind **one master switch that ships `false`**. While it is off the file defines the API object and does
nothing else — no wrapper, no DOM, no style, no timer, no listener, no observer, no storage write — and
`scripts/v149Echeck.mjs` proves that against a boot with the file blocked. **Nothing changes for any
player until the owner flips it.**

This page is the model, the catalogue, the honesty about client-side limits, the provider steps per
platform, the store-policy notes, the in-game hooks still to add, and the decisions only the owner can make.
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
membership, or **grandfathered** — see decision D1). What is not built: a 3× button and "earned by playing"
(needs a line in the live template and an earn rule — hook H2 below).

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
M.claimPayoutBoost(amount, ctx)   // the in-game payout hook: returns the EXTRA PP (0 while OFF / no ppDouble)
M.showRewarded(placement) → Promise<{rewarded, reward?, reason?}>
M.purchase(productId)     → Promise<{ok, productId, reason?, pending?}>
M.restore()               → Promise<{ok, restored:[productId]}>
M.track(event, props), M.addAnalyticsSink(fn)
M.registerProvider(name, adapter), M.providers, M.provider
M.openStore(), M.closeStore()
M.tampered                        // true if the entitlement store failed its tag this session
M.hooks                           // which wrappers are installed ({} while OFF)
M.dev                             // dev hosts only: advance(ms) fake clock, reset(), events, now()
```

**The game reads only `has()` / `until()` / `speedAllowed()` / `claimPayoutBoost()`.** A reward is granted
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

### Installed by the module (only while ON), from outside the game's files

| Hook | How | What it does |
|---|---|---|
| **Speed** | wraps `window.setSpeed` (= `ml`, `src/07-career-app.js`); the live buttons call `setSpeed(r)` by global name at click time | a locked 4× opens the offer sheet instead of changing speed; the 1 s tick steps an expired 4× back to 2× through the original `ml` |
| **Speed row UI** | MutationObserver on `.speed-row` | the `▶ AD` / `PRO` badge on 4×, the offer chip under the row, the countdown |
| **Prestige purchase** | wraps `window.buy` (= `Yl`, already wrapped once by the patch layer for haptics) | analytics only (`prestige_buy`); nothing about the purchase changes |
| **Career payout** | reads `__GRIDIRON_AUDIT__.getState()` on views `gameover` / `win` once `player._settled` | the chip; on a watched ad `claimPayoutBoost(settle)` is added to `o.pp` and `_vaultPayV137`, marked `player._ppDoubledV149E`, saved through `GridironStorage.save` |
| **Store entry** | `.topbar` (the v146 E shell) | a STORE / PRO ✓ chip |

### To add in the game later (one line each; the owner's call)

| # | File · anchor | The line | Why it is not done from outside |
|---|---|---|---|
| H1 | `src/07-career-app.js` · `function ml(e){` | `if(window.RIB_MONETIZE&&!RIB_MONETIZE.speedAllowed(e))return;` as its first statement | the wrapper covers the buttons; this covers any caller that uses `ml` by bare name |
| H2 | `src/07-career-app.js` · the live template's `[["0.5","½×","◀◀"],["1","1×","▶ ❚❚"],["2","2×","▶▶"],["4","4×","▶▶▶"]]` | add `["3","3×","▶▶▸"]` and gate it on an earned key (e.g. `speed3`, granted by a milestone through `RIB_MONETIZE.grant`) | the ladder's middle rung needs a button that does not exist; v147 D's camera needs a `v147Dcheck` row at 3× |
| H3 | `src/07-career-app.js` · `function hl(){` — `Z={idx:-1,speed:Z&&Z.speed\|\|(ut("fastSim")?2:1)` | clamp: `speed:(s=>window.RIB_MONETIZE&&!RIB_MONETIZE.speedAllowed(s)?2:s)(Z&&Z.speed\|\|(ut("fastSim")?2:1))` | the tick already corrects it within a second; this makes it exact |
| H4 | `src/07-career-app.js` · `ms()` — `o.pp+=r,e._vaultPayV137=r+(e._ppBankV136\|\|0)` | `const x=window.RIB_MONETIZE?RIB_MONETIZE.claimPayoutBoost(r,"gameover"):0;` then `o.pp+=r+x` and `_vaultPayV137=r+x+…` | inline, the vault's payout presentation and the card show the doubled figure at once; the external chip adds after the settle |
| H5 | `src/07-career-app.js` · `no()` — `e._ppBankV136=flushBankV136(),o.pp+=n,` | the same with `claimPayoutBoost(n,"win")` | as H4 |
| H6 | `src/07-career-app.js` · `function bankPPV136(n,why)` | **none — deliberately.** Season PP is not boosted | keeps the boost to one visible, capped moment |
| H7 | `src/06-phaser-launcher.js` · `var SAVE='gridiron_save_v1'` | slot-aware keys (`gridiron_save_v1`, `…_slot2`…) up to `1 + RIB_MONETIZE.value("saveSlots")`, and a slot picker | Pro's "extra save slots" needs the storage layer to know about slots |
| H8 | `src/07-career-app.js` · `window.camModeSet112=` / `window.wxModeSet144=` / the v15.3 Team Creator | show NEW cosmetic entries only when `RIB_MONETIZE.has("cos_…")` | the existing modes stay free; only added content is gated |
| H9 | `public/rib-menu.js` · the tile list (`data-rib-action="…"`) | a STORE tile (`data-rib-action="store"` → `RIB_MONETIZE.openStore()`), hidden while `!RIB_MONETIZE.enabled`; bump `RIB_MENU_VERSION` | the menu is baked; the topbar chip covers career screens today |
| H10 | `src/07-career-app.js` · `function Fi(){` (Settings) | a "Store & Purchases" row: RESTORE PURCHASES, the entitlement list | Apple wants restore reachable; the store has it already |
| H11 | Capacitor `App.addListener('backButton', …)` | close `.mz149-veil` first | Android back should dismiss the store / ad / checkout sheet |

---

## 9. How to turn it on

- **Try it (dev):** `npm run dev`, open `http://localhost:5173/?monetize=1` (add `&monetizeAdMs=1500` for short
  mock ads). Or `localStorage["rib.monetize.dev.v149"]="1"`. The flag is honoured **only** on `localhost`,
  `127.0.0.1`, `[::1]`, `0.0.0.0` or `file:` — a shipped build ignores it. `?monetize=0` forces it off.
  `RIB_MONETIZE.dev.reset()` clears the entitlement and mock stores; `dev.advance(ms)` moves its clock.
- **Ship it:** set `var MONETIZE_ENABLED = true;` in `src/27-monetize.js`, **or** leave the file alone and
  inject `window.RIB_MONETIZE_CONFIG = { enabled: true, provider: "admob+revenuecat", native: {…} }` from a
  script that runs before it (a store build's own config file — better, because the web build stays off).
- **Turn a feature off without code:** any `features.*` flag in the injected config.
- **Verify:** `node scripts/v149Echeck.mjs` (OFF proof + the ON flows); then with the switch OFF,
  `bootviewcheck`, `walk`, `menu-integration-check`, `layoutcheck`, `honorcheck`, `vaultcheck`. The existing
  checks drive the live game at its fastest button (4×): run them with the switch OFF, or on a Pro / grandfathered
  device.

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
