
/* ===== v146 E THE MENUS LIVE AT THE BOTTOM, AND NOTHING SCROLLS =====
 * A phone showed the hub with its section tabs at the TOP of the page, the week's buttons and a
 * rumour line and two more buttons stacked at the BOTTOM over the v139 bar, and a page that
 * scrolled under both — "the menus are all jumbled, some at the top some on bottom", and the
 * prestige tree's five full-width buttons took half the screen. And a screen would open halfway
 * down, because the page (`#app`, the element that actually scrolls — html and body are
 * overflow:hidden) was never put back at the top when `go()` drew a new view into it: every view
 * inherited the last one's scroll, and the v75 tab strip's `scrollIntoView` pushed it further.
 *
 * So there is ONE shell now, built off the main menu's own frame, and every career screen sits in
 * it (everything but the broadcast and the main menu itself):
 *   - TOP, fixed: the menu's crest and wordmark with the screen's name under it, the honors / PP
 *     chip and the kit button (`.topbar`, restyled), and the career's own headlines running under
 *     it (`#tickV146`, the menu's v132 ticker built off the same feed, `__RIB_MENU_DATA_V89`).
 *   - MIDDLE: `#screen`, the one panel. The page never scrolls — `#app` is the viewport exactly.
 *     A long list (the schedule, a leaders board, the Hall) is shortened to the room that is left
 *     and scrolls inside its own box (`fitV146`), so the panel itself fits.
 *   - BOTTOM, fixed, from the thumb up: the v139 bar, the screen's section tabs (the v75 strip —
 *     NOW / BODY / SKILLS / TEAM / STORY, the season's four, the tree's two, Settings' five —
 *     lifted out of the top of the page), and the ACTION SLOT (`.dock`): the screen's one primary
 *     button full width, and every other button a slim chip on one row.
 * Nothing is re-rendered and no handler moves: the tabs stay inside #screen (position:fixed), the
 * dock keeps its markup and only gains `qa-main-v146` / `qa-chip-v146`. The career block's last `q`
 * wrapper calls `shellPreV146` / `shellPostV146` (hoisted there), which is what puts every view —
 * and the boot's restore, and v140's deferred retry — back at the top of every scroller it owns.
 * `window.__SHELL_V146`; `v146Echeck.mjs`, `v146Eshot.mjs`. */
