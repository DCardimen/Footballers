/* ===== v151 C THE SEASON IS AN EVENT =====
 * The competitive calendar. Two seasons a year (UTC Jan 1 and Jul 1 by default — `window.RIB_SEASONS_CONFIG`
 * overrides the epoch, the length, the themes and the clock), each one named ("Season 1 · Kickoff"), each one with
 * its own boards, its own CAREER PASS and a place in a TROPHY CASE that is never wiped. Careers are never touched:
 * a season's end archives its board and the player's placement, resets the season board and the pass, and the next
 * boot shows a "Season N begins" card with last season's recap.
 *
 *   window.RIB_SEASONS = { current(), seasonAt(ts), history(), pass(), challenges(), weekly(), trophies(),
 *     trophiesFor(careerId), grantPremium(seasonId), premiumOwned(seasonId), buyPremium(), claim(track, tier),
 *     claimAll(), event(kind, data), observe(), flush(), tick(), onChange(cb), rewards(seasonId),
 *     validateReward(r), now(), dev:{setNow, reset, store} }
 *
 * Where the XP comes from: the game is WATCHED, never changed. `observe()` (every 1.5s and on each screen) diffs the
 * career against what it last saw — a week played (+50, +100 more if it was watched live, +50 for a win), a season
 * logged (+250, a title +600, each award +80, an MVP +200), a promotion (+400), a career ended (+500, +500 more for
 * the UFF), a new generation; Score Attack and the Daily Challenge report through `window.__lb` (src/20). Season
 * challenges (20 of a pool of 28, rotated deterministically by the season id) and three weekly challenges add XP
 * when met. Rewards are COSMETIC ONLY — `validateReward` refuses anything that names PP, stats, gear, rerolls or a
 * boost — and are granted through `window.RIB_COSMETICS.grant(id, "pass")`, queued until that module exists.
 * The premium track is owned when `RIB_MONETIZE.has("pass:<seasonId>")` or `grantPremium(seasonId)` was called
 * (the commerce worker calls it after a purchase); while the store is off it reads "coming soon" and the free track
 * works the same. Storage: `rib.seasons.v1`, versioned, OUTSIDE the save (a new career, a reset or an imported save
 * never touches it). Boards: src/20-leaderboards.js (`__lb.career`). docs/SEASONS.md; `scripts/v151Ccheck.mjs`. */
