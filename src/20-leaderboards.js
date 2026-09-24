
/* ===== v47 LEADERBOARDS — online high-score boards for Score Attack ==========
   Client-side leaderboard layer behind a PLUGGABLE BACKEND, so the whole UI and
   submit flow are testable offline today and flip to a real server by config:

     window.__LB_CONFIG = { url, anonKey, getAuthToken? }   // -> Supabase backend
     (absent)                                               // -> local mock backend

   Identity is also pluggable (this is the seam for Game Center / Play Games via a
   Capacitor plugin):
     window.__LB_IDENTITY = async () => ({ id, name })      // platform sign-in
     (absent)                                               // -> local device id + handle

   Boards: 'global' (all-time), 'weekly' (rolling 7-day), 'position' (per pos).
   Anti-cheat for v1 is server-side (see supabase/schema.sql submit_score()): the
   client is never trusted to be honest; the mock backend is for local testing only.

   Wired to Score Attack via persistBest() -> window.__lb.submit(). The shell router
   calls window.__lbRender(o) when o.view === "leaderboard". Setup runbook:
   docs/LEADERBOARDS.md.
============================================================================ */
(function () {
  "use strict";

  var POS_LIST = ["QB", "RB", "WR", "TE", "LB", "CB", "S", "DL"];
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return (n | 0).toLocaleString(); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); };

  // ---- rolling-week key (year + ISO-ish week number) ----
  function weekKey(ts) {
    var d = new Date(ts || Date.now());
    var onejan = new Date(d.getFullYear(), 0, 1);
    var week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return d.getFullYear() + "-W" + (week < 10 ? "0" + week : week);
  }
  function weekAgoISO() { return new Date(Date.now() - 7 * 86400000).toISOString(); }

  // ---- identity: device id + handle (or platform sign-in via window.__LB_IDENTITY) ----
  function deviceId() {
    var k = "rib_lb_device";
    try { var v = localStorage.getItem(k); if (!v) { v = "d_" + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(k, v); } return v; }
    catch (e) { return "d_anon"; }
  }
  function localName() { try { return localStorage.getItem("rib_lb_handle") || ""; } catch (e) { return ""; } }
  function setLocalName(n) { try { localStorage.setItem("rib_lb_handle", n); } catch (e) {} }
  var IDENT = null;
  async function identity() {
    if (IDENT) return IDENT;
    if (typeof window.__LB_IDENTITY === "function") { try { IDENT = await window.__LB_IDENTITY(); return IDENT; } catch (e) {} }
    var name = localName();
    if (!name) { name = "Player" + String(Math.floor(1000 + Math.random() * 9000)); setLocalName(name); }
    IDENT = { id: deviceId(), name: name };
    return IDENT;
  }

  // ---- MOCK backend: localStorage; for offline testing only ----
  var Mock = {
    _key: "rib_lb_entries",
    _load: function () { try { return JSON.parse(localStorage.getItem(this._key) || "[]"); } catch (e) { return []; } },
    _save: function (a) { try { localStorage.setItem(this._key, JSON.stringify(a.slice(-500))); } catch (e) {} },
    _seedOnce: function () {
      if (this._seeded) return; this._seeded = true;
      var a = this._load();
      if (a.length) return;
      var names = ["Ace", "Blitz", "Cortez", "Dukes", "Echo", "Flash", "Gunner", "Hawk", "Iceman", "Juke", "King", "Laces", "Mamba", "Nitro", "Ozzy", "Prime", "Quill", "Rocket", "Slate", "Torch"];
      for (var i = 0; i < 24; i++) {
        var pos = POS_LIST[i % POS_LIST.length];
        var score = Math.floor(400 + Math.random() * 5200);
        var ts = Date.now() - Math.floor(Math.random() * 20) * 86400000; // spread over ~20 days
        a.push({ id: "seed_" + i, name: names[i % names.length] + (i > 19 ? i : ""), score: score, pos: pos, streak: 1 + (score / 220 | 0), ts: ts, week: weekKey(ts) });
      }
      this._save(a);
    },
    submit: async function (entry, id) {
      this._seedOnce();
      var a = this._load();
      var ts = Date.now();
      a.push({ id: id, name: entry.name, score: entry.score | 0, pos: entry.pos, streak: entry.streak | 0, ts: ts, week: weekKey(ts) });
      this._save(a);
      return { ok: true };
    },
    top: async function (opts) {
      this._seedOnce();
      if (opts.board === "daily") return this._topDaily(opts);
      var a = this._load();
      if (opts.board === "weekly") { var wk = weekKey(Date.now()); a = a.filter(function (e) { return e.week === wk; }); }
      if (opts.board === "position") a = a.filter(function (e) { return e.pos === opts.pos; });
      a.sort(function (x, y) { return y.score - x.score; });
      return a.slice(0, opts.limit || 100);
    },
    // ---- daily challenge board (verifies the score locally via DailyEngine) ----
    _dkey: "rib_lb_daily",
    _loadD: function () { try { return JSON.parse(localStorage.getItem(this._dkey) || "[]"); } catch (e) { return []; } },
    _saveD: function (a) { try { localStorage.setItem(this._dkey, JSON.stringify(a.slice(-500))); } catch (e) {} },
    _seedDailyOnce: function (daySeed) {
      var a = this._loadD();
      if (a.some(function (e) { return e.daySeed === daySeed && /^seed_/.test(e.id); })) return;
      var names = ["Ace", "Blitz", "Cortez", "Echo", "Flash", "Gunner", "Hawk", "Juke", "Mamba", "Nitro", "Prime", "Rocket"];
      for (var i = 0; i < 12; i++) {
        // build a random valid choice-set and score it with the real engine (never fabricated)
        var choices = []; for (var r = 0; r < (window.DailyEngine ? window.DailyEngine.ROUNDS : 5); r++) choices.push(Math.random() < 0.5 ? "glory" : "steady");
        var total = window.DailyEngine ? window.DailyEngine.run(daySeed, choices).total : Math.floor(300 + Math.random() * 500);
        a.push({ id: "seed_" + daySeed + "_" + i, name: names[i], score: total, daySeed: daySeed, ts: Date.now() });
      }
      this._saveD(a);
    },
    submitDaily: async function (entry, id) {
      var daySeed = entry.daySeed;
      // trust-but-verify: only accept a score the deterministic engine reproduces
      if (window.DailyEngine) { var v = window.DailyEngine.verify(daySeed, entry.choices, entry.score | 0); if (!v.ok) return { ok: false, error: "score mismatch" }; }
      var a = this._loadD();
      a = a.filter(function (e) { return !(e.daySeed === daySeed && e.id === id); }); // one per day per player
      a.push({ id: id, name: entry.name, score: entry.score | 0, daySeed: daySeed, ts: Date.now() });
      this._saveD(a);
      return { ok: true };
    },
    _topDaily: function (opts) {
      var daySeed = opts.daySeed || (window.DailyEngine ? window.DailyEngine.dayKey() : 0);
      this._seedDailyOnce(daySeed);
      var a = this._loadD().filter(function (e) { return e.daySeed === daySeed; });
      a.sort(function (x, y) { return y.score - x.score; });
      return a.slice(0, opts.limit || 100);
    }
  };

  // ---- SUPABASE backend: real server; enabled when window.__LB_CONFIG is set ----
  function Supa(cfg) {
    async function headers() {
      var h = { "apikey": cfg.anonKey, "Content-Type": "application/json" };
      var tok = cfg.anonKey;
      if (typeof cfg.getAuthToken === "function") { try { var t = await cfg.getAuthToken(); if (t) tok = t; } catch (e) {} }
      h["Authorization"] = "Bearer " + tok;
      return h;
    }
    return {
      submit: async function (entry) {
        // server validates + stamps identity (see supabase/schema.sql submit_score)
        var res = await fetch(cfg.url + "/rest/v1/rpc/submit_score", {
          method: "POST", headers: await headers(),
          body: JSON.stringify({ p_name: entry.name, p_score: entry.score | 0, p_pos: entry.pos, p_streak: entry.streak | 0 })
        });
        return { ok: res.ok, status: res.status };
      },
      top: async function (opts) {
        if (opts.board === "daily") {
          var ds = opts.daySeed || (window.DailyEngine ? window.DailyEngine.dayKey() : 0);
          var dr = await fetch(cfg.url + "/rest/v1/daily_leaderboard?select=name,score,day_seed&day_seed=eq." + ds + "&order=score.desc&limit=" + (opts.limit || 100), { headers: await headers() });
          if (!dr.ok) throw new Error("lb daily " + dr.status);
          return await dr.json();
        }
        var q = "?select=name,score,pos,streak,created_at&order=score.desc&limit=" + (opts.limit || 100);
        if (opts.board === "weekly") q += "&created_at=gte." + encodeURIComponent(weekAgoISO());
        if (opts.board === "position") q += "&pos=eq." + encodeURIComponent(opts.pos);
        var res = await fetch(cfg.url + "/rest/v1/leaderboard" + q, { headers: await headers() });
        if (!res.ok) throw new Error("lb top " + res.status);
        return await res.json();
      },
      // daily submits send ONLY (daySeed, choices, name) — the edge function re-runs
      // the deterministic engine, computes the score itself, and inserts if valid.
      submitDaily: async function (entry) {
        var res = await fetch(cfg.url + "/functions/v1/verify-daily", {
          method: "POST", headers: await headers(),
          body: JSON.stringify({ day_seed: entry.daySeed, choices: entry.choices, name: entry.name })
        });
        return { ok: res.ok, status: res.status };
      }
    };
  }

  var backend = (window.__LB_CONFIG && window.__LB_CONFIG.url) ? Supa(window.__LB_CONFIG) : Mock;
  var isMock = backend === Mock;

  // ---- public API (Score Attack submits through this) ----
  window.__lb = {
    isMock: isMock,
    submit: async function (entry) {
      var me = await identity();
      try { return await backend.submit({ name: me.name, score: entry.score, pos: entry.pos, streak: entry.streak }, me.id); }
      catch (e) { return { ok: false, error: String(e) }; }
    },
    submitDaily: async function (entry) {
      var me = await identity();
      try { return await backend.submitDaily({ name: me.name, daySeed: entry.daySeed, choices: entry.choices, score: entry.score }, me.id); }
      catch (e) { return { ok: false, error: String(e) }; }
    },
    top: function (opts) { return backend.top(opts || { board: "global" }); },
    identity: identity,
    setName: async function (n) { n = (n || "").trim().slice(0, 16); if (!n) return; setLocalName(n); IDENT = null; await identity(); }
  };

  // ---- leaderboard screen ----
  var STATE = null, LTAB = "global", LPOS = "RB", ROWS = null, LOADING = false, LERR = null;

  function medal(rank) { return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank; }

  async function load() {
    LOADING = true; LERR = null; draw();
    try { ROWS = await window.__lb.top({ board: LTAB, pos: LPOS, limit: 100, daySeed: (window.DailyEngine ? window.DailyEngine.dayKey() : undefined) }); }
    catch (e) { LERR = String(e); ROWS = []; }
    LOADING = false; draw();
  }

  function draw() {
    if (!$("screen") || !$("dock")) return;
    if (MODE === "career" && window.__lbCareerUI) return drawCareer();   // v151 C: the career boards
    var meName = localName();
    var tabs = [["global", "Global"], ["daily", "Daily"], ["weekly", "Weekly"], ["position", "By position"]]
      .map(function (t) { return '<div class="lb-tab' + (LTAB === t[0] ? " on" : "") + '" onclick="__lbUI.tab(\'' + t[0] + '\')">' + t[1] + '</div>'; }).join("");
    var posbar = LTAB === "position"
      ? '<div class="lb-posbar">' + POS_LIST.map(function (p) { return '<div class="lb-posbtn' + (LPOS === p ? " on" : "") + '" onclick="__lbUI.pos(\'' + p + '\')">' + p + '</div>'; }).join("") + '</div>'
      : "";
    var body;
    if (LOADING) body = '<div class="lb-empty">Loading…</div>';
    else if (LERR) body = '<div class="lb-empty">Couldn\'t load the board.<br><span style="font-size:12px">' + esc(LERR) + '</span></div>';
    else if (!ROWS || !ROWS.length) body = '<div class="lb-empty">No scores yet — be the first!<br><span style="font-size:12px">Play Score Attack to post a score.</span></div>';
    else body = ROWS.map(function (r, i) {
      var rank = i + 1, mine = meName && r.name === meName;
      return '<div class="lb-row' + (mine ? " me" : "") + '">' +
        '<div class="lb-rank' + (rank <= 3 ? " medal" : "") + '">' + medal(rank) + '</div>' +
        '<div class="lb-name">' + esc(r.name) + '</div>' +
        (r.pos ? '<div class="lb-pos">' + esc(r.pos) + '</div>' : '') +
        '<div class="lb-score">' + fmt(r.score) + '</div>' +
        '</div>';
    }).join("");
    var srcNote = window.__lb.isMock
      ? '<div class="lb-note">⚠ Local demo board (offline). Connect a backend to go online — see docs/LEADERBOARDS.md.</div>' : "";
    $("screen").innerHTML =
      '<div class="eyebrow">Score Attack</div>' +
      '<div class="h1">🏆 Leaderboard</div>' +
      (window.__lbCareerUI ? window.__lbCareerUI.modeBar("score") : "") +
      '<div class="lb-tabs">' + tabs + '</div>' + posbar +
      '<div class="card" style="padding:6px 12px">' + body + '</div>' +
      srcNote;
    $("dock").innerHTML =
      '<button class="btn" style="background:linear-gradient(90deg,#f0bb45,#e0484f);color:#0b111b;font-weight:700" onclick="go(\'highscore\')">⚡ Play Score Attack</button>' +
      '<div style="height:8px"></div>' +
      '<div class="btn-row">' +
      '<button class="btn secondary" onclick="__lbUI.rename()">✎ ' + (meName ? esc(meName) : "Set name") + '</button>' +
      '<button class="btn ghost" onclick="go(\'menu\')">← Menu</button>' +
      '</div>';
  }

  /* v151 C: the view has two modes — CAREERS (the career boards, src/20 v151 C block below) and SCORE ATTACK
     (this screen). go('leaderboard') keeps Score Attack; the main menu's doors set nextMode = "career". */
  var MODE = "score";
  function drawCareer() {
    window.__lbCareerUI.draw($("screen"));
    $("dock").innerHTML =
      '<button class="btn" onclick="seasonsOpenV151C(\'pass\')">🎟 Season Pass</button>' +
      '<div class="btn-row">' +
      '<button class="btn secondary" onclick="__lbUI.mode(\'score\')">⚡ Score Attack</button>' +
      '<button class="btn ghost" onclick="go(\'menu\')">← Menu</button>' +
      '</div>';
  }
  window.__lbUI = {
    openDaily: false,
    nextMode: null,
    mode: function (m) { MODE = m === "career" ? "career" : "score"; if (MODE === "career") draw(); else load(); },
    getMode: function () { return MODE; },
    tab: function (t) { MODE = "score"; LTAB = t; load(); },
    pos: function (p) { LPOS = p; load(); },
    rename: async function () {
      var cur = localName();
      var n = window.prompt("Leaderboard name (max 16 chars):", cur || "");
      if (n && n.trim()) { await window.__lb.setName(n); draw(); }
    }
  };

  // ---- router entry ----
  window.__lbRender = function (state) {
    STATE = state || window.S || null;
    if (window.__lbUI.nextMode) { MODE = window.__lbUI.nextMode === "career" ? "career" : "score"; window.__lbUI.nextMode = null; }
    if (window.__lbUI.openDaily) { LTAB = "daily"; MODE = "score"; window.__lbUI.openDaily = false; } // arrived from the daily mode
    if (MODE === "career") { draw(); return; }
    load();
  };
})();

