
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
  window.__V193V = { on: on, icon: icon, glyph: glyphOf, art: ART, glyphs: G, alias: ALIAS, fail: fail, css: css };
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
