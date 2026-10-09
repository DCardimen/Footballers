
/* ===== v193 V ICONS IN THE MENU'S STYLE =====
 * The owner: "Can you update the icons to more closely match the style of the main page assets?" The main
 * menu's tiles are painted, metallic, softly lit objects on dark plates with gold accents; everywhere else the
 * game drew its icons with the phone's emoji font. This is ONE icon set for the career's most visible icons —
 * the bottom nav (here), the section tab strip and the section bar (22, 34), the prestige tree's branch tabs
 * (07) — in the menu's own language:
 *   - where a menu tile already paints the thing, the tile's art IS the icon (the football, the dumbbell, the
 *     gear, the jersey, the Hall's three men, the prestige coin, the gold badges and the legacy star / laurel),
 *     an <img> through `window.__RIB_ASSET`, `image-rendering:auto`, `object-fit:contain`;
 *   - where none does, an inline SVG drawn in the same light: a metal gradient fill (gold, or the branch's own
 *     colour for the tree), a dark outline, a white specular from the top left, engraved dark detail and a soft
 *     drop shadow — the shared gradients live once in a hidden <svg id="ricDefsV193V"> (never display:none,
 *     or Chrome drops gradients referenced across SVGs).
 * `window.ribIconV193V(name, emoji, {tint})` returns the markup; `name` is a glyph, or an alias: a nav key
 * (`nav:hub`), a section key (`sec:now`), a branch key (`branch:physical`) or the emoji itself (the spray's
 * pages). An unknown name, the kill switch `TU("v193V", 0)` or an image that fails to load all give the emoji
 * back (the error listener swaps a broken <img> for `<span class="ric-fb-v193v">emoji</span>`). The node icons
 * inside the tree's lists stay emoji (~150 of them). `window.__V193V`; scripts/v193Vcheck.mjs. */
