/* ===== v151 E THE BAND PLAYS ===== */
/* The game's music: the owner's "Brass Anthem" (public/audio/brass_anthem.m4a — Opus in MP4, 48 kHz stereo,
 * 153.57 s; public/audio/brass_anthem.mp3 is a 128 kbps fallback for a browser that cannot decode Opus-in-MP4)
 * on one seamless loop across the whole game — the menu, every career screen and the live game — plus the
 * one place every sound's level is decided.
 *
 * THE LOOP. The file does not loop by itself: it opens on ~150 ms of silence and ends on a note still ringing
 * (measured: RMS .16 → .05 over the last 400 ms, then an encoder fade in the last 10 ms), so `<audio loop>`
 * would drop a 150 ms hole after a cut-off note every 2½ minutes — and some browsers add their own gap on top.
 * So the track is DECODED once into an AudioBuffer and played by ONE AudioBufferSourceNode with `loop = true`:
 * `loopStart` is the first attack, `loopEnd` is the tail minus an overlap window, and the last `OVERLAP_S` of the
 * tail is mixed (cosine fade) into the first `OVERLAP_S` after `loopStart`, in place — so at the wrap the last
 * note rings on into the downbeat instead of into silence. No second buffer, no timers, sample-accurate.
 * `loopInfo()` says where the points landed and the RMS either side of the wrap before and after the splice.
 *
 * LOUDNESS. No re-encode (there is no ffmpeg on the build box): the track is normalised in code — its RMS is
 * measured once at decode and `norm` brings it to `TARGET_DB` (a bed under the game, not a foreground track).
 *
 * WHEN IT PLAYS. Never before a user gesture (autoplay rules; iOS WebAudio unlock plays one silent sample inside
 * the gesture). The file is fetched after the page has loaded and gone idle (or at the first gesture, whichever
 * is first) — never on the boot's critical path — and decoded on the gesture. It fades in, pauses (the context
 * SUSPENDS, keeping its place) when the tab is hidden or the native app is paused, and resumes on return.
 * There is ONE source for the life of the page: view changes and v140's boot restores never touch it, and a
 * second copy of this file refuses to run (`window.RIB_MUSIC` guard).
 *
 * THE OTHER SOUNDS. The game's other audio — `playSfx` and the growth blips (07), the broadcast stingers (05),
 * the coach's voice (rib-menu-coach.js), the vault (rib-vault-audio.js) — each make their own AudioContext and
 * connect to its `destination`. This file routes every such connection through one gain per context (a patch on
 * `AudioNode.prototype.connect` / `disconnect`, installed before any of them makes a sound): that gain is the
 * EFFECTS VOLUME and MUTE ALL, and an analyser on it is how the music knows something else is talking and DUCKS
 * (a gentle dip, never a stop) under the coach, the coins and the big moments. The loading film is muted
 * (v114), so it never ducks anything.
 *
 * SETTINGS live in localStorage `rib.music.v151` ({music, vol, sfxVol, muteAll}) — a device preference like
 * `rib.coachVoice.v119` and `rib.vaultMute.v137`: it survives a new career and is readable before the career app
 * boots. The game's own `settings.sound` (SFX on/off, in the save) and `rib.coachVoice.v119` keep their keys.
 * Settings › SOUND is drawn by `soundCardV151E()` in 07; the ♪ quick mute sits in the career top bar and the
 * main menu's top bar. `window.RIB_MUSIC`; scripts/v151Echeck.mjs. */
