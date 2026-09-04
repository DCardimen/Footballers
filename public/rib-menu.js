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
  const hashOf = (text) => { let h = 7; for (const ch of String(text || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  const jerseyFor = (name, pos) => {   // stable per name: the game rolls a fresh number per game, the menu should not
    const r = JERSEY[pos] || [1, 99];
    return r[0] + (hashOf(name) % (r[1] - r[0] + 1));
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
    prodigy: ['POTENTIAL TURNS INTO LEGACY.', 'BORN FOR THE BRIGHT LIGHTS.', 'THE HYPE WAS NEVER THE HARD PART.'],
    'walk-on': ['EVERY SNAP IS EARNED.', 'NOBODY HANDED ME THE JERSEY.', 'THEY COUNTED ME OUT. GOOD.'],
    'injury-prone': ['THE BODY IS THE JOB.', 'HEALTHY IS A SKILL.', 'STILL STANDING. STILL COMING.'],
    'blue-collar': ['OUTWORK THE ROOM.', 'FIRST ONE IN. LAST ONE OUT.', 'NO SHORTCUTS. NONE.'],
    hometown: ['PLAY FOR THE NAME ON THE FRONT.', 'THE WHOLE TOWN IS WATCHING.', 'THIS ONE IS FOR HOME.'],
    legacy: ['THE NAME OPENED THE DOOR. I KICKED IT IN.', 'MY OWN CHAPTER. MY OWN INK.', 'EXPECTATION IS JUST EARLY RESPECT.'],
    default: ['POTENTIAL TURNS INTO LEGACY.', 'THE WORK SHOWS UP ON SATURDAY.', 'PRESSURE IS A PRIVILEGE.', 'EARN IT AGAIN TOMORROW.'],
  };
  const quoteFor = (player) => {
    const pool = (QUOTES[(player.archetype && player.archetype.id) || 'default'] || QUOTES.default).concat(QUOTES.default);
    return pool[hashOf(String(player.name) + (player.pos || '')) % pool.length];
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
      helmet: '<path d="M4 14a8 8 0 0 1 16 0v1h-7v4H8a4 4 0 0 1-4-4Z"/><path d="M13 15h7v1.5a2.5 2.5 0 0 1-2.5 2.5H13Z"/><path d="M8 19h5"/>',
      crown: '<path d="M3 18h18l-2-10-4 4-3-6-3 6-4-4Z"/><path d="M4 21h16"/>',
      gem: '<path d="M6 3h12l4 6-10 12L2 9Z"/><path d="M2 9h20M9 3l3 18M15 3l-3 18"/>',
      laurel: '<path d="M11 20c-3.6-1.4-6-5-6.2-9.4M13 20c3.6-1.4 6-5 6.2-9.4"/><path d="M6.6 7.4c-1.1-.6-1.8-1.6-2-2.8 1.2-.1 2.3.4 3 1.3M5.6 11.6c-1.2-.3-2.2-1.1-2.7-2.2 1.1-.4 2.3-.2 3.2.5M7 15.6c-1.2.1-2.4-.4-3.2-1.3 1-.7 2.2-1 3.3-.6M17.4 7.4c1.1-.6 1.8-1.6 2-2.8-1.2-.1-2.3.4-3 1.3M18.4 11.6c1.2-.3 2.2-1.1 2.7-2.2-1.1-.4-2.3-.2-3.2.5M17 15.6c1.2.1 2.4-.4 3.2-1.3-1-.7-2.2-1-3.3-.6"/><path d="M9.6 20h4.8"/>',
      target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="m12 12 7-7M16 5h3v3"/>',
      check: '<path d="m5 12 4.5 4.5L19 7"/>',
      dash: '<path d="M6 12h12"/>',
      chev: '<path d="m9 5 7 7-7 7"/>',
      x: '<path d="M6 6l12 12M18 6 6 18"/>',
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${P[name] || P.star}</svg>`;
  };
  // a tint is placed in IMAGE units (center x/y, radius x/y as fractions of the picture);
  // layoutArt() maps them onto the rendered, object-fit:cover crop in pixels
  // a hex colour as hue / saturation / lightness, for the recolour filter
  const hsl = (hex) => {
    const m = String(hex || '').replace('#', ''); if (!/^[0-9a-f]{6}$/i.test(m)) return null;
    const r = parseInt(m.slice(0, 2), 16) / 255, g = parseInt(m.slice(2, 4), 16) / 255, b = parseInt(m.slice(4, 6), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let h = 0, sat = 0;
    if (d) { sat = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; }
    return { h, s: sat, l };
  };
  // the recolour: grey the picture, sepia it (a known warm hue of ~38°), swing that hue to the
  // team's, then set saturation and brightness from the team colour. Folds and texture survive
  // because they are the picture's own luminance.
  const recolorFilter = (hex) => {
    const c = hsl(hex); if (!c) return '';
    // sepia leaves the fabric at ~38° with mild saturation; the team's saturation and lightness
    // then set how far to push it. Shadows stay dark because contrast is applied after.
    const sat = Math.max(0.2, Math.min(5.5, c.s * 3.8));
    const bright = Math.max(0.4, Math.min(1.4, 0.66 + c.l * 0.78));
    return `grayscale(1) sepia(1) hue-rotate(${(c.h - 38).toFixed(0)}deg) saturate(${sat.toFixed(2)}) brightness(${bright.toFixed(2)}) contrast(1.12)`;
  };
  const tint = (colors, which, mask, strength = 1, src = '') => {
    const c = colors && (colors[which] || colors[0]);
    if (!c) return '';
    // the mask URL goes on the element itself: a url() inside a custom property resolves against
    // the stylesheet in Chrome and the document in Firefox, so neither relative form is safe there
    const url = `url(${ART}${mask}.webp)`;
    if (src) return `<img class="rib9-tint rib9-recolor" src="${ART}${src}.webp" alt="" data-mask="${mask}" style="--ts:${strength};-webkit-mask-image:${url};mask-image:${url};filter:${recolorFilter(c)}">`;
    const at = `data-mask="${mask}" style="--tp:${esc(c)};--ts:${strength};-webkit-mask-image:${url};mask-image:${url}"`;
    return `<div class="rib9-tint rib9-tint-hue" ${at}></div><div class="rib9-tint rib9-tint-shade" ${at}></div>`;
  };
  const RECOLOR = !new URLSearchParams(location.search).has('blendTint');   // ?blendTint renders the old blend-mode layers, for comparison
  // the emblem's sprite crop, restated as a mask so a shading layer can sit on the emblem alone
  const maskOf = (logoCss) => ['-webkit-mask-', 'mask-'].map(pre => String(logoCss).replace(/background-(image|repeat|size|position)/g, pre + '$1')).join(';');
  const surname = (name) => (String(name || '').trim().split(/\s+/).pop() || '').toUpperCase();
  const initial = (name) => (String(name || '').trim()[0] || 'R').toUpperCase();
  const record = (season) => { const w = season.weeks.filter(x => x.played); const won = w.filter(x => x.won).length; return `${won}-${w.length - won}`; };

  function perks(data) {
    const pl = data.player, base = POS_PERKS[pl.pos] || POS_PERKS.QB;
    const tr = (pl.traits || []).filter((t) => Number(t.good) > 0).slice(0, 3);   // good:-1 is a flaw, good:0 is mixed; neither wears gold
    const out = [];
    for (let i = 0; i < 3; i++) {
      const t = tr[i];
      const label = t ? t.name.toUpperCase() : base[i];
      const badge = t ? badgeFor(t.id + ' ' + t.name + ' ' + (t.desc || ''), ['target', 'shoe', 'crown'][i]) : ['target', 'shoe', 'crown'][i];
      out.push({ label, badge });
    }
    return out;
  }

  // the legacy panel: one tile per lifetime number, each with its own icon
  const LEGACY_TILES = [
    ['gold', 'star', 'prestige', 'PRESTIGE', (S) => S.prestige || 0],
    ['blue', 'helmet', 'careers', 'CAREERS', (S) => S.careers || 0],
    ['green', 'crown', 'nflReached', 'NFL REACHED', (S) => S.nflReached || 0],
    ['purple', 'gem', 'interstellar', 'INTERSTELLAR', (S) => S.interstellar || 0],
    ['gold2', 'laurel', 'hallPoints', 'HALL POINTS', (S) => S.hallBest || 0],
    ['red', 'target', 'iconicMoments', 'ICONIC MOMENTS', (S) => S.challenges || 0],
  ];
  const legacyPanel = (S) => `<section class="rib9-card rib9-legacy">
            <div class="rib9-kicker">YOUR LEGACY</div>
            <div class="rib9-legacy-grid">
              ${LEGACY_TILES.map(([cls, icon, field, label, read]) => `<div class="rib9-lt ${cls}"><i><img src="${ART}legacy_${icon}.webp" alt="" loading="lazy"></i><b data-rib-field="${field}">${esc(read(S))}</b><small>${label}</small></div>`).join('')}
            </div>
          </section>`;

  function seasonDots(season) {
    const n = Math.max(season.games || 0, season.weeks.length, 1);
    const dots = [];
    const firstOpen = season.weeks.findIndex(w => !w.played);
    for (let i = 0; i < n; i++) {
      const w = season.weeks[i];
      let cls = 'up', inner = '';
      if (w && w.played) { cls = w.sat ? 'sat' : w.won ? 'won' : 'lost'; inner = w.won ? svg('check') : w.sat ? svg('dash') : ''; }
      else if (i === (firstOpen < 0 ? season.weeks.length : firstOpen) && season.inProgress) cls = 'now';
      dots.push(`<i class="rib9-dot ${cls}" title="Game ${i + 1}${w && w.played ? ' · ' + (w.won ? 'W' : 'L') + ' ' + w.us + '-' + w.them + ' vs ' + esc(w.opp || '') : ''}">${inner}</i>`);
    }
    return dots.join('<span class="rib9-dotline"></span>');
  }

  function milestones(data) {
    const pl = data.player || {};
    const objs = pl.objectives || [];
    const ordered = [...objs.filter(o => o.mine), ...objs.filter(o => !o.mine)];
    const done = ordered.filter(o => o.done).slice(0, 3);
    // the pending half leads with this season's goals: they name a football task, not a career abstraction
    const seasonGoals = (pl.goals || []).filter(g => !g.done).map(g => ({ title: g.text, done: false, reward: 0, season: true }));
    const todo = [...seasonGoals, ...ordered.filter(o => !o.done)].slice(0, 6 - done.length);
    const list = [...done, ...todo].slice(0, 6);
    if (!list.length) return '<div class="rib9-empty">Start a career to open the milestone board.</div>';
    return list.map(o => {
      const right = o.done ? esc(o.at || 'DONE') : o.season ? 'SEASON' : o.reward ? '+' + esc(o.reward) + ' LT' : '';
      return `<div class="rib9-ms ${o.done ? 'done' : ''}"><i>${o.done ? svg('check') : ''}</i><span>${esc(o.title)}</span><small>${right}</small></div>`;
    }).join('');
  }

  function latestGame(data) {
    const s = data.season, pl = data.player;
    if (!s.last) return `<div class="rib9-latest rib9-latest-empty"><div class="rib9-kicker">LATEST GAME</div><div class="rib9-empty">No game played yet — Week ${esc(s.nextWeek || 1)} is up.</div></div>`;
    const L = s.last, st = L.stat || {};
    const scored = Number.isFinite(Number(L.us)) && Number.isFinite(Number(L.them)) && !(L.us === '' || L.them === '');
    const score = scored ? `${esc(L.us)} - ${esc(L.them)}` : '—';
    const right = L.sat
      ? '<div class="rib9-dnp">DID NOT PLAY</div>'
      : `<div class="rib9-stats">${(STAT_TILES[pl.pos] || STAT_TILES.QB).map(([k, lab]) => `<div class="rib9-stat"><b>${esc(st[k] == null ? 0 : st[k])}</b><small>${esc(lab)}</small></div>`).join('')}</div>`;
    return `<div class="rib9-latest" data-rib-action="view:stats" role="button" tabindex="0"><div class="rib9-kicker">LATEST GAME</div>
      <div class="rib9-latest-row"><span class="rib9-wl ${L.sat ? 'dnp' : L.won ? 'w' : 'l'}">${L.sat ? 'DNP' : L.won ? 'W' : 'L'}</span>
        <div class="rib9-score"><b>${score}</b><small>vs ${esc(L.opp || 'opponent')}</small></div>
        ${right}<span class="rib9-chev">${svg('chev')}</span></div></div>`;
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
    const quote = has ? quoteFor(pl) : 'EVERY LEGEND HAS A FIRST SNAP.';
    const pk = has ? perks(data) : [];
    const stars = has ? Math.max(0, Math.min(5, pl.stars || 0)) : 0;
    const tile = (action, icon, label, sub, cls = '') => `<button class="rib9-tile ${cls}" type="button" data-rib-action="${action}"><img src="${ART}${icon}.webp" alt="" loading="lazy"><b>${label}</b><small>${sub}</small></button>`;
    const tilesNav = `<nav class="rib9-tiles" aria-label="Sections">
          ${tile(has ? 'view:' + careerView : 'new', 'icon_career', 'CAREER', has ? 'PLAY NEXT GAME' : 'START A CAREER', 'rib9-tile-hot')}
          ${tile(has ? 'view:upgrade' : 'new', 'icon_training', 'TRAINING', 'UPGRADE SKILLS')}
          ${tile('goals', 'icon_goals', 'GOALS', 'SET & TRACK')}
          ${tile('hall', 'icon_hall', 'HALL OF FAME', 'LEGACY STATS')}
          ${tile('locker', 'icon_locker', 'LOCKER', 'GEAR & APPEARANCE')}
          ${tile('settings', 'icon_settings', 'SETTINGS', 'GAME OPTIONS')}
        </nav>`;
    const navLink = (action, label, active) => `<button class="rib9-navlink ${active ? 'on' : ''}" type="button" data-rib-action="${action}">${label}</button>`;

    return `
      <div class="rib9-shell" role="main" aria-label="Running It Back main menu">
        <header class="rib9-topbar">
          <div class="rib9-brand"><span class="rib9-mark">RIB</span><div><b>RUNNING IT BACK</b><small>CAREER MODE</small></div></div>
          <nav class="rib9-nav" aria-label="Main">
            ${navLink('home', 'HOME', true)}${navLink(has ? 'continue' : 'new', 'CAREER')}${navLink('goals', 'GOALS')}${navLink('hall', 'HALL')}${navLink('view:leaderboard', 'LEADERBOARDS')}${navLink('settings', 'SETTINGS')}
          </nav>
          <button class="rib9-prestige" type="button" data-rib-action="prestige" title="Prestige tree">${svg('star')}<b data-rib-field="prestige">${esc(S.prestige || 0)}</b><small>PRESTIGE</small><i></i><b data-rib-field="pp">${esc(S.pp || 0)}</b><small>PP</small></button>
          <div class="rib9-motto">BUILD A PLAYER.<br>EARN EVERY REP.<br>CHASE THE LEAGUE.</div>
        </header>

        <section class="rib9-hero" aria-label="Running It Back">
          <img class="rib9-hero-img" src="${ART}hero_tunnel.webp" alt="" data-nat="1600,914">
          ${tint(colors, 0, 'hero_mask_p', 1, RECOLOR && 'hero_tunnel')}${tint(colors, 1, 'hero_mask_s', 1, RECOLOR && 'hero_tunnel')}
          <div class="rib9-hero-lift" data-region="0.865,0.42,0.15,0.4"></div>
          <div class="rib9-hero-shade"></div>
          <div class="rib9-hero-copy"><h1><img src="${ART}logo_wordmark.webp" alt="Running It Back"></h1>
            <img class="rib9-swash" src="${ART}swash_underline.webp" alt=""></div>
          ${has ? `<div class="rib9-hero-jersey" aria-hidden="true" data-at="0.5,0.52"><b>${esc(surname(pl.name))}</b><span>${num}</span></div>` : ''}
        </section>

        ${has ? `
        <section class="rib9-card rib9-player">
          <div class="rib9-portrait" data-rib-action="locker" role="button" tabindex="0">
            <img src="${ART}portrait_helmet.webp" alt="" data-nat="640,640" data-op="0.5,0.5">
            ${tint(colors, 1, 'portrait_helmet_mask_s', 1, RECOLOR && 'portrait_helmet')}
            ${team.logoCss ? `<span class="rib9-helmet-logo emblem-v44" style="${esc(team.logoCss)}"><i class="rib9-helmet-shade" style="${esc(maskOf(team.logoCss))}"></i></span>` : ''}
            <span class="rib9-edit">✎ EDIT PLAYER</span>
          </div>
          <div class="rib9-identity">
            <div class="rib9-name" data-rib-field="playerName">${esc(String(pl.name).toUpperCase())}</div>
            <div class="rib9-meta"><span>${esc(pl.pos)}</span><i></i><span>#${num}</span>${pl.height ? `<i></i><span>${esc(pl.height)}</span>` : ''}${pl.weight ? `<i></i><span>${esc(pl.weight)}</span>` : ''}</div>
            <div class="rib9-stars">${'<b>★</b>'.repeat(stars)}${'<u>★</u>'.repeat(5 - stars)}</div>
            <button class="rib9-level" type="button" data-rib-action="view:hub">${esc(String(pl.levelName).toUpperCase())} <span>›</span></button>
          </div>
          <div class="rib9-ring" style="--rib-ovr:0"><div class="rib9-ring-val" data-rib-field="overall">${esc(pl.ovr)}</div><div class="rib9-ring-lab">OVR</div></div>
        </section>
        ${tilesNav}

        <div class="rib9-grid">
          <section class="rib9-card rib9-continue" data-rib-action="continue" role="button" tabindex="0">
            <img src="${ART}card_continue.webp" alt="" data-nat="1000,640">
            ${tint(colors, 0, 'card_continue_mask_p', 1, RECOLOR && 'card_continue')}${tint(colors, 1, 'card_continue_mask_s', 1, RECOLOR && 'card_continue')}
            <div class="rib9-hero-jersey rib9-card-jersey" aria-hidden="true" data-at="0.775,0.535"><b>${esc(surname(pl.name))}</b><span>${num}</span></div>
            <div class="rib9-continue-copy"><h2>CONTINUE<br>CAREER <span>${svg('chev')}</span></h2><div class="rib9-yw">Year ${year} <i></i> Week ${week}</div><div class="rib9-vs">${season.nextOpp ? `vs ${esc(season.nextOpp)} (${record(season)})` : season.weeks.length ? `Season complete (${record(season)})` : `${esc(String(pl.levelName))} · Season ${pl.seasonsAtLevel + 1}`}</div></div>
          </section>
          <section class="rib9-card rib9-season">
            <div class="rib9-kicker">SEASON PROGRESS</div>
            <div class="rib9-progress" data-rib-action="view:${careerView}" role="button" tabindex="0"><div class="rib9-dots">${seasonDots(season)}</div><span class="rib9-games">${esc(season.played)} / ${esc(season.games)} GAMES</span></div>
            ${latestGame(data)}
          </section>
          ${legacyPanel(S)}
          <section class="rib9-card rib9-milestones" data-rib-action="goals" role="button" tabindex="0">
            <img class="rib9-trophy" src="${ART}card_trophy.webp" alt="">
            <div class="rib9-ms-copy"><div class="rib9-kicker">CAREER MILESTONES</div>${milestones(data)}</div>
            <div class="rib9-ms-plate">A HIGHER<br>STANDARD</div>
          </section>
        </div>
        <section class="rib9-card rib9-archcard">
          <div class="rib9-arch">
            <div class="rib9-kicker">ARCHETYPE</div><div class="rib9-arch-name">${esc(arch)}</div>
            <div class="rib9-perks">${pk.map(p => `<div class="rib9-perk"><img src="${ART}badge_${p.badge}.webp" alt=""><span>${esc(p.label)}</span></div>`).join('')}</div>
          </div>
          <div class="rib9-quote"><p>${esc(quote)}</p><span class="rib9-sig">${esc(initial(pl.name))}. ${esc(String(pl.name).split(/\s+/).pop() || '')}</span></div>
        </section>` : `
        <section class="rib9-card rib9-player rib9-player-empty">
          <div class="rib9-portrait"><img src="${ART}portrait_helmet.webp" alt=""></div>
          <div class="rib9-identity">
            <div class="rib9-name" data-rib-field="playerName">BUILD YOUR PLAYER</div>
            <div class="rib9-meta"><span>PICK A POSITION</span><i></i><span>AGE 8</span><i></i><span>PEE WEE</span></div>
            <div class="rib9-stars"><u>★</u><u>★</u><u>★</u><u>★</u><u>★</u></div>
            <button class="rib9-level rib9-cta" type="button" data-rib-action="new">START NEW CAREER <span>›</span></button>
          </div>
        </section>
        ${tilesNav}
        <div class="rib9-grid">
          ${legacyPanel(S)}
          <section class="rib9-card rib9-milestones" data-rib-action="new" role="button" tabindex="0">
            <img class="rib9-trophy" src="${ART}card_trophy.webp" alt="">
            <div class="rib9-ms-copy"><div class="rib9-kicker">CAREER MILESTONES</div>${milestones(data)}</div>
            <div class="rib9-ms-plate">A HIGHER<br>STANDARD</div>
          </section>
        </div>`}

        <footer class="rib9-footer">
          <div class="rib9-brand rib9-brand-sm"><span class="rib9-mark">RIB</span><b>RUNNING IT BACK</b><i></i><small>CAREER MODE</small></div>
          <button class="rib9-footlink" type="button" data-rib-action="view:highscore">⚡ SCORE ATTACK${S.highScore ? ' · BEST ' + esc(Number(S.highScore).toLocaleString()) : ''}</button>
          <div class="rib9-foot-tag">PLAY TODAY. A BETTER TOMORROW. <span></span></div>
        </footer>
      </div>`;
  }

  // ---- the art: tints and the jersey overlay follow the picture's crop ----------
  const pctOf = (value) => { const v = String(value || '').trim(); return v.endsWith('%') ? parseFloat(v) / 100 : 0.5; };
  const coverBox = (img, holder) => {   // where an object-fit:cover picture actually sits inside its box
    const [nw, nh] = String(img.dataset.nat || '').split(',').map(Number);
    const op = getComputedStyle(img).objectPosition.split(/\s+/);   // the sheet owns the crop; read it, never restate it
    const opx = pctOf(op[0]), opy = pctOf(op.length > 1 ? op[1] : op[0]);
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
      for (const t of holder.querySelectorAll(':scope > [data-mask]')) {
        t.style.setProperty('--mx', box.x.toFixed(1) + 'px'); t.style.setProperty('--my', box.y.toFixed(1) + 'px');
        t.style.setProperty('--mw', box.w.toFixed(1) + 'px'); t.style.setProperty('--mh', box.h.toFixed(1) + 'px');
        if (t.tagName === 'IMG') { t.style.left = box.x.toFixed(1) + 'px'; t.style.top = box.y.toFixed(1) + 'px'; t.style.width = box.w.toFixed(1) + 'px'; t.style.height = box.h.toFixed(1) + 'px'; }
      }
      for (const t of holder.querySelectorAll(':scope > [data-region]')) {
        const [cx, cy, rx, ry] = String(t.dataset.region).split(',').map(Number);
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
      ring.style.setProperty('--rib-ovr-color', overall >= 150 ? '#ffe9a0' : overall >= 60 ? '#7ddc6e' : '#e8734a');
      // a young player is still a visible arc: an empty ring reads as a broken ring
      const applyArc = () => ring.style.setProperty('--rib-ovr', String(Math.max(0.055, Math.min(1, overall / 250))));   // a full circle is 250: ratings run past 99
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
  window.__RIB_MENU_V89 = { readMenuData, renderMenu, mountMenu, unmountMenu, jerseyFor, layoutArt, recolorFilter, hsl };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