(function () {
  "use strict";
  function on() { try { var t = window.RIB_TUNE; return !(t && t.v193V !== undefined && !t.v193V) } catch (e) { return true } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] }) }
  function asset(p) { try { return window.__RIB_ASSET ? window.__RIB_ASSET(p) : "./public/" + p } catch (e) { return "./public/" + p } }

  /* the menu's own paintings */
  var ART = {
    football: "menu/icon_career.webp", dumbbell: "menu/icon_training.webp", cog: "menu/icon_settings.webp",
    jersey: "menu/icon_locker.webp", team: "menu/icon_hall.webp", playbook: "menu/icon_goals.webp",
    coin: "vault/coin_gold_face.webp", brain: "menu/badge_brain.webp", target: "menu/badge_target.webp",
    shield: "menu/badge_shield.webp", clock: "menu/badge_clock.webp", crown: "menu/badge_crown.webp",
    bolt: "menu/badge_lightning.webp", fist: "menu/badge_fist.webp", shoe: "menu/badge_shoe.webp",
    eye: "menu/badge_eye.webp", star: "menu/legacy_star.webp", laurel: "menu/legacy_laurel.webp"
  };

  /* the drawn ones, on a 24-unit grid: m = metal fills, ml = metal strokes, d = engraved dark fills,
   * dl = engraved dark strokes. Bold silhouettes: they are read at 20-26 px. */
  var C = function (x, y, r) { return "M" + (x - r) + " " + y + "a" + r + " " + r + " 0 1 0 " + (2 * r) + " 0a" + r + " " + r + " 0 1 0 " + (-2 * r) + " 0z" };
  var G = {
    calendar: { m: ["M5.5 5h13A2.5 2.5 0 0 1 21 7.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5v-11A2.5 2.5 0 0 1 5.5 5z", "M7 2.4h2.6v5.2H7zM14.4 2.4H17v5.2h-2.6z"],
      dl: ["M3.4 9.8h17.2"], d: ["M6.4 12h2.4v2.2H6.4zM10.8 12h2.4v2.2h-2.4zM15.2 12h2.4v2.2h-2.4zM6.4 16h2.4v2.2H6.4zM10.8 16h2.4v2.2h-2.4z"] },
    trophy: { m: ["M6.6 2.8h10.8v1.6h3.4v2.4c0 2.8-2 4.9-4.6 5.2-.8 1.6-2 2.6-3.3 2.9v2.3h2.6c1 0 1.7.7 1.7 1.7v1.3H6.8v-1.3c0-1 .7-1.7 1.7-1.7h2.6v-2.3c-1.3-.3-2.5-1.3-3.3-2.9C5.2 11.7 3.2 9.6 3.2 6.8V4.4h3.4zM5 6.1v.7c0 1.5.9 2.7 2.2 3.2-.4-1.2-.6-2.5-.6-3.9zM19 6.1h-1.6c0 1.4-.2 2.7-.6 3.9 1.3-.5 2.2-1.7 2.2-3.2z", "M5.4 20.2h13.2v2H5.4z"],
      d: ["M12 5l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"] },
    book: { m: ["M12 6.3C10 4.9 7.1 4.3 2.6 4.5v14.3c4.5-.2 7.4.4 9.4 1.8 2-1.4 4.9-2 9.4-1.8V4.5c-4.5-.2-7.4.4-9.4 1.8z"],
      dl: ["M12 6.6v13.6", "M5 8.4h4.6M5 11.2h4.6M5 14h4.6M14.4 8.4H19M14.4 11.2H19M14.4 14H19"] },
    heart: { m: ["M12 21.2s-8.8-5.3-8.8-11.6c0-3.3 2.4-5.5 5.1-5.5 1.6 0 3 .8 3.7 2.1.7-1.3 2.1-2.1 3.7-2.1 2.7 0 5.1 2.2 5.1 5.5 0 6.3-8.8 11.6-8.8 11.6z"],
      dl: ["M4.6 11.6h3.8l1.6-3.2 2.6 6.2 1.8-3h5"] },
    rise: { m: ["M12 2.4 20.8 11h-5.2v5.2H8.4V11H3.2z", "M8.4 18h7.2v3.6H8.4z"] },
    idcard: { m: ["M3.6 5h16.8A1.6 1.6 0 0 1 22 6.6v10.8a1.6 1.6 0 0 1-1.6 1.6H3.6A1.6 1.6 0 0 1 2 17.4V6.6A1.6 1.6 0 0 1 3.6 5z"],
      d: [C(8, 10.6, 2), "M4.6 16.4c.3-2 1.7-3.2 3.4-3.2s3.1 1.2 3.4 3.2z"], dl: ["M13.6 9.6h5.4M13.6 12.2h5.4M13.6 14.8h3.4"] },
    skip: { m: ["M2.6 5.2 11.4 12l-8.8 6.8zM11.6 5.2 20.4 12l-8.8 6.8z", "M19.6 5.2h2.4v13.6h-2.4z"] },
    palette: { m: ["M12 3C7 3 2.8 6.8 2.8 11.6c0 4.7 3.9 8.6 8.8 8.6 1.3 0 2.1-.8 2.1-1.8 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8h2.2c2.9 0 4.6-2 4.6-4.6C21.3 6.1 17.1 3 12 3z"],
      d: [C(7.3, 11.6, 1.5), C(8.9, 7.4, 1.5), C(13.3, 6.3, 1.5), C(17.1, 8.7, 1.5)] },
    check: { m: [C(12, 12, 9.6)], dl: ["M7.2 12.4l3.3 3.3 6.4-6.8"] },
    speaker: { m: ["M3.4 8.8h3.8L12 4.6v14.8L7.2 15.2H3.4a1 1 0 0 1-1-1V9.8a1 1 0 0 1 1-1z"], ml: ["M15 8.9a4.4 4.4 0 0 1 0 6.2M17.7 6.2a8.2 8.2 0 0 1 0 11.6"] },
    goalpost: { ml: ["M5 2.8v8.8h14V2.8M12 11.6v8.8M8.6 20.6h6.8"] },
    family: { m: [C(8.6, 6.4, 3), "M2.8 20.6v-3.4c0-3.2 2.6-5.6 5.8-5.6s5.8 2.4 5.8 5.6v3.4z", C(17.2, 10.2, 2.3), "M13.6 20.6v-2.2c0-2.2 1.6-3.9 3.6-3.9s3.6 1.7 3.6 3.9v2.2z"] },
    disk: { m: ["M4.6 3h12.2L21 7.2v12.2a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 19.4V4.6A1.6 1.6 0 0 1 4.6 3z"], d: ["M7 3.6h8.6v5H7z", "M6.6 13h10.8v6.6H6.6z"] },
    warning: { m: ["M12 2.6c.6 0 1.1.3 1.4.8l8.4 14.8c.6 1.1-.2 2.4-1.4 2.4H3.6c-1.2 0-2-1.3-1.4-2.4l8.4-14.8c.3-.5.8-.8 1.4-.8z"], dl: ["M12 8.6v5.4"], d: [C(12, 16.9, 1.3)] },
    grade: { m: ["M8.2 16.4 6.4 22.2l2.7-1.2 2 2 1-4.8zM15.8 16.4l1.8 5.8-2.7-1.2-2 2-1-4.8z", C(12, 10.2, 7.8)], dl: ["M9 14l3-7.4 3 7.4M10 11.8h4"] },
    medal: { m: ["M8.2 16.4 6.4 22.2l2.7-1.2 2 2 1-4.8zM15.8 16.4l1.8 5.8-2.7-1.2-2 2-1-4.8z", C(12, 10.2, 7.8)], d: ["M12 5.6l1.4 2.9 3.2.5-2.3 2.2.5 3.1-2.8-1.5-2.8 1.5.5-3.1-2.3-2.2 3.2-.5z"] },
    chart: { m: ["M3.2 13.2h4.2v7.6H3.2zM9.9 8.4h4.2v12.4H9.9zM16.6 3.6h4.2v17.2h-4.2z"], ml: ["M2 21.6h20"] },
    sprout: { m: ["M12 13.4C12 8.8 9 5.6 3.6 5.6c0 4.7 3.1 7.8 8.4 7.8zM12 11.2c0-4.2 2.9-7.4 8.2-7.4 0 4.4-3 7.4-8.2 7.4z", "M7.6 19h8.8l-1 3H8.6z"], ml: ["M12 19V11"] },
    tomb: { m: ["M5.6 20.4V9.4a6.4 6.4 0 0 1 12.8 0v11z", "M3.6 20h16.8v2.2H3.6z"], dl: ["M12 8.4v6.4M9.6 10.8h4.8"] },
    scroll: { m: ["M6.4 3.2h11.4a2.6 2.6 0 0 1 2.6 2.6v1H17v11.4a2.6 2.6 0 0 1-2.6 2.6H5.6A2.6 2.6 0 0 1 3 18.2v-1.2h3.4z"], dl: ["M9 8h5.4M9 11h5.4M9 14h3.6"] },
    flag: { m: ["M6.4 3.4h13.4l-2.6 4.8 2.6 4.8H6.4z"], ml: ["M5 2.6v19.2"], d: ["M6.6 3.6h3.1v3H6.6zM12.8 3.6h3.1v3h-3.1zM9.7 6.6h3.1v3H9.7zM6.6 9.6h3.1v3.2H6.6zM12.8 9.6h3.1v3.2h-3.1z"] },
    sun: { m: ["M4.8 16.4a7.2 7.2 0 0 1 14.4 0z"], ml: ["M12 3v2.6M5 6l1.8 1.8M19 6l-1.8 1.8M2.4 12.4h2.4M19.2 12.4h2.4M2.4 19.6h19.2"] },
    home: { m: ["M12 2.8l9.4 8.4h-2.6v9.6h-5.2v-6.2h-3.2v6.2H5.2v-9.6H2.6z"] },
    /* the prestige tree's branches (tinted to the branch) */
    barbell: { m: ["M2.2 10.2h2V8.4h2.6v7.2H4.2v-1.8h-2zM7.6 6.2h3.2v11.6H7.6zM13.2 6.2h3.2v11.6h-3.2zM17.2 8.4h2.6v1.8h2v3.6h-2v1.8h-2.6z", "M10.6 10.7h2.8v2.6h-2.8z"] },
    brainl: { m: ["M8.6 4.1c1-.9 2.5-1 3.4-.1.9-.9 2.4-.8 3.4.1 1.6-.2 3 .9 3.2 2.5 1.4.6 2.2 2.1 1.8 3.6.9 1 1 2.6.2 3.7.2 1.7-1 3.2-2.7 3.4-.6 1.4-2.1 2.1-3.5 1.7-.8.9-2.3 1-3.1.2-.8.8-2.3.7-3.1-.2-1.4.4-2.9-.3-3.5-1.7-1.7-.2-2.9-1.7-2.7-3.4-.8-1.1-.7-2.7.2-3.7-.4-1.5.4-3 1.8-3.6.2-1.6 1.6-2.7 3.2-2.5z"],
      dl: ["M12 4.4v15.4", "M7.8 8.4c1.3.1 2.2 1 2.3 2.3M16.2 8.4c-1.3.1-2.2 1-2.3 2.3M7.4 14.2c1-.7 2.4-.6 3.1.3M16.6 14.2c-1-.7-2.4-.6-3.1.3"] },
    trend: { m: ["M3 15.6h3.6v5.2H3zM8.8 12.2h3.6v8.6H8.8zM14.6 9.4h3.6v11.4h-3.6z", "M14.6 2.8h6.6v6.6l-2.4-2.4-6.4 6.2-2.6-2.6-4.6 4.4-1.7-1.7 6.3-6.1 2.6 2.6 4.6-4.5z"] },
    crownl: { m: ["M2.6 7.6l4.8 4.2L12 3.8l4.6 8 4.8-4.2-2.2 11.2H4.8z", "M4.8 19.6h14.4v2H4.8z"], d: [C(12, 13.6, 1.4), C(7.6, 15, 1.1), C(16.4, 15, 1.1)] },
    figure: { m: [C(12, 4.6, 2.5), "M8.2 8.2h7.6c.9 0 1.6.7 1.6 1.6v5.6h-2.2v6.8h-2.6v-6h-1.2v6H8.8v-6.8H6.6V9.8c0-.9.7-1.6 1.6-1.6z"] },
    tent: { m: ["M12 3.2l9.8 17.4H2.2z"], d: ["M12 10.4l-3.6 10.2h7.2z"], ml: ["M12 3.2V1.6"] },
    shades: { m: ["M2.4 8.4h8.2c.6 0 1 .5.9 1.1l-.6 3.5c-.3 1.8-1.9 3.1-3.7 3.1h-1c-1.8 0-3.4-1.3-3.7-3.1l-.6-3.5c-.1-.6.3-1.1.9-1.1zM13.4 8.4h8.2c.6 0 1 .5.9 1.1l-.6 3.5c-.3 1.8-1.9 3.1-3.7 3.1h-1c-1.8 0-3.4-1.3-3.7-3.1l-.6-3.5c-.1-.6.3-1.1.9-1.1z"], ml: ["M11 9.8c.7-.6 1.3-.6 2 0"] },
    infinity: { ml: ["M12 12c-1.9-2.7-3.5-4.1-5.4-4.1a4.1 4.1 0 0 0 0 8.2c1.9 0 3.5-1.4 5.4-4.1zm0 0c1.9 2.7 3.5 4.1 5.4 4.1a4.1 4.1 0 0 0 0-8.2c-1.9 0-3.5 1.4-5.4 4.1z"], w: 2.8 },
    shirt: { m: ["M8.4 2.8 3.8 4.9 1.8 10.2l3.2 1.5.9-1.9v11.4h12.2V9.8l.9 1.9 3.2-1.5-2-5.3-4.6-2.1c-.4 1.6-1.8 2.7-3.6 2.7s-3.2-1.1-3.6-2.7z"], dl: ["M8.8 12.6h6.4M8.8 15.4h6.4"] },
    peak: { m: ["M1.8 20.4 9 7.6l3.2 5.4 3-4.6 7 12z"], d: ["M9 7.6l-2.2 3.9 1.3-.6.9 1 .9-1 1.2.8z"], ml: ["M9 7.6V2.8"], f: ["M9 2.8h3.6L11.6 4l1 1.2H9z"] },
    stadium: { m: ["M2.6 9.6c0-1.8 4.2-3.2 9.4-3.2s9.4 1.4 9.4 3.2v7.8c0 1.8-4.2 3.2-9.4 3.2s-9.4-1.4-9.4-3.2z"], d: ["M12 8.2c-4.1 0-7 .8-7 1.6s2.9 1.6 7 1.6 7-.8 7-1.6-2.9-1.6-7-1.6z"], dl: ["M3.2 14c1.9 1.1 5.1 1.7 8.8 1.7s6.9-.6 8.8-1.7"], ml: ["M4 8V2.6M20 8V2.6"] },
    die: { m: ["M5.6 3.2h12.8a2.4 2.4 0 0 1 2.4 2.4v12.8a2.4 2.4 0 0 1-2.4 2.4H5.6a2.4 2.4 0 0 1-2.4-2.4V5.6a2.4 2.4 0 0 1 2.4-2.4z"], d: [C(8, 8, 1.6), C(16, 8, 1.6), C(12, 12, 1.6), C(8, 16, 1.6), C(16, 16, 1.6)] },
    sparkle: { m: ["M11 2l2.2 7.6 7.6 2.2-7.6 2.2L11 21.6 8.8 14 1.2 11.8l7.6-2.2z", "M19 1.8l.8 2.4 2.4.8-2.4.8-.8 2.4-.8-2.4-2.4-.8 2.4-.8z", "M18.6 15.6l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6z"] }
  };

  /* every name a caller passes, to a glyph */
  var ALIAS = {
    "nav:hub": "football", "nav:season": "calendar", "nav:upgrade": "dumbbell", "nav:shop": "coin", "nav:menu": "cog",
    "sec:now": "football", "sec:body": "heart", "sec:skills": "dumbbell", "sec:team": "team", "sec:story": "book",
    "sec:sched": "calendar", "sec:league": "trophy", "sec:opp": "target", "sec:role": "shield",
    "sec:game": "cog", "sec:sound": "speaker", "sec:field": "goalpost", "sec:family": "family", "sec:save": "disk", "sec:danger": "warning",
    "sec:grade": "grade", "sec:season": "calendar", "sec:stats": "chart", "sec:growth": "sprout",
    "sec:card": "idcard", "sec:case": "trophy", "sec:book": "medal", "sec:sims": "skip",
    "sec:gear": "jersey", "sec:style": "palette", "sec:epitaph": "tomb", "sec:totals": "chart", "sec:best": "star", "sec:log": "scroll",
    "sec:end": "flag", "sec:xp": "laurel", "sec:life": "sun", "sec:legacy": "family", "sec:lead": "star", "sec:odds": "rise",
    "sec:progs": "dumbbell", "sec:pick": "check", "sec:nodes": "coin", "sec:perks": "brain",
    "branch:physical": "barbell", "branch:mental": "brainl", "branch:career": "trend", "branch:economy": "crownl", "branch:body": "figure",
    "branch:camp": "tent", "branch:swagger": "shades", "branch:eternal": "infinity", "branch:locker": "shirt", "branch:apex": "peak",
    "branch:franchise": "stadium", "branch:fate": "die", "branch:impossible": "sparkle",
    /* the spray's pages name themselves by their emoji */
    "\u{1F3C8}": "football", "\u{1FA79}": "heart", "\u{1F4C8}": "chart", "\u{1F3DF}": "team", "\u{1F3DF}️": "team", "\u{1F4D6}": "book", "\u{1F305}": "sun",
    "\u{1F3E0}": "home", "\u{1F6CB}": "home", "\u{1F3E1}": "home", "\u{1F3AF}": "target", "\u{1F4C5}": "calendar", "\u{1F5D3}": "calendar",
    "\u{1F3C6}": "trophy", "⚔️": "shield", "\u{1F4CA}": "chart", "\u{1F3C5}": "star", "\u{1F94A}": "fist", "\u{1F3CB}️": "dumbbell",
    "✅": "check", "\u{1F4A8}": "shoe", "\u{1F9E0}": "brain", "\u{1F333}": "coin", "\u{1F6E4}": "bolt", "\u{1F451}": "crown",
    "\u{1F3DB}️": "team", "\u{1FAAA}": "idcard", "\u{1F392}": "jersey", "\u{1F3A8}": "palette", "⭐": "star", "⚙️": "cog",
    "\u{1F3AE}": "cog", "\u{1F50A}": "speaker", "\u{1F4D0}": "goalpost", "\u{1F4BE}": "disk", "⏭": "skip", "\u{1F48D}": "trophy"
  };

  /* the metal: a light from the top left, a dark core, a warm bounce at the foot */
  function hex(h) { h = String(h || "").replace("#", ""); if (h.length === 3) h = h.replace(/./g, "$&$&"); var n = parseInt(h, 16); return isNaN(n) || h.length !== 6 ? null : [n >> 16 & 255, n >> 8 & 255, n & 255] }
  function mix(c, t, k) { return "rgb(" + c.map(function (v, i) { return Math.round(v + (t[i] - v) * k) }).join(",") + ")" }
  /* a polished-metal ramp: bright crown, a dark "horizon" band just past the middle (what makes the menu's
   * gold read as metal rather than paint), a warm floor and a bounce light at the foot */
  var OFFS = [0, 0.3, 0.5, 0.57, 0.86, 1];
  var GOLD = ["#fff6d2", "#f7d470", "#a8701c", "#e2b04c", "#8a5812", "#c9963a"];
  function stops(tint) {
    var c = tint && hex(tint);
    if (!c) return GOLD;
    var W = [255, 255, 255], K = [0, 0, 0];
    return [mix(c, W, 0.82), mix(c, W, 0.38), mix(c, K, 0.38), mix(c, W, 0.12), mix(c, K, 0.5), mix(c, W, 0.05)];
  }
  function gradId(tint) { var c = tint && hex(tint); return "ricMV193V-" + (c ? c.map(function (v) { return (v < 16 ? "0" : "") + v.toString(16) }).join("") : "gold") }
  function defs(tint) {
    var NS = "http://www.w3.org/2000/svg", host = document.getElementById("ricDefsV193V");
    if (!host) {
      host = document.createElementNS(NS, "svg");
      host.id = "ricDefsV193V"; host.setAttribute("aria-hidden", "true"); host.setAttribute("focusable", "false");
      host.setAttribute("width", "0"); host.setAttribute("height", "0");
      host.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none");
      host.innerHTML = '<defs><radialGradient id="ricSV193V" cx=".3" cy=".2" r=".62"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>';
      (document.body || document.documentElement).appendChild(host);
    }
    var id = gradId(tint);
    if (!document.getElementById(id)) {
      var s = stops(tint), body = OFFS.map(function (o, i) { return '<stop offset="' + o + '" stop-color="' + s[i] + '"/>' }).join("");
      // fills ramp across their own box; strokes across the icon's (a lone straight line has no box to ramp across)
      [[id, 'x1=".2" y1="0" x2=".75" y2="1"'], [id + "u", 'gradientUnits="userSpaceOnUse" x1="5" y1="1" x2="17" y2="23"']].forEach(function (d) {
        var g = document.createElementNS(NS, "linearGradient");
        g.id = d[0];
        d[1].replace(/(\w+)="([^"]*)"/g, function (_, k, v) { g.setAttribute(k, v) });
        g.innerHTML = body;
        host.firstChild.appendChild(g);
      });
    }
    return id;
  }
  var INK = "#1a1206";
  function svg(name, glyph, emoji, tint) {
    var id = defs(tint), M = "url(#" + id + ")", S = "url(#ricSV193V)", w = glyph.w || 2.3, out = [];
    // the dark outline first, under everything: fills get a 1.1 rim, strokes a 1.6 one
    (glyph.m || []).forEach(function (d) { out.push('<path d="' + d + '" fill="' + INK + '" stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round"/>') });
    (glyph.ml || []).forEach(function (d) { out.push('<path d="' + d + '" fill="none" stroke="' + INK + '" stroke-width="' + (w + 2) + '" stroke-linecap="round" stroke-linejoin="round"/>') });
    (glyph.f || []).forEach(function (d) { out.push('<path d="' + d + '" fill="' + INK + '" stroke="' + INK + '" stroke-width="1.6" stroke-linejoin="round"/>') });
    // the metal, then the specular over it
    (glyph.ml || []).forEach(function (d) { out.push('<path d="' + d + '" fill="none" stroke="url(#' + id + 'u)" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"/>') });
    (glyph.m || []).forEach(function (d) { out.push('<path d="' + d + '" fill="' + M + '"/>') });
    (glyph.f || []).forEach(function (d) { out.push('<path d="' + d + '" fill="#e8463a"/>') });
    (glyph.m || []).forEach(function (d) { out.push('<path d="' + d + '" fill="' + S + '"/>') });
    // the engraving
    (glyph.d || []).forEach(function (d) { out.push('<path d="' + d + '" fill="' + INK + '" fill-opacity=".82"/>') });
    (glyph.dl || []).forEach(function (d) { out.push('<path d="' + d + '" fill="none" stroke="' + INK + '" stroke-opacity=".85" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>') });
    return '<svg class="ric-v193v ric-svg-v193v" viewBox="0 0 24 24" data-ric="' + name + '" data-emoji="' + esc(emoji) + '" aria-hidden="true" focusable="false">' + out.join("") + "</svg>";
  }
  function img(name, emoji) {
    return '<img class="ric-v193v ric-img-v193v" src="' + esc(asset(ART[name])) + '" alt="" draggable="false" decoding="async" data-ric="' + name + '" data-emoji="' + esc(emoji) + '">';
  }
  function glyphOf(name) { var g = ALIAS[name] || name; return ART[g] || G[g] ? g : null }
  /* the one entry point */
  function icon(name, emoji, opt) {
    emoji = emoji == null ? "" : String(emoji);
    if (!on()) return esc(emoji);
    var g = glyphOf(name) || glyphOf(emoji);
    if (!g) return esc(emoji);
    css();
    var tint = opt && opt.tint;
    // a tinted call wants the drawn glyph in the branch's metal; the paintings are gold
    if (G[g] && (tint || !ART[g])) return svg(g, G[g], emoji, tint);
    return img(g, emoji);
  }

  /* a painting that fails to load gives its emoji back */
  function fail(el) {
    try {
      var sp = document.createElement("span");
      sp.className = "ric-fb-v193v"; sp.textContent = el.getAttribute("data-emoji") || "";
      el.parentNode && el.parentNode.replaceChild(sp, el);
    } catch (e) {}
  }
  document.addEventListener("error", function (e) { var t = e.target; if (t && t.classList && t.classList.contains("ric-img-v193v")) fail(t) }, true);

  function css() {
    if (document.getElementById("ricCssV193V")) return;
    var st = document.createElement("style");
    st.id = "ricCssV193V";
    st.textContent = [
      ".ric-v193v{display:inline-block;flex:none;width:var(--ric,22px);height:var(--ric,22px);vertical-align:middle;object-fit:contain;image-rendering:auto;" +
        "filter:drop-shadow(0 1.5px 1.2px rgba(0,0,0,.8));pointer-events:none;-webkit-user-select:none;user-select:none}",
      ".ric-svg-v193v{overflow:visible}",
      ".ric-fb-v193v{font-style:normal;font-size:var(--ricFb,17px);line-height:1}",
      /* the bottom nav: dim brass at rest, the menu tile's gold glow on the one you are on */
      "#navV139 button i.ric-i-v193v{display:flex;align-items:center;justify-content:center;width:26px;height:24px;font-size:0;line-height:0;filter:none;opacity:1}",
      "#navV139 button i.ric-i-v193v .ric-v193v{--ric:24px;opacity:.82;filter:saturate(.7) brightness(.95) drop-shadow(0 1.5px 1.2px rgba(0,0,0,.8));transition:opacity .15s,filter .15s,transform .15s}",
      "#navV139 button.on i.ric-i-v193v .ric-v193v{opacity:1;filter:drop-shadow(0 1.5px 1.2px rgba(0,0,0,.8)) drop-shadow(0 0 6px rgba(255,214,107,.55));transform:translateY(-1px) scale(1.08)}",
      "#navV139.ric-on-v193v button{padding-top:4px;padding-bottom:4px}",
      "#navV139.ric-on-v193v button.on{background:linear-gradient(180deg,rgba(61,45,14,.92),rgba(31,23,8,.92));box-shadow:0 0 0 1px rgba(255,214,107,.32) inset,0 4px 14px rgba(230,178,58,.14)}",
      /* the section tab strip, the section bar, the spray */
      ".hubv75-tab i .ric-v193v{--ric:20px;opacity:.72;filter:saturate(.6) drop-shadow(0 1.5px 1.2px rgba(0,0,0,.8))}",
      ".hubv75-tab.on i .ric-v193v{opacity:1;filter:drop-shadow(0 1.5px 1.2px rgba(0,0,0,.8)) drop-shadow(0 0 5px rgba(255,214,107,.45))}",
      ".hubv75-tab i .ric-fb-v193v{--ricFb:13px}",
      ".secbar-v170 .sb-mid i{display:flex;align-items:center}",
      ".secbar-v170 .sb-mid .ric-v193v{--ric:26px;filter:drop-shadow(0 1.5px 1.2px rgba(0,0,0,.8)) drop-shadow(0 0 6px rgba(255,214,107,.35))}",
      ".secbar-v170 .sb-mid .ric-fb-v193v{--ricFb:19px}",
      "#sprayV170 .spr-b i .ric-v193v{--ric:30px}",
      "#sprayV170 .spr-b i .ric-fb-v193v{--ricFb:25px}",
      /* the tree's branch tabs: the branch's own metal */
      ".branch-tab .ric-v193v{--ric:20px;margin:-4px 2px -4px 0;position:relative;top:-1px}",
      // the row's inline flex:1 / min-width:70px squeezed "Physical" under its icon: a tab is as wide as what it says
      ".branch-tab:has(.ric-v193v){min-width:max-content!important;padding-left:9px!important;padding-right:10px!important}",
      ".branch-tab:not(.active) .ric-v193v{opacity:.78;filter:saturate(.7) drop-shadow(0 1.5px 1.2px rgba(0,0,0,.8))}",
      ".branch-tab.active .ric-v193v{filter:drop-shadow(0 1.5px 1.2px rgba(0,0,0,.8)) drop-shadow(0 0 5px currentColor)}",
      ".branch-tab .ric-fb-v193v{--ricFb:13px}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(st);
  }

  window.ribIconV193V = icon;
  // a save that boots onto the tree drew its branch tabs before this file loaded: draw them once more
  setTimeout(function () {
    try { if (on() && window.S && window.S.view === "shop" && document.querySelector(".branch-tab") && !document.querySelector(".branch-tab .ric-v193v") && typeof window.render === "function") window.render() } catch (e) {}
  }, 0);
  window.__V193V = { on: on, icon: icon, glyph: glyphOf, art: ART, glyphs: G, alias: ALIAS, fail: fail, css: css, stops: stops, offs: OFFS, hex: hex };   // v193 Y: the metal ramp, shared
})();

