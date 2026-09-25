/* ===== v151 B HE LOOKS THE PART =====
 * Cosmetics and the profile card. The owner's model sells STATUS, never power: everything in this file
 * changes what a player LOOKS like — on the field, on his card, on a leaderboard row — and nothing the
 * sim reads. Not one gameplay number moves (v151Bcheck sims seeded games with nothing equipped and with
 * everything equipped and asserts the two box scores are identical), and nothing here draws from
 * Math.random: the celebrations and the camo roll their own PRNG, so a live game's random stream is the
 * same whatever he wears.
 *
 * `window.RIB_COSMETICS` is the contract other workers build against:
 *   catalog()            [{id, cat, name, rarity, price?, packs:[packId], source, preview(el), ...}]
 *   owned(id)            free: always · earned / pass: the cosmetics store · shop / founder: RIB_MONETIZE
 *   grant(id, source)    earned / pass → the store (once, toasted) · shop / founder → RIB_MONETIZE.grant("cos:<id>")
 *   grantPack(packId, source)
 *   equip(slot, id)      equipped(slot)      packs()      onChange(cb) → unsubscribe
 *   profile()            the compact JSON the leaderboard worker stores (no PII beyond the in-game name)
 *   renderCard(data, el|opts)   the player card markup (and, given an element, the drawn character)
 *   teamStyle            the Team Creator's gated logos and palettes (5 free picks, then PP, or unlock-all)
 *
 * STORAGE. `localStorage["rib.cosmetics.v1"]` = {v:1, owned:{id:{source,at}}, equipped:{slot:id},
 * ach:{id:at}, ts:{l:[],p:[],free,paid,gf}} — OUTSIDE the career save, so a new career, a season reset and
 * an imported save neither grant nor take a look. Shop and founder items are never stored here: their
 * entitlements live in RIB_MONETIZE (`cos:<id>`, `cos:<packId>`, `founder`), and with monetization OFF
 * they are simply not offered. Earned, pass and free items are a live, free feature whatever the switch.
 *
 * RENDERING HOOKS (each a small bannered call in its own file, each the identity with nothing equipped):
 *   uniform / helmet  src/05 `ribSyncYouKitV96` → fieldKit(): the "you" textures only (never "off"/"def"),
 *                     a deco on ribRegisterTeam's put (patterns, helmet shell / stripe / decal / finish);
 *                     the menu feed's team.colors (07) → the hero, portrait and continue-card masks
 *   celebration       src/05 `celebrate()` → celebrate(): extra particles + a callout on HIS touchdown
 *   stadium           src/05 `bowlTrimV112` → stadiumTheme(): band, lip, tunnel frame, a wash over the stands (home only)
 *   vault             public/rib-vault.js → vaultTheme() / vaultTint(): room grade, coin tint, motes
 *   frame / banner / shelf   renderCard()                recap   html[data-cos-recap] on the report / career end
 * `window.__V151B` is what the check reads. */
