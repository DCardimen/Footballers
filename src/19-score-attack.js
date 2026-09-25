
/* ===== v46 SCORE ATTACK — single-player High-Score mode =====================
   A self-contained arcade loop layered on top of the shipped game engine.
   Touches NO career state — it uses only the stable exported globals:
     window.__simGameV2(perf,pos) -> resolves one headless game {stat,usScore,themScore}
     window.GridironStorage.save(o) -> persists the best score onto the save object
     window.go(view)              -> shell navigation (back to the menu)
   The shell router (q) calls window.__hsRender(o) when o.view==="highscore";
   `o` is passed in so this block always reads/writes the live save object.

   THE LOOP ("The Gauntlet"): pick a position, then play endless one-game rounds.
   Each round choose your form — 🛡️ Steady (safe) or 🔥 Go for glory (higher bar,
   1.7x points). Your box score becomes a game score (hsScore); beat the round's
   rising survival bar to advance, miss it and the run ends. Best total and best
   streak persist to the save (o.highScore / o.highStreak). Scoring weights are
   calibrated in scripts/hsprobe.mjs — keep hsScore() there identical to here.
============================================================================ */
(function () {
  "use strict";

  var POSITIONS = [
    { code: "QB", label: "Quarterback",     tag: "🎯 Passing" },
    { code: "RB", label: "Running Back",    tag: "💨 Rushing" },
    { code: "WR", label: "Wide Receiver",   tag: "🙌 Receiving" },
    { code: "TE", label: "Tight End",       tag: "🧱 Hybrid" },
    { code: "LB", label: "Linebacker",      tag: "🛡️ Tackles" },
    { code: "CB", label: "Cornerback",      tag: "🔒 Coverage" },
    { code: "S",  label: "Safety",          tag: "🦅 Range" },
    { code: "DL", label: "Defensive Line",  tag: "💥 Pass rush" }
  ];

  // Difficulty ramp: points needed to survive round r (1-indexed). Calibrated so
  // round 1 clears ~90% of games and ~round 10 needs a top-decile performance.
  function threshold(r) { return 20 + (r - 1) * 22; }

  // ---- SHIP SCORING FORMULA (must match scripts/hsprobe.mjs) ----
  function hsScore(stat, us, them, pos) {
    var s = stat || {};
    var DEF = /^(LB|MLB|OLB|CB|S|SS|FS|DL|DE|DT|EDGE|NT|DB)$/.test(pos);
    var yards = (s.pass || 0) + (s.rush || 0) + (s.rec || 0);
    var pts = 0;
    pts += yards * 0.5;
    pts += (s.td || 0) * 70;
    pts += (s.comp || 0) * 1.5;
    pts += (s.rec_c || 0) * 4;
    pts += (s.carries || 0) * 1.2;
    pts += (s.tackle || 0) * 9;
    pts += (s.tfl || 0) * 16;
    pts += (s.qbhit || 0) * 9;
    pts += (s.sack || 0) * 32;
    pts += (s.pd || 0) * 16;
    pts += (s.ff || 0) * 28;
    pts += (s.pick6 || 0) * 110;
    pts += (s.pancake || 0) * 6;
    pts += (s.int || 0) * (DEF ? 65 : -55);   // INT = takeaway (D) vs thrown (O)
    pts += (s.fum || 0) * -25;
    pts += (s.sackAllowed || 0) * -6;
    if ((s.longest || 0) >= 60) pts += 60; else if ((s.longest || 0) >= 40) pts += 25;
    var margin = (us || 0) - (them || 0);
    if (margin > 0) pts += 40 + Math.min(60, margin * 3);
    else if (margin < 0) pts += Math.max(-30, margin * 1.5);
    return Math.max(0, Math.round(pts));
  }

  // Turn a box score into short highlight strings for the result card.
  function highlights(s) {
    var h = [];
    if (s.pass) h.push(s.pass + " pass yds");
    if (s.comp) h.push(s.comp + "/" + (s.att || 0) + " cmp");
    if (s.rush) h.push(s.rush + " rush yds");
    if (s.carries && !s.pass) h.push(s.carries + " carries");
    if (s.rec) h.push(s.rec + " rec yds");
    if (s.rec_c) h.push(s.rec_c + " catches");
    if (s.td) h.push(s.td + " TD");
    if (s.tackle) h.push(s.tackle + " tkl");
    if (s.tfl) h.push(s.tfl + " TFL");
    if (s.sack) h.push(s.sack + " sack");
    if (s.qbhit) h.push(s.qbhit + " QB hit");
    if (s.pd) h.push(s.pd + " PD");
    if (s.int) h.push(s.int + " INT");
    if (s.ff) h.push(s.ff + " FF");
    if (s.pick6) h.push(s.pick6 + " pick-6");
    if (s.fum) h.push(s.fum + " fumble");
    if (!h.length) h.push("quiet day");
    return h;
  }

  // ---- transient run state (module-local; only the best score is persisted) ----
  var STATE = null;     // the live save object `o`, cached each render
  var VIEW = "intro";   // intro | round | result | over
  var POS = "RB";       // chosen position code
  var RUN = null;       // { round, total, over, last, newBest, newStreak }

  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return (n | 0).toLocaleString(); };
  function posLabel(code) { for (var i = 0; i < POSITIONS.length; i++) if (POSITIONS[i].code === code) return POSITIONS[i].label; return code; }

  function persistBest() {
    if (!STATE || !RUN) return;
    var best = STATE.highScore || 0, bestStreak = STATE.highStreak || 0, survived = RUN.round - 1;
    RUN.newBest = RUN.total > best;
    RUN.newStreak = survived > bestStreak;
    if (RUN.newBest) STATE.highScore = RUN.total;
    if (RUN.newStreak) STATE.highStreak = survived;
    try { if (window.GridironStorage) window.GridironStorage.save(STATE); } catch (e) {}
    // v47: submit this run to the leaderboards (no-op until a backend is wired)
    try {
      if (window.__lb && RUN.total > 0 && !RUN.submitted) {
        RUN.submitted = true;
        RUN.submitPromise = window.__lb.submit({ score: RUN.total, pos: POS, streak: survived });
      }
    } catch (e) {}
  }

  // ---- one round: resolve a game, score it, decide survival ----
  function playRound(mode) {
    var r = RUN.round;
    var bar = Math.round(threshold(r) * (mode === "glory" ? 1.5 : 1));
    var perf = mode === "glory"
      ? 66 + Math.floor(Math.random() * 24)   // 66-90: higher ceiling
      : 58 + Math.floor(Math.random() * 12);  // 58-70: consistent
    var g;
    try { g = window.__simGameV2(perf, POS); }
    catch (e) { g = { stat: {}, usScore: 0, themScore: 0 }; }
    var raw = hsScore(g.stat, g.usScore, g.themScore, POS);
    var survived = raw >= bar;
    var banked = survived ? Math.round(raw * (mode === "glory" ? 1.7 : 1)) : 0;
    RUN.last = { mode: mode, raw: raw, bar: bar, banked: banked, survived: survived,
                 us: g.usScore || 0, them: g.themScore || 0, hl: highlights(g.stat || {}) };
    if (survived) { RUN.total += banked; RUN.round++; VIEW = "result"; }
    else { RUN.over = true; persistBest(); VIEW = "over"; }
    draw();
  }

  // ---- rendering ----
  function drawIntro() {
    var best = (STATE && STATE.highScore) || 0, streak = (STATE && STATE.highStreak) || 0;
    var chips = POSITIONS.map(function (p) {
      return '<button class="hs-chip' + (p.code === POS ? ' on' : '') + '" onclick="__hs.pick(\'' + p.code + '\')">' +
             '<b>' + p.code + '</b><span>' + p.tag + '</span></button>';
    }).join("");
    $("screen").innerHTML =
      '<div class="eyebrow">Arcade</div>' +
      '<div class="h1">⚡ Score Attack</div>' +
      '<div class="card" style="border-color:var(--gold)">' +
        '<div class="statline">' +
          '<div class="statbox"><div class="n" style="color:var(--gold)">' + fmt(best) + '</div><div class="l">Best Score</div></div>' +
          '<div class="statbox"><div class="n">' + streak + '</div><div class="l">Best Streak</div></div>' +
          '<div class="statbox"><div class="n">' + POS + '</div><div class="l">Position</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="card mt" style="margin-top:12px">' +
        '<div class="l" style="font-size:10px;color:var(--chalk-dim);letter-spacing:2px;margin-bottom:10px">PICK YOUR POSITION</div>' +
        '<div class="hs-chips">' + chips + '</div>' +
      '</div>' +
      '<div class="card mt" style="margin-top:12px">' +
        '<div class="l" style="font-size:10px;color:var(--chalk-dim);letter-spacing:2px;margin-bottom:8px">HOW IT WORKS</div>' +
        '<div class="hs-tag">Play endless one-game rounds. Each round, beat a rising score bar to survive. Choose <b style="color:#7fd6ff">🛡️ Steady</b> for a safe game, or <b style="color:#ffb04f">🔥 Go for glory</b> — a much higher bar, but 70% more points. Bank as much as you can before a bad game ends your run.</div>' +
      '</div>';
    $("dock").innerHTML =
      '<button class="btn" style="background:linear-gradient(90deg,#f0bb45,#e0484f);color:#0b111b;font-weight:700" onclick="__hs.start()">▶ START RUN — ' + posLabel(POS) + '</button>' +
      '<div style="height:8px"></div>' +
      '<div class="btn-row">' +
      '<button class="btn secondary" onclick="go(\'daily\')">🗓️ Daily Challenge</button>' +
      '<button class="btn ghost" onclick="__hs.quit()">← Menu</button>' +
      '</div>';
  }

  function drawRound() {
    var r = RUN.round;
    $("screen").innerHTML =
      '<div class="eyebrow">' + posLabel(POS) + ' · Run in progress</div>' +
      '<div class="h1">Round ' + r + '</div>' +
      '<div class="card" style="border-color:var(--gold)">' +
        '<div class="statline">' +
          '<div class="statbox"><div class="n" style="color:var(--gold)">' + fmt(RUN.total) + '</div><div class="l">Banked</div></div>' +
          '<div class="statbox"><div class="n">' + (r - 1) + '</div><div class="l">Streak</div></div>' +
          '<div class="statbox"><div class="n" style="color:#7fd6ff">' + threshold(r) + '</div><div class="l">Bar to beat</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="card mt" style="margin-top:12px"><div class="hs-tag">Choose your form for this game. The tougher bar pays far more — but miss it and the run is over.</div></div>';
    $("dock").innerHTML =
      '<button class="btn" style="background:linear-gradient(90deg,#3a6ea5,#7fd6ff);color:#06121f;font-weight:700" onclick="__hs.play(\'steady\')">🛡️ Steady · bar ' + threshold(r) + '</button>' +
      '<div style="height:8px"></div>' +
      '<button class="btn" style="background:linear-gradient(90deg,#e0484f,#ffb04f);color:#1f0b06;font-weight:700" onclick="__hs.play(\'glory\')">🔥 Go for glory · bar ' + Math.round(threshold(r) * 1.5) + ' · 1.7&times;</button>' +
      '<div style="height:8px"></div>' +
      '<button class="btn ghost" onclick="__hs.cashOut()">Cash out &amp; end run</button>';
  }

  function drawResult() {
    var L = RUN.last;
    var hlHtml = L.hl.map(function (t) { return '<span class="hs-pill">' + t + '</span>'; }).join("");
    $("screen").innerHTML =
      '<div class="eyebrow">' + posLabel(POS) + ' · ' + (L.mode === "glory" ? "🔥 Glory" : "🛡️ Steady") + '</div>' +
      '<div class="h1" style="color:var(--good)">Survived! +' + fmt(L.banked) + '</div>' +
      '<div class="card" style="border-color:var(--good)">' +
        '<div class="statline">' +
          '<div class="statbox"><div class="n">' + L.us + '–' + L.them + '</div><div class="l">Final</div></div>' +
          '<div class="statbox"><div class="n">' + fmt(L.raw) + '</div><div class="l">Game score</div></div>' +
          '<div class="statbox"><div class="n" style="color:var(--gold)">' + fmt(RUN.total) + '</div><div class="l">Total</div></div>' +
        '</div>' +
        '<div class="hs-pills">' + hlHtml + '</div>' +
      '</div>';
    $("dock").innerHTML =
      '<button class="btn" style="background:linear-gradient(90deg,#f0bb45,#e0484f);color:#0b111b;font-weight:700" onclick="__hs.next()">▶ Next round →</button>' +
      '<div style="height:8px"></div>' +
      '<button class="btn ghost" onclick="__hs.cashOut()">Cash out &amp; end run</button>';
  }

  function drawOver() {
    var L = RUN.last;
    var badge = RUN.newBest ? '<div class="hs-badge">🏆 NEW BEST SCORE</div>'
              : (RUN.newStreak ? '<div class="hs-badge">🔥 NEW BEST STREAK</div>' : '');
    var reason = (L && !L.survived) ? 'You needed ' + fmt(L.bar) + ' but posted ' + fmt(L.raw) + '.' : 'You cashed out with the run intact.';
    $("screen").innerHTML =
      '<div class="eyebrow">' + posLabel(POS) + ' · Run over</div>' +
      '<div class="h1">Final: ' + fmt(RUN.total) + '</div>' +
      badge +
      '<div class="card mt" style="margin-top:12px;border-color:var(--gold)">' +
        '<div class="statline">' +
          '<div class="statbox"><div class="n" style="color:var(--gold)">' + fmt(RUN.total) + '</div><div class="l">This run</div></div>' +
          '<div class="statbox"><div class="n">' + (RUN.round - 1) + '</div><div class="l">Rounds</div></div>' +
          '<div class="statbox"><div class="n">' + fmt((STATE && STATE.highScore) || 0) + '</div><div class="l">Best ever</div></div>' +
        '</div>' +
        '<div class="hs-tag" style="margin-top:10px">' + reason + '</div>' +
      '</div>';
    $("dock").innerHTML =
      '<button class="btn" style="background:linear-gradient(90deg,#f0bb45,#e0484f);color:#0b111b;font-weight:700" onclick="__hs.again()">↻ Play again</button>' +
      '<div style="height:8px"></div>' +
      '<div class="btn-row">' +
      '<button class="btn secondary" onclick="__hs.board()">🏆 Leaderboard</button>' +
      '<button class="btn ghost" onclick="__hs.quit()">← Menu</button>' +
      '</div>';
  }

  function draw() {
    if (!$("screen") || !$("dock")) return;
    if (VIEW === "round") return drawRound();
    if (VIEW === "result") return drawResult();
    if (VIEW === "over") return drawOver();
    drawIntro();
  }

  // ---- public handlers (called from inline onclick) ----
  window.__hs = {
    pick:    function (code) { POS = code; if (VIEW === "intro") draw(); },
    start:   function () { RUN = { round: 1, total: 0, over: false }; VIEW = "round"; draw(); },
    play:    function (mode) { if (RUN && !RUN.over) playRound(mode); },
    next:    function () { VIEW = "round"; draw(); },
    cashOut: function () { if (RUN && !RUN.over) { RUN.over = true; persistBest(); } VIEW = "over"; draw(); },
    again:   function () { RUN = { round: 1, total: 0, over: false }; VIEW = "round"; draw(); },
    board:   function () { if (window.go) window.go("leaderboard"); },
    quit:    function () { if (window.go) window.go("menu"); }
  };

  // ---- router entry: shell calls this when o.view === "highscore" ----
  window.__hsRender = function (state) {
    STATE = state || window.S || null;
    if (!RUN || RUN.over) VIEW = "intro";   // fresh entry from the menu
    draw();
  };
})();
