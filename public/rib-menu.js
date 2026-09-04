(() => {
  'use strict';
  /* ===== v89 MAIN MENU — the Bible layout, fed by the game's state =====
   * The menu is an overlay mounted over the legacy "menu" screen whenever that
   * screen is showing. v89 draws the reference mockup (art/menu/bible.jpg): a
   * top bar with the brand and the nav, the tunnel hero with the title, the
   * player card (helmet portrait, identity, OVR ring, archetype, quote), then
   * Continue Career / Season Progress, Your Legacy / Career Milestones, the six
   * nav tiles and a footer. Every number comes from window.__RIB_MENU_DATA_V89
   * (the game's own feed); the old text-scrape stays as the fallback so the
   * overlay still mounts on a page without the hook. Team colors tint the
   * jersey and helmet in the art, and the team emblem is composited onto the
   * helmet, so the pictures change with the career. */

  const MENU_ID = 'rib-main-menu-v2';
  const BODY_CLASS = 'rib-menu-open';
  const previewMode = new URLSearchParams(location.search).has('menuPreview');
  const ART = './public/menu/';
  let lastFingerprint = '';
  let mounted = false;
  let syncing = false;
  let countedUp = false;

  const prefersReduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  const whenAssetsReady = (fn) => {
    if (document.documentElement.classList.contains('rib-assets-ready')) { fn(); return; }
    const observer = new MutationObserver(() => {
      if (document.documentElement.classList.contains('rib-assets-ready')) { observer.disconnect(); fn(); }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  };

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
  const numeric = (value, fallback = 0) => { const m = String(value ?? '').replace(/,/g, '').match(/-?\d+/); return m ? Number(m[0]) : fallback; };

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

  // ---- the feed ------------------------------------------------------------
  const JERSEY = { QB: [1, 19], RB: [20, 49], WR: [10, 19], TE: [80, 89], OL: [50, 79], DL: [90, 99], LB: [40, 59], CB: [20, 39], S: [20, 39] };
  const jerseyFor = (name, pos) => {   // stable per name: the game rolls a fresh number per game, the menu should not
    const r = JERSEY[pos] || [1, 99]; let h = 7;
    for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return r[0] + (h % (r[1] - r[0] + 1));
  };
  const BADGE_FOR = [   // trait → the gold badge that says it
    [/leader|captain|rally|team/i, 'crown'], [/speed|burst|quick|fast|twitch|explos/i, 'shoe'], [/clutch|x-factor|ice|big.?game|showman/i, 'lightning'],
    [/iron|frame|durab|tough|bones|body/i, 'shield'], [/iq|film|study|aware|smart|coach|read/i, 'brain'], [/vision|eye|scan|see/i, 'eye'],
    [/power|strength|hammer|physical|grind|rat/i, 'fist'], [/patien|late|slow|clock|time|loom/i, 'clock'], [/accura|precis|target|hunter|sniper/i, 'target'],
  ];
  const badgeFor = (text, fallback) => (BADGE_FOR.find(([re]) => re.test(text)) || [null, fallback])[1];
  const POS_PERKS = { QB: ['ACCURACY', 'FOOTWORK', 'LEADERSHIP'], RB: ['VISION', 'BURST', 'BALANCE'], WR: ['HANDS', 'ROUTES', 'SPEED'], TE: ['HANDS', 'BLOCKING', 'STRENGTH'],
    OL: ['ANCHOR', 'FOOTWORK', 'POWER'], DL: ['GET-OFF', 'POWER', 'MOTOR'], LB: ['READS', 'RANGE', 'TACKLING'], CB: ['SPEED', 'HIPS', 'BALL SKILLS'], S: ['RANGE', 'READS', 'HITTING'] };
  const POS_ARCH = { QB: 'FIELD GENERAL', RB: 'WORKHORSE', WR: 'PLAYMAKER', TE: 'MISMATCH', OL: 'ROAD GRADER', DL: 'TRENCH KING', LB: 'ENFORCER', CB: 'LOCKDOWN', S: 'CENTERFIELDER' };
  const QUOTES = {
    prodigy: 'BORN FOR THE BRIGHT LIGHTS.', 'walk-on': 'EVERY SNAP IS EARNED.', 'injury-prone': 'THE BODY IS THE JOB.', 'blue-collar': 'OUTWORK THE ROOM.',
    hometown: 'PLAY FOR THE NAME ON THE FRONT.', legacy: 'THE NAME CAME WITH EXPECTATIONS.', default: 'POTENTIAL TURNS INTO LEGACY.',
  };
  const STAT_TILES = {
    QB: [['pass', 'PASS YDS'], ['td', 'TD'], ['int', 'INT']], RB: [['rush', 'RUSH YDS'], ['td', 'TD'], ['carries', 'CAR']],
    WR: [['rec_c', 'REC'], ['rec', 'REC YDS'], ['td', 'TD']], TE: [['rec_c', 'REC'], ['rec', 'REC YDS'], ['td', 'TD']],
    OL: [['pancake', 'PANCAKES'], ['sackAllowed', 'SACKS ALL'], ['tackle', 'TKL']], DL: [['tackle', 'TKL'], ['sack', 'SACK'], ['tfl', 'TFL']],
    LB: [['tackle', 'TKL'], ['sack', 'SACK'], ['int', 'INT']], CB: [['tackle', 'TKL'], ['pd', 'PD'], ['int', 'INT']], S: [['tackle', 'TKL'], ['pd', 'PD'], ['int', 'INT']],
  };

  function previewData() {
    return { hasCareer: true, state: { prestige: 38, pp: 70, careers: 18, nflReached: 1, interstellar: 0, hallBest: 0, enshrined: 4, challenges: 0, challengesOf: 12 },
      player: { name: 'Amari Fox', pos: 'QB', level: 2, levelName: 'Middle School', age: 13, stars: 5, ovr: 72, height: `6'4"`, weight: '188 lb',
        archetype: { id: 'prodigy', name: 'Field General' }, traits: [{ id: 'bigGameHunter', name: 'Accuracy' }, { id: 'gymRat', name: 'Footwork' }, { id: 'bornLeader', name: 'Leadership' }],
        totalSeasons: 0, objectives: [
          { id: 'a', title: 'Win your first game', done: true, reward: 2 }, { id: 'b', title: 'Throw for 300+ yards', done: true, reward: 2 }, { id: 'c', title: '3+ TD passes', done: true, reward: 2 },
          { id: 'd', title: 'Win your conference', done: false, reward: 3 }, { id: 'e', title: 'Reach the state championship', done: false, reward: 3 }, { id: 'f', title: 'Get drafted to the NFL', done: false, reward: 5 }] },
      season: { games: 12, played: 3, weeks: [{ played: true, won: true }, { played: true, won: true }, { played: true, won: true }], inProgress: true,
        last: { won: true, us: 28, them: 17, opp: 'Central High', stat: { pass: 312, td: 3, int: 0 } }, nextOpp: 'Westlake Wildcats', nextWeek: 4 },
      team: { school: 'Westfield State', name: 'Storm', colors: ['#1a2a44', '#e8c86a'], logo: null, logoCss: '' } };
  }

  function scrapeFallback() {
    const screen = visibleScreen();
    const screenText = (screen?.textContent || '').replace(/ /g, ' ');
    const card = screen?.querySelector('.continue-card') || screen?.querySelector('[class*="continue"]');
    const cardText = (card?.textContent || '').replace(/ /g, ' ');
    const hasCareer = /CONTINUE\s+CAREER/i.test(screenText) && !!card;
    const name = (card?.querySelector('.pname')?.textContent || '').trim() || 'YOUR PLAYER';
    const ovr = numeric(card?.querySelector('.continue-ovr')?.textContent, 0);
    const pos = (cardText.match(/\b(QB|RB|WR|TE|OL|DL|LB|CB|S)\b/)?.[1] || 'QB');
    return { hasCareer, state: { prestige: numeric((screenText.match(/★\s*(\d+)/) || [])[1], 0), pp: 0, careers: 0, nflReached: 0, interstellar: 0, hallBest: 0, enshrined: 0, challenges: 0, challengesOf: 0 },
      player: hasCareer ? { name, pos, level: 0, levelName: (cardText.match(/(Pee Wee|Youth League|Middle School|JV|Varsity|College|NFL Combine|The NFL|Interstellar League)/) || [])[1] || 'Career', stars: (cardText.match(/★/g) || []).length, ovr, height: '', weight: '', traits: [], objectives: [], totalSeasons: 0 } : null,
      season: { games: 0, played: 0, weeks: [], inProgress: false, last: null }, team: { school: '', name: '', colors: null, logo: null, logoCss: '' } };
  }

  function readMenuData() {
    if (previewMode) return previewData();
    let d = null;
    try { d = typeof window.__RIB_MENU_DATA_V89 === 'function' ? window.__RIB_MENU_DATA_V89() : null; } catch (e) { d = null; }
    if (!d) d = scrapeFallback();
    // the legacy screen decides whether a career exists (its text is the source of truth for the CTA)
    const screen = visibleScreen();
    const screenText = (screen?.textContent || '');
    if (!previewMode && screen && /START\s+NEW\s+CAREER/i.test(screenText) && !/CONTINUE\s+CAREER/i.test(screenText)) d.hasCareer = false;
    return d;
  }

  // ---- pieces ----------------------------------------------------------------
  const svg = (name) => {
    const P = {
      star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>',
      helmet: '<path d="M5 16v-4a7 7 0 0 1 14 0v3h-5v4H9v-3Z"/><path d="M14 15h6v3h-4"/>',
      crown: '<path d="M3 18h18l-2-10-4 4-3-6-3 6-4-4Z"/><path d="M4 21h16"/>',
      gem: '<path d="M6 3h12l4 6-10 12L2 9Z"/><path d="M2 9h20M9 3l3 18M15 3l-3 18"/>',
      laurel: '<path d="M9 19c-3-2-5-5-5-9M15 19c3-2 5-5 5-9M7 6 4 4M6 10 2 9M8 15l-3 1M17 6l3-2M18 10l4-1M16 15l3 1"/><path d="M9 19h6"/>',
      target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="m12 12 7-7M16 5h3v3"/>',
      check: '<path d="m5 12 4.5 4.5L19 7"/>',
      chev: '<path d="m9 5 7 7-7 7"/>',
      x: '<path d="M6 6l12 12M18 6 6 18"/>',
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${P[name] || P.star}</svg>`;
  };
  // a tint is placed in IMAGE units (center x/y, radius x/y as fractions of the picture);
  // layoutArt() maps them onto the rendered, object-fit:cover crop in pixels
  const tint = (colors, cx, cy, rx, ry) => colors && colors[0]
    ? `<div class="rib9-tint" data-tint="${cx},${cy},${rx},${ry}" style="--tp:${esc(colors[0])}"></div>` : '';
  const surname = (name) => (String(name || '').trim().split(/\s+/).pop() || '').toUpperCase();
  const initial = (name) => (String(name || '').trim()[0] || 'R').toUpperCase();
  const record = (season) => { const w = season.weeks.filter(x => x.played); const won = w.filter(x => x.won).length; return `${won}-${w.length - won}`; };

  function perks(data) {
    const pl = data.player, base = POS_PERKS[pl.pos] || POS_PERKS.QB;
    const tr = (pl.traits || []).slice(0, 3);
    const out = [];
    for (let i = 0; i < 3; i++) {
      const t = tr[i];
      const label = t ? t.name.toUpperCase() : base[i];
      const badge = t ? badgeFor(t.id + ' ' + t.name + ' ' + (t.desc || ''), ['target', 'shoe', 'crown'][i]) : ['target', 'shoe', 'crown'][i];
      out.push({ label, badge });
    }
    return out;
  }

  function seasonDots(season) {
    const n = Math.max(season.games || 0, season.weeks.length, 1);
    const dots = [];
    const firstOpen = season.weeks.findIndex(w => !w.played);
    for (let i = 0; i < n; i++) {
      const w = season.weeks[i];
      let cls = 'up', inner = '';
      if (w && w.played) { cls = w.sat ? 'sat' : w.won ? 'won' : 'lost'; inner = w.sat ? '' : svg(w.won ? 'check' : 'x'); }
      else if (i === (firstOpen < 0 ? season.weeks.length : firstOpen) && season.inProgress) cls = 'now';
      dots.push(`<i class="rib9-dot ${cls}" title="Game ${i + 1}${w && w.played ? ' · ' + (w.won ? 'W' : 'L') + ' ' + w.us + '-' + w.them + ' vs ' + esc(w.opp || '') : ''}">${inner}</i>`);
    }
    return dots.join('<span class="rib9-dotline"></span>');
  }

  function milestones(data) {
    const objs = (data.player && data.player.objectives) || [];
    const ordered = [...objs.filter(o => o.mine), ...objs.filter(o => !o.mine)];
    const done = ordered.filter(o => o.done).slice(0, 3);
    const todo = ordered.filter(o => !o.done).slice(0, 6 - done.length);
    const list = [...done, ...todo].slice(0, 6);
    if (!list.length) return '<div class="rib9-empty">Start a career to open the milestone board.</div>';
    return list.map(o => `<div class="rib9-ms ${o.done ? 'done' : ''}"><i>${o.done ? svg('check') : ''}</i><span>${esc(o.title)}</span><small>${o.done ? 'DONE' : '+' + esc(o.reward || 0) + ' LT'}</small></div>`).join('');
  }

  function latestGame(data) {
    const s = data.season, pl = data.player;
    if (!s.last) return `<div class="rib9-latest rib9-latest-empty"><div class="rib9-kicker">LATEST GAME</div><div class="rib9-empty">No game played yet — Week ${esc(s.nextWeek || 1)} is up.</div></div>`;
    const L = s.last, st = L.stat || {};
    const tiles = (STAT_TILES[pl.pos] || STAT_TILES.QB).map(([k, lab]) => `<div class="rib9-stat"><b>${esc(st[k] == null ? 0 : st[k])}</b><small>${esc(lab)}</small></div>`).join('');
    return `<div class="rib9-latest" data-rib-action="view:stats" role="button" tabindex="0"><div class="rib9-kicker">LATEST GAME</div>
      <div class="rib9-latest-row"><span class="rib9-wl ${L.sat ? 'dnp' : L.won ? 'w' : 'l'}">${L.sat ? 'DNP' : L.won ? 'W' : 'L'}</span>
        <div class="rib9-score"><b>${esc(L.us)} - ${esc(L.them)}</b><small>vs ${esc(L.opp || 'opponent')}</small></div>
        <div class="rib9-stats">${tiles}</div><span class="rib9-chev">${svg('chev')}</span></div></div>`;
  }

  function renderMenu(data) {
    const S = data.state || {}, pl = data.player, season = data.season || { weeks: [], games: 0, played: 0 }, team = data.team || {};
    const has = !!(data.hasCareer && pl);
    const colors = team.colors && team.colors.length ? team.colors : null;
    const num = has ? jerseyFor(pl.name, pl.pos) : 7;
    const careerView = has ? (season.inProgress ? 'season' : 'hub') : null;
    const year = has ? (pl.totalSeasons || 0) + 1 : 1;
    const week = has ? (season.nextWeek || season.played + 1) : 1;
    const arch = has ? ((pl.archetype && pl.archetype.name) || POS_ARCH[pl.pos] || 'PROSPECT').toUpperCase() : 'PROSPECT';
    const quote = has ? (QUOTES[(pl.archetype && pl.archetype.id) || 'default'] || QUOTES.default) : 'EVERY LEGEND HAS A FIRST SNAP.';
    const pk = has ? perks(data) : [];
    const stars = has ? Math.max(0, Math.min(5, pl.stars || 0)) : 0;
    const tile = (action, icon, label, sub, cls = '') => `<button class="rib9-tile ${cls}" type="button" data-rib-action="${action}"><img src="${ART}${icon}.webp" alt="" loading="lazy"><b>${label}</b><small>${sub}</small></button>`;
    const navLink = (action, label, active) => `<button class="rib9-navlink ${active ? 'on' : ''}" type="button" data-rib-action="${action}">${label}</button>`;

    return `
      <div class="rib9-shell" role="main" aria-label="Running It Back main menu">
        <header class="rib9-topbar">
          <div class="rib9-brand"><span class="rib9-mark">RIB</span><div><b>RUNNING IT BACK</b><small>CAREER MODE</small></div></div>
          <nav class="rib9-nav" aria-label="Main">
            ${navLink('home', 'HOME', true)}${navLink(has ? 'continue' : 'new', 'CAREER')}${navLink('goals', 'GOALS')}${navLink('hall', 'HALL')}${navLink('view:leaderboard', 'LEADERBOARDS')}${navLink('settings', 'SETTINGS')}
          </nav>
          <div class="rib9-motto">BUILD A PLAYER.<br>EARN EVERY REP.<br>CHASE THE LEAGUE.</div>
        </header>

        <section class="rib9-hero" aria-label="Running It Back">
          <img class="rib9-hero-img" src="${ART}hero_tunnel.webp" alt="" data-nat="1600,720" data-op="0.5,0.5">
          ${tint(colors, 0.49, 0.56, 0.17, 0.3)}${tint(colors, 0.49, 0.23, 0.06, 0.13)}
          <div class="rib9-hero-shade"></div>
          <div class="rib9-hero-copy"><h1>RUNNING<br><em>IT BACK</em></h1><p>SAME GAME.<br>DIFFERENT YOU.</p></div>
          ${has ? `<div class="rib9-hero-jersey" aria-hidden="true" data-at="0.49,0.43"${colors && colors[1] ? ` style="--ts:${esc(colors[1])}"` : ''}><b>${esc(surname(pl.name))}</b><span>${num}</span></div>` : ''}
          <div class="rib9-hero-slogan">DISCIPLINE<br>BUILDS<br>FREEDOM</div>
          <button class="rib9-prestige" type="button" data-rib-action="prestige">${svg('star')}<b data-rib-field="prestige">${esc(S.prestige || 0)}</b><small>PRESTIGE</small><i></i><b data-rib-field="pp">${esc(S.pp || 0)}</b><small>PP</small></button>
        </section>

        ${has ? `
        <section class="rib9-card rib9-player">
          <div class="rib9-portrait" data-rib-action="locker" role="button" tabindex="0">
            <img src="${ART}portrait_helmet.webp" alt="" data-nat="640,640" data-op="0.5,0.5">
            ${tint(colors, 0.5, 0.5, 0.72, 0.72)}
            ${team.logoCss ? `<span class="rib9-helmet-logo emblem-v44" style="${esc(team.logoCss)}"></span>` : ''}
            <span class="rib9-edit">✎ EDIT PLAYER</span>
          </div>
          <div class="rib9-identity">
            <div class="rib9-name" data-rib-field="playerName">${esc(String(pl.name).toUpperCase())}</div>
            <div class="rib9-meta"><span>${esc(pl.pos)}</span><i></i><span>#${num}</span>${pl.height ? `<i></i><span>${esc(pl.height)}</span>` : ''}${pl.weight ? `<i></i><span>${esc(pl.weight)}</span>` : ''}</div>
            <div class="rib9-stars">${'<b>★</b>'.repeat(stars)}${'<u>★</u>'.repeat(5 - stars)}</div>
            <button class="rib9-level" type="button" data-rib-action="view:hub">${esc(String(pl.levelName).toUpperCase())} <span>›</span></button>
          </div>
          <div class="rib9-ring" style="--rib-ovr:0"><div class="rib9-ring-val" data-rib-field="overall">${esc(pl.ovr)}</div><div class="rib9-ring-lab">OVR</div></div>
          <div class="rib9-arch">
            <div class="rib9-kicker">ARCHETYPE</div><div class="rib9-arch-name">${esc(arch)}</div>
            ${pk.map(p => `<div class="rib9-perk"><img src="${ART}badge_${p.badge}.webp" alt=""><span>${esc(p.label)}</span></div>`).join('')}
          </div>
          <div class="rib9-quote"><p>“${esc(quote)}”</p><span class="rib9-sig">${esc(initial(pl.name))}. ${esc(String(pl.name).split(/\s+/).pop() || '')}</span></div>
        </section>

        <div class="rib9-grid">
          <section class="rib9-card rib9-continue" data-rib-action="continue" role="button" tabindex="0">
            <img src="${ART}card_continue.webp" alt="" data-nat="1000,640" data-op="1,0.5">
            ${tint(colors, 0.77, 0.6, 0.15, 0.28)}${tint(colors, 0.76, 0.28, 0.07, 0.12)}
            <div class="rib9-continue-copy"><h2>CONTINUE<br>CAREER <span>›</span></h2><div class="rib9-yw">Year ${year} <i></i> Week ${week}</div><div class="rib9-vs">${season.nextOpp ? `vs ${esc(season.nextOpp)} (${record(season)})` : season.weeks.length ? `Season complete (${record(season)})` : `${esc(String(pl.levelName))} · Season ${pl.seasonsAtLevel + 1}`}</div></div>
          </section>
          <section class="rib9-card rib9-season">
            <div class="rib9-kicker">SEASON PROGRESS</div>
            <div class="rib9-progress" data-rib-action="view:${careerView}" role="button" tabindex="0"><div class="rib9-dots">${seasonDots(season)}</div><span class="rib9-games">${esc(season.played)} / ${esc(season.games)} GAMES</span></div>
            ${latestGame(data)}
          </section>
          <section class="rib9-card rib9-legacy">
            <div class="rib9-kicker">YOUR LEGACY</div>
            <div class="rib9-legacy-grid">
              <div class="rib9-lt gold"><i>${svg('star')}</i><b data-rib-field="prestige">${esc(S.prestige || 0)}</b><small>PRESTIGE</small></div>
              <div class="rib9-lt blue"><i>${svg('helmet')}</i><b data-rib-field="careers">${esc(S.careers || 0)}</b><small>CAREERS</small></div>
              <div class="rib9-lt green"><i>${svg('crown')}</i><b data-rib-field="nflReached">${esc(S.nflReached || 0)}</b><small>NFL REACHED</small></div>
              <div class="rib9-lt purple"><i>${svg('gem')}</i><b data-rib-field="interstellar">${esc(S.interstellar || 0)}</b><small>INTERSTELLAR</small></div>
              <div class="rib9-lt gold2"><i>${svg('laurel')}</i><b data-rib-field="hallPoints">${esc(S.hallBest || 0)}</b><small>HALL OF FAME POINTS</small></div>
              <div class="rib9-lt red"><i>${svg('target')}</i><b data-rib-field="iconicMoments">${esc(S.challenges || 0)}</b><small>ICONIC MOMENTS</small></div>
            </div>
          </section>
          <section class="rib9-card rib9-milestones" data-rib-action="goals" role="button" tabindex="0">
            <img class="rib9-trophy" src="${ART}card_trophy.webp" alt="">
            <div class="rib9-ms-copy"><div class="rib9-kicker">CAREER MILESTONES</div>${milestones(data)}</div>
            <div class="rib9-ms-plate">A HIGHER<br>STANDARD</div>
          </section>
        </div>` : `
        <section class="rib9-card rib9-player rib9-player-empty">
          <div class="rib9-portrait"><img src="${ART}portrait_helmet.webp" alt=""></div>
          <div class="rib9-identity">
            <div class="rib9-name" data-rib-field="playerName">BUILD YOUR PLAYER</div>
            <div class="rib9-meta"><span>PICK A POSITION</span><i></i><span>AGE 8</span><i></i><span>PEE WEE</span></div>
            <div class="rib9-stars"><u>★</u><u>★</u><u>★</u><u>★</u><u>★</u></div>
            <button class="rib9-level rib9-cta" type="button" data-rib-action="new">START NEW CAREER <span>›</span></button>
          </div>
          <div class="rib9-quote"><p>“${esc(quote)}”</p><span class="rib9-sig">R. I. B.</span></div>
        </section>
        <div class="rib9-grid">
          <section class="rib9-card rib9-legacy">
            <div class="rib9-kicker">YOUR LEGACY</div>
            <div class="rib9-legacy-grid">
              <div class="rib9-lt gold"><i>${svg('star')}</i><b data-rib-field="prestige">${esc(S.prestige || 0)}</b><small>PRESTIGE</small></div>
              <div class="rib9-lt blue"><i>${svg('helmet')}</i><b data-rib-field="careers">${esc(S.careers || 0)}</b><small>CAREERS</small></div>
              <div class="rib9-lt green"><i>${svg('crown')}</i><b data-rib-field="nflReached">${esc(S.nflReached || 0)}</b><small>NFL REACHED</small></div>
              <div class="rib9-lt purple"><i>${svg('gem')}</i><b data-rib-field="interstellar">${esc(S.interstellar || 0)}</b><small>INTERSTELLAR</small></div>
              <div class="rib9-lt gold2"><i>${svg('laurel')}</i><b data-rib-field="hallPoints">${esc(S.hallBest || 0)}</b><small>HALL OF FAME POINTS</small></div>
              <div class="rib9-lt red"><i>${svg('target')}</i><b data-rib-field="iconicMoments">${esc(S.challenges || 0)}</b><small>ICONIC MOMENTS</small></div>
            </div>
          </section>
          <section class="rib9-card rib9-milestones" data-rib-action="new" role="button" tabindex="0">
            <img class="rib9-trophy" src="${ART}card_trophy.webp" alt="">
            <div class="rib9-ms-copy"><div class="rib9-kicker">CAREER MILESTONES</div>${milestones(data)}</div>
            <div class="rib9-ms-plate">A HIGHER<br>STANDARD</div>
          </section>
        </div>`}

        <nav class="rib9-tiles" aria-label="Sections">
          ${tile(has ? 'view:' + careerView : 'new', 'icon_career', 'CAREER', has ? 'PLAY NEXT GAME' : 'START A CAREER', 'rib9-tile-hot')}
          ${tile(has ? 'view:upgrade' : 'new', 'icon_training', 'TRAINING', 'UPGRADE SKILLS')}
          ${tile('goals', 'icon_goals', 'GOALS', 'SET & TRACK')}
          ${tile('hall', 'icon_hall', 'HALL OF FAME', 'LEGACY STATS')}
          ${tile('locker', 'icon_locker', 'LOCKER', 'GEAR & APPEARANCE')}
          ${tile('settings', 'icon_settings', 'SETTINGS', 'GAME OPTIONS')}
        </nav>

        <footer class="rib9-footer">
          <div class="rib9-brand rib9-brand-sm"><span class="rib9-mark">RIB</span><b>RUNNING IT BACK</b><i></i><small>CAREER MODE</small></div>
          <button class="rib9-footlink" type="button" data-rib-action="view:highscore">⚡ SCORE ATTACK${S.highScore ? ' · BEST ' + esc(Number(S.highScore).toLocaleString()) : ''}</button>
          <div class="rib9-foot-tag">PLAY TODAY. A BETTER TOMORROW. <span></span></div>
        </footer>
      </div>`;
  }

  // ---- the art: tints and the jersey overlay follow the picture's crop ----------
  const coverBox = (img, holder) => {   // where an object-fit:cover picture actually sits inside its box
    const [nw, nh] = String(img.dataset.nat || '').split(',').map(Number);
    const [opx, opy] = String(img.dataset.op || '0.5,0.5').split(',').map(Number);
    const cw = holder.clientWidth, ch = holder.clientHeight;
    if (!nw || !nh || !cw || !ch) return null;
    const k = Math.max(cw / nw, ch / nh), iw = nw * k, ih = nh * k;
    return { x: (cw - iw) * opx, y: (ch - ih) * opy, w: iw, h: ih };
  };
  function layoutArt(menu) {
    for (const img of menu.querySelectorAll('img[data-nat]')) {
      const holder = img.parentElement, box = coverBox(img, holder);
      if (!box) continue;
      holder.style.setProperty('--ih', box.h.toFixed(1) + 'px');
      for (const t of holder.querySelectorAll(':scope > .rib9-tint')) {
        const [cx, cy, rx, ry] = String(t.dataset.tint).split(',').map(Number);
        t.style.setProperty('--mx', (box.x + cx * box.w).toFixed(1) + 'px'); t.style.setProperty('--my', (box.y + cy * box.h).toFixed(1) + 'px');
        t.style.setProperty('--mw', (rx * box.w).toFixed(1) + 'px'); t.style.setProperty('--mh', (ry * box.h).toFixed(1) + 'px');
      }
      for (const el of holder.querySelectorAll(':scope > [data-at]')) {
        const [ax, ay] = String(el.dataset.at).split(',').map(Number);
        el.style.setProperty('--jx', (box.x + ax * box.w).toFixed(1) + 'px'); el.style.setProperty('--jy', (box.y + ay * box.h).toFixed(1) + 'px');
      }
    }
  }
  let artRO = null;
  const watchArt = (menu) => {
    layoutArt(menu);
    requestAnimationFrame(() => layoutArt(menu));
    if (artRO) artRO.disconnect();
    if (window.ResizeObserver) { artRO = new ResizeObserver(() => layoutArt(menu)); for (const img of menu.querySelectorAll('img[data-nat]')) artRO.observe(img.parentElement); }
  };
  window.addEventListener('resize', () => { const m = document.getElementById(MENU_ID); if (m) layoutArt(m); });

  // ---- dynamic touches: the ring, the count-up --------------------------------
  function applyDynamic(menu, data, animateIn) {
    watchArt(menu);
    const ring = menu.querySelector('.rib9-ring');
    if (ring) {
      const overall = Math.max(0, Number(data.player && data.player.ovr) || 0);
      ring.style.setProperty('--rib-ovr-color', overall >= 85 ? '#ffe9a0' : overall >= 50 ? '#7ddc6e' : '#e8734a');
      const applyArc = () => ring.style.setProperty('--rib-ovr', String(Math.min(1, overall / 100)));
      if (animateIn && !prefersReduced()) whenAssetsReady(() => requestAnimationFrame(() => requestAnimationFrame(applyArc)));
      else applyArc();
    }
    if (!animateIn || countedUp || prefersReduced()) return;
    countedUp = true;
    whenAssetsReady(() => ['overall', 'prestige', 'careers', 'nflReached', 'interstellar', 'hallPoints', 'iconicMoments'].forEach((field, index) => {
      const els = [...menu.querySelectorAll(`[data-rib-field="${field}"]`)];
      const target = Number(els[0] && els[0].textContent.replace(/,/g, '')) || 0;
      if (!els.length || !target) return;
      const startAt = performance.now() + 320 + index * 60, duration = 620;
      const step = (now) => {
        if (!els[0].isConnected) return;
        if (now < startAt) { requestAnimationFrame(step); return; }
        const progress = Math.min(1, (now - startAt) / duration);
        const v = String(Math.round(target * (1 - Math.pow(1 - progress, 3))));
        for (const el of els) el.textContent = v;
        if (progress < 1) requestAnimationFrame(step);
      };
      for (const el of els) el.textContent = '0';
      requestAnimationFrame(step);
    }));
  }

  function bindMenu(menu) {
    // routing itself lives in rib-menu-navigation.js (capture phase); this is the press feedback
    menu.addEventListener('pointerdown', (event) => {
      const target = event.target.closest('[data-rib-action]');
      if (!target) return;
      target.classList.remove('rib-pressed'); void target.offsetWidth; target.classList.add('rib-pressed');
    });
    menu.addEventListener('animationend', (event) => { if (event.animationName === 'rib9press') event.target.classList.remove('rib-pressed'); });
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
      menu.innerHTML = renderMenu(data);
      menu.classList.add('rib-anim-in');
      applyDynamic(menu, data, true);
      mounted = true;
    } else {
      // a data change re-renders in place, without replaying the entrance
      const scrollTop = menu.scrollTop;
      menu.innerHTML = renderMenu(data);
      menu.classList.remove('rib-anim-in');
      menu.scrollTop = scrollTop;
      applyDynamic(menu, data, false);
    }
    menu.classList.toggle('rib-no-career', !data.hasCareer);
    document.body.classList.add(BODY_CLASS);
    lastFingerprint = fingerprint;
  }

  function unmountMenu() {
    document.body.classList.remove(BODY_CLASS);
    document.getElementById(MENU_ID)?.remove();
    lastFingerprint = '';
    mounted = false;
  }

  function syncMenu() {
    if (syncing) return;
    syncing = true;
    requestAnimationFrame(() => {
      syncing = false;
      if (isMainMenu()) mountMenu(); else unmountMenu();
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
  window.__RIB_MENU_V89 = { readMenuData, renderMenu, mountMenu, unmountMenu, jerseyFor, layoutArt };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
