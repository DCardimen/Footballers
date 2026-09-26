/* ===== v149 E THE STORE IS WIRED, AND SWITCHED OFF =====
 * window.RIB_MONETIZE — the monetization foundation, provider-agnostic, and OFF.
 *
 * docs/MONETIZATION.md is the model, the catalogue, the policy notes and the hook list. The short version:
 *
 *   - ONE master switch, MONETIZE_ENABLED, default FALSE. While it is false this file defines the API object
 *     and does NOTHING else: no wrapper, no DOM, no style, no timer, no listener, no observer, no storage
 *     write. has() is false, speedAllowed() is true for every speed, the offers resolve {rewarded:false}.
 *     scripts/v149Echeck.mjs proves it against a boot with this file blocked.
 *   - Entitlements live OUTSIDE the game save (their own localStorage key, versioned, with an integrity tag).
 *     A new career, a hard reset or an imported save never grants or loses a purchase. The tag stops a casual
 *     edit, NOT a determined user: this is a client-only game, so real verification is a receipt checked by a
 *     server (the `verify` stubs below) and the store's own records (restore()).
 *   - Providers are adapters: `mock` (dev/tests — a countdown ad and a confirm dialog, nothing charged),
 *     `none`, and documented stubs for AdMob (Capacitor), RevenueCat / Play Billing / StoreKit (Capacitor),
 *     and the web (a Stripe Payment Link + a verification endpoint — never granted on the redirect alone).
 *   - What is NEVER sold: gear or gear rolls, wheel spins, re-rolls, Prestige Points, prestige-tree power, stat
 *     boosts, or any setting that is free today (My plays only, skip opponent drives, fast sim). See the doc.
 *
 * v150 C THE HOOKS ARE IN, THE SWITCH IS STILL OFF: the game now calls INTO this module at the places the doc's §8
 * listed (H1–H11 — src/07-career-app.js `v150 C` banner, public/rib-menu.js, src/26-platform.js). Each of those
 * hooks asks `RIB_MONETIZE.enabled` first, so OFF they are the identity. With the hooks in, this file no longer
 * wraps window.setSpeed (H1/H3 are in the game); the only wrapper left is window.buy (analytics, no hook exists).
 *
 * Turning it on: set MONETIZE_ENABLED below (or `window.RIB_MONETIZE_CONFIG = {enabled:true, …}` in a script
 * that runs before this one — a store build can inject it). On a DEV host only (localhost / 127.0.0.1 / file:)
 * `?monetize=1` or localStorage `rib.monetize.dev.v149 = "1"` turns it on for testing; `?monetize=0` forces off.
 */
/* ===== v151 A THE FREE GAME IS THE GAME, AND THE STORE IS A LADDER =====
 * The owner's hybrid model (docs/MONETIZATION.md §1). The PROGRESSION GATES live in the game, not here, and apply
 * whatever this switch says (src/07-career-app.js `v151 A THE GATES ARE EARNED ON THE FIELD`): My Plays Only after the
 * first finished career, 3× after a full UFF season and 4× for winning the UFF title (v156 C), season skips a day from lifetime
 * PP. What THIS file adds, and only while ON:
 *   REWARDED  opt-in only, `rewarded.dailyCap` a day (TU "adsPerDayV151A", 4, never above 5), each one a CONVENIENCE:
 *             4× for 20 min, +1 season skip today, try a locked cosmetic for 24h. The PP double is GONE (it sold
 *             prestige); `claimPayoutBoost` stays in the API and always answers 0.
 *   TIERS     No Ads $3.99 ⊂ Pro Career $8.99 ⊂ Founder $14.99 — one key each, the rest IMPLIED (`IMPLIES`), so a
 *             restore of one product id brings back the whole chain. Upgrade products carry the price difference.
 *             While ON, 4× is Pro's (speed4) — the game asks `has("speed4")`; the ad lends it for 20 minutes.
 *   PASS      `rib.pass.<seasonId>` $9.99 → `pass:<seasonId>` → RIB_SEASONS.grantPremium(seasonId).
 *   COSMETICS `rib.cos.<packId>` → `pack:<id>` + `cos:<item>` each → RIB_COSMETICS.grant(item, "shop");
 *             `unlock_all_team_style` $2.99 → `cos:team_style_all` (the Team Creator's logos and colours).
 *   EXPANSIONS listed "COMING SOON", never purchasable; `exp:<id>` and `expansionUnlocked(id)` wait for them.
 *   GUARD     `validateProduct` refuses any product (and grant() any key) outside `ALLOW_KEYS` / `ALLOW_PREFIX`:
 *             nothing that touches PP, prestige, stats, rolls, gear or wheels can be put on sale by config.
 * OFF is still a complete no-op (v149Echeck); every new API answer is inert while OFF (v151Acheck).
 */
