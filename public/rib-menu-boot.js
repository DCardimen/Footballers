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

  const findOriginal = (app, action) => [...app.querySelectorAll('button, a, [onclick], [role="button"]')].find((el) => {
    if (el.dataset.ribBridge) return false;
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return ACTIONS[action]?.some((pattern) => pattern.test(text));
  });

  const sync = () => {
    const app = document.getElementById('app');
    if (!app) return;
    const screen = [...app.querySelectorAll('.screen')].find((el) => !el.classList.contains('hidden')) || app.querySelector('.screen');
    if (!screen?.querySelector('.hero')) {
      screen?.querySelectorAll('[data-rib-main-marker], [data-rib-bridge]').forEach((el) => el.remove());
      return;
    }

    const appText = app.textContent || '';
    const label = /CONTINUE\s+CAREER/i.test(appText)
      ? 'CONTINUE CAREER'
      : /START\s+NEW\s+CAREER/i.test(appText)
        ? 'START NEW CAREER'
        : '';
    if (!label) return;

    let marker = screen.querySelector('[data-rib-main-marker]');
    if (!marker) {
      marker = document.createElement('span');
      marker.dataset.ribMainMarker = 'true';
      marker.hidden = true;
      screen.appendChild(marker);
    }
    marker.textContent = label;

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

  const start = () => {
    sync();
    new MutationObserver(sync).observe(document.getElementById('app') || document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
