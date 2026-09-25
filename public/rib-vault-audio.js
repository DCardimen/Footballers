/* ===== v137 THE PRESTIGE VAULT — the sound =====
 *
 * HONEST NOTE, because the brief asks for one: the supplied art pack contains an "AUDIO
 * VISUALIZATION & TIMING GUIDE" sheet — pictures of waveforms with durations printed under
 * them. Those are images. No playable audio file was supplied with this feature and none is
 * generated here. Every sound below is SYNTHESISED in WebAudio at runtime, voiced against
 * that sheet's own timings (coin pickup .2-.3s, coin stream 2.0s+, vault door 2.5s, upgrade
 * complete 3.0s, career payout 4.0s). docs/PRESTIGE-VAULT.md carries the manifest of what
 * real recordings would replace, one for one.
 *
 * A coin is not a tone. Each strike is a stack of INHARMONIC partials (the modes of a thin
 * disc are not integer multiples) through a bandpass, with a scrape transient in front of
 * it: bronze is low and dull, silver bright and short, gold round and long, the billion-coin
 * blue is a struck bell with a detuned shimmer over it. Pitch, level and decay are jittered
 * per strike so a stream never turns into a metronome.
 *
 * At 8x and 16x the discrete strikes would be a hundred voices a second and would mush, so
 * the mix CROSSFADES to a continuous stream bed (filtered noise, swept) with sparse accents
 * over it. That is the "avoid excessive overlapping audio during 16x spending" rule, and it
 * is the only way it sounds like money rather than static.
 */
