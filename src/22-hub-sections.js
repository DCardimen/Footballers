
/* ===== v75 HUB SECTIONS — the screen you come back to after everything fits =====
 * The hub is where the career loop returns after every single action, and it had
 * grown to eighteen stacked blocks and 3898px on a 844px phone: 3.6 screens of
 * scroll, which means that on arrival you can see the top of the hero card and
 * nothing else. Every one of those eighteen blocks is worth having — the depth
 * chart, the body ledger, the rival, the promotion target, the attribute sheet —
 * but a stack is the wrong shape for eighteen of anything.
 *
 * They are grouped into five sections behind a tab strip instead: NOW (who you are
 * and what this week asks), BODY (condition and the age curve), SKILLS (the
 * attribute sheet), TEAM (the world, the rival, the wire) and STORY (identity,
 * missions, objectives, legacy). Each one fits a phone on its own.
 *
 * This is a PRESENTATION pass and deliberately nothing else: it moves the blocks
 * the hub already rendered into containers and hides four of the five. It adds no
 * card, removes none, and changes no card's markup — which is what lets it sit
 * safely on top of a dozen patch layers that each insert into #screen by querying
 * for their neighbours. It runs off a MutationObserver plus a sweep, the same way
 * v51 hooks the game-plan overlay, so it does not have to find the end of the
 * render-wrapper chain: every render rebuilds #screen from scratch, the tab strip
 * disappears with it, and the next sweep re-sections whatever is now there.
 *
 * Classification is by class first, then by text for the two cards that carry no
 * class of their own, and anything still unmatched INHERITS the block above it —
 * which is what keeps the "Attributes" heading, the attribute sheet and its
 * how-it-works footnote together as one run without naming each of them. ===== */
