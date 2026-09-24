
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
  var OFF = { live: 1, menu: 1, highscore: 1, daily: 1, leaderboard: 1 };
  var TITLE = { hub: "CAREER HUB", season: "THE SEASON", training: "OFFSEASON TRAINING", upgrade: "SKILLS", shop: "PRESTIGE TREE",
    settings: "SETTINGS", stats: "STATS & LEADERS", challenges: "GOALS", hof: "HALL OF FAME", locker: "LOCKER", profile: "PROFILE", legacy: "LEGACY",
    dynasty: "DYNASTY", rank: "RECRUITING BOARD", result: "SEASON REPORT", declineResult: "SEASON REPORT", event: "STORY WEEK", sim: "THE SEASON",
    life: "LIFE", roster: "ROSTER", path: "THE PATH", tier: "THE NEXT LEVEL", gameover: "CAREER OVER", win: "CHAMPION", choosePos: "NEW CAREER" };
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
  sync(); ticker();
  window.__SHELL_V146 = { after: after, top: top, sync: sync, fit: fit, measure: measure, ticker: ticker, dock: dock, titles: TITLE, off: OFF };
})();
