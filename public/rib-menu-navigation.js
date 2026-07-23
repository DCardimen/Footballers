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

  function activate(action) {
    const original = findOriginal(action);
    if (!original) {
      console.warn('[RIB menu] Original navigation target unavailable:', action);
      return false;
    }

    closeOverlay();
    original.click();
    setTimeout(() => window.__RIB_MENU_BRIDGE?.sync?.(), 0);
    setTimeout(() => window.__RIB_MENU_BRIDGE?.sync?.(), 120);
    setTimeout(() => window.__RIB_MENU_BRIDGE?.sync?.(), 420);
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
    activate(target.dataset.ribAction);
  }, true);

  window.__RIB_MENU_NAVIGATION = { activate, findOriginal };
})();
