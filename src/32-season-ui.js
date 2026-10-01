/* ===== v168 THE SEASON, REDRAWN — ⓘ, THE PAGER, THE LOOK =====
 * The career screens explained themselves in paragraphs: the body card carried four of them, the opponent card two,
 * every pregame step one under its heading and one under its sheet, the dock a line about what watching pays. The main
 * menu says almost nothing and looks better for it. So the explanations go behind an ⓘ:
 *   - FOLD RULES (`RULES`): each names the paragraph, the card it belongs to and what it is about. The paragraph stays in
 *     the DOM (every check and every later layer still finds it) but is hidden (`.ribi-f-v168`), and the card gains ONE
 *     ⓘ in its heading. The ⓘ opens a bottom sheet (`#ribiSheetV168`) holding every paragraph it folded, titled — the
 *     same words, read when you want them.
 *   - THE PAGER: a tabbed screen whose section runs past the panel ends that section with "‹ PREVIOUS · NEXT ›" (the
 *     neighbouring tabs by name), so reading to the bottom leads somewhere.
 *   - THE LOOK: the season hero, the league tab, the schedule rows, the body and opponent cards and the pregame cards in
 *     the main menu's language (gold hairlines, glass cards, Oswald numbers). CSS `#ribiCssV168`.
 * Kill switch `v168info` 0 (no folding, no pager; the hero is 07's `v168season`). `window.__V168UI`; `v168check.mjs`. */
