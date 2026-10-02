/* ===== v169 BIG ON A PHONE =====
 * Measured on real phone sizes (360x740, 375x667, 390x844) the career screens were too small to read: half to nine
 * tenths of the visible text sat under 13px (the body card and the training board went down to 8px), and on a 375x667
 * phone the bars took 270 of 667px. Seven steps, all below 540px wide (`html.phone-v169`; `html.short-v169` under 760px
 * tall):
 *   1. THE GUARD: `scripts/phonecheck.mjs` audits the visible text and the chrome on two phones (no text under 12px).
 *   2. THE TYPE FLOOR (`floor()`): every text-bearing element in the career panel, the dock, the pregame wizard, the
 *      post-game card, the decision / game-plan overlays and the ⓘ sheet is lifted to at least 13px (12px for an
 *      uppercase, letter-spaced label), its line height opened to match (`data-tf169`; a re-render starts clean). On the
 *      broadcast only the overlays over it are touched. Prose (.small/.sub/.pd/.threshold-note) reads at 14px.
 *   3. THE CHROME: a short phone folds the ticker (24px back to the panel); the dock's padding tightens.
 *   4. THE CONTROLS: section tabs 50px with the icon over a 12px label (five fit without running together), dock
 *      buttons 42px+ (the main one 48px, 17px type), filter chips one swipeable row, the ⓘ sheet at 17px.
 *   5. THE SEASON: a short phone's hero puts NEXT UP on one line (the opponent; your record leads the hero), drops the
 *      press strip and the race footnote; schedule, league and standings rows are 48px+ with 15-16px names; past weeks
 *      lose their stale importance chips; 32's pager rides the END of a scrolling list on a phone.
 *   6. THE DENSE SCREENS: training is three programs a row in its own scrolling box with the chosen program's panel in
 *      view; the body card's wear tiles go two-up under 380px; skills rows hide the metric's label (the value stays) and give back their
 *      padding so a group still fits one page (v153 E); the stats screen drops its eyebrow and the pace note goes to ⓘ.
 *   7. THE OVERLAYS: the post-game card runs edge to edge, scrolls, keeps its scoreline on one line and its Continue
 *      riding the bottom; the pregame wizard and decision panels get 27px titles and 15px prose.
 * Kill switch `v169phone` 0. `window.__V169` (`on`, `floor`, `classes`, `stats`); `phonecheck`. */