(function () {
  "use strict";
  if (window.RIB_COSMETICS) return;
  var KEY = "rib.cosmetics.v1";
  var TUv = function (k, d) { try { return typeof TU === "function" ? TU(k, d) : d; } catch (e) { return d; } };
  var V = (window.__V151B = window.__V151B || { celebrations: [], stadium: null, kit: null, vault: null, grants: [], recap: null });
  var escHtml = function (s) {
    try { if (typeof window.escHtml === "function") return window.escHtml(s); } catch (e) {}
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  };
  var HEX = /^#[0-9a-f]{6}$/i;
  var hexOk = function (h) { return typeof h === "string" && HEX.test(h) ? h : null; };
  var rgb = function (h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; };
  var cdist = function (a, b) { var x = rgb(a), y = rgb(b); return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]); };
  function prng(seed) { var s = seed >>> 0; return function () { s = (s + 0x6d2b79f5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var rnd = prng(Date.now() ^ 0x5eed);

  /* ---------------- the catalogue ---------------- */
  var SLOTS = ["uniform", "helmet", "frame", "celebration", "stadium", "vault", "banner", "shelf", "recap", "title", "badge", "nameplate", "icon"];
  var CATS = {
    uniform: { name: "UNIFORMS", icon: "👕", def: "uni_team" },
    helmet: { name: "HELMETS", icon: "🪖", def: "hel_team" },
    frame: { name: "CARD FRAMES", icon: "🖼️", def: "frame_basic" },
    celebration: { name: "TD CELEBRATIONS", icon: "🎉", def: "cel_classic" },
    stadium: { name: "STADIUMS", icon: "🏟️", def: "std_home" },
    vault: { name: "VAULT THEMES", icon: "🪙", def: "vault_classic" },
    banner: { name: "BANNERS", icon: "🎌", def: "ban_charcoal" },
    shelf: { name: "TROPHY SHELF", icon: "🏆", def: "shelf_oak" },
    recap: { name: "RECAP THEMES", icon: "📰", def: "recap_broadcast" },
    /* the Career Pass's own kinds (src/29-seasons.js): filled from `RIB_SEASONS.rewards()` — see passItem() */
    title: { name: "TITLES", icon: "🏷", def: "title_none" },
    badge: { name: "BADGES", icon: "🎖", def: "badge_none" },
    nameplate: { name: "NAMEPLATES", icon: "🔖", def: "plate_none" },
    icon: { name: "PROFILE ICONS", icon: "👤", def: "icon_none" }
  };
  /* earned: the achievement that unlocks it (ACH below) · pass: the season-pass tier the pass worker grants */
  var ITEMS = [
    // UNIFORMS — j jersey, p pants (and the helmet, unless a helmet is equipped), t trim, pat the pattern, ps a pant stripe
    { id: "uni_team", cat: "uniform", name: "Team Kit", rarity: "common", source: "free", k: null, blurb: "Your school's own colours." },
    { id: "uni_road", cat: "uniform", name: "Road Whites", rarity: "common", source: "free", k: { j: "#eceef1", p: "#c9ced6", t: "#1c2a44", pat: "sleeves" } },
    { id: "uni_blackout", cat: "uniform", name: "Blackout", rarity: "epic", source: "earned", ach: "uff", k: { j: "#16181c", p: "#16181c", t: "#d4af37", pat: "solid", ps: "#d4af37" } },
    { id: "uni_gold_std", cat: "uniform", name: "Gold Standard", rarity: "epic", source: "earned", ach: "title", k: { j: "#c9a13b", p: "#f4ecd4", t: "#1a1a1a", pat: "hoops" } },
    { id: "uni_pinstripe", cat: "uniform", name: "Pinstripe Navy", rarity: "rare", source: "shop", packs: ["pack_uniforms1"], k: { j: "#1b2a4a", p: "#e9e6dc", t: "#c7d0de", pat: "pinstripe" } },
    { id: "uni_split", cat: "uniform", name: "Split Decision", rarity: "rare", source: "shop", packs: ["pack_uniforms1"], k: { j: "#8a1c2b", p: "#f0f0f0", t: "#f0f0f0", pat: "split" } },
    { id: "uni_fade", cat: "uniform", name: "Sunset Fade", rarity: "rare", source: "shop", packs: ["pack_uniforms1"], k: { j: "#e0602b", p: "#2b1a3a", t: "#6a1d6b", pat: "fade" } },
    { id: "uni_camo", cat: "uniform", name: "Field Camo", rarity: "rare", source: "pass", tier: 8, k: { j: "#4c5a3a", p: "#3a4230", t: "#2a3122", pat: "camo" } },
    { id: "uni_electric", cat: "uniform", name: "Electric Blue", rarity: "epic", source: "pass", tier: 20, k: { j: "#1e6fff", p: "#0c1a33", t: "#8fe3ff", pat: "chest" } },
    { id: "uni_1924", cat: "uniform", name: "Leatherhead '24", rarity: "legendary", source: "shop", packs: ["pack_historical"], k: { j: "#7a4b2a", p: "#c8b48a", t: "#e8dcc0", pat: "hoops" } },
    { id: "uni_1958", cat: "uniform", name: "Ironmen '58", rarity: "legendary", source: "shop", packs: ["pack_historical"], k: { j: "#a31f24", p: "#f0ebe0", t: "#f0ebe0", pat: "sleeves" } },
    { id: "uni_1972", cat: "uniform", name: "Mud Bowl '72", rarity: "legendary", source: "shop", packs: ["pack_historical"], k: { j: "#f2e7c9", p: "#5a3d22", t: "#5a3d22", pat: "yoke" } },
    { id: "uni_1994", cat: "uniform", name: "Neon '94", rarity: "legendary", source: "shop", packs: ["pack_historical"], k: { j: "#18c3b8", p: "#f5f5f5", t: "#ff3d7f", pat: "fade" } },
    { id: "uni_founder", cat: "uniform", name: "Founder's Kit", rarity: "mythic", source: "founder", k: { j: "#0d0f14", p: "#0d0f14", t: "#e6c46a", pat: "pinstripe", ps: "#e6c46a" } },
    // HELMETS — s shell, st stripe, d decal colour (dk its kind), f finish
    { id: "hel_team", cat: "helmet", name: "Team Shell", rarity: "common", source: "free", h: null, blurb: "Whatever the kit wears." },
    { id: "hel_matte_black", cat: "helmet", name: "Matte Black", rarity: "common", source: "free", h: { s: "#1b1d22", f: "matte" } },
    { id: "hel_gloss_white", cat: "helmet", name: "Gloss White", rarity: "common", source: "free", h: { s: "#f1f3f5", st: "#c8102e", f: "gloss" } },
    { id: "hel_chrome_gold", cat: "helmet", name: "Chrome Gold", rarity: "legendary", source: "earned", ach: "mvp", h: { s: "#d9b24a", st: "#1a1a1a", f: "chrome" } },
    { id: "hel_interstellar", cat: "helmet", name: "Event Horizon", rarity: "mythic", source: "earned", ach: "interstellar", h: { s: "#3b2d7a", st: "#b9a6ff", f: "metal", d: "#ffffff", dk: "star" } },
    { id: "hel_carbon", cat: "helmet", name: "Carbon Fibre", rarity: "rare", source: "shop", packs: ["pack_helmets1"], h: { s: "#2a2d33", st: "#6b7280", f: "matte", d: "#e5e7eb", dk: "dot" } },
    { id: "hel_ice", cat: "helmet", name: "Ice Shell", rarity: "rare", source: "shop", packs: ["pack_helmets1"], h: { s: "#bfe6ff", st: "#1f5fbf", f: "gloss" } },
    { id: "hel_crimson", cat: "helmet", name: "Crimson Metallic", rarity: "rare", source: "shop", packs: ["pack_helmets1"], h: { s: "#9e1b25", st: "#f4f4f4", f: "metal" } },
    { id: "hel_1924", cat: "helmet", name: "Leather Cap '24", rarity: "legendary", source: "shop", packs: ["pack_historical"], h: { s: "#6b4226", f: "matte" } },
    { id: "hel_1958", cat: "helmet", name: "Single Bar '58", rarity: "legendary", source: "shop", packs: ["pack_historical"], h: { s: "#a31f24", st: "#f0ebe0", f: "matte" } },
    { id: "hel_star", cat: "helmet", name: "Lone Star", rarity: "epic", source: "pass", tier: 14, h: { s: "#0f2d5c", st: "#ffffff", f: "gloss", d: "#ffffff", dk: "star" } },
    { id: "hel_founder", cat: "helmet", name: "Founder's Chrome", rarity: "mythic", source: "founder", h: { s: "#0d0f14", st: "#e6c46a", f: "chrome", d: "#e6c46a", dk: "star" } },
    // CARD FRAMES — a CSS frame on the profile card and on leaderboard rows
    { id: "frame_basic", cat: "frame", name: "Broadcast", rarity: "common", source: "free", css: "basic" },
    { id: "frame_steel", cat: "frame", name: "Brushed Steel", rarity: "common", source: "free", css: "steel" },
    { id: "frame_gold", cat: "frame", name: "Gold", rarity: "epic", source: "earned", ach: "title", css: "gold" },
    { id: "frame_platinum", cat: "frame", name: "Platinum", rarity: "legendary", source: "earned", ach: "hof", css: "platinum" },
    { id: "frame_cosmic", cat: "frame", name: "Cosmic", rarity: "mythic", source: "earned", ach: "interstellar", css: "cosmic" },
    { id: "frame_flame", cat: "frame", name: "On Fire", rarity: "epic", source: "shop", packs: ["pack_frames1"], css: "flame", anim: 1 },
    { id: "frame_ring", cat: "frame", name: "Championship Ring", rarity: "epic", source: "shop", packs: ["pack_frames1"], css: "ring" },
    { id: "frame_diamond", cat: "frame", name: "Diamond Cut", rarity: "epic", source: "shop", packs: ["pack_frames1"], css: "diamond" },
    { id: "frame_carbon", cat: "frame", name: "Carbon", rarity: "rare", source: "pass", tier: 4, css: "carbon" },
    { id: "frame_founder", cat: "frame", name: "Founder", rarity: "mythic", source: "founder", css: "founder", anim: 1 },
    // TOUCHDOWN CELEBRATIONS — what the field does when HE scores (purely visual)
    { id: "cel_classic", cat: "celebration", name: "Confetti", rarity: "common", source: "free", c: null, blurb: "The stadium's own confetti." },
    { id: "cel_spotlight", cat: "celebration", name: "Spotlight", rarity: "common", source: "free", c: { kind: "spot", col: ["#fff6d8", "#ffd76f"], say: "HIS HOUSE" } },
    { id: "cel_goldrain", cat: "celebration", name: "Gold Rain", rarity: "legendary", source: "earned", ach: "td100", c: { kind: "rain", col: ["#ffd76f", "#e6b53a", "#fff3c4"], say: "CENTURY" } },
    { id: "cel_fireworks", cat: "celebration", name: "Fireworks", rarity: "epic", source: "shop", packs: ["pack_celebrations1"], c: { kind: "fireworks", col: ["#ff5a5a", "#ffd76f", "#6fd3ff", "#ffffff"], say: "SHOWTIME" } },
    { id: "cel_lightning", cat: "celebration", name: "Lightning Strike", rarity: "epic", source: "shop", packs: ["pack_celebrations1"], c: { kind: "bolt", col: ["#bfe6ff", "#ffffff", "#7fb2ff"], say: "LIGHTS OUT" } },
    { id: "cel_flame", cat: "celebration", name: "Scorched Earth", rarity: "epic", source: "shop", packs: ["pack_celebrations1"], c: { kind: "flame", col: ["#ff7a1a", "#ffb02e", "#ff3b1a"], say: "TOO HOT" } },
    { id: "cel_stars", cat: "celebration", name: "Seeing Stars", rarity: "rare", source: "pass", tier: 12, c: { kind: "stars", col: ["#ffffff", "#ffe98a", "#b9a6ff"], say: "STARBOY" } },
    { id: "cel_smoke", cat: "celebration", name: "Team Smoke", rarity: "rare", source: "pass", tier: 24, c: { kind: "smoke", col: ["team"], say: "IN THE BUILDING" } },
    { id: "cel_founder", cat: "celebration", name: "The Crown", rarity: "mythic", source: "founder", c: { kind: "crown", col: ["#e6c46a", "#fff3c4"], say: "ALL HAIL" } },
    // STADIUMS — presentation presets over the bowl, on HOME games only
    { id: "std_home", cat: "stadium", name: "Home Colours", rarity: "common", source: "free", st: null, blurb: "The stadium as the art paints it." },
    { id: "std_midnight", cat: "stadium", name: "Midnight Bowl", rarity: "common", source: "free", st: { band: "#101a2e", lip: "#8fb4ff", crowd: "#c9d6ff", ez: "night" } },
    { id: "std_blackgold", cat: "stadium", name: "Black & Gold", rarity: "epic", source: "earned", ach: "uff", st: { band: "#15171b", lip: "#d4af37", crowd: "#ffe7a8", ez: "gold" } },
    { id: "std_neon", cat: "stadium", name: "Neon Night", rarity: "epic", source: "shop", packs: ["pack_stadium_neon"], st: { band: "#2b0f4d", lip: "#ff3df2", crowd: "#d8b8ff", ez: "neon" } },
    { id: "std_oldfield", cat: "stadium", name: "Old Field", rarity: "epic", source: "shop", packs: ["pack_stadium_oldfield"], st: { band: "#3d5a2a", lip: "#e8dcc0", crowd: "#ffe2b8", ez: "brick" } },
    { id: "std_ice", cat: "stadium", name: "Ice Bowl", rarity: "rare", source: "pass", tier: 16, st: { band: "#cfe8ff", lip: "#ffffff", crowd: "#d6ecff", ez: "ice" } },
    { id: "std_crimson", cat: "stadium", name: "Crimson Cauldron", rarity: "rare", source: "pass", tier: 28, st: { band: "#5c0f16", lip: "#ff6b6b", crowd: "#ffc2c2", ez: "fire" } },
    { id: "std_founder", cat: "stadium", name: "Founders' Field", rarity: "mythic", source: "founder", st: { band: "#0d0f14", lip: "#e6c46a", crowd: "#fff0c8", ez: "gold" } },
    // VAULT THEMES — coin tint, room grade, the motes in the air
    { id: "vault_classic", cat: "vault", name: "Classic Hoard", rarity: "common", source: "free", vt: null, blurb: "Bronze, silver, gold and blue, as minted." },
    { id: "vault_obsidian", cat: "vault", name: "Obsidian", rarity: "legendary", source: "earned", ach: "hof", vt: { coin: "#7c7f8a", coinMix: 0.55, room: "#1a1c24", roomMix: 0.55, mote: "#c9ccd6" } },
    { id: "vault_nebula", cat: "vault", name: "Nebula", rarity: "mythic", source: "earned", ach: "interstellar", vt: { coin: "#9a7bff", coinMix: 0.45, room: "#2a1650", roomMix: 0.6, mote: "#d7c9ff" } },
    { id: "vault_rose", cat: "vault", name: "Rose Gold", rarity: "epic", source: "shop", packs: ["pack_vault_rose"], vt: { coin: "#e7a38f", coinMix: 0.55, room: "#3a1d22", roomMix: 0.45, mote: "#ffd1c4" } },
    { id: "vault_emerald", cat: "vault", name: "Emerald", rarity: "epic", source: "shop", packs: ["pack_vault_emerald"], vt: { coin: "#3fbf7f", coinMix: 0.5, room: "#0f2a1f", roomMix: 0.55, mote: "#9dffcf" } },
    { id: "vault_glacier", cat: "vault", name: "Glacier", rarity: "rare", source: "pass", tier: 18, vt: { coin: "#bfe3ff", coinMix: 0.5, room: "#10283a", roomMix: 0.5, mote: "#e8f6ff" } },
    { id: "vault_founder", cat: "vault", name: "Founder's Reserve", rarity: "mythic", source: "founder", vt: { coin: "#e6c46a", coinMix: 0.25, room: "#0d0f14", roomMix: 0.6, mote: "#fff0c8" } },
    // BANNERS — the band across the top of the profile card
    { id: "ban_charcoal", cat: "banner", name: "Charcoal", rarity: "common", source: "free", bg: "linear-gradient(135deg,#1b2230,#0b0f16)" },
    { id: "ban_gridiron", cat: "banner", name: "Gridiron", rarity: "common", source: "free", bg: "repeating-linear-gradient(90deg,#1f5a2e 0 22px,#236633 22px 44px)" },
    { id: "ban_lights", cat: "banner", name: "Friday Lights", rarity: "epic", source: "earned", ach: "title", bg: "radial-gradient(circle at 18% 0,#fff6d8 0,#f0bb45 12%,transparent 34%),radial-gradient(circle at 82% 0,#fff6d8 0,#f0bb45 12%,transparent 34%),linear-gradient(180deg,#1a2436,#0a0e15)" },
    { id: "ban_lineage", cat: "banner", name: "The Family Name", rarity: "legendary", source: "earned", ach: "gen3", bg: "linear-gradient(135deg,#3a2a0e,#6b4e1a 45%,#2a1d08)" },
    { id: "ban_sunset", cat: "banner", name: "Sunset Drive", rarity: "rare", source: "pass", tier: 2, bg: "linear-gradient(180deg,#ff8a3d,#b83b5e 55%,#3b1f4a)" },
    { id: "ban_aurora", cat: "banner", name: "Aurora", rarity: "epic", source: "pass", tier: 22, bg: "linear-gradient(120deg,#0b2a3a,#1e8c7a 35%,#6a4cc2 70%,#0b1020)" },
    { id: "ban_founder", cat: "banner", name: "Founder", rarity: "mythic", source: "founder", bg: "repeating-linear-gradient(135deg,#0d0f14 0 10px,#15181f 10px 20px),linear-gradient(#0d0f14,#0d0f14)", edge: "#e6c46a" },
    // TROPHY SHELF — how his hardware is displayed on the card
    { id: "shelf_oak", cat: "shelf", name: "Oak", rarity: "common", source: "free", css: "oak" },
    { id: "shelf_steel", cat: "shelf", name: "Steel Rack", rarity: "common", source: "free", css: "steel" },
    { id: "shelf_gold", cat: "shelf", name: "Gilded", rarity: "epic", source: "earned", ach: "ring", css: "gold" },
    { id: "shelf_marble", cat: "shelf", name: "Marble Hall", rarity: "legendary", source: "earned", ach: "hof", css: "marble" },
    { id: "shelf_glass", cat: "shelf", name: "Glass Case", rarity: "rare", source: "pass", tier: 10, css: "glass" },
    { id: "shelf_founder", cat: "shelf", name: "Founder's Cabinet", rarity: "mythic", source: "founder", css: "founder" },
    // RECAP THEMES — the report card and the career-end card's skin
    { id: "recap_broadcast", cat: "recap", name: "Broadcast", rarity: "common", source: "free", css: null },
    { id: "recap_newsprint", cat: "recap", name: "Newsprint", rarity: "common", source: "free", css: "news" },
    { id: "recap_gold", cat: "recap", name: "Gold Edition", rarity: "epic", source: "earned", ach: "title", css: "gold" },
    { id: "recap_neon", cat: "recap", name: "Neon Replay", rarity: "rare", source: "pass", tier: 6, css: "neon" },
    { id: "recap_chalk", cat: "recap", name: "Chalkboard", rarity: "rare", source: "pass", tier: 26, css: "chalk" },
    { id: "recap_founder", cat: "recap", name: "Founder's Edition", rarity: "mythic", source: "founder", css: "founder" },
    // the pass kinds' defaults (nothing shown); the items themselves arrive from the Career Pass
    { id: "title_none", cat: "title", name: "No Title", rarity: "common", source: "free", text: "" },
    { id: "badge_none", cat: "badge", name: "No Badge", rarity: "common", source: "free", glyph: "" },
    { id: "plate_none", cat: "nameplate", name: "Plain", rarity: "common", source: "free", plate: "" },
    { id: "icon_none", cat: "icon", name: "Initials", rarity: "common", source: "free", glyph: "" }
  ];
  var PACKS = [
    { id: "pack_uniforms1", name: "Uniform Pack", price: "$1.99", productId: "rib.cos.uniforms1", items: [] },
    { id: "pack_helmets1", name: "Helmet Pack", price: "$1.99", productId: "rib.cos.helmets1", items: [] },
    { id: "pack_celebrations1", name: "Touchdown Celebration Pack", price: "$2.99", productId: "rib.cos.celebrations1", items: [] },
    { id: "pack_stadium_neon", name: "Stadium Theme: Neon Night", price: "$2.99", productId: "rib.cos.stadium_neon", items: [] },
    { id: "pack_stadium_oldfield", name: "Stadium Theme: Old Field", price: "$2.99", productId: "rib.cos.stadium_oldfield", items: [] },
    { id: "pack_frames1", name: "Card Frames Pack", price: "$1.99", productId: "rib.cos.frames1", items: [] },
    { id: "pack_vault_rose", name: "Vault Theme: Rose Gold", price: "$2.99", productId: "rib.cos.vault_rose", items: [] },
    { id: "pack_vault_emerald", name: "Vault Theme: Emerald", price: "$2.99", productId: "rib.cos.vault_emerald", items: [] },
    { id: "pack_historical", name: "Historical Uniform Bundle", price: "$4.99", productId: "rib.cos.historical", items: [] },
    { id: "founder", name: "Founder Bundle", price: null, productId: null, founder: true, items: [] }
  ];
  var BY = {};
  ITEMS.forEach(function (it) {
    it.packs = it.packs || [];
    BY[it.id] = it;
    it.packs.forEach(function (pid) { var p = PACKS.find(function (q) { return q.id === pid; }); if (p) p.items.push(it.id); });
    if (it.source === "founder") PACKS[PACKS.length - 1].items.push(it.id);
    var pk = it.packs.length ? PACKS.find(function (q) { return q.id === it.packs[0]; }) : null;
    if (pk && pk.price) it.price = pk.price;
    it.preview = function (el) { return previewInto(el, it); };
  });
  /* ---------------- the Career Pass's rewards (src/29-seasons.js) ----------------
   * The pass grants `pass.<seasonId>.<track>.<tier>` ids, each with a kind (banner, frame, title, badge, nameplate,
   * icon, celebration, kit). They are registered here as ordinary catalogue items — the current season's whole
   * track up front (locked until claimed, so the Locker says where they come from), any other season's the moment
   * one is granted or found in stored profile data. Their look is derived from the id alone (a hash), so every
   * device draws the same reward the same way. */
  var PASS_CAT = { banner: "banner", frame: "frame", celebration: "celebration", kit: "uniform", title: "title", badge: "badge", nameplate: "nameplate", icon: "icon" };
  function hsh(str) { var h = 2166136261 >>> 0; str = String(str); for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function hslHex(h, s2, l) { var a = s2 * Math.min(l, 1 - l), f = function (n) { var k = (n + h / 30) % 12, c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * c).toString(16).padStart(2, "0"); }; return "#" + f(0) + f(8) + f(4); }
  var ICON_GLYPHS = ["🦅", "🐺", "🦁", "🐻", "⚡", "🔥", "🛡️", "👑", "🐍", "🦈"];
  function passItem(rw) {
    try {
      if (!rw || !/^pass\.[A-Za-z0-9_-]+\.(free|premium)\.\d+$/.test(String(rw.id || ""))) return null;
      if (BY[rw.id]) return BY[rw.id];
      var cat = PASS_CAT[rw.kind]; if (!cat) return null;
      var h = hsh(rw.id), c1 = hslHex(h % 360, 0.62, 0.42), c2 = hslHex((h >>> 9) % 360, 0.72, 0.62), rr = /^(common|rare|epic|legendary)$/.test(rw.rarity) ? rw.rarity : "common";
      var it = { id: rw.id, cat: cat, name: String(rw.name || "Pass reward").replace(/[<>]/g, "").slice(0, 40), rarity: rr, source: "pass", tier: rw.tier | 0, track: rw.track === "premium" ? "premium" : "free", season: String(rw.season || "").slice(0, 12), packs: [], passKind: rw.kind };
      if (cat === "banner") it.bg = "linear-gradient(135deg," + c1 + " 0%," + c2 + " 55%,#0b0f16 100%)";
      else if (cat === "frame") it.css = { common: "steel", rare: "carbon", epic: "diamond", legendary: "gold" }[rr];
      else if (cat === "celebration") it.c = { kind: { common: "spot", rare: "stars", epic: "fireworks", legendary: "rain" }[rr], col: [c2, "#ffffff", c1], say: rr === "legendary" ? "LEGEND" : "SEASON " + String(it.season).replace(/^s/, "") };
      else if (cat === "uniform") it.k = { j: "team", p: "team", t: c2, pat: ["sleeves", "yoke", "chest", "hoops"][h % 4] };
      else if (cat === "title") it.text = it.name.replace(/[“”"]/g, "");
      else if (cat === "badge") it.glyph = ["🎖", "🏅", "⭐", "🔰", "💠"][h % 5], it.col = c2;
      else if (cat === "nameplate") it.plate = "linear-gradient(90deg," + c1 + "cc," + c2 + "33 70%,transparent)";
      else if (cat === "icon") it.glyph = ICON_GLYPHS[h % ICON_GLYPHS.length], it.col = c1;
      it.preview = function (el) { return previewInto(el, it); };
      ITEMS.push(it); BY[it.id] = it; return it;
    } catch (e) { return null; }
  }
  var passSynced = "";
  function syncPass() {
    try {
      var S = window.RIB_SEASONS; if (!S || !S.rewards || !S.current) return;
      var sid = S.current().id; if (passSynced === sid) return; passSynced = sid;
      var R = S.rewards(sid) || {}; (R.free || []).concat(R.premium || []).forEach(passItem);
      // what the store already owns from earlier seasons
      Object.keys(load().owned).forEach(function (id) { if (!BY[id]) findItem(id); });
    } catch (e) {}
  }
  function findItem(id) {
    if (BY[id]) return BY[id];
    var m = /^pass\.([A-Za-z0-9_-]+)\.(free|premium)\.(\d+)$/.exec(String(id || ""));
    if (!m) return null;
    try { var S = window.RIB_SEASONS, R = S && S.rewards ? S.rewards(m[1]) : null, list = R ? R[m[2]] || [] : []; for (var i = 0; i < list.length; i++) if (list[i].id === id) return passItem(list[i]); } catch (e) {}
    return null;
  }
  /* "team" in a kit means the team's own colour (the pass's Kit Trim keeps the team's jersey and adds a trim) */
  function teamCol(i) { var t = (window.__GRIDIRON_TEAM_CUSTOM__ || {}).col; return (Array.isArray(t) && hexOk(t[i])) || (i ? "#e8c86a" : "#1f4fd0"); }
  function resolveU(U, tc) { if (!U) return null; if (U.j !== "team" && U.p !== "team") return U; var o = Object.assign({}, U); if (o.j === "team") o.j = (tc && hexOk(tc[0])) || teamCol(0); if (o.p === "team") o.p = (tc && hexOk(tc[1])) || teamCol(1); return o; }

  /* ACHIEVEMENTS — read off the account's own state; each grants its items once, with a toast */
  var ACH = [
    { id: "title", name: "First title", desc: "Win a championship at any level", test: function (A) { return A.titles >= 1; } },
    { id: "ring", name: "UFF ring", desc: "Win the UFF championship", test: function (A) { return A.rings >= 1 || A.uffTitles >= 1; } },
    { id: "mvp", name: "MVP", desc: "Be named MVP / Player of the Year", test: function (A) { return A.mvps >= 1; } },
    { id: "td100", name: "100 touchdowns", desc: "Score 100 touchdowns in one career", test: function (A) { return A.bestTds >= 100; } },
    { id: "uff", name: "Reached the UFF", desc: "Make it to the UFF", test: function (A) { return A.uffReached >= 1; } },
    { id: "interstellar", name: "Interstellar", desc: "Reach the Interstellar League", test: function (A) { return A.interstellar >= 1; } },
    { id: "gen3", name: "Third generation", desc: "Play as the third generation of your family", test: function (A) { return A.gen >= 3; } },
    { id: "hof", name: "Hall of Fame", desc: "Enshrine a career in the Hall of Fame", test: function (A) { return A.hof >= 1; } }
  ];
  var ACH_BY = {}; ACH.forEach(function (a) { ACH_BY[a.id] = a; });

  /* ---------------- the store ---------------- */
  var mem = null;
  function load() {
    if (mem) return mem;
    var d = null;
    try { d = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { d = null; }
    if (!d || d.v !== 1) d = { v: 1, owned: {}, equipped: {}, ach: {}, ts: null };
    d.owned = d.owned && typeof d.owned === "object" ? d.owned : {};
    d.equipped = d.equipped && typeof d.equipped === "object" ? d.equipped : {};
    d.ach = d.ach && typeof d.ach === "object" ? d.ach : {};
    return (mem = d);
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(load())); } catch (e) {} }
  var subs = [];
  function fire(what) { V.changes = (V.changes || 0) + 1; subs.slice().forEach(function (f) { try { f(what); } catch (e) {} }); apply(what); }
  function M() { var m = window.RIB_MONETIZE; return m && m.enabled ? m : null; }
  function mHas(k) { var m = M(); try { return !!(m && m.has(k)); } catch (e) { return false; } }
  function shopOn() { var m = M(); return !!(m && (!m.config || !m.config.features || m.config.features.cosmetics !== false)); }

  function owned(id) {
    syncPass(); var it = findItem(id); if (!it) return false;
    if (it.source === "free") return true;
    if (it.source === "earned" || it.source === "pass") return !!load().owned[id];
    if (it.source === "shop") return mHas("cos:" + id) || it.packs.some(function (p) { return mHas("cos:" + p); });
    if (it.source === "founder") return mHas("founder") || mHas("cos:" + id) || mHas("cos:founder");
    return false;
  }
  function grant(id, source, reward) {
    syncPass(); var it = findItem(id) || (reward ? passItem(Object.assign({}, reward, { id: id })) : null); if (!it) return false;
    if (it.source === "free") return true;
    if (it.source === "shop" || it.source === "founder") {
      var m = M(); if (!m) return false;
      try { m.grant("cos:" + id, { source: source || it.source }); } catch (e) { return false; }
      V.grants.push({ id: id, source: source || it.source }); fire({ grant: id }); return true;
    }
    var S = load(); if (S.owned[id]) return true;
    S.owned[id] = { source: source || it.source, at: Date.now() }; persist();
    V.grants.push({ id: id, source: source || it.source });
    if ((source || it.source) === "earned") toast("🎁 Unlocked: " + it.name + " (" + CATS[it.cat].name.toLowerCase() + ")");
    fire({ grant: id }); return true;
  }
  function grantPack(pid, source) {
    var p = PACKS.find(function (q) { return q.id === pid; }); if (!p) return false;
    var m = M(); if (m && p.id !== "founder") { try { m.grant("cos:" + pid, { source: source || "shop" }); } catch (e) {} }
    var ok = true; p.items.forEach(function (id) { ok = grant(id, source) && ok; }); return ok;
  }
  function equipped(slot) {
    if (slot == null) { var all = {}; SLOTS.forEach(function (s) { all[s] = equipped(s); }); return all; }
    syncPass();
    var id = load().equipped[slot]; if (id && !BY[id]) findItem(id);
    if (id && BY[id] && BY[id].cat === slot && owned(id)) return id;
    return CATS[slot] ? CATS[slot].def : null;
  }
  function equip(slot, id) {
    if (!CATS[slot]) return false;
    if (id == null) id = CATS[slot].def;
    var it = findItem(id); if (!it || it.cat !== slot || !owned(id)) return false;
    load().equipped[slot] = id; persist(); fire({ equip: slot, id: id }); return true;
  }
  function item(slot) { return BY[equipped(slot)] || null; }
  function onChange(cb) { if (typeof cb !== "function") return function () {}; subs.push(cb); return function () { var i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1); }; }
  function catalog() { syncPass(); return ITEMS.slice(); }
  function packs() { return PACKS.map(function (p) { return { id: p.id, name: p.name, price: p.price, productId: p.productId, founder: !!p.founder, items: p.items.slice() }; }); }
  function howTo(it) {
    if (it.source === "free") return "Free";
    if (it.source === "earned") { var a = ACH_BY[it.ach]; return "Earn it: " + (a ? a.desc : "an achievement"); }
    if (it.source === "pass") return (it.season ? "Career Pass " + it.season.toUpperCase() + " · " + (it.track === "premium" ? "premium " : "") : "Season Pass · ") + "tier " + (it.tier || 1);
    if (it.source === "founder") return "Founder Bundle";
    var p = PACKS.find(function (q) { return q.id === it.packs[0]; });
    return (p ? p.name : "Store") + (p && p.price ? " · " + p.price : "");
  }
  /* shop / founder items are not shown as purchasable with monetization OFF (owned ones still show) */
  function listed(it) { if (it.season && window.RIB_SEASONS && !owned(it.id)) { try { if (window.RIB_SEASONS.current().id !== it.season) return false; } catch (e) {} } return owned(it.id) || it.source === "free" || it.source === "earned" || it.source === "pass" || shopOn(); }

  function toast(msg) {
    try { var t = document.getElementById("toast"); if (!t) return; t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 2600); } catch (e) {}
  }

  /* ---------------- the account, read ---------------- */
  function gstate() { try { return (window.__getGridironState && window.__getGridironState()) || null; } catch (e) { return null; } }
  var MVP_RE = /MVP|Player of the Year/i;
  function tdsOf(line) { var n = 0; if (line) for (var k in line) if (/TD$/.test(k) && !isNaN(+line[k])) n += +line[k]; return n; }
  function account(st) {
    st = st || gstate() || {};
    var e = st.player || null, hof = Array.isArray(st.hof) ? st.hof : [];
    var A = { careers: st.careers || 0, pp: Math.round(st.pp || 0), honors: st.prestige || 0, titles: st.titlesWon || 0, rings: st.rings || 0,
      mvps: 0, awards: 0, hof: hof.length, uffReached: st.nflReached || 0, interstellar: 0, uffTitles: 0, interstellarTitles: 0,
      gen: 1, surname: "", bestScore: 0, bestTds: 0, byLevel: {} };
    var levels = []; try { levels = (window.__GRIDIRON_AUDIT__ && window.__GRIDIRON_AUDIT__.LEVELS) || []; } catch (x) {}
    var rows = function (log, isObj) {
      var tds = 0;
      (log || []).forEach(function (r) {
        if (!r) return;
        if (r.champion) { var ln = r.levelName || (levels[r.level] && levels[r.level].name) || "Level " + r.level; A.byLevel[ln] = (A.byLevel[ln] || 0) + 1;
          if (r.level === 7) A.uffTitles++; if (r.level >= 8) A.interstellarTitles++; }
        (r.awards || []).forEach(function (a) { var n = isObj ? a && a.name : a; A.awards++; if (MVP_RE.test(String(n || ""))) A.mvps++; });
        tds += tdsOf(isObj ? r.statLine : r.line);
      });
      return tds;
    };
    hof.forEach(function (h) {
      if (!h) return;
      A.bestScore = Math.max(A.bestScore, h.goat || 0);
      if ((h.level || 0) >= 8) A.interstellar++;
      if (h.box && h.box.log) A.bestTds = Math.max(A.bestTds, rows(h.box.log, false));
    });
    if (e) {
      A.bestTds = Math.max(A.bestTds, rows(e.seasonLogV77, true));
      if ((e.level || 0) >= 7) A.uffReached = Math.max(A.uffReached, 1);
      if ((e.level || 0) >= 8) A.interstellar = Math.max(A.interstellar, 1);
      A.careerScore = Math.round((e.peakOvr || 0) * 2 + (e.titles || 0) * 15 + (e.level || 0) * 12 + (e.totalSeasons || 0) * 1.5 + (e.nflRings || 0) * 25);
      A.bestScore = Math.max(A.bestScore, A.careerScore);
    }
    var L = st.lineageV136; if (L && L.gen) { A.gen = L.gen; A.surname = L.surname || ""; }
    try { var F = window.__LINEAGE_V136 && window.__LINEAGE_V136.family && window.__LINEAGE_V136.family(); if (F && F.gen) { A.gen = F.gen; A.surname = F.surname || A.surname; } } catch (x) {}
    return A;
  }
  /* the earned unlocks — checked at boot, on every save and when the profile opens */
  function checkEarned(st) {
    var A = account(st), S = load(), got = [];
    ACH.forEach(function (a) {
      var hit = false; try { hit = !!a.test(A); } catch (e) {}
      if (!hit) return;
      if (!S.ach[a.id]) { S.ach[a.id] = Date.now(); persist(); }
      ITEMS.forEach(function (it) { if (it.source === "earned" && it.ach === a.id && !S.owned[it.id]) { grant(it.id, "earned"); got.push(it.id); } });
    });
    V.lastEarned = got; return got;
  }

  /* ---------------- the kit on the field (uniform + helmet) ---------------- */
  function classify(r, g, b) {
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2;
    if (L < 38) return [0, L];
    var sat = mx ? (mx - mn) / mx : 0, hue = 0;
    if (mx !== mn) { if (mx === r) hue = (60 * ((g - b) / (mx - mn)) + 360) % 360; else if (mx === g) hue = 60 * ((b - r) / (mx - mn)) + 120; else hue = 60 * ((r - g) / (mx - mn)) + 240; }
    if (hue >= 190 && hue <= 265 && sat > 0.15) return [1, L];
    if (hue >= 33 && hue <= 62 && sat > 0.3 && L > 60) return [2, L];
    return [0, L];
  }
  function shellClass(r, g, b) {
    var k = classify(r, g, b); if (k[0]) return [k[0], k[1] / (k[0] === 1 ? 95 : 165)];
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2, sat = mx ? (mx - mn) / mx : 0;
    if (sat < 0.2 && L > 70) return [3, L / 200];
    return [0, 0];
  }
  function pix(canvasOrImg, w, h) {
    if (!canvasOrImg) return null;
    try {
      if (canvasOrImg.getContext) return canvasOrImg.getContext("2d").getImageData(0, 0, w, h).data;
      var c = document.createElement("canvas"); c.width = w; c.height = h; var x = c.getContext("2d"); x.drawImage(canvasOrImg, 0, 0); return x.getImageData(0, 0, w, h).data;
    } catch (e) { return null; }
  }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  /* one texture's decoration: the jersey's pattern, the pant stripe, the helmet's shell / stripe / decal / finish.
   * `band` is v104's measured collar and waist for the pose (null on a preview: proportions stand in). */
  function kitDeco(U, H) {
    var seed = 0x1234;
    return function (cv, srcName, band, src) {
      try {
        var W = cv.width, Hh = cv.height, c = cv.getContext("2d"), img = c.getImageData(0, 0, W, Hh), d = img.data;
        var s = pix(src, W, Hh) || d;
        var head = -1, bot = -1;
        for (var y = 0; y < Hh; y++) for (var x = 0; x < W; x++) if (s[(y * W + x) * 4 + 3] >= 40) { if (head < 0) head = y; bot = y; }
        if (head < 0) return cv;
        var ink = Math.max(8, bot - head);
        var top = band && band.top != null ? band.top : head + Math.round(ink * 0.3);
        var waist = band && band.waist != null ? band.waist : head + Math.round(ink * 0.62);
        var hRows = {};
        if (H) for (var y2 = head; y2 < top; y2++) { var a0 = 1e9, a1 = -1; for (var x2 = 0; x2 < W; x2++) { var i2 = (y2 * W + x2) * 4; if (s[i2 + 3] < 20) continue; if (shellClass(s[i2], s[i2 + 1], s[i2 + 2])[0]) { if (x2 < a0) a0 = x2; if (x2 > a1) a1 = x2; } } if (a1 >= 0) hRows[y2] = [a0, a1]; }
        var HS = H ? rgb(H.s) : null, HST = H && H.st ? rgb(H.st) : null, HD = H && H.d ? rgb(H.d) : null;
        var UT = U ? rgb(U.t || U.j) : null, UJ = U ? rgb(U.j) : null, UPS = U && U.ps ? rgb(U.ps) : null;
        var hMid = top - head > 2 ? Math.round((head + top) / 2) : head + 1, rr = prng(seed);
        for (var yy = 0; yy < Hh; yy++) {
          var pl = 1e9, pr = -1;
          if (UPS && yy > waist) for (var xq = 0; xq < W; xq++) { var iq = (yy * W + xq) * 4; if (s[iq + 3] >= 20 && classify(s[iq], s[iq + 1], s[iq + 2])[0] === 2) { if (xq < pl) pl = xq; if (xq > pr) pr = xq; } }
          for (var xx = 0; xx < W; xx++) {
            var i = (yy * W + xx) * 4; if (s[i + 3] < 20) continue;
            var inHelm = yy < top && H, k = inHelm ? shellClass(s[i], s[i + 1], s[i + 2]) : classify(s[i], s[i + 1], s[i + 2]), cls = k[0]; if (!cls) continue;
            var sc = Math.min(1.75, Math.max(0.25, inHelm ? k[1] : k[1] / (cls === 1 ? 95 : 165))), out = null;
            if (yy < top && H) {
              var f = H.f || "gloss", s2 = sc;
              if (f === "matte") s2 = 1 + (sc - 1) * 0.5;
              else if (f === "chrome") s2 = Math.max(0.3, 1 + (sc - 1) * 1.9);
              out = HS.map(function (v) { return v * s2; });
              if (f === "gloss" && yy <= head + 1) out = mix(out, [255, 255, 255], 0.28);
              if (f === "chrome" && (yy <= head + 1 || ((xx + yy) % 5 === 0))) out = mix(out, [255, 255, 255], 0.42);
              if (f === "metal" && ((xx * 7 + yy * 13) % 11 === 0)) out = mix(out, [255, 255, 255], 0.5);
              var hr = hRows[yy];
              if (HST && hr) { var cx = (hr[0] + hr[1]) / 2, wide = hr[1] - hr[0] > 11 ? 1.1 : 0.6; if (Math.abs(xx - cx) <= wide) out = HST.map(function (v) { return v * Math.min(1.2, Math.max(0.6, s2)); }); }
              if (HD && hr && Math.abs(yy - hMid) <= (H.dk === "star" ? 1 : 0) && xx >= hr[0] + 1 && xx <= hr[0] + (H.dk === "star" ? 3 : 2)) out = HD.slice();
            } else if (U && yy <= waist && cls === 1) {
              var t = (yy - top) / Math.max(1, waist - top), pat = U.pat || "solid";
              if (pat === "hoops" && (yy - top) % 4 === 1) out = UT;
              else if (pat === "pinstripe" && xx % 3 === 0) out = mix(UJ, UT, 0.55);
              else if (pat === "split" && xx >= W / 2) out = UT;
              else if (pat === "fade") out = mix(UJ, UT, Math.max(0, Math.min(1, t * 1.15)));
              else if (pat === "yoke" && yy - top <= 2) out = UT;
              else if (pat === "chest" && Math.abs(t - 0.45) < 0.14) out = UT;
              else if (pat === "sleeves" && (yy - top === 3 || yy - top === 4)) out = UT;
              else if (pat === "camo") { var h = ((xx >> 1) * 73856093 ^ (yy >> 1) * 19349663) >>> 0, q = (h % 7); out = q < 2 ? UT : q < 3 ? mix(UJ, [20, 20, 20], 0.35) : null; }
              if (out) out = out.map(function (v) { return v * sc; });
            } else if (UPS && yy > waist && cls === 2 && pr >= 0 && (xx === pl + 1 || xx === pr - 1)) {
              out = UPS.map(function (v) { return v * sc; });
            }
            if (out) { d[i] = Math.min(255, out[0]); d[i + 1] = Math.min(255, out[1]); d[i + 2] = Math.min(255, out[2]); }
          }
        }
        c.putImageData(img, 0, 0);
        V.decoRuns = (V.decoRuns || 0) + 1;
      } catch (e) { V.decoErr = String(e && e.message || e); }
      return cv;
    };
  }
  var decoCache = { key: "", fn: null };
  /* src/05 `ribSyncYouKitV96` asks this for the you-player's kit. `teamCols` is his team's palette, `oppCols`
   * the opponent's: a uniform whose jersey would read as the OTHER side's is not worn that game. */
  function fieldKit(teamCols, oppCols) {
    var U = resolveU((item("uniform") || {}).k || null, teamCols), H = (item("helmet") || {}).h || null;
    if (!U && !H) { V.kit = null; return null; }
    var clash = false;
    if (U && oppCols && hexOk(oppCols[0]) && cdist(U.j, oppCols[0]) < TUv("cosKitClashV151B", 90)) { clash = true; U = null; }
    if (!U && !H) { V.kit = { clash: clash }; return null; }
    var p1 = U ? U.j : teamCols[0], p2 = U ? U.p : teamCols[1];
    var stamp = "u:" + (U ? equipped("uniform") + ":" + U.j + U.p : "-") + "|h:" + (H ? equipped("helmet") : "-");
    if (decoCache.key !== stamp) decoCache = { key: stamp, fn: kitDeco(U, H) };
    V.kit = { uniform: U ? equipped("uniform") : null, helmet: H ? equipped("helmet") : null, p1: p1, p2: p2, clash: clash, stamp: stamp };
    return { p1: p1, p2: p2, deco: decoCache.fn, stamp: stamp };
  }
  /* the menu feed's team.colors: [jersey, pants, helmet] when he wears something, else exactly what it was */
  function menuColors(c) {
    try {
      var U = resolveU((item("uniform") || {}).k || null, c), H = (item("helmet") || {}).h || null;
      if (!U && !H) return c;
      var base = Array.isArray(c) && c.length >= 2 ? c : ["#1a2a44", "#e8c86a"];
      return [U ? U.j : base[0], U ? U.p : base[1], H ? H.s : U ? U.p : base[1]];
    } catch (e) { return c; }
  }
  function kitData() {
    var U = resolveU((item("uniform") || {}).k || null, null), H = (item("helmet") || {}).h || null;
    var tc = window.__GRIDIRON_TEAM_CUSTOM__ || {}, col = Array.isArray(tc.col) ? tc.col : ["#1f4fd0", "#e8c86a"];
    return { j: U ? U.j : col[0], p: U ? U.p : col[1], t: U ? U.t || null : null, pat: U ? U.pat || "solid" : "solid", ps: U ? U.ps || null : null,
      hs: H ? H.s : null, hst: H ? H.st || null : null, hf: H ? H.f || null : null, hd: H ? H.d || null : null, hdk: H ? H.dk || null : null };
  }
  function kitFromData(k) {
    k = k || {};
    var U = { j: hexOk(k.j) || "#1f4fd0", p: hexOk(k.p) || "#e8c86a", t: hexOk(k.t) || null, pat: String(k.pat || "solid").replace(/[^a-z]/g, ""), ps: hexOk(k.ps) };
    var H = hexOk(k.hs) ? { s: k.hs, st: hexOk(k.hst), f: String(k.hf || "gloss").replace(/[^a-z]/g, ""), d: hexOk(k.hd), dk: String(k.hdk || "").replace(/[^a-z]/g, "") } : null;
    return { U: U, H: H };
  }

  /* ---------------- the touchdown ---------------- */
  function celebrate(scene, x, y, cm) {
    var it = item("celebration"), C = it && it.c; if (!C || !scene || !scene.add) return false;
    var reduced = false; try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    var cols = C.col.map(function (h) { if (h === "team") { var t = (window.__GRIDIRON_TEAM_CUSTOM__ || {}).col || ["#f0bb45", "#1f4fd0"]; return t[0]; } return h; });
    var cn = function (i) { return parseInt(String(cols[i % cols.length]).slice(1), 16); };
    var track = function (o) { try { return scene.trackFx ? scene.trackFx(o) : o; } catch (e) { return o; } };
    var drop = function (o) { try { scene.dropFx ? scene.dropFx(o) : o.destroy(); } catch (e) {} };
    var tw = function (o, cfg) { cfg.targets = o; cfg.onComplete = function () { drop(o); }; try { scene.tweens.add(cfg); } catch (e) { drop(o); } };
    var D = 20.5, n = reduced ? 0.35 : 1, made = 0, R = function (a, b) { return a + (b - a) * rnd(); };
    var dot = function (px, py, r, col, a) { var o = track(scene.add.circle(px, py, r, col, a == null ? 1 : a).setDepth(D)); made++; return o; };
    try {
      if (C.kind === "fireworks") {
        for (var b = 0; b < 3; b++) (function (b) { var bx = x + R(-90, 90), by = y - R(60, 150);
          scene.time.delayedCall(b * 260, function () { for (var i = 0; i < 18 * n; i++) { var a = i / 18 * 6.283, o = dot(bx, by, 2.4, cn(i + b)); tw(o, { x: bx + Math.cos(a) * R(50, 80), y: by + Math.sin(a) * R(50, 80) + 18, alpha: 0, duration: R(650, 900) }); } }); })(b);
      } else if (C.kind === "rain") {
        for (var i = 0; i < 46 * n; i++) { var o = track(scene.add.rectangle(x + R(-150, 150), y - R(160, 260), 3, 6, cn(i)).setDepth(D)); made++; tw(o, { y: o.y + R(220, 320), angle: R(-200, 200), alpha: 0.1, duration: R(900, 1500), delay: R(0, 500) }); }
      } else if (C.kind === "bolt") {
        var g = track(scene.add.graphics().setDepth(D)); made++;
        var pts = [], yy = y - 280, xx = x + R(-20, 20); while (yy < y - 6) { pts.push({ x: xx, y: yy }); yy += R(24, 40); xx += R(-26, 26); } pts.push({ x: x, y: y - 6 });
        g.lineStyle(5, cn(2), 0.5); g.strokePoints(pts, false); g.lineStyle(2, cn(1), 1); g.strokePoints(pts, false);
        tw(g, { alpha: 0, duration: 700, yoyo: false, delay: 120 });
        try { if (!reduced) scene.cameras.main.flash(140, 200, 230, 255); } catch (e) {}
        for (var j = 0; j < 12 * n; j++) { var s2 = dot(x, y - 6, 2, cn(j)); tw(s2, { x: x + R(-60, 60), y: y + R(-40, 10), alpha: 0, duration: R(350, 600) }); }
      } else if (C.kind === "flame") {
        for (var f = 0; f < 30 * n; f++) { var o2 = dot(x + R(-26, 26), y + R(-6, 6), R(3, 6), cn(f), 0.9); tw(o2, { y: o2.y - R(60, 140), scale: 0.2, alpha: 0, duration: R(600, 1100), delay: R(0, 400) }); }
      } else if (C.kind === "stars") {
        for (var q = 0; q < 16 * n; q++) { var t = track(scene.add.text(x + R(-40, 40), y - R(10, 40), "✦", { fontFamily: "Oswald, sans-serif", fontSize: Math.round(R(12, 22)) + "px", color: cols[q % cols.length] }).setOrigin(0.5).setDepth(D)); made++; tw(t, { y: t.y - R(60, 130), angle: R(-180, 180), alpha: 0, duration: R(900, 1400), delay: R(0, 300) }); }
      } else if (C.kind === "smoke") {
        for (var m = 0; m < 12 * n; m++) { var o3 = dot(x + R(-30, 30), y + R(-10, 10), R(8, 14), cn(m), 0.55); tw(o3, { scale: R(2.2, 3.4), alpha: 0, x: o3.x + R(-60, 60), y: o3.y - R(20, 70), duration: R(1100, 1700) }); }
      } else if (C.kind === "crown") {
        var cr = track(scene.add.text(x, y - 30, "👑", { fontSize: "30px" }).setOrigin(0.5).setDepth(D + 0.1)); made++; tw(cr, { y: y - 90, alpha: 0, duration: 1600, ease: "Cubic.easeOut" });
        var ring = track(scene.add.circle(x, y - 10, 10).setStrokeStyle(3, cn(0), 1).setDepth(D)); made++; tw(ring, { scale: 7, alpha: 0, duration: 900 });
      } else if (C.kind === "spot") {
        var sp = track(scene.add.ellipse(x, y, 90, 34, cn(0), 0.35).setDepth(D - 1)); made++; tw(sp, { alpha: 0, scaleX: 1.6, scaleY: 1.6, duration: 1400 });
      }
      if (C.say) {
        var cl = track(scene.add.text(x, y - 64, C.say, { fontFamily: "Oswald, Impact, sans-serif", fontSize: "20px", fontStyle: "bold", color: cols[0], stroke: "#0b0f16", strokeThickness: 5 }).setOrigin(0.5).setDepth(D + 0.2).setScale(0.4)); made++;
        try { scene.tweens.add({ targets: cl, scale: 1, duration: 220, ease: "Back.easeOut" }); } catch (e) {}
        tw(cl, { alpha: 0, y: y - 84, delay: 1300, duration: 500 });
      }
    } catch (e) { V.celebrateErr = String(e && e.message || e); }
    V.celebrations.push({ id: it.id, kind: C.kind, say: C.say || "", made: made, t: Date.now() });
    return true;
  }

  /* ---------------- the stadium ---------------- */
  function stadiumTheme() {
    var it = item("stadium"), T = it && it.st;
    if (!T || window.__homeGameV93 === false) return null;
    return { id: it.id, band: parseInt(T.band.slice(1), 16), lip: parseInt(T.lip.slice(1), 16), crowd: parseInt(T.crowd.slice(1), 16), ez: T.ez, hex: T };
  }
  function refreshField() {
    try {
      var sc = window.__gridironScene; if (!sc) return false;
      if (window.__COS_FIELD_V151B) window.__COS_FIELD_V151B.resync(sc);
      if (sc.buildCrowd) sc.buildCrowd();
      return true;
    } catch (e) { return false; }
  }

  /* ---------------- the vault ---------------- */
  function vaultTheme() { var it = item("vault"); return it && it.vt ? Object.assign({ id: it.id }, it.vt) : null; }
  var vtCache = {};
  function vaultTint(im, name) {
    var T = vaultTheme(); if (!T || !im) return null;
    var key = T.id + ":" + name; if (vtCache[key]) return vtCache[key];
    try {
      var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height; if (!w || !h) return null;
      var c = document.createElement("canvas"); c.width = w; c.height = h; var x = c.getContext("2d");
      x.drawImage(im, 0, 0);
      x.globalCompositeOperation = "color"; x.globalAlpha = T.coinMix; x.fillStyle = T.coin; x.fillRect(0, 0, w, h);
      x.globalAlpha = 1; x.globalCompositeOperation = "destination-in"; x.drawImage(im, 0, 0);
      vtCache[key] = c; V.vault = { id: T.id, tinted: Object.keys(vtCache).length };
      return c;
    } catch (e) { return null; }
  }
  /* the motes: one CSS layer over the vault, in the theme's colour — added on open, taken down on the classic hoard */
  function vaultDress(root) {
    try {
      if (!root) return;
      var T = vaultTheme(), el = root.querySelector(":scope > .rv-cos-v151b");
      if (!T) { if (el) el.remove(); root.removeAttribute("data-cos-vault"); return; }
      root.setAttribute("data-cos-vault", T.id);
      if (!el) { el = document.createElement("div"); el.className = "rv-cos-v151b"; el.setAttribute("aria-hidden", "true"); root.appendChild(el); }
      el.style.setProperty("--mote", T.mote);
      if (!el.children.length) { var r = prng(42), h = ""; for (var i = 0; i < 22; i++) h += '<i style="left:' + (r() * 100).toFixed(1) + "%;animation-delay:-" + (r() * 9).toFixed(2) + "s;animation-duration:" + (7 + r() * 6).toFixed(2) + "s;--s:" + (0.5 + r()).toFixed(2) + '"></i>'; el.innerHTML = h; }
      V.vault = Object.assign(V.vault || {}, { id: T.id, dressed: true });
    } catch (e) {}
  }

  /* ---------------- previews ---------------- */
  function spriteCanvas(k, px) {
    var C = window.__CHASE_V94; if (!C || !C.cell) return null;
    var dyed = C.cell("idle_dn", [k.U.j, k.U.p]), raw = C.cell("idle_dn", "raw"); if (!dyed) return null;
    var c = document.createElement("canvas"); c.width = 48; c.height = 48; c.getContext("2d").drawImage(dyed, 0, 0);
    kitDeco(k.U && k.U.pat ? k.U : null, k.H)(c, "idle_dn", null, raw);
    var out = document.createElement("canvas"); out.width = px; out.height = px; var x = out.getContext("2d"); x.imageSmoothingEnabled = false;
    x.drawImage(c, 4, 0, 40, 44, 0, 0, px, px * 44 / 40); return out;
  }
  function previewInto(el, it) {
    if (!el) return null;
    var cat = it.cat, html = "";
    el.classList.add("cos-pv-v151b", "cat-" + cat);
    if (cat === "uniform" || cat === "helmet") {
      var tc = (window.__GRIDIRON_TEAM_CUSTOM__ || {}).col || ["#1f4fd0", "#e8c86a"];
      var U = resolveU(it.k || (cat === "helmet" ? (item("uniform") || {}).k : null), tc) || { j: tc[0], p: tc[1], pat: "solid" };
      var H = it.h || (cat === "uniform" ? (item("helmet") || {}).h : null);
      var cv = spriteCanvas({ U: U, H: H }, 64);
      el.innerHTML = "";
      if (cv) { el.appendChild(cv); return el; }
      el.innerHTML = '<i class="cos-sw-v151b" style="background:' + (H ? H.s : U.p) + '"></i><i class="cos-sw-v151b big" style="background:' + U.j + '"></i>';
      return el;
    }
    if (cat === "frame") html = '<div class="cos-mini-v151b pcard-v151b fr-' + it.css + '"><b></b><i></i></div>';
    else if (cat === "celebration") { var cc = it.c ? it.c.col.map(function (h) { return h === "team" ? ((window.__GRIDIRON_TEAM_CUSTOM__ || {}).col || ["#f0bb45"])[0] : h; }) : ["#ff5a5a", "#ffd76f", "#6fd3ff", "#7cff9b"];
      html = '<div class="cos-cel-v151b k-' + (it.c ? it.c.kind : "confetti") + '">' + [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { return '<i style="--c:' + cc[i % cc.length] + ";--i:" + i + '"></i>'; }).join("") + (it.c && it.c.say ? "<b>" + escHtml(it.c.say) + "</b>" : "") + "</div>"; }
    else if (cat === "stadium") { var T = it.st || { band: "#1a4694", lip: "#6f9be6", crowd: "#9aa3b2" };
      html = '<div class="cos-std-v151b"><i class="sky"></i><i class="crowd" style="--cr:' + T.crowd + '"></i><i class="band" style="background:' + T.band + ";border-top-color:" + T.lip + '"></i><i class="turf"></i></div>'; }
    else if (cat === "vault") { var VT = it.vt || { coin: "#e6b53a", room: "#141a24", coinMix: 0 };
      html = '<div class="cos-vlt-v151b" style="--room:' + VT.room + ";--coin:" + VT.coin + ";--mix:" + (VT.coinMix || 0) + '"><i></i><i></i><i></i></div>'; }
    else if (cat === "banner") html = '<div class="cos-ban-v151b" style="background:' + it.bg + (it.edge ? ";border-bottom:2px solid " + it.edge : "") + '"></div>';
    else if (cat === "shelf") html = '<div class="cos-shelf-v151b sh-' + it.css + '"><span>🏆</span><span>🏅</span><span>💍</span></div>';
    else if (cat === "recap") html = '<div class="cos-rcp-v151b rc-' + (it.css || "none") + '"><b>A</b><i></i><i></i></div>';
    else if (cat === "title") html = '<div class="cos-flair-v151b"><small>' + escHtml(it.text || "—") + "</small></div>";
    else if (cat === "badge" || cat === "icon") html = '<div class="cos-flair-v151b big"' + (it.col ? ' style="box-shadow:0 0 0 2px ' + it.col + ' inset"' : "") + ">" + escHtml(it.glyph || "·") + "</div>";
    else if (cat === "nameplate") html = '<div class="cos-flair-v151b plate" style="background:' + (it.plate || "#1a2230") + '"><small>NAME</small></div>';
    el.innerHTML = html; return el;
  }

  /* ---------------- the character on the card ---------------- */
  var SENT = "#00ff00";
  function drawCharacter(cv, kd, age) {
    var G = window.__GROW_V132; if (!cv || !G || !G.draw) return null;
    var k = kitFromData(kd), res = null;
    try {
      res = G.draw(cv, age || 22, [k.U.j, k.U.p]);
      if (!res) return null;
      var needH = !!k.H, needP = k.U.pat && k.U.pat !== "solid" && k.U.t;
      if (!needH && !needP && !k.U.ps) return res;
      var W = cv.width, H = cv.height, x = cv.getContext("2d"), A = x.getImageData(0, 0, W, H);
      var tmp = document.createElement("canvas");
      var diff = function (kit) { G.draw(tmp, age || 22, kit); var B = tmp.getContext("2d").getImageData(0, 0, W, H).data; return B; };
      var a = A.data, top = -1, bot = -1;
      for (var y = 0; y < H; y++) for (var xx = 0; xx < W; xx++) if (a[(y * W + xx) * 4 + 3] > 40) { if (top < 0) top = y; bot = y; }
      var headCut = top + Math.round((bot - top) * 0.36);
      if (needH) {
        var B = diff([k.U.j, k.H.s]), cols = [];
        for (var y2 = top; y2 < headCut; y2++) { var mn = 1e9, mx = -1; for (var x2 = 0; x2 < W; x2++) { var i = (y2 * W + x2) * 4; if (Math.abs(B[i] - a[i]) + Math.abs(B[i + 1] - a[i + 1]) + Math.abs(B[i + 2] - a[i + 2]) > 18) { a[i] = B[i]; a[i + 1] = B[i + 1]; a[i + 2] = B[i + 2]; if (x2 < mn) mn = x2; if (x2 > mx) mx = x2; } } cols.push([y2, mn, mx]); }
        if (k.H.st) { var st = rgb(k.H.st); cols.forEach(function (r) { if (r[2] < 0) return; var c = (r[1] + r[2]) / 2, w = Math.max(1.5, (r[2] - r[1]) * 0.07); for (var x3 = Math.floor(c - w); x3 <= Math.ceil(c + w); x3++) { var i3 = (r[0] * W + x3) * 4; if (B[i3 + 3] > 40 && Math.abs(B[i3] - A.data[i3]) >= 0) { var l = (B[i3] + B[i3 + 1] + B[i3 + 2]) / 3 / 160; a[i3] = Math.min(255, st[0] * Math.max(0.55, l)); a[i3 + 1] = Math.min(255, st[1] * Math.max(0.55, l)); a[i3 + 2] = Math.min(255, st[2] * Math.max(0.55, l)); } } }); }
        if (k.H.f === "gloss" || k.H.f === "chrome") for (var y4 = top; y4 < top + Math.max(2, (headCut - top) * 0.18); y4++) for (var x4 = 0; x4 < W; x4++) { var i4 = (y4 * W + x4) * 4; if (a[i4 + 3] > 40) { a[i4] += (255 - a[i4]) * 0.3; a[i4 + 1] += (255 - a[i4 + 1]) * 0.3; a[i4 + 2] += (255 - a[i4 + 2]) * 0.3; } }
      }
      if (needP) {
        var P = diff([SENT, k.U.p]), T = rgb(k.U.t), J = rgb(k.U.j), pb = -1, pt = 1e9;
        for (var y5 = headCut; y5 < H; y5++) for (var x5 = 0; x5 < W; x5++) { var i5 = (y5 * W + x5) * 4; if (P[i5 + 3] > 40 && P[i5 + 1] > P[i5] + 40 && P[i5 + 1] > P[i5 + 2] + 40) { if (y5 < pt) pt = y5; if (y5 > pb) pb = y5; } }
        for (var y6 = pt; y6 <= pb; y6++) for (var x6 = 0; x6 < W; x6++) {
          var i6 = (y6 * W + x6) * 4; if (!(P[i6 + 3] > 40 && P[i6 + 1] > P[i6] + 40 && P[i6 + 1] > P[i6 + 2] + 40)) continue;
          var l6 = P[i6 + 1] / 255, t6 = (y6 - pt) / Math.max(1, pb - pt), o = null, sw = Math.max(2, Math.round(W / 60));
          var pat = k.U.pat;
          if (pat === "hoops" && Math.floor((y6 - pt) / (sw * 3)) % 2 === 1) o = T;
          else if (pat === "pinstripe" && Math.floor(x6 / sw) % 3 === 0) o = mix(J, T, 0.55);
          else if (pat === "split" && x6 >= W / 2) o = T;
          else if (pat === "fade") o = mix(J, T, Math.min(1, t6 * 1.15));
          else if (pat === "yoke" && t6 < 0.18) o = T;
          else if (pat === "chest" && Math.abs(t6 - 0.45) < 0.12) o = T;
          else if (pat === "sleeves" && Math.abs(t6 - 0.26) < 0.05) o = T;
          else if (pat === "camo") { var hh = ((Math.floor(x6 / (sw * 2))) * 73856093 ^ (Math.floor(y6 / (sw * 2))) * 19349663) >>> 0; o = hh % 7 < 2 ? T : null; }
          if (o) { a[i6] = Math.min(255, o[0] * Math.max(0.35, l6 * 1.05)); a[i6 + 1] = Math.min(255, o[1] * Math.max(0.35, l6 * 1.05)); a[i6 + 2] = Math.min(255, o[2] * Math.max(0.35, l6 * 1.05)); }
        }
      }
      x.putImageData(A, 0, 0);
    } catch (e) { V.charErr = String(e && e.message || e); }
    return res;
  }

  /* ---------------- the profile ---------------- */
  function levelName(i) { try { var L = window.__GRIDIRON_AUDIT__.LEVELS; return (L[i] && L[i].name) || ""; } catch (e) { return ""; } }
  function profile(st) {
    st = st || gstate() || {};
    var e = st.player || null, A = account(st), tc = window.__GRIDIRON_TEAM_CUSTOM__ || {}, ts = teamStyle.info();
    var feed = null; try { feed = window.__RIB_MENU_DATA_V89 && window.__RIB_MENU_DATA_V89(); } catch (x) {}
    var ovr = feed && feed.player ? feed.player.ovr : null;
    return {
      v: 1,
      name: String((e && e.name) || (A.surname ? "The " + A.surname + " line" : "Rookie")).slice(0, 40),
      pos: e ? String(e.pos || "") : "", level: e ? e.level || 0 : null, levelName: e ? levelName(e.level || 0) : "", age: e ? e.age || null : null, ovr: ovr,
      team: { school: String(tc.schoolName || "").slice(0, 24), name: String(tc.teamName || "").slice(0, 18), colors: Array.isArray(tc.col) ? tc.col.slice(0, 2).filter(hexOk) : [], logo: tc.logo != null ? tc.logo | 0 : null },
      club: e && e.clubV146B ? String(e.clubV146B.name || e.clubV146B || "").slice(0, 40) : "",
      careers: A.careers, bank: { pp: A.pp, honors: A.honors },
      titles: A.titles, rings: A.rings, mvps: A.mvps, awards: A.awards, hof: A.hof, uffTitles: A.uffTitles, interstellarTitles: A.interstellarTitles,
      titlesByLevel: A.byLevel, gen: A.gen, surname: String(A.surname || "").slice(0, 24), bestScore: A.bestScore, careerScore: A.careerScore || 0,
      teamStyle: { unlocked: ts.unlocked, total: ts.total, all: ts.all },
      achievements: Object.keys(load().ach),
      cosmetics: { title: equipped("title"), badge: equipped("badge"), nameplate: equipped("nameplate"), icon: equipped("icon"), frame: equipped("frame"), banner: equipped("banner"), shelf: equipped("shelf"), uniform: equipped("uniform"), helmet: equipped("helmet"), recap: equipped("recap"), kit: kitData() }
    };
  }
  function num(n) { n = Number(n) || 0; return n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M" : n >= 1e4 ? Math.round(n / 1e3) + "K" : n.toLocaleString("en-US"); }
  /* the player card — for HIM (the profile screen) and for anyone else (a leaderboard row, from stored data).
   * Every string is escaped; every id is looked up in the catalogue, never trusted as markup. */
  function renderCard(data, target) {
    var d = data || profile(), cz = d.cosmetics || {}, opts = target && !target.nodeType ? target : {}, el = target && target.nodeType ? target : opts.el || null;
    var fr = BY[cz.frame] && BY[cz.frame].cat === "frame" ? BY[cz.frame] : BY.frame_basic;
    var bn = BY[cz.banner] && BY[cz.banner].cat === "banner" ? BY[cz.banner] : BY.ban_charcoal;
    var sh = BY[cz.shelf] && BY[cz.shelf].cat === "shelf" ? BY[cz.shelf] : BY.shelf_oak;
    var pick = function (id, cat) { var it = id ? findItem(id) : null; return it && it.cat === cat ? it : null; };
    var fr2 = pick(cz.frame, "frame"), bn2 = pick(cz.banner, "banner"); if (fr2) fr = fr2; if (bn2) bn = bn2;   // a Career Pass frame / banner
    var ttl = pick(cz.title, "title"), bdg = pick(cz.badge, "badge"), npl = pick(cz.nameplate, "nameplate"), ico = pick(cz.icon, "icon");
    var t = d.team || {}, cols = (t.colors || []).filter(hexOk), compact = !!opts.compact;
    var logo = ""; try { if (t.logo != null && window.TEAM_LOGOS_V44) logo = '<i class="pc-logo-v151b emblem-v44" style="' + escHtml(window.TEAM_LOGOS_V44.cssFull(t.logo | 0)) + '"></i>'; } catch (x) {}
    var trophies = [["🏆", d.titles, "TITLES"], ["💍", d.rings, "RINGS"], ["⭐", d.mvps, "MVPS"], ["🏛️", d.hof, "HALL"]];
    var meta = [d.pos, d.levelName, d.age ? "AGE " + (d.age | 0) : ""].filter(Boolean).map(escHtml).join(" · ");
    var team = [t.school, t.name].filter(Boolean).join(" ");
    var html = '<div class="pcard-v151b fr-' + escHtml(fr.css) + (compact ? " compact" : "") + '" data-frame="' + escHtml(fr.id) + '">' +
      '<div class="pc-ban-v151b" style="background:' + bn.bg + (bn.edge ? ";border-bottom:2px solid " + bn.edge : "") + '" data-banner="' + escHtml(bn.id) + '">' +
      (ico && ico.glyph ? '<span class="pc-ico-v151b" style="box-shadow:0 0 0 2px ' + (ico.col || "#f0bb45") + ' inset" data-icon="' + escHtml(ico.id) + '">' + escHtml(ico.glyph) + "</span>" : "") +
      (d.gen > 1 ? '<span class="pc-gen-v151b' + (ico && ico.glyph ? " shift" : "") + '">GEN ' + (d.gen | 0) + "</span>" : "") +
      (bdg && bdg.glyph ? '<span class="pc-bdg-v151b" data-badge="' + escHtml(bdg.id) + '">' + escHtml(bdg.glyph) + "</span>" : "") + (d.ovr != null ? '<span class="pc-ovr-v151b"><b>' + (d.ovr | 0) + "</b>OVR</span>" : "") + "</div>" +
      '<div class="pc-body-v151b"><div class="pc-fig-v151b"><canvas class="pc-cv-v151b" width="128" height="160"></canvas></div>' +
      '<div class="pc-id-v151b"><div class="pc-name-v151b"' + (npl && npl.plate ? ' style="background:' + npl.plate + ';padding:1px 6px;border-radius:5px" data-plate="' + escHtml(npl.id) + '"' : "") + ">" + escHtml(String(d.name || "").toUpperCase()) + "</div>" +
      (ttl && ttl.text ? '<div class="pc-title-v151b" data-title="' + escHtml(ttl.id) + '">' + escHtml(ttl.text) + "</div>" : "") +
      '<div class="pc-meta-v151b">' + meta + "</div>" +
      (team || cols.length ? '<div class="pc-team-v151b">' + logo + cols.map(function (c) { return '<i class="pc-sw-v151b" style="background:' + c + '"></i>'; }).join("") + "<span>" + escHtml(team.toUpperCase()) + "</span></div>" : "") +
      (d.club ? '<div class="pc-club-v151b">' + escHtml(d.club) + "</div>" : "") + "</div></div>" +
      '<div class="pc-shelf-v151b sh-' + escHtml(sh.css) + '" data-shelf="' + escHtml(sh.id) + '">' + trophies.map(function (q) { return "<span><em>" + q[0] + "</em><b>" + num(q[1]) + "</b><small>" + q[2] + "</small></span>"; }).join("") + "</div>" +
      (compact ? "" : '<div class="pc-grid-v151b">' + [
        ["CAREERS", num(d.careers)], ["BANK", num(d.bank && d.bank.pp) + " PP"], ["HONORS", num(d.bank && d.bank.honors)],
        ["LOGOS & COLOURS", d.teamStyle ? (d.teamStyle.all ? "ALL" : (d.teamStyle.unlocked | 0) + "/" + (d.teamStyle.total | 0)) : "—"], ["BEST SCORE", num(d.bestScore)], ["UFF · ISL", (d.uffTitles | 0) + " · " + (d.interstellarTitles | 0)]
      ].map(function (q) { return "<div><b>" + escHtml(q[1]) + "</b><small>" + q[0] + "</small></div>"; }).join("") + "</div>") +
      "</div>";
    if (el) {
      el.innerHTML = html;
      var cv = el.querySelector(".pc-cv-v151b");
      var draw = function () { var r = drawCharacter(cv, cz.kit || {}, d.age || 22); if (r && r.mode !== "hi" && !draw._again) { draw._again = 1; setTimeout(draw, 700); } };
      if (cv) draw();
    }
    return html;
  }

  /* ---------------- the profile SCREEN (view "profile") ---------------- */
  function screenProfile(st) {
    var sc = document.getElementById("screen"), dock = document.getElementById("dock"); if (!sc) return;
    checkEarned(st);
    var d = profile(st), lv = d.titlesByLevel || {};
    sc.innerHTML = '<div class="eyebrow">YOUR PROFILE · WHAT THE LEAGUE SEES</div><div class="pcard-host-v151b"></div>' +
      '<div class="card tight prof-more-v151b"><div class="h2">Titles by level</div><div class="prof-chips-v151b">' +
      (Object.keys(lv).length ? Object.keys(lv).map(function (k) { return '<span class="press-chip">' + escHtml(k) + " ×" + (lv[k] | 0) + "</span>"; }).join("") : '<span class="small">No titles yet — go win one.</span>') + "</div>" +
      '<div class="h2" style="margin-top:10px">Achievements</div><div class="prof-chips-v151b">' + ACH.map(function (a) { var on = d.achievements.indexOf(a.id) >= 0; return '<span class="press-chip' + (on ? " hot" : "") + '" title="' + escHtml(a.desc) + '">' + (on ? "✓ " : "🔒 ") + escHtml(a.name) + "</span>"; }).join("") + "</div></div>";
    renderCard(d, sc.querySelector(".pcard-host-v151b"));
    if (dock) dock.innerHTML = '<button class="btn" onclick="cosOpenStyleV151B()">🎨 Change Style</button><div class="btn-row"><button class="btn ghost" onclick="go(\'hof\')">🏛️ Hall of Fame</button><button class="btn secondary" onclick="go(S.player&&S.player.pos?\'hub\':\'menu\')">Back</button></div>';
    V.profileShown = (V.profileShown || 0) + 1;
  }
  window.__profileRenderV151B = screenProfile;
  function openProfile() { try { if (window.go) { window.go("profile"); return true; } } catch (e) {} return false; }
  window.cosOpenStyleV151B = function () { try { var H = window.__HUB_V75; if (H && H.tabs) H.tabs.locker = "style"; } catch (e) {} window.go && window.go("locker"); };

  /* ---------------- the STYLE tab in the Locker ---------------- */
  var SEL = { cat: "uniform" };
  function stylePanel() {
    var cat = SEL.cat, list = ITEMS.filter(function (it) { return it.cat === cat && listed(it); }), eq = equipped(cat);
    var h = '<div class="cos-style-v151b" data-cat="' + cat + '">' +
      '<div class="h2 cos-h-v151b">Style <span>looks only · never changes a number</span></div>' +
      '<div class="cos-cats-v151b">' + SLOTS.map(function (s) { return '<button type="button" class="cos-cat-v151b' + (s === cat ? " on" : "") + '" onclick="cosCatV151B(\'' + s + '\')"><i>' + CATS[s].icon + "</i>" + CATS[s].name + "</button>"; }).join("") + "</div>" +
      '<div class="cos-grid-v151b">' + list.map(function (it) {
        var own = owned(it.id), on = it.id === eq;
        return '<div class="cos-item-v151b r-' + it.rarity + (own ? "" : " locked") + (on ? " on" : "") + '" data-cos="' + it.id + '"' + (own && !on ? ' onclick="cosEquipV151B(\'' + cat + "','" + it.id + '\')"' : "") + '>' +
          '<div class="cos-pvbox-v151b" data-pv="' + it.id + '"></div><div class="cos-nm-v151b">' + escHtml(it.name) + "</div>" +
          '<div class="cos-src-v151b">' + (on ? "✓ EQUIPPED" : own ? "TAP TO EQUIP" : "🔒 " + escHtml(howTo(it))) + "</div></div>";
      }).join("") + "</div></div>";
    return h;
  }
  function paintPreviews(root) { try { (root || document).querySelectorAll(".cos-pvbox-v151b[data-pv]").forEach(function (b) { if (b.__pv) return; b.__pv = 1; var it = BY[b.dataset.pv]; if (it) previewInto(b, it); }); } catch (e) {} }
  window.cosCatV151B = function (c) { if (!CATS[c]) return; SEL.cat = c; var el = document.querySelector(".cos-style-v151b"); if (el) { el.outerHTML = stylePanel(); paintPreviews(); } };
  window.cosEquipV151B = function (slot, id) {
    if (!equip(slot, id)) return false;
    var el = document.querySelector(".cos-style-v151b"); if (el) { el.outerHTML = stylePanel(); paintPreviews(); }
    toast("Equipped: " + (BY[id] ? BY[id].name : id)); return true;
  };
  setInterval(function () { if (document.querySelector(".cos-pvbox-v151b[data-pv]")) paintPreviews(); }, 400);

  /* ---------------- what equipping changes right away ---------------- */
  function applyRecap() {
    try {
      var st = gstate(), v = st && st.view, it = item("recap"), on = /^(result|declineResult|gameover|win)$/.test(v || "") && it && it.css;
      var root = document.documentElement;
      if (on) { if (root.getAttribute("data-cos-recap") !== it.css) root.setAttribute("data-cos-recap", it.css); V.recap = it.css; }
      else if (root.hasAttribute("data-cos-recap")) root.removeAttribute("data-cos-recap");
    } catch (e) {}
  }
  function apply(what) {
    applyRecap();
    if (what && what.equip) {
      if (what.equip === "uniform" || what.equip === "helmet" || what.equip === "stadium") refreshField();
      if (what.equip === "vault") { try { var r = document.getElementById("ribVault"); if (r) vaultDress(r); } catch (e) {} }
    }
  }
  try { new MutationObserver(applyRecap).observe(document.getElementById("screen") || document.body, { childList: true }); } catch (e) {}

  /* ---------------- the Team Creator's logos and colours ----------------
   * Each logo and each palette is one UNLOCK; the first five are free, shared between the two (so five
   * crests, or three crests and two palettes…). After that an unlock costs PP — 10, then 20, 40, 80… doubling
   * with every paid one (`teamStyleCostV151B`, `teamStyleFreeV151B`). One purchase unlocks everything
   * (`cos:team_style_all`, product `unlock_all_team_style`) — only while monetization is on. What a save was
   * already wearing is grandfathered on first sight and counts toward the five. The game still hands out its
   * own looks (the per-level rotation, a new career's random look, a UFF club's colours): the gate is on what
   * the PLAYER picks in the creator, never on what the league assigns. */
  var teamStyle = {
    data: function () { var S = load(); if (!S.ts) S.ts = { l: [], p: [], free: 0, paid: 0, gf: 0 }; return S.ts; },
    free: function () { return TUv("teamStyleFreeV151B", 5); },
    all: function () { return mHas("cos:team_style_all"); },
    owned: function (kind, i) { if (teamStyle.all()) return true; var T = teamStyle.data(); return (kind === "logo" ? T.l : T.p).indexOf(i | 0) >= 0; },
    cost: function () { var T = teamStyle.data(); return Math.round(TUv("teamStyleCostV151B", 10) * Math.pow(2, T.paid)); },
    freeLeft: function () { var T = teamStyle.data(); return Math.max(0, teamStyle.free() - T.free); },
    totals: function () { var nl = 0, np = 0; try { nl = (window.TEAM_LOGOS_V44 && window.TEAM_LOGOS_V44.db && window.TEAM_LOGOS_V44.db.length) || 90; } catch (e) { nl = 90; } try { np = (window.TEAM_PALETTES || []).length || 40; } catch (e) { np = 40; } return { logos: nl, pals: np }; },
    info: function () { var T = teamStyle.data(), tt = teamStyle.totals(), all = teamStyle.all(); return { logos: T.l.length, pals: T.p.length, unlocked: all ? tt.logos + tt.pals : T.l.length + T.p.length, total: tt.logos + tt.pals, freeLeft: teamStyle.freeLeft(), nextCost: teamStyle.cost(), all: all, canBuyAll: shopOn() && !all }; },
    grandfather: function (custom) {
      var T = teamStyle.data(); if (T.gf) return false;
      var c = custom || window.__GRIDIRON_TEAM_CUSTOM__ || null; if (!c) return false;
      var add = function (arr, v) { v = Number(v); if (isFinite(v) && arr.indexOf(v | 0) < 0) { arr.push(v | 0); T.free++; } };
      add(T.l, c.logo); add(T.p, c.palette);
      if (c.byLevel && typeof c.byLevel === "object") Object.keys(c.byLevel).forEach(function (k) { var o = c.byLevel[k] || {}; if (o.logo != null) add(T.l, o.logo); if (o.palette != null) add(T.p, o.palette); });
      T.free = Math.min(T.free, Math.max(teamStyle.free(), T.free)); T.gf = 1; persist(); return true;
    },
    take: function (kind, i, how, cost) { var T = teamStyle.data(), arr = kind === "logo" ? T.l : T.p; if (arr.indexOf(i | 0) < 0) arr.push(i | 0); if (how === "free") T.free++; if (how === "pp") T.paid++; persist(); V.teamStyle = { kind: kind, i: i, how: how, cost: cost || 0 }; fire({ teamStyle: kind }); },
    /* unlock the picks in `need` ([{kind,i}]) — free picks first, then PP; resolves true when all are owned */
    acquire: function (need) {
      need = (need || []).filter(function (n) { return !teamStyle.owned(n.kind, n.i); });
      if (!need.length) return Promise.resolve(true);
      var free = teamStyle.freeLeft(), plan = [], pp = 0, paidN = teamStyle.data().paid, base = TUv("teamStyleCostV151B", 10);
      need.forEach(function (n) { if (free > 0) { free--; plan.push({ n: n, how: "free", cost: 0 }); } else { var c = Math.round(base * Math.pow(2, paidN++)); pp += c; plan.push({ n: n, how: "pp", cost: c }); } });
      var st = gstate(), have = Math.round((st && st.pp) || 0);
      var words = plan.map(function (p) { return (p.n.kind === "logo" ? "the crest" : "the colours") + (p.how === "free" ? " (free pick)" : " (" + p.cost + " PP)"); }).join(" and ");
      var msg = "Unlock " + words + "?" + (pp ? " You have " + have.toLocaleString("en-US") + " PP." : " You have " + teamStyle.freeLeft() + " free pick" + (teamStyle.freeLeft() === 1 ? "" : "s") + " left.");
      var ask = window.ribDialog && window.ribDialog.confirm ? window.ribDialog.confirm(msg, { title: "UNLOCK TEAM STYLE", ok: pp ? "Spend " + pp + " PP" : "Use free pick", cancel: "Not now" }) : Promise.resolve(window.confirm ? window.confirm(msg) : true);
      return Promise.resolve(ask).then(function (yes) {
        if (!yes) return false;
        if (pp && !(window.__spendPPV151B && window.__spendPPV151B(pp, "teamStyle"))) { toast("Not enough PP — " + pp + " PP needed."); return false; }
        plan.forEach(function (p) { teamStyle.take(p.n.kind, p.n.i, p.how, p.cost); });
        return true;
      });
    },
    buyAll: function () { var m = M(); if (!m) return Promise.resolve(false); return Promise.resolve(m.purchase("unlock_all_team_style")).then(function (r) { fire({ teamStyle: "all" }); return !!(r && r.ok) || teamStyle.all(); }); },
    /* the creator's status line and lock badges (src/07 calls these by way of hoisted helpers) */
    barHTML: function () {
      var I = teamStyle.info();
      if (I.all) return '<div class="ts-bar-v151b all">✓ EVERY CREST AND COLOUR UNLOCKED</div>';
      return '<div class="ts-bar-v151b"><span><b>' + I.unlocked + "</b> unlocked · " + (I.freeLeft ? "<b>" + I.freeLeft + "</b> free pick" + (I.freeLeft === 1 ? "" : "s") + " left" : "next unlock <b>" + I.nextCost + " PP</b>") + "</span>" +
        (I.canBuyAll ? '<button type="button" class="ts-all-v151b" onclick="cosBuyAllStyleV151B()">UNLOCK ALL</button>' : "") + "</div>";
    }
  };
  window.cosBuyAllStyleV151B = function () { teamStyle.buyAll().then(function (ok) { if (ok) { try { window.openTeamCreatorV153 && window.openTeamCreatorV153(); } catch (e) {} } }); };


  /* ---------------- the look (one style element, gold on charcoal like the broadcast) ---------------- */
  (function () {
    if (document.getElementById("cosV151Bcss")) return;
    var st = document.createElement("style"); st.id = "cosV151Bcss";
    st.textContent = [
      /* the card */
      ".pcard-v151b{position:relative;margin:8px auto 10px;max-width:372px;border-radius:16px;background:linear-gradient(180deg,#121a26,#0a0f16);overflow:hidden;border:2px solid #3a4658;box-shadow:0 10px 26px rgba(0,0,0,.5);font-family:Oswald,sans-serif;color:#e8edf4}",
      ".pc-ban-v151b{position:relative;height:58px}",
      ".pc-gen-v151b{position:absolute;left:10px;top:8px;padding:2px 7px;border-radius:6px;background:rgba(0,0,0,.55);color:#ffd76f;font:700 10px Oswald,sans-serif;letter-spacing:1.5px}",
      ".pc-ovr-v151b{position:absolute;right:10px;top:7px;display:flex;flex-direction:column;align-items:center;padding:2px 8px;border-radius:8px;background:rgba(0,0,0,.55);font:700 8px Oswald,sans-serif;letter-spacing:1.5px;color:#c9d2de}.pc-ovr-v151b b{font-size:19px;line-height:1;color:#ffd76f}",
      ".pc-body-v151b{display:flex;gap:10px;padding:0 12px;margin-top:-34px;position:relative}",
      ".pc-fig-v151b{flex:none;width:92px;height:116px;border-radius:12px;background:radial-gradient(ellipse at 50% 85%,rgba(240,187,69,.18),rgba(8,12,18,.85) 70%);border:1px solid rgba(255,255,255,.08);display:grid;place-items:end center;overflow:hidden}",
      ".pc-cv-v151b{width:92px;height:115px;image-rendering:auto}",
      ".pc-id-v151b{min-width:0;flex:1;padding-top:38px}",
      ".pc-name-v151b{font:700 19px Oswald,sans-serif;letter-spacing:1px;line-height:1.05;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".pc-meta-v151b{font-size:11px;color:#9fb0c4;letter-spacing:1px;margin-top:3px}",
      ".pc-team-v151b{display:flex;align-items:center;gap:4px;margin-top:6px;font-size:10px;letter-spacing:1px;color:#dfe6ef;min-width:0}.pc-team-v151b span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".pc-logo-v151b{flex:none;width:24px;height:24px;display:inline-block}",
      ".pc-sw-v151b{flex:none;width:12px;height:12px;border-radius:3px;box-shadow:0 0 0 1px rgba(255,255,255,.25) inset}",
      ".pc-club-v151b{font-size:10px;color:#ffd76f;letter-spacing:1px;margin-top:3px}",
      ".pc-shelf-v151b{display:flex;justify-content:space-around;margin:10px 10px 0;padding:7px 4px 5px;border-radius:10px;background:linear-gradient(180deg,#3b2a1a,#241810);border-bottom:4px solid #1a110a;box-shadow:0 4px 8px rgba(0,0,0,.4)}",
      ".pc-shelf-v151b span{display:flex;flex-direction:column;align-items:center;min-width:52px}.pc-shelf-v151b em{font-style:normal;font-size:19px;line-height:1.1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.6))}.pc-shelf-v151b b{font-size:15px;color:#fff;line-height:1.05}.pc-shelf-v151b small{font-size:8px;letter-spacing:1.5px;color:#d9c6a8}",
      ".sh-steel{background:linear-gradient(180deg,#5a6270,#2e343d)!important;border-bottom-color:#1b1f25!important}.sh-steel small{color:#cfd6e0!important}",
      ".sh-gold{background:linear-gradient(180deg,#8a6a1c,#4a3608)!important;border-bottom-color:#2a1e04!important;box-shadow:0 0 0 1px #f0bb45 inset,0 4px 10px rgba(240,187,69,.25)!important}.sh-gold small{color:#ffe7a8!important}",
      ".sh-marble{background:linear-gradient(135deg,#e9e6df,#c9c4ba 40%,#f3f0ea 60%,#bdb8ae)!important;border-bottom-color:#8d887f!important}.sh-marble b{color:#1b1b1b!important}.sh-marble small{color:#4a463f!important}",
      ".sh-glass{background:linear-gradient(180deg,rgba(180,220,255,.2),rgba(120,170,220,.08))!important;border:1px solid rgba(190,225,255,.45)!important;border-bottom:3px solid rgba(190,225,255,.5)!important}",
      ".sh-founder{background:linear-gradient(180deg,#15181f,#0b0d12)!important;border-bottom-color:#e6c46a!important;box-shadow:0 0 0 1px rgba(230,196,106,.6) inset!important}.sh-founder small{color:#e6c46a!important}",
      ".pc-grid-v151b{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:10px 10px 12px}.pc-grid-v151b div{padding:6px 4px;border-radius:9px;background:rgba(255,255,255,.04);text-align:center;min-width:0}.pc-grid-v151b b{display:block;font-size:15px;color:#fff;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pc-grid-v151b small{font-size:8px;letter-spacing:1.2px;color:#8fa2bb}",
      ".pcard-v151b.compact .pc-cv-v151b{width:70px;height:88px}.pcard-v151b.compact .pc-fig-v151b{width:70px;height:88px}",
      /* the frames */
      ".fr-steel{border-color:#9aa3b2;background:linear-gradient(180deg,#1a212c,#0b1017)}",
      ".fr-gold{border-color:#f0bb45;box-shadow:0 0 0 2px #7a5a14,0 0 22px rgba(240,187,69,.35),0 10px 26px rgba(0,0,0,.5)}",
      ".fr-platinum{border-color:#e6ecf5;box-shadow:0 0 0 2px #8e9aab,0 0 22px rgba(220,235,255,.35),0 10px 26px rgba(0,0,0,.5)}",
      ".fr-cosmic{border-color:#b9a6ff;box-shadow:0 0 0 2px #3c2a8a,0 0 26px rgba(122,90,223,.55),0 10px 26px rgba(0,0,0,.5)}",
      ".fr-flame{border-color:#ff7a1a;animation:cosFlameV151B 1.6s ease-in-out infinite}",
      "@keyframes cosFlameV151B{0%,100%{box-shadow:0 0 0 2px #7a2a08,0 0 14px rgba(255,122,26,.45),0 -6px 20px rgba(255,59,26,.35)}50%{box-shadow:0 0 0 2px #a8400c,0 0 26px rgba(255,176,46,.7),0 -10px 28px rgba(255,59,26,.55)}}",
      ".fr-ring{border:3px double #f0bb45;box-shadow:0 0 0 3px #3a2a08,0 0 0 5px #c9a13b,0 10px 26px rgba(0,0,0,.5)}",
      ".fr-diamond{border-color:#bfefff;box-shadow:0 0 0 2px #3a6f8a,0 0 18px rgba(191,239,255,.45),0 10px 26px rgba(0,0,0,.5);background:linear-gradient(180deg,#132232,#0a0f16)}",
      ".fr-carbon{border-color:#5a6068;background:repeating-linear-gradient(45deg,#15181d 0 4px,#1c2027 4px 8px)}",
      ".fr-founder{border-color:#e6c46a;animation:cosFounderV151B 3.2s linear infinite}",
      "@keyframes cosFounderV151B{0%,100%{box-shadow:0 0 0 2px #0d0f14,0 0 0 3px #e6c46a,0 0 18px rgba(230,196,106,.35)}50%{box-shadow:0 0 0 2px #0d0f14,0 0 0 3px #fff0c8,0 0 30px rgba(230,196,106,.6)}}",
      "@media(prefers-reduced-motion:reduce){.fr-flame,.fr-founder{animation:none}}",
      /* the style tab */
      ".cos-h-v151b span{font:400 10px Oswald,sans-serif;letter-spacing:1px;color:#8fa2bb;margin-left:6px}",
      ".cos-cats-v151b{display:flex;gap:5px;overflow-x:auto;scrollbar-width:none;padding:2px 0 6px}.cos-cats-v151b::-webkit-scrollbar{display:none}",
      ".cos-cat-v151b{flex:none;display:flex;align-items:center;gap:4px;padding:6px 9px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:#0d141e;color:#9fb0c4;font:700 10px Oswald,sans-serif;letter-spacing:1px;cursor:pointer}.cos-cat-v151b i{font-style:normal;font-size:13px}.cos-cat-v151b.on{color:#ffd76f;border-color:rgba(240,187,69,.55);background:linear-gradient(180deg,rgba(240,187,69,.2),rgba(240,187,69,.05))}",
      ".cos-grid-v151b{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;padding-bottom:4px}",
      ".cos-item-v151b{position:relative;border-radius:11px;border:1px solid rgba(255,255,255,.09);background:#0c131c;padding:6px 5px 6px;text-align:center;cursor:pointer;min-width:0}",
      ".cos-item-v151b.on{border-color:#f0bb45;box-shadow:0 0 0 1px #f0bb45 inset}.cos-item-v151b.locked{opacity:.62;cursor:default}",
      ".cos-item-v151b.r-rare{border-color:rgba(90,160,255,.4)}.cos-item-v151b.r-epic{border-color:rgba(190,110,255,.45)}.cos-item-v151b.r-legendary{border-color:rgba(255,176,46,.5)}.cos-item-v151b.r-mythic{border-color:rgba(255,90,140,.55)}",
      ".cos-nm-v151b{font:700 11px Oswald,sans-serif;color:#eef2f7;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".cos-src-v151b{font:400 8.5px Oswald,sans-serif;letter-spacing:.6px;color:#8fa2bb;line-height:1.2;margin-top:2px;min-height:20px}.cos-item-v151b.on .cos-src-v151b{color:#ffd76f}",
      ".cos-pvbox-v151b{height:64px;display:grid;place-items:center;border-radius:8px;background:radial-gradient(ellipse at 50% 80%,rgba(255,255,255,.07),transparent 70%);overflow:hidden}",
      ".cos-pvbox-v151b canvas{width:56px;height:62px;image-rendering:pixelated}",
      ".cos-sw-v151b{display:inline-block;width:16px;height:34px;border-radius:5px;margin:0 2px}.cos-sw-v151b.big{width:30px}",
      ".cos-mini-v151b.pcard-v151b{width:54px;height:58px;margin:0;border-radius:9px}.cos-mini-v151b b{display:block;height:16px;background:linear-gradient(135deg,#2a3446,#141b26)}.cos-mini-v151b i{display:block;margin:7px auto;width:22px;height:22px;border-radius:50%;background:#2a3446}",
      ".cos-cel-v151b{position:relative;width:64px;height:60px}.cos-cel-v151b i{position:absolute;left:50%;top:60%;width:5px;height:5px;border-radius:50%;background:var(--c);animation:cosCelV151B 1.4s ease-out infinite;animation-delay:calc(var(--i)*-.17s);transform-origin:0 0}",
      ".cos-cel-v151b b{position:absolute;left:0;right:0;top:4px;font:700 9px Oswald,sans-serif;letter-spacing:1px;color:#fff;text-shadow:0 1px 2px #000}",
      "@keyframes cosCelV151B{0%{transform:rotate(calc(var(--i)*45deg)) translate(0,0);opacity:1}100%{transform:rotate(calc(var(--i)*45deg)) translate(26px,0);opacity:0}}",
      ".cos-cel-v151b.k-rain i,.cos-cel-v151b.k-flame i{animation-name:cosRainV151B;left:calc(8% + var(--i)*11%)}.cos-cel-v151b.k-flame i{animation-direction:reverse}",
      "@keyframes cosRainV151B{0%{top:0;opacity:1}100%{top:92%;opacity:.1}}",
      "@media(prefers-reduced-motion:reduce){.cos-cel-v151b i{animation:none}}",
      ".cos-std-v151b{position:relative;width:64px;height:54px;border-radius:7px;overflow:hidden}.cos-std-v151b i{position:absolute;left:0;right:0}.cos-std-v151b .sky{top:0;height:14px;background:linear-gradient(#050810,#141c2c)}",
      ".cos-std-v151b .crowd{top:14px;height:18px;background:radial-gradient(circle,var(--cr) 1px,transparent 1.6px) 0 0/5px 5px,#2a303a}.cos-std-v151b .band{top:32px;height:6px;border-top:2px solid}.cos-std-v151b .turf{top:40px;bottom:0;background:#2d7a3a}",
      ".cos-vlt-v151b{position:relative;width:64px;height:54px;border-radius:7px;background:radial-gradient(ellipse at 50% 90%,rgba(255,220,140,.15),var(--room) 70%)}.cos-vlt-v151b i{position:absolute;bottom:8px;width:20px;height:20px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff6d0,#e6b53a 55%,#8a6414);box-shadow:0 0 0 2px rgba(0,0,0,.25) inset}",
      ".cos-vlt-v151b i::after{content:'';position:absolute;inset:0;border-radius:50%;background:var(--coin);mix-blend-mode:color;opacity:var(--mix)}",
      ".cos-vlt-v151b i:nth-child(1){left:6px}.cos-vlt-v151b i:nth-child(2){left:22px;bottom:16px}.cos-vlt-v151b i:nth-child(3){left:38px}",
      ".cos-ban-v151b{width:64px;height:40px;border-radius:6px}",
      ".cos-shelf-v151b{display:flex;gap:2px;padding:4px 5px 3px;border-radius:6px;background:linear-gradient(180deg,#3b2a1a,#241810);border-bottom:3px solid #1a110a;font-size:14px}",
      ".cos-rcp-v151b{width:54px;height:54px;border-radius:8px;border:1px solid #3a4658;background:#101824;display:flex;flex-direction:column;align-items:center;padding-top:6px;gap:3px}.cos-rcp-v151b b{font:700 16px Oswald,sans-serif;color:#57e07a}.cos-rcp-v151b i{width:36px;height:3px;border-radius:2px;background:#3a4658}",
      ".rc-news{background:#e9e4d6!important;border-color:#9b9484!important}.rc-news b{color:#1b1b1b!important;font-family:Georgia,serif!important}.rc-news i{background:#9b9484!important}",
      ".rc-gold{background:linear-gradient(160deg,#3a2a08,#141008)!important;border-color:#f0bb45!important}.rc-gold b{color:#ffd76f!important}",
      ".rc-neon{background:#12051f!important;border-color:#ff3df2!important;box-shadow:0 0 10px rgba(255,61,242,.4)}.rc-neon b{color:#6ff7ff!important}",
      ".rc-chalk{background:#1f3a2c!important;border-color:#6b4e2a!important}.rc-chalk b{color:#f2f2e8!important}",
      ".rc-founder{background:#0d0f14!important;border-color:#e6c46a!important}.rc-founder b{color:#e6c46a!important}",
      /* the recap skins over the real report card / career-end card */
      "html[data-cos-recap=news] #screen .card{background:#ece7d8!important;color:#1b1b1b!important;border-color:#9b9484!important}html[data-cos-recap=news] #screen .card .h1,html[data-cos-recap=news] #screen .card .sub,html[data-cos-recap=news] #screen .card .small{color:#1b1b1b!important;font-family:Georgia,serif}",
      "html[data-cos-recap=gold] #screen .card{background:linear-gradient(160deg,rgba(240,187,69,.16),#0d0f14 70%)!important;border-color:#f0bb45!important}html[data-cos-recap=gold] #screen .card .h1{color:#ffd76f!important}",
      "html[data-cos-recap=neon] #screen .card{background:#12051f!important;border-color:#ff3df2!important;box-shadow:0 0 14px rgba(255,61,242,.3)!important}html[data-cos-recap=neon] #screen .card .h1{color:#6ff7ff!important}",
      "html[data-cos-recap=chalk] #screen .card{background:#1f3a2c!important;border-color:#6b4e2a!important;border-width:3px!important}html[data-cos-recap=chalk] #screen .card .h1{color:#f2f2e8!important}",
      "html[data-cos-recap=founder] #screen .card{background:linear-gradient(180deg,#15181f,#0b0d12)!important;border-color:#e6c46a!important}html[data-cos-recap=founder] #screen .card .h1{color:#e6c46a!important}",
      /* the vault's motes */
      ".rv-cos-v151b{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1}",
      ".rv-cos-v151b i{position:absolute;bottom:-8px;width:calc(4px*var(--s));height:calc(4px*var(--s));border-radius:50%;background:var(--mote);box-shadow:0 0 8px var(--mote);opacity:.7;animation:cosMoteV151B linear infinite}",
      "@keyframes cosMoteV151B{0%{transform:translateY(0);opacity:0}15%{opacity:.75}100%{transform:translateY(-105vh);opacity:0}}",
      "@media(prefers-reduced-motion:reduce){.rv-cos-v151b i{animation:none;opacity:.35;bottom:40%}}",
      ".pc-ico-v151b{position:absolute;left:10px;top:8px;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:rgba(0,0,0,.6);font-size:15px}.pc-gen-v151b.shift{left:42px!important}",
      ".pc-bdg-v151b{position:absolute;right:62px;top:10px;font-size:20px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.7))}",
      ".pc-title-v151b{font:600 10px Oswald,sans-serif;letter-spacing:1.2px;color:#ffd76f;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".cos-flair-v151b{min-width:58px;height:40px;border-radius:8px;display:grid;place-items:center;background:#131b27;color:#ffd76f;font:600 9px Oswald,sans-serif;letter-spacing:.8px;padding:0 4px;text-align:center}.cos-flair-v151b.big{width:40px;min-width:0;border-radius:50%;font-size:20px}.cos-flair-v151b.plate small{color:#fff}",
      /* the profile screen */
      ".prof-chips-v151b{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}.prof-more-v151b{margin-top:0}",
      /* the team creator's gate */
      ".ts-bar-v151b{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:8px 0 2px;padding:7px 10px;border-radius:10px;background:rgba(240,187,69,.08);border:1px solid rgba(240,187,69,.3);font:400 11px Oswald,sans-serif;letter-spacing:.5px;color:#dfe6ef}.ts-bar-v151b b{color:#ffd76f}.ts-bar-v151b.all{justify-content:center;color:#57e07a}",
      ".ts-all-v151b{flex:none;border:1px solid #f0bb45;background:linear-gradient(180deg,#f0bb45,#c9951f);color:#1b1406;font:700 10px Oswald,sans-serif;letter-spacing:1px;padding:5px 9px;border-radius:8px;cursor:pointer}",
      ".palette-v153.lock-v151b,.logo-pick-v153.lock-v151b{position:relative}.palette-v153.lock-v151b::after,.logo-pick-v153.lock-v151b::after{content:'\\1F512';position:absolute;left:2px;top:1px;font-size:9px;filter:drop-shadow(0 1px 1px #000)}.logo-pick-v153.lock-v151b>*{opacity:.55}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(st);
  })();

  /* ---------------- the API ---------------- */
  var API = {
    version: "v151b", slots: SLOTS.slice(), cats: CATS, achievements: ACH.map(function (a) { return { id: a.id, name: a.name, desc: a.desc }; }),
    catalog: catalog, owned: owned, grant: grant, grantPack: grantPack, equip: equip, equipped: equipped, packs: packs, onChange: onChange,
    profile: profile, renderCard: renderCard, openProfile: openProfile, passItem: passItem, drawCharacter: drawCharacter, howTo: howTo, listed: listed,
    checkEarned: checkEarned, account: account, teamStyle: teamStyle,
    /* the renderer's and the vault's reads */
    fieldKit: fieldKit, menuColors: menuColors, celebrate: celebrate, stadiumTheme: stadiumTheme, vaultTheme: vaultTheme, vaultTint: vaultTint, vaultDress: vaultDress,
    refreshField: refreshField, stylePanel: stylePanel, paintPreviews: paintPreviews, kitDeco: kitDeco,
    _reset: function () { mem = null; try { localStorage.removeItem(KEY); } catch (e) {} fire({ reset: 1 }); }
  };
  window.RIB_COSMETICS = API;

  /* earned unlocks: at boot, after every save (GridironStorage.save — v149 D wraps it too; this sits inside that) */
  try {
    var GS = window.GridironStorage;
    if (GS && typeof GS.save === "function" && !GS.save.__cosV151B) {
      var orig = GS.save;
      var wrapped = function () { var r = orig.apply(this, arguments); try { setTimeout(function () { checkEarned(); }, 0); } catch (e) {} return r; };
      wrapped.__cosV151B = true; GS.save = wrapped;
    }
  } catch (e) {}
  setTimeout(function () { try { checkEarned(); teamStyle.grandfather(); } catch (e) {} }, 1500);
  /* a save restored on the profile view drew before this file loaded (v140): draw it now */
  try { var st0 = gstate(); if (st0 && st0.view === "profile") setTimeout(function () { try { screenProfile(gstate()); } catch (e) {} }, 0); } catch (e) {}
})();