(function () {
  "use strict";
  function TU(k, d) { try { var t = window.RIB_TUNE; return t && t[k] !== undefined ? t[k] : d } catch (e) { return d } }
  function on() { return !!TU("v168info", 1) }
  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] }) }

  /* what folds: the paragraph, the card it belongs to, and the heading the ⓘ sits in */
  var RULES = [
    { sel: ".condition-card-v11 > .bodyv73-sub", group: ".condition-card-v11", t: "What your body is worth" },
    { sel: ".condition-card-v11 > .threshold-note", group: ".condition-card-v11", t: "This week's fixture" },
    { sel: ".condition-card-v11 .wearv111-sub", group: ".condition-card-v11", t: "The season so far" },
    { sel: ".condition-card-v11 .wearv111-call", group: ".condition-card-v11", t: "The season ahead" },
    { sel: ".condition-card-v11 > .small", group: ".condition-card-v11", t: "The fatigue dial" },
    { sel: ".opponent-card-v11 > .small", group: ".opponent-card-v11", t: "Scouting" },
    { sel: ".gs-head > small", group: ".gs-wrap-v23", anchor: ".gs-head", title: function (el) { var h = el.parentNode; return h ? (h.firstChild && h.firstChild.textContent || "").replace(/^[^A-Za-z]+/, "").trim() : "" } },
    { sel: ".v112-imp-note", group: "*", t: "How to read this" },
    { sel: ".coach-sum-v136 > .small", group: ".coach-sum-v136", t: "The coach's summary" },
    { sel: ".lg-note-v168", group: ".league-card-v168", anchor: ".lg-head-v168", t: "How the league works" },
    { sel: "#screen > .tp-note-v133", group: "#screen", anchor: "#screen > .h1", sheet: "Choosing your training", t: "The coach's suggestion" },
    { sel: "#screen > .tp-tierkey-v133", group: "#screen", anchor: "#screen > .h1", sheet: "Choosing your training", t: "Reading the cards" },
    { sel: "#screen > .st-note-v168", group: "#screen", anchor: "#screen > .h1", sheet: "The standings", t: "Making the playoffs" },
    { sel: "#dock .watch-note-v164c", group: "#dock", dock: true, t: "Watch live or Quick Play" }
  ];
  var ANCHORS = ".impact-kicker,.gs-head,.lg-head-v168,.decision-kicker,.eyebrow,.h2";

  function groupOf(el, r) {
    if (r.group === "*") return el.parentElement;
    return el.closest(r.group) || el.parentElement;
  }
  function btnFor(g, r) {
    var b = g.__ribiV168;
    if (b && b.isConnected) return b;
    b = document.createElement("button");
    b.type = "button"; b.className = "ribi-btn-v168"; b.setAttribute("aria-label", "More information"); b.textContent = "i";
    b.addEventListener("click", function (ev) { ev.preventDefault(); ev.stopPropagation(); openFor(g) });
    if (r.dock) {
      b.className += " ribi-dock-v168 btn ghost"; b.textContent = "ⓘ";
      var row = g.querySelector(".qa-row-v146"); row ? row.insertBefore(b, row.firstChild) : g.appendChild(b);
    } else {
      var a = (r.anchor && g.querySelector(r.anchor)) || g.querySelector(ANCHORS);
      if (a && g.contains(a)) { a.classList.add("ribi-host-v168"); a.appendChild(b) }
      else { g.classList.add("ribi-abs-v168"); b.classList.add("abs"); g.insertBefore(b, g.firstChild) }
    }
    g.__ribiV168 = b;
    return b;
  }
  function fold() {
    if (!on()) return;
    var d = document.querySelector("#dock .ribi-dock-v168"), row = d && d.parentNode && d.parentNode.classList.contains("qa-row-v146") ? d.parentNode : document.querySelector("#dock .qa-row-v146");
    if (d && row && row.firstChild !== d) row.insertBefore(d, row.firstChild);   // the shell files chips in DOM order: keep the ⓘ up front
    for (var i = 0; i < RULES.length; i++) {
      var r = RULES[i], list = document.querySelectorAll(r.sel);
      for (var j = 0; j < list.length; j++) {
        var el = list[j];
        if (el.classList.contains("ribi-f-v168") || !(el.textContent || "").trim()) continue;
        var g = groupOf(el, r); if (!g) continue;
        el.dataset.ribiT = (r.title ? r.title(el) : r.t) || "More";
        if (r.sheet) g.__ribiSheetV168 = r.sheet;
        el.classList.add("ribi-f-v168");
        btnFor(g, r);
      }
    }
  }

  /* the sheet */
  function closeSheet() { var s = document.getElementById("ribiSheetV168"); if (s) { s.classList.remove("on"); setTimeout(function () { s.remove() }, 200) } }
  function openFor(g) {
    var parts = [].slice.call(g.querySelectorAll(".ribi-f-v168"));
    if (!parts.length) return;
    var head = g.__ribiSheetV168 ? null : g.querySelector(".impact-kicker,.gs-head,.lg-head-v168 .k,.decision-kicker");
    var title = head ? (head.firstChild && head.firstChild.textContent || head.textContent || "") : "";
    title = g.__ribiSheetV168 || title.replace(/^[^A-Za-z0-9]+/, "").replace(/\s+/g, " ").trim() || parts[0].dataset.ribiT;
    var body = parts.map(function (p) {
      var c = p.cloneNode(true); c.classList.remove("ribi-f-v168", "clamp-v139");
      c.querySelectorAll(".ribi-btn-v168,.more-v139,[onclick]").forEach(function (n) { if (n.classList.contains("ribi-btn-v168") || n.classList.contains("more-v139")) n.remove() });
      return '<section><h4>' + esc(p.dataset.ribiT) + '</h4><div class="ribi-txt">' + c.innerHTML + "</div></section>";
    }).join("");
    closeSheet();
    var s = document.createElement("div");
    s.id = "ribiSheetV168"; s.setAttribute("role", "dialog"); s.setAttribute("aria-modal", "true");
    s.innerHTML = '<div class="ribi-back"></div><div class="ribi-panel"><div class="ribi-grip"></div><div class="ribi-k">HOW IT WORKS</div><div class="ribi-title">' + esc(title) + "</div>" + body +
      '<button type="button" class="ribi-ok">GOT IT</button></div>';
    document.body.appendChild(s);
    s.querySelector(".ribi-back").addEventListener("click", closeSheet);
    s.querySelector(".ribi-ok").addEventListener("click", closeSheet);
    requestAnimationFrame(function () { s.classList.add("on") });
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet() });

  /* the pager: a tabbed section that runs past the panel ends on its neighbours */
  var PAGER_VIEWS = { season: 1, hub: 1, result: 1, profile: 1, settings: 1 };
  function pager() {
    if (!on()) return;
    var v = ""; try { v = window.S && window.S.view } catch (e) {}
    var scr = document.getElementById("screen"); if (!scr || !PAGER_VIEWS[v]) return;
    var tabs = [].slice.call(scr.querySelectorAll(":scope > .hubv75-tabs .hubv75-tab")); if (tabs.length < 2) return;
    var sec = scr.querySelector(":scope > .hubv75-sec.on"); if (!sec) return;
    var i = tabs.findIndex(function (t) { return t.dataset.sec === sec.dataset.sec }); if (i < 0) return;
    var box = sec.querySelector(".fill-v146") || sec;
    var long = box.scrollHeight > box.clientHeight + 24 || scr.scrollHeight > scr.clientHeight + 24;
    var have = sec.querySelector(".pager-v168");
    if (!long) { if (have && !have.dataset.keep) have.remove(); return }
    if (have) return;
    var prev = tabs[i - 1], next = tabs[i + 1];
    if (!prev && !next) return;
    var name = function (t) { return (t.textContent || "").replace(/^[^A-Za-z]+/, "").trim() };
    var p = document.createElement("div"); p.className = "pager-v168";
    p.innerHTML = (prev ? '<button type="button" class="pg-prev" data-go="' + prev.dataset.sec + '">‹ ' + esc(name(prev)) + "</button>" : "<span></span>") +
      (next ? '<button type="button" class="pg-next" data-go="' + next.dataset.sec + '">' + esc(name(next)) + " ›</button>" : "<span></span>");
    p.addEventListener("click", function (e) {
      var b = e.target.closest("[data-go]"); if (!b) return;
      var t = scr.querySelector('.hubv75-tab[data-sec="' + b.dataset.go + '"]'); t && t.click();
    });
    box.appendChild(p);
  }

  /* the hub's NOW tab carries the season strip (07 seasonStripV168) under the player card */
  function hubStrip() {
    if (!on()) return;
    var v = ""; try { v = window.S && window.S.view } catch (e) {}
    if (v !== "hub") return;
    var scr = document.getElementById("screen"); if (!scr || scr.querySelector(".season-strip-v168")) return;
    var hero = scr.querySelector(".player-hero"); if (!hero || !window.__V168 || !window.__V168.strip) return;
    var html = ""; try { html = window.__V168.strip() } catch (e) {}
    if (html) hero.insertAdjacentHTML("beforeend", html);   // INSIDE the player card: the hub's accordions keep it with him
  }

  var CSS = [
    /* ⓘ */
    ".ribi-f-v168,.ribi-f-v168+.more-v139{display:none!important}",
    ".ribi-host-v168{display:flex!important;align-items:center;gap:8px;white-space:nowrap}",
    ".ribi-host-v168 > .ribi-btn-v168{margin-left:6px}",
    ".ribi-btn-v168{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;min-width:22px;padding:0;margin-left:auto;border-radius:50%;border:1px solid rgba(230,178,58,.6);background:rgba(230,178,58,.1);color:#ffd66b;font:italic 700 13px Georgia,serif;line-height:1;cursor:pointer;box-shadow:0 0 0 3px rgba(230,178,58,.06);-webkit-tap-highlight-color:transparent}",
    ".ribi-btn-v168:hover{background:rgba(230,178,58,.22)}",
    ".ribi-btn-v168:before{content:'';position:absolute;inset:-9px}", /* a 40px thumb target around a 22px dot */
    ".ribi-btn-v168{position:relative}",
    ".ribi-abs-v168{position:relative}.ribi-btn-v168.abs{position:absolute;top:10px;right:10px;z-index:2}",
    "#dock .ribi-dock-v168.btn{flex:0 0 auto!important;width:44px!important;min-width:44px!important;height:auto;padding:0!important;font:400 20px/1 system-ui,sans-serif!important;color:#ffd66b!important;border-radius:12px!important;border-color:rgba(230,178,58,.55)!important;font-style:normal!important;box-shadow:none}",
    "#ribiSheetV168{position:fixed;inset:0;z-index:2147480000;display:flex;align-items:flex-end;justify-content:center;pointer-events:auto}",
    "#ribiSheetV168 .ribi-back{position:absolute;inset:0;background:rgba(4,5,8,.62);opacity:0;transition:opacity .2s ease;backdrop-filter:blur(2px)}",
    "#ribiSheetV168 .ribi-panel{position:relative;width:100%;max-width:520px;max-height:78vh;overflow:auto;padding:10px 18px calc(18px + env(safe-area-inset-bottom));border-radius:18px 18px 0 0;border:1px solid rgba(230,178,58,.45);border-bottom:0;" +
      "background:radial-gradient(120% 60% at 0 0,rgba(230,178,58,.14),transparent 60%),linear-gradient(180deg,#1d2026,#111317);box-shadow:0 -18px 40px rgba(0,0,0,.55);transform:translateY(24px);opacity:0;transition:transform .22s ease,opacity .22s ease;color:#e9ecf1}",
    "#ribiSheetV168.on .ribi-back{opacity:1}#ribiSheetV168.on .ribi-panel{transform:none;opacity:1}",
    "#ribiSheetV168 .ribi-grip{width:44px;height:4px;border-radius:4px;background:rgba(255,255,255,.18);margin:0 auto 12px}",
    "#ribiSheetV168 .ribi-k{font:600 11px Oswald,sans-serif;letter-spacing:2.6px;color:#e6b23a}",
    "#ribiSheetV168 .ribi-title{font:700 22px Oswald,sans-serif;letter-spacing:.6px;text-transform:uppercase;margin:2px 0 10px;color:#fff}",
    "#ribiSheetV168 section{padding:10px 0;border-top:1px solid rgba(255,255,255,.07)}",
    "#ribiSheetV168 h4{margin:0 0 4px;font:600 11.5px Oswald,sans-serif;letter-spacing:1.8px;text-transform:uppercase;color:#ffd66b}",
    "#ribiSheetV168 .ribi-txt{font:400 15px/1.45 'Barlow Condensed',system-ui,sans-serif;color:#cfd5de}",
    "#ribiSheetV168 .ribi-txt *{max-height:none!important;-webkit-line-clamp:unset!important;display:revert}",
    "#ribiSheetV168 .ribi-ok{display:block;width:100%;margin-top:14px;padding:13px;border-radius:12px;border:1px solid rgba(230,178,58,.6);background:linear-gradient(180deg,#f3c650,#d99d25);color:#1a1205;font:700 15px Oswald,sans-serif;letter-spacing:1.6px;cursor:pointer}",

    /* the pager */
    ".pager-v168{display:flex;justify-content:space-between;gap:10px;margin:14px 0 4px}",
    ".pager-v168 button{flex:0 1 auto;min-height:40px;padding:9px 14px;border-radius:11px;border:1px solid rgba(230,178,58,.35);background:linear-gradient(180deg,#1d2026,#15171b);color:#ffd66b;font:700 12.5px Oswald,sans-serif;letter-spacing:1.4px;text-transform:uppercase;cursor:pointer}",
    ".pager-v168 .pg-next{margin-left:auto;background:linear-gradient(180deg,rgba(240,187,69,.2),rgba(240,187,69,.07));border-color:rgba(230,178,58,.6)}",

    /* the season hero (07 seasonHeroV168) */
    ".sx-old-v168{display:none!important}",
    "#screen:has(.sx-hero-v168) > .eyebrow,#screen:has(.sx-hero-v168) > .h1{display:none!important}",
    "#screen:has(.sx-hero-v168) .press-strip{gap:5px!important;margin:2px 0 0!important;flex-wrap:nowrap!important;overflow:hidden}",
    "#screen:has(.sx-hero-v168) .press-strip .press-chip{padding:3px 9px!important;font-size:10.5px!important;white-space:nowrap}",
    "#screen:has(.sx-hero-v168) .press-strip .press-chip:nth-child(n+4){display:none!important}",
    ".sx-hero-v168{position:relative;margin:8px 0 12px;padding:12px 12px 12px;border:1px solid rgba(230,178,58,.45);border-radius:14px;overflow:hidden;" +
      "background:radial-gradient(120% 90% at 0 0,rgba(230,178,58,.17),transparent 55%),linear-gradient(180deg,#1d2026,#121418);box-shadow:0 12px 30px rgba(0,0,0,.45),0 0 0 1px rgba(0,0,0,.6)}",
    ".sx-hero-v168:before{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(120deg,rgba(255,255,255,.05),transparent 40%)}",
    ".sx-hero-v168 .sx-top{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:11px}",
    ".sx-hero-v168 .crest-v168{display:block;border-radius:10px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.6))}",
    ".crest-v168.letter{display:inline-flex;align-items:center;justify-content:center;background:#2a2f38;color:#ffd66b;font:700 14px Oswald,sans-serif;font-style:normal}",
    ".sx-team{min-width:0}.sx-team small{display:block;font:600 10.5px Oswald,sans-serif;letter-spacing:1.6px;color:#e6b23a;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".sx-team b{display:block;font:700 20px/1.1 Oswald,sans-serif;letter-spacing:.5px;color:#fff;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".sx-rec{text-align:right}.sx-rec b{display:block;font:700 34px/1 Oswald,sans-serif;color:#fff;letter-spacing:.5px}",
    ".sx-rec small{display:block;margin-top:2px;font:600 10px Oswald,sans-serif;letter-spacing:1.8px;color:#9aa0aa}",
    ".sx-race{margin-top:12px}",
    ".sx-race-k{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}",
    ".sx-race-k span{font:600 10.5px Oswald,sans-serif;letter-spacing:2px;color:#9aa0aa}",
    ".sx-race-k b{font:700 12.5px Oswald,sans-serif;letter-spacing:1.4px;color:#ffd66b}",
    ".sx-hero-v168.in .sx-race-k b,.sx-hero-v168.champ .sx-race-k b{color:#7ddc6e}.sx-hero-v168.out .sx-race-k b{color:#ff8a80}",
    ".pips-v168{display:grid;grid-template-columns:repeat(var(--n),1fr);gap:5px}",
    ".pip-v168{position:relative;display:block;height:12px;border-radius:4px;background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(255,255,255,.05)}",
    ".pip-v168.w{background:linear-gradient(180deg,#5fe08a,#2fa85e)}.pip-v168.l{background:linear-gradient(180deg,#ef6b6b,#b83a3a)}",
    ".pip-v168.dnp{background:repeating-linear-gradient(45deg,#3a3f48 0 3px,#2a2e35 3px 6px)}",
    ".pip-v168.next{background:rgba(240,187,69,.18);box-shadow:inset 0 0 0 1.5px #ffd66b;animation:pipV168 1.6s ease-in-out infinite}",
    "@keyframes pipV168{50%{box-shadow:inset 0 0 0 1.5px #ffd66b,0 0 10px rgba(255,214,107,.45)}}",
    ".pip-v168.line:after{content:'';position:absolute;right:-4px;top:-5px;bottom:-5px;width:2px;border-radius:2px;background:#ffd66b;box-shadow:0 0 6px rgba(255,214,107,.6)}",
    ".sx-race-foot{display:flex;justify-content:space-between;margin-top:5px;font:500 11px 'Barlow Condensed',sans-serif;color:#9aa0aa;letter-spacing:.4px}",
    ".sx-next-v168{margin-top:12px;padding-top:11px;border-top:1px solid rgba(255,255,255,.08)}",
    ".sx-next-k{display:flex;align-items:center;gap:8px;font:600 10.5px Oswald,sans-serif;letter-spacing:2px;color:#9aa0aa}",
    ".stake-v168{margin-left:auto;padding:2px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.14);font:700 10.5px Oswald,sans-serif;letter-spacing:1.4px;color:#cfd5de}",
    ".stake-v168.riv{color:#ff8a80;border-color:rgba(255,122,122,.55);background:rgba(255,90,90,.08)}",
    ".stake-v168.po{color:#ffd66b;border-color:rgba(230,178,58,.6);background:rgba(230,178,58,.1)}",
    ".sx-mu{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px;margin-top:8px}",
    ".sx-side{display:flex;flex-direction:column;align-items:center;text-align:center;min-width:0;gap:3px}",
    ".sx-side b{max-width:100%;font:700 15px Oswald,sans-serif;letter-spacing:.6px;color:#fff;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".sx-side small{font:500 12px 'Barlow Condensed',sans-serif;color:#9aa0aa;letter-spacing:.3px}",
    ".sx-vs{font:italic 700 20px Oswald,sans-serif;color:#e6b23a;letter-spacing:1px;text-shadow:0 0 12px rgba(230,178,58,.35)}",
    ".sx-next-v168.po .sx-vs{color:#ffd66b}",

    /* the schedule rows */
    ".sched-row .crest-v168{display:inline-block;vertical-align:-5px;margin-right:6px;border-radius:5px}",
    ".importance-chip-v11.routine{display:none!important}",
    ".sched-row{border-radius:11px!important}",
    ".sched-row.sched-next{background:linear-gradient(90deg,rgba(240,187,69,.16),rgba(240,187,69,.04))!important;border-color:rgba(230,178,58,.7)!important}",

    /* the league tab (07 leagueCardV168) */
    ".league-card-v168{margin:4px 0 8px;padding:12px;border:1px solid rgba(230,178,58,.35);border-radius:14px;background:linear-gradient(180deg,#1b1e24,#14161a);box-shadow:0 12px 30px rgba(0,0,0,.4)}",
    ".lg-head-v168{display:flex!important;flex-wrap:wrap;align-items:center;gap:2px 8px;margin-bottom:10px}",
    ".lg-head-v168 .k{flex:0 0 100%;font:600 10.5px Oswald,sans-serif;letter-spacing:2.4px;color:#e6b23a}",
    ".lg-head-v168 b{font:700 17px Oswald,sans-serif;letter-spacing:.6px;color:#fff;text-transform:uppercase}",
    ".lg-head-v168 .sub{margin-left:auto;font:600 10px Oswald,sans-serif;letter-spacing:1.4px;color:#9aa0aa}",
    ".lg-head-v168 .ribi-btn-v168{margin-left:6px}",
    ".lg-rows-v168{display:flex;flex-direction:column;gap:4px}",
    ".lg-row-v168{display:grid;grid-template-columns:20px 26px 1fr 42px 40px;align-items:center;gap:8px;padding:6px 8px;border-radius:10px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.04)}",
    ".lg-row-v168 .crest-v168{border-radius:6px}",
    ".lg-row-v168.in .lg-rk{color:#ffd66b}",
    ".lg-row-v168.me{background:linear-gradient(90deg,rgba(240,187,69,.2),rgba(240,187,69,.05));border-color:rgba(230,178,58,.65)}",
    ".lg-rk{font:700 14px Oswald,sans-serif;color:#9aa0aa;text-align:center}",
    ".lg-nm{min-width:0;font:700 14px Oswald,sans-serif;letter-spacing:.5px;color:#f2f3f5;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".lg-nm em{font:700 9.5px Oswald,sans-serif;font-style:normal;letter-spacing:1.2px;color:#1a1205;background:#ffd66b;border-radius:4px;padding:1px 4px;vertical-align:2px}",
    ".lg-nm small{display:block;font:500 11px 'Barlow Condensed',sans-serif;letter-spacing:.4px;color:#9aa0aa;text-transform:none}",
    ".lg-wl{font:700 16px Oswald,sans-serif;color:#fff;text-align:right}",
    ".lg-df{font:600 13px Oswald,sans-serif;text-align:right;color:#9aa0aa}.lg-df.up{color:#7ddc6e}.lg-df.dn{color:#ff8a80}",
    ".lg-cut-v168{display:flex;align-items:center;gap:8px;margin:4px 0;font:600 9.5px Oswald,sans-serif;letter-spacing:2px;color:#e6b23a}",
    ".lg-cut-v168:before,.lg-cut-v168:after{content:'';flex:1;height:1px;background:repeating-linear-gradient(90deg,rgba(230,178,58,.7) 0 6px,transparent 6px 10px)}",

    /* the opponent card (07 Kc) */
    ".opponent-card-v11{border-color:rgba(230,178,58,.45)!important;background:radial-gradient(120% 80% at 100% 0,rgba(230,178,58,.12),transparent 55%),linear-gradient(180deg,#1d2026,#121418)!important;border-radius:14px!important;box-shadow:0 12px 30px rgba(0,0,0,.45)!important}",
    ".opponent-card-v11 .impact-head{display:flex!important;align-items:center;gap:11px}",
    ".opponent-card-v11 .impact-head > .crest-v168{flex:0 0 auto;border-radius:10px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.6))}",
    ".opponent-card-v11 .impact-head > div:nth-child(2){flex:1;min-width:0}",
    ".opponent-card-v11 .h2{font:700 22px/1.05 Oswald,sans-serif!important;letter-spacing:.6px;text-transform:uppercase;color:#fff}",
    ".opponent-card-v11 .impact-kicker{color:#e6b23a!important}",
    ".league-line-v167{opacity:1!important;font:600 12.5px 'Barlow Condensed',sans-serif!important;letter-spacing:.4px;color:#cfd5de!important}",
    ".opponent-card-v11 .scout-confidence-v11{color:#ffd66b!important;text-align:right}",
    ".opponent-card-v11 .scout-confidence-v11 small{color:#9aa0aa!important}",
    ".opponent-card-v11 .matchup-badge-v11{border-color:rgba(230,178,58,.35)!important;color:#ffd66b!important;background:rgba(230,178,58,.07)!important}",
    ".opponent-card-v11 .oppv126{border-radius:12px!important;background:rgba(255,255,255,.03)!important;border-color:rgba(255,255,255,.07)!important}",
    ".opponent-card-v11 .oppv126-grid b{font-family:Oswald,sans-serif!important;font-size:24px!important}",
    ".opponent-card-v11 .oppv126-say{font:400 14.5px/1.4 'Barlow Condensed',system-ui,sans-serif!important;color:#cfd5de!important}",
    /* the accordion headers (22's hubv97 folds) end in an ellipsis, not a cut word */
    ".hubv97-fold > .hubv97-head,.hubv97-head{min-width:0}",
    ".hubv97-head > *:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    /* the hub's season strip */
    ".season-strip-v168{display:block;width:100%;margin:10px 0 2px;padding:10px 12px;border-radius:14px;border:1px solid rgba(230,178,58,.45);text-align:left;cursor:pointer;color:#f2f3f5;" +
      "background:radial-gradient(120% 90% at 0 0,rgba(230,178,58,.15),transparent 55%),linear-gradient(180deg,#1d2026,#121418);box-shadow:0 10px 24px rgba(0,0,0,.4);font-family:inherit}",
    ".season-strip-v168 .ss-top{display:flex;align-items:center;justify-content:flex-start;gap:8px;margin-bottom:8px}",
    ".season-strip-v168 .crest-v168{border-radius:7px}",
    ".season-strip-v168 .ss-top b{font:700 22px/1 Oswald,sans-serif;color:#fff}",
    ".season-strip-v168 .ss-top span{font:600 10.5px Oswald,sans-serif;letter-spacing:1.6px;color:#9aa0aa}",
    ".season-strip-v168 .ss-top em{margin-left:auto;font:700 11px Oswald,sans-serif;font-style:normal;letter-spacing:1.2px;color:#ffd66b;white-space:nowrap}",
    ".season-strip-v168.in .ss-top em,.season-strip-v168.champ .ss-top em{color:#7ddc6e}.season-strip-v168.out .ss-top em{color:#ff8a80}",
    ".season-strip-v168 .ss-next{display:flex;align-items:center;justify-content:flex-start;gap:7px;margin-top:9px;padding-top:8px;border-top:1px solid rgba(255,255,255,.07);min-width:0}",
    ".season-strip-v168 .ss-next span{font:600 10px Oswald,sans-serif;letter-spacing:1.8px;color:#e6b23a}",
    ".season-strip-v168 .ss-next .crest-v168{border-radius:5px}",
    ".season-strip-v168 .ss-next b{font:700 14px Oswald,sans-serif;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}",
    ".season-strip-v168 .ss-next small{font:500 12px 'Barlow Condensed',sans-serif;color:#9aa0aa;white-space:nowrap}",
    ".season-strip-v168 .ss-next em.po{font:700 10px Oswald,sans-serif;font-style:normal;color:#ffd66b;letter-spacing:1px;white-space:nowrap}",
    ".season-strip-v168 .ss-next i{margin-left:auto;font:700 20px/1 Oswald,sans-serif;font-style:normal;color:#e6b23a}",
    "#screen > .sac-v153{margin-top:8px!important}",
    /* the post-game card (07's v13 pgOverlayV13) */
    "#pgOverlayV13 .decision-panel{border-color:rgba(230,178,58,.55)!important;border-radius:16px!important;background:radial-gradient(120% 60% at 50% 0,rgba(230,178,58,.16),transparent 60%),linear-gradient(180deg,#1d2026,#111317)!important;box-shadow:0 20px 50px rgba(0,0,0,.6)!important}",
    "#pgOverlayV13 .decision-kicker{text-align:center;color:#e6b23a!important;letter-spacing:2.4px}",
    "#pgOverlayV13 .decision-title{display:flex;align-items:center;justify-content:center;gap:10px;font-family:Oswald,sans-serif!important;font-size:30px!important;letter-spacing:.5px;text-align:center}",
    "#pgOverlayV13 .decision-title .crest-v168{flex:0 0 auto;border-radius:8px;filter:drop-shadow(0 3px 6px rgba(0,0,0,.6))}",
    ".pg-season-v168{margin:8px 0 8px;padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.07)}",
    ".pg-season-v168.in .sx-race-k b{color:#7ddc6e}.pg-season-v168.out .sx-race-k b{color:#ff8a80}",
    ".pip-v168.now{animation:pipNowV168 1.2s ease-out 1}",
    "@keyframes pipNowV168{0%{transform:scaleY(.2);opacity:.2}60%{transform:scaleY(1.4)}100%{transform:none;opacity:1}}",
    "#pgOverlayV13 .stat-sec-label{color:#e6b23a!important}",
    ".lb2-row .lbn .crest-v168{display:inline-block;vertical-align:-6px;margin-right:7px;border-radius:5px}",
    /* the standings screen's OVR tag (v167) was near-invisible */
    ".standings-ovr-v167,.st-ovr-v167{color:#9aa0aa!important;opacity:1!important}"
  ].join("\n");
  function css() {
    if (document.getElementById("ribiCssV168")) return;
    var s = document.createElement("style"); s.id = "ribiCssV168"; s.textContent = CSS; document.head.appendChild(s);
  }

  var queued = false;
  function run() { queued = false; try { css(); fold(); hubStrip(); pager() } catch (e) {} }
  function queue() { if (queued) return; queued = true; requestAnimationFrame(run) }
  try { new MutationObserver(queue).observe(document.body, { childList: true, subtree: true }) } catch (e) {}
  setInterval(queue, 700);
  css();
  window.__V168UI = { fold: fold, pager: pager, open: openFor, close: closeSheet, rules: RULES };
})();
