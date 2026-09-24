
/* ===== v114 THE SPLASH IS A FILM — the title sting plays while the game loads =====
 * The boot splash drew the v94 chase. It now plays the title sting instead: a 14.5s film that
 * comes out of black, throws a light streak across the frame and lands on the wordmark — and
 * from there it LOOPS, for as long as the load still needs (see v116, below).
 *
 * Three things had to be true for a film to be a loading screen rather than another thing to
 * wait for:
 *   - IT ARRIVES FIRST. The master's `moov` atom sat after `mdat`, so nothing could be shown
 *     until the last byte landed; scripts/build-splash-film.mjs re-cuts it with +faststart and
 *     drops 20MB of HEVC to ~1.4MB of H.264. The head asks for it in its first breath, beside v112 A's sheet
 *     warm, and the <video preload="auto"> in the body picks up the same preload entry.
 *   - IT KEEPS PLAYING WHEN THE MAIN THREAD DOES NOT. That is the whole reason to prefer a film
 *     here: video decode is not on the main thread, so the megabytes of inline bundle compiling
 *     below do not drop a single frame of it. The v94 chase, a rAF loop, stalls on exactly that.
 *   - IT NEVER HOLDS THE GAME HOSTAGE. If the film cannot get a frame up inside FILM_START_MS
 *     (a 404, a codec, a browser that will not autoplay) it gives the stage back and the v94
 *     chase mounts exactly as before — which is also what happens under prefers-reduced-motion,
 *     where the film shows its last frame as a still and never plays.
 *
 * ===== v116 THE FILM LOOPS =====
 * The film does not stop any more. It runs its whole length once — out of black, the streak,
 * the wordmark landing at LOOP_FROM_V116 — and then every time it reaches the end it goes back
 * to LOOP_FROM_V116 and plays the tail again, for as long as the loading lasts. That seam is
 * the one place in the film where it can: everything after 6.5s is the wordmark breathing
 * under drifting cloud, and the last frame and the frame at 6.5s differ by 3.4/255 averaged
 * over the picture, so the jump is not visible. `loop` stays FALSE on the element, because a
 * native loop would go back to zero (the black) and because `ended` is the event that tells us
 * to seek. Both doors share one looper: door two borrows this same element.
 *
 * THE DOOR. The splash leaves when the app is ready AND the wordmark has LANDED — the playhead
 * past LOOP_FROM_V116 — capped at FILM_CAP_MS. A title sting cut mid-swoosh looks broken, so
 * the curtain waits for the intro to finish assembling; after that the loop covers whatever the
 * load still has left, and the door opens on a frame that is nearly identical every time round.
 * Set FILM_WAIT_INTRO false to drop the curtain the moment the app is ready instead.
 *
 * THE BAR. Two layers over one groove. `i` is v112 A's compositor sweep, untouched, still the
 * one thing that moves while the bundle compiles. `b` is a real fill, and it is real: the
 * film's own buffered fraction, the v91 sheet landing, the app knocking, the intro reaching the
 * seam — monotonic, reaching 1 exactly when both conditions for leaving are met. (The playhead
 * is only honest as a remainder up to the seam: past it the film is looping and no longer
 * counting down to anything, so that is where its share stops.) It is a
 * transform with a long ease, so the glide to each new target runs on the compositor too and a
 * jam mid-transition does not freeze it either.
 * window.__V114 is the hook; `?noFilmV114` forces the chase back. `v114check.mjs` is the gate. */
