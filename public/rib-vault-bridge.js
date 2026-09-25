/* ===== v137 THE PRESTIGE VAULT — the bridge =====
 *
 * The one file that knows both sides. public/rib-vault.js knows nothing about the career
 * app; index.html is not touched beyond two script tags and one router case.
 *
 * WHAT IT READS (verified against the code, not against an older doc — see
 * docs/PRESTIGE-VAULT.md):
 *   __GRIDIRON_AUDIT__.getState()  -> the account state `o`
 *   o.pp                           -> the SPENDABLE balance. The only thing the vault spends.
 *   o.prestige                     -> the HONORS rank. Never spent, never shown as a balance.
 *   o.ppBankV136                   -> v136's bank. Shown as PENDING, never spendable.
 *   o.tree[key]                    -> the level a node is at
 *   window.buy(key)                -> `Yl`, the ONE authoritative purchase. Atomic.
 *   window.go(view)                -> `te`, the router
 *
 * WHAT IT WRITES: nothing, except through `window.buy`. The vault never touches o.pp, o.tree
 * or the save. `commit()` reads o.pp before and after the call and reports a purchase only
 * if the game really took the money and really gave the level — so a refusal inside the
 * game (a gate, a race, a max level) can never leave the vault claiming a sale.
 */
(function () {
  'use strict';
  if (window.__RIB_VAULT_BRIDGE) return;

  function G() {
    try { return window.__GRIDIRON_AUDIT__ && window.__GRIDIRON_AUDIT__.getState(); }
    catch (e) { return null; }
  }
  function nodes() {
    try { return window.__prestigeNodesV137 ? window.__prestigeNodesV137() : null; }
    catch (e) { return null; }
  }
  var pending = null;        // the upgrade the player walked in with

  /* the shape the vault wants, built from the game's own node record + price + gate */
  function describe(key) {
    var N = nodes(), o = G();
    if (!N || !o) return null;
    var n = N.node(key);
    if (!n) return null;
    return {
      key: key, name: n.name, desc: n.desc, icon: n.icon,
      level: N.level(key), max: n.max,
      cost: N.price(key),
      locked: !N.open(key),
      maxed: N.level(key) >= n.max
    };
  }

  function balance() { var o = G(); return o ? Math.max(0, Math.round(o.pp || 0)) : 0; }
  function banked() { var o = G(); return o ? Math.max(0, Math.round(o.ppBankV136 || 0)) : 0; }

  /* THE COMMIT. One call into the game's own handler, and a verification that it happened:
   * the vault reports success only when o.pp actually fell by the price AND the node's level
   * actually rose. Anything else is reported as a refusal and the vault hands the player's
   * reservation back untouched. */
  function commit(target) {
    var o = G();
    if (!o || !target) return false;
    var N = nodes(); if (!N) return false;
    var beforePP = Math.round(o.pp || 0);
    var beforeLv = N.level(target.key);
    var price = N.price(target.key);
    if (price !== target.cost) return false;            // the price moved under us
    if (beforePP < price) return false;
    if (!N.open(target.key)) return false;
    if (beforeLv >= (N.node(target.key) || {}).max) return false;
    try { window.buy(target.key); } catch (e) { console.warn('[vault] buy threw', e); return false; }
    var o2 = G();
    var okLv = N.level(target.key) === beforeLv + 1;
    var okPP = Math.round(o2.pp || 0) === beforePP - price;
    if (!okLv || !okPP) { console.warn('[vault] purchase did not settle as expected'); return okLv && okPP; }
    return true;
  }

  /* ===== v153 C PAYDAY — which award the vault still owes a reward sequence =====
   *
   * The career settle (`screenGameOver` / `screenWin` in 07) has ALREADY put the PP on
   * `state.pp`, counted the career (`careersCompleted`) and saved — which also raises v151 A's
   * lifetime-earned counter (`ppLifetimeV151A`, which only ever goes up). The vault's job is to
   * SHOW it arriving, once. So an award is pending when a career has settled since the vault
   * last played one, and its size is the lifetime PP earned since the vault last showed a
   * balance: the whole run, bounties included, becomes wealth in one shower.
   *
   * What was already shown lives in `rib.vaultPay.v153` — presentation state, OUTSIDE the
   * save, like `rib.legacy.v152`. It is written BEFORE the sequence starts, so leaving mid-way,
   * reopening, or reloading can never replay it; and nothing here can mint a point, because
   * the sequence animates FROM `pp - gain` UP TO the balance the game already holds. A
   * different save (fewer careers, a lower lifetime) resets the record instead of replaying.
   * `RIB_TUNE.v153C = 0` turns the sequence off. The bridge still writes nothing to the game. */
  var PAY_KEY = 'rib.vaultPay.v153';
  function payRec() { try { var r = JSON.parse(localStorage.getItem(PAY_KEY) || 'null'); return r && typeof r === 'object' ? r : null; } catch (e) { return null; } }
  function payWrite(r) { try { localStorage.setItem(PAY_KEY, JSON.stringify(r)); } catch (e) {} }
  function lifeNow(o) {
    var L = o.ppLifetimeV151A;
    if (L == null) {
      /* never tracked yet: the same baseline 07 would start it from, read without writing */
      L = Math.max(0, Math.round((o.pp || 0) + (o.ppBankV136 || 0)));
      return L;
    }
    var d = (o.pp || 0) - (o.ppSeenV151A || 0);      // a rise not yet saved (ppTrackV151A runs on save)
    return Math.max(0, Math.round(L + Math.max(0, d)));
  }
  function paydayOff() { try { return window.RIB_TUNE && window.RIB_TUNE.v153C === 0; } catch (e) { return false; } }
  /* PEEK: what the vault owes, or null. Never writes. */
  function pendingPayday() {
    var o = G();
    if (!o || paydayOff()) return null;
    var cc = Math.max(0, o.careersCompleted || 0), L = lifeNow(o), pp = balance(), r = payRec();
    var fresh = !r || !(r.careers >= 0) || cc < r.careers || L < (r.life || 0);
    var gain = 0;
    if (fresh) {
      /* no record for this save: the one honest award we can see is the settled career on screen */
      var p = o.player;
      if (!r && cc > 0 && p && p._settled && p._vaultPayV137 > 0) gain = Math.round(p._vaultPayV137);
    } else if (cc > r.careers) gain = L - (r.life || 0);
    gain = Math.min(Math.max(0, Math.round(gain)), pp);
    if (gain <= 0) return null;
    var best = r && !fresh ? (r.best || 0) : 0, n = r && !fresh ? (r.n || 0) : 0;
    return { from: pp - gain, to: pp, gain: gain, careers: cc, life: L,
      record: n > 0 && gain > best, best: best, n: n };
  }
  /* mark it shown (before it plays), or just bring the record up to date */
  function settleRecord(pay) {
    var o = G(); if (!o) return;
    var r = payRec(), cc = Math.max(0, o.careersCompleted || 0), L = lifeNow(o);
    var fresh = !r || !(r.careers >= 0) || cc < r.careers || L < (r.life || 0);
    var out = { v: 1, careers: cc, life: L, best: fresh ? 0 : (r.best || 0), n: fresh ? 0 : (r.n || 0),
      last: r && !fresh ? r.last || null : null };
    if (pay) { out.best = Math.max(out.best, pay.gain); out.n++; out.last = { from: pay.from, to: pay.to, gain: pay.gain, at: Date.now() }; }
    payWrite(out);
  }

  function openVault(opts) {
    opts = opts || {};
    var o = G();
    var tgt = opts.key ? describe(opts.key) : null;
    if (tgt && (tgt.locked || tgt.maxed)) tgt = null;
    var pay = opts.noPayday ? null : (opts.payday || pendingPayday());
    if (!opts.payday) settleRecord(pay);                // shown BEFORE it plays: it can never replay
    return window.__RIB_VAULT.open({
      payday: pay ? { from: pay.from, to: pay.to, gain: pay.gain, record: !!pay.record, replay: !!pay.replay } : null,
      balance: balance(),
      banked: banked(),
      upgrade: tgt,
      sound: !(o && o.settings && o.settings.sound === false),
      haptics: !(o && o.settings && o.settings.haptics === false),
      skipDoor: !!opts.skipDoor,
      onCommit: function (t) { return commit(t); },
      onClose: function (why, committed) {
        pending = null;
        // v153 C: the career-end screen's button relabels once its award has been shown
        try { document.querySelectorAll('[data-vaultpay-v153]').forEach(function (b) { if (!pendingPayday()) b.innerHTML = '&#127974; Open the Vault'; }); } catch (e) {}
        // back to the tree, and let it redraw against the balance the game now holds
        // (v153 C: `stay` — opened from a career-end screen, which the player returns to)
        try {
          if (window.go && !opts.stay) window.go('shop');
          if (window.__RIB_MENU_BRIDGE && window.__RIB_MENU_BRIDGE.sync) window.__RIB_MENU_BRIDGE.sync();
        } catch (e) {}
        if (committed && window.__RIB_VAULT_TOAST !== false) {
          try { window.__ribToast && window.__ribToast('✔ ' + (opts.key ? describe(opts.key).name : 'Upgrade') + ' funded from the vault'); } catch (e) {}
        }
      }
    });
  }

  window.__RIB_VAULT_BRIDGE = {
    open: openVault,
    balance: balance,
    banked: banked,
    describe: describe,
    /* the career-settlement payout. v153 C: an award the vault has not shown yet plays as the
     * PAYDAY (once). Asked for again after that, it is a replay of `amount` — presentation
     * only: it reads the balance the game holds and animates up to it, so it can never mint a
     * point, and it does not touch the shown-record. */
    payout: function (amount, done) {
      if (pendingPayday()) return openVault({ skipDoor: true, stay: true }).then(function (v) { done && done(); return v; });
      var to = balance();
      var from = Math.max(0, to - Math.max(0, Math.round(amount || 0)));
      return openVault({ skipDoor: true, stay: true, payday: to > from ? { from: from, to: to, gain: to - from, replay: true } : null })
        .then(function (v) { done && done(); return v; });
    },
    pending: pendingPayday,
    paydayRecord: payRec
  };
})();
