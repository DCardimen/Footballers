/* ===== v151 E THE BAND PLAYS ===== */
/* The game's music: the owner's "Brass Anthem" (public/audio/brass_anthem.m4a — Opus in MP4, 48 kHz stereo,
 * 153.57 s; public/audio/brass_anthem.mp3 is a 128 kbps fallback for a browser that cannot play Opus-in-MP4)
 * on one gapless loop across the whole game — the menu, every career screen and the live game — plus the one
 * place every other sound's level is decided.
 *
 * THE LOOP. The file does not loop by itself: it opens on ~160 ms of silence and ends on a note still ringing
 * (RMS .16 → .05 over the last 400 ms, then an encoder fade in the last 10 ms), so `<audio loop>` would drop a
 * 160 ms hole after a cut-off note every 2½ minutes — and some browsers add their own gap on top. Measured once,
 * offline, off the decoded file: the first attack is at LOOP_START (0.161 s) and the tail is cut LOOP_END
 * (153.313 s), leaving XFADE_S (250 ms) of ring after it.
 *
 * STREAMED, NOT DECODED (the default, `mode: "stream"`). Two <audio> elements — deck A and deck B — play the one
 * file, each through a MediaElementAudioSourceNode and its own gain into the shared chain (fade → duck → master),
 * so volume, the duck and mute act on both. When the playing deck reaches LOOP_END the other deck (parked, paused,
 * already seeked to LOOP_START) starts, and the crossfade runs on the AudioContext clock: the outgoing tail falls
 * away on an equal-power cosine over XFADE_S while the incoming head rises on the sine quarter over XFADE_IN_S —
 * short, so the downbeat keeps its attack. The swap is armed by a 40 ms watch and fired by a timer aimed at the
 * exact moment (an `ended` on the outgoing deck fires it too, should a throttled timer be late). Memory is the
 * compressed file once (a Blob, fetched through the service worker's cache so it plays offline) and the two
 * elements' small decode windows. Measured (desktop Chromium, 3 runs each, 15 s after the gesture): the renderer
 * grows +2 MB streaming against +35 MB for the decoded 48 kHz buffer this replaced; the +78 MB audio-service
 * process that also appears is Chrome's, and it starts for any sound at all (a bare oscillator costs the same).
 *
 * FALLBACKS. If a media element cannot be routed into WebAudio (`createMediaElementSource` throws), the file is
 * decoded into an AudioBuffer on a 24 kHz context — half the memory of 48 kHz — and looped by one buffer source
 * with the tail spliced into the head (`mode: "buffer"`). With no WebAudio at all, one plain looping element
 * (`mode: "element"`; it may gap at the wrap).
 *
 * LOUDNESS. No re-encode (there is no ffmpeg on the build box): NORM (0.812) brings the measured −18.2 dBFS RMS
 * to −20, a bed under the game rather than a foreground track.
 *
 * WHEN IT PLAYS. Never before a user gesture (autoplay rules). The first trusted gesture creates the context and
 * plays deck A inside it (and primes deck B the same way — iOS lets an element play later only if a gesture
 * played it once). The file is fetched after the page has loaded and gone idle — never on the boot's critical
 * path. It fades in, pauses (both decks paused, the context suspended, the place kept) when the tab is hidden or
 * the native app is paused, and resumes on return. One pair of decks for the life of the page: view changes and
 * v140's boot restores never touch it, and a second copy of this file refuses to run (`window.RIB_MUSIC` guard).
 *
 * THE OTHER SOUNDS. `playSfx` and the growth blips (07), the broadcast stingers (05), the coach's voice
 * (rib-menu-coach.js) and the vault (rib-vault-audio.js) each make their own AudioContext. Each now asks
 * `RIB_MUSIC.sfxOut(ctx)` for its output (a one-line, bannered opt-in at the point it used to take
 * `ctx.destination`; before this file has loaded, or if it throws, the answer is `ctx.destination`, exactly the
 * old path). That output is one gain per context — the EFFECTS VOLUME and MUTE ALL — with an analyser on it, and
 * the analyser is how the music knows something else is sounding and DUCKS (a gentle dip, never a stop) under the
 * coach, the coins and the big moments. The loading film is muted (v114), so it never ducks anything.
 *
 * SETTINGS live in localStorage `rib.music.v151` ({music, vol, sfxVol, muteAll}) — a device preference like
 * `rib.coachVoice.v119` and `rib.vaultMute.v137`: it survives a new career and is readable before the career app
 * boots. The game's own `settings.sound` (SFX on/off, in the save) and `rib.coachVoice.v119` keep their keys.
 * Settings › SOUND is drawn by `soundCardV151E()` in 07; the speaker quick-mute sits in the career top bar and the
 * main menu's top bar. `window.RIB_MUSIC`; scripts/v151Echeck.mjs. */
