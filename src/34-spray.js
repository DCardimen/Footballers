/* ===== v170 THE SPRAY MENU — HOLD, SLIDE, SLIDE =====
 * Pages were split in half on a phone, each half scrolling on its own (training had four scroll boxes; the body tab,
 * the hub's TEAM, the profile card, settings and the Hall had two or three), and every section sat behind a tab strip.
 * Now a page is ONE page and anything is two slides away:
 *   - THE SPRAY: hold any button on the bottom bar (or swipe up off it) and its pages spray out in an arc above your
 *     thumb; slide onto one that has more (STATS, LIFE, PROFILE, LOCKER, LEADERBOARDS, SETTINGS) and ITS pages spray
 *     out from it; slide onto the page you want and let go. Let go without sliding and the spray stays open to tap.
 *     `TREE` maps every bar button to its pages (the hub's tabs and the life sim, the season's tabs and the stats, the
 *     skill groups or training's two pages, the tree with the path / dynasty / Hall, the menu with the profile,
 *     locker, goals, leaderboards and settings). A plain tap on a bar button still just goes there.
 *   - ONE PAGE, ONE SCROLL (phones, `html.one-v170`): the shell no longer squeezes lists into inner scroll boxes (25's
 *     `fit` stands down), tabs never fold into accordions (22's `fold`), the panel is the one scroller, and the
 *     section tab strip gives way to a SECTION BAR at the top of the page (‹ the section ›; tap it for the spray, swipe
 *     the page left / right to turn it). Training is two pages on a phone (22's `training` config): the board, and THE
 *     PICK, which a tap on a program turns to.
 *   - A one-time hint above the bar teaches the gesture (`rib.sprayHint.v170`, a per-device nicety).
 * Kill switches `v170spray` 0 (no spray) and `v170one` 0 (the v146 E fitted panel and the tab strip). `window.__V170`;
 * `spraycheck.mjs`. */