/* ===== v193 Y THE EMOJI BECOME ART =====
 * The owner: "Are you able to turn the emoji into custom art that matches the style a little better?" v193 V drew the
 * nav, the section bar and the tree's branch tabs in the main menu's metal; the ~180 prestige-tree nodes and the cards
 * around the career still wore the phone's emoji font. This is ONE renderer for all of them:
 *   `window.ribArtV193Y(conceptOrEmoji, {size, tint, hint})` → an inline `<svg><use href="#ribart-NAME"></svg>` with
 *   the emoji kept beside it as screen-reader text (`.sr-only-v193y`); the svg is aria-hidden.
 * - the LIBRARY: every concept is a `<symbol id="ribart-NAME">` in ONE hidden sprite (`#ribArtSpriteV193Y`, built
 *   lazily, a symbol the first time a concept is drawn), drawn on v193 V's 24-unit grid in v193 V's light: a dark
 *   outline under everything, the polished-metal ramp, the top-left white specular, engraved dark detail. The symbols
 *   paint with CSS custom properties (`--raM` the metal fill, `--raMu` its stroke twin), so 180 icons share one set
 *   of gradients: one per tint, built once (`ribartM-<hex>`; the ramp is v193 V's `stops(tint)`, gold by default).
 *   v193 V's own drawn glyphs (calendar, trophy, book, heart, chart, sprout, the branch glyphs …) are in the library too.
 * - SIZE: below 20 px a concept drops its fine detail (`x` / `xl` layers, `--raFd: 0`) and thickens its rim.
 * - NAMES: a concept name, or an emoji through `NODE_ART_V193Y` (every tree node's emoji, and the cards' — the injury
 *   pop-up's body parts, the medal rewards, Settings, the Locker's slots …); an unknown emoji falls back by keyword on
 *   `opt.hint` (a node's name + description, `KEYWORD_ART_V193Y`), then to the emoji itself.
 * - Kill switch `TU("v193Y", 0)`: every caller gets its emoji back. `window.__V193Y`; scripts/v193Ycheck.mjs. */
