(() => {
  'use strict';

  const MATCHERS = {
    continue: [/CONTINUE\s+CAREER/i],
    new: [/START\s+NEW\s+CAREER/i, /NEW\s+CAREER/i],
    prestige: [/PRESTIGE/i, /\bPP\s*\+/],
    goals: [/GOALS/i],
    hall: [/\bHALL\b/i, /HALL\s+OF\s+FAME/i],
    locker: [/LOCKER/i],
    settings: [/SETTINGS/i, /⚙/],
  };

  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();

  function findOriginal(action) {
    const app = document.getElementById('app');
    if (!app) return null;
    return [...app.querySelectorAll('button, a, [onclick], [role="button"]')].find((el) => {
      if (el.dataset.ribBridge || el.closest('#rib-main-menu-v2')) return false;
      const text = clean(el.textContent);
      return MATCHERS[action]?.some((pattern) => pattern.test(text));
    }) || null;
  }

  function closeOverlay() {
    document.body.classList.remove('rib-menu-open');
    document.getElementById('rib-main-menu-v2')?.remove();
  }

  let routing = false;

  // v89: "view:<name>" routes straight through the game's router (window.go),
  // "home" is the page we are on. Everything else still clicks the legacy control.
  function routeView(view) {
    if (typeof window.go !== 'function') { console.warn('[RIB menu] window.go unavailable for view', view); return false; }
    const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    routing = true;
    setTimeout(() => {
      routing = false;
      closeOverlay();
      try { window.go(view); } catch (e) { console.warn('[RIB menu] go(' + view + ') failed', e); }
      setTimeout(() => window.__RIB_MENU_BRIDGE?.sync?.(), 0);
      setTimeout(() => window.__RIB_MENU_BRIDGE?.sync?.(), 120);
    }, reduced ? 0 : 150);
    return true;
  }

  function activate(action) {
    if (routing) return false;
    if (action === 'home') { document.getElementById('rib-main-menu-v2')?.scrollTo({ top: 0, behavior: 'smooth' }); return true; }
    if (/^view:/.test(action || '')) return routeView(action.slice(5));
    // The primary CTA doubles as START NEW CAREER: if no continue target
    // exists (no career yet, or the game relabeled it), fall through to new.
    const original = findOriginal(action) || (action === 'continue' ? findOriginal('new') : null);
    if (!original) {
      console.warn('[RIB menu] Original navigation target unavailable:', action);
      return false;
    }

    // Route after a beat so the press animation lands before the transition.
    const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    routing = true;
    setTimeout(() => {
      routing = false;
      closeOverlay();
      original.click();
      setTimeout(() => window.__RIB_MENU_BRIDGE?.sync?.(), 0);
      setTimeout(() => window.__RIB_MENU_BRIDGE?.sync?.(), 120);
      setTimeout(() => window.__RIB_MENU_BRIDGE?.sync?.(), 420);
    }, reduced ? 0 : 150);
    return true;
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest?.('#rib-main-menu-v2 [data-rib-action]');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    activate(target.dataset.ribAction);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target.closest?.('#rib-main-menu-v2 [data-rib-action]');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    target.classList.add('rib-pressed');
    activate(target.dataset.ribAction);
  }, true);

  window.__RIB_MENU_NAVIGATION = { activate, findOriginal };
})();
