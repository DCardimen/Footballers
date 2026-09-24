
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
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); };
  // v150 A: a handle is cleaned the way every name in the game is (window.__V150A.clean); a local copy if the career block is absent
  var cleanName = function (n, max) {
    if (window.__V150A && window.__V150A.clean) return window.__V150A.clean(n, max);
    return String(n == null ? "" : n).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, "").replace(/[<>`\\{}]/g, "")
      .replace(/&/g, "\uff06").replace(/"/g, "\u201d").replace(/'/g, "\u2019").replace(/\s+/g, " ").trim().slice(0, max);
  };

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
  function localName() { try { return cleanName(localStorage.getItem("rib_lb_handle") || "", 16); } catch (e) { return ""; } }
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
    setName: async function (n) { n = cleanName(n || "", 16); if (!n) return; setLocalName(n); IDENT = null; await identity(); }
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

  window.__lbUI = {
    openDaily: false,
    tab: function (t) { LTAB = t; load(); },
    pos: function (p) { LPOS = p; load(); },
    rename: async function () {
      var cur = localName();
      // v150 A: the in-app dialog (v149 D), not the browser's prompt
      var D = window.ribDialog;
      var n = D && D.prompt ? await D.prompt("Your name on the leaderboards (max 16 characters):", cur || "", { title: "Leaderboard name", ok: "Save", maxLength: 16 }) : null;
      if (n && n.trim()) { await window.__lb.setName(n); draw(); }
    }
  };

  // ---- router entry ----
  window.__lbRender = function (state) {
    STATE = state || window.S || null;
    if (window.__lbUI.openDaily) { LTAB = "daily"; window.__lbUI.openDaily = false; } // arrived from the daily mode
    load();
  };
})();
