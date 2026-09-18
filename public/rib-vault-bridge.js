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

  function openVault(opts) {
    opts = opts || {};
    var o = G();
    var tgt = opts.key ? describe(opts.key) : null;
    if (tgt && (tgt.locked || tgt.maxed)) tgt = null;
    return window.__RIB_VAULT.open({
      balance: balance(),
      banked: banked(),
      upgrade: tgt,
      sound: !(o && o.settings && o.settings.sound === false),
      haptics: !(o && o.settings && o.settings.haptics === false),
      skipDoor: !!opts.skipDoor,
      onCommit: function (t) { return commit(t); },
      onClose: function (why, committed) {
        pending = null;
        // back to the tree, and let it redraw against the balance the game now holds
        try {
          if (window.go) window.go('shop');
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
    /* the career-settlement payout: the game has ALREADY awarded the PP (v136's
     * flushBankV136 + the career-end credit). This only SHOWS it arriving. It reads the
     * balance the game holds now and animates up to it, so replaying the presentation can
     * never mint a point. */
    payout: function (amount, done) {
      var to = balance();
      var from = Math.max(0, to - Math.max(0, Math.round(amount || 0)));
      return window.__RIB_VAULT.open({
        balance: from, banked: banked(), upgrade: null, skipDoor: true,
        onClose: function () { try { window.__RIB_MENU_BRIDGE && window.__RIB_MENU_BRIDGE.sync(); } catch (e) {} }
      }).then(function () {
        window.__RIB_VAULT.deposit(to - from, done);
      });
    }
  };
})();
