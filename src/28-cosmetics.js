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
  var SLOTS = ["uniform", "helmet", "frame", "celebration", "stadium", "vault", "banner", "shelf", "recap", "title", "badge", "nameplate", "icon",
    "trail", "wings", "crown", "aura", "numfont"];   // v153 G: the five flair slots (fieldFx below + the card's flair layers)
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
    icon: { name: "PROFILE ICONS", icon: "👤", def: "icon_none" },
    /* v153 G — worn on HIM on the live field (one bannered hook in src/05's placeMarker) and on the card figure */
    trail: { name: "FOOTPRINTS", icon: "👣", def: "trail_none" },
    wings: { name: "WINGS", icon: "🪶", def: "wings_none" },
    crown: { name: "CROWNS", icon: "👑", def: "crown_none" },
    aura: { name: "AURAS", icon: "✨", def: "aura_none" },
    numfont: { name: "NUMBER FONTS", icon: "🔢", def: "nf_team" }
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
  ITEMS.push.apply(ITEMS, itemsV153G());   // v153 G: the expanded catalogue (defined with the flair code below)
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
  var PASS_CAT = { banner: "banner", frame: "frame", celebration: "celebration", kit: "uniform", title: "title", badge: "badge", nameplate: "nameplate", icon: "icon",
    jersey: "uniform", helmet: "helmet", trail: "trail", wings: "wings", crown: "crown", aura: "aura", numfont: "numfont" };   // v153 G
  function hsh(str) { var h = 2166136261 >>> 0; str = String(str); for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function hslHex(h, s2, l) { var a = s2 * Math.min(l, 1 - l), f = function (n) { var k = (n + h / 30) % 12, c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * c).toString(16).padStart(2, "0"); }; return "#" + f(0) + f(8) + f(4); }
  var ICON_GLYPHS = ["🦅", "🐺", "🦁", "🐻", "⚡", "🔥", "🛡️", "👑", "🐍", "🦈"];
  function passItem(rw) {
    try {
      if (!rw || !/^pass\.[A-Za-z0-9_-]+\.(free|premium)\.\d+$/.test(String(rw.id || ""))) return null;
      if (BY[rw.id]) return BY[rw.id];
      var cat = PASS_CAT[rw.kind]; if (!cat) return null;
      var h = hsh(rw.id), c1 = hslHex(h % 360, 0.62, 0.42), c2 = hslHex((h >>> 9) % 360, 0.72, 0.62), rr = /^(common|rare|epic|legendary|mythic)$/.test(rw.rarity) ? rw.rarity : "common";
      var it = { id: rw.id, cat: cat, name: String(rw.name || "Pass reward").replace(/[<>]/g, "").slice(0, 40), rarity: rr, source: "pass", tier: rw.tier | 0, track: rw.track === "premium" ? "premium" : "free", season: String(rw.season || "").slice(0, 12), packs: [], passKind: rw.kind };
      if (cat === "banner") it.bg = "linear-gradient(135deg," + c1 + " 0%," + c2 + " 55%,#0b0f16 100%)";
      else if (cat === "frame") it.css = { common: "steel", rare: "carbon", epic: "diamond", legendary: "gold" }[rr];
      else if (cat === "celebration") it.c = { kind: { common: "spot", rare: "stars", epic: "fireworks", legendary: "rain" }[rr], col: [c2, "#ffffff", c1], say: rr === "legendary" ? "LEGEND" : "SEASON " + String(it.season).replace(/^s/, "") };
      else if (cat === "uniform") it.k = { j: "team", p: "team", t: c2, pat: ["sleeves", "yoke", "chest", "hoops"][h % 4] };
      else if (cat === "title") it.text = it.name.replace(/[“”"]/g, "");
      else if (cat === "badge") it.glyph = ["🎖", "🏅", "⭐", "🔰", "💠"][h % 5], it.col = c2;
      else if (cat === "nameplate") it.plate = "linear-gradient(90deg," + c1 + "cc," + c2 + "33 70%,transparent)";
      else if (cat === "icon") it.glyph = ICON_GLYPHS[h % ICON_GLYPHS.length], it.col = c1;
      passLookV153G(it, rw, h, c1, c2, rr);   // v153 G: jerseys, helmets, flair, and more variety in frames / banners / celebrations
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
    var A = { careers: st.careers || 0, pp: Math.round(st.pp || 0), honors: st.prestige || 0, medals: (window.__V156A && window.__V156A.on() ? window.__V156A.medals() : null) /* v156 A */, titles: st.titlesWon || 0, rings: st.rings || 0,
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
              else if (f === "satin") s2 = 1 + (sc - 1) * 0.7;
              out = HS.map(function (v) { return v * s2; });
              if ((f === "gloss" || f === "pearl") && yy <= head + 1) out = mix(out, [255, 255, 255], 0.28);
              if (f === "satin" && yy === head) out = mix(out, [255, 255, 255], 0.14);
              if (f === "pearl" && ((xx + yy) % 3 === 0)) out = mix(out, HST || [236, 230, 255], 0.2);   // v153 G: an iridescent fleck
              if (f === "chrome" && (yy <= head + 1 || ((xx + yy) % 5 === 0))) out = mix(out, [255, 255, 255], 0.42);
              if (f === "metal" && ((xx * 7 + yy * 13) % 11 === 0)) out = mix(out, [255, 255, 255], 0.5);
              var hr = hRows[yy];
              if (HST && hr) { var cx = (hr[0] + hr[1]) / 2, wide = hr[1] - hr[0] > 11 ? 1.1 : 0.6, dxs = Math.abs(xx - cx);
                var onSt = H.sk === "twin" ? dxs >= wide + 0.4 && dxs <= wide + 1.6 : H.sk === "wide" ? dxs <= wide + 1 : dxs <= wide;   // v153 G: twin / wide stripes
                if (onSt) out = HST.map(function (v) { return v * Math.min(1.2, Math.max(0.6, s2)); }); }
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
              else if (pat !== "solid") out = patV153G(pat, xx, yy, top, W / 2, UJ, UT);   // v153 G: chevron, stripes, shoulders, checker, sash, tiger
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
    U.pat = PAT_CARD_V153G[U.pat] || U.pat;   // v153 G: the card's figure draws the nearest of its own patterns
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
      } else if (CEL_V153G[C.kind]) {
        made += CEL_V153G[C.kind]({ scene: scene, x: x, y: y, n: n, R: R, cn: cn, cols: cols, dot: dot, tw: tw, track: track, D: D, reduced: reduced });   // v153 G
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
    else if (FLAIR_CATS_V153G[cat]) return previewFlairV153G(el, it);   // v153 G: trail, wings, crown, aura, number font
    el.innerHTML = html; return el;
  }

  /* ---------------- the character on the card ---------------- */
  /* ===== v153 E THE KIT READS ON THE CARD =====
   * The card used to borrow the growth screen's recolour (07's growHiCellV134), which skips every source pixel
   * darker than L 38 — and the source jersey is navy at a MEDIAN L of 32, so the torso and the socks stayed the
   * art's own navy whatever he wore: a teal-and-black team read as a navy man with teal arms, a white kit as navy
   * with grey blotches (only the navy's highlights were scaled, `L / 95`, into flat patches). The pattern pass
   * then shaded its trim off a sentinel's green (`l6 * 1.05`), the same broken ramp again.
   *
   * So the card recolours the native-size art itself, once per kit, at the SOURCE: every navy pixel (any
   * lightness) is the jersey (above the neck, the helmet shell), every gold pixel the pants and arms (above the
   * neck, the helmet stripe and mask); each is re-shaded on a ramp around its region's median — the median pixel
   * IS the kit colour, darker folds run down to a shadow of it, highlights up towards white — so a black kit
   * keeps its folds, a white kit its creases, and the team colour is the colour you see. The pattern is painted
   * on the jersey rows in source coordinates before the scale, so it shades the same way. The figure is then
   * drawn exactly as the growth screen draws him (the same age proportions, `__GROW_V132.stage`).
   * Looks only: nothing here reads or writes a number the game uses. `window.__V153E.fig`. ===== */
  var FIG = { img: null, tried: false, cache: {}, neck: 0.372, waiting: [], drawn: 0, last: null };
  function figLoad() {
    if (FIG.img || FIG.tried) return;
    FIG.tried = true;
    try {
      var im = new Image(); im.decoding = "async";
      im.onload = function () { FIG.img = im; var w = FIG.waiting.splice(0); w.forEach(function (f) { try { f(); } catch (e) {} }); };
      im.onerror = function () { FIG.tried = false; };
      im.src = window.__RIB_ASSET ? window.__RIB_ASSET("grow/idle_dn_hi.png") : "./public/grow/idle_dn_hi.png";
    } catch (e) {}
  }
  function lumOf(c) { return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; }
  /* one kit colour at one source shade: t = the pixel's lightness over its region's median */
  function shadeKit(B, t) {
    var L = lumOf(B), base = L < 48 ? mix(B, [255, 255, 255], ((48 - L) / 48) * 0.14) : B;   // a black kit keeps a fold to read
    if (t <= 1) { var k = Math.max(0, Math.min(1, (t - 0.32) / 0.68)); return mix([base[0] * 0.24, base[1] * 0.24, base[2] * 0.3], base, k); }
    var h = Math.min(1, (t - 1) * 0.5) * (L > 205 ? 0.25 : 0.55);
    return mix(base, [255, 255, 255], h);
  }
  function srcClass(r, g, b) {
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2, sat = mx ? (mx - mn) / mx : 0, hue = 0;
    if (mx !== mn) { if (mx === r) hue = (60 * ((g - b) / (mx - mn)) + 360) % 360; else if (mx === g) hue = 60 * ((b - r) / (mx - mn)) + 120; else hue = 60 * ((r - g) / (mx - mn)) + 240; }
    if (hue >= 190 && hue <= 265 && sat > 0.25 && mx > 14) return [1, L];
    if (hue >= 33 && hue <= 62 && sat > 0.3 && L > 18) return [2, L];
    if (hue >= 12 && hue < 33 && sat > 0.35 && L > 14) return [3, L];     // the gold's warm rim (and his skin, which is kept)
    return [0, L];
  }
  /* the source recoloured for one kit: { j, p, t, pat, hs, hst, hf } (hex strings; hs / hst / t optional) */
  function figCell(K) {
    var im = FIG.img; if (!im) return null;
    var key = [K.j, K.p, K.t, K.pat, K.hs, K.hst, K.hf].join("|");
    if (FIG.cache[key]) return FIG.cache[key];
    var W = im.naturalWidth, H = im.naturalHeight, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var x = cv.getContext("2d"); x.drawImage(im, 0, 0);
    var img = x.getImageData(0, 0, W, H), d = img.data;
    var top = 3, neck = Math.round(top + (H - 6) * FIG.neck);
    // the jersey's rows: from the neck to the first row where the gold pants outweigh the navy
    var waist = H;
    for (var y0 = neck + 20; y0 < H; y0++) {
      var nv = 0, gd = 0;
      for (var x0 = 0; x0 < W; x0++) { var i0 = (y0 * W + x0) * 4; if (d[i0 + 3] < 20) continue; var c0 = srcClass(d[i0], d[i0 + 1], d[i0 + 2])[0]; if (c0 === 1) nv++; else if (c0 === 2) gd++; }
      if (gd > 12 && gd > nv * 1.5) { waist = y0; break; }
    }
    var J = rgb(K.j), P = rgb(K.p), T = K.t ? rgb(K.t) : P, HS = K.hs ? rgb(K.hs) : J, HST = K.hst ? rgb(K.hst) : P, pat = K.pat || "solid";
    var sw = 3, MED1 = 32.5, MED2 = 88;                 // the source's navy and gold medians (measured off idle_dn_hi.png)
    var gloss = K.hf === "gloss" || K.hf === "chrome", chrome = K.hf === "chrome";
    // the helmet is the dome (an ellipse over the art's own helmet), not everything above the neck: the
    // shoulder pads ride those rows too. Its stripe is the gold above the visor; the mask stays the trim colour.
    var hx0 = W * 0.515, hy0 = H * 0.15, hrx = W * 0.29, hry = H * 0.14, visor = H * 0.23;
    for (var y = 0; y < H; y++) for (var xx = 0; xx < W; xx++) {
      var i = (y * W + xx) * 4; if (d[i + 3] < 20) continue;
      var c = srcClass(d[i], d[i + 1], d[i + 2]), cls = c[0], o = null, t = 1;
      var ex = (xx - hx0) / hrx, ey = (y - hy0) / hry, helmet = y < neck && ex * ex + ey * ey <= 1;
      var face = y >= H * 0.2 && y < neck + 6 && xx > W * 0.28 && xx < W * 0.75;
      if (cls === 1) {
        t = c[1] / MED1;
        if (helmet) { o = HS; if (chrome) t = 0.55 + (t - 0.55) * 1.6; }
        else {
          o = J;
          if (y < waist && pat !== "solid" && K.t) {
            var ty = Math.max(0, (y - neck) / Math.max(1, waist - neck));
            if (pat === "hoops" && Math.floor(Math.max(0, y - neck) / (sw * 3)) % 2 === 1) o = T;
            else if (pat === "pinstripe" && Math.floor(xx / sw) % 3 === 0) o = mix(J, T, 0.55);
            else if (pat === "split" && xx >= W / 2) o = T;
            else if (pat === "fade") o = mix(J, T, Math.min(1, ty * 1.15));
            else if (pat === "yoke" && ty < 0.2) o = T;
            else if (pat === "chest" && Math.abs(ty - 0.45) < 0.12) o = T;
            else if (pat === "sleeves" && Math.abs(ty - 0.26) < 0.06) o = T;
            else if (pat === "camo") { var hh = ((Math.floor(xx / (sw * 2))) * 73856093 ^ (Math.floor(y / (sw * 2))) * 19349663) >>> 0; if (hh % 7 < 2) o = T; }
          }
        }
      } else if (cls === 2 || (cls === 3 && !face)) { t = c[1] / MED2; o = helmet && y < visor ? HST : P; }   // the warm rim follows its gold, never his face
      if (!o) continue;
      var out = shadeKit(o, t);
      if (helmet && gloss && cls === 1 && y < hy0 - hry * 0.45) out = mix(out, [255, 255, 255], 0.3);
      d[i] = Math.max(0, Math.min(255, out[0])); d[i + 1] = Math.max(0, Math.min(255, out[1])); d[i + 2] = Math.max(0, Math.min(255, out[2]));
    }
    x.putImageData(img, 0, 0);
    FIG.cache[key] = cv;
    return cv;
  }
  /* the growth screen's geometry (07 growDrawHiV134), on the card's own recolour */
  function figDraw(cv, age, K) {
    var c = figCell(K), G = window.__GROW_V132; if (!c || !cv || !cv.getContext) return null;
    var stg = G && G.stage ? G.stage(age) : { head: 1, width: 1, name: "grown" };
    var W = 128, H = 160, dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.classList.add("hi");
    var x = cv.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
    x.clearRect(0, 0, W, H);
    x.save(); x.fillStyle = "rgba(0,0,0,.45)"; x.beginPath(); x.ellipse(W / 2, H - 3, 25, 4.5, 0, 0, 6.283); x.fill(); x.restore();
    var SW = c.width, SH = c.height, top = 3, bot = SH - 3, ink = bot - top, neck = Math.round(top + ink * FIG.neck), headRows = neck - top, bodyRows = bot - neck;
    var k = Math.min((H - 4) / (bodyRows + headRows * stg.head), (W - 4) / Math.max(SW * 0.78 * stg.width, SW * 0.66 * stg.head * Math.sqrt(stg.width)));
    var bw = SW * k * stg.width, bh = bodyRows * k, bx = (W - bw) / 2, by = H - 2 - bh;
    x.drawImage(c, 0, neck, SW, bodyRows, bx, by, bw, bh);
    var hk = k * stg.head, hw = SW * hk * Math.sqrt(stg.width), hh = headRows * hk;
    x.drawImage(c, 0, top, SW, headRows, (W - hw) / 2, by + k * ink * 0.012 - hh, hw, hh);
    return { mode: "hi", stage: stg, k: +k.toFixed(3), v153: true };
  }
  function drawCharacter(cv, kd, age) {
    var k = kitFromData(kd), res = null;
    var K = { j: k.U.j, p: k.U.p, t: k.U.t, pat: k.U.pat, hs: k.H ? k.H.s : null, hst: k.H ? k.H.st : null, hf: k.H ? k.H.f : null };
    try {
      figLoad();
      res = figDraw(cv, age || 22, K);
      if (res) { FIG.drawn++; FIG.last = K; return res; }
      // the art is still on its way: the growth screen's figure now, the card's own the moment it lands
      if (cv && !cv.__v153wait) { cv.__v153wait = 1; FIG.waiting.push(function () { cv.__v153wait = 0; if (cv.isConnected) drawCharacter(cv, kd, age); }); }
      var G = window.__GROW_V132; if (!cv || !G || !G.draw) return null;
      res = G.draw(cv, age || 22, [k.U.j, k.U.p]);
    } catch (e) { V.charErr = String(e && e.message || e); }
    return res;
  }
  window.__V153E = Object.assign(window.__V153E || {}, { fig: FIG, shadeKit: shadeKit, figCell: figCell });
  try { figLoad(); } catch (e) {}

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
      careers: A.careers, bank: { pp: A.pp, honors: A.honors, medals: A.medals },
      titles: A.titles, rings: A.rings, mvps: A.mvps, awards: A.awards, hof: A.hof, uffTitles: A.uffTitles, interstellarTitles: A.interstellarTitles,
      titlesByLevel: A.byLevel, gen: A.gen, surname: String(A.surname || "").slice(0, 24), bestScore: A.bestScore, careerScore: A.careerScore || 0,
      teamStyle: { unlocked: ts.unlocked, total: ts.total, all: ts.all },
      achievements: Object.keys(load().ach),
      cosmetics: { title: equipped("title"), badge: equipped("badge"), nameplate: equipped("nameplate"), icon: equipped("icon"), frame: equipped("frame"), banner: equipped("banner"), shelf: equipped("shelf"), uniform: equipped("uniform"), helmet: equipped("helmet"), recap: equipped("recap"), kit: kitData(),
        trail: equipped("trail"), wings: equipped("wings"), crown: equipped("crown"), aura: equipped("aura"), numfont: equipped("numfont") }   // v153 G
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
        ["CAREERS", num(d.careers)], ["BANK", num(d.bank && d.bank.pp) + " PP"], d.bank && d.bank.medals != null ? ["MEDALS", num(d.bank.medals)] : ["HONORS", num(d.bank && d.bank.honors)] /* v156 A */,
        ["LOGOS & COLOURS", d.teamStyle ? (d.teamStyle.all ? "ALL" : (d.teamStyle.unlocked | 0) + "/" + (d.teamStyle.total | 0)) : "—"], ["BEST SCORE", num(d.bestScore)], ["UFF · ISL", (d.uffTitles | 0) + " · " + (d.interstellarTitles | 0)]
      ].map(function (q) { return "<div><b>" + escHtml(q[1]) + "</b><small>" + q[0] + "</small></div>"; }).join("") + "</div>") +
      "</div>";
    if (el) {
      el.innerHTML = html;
      var cv = el.querySelector(".pc-cv-v151b");
      var draw = function () { var r = drawCharacter(cv, cz.kit || {}, d.age || 22); if (r && r.mode !== "hi" && !draw._again) { draw._again = 1; setTimeout(draw, 700); } };
      if (cv) draw();
      if (cv) cardFlairV153G(cv, cz);   // v153 G: aura + wings behind the figure, the crown on his head (its own layers)
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
      /* v153 E: a lit studio wall behind him (a dark kit on the old near-black box vanished) and a thin rim light round the figure */
      ".pc-fig-v151b{flex:none;width:92px;height:116px;border-radius:12px;background:radial-gradient(ellipse 80% 62% at 50% 40%,#6d7c93 0%,#435066 38%,#212a38 72%,#141a24 100%);border:1px solid rgba(255,255,255,.16);box-shadow:0 0 0 1px rgba(0,0,0,.5),0 4px 10px rgba(0,0,0,.45);display:grid;place-items:end center;overflow:hidden}",
      ".pc-cv-v151b{width:92px;height:115px;image-rendering:auto;filter:drop-shadow(0 0 1px rgba(255,255,255,.55)) drop-shadow(0 2px 3px rgba(0,0,0,.55))}",
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

  /* ===== v153 G THE FULL LOCKER — footprints, wings, crowns, auras, number fonts; more jerseys, helmets, frames, celebrations =====
   * The owner asked for a major expansion of what a player can wear and earn: more kits and shells, more card frames and
   * touchdown celebrations, and five NEW kinds worn on HIM —
   *   trail    footprints behind him on the live field while he moves (flame, frost, gold sparks, lightning, stardust, smoke,
   *            rainbow, 8-bit, petals, comet, afterimage) — one Graphics under the players (depth 3.9), drawn per frame
   *   wings    a pair of procedurally drawn pixel-art wings (angel, seraph, bat, crystal, phoenix, mech, 8-bit, monarch) on
   *            his back — two images in his marker's container, behind the body facing the camera, over it facing away
   *   crown    on his head (crown, royal crown, halo, laurel, circlet, horns, crown of fire, star circlet)
   *   aura     a soft glow he stands in (glow, pulse, heat haze, frost, void)
   *   numfont  the face and colour of HIS jersey number on the field (varsity, block, stencil, gold, neon, chrome, retro)
   * All five are drawn from code (canvas rasters registered as textures once per look) — no new art files — at one pixel per
   * sprite pixel, so they scale with his sprite (age, perspective) exactly as the kit does.
   *
   * THE HOOK. src/05 `placeMarker` calls `cosFxV153G(scene, m, p)` for the you-marker (and once more for a marker that stops
   * being him, to take his flair off): `fieldFx` below. With nothing equipped it returns at the first line and draws nothing.
   * It reads only the marker's drawn state (position, scale, texture, facing) and writes only its own objects: no sim value,
   * no TU() number the sim reads, and not one Math.random — the particles' jitter is an integer hash of the point's sequence
   * number, the flap and the flicker are sines of the scene clock. v151Bcheck's seeded games stay identical with all of it on.
   * The profile card wears wings / crown / aura as two extra canvases around the figure (`cardFlairV153G`), never inside
   * drawCharacter. `window.__V153G` is what v153Gcheck reads. */
  var FLAIR_CATS_V153G = { trail: 1, wings: 1, crown: 1, aura: 1, numfont: 1 };
  var PAT_CARD_V153G = { chevron: "yoke", stripes: "pinstripe", shoulders: "yoke", checker: "camo", sash: "split", tiger: "hoops" };
  var G153 = (window.__V153G = window.__V153G || { fx: { frames: 0, trail: 0, wings: 0, crown: 0, aura: 0, numfont: 0, ghosts: 0, cleared: 0 }, lastTrail: null, card: null, previews: 0, freeze: false, errs: [] });
  function errV153G(e) { try { if (G153.errs.length < 8) G153.errs.push(String((e && e.message) || e)); } catch (x) {} }

  /* ---- the catalogue (hoisted: ITEMS takes it before the packs are built) ---- */
  function itemsV153G() {
    return [
      // JERSEYS — the new patterns (chevron, stripes, shoulders, checker, sash, tiger) and new palettes
      { id: "uni_alt_charcoal", cat: "uniform", name: "Charcoal Alternate", rarity: "common", source: "free", k: { j: "#2b2f36", p: "#2b2f36", t: "#f0bb45", pat: "shoulders" } },
      { id: "uni_cream_stripes", cat: "uniform", name: "Cream Throwback", rarity: "common", source: "free", k: { j: "#efe6cf", p: "#8a1c2b", t: "#8a1c2b", pat: "stripes" } },
      { id: "uni_practice", cat: "uniform", name: "Practice Mesh", rarity: "common", source: "free", k: { j: "#d9dde3", p: "#2a2f38", t: "#9aa3ad", pat: "checker" } },
      { id: "uni_teal_stripes", cat: "uniform", name: "Teal Stripes", rarity: "common", source: "free", k: { j: "#127a74", p: "#e8e8e8", t: "#e8e8e8", pat: "stripes" } },
      { id: "uni_crimson_chev", cat: "uniform", name: "Crimson Chevron", rarity: "rare", source: "free", k: { j: "#9e1b25", p: "#f0f0f0", t: "#f0f0f0", pat: "chevron" } },
      { id: "uni_glacier_sash", cat: "uniform", name: "Glacier Sash", rarity: "rare", source: "free", k: { j: "#bfe6ff", p: "#1f3a5c", t: "#1f5fbf", pat: "sash" } },
      { id: "uni_tiger", cat: "uniform", name: "Tiger Stripe", rarity: "epic", source: "earned", ach: "td100", k: { j: "#e07a1f", p: "#1a1a1a", t: "#1a1a1a", pat: "tiger" } },
      { id: "uni_royal_chev", cat: "uniform", name: "Royal Chevron", rarity: "legendary", source: "earned", ach: "ring", k: { j: "#3b1f7a", p: "#f2efe6", t: "#e6c46a", pat: "chevron", ps: "#e6c46a" } },
      { id: "uni_mvp_white", cat: "uniform", name: "MVP White", rarity: "legendary", source: "earned", ach: "mvp", k: { j: "#f4f4f4", p: "#f4f4f4", t: "#d4af37", pat: "sash", ps: "#d4af37" } },
      { id: "uni_heritage", cat: "uniform", name: "Heritage Plaid", rarity: "epic", source: "earned", ach: "gen3", k: { j: "#7a2a2a", p: "#d9cfb8", t: "#1f3a2c", pat: "checker" } },
      { id: "uni_marble", cat: "uniform", name: "Marble Hall", rarity: "legendary", source: "earned", ach: "hof", k: { j: "#ece8df", p: "#1c1c1c", t: "#c9a13b", pat: "shoulders", ps: "#c9a13b" } },
      { id: "uni_nebula", cat: "uniform", name: "Nebula Fade", rarity: "mythic", source: "earned", ach: "interstellar", k: { j: "#2a1650", p: "#0b0716", t: "#9a7bff", pat: "fade", ps: "#9a7bff" } },
      // HELMETS — satin and pearl finishes, twin and wide stripes
      { id: "hel_satin_navy", cat: "helmet", name: "Satin Navy", rarity: "common", source: "free", h: { s: "#1a2a4a", st: "#c7d0de", f: "satin" } },
      { id: "hel_twin_red", cat: "helmet", name: "Twin Stripe Red", rarity: "common", source: "free", h: { s: "#b3121f", st: "#ffffff", sk: "twin", f: "gloss" } },
      { id: "hel_wide_gold", cat: "helmet", name: "Wide Gold Stripe", rarity: "common", source: "free", h: { s: "#1b1d22", st: "#d4af37", sk: "wide", f: "matte" } },
      { id: "hel_camo_matte", cat: "helmet", name: "Olive Drab", rarity: "common", source: "free", h: { s: "#4c5a3a", st: "#2a3122", f: "matte" } },
      { id: "hel_pearl", cat: "helmet", name: "Pearl", rarity: "rare", source: "free", h: { s: "#e8e4f0", st: "#6a5acd", f: "pearl" } },
      { id: "hel_emerald", cat: "helmet", name: "Emerald Metallic", rarity: "rare", source: "earned", ach: "ring", h: { s: "#0f6b45", st: "#e6e6e6", f: "metal" } },
      { id: "hel_ruby", cat: "helmet", name: "Ruby Chrome", rarity: "epic", source: "earned", ach: "td100", h: { s: "#9e1b25", f: "chrome", d: "#ffffff", dk: "star" } },
      { id: "hel_heritage", cat: "helmet", name: "Heritage Leather", rarity: "epic", source: "earned", ach: "gen3", h: { s: "#6b4226", st: "#e8dcc0", sk: "twin", f: "matte" } },
      { id: "hel_marble", cat: "helmet", name: "Marble Pearl", rarity: "legendary", source: "earned", ach: "hof", h: { s: "#ece8df", st: "#c9a13b", f: "pearl", d: "#c9a13b", dk: "star" } },
      // CARD FRAMES
      { id: "frame_neon", cat: "frame", name: "Neon Sign", rarity: "common", source: "free", css: "neon" },
      { id: "frame_wood", cat: "frame", name: "Hardwood", rarity: "common", source: "free", css: "wood" },
      { id: "frame_frost", cat: "frame", name: "Frostbite", rarity: "rare", source: "free", css: "frost" },
      { id: "frame_circuit", cat: "frame", name: "Circuit Board", rarity: "rare", source: "free", css: "circuit" },
      { id: "frame_emerald", cat: "frame", name: "Emerald", rarity: "epic", source: "earned", ach: "ring", css: "emerald" },
      { id: "frame_royal", cat: "frame", name: "Royal Purple", rarity: "epic", source: "earned", ach: "gen3", css: "royal" },
      { id: "frame_lava", cat: "frame", name: "Molten", rarity: "epic", source: "earned", ach: "uff", css: "lava", anim: 1 },
      { id: "frame_holo", cat: "frame", name: "Holographic", rarity: "legendary", source: "earned", ach: "mvp", css: "holo", anim: 1 },
      { id: "frame_angel", cat: "frame", name: "Heaven's Gate", rarity: "legendary", source: "earned", ach: "td100", css: "angel", anim: 1 },
      { id: "frame_void", cat: "frame", name: "The Void", rarity: "mythic", source: "earned", ach: "interstellar", css: "void" },
      // TOUCHDOWN CELEBRATIONS — seven new kinds (CEL_V153G)
      { id: "cel_shock", cat: "celebration", name: "Shockwave", rarity: "common", source: "free", c: { kind: "shock", col: ["#ffffff", "#8fe3ff", "#bfe6ff"], say: "BOOM" } },
      { id: "cel_snow", cat: "celebration", name: "Snow Globe", rarity: "rare", source: "free", c: { kind: "snow", col: ["#ffffff", "#d6ecff", "#bfe6ff"], say: "ICE COLD" } },
      { id: "cel_pixel", cat: "celebration", name: "8-Bit Burst", rarity: "rare", source: "free", c: { kind: "pixel", col: ["#ff3d7f", "#18c3b8", "#ffd76f", "#6fd3ff"], say: "1UP" } },
      { id: "cel_meteor", cat: "celebration", name: "Meteor Shower", rarity: "epic", source: "earned", ach: "uff", c: { kind: "meteor", col: ["#ffb02e", "#fff3c4", "#ff5a1a"], say: "IMPACT" } },
      { id: "cel_rainbow", cat: "celebration", name: "Over the Rainbow", rarity: "epic", source: "earned", ach: "gen3", c: { kind: "rainbow", col: ["#ff4d4d", "#ffa94d", "#ffe14d", "#4dd97a", "#4da6ff", "#9a6bff"], say: "FAMILY BUSINESS" } },
      { id: "cel_halo", cat: "celebration", name: "Halo Ring", rarity: "legendary", source: "earned", ach: "mvp", c: { kind: "halo", col: ["#ffe98a", "#ffffff", "#ffd76f"], say: "HOLY" } },
      { id: "cel_feathers", cat: "celebration", name: "Angel Descends", rarity: "legendary", source: "earned", ach: "hof", c: { kind: "feathers", col: ["#ffffff", "#fff3c4", "#ffd76f"], say: "HEAVEN SENT" } },
      // FOOTPRINTS — the trail behind him on the live field
      { id: "trail_none", cat: "trail", name: "Clean Cleats", rarity: "common", source: "free", tr: null, blurb: "No trail." },
      { id: "trail_dust", cat: "trail", name: "Turf Dust", rarity: "common", source: "free", tr: { kind: "smoke", col: ["#b8a27a", "#8a7a5a"] } },
      { id: "trail_sparks", cat: "trail", name: "Gold Sparks", rarity: "common", source: "free", tr: { kind: "sparks", col: ["#ffd76f", "#fff3c4", "#e6b53a"] } },
      { id: "trail_pixel", cat: "trail", name: "8-Bit Steps", rarity: "rare", source: "free", tr: { kind: "pixels", col: ["#ff3d7f", "#18c3b8", "#ffd76f", "#6fd3ff"] } },
      { id: "trail_frost", cat: "trail", name: "Frost Steps", rarity: "rare", source: "free", tr: { kind: "ice", col: ["#ffffff", "#bfe6ff", "#7fb2ff"] } },
      { id: "trail_comet", cat: "trail", name: "Golden Comet", rarity: "rare", source: "earned", ach: "title", tr: { kind: "comet", col: ["#ffd76f", "#fff3c4"] } },
      { id: "trail_petals", cat: "trail", name: "Petals", rarity: "rare", source: "earned", ach: "ring", tr: { kind: "petals", col: ["#ffb3c7", "#ff7aa2", "#fff0f5"] } },
      { id: "trail_flame", cat: "trail", name: "Scorched Cleats", rarity: "epic", source: "earned", ach: "td100", tr: { kind: "flame", col: ["#fff3a0", "#ffb02e", "#ff5a1a", "#b8200f"] } },
      { id: "trail_lightning", cat: "trail", name: "Storm Chaser", rarity: "epic", source: "earned", ach: "uff", tr: { kind: "lightning", col: ["#ffffff", "#bfe6ff", "#7fb2ff"] } },
      { id: "trail_rainbow", cat: "trail", name: "Rainbow Road", rarity: "epic", source: "earned", ach: "gen3", tr: { kind: "rainbow", col: ["#ff4d4d", "#ffa94d", "#ffe14d", "#4dd97a", "#4da6ff", "#9a6bff"] } },
      { id: "trail_ghost", cat: "trail", name: "Afterimage", rarity: "legendary", source: "earned", ach: "mvp", tr: { kind: "ghost", col: ["#8fe3ff"] } },
      { id: "trail_stars", cat: "trail", name: "Stardust", rarity: "mythic", source: "earned", ach: "interstellar", tr: { kind: "stars", col: ["#ffffff", "#ffe98a", "#b9a6ff"] } },
      { id: "trail_founder", cat: "trail", name: "Founder's Comet", rarity: "mythic", source: "founder", tr: { kind: "comet", col: ["#e6c46a", "#fff0c8"] } },
      // WINGS
      { id: "wings_none", cat: "wings", name: "No Wings", rarity: "common", source: "free", w: null },
      { id: "wings_practice", cat: "wings", name: "Practice Wings", rarity: "common", source: "free", w: { kind: "pixel", col: ["#e8edf4", "#9aa3b2", "#2a3240"] } },
      { id: "wings_monarch", cat: "wings", name: "Monarch", rarity: "rare", source: "free", w: { kind: "monarch", col: ["#ff9a1f", "#1a1a1a", "#ffffff"] } },
      { id: "wings_crystal", cat: "wings", name: "Ice Crystal", rarity: "epic", source: "earned", ach: "ring", w: { kind: "crystal", col: ["#dff4ff", "#8fd0ff", "#2a5f8f"] } },
      { id: "wings_bat", cat: "wings", name: "Night Wings", rarity: "epic", source: "earned", ach: "gen3", w: { kind: "bat", col: ["#2a1a2e", "#6a1f3a", "#0d0810"] } },
      { id: "wings_mech", cat: "wings", name: "Mech Wings", rarity: "epic", source: "earned", ach: "uff", w: { kind: "mech", col: ["#b8c0cc", "#4a5260", "#6ff7ff"] } },
      { id: "wings_angel", cat: "wings", name: "Angel Wings", rarity: "legendary", source: "earned", ach: "hof", w: { kind: "angel", col: ["#ffffff", "#d6dde8", "#6b7488"] } },
      { id: "wings_phoenix", cat: "wings", name: "Phoenix", rarity: "legendary", source: "earned", ach: "mvp", w: { kind: "flame", col: ["#ffe14d", "#ff7a1a", "#a8180a"] } },
      { id: "wings_seraph", cat: "wings", name: "Seraph", rarity: "mythic", source: "earned", ach: "interstellar", w: { kind: "seraph", col: ["#fff8e0", "#f0c850", "#8a6414"] } },
      { id: "wings_founder", cat: "wings", name: "Founder's Wings", rarity: "mythic", source: "founder", w: { kind: "seraph", col: ["#23262e", "#e6c46a", "#0d0f14"] } },
      // CROWNS
      { id: "crown_none", cat: "crown", name: "Bare Helmet", rarity: "common", source: "free", cr: null },
      { id: "crown_laurel", cat: "crown", name: "Laurel", rarity: "common", source: "free", cr: { kind: "laurel", col: ["#5fae4a", "#2f6b2a", "#1a3a14"] } },
      { id: "crown_circlet", cat: "crown", name: "Silver Circlet", rarity: "common", source: "free", cr: { kind: "circlet", col: ["#d9dee6", "#6fd3ff", "#4a5260"] } },
      { id: "crown_gold", cat: "crown", name: "Champion's Crown", rarity: "epic", source: "earned", ach: "title", cr: { kind: "crown", col: ["#f0bb45", "#c8102e", "#6b4a0e"] } },
      { id: "crown_horns", cat: "crown", name: "Horns", rarity: "epic", source: "earned", ach: "gen3", cr: { kind: "horns", col: ["#e8dcc0", "#3a1016", "#12060a"] } },
      { id: "crown_king", cat: "crown", name: "Crown of the League", rarity: "legendary", source: "earned", ach: "ring", cr: { kind: "king", col: ["#ffd76f", "#1f5fbf", "#6b4a0e"] } },
      { id: "crown_halo", cat: "crown", name: "Halo", rarity: "legendary", source: "earned", ach: "hof", cr: { kind: "halo", col: ["#ffe98a", "#ffffff", "#c9951f"] } },
      { id: "crown_flame", cat: "crown", name: "Crown of Fire", rarity: "legendary", source: "earned", ach: "td100", cr: { kind: "flame", col: ["#fff3a0", "#ffb02e", "#ff3b1a"] } },
      { id: "crown_mvp", cat: "crown", name: "Golden Laurel", rarity: "legendary", source: "earned", ach: "mvp", cr: { kind: "laurel", col: ["#ffd76f", "#b8903a", "#5a4210"] } },
      { id: "crown_star", cat: "crown", name: "Star Circlet", rarity: "mythic", source: "earned", ach: "interstellar", cr: { kind: "star", col: ["#b9a6ff", "#ffffff", "#2a1a5a"] } },
      { id: "crown_founder", cat: "crown", name: "Founder's Crown", rarity: "mythic", source: "founder", cr: { kind: "king", col: ["#e6c46a", "#0d0f14", "#6b4a0e"] } },
      // AURAS
      { id: "aura_none", cat: "aura", name: "No Aura", rarity: "common", source: "free", au: null },
      { id: "aura_glow", cat: "aura", name: "Soft Glow", rarity: "common", source: "free", au: { kind: "glow", col: "#fff3c4" } },
      { id: "aura_team", cat: "aura", name: "Team Glow", rarity: "common", source: "free", au: { kind: "glow", col: "team" } },
      { id: "aura_frost", cat: "aura", name: "Frost", rarity: "rare", source: "free", au: { kind: "frost", col: "#8fd0ff" } },
      { id: "aura_gold", cat: "aura", name: "Golden Aura", rarity: "epic", source: "earned", ach: "title", au: { kind: "pulse", col: "#ffd76f" } },
      { id: "aura_flame", cat: "aura", name: "Heat Haze", rarity: "epic", source: "earned", ach: "td100", au: { kind: "flicker", col: "#ff7a1a" } },
      { id: "aura_holy", cat: "aura", name: "Holy Light", rarity: "legendary", source: "earned", ach: "hof", au: { kind: "pulse", col: "#ffffff" } },
      { id: "aura_void", cat: "aura", name: "Void", rarity: "mythic", source: "earned", ach: "interstellar", au: { kind: "void", col: "#7a3aff" } },
      { id: "aura_founder", cat: "aura", name: "Founder's Glow", rarity: "mythic", source: "founder", au: { kind: "pulse", col: "#e6c46a" } },
      // NUMBER FONTS — his jersey number on the field
      { id: "nf_team", cat: "numfont", name: "Team Numbers", rarity: "common", source: "free", nf: null, blurb: "The league's own numbers." },
      { id: "nf_varsity", cat: "numfont", name: "Varsity Serif", rarity: "common", source: "free", nf: nfStyleV153G("varsity") },
      { id: "nf_block", cat: "numfont", name: "Block", rarity: "common", source: "free", nf: nfStyleV153G("block") },
      { id: "nf_stencil", cat: "numfont", name: "Stencil", rarity: "rare", source: "free", nf: nfStyleV153G("stencil") },
      { id: "nf_gold", cat: "numfont", name: "Gold Foil", rarity: "epic", source: "earned", ach: "title", nf: nfStyleV153G("gold") },
      { id: "nf_neon", cat: "numfont", name: "Neon", rarity: "epic", source: "earned", ach: "uff", nf: nfStyleV153G("neon") },
      { id: "nf_chrome", cat: "numfont", name: "Chrome", rarity: "legendary", source: "earned", ach: "mvp", nf: nfStyleV153G("chrome") },
      { id: "nf_founder", cat: "numfont", name: "Founder's Serif", rarity: "mythic", source: "founder", nf: { style: "founder", font: "Georgia, 'Times New Roman', serif", col: "#e6c46a", stroke: "#0d0f14" } }
    ];
  }
  function nfStyleV153G(st) {
    var S = {
      varsity: { font: "Georgia, 'Times New Roman', serif", col: "#ffffff", stroke: "#1b1406" },
      block: { font: "Impact, 'Arial Black', sans-serif", col: "#ffffff", stroke: "#0a0e14" },
      stencil: { font: "'Courier New', Courier, monospace", col: "#f0e6c8", stroke: "#2a2a2a" },
      gold: { font: "Georgia, 'Times New Roman', serif", col: "#ffd76f", stroke: "#5a3d08" },
      neon: { font: "Oswald, sans-serif", col: "#6ff7ff", stroke: "#ff3df2" },
      chrome: { font: "Impact, 'Arial Black', sans-serif", col: "#e6ecf5", stroke: "#4a5260" },
      retro: { font: "'Trebuchet MS', Verdana, sans-serif", col: "#ff9a1f", stroke: "#3a1a08" }
    };
    return S[st] ? Object.assign({ style: st }, S[st]) : null;
  }

  /* ---- the Career Pass's looks: each reward's `style` (src/29 names it) or, failing that, a pick by rarity ---- */
  var RIDX_V153G = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 3 };
  var JPALS_V153G = [["#1b2a4a", "#e9e6dc", "#c7d0de"], ["#8a1c2b", "#f0f0f0", "#f0f0f0"], ["#0f5a3a", "#e8e2cf", "#e6c46a"], ["#2b1a4a", "#1a1030", "#ff9ad5"], ["#e0602b", "#1a1a1a", "#ffffff"],
    ["#127a74", "#f0f0f0", "#ffb02e"], ["#16181c", "#16181c", "#57e07a"], ["#f4f4f4", "#1c2a44", "#c8102e"], ["#5c0f16", "#e8dcc0", "#e8dcc0"], ["#1e6fff", "#f5f5f5", "#ffd76f"],
    ["#3b1f7a", "#e9e6dc", "#e6c46a"], ["#4c5a3a", "#2a3122", "#d9cfb8"], ["#c9a13b", "#1a1a1a", "#1a1a1a"], ["#18c3b8", "#10283a", "#ffffff"], ["#b3121f", "#0d0f14", "#ffffff"],
    ["#2a2d33", "#2a2d33", "#ff5a1a"], ["#bfe6ff", "#0c1a33", "#1f5fbf"], ["#ff3d7f", "#12051f", "#6ff7ff"], ["#7a4b2a", "#e8dcc0", "#f0e6c8"], ["#0b2a3a", "#e8f6ff", "#6fd3ff"]];
  var HPALS_V153G = [["#0f2d5c", "#ffffff", "#ffffff"], ["#16181c", "#d4af37", "#d4af37"], ["#f1f3f5", "#1c2a44", "#c8102e"], ["#9e1b25", "#f4f4f4", "#ffffff"], ["#0f5a3a", "#e6c46a", "#e6c46a"],
    ["#3b2d7a", "#b9a6ff", "#ffffff"], ["#e0602b", "#1a1a1a", "#ffffff"], ["#18c3b8", "#10283a", "#ffffff"], ["#c9a13b", "#1a1a1a", "#1a1a1a"], ["#2a2d33", "#6ff7ff", "#6ff7ff"],
    ["#e8e4f0", "#6a5acd", "#6a5acd"], ["#bfe6ff", "#1f5fbf", "#ffffff"]];
  var POOLS_V153G = {
    jersey: [["hoops", "sleeves", "yoke", "chest", "stripes"], ["pinstripe", "shoulders", "checker", "split"], ["chevron", "sash", "fade", "camo"], ["tiger", "chevron", "sash", "fade"]],
    helmet: [["gloss", "matte"], ["satin", "gloss"], ["metal", "pearl"], ["chrome", "pearl"]],
    trail: [["sparks", "smoke", "pixels"], ["ice", "petals", "stars"], ["flame", "rainbow", "comet"], ["lightning", "ghost", "comet", "flame"]],
    wings: [["pixel", "monarch"], ["monarch", "crystal", "bat"], ["angel", "crystal", "mech", "flame"], ["seraph", "flame", "angel"]],
    crown: [["laurel", "circlet"], ["circlet", "horns", "star"], ["crown", "flame", "halo"], ["king", "halo", "flame"]],
    aura: [["glow"], ["glow", "frost"], ["pulse", "flicker"], ["pulse", "void"]],
    numfont: [["varsity", "block"], ["stencil", "retro"], ["neon", "gold"], ["chrome", "gold"]],
    frame: [["steel", "wood", "neon"], ["carbon", "frost", "circuit"], ["diamond", "emerald", "royal", "lava"], ["gold", "holo", "angel"]],
    celebration: [["spot", "shock", "pixel"], ["stars", "snow", "shock"], ["fireworks", "meteor", "rainbow"], ["rain", "feathers", "halo"]]
  };
  var VARS_V153G = {
    trail: { flame: [["#fff3a0", "#ffb02e", "#ff5a1a", "#b8200f"], ["#e0f7ff", "#6fd3ff", "#1f6fff", "#0c2a66"], ["#f0ffd0", "#9dff6f", "#2fbf4a", "#0f5a2a"]],
      ice: [["#ffffff", "#bfe6ff", "#7fb2ff"], ["#ffffff", "#d7c9ff", "#9a7bff"]], sparks: [["#ffd76f", "#fff3c4", "#e6b53a"], ["#ffffff", "#c9d6ff", "#8fb4ff"], ["#ff9ad5", "#ffd6f0", "#ff3df2"]],
      lightning: [["#ffffff", "#bfe6ff", "#7fb2ff"], ["#fff6c0", "#ffd76f", "#ff9a1f"], ["#ffffff", "#e0b8ff", "#9a4bff"]], stars: [["#ffffff", "#ffe98a", "#b9a6ff"], ["#ffffff", "#8fe3ff", "#ff9ad5"]],
      smoke: [["#c9ced6", "#8a93a0"], ["team", "#ffffff"], ["#b99bff", "#6a4cc2"]], rainbow: [["#ff4d4d", "#ffa94d", "#ffe14d", "#4dd97a", "#4da6ff", "#9a6bff"]],
      pixels: [["#ff3d7f", "#18c3b8", "#ffd76f", "#6fd3ff"], ["#57e07a", "#b8ff6f", "#1f8a4a", "#e8ffe0"]], petals: [["#ffb3c7", "#ff7aa2", "#fff0f5"], ["#fff3c4", "#ffd76f", "#ffffff"]],
      ghost: [["#8fe3ff"], ["#ff9ad5"], ["#ffd76f"]], comet: [["#ffd76f", "#fff3c4"], ["#6ff7ff", "#ffffff"], ["#ff5a5a", "#ffd0c0"]] },
    wings: { angel: [["#ffffff", "#d6dde8", "#6b7488"]], seraph: [["#fff8e0", "#f0c850", "#8a6414"], ["#ffffff", "#bfe6ff", "#3a6f9a"]],
      bat: [["#2a1a2e", "#6a1f3a", "#0d0810"], ["#1a2430", "#2f6b5a", "#060a0e"]], crystal: [["#dff4ff", "#8fd0ff", "#2a5f8f"], ["#f0e0ff", "#b98bff", "#4a2a8a"], ["#e0ffe8", "#6fdf9a", "#1f6b3a"]],
      flame: [["#ffe14d", "#ff7a1a", "#a8180a"], ["#e0f7ff", "#4da6ff", "#0c2a66"]], mech: [["#b8c0cc", "#4a5260", "#6ff7ff"], ["#d9b24a", "#5a4210", "#ff5a5a"]],
      pixel: [["#e8edf4", "#9aa3b2", "#2a3240"], ["#ffd76f", "#c9951f", "#3a2a08"]], monarch: [["#ff9a1f", "#1a1a1a", "#ffffff"], ["#4da6ff", "#0c1a33", "#e8f6ff"], ["#ff5aa0", "#2a0a1a", "#ffe0f0"]] },
    crown: { crown: [["#f0bb45", "#c8102e", "#6b4a0e"], ["#d9dee6", "#1f5fbf", "#4a5260"]], king: [["#ffd76f", "#1f5fbf", "#6b4a0e"], ["#ffd76f", "#c8102e", "#6b4a0e"]],
      halo: [["#ffe98a", "#ffffff", "#c9951f"], ["#bfe6ff", "#ffffff", "#3a7fbf"]], laurel: [["#5fae4a", "#2f6b2a", "#1a3a14"], ["#ffd76f", "#b8903a", "#5a4210"]],
      circlet: [["#d9dee6", "#6fd3ff", "#4a5260"], ["#f0bb45", "#3fbf7f", "#6b4a0e"]], horns: [["#e8dcc0", "#3a1016", "#12060a"], ["#ff5a1a", "#5c0f16", "#1a0508"]],
      flame: [["#fff3a0", "#ffb02e", "#ff3b1a"], ["#e0f7ff", "#6fd3ff", "#1f6fff"]], star: [["#b9a6ff", "#ffffff", "#2a1a5a"], ["#ffd76f", "#ffffff", "#5a4210"]] },
    aura: { glow: ["#fff3c4", "#bfe6ff", "team"], pulse: ["#ffd76f", "#ffffff", "#ff9ad5"], flicker: ["#ff7a1a", "#4da6ff"], frost: ["#8fd0ff", "#d7c9ff"], void: ["#7a3aff", "#3fbf7f"] }
  };
  function passLookV153G(it, rw, h, c1, c2, rr) {
    try {
      var ri = RIDX_V153G[rr] || 0, k = rw.kind, st = typeof rw.style === "string" ? rw.style : "";
      var pick = function (kind, ok) { if (st && ok(st)) return st; var P = POOLS_V153G[kind][ri]; return P[(h >>> 3) % P.length]; };
      var vari = function (list) { return list[(h >>> 11) % list.length]; };
      if (k === "jersey") {
        var J = JPALS_V153G[h % JPALS_V153G.length], pat = pick("jersey", function (s) { return /^(hoops|pinstripe|split|fade|yoke|chest|sleeves|camo|chevron|stripes|shoulders|checker|sash|tiger)$/.test(s); });
        it.k = { j: J[0], p: J[1], t: J[2], pat: pat }; if (ri >= 2) it.k.ps = J[2];
      } else if (k === "helmet") {
        var Hp = HPALS_V153G[h % HPALS_V153G.length], fin = pick("helmet", function (s) { return /^(gloss|matte|satin|metal|pearl|chrome)$/.test(s); });
        it.h = { s: Hp[0], st: Hp[1], f: fin }; var sk = ["", "twin", "wide"][(h >>> 7) % 3]; if (sk) it.h.sk = sk;
        if (ri >= 1) { it.h.d = Hp[2]; it.h.dk = ri >= 2 ? "star" : "dot"; }
      } else if (k === "trail") { var tk = pick("trail", function (s) { return !!VARS_V153G.trail[s]; }); it.tr = { kind: tk, col: vari(VARS_V153G.trail[tk]).slice() }; }
      else if (k === "wings") { var wk = pick("wings", function (s) { return !!VARS_V153G.wings[s]; }); it.w = { kind: wk, col: vari(VARS_V153G.wings[wk]).slice() }; }
      else if (k === "crown") { var ck = pick("crown", function (s) { return !!VARS_V153G.crown[s]; }); it.cr = { kind: ck, col: vari(VARS_V153G.crown[ck]).slice() }; }
      else if (k === "aura") { var ak = pick("aura", function (s) { return !!VARS_V153G.aura[s]; }); it.au = { kind: ak, col: vari(VARS_V153G.aura[ak]) }; }
      else if (k === "numfont") { it.nf = nfStyleV153G(pick("numfont", function (s) { return !!nfStyleV153G(s); })); }
      else if (k === "frame") it.css = pick("frame", function (s) { return /^(steel|wood|neon|carbon|frost|circuit|diamond|emerald|royal|lava|gold|holo|angel)$/.test(s); });
      else if (k === "celebration" && it.c) it.c.kind = pick("celebration", function (s) { return /^(spot|shock|pixel|stars|snow|fireworks|meteor|rainbow|rain|feathers|halo)$/.test(s); });
      else if (k === "banner") {
        var bv = (h >>> 13) % 4;
        if (bv === 1) it.bg = "repeating-linear-gradient(135deg," + c1 + " 0 9px,#0b0f16 9px 18px)";
        else if (bv === 2) it.bg = "radial-gradient(circle at 50% 0," + c2 + " 0,transparent 62%),linear-gradient(135deg," + c1 + ",#0b0f16)";
        else if (bv === 3) it.bg = "linear-gradient(90deg," + c1 + " 0 50%," + c2 + " 50% 100%)";
      }
      if (it.cat === "celebration" && it.c && rr === "mythic") it.c.say = "SHOWCASE";
    } catch (e) { errV153G(e); }
  }

  /* ---- the new jersey patterns on the field sprite (kitDeco): x, y in texture pixels, `top` the collar row ---- */
  function patV153G(pat, xx, yy, top, cx, UJ, UT) {
    var r = yy - top, dx = Math.abs(xx - cx);
    if (pat === "chevron") return Math.abs(r - (5 - dx * 0.6)) < 0.75 ? UT : null;
    if (pat === "stripes") return ((xx >> 1) % 2 === 0) ? UT : null;
    if (pat === "shoulders") return r <= 3 && dx >= 3 ? UT : null;
    if (pat === "checker") return (((xx >> 1) + (yy >> 1)) % 2 === 0) ? mix(UJ, UT, 0.5) : null;
    if (pat === "sash") return Math.abs((xx - cx) - (r - 4) * 0.9) < 1.2 ? UT : null;
    if (pat === "tiger") return ((yy + Math.round(Math.sin(xx * 1.3) * 1.5)) % 4 === 0) ? UT : null;
    return null;
  }

  /* ---- a tiny raster (one pixel per sprite pixel, a 1px margin for the outline) ---- */
  function colRgb(hx) { if (hx === "team") hx = teamCol(0); return rgb(hexOk(hx) || "#ffffff"); }
  function colNum(hx) { if (hx === "team") hx = teamCol(0); hx = hexOk(hx) || "#ffffff"; return parseInt(hx.slice(1), 16); }
  function light(c, t) { return mix(c, [255, 255, 255], t); }
  function dark(c, t) { return mix(c, [0, 0, 0], t); }
  function Raster(W, H) { this.W = W + 2; this.H = H + 2; this.d = new Uint8ClampedArray(this.W * this.H * 4); }
  Raster.prototype.put = function (x, y, c, a) { x = Math.round(x) + 1; y = Math.round(y) + 1; if (x < 0 || y < 0 || x >= this.W || y >= this.H) return; var i = (y * this.W + x) * 4; this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = Math.round(255 * (a == null ? 1 : a)); };
  Raster.prototype.has = function (x, y) { x += 1; y += 1; if (x < 0 || y < 0 || x >= this.W || y >= this.H) return false; return this.d[(y * this.W + x) * 4 + 3] > 100; };
  Raster.prototype.outline = function (c, a) {
    var W = this.W, H = this.H, mark = [];
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) { if (this.d[(y * W + x) * 4 + 3]) continue; var X = x - 1, Y = y - 1; if (this.has(X - 1, Y) || this.has(X + 1, Y) || this.has(X, Y - 1) || this.has(X, Y + 1)) mark.push([X, Y]); }
    for (var i = 0; i < mark.length; i++) this.put(mark[i][0], mark[i][1], c, a == null ? 0.92 : a);
  };
  Raster.prototype.canvas = function () { var c = document.createElement("canvas"); c.width = this.W; c.height = this.H; var x = c.getContext("2d"), im = x.createImageData(this.W, this.H); im.data.set(this.d); x.putImageData(im, 0, 0); return c; };
  function ihV153G(a) { a = (a ^ 61) ^ (a >>> 16); a = a + (a << 3); a = a ^ (a >>> 4); a = Math.imul(a, 0x27d4eb2d); a = a ^ (a >>> 15); return (a >>> 0) / 4294967296; }

  /* ---- WINGS: the RIGHT wing, its shoulder at (ax, ay); the left one is the same image flipped ---- */
  var ART_V153G = {};
  /* a feathered wing: an arm rising from the shoulder to the wrist and drooping to the hand, the flight feathers hung
   * from it (longer and swept further out toward the tip), the coverts a scalloped band along the arm */
  function featherV153G(R, W, ay, o, cols) {
    var main = colRgb(cols[0]), sh = colRgb(cols[1]), edge = colRgb(cols[2]), tipC = o.tip ? colRgb(o.tip) : null;
    var arm = function (t) { return { x: t * (W - 2), y: ay - o.rise * Math.sin(Math.min(1, t / 0.62) * Math.PI / 2) + Math.max(0, t - 0.62) / 0.38 * o.rise * 0.3 }; };
    var colAt = function (t, f) { if (!o.grad) return main; return t < 0.4 ? mix(main, sh, t * 2) : mix(sh, edge, Math.min(1, (t - 0.4) * 1.4 + f * 0.3)); };
    var N = Math.max(4, Math.round(W / 2.2));
    for (var i = N - 1; i >= 0; i--) {
      var t = i / (N - 1), b = arm(t), L = o.len * (0.42 + 0.78 * Math.pow(t, 1.25)) + (o.ragged ? (ihV153G(i * 17 + o.ragged * 131) - 0.5) * 2.4 : 0);
      var ang = -0.2 + 0.85 * Math.pow(t, 1.1), dx = Math.sin(ang), dy = Math.cos(ang), n = Math.ceil(L);
      for (var k = 0; k <= n; k++) {
        var f = k / Math.max(1, n), px = b.x + dx * k, py = b.y + dy * k, c = colAt(t, f);
        if (k === n) c = tipC || (o.grad ? dark(c, 0.3) : sh);
        R.put(px, py, c); R.put(px - 1, py, f > 0.15 ? (o.grad ? dark(c, 0.18) : sh) : c);   // the feather's shaded trailing edge
        if (f < 0.35) R.put(px + 1, py, light(c, 0.12));
      }
    }
    // the coverts: a band along the arm, light on top, scalloped underneath
    for (var x = 0; x <= W - 2; x++) {
      var tt = x / (W - 2), a = arm(tt), band = Math.round(2 + 2.5 * (1 - tt));
      for (var y = Math.round(a.y); y <= Math.round(a.y) + band; y++) { var cc = colAt(tt, 0); R.put(x, y, y === Math.round(a.y) ? light(cc, o.grad ? 0.25 : 0.4) : cc); }
      if (x % 3 !== 1) R.put(x, Math.round(a.y) + band + 1, o.grad ? dark(colAt(tt, 0), 0.2) : sh);
    }
  }
  function wingArtV153G(w, frame) {
    w = w || { kind: "angel", col: ["#ffffff", "#d6dde8", "#6b7488"] };
    var key = "w|" + w.kind + "|" + (w.col || []).join(",") + "|" + (frame | 0);
    if (ART_V153G[key]) return ART_V153G[key];
    var cols = w.col || ["#ffffff", "#cccccc", "#555555"], K = w.kind, R, ay, x, y, W;
    if (K === "seraph") {
      W = 21; ay = 10; R = new Raster(W + 6, 27);
      featherV153G(R, W, ay, { rise: 9, len: 14, droop: 16, tipPull: 55, tip: cols[1] }, cols);
      R.outline(dark(colRgb(cols[2]), 0.35));
    } else if (K === "flame") {
      W = 18; ay = 8; R = new Raster(W + 5, 22);
      featherV153G(R, W, ay, { rise: 7, len: 11, droop: 14, tipPull: 45, grad: 1, ragged: 1 + (frame | 0) }, cols);
      R.outline(dark(colRgb(cols[2]), 0.5), 0.8);
    } else if (K === "pixel") {
      var S = new Raster(23, 22); featherV153G(S, 18, 8, { rise: 7, len: 11 }, cols);   // the angel, posterised to 2x2 blocks
      W = 18; ay = 8; R = new Raster(W + 6, 22);
      for (y = 0; y < 22; y += 2) for (x = 0; x < 23; x += 2) { var i0 = ((y + 1) * S.W + x + 1) * 4, i1 = ((y + 2) * S.W + x + 2) * 4, pick = S.d[i0 + 3] ? i0 : S.d[i1 + 3] ? i1 : -1;
        if (pick >= 0) { var c0 = [S.d[pick], S.d[pick + 1], S.d[pick + 2]]; R.put(x, y, c0); R.put(x + 1, y, c0); R.put(x, y + 1, c0); R.put(x + 1, y + 1, c0); } }
      R.outline(colRgb(cols[2]));
    } else if (K === "bat") {
      W = 20; ay = 6; R = new Raster(W, 18);
      var tipsX = [0, 6, 11, 15, 19], tipsY = [ay + 3, 12, 15, 13, 8], mem = colRgb(cols[1]), bone = colRgb(cols[0]);
      var topAt = function (x) { return x <= 8 ? ay - ay * (x / 8) : 2 * ((x - 8) / (W - 9)); };
      for (x = 0; x < W; x++) {
        var sg = 0; while (sg < tipsX.length - 2 && x > tipsX[sg + 1]) sg++;
        var fr = (x - tipsX[sg]) / Math.max(1, tipsX[sg + 1] - tipsX[sg]), base = tipsY[sg] + (tipsY[sg + 1] - tipsY[sg]) * fr, bot2 = Math.round(base - 2.6 * Math.sin(Math.PI * fr)), t2 = Math.round(topAt(x));
        for (y = t2; y <= bot2; y++) R.put(x, y, mix(mem, colRgb(cols[2]), Math.max(0, (y - t2) / Math.max(1, bot2 - t2)) * 0.45));
      }
      var line = function (x0, y0, x1, y1, c) { var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0; for (var k = 0; k <= n; k++) R.put(x0 + (x1 - x0) * k / Math.max(1, n), y0 + (y1 - y0) * k / Math.max(1, n), c); };
      line(0, ay, 8, 0, bone); line(8, 0, W - 1, 2, bone);
      for (var f = 1; f < tipsX.length; f++) line(8, 0, tipsX[f], tipsY[f] - 1, dark(bone, 0.1));
      R.put(8, -1, light(bone, 0.5));
      R.outline(colRgb(cols[2]));
    } else if (K === "crystal") {
      W = 20; ay = 9; R = new Raster(W, 22);
      var shards = [[-55, 14, 2.3], [-25, 19, 2.7], [5, 17, 2.5], [35, 11, 2.1]], cl = colRgb(cols[0]), cm = colRgb(cols[1]);
      for (y = -1; y < 22; y++) for (x = 0; x < W; x++) for (var q = 0; q < shards.length; q++) {
        var an = shards[q][0] * Math.PI / 180, L = shards[q][1], dxs = x - 0.5, dys = y - ay, t = dxs * Math.cos(an) + dys * Math.sin(an), d = -dxs * Math.sin(an) + dys * Math.cos(an);
        if (t < 0 || t > L) continue;
        var wd = shards[q][2] * (1 - t / L) * Math.min(1, t / 2 + 0.4);
        if (Math.abs(d) <= wd + 0.3) { var cc = d < 0 ? cl : cm; if (t > L - 2.5) cc = light(cc, 0.5); R.put(x, y, cc); break; }
      }
      R.outline(colRgb(cols[2]));
    } else if (K === "mech") {
      W = 20; ay = 7; R = new Raster(W, 18);
      var ml = colRgb(cols[0]), md = colRgb(cols[1]), glow = colRgb(cols[2]);
      for (var pk = 0; pk < 5; pk++) {
        var L2 = W - 1 - pk * 3, y0 = 2 + pk * 3;
        for (x = 0; x <= L2; x++) { var yy2 = y0 - Math.round((x / W) * 4) + (pk > 2 ? Math.round(x / W * 2) : 0); R.put(x, yy2, light(ml, 0.15)); R.put(x, yy2 + 1, x === L2 ? glow : md); }
        R.put(L2, y0 - Math.round((L2 / W) * 4) + (pk > 2 ? Math.round(L2 / W * 2) : 0), glow);
      }
      for (y = 2; y < 15; y++) R.put(0, y, md);
      R.outline([16, 20, 24]);
    } else if (K === "monarch") {
      W = 18; ay = 8; R = new Raster(W, 20);
      var ob = colRgb(cols[0]), vein = colRgb(cols[1]), dotc = colRgb(cols[2]);
      for (y = 0; y < 20; y++) for (x = 0; x < W; x++) {
        var e1 = Math.pow((x - 9) / 8.5, 2) + Math.pow((y - 5) / 5.5, 2), e2 = Math.pow((x - 6) / 5.5, 2) + Math.pow((y - 13) / 5, 2), e = Math.min(e1, e2);
        if (e > 1) continue;
        var c3 = ob; if (e > 0.62) c3 = (e > 0.7 && (x * 3 + y) % 4 === 0) ? dotc : vein; else if ((x * 2 + y) % 6 === 0 && x > 1) c3 = vein;
        R.put(x, y, c3);
      }
      R.outline(vein);
    } else {   // angel
      W = 18; ay = 8; R = new Raster(W + 5, 22);
      featherV153G(R, W, ay, { rise: 7, len: 11, droop: 14, tipPull: 45 }, cols);
      R.outline(colRgb(cols[2]));
    }
    var cv = R.canvas();
    return (ART_V153G[key] = { key: key, cv: cv, ax: 1, ay: ay + 1, w: cv.width, h: cv.height });
  }

  /* ---- CROWNS: anchored at the bottom centre (the row that sits on his head) ---- */
  function crownArtV153G(cr, frame) {
    cr = cr || { kind: "crown", col: ["#f0bb45", "#c8102e", "#6b4a0e"] };
    var key = "c|" + cr.kind + "|" + (cr.col || []).join(",") + "|" + (frame | 0);
    if (ART_V153G[key]) return ART_V153G[key];
    var cols = cr.col || ["#f0bb45", "#c8102e", "#6b4a0e"], K = cr.kind, a = colRgb(cols[0]), b = colRgb(cols[1]), e = colRgb(cols[2]), R, x, y, W, H;
    var spike = function (cx, tip, base) { for (var r = tip; r <= base; r++) { var hw = Math.floor((r - tip) / 2); for (var q = cx - hw; q <= cx + hw; q++) R.put(q, r, r === tip ? light(a, 0.3) : a); } };
    if (K === "king") {
      W = 15; H = 11; R = new Raster(W, H);
      [[1, 5], [4, 3], [7, 2], [10, 3], [13, 5]].forEach(function (s) { spike(s[0], s[1], 7); R.put(s[0], s[1] - 1, s[0] === 7 ? a : b); });
      R.put(7, 0, a); R.put(6, 0, a); R.put(8, 0, a);
      for (y = 8; y <= 10; y++) for (x = 0; x < W; x++) R.put(x, y, y === 8 ? light(a, 0.35) : y === 10 ? mix(a, e, 0.5) : a);
      [2, 5, 9, 12].forEach(function (q) { R.put(q, 9, b); }); R.put(7, 9, [255, 255, 255]);
      R.outline(dark(e, 0.4));
    } else if (K === "halo") {
      W = 15; H = 5; R = new Raster(W, H);
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) { var ev = Math.pow((x - 7) / 7.2, 2) + Math.pow((y - 2) / 2.2, 2); if (ev > 0.5 && ev <= 1.05) R.put(x, y, y <= 1 ? b : a); }
      R.outline(e, 0.35);
    } else if (K === "laurel") {
      W = 15; H = 9; R = new Raster(W, H);
      for (var i = 0; i < 6; i++) { var t = i / 5, lx = Math.round(1 + t * 4.5), ly = Math.round(8 - t * 6 + t * t * 1.5); R.put(lx, ly, a); R.put(lx - 1, ly - (i % 2), b); R.put(W - 1 - lx, ly, a); R.put(W - lx, ly - (i % 2), b); }
      for (x = 3; x <= 11; x++) R.put(x, 8, b);
      R.outline(e, 0.85);
    } else if (K === "circlet") {
      W = 13; H = 7; R = new Raster(W, H);
      for (x = 1; x <= 11; x++) R.put(x, 6, x === 6 ? light(a, 0.4) : a);
      R.put(6, 1, b); R.put(5, 2, b); R.put(6, 2, [255, 255, 255]); R.put(7, 2, b); R.put(5, 3, dark(b, 0.2)); R.put(6, 3, b); R.put(7, 3, dark(b, 0.2)); R.put(6, 4, b); R.put(6, 5, a);
      R.put(3, 5, b); R.put(9, 5, b);
      R.outline(e);
    } else if (K === "horns") {
      W = 15; H = 10; R = new Raster(W, H);
      for (var s2 = 0; s2 <= 12; s2++) { var u = s2 / 12, hx = 3.2 - 3 * u + u * u * 0.8, hy = 9 - 9 * u, c = mix(b, a, u);
        R.put(hx, hy, c); R.put(W - 1 - hx, hy, c); if (u < 0.55) { R.put(hx + 1, hy, c); R.put(W - 2 - hx, hy, c); } }
      R.outline(e);
    } else if (K === "flame") {
      W = 13; H = 10; R = new Raster(W, H);
      var hs = [5, 8, 7, 5], xs = [2, 5, 8, 11];
      for (var tg = 0; tg < 4; tg++) { var hh = hs[tg] + (ihV153G(tg * 7 + (frame | 0) * 13) > 0.5 ? 1 : 0); for (var r2 = 9; r2 >= 9 - hh; r2--) { var rel = (9 - r2) / hh, hw2 = Math.max(0, Math.round((1 - rel) * 1.6)); for (var q2 = xs[tg] - hw2; q2 <= xs[tg] + hw2; q2++) R.put(q2, r2, rel < 0.35 ? a : rel < 0.7 ? b : e); } }
      for (x = 1; x <= 12; x++) { R.put(x, 9, b); R.put(x, 8, a); }
      R.outline([58, 10, 4], 0.75);
    } else if (K === "star") {
      W = 13; H = 8; R = new Raster(W, H);
      for (x = 0; x < W; x++) { R.put(x, 6, light(a, 0.2)); R.put(x, 7, a); }
      [2, 6, 10].forEach(function (cx) { R.put(cx, 1, b); R.put(cx, 2, [255, 255, 255]); R.put(cx, 3, b); R.put(cx - 1, 2, b); R.put(cx + 1, 2, b); R.put(cx, 4, a); R.put(cx, 5, a); });
      R.outline(e);
    } else {   // crown
      W = 13; H = 9; R = new Raster(W, H);
      [[2, 2], [6, 1], [10, 2]].forEach(function (s) { spike(s[0], s[1], 6); R.put(s[0], s[1] - 1, b); });
      for (y = 6; y <= 8; y++) for (x = 1; x <= 11; x++) R.put(x, y, y === 6 ? light(a, 0.35) : y === 8 ? mix(a, e, 0.5) : a);
      [3, 6, 9].forEach(function (q) { R.put(q, 7, b); });
      R.outline(dark(e, 0.4));
    }
    var cv = R.canvas();
    return (ART_V153G[key] = { key: key, cv: cv, ax: Math.floor(cv.width / 2), ay: cv.height - 1, w: cv.width, h: cv.height });
  }
  function auraArtV153G(au) {
    au = au || { kind: "glow", col: "#fff3c4" };
    var key = "a|" + au.kind + "|" + au.col + "|" + (au.col === "team" ? teamCol(0) : "");
    if (ART_V153G[key]) return ART_V153G[key];
    var W = 44, H = 60, c = document.createElement("canvas"); c.width = W; c.height = H;
    var x = c.getContext("2d"), col = colRgb(au.col), rgba = function (a) { return "rgba(" + (col[0] | 0) + "," + (col[1] | 0) + "," + (col[2] | 0) + "," + a + ")"; };
    x.save(); x.translate(W / 2, H / 2); x.scale(1, H / W);
    var gr = x.createRadialGradient(0, 0, 0, 0, 0, W / 2);
    if (au.kind === "void") { gr.addColorStop(0, "rgba(10,4,24,0.75)"); gr.addColorStop(0.55, rgba(0.55)); gr.addColorStop(1, rgba(0)); }
    else { gr.addColorStop(0, rgba(0.85)); gr.addColorStop(0.45, rgba(0.4)); gr.addColorStop(1, rgba(0)); }
    x.fillStyle = gr; x.beginPath(); x.arc(0, 0, W / 2, 0, 6.2832); x.fill(); x.restore();
    if (au.kind === "frost" || au.kind === "void") { x.fillStyle = au.kind === "frost" ? "#ffffff" : "#d7c9ff"; for (var i = 0; i < 14; i++) { var px = 6 + ihV153G(i * 3 + 1) * (W - 12), py = 6 + ihV153G(i * 3 + 2) * (H - 12); x.fillRect(px | 0, py | 0, 1, 1); } }
    return (ART_V153G[key] = { key: key, cv: c, ax: W / 2, ay: H / 2, w: W, h: H });
  }

  /* ---- FOOTPRINTS: one drawer for the field (a Phaser Graphics) and the previews (a 2D canvas) ---- */
  function gAdapterV153G(g) { return {
    rect: function (x, y, w, h, c, a) { g.fillStyle(c, a); g.fillRect(x, y, w, h); },
    circ: function (x, y, r, c, a) { g.fillStyle(c, a); g.fillCircle(x, y, r); },
    seg: function (x1, y1, x2, y2, w, c, a) { g.lineStyle(w, c, a); g.lineBetween(x1, y1, x2, y2); } }; }
  function cAdapterV153G(ctx) { var hx = function (c) { return "#" + ("00000" + c.toString(16)).slice(-6); }; return {
    rect: function (x, y, w, h, c, a) { ctx.globalAlpha = Math.max(0, Math.min(1, a)); ctx.fillStyle = hx(c); ctx.fillRect(x, y, w, h); },
    circ: function (x, y, r, c, a) { ctx.globalAlpha = Math.max(0, Math.min(1, a)); ctx.fillStyle = hx(c); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); },
    seg: function (x1, y1, x2, y2, w, c, a) { ctx.globalAlpha = Math.max(0, Math.min(1, a)); ctx.strokeStyle = hx(c); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); } }; }
  function trailDrawV153G(A, pts, now, life, d, s) {
    var cols = (d.col && d.col.length ? d.col : ["#ffffff"]).map(colNum), K = d.kind, n = pts.length, drawn = 0, C = function (i) { return cols[i % cols.length]; };
    if (K === "lightning" || K === "comet" || K === "rainbow") {
      var fl = (now / 70) | 0;
      for (var i = 1; i < n; i++) {
        var p0 = pts[i - 1], p1 = pts[i], f = 1 - Math.min(1, (now - p1.t) / life); if (f <= 0) continue;
        if (K === "comet") { A.seg(p0.x, p0.y, p1.x, p1.y, (1.2 + 4.5 * f) * s, C(0), 0.55 * f); A.seg(p0.x, p0.y, p1.x, p1.y, (0.6 + 1.8 * f) * s, C(1), 0.95 * f); }
        else if (K === "rainbow") { for (var bnd = 0; bnd < cols.length; bnd++) { var off = (bnd - (cols.length - 1) / 2) * 1.4 * s; A.seg(p0.x, p0.y + off, p1.x, p1.y + off, 1.5 * s, cols[bnd], 0.85 * f); } }
        else { var j0 = (ihV153G(p0.i * 3 + fl) - 0.5) * 7 * s, j1 = (ihV153G(p1.i * 3 + fl) - 0.5) * 7 * s;
          A.seg(p0.x, p0.y - 3 * s + j0, p1.x, p1.y - 3 * s + j1, 3.2 * s, C(2), 0.35 * f); A.seg(p0.x, p0.y - 3 * s + j0, p1.x, p1.y - 3 * s + j1, 1.2 * s, C(0), 0.95 * f);
          if (ihV153G(p1.i * 5 + fl) > 0.8) A.rect(p1.x + j1 - s, p1.y - 3 * s - s, 2 * s, 2 * s, C(1), f); }
        drawn++;
      }
      return drawn;
    }
    for (var k = 0; k < n; k++) {
      var p = pts[k], a = (now - p.t) / life; if (a >= 1 || a < 0) continue;
      var F = 1 - a, r1 = ihV153G(p.i * 13 + 1), r2 = ihV153G(p.i * 13 + 2), sz;
      if (K === "flame") {
        for (var q = 0; q < 2; q++) { var rq = ihV153G(p.i * 13 + 3 + q); sz = (1 + 4 * F * (0.6 + 0.4 * rq)) * s; var ci = a < 0.2 ? 0 : a < 0.45 ? 1 : a < 0.75 ? 2 : 3;
          A.rect(p.x + (rq - 0.5) * 5 * s - sz / 2, p.y - a * 10 * s * (0.7 + rq * 0.6) - sz / 2, sz, sz, cols[Math.min(ci, cols.length - 1)], Math.min(1, F * 1.3)); }
      } else if (K === "ice") {
        sz = (1.5 + 2.5 * F) * s; var ic = C(p.i), ix = p.x + (r1 - 0.5) * 4 * s, iy = p.y + (r2 - 0.5) * 2 * s;
        A.rect(ix - sz / 2, iy - sz * 0.15, sz, sz * 0.3, ic, 0.9 * F); A.rect(ix - sz * 0.15, iy - sz / 2, sz * 0.3, sz, ic, 0.9 * F);
        if (p.i % 2 === 0) A.rect(p.x - 1.5 * s, p.y - 0.5 * s, 3 * s, s, C(1), 0.45 * F);
      } else if (K === "sparks") {
        for (var q2 = 0; q2 < 2; q2++) { var rs = ihV153G(p.i * 13 + 5 + q2), tw = 0.55 + 0.45 * Math.sin(now / 55 + p.i * 1.7 + q2);
          A.rect(p.x + (rs - 0.5) * 8 * s - 0.8 * s, p.y - ihV153G(p.i * 13 + 7 + q2) * 6 * s * a - 0.8 * s, 1.6 * s, 1.6 * s, C(p.i + q2), F * tw); }
      } else if (K === "stars") {
        if (p.i % 2) continue; var st = 0.5 + 0.5 * Math.sin(now / 90 + p.i * 1.7), arm = (2 + 2 * F) * s, sx = p.x + (r1 - 0.5) * 6 * s, sy = p.y - r2 * 5 * s;
        A.rect(sx - arm, sy - 0.45 * s, arm * 2, 0.9 * s, C(p.i), F * st); A.rect(sx - 0.45 * s, sy - arm, 0.9 * s, arm * 2, C(p.i), F * st);
      } else if (K === "smoke") {
        if (p.i % 2) continue; A.circ(p.x + (r1 - 0.5) * 3 * s, p.y - a * 4 * s, (1.2 + a * 4.5) * s, C(p.i), 0.45 * F);
      } else if (K === "pixels") {
        var gs = 3 * s; A.rect(Math.round(p.x / gs) * gs, Math.round((p.y - r1 * 3 * s) / gs) * gs, 2.6 * s, 2.6 * s, C(p.i), Math.ceil(F * 4) / 4);
      } else if (K === "petals") {
        A.rect(p.x + Math.sin(a * 6 + r1 * 6) * 3 * s, p.y - 2 * s + a * 3 * s, 2.2 * s, 1.4 * s, C(p.i), F);
      } else continue;
      drawn++;
    }
    return drawn;
  }
  /* the afterimage: three tinted copies of his own frame where he was ~90, ~210 and ~320ms ago */
  function ghostFxV153G(scene, m, pts, now, life, d) {
    var pool = scene._cosGhostV153G || (scene._cosGhostV153G = []), want = [0.18, 0.4, 0.62], used = 0, col = colNum((d.col || ["#8fe3ff"])[0]);
    for (var k = 0; k < want.length; k++) {
      var best = null, bd = 1e9;
      for (var i = 0; i < pts.length; i++) { var dd = Math.abs((now - pts[i].t) - want[k] * life); if (dd < bd) { bd = dd; best = pts[i]; } }
      var img = pool[k]; if (img && !img.scene) img = pool[k] = null;
      if (!best || bd > life * 0.2 || !scene.textures.exists(best.key)) { if (img) img.setVisible(false); continue; }
      if (!img) { img = pool[k] = scene.add.image(0, 0, best.key); }
      img.setTexture(best.key).setPosition(best.rx, best.ry).setScale(best.s).setFlipX(!!best.fl).setVisible(true).setDepth((m.root.depth || 4) - 0.002 - k * 0.0005);
      try { img.setTintFill(col); } catch (e) {}
      img.setAlpha(0.42 * (1 - want[k])); used++;
    }
    G153.fx.ghosts += used; return used;
  }

  /* ---- on the field ---- */
  var flairCache = { v: -1, F: null }, NO_FLAIR = { any: false };
  function flairV153G() {
    var ch = V.changes || 0; if (flairCache.v === ch && flairCache.F) return flairCache.F;
    var get = function (slot, fld) { var it = item(slot); return it && it[fld] ? { id: it.id, d: it[fld] } : null; };
    var F = { trail: get("trail", "tr"), wings: get("wings", "w"), crown: get("crown", "cr"), aura: get("aura", "au"), numfont: get("numfont", "nf") };
    F.any = !!(F.trail || F.wings || F.crown || F.aura || F.numfont);
    flairCache = { v: ch, F: F }; return F;
  }
  function texV153G(scene, art) {
    var key = "cos153g_" + (hsh(art.key) >>> 0).toString(36);
    if (!scene.textures.exists(key)) { try { scene.textures.addCanvas(key, art.cv); } catch (e) { errV153G(e); } }
    return key;
  }
  var GEO_V153G = {};
  function headGeoV153G(scene, m) {
    var b = m.body, key = b && b.texture && b.texture.key, g = key && GEO_V153G[key];
    if (!g && key) {
      g = { top: 1, bot: 45, cx: 24, w: 48, h: 48 };
      try {
        var src = scene.textures.get(key).getSourceImage(), W = src.width, H = src.height, d = pix(src, W, H);
        if (d && W <= 128 && H <= 128) {
          var top = -1, bot = -1, sx = 0, n = 0;
          for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 40) { if (top < 0) top = y; bot = y; if (y - top < 5) { sx += x; n++; } }
          if (top >= 0) g = { top: top, bot: bot, cx: n ? sx / n : W / 2, w: W, h: H };
        }
      } catch (e) {}
      if (Object.keys(GEO_V153G).length > 600) GEO_V153G = {};
      GEO_V153G[key] = g;
    }
    g = g || { top: 1, bot: 45, cx: 24, w: 48, h: 48 };
    var ox = b ? b.originX : 0.5, oy = b ? b.originY : 0.5, bsx = b ? Math.abs(b.scaleX) : 1, bsy = b ? b.scaleY : 1, flip = b && b.flipX;
    return { top: (b ? b.y : 0) + (g.top - g.h * oy) * bsy, bot: (b ? b.y : 0) + (g.bot - g.h * oy) * bsy, cx: (b ? b.x : 0) + ((flip ? g.w - g.cx : g.cx) - g.w * ox) * bsx, h: (g.bot - g.top) * bsy };
  }
  function childV153G(scene, m, prop, key) {
    var o = m[prop]; if (o && (!o.scene || !o.active)) o = m[prop] = null;
    if (!o) { o = m[prop] = scene.add.image(0, 0, key); m.root.add(o); }
    else if (o.texture.key !== key) o.setTexture(key);
    return o;
  }
  function orderV153G(m, o, where) {
    var R = m.root, L = R.list, cur = L.indexOf(o); if (cur < 0) return;
    var bi = L.indexOf(m.body), li = L.indexOf(m.label), si = m.skin ? L.indexOf(m.skin) : bi;
    var ok = where === "ground" ? cur === 0 : where === "back" ? cur < bi : (cur > Math.max(bi, si) && (li < 0 || cur < li));
    if (ok) return;
    var mv = function (idx) { try { R.moveTo(o, idx); } catch (e) { R.remove(o); R.addAt(o, idx); } };
    if (where === "ground") mv(0);
    else if (where === "back") mv(L.indexOf(m.body) - (cur < L.indexOf(m.body) ? 1 : 0));
    else { var tgt = L.indexOf(m.label); mv(tgt < 0 ? L.length - 1 : tgt - (cur < tgt ? 1 : 0)); }
  }
  function dropV153G(m, prop) { var o = m[prop]; if (o) { try { o.destroy(); } catch (e) {} m[prop] = null; } }
  function clearFxV153G(scene, m) {
    ["_auV153G", "_wlV153G", "_wrV153G", "_crV153G"].forEach(function (p) { dropV153G(m, p); });
    numfontFxV153G(m, null); m._trV153G = null; m._cosV153G = 0; G153.fx.cleared++;
    try { (scene._cosGhostV153G || []).forEach(function (g) { if (g && g.scene) g.setVisible(false); }); var g = scene._cosTrailV153G; if (g && g.scene) g.clear(); } catch (e) {}
  }
  function numfontFxV153G(m, N) {
    var L = m.label; if (!L || !L.setFontFamily || !L.style) return;
    if (!N) { var o = m._nfOrigV153G; if (o) { try { L.setFontFamily(o.f); L.setColor(o.c); L.setStroke(o.s, o.w); } catch (e) {} m._nfOrigV153G = null; m._nfKeyV153G = null; } return; }
    var st = L.style; if (m._nfKeyV153G === N.id && st.fontFamily === N.d.font && st.color === N.d.col) return;
    if (!m._nfOrigV153G) m._nfOrigV153G = { f: st.fontFamily, c: st.color, s: st.stroke, w: st.strokeThickness };
    L.setFontFamily(N.d.font); L.setColor(N.d.col); L.setStroke(N.d.stroke, Math.max(2, st.strokeThickness || 2.2));
    m._nfKeyV153G = N.id; G153.fx.numfont++;
  }
  function hookSceneV153G(scene) {
    if (scene._cosEvV153G) return; scene._cosEvV153G = 1;
    try { scene.events.on("update", function () {   // footprints nobody is drawing any more fade out with the marker gone
      if (G153.freeze) return;
      var g = scene._cosTrailV153G, t = scene.time ? scene.time.now : 0;
      if (g && g.scene && g._drawnAt != null && t - g._drawnAt > 150) { g.clear(); g._drawnAt = null; (scene._cosGhostV153G || []).forEach(function (o) { if (o && o.scene) o.setVisible(false); }); }
    }); } catch (e) {}
  }
  function fieldFxV153G(scene, m, p) {
    try {
      if (!m || !m.root || !scene || !scene.add) return false;
      var F = m.team === "you" ? flairV153G() : NO_FLAIR;
      if (!F.any) { if (m._cosV153G) clearFxV153G(scene, m); return false; }
      m._cosV153G = 1; G153.fx.frames++;
      var now = scene.time ? scene.time.now : 0, s = m.root.scale || 1, b = m.body;
      var down = /^(down|dive|tackleSeq|pancakeSeq|getup|grab)/.test(String(m.forceState || "")) || (b && Math.abs(b.rotation || 0) > 0.35) || (b && b.visible === false);
      var geo = headGeoV153G(scene, m), dir = String(m.dirKey || "dn");
      // the aura: a glow he stands in
      if (F.aura) {
        var aa = auraArtV153G(F.aura.d), ao = childV153G(scene, m, "_auV153G", texV153G(scene, aa)); orderV153G(m, ao, "ground");
        var ak = F.aura.d.kind, pul = ak === "pulse" ? 0.72 + 0.28 * Math.sin(now / 300) : ak === "flicker" ? 0.62 + 0.38 * Math.abs(Math.sin(now / 47) * Math.sin(now / 131)) : 0.82;
        if (ao._bmV153G !== ak) { ao.setBlendMode(ak === "void" ? 0 : 1); ao._bmV153G = ak; }
        ao.setPosition(geo.cx, (geo.top + geo.bot) / 2 + 2).setAlpha(pul * (down ? 0.5 : 1)).setScale(ak === "pulse" ? 1 + 0.06 * Math.sin(now / 300) : 1);
        G153.fx.aura++;
      } else dropV153G(m, "_auV153G");
      // the wings: behind him facing the camera, over his back facing away; they flap, and fold a little at a sprint
      if (F.wings) {
        var wd = F.wings.d, wa = wingArtV153G(wd, wd.kind === "flame" ? ((now / 110) | 0) % 2 : 0), wk = texV153G(scene, wa);
        var wl = childV153G(scene, m, "_wlV153G", wk), wr = childV153G(scene, m, "_wrV153G", wk), away = /^u/.test(dir);
        orderV153G(m, wl, away ? "front" : "back"); orderV153G(m, wr, away ? "front" : "back");
        wr.setFlipX(false).setOrigin(wa.ax / wa.w, wa.ay / wa.h); wl.setFlipX(true).setOrigin(1 - wa.ax / wa.w, wa.ay / wa.h);
        var run = Math.min(1, (m._spdPx || 0) / 160), flap = Math.sin(now / (run > 0.3 ? 90 : 260)) * (run > 0.3 ? 0.16 : 0.09);
        var side = dir === "sd" ? 0.55 : (dir === "dr" || dir === "ur") ? 0.8 : 1, wsx = (1 - run * 0.3) * side * TUv("cosWingScaleV153G", 1), wsy = TUv("cosWingScaleV153G", 1);
        var shY = geo.top + geo.h * 0.3, spread = TUv("cosWingSpreadV153G", 0.32), sh = 3.5 * side;   // raised and set out from the shoulder blades, so they read past his body
        wr.setPosition(geo.cx + sh, shY).setScale(wsx, wsy).setRotation(-spread - flap).setVisible(!down);
        wl.setPosition(geo.cx - sh, shY).setScale(wsx, wsy).setRotation(spread + flap).setVisible(!down);
        if (wd.kind === "flame") { var fa = 0.8 + 0.2 * Math.sin(now / 60); wr.setAlpha(fa); wl.setAlpha(fa); }
        G153.fx.wings++;
      } else { dropV153G(m, "_wlV153G"); dropV153G(m, "_wrV153G"); }
      // the crown: on his head (a halo floats over it)
      if (F.crown) {
        /* its own object over the plumbob's depth (the plumbob floats just above his head; a crown under it would vanish),
         * placed in world space from his container and taken down with it */
        var cd = F.crown.d, ca = crownArtV153G(cd, cd.kind === "flame" ? ((now / 120) | 0) % 2 : 0), ck = texV153G(scene, ca), co = m._crV153G;
        if (co && (!co.scene || !co.active)) co = m._crV153G = null;
        if (!co) { co = m._crV153G = scene.add.image(0, 0, ck); m.root.once("destroy", function () { try { co.destroy(); } catch (e) {} }); }
        else if (co.texture.key !== ck) co.setTexture(ck);
        co.setOrigin(ca.ax / ca.w, ca.ay / ca.h).setDepth(TUv("cosCrownDepthV153G", 23.05));
        var cy = geo.top + (cd.kind === "halo" ? -2.5 + Math.sin(now / 420) * 0.8 : cd.kind === "horns" ? 4 : 2.5);
        co.setPosition(m.root.x + geo.cx * s, m.root.y + cy * s).setScale(s).setVisible(!down && m.root.visible !== false);
        G153.fx.crown++;
      } else dropV153G(m, "_crV153G");
      numfontFxV153G(m, F.numfont);
      // the footprints: world space, under every player
      if (F.trail && G153.freeze) { /* a check holds the drawn footprints still */ }
      else if (F.trail) {
        hookSceneV153G(scene);
        var g = scene._cosTrailV153G; if (!g || !g.scene) g = scene._cosTrailV153G = scene.add.graphics().setDepth(TUv("cosTrailDepthV153G", 3.9));
        var P = m._trV153G; if (!P || P.id !== F.trail.id) P = m._trV153G = { id: F.trail.id, pts: [], seq: 0, lx: null, ly: null };
        var fx = m.root.x + geo.cx * s, fy = m.root.y + (geo.bot - 1) * s, mv = P.lx == null ? 1e9 : Math.hypot(fx - P.lx, fy - P.ly);
        if (mv > 60 * s) { P.lx = fx; P.ly = fy; }   // a jump (a new snap, a re-spot): start again from here
        else if (!down && mv >= TUv("cosTrailStepV153G", 2.2) * s) { P.pts.push({ x: fx, y: fy, t: now, i: P.seq++, rx: m.root.x, ry: m.root.y, s: s, key: b && b.texture ? b.texture.key : "", fl: !!(b && b.flipX) }); P.lx = fx; P.ly = fy; }
        var td = F.trail.d, life = TUv("cosTrailMsV153G", 520) * (td.kind === "ice" || td.kind === "petals" ? 1.5 : 1);
        while (P.pts.length && now - P.pts[0].t > life) P.pts.shift();
        if (P.pts.length > 90) P.pts.splice(0, P.pts.length - 90);
        g.clear();
        var drawn = td.kind === "ghost" ? ghostFxV153G(scene, m, P.pts, now, life, td) : trailDrawV153G(gAdapterV153G(g), P.pts, now, life, td, Math.max(s, TUv("cosTrailMinScaleV153G", 0.5)) * TUv("cosTrailScaleV153G", 1.4));
        g._drawnAt = now;
        if (drawn) { G153.fx.trail++;
          var n = P.pts.length, sxm = 0, sym = 0; P.pts.forEach(function (q) { sxm += q.x; sym += q.y; });
          G153.lastTrail = { id: F.trail.id, kind: td.kind, n: n, drawn: drawn, cx: sxm / n, cy: sym / n, hx: fx, hy: fy, vx: n > 1 ? P.pts[n - 1].x - P.pts[0].x : 0, vy: n > 1 ? P.pts[n - 1].y - P.pts[0].y : 0 }; }
      } else if (m._trV153G) { m._trV153G = null; try { var g0 = scene._cosTrailV153G; if (g0 && g0.scene) g0.clear(); (scene._cosGhostV153G || []).forEach(function (o) { if (o && o.scene) o.setVisible(false); }); } catch (e) {} }
      return true;
    } catch (e) { errV153G(e); return false; }
  }

  /* ---- the card and the previews: paint the flair around a figure whose ink is measured ---- */
  function inkGeoV153G(cv, ox, oy) {
    try {
      var W = cv.width, H = cv.height, d = cv.getContext("2d").getImageData(0, 0, W, H).data, top = -1, bot = -1, sx = 0, n = 0;
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 40) { if (top < 0) top = y; bot = y; }
      if (top < 0) return null;
      var band = Math.max(2, Math.round((bot - top) * 0.07));
      for (var y2 = top; y2 <= top + band; y2++) for (var x2 = 0; x2 < W; x2++) if (d[(y2 * W + x2) * 4 + 3] > 40) { sx += x2; n++; }
      return { top: top + (oy || 0), bot: bot + (oy || 0), cx: (n ? sx / n : W / 2) + (ox || 0), h: bot - top };
    } catch (e) { return null; }
  }
  function paintBackV153G(ctx, geo, F, k, shf) {
    ctx.imageSmoothingEnabled = false;
    if (F.aura) { var aa = auraArtV153G(F.aura.d), sc = geo.h / 44 * 1.05; ctx.save(); ctx.globalAlpha = 0.6; if (F.aura.d.kind !== "void") ctx.globalCompositeOperation = "lighter"; ctx.imageSmoothingEnabled = true; ctx.drawImage(aa.cv, geo.cx - aa.w * sc / 2, (geo.top + geo.bot) / 2 - aa.h * sc / 2 + 2 * sc, aa.w * sc, aa.h * sc); ctx.restore(); }
    if (F.wings) {
      var wa = wingArtV153G(F.wings.d, 0), shY = geo.top + geo.h * (shf || 0.3), sp = TUv("cosWingSpreadV153G", 0.32);
      [1, -1].forEach(function (sd) { ctx.save(); ctx.translate(geo.cx + sd * 3.5 * k, shY); ctx.scale(sd, 1); ctx.rotate(-sp); ctx.drawImage(wa.cv, -wa.ax * k, -wa.ay * k, wa.w * k, wa.h * k); ctx.restore(); });
    }
  }
  function paintFrontV153G(ctx, geo, F, k) {
    ctx.imageSmoothingEnabled = false;
    if (F.crown) { var cd = F.crown.d, ca = crownArtV153G(cd, 0), off = cd.kind === "halo" ? -2.5 : cd.kind === "horns" ? 4 : 2.5; ctx.drawImage(ca.cv, geo.cx - ca.ax * k, geo.top + off * k - ca.ay * k, ca.w * k, ca.h * k); }
  }
  function flairFromIdsV153G(cz) {
    var get = function (id, cat, fld) { var it = id ? findItem(id) : null; return it && it.cat === cat && it[fld] ? { id: it.id, d: it[fld] } : null; };
    cz = cz || {};
    return { wings: get(cz.wings, "wings", "w"), crown: get(cz.crown, "crown", "cr"), aura: get(cz.aura, "aura", "au"), trail: get(cz.trail, "trail", "tr"), numfont: get(cz.numfont, "numfont", "nf") };
  }
  function cardFlairV153G(cv, cz) {
    try {
      var host = cv && cv.parentNode; if (!host) return false;
      Array.prototype.slice.call(host.querySelectorAll(".pc-fl-v153g")).forEach(function (o) { o.remove(); });
      var F = flairFromIdsV153G(cz);
      if (!F.wings && !F.crown && !F.aura) { G153.card = { none: true }; return false; }
      host.classList.add("pc-fig-v153g"); host.classList.toggle("pc-shrink-v153g", !!(F.wings || F.crown));   // headroom for a crown: the figure and its layers step back a little
      var back = document.createElement("canvas"), front = document.createElement("canvas");
      var PAD = Math.round(cv.height / 4); back.width = front.width = cv.width; back.height = front.height = cv.height + PAD;
      back.className = "pc-fl-v153g back"; front.className = "pc-fl-v153g front";
      if (F.wings) back.setAttribute("data-wings", F.wings.id); if (F.crown) front.setAttribute("data-crown", F.crown.id); if (F.aura) back.setAttribute("data-aura", F.aura.id);
      host.insertBefore(back, cv); host.appendChild(front);
      var paint = function () {
        if (!back.isConnected && !host.isConnected) return false;
        var geo = inkGeoV153G(cv, 0, PAD); if (!geo || geo.h < 20) return false;
        var k = geo.h / 44, bx = back.getContext("2d"), fx = front.getContext("2d");
        bx.clearRect(0, 0, back.width, back.height); fx.clearRect(0, 0, front.width, front.height);
        paintBackV153G(bx, geo, F, k * 0.75, 0.42); paintFrontV153G(fx, geo, F, k * 0.85);   // the card figure's big-helmet proportions put the shoulders lower
        var inkOf = function (c) { var d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data, n = 0; for (var i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return n; };
        G153.card = { wings: F.wings && F.wings.id, crown: F.crown && F.crown.id, aura: F.aura && F.aura.id, back: inkOf(back), front: inkOf(front), geo: geo };
        return true;
      };
      paint(); setTimeout(paint, 750); setTimeout(paint, 1600);
      return true;
    } catch (e) { errV153G(e); return false; }
  }
  function figV153G(px) {
    var C = window.__CHASE_V94, U = resolveU((item("uniform") || {}).k || null, null), tc = (window.__GRIDIRON_TEAM_CUSTOM__ || {}).col || ["#1f4fd0", "#e8c86a"];
    U = U || { j: tc[0], p: tc[1], pat: "solid" };
    var out = document.createElement("canvas"); out.width = px; out.height = Math.round(px * 1.1); var x = out.getContext("2d"); x.imageSmoothingEnabled = false;
    try {
      if (C && C.cell) { var dyed = C.cell("idle_dn", [U.j, U.p]), raw = C.cell("idle_dn", "raw"); if (dyed) { var c = document.createElement("canvas"); c.width = 48; c.height = 48; c.getContext("2d").drawImage(dyed, 0, 0);
        kitDeco(U.pat ? U : null, (item("helmet") || {}).h || null)(c, "idle_dn", null, raw); x.drawImage(c, 4, 0, 40, 44, 0, 0, px, px * 1.1); return out; } }
    } catch (e) {}
    // no sheet yet: a plain silhouette in his colours
    var k = px / 40; x.fillStyle = U.p; x.fillRect(15 * k, 26 * k, 10 * k, 16 * k); x.fillStyle = U.j; x.fillRect(12 * k, 12 * k, 16 * k, 15 * k); x.fillStyle = "#c9cfd8"; x.fillRect(14 * k, 2 * k, 12 * k, 10 * k);
    return out;
  }
  function previewFlairV153G(el, it) {
    el.innerHTML = "";
    var cv = document.createElement("canvas"); cv.width = 64; cv.height = 64; cv.className = "cos-fl-v153g"; var x = cv.getContext("2d");
    try {
      if (it.cat === "numfont") {
        var tc = (window.__GRIDIRON_TEAM_CUSTOM__ || {}).col || ["#1f4fd0", "#e8c86a"], nf = it.nf || { font: "Oswald, sans-serif", col: "#ffffff", stroke: "#0a0e14" };
        x.fillStyle = hexOk(tc[0]) || "#1f4fd0"; x.beginPath(); x.moveTo(14, 12); x.lineTo(24, 8); x.lineTo(40, 8); x.lineTo(50, 12); x.lineTo(50, 58); x.lineTo(14, 58); x.closePath(); x.fill();
        x.font = "bold 26px " + nf.font; x.textAlign = "center"; x.textBaseline = "middle"; x.lineWidth = 3; x.strokeStyle = nf.stroke; x.strokeText("23", 32, 35); x.fillStyle = nf.col; x.fillText("23", 32, 35);
      } else {
        var F = { trail: it.tr ? { id: it.id, d: it.tr } : null, wings: it.w ? { id: it.id, d: it.w } : null, crown: it.cr ? { id: it.id, d: it.cr } : null, aura: it.au ? { id: it.id, d: it.au } : null };
        var fig = figV153G(34), fx0 = F.trail ? 26 : 15, fy0 = 64 - fig.height - 2, geo = inkGeoV153G(fig, fx0, fy0) || { top: fy0, bot: 62, cx: fx0 + 17, h: 36 }, k = geo.h / 44;
        if (F.trail) { var pts = [], life = 520, now = 1000; for (var i = 0; i < 16; i++) pts.push({ x: 4 + i * 1.6, y: geo.bot - 1 - (F.trail.d.kind === "ghost" ? 0 : 0), t: now - life * (1 - i / 16) * 0.95, i: i });
          if (F.trail.d.kind === "ghost") { x.globalAlpha = 0.35; for (var gi = 0; gi < 3; gi++) x.drawImage(fig, fx0 - 18 + gi * 6, fy0); x.globalAlpha = 1; x.globalCompositeOperation = "source-atop"; x.fillStyle = (it.tr.col || ["#8fe3ff"])[0]; x.fillRect(0, 0, fx0, 64); x.globalCompositeOperation = "source-over"; }
          else trailDrawV153G(cAdapterV153G(x), pts, now, life, F.trail.d, 1.4); x.globalAlpha = 1; }
        if (!F.trail && !F.wings && !F.crown && !F.aura) { x.globalAlpha = 0.45; }
        paintBackV153G(x, geo, F, k); x.drawImage(fig, fx0, fy0); x.globalAlpha = 1; paintFrontV153G(x, geo, F, k);
      }
      G153.previews++;
    } catch (e) { errV153G(e); }
    el.appendChild(cv); return el;
  }

  /* ---- the touchdown: seven new celebrations (each returns what it made; its own PRNG, never Math.random) ---- */
  var CEL_V153G = {
    shock: function (o) { var S = o.scene, m = 0;
      for (var i = 0; i < 3; i++) (function (i) { S.time.delayedCall(i * 160, function () { var r = o.track(S.add.ellipse(o.x, o.y, 20, 8).setStrokeStyle(3, o.cn(i), 1).setDepth(o.D)); o.tw(r, { scaleX: 9, scaleY: 9, alpha: 0, duration: 700 }); }); })(i);
      for (var j = 0; j < 14 * o.n; j++) { var a = j / 14 * 6.283, d = o.dot(o.x, o.y, 2, o.cn(j)); o.tw(d, { x: o.x + Math.cos(a) * o.R(50, 90), y: o.y + Math.sin(a) * o.R(18, 34), alpha: 0, duration: o.R(500, 800) }); m++; }
      return m + 3; },
    snow: function (o) { var m = 0; for (var i = 0; i < 40 * o.n; i++) { var d = o.dot(o.x + o.R(-160, 160), o.y - o.R(120, 240), o.R(1.4, 2.6), o.cn(i), 0.95); o.tw(d, { y: d.y + o.R(180, 260), x: d.x + o.R(-30, 30), alpha: 0.15, duration: o.R(1400, 2200), delay: o.R(0, 400) }); m++; } return m; },
    pixel: function (o) { var S = o.scene, m = 0; for (var i = 0; i < 24 * o.n; i++) { var a = i / 24 * 6.283 + o.R(-0.1, 0.1), r = o.track(S.add.rectangle(o.x, o.y - 10, 5, 5, o.cn(i)).setDepth(o.D)); m++;
      try { S.tweens.add({ targets: r, x: o.x + Math.cos(a) * o.R(50, 100), y: o.y - 10 + Math.sin(a) * o.R(40, 80), alpha: 0, duration: o.R(700, 1000), ease: "Stepped", easeParams: [6], onComplete: function () { try { S.dropFx ? S.dropFx(this.targets[0]) : this.targets[0].destroy(); } catch (e) {} } }); } catch (e) {} } return m; },
    meteor: function (o) { var S = o.scene, m = 0;
      for (var i = 0; i < 6; i++) (function (i) { var sx = o.x + o.R(-220, -90), sy = o.y - o.R(220, 300), tx = o.x + o.R(-60, 60), ty = o.y + o.R(-20, 20);
        var r = o.track(S.add.rectangle(sx, sy, 4, 16, o.cn(i)).setDepth(o.D).setAngle(-Math.atan2(tx - sx, ty - sy) * 57.3)); m++;
        try { S.tweens.add({ targets: r, x: tx, y: ty, duration: 420, delay: i * 150, ease: "Quad.easeIn", onComplete: function () { try { S.dropFx ? S.dropFx(r) : r.destroy(); } catch (e) {}
          for (var j = 0; j < 8; j++) { var a = j / 8 * 6.283, d = o.dot(tx, ty, 2, o.cn(j + 1)); o.tw(d, { x: tx + Math.cos(a) * 26, y: ty + Math.sin(a) * 14, alpha: 0, duration: 420 }); } } }); } catch (e) {} })(i);
      return m + 48; },
    rainbow: function (o) { var S = o.scene, g = o.track(S.add.graphics().setDepth(o.D - 0.5)); g.setAlpha(0);
      o.cols.forEach(function (c, i) { g.lineStyle(5, o.cn(i), 0.9); g.beginPath(); g.arc(o.x, o.y + 10, 92 - i * 5, Math.PI, 2 * Math.PI); g.strokePath(); });
      try { S.tweens.add({ targets: g, alpha: 1, duration: 350, yoyo: true, hold: 1100, onComplete: function () { try { S.dropFx ? S.dropFx(g) : g.destroy(); } catch (e) {} } }); } catch (e) {}
      for (var j = 0; j < 10 * o.n; j++) { var d = o.dot(o.x + o.R(-90, 90), o.y - o.R(20, 80), 2, o.cn(j)); o.tw(d, { y: d.y - o.R(20, 50), alpha: 0, duration: o.R(700, 1100) }); }
      return 1 + Math.round(10 * o.n); },
    halo: function (o) { var S = o.scene, r = o.track(S.add.ellipse(o.x, o.y - 50, 28, 9).setStrokeStyle(3, o.cn(0), 1).setDepth(o.D + 0.1));
      o.tw(r, { y: o.y - 74, scaleX: 3, scaleY: 3, alpha: 0, duration: 1400, ease: "Cubic.easeOut" });
      for (var i = 0; i < 12 * o.n; i++) { var t = o.track(S.add.text(o.x + o.R(-40, 40), o.y - o.R(20, 60), "✦", { fontFamily: "Oswald, sans-serif", fontSize: Math.round(o.R(10, 18)) + "px", color: o.cols[i % o.cols.length] }).setOrigin(0.5).setDepth(o.D)); o.tw(t, { y: t.y - o.R(30, 70), alpha: 0, duration: o.R(800, 1300) }); }
      return 1 + Math.round(12 * o.n); },
    feathers: function (o) { var S = o.scene, m = 0;
      for (var i = 0; i < 26 * o.n; i++) { var f = o.track(S.add.rectangle(o.x + o.R(-140, 140), o.y - o.R(140, 240), 3, 7, o.cn(i)).setDepth(o.D).setAngle(o.R(-40, 40))); m++;
        o.tw(f, { y: f.y + o.R(170, 250), x: f.x + o.R(-40, 40), angle: o.R(-120, 120), alpha: 0.15, duration: o.R(1600, 2400), delay: o.R(0, 500), ease: "Sine.easeInOut" }); }
      var r = o.track(S.add.ellipse(o.x, o.y - 48, 22, 7).setStrokeStyle(2, o.cn(2), 1).setDepth(o.D + 0.1)); o.tw(r, { y: o.y - 70, alpha: 0, duration: 1600 });
      return m + 1; }
  };

  /* ---- the look: the new frames, the flair previews and the card's flair layers ---- */
  (function () {
    if (document.getElementById("cosV153Gcss")) return;
    var st = document.createElement("style"); st.id = "cosV153Gcss";
    st.textContent = [
      ".fr-neon{border-color:#ff3df2;box-shadow:0 0 0 2px #2b0f4d,0 0 16px rgba(255,61,242,.55),0 0 30px rgba(111,247,255,.22),0 10px 26px rgba(0,0,0,.5)}",
      ".fr-wood{border:3px solid #7a5230;box-shadow:0 0 0 2px #3b2414,0 10px 26px rgba(0,0,0,.5);background:linear-gradient(180deg,#1f1a14,#0f0c09)}",
      ".fr-frost{border-color:#dff4ff;box-shadow:0 0 0 2px #3a7fbf,0 0 18px rgba(143,208,255,.55),0 10px 26px rgba(0,0,0,.5);background:linear-gradient(180deg,#14283a,#0a0f16)}",
      ".fr-circuit{border-color:#18c3b8;box-shadow:0 0 0 2px #0b2a28,0 0 14px rgba(24,195,184,.35),0 10px 26px rgba(0,0,0,.5);background:repeating-linear-gradient(0deg,transparent 0 13px,rgba(24,195,184,.07) 13px 14px),repeating-linear-gradient(90deg,transparent 0 13px,rgba(24,195,184,.07) 13px 14px),linear-gradient(180deg,#0e1a1e,#070c0f)}",
      ".fr-emerald{border-color:#3fbf7f;box-shadow:0 0 0 2px #0f3a26,0 0 20px rgba(63,191,127,.45),0 10px 26px rgba(0,0,0,.5)}",
      ".fr-royal{border-color:#e6c46a;box-shadow:0 0 0 3px #3b1f7a,0 0 0 5px #e6c46a,0 0 22px rgba(123,74,220,.45),0 10px 26px rgba(0,0,0,.5);background:linear-gradient(180deg,#1c1230,#0b0816)}",
      ".fr-lava{border-color:#ff5a1a;animation:cosLavaV153G 2s ease-in-out infinite;background:linear-gradient(180deg,#1f0d08,#0b0605)}",
      "@keyframes cosLavaV153G{0%,100%{box-shadow:0 0 0 2px #5c0f16,0 0 14px rgba(255,90,26,.45),0 10px 26px rgba(0,0,0,.5)}50%{box-shadow:0 0 0 2px #a8180a,0 0 28px rgba(255,140,40,.7),0 10px 26px rgba(0,0,0,.5)}}",
      ".fr-holo{border-color:#b98bff;animation:cosHoloV153G 3.2s linear infinite}",
      "@keyframes cosHoloV153G{0%,100%{border-color:#ff6b6b;box-shadow:0 0 0 2px #1a0f22,0 0 20px rgba(255,107,107,.5)}25%{border-color:#ffd76f;box-shadow:0 0 0 2px #1a0f22,0 0 20px rgba(255,215,111,.5)}50%{border-color:#6fffb0;box-shadow:0 0 0 2px #1a0f22,0 0 20px rgba(111,255,176,.5)}75%{border-color:#6fd3ff;box-shadow:0 0 0 2px #1a0f22,0 0 20px rgba(111,211,255,.5)}}",
      ".fr-angel{border-color:#fff8e0;animation:cosAngelV153G 2.6s ease-in-out infinite;background:linear-gradient(180deg,#1d2230,#0b0f16)}",
      "@keyframes cosAngelV153G{0%,100%{box-shadow:0 0 0 2px #8a6414,0 0 18px rgba(255,248,224,.45),0 -8px 26px rgba(255,233,138,.25)}50%{box-shadow:0 0 0 2px #c9951f,0 0 30px rgba(255,248,224,.75),0 -12px 34px rgba(255,233,138,.45)}}",
      ".fr-void{border-color:#7a3aff;box-shadow:0 0 0 2px #0b0716,0 0 26px rgba(122,58,255,.6),inset 0 0 30px rgba(122,58,255,.25),0 10px 26px rgba(0,0,0,.5);background:radial-gradient(ellipse at 50% 30%,#1a0f33,#05030a 75%)}",
      "@media(prefers-reduced-motion:reduce){.fr-lava,.fr-holo,.fr-angel{animation:none}}",
      ".cos-pvbox-v151b canvas.cos-fl-v153g{width:60px;height:60px;image-rendering:pixelated}",
      ".pc-fig-v153g{position:relative}.pc-fig-v153g .pc-cv-v151b{position:relative;z-index:1}",
      ".pc-fl-v153g{position:absolute;left:0;bottom:0;width:92px;height:143.75px;pointer-events:none;transform-origin:50% 100%}.pc-shrink-v153g .pc-cv-v151b,.pc-shrink-v153g .pc-fl-v153g{transform:scale(.8);transform-origin:50% 100%}.pc-fl-v153g.back{z-index:0}.pc-fl-v153g.front{z-index:2}",
      ".pcard-v151b.compact .pc-fl-v153g{width:70px;height:110px}"
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
    fieldFx: fieldFxV153G, flair: flairV153G, wingArt: wingArtV153G, crownArt: crownArtV153G, cardFlair: cardFlairV153G,   // v153 G
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
