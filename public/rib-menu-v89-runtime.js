(() => {
  'use strict';
  /* ===== v89 MENU ASSET RUNTIME =====
   * Warms the four big pictures the Bible layout paints first (the hero, the
   * helmet, the continue card, the trophy), then lifts the opacity gate
   * (html.rib-assets-ready). The gate never holds the menu hostage: a slow or
   * failed image still opens the menu after the fallback timer. */
  const ART = './public/menu/';
  const FIRST = ['hero_tunnel', 'hero_mask_p', 'hero_mask_s', 'logo_wordmark', 'portrait_helmet', 'portrait_helmet_mask_s', 'card_continue', 'card_continue_mask_p', 'card_continue_mask_s', 'card_trophy'];
  const REST = ['swash_underline', 'icon_career', 'icon_training', 'icon_goals', 'icon_hall', 'icon_locker', 'icon_settings',
    'legacy_star', 'legacy_helmet', 'legacy_crown', 'legacy_gem', 'legacy_laurel', 'legacy_target',
    'badge_crown', 'badge_shoe', 'badge_lightning', 'badge_shield', 'badge_brain', 'badge_eye', 'badge_fist', 'badge_clock', 'badge_target'];
  const state = { ready: false, loaded: [], failed: [], fallback: false };
  window.__RIB_MENU_ASSETS = state;

  const load = (name) => new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { state.loaded.push(name); resolve(true); };
    img.onerror = () => { state.failed.push(name); resolve(false); };
    img.src = `${ART}${name}.webp`;
  });
  const open = (viaFallback) => {
    if (state.ready) return;
    state.ready = true; state.fallback = !!viaFallback;
    document.documentElement.classList.add('rib-assets-ready');
    document.dispatchEvent(new CustomEvent('rib-assets-ready', { detail: state }));
  };
  const fallback = setTimeout(() => open(true), 2500);
  Promise.all(FIRST.map(load)).then(() => { clearTimeout(fallback); open(false); REST.forEach(load); });
})();