/* ===== v151 C THE SEASON IS AN EVENT — the career boards =====
   The boards the owner asked for, ranked off whole CAREERS rather than Score Attack runs: All-Time Career
   Score, the Season board, the Weekly Challenge career, Best QB / RB / WR / TE / OL / DEF, Most Championships,
   Craziest Career, Fastest to the League, Best Career Without Prestige. Every row is one of YOUR careers
   (there is no server yet — the screen says LOCAL); a career is recorded once, when it ends (the 07 hook
   `seasonsCareerEndV151C` queues it, src/29-seasons.js flushes the queue here), and the career still being
   played is shown as a live "NOW PLAYING" line with the rank it would take.

   CAREER SCORE (transparent, documented in docs/SEASONS.md; built on the Hall of Fame snapshot hofSnapV134):
     LEVEL_PTS[level reached] (Pee Wee 0 … UFF 600, Interstellar 800) + 4·peak OVR + 60·titles + 150·UFF rings
     + 8·playoff wins + 2·wins + 15·awards + 40·MVPs + 5·seasons + 200 if he made the UFF.
   CRAZIEST CAREER: 12·level + 15·traits + 20·(generation−1) + 8·award kinds + ½·(best−worst season grade avg)
     + 30 cut after winning a title + 25 still playing at 35 + 40 in the UFF by 21 + 20 for 20+ seasons.

   The storage is its own key (`rib.lb.careers.v1`), never the save. The backend is an adapter
   (`submit(entry)`, `fetch(board, opts)`): `local` today, `remote` designed (docs/SEASONS.md §5) and used only
   when `window.__LB_CONFIG.careerUrl` is set. Every name is escaped at render (the game's escHtml), and every
   stored/imported profile is sanitised on the way IN as well. `window.__lb.career`, `window.__lbCareerUI`. */