(function () {
  "use strict";
  function TU(k, d) { try { var t = window.RIB_TUNE; return t && t[k] !== undefined ? t[k] : d } catch (e) { return d } }
  var root = document.documentElement;
  function sprayOn() { return !!TU("v170spray", 1) }
  function oneOn() { return !!TU("v170one", 1) && root.classList.contains("phone-v169") }
  function S() { try { return window.S || null } catch (e) { return null } }
  function view() { var s = S(); return (s && s.view) || "" }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms) }) }

  /* ---------- where things are ---------- */
  function tabs() { return window.__HUB_V75 && window.__HUB_V75.tabs }
  function toSec(v, k) {
    return function () {
      var T = tabs(); if (T) T[v] = k;
      if (view() === v) { var b = document.querySelector('.hubv75-tab[data-sec="' + k + '"]'); if (b) { b.click(); return } }
      window.go(v);
    };
  }
  function toView(v) { return function () { window.go(v) } }
  function toStats(tab, sec) {
    if (sec === "odds" && !tab) tab = "leaders";   // PROMOTION is a tab of the LEADERS board
    return function () {
      var T = tabs(); if (T) T.stats = sec || "lead";
      if (view() !== "stats") window.go("stats");
      if (tab && window.setStatsTab) window.setStatsTab(tab);
      var b = document.querySelector('.hubv75-tab[data-sec="' + (sec || "lead") + '"]'); if (b && !b.classList.contains("on")) b.click();
    };
  }
  function toGroup(g) { return function () { window.__upGroupV97 = g; if (view() !== "upgrade") window.go("upgrade"); setTimeout(function () { try { window.upSegV153(g) } catch (e) {} }, 60) } }
  function toLife(tab) { return function () { try { window.showLifeV12(); if (tab) window.setLifeTabV12(tab) } catch (e) {} } }
  function toBoard(cat) { return function () { if (view() !== "leaderboard") window.go("leaderboard"); setTimeout(function () { try { cat && window.__lbCareerUI.cat(cat) } catch (e) {} }, 80) } }
  function lifeOpen() { var s = S(), p = s && s.player; return !!(p && (p.level >= 7 || p.financeV12)) }
  function N(icon, label, act, kids) { return { icon: icon, label: label, act: act, kids: kids || null } }

  var TREE = {
    hub: function () {
      return [N("🏈", "NOW", toSec("hub", "now")), N("🩹", "BODY", toSec("hub", "body")), N("📈", "ATTRIBUTES", toSec("hub", "skills")),
        N("🏟", "TEAM", toSec("hub", "team")), N("📖", "STORY", toSec("hub", "story"))].concat(lifeOpen() ?
        // the life sim (money, home, lifestyle, goals) is the UFF's: it joins the hub's spray from level 7
        [N("🌅", "LIFE", toLife(null), [N("🏠", "OVERVIEW", toLife("overview")), N("🛋", "LIFESTYLE", toLife("lifestyle")), N("🏡", "HOME", toLife("home")), N("📈", "INVEST", toLife("invest")), N("🎯", "GOALS", toLife("goals"))])] : []);
    },
    season: function () {
      return [N("📅", "SCHEDULE", toSec("season", "sched")), N("🏆", "LEAGUE", toSec("season", "league")), N("🎯", "OPPONENT", toSec("season", "opp")),
        N("🩹", "BODY", toSec("season", "body")), N("⚔️", "ROLE", toSec("season", "role")),
        N("📊", "STATS", toStats("leaders", "lead"), [N("🏅", "LEADERS", toStats("leaders", "lead")), N("🏟", "STANDINGS", toStats("standings", "lead")), N("🎯", "PROMOTION", toStats(null, "odds")), N("🥊", "RECRUITING", toView("rank"))])];
    },
    upgrade: function () {
      if (view() === "training") return [N("🏋️", "PROGRAMS", toSec("training", "progs")), N("✅", "THE PICK", toSec("training", "pick"))];
      return [N("💨", "PHYSICAL", toGroup("PHYSICAL")), N("🏈", "BALL SKILLS", toGroup("BALL SKILLS")), N("🧠", "MENTAL", toGroup("MENTAL"))];
    },
    shop: function () {
      return [N("🌳", "NODES", toSec("shop", "nodes")), N("🧠", "PERKS", toSec("shop", "perks")), N("🛤", "THE PATH", toView("path")),
        N("👑", "DYNASTY", toView("dynasty")), N("🏛️", "HALL OF FAME", toView("hof"))];
    },
    menu: function () {
      return [N("🏠", "MAIN MENU", toView("menu")),
        N("🪪", "PROFILE", toSec("profile", "card"), [N("🪪", "CARD", toSec("profile", "card")), N("🏆", "TROPHY CASE", toSec("profile", "case")), N("📖", "COLLECTION", toSec("profile", "book")), N("⏭", "SIMS", toSec("profile", "sims"))]),
        N("🎒", "LOCKER", toSec("locker", "gear"), [N("🎒", "GEAR", toSec("locker", "gear")), N("🎨", "STYLE", toSec("locker", "style"))]),
        N("🎯", "GOALS", toView("challenges")),
        N("🏆", "BOARDS", toBoard(null), [N("🏆", "ALL-TIME", toBoard("alltime")), N("📅", "SEASON", toBoard("season")), N("🗓", "WEEKLY", toBoard("weekly")), N("💍", "TITLES", toBoard("titles"))]),
        N("⚙️", "SETTINGS", toSec("settings", "game"), [N("🎮", "GAME", toSec("settings", "game")), N("🔊", "SOUND", toSec("settings", "sound")), N("📐", "FIELD", toSec("settings", "field")), N("💾", "SAVE", toSec("settings", "save"))])];
    }
  };
  // the current page's own sections, for the section bar's spray
  function pageTree() {
    return [].slice.call(document.querySelectorAll("#screen > .hubv75-tabs .hubv75-tab")).map(function (t) {
      var iEl = t.querySelector("i"), icon = (iEl && iEl.innerHTML) || "•", name = (t.textContent || "").replace((iEl && iEl.textContent) || "", "").trim();   // v193 V: the icon's markup
      return N(icon, name, function () { t.click() });
    });
  }

  /* ---------- the spray ---------- */
  var M = null;   // the open spray: { el, svg, origin, ring1, ring2, hi, parent, mode, dwell }
  var HIT = 46, BUB = 60;
  function clampPt(x, y) { var m = 36; return { x: Math.max(m, Math.min(innerWidth - m, x)), y: Math.max(m + 40, Math.min(innerHeight - 60, y)) } }
  function bubble(node, p, cls, i) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "spr-b " + (cls || "") + (node.kids ? " more" : "");
    // v193 V: a page named by its emoji wears the menu-style icon for it (src/24-bottom-nav.js); markup passes through
    var ic = node.icon;
    try { if (window.ribIconV193V && !/</.test(ic)) ic = window.ribIconV193V(ic, ic) } catch (e) {}
    b.innerHTML = "<i>" + ic + "</i><b>" + node.label + "</b>";
    b.style.setProperty("--x", p.x + "px"); b.style.setProperty("--y", p.y + "px");
    b.style.transitionDelay = (i * 22) + "ms";
    b.__node = node; b.__p = p;
    b.addEventListener("click", function (e) { e.stopPropagation(); if (M && M.mode === "tap") choose(b) });
    M.el.appendChild(b);
    requestAnimationFrame(function () { b.classList.add("in") });
    return b;
  }
  function open(origin, nodes, mode, dir) {
    close(true);
    if (!nodes || !nodes.length) return;
    var el = document.createElement("div"); el.id = "sprayV170"; el.setAttribute("role", "menu");
    el.innerHTML = '<div class="spr-back"></div><svg class="spr-line"><line x1="0" y1="0" x2="0" y2="0"/></svg><div class="spr-core"></div>';
    el.style.setProperty("--ox", origin.x + "px"); el.style.setProperty("--oy", origin.y + "px");
    document.body.appendChild(el);
    M = { el: el, origin: origin, ring1: [], ring2: [], hi: null, parent: null, mode: mode, moved: 0, dwell: null };
    /* the RAINBOW: whichever button you hold, the pages spray onto an arc centred on the screen (an ellipse that fits
     * the phone's width), so the edge buttons never pile their pages against the edge. dir 90 = a downward rainbow
     * (the section bar at the top). The line runs from your thumb's button to your finger. */
    var down = dir === 90, W = innerWidth, cx = W / 2;
    var cy = down ? origin.y + 8 : origin.y - 4;
    var rx = Math.min(W / 2 - 44, 150), ry = Math.min(150, innerHeight * 0.3);
    var n = nodes.length, span = n <= 1 ? 0 : Math.min(170, 36 * (n - 1) + 24), mid = down ? 90 : 270;
    M.geo = { cx: cx, cy: cy, rx: rx, ry: ry, down: down };
    nodes.forEach(function (nd, i) {
      var a = (mid - span / 2 + (n > 1 ? span * i / (n - 1) : 0)) * Math.PI / 180;
      M.ring1.push(bubble(nd, clampPt(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry), "r1", i));
      M.ring1[i].__a = a;
    });
    el.querySelector(".spr-back").addEventListener("click", function () { if (M && M.mode === "tap") close() });
    requestAnimationFrame(function () { el.classList.add("on") });
    try { navigator.vibrate && navigator.vibrate(12) } catch (e) {}
    root.classList.add("spray-open-v170");
  }
  function openKids(b) {
    if (!M || !b.__node.kids || M.parent === b) return;
    M.ring2.forEach(function (k) { k.remove() }); M.ring2 = [];
    M.parent = b;
    M.ring1.forEach(function (x) { x.classList.toggle("dim", x !== b); x.classList.toggle("open", x === b) });
    // the outer arc: the parent's pages fan out beyond it on a wider ellipse, centred on its angle and kept clear of the
    // ends of the arc
    var G = M.geo, kids = b.__node.kids, k = kids.length;
    var rx2 = innerWidth / 2 - 34, ry2 = G.ry + 104, step = 30, span = step * (k - 1);
    var lo = G.down ? 35 : 215, hi = G.down ? 145 : 325, c = b.__a * 180 / Math.PI;
    c = Math.max(lo + span / 2, Math.min(hi - span / 2, c));
    kids.forEach(function (nd, i) {
      var a = (c - span / 2 + step * i) * Math.PI / 180;
      M.ring2.push(bubble(nd, clampPt(G.cx + Math.cos(a) * rx2, G.cy + Math.sin(a) * ry2), "r2", i));
    });
    try { navigator.vibrate && navigator.vibrate(8) } catch (e) {}
  }
  function nearest(x, y) {
    var best = null, bd = HIT;
    (M.ring2.concat(M.ring1)).forEach(function (b) { var d = Math.hypot(b.__p.x - x, b.__p.y - y); if (d < bd - (b.classList.contains("r2") ? 4 : 0)) { bd = d; best = b } });
    return best;
  }
  function track(x, y) {
    if (!M) return;
    var ln = M.el.querySelector(".spr-line line"); ln.setAttribute("x1", M.origin.x); ln.setAttribute("y1", M.origin.y); ln.setAttribute("x2", x); ln.setAttribute("y2", y);
    M.moved = Math.max(M.moved, Math.hypot(x - M.origin.x, y - M.origin.y));
    var b = nearest(x, y);
    /* with a page's own pages open, sliding ACROSS the first arc on the way to them changes nothing: another first-arc
     * bubble takes over only if the finger rests on it (sprayCrossMsV170) */
    if (M.parent && b && b.classList.contains("r1") && b !== M.parent) {
      if (M.cross !== b) { M.cross = b; M.crossAt = Date.now() }
      if (Date.now() - M.crossAt < TU("sprayCrossMsV170", 240)) { clearTimeout(M.crossT); M.crossT = setTimeout(function () { if (M && M.cross === b) track(x, y) }, TU("sprayCrossMsV170", 240) + 10); b = M.hi && M.hi.classList.contains("r2") ? null : M.parent }
    } else M.cross = null;
    if (b !== M.hi) {
      if (M.hi) M.hi.classList.remove("hi");
      M.hi = b; clearTimeout(M.dwell);
      if (b) {
        b.classList.add("hi");
        try { navigator.vibrate && navigator.vibrate(6) } catch (e) {}
        if (b.__node.kids) M.dwell = setTimeout(function () { openKids(b) }, TU("sprayDwellV170", 170));
        else if (b.classList.contains("r1") && M.parent && b !== M.parent) { M.ring2.forEach(function (k) { k.remove() }); M.ring2 = []; M.parent = null; M.ring1.forEach(function (x) { x.classList.remove("dim", "open") }) }
      }
    }
  }
  function choose(b) {
    if (!b) return close();
    var n = b.__node;
    if (n.kids && M.mode === "tap" && M.parent !== b) { openKids(b); return }
    var act = n.act; close();
    try { act && act() } catch (e) {}
    try { navigator.vibrate && navigator.vibrate(14) } catch (e) {}
  }
  function close(now) {
    if (!M) return;
    var el = M.el; clearTimeout(M.dwell); M = null;
    root.classList.remove("spray-open-v170");
    if (now) { el.remove(); return }
    el.classList.remove("on"); el.classList.add("out"); setTimeout(function () { el.remove() }, 200);
  }

  /* ---------- the bar's gesture ---------- */
  var P = null, swallow = 0;   // until when the click that ends a hold is swallowed
  function navBtn(t) { return t && t.closest && t.closest("#navV139 button[data-k]") }
  document.addEventListener("pointerdown", function (e) {
    if (!sprayOn()) return;
    var b = navBtn(e.target); if (!b || (e.button && e.button !== 0)) return;
    var r = b.getBoundingClientRect();
    P = { id: e.pointerId, x: e.clientX, y: e.clientY, b: b, origin: { x: r.left + r.width / 2, y: r.top + 6 } };
    P.timer = setTimeout(function () { fire() }, TU("sprayHoldMsV170", 260));
  }, true);
  function fire() {
    if (!P || M) return;
    clearTimeout(P.timer);
    var k = P.b.dataset.k, f = TREE[k];
    swallow = Date.now() + 100000;   // set for real when the hold ends
    open(P.origin, f ? f() : [], "drag");
  }
  document.addEventListener("pointermove", function (e) {
    if (!P || e.pointerId !== P.id) return;
    if (!M) { if (P.y - e.clientY > 16 || Math.hypot(e.clientX - P.x, e.clientY - P.y) > 22) fire(); return }   // a swipe up off the bar opens it at once
    if (M.mode === "drag") { e.preventDefault(); track(e.clientX, e.clientY) }
  }, { capture: true, passive: false });
  function up(e) {
    if (!P || (e && e.pointerId !== P.id)) return;
    clearTimeout(P.timer); P = null;
    if (swallow > Date.now()) swallow = Date.now() + 400;   // a hold just ended: only the click this very release makes (it may never come — the spray is under the finger)
    if (!M || M.mode !== "drag") return;
    if (M.hi) { choose(M.hi); return }
    if (M.moved < 30) { M.mode = "tap"; M.el.classList.add("tap"); return }   // held and let go in place: the spray stays to tap
    close();
  }
  document.addEventListener("pointerup", up, true);
  document.addEventListener("pointercancel", function (e) { if (P && e.pointerId === P.id) { clearTimeout(P.timer); P = null; if (M && M.mode === "drag") { M.mode = "tap"; M.el.classList.add("tap") } } }, true);
  // the click that ends a hold is not a tap on the bar
  document.addEventListener("click", function (e) { if (swallow > Date.now() && navBtn(e.target)) { swallow = 0; e.stopImmediatePropagation(); e.preventDefault() } }, true);
  document.addEventListener("contextmenu", function (e) { if (navBtn(e.target)) e.preventDefault() }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && M) close() });

  /* ---------- one page, one scroll: the section bar and the swipe ---------- */
  function classes() {
    var o = oneOn();
    if (root.classList.contains("one-v170") !== o) root.classList.toggle("one-v170", o);
    return o;
  }
  function secbar() {
    var scr = document.getElementById("screen"); if (!scr) return;
    var tabsEl = scr.querySelector(":scope > .hubv75-tabs"), bar = scr.querySelector(":scope > .secbar-v170");
    /* v171 B: ONE bar, ever. A layer that re-parents #screen's children (the sectioner adopting strays, a
     * re-split) used to carry the bar into a section, the query above stopped seeing it and a new one went
     * in on every pass — the tree grew a column of NODES bars. Every bar that is not the direct child goes. */
    [].slice.call(document.querySelectorAll(".secbar-v170")).forEach(function (b) { if (b !== bar) b.remove() });
    if (!classes() || !tabsEl) { if (bar) bar.remove(); return }
    var all = [].slice.call(tabsEl.querySelectorAll(".hubv75-tab")), on = tabsEl.querySelector(".hubv75-tab.on") || all[0];
    if (!on) return;
    // v193 V: the tab's icon is markup now (the menu-style set's <img>/<svg>, or the emoji under TU v193V 0) — carry it whole
    var i = all.indexOf(on), iEl = on.querySelector("i"), icon = iEl ? iEl.innerHTML : "", name = (on.textContent || "").replace((iEl && iEl.textContent) || "", "").trim();
    var sig = view() + "|" + on.dataset.sec + "|" + all.length + "|" + icon.length;
    if (bar && bar.dataset.sig === sig) return;
    if (!bar) {
      bar = document.createElement("div"); bar.className = "secbar-v170";
      bar.innerHTML = '<button type="button" class="sb-prev" aria-label="Previous section">‹</button><button type="button" class="sb-mid"></button><button type="button" class="sb-next" aria-label="Next section">›</button>';
      bar.addEventListener("click", function (e) {
        var t = e.target.closest("button"); if (!t) return;
        var list = [].slice.call(scr.querySelectorAll(":scope > .hubv75-tabs .hubv75-tab")), cur = list.findIndex(function (x) { return x.classList.contains("on") });
        if (t.classList.contains("sb-prev") && cur > 0) turn(list[cur - 1], -1);
        else if (t.classList.contains("sb-next") && cur < list.length - 1) turn(list[cur + 1], 1);
        else if (t.classList.contains("sb-mid")) { var r = t.getBoundingClientRect(); open({ x: r.left + r.width / 2, y: r.bottom - 4 }, pageTree(), "tap", 90); if (M) M.el.classList.add("tap") }
      });
      scr.insertBefore(bar, scr.firstChild);
    }
    bar.dataset.sig = sig;
    bar.querySelector(".sb-mid").innerHTML = "<i>" + icon + "</i><b>" + name + "</b><span>" + all.map(function (t, j) { return "<u" + (j === i ? ' class="on"' : "") + "></u>" }).join("") + "</span><em>▾</em>";
    bar.querySelector(".sb-prev").disabled = i <= 0; bar.querySelector(".sb-next").disabled = i >= all.length - 1;
  }
  function turn(tab, dir) {
    tab.click();
    secbar();
    var sec = document.querySelector("#screen > .hubv75-sec.on");
    if (sec) { sec.classList.remove("slide-l-v170", "slide-r-v170"); void sec.offsetWidth; sec.classList.add(dir > 0 ? "slide-l-v170" : "slide-r-v170") }
    try { document.getElementById("screen").scrollTop = 0 } catch (e) {}
  }
  var SW = null;
  document.addEventListener("touchstart", function (e) {
    if (!root.classList.contains("one-v170") || e.touches.length !== 1) return;
    var t = e.target; if (!t.closest || !t.closest("#screen") || t.closest(".chips,.lb151,.qa-row-v146,input,select,textarea,.cos-grid-v151b,[data-noswipe]")) return;
    /* ===== v193 I EVERY SHEET, EVERY PHONE =====
     * a sideways swipe on a row that scrolls sideways (the locker's gear filter chips, the tree's SPEND NOW chips, any
     * overflow-x row) is that row's own scroll — it used to turn the section too (GEAR → the next tab, the chips lost).
     * scripts/v193Mcheck.mjs swipes them with real touch events. Off: TU v193I 0. */
    if (TU("v193I", 1)) for (var el = t; el && el.id !== "screen"; el = el.parentElement) {
      var ox = getComputedStyle(el).overflowX;
      if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 1) return;
    }
    SW = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (!SW) return; var s = SW; SW = null;
    var c = e.changedTouches[0], dx = c.clientX - s.x, dy = c.clientY - s.y;
    if (Date.now() - s.t > 650 || Math.abs(dx) < 70 || Math.abs(dy) > 45) return;
    var list = [].slice.call(document.querySelectorAll("#screen > .hubv75-tabs .hubv75-tab")), cur = list.findIndex(function (x) { return x.classList.contains("on") });
    if (cur < 0) return;
    if (dx < 0 && cur < list.length - 1) turn(list[cur + 1], 1);
    else if (dx > 0 && cur > 0) turn(list[cur - 1], -1);
  }, { passive: true });
  // a tap on a training program turns to THE PICK (on a phone the board and the pick are two pages)
  document.addEventListener("click", function (e) {
    if (!root.classList.contains("one-v170") || view() !== "training") return;
    if (!e.target.closest || !e.target.closest(".tp-tile-v113")) return;
    var T = tabs(); if (T) T.training = "pick";
    setTimeout(function () { var b = document.querySelector('.hubv75-tab[data-sec="pick"]'); if (b && !b.classList.contains("on")) turn(b, 1) }, 60);
  }, true);

  /* ---------- the hint ---------- */
  function hint() {
    if (!sprayOn() || document.getElementById("sprayHintV170")) return;
    var nav = document.getElementById("navV139"); if (!nav || !nav.classList.contains("on") || !nav.getBoundingClientRect().height) return;
    if (document.querySelector(".decision-overlay,#verdictV179,#pgOverlayV13")) return;   // a choice is on screen (the medal chooser, the verdict, the post-game card): the one-time hint waits for a clear screen
    var seen = "1"; try { seen = localStorage.getItem("rib.sprayHint.v170") || "" } catch (e) {}
    if (seen) return;
    try { localStorage.setItem("rib.sprayHint.v170", "1") } catch (e) {}
    var h = document.createElement("div"); h.id = "sprayHintV170";
    h.innerHTML = "<b>☝️ HOLD &amp; SLIDE</b><span>Hold any button below, slide to a page, let go.</span>";
    h.style.bottom = (innerHeight - nav.getBoundingClientRect().top + 10) + "px";
    document.body.appendChild(h);
    setTimeout(function () { h.classList.add("out"); setTimeout(function () { h.remove() }, 400) }, TU("sprayHintMsV170", 5200));
  }

  var CSS = [
    "#navV139 button{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;touch-action:none}",
    "#sprayV170{position:fixed;inset:0;z-index:2147480500;pointer-events:auto;touch-action:none}",
    "#sprayV170 .spr-back{position:absolute;inset:0;background:radial-gradient(circle at var(--ox) var(--oy),rgba(230,178,58,.16),rgba(6,7,9,.78) 46%,rgba(4,5,7,.9));opacity:0;transition:opacity .18s ease;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}",
    "#sprayV170.on .spr-back{opacity:1}#sprayV170.out .spr-back{opacity:0}",
    "#sprayV170 .spr-core{position:absolute;left:var(--ox);top:var(--oy);width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;background:#ffd66b;box-shadow:0 0 0 6px rgba(255,214,107,.18),0 0 24px rgba(255,214,107,.7);transform:scale(.2);transition:transform .2s cubic-bezier(.2,1.6,.4,1)}",
    "#sprayV170.on .spr-core{transform:scale(1)}#sprayV170.tap .spr-core{opacity:.5}",
    "#sprayV170 .spr-line{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}",
    "#sprayV170 .spr-line line{stroke:rgba(255,214,107,.55);stroke-width:2.5;stroke-linecap:round;stroke-dasharray:2 7}",
    "#sprayV170.tap .spr-line{display:none}",
    "#sprayV170 .spr-b{position:absolute;left:0;top:0;width:" + BUB + "px;height:" + BUB + "px;margin:0;padding:0;border-radius:50%;border:1.5px solid rgba(230,178,58,.6);cursor:pointer;" +
      "background:radial-gradient(circle at 35% 28%,#2a2f38,#15171b 70%);box-shadow:0 10px 24px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.08);color:#f2f3f5;" +
      "transform:translate(calc(var(--ox) - 50%),calc(var(--oy) - 50%)) scale(.25);opacity:0;transition:transform .26s cubic-bezier(.2,1.4,.4,1),opacity .18s ease,box-shadow .12s,border-color .12s}",
    "#sprayV170 .spr-b.in{transform:translate(calc(var(--x) - 50%),calc(var(--y) - 50%)) scale(1);opacity:1}",
    "#sprayV170 .spr-b i{display:block;font-style:normal;font-size:25px;line-height:1}",
    "#sprayV170 .spr-b b{position:absolute;left:50%;top:calc(100% + 5px);transform:translateX(-50%);white-space:nowrap;font:700 12px Oswald,sans-serif;letter-spacing:1.2px;color:#f2f3f5;text-shadow:0 2px 6px #000,0 0 2px #000;pointer-events:none}",
    "#sprayV170 .spr-b.more:after{content:'';position:absolute;right:2px;top:2px;width:12px;height:12px;border-radius:50%;background:#e6b23a;box-shadow:0 0 0 2px #15171b}",
    "#sprayV170 .spr-b.hi{transform:translate(calc(var(--x) - 50%),calc(var(--y) - 50%)) scale(1.22);border-color:#ffd66b;box-shadow:0 0 0 4px rgba(255,214,107,.25),0 0 26px rgba(255,214,107,.55),0 12px 28px rgba(0,0,0,.6)}",
    "#sprayV170 .spr-b.hi b{color:#ffd66b}",
    "#sprayV170 .spr-b.dim{opacity:.32}",
    "#sprayV170 .spr-b.open{border-color:#ffd66b;background:radial-gradient(circle at 35% 28%,#4a3a18,#1c1a14 70%)}",
    "#sprayV170 .spr-b.r2{width:54px;height:54px;border-color:rgba(255,214,107,.75)}",
    "#sprayV170 .spr-b.r2 i{font-size:22px}",
    "#sprayV170.out .spr-b{opacity:0;transition-delay:0ms!important}",
    /* one page, one scroll */
    "html.one-v170 .hubv75-tabs{display:none!important}",
    "html.one-v170 #screen .fill-v146{max-height:none!important;overflow:visible!important}",
    "html.one-v170 .tp-grid-v113{max-height:none!important;overflow:visible!important}",
    "html.one-v170 #screen > .tp-panel-v113,html.one-v170 #screen .hubv75-sec > .tp-panel-v113{max-height:none!important;overflow:visible!important}",
    ".secbar-v170{position:sticky;top:-8px;z-index:6;display:grid;grid-template-columns:44px 1fr 44px;align-items:center;gap:6px;margin:-8px -10px 8px;padding:6px 8px;background:linear-gradient(180deg,#0e1013 70%,rgba(14,16,19,.92));border-bottom:1px solid rgba(230,178,58,.28)}",
    ".secbar-v170 button{min-height:40px;border-radius:11px;border:1px solid rgba(230,178,58,.3);background:linear-gradient(180deg,#1d2026,#15171b);color:#ffd66b;cursor:pointer}",
    ".secbar-v170 .sb-prev,.secbar-v170 .sb-next{font:700 24px/1 Oswald,sans-serif;padding:0}",
    ".secbar-v170 button:disabled{opacity:.3;cursor:default}",
    ".secbar-v170 .sb-mid{display:flex;align-items:center;justify-content:center;gap:8px;padding:4px 10px}",
    ".secbar-v170 .sb-mid i{font-style:normal;font-size:19px}",
    ".secbar-v170 .sb-mid b{font:700 16px Oswald,sans-serif;letter-spacing:1.6px;color:#fff}",
    ".secbar-v170 .sb-mid span{display:flex;gap:4px;margin-left:4px}",
    ".secbar-v170 .sb-mid u{display:block;width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.22)}",
    ".secbar-v170 .sb-mid u.on{background:#ffd66b;box-shadow:0 0 6px rgba(255,214,107,.7)}",
    ".secbar-v170 .sb-mid em{font-style:normal;font-size:13px;color:#e6b23a}",
    ".slide-l-v170{animation:slideLV170 .24s ease-out}.slide-r-v170{animation:slideRV170 .24s ease-out}",
    "@keyframes slideLV170{from{opacity:.2;transform:translateX(28px)}to{opacity:1;transform:none}}",
    "@keyframes slideRV170{from{opacity:.2;transform:translateX(-28px)}to{opacity:1;transform:none}}",
    /* the hint */
    "#sprayHintV170{position:fixed;left:50%;transform:translateX(-50%);z-index:2147480400;display:flex;flex-direction:column;align-items:center;gap:2px;padding:9px 16px;border-radius:14px;border:1px solid rgba(230,178,58,.6);background:linear-gradient(180deg,#22252c,#15171b);box-shadow:0 12px 30px rgba(0,0,0,.6);color:#f2f3f5;pointer-events:none;animation:hintInV170 .35s ease-out;transition:opacity .35s}",
    "#sprayHintV170 b{font:700 14px Oswald,sans-serif;letter-spacing:1.6px;color:#ffd66b}",
    "#sprayHintV170 span{font:500 14px 'Barlow Condensed',sans-serif;white-space:nowrap}",
    "#sprayHintV170.out{opacity:0}",
    "@keyframes hintInV170{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}",
    "@media (prefers-reduced-motion:reduce){#sprayV170 .spr-b,.slide-l-v170,.slide-r-v170{transition:none!important;animation:none!important}}"
  ].join("\n");
  function css() { if (document.getElementById("sprayCssV170")) return; var s = document.createElement("style"); s.id = "sprayCssV170"; s.textContent = CSS; document.head.appendChild(s) }

  // a tab turned anywhere (22 toggles classes, which the observer below does not see) renames the bar at once
  document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest(".hubv75-tab")) setTimeout(secbar, 0) });
  var queued = false;
  function run() { queued = false; try { css(); classes(); secbar(); hint() } catch (e) {} }
  function queue() { if (queued) return; queued = true; requestAnimationFrame(run) }
  try { new MutationObserver(queue).observe(document.body, { childList: true, subtree: true }) } catch (e) {}
  addEventListener("resize", queue);
  setInterval(queue, 800);
  css();
  window.__V170 = { tree: TREE, open: function (k) { var b = document.querySelector('#navV139 button[data-k="' + k + '"]'); if (!b) return false; var r = b.getBoundingClientRect(); open({ x: r.left + r.width / 2, y: r.top + 6 }, TREE[k](), "tap"); if (M) M.el.classList.add("tap"); return true },
    close: function () { close(true) }, isOpen: function () { return !!M }, bubbles: function () { return M ? M.ring1.concat(M.ring2).map(function (b) { return b.__node.label }) : [] }, oneOn: oneOn };
})();
