
/* ===== v139 THE BOTTOM OF THE SCREEN IS THE WAY AROUND =====
 * Every destination in a career lived behind a hamburger in the top-left corner of a phone — the
 * one corner a thumb cannot reach — and the only thing at the bottom, where the thumb IS, was the
 * dock's one button. Five destinations sit there now, under the dock: the hub, the season, the
 * skill sheet, the prestige tree and the main menu, with the one you are on lit.
 *
 * It is a sweep rather than markup inside each screen's template, because every screen builds its
 * own `#screen.innerHTML` from scratch and would have to remember to include it. The bar measures
 * itself into the same `--dockH-v139` reserve the dock does, so nothing it covers is unreachable.
 *
 * And the long explanations fold: a paragraph that runs past three lines is clamped with a MORE
 * on it. The text stays in the DOM — this is `-webkit-line-clamp`, not a truncation — so anything
 * reading the page still reads all of it. */
(function () {
  var NAV = [
    { k: "hub",      go: "hub",      icon: "\u{1F3E0}", label: "HUB",    views: ["hub", "life", "daily"] },
    { k: "season",   go: "season",   icon: "\u{1F4C5}", label: "SEASON", views: ["season", "event", "sim", "result"] },
    { k: "upgrade",  go: "upgrade",  icon: "\u{1F4C8}", label: "SKILLS", views: ["upgrade", "training"] },
    { k: "shop",     go: "shop",     icon: "\u{1F333}", label: "TREE",   views: ["shop", "highscore"] },
    { k: "menu",     go: "menu",     icon: "\u2630",    label: "MENU",   views: ["menu", "settings"] }
  ];
  var OFF = { live: 1, win: 1, gameover: 1, menu: 1 };          // no bar over the broadcast or the main menu
  var OVERLAYS = "#growthV42,#pregameV1513,#pgOverlayV13,#personaV13,#growV132,#rib-vault-v137,.gameplan-overlay,.team-modal-v153,#teamModalV153";
  var bar = null, lastKey = "", lastOn = null;

  function state() {
    try {
      var S = window.S;
      if (!S || !S.player) return null;
      if (OFF[S.view]) return null;
      if (document.querySelector(OVERLAYS)) return null;
      if (document.body.classList.contains("rib-menu-open")) return null;
      return S.view || "";
    } catch (e) { return null }
  }
  function build() {
    if (bar) return;
    bar = document.createElement("nav");
    bar.id = "navV139";
    bar.setAttribute("aria-label", "Sections");
    bar.innerHTML = NAV.map(function (n) {
      return '<button type="button" data-k="' + n.k + '"><i>' + n.icon + "</i><b>" + n.label + "</b></button>";
    }).join("");
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-k]"); if (!b) return;
      var n = NAV.filter(function (x) { return x.k === b.dataset.k })[0]; if (!n) return;
      try { window.go(n.go) } catch (err) {}
    });
    document.body.appendChild(bar);
  }
  function sync() {
    var v = state();
    if (v === null) { if (bar && lastOn !== false) { bar.classList.remove("on"); lastOn = false } return }
    build();
    if (lastOn !== true) { bar.classList.add("on"); lastOn = true }
    if (v !== lastKey) {
      lastKey = v;
      [].forEach.call(bar.children, function (b) {
        var n = NAV.filter(function (x) { return x.k === b.dataset.k })[0];
        b.classList.toggle("on", !!(n && n.views.indexOf(v) >= 0));
      });
    }
  }

  /* the long explanations */
  var CLAMP = ".screen .sub,.screen .pd,.screen .fx-desc,.screen .threshold-note,.screen .small,.screen .sd";
  function clamp() {
    try {
      var els = document.querySelectorAll(CLAMP);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.dataset.v139 || el.querySelector("button,input,canvas")) continue;
        el.dataset.v139 = "1";
        if (!el.textContent.trim()) continue;
        /* nothing here is clipped to begin with, so scrollHeight always equals clientHeight:
         * clamp it FIRST, ask whether that actually hid anything, and put it back if not */
        el.classList.add("clamp-v139");
        if (el.scrollHeight - el.clientHeight < 12) { el.classList.remove("clamp-v139"); continue }
        var b = document.createElement("button");
        b.type = "button"; b.className = "more-v139"; b.textContent = "MORE";
        b.onclick = function (ev) {
          ev.stopPropagation();
          var p = this.previousSibling;
          var open = p.classList.toggle("open-v139");
          this.textContent = open ? "LESS" : "MORE";
        };
        el.parentNode.insertBefore(b, el.nextSibling);
      }
    } catch (e) {}
  }

  function tick() { sync(); clamp() }
  try { new MutationObserver(tick).observe(document.body, { childList: true, subtree: true }) } catch (e) {}
  addEventListener("resize", tick);
  setInterval(tick, 400);
  tick();
  window.__NAV_V139 = { sync: sync, clamp: clamp, bar: function () { return bar }, items: NAV };
})();
