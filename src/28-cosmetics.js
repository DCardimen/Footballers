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
 *   owned(id)            free: always · earned / pass: the cosmetics store · shop / founder: RIB_MONETIZE · member (v156 C): a membership, or grandfathered · super: a super challenge
 *   grant(id, source)    earned / pass → the store (once, toasted) · shop / founder → RIB_MONETIZE.grant("cos:<id>") · member: never · super: only with source "super"
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
 *   uniform / helmet  src/05 `ribSyncYouKitV96` → fieldKit(): the "you" textures (v159 A: and his team's "off"; never "def"),
 *                     a deco on ribRegisterTeam's put (patterns, helmet shell / stripe / decal / finish);
 *                     the menu feed's team.colors (07) → the hero, portrait and continue-card masks
 *   celebration       src/05 `celebrate()` → celebrate(): extra particles + a callout on HIS touchdown (v159 C: fieldPlayV159C)
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
  ITEMS.push.apply(ITEMS, itemsV156C());   // v156 C: the SUPER looks (defined with the v156 C block below)
  ITEMS.push.apply(ITEMS, itemsV157A());   // v157 A: seventeen more wings (defined with the v157 A block below)
  ITEMS.push.apply(ITEMS, itemsV157B());   // v157 B: 19 animated auras, 15 footprint trails (the v157 B block below)
  ITEMS.push.apply(ITEMS, itemsV159D());   // v159 D: 16 animated crowns, 16 more auras (the v159 D block below)
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
      rw = gfIconV157C(rw);   // v157 C: a pass icon he already owned stays an icon
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
  function resolveU(U, tc) { if (!U) return null; U = uniModeV159A(U, tc); /* v159 A: the team palette */ if (U.j !== "team" && U.p !== "team") return U; var o = Object.assign({}, U); if (o.j === "team") o.j = (tc && hexOk(tc[0])) || teamCol(0); if (o.p === "team") o.p = (tc && hexOk(tc[1])) || teamCol(1); return o; }

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
    var fresh = !d || d.v !== 1;
    if (fresh) d = { v: 1, owned: {}, equipped: {}, ach: {}, ts: null };
    d.owned = d.owned && typeof d.owned === "object" ? d.owned : {};
    d.equipped = d.equipped && typeof d.equipped === "object" ? d.equipped : {};
    d.ach = d.ach && typeof d.ach === "object" ? d.ach : {};
    mem = d;
    if (!d.v156C) migrateV156C(d, fresh);   // v156 C: what this device already owned stays owned
    return d;
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
    if (it.source === "member") return gfV156C(id) || memberV156C();   // v156 C
    if (it.source === "super") return !!load().owned[id] || gfV156C(id);
    return false;
  }
  function grant(id, source, reward) {
    syncPass(); var it = findItem(id) || (reward ? passItem(Object.assign({}, reward, { id: id })) : null); if (!it) return false;
    if (it.source === "free") return true;
    if (it.source === "member") return owned(id);   // v156 C: the membership is the only way in — never granted
    if (it.source === "super" && source !== "super" && !owned(id)) return false;   // only a super challenge grants a super look
    if (it.source === "shop" || it.source === "founder") {
      var m = M(); if (!m) return false;
      try { m.grant("cos:" + id, { source: source || it.source }); } catch (e) { return false; }
      V.grants.push({ id: id, source: source || it.source }); fire({ grant: id }); return true;
    }
    var S = load(); if (S.owned[id]) return true;
    S.owned[id] = { source: source || it.source, at: Date.now() }; persist();
    V.grants.push({ id: id, source: source || it.source });
    if ((source || it.source) === "earned") toast("🎁 Unlocked: " + it.name + " (" + CATS[it.cat].name.toLowerCase() + ")");
    if ((source || it.source) === "super") toast("🌟 SUPER LOOK UNLOCKED: " + it.name);
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
    if (it.source === "member") return "Membership";   // v156 C — the Locker shows "🔒 Membership"
    if (it.source === "super") return "Super challenge: " + superDescV156C(it.id);
    var p = PACKS.find(function (q) { return q.id === it.packs[0]; });
    return (p ? p.name : "Store") + (p && p.price ? " · " + p.price : "");
  }
  /* shop / founder items are not shown as purchasable with monetization OFF (owned ones still show) */
  function listed(it) { if (it.season && window.RIB_SEASONS && !owned(it.id)) { try { if (window.RIB_SEASONS.current().id !== it.season) return false; } catch (e) {} } return owned(it.id) || it.source === "free" || it.source === "earned" || it.source === "pass" || it.source === "member" || (it.source === "super" && cosOnV156C()) || shopOn(); }

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
    accountV156C(A, st, hof, e);   // v156 C: the harder milestones (League MVPs, Hall careers that made it, rings, Legacy medal)
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
        var HM = H ? helmMaskV158A(s, W, Hh, head, top, srcName, H) : null;   // v158 A: the helmet, its stripe where the art drew it
        for (var yy = 0; yy < Hh; yy++) {
          var pl = 1e9, pr = -1;
          if (UPS && yy > waist) for (var xq = 0; xq < W; xq++) { var iq = (yy * W + xq) * 4; if (s[iq + 3] >= 20 && classify(s[iq], s[iq + 1], s[iq + 2])[0] === 2) { if (xq < pl) pl = xq; if (xq > pr) pr = xq; } }
          for (var xx = 0; xx < W; xx++) {
            var i = (yy * W + xx) * 4; if (s[i + 3] < 20) continue;
            var hm = HM ? HM.m[yy * W + xx] : 0, inHelm = HM ? hm > 0 : yy < top && H;   // v158 A
            var k = HM ? (hm ? helmClassV158A(s, i) : classify(s[i], s[i + 1], s[i + 2])) : inHelm ? shellClass(s[i], s[i + 1], s[i + 2]) : classify(s[i], s[i + 1], s[i + 2]), cls = k[0]; if (!cls) continue;
            var sc = Math.min(1.75, Math.max(0.25, inHelm ? k[1] : k[1] / (cls === 1 ? 95 : 165))), out = null;
            if (inHelm) {
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
              var hr = HM ? null : hRows[yy];
              if (HM) out = helmPaintV158A(out, hm, HST, HD, s2);   // v158 A: stripe / mask trim / decal off the art's own gold
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
    if (U && !U.v159 /* v159 A: in the team palette the jersey IS the team's own — no new clash */ && oppCols && hexOk(oppCols[0]) && cdist(U.j, oppCols[0]) < TUv("cosKitClashV151B", 90)) { clash = true; U = null; }
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
      hs: H ? H.s : null, hst: H ? H.st || null : null, hf: H ? H.f || null : null, hd: H ? H.d || null : null, hdk: H ? H.dk || null : null, hsk: H ? H.sk || null : null /* v158 A */ };
  }
  function kitFromData(k) {
    k = k || {};
    var U = { j: hexOk(k.j) || "#1f4fd0", p: hexOk(k.p) || "#e8c86a", t: hexOk(k.t) || null, pat: String(k.pat || "solid").replace(/[^a-z]/g, ""), ps: hexOk(k.ps) };
    U.pat = PAT_CARD_V153G[U.pat] || U.pat;   // v153 G: the card's figure draws the nearest of its own patterns
    var H = hexOk(k.hs) ? { s: k.hs, st: hexOk(k.hst), f: String(k.hf || "gloss").replace(/[^a-z]/g, ""), d: hexOk(k.hd), dk: String(k.hdk || "").replace(/[^a-z]/g, ""), sk: String(k.hsk || "").replace(/[^a-z]/g, "") } : null;
    return { U: U, H: H };
  }

  /* ---------------- the touchdown ---------------- */
  function celebrate(scene, x, y, cm) {
    var it = item("celebration"), C = it && it.c;
    try { fieldBodyV161A(scene, cm); } catch (e) { errV161A(e); }   // v161 A: his body plays one of the three drawn celebrations
    if (it && scene && scene.add && scene.events && onV159C()) {   // v159 C: the animation system (TU v159C 0 → the tweens below)
      try { var r159 = fieldPlayV159C(scene, x, y, cm, it); V.celebrations.push({ id: it.id, kind: celKindV159C(it), say: (C && C.say) || "", made: r159.made, t: Date.now(), v159c: true }); return true; }
      catch (e) { V.celebrateErr = String(e && e.message || e); errV159C(e); }
    }
    if (!C || !scene || !scene.add) return false;
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
    if (previewV158A(el, it)) return el;   // v158 A: animated banners, styled titles, drawn badges, material nameplates
    if (previewV159C(el, it)) return el;   // v159 C: a celebration's looping mini-stage, a shelf that catches the light
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
    else if (cat === "icon" && it.v157) return previewIconV157C(el, it);   // v157 C
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
    var key = [K.j, K.p, K.t, K.pat, K.hs, K.hst, K.hf, K.hsk, K.hd, K.hdk, helmLogoKeyV160A(K)].join("|");   // v158 A: twin / wide stripes and the decal · v160 A: the team logo
    if (FIG.cache[key]) return FIG.cache[key];
    var W = im.naturalWidth, H = im.naturalHeight, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var x = cv.getContext("2d"); x.drawImage(im, 0, 0);
    var img = x.getImageData(0, 0, W, H), d = img.data, src158 = K.hs && (K.hsk || K.hd) ? new Uint8ClampedArray(d) : null;
    var src160 = helmLogoV160A(K) ? src158 || new Uint8ClampedArray(d) : null;   // v160 A: the shell, read before the recolour
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
    var shell162 = helmShellV162B(d, W, H, neck);   // v162 B: the art's own shell, down to the jaw flaps
    for (var y = 0; y < H; y++) for (var xx = 0; xx < W; xx++) {
      var i = (y * W + xx) * 4; if (d[i + 3] < 20) continue;
      var c = srcClass(d[i], d[i + 1], d[i + 2]), cls = c[0], o = null, t = 1;
      var ex = (xx - hx0) / hrx, ey = (y - hy0) / hry, helmet = (y < neck && ex * ex + ey * ey <= 1) || !!(shell162 && shell162[y * W + xx]);
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
    if (src158) figHelmV158A(d, src158, W, H, K, { hx0: hx0, hy0: hy0, hrx: hrx, hry: hry, visor: visor, neck: neck });   // v158 A
    if (src160) helmLogoPaintV160A(d, src160, W, H, K, { hx0: hx0, hy0: hy0, hrx: hrx, hry: hry, visor: visor, neck: neck });   // v160 A
    x.putImageData(img, 0, 0);
    FIG.cache[key] = cv;
    return cv;
  }
  /* ===== v162 B THE HELMET IS THE HELMET =====
   * The owner: "the profile character sprite's lower helmet bleeds into the jersey — make the colours of the jersey and
   * helmet separate". `figCell` called a navy pixel helmet only inside a hand-measured ELLIPSE over the dome, and the
   * shell does not stop there: its jaw flaps run down beside the face mask to the chin, so they were painted the JERSEY
   * colour and the helmet looked like it melted into the shirt. The shell is now read off the art: the navy connected
   * to the dome (a seed either side of the stripe), walked only through pixels at least `v162BerodeR` (1) px clear of the
   * dark ink — which is what closes the one-pixel gap where the shell touches the left shoulder pad — then grown back
   * out to the ink, and never below the neck. Measured once per art (`FIG.shellV162B`); the ellipse still counts, so
   * nothing that was helmet stops being helmet. Looks only. Kill switch TU("v162Bhelm", 0). `window.__V162B`; `v162Bcheck`. */
  function helmShellV162B(d, W, H, neck) {
    if (!TUv("v162Bhelm", 1)) return null;
    var R = Math.max(0, Math.round(TUv("v162BerodeR", 1))), key = W + "x" + H + ":" + neck + ":" + R;
    if (FIG.shellV162B && FIG.shellV162B.key === key && FIG.shellV162B.img === FIG.img) return FIG.shellV162B.m;
    var N = W * H, navy = new Uint8Array(N), ink = new Uint8Array(N), j, xx, y;
    for (j = 0; j < N; j++) {
      var i = j * 4; if (d[i + 3] < 20) { ink[j] = 1; continue; }
      var c = srcClass(d[i], d[i + 1], d[i + 2])[0]; if (c === 1) navy[j] = 1;
      else if (Math.max(d[i], d[i + 1], d[i + 2]) < 48) ink[j] = 1;
    }
    var clear = function (x0, y0) {
      for (var dy = -R; dy <= R; dy++) for (var dx = -R; dx <= R; dx++) { var X = x0 + dx, Y = y0 + dy; if (X < 0 || Y < 0 || X >= W || Y >= H || ink[Y * W + X]) return false; }
      return true;
    };
    var m = new Uint8Array(N), q = [[Math.round(W * 0.4), Math.round(H * 0.1)], [Math.round(W * 0.68), Math.round(H * 0.13)]];
    while (q.length) {
      var p = q.pop(); xx = p[0]; y = p[1];
      if (xx < 0 || y < 0 || xx >= W || y >= neck) continue;
      j = y * W + xx; if (m[j] || !navy[j] || !clear(xx, y)) continue;
      m[j] = 1; q.push([xx + 1, y], [xx - 1, y], [xx, y + 1], [xx, y - 1]);
    }
    for (var it = 0; it <= R; it++) {   // back out to the ink the erosion kept it off
      var add = [];
      for (y = 0; y < neck; y++) for (xx = 0; xx < W; xx++) { j = y * W + xx; if (m[j] || !navy[j]) continue;
        if ((xx > 0 && m[j - 1]) || (xx < W - 1 && m[j + 1]) || (y > 0 && m[j - W]) || (y < H - 1 && m[j + W])) add.push(j); }
      add.forEach(function (k) { m[k] = 1; });
    }
    var n = 0, lo = 0; for (j = 0; j < N; j++) if (m[j]) { n++; lo = Math.max(lo, (j / W) | 0); }
    FIG.shellV162B = { key: key, img: FIG.img, m: m };
    window.__V162B = { px: n, lowest: lo, neck: neck, erode: R, mask: function () { return m; } };
    return m;
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
    return { mode: "hi", stage: stg, k: +k.toFixed(3), v153: true, geo: { bx: bx, by: by, bw: bw, bh: bh, k: k, neck: neck, dpr: dpr } };   // v157 C: where the body went (the chest number)
  }
  function drawCharacter(cv, kd, age, opts) {
    var k = kitFromData(kd), res = null;
    var K = { j: k.U.j, p: k.U.p, t: k.U.t, pat: k.U.pat, hs: k.H ? k.H.s : null, hst: k.H ? k.H.st : null, hf: k.H ? k.H.f : null,
      hsk: k.H ? k.H.sk || null : null, hd: k.H ? k.H.d || null : null, hdk: k.H ? k.H.dk || null : null };   // v158 A
    try {
      figLoad();
      res = figDraw(cv, age || 22, K);
      if (res) { FIG.drawn++; FIG.last = K; if (opts) res.num = chestNumberV157C(cv, res, opts.num, opts.numfont); return res; }   // v157 C: his number on the chest
      // the art is still on its way: the growth screen's figure now, the card's own the moment it lands
      if (cv && !cv.__v153wait) { cv.__v153wait = 1; FIG.waiting.push(function () { cv.__v153wait = 0; if (cv.isConnected) drawCharacter(cv, kd, age, opts); }); }
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
      pos: e ? String(e.pos || "") : "", num: e ? jerseyNumV157C(e.pos) : null /* v157 C */, level: e ? e.level || 0 : null, levelName: e ? levelName(e.level || 0) : "", age: e ? e.age || null : null, ovr: ovr,
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
    var bdA = badgeAttrsV158A(bdg);   // v158 A: a drawn badge, the team's colours for the team frame / plate
    var html = '<div class="pcard-v151b fr-' + escHtml(fr.css) + (compact ? " compact" : "") + '" data-frame="' + escHtml(fr.id) + '"' + teamVarsV158A(cols) + '>' +
      '<div class="pc-ban-v151b" style="background:' + bn.bg + (bn.edge ? ";border-bottom:2px solid " + bn.edge : "") + '" data-banner="' + escHtml(bn.id) + '">' +
      (ico && ico.glyph ? '<span class="pc-ico-v151b' + (ico.v157 ? " ico157" : "") + '" style="' + iconStyleV157C(ico) + '" data-icon="' + escHtml(ico.id) + '">' + iconInnerV157C(ico) + "</span>" : "") +   // v157 C: an earned icon is its own badge
      (d.gen > 1 ? '<span class="pc-gen-v151b' + (ico && ico.glyph ? " shift" : "") + '">GEN ' + (d.gen | 0) + "</span>" : "") +
      (bdg && bdg.glyph ? '<span class="pc-bdg-v151b' + bdA.cls + '"' + bdA.style + ' data-badge="' + escHtml(bdg.id) + '">' + escHtml(bdg.glyph) + "</span>" : "") + (d.ovr != null ? '<span class="pc-ovr-v151b"><b>' + (d.ovr | 0) + "</b>OVR</span>" : "") + "</div>" +
      '<div class="pc-body-v151b"><div class="pc-fig-v151b"><canvas class="pc-cv-v151b" width="128" height="160"></canvas></div>' +
      '<div class="pc-id-v151b"><div class="pc-name-v151b' + plateClsV158A(npl) + '"' + plateAttrsV158A(npl) /* v158 A */ + ">" + escHtml(String(d.name || "").toUpperCase()) + "</div>" +
      (ttl && ttl.text ? '<div class="pc-title-v151b' + titleClsV158A(ttl) + '" data-title="' + escHtml(ttl.id) + '">' + escHtml(ttl.text) + "</div>" : "") +
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
      var draw = function () { var r = drawCharacter(cv, cz.kit || {}, d.age || 22, { num: d.num != null ? d.num : jerseyNumV157C(d.pos), numfont: cz.numfont }); if (r && r.mode !== "hi" && !draw._again) { draw._again = 1; setTimeout(draw, 700); } };
      if (cv) draw();
      if (cv) cardFlairV153G(cv, cz);   // v153 G: aura + wings behind the figure, the crown on his head (its own layers)
      dressCardV158A(el);   // v158 A: the banner's painter
      shelfV159C(el, d, !data || !!opts.self || !!(el.closest && el.closest(".pcard-host-v151b")));   // v159 C: the shelf catches the light, the numbers count up
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
    if (dock) dock.innerHTML = '<button class="btn" onclick="cosOpenStyleV151B()">🎨 ' + (onV174() ? "The Palette" : "Change Style") /* v174 */ + '</button><div class="btn-row"><button class="btn ghost" onclick="go(\'hof\')">🏛️ Hall of Fame</button><button class="btn secondary" onclick="go(S.player&&S.player.pos?\'hub\':\'menu\')">Back</button></div>';
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
      (cat === "uniform" ? uniColRowV159A() : "") +   // v159 A: Colours — the uniform's own, or the team palette
      (cat === "celebration" && onV161A() ? '<div class="cos-note-v161a">🎲 On every touchdown he picks one of three moves at random — the flex, the backflip or the ball spike. The effect you equip plays around him.</div>' : "") +   // v161 A
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
      { id: "uni_tiger", cat: "uniform", name: "Jungle Stripe", rarity: "epic", source: "earned", ach: "td100", k: { j: "#4b5d2a", p: "#1a1a1a", t: "#1a1a1a", pat: "tiger" } } /* v188: was orange and black */,
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
    if (wingKindV157A(w.kind)) return wingArtV157A(w, frame, key);   // v157 A: the new wing kinds
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
    if (crownOnV157A()) { var c157 = crownArtV157A(cr, frame); if (c157) return c157; }   // v157 A: every crown redrawn (TU "v157Acrown" 0: the v153 G art)
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
  function gAdapterV153G(g) { return gAdapterV157B(g); }   // v157 B: the same rect / circ / seg, plus tri / ring / ell (the v157 B block)
  function cAdapterV153G(ctx) { return cAdapterV157B(ctx); }
  function trailDrawV153G(A, pts, now, life, d, s) {
    if (d.fx && trailOnV157B()) return trailDrawV157B(A, pts, now, life, d, s);   // v157 B: the new footprints draw themselves
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
    ["_auV153G", "_wlV153G", "_wrV153G", "_crV153G", "_auBV157B", "_auFV157B", "_crShV177H"].forEach(function (p) { dropV153G(m, p); });   // v157 B: its two particle layers
    numfontFxV153G(m, null); m._trV153G = null; m._cosV153G = 0; G153.fx.cleared++;
    try { (scene._cosGhostV153G || []).forEach(function (g) { if (g && g.scene) g.setVisible(false); }); var g = scene._cosTrailV153G; if (g && g.scene) g.clear(); } catch (e) {}
  }
  function numfontFxV153G(m, N) {
    m._sewNfV176 = N ? sewSpecV176(N) : null;   // v176: the field prints the number into the shirt (src/05) in this font's colours
    var L = m.label; if (!L || !L.setFontFamily || !L.style) return;
    if (!N) { dropNumV158A(m, null); var o = m._nfOrigV153G; if (o) { try { L.setFontFamily(o.f); L.setColor(o.c); L.setStroke(o.s, o.w); } catch (e) {} m._nfOrigV153G = null; m._nfKeyV153G = null; } return; }
    var st = L.style; if (m._nfKeyV153G === N.id && st.fontFamily === N.d.font && st.color === N.d.col) return;
    if (!m._nfOrigV153G) m._nfOrigV153G = { f: st.fontFamily, c: st.color, s: st.stroke, w: st.strokeThickness };
    L.setFontFamily(N.d.font); L.setColor(N.d.col); L.setStroke(N.d.stroke, Math.max(onV157C("v157Cfig") ? TUv("nfStrokeV157C", 3.6) : 2, st.strokeThickness || 2.2));   // v157 C: a heavier outline reads at broadcast size
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
      if (!F.any && m.team === "you") fieldNumV157C(m, null);   // v157 C: learn the number he wears
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
        auraFieldV157B(scene, m, F.aura, geo, now, down);   // v157 B: the animated aura's particles (behind him and in front)
      } else { dropV153G(m, "_auV153G"); dropV153G(m, "_auBV157B"); dropV153G(m, "_auFV157B"); }
      // the wings: behind him facing the camera, over his back facing away; they flap, and fold a little at a sprint
      if (F.wings) {
        var wd = F.wings.d, wa = wingArtV153G(wd, wd.kind === "flame" ? ((now / 110) | 0) % 2 : wingFrameV157A(wd.kind, now)), wk = texV153G(scene, wa);
        var wl = childV153G(scene, m, "_wlV153G", wk), wr = childV153G(scene, m, "_wrV153G", wk), away = /^u/.test(dir);
        orderV153G(m, wl, away ? "front" : "back"); orderV153G(m, wr, away ? "front" : "back");
        wr.setFlipX(false).setOrigin(wa.ax / wa.w, wa.ay / wa.h); wl.setFlipX(true).setOrigin(1 - wa.ax / wa.w, wa.ay / wa.h);
        var run = Math.min(1, (m._spdPx || 0) / 160), flap = Math.sin(now / (run > 0.3 ? 90 : 260)) * (run > 0.3 ? 0.16 : 0.09);
        var side = dir === "sd" ? 0.55 : (dir === "dr" || dir === "ur") ? 0.8 : 1, wsx = (1 - run * 0.3) * side * TUv("cosWingScaleV153G", 1), wsy = TUv("cosWingScaleV153G", 1);
        var fp157 = wingPoseV159D(now, wd.kind); if (fp157.on) { flap = fp157.rot; wsy *= fp157.sy; wsx *= fp157.sx || 1; fieldPoseV157A(fp157, now, wd); }   // v157 A: a beat of the wings every few seconds — v159 D: never still between (the flutter), the tips stretch as they lag
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
        var cd = F.crown.d, ca = crownAnimOnV159D() ? crownAnimV159D(cd, now) : crownArtV153G(cd, cd.kind === "flame" ? ((now / 120) | 0) % 2 : crownGlintV157A(now)), ck = texV153G(scene, ca), co = m._crV153G;   // v159 D: every crown animates
        if (co && (!co.scene || !co.active)) co = m._crV153G = null;
        if (!co) { co = m._crV153G = scene.add.image(0, 0, ck); m.root.once("destroy", function () { try { co.destroy(); } catch (e) {} }); }
        else if (co.texture.key !== ck) co.setTexture(ck);
        co.setOrigin(ca.ax / ca.w, ca.ay / ca.h).setDepth(TUv("cosCrownDepthV153G", 23.05));
        var hov = hatOffV177H(cd.kind, now), cy = geo.top + (hov != null ? hov : (cd.kind === "halo" ? -2.5 + Math.sin(now / 420) * 0.8 : cd.kind === "horns" ? 4 : 2.5) + crownBobV159D(now));   // v159 D: a gentle bob — v177 H: every hat hovers
        co.setPosition(m.root.x + geo.cx * s, m.root.y + cy * s).setScale(s).setVisible(!down && m.root.visible !== false);
        hatFieldV177H(scene, m, co, ca, cd, geo, now, s, !down && m.root.visible !== false);   // v177 H: its shadow and glow on the helmet
        G153.fx.crown++;
      } else { dropV153G(m, "_crV153G"); dropV153G(m, "_crShV177H"); }
      numfontFxV153G(m, F.numfont);
      fieldNumV157C(m, F.numfont);   // v157 C: his number, bigger, in the font
      // the footprints: world space, under every player
      if (F.trail && G153.freeze) { /* a check holds the drawn footprints still */ }
      else if (F.trail) {
        hookSceneV153G(scene);
        var g = scene._cosTrailV153G; if (!g || !g.scene) g = scene._cosTrailV153G = scene.add.graphics().setDepth(TUv("cosTrailDepthV153G", 3.9));
        var P = m._trV153G; if (!P || P.id !== F.trail.id) P = m._trV153G = { id: F.trail.id, pts: [], seq: 0, lx: null, ly: null };
        var fx = m.root.x + geo.cx * s, fy = m.root.y + (geo.bot - 1) * s, mv = P.lx == null ? 1e9 : Math.hypot(fx - P.lx, fy - P.ly);
        if (mv > 60 * s) { P.lx = fx; P.ly = fy; }   // a jump (a new snap, a re-spot): start again from here
        else if (!down && mv >= TUv("cosTrailStepV153G", 2.2) * s) { P.pts.push({ x: fx, y: fy, t: now, i: P.seq++, rx: m.root.x, ry: m.root.y, s: s, key: b && b.texture ? b.texture.key : "", fl: !!(b && b.flipX) }); P.lx = fx; P.ly = fy; }
        var td = F.trail.d, life = TUv("cosTrailMsV153G", 520) * (td.kind === "ice" || td.kind === "petals" ? 1.5 : 1) * trailLifeV157B(td);   // v157 B: each new trail's tail length
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
  function paintBackV153G(ctx, geo, F, k, shf, pose) {   // v157 A: `pose` (optional) — the wings' flap
    ctx.imageSmoothingEnabled = false;
    if (F.aura && !auraOnV157B()) { var aa = auraArtV153G(F.aura.d), sc = geo.h / 44 * 1.05; ctx.save(); ctx.globalAlpha = 0.6; if (F.aura.d.kind !== "void") ctx.globalCompositeOperation = "lighter"; ctx.imageSmoothingEnabled = true; ctx.drawImage(aa.cv, geo.cx - aa.w * sc / 2, (geo.top + geo.bot) / 2 - aa.h * sc / 2 + 2 * sc, aa.w * sc, aa.h * sc); ctx.restore(); }   // v157 B: when on, cardAuraV157B draws (and animates) the aura on its own layer
    if (F.wings) {
      var wa = wingArtV153G(F.wings.d, pose && pose.flutter && pose.t != null ? wingFrameV159D(F.wings.d.kind, pose.t) : 0), shY = geo.top + geo.h * (shf || 0.3), sp = TUv("cosWingSpreadV153G", 0.32);
      [1, -1].forEach(function (sd) { ctx.save(); ctx.translate(geo.cx + sd * 3.5 * k, shY); ctx.scale(sd, 1); ctx.rotate(-sp - (pose ? pose.rot : 0)); if (pose) ctx.scale(1, pose.sy);
        if (pose && pose.flutter) wingDrawV159D(ctx, wa, k, pose.tip); else ctx.drawImage(wa.cv, -wa.ax * k, -wa.ay * k, wa.w * k, wa.h * k); ctx.restore(); });   // v159 D: the outer half lags (the flutter)
    }
  }
  function paintFrontV153G(ctx, geo, F, k, t) {   // v159 D: `t` (optional) — the crown's animation frame and bob
    ctx.imageSmoothingEnabled = false;
    if (F.crown) { var cd = F.crown.d, ca = t != null ? crownAnimV159D(cd, t) : crownArtV153G(cd, 0), hov = hatOffV177H(cd.kind, t), off = hov != null ? hov : (cd.kind === "halo" ? -2.5 : cd.kind === "horns" ? 4 : 2.5) + crownBobV159D(t);
      if (hov != null) { hatShadowV177H(ctx, geo.cx, geo.top, ca.w, k, hatBobV177H(t), cd); if (G177H) G177H.card++; }   // v177 H: every hat hovers, its shadow and glow on the helmet
      ctx.imageSmoothingEnabled = false; ctx.drawImage(ca.cv, geo.cx - ca.ax * k, geo.top + off * k - ca.ay * k, ca.w * k, ca.h * k); }
  }
  function flairFromIdsV153G(cz) {
    var get = function (id, cat, fld) { var it = id ? findItem(id) : null; return it && it.cat === cat && it[fld] ? { id: it.id, d: it[fld] } : null; };
    cz = cz || {};
    return { wings: get(cz.wings, "wings", "w"), crown: get(cz.crown, "crown", "cr"), aura: get(cz.aura, "aura", "au"), trail: get(cz.trail, "trail", "tr"), numfont: get(cz.numfont, "numfont", "nf") };
  }
  function cardFlairV153G(cv, cz) {
    try {
      var host = cv && cv.parentNode; if (!host) return false;
      Array.prototype.slice.call(host.querySelectorAll(".pc-fl-v153g,.pc-au-v157b")).forEach(function (o) { o.remove(); });
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
        if (F.wings) flapRegV157A(back, function (pose) { bx.clearRect(0, 0, back.width, back.height); paintBackV153G(bx, geo, F, k * 0.75, 0.42, pose); }, "card", F.wings.d.kind);   // v157 A
        if (F.crown) crownRegV159D(front, function (t) { fx.clearRect(0, 0, front.width, front.height); paintFrontV153G(fx, geo, F, k * 0.85, t); }, "card");   // v159 D: the crown animates
        var inkOf = function (c) { var d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data, n = 0; for (var i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return n; };
        G153.card = { wings: F.wings && F.wings.id, crown: F.crown && F.crown.id, aura: F.aura && F.aura.id, back: inkOf(back), front: inkOf(front), geo: geo };
        return true;
      };
      paint(); setTimeout(paint, 750); setTimeout(paint, 1600);
      cardAuraV157B(host, cv, F, PAD);   // v157 B: the aura, animated, on its own two layers
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
    if (previewV157B(el, it)) return el;   // v157 B: auras and footprints preview animated
    el.innerHTML = "";
    var cv = document.createElement("canvas"); cv.width = 64; cv.height = 64; cv.className = "cos-fl-v153g"; var x = cv.getContext("2d");
    try {
      if (it.cat === "numfont") {
        var tc = (window.__GRIDIRON_TEAM_CUSTOM__ || {}).col || ["#1f4fd0", "#e8c86a"], nf = it.nf || (onV159A("v159Anum") ? inkNfV159A(tc) : { font: "Oswald, sans-serif", col: "#ffffff", stroke: "#0a0e14" });   // v159 A: the kit's contrast
        x.fillStyle = hexOk(tc[0]) || "#1f4fd0"; x.beginPath(); x.moveTo(14, 12); x.lineTo(24, 8); x.lineTo(40, 8); x.lineTo(50, 12); x.lineTo(50, 58); x.lineTo(14, 58); x.closePath(); x.fill();
        var nn = String(jerseyNumV157C((gstate() || {}).player && gstate().player.pos) || 23);   // v157 C: his own number
        if (!nfPreviewV158A(x, it, nn)) { x.font = "bold 26px " + nf.font; x.textAlign = "center"; x.textBaseline = "middle"; x.lineWidth = 3; x.strokeStyle = nf.stroke; x.strokeText(nn, 32, 35); x.fillStyle = nf.col; x.fillText(nn, 32, 35); }   // v158 A: the drawn face
        previewPrintV159A(x);   // v159 A: the jersey's light over the print
      } else {
        var F = { trail: it.tr ? { id: it.id, d: it.tr } : null, wings: it.w ? { id: it.id, d: it.w } : null, crown: it.cr ? { id: it.id, d: it.cr } : null, aura: it.au ? { id: it.id, d: it.au } : null };
        var fig = figV153G(34), fx0 = F.trail ? 26 : 15, fy0 = 64 - fig.height - 2, geo = inkGeoV153G(fig, fx0, fy0) || { top: fy0, bot: 62, cx: fx0 + 17, h: 36 }, k = geo.h / 44;
        if (F.trail) { var pts = [], life = 520, now = 1000; for (var i = 0; i < 16; i++) pts.push({ x: 4 + i * 1.6, y: geo.bot - 1 - (F.trail.d.kind === "ghost" ? 0 : 0), t: now - life * (1 - i / 16) * 0.95, i: i });
          if (F.trail.d.kind === "ghost") { x.globalAlpha = 0.35; for (var gi = 0; gi < 3; gi++) x.drawImage(fig, fx0 - 18 + gi * 6, fy0); x.globalAlpha = 1; x.globalCompositeOperation = "source-atop"; x.fillStyle = (it.tr.col || ["#8fe3ff"])[0]; x.fillRect(0, 0, fx0, 64); x.globalCompositeOperation = "source-over"; }
          else trailDrawV153G(cAdapterV153G(x), pts, now, life, F.trail.d, 1.4); x.globalAlpha = 1; }
        if (!F.trail && !F.wings && !F.crown && !F.aura) { x.globalAlpha = 0.45; }
        paintBackV153G(x, geo, F, k); x.drawImage(fig, fx0, fy0); x.globalAlpha = 1; paintFrontV153G(x, geo, F, k);
        if (F.wings && !F.trail) flapRegV157A(cv, function (pose) { x.clearRect(0, 0, 64, 64); paintBackV153G(x, geo, F, k, null, pose); x.drawImage(fig, fx0, fy0); paintFrontV153G(x, geo, F, k); }, "preview", F.wings.d.kind);   // v157 A
        if (F.crown && !F.wings && !F.trail) crownRegV159D(cv, function (t) { x.clearRect(0, 0, 64, 64); paintBackV153G(x, geo, F, k); x.drawImage(fig, fx0, fy0); paintFrontV153G(x, geo, F, k, t); }, "preview");   // v159 D
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

  /* ===== v156 C EARNED LOOKS, MEMBER LOOKS, SUPER LOOKS =====
   * The owner's call (docs/MONETIZATION.md §1, docs/SEASONS.md §8): the nicer, appearance-changing looks are harder to
   * get. Three moves, all behind TU("v156Ccos", 0) — off, every item wears its v151 B / v153 G source again:
   *   MEMBER   most of the legendary / mythic looks and the flashiest epics (uniforms, helmets, wings, crowns, auras,
   *            trails, celebrations, frames) take a new source, "member": owned while the store is ON and the device
   *            holds `member` (or `founder`). With the store OFF they are LISTED — locked, "🔒 Membership", the visible
   *            incentive — and never owned, never granted, and nothing calls the store (M() is null while OFF).
   *   LATER    a few nice ones stay free but "waaay later" — new achievements: Legacy medal 300, 3 and 5 UFF titles
   *            (rings across careers), the fifth generation. The weak ones are tightened: `hof` needs a Hall career
   *            that made the UFF (was: any finished career), `mvp` a League MVP (college or higher — not a high-school
   *            Player of the Year).
   *   SUPER    mythic looks for the season ladder's tough, never-resetting SUPER CHALLENGES (below; the section is
   *            drawn by src/29). Angel Wings are the hardest: an Interstellar title at all nine positions — and the
   *            Career Pass no longer draws angel-style wings at all.
   * GRANDFATHERED: the first time this version opens the cosmetics store (`migrateV156C`, from load()) it snapshots
   * what the device already owned — every stored item, and every earned item whose OLD achievement it had hit — into
   * `gf156`; those stay owned whatever their new source. Entitlements still never live in the save. */
  function cosOnV156C() { return !!TUv("v156Ccos", 1); }
  function memberV156C() { return !!M() && (mHas("member") || mHas("founder")); }
  function gfV156C(id) { var S = load(); return !!(S.gf156 && S.gf156[id]); }
  function migrateV156C(d, fresh) {
    d.gf156 = {};
    if (!fresh) {
      Object.keys(d.owned).forEach(function (id) { d.gf156[id] = 1; });
      ITEMS.forEach(function (it) { var src = it._src0 || it.source, ach = it._ach0 || it.ach; if (src === "earned" && ach && d.ach[ach]) d.gf156[it.id] = 1; });
    }
    d.v156C = Date.now();
    if (!fresh) persist();   // a fresh device writes nothing until it owns something
  }
  /* the re-sourcing table: id → "member" | [source, ach, rarity?] */
  var RULES_V156C = {
    uni_blackout: "member", uni_gold_std: "member", uni_tiger: "member", uni_royal_chev: "member", uni_mvp_white: "member", uni_marble: "member",
    hel_chrome_gold: "member", hel_interstellar: "member", hel_ruby: "member", hel_marble: "member",
    frame_platinum: "member", frame_cosmic: "member", frame_lava: "member", frame_holo: "member", frame_angel: "member",
    cel_goldrain: "member", cel_meteor: "member", cel_halo: "member", cel_feathers: "member",
    vault_obsidian: "member", vault_nebula: "member", shelf_marble: "member",
    trail_flame: "member", trail_lightning: "member", trail_ghost: "member", trail_stars: "member",
    wings_crystal: "member", wings_bat: "member", wings_mech: "member", wings_seraph: "member",
    crown_gold: "member", crown_horns: "member", crown_halo: "member", crown_flame: "member", crown_star: "member",
    aura_gold: "member", aura_flame: "member", aura_void: "member", nf_chrome: "member",
    // free, but waaay later
    uni_nebula: ["earned", "legacy300"], frame_void: ["earned", "legacy300"],
    crown_mvp: ["earned", "rings3"], crown_king: ["earned", "rings5"], wings_phoenix: ["earned", "rings5"],
    ban_lineage: ["earned", "gen5"], aura_holy: ["earned", "gen5"],
    // the hardest look in the game
    wings_angel: ["super", null, "mythic"]
  };
  (function resourceV156C() {
    Object.keys(RULES_V156C).forEach(function (id) {
      var it = BY[id]; if (!it || it._src0) return;
      var r = RULES_V156C[id], src = r === "member" ? "member" : r[0], ach = r === "member" ? null : r[1], rar = r === "member" ? null : r[2];
      it._src0 = it.source; it._ach0 = it.ach; it._rar0 = it.rarity;
      delete it.source; delete it.ach; delete it.rarity;
      Object.defineProperty(it, "source", { enumerable: true, configurable: true, get: function () { return cosOnV156C() ? src : it._src0; } });
      Object.defineProperty(it, "ach", { enumerable: true, configurable: true, get: function () { return cosOnV156C() ? ach || undefined : it._ach0; } });
      Object.defineProperty(it, "rarity", { enumerable: true, configurable: true, get: function () { return cosOnV156C() && rar ? rar : it._rar0; } });
    });
  })();
  /* the achievements: two tightened, four added (the "waaay later" rungs) */
  (function () {
    var set = function (id, test, desc) { var a = ACH_BY[id]; if (!a) return; var t0 = a.test, d0 = a.desc; a.test = function (A) { return cosOnV156C() ? test(A) : t0(A); }; if (cosOnV156C()) a.desc = desc; a._desc0 = d0; };
    set("hof", function (A) { return A.hofWon >= 1; }, "Enshrine a career that made the UFF in the Hall of Fame");
    set("mvp", function (A) { return A.leagueMvps >= 1; }, "Be named League MVP (college or higher)");
    [{ id: "legacy300", name: "Legacy medal 300", desc: "Reach Legacy medal 300", test: function (A) { return A.legacyMedal >= TUv("cosLegacyMedalV156C", 300); } },
      { id: "rings3", name: "Three UFF titles", desc: "Win 3 UFF championships (across your careers)", test: function (A) { return A.uffRings >= 3; } },
      { id: "rings5", name: "Five UFF titles", desc: "Win 5 UFF championships (across your careers)", test: function (A) { return A.uffRings >= 5; } },
      { id: "gen5", name: "Fifth generation", desc: "Play as the fifth generation of your family", test: function (A) { return A.gen >= 5; } }
    ].forEach(function (a) { if (!ACH_BY[a.id]) { ACH.push(a); ACH_BY[a.id] = a; } });
  })();
  var LMVP_RE_V156C = /League MVP/i;
  function accountV156C(A, st, hof, e) {
    try {
      A.hofWon = hof.filter(function (h) { return h && (h.won || (h.reached | 0) >= 7 || (h.level | 0) >= 7); }).length;
      var mvps = 0, rings = 0;
      var scan = function (log) { (log || []).forEach(function (r) { if (r && (r.level | 0) >= 5) (r.awards || []).forEach(function (a) { if (LMVP_RE_V156C.test(String((a && a.name) || a || ""))) mvps++; }); }); };
      hof.forEach(function (h) { if (!h) return; rings += h.rings | 0; if (h.box) scan(h.box.log); });
      if (e) { rings += e.nflRings | 0; scan(e.seasonLogV77); }
      A.leagueMvps = mvps;
      A.uffRings = Math.max(rings, (A.uffTitles | 0) + (A.interstellarTitles | 0));
      var L = window.__V152A, xp = st && st.legacyV152 ? st.legacyV152.xp : null;
      A.legacyMedal = L && L.rank && xp != null ? (L.rank(xp).medal | 0) : 0;
    } catch (x) {}
  }

  /* ---- the SUPER looks (mythic, source "super"): only a super challenge grants one ---- */
  function itemsV156C() {
    return [
      { id: "crown_ladder", cat: "crown", name: "Ladder Laurel", rarity: "mythic", source: "super", cr: { kind: "laurel", col: ["#e8f4ff", "#6fd3ff", "#1f3a8a"] } },
      { id: "aura_supernova", cat: "aura", name: "Supernova", rarity: "mythic", source: "super", au: { kind: "void", col: "#ff5a1a" } },
      { id: "trail_goldrush", cat: "trail", name: "Gold Rush", rarity: "mythic", source: "super", tr: { kind: "comet", col: ["#fff6c0", "#ffd76f", "#e6b53a"] } },
      { id: "frame_ultimate", cat: "frame", name: "The Ultimate", rarity: "mythic", source: "super", css: "ultimate", anim: 1 }
    ];
  }
  if (cosOnV156C()) {   // angel wings come from the super challenge alone — never from a Career Pass tier
    POOLS_V153G.wings = POOLS_V153G.wings.map(function (p) { return p.filter(function (s) { return s !== "angel"; }); });
    delete VARS_V153G.wings.angel;
  }
  /* ---- the SUPER CHALLENGES — tough, account-wide, never reset by a season: `rib.super.v1` (outside the save) ----
   * ladder10         the best rank of your careers on this season's career board, once a UTC day; 10 days at rank ≤ 10.
   *                  The boards are LOCAL today (every row is yours), so any career on the season board is rank ≤ 10 —
   *                  with the remote board (`__LB_CONFIG.careerUrl`) it will mean the real top 10 (docs/SEASONS.md §8).
   * allPositions     an Interstellar (level 8) title at each of QB RB WR TE OL DL LB CB S — the season log's champion
   *                  rows and every Hall box, remembered here so a Hall that prunes a career loses nothing.
   * mvpInterstellar  one career with a League MVP AND an Interstellar title, both inside its first X seasons (TU 14).
   * goldRush         10 UFF championships across careers.   ultimate   Legacy medal 500. */
  var SUPER_V156C = [
    { id: "ladder10", item: "crown_ladder", name: "Top 10 for 10 Days", icon: "📈", goal: function () { return TUv("superLadderDaysV156C", 10); }, desc: function () { return "Hold a top-10 spot on the season's career leaderboard on " + TUv("superLadderDaysV156C", 10) + " different days"; } },
    { id: "allPositions", item: "wings_angel", name: "Interstellar at Every Position", icon: "🪐", goal: function () { return 9; }, desc: function () { return "Win the Interstellar championship at all nine positions — QB RB WR TE OL DL LB CB S"; } },
    { id: "mvpInterstellar", item: "aura_supernova", name: "MVP to the Stars", icon: "🌠", goal: function () { return 2; }, desc: function () { return "In one career, be League MVP and win the Interstellar championship — both within its first " + TUv("superMvpSeasonsV156C", 14) + " seasons"; } },
    { id: "goldRush", item: "trail_goldrush", name: "Gold Rush", icon: "💍", goal: function () { return TUv("superRingsV156C", 10); }, desc: function () { return "Win " + TUv("superRingsV156C", 10) + " UFF championships across your careers"; } },
    { id: "ultimate", item: "frame_ultimate", name: "The Ultimate", icon: "🎖", goal: function () { return 500; }, desc: function () { return "Reach Legacy medal 500 — the last medal there is"; } }
  ];
  var SUPER_IDS_V156C = SUPER_V156C.map(function (c) { return c.item; });
  var POS9_V156C = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S"];
  function superDescV156C(itemId) { var c = SUPER_V156C.filter(function (x) { return x.item === itemId; })[0]; return c ? c.desc() : "a super challenge"; }
  var SKEY_V156C = "rib.super.v1", smem = null;
  function sload() {
    if (smem) return smem;
    var d = null; try { d = JSON.parse(localStorage.getItem(SKEY_V156C) || "null"); } catch (e) { d = null; }
    if (!d || d.v !== 1) d = { v: 1, days: {}, pos: {}, best: {}, done: {} };
    ["days", "pos", "best", "done"].forEach(function (k) { if (!d[k] || typeof d[k] !== "object") d[k] = {}; });
    return (smem = d);
  }
  function ssave() { try { localStorage.setItem(SKEY_V156C, JSON.stringify(sload())); } catch (e) {} }
  function dayV156C(ts) { var S = window.RIB_SEASONS, t = ts != null ? ts : S && S.now ? S.now() : Date.now(); return new Date(t).toISOString().slice(0, 10); }
  // the best rank any of this device's careers holds on the current season's board (null: none on it)
  function ladderRankV156C() {
    try {
      var C = window.__lb && window.__lb.career, S = window.RIB_SEASONS; if (!C || !S) return null;
      var rows = C.rank(C.all(), "season", { seasonId: S.current().id, limit: 10 });
      return rows.length ? 1 : null;   // LOCAL: every row is his; the first is his best
    } catch (e) { return null; }
  }
  // the careers the record still holds, as {pos, rows:[{n, level, champion, awards}]}
  function careersV156C(st) {
    var out = [], e = st && st.player;
    ((st && st.hof) || []).forEach(function (h) { if (h && h.box && h.box.log) out.push({ pos: h.pos, rows: h.box.log }); });
    if (e && e.seasonLogV77) out.push({ pos: e.pos, rows: e.seasonLogV77, live: true });
    return out;
  }
  function superScanV156C(st) {
    var S = sload(), ch = false, X = TUv("superMvpSeasonsV156C", 14), A = account(st);
    careersV156C(st).forEach(function (c) {
      var mvp = false, isl = false;
      c.rows.forEach(function (r) {
        if (!r) return;
        var pos = String(r.pos || c.pos || "").toUpperCase();
        if ((r.level | 0) >= 8 && r.champion && POS9_V156C.indexOf(pos) >= 0 && !S.pos[pos]) { S.pos[pos] = Date.now(); ch = true; }
        if ((r.n | 0) > 0 && (r.n | 0) <= X) {
          if ((r.level | 0) >= 5 && (r.awards || []).some(function (a) { return LMVP_RE_V156C.test(String((a && a.name) || a || "")); })) mvp = true;
          if ((r.level | 0) >= 8 && r.champion) isl = true;
        }
      });
      var sc = (mvp ? 1 : 0) + (isl ? 1 : 0);
      if (sc > (S.best.mvpInterstellar | 0)) { S.best.mvpInterstellar = sc; ch = true; }
    });
    if ((A.uffRings | 0) > (S.best.goldRush | 0)) { S.best.goldRush = A.uffRings | 0; ch = true; }
    if ((A.legacyMedal | 0) > (S.best.ultimate | 0)) { S.best.ultimate = A.legacyMedal | 0; ch = true; }
    return ch;
  }
  function superHaveV156C(id) {
    var S = sload();
    if (id === "ladder10") return Object.keys(S.days).length;
    if (id === "allPositions") return POS9_V156C.filter(function (p) { return S.pos[p]; }).length;
    return S.best[id] | 0;
  }
  function superProgressV156C() {
    var S = sload();
    return SUPER_V156C.map(function (c) {
      var it = BY[c.item] || {}, g = c.goal(), have = Math.min(g, superHaveV156C(c.id));
      return { id: c.id, name: c.name, icon: c.icon, desc: c.desc(), goal: g, have: have, done: !!S.done[c.id], at: S.done[c.id] || null, item: c.item, itemName: it.name || c.item, rarity: "mythic", cat: it.cat || "",
        owned: owned(c.item), positions: c.id === "allPositions" ? POS9_V156C.map(function (p) { return { pos: p, won: !!S.pos[p] }; }) : null };
    });
  }
  function superTickV156C(st) {
    if (!cosOnV156C()) return [];
    st = st || gstate();
    var S = sload(), ch = false, got = [];
    try {
      var day = dayV156C();
      if (!S.days[day]) { var rk = ladderRankV156C(); if (rk != null && rk <= 10) { S.days[day] = rk; ch = true; } }
      if (st) ch = superScanV156C(st) || ch;
      SUPER_V156C.forEach(function (c) {
        if (S.done[c.id] || superHaveV156C(c.id) < c.goal()) return;
        S.done[c.id] = Date.now(); ch = true;
        grant(c.item, "super"); got.push(c.item);
      });
    } catch (e) {}
    if (ch) ssave();
    return got;
  }
  window.RIB_SUPER = { list: function () { return SUPER_V156C.map(function (c) { return { id: c.id, item: c.item, name: c.name }; }); }, progress: superProgressV156C, tick: superTickV156C, on: cosOnV156C };
  window.__V156C = Object.assign(window.__V156C || {}, {
    rules: function () { return JSON.parse(JSON.stringify(RULES_V156C)); },
    member: memberV156C, grandfathered: function () { return Object.keys(load().gf156 || {}); },
    reloadCosmetics: function () { mem = null; return load(); }, reloadSuper: function () { smem = null; return sload(); },
    superProgress: superProgressV156C, superTick: superTickV156C, superStore: function () { return JSON.parse(JSON.stringify(sload())); },
    recordDay: function (day, rank) { var S = sload(); S.days[String(day)] = rank == null ? 1 : rank; ssave(); return Object.keys(S.days).length; },
    recordPos: function (pos) { var S = sload(); pos = String(pos).toUpperCase(); if (POS9_V156C.indexOf(pos) >= 0) { S.pos[pos] = Date.now(); ssave(); } return superHaveV156C("allPositions"); },
    resetSuper: function () { smem = null; try { localStorage.removeItem(SKEY_V156C); } catch (e) {} }
  });
  // super challenges are checked with the earned ones (boot, every save) and on src/29's observer
  (function () { var ce = checkEarned; checkEarned = function (st) { var got = ce(st); try { superTickV156C(st); } catch (e) {} return got; }; })();
  (function () {
    if (document.getElementById("cosV156Ccss")) return;
    var st = document.createElement("style"); st.id = "cosV156Ccss";
    st.textContent = [
      ".fr-ultimate{border-color:#fff3c4;animation:cosUltV156C 3s linear infinite;background:radial-gradient(ellipse at 50% 0,rgba(255,215,111,.22),transparent 60%),linear-gradient(180deg,#1b1406,#07090e)}",
      "@keyframes cosUltV156C{0%,100%{box-shadow:0 0 0 2px #8a6414,0 0 0 4px #ff5a1a,0 0 26px rgba(255,215,111,.6)}33%{box-shadow:0 0 0 2px #8a6414,0 0 0 4px #b98bff,0 0 30px rgba(185,139,255,.6)}66%{box-shadow:0 0 0 2px #8a6414,0 0 0 4px #6fd3ff,0 0 30px rgba(111,211,255,.6)}}",
      "@media(prefers-reduced-motion:reduce){.fr-ultimate{animation:none;box-shadow:0 0 0 2px #8a6414,0 0 0 4px #ff5a1a,0 0 26px rgba(255,215,111,.6)}}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(st);
  })();

  /* ===== v157 A WINGS THAT FLAP, CROWNS THAT SHINE =====
   * The owner: "Make crowns a little more detailed, some look sloppy. Add like 15 more wings, mech, demon, skeleton,
   * football, dragon, etc. Have them flap up and down every few seconds."
   *   WINGS    seventeen new kinds, each its own silhouette drawn from code (`WINGS_V157A`, the RIGHT wing, shoulder at
   *            (0, ay) — `wingArtV153G` hands a new kind here): origami paper, thornvine, raven, pigskin (laced leather
   *            footballs), skeleton (bone ribs), clockwork (a brass gear), stormcaller (lightning), cyber grid, shade
   *            (smoke), demon (spiked, torn, ember-veined membrane), dragon (scaled, horned, gold-boned), jet (swept
   *            plates, two thrusters), hellfire (flame tongues), cathedral (stained glass), prism (rainbow panes),
   *            gilded aegis (gold armour plates), galaxy (a nebula sickle). The owner's "harder" rule: three plain ones
   *            free, a few earned (a title, the third generation, 100 TDs, and — waaay later — 3 UFF rings, the fifth
   *            generation, Legacy medal 300), and the flashiest eight are MEMBER looks (listed "🔒 Membership" while the
   *            store is OFF, never granted). Angel Wings stay the super challenge's.
   *   FLAP     every wing (old and new) beats `wingFlapBeatsV157A` times in `wingFlapMsV157A` ms, then rests still for
   *            the rest of `wingFlapPeriodV157A` ms (3.4 s) — on the live field (the scene clock), the profile card and
   *            the Locker previews (performance.now, one shared rAF ticker that repaints only while a beat is on).
   *            A pure function of time: no Math.random, no sim read. prefers-reduced-motion: no flap.
   *            Kill switch TU("v157Aflap", 0): the v153 G idle sway on the field, still wings on the card.
   *   CROWNS   every crown kind redrawn as symmetric pixel maps (`crownArtV157A`): a metal ramp (highlight, light, mid,
   *            dark, deep), jewels with a highlight and a white glint, engraved bands, pearls, velvet and ermine on the
   *            royal crown, ridged horns, a three-tone crown of fire, pixel stars, a leafed laurel with a ribbon. On the
   *            field a crown catches the light for a moment every few seconds (`crownGlintV157A`, frame 2).
   *            Kill switch TU("v157Acrown", 0): the v153 G art.
   * `window.__V157A` is what v157Acheck reads. */
  function crownOnV157A() { return !!TUv("v157Acrown", 1); }
  function flapOnV157A() { return !!TUv("v157Aflap", 1); }
  var G157 = (window.__V157A = window.__V157A || { field: null, fieldN: 0, ticks: 0, paints: 0, regs: 0, errs: [] });
  function errV157A(e) { try { if (G157.errs.length < 8) G157.errs.push(String((e && e.message) || e)); } catch (x) {} }

  /* ---- the catalogue ---- */
  function itemsV157A() {
    var W = function (id, name, rarity, source, ach, kind, col) { var it = { id: id, cat: "wings", name: name, rarity: rarity, source: source, w: { kind: kind, col: col } }; if (ach) it.ach = ach; return it; };
    return [
      // free — the plain ones
      W("wings_paper", "Origami", "common", "free", null, "paper", ["#f4f1e8", "#c9c2b0", "#6b6452"]),
      W("wings_thorn", "Thornvine", "rare", "free", null, "thorn", ["#3f7a2a", "#6fbf4a", "#14240c"]),
      W("wings_raven", "Raven", "rare", "free", null, "raven", ["#1c1f2b", "#4a5a9a", "#07080c"]),
      // earned — early, then waaay later
      W("wings_football", "Pigskin Wings", "rare", "earned", "title", "football", ["#8a4a22", "#5a2e14", "#ffffff"]),
      W("wings_skeleton", "Bone Wings", "epic", "earned", "gen3", "skeleton", ["#ece6d2", "#b8ad8e", "#2a2418"]),
      W("wings_clockwork", "Clockwork", "epic", "earned", "td100", "clockwork", ["#e0ac48", "#8a5a1a", "#2e1c06"]),
      W("wings_dragon", "Dragon Wings", "legendary", "earned", "rings3", "dragon", ["#2f8a3a", "#e6b53a", "#0c220f"]),
      W("wings_prism", "Prism", "legendary", "earned", "gen5", "prism", ["#eef8ff", "#bfe6ff", "#3a5a8a"]),
      W("wings_gilded", "Gilded Aegis", "mythic", "earned", "legacy300", "gilded", ["#ffd76f", "#b8862a", "#3a2606"]),
      // member — the flashiest
      W("wings_storm", "Stormcaller", "epic", "earned", "uff", "lightning", ["#ffffff", "#8fd0ff", "#1f4fbf"]),
      W("wings_cyber", "Cyber Grid", "epic", "earned", "uff", "cyber", ["#6ff7ff", "#ff3df2", "#0a0f24"]),
      W("wings_shade", "Shade", "epic", "earned", "gen3", "shadow", ["#241a33", "#7a5ad2", "#050308"]),
      W("wings_demon", "Demon Wings", "legendary", "earned", "td100", "demon", ["#8a1020", "#2a050c", "#ff7a1a"]),
      W("wings_jet", "Jet Wings", "legendary", "earned", "uff", "jet", ["#c9ced6", "#5a6270", "#ff8a2a"]),
      W("wings_hellfire", "Hellfire", "legendary", "earned", "mvp", "hellfire", ["#f0e0ff", "#9a4bff", "#2a0a5a"]),
      W("wings_cathedral", "Cathedral", "legendary", "earned", "hof", "cathedral", ["#c8203a", "#1f5fbf", "#16161c"]),
      W("wings_galaxy", "Galaxy", "mythic", "earned", "interstellar", "galaxy", ["#140c40", "#b04bff", "#ff7ad5"])
    ];
  }

  /* ---- raster helpers (a Raster's own coordinates: 0..W-1, 0..H-1) ---- */
  function lnV157A(R, x0, y0, x1, y1, c, a) { var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0; for (var k = 0; k <= n; k++) { var t = k / Math.max(1, n); R.put(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, c, a); } }
  function inPolyV157A(P, x, y) { var ins = false; for (var i = 0, j = P.length - 1; i < P.length; j = i++) { var xi = P[i][0], yi = P[i][1], xj = P[j][0], yj = P[j][1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins; } return ins; }
  function edgeDistV157A(P, x, y) { var best = 1e9; for (var i = 0, j = P.length - 1; i < P.length; j = i++) { var ax = P[j][0], ay = P[j][1], bx = P[i][0], by = P[i][1], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0; best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t)); } return best; }
  function polyV157A(R, P, fn) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; P.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    for (var y = Math.floor(y0); y <= Math.ceil(y1); y++) for (var x = Math.floor(x0); x <= Math.ceil(x1); x++) if (inPolyV157A(P, x + 0.5, y + 0.5)) { var c = fn(x, y); if (c) R.put(x, y, c.c || c, c.a); }
  }
  function hV157A(x, y, s) { return ihV153G(((x + 64) * 73856093) ^ ((y + 64) * 19349663) ^ ((s | 0) * 83492791)); }
  // a smooth value noise on a coarse grid, for the nebula and the smoke
  function vnV157A(x, y, g, s) { var gx = Math.floor(x / g), gy = Math.floor(y / g), fx = x / g - gx, fy = y / g - gy, q = function (a, b) { return hV157A(a, b, s); };
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    return (q(gx, gy) * (1 - fx) + q(gx + 1, gy) * fx) * (1 - fy) + (q(gx, gy + 1) * (1 - fx) + q(gx + 1, gy + 1) * fx) * fy; }
  var WHITE_V157A = [255, 255, 255];

  /* ---- the new wings: { W, H, ay, draw(R, a, b, e, frame) } ---- */
  var WINGS_V157A = {
    // ORIGAMI: four folded facets, alternately lit, crisp creases
    paper: { W: 20, H: 17, ay: 6, draw: function (R, a, b, e) {
      var S = [0, 6], T = [19, 0], P = [[16, 6], [12, 11], [7, 15], [2, 12]], tones = [light(a, 0.3), mix(a, b, 0.7), light(a, 0.05), dark(b, 0.12)];
      var pts = [T].concat(P);
      for (var i = 0; i < P.length; i++) polyV157A(R, [S, pts[i], pts[i + 1]], function () { return tones[i]; });
      for (var j = 0; j < P.length - 1; j++) lnV157A(R, S[0], S[1], P[j][0], P[j][1], dark(b, 0.12));
      lnV157A(R, S[0], S[1], T[0], T[1], light(a, 0.5));
      R.outline(e); } },
    // THORNVINE: a curling vine, three hanging tendrils, thorns, leaves and rosebuds
    thorn: { W: 21, H: 20, ay: 7, draw: function (R, a, b, e) {
      var vine = function (t) { return [t * 20, 7 - 6 * Math.sin(Math.min(1, t * 1.6) * Math.PI / 2) + Math.max(0, t - 0.62) * 3]; };
      var rose = [200, 32, 58], roseL = [255, 111, 134], thornC = light(a, 0.55);
      [[0.3, [7, 15]], [0.55, [13, 18]], [0.8, [19, 13]]].forEach(function (td, k) {
        var s0 = vine(td[0]), n = 12;
        for (var i = 0; i <= n; i++) { var t = i / n, x = s0[0] + (td[1][0] - s0[0]) * t + Math.sin(t * 5 + k) * 1.2, y = s0[1] + (td[1][1] - s0[1]) * t; R.put(x, y, dark(a, 0.1)); if (i % 4 === 2) R.put(x + 1, y, thornC); }
        R.put(td[1][0], td[1][1], rose); R.put(td[1][0] + 1, td[1][1], rose); R.put(td[1][0], td[1][1] + 1, dark(rose, 0.3)); R.put(td[1][0] + 1, td[1][1] + 1, rose); R.put(td[1][0], td[1][1] - 1, roseL);
      });
      for (var i = 0; i <= 40; i++) { var p = vine(i / 40); R.put(p[0], p[1], a); R.put(p[0], p[1] + 1, dark(a, 0.25)); R.put(p[0], p[1] - 1, i % 6 === 3 ? thornC : light(a, 0.2)); if (i % 6 === 3) R.put(p[0], p[1] - 2, thornC); }
      [[4, 8], [9, 4], [14, 3], [17, 5]].forEach(function (L, k) { var x = L[0], y = L[1] + (k % 2 ? 2 : -2); R.put(x, y, b); R.put(x + 1, y, light(b, 0.35)); R.put(x, y + (k % 2 ? 1 : -1), dark(b, 0.2)); });
      R.put(20, 1, rose); R.put(20, 0, roseL);
      R.outline(e, 0.85); } },
    // RAVEN: a rounded inner wing and five separated, fingered primaries
    raven: { W: 25, H: 21, ay: 7, draw: function (R, a, b, e) {
      var arm = function (x) { return x <= 9 ? 7 - 5 * Math.sin(x / 9 * Math.PI / 2) : 2 + (x - 9) * 0.15; }, sheen = mix(a, b, 0.55);
      // five fingered primaries, tapered and apart
      [[0.08, 11], [0.34, 12], [0.6, 11.5], [0.86, 10.5], [1.12, 9]].forEach(function (f, k) {
        var sx = 13.5 + k * 0.9, sy = 2.6 + k * 1.1, ca = Math.cos(f[0]), sa = Math.sin(f[0]), L = f[1];
        polyV157A(R, [[sx - sa * 1.3, sy + ca * 1.3], [sx + sa * 0.2, sy - ca * 0.2], [sx + ca * L, sy + sa * L]], function (x, y) {
          var dx = x + 0.5 - sx, dy = y + 0.5 - sy, v = -dx * sa + dy * ca; return v < -0.2 ? sheen : v > 0.7 ? dark(a, 0.35) : a; });
      });
      // the secondaries: rounded, a dark line between each
      for (var x = 1; x <= 13; x++) { var y0 = Math.round(arm(x)) + 2, L = 5 + Math.round(3.5 * Math.sin(x / 13 * Math.PI * 0.9));
        for (var y = y0; y <= y0 + L; y++) R.put(x, y, x % 2 === 0 ? dark(a, 0.3) : y === y0 + L ? dark(a, 0.2) : y - y0 < 2 ? mix(a, b, 0.2) : a); }
      // the coverts along the arm: a blue-black sheen on top
      for (var x2 = 0; x2 <= 16; x2++) { var ya = Math.round(arm(x2)); R.put(x2, ya, light(sheen, 0.2)); R.put(x2, ya + 1, sheen); R.put(x2, ya + 2, a); if (x2 % 3 === 1) R.put(x2, ya + 3, dark(a, 0.3)); }
      R.outline(e); } },
    // PIGSKIN: two leather footballs for lobes — pebbled grain, white stripes, the upper one laced
    football: { W: 21, H: 19, ay: 7, draw: function (R, a, b, e) {
      var ball = function (cx, cy, rx, ry, ang, laces) {
        var ca = Math.cos(ang), sa = Math.sin(ang);
        for (var y = 0; y < 19; y++) for (var x = 0; x < 21; x++) {
          var dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = dx * ca + dy * sa, v = -dx * sa + dy * ca, lim = ry * (1 - Math.pow(u / rx, 2));
          if (Math.abs(u) > rx || Math.abs(v) > lim) continue;
          var c = v < -lim * 0.4 ? light(a, 0.2) : v > lim * 0.5 ? b : a;
          if (((x * 7 + y * 3) % 5) === 0) c = dark(c, 0.12);
          var au = Math.abs(u) / rx; if (au > 0.58 && au < 0.7) c = e;
          R.put(x, y, c);
        }
        if (laces) {   // the seam along the axis and five stitches across it
          lnV157A(R, cx - ca * 3.6, cy - sa * 3.6, cx + ca * 3.6, cy + sa * 3.6, e);
          [-3, -1.5, 0, 1.5, 3].forEach(function (u) { var px = cx + ca * u, py = cy + sa * u; lnV157A(R, px + sa * 1.4, py - ca * 1.4, px - sa * 1.4, py + ca * 1.4, e); });
        }
      };
      ball(7.5, 14, 7, 3.1, 0.42, false);
      ball(10.8, 5.6, 10.2, 4.4, -0.36, true);
      R.outline(dark(b, 0.55)); } },
    // BONE WINGS: an arm bone, a doubled forearm, four finger bones from the wrist and two ribs, knobs at every joint
    skeleton: { W: 22, H: 20, ay: 6, draw: function (R, a, b, e) {
      var knob = function (x, y) { R.put(x, y, light(a, 0.4)); R.put(x + 1, y, a); R.put(x, y + 1, a); R.put(x + 1, y + 1, b); };
      var bone = function (x0, y0, x1, y1, bend) { var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0; for (var i = 0; i <= n; i++) { var t = i / Math.max(1, n), x = x0 + (x1 - x0) * t + Math.sin(t * Math.PI) * (bend || 0), y = y0 + (y1 - y0) * t; R.put(x, y, a); R.put(x + 1, y + (Math.abs(x1 - x0) > Math.abs(y1 - y0) ? 1 : 0), b); } };
      bone(3, 6, 2, 14, -1.2); bone(6, 4, 7, 16, 1.4);   // the ribs
      bone(15, 3, 21, 1); bone(15, 4, 21, 8, 0.6); bone(15, 5, 18, 14, 0.8); bone(15, 5, 12, 18, 0.9);   // the fingers
      bone(0, 6, 7, 1); R.put(0, 7, b); R.put(1, 7, b);
      lnV157A(R, 8, 1, 14, 2, a); lnV157A(R, 8, 3, 14, 4, a); lnV157A(R, 9, 4, 14, 5, b);   // radius and ulna, a gap between
      knob(0, 5); knob(7, 1); knob(14, 3); knob(18, 4); knob(16, 9);
      R.put(21, 0, light(a, 0.4)); R.put(22, 1, a); R.put(18, 15, a); R.put(11, 19, a);
      R.outline(e); } },
    // CLOCKWORK: a big toothed gear at the shoulder, a riveted brass bar, six brass blades tipped in copper
    clockwork: { W: 22, H: 21, ay: 7, draw: function (R, a, b, e) {
      var cu = [196, 106, 58], face = dark(b, 0.15);
      var gear = function (cx, cy, r, teeth) { for (var y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) for (var x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
        var dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy), an = Math.atan2(dy, dx), tooth = Math.cos(an * teeth) > 0.3;
        if (d > r + (tooth ? 1.2 : 0) || d < r * 0.28) continue;
        R.put(x, y, d > r - 0.6 ? (dy < 0 ? light(a, 0.4) : a) : d < r * 0.55 ? light(a, 0.5) : (Math.abs(dx) < 0.6 || Math.abs(dy) < 0.6) ? a : face); } };
      [[5, 7, 0.08], [8, 8, 0.16], [11, 9, 0.26], [14, 10, 0.36], [17, 11, 0.5], [19.5, 10, 0.66]].forEach(function (bl, k) {
        var bx = bl[0], by = 7 - (bx - 3) * 6 / 18 + 1, L = bl[1], sa = Math.sin(bl[2]), ca = Math.cos(bl[2]);
        for (var s = 0; s <= L; s++) for (var q = 0; q < 3; q++) { if (s === L && q !== 1) continue; var c = s >= L - 1 ? cu : a; R.put(bx + sa * s + q, by + ca * s, q === 0 ? light(c, 0.35) : q === 2 ? dark(c, 0.3) : c); }
        R.put(bx + 1, by + 1, [255, 244, 214]);
      });
      lnV157A(R, 3, 6, 21, 0, light(a, 0.45)); lnV157A(R, 3, 7, 21, 1, a); lnV157A(R, 3, 8, 21, 2, b);
      gear(4.5, 7, 4.4, 7); gear(18, 1.5, 2, 6); R.put(4, 6, [255, 244, 214]);
      R.outline(e); } },
    // STORMCALLER: five forked bolts from the shoulder, a white core in a blue glow (they jump every frame)
    lightning: { W: 22, H: 22, ay: 8, draw: function (R, a, b, e, fr) {
      var ends = [[21, 0], [21, 7], [18, 14], [13, 19], [6, 21]], cores = [];
      ends.forEach(function (T, i) {
        var n = 5, px = 0, py = 8;
        for (var s = 1; s <= n; s++) { var t = s / n, nx = T[0] * t, ny = 8 + (T[1] - 8) * t, dx = T[0], dy = T[1] - 8, L = Math.hypot(dx, dy), off = s < n ? (hV157A(i, s, 7 + (fr | 0) * 13) - 0.5) * 4.4 : 0;
          nx += -dy / L * off; ny += dx / L * off; cores.push([px, py, nx, ny, i]); px = nx; py = ny; }
      });
      cores.forEach(function (c) { var n = Math.max(Math.abs(c[2] - c[0]), Math.abs(c[3] - c[1])) | 0; for (var k = 0; k <= n; k++) { var t = k / Math.max(1, n), x = c[0] + (c[2] - c[0]) * t, y = c[1] + (c[3] - c[1]) * t;
        for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) if ((ox || oy) && !R.has(Math.round(x + ox), Math.round(y + oy))) R.put(x + ox, y + oy, e, 0.55); } });
      cores.forEach(function (c) { lnV157A(R, c[0], c[1], c[2], c[3], b); });
      cores.forEach(function (c) { lnV157A(R, c[0], c[1], (c[0] + c[2]) / 2, (c[1] + c[3]) / 2, a); if (c[4] < 2) lnV157A(R, c[0], c[1], c[2], c[3], a); });
      R.put(0, 7, a); R.put(1, 8, a); } },
    // CYBER GRID: a faceted wireframe — neon grid over a dark glass, a hot-pink rim, bright nodes
    cyber: { W: 21, H: 19, ay: 6, draw: function (R, a, b, e, fr) {
      var P = [[0, 4], [8, 1], [20.5, 0], [17, 5], [20, 8.5], [13, 11], [14.5, 16], [7, 18.5], [0.5, 11]], scan = ((fr | 0) % 2) ? 9 : 4;
      polyV157A(R, P, function (x, y) { var d = edgeDistV157A(P, x + 0.5, y + 0.5);
        if (d < 1.05) return b;
        var g = (x % 3 === 0) || ((y + (x >> 2)) % 3 === 0);
        if ((x % 3 === 0) && ((y + (x >> 2)) % 3 === 0)) return WHITE_V157A;
        if (g) return y === scan ? light(a, 0.6) : a;
        return { c: y === scan ? mix(e, a, 0.35) : e, a: 0.78 }; });
      R.outline(dark(b, 0.55), 0.9); } },
    // SHADE: a wing of smoke — dark at the shoulder, violet at the edge, dissolving into dithered wisps
    shadow: { W: 21, H: 22, ay: 7, draw: function (R, a, b, e, fr) {
      var P = [[0, 5], [9, 0], [20.5, 2], [16, 8], [18.5, 13], [12, 14], [11, 19], [6, 15], [1, 12]], sd = (fr | 0) * 5;
      polyV157A(R, P, function (x, y) { var d = edgeDistV157A(P, x + 0.5, y + 0.5), n = vnV157A(x, y, 4, 3 + sd), t = Math.min(1, Math.hypot(x, y - 7) / 20);
        if (d < 2.2 && hV157A(x, y, 11 + sd) < 0.42 + (2.2 - d) * 0.18) return null;
        var c = mix(a, b, Math.min(1, t * 0.8 + n * 0.35)); if (n > 0.72) c = light(c, 0.15);
        return { c: c, a: d < 2.2 ? 0.55 + d * 0.2 : 0.96 }; });
      [[4, 13], [9, 16], [15, 14], [18, 12]].forEach(function (w, k) { for (var i = 0; i < 6; i++) { var y = w[1] + i, x = w[0] + Math.round(Math.sin(i * 0.9 + k + (fr | 0) * 1.3) * 1.2); if (y < 22) R.put(x, y, b, 0.75 - i * 0.11); } });
      [[7, 6], [13, 5], [10, 10]].forEach(function (s, k) { if (hV157A(k, 1, 20 + sd) > 0.3) R.put(s[0], s[1], light(b, 0.6)); });
      R.outline(e, 0.45); } },
    // DEMON: a hooked claw, spikes on the arm, a torn membrane between long spined fingers, ember veins
    demon: { W: 24, H: 23, ay: 9, draw: function (R, a, b, e) {
      var wr = [10, 3], tips = [[23, 5], [22, 13], [17, 19], [10, 22], [3, 17]];
      for (var i = 0; i < tips.length; i++) {
        var A = i === 0 ? wr : tips[i - 1], B = tips[i], mem;
        if (i === 0) { mem = [[0, 9], wr, [23, 5]]; }
        else { var mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, px = mx - (mx - wr[0]) * 0.28, py = my - (my - wr[1]) * 0.28; mem = [wr, A, [(A[0] + px) / 2, (A[1] + py) / 2 + 0.5], [px, py], [(B[0] + px) / 2, (B[1] + py) / 2 + 0.5], B]; }
        polyV157A(R, mem, function (x, y) { var dd = Math.hypot(x - wr[0], y - wr[1]) / 20; return mix(a, dark(a, 0.55), Math.min(1, dd * 0.9)); });
      }
      polyV157A(R, [[0, 9], wr, [3, 17]], function () { return a; });
      [[5, 14], [15, 13], [18, 8]].forEach(function (h) { R.d[((h[1] + 1) * R.W + h[0] + 1) * 4 + 3] = 0; R.d[((h[1] + 1) * R.W + h[0] + 2) * 4 + 3] = 0; });
      tips.forEach(function (T, k) { var mx = (wr[0] + T[0]) / 2 + (k - 2) * 0.6, my = (wr[1] + T[1]) / 2; lnV157A(R, wr[0], wr[1] + 2, mx, my + 2, e, 0.55); });
      tips.forEach(function (T) { lnV157A(R, wr[0], wr[1], T[0], T[1], b); R.put(T[0] + (T[0] > wr[0] ? 1 : 0), T[1] + 1, b); });
      lnV157A(R, 0, 9, wr[0], wr[1], b); lnV157A(R, 0, 8, wr[0], wr[1] - 1, light(b, 0.35));
      R.put(9, 2, light(b, 0.3)); R.put(9, 1, light(b, 0.45)); R.put(10, 0, light(b, 0.6)); R.put(11, 0, [230, 220, 200]);
      [[3, 6], [6, 4]].forEach(function (s) { R.put(s[0], s[1], light(b, 0.4)); R.put(s[0] + 1, s[1] - 1, [230, 220, 200]); });
      R.outline([18, 2, 4]); } },
    // DRAGON: a thick gold-boned arm with horn spikes, a big wrist horn, scaled green membrane, rounded scallops
    dragon: { W: 24, H: 22, ay: 8, draw: function (R, a, b, e) {
      var wr = [11, 3], tips = [[23, 5], [22, 12], [17, 17], [10, 20], [3, 16]], sc = light(a, 0.28), sd = dark(a, 0.3);
      var memCol = function (x, y) { var dd = Math.hypot(x - wr[0], y - wr[1]) / 20, c = mix(a, sd, Math.min(1, dd * 0.7)); if (y % 2 === 0 && ((x + ((y >> 1) % 2) * 2) % 4) === 0) c = sc; else if (y % 2 === 1 && ((x + ((y >> 1) % 2) * 2) % 4) === 1) c = dark(c, 0.15); return c; };
      for (var i = 0; i < tips.length; i++) {
        var A = i === 0 ? [0, 8] : tips[i - 1], B = tips[i], mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, ox = mx - wr[0], oy = my - wr[1], L = Math.hypot(ox, oy) || 1, bul = i === 0 ? 0 : 1.6;
        polyV157A(R, i === 0 ? [[0, 8], wr, B] : [wr, A, [mx + ox / L * bul, my + oy / L * bul], B], memCol);
      }
      polyV157A(R, [[0, 8], wr, [3, 16], [0, 13]], memCol);
      tips.forEach(function (T) { lnV157A(R, wr[0], wr[1], T[0], T[1], dark(b, 0.15)); R.put(T[0], T[1], light(b, 0.4)); });
      lnV157A(R, 0, 8, wr[0], wr[1], b); lnV157A(R, 0, 9, wr[0], wr[1] + 1, dark(b, 0.2)); lnV157A(R, 0, 7, wr[0] - 1, wr[1] - 1, light(b, 0.4));
      [[3, 5], [7, 3]].forEach(function (s) { R.put(s[0], s[1], light(b, 0.3)); R.put(s[0], s[1] - 1, light(b, 0.55)); });
      R.put(11, 2, b); R.put(10, 1, light(b, 0.3)); R.put(10, 0, light(b, 0.55)); R.put(9, 0, light(b, 0.7)); R.put(12, 2, dark(b, 0.2));
      R.outline(e); } },
    // JET: a swept, panelled plate, a red stripe, two thruster pods firing downward (the exhaust flickers)
    jet: { W: 23, H: 19, ay: 5, draw: function (R, a, b, e, fr) {
      var P = [[0, 3], [20, 1], [22.5, 4], [7, 11], [0, 10]], stripe = [200, 40, 44];
      polyV157A(R, P, function (x, y) { var d = edgeDistV157A(P, x + 0.5, y + 0.5);
        if (x > 1 && x % 5 === 0) return dark(a, 0.25);
        if (Math.abs(y - (3.6 - x * 0.1 + 1.6)) < 0.6 && x < 19) return stripe;
        return d < 1 && y < 5 ? light(a, 0.35) : y > 7 ? mix(a, b, 0.5) : a; });
      [5, 12].forEach(function (px, k) { var y0 = k ? 7 : 9, fl = 3 + ((fr | 0) % 2 ? 1 : 0) + k;
        for (var y = y0; y <= y0 + 4; y++) { R.put(px, y, light(a, 0.35)); R.put(px + 1, y, a); R.put(px + 2, y, b); }
        R.put(px, y0 + 5, dark(b, 0.4)); R.put(px + 1, y0 + 5, dark(b, 0.5)); R.put(px + 2, y0 + 5, dark(b, 0.4));
        for (var f = 0; f < fl; f++) { var c = f === 0 ? [255, 250, 210] : f < 2 ? light(e, 0.3) : e; R.put(px + 1, y0 + 6 + f, c, 1 - f * 0.18); if (f < fl - 2) { R.put(px, y0 + 6 + f, e, 0.6); R.put(px + 2, y0 + 6 + f, e, 0.6); } } });
      for (var q = 3; q < 19; q += 3) R.put(q, 3 - q * 0.1 + 0.4 | 0, light(a, 0.6));
      R.put(21, 3, [255, 70, 70]);
      R.outline([18, 22, 28]); } },
    // HELLFIRE: a wing body of violet fire, tongues licking up off its top edge (they dance), embers inside
    hellfire: { W: 21, H: 24, ay: 11, draw: function (R, a, b, e, fr) {
      var P = [[0, 10], [8, 6], [20, 8], [15, 13], [17, 17], [10, 17], [9, 23], [5, 18], [1, 15]], f0 = fr | 0;
      var topY = function (x) { return x <= 8 ? 10 - x * 0.5 : 6 + (x - 8) * 0.17; };
      polyV157A(R, P, function (x, y) { var d = edgeDistV157A(P, x + 0.5, y + 0.5), t = (y - topY(x)) / 11, n = hV157A(x, y, 5 + f0);
        if (d < 1.1) return mix(b, e, 0.6);
        var c = t < 0.22 ? a : t < 0.45 ? light(b, 0.35) : t < 0.75 ? b : mix(b, e, 0.5);
        if (n > 0.86) c = light(c, 0.35); else if (n < 0.1) c = dark(c, 0.2);
        return c; });
      [1, 4, 7, 10, 13, 16, 19].forEach(function (tx, k) {
        var baseY = topY(tx) + 1, h = 3 + Math.round(hV157A(k, f0, 9) * 3) + (k === 3 || k === 5 ? 2 : 0), lean = (k % 2 ? 1 : -1) * (f0 ? 0.5 : -0.35) - 0.25;
        for (var r = 0; r <= h; r++) { var rel = r / h, hw = (1 - rel) * 1.5, cx = tx + lean * rel * 2.2, y = Math.round(baseY) - r;
          for (var q = Math.round(cx - hw); q <= Math.round(cx + hw); q++) { var dq = Math.abs(q - cx) / Math.max(0.6, hw); R.put(q, y, rel > 0.8 ? mix(b, e, 0.3) : dq < 0.45 && rel < 0.55 ? a : light(b, 0.3 * (1 - rel))); } }
      });
      R.outline(dark(e, 0.4), 0.75); } },
    // CATHEDRAL: a lancet arch over a round lobe, leaded into cells of jewel glass, each with a glint
    cathedral: { W: 20, H: 22, ay: 7, draw: function (R, a, b, e) {
      var lead = e, pal = [a, b, [255, 199, 70], [63, 191, 127], [154, 75, 255], light(b, 0.35)];
      var inside = function (x, y) { var up = y <= 13 && Math.hypot(x - 20, y - 13.5) <= 14.6 && Math.hypot(x - 3.5, y - 13.5) <= 14.6 && x >= 0; var lo = Math.hypot(x - 7, y - 16.5) <= 5.6; return up || lo; };
      var cell = function (x, y) { var an = Math.atan2(y - 7, x + 1.5), r = Math.hypot(x + 1.5, y - 7); return [Math.floor((an + 1.6) / 0.4), r < 6.5 ? 0 : r < 12 ? 1 : 2]; };
      for (var y = 0; y < 22; y++) for (var x = 0; x < 20; x++) {
        if (!inside(x + 0.5, y + 0.5)) continue;
        var c0 = cell(x + 0.5, y + 0.5), cR = cell(x + 1.5, y + 0.5), cD = cell(x + 0.5, y + 1.5), isLead = ((cR[0] !== c0[0] || cR[1] !== c0[1]) && inside(x + 1.5, y + 0.5)) || ((cD[0] !== c0[0] || cD[1] !== c0[1]) && inside(x + 0.5, y + 1.5));
        if (Math.abs(y - 13.5) < 0.6 && x < 13) isLead = true;
        if (isLead) { R.put(x, y, lead); continue; }
        var col = pal[((c0[0] * 2 + c0[1] * 3) % pal.length + pal.length) % pal.length], cU = cell(x + 0.5, y - 0.5), cL = cell(x - 0.5, y + 0.5);
        R.put(x, y, (cU[0] !== c0[0] || cU[1] !== c0[1]) && (cL[0] !== c0[0] || cL[1] !== c0[1]) ? light(col, 0.6) : (cU[1] !== c0[1] || cU[0] !== c0[0]) ? light(col, 0.25) : col);
      }
      R.outline(dark(lead, 0.3)); } },
    // PRISM: three glass panes fanned from the shoulder, a rainbow refracting through each, sparkles on the edges
    prism: { W: 21, H: 21, ay: 8, draw: function (R, a, b, e) {
      var spec = [[255, 77, 77], [255, 169, 77], [255, 225, 77], [77, 217, 122], [77, 166, 255], [154, 107, 255]];
      [[-0.55, 20, 5], [-0.05, 18, 5.5], [0.55, 15, 5]].forEach(function (pn, k) {
        var ca = Math.cos(pn[0]), sa = Math.sin(pn[0]), L = pn[1], Wd = pn[2];
        for (var y = 0; y < 21; y++) for (var x = 0; x < 21; x++) {
          var dx = x + 0.5 - 0.5, dy = y + 0.5 - 8, t = dx * ca + dy * sa, v = -dx * sa + dy * ca; if (t < 0 || t > L) continue;
          var hw = Wd / 2 * Math.min(1, t / L * 1.25) * (t > L * 0.8 ? (L - t) / (L * 0.2) : 1) + 0.3; if (Math.abs(v) > hw) continue;
          var c = v < 0 ? a : b, rt = t / L;
          if (rt > 0.5 && rt < 0.92) { var si = Math.min(5, Math.max(0, Math.floor((v / hw + 1) / 2 * 6))); c = mix(spec[si], c, 0.3); }
          if (Math.abs(Math.abs(v) - hw) < 0.75) c = v < 0 ? WHITE_V157A : light(b, 0.3);
          R.put(x, y, c, 0.92);
        }
      });
      [[12, 2], [16, 9], [10, 15]].forEach(function (s) { R.put(s[0], s[1], WHITE_V157A); R.put(s[0] - 1, s[1], light(a, 0.5)); R.put(s[0] + 1, s[1], light(a, 0.5)); R.put(s[0], s[1] - 1, light(a, 0.5)); R.put(s[0], s[1] + 1, light(a, 0.5)); });
      R.outline(e, 0.9); } },
    // GILDED AEGIS: three rows of gold armour plates hung from a gem-set arm
    gilded: { W: 23, H: 22, ay: 8, draw: function (R, a, b, e) {
      var arm = function (x) { return 8 - 6 * Math.sin(Math.min(1, x / 13) * Math.PI / 2) + Math.max(0, x - 13) * 0.25; }, gem = [58, 127, 255], edge = dark(b, 0.3);
      var plate = function (x0, y0, L, ang, w) { var sa = Math.sin(ang), ca = Math.cos(ang);
        for (var s = 0; s <= L; s++) for (var q = 0; q < w; q++) { if (s === L && q !== 1) continue; var px = x0 + sa * s + q, py = y0 + ca * s;
          R.put(px, py, s === L ? edge : q === 0 ? light(a, 0.45) : q === w - 1 ? edge : s <= 1 ? light(a, 0.2) : s >= L - 1 ? b : a); } };
      [[12, 11, 0.4], [15, 12, 0.55], [18, 11, 0.7], [20.5, 9, 0.85]].forEach(function (p) { plate(p[0], arm(p[0]) + 1, p[1], p[2], 3); });   // the primaries
      [[0.5, 7], [3.5, 8], [6.5, 8], [9.5, 8]].forEach(function (p) { plate(p[0], arm(p[0]) + 2, p[1], 0.08, 3); });   // the secondaries
      for (var n = 0; n <= 15; n += 3) plate(n, arm(n), 3, 0, 3);   // the coverts
      for (var x = 0; x <= 22; x++) { var y = Math.round(arm(x)); R.put(x, y - 1, light(a, 0.6)); R.put(x, y, light(a, 0.2)); }
      [[1, 6], [13, 1]].forEach(function (g) { R.put(g[0], g[1], light(gem, 0.6)); R.put(g[0] + 1, g[1], gem); R.put(g[0], g[1] + 1, gem); R.put(g[0] + 1, g[1] + 1, dark(gem, 0.4)); });
      R.outline(e); } },
    // GALAXY: a long sickle of night sky — a nebula of violet and pink, stars that twinkle, a bright star at the tip
    galaxy: { W: 22, H: 20, ay: 7, draw: function (R, a, b, e, fr) {
      var top = function (x) { return 7 - 6.5 * Math.sin(Math.min(1, x / 16) * Math.PI / 2); }, bot = function (x) { return 7 + 10 * Math.sin(Math.PI * Math.min(1, x / 21)) * (1 - x / 30) + 1; };
      for (var x = 0; x < 22; x++) for (var y = Math.round(top(x)); y <= Math.round(bot(x)); y++) {
        if (x > 17 && y > top(x) + (21 - x) * 0.9 + 1) continue;
        var n1 = vnV157A(x, y, 5, 21), n2 = vnV157A(x + 30, y, 4, 22), c = mix(a, b, Math.max(0, n1 - 0.25) * 1.2);
        if (n2 > 0.62) c = mix(c, e, (n2 - 0.62) * 2);
        var s = hV157A(x, y, 31); if (s > 0.94) c = (s > 0.975 && (fr | 0)) ? light(e, 0.6) : WHITE_V157A; else if (s > 0.9) c = light(c, 0.35);
        R.put(x, y, c);
      }
      R.put(21, 0, WHITE_V157A); R.put(20, 0, light(e, 0.5)); R.put(21, 1, light(e, 0.5));
      R.outline(light(b, 0.25), 0.8); } }
  };
  /* the member looks: "member" while v156 C is on (TU v156Ccos), their v153 G-style achievement with it off — the same
   * getters v156 C's `resourceV156C` gives its own (listed in RULES_V156C, so `__V156C.rules()` names them) */
  (function resourceV157A() {
    ["wings_storm", "wings_cyber", "wings_shade", "wings_demon", "wings_jet", "wings_hellfire", "wings_cathedral", "wings_galaxy"].forEach(function (id) {
      var it = BY[id]; if (!it || it._v157A) return;
      var src0 = it.source, ach0 = it.ach;   // kept here, not in _src0: v156 C's grandfathering never hands a device a look it never had
      RULES_V156C[id] = "member"; it._v157A = 1; delete it.source; delete it.ach;
      Object.defineProperty(it, "source", { enumerable: true, configurable: true, get: function () { return cosOnV156C() ? "member" : src0; } });
      Object.defineProperty(it, "ach", { enumerable: true, configurable: true, get: function () { return cosOnV156C() ? undefined : ach0; } });
    });
  })();
  function wingKindV157A(k) { return !!(k && Object.prototype.hasOwnProperty.call(WINGS_V157A || {}, k)); }
  function wingArtV157A(w, frame, key) {
    var D = WINGS_V157A[w.kind], cols = w.col || ["#ffffff", "#cccccc", "#555555"], R = new Raster(D.W, D.H);
    try { D.draw(R, colRgb(cols[0]), colRgb(cols[1]), colRgb(cols[2]), frame | 0); } catch (e) { errV157A(e); }
    var cv = R.canvas();
    return (ART_V153G[key] = { key: key, cv: cv, ax: 1, ay: D.ay + 1, w: cv.width, h: cv.height });
  }
  // the kinds that animate on the field (the flame's own flicker is v153 G's)
  var ANIM_V157A = { lightning: 90, hellfire: 120, jet: 80, shadow: 260, galaxy: 420, cyber: 300 };
  function wingFrameV157A(kind, now) { var ms = ANIM_V157A[kind]; return ms ? ((now / ms) | 0) % 2 : 0; }

  /* ---- THE FLAP: a pure function of the time (ms) ---- */
  var RM_V157A = null;
  function reducedV157A() { try { if (!RM_V157A && window.matchMedia) RM_V157A = window.matchMedia("(prefers-reduced-motion: reduce)"); return !!(RM_V157A && RM_V157A.matches); } catch (e) { return false; } }
  var REST_V157A = { on: false, f: 0, rot: 0, sy: 1, beat: false };
  function flapPoseV157A(t) {
    if (!flapOnV157A()) return REST_V157A;
    if (reducedV157A()) return { on: true, f: 0, rot: 0, sy: 1, beat: false, reduced: true };
    var P = Math.max(400, TUv("wingFlapPeriodV157A", 3400)), D = Math.min(P, Math.max(100, TUv("wingFlapMsV157A", 760))), beats = Math.max(1, TUv("wingFlapBeatsV157A", 2));
    var ph = ((t % P) + P) % P;
    if (ph >= D) return { on: true, f: 0, rot: 0, sy: 1, beat: false };
    var u = ph / D, f = Math.sin(2 * Math.PI * beats * u) * Math.pow(Math.sin(Math.PI * u), 0.5);
    return { on: true, f: f, rot: f * TUv("wingFlapAmpV157A", 0.42), sy: 1 - TUv("wingFlapSquashV157A", 0.16) * Math.max(0, -f), beat: true };
  }
  function fieldPoseV157A(p, now, wd) { G157.fieldN++; G157.field = { t: now, rot: p.rot, sy: p.sy, beat: p.beat, kind: wd && wd.kind }; }
  /* the card and the Locker previews: one rAF ticker repaints each registered canvas while a beat is on (and once
   * when it ends), and forgets a canvas the moment it leaves the page */
  var FLAPS_V157A = [], rafV157A = 0;
  function flapRegV157A(cv, paint, where, kind) {   // v159 D: `kind` — the wing's family picks its flutter
    try {
      if (!flapOnV157A()) return false;
      for (var i = 0; i < FLAPS_V157A.length; i++) if (FLAPS_V157A[i].cv === cv) { FLAPS_V157A[i].paint = paint; FLAPS_V157A[i].kind = kind; FLAPS_V157A[i].last = null; return true; }
      FLAPS_V157A.push({ cv: cv, paint: paint, where: where || "", kind: kind, last: null }); G157.regs++;
      if (!rafV157A && window.requestAnimationFrame) rafV157A = requestAnimationFrame(flapTickV157A);
      return true;
    } catch (e) { errV157A(e); return false; }
  }
  function flapTickV157A() {
    rafV157A = 0;
    if (flutterOnV159D()) return flapTickV159D();   // v159 D: never still — every frame (throttled), off-screen canvases wait
    try {
      var pose = flapPoseV157A(performance.now()), key = pose.beat ? pose.rot.toFixed(3) + "|" + pose.sy.toFixed(3) : "rest";
      G157.ticks++;
      for (var i = FLAPS_V157A.length - 1; i >= 0; i--) {
        var r = FLAPS_V157A[i];
        if (!r.cv.isConnected) { if ((r.miss = (r.miss | 0) + 1) > 120) FLAPS_V157A.splice(i, 1); continue; }
        r.miss = 0;
        if (r.last === key) continue;
        r.last = key; try { r.paint(pose.beat ? pose : null); G157.paints++; } catch (e) { errV157A(e); }
      }
    } catch (e) { errV157A(e); }
    if (FLAPS_V157A.length && window.requestAnimationFrame) rafV157A = requestAnimationFrame(flapTickV157A);
  }

  /* ---- THE CROWNS: symmetric pixel maps (the LEFT half + the centre column, mirrored) ----
   * H highlight · L light · M metal · D dark · K deep   J jewel · j its shade · w its light · W white
   * P pearl · p its shade   V velvet · v its light   E ermine · e its spot   T/U/X/B/Z the horn's ramp (tip → base, ridge) */
  function crownMapsV157A() {
    return {
      crown: { h: 12, rows: [
        ".......", "......J", ".....wJ", "..J..jJ", ".wJj..H", "..j..LM", "..L..LM", ".LMD.LM", "LMMMDLM", "LHHHHHH", "MwJMMwJ", "KDDDDDD"],
        shine: [[5, 2, "W"], [1, 4, "W"], [1, 10, "W"]], glint: [6, 1] },
      king: { h: 13, rows: [
        ".......M", "......LM", ".......M", "......LH", "....P.DM", ".P..pvVL", ".p..MVVM", ".M.LMVvM", "LMDLMDVM", "HHHHHHHH", "MwJMPMwJ", "DDjDDDDj", "EeEEEeEE"],
        shine: [[6, 1, "H"], [4, 4, "W"], [1, 5, "W"], [6, 10, "W"]], glint: [7, 0] },
      circlet: { h: 8, rows: [
        ".......", "......M", ".....wJ", "....MJJ", "....MjJ", ".J...Dj", "LHHHHLM", "DMMMMMD"],
        shine: [[5, 2, "W"]], glint: [6, 2] },
      star: { h: 9, rows: [
        "......J", "......J", "..J.JJW", ".JWJ.JJ", "..J..J.", "..M...M", "LHHHHHH", "MMJMMPM", "DDDDDDD"],
        shine: [], glint: [6, 0] },
      horns: { h: 9, rows: [
        "T.......", "TU......", "HU......", "UXZ.....", ".XU.....", ".ZXB....", "..XBZ...", "..ZBBB..", "...ZBBZ."],
        shine: [[0, 0, "W"]], glint: [0, 0] }
    };
  }
  function crownPalV157A(a, b, e) {
    var W = WHITE_V157A;
    return { H: light(a, 0.6), L: light(a, 0.28), M: a, D: mix(a, e, 0.4), K: mix(a, e, 0.75), J: b, j: dark(b, 0.38), w: light(b, 0.45), W: W,
      P: [250, 244, 230], p: [196, 184, 160], V: dark(b, 0.5), v: dark(b, 0.28), E: [240, 236, 228], e: [34, 30, 36],
      T: light(a, 0.2), U: a, X: mix(a, b, 0.55), B: b, Z: mix(b, e, 0.55) };
  }
  function drawMapV157A(R, rows, pal, W) {
    rows.forEach(function (row, y) { for (var x = 0; x < W; x++) { var hx = x < row.length ? x : W - 1 - x, ch = row.charAt(hx); if (ch && ch !== "." && pal[ch]) R.put(x, y, pal[ch]); } });
  }
  function glintV157A(R, gx, gy) {   // a four-point sparkle over the top jewel
    R.put(gx, gy, WHITE_V157A);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { R.put(gx + d[0], gy + d[1], WHITE_V157A, 0.85); });
    [[2, 0], [-2, 0], [0, -2]].forEach(function (d) { R.put(gx + d[0], gy + d[1], WHITE_V157A, 0.4); });
  }
  function crownArtV157A(cr, frame) {
    var key = "c157|" + cr.kind + "|" + (cr.col || []).join(",") + "|" + (frame | 0);
    if (ART_V153G[key]) return ART_V153G[key];
    var cols = cr.col || ["#f0bb45", "#c8102e", "#6b4a0e"], K = cr.kind, a = colRgb(cols[0]), b = colRgb(cols[1]), e = colRgb(cols[2]), R, W, H, gl = null, fr = frame | 0, glintOn = fr === 2;
    try {
      var maps = crownMapsV157A(), pal = crownPalV157A(a, b, e), m = maps[K];
      if (m) {
        W = m.rows[0].length * 2 - 1; H = m.h; R = new Raster(W, H);
        drawMapV157A(R, m.rows, pal, W);
        m.shine.forEach(function (s) { R.put(s[0], s[1], pal[s[2]]); });
        R.outline(K === "horns" ? dark(e, 0.2) : dark(e, 0.45));
        gl = m.glint;
      } else if (K === "halo") {
        W = 17; H = 6; R = new Raster(W, H);
        for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
          var ev = Math.pow((x + 0.5 - 8.5) / 8.5, 2) + Math.pow((y + 0.5 - 3) / 3, 2); if (ev > 1.02 || ev < 0.42) continue;
          var front = y + 0.5 > 3, c = front ? (ev > 0.86 ? mix(a, e, 0.15) : ev > 0.68 ? a : light(b, 0.1)) : ev > 0.8 ? mix(a, e, 0.3) : mix(a, e, 0.55);
          if (front && Math.abs(x - 8) > 5) c = mix(c, e, 0.2);
          R.put(x, y, c);
        }
        R.put(3, 4, WHITE_V157A); R.put(4, 5, light(b, 0.3)); R.put(13, 4, light(a, 0.4));
        R.outline(light(a, 0.2), 0.4);
        gl = [4, 4];
      } else if (K === "laurel") {
        W = 15; H = 10; R = new Raster(W, H);
        var lh = light(a, 0.45), ld = mix(a, b, 0.7), stem = mix(b, e, 0.5), rib = [200, 32, 58], ribL = [240, 90, 110];
        var ids = {}, cols2 = {}, put2 = function (x, y, c, id) { x = Math.round(x); y = Math.round(y); if (x > 7 || x < 0 || y < 0 || y >= H) return; cols2[x + "," + y] = c; ids[x + "," + y] = id; };
        var leaf = function (cx, cy, dx, dy, len, wid, id) {   // an oriented leaf: lit on its upper side, darker underneath
          for (var y = Math.floor(cy - 3); y <= cy + 3; y++) for (var x = Math.floor(cx - 3); x <= Math.min(7, cx + 3); x++) {
            var px = x + 0.5 - cx, py = y + 0.5 - cy, u = px * dx + py * dy, v = -px * dy + py * dx, sg = dx < 0 ? -1 : 1; if ((u * u) / (len * len) + (v * v) / (wid * wid) > 1) continue;
            put2(x, y, v * sg < -0.2 ? lh : u > len * 0.4 ? lh : v * sg > 0.4 ? ld : a, id); } };
        var stemAt = function (t) { return [6.4 - 6 * t, 8.2 - 4.8 * t]; };
        [[0.1, 1], [0.27, -1], [0.44, 1], [0.61, -1], [0.78, 1], [0.93, -1]].forEach(function (Lf, k) {
          var S = stemAt(Lf[0]), d = Lf[1] > 0 ? [-0.45, -0.89] : [-0.97, 0.22];
          leaf(S[0] + d[0] * 1.7, S[1] + d[1] * 1.7, d[0], d[1], 1.8, 0.9, k + 1); });
        leaf(0.5, 2.5, -0.62, -0.78, 1.9, 0.9, 9);
        for (var i = 0; i <= 10; i++) { var S2 = stemAt(i / 10); put2(S2[0], S2[1], stem, 0); }
        Object.keys(cols2).forEach(function (k) {   // a dark seam wherever one leaf meets another, so each reads on its own
          var xy = k.split(","), x = +xy[0], y = +xy[1], id = ids[k], c = cols2[k];
          if (id > 0 && [[1, 0], [0, 1], [-1, 0], [0, -1]].some(function (d) { var j = ids[(x + d[0]) + "," + (y + d[1])]; return j > 0 && j > id; })) c = mix(ld, e, 0.35);
          R.put(x, y, c); if (x < 7) R.put(W - 1 - x, y, c); });
        R.put(7, 9, rib); R.put(6, 9, rib); R.put(8, 9, rib); R.put(7, 8, ribL); R.put(5, 9, dark(rib, 0.3)); R.put(9, 9, dark(rib, 0.3));
        R.outline(dark(e, 0.2), 0.9);
        gl = [1, 1];
      } else if (K === "flame") {
        W = 13; H = 11; R = new Raster(W, H);
        var band = mix(b, e, 0.25), core = a, mid = b, out = e;
        [[1, 3], [3.8, 5], [6, 7], [8.2, 5], [11, 3]].forEach(function (tg, k) {
          var h = tg[1] + (hV157A(k, fr & 1, 3) > 0.5 ? 1 : 0), lean = (k < 2 ? -0.4 : k > 2 ? 0.4 : 0) + ((fr & 1) ? 0.3 : -0.3) * (k % 2 ? 1 : -1);
          for (var r = 0; r <= h; r++) { var rel = r / h, hw = (1 - rel) * (k === 2 ? 2.1 : 1.6), cx = tg[0] + lean * rel * 2, yy = 7 - r;
            for (var q = Math.round(cx - hw); q <= Math.round(cx + hw); q++) { var dq = Math.abs(q - cx) / Math.max(0.6, hw); R.put(q, yy, rel > 0.85 ? out : dq < 0.4 && rel < 0.6 ? core : dq < 0.8 && rel < 0.8 ? mid : out); } }
        });
        for (var bx = 0; bx < W; bx++) { R.put(bx, 8, light(band, 0.4)); R.put(bx, 9, band); R.put(bx, 10, dark(band, 0.35)); }
        [2, 6, 10].forEach(function (q) { R.put(q, 9, q === 6 ? [255, 255, 255] : light(e, 0.2)); });
        R.outline([58, 10, 4], 0.8);
        gl = [6, 0];
      } else if (crownKindV159D(K)) { var o159 = crownDrawV159D(K, a, b, e, fr); R = o159.R; gl = o159.gl;   // v159 D: the sixteen new crowns
      } else return null;
      if (glintOn && gl) glintV157A(R, gl[0], gl[1]);
    } catch (x) { errV157A(x); }
    if (!R) return null;
    var cv = R.canvas();
    return (ART_V153G[key] = { key: key, cv: cv, ax: Math.floor(cv.width / 2), ay: cv.height - 1, w: cv.width, h: cv.height });
  }
  // on the field a crown catches the light for ~200ms every few seconds
  function crownGlintV157A(now) { if (!crownOnV157A() || reducedV157A()) return 0; var P = Math.max(600, TUv("crownGlintPeriodV157A", 2900)); return ((now % P) + P) % P < TUv("crownGlintMsV157A", 200) ? 2 : 0; }

  G157.pose = flapPoseV157A; G157.kinds = function () { return Object.keys(WINGS_V157A); }; G157.items = function () { return itemsV157A().map(function (i) { return i.id; }); };
  G157.crownArt = crownArtV157A; G157.glint = crownGlintV157A; G157.frame = wingFrameV157A; G157.registered = function () { return FLAPS_V157A.map(function (r) { return { where: r.where, on: !!r.cv.isConnected, last: r.last }; }); };
  G157.crownOn = crownOnV157A; G157.flapOn = flapOnV157A; G157.reduced = reducedV157A;
  /* ===== v157 B AURAS ALIVE, TRAILS YOU CAN SPOT =====
   * The owner: "The aura, make 19 more, up the coolness. Animated auras on the profile page. Footprints are amazing, love
   * the big one, flames, etc. Add 15 SICK looking footprint trails. These help distinguish your character in a fast
   * moving game."
   *   AURAS   19 new ones, each a small particle program in `AFX_V157B` (its item's `au.fx`): storm, inferno, crystal, rift,
   *           galaxy, corona, bloodmoon, toxic, neon, pillar, shadow, coins, plasma, sakura, borealis, matrix, embers,
   *           ghostfire, prism. One painter interface draws them (rect / circ / seg / tri / ring / ell / ellS: a Phaser
   *           Graphics on the field, a 2D canvas on the card and in the Locker) in two layers, behind him (0) and in front (1).
   *           PROFILE CARD: every aura animates — the v153 G ones too (`LEGACY_V157B`: breathing motes, pulse rings, embers,
   *           snow, a spiral) — on two canvases of its own (`cardAuraV157B`, beside cardFlair's). LOCKER: animated previews.
   *           LIVE FIELD: the new ones add their particles over v153 G's glow image, two Graphics children of his container,
   *           lighter (TU `v157BauraFieldQ` 0.6 of the count, `v157BauraCap` 90 primitives a frame).
   *   TRAILS  15 new footprints in `TFX_V157B` (the item's `tr.fx`). Inferno and Meteor Strike are the two BIG ones (taller
   *           than Scorched Cleats, the one the owner loves); then lightning cleats, a neon light wall, ice shards, lava
   *           cracks, gold coins, confetti, galaxy dust, shadow smoke, toxic slime, cherry blossoms, pixel hearts, rune
   *           glyphs, prism bursts. They go through v153 G's one trail Graphics (depth 3.9, under the players), newest
   *           first under a per-frame primitive cap (TU `v157BtrailCap` 160). Every footprint previews ANIMATED in the
   *           Locker (the prints stream away behind him).
   * SOURCES (v156 C's call: the nicest looks are hard): 12 auras + 10 trails are `member` ("🔒 Membership" while the store
   * is OFF — listed, never owned); earned late (League MVP, the Interstellar League, 3 UFF rings, Legacy medal 300, the
   * fifth generation) or at the UFF; free: Sakura Drift, Smoke & Embers, Confetti Pop, Pixel Hearts.
   * RANDOMNESS: none. Every particle is a function of the clock (the scene's on the field, the rAF clock on the card)
   * and an integer hash of its index (`ihV153G`): seeded games stay identical and src/28 still spends no Math.random.
   * prefers-reduced-motion: the card and the previews draw one still frame. ONE rAF loop drives every animated canvas
   * (~25 fps, TU `v157Bfps`; at most TU `v157BcardMax` 6 cards), skips what is off screen, stops when none is left.
   * Kill switches: TU `v157Baura` 0 → v153 G's static glow everywhere (a new aura wears its base `kind`); TU `v157Btrail`
   * 0 → a new trail draws as its base v153 G `kind` and the previews are still. `window.__V157B`; v157Bcheck. */
  function auraOnV157B() { return !!TUv("v157Baura", 1); }
  function trailOnV157B() { return !!TUv("v157Btrail", 1); }
  var V157 = (window.__V157B = window.__V157B || { field: { aura: 0, trail: 0 }, anim: { targets: 0, frames: 0, draws: 0 }, card: null, previews: 0, errs: [] });
  function errV157B(e) { try { if (V157.errs.length < 8) V157.errs.push(String((e && e.message) || e)); } catch (x) {} }
  var MQ_V157B = null;
  function reducedV157B() { try { if (!MQ_V157B && window.matchMedia) MQ_V157B = matchMedia("(prefers-reduced-motion: reduce)"); return !!(MQ_V157B && MQ_V157B.matches); } catch (e) { return false; } }
  var TAU_V157B = 6.2832, STILL_T_V157B = 1000000;
  function frV157B(x) { return x - Math.floor(x); }

  /* ---- the catalogue (hoisted: ITEMS takes it at the top of the file) ---- */
  function itemsV157B() {
    var A = function (id, name, rarity, src, ach, kind, col, fx, pal) { var it = { id: id, cat: "aura", name: name, rarity: rarity, source: src, au: { kind: kind, col: col, fx: fx, pal: pal } }; if (ach) it.ach = ach; return it; };
    var T = function (id, name, rarity, src, ach, kind, col, fx) { var it = { id: id, cat: "trail", name: name, rarity: rarity, source: src, tr: { kind: kind, col: col, fx: fx } }; if (ach) it.ach = ach; return it; };
    return [
      // AURAS — `kind` is the v153 G glow under the particles (and all that is drawn with TU v157Baura 0)
      A("aura_embers", "Smoke & Embers", "common", "free", null, "flicker", "#ff9a3a", "embers", ["#6b6f78", "#ffb02e", "#ff5a1a", "#ffe7a0"]),
      A("aura_sakura", "Sakura Drift", "rare", "free", null, "glow", "#ffb3c7", "sakura", ["#ffb3c7", "#ff7aa2", "#ffe14d"]),
      A("aura_toxic", "Toxic Cloud", "rare", "earned", "uff", "glow", "#7dff3a", "toxic", ["#c8ff6f", "#7dff3a", "#2f8a1f", "#ffffff"]),
      A("aura_matrix", "Code Rain", "epic", "earned", "mvp", "glow", "#39ff6a", "matrix", ["#e8ffe8", "#39ff6a", "#0f8a2a"]),
      A("aura_galaxy", "Galaxy Swirl", "legendary", "earned", "interstellar", "void", "#6a4cff", "galaxy", ["#ffffff", "#b9a6ff", "#ff9ad5", "#6fd3ff", "#3a1f8a"]),
      A("aura_bloodmoon", "Blood Moon", "legendary", "earned", "rings3", "glow", "#c8102e", "bloodmoon", ["#b3121f", "#6a0a12", "#ff6a5a", "#7a1a22", "#120608"]),
      A("aura_pillar", "Heaven's Pillar", "legendary", "earned", "legacy300", "pulse", "#fff3c4", "pillar", ["#ffffff", "#fff3c4", "#ffd76f"]),
      A("aura_crystal", "Crystal Orbit", "epic", "member", null, "frost", "#8fd0ff", "crystal", ["#ffffff", "#bfe6ff", "#5aa8ff", "#2a5f8f"]),
      A("aura_neon", "Neon Grid", "epic", "member", null, "glow", "#ff3df2", "neon", ["#ff3df2", "#6ff7ff", "#ffffff"]),
      A("aura_shadow", "Shadow Tendrils", "epic", "member", null, "void", "#5a1f8a", "shadow", ["#14081c", "#8a3aff", "#ff3b5a"]),
      A("aura_inferno", "Inferno Pillar", "legendary", "member", null, "flicker", "#ff7a1a", "inferno", ["#fff3a0", "#ffb02e", "#ff5a1a", "#b8200f"]),
      A("aura_corona", "Solar Corona", "legendary", "member", null, "pulse", "#ffb02e", "corona", ["#fff6c0", "#ffd76f", "#ff9a1f", "#ff5a1a"]),
      A("aura_coins", "Money Shower", "legendary", "member", null, "glow", "#ffd76f", "coins", ["#fff6c0", "#ffd76f", "#8a5a08"]),
      A("aura_borealis", "Aurora Borealis", "legendary", "member", null, "glow", "#3fffb0", "borealis", ["#3fffb0", "#2fd3ff", "#b06bff"]),
      A("aura_ghostfire", "Ghost Flames", "legendary", "member", null, "flicker", "#4da6ff", "ghostfire", ["#e0f7ff", "#6fd3ff", "#1f6fff"]),
      A("aura_storm", "Thunderhead", "mythic", "member", null, "pulse", "#8fb4ff", "storm", ["#2a3040", "#9fd4ff", "#ffffff", "#6f8cff", "#4a5468"]),
      A("aura_rift", "Void Rift", "mythic", "member", null, "void", "#b04bff", "rift", ["#12051f", "#b04bff", "#ff5af0", "#e8d0ff"]),
      A("aura_plasma", "Plasma Ring", "mythic", "member", null, "pulse", "#6ff7ff", "plasma", ["#ffffff", "#6ff7ff", "#b98bff"]),
      A("aura_prism", "Prism", "mythic", "member", null, "pulse", "#ffffff", "prism", ["#ff4d4d", "#ffa94d", "#ffe14d", "#4dd97a", "#4da6ff", "#9a6bff", "#ffffff"]),
      // FOOTPRINTS — `kind` is the v153 G trail drawn with TU v157Btrail 0
      T("trail_confetti", "Confetti Pop", "common", "free", null, "pixels", ["#ff4d6d", "#ffd23f", "#3fd0ff", "#7dff6a", "#b06bff", "#ffffff"], "confetti"),
      T("trail_hearts", "Pixel Hearts", "rare", "free", null, "pixels", ["#ff2d55", "#ff7aa2", "#ffffff"], "hearts"),
      T("trail_slime", "Toxic Slime", "rare", "earned", "uff", "smoke", ["#e0ffc0", "#7dff3a", "#1f6a12"], "slime"),
      T("trail_lava", "Lava Cracks", "legendary", "earned", "rings3", "flame", ["#fff3a0", "#ff9a1f", "#e0301a", "#2a0a05"], "lava"),
      T("trail_runes", "Rune Glyphs", "legendary", "earned", "gen5", "sparks", ["#fff3a0", "#6ff7ff", "#ffd76f"], "runes"),
      T("trail_tron", "Neon Light Wall", "epic", "member", null, "comet", ["#ffffff", "#6ff7ff", "#ff3df2"], "tron"),
      T("trail_shards", "Ice Shards", "epic", "member", null, "ice", ["#ffffff", "#8fe3ff", "#bfe6ff"], "shards"),
      T("trail_shadow", "Shadow Smoke", "epic", "member", null, "smoke", ["#14081c", "#8a3aff", "#ff3b5a"], "shadow"),
      T("trail_sakura", "Cherry Blossoms", "epic", "member", null, "petals", ["#ffb3c7", "#ff7aa2", "#ffe14d"], "sakura"),
      T("trail_bolts", "Lightning Cleats", "legendary", "member", null, "lightning", ["#ffffff", "#bfe6ff", "#6f8cff"], "bolts"),
      T("trail_coins", "Gold Coins", "legendary", "member", null, "sparks", ["#fff6c0", "#ffd76f", "#8a5a08"], "coins"),
      T("trail_galaxy", "Galaxy Dust", "legendary", "member", null, "stars", ["#ffffff", "#8a5cff", "#3f7bff", "#ff9ad5"], "galaxy"),
      T("trail_prism", "Prism Burst", "legendary", "member", null, "rainbow", ["#ff4d4d", "#ffa94d", "#ffe14d", "#4dd97a", "#4da6ff", "#9a6bff", "#ffffff"], "prism"),
      T("trail_inferno", "Inferno", "mythic", "member", null, "flame", ["#fff3a0", "#ffb02e", "#ff5a1a", "#b8200f"], "inferno"),
      T("trail_meteor", "Meteor Strike", "mythic", "member", null, "comet", ["#fff6c0", "#ffb02e", "#ff4a1a"], "meteor")
    ];
  }

  /* ---- the painter: the same seven calls on a Phaser Graphics and on a 2D canvas (v153 G's adapters delegate here) ---- */
  function gAdapterV157B(g) { return {
    rect: function (x, y, w, h, c, a) { g.fillStyle(c, a); g.fillRect(x, y, w, h); },
    circ: function (x, y, r, c, a) { g.fillStyle(c, a); g.fillCircle(x, y, r); },
    seg: function (x1, y1, x2, y2, w, c, a) { g.lineStyle(w, c, a); g.lineBetween(x1, y1, x2, y2); },
    tri: function (x1, y1, x2, y2, x3, y3, c, a) { g.fillStyle(c, a); g.fillTriangle(x1, y1, x2, y2, x3, y3); },
    ring: function (x, y, r, w, c, a) { g.lineStyle(w, c, a); g.strokeCircle(x, y, r); },
    ell: function (x, y, rx, ry, c, a) { g.fillStyle(c, a); g.fillEllipse(x, y, rx * 2, ry * 2, 14); },
    ellS: function (x, y, rx, ry, w, c, a) { g.lineStyle(w, c, a); g.strokeEllipse(x, y, rx * 2, ry * 2, 20); } }; }
  var HEXC_V157B = {};
  function hexV157B(c) { return HEXC_V157B[c] || (HEXC_V157B[c] = "#" + ("00000" + (c >>> 0).toString(16)).slice(-6)); }
  function cAdapterV157B(ctx) {
    var al = function (a) { ctx.globalAlpha = a > 1 ? 1 : a < 0 ? 0 : a; };
    return {
      rect: function (x, y, w, h, c, a) { al(a); ctx.fillStyle = hexV157B(c); ctx.fillRect(x, y, w, h); },
      circ: function (x, y, r, c, a) { if (!(r > 0)) return; al(a); ctx.fillStyle = hexV157B(c); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU_V157B); ctx.fill(); },
      seg: function (x1, y1, x2, y2, w, c, a) { al(a); ctx.strokeStyle = hexV157B(c); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); },
      tri: function (x1, y1, x2, y2, x3, y3, c, a) { al(a); ctx.fillStyle = hexV157B(c); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fill(); },
      ring: function (x, y, r, w, c, a) { if (!(r > 0)) return; al(a); ctx.strokeStyle = hexV157B(c); ctx.lineWidth = w; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU_V157B); ctx.stroke(); },
      ell: function (x, y, rx, ry, c, a) { if (!(rx > 0 && ry > 0)) return; al(a); ctx.fillStyle = hexV157B(c); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU_V157B); ctx.fill(); },
      ellS: function (x, y, rx, ry, w, c, a) { if (!(rx > 0 && ry > 0)) return; al(a); ctx.strokeStyle = hexV157B(c); ctx.lineWidth = w; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU_V157B); ctx.stroke(); }
    };
  }
  /* a budget over a painter: past `n` primitives every call is a no-op (the per-frame particle cap) */
  var PAINT_V157B = ["rect", "circ", "seg", "tri", "ring", "ell", "ellS"];
  function capV157B(A, n) {
    var left = n, W = { used: 0, left: function () { return left; } };
    PAINT_V157B.forEach(function (k) { var f = A[k]; W[k] = function () { if (left <= 0) return; left--; W.used++; f.apply(null, arguments); }; });
    return W;
  }

  /* ---- AURAS: o = { t ms, cx, cy (his middle), top, fy (his feet), h, u (one sprite pixel), L (0 behind / 1 in front),
   *      q (how many particles), c [colours], C(i), r(i) a hash in [0,1), n(k) a particle count scaled by q } ---- */
  function auraCtxV157B(d, t, geo, L, q) {
    var seed = d._seedV157B || (d._seedV157B = (hsh(d.fx || d.kind || "aura") % 9973) + 1);
    var pal = d.col === "team" ? [colNum("team"), 0xffffff] : d._palV157B || (d._palV157B = (d.pal && d.pal.length ? d.pal : [d.col, "#ffffff"]).map(colNum));
    var h = Math.max(8, geo.bot - geo.top);
    return { t: t, cx: geo.cx, cy: (geo.top + geo.bot) / 2, top: geo.top, fy: geo.bot, h: h, u: h / 44 * (geo.uMul || 1), L: L, q: q, c: pal,
      C: function (i) { return pal[((i % pal.length) + pal.length) % pal.length]; },
      r: function (i) { return ihV153G((seed * 131 + i) | 0); },
      n: function (k) { return Math.max(1, Math.round(k * q)); } };
  }
  var AFX_V157B = {
    storm: { add: 0, draw: function (P, o) {   // a thunderhead over him, bolts cracking down around him, rain in front
      var u = o.u, t = o.t, i;
      if (o.L === 0) {
        var fl = Math.floor(t / 70);
        for (var b = 0; b < 2; b++) {
          var tb = t + b * 190, cyc = Math.floor(tb / 380), ph = frV157B(tb / 380);
          if (ph > 0.42 || o.r(cyc * 7 + b) < 0.12) continue;
          var bx = o.cx + (o.r(cyc * 7 + b + 3) - 0.5) * 26 * u, y0 = o.top - 4 * u, px = bx, py = y0, N = 6, fade = 1 - ph / 0.42;
          for (var k = 1; k <= N; k++) {
            var nx = k === N ? bx + (o.r(cyc + 11) - 0.5) * 4 * u : bx + (o.r(cyc * 31 + k * 3 + b + fl) - 0.5) * 8 * u, ny = y0 + (o.fy - y0) * k / N;
            P.seg(px, py, nx, ny, 3 * u, o.c[1], 0.4 * fade); P.seg(px, py, nx, ny, 1.1 * u, o.c[2], fade); px = nx; py = ny;
          }
          P.ell(px, o.fy, 5 * u, 1.6 * u, o.c[1], 0.55 * fade);
        }
        if (frV157B(t / 380) < 0.2) P.circ(o.cx, o.top - 5 * u, 8 * u, o.c[1], 0.3);   // the cloud lights up with a strike
        for (i = 0; i < 7; i++) {
          var dx = (i - 3) * 3.8 * u + Math.sin(t / 900 + i) * 1.1 * u, dy = o.top - 5 * u + Math.sin(t / 650 + i * 2) * 0.8 * u - (i % 2) * 1.6 * u;
          P.circ(o.cx + dx, dy, (3 + o.r(i) * 2.2) * u, o.c[0], 0.9);
        }
        for (i = 0; i < 4; i++) P.circ(o.cx + (i - 1.5) * 4.4 * u + Math.sin(t / 900 + i) * u, o.top - 7.2 * u, 1.8 * u, o.c[4], 0.7);
      } else {
        for (i = 0; i < o.n(10); i++) { var pr = frV157B(t / 380 + o.r(i + 40)), rx = o.cx + (o.r(i + 60) - 0.5) * 30 * u - pr * 2 * u, ry = o.top - 5 * u + pr * (o.fy - o.top + 5 * u);
          P.seg(rx, ry, rx - 0.8 * u, ry + 2.8 * u, 0.55 * u, o.c[3], 0.6); }
      } } },
    inferno: { add: 1, draw: function (P, o) {   // a column of flame tongues rising round him
      var u = o.u, t = o.t, N = o.L === 0 ? o.n(16) : o.n(4);
      if (o.L === 0) P.ell(o.cx, o.fy, 12 * u, 3 * u, o.c[2], 0.55 + 0.15 * Math.sin(t / 90));
      for (var i = 0; i < N; i++) {
        var k = i + o.L * 50, p = frV157B(t / (620 + o.r(k) * 300) + o.r(k + 7)), side = o.r(k + 3) - 0.5;
        var x = o.cx + side * (o.L ? 18 : 24) * u + Math.sin(t / 110 + k) * 1.2 * u, y = o.fy - p * (o.L ? 22 : 44) * u, s = (1 - p) * (o.L ? 1.6 : 3.6) * u + 0.6 * u;
        var col = o.c[p < 0.2 ? 0 : p < 0.45 ? 1 : p < 0.75 ? 2 : 3];
        P.tri(x - s, y, x + s, y, x + Math.sin(t / 70 + k) * s * 0.6, y - s * 2.8, col, 0.85 * (1 - p * 0.6));
        P.circ(x, y, s * 0.9, col, 0.7 * (1 - p));
      } } },
    crystal: { add: 0, draw: function (P, o) {   // ice crystals orbiting him — the near half passes in front
      var u = o.u, t = o.t, N = 7, i;
      if (o.L === 0) P.ellS(o.cx, o.cy + 3 * u, 15 * u, 5 * u, 0.6 * u, o.c[1], 0.35);
      for (i = 0; i < N; i++) {
        var a = t / 1300 * TAU_V157B + i * TAU_V157B / N, sn = Math.sin(a);
        if ((sn > 0) !== (o.L === 1)) continue;
        var x = o.cx + Math.cos(a) * 15 * u, y = o.cy + 3 * u + sn * 5 * u + Math.sin(t / 400 + i * 1.7) * 1.5 * u - (i % 3) * 3 * u;
        var s = (1.8 + (i % 2) * 0.8) * u * (0.8 + 0.1 * (sn + 1));
        P.tri(x, y - s * 1.8, x - s, y, x, y + s * 1.8, o.c[1], 0.95); P.tri(x, y - s * 1.8, x + s, y, x, y + s * 1.8, o.c[2], 0.95);
        P.tri(x - s * 0.4, y - s * 0.6, x, y - s * 1.5, x, y - s * 0.2, o.c[0], 0.9);
        if (o.r(i + Math.floor(t / 200) * 9) > 0.75) P.rect(x + s, y - s * 1.6, 0.8 * u, 0.8 * u, o.c[0], 1);   // a glint
      }
      if (o.L === 0) for (var k = 0; k < o.n(8); k++) { var pk = frV157B(t / 1600 + o.r(k + 30)); P.rect(o.cx + (o.r(k + 40) - 0.5) * 30 * u, o.top + pk * o.h, 0.8 * u, 0.8 * u, o.c[0], 0.8 * (1 - pk)); }
    } },
    rift: { add: 0, draw: function (P, o) {   // a tear in the air behind him, everything spiralling into it
      var u = o.u, t = o.t, pu = 1 + 0.06 * Math.sin(t / 240), ry = o.cy - 2 * u;
      if (o.L === 0) {
        P.ell(o.cx, ry, 12 * u * pu, 25 * u * pu, o.c[1], 0.35);
        P.ell(o.cx, ry, 9 * u * pu, 22 * u * pu, o.c[0], 0.92);
        P.ellS(o.cx, ry, 9 * u * pu, 22 * u * pu, 1.2 * u, o.c[2], 0.7 + 0.3 * Math.sin(t / 90));
        for (var k = 0; k < 3; k++) { var yy = ry + (frV157B(t / 900 + k / 3) - 0.5) * 40 * u; P.seg(o.cx - 2 * u, yy, o.cx + 2 * u, yy + 1.5 * u, 0.6 * u, o.c[3], 0.5); }
      }
      var N = o.L ? o.n(5) : o.n(16);
      for (var i = 0; i < N; i++) {
        var j = i + o.L * 40, p = frV157B(t / 1300 + o.r(j)), ang = o.r(j + 5) * TAU_V157B + p * 5, r = (1 - p) * 22 * u + 2 * u;
        P.rect(o.cx + Math.cos(ang) * r - 0.7 * u, ry + Math.sin(ang) * r * 1.2 - 0.7 * u, 1.4 * u, 1.4 * u, i % 2 ? o.c[2] : o.c[3], 0.9 * Math.min(1, p * 3));
      } } },
    galaxy: { add: 1, draw: function (P, o) {   // a two-armed spiral galaxy turning at his feet
      var u = o.u, t = o.t, rot = t / 2600 * TAU_V157B, gy = o.fy - 2 * u;
      if (o.L === 0) { P.ell(o.cx, gy, 16 * u, 5.5 * u, o.c[4], 0.45); P.ell(o.cx, gy, 6 * u, 2.2 * u, o.c[2], 0.5); P.ell(o.cx, gy, 2.5 * u, 1 * u, o.c[0], 0.8); }
      var N = o.n(26);
      for (var i = 0; i < N; i++) {
        var arm = i % 2, r = (2 + (i >> 1) * 1.15) * u, ang = rot + arm * Math.PI + r / u * 0.32, sn = Math.sin(ang);
        if ((sn > 0) !== (o.L === 1)) continue;
        var x = o.cx + Math.cos(ang) * r * 1.15, y = gy + sn * r * 0.36, tw = 0.5 + 0.5 * Math.sin(t / 160 + i * 2.1), s = (0.5 + 0.7 * tw) * u;
        P.rect(x - s / 2, y - s / 2, s, s, o.c[i % 4], 0.6 + 0.4 * tw);
      }
      if (o.L === 0) for (var k = 0; k < o.n(6); k++) { var p = frV157B(t / 2000 + o.r(k + 70)), x2 = o.cx + (o.r(k + 80) - 0.5) * 26 * u, y2 = o.fy - p * o.h * 1.1, a2 = (1 - p) * (0.5 + 0.5 * Math.sin(t / 120 + k)), s2 = 1.6 * u;
        P.rect(x2 - s2, y2 - 0.3 * u, s2 * 2, 0.6 * u, o.c[0], a2); P.rect(x2 - 0.3 * u, y2 - s2, 0.6 * u, s2 * 2, o.c[0], a2); }
    } },
    corona: { add: 1, draw: function (P, o) {   // a sun behind him: turning rays, a burning rim, flares
      if (o.L === 1) return;
      var u = o.u, t = o.t, cx = o.cx, cy = o.cy - 6 * u, rot = t / 4000 * TAU_V157B, N = 14, i;
      for (i = 0; i < N; i++) {
        var a = rot + i * TAU_V157B / N, len = (14 + 6 * Math.sin(t / 260 + i * 1.9)) * u * (i % 2 ? 0.8 : 1.1), w = 0.14, r0 = 8 * u;
        P.tri(cx + Math.cos(a - w) * r0, cy + Math.sin(a - w) * r0, cx + Math.cos(a + w) * r0, cy + Math.sin(a + w) * r0, cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len), o.c[i % 2 ? 2 : 1], 0.6);
      }
      P.circ(cx, cy, 11 * u, o.c[3], 0.25); P.circ(cx, cy, 9 * u, o.c[1], 0.45); P.circ(cx, cy, 6.5 * u, o.c[0], 0.5);
      P.ring(cx, cy, (9 + 1.5 * Math.sin(t / 200)) * u, 0.8 * u, o.c[0], 0.7);
      for (var f = 0; f < 2; f++) { var fa = rot * 3 + f * Math.PI, p = frV157B(t / 900 + f * 0.5), rr = (9 + p * 10) * u; P.circ(cx + Math.cos(fa) * rr, cy + Math.sin(fa) * rr, (1.6 - p) * u + 0.3 * u, o.c[0], 1 - p); }
    } },
    bloodmoon: { add: 0, draw: function (P, o) {   // a red moon over his shoulder, a red mist, bats wheeling round him
      var u = o.u, t = o.t;
      if (o.L === 0) {
        var mx = o.cx + 5 * u, my = o.top + 5 * u + Math.sin(t / 1400) * u;
        P.circ(mx, my, 15 * u, o.c[0], 0.18 + 0.06 * Math.sin(t / 500)); P.circ(mx, my, 12 * u, o.c[0], 0.9);
        P.circ(mx - 4 * u, my - 5 * u, 3 * u, o.c[2], 0.3);
        P.circ(mx - 3 * u, my - 2 * u, 2.6 * u, o.c[1], 0.7); P.circ(mx + 4 * u, my + 3 * u, 1.8 * u, o.c[1], 0.7); P.circ(mx + 1 * u, my - 6 * u, 1.3 * u, o.c[1], 0.6);
        for (var k = 0; k < o.n(10); k++) { var p = frV157B(t / 1800 + o.r(k)), x = o.cx + (o.r(k + 10) - 0.5) * 26 * u + Math.sin(t / 500 + k) * 2 * u, y = o.fy - p * 26 * u;
          P.circ(x, y, (2 + p * 4) * u, o.c[3], 0.45 * (1 - p)); }
      }
      for (var b = 0; b < 3; b++) { var a = t / (1500 + b * 300) * TAU_V157B + b * 2.1, sn = Math.sin(a); if ((sn > 0) !== (o.L === 1)) continue;
        var bx = o.cx + Math.cos(a) * (14 + b * 3) * u, by = o.top + (2 + b * 5) * u + sn * 3 * u, fl = Math.sin(t / 60 + b * 3) * 1.6 * u, w = 2.4 * u;
        P.seg(bx - w, by - fl, bx, by, 0.9 * u, o.c[4], 1); P.seg(bx, by, bx + w, by - fl, 0.9 * u, o.c[4], 1); P.rect(bx - 0.5 * u, by - 0.5 * u, u, u, o.c[4], 1); }
    } },
    toxic: { add: 0, draw: function (P, o) {   // a green pool and bubbles that rise and pop
      var u = o.u, t = o.t;
      if (o.L === 0) { P.ell(o.cx, o.fy, 14 * u, 3.5 * u, o.c[2], 0.55); P.ell(o.cx + Math.sin(t / 600) * 2 * u, o.fy - 1 * u, 9 * u, 2.2 * u, o.c[1], 0.5); }
      var N = o.L ? o.n(5) : o.n(14);
      for (var i = 0; i < N; i++) {
        var j = i + o.L * 30, p = frV157B(t / (1400 + o.r(j) * 900) + o.r(j + 3)), x = o.cx + (o.r(j + 6) - 0.5) * (o.L ? 16 : 26) * u + Math.sin(t / 300 + j) * 1.2 * u, y = o.fy - p * 34 * u, r = (0.8 + o.r(j + 9) * 1.6) * u * (0.6 + p * 0.6);
        if (p > 0.88) { var q = (p - 0.88) / 0.12; P.ring(x, y, r * (1 + q * 1.5), 0.5 * u, o.c[0], 1 - q); continue; }
        P.circ(x, y, r, o.c[1], 0.35); P.ring(x, y, r, 0.5 * u, o.c[0], 0.95); P.rect(x - r * 0.5, y - r * 0.6, 0.6 * u, 0.6 * u, o.c[3], 0.9);
      } } },
    neon: { add: 1, draw: function (P, o) {   // a scrolling neon grid under him, a scan ring, a scan line, brackets
      if (o.L === 1) return;
      var u = o.u, t = o.t, gy = o.fy, W = 18 * u, D = 6 * u, sc = frV157B(t / 700), k;
      for (k = 0; k < 5; k++) { var f = (k + sc) / 5, y = gy - D + f * 2 * D, hw = W * (0.55 + 0.45 * f); P.seg(o.cx - hw, y, o.cx + hw, y, 0.7 * u, o.c[0], 0.3 + 0.6 * f); }
      for (k = -3; k <= 3; k++) P.seg(o.cx + k * W * 0.18, gy - D, o.cx + k * W * 0.33, gy + D, 0.6 * u, o.c[0], 0.7);
      var p = frV157B(t / 1200); P.ellS(o.cx, gy, (3 + p * 20) * u, (1 + p * 6.5) * u, 1 * u, o.c[1], 1 - p);
      var sy = o.fy - frV157B(t / 1500) * o.h * 1.2; P.seg(o.cx - 11 * u, sy, o.cx + 11 * u, sy, 2.6 * u, o.c[1], 0.2); P.seg(o.cx - 11 * u, sy, o.cx + 11 * u, sy, 0.9 * u, o.c[1], 0.8);
      var pu = 0.6 + 0.4 * Math.sin(t / 160);
      for (var sd = -1; sd <= 1; sd += 2) { var bx = o.cx + sd * 11 * u;
        P.seg(bx, o.top, bx, o.top + 4 * u, 0.8 * u, o.c[0], pu); P.seg(bx, o.top, bx - sd * 2 * u, o.top, 0.8 * u, o.c[0], pu); P.seg(bx, o.fy - 4 * u, bx, o.fy, 0.8 * u, o.c[1], pu); }
    } },
    pillar: { add: 1, draw: function (P, o) {   // a beam of light from above, motes drifting down it
      var u = o.u, t = o.t, pu = 0.8 + 0.2 * Math.sin(t / 380), top = o.top - 60 * u;
      if (o.L === 0) {
        P.rect(o.cx - 10 * u, top, 20 * u, o.fy - top, o.c[2], 0.12 * pu); P.rect(o.cx - 6.5 * u, top, 13 * u, o.fy - top, o.c[1], 0.2 * pu); P.rect(o.cx - 3 * u, top, 6 * u, o.fy - top, o.c[0], 0.35 * pu);
        var rp = frV157B(t / 900); P.ell(o.cx, o.fy, 12 * u, 3 * u, o.c[2], 0.45 * pu); P.ellS(o.cx, o.fy, (12 + 5 * rp) * u, (3 + 1.3 * rp) * u, 0.7 * u, o.c[0], 1 - rp);
      }
      var N = o.L ? o.n(5) : o.n(14);
      for (var i = 0; i < N; i++) { var j = i + o.L * 30, p = frV157B(t / (1600 + o.r(j) * 700) + o.r(j + 2)), x = o.cx + (o.r(j + 4) - 0.5) * 18 * u + Math.sin(t / 500 + j) * u, y = o.top - 14 * u + p * (o.fy - o.top + 14 * u), s = (0.6 + o.r(j + 8) * 0.8) * u;
        P.rect(x - s / 2, y - s / 2, s, s, o.c[i % 3], Math.sin(p * Math.PI)); }
    } },
    shadow: { add: 0, draw: function (P, o) {   // dark tendrils writhing up out of a pool round him
      var u = o.u, t = o.t;
      if (o.L === 0) P.ell(o.cx, o.fy, 13 * u, 3.4 * u, o.c[0], 0.7);
      var N = o.L ? 2 : o.n(7);
      for (var i = 0; i < N; i++) {
        var j = i + o.L * 10, ang = (i + 0.5) / N * Math.PI, bx = o.cx + Math.cos(ang) * 11 * u * (o.L ? 0.7 : 1), H = (22 + o.r(j) * 14) * u, px = bx, py = o.fy;
        for (var k = 1; k <= 7; k++) { var f = k / 7, nx = bx + Math.sin(t / 380 + j * 1.3 + f * 3.2) * (1.5 + f * 4.5) * u + (bx - o.cx) * f * 0.3, ny = o.fy - f * H, w = (3 - f * 2.3) * u;
          P.seg(px, py, nx, ny, w + 1.2 * u, o.c[1], 0.35 * (1 - f * 0.5)); P.seg(px, py, nx, ny, w, o.c[0], 0.9); px = nx; py = ny; }
        P.circ(px, py, 0.7 * u, o.c[2], 0.6 + 0.4 * Math.sin(t / 120 + j));
      } } },
    coins: { add: 0, draw: function (P, o) {   // gold coins raining round him, spinning as they fall
      var u = o.u, t = o.t, N = o.n(12);
      if (o.L === 0) P.ell(o.cx, o.fy, 11 * u, 2.6 * u, o.c[1], 0.35);
      for (var i = 0; i < N; i++) {
        if ((i % 3 === 0) !== (o.L === 1)) continue;
        var p = frV157B(t / (1100 + o.r(i) * 500) + o.r(i + 3)), x = o.cx + (o.r(i + 6) - 0.5) * 30 * u, y = o.top - 12 * u + p * (o.h + 14 * u), sp = Math.abs(Math.cos(t / 140 + i * 1.3)), w = (0.35 + 1.9 * sp) * u, hh = 2.1 * u;
        P.ell(x, y, w + 0.4 * u, hh + 0.4 * u, o.c[2], 0.95); P.ell(x, y, w, hh, o.c[1], 1); if (sp > 0.5) P.rect(x - w * 0.4, y - hh * 0.6, 0.6 * u, hh * 0.9, o.c[0], 0.9);
      }
      if (o.L === 1) for (var k = 0; k < 3; k++) { var q = frV157B(t / 700 + k / 3); P.rect(o.cx + (o.r(k + 50 + Math.floor(t / 700 + k / 3) * 5) - 0.5) * 20 * u, o.fy - 2 * u - q * 3 * u, 0.8 * u, 0.8 * u, o.c[0], 1 - q); }
    } },
    plasma: { add: 1, draw: function (P, o) {   // a crackling ring of plasma round his waist, arcs leaping to him
      var u = o.u, t = o.t, cy = o.cy + 2 * u, RX = 14 * u, RY = 4.6 * u, N = Math.max(12, o.n(28)), fl = Math.floor(t / 55), px = null, py = null;
      for (var i = 0; i <= N; i++) {
        var a = i / N * TAU_V157B, sn = Math.sin(a), j = (o.r((i % N) + fl * 7) - 0.5) * 2.2 * u, x = o.cx + Math.cos(a) * (RX + j), y = cy + sn * (RY + j * 0.4);
        if (px != null && (sn > 0) === (o.L === 1)) { P.seg(px, py, x, y, 2.6 * u, o.c[1], 0.3); P.seg(px, py, x, y, 0.9 * u, o.c[0], 0.95); }
        px = x; py = y;
      }
      for (var k = 0; k < 3; k++) { var a2 = t / 1000 * TAU_V157B + k * TAU_V157B / 3, s2 = Math.sin(a2); if ((s2 > 0) !== (o.L === 1)) continue;
        var nx = o.cx + Math.cos(a2) * RX, ny = cy + s2 * RY; P.circ(nx, ny, 2.2 * u, o.c[2], 0.5); P.circ(nx, ny, 1.1 * u, o.c[0], 1); }
      if (o.L === 0 && o.r(fl + 99) > 0.55) {
        var aa = o.r(fl + 3) * TAU_V157B, sx = o.cx + Math.cos(aa) * RX, sy = cy + Math.sin(aa) * RY, ex = o.cx + (o.r(fl + 5) - 0.5) * 6 * u, ey = o.cy - o.r(fl + 8) * 10 * u, mx = (sx + ex) / 2 + (o.r(fl + 9) - 0.5) * 6 * u, my = (sy + ey) / 2;
        P.seg(sx, sy, mx, my, 0.8 * u, o.c[2], 0.9); P.seg(mx, my, ex, ey, 0.8 * u, o.c[2], 0.9);
      } } },
    sakura: { add: 0, draw: function (P, o) {   // blossoms spiralling down round him
      var u = o.u, t = o.t, N = o.n(14);
      for (var i = 0; i < N; i++) {
        var a = t / 2200 * TAU_V157B + i * 2.4, sn = Math.sin(a); if ((sn > 0) !== (o.L === 1)) continue;
        var p = frV157B(t / (2600 + o.r(i) * 800) + o.r(i + 1)), x = o.cx + Math.cos(a) * (10 + o.r(i + 2) * 6) * u, y = o.top - 6 * u + p * (o.h + 8 * u), sp = Math.cos(t / 200 + i), al = 0.95 * Math.min(1, (1 - p) * 4, p * 6);
        P.ell(x, y, (1.1 + 0.4 * Math.abs(sp)) * u, 0.75 * u, o.c[i % 2], al); P.rect(x - 0.3 * u, y - 0.3 * u, 0.6 * u, 0.6 * u, o.c[2], al);
      }
      if (o.L === 0) P.ell(o.cx, o.fy, 10 * u, 2.4 * u, o.c[0], 0.3);
    } },
    borealis: { add: 1, draw: function (P, o) {   // three curtains of the northern lights waving over him
      if (o.L === 1) return;
      var u = o.u, t = o.t, step = 2 / Math.max(0.4, o.q);
      for (var b = 0; b < 3; b++) {
        var base = o.top - (4 + b * 4) * u, col = o.c[b];
        for (var x = -18; x <= 18; x += step) {
          var X = o.cx + x * u, y0 = base + Math.sin(x * 0.22 + t / 700 + b * 1.7) * 3 * u + Math.sin(x * 0.07 + t / 1300) * 2 * u, len = (12 + 6 * Math.sin(x * 0.3 + t / 450 + b)) * u, e = 1 - Math.abs(x) / 19;
          P.seg(X, y0, X, y0 + len, step * 0.9 * u, col, 0.14 * e); P.seg(X, y0, X, y0 + len * 0.4, step * 0.9 * u, col, 0.32 * e);
        }
      } } },
    matrix: { add: 1, draw: function (P, o) {   // columns of green ones and zeros falling behind him
      if (o.L === 1) return;
      var u = o.u, t = o.t, cols = o.n(7), rowH = 2.8 * u, rows = Math.ceil((o.h + 16 * u) / rowH);
      for (var k = 0; k < cols; k++) {
        var x = o.cx + (k - (cols - 1) / 2) * (26 / cols) * u, head = frV157B(t / (900 + o.r(k) * 700) + o.r(k + 3)) * (rows + 6), tail = 7;
        for (var rr = 0; rr < rows; rr++) {
          var d = head - rr; if (d < 0 || d > tail) continue;
          var y = o.top - 12 * u + rr * rowH, one = o.r(k * 97 + rr * 13 + Math.floor(t / 260) * 7) > 0.5, a = d < 1 ? 1 : 0.85 * (1 - d / tail), col = d < 1 ? o.c[0] : o.c[1];
          if (one) P.rect(x - 0.35 * u, y, 0.7 * u, 2 * u, col, a); else P.ellS(x, y + u, 0.7 * u, 0.95 * u, 0.45 * u, col, a);
        }
      }
      P.ell(o.cx, o.fy, 12 * u, 2.8 * u, o.c[2], 0.4);
    } },
    embers: { add: 0, draw: function (P, o) {   // smoke rolling up, embers riding it
      var u = o.u, t = o.t, i;
      if (o.L === 0) for (i = 0; i < o.n(8); i++) { var p = frV157B(t / 2400 + i / 8), x = o.cx + (o.r(i) - 0.5) * 16 * u + Math.sin(t / 700 + i) * 3 * u * p, y = o.fy - p * 40 * u;
        P.circ(x, y, (2.5 + p * 6) * u, o.c[0], 0.5 * (1 - p)); }
      var N = o.L ? o.n(6) : o.n(16);
      for (i = 0; i < N; i++) { var j = i + o.L * 40, q = frV157B(t / (900 + o.r(j) * 700) + o.r(j + 1)), ex = o.cx + (o.r(j + 2) - 0.5) * (o.L ? 18 : 26) * u + Math.sin(t / 150 + j * 2) * 1.5 * u, ey = o.fy - q * 36 * u, s = (0.9 + o.r(j + 3) * 0.9) * u * (1 - q * 0.5);
        P.rect(ex - s / 2, ey - s / 2, s, s, o.c[q < 0.3 ? 3 : q < 0.65 ? 1 : 2], 1 - q); }
    } },
    ghostfire: { add: 1, draw: function (P, o) {   // blue will-o'-wisps circling him
      var u = o.u, t = o.t, N = o.n(7);
      for (var i = 0; i < N; i++) {
        var a = t / 2400 * TAU_V157B + i * TAU_V157B / N, sn = Math.sin(a); if ((sn > 0) !== (o.L === 1)) continue;
        var x = o.cx + Math.cos(a) * 14 * u, y = o.cy + sn * 4 * u + Math.sin(t / 300 + i * 2) * 3 * u - (i % 3) * 5 * u, fl = 0.8 + 0.2 * Math.sin(t / 60 + i * 5), s = 2.4 * u * fl * (0.8 + 0.1 * (sn + 1)), sw = Math.sin(t / 90 + i);
        P.circ(x, y, s * 1.8, o.c[2], 0.25);
        P.tri(x - s, y, x + s, y, x + sw * s * 0.8, y - s * 3.2, o.c[1], 0.8); P.circ(x, y, s, o.c[1], 0.85);
        P.tri(x - s * 0.5, y, x + s * 0.5, y, x + sw * s * 0.5, y - s * 1.9, o.c[0], 0.95); P.circ(x, y + s * 0.1, s * 0.5, o.c[0], 1);
      } } },
    prism: { add: 1, draw: function (P, o) {   // rainbow rays wheeling behind him, a hexagon turning the other way, sparkles
      var u = o.u, t = o.t, cx = o.cx, cy = o.cy - 3 * u, i;
      if (o.L === 0) {
        var rot = t / 3000 * TAU_V157B, N = 12, hr = 15 * u, hrot = -t / 2200 * TAU_V157B, sh = Math.floor(t / 150);
        for (i = 0; i < N; i++) { var a = rot + i * TAU_V157B / N, r1 = (18 + 4 * Math.sin(t / 300 + i)) * u;
          P.tri(cx, cy, cx + Math.cos(a - 0.1) * r1, cy + Math.sin(a - 0.1) * r1, cx + Math.cos(a + 0.1) * r1, cy + Math.sin(a + 0.1) * r1, o.c[i % 6], 0.42); }
        for (i = 0; i < 6; i++) { var a1 = hrot + i * TAU_V157B / 6, a2 = a1 + TAU_V157B / 6; P.seg(cx + Math.cos(a1) * hr, cy + Math.sin(a1) * hr * 1.2, cx + Math.cos(a2) * hr, cy + Math.sin(a2) * hr * 1.2, 0.9 * u, o.c[(i + sh) % 6], 0.9); }
      } else {
        for (i = 0; i < o.n(6); i++) { var ph = t / 900 + o.r(i), p = frV157B(ph), cyc = Math.floor(ph), x = cx + (o.r(i * 5 + cyc * 11 + 10) - 0.5) * 26 * u, y = cy + (o.r(i * 5 + cyc * 11 + 20) - 0.5) * 34 * u, s = Math.sin(p * Math.PI) * 1.8 * u;
          P.rect(x - s, y - 0.3 * u, s * 2, 0.6 * u, o.c[6], 0.9); P.rect(x - 0.3 * u, y - s, 0.6 * u, s * 2, o.c[6], 0.9); }
      } } }
  };
  /* the v153 G auras, animated for the card and the Locker (the field keeps v153 G's own pulse / flicker) */
  var LEGACY_V157B = {
    glow: { add: 1, draw: function (P, o) { if (o.L) return; for (var i = 0; i < o.n(6); i++) { var p = frV157B(o.t / 2600 + i / 6), x = o.cx + (o.r(i) - 0.5) * 20 * o.u, y = o.fy - p * 40 * o.u; P.circ(x, y, 1.1 * o.u, o.c[0], 0.85 * Math.sin(p * Math.PI)); } } },
    pulse: { add: 1, draw: function (P, o) { if (o.L) return; for (var k = 0; k < 2; k++) { var p = frV157B(o.t / 1300 + k / 2); P.ellS(o.cx, o.cy + 2 * o.u, (6 + p * 14) * o.u, (8 + p * 18) * o.u, 1.2 * o.u, o.c[0], 0.8 * (1 - p)); } } },
    flicker: { add: 1, draw: function (P, o) { for (var i = 0; i < o.n(o.L ? 3 : 12); i++) { var j = i + o.L * 20, p = frV157B(o.t / 1000 + o.r(j)), x = o.cx + (o.r(j + 1) - 0.5) * 22 * o.u + Math.sin(o.t / 130 + j) * o.u, y = o.fy - p * 34 * o.u, s = (1 - p * 0.6) * 1.4 * o.u; P.rect(x - s / 2, y - s / 2, s, s, o.c[0], 1 - p); } } },
    frost: { add: 0, draw: function (P, o) { for (var i = 0; i < o.n(o.L ? 3 : 8); i++) { var j = i + o.L * 20, p = frV157B(o.t / 2400 + o.r(j)), x = o.cx + (o.r(j + 1) - 0.5) * 26 * o.u + Math.sin(o.t / 500 + j) * 2 * o.u, y = o.top - 4 * o.u + p * (o.h + 6 * o.u), s = 1.3 * o.u, a = Math.sin(p * Math.PI);
      P.rect(x - s, y - 0.25 * o.u, s * 2, 0.5 * o.u, o.c[1], a); P.rect(x - 0.25 * o.u, y - s, 0.5 * o.u, s * 2, o.c[1], a); } } },
    void: { add: 0, draw: function (P, o) { for (var i = 0; i < o.n(o.L ? 3 : 10); i++) { var j = i + o.L * 20, p = frV157B(o.t / 1500 + o.r(j)), ang = o.r(j + 3) * TAU_V157B + p * 4, r = (1 - p) * 20 * o.u + o.u;
      P.rect(o.cx + Math.cos(ang) * r - 0.6 * o.u, o.cy + Math.sin(ang) * r * 1.3 - 0.6 * o.u, 1.2 * o.u, 1.2 * o.u, o.c[1], Math.min(1, p * 3)); } } }
  };
  function auraFxV157B(d) { return (d && d.fx && AFX_V157B[d.fx]) || afxV159D(d && d.fx) || LEGACY_V157B[d && d.kind] || LEGACY_V157B.glow; }   // v159 D: its registry after this one
  function glowModV157B(kind, t) {
    if (kind === "pulse") { var sp = Math.sin(t / 300); return { a: 0.72 + 0.28 * sp, s: 1 + 0.06 * sp }; }
    if (kind === "flicker") return { a: 0.62 + 0.38 * Math.abs(Math.sin(t / 47) * Math.sin(t / 131)), s: 1 };
    return { a: 0.85 + 0.15 * Math.sin(t / 900), s: 1 + 0.02 * Math.sin(t / 900) };
  }
  /* one frame of an aura on 2D canvases: the v153 G glow (breathing), the layer behind, `mid` (the figure), the layer in front */
  function auraCanvasV157B(bx, fx, d, t, geo, q, mid) {
    var aa = auraArtV153G(d), sc = geo.h / 44 * 1.05, m = glowModV157B(d.kind, t), F = auraFxV157B(d), w = aa.w * sc * m.s, hh = aa.h * sc * m.s, n = 0;
    bx.save(); bx.globalAlpha = (d.fx ? 0.45 : 0.6) * m.a; if (d.kind !== "void") bx.globalCompositeOperation = "lighter"; bx.imageSmoothingEnabled = true;
    bx.drawImage(aa.cv, geo.cx - w / 2, (geo.top + geo.bot) / 2 - hh / 2 + 2 * sc, w, hh); bx.restore();
    var lay = function (ctx, L) { ctx.save(); if (F.add) ctx.globalCompositeOperation = "lighter"; var P = capV157B(cAdapterV157B(ctx), 400); F.draw(P, auraCtxV157B(d, t, geo, L, q)); n += P.used; ctx.restore(); };
    lay(bx, 0); if (mid) mid(); lay(fx || bx, 1);
    return n;
  }
  /* ON THE FIELD: two Graphics in his container, behind the body and in front of it, redrawn each frame */
  function gfxChildV157B(scene, m, prop) {
    var o = m[prop]; if (o && (!o.scene || !o.active)) o = m[prop] = null;
    if (!o) { o = m[prop] = scene.add.graphics(); m.root.add(o); }
    return o;
  }
  function auraFieldV157B(scene, m, A, geo, now, down) {
    try {
      var d = A && A.d, F = d && d.fx && auraOnV157B() ? AFX_V157B[d.fx] || afxV159D(d.fx) : null;   // v159 D: its auras too
      if (!F) { dropV153G(m, "_auBV157B"); dropV153G(m, "_auFV157B"); return 0; }
      var gb = gfxChildV157B(scene, m, "_auBV157B"), gf = gfxChildV157B(scene, m, "_auFV157B");
      orderV153G(m, gb, "back"); orderV153G(m, gf, "front");
      var bm = F.add ? 1 : 0; if (gb._bmV157B !== bm) { gb.setBlendMode(bm); gf.setBlendMode(bm); gb._bmV157B = bm; }
      gb.clear(); gf.clear(); gb.setAlpha(down ? 0.4 : 1); gf.setVisible(!down);
      var q = TUv("v157BauraFieldQ", 0.6), cap = TUv("v157BauraCap", 90), g = { top: geo.top, bot: geo.bot, cx: geo.cx };
      var Pb = capV157B(gAdapterV157B(gb), cap), Pf = capV157B(gAdapterV157B(gf), Math.round(cap / 2));
      F.draw(Pb, auraCtxV157B(d, now, g, 0, q));
      if (!down) F.draw(Pf, auraCtxV157B(d, now, g, 1, q));
      V157.field.aura++; V157.field.auraId = A.id; V157.field.auraPrims = Pb.used + Pf.used;
      return Pb.used + Pf.used;
    } catch (e) { errV157B(e); return 0; }
  }

  /* ---- FOOTPRINTS: each draws ONE point p (q the point before it, a its age 0..1, F = 1 - a, s the scale) ---- */
  var RUNES_V157B = [
    [0, -1, 0, 1, 0, -0.6, 0.7, -1, 0, -0.1, 0.7, -0.5],                       // fehu
    [-0.4, -1, -0.4, 1, -0.4, -1, 0.5, -0.5, 0.5, -0.5, -0.4, 0, -0.4, 0, 0.5, 1],   // raido
    [0, -1, 0, 1, 0, -0.2, -0.7, -1, 0, -0.2, 0.7, -1],                         // algiz
    [0, -1, -0.6, -0.2, 0, -1, 0.6, -0.2, -0.6, -0.2, 0.6, 0.8, 0.6, -0.2, -0.6, 0.8],   // othala
    [0, -1, 0, 1, 0, -1, -0.6, -0.4, 0, -1, 0.6, -0.4]                          // tiwaz
  ];
  function nearV157B(p, q, s) { return q && Math.abs(p.x - q.x) + Math.abs(p.y - q.y) < 40 * s; }
  var TFX_V157B = {
    inferno: { life: 1.25, draw: function (P, p, q, a, F, s, now, c) {   // BIG: three tall tongues of fire on a burning bed, embers
      var ci = a < 0.18 ? 0 : a < 0.4 ? 1 : a < 0.7 ? 2 : 3, al = Math.min(1, F * 1.5);
      P.circ(p.x, p.y - a * 3 * s, (1.5 + 3.2 * F) * s, c[Math.min(3, ci + 1)], 0.55 * F);
      for (var k = 0; k < 3; k++) {
        var r = ihV153G(p.i * 13 + 3 + k), w = (1.2 + 2.6 * F * (0.6 + 0.4 * r)) * s, H = (5 + 9 * r) * s * (0.4 + 0.6 * Math.sqrt(F)), x = p.x + (r - 0.5) * 7 * s, y = p.y - a * 6 * s, sway = Math.sin(now / 70 + p.i * 1.7 + k * 2) * 1.8 * s;
        P.tri(x - w, y, x + w, y, x + sway, y - H, c[Math.min(3, ci + (k === 1 ? 0 : 1))], al);
        if (k === 1) P.tri(x - w * 0.45, y, x + w * 0.45, y, x + sway * 0.6, y - H * 0.55, c[0], al);
      }
      if (p.i % 3 === 0) P.rect(p.x + (ihV153G(p.i * 13 + 9) - 0.5) * 8 * s, p.y - 4 * s - a * 16 * s, 1.2 * s, 1.2 * s, c[1], F);
    } },
    meteor: { life: 1.1, draw: function (P, p, q, a, F, s, now, c, head) {   // BIG: a burning streak, a white-hot head, sparks thrown off
      if (nearV157B(p, q, s)) {
        P.seg(q.x, q.y - 2 * s, p.x, p.y - 2 * s, (2 + 9 * F) * s, c[2], 0.35 * F);
        P.seg(q.x, q.y - 2 * s, p.x, p.y - 2 * s, (1 + 5 * F) * s, c[1], 0.8 * F);
        P.seg(q.x, q.y - 2 * s, p.x, p.y - 2 * s, (0.5 + 2.2 * F) * s, c[0], F);
      }
      if (head) { P.circ(p.x, p.y - 2 * s, 7 * s, c[1], 0.35); P.circ(p.x, p.y - 2 * s, 4 * s, c[0], 0.9); }
      var r = ihV153G(p.i * 13 + 5);
      if (r > 0.55) { var ang = ihV153G(p.i * 13 + 6) * TAU_V157B, dd = a * 12 * s; P.rect(p.x + Math.cos(ang) * dd - 0.8 * s, p.y - 2 * s + Math.sin(ang) * dd * 0.6 - a * 6 * s, 1.6 * s, 1.6 * s, c[r > 0.8 ? 0 : 1], F); }
    } },
    bolts: { life: 1, draw: function (P, p, q, a, F, s, now, c) {   // every stride cracks three bolts out of the turf
      if (p.i % 3) return false;
      var fl = Math.floor(now / 60);
      if (ihV153G(p.i * 7 + fl) < 0.12) return false;
      P.ell(p.x, p.y, 3 * s, 1.1 * s, c[2], 0.45 * F);
      for (var b = 0; b < 3; b++) {
        var ang = -Math.PI / 2 + (b - 1) * 0.9 + (ihV153G(p.i * 7 + b + fl * 3) - 0.5) * 0.6, L = (3 + 4 * F) * s, px = p.x, py = p.y;
        for (var k = 1; k <= 3; k++) { var nx = p.x + Math.cos(ang) * L * k / 3 + (ihV153G(p.i * 11 + b * 5 + k + fl) - 0.5) * 2.6 * s, ny = p.y + Math.sin(ang) * L * k / 3 * 1.1;
          P.seg(px, py, nx, ny, 2.2 * s, c[2], 0.4 * F); P.seg(px, py, nx, ny, 0.8 * s, c[0], F); px = nx; py = ny; }
      }
    } },
    tron: { life: 1.4, draw: function (P, p, q, a, F, s, now, c) {   // a light-cycle wall: a glowing base line, a top edge, magenta ribs
      if (!nearV157B(p, q, s)) return false;
      var H = 5 * s;
      P.seg(q.x, q.y - H / 2, p.x, p.y - H / 2, H, c[1], 0.16 * F);
      P.seg(q.x, q.y, p.x, p.y, 2.4 * s, c[1], 0.9 * F); P.seg(q.x, q.y, p.x, p.y, 0.8 * s, c[0], F);
      P.seg(q.x, q.y - H, p.x, p.y - H, 0.9 * s, c[1], 0.75 * F);
      if (p.i % 4 === 0) P.rect(p.x - 0.6 * s, p.y - H, 1.2 * s, H, c[2], 0.8 * F);
    } },
    shards: { life: 1.5, draw: function (P, p, q, a, F, s, now, c) {   // ice spikes shoot up out of each print, then melt
      if (p.i % 2) return false;
      var g = Math.min(1, a * 7);
      P.ell(p.x, p.y, 3.2 * s, 1.1 * s, c[2], 0.45 * F);
      for (var k = 0; k < 2; k++) { var r = ihV153G(p.i * 13 + k), x = p.x + (r - 0.5) * 5 * s, w = (1 + 0.8 * r) * s, H = (3 + 6 * r) * s * g * (0.5 + 0.5 * F), lean = (r - 0.5) * 3 * s;
        P.tri(x - w, p.y, x, p.y, x + lean, p.y - H, c[0], 0.95 * F); P.tri(x, p.y, x + w, p.y, x + lean, p.y - H, c[1], 0.95 * F); }
    } },
    lava: { life: 1.6, draw: function (P, p, q, a, F, s, now, c) {   // a crust with glowing cracks that cool yellow → orange → red
      if (p.i % 2) return false;
      var hot = c[a < 0.3 ? 0 : a < 0.6 ? 1 : 2];
      P.circ(p.x, p.y, 4 * s, c[1], 0.25 * F);
      P.ell(p.x, p.y, 2.8 * s, 1.4 * s, c[3], 0.85 * Math.min(1, F * 1.6));
      for (var k = 0; k < 3; k++) { var ang = ihV153G(p.i * 13 + k) * TAU_V157B, L = (2.5 + 3 * ihV153G(p.i * 13 + 4 + k)) * s, mx = p.x + Math.cos(ang + 0.5) * L * 0.5, my = p.y + Math.sin(ang + 0.5) * L * 0.25, ex = p.x + Math.cos(ang) * L, ey = p.y + Math.sin(ang) * L * 0.5;
        P.seg(p.x, p.y, mx, my, 1.1 * s, hot, F); P.seg(mx, my, ex, ey, 0.8 * s, hot, F); }
      if (ihV153G(p.i * 3 + Math.floor(now / 200)) > 0.8) P.circ(p.x + (ihV153G(p.i + 9) - 0.5) * 3 * s, p.y - s, 0.9 * s, c[0], F);
    } },
    coins: { life: 1.3, draw: function (P, p, q, a, F, s, now, c) {   // gold coins hop out of the prints, spinning
      if (p.i % 2) return false;
      var r = ihV153G(p.i * 13 + 1), hop = Math.sin(Math.min(1, a * 1.3) * Math.PI) * (6 + 4 * r) * s, x = p.x + (r - 0.5) * 6 * s * a, y = p.y - 1.5 * s - hop, sp = Math.abs(Math.cos(now / 90 + p.i)), w = (0.3 + 1.6 * sp) * s, h = 1.7 * s;
      P.ell(x, y, w + 0.35 * s, h + 0.35 * s, c[2], F); P.ell(x, y, w, h, c[1], F); if (sp > 0.45) P.rect(x - w * 0.35, y - h * 0.6, 0.5 * s, h * 0.9, c[0], F);
    } },
    confetti: { life: 1.5, draw: function (P, p, q, a, F, s, now, c) {   // two flipping flakes burst from every print
      for (var k = 0; k < 2; k++) { var r = ihV153G(p.i * 13 + k), r2 = ihV153G(p.i * 13 + 5 + k), up = Math.sin(Math.min(1, a * 2) * Math.PI / 2) * (5 + 6 * r) * s - Math.max(0, a - 0.5) * 8 * s,
          x = p.x + (r2 - 0.5) * 10 * s * Math.min(1, a * 2) + Math.sin(now / 150 + p.i + k) * s * a, y = p.y - s - up, fl = Math.abs(Math.cos(now / 80 + p.i * 2 + k)), w = (0.4 + 1.4 * fl) * s, h = 1.3 * s;
        P.rect(x - w / 2, y - h / 2, w, h, c[(p.i * 2 + k) % c.length], Math.min(1, F * 1.5)); }
    } },
    galaxy: { life: 1.5, draw: function (P, p, q, a, F, s, now, c) {   // nebula puffs and twinkling stars
      var r = ihV153G(p.i * 13 + 1), x = p.x + (r - 0.5) * 4 * s, y = p.y - 1.5 * s - a * 3 * s;
      P.circ(x, y, (1.5 + 3.5 * a) * s, c[1 + (p.i % 2)], 0.3 * F);
      if (p.i % 2 === 0) { var tw = 0.5 + 0.5 * Math.sin(now / 90 + p.i * 1.3), arm = (1 + 1.6 * F) * s * (0.6 + 0.4 * tw), sx = p.x + (ihV153G(p.i * 13 + 2) - 0.5) * 7 * s, sy = p.y - 2 * s - ihV153G(p.i * 13 + 3) * 5 * s, al = F * (0.6 + 0.4 * tw);
        P.rect(sx - arm, sy - 0.35 * s, arm * 2, 0.7 * s, c[0], al); P.rect(sx - 0.35 * s, sy - arm, 0.7 * s, arm * 2, c[0], al); }
      else P.rect(x + 2 * s, y - s, 0.8 * s, 0.8 * s, c[3], F);
    } },
    shadow: { life: 1.4, draw: function (P, p, q, a, F, s, now, c) {   // black smoke with a violet rim, red embers
      var r = ihV153G(p.i * 13 + 1), x = p.x + (r - 0.5) * 3 * s + Math.sin(now / 200 + p.i) * a * 2 * s, y = p.y - s - a * 6 * s, R = (1.8 + 3.8 * a) * s;
      P.circ(x, y, R + 0.8 * s, c[1], 0.3 * F); P.circ(x, y, R, c[0], 0.75 * F);
      if (p.i % 3 === 0) P.rect(x + (r - 0.5) * 4 * s, y - R - a * 4 * s, s, s, c[2], F);
    } },
    slime: { life: 1.6, draw: function (P, p, q, a, F, s, now, c) {   // neon puddles, a bubble that rises and pops, drips
      if (p.i % 2) return false;
      var r = ihV153G(p.i * 13 + 1), w = (2.4 + 1.6 * r) * s * (0.8 + 0.2 * F);
      P.ell(p.x, p.y, w + 0.6 * s, 1.5 * s, c[2], 0.8 * F); P.ell(p.x, p.y, w, 1.1 * s, c[1], 0.9 * F);
      P.rect(p.x - w * 0.4, p.y - 0.6 * s, s, 0.5 * s, c[0], F);
      var bp = Math.min(1, a * 1.8); if (bp < 1) P.ring(p.x + (r - 0.5) * 3 * s, p.y - 1.5 * s - bp * 3 * s, (0.5 + 1.5 * bp) * s, 0.45 * s, c[1], 1 - bp);
      if (p.i % 4 === 0) P.rect(p.x + w * 0.5, p.y, 0.8 * s, (1 + 3 * a) * s, c[1], F);
    } },
    sakura: { life: 1.6, draw: function (P, p, q, a, F, s, now, c) {   // five-petal blossoms, turning as they drift
      if (p.i % 2) return false;
      var r = ihV153G(p.i * 13 + 1), x = p.x + Math.sin(a * 5 + r * 6) * 4 * s * a, y = p.y - 2 * s - a * 4 * s + Math.sin(a * 3) * s, rot = now / 500 + p.i, R = (1.1 + 0.3 * F) * s;
      for (var k = 0; k < 5; k++) { var ang = rot + k * TAU_V157B / 5; P.circ(x + Math.cos(ang) * R, y + Math.sin(ang) * R, 0.95 * s, c[k % 2], F); }
      P.circ(x, y, 0.6 * s, c[2], F);
    } },
    hearts: { life: 1.5, draw: function (P, p, q, a, F, s, now, c) {   // 8-bit hearts floating up (a 5x4 pixel heart)
      if (p.i % 2) return false;
      var cs = 0.85 * s * (1 + 0.15 * Math.sin(now / 110 + p.i)), x0 = p.x + (ihV153G(p.i * 13 + 1) - 0.5) * 4 * s - 2.5 * cs, y0 = p.y - 2 * s - a * 9 * s - 2 * cs, col = c[p.i % 4 === 0 ? 1 : 0];
      P.rect(x0 + cs, y0, cs, cs, col, F); P.rect(x0 + 3 * cs, y0, cs, cs, col, F); P.rect(x0, y0 + cs, 5 * cs, cs, col, F); P.rect(x0 + cs, y0 + 2 * cs, 3 * cs, cs, col, F); P.rect(x0 + 2 * cs, y0 + 3 * cs, cs, cs, col, F);
      P.rect(x0 + cs, y0 + cs, cs * 0.6, cs * 0.6, c[2], 0.9 * F);
    } },
    runes: { life: 1.8, draw: function (P, p, q, a, F, s, now, c) {   // a glowing rune stands over a ring on every other stride
      if (p.i % 4) return false;
      var R = (3 + a * 1.2) * s, pu = 0.7 + 0.3 * Math.sin(now / 120 + p.i), g = RUNES_V157B[(p.i >> 2) % RUNES_V157B.length], col = c[(p.i >> 2) % 2 ? 1 : 0], lift = 2.5 * s * (0.3 + 0.7 * F), cy = p.y - 0.5 * s;
      P.ell(p.x, cy, R * 1.3, R * 0.55, c[2], 0.22 * F);
      P.ellS(p.x, cy, R, R * 0.45, 0.6 * s, col, 0.85 * F * pu);
      for (var k = 0; k < g.length; k += 4) P.seg(p.x + g[k] * R * 0.6, cy - lift + g[k + 1] * R * 0.6, p.x + g[k + 2] * R * 0.6, cy - lift + g[k + 3] * R * 0.6, 0.7 * s, col, F * pu);
    } },
    prism: { life: 1.2, draw: function (P, p, q, a, F, s, now, c) {   // light through a crystal: a spectrum fan thrown back from the stride
      if (p.i % 3 || !nearV157B(p, q, s)) return false;
      var back = Math.atan2(q.y - p.y, q.x - p.x), len = (4 + 7 * F) * s, bx = p.x, by = p.y - 2 * s, wh = c[6] != null ? c[6] : 0xffffff;
      for (var k = 0; k < 6; k++) { var ang = back + (k - 2.5) * 0.2; P.tri(bx, by, bx + Math.cos(ang - 0.08) * len, by + Math.sin(ang - 0.08) * len - len * 0.3, bx + Math.cos(ang + 0.08) * len, by + Math.sin(ang + 0.08) * len - len * 0.3, c[k], 0.75 * F); }
      P.tri(bx, by - 2 * s, bx - 1.3 * s, by, bx + 1.3 * s, by, wh, F); P.tri(bx, by + 1.4 * s, bx - 1.3 * s, by, bx + 1.3 * s, by, wh, 0.8 * F);
    } }
  };
  function trailLifeV157B(td) { var T = td && td.fx && trailOnV157B() ? TFX_V157B[td.fx] : null; return T ? T.life : 1; }
  function trailDrawV157B(A, pts, now, life, d, s) {
    var T = TFX_V157B[d.fx]; if (!T) return 0;
    var cols = d._colsV157B || (d._colsV157B = (d.col && d.col.length ? d.col : ["#ffffff"]).map(colNum));
    var P = capV157B(A, TUv("v157BtrailCap", 160)), drawn = 0, head = true;
    for (var k = pts.length - 1; k >= 0 && P.left() > 0; k--) {   // newest first: the cap keeps the head of the trail
      var p = pts[k], a = (now - p.t) / life; if (a >= 1 || a < 0) continue;
      if (T.draw(P, p, k > 0 ? pts[k - 1] : null, a, 1 - a, s, now, cols, head) !== false) drawn++;
      head = false;
    }
    V157.trailPrims = P.used; V157.trailId = d.fx;
    return drawn;
  }

  /* ---- ONE animation loop for every canvas that moves (the card's aura, the Locker's previews) ---- */
  var ANIM_V157B = { list: [], raf: 0, last: 0 };
  function animateV157B(cv, draw, kind) {
    var still = reducedV157B() || typeof requestAnimationFrame !== "function";
    try { draw(still ? STILL_T_V157B : performance.now()); } catch (e) { errV157B(e); }
    if (still) return false;
    if (kind === "card") { var nc = 0; ANIM_V157B.list.forEach(function (e) { if (e.kind === "card" && e.cv.isConnected) nc++; }); if (nc >= TUv("v157BcardMax", 6)) return false; }
    ANIM_V157B.list.push({ cv: cv, draw: draw, kind: kind });
    if (!ANIM_V157B.raf) ANIM_V157B.raf = requestAnimationFrame(tickV157B);
    return true;
  }
  function tickV157B(ts) {
    ANIM_V157B.raf = 0;
    ANIM_V157B.list = ANIM_V157B.list.filter(function (e) { return e.cv.isConnected; });
    V157.anim.targets = ANIM_V157B.list.length;
    if (!ANIM_V157B.list.length) return;
    if (ts - ANIM_V157B.last >= 1000 / Math.max(5, TUv("v157Bfps", 25)) - 2 && !document.hidden && !reducedV157B()) {
      ANIM_V157B.last = ts; V157.anim.frames++;
      var vh = window.innerHeight || 900;
      for (var i = 0; i < ANIM_V157B.list.length; i++) {
        var e = ANIM_V157B.list[i];
        try { var r = e.cv.getBoundingClientRect(); if (r.width === 0 || r.bottom < 0 || r.top > vh) continue; e.draw(ts); V157.anim.draws++; } catch (x) { errV157B(x); }
      }
    }
    ANIM_V157B.raf = requestAnimationFrame(tickV157B);
  }

  /* ---- the profile card: the aura on two canvases of its own (behind the figure and wings, and in front of him) ---- */
  function cardAuraV157B(host, cv, F, PAD) {
    try {
      if (!F || !F.aura || !auraOnV157B()) return false;
      var d = F.aura.d, back = document.createElement("canvas"), front = document.createElement("canvas");
      back.width = front.width = cv.width; back.height = front.height = cv.height + PAD;
      back.className = "pc-au-v157b back"; front.className = "pc-au-v157b front"; back.setAttribute("data-aura", F.aura.id);
      host.insertBefore(back, host.querySelector(".pc-fl-v153g.back") || cv);
      host.insertBefore(front, host.querySelector(".pc-fl-v153g.front"));
      host.classList.add("pc-shrink-v153g");   // the figure steps back (as for wings / a crown) and the aura gets the room round him
      var bx = back.getContext("2d"), fx = front.getContext("2d"), geo = null, geoAt = -1e12, frames = 0, still = STILL_T_V157B;
      var K = 0.8 /* the CSS's pc-shrink scale(.8) */, W2 = back.width / 2, HB = back.height;
      var draw = function (t) {
        var now = Date.now();
        if (!geo || now - geoAt > 800) {   // the figure's art can land late: re-measured now and then
          var g = inkGeoV153G(cv, 0, PAD); geoAt = now;
          if (g && g.h >= 20) geo = { cx: W2 + (g.cx - W2) * K, top: HB + (g.top - HB) * K, bot: HB + (g.bot - HB) * K, h: g.h * K, uMul: TUv("v157BcardU", 1.3) };
        }
        if (!geo) return;
        bx.clearRect(0, 0, back.width, back.height); fx.clearRect(0, 0, front.width, front.height);
        var n = auraCanvasV157B(bx, fx, d, t, geo, 1, null);
        V157.card = { id: F.aura.id, t: t, prims: n, frames: ++frames };
      };
      if (!animateV157B(back, draw, "card")) [750, 1600].forEach(function (ms) { setTimeout(function () { if (back.isConnected) { geo = null; draw(still); } }, ms); });
      return true;
    } catch (e) { errV157B(e); return false; }
  }

  /* ---- the Locker: an aura or footprints preview that moves (the prints stream away behind him) ---- */
  function previewPtsV157B(t, life, x0, x1, y) {
    var N = 18, step = life * 0.95 / N, base = t / step, sp = (x1 - x0) / N, pts = [];
    for (var j = N - 1; j >= 0; j--) { var idx = Math.floor(base) - j, age = t - idx * step; pts.push({ x: x1 - age / step * sp, y: y, t: idx * step, i: idx, key: "" }); }
    return pts;
  }
  function previewV157B(el, it) {
    try {
      var au = it.cat === "aura" && !!it.au && auraOnV157B(), tr = it.cat === "trail" && !!it.tr && it.tr.kind !== "ghost" && trailOnV157B();
      if (!au && !tr) return false;
      el.innerHTML = "";
      // drawn at twice the Locker's resolution (TU v157BpvRes) and shown smoothed at its 60px: the particles stay crisp
      var R = Math.max(1, Math.min(3, TUv("v157BpvRes", 2))), Z = 64 * R;
      var cv = document.createElement("canvas"); cv.width = Z; cv.height = Z; cv.className = "cos-fl-v153g"; cv.setAttribute("data-v157b", it.id); cv.style.imageRendering = "auto";
      var x = cv.getContext("2d"), fig = figV153G(34 * R), fx0 = (tr ? 26 : 15) * R, fy0 = Z - fig.height - 2 * R, geo = inkGeoV153G(fig, fx0, fy0) || { top: fy0, bot: Z - 2 * R, cx: fx0 + 17 * R, h: 36 * R };
      var putFig = function () { x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; x.imageSmoothingEnabled = false; x.drawImage(fig, fx0, fy0); };
      var draw = function (t) {
        x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; x.clearRect(0, 0, Z, Z); x.imageSmoothingEnabled = false;
        if (au) auraCanvasV157B(x, x, it.au, t, geo, 1, putFig);
        else {
          var life = 520 * (it.tr.kind === "ice" || it.tr.kind === "petals" ? 1.5 : 1) * trailLifeV157B(it.tr);
          trailDrawV153G(cAdapterV153G(x), previewPtsV157B(t, life, R, geo.cx - 3 * R, geo.bot - R), t, life, it.tr, 1.4 * R);
          putFig();
        }
      };
      el.appendChild(cv); animateV157B(cv, draw, "preview");
      G153.previews++; V157.previews++;
      return true;
    } catch (e) { errV157B(e); return false; }
  }

  /* ---- what the check reads: an item's look alone, drawn at a given time on a fresh canvas ---- */
  function sampleV157B(id, t) {
    var it = findItem(id); if (!it) return null;
    var c = document.createElement("canvas"), x;
    if (it.cat === "aura" && it.au) { c.width = 120; c.height = 160; x = c.getContext("2d"); auraCanvasV157B(x, x, it.au, t, { top: 50, bot: 140, cx: 60, h: 90 }, 1, null); return c; }
    if (it.cat === "trail" && it.tr && it.tr.kind !== "ghost") { c.width = 180; c.height = 70; x = c.getContext("2d"); var life = 520 * (it.tr.kind === "ice" || it.tr.kind === "petals" ? 1.5 : 1) * trailLifeV157B(it.tr);
      trailDrawV153G(cAdapterV153G(x), previewPtsV157B(t, life, 4, 170, 56), t, life, it.tr, 2.4); return c; }
    return null;
  }
  Object.assign(V157, {
    on: function () { return { aura: auraOnV157B(), trail: trailOnV157B() }; },
    ids: function () { return itemsV157B().map(function (i) { return i.id; }); },
    auraKinds: function () { return Object.keys(AFX_V157B); }, trailKinds: function () { return Object.keys(TFX_V157B); },
    sample: sampleV157B, animating: function () { return ANIM_V157B.list.filter(function (e) { return e.cv.isConnected; }).map(function (e) { return e.kind; }); }
  });
  (function () {
    if (document.getElementById("cosV157Bcss")) return;
    var st = document.createElement("style"); st.id = "cosV157Bcss";
    st.textContent = [
      ".pc-au-v157b{position:absolute;left:0;bottom:0;width:92px;height:143.75px;pointer-events:none;transform-origin:50% 100%}.pc-au-v157b.back{z-index:0}.pc-au-v157b.front{z-index:2}",
      ".pcard-v151b.compact .pc-au-v157b{width:70px;height:110px}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(st);
  })();

  /* ===== v159 D FLUTTER, CROWNS, MORE LIGHT =====
   * The owner: "Update the flutter animation for the wings, constantly moving, then a flap." · "Add crowns and animations
   * to crowns." · "Add more auras."
   *   FLUTTER  the wings are never still (`wingPoseV159D(t, kind)`, which replaces v157 A's beat-then-rest pose everywhere
   *            the wings are drawn): an always-on IDLE — a small fast tremble on a slow breathing sway — then, every
   *            `wingFlapPeriodV157A` ms, the STRONG FLAP: a raise (the anticipation, TU `wingRaiseMsV159D`), v157 A's
   *            beats (`wingFlapMsV157A`, `wingFlapBeatsV157A`, `wingFlapAmpV157A`, the squash on the downstroke), then an
   *            overshoot that settles back into the idle (TU `wingSettleMsV159D`). SECONDARY MOTION: the outer half of each
   *            wing (`tip`) lags the arm by the family's delay and ripples, drawn as a second piece hinged at the wing's
   *            middle on the card, the Locker and the growth screen (`wingDrawV159D`), and as a stretch of the wing on the
   *            field (TU `wingTipStretchV159D`). Each kind has a FAMILY (`FAM_V159D` / `FEEL_V159D`): feathers ripple,
   *            membranes (bat, demon, dragon, monarch) shiver, mechanical ones (mech, jet, clockwork, cyber) have a stepped
   *            thruster jitter and no lag at all, bone wings rattle, the ethereal ones float. A pure function of the clock
   *            (integer hashes, never Math.random): the scene clock on the field, performance.now on the card / Locker /
   *            growth screen — v157 A's one ticker, which now repaints at TU `v159DwingFps` (30) and skips canvases off
   *            screen (`flapTickV159D`). prefers-reduced-motion: still. Kill switch TU `v159Dflutter` 0: v157 A's pose.
   *   CROWNS   sixteen new kinds (`CROWNS_V159D`, drawn through v157 A's `crownArtV157A` so frame 0 is the same symmetric
   *            sprite, metal ramp and jewels): crown of thorns, 8-bit, jester, viking, ice tiara, kabuto crest, laurel of
   *            gold, antlers, pharaoh's uraeus, crystal diadem, neon halo-crown, flaming skull, dragon, storm, imperial
   *            (cross and orb), crown of stars (the stars orbit). EVERY crown (old and new) animates (`crownAnimV159D`):
   *            a light sweep across the metal, the jewels twinkling in turn, v157 A's four-point glint, and each new kind's
   *            own motion (flames flicker, bolts crack, stars orbit, bells swing, the neon hums) — `TU crownFramesV159D` (24)
   *            frames of `crownFrameMsV159D` (110) ms, cached per frame; a gentle bob on the card and the field. On the
   *            field (scene clock), the card and the growth screen (`crownRegV159D` on v157 B's one rAF loop) and the
   *            Locker. Kill switch TU `v159Dcrown` 0: v157 A's still crown and its glint.
   *   AURAS    sixteen more particle programs in their own registry (`AFX_V159D`, found after `AFX_V157B` by
   *            `afxV159D` in v157 B's two lookups): dragon spirit, phoenix rebirth, black hole, tesla coils, blossom storm,
   *            sandstorm, abyss (bioluminescence), glitch, royal banners, spirit wolves, hellgate runes, divine feathers,
   *            liquid chrome, fireflies, meteor shower, crystal cavern — v157 B's painter, caps and loop. Kill switch
   *            TU `v159Daura` 0 (or v157 B's `v157Baura` 0): their base glow.
   * SOURCES (the owner's rule): a few free, some earned (the v153 G achievements and the v156 C late rungs), the flashiest
   * are MEMBER looks ("🔒 Membership" while the store is OFF — listed, never owned; `resourceV159D` adds them to
   * `RULES_V156C`, and with TU v156Ccos 0 they fall back to an earned rule, as v157 A's wings do). The Career Pass pools are
   * untouched (a new style would reshuffle every hashed pick). `window.__V159D`; v159Dcheck. */
  function flutterOnV159D() { return flapOnV157A() && !!TUv("v159Dflutter", 1); }
  function crownAnimOnV159D() { return crownOnV157A() && !!TUv("v159Dcrown", 1); }
  function auraOnV159D() { return auraOnV157B() && !!TUv("v159Daura", 1); }
  var G_V159D = (window.__V159D = window.__V159D || { ticks: 0, paints: 0, skipped: 0, crownArt: 0, crownRegs: 0, field: null, errs: [] });
  function errV159D(e) { try { if (G_V159D.errs.length < 10) G_V159D.errs.push(String((e && e.message) || e)); } catch (x) {} }
  var TAU_V159D = 6.283185307179586;

  /* ---- the catalogue (hoisted: ITEMS takes it at the top of the file) ---- */
  function itemsV159D() {
    var C = function (id, name, rarity, source, ach, kind, col) { var it = { id: id, cat: "crown", name: name, rarity: rarity, source: source, cr: { kind: kind, col: col } }; if (ach) it.ach = ach; return it; };
    var A = function (id, name, rarity, source, ach, kind, col, fx, pal) { var it = { id: id, cat: "aura", name: name, rarity: rarity, source: source, au: { kind: kind, col: col, fx: fx, pal: pal } }; if (ach) it.ach = ach; return it; };
    return [
      // CROWNS — free, the plain ones
      C("crown_thorns", "Crown of Thorns", "common", "free", null, "thorns", ["#8a5a2e", "#c8102e", "#24140a"]),
      C("crown_pixel", "8-Bit Crown", "common", "free", null, "pixel", ["#ffd23f", "#ff2d55", "#5a3a00"]),
      C("crown_jester", "Jester's Cap", "rare", "free", null, "jester", ["#ffd23f", "#7a3ad2", "#1a0a2a"]),
      // earned — early, then waaay later
      C("crown_viking", "Viking Horns", "rare", "earned", "title", "viking", ["#efe4c8", "#8f99a6", "#2a2418"]),
      C("crown_tiara", "Ice Tiara", "epic", "earned", "gen3", "tiara", ["#e8f4ff", "#6fd3ff", "#3a5a8a"]),
      C("crown_kabuto", "Kabuto Crest", "epic", "earned", "td100", "kabuto", ["#e6c46a", "#c8102e", "#1a1410"]),
      C("crown_goldleaf", "Laurel of Gold", "legendary", "earned", "mvp", "goldleaf", ["#ffd76f", "#3fbf7f", "#5a4210"]),
      C("crown_antler", "Antler Crown", "legendary", "earned", "rings3", "antler", ["#d8bf92", "#3fbf7f", "#3a2410"]),
      C("crown_pharaoh", "Pharaoh's Uraeus", "legendary", "earned", "hof", "pharaoh", ["#ffd76f", "#1f5fbf", "#3a2606"]),
      C("crown_diadem", "Crystal Diadem", "mythic", "earned", "legacy300", "diadem", ["#dfe6ee", "#b98bff", "#2a1a5a"]),
      // member — the flashiest (an earned fallback with TU v156Ccos 0, like v157 A's wings)
      C("crown_neon", "Neon Halo-Crown", "epic", "earned", "uff", "neon", ["#ff3df2", "#6ff7ff", "#1a0a2a"]),
      C("crown_skull", "Flaming Skull Crown", "legendary", "earned", "td100", "skull", ["#efe6cf", "#ff7a1a", "#2a0a05"]),
      C("crown_dragon", "Dragon Crown", "legendary", "earned", "mvp", "dragon", ["#2f9a4a", "#e6b53a", "#0c220f"]),
      C("crown_storm", "Storm Crown", "legendary", "earned", "uff", "storm", ["#8fb4ff", "#fff27a", "#141826"]),
      C("crown_imperial", "Imperial Crown", "mythic", "earned", "hof", "imperial", ["#ffd76f", "#b3121f", "#6b4a0e"]),
      C("crown_orbit", "Crown of Stars", "mythic", "earned", "interstellar", "orbit", ["#ffd76f", "#fff6c0", "#2a1a5a"]),
      // AURAS — `kind` is the v153 G glow under the particles (all that is drawn with TU v159Daura 0)
      A("aura_fireflies", "Fireflies", "common", "free", null, "glow", "#e8ff7a", "fireflies", ["#fff7a0", "#c8ff5a", "#ffd23f"]),
      A("aura_sandstorm", "Sandstorm", "rare", "free", null, "glow", "#e8c890", "sandstorm", ["#f2d8a8", "#c8a060", "#8a6a3a", "#fff0d0"]),
      A("aura_blossom", "Blossom Storm", "rare", "earned", "uff", "glow", "#ffb3c7", "blossom", ["#ffc2d4", "#ff7aa2", "#ffffff", "#b83b5e"]),
      A("aura_glitch", "Pixel Glitch", "epic", "earned", "mvp", "glow", "#00e5ff", "glitch", ["#ff2d55", "#00e5ff", "#39ff6a", "#ffffff", "#1a1a2a"]),
      A("aura_banners", "Royal Banners", "epic", "earned", "hof", "glow", "#ffd76f", "banners", ["#8a1a2a", "#ffd76f", "#3a1f7a", "#fff3c4", "#2a0a10"]),
      A("aura_abyss", "Abyss Glow", "legendary", "earned", "interstellar", "glow", "#3fffe0", "abyss", ["#0a1a3a", "#3fffe0", "#ff6ad5", "#9ad8ff", "#ffffff"]),
      A("aura_cavern", "Crystal Cavern", "legendary", "earned", "gen5", "frost", "#b98bff", "cavern", ["#f0e0ff", "#b98bff", "#6a3aff", "#6ff7ff", "#2a1a5a"]),
      A("aura_feathers", "Divine Feathers", "epic", "earned", "title", "pulse", "#fff3c4", "feathers", ["#ffffff", "#fff3c4", "#ffd76f", "#e8e0ff"]),
      A("aura_wolves", "Spirit Wolves", "epic", "earned", "gen3", "glow", "#9fd4ff", "wolves", ["#d6f0ff", "#6fb0ff", "#ffffff", "#2a4a8a"]),
      A("aura_chrome", "Liquid Chrome", "legendary", "earned", "rings3", "glow", "#d9dee6", "chrome", ["#f4f7fb", "#b8c2cf", "#6a7686", "#2a3240", "#ffffff"]),
      A("aura_tesla", "Tesla Coils", "legendary", "earned", "uff", "pulse", "#9fd4ff", "tesla", ["#ffffff", "#9fd4ff", "#6f8cff", "#7a808c", "#c9ced6"]),
      A("aura_meteors", "Meteor Shower", "legendary", "earned", "mvp", "glow", "#ffb02e", "meteors", ["#ffffff", "#ffd76f", "#ff7a1a", "#8a5cff", "#bfe6ff"]),
      A("aura_hellgate", "Hellgate Runes", "legendary", "earned", "hof", "flicker", "#ff3b1a", "hellgate", ["#ff3b1a", "#ffb02e", "#6a0a0a", "#ffe0a0", "#1a0505"]),
      A("aura_phoenix", "Phoenix Rebirth", "mythic", "earned", "interstellar", "flicker", "#ff9a3a", "phoenix", ["#fff3a0", "#ffb02e", "#ff5a1a", "#c81e1e", "#ffe7c0"]),
      A("aura_dragon", "Dragon Spirit", "mythic", "earned", "legacy300", "glow", "#3fdc8a", "dragon", ["#3fdc8a", "#c8ffe0", "#ffd76f", "#ff3b3b", "#0f5a3a"]),
      A("aura_blackhole", "Event Horizon", "mythic", "earned", "gen5", "void", "#7a2aff", "blackhole", ["#050208", "#ffffff", "#ffb02e", "#ff5a1a", "#7a2aff"])
    ];
  }
  // the member looks (v156 C's getters, as `resourceV157A` gives v157 A's wings)
  var MEMBER_V159D = ["crown_neon", "crown_skull", "crown_dragon", "crown_storm", "crown_imperial", "crown_orbit",
    "aura_feathers", "aura_wolves", "aura_chrome", "aura_tesla", "aura_meteors", "aura_hellgate", "aura_phoenix", "aura_dragon", "aura_blackhole"];
  (function resourceV159D() {
    MEMBER_V159D.forEach(function (id) {
      var it = BY[id]; if (!it || it._v159D) return;
      var src0 = it.source, ach0 = it.ach;   // kept here, not in _src0: v156 C's grandfathering never hands a device a look it never had
      RULES_V156C[id] = "member"; it._v159D = 1; delete it.source; delete it.ach;
      Object.defineProperty(it, "source", { enumerable: true, configurable: true, get: function () { return cosOnV156C() ? "member" : src0; } });
      Object.defineProperty(it, "ach", { enumerable: true, configurable: true, get: function () { return cosOnV156C() ? undefined : ach0; } });
    });
  })();

  /* ================= FLUTTER ================= */
  var FAM_V159D = {
    angel: "feather", seraph: "feather", flame: "feather", pixel: "feather", raven: "feather", paper: "feather", gilded: "feather", phoenix: "feather",
    bat: "membrane", demon: "membrane", dragon: "membrane", monarch: "membrane",
    mech: "mech", jet: "mech", clockwork: "mech", cyber: "mech",
    skeleton: "bone",
    crystal: "ether", lightning: "ether", shadow: "ether", galaxy: "ether", prism: "ether", thorn: "ether", football: "ether", hellfire: "ether", cathedral: "ether"
  };
  /* tr/trMs a tremble · br/brMs the breathing sway · jit/jitMs a stepped twitch of the whole wing · lag/lagK how far the
   * outer half trails the arm · rip a ripple along the feathers · shv a membrane's shiver · rat a skeleton's rattle ·
   * over the settle's overshoot */
  var FEEL_V159D = {
    feather: { tr: 0.03, trMs: 210, br: 0.06, brMs: 2600, jit: 0, lag: 95, lagK: 0.55, rip: 0.05, ripMs: 330, shv: 0, rat: 0, over: 1 },
    membrane: { tr: 0.022, trMs: 150, br: 0.05, brMs: 2300, jit: 0, lag: 120, lagK: 0.6, rip: 0, shv: 0.045, shvMs: 62, rat: 0, over: 1.15 },
    mech: { tr: 0, trMs: 1, br: 0.035, brMs: 1900, jit: 0.03, jitMs: 55, lag: 0, lagK: 0, rip: 0, shv: 0, rat: 0, over: 0.4 },
    bone: { tr: 0.012, trMs: 260, br: 0.05, brMs: 2800, jit: 0, lag: 70, lagK: 0.45, rip: 0, shv: 0, rat: 0.05, ratMs: 85, over: 0.9 },
    ether: { tr: 0.02, trMs: 300, br: 0.075, brMs: 3200, jit: 0, lag: 150, lagK: 0.5, rip: 0.03, ripMs: 520, shv: 0, rat: 0, over: 0.8 }
  };
  function famV159D(kind) { return FAM_V159D[kind] || "feather"; }
  function stepV159D(t, ms, seed) { return ihV153G(((Math.floor(t / ms) * 2654435761) ^ (seed * 97531)) >>> 0) - 0.5; }   // one value per step
  function idleV159D(t, F) {
    var v = F.br * Math.sin(t / F.brMs * TAU_V159D + 0.7);
    if (F.tr) v += F.tr * Math.sin(t / F.trMs * TAU_V159D);
    if (F.jit) v += F.jit * 2 * stepV159D(t, F.jitMs, 3);
    return v;
  }
  // the strong flap by phase: the raise (anticipation) at the end of a period, the beats at its start, the settle after
  function strongV159D(t, F) {
    var P = Math.max(1200, TUv("wingFlapPeriodV157A", 3400)), D = Math.min(P * 0.5, Math.max(200, TUv("wingFlapMsV157A", 760))), beats = Math.max(1, TUv("wingFlapBeatsV157A", 2)), amp = TUv("wingFlapAmpV157A", 0.42);
    var A = Math.max(60, Math.min(P * 0.2, TUv("wingRaiseMsV159D", 300))), S = Math.max(100, Math.min(P - D - A - 100, TUv("wingSettleMsV159D", 560)));
    var ph = ((t % P) + P) % P, r1 = amp * 0.68;
    if (ph < D) { var u = ph / D; return { r: amp * Math.cos(TAU_V159D * beats * u) * (1 - 0.32 * u), w: 1, beat: true, amp: amp, ph: "beat" }; }
    if (ph < D + S) { var v = (ph - D) / S; return { r: r1 * (1 - v) * Math.cos(Math.PI * (1 + F.over) * v), w: 1 - v, beat: false, amp: amp, ph: "settle" }; }
    if (ph >= P - A) { var a = (ph - (P - A)) / A, e = a * a * (3 - 2 * a); return { r: amp * e, w: e, beat: false, amp: amp, ph: "raise" }; }
    return { r: 0, w: 0, beat: false, amp: amp, ph: "flutter" };
  }
  function rawV159D(t, F) { var s = strongV159D(t, F); return s.r + idleV159D(t, F) * (1 - 0.65 * s.w); }
  var STILL_V159D = { on: true, f: 0, rot: 0, sy: 1, sx: 1, tip: 0, beat: false, flutter: false, reduced: true };
  function wingPoseV159D(t, kind) {
    if (!flutterOnV159D()) return flapPoseV157A(t);
    if (reducedV157A()) return STILL_V159D;
    var fam = famV159D(kind), F = FEEL_V159D[fam], s = strongV159D(t, F), rot = s.r + idleV159D(t, F) * (1 - 0.65 * s.w);
    var tip = F.lagK ? F.lagK * (rawV159D(t - F.lag, F) - rot) : 0;
    if (F.rip) tip += F.rip * Math.sin(t / F.ripMs * TAU_V159D + 1.3);
    if (F.shv) tip += F.shv * Math.sin(t / F.shvMs * TAU_V159D) * (0.6 + 0.4 * Math.sin(t / 900));
    if (F.rat) tip += F.rat * 2 * stepV159D(t, F.ratMs, 11);
    var tmax = TUv("wingTipMaxV159D", 0.17); tip = Math.max(-tmax, Math.min(tmax, tip));
    var f = s.beat ? s.r / s.amp : 0, sy = (1 - TUv("wingFlapSquashV157A", 0.16) * Math.max(0, -f)) * (1 + 0.025 * Math.sin(t / F.brMs * TAU_V159D + 0.7));
    if (F.shv) sy *= 1 + 0.012 * Math.sin(t / F.shvMs * Math.PI);
    return { on: true, f: f, rot: rot, sy: sy, sx: 1 + TUv("wingTipStretchV159D", 0.4) * tip, tip: tip, beat: s.beat, strong: s.w > 0 || s.beat, phase: s.ph, flutter: true, fam: fam, t: t };
  }
  // the wing's frame for a kind (the animated kinds' flicker), as the field picks it
  function wingFrameV159D(kind, t) { return kind === "flame" ? ((t / 110) | 0) % 2 : wingFrameV157A(kind, t); }
  /* one wing on a 2D canvas (already translated to the shoulder, rotated and squashed): the inner half, then the outer
   * half hinged at the wing's middle and turned by the pose's `tip` (it trails the arm) */
  function wingDrawV159D(ctx, wa, k, tip) {
    if (!tip || Math.abs(tip) < 0.004) { ctx.drawImage(wa.cv, -wa.ax * k, -wa.ay * k, wa.w * k, wa.h * k); return; }
    var sp = Math.max(wa.ax + 2, Math.min(wa.w - 2, Math.round(wa.w * TUv("wingJointV159D", 0.5))));
    ctx.drawImage(wa.cv, 0, 0, sp, wa.h, -wa.ax * k, -wa.ay * k, sp * k, wa.h * k);
    ctx.save(); ctx.translate((sp - wa.ax) * k, 0); ctx.rotate(-tip);
    ctx.drawImage(wa.cv, sp - 2, 0, wa.w - sp + 2, wa.h, -2 * k, -wa.ay * k, (wa.w - sp + 2) * k, wa.h * k);   // two columns of overlap hide the hinge
    ctx.restore();
  }
  /* v157 A's ticker, when the flutter is on: every registered canvas repaints at TU v159DwingFps, off-screen ones wait */
  function flapTickV159D() {
    try {
      var now = performance.now(), gap = 1000 / Math.max(5, TUv("v159DwingFps", 30)) - 2;
      if (!document.hidden && now - (G_V159D.lastTick == null ? -1e9 : G_V159D.lastTick) >= gap) {
        G_V159D.lastTick = now; G157.ticks++; G_V159D.ticks++;
        var vh = window.innerHeight || 900;
        for (var i = FLAPS_V157A.length - 1; i >= 0; i--) {
          var r = FLAPS_V157A[i];
          if (!r.cv.isConnected) { if ((r.miss = (r.miss | 0) + 1) > 120) FLAPS_V157A.splice(i, 1); continue; }
          r.miss = 0;
          var pose = wingPoseV159D(now, r.kind), mv = !!(pose.flutter || pose.beat);
          var key = mv ? pose.rot.toFixed(3) + "|" + pose.sy.toFixed(3) + "|" + (pose.tip || 0).toFixed(3) + "|" + wingFrameV159D(r.kind, now) : "rest";
          if (r.last === key) continue;
          if (mv && r.last != null) { var rc = r.cv.getBoundingClientRect(); if (rc.width === 0 || rc.bottom < 0 || rc.top > vh) { G_V159D.skipped++; continue; } }
          r.last = key;
          try { r.paint(mv ? Object.assign({}, pose, { t: now }) : null); G157.paints++; G_V159D.paints++; } catch (e) { errV157A(e); }
        }
      }
    } catch (e) { errV159D(e); }
    if (FLAPS_V157A.length && window.requestAnimationFrame) rafV157A = requestAnimationFrame(flapTickV157A);
  }

  /* ================= CROWNS ================= */
  function crownPalV159D(a, b, e) {
    var P = crownPalV157A(a, b, e);
    var X = {
      R: [214, 32, 52], r: [122, 12, 26], F: [255, 246, 176], f: [255, 176, 46], g: [236, 76, 26], h: [150, 26, 10],
      G: [128, 214, 96], n: [52, 142, 62], N: [22, 74, 32], S: [90, 156, 255], s: [30, 72, 172], O: [70, 212, 132], o: [22, 112, 62],
      Q: mix(e, [255, 255, 255], 0.3), q: e, A: light(b, 0.72), C: [132, 140, 168], c: [84, 90, 116], k: [44, 48, 66], Y: [255, 240, 120],
      B: [244, 236, 214], b: [200, 188, 160], z: [124, 110, 86], x: [52, 44, 34], U: light(b, 0.35), u: dark(b, 0.4), I: light(a, 0.8), i: mix(a, b, 0.5)
    };
    for (var k in X) P[k] = X[k];
    return P;
  }
  /* a crown's drawing kit: `p` puts a pixel AND its mirror (the crowns are symmetric), `q` one pixel (the animated bits),
   * `map` draws the left half (+ centre column) of rows mirrored; a 'J' in a map is a jewel (it twinkles) */
  function kitV159D(W, H, pal) {
    var R = new Raster(W, H), jw = [];
    var col = function (ch) { return typeof ch === "string" ? pal[ch] : ch; };
    var K = {
      R: R, W: W, H: H, c: (W - 1) / 2, jw: jw, pal: pal,
      p: function (x, y, ch, a) { var cc = col(ch); if (!cc) return; x = Math.round(x); y = Math.round(y); R.put(x, y, cc, a); if (x !== W - 1 - x) R.put(W - 1 - x, y, cc, a); },
      q: function (x, y, ch, a) { var cc = col(ch); if (cc) R.put(x, y, cc, a); },
      map: function (rows, y0, x0) { rows.forEach(function (row, y) { for (var x = 0; x < row.length; x++) { var ch = row.charAt(x); if (ch === "." || ch === " ") continue; K.p((x0 || 0) + x, (y0 || 0) + y, ch); if (ch === "J") K.jewel((x0 || 0) + x, (y0 || 0) + y); } }); },
      line: function (x0, y0, x1, y1, ch, a) { var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0; for (var i = 0; i <= n; i++) { var t = i / Math.max(1, n); K.p(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, ch, a); } },
      jewel: function (x, y) { jw.push([x, y]); if (x !== W - 1 - x) jw.push([W - 1 - x, y]); },
      has: function (x, y) { return R.has(x, y); }
    };
    return K;
  }
  // a flame tongue (base at y0, `h` tall, `hw` half-wide), `lean` bends its tip; put = K.p (symmetric) or K.q
  function tongueV159D(put, cx, y0, h, hw, lean) {
    for (var r = 0; r <= h; r++) { var rel = r / Math.max(1, h), w = (1 - rel) * hw, x = cx + lean * rel * rel * 2, y = y0 - r;
      for (var q = Math.round(x - w); q <= Math.round(x + w); q++) { var d = Math.abs(q - x) / Math.max(0.6, w); put(q, y, rel > 0.82 ? "h" : d < 0.4 && rel < 0.55 ? "F" : d < 0.8 && rel < 0.8 ? "f" : "g"); } }
  }
  /* each: { W, H, gl (the glint's pixel), ol (the outline: "e" dark or a colour), draw(K, ph) } — ph -1 is the still
   * frame (symmetric), 0..N-1 an animation frame */
  var CROWNS_V159D = {
    // CROWN OF THORNS: two braided briar strands, thorns out of them, a drop of blood
    thorns: { W: 17, H: 12, gl: [8, 0], draw: function (K) {
      var y = function (x, s) { return 7 + s * 1.5 * Math.sin(x * 0.95 + 0.35); };
      var strand = function (s, front) { for (var x = 0; x <= 8; x++) { var up = Math.sin(x * 0.95 + 0.35) * s > 0; if (front !== up) continue; var yy = Math.round(y(x, s)); K.p(x, yy - 1, front ? "L" : "M"); K.p(x, yy, front ? "M" : "D"); K.p(x, yy + 1, front ? "D" : "K"); } };
      strand(1, false); strand(-1, false); strand(1, true); strand(-1, true);
      [[1, -1, 3, -0.5], [2, 1, 2, -0.4], [4, -1, 4, -0.35], [5, 1, 2, 0.2], [6, -1, 3, 0.25], [8, -1, 6, 0]].forEach(function (T) {
        var x0 = T[0], sgn = T[1], L = T[2], yy = sgn < 0 ? Math.min(Math.round(y(x0, 1)), Math.round(y(x0, -1))) - 2 : Math.max(Math.round(y(x0, 1)), Math.round(y(x0, -1))) + 2;
        for (var k = 0; k < L; k++) K.p(x0 + T[3] * k, yy + sgn * k, k === L - 1 ? "H" : k === 0 ? "D" : "M");
      });
      K.p(2, 11, "j"); K.p(2, 10, "J"); K.p(2, 9, "w"); K.jewel(2, 10);
      K.p(4, 9, "G"); K.p(3, 9, "n"); K.p(7, 4, "G"); K.p(6, 4, "n");
    } },
    // 8-BIT: 2x2 blocks, three points, two gems and a white pixel glint (W 16: no centre column)
    pixel: { W: 16, H: 12, gl: [7, 0], draw: function (K) {
      var rows = ["H..w", "LH.J", "MLLL", "MJMM", "MMMM", "DDDD"];
      rows.forEach(function (row, by) { for (var bx = 0; bx < 4; bx++) { var ch = row.charAt(bx); if (ch === ".") continue;
        var jewel = ch === "J" || ch === "w", t = jewel ? ["w", "J", "J", "j"] : [ch, ch, ch, ch];
        K.p(bx * 2, by * 2, t[0]); K.p(bx * 2 + 1, by * 2, t[1]); K.p(bx * 2, by * 2 + 1, t[2]); K.p(bx * 2 + 1, by * 2 + 1, t[3]);
        if (jewel) K.jewel(bx * 2 + 1, by * 2); } });
      K.p(3, 6, "W"); K.p(7, 0, "W");
    } },
    // JESTER: three floppy points — the side ones droop out to bells — a diamond trim band
    jester: { W: 17, H: 14, gl: [8, 1], draw: function (K, ph) {
      var sw = ph < 0 ? 0 : Math.round(Math.sin(ph / 24 * TAU_V159D * 2));   // the bells swing
      // the side lobes (velvet in the second colour): a curl from the band out to the tip at (1, 6)
      for (var s = 0; s <= 12; s++) { var t = s / 12, cx = 7 - 6 * t, cy = 10 - 6 * Math.sin(t * Math.PI * 0.62) + t * t * 1.5, w = 2.6 * (1 - t) + 0.6;
        for (var yy = Math.floor(cy - w); yy <= cy + w; yy++) K.p(cx, yy, yy < cy - w * 0.4 ? "U" : yy > cy + w * 0.4 ? "u" : "V"); }
      // the centre lobe, red, standing up
      for (var y = 2; y <= 10; y++) { var hw = Math.max(0, Math.round((y - 2) * 0.33)); for (var x = 8 - hw; x <= 8; x++) K.p(x, y, x === 8 - hw ? "R" : "r"); }
      K.p(8, 2, "R");
      // the bells: gold, a slit, a glint
      var bell = function (bx, by) { K.p(bx, by, "L"); K.p(bx + 1, by, "M"); K.p(bx, by + 1, "M"); K.p(bx + 1, by + 1, "D"); K.p(bx, by - 1, "H"); K.jewel(bx, by - 1); };
      bell(0, 7 + (ph < 0 ? 0 : sw)); K.p(8, 0, "H"); K.p(8, 1, "M"); K.p(7, 1, "L"); K.jewel(8, 0);
      // the band: gold and red diamonds
      for (var bx2 = 2; bx2 <= 8; bx2++) { K.p(bx2, 11, bx2 % 2 ? "M" : "R"); K.p(bx2, 12, bx2 % 2 ? "R" : "D"); K.p(bx2, 13, "K"); }
    } },
    // VIKING: two ivory horns sweeping out and up off an iron cap, rings round the horns, a nose ridge, rivets
    viking: { W: 17, H: 13, gl: [0, 0], draw: function (K) {
      for (var s = 0; s <= 16; s++) { var t = s / 16, x = 3.2 - 3 * Math.sin(t * Math.PI * 0.55) + t * t * 0.9, y = 8.5 - 8.5 * t, w = 1.6 * (1 - t) + 0.4;
        for (var q = Math.round(x - w); q <= Math.round(x + w); q++) { var ring = s % 4 === 2; K.p(q, y, t > 0.86 ? "D" : ring ? "b" : q <= x - w * 0.3 ? "B" : q >= x + w * 0.4 ? "z" : "b"); } }
      K.p(1, 0, "B");
      // the iron cap: a dome over a riveted band (the jewel ramp holds the iron: w light, J iron, j dark)
      for (var y = 6; y <= 12; y++) for (var x = 3; x <= 8; x++) { var dx = 8 - x, dome = y >= 6 + Math.max(0, dx - 2) * 0.8; if (!dome) continue;
        K.p(x, y, y >= 10 ? (y === 10 ? "L" : y === 12 ? "D" : "M") : dx <= 1 ? "w" : y === Math.ceil(6 + Math.max(0, dx - 2) * 0.8) ? "w" : "i"); }
      K.p(8, 6, "W"); K.line(8, 7, 8, 9, "w");
      [4, 6].forEach(function (x) { K.p(x, 11, "H"); });
      K.p(8, 11, "J"); K.jewel(8, 11);
    } },
    // ICE TIARA: a slim silver arc, icicle spikes (the tall one in the middle), filigree loops, an ice jewel
    tiara: { W: 17, H: 13, gl: [8, 0], draw: function (K) {
      var band = function (x) { return 11 - Math.round(Math.pow((8 - x) / 8, 2) * 3); };
      for (var x = 0; x <= 8; x++) { var by = band(x); K.p(x, by, "L"); K.p(x, by + 1, "D"); }
      [[8, 0, 1.6], [5, 4, 1.1], [2, 6, 0.8]].forEach(function (S) { var sx = S[0], top = S[1], by = band(sx) - 1;
        for (var y = top; y <= by; y++) { var rel = (y - top) / Math.max(1, by - top), hw = Math.round(rel * S[2]); for (var q = sx - hw; q <= sx + hw; q++) K.p(q, y, q < sx ? "I" : q > sx ? "J" : y === top ? "W" : "w"); } });
      // filigree loops between the spikes
      [[6.5, 8.5], [3.5, 9]].forEach(function (L) { for (var a = 0; a < 12; a++) { var an = a / 12 * TAU_V159D; K.p(L[0] + Math.cos(an) * 1.3, L[1] + Math.sin(an) * 1.3, "M"); } });
      K.p(8, 7, "w"); K.p(7, 8, "J"); K.p(8, 8, "J"); K.p(8, 9, "j"); K.jewel(8, 8);
    } },
    // KABUTO CREST: a gilded crescent (kuwagata) rising from a black-lacquer brow, a red sun disc between the horns
    kabuto: { W: 17, H: 13, gl: [1, 0], draw: function (K) {
      for (var s = 0; s <= 18; s++) { var t = s / 18, x = 7.2 - 6 * Math.sin(t * Math.PI / 2) + t * t * 0.6, y = 8.5 - 8.5 * t, w = 1.3 * (1 - t) + 0.45;
        for (var q = Math.round(x - w); q <= Math.round(x + w); q++) K.p(q, y, q < x - w * 0.2 ? "H" : q > x + w * 0.3 ? "D" : "M"); }
      for (var y = 5; y <= 9; y++) for (var x = 6; x <= 8; x++) { var d = Math.hypot(x - 8, y - 7); if (d <= 2.2) K.p(x, y, d > 1.6 ? "r" : y < 7 && x < 8 ? "R" : "J"); }
      K.p(7, 6, "W"); K.jewel(8, 7);
      for (var x2 = 1; x2 <= 8; x2++) { K.p(x2, 10, "L"); K.p(x2, 11, x2 % 3 === 1 ? "M" : "Q"); K.p(x2, 12, "q"); }
    } },
    // LAUREL OF GOLD: a wreath of gold leaves in three tiers meeting at a medallion with an emerald, ribbon tails
    goldleaf: { W: 17, H: 13, gl: [8, 6], draw: function (K) {
      var stem = function (t) { return [1 + 5.6 * t, 10.5 - 8 * t + t * t * 1.8]; };
      for (var i = 0; i <= 12; i++) { var S = stem(i / 12); K.p(S[0], S[1], "D"); }
      [[0.08, 1], [0.24, -1], [0.4, 1], [0.56, -1], [0.72, 1], [0.88, -1]].forEach(function (L) {
        var S = stem(L[0]), dx = L[1] > 0 ? -0.55 : 0.55, dy = -0.84;
        for (var k = 1; k <= 3; k++) { var x = S[0] + dx * k, y = S[1] + dy * k; K.p(x, y, k === 3 ? "H" : "M"); K.p(x + (L[1] > 0 ? 1 : -1), y, k === 1 ? "D" : "L"); }
      });
      for (var y = 7; y <= 11; y++) for (var x = 6; x <= 8; x++) { var d = Math.hypot(x - 8, y - 9); if (d <= 2.4) K.p(x, y, d > 1.7 ? (y < 9 ? "L" : "D") : "J"); }
      K.p(7, 8, "w"); K.p(8, 10, "j"); K.jewel(8, 9);
      K.p(6, 12, "R"); K.p(5, 12, "r"); K.p(7, 12, "R");
    } },
    // ANTLER CROWN: two branching antlers (a beam and three tines) off a band of leaves with a green gem
    antler: { W: 17, H: 14, gl: [1, 0], draw: function (K) {
      var beam = function (t) { return [5 - 4 * t - Math.sin(t * Math.PI) * 0.6, 10 - 9.5 * t]; };
      for (var i = 0; i <= 14; i++) { var t = i / 14, P = beam(t); K.p(P[0], P[1], t > 0.85 ? "B" : "b"); K.p(P[0] + 1, P[1], t > 0.85 ? "b" : "z"); }
      [[0.35, 2.6], [0.6, 2.2], [0.82, 1.6]].forEach(function (T) { var P = beam(T[0]); for (var k = 1; k <= 3; k++) K.p(P[0] + k * 0.75, P[1] - k * (T[1] / 3), k === 3 ? "B" : "b"); });
      for (var x = 2; x <= 8; x++) { K.p(x, 11, x % 2 ? "G" : "n"); K.p(x, 12, x % 2 ? "n" : "N"); K.p(x, 13, "D"); }
      K.p(4, 10, "G"); K.p(7, 10, "G"); K.p(8, 10, "w"); K.p(8, 11, "J"); K.p(8, 12, "j"); K.jewel(8, 11);
    } },
    // PHARAOH'S URAEUS: a rearing cobra on a gold-and-lapis striped band, a sun disc, vulture wings along the band
    pharaoh: { W: 17, H: 14, gl: [8, 0], draw: function (K) {
      K.map([
        ".......rR",
        ".......RR",
        "........M",
        "......LMH",
        "......MJM",
        ".....LMJM",
        "......DMD",
        "LL.....MH",
        "vMLL...DM",
        "LvvMLL.MM",
        "HHHHHHHHH",
        "MvMvMvMvM",
        "MvMvMvMvM",
        "DVDVDVDVD"
      ]);
      K.p(7, 3, "K");
    } },
    // CRYSTAL DIADEM: five faceted amethyst crystals rising from a silver circlet, the tallest in the middle
    diadem: { W: 17, H: 13, gl: [8, 0], draw: function (K) {
      for (var x = 1; x <= 8; x++) { K.p(x, 11, "L"); K.p(x, 12, x % 2 ? "M" : "D"); }
      [[8, 0, 1.6], [5, 4, 1.3], [2, 7, 1.1]].forEach(function (S) { var cx = S[0], top = S[1];
        for (var y = top; y <= 10; y++) { var rel = (y - top) / (10 - top), hw = Math.max(0, Math.round(S[2] * Math.min(1, rel * 2.2))); for (var q = cx - hw; q <= cx + hw; q++) K.p(q, y, y === top ? "W" : q < cx ? "w" : q > cx ? "j" : rel > 0.55 ? "J" : "A"); } });
      K.p(8, 5, "S"); K.p(5, 8, "R"); K.jewel(8, 3); K.jewel(5, 6); K.jewel(2, 9);
    } },
    // NEON HALO-CROWN: a crown drawn in neon tube (a hot core, a glow round it), cyan tips, a ring floating over it
    neon: { W: 17, H: 14, gl: [8, 1], draw: function (K, ph) {
      var hum = ph < 0 ? 1 : 0.72 + 0.28 * Math.abs(Math.sin(ph * 1.7));
      var tube = [[1, 12], [8, 12], [1, 12], [0, 5], [0, 5], [4, 10], [4, 10], [8, 3]];
      for (var i = 0; i < tube.length; i += 2) { var A = tube[i], B = tube[i + 1]; K.line(A[0], A[1], B[0], B[1], "U"); }
      var tubeAt = []; for (var y = 0; y < K.H; y++) for (var x = 0; x <= 8; x++) if (K.has(x, y)) tubeAt.push([x, y]);
      tubeAt.forEach(function (P) { [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { if (!K.has(P[0] + d[0], P[1] + d[1])) K.p(P[0] + d[0], P[1] + d[1], "i", 0.45 * hum); }); });   // the glow: one pixel round the tube
      for (var j = 0; j < tube.length; j += 2) { var A2 = tube[j], B2 = tube[j + 1]; K.line(A2[0], A2[1], B2[0], B2[1], "I", hum); }
      K.line(1, 12, 8, 12, "M", hum);
      [[0, 4], [8, 2]].forEach(function (T) { K.p(T[0], T[1], "w"); K.jewel(T[0], T[1]); });
      K.p(4, 12, "J"); K.p(8, 12, "J");
      for (var a = 0; a < 20; a++) { var an = a / 20 * TAU_V159D, x2 = 8 + Math.cos(an) * 5, y2 = 1 + Math.sin(an) * 1.1; if (x2 <= 8.01) K.p(x2, y2 - 0.4, Math.sin(an) > 0 ? "J" : "j"); }
      K.p(3, 1, "W");
    } },
    // FLAMING SKULL: a bone skull on an iron band, sockets burning, flames licking up behind it and off the band
    skull: { W: 17, H: 14, gl: [6, 5], draw: function (K, ph) {
      var put = ph < 0 ? K.p : K.q, fl = function (i) { return ph < 0 ? 0 : Math.round((ihV153G(i * 131 + ph * 977) - 0.5) * 2); };
      var flames = [[8, 6, 6, 1.9], [4, 9, 4, 1.4], [1, 10, 3, 1.1]];
      if (ph < 0) flames.forEach(function (T) { tongueV159D(K.p, T[0], T[1], T[2], T[3], 0); });
      else flames.forEach(function (T, i) { tongueV159D(put, T[0], T[1], T[2] + fl(i), T[3], (ihV153G(i * 7 + ph * 31) - 0.5) * 1.4); if (T[0] !== 8) tongueV159D(put, 16 - T[0], T[1], T[2] + fl(i + 5), T[3], (ihV153G(i * 11 + ph * 37) - 0.5) * 1.4); });
      K.map([
        ".....BBBB",
        "....BBBBB",
        "....BxxBb",
        "....bxgBb",
        ".....bbbx",
        ".....BzBz"
      ], 5, 0);
      for (var x = 1; x <= 8; x++) { K.p(x, 11, "L"); K.p(x, 12, x % 3 === 2 ? "H" : "M"); K.p(x, 13, "D"); }
      K.jewel(5, 8);
    } },
    // DRAGON CROWN: a horned dragon's head at the front, gold eyes, scaled green band with gold spines
    dragon: { W: 17, H: 14, gl: [3, 0], draw: function (K) {
      K.map([
        "...U.....",
        "...uU....",
        "....uU...",
        ".....uU..",
        ".....nGGG",
        ".....GGGG",
        ".....nRGG",
        "......nGG",
        "......nGn",
        "U.U.U.NKN",
        "UuUuUunnG",
        "nGnGnGnGn",
        "GnGnGnGnG",
        "NNNNNNNNN"
      ]);
      K.jewel(6, 6);
    } },
    // STORM CROWN: a band of storm cloud, lightning bolts for points (they crack and jump), sparks
    storm: { W: 17, H: 14, gl: [8, 0], draw: function (K, ph) {
      var ZIG = [0, 0, 1, 1, 0, -1, -1, 0, 1, 1];
      var bolt = function (put, x0, top, jig) { for (var y = top; y <= 9; y++) { var x = x0 + (jig ? ZIG[(y - top) % ZIG.length] * jig : 0); put(x, y, y === top ? "W" : y === top + 1 ? "A" : "Y"); if (jig && y > top + 1) put(x + jig, y, "J", 0.5); } };
      if (ph < 0) { bolt(K.p, 8, 0, 0); bolt(K.p, 4, 3, -1); bolt(K.p, 1, 6, 1); }
      else { var on = function (i) { return ihV153G(i * 17 + ph * 101) > 0.22; };
        [[8, 0, 0], [4, 3, -1], [1, 6, 1]].forEach(function (B, i) { if (on(i)) bolt(K.q, B[0], B[1], B[2] + (ihV153G(i + ph * 3) > 0.5 ? 1 : 0)); if (B[0] !== 8 && on(i + 3)) bolt(K.q, 16 - B[0], B[1], -B[2]); });
        if (ihV153G(ph * 53) > 0.6) { var sx = 2 + Math.round(ihV153G(ph * 59) * 12); K.q(sx, 5, "W"); K.q(sx + 1, 4, "Y"); } }
      K.map([
        "..CCC..CC",
        ".CCccCCCc",
        "CcccckcCc",
        "ckkkkkkck",
        ".k.k.k.kk"
      ], 9, 0);
      K.jewel(8, 0);
    } },
    // IMPERIAL: two jewelled arches over red velvet, the orb and the cross on top, an ermine brim
    imperial: { W: 17, H: 14, gl: [8, 0], draw: function (K) {
      K.map([
        "........H",
        ".......LM",
        "........M",
        ".......LH",
        "......LMM",
        ".......DD",
        ".......PM",
        ".....PMVv",
        "...PMVVvv",
        ".PMVVVVvV",
        "HHHHHHHHH",
        "MJMSMJMSM",
        "DjDsDjDsD",
        "EEeEEEeEE"
      ]);
      K.p(6, 4, "W");
    } },
    // CROWN OF STARS: a slim gold circlet with three points and a star gem; four stars orbit round it
    orbit: { W: 17, H: 14, gl: [8, 7], draw: function (K, ph) {
      K.map([
        "..M.....L",
        "..M....MH",
        ".LM...LMM",
        "LHHHHHHHH",
        "MMJMMMMMJ",
        "DDDDDDDDD"
      ], 8, 0);
      var star = function (put, x, y, back) { var c = back ? "i" : "A"; put(x, y, back ? "A" : "W"); put(x - 1, y, c, back ? 0.6 : 1); put(x + 1, y, c, back ? 0.6 : 1); put(x, y - 1, c, back ? 0.6 : 1); put(x, y + 1, c, back ? 0.6 : 1); };
      for (var a = 0; a < 28; a++) { var an = a / 28 * TAU_V159D; if (a % 2) continue; var px = 8 + Math.cos(an) * 7.2, py = 6 + Math.sin(an) * 2.2; if (px <= 8.01) K.p(px, py, "i", 0.4); }
      if (ph < 0) { star(K.p, 1, 6, false); star(K.q, 8, 3.8, true); star(K.q, 8, 8.2, false); }
      else for (var s = 0; s < 4; s++) { var an2 = (ph / 24 + s / 4) * TAU_V159D; star(K.q, 8 + Math.cos(an2) * 7.2, 6 + Math.sin(an2) * 2.2, Math.sin(an2) < 0); }
    } }
  };
  function crownKindV159D(k) { return !!(k && Object.prototype.hasOwnProperty.call(CROWNS_V159D, k)); }
  var JW_V159D = {};   // the jewels each kind's frame 0 recorded (they twinkle in turn)
  /* v157 A's crownArtV157A hands a new kind here: frame 0 (and 2, v157 A's glint) the still, symmetric sprite; frames
   * 16+ the animation's (16 + phase) */
  function crownDrawV159D(K0, a, b, e, fr) {
    var D = CROWNS_V159D[K0], pal = crownPalV159D(a, b, e), K = kitV159D(D.W, D.H, pal), ph = fr >= 16 ? fr - 16 : -1;
    D.draw(K, ph);
    K.R.outline(D.ol ? pal[D.ol] || D.ol : dark(e, 0.45), 0.92);
    if (ph < 0) JW_V159D[K0] = K.jw.slice();
    return { R: K.R, gl: D.gl };
  }
  // the jewel pixels of an old (v157 A) crown: the 'J's of its map, mirrored
  var OLDJW_V159D = null;
  function oldJewelsV159D(kind) {
    if (!OLDJW_V159D) { OLDJW_V159D = {}; var maps = crownMapsV157A();
      Object.keys(maps).forEach(function (k) { var m = maps[k], W = m.rows[0].length * 2 - 1, out = [];
        m.rows.forEach(function (row, y) { for (var x = 0; x < row.length; x++) if (row.charAt(x) === "J" || row.charAt(x) === "P") { out.push([x, y]); if (x !== W - 1 - x) out.push([W - 1 - x, y]); } });
        OLDJW_V159D[k] = out; }); }
    return OLDJW_V159D[kind] || [];
  }
  var GLINT_V159D = { crown: [6, 1], king: [7, 0], circlet: [6, 2], star: [6, 0], horns: [0, 0], halo: [4, 4], laurel: [1, 1], flame: [6, 0] };
  function crownFramesV159D() { return Math.max(8, Math.min(48, TUv("crownFramesV159D", 24) | 0)); }
  function crownPhaseV159D(t) { var N = crownFramesV159D(); return ((Math.floor(t / Math.max(40, TUv("crownFrameMsV159D", 110))) % N) + N) % N; }
  /* one animation frame of any crown: its base (a new kind's own motion; the flame's flicker) under a light sweep across
   * the metal, one jewel twinkling in turn, and v157 A's four-point glint once a cycle */
  function crownFrameArtV159D(cr, ph) {
    cr = cr || { kind: "crown", col: ["#f0bb45", "#c8102e", "#6b4a0e"] };
    var key = "c159|" + cr.kind + "|" + (cr.col || []).join(",") + "|" + ph;
    if (ART_V153G[key]) return ART_V153G[key];
    if (crownKindV159D(cr.kind) && !JW_V159D[cr.kind]) crownArtV157A(cr, 0);
    var base = crownKindV159D(cr.kind) ? crownArtV157A(cr, 16 + ph) : crownArtV157A(cr, cr.kind === "flame" ? ph & 1 : 0);
    if (!base) return crownArtV153G(cr, 0);
    var cv = document.createElement("canvas"); cv.width = base.w; cv.height = base.h;
    try {
      var x = cv.getContext("2d"); x.drawImage(base.cv, 0, 0);
      var im = x.getImageData(0, 0, cv.width, cv.height), d = im.data, W = cv.width, H = cv.height, N = crownFramesV159D();
      var lit = function (px, py, t) { if (px < 0 || py < 0 || px >= W || py >= H) return; var i = (py * W + px) * 4; if (d[i + 3] < 120) return; d[i] += (255 - d[i]) * t; d[i + 1] += (255 - d[i + 1]) * t; d[i + 2] += (255 - d[i + 2]) * t; };
      var dot = function (px, py, a) { if (px < 0 || py < 0 || px >= W || py >= H) return; var i = (py * W + px) * 4; d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = Math.max(d[i + 3], Math.round(255 * a)); };
      // the sweep: a diagonal band of light crosses the crown in the first third of the cycle
      var SW = Math.max(3, Math.round(N / 3));
      if (ph < SW) { var pos = -3 + (ph / (SW - 1)) * (W + H * 0.6 + 6); for (var py = 0; py < H; py++) for (var px = 0; px < W; px++) { var dd = Math.abs(px + py * 0.6 - pos); if (dd < 1.6) lit(px, py, dd < 0.8 ? 0.62 : 0.3); } }
      // the jewels, one at a time
      var jw = crownKindV159D(cr.kind) ? (JW_V159D[cr.kind] || []) : oldJewelsV159D(cr.kind);
      if (jw.length) { var j = jw[Math.floor(ph / 2) % jw.length], on = ph % 2 === 0; if (j && on) { var jx = j[0] + 1, jy = j[1] + 1; dot(jx, jy, 1); lit(jx - 1, jy, 0.5); lit(jx + 1, jy, 0.5); lit(jx, jy - 1, 0.5); lit(jx, jy + 1, 0.5); } }
      // v157 A's glint, a four-point star over the top, in the middle of the cycle
      var gp = Math.floor(N / 2), gl = crownKindV159D(cr.kind) ? CROWNS_V159D[cr.kind].gl : GLINT_V159D[cr.kind];
      if (gl && (ph === gp || ph === gp + 1)) { var gx = gl[0] + 1, gy = gl[1] + 1, s = ph === gp ? 1 : 0.6; dot(gx, gy, s); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) { dot(gx + o[0], gy + o[1], 0.8 * s); }); if (ph === gp) [[2, 0], [-2, 0], [0, -2]].forEach(function (o) { dot(gx + o[0], gy + o[1], 0.4); }); }
      x.putImageData(im, 0, 0);
    } catch (err) { errV159D(err); }
    G_V159D.crownArt++;
    return (ART_V153G[key] = { key: key, cv: cv, ax: base.ax, ay: base.ay, w: base.w, h: base.h });
  }
  // the crown for a moment of the clock (still when reduced motion or the switch is off)
  function crownAnimV159D(cr, t) {
    if (t == null || !crownAnimOnV159D() || reducedV157A()) return crownArtV153G(cr, 0);
    return crownFrameArtV159D(cr, crownPhaseV159D(t));
  }
  // the gentle bob (in sprite pixels), on the breathing of the wings
  function crownBobV159D(t) { if (t == null || !crownAnimOnV159D() || reducedV157A()) return 0; return Math.sin(t / Math.max(300, TUv("crownBobMsV159D", 1500)) * TAU_V159D) * TUv("crownBobPxV159D", 0.6); }
  /* the card's and the Locker's crown: on v157 B's one rAF loop (its fps, its off-screen skip, its still frame under
   * reduced motion) — once per canvas; a repaint just swaps the drawing */
  function crownRegV159D(cv, draw, where) {
    try {
      if (!crownAnimOnV159D()) return false;
      cv._crDrawV159D = draw;
      if (cv._crRegV159D) return true;
      var kind = where === "card" ? "crown" : "crownpv", live = 0;
      if (kind === "crown") { ANIM_V157B.list.forEach(function (e) { if (e.kind === "crown" && e.cv.isConnected) live++; }); if (live >= TUv("v159DcrownMax", 8)) return false; }   // a board full of cards: the first few animate, the rest stay still
      cv._crRegV159D = where || "crown"; G_V159D.crownRegs++;
      return animateV157B(cv, function (t) { if (cv._crDrawV159D) cv._crDrawV159D(t >= STILL_T_V157B ? null : t); }, kind);
    } catch (e) { errV159D(e); return false; }
  }

  /* ================= AURAS ================= */
  function afxV159D(fx) { return fx && auraOnV159D() && Object.prototype.hasOwnProperty.call(AFX_V159D, fx) ? AFX_V159D[fx] : null; }
  var AFX_V159D = {
    dragon: { add: 1, draw: function (P, o) {   // a jade dragon spirit coiling up round him, head first
      var u = o.u, t = o.t, N = Math.max(10, o.n(24)), rot = t / 2600 * TAU_V159D;
      if (o.L === 0) P.ell(o.cx, o.fy, 13 * u, 3.2 * u, o.c[4], 0.5);
      for (var i = N - 1; i >= 0; i--) {
        var s = i / N, an = rot + s * TAU_V159D * 1.5, sn = Math.sin(an); if ((sn > 0) !== (o.L === 1)) continue;
        var x = o.cx + Math.cos(an) * (13 - s * 3) * u, y = o.top - 6 * u + s * (o.h + 4 * u) + sn * 3.5 * u + Math.sin(t / 300 + i * 0.6) * 0.8 * u, r = (2.6 - s * 1.5) * u;
        P.circ(x, y, r * 1.5, o.c[0], 0.22); P.circ(x, y, r, o.c[0], 0.9); P.circ(x - r * 0.3, y - r * 0.35, r * 0.45, o.c[1], 0.85);
        if (i % 3 === 1) P.tri(x - r * 0.6, y - r * 0.6, x + r * 0.6, y - r * 0.6, x, y - r * 2.1, o.c[2], 0.9);
        if (i === 0) { P.circ(x, y, r * 1.35, o.c[0], 1); P.seg(x - r, y - r, x - r * 1.8, y - r * 2.6, 0.6 * u, o.c[2], 1); P.seg(x + r, y - r, x + r * 1.8, y - r * 2.6, 0.6 * u, o.c[2], 1);
          P.rect(x - r * 0.7, y - r * 0.4, 0.8 * u, 0.8 * u, o.c[3], 1); P.rect(x + r * 0.2, y - r * 0.4, 0.8 * u, 0.8 * u, o.c[3], 1);
          P.seg(x, y + r * 0.5, x - 4 * u, y + r + Math.sin(t / 200) * 2 * u, 0.4 * u, o.c[1], 0.8); P.seg(x, y + r * 0.5, x + 4 * u, y + r + Math.cos(t / 200) * 2 * u, 0.4 * u, o.c[1], 0.8); }
      }
    } },
    phoenix: { add: 1, draw: function (P, o) {   // flame wings flaring behind him; every few seconds he burns and is reborn in a burst
      var u = o.u, t = o.t, cyc = 3200, p = ((t % cyc) + cyc) % cyc / cyc, burst = p < 0.25 ? p / 0.25 : 0, sy = o.top + 9 * u;
      if (o.L === 0) {
        var fl = 0.12 * Math.sin(t / 420);
        for (var sd = -1; sd <= 1; sd += 2) for (var k = 0; k < 7; k++) {
          var an = -Math.PI / 2 + sd * (0.35 + k * 0.2 + fl), len = (15 + k * 1.6 + 2 * Math.sin(t / 150 + k)) * u * (1 + burst * 0.4), bx = o.cx + sd * 2.5 * u, w = 0.13;
          P.tri(bx, sy, bx + Math.cos(an - w) * len * 0.6, sy + Math.sin(an - w) * len * 0.6, bx + Math.cos(an) * len, sy + Math.sin(an) * len, o.c[k < 2 ? 0 : k < 4 ? 1 : k < 6 ? 2 : 3], 0.55);
        }
        P.ell(o.cx, o.fy, 12 * u, 3 * u, o.c[2], 0.45 + 0.2 * Math.sin(t / 90));
        if (burst > 0) { P.ellS(o.cx, o.cy, (4 + burst * 22) * u, (5 + burst * 26) * u, 1.6 * u, o.c[0], 1 - burst); P.circ(o.cx, o.cy, 10 * u * (1 - burst), o.c[4], 0.5 * (1 - burst)); }
      }
      var N = o.L ? o.n(5) : o.n(12);
      for (var i = 0; i < N; i++) { var j = i + o.L * 30, q = frV157B(t / (1000 + o.r(j) * 600) + o.r(j + 1)), x = o.cx + (o.r(j + 2) - 0.5) * 24 * u + Math.sin(t / 160 + j) * 1.4 * u, y = o.fy - q * 38 * u, s = (1.2 - q * 0.6) * u;
        P.tri(x - s, y, x + s, y, x, y - s * 3, o.c[q < 0.3 ? 0 : q < 0.6 ? 1 : 2], 1 - q); }
    } },
    blackhole: { add: 0, draw: function (P, o) {   // an event horizon behind him, a turning accretion disk round his waist, lensing
      var u = o.u, t = o.t, cy = o.cy + 1 * u, RX = 20 * u, RY = 5.5 * u;
      if (o.L === 0) {
        P.circ(o.cx, o.cy - 8 * u, 13 * u, o.c[4], 0.25); P.circ(o.cx, o.cy - 8 * u, 10 * u, o.c[0], 0.95);
        P.ring(o.cx, o.cy - 8 * u, 10.6 * u, 0.9 * u, o.c[2], 0.7 + 0.3 * Math.sin(t / 180)); P.ring(o.cx, o.cy - 8 * u, 12 * u, 0.5 * u, o.c[1], 0.45);
      }
      var N = o.n(36);
      for (var i = 0; i < N; i++) {
        var rr = 0.35 + 0.65 * o.r(i), sp = 1 / Math.pow(rr, 1.5), an = t / 2200 * TAU_V159D * sp + o.r(i + 50) * TAU_V159D, sn = Math.sin(an);
        if ((sn > 0) !== (o.L === 1)) continue;
        var x = o.cx + Math.cos(an) * RX * rr, y = cy + sn * RY * rr, s = (1.4 - rr * 0.6) * u;
        P.rect(x - s / 2, y - s / 2, s * 1.6, s, rr < 0.5 ? o.c[1] : rr < 0.75 ? o.c[2] : o.c[3], 0.95);
      }
      if (o.L === 0) P.ellS(o.cx, cy, RX * 0.35, RY * 0.35, 0.7 * u, o.c[1], 0.8);
    } },
    tesla: { add: 1, draw: function (P, o) {   // two coils at his sides throwing arcs at each other through him
      var u = o.u, t = o.t, fl = Math.floor(t / 60), i;
      if (o.L === 0) for (var sd = -1; sd <= 1; sd += 2) { var x = o.cx + sd * 14 * u;
        P.rect(x - 1.5 * u, o.fy - 16 * u, 3 * u, 16 * u, o.c[3], 1);
        for (var k = 0; k < 6; k++) P.ellS(x, o.fy - 3 * u - k * 2.2 * u, 2.4 * u, 0.8 * u, 0.6 * u, o.c[4], 1);
        P.ell(x, o.fy - 17.5 * u, 3.4 * u, 1.6 * u, o.c[4], 1); P.ell(x, o.fy - 18 * u, 2.2 * u, 0.8 * u, o.c[0], 0.8);
        P.circ(x, o.fy - 18 * u, 4 * u, o.c[1], 0.25 + 0.2 * Math.sin(t / 70 + sd)); }
      var arcs = o.L ? 1 : 2;
      for (var a = 0; a < arcs; a++) {
        if (o.r(fl * 5 + a) < 0.25) continue;
        var x0 = o.cx - 14 * u, x1 = o.cx + 14 * u, y0 = o.fy - 18 * u, px = x0, py = y0, M = 7;
        for (i = 1; i <= M; i++) { var nx = x0 + (x1 - x0) * i / M, ny = y0 + (i < M ? (o.r(fl * 13 + i * 3 + a * 50) - 0.5) * 10 * u + Math.sin(i / M * Math.PI) * (a ? 6 : -3) * u : 0);
          P.seg(px, py, nx, ny, 2.2 * u, o.c[2], 0.35); P.seg(px, py, nx, ny, 0.7 * u, o.c[0], 1); px = nx; py = ny; }
      }
      for (i = 0; i < o.n(o.L ? 4 : 6); i++) { var q = frV157B(t / 500 + o.r(i + 70)), sx = o.cx + (o.r(i + 80 + Math.floor(t / 500 + o.r(i + 70)) * 7) - 0.5) * 30 * u, sy2 = o.fy - 18 * u + q * 18 * u; P.rect(sx, sy2, 0.8 * u, 0.8 * u, o.c[1], 1 - q); }
    } },
    blossom: { add: 0, draw: function (P, o) {   // a whirlwind of petals: a tornado of them, wider the higher, gusts
      var u = o.u, t = o.t, N = o.n(26);
      for (var i = 0; i < N; i++) {
        var h = frV157B(t / (1900 + o.r(i) * 700) + o.r(i + 1)), an = t / 700 * TAU_V159D * (1.2 - h * 0.5) + i * 2.4, sn = Math.sin(an); if ((sn > 0) !== (o.L === 1)) continue;
        var rad = (5 + h * 13) * u, x = o.cx + Math.cos(an) * rad, y = o.fy - h * (o.h + 10 * u) + sn * 2 * u, spn = Math.cos(t / 120 + i * 1.3), a = 0.95 * Math.min(1, (1 - h) * 5, h * 8), s = (1 + o.r(i + 2) * 0.6) * u;
        P.tri(x - s * spn, y - s * 0.5, x + s * spn, y + s * 0.5, x + s * 0.4, y - s, o.c[i % 2], a); P.rect(x - 0.3 * u, y - 0.3 * u, 0.6 * u, 0.6 * u, o.c[2], a * 0.8);
      }
      if (o.L === 0) { for (var g = 0; g < 3; g++) { var gp = frV157B(t / 900 + g / 3), gy = o.fy - (0.2 + g * 0.3) * o.h; P.seg(o.cx - 18 * u + gp * 30 * u, gy, o.cx - 12 * u + gp * 30 * u, gy - 1.5 * u, 0.5 * u, o.c[0], 0.5 * Math.sin(gp * Math.PI)); }
        P.ell(o.cx, o.fy, 11 * u, 2.6 * u, o.c[3], 0.35); }
    } },
    sandstorm: { add: 0, draw: function (P, o) {   // dust streaming sideways past him in bands, clouds rolling, grit
      var u = o.u, t = o.t, i;
      if (o.L === 0) for (i = 0; i < o.n(7); i++) { var p = frV157B(t / 2600 + o.r(i)), x = o.cx - 22 * u + p * 44 * u, y = o.fy - o.r(i + 5) * o.h * 0.9;
        P.circ(x, y, (4 + o.r(i + 9) * 4) * u, o.c[i % 2 ? 1 : 2], 0.28 * Math.sin(p * Math.PI)); }
      var N = o.L ? o.n(7) : o.n(16);
      for (i = 0; i < N; i++) { var j = i + o.L * 40, q = frV157B(t / (700 + o.r(j) * 500) + o.r(j + 1)), yy = o.fy - o.r(j + 2) * (o.h + 6 * u), xx = o.cx - 20 * u + q * 40 * u + Math.sin(t / 200 + j) * u, L = (3 + o.r(j + 3) * 5) * u;
        P.seg(xx, yy, xx + L, yy - 0.4 * u, 0.6 * u, o.c[j % 3 === 0 ? 3 : 0], 0.75 * Math.sin(q * Math.PI)); if (j % 2) P.rect(xx + L + u, yy, 0.7 * u, 0.7 * u, o.c[2], 0.9 * Math.sin(q * Math.PI)); }
      if (o.L === 0) P.ell(o.cx, o.fy, 13 * u, 2.8 * u, o.c[1], 0.4);
    } },
    abyss: { add: 1, draw: function (P, o) {   // the deep: glowing jellyfish drifting up past him, plankton, bubbles
      var u = o.u, t = o.t, i;
      if (o.L === 0) { P.ell(o.cx, o.cy, 18 * u, 26 * u, o.c[0], 0.35); for (i = 0; i < o.n(12); i++) { var tw = 0.5 + 0.5 * Math.sin(t / 260 + i * 2.3); P.rect(o.cx + (o.r(i) - 0.5) * 32 * u, o.top - 8 * u + o.r(i + 20) * (o.h + 12 * u), 0.8 * u, 0.8 * u, o.c[i % 2 ? 1 : 3], tw); } }
      var J = o.L ? 1 : 3;
      for (i = 0; i < J; i++) { var j = i + o.L * 3, p = frV157B(t / (5200 + o.r(j) * 1600) + o.r(j + 7)), x = o.cx + (o.r(j + 3) - 0.5) * 28 * u + Math.sin(t / 900 + j) * 2 * u, y = o.fy + 6 * u - p * (o.h + 20 * u), pul = 1 + 0.18 * Math.sin(t / 240 + j), col = o.c[j % 2 ? 2 : 1], al = Math.min(1, Math.sin(p * Math.PI) * 2);
        P.circ(x, y, 4.5 * u * pul, col, 0.2 * al); P.ell(x, y, 2.8 * u * pul, 1.9 * u / pul, col, 0.75 * al); P.ell(x, y - 0.5 * u, 1.4 * u, 0.8 * u, o.c[4], 0.6 * al);
        for (var k = -1; k <= 1; k++) { var tx = x + k * 1.4 * u; P.seg(tx, y + 1.2 * u, tx + Math.sin(t / 200 + k + j) * 1.3 * u, y + 5.5 * u, 0.5 * u, col, 0.7 * al); } }
      for (i = 0; i < o.n(o.L ? 2 : 4); i++) { var b = frV157B(t / 1800 + o.r(i + 40)); P.ring(o.cx + (o.r(i + 41) - 0.5) * 22 * u + Math.sin(t / 300 + i) * u, o.fy - b * o.h * 1.1, (0.6 + b * 0.8) * u, 0.4 * u, o.c[3], 0.8 * (1 - b)); }
    } },
    glitch: { add: 1, draw: function (P, o) {   // his signal breaking up: RGB-split slices, a scanline, dead pixels (a stepped clock)
      var u = o.u, t = o.t, st = Math.floor(t / 90), i;
      if (o.L === 0) { var sl = frV157B(t / 1400); P.rect(o.cx - 16 * u, o.top - 8 * u + sl * (o.h + 14 * u), 32 * u, 0.8 * u, o.c[3], 0.35); }
      var N = o.L ? o.n(4) : o.n(9);
      for (i = 0; i < N; i++) { var j = i + o.L * 20; if (o.r(st * 7 + j) < 0.35) continue;
        var y = o.top - 6 * u + o.r(st * 13 + j) * (o.h + 10 * u), x = o.cx + (o.r(st * 17 + j) - 0.5) * 30 * u, w = (3 + o.r(st * 19 + j) * 9) * u, hh = (0.8 + o.r(j + 3) * 1.6) * u;
        P.rect(x - w / 2 - u, y, w, hh, o.c[0], 0.75); P.rect(x - w / 2 + u, y, w, hh, o.c[1], 0.75); if (o.r(st + j * 5) > 0.6) P.rect(x - w / 2, y, w, hh * 0.5, o.c[2], 0.6); }
      for (i = 0; i < o.n(o.L ? 2 : 5); i++) { var q = st + i * 31; P.rect(o.cx + (o.r(q) - 0.5) * 30 * u, o.top + o.r(q + 1) * o.h, 1.6 * u, 1.6 * u, o.c[3], o.r(q + 2) > 0.5 ? 1 : 0.4); }
      if (o.L === 0) P.ell(o.cx, o.fy, 12 * u, 2.6 * u, o.c[4], 0.5);
    } },
    banners: { add: 0, draw: function (P, o) {   // two royal banners on gold poles at his sides, flying; gold dust
      var u = o.u, t = o.t, i;
      if (o.L === 0) for (var sd = -1; sd <= 1; sd += 2) {
        var px = o.cx + sd * 14 * u, top = o.top - 10 * u, H = 13 * u, W = 7 * u, prev = null;
        P.rect(px - 0.5 * u, top - 1 * u, 1 * u, o.fy - top + u, o.c[1], 1); P.circ(px, top - 1.5 * u, 1.2 * u, o.c[3], 1);
        for (var k = 0; k <= 6; k++) { var f = k / 6, wx = px + sd * f * W, wy = top + Math.sin(t / 260 - f * 3 + sd) * 1.6 * u * f, cur = [wx, wy, wy + H * (1 - f * 0.18)];
          if (prev) { P.tri(prev[0], prev[1], cur[0], cur[1], prev[0], prev[2], k % 2 ? o.c[0] : o.c[2], 0.95); P.tri(cur[0], cur[1], cur[0], cur[2], prev[0], prev[2], k % 2 ? o.c[0] : o.c[2], 0.95); }
          prev = cur; }
        var ex = px + sd * W * 0.5, ey = top + H * 0.45 + Math.sin(t / 260 - 1.5 + sd) * 0.8 * u; P.tri(ex, ey - 2.4 * u, ex - 1.6 * u, ey, ex + 1.6 * u, ey, o.c[1], 1); P.tri(ex, ey + 2.4 * u, ex - 1.6 * u, ey, ex + 1.6 * u, ey, o.c[1], 1); P.rect(ex - 0.4 * u, ey - 0.4 * u, 0.8 * u, 0.8 * u, o.c[3], 1);
        P.tri(px + sd * W * 0.2, top + H, px + sd * W * 0.55, top + H - 2.5 * u, px + sd * W * 0.9, top + H, o.c[4], 0.9);
      }
      for (i = 0; i < o.n(o.L ? 4 : 8); i++) { var j = i + o.L * 30, q = frV157B(t / 2000 + o.r(j)); P.rect(o.cx + (o.r(j + 1) - 0.5) * 22 * u, o.top - 4 * u + q * (o.h + 6 * u), 0.8 * u, 0.8 * u, o.c[1], Math.sin(q * Math.PI)); }
    } },
    wolves: { add: 1, draw: function (P, o) {   // two spirit wolves running round him, legs in stride, wisps trailing
      var u = o.u, t = o.t;
      for (var w = 0; w < 2; w++) {
        var an = t / 2800 * TAU_V159D + w * Math.PI, sn = Math.sin(an); if ((sn > 0) !== (o.L === 1)) continue;
        var x = o.cx + Math.cos(an) * 16 * u, y = o.fy - 5 * u + sn * 4 * u, dir = -Math.sin(an) >= 0 ? 1 : -1, sc = 0.85 + 0.15 * (sn + 1) / 2, s = u * sc, run = t / 90 + w * 3, al = 0.8;
        for (var k = 1; k <= 4; k++) P.circ(x - dir * (5 + k * 2.2) * s, y - 2 * s + Math.sin(t / 150 + k) * 0.6 * s, (1.6 - k * 0.3) * s, o.c[1], 0.35 - k * 0.07);
        P.ell(x, y - 2 * s, 4.2 * s, 2 * s, o.c[0], al);
        P.circ(x + dir * 4.4 * s, y - 3.4 * s, 1.8 * s, o.c[0], al); P.tri(x + dir * 5.4 * s, y - 3.6 * s, x + dir * 7.6 * s, y - 2.8 * s, x + dir * 5.4 * s, y - 2.4 * s, o.c[0], al);
        P.tri(x + dir * 3.6 * s, y - 4.6 * s, x + dir * 4.6 * s, y - 4.8 * s, x + dir * 3.8 * s, y - 6.6 * s, o.c[2], al);
        P.rect(x + dir * 5 * s - 0.35 * s, y - 3.9 * s, 0.7 * s, 0.7 * s, o.c[3], 1);
        [[-3, 0], [-1.6, Math.PI], [2, Math.PI * 0.5], [3.2, Math.PI * 1.5]].forEach(function (L) { var sw = Math.sin(run + L[1]) * 1.6 * s; P.seg(x + dir * L[0] * s, y - 1 * s, x + dir * L[0] * s + sw, y + 1.8 * s, 0.8 * s, o.c[0], al); });
        P.tri(x - dir * 3.8 * s, y - 2.8 * s, x - dir * 7.2 * s, y - 4.4 * s + Math.sin(run) * s, x - dir * 3.8 * s, y - 1.6 * s, o.c[2], 0.7);
      }
      if (o.L === 0) P.ellS(o.cx, o.fy - 5 * u, 16 * u, 4 * u, 0.5 * u, o.c[1], 0.3);
    } },
    hellgate: { add: 1, draw: function (P, o) {   // a burning rune circle under him, a pentagram, flame pillars at its points
      var u = o.u, t = o.t, RX = 16 * u, RY = 4.6 * u, rot = t / 5200 * TAU_V159D, gy = o.fy, i;
      if (o.L === 0) {
        P.ell(o.cx, gy, RX, RY, o.c[4], 0.55);
        P.ellS(o.cx, gy, RX, RY, 1 * u, o.c[0], 0.9); P.ellS(o.cx, gy, RX * 0.82, RY * 0.82, 0.6 * u, o.c[1], 0.75);
        for (i = 0; i < 5; i++) { var a1 = rot + i * TAU_V159D / 5, a2 = rot + (i + 2) * TAU_V159D / 5; P.seg(o.cx + Math.cos(a1) * RX * 0.8, gy + Math.sin(a1) * RY * 0.8, o.cx + Math.cos(a2) * RX * 0.8, gy + Math.sin(a2) * RY * 0.8, 0.6 * u, o.c[0], 0.8); }
        for (i = 0; i < 12; i++) { var ar = -rot * 1.5 + i * TAU_V159D / 12, rx = o.cx + Math.cos(ar) * RX * 0.91, ry = gy + Math.sin(ar) * RY * 0.91, gl = o.r(i * 3 + Math.floor(t / 400)) > 0.5; P.seg(rx - 0.6 * u, ry - 0.6 * u, rx + 0.6 * u, ry + 0.4 * u, 0.45 * u, gl ? o.c[3] : o.c[1], 0.9); }
      }
      for (i = 0; i < 5; i++) { var ap = rot + i * TAU_V159D / 5, sp = Math.sin(ap); if ((sp > 0) !== (o.L === 1)) continue;
        var fx = o.cx + Math.cos(ap) * RX * 0.8, fy = gy + sp * RY * 0.8, H = (7 + 3 * Math.sin(t / 110 + i * 2)) * u, sw = Math.sin(t / 80 + i) * 0.8 * u;
        P.tri(fx - 1.8 * u, fy, fx + 1.8 * u, fy, fx + sw, fy - H, o.c[0], 0.85); P.tri(fx - 0.9 * u, fy, fx + 0.9 * u, fy, fx + sw * 0.6, fy - H * 0.6, o.c[3], 0.95); }
      for (i = 0; i < o.n(o.L ? 3 : 6); i++) { var q = frV157B(t / 1300 + o.r(i + 60)); P.rect(o.cx + (o.r(i + 61) - 0.5) * 26 * u, gy - q * 30 * u, 0.9 * u, 0.9 * u, o.c[1], 1 - q); }
    } },
    feathers: { add: 1, draw: function (P, o) {   // white and gold feathers drifting down round him, rocking; a shaft of light
      var u = o.u, t = o.t, i;
      if (o.L === 0) { var pu = 0.8 + 0.2 * Math.sin(t / 700); P.tri(o.cx - 5 * u, o.top - 30 * u, o.cx + 5 * u, o.top - 30 * u, o.cx + 14 * u, o.fy, o.c[1], 0.12 * pu); P.tri(o.cx - 5 * u, o.top - 30 * u, o.cx - 14 * u, o.fy, o.cx + 14 * u, o.fy, o.c[1], 0.12 * pu); P.ell(o.cx, o.fy, 12 * u, 2.8 * u, o.c[2], 0.35 * pu); }
      var N = o.L ? o.n(4) : o.n(8);
      for (i = 0; i < N; i++) { var j = i + o.L * 20, p = frV157B(t / (3600 + o.r(j) * 1400) + o.r(j + 1)), rock = Math.sin(t / 420 + j * 2), x = o.cx + (o.r(j + 2) - 0.5) * 28 * u + rock * 3 * u, y = o.top - 14 * u + p * (o.h + 16 * u), ang = rock * 0.6 + 0.5, L = (3.2 + o.r(j + 3)) * u, dx = Math.sin(ang) * L, dy = -Math.cos(ang) * L, al = Math.min(1, (1 - p) * 5, p * 6), col = o.c[j % 3 === 0 ? 2 : 0];
        P.tri(x - dx, y - dy, x + dx, y + dy, x + dy * 0.35 + dx * 0.2, y - dx * 0.35 + dy * 0.2, col, 0.95 * al); P.tri(x - dx, y - dy, x + dx, y + dy, x - dy * 0.3, y + dx * 0.3, o.c[3], 0.85 * al); P.seg(x - dx * 1.2, y - dy * 1.2, x + dx, y + dy, 0.35 * u, o.c[2], al); }
      for (i = 0; i < o.n(o.L ? 2 : 6); i++) { var m = frV157B(t / 2600 + o.r(i + 70)); P.rect(o.cx + (o.r(i + 71) - 0.5) * 20 * u, o.fy - m * o.h, 0.7 * u, 0.7 * u, o.c[2], Math.sin(m * Math.PI)); }
    } },
    chrome: { add: 0, draw: function (P, o) {   // mercury: blobs orbiting and swelling, a rippling pool, droplets leaping from it
      var u = o.u, t = o.t, i;
      if (o.L === 0) { P.ell(o.cx, o.fy, 13 * u, 3.2 * u, o.c[3], 0.85); P.ell(o.cx, o.fy - 0.4 * u, 11 * u, 2.3 * u, o.c[2], 0.9); P.ell(o.cx - 3 * u, o.fy - 0.9 * u, 5 * u, 0.9 * u, o.c[0], 0.8);
        for (var k = 0; k < 2; k++) { var rp = frV157B(t / 1100 + k / 2); P.ellS(o.cx, o.fy, (4 + rp * 12) * u, (1 + rp * 3) * u, 0.5 * u, o.c[4], 0.8 * (1 - rp)); } }
      var N = 5;
      for (i = 0; i < N; i++) { var an = t / 2300 * TAU_V159D + i * TAU_V159D / N, sn = Math.sin(an); if ((sn > 0) !== (o.L === 1)) continue;
        var x = o.cx + Math.cos(an) * 14 * u, y = o.cy + sn * 4 * u + Math.sin(t / 500 + i * 1.7) * 3 * u - (i % 2) * 6 * u, r = (2 + 0.7 * Math.sin(t / 330 + i * 2.1)) * u;
        P.circ(x, y, r, o.c[3], 1); P.circ(x - r * 0.12, y - r * 0.12, r * 0.84, o.c[2], 1); P.circ(x - r * 0.3, y - r * 0.3, r * 0.5, o.c[1], 1); P.circ(x - r * 0.42, y - r * 0.45, r * 0.2, o.c[4], 1);
        P.circ(x + r * 0.9 * Math.cos(an + 1.2), y + r * 0.9, r * 0.45, o.c[2], 0.9); }
      if (o.L === 1) for (i = 0; i < o.n(3); i++) { var p = frV157B(t / 900 + i / 3), dx = (o.r(i + Math.floor(t / 900 + i / 3) * 5) - 0.5) * 20 * u, dy = Math.sin(p * Math.PI) * 10 * u; P.circ(o.cx + dx, o.fy - dy, 0.8 * u, o.c[1], 1); P.rect(o.cx + dx - 0.3 * u, o.fy - dy - 0.4 * u, 0.4 * u, 0.4 * u, o.c[4], 1); }
    } },
    fireflies: { add: 1, draw: function (P, o) {   // fireflies wandering lazy loops round him, each blinking on its own clock
      var u = o.u, t = o.t, N = o.n(14);
      for (var i = 0; i < N; i++) { var j = i + o.L * 40, sx = t / (2600 + o.r(j) * 1800) * TAU_V159D + o.r(j + 1) * 7, sy = t / (1900 + o.r(j + 2) * 1400) * TAU_V159D + o.r(j + 3) * 7;
        var x = o.cx + Math.sin(sx) * (10 + o.r(j + 4) * 8) * u, y = o.cy - 4 * u + Math.sin(sy) * (o.h * 0.55), front = Math.cos(sx) > 0; if (front !== (o.L === 1)) continue;
        var bl = Math.max(0, Math.sin(t / (500 + o.r(j + 5) * 500) * TAU_V159D + j)), a = 0.25 + 0.75 * bl * bl;
        P.circ(x, y, 2.4 * u, o.c[1], 0.22 * a); P.circ(x, y, 1 * u, o.c[0], a); P.rect(x - 0.3 * u, y - 0.3 * u, 0.6 * u, 0.6 * u, o.c[2], a); }
      if (o.L === 0) P.ell(o.cx, o.fy, 10 * u, 2.2 * u, o.c[1], 0.2);
    } },
    meteors: { add: 1, draw: function (P, o) {   // a meteor shower streaking down behind him, flashes where they land, stars
      var u = o.u, t = o.t, i;
      if (o.L === 1) { for (i = 0; i < 2; i++) { var q2 = frV157B(t / 1300 + i / 2), cyc = Math.floor(t / 1300 + i / 2), lx = o.cx + (o.r(cyc * 7 + i) - 0.5) * 30 * u; if (q2 > 0.72) { var f = (q2 - 0.72) / 0.28; P.ellS(lx, o.fy, (1 + f * 6) * u, (0.4 + f * 1.8) * u, 0.6 * u, o.c[1], 1 - f); } } return; }
      for (i = 0; i < o.n(8); i++) { var tw = 0.5 + 0.5 * Math.sin(t / 200 + i * 2.7); P.rect(o.cx + (o.r(i + 90) - 0.5) * 36 * u, o.top - 16 * u + o.r(i + 91) * 20 * u, 0.7 * u, 0.7 * u, o.c[4], tw); }
      var N = o.n(6);
      for (i = 0; i < N; i++) { var cy2 = Math.floor(t / 1300 + i / N), p = frV157B(t / 1300 + i / N); if (p > 0.72) continue;
        var k = p / 0.72, sx = o.cx + (o.r(cy2 * 7 + i) - 0.5) * 30 * u + 14 * u, ex = sx - 16 * u, sy = o.top - 24 * u, ey = o.fy, hx = sx + (ex - sx) * k, hy = sy + (ey - sy) * k, L = 0.3;
        var tx = hx - (ex - sx) * L, ty = hy - (ey - sy) * L;
        P.seg(tx, ty, hx, hy, 2.4 * u, o.c[3], 0.25); P.seg(tx + (hx - tx) * 0.4, ty + (hy - ty) * 0.4, hx, hy, 1.4 * u, o.c[2], 0.7); P.seg(tx + (hx - tx) * 0.75, ty + (hy - ty) * 0.75, hx, hy, 0.8 * u, o.c[1], 0.95);
        P.circ(hx, hy, 1.1 * u, o.c[0], 1); }
    } },
    cavern: { add: 0, draw: function (P, o) {   // crystal clusters grown up round him, light pulsing up them, crystal dust
      var u = o.u, t = o.t, i;
      var shard = function (x, y, h, w, lean, k) { var pu = 0.5 + 0.5 * Math.sin(t / 380 - k * 0.9); P.tri(x - w, y, x, y, x + lean, y - h, o.c[1], 0.95); P.tri(x, y, x + w, y, x + lean, y - h, o.c[2], 0.95); P.tri(x - w * 0.4, y - h * 0.1, x, y - h * 0.1, x + lean * 0.9, y - h * 0.85, o.c[0], 0.55 + 0.4 * pu); P.circ(x + lean, y - h, 1.2 * u, o.c[3], 0.5 * pu); };
      var S = [[-14, 11, 2.6, -2], [-10, 7, 1.8, -1], [-17, 6, 1.6, -2.5], [12, 12, 2.8, 2], [16, 7, 1.8, 2.5], [9, 6, 1.6, 1], [-4, 5, 1.4, -1], [4, 6, 1.5, 1]];
      if (o.L === 0) { P.ell(o.cx, o.fy, 16 * u, 3.4 * u, o.c[4], 0.6); S.slice(0, 6).forEach(function (s, k) { shard(o.cx + s[0] * u, o.fy - 1.5 * u, s[1] * u, s[2] * u, s[3] * u, k); }); }
      else S.slice(6).forEach(function (s, k) { shard(o.cx + s[0] * u, o.fy + 1.5 * u, s[1] * u, s[2] * u, s[3] * u, k + 6); });
      for (i = 0; i < o.n(o.L ? 3 : 8); i++) { var j = i + o.L * 30, q = frV157B(t / 2400 + o.r(j)), s2 = (0.6 + o.r(j + 2) * 0.6) * u; P.rect(o.cx + (o.r(j + 1) - 0.5) * 30 * u + Math.sin(t / 700 + j) * u, o.fy - q * (o.h + 10 * u), s2, s2, o.c[j % 2 ? 3 : 0], Math.sin(q * Math.PI)); }
    } }
  };

  /* ---- what the check reads ---- */
  Object.assign(G_V159D, {
    on: function () { return { flutter: flutterOnV159D(), crown: crownAnimOnV159D(), aura: auraOnV159D() }; },
    items: function () { return itemsV159D().map(function (i) { return i.id; }); },
    crownKinds: function () { return Object.keys(CROWNS_V159D); }, auraKinds: function () { return Object.keys(AFX_V159D); },
    member: function () { return MEMBER_V159D.slice(); },
    pose: wingPoseV159D, fam: famV159D, crownFrame: crownFrameArtV159D, crownAt: crownAnimV159D, crownPhase: crownPhaseV159D, bob: crownBobV159D,
    sampleAura: function (id, t) { return sampleV157B(id, t); },
    paintWings: function (ctx, wd, geo, k, pose) { paintBackV153G(ctx, geo, { wings: { id: "wings", d: wd } }, k, null, pose); },
    paintCrown: function (ctx, cd, geo, k, t) { paintFrontV153G(ctx, geo, { crown: { id: "crown", d: cd } }, k, t); },
    registered: function () { return FLAPS_V157A.map(function (r) { return { where: r.where, kind: r.kind || null, on: !!r.cv.isConnected }; }); }
  });
  G157.pose = function (t, kind) { return wingPoseV159D(t, kind); };   // v159 D: the pose the wings are drawn with

  /* ===== v177 F TEN NEW FOOTSTEPS =====
   * The owner: "Add 10 more footsteps animations. I LOVED the look of the afterimage. Creativity like that is going to
   * get people interested. Don't copy that, but the same level of ingenuity."
   * Ten footprint programs in `FX_V177F`, each its own idea (v157 B's painter, its newest-first primitive cap, its
   * animated Locker preview and its `sample`; registered into `TFX_V157B` so every path that draws a trail finds them):
   *   datamosh       the stride glitches: RGB-split tear bars that jump, dead scanlines, a smeared block dragged behind
   *   ink            sumi brushwork: a pressure-varying black stroke, the wash bleeding out under it, splatter, a red seal
   *   frostbite      every print freezes: a frost ring, cracks that race out and branch, a glint, then thaw
   *   film           a strip of film unspools behind him — sprockets, flickering frames with a tiny runner in each, curling up
   *   bloom          a vine sprouts from a print, unfurls two leaves, opens a flower, drops its petals
   *   gravity        each print collapses into a tiny black hole: the turf's grid bends into it, matter spirals in, a flash
   *   cranes         a paper square on the turf folds itself into a crane and flaps away
   *   sands          sand pours into a pile at each print and the wind blows it away; an hourglass flips over the trail
   *   constellation  stars light at his steps and the lines of a constellation draw between them
   *   chrome         liquid mercury: beads that wobble, splash when they land and pull a bridge to the last one
   * All ten are SUPER looks (mythic, source "super": only a super challenge grants one — v156 C's mechanics, listed "Super
   * challenge: …" while locked, never sold, never member). Ten new super challenges (`SUPER_V177F`), each paying a pair:
   * one of these footprints and one of v177 G's wings. They join v156 C's list (the SEASON tab's section, `rib.super.v1`,
   * outside the save) through wrappers on its scan / tick / progress / desc — v156 C's own code is untouched.
   * No Math.random: every particle is a function of the clock and an integer hash of the print's index.
   * Kill switch TU("v177Ftrail", 0): each new trail draws as its base v153 G `kind`. `window.__V177F`; v177FGHcheck. */
  function onV177F() { return !!TUv("v177Ftrail", 1); }
  var G177F = (window.__V177F = window.__V177F || { errs: [] });
  function errV177F(e) { try { if (G177F.errs.length < 8) G177F.errs.push(String((e && e.message) || e)); } catch (x) {} }
  function itemsV177F() {
    var T = function (id, name, kind, col, fx) { return { id: id, cat: "trail", name: name, rarity: "mythic", source: "super", tr: { kind: kind, col: col, fx: fx } }; };
    return [
      T("trail_datamosh", "Datamosh", "pixels", ["#ff2d55", "#00e5ff", "#ffffff", "#120a1c", "#7a2aff"], "datamosh"),
      T("trail_ink", "Sumi Ink", "smoke", ["#07070b", "#3a4458", "#c8102e", "#f4efe6"], "ink"),
      T("trail_frostbite", "Frostbite", "ice", ["#ffffff", "#bfe9ff", "#5ab4ff", "#1f4f8f"], "frostbite"),
      T("trail_film", "Film Reel", "comet", ["#141110", "#f2d9a0", "#fff6dc", "#7a5a2a", "#3a2a1a"], "film"),
      T("trail_bloom", "Wildbloom", "petals", ["#ff5fa2", "#b06bff", "#ffe14d", "#2f7a32", "#6fdc5a"], "bloom"),
      T("trail_gravity", "Gravity Well", "stars", ["#050208", "#ffffff", "#ffb02e", "#8a5cff", "#6fd3ff"], "gravity"),
      T("trail_cranes", "Paper Cranes", "petals", ["#fffaf0", "#ffc8d4", "#c8b0ff", "#8a8070"], "cranes"),
      T("trail_sands", "Sands of Time", "sparks", ["#f6deb0", "#d4a860", "#8a6a3a", "#fff4d6", "#4a3018"], "sands"),
      T("trail_constellation", "Constellation", "stars", ["#ffffff", "#9fc8ff", "#ffe9a0", "#5a48c8"], "constellation"),
      T("trail_chrome", "Liquid Chrome", "comet", ["#ffffff", "#dfe6ee", "#8a96a8", "#2a3240", "#9fe0ff"], "chrome")
    ];
  }
  var TAU_V177F = 6.283185307179586;
  function hV177F(i, k) { return ihV153G(((i | 0) * 131 + (k | 0) * 7919 + 17) >>> 0); }
  var STAR_V177F = { last: null };   // the constellation's previous star, within one frame (reset at the head)
  var FX_V177F = {
    // DATAMOSH: the stride glitches — RGB-split tear bars that jump on a step clock, a dead scanline, a smeared block
    datamosh: { life: 1.3, k: 1.5, draw: function (P, p, q, a, F, s, now, c) {
      if (p.i % 2) return false;
      var st = Math.floor(now / 85), r = hV177F(p.i, 1), jump = hV177F(p.i, st) > 0.68 ? (hV177F(p.i * 3, st) - 0.5) * 7 * s : 0;
      var w = (4 + 7 * r) * s * (0.45 + 0.55 * F), h = (1.2 + 2 * hV177F(p.i, 2)) * s, x = p.x - w / 2 + jump, y = p.y - 1.5 * s - hV177F(p.i, 3) * 8 * s * (0.3 + a), sp = (0.8 + 1.4 * a) * s;
      P.rect(x - sp, y, w, h, c[0], 0.8 * F); P.rect(x + sp, y, w, h, c[1], 0.8 * F); P.rect(x, y, w, h, c[2], 0.95 * F);
      P.rect(x - sp, y + h * 0.45, w + 2 * sp, 0.4 * s, c[3], 0.9 * F);   // the dead scanline
      if (q && r > 0.5) { var dx = p.x - q.x, dy = p.y - q.y; P.rect(x - dx * (2 + 5 * a), y - 2.5 * s - dy * 3 * a, w * 0.7, h * 1.9, c[4], 0.5 * F); }   // the smear
      if (a > 0.3) for (var k = 0; k < 3; k++) { var g = 1.6 * s, px = Math.round((p.x + (hV177F(p.i, 5 + k) - 0.5) * 9 * s) / g) * g, py = Math.round((y - (1 + k * 2) * s - a * 4 * s) / g) * g; P.rect(px, py, g, g, c[(p.i + k) % 3], F); }
    } },
    // SUMI INK: a brushstroke that swells and thins with the stride, the wash bleeding out under it, splatter, a seal
    ink: { life: 1.7, k: 1.5, draw: function (P, p, q, a, F, s, now, c) {
      if (!nearV157B(p, q, s)) return false;
      var pr = 0.5 + 0.5 * Math.sin(p.i * 0.55), w = (1.4 + 3.8 * pr) * s * (0.5 + 0.5 * Math.min(1, F * 1.3)), y0 = p.y - 0.6 * s, y1 = q.y - 0.6 * s;
      P.circ(p.x, y0, (1 + 3.4 * Math.sqrt(a)) * s * (0.6 + pr * 0.6), c[1], 0.22 * F);   // the bleed spreads as it dries
      P.seg(q.x, y1, p.x, y0, w, c[0], 0.94 * Math.min(1, F * 1.5));
      if (w > 2.2 * s) P.seg(q.x, y1 - w * 0.28, p.x, y0 - w * 0.28, 0.35 * s, c[3], 0.4 * F);   // dry-brush bristle streak
      if (hV177F(p.i, 4) > 0.8) { var an = hV177F(p.i, 5) * TAU_V177F, d = (2.5 + 5 * hV177F(p.i, 6)) * s * Math.min(1, a * 4); P.circ(p.x + Math.cos(an) * d, y0 + Math.sin(an) * d * 0.5, (0.35 + 0.6 * hV177F(p.i, 7)) * s, c[0], F); }
      if (p.i % 16 === 8) {   // the artist's seal: a red square with a white glyph
        var S2 = 3.4 * s, sx = p.x - S2 / 2, sy = p.y - 6.5 * s - S2 / 2;
        P.rect(sx, sy, S2, S2, c[2], F); P.rect(sx + 0.5 * s, sy + 0.5 * s, S2 - s, 0.35 * s, c[3], F); P.rect(sx + S2 / 2 - 0.18 * s, sy + 0.5 * s, 0.36 * s, S2 - s, c[3], F); P.rect(sx + 0.5 * s, sy + S2 - 0.85 * s, S2 - s, 0.35 * s, c[3], F);
      }
    } },
    // FROSTBITE: every print freezes — a frost ring, cracks racing out and branching, a glint, then the thaw
    frostbite: { life: 1.8, k: 1.6, draw: function (P, p, q, a, F, s, now, c) {
      if (p.i % 3) return false;
      var g = Math.min(1, a * 4), cx = p.x, cy = p.y;
      P.ell(cx, cy, 4.6 * s, 1.8 * s, c[1], 0.4 * F); P.ellS(cx, cy, (2.4 + 3 * g) * s, (1 + 1.1 * g) * s, 0.5 * s, c[0], 0.75 * F);
      for (var sp = 0; sp < 3; sp++) { var sx = cx + (sp - 1) * 2.2 * s + (hV177F(p.i, 30 + sp) - 0.5) * s, sh = (1.5 + 2.5 * hV177F(p.i, 33 + sp)) * s * g * (0.5 + 0.5 * F);   // frost spikes stand up out of it
        P.tri(sx - 0.7 * s, cy, sx, cy, sx + 0.2 * s, cy - sh, c[0], 0.9 * F); P.tri(sx, cy, sx + 0.7 * s, cy, sx + 0.2 * s, cy - sh, c[1], 0.9 * F); }
      for (var k = 0; k < 5; k++) {
        var an = (k / 5 + hV177F(p.i, k) * 0.15) * TAU_V177F, L = (4 + 5 * hV177F(p.i, 10 + k)) * s * g, mx = cx + Math.cos(an) * L * 0.55, my = cy + Math.sin(an) * L * 0.28, ex = cx + Math.cos(an + 0.18) * L, ey = cy + Math.sin(an + 0.18) * L * 0.5;
        P.seg(cx, cy, mx, my, 0.75 * s, c[2], 0.9 * F); P.seg(mx, my, ex, ey, 0.5 * s, c[0], F);
        if (g > 0.6) { var bn = an + (k % 2 ? 0.7 : -0.7); P.seg(mx, my, mx + Math.cos(bn) * L * 0.35, my + Math.sin(bn) * L * 0.18, 0.4 * s, c[1], 0.9 * F); }
      }
      P.ell(cx, cy, 1.2 * s, 0.6 * s, c[3], 0.55 * F);
      if (hV177F(p.i, Math.floor(now / 140)) > 0.72) { var gx = cx + (hV177F(p.i, 20) - 0.5) * 5 * s, gy = cy - 1.2 * s; P.rect(gx - 1.4 * s, gy - 0.2 * s, 2.8 * s, 0.4 * s, c[0], F); P.rect(gx - 0.2 * s, gy - 1.4 * s, 0.4 * s, 2.8 * s, c[0], F); }
    } },
    // FILM REEL: a strip unspools behind him — sprockets, flickering frames each holding a tiny runner, curling as it ages
    film: { life: 1.4, k: 1.5, draw: function (P, p, q, a, F, s, now, c) {
      if (!nearV157B(p, q, s)) return false;
      var lift = function (pt, ag) { return pt.y - 3 * s - ag * ag * 7 * s - Math.sin(pt.i * 0.7 + now / 260) * ag * 2 * s; };
      var aq = Math.min(1, a + 0.04), y0 = lift(p, a), y1 = lift(q, aq), H = 4.6 * s;
      P.seg(q.x, y1, p.x, y0, H, c[0], 0.92 * F);
      var hy = H * 0.36; P.rect(p.x - 0.35 * s, y0 - hy - 0.35 * s, 0.7 * s, 0.7 * s, c[2], 0.8 * F); P.rect(p.x - 0.35 * s, y0 + hy - 0.35 * s, 0.7 * s, 0.7 * s, c[2], 0.8 * F);   // sprockets
      if (p.i % 3 === 0) {
        var fl = 0.75 + 0.25 * hV177F(p.i, Math.floor(now / 70)), fw = 2.6 * s, fh = 2.3 * s;
        P.rect(p.x - fw / 2, y0 - fh / 2, fw, fh, c[1], fl * F);
        var leg = ((p.i / 3) | 0) % 2 ? 1 : -1, bx = p.x, by = y0 + 0.75 * s;   // the runner: a head, a body, two legs in stride
        P.circ(bx + 0.25 * s, by - 1.45 * s, 0.32 * s, c[4], F); P.seg(bx + 0.15 * s, by - 1.1 * s, bx - 0.1 * s, by - 0.25 * s, 0.35 * s, c[4], F);
        P.seg(bx - 0.1 * s, by - 0.25 * s, bx + leg * 0.6 * s, by + 0.35 * s, 0.3 * s, c[4], F); P.seg(bx - 0.1 * s, by - 0.25 * s, bx - leg * 0.55 * s, by + 0.3 * s, 0.3 * s, c[4], F);
        P.rect(p.x - fw / 2, y0 - fh / 2, fw, 0.3 * s, c[2], 0.5 * F * fl);
      }
    } },
    // WILDBLOOM: a vine sprouts from a print, unfurls two leaves, opens a flower, and drops its petals
    bloom: { life: 1.9, k: 1.5, draw: function (P, p, q, a, F, s, now, c) {
      if (p.i % 3) return false;
      var g = Math.min(1, a * 3.2), H = (8 + 5 * hV177F(p.i, 1)) * s, sway = Math.sin(now / 420 + p.i) * 0.6 * s, lean = (hV177F(p.i, 2) - 0.5) * 2 * s, x0 = p.x, y0 = p.y;
      var pt = function (t) { return [x0 + lean * t + Math.sin(t * 3.2 + p.i) * 1.1 * s * t + sway * t * t, y0 - H * t]; };
      var N = 4, px = x0, py = y0;
      for (var k = 1; k <= N; k++) { var t = k / N * g, Q = pt(t); P.seg(px, py, Q[0], Q[1], (1 - 0.12 * k) * s, c[3], F); px = Q[0]; py = Q[1]; }
      if (g > 0.45) [0.38, 0.62].forEach(function (lt, j) { var L0 = pt(lt), dir = j ? 1 : -1, ls = Math.min(1, (g - 0.45) * 3) * 2.6 * s; P.tri(L0[0], L0[1], L0[0] + dir * ls * 1.4, L0[1] - ls * 0.9, L0[0] + dir * ls * 0.3, L0[1] - ls * 0.2, c[4], F); });
      if (g >= 1) {
        var T = pt(1), open = Math.min(1, (a - 0.31) * 3), fall = Math.max(0, (a - 0.7) / 0.3), col = c[(p.i / 3 | 0) % 2], R2 = (0.7 + 1.6 * open) * s;
        for (var k2 = 0; k2 < 5; k2++) { var an = k2 * TAU_V177F / 5 + now / 1600 + p.i, dropx = fall * Math.cos(an) * 3 * s, dropy = fall * (4 + k2) * s;
          P.circ(T[0] + Math.cos(an) * R2 + dropx, T[1] + Math.sin(an) * R2 * 0.8 + dropy, (0.8 + 0.8 * open) * s, col, F * (1 - fall * 0.5)); }
        if (fall < 0.6) { P.circ(T[0], T[1], 0.9 * s, c[2], F); P.rect(T[0] - 0.3 * s, T[1] - 0.5 * s, 0.4 * s, 0.4 * s, 0xffffff, 0.8 * F); }
      } else P.circ(px, py, 0.8 * s, c[4], F);   // the bud
    } },
    // GRAVITY WELL: each print collapses into a tiny black hole — the turf grid bends into it, matter spirals in, a flash
    gravity: { life: 1.6, k: 1.6, draw: function (P, p, q, a, F, s, now, c) {
      if (p.i % 4) return false;
      var cx = p.x, cy = p.y - 0.5 * s, life2 = a < 0.82 ? 1 : Math.max(0, 1 - (a - 0.82) / 0.18), R = 2.2 * s * life2;
      for (var ln = -1; ln <= 1; ln++) {   // the warped grid: three lines dipping toward the core
        var yL = cy + ln * 2.2 * s, prx = cx - 6 * s, pry = yL;
        for (var k = 1; k <= 6; k++) { var xx = cx - 6 * s + k * 2 * s, dx = (xx - cx) / (2.6 * s), dip = 2.4 * s * Math.exp(-dx * dx) * life2 * (ln === 0 ? 0.4 : 1) * (ln < 0 ? 1 : -1) * -1, yy = yL + dip;
          P.seg(prx, pry, xx, yy, 0.35 * s, c[3], 0.55 * F); prx = xx; pry = yy; }
      }
      if (R > 0.2) {
        P.ell(cx, cy, R * 2.6, R * 1.1, c[2], 0.35 * F);   // the accretion disc
        for (var j = 0; j < 4; j++) { var an = now / 170 + j * TAU_V177F / 4 + p.i, ox = Math.cos(an) * R * 2.3, oy = Math.sin(an) * R * 0.9; P.circ(cx + ox, cy + oy, 0.45 * s, j % 2 ? c[2] : c[4], (Math.sin(an) > 0 ? 1 : 0.55) * F); }
        P.ellS(cx, cy, R * 1.35, R * 1.35, 0.45 * s, c[1], 0.8 * F);   // the photon ring
        P.circ(cx, cy, R, c[0], F);
        for (var m = 0; m < 2; m++) { var ph = (now / 900 + hV177F(p.i, m)) % 1, rr = (1 - ph) * 6 * s + R, aa = hV177F(p.i, 5 + m) * TAU_V177F + ph * 6; P.rect(cx + Math.cos(aa) * rr - 0.35 * s, cy + Math.sin(aa) * rr * 0.45 - 0.35 * s, 0.7 * s, 0.7 * s, c[4], F * ph); }
      } else { var fl = (a - 0.82) / 0.18; P.ring(cx, cy, (1 + fl * 5) * s, 0.5 * s, c[1], 1 - fl); }
    } },
    // PAPER CRANES: a paper square on the turf folds itself into a crane, which flaps up and away
    cranes: { life: 1.8, k: 1.8, draw: function (P, p, q, a, F, s, now, c) {
      if (p.i % 3) return false;
      var g = Math.min(1, a * 3.5), col = c[(p.i / 3 | 0) % 3], shade = c[3];
      if (g < 1) {   // the square, folding: its corners pull in as the folds form
        var S2 = 3.4 * s * (1 - 0.35 * g), x = p.x, y = p.y - 0.6 * s;
        P.tri(x - S2, y, x, y - S2 * 0.5 * (1 + g), x + S2, y, col, F); P.tri(x - S2, y, x, y + S2 * 0.5 * (1 - g * 0.6), x + S2, y, col, F);
        P.seg(x - S2, y, x + S2, y, 0.3 * s, shade, 0.7 * F); P.seg(x, y - S2 * 0.5 * (1 + g), x, y + S2 * 0.5, 0.25 * s, shade, 0.5 * F);
        return;
      }
      var up = (a - 0.29) / 0.71, x2 = p.x + Math.sin(up * 3 + p.i) * 2 * s - up * 3 * s, y2 = p.y - 2 * s - up * up * 16 * s, k = 1.35 * s, flap = Math.sin(now / 85 + p.i * 1.3);
      P.ell(p.x, p.y, 2.2 * s * (1 - up * 0.6), 0.6 * s, shade, 0.25 * F);   // its shadow on the turf
      P.tri(x2 - 1 * k, y2 - 0.4 * k, x2 + 0.8 * k, y2 - 0.4 * k, x2 - 0.5 * k + flap * 0.3 * k, y2 - (2.9 + 1.3 * flap) * k, shade, F);   // the far wing
      P.tri(x2 - 1.2 * k, y2 - 0.4 * k, x2 - 0.2 * k, y2 + 0.3 * k, x2 - 3.7 * k, y2 - 2.7 * k, col, F);   // the tail
      P.tri(x2 + 1.2 * k, y2 - 0.4 * k, x2 + 0.3 * k, y2 + 0.3 * k, x2 + 3.3 * k, y2 - 3.1 * k, col, F);   // the neck
      P.tri(x2 + 3.3 * k, y2 - 3.1 * k, x2 + 2.8 * k, y2 - 2.6 * k, x2 + 4.2 * k, y2 - 2.3 * k, shade, F);   // the head
      P.tri(x2 - 1.5 * k, y2 - 0.4 * k, x2 + 1.5 * k, y2 - 0.4 * k, x2 + 0.1 * k, y2 + 1.1 * k, col, F);   // the body
      P.seg(x2 - 1.5 * k, y2 - 0.4 * k, x2 + 0.1 * k, y2 + 1.1 * k, 0.25 * k, shade, 0.6 * F);   // its fold
      P.tri(x2 - 0.7 * k, y2 - 0.4 * k, x2 + 1.2 * k, y2 - 0.4 * k, x2 + 0.5 * k + flap * 0.3 * k, y2 - (2.5 + 1.2 * flap) * k, c[0], F);   // the near wing, in the light
    } },
    // SANDS OF TIME: sand pours into a pile at each print and the wind takes it; an hourglass flips over the trail
    sands: { life: 1.8, k: 1.6, draw: function (P, p, q, a, F, s, now, c) {
      if (p.i % 2) return false;
      var pile = Math.min(1, a * 2.4), blow = Math.max(0, (a - 0.55) / 0.45), x = p.x, y = p.y, bx = q ? (q.x - p.x) : -1, by = q ? (q.y - p.y) : 0, bl = Math.hypot(bx, by) || 1;
      bx /= bl; by /= bl;
      if (blow < 1) { var hw = (1.6 + 2.8 * pile) * s * (1 - blow), hh = (0.8 + 2.2 * pile) * s * (1 - blow);
        P.tri(x - hw, y, x + hw, y, x + bx * blow * 2 * s, y - hh, c[1], F); P.tri(x - hw * 0.4, y - hh * 0.2, x + hw * 0.3, y - hh * 0.2, x + bx * blow * 2 * s, y - hh, c[0], F); }
      if (pile < 1) for (var k = 0; k < 3; k++) { var ph = (now / 380 + k / 3 + hV177F(p.i, k)) % 1, gy = y - 8 * s * (1 - ph); P.rect(x + (hV177F(p.i, 9 + k) - 0.5) * 0.8 * s, gy, 0.55 * s, 0.55 * s, c[k % 2 ? 0 : 3], F); }
      if (blow > 0) for (var j = 0; j < 4; j++) { var t = blow + hV177F(p.i, 20 + j) * 0.3, d = t * (5 + 4 * hV177F(p.i, 30 + j)) * s; P.rect(x + bx * d + Math.sin(now / 200 + j) * 0.6 * s, y - (0.6 + 2.2 * hV177F(p.i, 40 + j)) * s * (1 - t * 0.4) + by * d, 0.55 * s, 0.55 * s, c[j % 3], F * (1 - blow)); }
      if (p.i % 10 === 4) {   // the hourglass: two glass cones in a frame, the sand moving between them; it flips
        var hx = x, hy = y - 8.5 * s - Math.sin(now / 500 + p.i) * 0.8 * s, u = 1.5 * s, flip = Math.floor(now / 1400 + p.i) % 2, lvl = (now % 1400) / 1400;
        P.rect(hx - 1.6 * u, hy - 2.4 * u, 3.2 * u, 0.5 * u, c[4], F); P.rect(hx - 1.6 * u, hy + 1.9 * u, 3.2 * u, 0.5 * u, c[4], F);
        P.tri(hx - 1.2 * u, hy - 1.9 * u, hx + 1.2 * u, hy - 1.9 * u, hx, hy, c[3], 0.55 * F); P.tri(hx - 1.2 * u, hy + 1.9 * u, hx + 1.2 * u, hy + 1.9 * u, hx, hy, c[3], 0.55 * F);
        var top = flip ? 1 - lvl : lvl, f1 = 1 - top, f2 = top;   // how much sand is up, how much down
        if (f1 > 0.05) P.tri(hx - 1.1 * u * f1, hy - 0.2 * u - 1.6 * u * f1, hx + 1.1 * u * f1, hy - 0.2 * u - 1.6 * u * f1, hx, hy - 0.1 * u, c[1], F);
        if (f2 > 0.05) P.tri(hx - 1.1 * u, hy + 1.85 * u, hx + 1.1 * u, hy + 1.85 * u, hx, hy + 1.85 * u - 1.5 * u * f2, c[1], F);
        P.rect(hx - 0.15 * u, hy - 0.1 * u, 0.3 * u, 1.9 * u * (f1 > 0.05 ? 1 : 0), c[0], 0.9 * F);
      }
    } },
    // CONSTELLATION: stars light at his steps and the lines of a constellation draw between them
    constellation: { life: 2.1, k: 1.6, draw: function (P, p, q, a, F, s, now, c, head) {
      if (head) STAR_V177F.last = null;
      if (p.i % 3) return false;
      var big = p.i % 9 === 0, tw = 0.6 + 0.4 * Math.sin(now / 110 + p.i * 1.9), x = p.x + (hV177F(p.i, 1) - 0.5) * 6 * s, y = p.y - (2.5 + hV177F(p.i, 2) * 9) * s - a * 3 * s, L = STAR_V177F.last;
      if (L && Math.abs(L.x - x) + Math.abs(L.y - y) < 30 * s) {   // the line draws itself from the older star toward the newer one
        var dr = Math.min(1, a * 3.5 + 0.15), ex = x + (L.x - x) * dr, ey = y + (L.y - y) * dr;
        P.seg(x, y, ex, ey, 0.9 * s, c[3], 0.35 * F); P.seg(x, y, ex, ey, 0.45 * s, c[1], 0.8 * F);
        var mx = (x + ex) / 2, my = (y + ey) / 2; P.rect(mx - 0.25 * s, my - 0.25 * s, 0.5 * s, 0.5 * s, c[0], 0.6 * F);
      }
      P.circ(x, y, (big ? 3.2 : 2) * s, c[3], 0.3 * F * tw);
      var arm = (big ? 3 : 1.9) * s * (0.7 + 0.3 * tw);
      P.rect(x - arm, y - 0.22 * s, arm * 2, 0.44 * s, c[big ? 2 : 0], F * tw); P.rect(x - 0.22 * s, y - arm, 0.44 * s, arm * 2, c[big ? 2 : 0], F * tw);
      P.circ(x, y, (big ? 0.9 : 0.65) * s, c[0], F);
      STAR_V177F.last = { x: x, y: y };
    } },
    // LIQUID CHROME: mercury beads that splash when they land, wobble as they settle, and pull a bridge to the last bead
    chrome: { life: 1.5, k: 1.5, draw: function (P, p, q, a, F, s, now, c) {
      if (p.i % 2) return false;
      var x = p.x, y = p.y - 0.6 * s, wob = Math.sin(now / 60 + p.i) * Math.max(0, 0.5 - a) * 0.9, R = (2 + 1.2 * hV177F(p.i, 1)) * s * (a > 0.8 ? (1 - a) / 0.2 : 1), rx = R * (1.25 + wob * 0.4), ry = R * (0.75 - wob * 0.3);
      if (q && a < 0.5 && nearV157B(p, q, s)) { var qq = q; P.seg(qq.x, qq.y - 0.6 * s, x, y, R * (1 - a * 2) * 0.9, c[2], 0.9 * F); P.seg(qq.x, qq.y - 0.9 * s, x, y - 0.3 * s, R * (1 - a * 2) * 0.35, c[1], 0.8 * F); }
      if (a < 0.16) { var sp = a / 0.16; P.ellS(x, y + 0.2 * s, (1 + sp * 4) * s, (0.5 + sp * 1.6) * s, 0.45 * s, c[1], 1 - sp);   // the splash
        for (var k = 0; k < 4; k++) { var an = Math.PI + (k + 0.5) * Math.PI / 4, d = sp * 4 * s; P.circ(x + Math.cos(an) * d * 1.3, y + Math.sin(an) * d * 1.2, 0.5 * s * (1 - sp * 0.5), c[1], 1 - sp); } }
      if (R < 0.1) return;
      P.ell(x, y + ry * 0.35, rx, ry * 0.8, c[3], F);   // the shadowed underside
      P.ell(x, y, rx, ry, c[2], F);
      P.ell(x, y - ry * 0.2, rx * 0.8, ry * 0.6, c[1], F);
      P.ell(x, y + ry * 0.55, rx * 0.65, ry * 0.22, c[4], 0.7 * F);   // the turf's reflection
      P.ell(x - rx * 0.35, y - ry * 0.45, rx * 0.32, ry * 0.22, c[0], F);   // the highlight
    } }
  };
  /* registered with v157 B's trails, drawn `k` × bigger (TU v177FtrailScale): a footprint has to read at broadcast size */
  Object.keys(FX_V177F).forEach(function (k) { var D = FX_V177F[k];
    TFX_V157B[k] = { life: D.life, draw: function (P, p, q, a, F, s, now, c, head) { try { return D.draw(P, p, q, a, F, s * D.k * TUv("v177FtrailScale", 1), now, c, head); } catch (e) { errV177F(e); return false; } } }; });
  // the kill switch: a v177 F footprint draws as its base v153 G kind (v157 B's own switch already does this for all)
  var trailDraw0V177F = trailDrawV153G, trailLife0V177F = trailLifeV157B;
  trailDrawV153G = function (A, pts, now, life, d, s) {
    if (d && d.fx && FX_V177F[d.fx] && !onV177F()) d = d._baseV177F || (d._baseV177F = { kind: d.kind, col: d.col });
    return trailDraw0V177F(A, pts, now, life, d, s);
  };
  trailLifeV157B = function (td) { return td && td.fx && FX_V177F[td.fx] && !onV177F() ? 1 : trailLife0V177F(td); };

  /* ---- the ten new SUPER CHALLENGES (each pays a v177 G wing + a v177 F footprint) ---- */
  var SUPER_V177F = [
    { id: "tds200", item: "wings_koi", also: "trail_ink", name: "Two Hundred", icon: "💯", goal: function () { return TUv("superTdsV177F", 200); }, desc: function () { return "Score " + TUv("superTdsV177F", 200) + " touchdowns in one career"; }, acct: function (A) { return A.bestTds; } },
    { id: "mvp5", item: "wings_aurora", also: "trail_constellation", name: "Five-Time MVP", icon: "🌌", goal: function () { return TUv("superMvpsV177F", 5); }, desc: function () { return "Be named League MVP (college or higher) " + TUv("superMvpsV177F", 5) + " times across your careers"; }, acct: function (A) { return A.leagueMvps; } },
    { id: "isl5", item: "wings_peacock", also: "trail_bloom", name: "Interstellar Dynasty", icon: "🚀", goal: function () { return TUv("superIslV177F", 5); }, desc: function () { return "Win " + TUv("superIslV177F", 5) + " Interstellar championships across your careers"; }, acct: function (A) { return A.interstellarTitles; } },
    { id: "hof10", item: "wings_sunburst", also: "trail_film", name: "Hall of Ten", icon: "🏛", goal: function () { return TUv("superHofV177F", 10); }, desc: function () { return "Enshrine " + TUv("superHofV177F", 10) + " careers that made the UFF in the Hall of Fame"; }, acct: function (A) { return A.hofWon; } },
    { id: "chal100", item: "wings_neon", also: "trail_datamosh", name: "Hundred Challenges", icon: "✅", goal: function () { return TUv("superChalV177F", 100); }, desc: function () { return "Complete " + TUv("superChalV177F", 100) + " season challenges"; }, acct: function () { try { var T = window.RIB_SEASONS && window.RIB_SEASONS.challengeTotals && window.RIB_SEASONS.challengeTotals(); return T ? T.total : 0; } catch (e) { return 0; } } },
    { id: "gen8", item: "wings_blades", also: "trail_cranes", name: "Eighth Generation", icon: "🌳", goal: function () { return TUv("superGenV177F", 8); }, desc: function () { return "Play as the " + TUv("superGenV177F", 8) + "th generation of your family"; }, acct: function (A) { return A.gen; } },
    { id: "titles40", item: "wings_maple", also: "trail_frostbite", name: "Forty Titles", icon: "🍂", goal: function () { return TUv("superTitlesV177F", 40); }, desc: function () { return "Win " + TUv("superTitlesV177F", 40) + " championships at any level"; }, acct: function (A) { return A.titles; } },
    { id: "awards150", item: "wings_quetzal", also: "trail_sands", name: "Trophy Room", icon: "🎖", goal: function () { return TUv("superAwardsV177F", 150); }, desc: function () { return "Collect " + TUv("superAwardsV177F", 150) + " season awards across your careers"; }, acct: function (A) { return A.awards; } },
    { id: "legacy400", item: "wings_magma", also: "trail_chrome", name: "Forged in Legacy", icon: "🔥", goal: function () { return TUv("superLegacyV177F", 400); }, desc: function () { return "Reach Legacy medal " + TUv("superLegacyV177F", 400); }, acct: function (A) { return A.legacyMedal; } },
    { id: "careers30", item: "wings_bass", also: "trail_gravity", name: "Thirty Careers", icon: "🔁", goal: function () { return TUv("superCareersV177F", 30); }, desc: function () { return "Finish " + TUv("superCareersV177F", 30) + " careers"; }, acct: function (A, st) { return st ? st.careersCompleted | 0 : 0; } }
  ];
  /* the catalogue: added here (not at the top of the file) — the same packs / preview wiring ITEMS.forEach gives */
  itemsV177F().concat(itemsV177G()).forEach(function (it) { if (BY[it.id]) return; it.packs = []; it.preview = function (el) { return previewInto(el, it); }; ITEMS.push(it); BY[it.id] = it; });
  SUPER_V177F.forEach(function (c) { if (!SUPER_V156C.some(function (x) { return x.id === c.id; })) { SUPER_V156C.push(c); SUPER_IDS_V156C.push(c.item, c.also); } });
  // v156 C's wrappers: the scan learns the account-wide counts, a finished challenge pays its pair, the rows name both
  var superScan0V177F = superScanV156C;
  superScanV156C = function (st) {
    var ch = superScan0V177F(st);
    try { var S = sload(), A = account(st); SUPER_V177F.forEach(function (c) { var v = Math.floor(+c.acct(A, st) || 0); if (v > (S.best[c.id] | 0)) { S.best[c.id] = v; ch = true; } }); } catch (e) { errV177F(e); }
    return ch;
  };
  var superTick0V177F = superTickV156C;
  superTickV156C = function (st) {
    var got = superTick0V177F(st);
    try { if (cosOnV156C()) { var S = sload(); SUPER_V177F.forEach(function (c) { if (S.done[c.id] && !owned(c.also)) { grant(c.also, "super"); got.push(c.also); } }); } } catch (e) { errV177F(e); }
    return got;
  };
  var superProg0V177F = superProgressV156C;
  superProgressV156C = function () {
    return superProg0V177F().map(function (r) {
      var c = SUPER_V177F.filter(function (x) { return x.id === r.id; })[0]; if (!c) return r;
      var b = BY[c.also] || {}; r.itemName = r.itemName + " + " + (b.name || c.also); r.items = [c.item, c.also]; r.owned = owned(c.item) && owned(c.also); return r;
    });
  };
  var superDesc0V177F = superDescV156C;
  superDescV156C = function (itemId) { var c = SUPER_V177F.filter(function (x) { return x.also === itemId; })[0]; return c ? c.desc() : superDesc0V177F(itemId); };
  window.RIB_SUPER.tick = superTickV156C; window.RIB_SUPER.progress = superProgressV156C;
  window.__V156C.superTick = superTickV156C; window.__V156C.superProgress = superProgressV156C;
  Object.assign(G177F, {
    on: onV177F, ids: function () { return itemsV177F().map(function (i) { return i.id; }); }, kinds: function () { return Object.keys(FX_V177F); },
    challenges: function () { return SUPER_V177F.map(function (c) { return { id: c.id, wings: c.item, trail: c.also, name: c.name, goal: c.goal() }; }); },
    sample: function (id, t) { return sampleV157B(id, t); }
  });

  /* ===== v177 G TEN NEW WINGS =====
   * The owner: "Add 10 more wings, super status."
   * Ten new kinds drawn from code (`WINGS_V177G`, registered into v157 A's `WINGS_V157A`: the RIGHT wing, shoulder at
   * (0, ay), mirrored for the left), each its own silhouette and its own motion — a koi pond (two koi swim a loop through
   * the rippling water), an aurora veil (curtains of light that ripple), a peacock train (eyespot feathers that shimmer),
   * an art deco sunburst (a glint runs the rays), a neon sign (tubes with a glow that buzz and flicker), a fan of
   * katanas (a glint runs each blade), an autumn maple branch (a leaf falls), a quetzal's jade train with a gold
   * step-fret band (a sheen), magma glass (obsidian shards, the lava in the cracks pulsing out from the shoulder) and a
   * bass-drop equalizer (LED bars that bounce, peak caps). Up to six frames each (`frames` × `ms`, a pure function of the
   * clock via v157 A's `wingFrameV157A`, which the field, the card and the Locker all ask); v159 D's flutter family per
   * kind (`FAM_V159D`). All mythic SUPER looks, paid by v177 F's super challenges (each pays one wing + one footprint).
   * Kill switch TU("v177Gwings", 0): the new wings hold their first frame (no motion of their own; the flap stays). */
  function onV177G() { return !!TUv("v177Gwings", 1); }
  var G177G = (window.__V177G = window.__V177G || { errs: [] });
  function itemsV177G() {
    var W = function (id, name, kind, col) { return { id: id, cat: "wings", name: name, rarity: "mythic", source: "super", w: { kind: kind, col: col } }; };
    return [
      W("wings_koi", "Koi Pond", "koi", ["#174f9a", "#6fd3ff", "#ff7a1a"]),
      W("wings_aurora", "Aurora Veil", "aurora", ["#3fffb0", "#2fd3ff", "#b06bff"]),
      W("wings_peacock", "Peacock Train", "peacock", ["#1fa38a", "#1f5fd8", "#e6b53a"]),
      W("wings_sunburst", "Art Deco Sunburst", "sunburst", ["#ffd76f", "#15171d", "#a8761e"]),
      W("wings_neon", "Neon Sign", "neon", ["#ff3df2", "#6ff7ff", "#ffffff"]),
      W("wings_blades", "Thousand Blades", "blades", ["#eef2f8", "#8a96a8", "#e6b53a"]),
      W("wings_maple", "Autumn Maple", "maple", ["#e8401a", "#ffb02e", "#4a2a14"]),
      W("wings_quetzal", "Quetzal", "quetzal", ["#18b45e", "#2fd3ff", "#ffd76f"]),
      W("wings_magma", "Magma Glass", "magma", ["#1c1626", "#ff6a1a", "#ffe14d"]),
      W("wings_bass", "Bass Drop", "bass", ["#39ff6a", "#ffe14d", "#ff3df2"])
    ];
  }
  // a maple leaf from a 9x9 pixel map (pointing up), turned by `rot` and scaled to radius r: vein down the middle, lit left
  var MAPLE_V177G = ["....X....", "...XXX...", "X..XXX..X", "XX.XXX.XX", ".XXXXXXX.", "..XXXXX..", ".XXXXXXX.", "....X....", "....X...."];
  function mapleLeafV177G(R, cx, cy, r, rot, col, vein) {
    var sc = r / 4.5, ca = Math.cos(rot), sa = Math.sin(rot);
    for (var y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (var x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      var dx = (x + 0.5 - cx) / sc, dy = (y + 0.5 - cy) / sc, u = dx * ca + dy * sa + 4.5, v = -dx * sa + dy * ca + 4.5, mx = Math.floor(u), my = Math.floor(v);
      if (mx < 0 || my < 0 || mx > 8 || my > 8 || MAPLE_V177G[my].charAt(mx) !== "X") continue;
      R.put(x, y, mx === 4 && my > 1 ? vein : mx < 4 ? light(col, 0.14) : my > 5 ? dark(col, 0.15) : col);
    }
  }
  var WINGS_V177G = {
    // KOI POND: a flowing fin of water — ripples spread from the shoulder, two koi swim a loop through it
    koi: { W: 22, H: 20, ay: 7, frames: 4, ms: 260, fam: "ether", draw: function (R, a, b, e, fr) {
      var P = [[0, 5], [6, 1.5], [14, 0], [21.5, 1.5], [19, 6], [21.5, 10], [16, 12], [17.5, 17], [11.5, 15], [8.5, 19.5], [5, 14], [0, 11]], foam = [236, 250, 255];
      polyV157A(R, P, function (x, y) { var d = edgeDistV157A(P, x + 0.5, y + 0.5), r = Math.hypot(x - 1, y - 8), t = Math.min(1, r / 19), c = mix(a, b, t * 0.8);
        if (((r - fr * 1.1) % 4.4 + 4.4) % 4.4 < 0.75 && d > 1.3) c = light(c, 0.28);
        if (d < 1.05) c = mix(b, foam, 0.6); else if (d < 2) c = light(c, 0.12);
        return c; });
      var fish = function (u, body, spot, len) {
        var cx = 11 + Math.cos(u) * 5.2, cy = 8.5 + Math.sin(u) * 3.6, vx = -Math.sin(u) * 5.2, vy = Math.cos(u) * 3.6, L = Math.hypot(vx, vy); vx /= L; vy /= L;
        for (var k = -len; k <= 2; k++) { var px = cx + vx * k, py = cy + vy * k, w = k >= 1 ? 0.4 : k <= -len + 1 ? 0 : 0.9;
          R.put(px, py, (k + len) % 3 === 1 ? spot : body); if (w > 0.5) { R.put(px - vy, py + vx, body); R.put(px + vy, py - vx, (k % 2) ? spot : body); } }
        var tx = cx - vx * (len + 1), ty = cy - vy * (len + 1), fl = (fr % 2) ? 1 : -1;   // the tail, flicking
        R.put(tx - vy * fl, ty + vx * fl, body, 0.9); R.put(tx + vy * 1.2 * fl, ty - vx * 1.2 * fl, light(body, 0.3), 0.8);
        R.put(cx + vx * 2 + vy * 0.5, cy + vy * 2 - vx * 0.5, [20, 20, 30]);   // the eye
      };
      fish(fr / 4 * TAU_V177F, e, [255, 250, 240], 3);
      fish(fr / 4 * TAU_V177F + Math.PI, [255, 250, 240], e, 2);
      R.put(19, 3, foam); R.put(14, 13, foam, 0.8);
      R.outline(dark(a, 0.45), 0.85); } },
    // AURORA VEIL: curtains of light hung from a glowing arm — green at the hem, violet at the top, rippling
    aurora: { W: 22, H: 22, ay: 6, frames: 4, ms: 210, fam: "ether", draw: function (R, a, b, e, fr) {
      var top = function (x) { return 6 - 5.5 * Math.sin(Math.min(1, x / 14) * Math.PI / 2) + Math.max(0, x - 14) * 0.3; };
      for (var x = 0; x < 22; x++) {
        var y0 = Math.round(top(x)), L = Math.round(8 + 8 * Math.sin(x / 21 * Math.PI * 0.95 + 0.25) + 1.8 * Math.sin(x * 1.1 + fr * TAU_V177F / 4)), br = 0.5 + 0.5 * Math.sin(x * 0.85 - fr * TAU_V177F / 4);
        for (var y = y0; y <= y0 + L; y++) {
          var t = (y - y0) / Math.max(1, L), c = t < 0.25 ? mix(e, b, t / 0.25) : t < 0.6 ? mix(b, a, (t - 0.25) / 0.35) : a;
          c = light(c, br * 0.3); if ((x + fr) % 3 === 0) c = light(c, 0.22);
          R.put(x, y, c, t > 0.68 ? 0.25 + 0.7 * (1 - t) / 0.32 : 0.95);
        }
        R.put(x, y0 - 1, light(e, 0.55), 0.9);
      }
      [[6, 0], [17, 0], [11, 1]].forEach(function (st, k) { if ((fr + k) % 2 === 0) R.put(st[0], st[1], WHITE_V157A); });
    } },
    // PEACOCK TRAIN: a fan of long feathers, each a fine shaft with a fringe of barbs and an eyespot that shimmers
    peacock: { W: 24, H: 25, ay: 12, frames: 2, ms: 320, fam: "feather", draw: function (R, a, b, e, fr) {
      var navy = [14, 20, 66], bronze = mix(e, [120, 60, 20], 0.45), sh = fr ? 0.2 : 0;
      var eye = function (ex, ey, ca, sa, rr, lit) {
        for (var yy = Math.floor(ey - rr - 1); yy <= ey + rr + 1; yy++) for (var xx = Math.floor(ex - rr - 1); xx <= ex + rr + 1; xx++) {
          var dx = xx + 0.5 - ex, dy = yy + 0.5 - ey, u = dx * ca + dy * sa, vv = -dx * sa + dy * ca, r = Math.hypot(u / 1.3, vv) / rr;
          if (r > 1) continue;
          R.put(xx, yy, r < 0.3 ? navy : r < 0.55 ? light(b, sh * 1.5) : r < 0.78 ? bronze : light(a, 0.22 + sh));
        }
        if (lit) R.put(ex - 0.5, ey - 0.8, light(b, 0.7));
      };
      var feather = function (ang, L, rr, k, under) {
        var ca = Math.cos(ang), sa = Math.sin(ang);
        for (var t = 1; t <= L - rr; t += 0.5) { var x = ca * t * 1.2, y = 12 + sa * t * 0.72, w = 0.35 + t / L * 1.25;
          R.put(x, y, light(e, 0.1));
          for (var v = 0.5; v <= w; v += 0.5) { var c = mix(light(a, sh * 0.6), dark(a, under ? 0.45 : 0.2), v / 1.6); if ((((t * 2) | 0) + k) % 3 === 0) c = light(c, 0.18); R.put(x - sa * v, y + ca * v, c, 0.9); R.put(x + sa * v, y - ca * v, c, 0.9); } }
        eye(ca * (L - rr * 0.8) * 1.2, 12 + sa * (L - rr * 0.8) * 0.72, ca, sa, rr, (k + fr) % 2 === 0);
      };
      [-0.85, -0.45, -0.05, 0.35, 0.75].forEach(function (an, k) { feather(an, 11, 1.9, k, true); });   // the short under-row, between
      [-1.05, -0.65, -0.25, 0.15, 0.55, 0.95].forEach(function (an, k) { feather(an, 17.5 - Math.abs(an + 0.05) * 2, 2.6, k, false); });
      R.outline(dark(a, 0.62), 0.85); } },
    // ART DECO SUNBURST: a stepped ziggurat of gold and black rays round a sunrise disc — a glint runs out along them
    sunburst: { W: 23, H: 23, ay: 11, frames: 6, ms: 140, fam: "mech", draw: function (R, a, b, e, fr) {
      var N = 11, A0 = -1.4, A1 = 1.15, step = (A1 - A0) / N, glintRay = (fr * 2) % N;
      var rayLen = function (ri) { var mid = A0 + (ri + 0.5) * step, d = Math.abs(mid + 0.62) / 1.8; return Math.round((21.5 - 10 * d * d) * 2) / 2; };
      for (var y = 0; y < 23; y++) for (var x = 0; x < 23; x++) {
        var dx = x + 0.5, dy = y + 0.5 - 11, r = Math.hypot(dx, dy), an = Math.atan2(dy, dx); if (an < A0 || an > A1) continue;
        var ri = Math.min(N - 1, Math.floor((an - A0) / step)), L = rayLen(ri), c;
        if (r > L) continue;
        if (r < 2.4) c = light(a, 0.6); else if (r < 3.5) c = a; else if (r < 4.4) c = b; else if (r < 5.3) c = e;
        else if (ri % 2) c = r > L - 1.6 ? e : b;
        else { c = ri === glintRay && r > 6 ? light(a, 0.55) : r > L - 1.6 ? e : r > L - 3.2 ? light(a, 0.18) : a; if (Math.abs(r - 8.5) < 0.5 || Math.abs(r - 13) < 0.5) c = dark(a, 0.25); }   // the engraved bands
        R.put(x, y, c);
      }
      R.outline(dark(b, 0.3)); } },
    // NEON SIGN: a wing in glass tubing — a pink outline, cyan feather lines, a glow, a buzz; one line flickers out
    neon: { W: 23, H: 21, ay: 7, frames: 4, ms: 150, fam: "ether", draw: function (R, a, b, e, fr) {
      var outer = [[0, 7], [8, 2], [21, 0], [19, 6], [15, 7], [16.5, 12], [11, 12], [10.5, 17.5], [5, 14], [0, 11]], inner = [[[5, 6], [15, 6.5]], [[4, 9], [11, 11.5]], [[3, 11], [5.5, 14]]];
      var tube = function (x0, y0, x1, y1, col, alpha, glow) { var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 | 0;
        for (var k = 0; k <= n; k++) { var t = k / Math.max(1, n), x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
          if (glow) { for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) if ((ox || oy) && !R.has(Math.round(x + ox), Math.round(y + oy))) R.put(x + ox, y + oy, col, 0.3 * alpha); }
          else R.put(x, y, light(col, 0.45), alpha); } };
      var lines = []; for (var i = 0; i < outer.length - 1; i++) lines.push([outer[i], outer[i + 1], a]);
      inner.forEach(function (l, k) { lines.push([l[0], l[1], b, k === 1 && fr === 2 ? 0.18 : fr === 3 ? 0.7 : 1]); });
      lines.forEach(function (l) { tube(l[0][0], l[0][1], l[1][0], l[1][1], l[2], l[3] == null ? 1 : l[3], true); });
      lines.forEach(function (l) { tube(l[0][0], l[0][1], l[1][0], l[1][1], l[2], l[3] == null ? (fr === 1 ? 0.85 : 1) : l[3], false); });
      [[8, 2], [21, 0], [10.5, 17.5]].forEach(function (p) { R.put(p[0], p[1] + 1, [140, 148, 160]); });   // the mounting clips
    } },
    // THOUSAND BLADES: six katanas fanned from the shoulder — wrapped hilts, gold guards, curved steel; a glint runs each
    blades: { W: 24, H: 22, ay: 8, frames: 6, ms: 130, fam: "mech", draw: function (R, a, b, e, fr) {
      var wrap = [36, 26, 30], wrapL = [120, 30, 44];
      [[1.0, 13], [0.68, 16], [0.36, 18.5], [0.04, 20.5], [-0.28, 19.5], [-0.6, 16]].forEach(function (f, k) {
        var ca = Math.cos(f[0]), sa = Math.sin(f[0]), L = f[1], gl = (fr + k) % 6;
        for (var t = 0; t <= L; t += 0.5) {
          var cur = t > 4 ? 0.016 * (t - 4) * (t - 4) : 0, x = ca * t + sa * cur, y = 8 + sa * t - ca * cur;
          if (t < 3.5) { R.put(x, y, ((t * 2) | 0) % 2 ? wrapL : wrap); continue; }
          if (t < 4.5) { R.put(x - sa, y + ca, e); R.put(x, y, light(e, 0.3)); R.put(x + sa, y - ca, dark(e, 0.25)); continue; }   // the tsuba
          var near = Math.abs(t - (5 + gl * (L - 5) / 5)) < 1.2;
          R.put(x, y, near ? WHITE_V157A : a); R.put(x + sa * 0.9, y - ca * 0.9, near ? light(b, 0.5) : b);
          if (((t * 2) | 0) % 5 === 2) R.put(x, y, light(a, 0.6));   // the hamon's wave catches the light
        }
      });
      R.outline([14, 16, 22]); } },
    // AUTUMN MAPLE: a fine branch along the arm, six maple leaves in fall colours; one has come loose and falls
    maple: { W: 24, H: 27, ay: 7, frames: 6, ms: 200, fam: "feather", draw: function (R, a, b, e, fr) {
      var br = function (x) { return 7 - 5 * Math.sin(Math.min(1, x / 16) * Math.PI / 2) + Math.max(0, x - 16) * 0.2; };
      for (var x = 0; x <= 21; x++) R.put(x, br(x), x < 7 ? e : light(e, 0.12));
      [[19.5, 4, 4.2, 0.9, 0.85], [15.5, 9.5, 4.6, 1.3, 0.6], [9.5, 2.8, 3.8, 0.5, 1], [10.5, 12.5, 4.8, 2.2, 0.3], [4.5, 12.5, 4.2, 2.9, 0.0], [16.5, 16, 3.8, 1.9, 0.15]].forEach(function (L) {
        var sx = Math.min(20, L[0] - 1), sy = br(sx); lnV157A(R, sx, sy, L[0], L[1], dark(e, 0.1));
        mapleLeafV177G(R, L[0], L[1], L[2], L[3], mix(a, b, L[4]), dark(mix(a, b, L[4]), 0.4));
      });
      var fx = 12 + Math.sin(fr * 1.1) * 2.4, fy = 19 + fr * 0.9;
      mapleLeafV177G(R, fx, fy, 2.8, fr * 0.9 + 0.4, mix(a, b, 0.5), dark(a, 0.3));
      R.outline(dark(e, 0.45), 0.85); } },
    // QUETZAL: a sweeping train of jade feathers tipped in turquoise, a gold band of step-fret at the shoulder
    quetzal: { W: 24, H: 23, ay: 8, frames: 2, ms: 360, fam: "feather", draw: function (R, a, b, e, fr) {
      var red = [200, 32, 58];
      [[-0.55, 19], [-0.22, 21], [0.12, 22], [0.45, 20], [0.8, 16]].forEach(function (f, k) {
        for (var t = 0; t <= f[1]; t += 0.5) { var rt = t / f[1], an = f[0] + rt * rt * 0.55, x = Math.cos(f[0]) * t + Math.cos(an) * 0, y = 8 + Math.sin(f[0]) * t + rt * rt * 3.5, w = (1 - rt * 0.7) * 1.7;
          var base = rt < 0.55 ? a : mix(a, b, (rt - 0.55) / 0.45);
          for (var v = -w; v <= w; v += 0.5) { var c = Math.abs(v) < 0.45 ? light(base, 0.35) : (fr && Math.abs(v - 0.5) < 0.5 && rt > 0.25 + k * 0.1 && rt < 0.45 + k * 0.1) ? light(base, 0.45) : v > 0 ? dark(base, 0.22) : base;
            R.put(x - Math.sin(f[0]) * v, y + Math.cos(f[0]) * v, c); } }
      });
      for (var y2 = 2; y2 <= 14; y2++) for (var x2 = 0; x2 <= 6; x2++) {   // the band: a curved gold collar with the step-fret
        var r = Math.hypot(x2 + 0.5, y2 + 0.5 - 8); if (r < 3.5 || r > 6.2) continue;
        var g = ((x2 + y2) % 4 < 2) !== (((r * 1.6) | 0) % 2 === 0); R.put(x2, y2, r > 5.5 || r < 4 ? dark(e, 0.35) : g ? e : dark(e, 0.45));
      }
      R.put(1, 8, red); R.put(1, 9, red); R.put(2, 8, light(red, 0.3));
      R.outline(dark(a, 0.6), 0.9); } },
    // MAGMA GLASS: obsidian shards with a purple sheen, set in cracks of lava that pulse out from the shoulder
    magma: { W: 22, H: 21, ay: 8, frames: 4, ms: 190, fam: "bone", draw: function (R, a, b, e, fr) {
      var P = [[0, 6], [7, 1], [12, 2.5], [21.5, 0], [18, 6], [21.5, 9.5], [15, 12], [17.5, 17.5], [11, 15], [8.5, 20.5], [5, 14], [0, 11]];
      var seeds = [[3, 8], [8, 4], [14, 3], [19, 2], [10, 9], [17, 8], [6, 13], [13, 13], [9, 18], [16, 15], [2, 11]], sheen = mix(a, [150, 110, 220], 0.45);
      polyV157A(R, P, function (x, y) {
        var d1 = 1e9, d2 = 1e9, idx = 0; seeds.forEach(function (s0, i) { var d = Math.hypot(x + 0.5 - s0[0], y + 0.5 - s0[1]); if (d < d1) { d2 = d1; d1 = d; idx = i; } else if (d < d2) d2 = d; });
        var crack = d2 - d1 < 0.95, ed = edgeDistV157A(P, x + 0.5, y + 0.5);
        if (crack) { var pu = 0.5 + 0.5 * Math.sin(Math.hypot(x, y - 8) * 0.75 - fr * TAU_V177F / 4); return mix(b, e, pu * 0.85); }
        if (ed < 1) return dark(a, 0.2);
        var s0 = seeds[idx], toward = (s0[0] - x) + (s0[1] - y);
        return toward > 1.8 && toward < 3 ? sheen : ((x - y + idx) % 7 === 0 ? light(a, 0.12) : a);
      });
      R.outline(mix(b, [40, 8, 4], 0.6), 0.85); } },
    // BASS DROP: an equalizer hung from a chrome arm — LED columns drop and bounce to the beat, white peak caps hold
    bass: { W: 22, H: 22, ay: 6, frames: 6, ms: 110, fam: "mech", draw: function (R, a, b, e, fr) {
      var arm = function (x) { return 6 - 5 * Math.sin(Math.min(1, x / 15) * Math.PI / 2) + Math.max(0, x - 15) * 0.25; };
      var lvl = function (k, f) { var j = ihV153G(((k + 1) * 977 + (f + 6) * 131) >>> 0); return Math.max(0.25, Math.min(1, 0.35 + j * 0.75)); };
      for (var k = 0; k < 7; k++) {
        var x0 = 1 + k * 3, top = Math.round(arm(x0 + 0.5)) + 2, nb = Math.round(4 + 5.5 * Math.sin((k + 0.9) / 7.6 * Math.PI)), on = Math.max(1, Math.round(lvl(k, fr) * nb)), peak = Math.min(nb - 1, Math.max(on, Math.round(lvl(k, (fr + 5) % 6) * nb)));
        for (var bk = 0; bk < nb; bk++) {
          var y = top + bk * 2, f = bk / Math.max(1, nb - 1), col = f < 0.45 ? a : f < 0.75 ? b : e;
          if (bk < on) { R.put(x0, y, light(col, 0.35)); R.put(x0 + 1, y, col); }
          else if (bk === peak) { R.put(x0, y, WHITE_V157A); R.put(x0 + 1, y, WHITE_V157A); }
          else { R.put(x0, y, dark(col, 0.72), 0.55); R.put(x0 + 1, y, dark(col, 0.72), 0.55); }
        }
      }
      for (var x = 0; x <= 21; x++) { var ya = Math.round(arm(x)); R.put(x, ya, [226, 232, 242]); R.put(x, ya + 1, [118, 126, 140]); }
      for (var y2 = 3; y2 <= 10; y2++) for (var x2 = 0; x2 <= 4; x2++) { var r = Math.hypot(x2 + 0.5, y2 + 0.5 - 6.5); if (r > 3.6) continue; R.put(x2, y2, r < 1.1 ? [210, 216, 226] : r < 2.4 ? ((fr % 2) ? [60, 64, 74] : [34, 38, 46]) : [96, 102, 116]); }   // the speaker cone, thumping
      R.outline([10, 10, 16], 0.6); } }
  };
  Object.keys(WINGS_V177G).forEach(function (k) { WINGS_V157A[k] = WINGS_V177G[k]; FAM_V159D[k] = WINGS_V177G[k].fam; });
  // their frames: the field, the card and the Locker all ask v157 A's `wingFrameV157A` (v159 D's asks it too)
  var wingFrame0V177G = wingFrameV157A;
  wingFrameV157A = function (kind, now) {
    var D = WINGS_V177G[kind];
    if (D) return D.frames > 1 && onV177G() && !reducedV157A() ? Math.floor(Math.abs(now) / D.ms) % D.frames : 0;
    return wingFrame0V177G(kind, now);
  };
  Object.assign(G177G, {
    on: onV177G, ids: function () { return itemsV177G().map(function (i) { return i.id; }); }, kinds: function () { return Object.keys(WINGS_V177G); },
    frames: function (kind) { var D = WINGS_V177G[kind]; return D ? D.frames : 0; }, frame: function (kind, t) { return wingFrameV157A(kind, t); },
    art: function (id, fr) { var it = BY[id]; return it && it.w ? wingArtV153G(it.w, fr | 0) : null; }
  });

  /* ===== v177 H EVERY HAT FLOATS =====
   * The owner: "Make all hats hover over the helmet, like the halos."
   * Every crown (the headwear slot — crowns, horns, tiaras, caps, the halo) now hovers over the helmet the way the halo
   * always did: its base `hatLiftPxV177H` (3.2) sprite px above the top of the helmet, bobbing on a slow sine
   * (`hatBobPxV177H` 0.9 px, `hatBobMsV177H` 1700 ms — v159 D's own crown bob is folded into it, not added), with a soft
   * shadow on the helmet under it and a faint glow of the hat's own colour between the two (smaller and fainter as it
   * rises). On the profile card, the growth screen and the Locker (`paintFrontV153G`), and on the live field
   * (`fieldFxV153G`: the crown's world-space image, plus `_crShV177H` under it — and his plumbob rises to float over
   * the hat instead of hiding behind it, TU `hatPlumbV177H`). prefers-reduced-motion: it hovers, still. Kill switch TU("v177Hfloat", 0): v153 G's seating (the halo floats, the rest sit on the helmet).
   * `window.__V177H`; v177FGHcheck. */
  function onV177H() { return !!TUv("v177Hfloat", 1); }
  var G177H = (window.__V177H = window.__V177H || { field: null, card: 0, errs: [] });
  function errV177H(e) { try { if (G177H.errs.length < 8) G177H.errs.push(String((e && e.message) || e)); } catch (x) {} }
  function hatBobV177H(t) { if (t == null || reducedV157A()) return 0; return Math.sin(t / Math.max(300, TUv("hatBobMsV177H", 1700)) * TAU_V177F) * TUv("hatBobPxV177H", 0.9); }
  /* the crown art's baseline, in sprite px from the top of the helmet (negative: above it); null with the switch off */
  function hatOffV177H(kind, t) { if (!onV177H()) return null; return -TUv("hatLiftPxV177H", 3.2) - (kind === "halo" ? 0.4 : 0) + hatBobV177H(t); }
  // the shadow on the helmet and the glow under the hat, on a 2D canvas (k: sprite px → canvas px)
  function hatShadowV177H(ctx, cx, topY, w, k, bob, cd) {
    try {
      var lift = Math.max(0, -bob) / Math.max(0.1, TUv("hatBobPxV177H", 0.9)), rx = Math.max(2, w * 0.36) * k * (1 - 0.12 * lift), ry = Math.max(0.7, 1.15 * k);
      ctx.save(); ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = TUv("hatShadowV177H", 0.3) * (1 - 0.3 * lift); ctx.fillStyle = "#05070c";
      ctx.beginPath(); ctx.ellipse(cx, topY + 1.3 * k, rx, ry, 0, 0, TAU_V177F); ctx.fill();
      var col = colRgb(((cd && cd.col) || ["#fff3c4"])[0]), g = ctx.createRadialGradient(cx, topY - 0.6 * k, 0, cx, topY - 0.6 * k, rx * 1.2);
      g.addColorStop(0, "rgba(" + (col[0] | 0) + "," + (col[1] | 0) + "," + (col[2] | 0) + "," + (TUv("hatGlowV177H", 0.42) * (1 - 0.25 * lift)).toFixed(3) + ")"); g.addColorStop(1, "rgba(" + (col[0] | 0) + "," + (col[1] | 0) + "," + (col[2] | 0) + ",0)");
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, topY - 0.6 * k, rx * 1.2, ry * 1.5, 0, 0, TAU_V177F); ctx.fill();
      ctx.restore();
    } catch (e) { errV177H(e); }
  }
  // on the field: one soft-shadow-and-glow texture per hat colour, an image under the crown (world space, as the crown is)
  function hatShadowArtV177H(cd) {
    var col = ((cd && cd.col) || ["#fff3c4"])[0], key = "hatsh177|" + col;
    if (ART_V153G[key]) return ART_V153G[key];
    var c = document.createElement("canvas"); c.width = 24; c.height = 10; var x = c.getContext("2d");
    hatShadowV177H(x, 12, 5.2, 20, 1, 0, cd);
    return (ART_V153G[key] = { key: key, cv: c, ax: 12, ay: 5.2, w: 24, h: 10 });
  }
  function hatFieldV177H(scene, m, co, ca, cd, geo, now, s, show) {
    try {
      if (!onV177H()) { dropV153G(m, "_crShV177H"); return; }
      var art = hatShadowArtV177H(cd), key = texV153G(scene, art), o = m._crShV177H;
      if (o && (!o.scene || !o.active)) o = m._crShV177H = null;
      if (!o) { o = m._crShV177H = scene.add.image(0, 0, key); m.root.once("destroy", function () { try { o.destroy(); } catch (e) {} }); }
      else if (o.texture.key !== key) o.setTexture(key);
      var bob = hatBobV177H(now), lift = Math.max(0, -bob) / Math.max(0.1, TUv("hatBobPxV177H", 0.9)), sc = s * Math.max(0.5, ca.w / 20);
      o.setOrigin(art.ax / art.w, art.ay / art.h).setDepth(TUv("cosCrownDepthV153G", 23.05) - 0.01).setPosition(m.root.x + geo.cx * s, m.root.y + geo.top * s).setScale(sc * (1 - 0.1 * lift), s).setAlpha(1 - 0.25 * lift).setVisible(show);
      // the plumbob floats over the hovering hat, never behind it (src/05 places it each frame, just before this)
      var bob0 = m.bob && m.bob.active ? m.bob.y : null;
      if (bob0 != null && TUv("hatPlumbV177H", 1)) { var want = co.y - ca.h * s - (TUv("bobH", 9.6) + 1.5) * s; if (m.bob.y > want) m.bob.y = want; }
      G177H.field = { t: now, crownY: co.y, crownTop: co.y - ca.h * s, shY: o.y, top: m.root.y + geo.top * s, bottom: co.y, s: s, kind: cd.kind, bob0: bob0, bob: m.bob ? m.bob.y : null };
    } catch (e) { errV177H(e); }
  }
  G177H.on = onV177H; G177H.off = hatOffV177H; G177H.bob = hatBobV177H;
  G177H.paint = function (ctx, cd, geo, k, t) { paintFrontV153G(ctx, geo, { crown: { id: "crown", d: cd } }, k, t); };

  /* ===== v157 C ONE FACE EVERYWHERE =====
   * The owner: "Number fonts, I currently don't see those in the profile or live player" · "ensure the colors of the
   * live profile player make sense" · "anything like the helmets to transfer to the profile page" · "the growth
   * post-season character looks funny, ensure it looks the same as the profile picture" · "profile icons should be
   * unlocked via gameplay and season challenges only — add a ton". One figure, drawn one way, everywhere he appears:
   *   THE FIGURE   `drawFigureV157C(cv, age, face)` = v153 E's drawCharacter (his kit — the team's palette or the equipped
   *                uniform — and the equipped helmet) + HIS NUMBER on the chest in the equipped number font. The profile
   *                card, the year-older (growth) screen and the live screen's badge all call it with `faceV157C()`, so the
   *                growth man IS the profile man (same pixels at the same age) — 07 `growOneFaceV157C` routes the growth
   *                canvas here (TU "v157Cfig" 0 → the old growth recolour, no number). The number on the chest is the
   *                one he wears on the field (`jerseyNumV157C`: the you-marker's own number once a live game has shown it,
   *                else the slot table the field uses). Wings / crown / aura follow the figure onto the growth screen
   *                through the card's own flair layers (`cardFlairV153G`), so every look the card shows, the growth
   *                screen shows. Footprints are a motion effect on the field and stay there.
   *   THE LIVE BADGE  the live screen's round position badge (`.watch-badge`, 07) wears his head-and-shoulders from the
   *                same figure, ringed in his kit colours, the position on a tab — it was a gold ring on navy whatever
   *                he wore. On the field his number, with a number font equipped, is drawn larger (TU nfScaleV157C) with
   *                a heavier outline in the font's own colours (TU nfStrokeV157C) so the face and the colour read at
   *                broadcast size; the eleven around him are untouched.
   *   ICONS        profile icons are EARNED only: ~80 gameplay icons (titles at every level ×1/3/5/10, UFF rings,
   *                Interstellar titles, League MVPs, a Legacy medal of every colour, generations, the UFF at each
   *                position, rings at 3 / 9 positions, career touchdown and yardage records, the Hall, each super
   *                challenge) and season-challenge icons (1 / 5 / 10 / 25 / 50 completed, a 20/20 season, six named
   *                challenges — read from src/29 `challengeTotals`, nothing appended to its seeded POOL). The Career
   *                Pass draws no icons any more (src/29 `passKindV157C`); a pass icon a device already owned keeps its
   *                slot (`gfIconV157C`). Each icon is its own badge: a glyph on a two-colour disc with a tag.
   * Looks only: nothing here reads or writes a number the sim uses or spends a Math.random draw. `window.__V157C`. */
  var V157C = (window.__V157C = window.__V157C || { figs: 0, growth: 0, badges: 0, nums: {}, icons: 0, grants: [], errs: [] });
  function onV157C(k) { return !!TUv(k, 1); }
  function errV157C(e) { try { if (V157C.errs.length < 8) V157C.errs.push(String((e && e.message) || e)); } catch (x) {} }
  /* ---- his number: what the field puts on him (src/05 OFF_NUMS / DEF_NUMS by slot), learned live ---- */
  var NUM_BY_POS_V157C = { QB: 12, RB: 24, WR: 80, TE: 87, OL: 74, DL: 91, LB: 54, CB: 21, S: 31, K: 3, P: 4 };
  function jerseyNumV157C(pos) {
    pos = String(pos || "").toUpperCase(); if (!pos) return null;
    var n = V157C.nums[pos]; if (n != null) return n;
    return NUM_BY_POS_V157C[pos] != null ? NUM_BY_POS_V157C[pos] : null;
  }
  function nfOfV157C(id) {
    var it = id ? findItem(id) : null;
    var nf = it && it.cat === "numfont" && it.nf ? it.nf : null;
    return nf || { style: "team", font: "Oswald, Impact, 'Arial Black', sans-serif", col: "#ffffff", stroke: "#0a0e14" };
  }
  /* ---- the source art's chest (measured once off idle_dn_hi.png: the jersey rows between the neck and the waist) ---- */
  var CHEST_V157C = null;
  function chestV157C() {
    if (CHEST_V157C) return CHEST_V157C;
    var im = FIG.img; if (!im) return null;
    try {
      var W = im.naturalWidth, H = im.naturalHeight, c = document.createElement("canvas"); c.width = W; c.height = H;
      var x = c.getContext("2d"); x.drawImage(im, 0, 0); var d = x.getImageData(0, 0, W, H).data;
      var top = 3, neck = Math.round(top + (H - 6) * FIG.neck), waist = H;
      for (var y0 = neck + 20; y0 < H; y0++) {
        var nv = 0, gd = 0;
        for (var x0 = 0; x0 < W; x0++) { var i0 = (y0 * W + x0) * 4; if (d[i0 + 3] < 20) continue; var c0 = srcClass(d[i0], d[i0 + 1], d[i0 + 2])[0]; if (c0 === 1) nv++; else if (c0 === 2) gd++; }
        if (gd > 12 && gd > nv * 1.5) { waist = y0; break; }
      }
      // the torso's navy run on the chest row (the arms are gold): its centre and width bound the numerals
      var row = Math.round(neck + (waist - neck) * TUv("nfChestRowV157C", 0.5)), a0 = -1, a1 = -1, mid = W * 0.5;
      for (var xx = 0; xx < W; xx++) { var ii = (row * W + xx) * 4; if (d[ii + 3] >= 20 && srcClass(d[ii], d[ii + 1], d[ii + 2])[0] === 1) { if (a0 < 0) a0 = xx; a1 = xx; } }
      if (a0 >= 0) mid = (a0 + a1) / 2;
      CHEST_V157C = { neck: neck, waist: waist, row: row, cx: mid, w: a0 >= 0 ? a1 - a0 : W * 0.4, W: W, H: H };
    } catch (e) { errV157C(e); return null; }
    return CHEST_V157C;
  }
  /* the number painted on the chest of a figure figDraw just drew (res.geo is where the body went) */
  function chestNumberV157C(cv, res, num, nfId) {
    if (!res || !res.geo || num == null || num === "" || !onV157C("v157Cfig")) return null;
    var C = chestV157C(); if (!C) return null;
    var r176 = chestPixelV176(cv, res, num, nfId, C); if (r176) return r176;   // v176: on the figure's own pixel grid, sewn into the shirt
    var r159 = chestNumV159A(cv, res, num, nfId, C); if (r159) return r159;   // v159 A: printed on the fabric
    var r158 = chestNumV158A(cv, res, num, nfId, C); if (r158) return r158;   // v158 A: the number font's own drawn art
    try {
      var g = res.geo, x = cv.getContext("2d"), nf = nfOfV157C(nfId), s = String(num | 0);
      var sx = g.bw / C.W, cx = g.bx + C.cx * sx, cy = g.by + (C.row - g.neck) * g.k;
      var px = Math.max(8, (C.waist - C.neck) * g.k * TUv("nfChestHV157C", 0.58));
      x.save(); x.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
      x.font = "bold " + px.toFixed(1) + "px " + nf.font; x.textAlign = "center"; x.textBaseline = "middle";
      var w = x.measureText(s).width, maxW = C.w * sx * TUv("nfChestWV157C", 0.92);
      if (w > maxW) { px = px * maxW / w; x.font = "bold " + px.toFixed(1) + "px " + nf.font; }
      x.lineJoin = "round"; x.lineWidth = Math.max(1.4, px * TUv("nfChestStrokeV157C", 0.2)); x.strokeStyle = nf.stroke || "#0a0e14"; x.strokeText(s, cx, cy);
      x.fillStyle = nf.col || "#ffffff"; x.fillText(s, cx, cy);
      if (nf.style === "chrome" || nf.style === "gold" || nf.style === "founder") { x.globalAlpha = 0.35; x.fillStyle = "#ffffff"; x.fillText(s, cx - px * 0.04, cy - px * 0.06); }
      if (nf.style === "neon") { x.globalAlpha = 0.5; x.shadowColor = nf.col; x.shadowBlur = px * 0.5; x.fillText(s, cx, cy); }
      x.restore();
      return { num: s, nf: nf.style, px: +px.toFixed(1), cx: +cx.toFixed(1), cy: +cy.toFixed(1) };
    } catch (e) { errV157C(e); return null; }
  }
  /* ---- the face: everything the figure wears, read once (the card's profile() carries the same fields) ---- */
  function faceV157C(st) {
    st = st || gstate() || {};
    var e = st.player || null;
    return { kit: kitData(), numfont: equipped("numfont"), num: e ? jerseyNumV157C(e.pos) : null, pos: e ? e.pos : "", age: e ? e.age || 22 : 22,
      wings: equipped("wings"), crown: equipped("crown"), aura: equipped("aura"), trail: equipped("trail"), helmet: equipped("helmet"), uniform: equipped("uniform") };
  }
  /* the one figure: null until the art is in (a caller keeps its own fallback until then) */
  function drawFigureV157C(cv, age, face) {
    face = face || faceV157C();
    if (!FIG.img) { figLoad(); return null; }
    var r = drawCharacter(cv, face.kit || {}, age || face.age || 22, { num: face.num, numfont: face.numfont });
    if (r && r.mode === "hi") V157C.figs++;
    return r && r.mode === "hi" ? r : null;
  }
  /* ---- the growth screen (07 growDrawV133 → growOneFaceV157C → here): the same figure, and the flair layers ---- */
  function growFigureV157C(cv, age, kit) {
    try {
      if (!onV157C("v157Cfig")) return null;
      var face = faceV157C();
      // the palette the growth screen hands over is his TEAM kit; an equipped uniform still wins, as on the card
      if (Array.isArray(kit) && hexOk(kit[0]) && hexOk(kit[1]) && !(item("uniform") || {}).k) face.kit = Object.assign({}, face.kit, { j: kit[0], p: kit[1] });
      var r = drawFigureV157C(cv, age, face); if (!r) return null;
      V157C.growth++; V157C.lastGrowth = { age: age, num: face.num, numfont: face.numfont, helmet: face.helmet };
      setTimeout(function () {
        try {
          if (!cv.isConnected || cv.closest(".gw-ghost")) return;
          var host = cv.parentNode; if (!host || host.classList.contains("gw-one-v157c")) return;
          var wrap = document.createElement("div"); wrap.className = "gw-one-v157c"; host.insertBefore(wrap, cv); wrap.appendChild(cv);
          cardFlairV153G(cv, { wings: face.wings, crown: face.crown, aura: face.aura });
        } catch (e) { errV157C(e); }
      }, 0);
      return r;
    } catch (e) { errV157C(e); return null; }
  }
  /* ---- the live screen's badge: his head and shoulders, ringed in his kit ---- */
  function paintBadgeV157C(el) {
    try {
      if (!el || !onV157C("v157Cfig")) return false;
      var face = faceV157C(), key = JSON.stringify([face.kit, face.num, face.numfont, face.age]);
      if (el.dataset.fig157 === key) return true;
      var src = document.createElement("canvas"), r = drawFigureV157C(src, face.age, face); if (!r) return false;
      var S = 68, out = document.createElement("canvas"); out.width = S; out.height = S; out.className = "wb-fig-v157c";
      var x = out.getContext("2d"), sw = src.width, sh = src.height;
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
      x.drawImage(src, sw * 0.14, sh * 0.02, sw * 0.72, sh * 0.5, 0, 2, S, S * (0.5 / 0.72) * (sh / sw) * 1.0);
      var pos = (el.textContent || face.pos || "").replace(/\s+/g, "").slice(0, 3);
      el.innerHTML = ""; el.appendChild(out);
      var tag = document.createElement("b"); tag.className = "wb-pos-v157c"; tag.textContent = pos; el.appendChild(tag);
      el.classList.add("wb-v157c"); el.style.setProperty("--wb-j", face.kit.j); el.style.setProperty("--wb-p", face.kit.p);
      el.dataset.fig157 = key; V157C.badges++;
      return true;
    } catch (e) { errV157C(e); return false; }
  }
  var badgeQ = 0;
  function badgeScanV157C() {
    if (badgeQ) return; badgeQ = 1;
    setTimeout(function () { badgeQ = 0; try { document.querySelectorAll(".watch-badge:not(.wb-v157c)").forEach(paintBadgeV157C); } catch (e) {} }, 60);
  }
  try { new MutationObserver(function () { if (document.querySelector(".watch-badge:not(.wb-v157c)")) badgeScanV157C(); }).observe(document.getElementById("screen") || document.body, { childList: true, subtree: true }); } catch (e) {}
  /* ---- the field: his number, bigger and outlined in the font's colours (called from fieldFxV153G) ---- */
  function fieldNumV157C(m, N) {
    try {
      if (!m || !m.label) return;
      if (m.num != null && m.team === "you") { var ps = ""; try { var st = gstate(); ps = st && st.player ? String(st.player.pos || "").toUpperCase() : ""; } catch (e) {} if (ps && V157C.nums[ps] !== (m.num | 0)) V157C.nums[ps] = m.num | 0; }
      if (!N || !onV157C("v157Cfig") || !m.label.visible) { dropNumV158A(m, N && onV157C("v157Cfig") ? N : null); return; }   // v158 A
      var L = m.label, sc = m._numScaleV104 || L.scaleX || 1, k = TUv("nfScaleV157C", 1.35), b = m._numBandV104;
      var bw = b && m.body ? b.w * Math.abs(m.body.scaleX || 1) * TUv("nfWidthV157C", 0.82) : 1e9, want = sc * k;
      if (L.width * want > bw) want = Math.max(sc, bw / Math.max(1, L.width));
      if (Math.abs(L.scaleX - want) > 1e-4) L.setScale(want);
      V157C.fieldNum = { font: L.style.fontFamily, col: L.style.color, scale: +want.toFixed(3), base: +sc.toFixed(3) };
      fieldNumV158A(m, N);   // v158 A: the font's drawn art over the label
    } catch (e) { errV157C(e); }
  }

  /* ---- ICONS: earned in play and in season challenges, never bought ---- */
  var LV_V157C = [[0, "Pee Wee", "PW", "🏈", "#6fbf4a"], [1, "Youth League", "YL", "⭐", "#4da6ff"], [2, "Middle School", "MS", "🎒", "#e0603b"], [3, "JV", "JV", "🥉", "#c07a45"],
    [4, "Varsity", "VAR", "🏫", "#b3121f"], [5, "College", "COL", "🎓", "#3b1f7a"], [7, "The UFF", "UFF", "💍", "#d4af37"], [8, "Interstellar League", "ISL", "🪐", "#7a3aff"]];
  var CNT_V157C = [[1, "#c07a45", "common"], [3, "#c9d1db", "rare"], [5, "#e8c24a", "epic"], [10, "#9fe6ff", "legendary"]];
  var UP_V157C = { common: "rare", rare: "epic", epic: "legendary", legendary: "mythic", mythic: "mythic" };
  var POSG_V157C = { QB: "🎯", RB: "🏃", WR: "🙌", TE: "🧤", OL: "🛡️", DL: "🦏", LB: "🔨", CB: "🔒", S: "🦅" };
  var ICON_RULES_V157C = [];
  function iconV157C(id, name, glyph, c1, c2, tag, rarity, desc, test) {
    ICON_RULES_V157C.push({ id: id, name: name, glyph: glyph, col: c1, col2: c2, tag: tag, rarity: rarity, desc: desc, test: test });
  }
  (function buildIconsV157C() {
    LV_V157C.forEach(function (L) {
      CNT_V157C.forEach(function (C) {
        var n = C[0], big = L[0] >= 7, what = L[0] === 7 ? "UFF championship" : L[0] === 8 ? "Interstellar championship" : L[1] + " championship";
        iconV157C("ico_t" + L[0] + "_" + n, (n > 1 ? n + "× " : "") + L[1] + " Champion", L[3], C[1], L[4], L[2] + (n > 1 ? "×" + n : ""), big ? UP_V157C[C[2]] : C[2],
          "Win " + (n > 1 ? n + " " + what + "s" : "a " + what) + " (across your careers)", function (I) { return (I.titles[L[0]] | 0) >= n; });
      });
    });
    [[1, "rare"], [3, "epic"], [5, "legendary"]].forEach(function (m) {
      iconV157C("ico_mvp_" + m[0], (m[0] > 1 ? m[0] + "× " : "") + "League MVP", "⭐", "#ffd76f", "#8a6414", "MVP" + (m[0] > 1 ? "×" + m[0] : ""), m[1],
        "Be named League MVP (college or higher)" + (m[0] > 1 ? " " + m[0] + " times" : ""), function (I) { return I.mvps >= m[0]; });
    });
    var CATS = [{ key: "bronze", name: "BRONZE", tint: "#c07a45", from: 10 }, { key: "silver", name: "SILVER", tint: "#c9d1db", from: 60 }, { key: "gold", name: "GOLD", tint: "#e8c24a", from: 121 },
      { key: "red", name: "RUBY", tint: "#e0434f", from: 202 }, { key: "blue", name: "SAPPHIRE", tint: "#3f7fe0", from: 267 }, { key: "green", name: "EMERALD", tint: "#2fbf6a", from: 285 },
      { key: "purple", name: "AMETHYST", tint: "#a05ae0", from: 332 }, { key: "ice", name: "DIAMOND", tint: "#9fe6ff", from: 378 }, { key: "grand", name: "GRAND", tint: "#ffd86b", from: 444 }];
    try { var MC = window.RIB_LEGACY && window.RIB_LEGACY.medals && window.RIB_LEGACY.medals.cats; if (MC && MC.length === CATS.length) CATS.forEach(function (c, i) { if (i > 0) c.from = MC[i].from; c.tint = MC[i].tint || c.tint; c.name = MC[i].name || c.name; }); } catch (e) {}
    CATS.forEach(function (c, i) {
      var rr = ["common", "common", "rare", "rare", "epic", "epic", "legendary", "legendary", "mythic"][i];
      iconV157C("ico_lg_" + c.key, c.name.charAt(0) + c.name.slice(1).toLowerCase() + " Legacy", "🎖", c.tint, "#141a24", c.name.slice(0, 3), rr,
        i === 0 ? "Reach Legacy rank " + c.from : "Earn your first " + c.name.toLowerCase() + " Legacy medal (rank " + c.from + ")", function (I) { return I.legacy >= c.from; });
    });
    [[2, "rare"], [3, "epic"], [5, "legendary"]].forEach(function (g) {
      iconV157C("ico_gen_" + g[0], "Generation " + g[0], "🌳", "#5fae4a", "#3a2a0e", "G" + g[0], g[1], "Play as generation " + g[0] + " of your family", function (I) { return I.gen >= g[0]; });
    });
    Object.keys(POSG_V157C).forEach(function (p) {
      iconV157C("ico_pos_" + p.toLowerCase(), p + " in the UFF", POSG_V157C[p], "#1f5fbf", "#0f2d5c", p, "rare", "Reach the UFF as a " + p, function (I) { return !!I.uffPos[p]; });
    });
    iconV157C("ico_ringpos_3", "Ringed at Three", "💍", "#e6c46a", "#3b1f7a", "3 POS", "epic", "Win a UFF ring at 3 different positions", function (I) { return I.ringPos >= 3; });
    iconV157C("ico_ringpos_9", "Ringed Everywhere", "💍", "#fff3c4", "#2a1650", "9 POS", "mythic", "Win a UFF ring at all 9 positions", function (I) { return I.ringPos >= 9; });
    [[25, "common"], [50, "rare"], [100, "epic"], [200, "legendary"]].forEach(function (t) {
      iconV157C("ico_td_" + t[0], t[0] + " Touchdowns", "🔥", "#ff7a1a", "#3a1008", t[0] + " TD", t[1], "Score " + t[0] + " touchdowns in one career", function (I) { return I.tds >= t[0]; });
    });
    [[5000, "rare"], [10000, "epic"], [20000, "legendary"]].forEach(function (t) {
      iconV157C("ico_yd_" + t[0], (t[0] / 1000) + ",000 Yards", "📏", "#18c3b8", "#0b2a28", (t[0] / 1000) + "K YD", t[1], "Gain " + t[0].toLocaleString("en-US") + " yards in one career", function (I) { return I.yds >= t[0]; });
    });
    iconV157C("ico_hof_1", "Enshrined", "🏛️", "#ece8df", "#5a4a2a", "HALL", "epic", "Enshrine a career that made the UFF in the Hall of Fame", function (I) { return I.hofWon >= 1; });
    iconV157C("ico_hof_5", "The Wing", "🏛️", "#ffd76f", "#2a1d08", "HALL×5", "legendary", "Enshrine 5 careers that made the UFF", function (I) { return I.hofWon >= 5; });
    [["ladder10", "📈", "#6fd3ff"], ["allPositions", "🪐", "#b9a6ff"], ["mvpInterstellar", "🌠", "#ff9ad5"], ["goldRush", "💰", "#ffd76f"], ["ultimate", "👑", "#ffe98a"]].forEach(function (s) {
      var c = SUPER_V156C.filter(function (x) { return x.id === s[0]; })[0];
      iconV157C("ico_super_" + s[0], (c ? c.name : s[0]), s[1], s[2], "#12051f", "SUPER", "mythic", "Super challenge: " + (c ? c.desc() : s[0]), function (I) { return !!I.superDone[s[0]]; });
    });
    [[1, "common"], [5, "rare"], [10, "epic"], [25, "legendary"], [50, "mythic"]].forEach(function (n) {
      iconV157C("ico_sc_" + n[0], n[0] === 1 ? "Challenger" : n[0] + " Challenges", "✅", "#57e07a", "#0f3a26", n[0] + " SC", n[1], "Complete " + (n[0] === 1 ? "a season challenge" : n[0] + " season challenges (across seasons)"), function (I) { return I.sc.total >= n[0]; });
    });
    iconV157C("ico_sc_full", "Perfect Season", "🏅", "#ffd76f", "#0f3a26", "20/20", "legendary", "Complete all 20 season challenges in one season", function (I) { return I.sc.full >= 1; });
    [["The Show", "🏟️", "#d4af37", "rare"], ["Three-Peat Energy", "🏆", "#e8c24a", "epic"], ["Like Father", "👨‍👦", "#5fae4a", "rare"], ["Creature of Habit", "📅", "#6fd3ff", "epic"],
      ["Wrecking Crew", "💥", "#ff5a5a", "epic"], ["Yardage Machine", "🚀", "#18c3b8", "epic"]].forEach(function (c) {
      iconV157C("ico_sc_" + c[0].toLowerCase().replace(/[^a-z]+/g, "_"), c[0], c[1], c[2], "#0b1a14", "SZN", c[3], "Complete the season challenge “" + c[0] + "”", function (I) { return (I.sc.byTitle[c[0]] | 0) >= 1; });
    });
  })();
  ICON_RULES_V157C.forEach(function (r) {
    var it = { id: r.id, cat: "icon", name: r.name, rarity: r.rarity, source: "earned", ach: "icon:" + r.id, glyph: r.glyph, col: r.col, col2: r.col2, tag: r.tag, v157: 1, packs: [] };
    it.preview = function (el) { return previewInto(el, it); };
    ACH_BY["icon:" + r.id] = { id: "icon:" + r.id, name: r.name, desc: r.desc, test: r.test };
    ITEMS.push(it); BY[it.id] = it;
  });
  /* what the icons read: the account, every career the record keeps (the Hall's boxes + the live career, once), the
   * positions mastered, the super challenges and the season challenges */
  function yardsOfV157C(line) { var n = 0; if (line) for (var k in line) if (/Yds$/.test(k) && !isNaN(+line[k])) n += +line[k]; return n; }
  function iconAccountV157C(st) {
    st = st || gstate() || {};
    var A = account(st), e = st.player || null, hof = Array.isArray(st.hof) ? st.hof : [];
    var I = { titles: {}, mvps: A.leagueMvps | 0, legacy: A.legacyMedal | 0, gen: A.gen | 0, uffPos: {}, ringPos: 0, tds: A.bestTds | 0, yds: 0, hofWon: A.hofWon | 0, superDone: {}, sc: { total: 0, full: 0, byTitle: {} } };
    var tally = function (rows, isObj) { var y = 0; (rows || []).forEach(function (r) { if (!r) return; if (r.champion) { var lv = r.level | 0; I.titles[lv] = (I.titles[lv] | 0) + 1; } y += yardsOfV157C(isObj ? r.statLine : r.line); }); I.yds = Math.max(I.yds, y); };
    var tags = {};
    hof.forEach(function (h) { if (!h) return; if (h.tagV154) tags[h.tagV154] = 1; if (h.box && h.box.log) tally(h.box.log, false); });
    if (e && !(e._hofTagV154 && tags[e._hofTagV154])) tally(e.seasonLogV77, true);
    // a UFF ring is a level-7 title (the account's own count is the floor)
    I.titles[7] = Math.max(I.titles[7] | 0, A.uffTitles | 0);
    I.titles[8] = Math.max(I.titles[8] | 0, A.interstellarTitles | 0);
    var PM = st.posMastery || {}; Object.keys(PM).forEach(function (p) { var m = PM[p] || {}; if (m.nfl) I.uffPos[String(p).toUpperCase()] = 1; if (m.ring) I.ringPos++; });
    try { var S = sload(); Object.keys(S.done || {}).forEach(function (k) { I.superDone[k] = 1; }); } catch (x) {}
    try { var T = window.RIB_SEASONS && window.RIB_SEASONS.challengeTotals && window.RIB_SEASONS.challengeTotals(); if (T) I.sc = T; } catch (x) {}
    return I;
  }
  function iconTickV157C(st) {
    var got = [];
    try {
      var I = iconAccountV157C(st), S = load();
      ICON_RULES_V157C.forEach(function (r) {
        var hit = false; try { hit = !!r.test(I); } catch (x) {}
        if (hit && !S.owned[r.id]) { grant(r.id, "earned"); got.push(r.id); }
      });
      V157C.icons = ICON_RULES_V157C.length; V157C.lastIcons = got; if (got.length) V157C.grants = V157C.grants.concat(got).slice(-40);
    } catch (e) { errV157C(e); }
    return got;
  }
  // with the earned looks (boot, every save, the profile) and on src/29's 1.5s watch (throttled, and only when something moved)
  (function () { var ce = checkEarned; checkEarned = function (st) { var got = ce(st); try { iconTickV157C(st); } catch (e) {} return got; }; })();
  var iconSigV157C = "", iconAtV157C = 0;
  (function () {
    var t0 = window.RIB_SUPER && window.RIB_SUPER.tick; if (!t0) return;
    window.RIB_SUPER.tick = function (st) {
      var r = t0.apply(this, arguments);
      try {
        var s = gstate() || {}, p = s.player || {}, T = window.RIB_SEASONS && window.RIB_SEASONS.challengeTotals ? window.RIB_SEASONS.challengeTotals().total : 0;
        var sig = [(s.hof || []).length, (p.seasonLogV77 || []).length, p.level | 0, T, s.legacyV152 ? s.legacyV152.xp | 0 : 0].join("|");
        if (sig !== iconSigV157C && Date.now() - iconAtV157C > 4000) { iconSigV157C = sig; iconAtV157C = Date.now(); iconTickV157C(s); }
      } catch (e) {}
      return r;
    };
  })();
  /* a pass icon a device owned before v157 C keeps its slot (the pass now draws a badge there) */
  function gfIconV157C(rw) {
    try {
      if (!rw || rw.kind === "icon" || !load().owned[rw.id]) return rw;
      var S = window.RIB_SEASONS; if (!S || !S.rawKind || S.rawKind(rw.id) !== "icon") return rw;
      return Object.assign({}, rw, { kind: "icon" });
    } catch (e) { return rw; }
  }
  /* the icon's art: a glyph on a two-colour disc with a tag (the card's round slot and the Locker's preview) */
  function iconInnerV157C(it) {
    if (!it || !it.v157) return escHtml(it && it.glyph || "");
    return '<em class="ico157-g">' + escHtml(it.glyph) + "</em>" + (it.tag ? '<b class="ico157-t">' + escHtml(it.tag) + "</b>" : "");
  }
  function iconStyleV157C(it) {
    if (!it || !it.v157) return "box-shadow:0 0 0 2px " + ((it && it.col) || "#f0bb45") + " inset";
    return "--i1:" + it.col + ";--i2:" + it.col2;
  }
  function previewIconV157C(el, it) {
    el.innerHTML = '<div class="ico157" style="' + iconStyleV157C(it) + '">' + iconInnerV157C(it) + "</div>";
    return el;
  }
  (function () {
    if (document.getElementById("cosV157Ccss")) return;
    var st = document.createElement("style"); st.id = "cosV157Ccss";
    st.textContent = [
      /* the icon disc — the card's slot (.pc-ico-v151b.ico157) and the Locker preview */
      ".ico157{position:relative;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 28%,color-mix(in srgb,var(--i1) 55%,#fff) 0,var(--i2) 72%);box-shadow:0 0 0 2px var(--i1) inset,0 0 0 1px rgba(0,0,0,.6),0 3px 8px rgba(0,0,0,.45)}",
      ".ico157 .ico157-g{font-style:normal;font-size:20px;line-height:1;filter:drop-shadow(0 1px 1px rgba(0,0,0,.6));margin-top:-4px}",
      ".ico157 .ico157-t,.pc-ico-v151b.ico157 .ico157-t{position:absolute;left:50%;bottom:-3px;transform:translateX(-50%);padding:0 4px;border-radius:5px;background:#0b0f16;border:1px solid var(--i1);font:700 7px/10px Oswald,sans-serif;letter-spacing:.4px;color:#fff;white-space:nowrap}",
      ".pc-ico-v151b.ico157{width:30px;height:30px;top:6px;background:radial-gradient(circle at 35% 28%,color-mix(in srgb,var(--i1) 55%,#fff) 0,var(--i2) 72%);box-shadow:0 0 0 2px var(--i1) inset,0 0 0 1px rgba(0,0,0,.6)}",
      ".pc-ico-v151b.ico157 .ico157-g{font-style:normal;font-size:15px;line-height:1;margin-top:-3px}.pc-ico-v151b.ico157 .ico157-t{font-size:6px;line-height:8px;bottom:-5px}",
      /* the growth screen's figure wears the card's flair layers */
      "#growV132 .gw-one-v157c{position:absolute;left:0;top:0;width:128px;height:160px}#growV132 .gw-one-v157c.pc-fig-v153g{position:absolute}",
      "#growV132 .gw-one-v157c .pc-fl-v153g{left:0;top:-40px;bottom:auto;width:128px;height:200px}#growV132 .gw-one-v157c.pc-shrink-v153g .pc-fl-v153g{transform:none}#growV132 .gw-one-v157c .pc-fl-v153g.front{z-index:2}",
      /* the live badge */
      ".watch-badge.wb-v157c{position:relative;overflow:visible;padding:0;background:radial-gradient(circle at 50% 30%,color-mix(in srgb,var(--wb-p) 30%,#2a3446),#0c1420 78%);border-color:var(--wb-p);box-shadow:0 0 0 2.5px #0a1017,0 0 0 4.5px color-mix(in srgb,var(--wb-j) 70%,transparent),0 0 12px color-mix(in srgb,var(--wb-j) 45%,transparent)}",
      ".watch-badge.wb-v157c .wb-fig-v157c{width:100%;height:100%;border-radius:50%;display:block}",
      ".watch-badge.wb-v157c .wb-pos-v157c{position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);padding:0 4px;border-radius:5px;background:var(--wb-j);border:1px solid var(--wb-p);font:700 8px/11px Oswald,sans-serif;letter-spacing:.5px;color:#fff;text-shadow:0 1px 1px rgba(0,0,0,.8)}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(st);
  })();

  /* ===== v158 A THE CARD, DRESSED =====
   * The owner: "greatly enhance the profile options … the banners. Make the jersey number fonts better. Ensure the helmet
   * stripes are accurate in relation to how the player is looking." Four moves, all looks, none of it a number the sim reads:
   *   BANNERS      every banner is a PAINTER now (`BAN_V158A[kind](ctx, w, h, t, P)`): a canvas behind the card's band, animated
   *                off the wall clock alone (deterministic from t: an integer hash, never Math.random), one still frame under
   *                prefers-reduced-motion. 26 new banners (stadium nights, flames, galaxy, lightning, skyline, trophy room,
   *                confetti, hologram, marble & gold, aurora, synthwave, event horizon…) and the seven old ones redrawn; a Career
   *                Pass banner keeps its gradient under a moving sheen. The card dresses itself (`dressCardV158A`, also on a 600 ms
   *                scan for cards drawn from a string — a leaderboard row, the trophy case); the Locker previews animate too.
   *                ONE rAF loop (`LOOP_V158A`, TU v158Afps / v158Amax). Kill switch TU v158Aban (0: the CSS gradient, still).
   *   THE CARD'S OTHER SLOTS  titles styled by rarity (every title, the pass's too), drawn badges (a shaped enamel pin),
   *                nameplates with a material (gold leaf, chrome, neon, engraved stone, carved oak, varsity felt, holo, magma,
   *                marble, starfield, diamond…), animated frame rings (`::after` masked to the border), shelves, recaps, vault
   *                themes, stadiums and celebrations — ≥ 8 new each. Sources keep the owner's rule: the plain ones free, the nice
   *                ones earned late (ACH ids, the v156 C rungs, or an earned ICON — `icon:<id>` — held), the flashiest member.
   *   NUMBER FONTS a real typeface engine: each face is a stroke SKELETON (square block, round, seven-segment, 3x5 bitmap), a PEN
   *                (square, round, broad nib, butt) and a finish (outline rings, drop / stacked shadows, gradients, chrome,
   *                gold foil, bevel, neon core + glow, LED segments, icicles, camo, starfield), rasterised at the exact pixel
   *                height it is shown at and thresholded — crisp edges at 12 px or 60. The profile chest (`chestNumberV157C`),
   *                the field sprite (an image over his label, `fieldNumV158A`) and the Locker all draw the same art. The old
   *                nf_* items are redrawn (keyed by style), 15 new faces. Kill switch TU v158Anf (0: the v157 C text).
   *   HELMET STRIPES  the root cause: kitDeco painted every helmet row's CENTRE column as the stripe, whatever the frame —
   *                right for a head seen from the front or behind, wrong for the side and 3/4 views (a vertical bar down the
   *                side of his head), and it painted the art's own drawn stripe (the gold arcing over the crown, placed by the
   *                artist for each facing) as SHELL. Now the stripe IS the art's stripe: `helmMaskV158A` finds the helmet (an
   *                ellipse fitted to the head's first rows, so the shoulder pads beside it stay jersey), follows the gold from
   *                the crown through the shell (8-connected, touching shell), and paints it — front and back down the middle,
   *                the side view along the top, 3/4 offset — twin / wide stripes are rings / dilations of it, the decal sits on
   *                the side the viewer sees. The profile figure (`figHelmV158A`) gets twin / wide / decals the same way. Kill
   *                switch TU v158Ahelm. `window.__V158A` is what v158Acheck reads. */
  var V158A = (window.__V158A = window.__V158A || { paints: 0, ticks: 0, dressed: 0, nums: 0, field: null, helm: 0, errs: [] });
  function errV158A(e) { try { if (V158A.errs.length < 10) V158A.errs.push(String((e && e.message) || e)); } catch (x) {} }
  function onV158A(k) { return !!TUv(k, 1); }
  var MQ_V158A = null;
  function reducedV158A() { try { if (!MQ_V158A && window.matchMedia) MQ_V158A = matchMedia("(prefers-reduced-motion: reduce)"); return !!(MQ_V158A && MQ_V158A.matches); } catch (e) { return false; } }
  function rV158A(i, s) { return ihV153G((((i | 0) * 73856093) ^ (((s | 0) + 7) * 19349663)) >>> 0); }
  function colV158A(c) { if (c === "T1" || c === "team") return teamCol(0); if (c === "T2") return teamCol(1); return hexOk(c) || "#ffffff"; }
  function rgbaV158A(hx, a) { var c = rgb(colV158A(hx)); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }

  /* ---------------- the catalogue ---------------- */
  var ITEMS_V158A = [
    // BANNERS — b158 is the painter, col its palette, bg the still fallback (a leaderboard row with the switch off)
    { id: "ban_team_sweep", cat: "banner", name: "Team Colours", rarity: "common", source: "free", b158: "sweep", col: ["T1", "T2"], bg: "linear-gradient(135deg,var(--t1,#1f4fd0),var(--t2,#e8c86a))" },
    { id: "ban_chalk", cat: "banner", name: "X's and O's", rarity: "common", source: "free", b158: "chalk", col: ["#1f3a2c", "#f2f2e8"], bg: "linear-gradient(180deg,#24432f,#15291d)" },
    { id: "ban_camo", cat: "banner", name: "Digital Camo", rarity: "common", source: "free", b158: "camo", col: ["#4c5a3a", "#6b7a4a", "#2a3122", "#8a8a5a"], bg: "linear-gradient(135deg,#4c5a3a,#2a3122)" },
    { id: "ban_rainy", cat: "banner", name: "Rain Game", rarity: "common", source: "free", b158: "rain", col: ["#0d1624", "#243a55", "#9fc3e8"], bg: "linear-gradient(180deg,#243a55,#0d1624)" },
    { id: "ban_sunrise", cat: "banner", name: "Two-a-Days", rarity: "rare", source: "free", b158: "sunrise", col: ["#ff9a3d", "#ff5e7a", "#2a2350"], bg: "linear-gradient(180deg,#2a2350,#ff5e7a 60%,#ff9a3d)" },
    { id: "ban_honeycomb", cat: "banner", name: "Hex Grid", rarity: "rare", source: "free", b158: "hex", col: ["T2", "#0b0f16"], bg: "linear-gradient(135deg,#141b26,#0b0f16)" },
    { id: "ban_skyline", cat: "banner", name: "City Skyline", rarity: "rare", source: "earned", ach: "icon:ico_t2_1", b158: "skyline", col: ["#ff8a3d", "#6a2c70", "#1b1b3a"], bg: "linear-gradient(180deg,#1b1b3a,#6a2c70 55%,#ff8a3d)" },
    { id: "ban_snowfall", cat: "banner", name: "Snow Bowl", rarity: "rare", source: "earned", ach: "icon:ico_t3_1", b158: "snow", col: ["#0c1a33", "#2a4a7a", "#ffffff"], bg: "linear-gradient(180deg,#0c1a33,#2a4a7a)" },
    { id: "ban_waves", cat: "banner", name: "Tidal", rarity: "rare", source: "earned", ach: "icon:ico_sc_5", b158: "waves", col: ["#0b2a3a", "#127a9a", "#8fe3ff"], bg: "linear-gradient(180deg,#8fe3ff,#127a9a 50%,#0b2a3a)" },
    { id: "ban_scoreboard", cat: "banner", name: "Scoreboard", rarity: "rare", source: "earned", ach: "icon:ico_t4_1", b158: "board", col: ["#ffb02e", "#3a2408"], bg: "linear-gradient(180deg,#141008,#050403)" },
    { id: "ban_lavalamp", cat: "banner", name: "Lava Lamp", rarity: "rare", source: "earned", ach: "icon:ico_td_50", b158: "lava", col: ["#2a0a3a", "#ff5a8a", "#ffb02e"], bg: "linear-gradient(180deg,#2a0a3a,#5a1a4a)" },
    { id: "ban_confetti", cat: "banner", name: "Ticker Tape", rarity: "epic", source: "earned", ach: "title", b158: "confetti", col: ["#ff5a5a", "#ffd76f", "#6fd3ff", "#7cff9b", "#ff9ad5"], bg: "linear-gradient(180deg,#1a2436,#0a0e15)" },
    { id: "ban_trophy_room", cat: "banner", name: "Trophy Room", rarity: "epic", source: "earned", ach: "ring", b158: "trophy", col: ["#5a3a1e", "#2a1a0c", "#ffd76f"], bg: "linear-gradient(180deg,#5a3a1e,#2a1a0c)" },
    { id: "ban_stadium_nights", cat: "banner", name: "Stadium Nights", rarity: "epic", source: "earned", ach: "uff", b158: "stadium", col: ["#050814", "#1a2436", "#fff6d8"], bg: "linear-gradient(180deg,#050814,#1a2436)" },
    { id: "ban_synthwave", cat: "banner", name: "Retro Wave", rarity: "epic", source: "earned", ach: "icon:ico_sc_10", b158: "synth", col: ["#12051f", "#ff3df2", "#ffd76f"], bg: "linear-gradient(180deg,#12051f,#5a1a6a 60%,#ff3df2)" },
    { id: "ban_paparazzi", cat: "banner", name: "Paparazzi", rarity: "legendary", source: "earned", ach: "mvp", b158: "flash", col: ["#0a0c12", "#2a3446", "#ffffff"], bg: "linear-gradient(180deg,#2a3446,#0a0c12)" },
    { id: "ban_marble", cat: "banner", name: "Marble & Gold", rarity: "legendary", source: "earned", ach: "hof", b158: "marble", col: ["#ece8df", "#b8b2a6", "#d4af37"], bg: "linear-gradient(135deg,#ece8df,#c9c4ba 50%,#f3f0ea)" },
    { id: "ban_northern", cat: "banner", name: "Northern Lights", rarity: "legendary", source: "earned", ach: "rings3", b158: "aurora", col: ["#3fffb0", "#3fb6ff", "#9a6bff"], bg: "linear-gradient(120deg,#06121c,#0f3a3a 45%,#1a1040)" },
    { id: "ban_dynasty", cat: "banner", name: "Dynasty", rarity: "legendary", source: "earned", ach: "rings5", b158: "dynasty", col: ["#0d0f14", "#8a1c2b", "#e6c46a"], bg: "linear-gradient(180deg,#1a1c24,#0d0f14)" },
    { id: "ban_legacy_rays", cat: "banner", name: "Legacy Rays", rarity: "mythic", source: "earned", ach: "legacy300", b158: "rays", col: ["#3a2408", "#ffd76f", "#fff3c4"], bg: "radial-gradient(circle at 30% 50%,#ffd76f,#3a2408 70%)" },
    { id: "ban_event_horizon", cat: "banner", name: "Event Horizon", rarity: "mythic", source: "earned", ach: "interstellar", b158: "hole", col: ["#000000", "#ff9a3d", "#fff3c4"], bg: "radial-gradient(ellipse at 60% 50%,#ff9a3d 0,#3a1408 30%,#000 60%)" },
    { id: "ban_galaxy", cat: "banner", name: "Galaxy", rarity: "mythic", source: "member", b158: "galaxy", col: ["#05030f", "#7a3aff", "#ff5ab4", "#3fb6ff"], bg: "radial-gradient(ellipse at 65% 50%,#3a1a6a,#05030f 70%)" },
    { id: "ban_storm", cat: "banner", name: "Thunderstruck", rarity: "legendary", source: "member", b158: "storm", col: ["#10141c", "#3a4252", "#bfe6ff"], bg: "linear-gradient(180deg,#3a4252,#10141c)" },
    { id: "ban_hologram", cat: "banner", name: "Hologram", rarity: "legendary", source: "member", b158: "holo", col: ["#021418", "#18f0e0", "#b9fff8"], bg: "linear-gradient(180deg,#021418,#063a3a)" },
    { id: "ban_gold_rush", cat: "banner", name: "Gold Rush", rarity: "mythic", source: "member", b158: "coins", col: ["#1a1004", "#ffd76f", "#b8861f"], bg: "radial-gradient(ellipse at 50% 100%,#6a4a10,#1a1004 70%)" },
    { id: "ban_inferno", cat: "banner", name: "Inferno", rarity: "legendary", source: "member", b158: "fire", col: ["#0a0202", "#ff5a1a", "#ffe14d"], bg: "linear-gradient(0deg,#ff5a1a,#5c0f08 55%,#0a0202)" },
    // TITLES — styled by rarity on the card
    { id: "title_rookie", cat: "title", name: "Rookie", rarity: "common", source: "free", text: "Rookie" },
    { id: "title_grinder", cat: "title", name: "Gridiron Grinder", rarity: "common", source: "free", text: "Gridiron Grinder" },
    { id: "title_filmroom", cat: "title", name: "Film Room Junkie", rarity: "common", source: "free", text: "Film Room Junkie" },
    { id: "title_twoway", cat: "title", name: "Two-Way Threat", rarity: "rare", source: "free", text: "Two-Way Threat" },
    { id: "title_friday", cat: "title", name: "Friday Night Legend", rarity: "rare", source: "earned", ach: "title", text: "Friday Night Legend" },
    { id: "title_pro", cat: "title", name: "Made the UFF", rarity: "rare", source: "earned", ach: "uff", text: "Made the UFF" },
    { id: "title_ringbearer", cat: "title", name: "Ring Bearer", rarity: "epic", source: "earned", ach: "ring", text: "Ring Bearer" },
    { id: "title_century", cat: "title", name: "Century Club", rarity: "epic", source: "earned", ach: "td100", text: "Century Club" },
    { id: "title_family", cat: "title", name: "Family Business", rarity: "epic", source: "earned", ach: "gen3", text: "Family Business" },
    { id: "title_mvp", cat: "title", name: "League MVP", rarity: "legendary", source: "earned", ach: "mvp", text: "League MVP" },
    { id: "title_hof", cat: "title", name: "Hall of Famer", rarity: "legendary", source: "earned", ach: "hof", text: "Hall of Famer" },
    { id: "title_dynasty", cat: "title", name: "Dynasty", rarity: "legendary", source: "earned", ach: "rings3", text: "Dynasty" },
    { id: "title_immortal", cat: "title", name: "Immortal", rarity: "mythic", source: "earned", ach: "rings5", text: "Immortal" },
    { id: "title_starborn", cat: "title", name: "Starborn", rarity: "mythic", source: "earned", ach: "interstellar", text: "Starborn" },
    { id: "title_patriarch", cat: "title", name: "The Patriarch", rarity: "mythic", source: "earned", ach: "gen5", text: "The Patriarch" },
    { id: "title_legend", cat: "title", name: "Living Legend", rarity: "mythic", source: "earned", ach: "legacy300", text: "Living Legend" },
    { id: "title_showtime", cat: "title", name: "Showtime", rarity: "epic", source: "member", text: "Showtime" },
    { id: "title_main", cat: "title", name: "Main Character", rarity: "legendary", source: "member", text: "Main Character" },
    { id: "title_built", cat: "title", name: "Built Different", rarity: "legendary", source: "member", text: "Built Different" },
    // BADGES — an enamel pin: a glyph on a shape (b158), in two colours
    { id: "badge_captain", cat: "badge", name: "Captain", rarity: "common", source: "free", glyph: "C", b158: "shield", col: "#c8102e", col2: "#5a0610" },
    { id: "badge_iron", cat: "badge", name: "Iron Man", rarity: "common", source: "free", glyph: "🛡️", b158: "round", col: "#9aa3b2", col2: "#3a4252" },
    { id: "badge_playmaker", cat: "badge", name: "Playmaker", rarity: "rare", source: "free", glyph: "🎯", b158: "hex", col: "#18c3b8", col2: "#0b3a36" },
    { id: "badge_champ", cat: "badge", name: "Champion", rarity: "rare", source: "earned", ach: "title", glyph: "🏆", b158: "star", col: "#f0bb45", col2: "#6b4a0e" },
    { id: "badge_league", cat: "badge", name: "The League", rarity: "rare", source: "earned", ach: "uff", glyph: "🏈", b158: "shield", col: "#1f5fbf", col2: "#0c1a33" },
    { id: "badge_ringed", cat: "badge", name: "Ringed", rarity: "epic", source: "earned", ach: "ring", glyph: "💍", b158: "diamond", col: "#e6c46a", col2: "#3b1f7a" },
    { id: "badge_century", cat: "badge", name: "Century", rarity: "epic", source: "earned", ach: "td100", glyph: "💯", b158: "shield", col: "#ff7a1a", col2: "#3a1008" },
    { id: "badge_bloodline", cat: "badge", name: "Bloodline", rarity: "epic", source: "earned", ach: "gen3", glyph: "🌳", b158: "round", col: "#5fae4a", col2: "#1a3a14" },
    { id: "badge_mvp", cat: "badge", name: "MVP", rarity: "legendary", source: "earned", ach: "mvp", glyph: "⭐", b158: "star", col: "#ffd76f", col2: "#8a6414", fx: 1 },
    { id: "badge_enshrined", cat: "badge", name: "Enshrined", rarity: "legendary", source: "earned", ach: "hof", glyph: "🏛️", b158: "hex", col: "#ece8df", col2: "#5a4a2a", fx: 1 },
    { id: "badge_starbound", cat: "badge", name: "Starbound", rarity: "mythic", source: "earned", ach: "interstellar", glyph: "🪐", b158: "round", col: "#b9a6ff", col2: "#2a1650", fx: 1 },
    { id: "badge_diamond", cat: "badge", name: "Diamond", rarity: "legendary", source: "member", glyph: "💎", b158: "diamond", col: "#bfefff", col2: "#1f5f8a", fx: 1 },
    { id: "badge_phoenix", cat: "badge", name: "Phoenix", rarity: "mythic", source: "member", glyph: "🔥", b158: "star", col: "#ffb02e", col2: "#8a180a", fx: 1 },
    // NAMEPLATES — a material under his name (np is the class; plate stays the still fallback)
    { id: "plate_team", cat: "nameplate", name: "Team Plate", rarity: "common", source: "free", np: "team", plate: "linear-gradient(90deg,#1f4fd0,#e8c86a)" },
    { id: "plate_stone", cat: "nameplate", name: "Engraved Stone", rarity: "common", source: "free", np: "stone", plate: "linear-gradient(180deg,#9a968e,#6e6a62)" },
    { id: "plate_oak", cat: "nameplate", name: "Carved Oak", rarity: "common", source: "free", np: "oak", plate: "linear-gradient(180deg,#8a5a2e,#5a3a1e)" },
    { id: "plate_carbon", cat: "nameplate", name: "Carbon Fibre", rarity: "common", source: "free", np: "carbon", plate: "repeating-linear-gradient(45deg,#15181d 0 3px,#23272e 3px 6px)" },
    { id: "plate_neon", cat: "nameplate", name: "Neon", rarity: "rare", source: "free", np: "neon", plate: "#12051f" },
    { id: "plate_chrome", cat: "nameplate", name: "Chrome", rarity: "rare", source: "earned", ach: "uff", np: "chrome", plate: "linear-gradient(180deg,#f4f7fb,#9aa6b8 50%,#e6ecf5)" },
    { id: "plate_varsity", cat: "nameplate", name: "Varsity Felt", rarity: "rare", source: "earned", ach: "icon:ico_t4_1", np: "varsity", plate: "#8a1c2b" },
    { id: "plate_frost", cat: "nameplate", name: "Frosted", rarity: "rare", source: "earned", ach: "icon:ico_t3_1", np: "frost", plate: "linear-gradient(180deg,#eaf7ff,#9fd4ff)" },
    { id: "plate_gold", cat: "nameplate", name: "Gold Leaf", rarity: "epic", source: "earned", ach: "title", np: "gold", plate: "linear-gradient(180deg,#fff3c4,#e6b53a 45%,#8a6414)" },
    { id: "plate_marble", cat: "nameplate", name: "Marble", rarity: "legendary", source: "earned", ach: "hof", np: "marble", plate: "linear-gradient(135deg,#f3f0ea,#c9c4ba)" },
    { id: "plate_diamond", cat: "nameplate", name: "Diamond", rarity: "mythic", source: "earned", ach: "interstellar", np: "diamond", plate: "linear-gradient(135deg,#ffffff,#bfefff)" },
    { id: "plate_magma", cat: "nameplate", name: "Magma", rarity: "epic", source: "member", np: "magma", plate: "linear-gradient(180deg,#3a0a04,#0a0202)" },
    { id: "plate_holo", cat: "nameplate", name: "Holographic", rarity: "legendary", source: "member", np: "holo", plate: "linear-gradient(90deg,#ffd6f0,#d6f0ff,#e0ffd6)" },
    { id: "plate_galaxy", cat: "nameplate", name: "Starfield", rarity: "mythic", source: "member", np: "galaxy", plate: "linear-gradient(90deg,#1a0f33,#05030f)" },
    // CARD FRAMES — an animated ring round the card (FRAMES_V158A draws each)
    { id: "frame_team", cat: "frame", name: "Team Stripe", rarity: "common", source: "free", css: "team158", anim: 1 },
    { id: "frame_pixel", cat: "frame", name: "8-Bit Border", rarity: "common", source: "free", css: "pixel158", anim: 1 },
    { id: "frame_sakura", cat: "frame", name: "Blossom", rarity: "rare", source: "free", css: "sakura158", anim: 1 },
    { id: "frame_toxic", cat: "frame", name: "Toxic", rarity: "rare", source: "free", css: "toxic158", anim: 1 },
    { id: "frame_glacier", cat: "frame", name: "Glacier Glass", rarity: "rare", source: "earned", ach: "title", css: "glacier158", anim: 1 },
    { id: "frame_marquee", cat: "frame", name: "Marquee Lights", rarity: "epic", source: "earned", ach: "uff", css: "marquee158", anim: 1 },
    { id: "frame_ember", cat: "frame", name: "Ember", rarity: "epic", source: "earned", ach: "td100", css: "ember158", anim: 1 },
    { id: "frame_aurora", cat: "frame", name: "Aurora Ring", rarity: "legendary", source: "earned", ach: "rings3", css: "aurora158", anim: 1 },
    { id: "frame_laurel", cat: "frame", name: "Laurel Wreath", rarity: "legendary", source: "earned", ach: "hof", css: "laurel158", anim: 1 },
    { id: "frame_obsidian", cat: "frame", name: "Obsidian Edge", rarity: "legendary", source: "earned", ach: "legacy300", css: "obsidian158", anim: 1 },
    { id: "frame_filigree", cat: "frame", name: "Gilded Filigree", rarity: "legendary", source: "earned", ach: "rings5", css: "filigree158", anim: 1 },
    { id: "frame_starlight", cat: "frame", name: "Starlight", rarity: "mythic", source: "earned", ach: "interstellar", css: "starlight158", anim: 1 },
    { id: "frame_livewire", cat: "frame", name: "Live Wire", rarity: "legendary", source: "member", css: "livewire158", anim: 1 },
    { id: "frame_prism", cat: "frame", name: "Prism", rarity: "mythic", source: "member", css: "prism158", anim: 1 },
    // TROPHY SHELVES
    { id: "shelf_carbon", cat: "shelf", name: "Carbon Rack", rarity: "common", source: "free", css: "carbon158" },
    { id: "shelf_locker", cat: "shelf", name: "Locker Room", rarity: "common", source: "free", css: "locker158" },
    { id: "shelf_stone", cat: "shelf", name: "Stone Plinth", rarity: "common", source: "free", css: "stone158" },
    { id: "shelf_neon", cat: "shelf", name: "Neon Bar", rarity: "rare", source: "earned", ach: "uff", css: "neon158" },
    { id: "shelf_ice", cat: "shelf", name: "Ice Case", rarity: "rare", source: "earned", ach: "icon:ico_t3_1", css: "ice158" },
    { id: "shelf_walnut", cat: "shelf", name: "Walnut & Brass", rarity: "epic", source: "earned", ach: "mvp", css: "walnut158" },
    { id: "shelf_velvet", cat: "shelf", name: "Velvet Rope", rarity: "epic", source: "earned", ach: "rings3", css: "velvet158" },
    { id: "shelf_diamond", cat: "shelf", name: "Diamond Case", rarity: "mythic", source: "earned", ach: "interstellar", css: "diamond158" },
    { id: "shelf_holo", cat: "shelf", name: "Hologram Dock", rarity: "legendary", source: "member", css: "holo158" },
    { id: "shelf_galaxy", cat: "shelf", name: "Starfield Case", rarity: "mythic", source: "member", css: "galaxy158" },
    // RECAP THEMES
    { id: "recap_vhs", cat: "recap", name: "VHS Tape", rarity: "common", source: "free", css: "vhs" },
    { id: "recap_blueprint", cat: "recap", name: "Blueprint", rarity: "common", source: "free", css: "blueprint" },
    { id: "recap_stone", cat: "recap", name: "Chiselled", rarity: "common", source: "free", css: "stone" },
    { id: "recap_comic", cat: "recap", name: "Comic Book", rarity: "rare", source: "free", css: "comic" },
    { id: "recap_ticker", cat: "recap", name: "Bottom Line", rarity: "rare", source: "earned", ach: "uff", css: "ticker" },
    { id: "recap_arcade", cat: "recap", name: "Arcade", rarity: "rare", source: "earned", ach: "icon:ico_sc_5", css: "arcade" },
    { id: "recap_cover", cat: "recap", name: "Cover Story", rarity: "epic", source: "earned", ach: "mvp", css: "cover" },
    { id: "recap_cosmic", cat: "recap", name: "Cosmic Edition", rarity: "mythic", source: "member", css: "cosmic" },
    // VAULT THEMES
    { id: "vault_sapphire", cat: "vault", name: "Sapphire", rarity: "common", source: "free", vt: { coin: "#3f7fe0", coinMix: 0.5, room: "#0c1a33", roomMix: 0.5, mote: "#9fc3ff" } },
    { id: "vault_bronze", cat: "vault", name: "Bronze Age", rarity: "common", source: "free", vt: { coin: "#c07a45", coinMix: 0.55, room: "#2a1a0c", roomMix: 0.5, mote: "#ffcfa0" } },
    { id: "vault_jade", cat: "vault", name: "Jade", rarity: "rare", source: "free", vt: { coin: "#2fbf8a", coinMix: 0.5, room: "#0c2a22", roomMix: 0.5, mote: "#b8ffe0" } },
    { id: "vault_ruby", cat: "vault", name: "Ruby", rarity: "rare", source: "earned", ach: "title", vt: { coin: "#e0434f", coinMix: 0.5, room: "#2a0a10", roomMix: 0.55, mote: "#ffb8c0" } },
    { id: "vault_amethyst", cat: "vault", name: "Amethyst", rarity: "epic", source: "earned", ach: "ring", vt: { coin: "#a05ae0", coinMix: 0.5, room: "#1c0f33", roomMix: 0.55, mote: "#e0c8ff" } },
    { id: "vault_sunset", cat: "vault", name: "Sunset Hoard", rarity: "epic", source: "earned", ach: "uff", vt: { coin: "#ff8a3d", coinMix: 0.45, room: "#3a1430", roomMix: 0.5, mote: "#ffd0a0" } },
    { id: "vault_midnight", cat: "vault", name: "Midnight", rarity: "legendary", source: "earned", ach: "hof", vt: { coin: "#6f86b8", coinMix: 0.5, room: "#05070d", roomMix: 0.65, mote: "#c9d6ff" } },
    { id: "vault_aurora", cat: "vault", name: "Aurora", rarity: "legendary", source: "member", vt: { coin: "#3fffb0", coinMix: 0.4, room: "#06121c", roomMix: 0.6, mote: "#9dffe0" } },
    { id: "vault_solar", cat: "vault", name: "Solar Flare", rarity: "mythic", source: "member", vt: { coin: "#ffb02e", coinMix: 0.35, room: "#2a0a02", roomMix: 0.6, mote: "#fff3a0" } },
    // STADIUMS (home games)
    { id: "std_dusk", cat: "stadium", name: "Dusk", rarity: "common", source: "free", st: { band: "#3a2350", lip: "#ff9a3d", crowd: "#ffd0b0", ez: "dusk" } },
    { id: "std_forest", cat: "stadium", name: "Forest Bowl", rarity: "common", source: "free", st: { band: "#1f3a24", lip: "#9dcf6a", crowd: "#d8f0c0", ez: "forest" } },
    { id: "std_sunset", cat: "stadium", name: "Sunset Strip", rarity: "rare", source: "free", st: { band: "#5c1a3a", lip: "#ffb02e", crowd: "#ffd8e8", ez: "sunset" } },
    { id: "std_steel", cat: "stadium", name: "Steel City", rarity: "rare", source: "earned", ach: "title", st: { band: "#2e343d", lip: "#d9dee6", crowd: "#e6ecf5", ez: "steel" } },
    { id: "std_royal", cat: "stadium", name: "Royal Purple", rarity: "epic", source: "earned", ach: "ring", st: { band: "#2b1a5a", lip: "#e6c46a", crowd: "#e8d8ff", ez: "royal" } },
    { id: "std_emerald", cat: "stadium", name: "Emerald City", rarity: "epic", source: "earned", ach: "mvp", st: { band: "#0f3a26", lip: "#3fbf7f", crowd: "#c8ffe0", ez: "emerald" } },
    { id: "std_arctic", cat: "stadium", name: "Arctic Night", rarity: "legendary", source: "earned", ach: "rings3", st: { band: "#0c2238", lip: "#bfe6ff", crowd: "#e8f6ff", ez: "ice" } },
    { id: "std_inferno", cat: "stadium", name: "Inferno Pit", rarity: "legendary", source: "member", st: { band: "#3a0804", lip: "#ff7a1a", crowd: "#ffc890", ez: "fire" } },
    { id: "std_galaxy", cat: "stadium", name: "Galactic", rarity: "mythic", source: "member", st: { band: "#150a2e", lip: "#b98bff", crowd: "#e0d0ff", ez: "galaxy" } },
    // TOUCHDOWN CELEBRATIONS
    { id: "cel_team_fireworks", cat: "celebration", name: "Team Fireworks", rarity: "common", source: "free", c: { kind: "fireworks", col: ["team", "#ffffff", "#ffd76f"], say: "FOR THE SCHOOL" } },
    { id: "cel_snowday", cat: "celebration", name: "Snow Day", rarity: "common", source: "free", c: { kind: "snow", col: ["#ffffff", "#e8f6ff", "#cfe8ff"], say: "SNOW DAY" } },
    { id: "cel_arcade", cat: "celebration", name: "Arcade Burst", rarity: "rare", source: "free", c: { kind: "pixel", col: ["#57e07a", "#b8ff6f", "#ffffff", "#1f8a4a"], say: "HIGH SCORE" } },
    { id: "cel_thunder", cat: "celebration", name: "Thunder Clap", rarity: "epic", source: "earned", ach: "uff", c: { kind: "bolt", col: ["#e0b8ff", "#ffffff", "#9a4bff"], say: "THUNDER" } },
    { id: "cel_supernova", cat: "celebration", name: "Supernova", rarity: "epic", source: "earned", ach: "interstellar", c: { kind: "shock", col: ["#fff3c4", "#ff9a3d", "#ff5ab4"], say: "SUPERNOVA" } },
    { id: "cel_goldwings", cat: "celebration", name: "Golden Wings", rarity: "legendary", source: "earned", ach: "hof", c: { kind: "feathers", col: ["#ffd76f", "#fff3c4", "#e6b53a"], say: "HALL BOUND" } },
    { id: "cel_ringrain", cat: "celebration", name: "Ring Rain", rarity: "legendary", source: "earned", ach: "rings3", c: { kind: "rain", col: ["#e6ecf5", "#ffd76f", "#ffffff"], say: "RINGS" } },
    { id: "cel_dragonfire", cat: "celebration", name: "Dragon Fire", rarity: "legendary", source: "member", c: { kind: "flame", col: ["#b8ff6f", "#3fbf4a", "#0f5a2a"], say: "DRAGON FIRE" } },
    { id: "cel_blackhole", cat: "celebration", name: "Black Hole", rarity: "mythic", source: "member", c: { kind: "halo", col: ["#b98bff", "#ffffff", "#2a1650"], say: "GONE" } },
    // NUMBER FONTS — the new faces (FACES_V158A draws each; the old nf_* are redrawn by style)
    { id: "nf_pro", cat: "numfont", name: "Pro Block", rarity: "common", source: "free", nf: { style: "pro", font: "Impact, 'Arial Black', sans-serif", col: "#ffffff", stroke: "#0a0e14" } },
    { id: "nf_condensed", cat: "numfont", name: "Tall Condensed", rarity: "common", source: "free", nf: { style: "condensed", font: "'Arial Narrow', Oswald, sans-serif", col: "#ffffff", stroke: "#0a0e14" } },
    { id: "nf_camo", cat: "numfont", name: "Field Camo", rarity: "common", source: "free", nf: { style: "camo", font: "Impact, sans-serif", col: "#6b7a4a", stroke: "#0e120a" } },
    { id: "nf_collegiate", cat: "numfont", name: "Collegiate Serif", rarity: "rare", source: "free", nf: { style: "collegiate", font: "Georgia, serif", col: "#e8c86a", stroke: "#0a0e14" } },
    { id: "nf_pixel", cat: "numfont", name: "8-Bit", rarity: "rare", source: "free", nf: { style: "pixel", font: "'Courier New', monospace", col: "#ffffff", stroke: "#0a0e14" } },
    { id: "nf_bubble", cat: "numfont", name: "Bubble", rarity: "rare", source: "free", nf: { style: "bubble", font: "'Trebuchet MS', sans-serif", col: "#ff9ad5", stroke: "#3a0a2a" } },
    { id: "nf_hollow", cat: "numfont", name: "Hollow Outline", rarity: "rare", source: "earned", ach: "title", nf: { style: "hollow", font: "Impact, sans-serif", col: "#e8c86a", stroke: "#0a0e14" } },
    { id: "nf_italic", cat: "numfont", name: "Speed Italic", rarity: "rare", source: "earned", ach: "icon:ico_t4_1", nf: { style: "italic", font: "Impact, sans-serif", col: "#ffffff", stroke: "#0a0e14" } },
    { id: "nf_script", cat: "numfont", name: "Script", rarity: "epic", source: "earned", ach: "ring", nf: { style: "script", font: "'Brush Script MT', cursive", col: "#ffffff", stroke: "#0a0e14" } },
    { id: "nf_digital", cat: "numfont", name: "Scoreboard LED", rarity: "epic", source: "earned", ach: "icon:ico_sc_5", nf: { style: "digital", font: "'Courier New', monospace", col: "#ffb02e", stroke: "#1a1004" } },
    { id: "nf_retro", cat: "numfont", name: "Retro '70s", rarity: "epic", source: "earned", ach: "gen3", nf: nfStyleV153G("retro") },
    { id: "nf_gothic", cat: "numfont", name: "Gothic", rarity: "legendary", source: "earned", ach: "hof", nf: { style: "gothic", font: "'Old English Text MT', Georgia, serif", col: "#f0e6d0", stroke: "#1a0f08" } },
    { id: "nf_frost", cat: "numfont", name: "Frostbite", rarity: "legendary", source: "earned", ach: "rings3", nf: { style: "frost", font: "Impact, sans-serif", col: "#bfe6ff", stroke: "#0c2a4a" } },
    { id: "nf_molten", cat: "numfont", name: "Molten", rarity: "legendary", source: "member", nf: { style: "molten", font: "Impact, sans-serif", col: "#ff7a1a", stroke: "#2a0500" } },
    { id: "nf_galaxy", cat: "numfont", name: "Galaxy", rarity: "mythic", source: "member", nf: { style: "galaxy", font: "Oswald, sans-serif", col: "#b98bff", stroke: "#2a0f4a" } }
  ];
  /* the old banners' painters (their ids keep working: saves equip them) */
  var OLD_BAN_V158A = { ban_charcoal: ["brushed", ["#1b2230", "#0b0f16"]], ban_gridiron: ["turf", ["#1f5a2e", "#236633", "#ffffff"]], ban_lights: ["friday", ["#1a2436", "#0a0e15", "#fff6d8", "#f0bb45"]],
    ban_lineage: ["lineage", ["#3a2a0e", "#6b4e1a", "#e6c46a"]], ban_sunset: ["drive", ["#ff8a3d", "#b83b5e", "#3b1f4a"]], ban_aurora: ["borealis", ["#1e8c7a", "#6a4cc2", "#3fb6ff"]],
    ban_founder: ["founder", ["#0d0f14", "#15181f", "#e6c46a"]] };
  (function addV158A() {
    ITEMS_V158A.forEach(function (it) {
      if (BY[it.id]) return;
      it.packs = []; it.v158 = 1;
      it.preview = function (el) { return previewInto(el, it); };
      ITEMS.push(it); BY[it.id] = it;
    });
    Object.keys(OLD_BAN_V158A).forEach(function (id) { var it = BY[id]; if (it && !it.b158) { it.b158 = OLD_BAN_V158A[id][0]; it.col = OLD_BAN_V158A[id][1]; } });
  })();
  /* an item earned by holding an earned ICON (`ach: "icon:<id>"`): v157 C's rules live in ACH_BY, not ACH, so checkEarned
   * never visits them — this does, after every earned check (boot, every save, the profile) */
  function iconEarnedTickV158A() {
    var got = [];
    try {
      var S = load();
      ITEMS_V158A.forEach(function (it) {
        if (it.source !== "earned" || !/^icon:/.test(it.ach || "") || S.owned[it.id]) return;
        if (S.owned[it.ach.slice(5)]) { grant(it.id, "earned"); got.push(it.id); }
      });
    } catch (e) { errV158A(e); }
    V158A.lastIconEarned = got; return got;
  }
  (function () { var ce = checkEarned; checkEarned = function (st) { var got = ce(st); try { iconEarnedTickV158A(); } catch (e) {} return got; }; })();

  /* ---------------- HELMET STRIPES: the art's own stripe, whatever way he faces ---------------- */
  function helmOnV158A() { return onV158A("v158Ahelm"); }
  function helmKindV158A(r, g, b) {
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2, sat = mx ? (mx - mn) / mx : 0, hue = 0;
    if (mx !== mn) { if (mx === r) hue = (60 * ((g - b) / (mx - mn)) + 360) % 360; else if (mx === g) hue = 60 * ((b - r) / (mx - mn)) + 120; else hue = 60 * ((r - g) / (mx - mn)) + 240; }
    if (hue >= 190 && hue <= 265 && sat > 0.15 && mx > 14) return 1;     // the navy shell (its dark folds too)
    if (hue >= 33 && hue <= 62 && sat > 0.3 && L > 18) return 2;          // the gold the artist drew: stripe and mask frame
    return 3;                                                             // outline, skin, the white mask bars
  }
  /* the helmet of one cell, from the RAW art `s`: m[y*W+x] = 0 not helmet · 1 shell · 2 stripe · 3 mask trim · 4 decal */
  function helmMaskV158A(s, W, Hh, head, top, srcName, H) {
    try {
      if (!H || !helmOnV158A()) return null;
      var N = W * Hh, m = new Uint8Array(N), kind = new Uint8Array(N), bot = head, x0 = 1e9, x1 = -1, y, x, j;
      for (y = 0; y < Hh; y++) for (x = 0; x < W; x++) { var i = (y * W + x) * 4; if (s[i + 3] < 20) continue; kind[y * W + x] = helmKindV158A(s[i], s[i + 1], s[i + 2]); if (y > bot) bot = y; if (x < x0) x0 = x; if (x > x1) x1 = x; }
      var lying = /^(dive|down|pancake|fall|getup|tackle|grab)/.test(String(srcName || "")) || (x1 - x0 + 1) > 1.3 * (bot - head + 1);
      if (lying) {   // a man on the ground: his head is not at the top of the cell — the old rows, shell only, no stripe to misplace
        for (y = head; y < top; y++) for (x = 0; x < W; x++) { j = y * W + x; if (kind[j] === 1 || kind[j] === 2) m[j] = 1; }
        V158A.helmLying = (V158A.helmLying | 0) + 1; return { m: m, lying: true };
      }
      // the dome: an ellipse fitted to the head's first rows (the shoulder pads beside the helmet's lower rows stay jersey)
      var U = Math.max(4, Math.round((top - head) * 0.55)), X0 = 1e9, X1 = -1;
      for (y = head; y <= Math.min(Hh - 1, head + U); y++) for (x = 0; x < W; x++) if (kind[y * W + x]) { if (x < X0) X0 = x; if (x > X1) X1 = x; }
      if (X1 < 0) return null;
      var cx = (X0 + X1) / 2, rx = (X1 - X0) / 2 + 0.5, ry = Math.max(4.5, rx * TUv("helmAspectV158A", 0.78)), cy = head + ry - 0.5, tol = TUv("helmTolV158A", 1.12);
      var yEnd = Math.min(top - 1, Math.floor(cy + ry * Math.sqrt(tol)));
      for (y = head; y <= yEnd; y++) for (x = 0; x < W; x++) {
        j = y * W + x; if (kind[j] !== 1 && kind[j] !== 2) continue;
        var ex = (x - cx) / rx, ey = (y - cy) / ry; if (ex * ex + ey * ey > tol) continue;
        m[j] = kind[j] === 1 ? 1 : 5;
      }
      // the stripe: the gold from the crown of the helmet down through the shell (8-connected, always touching shell)
      var shellNear = function (xx, yy) { for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var a = xx + dx, b = yy + dy; if (a >= 0 && b >= 0 && a < W && b < Hh && m[b * W + a] === 1) return true; } return false; };
      var q = [];
      for (y = head; y <= Math.min(yEnd, head + 3); y++) for (x = 0; x < W; x++) { j = y * W + x; if (m[j] === 5 && shellNear(x, y)) { m[j] = 2; q.push(j); } }
      while (q.length) {
        j = q.pop(); var qx = j % W, qy = (j / W) | 0;
        for (var dy2 = -1; dy2 <= 1; dy2++) for (var dx2 = -1; dx2 <= 1; dx2++) {
          var a2 = qx + dx2, b2 = qy + dy2; if (a2 < 0 || b2 < 0 || a2 >= W || b2 >= Hh) continue;
          var j2 = b2 * W + a2; if (m[j2] === 5 && shellNear(a2, b2)) { m[j2] = 2; q.push(j2); }
        }
      }
      for (j = 0; j < N; j++) if (m[j] === 5) m[j] = 3;   // the rest of the gold is the mask's frame
      // twin: two thin stripes either side of where the one ran · wide: the stripe and a pixel of shell each side
      if (H.sk === "wide" || H.sk === "twin") {
        var add = [];
        for (j = 0; j < N; j++) if (m[j] === 1) { var ax = j % W, ay = (j / W) | 0; if ((ax > 0 && m[j - 1] === 2) || (ax < W - 1 && m[j + 1] === 2) || (ay > 0 && m[j - W] === 2) || (ay < Hh - 1 && m[j + W] === 2)) add.push(j); }
        if (H.sk === "twin") for (j = 0; j < N; j++) if (m[j] === 2) m[j] = 1;
        add.forEach(function (k2) { m[k2] = 2; });
      }
      if (H.d) decalV158A(m, W, Hh, cy);
      var sn = 0, sx = 0, sy = 0; for (j = 0; j < N; j++) if (m[j] === 2) { sn++; sx += j % W; sy += (j / W) | 0; }
      V158A.helm++; V158A.lastHelm = { src: srcName, cx: +cx.toFixed(1), cy: +cy.toFixed(1), rx: +rx.toFixed(1), ry: +ry.toFixed(1), stripe: sn, scx: sn ? +(sx / sn).toFixed(1) : null, scy: sn ? +(sy / sn).toFixed(1) : null };
      return { m: m, cx: cx, cy: cy, rx: rx, ry: ry, dk: H.dk };
    } catch (e) { errV158A(e); return null; }
  }
  /* the decal on the side of the shell the viewer sees: a head seen from the front or behind shows both sides (one each),
   * a profile or a 3/4 view shows the side away from the stripe */
  function decalV158A(m, W, Hh, cy) {
    var st = 0, sx = 0, cand = [], y0 = Math.round(cy), x, y, j;
    for (j = 0; j < m.length; j++) if (m[j] === 2) { st++; sx += j % W; }
    for (y = y0 - 1; y <= y0 + 1; y++) for (x = 0; x < W; x++) {
      if (y < 0 || y >= Hh || m[y * W + x] !== 1) continue;
      var far = true; for (var dy = -2; dy <= 2 && far; dy++) for (var dx = -2; dx <= 2; dx++) { var a = x + dx, b = y + dy; if (a >= 0 && b >= 0 && a < W && b < Hh && m[b * W + a] === 2) { far = false; break; } }
      if (far) cand.push([x, y]);
    }
    if (!cand.length) return;
    var mid = st ? sx / st : cand.reduce(function (s, p) { return s + p[0]; }, 0) / cand.length;
    var L = cand.filter(function (p) { return p[0] < mid; }).sort(function (a, b) { return a[0] - b[0]; }), R = cand.filter(function (p) { return p[0] > mid; }).sort(function (a, b) { return a[0] - b[0]; });
    var put = function (p) { [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) { var a = p[0] + o[0], b = p[1] + o[1]; if (a >= 0 && b >= 0 && a < W && b < Hh && m[b * W + a] === 1) m[b * W + a] = 4; }); };
    var ctr = function (A) { var s1 = 0, s2 = 0; A.forEach(function (p) { s1 += p[0]; s2 += p[1]; }); return [Math.round(s1 / A.length), Math.round(s2 / A.length)]; };
    if (L.length >= 3 && R.length >= 3 && L.length <= R.length * 2 && R.length <= L.length * 2) { put(L[Math.floor(L.length * 0.3)]); put(R[Math.floor(R.length * 0.7)]); }
    else put(ctr(L.length >= R.length ? L : R));
  }
  /* kitDeco's pixel for a helmet code (the shell `out` is already shaded and finished) */
  function helmPaintV158A(out, code, HST, HD, s2) {
    var k = Math.min(1.2, Math.max(0.6, s2));
    if (code === 2) return HST ? HST.map(function (v) { return v * k; }) : out;
    if (code === 3) return HST ? mix(HST.map(function (v) { return v * k; }), [0, 0, 0], 0.12) : mix(out, [214, 218, 226], 0.55);
    if (code === 4) return HD ? HD.slice() : out;
    return out;
  }
  function helmClassV158A(s, i) {
    var r = s[i], g = s[i + 1], b = s[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2, k = helmKindV158A(r, g, b);
    return [1, k === 2 ? L / 165 : L / 95];
  }
  /* the profile figure (idle_dn_hi.png): twin / wide stripes and the decal, on the pixels figCell already recoloured */
  function figHelmV158A(d, src, W, H, K, geo) {
    try {
      if (!helmOnV158A() || !(K.hsk || K.hd)) return;
      var N = W * H, cls = new Uint8Array(N), tv = new Float32Array(N), x, y, j;
      for (y = 0; y < geo.neck; y++) for (x = 0; x < W; x++) {
        j = y * W + x; var i = j * 4; if (src[i + 3] < 20) continue;
        var ex = (x - geo.hx0) / geo.hrx, ey = (y - geo.hy0) / geo.hry; if (ex * ex + ey * ey > 1) continue;
        var c = srcClass(src[i], src[i + 1], src[i + 2]), face = y >= H * 0.2 && y < geo.neck + 6 && x > W * 0.28 && x < W * 0.75;
        if (c[0] === 1) { cls[j] = 1; tv[j] = c[1] / 32.5; }
        else if ((c[0] === 2 || (c[0] === 3 && !face)) && y < geo.visor) { cls[j] = 2; tv[j] = c[1] / 88; }
      }
      var HS = K.hs ? rgb(K.hs) : rgb(K.j), HST = K.hst ? rgb(K.hst) : rgb(K.p), R = Math.max(2, Math.round(W / 128 * 3));
      var paint = function (jj, col, t) { var o = shadeKit(col, t), ii = jj * 4; d[ii] = Math.max(0, Math.min(255, o[0])); d[ii + 1] = Math.max(0, Math.min(255, o[1])); d[ii + 2] = Math.max(0, Math.min(255, o[2])); };
      var dist = function (jj, lim) { var qx = jj % W, qy = (jj / W) | 0, best = 99; for (var dy = -lim; dy <= lim; dy++) for (var dx = -lim; dx <= lim; dx++) { var a = qx + dx, b = qy + dy; if (a < 0 || b < 0 || a >= W || b >= H) continue; if (cls[b * W + a] === 2) { var dd = Math.max(Math.abs(dx), Math.abs(dy)); if (dd < best) best = dd; } } return best; };
      if (K.hsk === "wide" || K.hsk === "twin") {
        var rim = [];
        for (j = 0; j < N; j++) if (cls[j] === 1) { var dd = dist(j, R + 2); if (K.hsk === "wide" ? dd <= R : (dd >= 1 && dd <= R + 1)) rim.push(j); }
        if (K.hsk === "twin") for (j = 0; j < N; j++) if (cls[j] === 2) paint(j, HS, Math.max(0.5, tv[j] * 0.9));
        rim.forEach(function (jj) { paint(jj, HST, tv[jj]); });
      }
      if (K.hd) {   // the decal: on the dome's side away from the stripe (the art's head turns to his left: the mask is on the right)
        var sn = 0, sx = 0; for (j = 0; j < N; j++) if (cls[j] === 2) { sn++; sx += j % W; }
        var mid = sn ? sx / sn : geo.hx0, pts = [];
        for (y = Math.round(geo.hy0 - geo.hry * 0.1); y <= Math.round(geo.hy0 + geo.hry * 0.25); y++) for (x = 0; x < W; x++) { j = y * W + x; if (cls[j] === 1 && dist(j, R * 2) > R * 2) pts.push([x, y]); }
        var L = pts.filter(function (p) { return p[0] < mid; }), Rt = pts.filter(function (p) { return p[0] > mid; }), side = L.length >= Rt.length ? L : Rt;
        if (side.length) {
          var cx = 0, cy = 0; side.forEach(function (p) { cx += p[0]; cy += p[1]; }); cx /= side.length; cy /= side.length;
          var rr = Math.max(3, W / 128 * 5.5), HD = rgb(K.hd), star = K.hdk === "star";
          for (y = Math.floor(cy - rr); y <= cy + rr; y++) for (x = Math.floor(cx - rr); x <= cx + rr; x++) {
            if (x < 0 || y < 0 || x >= W || y >= H) continue; j = y * W + x; if (cls[j] !== 1) continue;
            var ddx = x - cx, ddy = y - cy, r0 = Math.hypot(ddx, ddy);
            var inside = star ? r0 <= rr * (0.55 + 0.45 * Math.pow(Math.abs(Math.cos(2.5 * Math.atan2(ddy, ddx) + Math.PI / 2)), 3)) : r0 <= rr * 0.7;
            if (inside) { var ii = j * 4; var o = mix(HD, [255, 255, 255], r0 < rr * 0.3 ? 0.15 : 0); d[ii] = o[0]; d[ii + 1] = o[1]; d[ii + 2] = o[2]; }
          }
          V158A.figDecal = { x: +cx.toFixed(1), y: +cy.toFixed(1), star: star };
        }
      }
      V158A.figHelm = (V158A.figHelm | 0) + 1;
    } catch (e) { errV158A(e); }
  }

  /* ---------------- NUMBER FONTS: skeleton + pen + finish, rasterised at the height it is shown ---------------- */
  function nfOnV158A() { return onV158A("v158Anf"); }
  /* sk: sq (pro block) · rd (round) · seg (seven segments) · bit (3x5) — pen: square · round · nib (broad, angle na) · butt —
   * pw pen width in grid units (a digit is 4 x 6) · xs x-scale · slant · serif · chamfer · hollow · stencil · swash · speed ·
   * drip — finish: fill, ol outline rings [colour, k·H] innermost first, sh shadows [dx, dy, colour, alpha], bev, core, glow,
   * unlit, spark, gloss, plate. "T1" / "T2" are his team's colours. */
  var FACES_V158A = {
    varsity: { sk: "sq", pen: "square", pw: 1.35, serif: 1, fill: { t: "flat", c: "#ffffff" }, ol: [["T1", 0.07], ["#0a0e14", 0.05]], bev: 1 },
    block: { sk: "sq", pen: "square", pw: 1.5, fill: { t: "flat", c: "#ffffff" }, ol: [["#0a0e14", 0.08]] },
    stencil: { sk: "sq", pen: "square", pw: 1.45, stencil: 1, fill: { t: "flat", c: "#f0e6c8" }, ol: [["#2a2a2a", 0.07]] },
    gold: { sk: "rd", pen: "nib", na: 0, pw: 1.55, serif: 1, fill: { t: "gold" }, ol: [["#5a3d08", 0.07]], bev: 1, spark: 1 },
    neon: { sk: "rd", pen: "round", pw: 0.8, fill: { t: "flat", c: "#6ff7ff" }, core: "#ffffff", ol: [["#ff3df2", 0.05]], glow: "#ff3df2" },
    chrome: { sk: "sq", pen: "square", pw: 1.4, xs: 0.9, fill: { t: "chrome" }, ol: [["#2a3140", 0.07]], bev: 1 },
    retro: { sk: "rd", pen: "round", pw: 1.75, fill: { t: "flat", c: "#ff9a1f" }, ol: [["#fff3c4", 0.05]], sh: [[0.14, 0.14, "#3a1a08"], [0.07, 0.07, "#e0402b"]] },
    founder: { sk: "rd", pen: "nib", na: 0, pw: 1.45, serif: 1, fill: { t: "gold" }, ol: [["#0d0f14", 0.09]], bev: 1 },
    pro: { sk: "sq", pen: "square", pw: 1.4, gap: 1.1, fill: { t: "flat", c: "#ffffff" }, ol: [["T1", 0.05], ["#ffffff", 0.03], ["#0a0e14", 0.04]], sh: [[0.08, 0.08, "#000000", 0.55]] },
    condensed: { sk: "sq", pen: "square", pw: 1.05, xs: 0.62, gap: 0.7, fill: { t: "flat", c: "#ffffff" }, ol: [["#0a0e14", 0.06]] },
    camo: { sk: "sq", pen: "square", pw: 1.65, chamfer: 0.35, fill: { t: "camo" }, ol: [["#0e120a", 0.07]] },
    collegiate: { sk: "rd", pen: "nib", na: 0, pw: 1.65, serif: 1, fill: { t: "flat", c: "T2" }, ol: [["#ffffff", 0.06], ["#0a0e14", 0.045]] },
    pixel: { sk: "bit", fill: { t: "flat", c: "#ffffff" }, ol: [["#0a0e14", 0.07]], sh: [[0.08, 0.08, "#000000", 0.5]] },
    bubble: { sk: "rd", pen: "round", pw: 2.15, fill: { t: "flat", c: "#ff9ad5" }, ol: [["#3a0a2a", 0.08]], gloss: 1 },
    hollow: { sk: "sq", pen: "square", pw: 1.75, hollow: 0.42, fill: { t: "flat", c: "T2" }, ol: [["#0a0e14", 0.06]] },
    italic: { sk: "sq", pen: "square", pw: 1.4, slant: 0.24, speed: 1, fill: { t: "v", stops: [[0, "#ffffff"], [1, "#c9d6ff"]] }, ol: [["T1", 0.07], ["#0a0e14", 0.04]] },
    script: { sk: "rd", pen: "nib", na: -0.8, pw: 1.5, slant: 0.3, swash: 1, fill: { t: "flat", c: "#ffffff" }, ol: [["#0a0e14", 0.07]] },
    digital: { sk: "seg", pen: "butt", pw: 0.95, fill: { t: "flat", c: "#ffb02e" }, unlit: "#3a2a10", glow: "#ff8a1f", plate: "#0b0b0b" },
    gothic: { sk: "sq", pen: "nib", na: -0.8, pw: 1.7, chamfer: 0.9, serif: 1, fill: { t: "flat", c: "#f0e6d0" }, ol: [["#1a0f08", 0.08]], bev: 1 },
    frost: { sk: "sq", pen: "square", pw: 1.45, drip: 1, fill: { t: "v", stops: [[0, "#ffffff"], [0.5, "#bfe6ff"], [1, "#6fb6ff"]] }, ol: [["#0c2a4a", 0.07]], bev: 1 },
    molten: { sk: "sq", pen: "square", pw: 1.55, chamfer: 0.25, fill: { t: "fire" }, ol: [["#2a0500", 0.08]], glow: "#ff5a1a" },
    galaxy: { sk: "rd", pen: "round", pw: 1.65, fill: { t: "stars" }, ol: [["#1a0a3a", 0.05]], glow: "#b98bff" }
  };
  function arcV158A(cx, cy, rx, ry, a0, a1) { var pts = [], n = Math.max(4, Math.ceil(Math.abs(a1 - a0) / 12)); for (var i = 0; i <= n; i++) { var a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } return pts; }
  var SK_V158A = null;
  function skelV158A() {
    if (SK_V158A) return SK_V158A;
    var A = arcV158A;
    var sq = { 0: [[[0, 0], [4, 0], [4, 6], [0, 6], [0, 0]]], 1: [[[1, 1], [2.2, 0], [2.2, 6]]], 2: [[[0, 0], [4, 0], [4, 3], [0, 3], [0, 6], [4, 6]]], 3: [[[0, 0], [4, 0], [4, 6], [0, 6]], [[1.2, 3], [4, 3]]],
      4: [[[0, 0], [0, 3.6], [4, 3.6]], [[3, 0], [3, 6]]], 5: [[[4, 0], [0, 0], [0, 3], [4, 3], [4, 6], [0, 6]]], 6: [[[4, 0], [0, 0], [0, 6], [4, 6], [4, 3], [0, 3]]], 7: [[[0, 0], [4, 0], [4, 1.2], [1.6, 6]]],
      8: [[[0, 0], [4, 0], [4, 6], [0, 6], [0, 0]], [[0, 3], [4, 3]]], 9: [[[4, 3], [0, 3], [0, 0], [4, 0], [4, 6], [0, 6]]] };
    var sqSerif = { 1: [[[0.9, 6], [3.5, 6]]], 2: [[[0, 0], [0, 0.9]]], 3: [[[0, 0], [0, 0.9]], [[0, 6], [0, 5.1]]], 4: [[[2, 6], [4, 6]]], 5: [[[4, 0], [4, 0.9]]], 6: [[[4, 0], [4, 0.9]]], 7: [[[0, 0], [0, 1]]], 9: [[[0, 6], [0, 5.1]]] };
    var six = [A(2, 4.1, 1.95, 1.9, 0, 360), A(4, 4.1, 3.95, 4.1, 265, 180)];
    var rd = { 0: [A(2, 3, 2, 3, 0, 360)], 1: [[[0.9, 1.1], [2.2, 0], [2.2, 6]]], 2: [A(2, 1.9, 1.95, 1.9, 200, 380).concat([[0, 6], [4, 6]])],
      3: [A(2, 1.55, 1.85, 1.55, 205, 450), A(2, 4.45, 1.95, 1.55, 270, 520)], 4: [[[3, 6], [3, 0], [0, 4.1], [4, 4.1]]],
      5: [[[3.8, 0], [0.5, 0], [0.3, 2.7]], A(2, 4.1, 1.95, 1.9, 225, 520)], 6: six, 7: [[[0, 0], [4, 0], [1.5, 6]]],
      8: [A(2, 1.45, 1.65, 1.45, 0, 360), A(2, 4.45, 1.95, 1.55, 0, 360)], 9: six.map(function (p) { return p.map(function (q) { return [4 - q[0], 6 - q[1]]; }); }) };
    var rdSerif = { 1: [[[0.9, 6], [3.5, 6]]], 4: [[[2, 6], [4, 6]]], 7: [[[0, 0], [0, 0.9]]], 5: [[[3.8, 0], [3.8, 0.8]]] };
    var SEG = { a: [[0.45, 0], [3.55, 0]], b: [[4, 0.45], [4, 2.6]], c: [[4, 3.4], [4, 5.55]], d: [[0.45, 6], [3.55, 6]], e: [[0, 3.4], [0, 5.55]], f: [[0, 0.45], [0, 2.6]], g: [[0.45, 3], [3.55, 3]] };
    var seg = {}; ["abcdef", "bc", "abged", "abgcd", "fgbc", "afgcd", "afgedc", "abc", "abcdefg", "abcdfg"].forEach(function (s, i) { seg[i] = s.split("").map(function (c) { return SEG[c]; }); });
    var bit = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001010010010", "111101111101111", "111101111001111"];
    return (SK_V158A = { sq: sq, sqSerif: sqSerif, rd: rd, rdSerif: rdSerif, seg: seg, bit: bit });
  }
  function chamferV158A(paths, c) {
    return paths.map(function (p) {
      if (p.length < 3) return p;
      var n = p.length, closed = Math.abs(p[0][0] - p[n - 1][0]) < 1e-6 && Math.abs(p[0][1] - p[n - 1][1]) < 1e-6, out = [];
      var cut = function (a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, k = Math.min(c, L * 0.45) / L; return [a[0] + dx * k, a[1] + dy * k]; };
      for (var i = 0; i < n; i++) {
        if (closed && i === n - 1) break;
        var P = p[i], prev = i > 0 ? p[i - 1] : closed ? p[n - 2] : null, next = i < n - 1 ? p[i + 1] : null;
        if (!prev || !next) { out.push(P); continue; }
        out.push(cut(P, prev)); out.push(cut(P, next));
      }
      if (closed) out.push(out[0]);
      return out;
    });
  }
  /* the glyph ink: a 0/1 mask at pixel height IH (+ margins), with its ink box */
  function nfMaskV158A(F, txt, IH) {
    var S = skelV158A(), n = txt.length, W, H, M, i, x, y;
    if (F.sk === "bit") {
      var b = Math.max(1, Math.round(IH / 5)), gw = 3 * b, mg0 = 2;
      W = n * gw + (n - 1) * b + 2 * mg0; H = 5 * b + 2 * mg0; M = new Uint8Array(W * H);
      for (i = 0; i < n; i++) { var g = S.bit[+txt[i]] || S.bit[8]; for (var r = 0; r < 5; r++) for (var c = 0; c < 3; c++) if (g[r * 3 + c] === "1") for (y = 0; y < b; y++) for (x = 0; x < b; x++) M[(mg0 + r * b + y) * W + mg0 + i * (gw + b) + c * b + x] = 1; }
      return { m: M, w: W, h: H, bb: [mg0, mg0, W - mg0 - 1, H - mg0 - 1] };
    }
    var pw = F.pw || 1.4, xs = F.xs || 1, sl = F.slant || 0, k = IH / (6 + pw), P = pw * k, gwid = 4 * xs * k + P, gap = (F.gap != null ? F.gap : 0.9) * k;
    var mg = Math.ceil(P * 0.6) + 2, lm = F.speed ? Math.ceil(2.6 * k) : 0, extra = F.swash ? Math.ceil(k * 1.6) : 0, sw = Math.ceil(sl * 6 * k);
    W = Math.ceil(n * gwid + (n - 1) * gap + sw + 2 * mg + lm + (F.swash ? k * 1.5 : 0)); H = Math.ceil(IH + 2 * mg + extra);
    var cv = document.createElement("canvas"); cv.width = W; cv.height = H; var cx = cv.getContext("2d");
    var X = function (gi, p) { return mg + lm + gi * (gwid + gap) + p[0] * xs * k + P / 2 + sl * (6 - p[1]) * k; }, Y = function (p) { return mg + p[1] * k + P / 2; };
    var paths = function (d) {
      var set = F.sk === "rd" ? S.rd : F.sk === "seg" ? S.seg : S.sq, base = (set[d] || []).slice();
      if (F.serif && F.sk !== "seg") base = base.concat((F.sk === "rd" ? S.rdSerif : S.sqSerif)[d] || []);
      return F.chamfer ? chamferV158A(base, F.chamfer) : base;
    };
    var strokeAll = function (lw, off) {
      for (var gi = 0; gi < n; gi++) { var d = +txt[gi]; if (isNaN(d)) continue;
        paths(d).forEach(function (p) { cx.beginPath(); p.forEach(function (q, j) { var px = X(gi, q) + (off ? off[0] : 0), py = Y(q) + (off ? off[1] : 0); if (j) cx.lineTo(px, py); else cx.moveTo(px, py); }); cx.lineWidth = lw; cx.stroke(); }); }
    };
    cx.strokeStyle = "#000"; cx.fillStyle = "#000"; cx.miterLimit = 3;
    cx.lineCap = F.pen === "round" ? "round" : F.pen === "butt" ? "butt" : "square"; cx.lineJoin = F.pen === "round" ? "round" : "miter";
    if (F.pen === "nib") {   // a broad nib: many thin strokes along the nib's edge — thick one way, thin the other
      cx.lineCap = "round"; cx.lineJoin = "round";
      var a = F.na || 0, half = P * 0.5, step = Math.max(0.4, P / 12);
      for (var o = -half; o <= half + 1e-6; o += step) strokeAll(Math.max(1, P * 0.26), [Math.cos(a) * o, Math.sin(a) * o]);
    } else strokeAll(P);
    if (F.hollow) { cx.globalCompositeOperation = "destination-out"; cx.lineCap = "round"; strokeAll(P * F.hollow); cx.globalCompositeOperation = "source-over"; }
    if (F.stencil) { cx.globalCompositeOperation = "destination-out"; [1.9, 4.1].forEach(function (gy) { var t = Math.max(1, Math.round(k * 0.34)); cx.fillRect(0, Math.round(mg + gy * k + P / 2 - t / 2), W, t); }); cx.globalCompositeOperation = "source-over"; }
    if (F.swash) {   // the script's tail: a swoosh under the numbers
      cx.lineCap = "round"; cx.lineWidth = Math.max(1.5, P * 0.5); cx.beginPath();
      var yb = mg + 6.9 * k + P / 2; cx.moveTo(X(0, [-0.4, 6.4]) - sl * 0.4 * k, yb - k * 0.2);
      cx.quadraticCurveTo((X(0, [0, 6]) + X(n - 1, [4, 6])) / 2, yb + k * 0.9, X(n - 1, [5.2, 5.6]) + k * 0.6, yb - k * 1.3); cx.stroke();
    }
    if (F.speed) { cx.lineCap = "butt"; cx.lineWidth = Math.max(1, P * 0.34); [1.2, 3, 4.8].forEach(function (gy, j) { cx.beginPath(); var yy = Y([0, gy]); cx.moveTo(mg + j * k * 0.5, yy); cx.lineTo(mg + lm - k * 0.5 + sl * (6 - gy) * k, yy); cx.stroke(); }); }
    var id = cx.getImageData(0, 0, W, H).data; M = new Uint8Array(W * H);
    for (i = 0; i < W * H; i++) M[i] = id[i * 4 + 3] >= 128 ? 1 : 0;
    if (F.drip) {   // icicles: every third column whose ink ends at the bottom of a bar grows a short taper
      for (x = 0; x < W; x++) { var lo = -1; for (y = H - 1; y >= 0; y--) if (M[y * W + x]) { lo = y; break; } if (lo < 0 || lo < mg + IH * 0.72) continue;
        var len = Math.round(IH * (0.06 + 0.1 * rV158A(x, 3))); if (x % 3 !== 1 || len < 1) continue;
        for (y = 1; y <= len && lo + y < H; y++) M[(lo + y) * W + x] = 1; }
    }
    var x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (M[y * W + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) { x0 = y0 = 0; x1 = W - 1; y1 = H - 1; }
    return { m: M, w: W, h: H, bb: [x0, y0, x1, y1] };
  }
  function dilateV158A(A, W, H, r) {
    var B = new Uint8Array(W * H), r2 = r * r + r * 0.8;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      if (A[y * W + x]) { B[y * W + x] = 1; continue; }
      var hit = 0; for (var dy = -r; dy <= r && !hit; dy++) { var yy = y + dy; if (yy < 0 || yy >= H) continue; for (var dx = -r; dx <= r; dx++) { var xx = x + dx; if (xx < 0 || xx >= W || dx * dx + dy * dy > r2) continue; if (A[yy * W + xx]) { hit = 1; break; } } }
      B[y * W + x] = hit;
    }
    return B;
  }
  function lerpStopsV158A(stops, t) {
    t = Math.max(0, Math.min(1, t));
    for (var i = 1; i < stops.length; i++) if (t <= stops[i][0]) { var a = stops[i - 1], b = stops[i], u = (t - a[0]) / Math.max(1e-6, b[0] - a[0]); return mix(rgb(colV158A(a[1])), rgb(colV158A(b[1])), u); }
    return rgb(colV158A(stops[stops.length - 1][1]));
  }
  function nfFillV158A(f, t, x, y) {
    var ty = f.t;
    if (ty === "flat") return rgb(colV158A(f.c));
    if (ty === "v") return lerpStopsV158A(f.stops, t);
    if (ty === "gold") { var g = lerpStopsV158A([[0, "#fff6d0"], [0.42, "#ffd76f"], [0.58, "#c9951f"], [1, "#f0c850"]], t); return ((x + y) % 9 === 0) ? mix(g, [255, 255, 255], 0.3) : g; }
    if (ty === "chrome") return lerpStopsV158A([[0, "#ffffff"], [0.44, "#a9b4c6"], [0.5, "#4a5260"], [0.56, "#dfe6f0"], [1, "#7a8494"]], t);
    if (ty === "stars") { var h = rV158A(x * 31 + y, 11); var base = lerpStopsV158A([[0, "#b98bff"], [0.45, "#6a4cff"], [1, "#3a2a9a"]], t); return h > 0.93 ? [255, 255, 255] : h > 0.88 ? [255, 190, 235] : base; }
    if (ty === "fire") { var fh = rV158A((x >> 1) * 17 + (y >> 1), 5); var fc = lerpStopsV158A([[0, "#fff3a0"], [0.3, "#ffb02e"], [0.65, "#ff5a1a"], [1, "#a8180a"]], t); return fh > 0.9 ? mix(fc, [40, 6, 0], 0.6) : fc; }
    if (ty === "camo") { var ch = rV158A((x >> 1) * 7 + (y >> 1) * 131, 9); return rgb(["#4c5a3a", "#6b7a4a", "#2a3122", "#8a8a5a"][Math.floor(ch * 4)]); }
    return [255, 255, 255];
  }
  var NFC_V158A = {}, NFC_N_V158A = 0;
  /* the rendered number: {cv, w, h, ix, iy, iw, ih} — ix..iw the glyph ink box inside the canvas (outline and effects around it) */
  function nfRenderV158A(style, txt, IH) {
    var F = FACES_V158A[style]; if (!F) return null;
    txt = String(txt == null ? "" : txt).replace(/[^0-9]/g, "").slice(0, 2); if (!txt) return null;
    IH = Math.max(6, Math.round(IH));
    var key = style + "|" + txt + "|" + IH + "|" + teamCol(0) + teamCol(1); if (NFC_V158A[key]) return NFC_V158A[key];
    try {
      var mk = nfMaskV158A(F, txt, IH), rK = function (k) { return Math.max(1, Math.round(IH * k)); };
      var ols = (F.ol || []).map(function (o) { return { c: rgb(colV158A(o[0])), r: rK(o[1]) }; }), rOut = ols.reduce(function (s, o) { return s + o.r; }, 0);
      var shs = (F.sh || []).map(function (q) { return { dx: rK(q[0]), dy: rK(q[1]), c: rgb(colV158A(q[2])), a: q[3] == null ? 1 : q[3] }; });
      var shMax = shs.reduce(function (s, q) { return Math.max(s, q.dx, q.dy); }, 0), gl = F.glow ? Math.max(2, Math.round(IH * 0.2)) : 0, pl = F.plate ? Math.max(2, Math.round(IH * 0.16)) : 0;
      var pad = rOut + shMax + gl + pl + 1, W = mk.w + 2 * pad, H = mk.h + 2 * pad, N = W * H, j, x, y;
      var base = new Uint8Array(N); for (y = 0; y < mk.h; y++) for (x = 0; x < mk.w; x++) if (mk.m[y * mk.w + x]) base[(y + pad) * W + x + pad] = 1;
      var masks = [base]; ols.forEach(function (o) { masks.push(dilateV158A(masks[masks.length - 1], W, H, o.r)); });
      var outer = masks[masks.length - 1];
      var cv = document.createElement("canvas"); cv.width = W; cv.height = H; var cx = cv.getContext("2d"), im = cx.createImageData(W, H), d = im.data;
      var put = function (jj, c, a) { var i = jj * 4, A = a == null ? 1 : a, B = d[i + 3] / 255, O = A + B * (1 - A); if (O <= 0) return; for (var q = 0; q < 3; q++) d[i + q] = (c[q] * A + d[i + q] * B * (1 - A)) / O; d[i + 3] = O * 255; };
      var bx0 = mk.bb[0] + pad, by0 = mk.bb[1] + pad, bx1 = mk.bb[2] + pad, by1 = mk.bb[3] + pad;
      if (pl) {   // the LED panel behind a scoreboard number
        var pc = rgb(colV158A(F.plate)); for (y = by0 - pl; y <= by1 + pl; y++) for (x = bx0 - pl; x <= bx1 + pl; x++) { if (x < 0 || y < 0 || x >= W || y >= H) continue; var cor = (x - bx0 < 0 ? bx0 - x : x - bx1 > 0 ? x - bx1 : 0) + (y - by0 < 0 ? by0 - y : y - by1 > 0 ? y - by1 : 0); if (cor <= pl * 1.2) put(y * W + x, pc, 0.92); }
      }
      shs.forEach(function (q) { for (var jj = 0; jj < N; jj++) if (outer[jj]) { var sx = (jj % W) + q.dx, sy = ((jj / W) | 0) + q.dy; if (sx < W && sy < H) put(sy * W + sx, q.c, q.a); } });
      for (var r = ols.length - 1; r >= 0; r--) { var mm = masks[r + 1]; for (j = 0; j < N; j++) if (mm[j]) put(j, ols[r].c); }
      if (F.unlit) {   // the LED segments that are off, dim
        var um = nfMaskV158A(F, txt.replace(/\d/g, "8"), IH), uc = rgb(colV158A(F.unlit));
        for (y = 0; y < um.h; y++) for (x = 0; x < um.w; x++) if (um.m[y * um.w + x] && !base[(y + pad) * W + x + pad]) put((y + pad) * W + x + pad, uc);
      }
      for (j = 0; j < N; j++) {
        if (!base[j]) continue;
        x = j % W; y = (j / W) | 0;
        var c = nfFillV158A(F.fill || { t: "flat", c: "#ffffff" }, (y - by0) / Math.max(1, by1 - by0), x, y);
        if (F.bev) { if (y > 0 && !base[j - W]) c = mix(c, [255, 255, 255], 0.45); else if (y < H - 1 && !base[j + W]) c = mix(c, [0, 0, 0], 0.3); }
        if (F.gloss && y > 1 && !base[j - 2 * W] && (y - by0) < (by1 - by0) * 0.5) c = mix(c, [255, 255, 255], 0.55);
        if (F.core && base[j - 1] && base[j + 1] && base[j - W] && base[j + W]) c = mix(c, rgb(colV158A(F.core)), 0.75);
        put(j, c);
      }
      if (F.spark) for (j = 0; j < N; j++) if (base[j] && rV158A(j, 23) > 0.985) put(j, [255, 255, 255]);
      cx.putImageData(im, 0, 0);
      if (gl) {   // the glow: the outline's silhouette in the glow colour, blurred, under the art
        var gcv = document.createElement("canvas"); gcv.width = W; gcv.height = H; var gx = gcv.getContext("2d"), gim = gx.createImageData(W, H), gc = rgb(colV158A(F.glow));
        for (j = 0; j < N; j++) if (outer[j]) { gim.data[j * 4] = gc[0]; gim.data[j * 4 + 1] = gc[1]; gim.data[j * 4 + 2] = gc[2]; gim.data[j * 4 + 3] = 255; }
        gx.putImageData(gim, 0, 0);
        var out = document.createElement("canvas"); out.width = W; out.height = H; var ox = out.getContext("2d");
        try { ox.filter = "blur(" + Math.max(1, gl * 0.55).toFixed(1) + "px)"; } catch (e) {}
        ox.globalAlpha = 0.85; ox.drawImage(gcv, 0, 0); ox.filter = "none"; ox.globalAlpha = 1; ox.drawImage(cv, 0, 0); cv = out;
      }
      var res = { cv: cv, w: W, h: H, ix: bx0, iy: by0, iw: bx1 - bx0 + 1, ih: by1 - by0 + 1, style: style, txt: txt, IH: IH };
      if (++NFC_N_V158A > 400) { NFC_V158A = {}; NFC_N_V158A = 0; }
      NFC_V158A[key] = res; V158A.nums++;
      return res;
    } catch (e) { errV158A(e); return null; }
  }
  function nfFaceOfV158A(nf) { return nf && nfOnV158A() && FACES_V158A[nf.style] ? nf.style : null; }
  /* the profile chest (chestNumberV157C calls this first): the art at the device pixel height, pixel-snapped */
  function chestNumV158A(cv, res, num, nfId, C) {
    try {
      var style = nfFaceOfV158A(nfOfV157C(nfId)); if (!style) return null;
      var g = res.geo, x = cv.getContext("2d"), s = String(num | 0), dpr = g.dpr || 1;
      var sx = g.bw / C.W, cx = g.bx + C.cx * sx, cy = g.by + (C.row - g.neck) * g.k;
      var px = Math.max(8, (C.waist - C.neck) * g.k * TUv("nfChestHV157C", 0.58)), maxW = C.w * sx * TUv("nfChestWV157C", 0.92);
      var IH = Math.round(px * TUv("nfChestInkV158A", 0.74) * dpr), r = nfRenderV158A(style, s, IH); if (!r) return null;
      if (r.iw > maxW * dpr) { r = nfRenderV158A(style, s, Math.max(6, Math.floor(IH * maxW * dpr / r.iw))); if (!r) return null; }
      x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.imageSmoothingEnabled = false;
      x.drawImage(r.cv, Math.round(cx * dpr - r.ix - r.iw / 2), Math.round(cy * dpr - r.iy - r.ih / 2));
      x.restore();
      V158A.chest = { style: style, num: s, IH: r.IH, iw: r.iw, ih: r.ih };
      return { num: s, nf: style, px: +px.toFixed(1), cx: +cx.toFixed(1), cy: +cy.toFixed(1), v158: true, ih: r.ih };
    } catch (e) { errV158A(e); return null; }
  }
  /* the field: an image over his label (which goes transparent), sized to the ink height the v157 C label has */
  var NFMETA_V158A = {};
  function fieldNumV158A(m, N) {
    try {
      var L = m && m.label, style = N && N.d ? nfFaceOfV158A(N.d) : null;
      if (!style || !L || !m.root || !m.body) { dropNumV158A(m, null); return false; }
      var scene = m.root.scene; if (!scene || !scene.textures) return false;
      var txt = String(L.text != null ? L.text : m.num != null ? m.num : "").replace(/[^0-9]/g, ""); if (!txt) { dropNumV158A(m, null); return false; }
      var IH = TUv("nfFieldPxV158A", 18), key = "nf158_" + (hsh(style + "|" + txt + "|" + IH + "|" + teamCol(0) + teamCol(1)) >>> 0).toString(36);
      var R = NFMETA_V158A[key];
      if (!R || !scene.textures.exists(key)) { R = nfRenderV158A(style, txt, IH); if (!R) return false; try { if (scene.textures.exists(key)) scene.textures.remove(key); scene.textures.addCanvas(key, R.cv); } catch (e) { return false; } NFMETA_V158A[key] = R; }
      var img = m._nfImgV158A;
      if (img && (!img.scene || !img.active)) img = m._nfImgV158A = null;
      if (!img) { img = m._nfImgV158A = scene.add.image(0, 0, key); m.root.add(img); }
      else if (img.texture.key !== key) img.setTexture(key);
      var Hs = m.body.scaleY || 1, sc0 = m._numScaleV104 || L.scaleX || 1, cap = (m._numCapV104 || 6) * Hs * (L.scaleX / Math.max(1e-4, sc0)), k = cap / R.ih;
      var b = m._numBandV104, maxW = b ? b.w * Math.abs(m.body.scaleX || 1) * TUv("nfWidthV157C", 0.82) : 1e9; if (R.iw * k > maxW) k = maxW / R.iw;
      var inkY = m._numRowV104 != null ? (m._numRowV104 + 0.5 - 24) * Hs : L.y;
      img.setOrigin((R.ix + R.iw / 2) / R.w, (R.iy + R.ih / 2) / R.h).setPosition(L.x, inkY).setScale(k).setVisible(!!L.visible);
      if (onV159A("v159Anum")) { if (m._quarterV159A && m._quarterV159A !== 1) img.scaleX = img.scaleX * m._quarterV159A; if (img.alpha !== TUv("v159AnumA", 0.9)) img.setAlpha(TUv("v159AnumA", 0.9)); } else if (img.alpha !== 1) img.setAlpha(1);   // v159 A
      var list = m.root.list; if (list[list.length - 1] !== img) { try { m.root.bringToTop(img); } catch (e) {} }
      if (L.alpha !== 0) { L.setAlpha(0); m._nfLblV158A = 1; }
      V158A.field = { key: key, style: style, txt: txt, k: +k.toFixed(4), vis: !!L.visible, ih: R.ih, cap: +cap.toFixed(2) };
      return true;
    } catch (e) { errV158A(e); return false; }
  }
  function dropNumV158A(m, N) {
    try {
      if (!m) return;
      var img = m._nfImgV158A;
      if (img) { if (N) { img.setVisible(false); return; } try { img.destroy(); } catch (e) {} m._nfImgV158A = null; }
      if (m._nfLblV158A && m.label) { m.label.setAlpha(1); m._nfLblV158A = 0; }
    } catch (e) { errV158A(e); }
  }
  /* the Locker's preview: his number on a jersey in his team's colour */
  function nfPreviewV158A(x, it, nn) {
    var style = nfFaceOfV158A(it.nf); if (!style) return false;
    var r = nfRenderV158A(style, nn, 24); if (!r) return false;
    if (r.iw > 40) r = nfRenderV158A(style, nn, Math.floor(24 * 40 / r.iw)) || r;
    x.save(); x.imageSmoothingEnabled = false; x.drawImage(r.cv, Math.round(32 - r.ix - r.iw / 2), Math.round(35 - r.iy - r.ih / 2)); x.restore();
    return true;
  }

  /* ---------------- BANNERS: one painter per kind, a pure function of (w, h, t, palette) ---------------- */
  function banOnV158A() { return onV158A("v158Aban"); }
  function vgV158A(x, y0, y1, stops) { var g = x.createLinearGradient(0, y0, 0, y1); stops.forEach(function (s) { g.addColorStop(s[0], colV158A(s[1])); }); return g; }
  function fillV158A(x, w, h, style) { x.fillStyle = style; x.fillRect(0, 0, w, h); }
  function glowV158A(x, cx, cy, r, col, a) { var g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, rgbaV158A(col, a)); g.addColorStop(1, rgbaV158A(col, 0)); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); }
  function starsV158A(x, w, h, t, n, seed, tw) { for (var i = 0; i < n; i++) { var a = 0.35 + 0.65 * Math.abs(Math.sin(t * (tw || 1.3) + i * 1.7)); x.fillStyle = "rgba(255,255,255," + (a * (0.4 + 0.6 * rV158A(i, seed + 2))).toFixed(3) + ")"; var s = rV158A(i, seed + 3) > 0.85 ? 1.6 : 1; x.fillRect(Math.floor(rV158A(i, seed) * w), Math.floor(rV158A(i, seed + 1) * h), s, s); } }
  function sheenV158A(x, w, h, t, period, a) { var p = ((t % period) + period) % period / period, cx = -w * 0.3 + p * w * 1.6, g = x.createLinearGradient(cx - 40, 0, cx + 40, h); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255," + a + ")"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, w, h); }
  function vignetteV158A(x, w, h, a) { var g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0," + a + ")"); x.fillStyle = g; x.fillRect(0, 0, w, h); }
  var BAN_V158A = {
    /* ---- the new banners ---- */
    sweep: function (x, w, h, t, C) {
      fillV158A(x, w, h, C[0]); x.fillStyle = C[1];
      var sp = 46, off = (t * 14) % sp;
      for (var bx = -h - sp + off; bx < w + h; bx += sp) { x.beginPath(); x.moveTo(bx, h); x.lineTo(bx + 16, h); x.lineTo(bx + 16 + h, 0); x.lineTo(bx + h, 0); x.closePath(); x.globalAlpha = 0.85; x.fill(); }
      x.globalAlpha = 1; vignetteV158A(x, w, h, 0.45); sheenV158A(x, w, h, t, 5, 0.18);
    },
    chalk: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, "#26462f"], [1, C[0]]]));
      for (var i = 0; i < 26; i++) { x.fillStyle = "rgba(255,255,255," + (0.03 + 0.04 * rV158A(i, 41)).toFixed(3) + ")"; x.fillRect(rV158A(i, 42) * w, rV158A(i, 43) * h, 14 + rV158A(i, 44) * 30, 2); }
      x.strokeStyle = C[1]; x.fillStyle = C[1]; x.lineWidth = 1.6; x.globalAlpha = 0.9;
      var los = h * 0.62; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(0, los); x.lineTo(w, los); x.stroke(); x.setLineDash([]);
      for (var o = 0; o < 5; o++) { x.beginPath(); x.arc(w * 0.46 + o * 12, los + 7, 4, 0, 6.283); x.stroke(); }
      [[0.3, 0.3], [0.62, 0.22], [0.74, 0.4], [0.52, 0.18]].forEach(function (p) { var px = w * p[0], py = h * p[1]; x.beginPath(); x.moveTo(px - 4, py - 4); x.lineTo(px + 4, py + 4); x.moveTo(px + 4, py - 4); x.lineTo(px - 4, py + 4); x.stroke(); });
      // the route draws itself, then rubs out
      var ph = (t % 4.5) / 3.2, pts = [[w * 0.2, los + 7], [w * 0.2, h * 0.28], [w * 0.42, h * 0.12], [w * 0.84, h * 0.12]], segs = pts.length - 1, want = Math.min(1, ph) * segs;
      x.lineWidth = 2; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
      for (var s = 0; s < segs && s < want; s++) { var u = Math.min(1, want - s), a = pts[s], b = pts[s + 1]; x.lineTo(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u); }
      x.globalAlpha = ph > 1.25 ? Math.max(0, 1 - (ph - 1.25) * 3) : 0.95; x.stroke();
      if (ph >= 1) { var e = pts[segs]; x.beginPath(); x.moveTo(e[0], e[1] - 5); x.lineTo(e[0] + 7, e[1]); x.lineTo(e[0], e[1] + 5); x.fill(); }
      x.globalAlpha = 1;
    },
    camo: function (x, w, h, t, C) {
      var s = 6, ox = Math.floor(t * 5);
      for (var gy = 0; gy * s < h; gy++) for (var gx = -1; gx * s < w + s; gx++) { var u = gx + ox, v = rV158A((u >> 1) * 31 + (gy >> 1), 1) * 0.6 + rV158A(u * 17 + gy * 7, 2) * 0.4; x.fillStyle = C[Math.min(C.length - 1, Math.floor(v * C.length))]; x.fillRect(gx * s - (t * 5 % 1) * s, gy * s, s, s); }
      vignetteV158A(x, w, h, 0.4);
    },
    rain: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, C[1]], [0.75, C[0]], [1, "#0f2a1a"]]));
      glowV158A(x, w * 0.18, 4, 46, "#fff6d8", 0.35); glowV158A(x, w * 0.82, 4, 46, "#fff6d8", 0.35);
      x.strokeStyle = rgbaV158A(C[2], 0.4); x.lineWidth = 1;
      for (var i = 0; i < 70; i++) { var sp = 160 + rV158A(i, 8) * 120, y = ((rV158A(i, 9) * (h + 20) + t * sp) % (h + 20)) - 10, xx = ((rV158A(i, 10) * (w + 40) - y * 0.3) % (w + 40)); x.beginPath(); x.moveTo(xx, y); x.lineTo(xx - 2.4, y + 8); x.stroke(); }
      x.fillStyle = "rgba(191,230,255,.12)"; for (var p = 0; p < 6; p++) { var r = ((t * 0.8 + p * 0.37) % 1) * 9; x.beginPath(); x.ellipse(w * (0.1 + p * 0.16), h - 5, r * 1.8, r * 0.5, 0, 0, 6.283); x.fill(); }
    },
    sunrise: function (x, w, h, t, C) {
      var hz = h * 0.74, sx = w * 0.7;
      fillV158A(x, w, h, vgV158A(x, 0, hz, [[0, C[2]], [0.6, C[1]], [1, C[0]]]));
      x.save(); x.translate(sx, hz); x.rotate(t * 0.05);
      for (var i = 0; i < 12; i++) { x.fillStyle = "rgba(255,240,200,.1)"; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, w, i * 0.5236, i * 0.5236 + 0.2); x.closePath(); x.fill(); }
      x.restore(); glowV158A(x, sx, hz, 40, "#fff3c4", 0.8);
      x.fillStyle = "#ffe08a"; x.beginPath(); x.arc(sx, hz, 13, Math.PI, 0); x.fill();
      x.fillStyle = "#1f5a2e"; x.fillRect(0, hz, w, h - hz); x.fillStyle = "#236633"; for (var s = 0; s < w; s += 36) x.fillRect(s, hz, 18, h - hz);
      x.strokeStyle = "#1b1b24"; x.lineWidth = 2.5; var gx = w * 0.16; x.beginPath(); x.moveTo(gx, hz); x.lineTo(gx, hz - 14); x.moveTo(gx - 12, hz - 14); x.lineTo(gx + 12, hz - 14); x.moveTo(gx - 12, hz - 14); x.lineTo(gx - 12, hz - 32); x.moveTo(gx + 12, hz - 14); x.lineTo(gx + 12, hz - 32); x.stroke();
    },
    hex: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, "#141b26"], [1, C[1]]]));
      var r = 9, hw = r * 1.732, c = rgb(colV158A(C[0]));
      for (var row = -1; row * r * 1.5 < h + r; row++) for (var col = -1; col * hw < w + hw; col++) {
        var cx = col * hw + (row % 2 ? hw / 2 : 0), cy = row * r * 1.5, dd = Math.hypot(cx - w * 0.3, cy - h * 0.5), a = 0.22 + 0.7 * Math.max(0, Math.sin(dd * 0.06 - t * 2.2));
        x.beginPath(); for (var k = 0; k < 6; k++) { var an = Math.PI / 6 + k * Math.PI / 3; x.lineTo(cx + (r - 1) * Math.cos(an), cy + (r - 1) * Math.sin(an)); } x.closePath();
        x.fillStyle = "rgba(" + c.join(",") + "," + (a * 0.35).toFixed(3) + ")"; x.fill(); x.strokeStyle = "rgba(" + c.join(",") + "," + a.toFixed(3) + ")"; x.lineWidth = 1; x.stroke();
      }
    },
    skyline: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, C[2]], [0.55, C[1]], [1, C[0]]]));
      glowV158A(x, w * 0.3, h * 0.95, 34, "#ffd08a", 0.7);
      [[0.35, "#3a1f4a", 9, 0.9], [0.62, "#1a1030", 16, 1]].forEach(function (L, li) {
        var off = (t * L[2]) % 400;
        for (var i = -1; i < 40; i++) { var bw = 14 + rV158A(i, 30 + li) * 22, bh = h * (0.3 + rV158A(i, 32 + li) * L[0]), bx = i * 22 - off;
          x.fillStyle = L[1]; x.fillRect(bx, h - bh, bw, bh);
          if (li) for (var wy = h - bh + 4; wy < h - 3; wy += 5) for (var wx = bx + 3; wx < bx + bw - 3; wx += 5) { var q = rV158A(Math.floor(wx * 3 + wy * 7 + i), 36); if (q > 0.55) { x.fillStyle = q > 0.9 + 0.08 * Math.sin(t * 2 + i) ? "rgba(255,240,180,.25)" : "rgba(255,220,140,.85)"; x.fillRect(wx, wy, 2, 2); } } }
      });
    },
    snow: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, C[0]], [1, C[1]]]));
      glowV158A(x, w * 0.75, 0, 60, "#d6ecff", 0.35);
      x.fillStyle = "rgba(240,248,255,.85)"; x.fillRect(0, h - 6, w, 6);
      for (var i = 0; i < 70; i++) { var z = rV158A(i, 51), sp = 10 + z * 22, y = (rV158A(i, 52) * h + t * sp) % h, xx = (rV158A(i, 53) * w + Math.sin(t * 0.9 + i) * 6 + w) % w, s = 0.8 + z * 1.8; x.globalAlpha = 0.45 + z * 0.55; x.beginPath(); x.arc(xx, y, s, 0, 6.283); x.fillStyle = C[2]; x.fill(); }
      x.globalAlpha = 1;
    },
    waves: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, C[2]], [0.4, C[1]], [1, C[0]]]));
      glowV158A(x, w * 0.8, h * 0.18, 26, "#fff6d8", 0.8);
      [[0.42, 0.9, "#1a8ab0", 0.05], [0.58, 1.3, "#0f6a8a", 0.07], [0.74, 1.8, "#0b4a66", 0.09]].forEach(function (L, i) {
        x.beginPath(); x.moveTo(0, h);
        for (var xx = 0; xx <= w; xx += 4) x.lineTo(xx, h * L[0] + Math.sin(xx * L[3] + t * L[1] + i) * 4 + Math.sin(xx * 0.021 - t * 0.7) * 3);
        x.lineTo(w, h); x.closePath(); x.fillStyle = L[2]; x.fill();
        x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 1; x.beginPath();
        for (var x2 = 0; x2 <= w; x2 += 4) { var yy = h * L[0] + Math.sin(x2 * L[3] + t * L[1] + i) * 4 + Math.sin(x2 * 0.021 - t * 0.7) * 3; if (x2) x.lineTo(x2, yy); else x.moveTo(x2, yy); } x.stroke();
      });
    },
    board: function (x, w, h, t, C) {
      fillV158A(x, w, h, "#07060a");
      var TXT = "TOUCHDOWN   GAME TIME   ", F5 = FONT5_V158A, sp = 3.2, cols = Math.ceil(w / sp), rows = 7, oy = (h - rows * sp) / 2, lit = rgb(colV158A(C[0])), dim = rgb(colV158A(C[1]));
      var bits = []; TXT.split("").forEach(function (ch) { var g = F5[ch] || F5[" "]; for (var c = 0; c < 5; c++) bits.push(g.map(function (row) { return row[c] === "1"; })); bits.push([0, 0, 0, 0, 0, 0, 0].map(function () { return false; })); });
      var shift = Math.floor(t * 9);
      for (var cx = 0; cx < cols; cx++) { var col = bits[(cx + shift) % bits.length]; for (var ry = 0; ry < rows; ry++) { var on = col[ry]; x.fillStyle = on ? "rgb(" + lit.join(",") + ")" : "rgb(" + dim.join(",") + ")"; x.beginPath(); x.arc(cx * sp + sp / 2, oy + ry * sp + sp / 2, on ? 1.25 : 0.9, 0, 6.283); x.fill(); } }
      glowV158A(x, w / 2, h / 2, w * 0.5, C[0], 0.08);
    },
    lava: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, C[0]], [1, "#5a1a4a"]]));
      x.globalCompositeOperation = "lighter";
      for (var i = 0; i < 7; i++) { var bx = w * (0.08 + i * 0.14) + Math.sin(t * 0.3 + i) * 10, by = h * 0.5 + Math.sin(t * (0.35 + i * 0.07) + i * 2) * h * 0.42, r = 12 + rV158A(i, 61) * 12; glowV158A(x, bx, by, r * 1.5, i % 2 ? C[1] : C[2], 0.55); }
      x.globalCompositeOperation = "source-over";
    },
    confetti: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, "#1a2436"], [1, "#0a0e15"]]));
      glowV158A(x, w * 0.5, 0, 70, "#fff6d8", 0.25);
      for (var i = 0; i < 60; i++) { var sp = 22 + rV158A(i, 71) * 30, y = (rV158A(i, 72) * (h + 10) + t * sp) % (h + 10) - 5, xx = (rV158A(i, 73) * w + Math.sin(t * 2 + i) * 5 + w) % w, fl = Math.cos(t * 5 + i);
        x.save(); x.translate(xx, y); x.rotate(i + t); x.scale(1, Math.abs(fl) * 0.9 + 0.1); x.fillStyle = C[i % C.length]; x.fillRect(-2.5, -1.2, 5, 2.4); x.restore(); }
    },
    trophy: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, C[0]], [1, C[1]]]));
      for (var p = 0; p < w; p += 24) { x.fillStyle = "rgba(0,0,0,.18)"; x.fillRect(p, 0, 1, h); x.fillStyle = "rgba(255,220,170,.05)"; x.fillRect(p + 1, 0, 1, h); }
      var sy = h * 0.8; x.fillStyle = "#2a1608"; x.fillRect(0, sy, w, 4); x.fillStyle = "rgba(255,220,170,.25)"; x.fillRect(0, sy, w, 1);
      for (var i = 0; i < 9; i++) {
        var cx = w * (0.06 + i * 0.11), kind = i % 3, g = x.createLinearGradient(cx - 6, 0, cx + 6, 0); g.addColorStop(0, "#8a6414"); g.addColorStop(0.45, "#ffe9a0"); g.addColorStop(1, "#b8861f"); x.fillStyle = g;
        if (kind === 0) { x.beginPath(); x.moveTo(cx - 7, sy - 22); x.lineTo(cx + 7, sy - 22); x.lineTo(cx + 4, sy - 12); x.lineTo(cx - 4, sy - 12); x.fill(); x.fillRect(cx - 1, sy - 12, 2, 6); x.fillRect(cx - 5, sy - 6, 10, 6); }
        else if (kind === 1) { x.beginPath(); x.ellipse(cx, sy - 12, 7, 5, -0.4, 0, 6.283); x.fill(); x.fillRect(cx - 4, sy - 5, 8, 5); }
        else { x.beginPath(); x.arc(cx, sy - 11, 6, 0, 6.283); x.lineWidth = 2.5; x.strokeStyle = g; x.stroke(); x.fillStyle = "#bfefff"; x.fillRect(cx - 2, sy - 20, 4, 3); }
        var ph = ((t * 0.9 - i * 0.37) % 3 + 3) % 3; if (ph < 0.35) { var a = 1 - Math.abs(ph - 0.17) / 0.17; x.fillStyle = "rgba(255,255,255," + a.toFixed(2) + ")"; x.fillRect(cx + 2, sy - 24, 1, 5); x.fillRect(cx, sy - 22, 5, 1); }
      }
      glowV158A(x, w * 0.5, -10, 80, "#fff3c4", 0.18);
    },
    stadium: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, C[0]], [1, C[1]]])); starsV158A(x, w, h * 0.5, t, 30, 80);
      [[0.55, 4, 0.5], [0.8, 8, 0.8], [1, 13, 1]].forEach(function (L, li) {
        var dx = Math.sin(t * 0.25) * L[1];
        for (var i = 0; i < 3; i++) { var px = w * (0.15 + i * 0.35) + dx + li * 17, top = h * (0.08 + (1 - L[0]) * 0.4), fl = 0.85 + 0.15 * Math.sin(t * 7 + i * 3 + li);
          x.fillStyle = "rgba(20,26,38," + L[2] + ")"; x.fillRect(px - 1, top + 6, 2, h - top);
          x.fillStyle = "rgba(255,246,216," + (0.07 * L[0] * fl).toFixed(3) + ")"; x.beginPath(); x.moveTo(px - 8, top + 4); x.lineTo(px + 8, top + 4); x.lineTo(px + 40 * L[0], h); x.lineTo(px - 40 * L[0], h); x.fill();
          glowV158A(x, px, top + 3, 16 * L[0], C[2], 0.5 * fl);
          x.fillStyle = C[2]; for (var b = 0; b < 4; b++) x.fillRect(px - 6 + b * 3.4, top, 2.2, 2.2 * L[0] + 1); }
      });
      x.fillStyle = "#070a10"; x.beginPath(); x.moveTo(0, h); for (var cx = 0; cx <= w; cx += 5) x.lineTo(cx, h - 7 - Math.abs(Math.sin(cx * 1.7)) * 3); x.lineTo(w, h); x.fill();
      for (var f = 0; f < 4; f++) { var q = Math.floor(t * 3) * 4 + f; if (rV158A(q, 91) > 0.6) glowV158A(x, rV158A(q, 92) * w, h - 7, 5, "#ffffff", 0.9); }
    },
    synth: function (x, w, h, t, C) {
      var hz = h * 0.58; fillV158A(x, w, h, vgV158A(x, 0, hz, [[0, C[0]], [0.7, "#5a1a6a"], [1, C[1]]])); starsV158A(x, w, hz * 0.7, t, 20, 100);
      var sx = w * 0.62, sr = 20, g = x.createLinearGradient(0, hz - sr, 0, hz); g.addColorStop(0, C[2]); g.addColorStop(1, C[1]);
      x.save(); x.beginPath(); x.arc(sx, hz, sr, Math.PI, 0); x.clip(); x.fillStyle = g; x.fillRect(sx - sr, hz - sr, sr * 2, sr);
      x.fillStyle = C[0]; for (var k = 0; k < 5; k++) { var yy = hz - 3 - k * 3.6 + (t * 4 % 3.6); x.fillRect(sx - sr, yy, sr * 2, 1 + k * 0.25); } x.restore();
      x.fillStyle = "#12051f"; x.fillRect(0, hz, w, h - hz); x.strokeStyle = C[1]; x.lineWidth = 1; x.globalAlpha = 0.8;
      for (var i = -12; i <= 12; i++) { x.beginPath(); x.moveTo(w / 2 + i * 8, hz); x.lineTo(w / 2 + i * 60, h); x.stroke(); }
      for (var r = 0; r < 7; r++) { var p = ((r + t * 0.9) % 7) / 7, yy2 = hz + (h - hz) * p * p; x.globalAlpha = 0.25 + p * 0.7; x.beginPath(); x.moveTo(0, yy2); x.lineTo(w, yy2); x.stroke(); }
      x.globalAlpha = 1;
    },
    flash: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, C[1]], [1, C[0]]])); glowV158A(x, w * 0.5, h * 0.3, 90, "#fff6d8", 0.12);
      for (var row = 0; row < 3; row++) for (var i = 0; i < 40; i++) { var cx = i * 11 + (row % 2) * 5.5 - 5, cy = h * 0.58 + row * 9; x.fillStyle = "rgba(6,8,12," + (0.7 + row * 0.1) + ")"; x.beginPath(); x.arc(cx, cy, 4.2, 0, 6.283); x.fill(); x.fillRect(cx - 5, cy + 3, 10, 10); }
      var slot = Math.floor(t * 7);
      for (var f = 0; f < 7; f++) { var q = slot * 7 + f, u = (t * 7) % 1; if (rV158A(q, 97) > 0.55) { var fx = rV158A(q, 98) * w, fy = h * 0.5 + rV158A(q, 99) * h * 0.35, a = Math.max(0, 1 - u * 1.6); glowV158A(x, fx, fy, 12, C[2], a); x.fillStyle = "rgba(255,255,255," + a.toFixed(2) + ")"; x.fillRect(fx - 6, fy, 12, 1); x.fillRect(fx, fy - 6, 1, 12); } }
    },
    marble: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, "#f3f0ea"], [0.5, C[0]], [1, "#d8d2c6"]]));
      x.lineWidth = 1;
      for (var i = 0; i < 9; i++) { x.strokeStyle = "rgba(120,112,100," + (0.18 + rV158A(i, 111) * 0.25).toFixed(2) + ")"; x.beginPath(); var sx = rV158A(i, 112) * w, sy = -5; x.moveTo(sx, sy);
        x.bezierCurveTo(sx + (rV158A(i, 113) - 0.5) * 120, h * 0.3, sx + (rV158A(i, 114) - 0.5) * 160, h * 0.7, sx + (rV158A(i, 115) - 0.5) * 90, h + 5); x.stroke(); }
      [[0, 4], [h - 5, 5]].forEach(function (b) { var g = x.createLinearGradient(0, b[0], 0, b[0] + b[1]); g.addColorStop(0, "#fff3c4"); g.addColorStop(0.5, C[2]); g.addColorStop(1, "#8a6414"); x.fillStyle = g; x.fillRect(0, b[0], w, b[1]); });
      sheenV158A(x, w, h, t, 4.5, 0.45);
    },
    aurora: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, "#040a14"], [1, "#0b1a24"]])); starsV158A(x, w, h, t, 34, 120);
      x.globalCompositeOperation = "lighter";
      for (var k = 0; k < 3; k++) { var c = rgb(colV158A(C[k % C.length]));
        for (var xx = 0; xx < w; xx += 3) { var top = h * 0.12 + Math.sin(xx * 0.018 + t * 0.55 + k * 2) * 8 + Math.sin(xx * 0.05 - t * 0.9 + k) * 4, len = h * (0.35 + 0.2 * Math.sin(xx * 0.03 + t * 0.4 + k * 1.3)), a = 0.16 + 0.12 * Math.sin(xx * 0.04 + t * 1.1 + k);
          var g = x.createLinearGradient(0, top, 0, top + len); g.addColorStop(0, "rgba(" + c.join(",") + ",0)"); g.addColorStop(0.25, "rgba(" + c.join(",") + "," + a.toFixed(3) + ")"); g.addColorStop(1, "rgba(" + c.join(",") + ",0)"); x.fillStyle = g; x.fillRect(xx, top, 3, len); } }
      x.globalCompositeOperation = "source-over";
      x.fillStyle = "#03060a"; x.beginPath(); x.moveTo(0, h); for (var m = 0; m <= w; m += 12) x.lineTo(m, h - 5 - Math.abs(Math.sin(m * 0.07)) * 8); x.lineTo(w, h); x.fill();
    },
    dynasty: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, "#1a1c24"], [1, C[0]]]));
      glowV158A(x, w * 0.5, 0, 80, "#fff3c4", 0.15);
      for (var i = 0; i < 7; i++) { var px = w * (0.09 + i * 0.137), sw = Math.sin(t * 0.8 + i) * 0.05;
        x.save(); x.translate(px, 2); x.rotate(sw); x.fillStyle = i % 2 ? C[1] : "#1f2a4a"; x.beginPath(); x.moveTo(-10, 0); x.lineTo(10, 0); x.lineTo(10, h * 0.62); x.lineTo(0, h * 0.78); x.lineTo(-10, h * 0.62); x.closePath(); x.fill();
        x.strokeStyle = C[2]; x.lineWidth = 1; x.stroke(); x.fillStyle = C[2]; x.font = "700 7px Oswald, sans-serif"; x.textAlign = "center"; x.fillText(["I", "II", "III", "IV", "V", "VI", "VII"][i], 0, h * 0.52);
        var ph = ((t * 0.7 - i * 0.4) % 3 + 3) % 3; x.beginPath(); x.arc(0, h * 0.25, 4, 0, 6.283); x.lineWidth = 1.6; x.strokeStyle = ph < 0.3 ? "#ffffff" : C[2]; x.stroke(); x.restore(); }
    },
    rays: function (x, w, h, t, C) {
      fillV158A(x, w, h, C[0]); var cx = w * 0.3, cy = h * 0.5;
      x.save(); x.translate(cx, cy); x.rotate(t * 0.12);
      for (var i = 0; i < 18; i++) { x.fillStyle = i % 2 ? "rgba(255,215,111,.22)" : "rgba(255,243,196,.1)"; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, w, i * 0.349, i * 0.349 + 0.349); x.closePath(); x.fill(); }
      x.restore(); glowV158A(x, cx, cy, 44, C[1], 0.7); glowV158A(x, cx, cy, 16, C[2], 0.9);
      for (var s = 0; s < 14; s++) { var a = Math.abs(Math.sin(t * 1.4 + s * 1.9)); x.fillStyle = "rgba(255,243,196," + a.toFixed(2) + ")"; x.fillRect(rV158A(s, 131) * w, rV158A(s, 132) * h, 1.5, 1.5); }
    },
    hole: function (x, w, h, t, C) {
      fillV158A(x, w, h, "#000000"); starsV158A(x, w, h, t, 50, 140, 0.8);
      var cx = w * 0.6, cy = h * 0.5;
      glowV158A(x, cx, cy, 60, C[1], 0.45);
      x.save(); x.translate(cx, cy); x.scale(1, 0.28);
      for (var k = 0; k < 26; k++) { var r = 20 + k * 1.6, a0 = t * (2.2 - k * 0.05) + k * 0.7; x.strokeStyle = k < 8 ? "rgba(255,243,196,.7)" : "rgba(255,154,61," + (0.55 - k * 0.018).toFixed(3) + ")"; x.lineWidth = 1.2; x.beginPath(); x.arc(0, 0, r, a0, a0 + 2.2); x.stroke(); x.beginPath(); x.arc(0, 0, r, a0 + 3.3, a0 + 4.6); x.stroke(); }
      x.restore();
      x.fillStyle = "#000"; x.beginPath(); x.arc(cx, cy, 13, 0, 6.283); x.fill(); x.strokeStyle = "rgba(255,230,180,.85)"; x.lineWidth = 1.4; x.beginPath(); x.arc(cx, cy, 14, 0, 6.283); x.stroke();
    },
    galaxy: function (x, w, h, t, C) {
      fillV158A(x, w, h, C[0]);
      x.globalCompositeOperation = "lighter";
      glowV158A(x, w * 0.25 + Math.sin(t * 0.1) * 10, h * 0.4, 70, C[1], 0.35); glowV158A(x, w * 0.55, h * 0.7, 60, C[2], 0.25); glowV158A(x, w * 0.85, h * 0.3, 55, C[3], 0.3);
      var cx = w * 0.66, cy = h * 0.5;
      for (var i = 0; i < 160; i++) { var arm = i % 2, rr = 3 + (i / 160) * 70, an = rr * 0.09 + arm * Math.PI + t * 0.25, jit = (rV158A(i, 151) - 0.5) * 6; x.fillStyle = i % 5 ? "rgba(220,210,255,.7)" : "rgba(255,180,230,.9)"; x.fillRect(cx + Math.cos(an) * rr + jit, cy + Math.sin(an) * rr * 0.4 + jit * 0.4, 1.3, 1.3); }
      glowV158A(x, cx, cy, 12, "#ffffff", 0.8);
      x.globalCompositeOperation = "source-over"; starsV158A(x, w, h, t, 60, 160, 1.8);
    },
    storm: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, C[1]], [1, C[0]]]));
      var P = 3.4, k = Math.floor(t / P), ph = (t % P) / P, flash = ph < 0.08 ? 1 - ph / 0.08 : ph > 0.12 && ph < 0.16 ? 0.6 : 0;
      if (flash) { x.fillStyle = "rgba(220,235,255," + (0.35 * flash).toFixed(3) + ")"; x.fillRect(0, 0, w, h); }
      for (var c = 0; c < 22; c++) { var cx = ((rV158A(c, 171) * (w + 80) + t * (6 + rV158A(c, 172) * 8)) % (w + 80)) - 40, cy = h * (0.05 + rV158A(c, 173) * 0.4), r = 12 + rV158A(c, 174) * 16; x.fillStyle = "rgba(" + (40 + flash * 90 | 0) + "," + (46 + flash * 90 | 0) + "," + (58 + flash * 90 | 0) + ",.8)"; x.beginPath(); x.arc(cx, cy, r, 0, 6.283); x.fill(); }
      if (flash) {
        var bx = w * (0.15 + rV158A(k, 175) * 0.7), by = 0; x.strokeStyle = "rgba(255,255,255," + flash.toFixed(2) + ")"; x.lineWidth = 2; x.shadowColor = C[2]; x.shadowBlur = 8; x.beginPath(); x.moveTo(bx, by);
        for (var s = 0; s < 6; s++) { bx += (rV158A(k * 9 + s, 176) - 0.5) * 22; by += h / 6; x.lineTo(bx, by); } x.stroke(); x.shadowBlur = 0;
      }
      x.strokeStyle = "rgba(191,230,255,.2)"; x.lineWidth = 1; for (var i = 0; i < 40; i++) { var y = (rV158A(i, 177) * h + t * 200) % h, xx = rV158A(i, 178) * w; x.beginPath(); x.moveTo(xx, y); x.lineTo(xx - 2, y + 7); x.stroke(); }
    },
    holo: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, C[0]], [1, "#063a3a"]]));
      var hz = h * 0.45, c = rgb(colV158A(C[1])); x.strokeStyle = "rgba(" + c.join(",") + ",.45)"; x.lineWidth = 1;
      for (var i = -16; i <= 16; i++) { x.beginPath(); x.moveTo(w / 2 + i * 10, hz); x.lineTo(w / 2 + i * 70, h); x.stroke(); }
      for (var r = 0; r < 8; r++) { var p = ((r + t * 0.8) % 8) / 8, yy = hz + (h - hz) * p * p; x.beginPath(); x.moveTo(0, yy); x.lineTo(w, yy); x.stroke(); }
      // a wireframe football turning over the floor
      var fx = w * 0.72, fy = h * 0.34, rx = 22, ry = 11; x.strokeStyle = "rgba(" + c.join(",") + ",.9)"; x.beginPath(); x.ellipse(fx, fy, rx, ry, 0, 0, 6.283); x.stroke();
      for (var m = 0; m < 4; m++) { var a = t * 1.2 + m * Math.PI / 4, k = Math.cos(a); x.beginPath(); x.ellipse(fx, fy, Math.abs(k) * rx, ry, 0, 0, 6.283); x.stroke(); }
      var sy = (t * 30) % (h + 20) - 10; var g = x.createLinearGradient(0, sy - 6, 0, sy + 6); g.addColorStop(0, "rgba(185,255,248,0)"); g.addColorStop(0.5, "rgba(185,255,248,.35)"); g.addColorStop(1, "rgba(185,255,248,0)"); x.fillStyle = g; x.fillRect(0, sy - 6, w, 12);
      if ((t % 2.6) < 0.12) { var gy = rV158A(Math.floor(t / 2.6), 181) * h; try { x.drawImage(x.canvas, 0, gy * (x.canvas.height / h), x.canvas.width, 6 * x.canvas.height / h, 6, gy, w, 6); } catch (e) {} }
    },
    coins: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, C[0]], [1, "#3a2408"]])); glowV158A(x, w * 0.5, h, 90, C[1], 0.3);
      for (var p = 0; p < 26; p++) { x.fillStyle = p % 2 ? C[2] : C[1]; x.beginPath(); x.ellipse(rV158A(p, 191) * w, h - 3 - rV158A(p, 192) * 6, 6, 2.4, 0, 0, 6.283); x.fill(); }
      for (var i = 0; i < 24; i++) { var sp = 26 + rV158A(i, 193) * 30, y = (rV158A(i, 194) * (h + 20) + t * sp) % (h + 20) - 10, xx = rV158A(i, 195) * w, sw = Math.cos(t * 3.5 + i * 1.3), r = 4.2;
        var g = x.createLinearGradient(xx - r, y, xx + r, y); g.addColorStop(0, C[2]); g.addColorStop(0.5, "#fff3c4"); g.addColorStop(1, C[2]); x.fillStyle = g;
        x.beginPath(); x.ellipse(xx, y, Math.max(0.6, Math.abs(sw) * r), r, 0, 0, 6.283); x.fill(); x.strokeStyle = "rgba(90,60,8,.8)"; x.lineWidth = 0.7; x.stroke(); }
      sheenV158A(x, w, h, t, 3.8, 0.12);
    },
    fire: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, C[0]], [1, "#3a0804"]]));
      [[0.85, 0.9, "#8a180a", 0.9], [0.62, 1.4, C[1], 0.85], [0.4, 2.0, C[2], 0.8]].forEach(function (L, li) {
        var g = x.createLinearGradient(0, h * (1 - L[0]), 0, h); g.addColorStop(0, rgbaV158A(L[2], 0)); g.addColorStop(0.35, rgbaV158A(L[2], L[3])); g.addColorStop(1, rgbaV158A(L[2], 1));
        x.fillStyle = g; x.beginPath(); x.moveTo(0, h);
        for (var xx = 0; xx <= w; xx += 3) { var n = Math.sin(xx * 0.09 + t * 3 * L[1] + li) * 0.5 + Math.sin(xx * 0.23 - t * 5 + li * 2) * 0.3 + Math.sin(xx * 0.04 + t * 1.3) * 0.2; x.lineTo(xx, h - h * L[0] * (0.55 + 0.45 * n)); }
        x.lineTo(w, h); x.closePath(); x.fill();
      });
      for (var e = 0; e < 26; e++) { var sp = 18 + rV158A(e, 201) * 26, y = h - ((rV158A(e, 202) * h + t * sp) % h), xx = rV158A(e, 203) * w + Math.sin(t * 2 + e) * 4, a = y / h; x.fillStyle = "rgba(255," + (180 + (a * 60 | 0)) + ",80," + a.toFixed(2) + ")"; x.fillRect(xx, y, 1.5, 1.5); }
    },
    /* ---- the old banners, redrawn ---- */
    brushed: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, C[0]], [1, C[1]]]));
      for (var y = 0; y < h; y += 2) { x.fillStyle = "rgba(255,255,255," + (0.012 + 0.03 * rV158A(y, 211)).toFixed(3) + ")"; x.fillRect(0, y, w, 1); }
      glowV158A(x, w * (0.5 + 0.4 * Math.sin(t * 0.35)), h * 0.2, 60, "#8fa2bb", 0.12);
      sheenV158A(x, w, h, t, 7, 0.14); vignetteV158A(x, w, h, 0.3);
    },
    borealis: function (x, w, h, t, C) {   // the old Aurora: the lights over a still lake that gives them back
      var hz = h * 0.66; x.save(); x.beginPath(); x.rect(0, 0, w, hz); x.clip(); BAN_V158A.aurora(x, w, hz, t * 0.8, C); x.restore();
      x.fillStyle = "#040a12"; x.fillRect(0, hz, w, h - hz);
      x.save(); x.globalAlpha = 0.45; x.translate(0, hz * 2); x.scale(1, -1); x.beginPath(); x.rect(0, hz, w, hz); x.clip(); try { x.drawImage(x.canvas, 0, 0, x.canvas.width, x.canvas.height * hz / h, 0, 0, w, hz); } catch (e) {} x.restore();
      x.fillStyle = "rgba(255,255,255,.12)"; for (var i = 0; i < 5; i++) { var yy = hz + 3 + i * 3.5, ph = Math.sin(t * 1.3 + i); x.fillRect(w * 0.1 + ph * 6, yy, w * 0.8, 0.8); }
    },
    turf: function (x, w, h, t, C) {
      for (var s = 0; s < w; s += 22) { x.fillStyle = (s / 22) % 2 ? C[1] : C[0]; x.fillRect(s, 0, 22, h); }
      x.fillStyle = "rgba(255,255,255,.85)"; for (var yl = 44; yl < w; yl += 88) { x.fillRect(yl, 0, 2, h); for (var hm = 6; hm < h; hm += 9) { x.fillRect(yl - 22, hm, 5, 1); x.fillRect(yl + 22, hm, 5, 1); } }
      x.font = "700 12px Oswald, sans-serif"; x.fillStyle = "rgba(255,255,255,.55)"; x.textAlign = "center"; [10, 20, 30, 40, 50].forEach(function (n, i) { var px = 44 + i * 88; if (px < w) x.fillText(String(n), px, h - 6); });
      sheenV158A(x, w, h, t, 6, 0.1); vignetteV158A(x, w, h, 0.35);
    },
    friday: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, C[0]], [1, C[1]]]));
      [0.18, 0.82].forEach(function (p, i) { var px = w * p, fl = 0.85 + 0.15 * Math.sin(t * 6 + i * 2);
        x.fillStyle = "rgba(255,246,216," + (0.08 * fl).toFixed(3) + ")"; x.beginPath(); x.moveTo(px - 14, 6); x.lineTo(px + 14, 6); x.lineTo(px + 70, h); x.lineTo(px - 70, h); x.fill();
        glowV158A(x, px, 4, 34, C[3], 0.55 * fl); glowV158A(x, px, 4, 16, C[2], 0.9 * fl);
        x.fillStyle = C[2]; for (var b = 0; b < 5; b++) for (var r = 0; r < 2; r++) x.fillRect(px - 9 + b * 4, 1 + r * 3.5, 2.6, 2.6); });
      for (var i = 0; i < 18; i++) { var a = 0.2 + 0.2 * Math.sin(t * 1.5 + i); glowV158A(x, rV158A(i, 221) * w, h * 0.5 + rV158A(i, 222) * h * 0.5, 4 + rV158A(i, 223) * 4, C[3], a); }
    },
    lineage: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, C[0]], [0.5, C[1]], [1, "#2a1d08"]]));
      for (var y = 0; y < h; y += 3) { x.fillStyle = "rgba(0,0,0," + (0.05 + 0.06 * rV158A(y, 231)).toFixed(3) + ")"; x.fillRect(0, y, w, 1); }
      x.strokeStyle = rgbaV158A(C[2], 0.45); x.lineWidth = 1.2;
      var tree = function (px, py, len, an, d) { if (d > 4) return; var ex = px + Math.cos(an) * len, ey = py + Math.sin(an) * len; x.beginPath(); x.moveTo(px, py); x.lineTo(ex, ey); x.stroke(); tree(ex, ey, len * 0.7, an - 0.5, d + 1); tree(ex, ey, len * 0.7, an + 0.5, d + 1); };
      tree(w * 0.78, h, 16, -Math.PI / 2, 0);
      x.strokeStyle = rgbaV158A(C[2], 0.8); x.strokeRect(3.5, 3.5, w - 7, h - 7);
      sheenV158A(x, w, h, t, 6, 0.2);
    },
    drive: function (x, w, h, t, C) {
      var hz = h * 0.62; fillV158A(x, w, h, vgV158A(x, 0, hz, [[0, C[2]], [0.6, C[1]], [1, C[0]]]));
      glowV158A(x, w * 0.5, hz, 50, "#fff3c4", 0.6); x.fillStyle = "#ffe08a"; x.beginPath(); x.arc(w * 0.5, hz, 12, Math.PI, 0); x.fill();
      x.fillStyle = "#1a0f24"; x.fillRect(0, hz, w, h - hz); x.fillStyle = "#2a1a34"; x.beginPath(); x.moveTo(w * 0.47, hz); x.lineTo(w * 0.53, hz); x.lineTo(w * 0.8, h); x.lineTo(w * 0.2, h); x.fill();
      x.fillStyle = "#ffd76f"; for (var i = 0; i < 6; i++) { var p = ((i + t * 1.2) % 6) / 6, yy = hz + (h - hz) * p * p, ww = 1 + p * 3; x.fillRect(w * 0.5 - ww / 2, yy, ww, 1 + p * 3); }
    },
    founder: function (x, w, h, t, C) {
      for (var s = -h; s < w + h; s += 20) { x.fillStyle = C[0]; x.beginPath(); x.moveTo(s, 0); x.lineTo(s + 10, 0); x.lineTo(s + 10 + h, h); x.lineTo(s + h, h); x.fill(); x.fillStyle = C[1]; x.beginPath(); x.moveTo(s + 10, 0); x.lineTo(s + 20, 0); x.lineTo(s + 20 + h, h); x.lineTo(s + 10 + h, h); x.fill(); }
      x.fillStyle = C[2]; x.fillRect(0, h - 2, w, 2); sheenV158A(x, w, h, t, 5, 0.12);
      var ph = (t % 4) / 4; glowV158A(x, ph * w, h - 1, 14, C[2], 0.8);
    },
    /* a Career Pass banner (or anything else): its own CSS gradient under a moving sheen */
    sheen: function (x, w, h, t) { x.clearRect(0, 0, w, h); sheenV158A(x, w, h, t, 5.5, 0.16); vignetteV158A(x, w, h, 0.25); }
  };
  /* the scoreboard's dot-matrix letters (5 wide, 7 tall) */
  var FONT5_V158A = (function () {
    var R = { T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"], O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"], U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
      C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"], H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"], D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
      W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"], N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"], G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
      A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"], M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"], E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
      I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"], " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"] };
    var out = {}; Object.keys(R).forEach(function (k) { out[k] = R[k]; }); return out;
  })();
  /* one frame of one banner onto a canvas of css size w x h */
  function banFrameV158A(cv, it, t) {
    try {
      var kind = it && it.b158 && BAN_V158A[it.b158] ? it.b158 : "sheen", w = cv.__w || cv.width, h = cv.__h || cv.height, dpr = cv.__dpr || 1, x = cv.getContext("2d");
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; x.shadowBlur = 0; x.setLineDash([]);
      if (kind !== "sheen") x.clearRect(0, 0, w, h);
      var C = (it && it.col ? it.col : ["#1b2230", "#0b0f16"]).map(colV158A);
      BAN_V158A[kind](x, w, h, t, C);
      x.setTransform(1, 0, 0, 1, 0, 0); V158A.paints++;
      return kind;
    } catch (e) { errV158A(e); return null; }
  }
  /* ONE rAF loop for every animated banner on screen (the card's, the Locker's previews) */
  var LOOP_V158A = { list: [], raf: 0, last: 0 };
  function banRegV158A(cv, it) {
    if (!cv) return false;
    var still = reducedV158A() || typeof requestAnimationFrame !== "function";
    banFrameV158A(cv, it, still ? TUv("v158AstillT", 2.4) : performance.now() / 1000);
    if (still) return false;
    for (var i = 0; i < LOOP_V158A.list.length; i++) if (LOOP_V158A.list[i].cv === cv) { LOOP_V158A.list[i].it = it; return true; }
    if (LOOP_V158A.list.length >= TUv("v158Amax", 60)) LOOP_V158A.list.shift();
    LOOP_V158A.list.push({ cv: cv, it: it, miss: 0 });
    if (!LOOP_V158A.raf) LOOP_V158A.raf = requestAnimationFrame(banTickV158A);
    return true;
  }
  function banTickV158A(ts) {
    LOOP_V158A.raf = 0;
    try {
      if (ts - LOOP_V158A.last >= 1000 / Math.max(4, TUv("v158Afps", 24)) - 2 && !document.hidden && !reducedV158A()) {
        LOOP_V158A.last = ts; V158A.ticks++;
        var t = performance.now() / 1000;
        for (var i = LOOP_V158A.list.length - 1; i >= 0; i--) { var r = LOOP_V158A.list[i];
          if (!r.cv.isConnected) { if (++r.miss > 90) LOOP_V158A.list.splice(i, 1); continue; }
          r.miss = 0; banFrameV158A(r.cv, r.it, t); }
      }
    } catch (e) { errV158A(e); }
    if (LOOP_V158A.list.length && typeof requestAnimationFrame === "function") LOOP_V158A.raf = requestAnimationFrame(banTickV158A);
  }
  function sizeCvV158A(cv, w, h) { var dpr = Math.min(2, window.devicePixelRatio || 1); cv.__w = w; cv.__h = h; cv.__dpr = dpr; cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr)); }
  /* a card's band: a canvas behind its badges, sized to the band */
  function dressBannerV158A(band) {
    try {
      if (!band || !banOnV158A()) return false;
      var it = findItem(band.getAttribute("data-banner")); if (!it || it.cat !== "banner") return false;
      var cv = band.querySelector(":scope > canvas.pc-bcv-v158a");
      var w = band.clientWidth || 340, h = band.clientHeight || 58;
      if (!cv) { cv = document.createElement("canvas"); cv.className = "pc-bcv-v158a"; cv.setAttribute("aria-hidden", "true"); band.insertBefore(cv, band.firstChild); }
      if (cv.__w !== w || cv.__h !== h) sizeCvV158A(cv, w, h);
      band.setAttribute("data-b158", it.b158 || "sheen"); band.classList.add("b158");
      banRegV158A(cv, it); V158A.dressed++;
      return true;
    } catch (e) { errV158A(e); return false; }
  }
  function dressCardV158A(root) { try { (root || document).querySelectorAll(".pc-ban-v151b[data-banner]:not(.b158)").forEach(dressBannerV158A); } catch (e) {} }
  setInterval(function () { if (banOnV158A() && document.querySelector(".pc-ban-v151b[data-banner]:not(.b158)")) dressCardV158A(document); }, 600);

  /* ---------------- the card's classes (renderCard calls these) ---------------- */
  var RAR_V158A = { common: 1, rare: 1, epic: 1, legendary: 1, mythic: 1 };
  function cardOnV158A() { return onV158A("v158Acard"); }
  function teamVarsV158A(cols) { if (!cardOnV158A()) return ""; var c = (cols || []).filter(hexOk); return c.length ? ' style="--t1:' + c[0] + ";--t2:" + (c[1] || c[0]) + '"' : ""; }
  function titleClsV158A(ttl) { return ttl && cardOnV158A() && RAR_V158A[ttl.rarity] ? " t158 t158-" + ttl.rarity : ""; }
  function badgeAttrsV158A(bdg) {
    if (!bdg || !bdg.b158 || !cardOnV158A()) return { cls: "", style: "" };
    return { cls: " b158 b158-" + bdg.b158 + (bdg.fx ? " b158-fx" : "") + " b158r-" + bdg.rarity, style: ' style="--b1:' + (hexOk(bdg.col) || "#f0bb45") + ";--b2:" + (hexOk(bdg.col2) || "#3a2a08") + '"' };
  }
  /* the nameplate's attributes on .pc-name-v151b (the old inline plate, or a material class) */
  function plateAttrsV158A(npl) {
    if (!npl) return "";
    if (npl.np && cardOnV158A()) return ' data-plate="' + escHtml(npl.id) + '" data-np="' + escHtml(npl.np) + '"';
    return npl.plate ? ' style="background:' + npl.plate + ';padding:1px 6px;border-radius:5px" data-plate="' + escHtml(npl.id) + '"' : "";
  }
  function plateClsV158A(npl) { return npl && npl.np && cardOnV158A() ? " np158 np158-" + npl.np : ""; }

  /* ---------------- the Locker's previews ---------------- */
  function previewV158A(el, it) {
    try {
      var cat = it.cat;
      if (cat === "banner" && banOnV158A()) {
        el.innerHTML = ""; var cv = document.createElement("canvas"); cv.className = "cos-ban-v158a"; sizeCvV158A(cv, 64, 40); el.appendChild(cv);
        if (!it.b158) { cv.style.background = it.bg; }
        banRegV158A(cv, it); return true;
      }
      if (!cardOnV158A()) return false;
      if (cat === "title" && it.text) { el.innerHTML = '<div class="cos-flair-v151b t158p"><small class="t158' + titleClsV158A(it) + '">' + escHtml(it.text) + "</small></div>"; return true; }
      if (cat === "badge" && it.b158) { var b = badgeAttrsV158A(it); el.innerHTML = '<div class="b158w"><span class="pc-bdg-v151b b158p' + b.cls + '"' + b.style + ">" + escHtml(it.glyph) + "</span></div>"; return true; }
      if (cat === "nameplate" && it.np) {
        var nm = "NAME"; try { var st = gstate(); nm = String((st && st.player && st.player.name) || "NAME").split(" ").pop().toUpperCase().slice(0, 9); } catch (e) {}
        el.innerHTML = '<div class="np158p"><div class="pc-name-v151b' + plateClsV158A(it) + '" data-np="' + escHtml(it.np) + '">' + escHtml(nm) + "</div></div>"; return true;
      }
    } catch (e) { errV158A(e); }
    return false;
  }

  /* ---------------- the look ---------------- */
  /* the frames: a ring masked to the card's border (::after), its gradient panned / flickered / chased */
  var FRAMES_V158A = {
    team158: { bd: "var(--t1,#1f4fd0)", ring: "repeating-linear-gradient(135deg,var(--t1,#1f4fd0) 0 7px,var(--t2,#e8c86a) 7px 14px)", size: "200% 200%", anim: "pan 6s linear", glow: "rgba(0,0,0,0)" },
    pixel158: { bd: "#ff3d7f", ring: "repeating-linear-gradient(90deg,#ff3d7f 0 6px,#18c3b8 6px 12px,#ffd76f 12px 18px,#6fd3ff 18px 24px)", size: "96px 96px", anim: "chase 1.6s steps(8)", glow: "rgba(255,61,127,.25)" },
    sakura158: { bd: "#ffb3c7", ring: "linear-gradient(90deg,#ffd6e2,#ff7aa2,#fff0f5,#ff9ac0,#ffd6e2)", size: "300% 100%", anim: "pan 7s ease-in-out", glow: "rgba(255,122,162,.35)" },
    toxic158: { bd: "#9dff2f", ring: "repeating-linear-gradient(45deg,#9dff2f 0 6px,#0b0f06 6px 12px)", size: "200% 200%", anim: "pan 3s linear", glow: "rgba(157,255,47,.45)", pulse: 1 },
    glacier158: { bd: "#dff4ff", ring: "linear-gradient(120deg,#ffffff,#8fd0ff,#dff4ff,#3a7fbf,#ffffff)", size: "300% 300%", anim: "pan 6s ease-in-out", glow: "rgba(143,208,255,.45)" },
    marquee158: { bd: "#3a2a08", ring: "radial-gradient(circle,#fff3a0 0 1.8px,rgba(255,176,46,.35) 2.4px,transparent 3px) 0 0/9px 9px,#3a2a08", size: "9px 9px", anim: "bulbs 0.9s steps(3)", glow: "rgba(255,215,111,.4)", w: 5 },
    ember158: { bd: "#ff5a1a", ring: "linear-gradient(0deg,#ffe14d,#ff7a1a,#a8180a,#ff7a1a,#ffe14d)", size: "100% 300%", anim: "rise 2.2s linear", glow: "rgba(255,90,26,.5)", pulse: 1 },
    aurora158: { bd: "#3fffb0", ring: "linear-gradient(90deg,#3fffb0,#3fb6ff,#9a6bff,#ff6bd6,#3fffb0)", size: "300% 100%", anim: "pan 5s linear", glow: "rgba(63,182,255,.5)" },
    laurel158: { bd: "#e6c46a", ring: "repeating-linear-gradient(60deg,#e6c46a 0 5px,#3f7a2a 5px 8px,#8fcf5a 8px 11px,#e6c46a 11px 16px)", size: "200% 200%", anim: "pan 9s linear", glow: "rgba(230,196,106,.45)", w: 4 },
    obsidian158: { bd: "#1a1a22", ring: "linear-gradient(100deg,#0b0b10 0%,#2a2a36 40%,#ffffff 50%,#2a2a36 60%,#0b0b10 100%)", size: "300% 100%", anim: "pan 3.6s ease-in-out", glow: "rgba(160,160,200,.35)" },
    filigree158: { bd: "#ffd76f", ring: "linear-gradient(90deg,#8a6414,#fff3c4,#e6b53a,#8a6414,#fff3c4,#e6b53a)", size: "300% 100%", anim: "pan 4s linear", glow: "rgba(255,215,111,.6)", w: 4, dbl: "#8a6414" },
    starlight158: { bd: "#b9a6ff", ring: "radial-gradient(circle,#ffffff 0 0.9px,transparent 1.4px) 0 0/11px 13px,radial-gradient(circle,#ffe98a 0 0.8px,transparent 1.3px) 5px 6px/17px 11px,linear-gradient(90deg,#2a1650,#7a3aff,#2a1650)", size: "11px 13px,17px 11px,200% 100%", anim: "twinkle 3s linear", glow: "rgba(122,58,255,.6)", w: 4 },
    livewire158: { bd: "#8fe3ff", ring: "repeating-linear-gradient(90deg,#ffffff 0 3px,#6fd3ff 3px 9px,#1f5fbf 9px 14px)", size: "200% 100%", anim: "flicker 0.9s steps(4)", glow: "rgba(111,211,255,.7)" },
    prism158: { bd: "#ff6b6b", ring: "linear-gradient(90deg,#ff6b6b,#ffd76f,#6fffb0,#6fd3ff,#b98bff,#ff6bd6,#ff6b6b)", size: "400% 100%", anim: "pan 3s linear", glow: "rgba(255,255,255,.35)", w: 4 }
  };
  (function () {
    if (document.getElementById("cosV158Acss")) return;
    var L = [];
    /* the card's banner canvas sits behind the band's badges */
    L.push(".pc-ban-v151b.b158{overflow:hidden}.pc-ban-v151b>.pc-bcv-v158a{position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none;z-index:0}.pc-ban-v151b.b158>span{z-index:1}");
    L.push(".cos-ban-v158a,.cos-pvbox-v151b canvas.cos-ban-v158a{width:64px;height:40px;border-radius:6px;display:block;image-rendering:auto;box-shadow:0 0 0 1px rgba(255,255,255,.12)}");
    /* frames */
    var sel = [], rm = [];
    Object.keys(FRAMES_V158A).forEach(function (k) {
      var F = FRAMES_V158A[k], w = F.w || 3;
      L.push(".pcard-v151b.fr-" + k + "{border-color:" + F.bd + ";box-shadow:0 0 0 1px rgba(0,0,0,.6),0 0 18px " + F.glow + ",0 10px 26px rgba(0,0,0,.5)" + (F.dbl ? ",0 0 0 4px " + F.dbl : "") + (F.pulse ? ";animation:fr158Pulse 2.4s ease-in-out infinite" : "") + "}");
      L.push(".pcard-v151b.fr-" + k + "::after{content:'';position:absolute;inset:0;border-radius:inherit;padding:" + w + "px;pointer-events:none;z-index:4;background:" + F.ring + ";background-size:" + F.size + ";-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:fr158" + F.anim.split(" ")[0].replace(/^./, function (c) { return c.toUpperCase(); }) + " " + F.anim.split(" ").slice(1).join(" ") + " infinite}");
      sel.push(".pcard-v151b.fr-" + k + "::after"); rm.push(".pcard-v151b.fr-" + k);
    });
    L.push("@keyframes fr158Pan{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}");
    L.push("@keyframes fr158Chase{from{background-position:0 0}to{background-position:96px 0}}");
    L.push("@keyframes fr158Bulbs{from{background-position:0 0}to{background-position:9px 0}}");
    L.push("@keyframes fr158Rise{from{background-position:50% 0%}to{background-position:50% 100%}}");
    L.push("@keyframes fr158Twinkle{0%{background-position:0 0,5px 6px,0% 50%;filter:brightness(1)}50%{background-position:0 13px,-12px 6px,100% 50%;filter:brightness(1.35)}100%{background-position:0 26px,-29px 6px,0% 50%;filter:brightness(1)}}");
    L.push("@keyframes fr158Flicker{0%{opacity:1;background-position:0 0}30%{opacity:.55}45%{opacity:1;background-position:40% 0}70%{opacity:.8}100%{opacity:1;background-position:100% 0}}");
    L.push("@keyframes fr158Pulse{0%,100%{filter:none}50%{filter:brightness(1.12)}}");
    L.push("@media(prefers-reduced-motion:reduce){" + sel.join(",") + "{animation:none}" + rm.join(",") + "{animation:none}}");
    L.push(".cos-mini-v151b.pcard-v151b::after{padding:2px}");
    /* titles: the rarity is the style */
    L.push(".t158{display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;vertical-align:top}");
    L.push(".pc-title-v151b.t158{display:block}");
    L.push(".t158-common{color:#c9d2de!important}");
    L.push(".t158-rare{color:#8fc3ff!important;text-shadow:0 0 6px rgba(90,160,255,.55)}");
    L.push(".t158-epic{background:linear-gradient(90deg,#e0b8ff,#9a6bff,#ff9ad5,#e0b8ff);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent!important;animation:t158Pan 5s linear infinite;filter:drop-shadow(0 0 3px rgba(154,107,255,.5))}");
    L.push(".t158-legendary{background:linear-gradient(100deg,#b8861f 0%,#ffd76f 30%,#fff9e0 45%,#ffd76f 60%,#b8861f 100%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent!important;animation:t158Pan 3.2s linear infinite;filter:drop-shadow(0 0 3px rgba(255,215,111,.55));letter-spacing:1.6px!important}");
    L.push(".t158-mythic{background:linear-gradient(90deg,#ff6b6b,#ffd76f,#6fffb0,#6fd3ff,#b98bff,#ff6bd6,#ff6b6b);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent!important;animation:t158Pan 4s linear infinite;filter:drop-shadow(0 0 4px rgba(255,255,255,.45));letter-spacing:2px!important;font-weight:700!important}");
    L.push(".t158-mythic::before,.t158-legendary::before{content:'✦ ';-webkit-text-fill-color:currentColor}");
    L.push("@keyframes t158Pan{from{background-position:0% 50%}to{background-position:250% 50%}}");
    L.push(".t158p small{font-size:10px;letter-spacing:1px}");
    L.push("@media(prefers-reduced-motion:reduce){.t158{animation:none!important}}");
    /* badges: an enamel pin */
    var CLIP = { shield: "polygon(50% 0,100% 16%,94% 66%,50% 100%,6% 66%,0 16%)", star: "polygon(50% 0,63% 34%,100% 36%,71% 58%,81% 96%,50% 75%,19% 96%,29% 58%,0 36%,37% 34%)", hex: "polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0 50%)", diamond: "polygon(50% 0,100% 50%,50% 100%,0 50%)", round: "circle(50% at 50% 50%)" };
    L.push(".pc-bdg-v151b.b158{position:absolute;display:grid;place-items:center;width:28px;height:28px;right:60px;top:8px;font:700 14px/1 Oswald,sans-serif;color:#fff;background:radial-gradient(circle at 38% 30%,color-mix(in srgb,var(--b1) 55%,#fff) 0,var(--b1) 45%,var(--b2) 100%);filter:drop-shadow(0 2px 2px rgba(0,0,0,.7)) drop-shadow(0 0 1px var(--b2));overflow:hidden;text-shadow:0 1px 1px rgba(0,0,0,.6)}");
    Object.keys(CLIP).forEach(function (k) { L.push(".b158-" + k + "{clip-path:" + CLIP[k] + "}"); });
    L.push(".b158-star{font-size:11px}.b158-star::first-line{line-height:1.4}");
    L.push(".b158-fx::after{content:'';position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.75) 48%,transparent 62%);background-size:300% 100%;animation:b158Shine 2.8s ease-in-out infinite}");
    L.push("@keyframes b158Shine{0%{background-position:120% 0}60%,100%{background-position:-60% 0}}");
    L.push(".b158p.pc-bdg-v151b{position:relative;right:auto;top:auto;width:42px;height:42px;font-size:21px}");
    L.push("@media(prefers-reduced-motion:reduce){.b158-fx::after{animation:none;opacity:0}}");
    /* nameplates: a material */
    var NP = {
      team: "background:linear-gradient(90deg,var(--t1,#1f4fd0),var(--t2,#e8c86a));color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.8)",
      stone: "background:radial-gradient(circle at 20% 30%,rgba(255,255,255,.12) 0 1px,transparent 2px) 0 0/7px 7px,linear-gradient(180deg,#a9a59c,#6e6a62);color:#3a3834;text-shadow:0 1px 0 rgba(255,255,255,.4),0 -1px 0 rgba(0,0,0,.55);box-shadow:inset 0 1px 0 rgba(255,255,255,.25),inset 0 -2px 0 rgba(0,0,0,.25)",
      oak: "background:repeating-linear-gradient(90deg,rgba(0,0,0,.12) 0 1px,transparent 1px 9px),linear-gradient(180deg,#9a6a3a,#5a3a1e);color:#2a1608;text-shadow:0 1px 0 rgba(255,220,170,.35),0 -1px 0 rgba(0,0,0,.4);box-shadow:inset 0 0 0 1px rgba(40,20,8,.6)",
      carbon: "background:repeating-linear-gradient(45deg,#15181d 0 3px,#262b33 3px 6px),repeating-linear-gradient(-45deg,rgba(255,255,255,.04) 0 3px,transparent 3px 6px);color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)",
      neon: "background:#12051f;color:#fff;text-shadow:0 0 3px #ff3df2,0 0 8px #ff3df2,0 0 14px #ff3df2;box-shadow:inset 0 0 0 1px #ff3df2,0 0 8px rgba(255,61,242,.5);animation:np158Flicker 4s steps(1) infinite",
      chrome: "background:linear-gradient(180deg,#ffffff,#b9c3d2 45%,#6a7484 52%,#dfe6f0 100%);color:#1b2230;text-shadow:0 1px 0 rgba(255,255,255,.6);box-shadow:inset 0 0 0 1px rgba(40,50,70,.45)",
      varsity: "background:var(--t1,#8a1c2b);color:#fff;text-shadow:-1px 0 var(--t2,#e8c86a),1px 0 var(--t2,#e8c86a),0 1px var(--t2,#e8c86a),0 -1px var(--t2,#e8c86a);outline:1.5px dashed var(--t2,#e8c86a);outline-offset:-3px",
      frost: "background:linear-gradient(180deg,#f4fbff,#a8dbff);color:#0c2a4a;text-shadow:0 1px 0 rgba(255,255,255,.7);box-shadow:inset 0 0 0 1px rgba(255,255,255,.8),0 0 8px rgba(143,208,255,.45)",
      gold: "background:linear-gradient(180deg,#fff3c4,#e6b53a 45%,#b8861f 55%,#f0c850);color:#2a1a04;text-shadow:0 1px 0 rgba(255,255,255,.5);box-shadow:inset 0 0 0 1px rgba(90,60,8,.55),0 0 8px rgba(255,215,111,.35)",
      marble: "background:linear-gradient(135deg,rgba(120,112,100,.25) 0 1px,transparent 1px 30%) 0 0/60px 30px,linear-gradient(135deg,#f6f3ee,#d6d0c4 50%,#f3f0ea);color:#1b1b1b;border-bottom:2px solid #d4af37",
      diamond: "background:linear-gradient(135deg,#ffffff 0 20%,#dff6ff 20% 40%,#bfefff 40% 60%,#ffffff 60% 80%,#cfeeff 80%);color:#0c1a33;text-shadow:0 1px 0 #fff;box-shadow:inset 0 0 0 1px rgba(111,211,255,.8),0 0 12px rgba(191,239,255,.7)",
      magma: "background:linear-gradient(90deg,transparent 0 30%,rgba(255,122,26,.55) 32%,transparent 34% 70%,rgba(255,176,46,.5) 72%,transparent 74%) 0 0/200% 100%,linear-gradient(180deg,#3a0a04,#0a0202);color:#ffd08a;text-shadow:0 0 6px #ff5a1a;animation:np158Pan 6s linear infinite",
      holo: "background:linear-gradient(90deg,#ffd6f0,#d6f0ff,#e0ffd6,#fff6c0,#ffd6f0);background-size:300% 100%;color:#1a1030;text-shadow:0 1px 0 rgba(255,255,255,.7);animation:np158Pan 4s linear infinite",
      galaxy: "background:radial-gradient(circle,#fff 0 .6px,transparent 1px) 0 0/9px 7px,radial-gradient(circle,#ffb8e6 0 .6px,transparent 1px) 4px 3px/13px 9px,linear-gradient(90deg,#1a0f33,#3a1a6a,#05030f);color:#fff;text-shadow:0 0 6px #9a7bff;animation:np158Stars 8s linear infinite"
    };
    Object.keys(NP).forEach(function (k) { L.push(".pc-name-v151b.np158-" + k + "{" + NP[k] + "}"); });
    L.push(".pc-name-v151b.np158{position:relative;display:inline-block;max-width:100%;padding:1px 8px;border-radius:5px;vertical-align:top}");
    L.push(".np158-gold::after,.np158-chrome::after,.np158-diamond::after,.np158-marble::after{content:'';position:absolute;top:0;bottom:0;left:-40%;width:30%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.75),transparent);animation:np158Shine 3.4s ease-in-out infinite;pointer-events:none}");
    L.push("@keyframes np158Shine{0%{left:-40%}55%,100%{left:120%}}@keyframes np158Pan{from{background-position:0 0}to{background-position:300% 0}}@keyframes np158Stars{from{background-position:0 0,4px 3px,0 0}to{background-position:90px 0,-126px 3px,0 0}}");
    L.push("@keyframes np158Flicker{0%,100%{opacity:1}91%{opacity:1}92%{opacity:.55}93%{opacity:1}96%{opacity:.7}97%{opacity:1}}");
    L.push("@media(prefers-reduced-motion:reduce){.np158,.np158::after{animation:none!important}.np158::after{opacity:0}}");
    L.push(".np158p{width:100%;display:grid;place-items:center;height:40px}.np158p .pc-name-v151b{font-size:13px}");
    /* shelves */
    var SH = {
      carbon158: "background:repeating-linear-gradient(45deg,#15181d 0 4px,#23272e 4px 8px)!important;border-bottom-color:#0b0d10!important",
      locker158: "background:repeating-linear-gradient(90deg,transparent 0 8px,rgba(0,0,0,.25) 8px 10px) 0 4px/100% 6px no-repeat,linear-gradient(180deg,#4a6a8a,#2a3a4e)!important;border-bottom-color:#1a2432!important",
      stone158: "background:radial-gradient(circle at 30% 40%,rgba(255,255,255,.1) 0 1px,transparent 2px) 0 0/8px 8px,linear-gradient(180deg,#8a867e,#5a564e)!important;border-bottom-color:#3a3630!important",
      neon158: "background:#0e0618!important;border-bottom-color:#ff3df2!important;box-shadow:0 0 0 1px #ff3df2 inset,0 0 14px rgba(255,61,242,.45),0 4px 8px rgba(0,0,0,.4)!important;animation:sh158Glow 2.6s ease-in-out infinite",
      ice158: "background:linear-gradient(180deg,rgba(223,244,255,.3),rgba(111,182,255,.12))!important;border:1px solid rgba(223,244,255,.7)!important;border-bottom:3px solid #bfe6ff!important;box-shadow:0 0 12px rgba(143,208,255,.35)!important",
      walnut158: "background:repeating-linear-gradient(90deg,rgba(0,0,0,.12) 0 1px,transparent 1px 11px),linear-gradient(180deg,#5a3a22,#2e1c10)!important;border-bottom:4px solid #b8861f!important;box-shadow:0 0 0 1px rgba(184,134,31,.6) inset!important",
      velvet158: "background:radial-gradient(ellipse at 50% 0,rgba(255,255,255,.15),transparent 70%),linear-gradient(180deg,#8a1020,#4a0610)!important;border-bottom:4px solid #e6c46a!important",
      diamond158: "background:linear-gradient(135deg,rgba(255,255,255,.35) 0 20%,rgba(191,239,255,.2) 20% 40%,rgba(255,255,255,.3) 40% 60%,rgba(191,239,255,.15) 60%),linear-gradient(180deg,#1f3a5a,#0c1a33)!important;border-bottom:3px solid #bfefff!important;box-shadow:0 0 16px rgba(191,239,255,.5)!important",
      holo158: "background:linear-gradient(90deg,rgba(24,240,224,.25),rgba(185,139,255,.25),rgba(24,240,224,.25)) 0 0/300% 100%,linear-gradient(180deg,#062a2e,#021418)!important;border-bottom:3px solid #18f0e0!important;animation:sh158Pan 4s linear infinite",
      galaxy158: "background:radial-gradient(circle,#fff 0 .7px,transparent 1.2px) 0 0/12px 9px,radial-gradient(circle,#ffb8e6 0 .6px,transparent 1.1px) 5px 4px/17px 13px,linear-gradient(180deg,#2a1650,#05030f)!important;border-bottom:3px solid #b98bff!important;box-shadow:0 0 16px rgba(122,58,255,.45)!important"
    };
    Object.keys(SH).forEach(function (k) { L.push(".sh-" + k + "{" + SH[k] + "}"); });
    L.push(".sh-stone158 small,.sh-locker158 small{color:#e6ecf5!important}.sh-neon158 small{color:#ff9af0!important}.sh-ice158 small{color:#dff4ff!important}.sh-walnut158 small,.sh-velvet158 small{color:#ffe7a8!important}.sh-holo158 small{color:#9dfff4!important}.sh-galaxy158 small,.sh-diamond158 small{color:#e8e0ff!important}");
    L.push("@keyframes sh158Glow{0%,100%{filter:none}50%{filter:brightness(1.25)}}@keyframes sh158Pan{from{background-position:0 0,0 0}to{background-position:300% 0,0 0}}");
    L.push("@media(prefers-reduced-motion:reduce){.sh-neon158,.sh-holo158{animation:none!important}}");
    /* recaps: the Locker's thumbnail and the skin over the real report */
    var RC = {
      vhs: ["background:repeating-linear-gradient(0deg,rgba(255,255,255,.04) 0 1px,transparent 1px 3px),#141414!important;border-color:#ff3b3b!important", "color:#ff3b3b!important;font-family:'Courier New',monospace!important"],
      blueprint: ["background:repeating-linear-gradient(0deg,rgba(255,255,255,.12) 0 1px,transparent 1px 8px),repeating-linear-gradient(90deg,rgba(255,255,255,.12) 0 1px,transparent 1px 8px),#1f4f8a!important;border-color:#dfefff!important", "color:#ffffff!important;font-family:'Courier New',monospace!important"],
      stone: ["background:linear-gradient(180deg,#a9a59c,#6e6a62)!important;border-color:#3a3834!important", "color:#2a2824!important;text-shadow:0 1px 0 rgba(255,255,255,.4)"],
      comic: ["background:radial-gradient(circle,#ffd23f 0 1.4px,transparent 1.8px) 0 0/6px 6px,#fff6d0!important;border:2px solid #111!important", "color:#e0202a!important;font-family:Impact,sans-serif!important;text-shadow:1px 1px 0 #111"],
      ticker: ["background:linear-gradient(180deg,#0c1a33 70%,#c8102e 70%)!important;border-color:#e6ecf5!important", "color:#ffffff!important"],
      arcade: ["background:#050510!important;border-color:#57e07a!important;box-shadow:0 0 10px rgba(87,224,122,.45)", "color:#57e07a!important;font-family:'Courier New',monospace!important"],
      cover: ["background:linear-gradient(160deg,#ffffff,#e8e8e8)!important;border-color:#c8102e!important;border-top:6px solid #c8102e!important", "color:#111!important;font-family:Georgia,serif!important"],
      cosmic: ["background:radial-gradient(circle,#fff 0 .6px,transparent 1px) 0 0/7px 6px,linear-gradient(160deg,#2a1650,#05030f)!important;border-color:#b98bff!important;box-shadow:0 0 12px rgba(122,58,255,.5)", "color:#e0d0ff!important;text-shadow:0 0 6px #9a7bff"]
    };
    var SKIN = {
      vhs: "#screen .card{background:repeating-linear-gradient(0deg,rgba(255,255,255,.03) 0 1px,transparent 1px 3px),#121212!important;border-color:#ff3b3b!important}#screen .card .h1{color:#ff3b3b!important;font-family:'Courier New',monospace;letter-spacing:2px}",
      blueprint: "#screen .card{background:repeating-linear-gradient(0deg,rgba(255,255,255,.07) 0 1px,transparent 1px 14px),repeating-linear-gradient(90deg,rgba(255,255,255,.07) 0 1px,transparent 1px 14px),#1f4f8a!important;border-color:#dfefff!important}#screen .card .h1{color:#fff!important;font-family:'Courier New',monospace}",
      stone: "#screen .card{background:linear-gradient(180deg,#8a867e,#5a564e)!important;border-color:#3a3630!important}#screen .card .h1{color:#f3f0ea!important;text-shadow:0 -1px 0 rgba(0,0,0,.5),0 1px 0 rgba(255,255,255,.25)}",
      comic: "#screen .card{background:radial-gradient(circle,rgba(255,210,63,.35) 0 1.4px,transparent 1.8px) 0 0/7px 7px,#fff6d0!important;border:3px solid #111!important;color:#111!important}#screen .card .h1{color:#e0202a!important;font-family:Impact,sans-serif;text-shadow:2px 2px 0 #111}#screen .card .sub,#screen .card .small{color:#111!important}",
      ticker: "#screen .card{background:linear-gradient(180deg,#0c1a33,#08101f)!important;border-color:#c8102e!important;border-bottom:5px solid #c8102e!important}#screen .card .h1{color:#fff!important}",
      arcade: "#screen .card{background:#050510!important;border-color:#57e07a!important;box-shadow:0 0 14px rgba(87,224,122,.35)!important}#screen .card .h1{color:#57e07a!important;font-family:'Courier New',monospace;letter-spacing:2px}",
      cover: "#screen .card{background:linear-gradient(160deg,#ffffff,#ececec)!important;border-color:#c8102e!important;border-top:6px solid #c8102e!important;color:#111!important}#screen .card .h1{color:#111!important;font-family:Georgia,serif}#screen .card .sub,#screen .card .small{color:#333!important}",
      cosmic: "#screen .card{background:radial-gradient(circle,rgba(255,255,255,.6) 0 .6px,transparent 1px) 0 0/11px 9px,linear-gradient(160deg,#2a1650,#05030f)!important;border-color:#b98bff!important;box-shadow:0 0 16px rgba(122,58,255,.4)!important}#screen .card .h1{color:#e0d0ff!important;text-shadow:0 0 8px #9a7bff}"
    };
    Object.keys(RC).forEach(function (k) {
      L.push(".rc-" + k + "{" + RC[k][0] + "}.rc-" + k + " b{" + RC[k][1] + "}");
      /* v168: EVERY selector of a rule is scoped to its skin. Only the first of a comma list was, so the "cover" skin's
       * `#screen .card .small{color:#333}` (and comic's #111) painted every card's small print near-black on every screen */
      L.push(SKIN[k].split("}").filter(Boolean).map(function (r) { var i = r.indexOf("{"); return r.slice(0, i).split(",").map(function (q) { return "html[data-cos-recap=" + k + "] " + q.trim(); }).join(",") + r.slice(i) + "}"; }).join(""));
    });
    var st = document.createElement("style"); st.id = "cosV158Acss"; st.textContent = L.join("\n");
    (document.head || document.documentElement).appendChild(st);
  })();

  /* what the check and the other files read */
  Object.assign(V158A, {
    items: function () { return ITEMS_V158A.map(function (it) { return { id: it.id, cat: it.cat, name: it.name, rarity: it.rarity, source: it.source, ach: it.ach || null }; }); },
    faces: function () { return Object.keys(FACES_V158A); }, painters: function () { return Object.keys(BAN_V158A); }, frames: function () { return Object.keys(FRAMES_V158A); },
    paintBanner: function (cv, id, t) { var it = findItem(id); if (!it) return null; if (!cv.__w) sizeCvV158A(cv, cv.width, cv.height); return banFrameV158A(cv, it, t); },
    numRender: nfRenderV158A, numMask: function (style, txt, IH) { var F = FACES_V158A[style]; return F ? nfMaskV158A(F, String(txt), IH) : null; },
    helmMask: helmMaskV158A, iconEarnedTick: iconEarnedTickV158A, dressCard: dressCardV158A, loop: LOOP_V158A, reduced: reducedV158A
  });


  /* ===== v159 C THE END ZONE AND THE SHELF, ALIVE =====
   * The owner: "Update and improve the TD celebrations for much better animation quality" and "add animations to the
   * trophy shelf". Two moves, both looks — nothing here is a number the sim reads, and nothing draws from Math.random.
   *   THE TOUCHDOWN  one animation SYSTEM replaces the per-kind tween piles of v151 B / v153 G. A celebration is a PLAN
   *                built once from a seed (the play's ball token + the item id, `prng`): a list of particles, each a
   *                closed-form body — position = f(t) under gravity and linear drag (`posV159C`: v(t) = g/k + (v0 − g/k)e^−kt),
   *                spin, flutter, a colour ramp, a size curve, a trail sampled back along its own path, an additive glow —
   *                plus per-kind layers (`KINDS_V159C[kind].back / front`: shockwave rings in the field's perspective, light
   *                rays, a light column, a drawn bolt with a stepped leader and a strobe, a self-drawing rainbow, a crown that
   *                drops on his head, orbiting stars, a snow globe, stepped 8-bit rings, meteors that land in turn). Every
   *                frame is a pure function of (plan, t): the same frame for the same t, whatever the frame rate. Four
   *                STAGES on one timeline (`tlV159C`, TU v159CantMs / burstMs / lingerMs / fadeMs → 280 / 480 / 960 / 480 =
   *                2.2 s): ANTICIPATION (light gathers, sparks converge, he crouches) → BURST (the hit, the flash, the ring,
   *                the hop) → LINGER (drift, twinkle, the callout shimmers) → FADE (everything eases out). The callout is
   *                kinetic type: each letter drops in on a staggered back-ease with a settling tilt, waves through the linger
   *                under a swoosh underline and a glint sweep, and leaves letter by letter. HE moves too: the marker's
   *                container is squashed / stretched about his feet and hopped (jump / stomp / float per kind; his
   *                shadow stays on the grass and shrinks while he is up), on top of the sheet's own celebrate frames.
   *                Two painters draw the same plan: Phaser Graphics on the field (one normal + one ADD-blended layer, ≤ TU
   *                v159Ccap 160 particles, redrawn in the scene's postupdate) and a 2D canvas in the Locker, where every
   *                celebration is a LOOPING mini-stage (his celebrate frames from the sheet, the same particles, the same
   *                type) on one shared rAF loop. prefers-reduced-motion: a short calm version (TU v159CcalmK 0.42 of the
   *                time, v159CcalmN 0.28 of the particles, no shake / flash / hop / kinetic type) and a still Locker frame.
   *                Kill switch TU v159C (0: the v151 B / v153 G tweens).
   *   THE SHELF      the card's trophy shelf (`.pc-shelf-v151b`, and the Locker's shelf previews) catches the light: a glint
   *                sweeps it on a cycle (phase-locked to the wall clock, so every card agrees), each trophy flashes as it
   *                passes, cups bob, rings turn, stars tilt; the material moves (glass / ice / diamond reflections and
   *                sparkle, neon flicker, velvet sheen, hologram scanlines, drifting starfield, carbon weave, brushed steel);
   *                the numbers count up when the card opens; a trophy he did not have the last time his own card was shown
   *                pops and shines (`rib.cos.shelfSeen.v159c`, a per-device memory, never the save). Reduced motion: still.
   *                Kill switch TU v159Cshelf. `window.__V159C` is what v159Ccheck reads. */
  var V159C = (window.__V159C = window.__V159C || { plays: [], last: null, active: null, previews: 0, prevFrames: 0, shelves: 0, countUps: 0, pops: [], errs: [] });
  function errV159C(e) { try { if (V159C.errs.length < 12) V159C.errs.push(String((e && e.message) || e)); } catch (x) {} }
  function onV159C(k) { return !!TUv(k || "v159C", 1); }
  var EZ_V159C = {
    inQ: function (t) { return t * t; },
    outQ: function (t) { return 1 - (1 - t) * (1 - t); },
    outC: function (t) { var u = 1 - t; return 1 - u * u * u; },
    inOutS: function (t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); },
    outX: function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    outB: function (t) { var s = 1.70158, u = t - 1; return 1 + (s + 1) * u * u * u + s * u * u; },
    outEl: function (t) { if (t <= 0) return 0; if (t >= 1) return 1; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * 2.0944) + 1; },
    outBn: function (t) { var n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; } if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; } t -= 2.625 / d; return n * t * t + 0.984375; }
  };
  function c01V159C(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function segV159C(t, a, b) { return c01V159C((t - a) / Math.max(1, b - a)); }
  function hexIntV159C(h) { var v = parseInt(String(h || "").slice(1), 16); return isFinite(v) ? v : 0xffffff; }
  function mixV159C(a, b, k) {
    var r = (a >> 16) & 255, g = (a >> 8) & 255, bl = a & 255;
    return ((r + (((b >> 16) & 255) - r) * k) << 16) | ((g + (((b >> 8) & 255) - g) * k) << 8) | ((bl + ((b & 255) - bl) * k) | 0);
  }
  function strHashV159C(s) { s = String(s); var h = 2166136261; for (var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  function noiseV159C(a, b, c) { return ihV153G(((a | 0) * 73856093 ^ (b | 0) * 19349663 ^ (c | 0) * 83492791) >>> 0); }

  /* ---- the timeline: four stages ---- */
  var STAGES_V159C = ["anticipation", "burst", "linger", "fade"];
  function tlV159C(calm) {
    var k = calm ? TUv("v159CcalmK", 0.42) : 1;
    var A = TUv("v159CantMs", 280) * k, B = TUv("v159CburstMs", 480) * k, L = TUv("v159ClingerMs", 960) * k, F = TUv("v159CfadeMs", 480) * k;
    return { a: A, b: A + B, l: A + B + L, end: A + B + L + F, calm: !!calm };
  }
  function stageV159C(t, T) { return t < T.a ? 0 : t < T.b ? 1 : t < T.l ? 2 : t < T.end ? 3 : 4; }

  /* ---- the plan: particles (closed-form bodies) + the kind's layers ---- */
  var PDEF_V159C = { b: 0, l: 1000, x: 0, y: 0, vx: 0, vy: 0, g: 0, k: 0, a: 0, w: 0, s: 2, s1: 1, c: 0xffffff, c2: -1, sh: "dot", add: 0, glow: 0, tr: 0, fl: 0, fw: 1, ph: 0, fa: 70, al: 1, tw: 0, fp: 0 };
  function buildV159C(kind, cols, seed, calm) {
    var rnd0 = prng(seed >>> 0), T = tlV159C(calm), K = KINDS_V159C[kind] || KINDS_V159C.confetti;
    var S = { kind: KINDS_V159C[kind] ? kind : "confetti", seed: seed >>> 0, T: T, calm: !!calm, n: calm ? TUv("v159CcalmN", 0.28) : 1,
      cap: Math.max(16, TUv("v159Ccap", 160)), parts: [], dropped: 0, k: {}, gy: 22, hy: -24, K: K, q: 0,
      cols: cols && cols.length ? cols : ["#ffffff"] };
    S.cn = S.cols.map(hexIntV159C);
    S.R = function (a, b) { return a + (b - a) * rnd0(); };
    S.c = function (i) { return S.cn[((i % S.cn.length) + S.cn.length) % S.cn.length]; };
    S.N = function (n) { return Math.max(1, Math.round(n * S.n)); };
    S.add = function (o) {
      if (S.parts.length >= S.cap) { S.dropped++; return null; }
      var p = {}; for (var k in PDEF_V159C) p[k] = o[k] != null ? o[k] : PDEF_V159C[k];
      if (p.b < 0) { p.l += p.b; p.b = 0; } if (p.l <= 0) return null;
      S.parts.push(p); return p;
    };
    /* light converging on a point through the anticipation (the "gather") */
    S.gather = function (n, cx, cy, r, ci) {
      if (S.calm) return;
      for (var i = 0; i < S.N(n); i++) { var th = S.R(0, 6.283), rr = r * S.R(0.7, 1.1), d = S.R(160, Math.max(170, T.a - 10)) / 1000;
        S.add({ b: T.a - d * 1000, l: d * 1000, x: cx + Math.cos(th) * rr, y: cy + Math.sin(th) * rr * 0.7, vx: -Math.cos(th) * rr / d, vy: -Math.sin(th) * rr * 0.7 / d,
          s: S.R(0.9, 1.6), c: S.c(ci + i), add: 1, glow: 1, tr: 60, fa: 90 }); }
    };
    try { K.build(S); } catch (e) { errV159C(e); }
    return S;
  }
  var P0_V159C = { x: 0, y: 0 }, P1_V159C = { x: 0, y: 0 }, P2_V159C = { x: 0, y: 0 };
  function posV159C(p, tau, out) {
    var s = tau / 1000, E;
    if (p.k > 0.001) { var e = Math.exp(-p.k * s); E = (1 - e) / p.k; out.x = p.x + p.vx * E; out.y = p.y + p.vy * E + p.g * (s - E) / p.k; }
    else { out.x = p.x + p.vx * s; out.y = p.y + p.vy * s + 0.5 * p.g * s * s; }
    if (p.fl) out.x += Math.sin(s * p.fw * 6.2832 + p.ph) * p.fl * Math.min(1, s * 2.5);
    return out;
  }
  function partsV159C(S, V, t, env) {
    var live = 0, L = S.parts, q = S.q;
    for (var i = 0; i < L.length; i++) {
      var p = L[i], tau = t - p.b; if (tau < 0 || tau > p.l) continue;
      if (q) tau = Math.floor(tau / 83) * 83;
      live++;
      var P = posV159C(p, tau, P0_V159C), f = tau / p.l;
      var a = p.al * env * c01V159C(tau / p.fa) * (1 - EZ_V159C.inQ(segV159C(f, 0.6, 1)));
      if (p.tw) a *= 0.5 + 0.5 * Math.sin(tau / 55 + p.ph);
      if (a < 0.01) continue;
      var s = p.s * (1 + (p.s1 - 1) * f), c = p.c2 >= 0 ? mixV159C(p.c, p.c2, f) : p.c, ang = p.a + p.w * tau / 1000, x = P.x, y = P.y;
      if (q) { x = Math.round(x / q) * q; y = Math.round(y / q) * q; }
      if (p.tr) {
        var A1 = posV159C(p, Math.max(0, tau - p.tr), P1_V159C), A2 = posV159C(p, Math.max(0, tau - p.tr * 0.45), P2_V159C);
        V.line(A1.x, A1.y, A2.x, A2.y, s * 0.45, c, a * 0.3, 1); V.line(A2.x, A2.y, x, y, s * 0.85, c, a * 0.65, 1);
      }
      var sh = p.sh;
      if (sh === "dot") { if (p.glow) V.circ(x, y, s * 2.6, c, a * 0.2, 1); V.circ(x, y, s, c, a, p.add); }
      else if (sh === "quad") { var fl = p.fp ? 0.2 + 0.8 * Math.abs(Math.cos(ang * 1.3 + p.ph)) : 1; V.rquad(x, y, s * fl, s * 0.6, ang, c, a, p.add);
        if (p.fp && fl > 0.93) V.circ(x, y, s * 0.5, 0xffffff, a * 0.7, 1); }
      else if (sh === "star") { if (p.glow) V.circ(x, y, s * 2.1, c, a * 0.18, 1); V.star(x, y, s, s * 0.45, 5, ang, c, a, p.add); }
      else if (sh === "glint") { V.star(x, y, s, s * 0.16, 4, ang, c, a, 1); V.circ(x, y, s * 0.35, 0xffffff, a, 1); }
      else if (sh === "flake") { var w = Math.max(0.35, s * 0.28); for (var j = 0; j < 3; j++) { var th = ang + j * 1.0472; V.line(x - Math.cos(th) * s, y - Math.sin(th) * s, x + Math.cos(th) * s, y + Math.sin(th) * s, w, c, a, p.add); } if (p.glow) V.circ(x, y, s * 1.4, c, a * 0.18, 1); }
      else if (sh === "pix") V.rquad(x, y, s, s, 0, c, a, p.add);
      else if (sh === "feather") V.leaf(x, y, s * 0.36, s, ang + Math.sin(tau / 1000 * p.fw * 6.2832 + p.ph) * 0.75, c, a, p.add);
      else if (sh === "puff") V.circ(x, y, s, c, a, 0);
      else if (sh === "streak") { var B = posV159C(p, Math.max(0, tau - 30), P1_V159C), dx = x - B.x, dy = y - B.y, dl = Math.hypot(dx, dy) || 1; V.line(x - dx / dl * s * 3, y - dy / dl * s * 3, x, y, s * 0.7, c, a, p.add); }
    }
    return live;
  }

  /* ---- the shared layers ---- */
  function raysV159C(V, cx, cy, n, len, c, a, rot) {
    if (a < 0.01) return;
    for (var i = 0; i < n; i++) { var th = rot + i * 6.2832 / n, w = 0.075 + 0.03 * Math.sin(i * 2.3), L = len * (0.75 + 0.25 * Math.sin(i * 1.7 + rot * 3));
      V.poly([cx, cy, cx + Math.cos(th - w) * L, cy + Math.sin(th - w) * L * 0.85, cx + Math.cos(th + w) * L, cy + Math.sin(th + w) * L * 0.85], c, a, 1); }
  }
  function commonBackV159C(S, V, t, env) {
    var T = S.T, G = S.K.g || {}, hx = V.hx, hy = V.hy;
    if (G.pool != null && G.pool >= 0) { var pk = 0.55 + 0.45 * Math.sin(Math.PI * segV159C(t, T.a, T.b)); var ia = c01V159C(t / Math.max(1, T.a));
      V.ell(hx, S.gy, 50, 14, 0, S.c(G.pool), 0.16 * env * ia * (0.7 + pk * 0.6), 1); V.ell(hx, S.gy, 26, 7, 0, S.c(G.pool), 0.22 * env * ia, 1); }
    if (G.rays && !S.calm) { var I = EZ_V159C.outC(segV159C(t, T.a - 80, T.a + 200)) * env; raysV159C(V, hx, hy - 4, G.rays, G.rayLen || 150, S.c(G.rayCol || 0), 0.13 * I, t / 1000 * 0.35); }
    if (!S.calm && G.antRing !== 0) { var ap = segV159C(t, T.a * 0.25, T.a); if (ap > 0 && ap < 1) { var r = 8 + 62 * (1 - EZ_V159C.inQ(ap)); V.ell(hx, S.gy, r, r * 0.34, 1.6, S.c(0), 0.55 * ap, 1); } }
  }
  function commonFrontV159C(S, V, t, env) {
    var T = S.T, G = S.K.g || {}, hx = V.hx, hy = V.hy, nR = S.calm ? Math.min(1, G.ring || 0) : G.ring || 0;
    for (var k = 0; k < nR; k++) { var t0 = T.a + k * 110, p = segV159C(t, t0, t0 + (S.calm ? 380 : 640));
      if (p > 0 && p < 1) { var e = EZ_V159C.outC(p), r = 10 + (G.ringR || 118) * e; V.ell(hx, S.gy, r, r * 0.34, (S.calm ? 1.5 : 5) * (1 - p) + 0.8, S.c(G.ringCol || 0), (1 - p) * (S.calm ? 0.45 : 0.9) * env, 1);
        if (!S.calm) V.ell(hx, S.gy, r * 0.92, r * 0.3, 2.2 * (1 - p) + 0.4, 0xffffff, (1 - p) * 0.45, 1); } }
    if (G.flash && !S.calm) { var fp = segV159C(t, T.a, T.a + 210); if (fp > 0 && fp < 1) { V.circ(hx, hy + 10, G.flash * (0.6 + 0.8 * fp), 0xffffff, (1 - fp) * 0.5, 1); V.circ(hx, hy + 10, G.flash * (1.3 + 1.2 * fp), S.c(0), (1 - fp) * 0.22, 1); } }
    if (S.say) calloutFxV159C(S, V, t, env);
  }
  /* the callout's underline swoosh and the glint across the letters (the letters themselves are type — see letterPoseV159C) */
  function calloutFxV159C(S, V, t, env) {
    var T = S.T, W = S.sayW || 60, cy = V.hy + S.sayDy, hx = V.hx;
    var p = EZ_V159C.outX(segV159C(t, T.a, T.a + 300)), xp = segV159C(t, T.l, T.end), hw = (W / 2 + 6) * p * (1 - EZ_V159C.inQ(xp));
    if (hw > 0.5) { V.line(hx - hw, cy + 13, hx + hw, cy + 13, 2.4, S.c(1), 0.9 * env, 0); V.line(hx - hw * 0.8, cy + 13, hx + hw * 0.8, cy + 13, 1.2, 0xffffff, 0.8 * env, 1); }
    if (S.calm) return;
    var gp = segV159C(t, T.b + 60, T.b + 620);
    if (gp > 0 && gp < 1) { var xg = hx - W / 2 - 12 + (W + 24) * EZ_V159C.inOutS(gp), ga = Math.sin(Math.PI * gp) * 0.6;
      V.poly([xg - 3, cy - 13, xg + 4, cy - 13, xg - 2, cy + 11, xg - 9, cy + 11], 0xffffff, ga, 1); }
  }
  /* each letter of the callout: drop in (back-ease + a settling tilt), wave through the linger, leave in turn */
  function letterPoseV159C(S, i, n, t) {
    var T = S.T, calm = S.calm, pix = S.kind === "pixel", st = T.a * 0.55 + i * (calm ? 0 : TUv("v159CletterMs", 38)), dur = calm ? 240 : 380;
    var p = segV159C(t, st, st + dur); if (p <= 0) return null;
    var r = { dx: 0, dy: 0, sc: 1, rot: 0, a: 1 };
    if (calm) r.a = EZ_V159C.outQ(p);
    else if (pix) { var qp = Math.floor(p * 4) / 4; r.sc = qp < 1 ? 0.6 + qp * 0.6 : 1; r.dy = (1 - qp) * -10; r.a = qp > 0 ? 1 : 0.4; }
    else { var e = EZ_V159C.outB(p); r.sc = 2.2 - 1.2 * e; r.dy = -24 * (1 - EZ_V159C.outC(p)); r.rot = (i % 2 ? 1 : -1) * 16 * (1 - EZ_V159C.outEl(p)); r.a = c01V159C(p * 3); }
    if (!calm && t > T.a) { var bp = segV159C(t, T.a, T.a + 240); r.sc *= 1 + 0.14 * Math.sin(Math.PI * bp); }
    if (!calm && t > T.b) { var w = (t - T.b) / 1000; r.dy += Math.sin(w * 7 - i * 0.6) * 1.7 * (1 - segV159C(t, T.l, T.end)); }
    var xs = T.l + i * (calm ? 0 : 24), xp = segV159C(t, xs, xs + (T.end - T.l) * 0.75);
    if (xp > 0) { if (pix) r.a *= (Math.floor(xp * 10) % 2 ? 0.15 : 1) * (1 - xp); else { r.a *= 1 - EZ_V159C.inQ(xp); if (!calm) { r.dy -= 16 * EZ_V159C.inQ(xp); r.sc *= 1 + 0.18 * xp; } } }
    return r;
  }
  /* his body: squash / stretch about the feet and a hop (body px, before the marker's own scale) */
  function poseV159C(S, t) {
    if (S.calm || !TUv("v159Cpose", 1)) return null;
    var T = S.T, kind = S.K.pose || "jump", o = { sx: 1, sy: 1, hop: 0, sh: 1 };
    var ant = EZ_V159C.inOutS(segV159C(t, T.a * 0.2, T.a)), deep = kind === "stomp" ? 0.17 : kind === "float" ? 0.07 : 0.12;
    if (t < T.a) { o.sx = 1 + deep * 0.65 * ant; o.sy = 1 - deep * ant; return o; }
    var up = T.a + (T.b - T.a) * (kind === "float" ? 0.8 : 0.55);
    if (kind === "float") {
      var fp = segV159C(t, T.a, up), rise = 7 * EZ_V159C.outC(fp), dn = EZ_V159C.inOutS(segV159C(t, T.l, T.end));
      o.hop = (rise + (t > up ? Math.sin((t - up) / 260) * 1.6 : 0)) * (1 - dn); o.sy = 1 + 0.08 * Math.sin(Math.PI * c01V159C(fp * 1.4)); o.sx = 2 - o.sy;
    } else {
      if (t < up) { var jp = segV159C(t, T.a, up); o.hop = (kind === "stomp" ? 7 : 10) * Math.sin(Math.PI * jp); var st = 1 - jp; o.sy = 1 + 0.12 * st; o.sx = 1 - 0.07 * st; }
      else if (t < T.b) { var lp = segV159C(t, up, T.b), sq = Math.sin(Math.PI * lp) * (1 - lp * 0.5), land = kind === "stomp" ? 0.16 : 0.1; o.sy = 1 - land * sq; o.sx = 1 + land * 0.7 * sq; }
      else { var w = (t - T.b) / 1000, dec = 1 - segV159C(t, T.b, T.l); o.hop = Math.abs(Math.sin(w * 9.5)) * 3.2 * dec; }
      if (kind === "jump8") { o.hop = Math.round(o.hop / 3) * 3; o.sy = Math.round(o.sy * 10) / 10; o.sx = Math.round(o.sx * 10) / 10; }
    }
    o.sh = 1 - Math.min(0.45, o.hop / 22);
    return o;
  }

  /* ---- the kinds: build(S) makes the particles; back / front draw the layers (unit space: 0,0 = his centre,
   *      S.gy the grass under him, V.hx / V.hy his centre as he moves) ---- */
  function haloDrawV159C(S, V, t, env, scale, dropFrom) {
    var T = S.T, p = segV159C(t, T.a, T.a + 380), e = S.calm ? EZ_V159C.outQ(p) : EZ_V159C.outB(p); if (p <= 0) return;
    var xp = segV159C(t, T.l, T.end), yh = V.hy - 22 + (dropFrom || -90) * (1 - e) + (t > T.b ? Math.sin((t - T.b) / 260) * 1.4 : 0) - 12 * EZ_V159C.inQ(xp);
    var rx = 15 * scale * (0.6 + 0.4 * e), ry = rx * 0.32, a = env * c01V159C(p * 2);
    V.ell(V.hx, yh, rx, ry, 6, S.c(0), 0.22 * a, 1); V.ell(V.hx, yh, rx, ry, 2.8, S.c(0), 0.85 * a, 1); V.ell(V.hx, yh, rx, ry, 1.1, 0xffffff, a, 1);
    if (!S.calm) { var th = t / 1000 * 5.5; V.star(V.hx + Math.cos(th) * rx, yh + Math.sin(th) * ry, 5, 0.8, 4, th, 0xffffff, 0.9 * a, 1); }
  }
  function columnV159C(S, V, t, env) {
    var T = S.T, I = c01V159C(t / Math.max(1, T.a * 0.6)) * (1 - segV159C(t, T.a + 100, T.b + 240)) * env; if (I < 0.01) return;
    var w = 60 - 46 * EZ_V159C.inOutS(segV159C(t, 0, T.a)) + 30 * segV159C(t, T.a, T.b + 240), hx = V.hx;
    V.poly([hx - w * 0.3, -380, hx + w * 0.3, -380, hx + w * 0.8, S.gy, hx - w * 0.8, S.gy], S.c(0), 0.2 * I, 1);
    V.poly([hx - w * 0.1, -380, hx + w * 0.1, -380, hx + w * 0.3, S.gy, hx - w * 0.3, S.gy], 0xffffff, 0.22 * I, 1);
  }
  function jagV159C(S, x0, y0, x1, y1, depth, disp) {
    var pts = [x0, y0, x1, y1];
    for (var d = 0; d < depth; d++) { var out = []; for (var i = 0; i < pts.length - 2; i += 2) { var mx = (pts[i] + pts[i + 2]) / 2 + S.R(-disp, disp), my = (pts[i + 1] + pts[i + 3]) / 2 + S.R(-disp, disp) * 0.3; out.push(pts[i], pts[i + 1], mx, my); } out.push(pts[pts.length - 2], pts[pts.length - 1]); pts = out; disp *= 0.55; }
    return pts;
  }
  var KINDS_V159C = {
    /* the stadium's own confetti, from two cannons either side of him */
    confetti: { pose: "jump", g: { pool: 1, ring: 1, flash: 26 },
      build: function (S) { var T = S.T; S.gather(10, 0, S.hy, 60, 0);
        for (var side = -1; side <= 1; side += 2) for (var i = 0; i < S.N(62); i++)
          S.add({ b: T.a + S.R(0, 110), l: S.R(1300, 1950), x: side * 34, y: S.gy - 4, vx: -side * S.R(30, 150), vy: -S.R(250, 430), g: 300, k: 1.9, a: S.R(0, 6.28), w: S.R(-9, 9), s: S.R(3, 5), sh: "quad", fp: 1, fl: S.R(3, 8), fw: S.R(1.1, 2.1), ph: S.R(0, 6.28), c: S.c(i + (side > 0 ? 3 : 0)) });
        for (var j = 0; j < S.N(12); j++) S.add({ b: T.a + S.R(0, 60), l: S.R(500, 800), x: (j % 2 ? 1 : -1) * 34, y: S.gy - 6, vx: (j % 2 ? -1 : 1) * S.R(20, 80), vy: -S.R(300, 420), g: 200, k: 2.2, s: 1.6, sh: "dot", add: 1, glow: 1, tr: 110, c: 0xffffff }); },
      front: function (S, V, t) { var p = segV159C(t, S.T.a, S.T.a + 160); if (p > 0 && p < 1 && !S.calm) for (var s = -1; s <= 1; s += 2) V.circ(V.hx + s * 34, S.gy - 6, 12 * (0.6 + p), 0xfff3c4, (1 - p) * 0.7, 1); } },
    /* a follow spot: the cone flickers on, motes drift up it, a glint at his helmet */
    spot: { pose: "jump", g: { ring: 1, flash: 22, antRing: 0 },
      build: function (S) { var T = S.T;
        for (var i = 0; i < S.N(46); i++) S.add({ b: S.R(T.a - 120, T.l - 300), l: S.R(700, 1300), x: S.R(-38, 38), y: S.R(-30, S.gy), vy: -S.R(18, 50), s: S.R(0.7, 1.5), add: 1, glow: 1, tw: 1, ph: S.R(0, 6.28), c: S.c(i) });
        S.add({ b: T.a, l: 520, x: 6, y: S.hy - 4, s: 13, sh: "glint", w: 2, c: 0xffffff }); },
      back: function (S, V, t, env) { var T = S.T, fk = [0, 0.7, 0.1, 0.9, 0.25, 1][Math.min(5, Math.floor(segV159C(t, 0, T.a) * 6))], I = (t < T.a && !S.calm ? fk : 1) * env * (S.calm ? c01V159C(t / T.a) : 1);
        var tx = V.hx * 0.4 + Math.sin(t / 700) * 8, hx = V.hx;
        V.poly([tx - 9, -360, tx + 9, -360, hx + 54, S.gy, hx - 54, S.gy], S.c(0), 0.2 * I, 1);
        V.poly([tx - 4, -360, tx + 4, -360, hx + 30, S.gy, hx - 30, S.gy], 0xffffff, 0.14 * I, 1);
        V.ell(hx, S.gy, 54, 15, 0, S.c(1), 0.32 * I, 1); V.ell(hx, S.gy, 30, 8, 0, 0xffffff, 0.2 * I, 1); } },
    /* coins / rings rain from a gathering glint and ring on the grass */
    rain: { pose: "jump", g: { pool: 0, rays: 12, ring: 1, flash: 28 },
      build: function (S) { var T = S.T; S.gather(14, 0, -230, 90, 0);
        for (var i = 0; i < S.N(56); i++) { var b = S.R(T.a - 40, T.l - 650), x = S.R(-140, 140), y0 = S.R(-300, -220), vy = S.R(20, 90), ly = S.gy + S.R(-18, 14), tau = 0, yy = y0;
          while (yy < ly && tau < 2000) { tau += 10; var s1 = tau / 1000, E = (1 - Math.exp(-0.3 * s1)) / 0.3; yy = y0 + vy * E + 560 * (s1 - E) / 0.3; }
          if (!S.add({ b: b, l: tau, x: x, y: y0, vy: vy, g: 560, k: 0.3, a: S.R(0, 6.28), w: S.R(8, 16), s: S.R(4.5, 6.5), sh: "quad", fp: 1, ph: S.R(0, 6.28), c: S.c(i), fa: 40 })) break;
          S.add({ b: b + tau, l: 260, x: x, y: ly, s: 7, sh: "glint", w: 3, c: S.c(i + 1), fa: 10 }); } } },
    /* three shells: a rocket up with its trail, the break, the crackle */
    fireworks: { pose: "jump", g: { ring: 0, flash: 0, antRing: 0 },
      build: function (S) { var T = S.T, shells = S.calm ? 1 : 3; S.k.shells = [];
        for (var i = 0; i < shells; i++) { var te = T.a + i * (S.calm ? 0 : 230), fly = Math.min(300, te), lx = -50 + 50 * i + S.R(-10, 10), ax = lx * 1.6 + S.R(-15, 15), ay = S.R(-215, -160);
          S.k.shells.push({ t: te, x: ax, y: ay, c: S.c(i) });
          S.add({ b: te - fly, l: fly, x: lx, y: S.gy, vx: (ax - lx) / (fly / 1000), vy: (ay - S.gy) / (fly / 1000), s: 2, add: 1, glow: 1, tr: 120, c: 0xfff3c4, fa: 20 });
          var nn = S.N(34);
          for (var j = 0; j < nn; j++) { var th = j / nn * 6.2832 + S.R(-0.08, 0.08), sp = (j % 3 === 0 ? 0.6 : 1) * S.R(150, 220);
            S.add({ b: te, l: S.R(800, 1150), x: ax, y: ay, vx: Math.cos(th) * sp, vy: Math.sin(th) * sp, k: 2.4, g: 110, s: S.R(1.4, 2.2), add: 1, glow: 1, tr: 95, c: S.c(i + (j % 2)), c2: S.c(i + 2), fa: 10 }); }
          for (var k = 0; k < S.N(8); k++) S.add({ b: te + S.R(450, 800), l: 240, x: ax + S.R(-60, 60), y: ay + S.R(-40, 50), s: S.R(3, 5), sh: "glint", w: 4, c: 0xffffff, tw: 1, fa: 10 }); } },
      front: function (S, V, t) { (S.k.shells || []).forEach(function (sh) { var p = segV159C(t, sh.t, sh.t + 200); if (p > 0 && p < 1) { V.circ(sh.x, sh.y, 20 * (0.5 + p), 0xffffff, (1 - p) * 0.38, 1); V.circ(sh.x, sh.y, 44 * (0.5 + p), sh.c, (1 - p) * 0.16, 1); } }); } },
    /* the stepped leader, the strike (a strobe), the scorch, sparks and arcs crawling over him */
    bolt: { pose: "stomp", shake: 1, flashCam: 1, g: { pool: 2, ring: 2, flash: 0 },
      build: function (S) { var T = S.T, x0 = S.R(-50, 50);
        S.k.main = jagV159C(S, x0, -360, 0, S.gy - 2, 5, 60);
        S.k.br = [8, 15].map(function (ix) { var bx = S.k.main[ix * 2], by = S.k.main[ix * 2 + 1], dir = S.R(0, 1) < 0.5 ? -1 : 1; return jagV159C(S, bx, by, bx + dir * S.R(40, 80), by + S.R(60, 110), 3, 20); });
        for (var i = 0; i < S.N(40); i++) { var th = S.R(-3.1, -0.05), sp = S.R(120, 280); S.add({ b: T.a + S.R(0, 40), l: S.R(400, 800), x: 0, y: S.gy - 3, vx: Math.cos(th) * sp, vy: Math.sin(th) * sp, k: 1.6, g: 420, s: 1.4, add: 1, glow: 1, tr: 70, c: i % 3 ? S.c(0) : 0xffffff, fa: 10 }); }
        S.gather(12, 0, S.gy, 46, 1); },
      back: function (S, V, t, env) { var T = S.T, sc = segV159C(t, T.a, T.a + 80); if (sc > 0) V.ell(0, S.gy, 28, 8, 0, 0x0c1220, 0.4 * env * sc, 0); },
      front: function (S, V, t, env) { var T = S.T, M = S.k.main, n = M.length / 2;
        if (t < T.a && !S.calm) { var lp = segV159C(t, T.a * 0.3, T.a), cut = Math.max(2, Math.floor(n * lp)) * 2; if (lp > 0) { var sub = M.slice(0, cut); V.path(sub, 3, S.c(2), 0.3, 1); V.path(sub, 1, 0xffffff, 0.55 * (0.5 + 0.5 * noiseV159C(S.seed, Math.floor(t / 40), 1)), 1); } }
        var fk = S.calm ? 1 : [1, 0.25, 1, 0.8, 0.2, 0.95, 0.6, 1][Math.floor(Math.max(0, t - T.a) / 45) % 8], I = (t >= T.a ? fk * (1 - segV159C(t, T.a, T.b + 120)) : 0) * env;
        if (I > 0.01) { var all = [M].concat(S.k.br);
          all.forEach(function (P, k) { var wm = k ? 0.55 : 1; V.path(P, 10 * wm, S.c(2), 0.18 * I, 1); V.path(P, 4 * wm, S.c(0), 0.55 * I, 1); V.path(P, 1.6 * wm, 0xffffff, I, 1); });
          V.circ(0, S.gy - 16, 70, S.c(0), 0.25 * I, 1); }
        if (!S.calm && t > T.b - 100 && t < T.l) { var wi = Math.floor((t - T.b) / 70), ia = (1 - segV159C(t, T.b, T.l)) * 0.85 * env;
          for (var j = 0; j < 3; j++) { var a0 = noiseV159C(S.seed, wi, j) * 6.2832, pts = [];
            for (var q = 0; q < 5; q++) { var aa = a0 + q * 0.32, rr = 17 + noiseV159C(S.seed, wi * 7 + q, j + 9) * 9; pts.push(V.hx + Math.cos(aa) * rr, V.hy + 6 + Math.sin(aa) * rr * 1.2); }
            V.path(pts, 1.1, 0xffffff, ia, 1); V.path(pts, 3, S.c(0), ia * 0.35, 1); } } } },
    /* ignition: embers gather, then flame tongues (hot white → the kind's red), a ring of fire, rising embers */
    flame: { pose: "stomp", shake: 0.5, g: { ring: 1, flash: 28, ringCol: 1 },
      build: function (S) { var T = S.T, hot = mixV159C(S.c(1), 0xffffff, 0.45); S.gather(18, 0, S.gy, 50, 0);
        for (var i = 0; i < S.N(92); i++) S.add({ b: S.R(T.a - 30, T.l - 320), l: S.R(520, 900), x: S.R(-26, 26), y: S.gy - S.R(0, 6), vx: S.R(-12, 12), vy: -S.R(40, 90), g: -170, k: 0.8, s: S.R(4.5, 7.5), s1: 0.18, add: 1, fl: S.R(2, 5), fw: S.R(2, 4), ph: S.R(0, 6.28), c: hot, c2: S.c(2), fa: 50 });
        for (var j = 0; j < S.N(24); j++) S.add({ b: S.R(T.a, T.l - 300), l: S.R(900, 1500), x: S.R(-30, 30), y: S.gy - 10, vx: S.R(-30, 30), vy: -S.R(90, 160), g: -20, k: 0.9, tr: 90, s: 1.1, add: 1, glow: 1, fl: S.R(5, 10), fw: S.R(0.8, 1.6), ph: S.R(0, 6.28), c: S.c(0) }); },
      back: function (S, V, t, env) { var T = S.T, I = env * c01V159C(t / Math.max(1, T.a)), fk = 0.7 + 0.3 * Math.sin(t / 37) * Math.sin(t / 53), r = 30 + 14 * EZ_V159C.outC(segV159C(t, T.a, T.b));
        V.ell(V.hx, S.gy, r * 1.5, r * 0.45, 0, S.c(0), 0.18 * I, 1); if (t > T.a) V.ell(V.hx, S.gy, r, r * 0.3, 3.2, S.c(1), 0.7 * I * fk, 1); } },
    /* a burst of spinning stars, then five circle his helmet (cartoon-dizzy), the near ones larger */
    stars: { pose: "jump", g: { rays: 8, ring: 1, flash: 22 },
      build: function (S) { var T = S.T; S.gather(12, 0, S.hy, 50, 0);
        for (var i = 0; i < S.N(34); i++) { var th = S.R(0, 6.2832), sp = S.R(110, 210); S.add({ b: T.a + S.R(0, 60), l: S.R(700, 1100), x: 0, y: S.hy, vx: Math.cos(th) * sp, vy: Math.sin(th) * sp * 0.85 - 30, k: 2.6, g: 60, a: S.R(0, 6.28), w: S.R(-6, 6), s: S.R(3, 6), sh: "star", add: 1, glow: 1, c: S.c(i), fa: 20 }); }
        for (var j = 0; j < S.N(12); j++) S.add({ b: S.R(T.b, T.l), l: 300, x: S.R(-50, 50), y: S.hy + S.R(-50, 20), s: S.R(3, 5), sh: "glint", c: 0xffffff, tw: 1, fa: 10 }); },
      front: function (S, V, t, env) { var T = S.T, ap = segV159C(t, T.a, T.a + 320); if (ap <= 0 || S.calm && ap <= 0) return;
        var app = S.calm ? EZ_V159C.outQ(ap) : EZ_V159C.outB(ap), cx = V.hx, cy = V.hy - 30, sp = S.calm ? 1.5 : 4.2;
        for (var i = 0; i < 5; i++) { for (var k = 3; k >= 0; k--) { var th = (t - k * 28) / 1000 * sp + i * 1.2566, fr = Math.sin(th), sc = (0.8 + 0.3 * fr) * app * (1 - k * 0.22), a = (0.62 + 0.38 * fr) * env * (k ? 0.3 : 1);
          V.star(cx + Math.cos(th) * 24, cy + fr * 7, 5 * sc, 2.2 * sc, 5, th * 1.5, k ? S.c(i) : S.c(i), a, 1); if (!k) V.circ(cx + Math.cos(th) * 24, cy + fr * 7, 7 * sc, S.c(i), 0.18 * a, 1); } } } },
    /* smoke cannons either side (team colour, soft puffs that swell), a low roll along the grass, pyro sparks */
    smoke: { pose: "jump", g: { ring: 1, flash: 0, antRing: 0 },
      build: function (S) { var T = S.T;
        for (var side = -1; side <= 1; side += 2) for (var i = 0; i < S.N(28); i++) S.add({ b: T.a + S.R(0, 280), l: S.R(1300, 1900), x: side * 46 + S.R(-4, 4), y: S.gy - 4, vx: side * S.R(10, 40), vy: -S.R(180, 300), k: 2.1, g: -8, s: S.R(5, 8), s1: S.R(3, 4.2), al: 0.5, sh: "puff", c: i % 3 ? S.c(0) : mixV159C(S.c(0), 0x000000, 0.3), fa: 120 });
        for (var j = 0; j < S.N(20); j++) S.add({ b: T.a + S.R(0, 120), l: S.R(1100, 1600), x: S.R(-10, 10), y: S.gy, vx: S.R(-170, 170), vy: S.R(-10, 4), k: 2.6, s: 6, s1: 3.2, al: 0.34, sh: "puff", c: mixV159C(S.c(0), 0xffffff, 0.25), fa: 150 });
        for (var k = 0; k < S.N(18); k++) { var sd = k % 2 ? 1 : -1; S.add({ b: T.a + S.R(0, 90), l: S.R(500, 800), x: sd * 46, y: S.gy - 6, vx: sd * S.R(0, 50), vy: -S.R(260, 380), k: 1.8, g: 260, s: 1.3, add: 1, glow: 1, tr: 90, c: k % 3 ? 0xffd76f : 0xffffff }); } },
      front: function (S, V, t) { var p = segV159C(t, S.T.a, S.T.a + 180); if (p > 0 && p < 1 && !S.calm) for (var s = -1; s <= 1; s += 2) V.circ(V.hx + s * 46, S.gy - 8, 14 * (0.6 + p), 0xfff3c4, (1 - p) * 0.7, 1); } },
    /* light gathers over him, a crown drops onto his helmet (bounce), rays turn behind, gold dust falls */
    crown: { pose: "float", g: { rays: 14, ring: 1, flash: 30 },
      build: function (S) { var T = S.T; S.gather(18, 0, S.hy - 50, 60, 0);
        for (var i = 0; i < S.N(40); i++) S.add({ b: S.R(T.a + 100, T.l), l: S.R(800, 1300), x: S.R(-40, 40), y: S.hy - S.R(20, 60), vy: S.R(10, 40), g: 30, k: 1, s: S.R(0.9, 1.6), add: 1, glow: 1, tw: 1, fl: 3, ph: S.R(0, 6.28), c: S.c(i) }); },
      front: function (S, V, t, env) { var T = S.T, p = segV159C(t, T.a, T.a + 460); if (p <= 0) return;
        var e = S.calm ? EZ_V159C.outQ(p) : EZ_V159C.outBn(p), xp = segV159C(t, T.l, T.end), cx = V.hx, cy = V.hy - 30 - 90 * (1 - e) + (t > T.b ? Math.sin((t - T.b) / 300) * 1.3 : 0) - 14 * EZ_V159C.inQ(xp), a = env * c01V159C(p * 3), w = 15, h = 11;
        var dark = mixV159C(S.c(0), 0x000000, 0.45), pts = [cx - w, cy + h * 0.5, cx - w, cy - h * 0.5, cx - w * 0.5, cy, cx, cy - h, cx + w * 0.5, cy, cx + w, cy - h * 0.5, cx + w, cy + h * 0.5];
        V.circ(cx, cy - 2, 22, S.c(0), 0.2 * a, 1); V.poly(pts, dark, a, 0);
        var inn = [cx - w + 1.5, cy + h * 0.5 - 1.5, cx - w + 1.5, cy - h * 0.5 + 2, cx - w * 0.5, cy + 1.6, cx, cy - h + 2.2, cx + w * 0.5, cy + 1.6, cx + w - 1.5, cy - h * 0.5 + 2, cx + w - 1.5, cy + h * 0.5 - 1.5];
        V.poly(inn, S.c(0), a, 0); V.rquad(cx, cy + h * 0.5 - 2.5, w * 2 - 3, 3, 0, S.c(1), a, 0);
        V.circ(cx, cy + h * 0.5 - 2.5, 1.6, 0xff4d6d, a, 0); V.circ(cx - 8, cy + h * 0.5 - 2.5, 1.3, 0x6fd3ff, a, 0); V.circ(cx + 8, cy + h * 0.5 - 2.5, 1.3, 0x7cff9b, a, 0);
        [[-w, -h * 0.5], [0, -h], [w, -h * 0.5]].forEach(function (q) { V.circ(cx + q[0], cy + q[1], 1.6, 0xffffff, a, 0); });
        if (!S.calm) { var gp = ((t - T.a) % 900) / 900; V.star(cx - w + 2 * w * gp, cy - h * 0.2, 6 * Math.sin(Math.PI * gp), 0.9, 4, 0, 0xffffff, 0.9 * a, 1); } } },
    /* the ring contracts into his feet, three shockwaves in the field's perspective, dust, cracks, an air ripple */
    shock: { pose: "stomp", shake: 1, g: { ring: 3, flash: 36, ringR: 130 },
      build: function (S) { var T = S.T; S.gather(20, 0, S.gy, 70, 1);
        for (var i = 0; i < S.N(46); i++) { var th = S.R(0, 6.2832), sp = S.R(90, 230), dust = i % 3 === 0;
          S.add({ b: T.a + S.R(0, 50), l: S.R(450, 800), x: Math.cos(th) * 8, y: S.gy, vx: Math.cos(th) * sp, vy: Math.sin(th) * sp * 0.35 - S.R(60, 160), g: 520, k: 1.2, s: S.R(1.2, 2.4), c: dust ? 0x9a8a6a : S.c(i), add: dust ? 0 : 1, glow: dust ? 0 : 1, tr: dust ? 0 : 60 }); }
        S.k.cracks = []; for (var c = 0; c < 8; c++) { var a0 = c / 8 * 6.2832 + S.R(-0.2, 0.2), L = S.R(40, 70); S.k.cracks.push(jagV159C(S, 0, S.gy, Math.cos(a0) * L, S.gy + Math.sin(a0) * L * 0.34, 3, 8)); } },
      back: function (S, V, t, env) { var T = S.T, p = EZ_V159C.outC(segV159C(t, T.a, T.a + 200)); if (p <= 0) return;
        S.k.cracks.forEach(function (P) { var n = Math.max(2, Math.round(P.length / 2 * p)) * 2, sub = P.slice(0, n); V.path(sub, 1.8, 0x14110c, 0.5 * env, 0); V.path(sub, 0.8, S.c(0), 0.6 * env * (1 - segV159C(t, T.b, T.l)), 1); }); },
      front: function (S, V, t, env) { var p = segV159C(t, S.T.a, S.T.a + 460); if (p > 0 && p < 1 && !S.calm) { var r = 12 + 70 * EZ_V159C.outC(p); V.ell(V.hx, V.hy + 6, r, r, 2.5 * (1 - p) + 0.5, 0xffffff, (1 - p) * 0.45, 1); } } },
    /* a snow globe: a dome of light over him, a swirl of flakes up and a slow fall, frost at his feet */
    snow: { pose: "jump", g: { ring: 1, flash: 24, ringCol: 1 },
      build: function (S) { var T = S.T;
        for (var i = 0; i < S.N(12); i++) { var th = i / 12 * 6.2832; S.add({ b: S.R(0, T.a), l: T.a + 200, x: Math.cos(th) * 40, y: S.gy + Math.sin(th) * 12, s: S.R(3, 5), sh: "glint", c: S.c(i), fa: 60 }); }
        for (var j = 0; j < S.N(90); j++) { var a0 = S.R(-2.83, -0.31), sp = S.R(160, 300);
          S.add({ b: T.a + S.R(0, 220), l: S.R(1500, 2000), x: S.R(-30, 30), y: S.gy - S.R(0, 10), vx: Math.cos(a0) * sp, vy: Math.sin(a0) * sp, k: 2.3, g: 60, fl: S.R(4, 10), fw: S.R(0.6, 1.4), ph: S.R(0, 6.28), sh: "flake", s: S.R(1.6, 3.2), a: S.R(0, 3), w: S.R(-3, 3), c: S.c(j), al: 0.95, glow: j % 4 ? 0 : 1, add: 1 }); } },
      back: function (S, V, t, env) { var T = S.T, I = EZ_V159C.outC(segV159C(t, T.a, T.b)) * env; if (I < 0.01) return;
        var pts = [], hi = []; for (var i = 0; i <= 20; i++) { var th = Math.PI + i / 20 * Math.PI; pts.push(V.hx + Math.cos(th) * 86, S.gy + Math.sin(th) * 100); if (i >= 3 && i <= 8) hi.push(V.hx + Math.cos(th) * 78, S.gy + Math.sin(th) * 91); }
        V.ell(V.hx, S.gy - 40, 80, 70, 0, S.c(2), 0.07 * I, 1); V.path(pts, 1.6, S.c(1), 0.5 * I, 1); V.path(hi, 2.6, 0xffffff, 0.6 * I, 1); V.ell(V.hx, S.gy, 86, 20, 1.4, S.c(1), 0.45 * I, 1); V.ell(V.hx, S.gy, 60, 14, 0, 0xffffff, 0.12 * I, 1); } },
    /* 8-bit: everything on a grid and at 12 frames a second — eight-way burst, a stepped diamond ring */
    pixel: { pose: "jump8", g: { ring: 0, flash: 0, antRing: 0 },
      build: function (S) { var T = S.T; S.q = 3;
        for (var d = 0; d < 8; d++) for (var k = 0; k < (S.calm ? 2 : 6); k++) { var th = d * 0.7854, sp = 60 + k * 36; S.add({ b: T.a + (k % 2) * 83, l: 720, x: 0, y: S.hy + 8, vx: Math.cos(th) * sp, vy: Math.sin(th) * sp, g: 60, s: k >= 3 ? 3 : 4, sh: "pix", c: S.c(k + d), fa: 1 }); }
        for (var j = 0; j < S.N(24); j++) { var a0 = S.R(0, 6.2832), r0 = S.R(20, 70); S.add({ b: T.a + S.R(80, 700), l: 330, x: Math.cos(a0) * r0, y: S.hy + Math.sin(a0) * r0 * 0.8, s: 3, sh: "pix", c: S.c(j), tw: 1, fa: 1 }); } },
      back: function (S, V, t, env) { var T = S.T, p = Math.floor(segV159C(t, T.a, T.a + 500) * 6) / 6; if (p <= 0 || p >= 1) return; var r = 12 + 84 * p, cy = V.hy + 8, sq = function (v) { return Math.round(v / 3) * 3; };
        V.path([sq(V.hx), sq(cy - r), sq(V.hx + r), sq(cy), sq(V.hx), sq(cy + r), sq(V.hx - r), sq(cy), sq(V.hx), sq(cy - r)], 3, S.c(0), (1 - p) * env, 0); } },
    /* meteors streak in from the upper left and land in turn: a flash, a ring, hot debris, a crater */
    meteor: { pose: "stomp", shake: 1, g: { ring: 0, flash: 0, antRing: 0 },
      build: function (S) { var T = S.T, when = [0, 130, 270, 430, 610], n = S.calm ? 2 : 5; S.k.hits = [];
        for (var i = 0; i < n; i++) { var ti = T.a + when[i] * (S.calm ? 0.5 : 1), ix = i ? S.R(-85, 85) : 0, iy = S.gy + (i ? S.R(-14, 12) : 2), fly = Math.min(360, ti), sx = ix - S.R(230, 290), sy = iy - 300;
          S.k.hits.push({ t: ti, x: ix, y: iy });
          S.add({ b: ti - fly, l: fly, x: sx, y: sy, vx: (ix - sx) / (fly / 1000), vy: (iy - sy) / (fly / 1000), s: 3.6, add: 1, glow: 1, tr: 170, c: mixV159C(S.c(1), 0xffffff, 0.5), c2: S.c(0), fa: 30 });
          for (var j = 0; j < S.N(12); j++) { var th = S.R(-3.0, -0.15), sp = S.R(80, 200); S.add({ b: ti, l: S.R(400, 700), x: ix, y: iy, vx: Math.cos(th) * sp, vy: Math.sin(th) * sp, k: 1.6, g: 480, tr: 50, s: S.R(1.2, 2.2), add: 1, glow: 1, c: S.c(1), c2: S.c(2), fa: 10 }); }
          for (var q = 0; q < S.N(3); q++) S.add({ b: ti + 40, l: S.R(900, 1300), x: ix + S.R(-6, 6), y: iy - 4, vx: S.R(-20, 20), vy: -S.R(20, 50), k: 1.5, s: 4, s1: 3, al: 0.35, sh: "puff", c: 0x5a5048, fa: 120 }); } },
      back: function (S, V, t, env) { S.k.hits.forEach(function (h) { var p = segV159C(t, h.t, h.t + 60); if (p > 0) V.ell(h.x, h.y, 11, 3.6, 0, 0x140c06, 0.45 * env * p, 0); }); },
      front: function (S, V, t, env) { S.k.hits.forEach(function (h) { var p = segV159C(t, h.t, h.t + 380); if (p > 0 && p < 1) { var r = 6 + 40 * EZ_V159C.outC(p); V.ell(h.x, h.y, r, r * 0.34, 2 * (1 - p) + 0.5, S.c(0), (1 - p) * 0.9 * env, 1);
        var fp = segV159C(t, h.t, h.t + 160); if (fp < 1) { V.circ(h.x, h.y - 6, 26 * (0.5 + fp), 0xffffff, (1 - fp) * 0.55, 1); V.circ(h.x, h.y - 6, 44 * (0.5 + fp), S.c(0), (1 - fp) * 0.25, 1); } } }); } },
    /* the arc draws itself band by band, a star at its tip; a highlight travels it; it dissolves from the ends */
    rainbow: { pose: "float", g: { ring: 1, flash: 20 },
      build: function (S) { var T = S.T;
        for (var i = 0; i < S.N(30); i++) { var th = S.R(3.3, 6.1), bi = i % Math.max(1, S.cols.length), r = 96 - bi * 5.2;
          S.add({ b: S.R(T.a + 200, T.l - 200), l: S.R(600, 900), x: Math.cos(th) * r, y: S.gy + 6 + Math.sin(th) * r, vy: S.R(10, 40), g: 40, s: S.R(2.5, 4), sh: i % 2 ? "glint" : "dot", add: 1, glow: 1, tw: 1, ph: S.R(0, 6.28), c: S.c(bi) }); } },
      back: function (S, V, t, env) { var T = S.T, pr = EZ_V159C.inOutS(segV159C(t, T.a - 60, T.b)), fp = segV159C(t, T.l, T.end); if (pr <= 0) return;
        var a0 = Math.PI + Math.PI * fp * 0.5, a1 = Math.PI + Math.PI * pr - Math.PI * fp * 0.5, cy = S.gy + 6;
        for (var i = 0; i < S.cols.length; i++) V.arc(V.hx * 0.3, cy, 96 - i * 5.2, a0, Math.max(a0 + 0.01, a1), 5.4, S.c(i), 0.85 * env, 0);
        if (t > T.b && !S.calm) { var ht = Math.PI + Math.PI * segV159C(t, T.b, T.l); V.arc(V.hx * 0.3, cy, 96 - 13, ht - 0.12, ht + 0.12, 30, 0xffffff, 0.22 * env, 1); }
        if (pr < 1) { var tp = Math.PI + Math.PI * pr; V.star(V.hx * 0.3 + Math.cos(tp) * 83, cy + Math.sin(tp) * 83, 10, 1.4, 4, t / 200, 0xffffff, 0.95, 1); } } },
    /* a light column narrows onto him, the halo drops onto his helmet (back-ease), holy rays, sparkles rise */
    halo: { pose: "float", g: { rays: 10, ring: 1, flash: 26 },
      build: function (S) { var T = S.T;
        for (var i = 0; i < S.N(34); i++) S.add({ b: S.R(T.a, T.l - 300), l: S.R(700, 1200), x: S.R(-26, 26), y: S.hy + S.R(-10, 30), vy: -S.R(20, 60), s: S.R(1, 1.8), sh: i % 3 ? "dot" : "glint", add: 1, glow: 1, tw: 1, ph: S.R(0, 6.28), c: S.c(i) });
        if (!S.calm) for (var j = 0; j < S.N(14); j++) { var d = S.R(0.16, 0.26); S.add({ b: T.a - d * 1000, l: d * 1000, x: S.R(-20, 20), y: -260, vy: (S.hy + 260) / d, s: 1.4, add: 1, glow: 1, tr: 80, c: S.c(1) }); } },
      back: function (S, V, t, env) { columnV159C(S, V, t, env); },
      front: function (S, V, t, env) { haloDrawV159C(S, V, t, env, 1, -100); } },
    /* the angel: light from above, two fans of feathers spread like wings then drift down swaying, a small halo */
    feathers: { pose: "float", g: { rays: 8, ring: 1, flash: 26 },
      build: function (S) { var T = S.T;
        for (var side = -1; side <= 1; side += 2) for (var i = 0; i < S.N(36); i++) { var a0 = side < 0 ? S.R(3.29, 4.34) : S.R(5.08, 6.13), sp = S.R(170, 280);
          S.add({ b: T.a + S.R(0, 120), l: S.R(1500, 2000), x: side * 6, y: S.hy + 8, vx: Math.cos(a0) * sp, vy: Math.sin(a0) * sp, k: 3.2, g: 34, fl: S.R(6, 12), fw: S.R(0.5, 1.0), ph: S.R(0, 6.28), sh: "feather", s: S.R(4, 6.5), a: a0 + 1.57, c: S.c(i), al: 0.95 }); }
        for (var j = 0; j < S.N(14); j++) S.add({ b: S.R(T.a, T.b), l: S.R(1200, 1600), x: S.R(-90, 90), y: -240, vy: 30, g: 20, k: 0.5, fl: S.R(6, 10), fw: S.R(0.5, 0.9), ph: S.R(0, 6.28), sh: "feather", s: S.R(4, 6), c: S.c(j + 1), al: 0.9 }); },
      back: function (S, V, t, env) { columnV159C(S, V, t, env); },
      front: function (S, V, t, env) { haloDrawV159C(S, V, t, env, 0.8, -60); } }
  };
  function drawV159C(S, V, t) {
    var T = S.T; if (t >= T.end || t < 0) return 0;
    var env = 1 - EZ_V159C.inOutS(segV159C(t, T.l, T.end)), K = S.K;
    commonBackV159C(S, V, t, env); if (K.back) K.back(S, V, t, env);
    var live = partsV159C(S, V, t, env);
    if (K.front) K.front(S, V, t, env); commonFrontV159C(S, V, t, env);
    return live;
  }

  /* ---- two painters: Phaser Graphics (the field) and a 2D canvas (the Locker), behind one view (unit → pixels) ---- */
  function viewV159C(B, ox, oy, u, su) {
    var X = function (v) { return ox + v * u; }, Y = function (v) { return oy + v * u; }, S1 = function (v) { return Math.max(0.35, v * su); }, pts = [];
    var map = function (p) { pts.length = p.length; for (var i = 0; i < p.length; i += 2) { pts[i] = X(p[i]); pts[i + 1] = Y(p[i + 1]); } return pts; };
    return { hx: 0, hy: -24, u: u, su: su,
      circ: function (x, y, r, c, a, add) { if (a > 0.004) B.circ(X(x), Y(y), S1(r), c, Math.min(1, a), add); },
      ell: function (x, y, rx, ry, w, c, a, add) { if (a > 0.004) B.ell(X(x), Y(y), Math.max(0.5, rx * u), Math.max(0.3, ry * u), w > 0 ? S1(w) : 0, c, Math.min(1, a), add); },
      line: function (x1, y1, x2, y2, w, c, a, add) { if (a > 0.004) B.line(X(x1), Y(y1), X(x2), Y(y2), S1(w), c, Math.min(1, a), add); },
      poly: function (p, c, a, add) { if (a > 0.004) B.poly(map(p), c, Math.min(1, a), add); },
      path: function (p, w, c, a, add) { if (a > 0.004 && p.length >= 4) B.path(map(p), S1(w), c, Math.min(1, a), add); },
      arc: function (x, y, r, a0, a1, w, c, a, add) { if (a > 0.004) B.arc(X(x), Y(y), r * u, a0, a1, S1(w), c, Math.min(1, a), add); },
      rquad: function (x, y, w, h, ang, c, a, add) { if (a <= 0.004) return; var cs = Math.cos(ang), sn = Math.sin(ang), hw = S1(w) / 2, hh = S1(h) / 2, cx = X(x), cy = Y(y);
        B.poly([cx - cs * hw + sn * hh, cy - sn * hw - cs * hh, cx + cs * hw + sn * hh, cy + sn * hw - cs * hh, cx + cs * hw - sn * hh, cy + sn * hw + cs * hh, cx - cs * hw - sn * hh, cy - sn * hw + cs * hh], c, Math.min(1, a), add); },
      star: function (x, y, ro, ri, n, ang, c, a, add) { if (a <= 0.004) return; var cx = X(x), cy = Y(y), R0 = S1(ro), R1 = S1(ri), p = [];
        for (var i = 0; i < n * 2; i++) { var th = ang + i * Math.PI / n - Math.PI / 2, r = i % 2 ? R1 : R0; p.push(cx + Math.cos(th) * r, cy + Math.sin(th) * r); } B.poly(p, c, Math.min(1, a), add); },
      leaf: function (x, y, w, l, ang, c, a, add) { if (a <= 0.004) return; var cx = X(x), cy = Y(y), W = S1(w), L = S1(l), cs = Math.cos(ang), sn = Math.sin(ang),
        q = [0, -L, W, -L * 0.3, W * 0.7, L * 0.6, 0, L, -W * 0.7, L * 0.6, -W, -L * 0.3], p = [];
        for (var i = 0; i < q.length; i += 2) p.push(cx + q[i] * cs - q[i + 1] * sn, cy + q[i] * sn + q[i + 1] * cs); B.poly(p, c, Math.min(1, a), add); } };
  }
  function phaserPainterV159C(gN, gA) {
    var G = function (add) { return add ? gA : gN; };
    return {
      circ: function (x, y, r, c, a, add) { var g = G(add); g.fillStyle(c, a); g.fillCircle(x, y, r); },
      ell: function (x, y, rx, ry, w, c, a, add) { var g = G(add); if (w > 0) { g.lineStyle(w, c, a); g.strokeEllipse(x, y, rx * 2, ry * 2, 28); } else { g.fillStyle(c, a); g.fillEllipse(x, y, rx * 2, ry * 2, 28); } },
      line: function (x1, y1, x2, y2, w, c, a, add) { var g = G(add); g.lineStyle(w, c, a); g.lineBetween(x1, y1, x2, y2); },
      poly: function (p, c, a, add) { var g = G(add); g.fillStyle(c, a); g.beginPath(); g.moveTo(p[0], p[1]); for (var i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); g.fillPath(); },
      path: function (p, w, c, a, add) { var g = G(add); g.lineStyle(w, c, a); g.beginPath(); g.moveTo(p[0], p[1]); for (var i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.strokePath(); },
      arc: function (x, y, r, a0, a1, w, c, a, add) { var g = G(add); g.lineStyle(w, c, a); g.beginPath(); g.arc(x, y, r, a0, a1, false); g.strokePath(); }
    };
  }
  var CSS_COL_V159C = {};
  function cssColV159C(c) { return CSS_COL_V159C[c] || (CSS_COL_V159C[c] = "rgb(" + ((c >> 16) & 255) + "," + ((c >> 8) & 255) + "," + (c & 255) + ")"); }
  function canvasPainterV159C(x) {
    var set = function (c, a, add) { x.globalAlpha = a; x.globalCompositeOperation = add ? "lighter" : "source-over"; return cssColV159C(c); };
    return {
      circ: function (px, py, r, c, a, add) { x.fillStyle = set(c, a, add); x.beginPath(); x.arc(px, py, r, 0, 6.2832); x.fill(); },
      ell: function (px, py, rx, ry, w, c, a, add) { var s = set(c, a, add); x.beginPath(); x.ellipse(px, py, rx, ry, 0, 0, 6.2832); if (w > 0) { x.lineWidth = w; x.lineCap = "round"; x.lineJoin = "round"; x.strokeStyle = s; x.stroke(); } else { x.fillStyle = s; x.fill(); } },
      line: function (x1, y1, x2, y2, w, c, a, add) { x.strokeStyle = set(c, a, add); x.lineWidth = w; x.lineCap = "round"; x.lineJoin = "round"; x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke(); },
      poly: function (p, c, a, add) { x.fillStyle = set(c, a, add); x.beginPath(); x.moveTo(p[0], p[1]); for (var i = 2; i < p.length; i += 2) x.lineTo(p[i], p[i + 1]); x.closePath(); x.fill(); },
      path: function (p, w, c, a, add) { x.strokeStyle = set(c, a, add); x.lineWidth = w; x.lineCap = "round"; x.lineJoin = "round"; x.beginPath(); x.moveTo(p[0], p[1]); for (var i = 2; i < p.length; i += 2) x.lineTo(p[i], p[i + 1]); x.stroke(); },
      arc: function (px, py, r, a0, a1, w, c, a, add) { x.strokeStyle = set(c, a, add); x.lineWidth = w; x.lineCap = "round"; x.lineJoin = "round"; x.beginPath(); x.arc(px, py, r, a0, a1); x.stroke(); }
    };
  }

  /* ---- the item → the plan ---- */
  function celColsV159C(it) {
    var C = it && it.c, raw = C && C.col ? C.col : ["#ff5a5a", "#ffd76f", "#6fd3ff", "#7cff9b", "#ff9ad5", "#ffffff"];
    return raw.map(function (h) { return h === "team" ? teamCol(0) : hexOk(h) || "#ffffff"; });
  }
  function celKindV159C(it) { return it && it.c && KINDS_V159C[it.c.kind] ? it.c.kind : "confetti"; }
  function planV159C(it, seed, calm) {
    var S = buildV159C(celKindV159C(it), celColsV159C(it), seed, calm);
    S.say = it && it.c && it.c.say ? String(it.c.say).toUpperCase().slice(0, 18) : "";
    S.sayDy = -36; S.id = it ? it.id : "";
    return S;
  }
  var FONT_V159C = "Oswald, Impact, sans-serif";
  function letterColV159C(S, i) { return S.kind === "rainbow" || S.kind === "pixel" || S.kind === "confetti" ? S.cols[i % S.cols.length] : S.cols[0]; }

  /* ---- the field: plays the plan over the stadium's own celebration, on HIS touchdown ---- */
  function fieldPlayV159C(scene, x, y, cm, it, opts) {
    opts = opts || {};
    var calm = opts.calm != null ? !!opts.calm : reducedV158A();
    var P = scene.play, tok = P && P.__ballTokenV1514 != null ? String(P.__ballTokenV1514) : String(Math.round((scene.time && scene.time.now) || 0));
    var seed = (strHashV159C(it.id + "|" + tok) ^ (opts.seed | 0)) >>> 0;
    var S = planV159C(it, seed, calm);
    try { if (scene.__celV159C) scene.__celV159C.stop("replaced"); } catch (e) {}
    var cam = scene.cameras && scene.cameras.main, z = (cam && cam.zoom) || 1, root = cm && cm.root && cm.root.active !== false ? cm.root : null;
    var rs = root ? Math.abs(root.scaleY || 1) : 0.7, u = TUv("v159Cscale", 1) * rs;
    u = Math.max(TUv("v159CminPx", 0.5) / z, Math.min(TUv("v159CmaxPx", 1.5) / z, u));
    var D = 20.5, track = function (o) { try { return scene.trackFx ? scene.trackFx(o) : o; } catch (e) { return o; } };
    var gN = track(scene.add.graphics().setDepth(D)), gA = track(scene.add.graphics().setDepth(D + 0.05));
    try { gA.setBlendMode(1); } catch (e) {}   // Phaser.BlendModes.ADD → "lighter" on the canvas renderer
    var B = phaserPainterV159C(gN, gA), V = viewV159C(B, x, y, u, u);
    S.gy = root ? 24 * rs / u : 22; S.hy = root ? -24 * rs / u : -24;
    var letters = [], mathRnd = Math.random;
    /* Phaser names every Text's canvas texture with a UUID drawn from Math.random: the letters are made while
     * Math.random is this file's own PRNG, so the game's stream never pays for a celebration */
    if (S.say) try { Math.random = rnd;
      var fs = Math.max(10, Math.round(24 * u)), cx = 0, st = { fontFamily: S.kind === "pixel" ? "'Courier New', monospace" : FONT_V159C, fontSize: fs + "px", fontStyle: "bold", stroke: "#0b0f16", strokeThickness: Math.max(3, Math.round(fs * 0.24)) };
      for (var i = 0; i < S.say.length; i++) { var ch = S.say[i]; if (ch === " ") { cx += fs * 0.32; continue; }
        var tx = track(scene.add.text(0, 0, ch, Object.assign({ color: letterColV159C(S, letters.length) }, st)).setOrigin(0.5).setDepth(D + 0.2).setAlpha(0));
        try { tx.setShadow(0, 0, S.cols[1 % S.cols.length], Math.round(fs * 0.45), true, true); } catch (e) {}
        var lw = tx.width - st.strokeThickness * 0.6; letters.push({ o: tx, x: cx + lw / 2 }); cx += lw + fs * 0.04; }
      letters.forEach(function (L) { L.x = (L.x - cx / 2) / u; }); S.sayW = cx / u;
    } finally { Math.random = mathRnd; }
    var run = { id: it.id, kind: S.kind, calm: calm, t0: performance.now(), end: S.T.end, T: S.T, parts: S.parts.length, cap: S.cap, dropped: S.dropped, stages: [], frames: 0, maxLive: 0, ms: [],
      drawMs: 0, drawMax: 0, u: u, zoom: z, hold: null, alive: true, pose: 0, shake: 0, stage: -1, ended: null, say: S.say, letters: letters.length };
    var shadow = cm && cm.shadow, fill = cm && cm.fill, sh0 = shadow ? shadow.y : 24, fl0 = fill ? fill.y : 24, last = null;
    /* the pose writes the marker's container after placeMarker has placed it this frame; when the scene's update
     * did not run (the base still carries last frame's pose) the stored base is used, so nothing compounds */
    var applyPose = function (t) {
      if (!root || !root.active) return;
      if (cm && cm.__v161a && cm.__v161a.alive) { run.body161 = (run.body161 || 0) + 1; cm.__v161a.v159Skipped++; return; }   // v161 A: the drawn body owns him
      var bx = root.x, by = root.y, bs = root.scaleY;
      if (last && root.x === last.ax && root.y === last.ay && root.scaleY === last.as) { bx = last.bx; by = last.by; bs = last.bs; }
      var o = poseV159C(S, t);
      if (!o) { if (last) { root.setPosition(bx, by); root.setScale(bs); last = null; } return; }
      var sx = o.sx * bs, sy = o.sy * bs, ny = by + 24 * bs * (1 - o.sy) - o.hop * bs;
      root.setPosition(bx, ny); root.setScale(sx, sy);
      if (shadow) { shadow.y = sh0 + o.hop / o.sy; shadow.setScale(o.sh, o.sh); } if (fill) { fill.y = fl0 + o.hop / o.sy; fill.setScale(o.sh, o.sh); }
      last = { ax: root.x, ay: root.y, as: root.scaleY, bx: bx, by: by, bs: bs }; run.pose++;
      V.hx = (bx - x) / u; V.hy = (by - y) / u;
    };
    var tick = function () {
      if (!run.alive) return;
      if (!gN.scene || !gA.scene) { stop("cleared"); return; }
      var t = run.hold != null ? run.hold : performance.now() - run.t0;
      if (t >= S.T.end) { for (var sk0 = run.stage + 1; sk0 < 4; sk0++) run.stages.push({ s: STAGES_V159C[sk0], at: Math.round(t), prev: run.lastT == null ? -1 : Math.floor(run.lastT), skipped: 1 }); stop("done"); return; }
      var c0 = performance.now();
      try {
        applyPose(t);
        if (!root) { V.hx = 0; V.hy = S.hy; }
        var sg = stageV159C(t, S.T); if (sg !== run.stage) { for (var sk = run.stage + 1; sk < sg; sk++) run.stages.push({ s: STAGES_V159C[sk], at: Math.round(t), prev: run.lastT == null ? -1 : Math.floor(run.lastT), skipped: 1 });   // a frame longer than a stage (a loaded box) still passes through it
          run.stage = sg; run.stages.push({ s: STAGES_V159C[sg], at: Math.round(t), prev: run.lastT == null ? -1 : Math.floor(run.lastT) });
          if (sg === 1 && !calm && cam && S.K.shake && TUv("v159Cshake", 1)) { try { cam.shake(TUv("v159CshakeMs", 140), 0.0032 * S.K.shake * TUv("v159Cshake", 1)); run.shake++; } catch (e) {} }
          if (sg === 1 && !calm && cam && S.K.flashCam && TUv("v159CcamFlash", 1)) { try { cam.flash(110, 190, 220, 255); } catch (e) {} } }
        run.lastT = t; gN.clear(); gA.clear();
        var live = drawV159C(S, V, t); run.maxLive = Math.max(run.maxLive, live);
        for (var i = 0; i < letters.length; i++) { var L = letters[i], lp = letterPoseV159C(S, i, letters.length, t);
          if (!lp) { L.o.setAlpha(0); continue; }
          L.o.setPosition(x + (V.hx + L.x + lp.dx) * u, y + (V.hy + S.sayDy + lp.dy) * u).setScale(lp.sc).setAngle(lp.rot).setAlpha(lp.a); }
      } catch (e) { errV159C(e); }
      var dt = performance.now() - c0; run.frames++; run.drawMs += dt; run.drawMax = Math.max(run.drawMax, dt); if (run.ms.length < 400) run.ms.push(dt);
    };
    var stop = function (why) {
      if (!run.alive) return; run.alive = false; run.ended = why || "done";
      try { scene.events.off("postupdate", tick); } catch (e) {}
      try { if (root && root.active && last) { root.setPosition(last.bx, last.by); root.setScale(last.bs); } if (shadow && shadow.active !== false) { shadow.y = sh0; shadow.setScale(1); } if (fill && fill.active !== false) { fill.y = fl0; fill.setScale(1); } } catch (e) {}
      [gN, gA].concat(letters.map(function (L) { return L.o; })).forEach(function (o) { try { scene.dropFx ? scene.dropFx(o) : o.destroy(); } catch (e) {} });
      if (scene.__celV159C === run) scene.__celV159C = null;
      if (V159C.active === run) V159C.active = null;
    };
    run.stop = stop;
    run.setHold = function (t) { run.hold = t == null ? null : +t; };
    scene.__celV159C = run; V159C.active = run; V159C.last = run; V159C.plays.push(run); if (V159C.plays.length > 20) V159C.plays.shift();
    scene.events.on("postupdate", tick);
    try { scene.events.once("shutdown", function () { stop("shutdown"); }); } catch (e) {}
    tick();
    return { made: S.parts.length + letters.length + 2, run: run };
  }

  /* ---- the Locker: a looping mini-stage (his celebrate frames, the same plan, the same type) ---- */
  var PV_V159C = { list: [], raf: 0, last: 0 };
  function pvFigV159C(frame) {
    try { var C = window.__CHASE_V94; if (!C || !C.cell) return null; var U = resolveU((item("uniform") || {}).k || null, null) || { j: teamCol(0), p: teamCol(1) };
      return C.cell("celebrate_dn" + frame, [U.j, U.p]) || C.cell("idle_dn", [U.j, U.p]); } catch (e) { return null; }
  }
  function pvDrawV159C(rec, t) {
    var cv = rec.cv, x = cv.getContext("2d"), W = cv.__w, H = cv.__h, dpr = cv.__dpr || 1, S = rec.S; if (!x) return;
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; x.clearRect(0, 0, W, H);
    var u = W / 230, ox = W / 2, oy = H * 0.66, B = canvasPainterV159C(x), V = viewV159C(B, ox, oy, u, 0.5);
    S.gy = 22; S.hy = -24; V.hx = 0; V.hy = S.hy;
    x.globalAlpha = 0.5; x.fillStyle = "#1d5a2c"; x.beginPath(); x.ellipse(ox, oy + 22 * u, W * 0.46, 6, 0, 0, 6.2832); x.fill();
    var b161 = onV161A() && readyV161A();   // v161 A: the drawn bodies (the old celebrate cells when off / not decoded yet)
    var o = b161 ? { sx: 1, sy: 1, hop: 0, sh: poseV161A(pvNameV161A(rec), t, !!rec.calm161).sh } : poseV159C(S, t) || { sx: 1, sy: 1, hop: 0, sh: 1 }, fig = b161 ? null : pvFigV159C(Math.floor(Math.max(0, t) / TUv("celebrateFrameMs", 170)) % 4), fh = 22;
    x.globalAlpha = 0.35; x.globalCompositeOperation = "source-over"; x.fillStyle = "#000"; x.beginPath(); x.ellipse(ox, oy + 22 * u, 7 * o.sh, 2 * o.sh, 0, 0, 6.2832); x.fill();
    drawV159C(S, V, t);
    x.globalAlpha = 1; x.globalCompositeOperation = "source-over";
    if (b161) pvDrawBodyV161A(rec, x, t, ox, oy + 22 * u, !!rec.calm161);
    else if (fig) { x.imageSmoothingEnabled = false; var fw = fh * o.sx, fhh = fh * o.sy, fy = oy + 22 * u - fhh - o.hop * 0.5; x.drawImage(fig, 4, 2, 40, 44, ox - fw / 2, fy, fw, fhh); }
    if (S.say) {
      var fs = 9, n = S.say.length; x.font = "700 " + fs + "px " + (S.kind === "pixel" ? "'Courier New', monospace" : FONT_V159C); x.textAlign = "center"; x.textBaseline = "middle";
      var ws = [], tw = 0; for (var i = 0; i < n; i++) { var w = S.say[i] === " " ? fs * 0.3 : x.measureText(S.say[i]).width; ws.push(w); tw += w; }
      var k = Math.min(1, (W - 6) / tw), cx = ox - tw * k / 2, li = 0; S.sayW = tw * k / u;
      for (var j = 0; j < n; j++) { var ch = S.say[j], cw = ws[j] * k; if (ch !== " ") { var lp = letterPoseV159C(S, li, n, t);
        if (lp && lp.a > 0.01) { x.save(); x.globalAlpha = c01V159C(lp.a); x.translate(cx + cw / 2 + lp.dx * 0.4, 9 + lp.dy * 0.4); x.rotate(lp.rot * Math.PI / 180); x.scale(lp.sc * k, lp.sc * k);
          x.lineWidth = 2.6; x.strokeStyle = "#0b0f16"; x.strokeText(ch, 0, 0); x.fillStyle = letterColV159C(S, li); x.fillText(ch, 0, 0); x.restore(); }
        li++; } cx += cw; }
    }
    rec.frames = (rec.frames || 0) + 1; V159C.prevFrames++;
  }
  function pvTickV159C(ts) {
    PV_V159C.raf = 0;
    try {
      if (ts - PV_V159C.last >= 1000 / Math.max(6, TUv("v159CpvFps", 30)) - 2 && !document.hidden && !reducedV158A()) {
        PV_V159C.last = ts;
        for (var i = PV_V159C.list.length - 1; i >= 0; i--) { var r = PV_V159C.list[i];
          if (!r.cv.isConnected) { if (++r.miss > 90) PV_V159C.list.splice(i, 1); continue; }
          r.miss = 0; var period = Math.max(r.S.T.end, pvBodyLenV161A()) + TUv("v159CpvGapMs", 500); /* v161 A: the whole body plays */ r.t = (performance.now() - r.t0) % period; r.loops = Math.floor((performance.now() - r.t0) / period); pvDrawV159C(r, r.t); }
      }
    } catch (e) { errV159C(e); }
    if (PV_V159C.list.length && typeof requestAnimationFrame === "function") PV_V159C.raf = requestAnimationFrame(pvTickV159C);
  }
  function previewCelV159C(el, it) {
    var calm = reducedV158A(), cv = document.createElement("canvas"); cv.className = "cos-cel-v159c"; cv.setAttribute("aria-hidden", "true");
    sizeCvV158A(cv, 64, 60); el.innerHTML = ""; el.appendChild(cv);
    var rec = { cv: cv, it: it, S: planV159C(it, strHashV159C(it.id), calm), t0: performance.now() - (strHashV159C(it.id) % 700), miss: 0, frames: 0, t: 0, loops: 0,
      calm161: calm, bodyOff: strHashV159C(it.id) % 3 };   // v161 A: each tile starts on a different body
    cv.__v159c = rec; V159C.previews++; V161A.previews++;
    if (onV161A() && !readyV161A()) loadV161A(function () { if (calm && cv.isConnected) pvDrawV159C(rec, rec.S.T.b + (rec.S.T.l - rec.S.T.b) * 0.4); });
    if (calm || typeof requestAnimationFrame !== "function") { pvDrawV159C(rec, rec.S.T.b + (rec.S.T.l - rec.S.T.b) * 0.4); return true; }
    pvDrawV159C(rec, rec.S.T.b);
    if (PV_V159C.list.length >= TUv("v159CpvMax", 40)) PV_V159C.list.shift();
    PV_V159C.list.push(rec); if (!PV_V159C.raf) PV_V159C.raf = requestAnimationFrame(pvTickV159C);
    return true;
  }
  function previewV159C(el, it) {
    try {
      if (it.cat === "celebration" && onV159C()) return previewCelV159C(el, it);
      if (it.cat === "shelf" && onV159C("v159Cshelf")) { el.innerHTML = '<div class="cos-shelf-v151b s159c sh-' + escHtml(it.css) + '" style="' + phaseV159C() + '"><span style="--i:0"><em data-k="cup">🏆</em></span><span style="--i:1"><em data-k="star">🏅</em></span><span style="--i:2"><em data-k="ring">💍</em></span></div>'; return true; }
    } catch (e) { errV159C(e); }
    return false;
  }

  /* ---------------- the shelf ---------------- */
  var SHELF_CYCLE_V159C = 6.4;
  function phaseV159C() { return "--s159p:" + (-((performance.now() / 1000) % SHELF_CYCLE_V159C)).toFixed(2) + "s"; }
  var SEEN_KEY_V159C = "rib.cos.shelfSeen.v159c";
  function shelfV159C(root, d, self) {
    try {
      if (!onV159C("v159Cshelf")) return false;
      var sh = root && (root.classList && root.classList.contains("pc-shelf-v151b") ? root : root.querySelector(".pc-shelf-v151b")); if (!sh || sh.classList.contains("s159c")) return false;
      var calm = reducedV158A(), kinds = ["cup", "ring", "star", "hall"], vals = d ? [d.titles, d.rings, d.mvps, d.hof].map(function (v) { return Number(v) || 0; }) : null;
      sh.classList.add("s159c"); sh.setAttribute("style", phaseV159C());
      var spans = sh.querySelectorAll(":scope > span"), fresh = [];
      var seen = null; if (self && vals) { try { seen = JSON.parse(localStorage.getItem(SEEN_KEY_V159C) || "null"); } catch (e) {} try { localStorage.setItem(SEEN_KEY_V159C, JSON.stringify(vals)); } catch (e) {} }
      spans.forEach(function (sp, i) {
        sp.style.setProperty("--i", i); var em = sp.querySelector("em"), b = sp.querySelector("b"); if (em) em.setAttribute("data-k", kinds[i] || "cup");
        var v = vals ? vals[i] : parseInt(String(b && b.textContent || "").replace(/,/g, ""), 10);
        if (b && isFinite(v) && v > 0 && !/[KM]$/.test(b.textContent || "") && !calm) countUpV159C(b, v, i);
        if (seen && Array.isArray(seen) && vals && vals[i] > (Number(seen[i]) || 0)) fresh.push(i);
      });
      fresh.forEach(function (i) { var sp = spans[i]; if (!sp) return; setTimeout(function () { sp.classList.add("pop159c"); }, calm ? 0 : TUv("v159CcountMs", 900) + i * 90); V159C.pops.push({ i: i, k: kinds[i], at: Date.now() }); });
      V159C.shelves++;
      return true;
    } catch (e) { errV159C(e); return false; }
  }
  function countUpV159C(b, v, i) {
    var dur = TUv("v159CcountMs", 900), t0 = performance.now() + i * 80, fin = num(v); b.setAttribute("data-final", fin); b.textContent = "0"; V159C.countUps++;
    var step = function () { if (!b.isConnected) return; var p = c01V159C((performance.now() - t0) / dur); b.textContent = p >= 1 ? fin : num(Math.round(v * EZ_V159C.outC(p)));
      if (p < 1) requestAnimationFrame(step); };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(step); else b.textContent = fin;
  }
  setInterval(function () { try { if (onV159C("v159Cshelf")) document.querySelectorAll(".pc-shelf-v151b:not(.s159c)").forEach(function (sh) { shelfV159C(sh, null, false); }); } catch (e) {} }, 700);
  (function () {
    if (document.getElementById("cosV159Ccss")) return;
    var C = SHELF_CYCLE_V159C + "s", L = [];
    /* the glint (::before, one sweep per cycle, phase-locked to the wall clock through --s159p) */
    L.push(".s159c{position:relative;overflow:hidden;isolation:isolate}");
    L.push(".s159c::before{content:'';position:absolute;inset:-10% auto -10% 0;width:34%;z-index:3;pointer-events:none;background:linear-gradient(100deg,transparent 0,rgba(255,255,255,0) 20%,rgba(255,250,230,.55) 48%,rgba(255,255,255,.85) 50%,rgba(255,250,230,.5) 52%,rgba(255,255,255,0) 80%,transparent);mix-blend-mode:screen;transform:translateX(-120%) skewX(-18deg);animation:s159cGlint " + C + " cubic-bezier(.45,.05,.3,1) infinite;animation-delay:var(--s159p,0s)}");
    L.push("@keyframes s159cGlint{0%,62%{transform:translateX(-120%) skewX(-18deg)}88%,100%{transform:translateX(420%) skewX(-18deg)}}");
    /* the trophies: bob, turn, tilt; a sparkle as the glint passes each */
    L.push(".s159c em{display:inline-block;position:relative;transform-origin:50% 90%;will-change:transform}");
    L.push(".s159c em[data-k=cup]{animation:s159cBob 3.4s ease-in-out infinite;animation-delay:calc(var(--i,0)*-.7s)}");
    L.push(".s159c em[data-k=ring]{animation:s159cTurn 4.2s ease-in-out infinite;animation-delay:calc(var(--i,0)*-.5s)}");
    L.push(".s159c em[data-k=star]{animation:s159cTilt 3.8s ease-in-out infinite;animation-delay:calc(var(--i,0)*-.9s)}");
    L.push(".s159c em[data-k=hall]{animation:s159cBob 5s ease-in-out infinite;animation-delay:-1.3s}");
    L.push("@keyframes s159cBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}");
    L.push("@keyframes s159cTurn{0%,100%{transform:translateY(0) scaleX(1)}25%{transform:translateY(-1.5px) scaleX(.7)}50%{transform:translateY(-2px) scaleX(-.9)}75%{transform:translateY(-1px) scaleX(.72)}}");
    L.push("@keyframes s159cTilt{0%,100%{transform:rotate(-7deg) translateY(0)}50%{transform:rotate(7deg) translateY(-1.5px)}}");
    L.push(".s159c em::after{content:'';position:absolute;right:-3px;top:-2px;width:9px;height:9px;pointer-events:none;background:radial-gradient(circle,#fff 0 1px,rgba(255,255,255,.7) 1.4px,transparent 2.6px),linear-gradient(0deg,transparent 42%,rgba(255,255,255,.95) 50%,transparent 58%),linear-gradient(90deg,transparent 42%,rgba(255,255,255,.95) 50%,transparent 58%);opacity:0;transform:scale(.2) rotate(0);animation:s159cSpark " + C + " ease-out infinite;animation-delay:calc(var(--s159p,0s) + var(--i,0)*.34s)}");
    L.push("@keyframes s159cSpark{0%,70%{opacity:0;transform:scale(.2) rotate(0)}75%{opacity:1;transform:scale(1.15) rotate(45deg)}84%,100%{opacity:0;transform:scale(.3) rotate(90deg)}}");
    /* the materials (::after under the trophies) */
    var M = {
      glass: "background:linear-gradient(115deg,transparent 0 18%,rgba(255,255,255,.22) 18% 24%,transparent 24% 58%,rgba(255,255,255,.12) 58% 61%,transparent 61%);animation:s159cDrift 9s ease-in-out infinite alternate",
      ice158: "background:linear-gradient(115deg,transparent 0 20%,rgba(255,255,255,.25) 20% 25%,transparent 25%),radial-gradient(circle,rgba(255,255,255,.9) 0 .8px,transparent 1.4px) 0 0/19px 13px;animation:s159cTwinkle 2.8s ease-in-out infinite,s159cDrift 11s ease-in-out infinite alternate",
      diamond158: "background:radial-gradient(circle,#fff 0 .9px,transparent 1.6px) 3px 2px/23px 15px,radial-gradient(circle,#bfefff 0 .8px,transparent 1.5px) 11px 8px/29px 17px;animation:s159cTwinkle 1.7s steps(4) infinite",
      neon158: "background:linear-gradient(0deg,#ff3df2 0 2px,transparent 2px);box-shadow:0 0 10px #ff3df2;animation:s159cFlicker 4.6s linear infinite",
      velvet158: "background:radial-gradient(ellipse 40% 90% at 50% 0,rgba(255,220,230,.28),transparent 70%) 0 0/200% 100% no-repeat;animation:s159cSheen 6.5s ease-in-out infinite alternate",
      holo158: "background:repeating-linear-gradient(0deg,rgba(157,255,244,.16) 0 1px,transparent 1px 3px);animation:s159cScan 1.8s linear infinite;mix-blend-mode:screen",
      galaxy158: "background:radial-gradient(circle,#fff 0 .7px,transparent 1.2px) 0 0/15px 11px,radial-gradient(circle,#ffb8e6 0 .6px,transparent 1.1px) 7px 5px/21px 14px;animation:s159cStars 24s linear infinite",
      carbon158: "background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.1) 45%,transparent 60%) 0 0/250% 100%;animation:s159cSheen 5s linear infinite",
      steel: "background:repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,transparent 1px 3px),linear-gradient(110deg,transparent 35%,rgba(255,255,255,.14) 50%,transparent 65%) 0 0/250% 100%;animation:s159cSheen 7s ease-in-out infinite alternate",
      marble: "background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.3) 50%,transparent 65%) 0 0/250% 100%;animation:s159cSheen 8s ease-in-out infinite alternate",
      stone158: "background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.12) 50%,transparent 65%) 0 0/250% 100%;animation:s159cSheen 9s ease-in-out infinite alternate",
      gold: "background:linear-gradient(110deg,transparent 38%,rgba(255,236,170,.3) 50%,transparent 62%) 0 0/250% 100%;animation:s159cSheen 4.5s ease-in-out infinite alternate",
      walnut158: "background:linear-gradient(0deg,rgba(255,215,111,.0) 0,rgba(255,215,111,0) 100%),linear-gradient(110deg,transparent 40%,rgba(255,215,111,.22) 50%,transparent 60%) 0 0/250% 100%;animation:s159cSheen 5.5s ease-in-out infinite alternate",
      founder: "background:linear-gradient(110deg,transparent 40%,rgba(230,196,106,.28) 50%,transparent 60%) 0 0/250% 100%;animation:s159cSheen 4s ease-in-out infinite alternate",
      oak: "background:radial-gradient(ellipse 50% 120% at 50% -20%,rgba(255,214,150,.2),transparent 70%);animation:s159cLamp 6s ease-in-out infinite alternate",
      locker158: "background:radial-gradient(ellipse 50% 120% at 50% -20%,rgba(220,235,255,.18),transparent 70%);animation:s159cLamp 5s ease-in-out infinite alternate"
    };
    L.push(".s159c::after{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;border-radius:inherit}.s159c>span{position:relative;z-index:1}");
    Object.keys(M).forEach(function (k) { L.push(".s159c.sh-" + k + "::after{" + M[k] + "}"); });
    L.push("@keyframes s159cDrift{from{transform:translateX(-8%)}to{transform:translateX(8%)}}");
    L.push("@keyframes s159cTwinkle{0%,100%{opacity:.45}50%{opacity:1}}");
    L.push("@keyframes s159cFlicker{0%,100%{opacity:1}6%{opacity:.35}7%{opacity:1}8%{opacity:.5}9%,61%{opacity:1}62%{opacity:.4}64%{opacity:1}}");
    L.push("@keyframes s159cSheen{from{background-position:0 0}to{background-position:100% 0}}");
    L.push("@keyframes s159cScan{from{background-position:0 0}to{background-position:0 6px}}");
    L.push("@keyframes s159cStars{from{background-position:0 0,7px 5px}to{background-position:-150px 0,-203px 5px}}");
    L.push("@keyframes s159cLamp{from{opacity:.55}to{opacity:1}}");
    /* a trophy that is new since his card was last shown: a pop, a ring of light, a shine */
    L.push(".s159c>span.pop159c em{animation:s159cPop 1.1s cubic-bezier(.2,1.6,.4,1) 1 both!important}");
    L.push(".s159c>span.pop159c::before{content:'';position:absolute;left:50%;top:12px;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;pointer-events:none;background:radial-gradient(circle,rgba(255,244,200,.95) 0 18%,rgba(255,215,111,.55) 34%,transparent 62%);animation:s159cBurst 1.1s ease-out 1 both;z-index:-1}");
    L.push(".s159c>span.pop159c b{animation:s159cNum 1.1s ease-out 1 both}");
    L.push("@keyframes s159cPop{0%{transform:scale(1)}30%{transform:scale(1.55) rotate(-8deg)}55%{transform:scale(.92) rotate(4deg)}100%{transform:scale(1) rotate(0)}}");
    L.push("@keyframes s159cBurst{0%{transform:scale(.2);opacity:0}25%{opacity:1}100%{transform:scale(2.3);opacity:0}}");
    L.push("@keyframes s159cNum{0%,100%{color:inherit;text-shadow:none}30%{color:#fff3c4;text-shadow:0 0 8px #ffd76f}}");
    L.push(".cos-cel-v159c{width:64px;height:60px;display:block}");
    L.push("@media(prefers-reduced-motion:reduce){.s159c::before,.s159c::after,.s159c em,.s159c em::after,.s159c>span.pop159c::before,.s159c>span.pop159c b{animation:none!important}.s159c::before,.s159c em::after{opacity:0}}");
    var st = document.createElement("style"); st.id = "cosV159Ccss"; st.textContent = L.join("\n");
    (document.head || document.documentElement).appendChild(st);
  })();

  /* what the check reads */
  Object.assign(V159C, {
    kinds: function () { return Object.keys(KINDS_V159C); },
    timeline: function (calm) { var T = tlV159C(calm); return { a: T.a, b: T.b, l: T.l, end: T.end }; },
    plan: function (id, seed, calm) { var it = findItem(id); if (!it || it.cat !== "celebration") return null; var S = planV159C(it, seed == null ? strHashV159C(id) : seed, !!calm);
      return { id: id, kind: S.kind, parts: S.parts.length, cap: S.cap, dropped: S.dropped, say: S.say, T: { a: S.T.a, b: S.T.b, l: S.T.l, end: S.T.end }, pose: S.K.pose || "jump" }; },
    /* one frame of item `id` at t into a 2D canvas (the Locker's painter); returns the live particle count */
    renderAt: function (cv, id, t, seed, calm) { var it = findItem(id); if (!it || it.cat !== "celebration") return -1; if (!cv.__w) sizeCvV158A(cv, cv.width, cv.height);
      var rec = { cv: cv, S: planV159C(it, seed == null ? strHashV159C(id) : seed, !!calm) }; var live = 0;
      var x = cv.getContext("2d"), W = cv.__w, H = cv.__h, dpr = cv.__dpr || 1; x.setTransform(dpr, 0, 0, dpr, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; x.clearRect(0, 0, W, H);
      var u = W / 330, V = viewV159C(canvasPainterV159C(x), W / 2, H * 0.68, u, Math.max(0.5, u)); V.hy = rec.S.hy; live = drawV159C(rec.S, V, t); x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; return live; },
    pose: function (id, t, calm) { var it = findItem(id); return it ? poseV159C(planV159C(it, 1, !!calm), t) : null; },
    letter: function (id, i, t, calm) { var it = findItem(id); return it ? letterPoseV159C(planV159C(it, 1, !!calm), i, 8, t) : null; },
    play: function (scene, x, y, cm, id, opts) { var it = findItem(id); if (!it || it.cat !== "celebration") return null; return fieldPlayV159C(scene, x, y, cm, it, opts).run; },
    previewList: function () { return PV_V159C.list.map(function (r) { return { id: r.it.id, frames: r.frames, t: Math.round(r.t), loops: r.loops, connected: r.cv.isConnected }; }); },
    shelf: shelfV159C
  });

  /* ===== v159 A THE WHOLE TEAM WEARS IT =====
   * The owner: "make those [uniforms] apply to all the players on your team, along with the helmets" · "make all the
   * uniforms apply and be usable with the 2 colour palettes" · "ensure the number fonts blend properly into the jersey".
   *   THE TEAM     src/05 `ribTeamKitV159A` dresses the "off" textures (his eleven on both sides of the ball, and our
   *                sideline's backups) with `fieldKit` — the same kit, deco and clash rule he wore alone since v151 B; the
   *                "you" textures become a pixel copy of them. The opponent's "def" textures are never touched.
   *   TEAM PALETTE a per-player choice next to the uniforms in the Locker's Style panel — "Colours: Uniform's own · Team
   *                palette" — stored in the cosmetics store (`uniColV159A`, outside the save). In "Team palette" every
   *                uniform keeps its DESIGN (hoops, pinstripe, split, fade, yoke, chest band, sleeves, camo, chevrons, sash,
   *                stripes, checker, tiger…) and takes the team's two colours: jersey = primary, pants = secondary, the
   *                pattern's trim and the pant stripe = the secondary (or, when the two would blur, a shade of the primary —
   *                `uniModeV159A`, hooked at `resolveU`, the one door every kit reader goes through: the field, the card
   *                figure, the growth screen, the live badge, the menu hero and the Locker's previews).
   *   PRINTED NUMBERS  the profile figure's chest number (`chestNumberV157C` → `chestNumV159A`) is drawn on its own layer,
   *                wrapped round the chest (a cylinder the chest's width, `v159AcurveR`, the sides sagging and narrowing),
   *                clipped to the jersey's own pixels (the source art's torso, drawn where the body went — never an arm,
   *                the helmet or the pants; soft at the mask's edge), then the jersey's shading is multiplied into it (the
   *                source's lightness over its median: folds darken the digits, highlights lift them) and the drawn fold
   *                lines soften its alpha. It scales with the body at every age (the figure's own geometry). The team face
   *                picks its colours from the kit (`inkForV159A`: white on a dark jersey, the kit's own dark — or ink — on a
   *                light one, the outline a shadow of the jersey); a number font keeps its colours and takes the shading.
   *                On the field (every man's number: src/05 `numPlaceV104` → `numInkV159A`) the number already rides the
   *                chest/back band per frame and hides on a side view; now it takes the kit's contrast colour, a jersey-
   *                shadow outline instead of a black sticker edge, lets the fabric show through (TU v159AnumA), and turns
   *                with a quarter view (squeezed, shifted toward the side of the shirt the camera sees). The Locker's number
   *                preview gets the same ink and a fabric shade.
   * Kill switches: TU v159Ateam (src/05: his textures only), v159Apal (the Locker choice and the palette mapping),
   * v159Anum (the old sticker numbers). Looks only: nothing here reads or writes a number the sim uses or draws Math.random.
   * `window.__V159A` is what v159Acheck reads. */
  var V159A = (window.__V159A = window.__V159A || { chest: null, prints: 0, inks: 0, toggles: 0, errs: [] });
  function errV159A(e) { try { if (V159A.errs.length < 10) V159A.errs.push(String((e && e.message) || e)); } catch (x) {} }
  function onV159A(k) { return !!TUv(k, 1); }
  function hexOfV159A(c) { return "#" + c.map(function (v) { var s = Math.max(0, Math.min(255, Math.round(v))).toString(16); return s.length < 2 ? "0" + s : s; }).join(""); }
  function lumHexV159A(h) { return lumOf(rgb(hexOk(h) || "#000000")); }

  /* ---- 2. the uniform's colours: its own, or the team's two ---- */
  function uniColV159A() { try { return onV159A("v159Apal") && load().uniColV159A === "team" ? "team" : "own"; } catch (e) { return "own"; } }
  function setUniColV159A(mode) {
    mode = mode === "team" ? "team" : "own";
    var S = load(); if ((S.uniColV159A === "team" ? "team" : "own") === mode) return false;
    S.uniColV159A = mode; persist(); V159A.toggles++;
    fire({ equip: "uniform", id: equipped("uniform"), colours: mode });   // the field re-dresses (apply → refreshField), the card redraws
    return true;
  }
  function uniModeV159A(U, tc) {
    if (!U || uniColV159A() !== "team") return U;
    var a = (tc && hexOk(tc[0])) || teamCol(0), b = (tc && hexOk(tc[1])) || teamCol(1);
    var o = Object.assign({}, U); o.j = a; o.p = b;
    // the pattern's trim: the secondary — unless it would vanish on the primary, then a shade of the primary
    o.t = cdist(a, b) >= TUv("v159AtrimDist", 90) ? b : hexOfV159A(mix(rgb(a), lumHexV159A(a) > 128 ? [0, 0, 0] : [255, 255, 255], 0.45));
    if (U.ps) o.ps = o.t;
    o.v159 = "team";
    return o;
  }
  function uniColRowV159A() {
    if (!onV159A("v159Apal")) return "";
    var m = uniColV159A(), c0 = teamCol(0), c1 = teamCol(1);
    return '<div class="cos-unicol-v159a" role="group" aria-label="Uniform colours" data-mode="' + m + '"><span>Colours</span>' +
      '<button type="button" class="' + (m === "own" ? "on" : "") + '" aria-pressed="' + (m === "own") + '" onclick="cosUniColV159A(\'own\')">Uniform\'s own</button>' +
      '<button type="button" class="' + (m === "team" ? "on" : "") + '" aria-pressed="' + (m === "team") + '" onclick="cosUniColV159A(\'team\')"><i style="background:' + c0 + '"></i><i style="background:' + c1 + '"></i>Team palette</button></div>';
  }
  window.cosUniColV159A = function (mode) {
    var changed = setUniColV159A(mode);
    var el = document.querySelector(".cos-style-v151b"); if (el) { el.outerHTML = stylePanel(); paintPreviews(); }
    if (changed) toast(mode === "team" ? "Uniforms wear the team palette" : "Uniforms wear their own colours");
    return uniColV159A();
  };
  (function () {
    if (document.getElementById("cosV159Acss")) return;
    var st = document.createElement("style"); st.id = "cosV159Acss";
    st.textContent = ".cos-unicol-v159a{display:flex;align-items:center;gap:6px;margin:2px 0 8px;flex-wrap:wrap;font:600 11px/1 Oswald,sans-serif;letter-spacing:.6px}" +
      ".cos-unicol-v159a>span{color:#9fb0c6;text-transform:uppercase;margin-right:2px}" +
      ".cos-unicol-v159a>button{display:inline-flex;align-items:center;gap:4px;min-height:36px;padding:8px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.05);color:#dfe7f2;font:inherit;cursor:pointer}" +
      ".cos-unicol-v159a>button.on{background:#f0bb45;border-color:#f0bb45;color:#1b1406}" +
      ".cos-unicol-v159a>button>i{display:inline-block;width:10px;height:10px;border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.45)}";
    (document.head || document.documentElement).appendChild(st);
  })();

  /* ---- 3. the ink: a number that reads on its kit ---- */
  function inkForV159A(j, alt, trim) {
    j = hexOk(j) || "#1f4fd0";
    var Lj = lumHexV159A(j), light = Lj > TUv("v159AinkLum", 168), fill;
    if (!light) fill = "#ffffff";
    else { var c = [trim, alt].filter(function (h) { return hexOk(h) && Lj - lumHexV159A(h) > TUv("v159AinkGap", 105); }); fill = c[0] || "#141a24"; }
    var stroke = light ? hexOfV159A(mix(rgb(j), rgb(fill), 0.4)) : hexOfV159A(mix(rgb(j), [0, 0, 0], TUv("v159AinkShadow", 0.62)));
    return { fill: fill, stroke: stroke, light: light };
  }
  /* the field: every man's number (src/05 numPlaceV104, after it has placed and scaled the label for this frame) */
  function numInkV159A(m, rear, cols) {
    try {
      var L = m && m.label; if (!L) return;
      if (!onV159A("v159Anum")) {   // the switch off: the v104 sticker exactly (white, the ink outline, opaque, centred)
        if (m._inkKeyV159A != null) { m._inkKeyV159A = null; if (!m._nfOrigV153G) { L.setColor("#ffffff"); L.setStroke("#0a0e14", L.style.strokeThickness || 2.2); } }
        if (!m._nfLblV158A && L.alpha !== 0 && L.alpha !== 1) L.setAlpha(1);
        if (L.x !== 0) L.x = 0; m._quarterV159A = 1; return;
      }
      if (!m._nfOrigV153G && cols && cols[0]) {   // an equipped number font keeps its own colours (v153 G)
        var key = cols[0] + "|" + cols[1];
        if (m._inkKeyV159A !== key) {
          m._inkKeyV159A = key; var ink = inkForV159A(cols[0], cols[1], null);
          if (L.style.color !== ink.fill) L.setColor(ink.fill);
          L.setStroke(ink.stroke, L.style.strokeThickness || 2.2); V159A.inks++;
        }
      }
      var A = TUv("v159AnumA", 0.9);   // the fabric shows through the print
      if (!m._nfLblV158A && L.alpha !== 0 && Math.abs(L.alpha - A) > 1e-3) L.setAlpha(A);
      var q = m.dirKey === "dr" || m.dirKey === "ur" ? TUv("v159Aquarter", 0.8) : 1;
      m._quarterV159A = q;
      if (q !== 1) {
        // a quarter view: the shirt turns — narrower, and its middle slides toward the side the camera sees
        var b = m._numBandV104, Hs = (m.body && m.body.scaleY) || 1, side = (m.dirKey === "dr" ? 1 : -1) * (m.flip ? -1 : 1);
        L.scaleX = L.scaleX * q; L.x = side * (b ? b.w : 22) * TUv("v159AquarterDx", 0.07) * Hs;
      } else if (L.x !== 0) L.x = 0;
    } catch (e) { errV159A(e); }
  }

  /* ---- 3. the profile chest: printed, not stuck on ---- */
  var BUSY_V159A = 0, MAPS_V159A = null;
  /* the source art's torso — the jersey's own pixels between the neck and the waist, the helmet's dome cut out — with
   * each pixel's shade (lightness over the navy's median, x100) in its red channel: kit-independent, measured once */
  function mapsV159A() {
    if (MAPS_V159A) return MAPS_V159A;
    var im = FIG.img, C = chestV157C(); if (!im || !C) return null;
    var W = C.W, H = C.H, c = document.createElement("canvas"); c.width = W; c.height = H;
    var x = c.getContext("2d"); x.drawImage(im, 0, 0); var d = x.getImageData(0, 0, W, H).data;
    var mc = document.createElement("canvas"); mc.width = W; mc.height = H; var mx = mc.getContext("2d"), md = mx.createImageData(W, H), o = md.data;
    var hx0 = W * 0.515, hy0 = H * 0.15, hrx = W * 0.29, hry = H * 0.14, n = 0;
    for (var y = C.neck; y < C.waist; y++) for (var xx = 0; xx < W; xx++) {
      var i = (y * W + xx) * 4; if (d[i + 3] < 20) continue;
      var k = srcClass(d[i], d[i + 1], d[i + 2]); if (k[0] !== 1) continue;
      var ex = (xx - hx0) / hrx, ey = (y - hy0) / hry; if (ex * ex + ey * ey <= 1) continue;
      o[i] = o[i + 1] = o[i + 2] = Math.max(1, Math.min(255, Math.round(k[1] / 32.5 * 100))); o[i + 3] = 255; n++;
    }
    mx.putImageData(md, 0, 0);
    MAPS_V159A = { cv: mc, W: W, H: H, neck: C.neck, waist: C.waist, n: n, last: null };
    return MAPS_V159A;
  }
  /* that map drawn exactly where figDraw drew the body: RGBA at the canvas's device size */
  function maskOutV159A(res, W, H) {
    var M = mapsV159A(), g = res && res.geo; if (!M || !g) return null;
    var key = [W, H, g.bx, g.by, g.bw, g.bh, g.dpr].join("|");
    if (M.last && M.last.key === key) return M.last;
    var c = document.createElement("canvas"); c.width = W; c.height = H; var x = c.getContext("2d");
    x.setTransform(g.dpr || 1, 0, 0, g.dpr || 1, 0, 0); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
    x.drawImage(M.cv, 0, M.neck, M.W, M.H - 3 - M.neck, g.bx, g.by, g.bw, g.bh);
    M.last = { key: key, d: x.getImageData(0, 0, W, H).data, W: W, H: H };
    return M.last;
  }
  /* the team face in the kit's own contrast (the v157 C text, with inkForV159A's colours) */
  function textNumV159A(cv, res, num, nf, C, K) {
    var g = res.geo, x = cv.getContext("2d"), s = String(num | 0);
    var sx = g.bw / C.W, cx = g.bx + C.cx * sx, cy = g.by + (C.row - g.neck) * g.k;
    var px = Math.max(8, (C.waist - C.neck) * g.k * TUv("nfChestHV157C", 0.58));
    var ink = nf.style === "team" ? inkForV159A(K && K.j, K && K.p, K && K.t) : { fill: nf.col || "#ffffff", stroke: nf.stroke || "#0a0e14" };
    x.save(); x.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    x.font = "bold " + px.toFixed(1) + "px " + nf.font; x.textAlign = "center"; x.textBaseline = "middle";
    var w = x.measureText(s).width, maxW = C.w * sx * TUv("nfChestWV157C", 0.92);
    if (w > maxW) { px = px * maxW / w; x.font = "bold " + px.toFixed(1) + "px " + nf.font; }
    x.lineJoin = "round"; x.lineWidth = Math.max(1.4, px * TUv("nfChestStrokeV157C", 0.2)); x.strokeStyle = ink.stroke; x.strokeText(s, cx, cy);
    x.fillStyle = ink.fill; x.fillText(s, cx, cy);
    x.restore();
    return { num: s, nf: nf.style, px: +px.toFixed(1), cx: +cx.toFixed(1), cy: +cy.toFixed(1), ink: ink.fill };
  }
  /* the layer printed onto the figure: wrapped, clipped, shaded */
  function printV159A(cv, lay, res, C) {
    var W = cv.width, H = cv.height, g = res.geo, dpr = g.dpr || 1;
    var ld = lay.getContext("2d").getImageData(0, 0, W, H).data, x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (ld[(y * W + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    var M = maskOutV159A(res, W, H); if (!M) return null;
    var sxk = g.bw / C.W, cxD = (g.bx + C.cx * sxk) * dpr, cyD = (g.by + (C.row - g.neck) * g.k) * dpr;
    // 1. round the chest: each target column samples the flat print at its arc length (a cylinder of the chest's width)
    var R = Math.max(4, C.w * sxk * dpr * 0.5 * TUv("v159AcurveR", 1.25)), sag = TUv("v159Asag", 0.1), shrink = TUv("v159Ashrink", 0.08);
    var wv = document.createElement("canvas"); wv.width = W; wv.height = H; var wx = wv.getContext("2d"); wx.imageSmoothingEnabled = true;
    for (var X = x0 - 1; X <= x1 + 1; X++) {
      var u = (X + 0.5 - cxD) / R; if (Math.abs(u) >= 0.985) continue;
      var th = Math.asin(u), srcX = cxD + th * R - 0.5; if (srcX < x0 - 1 || srcX > x1 + 1) continue;
      var cz = 1 - Math.cos(th), hs = 1 - shrink * cz, dy = sag * R * cz;
      wx.drawImage(lay, Math.max(0, srcX), 0, 1, H, X, cyD * (1 - hs) + dy, 1, H * hs);
    }
    // 2. the fabric: clipped to the jersey, its shading multiplied in, the fold lines softening the edge
    var bx0 = Math.max(1, x0 - 6), bx1 = Math.min(W - 2, x1 + 6), by0 = Math.max(1, y0 - 6), by1 = Math.min(H - 2, y1 + Math.ceil(sag * R) + 6);
    var wd = wx.getImageData(0, 0, W, H), d = wd.data, md = M.d;
    var base = TUv("v159Ashade0", 0.4), gain = 1 - base, foldK = TUv("v159Afold", 0.9), foldMax = TUv("v159AfoldMax", 0.45), alphaK = TUv("v159Aink", 0.97);
    var tAt = function (j) { return md[j * 4 + 3] > 8 ? md[j * 4] / 100 : 1; }, kept = 0, cut = 0;
    for (y = by0; y <= by1; y++) for (x = bx0; x <= bx1; x++) {
      var j = y * W + x, i = j * 4; if (!d[i + 3]) continue;
      var cov = md[i + 3] / 255; if (cov < 0.04) { d[i + 3] = 0; cut++; continue; }
      var t = md[i] / 100, fold = Math.min(foldMax, (Math.abs(tAt(j + 1) - tAt(j - 1)) + Math.abs(tAt(j + W) - tAt(j - W))) * foldK * 0.5);
      var mlt = Math.max(0.3, Math.min(1.35, base + gain * t));
      if (mlt <= 1) { d[i] *= mlt; d[i + 1] *= mlt; d[i + 2] *= mlt; }
      else { var h = (mlt - 1) * 0.6; d[i] += (255 - d[i]) * h; d[i + 1] += (255 - d[i + 1]) * h; d[i + 2] += (255 - d[i + 2]) * h; }
      d[i + 3] = d[i + 3] * cov * (1 - fold) * alphaK; kept++;
    }
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if ((y < by0 || y > by1 || x < bx0 || x > bx1) && d[(y * W + x) * 4 + 3]) d[(y * W + x) * 4 + 3] = 0;
    wx.putImageData(wd, 0, 0);
    var cx2 = cv.getContext("2d"); cx2.save(); cx2.setTransform(1, 0, 0, 1, 0, 0); cx2.drawImage(wv, 0, 0); cx2.restore();
    V159A.prints++;
    return { box: [x0, y0, x1, y1], kept: kept, cut: cut, R: +R.toFixed(1) };
  }
  function chestNumV159A(cv, res, num, nfId, C) {
    if (BUSY_V159A || !onV159A("v159Anum") || !cv || !cv.getContext) return null;
    try {
      var nf = nfOfV157C(nfId), style = nfFaceOfV158A(nf), lay = document.createElement("canvas"), r = null;
      lay.width = cv.width; lay.height = cv.height;
      BUSY_V159A = 1;
      try { r = style ? chestNumV158A(lay, res, num, nfId, C) : textNumV159A(lay, res, num, nf, C, FIG.last); } finally { BUSY_V159A = 0; }
      if (!r) return null;
      var P = printV159A(cv, lay, res, C); if (!P) return null;
      r.v159 = true; r.print = P;
      V159A.chest = { num: r.num, nf: r.nf, ink: r.ink || null, box: P.box, kept: P.kept, cut: P.cut, R: P.R };
      return r;
    } catch (e) { errV159A(e); BUSY_V159A = 0; return null; }
  }
  /* the Locker's number preview: the team face in the kit's contrast, and the jersey's roll of light over both */
  function inkNfV159A(tc) { var k = inkForV159A(tc && tc[0], tc && tc[1], null); return { font: "Oswald, sans-serif", col: k.fill, stroke: k.stroke }; }
  function previewPrintV159A(x) {
    if (!onV159A("v159Anum")) return;
    try {
      var g = x.createLinearGradient(14, 0, 50, 0);
      g.addColorStop(0, "rgba(0,0,0,.38)"); g.addColorStop(0.3, "rgba(0,0,0,.04)"); g.addColorStop(0.55, "rgba(255,255,255,.1)"); g.addColorStop(1, "rgba(0,0,0,.42)");
      x.save(); x.globalCompositeOperation = "source-atop"; x.fillStyle = g; x.fillRect(0, 0, 64, 64); x.restore();
    } catch (e) { errV159A(e); }
  }
  Object.assign(V159A, {
    uniColour: uniColV159A, setUniColour: setUniColV159A, uniMode: uniModeV159A, ink: inkForV159A, numInk: numInkV159A,
    maps: mapsV159A, jerseyMask: function (res, W, H) { var M = maskOutV159A(res, W, H); return M ? M.d : null; }, row: uniColRowV159A
  });

  /* ===== v160 A THE TEAM ON THE HELMET =====
   * The owner: "Add the team's logo on the side of the helmet for the profile character." The card's figure (and so
   * the growth screen and the live badge, which draw the same figure) wears his team's emblem (`__GRIDIRON_TEAM_CUSTOM__
   * .logo`, the v44 sheet `RIB.logoImg` / `TEAM_LOGOS_V44`) on the side of the helmet the viewer sees — the dome's side
   * away from the stripe, where v158 A puts a helmet's decal. It is painted INTO the shell: only shell pixels take it,
   * squeezed across the curve of the dome, shaded by the shell's own light, with a thin dark keyline so it reads at card
   * size. A helmet with its own decal keeps its decal. The figure's cache key carries the logo (and whether the sheet has
   * decoded), so the figure redraws once the emblem is in. Kill switch TU("v160Alogo", 0). `window.__V160A`. */
  var V160A = (window.__V160A = window.__V160A || { paints: 0, last: null, errs: [] });
  function helmLogoIdxV160A() {
    try { var tc = window.__GRIDIRON_TEAM_CUSTOM__; var i = tc && tc.logo; return i == null || isNaN(+i) ? null : ((+i % 90) + 90) % 90; } catch (e) { return null; }
  }
  // the v44 emblem sheet, decoded here once (the field renderer keeps its own copy); on arrival the figure cache is
  // dropped and a screen that shows the figure redraws, so the helmet picks the emblem up
  var LOGO_IMG_V160A = null, LOGO_TRY_V160A = 0;
  function helmLogoImgV160A() {
    if (LOGO_IMG_V160A && LOGO_IMG_V160A.naturalWidth) return LOGO_IMG_V160A;
    if (!LOGO_TRY_V160A && typeof Image !== "undefined") {
      LOGO_TRY_V160A = 1;
      try {
        var im = new Image(), T = window.TEAM_LOGOS_V44;
        im.onload = function () {
          LOGO_IMG_V160A = im; FIG.cache = {};
          try { var v = window.S && window.S.view; if (window.go && /^(profile|locker|hub|menu)$/.test(v || "")) window.go(v); } catch (e) {}
        };
        im.onerror = function () { LOGO_TRY_V160A = 0; };
        im.src = (T && T.url) || window.__RIB_LOGOS_V44 || "/rib_logos_v44.png";
      } catch (e) { LOGO_TRY_V160A = 0; }
    }
    return null;
  }
  function helmLogoV160A(K) { return !!TUv("v160Alogo", 1) && !(K && K.hd) && helmLogoIdxV160A() != null && !!helmLogoImgV160A(); }
  function helmLogoKeyV160A(K) { return helmLogoV160A(K) ? "L" + helmLogoIdxV160A() : "L-"; }
  function helmLogoPaintV160A(d, src, W, H, K, geo) {
    try {
      var li = helmLogoIdxV160A(), im = helmLogoImgV160A(); if (li == null || !im) return;
      var N = W * H, shell = new Uint8Array(N), tone = new Float32Array(N), x, y, j, sn = 0, sx = 0;
      for (y = 0; y < geo.neck; y++) for (x = 0; x < W; x++) {
        j = y * W + x; var i = j * 4; if (src[i + 3] < 20) continue;
        var ex = (x - geo.hx0) / geo.hrx, ey = (y - geo.hy0) / geo.hry; if (ex * ex + ey * ey > 1) continue;
        var c = srcClass(src[i], src[i + 1], src[i + 2]);
        if (c[0] === 1) { shell[j] = 1; tone[j] = c[1]; }
        else if (c[0] === 2 && y < geo.visor) { sn++; sx += x; }   // the stripe
      }
      // the side the viewer sees: the larger run of shell on either side of the stripe, in the dome's middle band
      var mid = sn ? sx / sn : geo.hx0, L = [], R = [];
      for (y = Math.round(geo.hy0 - geo.hry * 0.35); y <= Math.round(geo.hy0 + geo.hry * 0.35); y++) for (x = 0; x < W; x++) {
        j = y * W + x; if (!shell[j]) continue; (x < mid ? L : R).push(x, y);
      }
      var side = L.length >= R.length ? L : R, n = side.length / 2; if (n < 12) return;
      var cx = 0, cy = 0, x0 = 1e9, x1 = -1e9; for (var k = 0; k < side.length; k += 2) { cx += side[k]; cy += side[k + 1]; x0 = Math.min(x0, side[k]); x1 = Math.max(x1, side[k]); }
      cx /= n; cy /= n;
      var span = Math.max(4, x1 - x0), size = Math.max(8, Math.min(span * 1.05, geo.hry * 1.15) * TUv("v160AlogoK", 1)), sq = TUv("v160AlogoSquash", 0.78);
      var lw = Math.max(6, Math.round(size * sq)), lh = Math.max(6, Math.round(size));
      // the emblem cell, scaled once to the stamp's size
      var cv = document.createElement("canvas"); cv.width = lw; cv.height = lh;
      var lx = cv.getContext("2d"); lx.imageSmoothingEnabled = true; lx.imageSmoothingQuality = "high";
      var CELL = 128, COLS = 10, sw0 = im.naturalWidth / COLS, sh0 = im.naturalHeight / 9;
      lx.drawImage(im, (li % COLS) * sw0, Math.floor(li / COLS) * sh0, sw0, sh0, 0, 0, lw, lh);
      var ld = lx.getImageData(0, 0, lw, lh).data;
      // the shell's median light, so the emblem takes the dome's shading around it
      var ts = []; for (k = 0; k < side.length; k += 2) ts.push(tone[side[k + 1] * W + side[k]]); ts.sort(function (a, b) { return a - b; });
      var tMed = ts[ts.length >> 1] || 1, ox = Math.round(cx - lw / 2), oy = Math.round(cy - lh / 2), painted = 0;
      for (var ly = 0; ly < lh; ly++) for (var lxp = 0; lxp < lw; lxp++) {
        x = ox + lxp; y = oy + ly; if (x < 0 || y < 0 || x >= W || y >= H) continue;
        j = y * W + x; if (!shell[j]) continue;
        var li4 = (ly * lw + lxp) * 4, a = ld[li4 + 3] / 255; if (a < 0.08) continue;
        var sh = Math.max(0.62, Math.min(1.25, 0.35 + 0.65 * tone[j] / tMed)), ii = j * 4;
        // a thin keyline: an emblem pixel on the edge of the emblem darkens
        var edge = 0; for (var q = 0; q < 4; q++) { var qx = lxp + [1, -1, 0, 0][q], qy = ly + [0, 0, 1, -1][q];
          if (qx < 0 || qy < 0 || qx >= lw || qy >= lh || ld[(qy * lw + qx) * 4 + 3] < 20) edge++; }
        var r = ld[li4] * sh, g = ld[li4 + 1] * sh, b = ld[li4 + 2] * sh; if (edge) { r *= 0.45; g *= 0.45; b *= 0.45; }
        a = Math.min(1, a * TUv("v160AlogoAlpha", 0.95));
        d[ii] = Math.round(d[ii] * (1 - a) + Math.min(255, r) * a); d[ii + 1] = Math.round(d[ii + 1] * (1 - a) + Math.min(255, g) * a); d[ii + 2] = Math.round(d[ii + 2] * (1 - a) + Math.min(255, b) * a);
        painted++;
      }
      V160A.paints++; V160A.last = { logo: li, cx: +cx.toFixed(1), cy: +cy.toFixed(1), w: lw, h: lh, px: painted, side: side === L ? "left" : "right" };
    } catch (e) { if (V160A.errs.length < 6) V160A.errs.push(String(e && e.message || e)); }
  }
  if (TUv("v160Alogo", 1)) helmLogoImgV160A();   // start the decode now, so the first card usually has it

  /* ===== v161 A THEY CELEBRATE LIKE THEY MEAN IT =====
   * The owner: "I uploaded new celebration artwork, can you implement this as 3 separate celebrations chosen at random and
   * ensure the motions make sense and are visually appealing? For example the backflipping in the air, the ball spike looks
   * fluid." Three drawn twelve-frame bodies — FLEX, BACKFLIP, BALL SPIKE — cut by scripts/build-celebration-sheets.py into
   * public/celebrations/ (a 1x atlas at the field cells' scale, a 2x atlas, the skin masks and a manifest: per frame the
   * FOOT anchor on the ground line, the centre of mass, the drawn height over the ground, the drawn rotation, the helmet).
   *   WHICH ONE     HIS touchdown (`celebrate()`, the v151 B / v159 C door) picks one of the three from the play's ball token
   *                through this file's `prng` (`pickV161A`) — the same play always gets the same one, and the game's
   *                Math.random is never drawn.
   *   THE MOTION    every frame is a pure function of (animation, t) — `poseV161A`: hand-timed segments (`PLAN_V161A`: holds
   *                on the key poses, quick in-betweens), ONE gravity for everything that leaves the ground (TU v161Ag, in 1x
   *                px/ms²; the arcs' durations follow from their heights, so the flip, the hop and the ball fall alike):
   *                BACKFLIP — an anticipation crouch that loads (squash), then the air: his centre of mass rides a parabola
   *                (peak TU v161AflipPeak body heights over the line between the launch's and the landing's drawn centres),
   *                the spin φ(u) = 360·(u − A·sin 2πu / 2π) (slow off the ground, fastest tucked, opening for the landing;
   *                TU v161AflipEase A), the drawn frame is the one whose drawn angle is nearest φ and the sprite is turned
   *                by the rest (≤ TU v161AflipSmear°) about its centre of mass, so the spin reads continuous; a damped squash
   *                on landing, dust at take-off and landing, the shadow shrinking with height. SPIKE — the wind-up loads,
   *                a hop on the same gravity, the slam lands on the spike frame: a flash, a dirt burst, a camera shake
   *                (TU v161Ashake, never under reduced motion); the ball leaves the art on the frame it leaves his hand and
   *                is its own sprite from where it lay: real bounces (restitution TU v161AballBounce, friction, spin that
   *                follows the roll) with a dirt puff on the first landings. FLEX — weighty holds (a settle on arrival, a
   *                slow breath), a stomp with dust and a small shake, a fist-pump hop. FLEX / BACKFLIP toss the game ball
   *                aside first (TU v161Atoss), so it does not vanish from his hand.
   *   ON THE FIELD  `fieldBodyV161A` owns HIS marker for the run: in the scene's postupdate (after placeMarker) the body
   *                wears the frame (his kit: `ribRecolor` through `__V161A_FIELD`, his skin tone painted on the generator's
   *                skin mask, an equipped helmet's shell and stripe inside the frame's helmet ellipse; cached per kit),
   *                anchored at its feet — or its centre of mass in the air — and the container rides the arc (the shadow
   *                stays on the grass). v159 C's squash / hop stands down for him while it runs; its particles, callout and
   *                stages play around him as before. The 2x atlas is drawn at half scale (TU v161Ahd). ~2.3-2.8 s, never
   *                blocks the game; a new play or a cleared field ends it and hands the marker back.
   *   REDUCED MOTION  one calm pose (the last frame) for TU v161AcalmMs, no arc, spin, shake or particles.
   *   THE LOCKER    the celebration previews (v159 C mini-stages) play the three bodies in turn, one a loop, from the 2x
   *                atlas in his kit; a note says they are picked at random.
   * Kill switch TU v161A 0: the v159 C pose and the sheet's celebrate cells. Looks only — no sim value is read or written.
   * `window.__V161A` is what v161Acheck reads. */
  var V161A = (window.__V161A = window.__V161A || { runs: [], active: null, last: null, loads: 0, builds: 0, buildMs: 0, previews: 0, prevFrames: 0, errs: [] });
  function errV161A(e) { try { if (V161A.errs.length < 12) V161A.errs.push(String((e && e.message) || e)); } catch (x) {} }
  function onV161A(k) { return !!TUv(k || "v161A", 1); }
  var ANIMS_V161A = ["flex", "backflip", "spike"];
  var DATA_V161A = { M: null, img: {}, skin: {}, sw: {}, state: 0, cbs: [] };
  function assetV161A(p) { try { return window.__RIB_ASSET ? window.__RIB_ASSET(p) : "./public/" + p; } catch (e) { return "./public/" + p; } }
  /* the manifest, both atlases and both skin masks (read to bytes once) */
  function loadV161A(cb) {
    if (DATA_V161A.state === 2) { if (cb) cb(); return true; }
    if (cb) DATA_V161A.cbs.push(cb);
    if (DATA_V161A.state !== 0) return false;
    DATA_V161A.state = 1; V161A.loads++;
    var need = 5;
    var done = function () { if (--need) return; DATA_V161A.state = 2; DATA_V161A.cbs.splice(0).forEach(function (f) { try { f(); } catch (e) { errV161A(e); } }); };
    var fail = function (e) { DATA_V161A.state = -1; errV161A("load: " + ((e && e.message) || e)); };
    try {
      fetch(assetV161A("celebrations/cel_v161a.json")).then(function (r) { return r.json(); }).then(function (m) { DATA_V161A.M = m; done(); }, fail);
      [1, 2].forEach(function (s) {
        var im = new Image(); im.onload = function () { DATA_V161A.img[s] = im; done(); }; im.onerror = fail; im.src = assetV161A("celebrations/cel_v161a_" + s + "x.png");
        var sk = new Image(); sk.onload = function () {
          try { var c = document.createElement("canvas"); c.width = sk.width; c.height = sk.height; var x = c.getContext("2d"); x.drawImage(sk, 0, 0);
            var d = x.getImageData(0, 0, sk.width, sk.height).data, m = new Uint8Array(sk.width * sk.height); for (var i = 0; i < m.length; i++) m[i] = d[i * 4] > 127 ? 1 : 0;
            DATA_V161A.skin[s] = m; DATA_V161A.sw[s] = sk.width; } catch (e) { errV161A(e); }
          done(); };
        sk.onerror = fail; sk.src = assetV161A("celebrations/cel_v161a_skin_" + s + "x.png");
      });
    } catch (e) { fail(e); }
    return false;
  }
  function readyV161A() { return DATA_V161A.state === 2 && !!DATA_V161A.M; }

  /* ---- which one: the play's ball token, this file's PRNG ---- */
  function pickV161A(tok) { var r = prng(strHashV159C("v161A|" + String(tok))); r(); return ANIMS_V161A[Math.floor(r() * 3) % 3]; }

  /* ---- the timeline: [frame, ms, tag] — holds on the key poses, quick in-betweens. "air" is the backflip's flight
   *      (frames 3-8, driven by the spin), "leap" the spike's hop; both last as long as their arc takes under TU v161Ag ---- */
  var PLAN_V161A = {
    flex: [[0, 150], [1, 110, "hit"], [2, 290, "hold"], [3, 360, "hold"], [4, 200, "stomp"], [5, 230, "hold"], [6, 290, "hold"], [7, 220, "hit"],
      [8, 220, "pump"], [9, 160, "hit"], [10, 330, "hold"], [11, 210, "hold"]],
    backflip: [[0, 170], [1, 120], [2, 250, "load"], ["air", 0, "air"], [9, 210, "land"], [10, 180], [11, 600, "hold"]],
    spike: [[0, 170], [1, 120, "hit"], [2, 250, "load"], [3, 0, "leap"], [4, 240, "spike"], [5, 160], [6, 150, "release"], [7, 360, "hold"],
      [8, 220, "pound"], [9, 260, "hold"], [10, 200], [11, 250, "hold"]]
  };
  var AIR_V161A = [3, 4, 5, 6, 7, 8];
  function gV161A() { return Math.max(1e-5, TUv("v161Ag", 0.0009)); }
  function standV161A() { return (DATA_V161A.M && DATA_V161A.M.stand) || 44; }
  function arcMsV161A(h) { return Math.sqrt(8 * Math.max(0.5, h) / gV161A()); }   // up and back down under g
  function flipPeakV161A() { return TUv("v161AflipPeak", 1.25) * standV161A(); }
  function hopV161A() { return TUv("v161AspikeHop", 0.25) * standV161A(); }
  var TLC_V161A = {};
  function tlV161A(name, calm) {
    var key = name + (calm ? "|c" : "") + "|" + gV161A() + "|" + TUv("v161Apace", 1) + "|" + flipPeakV161A() + "|" + hopV161A() + "|" + TUv("v161AcalmMs", 1200);
    if (TLC_V161A[key]) return TLC_V161A[key];
    var segs = [], t = 0, pace = Math.max(0.3, TUv("v161Apace", 1));
    if (calm) segs.push({ k: 11, t0: 0, ms: TUv("v161AcalmMs", 1200), tag: "calm", i: 0 });
    else (PLAN_V161A[name] || PLAN_V161A.flex).forEach(function (s, i) {
      var ms = s[2] === "air" ? arcMsV161A(flipPeakV161A()) : s[2] === "leap" ? arcMsV161A(hopV161A()) : s[1] * pace;
      segs.push({ k: s[0] === "air" ? AIR_V161A[0] : s[0], air: s[0] === "air", t0: t, ms: ms, tag: s[2] || "", i: i }); t += ms;
    });
    var T = { name: name, calm: !!calm, segs: segs, total: segs.reduce(function (a, s) { return a + s.ms; }, 0) };
    T.release = 0; segs.forEach(function (s) { if (s.tag === "release") T.release = s.t0; if (s.tag === "spike") T.impact = s.t0; if (s.tag === "air") { T.takeoff = s.t0; T.land = s.t0 + s.ms; } if (s.tag === "stomp") T.stomp = s.t0; });
    return (TLC_V161A[key] = T);
  }
  function segAtV161A(T, t) { var s = T.segs[0]; for (var i = 0; i < T.segs.length; i++) if (t >= T.segs[i].t0) s = T.segs[i]; return s; }
  function spinV161A(u) { var A = Math.min(0.95, Math.max(0, TUv("v161AflipEase", 0.7))); return 360 * (u - A * Math.sin(2 * Math.PI * u) / (2 * Math.PI)); }
  function springV161A(amp, tau) { return tau < 0 ? 0 : amp * Math.exp(-tau / TUv("v161AspringMs", 95)) * Math.cos(tau * 2 * Math.PI / 300); }
  /* one frame of the body: which drawn frame, the arc (`lift`, 1x px over the grass), the turn (deg), the squash, the pivot */
  function poseV161A(name, t, calm) {
    var T = tlV161A(name, calm), sg = segAtV161A(T, t), u = c01V159C((t - sg.t0) / Math.max(1, sg.ms)), tau = t - sg.t0;
    var o = { name: name, t: t, k: sg.k, seg: sg.i, tag: sg.tag, u: u, lift: 0, rot: 0, phi: 0, pivot: "foot", cx: 0, cy: 0, sx: 1, sy: 1, sh: 1, air: 0 };
    if (calm || !readyV161A()) return o;
    var A = DATA_V161A.M.anims[name], F = A && A.frames, stand = standV161A();
    if (!F) return o;
    if (sg.air) {
      var phi = spinV161A(u), best = AIR_V161A[0];
      AIR_V161A.forEach(function (k) { if (Math.abs(phi - F[k].rot) < Math.abs(phi - F[best].rot)) best = k; });
      var f0 = F[AIR_V161A[0]], f1 = F[AIR_V161A[AIR_V161A.length - 1]], sm = TUv("v161AflipSmear", 40);
      o.k = best; o.phi = phi; o.air = 1; o.pivot = "com";
      o.rot = Math.max(-sm, Math.min(sm, phi - F[best].rot));
      var h0 = f0.ay - f0.cy, h1 = f1.ay - f1.cy, d0 = f0.cx - f0.ax, d1 = f1.cx - f1.ax;
      o.cx = d0 + (d1 - d0) * u; o.cy = -(h0 + (h1 - h0) * u);   // his centre of mass over the ground point, before the arc
      o.lift = flipPeakV161A() * 4 * u * (1 - u);
    } else if (sg.tag === "leap") {
      o.lift = hopV161A() * 4 * u * (1 - u);
      var st = 0.07 * Math.cos(Math.PI * u); o.sy = 1 + st; o.sx = 1 - st * 0.6;   // stretched going up, gathering into the slam
    } else if (sg.tag === "load") {
      var e = EZ_V159C.inOutS(u); o.sy = 1 - 0.06 * e; o.sx = 1 + 0.035 * e;
    } else if (sg.tag === "pump") {
      var tp = arcMsV161A(TUv("v161ApumpHop", 2.5)), up = c01V159C(tau / tp); o.lift = tau < tp ? TUv("v161ApumpHop", 2.5) * 4 * up * (1 - up) : 0;
    }
    var amp = { land: TUv("v161AlandSquash", 0.14), spike: 0.1, stomp: 0.08, pound: 0.05, hold: 0.03, hit: 0.025 }[sg.tag] || 0;
    if (amp) { var s = springV161A(amp, tau); o.sy *= 1 - s; o.sx *= 1 + s * 0.6; }
    if (sg.tag === "hold" && tau > 140) { var br = Math.min(1, (tau - 140) / 200); o.sy *= 1 + 0.016 * br * Math.sin((tau - 140) * 2 * Math.PI / TUv("v161AbreathMs", 620)); }
    o.sh = 1 - 0.55 * Math.min(1, o.lift / (0.9 * stand));
    return o;
  }
  /* ---- the ball: the spike's from the frame it leaves his hand; flex / backflip toss the game ball aside. Real bounces:
   *      one g, restitution e = √(height ratio), friction on each landing, then a roll that stops. 1x px from the ground point ---- */
  function ballSchedV161A(name) {
    var T = tlV161A(name, false), M = DATA_V161A.M, A = M && M.anims.spike, g = gV161A(), stand = standV161A();
    if (!A || !A.ball) return null;
    var S = { t0: 0, x0: 0, y0: 0, h0: 0, v0: 0, vx: 0, flights: [] };
    if (name === "spike") {
      var s0 = A.ballStart, dr = A.ballDrawn || [s0[0] + 6, s0[1] - 10], hA = Math.max(TUv("v161AballH", 0.3) * stand, s0[1] - dr[1]);
      S.t0 = T.release; S.x0 = s0[0]; S.y0 = s0[1]; S.h0 = 0; S.v0 = Math.sqrt(2 * g * hA);
      S.vx = Math.max(0.035, (dr[0] - s0[0]) / (S.v0 / g));   // the drawn ball is at the top of its first arc
    } else {
      if (!TUv("v161Atoss", 1)) return null;
      S.t0 = 0; S.x0 = 7; S.y0 = -4.5; S.h0 = 16; S.v0 = Math.sqrt(2 * g * 5); S.vx = 0.045;   // from his hand at the hip, a flick up and aside
    }
    var e = Math.sqrt(Math.max(0.05, Math.min(0.9, TUv("v161AballBounce", 0.42)))), fr = TUv("v161AballFric", 0.72), n = TUv("v161AballN", 5);
    var v = S.v0, h0 = S.h0, x = S.x0, vx = S.vx, t = S.t0;
    for (var k = 0; k < n; k++) {
      var T1 = (v + Math.sqrt(v * v + 2 * g * h0)) / g;   // up from h0 at v, down to the grass
      S.flights.push({ t0: t, T: T1, v: v, h0: h0, x0: x, vx: vx }); t += T1; x += vx * T1;
      var vland = Math.sqrt(v * v + 2 * g * h0); v = vland * e; h0 = 0; vx *= fr;
      if (v < 0.02) break;
    }
    S.rollT = t; S.rollX = x; S.rollV = vx; S.end = T.total;
    return S;
  }
  var BS_V161A = {};
  function ballV161A(name, t, calm) {
    if (calm || !readyV161A()) return null;
    var key = name + "|" + gV161A() + "|" + TUv("v161AballBounce", 0.42) + "|" + TUv("v161Atoss", 1) + "|" + TUv("v161Apace", 1);
    var S = BS_V161A[key] || (BS_V161A[key] = ballSchedV161A(name) || { none: 1 });
    if (S.none || t < S.t0) return null;
    var g = gV161A(), x, h, k = -1;
    for (var i = 0; i < S.flights.length; i++) { var F = S.flights[i]; if (t < F.t0 + F.T) { var tau = t - F.t0; x = F.x0 + F.vx * tau; h = Math.max(0, F.h0 + F.v * tau - 0.5 * g * tau * tau); k = i; break; } }
    if (k < 0) { var rt = Math.min(t - S.rollT, 420); x = S.rollX + S.rollV * (rt - rt * rt / 840); h = 0; k = S.flights.length; }
    var fade = TUv("v161AballFadeMs", 280), a = c01V159C((S.end - t) / fade);
    return { x: x, y: S.y0 - h, h: h, rot: (x - S.x0) / 4.5 + (name === "spike" ? 0 : -0.6), a: a, k: k, S: S };
  }
  /* ---- the particles: seeded, closed-form (the dust of a take-off, a landing, a stomp; the spike's dirt and flash; a
   *      puff where the ball lands) — 1x px from the ground point, t in ms ---- */
  var DIRT_V161A = [0x7a5a36, 0x9a7446, 0x5e4428, 0xb89468, 0x6b4f30];
  function partsV161A(name, seed, calm) {
    var P = []; if (calm || !readyV161A()) return P;
    var r = prng((seed >>> 0) ^ 0x161a), R = function (a, b) { return a + (b - a) * r(); }, T = tlV161A(name, false), n = TUv("v161Aparts", 1);
    var dust = function (t0, x, cnt, spread, strong) { for (var i = 0; i < Math.round(cnt * n); i++) { var sd = i % 2 ? 1 : -1;
      P.push({ kind: "dust", t0: t0 + R(0, 50), x: x + sd * R(2, spread), y: R(-1.5, 0.5), vx: sd * R(0.008, 0.03) * strong, vy: -R(0.004, 0.012) * strong, r0: R(1.2, 2.2), r1: R(4, 7) * strong, life: R(380, 560), c: 0xb8a684, a: R(0.35, 0.55) }); } };
    var dirt = function (t0, x, cnt, sp) { for (var i = 0; i < Math.round(cnt * n); i++) { var ang = -Math.PI / 2 + R(-1.25, 1.25), v = R(0.05, 0.13) * sp;
      P.push({ kind: "dirt", t0: t0 + R(0, 25), x: x + R(-3, 3), y: R(-2, 0), vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, g: gV161A() * 0.9, life: R(360, 620), s: R(0.8, 1.9), c: DIRT_V161A[i % DIRT_V161A.length], a: 1 }); } };
    if (name === "backflip") { dust(T.takeoff, 0, 10, 7, 1.2); dust(T.land, 0, 12, 8, 1.4); }
    if (name === "flex") dust(T.stomp, 0, 10, 9, 1.1);
    if (name === "spike") {
      var A = DATA_V161A.M.anims.spike, bx = A.ballStart ? A.ballStart[0] : 0;
      dirt(T.impact, bx, 18, 1); dust(T.impact, bx, 8, 6, 1.1);
      P.push({ kind: "flash", t0: T.impact, x: bx, y: -3, life: 170 }); P.push({ kind: "ring", t0: T.impact, x: bx, y: 0, life: 360 });
    }
    var bs = ballV161A(name, (T.release || 0) + 1, false), S = bs && bs.S;
    if (S) S.flights.slice(0, 2).forEach(function (F, i) { var xl = F.x0 + F.vx * F.T; dust(F.t0 + F.T, xl, i ? 3 : 5, 2.5, 0.7); if (name === "spike") dirt(F.t0 + F.T, xl, i ? 3 : 6, 0.55); });
    return P;
  }
  /* draws the particles at t with a painter { circ(x, y, r, c, a), rect(x, y, w, h, c, a), ell(x, y, rx, ry, w, c, a) } in 1x px */
  function drawPartsV161A(P, t, D) {
    var live = 0;
    for (var i = 0; i < P.length; i++) { var p = P[i], tau = t - p.t0; if (tau < 0 || tau > p.life) continue; var f = tau / p.life; live++;
      if (p.kind === "dust") { var r = p.r0 + (p.r1 - p.r0) * EZ_V159C.outC(f); D.circ(p.x + p.vx * tau, p.y + p.vy * tau - r * 0.35, r, p.c, p.a * Math.pow(1 - f, 1.6)); }
      else if (p.kind === "dirt") { var y = p.y + p.vy * tau + 0.5 * p.g * tau * tau, x = p.x + p.vx * tau; if (y > 0) { y = 0; x = p.x + p.vx * Math.min(tau, 60); } D.rect(x - p.s / 2, y - p.s / 2, p.s, p.s, p.c, 1 - EZ_V159C.inQ(c01V159C((f - 0.55) / 0.45))); }
      else if (p.kind === "flash") { D.circ(p.x, p.y, 3 + 11 * EZ_V159C.outC(f), 0xfff6dc, 0.85 * (1 - f)); }
      else if (p.kind === "ring") { var rr = 4 + 20 * EZ_V159C.outC(f); D.ell(p.x, p.y, rr, rr * 0.32, 1.4 * (1 - f) + 0.4, 0xe9dcc0, 0.7 * (1 - f)); } }
    return live;
  }

  /* ---- his kit on a frame: ribRecolor (the field's own), his skin tone on the skin mask, the equipped helmet in the
   *      frame's helmet ellipse ---- */
  function kitV161A(kitKey, tone) {
    var F = window.__V161A_FIELD, cols = F && F.kit ? F.kit(kitKey || "you") : null;
    if (!cols) { var U = resolveU((item("uniform") || {}).k || null, null); cols = U ? [U.j, U.p] : [teamCol(0), teamCol(1)]; }
    var H = V.kit && V.kit.helmet ? ((item("helmet") || {}).h || null) : null;   // the helmet the field dressed him in (fieldKit)
    var tones = (F && F.tones) || ["#bf8a62"], tn = tones[tone != null && tones[tone] ? tone : Math.min(3, tones.length - 1)];
    return { p1: cols[0], p2: cols[1], H: H, tone: tn, key: cols[0] + cols[1] + "|" + (H ? [H.s, H.st, H.f].join(",") : "-") + "|" + tn };
  }
  function frameCanvasV161A(name, k, scale, kit) {
    var M = DATA_V161A.M, A = M.anims[k === "ball" ? "spike" : name], fr = k === "ball" ? null : A.frames[k];
    var r = k === "ball" ? (scale === 2 ? A.ball2 : A.ball) : (scale === 2 ? fr.r2 : fr.r), w = r[2], h = r[3];
    var cv = document.createElement("canvas"); cv.width = w; cv.height = h; var x = cv.getContext("2d"); x.drawImage(DATA_V161A.img[scale], r[0], r[1], w, h, 0, 0, w, h);
    if (k === "ball" || !kit) return cv;
    var src = x.getImageData(0, 0, w, h).data, F = window.__V161A_FIELD, out = F && F.recolor ? F.recolor(cv, kit.p1, kit.p2) : cv;
    var ox = out.getContext("2d"), img = ox.getImageData(0, 0, w, h), d = img.data, sk = DATA_V161A.skin[scale], sw = DATA_V161A.sw[scale];
    // skin: v151 D's grey luminance, times his tone
    if (sk) { var ls = 0, ln = 0, j, i4, L;
      for (j = 0; j < w * h; j++) { if (!sk[(r[1] + ((j / w) | 0)) * sw + r[0] + (j % w)]) continue; i4 = j * 4; if (src[i4 + 3] < 20) continue;
        ls += (Math.max(src[i4], src[i4 + 1], src[i4 + 2]) + Math.min(src[i4], src[i4 + 1], src[i4 + 2])) / 2; ln++; }
      var ref = Math.max(30, ln ? ls / ln : 120), tn = rgb(kit.tone);
      for (j = 0; j < w * h; j++) { if (!sk[(r[1] + ((j / w) | 0)) * sw + r[0] + (j % w)]) continue; i4 = j * 4; if (src[i4 + 3] < 20) continue;
        L = (Math.max(src[i4], src[i4 + 1], src[i4 + 2]) + Math.min(src[i4], src[i4 + 1], src[i4 + 2])) / 2;
        var v = Math.max(40, Math.min(255, 214 * Math.pow(L / ref, 0.8)));
        d[i4] = Math.min(255, tn[0] * v / 255); d[i4 + 1] = Math.min(255, tn[1] * v / 255); d[i4 + 2] = Math.min(255, tn[2] * v / 255); } }
    // the helmet: the shell and the stripe the art drew, in the equipped helmet's colours
    if (kit.H && hexOk(kit.H.s) && fr.helm) {
      var an = scale === 2 ? fr.a2 : [fr.ax, fr.ay], hx = an[0] + fr.helm[0] * scale, hy = an[1] + fr.helm[1] * scale, rx = fr.helm[2] * scale * 1.06, ry = fr.helm[3] * scale * 1.06;
      var HS = rgb(kit.H.s), HST = hexOk(kit.H.st) ? rgb(kit.H.st) : null;
      for (var yy = Math.max(0, Math.floor(hy - ry)); yy <= Math.min(h - 1, Math.ceil(hy + ry)); yy++) for (var xx = Math.max(0, Math.floor(hx - rx)); xx <= Math.min(w - 1, Math.ceil(hx + rx)); xx++) {
        var ex = (xx + 0.5 - hx) / rx, ey = (yy + 0.5 - hy) / ry; if (ex * ex + ey * ey > 1) continue;
        var q = (yy * w + xx) * 4; if (src[q + 3] < 20) continue;
        var cl = classify(src[q], src[q + 1], src[q + 2]); if (!cl[0]) continue;
        var s2 = Math.min(1.75, Math.max(0.25, cl[1] / (cl[0] === 1 ? 95 : 165))), base = cl[0] === 2 && HST ? HST : HS;
        if (cl[0] === 2 && !HST) s2 = Math.min(1.3, s2);
        d[q] = Math.min(255, base[0] * s2); d[q + 1] = Math.min(255, base[1] * s2); d[q + 2] = Math.min(255, base[2] * s2); }
    }
    ox.putImageData(img, 0, 0);
    return out;
  }
  /* the field's textures for one animation in one kit (built at the touchdown: twelve frames and the ball, a few ms) */
  var TEX_V161A = { n: 0, kits: {}, order: [] };
  function texV161A(scene, name, kit, scale) {
    var id = kit.key + "|" + scale + "|" + name, rec = TEX_V161A.kits[id];
    if (rec && rec.scene === scene && scene.textures.exists(rec.keys[0])) return rec;
    var t0 = performance.now(), pre = "cel161_" + (++TEX_V161A.n) + "_", keys = [];
    for (var k = 0; k < 12; k++) { var key = pre + name + k; try { if (scene.textures.exists(key)) scene.textures.remove(key); scene.textures.addCanvas(key, frameCanvasV161A(name, k, scale, kit)); } catch (e) { errV161A(e); } keys.push(key); }
    var bkey = "cel161_ball" + scale; if (!scene.textures.exists(bkey)) try { scene.textures.addCanvas(bkey, frameCanvasV161A("spike", "ball", scale, null)); } catch (e) { errV161A(e); }
    rec = TEX_V161A.kits[id] = { scene: scene, keys: keys, ball: bkey, scale: scale };
    TEX_V161A.order.push(id);
    while (TEX_V161A.order.length > TUv("v161AtexKeep", 6)) { var old = TEX_V161A.kits[TEX_V161A.order.shift()]; if (old) old.keys.forEach(function (kk) { try { if (old.scene.textures.exists(kk)) old.scene.textures.remove(kk); } catch (e) {} }); }
    V161A.builds++; V161A.buildMs = +(performance.now() - t0).toFixed(1);
    return rec;
  }
  /* the other two bodies in the same kit, when the page is idle (the next touchdown then builds nothing) */
  function warmV161A(scene, kit, scale) {
    var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 1200); };
    ANIMS_V161A.forEach(function (n, i) { idle(function () { try { if (scene.sys && scene.sys.isActive && !scene.sys.isActive()) return; texV161A(scene, n, kit, scale); V161A.warm = (V161A.warm || 0) + 1; } catch (e) {} }, { timeout: 4000 + i * 500 }); });
  }

  /* ---- the field: HIS marker plays the body; v159 C's layer plays around him ---- */
  function fieldBodyV161A(scene, cm, opts) {
    opts = opts || {};
    if (!onV161A() || !scene || !scene.add || !scene.events || !cm || !cm.root || !cm.body) return null;
    if (!readyV161A()) { loadV161A(); V161A.notReady = (V161A.notReady || 0) + 1; return null; }   // not decoded yet: the old pose plays this once
    var calm = opts.calm != null ? !!opts.calm : reducedV158A();
    var P = scene.play, tok = opts.tok != null ? String(opts.tok) : P && P.__ballTokenV1514 != null ? String(P.__ballTokenV1514) : String(Math.round((scene.time && scene.time.now) || 0));
    var name = opts.name && DATA_V161A.M.anims[opts.name] ? opts.name : pickV161A(tok), seed = strHashV159C("v161A|parts|" + tok);
    try { if (cm.__v161a && cm.__v161a.alive) cm.__v161a.stop("replaced"); } catch (e) {}
    var scale = TUv("v161Ahd", 1) ? 2 : 1, ks = 1 / scale, kit = kitV161A(cm.kit || cm.team, cm.skinTone), tex = texV161A(scene, name, kit, scale);
    warmV161A(scene, kit, scale);
    var T = tlV161A(name, calm), A = DATA_V161A.M.anims[name], parts = partsV161A(name, seed, calm);
    var ex = cm.dirKey === "sd" || cm.dirKey === "dr" || cm.dirKey === "ur", mir = ex && !cm.flip ? -1 : 1;   // the art turns to his right; running left, it is mirrored
    var root = cm.root, body = cm.body, shadow = cm.shadow, fill = cm.fill, sh0 = shadow ? shadow.y : 24, fl0 = fill ? fill.y : 24, last = null;
    var track = function (o) { try { return scene.trackFx ? scene.trackFx(o) : o; } catch (e) { return o; } };
    var g = track(scene.add.graphics()), ball = track(scene.add.image(0, 0, tex.ball).setVisible(false)), gb = scene.ballSpr;
    var nf = cm._nfImgV158A, nfVis = nf ? nf.visible : null, gbVis = gb ? gb.visible : null, cam = scene.cameras && scene.cameras.main;
    var run = { name: name, tok: tok, calm: calm, mir: mir, scale: scale, total: T.total, T: T, t0: performance.now(), hold: null, alive: true, ended: null, play: P,
      frames: 0, seq: [], lifts: [], rots: [], balls: [], parts: parts.length, maxLive: 0, shake: 0, drawMs: 0, drawMax: 0, ms: [], kit: kit.key, tex: tex.keys[0], v159Skipped: 0 };
    var D = { circ: null, rect: null, ell: null }, gx = 0, gy = 0, gs = 1;
    D.circ = function (x, y, r, c, a) { if (a > 0.01) { g.fillStyle(c, Math.min(1, a)); g.fillCircle(gx + mir * x * gs, gy + y * gs, Math.max(0.4, r * gs)); } };
    D.rect = function (x, y, w, h, c, a) { if (a > 0.01) { g.fillStyle(c, Math.min(1, a)); g.fillRect(gx + mir * x * gs - (mir < 0 ? w * gs : 0), gy + y * gs, Math.max(0.6, w * gs), Math.max(0.6, h * gs)); } };
    D.ell = function (x, y, rx, ry, w, c, a) { if (a > 0.01) { g.lineStyle(Math.max(0.5, w * gs), c, Math.min(1, a)); g.strokeEllipse(gx + mir * x * gs, gy + y * gs, rx * 2 * gs, ry * 2 * gs, 24); } };
    var tick = function () {
      if (!run.alive) return;
      if (!g.scene || !root.active || !body.active) { stop("cleared"); return; }
      if (scene.play && run.play && scene.play !== run.play) { stop("next play"); return; }
      var t = run.hold != null ? run.hold : performance.now() - run.t0;
      if (t >= T.total) { stop("done"); return; }
      var c0 = performance.now();
      try {
        var bx = root.x, by = root.y, bs = root.scaleY, bob = cm.bob && cm.bob.active ? cm.bob : null, boby = bob ? bob.y : 0;
        if (last && root.x === last.ax && root.y === last.ay && root.scaleY === last.as) { bx = last.bx; by = last.by; bs = last.bs; }
        if (last && bob && bob.y === last.bobAy) boby = last.boby;   // the plumbob rides up with him (placeMarker re-places it when it runs)
        var o = poseV161A(name, t, calm), fr = A.frames[o.k], key = tex.keys[o.k], r = scale === 2 ? fr.r2 : fr.r, an = scale === 2 ? fr.a2 : [fr.ax, fr.ay, fr.cx, fr.cy];
        if (body.texture.key !== key) body.setTexture(key);
        cm.tex = key;
        if (o.pivot === "com") { body.setOrigin(an[2] / r[2], an[3] / r[3]); body.setPosition(mir * o.cx, 22 + o.cy); }
        else { body.setOrigin(an[0] / r[2], an[1] / r[3]); body.setPosition(0, 22); }
        body.setScale(mir * ks * o.sx, ks * o.sy); body.setRotation(mir * o.rot * Math.PI / 180); body.setFlipX(false); body.setAlpha(1); body.setVisible(true);
        root.setPosition(bx, by - o.lift * bs);
        if (shadow) { shadow.y = sh0 + o.lift; shadow.setScale(o.sh); } if (fill) { fill.y = fl0 + o.lift; fill.setScale(o.sh); }
        if (cm.label) cm.label.setVisible(false); if (cm.skin) cm.skin.setVisible(false); if (nf) nf.setVisible(false); if (gb && gb.active !== false) gb.setVisible(false);
        if (bob) bob.y = boby - o.lift * bs;
        last = { ax: root.x, ay: root.y, as: root.scaleY, bx: bx, by: by, bs: bs, boby: boby, bobAy: bob ? bob.y : null };
        // the ground point in the world, the particles and the loose ball
        gx = bx; gy = by + 22 * bs; gs = bs; g.clear(); g.setDepth((root.depth || 4) + 0.02);
        var live = drawPartsV161A(parts, t, D); run.maxLive = Math.max(run.maxLive, live);
        var b = ballV161A(name, t, calm);
        if (b && b.a > 0.01) { ball.setVisible(true).setPosition(gx + mir * b.x * bs, gy + b.y * bs).setScale(bs * ks).setRotation(mir * b.rot).setAlpha(b.a).setDepth((root.depth || 4) + 0.03);
          g.fillStyle(0x000000, 0.28 * b.a * (1 - Math.min(0.7, b.h / 30))); g.fillEllipse(gx + mir * b.x * bs, gy + 0.5 * bs, 7 * bs * (1 - Math.min(0.5, b.h / 40)), 2.4 * bs, 16);
          if (run.balls.length < 400) run.balls.push({ t: Math.round(t), x: +b.x.toFixed(2), h: +b.h.toFixed(2), k: b.k }); }
        else ball.setVisible(false);
        // the camera: the slam, the stomp (never under reduced motion)
        var sg = segAtV161A(T, t);
        if (!calm && cam && sg.i !== run.lastSeg && (sg.tag === "spike" || sg.tag === "stomp" || sg.tag === "land") && TUv("v161Ashake", 1)) {
          var k2 = sg.tag === "spike" ? 1 : sg.tag === "land" ? 0.45 : 0.35;
          try { cam.shake(TUv("v161AshakeMs", 130), 0.0042 * k2 * TUv("v161Ashake", 1)); run.shake++; } catch (e) {} }
        run.lastSeg = sg.i;
        if (run.seq.length < 600) { run.seq.push({ t: Math.round(t), k: o.k, seg: sg.i }); run.lifts.push(+o.lift.toFixed(2)); run.rots.push(+(o.air ? o.phi : 0).toFixed(1)); }
      } catch (e) { errV161A(e); }
      var dt = performance.now() - c0; run.frames++; run.drawMs += dt; run.drawMax = Math.max(run.drawMax, dt); if (run.ms.length < 400) run.ms.push(dt);
    };
    var stop = function (why) {
      if (!run.alive) return; run.alive = false; run.ended = why || "done";
      try { scene.events.off("postupdate", tick); } catch (e) {}
      try {
        if (root.active && last) root.setPosition(last.bx, last.by);
        if (last && cm.bob && cm.bob.active && last.bobAy != null && cm.bob.y === last.bobAy) cm.bob.y = last.boby;
        if (body.active) { body.setOrigin(0.5, 0.5); body.setPosition(0, 0); body.setScale(1); body.setRotation(0); }
        cm.tex = null;   // placeMarker sets his own texture back on its next frame
        if (why === "done" && cm.forceState === "celebrateSeq") cm.forceState = null;   // the sheet's own celebrate cells would pop in after the rest pose
        if (shadow && shadow.active !== false) { shadow.y = sh0; shadow.setScale(1); } if (fill && fill.active !== false) { fill.y = fl0; fill.setScale(1); }
        if (nf && nf.active !== false && nfVis != null) nf.setVisible(nfVis);
        if (gb && gb.active !== false && gbVis != null) gb.setVisible(gbVis);
      } catch (e) {}
      [g, ball].forEach(function (o) { try { scene.dropFx ? scene.dropFx(o) : o.destroy(); } catch (e) {} });
      if (cm.__v161a === run) cm.__v161a = null;
      if (V161A.active === run) V161A.active = null;
    };
    run.stop = stop; run.setHold = function (t) { run.hold = t == null ? null : +t; };
    cm.__v161a = run; V161A.active = run; V161A.last = run; V161A.runs.push(run); if (V161A.runs.length > 20) V161A.runs.shift();
    scene.events.on("postupdate", tick);
    try { scene.events.once("shutdown", function () { stop("shutdown"); }); } catch (e) {}
    tick();
    return run;
  }
  /* what the check reads */
  Object.assign(V161A, {
    anims: ANIMS_V161A.slice(), load: loadV161A, ready: readyV161A, manifest: function () { return DATA_V161A.M; }, pick: pickV161A,
    timeline: function (name, calm) { var T = tlV161A(name, !!calm); return { total: T.total, takeoff: T.takeoff, land: T.land, impact: T.impact, release: T.release, stomp: T.stomp,
      segs: T.segs.map(function (s) { return { k: s.air ? "air" : s.k, t0: Math.round(s.t0), ms: Math.round(s.ms), tag: s.tag }; }) }; },
    pose: poseV161A, ball: function (name, t, calm) { var b = ballV161A(name, t, calm); return b && { x: b.x, y: b.y, h: b.h, rot: b.rot, a: b.a, k: b.k }; },
    flights: function (name) { var b = ballSchedV161A(name); return b && b.flights.map(function (F) { return { t0: Math.round(F.t0), T: Math.round(F.T), apex: +(F.h0 + F.v * F.v / (2 * gV161A())).toFixed(2), x0: +F.x0.toFixed(2) }; }); },
    parts: function (name, seed, calm) { return partsV161A(name, seed == null ? 1 : seed, !!calm).map(function (p) { return { kind: p.kind, t0: Math.round(p.t0), life: Math.round(p.life) }; }); },
    frameCanvas: function (name, k, scale, kit) { return frameCanvasV161A(name, k, scale || 1, kit ? Object.assign({ H: null, tone: "#bf8a62", key: "chk" }, kit) : null); },
    play: fieldBodyV161A, spin: spinV161A,
    previewList: function () { return PV_V159C.list.map(function (r) { return { id: r.it.id, loops: r.loops, body: r.v161 || null, connected: r.cv.isConnected }; }); }
  });
  if (onV161A()) setTimeout(function () { try { loadV161A(); } catch (e) {} }, 2500);   // decode before the first touchdown
  (function () {
    if (document.getElementById("cosV161Acss")) return;
    var st = document.createElement("style"); st.id = "cosV161Acss";
    st.textContent = ".cos-note-v161a{margin:4px 2px 10px;padding:7px 10px;border-radius:10px;font-size:11.5px;line-height:1.35;color:#d7deeb;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}";
    (document.head || document.documentElement).appendChild(st);
  })();

  /* ---- the Locker: the v159 C mini-stage plays the three bodies in turn, from the 2x atlas in his kit ---- */
  var PVC_V161A = {};
  function pvFrameV161A(name, k, kit) {
    var id = kit.key + "|" + name + "|" + k;
    if (!PVC_V161A[id]) { if (Object.keys(PVC_V161A).length > 160) PVC_V161A = {}; PVC_V161A[id] = frameCanvasV161A(name, k, 2, k === "ball" ? null : kit); }
    return PVC_V161A[id];
  }
  function pvKitV161A() {
    var U = resolveU((item("uniform") || {}).k || null, null), H = (item("helmet") || {}).h || null, tone = 3;
    try { var st = gstate(), pl = st && st.player; if (pl && window.__skinToneV151D) tone = window.__skinToneV151D({ skinTone: pl.skinTone, name: pl.name || "you" }); } catch (e) {}
    var tones = (window.__V161A_FIELD && window.__V161A_FIELD.tones) || ["#bf8a62", "#bf8a62", "#bf8a62", "#bf8a62"], tn = tones[tone] || tones[3];
    var p1 = U ? U.j : teamCol(0), p2 = U ? U.p : teamCol(1);
    return { p1: p1, p2: p2, H: H, tone: tn, key: p1 + p2 + "|" + (H ? [H.s, H.st, H.f].join(",") : "-") + "|" + tn };
  }
  function pvBodyLenV161A() { return readyV161A() && onV161A() ? Math.max.apply(null, ANIMS_V161A.map(function (n) { return tlV161A(n, false).total; })) : 0; }
  function pvNameV161A(rec) { return ANIMS_V161A[((rec.loops || 0) + (rec.bodyOff || 0)) % 3]; }
  /* draws his body at t on the preview canvas; returns the shadow scale, or null when it did not draw (the old figure then) */
  function pvDrawBodyV161A(rec, x, t, ox, gyc, calm) {
    if (!onV161A() || !readyV161A()) { loadV161A(); return null; }
    var name = pvNameV161A(rec), kit = pvKitV161A(), o = poseV161A(name, t, calm), A = DATA_V161A.M.anims[name], fr = A.frames[o.k];
    var z = TUv("v161ApvPx", 25) / standV161A(), lk = TUv("v161ApvLift", 0.42), cv = pvFrameV161A(name, o.k, kit), an = fr.a2, ks = 0.5 * z;
    rec.v161 = { name: name, k: o.k, t: Math.round(t) }; V161A.prevFrames++;
    x.save(); x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; x.imageSmoothingEnabled = true; try { x.imageSmoothingQuality = "high"; } catch (e) {}
    if (!calm) { var P = rec.p161 && rec.p161.name === name ? rec.p161.P : (rec.p161 = { name: name, P: partsV161A(name, strHashV159C("pv|" + name), false) }).P;
      drawPartsV161A(P, t, { circ: function (px, py, r, c, a) { if (a > 0.01) { x.globalAlpha = Math.min(1, a); x.fillStyle = cssColV159C(c); x.beginPath(); x.arc(ox + px * z, gyc + py * z, Math.max(0.4, r * z), 0, 6.2832); x.fill(); } },
        rect: function (px, py, w, h, c, a) { if (a > 0.01) { x.globalAlpha = Math.min(1, a); x.fillStyle = cssColV159C(c); x.fillRect(ox + px * z, gyc + py * z, Math.max(0.6, w * z), Math.max(0.6, h * z)); } },
        ell: function (px, py, rx, ry, w, c, a) { if (a > 0.01) { x.globalAlpha = Math.min(1, a); x.strokeStyle = cssColV159C(c); x.lineWidth = Math.max(0.5, w * z); x.beginPath(); x.ellipse(ox + px * z, gyc + py * z, rx * z, ry * z, 0, 0, 6.2832); x.stroke(); } } });
      var b = ballV161A(name, t, false);
      if (b && b.a > 0.01) { var bc = pvFrameV161A("spike", "ball", kit); x.globalAlpha = b.a; x.save(); x.translate(ox + b.x * z, gyc + (b.y + (b.h * (lk - 1))) * z); x.rotate(b.rot); x.drawImage(bc, -bc.width * ks / 2, -bc.height * ks / 2, bc.width * ks, bc.height * ks); x.restore(); } }
    x.globalAlpha = 1;
    x.translate(ox, gyc - o.lift * lk * z);
    if (o.pivot === "com") { x.translate(o.cx * z, o.cy * z); x.rotate(o.rot * Math.PI / 180); x.scale(ks * o.sx, ks * o.sy); x.drawImage(cv, -an[2], -an[3]); }
    else { x.scale(ks * o.sx, ks * o.sy); x.drawImage(cv, -an[0], -an[1]); }
    x.restore();
    return o.sh;
  }

  /* ===== v174 THE PALETTE =====
   * The owner: "implement all options from the custom celebration, banner, etc into the color palette with the
   * uniform and color choice". The look lived in three places: the Team Creator's colours and crest (the 🎨 in the
   * top bar), the Locker's STYLE tab (one category at a time behind a strip of eighteen tabs) and the profile's
   * "Change Style" door into that tab. Now the STYLE tab IS the palette — one page, every section a row you can see:
   *   ON THE FIELD  uniform · team colours · team crest · helmet · celebration · number font · footprints · aura · wings · crown
   *   HIS CARD      banner · frame · title · badge · nameplate · profile icon · trophy shelf
   *   HIS WORLD     stadium · recap · vault
   * Each row shows what he wears now (that item's own preview painter, live) and how many of the section he has; a
   * tap opens it (one at a time, so the grid of 13-85 drawn previews stays one section's worth) and a tap on a look
   * wears it. The card at the top (`renderCard`, compact) is the live preview of the whole look and redraws on a pick.
   *   - team colours / crest are picked HERE too, through the Team Creator's own save and gate (`saveTeamCreatorV153`
   *     → `teamStyleNeedV151B`: the five free picks, then PP) — nothing new is sold, nothing is freed
   *   - entitlements are the module's as they were (`listed` / `owned` / `howTo`): member looks show 🔒 Membership,
   *     shop looks are not listed while monetization is OFF; nothing here calls the store
   *   - the old doors: `cosOpenStyleV151B(sec)` opens the palette at a section (the profile's button, the spray's
   *     STYLE); `cosCatV151B(c)` opens and scrolls to c; the top bar's 🎨 opens it at TEAM COLOURS on the career
   *     screens (elsewhere — a live game, the pregame — it is still the Team Creator); the Team Creator links to it
   * Draws no Math.random, changes no sim number. Kill switch TU `v174palette` 0: v151 B's tabbed panel, the 🎨 the
   * Team Creator, no link. `window.__V174`; `palettecheck`. */
  function onV174() { return !!TUv("v174palette", 1); }
  var V174 = { renders: 0, swaps: 0, team: [], jumps: 0, btn: 0, errs: 0 };
  var stylePanelOldV174 = stylePanel;   // v151 B's tabbed panel: what TU v174palette 0 draws
  var TEAM_SECS_V174 = { colours: { name: "TEAM COLOURS", icon: "🎨" }, crest: { name: "TEAM CREST", icon: "🛡️" } };
  var GROUPS_V174 = [
    { k: "field", name: "ON THE FIELD", note: "what he wears", secs: ["uniform", "colours", "crest", "helmet", "celebration", "numfont", "trail", "aura", "wings", "crown"] },
    { k: "card", name: "HIS CARD", note: "what the league sees", secs: ["banner", "frame", "title", "badge", "nameplate", "icon", "shelf"] },
    { k: "world", name: "HIS WORLD", note: "where he plays", secs: ["stadium", "recap", "vault"] }
  ];
  /* the views the top bar's 🎨 may leave for the palette (anywhere else it keeps opening the Team Creator) */
  var PAL_VIEWS_V174 = { hub: 1, menu: 1, locker: 1, profile: 1, stats: 1, hof: 1, legacy: 1, leaderboard: 1, seasons: 1, settings: 1, challenges: 1, upgrade: 1, shop: 1, life: 1, roster: 1, dynasty: 1 };
  function groupsV174() {
    var seen = {}, out = GROUPS_V174.map(function (g) { g.secs.forEach(function (s) { seen[s] = 1; }); return { k: g.k, name: g.name, note: g.note, secs: g.secs.slice() }; });
    SLOTS.forEach(function (s) { if (!seen[s]) out[out.length - 1].secs.push(s); });   // a slot added later still gets its row
    return out;
  }
  function secsV174() { var a = []; groupsV174().forEach(function (g) { a = a.concat(g.secs); }); return a; }
  function isSecV174(k) { return !!(k && (CATS[k] || TEAM_SECS_V174[k])); }
  function teamNowV174() { var c = window.__GRIDIRON_TEAM_CUSTOM__ || {}; return { pal: c.palette != null ? c.palette | 0 : null, logo: c.logo != null ? c.logo | 0 : null }; }
  function teamPalsV174() { return Array.isArray(window.TEAM_PALETTES) ? window.TEAM_PALETTES : []; }
  function emblemsV174() { var E = window.TEAM_LOGOS_V44; return E && E.db && E.db.length ? E : null; }
  function pairV174(a, b) { return "background:linear-gradient(135deg," + (hexOk(a) || "#1f4fd0") + " 0 50%," + (hexOk(b) || "#e8c86a") + " 50% 100%)"; }
  function viewOkV174() { var st = gstate(); return !!(st && st.player && PAL_VIEWS_V174[st.view]); }

  /* ---- the rows ---- */
  var cntV174 = null;   // one pass over the catalogue per full render (eighteen filters of 540 looked slow under load)
  function countsV174(only) {
    var c = {};
    ITEMS.forEach(function (it) { if (only && it.cat !== only) return; if (!listed(it)) return; var o = c[it.cat] || (c[it.cat] = { n: 0, have: 0 }); o.n++; if (owned(it.id)) o.have++; });
    return c;
  }
  function secHeadV174(k) {
    var meta = TEAM_SECS_V174[k] || CATS[k], pv = "", sub = "", n = "";
    if (k === "colours") {
      var I = teamStyle.info();
      pv = '<span class="pal-sw2-v174" style="' + pairV174(teamCol(0), teamCol(1)) + '"></span>';
      sub = uniColV159A() === "team" ? "Uniforms wear the team palette" : "Uniforms wear their own colours";
      n = I.all ? "ALL" : I.pals + "/" + teamPalsV174().length;
    } else if (k === "crest") {
      var E = emblemsV174(), lg = teamNowV174().logo, I2 = teamStyle.info();
      pv = '<span class="pal-crhd-v174">' + (E && lg != null ? '<i class="emblem-v44" style="' + escHtml(E.cssFull(lg)) + '"></i>' : "🛡️") + "</span>";
      sub = E && lg != null ? E.name(lg) || "Crest " + (lg + 1) : "Your school's crest";
      n = I2.all ? "ALL" : I2.logos + "/" + (E ? E.db.length : 90);
    } else {
      var eq = equipped(k), it = findItem(eq), c = (cntV174 || countsV174(k))[k] || { n: 0, have: 0 };
      pv = '<span class="cos-pvbox-v151b pal-hdpv-v174" data-pv174="' + escHtml(eq || "") + '"></span>';
      sub = it ? it.name : "—";
      n = c.have + "/" + c.n;
    }
    var open = SEL.cat === k;
    return '<button type="button" class="cos-cat-v151b pal-hd-v174" aria-expanded="' + open + '" onclick="palSecV174(\'' + k + '\')">' + pv +
      '<span class="pal-hdtx-v174"><b><i>' + meta.icon + "</i>" + meta.name + "</b><small>" + escHtml(sub) + "</small></span>" +
      '<em class="pal-hdn-v174">' + n + '</em><span class="pal-chev-v174" aria-hidden="true"></span></button>';
  }
  function itemHTMLV174(it, k, eq) {
    var own = owned(it.id), on = it.id === eq;
    return '<div class="cos-item-v151b r-' + it.rarity + (own ? "" : " locked") + (on ? " on" : "") + '" data-cos="' + escHtml(it.id) + '"' + (own && !on ? ' onclick="cosEquipV151B(\'' + k + "','" + escHtml(it.id) + '\')"' : "") + ">" +
      '<div class="cos-pvbox-v151b" data-pv="' + escHtml(it.id) + '"></div><div class="cos-nm-v151b">' + escHtml(it.name) + "</div>" +
      '<div class="cos-src-v151b">' + (on ? "✓ EQUIPPED" : own ? "TAP TO EQUIP" : "🔒 " + escHtml(howTo(it))) + "</div></div>";
  }
  function creatorBtnV174() { return '<button type="button" class="btn ghost pal-tc-v174" onclick="palCreatorV174()">✏️ School &amp; team name — the Team Creator</button>'; }
  function coloursBodyV174() {
    var now = teamNowV174();
    return '<div class="pal-sub-v174">Uniform colours<small>The uniform you wear, in its own colours or your school\'s.</small></div>' + uniColRowV159A() +
      '<div class="pal-sub-v174">Team palette<small>Your school\'s two colours: the scoreboard, the end zones, and the kit in "Team palette".</small></div>' +
      ((function () { try { var st = gstate(); return st && st.player && st.player.clubV146B; } catch (e) { return false; } })() ? '<div class="cos-note-v161a">Your UFF club wears its own colours while you play for it; a pick here is your school\'s.</div>' : "") +
      teamStyle.barHTML() +
      '<div class="pal-tpg-v174" role="group" aria-label="Team palettes">' + teamPalsV174().map(function (p, i) {
        var on = i === now.pal, own = teamStyle.owned("pal", i);
        return '<button type="button" class="pal-tp-v174' + (on ? " on" : "") + (own ? "" : " locked") + '" data-i="' + i + '" aria-pressed="' + on + '" title="Palette ' + (i + 1) + (own ? "" : " (locked: a free pick or PP)") + '" onclick="palTeamV174(\'pal\',' + i + ')" style="' + pairV174(p[0], p[1]) + '"><small>' + (on ? "✓" : own ? i + 1 : "🔒") + "</small></button>";
      }).join("") + "</div>" + creatorBtnV174();
  }
  function crestBodyV174() {
    var E = emblemsV174(), now = teamNowV174();
    if (!E) return '<div class="cos-note-v161a">The crests are still loading.</div>';
    var h = "";
    for (var i = 0; i < E.db.length; i++) {
      var on = i === now.logo, own = teamStyle.owned("logo", i);
      h += '<button type="button" class="pal-cr-v174' + (on ? " on" : "") + (own ? "" : " locked") + '" data-i="' + i + '" aria-pressed="' + on + '" title="' + escHtml(E.name(i) || "Crest " + (i + 1)) + (own ? "" : " (locked)") + '" onclick="palTeamV174(\'logo\',' + i + ')"><i class="emblem-v44" style="' + escHtml(E.cssFull(i)) + '"></i>' + (on ? "<small>✓</small>" : own ? "" : "<small>🔒</small>") + "</button>";
    }
    return '<div class="pal-sub-v174">Team crest<small>On the helmet, the card and the scoreboard. Picking one keeps your colours.</small></div>' + teamStyle.barHTML() + '<div class="pal-crg-v174" role="group" aria-label="Team crests">' + h + "</div>" + creatorBtnV174();
  }
  function secBodyV174(k) {
    if (k === "colours") return coloursBodyV174();
    if (k === "crest") return crestBodyV174();
    var eq = equipped(k), list = ITEMS.filter(function (it) { return it.cat === k && listed(it); });
    return (k === "uniform" ? uniColRowV159A() : "") +   // v159 A: the uniform's own colours or the team palette, beside the uniforms as before
      (k === "celebration" && onV161A() ? '<div class="cos-note-v161a">🎲 On every touchdown he picks one of three moves at random — the flex, the backflip or the ball spike. The effect you equip plays around him.</div>' : "") +
      '<div class="cos-grid-v151b">' + list.map(function (it) { return itemHTMLV174(it, k, eq); }).join("") + "</div>";
  }
  function secHTMLV174(k) {
    var open = SEL.cat === k;
    return '<section class="pal-sec-v174' + (open ? " on" : "") + '" data-pal-sec="' + k + '">' + secHeadV174(k) + (open ? '<div class="pal-body-v174">' + secBodyV174(k) + "</div>" : "") + "</section>";
  }
  function paletteHTMLV174() {
    V174.renders++;
    if (SEL.cat && !isSecV174(SEL.cat)) SEL.cat = "uniform";
    cntV174 = countsV174();
    try { return paletteInnerV174(); } finally { cntV174 = null; }
  }
  function paletteInnerV174() {
    return '<div class="cos-style-v151b pal-v174" data-cat="' + (SEL.cat || "") + '">' +
      '<div class="h2 cos-h-v151b pal-h-v174">🎨 The Palette <span>looks only · never changes a number</span></div>' +
      '<div class="pal-lede-v174">Uniform, colours, celebration, banner — everything he wears, in one place. Open a section, tap a look to wear it.</div>' +
      '<div class="pal-live-v174" aria-label="Your look"></div>' +
      groupsV174().map(function (g) { return '<div class="pal-grp-v174" data-grp="' + g.k + '"><div class="pal-gh-v174">' + g.name + "<span>" + g.note + "</span></div>" + g.secs.map(secHTMLV174).join("") + "</div>"; }).join("") +
      "</div>";
  }
  /* the Locker's STYLE tab (07's cosStyleBlockV151B → API.stylePanel) and every re-render below come through here */
  stylePanel = function () {
    if (!onV174()) { if (!CATS[SEL.cat]) SEL.cat = "uniform"; return stylePanelOldV174(); }
    return paletteHTMLV174();
  };

  /* ---- drawing what the markup cannot: the row previews and the live card ----
   * Nothing is drawn while the palette is hidden (the Locker's GEAR tab) or before the v75 sectioner has split the
   * screen (it waits for 90 ms without a mutation — painting first held the tab strip back a second). The card first,
   * then each row's preview as it scrolls into view (an IntersectionObserver): a celebration's mini-stage, an aura,
   * a banner painter are paid for when he can see them, not all eighteen on the way in. */
  var IO_V174 = null;
  function rowPaintV174(b) { if (!b || b.__pv) return; b.__pv = 1; try { var it = findItem(b.getAttribute("data-pv174")); if (it) previewInto(b, it); V174.rowPv = (V174.rowPv || 0) + 1; } catch (e) { V174.errs++; } }
  function ioV174() {
    if (IO_V174 || typeof IntersectionObserver !== "function") return IO_V174;
    IO_V174 = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { IO_V174.unobserve(e.target); rowPaintV174(e.target); } }); }, { rootMargin: "160px 0px" });
    return IO_V174;
  }
  function settledV174(root) {
    if (!root.getClientRects().length) return false;   // a hidden tab: nothing to draw
    var sc = document.getElementById("screen"), H = window.__HUB_V75, st = gstate(), v = st && st.view;
    if (!sc || !sc.contains(root) || !H || !H.views || !H.views[v] || sc.querySelector(":scope > .hubv75-tabs")) return true;
    if (!root.__seen) root.__seen = Date.now();
    return Date.now() - root.__seen > 900;   // a screen the sectioner never splits still gets drawn
  }
  function paintV174(root) {
    root = root || document.querySelector(".pal-v174"); if (!root || !settledV174(root)) return;
    try {
      var live = root.querySelector(".pal-live-v174");
      if (live && !live.__drawn) { live.__drawn = 1; renderCard(null, { el: live, compact: true }); }
      if (TUv("v174rowPv", 1)) {
        var io = ioV174();
        root.querySelectorAll("[data-pv174]").forEach(function (b) { if (b.__pv || b.__io) return; if (io) { b.__io = 1; io.observe(b); } else rowPaintV174(b); });
      }
      paintPreviews(root);
      var P = V174.pend;
      if (P) { if (jumpV174(P.k)) P.n++; if (P.n >= 2 || Date.now() - P.t > 5000) V174.pend = null; }
    } catch (e) { V174.errs++; }
  }
  setInterval(function () { if (document.querySelector(".pal-v174")) paintV174(); }, 300);
  function scrollerV174(el) {
    for (var p = el && el.parentElement; p && p !== document.body; p = p.parentElement) {
      var oy = getComputedStyle(p).overflowY; if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight + 2) return p;
    }
    return document.scrollingElement || document.documentElement;
  }
  /* bring a section's row to the top of whatever scrolls it (never scrollIntoView: it would scroll the shell's frame too) */
  function jumpV174(k) {
    var h = document.querySelector('.pal-v174 [data-pal-sec="' + k + '"]'); if (!h || !h.getClientRects().length) return false;
    var sc = scrollerV174(h), top = h.getBoundingClientRect().top - (sc === document.scrollingElement ? 0 : sc.getBoundingClientRect().top), pad = 6;
    [].forEach.call(sc.children || [], function (c) {   // a sticky bar riding the scroller's top (v170's section bar, the v75 tab strip) covers what sits under it
      var cs = getComputedStyle(c); if (cs.position === "sticky" && c.getClientRects().length) pad = Math.max(pad, c.offsetHeight + (parseFloat(cs.top) || 0) + 6);
    });
    sc.scrollTop = Math.max(0, sc.scrollTop + top - pad); V174.jumps++; return true;
  }
  function keepScrollV174(y) {
    [0, 160, 520].forEach(function (ms) { setTimeout(function () { var r = document.querySelector(".pal-v174"); if (!r) return; var sc = scrollerV174(r); if (sc && Math.abs(sc.scrollTop - y) > 2) sc.scrollTop = y; }, ms); });
  }
  function swapSecV174(k) {
    var n = document.querySelector('.pal-v174 [data-pal-sec="' + k + '"]'); if (!n) return;
    if (IO_V174) n.querySelectorAll("[data-pv174]").forEach(function (b) { IO_V174.unobserve(b); });
    n.outerHTML = secHTMLV174(k);
  }
  function liveV174() { var l = document.querySelector(".pal-v174 .pal-live-v174"); if (l) l.__drawn = 0; paintV174(); }
  function redrawV174(y) {
    var el = document.querySelector(".cos-style-v151b"); if (!el) return false;
    el.outerHTML = stylePanel(); paintV174();
    if (y != null) keepScrollV174(y);
    return true;
  }
  function openSecV174(k, jump) {
    var prev = SEL.cat; SEL.cat = k;
    if (!document.querySelector(".pal-v174")) { if (!redrawV174()) return false; }
    else { if (prev && prev !== k) swapSecV174(prev); if (k) swapSecV174(k); }
    var root = document.querySelector(".pal-v174"); root.setAttribute("data-cat", k || "");
    if (k && jump) {   // asked for a section while the Locker shows GEAR: show the palette's tab first (the sectioner's own tap)
      var sec = root.closest ? root.closest(".hubv75-sec") : null, tab = sec && !sec.classList.contains("on") ? document.querySelector('.hubv75-tab[data-sec="' + sec.dataset.sec + '"]') : null;
      if (tab) { tab.click(); V174.reveals = (V174.reveals || 0) + 1; }
      try { var H = window.__HUB_V75, st = gstate(); if (H && H.tabs && st && st.view === "locker") H.tabs.locker = "style"; } catch (e) {}   // a screen not split yet opens on it
    }
    V174.swaps++; paintV174(root);
    if (k && jump) jumpV174(k);
    return true;
  }

  /* ---- the taps ---- */
  window.palSecV174 = function (k) { if (!isSecV174(k)) return null; openSecV174(SEL.cat === k ? null : k, SEL.cat !== k); return SEL.cat; };
  window.palCreatorV174 = function () { try { window.openTeamCreatorV153 && window.openTeamCreatorV153(); } catch (e) {} };
  /* a team palette / crest: the Team Creator's save with the other half kept as he wears it — its gate asks for the
   * free pick or the PP exactly as Save Team does, and a "Not now" changes nothing */
  window.palTeamV174 = function (kind, i) {
    i = i | 0;
    var now = teamNowV174(), save = window.saveTeamCreatorV153;
    if ((kind === "logo" ? now.logo : now.pal) === i) return Promise.resolve(true);
    if (typeof save !== "function") return Promise.resolve(false);
    var root = document.querySelector(".pal-v174"), sc = root ? scrollerV174(root) : null, y = sc ? sc.scrollTop : null;
    window.__tempPaletteV153 = kind === "pal" ? i : now.pal;
    window.__tempLogoV153 = kind === "logo" ? i : now.logo;
    var done = function (ok) {
      window.__tempPaletteV153 = null; window.__tempLogoV153 = null;
      V174.team.push({ kind: kind, i: i, ok: !!ok });
      redrawV174(y);
      return !!ok;
    };
    var r; try { r = save(); } catch (e) { return Promise.resolve(done(false)); }
    return Promise.resolve(r).then(done, function () { return done(false); });
  };
  var catOldV174 = window.cosCatV151B;
  window.cosCatV151B = function (c) {
    if (!onV174()) { if (!CATS[SEL.cat]) SEL.cat = "uniform"; return catOldV174(c); }
    if (!isSecV174(c)) return;
    openSecV174(c, true);
  };
  var equipOldV174 = window.cosEquipV151B;
  window.cosEquipV151B = function (slot, id) {
    if (!onV174() || !document.querySelector(".pal-v174")) return equipOldV174(slot, id);
    if (!equip(slot, id)) return false;
    swapSecV174(slot);
    if (slot === "uniform") swapSecV174("helmet"); else if (slot === "helmet") swapSecV174("uniform");   // each one's previews wear the other
    liveV174();
    var it = findItem(id); toast("Equipped: " + (it ? it.name : id)); return true;
  };
  var uniColOldV174 = window.cosUniColV159A;
  window.cosUniColV159A = function (mode) {
    if (!onV174() || !document.querySelector(".pal-v174")) return uniColOldV174(mode);
    var changed = setUniColV159A(mode);
    ["uniform", "colours", "helmet"].forEach(swapSecV174); liveV174();
    if (changed) toast(mode === "team" ? "Uniforms wear the team palette" : "Uniforms wear their own colours");
    return uniColV159A();
  };
  var openStyleOldV174 = window.cosOpenStyleV151B;
  window.cosOpenStyleV151B = function (sec) {
    var at = onV174() && isSecV174(sec) ? sec : null;
    if (at) SEL.cat = at;
    openStyleOldV174();
    if (at) V174.pend = { k: at, t: Date.now(), n: 0 };   // jumped to by the paint tick once the screen is split and drawn (and once more after the shell's "open at the top")
  };
  /* the top bar's 🎨 — the colour palette — opens THE palette on the career screens */
  document.addEventListener("click", function (e) {
    try {
      if (!onV174()) return;
      var b = e.target && e.target.closest ? e.target.closest("#teamCreatorBtnV153") : null;
      if (!b || !viewOkV174()) return;
      e.preventDefault(); e.stopPropagation(); V174.btn++;
      window.cosOpenStyleV151B("colours");
    } catch (x) { V174.errs++; }
  }, true);
  /* the Team Creator links to the palette (a pick not yet saved goes through Save Team first) */
  window.palFromCreatorV174 = function () {
    var dirty = window.__tempPaletteV153 != null || window.__tempLogoV153 != null;
    ["schoolNameV153", "teamNameV153"].forEach(function (id) { var el = document.getElementById(id); if (el && el.value !== el.defaultValue) dirty = true; });
    var go = function (ok) { if (ok === false) return false; try { window.closeTeamCreatorV153 && window.closeTeamCreatorV153(); } catch (e) {} window.cosOpenStyleV151B("uniform"); return true; };
    if (dirty && typeof window.saveTeamCreatorV153 === "function") return Promise.resolve(window.saveTeamCreatorV153()).then(go);
    return Promise.resolve(go(true));
  };
  function creatorLinkV174() {
    try {
      if (!onV174() || !viewOkV174()) return;
      var p = document.querySelector("#teamModalV153 .team-panel-v153"); if (!p || p.querySelector(".pal-link-v174")) return;
      var b = document.createElement("button"); b.type = "button"; b.className = "btn ghost pal-link-v174";
      b.innerHTML = "🎨 Uniform, helmet, celebration, banner &amp; more — <b>The Palette</b>";
      b.onclick = function () { window.palFromCreatorV174(); };
      p.appendChild(b);
    } catch (e) { V174.errs++; }
  }
  try { new MutationObserver(creatorLinkV174).observe(document.body, { childList: true }); } catch (e) {}

  (function () {
    if (document.getElementById("cosV174css")) return;
    var st = document.createElement("style"); st.id = "cosV174css";
    var S = "html.shell-v146 #screen ";
    st.textContent = [
      ".pal-v174{max-width:820px;margin:0 auto;padding:0 0 12px}",
      ".pal-v174 .pal-h-v174{display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 8px;margin:4px 2px 2px}",
      ".pal-v174 .cos-h-v151b span," + S + ".pal-v174 .cos-h-v151b span{font-size:12px!important;margin-left:0;text-transform:uppercase}",
      ".pal-lede-v174{margin:0 2px 8px;font-size:13px;line-height:1.4;color:#b8c4d4}",
      ".pal-live-v174{min-height:120px}.pal-live-v174 .pcard-v151b{margin:2px auto 4px}",
      ".pal-gh-v174{display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 8px;margin:14px 4px 6px;font:700 13px Oswald,sans-serif;letter-spacing:2px;color:#ffd76f}",
      ".pal-gh-v174 span{font:400 12px Oswald,sans-serif;letter-spacing:1px;color:#8fa2bb;text-transform:uppercase}",
      ".pal-sec-v174{margin:0 0 6px;border-radius:14px;border:1px solid rgba(255,255,255,.09);background:linear-gradient(180deg,#0f1722,#0a1018);overflow:hidden}",
      ".pal-sec-v174.on{border-color:rgba(240,187,69,.55);box-shadow:0 0 0 1px rgba(240,187,69,.16) inset}",
      ".pal-v174 .cos-cat-v151b.pal-hd-v174," + S + ".pal-v174 .cos-cat-v151b.pal-hd-v174{display:flex;width:100%;align-items:center;gap:10px;min-height:62px!important;padding:6px 12px 6px 6px;border:0;border-radius:0;background:transparent;color:#eef2f7;text-align:left;font:700 15px Oswald,sans-serif;font-size:15px!important;letter-spacing:0;cursor:pointer}",
      ".pal-v174 .pal-hd-v174:focus-visible{outline:2px solid #ffd76f;outline-offset:-2px}",
      ".pal-v174 .pal-hdpv-v174{flex:none;width:60px;height:50px;border-radius:10px;background:radial-gradient(ellipse at 50% 80%,rgba(255,255,255,.1),rgba(255,255,255,.02) 70%),#121a26;display:grid;place-items:center;overflow:hidden}",
      ".pal-v174 .pal-hdpv-v174>*{transform:scale(.78);transform-origin:50% 50%}",
      ".pal-sw2-v174{flex:none;width:60px;height:50px;border-radius:10px;box-shadow:0 0 0 1px rgba(255,255,255,.2) inset}",
      ".pal-crhd-v174{flex:none;width:60px;height:50px;border-radius:10px;background:#121a26;display:grid;place-items:center;font-size:24px}",
      ".pal-crhd-v174 i.emblem-v44{display:block;width:44px;height:44px}",
      ".pal-hdtx-v174{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}",
      ".pal-hdtx-v174 b{font:700 15px/1.15 Oswald,sans-serif;letter-spacing:1px;color:#eef2f7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".pal-hdtx-v174 b i{font-style:normal;margin-right:6px}",
      ".pal-hdtx-v174 small{font:400 13px/1.2 Oswald,sans-serif;letter-spacing:.3px;color:#a9b7c9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".pal-sec-v174.on .pal-hdtx-v174 b{color:#ffd76f}",
      ".pal-hdn-v174{flex:none;font:600 12px Oswald,sans-serif;font-style:normal;color:#8fa2bb;letter-spacing:.5px}",
      ".pal-chev-v174{flex:none;width:9px;height:9px;margin:0 2px 4px 2px;border-right:2px solid #8fa2bb;border-bottom:2px solid #8fa2bb;transform:rotate(45deg);transition:transform .15s}",
      ".pal-sec-v174.on .pal-chev-v174{transform:rotate(-135deg);margin:4px 2px 0 2px;border-color:#ffd76f}",
      ".pal-body-v174{padding:2px 8px 10px}",
      ".pal-v174 .cos-grid-v151b{grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px}",
      /* the desktop shell squeezes the first list it finds into a scroll box (v146 E fit); in the palette the page
       * itself scrolls, never a section's grid inside it — so the fit moves on to the palette */
      ".pal-v174 .cos-grid-v151b.fill-v146{max-height:none!important;overflow:visible!important}",
      ".pal-v174 .cos-item-v151b{padding:6px 5px 8px}",
      ".pal-v174 .cos-nm-v151b{font-size:13px;margin-top:5px}",
      ".pal-v174 .cos-src-v151b," + S + ".pal-v174 .cos-src-v151b{font-size:12px!important;letter-spacing:.3px!important;line-height:1.25;min-height:30px}",
      ".pal-v174 .cos-unicol-v159a{font-size:13px;margin:4px 0 10px}",
      ".pal-v174 .cos-note-v161a{font-size:13px}",
      ".pal-v174 .ts-bar-v151b{font-size:13px}",
      ".pal-sub-v174{margin:8px 2px 6px;font:700 13px Oswald,sans-serif;letter-spacing:1px;color:#e3e9f1;text-transform:uppercase}",
      ".pal-sub-v174 small{display:block;margin-top:2px;font:400 13px/1.35 Oswald,sans-serif;letter-spacing:.2px;color:#9fb0c6;text-transform:none}",
      ".pal-tpg-v174{display:grid;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:6px;margin:8px 0 10px}",
      ".pal-tp-v174{position:relative;height:46px;min-width:0;padding:0;border-radius:10px;border:2px solid rgba(255,255,255,.14);cursor:pointer}",
      ".pal-tp-v174 small{position:absolute;right:2px;bottom:2px;min-width:18px;padding:0 3px;border-radius:6px;background:rgba(0,0,0,.62);color:#fff;font:700 12px/16px Oswald,sans-serif;text-align:center}",
      ".pal-tp-v174.on{border-color:#f0bb45;box-shadow:0 0 0 2px rgba(240,187,69,.35)}.pal-tp-v174.on small{background:#f0bb45;color:#1b1406}",
      ".pal-tp-v174.locked{opacity:.8}",
      ".pal-crg-v174{display:grid;grid-template-columns:repeat(auto-fill,minmax(58px,1fr));gap:6px;margin:8px 0 10px}",
      ".pal-cr-v174{position:relative;height:60px;min-width:0;padding:0;border-radius:10px;border:2px solid rgba(255,255,255,.1);background:#121a26;display:grid;place-items:center;cursor:pointer}",
      ".pal-cr-v174 i.emblem-v44{display:block;width:46px;height:46px}",
      ".pal-cr-v174 small{position:absolute;right:3px;bottom:1px;font-size:12px;color:#ffd76f}",
      ".pal-cr-v174.on{border-color:#f0bb45;background:#221d10}.pal-cr-v174.locked i{opacity:.5}",
      ".pal-tc-v174,.pal-link-v174{width:100%;margin-top:6px}",
      "@media(prefers-reduced-motion:reduce){.pal-chev-v174{transition:none}}"
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  })();
  window.__V174 = { on: onV174, stats: V174, groups: groupsV174, sections: secsV174, open: function () { return SEL.cat; }, openSec: function (k) { return isSecV174(k) || k === null ? openSecV174(k, true) : false; }, jump: jumpV174, team: function (kind, i) { return window.palTeamV174(kind, i); } };

  /* ---------------- the API ---------------- */
  /* ===== v176 THE NUMBER IS SEWN ON (cosmetics) =====
   * On the field every number is printed into the shirt by src/05 (`sewKeyV176`), on the art's own pixel grid — about
   * one screen pixel per pixel of the drawn man, where a drawn face has no room to be a face. So a number font comes
   * through there as what still reads at that size: its colours (fill and trim), gold and chrome as a foil running
   * light to dark down the numeral, neon as cyan on its magenta glow, a stencil's bridges, a condensed face's narrower
   * numerals. `sewSpecV176(N)` is that spec, set on his marker each frame by `numfontFxV153G`; while the print is on
   * the label is hidden, so `fieldNumV157C` drops the v158 A drawn art on the field by itself. The profile figure, the
   * card and the Locker keep the drawn faces. */
  var SEW_V176 = {};
  function sewSpecV176(N) {
    try {
      if (!N || !N.d) return null;
      var st = N.d.style, F = FACES_V158A[st] || null, t1 = teamCol(0), t2 = teamCol(1), id = (N.id || st || "nf") + "|" + t1 + t2;
      if (SEW_V176[id]) return SEW_V176[id];
      var tc = function (c) { return c === "T1" ? t1 : c === "T2" ? t2 : c; };
      var fill = hexOk(N.d.col) || "#ffffff", trim = hexOk(N.d.stroke) || "#0a0e14", grad = null;
      if (F) {
        if (F.fill && F.fill.t === "flat" && F.fill.c) fill = hexOk(tc(F.fill.c)) || fill;
        if (F.ol && F.ol[0]) trim = hexOk(tc(F.ol[0][0])) || trim;
        if (F.fill && F.fill.t === "gold") grad = ["#fff3b8", "#c58b17"];
        else if (F.fill && F.fill.t === "chrome") grad = ["#ffffff", "#7f8ba0"];
        else if (F.fill && F.fill.t === "camo") grad = ["#9aa35c", "#5d6a33"];
        if (F.glow) trim = hexOk(F.glow) || trim;
      }
      return (SEW_V176[id] = { id: (N.id || st || "nf").replace(/[^a-z0-9]/gi, ""), fill: fill, trim: trim, grad: grad, stencil: !!(F && F.stencil), narrow: !!(F && F.xs && F.xs < 0.8) });
    } catch (e) { return null; }
  }

  /* the profile / card figure's chest: the v159 A print was a smooth face at the screen's resolution laid over a pixel
   * figure. Now the numeral is built at the figure's SOURCE resolution (idle_dn_hi.png's own pixels — the v158 A stroke
   * faces, which need no web font: Block for the team's numbers, the equipped face's full art otherwise), clipped to
   * the shirt's own pixels and shaded by them (`mapsV159A`), and drawn through the very same scaling the body was, so
   * its pixels are the figure's pixels. Placed under the lowest row the facemask reaches, centred on the chest. */
  function chestPixelV176(cv, res, num, nfId, C) {
    if (!TUv("v176chest", 1) || !cv || !cv.getContext || !res || !res.geo || num == null || num === "") return null;
    try {
      var M = mapsV159A(); if (!M) return null;
      var g = res.geo, W = M.W, H = M.H, md = M.dataV176 || (M.dataV176 = M.cv.getContext("2d").getImageData(0, 0, W, H).data);
      var nf = nfOfV157C(nfId), face = nfFaceOfV158A(nf), s = String(num | 0).replace(/[^0-9]/g, "").slice(0, 2); if (!s) return null;
      var want = Math.max(7, Math.round((C.waist - C.neck) * TUv("sewChestHV176", 0.46))), maxW = C.w * TUv("sewChestWV176", 0.78);
      // the numeral at the target ink height (one re-cut once its real ink is measured), held inside the chest's width
      var cut = function (IH) {
        if (face) { var R = nfRenderV158A(face, s, IH); if (!R) return null; var d = R.cv.getContext("2d").getImageData(0, 0, R.w, R.h).data; return { w: R.w, h: R.h, d: d, ih: R.ih, iw: R.iw, ix: R.ix, iy: R.iy, art: 1 }; }
        var mk = nfMaskV158A(FACES_V158A.block, s, IH); if (!mk) return null;
        return { w: mk.w, h: mk.h, m: mk.m, ih: mk.bb[3] - mk.bb[1] + 1, iw: mk.bb[2] - mk.bb[0] + 1, ix: mk.bb[0], iy: mk.bb[1], art: 0 };
      };
      var A = cut(want); if (!A || !A.ih) return null;
      var IH = want * want / A.ih; if (A.iw * (IH / want) > maxW) IH = IH * maxW / (A.iw * IH / want);
      A = cut(Math.max(6, Math.round(IH))); if (!A) return null;
      var K = FIG.last || {}, inkT = inkForV159A(K.j, K.p, K.t), fill = rgb(inkT.fill), Lf = lumOf(fill), Lj = lumHexV159A(hexOk(K.j) || "#1f4fd0");
      var alt = [K.t, K.p].filter(function (h) { return hexOk(h) && Math.abs(lumHexV159A(h) - Lf) > TUv("sewTrimGapV176", 45) && Math.abs(lumHexV159A(h) - Lj) > 30; })[0];
      var trim = rgb(alt || inkT.stroke), tw = face ? 0 : Math.max(1, Math.round(A.ih * TUv("sewChestTrimV176", 0.08)));
      // where it goes: centred on the chest; its top under the first row the shirt runs clean across (the facemask's chin)
      var bw = A.iw + 2 * tw, x0 = Math.round(C.cx + 0.5 - bw / 2) + tw - A.ix, yTop = C.neck;
      for (var y = C.neck; y < C.waist; y++) { var on = 0; for (var x = x0 + A.ix - tw; x < x0 + A.ix + A.iw + tw; x++) if (md[(y * W + x) * 4 + 3]) on++; if (on >= bw * TUv("sewChestClearV176", 0.85)) { yTop = y; break; } }
      var top = Math.max(yTop + tw + 1, Math.round(C.neck + (C.waist - C.neck) * TUv("sewChestRiseV176", 0.3)));
      top = Math.min(top, C.waist - 2 - tw - A.ih);
      var y0 = top - A.iy;
      // the layer at the source's size: only the shirt's pixels, each with the fabric's shade
      var L = document.createElement("canvas"); L.width = W; L.height = H; var lx = L.getContext("2d"), im = lx.createImageData(W, H), o = im.data, kept = 0, hid = 0;
      var paint = function (X, Y, c) {
        if (X < 0 || Y < 0 || X >= W || Y >= H) return;
        var i = (Y * W + X) * 4; if (!md[i + 3]) { hid++; return; }
        var f = Math.max(0.6, Math.min(1.15, 0.35 + 0.65 * md[i] / 100));
        o[i] = Math.min(255, c[0] * f); o[i + 1] = Math.min(255, c[1] * f); o[i + 2] = Math.min(255, c[2] * f); o[i + 3] = 255; kept++;
      };
      var xx, yy, j;
      if (A.art) { for (yy = 0; yy < A.h; yy++) for (xx = 0; xx < A.w; xx++) { j = (yy * A.w + xx) * 4; if (A.d[j + 3] >= 128) paint(x0 + xx, y0 + yy, [A.d[j], A.d[j + 1], A.d[j + 2]]); } }
      else {
        var isF = function (a, b) { return a >= 0 && b >= 0 && a < A.w && b < A.h && A.m[b * A.w + a]; };
        for (yy = -tw; yy < A.h + tw; yy++) for (xx = -tw; xx < A.w + tw; xx++) {
          if (isF(xx, yy)) { paint(x0 + xx, y0 + yy, fill); continue; }
          var near = 0; for (var dy = -tw; dy <= tw && !near; dy++) for (var dx = -tw; dx <= tw; dx++) if (isF(xx + dx, yy + dy)) { near = 1; break; }
          if (near) paint(x0 + xx, y0 + yy, trim);
        }
      }
      if (!kept) return null;
      var x = cv.getContext("2d"), neck = g.neck != null ? g.neck : C.neck, rows = (H - 3) - neck;
      x.save(); x.setTransform(g.dpr || 1, 0, 0, g.dpr || 1, 0, 0); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
      lx.putImageData(im, 0, 0);
      x.drawImage(L, 0, neck, W, rows, g.bx, g.by, g.bw, g.bh);   // the body's own mapping: its pixels are the figure's
      x.restore();
      var r = { num: s, nf: face || "team", v176: true, ih: A.ih, iw: A.iw, top: top, cx: +(x0 + A.ix + A.iw / 2).toFixed(1), chestCx: +C.cx.toFixed(1), clear: yTop, kept: kept, hid: hid, trim: tw };
      window.__V176C = r; return r;
    } catch (e) { return null; }
  }

  /* ===== v177 C THE BOARD THROWS A PARTY (cosmetics) =====
   * What the renderer's jumbotron party (src/05 `v177 C`) borrows from this file: the three drawn bodies (v161 A — their
   * frames in a kit, the pose at t, the loose ball, the dust) and the equipped celebration's plan (v159 C — the item's
   * kind, colours and callout, drawn through the same closed-form painter at any position and scale). HIS moment gets his
   * kit, his helmet and his equipped celebration; anyone else's gets that man's kit with no helmet dressing and a stock
   * plan in the team's colours. Looks only — nothing here reads or writes a sim value, and the seeds are this file's PRNG. */
  var BOARD_V177C = {
    ready: function () { return readyV161A(); },
    load: function () { try { return loadV161A(); } catch (e) { errV161A(e); return false; } },
    anims: function () { return ANIMS_V161A.slice(); },
    pick: function (tok) { return pickV161A(tok); },
    stand: function () { return standV161A(); },
    total: function (name, calm) { return tlV161A(name, !!calm).total; },
    frame: function (name, k) { var M = DATA_V161A.M, A = M && M.anims[name]; return A ? A.frames[k] : null; },
    pose: function (name, t, calm) { return poseV161A(name, t, !!calm); },
    ball: function (name, t, calm) { return ballV161A(name, t, !!calm); },
    parts: function (name, seed, calm) { return partsV161A(name, seed >>> 0, !!calm); },
    drawParts: function (P, t, D) { return drawPartsV161A(P, t, D); },
    // the frames in a kit: HIS (helmet and all), or another man's kit with no helmet of his
    tex: function (scene, name, kitKey, you, tone) {
      var kit = kitV161A(kitKey || "you", tone);
      if (!you) kit = { p1: kit.p1, p2: kit.p2, H: null, tone: kit.tone, key: kit.p1 + kit.p2 + "|-|" + kit.tone };
      return texV161A(scene, name, kit, TUv("v161Ahd", 1) ? 2 : 1);
    },
    // the equipped celebration (his moments only): what the board plays round him
    item: function () { var it = item("celebration"); if (!it) return null; return { id: it.id, name: it.name, kind: celKindV159C(it), cols: celColsV159C(it), say: it.c && it.c.say ? String(it.c.say).toUpperCase().slice(0, 18) : "" }; },
    // a plan: the equipped item's, or a stock kind in the given colours
    plan: function (o) {
      o = o || {}; var it = o.you ? item("celebration") : null, seed = strHashV159C("v177C|" + String(o.tok || "") + "|" + (it ? it.id : o.kind || "stock")) >>> 0;
      var S = it ? planV159C(it, seed, !!o.calm) : buildV159C(o.kind || "confetti", (o.cols && o.cols.length ? o.cols : ["#ffffff"]), seed, !!o.calm);
      if (!it) S.say = "";
      return S;
    },
    // one frame of a plan, centred on (x, y) at u px per plan unit, into a normal and an additive Graphics
    drawPlan: function (S, gN, gA, x, y, u, t) { var V = viewV159C(phaserPainterV159C(gN, gA), x, y, u, u); return drawV159C(S, V, t); },
    rnd: function (seed) { return prng(seed >>> 0); },
    hash: function (s) { return strHashV159C(s); },
    /* v177 I's drawn bodies (moonwalk, the worm, griddy …): HIS equipped one plays on the board too — its frames in his kit,
     * its pose (foot-anchored, with its own travel), its props (the blade, the bow, the phone …) */
    body177: function () { try { if (!onV177I()) return null; var b = bodyOfV177I(item("celebration")); if (!b) return null; if (!readyV177I()) { loadV177I(); return null; } return b; } catch (e) { return null; } },
    total177: function (name, calm) { return tlV177I(name, !!calm).total; },
    pose177: function (name, t, calm) { return poseV177I(name, t, !!calm); },
    frame177: function (name, k) { var A = DATA_V177I.M && DATA_V177I.M.anims[name]; return A ? A.frames[k] : null; },
    tex177: function (scene, name, kitKey, tone) { return texV177I(scene, name, kitV161A(kitKey || "you", tone), TUv("v161Ahd", 1) ? 2 : 1); },
    props177: function (name, t, o, D, calm) { var A = DATA_V177I.M && DATA_V177I.M.anims[name]; if (!A) return 0; return propsV177I(name, t, o, A.frames[o.k], D, !!calm, colsV177I(item("celebration"), name)); }
  };

  var API = {
    version: "v151b", slots: SLOTS.slice(), cats: CATS, achievements: ACH.map(function (a) { return { id: a.id, name: a.name, desc: a.desc }; }),
    member: memberV156C, grandfathered: function (id) { return gfV156C(id); }, superItems: function () { return SUPER_IDS_V156C.slice(); },   // v156 C
    catalog: catalog, owned: owned, grant: grant, grantPack: grantPack, equip: equip, equipped: equipped, packs: packs, onChange: onChange,
    profile: profile, renderCard: renderCard, openProfile: openProfile, passItem: passItem, drawCharacter: drawCharacter, howTo: howTo, listed: listed,
    checkEarned: checkEarned, account: account, teamStyle: teamStyle,
    /* the renderer's and the vault's reads */
    fieldKit: fieldKit, menuColors: menuColors, celebrate: celebrate, stadiumTheme: stadiumTheme, vaultTheme: vaultTheme, vaultTint: vaultTint, vaultDress: vaultDress,
    refreshField: refreshField, stylePanel: stylePanel, paintPreviews: paintPreviews, kitDeco: kitDeco,
    fieldFx: fieldFxV153G, flair: flairV153G, wingArt: wingArtV153G, crownArt: crownArtV153G, cardFlair: cardFlairV153G,   // v153 G
    face: faceV157C, drawFigure: drawFigureV157C, growFigure: growFigureV157C, jerseyNum: jerseyNumV157C, iconRules: function () { return ICON_RULES_V157C.map(function (r) { return { id: r.id, name: r.name, desc: r.desc, rarity: r.rarity }; }); },
    iconAccount: iconAccountV157C, iconTick: iconTickV157C, paintBadge: paintBadgeV157C,   // v157 C
    numRender: nfRenderV158A, paintBanner: V158A.paintBanner, dressCard: dressCardV158A,   // v158 A
    celebratePlay: V159C.play, shelfAlive: shelfV159C,   // v159 C
    numInk: numInkV159A, uniColour: uniColV159A, setUniColour: setUniColV159A,   // v159 A
    celebrateBody: function (scene, cm, opts) { return fieldBodyV161A(scene, cm, opts); },   // v161 A
    boardCel: BOARD_V177C,   // v177 C
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
  /* ===== v177 I TEN NEW CELEBRATIONS =====
   * The owner: "Add 10 more touchdown celebrations, super status." Ten SUPER (mythic, source "super") celebrations, each
   * a drawn BODY of its own plus its own effect, on the same doors as every other celebration:
   *   THE BODIES    MOONWALK (a backward glide on alternating heels, the point, up on his toes), THE WORM (down on the
   *                 grass, a hump that travels him forward, a pop back up), CROWD LEAP (a launch into the stands — the
   *                 crowd's hands come up to catch him), EARTHQUAKE SPIKE (the hop and the slam: the ground splits, three
   *                 shockwaves, rocks, a heavy shake, the ball left planted), GRIDDY (heel kicks on the beat, the arm swing,
   *                 music notes), BOW & ARROW (nock, draw, the arrow flies to a target in the sky that bursts), THE ROBOT
   *                 (stepped poses and tilts on a holo grid, sparks, the visor powers up), NAP TIME (lies down with his head
   *                 on the ball, the Z's and a bubble, wakes with a pop), PHONE CALL (the ball buzzes, he takes the call on
   *                 the ball, a speech bubble, hangs up, takes a bow), LASER DUEL (a blade ignites in his fist: guard, the
   *                 overhead strike with a trail, a clash with a red blade in a shower of sparks, held high).
   *                 Every frame is the owner's drawn art re-posed by scripts/build-celebration-moves.py (cut by v161 A's own
   *                 code — mirror, turn, a lifted foot, the worm's wave, the ball as a pillow — and taken down the same way;
   *                 public/celebrations/cel_v177i*), so on the field it takes his kit (`ribRecolor`), his skin tone and his
   *                 helmet exactly as v161 A's bodies do (`kitV161A`). Each body is a timeline (`PLAN_V177I`: frames, ms,
   *                 travel, arcs under one hop curve, stepped tilts, squash springs, tagged beats) — a pure function of t.
   *   THE PROPS     what he holds and what comes off him (`propsV177I`: the blade, the bow and the arrow's flight and the
   *                 target, the phone's rings and the bubble, the Z's, the glints, the beat rings) are drawn off the
   *                 generator's glove positions, by one painter on the field (Phaser Graphics) and one in the Locker.
   *   THE EFFECTS   ten new v159 C kinds (`KINDS_V159C.v177*`): the disco floor, crowd hands, the quake's cracks and rings,
   *                 notes on the beat, the holo box, the night sky… so `celebrate`, `celebratePlay`, `renderAt`, the Locker
   *                 preview and the callout all take them as they take every other celebration.
   *   THE DOORS     `fieldBodyV161A` — the one door `celebrate()` and `RIB_COSMETICS.celebrateBody` go through — plays the
   *                 equipped v177 I body (or a named one: `celebrateBody(scene, cm, {name: "moonwalk"})`); anything else
   *                 is v161 A's three, untouched. The Locker's mini-stage (`pvDrawBodyV161A`) plays the item's own body.
   *   SUPER         three never-resetting SUPER LADDERS (v156 C's section, rib.super.v1, outside the save) pay the thirty
   *                 v177 looks one rung at a time: THE SHOWMAN (touchdowns across his careers → celebrations), THE DYNASTY
   *                 CLOSET (championships at any level → uniforms), THE LONG HAUL (seasons played → banners). Never sold.
   * Reduced motion: one calm pose, the props still, no shake. Kill switch TU v177I 0 (the celebrations play v161 A's
   * bodies and their effects stay). Looks only: nothing here is read by the sim, nothing draws from Math.random.
   * `window.__V177I` is what v177IJKcheck reads. */
  var V177I = (window.__V177I = window.__V177I || { runs: [], active: null, last: null, loads: 0, builds: 0, buildMs: 0, previews: 0, prevFrames: 0, errs: [] });
  function errV177I(e) { try { if (V177I.errs.length < 12) V177I.errs.push(String((e && e.message) || e)); } catch (x) {} }
  function onV177I() { return !!TUv("v177I", 1); }
  var ANIMS_V177I = ["moonwalk", "worm", "leap", "quake", "griddy", "archer", "robot", "nap", "phone", "saber"];
  var STAND_V177I = 44;
  var ITEMS_V177I = [
    { id: "cel_moonwalk", cat: "celebration", name: "Moonwalk", rarity: "mythic", source: "super", blurb: "Glides back on his heels, then the point.", c: { kind: "v177moon", body: "moonwalk", col: ["#e8f4ff", "#b98bff", "#ff5ab4", "#6fd3ff"], say: "SMOOTH" } },
    { id: "cel_worm", cat: "celebration", name: "The Worm", rarity: "mythic", source: "super", blurb: "Down on the grass and wave across it.", c: { kind: "v177worm", body: "worm", col: ["#7cff9b", "#ffd76f", "#ffffff"], say: "GET LOW" } },
    { id: "cel_leap", cat: "celebration", name: "Crowd Leap", rarity: "mythic", source: "super", blurb: "Into the stands — the crowd catches him.", c: { kind: "v177leap", body: "leap", col: ["#ffd76f", "#ff5a5a", "#6fd3ff", "#ffffff"], say: "INTO THE STANDS" } },
    { id: "cel_quake", cat: "celebration", name: "Earthquake Spike", rarity: "mythic", source: "super", blurb: "The slam splits the field.", c: { kind: "v177quake", body: "quake", col: ["#ff7a1a", "#ffd76f", "#5a2a0e"], say: "SEISMIC" } },
    { id: "cel_griddy", cat: "celebration", name: "Heel Clicks", rarity: "mythic", source: "super", blurb: "Heel kicks on the beat.", c: { kind: "v177griddy", body: "griddy", col: ["#ff5ab4", "#6fd3ff", "#ffd76f", "#7cff9b"], say: "HEEL CLICKS!" } /* v188: a generic name — not a named signature dance */ },
    { id: "cel_archer", cat: "celebration", name: "Bow & Arrow", rarity: "mythic", source: "super", blurb: "Draws, aims, and the target in the sky bursts.", c: { kind: "v177arrow", body: "archer", col: ["#ffd76f", "#ff4d6d", "#ffffff"], say: "BULLSEYE" } },
    { id: "cel_robot", cat: "celebration", name: "The Robot", rarity: "mythic", source: "super", blurb: "Stepped, stiff, powered up.", c: { kind: "v177robot", body: "robot", col: ["#18f0ff", "#b9fff8", "#ff3df2"], say: "BEEP BOOP" } },
    { id: "cel_nap", cat: "celebration", name: "Nap Time", rarity: "mythic", source: "super", blurb: "Head on the ball, out like a light.", c: { kind: "v177nap", body: "nap", col: ["#fff3c4", "#9fb8ff", "#ffffff"], say: "NAP TIME" } },
    { id: "cel_phone", cat: "celebration", name: "Phone Call", rarity: "mythic", source: "super", blurb: "Takes the call on the ball.", c: { kind: "v177phone", body: "phone", col: ["#7cff9b", "#ffffff", "#6fd3ff"], say: "WHO'S NEXT?" } },
    { id: "cel_saber", cat: "celebration", name: "Laser Duel", rarity: "mythic", source: "super", blurb: "A blade ignites — guard, strike, clash.", c: { kind: "v177saber", body: "saber", col: ["#5ff3ff", "#ff3b3b", "#ffffff"], say: "EN GARDE" } }
  ];
  function addItemsV177(list, tag) {
    list.forEach(function (it) {
      if (BY[it.id]) return;
      it.packs = []; it[tag] = 1;
      it.preview = function (el) { return previewInto(el, it); };
      ITEMS.push(it); BY[it.id] = it;
    });
  }
  addItemsV177(ITEMS_V177I, "v177");
  function bodyOfV177I(it) { return it && it.c && it.c.body && ANIMS_V177I.indexOf(it.c.body) >= 0 ? it.c.body : null; }

  /* ---- the art: the generator's manifest, both atlases, both skin masks ---- */
  var DATA_V177I = { M: null, img: {}, skin: {}, sw: {}, state: 0, cbs: [] };
  function loadV177I(cb) {
    if (DATA_V177I.state === 2) { if (cb) cb(); return true; }
    if (cb) DATA_V177I.cbs.push(cb);
    if (DATA_V177I.state !== 0) return false;
    DATA_V177I.state = 1; V177I.loads++;
    var need = 5;
    var done = function () { if (--need) return; DATA_V177I.state = 2; DATA_V177I.cbs.splice(0).forEach(function (f) { try { f(); } catch (e) { errV177I(e); } }); };
    var fail = function (e) { DATA_V177I.state = -1; errV177I("load: " + ((e && e.message) || e)); };
    try {
      fetch(assetV161A("celebrations/cel_v177i.json")).then(function (r) { return r.json(); }).then(function (m) { DATA_V177I.M = m; done(); }, fail);
      [1, 2].forEach(function (s) {
        var im = new Image(); im.onload = function () { DATA_V177I.img[s] = im; done(); }; im.onerror = fail; im.src = assetV161A("celebrations/cel_v177i_" + s + "x.png");
        var sk = new Image(); sk.onload = function () {
          try { var c = document.createElement("canvas"); c.width = sk.width; c.height = sk.height; var x = c.getContext("2d"); x.drawImage(sk, 0, 0);
            var d = x.getImageData(0, 0, sk.width, sk.height).data, m = new Uint8Array(sk.width * sk.height); for (var i = 0; i < m.length; i++) m[i] = d[i * 4] > 127 ? 1 : 0;
            DATA_V177I.skin[s] = m; DATA_V177I.sw[s] = sk.width; } catch (e) { errV177I(e); }
          done(); };
        sk.onerror = fail; sk.src = assetV161A("celebrations/cel_v177i_skin_" + s + "x.png");
      });
    } catch (e) { fail(e); }
    return false;
  }
  function readyV177I() { return DATA_V177I.state === 2 && !!DATA_V177I.M; }

  /* ---- the timelines: [frame (or frames spread over the segment), ms, {dx travel in body heights (linear; `ez` eased;
   *      `step` all at once), arc (a hop, body heights, one parabola over the segment), rot (deg, held; eased in unless
   *      `step`), sq (a squash spring on entry), tag}] ---- */
  var PLAN_V177I = {
    moonwalk: [[0, 200], [1, 190, { dx: -0.35, tag: "step" }], [2, 190, { dx: -0.35, tag: "step" }], [3, 190, { dx: -0.35, tag: "step", rot: -2 }], [4, 190, { dx: -0.35, tag: "step", rot: -2 }],
      [1, 190, { dx: -0.35, tag: "step" }], [2, 190, { dx: -0.35, tag: "step" }], [5, 260, { tag: "point", sq: 0.06 }], [6, 620, { tag: "toes", arc: 0.05 }], [5, 300, { tag: "hold" }]],
    worm: [[0, 180], [1, 200, { tag: "drop", sq: 0.08 }], [2, 110, { dx: 0.18, tag: "hump" }], [3, 110, { dx: 0.18 }], [4, 110, { dx: 0.18 }], [5, 110, { dx: 0.18 }], [6, 110, { dx: 0.18 }], [7, 110, { dx: 0.18 }],
      [2, 110, { dx: 0.18, tag: "hump" }], [3, 110, { dx: 0.18 }], [4, 110, { dx: 0.18 }], [5, 110, { dx: 0.18 }], [6, 110, { dx: 0.18 }], [7, 110, { dx: 0.18 }], [8, 220, { tag: "push" }], [9, 520, { tag: "pop", arc: 0.14, sq: 0.08 }]],
    leap: [[0, 160], [1, 200, { tag: "load", sq: 0.05 }], [[2, 2, 3, 3, 3, 4, 4, 4, 4, 5], 900, { arc: 1.5, dx: 0.25, ez: 1, tag: "air" }], [5, 220, { tag: "land", sq: 0.14 }], [6, 700, { tag: "hold", sq: 0.04 }]],
    quake: [[0, 160], [1, 140], [2, 260, { tag: "load", sq: 0.05 }], [3, 300, { arc: 0.35, tag: "leap" }], [4, 320, { tag: "impact", sq: 0.12 }], [5, 240, { tag: "ball" }], [6, 300, { tag: "hold" }], [7, 260, { tag: "pound", sq: 0.05 }], [8, 500, { tag: "hold" }]],
    griddy: [[0, 160], [1, 160, { arc: 0.06, tag: "kick" }], [2, 160, { arc: 0.06, tag: "kick" }], [3, 160, { arc: 0.06, tag: "kick" }], [4, 160, { arc: 0.06, tag: "kick" }],
      [1, 160, { arc: 0.06, tag: "kick", dx: 0.06 }], [2, 160, { arc: 0.06, tag: "kick", dx: 0.06 }], [3, 160, { arc: 0.06, tag: "kick", dx: 0.06 }], [4, 160, { arc: 0.06, tag: "kick", dx: 0.06 }],
      [1, 160, { arc: 0.06, tag: "kick", dx: -0.06 }], [2, 160, { arc: 0.06, tag: "kick", dx: -0.06 }], [3, 160, { arc: 0.06, tag: "kick", dx: -0.06 }], [4, 160, { arc: 0.06, tag: "kick", dx: -0.06 }], [5, 520, { tag: "flex", sq: 0.06 }]],
    archer: [[0, 200], [1, 300, { tag: "nock" }], [2, 330, { tag: "draw" }], [3, 420, { tag: "aim" }], [4, 240, { tag: "release", sq: 0.05 }], [4, 500, { tag: "watch" }], [5, 500, { tag: "flex", sq: 0.04 }]],
    robot: [[0, 220, { step: 1 }], [1, 180, { rot: -6, step: 1, tag: "tick" }], [2, 180, { rot: -6, step: 1, tag: "tick" }], [3, 200, { rot: 4, step: 1, tag: "tick" }], [4, 200, { rot: -4, step: 1, tag: "tick" }],
      [5, 180, { dx: 0.15, step: 1, tag: "tick" }], [1, 180, { rot: 8, step: 1, tag: "tick" }], [3, 200, { step: 1, tag: "tick" }], [4, 200, { dx: -0.15, step: 1, tag: "tick" }], [2, 220, { rot: -3, step: 1, tag: "tick" }], [6, 560, { step: 1, tag: "power" }]],
    nap: [[0, 200], [1, 180], [2, 220, { tag: "lie", sq: 0.06 }], [3, 380, { tag: "snore" }], [4, 380], [3, 380], [4, 260], [5, 240, { tag: "wake", sq: 0.06 }], [6, 330, { tag: "pop", arc: 0.15 }]],
    phone: [[0, 200], [0, 260, { tag: "ring" }], [1, 300, { tag: "pickup", sq: 0.04 }], [2, 400, { tag: "chat" }], [3, 380, { tag: "laugh" }], [2, 360, { tag: "chat2" }], [4, 240, { tag: "hangup", sq: 0.04 }], [5, 500, { tag: "bow" }]],
    saber: [[0, 180], [1, 300, { tag: "ignite" }], [3, 320, { tag: "guard" }], [2, 280, { tag: "raise" }], [4, 240, { tag: "strike", sq: 0.08, dx: 0.2, ez: 1 }], [3, 300, { tag: "clash" }],
      [4, 220, { tag: "strike2", dx: 0.1, ez: 1 }], [5, 600, { tag: "victory", sq: 0.04 }]]
  };
  var TLC_V177I = {};
  function tlV177I(name, calm) {
    var key = name + (calm ? "|c" : "") + "|" + TUv("v177Ipace", 1) + "|" + TUv("v161AcalmMs", 1200);
    if (TLC_V177I[key]) return TLC_V177I[key];
    var plan = PLAN_V177I[name] || PLAN_V177I.moonwalk, segs = [], t = 0, x = 0, rot = 0, pace = Math.max(0.3, TUv("v177Ipace", 1)), last = plan[plan.length - 1];
    if (calm) segs.push({ fr: [Array.isArray(last[0]) ? last[0][last[0].length - 1] : last[0]], t0: 0, ms: TUv("v161AcalmMs", 1200), o: { tag: "calm" }, i: 0, x0: 0, x1: 0, r0: 0, r1: 0 });
    else plan.forEach(function (s, i) {
      var o = s[2] || {}, ms = s[1] * pace, x1 = x + (o.dx || 0) * STAND_V177I, r1 = o.rot != null ? o.rot : 0;
      segs.push({ fr: Array.isArray(s[0]) ? s[0] : [s[0]], t0: t, ms: ms, o: o, i: i, x0: x, x1: x1, r0: rot, r1: r1 });
      t += ms; x = x1; rot = r1;
    });
    var T = { name: name, calm: !!calm, segs: segs, total: segs.reduce(function (a, s) { return a + s.ms; }, 0), ev: {}, evs: {}, travel: x, lo: 0, hi: 0 };
    segs.forEach(function (s) { var tg = s.o.tag; if (tg) { if (T.ev[tg] == null) T.ev[tg] = s.t0; (T.evs[tg] = T.evs[tg] || []).push(s.t0); } T.lo = Math.min(T.lo, s.x1); T.hi = Math.max(T.hi, s.x1); });
    return (TLC_V177I[key] = T);
  }
  function segAtV177I(T, t) { var s = T.segs[0]; for (var i = 0; i < T.segs.length; i++) if (t >= T.segs[i].t0) s = T.segs[i]; return s; }
  /* one frame of the body at t: the drawn frame k, travel x and lift (1x px), turn (deg), squash */
  function poseV177I(name, t, calm) {
    var T = tlV177I(name, calm), tt = Math.max(0, Math.min(T.total - 0.01, t)), sg = segAtV177I(T, tt), u = c01V159C((tt - sg.t0) / Math.max(1, sg.ms)), tau = tt - sg.t0, o = sg.o;
    var k = sg.fr[Math.min(sg.fr.length - 1, Math.floor(u * sg.fr.length))];
    var r = { name: name, t: t, k: k, seg: sg.i, tag: o.tag || "", u: u, x: 0, lift: 0, rot: 0, sx: 1, sy: 1, sh: 1 };
    if (calm) return r;
    r.x = o.step ? sg.x1 : sg.x0 + (sg.x1 - sg.x0) * (o.ez ? EZ_V159C.inOutS(u) : u);
    r.rot = o.step ? sg.r1 : sg.r0 + (sg.r1 - sg.r0) * EZ_V159C.inOutS(c01V159C(u * 3));
    if (o.arc) { r.lift = o.arc * STAND_V177I * 4 * u * (1 - u); var st = 0.06 * Math.cos(Math.PI * u) * Math.min(1, o.arc * 2); r.sy = 1 + st; r.sx = 1 - st * 0.6; }
    if (o.sq) { var s = springV161A(o.sq, tau); r.sy *= 1 - s; r.sx *= 1 + s * 0.6; }
    if (!o.step && (o.tag === "hold" || o.tag === "snore" || !o.tag) && tau > 140) r.sy *= 1 + 0.014 * Math.sin((tau - 140) * 2 * Math.PI / 620);
    r.sh = 1 - 0.55 * Math.min(1, r.lift / (0.9 * STAND_V177I));
    return r;
  }
  function framesOfV177I(name) { return readyV177I() && DATA_V177I.M.anims[name] ? DATA_V177I.M.anims[name].frames : null; }

  /* ---- the props: a painter in 1x px about the ground point (x forward, y down; the painter mirrors) ---- */
  function hpV177I(o, hx, hy) {   // a point on the frame (anchor-relative) through the body's squash, turn, travel and lift
    var a = o.rot * Math.PI / 180, x = hx * o.sx, y = hy * o.sy;
    return [o.x + x * Math.cos(a) - y * Math.sin(a), -o.lift + x * Math.sin(a) + y * Math.cos(a)];
  }
  function handV177I(fr, which) {   // "top" the highest glove, "front" the furthest forward, "back" the furthest back, "low"
    var H = fr && fr.hands && fr.hands.length ? fr.hands : [[fr ? (fr.cx - fr.ax) + 8 : 8, fr ? (fr.cy - fr.ay) - 4 : -24]];
    var best = H[0];
    H.forEach(function (h) { if (which === "top" ? h[1] < best[1] : which === "low" ? h[1] > best[1] : which === "back" ? h[0] < best[0] : h[0] > best[0]) best = h; });
    return best;
  }
  function starPtsV177I(x, y, ro, ri, n, ang) { var p = []; for (var i = 0; i < n * 2; i++) { var th = ang + i * Math.PI / n - Math.PI / 2, r = i % 2 ? ri : ro; p.push(x + Math.cos(th) * r, y + Math.sin(th) * r); } return p; }
  function hashV177I(a, b) { return noiseV159C(a | 0, b | 0, 177); }
  function propsV177I(name, t, o, fr, P, calm, C) {
    var T = tlV177I(name, false), ev = T.ev, n = 0, c0 = C[0], c1 = C[1 % C.length], c2 = C[2 % C.length];
    var line = function (x1, y1, x2, y2, w, c, a, add) { if (a > 0.01) { P.line(x1, y1, x2, y2, w, c, Math.min(1, a), add); n++; } };
    var circ = function (x, y, r, c, a, add) { if (a > 0.01 && r > 0.05) { P.circ(x, y, r, c, Math.min(1, a), add); n++; } };
    var poly = function (p, c, a, add) { if (a > 0.01) { P.poly(p, c, Math.min(1, a), add); n++; } };
    var path = function (p, w, c, a, add) { if (a > 0.01) { for (var i = 0; i + 3 < p.length; i += 2) P.line(p[i], p[i + 1], p[i + 2], p[i + 3], w, c, Math.min(1, a), add); n++; } };
    var glint = function (x, y, s, a, c) { poly(starPtsV177I(x, y, s, s * 0.18, 4, 0), c == null ? 0xffffff : c, a, 1); circ(x, y, s * 0.3, 0xffffff, a, 1); };
    var ring = function (x, y, r, w, c, a, add) { var p = []; for (var i = 0; i <= 20; i++) { var th = i / 20 * 6.2832; p.push(x + Math.cos(th) * r, y + Math.sin(th) * r * 0.34); } path(p, w, c, a, add); };
    var since = function (tg) { return ev[tg] == null ? -1 : t - ev[tg]; };
    if (calm) t = T.total - 1;
    var hp = function (h) { return hpV177I(o, h[0], h[1]); };
    if (name === "saber") {
      var tg = o.tag, H = hp(handV177I(fr, "top")), D2R = Math.PI / 180, ang, u = o.u;
      var A = { ignite: -80, guard: -40, raise: -115, clash: -35, victory: -95 + 4 * Math.sin(t / 160) };
      if (tg === "strike") ang = -115 + 140 * EZ_V159C.outX(c01V159C(u / 0.45)); else if (tg === "strike2") ang = -60 + 95 * EZ_V159C.outX(c01V159C(u / 0.45)); else ang = A[tg];
      if (ang == null || t < (ev.ignite || 0)) return n;
      var grow = calm ? 1 : EZ_V159C.outC(c01V159C(since("ignite") / 180)), L = 30 * grow, th = ang * D2R, dx = Math.cos(th), dy = Math.sin(th), fl = 0.88 + 0.12 * Math.sin(t / 23);
      var tip = [H[0] + dx * L, H[1] + dy * L];
      if (!calm && (tg === "strike" || tg === "strike2")) for (var j = 5; j >= 1; j--) { var u2 = c01V159C((u * o.ms - j * 22) / o.ms), a2 = (tg === "strike" ? -115 + 140 * EZ_V159C.outX(c01V159C(u2 / 0.45)) : -60 + 95 * EZ_V159C.outX(c01V159C(u2 / 0.45))) * D2R;
        line(H[0], H[1], H[0] + Math.cos(a2) * L, H[1] + Math.sin(a2) * L, 3.2, c0, 0.13 * (6 - j) / 5, 1); }
      line(H[0], H[1], tip[0], tip[1], 6, c0, 0.22 * fl, 1); line(H[0], H[1], tip[0], tip[1], 3, c0, 0.6 * fl, 1); line(H[0], H[1], tip[0], tip[1], 1.3, 0xffffff, 0.95, 1);
      line(H[0] - dx * 4, H[1] - dy * 4, H[0] + dx * 1.2, H[1] + dy * 1.2, 2.4, 0x3a3f4a, 1, 0); line(H[0] - dx * 3, H[1] - dy * 3, H[0] - dx * 1.5, H[1] - dy * 1.5, 2.6, 0xc9ccd6, 1, 0);
      if (tg === "clash" && !calm) {   // a red blade from the front meets his near the tip: sparks where they cross
        var X = [H[0] + dx * L * 0.82, H[1] + dy * L * 0.82], e0 = [X[0] + 24, X[1] - 16], e1 = [X[0] - 9, X[1] + 6];
        line(e0[0], e0[1], e1[0], e1[1], 6, c1, 0.22, 1); line(e0[0], e0[1], e1[0], e1[1], 3, c1, 0.6, 1); line(e0[0], e0[1], e1[0], e1[1], 1.2, 0xffffff, 0.9, 1);
        var wi = Math.floor(t / 45); circ(X[0], X[1], 5 + 2 * hashV177I(wi, 1), 0xffffff, 0.55, 1);
        for (var q = 0; q < 8; q++) { var aa = hashV177I(wi, q + 3) * 6.2832, ll = 4 + 8 * hashV177I(wi, q + 13); line(X[0], X[1], X[0] + Math.cos(aa) * ll, X[1] + Math.sin(aa) * ll, 0.9, q % 2 ? 0xfff3c4 : c0, 0.9, 1); }
      }
    } else if (name === "archer") {
      var tg2 = o.tag, aim = -32 * Math.PI / 180, ax = Math.cos(aim), ay = Math.sin(aim), nx = Math.cos(aim + Math.PI / 2), ny = Math.sin(aim + Math.PI / 2);
      var F = hp(handV177I(fr, "front")), B = hp(handV177I(fr, "back")), has = tg2 === "nock" || tg2 === "draw" || tg2 === "aim" || tg2 === "release" || tg2 === "watch";
      if (has) {
        var drawn = tg2 === "draw" || tg2 === "aim", bow = [];
        for (var s = -1; s <= 1.001; s += 1 / 3) bow.push(F[0] + nx * s * 13 + ax * (1 - s * s) * 4, F[1] + ny * s * 13 + ay * (1 - s * s) * 4);
        path(bow, 2.2, 0x3a2410, 1, 0); path(bow, 1.2, 0x9a6a32, 1, 0);
        var t1 = [bow[0], bow[1]], t2 = [bow[bow.length - 2], bow[bow.length - 1]], N = drawn ? B : [F[0] - ax * 1, F[1] - ay * 1];
        line(t1[0], t1[1], N[0], N[1], 0.6, 0xf0f0f0, 0.9, 0); line(N[0], N[1], t2[0], t2[1], 0.6, 0xf0f0f0, 0.9, 0);
        if (tg2 !== "release" && tg2 !== "watch") {   // the arrow, nocked
          var e = [N[0] + ax * 22, N[1] + ay * 22];
          line(N[0], N[1], e[0], e[1], 1, 0xe8d8b0, 1, 0); poly([e[0] + ax * 3, e[1] + ay * 3, e[0] - nx * 1.6, e[1] - ny * 1.6, e[0] + nx * 1.6, e[1] + ny * 1.6], 0xc9ccd6, 1, 0);
          line(N[0], N[1], N[0] - ax * 3 + nx * 1.8, N[1] - ay * 3 + ny * 1.8, 0.9, c1, 1, 0); line(N[0], N[1], N[0] - ax * 3 - nx * 1.8, N[1] - ay * 3 - ny * 1.8, 0.9, c1, 1, 0);
          if (tg2 === "aim" && !calm) glint(e[0] + ax * 3, e[1] + ay * 3, 3 + Math.sin(t / 60), 0.7, c0);
        }
      }
      var tr = since("release"), FL = 520, S0 = [F[0] + ax * 16, F[1] + ay * 16], v = 0.42;
      if (!calm && tr >= 0 && tr < FL) { var p = [S0[0] + ax * v * tr, S0[1] + ay * v * tr]; line(p[0] - ax * 18, p[1] - ay * 18, p[0], p[1], 2.2, c0, 0.5, 1); line(p[0] - ax * 9, p[1] - ay * 9, p[0], p[1], 1, 0xffffff, 1, 1); }
      var tgt = [S0[0] + ax * v * FL, S0[1] + ay * v * FL], ta = since("nock");   // the target in the sky: it pops in, is hit, bursts
      if (!calm && ta >= 0) {
        var pin = EZ_V159C.outB(c01V159C(ta / 300)), hit = tr - FL, gone = hit > 0 ? c01V159C(hit / 380) : 0, sc = pin * (1 + 0.5 * gone), al = 1 - gone;
        [[9, 0xffffff], [7, c1], [5, 0xffffff], [3, c1], [1.4, c0]].forEach(function (rg) { circ(tgt[0], tgt[1], rg[0] * sc, rg[1], 0.95 * al, 0); });
        if (hit >= 0 && hit < 520) { var hp2 = hit / 520; circ(tgt[0], tgt[1], 8 + 26 * EZ_V159C.outC(hp2), c0, 0.4 * (1 - hp2), 1);
          for (var r2 = 0; r2 < 10; r2++) { var th2 = r2 * 0.6283, l1 = 6 + 30 * EZ_V159C.outC(hp2); line(tgt[0] + Math.cos(th2) * l1 * 0.5, tgt[1] + Math.sin(th2) * l1 * 0.5, tgt[0] + Math.cos(th2) * l1, tgt[1] + Math.sin(th2) * l1, 1.4, r2 % 2 ? 0xffffff : c0, 1 - hp2, 1); }
          ring(tgt[0], tgt[1], 10 + 40 * EZ_V159C.outC(hp2), 1.6, 0xffffff, 0.8 * (1 - hp2), 1); }
      }
    } else if (name === "phone") {
      var tg3 = o.tag, lo = hp(handV177I(fr, "low")), hi = hp(handV177I(fr, "top")), hm = hp([fr.helm[0], fr.helm[1]]);
      if (tg3 === "ring" && !calm) { var bz = Math.floor(t / 70) % 2 ? 1 : -1; for (var s3 = -1; s3 <= 1; s3 += 2) { var cx = lo[0] + s3 * 7; path([cx, lo[1] - 4, cx + s3 * 2 * bz, lo[1] - 1, cx, lo[1] + 2, cx + s3 * 2 * bz, lo[1] + 5], 1, 0xffffff, 0.95, 0); } }
      if ((tg3 === "pickup" || tg3 === "chat" || tg3 === "laugh" || tg3 === "chat2") && !calm) {
        for (var w = 0; w < 3; w++) { var rr = 5 + ((t / 9 + w * 7) % 21), aw = 1 - rr / 26, pts = []; for (var i2 = 0; i2 <= 8; i2++) { var th3 = (-160 + i2 * 12) * Math.PI / 180; pts.push(hi[0] + Math.cos(th3) * rr, hi[1] + Math.sin(th3) * rr); } path(pts, 1.1, c0, 0.9 * aw, 1); }
      }
      if (tg3 === "chat" || tg3 === "laugh" || tg3 === "chat2") {
        var bx = hm[0] + 15, by = hm[1] - 16, pop = calm ? 1 : EZ_V159C.outB(c01V159C(o.u * o.ms / 160));
        P.ell(bx, by, 11 * pop, 7 * pop, 0, 0x0b0f16, 0.9, 0); P.ell(bx, by, 10 * pop, 6 * pop, 0, 0xffffff, 0.97, 0); poly([bx - 6 * pop, by + 4 * pop, bx - 2 * pop, by + 5 * pop, hm[0] + 6, hm[1] - 7], 0xffffff, 0.97, 0); n += 2;
        if (tg3 === "laugh") { var sx = bx - 5, sy = by - 2.5; [[sx, sy, sx, sy + 5], [sx + 3, sy, sx + 3, sy + 5], [sx, sy + 2.5, sx + 3, sy + 2.5], [sx + 5, sy + 5, sx + 6.5, sy], [sx + 6.5, sy, sx + 8, sy + 5], [sx + 5.6, sy + 3, sx + 7.4, sy + 3]].forEach(function (L) { line(L[0], L[1], L[2], L[3], 1, 0x141a24, 1, 0); }); }
        else for (var d3 = 0; d3 < 3; d3++) circ(bx - 4 + d3 * 4, by - 1.5 * Math.max(0, Math.sin(t / 110 - d3 * 0.9)), 1.3, 0x141a24, 1, 0);
      }
      if (tg3 === "hangup" && !calm) glint(lo[0], lo[1] - 2, 5 * (1 - o.u), 1, c0);
    } else if (name === "nap") {
      var hz = hp([fr.helm[0], fr.helm[1]]), tsn = ev.snore, twk = ev.wake;
      if (t >= tsn && t < twk) {
        for (var z = 0; z < 3; z++) { var pz = calm ? 0.35 + z * 0.25 : ((t - tsn) / 1000 + z / 3) % 1, s4 = 2.2 + pz * 4, zx = hz[0] + 5 + pz * 14 + Math.sin(pz * 6) * 2, zy = hz[1] - 8 - pz * 28, az = calm ? 0.9 : Math.sin(Math.PI * pz);
          var zp = [zx - s4, zy - s4, zx + s4, zy - s4, zx - s4, zy + s4, zx + s4, zy + s4]; path(zp, 2.4, 0x0b0f16, 0.5 * az, 0); path(zp, 1.1, 0xffffff, az, 0); }
        var br = calm ? 3 : 2 + 3.2 * (0.5 + 0.5 * Math.sin((t - tsn) / 260));
        circ(hz[0] + 9, hz[1] + 1 - br, br, 0x9fd8ff, 0.35, 0); P.ell(hz[0] + 9, hz[1] + 1 - br, br, br, 0.7, 0xffffff, 0.85, 0); n++;
      }
      var pw = t - twk; if (!calm && pw >= 0 && pw < 260) { var pp = pw / 260; ring(hz[0] + 9, hz[1] - 4, 3 + 9 * pp, 1, 0xffffff, 1 - pp, 1); for (var dd = 0; dd < 5; dd++) { var th4 = dd * 1.2566; circ(hz[0] + 9 + Math.cos(th4) * 10 * pp, hz[1] - 4 + Math.sin(th4) * 8 * pp, 0.9, 0x9fd8ff, 1 - pp, 0); } }
    } else if (name === "moonwalk") {
      if (!calm) (T.evs.step || []).forEach(function (ts, i) { var d = t - ts; if (d < 0 || d > 260) return; var pp = d / 260, fx = o.x + (i % 2 ? -6 : 6);
        glint(fx, -1, 4.5 * Math.sin(Math.PI * pp), 1, c0); circ(fx, 0, 3 + 5 * pp, c1, 0.25 * (1 - pp), 1); });
      if (o.tag === "point" || o.tag === "toes" || o.tag === "hold" || calm) { var tp = hp(handV177I(fr, "top")), sp = calm ? 4 : 3.5 + 2 * Math.sin(t / 120); poly(starPtsV177I(tp[0], tp[1] - 2, sp, sp * 0.22, 4, t / 300), 0xffffff, 0.95, 1); circ(tp[0], tp[1] - 2, sp * 1.6, c1, 0.25, 1); }
      if (!calm && o.x < 0) for (var g = 1; g <= 3; g++) circ(o.x + g * 9, -22, 1.2, c0, 0.25 * (4 - g) / 3 * (0.6 + 0.4 * Math.sin(t / 50 + g)), 1);
    } else if (name === "griddy") {
      if (!calm) (T.evs.kick || []).forEach(function (ts, i) { var d = t - ts; if (d < 0 || d > 280) return; var pp = d / 280, fx = o.x + (i % 2 ? 5 : -5);
        ring(fx, 0, 3 + 12 * EZ_V159C.outC(pp), 1.4, C[i % C.length], 1 - pp, 1); circ(fx, -1, 2.2 * (1 - pp), 0xffffff, 0.8 * (1 - pp), 1); });
    } else if (name === "robot") {
      var tk = o.tag === "tick" ? t - T.segs[o.seg != null ? o.seg : 0].t0 : -1;
      var since0 = t - T.segs.filter(function (s) { return s.t0 <= t; }).slice(-1)[0].t0;
      if (!calm && o.tag === "tick" && since0 < 120) [handV177I(fr, "front"), handV177I(fr, "back")].forEach(function (h, i) { var pz = hp(h), wi2 = Math.floor(t / 40);
        var zz = [pz[0], pz[1]]; for (var q2 = 0; q2 < 3; q2++) zz.push(pz[0] + (i ? -1 : 1) * (3 + q2 * 3), pz[1] - 2 + (hashV177I(wi2, q2 + i * 5) - 0.5) * 6); path(zz, 0.9, c0, 0.9, 1); });
      if (o.tag === "power" || calm) { var hv = hp([fr.helm[0], fr.helm[1] + 2]), fk = calm ? 1 : [1, 0.2, 1, 0.6, 1, 1][Math.min(5, Math.floor(c01V159C(o.u * 3) * 6))];
        line(hv[0] - 6, hv[1], hv[0] + 6, hv[1], 2.6, c0, 0.4 * fk, 1); line(hv[0] - 5, hv[1], hv[0] + 5, hv[1], 1, 0xffffff, 0.95 * fk, 1);
        for (var bp = 0; bp < 3; bp++) if (calm || Math.floor(t / 160 + bp) % 2) P.rect(hv[0] - 5 + bp * 4, hv[1] - 20, 2, 2, C[bp % C.length], 0.9, 1); }
      void tk;
    } else if (name === "quake") {
      var ti = since("ball");
      if (ti >= 0 && P.img) { var fade = c01V159C((T.total - t) / 400); P.img("ball", 3, -2.5, -0.5, fade); n++; }
      if (!calm && ti >= 0) { var gl = 0.5 + 0.5 * Math.sin(t / 90); circ(3, 0, 9, c0, 0.25 * gl * c01V159C((T.total - t) / 400), 1); }
    } else if (name === "worm") {
      if (!calm) T.segs.filter(function (s) { return s.fr[0] === 2 || s.fr[0] === 5; }).forEach(function (s) { var d = t - s.t0; if (d < 0 || d > 420) return; var pp = d / 420;
        for (var q3 = 0; q3 < 3; q3++) circ(o.x + 14 - q3 * 6 - 10 * pp, -1 - 4 * pp, 1.5 + 3 * pp, 0xb8a684, 0.45 * (1 - pp), 0); });
    } else if (name === "leap") {
      var ta2 = since("air");
      if (!calm && ta2 >= 0 && ta2 < 900 && o.lift > 4) for (var sl = 0; sl < 4; sl++) { var lx = o.x - 9 + sl * 6; line(lx, -o.lift + 8 + sl % 2 * 3, lx, -o.lift + 18 + sl % 2 * 3, 1, 0xffffff, 0.35, 1); }
    }
    return n;
  }

  /* ---- his kit on a frame (v161 A's recolour, skin and helmet, on this atlas) ---- */
  function frameCanvasV177I(name, k, scale, kit) {
    var M = DATA_V177I.M, fr = k === "ball" ? null : M.anims[name].frames[k];
    var r = k === "ball" ? (scale === 2 ? M.ball2 : M.ball) : (scale === 2 ? fr.r2 : fr.r), w = r[2], h = r[3];
    var cv = document.createElement("canvas"); cv.width = w; cv.height = h; var x = cv.getContext("2d"); x.drawImage(DATA_V177I.img[scale], r[0], r[1], w, h, 0, 0, w, h);
    if (k === "ball" || !kit) return cv;
    var src = x.getImageData(0, 0, w, h).data, F = window.__V161A_FIELD, out = F && F.recolor ? F.recolor(cv, kit.p1, kit.p2) : cv;
    var ox = out.getContext("2d"), img = ox.getImageData(0, 0, w, h), d = img.data, sk = DATA_V177I.skin[scale], sw = DATA_V177I.sw[scale], j, i4, L;
    if (sk) { var ls = 0, ln = 0;
      for (j = 0; j < w * h; j++) { if (!sk[(r[1] + ((j / w) | 0)) * sw + r[0] + (j % w)]) continue; i4 = j * 4; if (src[i4 + 3] < 20) continue;
        ls += (Math.max(src[i4], src[i4 + 1], src[i4 + 2]) + Math.min(src[i4], src[i4 + 1], src[i4 + 2])) / 2; ln++; }
      var ref = Math.max(30, ln ? ls / ln : 120), tn = rgb(kit.tone);
      for (j = 0; j < w * h; j++) { if (!sk[(r[1] + ((j / w) | 0)) * sw + r[0] + (j % w)]) continue; i4 = j * 4; if (src[i4 + 3] < 20) continue;
        L = (Math.max(src[i4], src[i4 + 1], src[i4 + 2]) + Math.min(src[i4], src[i4 + 1], src[i4 + 2])) / 2;
        var v = Math.max(40, Math.min(255, 214 * Math.pow(L / ref, 0.8)));
        d[i4] = Math.min(255, tn[0] * v / 255); d[i4 + 1] = Math.min(255, tn[1] * v / 255); d[i4 + 2] = Math.min(255, tn[2] * v / 255); } }
    if (kit.H && hexOk(kit.H.s) && fr.helm) {
      var an = scale === 2 ? fr.a2 : [fr.ax, fr.ay], hx = an[0] + fr.helm[0] * scale, hy = an[1] + fr.helm[1] * scale, rx = fr.helm[2] * scale * 1.06, ry = fr.helm[3] * scale * 1.06;
      var HS = rgb(kit.H.s), HST = hexOk(kit.H.st) ? rgb(kit.H.st) : null;
      for (var yy = Math.max(0, Math.floor(hy - ry)); yy <= Math.min(h - 1, Math.ceil(hy + ry)); yy++) for (var xx = Math.max(0, Math.floor(hx - rx)); xx <= Math.min(w - 1, Math.ceil(hx + rx)); xx++) {
        var ex = (xx + 0.5 - hx) / rx, ey = (yy + 0.5 - hy) / ry; if (ex * ex + ey * ey > 1) continue;
        var q = (yy * w + xx) * 4; if (src[q + 3] < 20) continue;
        var cl = classify(src[q], src[q + 1], src[q + 2]); if (!cl[0]) continue;
        var s2 = Math.min(1.75, Math.max(0.25, cl[1] / (cl[0] === 1 ? 95 : 165))), base = cl[0] === 2 && HST ? HST : HS;
        if (cl[0] === 2 && !HST) s2 = Math.min(1.3, s2);
        d[q] = Math.min(255, base[0] * s2); d[q + 1] = Math.min(255, base[1] * s2); d[q + 2] = Math.min(255, base[2] * s2); }
    }
    ox.putImageData(img, 0, 0);
    return out;
  }
  var TEX_V177I = { n: 0, kits: {}, order: [] };
  function texV177I(scene, name, kit, scale) {
    var id = kit.key + "|" + scale + "|" + name, rec = TEX_V177I.kits[id];
    if (rec && rec.scene === scene && scene.textures.exists(rec.keys[0])) return rec;
    var t0 = performance.now(), pre = "cel177_" + (++TEX_V177I.n) + "_", keys = [], N = DATA_V177I.M.anims[name].frames.length;
    for (var k = 0; k < N; k++) { var key = pre + name + k; try { if (scene.textures.exists(key)) scene.textures.remove(key); scene.textures.addCanvas(key, frameCanvasV177I(name, k, scale, kit)); } catch (e) { errV177I(e); } keys.push(key); }
    var bkey = "cel177_ball" + scale; if (!scene.textures.exists(bkey)) try { scene.textures.addCanvas(bkey, frameCanvasV177I(name, "ball", scale, null)); } catch (e) { errV177I(e); }
    rec = TEX_V177I.kits[id] = { scene: scene, keys: keys, ball: bkey, scale: scale };
    TEX_V177I.order.push(id);
    while (TEX_V177I.order.length > TUv("v177ItexKeep", 4)) { var old = TEX_V177I.kits[TEX_V177I.order.shift()]; if (old) old.keys.forEach(function (kk) { try { if (old.scene.textures.exists(kk)) old.scene.textures.remove(kk); } catch (e) {} }); }
    V177I.builds++; V177I.buildMs = +(performance.now() - t0).toFixed(1);
    return rec;
  }
  function colsV177I(it, name) {
    var c = it && it.c && it.c.body === name ? it.c.col : null;
    if (!c) { var m = ITEMS_V177I.filter(function (x) { return x.c.body === name; })[0]; c = m ? m.c.col : ["#ffffff"]; }
    return c.map(function (h) { return hexIntV159C(hexOk(h) || "#ffffff"); });
  }

  /* ---- the field: HIS marker plays the body (v161 A's run, with this atlas, these timelines and the props) ---- */
  function fieldBodyV177I(scene, cm, opts) {
    opts = opts || {};
    if (!onV177I() || !scene || !scene.add || !scene.events || !cm || !cm.root || !cm.body) return null;
    if (!readyV177I()) { loadV177I(); V177I.notReady = (V177I.notReady || 0) + 1; return null; }
    var name = opts.name; if (!DATA_V177I.M.anims[name]) return null;
    var calm = opts.calm != null ? !!opts.calm : reducedV158A();
    var P = scene.play, tok = opts.tok != null ? String(opts.tok) : P && P.__ballTokenV1514 != null ? String(P.__ballTokenV1514) : String(Math.round((scene.time && scene.time.now) || 0));
    try { if (cm.__v161a && cm.__v161a.alive) cm.__v161a.stop("replaced"); } catch (e) {}
    var scale = TUv("v161Ahd", 1) ? 2 : 1, ks = 1 / scale, kit = kitV161A(cm.kit || cm.team, cm.skinTone), tex = texV177I(scene, name, kit, scale);
    var T = tlV177I(name, calm), A = DATA_V177I.M.anims[name], C = colsV177I(opts.it || item("celebration"), name);
    var ex = cm.dirKey === "sd" || cm.dirKey === "dr" || cm.dirKey === "ur", mir = ex && !cm.flip ? -1 : 1;
    var root = cm.root, body = cm.body, shadow = cm.shadow, fill = cm.fill, sh0 = shadow ? shadow.y : 24, fl0 = fill ? fill.y : 24, shx0 = shadow ? shadow.x : 0, flx0 = fill ? fill.x : 0, last = null;
    var track = function (o) { try { return scene.trackFx ? scene.trackFx(o) : o; } catch (e) { return o; } };
    var g = track(scene.add.graphics()), gA = track(scene.add.graphics()), ball = track(scene.add.image(0, 0, tex.ball).setVisible(false)), gb = scene.ballSpr;
    try { gA.setBlendMode(1); } catch (e) {}
    var nf = cm._nfImgV158A, nfVis = nf ? nf.visible : null, gbVis = gb ? gb.visible : null, cam = scene.cameras && scene.cameras.main;
    var run = { name: name, tok: tok, calm: calm, mir: mir, scale: scale, total: T.total, T: T, t0: performance.now(), hold: null, alive: true, ended: null, play: P, v177: 1,
      frames: 0, seq: [], lifts: [], xs: [], rots: [], props: 0, shake: 0, drawMs: 0, drawMax: 0, ms: [], kit: kit.key, tex: tex.keys[0], v159Skipped: 0, ballShown: 0 };
    var gx = 0, gy = 0, gs = 1, X = function (x) { return gx + mir * x * gs; }, Y = function (y) { return gy + y * gs; }, G = function (add) { return add ? gA : g; };
    var D = {
      line: function (x1, y1, x2, y2, w, c, a, add) { var q = G(add); q.lineStyle(Math.max(0.5, w * gs), c, a); q.lineBetween(X(x1), Y(y1), X(x2), Y(y2)); },
      circ: function (x, y, r, c, a, add) { var q = G(add); q.fillStyle(c, a); q.fillCircle(X(x), Y(y), Math.max(0.4, r * gs)); },
      ell: function (x, y, rx, ry, w, c, a, add) { var q = G(add); if (w > 0) { q.lineStyle(Math.max(0.5, w * gs), c, a); q.strokeEllipse(X(x), Y(y), rx * 2 * gs, ry * 2 * gs, 24); } else { q.fillStyle(c, a); q.fillEllipse(X(x), Y(y), rx * 2 * gs, ry * 2 * gs, 24); } },
      poly: function (p, c, a, add) { var q = G(add); q.fillStyle(c, a); q.beginPath(); q.moveTo(X(p[0]), Y(p[1])); for (var i = 2; i < p.length; i += 2) q.lineTo(X(p[i]), Y(p[i + 1])); q.closePath(); q.fillPath(); },
      rect: function (x, y, w, h, c, a, add) { var q = G(add); q.fillStyle(c, a); q.fillRect(X(x) - (mir < 0 ? w * gs : 0), Y(y), w * gs, h * gs); },
      img: function (key, x, y, rot, a) { ball.setVisible(a > 0.01).setPosition(X(x), Y(y)).setScale(gs * ks).setRotation(mir * rot).setAlpha(a).setDepth((root.depth || 4) + 0.015); run.ballShown++; }
    };
    var tick = function () {
      if (!run.alive) return;
      if (!g.scene || !root.active || !body.active) { stop("cleared"); return; }
      if (scene.play && run.play && scene.play !== run.play) { stop("next play"); return; }
      var t = run.hold != null ? run.hold : performance.now() - run.t0;
      if (t >= T.total) { stop("done"); return; }
      var c0 = performance.now();
      try {
        var bx = root.x, by = root.y, bs = root.scaleY, bob = cm.bob && cm.bob.active ? cm.bob : null, boby = bob ? bob.y : 0;
        if (last && root.x === last.ax && root.y === last.ay && root.scaleY === last.as) { bx = last.bx; by = last.by; bs = last.bs; }
        if (last && bob && bob.y === last.bobAy) boby = last.boby;
        var o = poseV177I(name, t, calm), fr = A.frames[o.k], key = tex.keys[o.k], r = scale === 2 ? fr.r2 : fr.r, an = scale === 2 ? fr.a2 : [fr.ax, fr.ay];
        if (body.texture.key !== key) body.setTexture(key);
        cm.tex = key;
        body.setOrigin(an[0] / r[2], an[1] / r[3]); body.setPosition(mir * o.x, 22);
        body.setScale(mir * ks * o.sx, ks * o.sy); body.setRotation(mir * o.rot * Math.PI / 180); body.setFlipX(false); body.setAlpha(1); body.setVisible(true);
        root.setPosition(bx, by - o.lift * bs);
        if (shadow) { shadow.y = sh0 + o.lift; shadow.x = shx0 + mir * o.x; shadow.setScale(o.sh); } if (fill) { fill.y = fl0 + o.lift; fill.x = flx0 + mir * o.x; fill.setScale(o.sh); }
        if (cm.label) cm.label.setVisible(false); if (cm.skin) cm.skin.setVisible(false); if (nf) nf.setVisible(false); if (gb && gb.active !== false) gb.setVisible(false);
        if (cm.sew && cm.sew.visible) cm.sew.setVisible(false);   // v176's printed number belongs to his own cells, not to these frames (src/05 re-prints it next placeMarker)
        if (bob) bob.y = boby - o.lift * bs;
        last = { ax: root.x, ay: root.y, as: root.scaleY, bx: bx, by: by, bs: bs, boby: boby, bobAy: bob ? bob.y : null };
        gx = bx; gy = by + 22 * bs; gs = bs; g.clear(); gA.clear(); g.setDepth((root.depth || 4) + 0.02); gA.setDepth((root.depth || 4) + 0.04);
        var drew = propsV177I(name, t, o, fr, D, calm, C); run.props = Math.max(run.props, drew);
        if (!(name === "quake" && t >= (T.ev.ball || 1e9))) ball.setVisible(false);
        var sg = segAtV177I(T, t);
        if (!calm && cam && sg.i !== run.lastSeg && TUv("v161Ashake", 1)) {
          var k2 = sg.o.tag === "impact" ? 1.5 : sg.o.tag === "land" ? 0.5 : sg.o.tag === "drop" ? 0.25 : 0;
          if (k2) try { cam.shake(TUv("v161AshakeMs", 130) * (k2 > 1 ? 1.8 : 1), 0.0042 * k2 * TUv("v161Ashake", 1)); run.shake++; } catch (e) {} }
        run.lastSeg = sg.i;
        if (run.seq.length < 600) { run.seq.push({ t: Math.round(t), k: o.k, seg: sg.i }); run.lifts.push(+o.lift.toFixed(2)); run.xs.push(+o.x.toFixed(2)); run.rots.push(+o.rot.toFixed(1)); }
      } catch (e) { errV177I(e); }
      var dt = performance.now() - c0; run.frames++; run.drawMs += dt; run.drawMax = Math.max(run.drawMax, dt); if (run.ms.length < 400) run.ms.push(dt);
    };
    var stop = function (why) {
      if (!run.alive) return; run.alive = false; run.ended = why || "done";
      try { scene.events.off("postupdate", tick); } catch (e) {}
      try {
        if (root.active && last) root.setPosition(last.bx, last.by);
        if (last && cm.bob && cm.bob.active && last.bobAy != null && cm.bob.y === last.bobAy) cm.bob.y = last.boby;
        if (body.active) { body.setOrigin(0.5, 0.5); body.setPosition(0, 0); body.setScale(1); body.setRotation(0); }
        cm.tex = null;
        if (why === "done" && cm.forceState === "celebrateSeq") cm.forceState = null;
        if (shadow && shadow.active !== false) { shadow.y = sh0; shadow.x = shx0; shadow.setScale(1); } if (fill && fill.active !== false) { fill.y = fl0; fill.x = flx0; fill.setScale(1); }
        if (nf && nf.active !== false && nfVis != null) nf.setVisible(nfVis);
        if (gb && gb.active !== false && gbVis != null) gb.setVisible(gbVis);
      } catch (e) {}
      [g, gA, ball].forEach(function (o) { try { scene.dropFx ? scene.dropFx(o) : o.destroy(); } catch (e) {} });
      if (cm.__v161a === run) cm.__v161a = null;
      if (V177I.active === run) V177I.active = null;
    };
    run.stop = stop; run.setHold = function (t) { run.hold = t == null ? null : +t; };
    cm.__v161a = run; V177I.active = run; V177I.last = run; V177I.runs.push(run); if (V177I.runs.length > 20) V177I.runs.shift();   // cm.__v161a: v159 C's pose stands down for him, as for v161 A
    scene.events.on("postupdate", tick);
    try { scene.events.once("shutdown", function () { stop("shutdown"); }); } catch (e) {}
    tick();
    return run;
  }
  /* the one door: the equipped v177 I body (or a named one); anything else is v161 A's */
  var fieldBody0V177I = fieldBodyV161A;
  fieldBodyV161A = function (scene, cm, opts) {
    try {
      var nm = opts && opts.name, eq = item("celebration"), want = nm ? (ANIMS_V177I.indexOf(nm) >= 0 ? nm : null) : bodyOfV177I(eq);
      if (want && onV177I()) { var r = fieldBodyV177I(scene, cm, Object.assign({}, opts || {}, { name: want, it: opts && opts.it ? opts.it : bodyOfV177I(eq) === want ? eq : null })); if (r) return r; }
    } catch (e) { errV177I(e); }
    return fieldBody0V177I.apply(this, arguments);
  };

  /* ---- the Locker: the item's own body on the v159 C mini-stage ---- */
  var PVC_V177I = {};
  function pvFrameV177I(name, k, kit) {
    var id = kit.key + "|" + name + "|" + k;
    if (!PVC_V177I[id]) { if (Object.keys(PVC_V177I).length > 200) PVC_V177I = {}; PVC_V177I[id] = frameCanvasV177I(name, k, 2, k === "ball" ? null : kit); }
    return PVC_V177I[id];
  }
  function pvDrawBodyV177I(rec, x, t, ox, gyc, calm) {
    var name = bodyOfV177I(rec && rec.it); if (!name || !onV177I()) return null;
    if (!readyV177I()) { loadV177I(); return null; }
    var T = tlV177I(name, calm), o = poseV177I(name, t, calm), A = DATA_V177I.M.anims[name], fr = A.frames[o.k], kit = pvKitV161A(), cv = pvFrameV177I(name, o.k, kit), an = fr.a2;
    var z = TUv("v161ApvPx", 25) / STAND_V177I, ks = 0.5 * z, lk = TUv("v161ApvLift", 0.42), trav = TUv("v177IpvTravel", 0.32), xo = calm ? 0 : (o.x - (T.lo + T.hi) / 2) * trav;
    rec.v177 = { name: name, k: o.k, t: Math.round(t) }; V177I.prevFrames++;
    x.save(); x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; x.imageSmoothingEnabled = true; try { x.imageSmoothingQuality = "high"; } catch (e) {}
    x.translate(ox + xo * z, gyc - o.lift * lk * z); x.rotate(o.rot * Math.PI / 180); x.scale(ks * o.sx, ks * o.sy); x.drawImage(cv, -an[0], -an[1]);
    x.restore();
    var set = function (c, a, add) { x.globalAlpha = a; x.globalCompositeOperation = add ? "lighter" : "source-over"; return cssColV159C(c); };
    var PX = function (v) { return ox + v * z; }, PY = function (v) { return gyc + v * z; };
    var Pc = {
      line: function (x1, y1, x2, y2, w, c, a, add) { x.strokeStyle = set(c, a, add); x.lineWidth = Math.max(0.5, w * z); x.lineCap = "round"; x.beginPath(); x.moveTo(PX(x1), PY(y1)); x.lineTo(PX(x2), PY(y2)); x.stroke(); },
      circ: function (px, py, r, c, a, add) { x.fillStyle = set(c, a, add); x.beginPath(); x.arc(PX(px), PY(py), Math.max(0.4, r * z), 0, 6.2832); x.fill(); },
      ell: function (px, py, rx, ry, w, c, a, add) { var s = set(c, a, add); x.beginPath(); x.ellipse(PX(px), PY(py), Math.max(0.3, rx * z), Math.max(0.3, ry * z), 0, 0, 6.2832); if (w > 0) { x.lineWidth = Math.max(0.5, w * z); x.strokeStyle = s; x.stroke(); } else { x.fillStyle = s; x.fill(); } },
      poly: function (p, c, a, add) { x.fillStyle = set(c, a, add); x.beginPath(); x.moveTo(PX(p[0]), PY(p[1])); for (var i = 2; i < p.length; i += 2) x.lineTo(PX(p[i]), PY(p[i + 1])); x.closePath(); x.fill(); },
      rect: function (px, py, w, h, c, a, add) { x.fillStyle = set(c, a, add); x.fillRect(PX(px), PY(py), w * z, h * z); },
      img: function (key, px, py, rot, a) { var bc = pvFrameV177I(name, "ball", kit); x.save(); x.globalAlpha = a; x.globalCompositeOperation = "source-over"; x.translate(PX(px), PY(py)); x.rotate(rot); x.drawImage(bc, -bc.width * ks / 2, -bc.height * ks / 2, bc.width * ks, bc.height * ks); x.restore(); }
    };
    try { propsV177I(name, t, Object.assign({}, o, { x: xo, lift: o.lift * lk }), fr, Pc, calm, colsV177I(rec.it, name)); } catch (e) { errV177I(e); }
    x.globalAlpha = 1; x.globalCompositeOperation = "source-over";
    return o.sh;
  }
  var pvDrawBody0V177I = pvDrawBodyV161A;
  pvDrawBodyV161A = function (rec, x, t, ox, gyc, calm) {
    if (rec && rec.it && bodyOfV177I(rec.it)) { try { var r = pvDrawBodyV177I(rec, x, t, ox, gyc, calm); if (r != null) return r; } catch (e) { errV177I(e); } }
    return pvDrawBody0V177I.apply(this, arguments);
  };
  // the art loads when he wears one (and on the Locker's first v177 preview)
  setTimeout(function () { try { if (onV177I() && bodyOfV177I(item("celebration"))) loadV177I(); } catch (e) {} }, 3000);
  onChange(function (w) { try { if (w && w.equip === "celebration" && onV177I() && bodyOfV177I(BY[w.id])) loadV177I(); } catch (e) {} });

  /* ---- the effects: ten v159 C kinds (unit space: 0,0 his centre, S.gy the grass; times on the body's own beats) ---- */
  function evV177I(body, tag, S, fb) { if (S && S.calm) return S.T.a; var T = tlV177I(body, false); return T.ev[tag] != null ? T.ev[tag] : fb; }
  KINDS_V159C.v177moon = { pose: "float", g: { ring: 1, flash: 0, antRing: 0 },
    build: function (S) { var T = S.T; S.gather(10, 0, S.hy, 60, 0);
      for (var i = 0; i < S.N(44); i++) S.add({ b: S.R(T.a - 100, T.l - 200), l: S.R(700, 1200), x: S.R(-100, 100), y: S.R(-130, S.gy), vy: -S.R(5, 26), s: S.R(1.6, 3.4), sh: i % 3 ? "glint" : "dot", w: S.R(-2, 2), add: 1, glow: 1, tw: 1, ph: S.R(0, 6.28), c: S.c(i) }); },
    back: function (S, V, t, env) { var I = env * EZ_V159C.outC(c01V159C(t / Math.max(1, S.T.a)));
      V.poly([-10, -340, 10, -340, 62, S.gy, -62, S.gy], S.c(0), 0.1 * I, 1);
      for (var i = -5; i <= 5; i++) for (var j = -1; j <= 1; j++) { var cx = i * 15 + (j & 1 ? 7.5 : 0), cy = S.gy + j * 6, lit = noiseV159C(i + 9, j + 3, Math.floor(t / 220)) > 0.45;
        V.poly([cx - 7, cy, cx, cy - 2.6, cx + 7, cy, cx, cy + 2.6], S.c(i + j + Math.floor(t / 220)), (lit ? 0.55 : 0.16) * I * (1 - Math.abs(i) / 7), 1); } } };
  KINDS_V159C.v177worm = { pose: "jump", g: { ring: 1, flash: 18 },
    build: function (S) { var T = S.T, h0 = evV177I("worm", "hump", S, T.a);
      for (var i = 0; i < S.N(16); i++) S.add({ b: h0 + i * 80, l: S.R(600, 900), x: S.R(-10, 80), y: S.gy, vx: -S.R(10, 40), vy: -S.R(4, 16), k: 1.5, s: S.R(2.5, 4), s1: 2.6, al: 0.45, sh: "puff", c: 0xb8a684, fa: 80 });
      for (var j = 0; j < S.N(24); j++) S.add({ b: h0 + S.R(0, 1200), l: S.R(500, 800), x: S.R(0, 80), y: S.gy - 1, vx: S.R(-60, 40), vy: -S.R(80, 170), g: 420, k: 0.8, a: S.R(0, 6), w: S.R(-10, 10), s: S.R(1.6, 2.6), sh: "quad", c: j % 3 ? 0x3f8a3a : 0x6fbf4a, fa: 30 });
      for (var k = 0; k < S.N(10); k++) S.add({ b: S.R(T.a, T.l), l: 360, x: S.R(-60, 90), y: S.R(-80, 0), s: S.R(3, 5), sh: "glint", c: S.c(k), tw: 1, fa: 20 }); },
    back: function (S, V, t, env) { var I = env * c01V159C(t / Math.max(1, S.T.a)); V.ell(30, S.gy, 90, 16, 0, S.c(0), 0.12 * I, 1); V.ell(30, S.gy, 90, 16, 1.4, S.c(0), 0.4 * I, 1);
      for (var i = 0; i < 4; i++) { var p = ((t / 700) + i / 4) % 1; V.line(-60 + p * 40, S.gy - 10 - i * 5, -40 + p * 40, S.gy - 10 - i * 5, 1.4, 0xffffff, 0.3 * I * Math.sin(Math.PI * p), 1); } } };
  KINDS_V159C.v177leap = { pose: "jump", g: { rays: 10, ring: 1, flash: 24 },
    build: function (S) { var T = S.T, a0 = evV177I("leap", "air", S, T.a);
      for (var i = 0; i < S.N(46); i++) S.add({ b: a0 + S.R(0, 700), l: S.R(1100, 1600), x: S.R(-130, 130), y: -S.R(220, 300), vx: S.R(-20, 20), vy: S.R(40, 90), g: 60, k: 1, a: S.R(0, 6.28), w: S.R(-8, 8), s: S.R(2.5, 4), sh: "quad", fp: 1, fl: S.R(3, 8), fw: S.R(1, 2), ph: S.R(0, 6.28), c: S.c(i) });
      for (var j = 0; j < S.N(20); j++) S.add({ b: S.R(T.a - 100, T.l), l: S.R(120, 220), x: S.R(-150, 150), y: S.R(-200, -60), s: S.R(4, 7), sh: "glint", c: 0xffffff, fa: 10 }); },
    front: function (S, V, t, env) { var a0 = evV177I("leap", "air", S, S.T.a), up = (S.calm ? 1 : EZ_V159C.outB(segV159C(t, a0, a0 + 360))) * env;
      if (up <= 0.01) return;
      for (var i = 0; i < 13; i++) { var bx = -120 + i * 20 + (i % 2 ? 4 : -3), base = S.gy + 34, sw = Math.sin(t / 170 + i * 1.7) * 3, h = (26 + (i % 3) * 7) * up, tx = bx + sw, ty = base - h, dk = i % 3 ? 0x101622 : 0x1c2433;
        V.poly([bx - 3, base, bx + 3, base, tx + 2.2, ty + 2, tx - 2.2, ty + 2], dk, 0.95 * env, 0); V.circ(tx, ty, 3.4, dk, 0.95 * env, 0);
        V.circ(bx, base + 6, 8, dk, 0.95 * env, 0); } } };
  KINDS_V159C.v177quake = { pose: "stomp", g: { ring: 0, flash: 0, antRing: 0 },
    build: function (S) { var T = S.T, im = evV177I("quake", "impact", S, T.a); S.k.im = im;
      for (var i = 0; i < S.N(30); i++) { var th = S.R(-3.0, -0.15), sp = S.R(100, 260); S.add({ b: im + S.R(0, 40), l: S.R(500, 900), x: S.R(-6, 6), y: S.gy - 2, vx: Math.cos(th) * sp, vy: Math.sin(th) * sp, g: 600, k: 0.6, a: S.R(0, 6), w: S.R(-12, 12), s: S.R(2, 4), sh: "quad", c: i % 3 ? 0x4a3420 : 0x6a5038, fa: 10 }); }
      for (var j = 0; j < S.N(14); j++) S.add({ b: im + S.R(0, 80), l: S.R(900, 1300), x: S.R(-40, 40), y: S.gy - 2, vx: S.R(-40, 40), vy: -S.R(20, 60), k: 1.4, s: S.R(4, 6), s1: 3, al: 0.4, sh: "puff", c: 0x8a7a5e, fa: 100 });
      for (var k = 0; k < S.N(18); k++) S.add({ b: im + S.R(60, 600), l: S.R(700, 1100), x: S.R(-60, 60), y: S.gy, vx: S.R(-10, 10), vy: -S.R(30, 80), g: -20, s: 1.2, add: 1, glow: 1, tr: 60, c: S.c(k), fa: 20 });
      S.k.cracks = []; for (var c = 0; c < 11; c++) { var a0 = c / 11 * 6.2832 + S.R(-0.2, 0.2), L = S.R(50, 120); S.k.cracks.push(jagV159C(S, 0, S.gy, Math.cos(a0) * L, S.gy + Math.sin(a0) * L * 0.34, 3, 9)); } },
    back: function (S, V, t, env) { var p = EZ_V159C.outC(segV159C(t, S.k.im, S.k.im + 260)); if (p <= 0) return; var gl = 0.6 + 0.4 * Math.sin(t / 70);
      V.ell(0, S.gy, 26 * p, 8 * p, 0, S.c(0), 0.3 * env * gl, 1);
      S.k.cracks.forEach(function (P) { var n = Math.max(2, Math.round(P.length / 2 * p)) * 2, sub = P.slice(0, n); V.path(sub, 2.6, 0x14100a, 0.65 * env, 0); V.path(sub, 1.2, S.c(0), 0.85 * env * gl, 1); V.path(sub, 0.5, S.c(1), 0.7 * env, 1); }); },
    front: function (S, V, t, env) { for (var k = 0; k < 3; k++) { var t0 = S.k.im + k * 130, p = segV159C(t, t0, t0 + 700); if (p > 0 && p < 1) { var r = 10 + 150 * EZ_V159C.outC(p); V.ell(0, S.gy, r, r * 0.34, 5 * (1 - p) + 0.6, k ? 0xe9dcc0 : S.c(1), (1 - p) * 0.85 * env, 1); } }
      var fp = segV159C(t, S.k.im, S.k.im + 200); if (fp > 0 && fp < 1 && !S.calm) { V.circ(0, S.gy - 8, 30 * (0.5 + fp), 0xffffff, (1 - fp) * 0.6, 1); V.circ(0, S.gy - 8, 60 * (0.5 + fp), S.c(0), (1 - fp) * 0.25, 1); } } };
  KINDS_V159C.v177griddy = { pose: "jump", g: { ring: 0, flash: 0, antRing: 0 },
    build: function (S) { var T = S.T;
      for (var i = 0; i < S.N(26); i++) S.add({ b: T.a + S.R(0, 900), l: S.R(900, 1300), x: S.R(-80, 80), y: -S.R(150, 220), vx: S.R(-15, 15), vy: S.R(30, 70), g: 50, k: 1, a: S.R(0, 6), w: S.R(-8, 8), s: S.R(2.4, 3.6), sh: "quad", fp: 1, fl: S.R(3, 7), fw: 1.5, ph: S.R(0, 6.28), c: S.c(i) });
      for (var j = 0; j < S.N(10); j++) S.add({ b: S.R(T.a, T.l), l: 300, x: S.R(-70, 70), y: S.R(-90, 0), s: S.R(3, 5), sh: "glint", c: S.c(j), tw: 1, fa: 20 }); },
    back: function (S, V, t, env) { var ks = S.calm ? [S.T.a] : tlV177I("griddy", false).evs.kick || [];
      ks.forEach(function (tk, i) { var p = segV159C(t, tk, tk + 320); if (p > 0 && p < 1) V.ell(0, S.gy, 8 + 34 * EZ_V159C.outC(p), (8 + 34 * EZ_V159C.outC(p)) * 0.32, 2 * (1 - p) + 0.4, S.c(i), (1 - p) * 0.8 * env, 1); });
      V.ell(0, S.gy, 46, 14, 0, S.c(Math.floor(t / 160)), 0.12 * env, 1); },
    front: function (S, V, t, env) { var ks = S.calm ? [S.T.a] : tlV177I("griddy", false).evs.kick || [];
      ks.forEach(function (tk, i) { var p = segV159C(t, tk, tk + 1100); if (p <= 0 || p >= 1) return; var x = (i % 2 ? 26 : -26) + Math.sin(p * 9 + i) * 5, y = V.hy - 14 - 46 * p, a = Math.sin(Math.PI * p) * env, c = S.c(i);
        V.ell(x, y, 3, 2.2, 0, c, a, 0); V.line(x + 2.6, y, x + 2.6, y - 9, 1.1, c, a, 0); V.line(x + 2.6, y - 9, x + 6, y - 6, 1.1, c, a, 0);
        if (i % 3 === 0) { V.ell(x + 8, y + 1, 3, 2.2, 0, c, a, 0); V.line(x + 10.6, y + 1, x + 10.6, y - 8, 1.1, c, a, 0); V.line(x + 2.6, y - 9, x + 10.6, y - 8, 1.6, c, a, 0); } }); } };
  KINDS_V159C.v177arrow = { pose: "jump", g: { rays: 8, ring: 1, flash: 0, antRing: 0 },
    build: function (S) { var T = S.T, rl = evV177I("archer", "release", S, T.b);
      for (var i = 0; i < S.N(28); i++) { var th = S.R(0, 6.2832), sp = S.R(60, 150); S.add({ b: rl + 520 + S.R(0, 60), l: S.R(600, 900), x: S.R(-40, 40), y: -S.R(150, 190), vx: Math.cos(th) * sp, vy: Math.sin(th) * sp, k: 2.2, g: 80, a: S.R(0, 6), w: S.R(-6, 6), s: S.R(2.5, 4.5), sh: "star", add: 1, glow: 1, c: S.c(i), fa: 10 }); }
      for (var j = 0; j < S.N(14); j++) S.add({ b: S.R(T.a, rl), l: S.R(500, 800), x: S.R(-60, 60), y: S.R(-60, S.gy), vy: -S.R(20, 50), s: S.R(0.9, 1.6), add: 1, glow: 1, tw: 1, c: S.c(j), ph: S.R(0, 6.28) }); },
    back: function (S, V, t, env) { var rl = evV177I("archer", "release", S, S.T.b), p = segV159C(t, rl - 400, rl), I = env * (0.4 + 0.6 * p);
      V.ell(0, S.gy, 40, 12, 0, S.c(0), 0.14 * I, 1); V.ell(0, S.gy, 40, 12, 1.2, S.c(0), 0.5 * I, 1);
      for (var i = 0; i < 6; i++) { var th = -Math.PI / 2 + (i - 2.5) * 0.22; V.line(Math.cos(th) * 30, S.gy - 30 + Math.sin(th) * 30, Math.cos(th) * 60, S.gy - 30 + Math.sin(th) * 60, 1, S.c(0), 0.18 * I * p, 1); } } };
  KINDS_V159C.v177robot = { pose: "jump8", g: { ring: 0, flash: 0, antRing: 0 },
    build: function (S) { var T = S.T; S.q = 2;
      for (var d = 0; d < 8; d++) for (var k = 0; k < (S.calm ? 1 : 3); k++) { var th = d * 0.7854, sp = 70 + k * 40; S.add({ b: T.a + k * 120, l: 640, x: 0, y: S.hy, vx: Math.cos(th) * sp, vy: Math.sin(th) * sp, g: 40, s: 3, sh: "pix", c: S.c(d + k), fa: 1 }); }
      for (var j = 0; j < S.N(16); j++) S.add({ b: S.R(T.a, T.l), l: 330, x: S.R(-36, 36), y: S.R(-70, S.gy), s: 2, sh: "pix", c: S.c(j), tw: 1, fa: 1 }); },
    back: function (S, V, t, env) { var I = env * EZ_V159C.outC(c01V159C(t / Math.max(1, S.T.a))), x0 = -30, x1 = 30, y0 = V.hy - 34, y1 = S.gy + 2, c = S.c(0);
      V.poly([x0, y0, x1, y0, x1, y1, x0, y1], c, 0.07 * I, 1);
      [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].forEach(function (q) { V.path([q[0] + q[2] * 9, q[1], q[0], q[1], q[0], q[1] + q[3] * 9], 1.6, c, 0.85 * I, 1); });
      var sy = y0 + ((t / 900) % 1) * (y1 - y0); V.line(x0, sy, x1, sy, 1.2, S.c(1), 0.6 * I, 1);
      for (var g = -3; g <= 3; g++) V.line(g * 14, S.gy - 1, g * 22, S.gy + 12, 0.7, c, 0.25 * I, 1); } };
  KINDS_V159C.v177nap = { pose: "float", g: { ring: 0, flash: 0, antRing: 0 },
    build: function (S) { var T = S.T;
      for (var i = 0; i < S.N(34); i++) S.add({ b: S.R(0, T.a + 300), l: T.end, x: S.R(-140, 140), y: S.R(-230, -40), s: S.R(2, 4), sh: i % 4 ? "dot" : "glint", tw: 1, add: 1, glow: i % 4 ? 0 : 1, ph: S.R(0, 6.28), c: i % 3 ? 0xffffff : S.c(1), fa: 200 });
      for (var j = 0; j < S.N(3); j++) { var d = 0.3; S.add({ b: T.a + 300 + j * 420, l: d * 1000, x: S.R(-120, 40), y: S.R(-220, -170), vx: 260, vy: 90, s: 1.3, add: 1, glow: 1, tr: 120, c: 0xffffff }); } },
    back: function (S, V, t, env) { var I = env * EZ_V159C.outC(c01V159C(t / Math.max(1, S.T.a)));
      V.ell(0, S.gy - 70, 170, 120, 0, 0x0a1030, 0.42 * I, 0); V.ell(0, S.gy, 70, 16, 0, S.c(1), 0.12 * I, 1);
      var mx = -70, my = -150; V.circ(mx, my, 26, S.c(0), 0.16 * I, 1); V.circ(mx, my, 13, S.c(0), 0.95 * I, 0); V.circ(mx + 6, my - 4, 11.5, 0x0d1438, 0.92 * I, 0); } };
  KINDS_V159C.v177phone = { pose: "jump", g: { ring: 1, flash: 16 },
    build: function (S) { var T = S.T, pk = evV177I("phone", "pickup", S, T.a);
      for (var i = 0; i < S.N(24); i++) { var th = S.R(-2.8, -0.3), sp = S.R(60, 140); S.add({ b: pk + S.R(0, 900), l: S.R(500, 800), x: S.R(-10, 10), y: S.hy - 20, vx: Math.cos(th) * sp, vy: Math.sin(th) * sp, k: 2, s: S.R(2.5, 4), sh: i % 2 ? "glint" : "star", add: 1, glow: 1, c: S.c(i), fa: 20 }); }
      for (var j = 0; j < S.N(14); j++) S.add({ b: S.R(T.a, T.l), l: S.R(600, 900), x: S.R(-60, 60), y: S.R(-40, S.gy), vy: -S.R(20, 40), s: 2, sh: "pix", c: S.c(j), tw: 1, fa: 30 }); },
    back: function (S, V, t, env) { var I = env * c01V159C(t / Math.max(1, S.T.a)), cy = V.hy - 40;
      for (var i = 0; i < 3; i++) { var on = S.calm || Math.floor(t / 220) % 4 > i; V.arc(0, cy, 8 + i * 8, -2.45, -0.69, 2.2, S.c(0), (on ? 0.85 : 0.18) * I, 1); }
      V.circ(0, cy, 2.4, S.c(0), 0.9 * I, 1); V.ell(0, S.gy, 40, 11, 1.2, S.c(0), 0.4 * I, 1); } };
  KINDS_V159C.v177saber = { pose: "stomp", g: { ring: 1, flash: 0, ringCol: 0 },
    build: function (S) { var T = S.T, cl = evV177I("saber", "clash", S, T.b), s2 = evV177I("saber", "strike", S, T.a);
      [s2 + 100, cl, cl + 200].forEach(function (t0, k) { for (var i = 0; i < S.N(14); i++) { var th = S.R(0, 6.2832), sp = S.R(90, 220); S.add({ b: t0 + S.R(0, 40), l: S.R(250, 450), x: S.R(-8, 8), y: S.hy - 26, vx: Math.cos(th) * sp, vy: Math.sin(th) * sp, k: 2, g: 260, s: S.R(1.2, 2), sh: "streak", add: 1, c: i % 2 ? 0xfff3c4 : S.c(k % 2), fa: 5 }); } });
      for (var j = 0; j < S.N(12); j++) S.add({ b: S.R(T.a, T.l), l: S.R(500, 800), x: S.R(-50, 50), y: S.R(-80, S.gy), vy: -S.R(10, 30), s: S.R(0.9, 1.5), add: 1, glow: 1, tw: 1, c: S.c(0), ph: S.R(0, 6.28) }); },
    back: function (S, V, t, env) { var ig = evV177I("saber", "ignite", S, S.T.a * 0.5), I = env * c01V159C((t - ig) / 200), hum = 0.75 + 0.25 * Math.sin(t / 37);
      V.circ(0, V.hy - 6, 70, 0x05070d, 0.28 * env, 0); V.ell(0, S.gy, 50, 13, 0, S.c(0), 0.2 * I * hum, 1); V.ell(0, S.gy, 26, 7, 0, 0xffffff, 0.1 * I * hum, 1); } };

  /* ---- what the check reads ---- */
  Object.assign(V177I, {
    anims: ANIMS_V177I.slice(), items: function () { return ITEMS_V177I.map(function (it) { return it.id; }); }, load: loadV177I, ready: readyV177I, manifest: function () { return DATA_V177I.M; },
    timeline: function (name, calm) { var T = tlV177I(name, !!calm); return { total: T.total, ev: T.ev, travel: T.travel, segs: T.segs.map(function (s) { return { fr: s.fr.slice(), t0: Math.round(s.t0), ms: Math.round(s.ms), tag: s.o.tag || "" }; }) }; },
    pose: poseV177I, bodyOf: function (id) { return bodyOfV177I(findItem(id)); },
    frameCanvas: function (name, k, scale, kit) { return frameCanvasV177I(name, k, scale || 1, kit ? Object.assign({ H: null, tone: "#bf8a62", key: "chk" }, kit) : null); },
    props: function (name, t, cv) {   // the props of `name` at t onto a canvas (1x px about its centre-bottom): returns how many marks
      var x = cv.getContext("2d"), A = DATA_V177I.M.anims[name], o = poseV177I(name, t, false), fr = A.frames[o.k], z = 2, ox = cv.width / 2, gy = cv.height * 0.8, n = 0;
      var P = { line: function (x1, y1, x2, y2, w, c) { x.strokeStyle = cssColV159C(c); x.lineWidth = w * z; x.beginPath(); x.moveTo(ox + x1 * z, gy + y1 * z); x.lineTo(ox + x2 * z, gy + y2 * z); x.stroke(); },
        circ: function (px, py, r, c) { x.fillStyle = cssColV159C(c); x.beginPath(); x.arc(ox + px * z, gy + py * z, r * z, 0, 6.3); x.fill(); },
        ell: function (px, py, rx, ry, w, c) { x.fillStyle = cssColV159C(c); x.beginPath(); x.ellipse(ox + px * z, gy + py * z, Math.max(0.3, rx * z), Math.max(0.3, ry * z), 0, 0, 6.3); x.fill(); },
        poly: function (p, c) { x.fillStyle = cssColV159C(c); x.beginPath(); x.moveTo(ox + p[0] * z, gy + p[1] * z); for (var i = 2; i < p.length; i += 2) x.lineTo(ox + p[i] * z, gy + p[i + 1] * z); x.fill(); },
        rect: function (px, py, w, h, c) { x.fillStyle = cssColV159C(c); x.fillRect(ox + px * z, gy + py * z, w * z, h * z); }, img: function () { n++; } };
      n += propsV177I(name, t, o, fr, P, false, colsV177I(null, name)); return n; },
    play: function (scene, cm, opts) { return fieldBodyV177I(scene, cm, opts); },
    previewList: function () { return PV_V159C.list.filter(function (r) { return bodyOfV177I(r.it); }).map(function (r) { return { id: r.it.id, body: r.v177 || null, connected: r.cv.isConnected }; }); }
  });
  try { API.celebrateMoves = ANIMS_V177I.slice(); API.celebrateBodyOf = function (id) { return bodyOfV177I(findItem(id)); }; } catch (e) {}

  /* ---- the SUPER LADDERS: the thirty v177 looks, one rung at a time (v156 C's super store, outside the save) ---- */
  var LADDERS_V177I = [
    { id: "showman177", name: "The Showman", icon: "🕺", cat: "celebration", metric: "tds", step: function () { return TUv("superTdStepV177I", 60); },
      items: ["cel_moonwalk", "cel_griddy", "cel_robot", "cel_phone", "cel_worm", "cel_nap", "cel_archer", "cel_saber", "cel_leap", "cel_quake"],
      desc: function (g) { return "Score " + g + " touchdowns across your careers"; } },
    { id: "closet177", name: "The Dynasty Closet", icon: "👕", cat: "uniform", metric: "titles", step: function () { return TUv("superTitleStepV177I", 5); },
      items: ["uni_throwback", "uni_carbon", "uni_digicamo", "uni_bengal", "uni_ice", "uni_tron", "uni_lava", "uni_chrome", "uni_galaxy", "uni_royal"],
      desc: function (g) { return "Win " + g + " championships (any level) across your careers"; } },
    { id: "longhaul177", name: "The Long Haul", icon: "🎌", cat: "banner", metric: "seasons", step: function () { return TUv("superSeasonStepV177I", 15); },
      items: ["ban_sakura", "ban_coderain", "ban_circuit", "ban_abyss", "ban_comets", "ban_floodlights", "ban_prism", "ban_hyperspace", "ban_eclipse", "ban_finale"],
      desc: function (g) { return "Play " + g + " seasons across your careers"; } }
  ];
  function ladderOfV177I(id) { for (var i = 0; i < LADDERS_V177I.length; i++) { var k = LADDERS_V177I[i].items.indexOf(id); if (k >= 0) return { L: LADDERS_V177I[i], k: k, goal: LADDERS_V177I[i].step() * (k + 1) }; } return null; }
  function l177V177I() { var S = sload(); if (!S.l177 || typeof S.l177 !== "object") S.l177 = { best: {}, got: {} }; S.l177.best = S.l177.best || {}; S.l177.got = S.l177.got || {}; return S.l177; }
  function metricsV177I(st) {
    var m = { tds: 0, titles: 0, seasons: 0 };
    try { careersV156C(st).forEach(function (c) { c.rows.forEach(function (r) { if (!r) return; m.seasons++; if (r.champion) m.titles++; m.tds += tdsOf(r.line || r.statLine); }); }); } catch (e) { errV177I(e); }
    return m;
  }
  function ladderTickV177I(st) {
    if (!cosOnV156C()) return [];
    var got = [], ch = false;
    try {
      st = st || gstate(); var L = l177V177I(), m = st ? metricsV177I(st) : null;
      if (m) Object.keys(m).forEach(function (k) { if ((m[k] | 0) > (L.best[k] | 0)) { L.best[k] = m[k] | 0; ch = true; } });
      LADDERS_V177I.forEach(function (lad) { var have = L.best[lad.metric] | 0;
        lad.items.forEach(function (id, k) { if (L.got[id] || have < lad.step() * (k + 1) || !BY[id]) return; L.got[id] = Date.now(); ch = true; grant(id, "super"); got.push(id); }); });
    } catch (e) { errV177I(e); }
    if (ch) ssave();
    V177I.lastLadder = got; return got;
  }
  function ladderRowsV177I() {
    var L = l177V177I();
    return LADDERS_V177I.map(function (lad) {
      var k = 0; while (k < lad.items.length && (L.got[lad.items[k]] || owned(lad.items[k]))) k++;
      var done = k >= lad.items.length, ki = Math.min(k, lad.items.length - 1), id = lad.items[ki], it = BY[id] || {}, g = lad.step() * (ki + 1);
      return { id: lad.id, name: lad.name, icon: lad.icon, desc: lad.desc(g) + " — rung " + (ki + 1) + " of " + lad.items.length + " (a new look every " + lad.step() + ")", goal: g, have: Math.min(g, L.best[lad.metric] | 0),
        done: done, at: done ? L.got[id] || null : null, item: id, itemName: it.name || id, rarity: "mythic", cat: lad.cat, owned: owned(id), positions: null, ladder: true, rung: ki + 1 };
    });
  }
  (function () { var ce = checkEarned; checkEarned = function (st) { var got = ce(st); try { ladderTickV177I(st); } catch (e) {} return got; }; })();
  (function () {
    var R = window.RIB_SUPER; if (!R) return;
    var t0 = R.tick, p0 = R.progress, l0 = R.list;
    R.tick = function (st) { var r = t0.apply(this, arguments); try { var g = ladderTickV177I(st); if (g.length && Array.isArray(r)) r = r.concat(g); } catch (e) {} return r; };
    R.progress = function () { var P = p0.apply(this, arguments) || []; try { if (cosOnV156C()) P = P.concat(ladderRowsV177I()); } catch (e) { errV177I(e); } return P; };
    R.list = function () { var P = l0.apply(this, arguments) || []; try { LADDERS_V177I.forEach(function (lad) { lad.items.forEach(function (id) { P.push({ id: lad.id, item: id, name: lad.name }); }); }); } catch (e) {} return P; };
  })();
  var superDesc0V177I = superDescV156C;
  superDescV156C = function (itemId) { var l = ladderOfV177I(itemId); return l ? l.L.name + " — " + l.L.desc(l.goal) : superDesc0V177I(itemId); };
  Object.assign(V177I, { ladders: function () { return ladderRowsV177I(); }, ladderTick: ladderTickV177I, metrics: metricsV177I, ladderOf: function (id) { var l = ladderOfV177I(id); return l ? { ladder: l.L.id, rung: l.k + 1, goal: l.goal } : null; } });

  /* ===== v177 J TEN NEW UNIFORMS =====
   * The owner: "Add 10 more uniforms, super cool status." Ten SUPER (mythic, source "super") uniforms, each a DESIGN that
   * is drawn wherever the kit is: Liquid Chrome (banded reflections), Lava Crackle (a glowing crack network), Galaxy (a
   * nebula with stars), Carbon Fibre (a twill weave, a red pant stripe), Urban Digital (pixel camo), Snow Tiger (white-tiger
   * stripes), Neon Grid (cyan circuit seams on black), Ice Crystal (faceted frost), Royal Black & Gold (gold yoke and
   * panels, pinstripes) and Throwback '79 (cream, maroon sleeve stripes and collar).
   *   ONE PATTERN, TWO SCALES  `PAT_V177J[pat](X, Y, s, J, T)` in FIELD PIXELS (X from the chest's middle, Y down from the
   *                 collar): the field sprite (kitDeco → `patV153G`, so his textures, his eleven teammates' "off" textures —
   *                 v159 A — and the Locker's sprite preview) and the profile card's figure (`figCell`: the card's art is
   *                 ~3x the field's, the same design laid on the jersey's own pixels and shaded by them, `shadeKit`).
   *   THE NUMBER    every design keeps the chest's middle calm (or a contrast the ink reads on): the jersey's base colour
   *                 decides the ink (v159 A `inkForV159A`: white on the dark ones, the kit's own dark / trim on chrome, ice,
   *                 throwback), and the v176 print sews over the pattern — v177IJKcheck measures the ink against each one.
   *   TEAM PALETTE  v159 A's "Team palette" keeps each design and takes the team's two colours, as every uniform does.
   * Kill switch TU v177J 0 (the designs draw as a plain jersey). Looks only. `window.__V177J`. */
  var V177J = (window.__V177J = window.__V177J || { field: 0, card: 0, errs: [] });
  function errV177J(e) { try { if (V177J.errs.length < 12) V177J.errs.push(String((e && e.message) || e)); } catch (x) {} }
  function onV177J() { return !!TUv("v177J", 1); }
  var ITEMS_V177J = [
    { id: "uni_chrome", cat: "uniform", name: "Liquid Chrome", rarity: "mythic", source: "super", blurb: "Poured metal.", k: { j: "#c3ccd8", p: "#7d8796", t: "#ffffff", pat: "chrome" } },
    { id: "uni_lava", cat: "uniform", name: "Lava Crackle", rarity: "mythic", source: "super", blurb: "Cooling rock, still glowing.", k: { j: "#221714", p: "#2e1c16", t: "#ff6a1a", pat: "lava", ps: "#ff6a1a" } },
    { id: "uni_galaxy", cat: "uniform", name: "Galaxy", rarity: "mythic", source: "super", blurb: "A nebula and its stars.", k: { j: "#1b1446", p: "#0e0b2a", t: "#b06bff", pat: "galaxy" } },
    { id: "uni_carbon", cat: "uniform", name: "Carbon Fibre", rarity: "mythic", source: "super", blurb: "A twill weave, a red stripe.", k: { j: "#26292f", p: "#17191d", t: "#4f5662", pat: "carbon", ps: "#e8202a" } },
    { id: "uni_digicamo", cat: "uniform", name: "Urban Digital", rarity: "mythic", source: "super", blurb: "Pixel camo in city blues.", k: { j: "#4a5a78", p: "#323d52", t: "#232c44", pat: "digicamo" } },
    { id: "uni_bengal", cat: "uniform", name: "Snow Tiger", rarity: "mythic", source: "super", blurb: "White-tiger stripes.", k: { j: "#cfd9e3", p: "#26303d", t: "#7f9bb8", pat: "bengal" } } /* v188: was orange and black (a real club's look) */,
    { id: "uni_tron", cat: "uniform", name: "Neon Grid", rarity: "mythic", source: "super", blurb: "Cyan seams on black.", k: { j: "#070a12", p: "#070a12", t: "#18f0ff", pat: "grid", ps: "#18f0ff" } },
    { id: "uni_ice", cat: "uniform", name: "Ice Crystal", rarity: "mythic", source: "super", blurb: "Faceted frost.", k: { j: "#bfe3fb", p: "#eaf6ff", t: "#2a6fb0", pat: "crystal" } },
    { id: "uni_royal", cat: "uniform", name: "Royal Black & Gold", rarity: "mythic", source: "super", blurb: "Gold yoke, gold panels, pinstripes.", k: { j: "#0e0e12", p: "#d4af37", t: "#d4af37", pat: "royal", ps: "#0e0e12" } },
    { id: "uni_throwback", cat: "uniform", name: "Throwback '79", rarity: "mythic", source: "super", blurb: "Cream, maroon stripes.", k: { j: "#f1e8d2", p: "#c79b3e", t: "#7a1f2b", pat: "throwback", ps: "#7a1f2b" } }
  ];
  addItemsV177(ITEMS_V177J, "v177");
  function hV177J(a, b, c) { return noiseV159C(a | 0, b | 0, (c | 0) + 1770); }
  var WHITE_V177J = [255, 255, 255];
  /* X, Y in field pixels (X from the chest's middle, Y down from the collar); s = screen pixels per field pixel */
  var PAT_V177J = {
    chrome: function (X, Y, s, J, T) { var b = 0.5 + 0.5 * Math.sin(X * 0.85 + Y * 0.32 + 0.6), k = b * b;
      return b > 0.82 ? mix(J, WHITE_V177J, 0.5 + 0.3 * (b - 0.82) / 0.18) : b < 0.22 ? mix(J, [52, 58, 70], 0.5 * (1 - b / 0.22)) : mix(J, T, 0.12 * k); },
    lava: function (X, Y, s, J, T) {   // a Voronoi of cells 4 px across: their edges are the cracks
      var cx = Math.floor(X / 4), cy = Math.floor(Y / 4), d1 = 99, d2 = 99;
      for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j++) { var px = (cx + i) * 4 + hV177J(cx + i, cy + j, 1) * 4, py = (cy + j) * 4 + hV177J(cx + i, cy + j, 2) * 4, d = Math.hypot(X - px, Y - py); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
      var e = d2 - d1; if (e < 0.55) return mix(T, [255, 230, 140], 0.35 * (1 - e / 0.55)); if (e < 1.3) return mix(J, T, 0.35 * (1 - (e - 0.55) / 0.75)); return mix(J, [0, 0, 0], 0.15 * hV177J(cx, cy, 3)); },
    galaxy: function (X, Y, s, J, T) { var n = Math.sin(X * 0.45 + Y * 0.28) + Math.sin(X * 0.21 - Y * 0.55 + 1.7) + 0.6 * Math.sin((X + Y) * 0.9), k = c01V159C((n + 0.7) * 0.3);
      var fx = Math.floor(X), fy = Math.floor(Y), st = hV177J(fx, fy, 4);
      if (st > 0.955 && Math.abs(X) > 2.5) return mix(WHITE_V177J, T, 0.15);
      return mix(J, T, 0.62 * k * k); },
    carbon: function (X, Y, s, J, T) { var fx = Math.floor(X), fy = Math.floor(Y), tw = ((fx >> 1) + (fy >> 1)) % 2 === 0, sh = 0.5 + 0.5 * Math.sin((X - Y) * 0.5);
      return tw ? mix(J, T, 0.55 + 0.25 * sh) : mix(J, [0, 0, 0], 0.15 - 0.1 * sh); },
    digicamo: function (X, Y, s, J, T) { var a = hV177J(Math.floor(X / 2), Math.floor(Y / 2), 5) * 0.55 + hV177J(Math.floor(X / 5), Math.floor(Y / 4), 6) * 0.45;
      return a < 0.34 ? T : a > 0.7 ? mix(J, WHITE_V177J, 0.24) : null; },
    bengal: function (X, Y, s, J, T) { var ax = Math.abs(X), v = Y * 0.75 + ax * 0.5 + Math.sin(X * 0.9) * 0.6, m = ((v % 3.6) + 3.6) % 3.6, wdt = 1.15 - 0.09 * Math.max(0, 4 - ax) * 0.25;
      return m < wdt && ax > 1.2 ? T : null; },
    grid: function (X, Y, s, J, T) { var ax = Math.abs(X), d = Math.min(Math.abs(ax - 4.5), Math.abs(Y - 1.5), Y > 4 ? Math.abs(ax - 7.5) : 9, Math.abs(Y - 9.5) + (ax < 3 ? 9 : 0));
      return d < 0.5 ? T : d < 1.3 ? mix(J, T, 0.28 * (1 - (d - 0.5) / 0.8)) : null; },
    crystal: function (X, Y, s, J, T) { var a = X * 0.55, b = Y * 0.55, u = a + b, v = a - b, iu = Math.floor(u), iv = Math.floor(v), k = hV177J(iu, iv, 7), fu = u - iu, fv = v - iv;
      if (fu < 0.09 || fv < 0.09) return mix(J, WHITE_V177J, 0.55);
      return k > 0.62 ? mix(J, WHITE_V177J, 0.12 + 0.3 * (k - 0.62) / 0.38) : k < 0.25 ? mix(J, T, 0.28 * (1 - k / 0.25)) : null; },
    royal: function (X, Y, s, J, T) { var ax = Math.abs(X);
      if (Y < 1.6 || ax > 6.6) return T;
      if (Y < 2.3 || (ax > 5.9 && ax <= 6.6)) return mix(J, T, 0.3);
      if (ax > 2.6 && Math.floor(ax) % 2 === 1 && ax - Math.floor(ax) < 0.4) return mix(J, T, 0.55);
      return null; },
    throwback: function (X, Y, s, J, T) { var ax = Math.abs(X);
      if (Y < 1) return T;
      if (ax > 5.4 && ((Y >= 2 && Y < 3) || (Y >= 4 && Y < 5) || (Y >= 6 && Y < 7))) return T;
      if (ax > 5.4 && Y >= 3 && Y < 4) return mix(J, WHITE_V177J, 0.4);
      return null; }
  };
  /* the field (and the Locker's sprite): kitDeco hands every pattern it does not draw itself to patV153G */
  var patV153G0_V177J = patV153G;
  patV153G = function (pat, xx, yy, top, cx, UJ, UT) {
    var f = PAT_V177J[pat];
    if (f) { if (!onV177J() || yy < top) return null; try { V177J.field++; return f(xx + 0.5 - cx, yy - top, 1, UJ, UT); } catch (e) { errV177J(e); return null; } }
    return patV153G0_V177J.apply(this, arguments);
  };
  /* the card's figure: the plain jersey (figCell with "solid"), then the design on the jersey's own source pixels */
  var SRC_V177J = { d: null };
  function figCellV177J(K) {
    var im = FIG.img; if (!im) return null;
    var key = "v177J|" + [K.j, K.p, K.t, K.pat, K.hs, K.hst, K.hf, K.hsk, K.hd, K.hdk, helmLogoKeyV160A(K)].join("|");
    if (FIG.cache[key]) return FIG.cache[key];
    var base = figCell0V177J(Object.assign({}, K, { pat: "solid" })); if (!base) return null;
    var W = base.width, H = base.height, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var x = cv.getContext("2d"); x.drawImage(base, 0, 0);
    if (!SRC_V177J.d) { var c0 = document.createElement("canvas"); c0.width = W; c0.height = H; var x0 = c0.getContext("2d"); x0.drawImage(im, 0, 0); SRC_V177J.d = x0.getImageData(0, 0, W, H).data; }
    var s = SRC_V177J.d, img = x.getImageData(0, 0, W, H), d = img.data, top = 3, neck = Math.round(top + (H - 6) * FIG.neck), waist = H;
    for (var y0 = neck + 20; y0 < H; y0++) { var nv = 0, gd = 0;
      for (var q = 0; q < W; q++) { var i0 = (y0 * W + q) * 4; if (s[i0 + 3] < 20) continue; var c = srcClass(s[i0], s[i0 + 1], s[i0 + 2])[0]; if (c === 1) nv++; else if (c === 2) gd++; }
      if (gd > 12 && gd > nv * 1.5) { waist = y0; break; } }
    var hx0 = W * 0.515, hy0 = H * 0.15, hrx = W * 0.29, hry = H * 0.14, shell = helmShellV162B(s, W, H, neck), J = rgb(K.j), T = rgb(hexOk(K.t) || K.p), f = PAT_V177J[K.pat], sc = W / 44;
    for (var y = neck; y < waist; y++) for (var xx = 0; xx < W; xx++) {
      var i = (y * W + xx) * 4; if (s[i + 3] < 20) continue;
      var cl = srcClass(s[i], s[i + 1], s[i + 2]); if (cl[0] !== 1) continue;
      var ex = (xx - hx0) / hrx, ey = (y - hy0) / hry; if ((y < neck && ex * ex + ey * ey <= 1) || (shell && shell[y * W + xx])) continue;
      var o = f((xx + 0.5 - W * 0.515) / sc, (y - neck) / sc, sc, J, T); if (!o) continue;
      var out = shadeKit(o, cl[1] / 32.5);
      d[i] = Math.max(0, Math.min(255, out[0])); d[i + 1] = Math.max(0, Math.min(255, out[1])); d[i + 2] = Math.max(0, Math.min(255, out[2]));
    }
    x.putImageData(img, 0, 0); V177J.card++;
    FIG.cache[key] = cv;
    return cv;
  }
  var figCell0V177J = figCell;
  figCell = function (K) {
    try { if (K && PAT_V177J[K.pat] && onV177J()) { var c = figCellV177J(K); if (c) return c; } } catch (e) { errV177J(e); }
    return figCell0V177J.apply(this, arguments);
  };
  Object.assign(V177J, { items: function () { return ITEMS_V177J.map(function (it) { return it.id; }); }, patterns: function () { return Object.keys(PAT_V177J); },
    pat: function (name, X, Y, j, t) { var f = PAT_V177J[name]; return f ? f(X, Y, 1, rgb(j), rgb(t)) : null; }, ink: function (id) { var it = BY[id]; return it ? inkForV159A(it.k.j, it.k.p, it.k.t) : null; } });

  /* ===== v177 K TEN NEW BANNERS =====
   * The owner: "Add 10 more banners, super cool status." Ten SUPER (mythic, source "super") banners, each a v158 A PAINTER
   * (`BAN_V158A[kind](ctx, w, h, t, palette)`, a pure function of the wall clock, one still frame under reduced motion, on
   * v158 A's one rAF loop for the card and the Locker): CODE RAIN (glyph columns falling), UNDER THE LIGHTS (two searchlights
   * sweeping a night stadium over a bobbing crowd, camera flashes), LIGHT SPEED (stars streaking out of the centre), GRAND
   * FINALE (shells rising and bursting over the bowl), CHERRY BLOSSOM (a branch in bloom, petals spinning down), TOTAL
   * ECLIPSE (the corona turning, a diamond-ring flare), OVERCLOCKED (a circuit board with pulses running its traces), THE
   * ABYSS (jellyfish pulsing in the deep, bubbles, light from above), COMET SHOWER (comets over a ridge, twinkling stars),
   * PRISM FOIL (an iridescent holo foil, embossed diamonds and a moving sheen). Nothing here draws from Math.random (the
   * integer hash `rV158A`). Kill switch: v158 A's TU v158Aban (the still `bg`). `window.__V177K`. */
  var V177K = (window.__V177K = window.__V177K || { errs: [] });
  var ITEMS_V177K = [
    { id: "ban_coderain", cat: "banner", name: "Code Rain", rarity: "mythic", source: "super", b158: "coderain", col: ["#3dff7a", "#02140a", "#c8ffd8"], bg: "linear-gradient(180deg,#02140a,#000)" },
    { id: "ban_floodlights", cat: "banner", name: "Under the Lights", rarity: "mythic", source: "super", b158: "floodlights", col: ["#0a1430", "#fff6d8", "#05070d"], bg: "linear-gradient(180deg,#0a1430,#05070d)" },
    { id: "ban_hyperspace", cat: "banner", name: "Light Speed", rarity: "mythic", source: "super", b158: "hyperspace", col: ["#9fd8ff", "#ffffff", "#3a5cff"], bg: "radial-gradient(circle,#1a2a6a,#000)" },
    { id: "ban_finale", cat: "banner", name: "Grand Finale", rarity: "mythic", source: "super", b158: "finale", col: ["#ff5a5a", "#ffd76f", "#6fd3ff", "#b98bff", "#7cff9b"], bg: "linear-gradient(180deg,#0b0820,#1a1030)" },
    { id: "ban_sakura", cat: "banner", name: "Cherry Blossom", rarity: "mythic", source: "super", b158: "sakura", col: ["#ffb7d0", "#ffe6ef", "#5a2a3a"], bg: "linear-gradient(180deg,#ffd6e6,#b9a6e8)" },
    { id: "ban_eclipse", cat: "banner", name: "Total Eclipse", rarity: "mythic", source: "super", b158: "eclipse", col: ["#fff3c4", "#ffb84d", "#02030a"], bg: "radial-gradient(circle at 70% 50%,#000 18%,#ffb84d 22%,#02030a 40%)" },
    { id: "ban_circuit", cat: "banner", name: "Overclocked", rarity: "mythic", source: "super", b158: "circuit", col: ["#04140e", "#18c38a", "#b9ffe4"], bg: "linear-gradient(180deg,#062a1c,#04140e)" },
    { id: "ban_abyss", cat: "banner", name: "The Abyss", rarity: "mythic", source: "super", b158: "abyss", col: ["#03203a", "#ff7ad9", "#5ff3ff"], bg: "linear-gradient(180deg,#0a3a5a,#000510)" },
    { id: "ban_comets", cat: "banner", name: "Comet Shower", rarity: "mythic", source: "super", b158: "comets", col: ["#0b1030", "#bfe6ff", "#ffd9a0"], bg: "linear-gradient(180deg,#0b1030,#1d1440)" },
    { id: "ban_prism", cat: "banner", name: "Prism Foil", rarity: "mythic", source: "super", b158: "prism", col: ["#ff9ad5", "#9ad5ff", "#d5ff9a", "#ffe29a"], bg: "linear-gradient(120deg,#ff9ad5,#9ad5ff,#d5ff9a,#ffe29a)" }
  ];
  addItemsV177(ITEMS_V177K, "v177");
  var GLY_V177K = "01アイウカキクサシスタチツナニハヒフマミ<>=+*#";
  var CIRC_V177K = {};
  function circuitV177K(w, h) {   // the board's traces for a w x h banner (built once): manhattan runs with pads
    var key = Math.round(w) + "x" + Math.round(h); if (CIRC_V177K[key]) return CIRC_V177K[key];
    var T = [];
    for (var i = 0; i < 16; i++) {
      var x = Math.floor(rV158A(i, 701) * w), y = Math.floor(rV158A(i, 702) * h), pts = [x, y], len = 0;
      for (var s = 0; s < 4; s++) { var horiz = (s + i) % 2 === 0, d = (rV158A(i * 7 + s, 703) - 0.5) * (horiz ? w * 0.5 : h * 0.9);
        var nx = horiz ? Math.max(4, Math.min(w - 4, x + d)) : x, ny = horiz ? y : Math.max(4, Math.min(h - 4, y + d)); len += Math.abs(nx - x) + Math.abs(ny - y); x = nx; y = ny; pts.push(x, y); }
      T.push({ pts: pts, len: Math.max(1, len), sp: 40 + rV158A(i, 704) * 70, ph: rV158A(i, 705) });
    }
    return (CIRC_V177K[key] = T);
  }
  function alongV177K(pts, d) { for (var i = 0; i + 3 < pts.length; i += 2) { var L = Math.abs(pts[i + 2] - pts[i]) + Math.abs(pts[i + 3] - pts[i + 1]); if (d <= L) { var u = L ? d / L : 0; return [pts[i] + (pts[i + 2] - pts[i]) * u, pts[i + 1] + (pts[i + 3] - pts[i + 1]) * u]; } d -= L; } return [pts[pts.length - 2], pts[pts.length - 1]]; }
  var PAINT_V177K = {
    coderain: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, C[1]], [1, "#000000"]]));
      x.font = "700 7px 'Courier New', monospace"; x.textAlign = "center"; x.textBaseline = "middle";
      for (var col = 0; col * 7 < w + 7; col++) {
        var sp = 26 + rV158A(col, 711) * 40, len = 6 + Math.floor(rV158A(col, 712) * 8), head = ((t * sp + rV158A(col, 713) * (h + 80)) % (h + 80)) - 10, cx = col * 7 + 3.5;
        for (var j = 0; j < len; j++) { var y = head - j * 7.5; if (y < -6 || y > h + 6) continue; var g = GLY_V177K[Math.floor(rV158A(col * 31 + j, Math.floor(t * 9) + 714) * GLY_V177K.length)];
          x.globalAlpha = j ? Math.max(0.08, 0.85 * (1 - j / len)) : 1; x.fillStyle = j ? C[0] : C[2]; x.fillText(g, cx, y); }
      }
      x.globalAlpha = 1; glowV158A(x, w * 0.5, h * 0.5, w * 0.5, C[0], 0.06); vignetteV158A(x, w, h, 0.45);
    },
    floodlights: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, C[0]], [1, C[2]]]));
      starsV158A(x, w, h * 0.5, t, 18, 721, 1.1);
      [[0.08, 1], [0.92, -1]].forEach(function (L, i) { var px = w * L[0], py = h + 6, a = -Math.PI / 2 + L[1] * (0.35 + 0.38 * Math.sin(t * 0.55 + i * 2.1)), spr = 0.12, R = w * 0.9;
        var g = x.createLinearGradient(px, py, px + Math.cos(a) * R, py + Math.sin(a) * R); g.addColorStop(0, rgbaV158A(C[1], 0.55)); g.addColorStop(1, rgbaV158A(C[1], 0));
        x.fillStyle = g; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a - spr) * R, py + Math.sin(a - spr) * R); x.lineTo(px + Math.cos(a + spr) * R, py + Math.sin(a + spr) * R); x.closePath(); x.fill();
        glowV158A(x, px, h - 4, 16, C[1], 0.7); });
      for (var i = 0; i < 6; i++) { var fl = rV158A(i, Math.floor(t * 3) + 722); if (fl > 0.6) glowV158A(x, rV158A(i, 723 + Math.floor(t * 3)) * w, h - 14 - rV158A(i, 724) * 8, 5, "#ffffff", fl); }
      var hg = x.createLinearGradient(0, h * 0.45, 0, h); hg.addColorStop(0, rgbaV158A(C[1], 0)); hg.addColorStop(1, rgbaV158A(C[1], 0.55)); x.fillStyle = hg; x.fillRect(0, h * 0.45, w, h * 0.55);
      for (var lr = 0; lr < 9; lr++) { var lx = w * (0.06 + lr * 0.11); glowV158A(x, lx, h * 0.52, 7, C[1], 0.55 + 0.25 * Math.sin(t * 4 + lr)); x.fillStyle = "#fffbe8"; x.fillRect(lx - 2, h * 0.52 - 1, 4, 2); }
      x.fillStyle = C[2];
      for (var c = -1; c * 7 < w + 7; c++) { var bob = Math.abs(Math.sin(t * 3.2 + c * 1.3)) * 2.2, hy = h - 9 - (c % 2) * 3 - bob; x.beginPath(); x.arc(c * 7 + 3.5, hy, 3.1, 0, 6.283); x.fill(); x.fillRect(c * 7 + 0.5, hy + 2, 6, h - hy); }
      x.fillRect(0, h - 4, w, 4);
    },
    hyperspace: function (x, w, h, t, C) {
      fillV158A(x, w, h, "#000000"); var cx = w * 0.5, cy = h * 0.5, R = Math.hypot(w, h) * 0.55;
      glowV158A(x, cx, cy, h * 0.9, C[2], 0.35);
      x.lineCap = "round";
      for (var i = 0; i < 110; i++) { var a = rV158A(i, 731) * 6.2832, p = (t * (0.45 + rV158A(i, 732) * 0.5) + rV158A(i, 733)) % 1, d = p * p * R, d0 = Math.max(2, d * 0.62);
        x.strokeStyle = i % 4 ? rgbaV158A(C[1], (0.25 + 0.75 * p).toFixed(3)) : rgbaV158A(C[0], (0.3 + 0.7 * p).toFixed(3)); x.lineWidth = 0.5 + p * 1.6;
        x.beginPath(); x.moveTo(cx + Math.cos(a) * d0, cy + Math.sin(a) * d0 * 0.6); x.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.6); x.stroke(); }
      glowV158A(x, cx, cy, 14, "#ffffff", 0.8);
    },
    finale: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, "#06041a"], [1, "#1a1030"]]));
      starsV158A(x, w, h * 0.6, t, 14, 741, 1.2);
      for (var k = 0; k < 5; k++) { var per = 2.6, p = ((t + k * 0.53) % per) / per, n = Math.floor((t + k * 0.53) / per), bx = w * (0.12 + 0.76 * rV158A(k * 17 + n, 742)), by = h * (0.2 + 0.25 * rV158A(k * 13 + n, 743)), col = C[(k + n) % C.length];
        if (p < 0.24) { var q = p / 0.24, yy = h - (h - by) * EZ_V159C.outC(q); x.strokeStyle = rgbaV158A("#fff3c4", 0.7); x.lineWidth = 1.2; x.beginPath(); x.moveTo(bx, Math.min(h, yy + 10)); x.lineTo(bx, yy); x.stroke(); }
        else { var e = (p - 0.24) / 0.76, r = 28 * EZ_V159C.outC(e), a = 1 - e;
          glowV158A(x, bx, by, 34 * (0.5 + e), col, e < 0.15 ? 0.6 : 0.22 * a);
          for (var j = 0; j < 22; j++) { var th = j / 22 * 6.2832, px = bx + Math.cos(th) * r, py = by + Math.sin(th) * r + 10 * e * e; x.fillStyle = rgbaV158A(j % 3 ? col : "#ffffff", a.toFixed(3)); x.fillRect(px - 1.3, py - 1.3, 2.6, 2.6);
            x.strokeStyle = rgbaV158A(col, (a * 0.35).toFixed(3)); x.lineWidth = 0.8; x.beginPath(); x.moveTo(bx + Math.cos(th) * r * 0.6, by + Math.sin(th) * r * 0.6 + 6 * e * e); x.lineTo(px, py); x.stroke(); } } }
      x.fillStyle = "#05030c"; x.beginPath(); x.moveTo(0, h); x.lineTo(0, h - 8); x.quadraticCurveTo(w * 0.5, h - 22, w, h - 8); x.lineTo(w, h); x.fill();
      for (var l = 0; l < 7; l++) glowV158A(x, w * (0.1 + l * 0.133), h - 10 - Math.sin(l / 6 * Math.PI) * 9, 4, "#fff6d8", 0.6);
    },
    sakura: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, "#ffd6e6"], [0.6, "#d9c2f0"], [1, "#a996d8"]]));
      glowV158A(x, w * 0.78, h * 0.3, 28, "#fff6f0", 0.7);
      x.fillStyle = "rgba(120,90,150,.35)"; x.beginPath(); x.moveTo(0, h); x.lineTo(w * 0.25, h * 0.55); x.lineTo(w * 0.45, h * 0.8); x.lineTo(w * 0.7, h * 0.5); x.lineTo(w, h * 0.85); x.lineTo(w, h); x.fill();
      x.strokeStyle = C[2]; x.lineCap = "round"; var br = function (px, py, len, an, d) { if (d > 4) return; var ex = px + Math.cos(an) * len, ey = py + Math.sin(an) * len; x.lineWidth = Math.max(0.8, 4 - d); x.beginPath(); x.moveTo(px, py); x.lineTo(ex, ey); x.stroke();
        if (d >= 2) for (var b = 0; b < 3; b++) { x.fillStyle = b % 2 ? C[0] : C[1]; x.beginPath(); x.arc(ex + (rV158A(d * 9 + b, 751) - 0.5) * 7, ey + (rV158A(d * 7 + b, 752) - 0.5) * 6, 2.1, 0, 6.283); x.fill(); }
        br(ex, ey, len * 0.72, an - 0.45, d + 1); br(ex, ey, len * 0.68, an + 0.4, d + 1); };
      br(-4, 4, 26, 0.35, 0);
      for (var i = 0; i < 34; i++) { var sp = 10 + rV158A(i, 753) * 14, y = (rV158A(i, 754) * (h + 10) + t * sp) % (h + 10) - 5, xx = (rV158A(i, 755) * w + t * (8 + 6 * rV158A(i, 756)) + Math.sin(t * 1.6 + i) * 6) % (w + 10) - 5, rot = t * (1 + rV158A(i, 757) * 2) + i;
        x.save(); x.translate(xx, y); x.rotate(rot); x.scale(1, 0.45 + 0.55 * Math.abs(Math.sin(t * 2 + i))); x.fillStyle = i % 3 ? C[0] : C[1]; x.beginPath(); x.ellipse(0, 0, 2.6, 1.5, 0, 0, 6.283); x.fill(); x.restore(); }
    },
    eclipse: function (x, w, h, t, C) {
      fillV158A(x, w, h, C[2]); starsV158A(x, w, h, t, 30, 761, 1.4);
      var cx = w * 0.7, cy = h * 0.5, R = h * 0.3;
      glowV158A(x, cx, cy, R * 3.2, C[1], 0.28); glowV158A(x, cx, cy, R * 1.7, C[0], 0.7);
      x.save(); x.translate(cx, cy); x.rotate(t * 0.12);
      for (var i = 0; i < 28; i++) { var a = i / 28 * 6.2832, L = R * (1.5 + 0.9 * rV158A(i, 762) * (0.7 + 0.3 * Math.sin(t * 1.3 + i))), wd = 0.05 + 0.04 * rV158A(i, 763);
        x.fillStyle = rgbaV158A(i % 2 ? C[0] : C[1], 0.22); x.beginPath(); x.moveTo(Math.cos(a - wd) * R, Math.sin(a - wd) * R); x.lineTo(Math.cos(a) * L, Math.sin(a) * L); x.lineTo(Math.cos(a + wd) * R, Math.sin(a + wd) * R); x.fill(); }
      x.restore();
      x.fillStyle = "#000000"; x.beginPath(); x.arc(cx, cy, R, 0, 6.283); x.fill();
      var fp = (t % 5) / 5, fa = Math.max(0, Math.sin(fp * Math.PI)) ;
      if (fa > 0.02) { var a2 = -0.8 + fp * 0.5, fx = cx + Math.cos(a2) * R, fy = cy + Math.sin(a2) * R; glowV158A(x, fx, fy, 16, "#ffffff", 0.9 * fa);
        x.strokeStyle = "rgba(255,255,255," + (0.8 * fa).toFixed(3) + ")"; x.lineWidth = 1; x.beginPath(); x.moveTo(fx - 14 * fa, fy); x.lineTo(fx + 14 * fa, fy); x.moveTo(fx, fy - 9 * fa); x.lineTo(fx, fy + 9 * fa); x.stroke(); }
    },
    circuit: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, "#062a1c"], [1, C[0]]]));
      for (var g = 0; g < w; g += 6) { x.fillStyle = "rgba(255,255,255,.025)"; x.fillRect(g, 0, 1, h); }
      var T = circuitV177K(w, h); x.lineCap = "round"; x.lineJoin = "round";
      T.forEach(function (tr, i) { var p = tr.pts; x.strokeStyle = rgbaV158A(C[1], 0.35); x.lineWidth = 1.3; x.beginPath(); x.moveTo(p[0], p[1]); for (var k = 2; k < p.length; k += 2) x.lineTo(p[k], p[k + 1]); x.stroke();
        x.fillStyle = rgbaV158A(C[1], 0.8); x.beginPath(); x.arc(p[0], p[1], 2, 0, 6.283); x.arc(p[p.length - 2], p[p.length - 1], 2, 0, 6.283); x.fill();
        var d = ((t * tr.sp + tr.ph * tr.len) % (tr.len + 40)); if (d <= tr.len) { for (var s = 0; s < 5; s++) { var q = alongV177K(p, Math.max(0, d - s * 3)); x.fillStyle = rgbaV158A(C[2], (0.9 - s * 0.17).toFixed(3)); x.fillRect(q[0] - 1.1, q[1] - 1.1, 2.2, 2.2); }
          var hd = alongV177K(p, d); glowV158A(x, hd[0], hd[1], 7, C[2], 0.6); } });
      for (var c = 0; c < 3; c++) { var cx = w * (0.2 + c * 0.3), cy = h * (0.3 + 0.4 * rV158A(c, 771)); x.fillStyle = "#0b1a14"; x.fillRect(cx - 9, cy - 6, 18, 12); x.strokeStyle = rgbaV158A(C[1], 0.7); x.lineWidth = 1; x.strokeRect(cx - 9, cy - 6, 18, 12);
        x.fillStyle = rgbaV158A(C[1], 0.6); for (var pn = -2; pn <= 2; pn++) { x.fillRect(cx + pn * 3.4 - 0.6, cy - 8, 1.2, 2); x.fillRect(cx + pn * 3.4 - 0.6, cy + 6, 1.2, 2); } if (Math.floor(t * 2 + c) % 3 === 0) glowV158A(x, cx + 5, cy - 2, 3, C[2], 0.9); }
    },
    abyss: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, "#0a3a5a"], [0.5, C[0]], [1, "#000510"]]));
      for (var r = 0; r < 5; r++) { var rx = w * (0.1 + r * 0.22) + Math.sin(t * 0.3 + r) * 12; var g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "rgba(190,240,255,.16)"); g.addColorStop(1, "rgba(190,240,255,0)");
        x.fillStyle = g; x.beginPath(); x.moveTo(rx - 6, 0); x.lineTo(rx + 8, 0); x.lineTo(rx + 30, h); x.lineTo(rx + 12, h); x.fill(); }
      for (var j = 0; j < 3; j++) { var col = j % 2 ? C[2] : C[1], jx = w * (0.22 + j * 0.3) + Math.sin(t * 0.5 + j * 2) * 10, jy = h * 0.45 + Math.sin(t * 0.8 + j) * 6 + (j - 1) * 3, pul = 0.85 + 0.15 * Math.sin(t * 3 + j * 1.7), bw = 9 * pul, bh = 7 / pul;
        glowV158A(x, jx, jy, 22, col, 0.35 + 0.15 * Math.sin(t * 3 + j));
        x.strokeStyle = rgbaV158A(col, 0.6); x.lineWidth = 0.9; for (var k = 0; k < 5; k++) { var tx = jx - bw * 0.7 + k * bw * 0.35; x.beginPath(); x.moveTo(tx, jy); for (var s = 1; s <= 6; s++) x.lineTo(tx + Math.sin(t * 2.4 + s * 0.8 + k + j) * 2, jy + s * 3); x.stroke(); }
        x.fillStyle = rgbaV158A(col, 0.75); x.beginPath(); x.ellipse(jx, jy, bw, bh, 0, Math.PI, 0); x.fill(); x.fillStyle = "rgba(255,255,255,.5)"; x.beginPath(); x.ellipse(jx - 2, jy - bh * 0.5, bw * 0.35, bh * 0.25, 0, 0, 6.283); x.fill(); }
      for (var b = 0; b < 22; b++) { var sp = 10 + rV158A(b, 781) * 18, y = h - ((rV158A(b, 782) * h + t * sp) % (h + 6)), bx = rV158A(b, 783) * w + Math.sin(t * 2 + b) * 2, br = 0.6 + rV158A(b, 784) * 1.4;
        x.strokeStyle = "rgba(200,240,255,.55)"; x.lineWidth = 0.7; x.beginPath(); x.arc(bx, y, br, 0, 6.283); x.stroke(); }
    },
    comets: function (x, w, h, t, C) {
      fillV158A(x, w, h, vgV158A(x, 0, h, [[0, C[0]], [1, "#2a1a4a"]])); starsV158A(x, w, h, t, 40, 791, 1.8);
      for (var k = 0; k < 5; k++) { var per = 3.2 + k * 0.4, p = ((t + k * 0.9) % per) / per, n = Math.floor((t + k * 0.9) / per), sx = w * (0.15 + 0.9 * rV158A(k + n * 5, 792)), sy = -10, L = w * 0.55, a = 2.45 + 0.25 * rV158A(k + n * 5, 793);
        var hx = sx + Math.cos(a) * L * p * 1.4, hy = sy - Math.sin(a) * -L * p * 0.9; if (p > 0.85) continue;
        var tx = hx - Math.cos(a) * 34, ty = hy + Math.sin(a) * -34 * 0.65, g = x.createLinearGradient(tx, ty, hx, hy); g.addColorStop(0, rgbaV158A(C[2], 0)); g.addColorStop(1, rgbaV158A(C[2], 0.85));
        x.strokeStyle = g; x.lineWidth = 2; x.lineCap = "round"; x.beginPath(); x.moveTo(tx, ty); x.lineTo(hx, hy); x.stroke(); glowV158A(x, hx, hy, 6, C[1], 0.9); x.fillStyle = "#ffffff"; x.fillRect(hx - 0.8, hy - 0.8, 1.6, 1.6); }
      x.fillStyle = "#080616"; x.beginPath(); x.moveTo(0, h); x.lineTo(0, h * 0.78); for (var m = 0; m <= 10; m++) x.lineTo(w * m / 10, h * (0.7 + 0.18 * rV158A(m, 794))); x.lineTo(w, h); x.fill();
    },
    prism: function (x, w, h, t, C) {
      var g = x.createLinearGradient(0, 0, w, h), sh = (t * 0.12) % 1;
      for (var i = 0; i <= 6; i++) g.addColorStop(i / 6, hslHex(((i / 6 + sh) * 360) % 360, 0.9, 0.68)); fillV158A(x, w, h, g);
      x.globalCompositeOperation = "overlay"; fillV158A(x, w, h, vgV158A(x, 0, h, [[0, "#ffffff"], [1, "#6a6a8a"]])); x.globalCompositeOperation = "source-over";
      x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 0.8;
      for (var d = -h; d < w + h; d += 9) { x.beginPath(); x.moveTo(d, 0); x.lineTo(d + h, h); x.stroke(); x.beginPath(); x.moveTo(d + h, 0); x.lineTo(d, h); x.stroke(); }
      sheenV158A(x, w, h, t, 3.2, 0.55); sheenV158A(x, w, h, t + 1.6, 3.2, 0.25);
      for (var s = 0; s < 8; s++) { var a = Math.max(0, Math.sin(t * 2.2 + s * 1.9)); if (a > 0.6) { var px = rV158A(s, 801) * w, py = rV158A(s, 802) * h, r = 4 * a; x.strokeStyle = "rgba(255,255,255," + a.toFixed(2) + ")"; x.lineWidth = 1; x.beginPath(); x.moveTo(px - r, py); x.lineTo(px + r, py); x.moveTo(px, py - r); x.lineTo(px, py + r); x.stroke(); } }
      x.strokeStyle = "rgba(255,255,255,.6)"; x.lineWidth = 1; x.strokeRect(1.5, 1.5, w - 3, h - 3);
    }
  };
  Object.keys(PAINT_V177K).forEach(function (k) { if (!BAN_V158A[k]) BAN_V158A[k] = PAINT_V177K[k]; });
  Object.assign(V177K, { items: function () { return ITEMS_V177K.map(function (it) { return it.id; }); }, painters: function () { return Object.keys(PAINT_V177K); } });
})();
