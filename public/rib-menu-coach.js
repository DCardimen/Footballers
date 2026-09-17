(() => {
  'use strict';
  /* ===== v119 THE COACH — he pops in on every screen of your first week =====
   * A talking head who walks a new player through ONE FULL WEEK, one screen at a time: the main
   * menu, the personality roll, the position pick, the hub, the season-commitment wheel, the
   * training board, the season screen, the weekly-plan wheel, the four-step pregame, the broadcast,
   * the post-game card, and the body after the game — plus the prestige tree whenever it is opened. Each STOP is a few lines said over the page it belongs to — the page dims, stays there
   * behind him, and a spotlight can cut through the dim onto the button or card he is talking
   * about — and then he leaves and the player gets on with it. He never repeats a stop; when the
   * last one is said he switches himself off.
   *
   * The coach is the three uploaded sheets cut into public/coach/ (build-coach-art.py): fifteen
   * poses, each drawn mouth-closed (`_a`) and mouth-open (`_b`), the open one being the closed
   * drawing with only the MOUTH set on it, so nothing but the mouth moves. A line TYPES while the
   * mouth moves in the shape of speech — a syllable open, a beat closed, a longer close at a word
   * gap or a stop, the odd double snap, never a metronome — and his VOICE is a muddle of pitched
   * blips synthesised on the spot with WebAudio (no sound file), one per letter at a syllable
   * rate, not cut to the mouth. VOICE in the bubble mutes him (`rib.coachVoice.v119`).
   *
   * What he says is the HOW TO PLAY guide's own facts, but PLAIN: a football coach talking to a
   * jock who may not follow a long sentence — short lines, what the screen does, what to do about
   * it, and almost no numbers (the guide has the numbers). Every position wants a different mix of
   * skills and the mix is the player's to work out; prestige is what a finished career leaves behind.
   *
   * The switch on the main menu (`rib9-tile-coach`, data-rib-action="coach") is the door. ON means
   * he walks you through your first week: the menu stop plays the moment it is switched on (and,
   * on a first visit, right after the game's three welcome cards are clicked through — cards that
   * had been buried under the v89 menu overlay since it arrived, and v119 lifts above it), and the
   * other stops fire as their screens appear. Finishing the walk, or SKIP TOUR, switches it OFF and
   * remembers (`rib.coachTour.v119`); switching it ON again starts the walk over. The dev checks
   * remove the welcome cards without a click, so they never meet him; `?coachTour` switches him on.
   *
   * Body-level overlay, like the guide: nothing lives inside #rib-main-menu-v2 or #screen, both of
   * which re-render their innerHTML. `window.__RIB_COACH` is the hook; `coachcheck.mjs` the gate. */

  const ID = 'rib-coach-v119';
  const KEY = 'rib.coachTour.v119', VOICE_KEY = 'rib.coachVoice.v119', SEEN_KEY = 'rib.coachSeen.v119';
  const ART = './public/coach/';
  const POSES = ['whoa', 'thinkcap', 'armscrossed', 'clipboard', 'relaxed', 'firedup', 'listen', 'shrug', 'flex', 'stop', 'welcome', 'tip', 'point', 'thumbsup', 'open'];
  // the pace: a character every TYPE_MS, punctuation breathes, then the line is HELD to be read
  const TYPE_MS = 18, PUNCT_MS = 140, HOLD_MS = 700, HOLD_PER_CHAR = 11;
  const BLIP_GAP = 0.042;   // seconds between blips: a syllable rate, not a letter rate

  // ---- the screens: what is on the page, and how to know which page this is -------------------------
  const getState = () => { try { return (window.__GRIDIRON_AUDIT__ && window.__GRIDIRON_AUDIT__.getState && window.__GRIDIRON_AUDIT__.getState()) || null; } catch (e) { return null; } };
  const shown = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return false; const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const byId = (id) => { const el = document.getElementById(id); return shown(el) ? el : null; };
  const buttonByText = (re) => [...document.querySelectorAll('button, [onclick], a')].find((el) => shown(el) && re.test((el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim())) || null;
  // a spotlight target is a selector, or `text:` and a pattern matched against the visible buttons
  const S = {
    career: '#rib-main-menu-v2 .rib9-tiles .rib9-tile:nth-child(1)', coach: '#rib-main-menu-v2 .rib9-tiles [data-rib-action="coach"]', howto: '#rib-main-menu-v2 .rib9-tiles [data-rib-action="howto"]', prestige: 'text:^TRAINING\\b',   // the tile's action is view:upgrade with a career and new without one: find it by its face
    lockIn: 'text:Lock In Personality', posCards: '.pos-card', playSeason: 'text:Play \\d+-Game Season', confirm: 'text:CONFIRM TRAINING', playWeek: 'text:Play Week \\d+ Live',
    cont: '#gv42go', next: 'text:^NEXT', speed: '.speed-btn', body: '#screen .condition-card-v11', hubTabs: '#screen .tabs, #screen [class*="tab"]',
    name: 'parent:#screen .name-hint-v96', team: 'find:🏟',   // the name he can rename, the team line on the hub card
  };

  /* ===== v122 THE SEASON DEBRIEF, IN HIS MOUTH =====
   * The season report card is numbers with no verdict. `window.__DEBRIEF_V122` (index.html) works
   * out what the season actually did — from the week rows it reads before the roll clears them —
   * and hands over a head line, a focus for next season and a weighted list of notes. He says the
   * head, the loudest four notes, then the focus. Nothing here is written in advance: every line
   * is that season's own numbers, which is the only way a debrief is worth hearing.
   *
   * It is NOT part of the first-week walk. A report card comes round every season, so it fires on
   * every one (once — `rib.debriefSeen.v122` holds the season number) whether the tour is on or
   * off; SKIP on it silences it for good (`rib.debriefOff.v122`). */
  const DEBRIEF_OFF = 'rib.debriefOff.v122';
  const debrief = () => { try { return (window.__DEBRIEF_V122 && window.__DEBRIEF_V122.get()) || null; } catch (e) { return null; } };
  const debriefOff = () => store.get(DEBRIEF_OFF) === 'off';
  const debriefDue = () => { const d = debrief(); if (!d || debriefOff()) return null;
    let seen = null; try { seen = window.__DEBRIEF_V122.lastSeen(); } catch (e) {}
    return String(seen) === String(d.season) ? null : d; };
  const NOTE_POSE = { fatigue: 'listen', injury: 'stop', expect: 'clipboard', luck: 'shrug', rank: 'tip', track: 'point', snaps: 'armscrossed' };
  function debriefLinesV122() {
    const d = debrief(); if (!d) return null;
    const all = d.notes || [];
    // the ladder is always said — where he ranks and whether he is on track is the question the
    // report card exists to answer — and the loudest of the rest fill the other three
    const track = all.filter((n) => n.k === 'track');
    const rest = all.filter((n) => n.k !== 'track').slice(0, Math.max(0, 4 - track.length));
    const say = track.concat(rest).sort((a, b) => b.weight - a.weight);
    const L = [{ p: 'clipboard', t: 'Season\'s done. ' + d.head }];
    say.forEach((n) => L.push({ p: NOTE_POSE[n.k] || 'open', t: n.head + '. ' + n.body }));
    if (d.focus) L.push({ p: 'tip', t: 'Next season: ' + d.focus.program + '. ' + d.focus.why });
    L.push({ p: 'firedup', t: 'That is your year. Spend your points, then go again.' });
    return L;
  }

  // ---- the stops: one per screen, in the order a first week meets them ---------------------------
  // { id, title, sub, when(ctx) → bool, lines: [{ p: pose, t: text, s?: spotlight key }], delay?, last? }
  // ctx: { view, menu, wheel, pregame, post, persona, live }
  const STOPS = [
    { id: 'menu', title: 'THE MENU', sub: 'KICKOFF', when: (c) => c.menu && !c.persona, lines: [
      { p: 'welcome', t: "Listen up, rookie. I'm Coach. I'll pop in on each screen, tell you what it does, then get out of your way." },
      { p: 'listen', t: "Tap my bubble if I talk too slow. SKIP TOUR shuts me up for good. This COACH'S TOUR tile brings me back.", s: 'coach' },
      { p: 'armscrossed', t: "Big picture: you play one guy. Play well, you move up a league. Play bad, the career's over. Then you make a new guy." },
      { p: 'tip', t: "The old guy leaves you PRESTIGE. Spend it under TRAINING and every guy after him starts better. Careers end. That's the point.", s: 'prestige' },
      { p: 'point', t: "Tap CAREER. Let's make a football player.", s: 'career', tap: true },
    ] },
    { id: 'prestige', title: 'PRESTIGE', sub: 'WHAT YOU KEEP', when: (c) => c.view === 'upgrade', lines: [   // off the menu's TRAINING tile, whenever he opens it
      { p: 'clipboard', t: "The prestige tree. This is what your finished careers pay for." },
      { p: 'tip', t: "Every point you spend here makes the NEXT guy start better. Higher ceiling. Better body. Better start." },
      { p: 'thumbsup', t: "You earn more prestige the further a career goes. So finish your careers. Don't quit on them." },
    ] },
    { id: 'persona', title: 'WHO YOU ARE', sub: 'THE PERSONALITY ROLL', when: (c) => c.persona, lines: [
      { p: 'clipboard', t: "This is who your guy is. The dice picked his personality." },
      { p: 'thinkcap', t: "Each trait cuts two ways. Something he's good at, something he's not. Don't overthink it. You can't change it yet anyway." },
      { p: 'point', t: "It also loads the wheel you spin before games. Lock it in.", s: 'lockIn', tap: true },
    ] },
    { id: 'position', title: 'YOUR POSITION', sub: 'THE BODY HE WAS DEALT', when: (c) => c.view === 'choosePos' && !c.persona, lines: [
      { p: 'whoa', t: "The big one. Pick a position." },
      { p: 'tip', t: "That's his name up top. Tap it if you want to call him something else.", s: 'name' },
      { p: 'tip', t: "Every position wants different skills. A back needs speed. A lineman needs strength. A quarterback needs an arm and a brain.", s: 'posCards' },
      { p: 'stop', t: "The number under each one says how well his body fits it. Pick a good fit. Fit is free and it lasts his whole career." },
      { p: 'shrug', t: "And figuring out the right mix of skills for your guy? That's on you. I don't do the thinking for you." },
    ] },
    { id: 'hub', title: 'HOME BASE', sub: 'THE HUB', when: (c) => c.view === 'hub', lines: [
      { p: 'open', t: "Home base. NOW is your week. BODY is how he feels. SKILLS is what he's got. TEAM is who he plays with. STORY is what's going on." },
      { p: 'point', t: "That's your team right there — the name and the colours you wear. TEAM shows who you play with.", s: 'team' },
      { p: 'listen', t: "Your rating and the depth chart live here. Low on the chart means fewer snaps. Fewer snaps means fewer stats. Simple." },
      { p: 'point', t: "I don't trust you yet, so you get about half the snaps. Play well and you get more. Now start the season.", s: 'playSeason', tap: true },
    ] },
    { id: 'wheel', title: 'THE WHEEL', sub: 'HOW HARD HE WORKS THIS YEAR', when: (c) => c.wheel && !c.planWheel, lines: [   // over the training board, off PLAY SEASON
      { p: 'clipboard', t: "The wheel. How hard is your guy working this year? The spin decides. His personality loads the odds." },
      { p: 'tip', t: "LIGHT is safe. OBSESSIVE pays big and breaks big. Green means it worked. Red means it blew up in your face." },
      { p: 'point', t: "Tired guys roll red. Never spin worn out. Tap the wheel to hurry it, then hit CONTINUE.", s: 'cont', tap: true },
    ] },
    { id: 'training', title: 'THE OFFSEASON', sub: 'CHOOSE YOUR TRAINING', when: (c) => c.view === 'training' && !c.wheel, lines: [
      { p: 'clipboard', t: "The training board. Tap a program to see what it does. The blue on a bar is what you'd gain." },
      { p: 'tip', t: "Train what your position needs. Weak stat? Train it. Tired guy? Conditioning." },
      { p: 'point', t: "Pick one and confirm. Nothing's locked till you do.", s: 'confirm', tap: true },
    ] },
    { id: 'season', title: 'THE SEASON', sub: 'THE SCHEDULE AND YOUR BODY', when: (c) => c.view === 'season' && !c.wheel && !c.pregame && !c.post, lines: [
      { p: 'open', t: "The season. Your schedule is down there. Up here is YOUR BODY.", s: 'body' },
      { p: 'listen', t: "Stats show up here. See how they hit your season below. Tired guy plays bad. Fresh guy plays good." },
      { p: 'stop', t: "If he's feeling fatigued, play fewer snaps and let him recover. Fatigue changes how he plays. Got it?" },
      { p: 'point', t: "Injury risk is right there too. Read it before you throw him in. Now play Week 1 live.", s: 'playWeek', tap: true },
    ] },
    { id: 'plan', title: 'THE WEEKLY PLAN', sub: 'ROLLED, NOT CHOSEN', when: (c) => c.planWheel, lines: [   // off PLAY WEEK, before the wizard
      { p: 'clipboard', t: "Game week. The staff drew up plans. The wheel picks which one you run. His personality loads it." },
      { p: 'tip', t: "Some plans chase big plays. Some keep it steady. One does the dirty work and earns my trust." },
      { p: 'point', t: "Tap the wheel to hurry it, then CONTINUE.", s: 'cont', tap: true },
    ] },
    { id: 'pregame', title: 'BEFORE KICKOFF', sub: 'FOUR STEPS', when: (c) => c.pregame && !c.wheel, lines: [
      { p: 'clipboard', t: "Four steps before kickoff. Step one: how much do you want to play? NORMAL is the snaps I trust you with. Fewer snaps, less wear." },
      { p: 'stop', t: "Ask for more than your share and it costs your body — until you earn it. More trust, more say." },
      { p: 'tip', t: "Step two: pick one thing to focus on. Step three: the game plan. Step four: what you're carrying onto the field." },
      { p: 'point', t: "Read the last page, then CONTINUE TO MATCH.", s: 'next', tap: true },
    ] },
    { id: 'live', title: 'THE BROADCAST', sub: 'WATCH IT', when: (c) => c.live && !c.post, delay: 2600, lines: [
      { p: 'open', t: "Game time. Your guy has a ring under his feet. Watch him." },
      { p: 'listen', t: "These buttons set the speed. SKIP jumps to the whistle. Your stats show under the field.", s: 'speed' },
      { p: 'relaxed', t: "I'll see you after." },
    ] },
    { id: 'result', title: 'THE CARD', sub: 'AFTER THE WHISTLE', when: (c) => c.post, lines: [
      { p: 'clipboard', t: "The card. Your grade, your stats, how the team did." },
      { p: 'listen', t: "Good game? I trust you more and you get more snaps. Bad game? The opposite. Your rank follows your stats." },
      { p: 'point', t: "And every game costs the body something. Check YOUR BODY before next week." },
    ] },
    { id: 'debrief', title: 'THE SEASON', sub: 'WHAT THE YEAR SAYS', when: (c) => c.view === 'result' && !!debriefDue(), build: debriefLinesV122, delay: 900, every: true },
    { id: 'recovery', title: 'RECOVERY', sub: 'THE BODY AFTER A GAME', when: (c) => c.view === 'season' && !c.wheel && !c.pregame && !c.post && c.seen.has('result'), lines: [
      { p: 'open', t: "Back on the season screen. Your guy took some hits. WEAR & TEAR is what the season is costing him. NEXT GAME is the injury risk.", s: 'body' },
      { p: 'stop', t: "Worn out means he plays worse AND grades worse. Feeling fatigued? Play fewer snaps. Let him recover. Fatigue changes how he plays." },
      { p: 'tip', t: "Want the deep stuff? HOW TO PLAY on the main menu breaks down how the AI plays, the strategies, all of it." },
      { p: 'welcome', t: "That's your first week. I'm switching this tour off. The tile on the menu brings me back. Now go get hit." },
    ], last: true },
  ];

  // ---- state ----------------------------------------------------------------------------------
  const st = { open: false, stop: null, li: 0, lines: null, typing: false, auto: true, timer: 0, mouth: 0, raf: 0, spot: null, tap: false, flips: 0, text: '', pos: 0, preloaded: false };
  let armed = true, queryDone = false, onboardClicks = 0, sawOnboard = false, welcomed = false, pending = 0, pendingId = null, popSince = 0, popEl = null;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  // three states for the switch: nothing stored (a fresh install — ON on the tile; the walk follows the
  // welcome cards), 'on' (switched on by hand — the menu stop plays now), 'off' (finished, skipped, or off)
  const state = () => store.get(KEY);
  const enabled = () => state() !== 'off';
  const seen = () => { try { return new Set(JSON.parse(store.get(SEEN_KEY) || '[]')); } catch (e) { return new Set(); } };
  const markSeen = (id) => { const s = seen(); s.add(id); store.set(SEEN_KEY, JSON.stringify([...s])); };
  const resetSeen = () => store.set(SEEN_KEY, '[]');
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function refreshTile() {
    const tile = document.querySelector('#rib-main-menu-v2 [data-rib-action="coach"]'); if (!tile) return;
    const on = enabled();
    tile.classList.toggle('on', on); tile.setAttribute('aria-checked', on ? 'true' : 'false'); tile.setAttribute('aria-label', "Coach's tour, " + (on ? 'on' : 'off'));
    const small = tile.querySelector('small'); if (small) small.innerHTML = '<i class="rib9-sw"><i></i></i>' + (on ? 'ON · HE WALKS YOUR FIRST WEEK' : 'OFF · TAP TO BRING HIM BACK');
  }
  function setEnabled(v) { store.set(KEY, v ? 'on' : 'off'); refreshTile(); }

  // ---- reading the page ------------------------------------------------------------------------------
  function ctx() {
    const s = getState() || {};
    return {
      // two wheels share #growthV42: the season commitment comes up over the training board off PLAY
      // SEASON (it spins itself, rolls the fit, and its CONTINUE #gv42go is only in the page once the
      // roll is in), and the weekly plan comes up off PLAY WEEK, before the pregame wizard — its title
      // reads PREGAME
      view: String(s.view || ''), menu: !!document.getElementById('rib-main-menu-v2'), persona: !!byId('personaV13'), wheel: !!byId('growthV42'),
      planWheel: !!byId('growthV42') && /^\s*PREGAME/.test((document.querySelector('#growthV42 > div > div') || {}).textContent || ''),
      pregame: !!byId('pregameV1513'), post: !!byId('pgOverlayV13'), live: !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length) && String(s.view || '') === 'live',
      seen: seen(),
    };
  }
  // the first UNSEEN stop whose screen this is: a screen he has already talked on (the season screen,
  // before and after the game) falls through to the next stop that fits it
  function currentStop() { const c = ctx(); for (const S0 of STOPS) { if (!S0.every && c.seen.has(S0.id)) continue; try { if (S0.when(c)) return S0; } catch (e) { /* a page mid-render */ } } return null; }

  // ---- markup ---------------------------------------------------------------------------------------
  function markup() {
    return `<div class="rib-coach-dim"></div>
      <div class="rib-coach-spot" data-c-spot hidden></div>
      <div class="rib-coach-tap" data-c-tap hidden><i>👇</i><b>TAP HERE</b></div>
      <header class="rib-coach-top">
        <span class="rib9-mark">RIB</span><div><b>COACH</b><small data-c-crumb></small></div>
        <button type="button" class="rib-coach-skip" data-c-skip aria-label="Skip the tour">SKIP TOUR <i>×</i></button>
        <i class="rib-coach-bar"><b data-c-bar></b></i>
      </header>
      <div class="rib-coach-stage">
        <img class="rib-coach-man" data-c-man alt="" draggable="false">
        <div class="rib-coach-bubble" data-c-bubble role="group" aria-label="The coach">
          <div class="rib-coach-ch"><b data-c-ch></b><small data-c-sub></small></div>
          <p class="rib-coach-text" data-c-text aria-live="polite"></p>
          <div class="rib-coach-foot">
            <button type="button" data-c-back aria-label="Previous line">‹ BACK</button>
            <button type="button" data-c-auto class="on" aria-pressed="true" title="Play the lines on their own">AUTO</button>
            <button type="button" data-c-voice class="${voiceOn() ? 'on' : ''}" aria-pressed="${voiceOn() ? 'true' : 'false'}" title="The coach's voice">VOICE</button>
            <button type="button" data-c-next class="rib-coach-next">NEXT ›</button>
          </div>
        </div>
      </div>`;
  }
  const q = (sel) => { const r = document.getElementById(ID); return r ? r.querySelector(sel) : null; };
  const lines = () => st.lines || st.stop.lines;      // v122: a `build()` stop makes its lines when it opens
  const line = () => lines()[st.li];
  const stopIndex = (id) => STOPS.findIndex((S0) => S0.id === id);

  // ---- the pictures --------------------------------------------------------------------------------------
  const cache = {};
  function src(pose, open) { return ART + pose + (open ? '_b' : '_a') + '.webp'; }
  function preload() {
    if (st.preloaded) return Promise.resolve();
    const all = []; POSES.forEach((p) => [0, 1].forEach((o) => { const im = new Image(); im.decoding = 'async'; im.src = src(p, o); cache[p + o] = im;
      all.push(new Promise((res) => { im.onload = res; im.onerror = res; })); }));
    return Promise.race([Promise.all(all), new Promise((res) => setTimeout(res, 2500))]).then(() => { st.preloaded = true; });
  }
  function mouth(open) { const im = q('[data-c-man]'); if (!im || !st.stop) return; const s = src(line().p, open); if (im.getAttribute('src') !== s) { im.setAttribute('src', s); if (open) st.flips++; } }
  function flap() {
    clearTimeout(st.mouth);
    if (!st.typing) { mouth(false); return; }
    const im = q('[data-c-man]'); const open = !!im && /_b\.webp$/.test(im.getAttribute('src') || '');
    // the shape of speech, not a metronome: an open lasts a syllable, a close a beat, a word gap or
    // a stop holds the mouth shut a moment, and now and then it snaps twice
    const ch = st.text ? st.text[Math.max(0, st.pos - 1)] : '';
    let wait;
    if (open) { wait = 45 + Math.random() * 75; if (/[\s.,!?;:]/.test(ch) && Math.random() < 0.6) wait += 90 + Math.random() * 150; }
    else { wait = 55 + Math.random() * 85; if (Math.random() < 0.15) wait *= 0.45; }
    mouth(!open);
    voice.mouthLog.push(Math.round(wait)); if (voice.mouthLog.length > 80) voice.mouthLog.shift();
    st.mouth = setTimeout(flap, (reduced() ? 1.8 : 1) * wait);
  }

  // ---- the voice: a muddle of pitched blips, one per letter as it types -----------------------------------
  const voice = { ctx: null, master: null, last: 0, blips: 0, mouthLog: [] };
  const voiceOn = () => store.get(VOICE_KEY) !== 'off';
  function setVoice(v) { store.set(VOICE_KEY, v ? 'on' : 'off'); const b = q('[data-c-voice]'); if (b) { b.classList.toggle('on', !!v); b.setAttribute('aria-pressed', String(!!v)); } if (v) voiceCtx(); }
  function voiceCtx() {
    if (voice.ctx) { if (voice.ctx.state === 'suspended') { try { voice.ctx.resume(); } catch (e) { /* no gesture yet */ } } return voice.ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { voice.ctx = new AC(); } catch (e) { return null; }
    voice.master = voice.ctx.createGain(); voice.master.gain.value = 0.16; voice.master.connect(voice.ctx.destination);
    return voice.ctx;
  }
  function blip(ch, pos, len) {
    if (!voiceOn() || reduced()) return;
    const c = String(ch || '').toLowerCase(); if (!/[a-z]/.test(c)) return;
    const ctx0 = voiceCtx(); if (!ctx0) return;
    const now = ctx0.currentTime; if (now - voice.last < BLIP_GAP) return;
    voice.last = now; voice.blips++;
    const vowel = 'aeiou'.includes(c), code = c.charCodeAt(0) - 97, k = pos / Math.max(1, len);
    // a gruff coach: a low base, each letter its own step, the sentence rising then settling, a question lifting at the end
    const contour = Math.sin(k * Math.PI) * 2 - k * 2 + (/\?\s*$/.test(st.text || '') && k > 0.7 ? 3 : 0);
    const semi = (vowel ? 4 : 0) + (code % 7) - 3 + contour + (Math.random() - 0.5) * 1.5;
    const f0 = 118 * Math.pow(2, semi / 12), dur = vowel ? 0.075 + Math.random() * 0.04 : 0.045 + Math.random() * 0.025;
    const o1 = ctx0.createOscillator(), o2 = ctx0.createOscillator(), g = ctx0.createGain(), flt = ctx0.createBiquadFilter();
    o1.type = 'sawtooth'; o2.type = 'square'; o1.frequency.value = f0; o2.frequency.value = f0 * 0.5;
    flt.type = 'bandpass'; flt.frequency.value = vowel ? 520 + code * 90 : 900 + code * 40; flt.Q.value = vowel ? 2.2 : 1.1;
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(vowel ? 1 : 0.6, now + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o1.frequency.exponentialRampToValueAtTime(f0 * (vowel ? 0.93 : 1.06), now + dur);
    o1.connect(flt); o2.connect(flt); flt.connect(g); g.connect(voice.master);
    o1.start(now); o2.start(now); o1.stop(now + dur + 0.01); o2.stop(now + dur + 0.01);
    if ('sfhtkpx'.includes(c)) {   // a breath of noise on the fricatives and the plosives
      const n = ctx0.createBufferSource(), buf = ctx0.createBuffer(1, Math.floor(ctx0.sampleRate * 0.03), ctx0.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const ng = ctx0.createGain(), nf = ctx0.createBiquadFilter(); ng.gain.value = 0.25; nf.type = 'highpass'; nf.frequency.value = 2400;
      n.buffer = buf; n.connect(nf); nf.connect(ng); ng.connect(voice.master); n.start(now);
    }
  }

  // ---- the spotlight: a hole in the dim over the thing he is talking about, re-measured every frame ------
  function findSpot(key) {
    const spec = S[key] || key; if (!spec) return null;
    if (/^text:/.test(spec)) return buttonByText(new RegExp(spec.slice(5), 'i'));
    if (/^parent:/.test(spec)) { const el = [...document.querySelectorAll(spec.slice(7))].filter(shown)[0]; return el && el.parentElement && shown(el.parentElement) ? el.parentElement : el || null; }
    if (/^find:/.test(spec)) {   // the smallest thing on the screen that says it
      const re = new RegExp(spec.slice(5)); let best = null, area = Infinity;
      for (const el of document.querySelectorAll('#screen *, #app *')) { if (el.children.length > 6 || !re.test(el.textContent || '') || (el.textContent || '').length > 140 || !shown(el)) continue; const r = el.getBoundingClientRect(), a = r.width * r.height; if (a > 0 && a < area) { area = a; best = el; } }
      return best;
    }
    const els = [...document.querySelectorAll(spec)].filter(shown); return els[0] || null;
  }
  function scroller(el) {
    for (let p = el && el.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 4) return p; }
    return null;
  }
  function spotOn(key) {
    cancelAnimationFrame(st.raf); st.spot = key || null;
    const spot = q('[data-c-spot]'), dim = q('.rib-coach-dim'), tap = q('[data-c-tap]'); if (!spot) return;
    const off = () => { spot.hidden = true; if (dim) dim.hidden = false; if (tap) tap.hidden = true; };
    spot.classList.toggle('tap', !!st.tap);
    if (!st.spot) { off(); return; }
    // scroll whatever scrolls so the target sits in the band the coach and his bubble leave free:
    // below the tour's header, above the bubble (the middle of a phone screen is under the bubble)
    let scrolled = false;
    const bring = (el0) => {
      scrolled = true;
      const bub = q('[data-c-bubble]'), r0 = el0.getBoundingClientRect(), top = 96, bottom = bub ? Math.max(top + 60, bub.getBoundingClientRect().top - 8) : innerHeight * 0.5;
      const want = top + (bottom - top) / 2, delta = (r0.top + r0.height / 2) - want, sc = scroller(el0);
      if (Math.abs(delta) > 4) { try { (sc || window).scrollBy({ top: delta, behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { if (sc) sc.scrollTop += delta; else window.scrollBy(0, delta); } }
    };
    // the element he means may not be there YET (the wheel's SPIN button shows once the wheel has drawn):
    // the dim stays whole until it appears, and the cut-out follows it every frame after
    const tick = () => {
      const el = findSpot(st.spot); const root = document.getElementById(ID);
      if (!root) { off(); return; }
      if (!el) { spot.hidden = true; if (dim) dim.hidden = false; if (tap) tap.hidden = true; st.raf = requestAnimationFrame(tick); return; }
      if (!scrolled) bring(el);
      if (dim) dim.hidden = true; spot.hidden = false;
      const r = el.getBoundingClientRect(), pad = 6;
      spot.style.left = (r.left - pad) + 'px'; spot.style.top = (r.top - pad) + 'px'; spot.style.width = (r.width + pad * 2) + 'px'; spot.style.height = (r.height + pad * 2) + 'px';
      if (tap) {   // the hand sits just above the thing to tap (below it when the thing is at the top of the screen)
        tap.hidden = !st.tap;
        if (st.tap) { const tw = tap.offsetWidth || 110, th = tap.offsetHeight || 30, above = r.top - pad - th - 6 >= 60; tap.classList.toggle('below', !above);
          tap.style.left = Math.max(8, Math.min(innerWidth - tw - 8, r.left + r.width / 2 - tw / 2)) + 'px'; tap.style.top = (above ? r.top - pad - th - 6 : r.bottom + pad + 6) + 'px'; }
      }
      st.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  // ---- playing a line ---------------------------------------------------------------------------------------
  function show() {
    const root = document.getElementById(ID); if (!root || !st.stop) return;
    const S0 = st.stop, LS = lines(), L = line(), i = stopIndex(S0.id), lastLine = st.li === LS.length - 1;
    // v122: an `every` stop (the season debrief) is not a step of the walk — its crumb and bar are
    // its own, and its SKIP silences that stop rather than the tour
    const solo = !!S0.every, d122 = solo ? debrief() : null;
    q('[data-c-crumb]').textContent = solo ? ((d122 ? 'SEASON ' + d122.season + ' · ' : '') + S0.title) : ((i + 1) + ' / ' + STOPS.length + ' · ' + S0.title);
    q('[data-c-ch]').textContent = S0.title; q('[data-c-sub]').textContent = S0.sub;
    q('[data-c-bar]').style.width = Math.round(100 * (solo ? (st.li + 1) / LS.length : (i + (st.li + 1) / LS.length) / STOPS.length)) + '%';
    const skip = q('[data-c-skip]'); if (skip) { skip.innerHTML = (solo ? 'SKIP' : 'SKIP TOUR') + ' <i>×</i>'; skip.setAttribute('aria-label', solo ? 'Skip the season debrief, and do not show it again' : 'Skip the tour'); }
    q('[data-c-back]').disabled = st.li === 0;
    q('[data-c-next]').textContent = lastLine ? ((S0.last || solo) ? 'DONE ✓' : 'GOT IT ›') : 'NEXT ›';
    root.dataset.stop = S0.id; root.dataset.pose = L.p; st.tap = !!L.tap;
    mouth(false); spotOn(L.s || null);
    type(L.t);
    try { const H = window.__RIB_COACH; H.linesShown = (H.linesShown || 0) + 1; H.last = { stop: S0.id, li: st.li, pose: L.p, spot: L.s || null }; } catch (e) { /* the hook */ }
  }
  function type(text) {
    clearTimeout(st.timer); st.typing = true; st.text = text; st.pos = 0;
    const p = q('[data-c-text]'); if (!p) return; p.textContent = '';
    flap();
    const step = () => {
      if (!st.typing) return;
      st.pos++; p.textContent = text.slice(0, st.pos); blip(text[st.pos - 1], st.pos, text.length);
      if (st.pos >= text.length) { done(); return; }
      const c = text[st.pos - 1], pause = /[.!?]/.test(c) ? PUNCT_MS : /[,;:]/.test(c) ? PUNCT_MS * 0.5 : 0;
      st.timer = setTimeout(step, TYPE_MS + pause);
    };
    st.timer = setTimeout(step, reduced() ? 0 : 120);
  }
  function done() {
    st.typing = false; clearTimeout(st.timer); mouth(false); clearTimeout(st.mouth);
    const p = q('[data-c-text]'); if (p) p.textContent = st.text;
    // the lines play on; the LAST line of a stop waits for the player (he has a screen to use)
    if (st.auto && st.stop && st.li < lines().length - 1) st.timer = setTimeout(next, HOLD_MS + HOLD_PER_CHAR * st.text.length);
  }
  function tap() { if (st.typing) done(); else next(); }
  function next() {
    clearTimeout(st.timer); if (!st.stop) return;
    if (st.li < lines().length - 1) { st.li++; show(); return; }
    const S0 = st.stop;
    if (S0.id === 'debrief') { const d = debrief(); try { if (d) window.__DEBRIEF_V122.seen(d.season); } catch (e) {} close('gotit'); return; }
    markSeen(S0.id);
    if (S0.last) { finish('done'); return; }
    close('gotit');
  }
  function back() { clearTimeout(st.timer); if (st.li > 0) { st.li--; show(); } }
  function setAuto(v) { st.auto = !!v; const b = q('[data-c-auto]'); if (b) { b.classList.toggle('on', st.auto); b.setAttribute('aria-pressed', String(st.auto)); } if (st.auto && !st.typing && st.stop && st.li < lines().length - 1) st.timer = setTimeout(next, HOLD_MS); if (!st.auto) clearTimeout(st.timer); }

  // ---- open / close -------------------------------------------------------------------------------------------
  function open(stopId, opts) {
    if (document.getElementById(ID)) return true;
    const S0 = STOPS.find((x) => x.id === stopId); if (!S0) return false;
    const root = document.createElement('div');
    root.id = ID; root.className = 'rib-coach'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'The coach'); root.tabIndex = -1;
    root.innerHTML = markup();
    document.body.appendChild(root); document.body.classList.add('rib-coach-open');
    st.open = true; st.stop = S0; st.li = 0; st.flips = 0; st.auto = !(opts && opts.auto === false);
    st.lines = null; if (S0.build) { try { st.lines = S0.build(); } catch (e) { st.lines = null; } if (!st.lines || !st.lines.length) { st.open = false; st.stop = null; root.remove(); document.body.classList.remove('rib-coach-open'); return false; } }
    try { const H = window.__RIB_COACH; H.opens = (H.opens || 0) + 1; H.openedBy = (opts && opts.by) || 'page'; H.openedStop = stopId; } catch (e) { /* the hook */ }
    bind(root); if (voiceOn() && !reduced()) voiceCtx();
    preload().then(() => { if (document.getElementById(ID) && st.stop === S0) { root.classList.add('rib-coach-ready'); show(); (q('[data-c-next]') || root).focus({ preventScroll: true }); } });
    return true;
  }
  function close(why) {
    const root = document.getElementById(ID); if (!root) return false;
    clearTimeout(st.timer); clearTimeout(st.mouth); cancelAnimationFrame(st.raf); st.typing = false; st.open = false; st.stop = null;
    root.remove(); document.body.classList.remove('rib-coach-open');
    try { const H = window.__RIB_COACH; H.closes = (H.closes || 0) + 1; H.closedBy = why || 'close'; } catch (e) { /* the hook */ }
    return true;
  }
  function finish(why) {
    // v122: SKIP on the season debrief silences the DEBRIEF — the tour's own switch is not his to flip
    if (st.stop && st.stop.id === 'debrief') { const d = debrief(); store.set(DEBRIEF_OFF, 'off'); try { if (d) window.__DEBRIEF_V122.seen(d.season); } catch (e) {} close(why || 'skip'); return; }
    setEnabled(false); close(why || 'done');   // the walk is over, or skipped: the switch goes OFF and remembers
  }

  function bind(root) {
    root.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-c-skip]')) { ev.preventDefault(); finish('skip'); return; }
      if (ev.target.closest('[data-c-next]')) { ev.preventDefault(); next(); return; }
      if (ev.target.closest('[data-c-back]')) { ev.preventDefault(); back(); return; }
      if (ev.target.closest('[data-c-auto]')) { ev.preventDefault(); setAuto(!st.auto); return; }
      if (ev.target.closest('[data-c-voice]')) { ev.preventDefault(); setVoice(!voiceOn()); return; }
      if (ev.target.closest('[data-c-bubble]') || ev.target.closest('[data-c-man]')) { ev.preventDefault(); tap(); return; }
    });
    root.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); finish('skip'); return; }
      if (ev.key === 'ArrowRight' || ev.key === ' ' || (ev.key === 'Enter' && !ev.target.closest('button'))) { ev.preventDefault(); tap(); return; }
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); back(); return; }
      if (ev.key !== 'Tab') return;
      const stops = [...root.querySelectorAll('button')].filter((b) => !b.disabled && b.offsetParent !== null);
      if (!stops.length) return;
      const first = stops[0], last = stops[stops.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    });
  }

  // ---- the switch -------------------------------------------------------------------------------------------------
  function toggle() {
    if (st.open) { finish('skip'); return true; }
    if (state() === 'on') { setEnabled(false); return true; }          // switched on by hand and idle: off
    resetSeen(); setEnabled(true);                                      // fresh or off: on, the walk starts over
    const cur = currentStop(); return cur ? open(cur.id, { by: 'tile' }) : true;
  }

  // ---- watching the screens: the welcome cards, the query door, a switch left on, and every stop -----------------
  const splashGone = () => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') || getComputedStyle(sp).display === 'none'; };
  document.addEventListener('click', (ev) => { if (ev.target.closest && ev.target.closest('.onboard #onNext')) onboardClicks++; }, true);
  function scan() {
    if (document.querySelector('.onboard')) { sawOnboard = true; return; }   // the cards are up: wait for the player to read them
    if (st.open || !splashGone()) return;
    // the game is saying something (a moment banner, a cinema flash): let it finish first. The class
    // stays on after the 1.7s pop, so it is a window from the moment it appears, not the class itself
    const pop = document.querySelector('#momentBanner.go, #cinemaFlash.go');
    if (pop) { if (!popSince || popEl !== pop) { popSince = Date.now(); popEl = pop; } if (Date.now() - popSince < 2200) return; } else { popSince = 0; popEl = null; }
    const menu = !!document.getElementById('rib-main-menu-v2');
    if (menu && armed && !queryDone && /[?&]coachTour\b/.test(location.search)) { queryDone = true; armed = false; resetSeen(); setEnabled(true); open('menu', { by: 'query' }); return; }
    if (menu && armed && sawOnboard && !welcomed && onboardClicks >= 3 && enabled()) {   // the cards clicked through (a fresh install is ON): the coach takes over
      welcomed = true; armed = false; resetSeen(); setEnabled(true); setTimeout(() => { if (!st.open && document.getElementById('rib-main-menu-v2')) open('menu', { by: 'welcome' }); }, 500); return; }
    if (state() !== 'on') {   // v122: the tour is off, but a season debrief is its own thing and still comes round
      const d = debriefDue(); if (!d || st.open) return;
      const S0 = STOPS.find((x) => x.id === 'debrief'); let fits = false; try { fits = S0.when(ctx()); } catch (e) {}
      if (!fits) { pendingId = null; clearTimeout(pending); pending = 0; return; }
      if (pendingId === 'debrief') return;
      clearTimeout(pending); pendingId = 'debrief';
      pending = setTimeout(() => { pending = 0; pendingId = null; if (st.open || !debriefDue()) return;
        let ok2 = false; try { ok2 = S0.when(ctx()); } catch (e) {}
        if (ok2) open('debrief', { by: 'season' }); }, S0.delay || 900);
      return;
    }
    const cur = currentStop(); if (!cur) { pendingId = null; clearTimeout(pending); pending = 0; return; }
    if (pendingId === cur.id) return;
    clearTimeout(pending); pendingId = cur.id;
    pending = setTimeout(() => { pending = 0; pendingId = null;
      if (st.open || !enabled() || seen().has(cur.id)) return;
      const again = currentStop(); if (!again || again.id !== cur.id) return;   // the screen moved on before he got there
      open(cur.id, { by: 'page' }); }, cur.delay || 650);
  }
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
  setInterval(scan, 500);
  window.addEventListener('rib-menu-unmounted', () => { armed = true; if (st.open && st.stop && st.stop.id === 'menu') close('menu'); });
  window.addEventListener('resize', () => { if (st.spot) spotOn(st.spot); });

  function estimateMs() {
    let ms = 0;
    STOPS.forEach((S0) => (S0.lines || []).forEach((L) => { const n = L.t.length, punct = (L.t.match(/[.!?]/g) || []).length, commas = (L.t.match(/[,;:]/g) || []).length;
      ms += 120 + n * TYPE_MS + punct * PUNCT_MS + commas * PUNCT_MS * 0.5 + HOLD_MS + HOLD_PER_CHAR * n; }));
    return ms;
  }

  window.__RIB_COACH = {
    open: (id, o) => open(id || 'menu', o), close: (w) => close(w || 'close'), toggle, next, back, tap, skip: () => finish('skip'), setAuto, setEnabled, setVoice, resetSeen, currentStop: () => { const c = currentStop(); return c ? c.id : null; },
    get enabled() { return enabled(); }, get isOpen() { return !!document.getElementById(ID); },
    get stop() { return st.stop ? st.stop.id : null; }, get chapter() { return st.stop ? st.stop.id : null; }, get line() { return st.open ? st.li : -1; }, get typing() { return st.typing; },
    get flips() { return st.flips; }, get spot() { return st.spot; }, get auto() { return st.auto; }, get seen() { return [...seen()]; },
    stops: STOPS.map((S0) => ({ id: S0.id, title: S0.title, lines: (S0.lines || (S0.id === 'debrief' && debriefLinesV122()) || []).length })), poses: POSES.slice(), estimateMs, key: KEY, seenKey: SEEN_KEY,
    debrief: { get: debrief, due: debriefDue, lines: debriefLinesV122, get off() { return debriefOff(); }, setOff: (v) => store.set(DEBRIEF_OFF, v ? 'off' : 'on'), key: DEBRIEF_OFF },
    voice: { setEnabled: setVoice, get enabled() { return voiceOn(); }, get blips() { return voice.blips; }, get state() { return voice.ctx ? voice.ctx.state : null; }, get mouthLog() { return voice.mouthLog.slice(); }, key: VOICE_KEY },
  };
})();
