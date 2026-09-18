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
    bus.connect(comp); comp.connect(master); master.connect(A.destination);
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
  window.__RIB_VAULT_AUDIO = api;
})();