(function () {
  "use strict";
  function TU(k, d) { try { var t = window.RIB_TUNE; return t && t[k] !== undefined ? t[k] : d } catch (e) { return d } }
  var root = document.documentElement;
  function on() { return !!TU("v169phone", 1) && (window.innerWidth || 999) <= TU("phoneMaxWV169", 540) }
  function view() { try { return (window.S && window.S.view) || "" } catch (e) { return "" } }

  function classes() {
    var p = on(), s = p && (window.innerHeight || 999) <= TU("shortMaxHV169", 760);
    if (root.classList.contains("phone-v169") !== p) root.classList.toggle("phone-v169", p);
    if (root.classList.contains("short-v169") !== s) root.classList.toggle("short-v169", s);
    return p;
  }

  /* 1. the type floor */
  var ROOTS = "#screen, #dock, #pregameV1513, #pgOverlayV13, .decision-overlay, .gameplan-overlay, #ribiSheetV168";
  var SKIP = "canvas, svg, .pip-v168, .crest-v168, .emblem-v44, .field-wrap, .sb-meta, [aria-hidden='true'], .rib-mark-v146";
  var stats = { lifted: 0, passes: 0 };
  function floor() {
    if (!classes()) return;
    var FL = TU("typeFloorV169", 13), LB = TU("labelFloorV169", 12);
    // on the broadcast only the overlays over it (the post-game card arrives while the view is still "live")
    var roots = document.querySelectorAll(view() === "live" ? "#pgOverlayV13, .decision-overlay, #ribiSheetV168" : ROOTS);
    for (var r = 0; r < roots.length; r++) {
      var els = roots[r].querySelectorAll("*");
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.dataset.tf169) continue;
        var own = false;
        for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && c.textContent.trim()) { own = true; break }
        if (!own || el.closest(SKIP)) continue;
        var cs = getComputedStyle(el), fs = parseFloat(cs.fontSize);
        if (!(fs > 0)) continue;
        var label = cs.textTransform === "uppercase" || parseFloat(cs.letterSpacing) >= 0.8;
        var want = label ? LB : FL;
        el.dataset.tf169 = "1";
        if (fs >= want - 0.05) continue;
        el.style.setProperty("font-size", want + "px", "important");
        var lh = parseFloat(cs.lineHeight);
        if (lh > 0 && lh < want * 1.15) el.style.setProperty("line-height", "1.25", "important");
        stats.lifted++;
      }
    }
    stats.passes++;
  }

  var CSS = [
    /* 2. the chrome */
    "html.short-v169.shell-v146 #tickV146{display:none!important}",
    "html.phone-v169.shell-v146 .dock{padding:5px 8px!important;gap:5px!important}",
    /* 3. the controls */
    /* the section tabs: the icon over the label, so five fit a phone without running together */
    "html.phone-v169.shell-v146 .hubv75-tabs{min-height:52px;padding:0 2px!important;gap:0!important}",
    "html.phone-v169 .hubv75-tab{display:flex!important;flex-direction:column!important;align-items:center;justify-content:center;gap:2px;min-height:50px;font-size:12px!important;letter-spacing:.2px!important;padding:5px 0 4px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "html.phone-v169 .hubv75-tab i{display:block;font-size:19px!important;line-height:1!important;margin:0!important}",
    "html.phone-v169 #dock .btn{min-height:42px;font-size:14px!important}",
    "html.phone-v169 #dock .btn.qa-main-v146{min-height:48px;font-size:17px!important;letter-spacing:1.4px;padding-top:8px!important;padding-bottom:8px!important}",
    "html.phone-v169 #dock .qa-chip-v146{min-height:40px;font-size:13px!important;padding-top:5px!important;padding-bottom:5px!important}",
    /* filter chips ride one swipeable row instead of wrapping into three */
    "html.phone-v169 #screen .chips{flex-wrap:nowrap!important;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding-bottom:2px}",
    "html.phone-v169 #screen .chips::-webkit-scrollbar{display:none}",
    "html.phone-v169 #screen .chips > *{flex:0 0 auto!important}",
    /* cards keep their breath but not a phone's width of it */
    "html.phone-v169 #screen .card{padding:12px 12px!important;margin-top:8px!important;margin-bottom:8px!important}",
    "html.phone-v169 #screen .mod-banner{padding:7px 10px!important;margin:4px 0 8px!important}",
    "html.short-v169 #screen .mod-banner{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "html.phone-v169 #dock .qa-chip-v146 small{font-size:12px!important}",
    "html.phone-v169 #ribiSheetV168 .ribi-txt{font-size:17px!important;line-height:1.5}",
    "html.phone-v169 #ribiSheetV168 .ribi-title{font-size:24px!important}",
    "html.phone-v169 #ribiSheetV168 h4{font-size:13px!important}",
    "html.phone-v169 .pager-v168{margin:10px 0 2px!important}",
    "html.phone-v169 .pager-v168 button{min-height:40px;padding:6px 14px!important;font-size:13px!important}",
    /* prose reads at 14-15px on a phone */
    "html.phone-v169 #screen .small,html.phone-v169 #screen .sub,html.phone-v169 #screen .pd,html.phone-v169 #screen .threshold-note{font-size:14px!important;line-height:1.4!important}",
    "html.phone-v169 #screen .h1{font-size:27px!important}",
    "html.phone-v169 #screen .h2{font-size:21px!important}",
    "html.phone-v169 #screen .eyebrow,html.phone-v169 #screen .impact-kicker{font-size:12px!important}",
    "html.phone-v169 #screen{padding-left:10px!important;padding-right:10px!important}",
    /* 4. the season */
    "html.phone-v169 .sx-team b{font-size:21px}",
    "html.phone-v169 .sx-rec b{font-size:38px}",
    "html.phone-v169 .sx-rec small,html.phone-v169 .sx-team small,html.phone-v169 .sx-race-k span,html.phone-v169 .sx-next-k{font-size:12px!important}",
    "html.phone-v169 .sx-race-k b{font-size:14px!important}",
    "html.phone-v169 .pip-v168{height:14px}",
    "html.phone-v169 .sx-race-foot{font-size:13px!important}",
    "html.phone-v169 .sx-side b{font-size:17px}",
    "html.phone-v169 .sx-side small{font-size:14px!important}",
    "html.short-v169 .sx-hero-v168{padding:10px!important;margin:4px 0 8px!important}",
    "html.short-v169 .sx-hero-v168 .sx-top > .crest-v168{width:42px!important;height:42px!important}",
    "html.short-v169 .sx-race-foot{display:none!important}",
    "html.short-v169 .sx-mu{grid-template-columns:1fr auto 1fr;margin-top:6px;align-items:center}",
    "html.short-v169 .sx-side{display:grid!important;grid-template-columns:auto minmax(0,1fr);grid-template-rows:auto auto;column-gap:8px;row-gap:0;align-items:center;text-align:left}",
    "html.short-v169 .sx-side .crest-v168{grid-row:1 / span 2;width:34px!important;height:34px!important}",
    "html.short-v169 .sx-side b,html.short-v169 .sx-side small{grid-column:2;text-align:left}",
    "html.short-v169 .sx-side.them{grid-template-columns:minmax(0,1fr) auto}",
    "html.short-v169 .sx-side.them .crest-v168{grid-column:2}",
    "html.short-v169 .sx-side.them b,html.short-v169 .sx-side.them small{grid-column:1;text-align:right}",
    "html.short-v169 .sx-vs{font-size:18px}",
    "html.short-v169 .sx-next-v168{margin-top:9px;padding-top:8px}",
    /* a short phone's NEXT UP is one line: the opponent (your record already leads the hero) */
    "html.short-v169 .sx-next-v168{display:grid;grid-template-columns:auto 1fr;align-items:center;column-gap:10px}",
    "html.short-v169 .sx-next-k{grid-column:1 / span 2;margin-bottom:4px}",
    "html.short-v169 .sx-mu{grid-column:1 / span 2;grid-template-columns:auto 1fr!important;margin-top:0!important}",
    "html.short-v169 .sx-mu > .sx-side:not(.them){display:none!important}",
    "html.short-v169 .sx-mu > .sx-vs{font-size:16px;padding-right:2px}",
    "html.short-v169 .sx-side.them{grid-template-columns:auto minmax(0,1fr)!important}",
    "html.short-v169 .sx-side.them .crest-v168{grid-column:1!important}",
    "html.short-v169 .sx-side.them b,html.short-v169 .sx-side.them small{grid-column:2!important;text-align:left!important}",
    "html.short-v169 .sx-race{margin-top:9px}",
    /* past rivalry / importance chips on a phone's schedule rows are noise (the hero calls the next one) */
    "html.phone-v169 .sched-row.sched-win .importance-chip-v11,html.phone-v169 .sched-row.sched-loss .importance-chip-v11{display:none!important}",
    /* the stats screen: the tabs and the toggle say where you are */
    "html.phone-v169 #screen:has(.advf-v151) > .eyebrow{display:none!important}",
    "html.phone-v169 #screen:has(.advf-v151) > .h1{font-size:22px!important;margin:0!important}",
    "html.phone-v169 #screen .advf-v151 input,html.phone-v169 #screen .advf-v151 select,html.phone-v169 #screen .advf-v151 button{min-height:40px!important;height:40px!important;font-size:15px!important}",
    "html.short-v169 #screen:has(.sx-hero-v168) .press-strip{display:none!important}",
    "html.phone-v169 .sched-row{min-height:50px;font-size:15px!important}",
    "html.phone-v169 .sched-row .sched-opp{font-size:15px!important}",
    "html.phone-v169 .sched-row .sched-score{font-size:17px!important}",
    "html.phone-v169 .sched-row .crest-v168{width:24px!important;height:24px!important}",
    "html.phone-v169 .lg-row-v168{min-height:50px;grid-template-columns:22px 30px 1fr 46px 44px}",
    "html.phone-v169 .lg-row-v168 .crest-v168{width:30px!important;height:30px!important}",
    "html.phone-v169 .lg-nm{font-size:16px!important}",
    "html.phone-v169 .lg-nm small{font-size:13px!important}",
    "html.phone-v169 .lg-wl{font-size:18px!important}",
    "html.phone-v169 .lg-df,html.phone-v169 .lg-rk{font-size:15px!important}",
    "html.phone-v169 .lb2-row{min-height:48px;font-size:15px!important}",
    "html.phone-v169 .lb2-row .lbn{font-size:15px!important}",
    "html.phone-v169 .season-strip-v168 .ss-top b{font-size:26px}",
    "html.phone-v169 .season-strip-v168 .ss-next b{font-size:16px}",
    /* 5. the dense screens */
    "html.phone-v169 .tp-grid-v113{grid-template-columns:repeat(3,1fr)!important;gap:7px!important}",
    "html.phone-v169 .tp-grid-v113{max-height:46vh;overflow-y:auto;overscroll-behavior:contain;padding:2px 2px 6px;scrollbar-width:thin}",
    "html.phone-v169 .tp-tile-v113{min-height:104px}",
    "html.phone-v169 #screen > .tp-panel-v113{min-height:150px}",
    "html.phone-v169 .tp-panel-v113{font-size:15px}",
    "@media (max-width:379px){html.phone-v169 .condition-card-v11 .wearv111-grid{grid-template-columns:repeat(2,1fr)!important}}",
    "html.phone-v169 .condition-number-v11,html.phone-v169 .wearv111-num{font-size:30px!important}",
    "html.phone-v169 .oppv126-grid b{font-size:26px!important}",
    /* 6. the overlays */
    "html.phone-v169 #pregameV1513 .pregame-panel-v1513{padding-left:10px!important;padding-right:10px!important}",
    "html.phone-v169 #pregameV1513 .v112-title{font-size:27px!important}",
    "html.phone-v169 #pregameV1513 .v112-sub{font-size:15px!important}",
    "html.phone-v169 #pgOverlayV13 .decision-panel,html.phone-v169 .decision-overlay .decision-panel{width:calc(100vw - 16px)!important;max-width:none!important;padding:16px 14px!important}",
    "html.phone-v169 #pgOverlayV13{align-items:flex-start!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch;padding:8px 0 calc(16px + env(safe-area-inset-bottom))!important}",
    "html.phone-v169 #pgOverlayV13 .decision-panel{margin:0 auto!important;max-height:none!important;overflow:visible!important}",
    "html.phone-v169 #pgOverlayV13 .decision-title{font-size:28px!important;white-space:nowrap;gap:8px!important}",
    "html.phone-v169 #pgOverlayV13 .decision-title .crest-v168{width:30px!important;height:30px!important}",
    "html.phone-v169 #pgOverlayV13 .decision-panel > .btn:last-child{position:sticky;bottom:6px;z-index:3;box-shadow:0 -10px 24px rgba(8,9,11,.85),0 6px 16px rgba(0,0,0,.5)}",
    "html.phone-v169 .up-metric small{display:none!important}",
    /* the skills sheet keeps every row of a group on one page (v153 E): the bigger type gives back its padding */
    "html.phone-v169 #screen .up-attr{padding-top:2px!important;padding-bottom:2px!important}",
    "html.phone-v169 #screen .up-attr .desc{line-height:1.15!important}",
    "html.phone-v169 .decision-overlay .decision-copy{font-size:15px!important;line-height:1.45!important}",
    "html.phone-v169 #pgOverlayV13 .fullbox b,html.phone-v169 #pgOverlayV13 .pg-cell b{font-size:24px!important}"
  ].join("\n");
  function css() {
    if (document.getElementById("phoneCssV169")) return;
    var s = document.createElement("style"); s.id = "phoneCssV169"; s.textContent = CSS; document.head.appendChild(s);
  }

  var queued = false;
  function run() { queued = false; try { css(); floor() } catch (e) {} }
  function queue() { if (queued) return; queued = true; requestAnimationFrame(run) }
  try { new MutationObserver(queue).observe(document.body, { childList: true, subtree: true }) } catch (e) {}
  addEventListener("resize", function () { classes(); queue() });
  setInterval(queue, 900);
  css(); classes();
  window.__V169 = { on: on, floor: floor, classes: classes, stats: stats };
})();