(function () {
  var OFF = { live: 1, menu: 1, highscore: 1, daily: 1 };   // v151 C: the leaderboards (career + Score Attack) and the season screen sit in the shell
  var TITLE = { hub: "CAREER HUB", season: "THE SEASON", training: "OFFSEASON TRAINING", upgrade: "SKILLS", shop: "PRESTIGE TREE",
    settings: "SETTINGS", stats: "STATS & LEADERS", challenges: "GOALS", hof: "HALL OF FAME", locker: "LOCKER", profile: "PROFILE", legacy: "LEGACY",
    dynasty: "DYNASTY", rank: "RECRUITING BOARD", result: "SEASON REPORT", declineResult: "SEASON REPORT", event: "STORY WEEK", sim: "THE SEASON",
    life: "LIFE", roster: "ROSTER", path: "THE PATH", tier: "THE NEXT LEVEL", gameover: "CAREER OVER", win: "CHAMPION", choosePos: "NEW CAREER", leaderboard: "LEADERBOARDS", seasons: "SEASON & PASS" };
  var NO_MAIN = { shop: 1 };                       // the tree's buttons are all doors; the TREE is the screen
  /* what may scroll inside itself when a screen will not fit, most specific first: the named lists,
   * then the open accordion's body, then the one big card or block the screen is made of */
  var FILL = [".cos-grid-v151b", ".gear-list-v147", ".sched-list", ".tp-rows-v113", "#screen > .tp-panel-v113", ".up-group-v97.on .up-group-body-v97", ".hubv97-fold.on > .hubv97-body",
    '.hubv75-sec.on[data-sec="nodes"] > div:not(.btn-row)', ".hof-list,.lb-list,.leaders-list,.standings-list",
    ".hubv75-sec.on > .card", "#screen > .mt", "#screen > .card", ".hubv75-sec.on > *"];
  var FILL_MIN = 110;
  var root = document.documentElement;
  function S() { try { return window.S || (window.__GRIDIRON_AUDIT__ && window.__GRIDIRON_AUDIT__.getState()) || null } catch (e) { return null } }
  function view() { var s = S(); return (s && s.view) || "" }
  function on() { return root.classList.contains("shell-v146") }
  function $(id) { return document.getElementById(id) }

  /* the top: the crest, the wordmark and the screen's name */
  function brand() {
    var lg = document.querySelector(".topbar .logo"); if (!lg || lg.querySelector(".brand-v146")) return;
    lg.insertAdjacentHTML("afterbegin", '<span class="rib-mark-v146">RIB</span><div class="brand-v146"><b>RUNNING IT BACK</b><small id="shellTitleV146"></small></div>');
    lg.addEventListener("click", function () { try { window.go("menu") } catch (e) {} });
  }
  function title(v) {
    var t = $("shellTitleV146"); if (!t) return;
    var s = S(), pl = s && s.player, lv = "";
    try { lv = pl && window.__GRIDIRON_AUDIT__.LEVELS[pl.level].name } catch (e) {}
    var txt = (TITLE[v] || String(v || "").toUpperCase()) + (lv ? " · " + String(lv).toUpperCase() : "");
    if (t.textContent !== txt) t.textContent = txt;
    var tt = $("tickTitleV153"), short = TITLE[v] || String(v || "").toUpperCase();   // v153 E: the screen's name on the ticker's left end
    if (tt && tt.textContent !== short) tt.textContent = short;
  }
  /* the menu's ticker, off the menu's own feed */
  var lastTick = "";
  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] }) }
  function tickItems() {
    var d = null; try { d = window.__RIB_MENU_DATA_V89 && window.__RIB_MENU_DATA_V89() } catch (e) {}
    if (!d) return null;
    var st = d.state || {}, pl = d.player || {}, se = d.season || { weeks: [] }, tm = d.team || {}, it = [];
    var add = function (h, c) { it.push('<li class="' + (c || "") + '">' + h + "</li>") };
    if (d.hasCareer && pl.name) {
      var num = ""; try { num = window.__RIB_MENU_V89.jerseyFor(pl.name, pl.pos) } catch (e) {}
      var yr = (pl.totalSeasons || 0) + 1, wk = se.nextWeek || ((se.played || 0) + 1);
      add("<b>" + esc(String(pl.name).toUpperCase()) + "</b> " + esc(pl.pos) + (num !== "" ? " #" + esc(num) : ""));
      add(esc(String(pl.levelName || "").toUpperCase()) + " · YEAR " + yr + " · WEEK " + esc(wk));
      if (tm.school || tm.name) add("<b>" + esc(String((tm.school || "") + " " + (tm.name || "")).trim().toUpperCase()) + "</b>");
      if (se.nextOpp) add("NEXT UP · <b>vs " + esc(String(se.nextOpp).toUpperCase()) + "</b>", "live");
      if (se.last) add(se.last.sat ? "LAST WEEK · <b>DID NOT PLAY</b>" : "LAST WEEK · <b>" + (se.last.won ? "W" : "L") + " " + esc(se.last.us) + "-" + esc(se.last.them) + "</b> vs " + esc(String(se.last.opp || "").toUpperCase()));
      var pw = (se.weeks || []).filter(function (w) { return w.played }); if (pw.length) { var won = pw.filter(function (w) { return w.won }).length; add("RECORD <b>" + won + "-" + (pw.length - won) + "</b>") }
      if (pl.ovr != null) add("OVR <b>" + esc(pl.ovr) + "</b>");
      if (pl.stars) add("<b>" + "★".repeat(Math.max(0, Math.min(5, pl.stars))) + "</b> RECRUIT");
    }
    add("HONORS <b>" + esc(st.prestige || 0) + "</b> · PP <b>" + esc(st.pp || 0) + "</b>");
    if (st.lineage && st.lineage.gen && st.lineage.surname) add("THE " + esc(String(st.lineage.surname).toUpperCase()) + " LINE · <b>GEN " + esc(st.lineage.gen) + "</b>");
    if (st.careers) add("<b>" + esc(st.careers) + "</b> CAREER" + (st.careers === 1 ? "" : "S") + " PLAYED");
    add("<b>RUNNING IT BACK</b> · CAREER MODE");
    return it;
  }
  function ticker() {
    var app = $("app"), top = document.querySelector("#app > .topbar"); if (!app || !top) return;
    var el = $("tickV146");
    if (!el) { el = document.createElement("div"); el.id = "tickV146"; el.setAttribute("aria-hidden", "true"); top.insertAdjacentElement("afterend", el) }
    var it = tickItems(); if (!it) return;
    var html = '<ul style="--dur:' + Math.max(26, it.length * 4.2) + 's">' + it.join("") + it.join("") + "</ul>";
    if (html !== lastTick) { lastTick = html; el.innerHTML = html; el.dataset.items = it.length }
    if (!$("tickTitleV153")) { var lab = document.createElement("b"); lab.id = "tickTitleV153"; el.appendChild(lab); title(view()) }
  }

  /* the action slot: one primary, the rest chips */
  var arranging = false;
  function dock() {
    var d = $("dock"); if (!d || arranging) return;
    arranging = true;
    try {
      var v = view(), btns = [].slice.call(d.querySelectorAll("button,.btn,a[onclick]"));
      var main = null;
      if (!NO_MAIN[v]) main = btns.filter(function (b) { return b.classList.contains("btn") && !b.classList.contains("ghost") && !b.classList.contains("secondary") })[0] || null;   // a lone BACK is a chip, not the screen's big button
      btns.forEach(function (b) {
        if (b.classList.contains("qa-main-v146") !== (b === main)) b.classList.toggle("qa-main-v146", b === main);
        if (b.classList.contains("qa-chip-v146") !== (b !== main)) b.classList.toggle("qa-chip-v146", b !== main);
      });
      /* the chips ride ONE row — the quick-options bar — which scrolls sideways if the screen has
       * more of them than a phone is wide. The buttons are MOVED, not rebuilt: same nodes, same
       * onclick, same text, so every drive loop that clicks one by its words still finds it */
      var chips = btns.filter(function (b) { return b !== main });
      var row = d.querySelector(":scope > .qa-row-v146");
      if (chips.length > 1) {
        if (!row) { row = document.createElement("div"); row.className = "qa-row-v146"; d.appendChild(row) }
        chips.forEach(function (b) { if (b.parentNode !== row) row.appendChild(b) });
        [].forEach.call(d.querySelectorAll(":scope > .btn-row"), function (r) { if (!r.children.length) r.classList.add("qa-empty-v146") });
        var wide = row.scrollWidth > row.clientWidth + 2;
        if (row.classList.contains("more") !== wide) row.classList.toggle("more", wide);
      } else if (row && !row.children.length) row.remove();
    } catch (e) {}
    arranging = false;
  }

  /* the measure: what the bottom stack takes, so the panel ends where it starts */
  var lastVars = "";
  function vis(el) { return !!(el && el.isConnected && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 0) }   // fixed elements have no offsetParent
  function measure() {
    if (!on()) { if (lastVars) { ["--tabsH-v146", "--botH-v146"].forEach(function (k) { root.style.removeProperty(k) }); lastVars = "" } return }
    var n = $("navV139"), d = $("dock"), sc = $("screen");
    var tabs = sc && sc.querySelector(":scope > .hubv75-tabs");
    var nh = (n && n.classList.contains("on")) ? Math.round(n.getBoundingClientRect().height) : 0;
    var th = vis(tabs) ? Math.round(tabs.getBoundingClientRect().height) : 0;
    var dh = (d && vis(d) && d.children.length) ? Math.round(d.getBoundingClientRect().height) : 0;
    var key = nh + "/" + th + "/" + dh;
    if (key === lastVars) return;
    lastVars = key;
    root.style.setProperty("--navH-v139", nh + "px");
    root.style.setProperty("--tabsH-v146", th + "px");
    root.style.setProperty("--botH-v146", (nh + th + dh) + "px");
  }
  /* a long list gets the room that is left and scrolls inside itself; the panel fits */
  function unfit() { [].forEach.call(document.querySelectorAll(".fill-v146"), function (el) { el.style.maxHeight = ""; el.style.overflowY = ""; el.classList.remove("fill-v146") }) }
  /* the room left under the last thing in the panel (the fixed tab strip is not in the flow) */
  function slack(sc) {
    var b = 0, kids = sc.children;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i]; if (k.classList.contains("hubv75-tabs") || !k.getClientRects().length) continue;
      var r = k.getBoundingClientRect(), mb = parseFloat(getComputedStyle(k).marginBottom) || 0; if (r.bottom + mb > b) b = r.bottom + mb;
    }
    var sr = sc.getBoundingClientRect(), pb = parseFloat(getComputedStyle(sc).paddingBottom) || 0;
    return Math.floor(sr.top + sc.clientHeight - pb - b);
  }
  var drawnAt = 0;
  function fit() {
    var sc = $("screen"); if (!sc || !on()) return;
    /* a screen the v75 sectioner is about to split (it waits 90ms for the render to settle) is not
     * measured yet — squeezing its stack now would squeeze the wrong card. And a split one folds
     * first (v97): an accordion is better than a card with a scrollbar */
    var H = window.__HUB_V75, v = view();
    if (H && H.views && H.views[v]) {
      if (!sc.querySelector(":scope > .hubv75-tabs")) { if (Date.now() - drawnAt < 600) return }
      else { try { H.sweep() } catch (e) {} }
    }
    /* a list squeezed while the screen was still being assembled (the v75 sectioner runs 90ms
     * after the render) gets its room back first — grown, never reset, so its scroll is kept */
    if (sc.scrollHeight <= sc.clientHeight + 2) {
      var room = slack(sc);
      if (room > 3) [].forEach.call(sc.querySelectorAll(".fill-v146"), function (el) {
        if (room <= 3 || !el.getClientRects().length) return;
        var need = el.scrollHeight - el.clientHeight; if (need <= 0) return;
        var add = Math.min(need, room - 2); el.style.maxHeight = (el.getBoundingClientRect().height + add) + "px"; room -= add;
      });
    }
    var over = sc.scrollHeight - sc.clientHeight;
    for (var i = 0; i < FILL.length && over > 2; i++) {
      var els = [].slice.call(sc.querySelectorAll(FILL[i])).filter(function (el) {
        return el.getClientRects().length && !el.classList.contains("hubv75-tabs") && !el.querySelector(".hubv75-tabs") && !el.closest(".dock");
      }).sort(function (a, b) { return b.offsetHeight - a.offsetHeight });
      for (var j = 0; j < els.length && over > 2; j++) {
        var el = els[j], h = el.getBoundingClientRect().height, want = Math.max(FILL_MIN, Math.floor(h - over - 1));
        if (want >= h - 1) continue;
        el.style.maxHeight = want + "px"; el.style.overflowY = "auto"; el.classList.add("fill-v146");
        over = sc.scrollHeight - sc.clientHeight;
      }
    }
  }

  /* always open at the top */
  var touched = 0, stamp = 0;
  function top() {
    try { measure(); fit() } catch (e) {}
    try {
      [document.scrollingElement, document.documentElement, document.body, $("app"), $("screen")].forEach(function (el) { if (el && el.scrollTop) el.scrollTop = 0 });
      var sc = $("screen");
      if (sc) { var all = sc.querySelectorAll("*"); for (var i = 0; i < all.length; i++) if (all[i].scrollTop) all[i].scrollTop = 0 }
      if (window.scrollY) window.scrollTo(0, 0);
      if (view() === "menu") { var m = $("rib-main-menu-v2"); if (m && m.scrollTop) m.scrollTop = 0 }
    } catch (e) {}
  }
  function after(v, changed) {
    drawnAt = Date.now();   // every draw rebuilds #screen: the sectioner has to split it again before anything is squeezed
    brand(); title(v); dock(); measure(); fit();
    if (!changed) return;
    ticker();
    var my = ++stamp; touched = 0; drawnAt = Date.now();
    top();
    var again = function () { if (my === stamp && !touched && view() === v) { measure(); fit(); top() } };
    try { requestAnimationFrame(again) } catch (e) {}
    setTimeout(again, 160); setTimeout(again, 450); setTimeout(again, 700);
  }
  ["wheel", "touchmove", "keydown"].forEach(function (t) { addEventListener(t, function () { touched = 1 }, { passive: true, capture: true }) });

  function sync() {
    var v = view();
    var want = !!v && !OFF[v];
    if (want !== on()) root.classList.toggle("shell-v146", want);
    if (!want) { measure(); return }
    brand(); title(v); dock(); measure(); fit();
  }
  try { new MutationObserver(sync).observe(document.body, { childList: true, subtree: true }) } catch (e) {}
  try { var ro = new ResizeObserver(function () { measure(); fit() }); var hook = function () { ["dock", "navV139"].forEach(function (id) { var el = $(id); if (el && !el.__v146) { el.__v146 = 1; ro.observe(el) } }) }; setInterval(hook, 500); hook() } catch (e) {}
  addEventListener("resize", function () { lastVars = ""; unfit(); measure(); fit() });
  setInterval(sync, 700);
  setInterval(function () { if (on()) ticker() }, 5000);
  /* ===== v153 E THE THUMB — nothing on a career screen under 11px, nothing you tap under 36px =====
   * The owner: "some menus are way too small for mobile." Measured at 400x860 on every career screen, the
   * chrome the shell draws round each one was the worst of it: the section tabs and the bar's labels at 9-10px
   * and 34px tall, the dock's chips 27px, the hamburger 18px wide, the PP chip's "+" 17px, the kit and mute
   * buttons 30px, the ticker at 9.5px, and the wordmark squeezed by the chips to "R." (the screen's name under
   * it unreadable). So: every one of those is at least 36px on both axes (a small glyph keeps its look and gets
   * a padded hit area — negative margins, so no row moves), type is 11px at the floor, the wordmark gives its
   * room to the chips on a phone and the screen's name moves to the left end of the ticker (`#tickTitleV153`),
   * and the common in-panel labels (eyebrows, KEY tags, MORE, the (i) stat cards, the hub's attribute sheet,
   * the leaders' sub-lines) are lifted to the floor. CSS only, over v146 E's inline rules; no handler moves.
   * `v153Echeck` samples the screens for both floors. ===== */
  (function () {
    if ($("thumbV153css")) return;
    var st = document.createElement("style"); st.id = "thumbV153css";
    st.textContent = [
      /* the top: 36px targets; on a phone the wordmark's room goes to them, the screen's name to the ticker */
      "html.shell-v146 .topbar{gap:6px!important;padding-top:calc(env(safe-area-inset-top) + 5px)!important;padding-bottom:5px!important}",
      "html.shell-v146 .topbar .hamb{flex:none!important;width:36px!important;height:36px!important;padding:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:4px!important;cursor:pointer!important}",
      "html.shell-v146 .topbar .hamb i{margin:0!important}",
      "@media (max-width:480px){html.shell-v146 .topbar .logo{flex:1 1 0!important;min-width:0!important;overflow:hidden!important}html.shell-v146 .topbar .logo>*{display:none!important}}",
      "html.shell-v146 .legacy-chip-v152.top{min-height:36px!important;min-width:44px!important}",
      "html.shell-v146 .prestige-chip{min-height:36px!important;padding:0 0 0 9px!important;font-size:12.5px!important}",
      "html.shell-v146 .prestige-chip .chip-plus{width:36px!important;height:36px!important;margin-left:2px!important;padding:0!important;font-size:17px!important}",
      "html.shell-v146 .topbar .mute-v151e,html.shell-v146 .topbar .team-creator-btn-v153{flex:none!important;width:36px!important;height:36px!important;min-width:36px!important}",
      "html.shell-v146 #tickV146{padding:0!important;height:24px!important;display:flex!important;align-items:center!important}",
      "html.shell-v146 #tickV146 li{font-size:11px!important;letter-spacing:1.4px!important}",
      "#tickTitleV153{position:absolute!important;left:0!important;top:0!important;bottom:0!important;z-index:2!important;display:flex!important;align-items:center!important;padding:0 22px 0 12px!important;font:700 11px/1 Oswald,sans-serif!important;letter-spacing:1.6px!important;color:#ffd66b!important;white-space:nowrap!important;background:linear-gradient(90deg,#0b0c0f 76%,rgba(11,12,15,0))!important;pointer-events:none!important}",
      "#tickTitleV153:empty{display:none!important}",
      /* the bottom: the bar, the section tabs, the dock's chips */
      "html.shell-v146 #navV139 button{min-height:44px!important;justify-content:center!important}",
      "html.shell-v146 #navV139 button b{font-size:11px!important;letter-spacing:.9px!important}",
      "html.shell-v146 .hubv75-tab{min-height:42px!important;font-size:11px!important;letter-spacing:.8px!important;padding:8px 2px!important}",
      "html.shell-v146 .hubv75-tab i{font-size:13px!important}",
      "html.shell-v146 .dock .qa-chip-v146{min-height:36px!important;font-size:11.5px!important;padding:6px 10px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}",
      "html.shell-v146 .dock>.small,html.shell-v146 .dock>.center:not(.btn){font-size:11.5px!important}",
      /* in the panel: the labels every screen shares */
      "html.shell-v146 #screen .eyebrow,html.shell-v146 #screen>.eyebrow{font-size:11px!important;letter-spacing:2px!important}",
      "html.shell-v146 .weight-tag{font-size:11px!important}",
      "html.shell-v146 .more-v139{font-size:11px!important;padding:11px 14px 11px 0!important;margin:-9px 0 -9px!important}",
      /* the stat card's (i): the 15px dot is drawn, the 36px round it is the button */
      "html.shell-v146 .si-b-v142{position:relative!important;width:36px!important;height:36px!important;margin:-11px -10px -11px -8px!important;background:transparent!important;border:0!important;box-shadow:none!important;color:transparent!important;font-size:0!important;flex:none!important}",
      "html.shell-v146 .si-b-v142::before{content:'i';position:absolute!important;left:50%!important;top:50%!important;width:16px!important;height:16px!important;margin:-8px 0 0 -8px!important;border-radius:50%!important;display:grid!important;place-items:center!important;border:1px solid rgba(143,162,187,.6)!important;background:rgba(143,162,187,.12)!important;color:#c9d2de!important;font:italic 700 11px/1 Georgia,serif!important}",
      /* the hub's attribute sheet: two columns that stay one line each, the personality cap tag on the metric line */
      "html.shell-v146 .attrs{gap:9px 12px!important}",
      "html.shell-v146 .attr{position:relative!important;min-width:0!important;gap:3px!important}",
      "html.shell-v146 .attr .top{display:flex!important;flex-wrap:nowrap!important;align-items:center!important;gap:4px!important;min-width:0!important}",
      "html.shell-v146 .attr .an{display:flex!important;align-items:center!important;min-width:0!important;overflow:hidden!important;white-space:nowrap!important;font-size:13.5px!important}",
      "html.shell-v146 .attr .av{flex:none!important;display:flex!important;align-items:baseline!important;white-space:nowrap!important;font-size:16px!important}",
      "html.shell-v146 .attr .eff{font-size:11px!important;margin-left:3px!important}html.shell-v146 .attr .projn{font-size:11px!important;margin-left:3px!important}",
      "html.shell-v146 .attr .an>span[title*='MAX LEVEL']{position:absolute!important;right:0!important;bottom:0!important;margin:0!important;font-size:11px!important;line-height:1.3!important}",
      "html.shell-v146 .attr:has(.an>span[title*='MAX LEVEL']) .attr-metric{padding-right:60px!important}",
      "html.shell-v146 .attr .attr-metric{display:block!important;font-size:11px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}",
      "html.shell-v146 .attrs-legend-v85{font-size:11px!important}",
      /* the leaders' tables: the school line under each name, and the column heads */
      "html.shell-v146 #screen .lb-hdr span,html.shell-v146 #screen .lbo,html.shell-v146 #screen .lbv{font-size:11px!important}",
      /* every <small> in the panel reads at the floor (a sub-line, a stat's label, a card's caption) */
      "html.shell-v146 #screen small{font-size:max(11px,.8em)!important}",
      "html.shell-v146 #screen .chips .chip,html.shell-v146 #screen .advf-v151 .chip{min-height:36px!important;min-width:36px!important}",
      "html.shell-v146 #screen select,html.shell-v146 #screen input[type=text],html.shell-v146 #screen input[type=search],html.shell-v146 #screen input:not([type]){min-height:36px!important;font-size:max(13px,1em)!important}",
      /* the profile card's captions */
      "html.shell-v146 #screen .pc-ovr-v151b{font-size:11px!important;letter-spacing:1px!important}",
      "html.shell-v146 #screen .pc-team-v151b,html.shell-v146 #screen .pc-club-v151b,html.shell-v146 #screen .pc-legacy-v152{font-size:11px!important}",
      "html.shell-v146 #screen .pc-shelf-v151b small,html.shell-v146 #screen .pc-grid-v151b small{letter-spacing:.6px!important}",
      "html.shell-v146 #screen .pcm-slot~small,html.shell-v146 #screen .pcm-slot~em{font-size:11px!important;letter-spacing:.5px!important}",
      /* the trophy case, the gear totals, the stat boxes, the Dynasty's position tags */
      "html.shell-v146 #screen .lgk-head,html.shell-v146 #screen .lgc-head,html.shell-v146 #screen .lgk-xp,html.shell-v146 #screen .lgk-next{font-size:11px!important}",
      "html.shell-v146 #screen .gs-h-v147,html.shell-v146 #screen .gm-none-v147,html.shell-v146 #screen .statbox .l,html.shell-v146 #screen .mr-pos{font-size:11px!important}",
      /* the body ledger, the wear band, the card kickers, the role battle's name tags, a stat tile's label */
      "html.shell-v146 #screen .impact-kicker,html.shell-v146 #screen .bodyv73-net span,html.shell-v146 #screen .bodyv73-row i,html.shell-v146 #screen .wearv111-band s,html.shell-v146 #screen .wearv111-sub,html.shell-v146 #screen .rival-versus-v11 span,html.shell-v146 #screen .l{font-size:11px!important}",
      /* the collection book's captions and its page-turn corner (the medal grid itself is ten to a row: see the check) */
      "html.shell-v146 #screen .lgb-tab em,html.shell-v146 #screen .lgb-rh b,html.shell-v146 #screen .lgb-pt span,html.shell-v146 #screen .lgb-hint,html.shell-v146 #screen .lgb-fh b,html.shell-v146 #screen .lgb-fh small,html.shell-v146 #screen .lgb-foot span{font-size:11px!important}",
      "html.shell-v146 #screen .lgb-turn{min-width:36px!important;min-height:36px!important}html.shell-v146 #screen .lgb-cell{min-height:36px!important}",
      /* the Locker's STYLE tab: the category strip and the item captions */
      "html.shell-v146 #screen .cos-cat-v151b{min-height:38px!important;font-size:11px!important}",
      "html.shell-v146 #screen .cos-src-v151b{font-size:11px!important;letter-spacing:.3px!important}",
      "html.shell-v146 #screen .cos-h-v151b span{font-size:11px!important}",
      /* the leaderboards' mode switch; a slider's thumb is a 36px strip, the track still drawn 5px */
      "html.shell-v146 #screen .lb151-mode button{min-height:38px!important}",
      "html.shell-v146 #screen .fx-slider{height:36px!important;background:linear-gradient(90deg,#3a4a5f,#1a2330) center/100% 5px no-repeat!important}"
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  })();

  sync(); ticker();
  window.__SHELL_V146 = { after: after, top: top, sync: sync, fit: fit, measure: measure, ticker: ticker, dock: dock, titles: TITLE, off: OFF };
})();
