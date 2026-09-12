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
  // v104: the pictures and their masks keep their names from build to build, so a browser that
  // has seen the menu once keeps the OLD kit masks forever unless the URL moves. The baked build
  // stamp (`<meta name="rib-menu-build">`, set by scripts/bake-menu-into-index.mjs) rides every
  // art URL as a query, the same way it already rides the script and stylesheet links.
  const BUILD = (() => { try { return (document.querySelector('meta[name="rib-menu-build"]') || {}).content || ''; } catch (e) { return ''; } })();
  const ARTV = BUILD ? '?v=' + encodeURIComponent(BUILD) : '';
  // a url() handed to the stylesheet through a custom property resolves against the SHEET, not the
  // document — so the mask asks for it by its document-absolute address
  const artUrl = (file) => { try { return new URL(ART + file, document.baseURI).href; } catch (e) { return ART + file; } };
  /* ===== v106.1 THE PAGE KNOWS WHEN IT IS STALE ===== */
  // GitHub Pages tells a browser to keep index.html for ten minutes, and every menu file and every
  // kit mask is stamped by THAT page — so for ten minutes after a deploy a phone that just opens
  // the site shows the old menu wearing the old kit, and only a hard refresh gets it out. The
  // deploy writes the build's version into the page (<meta name="rib-build">, put there by
  // scripts/assemble-pages.mjs) and into rib-build.json beside it. On the menu's first mount the
  // page reads that json past every cache and, if the site has moved on, pulls the fresh page
  // into the cache and reloads ONCE — sessionStorage keeps the version it reloaded for, so a site
  // that keeps serving the old page cannot loop. Only at the menu, never mid-game; a page without
  // the meta (vite dev, a file: build) never asks, and ?stayStale holds the reload for a look.
  const FRESH = window.__RIB_FRESH_V106 = { mine: '', served: '', state: 'idle' };
  const freshV106 = () => {
    if (FRESH.state !== 'idle') return;
    const meta = document.querySelector('meta[name="rib-build"]'); FRESH.mine = (meta && meta.content) || '';
    if (!FRESH.mine || !/^https?:$/.test(location.protocol) || typeof fetch !== 'function') { FRESH.state = 'skipped'; return; }
    FRESH.state = 'asked';
    let url = './rib-build.json'; try { url = new URL(url, document.baseURI).href; } catch (e) {}
    fetch(url, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then(async (j) => {
      FRESH.served = (j && String(j.version || '')) || '';
      if (!FRESH.served || FRESH.served === FRESH.mine) { FRESH.state = 'fresh'; return; }
      let done = ''; try { done = sessionStorage.getItem('rib-fresh-v106') || ''; } catch (e) {}
      if (done === FRESH.served) { FRESH.state = 'gave-up'; return; }   // reloaded for this build already: the page is what it is
      try { sessionStorage.setItem('rib-fresh-v106', FRESH.served); } catch (e) {}
      FRESH.state = 'reloading';
      try { await fetch(location.href, { cache: 'reload' }); } catch (e) {}   // the fresh page into the cache the reload reads
      if (new URLSearchParams(location.search).has('stayStale')) { FRESH.state = 'held'; return; }
      location.reload();
    }).catch(() => { FRESH.state = 'error'; });
  };

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
    const url = `url(${ART}${mask}.webp${ARTV})`;
    if (src) return `<img class="rib9-tint rib9-recolor" src="${ART}${src}.webp${ARTV}" alt="" data-mask="${mask}" style="--ts:${strength};-webkit-mask-image:${url};mask-image:${url};filter:${recolorFilter(c)}">`;
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
              ${LEGACY_TILES.map(([cls, icon, field, label, read]) => `<div class="rib9-lt ${cls}"><i><img src="${ART}legacy_${icon}.webp${ARTV}" alt="" loading="lazy"></i><b data-rib-field="${field}">${esc(read(S))}</b><small>${label}</small></div>`).join('')}
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
    const tile = (action, icon, label, sub, cls = '') => `<button class="rib9-tile ${cls}" type="button" data-rib-action="${action}"><img src="${ART}${icon}.webp${ARTV}" alt="" loading="lazy"><b>${label}</b><small>${sub}</small></button>`;
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
          <div class="rib9-hero-art" style="position:absolute;inset:0"><!-- v104: the picture, its kit and the name breathe as ONE layer — the tints used to sit still under a picture scaling by 2%. v105: the box is set INLINE, so a stylesheet a cache held back (the old sheet has no rule for this layer) cannot collapse it and spill the kit -->
          <img class="rib9-hero-img" src="${ART}hero_tunnel.webp${ARTV}" alt="" data-nat="1600,914">
          ${tint(colors, 0, 'hero_mask_p', 1, RECOLOR && 'hero_tunnel')}${tint(colors, 1, 'hero_mask_s', 1, RECOLOR && 'hero_tunnel')}
          <div class="rib9-hero-lift" data-region="0.865,0.42,0.15,0.4"></div>
          ${has ? `<div class="rib9-hero-jersey" aria-hidden="true" data-at="0.5,0.52"><b>${esc(surname(pl.name))}</b><span>${num}</span></div>` : ''}
          </div>
          ${heroFxMarkup()}
          <div class="rib9-hero-shade"></div>
          <div class="rib9-hero-copy"><h1><img src="${ART}logo_wordmark.webp${ARTV}" alt="Running It Back"><i class="rib9-sheen" style="--wm:url('${artUrl('logo_wordmark.webp' + ARTV)}')"></i></h1>
            <img class="rib9-swash" src="${ART}swash_underline.webp${ARTV}" alt=""></div>
        </section>

        ${has ? `
        <section class="rib9-card rib9-player">
          <div class="rib9-portrait" data-rib-action="locker" role="button" tabindex="0">
            <img src="${ART}portrait_helmet.webp${ARTV}" alt="" data-nat="640,640" data-op="0.5,0.5">
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
            <img src="${ART}card_continue.webp${ARTV}" alt="" data-nat="1000,640">
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
            <img class="rib9-trophy" src="${ART}card_trophy.webp${ARTV}" alt="">
            <div class="rib9-ms-copy"><div class="rib9-kicker">CAREER MILESTONES</div>${milestones(data)}</div>
            <div class="rib9-ms-plate">A HIGHER<br>STANDARD</div>
          </section>
        </div>
        <section class="rib9-card rib9-archcard">
          <div class="rib9-arch">
            <div class="rib9-kicker">ARCHETYPE</div><div class="rib9-arch-name">${esc(arch)}</div>
            <div class="rib9-perks">${pk.map(p => `<div class="rib9-perk"><img src="${ART}badge_${p.badge}.webp${ARTV}" alt=""><span>${esc(p.label)}</span></div>`).join('')}</div>
          </div>
          <div class="rib9-quote"><p>${esc(quote)}</p><span class="rib9-sig">${esc(initial(pl.name))}. ${esc(String(pl.name).split(/\s+/).pop() || '')}</span></div>
        </section>` : `
        <section class="rib9-card rib9-player rib9-player-empty">
          <div class="rib9-portrait"><img src="${ART}portrait_helmet.webp${ARTV}" alt=""></div>
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
            <img class="rib9-trophy" src="${ART}card_trophy.webp${ARTV}" alt="">
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
      // the holder owns the tints; the SIZER is the framed section — the same element unless the
      // picture sits in the hero's art layer. v105: the size is never read off that layer itself,
      // so a stylesheet that does not know the layer (a cache holding the old sheet under a new
      // script) cannot hand the crop maths a zero-height box.
      const holder = img.parentElement, sizer = holder.classList.contains('rib9-hero-art') && holder.parentElement ? holder.parentElement : holder;
      const box = coverBox(img, sizer);
      // with no box there is no crop to follow: the recoloured copies hide rather than fall out at
      // their natural size over the page
      if (!box) { for (const t of holder.querySelectorAll(':scope > img[data-mask]')) t.style.visibility = 'hidden'; continue; }
      for (const t of holder.querySelectorAll(':scope > img[data-mask]')) t.style.visibility = '';
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
    startHeroFx(menu);   // v102: the hero comes alive
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

  /* ===== v102 THE MENU IS ALIVE =====
   * The hero was a photograph. It still is, but the stadium in it now behaves like one:
   *   - the FLOODLIGHTS along the far rim flicker on their own clocks (five lamps, each a
   *     multi-duration CSS flicker so no two ever pulse together);
   *   - the CROWD moves — camera flashes pop across the stands and a slow shimmer runs over
   *     the tiers, drawn on a canvas over the picture (`heroFx`);
   *   - the PLAYER breathes: the picture eases in and out by a fraction of a percent on a
   *     four-second cycle, and the helmet portrait with it;
   *   - a SUN at the tunnel mouth — a warm core with slow-turning rays — and the WIND: dust
   *     lifting through the tunnel light, the swash fluttering under the wordmark;
   *   - the LETTERS SHINE: a sheen sweeps the wordmark through the wordmark's own alpha (a CSS
   *     mask of the same picture), and the gold in the brand and the jersey catches it too.
   * All of it respects prefers-reduced-motion: the CSS rule already kills every animation,
   * and the canvas loop simply never starts. The canvas is one 2D context, a few dozen motes
   * and at most a couple of flashes a second — nothing the phone will feel. */
  const HERO_LAMPS = [[27.6, 20.3], [33.5, 22.2], [39.0, 24.5], [60.5, 24.0], [66.5, 22.6]];   // the lamp banks on the far rim, in PICTURE percent (v107.1)
  const HERO_SUN = [50.0, 24.5];   // the warm core at the tunnel mouth, in PICTURE percent
  function heroFxMarkup() {
    // the percents here are the first paint only: size() re-hangs every lamp on the picture in px
    const lamps = HERO_LAMPS.map(([x, y], i) => `<i class="rib9-lamp" style="--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}%;--d:${(2.3 + i * 0.7).toFixed(2)}s;--e:${(0.4 + i * 0.37).toFixed(2)}s"></i>`).join('');
    return `<div class="rib9-hero-fx" aria-hidden="true"><i class="rib9-sun"></i><i class="rib9-sun-rays"></i>${lamps}<canvas class="rib9-hero-cv"></canvas></div>`;
  }

  /* ===== v107.1 THE FLASHES ARE ONLY OVER THE CROWD =====
   * Everything the FX layer drew was placed in fractions of the CANVAS BOX — flashes at
   * 0.5 ± rnd(.08, .34) across and rnd(.17, .42) down, a shimmer band from 18% to 82%. The
   * photograph under it is `object-fit: cover` at `50% 40%`, so the box crops it differently at
   * every aspect ratio and those fractions wander: at a phone width the same numbers land 16% and
   * 84% into the picture, which is the TUNNEL WALL either side of the mouth. Flashes popped on
   * bare concrete. Every mark is now placed in PICTURE percent and mapped through the same cover
   * box `layoutArt()` uses, re-read whenever the layer resizes.
   *
   * CROWD_V107_1 is the region they are allowed to land in: the stands seen through the tunnel
   * mouth, as two tiers either side of the man, traced off `art/menu/hero_tunnel_wall.png`.
   * The outer edge stops inside the tunnel's lit corner (the wall reads dark grey, the tier warm
   * amber — the corner is where that flips, measured row by row); the inner edge is the v106 kit
   * masks' own helmet and jersey outline (`hero_mask_s` / `hero_mask_p`) plus about a percent, so
   * nothing lands on him; the top clears the lamp banks, whose glare burns down to y=27; and the
   * bottom stops at y=50, above the blown-out mouth where the tiers give way to the floor.
   * Sampled over the picture the region is lum >= 82 and r-b >= 36 everywhere, with both kit
   * masks fully transparent — `scripts/heroflashcheck.mjs` is the proof. */
  const CROWD_V107_1 = [
    [[29.6, 28.5], [30.0, 31.0], [30.4, 34.0], [30.6, 35.5], [30.7, 36.5], [30.8, 37.0], [31.0, 38.0], [31.2, 39.0], [31.3, 40.0], [31.5, 41.0], [31.6, 42.0], [31.9, 44.0], [32.2, 46.0], [32.5, 48.0], [32.8, 50.0],
     [35.2, 50.0], [34.7, 48.0], [34.8, 46.0], [35.1, 44.0], [35.4, 42.0], [35.8, 41.0], [36.0, 40.0], [36.6, 39.0], [37.5, 38.0], [38.3, 37.5], [38.8, 37.0], [39.7, 36.5], [43.6, 35.5], [43.6, 28.5]],
    [[56.2, 28.5], [56.2, 35.5], [56.2, 36.5], [58.8, 37.0], [59.9, 37.5], [60.6, 38.0], [61.4, 39.0], [62.4, 40.0], [62.8, 41.0], [63.0, 42.0], [63.5, 44.0], [63.7, 46.0], [63.7, 48.0], [63.6, 50.0],
     [65.7, 50.0], [65.9, 48.0], [66.1, 46.0], [66.3, 44.0], [66.5, 42.0], [66.6, 41.0], [66.7, 40.0], [66.8, 39.0], [66.9, 38.0], [67.0, 37.0], [67.1, 36.5], [67.3, 34.0], [67.6, 31.0], [67.9, 28.5]],
  ];
  const HERO_BREATHE_V107_1 = 1.018;   // .rib9-hero-art rides rib9breathe (1.012..1.024 about 50% 62%); the canvas does not, so aim at the middle of it
  const inPolyV107_1 = (poly, x, y) => { let hit = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit; } return hit; };
  const inCrowdV107_1 = (x, y) => CROWD_V107_1.some((p) => inPolyV107_1(p, x, y));
  const bboxV107_1 = (poly) => poly.reduce((b, [x, y]) => ({ x0: Math.min(b.x0, x), y0: Math.min(b.y0, y), x1: Math.max(b.x1, x), y1: Math.max(b.y1, y) }), { x0: 100, y0: 100, x1: 0, y1: 0 });
  const CROWD_BB_V107_1 = CROWD_V107_1.map(bboxV107_1);
  const CROWD_HULL_V107_1 = bboxV107_1([].concat(...CROWD_V107_1));   // the shimmer's own clip
  // a tier is picked by its area, then rejection-sampled inside it; a region this convex hits in a
  // try or two, and the handful of misses simply drop the flash rather than nudging it to an edge
  const CROWD_AREA_V107_1 = CROWD_V107_1.map((p) => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += p[j][0] * p[i][1] - p[i][0] * p[j][1]; return Math.abs(a) / 2; });
  function pickCrowdV107_1() {
    let roll = Math.random() * CROWD_AREA_V107_1.reduce((a, b) => a + b, 0), i = 0;
    while (i < CROWD_AREA_V107_1.length - 1 && roll > CROWD_AREA_V107_1[i]) { roll -= CROWD_AREA_V107_1[i]; i++; }
    const bb = CROWD_BB_V107_1[i], poly = CROWD_V107_1[i];
    for (let n = 0; n < 24; n++) { const x = bb.x0 + Math.random() * (bb.x1 - bb.x0), y = bb.y0 + Math.random() * (bb.y1 - bb.y0); if (inPolyV107_1(poly, x, y)) return [x, y]; }
    return null;
  }
  // where the hero photograph actually sits inside the FX layer's box, in box pixels — the same
  // crop maths layoutArt() runs on the tints, so a flash and the recoloured kit agree on the picture
  function heroPicBoxV107_1(menu) {
    const img = menu.querySelector('.rib9-hero-img'); if (!img) return null;
    const holder = img.parentElement; if (!holder) return null;
    const sizer = holder.classList.contains('rib9-hero-art') && holder.parentElement ? holder.parentElement : holder;
    const box = coverBox(img, sizer); if (!box) return null;
    const ox = sizer.clientWidth * 0.5, oy = sizer.clientHeight * 0.62, k = HERO_BREATHE_V107_1;
    return { x: ox + (box.x - ox) * k, y: oy + (box.y - oy) * k, w: box.w * k, h: box.h * k };
  }

  let heroFx = null;
  function startHeroFx(menu) {
    stopHeroFx();
    if (prefersReduced()) return;
    const cv = menu.querySelector('.rib9-hero-cv'); if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const st = { cv, ctx, w: 0, h: 0, box: null, motes: [], flashes: [], flashLog: [], skipped: 0, last: performance.now(), next: 0, raf: 0, on: true, frames: 0 };
    const toBox = (px, py) => st.box ? { x: st.box.x + px / 100 * st.box.w, y: st.box.y + py / 100 * st.box.h } : null;
    const hang = () => {   // v107.1: the lamps and the sun ride the picture too, or they drift with the crop
      if (!st.box) return;
      const lamps = menu.querySelectorAll('.rib9-lamp');
      HERO_LAMPS.forEach(([px, py], i) => { const el = lamps[i], p = el && toBox(px, py); if (!p) return; el.style.setProperty('--x', p.x.toFixed(1) + 'px'); el.style.setProperty('--y', p.y.toFixed(1) + 'px'); });
      const sun = toBox(HERO_SUN[0], HERO_SUN[1]);
      if (sun) for (const sel of ['.rib9-sun', '.rib9-sun-rays']) { const el = menu.querySelector(sel); if (el) { el.style.left = sun.x.toFixed(1) + 'px'; el.style.top = sun.y.toFixed(1) + 'px'; } }
    };
    const size = () => { const r = cv.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); st.w = Math.max(1, Math.round(r.width)); st.h = Math.max(1, Math.round(r.height)); cv.width = Math.round(st.w * dpr); cv.height = Math.round(st.h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); st.box = heroPicBoxV107_1(menu); hang(); };
    size();
    for (let i = 0; i < 46; i++) st.motes.push({ x: Math.random(), y: Math.random(), r: rnd(0.6, 1.9), vx: rnd(0.012, 0.03), vy: rnd(-0.008, 0.004), a: rnd(0.12, 0.45), ph: rnd(0, 6.28) });
    const tick = (now) => {
      if (!st.on) return;
      if (!cv.isConnected) { stopHeroFx(); return; }
      const dt = Math.min(0.05, (now - st.last) / 1000); st.last = now; st.frames++;
      if (document.hidden) { st.raf = requestAnimationFrame(tick); return; }
      // the picture may only get its box once the sheet and the natural size have both landed
      if (!st.box && st.frames % 20 === 1) { st.box = heroPicBoxV107_1(menu); hang(); }
      const w = st.w, h = st.h; ctx.clearRect(0, 0, w, h);
      // the wind: dust drifting up and across through the tunnel's light, brightest near the mouth
      const gust = 1 + 0.6 * Math.sin(now / 2600) * Math.sin(now / 900);
      for (const m of st.motes) {
        m.x += m.vx * gust * dt; m.y += (m.vy + 0.006 * Math.sin(now / 700 + m.ph)) * dt;
        if (m.x > 1.02) { m.x = -0.02; m.y = Math.random(); } if (m.y < -0.02) m.y = 1.02; if (m.y > 1.02) m.y = -0.02;
        const near = 1 - Math.min(1, Math.hypot(m.x - 0.5, m.y - 0.32) / 0.5);
        ctx.globalAlpha = m.a * (0.35 + 0.65 * near) * (0.7 + 0.3 * Math.sin(now / 400 + m.ph));
        ctx.fillStyle = '#ffe8b8'; ctx.beginPath(); ctx.arc(m.x * w, m.y * h, m.r, 0, 6.283); ctx.fill();
      }
      // the crowd: camera flashes popping across the STANDS — v107.1 spawns them in the picture,
      // inside CROWD_V107_1, and drops any that the current crop has pushed off the canvas
      if (now > st.next) { st.next = now + rnd(260, 900);
        const spot = st.box && pickCrowdV107_1(), at = spot && toBox(spot[0], spot[1]);
        if (at && at.x >= 0 && at.x <= w && at.y >= 0 && at.y <= h) {
          st.flashes.push({ px: spot[0], py: spot[1], t: now, ms: rnd(140, 260), r: rnd(1.6, 3.4) });
          st.flashLog.push({ px: +spot[0].toFixed(2), py: +spot[1].toFixed(2), x: +at.x.toFixed(1), y: +at.y.toFixed(1), r: +st.flashes[st.flashes.length - 1].r.toFixed(2), t: Math.round(now) });
          if (st.flashLog.length > 200) st.flashLog.shift();
        } else st.skipped++; }
      for (let i = st.flashes.length - 1; i >= 0; i--) { const f = st.flashes[i]; const q = (now - f.t) / f.ms; if (q >= 1) { st.flashes.splice(i, 1); continue; }
        const p = toBox(f.px, f.py); if (!p) continue;   // re-aimed every frame, so a resize mid-pop moves it with the picture
        const a = q < 0.25 ? q / 0.25 : 1 - (q - 0.25) / 0.75;
        ctx.globalAlpha = 0.9 * a; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, f.r, 0, 6.283); ctx.fill();
        ctx.globalAlpha = 0.28 * a; ctx.beginPath(); ctx.arc(p.x, p.y, f.r * 3.2, 0, 6.283); ctx.fill(); }
      // and the tiers themselves shimmer: a faint band that drifts, clipped to the crowd's own box
      const s0 = toBox(CROWD_HULL_V107_1.x0, CROWD_HULL_V107_1.y0), s1 = toBox(CROWD_HULL_V107_1.x1, CROWD_HULL_V107_1.y1);
      if (s0 && s1) {
        const bx = Math.max(0, s0.x), by = Math.max(0, s0.y), bw = Math.min(w, s1.x) - bx, bh = Math.min(h, s1.y) - by;
        if (bw > 0 && bh > 0) {
          ctx.globalAlpha = 0.045; const sh = ctx.createLinearGradient(bx, 0, bx + bw, 0);
          const ph = (now / 5200) % 1;
          sh.addColorStop(Math.max(0, ph - 0.12), 'rgba(255,255,255,0)'); sh.addColorStop(ph, 'rgba(255,255,255,1)'); sh.addColorStop(Math.min(1, ph + 0.12), 'rgba(255,255,255,0)');
          ctx.fillStyle = sh; ctx.fillRect(bx, by, bw, bh);
        }
      }
      ctx.globalAlpha = 1;
      st.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);
    st.ro = window.ResizeObserver ? new ResizeObserver(size) : null; if (st.ro) st.ro.observe(cv.parentElement);
    heroFx = st;
    window.__RIB_MENU_FX_V102 = { get frames() { return st.frames; }, get motes() { return st.motes.length; }, get flashes() { return st.flashes.length; }, get on() { return st.on; },
      // v107.1: what the check reads — every spawn in picture percent AND box pixels, the crop it
      // was mapped through, the region it had to land in, and where the lamps and the sun hang
      get flashLog() { return st.flashLog.slice(); }, get skipped() { return st.skipped; },
      get box() { return st.box ? { x: st.box.x, y: st.box.y, w: st.box.w, h: st.box.h } : null; },
      get canvas() { return { w: st.w, h: st.h }; },
      crowd: CROWD_V107_1, crowdBox: CROWD_HULL_V107_1, lamps: HERO_LAMPS, sun: HERO_SUN,
      inCrowd: (px, py) => inCrowdV107_1(px, py),
      pic: (bx, by) => st.box ? [(bx - st.box.x) / st.box.w * 100, (by - st.box.y) / st.box.h * 100] : null };
  }
  function stopHeroFx() { if (!heroFx) return; heroFx.on = false; cancelAnimationFrame(heroFx.raf); if (heroFx.ro) heroFx.ro.disconnect(); heroFx = null; }

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
      freshV106();   // v106.1: at the menu, ask the site whether this page is still its page
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
    stopHeroFx();
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
  window.__RIB_MENU_V89 = { readMenuData, renderMenu, mountMenu, unmountMenu, jerseyFor, layoutArt, recolorFilter, hsl, freshV106 };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
