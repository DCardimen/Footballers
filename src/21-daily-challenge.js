
/* ===== v48 DAILY CHALLENGE — deterministic, verifiable daily leaderboard ======
   A once-a-day Score Attack variant. Everyone in the world gets the SAME seed
   each UTC day, so runs are directly comparable; the only lever is your Steady /
   Go-for-glory choice each round. Because it is fully DETERMINISTIC, the server
   re-runs the exact same engine to verify a submitted score — cheating is
   impossible (see supabase/functions/verify-daily/ and scripts/replay.mjs).

   The engine below is a byte-for-byte MIRROR of scripts/daily-engine.mjs (the
   canonical copy). scripts/dailycheck.mjs cross-checks the two so they can't
   drift — if you edit one, edit the other.

   Wiring: router o.view==="daily" -> window.__dailyRender(o). Submits via
   window.__lb.submitDaily({daySeed,choices,score}). One attempt per UTC day,
   locked in localStorage (rib_daily_<daySeed>).
============================================================================ */
(function () {
  "use strict";

  // ---------- MIRROR of scripts/daily-engine.mjs (keep identical) ----------
  var ROUNDS = 5;
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hashSeed() { var h = 2166136261 >>> 0, s = Array.prototype.join.call(arguments, "|"); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function dayKey(ts) { var d = (ts == null) ? new Date() : new Date(ts); return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); }
  function bar(r) { return 40 + r * 26; }
  function roundBase(daySeed, r) { return Math.round(55 + mulberry32(hashSeed("base", daySeed, r))() * 120); }
  function gloryRoll(daySeed, r) { return mulberry32(hashSeed("glory", daySeed, r))(); }
  function run(daySeed, choices) {
    var total = 0, rounds = [];
    for (var r = 0; r < ROUNDS; r++) {
      var base = roundBase(daySeed, r);
      var form = (choices && choices[r] === "glory") ? "glory" : "steady";
      var sc;
      if (form === "glory") { sc = gloryRoll(daySeed, r) < 0.42 ? 0 : Math.round(base * 1.9); }
      else { sc = base; }
      total += sc;
      rounds.push({ r: r, bar: bar(r), base: base, form: form, sc: sc, bust: form === "glory" && sc === 0 });
    }
    return { daySeed: daySeed, total: total, rounds: rounds };
  }
  window.DailyEngine = { ROUNDS: ROUNDS, mulberry32: mulberry32, hashSeed: hashSeed, dayKey: dayKey, bar: bar, roundBase: roundBase, gloryRoll: gloryRoll, run: run,
    verify: function (daySeed, choices, claimed) { var res = run(daySeed, choices); return { ok: res.total === claimed, total: res.total }; } };
  // ------------------------------------------------------------------------

  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return (n | 0).toLocaleString(); };

  function todaySeed() { return dayKey(); }
  function lockKey(seed) { return "rib_daily_" + seed; }
  function loadLock(seed) { try { return JSON.parse(localStorage.getItem(lockKey(seed)) || "null"); } catch (e) { return null; } }
  function saveLock(seed, rec) { try { localStorage.setItem(lockKey(seed), JSON.stringify(rec)); } catch (e) {} }
  function utcResetIn() {
    var now = new Date();
    var next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
    var ms = next - now.getTime(), h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    return h + "h " + m + "m";
  }
  function dateLabel(seed) { var s = "" + seed; return s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8); }

  // ---- run state ----
  var STATE = null, VIEW = "intro", SEED = 0, CHOICES = [], ROUNDIDX = 0, TOTAL = 0, LASTR = null, SUBMIT = "";

  function startRun() { SEED = todaySeed(); CHOICES = []; ROUNDIDX = 0; TOTAL = 0; LASTR = null; SUBMIT = ""; VIEW = "round"; draw(); }

  function playRound(form) {
    CHOICES[ROUNDIDX] = form;
    // resolve just this round deterministically (the same math the engine's run() uses)
    var base = roundBase(SEED, ROUNDIDX);
    var sc = form === "glory" ? (gloryRoll(SEED, ROUNDIDX) < 0.42 ? 0 : Math.round(base * 1.9)) : base;
    LASTR = { r: ROUNDIDX, base: base, form: form, sc: sc, bust: form === "glory" && sc === 0 };
    TOTAL += sc; ROUNDIDX++;
    if (ROUNDIDX >= ROUNDS) finishRun();
    else { VIEW = "result"; draw(); }
  }

  function finishRun() {
    var res = run(SEED, CHOICES);           // authoritative recompute (== accumulated TOTAL)
    TOTAL = res.total;
    saveLock(SEED, { total: TOTAL, choices: CHOICES.slice(), submitted: false, ts: Date.now() });
    VIEW = "done"; SUBMIT = "submitting"; draw();
    // submit to the daily board (server verifies via the same engine)
    if (window.__lb && window.__lb.submitDaily) {
      Promise.resolve(window.__lb.submitDaily({ daySeed: SEED, choices: CHOICES.slice(), score: TOTAL }))
        .then(function (r) { SUBMIT = (r && r.ok) ? "submitted" : "offline"; var l = loadLock(SEED); if (l) { l.submitted = !!(r && r.ok); saveLock(SEED, l); } if (VIEW === "done") draw(); })
        .catch(function () { SUBMIT = "offline"; if (VIEW === "done") draw(); });
    } else { SUBMIT = "offline"; }
  }

  // ---- rendering ----
  function dots() {
    var out = "";
    for (var i = 0; i < ROUNDS; i++) {
      var cls = "dc-dot";
      if (i < ROUNDIDX) { var b = roundBase(SEED, i); var s = CHOICES[i] === "glory" ? (gloryRoll(SEED, i) < 0.42 ? 0 : Math.round(b * 1.9)) : b; cls += s === 0 ? " bust" : " good"; }
      else if (i === ROUNDIDX) cls += " on";
      out += '<div class="' + cls + '">' + (i + 1) + '</div>';
    }
    return '<div class="dc-round">' + out + '</div>';
  }

  function drawIntro() {
    var seed = todaySeed(), lock = loadLock(seed);
    var done = !!lock;
    $("screen").innerHTML =
      '<div class="eyebrow">Score Attack</div>' +
      '<div class="h1">🗓️ Daily Challenge</div>' +
      '<div class="card" style="border-color:var(--gold)">' +
        '<div class="l" style="font-size:10px;color:var(--chalk-dim);letter-spacing:2px;margin-bottom:8px">' + dateLabel(seed) + ' · SAME SEED FOR EVERYONE</div>' +
        (done
          ? '<div class="statline"><div class="statbox"><div class="n" style="color:var(--gold)">' + fmt(lock.total) + '</div><div class="l">Your score</div></div>' +
            '<div class="statbox"><div class="n">' + utcResetIn() + '</div><div class="l">Resets in</div></div>' +
            '<div class="statbox"><div class="n">' + (lock.submitted ? "✓" : "—") + '</div><div class="l">On board</div></div></div>' +
            '<div class="hs-tag" style="margin-top:10px">You’ve played today’s challenge. Come back after the reset for a new seed.</div>'
          : '<div class="hs-tag">Five rounds, one attempt. Everyone plays the same seed today, so it’s pure strategy: take <b style="color:#7fd6ff">🛡️ Steady</b> points or gamble on <b style="color:#ffb04f">🔥 Glory</b> (nearly double, or bust). Your total goes on the daily board.</div>') +
      '</div>';
    $("dock").innerHTML =
      (done
        ? '<button class="btn" style="background:linear-gradient(90deg,#f0bb45,#e0484f);color:#0b111b;font-weight:700" onclick="__daily.board()">🏆 Daily board</button>'
        : '<button class="btn" style="background:linear-gradient(90deg,#f0bb45,#e0484f);color:#0b111b;font-weight:700" onclick="__daily.start()">▶ Play today’s challenge</button>') +
      '<div style="height:8px"></div>' +
      '<button class="btn ghost" onclick="go(\'highscore\')">← Score Attack</button>';
  }

  function drawRound() {
    var r = ROUNDIDX, b = roundBase(SEED, r);
    $("screen").innerHTML =
      '<div class="eyebrow">Daily · ' + dateLabel(SEED) + '</div>' +
      '<div class="h1">Round ' + (r + 1) + ' of ' + ROUNDS + '</div>' +
      dots() +
      '<div class="card" style="border-color:var(--gold)"><div class="statline">' +
        '<div class="statbox"><div class="n" style="color:var(--gold)">' + fmt(TOTAL) + '</div><div class="l">Banked</div></div>' +
        '<div class="statbox"><div class="n" style="color:#7fd6ff">' + b + '</div><div class="l">Steady pays</div></div>' +
        '<div class="statbox"><div class="n" style="color:#ffb04f">' + Math.round(b * 1.9) + '</div><div class="l">Glory (or 0)</div></div>' +
      '</div></div>';
    $("dock").innerHTML =
      '<button class="btn" style="background:linear-gradient(90deg,#3a6ea5,#7fd6ff);color:#06121f;font-weight:700" onclick="__daily.play(\'steady\')">🛡️ Steady · +' + b + '</button>' +
      '<div style="height:8px"></div>' +
      '<button class="btn" style="background:linear-gradient(90deg,#e0484f,#ffb04f);color:#1f0b06;font-weight:700" onclick="__daily.play(\'glory\')">🔥 Go for glory · ' + Math.round(b * 1.9) + ' or bust</button>';
  }

  function drawResult() {
    var L = LASTR;
    $("screen").innerHTML =
      '<div class="eyebrow">Daily · Round ' + (L.r + 1) + '</div>' +
      '<div class="h1" style="color:' + (L.bust ? "#e08a8a" : "var(--good)") + '">' + (L.bust ? "Busted — +0" : "+" + fmt(L.sc)) + '</div>' +
      dots() +
      '<div class="card"><div class="statline">' +
        '<div class="statbox"><div class="n">' + (L.form === "glory" ? "🔥" : "🛡️") + '</div><div class="l">' + L.form + '</div></div>' +
        '<div class="statbox"><div class="n">' + fmt(L.sc) + '</div><div class="l">This round</div></div>' +
        '<div class="statbox"><div class="n" style="color:var(--gold)">' + fmt(TOTAL) + '</div><div class="l">Total</div></div>' +
      '</div></div>';
    $("dock").innerHTML =
      '<button class="btn" style="background:linear-gradient(90deg,#f0bb45,#e0484f);color:#0b111b;font-weight:700" onclick="__daily.next()">▶ Round ' + (ROUNDIDX + 1) + ' →</button>';
  }

  function drawDone() {
    var status = SUBMIT === "submitted" ? '<span style="color:var(--good)">✓ On the daily board</span>'
      : SUBMIT === "submitting" ? "Submitting…"
      : '<span style="color:var(--chalk-dim)">Saved locally (offline board)</span>';
    $("screen").innerHTML =
      '<div class="eyebrow">Daily · ' + dateLabel(SEED) + '</div>' +
      '<div class="h1">Final: ' + fmt(TOTAL) + '</div>' +
      dots() +
      '<div class="card mt" style="margin-top:12px;border-color:var(--gold)">' +
        '<div class="statline">' +
          '<div class="statbox"><div class="n" style="color:var(--gold)">' + fmt(TOTAL) + '</div><div class="l">Your score</div></div>' +
          '<div class="statbox"><div class="n">' + utcResetIn() + '</div><div class="l">Next in</div></div>' +
          '<div class="statbox"><div class="n">' + ROUNDS + '</div><div class="l">Rounds</div></div>' +
        '</div>' +
        '<div class="hs-tag" style="margin-top:10px">' + status + '</div>' +
      '</div>';
    $("dock").innerHTML =
      '<button class="btn" style="background:linear-gradient(90deg,#f0bb45,#e0484f);color:#0b111b;font-weight:700" onclick="__daily.board()">🏆 Daily board</button>' +
      '<div style="height:8px"></div>' +
      '<button class="btn ghost" onclick="go(\'menu\')">← Menu</button>';
  }

  function draw() {
    if (!$("screen") || !$("dock")) return;
    if (VIEW === "round") return drawRound();
    if (VIEW === "result") return drawResult();
    if (VIEW === "done") return drawDone();
    drawIntro();
  }

  window.__daily = {
    start: function () { if (!loadLock(todaySeed())) startRun(); else draw(); },
    play: function (f) { playRound(f); },
    next: function () { VIEW = "round"; draw(); },
    board: function () { if (window.__lbUI) window.__lbUI.openDaily = true; if (window.go) window.go("leaderboard"); }
  };

  window.__dailyRender = function (state) {
    STATE = state || window.S || null;
    // resume a completed run's summary, else the intro; never mid-run on re-entry
    if (VIEW !== "round" && VIEW !== "result") VIEW = "intro";
    draw();
  };
})();
