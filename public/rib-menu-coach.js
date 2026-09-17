(() => {
  'use strict';
  /* ===== v119 THE COACH — he pops in on every screen of your first week =====
   * A talking head who walks a new player through ONE FULL WEEK, one screen at a time: the main
   * menu, the personality roll, the position pick, the hub, the season-commitment wheel, the
   * training board, the season screen, the weekly-plan wheel, the four-step pregame, the broadcast,
   * the post-game card, and the body after the game. Each STOP is a few lines said over the page it belongs to — the page dims, stays there
   * behind him, and a spotlight can cut through the dim onto the button or card he is talking
   * about — and then he leaves and the player gets on with it. He never repeats a stop; when the
   * last one is said he switches himself off.
   *
   * The coach is the three uploaded sheets cut into public/coach/ (build-coach-art.py): fifteen
   * poses, each drawn mouth-closed (`_a`) and mouth-open (`_b`), the open one being the closed
   * drawing with only the head pasted over, so nothing but the face moves. A line TYPES while the
   * mouth moves in the shape of speech — a syllable open, a beat closed, a longer close at a word
   * gap or a stop, the odd double snap, never a metronome — and his VOICE is a muddle of pitched
   * blips synthesised on the spot with WebAudio (no sound file), one per letter at a syllable
   * rate, not cut to the mouth. VOICE in the bubble mutes him (`rib.coachVoice.v119`).
   *
   * What he says is the HOW TO PLAY guide's own facts — every number is the guide's — but only
   * the two or three that matter on THAT screen, in a football coach's voice.
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
    career: '#rib-main-menu-v2 .rib9-tiles .rib9-tile:nth-child(1)', coach: '#rib-main-menu-v2 .rib9-tiles [data-rib-action="coach"]', howto: '#rib-main-menu-v2 .rib9-tiles [data-rib-action="howto"]',
    lockIn: 'text:Lock In Personality', posCards: '.pos-card', playSeason: 'text:Play \\d+-Game Season', confirm: 'text:CONFIRM TRAINING', playWeek: 'text:Play Week \\d+ Live',
    cont: '#gv42go', next: 'text:^NEXT', speed: '.speed-btn', body: '#screen .condition-card-v11', hubTabs: '#screen .tabs, #screen [class*="tab"]',
  };

  // ---- the stops: one per screen, in the order a first week meets them ---------------------------
  // { id, title, sub, when(ctx) → bool, lines: [{ p: pose, t: text, s?: spotlight key }], delay?, last? }
  // ctx: { view, menu, wheel, pregame, post, persona, live }
  const STOPS = [
    { id: 'menu', title: 'THE MENU', sub: 'KICKOFF', when: (c) => c.menu && !c.persona, lines: [
      { p: 'welcome', t: "Alright, rookie. I'm Coach. I'll pop in on every screen of your first week, say my piece, and get out of your way." },
      { p: 'listen', t: "Tap my bubble to hurry me up. SKIP TOUR sends me off for good; the COACH'S TOUR tile on this menu brings me back.", s: 'coach' },
      { p: 'armscrossed', t: "The short version: one player, nine levels, and every level keeps only a share of the men in it. Careers are meant to end. Prestige is what carries over." },
      { p: 'point', t: "Tap CAREER. Let's build a man.", s: 'career' },
    ] },
    { id: 'persona', title: 'WHO YOU ARE', sub: 'THE PERSONALITY ROLL', when: (c) => c.persona, lines: [
      { p: 'clipboard', t: "The dice rolled who this kid is. Every trait has two identities, and each side raises the max level of its own stats and carries its own drawback." },
      { p: 'thinkcap', t: "Personality also loads the wheel you'll spin before every game, so what he'd actually do matters more than what sounds good." },
      { p: 'thumbsup', t: "You get no adjustment points on a first run — they come with prestige. Lock it in.", s: 'lockIn' },
    ] },
    { id: 'position', title: 'YOUR POSITION', sub: 'THE BODY HE WAS DEALT', when: (c) => c.view === 'choosePos' && !c.persona, lines: [
      { p: 'whoa', t: "The one that matters most. Body fit is worth about minus 21 to plus 13 OVR, it costs nothing, and it lasts the whole career." },
      { p: 'tip', t: "The scouts grade the frame he is GOING to get — the projection up top — so the fit number under each position reads that, not today's kid.", s: 'posCards' },
      { p: 'stop', t: "Take the position the number likes, not the one you like on Sundays. And if two traits are offered, pick one; lock a position and the game picks for you." },
    ] },
    { id: 'hub', title: 'HOME BASE', sub: 'THE HUB', when: (c) => c.view === 'hub', lines: [
      { p: 'open', t: "Home base. NOW, BODY, SKILLS, TEAM and STORY are your week. Your rating, your ceiling and the depth chart live here." },
      { p: 'listen', t: "Coach trust starts around 28 — you're a stranger to me too. It moves by performance minus 50, over 13, every game, and it sets your snaps." },
      { p: 'point', t: "Snaps cap your grade: under a 12% share you cannot grade above 76. Climb the chart early. Now start the season.", s: 'playSeason' },
    ] },
    { id: 'wheel', title: 'THE WHEEL', sub: 'YOUR HABITS, THEN FATE ROLLS', when: (c) => c.wheel && !c.planWheel, lines: [   // over the training board, off PLAY SEASON
      { p: 'clipboard', t: "The wheel. Your habits for the season, and then fate rolls. Personality loads the odds — the FIT ROLL is whether the commitment suits the man you rolled." },
      { p: 'tip', t: "Each habit lists the stats it pushes, how long it runs, and its risk: LIGHT, COMMITTED or OBSESSIVE. Obsessive pays more and breaks more." },
      { p: 'listen', t: "Then the TRAINING ROLL. PAYS keeps the full gain and can mint a permanent bump. HALF gives you half. BACKFIRES flips the gain into a loss." },
      { p: 'stop', t: "Trust, momentum and composure nudge it green. Fatigue drags it red — at 70, fatigue is nearly the whole downside. Never spin worn. It spins on its own; tap it to hurry it, then CONTINUE when the roll is in.", s: 'cont' },
    ] },
    { id: 'training', title: 'THE OFFSEASON', sub: 'CHOOSE YOUR TRAINING', when: (c) => c.view === 'training' && !c.wheel, lines: [
      { p: 'clipboard', t: "The training board. Tap a program to PREVIEW the season it gives you — the light blue on the bars is what it adds. Nothing is locked until you confirm." },
      { p: 'tip', t: "Follow the game's own suggestion: Conditioning if your durability is low for the level, otherwise the program on your weakest weighted stat." },
      { p: 'shrug', t: "The price line under each stat is real — one point under the soft cap, then 2, 3, 4. The risk labels on the cards are not; nothing in the sim reads them. Confirm it.", s: 'confirm' },
    ] },
    { id: 'season', title: 'THE SEASON', sub: 'THE SCHEDULE AND YOUR BODY', when: (c) => c.view === 'season' && !c.wheel && !c.pregame && !c.post, lines: [
      { p: 'open', t: "The season screen. The schedule, the scouting read on the next opponent, and YOUR BODY: fatigue, injury risk and the wear the season puts on him.", s: 'body' },
      { p: 'listen', t: "Fatigue is the dial you control. 70 and above you're worn — minus 10% on everything. 25 and under you're fresh, plus 5%. Sitting a game sheds 22." },
      { p: 'firedup', t: "Play Week 1 live. I want to see it.", s: 'playWeek' },
    ] },
    { id: 'plan', title: 'THE WEEKLY PLAN', sub: 'ROLLED, NOT CHOSEN', when: (c) => c.planWheel, lines: [   // off PLAY WEEK, before the wizard
      { p: 'clipboard', t: "Game week. The staff hands you options and the wheel picks your weekly plan — rolled, weighted by your personality, not chosen." },
      { p: 'tip', t: "Each plan trades performance for variance, snaps and trust. Disciplined Execution is plus 2 and steady. Chase the Highlight is plus 7 at 1.72 times the variance, and it costs a point of trust." },
      { p: 'thumbsup', t: "Do the Dirty Work is the trust play: minus 1 on the day, plus 3 with me. Tap the wheel to hurry it, then CONTINUE.", s: 'cont' },
    ] },
    { id: 'pregame', title: 'BEFORE KICKOFF', sub: 'FOUR STEPS', when: (c) => c.pregame && !c.wheel, lines: [
      { p: 'clipboard', t: "Four steps before the game. Step one, YOUR INVOLVEMENT, LIMITED to EVERY: below NORMAL you come off the field and the body keeps what it saves; above it, more of the ball and more of the bill." },
      { p: 'tip', t: "Step two, a GAME FOCUS: one stat at times 1.2, this game only. Step three, the scout and the coordinator's plan — the bar says how much of your lean he runs." },
      { p: 'point', t: "That bar reads low on purpose. The script moves further your way than the number says. Trust the mechanism, not the bar." },
      { p: 'thumbsup', t: "Step four is the impact sheet — what you actually carry onto the field. Then CONTINUE TO MATCH.", s: 'next' },
    ] },
    { id: 'live', title: 'THE BROADCAST', sub: 'WATCH IT', when: (c) => c.live && !c.post, delay: 2600, lines: [
      { p: 'open', t: "The broadcast. The season plays itself around you — watch the man in your colours with the ring under his feet." },
      { p: 'listen', t: "Half, one, two and four times set the pace; SKIP jumps to the whistle. Your live box score is under the field, the full stats past it.", s: 'speed' },
      { p: 'relaxed', t: "I'll see you at the final whistle." },
    ] },
    { id: 'result', title: 'THE CARD', sub: 'AFTER THE WHISTLE', when: (c) => c.post, lines: [
      { p: 'clipboard', t: "The card. Your grade is measured against the HIGHEST of four bars, and prestige raises it — every success makes the next A harder to earn." },
      { p: 'listen', t: "Coach trust moved by performance minus 50, over 13. Snaps follow trust, production follows snaps, and your national rank follows production." },
      { p: 'point', t: "And the body took a game. Look at YOUR BODY before you pick next week's load." },
    ] },
    { id: 'recovery', title: 'RECOVERY', sub: 'THE BODY AFTER A GAME', when: (c) => c.view === 'season' && !c.wheel && !c.pregame && !c.post && c.seen.has('result'), lines: [
      { p: 'open', t: "Back on the season screen with a game on the body. WEAR & TEAR counts the load; NEXT GAME prices the injury risk at each involvement.", s: 'body' },
      { p: 'stop', t: "Worn is minus 10% on every attribute AND minus 10% on the grade, and a knock that costs no games still trips it. Recovery & Treatment sheds about 11.6 fatigue a week." },
      { p: 'welcome', t: "That's your first week. I'm switching this tour off — the COACH'S TOUR tile on the menu brings me back. Now go get hit." },
    ], last: true },
  ];

  // ---- state ----------------------------------------------------------------------------------
  const st = { open: false, stop: null, li: 0, typing: false, auto: true, timer: 0, mouth: 0, raf: 0, spot: null, flips: 0, text: '', pos: 0, preloaded: false };
  let armed = true, queryDone = false, onboardClicks = 0, sawOnboard = false, welcomed = false, pending = 0, pendingId = null;

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
  function currentStop() { const c = ctx(); for (const S0 of STOPS) { if (c.seen.has(S0.id)) continue; try { if (S0.when(c)) return S0; } catch (e) { /* a page mid-render */ } } return null; }

  // ---- markup ---------------------------------------------------------------------------------------
  function markup() {
    return `<div class="rib-coach-dim"></div>
      <div class="rib-coach-spot" data-c-spot hidden></div>
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
  const line = () => st.stop.lines[st.li];
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
    const els = [...document.querySelectorAll(spec)].filter(shown); return els[0] || null;
  }
  function scroller(el) {
    for (let p = el && el.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 4) return p; }
    return null;
  }
  function spotOn(key) {
    cancelAnimationFrame(st.raf); st.spot = key || null;
    const spot = q('[data-c-spot]'), dim = q('.rib-coach-dim'); if (!spot) return;
    const off = () => { spot.hidden = true; if (dim) dim.hidden = false; };
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
      if (!el) { spot.hidden = true; if (dim) dim.hidden = false; st.raf = requestAnimationFrame(tick); return; }
      if (!scrolled) bring(el);
      if (dim) dim.hidden = true; spot.hidden = false;
      const r = el.getBoundingClientRect(), pad = 6;
      spot.style.left = (r.left - pad) + 'px'; spot.style.top = (r.top - pad) + 'px'; spot.style.width = (r.width + pad * 2) + 'px'; spot.style.height = (r.height + pad * 2) + 'px';
      st.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  // ---- playing a line ---------------------------------------------------------------------------------------
  function show() {
    const root = document.getElementById(ID); if (!root || !st.stop) return;
    const S0 = st.stop, L = line(), i = stopIndex(S0.id), lastLine = st.li === S0.lines.length - 1;
    q('[data-c-crumb]').textContent = (i + 1) + ' / ' + STOPS.length + ' · ' + S0.title;
    q('[data-c-ch]').textContent = S0.title; q('[data-c-sub]').textContent = S0.sub;
    q('[data-c-bar]').style.width = Math.round(100 * (i + (st.li + 1) / S0.lines.length) / STOPS.length) + '%';
    q('[data-c-back]').disabled = st.li === 0;
    q('[data-c-next]').textContent = lastLine ? (S0.last ? 'DONE ✓' : 'GOT IT ›') : 'NEXT ›';
    root.dataset.stop = S0.id; root.dataset.pose = L.p;
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
    if (st.auto && st.stop && st.li < st.stop.lines.length - 1) st.timer = setTimeout(next, HOLD_MS + HOLD_PER_CHAR * st.text.length);
  }
  function tap() { if (st.typing) done(); else next(); }
  function next() {
    clearTimeout(st.timer); if (!st.stop) return;
    if (st.li < st.stop.lines.length - 1) { st.li++; show(); return; }
    const S0 = st.stop; markSeen(S0.id);
    if (S0.last) { finish('done'); return; }
    close('gotit');
  }
  function back() { clearTimeout(st.timer); if (st.li > 0) { st.li--; show(); } }
  function setAuto(v) { st.auto = !!v; const b = q('[data-c-auto]'); if (b) { b.classList.toggle('on', st.auto); b.setAttribute('aria-pressed', String(st.auto)); } if (st.auto && !st.typing && st.stop && st.li < st.stop.lines.length - 1) st.timer = setTimeout(next, HOLD_MS); if (!st.auto) clearTimeout(st.timer); }

  // ---- open / close -------------------------------------------------------------------------------------------
  function open(stopId, opts) {
    if (document.getElementById(ID)) return true;
    const S0 = STOPS.find((x) => x.id === stopId); if (!S0) return false;
    const root = document.createElement('div');
    root.id = ID; root.className = 'rib-coach'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'The coach'); root.tabIndex = -1;
    root.innerHTML = markup();
    document.body.appendChild(root); document.body.classList.add('rib-coach-open');
    st.open = true; st.stop = S0; st.li = 0; st.flips = 0; st.auto = !(opts && opts.auto === false);
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
  function finish(why) { setEnabled(false); close(why || 'done'); }   // the walk is over, or skipped: the switch goes OFF and remembers

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
    const menu = !!document.getElementById('rib-main-menu-v2');
    if (menu && armed && !queryDone && /[?&]coachTour\b/.test(location.search)) { queryDone = true; armed = false; resetSeen(); setEnabled(true); open('menu', { by: 'query' }); return; }
    if (menu && armed && sawOnboard && !welcomed && onboardClicks >= 3 && enabled()) {   // the cards clicked through (a fresh install is ON): the coach takes over
      welcomed = true; armed = false; resetSeen(); setEnabled(true); setTimeout(() => { if (!st.open && document.getElementById('rib-main-menu-v2')) open('menu', { by: 'welcome' }); }, 500); return; }
    if (state() !== 'on') return;                                        // only a walk switched on by hand (or by the cards) follows the screens
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
    STOPS.forEach((S0) => S0.lines.forEach((L) => { const n = L.t.length, punct = (L.t.match(/[.!?]/g) || []).length, commas = (L.t.match(/[,;:]/g) || []).length;
      ms += 120 + n * TYPE_MS + punct * PUNCT_MS + commas * PUNCT_MS * 0.5 + HOLD_MS + HOLD_PER_CHAR * n; }));
    return ms;
  }

  window.__RIB_COACH = {
    open: (id, o) => open(id || 'menu', o), close: (w) => close(w || 'close'), toggle, next, back, tap, skip: () => finish('skip'), setAuto, setEnabled, setVoice, resetSeen, currentStop: () => { const c = currentStop(); return c ? c.id : null; },
    get enabled() { return enabled(); }, get isOpen() { return !!document.getElementById(ID); },
    get stop() { return st.stop ? st.stop.id : null; }, get chapter() { return st.stop ? st.stop.id : null; }, get line() { return st.open ? st.li : -1; }, get typing() { return st.typing; },
    get flips() { return st.flips; }, get spot() { return st.spot; }, get auto() { return st.auto; }, get seen() { return [...seen()]; },
    stops: STOPS.map((S0) => ({ id: S0.id, title: S0.title, lines: S0.lines.length })), poses: POSES.slice(), estimateMs, key: KEY, seenKey: SEEN_KEY,
    voice: { setEnabled: setVoice, get enabled() { return voiceOn(); }, get blips() { return voice.blips; }, get state() { return voice.ctx ? voice.ctx.state : null; }, get mouthLog() { return voice.mouthLog.slice(); }, key: VOICE_KEY },
  };
})();
