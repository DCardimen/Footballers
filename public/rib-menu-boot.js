(() => {
  'use strict';
  const sync = () => {
    const app = document.getElementById('app');
    if (!app) return;
    const screen = [...app.querySelectorAll('.screen')].find((el) => !el.classList.contains('hidden')) || app.querySelector('.screen');
    const marker = screen?.querySelector('[data-rib-main-marker]');
    if (!screen?.querySelector('.hero')) {
      marker?.remove();
      return;
    }
    const appText = app.textContent || '';
    const label = /CONTINUE\s+CAREER/i.test(appText)
      ? 'CONTINUE CAREER'
      : /START\s+NEW\s+CAREER/i.test(appText)
        ? 'START NEW CAREER'
        : '';
    if (!label) {
      marker?.remove();
      return;
    }
    if (marker) {
      marker.textContent = label;
      return;
    }
    const el = document.createElement('span');
    el.dataset.ribMainMarker = 'true';
    el.textContent = label;
    el.hidden = true;
    screen.appendChild(el);
  };
  const start = () => {
    sync();
    new MutationObserver(sync).observe(document.getElementById('app') || document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