(function () {
  'use strict';
  if (window.RIB_MUSIC) return;

  var KEY = 'rib.music.v151';
  var TARGET_DB = -20;            // the bed's RMS after normalisation (dBFS)
  var OVERLAP_S = 0.25;           // the tail rung into the loop's head
  var FADE_IN_S = 2.4, FADE_OUT_S = 0.35;
  var DUCK = 0.42, DUCK_ATTACK = 0.07, DUCK_RELEASE = 0.55, DUCK_HOLD_MS = 380, DUCK_LEVEL = 0.015;
  var IDLE_FETCH_MS = 2500;
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

  /* ---------- the effects bus: every other context's destination goes through one gain ---------- */
  var musicCtxs = typeof WeakSet === 'function' ? new WeakSet() : { has: function () { return false; }, add: function () {} };
  var buses = [];                 // { ctx, gain, an, data }
  var AN = window.AudioNode, AD = window.AudioDestinationNode;
  var rawConnect = AN && AN.prototype.connect, rawDisconnect = AN && AN.prototype.disconnect;
  function sfxLevel() { return prefs.muteAll ? 0 : prefs.sfxVol; }
  function busFor(ctx) {
    for (var i = 0; i < buses.length; i++) if (buses[i].ctx === ctx) return buses[i];
    var g = ctx.createGain(); g.gain.value = sfxLevel();
    rawConnect.call(g, ctx.destination);
    var an = null; try { an = ctx.createAnalyser(); an.fftSize = 256; rawConnect.call(g, an); } catch (e) { an = null; }
    var b = { ctx: ctx, gain: g, an: an, data: an ? new Float32Array(an.fftSize) : null };
    buses.push(b); return b;
  }
  if (AN && AD && rawConnect && !AN.prototype.connect.__v151e) {
    var patched = function (dest) {
      if (dest instanceof AD && !musicCtxs.has(this.context)) {
        var a = Array.prototype.slice.call(arguments); a[0] = busFor(this.context).gain;
        rawConnect.apply(this, a); return dest;
      }
      return rawConnect.apply(this, arguments);
    };
    patched.__v151e = true; AN.prototype.connect = patched;
    AN.prototype.disconnect = function (dest) {
      if (dest instanceof AD && !musicCtxs.has(this.context)) {
        var a = Array.prototype.slice.call(arguments); a[0] = busFor(this.context).gain;
        try { return rawDisconnect.apply(this, a); } catch (e) { return; }
      }
      return rawDisconnect.apply(this, arguments);
    };
  }
  function applySfx() {
    var v = sfxLevel();
    // a settings change, not a fade: set it outright (an idle graph is not processed, so a ramp would sit unread)
    buses.forEach(function (b) { try { b.gain.gain.cancelScheduledValues(0); } catch (e) {} b.gain.gain.value = v; });
  }

  /* ---------- the music ---------- */
  var M = {
    state: 'idle',                // idle | loading | ready | playing | paused | off | error
    ctx: null, src: null, buf: null, bytes: null, kind: null, err: null,
    master: null, duck: null, fade: null, el: null,
    gestured: false, started: 0, sourcesMade: 0, liveSources: 0,
    startAt: 0, startOff: 0, loop: null, hidden: false, nativePaused: false,
    duckOn: false, lastLoud: 0, ducks: 0, timer: 0
  };
  var wantPlay = function () { return prefs.music && !prefs.muteAll && !M.hidden && !M.nativePaused; };
  function now() { return M.ctx ? M.ctx.currentTime : 0; }
  function volTarget() { return prefs.muteAll || !prefs.music ? 0 : prefs.vol * (M.loop ? M.loop.norm : 1); }

  var fetching = null;
  function fetchTrack() {
    if (fetching) return fetching;
    if (!window.fetch) return (fetching = Promise.reject(new Error('no fetch')));
    M.state = M.state === 'idle' ? 'loading' : M.state;
    var i = 0;
    var next = function () {
      var s = SOURCES[i++]; if (!s) return Promise.reject(new Error('no source decoded'));
      return fetch(s.url).then(function (r) { if (!r.ok) throw new Error(r.status + ' ' + s.url); return r.arrayBuffer(); })
        .then(function (ab) { return { kind: s.kind, ab: ab, next: next }; });
    };
    fetching = next();
    return fetching;
  }

  /* the loop points and the splice — see the header */
  function spliceLoop(buf) {
    var sr = buf.sampleRate, n = buf.length, chs = [], c;
    for (c = 0; c < buf.numberOfChannels; c++) chs.push(buf.getChannelData(c));
        // the first and last 5 ms windows that carry music (a lone sample over a threshold is the encoder's pop, not an attack)
    var TH = 0.01, WIN = Math.round(0.005 * sr), head = 0, tail = n;
    var winRms = function (s0) { var t = 0; for (var k = 0; k < chs.length; k++) for (var j = s0; j < s0 + WIN; j++) t += chs[k][j] * chs[k][j]; return Math.sqrt(t / (WIN * chs.length)); };
    while (head + WIN < n / 2 && winRms(head) < TH) head += WIN;
    while (tail - WIN > n / 2 && winRms(tail - WIN) < TH) tail -= WIN;
    if (head + WIN >= n / 2) head = 0;
    head = Math.max(0, head - Math.round(0.004 * sr));           // keep the attack's own lead-in
    tail = tail - 1;
    var ov = Math.min(Math.round(OVERLAP_S * sr), Math.floor((tail - head) / 4));
    var rms = function (s, e) { var t = 0, m = 0; for (var k = 0; k < chs.length; k++) for (var j = Math.max(0, s); j < Math.min(n, e); j++) { t += chs[k][j] * chs[k][j]; m++; } return m ? Math.sqrt(t / m) : 0; };
    var W = Math.round(0.01 * sr), wrap = function (end, start) {
      var out = []; for (var j = 5; j > 0; j--) out.push(+rms(end - j * W, end - (j - 1) * W).toFixed(4));
      for (j = 0; j < 5; j++) out.push(+rms(start + j * W, start + (j + 1) * W).toFixed(4)); return out;
    };
    var before = wrap(n, 0);                                        // what a plain <audio loop> plays at the seam
    var loopEnd = tail + 1 - ov;
    for (var i = 0; i < ov; i++) {
      var f = Math.cos((i / ov) * Math.PI / 2);                     // the tail rings on, fading, under the head
      for (c = 0; c < chs.length; c++) chs[c][head + i] += chs[c][loopEnd + i] * f;
    }
    var total = 0, cnt = 0, step = 4;
    for (c = 0; c < chs.length; c++) for (i = head; i < loopEnd; i += step) { total += chs[c][i] * chs[c][i]; cnt++; }
    var rmsDb = 20 * Math.log10(Math.sqrt(total / Math.max(1, cnt)) || 1e-6);
    var norm = Math.max(0.25, Math.min(2, Math.pow(10, (TARGET_DB - rmsDb) / 20)));
    return { sr: sr, length: n, duration: n / sr, loopStart: head / sr, loopEnd: loopEnd / sr, period: (loopEnd - head) / sr, overlapMs: Math.round(ov / sr * 1000),
      rmsDb: +rmsDb.toFixed(2), norm: +norm.toFixed(3), seamBefore: before, seamAfter: wrap(loopEnd, head) };
  }

  function makeCtx() {
    if (M.ctx) return M.ctx;
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { M.ctx = new AC({ latencyHint: 'playback' }); } catch (e) { try { M.ctx = new AC(); } catch (e2) { return null; } }
    musicCtxs.add(M.ctx);
    M.master = M.ctx.createGain(); M.duck = M.ctx.createGain(); M.fade = M.ctx.createGain();
    M.master.gain.value = 0; M.fade.gain.value = 0;
    M.fade.connect(M.duck); M.duck.connect(M.master); M.master.connect(M.ctx.destination);
    try { M.an = M.ctx.createAnalyser(); M.an.fftSize = 512; M.master.connect(M.an); M.anData = new Float32Array(M.an.fftSize); } catch (e) { M.an = null; }
    M.ctx.onstatechange = function () { if (M.ctx.state === 'running' && M.state === 'paused' && wantPlay() && M.src) M.state = 'playing'; };
    return M.ctx;
  }
  function unlock() {                                                // iOS: a sound must START inside the gesture
    var c = makeCtx(); if (!c) return;
    try { if (c.state !== 'running') c.resume(); } catch (e) {}
    try { var b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) {}
  }

  function decode() {
    if (M.buf || M.decoding) return M.decoding || Promise.resolve(M.buf);
    var c = makeCtx(); if (!c) return Promise.reject(new Error('no WebAudio'));
    M.state = M.state === 'idle' ? 'loading' : M.state;
    var tryOne = function (got) {
      return new Promise(function (res, rej) {
        var copy = got.ab.slice(0);
        var p = c.decodeAudioData(copy, res, rej); if (p && p.then) p.then(res, rej);
      }).then(function (buf) { M.kind = got.kind; return buf; }, function (e) {
        return got.next().then(tryOne);                                // Opus-in-MP4 refused: the mp3
      });
    };
    M.decoding = fetchTrack().then(tryOne).then(function (buf) {
      M.loop = spliceLoop(buf); M.buf = buf; M.decoding = null;
      if (M.state === 'loading') M.state = 'ready';
      return buf;
    }, function (e) { M.decoding = null; M.err = String(e && e.message || e); throw e; });
    return M.decoding;
  }

  function startSource(offset) {
    var c = M.ctx, L = M.loop;
    if (M.src) { try { M.src.onended = null; M.src.stop(); } catch (e) {} try { M.src.disconnect(); } catch (e) {} M.liveSources--; M.src = null; }
    var s = c.createBufferSource(); s.buffer = M.buf; s.loop = true; s.loopStart = L.loopStart; s.loopEnd = L.loopEnd;
    s.connect(M.fade);
    var off = offset == null ? L.loopStart : Math.max(0, Math.min(L.loopEnd - 0.01, offset));
    s.start(0, off);
    s.onended = function () { if (M.src === s) { M.src = null; M.liveSources--; } };
    M.src = s; M.sourcesMade++; M.liveSources++;
    M.startAt = c.currentTime; M.startOff = off;
  }
  function position() {
    if (!M.src || !M.loop) return { pos: 0, loops: 0 };
    var L = M.loop, p = M.startOff + (now() - M.startAt);
    if (p < L.loopEnd) return { pos: p, loops: 0 };
    var k = (p - L.loopStart) / L.period; var loops = Math.floor((p - L.loopEnd) / L.period) + 1;
    return { pos: L.loopStart + (k - Math.floor(k)) * L.period, loops: loops };
  }
  function ramp(param, v, tau) { try { param.cancelScheduledValues(now()); param.setTargetAtTime(v, now(), tau); } catch (e) { param.value = v; } }

  function play(why) {
    if (!wantPlay()) return Promise.resolve(false);
    if (!M.gestured) { M.pending = true; return Promise.resolve(false); }
    if (!makeCtx()) return playElement();
    unlock();                                                        // a settings tap is a gesture too (iOS)
    return decode().then(function () {
      if (!wantPlay()) return false;
      var c = M.ctx;
      var go = function () {
        if (!M.src) { startSource(); M.started++; M.fade.gain.value = 0; }
        M.master.gain.value = volTarget();
        ramp(M.fade.gain, 1, FADE_IN_S / 3);
        M.state = 'playing'; tick();
        return true;
      };
      if (c.state !== 'running') return c.resume().then(go, function () { M.state = 'paused'; return false; });
      return go();
    }, function () { M.state = 'error'; return playElement(); });
  }
  function pause(why) {
    if (M.el) { try { M.el.pause(); } catch (e) {} M.state = 'paused'; return; }
    if (!M.ctx || !M.src) { if (M.state === 'playing') M.state = 'paused'; return; }
    ramp(M.fade.gain, 0, FADE_OUT_S / 3);
    var c = M.ctx, ticket = (M.pauseTicket = (M.pauseTicket || 0) + 1);
    M.state = why === 'off' ? 'off' : 'paused';
    setTimeout(function () { if (M.pauseTicket === ticket && M.state !== 'playing') { try { c.suspend(); } catch (e) {} } }, FADE_OUT_S * 1000 + 60);
  }
  /* no WebAudio, or neither file decoded: a plain looping element (it may gap at the wrap) */
  function playElement() {
    if (!wantPlay() || !M.gestured) return Promise.resolve(false);
    if (!M.el) {
      var a = document.createElement('audio'), pick = SOURCES.filter(function (s) { return a.canPlayType && a.canPlayType(s.type); })[0] || SOURCES[1];
      a.src = pick.url; a.loop = true; a.preload = 'auto'; a.setAttribute('playsinline', ''); M.el = a; M.kind = 'element-' + pick.kind; M.sourcesMade++; M.liveSources = 1;
    }
    M.el.volume = Math.max(0, Math.min(1, volTarget()));
    var p = M.el.play(); M.state = 'playing';
    return (p && p.then ? p : Promise.resolve()).then(function () { return true; }, function () { M.state = 'paused'; return false; });
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
      if (on !== M.duckOn && M.duck) { M.duckOn = on; if (on) M.ducks++; ramp(M.duck.gain, on ? DUCK : 1, on ? DUCK_ATTACK : DUCK_RELEASE); }
      if (M.el) M.el.volume = Math.max(0, Math.min(1, volTarget() * (on ? DUCK : 1)));
    }, 110);
  }

  /* ---------- the gesture, the tab, the app ---------- */
  var GESTURES = ['pointerdown', 'touchend', 'keydown', 'click'];
  function onGesture(ev) {
    if (ev && ev.isTrusted === false) return;
    M.gestured = true;
    if (!wantPlay()) { if (M.ctx) try { if (M.ctx.state === 'running' && M.state !== 'playing') M.ctx.suspend(); } catch (e) {} return; }
    unlock();
    if (M.state !== 'playing' || (M.ctx && M.ctx.state !== 'running')) play('gesture');
    if (M.ctx && M.ctx.state === 'running' && M.state === 'playing') GESTURES.forEach(function (g) { document.removeEventListener(g, onGesture, true); });
  }
  GESTURES.forEach(function (g) { document.addEventListener(g, onGesture, { capture: true, passive: true }); });
  // after one is consumed, keep a cheap listener for iOS interruptions (a call suspends the context)
  document.addEventListener('pointerdown', function () { if (M.ctx && M.ctx.state !== 'running' && M.state === 'playing' && wantPlay()) { try { M.ctx.resume(); } catch (e) {} } }, { capture: true, passive: true });

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
    var go = function () { fetchTrack().catch(function () {}); };
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
    loopInfo: function () { return M.loop ? JSON.parse(JSON.stringify(M.loop)) : null; },
    state: function () {
      var p = position();
      var level = 0; if (M.an && M.state === 'playing') { try { M.an.getFloatTimeDomainData(M.anData); for (var i = 0; i < M.anData.length; i++) level = Math.max(level, Math.abs(M.anData[i])); } catch (e) {} }
      return { state: M.state, enabled: prefs.music, muteAll: prefs.muteAll, volume: prefs.vol, sfxVolume: prefs.sfxVol, gestured: M.gestured,
        ctx: M.ctx ? M.ctx.state : null, kind: M.kind, error: M.err, fetched: !!fetching, decoded: !!M.buf, started: M.started, sourcesMade: M.sourcesMade,
        liveSources: M.liveSources, position: +p.pos.toFixed(3), loops: p.loops, duration: M.loop ? M.loop.duration : null, gain: M.master ? +M.master.gain.value.toFixed(4) : null,
        fade: M.fade ? +M.fade.gain.value.toFixed(4) : null, ducking: M.duckOn, ducks: M.ducks, level: +level.toFixed(4), hidden: M.hidden, buses: buses.length,
        sfxGains: buses.map(function (b) { return +b.gain.gain.value.toFixed(3); }) };
    },
    /* for the check: restart the one source at an offset (the wrap is 150 s away otherwise) */
    _seek: function (sec) { if (M.buf && M.ctx) { startSource(sec); return true; } return false; },
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
