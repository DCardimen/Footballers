(() => {
  'use strict';

  const MENU_ID = 'rib-main-menu-v2';
  const BODY_CLASS = 'rib-menu-open';
  const previewMode = new URLSearchParams(location.search).has('menuPreview');
  let lastFingerprint = '';
  let syncing = false;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);

  const numeric = (value, fallback = 0) => {
    const match = String(value ?? '').replace(/,/g, '').match(/-?\d+/);
    return match ? Number(match[0]) : fallback;
  };

  const visibleScreen = () => {
    const screens = [...document.querySelectorAll('#app .screen')];
    return screens.find((el) => !el.classList.contains('hidden')) || screens[0] || null;
  };

  const isMainMenu = () => {
    if (previewMode) return true;
    const screen = visibleScreen();
    if (!screen || !screen.querySelector('.hero')) return false;
    return /(CONTINUE\s+CAREER|START\s+NEW\s+CAREER)/i.test(screen.textContent || '');
  };

  const valueByLabel = (text, labels, fallback = 0) => {
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const before = text.match(new RegExp('(\\d[\\d,]*)\\s*' + escaped, 'i'));
      if (before) return numeric(before[1], fallback);
      const after = text.match(new RegExp(escaped + '\\s*(\\d[\\d,]*)', 'i'));
      if (after) return numeric(after[1], fallback);
    }
    return fallback;
  };

  const textFrom = (root, selectors) => {
    for (const selector of selectors) {
      const el = root?.querySelector(selector);
      const text = el?.textContent?.trim();
      if (text) return text;
    }
    return '';
  };

  function readMenuData() {
    if (previewMode) {
      return {
        hasCareer: true,
        playerName: 'Kaden Fox',
        league: 'Youth League',
        position: 'QB',
        height: `6'7"`,
        weight: '241 lb',
        overall: 63,
        stars: 4,
        prestige: 11,
        careers: 16,
        nflReached: 1,
        interstellar: 208,
        hallPoints: 190,
        iconicMoments: 47,
        topCurrency: 70,
      };
    }

    const screen = visibleScreen();
    const screenText = (screen?.innerText || '').replace(/\u00a0/g, ' ');
    const continueCard = screen?.querySelector('.continue-card') || screen?.querySelector('[class*="continue"]');
    const cardText = (continueCard?.innerText || '').replace(/\u00a0/g, ' ');
    const hasCareer = /CONTINUE\s+CAREER/i.test(screenText) && !!continueCard;

    let playerName = textFrom(continueCard, ['.pname', '[class*="name"]']);
    if (!playerName) {
      const lines = cardText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
      playerName = lines.find((line) =>
        !/CONTINUE|OVR|LEAGUE|QB|RB|WR|TE|OL|DL|LB|CB|SAFETY|PRESTIGE/i.test(line) &&
        /[A-Za-z]/.test(line) && line.length > 3
      ) || 'YOUR PLAYER';
    }

    const overall = numeric(textFrom(continueCard, ['.continue-ovr', '.ovr-big', '[class*="ovr"]']), 0);
    const position = (cardText.match(/\b(QB|RB|WR|TE|OL|DL|LB|CB|S)\b/i)?.[1] || 'QB').toUpperCase();
    const league = cardText.match(/(?:Youth League|Grade School|Middle School|High School(?:\s+(?:JV|Varsity))?|College|NFL|Pro League)/i)?.[0] || 'Career';
    const measure = cardText.match(/(\d\s*['’]\s*\d(?:\s*["”])?)\s*(?:[|·•—-]\s*)?(\d{2,3}\s*lb)/i);
    const height = measure?.[1]?.replace(/\s+/g, '') || '';
    const weight = measure?.[2]?.replace(/\s+/g, ' ') || '';
    const stars = Math.max(0, Math.min(5, (cardText.match(/★/g) || []).length || Math.round(overall / 20)));

    const topbarText = (document.querySelector('#app .topbar')?.innerText || '').replace(/,/g, '');
    const prestige = valueByLabel(screenText, ['PRESTIGE'], numeric(document.querySelector('.prestige-chip')?.textContent, 0));

    return {
      hasCareer,
      playerName: hasCareer ? playerName : 'BUILD YOUR PLAYER',
      league: hasCareer ? league : 'Begin at age 3',
      position: hasCareer ? position : '—',
      height,
      weight,
      overall: hasCareer ? overall : 0,
      stars: hasCareer ? stars : 0,
      prestige,
      careers: valueByLabel(screenText, ['CAREERS', 'CAREER RUNS'], 0),
      nflReached: valueByLabel(screenText, ['NFL REACHED', 'NFL CAREERS'], 0),
      interstellar: valueByLabel(screenText, ['INTERSTELLAR', 'SUMMITS'], 0),
      hallPoints: valueByLabel(screenText, ['HALL OF FAME POINTS', 'HALL POINTS', 'HOF POINTS'], 0),
      iconicMoments: valueByLabel(screenText, ['ICONIC MOMENTS', 'GOALS'], 0),
      topCurrency: numeric(topbarText, prestige),
    };
  }

  const icon = (name) => {
    const icons = {
      stopwatch: '<path d="M9 2h6M12 8v4l3 2M7 4l-2 2M17 4l2 2"/><circle cx="12" cy="13" r="7"/>',
      coin: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
      star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>',
      bolt: '<path d="m13 2-8 12h6l-1 8 9-13h-6Z"/>',
      laurel: '<path d="M9 19c-3-2-5-5-5-9M15 19c3-2 5-5 5-9M7 6 4 4M6 10 2 9M8 15l-3 1M17 6l3-2M18 10l4-1M16 15l3 1"/><path d="M9 19h6"/>',
      target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="m12 12 7-7M16 5h3v3"/>',
      shield: '<path d="M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6Z"/><path d="m8 12 2.5 2.5L16 9"/>',
      helmet: '<path d="M5 16v-4a7 7 0 0 1 14 0v3h-5v4H9v-3Z"/><path d="M14 15h6v3h-4"/>',
      hall: '<path d="m3 9 9-5 9 5M5 10h14M6 10v8M10 10v8M14 10v8M18 10v8M4 19h16M3 22h18"/>',
      jersey: '<path d="m8 4-5 3 3 5 2-1v10h8V11l2 1 3-5-5-3c-1 2-7 2-8 0Z"/><path d="M11 10h2v5h-2z"/>',
      gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.star}</svg>`;
  };

  const navButton = (action, iconName, label, className = '') => `
    <button class="rib-nav-button ${className}" type="button" data-rib-action="${action}">
      <span class="rib-nav-icon">${icon(iconName)}</span>
      <span>${esc(label)}</span>
    </button>`;

  function renderMenu(data) {
    const filledStars = '★'.repeat(data.stars);
    const emptyStars = '★'.repeat(Math.max(0, 5 - data.stars));
    const measurement = [data.height, data.weight].filter(Boolean).join('  |  ');
    const primaryLabel = data.hasCareer ? 'CONTINUE CAREER' : 'START NEW CAREER';
    const primaryAction = data.hasCareer ? 'continue' : 'new';

    return `
      <div class="rib-menu-shell" role="main" aria-label="Running It Back main menu">
        <div class="rib-menu-hud">
          <div class="rib-hud-left">
            <span class="rib-hud-pill">${icon('stopwatch')}</span>
            <span class="rib-hud-coin">${icon('coin')}</span>
          </div>
          <span class="rib-hud-value">${esc(data.topCurrency)}</span>
        </div>

        <div class="rib-menu-hero" aria-label="Running It Back">
          <div class="rib-stadium-lines"></div>
          <div class="rib-floodlight rib-floodlight-left"></div>
          <div class="rib-floodlight rib-floodlight-right"></div>
          <div class="rib-hero-player" aria-hidden="true">
            <svg viewBox="0 0 180 260">
              <defs>
                <linearGradient id="ribPlayerShade" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#25344b"/>
                  <stop offset=".35" stop-color="#0b1524"/>
                  <stop offset="1" stop-color="#020711"/>
                </linearGradient>
                <radialGradient id="ribHelmetGlow" cx="35%" cy="25%" r="70%">
                  <stop offset="0" stop-color="#40516a" stop-opacity=".72"/>
                  <stop offset=".38" stop-color="#172337" stop-opacity=".9"/>
                  <stop offset="1" stop-color="#030812"/>
                </radialGradient>
              </defs>
              <path d="M68 16c34-13 69 5 76 39 4 18-1 35-8 48l-60-2c-15-18-20-37-13-58 2-10 4-17 5-27Z" fill="url(#ribHelmetGlow)" stroke="#40516a" stroke-opacity=".55"/>
              <path d="M66 67c18-12 56-16 77-4M69 74c20-8 48-10 70-4M66 81l10 3v30m63-39-11 5v36M76 87l56-5 20 16-13 8-62-2Z" fill="none" stroke="#77879c" stroke-opacity=".55" stroke-width="3"/>
              <path d="M79 101c-2 26-12 32-27 41-23 14-32 52-36 104h151c-3-47-13-85-39-101-14-9-25-16-27-44Z" fill="url(#ribPlayerShade)" stroke="#1e2c40"/>
              <path d="M44 148c28 18 68 19 99 1M35 175c35 17 82 19 120-1M99 108c-3 29-1 68 5 101" fill="none" stroke="#52647d" stroke-opacity=".32" stroke-width="2"/>
              <path d="M137 152c18 8 31 25 37 50l-8 44h-26l-1-47-16-28Z" fill="#050b14"/>
              <path d="M55 145c-20 8-33 26-39 55l4 46h28l4-50 17-27Z" fill="#07101d"/>
            </svg>
          </div>
          <div class="rib-hero-mark"><span>★ ★ ★</span><b>RIB</b></div>
          <div class="rib-hero-wordmark"><span>RUNNING</span><strong>IT BACK</strong></div>
          <div class="rib-hero-tagline">BUILD A PLAYER. EARN EVERY REP. CHASE THE LEAGUE.</div>
        </div>

        <div class="rib-menu-content">
          <section class="rib-career-card" data-rib-action="${primaryAction}" tabindex="0" role="button">
            <div class="rib-career-copy">
              <div class="rib-career-label"><i></i>${esc(primaryLabel)}</div>
              <div class="rib-player-name">${esc(data.playerName)}</div>
              <div class="rib-player-meta">
                <span>${esc(data.league)}</span><b></b><span>${esc(data.position)}</span>${measurement ? `<b></b><span>${esc(measurement)}</span>` : ''}
              </div>
              <div class="rib-stars"><span>${filledStars}</span><em>${emptyStars}</em></div>
            </div>
            <div class="rib-ovr-ring">
              <div class="rib-ovr-value">${esc(data.overall)}</div>
              <div class="rib-ovr-label">OVR</div>
            </div>
            <div class="rib-card-dots" aria-hidden="true"></div>
          </section>

          <section class="rib-legacy-card">
            <div class="rib-section-title"><span></span><b>YOUR LEGACY</b><span></span></div>
            <div class="rib-legacy-grid">
              <div class="rib-legacy-stat rib-gold"><i>${icon('star')}</i><strong>${esc(data.prestige)}</strong><small>PRESTIGE</small></div>
              <div class="rib-legacy-stat"><strong>${esc(data.careers)}</strong><small>CAREERS</small></div>
              <div class="rib-legacy-stat rib-green"><strong>${esc(data.nflReached)}</strong><small>NFL REACHED</small></div>
              <div class="rib-legacy-stat rib-purple"><i>${icon('bolt')}</i><strong>${esc(data.interstellar)}</strong><small>INTERSTELLAR</small></div>
              <div class="rib-legacy-stat"><i>${icon('laurel')}</i><strong>${esc(data.hallPoints)}</strong><small>HALL OF FAME POINTS</small></div>
              <div class="rib-legacy-stat rib-red"><i>${icon('target')}</i><strong>${esc(data.iconicMoments)}</strong><small>ICONIC MOMENTS</small></div>
            </div>
          </section>

          <button class="rib-primary-button" type="button" data-rib-action="${primaryAction}">
            <span>${esc(primaryLabel)}</span><b>›</b>
          </button>

          <div class="rib-secondary-grid">
            ${navButton('prestige', 'shield', 'PRESTIGE', 'rib-prestige-button')}
            ${navButton('new', 'helmet', 'NEW CAREER', 'rib-new-button')}
          </div>

          <div class="rib-bottom-grid">
            ${navButton('goals', 'target', 'GOALS', 'rib-goals-button')}
            ${navButton('hall', 'hall', 'HALL', 'rib-hall-button')}
            ${navButton('locker', 'jersey', 'LOCKER', 'rib-locker-button')}
            ${navButton('settings', 'gear', 'SETTINGS', 'rib-settings-button')}
          </div>
        </div>
      </div>`;
  }

  const actionMatchers = {
    continue: [/CONTINUE\s+CAREER/i],
    new: [/START\s+NEW\s+CAREER/i, /NEW\s+CAREER/i],
    prestige: [/^\s*PRESTIGE\s*$/i, /PRESTIGE/i, /\bPP\s*\+/],
    goals: [/^\s*GOALS\s*$/i],
    hall: [/^\s*HALL\s*$/i, /HALL\s+OF\s+FAME/i],
    locker: [/^\s*LOCKER\s*$/i],
    settings: [/^\s*SETTINGS\s*$/i],
  };

  function originalControl(action) {
    const roots = [visibleScreen(), document.querySelector('#app .bottom-nav'), document.querySelector('#app .topbar')].filter(Boolean);
    const candidates = roots.flatMap((root) => [...root.querySelectorAll('button, a, [onclick], [role="button"]')]);
    return candidates.find((el) => {
      const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      return actionMatchers[action]?.some((re) => re.test(text));
    }) || null;
  }

  function activate(action) {
    if (previewMode) return;
    const control = originalControl(action);
    if (!control) {
      console.warn('[RIB menu] Could not find original control for', action);
      return;
    }
    unmountMenu();
    requestAnimationFrame(() => {
      try {
        control.scrollIntoView({ block: 'center', inline: 'center' });
        control.click();
      } catch (error) {
        console.error('[RIB menu] Navigation failed', action, error);
      }
    });
  }

  function bindMenu(menu) {
    menu.addEventListener('click', (event) => {
      const target = event.target.closest('[data-rib-action]');
      if (target) activate(target.dataset.ribAction);
    });
    menu.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-rib-action]')) {
        event.preventDefault();
        activate(event.target.dataset.ribAction);
      }
    });
  }

  function mountMenu() {
    const data = readMenuData();
    const fingerprint = JSON.stringify(data);
    let menu = document.getElementById(MENU_ID);
    if (menu && fingerprint === lastFingerprint) return;

    if (!menu) {
      menu = document.createElement('div');
      menu.id = MENU_ID;
      document.body.appendChild(menu);
      bindMenu(menu);
    }

    menu.innerHTML = renderMenu(data);
    document.body.classList.add(BODY_CLASS);
    lastFingerprint = fingerprint;
  }

  function unmountMenu() {
    document.body.classList.remove(BODY_CLASS);
    document.getElementById(MENU_ID)?.remove();
    lastFingerprint = '';
  }

  function syncMenu() {
    if (syncing) return;
    syncing = true;
    requestAnimationFrame(() => {
      syncing = false;
      if (isMainMenu()) mountMenu();
      else unmountMenu();
    });
  }

  const start = () => {
    syncMenu();
    const root = document.getElementById('app') || document.body;
    new MutationObserver(syncMenu).observe(root, { childList: true, subtree: true, characterData: true });
    window.addEventListener('pageshow', syncMenu);
    window.addEventListener('popstate', syncMenu);
    setInterval(syncMenu, 900);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