(function () {
  var FILM_START_MS = 3000;      // the film's audition: a frame on screen by now, or the chase takes over
  var FILM_CAP_MS = 14000;       // the outside edge of the whole splash, film or no film
  var LOOP_FROM_V116 = 6.5;      // the seam: the streak has landed on the wordmark, and the tail loops from here
  var FILM_WAIT_INTRO = true;    // false => leave the moment the app is ready, mid-streak if need be
  /* What the bar means: how close the splash is to LEAVING, which is the app being ready and
   * the intro having landed. So the bytes are only part of it — once they are in, the thing
   * still being waited on is the film itself, and its playhead up to the seam is the honest
   * remainder. A bar that sat at 90% through six seconds of sting would be telling the truth
   * about bytes and lying about the wait. */
  var W = { film: .20, sheet: .10, door: .30, play: .40 };   // what each signal is worth on the bar

  var T = function () { try { return Math.round(performance.now()); } catch (e) { return 0; } };
  var RM = false; try { RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var OFF = false; try { OFF = /[?&]noFilmV114\b/.test(location.search); } catch (e) {}

  var splash = document.getElementById('splash'), vid = document.getElementById('splashFilm');
  var fill = splash && splash.querySelector('.splash-loader b');
  if (!splash || !vid) return;                       // an older document: v94 keeps the stage

  var V = window.__V114 = {
    on: false, failed: false, settled: false, ended: false, played: false, rm: RM, off: OFF,
    startMs: T(), firstFrameMs: null, endedMs: null, doorMs: null, buffered: 0, progress: 0,
    get t() { return vid.currentTime || 0; }, get dur() { return vid.duration || 0; },
    src: null, waitIntro: FILM_WAIT_INTRO,
    // v116: the loop. `landed` is the intro reaching the seam, `loops` counts the times round.
    loopFrom: LOOP_FROM_V116, landed: false, landedMs: null, loops: 0, lastLoopMs: null
  };

  // ---- the bar: four signals, never backwards, 1 exactly when the curtain may drop
  var sig = { film: 0, sheet: 0, door: 0, play: 0 };
  function bump() {
    var p = sig.film * W.film + sig.sheet * W.sheet + sig.door * W.door + sig.play * W.play;
    if (p <= V.progress) return;
    V.progress = p;
    if (fill) fill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
  }
  try {
    var w = window.__RIB_WARM_V112;
    if (w && w.imgP && w.mapP) Promise.all([w.imgP, w.mapP]).then(function () { sig.sheet = 1; bump(); });
    else sig.sheet = 1;
  } catch (e) { sig.sheet = 1; }
  function readBuffered() {
    try {
      var d = vid.duration; if (!d || !isFinite(d) || !vid.buffered.length) return;
      V.buffered = Math.min(1, vid.buffered.end(vid.buffered.length - 1) / d);
      sig.film = V.buffered; bump();
    } catch (e) {}
  }

  // ---- the verdict: the film claims the stage, or hands it back. Answered exactly once.
  var waiters = [];
  function settle(claimed) {
    if (V.settled) return;
    V.settled = true; V.on = !!claimed; V.failed = !claimed;
    var ws = waiters; waiters = [];
    ws.forEach(function (cb) { try { cb(V.on); } catch (e) {} });
  }
  V.verdict = function (cb) { if (V.settled) { try { cb(V.on); } catch (e) {} return; } waiters.push(cb); };

  // ---- the door: the app is ready; the curtain drops once the intro has landed too
  var doorFired = false, onLanded = null;
  V.appReady = function (finish) {
    V.doorMs = T(); sig.door = 1; bump();
    var go = function () { if (doorFired) return; doorFired = true; try { finish(); } catch (e) {} };
    if (V.landed || !V.waitIntro) return go();
    onLanded = go;
    setTimeout(go, Math.max(400, FILM_CAP_MS - (T() - V.startMs)));   // the film does not get to stall the boot
  };

  // the streak has finished landing on the wordmark: from here every frame is a fine one to cut on
  function landed() {
    if (V.landed) return;
    V.landed = true; V.landedMs = T(); sig.play = 1; bump();
    if (onLanded) onLanded();
  }

  /* ===== v116: back to the seam =====
   * The end of the film is not a stop, it is a seek. `loop` on the element would rewind to the
   * black at zero and would swallow the `ended` event this hangs off, so the rewind is done by
   * hand — to LOOP_FROM_V116, or to the top if the film is too short to have a tail (a swapped
   * asset must not strand the playhead past its own duration). Shared with door two, which
   * plays this very element. */
  function loopBack(v) {
    try {
      v = v || vid; if (!v) return;
      var d = v.duration, to = (d && isFinite(d) && d > LOOP_FROM_V116 + .5) ? LOOP_FROM_V116 : 0;
      if (Math.abs((v.currentTime || 0) - to) > .05) v.currentTime = to;
      var q = v.play(); if (q && q.catch) q.catch(function () {});
    } catch (e) {}
  }
  V.loopBack = loopBack;

  function ended() {
    landed();                                         // a film shorter than the seam still opens the door
    V.loops++; V.lastLoopMs = T();
    if (!V.ended) { V.ended = true; V.endedMs = T(); }
    sig.film = 1; bump();
    loopBack(vid);                                    // round again, from the wordmark
  }

  /* The picker already declined to give these paths a source, so there is nothing in flight to
   * abort — this is the belt to that braces, for a cached page whose picker ran under a different
   * setting, or any future path that reaches here with a src set. */
  function stopLoad() {
    try { vid.pause(); } catch (e) {}
    try { while (vid.firstChild) vid.removeChild(vid.firstChild); } catch (e) {}
    try { vid.removeAttribute('src'); vid.preload = 'none'; vid.load(); } catch (e) {}
  }

  // ---- prefers-reduced-motion: the film, stopped. The last frame as a still, nothing moving.
  if (RM && !OFF) {
    stopLoad();
    vid.poster = window.__RIB_ASSET ? window.__RIB_ASSET('rib_film_v116.jpg') : './public/rib_film_v116.jpg';
    splash.classList.add('film');
    sig.film = 1; V.ended = true; V.endedMs = T(); sig.play = 1; bump();
    V.landed = true; V.landedMs = T();                // nothing is playing, so there is nothing to wait for
    settle(true);
    return;
  }
  if (OFF) { stopLoad(); settle(false); return; }

  vid.addEventListener('loadedmetadata', readBuffered);
  vid.addEventListener('progress', readBuffered);
  vid.addEventListener('ended', ended);
  vid.addEventListener('error', function () { settle(false); });
  // the first frame actually on screen is the only thing that counts as claiming the stage
  var claim = function () {
    if (V.settled && !V.on) return;
    if (V.played) return;
    V.played = true; V.firstFrameMs = T(); V.codec = /\.webm/.test(vid.currentSrc || '') ? 'vp9' : 'h264';
    splash.classList.add('film'); settle(true); readBuffered();
  };
  vid.addEventListener('playing', claim);
  vid.addEventListener('timeupdate', function () {
    if (vid.currentTime > 0) claim();
    // v116: the playhead counts down to the SEAM, not to the end — past it the film is looping
    var d = vid.duration, seam = (d && isFinite(d) && d > LOOP_FROM_V116 + .5) ? LOOP_FROM_V116 : d;
    if (seam) { sig.play = Math.min(1, vid.currentTime / seam); bump(); if (vid.currentTime >= seam) landed(); }
    readBuffered();
  });

  /* The source was chosen and set by the picker beside the element, while the parser was still
   * on the splash markup — see the comment there for why it is not a <source> or a preload. */
  if (!vid.getAttribute('src')) { settle(false); return; }              // the picker stood it down
  V.src = vid.getAttribute('src');
  /* ===== v115: the film is PARKED, not destroyed =====
   * Door two mounts at the single worst moment on the main thread — the Phaser scene booting —
   * and a media element's load does not START until the main thread lets it: measured, `play()`
   * at 23218ms and `loadstart` 2.7 SECONDS later, on a door that is only open for four. So the
   * element door one already loaded is kept: parked detached, paused, fully buffered, and handed
   * to door two when it mounts. One decoded film for the whole session. */
  V.park = function () {
    try {
      if (!V.on || !vid) return null;
      vid.pause();
      if (vid.parentNode) vid.parentNode.removeChild(vid);
      vid.className = ''; vid.removeAttribute('id');
      V.parked = vid; return vid;
    } catch (e) { return null; }
  };
  /* ===== v132 THE FILM IS ALWAYS WARM =====
   * Door two must never have to LOAD. If the splash leaves with nothing parked — the film never got a
   * frame up in its audition, the boot was a cached reload, the picker chose a source the browser then
   * refused — a STANDBY is built here on the same URL, seeked to the seam the moment its metadata lands,
   * and left paused and buffered until a live game asks. `take()` hands out the parked element first and
   * the standby second; `give()` re-parks whichever comes back. One decoded film a session, still. */
  V.standby = null; V.warmedMs = null;
  V.warm = function () {
    try {
      if (V.parked || V.standby || V.rm || V.off || !V.src) return null;
      var s = document.createElement('video');
      s.preload = 'auto'; s.muted = true; s.defaultMuted = true; s.playsInline = true; s.loop = false;
      s.setAttribute('playsinline', ''); s.setAttribute('muted', ''); s.setAttribute('aria-hidden', 'true');
      s.addEventListener('loadedmetadata', function () { try { var d = s.duration; if (d && isFinite(d) && d > LOOP_FROM_V116 + .5) s.currentTime = LOOP_FROM_V116; } catch (e) {} });
      s.addEventListener('ended', function () { loopBack(s); });
      s.src = V.src; s.load();
      V.standby = s; V.warmedMs = T(); return s;
    } catch (e) { return null; }
  };
  V.take = function (cls) {
    var v = V.parked || V.standby; if (!v) return null;
    if (v === V.parked) V.parked = null; else V.standby = null;
    v.className = cls || ''; return v;
  };
  V.give = function (v) { try { if (!v) return; v.pause(); if (v.parentNode) v.parentNode.removeChild(v); v.className = ''; V.parked = v; } catch (e) {} };
  vid.loop = false; vid.muted = true; vid.defaultMuted = true; vid.playsInline = true;
  var p = null; try { p = vid.play(); } catch (e) { settle(false); }
  if (p && p.catch) p.catch(function () { settle(false); });     // autoplay refused: the chase, then

  setTimeout(function () { if (!V.settled) settle(false); }, FILM_START_MS);
})();
/* ===== v94 THE CHASE — the loading screen is a play, not a spinner =====
 * A ball carrier in the you-kit sprints across a strip of turf with a defender on his heels,
 * drawn on a plain 2D canvas from the v91 field sheet (public/rib_field_v91.png, its cell
 * map in rib_field_v91.json), cut and recoloured here with the same hue bands ribRecolor
 * uses. It is a scripted loop of beats, not a run cycle: the SPRINT (the defender closes),
 * the LOOK (a quarter-turn over the shoulder, the defender bursts), then a JUKE (plant, cut,
 * a lane change; the defender dives, eats turf and gets up through the eight-frame get-up)
 * or a SPIN (the body turns through four facings — side, front, back, side — while the
 * defender grabs air and staggers), the RECOVERY (he catches back up), and it goes again.
 * The beat order and the moves roll, so no two loads match, and the door never opens before
 * one full cycle has played. The EXIT is the touchdown: the end zone paints in, the last dive
 * misses, he high-steps across, the chalk flashes, confetti, the celebration, and the fade.
 * Around them: stands with a crowd on two parallax layers, yard numbers, a camera that bobs
 * with the stride and shakes on the dive, speed lines at full tilt, afterimages through the
 * cut and the spin, grass tufts off the plant, the ball tucked behind the far arm (a sliver
 * of leather, not a spinning prop), and a chalk caption calling the beat.
 * ONE ENGINE, TWO DOORS. window.__CHASE_V94.make(canvas, opts) runs a chase on any canvas;
 * the boot splash mounts one (window.__SPLASH_V94, the door window.__splashDoneV94() that
 * go() knocks on) and the live game mounts one over .field-wrap while the broadcast boots
 * (window.__LIVELOAD_V94, watching #screen for the field and __gridironScene for the scene).
 * No Phaser: the splash must animate while Phaser is still being parsed — that is the point
 * of a loading screen. Reduced motion draws one posed frame; a sheet that never lands leaves
 * the old football in place and the old timing untouched. */
(function () {
  var RM = false; try { RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var KITS = { you: ['#f0bb45', '#20304a'], def: ['#c8414b', '#c3c9d2'] };   // the you-kit and the DEFENSE red
  var META = null, IMG = null, loadP = null, cache = {};
  var CAPS = { sprint: 'HE HAS AN ANGLE', look: 'LOOKS BACK...', juke: 'JUKE!', spin: 'SPIN MOVE!', recover: 'HE IS NOT DONE', exit: "HE'S GONE", td: 'TOUCHDOWN' };
  var CROWD = null;
  var A112 = window.__V112_A || null, T112 = function () { try { return Math.round(performance.now()); } catch (e) { return 0; } };
  if (A112) A112.engineMs = T112();
  // ---- the sheet: fetch the map, load the atlas, once, on their own clock
  // v112 A: the head asked for both of these in its first breath (__RIB_WARM_V112) — by the time
  // this script runs the picture is usually already decoded, so load() ADOPTS those promises
  // rather than issuing a second pair. With no warm (an old page, ?noWarmV112) it asks itself.
  function load() {
    if (loadP) return loadP;
    var w = window.__RIB_WARM_V112, mapP, imgP;
    if (w && w.imgP && w.mapP) { if (A112) A112.adopted = true; mapP = w.mapP; imgP = w.imgP; }
    else {
      mapP = fetch(window.__RIB_ASSET('rib_field_v91.json')).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
      var img = new Image(); img.decoding = 'async';
      imgP = new Promise(function (res) { img.onload = function () { res(img); }; img.onerror = function () { res(null); }; });
      img.src = window.__RIB_ASSET('rib_field_v91.png');
      if (A112) A112.sheetReqs += 2;
    }
    return loadP = Promise.all([mapP, imgP]).then(function (r) {
      if (!r[0] || !r[1] || !r[0].run_sd0) return false;
      META = r[0]; IMG = r[1]; if (A112) A112.sheetMs = T112();
      prewarm(); return true;
    });
  }
  // ---- v112 A: every cell the chase can draw, cut and recoloured ONCE, the moment the sheet lands
  // — while the main thread is still idle and the megabytes below have not begun to compile. The
  // run cycle and the ball go in on the spot, so the first mount is a pure blit; the rest (the
  // plant, the dive, the spin's four facings, the get-up, the celebration) follow ONE POSE PER
  // TASK — the warm must never itself be the thing that costs a frame.
  var CUT_V112 = ['run_sd', 'plant_sd', 'cut_sd', 'dive_sd', 'fall_sd', 'run_dr', 'run_ur', 'run_dn', 'run_up', 'getup_dr', 'hurt_dr', 'celebrate_dr', 'idle_sd'];
  function cutPose(base) {
    var n = 0;
    for (var k = 0; k < 2; k++) {
      var kit = k ? 'def' : 'you';
      if (META[base]) { if (cell(base, kit)) n++; continue; }
      for (var f = 0; f < 8 && META[base + f]; f++) if (cell(base + f, kit)) n++;
    }
    if (A112) A112.cells += n;
  }
  function prewarm() {
    if (!IMG || !META) return;
    var t = T112(), i = 0;
    cutPose(CUT_V112[i++]); if (cell('ball_spin0', 'raw') && A112) A112.cells++;
    if (A112) A112.cellsMs = T112() - t;
    (function next() {
      if (!IMG || i >= CUT_V112.length) { if (A112) A112.cellsAllMs = T112() - t; return; }
      cutPose(CUT_V112[i++]); setTimeout(next, 0);
    })();
  }
  // one row per loading scene: when it opened, whether the sheet was already decoded in memory when
  // it did (a cached mount starts on the frame it is asked for), and when its first frame was painted
  function mountRec112(tag) {
    if (!A112) return null;
    var r = { tag: tag, at: T112(), cached: !!IMG, reqsBefore: A112.sheetReqs, firstFrame: null, ms: null, frames: 0, maxGapMs: 0, maxGapAt: 0 };
    A112.mounts.push(r); return r;
  }
  // ---- one cell, recoloured into a kit (ribRecolor's bands: navy -> primary, gold -> secondary)
  function cell(name, kit) {
    // v133: a kit is a KITS key or a [primary, secondary] pair — the growth screen dresses the boy in his team
    var K = Array.isArray(kit) ? kit : KITS[kit], key = (Array.isArray(kit) ? kit.join('') : kit) + ':' + name; if (cache[key]) return cache[key];
    var mc = META && META[name]; if (!mc || !IMG) return null;
    var c = document.createElement('canvas'); c.width = 48; c.height = 48;
    var x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(IMG, mc[0] * 48, mc[1] * 48, 48, 48, 0, 0, 48, 48);
    if (kit !== 'raw') {
      var img = x.getImageData(0, 0, 48, 48), d = img.data, P = hx(K[0]), Q = hx(K[1]);
      for (var i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 20) continue;
        var r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2;
        if (L < 38) continue;
        var sat = mx ? (mx - mn) / mx : 0, hue = 0;
        if (mx !== mn) { if (mx === r) hue = (60 * ((g - b) / (mx - mn)) + 360) % 360; else if (mx === g) hue = 60 * ((b - r) / (mx - mn)) + 120; else hue = 60 * ((r - g) / (mx - mn)) + 240; }
        var base = null, ref = 0;
        if (hue >= 190 && hue <= 265 && sat > 0.15) { base = P; ref = 95; }
        else if (hue >= 33 && hue <= 62 && sat > 0.3 && L > 60) { base = Q; ref = 165; }
        if (base) { var sc = Math.min(1.75, Math.max(0.25, L / ref)); d[i] = Math.min(255, base[0] * sc); d[i + 1] = Math.min(255, base[1] * sc); d[i + 2] = Math.min(255, base[2] * sc); }
      }
      x.putImageData(img, 0, 0);
    }
    cache[key] = c; return c;
  }
  function hx(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function crowd() {   // the stands' people, rolled once: two layers of dots in muted coats
    if (CROWD) return CROWD; CROWD = [];
    var tones = ['#4a5468', '#5a4a44', '#3f5a4c', '#6a6070', '#8a7a5a', '#3a4a6a', '#6f5566'];
    for (var L = 0; L < 2; L++) for (var i = 0; i < 240; i++) CROWD.push({ l: L, x: Math.random() * 1200, y: Math.random(), c: tones[(Math.random() * tones.length) | 0], r: 1.4 + Math.random() * 1.2 });
    return CROWD;
  }

  // ---- a chase on a canvas
  function make(cv, opts) {
    opts = opts || {};
    var T = { minMs: opts.minMs || 2600, scale: opts.scale || 1.9, stride: 11.5, speed: 166, laneGap: 40, exitMs: 1600, crossAt: 700, closeAt: 40, castMax: 2 };   // stride: turf px per run frame, so the feet never slide; closeAt: the gap that earns the alert
    var W = 400, H = 200, DPR = 1, ctx = null, raf = 0, last = 0, t0 = Date.now(), armed = false, exiting = false, done = false, still = false;
    var rec112 = opts.rec || null, drawn112 = false, last112 = 0;   // v112 A: this mount's row on __V112_A.mounts
    var S = { t: 0, beat: 'sprint', beatT: 0, cam: 0, camY: 0, shake: 0, puffs: [], ghosts: [], confetti: [], loops: 0, exitX: 0, crossed: 0, cap: '', capT: 0, alert: 0, close: false, cast: [], castSeen: 0, castSide: 1,
      run: { x: 0, y: 0, lane: 0, st: 'run', f: 0, ft: 0, dist: 0, spd: T.speed, look: 0, spin: 0 },
      def: { x: -96, y: 0, lane: 0, st: 'run', f: 0, ft: 0, dist: 0, spd: T.speed * 1.22, dive: 0 } };
    var ctrl = { state: S, frames: 0, beats: [], get done() { return done; }, get exiting() { return exiting; }, get armed() { return armed; },
      start: start, arm: arm, stop: stop, size: size };
    function size() {
      var r = cv.getBoundingClientRect(); W = Math.max(240, Math.round(r.width || 400)); H = Math.max(140, Math.round(r.height || 200));
      DPR = Math.min(2, window.devicePixelRatio || 1); cv.width = W * DPR; cv.height = H * DPR;
      ctx = cv.getContext('2d'); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.imageSmoothingEnabled = false;
    }
    function start() {
      size(); t0 = Date.now(); caption('sprint');
      if (RM) { still = true; S.run.x = W * 0.5; S.def.x = W * 0.5 - 70; S.cam = 0; S.run.look = 1; draw(); return ctrl; }
      raf = requestAnimationFrame(frame); return ctrl;
    }
    function arm() { armed = true; if (still) finish(); }
    function stop() { done = true; cancelAnimationFrame(raf); }
    function finish() { if (done) return; done = true; cancelAnimationFrame(raf); if (opts.onDone) opts.onDone(); }
    function caption(k) { S.cap = CAPS[k] || ''; S.capT = 0; }
    // ---- the beats
    var BEATS = { sprint: 1200, look: 420, juke: 900, spin: 760, recover: 1000 };
    function nextBeat() {
      var b = S.beat, n;
      if (b === 'sprint') n = Math.random() < 0.8 ? 'look' : (Math.random() < 0.5 ? 'juke' : 'spin');
      else if (b === 'look') n = Math.random() < 0.6 ? 'juke' : 'spin';
      else if (b === 'juke' || b === 'spin') n = 'recover';
      else { n = 'sprint'; S.loops++; }
      setBeat(n);
    }
    function setBeat(n) {
      S.beat = n; S.beatT = 0; ctrl.beats.push(n); if (ctrl.beats.length > 60) ctrl.beats.shift(); caption(n);
      var R = S.run, D = S.def;
      R.look = 0; R.spin = 0;
      if (n === 'look') { R.look = 1; D.spd = T.speed * 1.5; }
      if (n === 'juke') { R.st = 'plant'; R.ft = 0; R.lane = R.lane === 0 ? (Math.random() < 0.5 ? -1 : 1) : 0; D.st = 'run'; D.dive = 0; }
      if (n === 'spin') { R.st = 'spin'; R.ft = 0; R.spin = 1; R.lane = R.lane === 0 ? (Math.random() < 0.5 ? -1 : 1) : 0; D.st = 'run'; D.dive = 0; }
      if (n === 'recover') { D.spd = T.speed * 1.45; }
      if (n === 'sprint') { D.spd = T.speed * 1.22; R.spd = T.speed; }
      if ((n === 'sprint' || n === 'recover') && S.cast.length < T.castMax) castIn();
      if (n === 'exit') { R.spd = T.speed * 1.3; S.exitX = R.x + T.speed * 1.3 * (T.crossAt / 1000); D.st = 'run'; D.dive = 0; }
    }
    // the cast: a defender coming in on an angle — from the stands side or the near touchline — on a
    // pursuit line to the runner; he dives when he gets there, misses, gets up and jogs out of the shot
    function castIn() {
      var R = S.run, side = S.castSide; S.castSide = -side; S.castSeen++;
      S.cast.push({ x: R.x - 30 - Math.random() * 50, y: side < 0 ? -118 : 82, vy: 0, st: 'run', f: 0, ft: 0, dist: 0, spd: T.speed * (1.3 + Math.random() * 0.15), dive: 0, extra: true, lane: R.lane });
    }
    function stepCast(a, dt, secs) {
      var R = S.run;
      if (a.st === 'run') {
        var ty = R.y, dy = ty - a.y, vy = Math.max(-150, Math.min(150, dy * 3.2)); a.vy = vy;
        var x0 = a.x; a.x += a.spd * 0.92 * secs; a.y += vy * secs; stride(a, a.x - x0, false);
        if (a.x > R.x - 30 && Math.abs(a.y - R.y) < 26) { a.st = 'dive'; a.ft = 0; a.dive = 1; }
        else if (a.x > R.x + 40) { a.st = 'out'; }                                     // ran past him: out of the shot
      } else if (a.st === 'dive') { a.x += a.spd * 1.2 * secs; a.ft += dt; if (a.ft > 240) { a.st = 'fall'; a.ft = 0; puff(a.x, a.y, 5); puff(a.x, a.y, 6, true); S.shake = Math.max(S.shake, 4); } }
      else if (a.st === 'fall') { a.ft += dt; if (a.ft > 300) { a.st = 'getup'; a.ft = 0; a.f = 0; } }
      else if (a.st === 'getup') { a.ft += dt; if (a.ft > 80) { a.ft = 0; a.f++; if (a.f >= 8) { a.st = 'out'; a.f = 0; a.dist = 0; } } }
      else if (a.st === 'out') { var x1 = a.x; a.x += T.speed * 0.55 * secs; stride(a, a.x - x1, false); }
      return a.x > S.cam - 90 && a.y > -200 && a.y < 200;   // still in the shot
    }
    function puff(x, y, n, grass) { for (var i = 0; i < n; i++) S.puffs.push({ x: x + (Math.random() - 0.5) * 14, y: y + (Math.random() - 0.5) * 4, r: grass ? 1.2 + Math.random() * 1.6 : 2 + Math.random() * 3, t: 0, life: 380 + Math.random() * 240, vx: -20 - Math.random() * 40, vy: grass ? -40 - Math.random() * 50 : -8 - Math.random() * 10, g: !!grass }); }
    function burst(x, y) { for (var i = 0; i < 46; i++) S.confetti.push({ x: x + (Math.random() - 0.5) * 60, y: y - 20 - Math.random() * 40, vx: (Math.random() - 0.5) * 160, vy: -120 - Math.random() * 160, t: 0, life: 900 + Math.random() * 500, c: ['#f0bb45', '#fff2c4', '#ffffff', '#20304a'][i & 3], a: Math.random() * 6.3 }); }
    // ---- the tick
    function frame(now) {
      if (done) return;
      var dt = Math.min(50, last ? now - last : 16); last = now; S.t += dt; S.beatT += dt; S.capT += dt; ctrl.frames++;
      var R = S.run, D = S.def, secs = dt / 1000;
      // the runner
      var moving = R.st !== 'celebrate', rx0 = R.x;
      R.x += (R.st === 'spin' ? R.spd * 0.55 : R.spd) * secs;
      var ty = R.lane * T.laneGap; R.y += (ty - R.y) * Math.min(1, secs * 9);
      if (R.st === 'plant') { R.ft += dt; if (R.ft > 110) { R.st = 'cut'; R.ft = 0; puff(R.x, R.y, 4); puff(R.x, R.y, 6, true); } }
      else if (R.st === 'cut') { R.ft += dt; ghost(R, true); if (R.ft > 150) { R.st = 'run'; R.ft = 0; } }
      else if (R.st === 'spin') { R.ft += dt; ghost(R, true); if (R.ft > 320) { R.st = 'run'; R.ft = 0; R.spin = 0; } }
      else if (R.st === 'celebrate') { R.ft += dt; R.spd = 0; R.f = Math.floor(R.ft / 140) % 4; }
      else stride(R, R.x - rx0, true);
      // the defender
      if (D.st === 'run') {
        var dx0 = D.x; D.x += D.spd * secs; var dy = D.lane * T.laneGap; D.y += (dy - D.y) * Math.min(1, secs * 7);
        if (D.x > R.x - 18 && S.beat !== 'juke' && S.beat !== 'spin' && S.beat !== 'exit') D.x = R.x - 18;   // never through him outside a move
        stride(D, D.x - dx0, false);
      } else if (D.st === 'dive') { D.x += D.spd * 1.4 * secs; D.ft += dt; if (D.ft > 260) { D.st = 'fall'; D.ft = 0; puff(D.x, D.y, 6); puff(D.x, D.y, 8, true); S.shake = 6; } }
      else if (D.st === 'fall') { D.ft += dt; if (D.ft > 320) { D.st = 'getup'; D.ft = 0; D.f = 0; } }
      else if (D.st === 'getup') { D.ft += dt; if (D.ft > 80) { D.ft = 0; D.f++; if (D.f >= 8) { D.st = 'run'; D.f = 0; D.lane = R.lane; } } }
      else if (D.st === 'grab') { D.x += D.spd * 0.5 * secs; D.ft += dt; if (D.ft > 180) { D.st = 'stagger'; D.ft = 0; puff(D.x, D.y, 3); } }
      else if (D.st === 'stagger') { D.x += D.spd * 0.25 * secs; D.ft += dt; if (D.ft > 420) { D.st = 'run'; D.ft = 0; D.f = 0; D.lane = R.lane; } }
      // the beat's own logic
      for (var ci = S.cast.length - 1; ci >= 0; ci--) if (!stepCast(S.cast[ci], dt, secs)) S.cast.splice(ci, 1);
      if (S.beat === 'juke' && D.st === 'run' && !D.dive && S.beatT > 120) { D.dive = 1; D.st = 'dive'; D.ft = 0; D.lane = R.lane === 0 ? 0 : -R.lane * 0.2; }
      if (S.beat === 'spin' && D.st === 'run' && !D.dive && S.beatT > 60) { D.dive = 1; D.st = 'grab'; D.ft = 0; }
      if (S.beat === 'look' && S.beatT > 260) R.look = 0;
      if (S.beat === 'exit') {
        if (!D.dive && S.beatT > 200) { D.dive = 1; D.st = 'dive'; D.ft = 0; }
        if (R.x >= S.exitX && !S.crossed) { S.crossed = S.t; R.spd = T.speed * 1.45; caption('td'); burst(R.x, R.y); S.shake = 4; }   // he runs straight through the shot
        if (S.beatT >= T.exitMs) finish();
      } else if (S.beatT >= BEATS[S.beat]) nextBeat();
      // the door: the exit waits for the app, the minimum show, and one full cycle, and never lands mid-move
      if (armed && !exiting && (S.loops >= 1 || opts.fullCycle === false) && (S.beat === 'sprint' || S.beat === 'recover') && Date.now() - t0 >= T.minMs) { exiting = true; setBeat('exit'); }
      // the alert: the defender on his heels (upright and inside closeAt) puts the mark over his head; it pops in and fades out
      S.close = !S.crossed && (D.st === 'run' || D.st === 'grab') && R.x - D.x < T.closeAt && D.x < R.x;
      S.alert = S.close ? Math.min(1, S.alert + dt / 140) : Math.max(0, S.alert - dt / 220);
      // the camera keeps the runner at 38% of the strip, bobs with the stride, shakes on a hit
      S.cam += ((S.crossed ? Math.min(R.x, S.exitX + 6) : R.x) - W * 0.38 - S.cam) * Math.min(1, secs * 6);   // the camera holds at the goal line and lets him go
      S.camY *= 0.85;
      S.shake *= Math.pow(0.02, secs);
      for (var i = S.puffs.length - 1; i >= 0; i--) { var p = S.puffs[i]; p.t += dt; p.x += p.vx * secs; p.y += p.vy * secs; if (p.g) p.vy += 160 * secs; if (p.t > p.life) S.puffs.splice(i, 1); }
      for (i = S.ghosts.length - 1; i >= 0; i--) { S.ghosts[i].t += dt; if (S.ghosts[i].t > 220) S.ghosts.splice(i, 1); }
      for (i = S.confetti.length - 1; i >= 0; i--) { var c = S.confetti[i]; c.t += dt; c.x += c.vx * secs; c.y += c.vy * secs; c.vy += 260 * secs; c.a += secs * 6; if (c.t > c.life) S.confetti.splice(i, 1); }
      draw();
      raf = requestAnimationFrame(frame);
    }
    // the run cycle is locked to the ground covered: one frame per T.stride px, so a faster man's
    // legs turn faster and nobody's feet slide; the footfall frames (0 and 4) raise the dust
    function stride(a, dx, dust) {
      a.dist += Math.max(0, dx); var nf = Math.floor(a.dist / T.stride) % 8;
      if (nf !== a.f) { a.f = nf; if (dust && (nf & 3) === 0) puff(a.x - 10, a.y + 2, 1); }
    }
    function ghost(a, isR) { if (!S.ghosts.length || S.t - S.ghosts[S.ghosts.length - 1].at > 45) S.ghosts.push({ x: a.x, y: a.y, name: poseOf(a, isR), flip: poseFlip, t: 0, at: S.t, kit: isR ? 'you' : 'def' }); }
    // ---- the pose: which cell, which way
    var poseFlip = true;
    function poseOf(a, isRunner) {
      poseFlip = true;
      if (isRunner) {
        if (a.st === 'plant') return 'plant_sd'; if (a.st === 'cut') return 'cut_sd';
        if (a.st === 'celebrate') { poseFlip = false; return 'celebrate_dr' + a.f; }
        if (a.st === 'spin') {   // side, front, back-side, back, side: the body turns through the sheet's facings
          var k = Math.min(4, Math.floor(a.ft / 70)), seq = [['run_sd', true], ['run_dn', false], ['run_sd', false], ['run_up', false], ['run_sd', true]][k];
          poseFlip = seq[1]; return seq[0] + (seq[0] === 'run_sd' ? a.f : (a.f % 8));
        }
        if (a.look) return 'run_dr' + (a.f % 8);   // the quarter-turn: down-left is over the shoulder
        return 'run_sd' + a.f;
      }
      if (a.st === 'dive') return 'dive_sd'; if (a.st === 'fall') return 'fall_sd';
      if (a.st === 'getup') { poseFlip = false; return 'getup_dr' + Math.min(7, a.f); }
      if (a.extra && (a.st === 'run' || a.st === 'out')) { if (a.st === 'run' && a.vy < -24) { poseFlip = false; return 'run_ur' + a.f; } if (a.st === 'run' && a.vy > 24) { poseFlip = false; return 'run_dr' + a.f; } return 'run_sd' + a.f; }
      if (a.st === 'grab') return 'plant_sd';
      if (a.st === 'stagger') { poseFlip = false; return 'hurt_dr' + (a.ft > 210 ? 1 : 0); }
      return 'run_sd' + a.f;
    }
    // ---- the draw
    function draw() {
      if (!ctx) return;
      // v112 A: the stopwatch stops on the first frame actually painted, and every frame after it
      // reports the gap it opened — a loading screen that is up but standing still is not ready
      var tf = T112();
      if (!drawn112) { drawn112 = true; if (rec112) { rec112.firstFrame = tf; rec112.ms = tf - rec112.at; } if (A112 && A112.firstFrameMs == null) A112.firstFrameMs = tf; }
      else if (rec112) { var gp = tf - last112; if (gp > rec112.maxGapMs) { rec112.maxGapMs = gp; rec112.maxGapAt = last112; } }
      if (rec112) rec112.frames++;
      last112 = tf;
      var s = T.scale, R = S.run, D = S.def, ground = H * 0.62, cam = S.cam, yard = 12;
      var sx = (Math.random() - 0.5) * S.shake, sy = (Math.random() - 0.5) * S.shake + S.camY;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H); ctx.translate(sx, sy);
      // the stands: a dark bowl, the crowd on two parallax layers, the fascia, a floodlight glow
      ctx.fillStyle = '#0e1521'; ctx.fillRect(-8, -8, W + 16, H * 0.2 + 8);
      var cr = crowd(), top = H * 0.02, band = H * 0.15;
      for (var i = 0; i < cr.length; i++) { var q = cr[i], par = q.l ? 0.38 : 0.24, px = ((q.x - cam * par) % 1200 + 1200) % 1200 - 60; if (px < -8 || px > W + 8) continue;
        ctx.fillStyle = q.c; ctx.globalAlpha = q.l ? 0.9 : 0.55; ctx.beginPath(); ctx.arc(px, top + q.y * band + (q.l ? band * 0.15 : 0), q.r, 0, 6.3); ctx.fill(); }
      ctx.globalAlpha = 1;
      var fg = ctx.createLinearGradient(0, H * 0.14, 0, H * 0.2); fg.addColorStop(0, 'rgba(9,11,15,0)'); fg.addColorStop(1, 'rgba(9,11,15,.75)'); ctx.fillStyle = fg; ctx.fillRect(-8, H * 0.14, W + 16, H * 0.06);
      var lg = ctx.createRadialGradient(W * 0.5, -H * 0.2, 0, W * 0.5, -H * 0.2, W * 0.7); lg.addColorStop(0, 'rgba(255,240,200,.22)'); lg.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = lg; ctx.fillRect(-8, -8, W + 16, H * 0.5);
      // the turf: bands every five yards, chalk every ten, numbers every ten, the hash ticks
      for (var x = Math.floor(cam / (yard * 5)) * yard * 5 - yard * 5; x < cam + W + yard * 5; x += yard * 5) {
        var idx = Math.floor(x / (yard * 5)), even = idx % 2 === 0;
        ctx.fillStyle = even ? '#1f6b34' : '#1b5f2e'; ctx.fillRect(x - cam, H * 0.2, yard * 5 + 1, H * 0.72);
        if (even) { ctx.fillStyle = 'rgba(240,244,240,.7)'; ctx.fillRect(x - cam, H * 0.2, 2, H * 0.72);
          var num = ((idx / 2) % 10 + 10) % 10 * 10, txt = num === 0 ? '' : String(num <= 50 ? num : 100 - num);
          if (txt) { ctx.save(); ctx.fillStyle = 'rgba(240,244,240,.22)'; ctx.font = '700 16px Oswald, sans-serif'; ctx.textAlign = 'center'; ctx.translate(x - cam + 12, H * 0.31); ctx.rotate(Math.PI / 2); ctx.fillText(txt, 0, 0); ctx.restore(); } }
        ctx.fillStyle = 'rgba(240,244,240,.35)'; ctx.fillRect(x - cam + yard * 2.5, H * 0.46, 1, 6); ctx.fillRect(x - cam + yard * 2.5, H * 0.66, 1, 6);
      }
      if (S.beat === 'exit') {   // the end zone paints in ahead of him
        var ez = S.exitX - cam + 10; ctx.fillStyle = '#20304a'; ctx.fillRect(ez, H * 0.2, W, H * 0.72);
        ctx.fillStyle = S.crossed && S.t - S.crossed < 260 ? '#ffffff' : '#f0bb45'; ctx.fillRect(ez, H * 0.2, 4, H * 0.72);
        ctx.save(); ctx.translate(ez + 34, H * 0.56); ctx.rotate(-Math.PI / 2); ctx.fillStyle = 'rgba(240,187,69,.85)'; ctx.font = '700 22px Oswald, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('THE LEAGUE', 0, 0); ctx.restore();
        if (S.crossed && S.t - S.crossed < 220) { ctx.fillStyle = 'rgba(255,255,255,' + (0.5 * (1 - (S.t - S.crossed) / 220)).toFixed(2) + ')'; ctx.fillRect(-8, -8, W + 16, H + 16); }
      }
      ctx.fillStyle = '#eef2f7'; ctx.fillRect(-8, H * 0.2 - 2, W + 16, 3); ctx.fillRect(-8, H * 0.92, W + 16, 3);
      var vg = ctx.createLinearGradient(0, 0, 0, H); vg.addColorStop(0, 'rgba(13,20,29,.35)'); vg.addColorStop(0.25, 'rgba(13,20,29,0)'); vg.addColorStop(0.85, 'rgba(13,20,29,0)'); vg.addColorStop(1, 'rgba(13,20,29,.7)');
      ctx.fillStyle = vg; ctx.fillRect(-8, -8, W + 16, H + 16);
      // the puffs and the tufts
      for (i = 0; i < S.puffs.length; i++) { var p = S.puffs[i], k = 1 - p.t / p.life;
        if (p.g) { ctx.fillStyle = 'rgba(96,170,70,' + (0.8 * k).toFixed(2) + ')'; ctx.fillRect(p.x - cam, ground + p.y, 2, 3); }
        else { ctx.fillStyle = 'rgba(214,196,150,' + (0.55 * k).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(p.x - cam, ground + p.y + 2, p.r * (1.6 - k * 0.6), 0, 6.3); ctx.fill(); } }
      // speed lines when he is at full tilt
      var fast = R.spd > T.speed * 1.15 && R.st === 'run';
      if (fast) { ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1.5;
        for (i = 0; i < 5; i++) { var ly = ground + R.y - 40 * s / 2.5 + i * 9 * s / 2.5 + Math.sin(S.t / 60 + i) * 2, lx = R.x - cam - 22 * s / 2.5 - (S.t / 9 + i * 13) % 30; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx - 26 - i * 6, ly); ctx.stroke(); } }
      // the afterimages through a cut or a spin
      for (i = 0; i < S.ghosts.length; i++) { var gh = S.ghosts[i], gc = cell(gh.name, gh.kit); if (!gc) continue;
        ctx.save(); ctx.globalAlpha = 0.28 * (1 - gh.t / 220); ctx.translate(gh.x - cam, ground + gh.y); if (gh.flip) ctx.scale(-1, 1); ctx.drawImage(gc, -24 * s, -46 * s, 48 * s, 48 * s); ctx.restore(); }
      // the two of them, the deeper lane drawn first
      var order = [R, D].concat(S.cast).sort(function (p, q) { return p.y - q.y; });
      for (var j = 0; j < order.length; j++) { var a = order[j], isR = a === R; drawMan(a, isR ? 'you' : 'def', isR, ground); }
      // the confetti
      for (i = 0; i < S.confetti.length; i++) { var cf = S.confetti[i]; ctx.save(); ctx.globalAlpha = Math.max(0, 1 - cf.t / cf.life); ctx.translate(cf.x - cam, ground + cf.y); ctx.rotate(cf.a); ctx.fillStyle = cf.c; ctx.fillRect(-2, -3.5, 4, 7); ctx.restore(); }
      // the call
      if (S.cap && opts.captions !== false) { var ca = Math.min(1, S.capT / 120) * (S.capT > 1100 ? Math.max(0, 1 - (S.capT - 1100) / 300) : 1);
        if (ca > 0) { ctx.save(); ctx.globalAlpha = ca; ctx.font = '700 12px Oswald, sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(11,17,25,.75)';
          var tw = ctx.measureText(S.cap).width + 18; ctx.fillRect(10, H - 30, tw, 20); ctx.fillStyle = S.cap === CAPS.td ? '#f0bb45' : '#eef2f7'; ctx.fillText(S.cap, 19, H - 16); ctx.restore(); } }
    }
    function drawMan(a, kit, isRunner, ground) {
      var s = T.scale, x = a.x - S.cam, y = ground + a.y, name = poseOf(a, isRunner), flip = poseFlip;
      var c = cell(name, kit) || cell('idle_sd', kit); if (!c) return;
      var running = a.st === 'run' && !(isRunner && a.look), ph = (a.dist / (T.stride * 8)) % 1;
      var bounce = running ? Math.abs(Math.sin(ph * Math.PI * 2)) * 2.6 * s / 2.5 : 0;               // two lifts a cycle, one per footstrike
      var lean = running ? Math.max(-0.11, Math.min(0, -0.03 - (a.spd / T.speed - 1) * 0.18)) : 0;   // the faster he runs, the further he leans in
      var px = Math.round(x * DPR) / DPR, py = Math.round((y - bounce) * DPR) / DPR;                  // whole device pixels: no shimmer between frames
      ctx.fillStyle = 'rgba(0,0,0,' + (0.28 - bounce * 0.03).toFixed(2) + ')'; ctx.beginPath(); ctx.ellipse(px, y + 3, (13 + (isRunner && a.spd > T.speed * 1.15 ? 4 : 0) + bounce * 0.4) * s / 2.5, 5 * s / 2.5, 0, 0, 6.3); ctx.fill();
      ctx.save(); ctx.translate(px, py); if (flip) ctx.scale(-1, 1); if (lean) ctx.rotate(lean);
      // the ball, tucked behind the far arm: drawn before the body so only a sliver of leather shows past the elbow
      if (isRunner && a.st !== 'celebrate' && a.st !== 'spin') { var b = cell('ball_spin0', 'raw'); if (b) { ctx.save(); ctx.translate(-10.5 * s, -19 * s); ctx.rotate(-0.35); ctx.drawImage(b, -7 * s, -7 * s, 14 * s, 14 * s); ctx.restore(); } }
      ctx.drawImage(c, -24 * s, -46 * s, 48 * s, 48 * s);
      ctx.restore();
      if (isRunner && S.alert > 0) alertMark(px, py - 46 * s, S.alert);
    }
    // the exclamation over his head: a chalk pip with a gold mark, popping in with an overshoot, jittering while the man is on him
    function alertMark(x, top, k) {
      var e = 1 + 2.4 * Math.pow(1 - k, 2) * Math.sin(k * Math.PI), sc = k * e;   // ease-out-back: overshoots, settles
      var jx = S.close ? (Math.random() - 0.5) * 1.6 : 0, hop = S.close ? Math.abs(Math.sin(S.t / 110)) * 3 : 0;
      ctx.save(); ctx.translate(Math.round(x + jx), Math.round(top - 14 - hop)); ctx.scale(sc, sc); ctx.globalAlpha = Math.min(1, k * 1.4);
      ctx.fillStyle = '#0b1119'; ctx.strokeStyle = '#eef2f7'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-7, -12, 14, 22, 4) : ctx.rect(-7, -12, 14, 22); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f0bb45'; ctx.font = '700 17px Oswald, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, 0);
      ctx.restore();
    }
    return ctrl;
  }
  window.__CHASE_V94 = { load: load, make: make, get ready() { return !!IMG; }, get rm() { return RM; },
    cell: function (name, kit) { try { return cell(name, kit || 'you'); } catch (e) { return null; } } };   // v133: one recoloured cell, for the growth screen's boy
  load();   // v112 A: the cut happens now, not at the first mount — a page with no splash (the menu preview, a reload straight into the hub) still has its frames ready for the live game's loader

  // ---- door one: the boot splash
  (function () {
    var splash = document.getElementById('splash'), cv = document.getElementById('splashChase');
    if (!splash || !cv) return;
    var t0 = Date.now(), ready = false, dead = false, done = false, chase = null;
    var api = window.__SPLASH_V94 = { get state() { return chase ? chase.state : null; }, get ready() { return ready; }, get dead() { return dead; }, get done() { return done; }, get exiting() { return !!(chase && chase.exiting); }, get frames() { return chase ? chase.frames : 0; }, get beats() { return chase ? chase.beats : []; } };
    function finish() {
      if (done) return; done = true; if (chase) chase.stop();
      var bar = splash.querySelector('.splash-loader i'); if (bar) { bar.style.animation = 'none'; bar.style.transform = 'none'; bar.style.marginLeft = '0'; bar.style.width = '100%'; }
      splash.classList.add('gone');
      setTimeout(function () {
        try { if (window.__V114 && window.__V114.park) window.__V114.park(); } catch (e) {}   // v115: keep the loaded film for door two
        try { if (window.__V114 && window.__V114.warm && !window.__V114.parked) window.__V114.warm(); } catch (e) {}   // v132: and if there is nothing to keep, build the standby now, not at the door
        if (splash.parentNode) splash.parentNode.removeChild(splash);
      }, 600);
    }
    var rec = mountRec112('splash');
    /* v114: the film gets first refusal on the stage. The chase waits for its verdict — a frame
     * up, or given up — so the two can never be on screen together; with no v114 at all (an older
     * document) `filmOut` starts true and everything below is the pre-v114 path, unchanged. */
    var sheetOk = null, filmOut = !window.__V114;
    /* ===== v121 THE FOOTBALL IS THE LAST RESORT =====
     * The 🏈 in the splash stage used to be painted the moment the document parsed and hidden again
     * when the film or the chase claimed the stage — so every boot showed a static emoji on a bare
     * card for the second before the sting started, which read as an older loading screen flashing
     * under the new one. It is hidden in CSS now and only asked for here, when BOTH have stood
     * down: the film declined (reduced motion aside, which shows the film's own last frame) AND the
     * v91 sheet never arrived, so there is no chase to draw. That is the case the football is for. */
    function ballStandsIn() { if (filmOut && sheetOk === false && !done) splash.classList.add('ball'); }
    function mountChase() {
      if (done || chase || !filmOut || !sheetOk) return;
      ready = true; splash.classList.add('chase');
      chase = make(cv, { minMs: 2600, onDone: finish, rec: rec }).start();
      if (api.__armWhenReady) chase.arm();
    }
    load().then(function (ok) {
      sheetOk = !!ok;
      if (!ok || done) { dead = true; ballStandsIn(); return; }
      mountChase();
    });
    if (window.__V114) window.__V114.verdict(function (claimed) { if (!claimed) { filmOut = true; mountChase(); ballStandsIn(); } });
    function chaseDoor() {
      if (dead || !ready) {   // the sheet is not here (yet): the old timing, exactly — or the door the moment it lands
        if (dead) { setTimeout(finish, 1100); return true; }
        api.__armWhenReady = true; setTimeout(function () { if (!ready) finish(); }, 1100); return true;
      }
      chase.arm();
      setTimeout(function () { if (!done) finish(); }, 12000);   // the watchdog if the loop ever stalls
      return true;
    }
    window.__splashDoneV94 = function () {
      var F = window.__V114;
      if (!F) return chaseDoor();
      // v114: the film may not have decided yet on a fast boot — ask it, then knock on the door it names
      F.verdict(function (claimed) { if (claimed) F.appReady(finish); else chaseDoor(); });
      return true;
    };
    window.addEventListener('resize', function () { if (chase && !done) chase.size(); });
  })();

  // ---- door two: the live game's loader. The field is about to be built (the Phaser bundle
  // mounts on the first draw, the sheets register, the crowd and the stands take their seats);
  // v132: the sting — its still, then the film — runs over .field-wrap until the scene is up, the
  // first play is built and the minimum show has run. The chase no longer mounts at this door.
  (function () {
    var cur = null, lastGame = null, waiters = [], warm = false;
    /* v101: the chase is not a curtain the game hides behind — it is the time the game uses.
     * The career app tells the loader when the first play's script has finished building
     * behind it (`simReady`), and the door only opens once BOTH the field is standing and
     * that build is done, so the fade-out crosses into a play that is already choreographed
     * instead of a blank field that then has to think. `warmMs` is the ceiling: a build that
     * never reports back must not hold the game hostage. */
    var api = window.__LIVELOAD_V94 = { get current() { return cur; }, shows: 0, mount: mount,
      lastFilmMs: null, lastFilmOwn: null,   // v127: how long door two took to get the sting up, and whether it had to build it
      lastStillMs: null, lastPicMs: null,    // v132: when the still landed, and when the loader first had ANY picture (still or film)
      get warm() { return warm; },
      simReady: function () { warm = true; },
      /* v101: the MutationObserver below delivers a tick AFTER the field is inserted, and the
       * career app asks for the first play in the same breath as inserting it — so the loader
       * could lose that race and the game would start under a curtain that had not gone up
       * yet. `ensure` mounts synchronously for whoever asks first; the observer then finds the
       * wrap already claimed and does nothing. */
      ensure: function () {
        if (cur) return cur;
        var screen = document.getElementById('screen'); if (!screen) return null;
        var wrap = screen.querySelector('.field-wrap'); if (!wrap || wrap.__liveloadV94) return null;
        wrap.__liveloadV94 = true;
        return mount(wrap);   // v132: mounts under reduced motion too — there it is the still, and nothing moves
      },
      whenClear: function (cb) { if (!cur || cur.done) { cb(); return; } waiters.push(cb); } };   // v97: the sim waits at the door
    function release() { var w = waiters; waiters = []; w.forEach(function (cb) { try { cb(); } catch (e) {} }); }
    function mount(wrap) {
      if (!wrap || wrap.querySelector('.rib-liveload-v94') || cur) return null;
      // once per game: a re-render of the live view mid-game must not bring the loader back
      try { var st = window.__getGridironState && window.__getGridironState(), g = st && st._liveGame; if (g) { if (g === lastGame) return null; lastGame = g; } } catch (e) {}
      /* ===== v132 THE INTRO FILM IS THE LOADER, AND IT IS UP ON THE FIRST PAINT =====
       * This door used to be the v94 chase with the film auditioning over it: the chase mounted first,
       * the film borrowed door one's element (or built its own, v127) and claimed the stage once it had
       * a frame — and whenever it did not inside 1.2s (a main thread busy compiling Phaser, an emptied
       * park, a slow decode) the chase stayed for the whole door. That is the old loading screen a player
       * kept meeting in front of live games. The chase is gone from this door.
       *
       * The loader IS the sting now, in three layers that agree on one picture:
       *   1. the STILL — `rib_film_v116.jpg`, the film's own last frame (the landed wordmark) — laid under
       *      everything as an <img> whose src is set before the element is in the document. It is a
       *      cached ~40KB jpg, so it is on the loader's first paint whatever the film is doing;
       *   2. the FILM over it, from v116's seam, which is that same picture in motion. It is warm by
       *      construction: `__V114.take()` hands out the element door one played (parked), else the
       *      standby v132 built the moment the splash left (`__V114.warm()`), so this is a seek and a
       *      play, never a load. The still-to-film hand-over is invisible — the seam frame and the last
       *      frame differ by 3.4/255 (v116 measured it);
       *   3. the CAPTION in the band below the picture, exactly as v115 placed it.
       * With the film off for a real reason — reduced motion, ?noFilmV114 — the still stands alone; a
       * film that never gets a frame up simply never claims, and the still stands. Nothing auditions,
       * nothing falls back to a canvas.
       *
       * And the door opens on the scene standing and the first play built (v101), after LIVE_MIN_MS so
       * the picture is seen rather than glimpsed. It used to sit on the 9s watchdog whenever the film was
       * up, because only the chase's own beat ever called finish(). The watchdog stays as the ceiling. */
      var STILL_V132 = window.__RIB_ASSET ? window.__RIB_ASSET('rib_film_v116.jpg') : './public/rib_film_v116.jpg';
      var LIVE_MIN_MS = 1600;        // the shortest the door stays shut once mounted: the sting is seen, not glimpsed
      var LIVE_SEEN_MS = 900;        // and once the film is up, it is on screen at least this long before the exit starts
      var LIVE_FILM_WAIT_MS = 2600;  // how long a ready door will wait for a film that has not claimed yet (a cold decode) before the still carries the exit
      var el = document.createElement('div'); el.className = 'rib-liveload-v94 film';
      var us = '', them = '';
      try { us = wrap.querySelector('.sb-side.us .team').textContent.trim(); them = wrap.querySelector('.sb-side.them .team').textContent.trim(); } catch (e) {}
      el.innerHTML = '<img class="rib-liveload-still-v132" alt="" aria-hidden="true"><div class="rib-liveload-cap-v94"><b>' + (us && them ? us + ' <i>vs</i> ' + them : 'GAME DAY') + '</b><span>TAKING THE FIELD</span></div><div class="rib-liveload-bar-v94"><i></i></div>';
      var still = el.querySelector('.rib-liveload-still-v132');
      var item = cur = { el: el, wrap: wrap, t0: Date.now(), chase: null, done: false, ready: false, field: false, film: false, filmMs: null, filmOwn: false, still: false, stillMs: null, picMs: null };
      var rec = mountRec112('live');
      // the first PICTURE on the loader — still or film, whichever lands first — is what the v112 A stopwatch records for this door
      function pictured() { if (item.picMs != null) return; item.picMs = Date.now() - item.t0; api.lastPicMs = item.picMs; if (rec && rec.firstFrame == null) { rec.firstFrame = T112(); rec.ms = rec.firstFrame - rec.at; } }
      still.addEventListener('load', function () { if (item.done) return; item.still = true; item.stillMs = Date.now() - item.t0; api.lastStillMs = item.stillMs; el.classList.add('still'); pictured(); });
      still.addEventListener('error', function () { el.classList.add('nostill'); });
      still.src = STILL_V132;
      wrap.appendChild(el); api.shows++;
      warm = false;
      function finish() {
        if (item.done) return; item.done = true; if (item.chase) item.chase.stop(); if (cur === item) cur = null;
        release();
        var bar = el.querySelector('.rib-liveload-bar-v94 i'); if (bar) { bar.style.animation = 'none'; bar.style.transform = 'none'; bar.style.marginLeft = '0'; bar.style.width = '100%'; }
        el.classList.add('gone');
        setTimeout(function () {
          // the film is parked at the END of the exit, not the start: giving it back up front
          // detached the <video> instantly and left an empty black layer to fade, which is the
          // dropped-frame look the push-through exists to replace
          try { if (item.filmEl && window.__V114 && window.__V114.give) window.__V114.give(item.filmEl); } catch (e) {}
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 720);
      }
      /* ===== v115 THE FILM AT BOTH DOORS (v132: and only the film) =====
       * Two things stay deliberately different from door one.
       *   - IT DOES NOT WAIT FOR THE FILM. Holding the door for the whole 14.5s sting would put twelve
       *     seconds in front of every single game. The film runs under the loader for as long as the
       *     loader lives, and the loader leaves on top of it, wherever round it happens to be.
       *   - IT STARTS AT THE SEAM, NOT THE TOP. The sting opens on a second of near-black and spends six
       *     more assembling the wordmark; this door starts where the picture is finished
       *     (LOOP_FROM_V116) and rides the same loop, so every frame it can show is the wordmark under cloud. */
      var F = window.__V114;
      var LIVE_FILM_FROM = (F && F.loopFrom) || 1.15;  // seconds: v116's seam — the wordmark, landed
      var fv = null, fvOwn = false;
      if (F && !F.rm && !F.off) {
        fv = F.take ? F.take('rib-liveload-film-v115') : null;   // the parked element, else v132's standby
        /* v127: and if there is neither — an earlier game still holding it, a document that never had a
         * splash — build one on the same URL. It is in the browser cache, so this is a decode, not a
         * download; it is handed to give() on the way out, so from the next game on there IS one parked. */
        if (!fv && F.src) {
          try { fv = document.createElement('video'); fv.className = 'rib-liveload-film-v115'; fv.preload = 'auto'; fv.src = F.src; fvOwn = true; } catch (e) { fv = null; }
        }
      }
      if (fv) {
        fv.setAttribute('aria-hidden', 'true'); el.insertBefore(fv, el.querySelector('.rib-liveload-cap-v94'));
        var filmOn = false;
        var claimed = function () {
          if (filmOn || item.done) return;
          filmOn = true; item.film = true; item.filmMs = Date.now() - item.t0; item.filmOwn = fvOwn; el.classList.add('playing');
          api.lastFilmMs = item.filmMs; api.lastFilmOwn = fvOwn; pictured();
        };
        item.filmEl = fv;
        /* v127: an element that already carries its metadata (parked, or a standby that has loaded) seeks
         * to the seam on this tick and can claim the stage as soon as it has a frame. One with no
         * metadata yet has `duration` NaN for a beat, so that seek is skipped — and claiming then would put
         * the film's opening second of near-black over the still, which is the thing this door exists not
         * to do. So a fresh film seeks when its metadata arrives and does not claim until the playhead is
         * at the seam. `atSeam` is the one gate. */
        var fresh = !(fv.readyState >= 1), seekDone = false;
        function seekSeam() { if (seekDone) return; try { if (fv.duration > LIVE_FILM_FROM + 1) { fv.currentTime = LIVE_FILM_FROM; seekDone = true; } } catch (e) {} }
        function atSeam() { return !fresh || seekDone || fv.currentTime >= LIVE_FILM_FROM - .25; }
        function tryClaim() { if (fv.readyState >= 2 && atSeam()) claimed(); }
        fv.addEventListener('loadedmetadata', seekSeam);
        fv.addEventListener('playing', tryClaim);
        ['canplay', 'seeked', 'loadeddata'].forEach(function (ev) { fv.addEventListener(ev, tryClaim); });
        fv.addEventListener('timeupdate', function () { if (fv.currentTime > 0) tryClaim(); });
        // v116: the end of the film is a seek back to the seam, not a stop. A parked element carries door
        // one's own `ended` listener, which is the looper; this is the belt to that brace, and loopBack
        // is a no-op when the playhead is already sitting on the seam.
        fv.addEventListener('ended', function () { if (F && F.loopBack) F.loopBack(fv); else { try { fv.pause(); } catch (e) {} } });
        fv.loop = false; fv.muted = true; fv.defaultMuted = true; fv.playsInline = true;
        // a warm element claims the stage on THIS tick. Seek first, then claim: a seek drops readyState for
        // a beat, and a warm element's picture at the seam is the still's picture anyway.
        seekSeam();
        if (!fresh && fv.readyState >= 2) claimed();
        var pp = null; try { pp = fv.play(); } catch (e) {}
        if (pp && pp.catch) pp.catch(function () {});
      }
      // the scene is the ready signal; the field being torn down is the exit signal
      var poll = setInterval(function () {
        if (item.done || !el.parentNode) { clearInterval(poll); finish(); return; }
        var sc = window.__gridironScene, active = !!(sc && sc.sys && sc.sys.isActive && sc.sys.isActive());
        // v102: a play built behind the door (`warm`) is proof the scene is standing, even when no
        // static frame has put men on the grass yet — a game entered straight into its first snap
        // used to wait here for the nine-second watchdog
        var up = active && ((sc.markers && sc.markers.length) || warm);
        if (up && !item.field) { item.field = true; el.querySelector('.rib-liveload-cap-v94 span').textContent = 'WARMING UP'; }
        // v101: field standing AND first play built — or the ceiling, so a silent build never stalls the game
        if (item.field && !item.ready && (warm || Date.now() - item.t0 > 4200)) {
          item.ready = true; el.querySelector('.rib-liveload-cap-v94 span').textContent = 'KICKOFF';
        }
        // v132: ready, and the picture has had its minimum — the door opens. Nothing else opens it. A film
        // still decoding gets LIVE_FILM_WAIT_MS to claim; a film that has claimed is seen for LIVE_SEEN_MS.
        var age = Date.now() - item.t0, filmSettled = !item.filmEl || (item.film ? age - item.filmMs >= LIVE_SEEN_MS : age >= LIVE_FILM_WAIT_MS);
        if (item.ready && age >= LIVE_MIN_MS && filmSettled) { clearInterval(poll); finish(); return; }
        if (Date.now() - item.t0 > 9000) { clearInterval(poll); finish(); }   // the broadcast never came: the game is playable without it
      }, 100);
      return item;
    }
    // the field arriving in #screen is the cue
    function arm() {
      var screen = document.getElementById('screen'); if (!screen) return;
      new MutationObserver(function () {
        var wrap = screen.querySelector('.field-wrap'); if (!wrap || wrap.__liveloadV94) return;
        wrap.__liveloadV94 = true; mount(wrap);   // v132: see ensure()
      }).observe(screen, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arm); else arm();
  })();
})();