(function () {
  'use strict';
  if (window.__RIB_VAULT_AUDIO) return;
  var KEY = 'rib.vaultMute.v137';

  var A = null, master = null, bus = null, noiseBuf = null;
  var muted = false, armed = false, voices = 0, lastAt = 0;
  var stream = null, streamGain = null, streamFilt = null;
  try { muted = localStorage.getItem(KEY) === '1'; } catch (e) {}

  var VOICE = {                    // base, partial ratios, decay, brightness
    bronze: { f: 520,  p: [1, 2.31, 3.68], d: 0.14, q: 5.5,  g: 0.55 },
    silver: { f: 880,  p: [1, 2.42, 4.11], d: 0.20, q: 8,    g: 0.60 },
    gold:   { f: 700,  p: [1, 2.27, 3.92, 5.6], d: 0.34, q: 9, g: 0.70 },
    blue:   { f: 1180, p: [1, 2.05, 3.13, 4.7], d: 0.72, q: 13, g: 0.72 }
  };

  function ctx() {
    if (A) return A;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    A = new AC();
    master = A.createGain(); master.gain.value = muted ? 0 : 0.55;
    var comp = A.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 7; comp.attack.value = 0.003; comp.release.value = 0.18;
    bus = A.createGain(); bus.gain.value = 1;
    bus.connect(comp); comp.connect(master);
    var out = null; try { out = window.RIB_MUSIC && window.RIB_MUSIC.sfxOut && window.RIB_MUSIC.sfxOut(A); } catch (e) { out = null; }
    master.connect(out || A.destination);   // v151 E THE BAND PLAYS: the effects bus (mute all, the duck)
    var n = A.sampleRate * 1.2, b = A.createBuffer(1, n, A.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) * 0.8 + (Math.random() * 2 - 1) * 0.2;
    noiseBuf = b;
    return A;
  }
  function now() { return A ? A.currentTime : 0; }
  /* pooling: a hard ceiling on concurrent voices, and a floor on how close two can be */
  function slot(minGap) {
    if (muted || !ctx()) return false;
    var t = now();
    if (voices > 14) return false;
    if (t - lastAt < (minGap || 0.012)) return false;
    lastAt = t; voices++;
    setTimeout(function () { voices = Math.max(0, voices - 1); }, 340);
    return true;
  }
  function noise(dur, f, q, gain, type) {
    var s = A.createBufferSource(); s.buffer = noiseBuf;
    var bp = A.createBiquadFilter(); bp.type = type || 'bandpass'; bp.frequency.value = f; bp.Q.value = q || 1;
    var g = A.createGain(); g.gain.setValueAtTime(gain, now());
    g.gain.exponentialRampToValueAtTime(0.0001, now() + dur);
    s.connect(bp); bp.connect(g); g.connect(bus);
    s.start(); s.stop(now() + dur + 0.02);
    return g;
  }
  function partials(v, pitch, level, dur) {
    var t = now(), i, o, g;
    for (i = 0; i < v.p.length; i++) {
      o = A.createOscillator(); o.type = i === 0 ? 'triangle' : 'sine';
      o.frequency.value = v.f * v.p[i] * pitch;
      g = A.createGain();
      var lv = level * v.g / (1 + i * 1.5);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(lv, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * (1 - i * 0.14));
      o.connect(g); g.connect(bus);
      o.start(t); o.stop(t + dur + 0.04);
    }
  }

  var api = {
    arm: function (want) {
      if (want === false) { muted = true; }
      if (!ctx()) return;
      armed = true;
      if (A.state === 'suspended') A.resume().catch(function () {});
      master.gain.value = muted ? 0 : 0.55;
    },
    on: function () { return !muted; },
    toggle: function () {
      muted = !muted;
      try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) {}
      if (ctx()) master.gain.setTargetAtTime(muted ? 0 : 0.55, now(), 0.04);
      if (muted) api.streamOff();
      return !muted;
    },
    /* one coin leaving the pile and landing in the core */
    coin: function (den, stage) {
      if (stage >= 3) { api.streamOn(stage); if (Math.random() > 0.22) return; }
      else api.streamOff();
      if (!slot(stage >= 2 ? 0.045 : 0.012)) return;
      var v = VOICE[den] || VOICE.bronze;
      var pitch = 0.88 + Math.random() * 0.26;
      var lvl = 0.10 + Math.random() * 0.05;
      noise(0.028, v.f * 2.2 * pitch, 1.4, lvl * 0.7);        // the scrape off the pile
      partials(v, pitch, lvl, v.d * (0.8 + Math.random() * 0.45));
    },
    /* a coin landing on the heap. Weight is the whole point of this one: a heavier coin
     * lands lower, louder and shorter — a thud rather than a clatter — so the difference
     * between a bronze and a billion is audible before it is legible. */
    land: function (den, force, mass) {
      if (!slot(0.030)) return;
      var v = VOICE[den] || VOICE.bronze;
      mass = mass || 1;
      var pitch = (0.98 - (mass - 1) * 0.20) * (0.94 + Math.random() * 0.12);
      var lvl = (0.05 + 0.10 * Math.min(1, force)) * (0.85 + mass * 0.18);
      noise(0.045 + 0.02 * mass, 180 / mass, 0.9, lvl * 1.15, 'lowpass');   // the thud
      partials(v, pitch, lvl * 0.8, v.d * (0.55 + 0.25 / mass));            // the ring
    },
    /* the continuous stream under 8x and 16x */
    streamOn: function (stage) {
      if (muted || !ctx()) return;
      if (!stream) {
        stream = A.createBufferSource(); stream.buffer = noiseBuf; stream.loop = true;
        streamFilt = A.createBiquadFilter(); streamFilt.type = 'bandpass';
        streamFilt.frequency.value = 1500; streamFilt.Q.value = 1.1;
        streamGain = A.createGain(); streamGain.gain.value = 0;
        stream.connect(streamFilt); streamFilt.connect(streamGain); streamGain.connect(bus);
        stream.start();
      }
      var lv = stage >= 4 ? 0.13 : 0.07;
      streamGain.gain.setTargetAtTime(lv, now(), 0.08);
      streamFilt.frequency.setTargetAtTime(stage >= 4 ? 2300 : 1600, now(), 0.12);
    },
    streamOff: function () {
      if (streamGain) streamGain.gain.setTargetAtTime(0, now(), 0.10);
    },
    stage: function (mult) {
      if (!slot(0.02)) return;
      var t = now(), o = A.createOscillator(), g = A.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(200 + mult * 26, t);
      o.frequency.exponentialRampToValueAtTime(420 + mult * 52, t + 0.16);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      var lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
      o.connect(lp); lp.connect(g); g.connect(bus);
      o.start(t); o.stop(t + 0.3);
    },
    /* the door: a bolt throw, a wheel turn, and the leaf's weight */
    door: function () {
      if (muted || !ctx()) return;
      api.arm(true);
      var t = now(), i;
      noise(0.30, 160, 0.8, 0.22, 'lowpass');                      // the mechanism
      for (i = 0; i < 6; i++) setTimeout(function () {
        if (!muted && A) noise(0.09, 320 + Math.random() * 260, 3, 0.12);
      }, 260 + i * 130);                                            // the bolts
      setTimeout(function () {
        if (muted || !A) return;
        var o = A.createOscillator(), g = A.createGain(), tt = now();
        o.type = 'sine'; o.frequency.setValueAtTime(58, tt);
        o.frequency.exponentialRampToValueAtTime(34, tt + 1.2);
        g.gain.setValueAtTime(0.0001, tt);
        g.gain.exponentialRampToValueAtTime(0.30, tt + 0.12);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.5);
        o.connect(g); g.connect(bus); o.start(tt); o.stop(tt + 1.6);
        noise(1.1, 420, 0.7, 0.10);                                 // the leaf grinding open
      }, 1100);
    },
    /* the upgrade lands */
    complete: function () {
      if (muted || !ctx()) return;
      api.streamOff();
      var t = now(), steps = [0, 4, 7, 12, 16, 19];
      steps.forEach(function (s, i) {
        var o = A.createOscillator(), g = A.createGain();
        o.type = 'triangle';
        o.frequency.value = 330 * Math.pow(2, s / 12);
        g.gain.setValueAtTime(0.0001, t + i * 0.065);
        g.gain.exponentialRampToValueAtTime(0.11, t + i * 0.065 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.065 + 1.5);
        o.connect(g); g.connect(bus);
        o.start(t + i * 0.065); o.stop(t + i * 0.065 + 1.6);
      });
      noise(0.6, 3200, 0.9, 0.09);
      setTimeout(function () { if (!muted && A) noise(1.4, 140, 0.6, 0.16, 'lowpass'); }, 120);
    },
    /* a career settles and the money arrives */
    payout: function () {
      if (muted || !ctx()) return;
      var t = now(), o = A.createOscillator(), g = A.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(220, t + 0.9);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 2.3);
      for (var i = 0; i < 22; i++) setTimeout(function () {
        api.coin(Math.random() < 0.12 ? 'gold' : 'bronze', 1);
      }, 180 + i * 78 + Math.random() * 60);
    },
    stop: function () {
      api.streamOff();
      if (A && A.state === 'running') { try { A.suspend(); } catch (e) {} }
    },
    /* what a real recording would replace, one for one */
    manifest: function () {
      return ['vault_mechanism', 'door_move', 'coin_bronze', 'coin_silver', 'coin_gold',
        'coin_blue', 'coin_detach', 'coin_flight', 'coin_stream', 'coin_land', 'pile_settle',
        'upgrade_receive', 'upgrade_complete', 'career_payout'];
    }
  };
  /* ===== v153 C PAYDAY — the sound of a run becoming wealth =====
   *
   * The coin rain is layered, not looped: a DISTANT coin is a light high tick, a coin on the
   * pile a medium clink, a coin landing in front of the camera (or a gold / blue one) a
   * heavier impact with a thud under it. Pitch and level are jittered per strike. The rain has
   * its OWN voice pool (`RAIN_MAX` at once, a floor on the gap between two), separate from the
   * spend path's, so a two-hundred-coin storm thins itself out instead of stacking into
   * distortion; what it drops is counted (`stats`). Under the peak a cascade bed (the stream's
   * filtered noise, brighter) swells with the impact rate; under a large reward a very quiet
   * rising tone climbs until the final coin and RESOLVES on it. Then one heavy CLINK.
   * All of it goes through the same bus, compressor and `RIB_MUSIC.sfxOut` as the rest. */
  var RAIN_MAX = 9, rainVoices = 0, rainLast = 0;
  var bed = null, bedGain = null, bedFilt = null, riser = null;
  var stats = { rain: 0, dropped: 0, peak: 0, finals: 0, wiggles: 0 };
  function rainSlot(gap) {
    if (muted || !ctx()) return false;
    var t = now();
    if (rainVoices >= RAIN_MAX || t - rainLast < gap) { stats.dropped++; return false; }
    rainLast = t; rainVoices++;
    if (rainVoices > stats.peak) stats.peak = rainVoices;
    setTimeout(function () { rainVoices = Math.max(0, rainVoices - 1); }, 190);
    return true;
  }
  /* one coin of the rain landing. `weight` 0 = distant tick, 1 = on the pile, 2 = heavy */
  api.rain = function (den, weight) {
    stats.rain++;
    if (!rainSlot(weight >= 2 ? 0.020 : 0.014)) return;
    var v = VOICE[den] || VOICE.bronze;
    var pitch = (weight === 0 ? 1.28 : weight >= 2 ? 0.86 : 1.0) * (0.90 + Math.random() * 0.22);
    var lvl = (weight === 0 ? 0.035 : weight >= 2 ? 0.12 : 0.075) * (0.75 + Math.random() * 0.5);
    noise(weight === 0 ? 0.018 : 0.03, v.f * 2.4 * pitch, 1.6, lvl * 0.6);
    if (weight >= 2) noise(0.06, 150, 0.8, lvl * 1.2, 'lowpass');
    partials(v, pitch, lvl, v.d * (weight === 0 ? 0.45 : weight >= 2 ? 0.95 : 0.7) * (0.85 + Math.random() * 0.3));
  };
  /* the cascade: continuous metal under the peak, 0..1 */
  api.cascade = function (level) {
    if (muted || !ctx()) return;
    level = Math.max(0, Math.min(1, level || 0));
    if (!bed) {
      if (level <= 0.01) return;
      bed = A.createBufferSource(); bed.buffer = noiseBuf; bed.loop = true;
      bedFilt = A.createBiquadFilter(); bedFilt.type = 'bandpass'; bedFilt.frequency.value = 2600; bedFilt.Q.value = 0.9;
      bedGain = A.createGain(); bedGain.gain.value = 0;
      bed.connect(bedFilt); bedFilt.connect(bedGain); bedGain.connect(bus);
      bed.start();
    }
    bedGain.gain.setTargetAtTime(0.085 * level, now(), 0.09);
    bedFilt.frequency.setTargetAtTime(2200 + 2600 * level, now(), 0.15);
  };
  /* the rising tone under a large reward: two detuned voices through a lowpass, climbing
   * a fifth over `ms`, never louder than a whisper */
  api.riser = function (ms) {
    if (muted || !ctx() || riser) return;
    var t = now(), d = Math.max(0.6, (ms || 3000) / 1000);
    var lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(380, t);
    lp.frequency.exponentialRampToValueAtTime(1500, t + d);
    var g = A.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + d * 0.8);
    var o1 = A.createOscillator(), o2 = A.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'triangle';
    o1.frequency.setValueAtTime(98, t); o1.frequency.exponentialRampToValueAtTime(147, t + d);
    o2.frequency.setValueAtTime(98.7, t); o2.frequency.exponentialRampToValueAtTime(148.2, t + d);
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(bus);
    o1.start(t); o2.start(t);
    riser = { o: [o1, o2], g: g, lp: lp };
  };
  /* ...and it resolves when the final total appears */
  api.resolve = function () {
    if (!riser || !A) return;
    var t = now(), r = riser; riser = null;
    try {
      r.o[0].frequency.cancelScheduledValues(t); r.o[1].frequency.cancelScheduledValues(t);
      r.o[0].frequency.setTargetAtTime(196, t, 0.05); r.o[1].frequency.setTargetAtTime(294, t, 0.05);
      r.g.gain.cancelScheduledValues(t); r.g.gain.setValueAtTime(Math.max(0.0001, r.g.gain.value), t);
      r.g.gain.linearRampToValueAtTime(0.05, t + 0.06);
      r.g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      r.o[0].stop(t + 1.7); r.o[1].stop(t + 1.7);
    } catch (e) {}
  };
  /* THE final coin: a low thud, a long gold ring, a shimmer on top */
  api.finalClink = function (big) {
    stats.finals++;
    if (muted || !ctx()) return;
    api.cascade(0);
    var v = VOICE.gold;
    noise(0.22, 120, 0.7, big ? 0.34 : 0.26, 'lowpass');
    partials(v, 0.74, big ? 0.30 : 0.24, 1.25);
    partials(VOICE.blue, 0.62, 0.10, 1.6);
    setTimeout(function () { if (!muted && A) noise(0.9, 5200, 0.8, big ? 0.05 : 0.035); }, 40);
  };
  /* the settled pile, touched: a quiet shift of metal */
  api.wiggle = function () {
    stats.wiggles++;
    if (!rainSlot(0.09)) return;
    var v = VOICE.silver, pitch = 0.9 + Math.random() * 0.3;
    noise(0.025, 2400 * pitch, 1.4, 0.02);
    partials(v, pitch, 0.026, 0.16);
  };
  api.paydayStop = function () {
    api.cascade(0);
    if (riser) { try { riser.g.gain.setTargetAtTime(0.0001, now(), 0.08); riser.o[0].stop(now() + 0.4); riser.o[1].stop(now() + 0.4); } catch (e) {} riser = null; }
  };
  api.stats = function () { return { rain: stats.rain, dropped: stats.dropped, peak: stats.peak, finals: stats.finals, wiggles: stats.wiggles, max: RAIN_MAX }; };
  var baseStop = api.stop;
  api.stop = function () { api.paydayStop(); baseStop(); };
  var baseManifest = api.manifest;
  api.manifest = function () { return baseManifest().concat(['payday_tick', 'payday_clink', 'payday_impact', 'payday_cascade', 'payday_riser', 'payday_final', 'pile_wiggle']); };

  window.__RIB_VAULT_AUDIO = api;
})();