(function () {
  "use strict";

  var MONETIZE_ENABLED = false;   // THE master switch. Nothing changes for a player until this is true.

  // ---- the configuration: per-feature flags and prices. Prices are DISPLAY strings for the web/mock path;
  // on iOS / Android the store's own localized price replaces them (a provider fills product.price at init).
  var BASE = {
    enabled: MONETIZE_ENABLED,
    provider: "mock",                    // "mock" | "none" | "admob+revenuecat" | "web"  (see PROVIDERS)
    features: {
      store: true,                       // the Store screen and its topbar chip
      rewardedSpeed: true,               // "▶ 4× for 20 min"
      rewardedSim: true,                 // "▶ +1 season skip today"
      rewardedTrial: true,               // "▶ try a locked cosmetic for 24h"
      pro: true,                         // the three permanent tiers (No Ads / Pro Career / Founder)
      upgrades: true,                    // the upgrade products (the difference in price) for a lower-tier owner
      pass: true,                        // the Season Career Pass (needs window.RIB_SEASONS)
      cosmetics: true,                   // the cosmetic packs (need window.RIB_COSMETICS)
      expansions: true,                  // the expansions list — COMING SOON, never purchasable
      gateSpeed4: true,                  // 4× needs speed4 (member / Pro / Founder / the 20-min ad / grandfathered) — or the UFF title (v156 C, earned ON or OFF)
      speed3: true,                      // v150 C H2 (v151 A: the game shows 3× whatever this says; it is EARNED, never sold)
      gateFilters: true,                 // v151 A: the advanced filters on Stats / Leaders / Hall of Fame need `filters` (Pro)
      grandfatherSpeed4: true,           // a device that already had a save when monetization first came on keeps 4× free
      payoutBoost: false,                // v151 A: the career-payout double is retired (it sold prestige). Leave false.
      membership: false                  // a monthly membership is listed only when this is true (and a server exists)
    },
    rewarded: {
      speed4Minutes: 20,                 // what one speed ad buys (TU "speed4AdMinV151A")
      dailyCap: 4,                       // rewarded ads a local day, all placements (TU "adsPerDayV151A"; clamped 0..5)
      trialHours: 24                     // a cosmetic trial (TU "trialHoursV151A")
    },
    products: [
      { id: "rib.noads", kind: "nonconsumable", tier: "noAds", title: "Ad Free", price: "$3.99",
        grants: { noAds: {} },
        blurb: ["No ads — every rewarded convenience is yours without watching one", "Supports the developer"] },
      { id: "rib.pro", kind: "nonconsumable", tier: "pro", title: "Pro Career", price: "$8.99",
        grants: { pro: {}, saveSlots: { value: 3 } },
        blurb: ["Everything in Ad Free", "4× play speed, permanently", "Advanced sim — +3 season skips a day on top of your prestige's", "Advanced filters — sort and filter Stats, Leaders and the Hall of Fame", "3 extra save slots (when slots ship)"] },
      { id: "rib.founder", kind: "nonconsumable", tier: "founder", title: "Founder", price: "$14.99",
        grants: { founder: {}, saveSlots: { value: 3 } },
        blurb: ["Everything in Pro Career", "The Founder cosmetic bundle — never sold on its own", "Bonus customization slots", "Your name on the founders' wall of the game's thanks"] },
      // upgrades: the stores have no true upgrade pricing for one-time products, so an owner of the lower tier is
      // offered a SEPARATE product priced at the difference that grants the higher tier key (docs §3).
      { id: "rib.upgrade.noads_pro", kind: "nonconsumable", upgradeFrom: "noAds", tier: "pro", title: "Pro Career (upgrade)", price: "$5.00",
        grants: { pro: {}, saveSlots: { value: 3 } } },
      { id: "rib.upgrade.pro_founder", kind: "nonconsumable", upgradeFrom: "pro", tier: "founder", title: "Founder (upgrade)", price: "$6.00",
        grants: { founder: {}, saveSlots: { value: 3 } } },
      { id: "rib.upgrade.noads_founder", kind: "nonconsumable", upgradeFrom: "noAds", tier: "founder", title: "Founder (upgrade)", price: "$11.00",
        grants: { founder: {}, saveSlots: { value: 3 } } },
      // v151 A (owner rule 6): the Team Creator's logos and colours — 5 free, then PP (the cosmetics worker), or all of them here
      { id: "unlock_all_team_style", kind: "nonconsumable", title: "Unlock all team logos & colors", price: "$2.99", teamStyle: true,
        grants: { "cos:team_style_all": {} }, blurb: ["Every logo and every colour in the Team Creator", "Cosmetic only — changes nothing on the field"] },
      { id: "rib.member.monthly", kind: "subscription", title: "Running It Back Club", price: "$1.99 / month", membership: true,
        grants: { member: { periodDays: 31 } },
        blurb: ["Everything in Ad Free and 4× while subscribed", "Cloud save + seasonal cosmetics (needs a server)"] }
    ],
    pass: { price: "$9.99", prefix: "rib.pass." },
    // the price of a cosmetic pack by its category when RIB_COSMETICS does not name one
    packPrices: { uniform: "$1.99", helmet: "$1.99", celebration: "$2.99", stadium: "$2.99", frame: "$1.99", vault: "$2.99", historical: "$4.99" },
    packPrefix: "rib.cos.",
    // listed, never sold: there is no content yet. `exp:<id>` is the key the day one ships.
    expansions: [
      { id: "frontoffice", name: "Fantasy Front Office", price: "$4.99", blurb: "Run a fantasy roster against your league" },
      { id: "coach", name: "Coach Mode", price: "$4.99", blurb: "Call the plays from the sideline" },
      { id: "gm", name: "GM Mode", price: "$4.99", blurb: "Draft, sign and build a franchise" },
      { id: "eras", name: "Historic Eras", price: "$2.99", blurb: "Play a career in another decade's game" },
      { id: "dynasty", name: "College Dynasty", price: "$4.99", blurb: "Build a program, recruit a class" },
      { id: "universe", name: "Football Universe Pack", price: "$14.99", blurb: "Every expansion above", bundle: ["frontoffice", "coach", "gm", "eras", "dynasty"] }
    ],
    // a rewarded placement names the reward it pays — a CONVENIENCE, never power. The reward is granted ONLY after the
    // provider says the ad was watched to the end (rewarded:true) — never on an early close. An Ad Free owner claims it
    // without the ad (still inside the daily cap).
    placements: {
      speed4: { feature: "rewardedSpeed", reward: { key: "speed4", minutes: "speed4Minutes" }, label: "4× for 20 min" },
      simExtra: { feature: "rewardedSim", reward: { key: "simExtra", uses: 1, endOfDay: true }, label: "one more full-season sim today" },
      cosTrial: { feature: "rewardedTrial", reward: { key: "try:*", hours: "trialHours" }, label: "try a cosmetic for 24 hours" }
    },
    mock: { adMs: 5000 },
    // web path (a PWA / GitHub Pages build). A Stripe Payment Link TAKES money; only `verifyUrl` (POST {sessionId} →
    // {ok, productIds}) can PROVE it. The redirect back (`?session_id=`) grants nothing by itself.
    web: { paymentLinks: { "rib.noads": "", "rib.pro": "", "rib.founder": "" }, verifyUrl: "" },
    // native path. Keys are public SDK keys, not secrets; fill them in the store build's injected config.
    native: { revenuecatApiKey: { ios: "", android: "" }, admobRewardedId: { ios: "", android: "" },
      entitlementMap: { noads: "rib.noads", pro: "rib.pro", founder: "rib.founder" } }
  };

  // ---- the guard: what a product may grant. Convenience and cosmetics only (docs/MONETIZATION.md §2).
  var ALLOW_KEYS = ["noAds", "pro", "founder", "member", "speed3", "speed4", "simPlus", "simExtra", "filters", "customPlus", "saveSlots"];
  var ALLOW_PREFIX = ["cos:", "cos_", "pack:", "pass:", "exp:", "try:"];
  function keyAllowed(k) {
    k = String(k || "");
    if (ALLOW_KEYS.indexOf(k) >= 0) return true;
    for (var i = 0; i < ALLOW_PREFIX.length; i++) if (k.indexOf(ALLOW_PREFIX[i]) === 0) return /^[a-z0-9_.\-]+$/i.test(k.slice(ALLOW_PREFIX[i].length));
    return false;
  }
  function validateProduct(p) {
    var errs = [];
    if (!p || typeof p !== "object") return { ok: false, errors: ["not a product"] };
    if (!/^[a-z][a-z0-9_.]{2,99}$/.test(String(p.id || ""))) errs.push("id must be lowercase a-z0-9_. (App Store / Play safe): " + p.id);
    var g = p.grants || {}, keys = Object.keys(g);
    if (!keys.length) errs.push("grants nothing");
    keys.forEach(function (k) { if (!keyAllowed(k)) errs.push("grant \"" + k + "\" is not a convenience or cosmetic key — never sold") });
    if (p.consumable || p.kind === "consumable") errs.push("consumables are not sold (nothing random, nothing spent)");
    return { ok: !errs.length, errors: errs };
  }
  // one key held implies the ones under it — a restore of the top product brings back the chain
  var IMPLIES = {
    founder: ["pro", "customPlus"],
    pro: ["noAds", "speed4", "simPlus", "filters"],
    member: ["noAds", "speed4"],
    speed4: ["speed3"],
    "exp:universe": ["exp:frontoffice", "exp:coach", "exp:gm", "exp:eras", "exp:dynasty"]
  };
  var IMPLIED_BY = {};
  Object.keys(IMPLIES).forEach(function (p) { IMPLIES[p].forEach(function (c) { (IMPLIED_BY[c] = IMPLIED_BY[c] || []).push(p) }) });

  // ---- where it runs
  var HOST = (typeof location !== "undefined" && location.hostname) || "";
  var DEV_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(HOST) || (typeof location !== "undefined" && location.protocol === "file:");
  var QS = (function () { try { return new URLSearchParams(location.search) } catch (e) { return { get: function () { return null } } } })();
  function lsGet(k) { try { return localStorage.getItem(k) } catch (e) { return null } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true } catch (e) { return false } }
  function T(k, d) { try { return window.TU ? window.TU(k, d) : d } catch (e) { return d } }

  function merge(a, b) {
    if (!b || typeof b !== "object") return a;
    Object.keys(b).forEach(function (k) {
      var v = b[k];
      if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) a[k] = merge(a[k], v);
      else a[k] = v;
    });
    return a;
  }
  var CFG = merge(JSON.parse(JSON.stringify(BASE)), (typeof window !== "undefined" && window.RIB_MONETIZE_CONFIG) || null);
  if (DEV_HOST) {                                        // dev builds only: the flag cannot turn a shipped build on
    var qm = QS.get("monetize");
    if (qm === "1") CFG.enabled = true;
    else if (qm === "0") CFG.enabled = false;
    else if (lsGet("rib.monetize.dev.v149") === "1") CFG.enabled = true;
    var qa = +QS.get("monetizeAdMs"); if (qa > 0) CFG.mock.adMs = qa;
    var qp = QS.get("monetizeProvider"); if (qp) CFG.provider = qp;
  }
  var ON = !!CFG.enabled;
  // the catalogue guard runs on the configured products too: an injected power product is dropped, loudly
  var REFUSED = [];
  CFG.products = (CFG.products || []).filter(function (p) { var v = validateProduct(p); if (!v.ok) REFUSED.push({ id: p && p.id, errors: v.errors }); return v.ok });
  if (REFUSED.length && ON) try { console.warn("[RIB_MONETIZE] refused products", REFUSED) } catch (e) {}

  // ---- the dials (TU wins over the config; the config is the default)
  function dailyCap() { return Math.max(0, Math.min(5, Math.round(+T("adsPerDayV151A", CFG.rewarded.dailyCap)) || 0)) }
  function speed4Minutes() { return +T("speed4AdMinV151A", CFG.rewarded.speed4Minutes) || 20 }
  function trialHours() { return +T("trialHoursV151A", CFG.rewarded.trialHours) || 24 }

  // ---- the clock (a dev offset lets a check fast-forward a timed boost or a day without touching the page's timers)
  var devOffset = 0;
  function now() { return Date.now() + devOffset }

  // ---- entitlement storage: OUTSIDE the save. {v, e:{key:{until,uses,value,source,at}}, caps, gf, prog?, tag}
  var KEY = "rib.monetize.ents.v1", SALT = "rib-v149e|not-a-secret|";
  function fnv(s) { var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 } return ("0000000" + h.toString(16)).slice(-8) }
  // `prog` (v151 A: the earn progress) joins the body only when present, so every v149/v150 store keeps its tag
  function body(st) { var b = { v: st.v, e: st.e, caps: st.caps, gf: st.gf }; if (st.prog) b.prog = st.prog; return JSON.stringify(b) }
  function blank() { return { v: 1, e: {}, caps: { day: "", ads: 0 }, gf: null } }
  var state = null, tampered = false;
  function load() {
    if (state) return state;
    state = blank();
    var raw = lsGet(KEY); if (!raw) return state;
    try {
      var st = JSON.parse(raw);
      if (st && st.v === 1 && st.tag === fnv(SALT + body(st))) { state = { v: 1, e: st.e || {}, caps: st.caps || state.caps, gf: st.gf == null ? null : st.gf }; if (st.prog) state.prog = st.prog }
      else { tampered = true; track("ent_tamper", {}) }           // edited by hand: start clean (store restore() brings purchases back)
    } catch (e) { tampered = true }
    return state;
  }
  function save() { var st = load(); var out = { v: 1, e: st.e, caps: st.caps, gf: st.gf }; if (st.prog) out.prog = st.prog; out.tag = fnv(SALT + body(out)); lsSet(KEY, JSON.stringify(out)) }

  // ---- listeners and analytics
  var subs = [], events = [], sinks = [];
  function emit(why) { var snap = list(); subs.slice().forEach(function (cb) { try { cb(snap, why) } catch (e) { console.warn("[RIB_MONETIZE onChange]", e) } }) }
  function onChange(cb) { if (typeof cb !== "function") return function () {}; subs.push(cb); return function () { subs = subs.filter(function (x) { return x !== cb }) } }
  // analytics: a no-op unless a sink is added. Nothing leaves the device from this file — a sink is the only
  // way data could, and adding one is a privacy-label change (App Store "Data Used to Track You" / Play Data safety).
  function track(ev, props) {
    if (!ON) return;
    var rec = { ev: String(ev), props: props || {}, at: now() };
    events.push(rec); if (events.length > 60) events.shift();
    sinks.forEach(function (s) { try { s(rec.ev, rec.props) } catch (e) {} });
  }
  function addSink(fn) { if (typeof fn === "function") sinks.push(fn) }

  // ---- the entitlement API (a key is held directly, or implied by a key above it)
  function live(x) { return !!x && (x.until == null || x.until > now()) && (x.uses == null || x.uses > 0) }
  function held(key, depth) {
    if (live(load().e[key])) return true;
    if ((depth || 0) > 6) return false;
    var up = IMPLIED_BY[key]; if (!up) return false;
    for (var i = 0; i < up.length; i++) if (held(up[i], (depth || 0) + 1)) return true;
    return false;
  }
  function untilOf(key, depth) {
    var x = load().e[key], best = live(x) ? (x.until == null ? Infinity : x.until) : 0;
    if ((depth || 0) > 6) return best;
    (IMPLIED_BY[key] || []).forEach(function (p) { best = Math.max(best, untilOf(p, (depth || 0) + 1)) });
    return best;
  }
  function has(key) { if (!ON) return false; return held(key) }
  function until(key) { if (!ON) return 0; return untilOf(key) }
  function value(key) { if (!ON) return 0; var x = load().e[key]; return live(x) ? (x.value != null ? x.value : (x.uses != null ? x.uses : 1)) : 0 }
  function grant(key, o) {
    if (!ON || !key) return false;
    if (!keyAllowed(key)) { track("grant_refused", { key: String(key) }); return false }     // v151 A: never a power key
    o = o || {}; var st = load(), cur = st.e[key], t = now(), u = null;
    if (o.until != null) u = +o.until;
    else if (o.minutes != null) u = t + o.minutes * 60000;
    else if (o.periodDays != null) u = t + o.periodDays * 86400000;
    if (u != null && cur && live(cur) && cur.until != null && cur.until > t && !o.replace && o.until == null) u = cur.until + (u - t);   // a second ad EXTENDS
    if (cur && live(cur) && cur.until == null && u != null) u = null;                                                  // permanent stays permanent
    var uses = o.uses != null ? (cur && live(cur) && cur.uses != null ? cur.uses : 0) + o.uses : null;
    st.e[key] = { until: u, uses: uses, value: o.value != null ? o.value : (cur && cur.value), source: o.source || "grant", at: t };
    save(); track("ent_grant", { key: key, until: u, uses: uses, source: st.e[key].source }); emit("grant"); return true;
  }
  function revoke(key) { if (!ON) return false; var st = load(); if (!st.e[key]) return false; delete st.e[key]; save(); emit("revoke"); return true }
  function consume(key) {
    if (!ON) return false; var st = load(), x = st.e[key]; if (!live(x)) return false;
    if (x.uses != null) { x.uses--; if (x.uses <= 0) delete st.e[key] }
    save(); track("ent_consume", { key: key }); emit("consume"); return true;
  }
  function list() {
    if (!ON) return [];
    var st = load(); return Object.keys(st.e).filter(function (k) { return live(st.e[k]) }).map(function (k) { var x = st.e[k]; return { key: k, until: x.until == null ? Infinity : x.until, uses: x.uses, value: x.value, source: x.source } });
  }
  function tier() { if (!ON) return "free"; return has("founder") ? "founder" : has("pro") ? "pro" : has("noAds") ? "noAds" : "free" }
  // an ad is SHOWN only to a device without Ad Free; an Ad Free device claims the same conveniences without one
  function adsAllowed() { return ON && !has("noAds") }
  // the one question the speed row asks. Always true while OFF (every speed is free today).
  // v151 A: the game owns the progression gates (3× at the UFF, 4× Pro's while ON) — window.__V151A.speedOk combines them
  // with this module's money side; without the game (a bare page) it is the money side alone.
  function GATES() { var g = typeof window !== "undefined" && window.__V151A; return g && typeof g.speedOk === "function" ? g : null }
  function speedAllowed(s) {
    if (!ON) return true; s = +s;
    var G = GATES(); if (G) return !!G.speedOk(s);
    if (s >= 4) return !CFG.features.gateSpeed4 || has("speed4");
    return true;
  }
  // v150 C H3: a speed carried over from an earlier game (or a boost that ran out) steps down to the fastest one allowed
  function clampSpeed(s) { if (!ON || speedAllowed(s)) return s; return [3, 2, 1].filter(function (x) { return x < +s && speedAllowed(x) })[0] || 1 }
  // v151 A: the career-payout double is retired — it sold prestige. The hook stays (src/07 payoutBoostV150C) and this
  // answers 0 unless a future NON-prestige use sets features.payoutBoost (docs §8). It never pays PP.
  function claimPayoutBoost() { return 0 }

  // ---- the day: rewarded ads and full-season sims are counted per LOCAL day (the dev clock moves it)
  function today() { var d = new Date(now()); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate() }
  function endOfDay() { var d = new Date(now()); d.setHours(23, 59, 59, 999); return d.getTime() }
  function day() { var st = load(); if (st.caps.day !== today()) st.caps = { day: today(), ads: 0, sims: 0 }; return st.caps }
  function adsLeft() { var st = load(); if (st.caps.day !== today()) return dailyCap(); return Math.max(0, dailyCap() - (st.caps.ads || 0)) }
  function countAd() { day().ads++; save() }

  // ---- v151 A: season skips. The game counts them (src/07 `seasonSkipsV151A`: a day's skips come from lifetime PP); this
  // module only ADDS to them while ON: Pro's advanced sim (`simPlus` → the game's TU "skipProBonusV151A") and a rewarded
  // `simExtra` (one more today, spent by the game with consume("simExtra")).
  function simInfo() { var G = GATES(); try { return (G && G.skips && G.skips()) || { gated: false, left: Infinity } } catch (e) { return { gated: false, left: Infinity } } }

  // ---- v151 A: the contract with the parallel workers — absent at runtime means that part of the store hides
  function COS() { var c = window.RIB_COSMETICS; return c && typeof c.catalog === "function" && typeof c.packs === "function" ? c : null }
  function SEA() { var s = window.RIB_SEASONS; return s && typeof s.current === "function" ? s : null }
  function sid(x) { return String(x || "").toLowerCase().replace(/[^a-z0-9_.]/g, "_") }
  function ik(id) { return keyAllowed("cos:" + id) ? String(id) : sid(id) }   // an item's key as RIB_COSMETICS spells it
  function passProducts() {
    var S = SEA(); if (!CFG.features.pass || !S) return [];
    var c = null; try { c = S.current() } catch (e) {}
    if (!c || !c.id) return [];
    return [{ id: CFG.pass.prefix + sid(c.id), kind: "nonconsumable", title: "Season Career Pass — " + (c.name || c.id), price: CFG.pass.price, season: c.id, grants: (function () { var g = {}; g["pass:" + c.id] = {}; return g })() }];   // the key is the season's own id (RIB_SEASONS.premiumOwned reads it)
  }
  function packProducts() {
    var C = COS(); if (!CFG.features.cosmetics || !C) return [];
    var packs = [], cat = {}; try { packs = C.packs() || []; (C.catalog() || []).forEach(function (i) { cat[i.id] = i }) } catch (e) {}
    var ck = function (id) { return keyAllowed("cos:" + id) ? "cos:" + id : "cos:" + sid(id) };   // the cosmetics worker reads cos:<its own id>
    return packs.filter(function (pk) { return pk && pk.id && !pk.founder && pk.id !== "founder" && pk.price !== null }).map(function (pk) {   // the Founder bundle is never sold alone
      var g = {}; g["pack:" + sid(pk.id)] = {}; g[ck(pk.id)] = {};
      (pk.items || []).forEach(function (it) { g[ck(it)] = {} });
      var c = pk.cat || ((cat[(pk.items || [])[0]] || {}).cat) || "";
      return { id: pk.productId && /^[a-z][a-z0-9_.]{2,99}$/.test(pk.productId) ? pk.productId : CFG.packPrefix + sid(pk.id), kind: "nonconsumable", title: pk.name || pk.id, price: pk.price || CFG.packPrices[c] || "$1.99", pack: pk.id, cat: c, items: (pk.items || []).slice(), cosmetic: true, grants: g };
    }).filter(function (p) { return validateProduct(p).ok });
  }
  function allProducts() { return CFG.products.concat(passProducts(), packProducts()) }
  function product(id) { return allProducts().filter(function (p) { return p.id === id })[0] || null }
  function productOn(p) {
    if (!p) return false;
    if (p.membership) return !!CFG.features.membership;
    if (p.cosmetic) return !!CFG.features.cosmetics;
    if (p.season) return !!CFG.features.pass;
    if (p.upgradeFrom) return !!(CFG.features.pro && CFG.features.upgrades);
    return !!CFG.features.pro;
  }
  function founderItems() { var C = COS(); if (!C) return []; try { return (C.catalog() || []).filter(function (i) { return i && i.source === "founder" }).map(function (i) { return i.id }) } catch (e) { return [] } }
  function cosGrant(id, source) { var C = COS(); if (C && typeof C.grant === "function") try { C.grant(id, source) } catch (e) { console.warn("[RIB_MONETIZE] RIB_COSMETICS.grant", e) } }
  // a product's grants, and the contract side effects (the cosmetics worker's items, the seasons worker's premium track)
  function grantProduct(p, source) {
    Object.keys(p.grants || {}).forEach(function (k) { var g = p.grants[k]; grant(k, { value: g.value, periodDays: g.periodDays, source: source + ":" + p.id }) });
    (p.items || []).forEach(function (it) { cosGrant(it, "shop") });
    if (p.season) { var S = SEA(); if (S && typeof S.grantPremium === "function") try { S.grantPremium(p.season) } catch (e) { console.warn("[RIB_MONETIZE] RIB_SEASONS.grantPremium", e) } }
    if (p.tier === "founder") founderItems().forEach(function (it) { grant("cos:" + ik(it), { source: source + ":" + p.id }); cosGrant(it, "founder") });
  }
  // restore() may name a product this device cannot see right now (last season's pass, a pack no longer listed)
  function grantOwnedId(id, source) {
    var p = product(id); if (p) { grantProduct(p, source); return true }
    var m = /^rib\.pass\.([a-z0-9_.]+)$/.exec(id); if (m) { grant("pass:" + m[1], { source: source + ":" + id }); return true }
    m = /^rib\.cos\.([a-z0-9_.]+)$/.exec(id); if (m) { grant("pack:" + m[1], { source: source + ":" + id }); return true }
    return false;
  }
  function owns(id) {
    var p = product(id); if (!p) return false;
    if (p.tier) return has(p.tier);
    return Object.keys(p.grants || {}).every(function (k) { return has(k) });
  }
  function cosmeticAccess(id) {
    if (!ON) return "off";
    var k = ik(id);
    if (has("cos:" + k)) return "owned";
    var t = until("try:" + k); return t ? "trial" : null;
  }
  function expansions() {
    return (CFG.expansions || []).map(function (x) { return { id: x.id, name: x.name, price: x.price, blurb: x.blurb, bundle: x.bundle || null, productId: "rib.exp." + x.id, key: "exp:" + x.id, status: "soon", owned: ON ? has("exp:" + x.id) : false } });
  }
  // when an expansion ships, its screens ask this. OFF (the web build) nothing is gated, so it answers true.
  function expansionUnlocked(id) { if (!ON) return true; return has("exp:" + id) }

  // =====================================================================================================
  // PROVIDERS. An adapter is { name, available(), init(api), showRewarded(placement) → Promise<{rewarded}>,
  // purchase(product) → Promise<{ok, receipt?, reason?}>, restore() → Promise<{ok, owned:[productId]}> }.
  // The module grants; the adapter only reports what the platform said.
  // =====================================================================================================
  var PROVIDERS = {};
  function registerProvider(name, adapter) { PROVIDERS[name] = adapter; return adapter }
  function provider() { return PROVIDERS[CFG.provider] || PROVIDERS.none }

  registerProvider("none", {
    name: "none", available: function () { return true }, init: function () {},
    showRewarded: function () { return Promise.resolve({ rewarded: false, reason: "no-provider" }) },
    purchase: function () { return Promise.resolve({ ok: false, reason: "no-provider" }) },
    restore: function () { return Promise.resolve({ ok: true, owned: [] }) }
  });

  // mock: for dev and the checks. A countdown "ad" you can close early (no reward), a checkout dialog that
  // charges nothing, and its own record of "purchases" (standing in for the store's server) so restore() works.
  var MOCK_KEY = "rib.monetize.mock.v1";
  registerProvider("mock", {
    name: "mock", available: function () { return true }, init: function () {},
    showRewarded: function (placement) { return mockAd(placement) },
    purchase: function (p) {
      return mockCheckout(p).then(function (ok) {
        if (!ok) return { ok: false, reason: "cancelled" };
        var owned = mockOwned(); if (owned.indexOf(p.id) < 0) owned.push(p.id); lsSet(MOCK_KEY, JSON.stringify(owned));
        return { ok: true, receipt: { provider: "mock", productId: p.id, at: now() } };
      });
    },
    restore: function () { return Promise.resolve({ ok: true, owned: mockOwned() }) }
  });
  function mockOwned() { try { return JSON.parse(lsGet(MOCK_KEY) || "[]") || [] } catch (e) { return [] } }

  // AdMob via Capacitor (@capacitor-community/admob). Stub: runs only inside a native build with the plugin.
  //   await AdMob.initialize(); consent first: AdMob.requestConsentInfo() / showConsentForm() (UMP, EU/UK),
  //   and on iOS AdMob.trackingAuthorizationStatus() → requestTrackingAuthorization() only if personalised ads are used.
  //   One Rewarded ad unit serves all three placements (speed4 / simExtra / cosTrial); the placement is analytics only.
  registerProvider("admob", {
    name: "admob",
    available: function () { return !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob) },
    init: function () { var A = this.available() && window.Capacitor.Plugins.AdMob; return A ? A.initialize({}) : null },
    showRewarded: function () {
      if (!this.available()) return Promise.resolve({ rewarded: false, reason: "admob-not-installed" });
      var A = window.Capacitor.Plugins.AdMob, plat = (window.Capacitor.getPlatform && window.Capacitor.getPlatform()) || "android";
      return new Promise(function (res) {
        var got = false, hs = [];
        function done(r) { hs.forEach(function (h) { try { h && h.remove && h.remove() } catch (e) {} }); res(r) }
        Promise.resolve(A.addListener("onRewardedVideoAdReward", function () { got = true })).then(function (h) { hs.push(h) });
        Promise.resolve(A.addListener("onRewardedVideoAdDismissed", function () { done({ rewarded: got }) })).then(function (h) { hs.push(h) });
        A.prepareRewardVideoAd({ adId: CFG.native.admobRewardedId[plat] }).then(function () { return A.showRewardVideoAd() })
          .catch(function (e) { done({ rewarded: false, reason: String(e && e.message || e) }) });
      });
    },
    purchase: function () { return Promise.resolve({ ok: false, reason: "admob-sells-nothing" }) },
    restore: function () { return Promise.resolve({ ok: true, owned: [] }) }
  });

  // RevenueCat (@revenuecat/purchases-capacitor) — one API over StoreKit 2 (iOS) and Play Billing (Android),
  // with its own receipt validation server. Stub: runs only inside a native build with the plugin.
  //   Products to create in App Store Connect / Play Console (all NON-CONSUMABLE): rib.noads, rib.pro, rib.founder,
  //   rib.upgrade.noads_pro, rib.upgrade.pro_founder, rib.upgrade.noads_founder, rib.pass.<seasonId> (a new one each
  //   season), rib.cos.<packId> (one per pack). RevenueCat entitlements noads / pro / founder (entitlementMap).
  //   restore() reports the NON-subscription transactions' product ids too, so passes and packs come back.
  registerProvider("revenuecat", {
    name: "revenuecat",
    available: function () { return !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Purchases) },
    init: function () { if (!this.available()) return null; var P = window.Capacitor.Plugins.Purchases, plat = (window.Capacitor.getPlatform && window.Capacitor.getPlatform()) || "android"; return P.configure({ apiKey: CFG.native.revenuecatApiKey[plat] }) },
    showRewarded: function () { return Promise.resolve({ rewarded: false, reason: "revenuecat-shows-no-ads" }) },
    purchase: function (p) {
      if (!this.available()) return Promise.resolve({ ok: false, reason: "revenuecat-not-installed" });
      var P = window.Capacitor.Plugins.Purchases;
      return P.getProducts({ productIdentifiers: [p.id] }).then(function (r) {
        var sp = r && (r.products || [])[0];
        if (!sp) return { ok: false, reason: "not-in-store" };
        return P.purchaseStoreProduct({ product: sp }).then(function (x) { return { ok: true, receipt: { provider: "revenuecat", productId: p.id, customerInfo: x && x.customerInfo } } });
      }).catch(function (e) { return { ok: false, reason: (e && e.userCancelled) ? "cancelled" : String(e && e.message || e) } });
    },
    restore: function () {
      if (!this.available()) return Promise.resolve({ ok: false, owned: [], reason: "revenuecat-not-installed" });
      return window.Capacitor.Plugins.Purchases.restorePurchases().then(function (r) {
        var ci = (r && r.customerInfo) || {}, act = (ci.entitlements && ci.entitlements.active) || {};
        var ids = Object.keys(act).map(function (k) { return CFG.native.entitlementMap[k] || k });
        (ci.nonSubscriptionTransactions || []).forEach(function (t) { var id = t.productIdentifier || t.productId; if (id && ids.indexOf(id) < 0) ids.push(id) });
        return { ok: true, owned: ids };
      });
    }
  });
  // the pair a store build uses: AdMob shows the ads, RevenueCat sells.
  registerProvider("admob+revenuecat", {
    name: "admob+revenuecat", available: function () { return PROVIDERS.admob.available() || PROVIDERS.revenuecat.available() },
    init: function () { PROVIDERS.admob.init(); PROVIDERS.revenuecat.init() },
    showRewarded: function (pl) { return PROVIDERS.admob.showRewarded(pl) },
    purchase: function (p) { return PROVIDERS.revenuecat.purchase(p) },
    restore: function () { return PROVIDERS.revenuecat.restore() }
  });

  // web: a Stripe Payment Link opens in a new tab and takes the money; NOTHING is granted here until the server
  // proves it. The link's success URL returns with ?session_id=…; verifyWeb() POSTs {sessionId} to CFG.web.verifyUrl
  // and grants only the productIds that endpoint returns ({ok:true, productIds:[…]}, read server-side off the Checkout
  // Session with the secret key). No verifyUrl → never grants. Must not ship inside an iOS app (Apple 3.1.1).
  registerProvider("web", {
    name: "web", available: function () { return true }, init: function () {},
    showRewarded: function () { return Promise.resolve({ rewarded: false, reason: "no-web-ads" }) },
    purchase: function (p) {
      var link = CFG.web.paymentLinks[p.id];
      if (!link) return Promise.resolve({ ok: false, reason: "no-payment-link" });
      try { window.open(link, "_blank", "noopener") } catch (e) {}
      return Promise.resolve({ ok: false, pending: true, reason: "awaiting-verification" });
    },
    restore: function () {
      if (!CFG.web.verifyUrl) return Promise.resolve({ ok: false, owned: [], reason: "no-verify-endpoint" });
      return fetch(CFG.web.verifyUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ restore: true }) })
        .then(function (r) { return r.json() }).then(function (j) { return { ok: !!j.ok, owned: j.productIds || [] } })
        .catch(function (e) { return { ok: false, owned: [], reason: String(e) } });
    }
  });
  function verifyWeb(sessionId) {
    if (!ON) return Promise.resolve({ ok: false, reason: "disabled" });
    if (!sessionId) return Promise.resolve({ ok: false, reason: "no-session" });
    if (!CFG.web.verifyUrl) return Promise.resolve({ ok: false, reason: "no-verify-endpoint" });   // the redirect alone grants NOTHING
    return fetch(CFG.web.verifyUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: sessionId }) })
      .then(function (r) { return r.ok ? r.json() : { ok: false } })
      .then(function (j) { var got = []; if (j && j.ok) (j.productIds || []).forEach(function (id) { if (grantOwnedId(id, "web")) got.push(id) }); track("web_verify", { n: got.length }); return { ok: !!(j && j.ok), granted: got } })
      .catch(function (e) { return { ok: false, reason: String(e) } });
  }

  // ---- the flows
  var busy = false;
  function placementOn(pl) { return !!pl && (!pl.feature || !!CFG.features[pl.feature]) }
  function showRewarded(placement, opts) {
    if (!ON) return Promise.resolve({ rewarded: false, reason: "disabled" });
    var pl = CFG.placements[placement];
    if (!pl) return Promise.resolve({ rewarded: false, reason: "unknown-placement" });
    if (!placementOn(pl)) return Promise.resolve({ rewarded: false, reason: "feature-off" });
    opts = opts || {};
    var rw = pl.reward, key = rw.key === "try:*" ? (opts.item ? "try:" + ik(opts.item) : "") : rw.key;
    if (!key) return Promise.resolve({ rewarded: false, reason: "no-item" });
    if (!keyAllowed(key)) return Promise.resolve({ rewarded: false, reason: "not-allowed" });
    if (until(key) === Infinity || (key.indexOf("try:") === 0 && has("cos:" + key.slice(4)))) return Promise.resolve({ rewarded: false, reason: "already-held" });
    if (adsLeft() <= 0) return Promise.resolve({ rewarded: false, reason: "daily-cap" });
    if (busy) return Promise.resolve({ rewarded: false, reason: "busy" });
    var adFree = has("noAds");
    busy = true; track("ad_offer_accepted", { placement: placement, adFree: adFree });
    return (adFree ? Promise.resolve({ rewarded: true }) : provider().showRewarded(placement)).then(function (r) {
      busy = false; r = r || {};
      if (!r.rewarded) { track("ad_not_rewarded", { placement: placement, reason: r.reason || "closed" }); return { rewarded: false, reason: r.reason || "closed" } }
      countAd();
      var mins = rw.minutes != null ? (rw.minutes === "speed4Minutes" ? speed4Minutes() : +rw.minutes) : rw.hours != null ? (rw.hours === "trialHours" ? trialHours() : +rw.hours) * 60 : null;
      grant(key, { minutes: mins, uses: rw.uses, until: rw.endOfDay ? endOfDay() : null, source: (adFree ? "adfree:" : "ad:") + placement });
      track("ad_rewarded", { placement: placement, adFree: adFree });
      return { rewarded: true, adFree: adFree, reward: { key: key, minutes: mins || null, uses: rw.uses || null } };
    }, function (e) { busy = false; return { rewarded: false, reason: String(e && e.message || e) } });
  }
  function purchase(productId) {
    if (!ON) return Promise.resolve({ ok: false, reason: "disabled" });
    if (/^pass:/.test(String(productId))) productId = CFG.pass.prefix + sid(String(productId).slice(5));   // RIB_SEASONS.buyPremium's spelling
    if (/^rib\.exp\./.test(String(productId))) return Promise.resolve({ ok: false, productId: productId, reason: "coming-soon" });   // never sold before it exists
    var p = product(productId);
    if (!p || !productOn(p)) return Promise.resolve({ ok: false, reason: "unknown-product" });
    var v = validateProduct(p); if (!v.ok) return Promise.resolve({ ok: false, productId: p.id, reason: "refused", errors: v.errors });
    if (p.kind === "nonconsumable" && owns(p.id)) return Promise.resolve({ ok: true, already: true });
    if (p.upgradeFrom && !has(p.upgradeFrom)) return Promise.resolve({ ok: false, productId: p.id, reason: "needs-" + p.upgradeFrom });
    track("purchase_start", { productId: p.id });
    return provider().purchase(p).then(function (r) {
      r = r || {};
      if (r.ok) { grantProduct(p, "buy"); track("purchase_ok", { productId: p.id }) } else track("purchase_fail", { productId: p.id, reason: r.reason || "" });
      return { ok: !!r.ok, productId: p.id, reason: r.reason, pending: !!r.pending };
    }, function (e) { return { ok: false, productId: p.id, reason: String(e && e.message || e) } });
  }
  function restore() {
    if (!ON) return Promise.resolve({ ok: false, reason: "disabled", restored: [] });
    track("restore_start", {});
    return provider().restore().then(function (r) {
      r = r || {}; var got = [];
      (r.owned || []).forEach(function (id) { if (grantOwnedId(id, "restore")) got.push(id) });
      track("restore_done", { n: got.length }); return { ok: !!r.ok, restored: got, reason: r.reason };
    });
  }
  function catalog() {
    return {
      tiers: CFG.products.filter(function (p) { return p.tier && !p.upgradeFrom }).map(function (p) { return { id: p.id, tier: p.tier, title: p.title, price: p.price } }),
      upgrades: CFG.products.filter(function (p) { return p.upgradeFrom }).map(function (p) { return { id: p.id, from: p.upgradeFrom, to: p.tier, price: p.price } }),
      pass: ON ? passProducts().map(function (p) { return { id: p.id, season: p.season, price: p.price } }) : [],
      packs: ON ? packProducts().map(function (p) { return { id: p.id, pack: p.pack, cat: p.cat, price: p.price, items: p.items } }) : [],
      expansions: expansions(), refused: REFUSED.slice()
    };
  }

  // =====================================================================================================
  // THE API. Everything above is reachable through it; nothing else is global.
  // =====================================================================================================
  var ui = { tick: function () {}, store: function () {}, locked: function () {}, back: function () { return false }, restoreUI: function () {}, simLocked: function () {}, toast: function () {} };
  var API = {
    version: "v151A",
    get enabled() { return ON },
    config: CFG,
    has: has, until: until, value: value, grant: grant, revoke: revoke, consume: consume, list: list, onChange: onChange, tier: tier,
    speedAllowed: speedAllowed, clampSpeed: clampSpeed, adsAllowed: adsAllowed, adsLeft: function () { return ON ? adsLeft() : 0 },
    // v150 C: what the game's hooks call. Each one is inert while OFF (the game never calls them then anyway).
    speedLocked: function (s) { if (ON) ui.locked(s); return false },          // H1: a tap on a speed this device may not use
    back: function () { return ON ? ui.back() : false },                     // H11: Android back — close the top store / ad sheet
    restoreUI: function () { if (ON) ui.restoreUI() },                         // H10: Settings › RESTORE PURCHASES
    claimPayoutBoost: claimPayoutBoost,                                        // v151 A: retired — always 0
    // v151 A: the free path and the guard
    simInfo: simInfo,                                                          // the game's season skips, as the store shows them
    simLocked: function () { if (ON) ui.simLocked() },                         // the game's skip button with none left today
    filtersLocked: function () { return ON && !!CFG.features.gateFilters && !has("filters") },
    validateProduct: validateProduct, keyAllowed: keyAllowed, catalog: catalog,
    cosmeticAccess: cosmeticAccess, expansions: expansions, expansionUnlocked: expansionUnlocked,
    verifyWeb: verifyWeb,
    showRewarded: showRewarded, purchase: purchase,
    purchasePass: function (seasonId) { var P = passProducts()[0]; if (!ON || !P) return Promise.resolve({ ok: false, reason: ON ? "no-season" : "disabled" }); if (seasonId && String(seasonId) !== String(P.season)) return Promise.resolve({ ok: false, reason: "not-the-current-season" }); return purchase(P.id) }, restore: restore, owns: function (id) { return ON && owns(id) },
    track: track, addAnalyticsSink: addSink,
    registerProvider: registerProvider, providers: PROVIDERS,
    get provider() { return CFG.provider },
    openStore: function (focus) { if (ON && CFG.features.store) ui.store(true, focus) },
    closeStore: function () { if (ON) ui.store(false) },
    get tampered() { return tampered },
    hooks: {}                                   // which wrappers are installed (empty while OFF)
  };
  if (DEV_HOST) API.dev = {
    advance: function (ms) { devOffset += +ms || 0; if (ON) { emit("clock"); ui.tick() } return devOffset },
    reset: function () { devOffset = 0; state = null; try { localStorage.removeItem(KEY); localStorage.removeItem(MOCK_KEY) } catch (e) {} if (ON) { emit("reset"); ui.tick() } },
    events: events, key: KEY, mockKey: MOCK_KEY, now: now
  };
  window.RIB_MONETIZE = API;

  if (!ON) return;   // ------------------------------------------------------------------ OFF ends here: a complete no-op.

  // =====================================================================================================
  // ON: the hooks (wrappers over window.* functions that exist — nothing inside the career block is touched)
  // and the UI. docs/MONETIZATION.md lists the hooks.
  // =====================================================================================================
  API.ui = ui;
  try { provider().init && provider().init(API) } catch (e) { console.warn("[RIB_MONETIZE] provider init", e) }

  // grandfather: a device that already had a career before monetization first came on keeps 4× (a free setting
  // does not become a paid one for someone who already had it). Decided ONCE, recorded in the entitlement store.
  (function () {
    var st = load();
    if (st.gf == null) {
      // "had a career": a save with a player on the field or any career behind it (a fresh boot writes an empty save)
      var sv = null; try { sv = JSON.parse(lsGet("gridiron_save_v1") || "null") } catch (e) {}
      st.gf = !!(sv && ((sv.player && sv.player.pos) || sv.careers > 0 || sv.careersCompleted > 0 || sv.pp > 0 || sv.bestLevel > 0));
      save();
      if (st.gf && CFG.features.grandfatherSpeed4 && CFG.features.gateSpeed4) grant("speed4", { source: "grandfather" });
    }
  })();

  function gameState() { try { return window.__GRIDIRON_AUDIT__ && window.__GRIDIRON_AUDIT__.getState() } catch (e) { return null } }
  function fmtLeft(ms) { if (ms === Infinity) return "∞"; var s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60); return m + ":" + ("0" + (s % 60)).slice(-2) }
  function toast(msg) { var t = document.createElement("div"); t.className = "mz149-toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove() }, 2600) }
  ui.toast = toast;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] }) }

  // ---- hook 1: the speed setter. v150 C: the game's setSpeed() asks speedAllowed() itself (H1) and hands a locked tap
  // to speedLocked(); startLivePlayback() clamps a carried-over speed (H3). Nothing is wrapped here any more.
  var GAME = window.__V150C || null;                                   // the game's side of the hooks (src/07 v150 C)
  function setSpeed(s) { try { typeof window.setSpeed === "function" && window.setSpeed(s) } catch (e) {} }
  ui.locked = function (s) { track("speed_locked_tap", { speed: +s }); offerSpeed(+s) };
  API.hooks.speed = GAME ? "game" : "missing";
  API.hooks.sim = window.__V151A ? "game" : "missing";
  function liveSpeed() { try { return window.__getGridironLiveSpeed ? +window.__getGridironLiveSpeed() : 1 } catch (e) { return 1 } }
  function gates() { var G = GATES(); try { return G && G.gates ? G.gates() : null } catch (e) { return null } }
  function offerSpeed(s) {
    var g = gates();
    var v156 = !!(g && g.uffTitle !== undefined);   // v156 C: the game's gates name the new rungs
    if (s && s < 4) { toast(v156 ? "3× UNLOCKS AFTER A FULL UFF SEASON" : "3× UNLOCKS WHEN YOU REACH THE UFF"); return }   // the earned rung is never sold
    if (!CFG.features.rewardedSpeed || adsLeft() <= 0) { API.openStore("pro"); return }
    var free = has("noAds");
    ui.sheet({
      title: "4× PLAY SPEED", lines: [(free ? "Ad Free: claim " : "Watch a short ad for ") + speed4Minutes() + " minutes of 4×. " + adsLeft() + " of " + dailyCap() + " left today.", (CFG.features.pro ? "Or Pro Career: 4× for good." : "") + (v156 ? " Win the UFF championship and 4× is yours for good, free." : "")],
      yes: free ? "✓ CLAIM 4×" : "▶ WATCH AN AD", no: CFG.features.pro ? "SEE PRO" : "NOT NOW",
      onYes: function () { rewardSpeed() }, onNo: function () { if (CFG.features.pro) API.openStore("pro") }
    });
  }
  function rewardSpeed() {
    return showRewarded("speed4").then(function (r) {
      if (r.rewarded) { toast("4× UNLOCKED · " + speed4Minutes() + " MIN"); if (document.querySelector(".speed-btn[data-spd]")) setSpeed(4) }
      else if (r.reason === "daily-cap") toast("That's today's rewards — back tomorrow");
      ui.tick(); return r;
    });
  }
  API.rewardSpeed = rewardSpeed;
  // v151 A: the sim cap's sheet — Quick Play is always the free way through a season
  function rewardSim() {
    return showRewarded("simExtra").then(function (r) {
      if (r.rewarded) toast("+1 SEASON SKIP TODAY"); else if (r.reason === "daily-cap") toast("That's today's rewards — back tomorrow");
      ui.tick(); return r;
    });
  }
  API.rewardSim = rewardSim;
  ui.simLocked = function () {
    var s = simInfo(), canAd = CFG.features.rewardedSim && adsLeft() > 0, free = has("noAds"), pro = has("simPlus");
    ui.sheet({
      title: s.perDay ? "TODAY'S SEASON SKIPS ARE USED" : "SEASON SKIPS COME WITH PRESTIGE",
      lines: [(s.perDay ? "Your prestige gives you " + s.perDay + " season skip" + (s.perDay === 1 ? "" : "s") + " a day." : "Season skips unlock at " + fmtN(s.firstAt) + " lifetime PP.") + (s.next && s.perDay ? " More at " + fmtN(s.next.at) + " PP (" + s.next.perDay + " a day)." : "") + " Quick Play still sims any week, one at a time — free, always.",
        canAd ? (free ? "Ad Free: claim one more skip today." : "Watch a short ad for one more skip today.") : "", CFG.features.pro && !pro ? "Pro Career: +" + (s.proBonus || 3) + " skips a day." : ""],
      yes: canAd ? (free ? "✓ +1 SKIP" : "▶ +1 SKIP") : (CFG.features.pro && !pro ? "SEE PRO" : "OK"), no: "NOT NOW",
      onYes: function () { if (canAd) rewardSim().then(function (r) { if (r.rewarded && typeof window.seasonSkipV151A === "function") window.seasonSkipV151A() }); else if (CFG.features.pro && !pro) API.openStore("pro") }
    });
  };
  function fmtN(n) { return n == null ? "—" : Number(n).toLocaleString("en-US") }
  // v151 A: a cosmetic tried for 24h (the cosmetics worker reads RIB_MONETIZE.cosmeticAccess(id) === "trial")
  function rewardTrial(id) {
    return showRewarded("cosTrial", { item: id }).then(function (r) {
      if (r.rewarded) { toast("YOURS TO TRY FOR " + trialHours() + "H"); var C = COS(); if (C && typeof C.onTrial === "function") try { C.onTrial(id, until("try:" + ik(id))) } catch (e) {} }
      else if (r.reason === "daily-cap") toast("That's today's rewards — back tomorrow");
      ui.tick(); return r;
    });
  }
  API.rewardTrial = rewardTrial;

  // ---- hook 2: the prestige purchase (window.buy = Yl, already wrapped once by the patch layer for haptics).
  // Analytics only: the tree is never for sale and nothing here changes what buy() does.
  var origBuy = window.buy;
  if (typeof origBuy === "function") {
    window.buy = function (node) { track("prestige_buy", { node: String(node) }); return origBuy.apply(this, arguments) };
    API.hooks.buy = true;
  }
  // (hook 3, the career-payout double, was retired in v151 A — it sold prestige. Nothing is drawn on gameover / win.)

  // =====================================================================================================
  // UI — only ever built while ON. The v146 E shell's look: charcoal, gold hairlines, Oswald.
  // =====================================================================================================
  var css = document.createElement("style"); css.id = "mz149css";
  css.textContent = [
    ".mz149-chip{font:600 11px/1 Oswald,sans-serif;letter-spacing:1.4px;text-transform:uppercase;color:#f0bb45;background:linear-gradient(180deg,#1a1b20,#111216);border:1px solid rgba(230,178,58,.55);border-radius:999px;padding:6px 11px;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent}",
    ".mz149-chip:active{transform:translateY(1px)}",
    ".mz149-chip.on{color:#0d0e11;background:linear-gradient(180deg,#f6cf6a,#e6b23a);border-color:#f6cf6a}",
    ".topbar .mz149-top{margin-left:auto;flex:none;padding:5px 9px;font-size:10px}",
    ".mz149-offer-row{display:flex;justify-content:center;gap:8px;margin:6px 0 2px;min-height:26px;align-items:center;flex-wrap:wrap}",
    ".mz149-offer-row small{font:500 10px Oswald,sans-serif;letter-spacing:1px;color:#8fa2bb}",
    ".speed-btn.mz149-lock{position:relative;opacity:.72}",
    ".speed-btn.mz149-lock::after{content:'▶ AD';position:absolute;top:-6px;right:-4px;font:700 8px/1 Oswald,sans-serif;letter-spacing:.8px;color:#0d0e11;background:#f0bb45;border-radius:6px;padding:2px 4px}",
    ".speed-btn.mz149-lock.pro::after{content:'PRO'}",
    ".speed-btn.mz149-lock.free::after{content:'CLAIM'}",
    ".mz149-veil{position:fixed;inset:0;z-index:2147483000;background:rgba(5,6,8,.86);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;font-family:Oswald,sans-serif;color:#e9e4d8}",
    ".mz149-card{width:100%;max-width:380px;max-height:100%;overflow:hidden;box-sizing:border-box;background:linear-gradient(180deg,#15161b,#0d0e11);border:1px solid rgba(230,178,58,.45);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.6);padding:14px 14px 12px;display:flex;flex-direction:column;gap:10px}",
    ".mz149-eyebrow{font:600 10px Oswald,sans-serif;letter-spacing:2.4px;color:#f0bb45;text-transform:uppercase}",
    ".mz149-h{font:700 22px/1.05 Oswald,sans-serif;letter-spacing:1px;text-transform:uppercase;color:#f4efe2;margin:0}",
    ".mz149-p{font:400 13px/1.35 system-ui,sans-serif;color:#b9c2cf;margin:0}",
    ".mz149-row{display:flex;gap:8px}",
    ".mz149-btn{flex:1;font:700 13px/1 Oswald,sans-serif;letter-spacing:1.6px;text-transform:uppercase;border-radius:10px;padding:11px 10px;cursor:pointer;border:1px solid rgba(230,178,58,.55);background:#121317;color:#f0bb45}",
    ".mz149-btn.gold{background:linear-gradient(180deg,#f6cf6a,#e0a92f);color:#141208;border-color:#f6cf6a}",
    ".mz149-btn:disabled{opacity:.45;cursor:default}",
    ".mz149-sec{border-top:1px solid rgba(230,178,58,.22);padding-top:9px;display:flex;flex-direction:column;gap:7px}",
    ".mz149-prod{display:flex;justify-content:space-between;align-items:baseline;gap:8px}",
    ".mz149-prod b{font:700 15px Oswald,sans-serif;letter-spacing:1px;text-transform:uppercase;color:#f4efe2}",
    ".mz149-prod i{font:700 15px Oswald,sans-serif;font-style:normal;color:#f0bb45;white-space:nowrap}",
    ".mz149-ul{margin:0;padding:0 0 0 16px;font:400 12px/1.45 system-ui,sans-serif;color:#b9c2cf}",
    ".mz149-fine{font:400 10.5px/1.35 system-ui,sans-serif;color:#7d8796}",
    ".mz149-x{position:absolute;top:10px;right:12px;background:none;border:0;color:#8fa2bb;font:700 18px Oswald,sans-serif;cursor:pointer}",
    ".mz149-ad{text-align:center;align-items:center}",
    ".mz149-ad .mz149-count{font:700 64px/1 Oswald,sans-serif;color:#f0bb45}",
    ".mz149-bar{height:4px;width:100%;background:#23252c;border-radius:2px;overflow:hidden}.mz149-bar i{display:block;height:100%;width:0;background:#f0bb45}",
    ".mz149-toast{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 96px);transform:translateX(-50%);z-index:2147483001;font:600 12px Oswald,sans-serif;letter-spacing:1.5px;color:#0d0e11;background:#f0bb45;border-radius:999px;padding:8px 14px;box-shadow:0 8px 24px rgba(0,0,0,.5);pointer-events:none;white-space:nowrap}",
    // v151 A: the store is a LADDER in a full-height panel — a fixed head and foot, and ONE inner scroller
    ".mz151-veil{padding:max(8px,env(safe-area-inset-top)) 8px max(8px,env(safe-area-inset-bottom))}",
    ".mz149-card.mz151-store{max-width:440px;height:100%;padding:0;gap:0}",
    ".mz151-head{position:relative;padding:12px 14px 10px;border-bottom:1px solid rgba(230,178,58,.22);flex:none}",
    ".mz151-body{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:4px 14px 12px;display:flex;flex-direction:column;gap:10px}",
    ".mz151-foot{flex:none;padding:9px 14px 11px;border-top:1px solid rgba(230,178,58,.22);display:flex;flex-direction:column;gap:6px}",
    ".mz151-rung{position:relative;border:1px solid rgba(230,178,58,.22);border-radius:12px;padding:10px 11px;display:flex;flex-direction:column;gap:7px;background:rgba(255,255,255,.015)}",
    ".mz151-rung.owned{border-color:rgba(87,224,122,.55)}",
    ".mz151-rung.best{border-color:rgba(246,207,106,.8);box-shadow:0 0 0 1px rgba(246,207,106,.25) inset}",
    ".mz151-step{position:absolute;top:-8px;left:10px;font:700 9px/1 Oswald,sans-serif;letter-spacing:1.6px;background:#0d0e11;color:#8fa2bb;padding:2px 6px;border-radius:6px}",
    ".mz151-ok{color:#57e07a!important}",
    ".mz151-prog{height:6px;border-radius:3px;background:#23252c;overflow:hidden}.mz151-prog i{display:block;height:100%;background:#8ec3ee}",
    ".mz151-btns{display:flex;flex-direction:column;gap:6px}",
    ".mz151-btns .mz149-btn{flex:none;font-size:12px;padding:10px 8px}",
    ".mz151-tabs{display:flex;gap:6px;flex-wrap:wrap;padding-bottom:2px}",
    ".mz151-tabs .mz149-chip{flex:none;font-size:10px;padding:5px 9px}",
    ".mz151-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}",
    ".mz151-pack{border:1px solid rgba(230,178,58,.22);border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:6px;min-width:0}",
    ".mz151-pack b{font:700 12px Oswald,sans-serif;letter-spacing:.8px;text-transform:uppercase;color:#f4efe2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".mz151-items{display:flex;gap:4px;flex-wrap:wrap}",
    ".mz151-item{position:relative;width:44px;height:44px;border-radius:8px;background:#1a1c22;overflow:hidden;display:flex;align-items:center;justify-content:center;font:600 8px Oswald,sans-serif;color:#8fa2bb;text-align:center}",
    ".mz151-item[data-own]{outline:1px solid #57e07a}",
    ".mz151-item[data-trial]{outline:1px dashed #8ec3ee}",
    ".mz151-try{position:absolute;inset:auto 0 0 0;border:0;background:rgba(13,14,17,.82);color:#8ec3ee;font:700 8px/1 Oswald,sans-serif;letter-spacing:.6px;padding:3px 0;cursor:pointer}",
    ".mz151-pack .mz149-btn{flex:none;margin-top:auto;font-size:11px;padding:8px 6px}",
    ".mz151-soon{display:flex;justify-content:space-between;gap:8px;align-items:baseline;font:400 12px/1.35 system-ui,sans-serif;color:#8fa2bb}",
    ".mz151-soon b{font:600 13px Oswald,sans-serif;letter-spacing:.8px;color:#d9d3c4;text-transform:uppercase}",
    ".mz151-soon i{font:700 10px Oswald,sans-serif;font-style:normal;letter-spacing:1.2px;color:#7d8796;white-space:nowrap}",
    ".advf-v151.locked .mz149-chip{font-size:10px}"
  ].join("\n");
  document.head.appendChild(css);

  function el(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild }
  function veil(id, inner, cls) {
    var old = document.getElementById(id); if (old) old.remove();
    var v = el('<div class="mz149-veil ' + (cls || "") + '" id="' + id + '" role="dialog" aria-modal="true"><div class="mz149-card" style="position:relative">' + inner + "</div></div>");
    document.body.appendChild(v); return v;
  }
  // a small yes/no sheet
  ui.sheet = function (o) {
    var v = veil("mz149Sheet", '<div class="mz149-eyebrow">RUNNING IT BACK</div><h2 class="mz149-h">' + o.title + "</h2>" +
      o.lines.filter(Boolean).map(function (l) { return '<p class="mz149-p">' + l + "</p>" }).join("") +
      '<div class="mz149-row"><button class="mz149-btn" data-no>' + o.no + '</button><button class="mz149-btn gold" data-yes>' + o.yes + "</button></div>");
    v.querySelector("[data-yes]").onclick = function () { v.remove(); o.onYes && o.onYes() };
    v.querySelector("[data-no]").onclick = function () { v.remove(); o.onNo && o.onNo() };
    v.onclick = function (ev) { if (ev.target === v) v.remove() };
  };

  // the mock ad: a countdown you can walk away from (and forfeit the reward — the rewarded-ad contract)
  function mockAd(placement) {
    return new Promise(function (res) {
      var ms = Math.max(200, +CFG.mock.adMs || 5000), t0 = Date.now(), done = false;
      var v = veil("mz149Ad", '<div class="mz149-ad" style="display:flex;flex-direction:column;gap:10px;align-items:center">' +
        '<div class="mz149-eyebrow">ADVERTISEMENT · MOCK PROVIDER</div><div class="mz149-count" data-n>' + Math.ceil(ms / 1000) + "</div>" +
        '<p class="mz149-p">A real ad plays here (AdMob in the store builds). Reward: ' + ((CFG.placements[placement] || {}).label || placement) + ".</p>" +
        '<div class="mz149-bar"><i data-bar></i></div><button class="mz149-btn" data-close>CLOSE — NO REWARD</button></div>');
      var n = v.querySelector("[data-n]"), bar = v.querySelector("[data-bar]");
      function end(r) { if (done) return; done = true; clearInterval(iv); v.remove(); res(r) }
      var iv = setInterval(function () {
        var k = Math.min(1, (Date.now() - t0) / ms); bar.style.width = (k * 100) + "%"; n.textContent = Math.max(0, Math.ceil((ms - (Date.now() - t0)) / 1000));
        if (k >= 1) end({ rewarded: true });
      }, 50);
      v.querySelector("[data-close]").onclick = function () { end({ rewarded: false, reason: "closed-early" }) };
    });
  }
  // the mock checkout: nothing is charged
  function mockCheckout(p) {
    return new Promise(function (res) {
      var v = veil("mz149Buy", '<div class="mz149-eyebrow">MOCK CHECKOUT · NOTHING IS CHARGED</div><h2 class="mz149-h">' + esc(p.title) + "</h2>" +
        '<p class="mz149-p">' + esc(p.price) + (p.kind === "subscription" ? "" : " · one time") + ". In a store build this is the App Store / Google Play sheet.</p>" +
        '<div class="mz149-row"><button class="mz149-btn" data-no>CANCEL</button><button class="mz149-btn gold" data-yes>CONFIRM</button></div>');
      v.querySelector("[data-yes]").onclick = function () { v.remove(); res(true) };
      v.querySelector("[data-no]").onclick = function () { v.remove(); res(false) };
    });
  }

  // ---- the Store: the owner's ladder, top to bottom
  //   FREE → REWARDED (today's count) → $3.99 AD FREE → $8.99 PRO CAREER → $14.99 FOUNDER → $9.99 SEASON PASS →
  //   COSMETICS (by category, previewed through RIB_COSMETICS) → EXPANSIONS (coming soon) → never for sale
  var storeOpen = false, cosTab = null;
  function li(a) { return '<ul class="mz149-ul">' + a.filter(Boolean).map(function (b) { return "<li>" + b + "</li>" }).join("") + "</ul>" }
  function tierRung(step, p, rank) {
    var t = tier(), order = { free: 0, noAds: 1, pro: 2, founder: 3 }, mine = order[t] >= rank, up = null;
    if (!mine && CFG.features.upgrades) up = CFG.products.filter(function (u) { return u.upgradeFrom && u.tier === p.tier && has(u.upgradeFrom) && (u.upgradeFrom !== "noAds" || !has("pro")) })[0] || null;
    var price = mine ? (t === p.tier ? "OWNED ✓" : "INCLUDED ✓") : up ? up.price : p.price;
    var btn = mine ? '<button class="mz149-btn" disabled>' + (t === p.tier ? "YOURS — THANK YOU" : "INCLUDED IN YOUR TIER") + "</button>"
      : '<button class="mz149-btn' + (rank === 2 ? " gold" : "") + '" data-buy="' + (up ? up.id : p.id) + '">' + (up ? "UPGRADE · " + up.price : "GET " + esc(p.title) + " · " + p.price) + "</button>" +
        (up ? '<div class="mz149-fine">You own ' + (up.upgradeFrom === "pro" ? "Pro Career" : "Ad Free") + ": this upgrade is the difference (" + p.price + " − what you paid). The stores sell it as its own product.</div>" : "");
    return '<div class="mz151-rung' + (mine ? " owned" : "") + (rank === 2 && !mine ? " best" : "") + '" data-sec="' + p.tier + '"><span class="mz151-step">' + step + "</span>" +
      '<div class="mz149-prod"><b>' + esc(p.title) + '</b><i class="' + (mine ? "mz151-ok" : "") + '">' + price + "</i></div>" + li(p.blurb || []) + btn + "</div>";
  }
  // the free rung is the game's own progression, read off window.__V151A (the gates apply with or without this module)
  function freeRung() {
    var g = gates() || {}, s = simInfo(), ok = '<b class="mz151-ok">', G = function (x) { return x && x.ok };
    var po = G(g.playsOnly) ? ok + "My Plays Only — unlocked ✓</b>" : "My Plays Only — <b>complete your first career</b>";
    var v156 = g.uffTitle !== undefined;   // v156 C: 3× after a full UFF season, 4× for the UFF title
    var s3 = G(g.speed3) ? ok + "3× play speed — unlocked ✓</b>" : v156 ? "3× play speed — <b>survive a full UFF season</b>" : "3× play speed — <b>reach the UFF</b> (best so far: " + esc(g.bestName || "—") + ")";
    if (v156) s3 += "<br>" + (g.speed4 && g.speed4.earned ? ok + "4× play speed — won with the UFF title ✓</b>" : "4× play speed — <b>win the UFF championship</b>");
    var sk = !s.gated ? "Season skips — no limit" : s.perDay ? "Season skips: <b>" + s.perDay + " a day</b> from your prestige (" + Math.max(0, s.left) + " left today)" + (s.next ? " — " + s.next.perDay + " a day at " + fmtN(s.next.at) + " PP" : "")
      : "Season skips — <b>earn " + fmtN(s.firstAt) + " lifetime PP</b> (" + fmtN(s.lifetime) + " so far)";
    var share = s.gated && !s.perDay && s.firstAt ? Math.min(1, (s.lifetime || 0) / s.firstAt) : null;
    return '<div class="mz151-rung owned" data-sec="free"><span class="mz151-step">FREE · ALWAYS</span>' +
      '<div class="mz149-prod"><b>The whole game</b><i class="mz151-ok">$0</i></div>' +
      li(["Every career, level, position and screen — the full sim", "1× and 2× play speed; Quick Play sims any week, any time", po, s3, sk + (share != null ? '<div class="mz151-prog" data-skipprog><i style="width:' + Math.round(share * 100) + '%"></i></div>' : ""), "Prestige is earned on the field — it is never for sale"]) + "</div>";
  }
  function adRung() {
    var left = adsLeft(), cap = dailyCap(), free = has("noAds"), s4 = until("speed4"), perm = s4 === Infinity, s = simInfo();
    var b = [];
    if (CFG.features.rewardedSpeed && !perm) b.push('<button class="mz149-btn" data-ad="speed4"' + (left ? "" : " disabled") + ">" + (free ? "✓ CLAIM" : "▶ WATCH") + " · 4× FOR " + speed4Minutes() + " MIN</button>");
    if (CFG.features.rewardedSim && s.gated) b.push('<button class="mz149-btn" data-ad="simExtra"' + (left ? "" : " disabled") + ">" + (free ? "✓ CLAIM" : "▶ WATCH") + " · +1 SEASON SKIP TODAY</button>");
    if (!b.length && !CFG.features.rewardedTrial) return "";
    return '<div class="mz151-rung" data-sec="ad"><span class="mz151-step">REWARDED · OPTIONAL</span>' +
      '<div class="mz149-prod"><b>' + (free ? "Ad-free rewards" : "Watch an ad, if you like") + '</b><i data-left>' + (s4 && !perm ? "4× · " + fmtLeft(s4 - now()) + " LEFT" : left + " / " + cap + " TODAY") + "</i></div>" +
      '<p class="mz149-p">' + (free ? "Ad Free: the same conveniences, no ad to watch." : "Conveniences only — never power, never PP. You choose when; nothing interrupts a play.") + " " + left + " of " + cap + " left today.</p>" +
      '<div class="mz151-btns">' + b.join("") + "</div>" +
      (CFG.features.rewardedTrial && COS() && CFG.features.cosmetics ? '<div class="mz149-fine">Try any locked cosmetic for ' + trialHours() + " hours from the shop below (▶ 24H).</div>" : "") + "</div>";
  }
  function passRung() {
    var S = SEA(), P = passProducts()[0]; if (!S || !P) return "";
    var c = {}; try { c = S.current() || {} } catch (e) {}
    var own = has("pass:" + c.id); if (!own) try { own = !!(S.pass && S.pass() && S.pass().owned) } catch (e) {}
    return '<div class="mz151-rung' + (own ? " owned" : "") + '" data-sec="pass"><span class="mz151-step">THIS SEASON</span>' +
      '<div class="mz149-prod"><b>' + esc(P.title) + '</b><i class="' + (own ? "mz151-ok" : "") + '">' + (own ? "OWNED ✓" : P.price) + "</i></div>" +
      li(["The premium track of " + esc(c.name || c.id) + (c.daysLeft != null ? " — " + c.daysLeft + " days left" : ""), "Cosmetic rewards and season challenges — never power", "One pass per competitive season (~6 months)"]) +
      (own ? "" : '<button class="mz149-btn" data-buy="' + P.id + '">GET THE PASS · ' + P.price + "</button>") + "</div>";
  }
  function teamStyleCard() {
    var p = CFG.products.filter(function (x) { return x.teamStyle })[0]; if (!p || !CFG.features.cosmetics) return "";
    var own = owns(p.id);
    return '<div class="mz151-pack" data-pack="' + p.id + '" style="grid-column:1/-1"><b>' + esc(p.title) + '</b><div class="mz149-fine">' + esc((p.blurb || [])[0] || "") + ". Five are free; the rest cost PP in the Team Creator — or all of them here.</div>" +
      '<button class="mz149-btn" data-buy="' + p.id + '"' + (own ? " disabled" : "") + ">" + (own ? "OWNED ✓" : "GET · " + p.price) + "</button></div>";
  }
  function cosRung() {
    var C = COS(); if (!CFG.features.cosmetics) return "";
    var packs = C ? packProducts() : [];
    if (!packs.length) { var ts = teamStyleCard(); return ts ? '<div class="mz151-rung" data-sec="cos"><span class="mz151-step">COSMETICS</span><div class="mz149-prod"><b>Looks, not power</b><i>$1.99–$4.99</i></div><div class="mz151-grid">' + ts + "</div></div>" : "" }
    var cat = {}; try { (C.catalog() || []).forEach(function (i) { cat[i.id] = i }) } catch (e) {}
    var cats = []; packs.forEach(function (p) { if (cats.indexOf(p.cat) < 0) cats.push(p.cat) });
    if (!cosTab || cats.indexOf(cosTab) < 0) cosTab = cats[0];
    var trial = CFG.features.rewardedTrial && adsLeft() > 0;
    var grid = packs.filter(function (p) { return p.cat === cosTab }).map(function (p) {
      var own = owns(p.id);
      var items = p.items.slice(0, 6).map(function (id) {
        var a = cosmeticAccess(id), it = cat[id] || {};
        return '<div class="mz151-item" data-prev="' + esc(id) + '"' + (a === "owned" ? " data-own" : "") + (a === "trial" ? " data-trial" : "") + ' title="' + esc(it.name || id) + '"><span>' + esc(it.name || id) + "</span>" +
          (!a && !own && trial ? '<button class="mz151-try" data-try="' + esc(id) + '">▶ 24H</button>' : "") + "</div>";
      }).join("");
      return '<div class="mz151-pack" data-pack="' + esc(p.id) + '"><b>' + esc(p.title) + '</b><div class="mz151-items">' + items + "</div>" +
        '<button class="mz149-btn" data-buy="' + p.id + '"' + (own ? " disabled" : "") + ">" + (own ? "OWNED ✓" : "GET · " + p.price) + "</button></div>";
    }).join("");
    return '<div class="mz151-rung" data-sec="cos"><span class="mz151-step">COSMETICS</span>' +
      '<div class="mz149-prod"><b>Looks, not power</b><i>$1.99–$4.99</i></div>' +
      '<div class="mz151-tabs">' + cats.map(function (c) { return '<button class="mz149-chip' + (c === cosTab ? " on" : "") + '" data-cat="' + esc(c) + '">' + esc(c || "other") + "</button>" }).join("") + "</div>" +
      '<div class="mz151-grid">' + teamStyleCard() + grid + "</div></div>";
  }
  function expRung() {
    if (!CFG.features.expansions) return "";
    return '<div class="mz151-rung" data-sec="exp"><span class="mz151-step">EXPANSIONS</span>' +
      '<div class="mz149-prod"><b>Coming soon</b><i>NOT FOR SALE YET</i></div>' +
      expansions().map(function (x) { return '<div class="mz151-soon" data-exp="' + x.id + '"><span><b>' + esc(x.name) + "</b><br>" + esc(x.blurb || "") + "</span><i>" + x.price + " · SOON</i></div>" }).join("") +
      '<div class="mz149-fine">Nothing is sold before it exists. They will be listed here, priced, the day they ship.</div></div>';
  }
  ui.store = function (open, focus) {
    storeOpen = !!open;
    var old = document.getElementById("mz149Store");
    if (!open) { if (old) old.remove(); return }
    var keep = old && old.querySelector(".mz151-body") ? old.querySelector(".mz151-body").scrollTop : 0;
    if (!old) track("store_open", { focus: focus || "" });
    var prods = {}; CFG.products.forEach(function (p) { if (p.tier && !p.upgradeFrom) prods[p.tier] = p });
    var body = freeRung() + adRung() +
      (CFG.features.pro ? [["$3.99 · AD FREE", prods.noAds, 1], ["$8.99 · PRO CAREER", prods.pro, 2], ["$14.99 · FOUNDER", prods.founder, 3]].filter(function (x) { return x[1] }).map(function (x) { return tierRung(x[0], x[1], x[2]) }).join("") : "") +
      passRung() + cosRung() + expRung() +
      '<div class="mz149-fine" data-sec="never">Never for sale: Prestige Points, prestige-tree levels, stat boosts, gear or gear rolls, wheel spins or re-rolls — nothing that changes a result on the field. No loot boxes, no forced ads.</div>';
    var h = '<div class="mz151-head"><button class="mz149-x" data-close aria-label="Close">✕</button>' +
      '<div class="mz149-eyebrow">RUNNING IT BACK · STORE</div><h2 class="mz149-h">Play it your way</h2>' +
      '<p class="mz149-p">The whole game is free. These buy time and looks — never power.</p></div>' +
      '<div class="mz151-body">' + body + "</div>" +
      '<div class="mz151-foot"><div class="mz149-row"><button class="mz149-btn" data-restore>RESTORE PURCHASES</button></div>' +
      '<div class="mz149-fine">Store: ' + provider().name.toUpperCase() + (CFG.provider === "mock" ? " (dev — nothing is charged)" : "") + " · your tier: " + ({ free: "FREE", noAds: "AD FREE", pro: "PRO CAREER", founder: "FOUNDER" })[tier()] + ".</div></div>";
    var v = veil("mz149Store", h, "mz151-veil");
    v.querySelector(".mz149-card").classList.add("mz151-store");
    var sc = v.querySelector(".mz151-body");
    // the cosmetics worker draws its own previews into our tiles
    var C = COS(), cat = {}; if (C) try { (C.catalog() || []).forEach(function (i) { cat[i.id] = i }) } catch (e) {}
    [].forEach.call(v.querySelectorAll("[data-prev]"), function (t) { var it = cat[t.getAttribute("data-prev")]; if (it && typeof it.preview === "function") { var box = document.createElement("div"); box.style.cssText = "position:absolute;inset:0"; t.insertBefore(box, t.firstChild); try { it.preview(box); var sp = t.querySelector("span"); if (sp && box.childNodes.length) sp.style.display = "none" } catch (e) {} } });
    v.querySelector("[data-close]").onclick = function () { ui.store(false) };
    v.onclick = function (ev) { if (ev.target === v) ui.store(false) };
    function again() { if (storeOpen) ui.store(true) }
    [].forEach.call(v.querySelectorAll("[data-buy]"), function (b) { b.onclick = function () { purchase(b.getAttribute("data-buy")).then(function (r) { if (r.ok) toast(r.already ? "ALREADY YOURS" : "THANK YOU · UNLOCKED"); else if (r.reason && r.reason !== "cancelled") toast("Purchase failed: " + r.reason); again(); ui.tick() }) } });
    [].forEach.call(v.querySelectorAll("[data-ad]"), function (b) { b.onclick = function () { (b.getAttribute("data-ad") === "simExtra" ? rewardSim() : rewardSpeed()).then(again) } });
    [].forEach.call(v.querySelectorAll("[data-try]"), function (b) { b.onclick = function (ev) { ev.stopPropagation(); rewardTrial(b.getAttribute("data-try")).then(again) } });
    [].forEach.call(v.querySelectorAll("[data-cat]"), function (b) { b.onclick = function () { cosTab = b.getAttribute("data-cat"); again() } });
    v.querySelector("[data-restore]").onclick = function () { restore().then(function (r) { toast(r.restored && r.restored.length ? "RESTORED · " + r.restored.length : "NOTHING TO RESTORE"); again(); ui.tick() }) };
    if (keep) sc.scrollTop = keep;
    else if (focus) { var t = sc.querySelector('[data-sec="' + focus + '"]'); if (t) sc.scrollTop = Math.max(0, t.offsetTop - sc.offsetTop - 8) }
  };

  // v150 C H11: Android back closes the TOP sheet first — an ad forfeits its reward exactly as CLOSE does, a checkout
  // cancels, an offer is dismissed, the store closes. Returns what it closed, or false (the platform layer goes on).
  ui.back = function () {
    var ad = document.getElementById("mz149Ad"); if (ad) { var c = ad.querySelector("[data-close]"); c ? c.click() : ad.remove(); return "ad" }
    var buy = document.getElementById("mz149Buy"); if (buy) { var n = buy.querySelector("[data-no]"); n ? n.click() : buy.remove(); return "checkout" }
    var sh = document.getElementById("mz149Sheet"); if (sh) { sh.remove(); return "sheet" }
    if (document.getElementById("mz149Store")) { ui.store(false); return "store" }
    return false;
  };
  // v150 C H10: Settings › RESTORE PURCHASES (the store screen has the same button)
  ui.restoreUI = function () {
    return restore().then(function (r) {
      toast(r.restored && r.restored.length ? "RESTORED · " + r.restored.length : (r.ok ? "NOTHING TO RESTORE" : "RESTORE FAILED" + (r.reason ? " · " + r.reason : "")));
      var S = gameState(); if (S && S.view === "settings" && typeof window.go === "function") try { window.go("settings") } catch (e) {}
      ui.tick(); return r;
    });
  };

  // decorate what the game drew: the topbar chip, the speed row (4× offer, 3× earn), the season-sim buttons. Idempotent;
  // runs off a MutationObserver (batched to a frame) and the 1s tick that also expires the timed boost.
  function decorate() {
    var tb = document.querySelector(".topbar");
    if (tb && CFG.features.store && !tb.querySelector(".mz149-top")) {
      var c = el('<button class="mz149-chip mz149-top" type="button" data-mz149="store">' + (has("pro") ? "PRO ✓" : "STORE") + "</button>");
      c.onclick = function (ev) { ev.stopPropagation(); API.openStore() }; tb.appendChild(c);
    }
    var row = document.querySelector(".speed-row");
    if (row) {
      var b4 = row.querySelector('.speed-btn[data-spd="4"]'), allowed = speedAllowed(4), b3 = row.querySelector('.speed-btn[data-spd="3"]'), free = has("noAds");
      if (b4) { b4.classList.toggle("mz149-lock", !allowed); b4.classList.toggle("pro", !allowed && !CFG.features.rewardedSpeed); b4.classList.toggle("free", !allowed && free && CFG.features.rewardedSpeed) }
      var G = GATES(); if (G && G.relabel) try { G.relabel() } catch (e) {}   // the game's own "🔒 UFF" / "🔒 PRO" labels follow a gate that opened
      var offer = row.nextElementSibling && row.nextElementSibling.classList.contains("mz149-offer-row") ? row.nextElementSibling : null;
      var g4 = gates(), won4 = !!(g4 && g4.speed4 && g4.speed4.earned);   // v156 C: a UFF champion has 4× for good — no ad chip
      var want4 = CFG.features.gateSpeed4 && CFG.features.rewardedSpeed && until("speed4") !== Infinity && !won4;
      var want3 = false;                                     // v151 A: the game labels its own locked 3× ("🔒 UFF")
      if ((want4 || want3) && !offer) { offer = el('<div class="mz149-offer-row"></div>'); row.parentNode.insertBefore(offer, row.nextSibling) }
      if (!(want4 || want3) && offer) { offer.remove(); offer = null }
      if (offer) {
        var left = until("speed4"), html = "";
        if (want4) html += left ? '<button class="mz149-chip on" type="button" data-mz149="speedleft">4× · ' + fmtLeft(left - now()) + " LEFT</button>"
          : '<button class="mz149-chip" type="button" data-mz149="speedad">' + (free ? "✓ Ad-free: 4× for " : "▶ Watch an ad: 4× for ") + speed4Minutes() + " min</button>";
        if (offer._h !== html) {
          offer.innerHTML = html; offer._h = html;
          var ch = offer.querySelector("button"); if (ch) ch.onclick = function () { until("speed4") ? API.openStore("ad") : rewardSpeed() };
        }
      }
    }
  }
  var queued = false;
  function queue() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; try { decorate() } catch (e) { console.warn("[RIB_MONETIZE decorate]", e) } }) }
  ui.tick = function () {
    // the timed boost ran out mid-game: step the live speed down to the fastest allowed with the game's own setter
    var ls = liveSpeed(); if (!speedAllowed(ls)) { var to = clampSpeed(ls); setSpeed(to); if (document.querySelector(".speed-row")) toast(ls + "× ENDED · BACK TO " + to + "×") }
    var st = document.querySelector("#mz149Store [data-left]"); if (st) { var l = until("speed4"); st.textContent = l && l !== Infinity ? "4× · " + fmtLeft(l - now()) + " LEFT" : adsLeft() + " / " + dailyCap() + " TODAY" }
    var tc = document.querySelector(".mz149-top"); if (tc) tc.textContent = has("pro") ? "PRO ✓" : "STORE";
    decorate();
  };
  var wasSpeed = has("speed4");
  setInterval(function () { var h = has("speed4"); if (h !== wasSpeed) { wasSpeed = h; emit(h ? "speed4-on" : "speed4-expired") } ui.tick() }, 1000);
  function arm() { new MutationObserver(queue).observe(document.body, { childList: true, subtree: true }); queue() }
  if (document.body) arm(); else document.addEventListener("DOMContentLoaded", arm);
  // the web return: ?session_id= from a Stripe Payment Link is VERIFIED by the server before anything is granted
  if (CFG.provider === "web" && QS.get("session_id")) verifyWeb(QS.get("session_id")).then(function (r) { if (r.granted && r.granted.length) toast("THANK YOU · UNLOCKED"); try { var u = new URL(location.href); u.searchParams.delete("session_id"); history.replaceState(null, "", u.toString()) } catch (e) {} });
  // the entitlements a device holds reach the workers' stores (a pass bought on another launch, a restore)
  setTimeout(function () {
    var S = SEA(); if (S && typeof S.grantPremium === "function") { var c = null; try { c = S.current() } catch (e) {} if (c && c.id && has("pass:" + c.id)) { var o = null; try { o = S.pass && S.pass() } catch (e) {} if (!o || !o.owned) try { S.grantPremium(c.id) } catch (e) {} } }
    var C = COS(); if (C && typeof C.owned === "function") list().forEach(function (x) { if (x.key.indexOf("cos:") === 0) { var id = x.key.slice(4); try { if (!C.owned(id)) cosGrant(id, x.source && /founder/.test(x.source) ? "founder" : "shop") } catch (e) {} } });
  }, 0);
  track("monetize_on", { provider: CFG.provider });
})();
