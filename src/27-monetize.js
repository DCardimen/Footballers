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
 *     and the web (a Stripe Payment Link + a future verification endpoint).
 *   - What is NEVER sold: gear or gear rolls, wheel spins, re-rolls, Prestige Points, prestige-tree power, or
 *     any setting that is free today (My plays only, skip opponent drives, fast sim). See the doc.
 *
 * v150 C THE HOOKS ARE IN, THE SWITCH IS STILL OFF: the game now calls INTO this module at the places the doc's §8
 * listed (H1–H11 — src/07-career-app.js `v150 C` banner, public/rib-menu.js, src/26-platform.js). Each of those
 * hooks asks `RIB_MONETIZE.enabled` first, so OFF they are the identity. With the hooks in, this file no longer
 * wraps window.setSpeed (H1/H3 are in the game) and no longer pays the career double itself (H4/H5 pay it through
 * window.__V150C.payout); the only wrapper left is window.buy (analytics, no hook exists — see the doc).
 *
 * Turning it on: set MONETIZE_ENABLED below (or `window.RIB_MONETIZE_CONFIG = {enabled:true, …}` in a script
 * that runs before this one — a store build can inject it). On a DEV host only (localhost / 127.0.0.1 / file:)
 * `?monetize=1` or localStorage `rib.monetize.dev.v149 = "1"` turns it on for testing; `?monetize=0` forces off.
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
      store: true,                       // the Store / Pro screen and its topbar chip
      rewardedSpeed: true,               // "▶ Watch an ad: 4× for 20 min" on the live speed row
      rewardedPP: true,                  // "▶ Watch an ad: double this payout" on the two career-end screens
      pro: true,                         // the one-time Pro unlock
      gateSpeed4: true,                  // 4× needs speed4 (ad, Pro or grandfathered). OWNER DECISION — 4× is free today
      speed3: false,                     // v150 C H2: a 3× button on the live speed row. OFF: the row is exactly ½× / 1× / 2× / 4×
      gateSpeed3: false,                 // v150 C: 3× needs speed3 (the "earned by playing" rung — no earn rule is built yet) or speed4
      grandfatherSpeed4: true,           // a device that already had a save when monetization first came on keeps 4× free
      proKeepsPPAd: false,               // Pro = no ads at all, so the optional PP-double ad is hidden too. OWNER DECISION
      cosmetics: false,                  // cosmetic packs are listed "coming soon" until content exists
      membership: false                  // a monthly membership is listed only when this is true
    },
    rewarded: {
      speed4Minutes: 20,                 // what one speed ad buys
      dailyCap: 6,                       // rewarded ads a local day (all placements)
      ppDoubleMax: 250000                // the PP-double extra is capped (the Impossible branch prices run to 10M)
    },
    products: [
      { id: "rib.pro", kind: "nonconsumable", title: "Running It Back PRO", price: "$5.99",
        grants: { pro: {}, noAds: {}, speed4: {}, saveSlots: { value: 3 } },
        blurb: ["No ads, ever", "4× play speed, permanently", "3 extra save slots (when slots ship)", "Supports the developer"] },
      { id: "rib.cosmetic.kits1", kind: "nonconsumable", title: "Classic Kits pack", price: "$1.99", cosmetic: true,
        grants: { cos_kits1: {} }, blurb: ["Six throwback palettes and crests", "Cosmetic only — changes nothing on the field"] },
      { id: "rib.member.monthly", kind: "subscription", title: "Running It Back Club", price: "$1.99 / month", membership: true,
        grants: { member: { periodDays: 31 }, noAds: { periodDays: 31 }, speed4: { periodDays: 31 } },
        blurb: ["Everything in Pro while subscribed", "Cloud save + seasonal cosmetics (needs a server)"] }
    ],
    // a rewarded placement names the reward it pays. The reward is granted ONLY after the provider says the ad
    // was watched to the end (rewarded:true) — never on an early close.
    placements: {
      speed4: { reward: { key: "speed4", minutes: "speed4Minutes" }, label: "4× for 20 min" },
      ppDouble: { reward: { key: "ppDouble", uses: 1 }, label: "double this payout" }
    },
    mock: { adMs: 5000 },
    // web path (a PWA / GitHub Pages build). Stripe Payment Links need no server to TAKE money; they need one
    // to PROVE it here — `verifyUrl` is that future endpoint (a Supabase function, like verify-daily).
    web: { paymentLinks: { "rib.pro": "" }, verifyUrl: "" },
    // native path. Keys are public SDK keys, not secrets; fill them in the store build's injected config.
    native: { revenuecatApiKey: { ios: "", android: "" }, admobRewardedId: { ios: "", android: "" }, entitlementMap: { pro: "rib.pro" } }
  };

  // ---- where it runs
  var HOST = (typeof location !== "undefined" && location.hostname) || "";
  var DEV_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(HOST) || (typeof location !== "undefined" && location.protocol === "file:");
  var QS = (function () { try { return new URLSearchParams(location.search) } catch (e) { return { get: function () { return null } } } })();
  function lsGet(k) { try { return localStorage.getItem(k) } catch (e) { return null } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true } catch (e) { return false } }

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

  // ---- the clock (a dev offset lets a check fast-forward a timed boost without touching the page's timers)
  var devOffset = 0;
  function now() { return Date.now() + devOffset }

  // ---- entitlement storage: OUTSIDE the save. {v, e:{key:{until,uses,value,source,at}}, caps, gf, tag}
  var KEY = "rib.monetize.ents.v1", SALT = "rib-v149e|not-a-secret|";
  function fnv(s) { var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 } return ("0000000" + h.toString(16)).slice(-8) }
  function body(st) { return JSON.stringify({ v: st.v, e: st.e, caps: st.caps, gf: st.gf }) }
  function blank() { return { v: 1, e: {}, caps: { day: "", ads: 0 }, gf: null } }
  var state = null, tampered = false;
  function load() {
    if (state) return state;
    state = blank();
    var raw = lsGet(KEY); if (!raw) return state;
    try {
      var st = JSON.parse(raw);
      if (st && st.v === 1 && st.tag === fnv(SALT + body(st))) { state = { v: 1, e: st.e || {}, caps: st.caps || state.caps, gf: st.gf == null ? null : st.gf } }
      else { tampered = true; track("ent_tamper", {}) }           // edited by hand: start clean (store restore() brings purchases back)
    } catch (e) { tampered = true }
    return state;
  }
  function save() { var st = load(); var out = { v: 1, e: st.e, caps: st.caps, gf: st.gf }; out.tag = fnv(SALT + body(out)); lsSet(KEY, JSON.stringify(out)) }

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

  // ---- the entitlement API
  function live(x) { return !!x && (x.until == null || x.until > now()) && (x.uses == null || x.uses > 0) }
  function has(key) { if (!ON) return false; return live(load().e[key]) }
  function until(key) { if (!ON) return 0; var x = load().e[key]; if (!live(x)) return 0; return x.until == null ? Infinity : x.until }
  function value(key) { if (!ON) return 0; var x = load().e[key]; return live(x) ? (x.value != null ? x.value : (x.uses != null ? x.uses : 1)) : 0 }
  function grant(key, o) {
    if (!ON || !key) return false;
    o = o || {}; var st = load(), cur = st.e[key], t = now(), u = null;
    if (o.until != null) u = +o.until;
    else if (o.minutes != null) u = t + o.minutes * 60000;
    else if (o.periodDays != null) u = t + o.periodDays * 86400000;
    if (u != null && cur && live(cur) && cur.until != null && cur.until > t && !o.replace) u = cur.until + (u - t);   // a second ad EXTENDS
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
  function adsAllowed() { return ON && !has("noAds") }
  // the one question the speed row asks. Always true while OFF (every speed is free today).
  function speedAllowed(s) {
    if (!ON) return true; s = +s;
    if (s >= 4) return !CFG.features.gateSpeed4 || has("speed4");
    if (s >= 3) return !CFG.features.gateSpeed3 || has("speed3") || has("speed4");
    return true;
  }
  // v150 C H3: a speed carried over from an earlier game (or a boost that ran out) steps down to the fastest one allowed
  function clampSpeed(s) { if (!ON || speedAllowed(s)) return s; return [3, 2, 1].filter(function (x) { return x < +s && speedAllowed(x) && (x !== 3 || CFG.features.speed3) })[0] || 1 }
  // the in-game payout hook (docs/MONETIZATION.md: one line in ms()/no()). Returns the EXTRA PP to add, and spends
  // the ppDouble it pays with. 0 while OFF, 0 without a ppDouble. Capped (rewarded.ppDoubleMax).
  function claimPayoutBoost(amount, context) {
    if (!ON || !(amount > 0) || !has("ppDouble")) return 0;
    var extra = Math.min(Math.round(amount), CFG.rewarded.ppDoubleMax);
    consume("ppDouble"); track("pp_double", { amount: amount, extra: extra, context: context || "" });
    return extra;
  }

  // ---- the daily cap on rewarded ads (all placements)
  function today() { var d = new Date(now()); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate() }
  function adsLeft() { var st = load(); if (st.caps.day !== today()) return CFG.rewarded.dailyCap; return Math.max(0, CFG.rewarded.dailyCap - (st.caps.ads || 0)) }
  function countAd() { var st = load(); if (st.caps.day !== today()) st.caps = { day: today(), ads: 0 }; st.caps.ads++; save() }

  // =====================================================================================================
  // PROVIDERS. An adapter is { name, available(), init(api), showRewarded(placement) → Promise<{rewarded}>,
  // purchase(product) → Promise<{ok, receipt?, reason?}>, restore() → Promise<{ok, owned:[productId]}> }.
  // The module grants; the adapter only reports what the platform said. Grants from a receipt should, in a
  // shipped build, go through verify(receipt) on a server first — that endpoint does not exist yet.
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
  //   await AdMob.prepareRewardVideoAd({ adId: CFG.native.admobRewardedId[platform] });
  //   AdMob.addListener(RewardAdPluginEvents.Rewarded, reward => …); await AdMob.showRewardVideoAd();
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
  //   await Purchases.configure({ apiKey: CFG.native.revenuecatApiKey[platform] });
  //   const { current } = await Purchases.getOfferings();  → packages carry the store's localized price
  //   const { customerInfo } = await Purchases.purchasePackage({ aPackage });
  //   customerInfo.entitlements.active["pro"] → grant; Purchases.restorePurchases() for restore() (Apple requires a button).
  // Going native without RevenueCat: StoreKit 2 (cordova-plugin-purchase / a small Swift plugin) and Google Play
  // Billing Library 6+ each need a server that verifies the receipt / purchase token before granting.
  registerProvider("revenuecat", {
    name: "revenuecat",
    available: function () { return !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Purchases) },
    init: function () { if (!this.available()) return null; var P = window.Capacitor.Plugins.Purchases, plat = (window.Capacitor.getPlatform && window.Capacitor.getPlatform()) || "android"; return P.configure({ apiKey: CFG.native.revenuecatApiKey[plat] }) },
    showRewarded: function () { return Promise.resolve({ rewarded: false, reason: "revenuecat-shows-no-ads" }) },
    purchase: function (p) {
      if (!this.available()) return Promise.resolve({ ok: false, reason: "revenuecat-not-installed" });
      var P = window.Capacitor.Plugins.Purchases;
      return P.getOfferings().then(function (o) {
        var pk = o && o.current && (o.current.availablePackages || []).find(function (x) { return x.product && x.product.identifier === p.id });
        if (!pk) return { ok: false, reason: "not-in-offering" };
        return P.purchasePackage({ aPackage: pk }).then(function (r) { return { ok: true, receipt: { provider: "revenuecat", productId: p.id, customerInfo: r && r.customerInfo } } });
      }).catch(function (e) { return { ok: false, reason: (e && e.userCancelled) ? "cancelled" : String(e && e.message || e) } });
    },
    restore: function () {
      if (!this.available()) return Promise.resolve({ ok: false, owned: [], reason: "revenuecat-not-installed" });
      return window.Capacitor.Plugins.Purchases.restorePurchases().then(function (r) {
        var act = (r && r.customerInfo && r.customerInfo.entitlements && r.customerInfo.entitlements.active) || {};
        return { ok: true, owned: Object.keys(act).map(function (k) { return CFG.native.entitlementMap[k] || k }) };
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

  // web: a Stripe Payment Link opens in a new tab and takes the money; NOTHING is granted here until a server
  // can prove it (CFG.web.verifyUrl: POST {sessionId} → {ok, productIds, signature}). Until that endpoint
  // exists this path never grants, and must not ship inside an iOS app (Apple: IAP for digital goods).
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

  // ---- the flows
  function product(id) { return CFG.products.filter(function (p) { return p.id === id })[0] || null }
  function productOn(p) { return !!p && (p.membership ? CFG.features.membership : p.cosmetic ? CFG.features.cosmetics : CFG.features.pro) }
  function grantProduct(p, source) { Object.keys(p.grants || {}).forEach(function (k) { var g = p.grants[k]; grant(k, { value: g.value, periodDays: g.periodDays, source: source + ":" + p.id }) }) }
  function owns(id) { var p = product(id); return !!p && Object.keys(p.grants || {}).every(function (k) { return has(k) }) }

  var busy = false;
  function showRewarded(placement) {
    if (!ON) return Promise.resolve({ rewarded: false, reason: "disabled" });
    var pl = CFG.placements[placement];
    if (!pl) return Promise.resolve({ rewarded: false, reason: "unknown-placement" });
    if (!adsAllowed() && !(placement === "ppDouble" && CFG.features.proKeepsPPAd)) return Promise.resolve({ rewarded: false, reason: "no-ads-entitlement" });
    if (adsLeft() <= 0) return Promise.resolve({ rewarded: false, reason: "daily-cap" });
    if (busy) return Promise.resolve({ rewarded: false, reason: "busy" });
    busy = true; track("ad_offer_accepted", { placement: placement });
    return provider().showRewarded(placement).then(function (r) {
      busy = false; r = r || {};
      if (!r.rewarded) { track("ad_not_rewarded", { placement: placement, reason: r.reason || "closed" }); return { rewarded: false, reason: r.reason || "closed" } }
      countAd();
      var rw = pl.reward, mins = typeof rw.minutes === "string" ? CFG.rewarded[rw.minutes] : rw.minutes;
      grant(rw.key, { minutes: mins, uses: rw.uses, source: "ad:" + placement });
      track("ad_rewarded", { placement: placement });
      return { rewarded: true, reward: { key: rw.key, minutes: mins || null, uses: rw.uses || null } };
    }, function (e) { busy = false; return { rewarded: false, reason: String(e && e.message || e) } });
  }
  function purchase(productId) {
    if (!ON) return Promise.resolve({ ok: false, reason: "disabled" });
    var p = product(productId);
    if (!p || !productOn(p)) return Promise.resolve({ ok: false, reason: "unknown-product" });
    if (p.kind === "nonconsumable" && owns(p.id)) return Promise.resolve({ ok: true, already: true });
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
      (r.owned || []).forEach(function (id) { var p = product(id); if (p) { grantProduct(p, "restore"); got.push(id) } });
      track("restore_done", { n: got.length }); return { ok: !!r.ok, restored: got, reason: r.reason };
    });
  }

  // =====================================================================================================
  // THE API. Everything above is reachable through it; nothing else is global.
  // =====================================================================================================
  var API = {
    version: "v150C",
    get enabled() { return ON },
    config: CFG,
    has: has, until: until, value: value, grant: grant, revoke: revoke, consume: consume, list: list, onChange: onChange,
    speedAllowed: speedAllowed, clampSpeed: clampSpeed, adsAllowed: adsAllowed, adsLeft: function () { return ON ? adsLeft() : 0 },
    // v150 C: what the game's hooks call. Each one is inert while OFF (the game never calls them then anyway).
    speedLocked: function (s) { if (ON) ui.locked(s); return false },          // H1: a tap on a speed this device may not use
    back: function () { return ON ? ui.back() : false },                     // H11: Android back — close the top store / ad sheet
    restoreUI: function () { if (ON) ui.restoreUI() },                         // H10: Settings › RESTORE PURCHASES
    claimPayoutBoost: claimPayoutBoost,
    showRewarded: showRewarded, purchase: purchase, restore: restore, owns: function (id) { return ON && owns(id) },
    track: track, addAnalyticsSink: addSink,
    registerProvider: registerProvider, providers: PROVIDERS,
    get provider() { return CFG.provider },
    openStore: function () { if (ON && CFG.features.store) ui.store(true) },
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
  // and the UI. docs/MONETIZATION.md lists the hooks that CANNOT be reached from here, with the one line each.
  // =====================================================================================================
  var ui = { tick: function () {}, store: function () {}, locked: function () {}, back: function () { return false }, restoreUI: function () {} };
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

  // ---- hook 1: the speed setter. v150 C: the game's setSpeed() asks speedAllowed() itself (H1) and hands a locked tap
  // to speedLocked(); startLivePlayback() clamps a carried-over speed (H3). Nothing is wrapped here any more.
  var GAME = window.__V150C || null;                                   // the game's side of the hooks (src/07 v150 C)
  function setSpeed(s) { try { typeof window.setSpeed === "function" && window.setSpeed(s) } catch (e) {} }
  ui.locked = function (s) { track("speed_locked_tap", { speed: +s }); offerSpeed(+s) };
  API.hooks.speed = GAME ? "game" : "missing";
  function liveSpeed() { try { return window.__getGridironLiveSpeed ? +window.__getGridironLiveSpeed() : 1 } catch (e) { return 1 } }
  function offerSpeed(s) {
    if (s && s < 4) { toast(s + "× UNLOCKS AS YOU PLAY"); return }        // the earned rung (gateSpeed3) is not sold
    if (!CFG.features.rewardedSpeed || !adsAllowed()) { API.openStore(); return }
    ui.sheet({
      title: "4× PLAY SPEED", lines: ["Watch a short ad for " + CFG.rewarded.speed4Minutes + " minutes of 4×.", CFG.features.pro ? "Or go PRO: 4× for good, and no ads." : ""],
      yes: "▶ WATCH AN AD", no: CFG.features.pro ? "SEE PRO" : "NOT NOW",
      onYes: function () { rewardSpeed() }, onNo: function () { if (CFG.features.pro) API.openStore() }
    });
  }
  function rewardSpeed() {
    return showRewarded("speed4").then(function (r) {
      if (r.rewarded) { toast("4× UNLOCKED · " + CFG.rewarded.speed4Minutes + " MIN"); if (document.querySelector(".speed-btn[data-spd]")) setSpeed(4) }
      else if (r.reason === "daily-cap") toast("That's today's ads — back tomorrow");
      ui.tick(); return r;
    });
  }
  API.rewardSpeed = rewardSpeed;

  // ---- hook 2: the prestige purchase (window.buy = Yl, already wrapped once by the patch layer for haptics).
  // Analytics only: the tree is never for sale and nothing here changes what buy() does.
  var origBuy = window.buy;
  if (typeof origBuy === "function") {
    window.buy = function (node) { track("prestige_buy", { node: String(node) }); return origBuy.apply(this, arguments) };
    API.hooks.buy = true;
  }

  // ---- hook 3: the career payout. v150 C: screenGameOver() / screenWin() settle through the game's payoutBoostV150C
  // (H4/H5): a ppDouble already held is paid AT the settle, and one won on the career-end screen is paid by
  // window.__V150C.payout(), which adds it to state.pp and the vault's payout, saves and redraws the card. It doubles
  // the SETTLE (never the banked season PP — H6), once per career, capped (rewarded.ppDoubleMax).
  function payoutFacts() {
    var S = gameState(); if (!S || (S.view !== "gameover" && S.view !== "win")) return null;
    var e = S.player; if (!e || !e._settled || e._ppDoubledV149E) return null;
    var settle = e._payV150C != null ? e._payV150C : Math.max(0, Math.round((e._vaultPayV137 || 0) - (e._ppBankV136 || 0)));
    return settle > 0 ? { S: S, e: e, settle: settle } : null;
  }
  function applyPayoutDouble() {
    var f = payoutFacts(); if (!f || !GAME || !GAME.payout) return 0;
    var extra = GAME.payout(f.S.view, f.settle); if (!extra) return 0;
    toast("+" + extra.toLocaleString() + " PP · PAYOUT DOUBLED"); ui.tick(); return extra;
  }
  API.applyPayoutDouble = applyPayoutDouble;
  API.hooks.payout = GAME && GAME.payout ? "game" : "missing";

  // =====================================================================================================
  // UI — only ever built while ON. The v146 E shell's look: charcoal, gold hairlines, Oswald.
  // =====================================================================================================
  var css = document.createElement("style"); css.id = "mz149css";
  css.textContent = [
    ".mz149-chip{font:600 11px/1 Oswald,sans-serif;letter-spacing:1.4px;text-transform:uppercase;color:#f0bb45;background:linear-gradient(180deg,#1a1b20,#111216);border:1px solid rgba(230,178,58,.55);border-radius:999px;padding:6px 11px;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent}",
    ".mz149-chip:active{transform:translateY(1px)}",
    ".mz149-chip.on{color:#0d0e11;background:linear-gradient(180deg,#f6cf6a,#e6b23a);border-color:#f6cf6a}",
    ".topbar .mz149-top{margin-left:auto;flex:none;padding:5px 9px;font-size:10px}",
    ".mz149-offer-row{display:flex;justify-content:center;gap:8px;margin:6px 0 2px;min-height:26px;align-items:center}",
    ".mz149-offer-row small{font:500 10px Oswald,sans-serif;letter-spacing:1px;color:#8fa2bb}",
    ".speed-btn.mz149-lock{position:relative;opacity:.72}",
    ".speed-btn.mz149-lock::after{content:'▶ AD';position:absolute;top:-6px;right:-4px;font:700 8px/1 Oswald,sans-serif;letter-spacing:.8px;color:#0d0e11;background:#f0bb45;border-radius:6px;padding:2px 4px}",
    ".speed-btn.mz149-lock.pro::after{content:'PRO'}",
    ".speed-btn.mz149-lock3{opacity:.55}",
    ".mz149-pay{margin:8px 0;display:flex;justify-content:center}",
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
    ".mz149-prod i{font:700 15px Oswald,sans-serif;font-style:normal;color:#f0bb45}",
    ".mz149-ul{margin:0;padding:0 0 0 16px;font:400 12px/1.45 system-ui,sans-serif;color:#b9c2cf}",
    ".mz149-fine{font:400 10.5px/1.35 system-ui,sans-serif;color:#7d8796}",
    ".mz149-x{position:absolute;top:10px;right:12px;background:none;border:0;color:#8fa2bb;font:700 18px Oswald,sans-serif;cursor:pointer}",
    ".mz149-ad{text-align:center;align-items:center}",
    ".mz149-ad .mz149-count{font:700 64px/1 Oswald,sans-serif;color:#f0bb45}",
    ".mz149-bar{height:4px;width:100%;background:#23252c;border-radius:2px;overflow:hidden}.mz149-bar i{display:block;height:100%;width:0;background:#f0bb45}",
    ".mz149-toast{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 96px);transform:translateX(-50%);z-index:2147483001;font:600 12px Oswald,sans-serif;letter-spacing:1.5px;color:#0d0e11;background:#f0bb45;border-radius:999px;padding:8px 14px;box-shadow:0 8px 24px rgba(0,0,0,.5);pointer-events:none;white-space:nowrap}"
  ].join("\n");
  document.head.appendChild(css);

  function el(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild }
  function veil(id, inner) {
    var old = document.getElementById(id); if (old) old.remove();
    var v = el('<div class="mz149-veil" id="' + id + '" role="dialog" aria-modal="true"><div class="mz149-card" style="position:relative">' + inner + "</div></div>");
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
      var v = veil("mz149Buy", '<div class="mz149-eyebrow">MOCK CHECKOUT · NOTHING IS CHARGED</div><h2 class="mz149-h">' + p.title + "</h2>" +
        '<p class="mz149-p">' + p.price + (p.kind === "subscription" ? "" : " · one time") + ". In a store build this is the App Store / Google Play sheet.</p>" +
        '<div class="mz149-row"><button class="mz149-btn" data-no>CANCEL</button><button class="mz149-btn gold" data-yes>CONFIRM</button></div>');
      v.querySelector("[data-yes]").onclick = function () { v.remove(); res(true) };
      v.querySelector("[data-no]").onclick = function () { v.remove(); res(false) };
    });
  }

  // the Store / Pro screen
  var storeOpen = false;
  ui.store = function (open) {
    storeOpen = !!open;
    var old = document.getElementById("mz149Store");
    if (!open) { if (old) old.remove(); return }
    track("store_open", {});
    var pro = product("rib.pro"), cos = product("rib.cosmetic.kits1"), mem = product("rib.member.monthly");
    var ownPro = owns("rib.pro"), sp = until("speed4");
    var h = '<button class="mz149-x" data-close aria-label="Close">✕</button>' +
      '<div class="mz149-eyebrow">RUNNING IT BACK · STORE</div><h2 class="mz149-h">Play it your way</h2>' +
      '<p class="mz149-p">The whole game is free. These buy time and looks — never power.</p>';
    if (CFG.features.pro && pro) h += '<div class="mz149-sec" data-sec="pro"><div class="mz149-prod"><b>' + pro.title + "</b><i>" + (ownPro ? "OWNED ✓" : pro.price) + "</i></div>" +
      '<ul class="mz149-ul">' + pro.blurb.map(function (b) { return "<li>" + b + "</li>" }).join("") + "</ul>" +
      '<button class="mz149-btn gold" data-buy="rib.pro"' + (ownPro ? " disabled" : "") + ">" + (ownPro ? "PRO IS YOURS" : "GO PRO · " + pro.price) + "</button></div>";
    if (CFG.features.rewardedSpeed && adsAllowed()) h += '<div class="mz149-sec" data-sec="ad"><div class="mz149-prod"><b>Free boost</b><i data-left>' + (sp ? "4× · " + fmtLeft(sp - now()) + " LEFT" : "") + "</i></div>" +
      '<p class="mz149-p">Watch a short ad: ' + CFG.rewarded.speed4Minutes + ' minutes of 4× play speed. Optional, always.</p>' +
      '<button class="mz149-btn" data-ad' + (adsLeft() ? "" : " disabled") + ">▶ WATCH AN AD · 4× FOR " + CFG.rewarded.speed4Minutes + " MIN</button>" +
      '<div class="mz149-fine">' + adsLeft() + " of " + CFG.rewarded.dailyCap + " left today.</div></div>";
    if (cos) h += '<div class="mz149-sec" data-sec="cos"><div class="mz149-prod"><b>' + cos.title + "</b><i>" + (CFG.features.cosmetics ? (owns(cos.id) ? "OWNED ✓" : cos.price) : "SOON") + "</i></div>" +
      '<p class="mz149-p">' + cos.blurb.join(" · ") + "</p>" + (CFG.features.cosmetics ? '<button class="mz149-btn" data-buy="' + cos.id + '"' + (owns(cos.id) ? " disabled" : "") + ">GET · " + cos.price + "</button>" : "") + "</div>";
    if (CFG.features.membership && mem) h += '<div class="mz149-sec" data-sec="mem"><div class="mz149-prod"><b>' + mem.title + "</b><i>" + mem.price + "</i></div>" +
      '<p class="mz149-p">' + mem.blurb.join(" · ") + '</p><button class="mz149-btn" data-buy="' + mem.id + '">SUBSCRIBE</button></div>';
    h += '<div class="mz149-sec"><div class="mz149-row"><button class="mz149-btn" data-restore>RESTORE PURCHASES</button></div>' +
      '<div class="mz149-fine">Never for sale: gear, gear rolls, wheel spins, re-rolls or Prestige Points. Store: ' + provider().name.toUpperCase() + (CFG.provider === "mock" ? " (dev — nothing is charged)" : "") + ".</div></div>";
    var v = veil("mz149Store", h);
    v.querySelector("[data-close]").onclick = function () { ui.store(false) };
    v.onclick = function (ev) { if (ev.target === v) ui.store(false) };
    [].forEach.call(v.querySelectorAll("[data-buy]"), function (b) { b.onclick = function () { purchase(b.getAttribute("data-buy")).then(function (r) { if (r.ok) toast("THANK YOU · UNLOCKED"); else if (r.reason && r.reason !== "cancelled") toast("Purchase failed: " + r.reason); if (storeOpen) ui.store(true); ui.tick() }) } });
    var ad = v.querySelector("[data-ad]"); if (ad) ad.onclick = function () { rewardSpeed().then(function () { if (storeOpen) ui.store(true) }) };
    v.querySelector("[data-restore]").onclick = function () { restore().then(function (r) { toast(r.restored && r.restored.length ? "RESTORED · " + r.restored.length : "NOTHING TO RESTORE"); if (storeOpen) ui.store(true); ui.tick() }) };
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

  // decorate what the game drew: the topbar chip, the speed row, the career-end payout. Idempotent; runs off a
  // MutationObserver (batched to a frame) and the 1s tick that also expires the timed boost.
  function decorate() {
    var tb = document.querySelector(".topbar");
    if (tb && CFG.features.store && !tb.querySelector(".mz149-top")) {
      var c = el('<button class="mz149-chip mz149-top" type="button" data-mz149="store">' + (has("pro") ? "PRO ✓" : "STORE") + "</button>");
      c.onclick = function (ev) { ev.stopPropagation(); API.openStore() }; tb.appendChild(c);
    }
    var row = document.querySelector(".speed-row");
    if (row) {
      var b4 = row.querySelector('.speed-btn[data-spd="4"]'), allowed = speedAllowed(4), b3 = row.querySelector('.speed-btn[data-spd="3"]');
      if (b4) { b4.classList.toggle("mz149-lock", !allowed); b4.classList.toggle("pro", !allowed && !adsAllowed()) }
      if (b3) b3.classList.toggle("mz149-lock3", !speedAllowed(3));
      var offer = row.nextElementSibling && row.nextElementSibling.classList.contains("mz149-offer-row") ? row.nextElementSibling : null;
      var want = CFG.features.gateSpeed4 && CFG.features.rewardedSpeed && adsAllowed() && !(until("speed4") === Infinity);
      if (want && !offer) { offer = el('<div class="mz149-offer-row"></div>'); row.parentNode.insertBefore(offer, row.nextSibling) }
      if (!want && offer) { offer.remove(); offer = null }
      if (offer) {
        var left = until("speed4"), html = left ? '<button class="mz149-chip on" type="button" data-mz149="speedleft">4× · ' + fmtLeft(left - now()) + " LEFT</button>"
          : '<button class="mz149-chip" type="button" data-mz149="speedad">▶ Watch an ad: 4× for ' + CFG.rewarded.speed4Minutes + " min</button>";
        if (offer._h !== html) { offer.innerHTML = html; offer._h = html; offer.firstChild.onclick = function () { left ? API.openStore() : rewardSpeed() } }
      }
    }
    var f = CFG.features.rewardedPP && (adsAllowed() || CFG.features.proKeepsPPAd) ? payoutFacts() : null, pay = document.getElementById("mz149Pay");
    if (f && !pay && adsLeft() > 0) {
      var scr = document.getElementById("screen") || document.getElementById("app");
      if (scr) {
        pay = el('<div class="mz149-pay" id="mz149Pay"><button class="mz149-chip" type="button" data-mz149="ppad">▶ Watch an ad: double this payout (+' + Math.min(f.settle, CFG.rewarded.ppDoubleMax).toLocaleString() + " PP)</button></div>");
        pay.firstChild.onclick = function () { showRewarded("ppDouble").then(function (r) { if (r.rewarded) applyPayoutDouble(); else if (r.reason === "daily-cap") toast("That's today's ads — back tomorrow"); var p = document.getElementById("mz149Pay"); if (p && !payoutFacts()) p.remove() }) };
        scr.insertBefore(pay, scr.firstChild);
      }
    } else if (!f && pay) pay.remove();
    if (f && has("ppDouble")) applyPayoutDouble();       // a ppDouble held from elsewhere pays the next career payout
  }
  var queued = false;
  function queue() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; try { decorate() } catch (e) { console.warn("[RIB_MONETIZE decorate]", e) } }) }
  ui.tick = function () {
    // the timed boost ran out mid-game: step the live speed down to 2× (the free ceiling) with the game's own setter
    var ls = liveSpeed(); if (!speedAllowed(ls)) { var to = clampSpeed(ls); setSpeed(to); if (document.querySelector(".speed-row")) toast(ls + "× ENDED · BACK TO " + to + "×") }
    var st = document.querySelector("#mz149Store [data-left]"); if (st) { var l = until("speed4"); st.textContent = l ? "4× · " + fmtLeft(l - now()) + " LEFT" : "" }
    var tc = document.querySelector(".mz149-top"); if (tc) tc.textContent = has("pro") ? "PRO ✓" : "STORE";
    decorate();
  };
  var wasSpeed = has("speed4");
  setInterval(function () { var h = has("speed4"); if (h !== wasSpeed) { wasSpeed = h; emit(h ? "speed4-on" : "speed4-expired") } ui.tick() }, 1000);
  function arm() { new MutationObserver(queue).observe(document.body, { childList: true, subtree: true }); queue() }
  if (document.body) arm(); else document.addEventListener("DOMContentLoaded", arm);
  track("monetize_on", { provider: CFG.provider });
})();
