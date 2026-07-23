(() => {
  'use strict';

  const ACTIONS = {
    continue: [/CONTINUE\s+CAREER/i],
    new: [/START\s+NEW\s+CAREER/i, /^\s*NEW\s+CAREER\s*$/i],
    prestige: [/^\s*PRESTIGE\s*$/i],
    goals: [/^\s*GOALS\s*$/i],
    hall: [/^\s*HALL\s*$/i, /HALL\s+OF\s+FAME/i],
    locker: [/^\s*LOCKER\s*$/i],
    settings: [/^\s*SETTINGS\s*$/i],
  };

  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const visibleScreen = (app) => [...app.querySelectorAll('.screen')].find((el) => {
    if (el.classList.contains('hidden')) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }) || app.querySelector('.screen');

  const labelFrom = (text) => /CONTINUE\s+CAREER/i.test(text)
    ? 'CONTINUE CAREER'
    : /START\s+NEW\s+CAREER/i.test(text)
      ? 'START NEW CAREER'
      : '';

  const findOriginal = (app, action) => [...app.querySelectorAll('button, a, [onclick], [role="button"]')].find((el) => {
    if (el.dataset.ribBridge) return false;
    const text = clean(el.textContent);
    return ACTIONS[action]?.some((pattern) => pattern.test(text));
  });

  const clearScreen = (screen) => screen?.querySelectorAll('[data-rib-main-marker], [data-rib-bridge], [data-rib-main-sentinel]').forEach((el) => el.remove());

  const sync = () => {
    const app = document.getElementById('app');
    if (!app) return;
    const screen = visibleScreen(app);
    if (!screen) return;

    const screenText = clean(screen.textContent);
    const appText = clean(app.textContent);
    const viewName = clean(window.o?.view).toLowerCase();
    const viewLooksMain = /^(main|menu|home|title)$/.test(viewName);
    const hasHero = !!screen.querySelector('.hero');
    const label = labelFrom(screenText) || ((hasHero || viewLooksMain) ? labelFrom(appText) : '');

    if (!label) {
      clearScreen(screen);
      return;
    }

    if (!hasHero) {
      const sentinel = document.createElement('span');
      sentinel.className = 'hero';
      sentinel.dataset.ribMainSentinel = 'true';
      sentinel.hidden = true;
      screen.appendChild(sentinel);
    }

    let marker = screen.querySelector('[data-rib-main-marker]');
    if (!marker) {
      marker = document.createElement('span');
      marker.dataset.ribMainMarker = 'true';
      marker.hidden = true;
      screen.appendChild(marker);
    }
    if (marker.textContent !== label) marker.textContent = label;

    for (const [action] of Object.entries(ACTIONS)) {
      const original = findOriginal(app, action);
      if (!original) continue;
      let bridge = screen.querySelector(`[data-rib-bridge="${action}"]`);
      if (!bridge) {
        bridge = document.createElement('button');
        bridge.type = 'button';
        bridge.hidden = true;
        bridge.dataset.ribBridge = action;
        bridge.textContent = action === 'continue' ? 'CONTINUE CAREER' : action === 'new' ? 'NEW CAREER' : action.toUpperCase();
        bridge.addEventListener('click', () => findOriginal(app, action)?.click());
        screen.appendChild(bridge);
      }
    }
  };

  let resyncTimer = 0;
  const resyncSoon = () => {
    clearTimeout(resyncTimer);
    resyncTimer = setTimeout(sync, 0);
  };

  const start = () => {
    sync();
    new MutationObserver(resyncSoon).observe(document.getElementById('app') || document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'] });
    document.addEventListener('click', () => {
      setTimeout(sync, 0);
      setTimeout(sync, 160);
      setTimeout(sync, 480);
    }, true);
    window.addEventListener('pageshow', sync);
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    setInterval(sync, 650);
    window.__RIB_MENU_BRIDGE = { sync };
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