function seasonsOpenV151C(tab) {
  try {
    if (tab === "boards") { if (window.__lbUI) window.__lbUI.nextMode = "career"; window.go && window.go("leaderboard"); return; }
    if (window.__seasonsUI) window.__seasonsUI.tab = tab || "season";
    window.go && window.go("seasons");
  } catch (e) {}
}
(function () {
  "use strict";
  var KEY = "rib.seasons.v1";
  var THEMES = ["Kickoff", "Two-Minute Drill", "Blitz", "Red Zone", "Hail Mary", "Iron Man", "Goal Line", "Overtime", "Audible", "Dynasty"];
  var CFG = Object.assign({ epoch: Date.UTC(2026, 6, 1), months: 6, tiers: 50, xpPerTier: 800, themes: THEMES }, window.RIB_SEASONS_CONFIG || {});
  var XP = { game: 50, live: 100, win: 50, season: 250, title: 600, award: 80, mvp: 200, promo: 400, career: 500, uff: 500, daily: 300, scoreAttack: 150, gen: 300 };
  /* ===== v153 G THE PASS GROWS — 50 tiers, a reward on most of them, a highlight every fifth, a showcase at the end =====
   * 50 tiers × 800 XP (40,000 XP: a little more than the old 30 × 1,000, with more than twice the rewards). The free
   * track pays on every tier except the multiples of 3 that are not multiples of 5 (37 rewards); the premium track pays on
   * all 50. Every fifth tier is a HIGHLIGHT (footprints, wings, a crown, an aura, a jersey, a helmet — one rarity up), and
   * the last tier is the SHOWCASE (premium: mythic wings; free: a legendary crown). Kinds between the highlights rotate.
   * Each flair / kit reward names its STYLE (seraph wings, a crown of fire, frost footprints…) — src/28 draws that style.
   * Still cosmetic by construction (validateReward below) and still no Math.random: the style pick is a hash of the id. */
  var FREE_TIERS = [];
  for (var ft = 1; ft <= CFG.tiers; ft++) if (ft % 3 !== 0 || ft % 5 === 0 || ft === CFG.tiers) FREE_TIERS.push(ft);
  var COSMETIC_KINDS = { banner: "Banner", frame: "Card Frame", title: "Title", badge: "Badge", nameplate: "Nameplate", icon: "Profile Icon", celebration: "Celebration", kit: "Kit Trim",
    jersey: "Jersey", helmet: "Helmet", trail: "Footprints", wings: "Wings", crown: "Crown", aura: "Aura", numfont: "Number Font" };
  var FREE_ROT = ["banner", "title", "jersey", "badge", "numfont", "frame", "helmet", "icon", "trail", "nameplate", "celebration", "kit"];
  var PREM_ROT = ["jersey", "frame", "trail", "helmet", "banner", "celebration", "title", "numfont", "aura", "badge", "crown", "nameplate", "wings", "icon", "kit"];
  var FREE_HI = { 10: "trail", 20: "jersey", 25: "wings", 30: "helmet", 35: "aura", 40: "crown", 45: "trail" };
  var PREM_HI = { 5: "trail", 10: "helmet", 15: "wings", 20: "jersey", 25: "crown", 30: "aura", 35: "trail", 40: "wings", 45: "crown" };
  /* the styles src/28 can draw, each with the rarity it starts at (0 common … 3 legendary) */
  var STYLES = {
    trail: [["sparks", "Gold Spark", 0], ["smoke", "Smoke", 0], ["pixels", "8-Bit", 0], ["ice", "Frost", 1], ["petals", "Petal", 1], ["stars", "Stardust", 1], ["flame", "Flame", 2], ["rainbow", "Rainbow", 2], ["comet", "Comet", 2], ["lightning", "Lightning", 3], ["ghost", "Afterimage", 3]],
    wings: [["pixel", "8-Bit", 0], ["monarch", "Monarch", 0], ["crystal", "Crystal", 1], ["bat", "Night", 1], ["angel", "Angel", 2], ["mech", "Mech", 2], ["flame", "Phoenix", 2], ["seraph", "Seraph", 3]],
    crown: [["laurel", "Laurel", 0], ["circlet", "Circlet", 0], ["horns", "Horned", 1], ["star", "Star", 1], ["crown", "Gold", 2], ["halo", "Halo", 2], ["flame", "Fire", 2], ["king", "Royal", 3]],
    aura: [["glow", "Glow", 0], ["frost", "Frost", 1], ["pulse", "Pulse", 2], ["flicker", "Heat", 2], ["void", "Void", 3]],
    numfont: [["varsity", "Varsity", 0], ["block", "Block", 0], ["stencil", "Stencil", 1], ["retro", "Retro", 1], ["neon", "Neon", 2], ["gold", "Gold Foil", 2], ["chrome", "Chrome", 3]],
    jersey: [["hoops", "Hoops", 0], ["sleeves", "Sleeve", 0], ["stripes", "Stripes", 0], ["pinstripe", "Pinstripe", 1], ["shoulders", "Shoulder", 1], ["checker", "Check", 1], ["chevron", "Chevron", 2], ["sash", "Sash", 2], ["fade", "Fade", 2], ["tiger", "Tiger", 3]],
    helmet: [["gloss", "Gloss", 0], ["matte", "Matte", 0], ["satin", "Satin", 1], ["metal", "Metallic", 2], ["pearl", "Pearl", 2], ["chrome", "Chrome", 3]]
  };
  var RANKS = ["common", "rare", "epic", "legendary", "mythic"];
  var FORBIDDEN = /^(pp|xp|stat|stats|attr|attrs|attribute|gear|reroll|rerolls|boost|ovr|perf|prestige|honors|speed|roll|rolls|spin|spins|coins?)$/i;

  var esc = function (s) { var f = window.__escHtmlV151C; if (typeof f === "function") return f(s); return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); };
  var num = function (v) { v = +v; return isFinite(v) ? v : 0; };
  var fmt = function (n) { return Math.round(num(n)).toLocaleString(); };

  /* ---- the clock ---- */
  var fakeNow = null;
  function now() {
    if (fakeNow != null) return fakeNow;
    if (typeof CFG.now === "function") { try { var n = +CFG.now(); if (isFinite(n)) return n; } catch (e) {} }
    return Date.now();
  }
  function theme(n) { var t = CFG.themes && CFG.themes.length ? CFG.themes : THEMES; return t[((n - 1) % t.length + t.length) % t.length]; }
  function seasonAt(ts) {
    ts = ts == null ? now() : +ts;
    var ep = new Date(CFG.epoch), ey = ep.getUTCFullYear(), em = ep.getUTCMonth(), d = new Date(ts);
    var mi = (d.getUTCFullYear() - ey) * 12 + d.getUTCMonth() - em, idx = Math.floor(mi / CFG.months), n = idx + 1;
    var start = Date.UTC(ey, em + idx * CFG.months, 1), end = Date.UTC(ey, em + (idx + 1) * CFG.months, 1);
    return { id: n >= 1 ? "s" + n : "pre" + (1 - n), number: n, theme: n >= 1 ? theme(n) : "Preseason", name: n >= 1 ? "Season " + n + " · " + theme(n) : "Preseason",
      start: start, end: end, daysLeft: Math.max(0, Math.ceil((end - ts) / 864e5)) };
  }
  function isoWeek(ts) { try { return window.__lb.career.isoWeek(ts); } catch (e) { return "w" + Math.floor(ts / 6048e5); } }

  /* ---- the store (outside the save) ---- */
  function blank() { return { v: 1, cur: null, s: {}, hist: [], trophies: [], obs: null, pending: [], event: null }; }
  function load() { try { var j = JSON.parse(localStorage.getItem(KEY) || "null"); if (j && j.v === 1 && j.s) return j; } catch (e) {} return blank(); }
  var ST = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(ST)); } catch (e) {} }
  function rec(id) {
    id = id || ST.cur || seasonAt().id;
    var r = ST.s[id];
    if (!r) {
      var m = seasonAt(now());
      r = ST.s[id] = { xp: 0, premium: false, claimed: { free: {}, premium: {} }, m: {}, done: {}, wk: { key: null, m: {}, done: {} }, log: [], started: now(), meta: m.id === id ? { name: m.name, start: m.start, end: m.end } : null };
    }
    return r;
  }
  var listeners = [];
  function changed() { save(); listeners.slice().forEach(function (f) { try { f(api.pass()); } catch (e) {} }); }

  /* ---- seeded choice (no Math.random: the pass must never move a sample path) ---- */
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var a = hash(seed); return function () { a = (a + 0x6d2b79f5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function pick(pool, n, seed) { var a = pool.map(function (x, i) { return Object.assign({ id: "c" + i }, x); }), r = rng(seed); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a.slice(0, n); }

  /* ---- challenges: every metric is something the game already records ---- */
  var POOL = [
    { k: "games", g: 10, xp: 400, t: "Suit Up", d: "Play 10 games" }, { k: "games", g: 40, xp: 900, t: "Every Down", d: "Play 40 games" },
    { k: "live", g: 3, xp: 500, t: "Under the Lights", d: "Watch 3 games live" }, { k: "live", g: 12, xp: 1200, t: "Prime Time", d: "Watch 12 games live" },
    { k: "wins", g: 8, xp: 500, t: "Winning Habit", d: "Win 8 games" }, { k: "wins", g: 30, xp: 1200, t: "Dynasty Builder", d: "Win 30 games" },
    { k: "seasons", g: 2, xp: 500, t: "Two Years In", d: "Finish 2 seasons" }, { k: "seasons", g: 8, xp: 1400, t: "The Long Haul", d: "Finish 8 seasons" },
    { k: "titles", g: 1, xp: 800, t: "Hoist It", d: "Win a championship" }, { k: "titles", g: 3, xp: 1600, t: "Three-Peat Energy", d: "Win 3 championships" },
    { k: "promos", g: 2, xp: 600, t: "Moving Up", d: "Get promoted twice" }, { k: "promos", g: 5, xp: 1400, t: "The Ladder", d: "Get promoted 5 times" },
    { k: "careers", g: 1, xp: 700, t: "Full Circle", d: "Finish a career" }, { k: "careers", g: 3, xp: 1500, t: "Run It Back", d: "Finish 3 careers" },
    { k: "uff", g: 1, xp: 1500, t: "The Show", d: "Reach the UFF" },
    { k: "daily", g: 3, xp: 600, t: "Daily Grind", d: "Finish 3 Daily Challenges" }, { k: "daily", g: 10, xp: 1500, t: "Creature of Habit", d: "Finish 10 Daily Challenges" },
    { k: "scoreAttack", g: 3, xp: 500, t: "Arcade Rat", d: "Play 3 Score Attack runs" },
    { k: "awards", g: 2, xp: 500, t: "Hardware", d: "Win 2 season awards" }, { k: "awards", g: 8, xp: 1300, t: "Trophy Shelf", d: "Win 8 season awards" },
    { k: "mvps", g: 1, xp: 900, t: "Most Valuable", d: "Win an MVP / Player of the Year" },
    { k: "yards", g: 1500, xp: 600, t: "Chunk Plays", d: "Gain 1,500 yards" }, { k: "yards", g: 6000, xp: 1400, t: "Yardage Machine", d: "Gain 6,000 yards" },
    { k: "tds", g: 15, xp: 600, t: "Paydirt", d: "Score 15 touchdowns" }, { k: "tds", g: 50, xp: 1400, t: "End Zone Regular", d: "Score 50 touchdowns" },
    { k: "defPlays", g: 60, xp: 600, t: "Hit Somebody", d: "Make 60 defensive plays (tackles, sacks, TFL, PD, INT)" }, { k: "defPlays", g: 250, xp: 1400, t: "Wrecking Crew", d: "Make 250 defensive plays" },
    { k: "gens", g: 1, xp: 700, t: "Like Father", d: "Start the next generation of your line" }
  ];
  var WEEK_POOL = [
    { k: "games", g: 5, xp: 250, t: "Weekly Reps", d: "Play 5 games this week" }, { k: "live", g: 1, xp: 250, t: "Tune In", d: "Watch a game live this week" },
    { k: "wins", g: 3, xp: 300, t: "Win the Week", d: "Win 3 games this week" }, { k: "daily", g: 2, xp: 400, t: "Two Dailies", d: "Finish 2 Daily Challenges this week" },
    { k: "seasons", g: 1, xp: 350, t: "Close It Out", d: "Finish a season this week" }, { k: "yards", g: 400, xp: 300, t: "Move the Chains", d: "Gain 400 yards this week" },
    { k: "tds", g: 4, xp: 300, t: "Four Scores", d: "Score 4 touchdowns this week" }, { k: "defPlays", g: 20, xp: 300, t: "Swarm", d: "Make 20 defensive plays this week" },
    { k: "scoreAttack", g: 1, xp: 200, t: "Arcade Night", d: "Play a Score Attack run this week" }, { k: "awards", g: 1, xp: 350, t: "Decorated", d: "Win a season award this week" }
  ];
  function seasonChallenges(sid) { return pick(POOL, 20, "season:" + sid); }
  function weekChallenges(wk) { return pick(WEEK_POOL, 3, "week:" + wk).map(function (c) { return Object.assign(c, { id: "w" + c.id }); }); }

  /* ---- rewards: generated per season, cosmetic by construction and checked anyway ---- */
  function rarity(t) { var f = t / CFG.tiers; return f >= 0.8 ? "legendary" : f >= 0.5 ? "epic" : f >= 0.2 ? "rare" : "common"; }
  var RARE_ICON = { common: "▫️", rare: "🔹", epic: "🔸", legendary: "🌟" };
  RARE_ICON.mythic = "💎";
  var KIND_ICON = { banner: "🚩", frame: "🖼", title: "🏷", badge: "🎖", nameplate: "🔖", icon: "👤", celebration: "🎉", kit: "🎽", jersey: "👕", helmet: "🪖", trail: "👣", wings: "🪶", crown: "👑", aura: "✨", numfont: "🔢" };
  function styleFor(kind, id, rIdx) {
    var L = STYLES[kind]; if (!L) return null;
    var pool = L.filter(function (x) { return x[2] <= rIdx; }), top = pool.filter(function (x) { return x[2] >= Math.min(rIdx, 3) - 1; });
    if (top.length) pool = top;
    return pool[hash("style:" + id) % pool.length];
  }
  function rewards(sid) {
    var m = /^s(\d+)$/.exec(sid || ""), n = m ? +m[1] : 0, th = n ? theme(n) : "Preseason";
    var mk = function (track, tier, kind, hi) {
      var rr = rarity(tier), show = tier === CFG.tiers, ri = RANKS.indexOf(rr);
      if (show) rr = track === "premium" ? "mythic" : "legendary"; else if (hi && ri < 3) rr = RANKS[ri + 1];
      var id = "pass." + sid + "." + track + "." + tier, sty = styleFor(kind, id, Math.min(3, RANKS.indexOf(rr)));
      if (show && STYLES[kind]) sty = STYLES[kind][STYLES[kind].length - 1];   // the showcase wears the top style (seraph wings, the royal crown)
      if (sty) {
        var nm = kind === "wings" ? (show ? "The " + th + " " + sty[1] : th + " " + sty[1] + " Wings") : kind === "crown" ? (show ? "Crown of the " + th : th + " " + sty[1] + " Crown")
          : kind === "trail" ? th + " " + sty[1] + " Footprints" : kind === "aura" ? th + " " + sty[1] + " Aura" : kind === "numfont" ? sty[1] + " Numbers" : th + " " + sty[1] + " " + COSMETIC_KINDS[kind];
        if (!show && track === "premium" && (kind === "jersey" || kind === "helmet")) nm = "Elite " + nm;
        return { id: id, kind: kind, style: sty[0], name: nm, rarity: rr, track: track, tier: tier, season: sid, source: "pass", icon: KIND_ICON[kind], highlight: !!hi || show, showcase: show };
      }
      var name = kind === "title" ? "“" + th + (rr === "legendary" || rr === "mythic" ? " Legend" : rr === "epic" ? " Star" : " Starter") + "”" : (rr === "legendary" ? "Gold " : rr === "epic" ? "Chrome " : track === "premium" ? "Elite " : "") + th + " " + COSMETIC_KINDS[kind];
      return { id: id, kind: kind, name: name, rarity: rr, track: track, tier: tier, season: sid, source: "pass", icon: KIND_ICON[kind], highlight: !!hi || show, showcase: show };
    };
    var lane = function (tr, tiers, HI, ROT, showKind) {
      var j = 0;
      return tiers.map(function (t) {
        if (t === CFG.tiers) return mk(tr, t, showKind, true);
        if (t % 5 === 0 && HI[t]) return mk(tr, t, HI[t], true);
        return mk(tr, t, ROT[(j++ + (tr === "free" ? 0 : 1)) % ROT.length], false);
      });
    };
    var all = []; for (var t = 1; t <= CFG.tiers; t++) all.push(t);
    return { free: lane("free", FREE_TIERS, FREE_HI, FREE_ROT, "crown"), premium: lane("premium", all, PREM_HI, PREM_ROT, "wings") };
  }
  function validateReward(r) {
    if (!r || typeof r !== "object") return { ok: false, why: "no reward" };
    if (!COSMETIC_KINDS[r.kind]) return { ok: false, why: "kind " + r.kind + " is not cosmetic" };
    for (var k in r) if (FORBIDDEN.test(k)) return { ok: false, why: "field " + k + " is not cosmetic" };
    if (!/^pass\./.test(String(r.id || ""))) return { ok: false, why: "id outside the pass namespace" };
    return { ok: true };
  }

  /* ---- XP and tiers ---- */
  function tierOf(xp) { return Math.min(CFG.tiers, Math.floor(num(xp) / CFG.xpPerTier)); }
  function addXp(n, why) {
    var r = rec(); n = Math.max(0, Math.round(num(n)));
    if (!n) return;
    var before = tierOf(r.xp);
    r.xp += n;
    r.log.unshift({ xp: n, why: why, at: now() }); r.log.length > 30 && (r.log.length = 30);
    if (tierOf(r.xp) > before) toast("🎟 Pass tier " + tierOf(r.xp) + " reached");
  }
  function weekRec() { var r = rec(), k = isoWeek(now()); if (r.wk.key !== k) r.wk = { key: k, m: {}, done: {} }; return r.wk; }
  function bump(k, n) { n = num(n); if (!n) return; var r = rec(), w = weekRec(); r.m[k] = num(r.m[k]) + n; w.m[k] = num(w.m[k]) + n; }
  function checkChallenges() {
    var r = rec(), w = weekRec();
    seasonChallenges(ST.cur).forEach(function (c) { if (!r.done[c.id] && num(r.m[c.k]) >= c.g) { r.done[c.id] = now(); addXp(c.xp, "challenge: " + c.t); toast("✅ Challenge: " + c.t + " (+" + c.xp + " XP)"); } });
    weekChallenges(w.key).forEach(function (c) { if (!w.done[c.id] && num(w.m[c.k]) >= c.g) { w.done[c.id] = now(); addXp(c.xp, "weekly: " + c.t); toast("✅ Weekly: " + c.t + " (+" + c.xp + " XP)"); } });
  }
  function toast(msg) {
    try {
      var t = document.getElementById("toast");
      if (!t || !window.__GRIDIRON_AUDIT__) return;
      var st = window.__GRIDIRON_AUDIT__.getState();
      if (!st || st.view === "live" || window.__silentSimV85) return;
      t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 2200);
    } catch (e) {}
  }
  var STAT_YDS = ["passYds", "rushYds", "recYds"], STAT_TD = ["passTD", "rushTD", "recTD"], STAT_DEF = ["tackles", "sacks", "tfl", "pd"], DEFPOS = { DL: 1, LB: 1, CB: 1, S: 1 };
  function event(kind, d) {
    d = d || {};
    tick();
    if (kind === "game") {
      bump("games", 1); addXp(XP.game, "game");
      if (d.live) { bump("live", 1); addXp(XP.live, "live game"); }
      if (d.won) { bump("wins", 1); addXp(XP.win, "win"); }
      var s = d.stat || {}, y = 0, td = 0, dp = 0;
      STAT_YDS.forEach(function (k) { y += num(s[k]); }); STAT_TD.forEach(function (k) { td += num(s[k]); }); STAT_DEF.forEach(function (k) { dp += num(s[k]); });
      if (DEFPOS[d.pos]) dp += num(s["int"]);
      bump("yards", Math.max(0, y)); bump("tds", td); bump("defPlays", dp);
    } else if (kind === "season") {
      bump("seasons", 1); addXp(XP.season, "season");
      if (d.champion) { bump("titles", 1); addXp(XP.title, "title"); }
      var aw = num(d.awards), mv = num(d.mvps);
      if (aw) { bump("awards", aw); addXp(XP.award * aw, "awards"); }
      if (mv) { bump("mvps", mv); addXp(XP.mvp * mv, "MVP"); }
    } else if (kind === "promo") { bump("promos", 1); addXp(XP.promo, "promotion"); }
    else if (kind === "career") { bump("careers", 1); addXp(XP.career, "career"); if (d.won) { bump("uff", 1); addXp(XP.uff, "made the UFF"); } }
    else if (kind === "daily") { bump("daily", 1); addXp(XP.daily, "daily challenge"); }
    else if (kind === "scoreAttack") { bump("scoreAttack", 1); addXp(XP.scoreAttack, "score attack"); }
    else if (kind === "newGen") { bump("gens", 1); addXp(XP.gen, "new generation"); }
    else return false;
    checkChallenges();
    changed();
    return true;
  }

  /* ---- the observer: diff the career, never touch it ---- */
  function stateOf() { try { return window.__GRIDIRON_AUDIT__ && window.__GRIDIRON_AUDIT__.getState(); } catch (e) { return null; } }
  function genNow() { try { return window.__LINEAGE_V136.family().gen | 0; } catch (e) { return 1; } }
  function weekKeyOf(pl, i, w) { return (pl.level | 0) + "|" + (pl.totalSeasons | 0) + "|" + i + "|" + String(w.opp || "").slice(0, 30); }
  function observe() {
    flush();
    tick();
    var st = stateOf(), pl = st && st.player;
    if (!pl || !pl.name) return;
    var ck = (st.careers | 0) + ":" + pl.name, o = ST.obs;
    var wr = pl.weekResults || [], log = pl.seasonLogV77 || [], lastN = log.length ? num(log[log.length - 1].n) : 0;
    if (!o || o.ck !== ck) {
      var prevGen = o ? num(o.gen) : 0;
      var seen = {};
      wr.forEach(function (w, i) { if (w && w.played) seen[weekKeyOf(pl, i, w)] = 1; });
      ST.obs = { ck: ck, lastN: lastN, level: pl.level | 0, gen: genNow(), seen: seen };
      if (o && ST.obs.gen > prevGen) event("newGen");
      save();
      return;
    }
    var hit = false, pre = (pl.level | 0) + "|" + (pl.totalSeasons | 0) + "|";
    wr.forEach(function (w, i) {
      if (!w || !w.played) return;
      var key = weekKeyOf(pl, i, w);
      if (o.seen[key]) return;
      o.seen[key] = 1; hit = true;
      if (!w.satOut) event("game", { live: !!w.liveBookedV85, won: !!w.won, stat: w.statLine, pos: pl.pos });
    });
    for (var k in o.seen) if (k.indexOf(pre) !== 0 && Object.keys(o.seen).length > 60) delete o.seen[k];
    log.forEach(function (r) {
      if (num(r.n) <= num(o.lastN)) return;
      var aw = r.awards || [], mv = aw.filter(function (a) { return /MVP|Player of the Year/i.test(String((a && a.name) || a)); }).length;
      hit = true; event("season", { champion: !!r.champion, awards: aw.length, mvps: mv });
    });
    if (lastN > num(o.lastN)) o.lastN = lastN;
    if ((pl.level | 0) > num(o.level)) { for (var l = num(o.level); l < (pl.level | 0); l++) event("promo"); hit = true; }
    o.level = pl.level | 0; o.gen = genNow();
    if (hit) save();
  }

  /* ---- a finished career: the board, the trophies, the XP ---- */
  function flush() {
    var q = window.__seasonsQV151C;
    if (q && q.length && window.__lb && window.__lb.career) {
      var items = q.splice(0, q.length);
      items.forEach(function (it) {
        try {
          var e = window.__lb.career.record(it);
          trophy({ kind: "career", icon: e.won ? "🏈" : "🥾", label: e.won ? "Made the UFF — " + e.name : "Career — " + e.name + " (" + e.levelName + ")", careerId: e.id, seasonId: e.seasonId, silent: true });
          if (num(e.titles)) trophy({ kind: "title", icon: "🏆", label: e.titles + "× Champion — " + e.name, careerId: e.id, seasonId: e.seasonId });
          if (num(e.rings)) trophy({ kind: "ring", icon: "💍", label: e.rings + "× UFF Champion — " + e.name, careerId: e.id, seasonId: e.seasonId });
          if (num(e.mvps)) trophy({ kind: "mvp", icon: "⭐", label: e.mvps + "× MVP — " + e.name, careerId: e.id, seasonId: e.seasonId });
          event("career", { won: e.won });
        } catch (x) {}
      });
      changed();
    }
    flushPending();
  }
  function trophy(t) {
    t = Object.assign({ at: now(), seasonId: ST.cur }, t);
    t.id = t.id || t.kind + ":" + (t.careerId || t.seasonId) + ":" + hash(t.label);
    if (ST.trophies.some(function (x) { return x.id === t.id; })) return null;
    ST.trophies.push(t); ST.trophies.length > 300 && ST.trophies.splice(0, ST.trophies.length - 300);
    return t;
  }

  /* ---- the rollover ---- */
  var MEDALS = [[3000, "💎", "Legend"], [2000, "🔷", "Diamond"], [1400, "🟣", "Platinum"], [900, "🥇", "Gold"], [500, "🥈", "Silver"], [1, "🥉", "Bronze"]];
  function medalOf(score) { for (var i = 0; i < MEDALS.length; i++) if (num(score) >= MEDALS[i][0]) return { icon: MEDALS[i][1], name: MEDALS[i][2], min: MEDALS[i][0] }; return null; }
  function slim(e) { return e ? { id: e.id, name: e.name, pos: e.pos, levelName: e.levelName, score: e.score, titles: e.titles, rings: e.rings } : null; }
  function archive(oldId) {
    var r = ST.s[oldId] || rec(oldId), C = window.__lb && window.__lb.career, all = C ? C.all() : [];
    var meta = r.meta || (function () { var m = /^s(\d+)$/.exec(oldId), n = m ? +m[1] : 0; return { name: n ? "Season " + n + " · " + theme(n) : oldId }; })();
    var board = C ? C.rank(all, "season", { seasonId: oldId, limit: 100 }) : [], best = board[0] || null, tier = tierOf(r.xp);
    var cats = {};
    if (C) C.categories().forEach(function (c) { if (c.id === "alltime" || c.id === "season" || c.id === "weekly") return; var top = C.rank(all.filter(function (e) { return e.seasonId === oldId; }), c.id, { limit: 1 })[0]; if (top) cats[c.id] = { name: top.name, rank: 1, of: board.length }; });
    var medal = best ? medalOf(best.score) : null, won = [];
    if (medal) won.push(trophy({ kind: "season", icon: medal.icon, label: meta.name + " — " + medal.name + " finish", detail: "best career " + fmt(best.score) + " pts · #1 of " + board.length + " local career" + (board.length === 1 ? "" : "s"), seasonId: oldId, careerId: best.id }));
    if (tier > 0) won.push(trophy({ kind: "pass", icon: tier >= CFG.tiers ? "🎟" : "🎫", label: meta.name + " pass — tier " + tier + (tier >= CFG.tiers ? " (complete)" : ""), seasonId: oldId }));
    if (num(r.xp) > 0 || board.length) won.push(trophy({ kind: "badge", icon: "🏅", label: meta.name + " — played", seasonId: oldId }));
    var h = { id: oldId, name: meta.name, start: meta.start || null, end: meta.end || null, archivedAt: now(), top: board.slice(0, 10).map(slim), best: slim(best), careers: board.length,
      tier: tier, xp: num(r.xp), premium: !!r.premium, medal: medal, cats: cats, local: true, pct: null };
    ST.hist = [h].concat(ST.hist.filter(function (x) { return x.id !== oldId; })).slice(0, 24);
    return { hist: h, trophies: won.filter(Boolean) };
  }
  function tick() {
    var cur = seasonAt(now());
    if (!ST.cur) { ST.cur = cur.id; rec(cur.id); save(); return false; }
    if (ST.cur === cur.id) return false;
    var old = ST.cur, a = archive(old);
    ST.cur = cur.id;
    rec(cur.id);                                         // a fresh pass: XP 0, nothing claimed
    for (var k in ST.s) if (k !== cur.id && k !== old) delete ST.s[k];
    ST.obs && (ST.obs.seen = ST.obs.seen || {});
    ST.event = { from: { id: old, name: a.hist.name }, to: { id: cur.id, name: cur.name, end: cur.end }, recap: a.hist, trophies: a.trophies.map(function (t) { return { icon: t.icon, label: t.label }; }), at: now(), seen: false };
    changed();
    return true;
  }

  /* ---- premium + claims ---- */
  function premiumOwned(sid) { sid = sid || ST.cur; var r = ST.s[sid], M = window.RIB_MONETIZE; try { if (M && M.has && M.has("pass:" + sid)) return true; } catch (e) {} return !!(r && r.premium); }
  function grantPremium(sid) { sid = sid || ST.cur; if (!sid) return false; rec(sid).premium = true; changed(); return true; }
  function storeOn() { var M = window.RIB_MONETIZE; return !!(M && M.enabled); }
  function buyPremium() {
    var M = window.RIB_MONETIZE, sid = ST.cur;
    if (!M || !M.enabled) return false;
    try { if (typeof M.purchasePass === "function") return M.purchasePass(sid); if (typeof M.purchase === "function") return M.purchase("pass:" + sid); } catch (e) {}
    return false;
  }
  function grantCosmetic(rw) {
    var C = window.RIB_COSMETICS;
    if (C && typeof C.grant === "function") { try { C.grant(rw.id, "pass", rw); return "granted"; } catch (e) {} }
    if (!ST.pending.some(function (p) { return p.id === rw.id; })) ST.pending.push({ id: rw.id, source: "pass", reward: rw, at: now() });
    return "queued";
  }
  function flushPending() {
    var C = window.RIB_COSMETICS;
    if (!ST.pending.length || !C || typeof C.grant !== "function") return;
    var left = [];
    ST.pending.forEach(function (p) { try { C.grant(p.id, p.source || "pass", p.reward); } catch (e) { left.push(p); } });
    ST.pending = left; save();
  }
  function claim(track, tier) {
    tick();
    track = track === "premium" ? "premium" : "free"; tier = tier | 0;
    var r = rec(), list = rewards(ST.cur)[track], rw = list.filter(function (x) { return x.tier === tier; })[0];
    if (!rw) return { ok: false, reason: "no reward at that tier" };
    if (tier > tierOf(r.xp)) return { ok: false, reason: "tier locked" };
    if (track === "premium" && !premiumOwned()) return { ok: false, reason: "premium not owned" };
    if (r.claimed[track][tier]) return { ok: false, reason: "already claimed" };
    var v = validateReward(rw);
    if (!v.ok) return { ok: false, reason: v.why };
    var how = grantCosmetic(rw);
    r.claimed[track][tier] = now();
    changed();
    return { ok: true, reward: rw, granted: how };
  }
  function claimAll() {
    var out = [], t = tierOf(rec().xp), R = rewards(ST.cur), prem = premiumOwned();
    ["free", "premium"].forEach(function (tr) { if (tr === "premium" && !prem) return; R[tr].forEach(function (rw) { if (rw.tier <= t && !rec().claimed[tr][rw.tier]) { var c = claim(tr, rw.tier); c.ok && out.push(c.reward); } }); });
    return out;
  }

  /* ---- the public API ---- */
  var api = {
    version: 1,
    config: CFG,
    now: now,
    seasonAt: seasonAt,
    current: function () { tick(); return seasonAt(now()); },
    history: function () { return ST.hist.slice(); },
    pass: function () {
      var r = rec(), t = tierOf(r.xp), R = rewards(ST.cur), own = premiumOwned();
      var dec = function (tr) { return R[tr].map(function (rw) { return Object.assign({}, rw, { unlocked: rw.tier <= t, claimed: !!r.claimed[tr][rw.tier], locked: tr === "premium" && !own }); }); };
      return { season: ST.cur, owned: own, store: storeOn(), tier: t, tiers: CFG.tiers, xp: r.xp, xpPerTier: CFG.xpPerTier, xpInTier: t >= CFG.tiers ? CFG.xpPerTier : r.xp % CFG.xpPerTier,
        tracks: { free: dec("free"), premium: dec("premium") }, log: r.log.slice(0, 10) };
    },
    challenges: function () { var r = rec(); return seasonChallenges(ST.cur).map(function (c) { return Object.assign({}, c, { have: Math.min(c.g, num(r.m[c.k])), done: !!r.done[c.id] }); }); },
    weekly: function () { var w = weekRec(); return weekChallenges(w.key).map(function (c) { return Object.assign({}, c, { have: Math.min(c.g, num(w.m[c.k])), done: !!w.done[c.id], week: w.key }); }); },
    metrics: function () { return Object.assign({}, rec().m); },
    trophies: function () { return ST.trophies.slice(); },
    trophiesFor: function (careerId) { return ST.trophies.filter(function (t) { return t.careerId === careerId; }); },
    grantPremium: grantPremium, premiumOwned: premiumOwned, buyPremium: buyPremium,
    claim: claim, claimAll: claimAll, event: event, observe: observe, flush: flush, tick: tick,
    rewards: rewards, validateReward: validateReward, tierOf: tierOf, medalOf: medalOf, xpTable: XP,
    pending: function () { return ST.pending.slice(); },
    pendingEvent: function () { return ST.event && !ST.event.seen ? ST.event : null; },
    dismissEvent: function () { if (ST.event) { ST.event.seen = true; save(); } var el = document.getElementById("ss151Event"); el && el.remove(); },
    onChange: function (cb) { if (typeof cb !== "function") return function () {}; listeners.push(cb); return function () { listeners = listeners.filter(function (f) { return f !== cb; }); }; },
    dev: {
      setNow: function (ts) { fakeNow = ts == null ? null : +ts; return tick(); },
      reset: function () { ST = blank(); save(); },
      store: function () { return JSON.parse(JSON.stringify(ST)); },
      addXp: function (n) { addXp(n, "dev"); checkChallenges(); changed(); }
    }
  };
  window.RIB_SEASONS = api;

  /* ================= the screens ================= */
  var UI = window.__seasonsUI = { tab: "season", sub: "tiers" };
  function bar(have, goal) { var p = goal ? Math.max(0, Math.min(100, have / goal * 100)) : 0; return '<i class="ss151-bar"><i style="width:' + p.toFixed(1) + '%"></i></i>'; }
  function dateStr(ts) { try { return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }); } catch (e) { return ""; } }
  function tabs() {
    return '<div class="ss151-tabs" role="tablist">' + [["season", "📅 SEASON"], ["pass", "🎟 PASS"], ["trophies", "🏆 TROPHIES"], ["boards", "📊 BOARDS"]].map(function (t) {
      return '<button role="tab" class="' + (UI.tab === t[0] ? "on" : "") + '" data-tab="' + t[0] + '" onclick="__seasonsUI.go(\'' + t[0] + "')\">" + t[1] + "</button>";
    }).join("") + "</div>";
  }
  function challengeRows(list) {
    return list.map(function (c) {
      return '<div class="ss151-ch' + (c.done ? " done" : "") + '"><div><b>' + (c.done ? "✅ " : "") + esc(c.t) + "</b><small>" + esc(c.d) + "</small>" + bar(c.have, c.g) + '</div><span><b>' + fmt(c.have) + "/" + fmt(c.g) + "</b><small>+" + fmt(c.xp) + " XP</small></span></div>";
    }).join("");
  }
  function passHead(P) {
    var prem = P.owned ? '<span class="ss151-own">PREMIUM ✓</span>' : P.store ? '<button class="ss151-buy" onclick="__seasonsUI.buy()">UNLOCK PREMIUM · $9.99</button>' : '<span class="ss151-soon">PREMIUM TRACK · COMING SOON</span>';
    return '<div class="card ss151-passhead"><div class="ss151-tier"><b>' + P.tier + '</b><small>/ ' + P.tiers + '<br>TIER</small></div><div class="ss151-xp"><div>' +
      (P.tier >= P.tiers ? "PASS COMPLETE" : fmt(P.xpInTier) + " / " + fmt(P.xpPerTier) + " XP to tier " + (P.tier + 1)) + "</div>" + bar(P.xpInTier, P.xpPerTier) + "<div>" + prem + "</div></div></div>";
  }
  function drawSeason() {
    var c = api.current(), P = api.pass(), wk = api.weekly(), h = ST.hist[0], len = c.end - c.start, p = len ? (now() - c.start) / len : 0;
    var Cb = window.__lb && window.__lb.career, mine = Cb ? Cb.rank(Cb.all(), "season", { seasonId: c.id, limit: 100 }) : [];
    var wkEnd = Math.max(1, 7 - ((new Date(now()).getUTCDay() + 6) % 7));
    return '<div class="card ss151-hero"><div class="ss151-kick">THE SEASON · LOCAL</div><div class="ss151-name">' + esc(c.name) + '</div>' +
      '<div class="ss151-dates">' + esc(dateStr(c.start)) + " – " + esc(dateStr(c.end)) + ' · <b class="ss151-left">' + c.daysLeft + " DAY" + (c.daysLeft === 1 ? "" : "S") + " LEFT</b></div>" + bar(p * 100, 100) +
      '<div class="ss151-mini"><span>🎟 Pass tier <b>' + P.tier + "</b></span><span>🏈 <b>" + mine.length + "</b> career" + (mine.length === 1 ? "" : "s") + " this season</span><span>🏆 best <b>" + (mine[0] ? fmt(mine[0].score) : "—") + "</b></span></div></div>" +
      '<div class="h2">🗓 This week <small class="ss151-dim">resets in ' + wkEnd + " day" + (wkEnd === 1 ? "" : "s") + "</small></div>" + '<div class="card tight">' + challengeRows(wk) + "</div>" +
      (h ? '<div class="h2">⏮ Last season</div><div class="card tight ss151-recap"><b>' + esc(h.name) + "</b><small>" + (h.best ? (h.medal ? esc(h.medal.icon + " " + h.medal.name + " finish · ") : "") + "best " + esc(h.best.name) + " " + fmt(h.best.score) + " pts" : "no career finished") + " · pass tier " + h.tier + " · " + h.careers + " career" + (h.careers === 1 ? "" : "s") + "</small></div>" : "") +
      (ST.hist.length > 1 ? '<div class="h2">📚 Past seasons</div><div class="card tight">' + ST.hist.slice(1).map(function (x) { return '<div class="ss151-hist"><b>' + esc(x.name) + "</b><small>" + (x.best ? esc(x.best.name) + " · " + fmt(x.best.score) : "—") + " · tier " + x.tier + "</small></div>"; }).join("") + "</div>" : "") +
      '<div class="ss151-note">Careers are never wiped. When a season ends its board and your finish go in the trophy case, and the pass starts again.</div>';
  }
  function rewardCell(rw, tr) {
    if (!rw) return '<div class="ss151-rw none">—</div>';
    var state = rw.claimed ? '<span class="ss151-got">✓ CLAIMED</span>' : rw.locked ? '<span class="ss151-lock">🔒</span>' : rw.unlocked ? '<button class="ss151-claim" onclick="__seasonsUI.claim(\'' + tr + "'," + rw.tier + ')">CLAIM</button>' : '<span class="ss151-lock">TIER ' + rw.tier + "</span>";
    return '<div class="ss151-rw r-' + rw.rarity + (rw.claimed ? " got" : "") + '"><i>' + esc(rw.icon) + "</i><div><b>" + esc(rw.name) + "</b><small>" + esc(RARE_ICON[rw.rarity] + " " + rw.rarity + " · " + COSMETIC_KINDS[rw.kind]) + "</small></div>" + state + "</div>";
  }
  function drawPass() {
    var P = api.pass(), sub = UI.sub === "challenges" ? "challenges" : "tiers";
    var subs = '<div class="ss151-subs"><button class="' + (sub === "tiers" ? "on" : "") + '" onclick="__seasonsUI.subtab(\'tiers\')">TIERS</button><button class="' + (sub === "challenges" ? "on" : "") + '" onclick="__seasonsUI.subtab(\'challenges\')">CHALLENGES</button></div>';
    var body;
    if (sub === "tiers") {
      var free = {}; P.tracks.free.forEach(function (r) { free[r.tier] = r; });
      body = '<div class="ss151-trackhead"><span></span><span>FREE</span><span>PREMIUM' + (P.owned ? "" : P.store ? " 🔒" : " · SOON") + "</span></div>" +
        '<div class="ss151-track">' + P.tracks.premium.map(function (pr) {
          return '<div class="ss151-row' + (pr.unlocked ? " unlocked" : "") + (pr.tier === P.tier + 1 ? " next" : "") + (pr.showcase ? " show" : pr.highlight ? " hi" : "") + '" data-tier="' + pr.tier + '"><b class="ss151-n">' + pr.tier + "</b>" + rewardCell(free[pr.tier], "free") + rewardCell(pr, "premium") + "</div>";
        }).join("") + "</div>";
    } else body = '<div class="card tight ss151-chs">' + challengeRows(api.challenges()) + "</div>";
    return passHead(P) + subs + body + '<div class="ss151-note">Every reward is cosmetic — footprints, wings, crowns, auras, jerseys, helmets, frames, titles. Nothing on the pass changes a snap, a stat or a payout.</div>';
  }
  function profileCard() {
    try { var C = window.RIB_COSMETICS; if (C && typeof C.renderCard === "function" && typeof C.profile === "function") { var h = C.renderCard(C.profile() || {}, { full: true, context: "trophies" }); if (typeof h === "string" && h) return '<div class="ss151-profile">' + h + "</div>"; } } catch (e) {}
    var st = stateOf() || {}, fam = null;
    try { fam = window.__LINEAGE_V136.family(); } catch (e) {}
    return '<div class="card ss151-profile plain"><b>' + esc(fam && fam.surname ? "The " + fam.surname + " Line" : "Your Legacy") + "</b><small>" + fmt(st.careers || 0) + " careers · " + fmt(ST.trophies.length) + " trophies · " + fmt((ST.hist || []).length) + " seasons archived</small></div>";
  }
  function drawTrophies() {
    var T = ST.trophies.slice().reverse(), groups = { season: "Season finishes", title: "Championships", ring: "UFF rings", mvp: "MVPs", career: "Careers", pass: "Pass", badge: "Season badges" };
    var html = profileCard();
    if (!T.length) html += '<div class="card lb-empty">The case is empty. Finish a career — titles, MVPs and season finishes land here and stay here, whatever happens to the boards.</div>';
    Object.keys(groups).forEach(function (g) {
      var list = T.filter(function (t) { return t.kind === g; });
      if (!list.length) return;
      html += '<div class="h2">' + esc(groups[g]) + ' <small class="ss151-dim">' + list.length + '</small></div><div class="ss151-case">' + list.map(function (t) {
        return '<div class="ss151-tro"><i>' + esc(t.icon) + "</i><b>" + esc(t.label) + "</b>" + (t.detail ? "<small>" + esc(t.detail) + "</small>" : "") + "</div>";
      }).join("") + "</div>";
    });
    if (ST.pending.length) html += '<div class="ss151-note">' + ST.pending.length + " cosmetic" + (ST.pending.length === 1 ? "" : "s") + " claimed and waiting for the locker to open.</div>";
    return html;
  }
  function draw() {
    var sc = document.getElementById("screen"), dk = document.getElementById("dock");
    if (!sc || !dk) return;
    if (UI.tab === "boards") { seasonsOpenV151C("boards"); return; }
    var c = api.current();
    sc.innerHTML = '<div class="eyebrow">' + esc(c.name) + " · " + c.daysLeft + ' days left</div><div class="h1">🎟 Season & Pass</div>' + tabs() +
      '<div class="ss151-body" data-tab="' + UI.tab + '">' + (UI.tab === "pass" ? drawPass() : UI.tab === "trophies" ? drawTrophies() : drawSeason()) + "</div>";
    var st = stateOf(), has = !!(st && st.player && !st.player._settled);
    var claimable = api.pass().tracks.free.concat(api.premiumOwned() ? api.pass().tracks.premium : []).some(function (r) { return r.unlocked && !r.claimed; });
    dk.innerHTML = (UI.tab === "pass" && claimable ? '<button class="btn" onclick="__seasonsUI.claimAll()">🎁 Claim All</button>' : '<button class="btn" onclick="__seasonsUI.play()">' + (has ? "▶ Play Your Career" : "▶ Start a Career") + "</button>") +
      '<div class="btn-row"><button class="btn secondary" onclick="seasonsOpenV151C(\'boards\')">📊 Leaderboards</button><button class="btn ghost" onclick="go(\'menu\')">← Menu</button></div>';
  }
  UI.go = function (t) { UI.tab = t; if (t === "boards") return seasonsOpenV151C("boards"); draw(); try { document.getElementById("screen").scrollTop = 0; } catch (e) {} };
  UI.subtab = function (s) { UI.sub = s; draw(); };
  UI.claim = function (tr, tier) { var r = claim(tr, tier); if (r.ok) toast("🎁 " + r.reward.name + (r.granted === "queued" ? " — waiting for the locker" : "")); draw(); return r; };
  UI.claimAll = function () { var got = claimAll(); if (got.length) toast("🎁 Claimed " + got.length + " reward" + (got.length === 1 ? "" : "s")); draw(); return got; };
  UI.buy = function () { buyPremium(); };
  UI.play = function () { var st = stateOf(); if (st && st.player && !st.player._settled) window.go(st.player.weekResults ? "season" : "hub"); else window.go("menu"); };
  UI.draw = draw;
  window.__seasonsRender = function () { observe(); draw(); };

  /* ---- the "Season N begins" card ---- */
  function eventCard() {
    var E = api.pendingEvent();
    if (!E || document.getElementById("ss151Event")) return;
    var sp = document.getElementById("splash");
    if (sp && !sp.classList.contains("gone")) return;
    var st = stateOf();
    if (!st || st.view === "live" || document.querySelector(".onboard")) return;
    var R = E.recap || {}, el = document.createElement("div");
    el.id = "ss151Event"; el.className = "ss151-event";
    el.innerHTML = '<div class="ss151-event-in" role="dialog" aria-label="' + esc(E.to.name) + ' begins"><div class="ss151-kick">A NEW SEASON</div><div class="ss151-evname">' + esc(E.to.name) + '</div><div class="ss151-evsub">begins now · ends ' + esc(dateStr(E.to.end)) + "</div>" +
      '<div class="ss151-evrecap"><div class="ss151-kick">' + esc(E.from.name) + " — RECAP</div>" +
      (R.best ? "<div>" + (R.medal ? esc(R.medal.icon + " " + R.medal.name) + " finish · " : "") + "best career <b>" + esc(R.best.name) + "</b> " + fmt(R.best.score) + " pts</div>" : "<div>No career finished last season.</div>") +
      "<div>🎟 pass tier <b>" + num(R.tier) + "</b> · " + num(R.careers) + " career" + (R.careers === 1 ? "" : "s") + " on the board</div>" +
      (E.trophies && E.trophies.length ? '<div class="ss151-evtro">' + E.trophies.map(function (t) { return "<span>" + esc(t.icon) + " " + esc(t.label) + "</span>"; }).join("") + "</div>" : "") + "</div>" +
      '<div class="ss151-evnote">Your careers carry on. The season board and the pass start fresh; the trophy case keeps everything.</div>' +
      '<div class="ss151-evbtns"><button class="btn" onclick="RIB_SEASONS.dismissEvent();seasonsOpenV151C(\'pass\')">🎟 See the new pass</button><button class="btn ghost" onclick="RIB_SEASONS.dismissEvent()">Let\'s go</button></div></div>';
    document.body.appendChild(el);
  }

  /* ---- the countdown chip on the hub's dock ---- */
  function hubChip() {
    var st = stateOf(), d = document.getElementById("dock");
    if (!st || st.view !== "hub" || !d || d.querySelector(".season-chip-v151c")) return;
    var c = seasonAt(now());
    d.insertAdjacentHTML("beforeend", '<button class="btn ghost season-chip-v151c" onclick="seasonsOpenV151C(\'pass\')">🎟 S' + esc(c.number) + " · " + c.daysLeft + "D · T" + tierOf(rec().xp) + "</button>");
  }

  /* ---- the look ---- */
  function css() {
    if (document.getElementById("ss151css")) return;
    var s = document.createElement("style"); s.id = "ss151css";
    s.textContent = [
      ".ss151-tabs,.ss151-subs,.lb151-mode{display:flex;gap:4px;margin:8px 0}.ss151-tabs button,.ss151-subs button,.lb151-mode button{flex:1;padding:8px 2px;border-radius:9px;border:1px solid var(--line,#2a2f3a);background:transparent;color:var(--chalk-dim,#9aa0aa);font:600 11px Oswald,sans-serif;letter-spacing:1px;cursor:pointer}",
      ".ss151-tabs button.on,.ss151-subs button.on,.lb151-mode button.on{border-color:var(--gold,#e6b23a);background:rgba(240,187,69,.13);color:var(--gold,#e6b23a)}",
      ".ss151-kick,.lb151-kick{font:600 9.5px Oswald,sans-serif;letter-spacing:2px;color:var(--gold,#e6b23a)}.ss151-name{font:700 22px Oswald,sans-serif}.ss151-dates{font-size:12px;color:var(--chalk-dim,#9aa0aa);margin:2px 0 6px}.ss151-left{color:#ff8a8a}",
      ".ss151-bar{display:block;height:6px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;margin:4px 0}.ss151-bar>i{display:block;height:100%;background:linear-gradient(90deg,#e6b23a,#ffd66b)}",
      ".ss151-mini{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;margin-top:6px}.ss151-dim{font-size:11px;color:var(--chalk-dim,#9aa0aa);font-weight:400}",
      ".ss151-ch{display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06)}.ss151-ch>div{flex:1;min-width:0}.ss151-ch b{font:600 13px Oswald,sans-serif}.ss151-ch small{display:block;font-size:11px;color:var(--chalk-dim,#9aa0aa)}.ss151-ch>span{text-align:right;flex:none}.ss151-ch.done b{color:#7fe0a0}",
      ".ss151-note,.lb151-note{font-size:11px;color:var(--chalk-dim,#9aa0aa);margin:8px 2px}.ss151-recap small,.ss151-hist small{display:block;font-size:11.5px;color:var(--chalk-dim,#9aa0aa)}.ss151-hist{padding:4px 0}",
      ".ss151-passhead{display:flex;gap:12px;align-items:center}.ss151-tier{text-align:center;flex:none}.ss151-tier b{font:700 34px Oswald,sans-serif;color:var(--gold,#e6b23a)}.ss151-tier small{display:block;font:600 9px Oswald,sans-serif;letter-spacing:1.5px;color:var(--chalk-dim,#9aa0aa)}.ss151-xp{flex:1;min-width:0;font-size:12px}",
      ".ss151-own{color:#7fe0a0;font:600 11px Oswald,sans-serif;letter-spacing:1px}.ss151-soon{color:var(--chalk-dim,#9aa0aa);font:600 10px Oswald,sans-serif;letter-spacing:1px}.ss151-buy{border:1px solid var(--gold,#e6b23a);background:rgba(240,187,69,.15);color:var(--gold,#e6b23a);border-radius:8px;padding:5px 8px;font:600 11px Oswald,sans-serif;cursor:pointer}",
      ".ss151-trackhead,.ss151-row{display:grid;grid-template-columns:26px 1fr 1fr;gap:5px;align-items:stretch}.ss151-trackhead{font:600 9.5px Oswald,sans-serif;letter-spacing:1.5px;color:var(--chalk-dim,#9aa0aa);padding:0 2px 4px}",
      ".ss151-row{padding:3px 0;opacity:.72}.ss151-row.unlocked{opacity:1}.ss151-row.next .ss151-n{color:var(--gold,#e6b23a)}.ss151-n{display:grid;place-items:center;font:700 14px Oswald,sans-serif}",
      ".ss151-rw{display:flex;flex-wrap:wrap;align-items:center;gap:3px 5px;min-width:0;padding:5px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)}.ss151-rw.none{justify-content:center;color:rgba(255,255,255,.2)}.ss151-rw>i{font-style:normal;font-size:16px}.ss151-rw>div{flex:1;min-width:0}.ss151-rw b{display:block;font:600 11px/1.15 Oswald,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ss151-rw small{display:block;font-size:9.5px;color:var(--chalk-dim,#9aa0aa);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".ss151-rw.r-rare{border-color:rgba(90,160,255,.35)}.ss151-rw.r-epic{border-color:rgba(255,150,60,.4)}.ss151-rw.r-legendary{border-color:rgba(255,214,107,.6);background:rgba(240,187,69,.07)}.ss151-rw.got{opacity:.6}",
      /* v153 G: the highlight every fifth tier and the showcase at the end */
      ".ss151-rw.r-mythic{border-color:rgba(255,90,140,.7);background:linear-gradient(135deg,rgba(255,90,140,.12),rgba(185,166,255,.1))}.ss151-row.hi .ss151-n{color:#ffd76f}.ss151-row.hi .ss151-rw{box-shadow:0 0 0 1px rgba(240,187,69,.25) inset}.ss151-row.show{padding:6px 0}.ss151-row.show .ss151-n{color:#ff8ab0;font-size:16px}.ss151-row.show .ss151-rw{box-shadow:0 0 12px rgba(255,90,140,.3)}",
      ".ss151-claim{flex:1 0 100%;border:0;border-radius:6px;padding:4px;background:linear-gradient(90deg,#f0bb45,#e0a02f);color:#0b111b;font:700 10.5px Oswald,sans-serif;letter-spacing:1px;cursor:pointer}.ss151-lock,.ss151-got{flex:1 0 100%;font:600 9.5px Oswald,sans-serif;letter-spacing:1px;color:var(--chalk-dim,#9aa0aa);text-align:center}.ss151-got{color:#7fe0a0}",
      ".ss151-case{display:grid;grid-template-columns:1fr 1fr;gap:6px}.ss151-tro{padding:8px;border-radius:9px;border:1px solid rgba(230,178,58,.3);background:rgba(240,187,69,.05);min-width:0}.ss151-tro i{font-style:normal;font-size:20px}.ss151-tro b{display:block;font:600 11.5px/1.2 Oswald,sans-serif;overflow-wrap:anywhere}.ss151-tro small{display:block;font-size:10px;color:var(--chalk-dim,#9aa0aa)}",
      ".ss151-profile.plain b{display:block;font:700 17px Oswald,sans-serif}.ss151-profile.plain small{color:var(--chalk-dim,#9aa0aa);font-size:12px}",
      ".ss151-event{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:16px;background:rgba(5,6,8,.78)}.ss151-event-in{width:100%;max-width:380px;max-height:calc(100dvh - 32px);overflow:auto;border-radius:16px;padding:18px;border:1px solid #e6b23a;background:radial-gradient(120% 80% at 50% -10%,rgba(240,187,69,.22),transparent 60%),#0e1013;color:#eef;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.6)}",
      ".ss151-evname{font:italic 700 28px Oswald,sans-serif;color:#ffd66b;margin:4px 0}.ss151-evsub{font-size:12px;color:#9aa0aa}.ss151-evrecap{margin:14px 0 8px;padding:10px;border-radius:10px;background:rgba(255,255,255,.04);font-size:13px;line-height:1.5}.ss151-evtro{display:flex;flex-direction:column;gap:3px;margin-top:6px;font-size:12px}.ss151-evnote{font-size:11.5px;color:#9aa0aa;margin-bottom:12px}.ss151-evbtns{display:flex;flex-direction:column;gap:8px}",
      ".lb151-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}.lb151-local{flex:none;margin-top:4px;padding:3px 7px;border-radius:6px;border:1px solid #ff8a8a;color:#ff8a8a;font:700 10px Oswald,sans-serif;letter-spacing:1.5px}",
      ".lb151-cats{display:flex;gap:5px;overflow-x:auto;padding:2px 0 6px;scrollbar-width:none}.lb151-cats::-webkit-scrollbar{display:none}.lb151-cat{flex:none;padding:6px 9px;border-radius:16px;border:1px solid var(--line,#2a2f3a);background:transparent;color:var(--chalk-dim,#9aa0aa);font:600 11px Oswald,sans-serif;white-space:nowrap;cursor:pointer}.lb151-cat.on{border-color:var(--gold,#e6b23a);color:#0b111b;background:var(--gold,#e6b23a)}",
      ".lb151-filters{display:flex;flex-direction:column;gap:5px;margin-bottom:6px}.lb151-posbar{display:flex;gap:3px}.lb151-pos{flex:1;padding:5px 0;border-radius:7px;border:1px solid var(--line,#2a2f3a);background:transparent;color:var(--chalk-dim,#9aa0aa);font:600 10.5px Oswald,sans-serif;cursor:pointer}.lb151-pos.on{color:var(--gold,#e6b23a);border-color:var(--gold,#e6b23a)}",
      ".lb151-adv{display:flex;gap:4px;align-items:center}.lb151-adv select{flex:1;min-width:0;padding:4px;border-radius:7px;background:#12151b;color:#dde;border:1px solid var(--line,#2a2f3a);font-size:11px}.lb151-adv.locked select{opacity:.45}.lb151-pro{flex:none;padding:2px 6px;border-radius:5px;background:var(--gold,#e6b23a);color:#0b111b;font:700 9.5px Oswald,sans-serif}",
      ".lb151-list{padding:4px 8px}.lb151-row{display:flex;align-items:center;gap:8px;cursor:pointer;min-width:0}.lb151-row.live{border:1px dashed rgba(255,138,138,.6);border-radius:9px;padding:4px}.lb151-who{flex:1;min-width:0}.lb151-who b{display:block;font:600 14px Oswald,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lb151-who small{display:block;font-size:10.5px;color:var(--chalk-dim,#9aa0aa);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lb151-hon{color:var(--gold,#e6b23a)!important}",
      ".lb151-card{flex:1;min-width:0;overflow:hidden}.lb151-val{flex:none;text-align:right}.lb151-val b{display:block;font:700 15px Oswald,sans-serif;color:var(--gold,#e6b23a)}.lb151-val small{font-size:9.5px;color:var(--chalk-dim,#9aa0aa)}",
      ".lb151-crest{flex:none;position:relative;width:30px;height:30px;border-radius:8px;overflow:hidden;display:block}.lb151-crest>i{position:absolute;inset:3px;display:block}",
      ".lb151-now{margin-bottom:6px}.lb151-sheet{position:fixed;inset:0;z-index:10050;display:flex;align-items:flex-end;justify-content:center;background:rgba(5,6,8,.72)}.lb151-sheet-in{width:100%;max-width:420px;max-height:88dvh;overflow:auto;padding:14px 14px calc(env(safe-area-inset-bottom) + 14px);border-radius:16px 16px 0 0;border-top:1px solid #e6b23a;background:#0e1013;color:#eef}",
      ".lb151-sheet-head{display:flex;gap:10px;align-items:center}.lb151-sheet-head b{display:block;font:700 18px Oswald,sans-serif}.lb151-sheet-head small{font-size:12px;color:#9aa0aa}.lb151-sheet-score{text-align:center;margin:10px 0}.lb151-sheet-score b{display:block;font:700 34px Oswald,sans-serif;color:#ffd66b}.lb151-sheet-score small{font:600 9.5px Oswald,sans-serif;letter-spacing:2px;color:#9aa0aa}",
      ".lb151-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;text-align:center}.lb151-stats b{display:block;font:700 15px Oswald,sans-serif}.lb151-stats small{font-size:8.5px;color:#9aa0aa}.lb151-tros{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0}.lb151-tros span{font-size:11px;padding:3px 6px;border-radius:6px;background:rgba(240,187,69,.08)}",
      ".lb151-parts{width:100%;margin:8px 0;font-size:12px;border-collapse:collapse}.lb151-parts td{padding:3px 2px;border-bottom:1px solid rgba(255,255,255,.06)}.lb151-parts td:last-child{text-align:right;color:#ffd66b}.lb151-sheet-btns{display:flex;gap:8px}.lb151-sheet-btns .btn{flex:1}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(s);
  }

  /* ---- boot: the rollover, the queue, the watchers ---- */
  try { css(); } catch (e) {}
  try { tick(); flush(); } catch (e) {}
  try { if (window.__SHELL_V146 && window.__SHELL_V146.titles) { window.__SHELL_V146.titles.seasons = "SEASON & PASS"; window.__SHELL_V146.titles.leaderboard = "LEADERBOARDS"; } } catch (e) {}
  setInterval(function () { try { observe(); eventCard(); hubChip(); } catch (e) {} }, 1500);
  try { new MutationObserver(function () { try { hubChip(); } catch (e) {} }).observe(document.getElementById("dock") || document.body, { childList: true }); } catch (e) {}
  /* the boot may have restored the saved view before this file existed (the 07 router draws the menu for it) */
  try { var st0 = stateOf(); if (st0 && st0.view === "seasons") setTimeout(function () { try { draw(); } catch (e) {} }, 0); } catch (e) {}
})();