(function () {
  "use strict";
  var V = window.__V193V || {};
  function on() { try { var t = window.RIB_TUNE; return !(t && t.v193Y !== undefined && !t.v193Y) } catch (e) { return true } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] }) }
  var f1 = function (v) { return Math.round(v * 100) / 100 };
  var C = function (x, y, r) { return "M" + f1(x - r) + " " + f1(y) + "a" + r + " " + r + " 0 1 0 " + f1(2 * r) + " 0a" + r + " " + r + " 0 1 0 " + f1(-2 * r) + " 0z" };
  var poly = function (pts) { return "M" + pts.map(function (p) { return f1(p[0]) + " " + f1(p[1]) }).join("L") + "z" };
  // a star / burst: n points, alternating radii, the first point straight up (rot in degrees)
  function star(cx, cy, n, ro, ri, rot, jit) {
    var pts = [];
    for (var i = 0; i < n * 2; i++) {
      var a = (rot || 0) * Math.PI / 180 - Math.PI / 2 + i * Math.PI / n, r = i % 2 ? ri : ro * (jit ? jit[(i / 2) % jit.length] : 1);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return poly(pts);
  }
  // a cog: n trapezoid teeth
  function cog(cx, cy, n, ro, ri) {
    var pts = [], tw = Math.PI / n;
    for (var i = 0; i < n; i++) {
      var b = i * 2 * Math.PI / n - Math.PI / 2;
      [[b - tw * 0.62, ri], [b - tw * 0.38, ro], [b + tw * 0.38, ro], [b + tw * 0.62, ri]].forEach(function (p) { pts.push([cx + p[1] * Math.cos(p[0]), cy + p[1] * Math.sin(p[0])]) });
    }
    return poly(pts);
  }
  // a leaf (a vesica) centred on cx,cy, `len` long, `wid` wide, pointing at `ang` degrees
  function leaf(cx, cy, len, wid, ang) {
    var a = ang * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), h = len / 2;
    var t1 = [cx + ux * h, cy + uy * h], t2 = [cx - ux * h, cy - uy * h];
    return "M" + f1(t1[0]) + " " + f1(t1[1]) + "Q" + f1(cx - uy * wid) + " " + f1(cy + ux * wid) + " " + f1(t2[0]) + " " + f1(t2[1]) + "Q" + f1(cx + uy * wid) + " " + f1(cy - ux * wid) + " " + f1(t1[0]) + " " + f1(t1[1]) + "z";
  }
  // a heart-shaped leaf with its point at cx,cy, opening toward `ang` degrees (the clover)
  function heart(cx, cy, ang) {
    var a = ang * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, P = function (u, n) { return [cx + ux * u + nx * n, cy + uy * u + ny * n] };
    var c1 = P(6, 2.3), c2 = P(6, -2.3);
    return [C(c1[0], c1[1], 2.75), C(c2[0], c2[1], 2.75), poly([P(0.6, 0), P(5.2, 4.8), P(6.6, 0), P(5.2, -4.8)])];
  }
  // a spoke / ray set: lines from r0 to r1, n of them
  function rays(cx, cy, n, r0, r1, rot) {
    var out = "";
    for (var i = 0; i < n; i++) { var a = (rot || 0) * Math.PI / 180 + i * 2 * Math.PI / n; out += "M" + f1(cx + r0 * Math.cos(a)) + " " + f1(cy + r0 * Math.sin(a)) + "L" + f1(cx + r1 * Math.cos(a)) + " " + f1(cy + r1 * Math.sin(a)) }
    return out;
  }
  // the snowflake: three bars and a chevron on each arm
  function flake() {
    var out = "", tips = "";
    for (var i = 0; i < 6; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 3, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, k = 5.6, s = 2.6;
      if (i < 3) out += "M" + f1(12 + ux * 9.6) + " " + f1(12 + uy * 9.6) + "L" + f1(12 - ux * 9.6) + " " + f1(12 - uy * 9.6);
      tips += "M" + f1(12 + ux * (k + s) + nx * s) + " " + f1(12 + uy * (k + s) + ny * s) + "L" + f1(12 + ux * k) + " " + f1(12 + uy * k) + "L" + f1(12 + ux * (k + s) - nx * s) + " " + f1(12 + uy * (k + s) - ny * s);
    }
    return [out, tips];
  }
  // the laurel: two arcs of leaves
  function laurel() {
    var L = [], R = [];
    for (var i = 0; i < 5; i++) {
      var t = 200 - i * 24, a = t * Math.PI / 180, cx = 12 + 8.2 * Math.cos(a), cy = 11.4 - 8.2 * Math.sin(a);
      L.push(leaf(cx - 1.1, cy, 6.6, 2.5, 180 - t + 60));
      R.push(leaf(24 - (cx - 1.1), cy, 6.6, 2.5, -(180 - t + 60) + 180));
    }
    return L.concat(R);
  }
  var FL = flake();

  /* the library: m metal fills · ml metal strokes ([d, width] for a path's own width) · f accent fills · d / dl
   * engraved dark · x / xl fine engraving (gone below 20 px) · m2 metal over the engraving · h white glints */
  var A = {
    football: { m: ["M3.6 20.4c-1.1-6.6 1.9-12.7 7.4-15.4 3.1-1.5 6.5-1.9 9.3-1.1.8 2.8.4 6.2-1.1 9.3-2.7 5.5-8.8 8.5-15.6 7.2z"],
      dl: ["M5.2 15.8l3 3M15.2 5.2l3 3", "M9.4 14.6l5.2-5.2"], xl: ["M10 11.8l2.2 2.2M11.6 10.2l2.2 2.2M8.4 13.4l2.2 2.2"] },
    bolt: { m: ["M13.8 1.6 4.2 13.6h6.4l-1.8 8.8 11-12.8h-6.6z"] },
    shield: { m: ["M12 2 20.2 5v6.4c0 5.3-3.4 9.1-8.2 10.8-4.8-1.7-8.2-5.5-8.2-10.8V5z"], dl: ["M12 4.6v15.2"], xl: ["M6.2 8.6c2-.4 3.9-1.1 5.8-2.2 1.9 1.1 3.8 1.8 5.8 2.2"] },
    coins: { m: ["M2.6 17.8c0-1.3 2.6-2.3 5.8-2.3s5.8 1 5.8 2.3v1.8c0 1.3-2.6 2.3-5.8 2.3s-5.8-1-5.8-2.3z", "M2.6 13.4c0-1.3 2.6-2.3 5.8-2.3s5.8 1 5.8 2.3v1.8c0 1.3-2.6 2.3-5.8 2.3s-5.8-1-5.8-2.3z", C(16, 8.6, 6)],
      dl: [C(16, 8.6, 3.8)], xl: ["M2.8 14c1 .9 3.2 1.5 5.6 1.5s4.6-.6 5.6-1.5M2.8 18.4c1 .9 3.2 1.5 5.6 1.5s4.6-.6 5.6-1.5"], d: ["M15.2 6.2h1.6v4.8h-1.6z"] },
    moneybag: { m: ["M9 2.8h6l-1.7 3.4c3.9 1.6 7 5.7 7 10 0 3.5-2.5 5.6-6.4 5.6h-3.8c-3.9 0-6.4-2.1-6.4-5.6 0-4.3 3.1-8.4 7-10z"],
      dl: ["M9.2 6.4h5.6", "M14.2 11.4c-.4-.8-1.2-1.2-2.2-1.2-1.3 0-2.2.7-2.2 1.6 0 2.2 4.4 1.3 4.4 3.5 0 1-1 1.7-2.2 1.7-1 0-1.9-.5-2.3-1.3M12 9v9.4"] },
    star: { m: [star(12, 12.6, 5, 10.4, 4.4)], xl: ["M12 12.6V4.4"] },
    nova: { m: [star(12, 12, 5, 8.2, 3.6)], ml: [[rays(12, 12, 4, 9.4, 11.4, -45), 1.8]] },
    laurel: { m: laurel(), ml: [["M9.6 21.2C5.2 19 3 14.6 3.6 9.8M14.4 21.2c4.4-2.2 6.6-6.6 6-11.4", 1.4]] },
    flame: { m: ["M12 22.2c-4.5 0-7.6-3-7.6-7.2 0-3.7 2.5-6 3.9-8.8.6 1.6 1.4 2.7 2.6 3.3-.2-3.5 1.2-6.8 4.1-8.7-.4 3.1 1 5.2 2.7 7.2 1.4 1.8 2.1 3.7 2.1 6 0 4.7-3.3 8.2-7.8 8.2z"],
      d: ["M12 20.6c-2 0-3.4-1.3-3.4-3.2 0-1.8 1.2-2.9 2.2-4.5.4 1 1 1.6 1.8 1.9 0-1.4.6-2.5 1.6-3.3.3 1.6 1.2 2.7 1.2 4.7 0 2.6-1.4 4.4-3.4 4.4z"] },
    crystal: { ml: [[FL[0], 2.4], [FL[1], 2]] },
    hourglass: { m: ["M4.8 2.2h14.4v2.4h-1.4c0 3.4-2 5.6-4.1 7.4 2.1 1.8 4.1 4 4.1 7.4h1.4v2.4H4.8v-2.4h1.4c0-3.4 2-5.6 4.1-7.4-2.1-1.8-4.1-4-4.1-7.4H4.8z"],
      d: ["M8.7 6.8h6.6c-.7 1.6-1.9 2.8-3.3 3.8-1.4-1-2.6-2.2-3.3-3.8zM12 15.4c-1.7.8-3.1 2.1-3.3 4h6.6c-.2-1.9-1.6-3.2-3.3-4z"] },
    eye: { m: ["M1.4 12C3.9 7.2 7.7 4.8 12 4.8s8.1 2.4 10.6 7.2c-2.5 4.8-6.3 7.2-10.6 7.2S3.9 16.8 1.4 12z"], d: [C(12, 12, 4.2)], m2: [C(12, 12, 1.9)], h: [C(13.6, 10.4, 1)] },
    target: { m: [C(12, 12, 10)], dl: [[C(12, 12, 6.4), 1.8]], d: [C(12, 12, 2.8)], xl: [C(12, 12, 8.4)] },
    film: { m: [C(12, 11.6, 9.6)], d: [C(12, 6.4, 2.1), C(12, 16.8, 2.1), C(6.8, 11.6, 2.1), C(17.2, 11.6, 2.1), C(12, 11.6, 1.1)], ml: [["M12 21.2h9.6", 2]], xd: [C(8.3, 7.9, 1.1), C(15.7, 7.9, 1.1), C(8.3, 15.3, 1.1), C(15.7, 15.3, 1.1)] },
    tape: { m: ["M3.6 5h16.8A1.6 1.6 0 0 1 22 6.6v10.8a1.6 1.6 0 0 1-1.6 1.6H3.6A1.6 1.6 0 0 1 2 17.4V6.6A1.6 1.6 0 0 1 3.6 5z"], d: ["M5.4 8h13.2v5.6H5.4z"], m2: [C(8.6, 10.8, 1.7), C(15.4, 10.8, 1.7)], dl: ["M7.2 19l1.4-2.6h6.8l1.4 2.6"] },
    clapper: { m: ["M3 10.2h18v9.6a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 19.8z", "M2.4 8.4 19.4 3.6l1 3.5-17 4.8z"], d: ["M6 7.4l2.8-.8 1.9 2.6-2.8.8zM11.6 5.8l2.8-.8 1.9 2.6-2.8.8z"], xl: ["M6 14h12M6 17.2h7"] },
    megaphone: { m: ["M2.8 9.2h3.8L17.4 3.6v16.8L6.6 14.8H2.8a1 1 0 0 1-1-1V10.2a1 1 0 0 1 1-1z", "M6.6 14.8l2 5.8h3.2l-1.6-4.6z"], ml: [["M20.2 9a4.4 4.4 0 0 1 0 6", 2]], xl: ["M6.6 9.4v5.2"] },
    handshake: { m: ["M1.6 8.8 6 6.2l4.4 1.6 2.6-1 3.6.4 5.8 2.8v5.2l-3.4 1.6-5.6 4.4c-.8.6-2 .6-2.8 0L1.6 13.8z"], dl: ["M13 6.8 9.4 10c-.6.6-.4 1.6.4 1.8 1 .3 2-.1 2.8-.8l1.6-1.4", "M10.4 15.2l2.2 2M8.6 16.6l1.8 1.6M12.4 13.4l2.4 2.2"], xl: ["M6 6.2 4 14.2M18.2 9.4l.2 6.6"] },
    rocket: { m: ["M12 1.6c3.3 2.5 5 6.2 5 10.4v4.8H7V12c0-4.2 1.7-7.9 5-10.4z", "M7 12.6 3.6 15.8v4.4L7 18zM17 12.6l3.4 3.2v4.4L17 18z"], d: [C(12, 9, 2.1)], f: ["M9.4 17.6h5.2L12 22.6z"] },
    gem: { m: ["M6.2 3.4h11.6l4.4 5.6L12 21.6 1.8 9z"], dl: [["M2.2 9h19.6M8.4 3.6 6.8 9 12 21.2M15.6 3.6 17.2 9 12 21.2", 1.2]], xl: ["M8.4 3.6 12 9l3.6-5.4"] },
    card: { m: ["M4.2 5.4 6.6 4.8v14.6l-.6.2a1.6 1.6 0 0 1-2-1.1L1.3 7.4a1.6 1.6 0 0 1 1.1-2z", "M8.4 2.8h10.8a1.6 1.6 0 0 1 1.6 1.6v15.2a1.6 1.6 0 0 1-1.6 1.6H8.4a1.6 1.6 0 0 1-1.6-1.6V4.4a1.6 1.6 0 0 1 1.6-1.6z"], d: ["M13.8 7.2l3.2 4.8-3.2 4.8-3.2-4.8z"], xd: [C(9.6, 5.6, .9), C(18, 18.4, .9)] },
    gear: { m: [cog(12, 12, 8, 10.6, 7.6)], d: [C(12, 12, 3.4)], xl: [C(12, 12, 5.6)] },
    ring: { ml: [[C(12, 14.4, 6.4), 2.8]], m: ["M8.8 2.6h6.4l2 2.6L12 10.2 6.8 5.2z"], dl: [["M7 5.2h10", 1]], xl: ["M10.4 2.8 9.6 5.2 12 9.6l2.4-4.4-.8-2.4"] },
    fist: { m: ["M5 9.8c0-1.2.9-2.1 2.1-2.1h.5c.3-1 1.1-1.7 2.1-1.7.8 0 1.5.4 1.9 1 .4-.6 1.1-1 1.9-1s1.5.4 1.9 1c.4-.5 1-.8 1.7-.8 1.2 0 2.1.9 2.1 2.1v6.4c0 3.6-2.8 6.5-6.4 6.5h-1.4C7.8 21.2 5 18.4 5 14.8z"],
      dl: ["M9.7 6.2v4.4M13.5 6.2v4.4M17.1 6.8v3.8", "M5.4 12.4h5.4c1.1 0 1.7.9 1.4 1.8"] },
    cleat: { m: ["M2.2 16.6V9.6c0-.8.6-1.4 1.4-1.4h2.2c.6 1.4 2 2.3 3.6 2.3.9 0 1.5-.6 1.5-1.4V7.6l1.8.6 2.7 3.1c1.4 1.6 3.4 2.4 5.4 2.6 1.3.1 2.1 1 2.1 2.2v.5c0 .9-.7 1.6-1.6 1.6H3.8a1.6 1.6 0 0 1-1.6-1.6z"], d: ["M4.4 18.4h2.4v2.6H4.4zM10 18.4h2.4v2.6H10zM15.8 18.4h2.4v2.6h-2.4z"], dl: ["M2.6 15.2h19.2"], xl: ["M11.8 9.8l1.6-1.1M13.2 11.4l1.6-1.1"] },
    helmet: { m: ["M2.6 13.2c0-5.9 4.3-10 9.9-10 5 0 8.7 3.5 8.7 8.4v3.4h-6.4l-1.2 3.3c-.3.8-1.1 1.3-1.9 1.3H8.4c-3.3 0-5.8-2.5-5.8-5.6z"], ml: [["M15 12.4h7M17.2 12.4v6c0 1.4 1 2.2 2.6 2.2h1.6M17.2 16.4h4.6", 1.6]], d: [C(10.2, 12.6, 1.7)], dl: ["M9.6 3.8c3.1.6 5.6 2.9 6.8 5.8"] },
    whistle: { m: [C(8.4, 14.2, 5.8), "M8.4 8.4h13.2v5H12.6z"], d: [C(8.4, 14.2, 2.1)], ml: [["M3.8 10.6C2.6 7.4 3.8 4.4 7 3.4", 1.4]] },
    clipboard: { m: ["M5.4 4h13.2a1.6 1.6 0 0 1 1.6 1.6v14.8a1.6 1.6 0 0 1-1.6 1.6H5.4a1.6 1.6 0 0 1-1.6-1.6V5.6A1.6 1.6 0 0 1 5.4 4z"], d: ["M8.4 2.2h7.2v4.2H8.4z"], m2: ["M9.4 3h5.2v2.6H9.4z"], dl: ["M7.4 10.2h9.2M7.4 13.6h9.2M7.4 17h5.6"] },
    mask: { m: ["M1.8 9.2c3.5-1.9 7-1.7 10.2.6 3.2-2.3 6.7-2.5 10.2-.6 0 4-2.1 6.9-5.4 6.9-2.1 0-3.7-1.2-4.8-3.1-1.1 1.9-2.7 3.1-4.8 3.1-3.3 0-5.4-2.9-5.4-6.9z"], d: ["M4.8 11c1.3-.9 2.7-.9 4 .2-1.1 1.5-2.9 1.5-4-.2zM15.2 11.2c1.3-1.1 2.7-1.1 4-.2-1.1 1.7-2.9 1.7-4 .2z"], ml: [["M1.8 9.2 .8 7.4M22.2 9.2l1-1.8", 1.4]] },
    moon: { m: ["M14.6 2.4a9.8 9.8 0 1 0 7 12.8 7.8 7.8 0 0 1-7-12.8z"], xd: [C(8.4, 9, 1.4), C(10.2, 15.6, 1.1), C(14.8, 17.6, .9)] },
    wind: { ml: [["M2.4 8.6h11.4a3.1 3.1 0 1 0-3.1-3.1M2.4 13h16.4a3.1 3.1 0 1 1-3.1 3.1M2.4 17.4h7.2", 2.4]] },
    anchor: { ml: [["M12 7.6v13.6M7.4 10.6h9.2M3.8 13.8c0 4.4 3.6 7.6 8.2 7.6s8.2-3.2 8.2-7.6", 2.4], [C(12, 4.6, 2.3), 2]], m: ["M1.8 14.4l3-2.4 1.8 3.2zM22.2 14.4l-3-2.4-1.8 3.2z"] },
    key: { ml: [["M10.6 13.4 20.4 3.6M17 7l2.8 2.8M14.6 9.4l2 2", 2.6]], m: [C(7.4, 16.6, 5.2)], d: [C(7.4, 16.6, 2)] },
    lock: { m: ["M4.6 10.4h14.8a1.4 1.4 0 0 1 1.4 1.4v8.8a1.4 1.4 0 0 1-1.4 1.4H4.6a1.4 1.4 0 0 1-1.4-1.4v-8.8a1.4 1.4 0 0 1 1.4-1.4z"], ml: [["M7.6 10.4V7.6a4.4 4.4 0 0 1 8.8 0v2.8", 2.4]], d: [C(12, 14.6, 1.7), "M11.1 15.4h1.8l.5 3.2h-2.8z"] },
    lungs: { m: ["M10.4 6.8v11.4c0 1.8-1.4 3-3.2 3H5.4c-1.8 0-3-1.4-2.8-3.2l.8-6.6C3.8 8.2 5.8 5.4 8.4 5c1.1-.2 2 .6 2 1.8z", "M13.6 6.8v11.4c0 1.8 1.4 3 3.2 3h1.8c1.8 0 3-1.4 2.8-3.2l-.8-6.6C20.2 8.2 18.2 5.4 15.6 5c-1.1-.2-2 .6-2 1.8z"], ml: [["M12 2.2v7.6M12 9.8l-2.4 2.4M12 9.8l2.4 2.4", 2]], xl: ["M5 13.4l2.2-1.6M19 13.4l-2.2-1.6M5.6 17l2-1M18.4 17l-2-1"] },
    cross: { m: ["M9 2.6h6v6.4h6.4v6H15v6.4H9V15H2.6V9H9z"], xl: ["M12 4.6v14.8M4.6 12h14.8"] },
    bandage: { m: ["M3.6 14.6 14.6 3.6a3.4 3.4 0 0 1 4.8 0l1 1a3.4 3.4 0 0 1 0 4.8L9.4 20.4a3.4 3.4 0 0 1-4.8 0l-1-1a3.4 3.4 0 0 1 0-4.8z"], d: ["M9.6 9.6l4.8 4.8-3 3-4.8-4.8z"], xd: [C(11.2, 7.4, .7), C(16.6, 12.8, .7), C(7.4, 11.2, .7), C(12.8, 16.6, .7)] },
    dna: { ml: [["M7 2.2c0 4.9 10 4.9 10 9.8s-10 4.9-10 9.8M17 2.2c0 4.9-10 4.9-10 9.8s10 4.9 10 9.8", 2.9], ["M8.6 4.8h6.8M9.8 8.4h4.4M9.8 15.6h4.4M8.6 19.2h6.8", 1.9]] },
    flask: { m: ["M8.8 2.4h6.4v2.2h-1v5.2l5.6 9.4c.7 1.2-.2 2.6-1.6 2.6H5.8c-1.4 0-2.3-1.4-1.6-2.6l5.6-9.4V4.6h-1z"], d: ["M7.6 15.2h8.8l2.2 3.8c.3.5-.1 1.1-.7 1.1H6.1c-.6 0-1-.6-.7-1.1z"], xd: [C(11, 12.6, .9), C(13.2, 10.6, .7)] },
    battery: { m: ["M2.8 7.2h15.6a1.4 1.4 0 0 1 1.4 1.4v6.8a1.4 1.4 0 0 1-1.4 1.4H2.8a1.4 1.4 0 0 1-1.4-1.4V8.6a1.4 1.4 0 0 1 1.4-1.4z", "M20.6 9.8h2v4.4h-2z"], d: ["M11.8 8.6 7.4 12.6h3.2l-1.2 3 4.4-4.2h-3.2z"] },
    arm: { m: ["M2.8 20.4V9.6c0-.8.2-1.6.6-2.2L4.6 5c.4-.8 1.2-1.4 2.2-1.4h2.6c1.2 0 2.2 1 2.2 2.2v1.4c0 .8-.4 1.4-1 1.8l-1.6 1v4.6c1.2-2.4 3.6-3.8 6.4-3.8 3.6 0 6.4 2.6 6.4 6v2c0 1.6-1.2 2.8-2.8 2.8H5.2c-1.4 0-2.4-1-2.4-2.4z"], dl: ["M9 15.6c.8 1 1.8 1.6 3 1.8"], xl: ["M4.6 6.4h4.4"] },
    swirl: { ml: [["M12.2 12.4c0-1 .9-1.6 1.8-1.4 1.6.3 2.1 2.2 1.2 3.5-1.2 1.8-3.9 1.9-5.3.2-1.8-2-1.2-5.3 1-6.5 2.9-1.6 6.5-.2 7.5 2.9 1.2 3.7-1 7.3-4.7 8-4.1.8-7.8-2-8.2-6.2", 2.4]] },
    horseshoe: { ml: [["M6 20.8 4.6 14C3.4 8 7 3.2 12 3.2S20.6 8 19.4 14L18 20.8", 3.6]], xd: [C(5.4, 15.8, .7), C(5, 11.4, .7), C(18.6, 15.8, .7), C(19, 11.4, .7)] },
    spring: { ml: [["M5.2 20.8h13.6M5.2 3.2h13.6", 2.4], ["M16.8 20.8 7.2 17.6l9.6-3.2-9.6-3.2 9.6-3.2-9.6-3.2", 2.2]] },
    lotus: { m: ["M12 3.6c2.3 2.3 3.2 5.2 3.2 7.9S14.1 17.6 12 19.2c-2.1-1.6-3.2-4.9-3.2-7.7S9.7 5.9 12 3.6z", "M2.2 9.4c3.8-.2 6.6 1.6 8.2 4.6.7 1.3 1 3 .8 5.2-4.6-.4-8.2-3.8-9-9.8zM21.8 9.4c-3.8-.2-6.6 1.6-8.2 4.6-.7 1.3-1 3-.8 5.2 4.6-.4 8.2-3.8 9-9.8z"], ml: [["M3.2 21h17.6", 1.8]] },
    mirror: { m: ["M12 2.2c3.7 0 6.4 2.9 6.4 6.8s-2.7 6.8-6.4 6.8-6.4-2.9-6.4-6.8 2.7-6.8 6.4-6.8z", "M10.6 15.2h2.8l.7 6.6h-4.2z"], d: ["M12 4.4c2.5 0 4.2 2 4.2 4.6s-1.7 4.6-4.2 4.6-4.2-2-4.2-4.6 1.7-4.6 4.2-4.6z"], hl: ["M9.4 7.6c.4-1.1 1.2-1.8 2.2-2"] },
    chevron: { ml: [["M3.8 9.8 12 4.4l8.2 5.4M3.8 15.2 12 9.8l8.2 5.4M3.8 20.6 12 15.2l8.2 5.4", 2.8]] },
    puzzle: { m: ["M3.6 7.2h4.4c-.4-.5-.6-1.1-.6-1.7A2.5 2.5 0 0 1 9.9 3a2.5 2.5 0 0 1 2.5 2.5c0 .6-.2 1.2-.6 1.7h4.4v4.4c.5-.4 1.1-.6 1.7-.6a2.5 2.5 0 0 1 2.5 2.5 2.5 2.5 0 0 1-2.5 2.5c-.6 0-1.2-.2-1.7-.6v5.2H3.6v-4.4c.5.4 1.1.6 1.7.6a2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5c-.6 0-1.2.2-1.7.6z"] },
    pawn: { m: ["M12 2.4a3.1 3.1 0 0 1 2 5.5c1.5.6 2.4 1.7 2.4 2.8h-2.5c.3 3.1 1.6 5.5 3.6 6.9H6.5c2-1.4 3.3-3.8 3.6-6.9H7.6c0-1.1.9-2.2 2.4-2.8a3.1 3.1 0 0 1 2-5.5z", "M4.8 18.4h14.4v3.2H4.8z"] },
    speech: { m: ["M12 2.8c5.5 0 9.8 3.5 9.8 8s-4.3 8-9.8 8c-1 0-2-.1-3-.3l-4.8 2.7 1-4.3c-2-1.5-3-3.7-3-6.1 0-4.5 4.3-8 9.8-8z"], d: [C(7.8, 10.8, 1.4), C(12, 10.8, 1.4), C(16.2, 10.8, 1.4)] },
    wheel: { ml: [[C(12, 12, 8.8), 3.2], [rays(12, 12, 6, 2.8, 8, -90), 1.7]], m: [C(12, 12, 2.8)] },
    camera: { m: ["M3.8 7h3.4l1.6-2.6h6.4L16.8 7h3.4a1.6 1.6 0 0 1 1.6 1.6v10.2a1.6 1.6 0 0 1-1.6 1.6H3.8a1.6 1.6 0 0 1-1.6-1.6V8.6A1.6 1.6 0 0 1 3.8 7z"], d: [C(12, 13.6, 4.6)], m2: [C(12, 13.6, 2.6)], xd: [C(18.4, 9.6, .9)] },
    castle: { m: ["M2.4 21.4V6.6h3.2v2.2h1.8V6.6h3V11h3.2V6.6h3v2.2h1.8V6.6h3.2v14.8z"], d: ["M9.6 21.4v-4.6a2.4 2.4 0 0 1 4.8 0v4.6z", "M4.6 12.4h1.8v2.6H4.6zM17.6 12.4h1.8v2.6h-1.8z"] },
    cycle: { ml: [["M4.4 10.6A7.8 7.8 0 0 1 17.8 7M19.6 13.4A7.8 7.8 0 0 1 6.2 17", 2.6]], m: ["M19.2 2.4l.6 6.6-6.4-1zM4.8 21.6 4.2 15l6.4 1z"] },
    swords: { ml: [["M3.6 3.6l13.6 13.6M20.4 3.6 6.8 17.2", 2.4], ["M13.4 19l5.6-5.6M10.6 19 5 13.4M18 18l3.2 3.2M6 18l-3.2 3.2", 2.6]] },
    globe: { m: [C(12, 12, 9.8)], dl: [["M2.4 12h19.2M12 2.2c-3 2.7-4.4 6.1-4.4 9.8s1.4 7.1 4.4 9.8M12 2.2c3 2.7 4.4 6.1 4.4 9.8s-1.4 7.1-4.4 9.8", 1.4]], xl: ["M4 7h16M4 17h16"] },
    telescope: { ml: [["M3.4 14.2 18.4 6.4", 4.6], ["M10.8 12.4 7.6 21.4M10.8 12.4l3.4 9", 1.8]], d: ["M15.4 6.2l1.8 3.4"], m: [C(10.8, 12, 1.6)] },
    temple: { m: ["M12 2.2l9.8 5.2v1.8H2.2V7.4z", "M4.2 10.6h3v7.6h-3zM10.5 10.6h3v7.6h-3zM16.8 10.6h3v7.6h-3z", "M2.2 19.4h19.6v2.4H2.2z"] },
    safe: { m: ["M3.6 3h16.8a1.6 1.6 0 0 1 1.6 1.6v14a1.6 1.6 0 0 1-1.6 1.6H3.6A1.6 1.6 0 0 1 2 18.6v-14A1.6 1.6 0 0 1 3.6 3z", "M4.4 20.2h3v1.8h-3zM16.6 20.2h3v1.8h-3z"], d: [C(11, 11.6, 4.6)], m2: [C(11, 11.6, 2.8)], dl: ["M18.4 9v5.2"], xl: [rays(11, 11.6, 4, 2.9, 4.2, 45)] },
    ruler: { m: ["M2.2 16.4 16.4 2.2l5.4 5.4L7.6 21.8z"], dl: [["M6 13.4l2.2 2.2M8.6 10.8l1.4 1.4M11.2 8.2l2.2 2.2M13.8 5.6l1.4 1.4", 1.4]] },
    scale: { ml: [["M12 3.2V20M4.8 6.4h14.4M7.6 21h8.8", 2.2], ["M4.8 6.6 2.2 13.4M4.8 6.6l2.6 6.8M19.2 6.6l-2.6 6.8M19.2 6.6l2.6 6.8", 1.2]], m: ["M1.6 13.4h6.4c0 1.9-1.4 3.2-3.2 3.2s-3.2-1.3-3.2-3.2zM16 13.4h6.4c0 1.9-1.4 3.2-3.2 3.2S16 15.3 16 13.4z", C(12, 3.2, 1.6)] },
    runner: { m: [C(15, 3.8, 2.5)], ml: [["M13.4 8.6 10.6 14.2l3.6 2.6-1.6 5M10.6 14.2l-2.6 4-3.8.4M12.8 9.2l3.8 2.6 3.2-1.2M12.8 9.2 8.6 9.8l-2.2 3.2", 2.8]] },
    apple: { m: ["M12 7.2c1.7-1.3 4.2-1.7 6-.4 2.7 1.7 3.3 5.6 1.9 9.1-1.2 3.1-3.5 5.8-5.8 5.8-.8 0-1.4-.4-2.1-.4s-1.3.4-2.1.4c-2.3 0-4.6-2.7-5.8-5.8C2.7 12.4 3.3 8.5 6 6.8c1.8-1.3 4.3-.9 6 .4z", "M12.4 6.2c0-2.5 1.5-4 4-4.2-.2 2.5-1.7 4-4 4.2z"], hl: ["M6.6 10.6c.3-1.1 1-1.9 1.9-2.2"] },
    bone: { m: [C(5, 7.8, 2.6), C(7.8, 5, 2.6), C(16.2, 19, 2.6), C(19, 16.2, 2.6), "M5.4 9.2 9.2 5.4l9.4 9.4-3.8 3.8z"] },
    leg: { m: ["M5.4 2.4h6.8l4.2 7.6c.6 1.1.5 2.2-.1 3.1l-3.2 5.2 4.6 1c1.3.3 2 1.1 2 2.3H8.6c-.7 0-1.1-.5-.9-1.1l.9-3.2 2.8-5.6z"], dl: ["M13.6 8.6c1 .5 1.7 1.4 1.9 2.6"], xl: ["M9 18.8h4.2"] },
    hand: { m: ["M7.2 21.6c-1.6-1.4-3.6-4-4.6-6.2-.5-1.1 0-2.2 1-2.6.8-.3 1.7 0 2.2.7l1.4 2V5.2c0-1 .8-1.7 1.7-1.7s1.7.7 1.7 1.7v5.2-7c0-1 .8-1.7 1.7-1.7s1.7.7 1.7 1.7v7-5.6c0-1 .8-1.7 1.7-1.7s1.7.7 1.7 1.7v6.4-3.6c0-1 .8-1.7 1.7-1.7s1.7.7 1.7 1.7v8.4c0 4-2.4 6.4-5.4 7.6z"], dl: [["M10.8 4.8v6.4M14.2 3.6v7.6M17.6 5.8v5.4", 1.2]] },
    trident: { ml: [["M12 6.4v15.8M5 4.4v3.8c0 2.6 3 4.1 7 4.1s7-1.5 7-4.1V4.4", 2.2]], m: ["M12 1.4l2.2 4h-4.4zM5 1.6l2.2 3.6H2.8zM19 1.6l2.2 3.6h-4.4z"] },
    rock: { m: ["M2.6 19.6 5.2 10l5.2-5 6.6 1.8 4.6 6.2-1.1 6.6z"], dl: ["M10.4 5.2 9.4 10.8l3.2 2.8M17 7l-1.6 5.6 5.2 1.2"] },
    orb: { m: [C(12, 10.4, 8), "M6.2 17.4h11.6l1.8 4.4H4.4z"], h: [C(9.2, 7.6, 1.8)], xd: ["M14.6 12.6l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"] },
    torch: { m: ["M9.6 11.6h4.8l-1.4 10.2h-2z", "M6.8 9h10.4l-1.6 3.2H8.4z", "M12 1.4c2.3 2.1 3.4 4 3.4 5.4 0 1.7-1.5 2.8-3.4 2.8S8.6 8.5 8.6 6.8c0-1.4 1.1-3.3 3.4-5.4z"], d: ["M12 4.6c1 1 1.4 1.8 1.4 2.6 0 .8-.6 1.3-1.4 1.3s-1.4-.5-1.4-1.3c0-.8.4-1.6 1.4-2.6z"] },
    chain: { ml: [["M4.4 2.6c0 7.2 3.4 11.2 7.6 11.2s7.6-4 7.6-11.2", 1.4]], m: [C(4.8, 5.4, 1.7), C(5.8, 9.2, 1.7), C(8, 12.2, 1.7), C(19.2, 5.4, 1.7), C(18.2, 9.2, 1.7), C(16, 12.2, 1.7), "M12 13.6l3.4 3.8-3.4 4.6-3.4-4.6z"] },
    wall: { m: ["M2.2 4.4h9.2v4.6H2.2zM12.6 4.4h9.2v4.6h-9.2zM2.2 10.2h4.2v4.6H2.2zM7.6 10.2h8.8v4.6H7.6zM17.6 10.2h4.2v4.6h-4.2zM2.2 16h9.2v4.6H2.2zM12.6 16h9.2v4.6h-9.2z"] },
    utensils: { ml: [["M7 2.4v7.6M4.4 2.4v5.2a2.6 2.6 0 0 0 5.2 0V2.4M7 10.2v11.4", 2]], m: ["M16.4 2.2c2.6 1.6 3.8 5 3.8 9.4H17v10.2h-2.6V2.4z"] },
    bottle: { m: ["M9.8 2.2h4.4v2.6l1.9 2.6v13a1.4 1.4 0 0 1-1.4 1.4H9.3a1.4 1.4 0 0 1-1.4-1.4v-13l1.9-2.6z"], d: ["M7.9 11h8.2v5.8H7.9z"], ml: [["M12 2.2V.8", 1.6]] },
    drop: { m: ["M12 2.2c3.7 4.5 6.8 8.6 6.8 12.6a6.8 6.8 0 0 1-13.6 0c0-4 3.1-8.1 6.8-12.6z"], hl: ["M8.6 14.6c0 1.7 1 3.1 2.5 3.5"] },
    tag: { m: ["M2.4 4v7.6l10.2 10.2 9.2-9.2L11.6 2.4H4a1.6 1.6 0 0 0-1.6 1.6z"], d: [C(7, 7, 1.7)], xl: ["M11 12.6l3.4 3.4M13 10.6l3.4 3.4"] },
    clover: { m: [0, 90, 180, 270].reduce(function (a, d) { return a.concat(heart(12, 11, d)) }, []), ml: [["M12.6 14.6c.4 3 1.8 5.4 4.2 7.2", 2]], d: [C(12, 11, 1.2)] },
    lens: { ml: [[C(9.8, 9.8, 6.6), 2.8], ["M14.8 14.8l6.2 6.2", 3.8]], hl: ["M6.6 8.4c.4-1.3 1.4-2.2 2.6-2.6"] },
    ladder: { ml: [["M6.4 2.2v19.6M17.6 2.2v19.6", 2.4], ["M6.4 6.4h11.2M6.4 11h11.2M6.4 15.6h11.2M6.4 20.2h11.2", 2]] },
    quill: { m: ["M21 2.2C13.6 3.2 7.6 9 6 16.6l1.6 1.6C15.2 16.6 21 10 21 2.2z"], ml: [["M3.4 20.8l10-10", 1.6]], xl: ["M10 14.2l3.4-.4M12 11.6l3.8-.6M14.4 9l3.4-.8"] },
    buoy: { ml: [[C(12, 12, 7.2), 4.6]], f: ["M10.2 2.4h3.6v4.4h-3.6zM10.2 17.2h3.6v4.4h-3.6zM2.4 10.2h4.4v3.6H2.4zM17.2 10.2h4.4v3.6h-4.4z"] },
    burst: { m: [star(12, 12, 10, 10.8, 5.4, 8, [1, .82, .96, .78, 1, .86, .94, .8, .98, .84])], d: [star(12, 12, 10, 5.4, 2.8, 8)] },
    briefcase: { m: ["M3.6 7.4h16.8a1.6 1.6 0 0 1 1.6 1.6v10.2a1.6 1.6 0 0 1-1.6 1.6H3.6A1.6 1.6 0 0 1 2 19.2V9a1.6 1.6 0 0 1 1.6-1.6z"], ml: [["M8.8 7.4V5.2c0-.8.6-1.4 1.4-1.4h3.6c.8 0 1.4.6 1.4 1.4v2.2", 2]], dl: ["M2.4 12.8h19.2"], d: ["M10.4 11.6h3.2v2.6h-3.2z"] },
    skull: { m: ["M12 2.4c4.9 0 8.4 3.4 8.4 8 0 2.6-1.2 4.7-3.2 5.9v2.6a1.4 1.4 0 0 1-1.4 1.4H8.2a1.4 1.4 0 0 1-1.4-1.4v-2.6c-2-1.2-3.2-3.3-3.2-5.9 0-4.6 3.5-8 8.4-8z"], d: [C(8.7, 11, 2.2), C(15.3, 11, 2.2), "M12 13.6l1.2 2.1h-2.4z"], dl: ["M10.2 17.8v2.4M13.8 17.8v2.4"] },
    hammer: { ml: [["M10.4 10.4l10 10", 3.2]], m: ["M1.8 8.6 8.6 1.8l5.6 5.6-6.8 6.8z"], xl: ["M5.6 6.2l2.2 2.2"] },
    stop: { m: ["M8 2.2h8l5.8 5.8v8L16 21.8H8L2.2 16V8z"], d: ["M6.2 10.4h11.6v3.2H6.2z"] },
    glove: { m: ["M7 21.6v-9L4.3 9.8c-.8-.8-.8-2.1 0-2.9.8-.8 2.1-.8 2.9 0l.8.8V4.2c0-.9.7-1.7 1.7-1.7s1.6.8 1.6 1.7V3.4c0-.9.7-1.7 1.7-1.7s1.6.8 1.6 1.7v.8c0-.9.7-1.6 1.6-1.6s1.7.7 1.7 1.6v1.2c0-.9.7-1.6 1.6-1.6S20 4.5 20 5.4v8.6c0 3-1.6 5.5-4 6.3v1.3z"], dl: [["M11.3 3.8v6.4M14.6 3.6v6.6M17.9 4.8v5.8", 1.2], "M7 18.4h9.4"] },
    gift: { m: ["M3.6 10.4h16.8v10.2a1.2 1.2 0 0 1-1.2 1.2H4.8a1.2 1.2 0 0 1-1.2-1.2z", "M2.2 6.8h19.6v3.8H2.2z"], f: ["M10.5 6.8h3v15h-3z"], ml: [["M12 6.8C10.4 3.4 6.8 3 6.8 5.2 6.8 6.8 10 6.8 12 6.8c2 0 5.2 0 5.2-1.6 0-2.2-3.6-1.8-5.2 1.6", 1.6]] },
    receipt: { m: ["M4.8 2.2h14.4v19.6l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6z"], dl: ["M8 6.6h8M8 10h8M8 13.4h5"], xl: ["M14.6 13.4h1.4"] },
    phone: { m: ["M7.6 2.2h8.8a1.6 1.6 0 0 1 1.6 1.6v16.4a1.6 1.6 0 0 1-1.6 1.6H7.6A1.6 1.6 0 0 1 6 20.2V3.8a1.6 1.6 0 0 1 1.6-1.6z"], d: ["M7.8 4.6h8.4v12.6H7.8z"], ml: [["M2.8 8.2v7.6M21.2 8.2v7.6", 1.6]] },
    comet: { m: [star(16.4, 7.6, 5, 5.6, 2.4)], ml: [["M12.6 11.4 3 21M10.2 9.2 4.6 14.8M14.8 13.8 9.2 19.4", 1.8]] },
    spoon: { m: ["M12 2c2.6 0 4.4 2.2 4.4 5.2 0 2.6-1.4 4.6-3.2 5.2l.4 8.4c0 .8-.7 1.4-1.6 1.4s-1.6-.6-1.6-1.4l.4-8.4C9 11.8 7.6 9.8 7.6 7.2 7.6 4.2 9.4 2 12 2z"], hl: ["M10.4 5.4c.3-.9.8-1.4 1.5-1.6"] },
    turtle: { m: ["M4.6 15.4c0-4.4 3.4-7.6 7.4-7.6s7.4 3.2 7.4 7.6z", "M19 13.2c.4-1.6 1.6-2.6 3-2.4.6 1.4 0 3.2-1.6 3.6zM5.6 15.4h3v3H5.6zM15.4 15.4h3v3h-3z"], dl: ["M8 11.2l2 2.4h4l2-2.4M10 13.6 9.4 15.4M14 13.6l.6 1.8M12 7.8v2"] },
    sliders: { ml: [["M3 6h18M3 12h18M3 18h18", 1.8]], m: ["M6.6 3.6h3v4.8h-3zM13.8 9.6h3v4.8h-3zM8.2 15.6h3v4.8h-3z"] },
    bell: { m: ["M12 2.4c3.6 0 6.2 2.8 6.2 6.6v4.6l2.2 3.2H3.6l2.2-3.2V9c0-3.8 2.6-6.6 6.2-6.6z", C(12, 19.6, 2.2)] },
    ticket: { m: ["M2.2 6.2h19.6v3.6a2.2 2.2 0 0 0 0 4.4v3.6H2.2v-3.6a2.2 2.2 0 0 0 0-4.4z"], dl: ["M15.6 7.4v1.8M15.6 11.1v1.8M15.6 14.8v1.8"], xl: ["M5.6 10h6.4M5.6 13.8h4.4"] }
  };

  /* a concept is either drawn here or one of v193 V's own glyphs */
  var SAME = { brain: "brainl", crown: "crownl", jersey: "shirt", mountain: "peak", dumbbell: "barbell", up: "rise", arrowup: "rise", trophycup: "trophy", sun: "sun", calendar: "calendar", book: "book", heart: "heart", chart: "chart", sprout: "sprout", medal: "medal", scroll: "scroll", infinity: "infinity", die: "die", dice: "die", sparkle: "sparkle", stadium: "stadium", house: "home", figure: "figure", palette: "palette", flag: "flag", tomb: "tomb", trend: "trend", speaker: "speaker", disk: "disk", family: "family", check: "check", tent: "tent", shades: "shades", idcard: "idcard", warning: "warning", grade: "grade", skip: "skip", goalpost: "goalpost", trophy: "trophy" };
  function data(c) { if (!c) return null; c = SAME[c] || c; return A[c] || (V.glyphs && V.glyphs[c]) || null }
  function canon(c) { return SAME[c] || c }

  /* every emoji the career still shows, to a concept: the ~180 prestige-tree nodes first, then the cards */
  var NODE_ART_V193Y = {
    // Physical
    "\u{1F9EC}": "dna", "\u{1F4A8}": "wind", "\u{1F3CB}️": "barbell", "\u{1F3CB}": "barbell", "\u{1F9BE}": "arm", "\u{1F300}": "swirl", "\u{1FAC1}": "lungs", "⚙️": "gear", "⚙": "gear",
    "⚡": "bolt", "\u{1F40E}": "horseshoe", "\u{1F98D}": "fist", "\u{1F9EA}": "flask", "\u{1F9B8}": "mask", "\u{1F998}": "spring", "⚓": "anchor", "\u{1F9CA}": "crystal",
    "\u{1F50B}": "battery", "\u{1F6DE}": "wheel",
    // Mental
    "\u{1F9D8}": "lotus", "\u{1FA9E}": "mirror", "⭐": "star", "\u{1F4CB}": "clipboard", "\u{1F39E}️": "film", "\u{1F39E}": "film", "\u{1F525}": "flame", "\u{1F9E4}": "glove",
    "\u{1F3AF}": "target", "\u{1F6E1}️": "shield", "\u{1F6E1}": "shield", "\u{1F4DA}": "book", "\u{1F9D3}": "chevron", "\u{1F31F}": "nova", "\u{1F9E9}": "puzzle", "♟️": "pawn", "♟": "pawn",
    "\u{1F976}": "crystal", "\u{1F3AD}": "mask", "\u{1F5E3}️": "speech", "\u{1F5E3}": "speech", "\u{1F624}": "fist", "\u{1F441}️": "eye", "\u{1F441}": "eye",
    // Career
    "\u{1F48E}": "gem", "⚕️": "cross", "⚕": "cross", "\u{1F3C6}": "trophy", "♻️": "cycle", "♻": "cycle", "\u{1F3DF}️": "stadium", "\u{1F3DF}": "stadium", "\u{1F680}": "rocket",
    "\u{1F4F8}": "camera", "\u{1F3C5}": "medal", "\u{1F3F0}": "castle", "\u{1F3C8}": "football", "\u{1F451}": "crown", "\u{1F682}": "wheel", "\u{1F3B2}": "die", "\u{1F4E3}": "megaphone",
    "❄️": "crystal", "❄": "crystal", "⚔️": "swords", "⚔": "swords",
    // Legacy
    "\u{1F4B0}": "moneybag", "\u{1F52D}": "telescope", "\u{1F91D}": "handshake", "\u{1F30D}": "globe", "♛": "crown", "\u{1F410}": "laurel", "∞": "infinity", "\u{1F48D}": "ring",
    "\u{1F4DC}": "scroll", "\u{1F3DB}️": "temple", "\u{1F3DB}": "temple",
    // Body
    "\u{1F4CF}": "ruler", "⚖️": "scale", "⚖": "scale", "\u{1F969}": "arm", "\u{1F3C3}": "runner", "\u{1F3A8}": "palette", "\u{1F957}": "apple", "\u{1F4A0}": "gem", "\u{1F5FF}": "figure",
    "\u{1F9BF}": "shield", "\u{1F9B4}": "bone",
    // Camps
    "\u{1F4AA}": "arm", "\u{1F9E0}": "brain", "\u{1F531}": "trident", "\u{1F9B6}": "cleat", "\u{1F4FD}️": "film", "\u{1F4FD}": "film", "\u{1FAA8}": "rock", "\u{1F3D4}️": "mountain", "\u{1F3D4}": "mountain",
    "\u{1F9D1}‍\u{1F3EB}": "whistle",
    // Swagger
    "\u{1F4FC}": "tape", "\u{1F3AC}": "clapper", "\u{1F5EF}️": "speech", "\u{1F5EF}": "speech", "\u{1F4E2}": "megaphone", "\u{1F319}": "moon", "\u{1F52E}": "orb", "\u{1F5FD}": "torch",
    // Eternal
    "\u{1F30C}": "swirl", "\u{1F4AB}": "sparkle", "\u{1F6D7}": "rise", "\u{1F320}": "comet", "\u{1F4FF}": "chain", "\u{1F317}": "moon",
    // Locker Room
    "\u{1F9F1}": "wall", "\u{1F9AC}": "helmet", "\u{1F37D}️": "utensils", "\u{1F37D}": "utensils", "\u{1F356}": "utensils", "\u{1F9C3}": "bottle",
    // Apex
    "⏳": "hourglass", "\u{1F9FC}": "drop", "\u{1F3E5}": "cross", "\u{1F3E6}": "safe", "\u{1F3F7}️": "tag", "\u{1F3F7}": "tag", "\u{1F32C}️": "wind", "\u{1F32C}": "wind",
    "\u{1F4C8}": "trend", "\u{1F31E}": "sun", "\u{1F340}": "clover", "\u{1F0CF}": "card", "\u{1F3B4}": "card",
    // Franchise
    "\u{1F50D}": "lens", "\u{1F4D6}": "book", "\u{1F39B}️": "sliders", "\u{1F39B}": "sliders", "♾️": "infinity", "♾": "infinity",
    // Fate & Pressure
    "\u{1FA9C}": "ladder", "\u{1F9AE}": "chain", "\u{1F4DD}": "quill", "\u{1F501}": "cycle", "\u{1F6DF}": "buoy", "✍️": "quill", "✍": "quill", "\u{1F4A5}": "burst", "\u{1F52B}": "burst",
    "\u{1F4BC}": "briefcase", "\u{1F33E}": "sprout", "\u{1F621}": "fist", "\u{1F3B0}": "die", "☠️": "skull", "☠": "skull", "✨": "sparkle",
    // Impossible
    "\u{1F528}": "hammer", "\u{1F3D7}️": "rise", "\u{1F3D7}": "rise", "\u{1F4D0}": "ruler", "\u{1FA7A}": "cross", "\u{1F409}": "coins", "\u{1F6D1}": "stop",
    /* the cards around the career */
    "\u{1F381}": "gift", "\u{1F9FE}": "receipt", "\u{1F4B5}": "coins", "\u{1FA99}": "coins", "\u{1F331}": "sprout", "\u{1F944}": "spoon", "❤️‍\u{1FA79}": "bandage", "❤️": "heart", "❤": "heart", "\u{1F494}": "heart", "➕": "cross", "\u{1FAE1}": "chevron",
    "\u{1F9B5}": "leg", "✋": "hand", "\u{1FA79}": "bandage", "\u{1F45F}": "cleat", "\u{1F3BD}": "jersey", "\u{1F455}": "jersey", "\u{1F3BE}": "football", "\u{1F50A}": "speaker", "\u{1F509}": "speaker", "\u{1F4F3}": "phone",
    "\u{1F422}": "turtle", "\u{1F514}": "bell", "\u{1F465}": "family", "\u{1F4C5}": "calendar", "\u{1F5D3}️": "calendar", "\u{1F4CA}": "chart", "\u{1F3E0}": "house", "\u{1F333}": "sprout",
    "★": "star", "\u{1F396}️": "medal", "\u{1F396}": "medal", "\u{1F4BE}": "disk", "\u{1F3AE}": "gear", "\u{1F512}": "lock", "\u{1F513}": "lock", "\u{1F511}": "key", "\u{1F4A1}": "bolt",
    "\u{1F947}": "medal", "\u{1F948}": "medal", "\u{1F949}": "medal", "⏱️": "hourglass", "⏱": "hourglass", "\u{1F3A5}": "camera", "\u{1F4F9}": "camera", "\u{1F3B5}": "speaker", "\u{1F3B6}": "speaker",
    "✅": "check", "⏩": "skip", "⏭": "skip", "⏭️": "skip", "\u{1F39F}️": "ticket", "\u{1F39F}": "ticket", "\u{1F3D8}️": "house", "\u{1F3D8}": "house", "\u{1F504}": "cycle",
    "\u{1F4E4}": "disk", "\u{1F4E5}": "disk", "⚠️": "warning", "⚠": "warning", "\u{1F468}‍\u{1F466}": "family", "\u{1F9CD}": "figure", "\u{1F6F8}": "rocket", "\u{1FAAA}": "idcard", "\u{1F4C6}": "calendar", "\u{1F3CB}‍♂️": "barbell"
  };
  /* an emoji not in the table: the node's name / description says what it is */
  var KEYWORD_ART_V193Y = [
    [/injur|heal|medic|trainer/i, "cross"], [/prestige point|\bPP\b|money|paycheck|fortune|hoard/i, "coins"], [/ceiling|potential/i, "rise"],
    [/growth|grow/i, "sprout"], [/trust|coach/i, "whistle"], [/card/i, "card"], [/playoff|title|champion/i, "trophy"], [/speed|quick|accel/i, "wind"],
    [/strength|muscle/i, "arm"], [/awareness|vision|read/i, "eye"], [/stamina|fatigue|lung/i, "lungs"], [/teammate|team/i, "family"], [/luck|odds|chance|roll/i, "clover"],
    [/upgrade point|point/i, "star"], [/season|year/i, "calendar"], [/stat|production/i, "chart"]
  ];

  /* the sprite: one hidden <svg>, its gradients and the symbols drawn so far */
  var NS = "http://www.w3.org/2000/svg", INK = "#1a1206", host = null, defsEl = null;
  function sprite() {
    if (host && host.isConnected) return defsEl;
    host = document.getElementById("ribArtSpriteV193Y");
    if (!host) {
      host = document.createElementNS(NS, "svg");
      host.id = "ribArtSpriteV193Y"; host.setAttribute("aria-hidden", "true"); host.setAttribute("focusable", "false");
      host.setAttribute("width", "0"); host.setAttribute("height", "0");
      // never display:none — Chrome drops gradients and symbols referenced across SVGs then
      host.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none");
      host.innerHTML = '<defs><radialGradient id="ribartS" cx=".3" cy=".2" r=".62"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>';
      (document.body || document.documentElement).appendChild(host);
    }
    defsEl = host.querySelector("defs");
    return defsEl;
  }
  var GOLD = ["#fff6d2", "#f7d470", "#a8701c", "#e2b04c", "#8a5812", "#c9963a"], OFFS = V.offs || [0, 0.3, 0.5, 0.57, 0.86, 1];
  function hexOf(tint) { var c = tint && V.hex ? V.hex(tint) : null; return c ? c.map(function (v) { return (v < 16 ? "0" : "") + v.toString(16) }).join("") : "gold" }
  function grad(tint) {
    var d = sprite(), key = hexOf(tint), id = "ribartM-" + key;
    if (!document.getElementById(id)) {
      var s = key === "gold" || !V.stops ? GOLD : V.stops(tint), body = OFFS.map(function (o, i) { return '<stop offset="' + o + '" stop-color="' + s[i] + '"/>' }).join("");
      [[id, 'x1=".2" y1="0" x2=".75" y2="1"'], [id + "u", 'gradientUnits="userSpaceOnUse" x1="5" y1="1" x2="17" y2="23"']].forEach(function (g) {
        var el = document.createElementNS(NS, "linearGradient");
        el.id = g[0];
        g[1].replace(/(\w+)="([^"]*)"/g, function (_, k, v) { el.setAttribute(k, v) });
        el.innerHTML = body;
        d.appendChild(el);
      });
    }
    return id;
  }
  function list(a) { return (a || []).map(function (x) { return typeof x === "string" ? [x, null] : x }) }
  function symbolMarkup(g) {
    var w = g.w || 2.3, o = [], P = function (d, st) { o.push('<path d="' + d + '" style="' + st + '"/>') };
    var M = "var(--raM,url(#ribartM-gold))", MU = "var(--raMu,url(#ribartM-goldu))", RIM = "calc(var(--raO,2.2) * 1px)";
    // the dark rim, under everything
    list(g.m).concat(list(g.m2)).forEach(function (p) { P(p[0], "fill:" + INK + ";stroke:" + INK + ";stroke-width:" + RIM + ";stroke-linejoin:round") });
    list(g.ml).forEach(function (p) { P(p[0], "fill:none;stroke:" + INK + ";stroke-width:calc(" + (p[1] || w) + "px + var(--raO,2.2) * 1px);stroke-linecap:round;stroke-linejoin:round") });
    list(g.f).forEach(function (p) { P(p[0], "fill:" + INK + ";stroke:" + INK + ";stroke-width:1.6;stroke-linejoin:round") });
    // the metal, its accent, the specular
    list(g.ml).forEach(function (p) { P(p[0], "fill:none;stroke:" + MU + ";stroke-width:" + (p[1] || w) + ";stroke-linecap:round;stroke-linejoin:round") });
    list(g.m).forEach(function (p) { P(p[0], "fill:" + M) });
    list(g.f).forEach(function (p) { P(p[0], "fill:var(--raAcc,#e8463a)") });
    list(g.m).forEach(function (p) { P(p[0], "fill:url(#ribartS)") });
    // the engraving (x / xl: fine, gone when small)
    list(g.d).forEach(function (p) { P(p[0], "fill:" + INK + ";fill-opacity:.82") });
    list(g.dl).forEach(function (p) { P(p[0], "fill:none;stroke:" + INK + ";stroke-opacity:.85;stroke-width:" + (p[1] || 1.5) + ";stroke-linecap:round;stroke-linejoin:round") });
    list(g.xd).forEach(function (p) { P(p[0], "fill:" + INK + ";fill-opacity:.8;opacity:var(--raFd,1)") });
    list(g.xl).forEach(function (p) { P(p[0], "fill:none;stroke:" + INK + ";stroke-opacity:.7;stroke-width:" + (p[1] || 1.1) + ";stroke-linecap:round;stroke-linejoin:round;opacity:var(--raFd,1)") });
    // metal over the engraving (a lens in its socket), glints
    list(g.m2).forEach(function (p) { P(p[0], "fill:" + M) });
    list(g.m2).forEach(function (p) { P(p[0], "fill:url(#ribartS)") });
    list(g.h).forEach(function (p) { P(p[0], "fill:#fff;fill-opacity:.85") });
    list(g.hl).forEach(function (p) { P(p[0], "fill:none;stroke:#fff;stroke-opacity:.8;stroke-width:" + (p[1] || 1.2) + ";stroke-linecap:round") });
    return o.join("");
  }
  function symbol(c) {
    var d = sprite(), id = "ribart-" + c;
    if (!document.getElementById(id)) {
      var s = document.createElementNS(NS, "symbol");
      s.id = id; s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("overflow", "visible");
      s.innerHTML = symbolMarkup(data(c));
      d.appendChild(s);
    }
    return id;
  }

  /* what a name or an emoji draws: a concept, the emoji table, the emoji without its variation selector, a keyword in the hint */
  function concept(name, hint) {
    if (name == null) return null;
    var n = String(name).trim();
    if (data(n)) return canon(n);
    var c = NODE_ART_V193Y[n] || NODE_ART_V193Y[n.replace(/️/g, "")] || NODE_ART_V193Y[n + "️"];
    if (c && data(c)) return canon(c);
    if (hint) for (var i = 0; i < KEYWORD_ART_V193Y.length; i++) if (KEYWORD_ART_V193Y[i][0].test(hint)) return canon(KEYWORD_ART_V193Y[i][1]);
    return null;
  }
  var fallbacks = {};   // every emoji that reached the keyword table or fell through, for the check
  /* the one entry point: markup for `name` (a concept or an emoji) — the emoji itself when unknown or switched off */
  function art(name, opt) {
    opt = opt || {};
    var emoji = opt.emoji != null ? String(opt.emoji) : String(name == null ? "" : name);
    if (!on()) return esc(emoji);
    var n = String(name == null ? "" : name).trim(), direct = data(n) || NODE_ART_V193Y[n] || NODE_ART_V193Y[n.replace(/️/g, "")];
    var c = concept(name, opt.hint);
    if (!c) { if (n) fallbacks[n] = "emoji"; return esc(emoji) }
    if (!direct) fallbacks[n] = c;
    css();
    var id = symbol(c), size = +opt.size || 20, g = grad(opt.tint), cls = "ra-v193y" + (size < 20 ? " ra-sm-v193y" : "") + (opt.cls ? " " + opt.cls : "");
    // its own element name: a card's `span` / `i` rules (`.pl-head span`, `.mp-face i` …) never reach the drawing
    return '<rib-art class="' + cls + '" data-art="' + c + '" style="--ra:' + size + 'px"><svg class="ra-svg-v193y" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="--raM:url(#' + g + ');--raMu:url(#' + g + 'u)"><use href="#' + id + '"/></svg>' + (emoji && emoji !== c ? '<rib-sr class="sr-only-v193y">' + esc(emoji) + "</rib-sr>" : "") + "</rib-art>";
  }
  /* an emoji at the head of a string becomes art; the rest of the string is left as it is (markup allowed) */
  var LEAD = /^(\s*)((?:\p{Extended_Pictographic}|[★∞♛])(?:️|‍(?:\p{Extended_Pictographic}|\p{Emoji_Component})|\p{Emoji_Modifier})*)\s?/u;
  function lead(s, opt) {
    s = String(s == null ? "" : s);
    if (!on()) return s;
    var m = s.match(LEAD);
    if (!m || !concept(m[2], opt && opt.hint)) return s;
    return m[1] + art(m[2], opt) + " " + s.slice(m[0].length);
  }

  function css() {
    if (document.getElementById("raCssV193Y")) return;
    var st = document.createElement("style");
    st.id = "raCssV193Y";
    st.textContent = [
      ".ra-v193y{display:inline-flex;flex:none;align-items:center;justify-content:center;width:var(--ra,20px);height:var(--ra,20px);vertical-align:middle;line-height:0;top:-.06em;font-size:0;position:relative}",
      ".ra-svg-v193y{display:block;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 1.2px 1px rgba(0,0,0,.75));pointer-events:none}",
      ".ra-sm-v193y .ra-svg-v193y{--raFd:0;--raO:2.6;filter:drop-shadow(0 1px .6px rgba(0,0,0,.7))}",
      ".sr-only-v193y{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important;font-size:12px}",
      /* the tree's node rows: the icon box holds a 34 px piece of metal */
      ".shop-item .ic:has(.ra-v193y){display:flex;align-items:center;justify-content:center;font-size:0}",
      ".shop-item .ic .ra-v193y{--ra:34px}",
      ".ra-line-v193y{display:inline-flex;align-items:center;gap:.28em}",
      ".pl-head .ra-line-v193y{align-self:center}",
      ".ra-sw-v193y{margin-right:.08em}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(st);
  }

  window.ribArtV193Y = art;
  window.ribArtLeadV193Y = lead;

  /* the cards' own headers and rows: a SWEEP, like the v139 bar — every screen builds its markup from scratch, so the
   * lines that open with an emoji (the hub's player card, the card headers, the dock's buttons, Settings' rows) get
   * their emoji drawn after each draw. Only a line's FIRST text, only an emoji the library knows; the emoji stays in
   * the line as screen-reader text, so the line's textContent is what it was. Never the live broadcast or the menu. */
  var SWEEP = [
    ".player-hero .meta-row > .meta", ".player-hero .threshold-note", ".origin-icon-v11",
    "#screen .card > .l", "#screen .card > .eyebrow", "#screen .card > details > summary .eyebrow", "#screen .card > details > summary > .l",
    "#screen .card .sg-head .eyebrow", "#screen .sg-row > span", "#seasonMathBtnV193D", "#screen .card .lab", "#screen > .h2", "#screen .hubv75-sec > .h2",
    "#dock .btn", "#dock > .small", "#dock .qa-chip-v146",
    "#screen .toggle-label", "#screen .fx-label", "#screen .card > .btn", ".rib-dialog h5", ".pb-v192b h5"
  ].join(",");
  var LEAD_SW = /^(\s*)(\p{Extended_Pictographic}(?:\uFE0F|\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Component})|\p{Emoji_Modifier})*)/u;
  var tpl = null;
  function sweepOne(el) {
    var n = el.firstChild;
    while (n && n.nodeType === 3 && !n.data.trim()) n = n.nextSibling;
    if (!n || n.nodeType !== 3) return;
    var m = n.data.match(LEAD_SW);
    if (!m || /^[⭐★]/.test(m[2]) || !concept(m[2])) return;   // a row of stars is a rating, not an icon
    var fs = parseFloat(getComputedStyle(el).fontSize) || 14, size = Math.max(14, Math.min(44, Math.round(fs * (el.classList.contains("origin-icon-v11") ? 1.15 : 1.3))));
    tpl = tpl || document.createElement("template");
    tpl.innerHTML = art(m[2], { size: size, cls: "ra-sw-v193y" });
    n.data = n.data.slice(m[0].length);
    if (/flex|grid/.test(getComputedStyle(el).display)) {
      // a flex box would lay the drawing and its words out as two items (a column chip stacks them): keep them one line
      var w = document.createElement("rib-line");
      w.className = "ra-line-v193y";
      el.insertBefore(w, n);
      w.appendChild(tpl.content);
      w.appendChild(n);
    } else el.insertBefore(tpl.content, n);
  }
  var queued = false;
  function sweep() {
    queued = false;
    try {
      if (!on() || !document.body) return;
      var v = window.S && window.S.view;
      if (v === "live" || v === "menu") return;
      var els = document.querySelectorAll(SWEEP);
      for (var i = 0; i < els.length; i++) sweepOne(els[i]);
    } catch (e) {}
  }
  function queue() { if (!queued) { queued = true; (window.requestAnimationFrame || setTimeout)(sweep) } }
  try { new MutationObserver(queue).observe(document.documentElement, { childList: true, subtree: true }) } catch (e) {}
  queue();
  window.NODE_ART_V193Y = NODE_ART_V193Y;
  // a save that boots onto the tree drew its nodes before this file loaded: draw them once more
  setTimeout(function () {
    try { if (on() && window.S && window.S.view === "shop" && document.querySelector(".shop-item .ic") && !document.querySelector(".shop-item .ra-v193y") && typeof window.render === "function") window.render() } catch (e) {}
  }, 0);
  window.__V193Y = { on: on, art: art, lead: lead, concept: concept, data: data, sweep: sweep, sweepSel: SWEEP, library: function () { var k = Object.keys(A); Object.keys(SAME).forEach(function (s) { if (k.indexOf(SAME[s]) < 0 && data(s)) k.push(SAME[s]) }); return k.sort() }, map: NODE_ART_V193Y, keywords: KEYWORD_ART_V193Y, fallbacks: fallbacks, symbol: symbol, grad: grad };
})();

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
  /* v193 C: every view the bar can be seen on lights a tab \u2014 HUB for the career's own pages (rank, stats,
   * the Hall, the profile, seasons), TREE for the prestige pages (dynasty, path, the locker), MENU for the
   * menu's (settings, Score Attack, the leaderboard); "highscore" used to light TREE and "daily" HUB only */
  var NAV = [
    { k: "hub",      go: "hub",      icon: "\u{1F3E0}", label: "HUB",    views: ["hub", "life", "daily", "rank", "stats", "hof", "profile", "seasons"] },
    { k: "season",   go: "season",   icon: "\u{1F4C5}", label: "SEASON", views: ["season", "event", "sim", "result"] },
    { k: "upgrade",  go: "upgrade",  icon: "\u{1F4C8}", label: "SKILLS", views: ["upgrade", "training"] },
    { k: "shop",     go: "shop",     icon: "\u{1F333}", label: "TREE",   views: ["shop", "dynasty", "path", "locker"] },
    { k: "menu",     go: "menu",     icon: "\u2630",    label: "MENU",   views: ["menu", "settings", "highscore", "leaderboard"] }
  ];
  var OFF = { live: 1, win: 1, gameover: 1, menu: 1, tier: 1, club: 1 };   // no bar over the broadcast or the main menu; v193 C: nor over a choice that must be made (the program, the club)
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
    icons();
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-k]"); if (!b) return;
      var n = NAV.filter(function (x) { return x.k === b.dataset.k })[0]; if (!n) return;
      try { window.go(n.go) } catch (err) {}
    });
    document.body.appendChild(bar);
  }
  /* v193 V: the menu's paintings on the bar (the emoji under `TU("v193V", 0)`); re-drawn when the switch flips */
  var iconMode = null;
  function icons() {
    var want = !!(window.__V193V && window.__V193V.on());
    if (!bar || iconMode === want) return;
    iconMode = want;
    bar.classList.toggle("ric-on-v193v", want);
    [].forEach.call(bar.children, function (b) {
      var n = NAV.filter(function (x) { return x.k === b.dataset.k })[0], i = b.querySelector("i");
      if (!n || !i) return;
      i.className = want ? "ric-i-v193v" : "";
      i.innerHTML = want ? window.ribIconV193V("nav:" + n.k, n.icon) : n.icon;
    });
  }
  function sync() {
    var v = state();
    if (v === null) { if (bar && lastOn !== false) { bar.classList.remove("on"); lastOn = false } return }
    build();
    icons();
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