(function () {
  "use strict";
  var LB = window.__lb; if (!LB) return;
  var KEY = "rib.lb.careers.v1", MAX = 500;
  var LEVEL_PTS = [0, 40, 90, 150, 230, 330, 450, 600, 800];
  var DEF = { DL: 1, LB: 1, CB: 1, S: 1 };
  var esc = function (s) { var f = window.__escHtmlV151C; if (typeof f === "function") return f(s); return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); };
  var num = function (v) { v = +v; return isFinite(v) ? v : 0; };
  var fmt = function (n) { return Math.round(num(n)).toLocaleString(); };

  /* the calendar's week: ISO week in UTC (seasons are UTC too) */
  function isoWeek(ts) {
    var d = new Date(ts == null ? Date.now() : ts);
    var t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    var day = (new Date(t).getUTCDay() + 6) % 7;
    t += (3 - day) * 86400000;                                    // the Thursday of this week decides the year
    var y = new Date(t).getUTCFullYear();
    var w = 1 + Math.floor((t - Date.UTC(y, 0, 1)) / 604800000);
    return y + "-W" + (w < 10 ? "0" + w : w);
  }

  /* ---- sanitising: anything stored or imported is plain data, strings without markup ---- */
  function clean(v, depth) {
    depth = depth | 0;
    if (v == null) return null;
    if (typeof v === "number") return isFinite(v) ? v : 0;
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v.replace(/[<>\u0000-\u001f\u007f]/g, "").slice(0, 80);
    if (depth > 3) return null;
    if (Array.isArray(v)) return v.slice(0, 24).map(function (x) { return clean(x, depth + 1); });
    if (typeof v === "object") {
      var o = {}, n = 0;
      for (var k in v) {
        if (!Object.prototype.hasOwnProperty.call(v, k) || typeof v[k] === "function") continue;
        if (++n > 40) break;
        if (/^(__proto__|constructor|prototype)$/.test(k)) continue;
        o[String(k).slice(0, 40)] = clean(v[k], depth + 1);
      }
      return o;
    }
    return null;
  }
  function cleanColors(c) {   // a team palette: keep colour strings only
    var ok = function (s) { return typeof s === "string" && /^(#[0-9a-f]{3,8}|rgba?\([0-9.,\s%]+\)|hsla?\([0-9.,\s%deg]+\))$/i.test(s.trim()) ? s.trim() : null; };
    if (!c) return null;
    if (typeof c === "string") return ok(c) ? [ok(c)] : null;
    var out = [], vals = Array.isArray(c) ? c : Object.keys(c).map(function (k) { return c[k]; });
    vals.forEach(function (x) { var s = ok(x); if (s && out.length < 4) out.push(s); });
    return out.length ? out : null;
  }
  function levelName(l) { try { return window.__GRIDIRON_AUDIT__.LEVELS[l].name; } catch (e) { return "Level " + l; } }

  /* ---- the formulas ---- */
  function careerScore(x) {
    var lv = Math.max(0, Math.min(8, x.level | 0));
    return Math.round(LEVEL_PTS[lv] + 4 * num(x.peak) + 60 * num(x.titles) + 150 * num(x.rings) + 8 * num(x.playoffWins)
      + 2 * num(x.wins) + 15 * num(x.awards) + 40 * num(x.mvps) + 5 * num(x.seasons) + (x.won ? 200 : 0));
  }
  function scoreParts(x) {
    var lv = Math.max(0, Math.min(8, x.level | 0));
    return [["Level reached (" + levelName(lv) + ")", LEVEL_PTS[lv]], ["Peak OVR " + num(x.peak) + " × 4", 4 * num(x.peak)], ["Titles " + num(x.titles) + " × 60", 60 * num(x.titles)],
      ["UFF rings " + num(x.rings) + " × 150", 150 * num(x.rings)], ["Playoff wins " + num(x.playoffWins) + " × 8", 8 * num(x.playoffWins)], ["Wins " + num(x.wins) + " × 2", 2 * num(x.wins)],
      ["Awards " + num(x.awards) + " × 15", 15 * num(x.awards)], ["MVPs " + num(x.mvps) + " × 40", 40 * num(x.mvps)], ["Seasons " + num(x.seasons) + " × 5", 5 * num(x.seasons)], ["Made the UFF", x.won ? 200 : 0]];
  }
  function crazyScore(x) {
    return Math.round(12 * (x.level | 0) + 15 * num(x.traits) + 20 * Math.max(0, num(x.gen) - 1) + 8 * num(x.awardKinds) + num(x.avgSpread) / 2
      + (x.fate === "cut" && num(x.titles) > 0 ? 30 : 0) + (num(x.age) >= 35 ? 25 : 0) + (x.uffAge && x.uffAge <= 21 ? 40 : 0) + (num(x.seasons) >= 20 ? 20 : 0));
  }

  /* ---- an entry: from the 07 hand-off (a finished career) or from the career being played ---- */
  function fromHof(h, extra) {
    extra = extra || {};
    var b = (h && h.box) || {}, T = b.totals || {}, log = b.log || [];
    var mvps = 0, awardsN = 0;
    log.forEach(function (r) { (r.awards || []).forEach(function (a) { awardsN++; if (/MVP|Player of the Year/i.test(String(a))) mvps++; }); });
    var avgs = log.map(function (r) { return num(r.avg); }).filter(function (v) { return v > 0; });
    var uffRow = null;
    for (var i = 0; i < log.length; i++) if ((log[i].level | 0) >= 7) { uffRow = log[i]; break; }
    var level = Math.max(num(extra.level), num(h.reached));
    var reachedUff = !!h.won || level >= 7;
    var toUff = reachedUff ? (uffRow ? log.filter(function (r) { return (r.level | 0) < 7; }).length : num(h.seasons)) : null;
    var x = {
      name: String(h.name || "Unknown"), pos: String(h.pos || ""), level: level, levelName: levelName(level), won: !!h.won,
      fate: extra.fate || (h.won ? "won" : "cut"),
      seasons: num(h.seasons), peak: num(h.peak), titles: num(h.titles), rings: num(h.rings),
      wins: num(T.wins), games: num(T.games), playoffWins: num(T.playoffWins), awards: T.awards != null ? num(T.awards) : awardsN, mvps: mvps,
      awardKinds: (b.awards || []).length, gen: Math.max(1, num(h.gen)), traits: num(extra.traits), origin: String(extra.origin || (b.origin && b.origin.name) || ""),
      age: num(extra.age || b.age), avgSpread: avgs.length > 1 ? Math.max.apply(null, avgs) - Math.min.apply(null, avgs) : 0,
      uffAge: uffRow ? num(uffRow.age) : null, toUff: toUff, nodes: num(extra.nodes), surname: String(extra.surname || ""),
      team: extra.team ? { school: String(extra.team.school || ""), name: String(extra.team.name || ""), colors: cleanColors(extra.team.colors), logo: extra.team.logo != null && isFinite(+extra.team.logo) ? +extra.team.logo | 0 : null } : null
    };
    x.score = careerScore(x); x.crazy = crazyScore(x);
    return x;
  }
  function profileFor(x) {
    var p = {};
    try {
      var C = window.RIB_COSMETICS;
      if (C && typeof C.profile === "function") p = Object.assign({}, C.profile() || {});
      if (C && typeof C.equipped === "function" && p.equipped == null) p.equipped = C.equipped();   // the frame, banner, title he wore
    } catch (e) { p = {}; }
    return clean(Object.assign({}, p, { name: x.name, pos: x.pos, level: x.level, levelName: x.levelName, score: x.score, team: x.team,
      honours: { titles: x.titles, rings: x.rings, mvps: x.mvps, awards: x.awards, madeUff: x.won } }));
  }
  function buildEntry(q) {
    var x = fromHof(q.hof || {}, q);
    var at = num(q.at) || Date.now();
    var S = window.RIB_SEASONS, sid = S && S.seasonAt ? S.seasonAt(at).id : "s0";
    x.id = "c" + (q.careerNo | 0) + "_" + (String(x.name).replace(/[^a-z0-9]/gi, "").slice(0, 12) || "x") + "_" + x.seasons + "_" + (at % 1e7);
    x.at = at; x.seasonId = sid; x.week = isoWeek(at); x.careerNo = q.careerNo | 0;
    x.profile = profileFor(x);
    return clean(x);
  }
  function liveEntry() {
    try {
      var A = window.__GRIDIRON_AUDIT__, st = A && A.getState(), pl = st && st.player;
      if (!pl || pl._settled || !window.__HOF_V134) return null;
      var tree = st.tree || {}, nodes = 0;
      for (var k in tree) nodes += tree[k] | 0;
      var team = null;
      try { var d = window.__RIB_MENU_DATA_V89 && window.__RIB_MENU_DATA_V89(); team = d && d.team; } catch (e) {}
      var fam = null;
      try { fam = window.__LINEAGE_V136.family(); } catch (e) {}
      var h = { name: pl.name, pos: pl.pos, peak: pl.peakOvr || 0, titles: pl.titles || 0, rings: pl.nflRings || 0, reached: pl.level | 0, seasons: pl.totalSeasons | 0, won: false,
        box: window.__HOF_V134.snap(pl), gen: fam ? fam.gen : 1 };
      var x = fromHof(h, { level: pl.level | 0, traits: (pl.traits || []).length, age: pl.age, nodes: nodes, surname: fam ? fam.surname : "", team: team, fate: "live" });
      var S = window.RIB_SEASONS;
      x.id = "live"; x.live = true; x.at = Date.now(); x.seasonId = S && S.current ? S.current().id : "s0"; x.week = isoWeek(S && S.now ? S.now() : Date.now());
      x.profile = profileFor(x);
      return clean(x);
    } catch (e) { return null; }
  }

  /* ---- the categories: what each ranks and how ---- */
  var byScore = function (e) { return e.score; };
  var CATS = [
    { id: "alltime", icon: "🏆", name: "All-Time", long: "All-Time Career Score", val: byScore, unit: "pts" },
    { id: "season", icon: "📅", name: "Season", long: "Season Leaderboard", val: byScore, unit: "pts", filter: function (e, o) { return e.seasonId === o.seasonId; } },
    { id: "weekly", icon: "🗓", name: "Weekly", long: "Weekly Challenge Career", val: byScore, unit: "pts", filter: function (e, o) { return e.week === o.week; } },
    { id: "qb", icon: "🎯", name: "Best QB", long: "Best Quarterback", val: byScore, unit: "pts", filter: function (e) { return e.pos === "QB"; } },
    { id: "rb", icon: "💨", name: "Best RB", long: "Best Running Back", val: byScore, unit: "pts", filter: function (e) { return e.pos === "RB"; } },
    { id: "wr", icon: "🙌", name: "Best WR", long: "Best Wide Receiver", val: byScore, unit: "pts", filter: function (e) { return e.pos === "WR"; } },
    { id: "te", icon: "🧱", name: "Best TE", long: "Best Tight End", val: byScore, unit: "pts", filter: function (e) { return e.pos === "TE"; } },
    { id: "ol", icon: "🛡", name: "Best OL", long: "Best Offensive Lineman", val: byScore, unit: "pts", filter: function (e) { return e.pos === "OL"; } },
    { id: "def", icon: "💥", name: "Best DEF", long: "Best Defender (DL · LB · CB · S)", val: byScore, unit: "pts", filter: function (e) { return !!DEF[e.pos]; } },
    { id: "titles", icon: "💍", name: "Titles", long: "Most Championships", val: function (e) { return num(e.titles) + num(e.rings); }, unit: "titles", tie: byScore },
    { id: "crazy", icon: "🌀", name: "Craziest", long: "Craziest Career", val: function (e) { return e.crazy; }, unit: "chaos" },
    { id: "fastest", icon: "⏱", name: "Fastest", long: "Fastest to the League", val: function (e) { return e.toUff; }, asc: true, unit: "seasons", filter: function (e) { return e.toUff != null && (e.level | 0) >= 7; }, tie: byScore },
    { id: "noprestige", icon: "🌱", name: "No Prestige", long: "Best Career Without Prestige", val: byScore, unit: "pts", filter: function (e) { return num(e.nodes) === 0; } }
  ];
  var CAT = {};
  CATS.forEach(function (c) { CAT[c.id] = c; });
  function rank(list, cat, opts) {
    var c = CAT[cat] || CAT.alltime;
    opts = opts || {};
    var a = list.filter(function (e) { return e && (!c.filter || c.filter(e, opts)); });
    if (opts.pos && opts.pos !== "ALL") a = a.filter(function (e) { return opts.pos === "DEF" ? !!DEF[e.pos] : e.pos === opts.pos; });
    if (opts.level != null && opts.level !== "" && opts.level !== "ALL") a = a.filter(function (e) { return (e.level | 0) >= (+opts.level | 0); });
    a.sort(function (x, y) {
      var d = opts.sort === "recent" ? num(y.at) - num(x.at) : (c.asc ? num(c.val(x)) - num(c.val(y)) : num(c.val(y)) - num(c.val(x)));
      if (d) return d;
      if (c.tie) { d = num(c.tie(y)) - num(c.tie(x)); if (d) return d; }
      return num(x.at) - num(y.at);
    });
    return a.slice(0, opts.limit || 100);
  }

  /* ---- the backend: local today, remote by design ---- */
  var Local = {
    name: "local",
    load: function () { try { var j = JSON.parse(localStorage.getItem(KEY) || "null"); return j && j.v === 1 && Array.isArray(j.entries) ? j.entries.map(function (e) { return clean(e); }) : []; } catch (e) { return []; } },
    save: function (a) { try { localStorage.setItem(KEY, JSON.stringify({ v: 1, entries: a.slice(-MAX) })); } catch (e) {} },
    submit: function (entry) {
      var a = this.load();
      if (a.some(function (e) { return e && e.id === entry.id; })) return Promise.resolve({ ok: true, dup: true, local: true });
      a.push(clean(entry)); this.save(a);
      return Promise.resolve({ ok: true, local: true });
    },
    fetch: function (board, opts) { return Promise.resolve(rank(this.load(), board, opts)); },
    rowsSync: function (board, opts) { return rank(this.load(), board, opts); }
  };
  /* The remote adapter is the designed shape (docs/SEASONS.md §5): POST {entry, proof, device, name} to
     /careers/submit, GET /careers/board?cat&season&week&pos&level&limit. The server recomputes the score from
     the proof (the season log), bounds-checks it, rate-limits per device and moderates names; the client's
     number is never trusted. Used only when window.__LB_CONFIG.careerUrl is set — nothing that ships sets it. */
  function Remote(cfg) {
    var base = String(cfg.careerUrl).replace(/\/+$/, "");
    return {
      name: "remote",
      submit: async function (entry) {
        var me = await LB.identity();
        var body = { entry: entry, proof: { v: 151 }, device: me.id, name: me.name };
        var res = await fetch(base + "/careers/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        return { ok: res.ok, status: res.status };
      },
      fetch: async function (board, opts) {
        opts = opts || {};
        var q = "?cat=" + encodeURIComponent(board) + "&limit=" + (opts.limit || 100) + (opts.seasonId ? "&season=" + encodeURIComponent(opts.seasonId) : "") +
          (opts.week ? "&week=" + encodeURIComponent(opts.week) : "") + (opts.pos ? "&pos=" + encodeURIComponent(opts.pos) : "") + (opts.level != null ? "&level=" + encodeURIComponent(opts.level) : "");
        var res = await fetch(base + "/careers/board" + q);
        if (!res.ok) throw new Error("career board " + res.status);
        return (await res.json()).map(function (e) { return clean(e); });
      }
    };
  }
  var remote = (window.__LB_CONFIG && window.__LB_CONFIG.careerUrl) ? Remote(window.__LB_CONFIG) : null;

  function record(q) {
    var entry = buildEntry(q || {});
    Local.submit(entry);
    if (remote) remote.submit(entry).catch(function () {});
    return entry;
  }
  function hasPro() { var M = window.RIB_MONETIZE; return !M || !M.enabled || !!(M.has && M.has("pro")); }   // advanced filters are free while the store is off
  LB.career = {
    categories: function () { return CATS.map(function (c) { return { id: c.id, name: c.long, short: c.name, icon: c.icon, asc: !!c.asc, unit: c.unit }; }); },
    score: careerScore, crazy: crazyScore, parts: scoreParts, fromHof: fromHof, build: buildEntry, record: record, live: liveEntry,
    rank: rank, isoWeek: isoWeek, clean: clean, levelPts: LEVEL_PTS.slice(),
    all: function () { return Local.load(); },
    rows: function (board, opts) { return Local.rowsSync(board, opts); },
    fetch: function (board, opts) { return (remote || Local).fetch(board, opts); },
    submit: function (entry) { return (remote || Local).submit(entry); },
    backend: function () { return remote ? "remote" : "local"; },
    adapters: { local: Local, remote: Remote },
    advancedUnlocked: hasPro,
    _reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} }
  };

  /* ---- Score Attack / Daily feed the season pass (an event, never a number the sim reads) ---- */
  var sub0 = LB.submit, subD0 = LB.submitDaily;
  LB.submit = function (entry) { try { window.RIB_SEASONS && window.RIB_SEASONS.event("scoreAttack", { score: entry && entry.score }); } catch (e) {} return sub0.apply(this, arguments); };
  LB.submitDaily = function (entry) { try { window.RIB_SEASONS && window.RIB_SEASONS.event("daily", { score: entry && entry.score }); } catch (e) {} return subD0.apply(this, arguments); };

  /* ---- the screen: the leaderboard view's CAREER mode ---- */
  var UI = { cat: "alltime", pos: "ALL", level: "ALL", season: null, sort: "score" };
  function crest(e) {
    var t = e.team || {}, css = "";
    try { if (t.logo != null && window.TEAM_LOGOS_V44 && window.TEAM_LOGOS_V44.css) css = window.TEAM_LOGOS_V44.css(t.logo | 0); } catch (x) {}
    var c = (t.colors && t.colors[0]) || "#2a2f3a", c2 = (t.colors && t.colors[1]) || "#e6b23a";
    return '<i class="lb151-crest" style="background-color:' + esc(c) + ";box-shadow:0 0 0 2px " + esc(c2) + ' inset">' + (css ? '<i class="emblem-v44" style="' + esc(css) + '"></i>' : "") + "</i>";
  }
  function trophyIcons(e) {
    try { var S = window.RIB_SEASONS, t = S && S.trophiesFor ? S.trophiesFor(e.id) : []; return t.slice(0, 5).map(function (x) { return '<span title="' + esc(x.label) + '">' + esc(x.icon) + "</span>"; }).join(""); } catch (x) { return ""; }
  }
  function cardFor(e, opts) {
    try {
      var C = window.RIB_COSMETICS;
      if (C && typeof C.renderCard === "function") { var h = C.renderCard(e.profile || {}, opts || { compact: true, context: "leaderboard" }); if (typeof h === "string" && h) return h; }
    } catch (x) {}
    return "";
  }
  function valueOf(e, c) { var v = c.val(e); if (v == null) return "—"; return fmt(v); }
  function rowHtml(e, i, c) {
    var card = cardFor(e);
    var hon = (e.titles ? "🏆" + e.titles + " " : "") + (e.rings ? "💍" + e.rings + " " : "") + (e.mvps ? "⭐" + e.mvps : "");
    var body = card ? '<div class="lb151-card">' + card + "</div>"
      : crest(e) + '<div class="lb151-who"><b>' + esc(e.name) + "</b><small>" + esc(e.pos) + " · " + esc(e.levelName || "") + (e.team && e.team.name ? " · " + esc(e.team.name) : "") + "</small>" +
        '<small class="lb151-hon">' + esc(hon) + trophyIcons(e) + "</small></div>";
    return '<div class="lb-row lb151-row' + (e.live ? " live" : "") + '" role="button" tabindex="0" data-id="' + esc(e.id) + '" onclick="__lbCareerUI.open(\'' + esc(e.id) + "')\">" +
      '<div class="lb-rank' + (i < 3 && !e.live ? " medal" : "") + '">' + (e.live ? "▶" : i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1) + "</div>" + body +
      '<div class="lb151-val"><b>' + esc(valueOf(e, c)) + "</b><small>" + esc(c.unit) + "</small></div></div>";
  }
  function optsNow() {
    var S = window.RIB_SEASONS, cur = S && S.current ? S.current().id : "s0";
    return { seasonId: UI.season || cur, week: isoWeek(S && S.now ? S.now() : Date.now()), pos: UI.pos, level: UI.level, sort: UI.sort, limit: 100 };
  }
  function draw(screen) {
    var c = CAT[UI.cat] || CAT.alltime, o = optsNow(), rows = rank(Local.load(), c.id, o), live = liveEntry(), pro = hasPro();
    var S = window.RIB_SEASONS, seasons = S && S.history ? [S.current()].concat(S.history()) : [];
    var chips = CATS.map(function (k) { return '<button class="lb151-cat' + (k.id === c.id ? " on" : "") + '" data-cat="' + k.id + '" role="tab" onclick="__lbCareerUI.cat(\'' + k.id + "')\">" + k.icon + " " + esc(k.name) + "</button>"; }).join("");
    var posOpts = ["ALL", "QB", "RB", "WR", "TE", "OL", "DEF"].map(function (p) { return '<button class="lb151-pos' + (UI.pos === p ? " on" : "") + '" onclick="__lbCareerUI.pos(\'' + p + "')\">" + p + "</button>"; }).join("");
    var lock = pro ? "" : ' disabled title="Pro"';
    var adv = '<div class="lb151-adv' + (pro ? "" : " locked") + '">' +
      '<select aria-label="Level reached" onchange="__lbCareerUI.level(this.value)"' + lock + '><option value="ALL">Any level</option>' +
      [1, 2, 3, 4, 5, 6, 7, 8].map(function (l) { return '<option value="' + l + '"' + (String(UI.level) === String(l) ? " selected" : "") + ">" + esc(levelName(l)) + "+</option>"; }).join("") + "</select>" +
      (c.id === "season" ? '<select aria-label="Season" onchange="__lbCareerUI.season(this.value)"' + lock + ">" + seasons.map(function (s) { return '<option value="' + esc(s.id) + '"' + (o.seasonId === s.id ? " selected" : "") + ">" + esc(s.name) + "</option>"; }).join("") + "</select>" : "") +
      '<select aria-label="Sort" onchange="__lbCareerUI.sort(this.value)"' + lock + '><option value="score">Best first</option><option value="recent"' + (UI.sort === "recent" ? " selected" : "") + ">Most recent</option></select>" +
      (pro ? "" : '<span class="lb151-pro">PRO</span>') + "</div>";
    var liveRow = "";
    if (live && (!c.filter || c.filter(live, o)) && c.id !== "fastest") {
      var all = rank(Local.load().concat([live]), c.id, Object.assign({}, o, { limit: 1000 })), at = -1;
      for (var i = 0; i < all.length; i++) if (all[i].live) { at = i; break; }
      if (at >= 0) liveRow = '<div class="lb151-now"><div class="lb151-kick">NOW PLAYING · WOULD RANK #' + (at + 1) + "</div>" + rowHtml(live, at, c) + "</div>";
    }
    var body = rows.length ? rows.map(function (e, i) { return rowHtml(e, i, c); }).join("")
      : '<div class="lb-empty">No careers on this board yet.<br><span style="font-size:12px">' + (c.id === "fastest" ? "Reach the UFF to post a time." : c.id === "noprestige" ? "Finish a career before buying any prestige node." : "Finish a career — it is recorded the moment it ends.") + "</span></div>";
    screen.innerHTML =
      '<div class="lb151-head"><div><div class="eyebrow">Career boards · ' + esc(c.long) + '</div><div class="h1">🏆 Leaderboards</div></div><span class="lb151-local" title="There is no server yet: these are your own careers on this device">LOCAL</span></div>' +
      modeBar("career") +
      '<div class="lb151-cats" role="tablist">' + chips + "</div>" +
      '<div class="lb151-filters"><div class="lb151-posbar">' + posOpts + "</div>" + adv + "</div>" +
      liveRow +
      '<div class="card lb-list lb151-list">' + body + "</div>" +
      '<div class="lb-note lb151-note">LOCAL — your own careers on this device; online boards need a server (docs/SEASONS.md). Tap a row for the career and how its score adds up.</div>';
    try { var on = screen.querySelector(".lb151-cat.on"); on && on.scrollIntoView && on.parentNode.scrollTo({ left: Math.max(0, on.offsetLeft - 40) }); } catch (x) {}
  }
  function modeBar(m) {
    return '<div class="lb151-mode"><button class="' + (m === "career" ? "on" : "") + '" onclick="__lbUI.mode(\'career\')">🏆 CAREERS</button><button class="' + (m === "score" ? "on" : "") + '" onclick="__lbUI.mode(\'score\')">⚡ SCORE ATTACK</button></div>';
  }
  function sheet(e) {
    var old = document.getElementById("lb151Sheet");
    if (old) old.remove();
    if (!e) return;
    var c = cardFor(e, { full: true, context: "profile" });
    var parts = scoreParts(e).filter(function (p) { return p[1]; }).map(function (p) { return "<tr><td>" + esc(p[0]) + "</td><td>" + fmt(p[1]) + "</td></tr>"; }).join("");
    var tro = "";
    try { tro = (window.RIB_SEASONS.trophiesFor(e.id) || []).map(function (t) { return '<span class="lb151-tro">' + esc(t.icon) + " " + esc(t.label) + "</span>"; }).join(""); } catch (x) {}
    var stats = [["Seasons", e.seasons], ["Peak OVR", e.peak], ["Wins", e.wins], ["Titles", e.titles], ["UFF rings", e.rings], ["MVPs", e.mvps], ["Awards", e.awards], ["Generation", e.gen], ["Prestige nodes", e.nodes], ["Chaos", e.crazy]];
    var el = document.createElement("div");
    el.id = "lb151Sheet"; el.className = "lb151-sheet";
    el.innerHTML = '<div class="lb151-sheet-in" role="dialog" aria-label="Career profile">' +
      (c ? '<div class="lb151-card full">' + c + "</div>" : "") +
      '<div class="lb151-sheet-head">' + crest(e) + "<div><b>" + esc(e.name) + "</b><small>" + esc(e.pos) + " · " + esc(e.levelName) + (e.team && e.team.name ? " · " + esc((e.team.school ? e.team.school + " " : "") + e.team.name) : "") + "</small></div></div>" +
      '<div class="lb151-sheet-score"><b>' + fmt(e.score) + "</b><small>CAREER SCORE" + (e.live ? " · IN PROGRESS" : "") + "</small></div>" +
      '<div class="lb151-stats">' + stats.map(function (s) { return "<div><b>" + esc(s[1] == null ? "—" : s[1]) + "</b><small>" + esc(s[0]) + "</small></div>"; }).join("") + "</div>" +
      (tro ? '<div class="lb151-tros">' + tro + "</div>" : "") +
      '<table class="lb151-parts">' + parts + "</table>" +
      '<div class="lb151-sheet-btns">' + (window.RIB_COSMETICS && typeof window.RIB_COSMETICS.openProfile === "function" ? '<button class="btn secondary" onclick="__lbCareerUI.profile()">👤 Profile</button>' : "") +
      '<button class="btn" onclick="__lbCareerUI.close()">Close</button></div></div>';
    el.addEventListener("click", function (ev) { if (ev.target === el) el.remove(); });
    document.body.appendChild(el);
  }
  window.__lbCareerUI = {
    draw: function (screen) { draw(screen); },
    redraw: function () { var s = document.getElementById("screen"); if (s) draw(s); },
    cat: function (c) { if (CAT[c]) UI.cat = c; this.redraw(); },
    pos: function (p) { UI.pos = p; this.redraw(); },
    level: function (l) { if (!hasPro()) return; UI.level = l; this.redraw(); },
    season: function (s) { if (!hasPro()) return; UI.season = s; this.redraw(); },
    sort: function (s) { if (!hasPro()) return; UI.sort = s === "recent" ? "recent" : "score"; this.redraw(); },
    open: function (id) { var e = id === "live" ? liveEntry() : Local.load().filter(function (x) { return x && x.id === id; })[0]; sheet(e || null); },
    close: function () { sheet(null); },
    profile: function () { try { window.RIB_COSMETICS.openProfile(); } catch (x) {} },
    state: UI, modeBar: modeBar
  };
})();