(function () {
  'use strict';
  if (window.RIB_MUSIC) return;

  var KEY = 'rib.music.v151';
  var LOOP_START = 0.161, LOOP_END = 153.313;   // measured off the decoded file (see the header)
  var XFADE_S = 0.25, XFADE_IN_S = 0.04;        // the tail's ring-out, the head's rise
  var NORM = 0.812;                             // −18.2 dBFS RMS → −20
  var BUFFER_RATE = 24000;                      // the decode fallback's context rate (half the memory)
  var FADE_IN_S = 2.4, FADE_OUT_S = 0.35;
  var DUCK = 0.42, DUCK_ATTACK = 0.07, DUCK_RELEASE = 0.55, DUCK_HOLD_MS = 380, DUCK_LEVEL = 0.015;
  var IDLE_FETCH_MS = 2500, WATCH_MS = 40, ARM_S = 0.3, START_LEAD_MS = 12;
  var DEF = { music: true, vol: 0.5, sfxVol: 1, muteAll: false };

  var asset = function (p) { try { return window.__RIB_ASSET ? window.__RIB_ASSET(p) : './public/' + p; } catch (e) { return './public/' + p; } };
  var SOURCES = [
    { kind: 'm4a', url: asset('audio/brass_anthem.m4a'), type: 'audio/mp4; codecs="opus"' },
    { kind: 'mp3', url: asset('audio/brass_anthem.mp3'), type: 'audio/mpeg' }
  ];

  /* ---------- prefs ---------- */
  function readPrefs() {
    var p = {}; try { p = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { p = {}; }
    var clamp = function (v, d) { v = Number(v); return isFinite(v) ? Math.max(0, Math.min(1, v)) : d; };
    return { music: p.music !== false, vol: clamp(p.vol, DEF.vol), sfxVol: clamp(p.sfxVol, DEF.sfxVol), muteAll: p.muteAll === true };
  }
  var prefs = readPrefs();
  function writePrefs() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {} }

  /* ---------- the effects bus: the other sound paths ask for their output here ---------- */
  var buses = [];                 // { ctx, gain, an, data }
  function sfxLevel() { return prefs.muteAll ? 0 : prefs.sfxVol; }
  function sfxOut(ctx) {
    if (!ctx || !ctx.createGain) return null;
    for (var i = 0; i < buses.length; i++) if (buses[i].ctx === ctx) return buses[i].gain;
    try {
      var g = ctx.createGain(); g.gain.value = sfxLevel(); g.connect(ctx.destination);
      var an = null; try { an = ctx.createAnalyser(); an.fftSize = 256; g.connect(an); } catch (e) { an = null; }
      buses.push({ ctx: ctx, gain: g, an: an, data: an ? new Float32Array(an.fftSize) : null });
      return g;
    } catch (e) { return ctx.destination; }
  }
  function applySfx() {
    var v = sfxLevel();
    // a settings change, not a fade: set it outright (an idle graph is not processed, so a ramp would sit unread)
    buses.forEach(function (b) { try { b.gain.gain.cancelScheduledValues(0); } catch (e) {} try { b.gain.gain.value = v; } catch (e) {} });
  }

  /* ---------- state ---------- */
  var M = {
    state: 'idle',                // idle | loading | playing | paused | off | error
    mode: null,                   // stream | buffer | element
    ctx: null, master: null, duck: null, fade: null, an: null, anData: null,
    decks: [], cur: 0, swapT: 0, swapping: false, loops: 0, swaps: [],
    src: null, buf: null, loop: null, startAt: 0, startOff: 0,       // the buffer fallback
    el: null,                                                           // the element fallback
    blobUrl: null, kind: null, err: null,
    gestured: false, started: 0, hidden: false, nativePaused: false,
    duckOn: false, lastLoud: 0, ducks: 0, timer: 0, watch: 0
  };
  var wantPlay = function () { return prefs.music && !prefs.muteAll && !M.hidden && !M.nativePaused; };
  function now() { return M.ctx ? M.ctx.currentTime : 0; }
  function volTarget() { return prefs.muteAll || !prefs.music ? 0 : prefs.vol * NORM; }
  function ramp(param, v, tau) { try { param.cancelScheduledValues(now()); param.setTargetAtTime(v, now(), tau); } catch (e) { try { param.value = v; } catch (e2) {} } }
  function pickSource() {
    var a = document.createElement('audio');
    for (var i = 0; i < SOURCES.length; i++) if (a.canPlayType && a.canPlayType(SOURCES[i].type)) return SOURCES[i];
    return SOURCES[1];
  }

  /* the compressed file, once, as a Blob: through the service worker's cache (a media element's own range
   * requests bypass it), shared by both decks. Fetched when the page is idle; never decoded in this mode. */
  var fetching = null;
  function fetchTrack() {
    if (fetching) return fetching;
    var s = pickSource(); M.kind = s.kind;
    if (!window.fetch || !window.URL || !URL.createObjectURL) return (fetching = Promise.resolve(s.url));
    if (M.state === 'idle') M.state = 'loading';
    fetching = fetch(s.url).then(function (r) { if (!r.ok) throw new Error(r.status + ' ' + s.url); return r.blob(); })
      .then(function (b) { M.blobUrl = URL.createObjectURL(b); M.blobBytes = b.size; return M.blobUrl; }, function (e) { M.err = String(e && e.message || e); return s.url; });
    return fetching;
  }
  function srcNow() { if (M.blobUrl) return M.blobUrl; var s = pickSource(); M.kind = s.kind; return s.url; }

  function makeCtx(rate) {
    if (M.ctx) return M.ctx;
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    var opts = { latencyHint: 'playback' }; if (rate) opts.sampleRate = rate;
    try { M.ctx = new AC(opts); } catch (e) { try { M.ctx = new AC(); } catch (e2) { return null; } }
    M.master = M.ctx.createGain(); M.duck = M.ctx.createGain(); M.fade = M.ctx.createGain();
    M.master.gain.value = volTarget(); M.fade.gain.value = 0;
    M.fade.connect(M.duck); M.duck.connect(M.master); M.master.connect(M.ctx.destination);
    try { M.an = M.ctx.createAnalyser(); M.an.fftSize = 512; M.master.connect(M.an); M.anData = new Float32Array(M.an.fftSize); } catch (e) { M.an = null; }
    return M.ctx;
  }

  /* ---------- stream mode: two decks ---------- */
  function makeDecks() {
    if (M.decks.length) return true;
    var c = M.ctx;
    try {
      for (var i = 0; i < 2; i++) {
        var el = document.createElement('audio');
        el.preload = 'auto'; el.loop = false; el.setAttribute('playsinline', ''); el.src = srcNow();
        var node = c.createMediaElementSource(el), g = c.createGain(); g.gain.value = i === 0 ? 1 : 0;
        node.connect(g); g.connect(M.fade);
        M.decks.push({ el: el, node: node, g: g, i: i });
      }
    } catch (e) {
      M.decks.forEach(function (d) { try { d.el.removeAttribute('src'); d.el.load(); } catch (e2) {} });
      M.decks = []; M.err = 'mediaElementSource: ' + (e && e.message || e); return false;
    }
    M.decks.forEach(function (d) {
      d.el.addEventListener('ended', function () { if (M.decks[M.cur] === d && M.state === 'playing') swapStart('ended'); });
      d.el.addEventListener('error', function () {
        if (M.kind === 'm4a' && !d.fellBack) {       // Opus-in-MP4 refused after all: every deck to the mp3
          d.fellBack = true; M.kind = 'mp3'; M.blobUrl = null;
          M.decks.forEach(function (x) { x.fellBack = true; x.el.src = SOURCES[1].url; });
          if (M.state === 'playing') setTimeout(function () { park(M.decks[1 - M.cur]); var a = M.decks[M.cur]; a.el.currentTime = LOOP_START; a.el.play().catch(function () {}); }, 0);
        }
      });
    });
    M.mode = 'stream';
    return true;
  }
  function park(d) { if (!d) return; try { d.el.pause(); } catch (e) {} try { d.g.gain.cancelScheduledValues(0); d.g.gain.value = 0; } catch (e) {} try { d.el.currentTime = 0; } catch (e) {} }
  function loopEnd(el) { var d = el && el.duration; return isFinite(d) && d > 1 ? Math.min(LOOP_END, d - 0.02) : LOOP_END; }
  function curve(n, f) { var a = new Float32Array(n); for (var i = 0; i < n; i++) a[i] = f(i / (n - 1)); return a; }
  var OUT = curve(64, function (x) { return Math.cos(x * Math.PI / 2); }), IN = curve(16, function (x) { return Math.sin(x * Math.PI / 2); });
  /* the swap, in two steps. (1) When the playing deck A is LOOP_START short of LOOP_END, deck B starts from 0 —
   * the file's own silent lead-in — so however long B takes to get going (a media element's start latency is
   * tens to hundreds of ms and cannot be scheduled), it spends that time in silence. (2) The moment B's playhead
   * actually crosses LOOP_START (its first attack, polled every few ms), A's tail rings out on the cosine and
   * B comes up on the sine: the crossfade is keyed to B's real position, not to when we asked it to play. */
  function swapStart(why) {
    if (M.swapping || M.mode !== 'stream') return;
    var a = M.decks[M.cur], b = M.decks[1 - M.cur];
    M.swapping = true; clearTimeout(M.swapT); M.swapT = 0;
    try { b.g.gain.cancelScheduledValues(0); b.g.gain.value = 0; } catch (e) {}
    try { if (b.el.currentTime > 0.02) b.el.currentTime = 0; } catch (e) {}
    var p = b.el.play(); if (p && p.catch) p.catch(function () {});
    var t0 = Date.now(), done = false;
    var land = function (late) {
      if (done) return; done = true; clearInterval(poll);
      var t = now();
      try { b.g.gain.cancelScheduledValues(0); b.g.gain.setValueCurveAtTime(IN, t, XFADE_IN_S); } catch (e) { b.g.gain.value = 1; }
      try { a.g.gain.cancelScheduledValues(0); a.g.gain.setValueCurveAtTime(OUT, t, XFADE_S); } catch (e) { a.g.gain.value = 0; }
      M.swaps.push({ why: why + (late ? '+' + late : ''), at: Date.now(), out: +(a.el.currentTime || 0).toFixed(3), in: +(b.el.currentTime || 0).toFixed(3), waitMs: Date.now() - t0 });
      if (M.swaps.length > 8) M.swaps.shift();
      M.cur = 1 - M.cur; M.loops++;
      setTimeout(function () { park(a); M.swapping = false; }, XFADE_S * 1000 + 120);
    };
    var poll = setInterval(function () {
      if (M.state !== 'playing') return;
      if (b.el.currentTime >= LOOP_START - 0.008) land();
      else if (a.el.ended || a.el.currentTime >= (isFinite(a.el.duration) ? a.el.duration - 0.01 : 1e9)) land('aEnded');
      else if (Date.now() - t0 > 2000) land('timeout');       // B never started: hand over rather than hang
    }, 5);
  }
  function watch() {
    if (M.watch) return;
    M.watch = setInterval(function () {
      if (M.mode !== 'stream' || M.state !== 'playing' || M.swapping) return;
      var a = M.decks[M.cur]; if (!a || a.el.paused) return;
      var rem = loopEnd(a.el) - LOOP_START - a.el.currentTime;          // time until B must start from 0
      if (rem <= 0) { swapStart('late'); return; }
      if (rem <= ARM_S && !M.swapT) M.swapT = setTimeout(function () { M.swapT = 0; swapStart('timer'); }, Math.max(0, rem * 1000 - START_LEAD_MS));
    }, WATCH_MS);
  }

  /* ---------- buffer mode (the fallback when an element cannot be routed) ---------- */
  function spliceLoop(buf) {
    var sr = buf.sampleRate, n = buf.length, chs = [], c;
    for (c = 0; c < buf.numberOfChannels; c++) chs.push(buf.getChannelData(c));
    var head = Math.min(n - 1, Math.round(LOOP_START * sr)), end = Math.min(n, Math.round(LOOP_END * sr));
    var ov = Math.min(Math.round(XFADE_S * sr), n - end, Math.floor((end - head) / 4));
    for (var i = 0; i < ov; i++) { var f = Math.cos((i / ov) * Math.PI / 2); for (c = 0; c < chs.length; c++) chs[c][head + i] += chs[c][end + i] * f; }
    return { loopStart: head / sr, loopEnd: end / sr, period: (end - head) / sr, rate: sr };
  }
  function bufferMode() {
    // the stream context could not take an element: start over at the reduced rate, and decode
    try { M.ctx.close(); } catch (e) {}
    M.ctx = null; if (!makeCtx(BUFFER_RATE)) return Promise.reject(new Error('no WebAudio'));
    M.mode = 'buffer';
    return Promise.resolve(fetching || fetchTrack()).then(function (u) { return fetch(u); }).then(function (r) { return r.arrayBuffer(); })
      .then(function (ab) { return new Promise(function (res, rej) { var p = M.ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); }); })
      .then(function (buf) { M.loop = spliceLoop(buf); M.buf = buf; });
  }
  function startBuffer(offset) {
    var c = M.ctx, L = M.loop;
    if (M.src) { try { M.src.stop(); } catch (e) {} try { M.src.disconnect(); } catch (e) {} M.src = null; }
    var s = c.createBufferSource(); s.buffer = M.buf; s.loop = true; s.loopStart = L.loopStart; s.loopEnd = L.loopEnd; s.connect(M.fade);
    var off = offset == null ? L.loopStart : Math.max(0, Math.min(L.loopEnd - 0.01, offset));
    s.start(0, off); M.src = s; M.startAt = c.currentTime; M.startOff = off;
  }

  /* ---------- the element fallback (no WebAudio) ---------- */
  function playElement() {
    if (!M.el) { M.el = document.createElement('audio'); M.el.src = srcNow(); M.el.loop = true; M.el.preload = 'auto'; M.el.setAttribute('playsinline', ''); M.mode = 'element'; }
    M.el.volume = Math.max(0, Math.min(1, volTarget()));
    M.state = 'playing'; M.started = Math.max(M.started, 1);
    var p = M.el.play(); if (p && p.catch) p.catch(function () { M.state = 'paused'; });
    return Promise.resolve(true);
  }

  /* ---------- play / pause ---------- */
  function position() {
    if (M.mode === 'stream') { var d = M.decks[M.cur]; return { pos: d ? d.el.currentTime || 0 : 0, loops: M.loops }; }
    if (M.mode === 'buffer' && M.src && M.loop) {
      var L = M.loop, p = M.startOff + (now() - M.startAt);
      if (p < L.loopEnd) return { pos: p, loops: 0 };
      var k = (p - L.loopStart) / L.period; return { pos: L.loopStart + (k - Math.floor(k)) * L.period, loops: Math.floor((p - L.loopEnd) / L.period) + 1 };
    }
    if (M.el) return { pos: M.el.currentTime || 0, loops: 0 };
    return { pos: 0, loops: 0 };
  }
  function fadeUp() { M.master.gain.value = volTarget(); ramp(M.fade.gain, 1, FADE_IN_S / 3); M.state = 'playing'; tick(); }
  /* called inside a gesture when there is one: everything that must start in it starts synchronously */
  function play(why) {
    if (!wantPlay()) return Promise.resolve(false);
    if (!M.gestured) return Promise.resolve(false);
    if (M.mode === 'element') return playElement();
    var c = makeCtx(); if (!c) return playElement();
    try { if (c.state !== 'running') c.resume(); } catch (e) {}
    if (!M.mode && !makeDecks()) {                                   // cannot route an element: decode instead
      M.state = 'loading';
      return bufferMode().then(function () { return play(why); }, function (e) { M.err = String(e && e.message || e); M.mode = 'element'; return playElement(); });
    }
    if (M.mode === 'stream') {
      var a = M.decks[M.cur], b = M.decks[1 - M.cur];
      if (!M.started) {
        M.started = 1;
        try { a.el.currentTime = LOOP_START; } catch (e) {}
        // prime the parked deck inside this gesture (iOS), silent through its own gain
        var pb = b.el.play(); if (pb && pb.then) pb.then(function () { if (!M.swapping && M.decks[M.cur] !== b) park(b); }, function () {});
      }
      if (a.el.paused) { var pa = a.el.play(); if (pa && pa.catch) pa.catch(function (e) { M.err = String(e && e.message || e); M.state = 'paused'; }); }
      fadeUp(); watch();
      return Promise.resolve(true);
    }
    if (M.mode === 'buffer') {
      if (!M.buf) return Promise.resolve(false);
      if (!M.src) { startBuffer(); M.started = 1; M.fade.gain.value = 0; }
      fadeUp(); return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }
  function pause(why) {
    if (M.mode === 'element') { if (M.el) try { M.el.pause(); } catch (e) {} if (M.state === 'playing') M.state = why === 'off' ? 'off' : 'paused'; return; }
    if (!M.ctx) { if (M.state === 'playing') M.state = 'paused'; return; }
    var was = M.state; M.state = why === 'off' ? 'off' : 'paused';
    if (was !== 'playing') return;
    ramp(M.fade.gain, 0, FADE_OUT_S / 3);
    var c = M.ctx, ticket = (M.pauseTicket = (M.pauseTicket || 0) + 1);
    setTimeout(function () {
      if (M.pauseTicket !== ticket || M.state === 'playing') return;
      if (M.mode === 'stream') {                                      // a swap in flight: land it, then hold
        clearTimeout(M.swapT); M.swapT = 0;
        if (M.swapping) { park(M.decks[1 - M.cur]); M.swapping = false; }
        try { M.decks[M.cur].el.pause(); } catch (e) {}
      }
      try { c.suspend(); } catch (e) {}
    }, FADE_OUT_S * 1000 + 60);
  }

  /* ---------- the duck: something else is sounding ---------- */
  function loudElsewhere() {
    for (var i = 0; i < buses.length; i++) {
      var b = buses[i]; if (!b.an || b.ctx.state !== 'running') continue;
      try { b.an.getFloatTimeDomainData(b.data); } catch (e) { continue; }
      for (var j = 0; j < b.data.length; j += 2) if (Math.abs(b.data[j]) > DUCK_LEVEL) return true;
    }
    return false;
  }
  function tick() {
    if (M.timer) return;
    M.timer = setInterval(function () {
      if (M.state !== 'playing') { clearInterval(M.timer); M.timer = 0; if (M.duck) ramp(M.duck.gain, 1, 0.05); M.duckOn = false; return; }
      var t = Date.now();
      if (loudElsewhere()) M.lastLoud = t;
      var on = t - M.lastLoud < DUCK_HOLD_MS || t < (M.duckUntil || 0);
      if (on !== M.duckOn) { M.duckOn = on; if (on) M.ducks++; if (M.duck) ramp(M.duck.gain, on ? DUCK : 1, on ? DUCK_ATTACK : DUCK_RELEASE); }
      if (M.el) M.el.volume = Math.max(0, Math.min(1, volTarget() * (on ? DUCK : 1)));
    }, 110);
  }

  /* ---------- the gesture, the tab, the app ---------- */
  var GESTURES = ['pointerdown', 'touchend', 'keydown', 'click'];
  function onGesture(ev) {
    if (ev && ev.isTrusted === false) return;
    M.gestured = true;
    if (!wantPlay()) return;
    if (M.state !== 'playing' || (M.ctx && M.ctx.state !== 'running')) play('gesture');
    if (M.state === 'playing') GESTURES.forEach(function (g) { document.removeEventListener(g, onGesture, true); });
  }
  GESTURES.forEach(function (g) { document.addEventListener(g, onGesture, { capture: true, passive: true }); });
  // after that one is consumed, a cheap listener for iOS interruptions (a call suspends the context)
  document.addEventListener('pointerdown', function (ev) {
    if (!ev.isTrusted) return; M.gestured = true;
    if (M.ctx && M.ctx.state !== 'running' && M.state === 'playing' && wantPlay()) play('interrupted');
  }, { capture: true, passive: true });

  function onVisibility() {
    var hid = document.visibilityState === 'hidden';
    if (hid === M.hidden) return; M.hidden = hid;
    if (hid) pause('hidden'); else if (M.gestured) play('visible');
  }
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', function () { M.hidden = true; pause('hidden'); });
  window.addEventListener('pageshow', function () { if (document.visibilityState !== 'hidden') { M.hidden = false; if (M.gestured) play('visible'); } });
  (function nativeHooks() {
    var App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (!App || !App.addListener) return;
    try { App.addListener('pause', function () { M.nativePaused = true; pause('native'); }); } catch (e) {}
    try { App.addListener('resume', function () { M.nativePaused = false; if (M.gestured) play('native'); }); } catch (e) {}
  })();

  /* fetch (not decode) once the page is loaded and idle — never on the boot's critical path */
  function idleFetch() {
    if (!prefs.music || prefs.muteAll) return;
    var go = function () { fetchTrack(); };
    if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 4000 }); else go();
  }
  if (document.readyState === 'complete') setTimeout(idleFetch, IDLE_FETCH_MS);
  else window.addEventListener('load', function () { setTimeout(idleFetch, IDLE_FETCH_MS); });

  /* ---------- the controls ---------- */
  function refreshUi() {
    var off = prefs.muteAll || !prefs.music;
    document.querySelectorAll('.mute-v151e').forEach(function (b) {
      var all = prefs.muteAll; b.classList.toggle('off', all); b.setAttribute('aria-pressed', String(all));
      b.title = all ? 'Sound is muted — tap to unmute' : 'Mute all sound'; b.setAttribute('aria-label', b.title);
    });
    var set = function (id, on) { var el = document.getElementById(id); if (el) { var sw = el.querySelector('.switch'); if (sw) sw.classList.toggle('on', !!on); } };
    set('sndMusicV151E', prefs.music); set('sndMuteV151E', prefs.muteAll);
    var v = function (id, x) { var el = document.getElementById(id); if (el) el.textContent = Math.round(x * 100) + '%'; };
    v('sndVolV151E_val', prefs.vol); v('sndSfxV151E_val', prefs.sfxVol);
    var card = document.getElementById('soundCardV151E'); if (card) card.classList.toggle('muted-v151e', !!prefs.muteAll);
    return off;
  }
  function applyMusic() {
    if (M.master) ramp(M.master.gain, volTarget(), 0.05);
    if (M.el) M.el.volume = Math.max(0, Math.min(1, volTarget()));
    if (wantPlay()) { if (M.state !== 'playing' || (M.ctx && M.ctx.state !== 'running')) play('setting'); }
    else if (M.state === 'playing' || M.state === 'ready' || M.state === 'loading') pause('off');
  }
  var api = {
    play: function () { if (!prefs.music) { prefs.music = true; writePrefs(); } if (prefs.muteAll) { prefs.muteAll = false; writePrefs(); applySfx(); } refreshUi(); return play('api'); },
    pause: function () { pause('api'); },
    setVolume: function (v) { prefs.vol = Math.max(0, Math.min(1, Number(v) || 0)); writePrefs(); applyMusic(); refreshUi(); return prefs.vol; },
    setEnabled: function (b) { prefs.music = !!b; writePrefs(); applyMusic(); refreshUi(); return prefs.music; },
    setSfxVolume: function (v) { prefs.sfxVol = Math.max(0, Math.min(1, Number(v) || 0)); writePrefs(); applySfx(); refreshUi(); return prefs.sfxVol; },
    setMuteAll: function (b) { prefs.muteAll = !!b; writePrefs(); applySfx(); applyMusic(); refreshUi(); return prefs.muteAll; },
    toggleMuteAll: function () { return api.setMuteAll(!prefs.muteAll); },
    duck: function (ms) { M.duckUntil = Date.now() + (ms || 1200); },
    prefs: function () { return { music: prefs.music, vol: prefs.vol, sfxVol: prefs.sfxVol, muteAll: prefs.muteAll }; },
    loopInfo: function () {
      return { mode: M.mode, loopStart: M.loop ? M.loop.loopStart : LOOP_START, loopEnd: M.loop ? M.loop.loopEnd : LOOP_END, xfadeS: XFADE_S, xfadeInS: XFADE_IN_S, norm: NORM,
        duration: M.decks[0] && isFinite(M.decks[0].el.duration) ? M.decks[0].el.duration : null, rate: M.ctx ? M.ctx.sampleRate : null };
    },
    state: function () {
      var p = position();
      var level = 0; if (M.an && M.state === 'playing') { try { M.an.getFloatTimeDomainData(M.anData); for (var i = 0; i < M.anData.length; i++) level = Math.max(level, Math.abs(M.anData[i])); } catch (e) {} }
      return { state: M.state, mode: M.mode, enabled: prefs.music, muteAll: prefs.muteAll, volume: prefs.vol, sfxVolume: prefs.sfxVol, gestured: M.gestured,
        ctx: M.ctx ? M.ctx.state : null, kind: M.kind, error: M.err, fetched: !!fetching, blobBytes: M.blobBytes || 0, decoded: !!M.buf, started: M.started,
        decks: M.decks.length, playingDecks: M.decks.filter(function (d) { return !d.el.paused; }).length, cur: M.cur, swapping: M.swapping, swaps: M.swaps.slice(),
        position: +p.pos.toFixed(3), loops: p.loops, gain: M.master ? +M.master.gain.value.toFixed(4) : null,
        fade: M.fade ? +M.fade.gain.value.toFixed(4) : null, ducking: M.duckOn, ducks: M.ducks, level: +level.toFixed(4), hidden: M.hidden, buses: buses.length,
        sfxGains: buses.map(function (b) { return +b.gain.gain.value.toFixed(3); }) };
    },
    /* the other sound paths' output (see the header): one gain + analyser per context */
    sfxOut: sfxOut,
    /* for the check: move the playing deck (the wrap is 150 s away otherwise) */
    _seek: function (sec) {
      if (M.mode === 'stream' && M.decks[M.cur]) { M.decks[M.cur].el.currentTime = sec; return true; }
      if (M.mode === 'buffer' && M.buf) { startBuffer(sec); return true; }
      return false;
    },
    /* for the check: the level on the music bus right now (RMS over the analyser's window) */
    _rms: function () { if (!M.an) return 0; try { M.an.getFloatTimeDomainData(M.anData); } catch (e) { return 0; } var t = 0; for (var i = 0; i < M.anData.length; i++) t += M.anData[i] * M.anData[i]; return Math.sqrt(t / M.anData.length); },
    refreshUi: refreshUi,
    key: KEY
  };
  window.RIB_MUSIC = api;
  window.ribSoundPrefsV151E = api.prefs;
  document.addEventListener('DOMContentLoaded', refreshUi);
  setTimeout(refreshUi, 0);

  /* ---------- the ♪ on the main menu's top bar (the menu redraws itself; a slow tick re-mounts it) ---------- */
  function menuButton() {
    var bar = document.querySelector('#rib-main-menu-v2 .rib9-topbar');
    if (!bar || bar.querySelector('.mute-v151e')) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'mute-v151e menu-v151e';
    b.innerHTML = MUTE_SVG; b.onclick = function (e) { e.stopPropagation(); api.toggleMuteAll(); };
    bar.classList.add('has-mute-v151e'); bar.appendChild(b); refreshUi();
  }
  var MUTE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="spk" d="M4 9h4l5-4v14l-5-4H4z"/><path class="wav" d="M16 8.5a5 5 0 0 1 0 7M18.6 6a8.6 8.6 0 0 1 0 12"/><path class="x" d="M16 9l6 6M22 9l-6 6"/></svg>';
  window.__MUTE_SVG_V151E = MUTE_SVG;
  setInterval(menuButton, 600);
  function topButton() {
    var b = document.getElementById('muteV151E'); if (b && !b.firstChild) { b.innerHTML = MUTE_SVG; refreshUi(); }
  }
  topButton(); document.addEventListener('DOMContentLoaded', topButton);
})();

/* the Settings › SOUND card's handlers (called from inline onclick/oninput; hoisted so a render can never outrun them) */
function ribSoundV151E(what, v) {
  var M = window.RIB_MUSIC; if (!M) return;
  var p = M.prefs();
  if (what === 'music') M.setEnabled(!p.music);
  else if (what === 'vol') M.setVolume(v);
  else if (what === 'sfxVol') M.setSfxVolume(v);
  else if (what === 'muteAll') M.setMuteAll(!p.muteAll);
}
function ribMuteToggleV151E(ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); if (window.RIB_MUSIC) window.RIB_MUSIC.toggleMuteAll(); }