(function () {
  "use strict";
  // One config per screen that needs splitting. `keep` names the blocks that are the
  // screen's HEADER and stay above the strip in every tab; `secs` classify by class;
  // `txt` covers the blocks that carry no class of their own; anything still
  // unmatched INHERITS the block above it, which is what holds a run like the
  // "Attributes" heading + its sheet + its footnote together without naming each.
  const VIEWS = {
    hub: {
      start: "now",
      secs: [
        { k: "now",    name: "NOW",    re: /player-hero|depth-card/ },
        { k: "body",   name: "BODY",   re: /condition-card-v11|age-card/ },
        { k: "skills", name: "SKILLS", re: /(?!)/ },    // reached by text + inheritance only
        { k: "team",   name: "TEAM",   re: /world-card|rival-card-v11|weekly-loop-card|pulse-card|headline-card|nem-banner/ },
        { k: "story",  name: "STORY",  re: /identity-card-v11|mission-card|objective-card|legacy-progress-v11|arc-card-v11|nfl-survival-v11|story-feed/ },
      ],
      txt: [
        { k: "now",    re: /PROMOTION TARGET|NATIONAL RANK/i },
        { k: "skills", re: /^\s*Attributes\s*$/ },
      ],
    },
    /* v126: the season screen is the other one you come back to every week, and it had grown
     * the same way the hub did — the role battle, the scouting report, the whole 720px body
     * ledger, the press strip and the schedule stacked into 1,878px on an 844px phone. Same
     * treatment, same machinery: four tabs, one screen each, and the schedule first because
     * that is the screen's name. The eyebrow and the H1 are the header and stay above the
     * strip whatever tab is open, even though the role card renders between them. */
    season: {
      start: "sched",
      keep: /(^|\s)(eyebrow|h1)(\s|$)/,
      secs: [
        { k: "sched", name: "SCHEDULE", re: /sched-list|press-strip/ },
        { k: "opp",   name: "OPPONENT", re: /opponent-card-v11/ },
        { k: "body",  name: "BODY",     re: /condition-card-v11|age-card/ },
        { k: "role",  name: "ROLE",     re: /rival-card-v11|weekly-loop-card|depth-card|objective-card|mission-card|arc-card-v11|identity-card-v11/ },
      ],
      txt: [{ k: "sched", re: /^\s*Record:/i }],
      // the schedule IS the tab: folding it puts the press strip on screen and the fixtures
      // behind a closed accordion header, which is the opposite of the point
      nofold: ["sched"],
    },
    /* v139: Settings is nearly two full screens on a phone — the longest page in the game, and
     * every one of its cards is a thing you came for ON PURPOSE, so it tabs rather than folds.
     * There is nothing to key on but the headings: every card here is a bare `.card`. */
    settings: {
      start: "game",
      keep: /(^|\s)(eyebrow|h1)(\s|$)/,
      /* `secs` is what builds the tab strip; the classification itself is the `txt` rules below,
       * so these patterns are deliberately unmatchable against a bare `card` class */
      secs: [
        { k: "game",   name: "GAME",     re: /\bnever-v139\b/ },
        { k: "sound",  name: "SOUND",    re: /\bsnd-v151e\b/ },   // v151 E THE BAND PLAYS: the card carries the class
        { k: "field",  name: "FIELD",    re: /\bnever-v139\b/ },
        { k: "family", name: "FAMILY",   re: /\bnever-v139\b/ },
        { k: "save",   name: "SAVE",     re: /\bnever-v139\b/ },
        { k: "danger", name: "RESET",    re: /\bnever-v139\b/ },
      ],
      txt: [
        { k: "game",   re: /LIVE GAME/i },
        { k: "field",  re: /FIELD VIEW/i },
        { k: "family", re: /FAMILY NAME/i },
        { k: "save",   re: /SAVE DATA|BACKUP \/ TRANSFER|STORE & PURCHASES/i },   // v150 C H10: the store row (only while monetization is on)
        { k: "danger", re: /DANGER ZONE/i },
      ],
      nofold: ["game", "sound", "field", "family", "save", "danger"],
    },
    /* v146 E: the season report card was nineteen stacked blocks — 1,700px on a phone that shows
     * 560 of them between the shell's two ends. Same machinery, four tabs: the GRADE (the card and the
     * coach's summary under it — what the year MEANT), the SEASON (the record, the contracts, the rival,
     * the awards), the STATS against the promotion target, and the GROWTH (the age curve, the legacy line,
     * the depth chart, what the year did to him, the points it paid, the week-by-week why). */
    result: {
      start: "grade",
      secs: [
        { k: "grade",  name: "GRADE",  re: /coach-sum-v136/ },
        { k: "season", name: "SEASON", re: /(^|\s)eyebrow(\s|$)/ },
        { k: "stats",  name: "STATS",  re: /\bnever-v146\b/ },
        { k: "growth", name: "GROWTH", re: /age-card|feedback-v12|legacy-progress-v11|depth-card/ },
      ],
      txt: [
        { k: "grade",  re: /^SEASON REPORT CARD/i },
        { k: "stats",  re: /^Season Stats vs/i },
        { k: "growth", re: /^Development$/i },
      ],
      // the grade and the COACH'S SUMMARY button under it are the tab: never behind an accordion header
      nofold: ["grade"],
    },
    /* v150 A: the three career-end screens were one long stack — the failed-declare epitaph measured 2.15
     * screens in the shell's panel. Same machinery as the report card: the verdict first (the banner, the
     * legacy grade, what it paid), then the rest one tap each. The epitaph keeps its "one shot" line on the
     * first tab. The retirement plan and the last-thought vow ride their own LIFE tab on the gameover screen. */
    declineResult: {
      start: "epitaph",
      secs: [
        { k: "epitaph", name: "EPITAPH", re: /(^|\s)banner(\s|$)/ },
        { k: "totals",  name: "TOTALS",  re: /\bnever-v150\b/ },
        { k: "best",    name: "BEST",    re: /\bnever-v150\b/ },
        { k: "log",     name: "LOG",     re: /\bnever-v150\b/ },
      ],
      txt: [
        { k: "totals", re: /^Career Totals$/i },
        { k: "best",   re: /^Best Season$/i },
        { k: "log",    re: /^Career Log$/i },
      ],
      nofold: ["epitaph"],
    },
    gameover: {
      start: "end",
      secs: [
        { k: "end",    name: "THE END", re: /(^|\s)banner(\s|$)|legacy-summary-v11|end-pay-v150/ },
        { k: "life",   name: "LIFE",    re: /regret-card-v12|finance-legacy-v12/ },
        { k: "log",    name: "LOG",     re: /\bnever-v150\b/ },
        { k: "legacy", name: "HIS SON", re: /end-legacy-v150/ },
      ],
      txt: [{ k: "log", re: /^Career Log$/i }],
    },
    win: {
      start: "end",
      secs: [
        { k: "end",    name: "THE END", re: /(^|\s)banner(\s|$)|legacy-summary-v11|end-pay-v150/ },
        { k: "log",    name: "JOURNEY", re: /\bnever-v150\b/ },
        { k: "legacy", name: "HIS SON", re: /end-legacy-v150/ },
      ],
      txt: [{ k: "log", re: /^The Journey$/i }],
    },
    // the prestige tree put 862px of specialization and rewards cards ABOVE the
    // branch row, so the shop you came for started a screen and a half down
    shop: {
      start: "nodes",
      keep: /(^|\s)(eyebrow|h1|sub)(\s|$)|pts-banner/,
      secs: [
        { k: "nodes", name: "NODES", re: /btn-row/ },
        { k: "perks", name: "PERKS", re: /specialization-card-v11|legacy-rewards-v11/ },
      ],
      txt: [],
      // v134: the nodes ARE the tab. Folding it made the branch strip the one open panel and put the
      // whole node list behind a closed accordion header -- the tree "loaded wrong" until you tapped it.
      nofold: ["nodes"],
    },
  };
  const ICON = { now: "🏈", body: "🩹", skills: "📈", team: "🏟", story: "📖", nodes: "🌳", perks: "🧠", sched: "📅", opp: "🎯", role: "⚔️", game: "🎮", sound: "🔊", field: "📐", family: "👨‍👦", save: "💾", danger: "⚠️", grade: "🅰️", season: "🏟", stats: "📊", growth: "🌱", epitaph: "🥀", totals: "📊", best: "⭐", log: "📜", end: "🏁", life: "🌅", legacy: "👨‍👦" };
  const TAB = { hub: "now", shop: "nodes", season: "sched", settings: "game", result: "grade", declineResult: "epitaph", gameover: "end", win: "end" };

  function cfg() { const s = window.S; return (s && VIEWS[s.view]) || null }
  function classify(el, C) {
    const cls = el.className || "";
    for (const s of C.secs) if (s.re.test(cls)) return s.k;
    const t = (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 80);
    for (const r of C.txt) if (r.re.test(t)) return r.k;
    return null;                                        // inherit
  }

  function css() {
    if (document.getElementById("hubv75css")) return;
    const st = document.createElement("style");
    st.id = "hubv75css";
    st.textContent =
      ".hubv75-tabs{display:flex;gap:4px;margin:10px 14px 2px;padding:3px;border-radius:11px;" +
      "background:rgba(10,17,27,.9);border:1px solid rgba(255,255,255,.07);position:sticky;top:0;z-index:6;" +
      "box-shadow:0 6px 14px rgba(0,0,0,.45)}" +
      ".hubv75-tab{flex:1 1 0;min-width:0;padding:7px 2px 6px;border:0;border-radius:8px;cursor:pointer;" +
      "background:transparent;color:#8fa2bb;font:700 9.5px Oswald,sans-serif;letter-spacing:1.4px;" +
      "display:flex;flex-direction:column;align-items:center;gap:2px;transition:background .12s,color .12s}" +
      ".hubv75-tab i{font-style:normal;font-size:13px;line-height:1}" +
      ".hubv75-tab.on{background:linear-gradient(180deg,rgba(240,187,69,.22),rgba(240,187,69,.08));color:#ffd76f;" +
      "box-shadow:0 0 0 1px rgba(240,187,69,.4) inset}" +
      ".hubv75-tab b{position:absolute;opacity:0}" +
      ".hubv75-sec{display:none}.hubv75-sec.on{display:block}" +
      "@media(prefers-reduced-motion:reduce){.hubv75-tab{transition:none}}" +
      /* ---- v75 compaction: two screens are ONE long list each, so a tab strip has
         nothing to split. They get their row height back instead. The upgrade row
         carried its metric and its (v67) cap readout on two separate lines under a
         two-line description; one line each takes 100px a row down to ~62, which is
         660px off a seventeen-stat sheet. ---- */
      ".up-attr .desc{display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}" +
      ".up-attr .up-metric,.up-attr .up-cap{display:inline-block;vertical-align:baseline;margin-top:1px}" +
      ".up-attr .up-metric{margin-right:9px}" +
      ".up-attr{padding-top:7px;padding-bottom:7px}" +
      /* the training board is twelve programs; the scene art and the chip rows are
         what make each one 163px tall */
      ".train-card{padding:9px 11px}" +
      ".train-card .gv64-ico{width:40px!important;height:40px!important}" +
      ".train-head{gap:9px}" +
      ".train-chips{margin-top:5px;gap:4px}" +
      ".train-chip{padding:2px 6px;font-size:9.5px}" +
      ".train-meta{font-size:9.5px}" +
      /* the prestige tree's eight branch buttons wrapped to three rows before a
         single node was on screen; one scrollable line gives that back */
      /* the branch row carries an inline flex-wrap, so this is the one place the
         compaction has to out-rank a style attribute */
      ".hubv75-sec[data-sec=\"nodes\"] .btn-row{display:flex;flex-wrap:nowrap!important;overflow-x:auto;gap:6px;scrollbar-width:none;-webkit-overflow-scrolling:touch}" +
      ".hubv75-sec[data-sec=\"nodes\"] .btn-row::-webkit-scrollbar{display:none}" +
      ".hubv75-sec[data-sec=\"nodes\"] .btn-row>*{flex:0 0 auto;white-space:nowrap}" +
      ".shop-item{padding-top:8px;padding-bottom:8px}" +
      /* v97 THE FOLD */
      ".hubv97-fold{margin:6px 0;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(10,17,27,.55);overflow:hidden}" +
      ".hubv97-head{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 14px;border:0;background:transparent;color:#dfe6ef;font:700 12px Oswald,sans-serif;letter-spacing:2px;text-transform:uppercase;text-align:left;cursor:pointer}" +
      ".hubv97-head i{font-style:normal;color:#f0bb45;transition:transform .18s}" +
      ".hubv97-fold.on .hubv97-head{background:linear-gradient(180deg,rgba(240,187,69,.14),rgba(240,187,69,.04));color:#ffd76f}" +
      ".hubv97-fold.on .hubv97-head i{transform:rotate(180deg)}" +
      ".hubv97-body{display:none;padding:0 6px 6px}.hubv97-fold.on .hubv97-body{display:block;animation:hubv97in .18s ease-out}" +
      ".hubv97-body>*{margin-top:0!important}.hubv97-body>.hubv97-titled{display:none}" +
      "@keyframes hubv97in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}" +
      "@media(prefers-reduced-motion:reduce){.hubv97-fold.on .hubv97-body{animation:none}.hubv97-head i{transition:none}}";
    (document.head || document.documentElement).appendChild(st);
  }

  /* ===== v97 THE FOLD — a tab longer than one phone screen folds into an accordion =====
   * NOW and SKILLS run past 844px even sectioned. When a section (measured while it is
   * showing) is taller than the viewport, every block in it after the first becomes a
   * folded panel with a header cut from its own heading; tapping a header opens that
   * panel and folds the others, so switching between them is one tap and no scroll. The
   * open panel per section is remembered (FOLD[view][sec]) across the hub's constant
   * re-renders; a section that fits stays a plain stack. ===== */
  const FOLD = {};
  function headingOf(el) {   // the block's own heading: a title element with letters in it, never a bold number
    const clean = (x) => (x || "").replace(/\s+/g, " ").trim().replace(/^[^A-Za-z0-9]+/, "");
    const cands = [...el.querySelectorAll(".h1,.h2,h2,h3,.card-title,.sec-title,.eyebrow,.kicker,b,strong")].map(h => clean(h.textContent)).filter(t => /[A-Za-z]{3}/.test(t));
    let t = cands[0] || clean(el.textContent).split(/[.!?·]/)[0];
    return (t || "MORE").slice(0, 34);
  }
  function isTitle(el) {   // a heading on its own line, no card of its own: it names the block after it
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    return t.length > 0 && t.length <= 44 && !/\bcard\b/.test(el.className || "") && el.offsetHeight < 64 && !el.querySelector("button,input,canvas");
  }
  function fold(box, view) {
    if (!box || box.__foldedV97 || !box.classList.contains("on")) return;
    const raw = [...box.children].filter(e => e.nodeType === 1);
    const dock = document.getElementById("dock"), avail = (window.innerHeight || 844) - (dock ? dock.offsetHeight : 0);
    // v146 E: in the shell the room is the panel's own, measured from the panel's top
    const scV146 = document.documentElement.classList.contains("shell-v146") && document.getElementById("screen");
    if (raw.length < 2 || (scV146 ? box.offsetTop + box.scrollHeight <= scV146.clientHeight : box.offsetTop + box.scrollHeight <= avail)) return;      // it fits between the bar and the dock: a plain stack
    // group: a bare heading joins the block that follows it, as its title
    const groups = []; let pend = null;
    for (const el of raw) { if (isTitle(el) && !pend) { pend = el; continue; } groups.push({ title: pend, els: pend ? [pend, el] : [el] }); pend = null; }
    if (pend) groups.push({ title: null, els: [pend] });
    if (groups.length < 2) return;
    box.__foldedV97 = true; box.classList.add("hubv97-folded");
    const sec = box.dataset.sec, key = view + ":" + sec; if (FOLD[key] == null) FOLD[key] = 0;
    groups.forEach((g, i) => {
      const wrap = document.createElement("div"); wrap.className = "hubv97-fold" + (i === FOLD[key] ? " on" : "");
      const head = document.createElement("button"); head.type = "button"; head.className = "hubv97-head";
      const title = g.title ? (g.title.textContent || "").replace(/\s+/g, " ").trim().slice(0, 34) : headingOf(g.els[0]);
      head.innerHTML = "<span>" + title.replace(/</g, "&lt;") + "</span><i>▾</i>";
      const body = document.createElement("div"); body.className = "hubv97-body";
      box.insertBefore(wrap, g.els[0]); wrap.appendChild(head); wrap.appendChild(body); g.els.forEach(el => body.appendChild(el));
      if (g.title) g.title.classList.add("hubv97-titled");
      head.addEventListener("click", () => {
        const open = wrap.classList.contains("on");
        box.querySelectorAll(":scope > .hubv97-fold").forEach(f => f.classList.remove("on"));
        if (!open) { wrap.classList.add("on"); FOLD[key] = i; try { const scV = document.getElementById("screen"); if (document.documentElement.classList.contains("shell-v146") && scV) scV.scrollTo({ top: Math.max(0, wrap.offsetTop - 4), behavior: "smooth" }); else wrap.scrollIntoView({ block: "start", behavior: "smooth" }); } catch (e) {} } else FOLD[key] = -1;
      });
    });
  }
  function foldAll(screen) { try { const v = window.S && window.S.view, C = cfg();
    screen.querySelectorAll(".hubv75-sec.on").forEach(b => { if (C && C.nofold && C.nofold.indexOf(b.dataset.sec) >= 0) return; fold(b, v); }); } catch (e) {} }
  function section(screen, C) {
    const kids = [...screen.children].filter(e => e.nodeType === 1);
    if (!kids.length) return false;
    const view = window.S.view;
    const head = [], bucket = {};
    for (const s of C.secs) bucket[s.k] = [];
    let cur = C.start;
    for (const el of kids) {
      if (C.keep && C.keep.test(el.className || "")) { head.push(el); continue }
      const k = classify(el, C);
      if (k) cur = k;
      bucket[cur].push(el);
    }
    const live = C.secs.filter(s => bucket[s.k].length);
    if (live.length < 2) return false;                   // nothing to split
    if (!live.some(s => s.k === TAB[view])) TAB[view] = live[0].k;
    const on = TAB[view];

    css();
    const tabs = document.createElement("div");
    tabs.className = "hubv75-tabs";
    tabs.innerHTML = live.map(s =>
      `<button type="button" class="hubv75-tab${s.k === on ? " on" : ""}" data-sec="${s.k}">` +
      `<i>${ICON[s.k] || "•"}</i>${s.name}</button>`).join("");
    const frag = document.createDocumentFragment();
    for (const el of head) frag.appendChild(el);          // the screen's own header, always up
    frag.appendChild(tabs);
    for (const s of live) {
      const box = document.createElement("div");
      box.className = "hubv75-sec" + (s.k === on ? " on" : "");
      box.dataset.sec = s.k;
      for (const el of bucket[s.k]) box.appendChild(el);
      frag.appendChild(box);
    }
    screen.appendChild(frag);
    tabs.addEventListener("click", (e) => {
      const b = e.target.closest(".hubv75-tab"); if (!b) return;
      TAB[view] = b.dataset.sec;
      screen.querySelectorAll(".hubv75-tab").forEach(t => t.classList.toggle("on", t.dataset.sec === TAB[view]));
      screen.querySelectorAll(".hubv75-sec").forEach(t => t.classList.toggle("on", t.dataset.sec === TAB[view]));
      try { screen.scrollTop = 0; window.__SHELL_V146 ? window.__SHELL_V146.top() : 0 } catch (er) {}   // v146 E: the panel back to its top, never scrollIntoView (it scrolled the page)
      foldAll(screen);   // v97: the tab just shown folds if it runs past the phone
    });
    foldAll(screen);
    return true;
  }

  // a later layer can still insert a card straight into #screen after we have
  // sectioned it; those are adopted into the section they belong to rather than
  // left floating above the tab strip
  function adopt(screen, C) {
    const strays = [...screen.children].filter(e =>
      !e.classList.contains("hubv75-tabs") && !e.classList.contains("hubv75-sec")
      && !(C.keep && C.keep.test(e.className || "")));
    if (!strays.length) return;
    for (const el of strays) {
      const k = classify(el, C) || C.start;
      const box = screen.querySelector('.hubv75-sec[data-sec="' + k + '"]')
        || screen.querySelector(".hubv75-sec");
      if (box) box.appendChild(el);
    }
  }

  let t = null;
  function sweep() {
    try {
      const C = cfg(); if (!C) { css(); return }          // css() still carries the compaction
      const screen = document.getElementById("screen");
      if (!screen) return;
      if (screen.querySelector(":scope > .hubv75-tabs")) { adopt(screen, C); foldAll(screen); return; }
      // wait for the render to settle: these screens are assembled by a chain of patch
      // layers and sectioning half of one would strand the rest above the strip
      clearTimeout(t);
      t = setTimeout(() => {
        try {
          const sc = document.getElementById("screen"), C2 = cfg();
          if (sc && C2 && !sc.querySelector(":scope > .hubv75-tabs")) section(sc, C2);
        } catch (e) {}
      }, 90);
    } catch (e) {}
  }
  try { new MutationObserver(sweep).observe(document.body, { childList: true, subtree: true }) } catch (e) {}
  setInterval(sweep, 300);
  css();
  try { window.__HUB_V75 = { views: VIEWS, tabs: TAB, sweep } } catch (e) {}
})();
