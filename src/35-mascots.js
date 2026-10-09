/* ===== v193 AI THE MASCOTS DANCE =====
 * The owner: "Add dancing mascots for every single team logo. These will be unlockable with the membership. Fairly
 * basic sprite that does the same celebrations as the players, but dressed as a knight, animal, etc."
 *
 *   EVERY CREST   a team's crest is one of the 90 v44 emblems (`TEAM_LOGOS_V44.forName` — every school, college, UFF and
 *                 Interstellar club resolves to one, the Team Creator picks one), so `EMBLEM_V193AI` maps all 90 to a
 *                 costume: 16 ARCHETYPES (wolf, bear, big cat, bird, reptile, horned beast, sea creature, bug, knight,
 *                 spartan, viking, pirate, spook, robot, alien, elemental), each with the variant its crest draws (the
 *                 tiger has stripes, the lion a mane, the samurai a kabuto…). In the Interstellar League every mascot
 *                 wears a space bubble.
 *   THE SPRITE    one rig (hips, a chubby torso in the TEAM'S jersey with its second colour as the trim, two-bone arms and
 *                 legs, a big foam head) dressed by its archetype's head, limbs, gloves, shoes and accessory (tail, wings,
 *                 cape, tentacles, sword & shield, spear, axe, scythe…). Every pose is drawn ONCE at a low "logical" size
 *                 with canvas paths, snapped to hard pixels (alpha threshold) and outlined — the field's own pixel style —
 *                 then upscaled ×2 into a per-team sheet (`sheetV193AI`, cached, LRU `mascotCacheV193AI`) and handed to
 *                 Phaser as a canvas texture with one frame per pose. Nothing is drawn per frame but a frame index.
 *   THE DANCE     the SAME celebrations as the players, on their clock: a scorer entering `celebrateSeq` (the v91 drawn
 *                 cycle, `celebrateFrameMs` / `celebrateMs`, or a v164 G big-play dance's `_celMsV164G`) starts his
 *                 team's mascot on the four-frame cheer at that frame rate for that long; HIS touchdown body (v161 A's
 *                 flex / backflip / spike, `__V161A.active`) is mirrored pose for pose through `RIB_COSMETICS.boardCel
 *                 .pose(name, t)` — the same segment, lift, squash and the backflip's spin — and v177 I's ten bodies get a
 *                 mascot routine of the same length. Otherwise the mascot idle-bounces, and the bench's excitement
 *                 (v78 `side.excite`) turns that into waving.
 *   WHERE         (v194 B: only the HOME team's now — see `v194 B THE MASCOT COMES ALIVE`; TU v194B 0 is this:)
 *                 the live broadcast: one mascot on each team's sideline (v78's banks: "off" = your team, "def" the
 *                 opponent), just outside the painted line a few yards behind the ball, projected with `crowdProject`,
 *                 lit by the bench's shade, scaled with the players (and the v144 A age scale). One call from 05's
 *                 `updateSideline` (`RIB_MASCOTS.frame`). Off the field: the season hero's crest card (`.sx-hero-v168`)
 *                 and the Locker's STYLE › MASCOTS row (28 `v193 AI THE MASCOTS DANCE (cosmetics)`), a small animated canvas.
 *   MEMBERSHIP    the look `mascot_team` is a v156 C MEMBER look: owned while the store is ON and the device holds `member`
 *                 (or `founder`); with the store OFF it is LISTED "🔒 Membership" and never owned, so — like every member
 *                 look — it never appears in the game. The Locker's preview still plays it (that is the incentive), and
 *                 TU `mascotPreviewV193AI` 1 shows them everywhere for the owner and the checks. Nothing here calls the
 *                 store: ownership is asked of RIB_COSMETICS, which asks RIB_MONETIZE only while it is enabled.
 *   COST          two sprites + two shadows; per frame a frame index, a position and a bob. Culled off camera and when the
 *                 camera is far (on-screen height under `mascotMinPxV193AI`). Sheets build once (~10-25 ms each).
 * Kill switch TU `v193AI` 0: no mascots anywhere (the field, the card, the Locker's row draws a blank). Looks only — no sim
 * value is read or written and nothing draws from Math.random. `window.RIB_MASCOTS`, `window.__V193AI`; `v193AIcheck`. */
(function () {
  "use strict";
  if (window.RIB_MASCOTS) return;
  const TUv = (k, d) => { try { return typeof TU === "function" ? TU(k, d) : d; } catch (e) { return d; } };
  const V = (window.__V193AI = window.__V193AI || { builds: 0, buildMs: 0, buildMax: 0, frames: 0, frameMs: 0, frameMax: 0, ms: [], cels: [], errs: [], cards: 0, previews: 0, culled: 0, shown: 0, scenes: 0 });
  const err = (e) => { try { if (V.errs.length < 16) V.errs.push(String((e && e.stack) || e).slice(0, 300)); } catch (x) {} };
  const onV193AI = () => !!TUv("v193AI", 1);
  const REDUCED = (() => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } })();
  const DEG = Math.PI / 180;

  /* ---------------- colour ---------------- */
  const rgbOf = (h) => { h = String(h || "#888888").replace("#", ""); if (h.length === 3) h = h.replace(/./g, "$&$&"); const n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const hexOf = (r) => "#" + r.map((v) => { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? "0" : "") + v.toString(16); }).join("");
  // k < 1 darker, k > 1 toward white (1.3 = 30% of the way)
  const shade = (h, k) => { const r = rgbOf(h); return hexOf(k <= 1 ? r.map((v) => v * k) : r.map((v) => v + (255 - v) * (k - 1))); };
  const lum = (h) => { const r = rgbOf(h); return (0.2126 * r[0] + 0.7152 * r[1] + 0.0722 * r[2]) / 255; };
  const cdist = (a, b) => { const x = rgbOf(a), y = rgbOf(b); return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]); };

  /* ---------------- the costumes ---------------- */
  // gloves / shoes: paw (the fur's second colour), white (cartoon gloves), steel, talon, hoof, boot, sandal, sneaker, fin, claw
  const ARCH = {
    wolf: { name: "Wolf", tail: "bushy", glove: "paw", shoe: "paw" },
    bear: { name: "Bear", tail: null, glove: "paw", shoe: "paw" },
    cat: { name: "Big Cat", tail: "cat", glove: "paw", shoe: "paw" },
    bird: { name: "Bird", wings: "feather", tail: "feather", glove: "talon", shoe: "talon" },
    reptile: { name: "Reptile", tail: "reptile", glove: "paw", shoe: "paw" },
    horned: { name: "Horned Beast", tail: "tuft", glove: "hoof", shoe: "hoof" },
    sea: { name: "Sea Creature", tail: null, glove: "fin", shoe: "paw" },
    bug: { name: "Bug", wings: "bug", glove: "paw", shoe: "paw" },
    knight: { name: "Knight", weapon: "sword", shield: "heater", glove: "steel", shoe: "steel" },
    spartan: { name: "Spartan", weapon: "spear", shield: "round", cape: true, glove: "white", shoe: "sandal" },
    viking: { name: "Viking", weapon: "axe", shield: "wood", glove: "white", shoe: "boot" },
    pirate: { name: "Pirate", weapon: "cutlass", glove: "white", shoe: "boot" },
    spook: { name: "Spook", glove: "white", shoe: "boot" },
    robot: { name: "Robot", glove: "steel", shoe: "steel" },
    alien: { name: "Alien", weapon: "raygun", glove: "paw", shoe: "paw" },
    elemental: { name: "Elemental", glove: "white", shoe: "sneaker" }
  };
  // per variant: fur (the head and limbs), fur2 (the muzzle, belly, paws), and what the variant changes
  const VAR = {
    wolf: {
      grey: { name: "Wolf", fur: "#8a96a6", fur2: "#e3e7ec", eye: "#9fe3ff" },
      hyena: { name: "Hyena", fur: "#b48c55", fur2: "#e6d3a8", spots: "#5a4028", eye: "#ffd23a", round: 1 },
      jackal: { name: "Jackal", fur: "#25252e", fur2: "#40404c", gold: "#e2b33c", eye: "#ffd23a", tall: 1 },
      warwolf: { name: "War Wolf", fur: "#4c5564", fur2: "#aeb7c3", eye: "#ff5a3a", scar: 1 }
    },
    bear: {
      brown: { name: "Grizzly", fur: "#7a4a26", fur2: "#c99a66" },
      polar: { name: "Polar Bear", fur: "#e4ebf1", fur2: "#ffffff", ear: "#b9c8d4" },
      yeti: { name: "Yeti", fur: "#d6e8f4", fur2: "#7fa8cc", shaggy: 1, fangs: 1 },
      sasquatch: { name: "Sasquatch", fur: "#4e3c2a", fur2: "#8f6f50", shaggy: 1 },
      gorilla: { name: "Gorilla", fur: "#2a2a31", fur2: "#77737f", ape: 1 }
    },
    cat: {
      tiger: { name: "Tiger", fur: "#ea8228", fur2: "#fbeedb", stripes: "#1a1410", eye: "#c8e84a" },
      lion: { name: "Lion", fur: "#e2b24a", fur2: "#f8e6b6", mane: "#8a4a1c", eye: "#e8a020", tuft: 1 },
      panther: { name: "Panther", fur: "#202029", fur2: "#3a3a48", eye: "#f2d43a" },
      jaguar: { name: "Jaguar", fur: "#eab442", fur2: "#fbeecb", spots: "#3a2410", eye: "#8ad84a" },
      royal: { name: "Royal Lion", fur: "#e2b24a", fur2: "#f8e6b6", mane: "#6a3412", eye: "#e8a020", crown: 1, cape: true, tuft: 1 }
    },
    bird: {
      eagle: { name: "Eagle", fur: "#6b4423", head: "#f6f6f2", fur2: "#f6f6f2", beak: "#f2b822", eye: "#ffd23a" },
      hawk: { name: "Hawk", fur: "#2e4a66", head: "#2e4a66", fur2: "#cfdbe6", beak: "#ecb830", eye: "#ffb02e" },
      owl: { name: "Owl", fur: "#8d8478", head: "#8d8478", fur2: "#ddd4c4", beak: "#e8b830", eye: "#ff9a1a", owl: 1 },
      crow: { name: "Crow", fur: "#22222c", head: "#22222c", fur2: "#4a4a58", beak: "#5c5f68", eye: "#ff3b3b" },
      phoenix: { name: "Phoenix", fur: "#e2461c", head: "#f05a1e", fur2: "#ffcf3a", beak: "#ffd84a", eye: "#fff3a0", flame: 1 }
    },
    reptile: {
      gator: { name: "Gator", fur: "#4f8a3a", fur2: "#cddc8e", eye: "#f2d43a", gator: 1 },
      cobra: { name: "Cobra", fur: "#2c3229", fur2: "#d8c890", hood: "#4b5340", eye: "#ff3b3b", cobra: 1, tail: "none" },
      dragon: { name: "Dragon", fur: "#2f8f4a", fur2: "#e8d070", horn: "#f2ead0", eye: "#ffd23a", dragon: 1, wings: "bat" },
      wyvern: { name: "Wyvern", fur: "#8a1e2c", fur2: "#e89a6a", horn: "#2a1a1a", eye: "#ffd23a", dragon: 1, wings: "bat" },
      drake: { name: "Drake", fur: "#c8501c", fur2: "#ffd27a", horn: "#3a2414", eye: "#fff06a", dragon: 1, wings: "bat" },
      serpent: { name: "Sea Serpent", fur: "#1d8a8a", fur2: "#8ae6d6", fin: "#58c8f0", eye: "#ffd23a", serpent: 1 },
      nessie: { name: "Nessie", fur: "#3f7a5e", fur2: "#a8d8b0", fin: "#2a5a44", eye: "#ffffff", serpent: 1, friendly: 1 },
      swamp: { name: "Swamp Thing", fur: "#4a6a2a", fur2: "#8aa44a", moss: "#2e4418", eye: "#e8ff4a", swamp: 1 }
    },
    horned: {
      bull: { name: "Bull", fur: "#8a2a1e", fur2: "#e8b8a2", horn: "#f2ead8", bull: 1 },
      boar: { name: "Boar", fur: "#5c402c", fur2: "#e8a0a0", horn: "#f8f4e8", boar: 1 },
      warboar: { name: "War Boar", fur: "#3a2a22", fur2: "#d88a8a", horn: "#f8f4e8", boar: 1, eye: "#ff3b3b" },
      ram: { name: "Ram", fur: "#f2efe6", fur2: "#d8cdb8", horn: "#b8945e", ram: 1 },
      bison: { name: "Bison", fur: "#4a3020", fur2: "#7a5638", horn: "#ddd6c4", bison: 1 },
      rhino: { name: "Rhino", fur: "#8a9098", fur2: "#b8bec6", horn: "#ece6d6", rhino: 1, tail: "none" },
      stag: { name: "Stag", fur: "#9a6a3a", fur2: "#f2e2c8", horn: "#ece0c2", stag: 1, tail: "none" },
      longhorn: { name: "Longhorn", fur: "#c89c66", fur2: "#f2e2c8", horn: "#f6efdc", bull: 1, long: 1 },
      unicorn: { name: "Unicorn", fur: "#f6f4fa", fur2: "#ffe2ee", horn: "#f2c84a", unicorn: 1, mane: "#8a5ae6" }
    },
    sea: {
      shark: { name: "Shark", fur: "#5d7c98", fur2: "#f0f4f8", shark: 1, tail: "fin" },
      octopus: { name: "Octopus", fur: "#7a4aa8", fur2: "#b98bde", octo: 1, tent: 1 },
      kraken: { name: "Kraken", fur: "#1f8a7a", fur2: "#6ad6c2", octo: 1, tent: 1, angry: 1 },
      angler: { name: "Angler", fur: "#28344c", fur2: "#4a5a7a", angler: 1 },
      crab: { name: "Crab", fur: "#d8432a", fur2: "#f4b49a", crab: 1, glove: "claw" }
    },
    bug: {
      bee: { name: "Killer Bee", fur: "#16141a", head: "#f2c21a", fur2: "#16141a", bee: 1, stinger: 1 },
      hornet: { name: "Hornet", fur: "#16141a", head: "#ec9a14", fur2: "#16141a", bee: 1, angry: 1, stinger: 1 },
      mantis: { name: "Mantis", fur: "#6ac43a", head: "#7ad44a", fur2: "#b8f07a", mantis: 1, wings: "none" },
      mantis2: { name: "Green Mantis", fur: "#3a9a2a", head: "#46b232", fur2: "#9ae06a", mantis: 1, wings: "none" },
      scorpion: { name: "Scorpion", fur: "#3c2c4c", head: "#4a3a5e", fur2: "#7a6a94", scorpion: 1, glove: "claw", wings: "none" },
      scorpion2: { name: "Black Scorpion", fur: "#1a1a22", head: "#24242e", fur2: "#4a4a5a", scorpion: 1, glove: "claw", wings: "none", eye: "#ff3b3b" },
      widow: { name: "Widow", fur: "#16161c", head: "#1c1c24", fur2: "#d81a2a", widow: 1, wings: "none", legs: 1 },
      firefly: { name: "Firefly", fur: "#2a3a2a", head: "#34482e", fur2: "#d8ff4a", firefly: 1, glow: 1 },
      centipede: { name: "Centipede", fur: "#b8281a", head: "#c83220", fur2: "#f2c84a", centi: 1, wings: "none", legs: 1 },
      scarab: { name: "Scarab", fur: "#1f4a8a", head: "#2a5aa0", fur2: "#e2b33c", scarab: 1, wings: "shell" }
    },
    knight: {
      knight: { name: "Knight", steel: "#b9c1cd" },
      paladin: { name: "Paladin", steel: "#e2dccb", trim: "#e2b33c", helmWings: 1, shieldCol: "#f4f1e8" },
      frost: { name: "Frost Knight", steel: "#bfe2f8", trim: "#ffffff", ice: 1, shieldCol: "#7fc4ee" },
      moon: { name: "Moon Knight", steel: "#3c4c6e", trim: "#e8d27a", moon: 1, shieldCol: "#26324c" },
      sun: { name: "Sun King", steel: "#e2b33c", trim: "#fff0a8", sun: 1, shieldCol: "#e2b33c", cape: true },
      king: { name: "King", steel: "#b9c1cd", trim: "#e2b33c", crown: 1, cape: true, weapon: "scepter" },
      samurai: { name: "Samurai", steel: "#2a2228", trim: "#e2b33c", samurai: 1, armor: "#a8231e", weapon: "katana", shield: null },
      cavalier: { name: "Cavalier", steel: "#2a2a34", trim: "#e2b33c", cavalier: 1, weapon: "rapier", shield: null, cape: true },
      valkyrie: { name: "Valkyrie", steel: "#d6dce4", trim: "#e2b33c", valk: 1, weapon: "spear", shield: "round" },
      flail: { name: "Flail", steel: "#4c505a", trim: "#8a8f9a", spiky: 1, weapon: "mace", eye: "#ff3b3b" }
    },
    spartan: {
      spartan: { name: "Spartan", bronze: "#d8a033", crest: "#c8281e" },
      trojan: { name: "Trojan", bronze: "#c4cad3", crest: null }
    },
    viking: {
      viking: { name: "Viking", skin: "#eab48a", beard: "#d87a2a", helm: "#9aa3ae", horns: "#f2ead8" },
      barbarian: { name: "Barbarian", skin: "#d8a07a", beard: "#3a2410", hair: 1, pelt: "#7a5636", weapon: "sword", shield: null },
      berserker: { name: "Berserker", skin: "#e2aa82", beard: "#6a3a1a", pelt: "#5a3a22", bearhood: 1 },
      lumberjack: { name: "Lumberjack", skin: "#eab48a", beard: "#8a4a1c", beanie: 1, shield: null },
      miner: { name: "Miner", skin: "#e2aa82", beard: "#4a3426", hardhat: "#f2c21a", weapon: "pick", shield: null },
      oiler: { name: "Oiler", skin: "#d8a07a", beard: "#2a2420", hardhat: "#eceae4", weapon: "wrench", shield: null }
    },
    pirate: {
      pirate: { name: "Pirate", skin: "#e6b088", beard: "#1e1a1a", hat: "#1c1a1e", tricorn: 1 },
      outlaw: { name: "Outlaw", skin: "#dca27c", beard: "#3a2a1e", hat: "#7a5232", cowboy: 1, weapon: "lasso" },
      skull: { name: "Jolly Roger", skin: "#f2eee2", hat: "#1c1a1e", skull: 1 }
    },
    spook: {
      phantom: { name: "Phantom", robe: "#1e1c2c", glow: "#7cffd8", phantom: 1 },
      reaper: { name: "Reaper", robe: "#18161e", skin: "#f0ece0", reaper: 1, weapon: "scythe" },
      demon: { name: "Demon", skin: "#c8281e", robe: "#5a1414", demon: 1, weapon: "trident", tail: "devil", wings: "bat" },
      sorcerer: { name: "Sorcerer", skin: "#e6b088", robe: "#3a2a8a", sorcerer: 1, weapon: "staff", cape: true }
    },
    robot: {
      forge: { name: "Iron Bot", metal: "#8c949f", led: "#5ff3ff", weapon: "hammer" },
      golem: { name: "Golem", metal: "#7c7666", led: "#ffb02e", golem: 1 },
      train: { name: "Express", metal: "#30343c", led: "#ffe27a", train: 1 }
    },
    alien: {
      alien: { name: "Invader", fur: "#78d84a", fur2: "#b8f48a" }
    },
    elemental: {
      storm: { name: "Storm", base: "#7c8898", hi: "#c4ccd8", storm: 1, weapon: "bolt" },
      bolt: { name: "Bolt", base: "#ffd23a", hi: "#fff6c0", bolt: 1, weapon: "bolt" },
      fire: { name: "Wildfire", base: "#ff7a1a", hi: "#ffd23a", fire: 1 },
      inferno: { name: "Inferno", base: "#c8281e", hi: "#ff9a1a", fire: 1, dark: 1 },
      ice: { name: "Iceberg", base: "#9fd4f4", hi: "#ffffff", ice: 1 },
      volcano: { name: "Volcano", base: "#5c3e2c", hi: "#ff6a1a", volcano: 1 },
      meteor: { name: "Meteor", base: "#6a5c4e", hi: "#ff8a2a", meteor: 1 },
      summit: { name: "Summit", base: "#7f8996", hi: "#ffffff", summit: 1 },
      salt: { name: "Salt", base: "#f4f6f8", hi: "#b9c1cd", salt: 1 },
      lighthouse: { name: "Lighthouse", base: "#d8322a", hi: "#ffffff", lighthouse: 1 }
    }
  };
  /* the 90 v44 crests, in sheet order (LOGO_DB): [archetype, variant] */
  const EMBLEM_V193AI = [
    ["wolf", "grey"], ["bear", "brown"], ["cat", "panther"], ["bird", "eagle"], ["reptile", "gator"], ["sea", "shark"], ["horned", "bull"], ["horned", "boar"], ["horned", "ram"], ["horned", "bison"],
    ["cat", "tiger"], ["cat", "lion"], ["cat", "jaguar"], ["bird", "hawk"], ["bear", "polar"], ["reptile", "cobra"], ["reptile", "dragon"], ["horned", "rhino"], ["bird", "phoenix"], ["sea", "octopus"],
    ["bear", "gorilla"], ["bird", "owl"], ["bug", "scorpion"], ["bug", "mantis"], ["wolf", "hyena"], ["bear", "yeti"], ["horned", "stag"], ["wolf", "jackal"], ["horned", "unicorn"], ["reptile", "serpent"],
    ["spartan", "spartan"], ["knight", "knight"], ["viking", "viking"], ["knight", "samurai"], ["spartan", "trojan"], ["knight", "king"], ["viking", "barbarian"], ["knight", "cavalier"], ["knight", "paladin"], ["pirate", "pirate"],
    ["pirate", "outlaw"], ["spook", "phantom"], ["spook", "reaper"], ["robot", "golem"], ["knight", "frost"], ["spook", "sorcerer"], ["spook", "demon"], ["knight", "sun"], ["knight", "moon"], ["bird", "crow"],
    ["viking", "berserker"], ["horned", "warboar"], ["wolf", "warwolf"], ["cat", "royal"], ["reptile", "wyvern"], ["bug", "scarab"], ["reptile", "drake"], ["knight", "valkyrie"], ["knight", "flail"], ["elemental", "inferno"],
    ["bug", "bee"], ["bug", "mantis2"], ["bug", "scorpion2"], ["bug", "widow"], ["bug", "firefly"], ["bug", "hornet"], ["bug", "centipede"], ["sea", "crab"], ["bear", "sasquatch"], ["reptile", "nessie"],
    ["elemental", "storm"], ["elemental", "bolt"], ["elemental", "fire"], ["elemental", "ice"], ["elemental", "volcano"], ["elemental", "meteor"], ["robot", "train"], ["robot", "forge"], ["viking", "oiler"], ["viking", "lumberjack"],
    ["elemental", "summit"], ["reptile", "swamp"], ["horned", "longhorn"], ["sea", "angler"], ["sea", "kraken"], ["elemental", "salt"], ["elemental", "lighthouse"], ["alien", "alien"], ["pirate", "skull"], ["viking", "miner"]
  ];
  const NLOGO = 90;
  function forLogo(i) {
    i = ((Number(i) || 0) % NLOGO + NLOGO) % NLOGO;
    const e = EMBLEM_V193AI[i], A = ARCH[e[0]], v = VAR[e[0]][e[1]];
    let crest = ""; try { crest = (window.TEAM_LOGOS_V44 && window.TEAM_LOGOS_V44.name(i)) || ""; } catch (x) {}
    return { logo: i, arch: e[0], variant: e[1], archName: A.name, name: v.name, crest };
  }
  function logoForTeam(name) {
    try { const TL = window.TEAM_LOGOS_V44; if (TL && TL.forName) { const i = TL.forName(name); if (i != null) return i; } } catch (e) {}
    let h = 0; const s = String(name || "").toLowerCase().replace(/[^a-z]/g, ""); for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) >>> 0; return h % NLOGO;
  }
  function forTeam(name, logo) { return forLogo(logo != null ? logo : logoForTeam(name)); }

  /* ---------------- the painter (logical px, canvas paths; snapped to pixels afterwards) ---------------- */
  function painter(c) {
    const D = {
      c,
      circ(x, y, r, col) { c.beginPath(); c.arc(x, y, Math.max(0.3, r), 0, Math.PI * 2); c.fillStyle = col; c.fill(); },
      ell(x, y, rx, ry, col, rot) { c.beginPath(); c.ellipse(x, y, Math.max(0.3, rx), Math.max(0.3, ry), rot || 0, 0, Math.PI * 2); c.fillStyle = col; c.fill(); },
      poly(p, col) { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); c.fillStyle = col; c.fill(); },
      line(x1, y1, x2, y2, w, col) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineWidth = w; c.strokeStyle = col; c.lineCap = "round"; c.lineJoin = "round"; c.stroke(); },
      pl(p, w, col) { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.lineWidth = w; c.strokeStyle = col; c.lineCap = "round"; c.lineJoin = "round"; c.stroke(); },
      arc(x, y, r, a0, a1, w, col) { c.beginPath(); c.arc(x, y, r, a0, a1); c.lineWidth = w; c.strokeStyle = col; c.lineCap = "round"; c.stroke(); },
      rect(x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); },
      // both sides: fn(s) with s = -1 (his right, screen left) and +1
      sym(fn) { fn(-1); fn(1); },
      save() { c.save(); }, restore() { c.restore(); },
      at(x, y, rot) { c.save(); c.translate(x, y); if (rot) c.rotate(rot); }
    };
    return D;
  }
  const INK = "#17131c";
  // eyes: kind "angry" (white, pupil, a brow), "beady", "glow" (one colour, no white), "slit" (an iris with a slit), "big"
  function eyes(D, dx, y, kind, iris, o) {
    o = o || {};
    D.sym((s) => {
      const x = s * dx;
      if (kind === "beady") { D.circ(x, y, 1.25, INK); D.rect(x - 0.6, y - 0.9, 0.8, 0.8, "#ffffff"); }
      else if (kind === "glow") { D.ell(x, y, 1.7, 1.1, iris || "#7cffd8", s * -0.25); }
      else if (kind === "slit") { D.ell(x, y, 2, 1.6, iris || "#f2d43a"); D.rect(x - 0.45, y - 1.5, 0.9, 3, INK); }
      else if (kind === "big") { D.circ(x, y, o.r || 2.8, "#ffffff"); D.circ(x + s * -0.3, y + 0.5, (o.r || 2.8) * 0.55, iris || INK); D.rect(x - 0.4, y - 0.8, 0.9, 0.9, "#ffffff"); }
      else { D.ell(x, y, 2.1, 2.2, "#ffffff"); D.circ(x - s * 0.5, y + 0.4, 1.25, iris && iris !== "#ffffff" ? iris : INK); D.circ(x - s * 0.5, y + 0.4, 0.6, INK); }
      if (o.brow !== false && kind !== "glow") D.line(x + s * 2.6, y - (o.browUp || 2.9), x - s * 1.4, y - 1.8, 1.3, o.browCol || INK);
    });
  }
  function grin(D, y, w, o) {
    o = o || {};
    D.poly([-w, y - 0.5, w, y - 0.5, w * 0.55, y + (o.h || 2.4), -w * 0.55, y + (o.h || 2.4)], o.col || "#5a1420");
    D.rect(-w + 0.6, y - 0.6, w * 2 - 1.2, 0.9, "#ffffff");
    if (o.fangs) D.sym((s) => D.poly([s * (w - 0.6), y, s * (w - 1.9), y, s * (w - 1.2), y + 1.8], "#ffffff"));
  }
  function teethRow(D, x0, x1, y, dir, n) {
    const step = (x1 - x0) / n;
    for (let i = 0; i < n; i++) D.poly([x0 + i * step, y, x0 + (i + 1) * step, y, x0 + (i + 0.5) * step, y + dir * 1.7], "#ffffff");
  }

  /* ---------------- the heads (centre (0,0), radius ~9 logical px; T = {p1, p2} the team) ---------------- */
  const HEADS = {
    wolf(D, v) {
      const tall = v.tall ? 4 : 0;
      D.sym((s) => {
        if (v.round) { D.circ(s * 7, -7.5, 3.6, v.fur); D.circ(s * 7, -7.5, 1.8, shade(v.fur, 0.6)); }
        else {
          D.poly([s * 8.6, -3, s * 7.4, -14 - tall, s * 1.8, -7.5], v.fur);
          D.poly([s * 7, -5.2, s * 6.8, -11.6 - tall, s * 3.6, -7.4], v.gold ? v.gold : "#e9a3a8");
          if (v.gold) D.poly([s * 6.6, -6, s * 6.5, -10.5 - tall, s * 4.4, -7.6], v.fur);
        }
        D.poly([s * 8.2, 0, s * 11.4, 4.6, s * 6.8, 6.4], v.fur2);   // the cheek fluff
      });
      D.circ(0, 0, 9, v.fur);
      D.ell(0, -6, 6.4, 2.6, shade(v.fur, 0.78));
      if (v.spots) [[-5, -4], [4.5, -5], [-6, 2], [6, 1.5], [0, -7]].forEach((p) => D.circ(p[0], p[1], 1.1, v.spots));
      if (v.gold) { D.rect(-7.5, -5.4, 15, 1.4, v.gold); D.rect(-1, -9, 2, 4, v.gold); }
      D.ell(0, 4.2, 4.8, 3.7, v.fur2);
      D.ell(0, 1.7, 2.2, 1.4, INK);
      D.line(0, 2.6, 0, 5, 0.9, INK);
      D.line(-2.6, 5.7, 2.6, 5.7, 0.9, INK);
      D.sym((s) => D.poly([s * 1.6, 5.6, s * 2.6, 5.6, s * 2.1, 7.2], "#ffffff"));
      eyes(D, 3.7, -1.6, "angry", v.eye);
      if (v.scar) D.line(-5.8, -4.6, -2.8, 0.6, 0.9, "#e8a0a0");
    },
    bear(D, v) {
      if (v.ape) {
        D.sym((s) => D.circ(s * 8.8, 0.5, 2.3, v.fur));
        D.ell(0, -0.5, 9, 9.6, v.fur);
        D.ell(0, 2.8, 6.6, 5.8, v.fur2);
        D.ell(0, -3.4, 7.2, 2.3, shade(v.fur, 0.75));
        D.sym((s) => D.circ(s * 1.3, 2.2, 0.8, INK));
        D.line(-3, 5.6, 3, 5.6, 1, INK);
        eyes(D, 3.4, -1.4, "angry", "#5a3a1a", { browUp: 2.4 });
        return;
      }
      if (v.shaggy) {
        for (let k = -4; k <= 4; k++) D.poly([k * 2 - 1.6, -6, k * 2 + 1.6, -6, k * 2.1, -11.8 + Math.abs(k) * 0.5], v.fur);
        D.sym((s) => D.poly([s * 8, -2, s * 11.5, 2, s * 8.2, 4], v.fur));
      } else D.sym((s) => { D.circ(s * 6.6, -7, 3.3, v.fur); D.circ(s * 6.6, -7, 1.7, v.ear || shade(v.fur, 0.65)); });
      D.circ(0, 0, 9.2, v.fur);
      if (v.shaggy) {
        D.ell(0, 1.2, 6.4, 6.2, v.fur2);
        eyes(D, 3, -1.4, "angry", null, { browUp: 2.6 });
        D.ell(0, 1.8, 1.6, 1.1, INK);
        grin(D, 4.6, 3.6, { fangs: v.fangs, h: 2.6 });
        return;
      }
      D.ell(0, 3.8, 5.2, 3.8, v.fur2);
      D.ell(0, 1.9, 2.4, 1.6, INK);
      D.line(0, 3, 0, 4.6, 0.9, INK);
      D.arc(-1.3, 4.6, 1.3, 0, Math.PI, 0.9, INK); D.arc(1.3, 4.6, 1.3, 0, Math.PI, 0.9, INK);
      eyes(D, 3.7, -2, "beady");
      D.sym((s) => D.line(s * 5.2, -4.4, s * 2.2, -3.6, 1.2, shade(v.fur, 0.45)));
    },
    cat(D, v) {
      if (v.mane) {
        const pts = []; for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2, r = k % 2 ? 12.2 : 14.4; pts.push(Math.cos(a) * r, Math.sin(a) * r * 0.98 + 0.8); }
        D.poly(pts, v.mane); D.circ(0, 0.8, 11, shade(v.mane, 1.2));
      }
      D.sym((s) => { D.poly([s * 8.4, -2.4, s * 7.4, -12.2, s * 2.4, -8], v.fur); D.poly([s * 7, -4.2, s * 6.6, -10, s * 4, -7.4], v.mane ? shade(v.mane, 1.3) : "#e9a3a8"); });
      D.circ(0, 0, 8.8, v.fur);
      if (v.stripes) {
        D.sym((s) => { D.poly([s * 8.8, -2, s * 5.4, -1, s * 8.6, 0.6], v.stripes); D.poly([s * 8.4, 2.8, s * 5.6, 2.8, s * 8, 4.4], v.stripes); });
        D.poly([-1, -8.8, 1, -8.8, 0, -4.8], v.stripes); D.poly([-3.6, -8.2, -2, -8.6, -2.6, -5.4], v.stripes); D.poly([3.6, -8.2, 2, -8.6, 2.6, -5.4], v.stripes);
      }
      if (v.spots) [[-5.4, -4.4], [5, -5], [-6.6, 1.2], [6.6, 0.6], [-2.2, -6.6], [2.6, -7]].forEach((p) => { D.circ(p[0], p[1], 1.2, v.spots); D.circ(p[0], p[1], 0.5, v.fur); });
      D.sym((s) => D.ell(s * 2, 4, 2.7, 2.2, v.fur2));
      D.ell(0, 6, 2, 1.4, v.fur2);
      D.poly([-1.6, 1.8, 1.6, 1.8, 0, 3.4], "#e8789a");
      D.line(0, 3.4, 0, 4.6, 0.8, INK);
      D.sym((s) => { D.line(s * 3.6, 4.2, s * 8.4, 3.4, 0.6, "#ffffff"); D.line(s * 3.6, 5.2, s * 8.2, 6, 0.6, "#ffffff"); });
      eyes(D, 3.6, -1.6, "slit", v.eye || "#f2d43a", { browUp: 2.6 });
      if (v.crown) {
        const g = "#f2c84a";
        D.poly([-6.2, -8.6, 6.2, -8.6, 7, -14, 4, -11, 2, -15.4, 0, -11.6, -2, -15.4, -4, -11, -7, -14], g);
        D.rect(-6.2, -9.6, 12.4, 1.6, shade(g, 0.75));
        D.circ(0, -10.6, 1, "#d81a3a"); D.circ(-4, -10.2, 0.8, "#3a8ae0"); D.circ(4, -10.2, 0.8, "#3a8ae0");
      }
    },
    bird(D, v) {
      if (v.flame) { D.poly([-4, -7, -6, -16, -1.6, -10.4, 0, -18, 1.8, -10.4, 6, -16, 4, -7], v.fur2); D.poly([-2.4, -7.5, -3, -13, 0, -9.6, 3, -13, 2.4, -7.5], "#ffffff"); }
      if (v.owl) D.sym((s) => D.poly([s * 4.4, -7, s * 9.2, -13.6, s * 8.6, -4.6], v.head));
      D.sym((s) => D.poly([s * 7.6, -1, s * 11, 1.6, s * 7.6, 4.6, s * 10.2, 5.8, s * 6.4, 7.4], v.owl ? v.head : shade(v.head, 0.9)));
      if (v.owl) D.ell(0, 0, 10, 9, v.head); else D.circ(0, 0, 9, v.head);
      if (v.owl) {
        D.sym((s) => D.circ(s * 3.9, -0.6, 4.2, v.fur2));
        eyes(D, 3.9, -0.6, "big", v.eye, { r: 2.6, brow: false });
        D.poly([-1.4, 2, 1.4, 2, 0, 5.4], v.beak);
        D.sym((s) => D.line(s * 7.4, -4.6, s * 1.2, -2.6, 1.3, shade(v.head, 0.55)));
        return;
      }
      if (v.fur2 !== v.head && !v.flame) D.ell(0, 3.4, 6.4, 4.4, v.fur2);
      eyes(D, 4.2, -2.2, "angry", v.eye, { browUp: 2.5, browCol: shade(v.head, 0.35) });
      D.sym((s) => D.line(s * 7.6, -5.4, s * 1.4, -3.4, 1.6, shade(v.head, lum(v.head) > 0.6 ? 0.75 : 0.55)));
      D.poly([-3.4, 0.4, 3.4, 0.4, 2.6, 3.4, 0.9, 7.2, 0, 8, -0.9, 7.2, -2.6, 3.4], v.beak);
      D.poly([-3.4, 0.4, 3.4, 0.4, 2.8, 1.8, -2.8, 1.8], shade(v.beak, 1.25));
      D.poly([0.9, 6, 0, 8, -0.9, 6], shade(v.beak, 0.6));
      D.sym((s) => D.rect(s * 1.2 - 0.35, 2, 0.7, 0.7, INK));
    },
    reptile(D, v) {
      if (v.cobra) {
        D.ell(0, 1, 13, 11, v.hood); D.ell(0, 1.5, 9.6, 8.6, shade(v.hood, 1.25));
        D.sym((s) => { D.circ(s * 7.6, -0.4, 1.4, v.fur2); D.circ(s * 7.6, -0.4, 0.6, INK); });
        D.ell(0, -1, 6.4, 7.2, v.fur);
        D.ell(0, 2.4, 4.2, 4.4, v.fur2);
        eyes(D, 2.9, -3, "slit", v.eye, { browUp: 2.2 });
        D.pl([0, 6.2, 0, 8.6, -1.2, 10.2], 0.8, "#e8283a"); D.line(0, 8.6, 1.2, 10.2, 0.8, "#e8283a");
        D.sym((s) => D.poly([s * 1.6, 4.6, s * 2.4, 4.6, s * 2, 6.4], "#ffffff"));
        return;
      }
      if (v.dragon) {
        D.sym((s) => { D.poly([s * 4.2, -6.4, s * 6.4, -7.4, s * 12, -15.2, s * 10.4, -16.6, s * 7.6, -10.6], v.horn); D.poly([s * 8.6, -1, s * 12.6, -3.4, s * 9, 2.4], v.fur); });
        for (let k = 0; k < 3; k++) D.poly([-1.4, -8.6 + k * 2.6, 1.4, -8.6 + k * 2.6, 0, -11.6 + k * 2.6], v.fur2);
      }
      if (v.serpent) {
        for (let k = -2; k <= 2; k++) D.poly([k * 2.6 - 1.2, -7, k * 2.6 + 1.2, -7, k * 2.9, -14 + Math.abs(k) * 1.4], v.fin);
        D.sym((s) => D.poly([s * 8, -2, s * 13, -6, s * 12, 0, s * 8.6, 2], v.fin));
      }
      if (v.swamp) D.sym((s) => D.poly([s * 7, -6, s * 10.6, -1, s * 9.6, 7.6, s * 8, 3], v.moss));
      if (v.gator) {
        D.ell(0, -1.2, 8.6, 8, v.fur);
        D.sym((s) => { D.circ(s * 4.4, -6.6, 3.1, v.fur); D.ell(s * 4.4, -6.8, 1.9, 1.7, v.eye); D.rect(s * 4.4 - 0.4, -8.2, 0.8, 2.8, INK); D.line(s * 6.4, -9.4, s * 2.2, -8.8, 1.1, INK); });
        D.ell(0, 4.2, 9.4, 4.6, shade(v.fur, 1.12));
        D.ell(0, 6.2, 8.4, 2.6, v.fur2);
        D.line(-8.6, 5.2, 8.6, 5.2, 1, INK);
        teethRow(D, -7.6, 7.6, 5.2, 1, 7); teethRow(D, -6.6, 6.6, 5.4, -1, 6);
        D.sym((s) => D.circ(s * 1.8, 1.4, 0.7, INK));
        return;
      }
      D.circ(0, 0, 8.8, v.fur);
      if (v.swamp) { D.ell(0, -6, 7, 3, v.moss); [[-5, -3], [3.6, -4.4], [6, -1], [-6.8, 1]].forEach((p) => D.line(p[0], p[1], p[0] + 0.3, p[1] + 3.6, 1.1, v.moss)); }
      D.ell(0, 4, 6, 4.2, v.fur2);
      D.sym((s) => D.circ(s * 1.8, 1.8, 0.7, INK));
      if (v.friendly) { eyes(D, 3.6, -2.6, "big", INK, { r: 2.4, brow: false }); D.arc(0, 3.6, 2.8, 0.25, Math.PI - 0.25, 1, INK); return; }
      eyes(D, 3.8, -2.4, v.swamp ? "glow" : "slit", v.eye, { browUp: 2.4 });
      D.line(-4.6, 5.4, 4.6, 5.4, 1, INK);
      D.sym((s) => D.poly([s * 2.6, 5.4, s * 3.8, 5.4, s * 3.2, 7.4], "#ffffff"));
      if (v.dragon) D.sym((s) => D.circ(s * 1.8, 1.8, 0.45, "#ff8a2a"));
    },
    horned(D, v) {
      if (v.unicorn) {
        D.poly([-5, -9, 5, -9, 6, 4, 4, 9.6, -4, 9.6, -6, 4], v.fur);
        D.sym((s) => D.poly([s * 3.4, -8, s * 6.6, -14.4, s * 6.4, -7], v.fur));
        D.ell(0, 6.6, 5.4, 4, v.fur2);
        D.sym((s) => D.ell(s * 2, 6.8, 0.9, 1.3, "#c87a9a"));
        D.poly([-1.6, -9.2, 1.6, -9.2, 0, -20], v.horn);
        D.line(-1, -11.6, 1, -12.6, 0.7, shade(v.horn, 0.7)); D.line(-0.7, -14.6, 0.7, -15.4, 0.7, shade(v.horn, 0.7));
        D.poly([-6, -8, 1, -12, 0.6, -7, 4, -10, 2, -4, -3, -4], v.mane);
        D.poly([-5.6, -4, -10.6, 0, -6.6, 2, -10, 6, -6, 6], v.mane);
        eyes(D, 3.3, -2.4, "big", "#4a2a6a", { r: 2.3, brow: false });
        D.sym((s) => D.line(s * 3, -5.6, s * 5.2, -5.2, 0.7, INK));
        return;
      }
      if (v.ram) {
        D.circ(0, -0.4, 9, v.fur);
        [[-6, -6], [-2.6, -8.6], [1.6, -8.8], [5.4, -6.6], [7.8, -2.6], [-8, -2.6]].forEach((p) => D.circ(p[0], p[1], 2.8, v.fur));
        D.ell(0, 2.6, 5, 6.6, v.fur2);
        D.sym((s) => { D.circ(s * 9.2, -0.8, 5, v.horn); D.circ(s * 9.2, -0.8, 3.1, shade(v.horn, 0.72)); D.circ(s * 9.2, -0.8, 1.6, v.horn); D.circ(s * 9.2, -0.8, 0.6, shade(v.horn, 0.6)); });
        D.ell(0, 6.6, 2.6, 1.6, shade(v.fur2, 0.7));
        eyes(D, 2.9, -0.6, "angry", "#c8a020", { browUp: 2.2 });
        return;
      }
      if (v.stag) {
        D.sym((s) => {
          D.pl([s * 3.4, -7.6, s * 6, -13, s * 7, -18.6], 1.6, v.horn); D.pl([s * 5, -10.6, s * 9.6, -12.4], 1.4, v.horn); D.pl([s * 6.2, -14.4, s * 10.2, -17.6], 1.3, v.horn); D.pl([s * 6, -13, s * 3.6, -17], 1.2, v.horn);
          D.ell(s * 9.4, -3.6, 3.2, 1.7, v.fur, s * -0.4); D.ell(s * 9.4, -3.6, 1.8, 0.8, "#e8a0a8", s * -0.4);
        });
      }
      if (v.bull || v.bison) {
        const L = v.long ? 1.7 : 1;
        D.sym((s) => {
          if (v.bison) D.poly([s * 6, -5.4, s * 11.4, -6, s * 12.6, -11, s * 10.6, -9.4, s * 6.6, -8.4], v.horn);
          else D.poly([s * 5.6, -4.6, s * 12 * L, -5.4, s * 14.6 * L - s * (L - 1) * 3, -12, s * 11.6 * L - s * (L - 1) * 2, -8.6, s * 6, -7.8], v.horn);
          D.ell(s * 9, -1, 2.8, 1.6, v.fur, s * 0.3);
        });
      }
      if (v.boar) D.sym((s) => D.poly([s * 4, -6.6, s * 8.6, -13, s * 8.8, -4.6], v.fur));
      if (v.rhino) D.sym((s) => D.ell(s * 5.8, -7.6, 1.8, 3, v.fur, s * 0.4));
      if (v.bison) for (let k = -3; k <= 3; k++) D.circ(k * 2.4, -7 + Math.abs(k) * 0.6, 2.8, v.fur2);
      if (v.bison) D.poly([-5, 5, 5, 5, 3, 13, 0, 11, -3, 13], shade(v.fur, 0.6));
      D.ell(0, 0, 8.8, 9, v.fur);
      if (v.bison) for (let k = -2; k <= 2; k++) D.circ(k * 2.6, -6.4 + Math.abs(k) * 0.7, 2.6, v.fur2);
      if (v.boar) {
        for (let k = -2; k <= 2; k++) D.poly([k * 2 - 1, -8.2, k * 2 + 1, -8.2, k * 2, -11.6], shade(v.fur, 0.55));
        D.ell(0, 4, 4, 3.2, v.fur2);
        D.sym((s) => D.ell(s * 1.4, 4, 0.8, 1.2, shade(v.fur2, 0.45)));
        D.sym((s) => D.poly([s * 3.4, 7, s * 4.8, 6.4, s * 6.8, 0.6, s * 5.2, 4.2], v.horn));
        eyes(D, 3.6, -2.4, "angry", v.eye || "#c8a020", { browUp: 2.4 });
        return;
      }
      D.ell(0, 4.6, 6.2, 4.2, v.fur2);
      if (v.rhino) { D.poly([-2.6, 3, 2.6, 3, 1.2, -6.6, 0.2, -9], v.horn); D.poly([-1.4, -2.6, 1.4, -2.6, 0.2, -6.4], shade(v.horn, 0.8)); }
      D.sym((s) => D.ell(s * 2.3, 4.6, 0.9, 1.3, shade(v.fur2, 0.4)));
      if (v.bull) D.arc(0, 6.6, 1.9, 0.1, Math.PI - 0.1, 1, "#f2c84a");
      eyes(D, 3.7, -2.4, v.stag ? "big" : "angry", v.stag ? INK : "#8a1a1a", v.stag ? { r: 2.2, brow: false } : { browUp: 2.5 });
    },
    sea(D, v) {
      if (v.shark) {
        D.poly([-3, -7.6, 3.4, -7.6, -2.6, -18.6], v.fur);
        D.ell(0, 0, 9.4, 9.2, v.fur);
        D.ell(0, 4.6, 8, 4.4, v.fur2);
        D.ell(0, 4.6, 6.2, 2.8, "#7a1a26");
        teethRow(D, -5.6, 5.6, 2.6, 1, 6); teethRow(D, -5, 5, 6.8, -1, 5);
        D.sym((s) => { D.circ(s * 5.2, -1.6, 1.3, INK); D.line(s * 7.4, -4.6, s * 3, -3.4, 1.3, shade(v.fur, 0.5)); D.line(s * 8.4, 1.2, s * 8.8, 3.6, 0.6, shade(v.fur, 0.6)); });
        return;
      }
      if (v.angler) {
        D.pl([0, -8.4, 1.4, -14, 6.4, -17], 1, shade(v.fur, 1.3));
        D.circ(6.6, -17.4, 2.2, "#9dff6a"); D.circ(6.2, -17.8, 0.9, "#f2ffd8");
        D.circ(0, 0, 9.4, v.fur);
        D.sym((s) => D.poly([s * 8.4, -3, s * 12.4, -6, s * 11.4, 1], v.fur2));
        D.ell(0, 4.2, 8.6, 4.8, "#3a0e1a");
        teethRow(D, -7.4, 7.4, 0.8, 1, 7); teethRow(D, -7.4, 7.4, 8, -1, 7);
        D.sym((s) => { D.circ(s * 3.8, -3.6, 1.9, "#ffffff"); D.circ(s * 3.6, -3.4, 0.9, INK); });
        return;
      }
      if (v.crab) {
        D.sym((s) => { D.line(s * 3, -4, s * 4.6, -12, 1.2, v.fur); D.circ(s * 4.8, -12.6, 2.4, "#ffffff"); D.circ(s * 4.8, -12.2, 1.2, INK); });
        D.ell(0, 0, 11, 7.4, v.fur);
        D.ell(0, 2.6, 8, 4, v.fur2);
        D.sym((s) => D.poly([s * 10.6, -2, s * 13, -3.6, s * 11.6, 1.6], v.fur));
        D.arc(0, 2, 3, 0.25, Math.PI - 0.25, 1, INK);
        D.sym((s) => D.line(s * 5.4, -3.6, s * 2.4, -2.6, 1.1, INK));
        return;
      }
      // octopus / kraken: a tall bulb
      D.ell(0, -2.4, 9.6, 11, v.fur);
      [[-4.4, -8], [3.6, -9.6], [6, -4], [-6.6, -2.6], [0, -11.6]].forEach((p) => D.circ(p[0], p[1], 1.3, v.fur2));
      D.sym((s) => D.poly([s * 7, 4, s * 10.6, 8.4, s * 6.4, 7.4], v.fur));
      if (v.angry) eyes(D, 3.8, 1, "angry", "#ffd23a", { browUp: 2.6 }); else eyes(D, 3.6, 1, "big", INK, { r: 2.6, brow: false });
      D.ell(0, 6.2, 1.6, 1.2, shade(v.fur, 0.45));
    },
    bug(D, v) {
      if (v.mantis) {
        D.sym((s) => D.pl([s * 3, -7, s * 6.6, -14.6, s * 10, -16.6], 0.8, v.head));
        D.poly([-10.6, -6.4, 10.6, -6.4, 7, 2, 0, 9.4, -7, 2], v.head);
        D.sym((s) => { D.ell(s * 7.4, -5.6, 3.8, 3.2, "#f6ff9a"); D.circ(s * 7.8, -5.2, 1.3, INK); });
        D.sym((s) => D.poly([s * 0.6, 8.6, s * 2.8, 7, s * 1.6, 10.4], shade(v.head, 0.6)));
        D.line(-3, 3.4, 3, 3.4, 0.9, shade(v.head, 0.5));
        return;
      }
      if (!v.scorpion && !v.centi && !v.widow) D.sym((s) => { D.pl([s * 2.4, -7.6, s * 4.6, -13, s * 7.4, -15.6], 0.9, INK); D.circ(s * 7.6, -15.8, 1.5, v.scarab ? v.fur2 : INK); });
      if (v.centi || v.widow) D.sym((s) => D.pl([s * 2.6, -7.6, s * 5.6, -11.6, s * 9, -12.4], 0.9, v.widow ? v.head : v.fur2));
      D.circ(0, 0, 9, v.head);
      if (v.bee) { D.rect(-8.6, -4.6, 17.2, 2.2, INK); D.ell(0, -8.2, 4.6, 1.4, INK); }
      if (v.scorpion) { D.arc(0, 3, 9.4, Math.PI * 1.15, Math.PI * 1.85, 0.9, shade(v.head, 0.6)); D.arc(0, 6, 9.4, Math.PI * 1.2, Math.PI * 1.8, 0.9, shade(v.head, 0.6)); }
      if (v.centi) for (let k = -1; k <= 1; k++) D.arc(0, k * 4 + 3, 9.4, Math.PI * 1.15, Math.PI * 1.85, 0.8, shade(v.head, 0.65));
      if (v.scarab) { D.poly([-1.6, -8.4, 1.6, -8.4, 0, -15.4], v.fur2); D.ell(-3, -4, 2.6, 1.4, shade(v.head, 1.4), -0.4); }
      if (v.widow || v.scorpion) {
        const ec = v.eye || (v.widow ? "#ff2a3a" : "#ff6a6a");
        D.sym((s) => { D.circ(s * 2.6, -2, 1.7, ec); D.circ(s * 5.6, -3.2, 1, ec); D.circ(s * 6, -0.2, 0.9, ec); });
        D.sym((s) => { D.line(s * 3.2, -4.6, s * 1, -3.8, 1, shade(v.head, 1.6)); D.poly([s * 1.2, 4, s * 3, 4, s * 2.4, 7.6], v.widow ? "#d8d8e0" : v.fur2); });
        return;
      }
      if (v.centi) { D.sym((s) => { D.circ(s * 3.6, -2, 1.6, INK); D.poly([s * 1, 4.4, s * 3.4, 4.6, s * 2.4, 8], v.fur2); }); return; }
      // compound eyes
      D.sym((s) => { D.ell(s * 4.6, -0.4, 3.1, 3.9, INK, s * 0.25); D.ell(s * 4, -1.8, 0.9, 1.2, "#ffffff", s * 0.25); });
      if (v.angry) D.sym((s) => D.line(s * 7.4, -5, s * 2, -3.4, 1.4, INK));
      D.arc(0, 4, 2.4, 0.3, Math.PI - 0.3, 1, INK);
      if (v.firefly) D.sym((s) => D.circ(s * 6.2, 4.6, 0.9, "#ffb4b4"));
    },
    knight(D, v, T) {
      const st = v.steel, dk = shade(st, 0.66), tr = v.trim || shade(st, 0.8);
      if (v.cavalier) {
        D.circ(0, 1, 8.4, "#eab48a");
        D.ell(0, -5.6, 13.6, 3, v.steel); D.ell(0, -8.6, 7, 4.6, v.steel); D.rect(-7, -6.8, 14, 1.4, T.p1);
        D.pl([4, -9, 9, -15, 14, -14.6], 2.6, "#ffffff"); D.pl([5, -9.4, 9.4, -13.6, 13, -13.6], 1, "#d8dce4");
        D.rect(-7, -2.4, 14, 3, INK); D.sym((s) => D.circ(s * 3.2, -1, 1, "#ffffff"));
        D.pl([-4.6, 4.4, -1.6, 3.4, 0, 4, 1.6, 3.4, 4.6, 4.4], 1.4, "#3a2412");
        D.poly([-1.6, 6.6, 1.6, 6.6, 0, 9.8], "#3a2412");
        return;
      }
      if (v.samurai) {
        D.ell(0, -1, 9.6, 9, st);
        D.poly([-12.6, 2.6, -8.8, -3, -8, 5], st); D.poly([12.6, 2.6, 8.8, -3, 8, 5], st);
        D.sym((s) => D.poly([s * 1, -6, s * 2.4, -7, s * 9, -17, s * 7.6, -17.4], v.trim));
        D.circ(0, -6.6, 1.6, v.trim);
        D.poly([-7, -2.2, 7, -2.2, 6.4, 7.6, -6.4, 7.6], v.armor);
        D.rect(-6, -1.4, 12, 1.8, INK); D.sym((s) => D.rect(s * 3.4 - 1, -1.2, 2, 1.2, "#ffffff"));
        teethRow(D, -3.6, 3.6, 4, 1, 4); D.line(-4, 3.8, 4, 3.8, 0.8, INK);
        return;
      }
      if (v.valk) {
        D.sym((s) => { D.poly([s * 7, -4, s * 15, -11, s * 14, -6, s * 16, -5, s * 9, 0], "#ffffff"); D.line(s * 9, -3, s * 14, -7.4, 0.6, "#c8ccd6"); });
        D.circ(0, 1, 8.4, "#eab48a");
        D.sym((s) => D.pl([s * 7.4, 0, s * 8.6, 6, s * 7.4, 11], 2.2, v.trim));
        D.poly([-9, -1, -8.6, -6, -4, -9.6, 4, -9.6, 8.6, -6, 9, -1, 5, -3, -5, -3], st);
        D.rect(-0.8, -3.4, 1.6, 4.6, dk);
        eyes(D, 3.4, 0.6, "angry", "#3a7ae0", { browUp: 2.4, browCol: "#8a5a1a" });
        D.arc(0, 4.2, 2.2, 0.3, Math.PI - 0.3, 1, "#8a2a2a");
        return;
      }
      // the great helm
      if (v.sun) for (let k = 0; k < 9; k++) { const a = Math.PI + (k / 8) * Math.PI; D.poly([Math.cos(a - 0.12) * 8, Math.sin(a - 0.12) * 8 - 1, Math.cos(a) * 14, Math.sin(a) * 14 - 1, Math.cos(a + 0.12) * 8, Math.sin(a + 0.12) * 8 - 1], v.trim); }
      if (v.ice) for (let k = -2; k <= 2; k++) D.poly([k * 3 - 1.4, -7.6, k * 3 + 1.4, -7.6, k * 3.2, -14.6 + Math.abs(k) * 1.8], "#e8f8ff");
      if (v.helmWings) D.sym((s) => D.poly([s * 7.6, -3, s * 14.6, -10.6, s * 13.2, -5.6, s * 15, -4, s * 9, 1], "#ffffff"));
      if (!v.sun && !v.ice && !v.crown && !v.spiky) {
        const pc = v.moon ? v.trim : T.p1 === st ? T.p2 : T.p1;
        D.ell(1.2, -11.6, 2.6, 3.6, pc); D.ell(3.6, -14.4, 2.4, 3.2, pc, 0.5); D.ell(6.4, -15.6, 2.1, 2.6, pc, 0.9); D.ell(0.6, -9.4, 2.2, 2, shade(pc, 0.8));
      }
      if (v.spiky) for (let k = -2; k <= 2; k++) D.poly([k * 3.2 - 1.2, -7.4, k * 3.2 + 1.2, -7.4, k * 3.6, -13.4 + Math.abs(k) * 1.2], "#cfd3da");
      D.poly([-8.8, 9.4, -9.4, 0, -8.6, -5.4, -5, -9, 0, -10.2, 5, -9, 8.6, -5.4, 9.4, 0, 8.8, 9.4], st);
      D.poly([-8.8, 9.4, -9.4, 0, -8.6, -5.4, -7.6, -6.6, -7.6, 9.4], shade(st, 1.25));
      D.poly([3.4, -9.6, 5, -9, 8.6, -5.4, 9.4, 0, 8.8, 9.4, 6.6, 9.4, 6.6, -5], dk);
      D.rect(-0.8, -10, 1.6, 19.4, tr);
      D.rect(-7.6, -1.6, 15.2, 2.6, INK);
      if (v.eye) D.sym((s) => D.rect(s * 3.6 - 1.2, -1, 2.4, 1.4, v.eye));
      for (let k = -2; k <= 2; k++) if (k) { D.rect(k * 1.8 - 0.45, 3.6, 0.9, 0.9, INK); D.rect(k * 1.8 - 0.45, 5.6, 0.9, 0.9, INK); }
      if (v.moon) { D.circ(0, -6.4, 2.6, v.trim); D.circ(1.2, -7, 2.2, st); }
      if (v.trim && !v.moon) { D.rect(-8.8, 8.2, 17.6, 1.4, v.trim); }
      if (v.crown) {
        const g = "#f2c84a";
        D.poly([-7, -7.4, 7, -7.4, 8, -13.4, 4.6, -10.6, 2.4, -15, 0, -11.4, -2.4, -15, -4.6, -10.6, -8, -13.4], g);
        D.rect(-7, -8.6, 14, 1.6, shade(g, 0.75)); D.circ(0, -9.6, 1, "#d81a3a"); D.circ(-4.4, -9.4, 0.8, "#3a8ae0"); D.circ(4.4, -9.4, 0.8, "#3a8ae0");
      }
    },
    spartan(D, v, T) {
      const crest = v.crest || T.p1, br = v.bronze, dk = shade(br, 0.62);
      D.ell(0, -13, 11.4, 4.2, crest); D.poly([-11.4, -13, 11.4, -13, 9, -8, -9, -8], crest);
      for (let k = -4; k <= 4; k++) D.line(k * 2.4, -16, k * 2.2, -10, 0.6, shade(crest, 0.7));
      D.poly([-9, 9.6, -9.6, 0, -8.8, -5.6, -5, -9.2, 5, -9.2, 8.8, -5.6, 9.6, 0, 9, 9.6, 3.2, 9.6, 1.6, 2, -1.6, 2, -3.2, 9.6], br);
      D.poly([3.4, -9.4, 5, -9.2, 8.8, -5.6, 9.6, 0, 9, 9.6, 6.4, 9.6, 6.4, -5], dk);
      D.poly([-7, -2.6, 7, -2.6, 6, 0.6, 1.6, 0.6, 1.6, 9.6, -1.6, 9.6, -1.6, 0.6, -6, 0.6], INK);
      D.sym((s) => D.ell(s * 3.6, -1, 1.2, 0.7, "#ffffff"));
      D.line(-8.4, -4.4, 8.4, -4.4, 0.8, shade(br, 1.3));
    },
    viking(D, v, T) {
      if (v.bearhood) {
        D.sym((s) => D.circ(s * 7, -9.6, 2.8, v.pelt));
        D.ell(0, -4, 11, 8.6, v.pelt); D.ell(0, -8.4, 5, 3, shade(v.pelt, 1.25)); D.ell(0, -9.2, 1.8, 1.1, INK);
      }
      if (v.hair) for (let k = -4; k <= 4; k++) D.poly([k * 2.2 - 1.8, -5, k * 2.2 + 1.8, -5, k * 2.5, -12.6 + Math.abs(k) * 0.7], v.beard);
      D.circ(0, 0.6, 8.4, v.skin);
      if (v.hair) D.sym((s) => D.poly([s * 8.4, -4, s * 10.4, 4, s * 7.4, 2], v.beard));
      // the beard and the moustache
      D.poly([-8.2, 1, -8, 6, -5, 11, -2.4, 13.4, 0, 12, 2.4, 13.4, 5, 11, 8, 6, 8.2, 1, 5, 4.6, -5, 4.6], v.beard);
      D.poly([-5.4, 4.4, -1, 3, 1, 3, 5.4, 4.4, 4, 6, 0, 5, -4, 6], shade(v.beard, 0.8));
      D.ell(0, 6, 1.8, 1, "#7a2a2a");
      D.ell(0, 1.6, 1.4, 1.6, shade(v.skin, 0.85));
      eyes(D, 3.4, -1.2, "angry", "#3a6ae0", { browUp: 2.4, browCol: shade(v.beard, 0.6) });
      if (v.helm) {
        D.sym((s) => D.poly([s * 7, -4.6, s * 12.6, -6.6, s * 15, -14, s * 13.6, -15.6, s * 11.4, -10.6, s * 7.4, -8.4], v.horns));
        D.poly([-8.8, -3.2, -8, -7.6, -4.4, -10.6, 0, -11.4, 4.4, -10.6, 8, -7.6, 8.8, -3.2], v.helm);
        D.rect(-8.8, -4.4, 17.6, 1.6, shade(v.helm, 0.7)); D.rect(-0.9, -4.4, 1.8, 5.8, shade(v.helm, 0.7));
        D.ell(-3.4, -8, 2, 1, shade(v.helm, 1.3), -0.4);
      }
      if (v.beanie) {
        const b = T.p1, b2 = T.p2;
        D.poly([-8.6, -3, -8, -8, -4, -11.2, 4, -11.2, 8, -8, 8.6, -3], b); D.rect(-8.8, -4.6, 17.6, 2.6, b2); D.circ(0, -12, 2.4, b2);
        for (let k = -3; k <= 3; k++) D.line(k * 2.4, -6, k * 2.2, -10, 0.6, shade(b, 0.75));
      }
      if (v.hardhat) {
        D.poly([-9, -3, -8, -8.4, -4, -11, 4, -11, 8, -8.4, 9, -3], v.hardhat); D.rect(-11, -4.4, 22, 2, shade(v.hardhat, 0.8)); D.rect(-0.8, -11, 1.6, 7, shade(v.hardhat, 0.85));
        if (v.weapon === "pick") { D.rect(-2.6, -9.6, 5.2, 3.6, "#3a3a44"); D.circ(0, -7.8, 1.6, "#fff6a8"); }
        D.sym((s) => D.circ(s * 4.6, 1.8, 0.9, "rgba(40,30,30,0.5)"));
      }
      if (v.bearhood) D.sym((s) => D.poly([s * 9.6, -2, s * 11, 6, s * 8, 3], v.pelt));
    },
    pirate(D, v, T) {
      if (v.skull) {
        D.circ(0, -1, 8.8, v.skin); D.ell(0, 5.4, 6, 4, v.skin);
        D.sym((s) => { D.ell(s * 3.6, -0.6, 2.6, 2.8, INK); D.circ(s * 3.4, -0.2, 0.8, "#ff3b3b"); });
        D.poly([-1.2, 3.6, 1.2, 3.6, 0, 1.6], INK);
        for (let k = -2; k <= 2; k++) D.rect(k * 1.9 - 0.7, 6, 1.3, 2.6, "#ffffff");
        D.line(-5, 6, 5, 6, 0.6, INK); D.line(-5, 8.6, 5, 8.6, 0.6, INK);
        D.poly([-9.4, -3, -8.6, -8.4, -4, -10.6, 4, -10.6, 8.6, -8.4, 9.4, -3], T.p1);
        D.sym((s) => D.circ(s * 4, -6, 1, T.p2)); D.circ(0, -8, 1, T.p2);
        D.poly([8.4, -5, 13, -2, 12, 1, 10, -2], T.p1);
        return;
      }
      D.circ(0, 0.4, 8.6, v.skin);
      D.poly([-8.2, 1.6, -7.4, 6.6, -3, 10.4, 3, 10.4, 7.4, 6.6, 8.2, 1.6, 4, 5, -4, 5], v.beard);
      if (v.cowboy) {
        D.poly([-7.8, 0.4, 7.8, 0.4, 7, 6, 2.6, 10.6, 0, 9.8, -2.6, 10.6, -7, 6], "#c8281e");
        D.sym((s) => D.circ(s * 3.6, 4, 0.6, "#f4f0e8")); D.circ(0, 7, 0.6, "#f4f0e8");
      } else {
        D.pl([-4.6, 4.6, -1, 3.6, 1, 3.6, 4.6, 4.6], 1.4, v.beard);
        D.ell(0, 6.6, 2, 1, "#7a2a2a");
      }
      if (v.tricorn) {
        D.circ(3.4, -0.8, 2.1, "#ffffff"); D.circ(3.1, -0.4, 1, INK); D.line(5.6, -3.8, 1.4, -2.6, 1.2, INK);
        D.ell(-3.4, -0.6, 2.2, 2.2, INK); D.pl([-9, -4, -3.4, -0.6, 8.8, -5.6], 0.7, INK);
        D.sym((s) => D.circ(s * 8.6, 3.6, 0.9, "#f2c84a"));
        D.poly([-13, -4.4, -8, -6.4, -5, -12.4, 0, -15, 5, -12.4, 8, -6.4, 13, -4.4, 0, -6], v.hat);
        D.pl([-13, -4.4, 0, -6, 13, -4.4], 0.9, "#f2c84a");
        D.circ(0, -10.2, 1.7, "#f4f0e8"); D.sym((s) => D.circ(s * 0.6, -10.4, 0.45, INK));
      } else {
        eyes(D, 3.4, -0.6, "angry", "#3a2a1a", { browUp: 2 });
        D.ell(0, -4.6, 13.6, 2.4, v.hat);
        D.poly([-7, -5, -6.4, -11.4, -2.4, -12.6, 0, -11, 2.4, -12.6, 6.4, -11.4, 7, -5], v.hat);
        D.rect(-7, -6.8, 14, 1.6, T.p1);
      }
    },
    spook(D, v, T) {
      if (v.phantom || v.reaper) {
        D.poly([-10, 10, -10, -1, -7, -9, 0, -15, 7, -9, 10, -1, 10, 10], v.robe);
        D.poly([7, -9, 10, -1, 10, 10, 6.6, 10, 7, -2], shade(v.robe, 0.7));
        D.ell(0, 1.4, 6.6, 7.6, INK);
        if (v.reaper) {
          D.ell(0, 0.6, 5.4, 6.2, v.skin);
          D.sym((s) => { D.ell(s * 2.3, -0.6, 1.6, 1.9, INK); D.circ(s * 2.3, -0.3, 0.5, "#ff3b3b"); });
          D.poly([-0.8, 2.4, 0.8, 2.4, 0, 1], INK);
          for (let k = -2; k <= 2; k++) D.rect(k * 1.4 - 0.5, 4, 1, 2, INK);
        } else { eyes(D, 2.6, -0.4, "glow", v.glow); D.ell(0, 4.2, 1.4, 1.8, shade(v.glow, 0.6)); }
        return;
      }
      if (v.demon) {
        D.sym((s) => { D.poly([s * 4.6, -6.6, s * 7.4, -8.4, s * 11, -16, s * 9.6, -9.4], "#2a1a1a"); D.poly([s * 8, -1, s * 12.6, -4.6, s * 8.6, 3], v.skin); });
        D.circ(0, 0, 8.8, v.skin);
        D.ell(0, -5.6, 6, 2.4, shade(v.skin, 0.8));
        eyes(D, 3.6, -1.4, "slit", "#ffe23a", { browUp: 2.8 });
        grin(D, 3.6, 5, { fangs: true, h: 2.8, col: "#3a0a0a" });
        D.poly([-2, 8, 2, 8, 0, 12], "#2a1a1a");
        return;
      }
      // the sorcerer
      D.circ(0, 0.6, 8.4, v.skin);
      D.poly([-8, 2, -6.6, 8, -2.6, 13, 0, 15.6, 2.6, 13, 6.6, 8, 8, 2, 4, 4.6, -4, 4.6], "#f2f2f4");
      D.pl([-4.6, 4.4, -1, 3.6, 1, 3.6, 4.6, 4.4], 1.4, "#dcdce2");
      eyes(D, 3.4, -0.6, "angry", "#3a6ae0", { browUp: 2, browCol: "#f2f2f4" });
      D.sym((s) => D.line(s * 5.6, -3.6, s * 1.6, -2.8, 1.6, "#f2f2f4"));
      D.ell(0, -4.8, 13, 2.6, v.robe);
      D.poly([-7.6, -5, 7.6, -5, 4, -12, 6, -16, 10.6, -18.4, 3, -19, -1, -15], v.robe);
      D.rect(-7.4, -6.8, 14.8, 1.8, T.p2);
      [[-2, -10], [2.6, -13], [0, -16]].forEach((p) => D.poly([p[0], p[1] - 1.4, p[0] + 0.5, p[1] - 0.4, p[0] + 1.4, p[1], p[0] + 0.5, p[1] + 0.4, p[0], p[1] + 1.4, p[0] - 0.5, p[1] + 0.4, p[0] - 1.4, p[1], p[0] - 0.5, p[1] - 0.4], "#ffe27a"));
    },
    robot(D, v, T) {
      const m = v.metal, dk = shade(m, 0.65);
      if (v.golem) {
        D.poly([-9.6, -2, -8, -8.6, -2, -10.6, 4, -10, 9.2, -6.6, 10, 2, 7.6, 8.6, 0, 10, -7.6, 8.4], m);
        D.poly([4, -10, 9.2, -6.6, 10, 2, 7.6, 8.6, 5, 9.4, 6, 0], dk);
        D.ell(-3, -7.4, 4, 1.6, "#5a7a3a");
        D.pl([-6, -6, -3.4, -2, -5, 2], 0.8, shade(m, 0.45)); D.pl([4, 3, 6.6, 6, 5, 8.6], 0.8, shade(m, 0.45));
        D.sym((s) => D.rect(s * 3.6 - 1.6, -2, 3.2, 1.8, v.led));
        D.poly([-4, 4, 4, 4, 3, 5.8, -3, 5.8], v.led);
        return;
      }
      if (v.train) {
        D.rect(-3.4, -16, 6.8, 6, INK); D.rect(-4.4, -17, 8.8, 2, "#4a4e58");
        D.circ(-2, -19.4, 2, "#c8ccd4"); D.circ(1.6, -21.6, 2.6, "#dfe2e8");
        D.circ(0, 0, 9.4, m);
        D.circ(0, 0, 7.4, shade(m, 1.25));
        D.circ(0, -4.6, 2.6, v.led); D.circ(0, -4.6, 1.3, "#ffffff");
        D.sym((s) => { D.circ(s * 3.4, 0.4, 1.6, "#ffffff"); D.circ(s * 3.2, 0.6, 0.8, INK); });
        D.arc(0, 2.6, 2.6, 0.3, Math.PI - 0.3, 1, INK);
        D.poly([-8, 6, 8, 6, 6, 10.6, -6, 10.6], T.p1);
        for (let k = -2; k <= 2; k++) D.line(k * 2.6, 6.4, k * 2, 10.4, 0.7, shade(T.p1, 0.6));
        return;
      }
      D.line(0, -9, 0, -14.4, 1, dk); D.circ(0, -15.2, 1.7, "#ff3b3b");
      D.sym((s) => { D.ell(s * 9.6, 0, 1.6, 3.4, dk); });
      D.poly([-8.6, -7, -7, -9, 7, -9, 8.6, -7, 8.6, 7.4, 7, 9, -7, 9, -8.6, 7.4], m);
      D.poly([5, -9, 7, -9, 8.6, -7, 8.6, 7.4, 7, 9, 5, 9], dk);
      D.rect(-6.6, -5.6, 12.6, 9.6, "#14202c");
      D.sym((s) => D.rect(s * 3 - 1.6, -3.2, 3.2, 2.2, v.led));
      D.pl([-3.4, 1, -1.6, 2.2, 1.6, 2.2, 3.4, 1], 0.9, v.led);
      D.sym((s) => { D.circ(s * 7, -7.2, 0.6, dk); D.circ(s * 7, 7.2, 0.6, dk); });
    },
    alien(D, v) {
      D.sym((s) => { D.pl([s * 2.6, -8.6, s * 4.6, -14, s * 7, -15.6], 0.9, v.fur); D.circ(s * 7.4, -15.8, 1.6, v.fur2); });
      D.poly([-10, -3, -8, -9, 0, -11, 8, -9, 10, -3, 7, 5, 3, 9.6, -3, 9.6, -7, 5], v.fur);
      D.poly([-10, -3, -8, -9, -4, -10.4, -6, -3, -4.4, 6, -7, 5], shade(v.fur, 1.2));
      D.sym((s) => { D.ell(s * 4.2, -1.4, 3.3, 2.2, INK, s * -0.5); D.ell(s * 3.4, -2.2, 1, 0.6, "#ffffff", s * -0.5); });
      D.arc(0, 4.4, 1.8, 0.4, Math.PI - 0.4, 0.9, INK);
    },
    elemental(D, v, T) {
      const b = v.base, hi = v.hi, face = (y, col) => {
        eyes(D, 3.2, y, "big", INK, { r: 2.2, brow: false });
        D.sym((s) => D.line(s * 4.8, y - 3.6, s * 1.8, y - 3, 1.1, col || INK));
        D.poly([-3.4, y + 3.2, 3.4, y + 3.2, 2, y + 5.6, -2, y + 5.6], "#5a1420"); D.rect(-2.8, y + 3, 5.6, 0.9, "#ffffff");
      };
      if (v.storm) {
        D.pl([4, 6, 6.4, 9.6, 4.6, 10, 7, 14.6], 1.6, "#ffe14a");
        [[-5.6, -0.4, 5.8], [1.6, -4.6, 7], [6.8, 0.6, 5.4], [0, 3.4, 6.4], [-6.6, 4, 4]].forEach((p) => D.circ(p[0], p[1], p[2], b));
        [[-4.6, -3, 3], [1, -7.6, 3.6]].forEach((p) => D.circ(p[0], p[1], p[2], hi));
        face(0, shade(b, 0.4)); return;
      }
      if (v.bolt) {
        D.poly([2, -19, -6, -6, -1, -6, -4, 2, 6, -9, 1, -9, 6, -19], hi);
        D.circ(0, 1, 8.6, b); D.poly([-3, -7, -6, -3, -1, -4], "#ffffff");
        face(0.6); return;
      }
      if (v.fire) {
        const c1 = v.dark ? "#7a1410" : b;
        D.poly([-9, 3, -10, -6, -6, -3, -6, -12, -2, -6, 0, -17, 3, -7, 6, -13, 7, -4, 10, -7, 9.4, 3, 6, 9, -6, 9], c1);
        D.poly([-6, 4, -6.4, -3, -3, -1, -2.4, -9, 1, -2, 4, -7, 4.6, 0, 6.4, 4, 3, 8, -3, 8], hi);
        D.ell(0, 2.6, 6.4, 5.6, v.dark ? "#ff6a1a" : "#ffb02e");
        face(1.2, "#7a1410"); return;
      }
      if (v.ice) {
        D.poly([-9.4, 3, -7, -8, -2, -14, 3, -11, 8, -16, 9.6, -4, 8, 6, 0, 10, -7, 7.6], b);
        D.poly([-7, -8, -2, -14, 0, -6, -6, -2], hi); D.poly([3, -11, 8, -16, 6, -6], "#e8f8ff"); D.poly([8, 6, 9.6, -4, 4, 2], shade(b, 0.75));
        face(0.6, "#2a5a8a"); return;
      }
      if (v.volcano) {
        D.poly([-11, 10, -5, -9, 5, -9, 11, 10], b); D.poly([5, -9, 11, 10, 6, 10, 3, -6], shade(b, 0.7));
        D.ell(0, -9, 5, 1.6, "#3a1a10"); D.poly([-4, -9, -2, -16, 0, -11, 2, -18, 4, -9], hi); D.pl([-3.6, -8.6, -4.6, -4], 1.4, hi); D.pl([2.6, -8.6, 3.6, -3], 1.4, hi);
        face(1.4, "#2a1a10"); return;
      }
      if (v.meteor) {
        D.poly([2, -8, 14, -18, 10, -6, 16, -10, 9, 2, 6, -2], hi); D.poly([3, -6, 11, -13, 8, -4], "#ffe27a");
        D.circ(0, 0.6, 8.6, b); [[-4, -4, 1.6], [4.6, 3.6, 1.3], [-5, 4, 1]].forEach((p) => D.circ(p[0], p[1], p[2], shade(b, 0.7)));
        face(0.6); return;
      }
      if (v.summit) {
        D.poly([-11, 10, -1, -16, 3, -10, 5, -13, 11, 10], b); D.poly([-1, -16, 3, -10, 5, -13, 7.6, -6, 4, -8, 1, -5, -2, -9, -5.4, -6], hi);
        D.poly([3, -10, 5, -13, 11, 10, 6, 10], shade(b, 0.7));
        face(2.4, "#2a3440"); return;
      }
      if (v.salt) {
        D.poly([-7, -6, -6, -12, -3, -15, 3, -15, 6, -12, 7, -6], hi);
        [[-2.6, -12], [0, -13], [2.6, -12], [-1.2, -10], [1.4, -10]].forEach((p) => D.circ(p[0], p[1], 0.6, INK));
        D.rect(-8, -7, 16, 2, shade(hi, 0.7));
        D.poly([-8, -5, 8, -5, 9, 10, -9, 10], b); D.poly([5, -5, 8, -5, 9, 10, 6, 10], "#d8dee6");
        D.rect(-6, 5, 12, 3, T.p1);
        face(-0.4, "#7a8696"); return;
      }
      if (v.lighthouse) {
        D.poly([-6.6, -15, 6.6, -15, 0, -19.6], "#2a2a32"); D.rect(-5, -15, 10, 6, "#ffe27a"); D.rect(-1, -15, 2, 6, "#2a2a32"); D.rect(-7, -9.4, 14, 1.6, "#2a2a32");
        D.poly([-7, -8, 7, -8, 9, 10, -9, 10], hi);
        D.poly([-7.4, -4, 7.4, -4, 7.8, 0, -7.8, 0], b); D.poly([-8.4, 5, 8.4, 5, 8.8, 9, -8.8, 9], b);
        face(-1.2); return;
      }
    }
  };

  /* ---------------- the rig: a pose → joints (logical px; the ground at GY, the centre at CX) ---------------- */
  const LW = 52, LH = 62, GY = 59, CX = 26, SCALE = 2;   // the sheet holds each pose at ×2
  const THIGH = 6.6, SHIN = 6, UARM = 6.2, FARM = 6, TORSO = 12.6, HEADR = 9;
  // a pose: legs [L thigh, L shin, R thigh, R shin] and arms [L shoulder, L elbow, R shoulder, R elbow] in degrees —
  // 0 is straight down, positive swings OUT and up (90 = level out to his side, 180 = straight up); the elbow adds to the
  // shoulder in the same sense. lean tilts the torso (+ to screen right), tilt the head; ball: "R" in the right hand,
  // "G" on the grass; w / s: the weapon / shield show; front: the legs draw over the torso (the tuck)
  const POSES = {
    stand: { legs: [10, 4, 10, 4], arms: [14, -8, 14, -8], w: 1, s: 1 },
    idleA: { legs: [11, 3, 13, 1], arms: [24, 14, 42, 58], lean: -3, tilt: -4, w: 1, s: 1 },
    idleB: { legs: [13, 1, 11, 3], arms: [42, 58, 24, 14], lean: 3, tilt: 4, w: 1, s: 1 },
    wave0: { legs: [12, 2, 12, 2], arms: [22, -12, 132, 40], tilt: 4, w: 0, s: 1 },
    wave1: { legs: [12, 2, 12, 2], arms: [22, -12, 120, 72], tilt: -2, w: 0, s: 1 },
    cheer0: { legs: [10, 4, 58, -40], arms: [140, 12, 38, -24], lean: -9, tilt: -8, w: 1, s: 1 },
    cheer1: { legs: [36, -6, 36, -6], arms: [100, -14, 100, -14], w: 1, s: 1 },
    cheer2: { legs: [58, -40, 10, 4], arms: [38, -24, 140, 12], lean: 9, tilt: 8, w: 1, s: 1 },
    cheer3: { legs: [7, 9, 7, 9], arms: [146, 4, 146, 4], tilt: 0, w: 1, s: 0 },
    ready: { legs: [36, -8, 36, -8], arms: [26, -34, 26, -34], w: 1, s: 1 },
    crouch: { legs: [56, -16, 56, -16], arms: [40, -62, 40, -62], tilt: 6, w: 0, s: 0 },
    squat: { legs: [76, -32, 76, -32], arms: [16, 2, 16, 2], tilt: 8, tl: 0.85, w: 0, s: 0 },
    guard: { legs: [26, -6, 26, -6], arms: [58, 112, 58, 112], w: 0, s: 0 },
    flexR: { legs: [26, -6, 26, -6], arms: [26, -24, 96, 100], tilt: 6, w: 0, s: 1 },
    flexL: { legs: [26, -6, 26, -6], arms: [96, 100, 26, -24], tilt: -6, w: 0, s: 0 },
    flex2: { legs: [22, -4, 22, -4], arms: [96, 102, 96, 102], w: 0, s: 0 },
    flex2low: { legs: [46, -14, 46, -14], arms: [88, 112, 88, 112], w: 0, s: 0 },
    pumpR: { legs: [16, 0, 16, 0], arms: [30, -42, 150, 10], tilt: 6, w: 1, s: 1 },
    armsUp: { legs: [15, 2, 15, 2], arms: [142, 8, 142, 8], w: 1, s: 0 },
    launch: { legs: [5, 4, 5, 4], arms: [152, 4, 152, 4], w: 0, s: 0 },
    tuck: { legs: [164, 20, 164, 20], arms: [62, -58, 62, -58], front: 1, tl: 0.8, tilt: 10, w: 0, s: 0 },
    landing: { legs: [46, -12, 46, -12], arms: [102, -8, 102, -8], w: 0, s: 0 },
    holdBall: { legs: [30, -6, 30, -6], arms: [26, -26, 28, -74], ball: "R", w: 0, s: 1 },
    ballUp: { legs: [26, -5, 26, -5], arms: [30, -30, 160, 40], ball: "R", tilt: -6, w: 0, s: 1 },
    windup: { legs: [22, -2, 34, -10], arms: [62, 0, 172, 66], lean: -10, ball: "R", w: 0, s: 1 },
    slam: { legs: [42, -12, 30, -4], arms: [64, 22, 22, -4], lean: 18, tilt: 14, ball: "G", tl: 0.9, w: 0, s: 0 },
    follow: { legs: [36, -8, 28, -4], arms: [82, 22, 42, 12], lean: 11, tilt: 8, w: 0, s: 0 },
    chest: { legs: [20, -2, 20, -2], arms: [26, -20, 56, -136], w: 0, s: 1 },
    moon0: { legs: [6, 6, 22, -26], arms: [32, -62, 32, -62], lean: -10, tilt: -8, w: 0, s: 0 },
    moon1: { legs: [22, -26, 6, 6], arms: [32, -62, 32, -62], lean: -10, tilt: -8, w: 0, s: 0 },
    griddy0: { legs: [10, 4, 62, -64], arms: [64, -24, 18, 44], tilt: -6, w: 0, s: 0 },
    griddy1: { legs: [62, -64, 10, 4], arms: [18, 44, 64, -24], tilt: 6, w: 0, s: 0 },
    robot0: { legs: [12, 2, 12, 2], arms: [90, 90, 90, -90], w: 0, s: 0 },
    robot1: { legs: [12, 2, 12, 2], arms: [90, -90, 90, 90], tilt: 8, w: 0, s: 0 },
    archer: { legs: [22, -2, 22, -2], arms: [92, 0, 88, -172], tilt: -10, w: 0, s: 0, bow: 1 },
    phone: { legs: [14, 2, 14, 2], arms: [24, -20, 46, -158], tilt: 10, w: 0, s: 1, ball: "E" },
    saber: { legs: [26, -6, 26, -6], arms: [150, 30, 150, 30], w: 0, s: 0, saber: 1 },
    plank: { legs: [4, 2, 4, 2], arms: [160, 10, 160, 10], w: 0, s: 0 },
    plank2: { legs: [8, 18, 4, 2], arms: [160, 10, 146, 20], w: 0, s: 0 },
    /* v194 B THE MASCOT COMES ALIVE: the run cycle, the cartwheel's star, the jump, the tears, the temper, the sign, the
     * merch throw, the steering wheel, the kick, the slump, the nail-biting, the swagger, the air bump, the point */
    run0: { legs: [56, -40, 4, 10], arms: [64, 70, 14, -44], lean: 9, tilt: 5, w: 0, s: 0 },
    run1: { legs: [26, -18, 18, -6], arms: [36, 40, 36, 40], lean: 9, w: 0, s: 0 },
    run2: { legs: [4, 10, 56, -40], arms: [14, -44, 64, 70], lean: 9, tilt: -5, w: 0, s: 0 },
    run3: { legs: [18, -6, 26, -18], arms: [40, 30, 40, 30], lean: 9, w: 0, s: 0 },
    star: { legs: [40, 40, 40, 40], arms: [132, 0, 132, 0], w: 0, s: 0 },
    jump: { legs: [74, -24, 74, -24], arms: [160, 8, 160, 8], tilt: -4, w: 0, s: 0 },
    cry0: { legs: [12, 2, 12, 2], arms: [150, 101, 150, 101], tilt: 9, w: 0, s: 0 },
    cry1: { legs: [16, 0, 9, 4], arms: [146, 106, 152, 98], lean: 3, tilt: -9, w: 0, s: 0 },
    mad0: { legs: [8, 4, 64, -28], arms: [152, 36, 152, 36], lean: -5, tilt: -7, w: 0, s: 0 },
    mad1: { legs: [12, 3, 12, 3], arms: [118, 78, 118, 78], lean: 5, tilt: 7, w: 0, s: 0 },
    sign0: { legs: [12, 2, 12, 2], arms: [158, 14, 158, 14], w: 0, s: 0 },
    sign1: { legs: [15, 0, 10, 4], arms: [154, 18, 162, 10], lean: 2, tilt: 4, w: 0, s: 0 },
    throw0: { legs: [22, -2, 34, -10], arms: [44, -30, 176, 62], lean: -12, tilt: -8, w: 0, s: 1 },
    throw1: { legs: [32, -8, 16, 0], arms: [30, -24, 128, -14], lean: 11, tilt: 7, w: 0, s: 1 },
    steer0: { legs: [14, 0, 14, 0], arms: [60, -110, 60, -110], wheel: 0, w: 0, s: 0 },
    steer1: { legs: [16, -2, 12, 2], arms: [76, -122, 46, -96], wheel: 32, lean: 6, tilt: 6, w: 0, s: 0 },
    steer2: { legs: [12, 2, 16, -2], arms: [46, -96, 76, -122], wheel: -32, lean: -6, tilt: -6, w: 0, s: 0 },
    kick: { legs: [6, 4, 102, 74], arms: [74, -50, 112, 40], lean: -14, tilt: -10, w: 0, s: 0 },
    slump0: { legs: [14, 2, 14, 2], arms: [4, 2, 4, 2], tilt: 16, tl: 0.92, w: 0, s: 0 },
    slump1: { legs: [15, 1, 13, 3], arms: [7, 0, 2, 4], lean: 2, tilt: 11, tl: 0.92, w: 0, s: 0 },
    nails0: { legs: [10, 4, 12, 2], arms: [24, -20, -30, 226], tilt: -4, w: 0, s: 0 },
    nails1: { legs: [12, 2, 10, 4], arms: [26, -24, -26, 222], lean: -1, tilt: 3, w: 0, s: 0 },
    hips0: { legs: [16, 0, 24, -6], arms: [50, -82, 50, -82], lean: -3, tilt: -8, w: 0, s: 1 },
    hips1: { legs: [24, -6, 16, 0], arms: [50, -82, 50, -82], lean: 3, tilt: 8, w: 0, s: 1 },
    bump: { legs: [34, -36, 34, -36], arms: [104, -64, 104, -64], tilt: -10, w: 0, s: 0 },
    point: { legs: [12, 2, 18, -2], arms: [24, -12, 150, -8], tilt: -6, w: 0, s: 1 }
  };
  const POSE_NAMES = Object.keys(POSES);
  const POSE_IX = {}; POSE_NAMES.forEach((n, i) => { POSE_IX[n] = i; });
  function rig(P) {
    const lg = P.legs, am = P.arms, lean = (P.lean || 0) * DEG, tl = TORSO * (P.tl || 1);
    const leg = (s, h, k) => { const kx = s * Math.sin(h * DEG) * THIGH, ky = Math.cos(h * DEG) * THIGH; return { kx, ky, fx: kx + s * Math.sin(k * DEG) * SHIN, fy: ky + Math.cos(k * DEG) * SHIN }; };
    const L = leg(-1, lg[0], lg[1]), R = leg(1, lg[2], lg[3]);
    const low = P.front ? Math.max(L.fy, R.fy, 4) : Math.max(L.fy, R.fy);
    const hip = { x: CX + (P.dx || 0), y: GY - 2.2 - low };
    const up = { x: Math.sin(lean), y: -Math.cos(lean) }, perp = { x: Math.cos(lean), y: Math.sin(lean) };
    const sh = { x: hip.x + up.x * tl, y: hip.y + up.y * tl };
    const tilt = lean + (P.tilt || 0) * DEG;
    const head = { x: sh.x + Math.sin(tilt) * (HEADR - 1.6), y: sh.y - Math.cos(tilt) * (HEADR - 1.6), rot: tilt };
    const J = { hip, sh, head, lean, up, perp, tl, P };
    J.hipL = { x: hip.x - perp.x * 3.4, y: hip.y - perp.y * 3.4 }; J.hipR = { x: hip.x + perp.x * 3.4, y: hip.y + perp.y * 3.4 };
    J.legL = { k: { x: J.hipL.x + L.kx, y: J.hipL.y + L.ky }, f: { x: J.hipL.x + L.fx, y: J.hipL.y + L.fy } };
    J.legR = { k: { x: J.hipR.x + R.kx, y: J.hipR.y + R.ky }, f: { x: J.hipR.x + R.fx, y: J.hipR.y + R.fy } };
    const arm = (s, a, e) => {
      const o = { x: sh.x + s * perp.x * 7 + up.x * -1.4, y: sh.y + s * perp.y * 7 - up.y * 1.4 };
      const a1 = a * DEG + s * lean, a2 = (a + e) * DEG + s * lean;
      const el = { x: o.x + s * Math.sin(a1) * UARM, y: o.y + Math.cos(a1) * UARM };
      const h = { x: el.x + s * Math.sin(a2) * FARM, y: el.y + Math.cos(a2) * FARM };
      return { o, el, h, dir: { x: s * Math.sin(a2), y: Math.cos(a2) } };
    };
    J.armL = arm(-1, am[0], am[1]); J.armR = arm(1, am[2], am[3]);
    return J;
  }

  /* ---------------- the accessories ---------------- */
  function weaponDraw(D, kind, h, dir, T, v) {
    const ang = Math.atan2(dir.y, dir.x);   // along the forearm, out of the fist
    D.at(h.x, h.y, ang);
    const blade = "#e8ecf2", edge = "#9aa3b0", wood = "#8a5a2c", gold = "#f2c84a";
    if (kind === "sword" || kind === "katana" || kind === "rapier" || kind === "cutlass") {
      const len = kind === "rapier" ? 15 : kind === "katana" ? 14 : kind === "cutlass" ? 11 : 13, w = kind === "rapier" ? 0.9 : kind === "cutlass" ? 2.6 : 2;
      D.rect(-2.4, -0.7, 2.6, 1.4, kind === "katana" ? "#2a2228" : wood);
      D.rect(0, -2.4, 1.2, 4.8, kind === "katana" ? gold : kind === "cutlass" ? gold : "#6a6f78");
      if (kind === "cutlass") D.poly([1.2, -1, len, -1.6, len + 1.6, 0.6, 1.2, 1.4], blade);
      else D.poly([1.2, -w / 2, len, -w / 2, len + 2, 0, len, w / 2, 1.2, w / 2], blade);
      D.line(2, 0, len, 0, 0.5, edge);
    } else if (kind === "spear" || kind === "trident" || kind === "staff" || kind === "scythe" || kind === "scepter") {
      D.line(-9, 0, 16, 0, 1.3, kind === "scepter" ? gold : kind === "staff" ? "#6a4220" : wood);
      if (kind === "spear") D.poly([15, -1.8, 21, 0, 15, 1.8], v && v.bronze ? v.bronze : blade);
      if (kind === "trident") { D.line(16, -2.6, 16, 2.6, 1, "#c8ccd4"); [-2.4, 0, 2.4].forEach((y) => D.poly([16, y - 0.8, 20, y, 16, y + 0.8], "#c8ccd4")); }
      if (kind === "staff") { D.circ(17.4, 0, 2.6, T.p2); D.circ(16.8, -0.8, 1, "#ffffff"); }
      if (kind === "scepter") { D.circ(17, 0, 2, gold); D.circ(17, 0, 1, "#d81a3a"); }
      if (kind === "scythe") D.poly([16, 0, 14, -1, 10, -9, 5, -12, 11, -11, 16.6, -3], "#d8dce4");
    } else if (kind === "axe") {
      D.line(-3, 0, 12, 0, 1.4, wood);
      D.poly([8, -1, 9, -6, 13.6, -5.4, 13, 0, 13.6, 5, 9, 5, 8, 1], "#c8ccd4");
      D.line(13.2, -5, 13.2, 4.6, 0.6, "#ffffff");
    } else if (kind === "pick") {
      D.line(-3, 0, 12, 0, 1.4, wood);
      D.pl([10, -7, 13, -2, 13, 2, 10, 7], 1.6, "#8a929e");
    } else if (kind === "wrench") {
      D.line(-1, 0, 10, 0, 1.8, "#9aa3b0"); D.circ(11, 0, 2.4, "#9aa3b0"); D.rect(10.6, -0.9, 3, 1.8, "rgba(0,0,0,0)"); D.poly([11, -0.8, 14, -1.4, 14, 1.4, 11, 0.8], "#14101a");
    } else if (kind === "hammer") {
      D.line(-2, 0, 11, 0, 1.4, wood); D.rect(9, -4, 4.6, 8, "#6a707a"); D.rect(9, -4, 1.4, 8, "#9aa3b0");
    } else if (kind === "mace") {
      D.line(-2, 0, 7, 0, 1.3, wood); D.pl([7, 0, 10, 3, 12, 5], 0.6, "#9aa3b0"); D.circ(13, 6, 2.6, "#5a5e68");
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; D.poly([13 + Math.cos(a - 0.3) * 2.4, 6 + Math.sin(a - 0.3) * 2.4, 13 + Math.cos(a) * 4.2, 6 + Math.sin(a) * 4.2, 13 + Math.cos(a + 0.3) * 2.4, 6 + Math.sin(a + 0.3) * 2.4], "#c8ccd4"); }
    } else if (kind === "raygun") {
      D.rect(-1, -1.6, 7, 3.2, "#9aa3b0"); D.rect(6, -1, 3, 2, T.p2); D.circ(9.4, 0, 1.4, "#7cff6a"); D.rect(0, 1, 1.6, 3, "#6a707a");
    } else if (kind === "bolt") {
      D.poly([0, -1, 6, -3, 4, 0, 11, -1, 3, 3, 5, 0.6, -1, 2], "#ffe14a");
    } else if (kind === "lasso") {
      D.pl([0, 0, 4, 1, 6, 4], 0.8, "#c8a06a"); D.c.beginPath(); D.c.ellipse(9, 6, 4.4, 2.6, 0.4, 0, Math.PI * 2); D.c.lineWidth = 0.9; D.c.strokeStyle = "#c8a06a"; D.c.stroke();
    }
    D.restore();
  }
  function shieldDraw(D, kind, h, T, v) {
    const p1 = (v && v.shieldCol) || T.p1, p2 = T.p2;
    if (kind === "heater") {
      D.poly([h.x - 5.4, h.y - 6, h.x + 5.4, h.y - 6, h.x + 5, h.y + 1.6, h.x, h.y + 7, h.x - 5, h.y + 1.6], "#d8dce4");
      D.poly([h.x - 4.4, h.y - 5, h.x + 4.4, h.y - 5, h.x + 4, h.y + 1.2, h.x, h.y + 5.6, h.x - 4, h.y + 1.2], p1);
      if (v && v.moon) { D.circ(h.x, h.y - 0.6, 2.4, "#e8d27a"); D.circ(h.x + 1, h.y - 1.2, 2, p1); }
      else if (v && v.sun) D.circ(h.x, h.y - 0.6, 2.2, "#fff0a8");
      else { D.rect(h.x - 0.9, h.y - 5, 1.8, 10, p2); D.rect(h.x - 4.2, h.y - 2.4, 8.4, 1.8, p2); }
    } else {
      const col = kind === "wood" ? "#9a6a3a" : v && v.bronze ? v.bronze : "#c8ccd4";
      D.circ(h.x, h.y, 6.4, col); D.circ(h.x, h.y, 5.2, kind === "wood" ? "#b8824a" : p1);
      if (kind === "wood") { D.line(h.x - 5, h.y, h.x + 5, h.y, 1.2, p1); D.line(h.x, h.y - 5, h.x, h.y + 5, 1.2, p1); D.circ(h.x, h.y, 1.6, "#c8ccd4"); }
      else { D.pl([h.x - 2.6, h.y + 2.6, h.x, h.y - 2.8, h.x + 2.6, h.y + 2.6], 1.2, p2); }
    }
  }
  function backDraw(D, J, look, T) {
    const { hip, sh } = J, v = look.v;
    const cape = look.cape, wings = look.wings, tail = look.tail;
    if (cape) {
      const col = look.arch === "spook" ? v.robe : T.p1 === "#ffffff" ? T.p2 : T.p1;
      D.poly([sh.x - 7.6, sh.y - 0.6, sh.x + 7.6, sh.y - 0.6, hip.x + 10.6, hip.y + 11, hip.x - 10.6, hip.y + 11], shade(col, 0.72));
      D.poly([sh.x + 3, sh.y - 0.6, sh.x + 7.6, sh.y - 0.6, hip.x + 10.6, hip.y + 11, hip.x + 5, hip.y + 11], shade(col, 0.55));
    }
    if (wings && wings !== "none") {
      D.sym((s) => {
        const bx = sh.x + s * 3, by = sh.y + 3;
        if (wings === "feather") {
          const c = v.fur, c2 = shade(v.fur, 1.25);
          D.poly([bx, by, bx + s * 8, by - 9, bx + s * 15, by - 11, bx + s * 17, by - 6, bx + s * 15, by - 1, bx + s * 13, by + 3, bx + s * 10, by + 6, bx + s * 6, by + 8], c);
          for (let k = 0; k < 3; k++) D.line(bx + s * (8 + k * 2.4), by - 5 + k * 2, bx + s * (14 + k), by - 6 + k * 3.4, 0.9, c2);
          if (v.flame) D.poly([bx + s * 15, by - 11, bx + s * 19, by - 15, bx + s * 17, by - 6], v.fur2);
        } else if (wings === "bat") {
          const c = v.robe || shade(v.fur, 0.8), m = shade(c, 1.35);
          D.poly([bx, by, bx + s * 7, by - 10, bx + s * 16, by - 12, bx + s * 14, by - 6, bx + s * 17, by - 3, bx + s * 13, by + 1, bx + s * 14, by + 5, bx + s * 7, by + 4], c);
          D.pl([bx + s * 7, by - 10, bx + s * 10, by - 1], 0.7, m); D.pl([bx + s * 7, by - 10, bx + s * 13, by + 2], 0.7, m);
        } else if (wings === "bug") {
          D.ell(bx + s * 8, by - 5, 7.6, 4, "#e2f2ff", s * -0.5); D.ell(bx + s * 7, by + 1, 5.4, 3, "#cfe6f8", s * 0.35);
          D.pl([bx + s * 1, by - 1, bx + s * 13, by - 8], 0.5, "#9ab8d0");
        } else if (wings === "shell") {
          D.ell(bx + s * 6, by + 4, 5, 9, v.fur2, s * -0.35); D.ell(bx + s * 6, by + 4, 3.4, 7.4, shade(v.fur2, 1.25), s * -0.35);
        }
      });
    }
    if (look.tent) {
      for (let k = 0; k < 4; k++) {
        const s = k < 2 ? -1 : 1, o = (k % 2) * 4 + 2, x0 = hip.x + s * o, y0 = hip.y + 1;
        D.pl([x0, y0, x0 + s * 4, y0 + 6, x0 + s * 7, y0 + 9, x0 + s * 10, y0 + 8, x0 + s * 11, y0 + 5], 3, v.fur);
        D.circ(x0 + s * 5.6, y0 + 7.6, 0.8, v.fur2);
      }
    }
    if (look.legs6) D.sym((s) => { for (let k = 0; k < 2; k++) D.pl([hip.x + s * 5, hip.y - 4 - k * 4, hip.x + s * 11, hip.y - 7 - k * 4, hip.x + s * 13, hip.y - 2 - k * 4], 1.1, v.fur); });
    if (tail && tail !== "none") {
      const tx = hip.x + 4, ty = hip.y + 1, c = v.fur || v.base || "#888888";
      if (tail === "bushy") { D.poly([tx, ty, tx + 6, ty - 3, tx + 12, ty - 9, tx + 13, ty - 5, tx + 10, ty + 2, tx + 4, ty + 4], c); D.poly([tx + 11, ty - 8, tx + 13, ty - 5, tx + 11.6, ty - 3, tx + 9.6, ty - 6], v.fur2); }
      if (tail === "cat") { D.pl([tx, ty, tx + 6, ty + 2, tx + 10, ty - 3, tx + 11, ty - 9], 1.8, c); if (v.tuft) D.circ(tx + 11, ty - 10, 2, v.mane || v.fur2); else if (v.stripes) { D.circ(tx + 9.6, ty - 1.2, 1.2, v.stripes); D.circ(tx + 11, ty - 8.4, 1.1, v.stripes); } }
      if (tail === "feather") { D.poly([hip.x - 4, hip.y + 2, hip.x + 4, hip.y + 2, hip.x + 6, hip.y + 10, hip.x, hip.y + 8, hip.x - 6, hip.y + 10], shade(c, 0.85)); }
      if (tail === "reptile") { D.poly([tx - 2, ty - 3, tx + 2, ty + 4, tx + 10, ty + 8, tx + 15, ty + 7, tx + 9, ty + 3], c); if (v.dragon) D.poly([tx + 13, ty + 5, tx + 17, ty + 3, tx + 16, ty + 8], v.fur2); }
      if (tail === "tuft") { D.pl([tx, ty, tx + 5, ty + 3, tx + 8, ty + 8], 1.2, c); D.circ(tx + 8.4, ty + 9, 1.8, shade(c, 0.55)); }
      if (tail === "devil") { D.pl([tx, ty, tx + 6, ty + 4, tx + 10, ty - 2, tx + 12, ty - 7], 1.2, v.skin); D.poly([tx + 10, ty - 7, tx + 14, ty - 8, tx + 13, ty - 11], v.skin); }
      if (tail === "fin") D.poly([tx - 1, ty - 2, tx + 9, ty + 3, tx + 13, ty - 3, tx + 12, ty + 7, tx + 2, ty + 4], c);
    }
    if (look.stinger) {
      if (look.arch === "bug" && v.scorpion) {
        const c = v.fur;
        D.pl([hip.x + 3, hip.y, hip.x + 10, hip.y - 4, hip.x + 13, hip.y - 13, hip.x + 11, hip.y - 22, hip.x + 5, hip.y - 26], 3.2, c);
        D.poly([hip.x + 5, hip.y - 28, hip.x + 2, hip.y - 24, hip.x + 6, hip.y - 24], "#ff6a3a");
      } else D.poly([hip.x - 1.6, hip.y + 2, hip.x + 1.6, hip.y + 2, hip.x, hip.y + 7], INK);
    }
    if (look.glow) D.circ(hip.x + 5, hip.y + 4, 3.6, v.fur2);
  }

  /* ---------------- the costume, resolved once per team ---------------- */
  function lookFor(id, T, space) {
    const A = ARCH[id.arch], v = VAR[id.arch][id.variant];
    const L = { arch: id.arch, variant: id.variant, v, A, T, space: !!space };
    L.weapon = v.weapon !== undefined ? v.weapon : A.weapon || null;
    L.shield = v.shield !== undefined ? v.shield : A.shield || null;
    L.tail = v.tail !== undefined ? v.tail : A.tail || null;
    L.wings = v.wings !== undefined ? v.wings : A.wings || null;
    L.cape = !!(v.cape !== undefined ? v.cape : A.cape);
    L.tent = !!v.tent; L.legs6 = !!v.legs; L.stinger = !!(v.stinger || v.scorpion); L.glow = !!v.glow;
    // the limbs: fur for the animals, the costume's material for the rest
    const limb = { knight: v.armor || v.steel, spartan: "#eab48a", viking: v.pelt || v.skin, pirate: v.skin, spook: v.robe, robot: v.metal, elemental: v.base };
    L.limb = limb[id.arch] || v.fur;
    if (id.arch === "spook" && v.demon) L.limb = v.skin;
    if (id.arch === "bird") L.limb = v.fur;
    if (id.arch === "bug") L.limb = v.fur;
    const gl = v.glove || A.glove, sh = A.shoe;
    const G = { paw: v.fur2 || shade(L.limb, 1.3), white: "#f4f4f6", steel: "#c8ced8", talon: v.beak || "#f2b822", hoof: shade(v.fur || "#555555", 0.45), fin: v.fur2 || "#dde4ea", claw: v.fur || "#c8432a" };
    L.glove = G[gl] || "#f4f4f6"; L.gloveKind = gl;
    const S = { paw: v.fur2 || shade(L.limb, 1.3), steel: "#aab2be", talon: v.beak || "#f2b822", hoof: "#2a2224", boot: "#3a2a1e", sandal: "#8a5a2c", sneaker: T.p2 };
    L.shoe = S[sh] || "#3a2a1e";
    if (id.arch === "bear" || id.arch === "wolf" || id.arch === "cat" || id.arch === "reptile") L.shoe = shade(v.fur, 0.8);
    // the jersey: the team's first colour, the second as the trim; a jersey that vanishes into the fur takes the second
    L.jersey = T.p1; L.trim = T.p2;
    if (cdist(T.p1, L.limb) < 60 && cdist(T.p2, L.limb) >= 60) { L.jersey = T.p2; L.trim = T.p1; }
    if (id.arch === "spook" && (v.phantom || v.reaper)) L.robeBody = true;
    return L;
  }

  /* ---------------- one pose, drawn ---------------- */
  function drawPose(c, P, L) {
    const D = painter(c), J = rig(P), T = L.T, v = L.v;
    const limbW = 4.2, armW = 3.6;
    backDraw(D, J, L, T);
    const legs = () => {
      [J.legL, J.legR].forEach((g, i) => {
        const hp = i ? J.hipR : J.hipL;
        D.pl([hp.x, hp.y, g.k.x, g.k.y, g.f.x, g.f.y], limbW, L.robeBody ? L.limb : L.limb);
        if (L.arch === "knight") D.circ(g.k.x, g.k.y, 1.8, shade(L.limb, 1.2));
        D.ell(g.f.x + (i ? 0.9 : -0.9), g.f.y + 0.6, 3.1, 2, L.shoe);
        if (L.A.shoe === "sneaker") D.rect(g.f.x - 2.4 + (i ? 0.9 : -0.9), g.f.y + 1.6, 4.8, 0.8, "#ffffff");
      });
    };
    if (!P.front) legs();
    // the torso: the jersey, the trim at the collar and the hem, the shade on its far side
    D.at(J.hip.x + J.up.x * J.tl * 0.5, J.hip.y + J.up.y * J.tl * 0.5, J.lean);
    const ry = J.tl * 0.5 + 2.4;
    if (L.robeBody) {
      D.poly([-6.4, -ry, 6.4, -ry, 9.4, ry + 2.6, -9.4, ry + 2.6], L.limb);
      D.rect(-7.6, ry - 1, 15.2, 1.6, L.trim);
    } else {
      D.ell(0, 0, 7.6, ry, L.jersey);
      D.c.save(); D.c.beginPath(); D.c.ellipse(0, 0, 7.6, ry, 0, 0, Math.PI * 2); D.c.clip();
      D.rect(-8, ry - 3.4, 16, 3.4, L.trim);
      D.rect(-8, -2.2, 16, 1.6, L.trim);
      D.rect(3.6, -ry, 5, ry * 2, "rgba(0,0,0,0.22)");
      if (L.arch === "bird" || L.arch === "bear" || L.arch === "horned") D.ell(0, 1.2, 3.4, ry * 0.42, v.fur2 && L.arch !== "horned" ? v.fur2 : shade(L.jersey, 1.15));
      if (L.v.widow) D.poly([-1.6, 0, 1.6, 0, 0, 2.6, 1.6, 5.2, -1.6, 5.2, 0, 2.6], "#d81a2a");
      D.c.restore();
      D.ell(0, -ry + 0.6, 3.2, 1.3, L.trim);
    }
    D.restore();
    if (L.cape && L.arch !== "spook") D.sym((s) => D.circ(J.sh.x + s * 5.8, J.sh.y + 0.4, 1.3, "#f2c84a"));
    if (P.front) legs();
    // arms: the left (screen left, his right) first; the shield rides the left forearm
    const armDraw = (a, isR) => {
      D.pl([a.o.x, a.o.y, a.el.x, a.el.y, a.h.x, a.h.y], armW, L.limb);
      if (L.arch === "knight" || L.arch === "robot") D.circ(a.o.x, a.o.y, 2.3, shade(L.limb, 1.15));
      if (L.gloveKind === "claw") {
        const an = Math.atan2(a.dir.y, a.dir.x);
        D.at(a.h.x, a.h.y, an); D.ell(1.6, 0, 3.4, 2.6, L.glove); D.poly([2, -0.2, 6.4, -2.6, 5, 0.6], L.glove); D.poly([2, 0.6, 6, 3, 3.6, 2.4], shade(L.glove, 0.8)); D.restore();
      } else D.circ(a.h.x, a.h.y, 2.3, L.glove);
      if (L.gloveKind === "white") D.line(a.h.x - a.dir.x * 1.8 - 1, a.h.y - a.dir.y * 1.8, a.h.x - a.dir.x * 1.8 + 1, a.h.y - a.dir.y * 1.8, 1, "#d8d8de");
      if (isR && P.w && L.weapon && !P.ball) weaponDraw(D, L.weapon, a.h, a.dir, T, v);
      if (!isR && P.s && L.shield) shieldDraw(D, L.shield, { x: a.el.x * 0.4 + a.h.x * 0.6, y: a.el.y * 0.4 + a.h.y * 0.6 }, T, v);
    };
    const headDraw = () => {
      D.at(J.head.x, J.head.y, J.head.rot);
      try { (HEADS[L.arch] || HEADS.bear)(D, v, T); } catch (e) { err(e); }
      if (L.space) {   // the Interstellar League: a bubble helmet
        D.c.beginPath(); D.c.arc(0, -1, 13.4, 0, Math.PI * 2); D.c.lineWidth = 1.1; D.c.strokeStyle = "#bfeaff"; D.c.stroke();
        D.arc(0, -1, 11.6, Math.PI * 1.15, Math.PI * 1.45, 1.4, "#ffffff");
        D.rect(-6, 11, 12, 2.2, "#c8ced8");
      }
      D.restore();
    };
    // the arms over the big head: a raised arm, a flex, a wave all read in front of it
    headDraw();
    if (P.wheel != null) {   // v194 B: the imaginary car's steering wheel, between his two fists
      const cx = (J.armL.h.x + J.armR.h.x) / 2, cy = (J.armL.h.y + J.armR.h.y) / 2, r = Math.max(4.6, Math.hypot(J.armR.h.x - J.armL.h.x, J.armR.h.y - J.armL.h.y) / 2);
      D.c.beginPath(); D.c.arc(cx, cy, r, 0, Math.PI * 2); D.c.lineWidth = 1.6; D.c.strokeStyle = "#2a2a30"; D.c.stroke();
      D.at(cx, cy, P.wheel * DEG); D.line(-r, 0, r, 0, 1.1, "#3a3a42"); D.line(0, 0, 0, r, 1.1, "#3a3a42"); D.circ(0, 0, 1.6, T.p2); D.restore();
    }
    armDraw(J.armL, false);
    armDraw(J.armR, true);
    // the ball
    if (P.ball === "R" || P.ball === "E") ballDraw(D, J.armR.h.x + J.armR.dir.x * 1.2, J.armR.h.y - 1 + J.armR.dir.y * 1.2, P.ball === "E" ? 1.4 : 0.4);
    if (P.ball === "G") ballDraw(D, J.armR.h.x + 1, GY - 2.2, 0);
    if (P.bow) { const h = J.armL.h; D.c.beginPath(); D.c.arc(h.x + 1, h.y, 7, -1.2, 1.2); D.c.lineWidth = 1.3; D.c.strokeStyle = "#8a5a2c"; D.c.stroke(); D.line(h.x + 3.6, h.y - 6.6, J.armR.h.x, J.armR.h.y, 0.5, "#f4f0e8"); D.line(h.x + 3.6, h.y + 6.6, J.armR.h.x, J.armR.h.y, 0.5, "#f4f0e8"); D.line(J.armR.h.x, J.armR.h.y, h.x + 5, h.y, 0.8, "#c8a06a"); }
    if (P.saber) { const h = { x: (J.armL.h.x + J.armR.h.x) / 2, y: (J.armL.h.y + J.armR.h.y) / 2 }; D.line(h.x, h.y - 1, h.x, h.y - 16, 2.2, shade(T.p2, 1.3)); D.line(h.x, h.y - 1, h.x, h.y - 16, 0.8, "#ffffff"); }
    return J;
  }
  function ballDraw(D, x, y, rot) {
    D.at(x, y, rot || 0); D.ell(0, 0, 3.4, 2.2, "#7a3e1c"); D.ell(-0.8, -0.6, 1.6, 0.8, "#a4582a"); D.line(-1.4, 0, 1.4, 0, 0.5, "#ffffff"); D.restore();
  }

  /* ---------------- pixels: a hard alpha edge and a one-pixel outline, the field's own style ---------------- */
  function pixelate(cv) {
    const x = cv.getContext("2d"), W = cv.width, H = cv.height, im = x.getImageData(0, 0, W, H), d = im.data, n = W * H;
    const A = new Uint8Array(n);
    for (let i = 0; i < n; i++) { if (d[i * 4 + 3] >= 110) { A[i] = 1; d[i * 4 + 3] = 255; } else d[i * 4 + 3] = 0; }
    const ink = rgbOf(INK);
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const i = y * W + xx; if (A[i]) continue;
      if ((xx > 0 && A[i - 1]) || (xx < W - 1 && A[i + 1]) || (y > 0 && A[i - W]) || (y < H - 1 && A[i + W])) { d[i * 4] = ink[0]; d[i * 4 + 1] = ink[1]; d[i * 4 + 2] = ink[2]; d[i * 4 + 3] = 255; }
    }
    x.putImageData(im, 0, 0);
    return cv;
  }

  /* ---------------- the sheet: every pose of one team's mascot, ×2, in a grid (cached) ---------------- */
  const COLS = 8, FW_PX = LW * SCALE, FH_PX = LH * SCALE;
  const SHEETS = new Map();
  function teamColours(T) {
    const ok = (h) => (typeof h === "string" && /^#[0-9a-f]{6}$/i.test(h) ? h : null);
    return { p1: ok(T && T[0]) || "#1f4fd0", p2: ok(T && T[1]) || "#e8c86a" };
  }
  function sheetKey(logo, cols, space) { return "m193ai_" + logo + "_" + cols.p1.slice(1) + cols.p2.slice(1) + (space ? "_s" : ""); }
  // a sheet is drawn pose by pose; `step` (the broadcast) draws at most that many poses a call and answers null until the
  // sheet is whole, so a cold sheet (~20-50 ms warm, ~150 ms on a cold page) is spread over a few frames
  const BUILDING = new Map();
  function sheetV193AI(logo, colsIn, space, step) {
    const cols = teamColours(colsIn), id = forLogo(logo), key = sheetKey(id.logo, cols, space);
    let S = SHEETS.get(key);
    if (S) { SHEETS.delete(key); SHEETS.set(key, S); return S; }   // most recently used last
    let B = BUILDING.get(key);
    if (!B) {
      const L = lookFor(id, cols, space), rows = Math.ceil(POSE_NAMES.length / COLS);
      const cv = document.createElement("canvas"); cv.width = COLS * FW_PX; cv.height = rows * FH_PX;
      const x = cv.getContext("2d"); x.imageSmoothingEnabled = false;
      const one = document.createElement("canvas"); one.width = LW; one.height = LH;
      B = { L, cv, x, one, ox: one.getContext("2d", { willReadFrequently: true }), frames: [], i: 0, ms: 0 };   // read back 37 times a sheet: keep it on the CPU
      BUILDING.set(key, B);
    }
    const t0 = performance.now(), end = step ? Math.min(POSE_NAMES.length, B.i + step) : POSE_NAMES.length;
    for (; B.i < end; B.i++) {
      const n = POSE_NAMES[B.i], i = B.i;
      B.ox.clearRect(0, 0, LW, LH);
      let J = null; try { J = drawPose(B.ox, POSES[n], B.L); } catch (e) { err(e); }
      pixelate(B.one);
      const fx = (i % COLS) * FW_PX, fy = Math.floor(i / COLS) * FH_PX;
      B.x.drawImage(B.one, 0, 0, LW, LH, fx, fy, FW_PX, FH_PX);
      B.frames.push({ name: n, x: fx, y: fy, w: FW_PX, h: FH_PX, hipY: J ? J.hip.y : 40,
        head: J ? { x: J.head.x, y: J.head.y } : { x: CX, y: 24 }, hands: J ? [{ x: J.armL.h.x, y: J.armL.h.y }, { x: J.armR.h.x, y: J.armR.h.y }] : [{ x: CX - 8, y: 30 }, { x: CX + 8, y: 30 }] });   // v194 B: where his eyes and fists are (tears, the sign, the merch)
    }
    const dt = performance.now() - t0; B.ms += dt; V.stepMax = Math.max(V.stepMax || 0, dt); V.steps = (V.steps || 0) + 1;
    if (B.i < POSE_NAMES.length) return null;
    BUILDING.delete(key);
    const L = B.L;
    S = { key, id, cols, space: !!space, cv: B.cv, frames: B.frames, ms: B.ms, look: { arch: id.arch, variant: id.variant, weapon: L.weapon, shield: L.shield, tail: L.tail, wings: L.wings, cape: L.cape } };
    V.builds++; V.buildMs += B.ms; V.buildMax = Math.max(V.buildMax, B.ms);
    SHEETS.set(key, S);
    const cap = Math.max(2, TUv("mascotCacheV193AI", 8));
    while (SHEETS.size > cap) SHEETS.delete(SHEETS.keys().next().value);
    return S;
  }
  // one frame of a sheet as its own small canvas (the cards and the Locker)
  function frameInto(ctx, S, pose, dx, dy, dw, dh, o) {
    const f = S.frames[POSE_IX[pose] != null ? POSE_IX[pose] : 0];
    o = o || {};
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (o.rot || o.lift || o.sx) {
      const k = dw / f.w, px = dx + dw / 2, py = dy + f.hipY * SCALE * k - (o.lift || 0) * SCALE * k;
      ctx.translate(px, py); ctx.rotate((o.rot || 0) * DEG); ctx.scale(o.sx || 1, o.sy || 1);
      ctx.drawImage(S.cv, f.x, f.y, f.w, f.h, -dw / 2, -f.hipY * SCALE * k, dw, dh);
    } else ctx.drawImage(S.cv, f.x, f.y, f.w, f.h, dx, dy, dw, dh);
    ctx.restore();
  }

  /* ---------------- who owns them ---------------- */
  let actCache = { t: 0, v: false };
  function owned() {
    try { const C = window.RIB_COSMETICS; return !!(C && C.owned && C.owned("mascot_team") && C.equipped("mascot") === "mascot_team"); } catch (e) { return false; }
  }
  function active(fresh) {
    if (!onV193AI()) return false;
    if (TUv("mascotPreviewV193AI", 0)) return true;
    const now = performance.now();
    if (!fresh && now - actCache.t < 500) return actCache.v;
    actCache = { t: now, v: owned() };
    return actCache.v;
  }

  /* ---------------- the dances: which pose at t, the lift (logical px), the turn (deg) ---------------- */
  const FLEX_MAP = ["ready", "guard", "flexR", "flex2", "flex2low", "flexL", "flex2", "flex2", "pumpR", "flex2", "flex2", "stand"];
  const FLIP_MAP = ["ready", "crouch", "squat", "launch", "tuck", "tuck", "tuck", "tuck", "landing", "crouch", "squat", "armsUp"];
  const SPIKE_MAP = ["holdBall", "ballUp", "windup", "ballUp", "slam", "follow", "follow", "flex2", "chest", "flex2", "crouch", "stand"];
  const BODY_MAP = { flex: FLEX_MAP, backflip: FLIP_MAP, spike: SPIKE_MAP };
  // v177 I's bodies, as mascot routines: [pose, share of the run] — played over the body's own length
  const ROUTINES = {
    moonwalk: { seq: ["moon0", "moon1"], step: 230, travel: -14, end: "pumpR" },
    worm: { seq: ["plank", "plank2"], step: 260, rot: -90, travel: 10, end: "armsUp" },
    leap: { seq: ["crouch", "launch", "launch", "armsUp"], parts: [0.18, 0.5, 0.12, 0.2], hop: 22 },
    quake: { body: "spike" },
    griddy: { seq: ["griddy0", "griddy1"], step: 190 },
    archer: { seq: ["guard", "archer", "archer", "pumpR"], parts: [0.15, 0.35, 0.25, 0.25] },
    robot: { seq: ["robot0", "robot1"], step: 330 },
    nap: { seq: ["crouch", "plank", "plank", "armsUp"], parts: [0.15, 0.55, 0.12, 0.18], rotAt: [1, 2], rot: -90 },
    phone: { seq: ["phone", "phone", "wave0", "wave1"], parts: [0.35, 0.3, 0.17, 0.18] },
    saber: { seq: ["guard", "saber", "slam", "saber", "armsUp"], parts: [0.15, 0.25, 0.2, 0.2, 0.2] }
  };
  function spinPhi(u) { const A = Math.min(0.95, Math.max(0, TUv("v161AflipEase", 0.7))); return 360 * (u - A * Math.sin(2 * Math.PI * u) / (2 * Math.PI)); }
  function celPose(cel, t) {
    const out = { pose: "stand", lift: 0, rot: 0, sx: 1, sy: 1, dx: 0 };
    if (cel.kind === "cycle") {
      const i = Math.floor(t / Math.max(40, cel.fm)) % 4; out.pose = "cheer" + i;
      if (i === 3 && !REDUCED) out.lift = 3 * Math.sin(((t % cel.fm) / cel.fm) * Math.PI);
      return out;
    }
    if (cel.kind === "body") {
      const map = BODY_MAP[cel.name] || FLEX_MAP;
      let o = null; try { const B = window.RIB_COSMETICS && window.RIB_COSMETICS.boardCel; o = B && B.pose ? B.pose(cel.name, t, REDUCED) : null; } catch (e) { o = null; }
      if (!o) { out.pose = map[Math.min(11, Math.floor((t / cel.ms) * 12))]; return out; }
      out.pose = map[o.k] || "stand"; out.sx = o.sx || 1; out.sy = o.sy || 1;
      if (!REDUCED) {
        out.lift = o.lift || 0;
        if (o.air) { const u = o.u != null ? o.u : 0.5; out.pose = u < 0.1 ? "launch" : u > 0.9 ? "landing" : "tuck"; out.rot = -(o.phi != null && o.phi ? o.phi : spinPhi(u)); }
      }
      return out;
    }
    if (cel.kind === "v177") {
      const R = ROUTINES[cel.name] || ROUTINES.griddy, u = Math.min(1, t / Math.max(1, cel.ms));
      if (R.body) return celPose({ kind: "body", name: R.body, ms: cel.ms }, t * (TUv("mascotSpikeMsV193AI", 2500) / Math.max(1, cel.ms)));
      if (R.parts) {
        let acc = 0, k = 0; for (; k < R.parts.length - 1; k++) { if (u < acc + R.parts[k]) break; acc += R.parts[k]; }
        out.pose = R.seq[k];
        if (R.hop && k === 1 && !REDUCED) { const q = (u - acc) / R.parts[k]; out.lift = R.hop * 4 * q * (1 - q); }
        if (R.rotAt && R.rotAt.indexOf(k) >= 0 && !REDUCED) out.rot = R.rot;
        return out;
      }
      if (u > 0.85 && R.end) { out.pose = R.end; return out; }
      out.pose = R.seq[Math.floor(t / R.step) % R.seq.length];
      if (R.rot && !REDUCED) { out.rot = R.rot; out.lift = 6; }
      if (R.travel && !REDUCED) out.dx = R.travel * Math.min(1, u / 0.85);
      return out;
    }
    return out;
  }
  function idlePose(t, excite, ph) {
    const out = { pose: "idleA", lift: 0, rot: 0, sx: 1, sy: 1, dx: 0 };
    const ms = TUv("mascotIdleMsV193AI", 420);
    if (excite > TUv("mascotWaveAtV193AI", 0.4)) {
      out.pose = Math.floor((t + ph) / (ms * 0.6)) % 2 ? "wave0" : "wave1";
      if (!REDUCED) out.lift = Math.abs(Math.sin((t + ph) / (ms * 0.6) * Math.PI)) * 2.4 * Math.min(1, excite);
      return out;
    }
    out.pose = Math.floor((t + ph) / ms) % 2 ? "idleA" : "idleB";
    if (!REDUCED) out.lift = Math.abs(Math.sin((t + ph) / ms * Math.PI)) * TUv("mascotBobPxV193AI", 1.5);
    return out;
  }

  /* ---------------- the broadcast: one mascot on each bench ---------------- */
  // the field's geometry, handed over by 05's hook (its constants live inside its own IIFE)
  function geo(G) {
    if (!G || !(G.PLAY_W > 0) || G.FW == null || G.PLAY_L == null) return null;
    return { FW: G.FW, PLAY_L: G.PLAY_L, PLAY_W: G.PLAY_W, VDIR: G.VDIR || 1, MIDY: G.MIDY != null ? G.MIDY : 220 };
  }
  function teamsFor(scene) {
    let names = { us: "", them: "" }; try { names = scene.teamNames ? scene.teamNames() : names; } catch (e) {}
    // the fixture's own opponent (the scoreboard's name is cut at ten letters and is not written yet on the first frames)
    try { const st = window.__getGridironState && window.__getGridironState(), o = st && st._oppName; if (o) names = { us: names.us, them: String(o).replace(/^.*'s /, "") }; } catch (e) {}
    const cust = window.__GRIDIRON_TEAM_CUSTOM__ || {}, F = window.__V161A_FIELD;
    const kit = (k) => { try { const c = F && F.kit ? F.kit(k) : null; return c && c[0] ? c : null; } catch (e) { return null; } };
    const pals = window.TEAM_PALETTES || [];
    const usCols = kit("off") || (Array.isArray(cust.col) ? cust.col : pals[cust.palette | 0]) || ["#1f4fd0", "#e8c86a"];
    let themCols = kit("def"); if (!themCols) { try { const sb = window.__SCOREBUG_V98; themCols = sb && sb.them; } catch (e) {} }
    const usLogo = cust.logo != null ? cust.logo | 0 : logoForTeam(cust.teamName || names.us);
    return { off: { logo: usLogo, cols: usCols, name: names.us }, def: { logo: logoForTeam(names.them), cols: themCols || ["#c8414b", "#c3c9d2"], name: names.them } };
  }
  function spaceLevel() { try { const st = window.__getGridironState ? window.__getGridironState() : window.S; return !!(st && st.player && (st.player.level | 0) >= 8); } catch (e) { return false; } }
  function texFor(scene, S) {
    const tm = scene.textures; if (!tm) return null;
    if (tm.exists(S.key)) return S.key;
    try {
      const tx = tm.addCanvas(S.key, S.cv);
      S.frames.forEach((f, i) => tx.add(i, 0, f.x, f.y, f.w, f.h));
      return S.key;
    } catch (e) { err(e); return null; }
  }
  function destroyAll(st) {
    if (!st) return;
    (st.list || []).forEach((m) => { try { m.img && m.img.destroy(); } catch (e) {} try { m.sh && m.sh.destroy(); } catch (e) {} try { m.v194 && dropV194B(m); } catch (e) {} });
    st.list = [];
  }
  function stateOf(scene) {
    let st = scene.__mascotV193AI;
    if (!st || st.scene !== scene) {
      st = scene.__mascotV193AI = { scene, list: [], side: null, seen: new WeakSet(), lastRun: null, celN: 0 };
      V.scenes++;
      try { scene.events && scene.events.once("shutdown", () => { destroyAll(st); }); } catch (e) {}
    }
    return st;
  }
  // at most ONE uncached sheet is drawn a frame (~10-30 ms on a phone); the other bench's waits for the next frame
  function build(scene, st) {
    destroyAll(st);
    const T = teamsFor(scene), space = spaceLevel();
    let budget = 1; st.partial = false; st.pend = null;
    const one = on194(), homeT = homeTeamV194B();   // v194 B: only the HOME team's mascot
    ["off", "def"].forEach((team, i) => {
      if (one ? team !== homeT : team === "def" && !TUv("mascotBothV193AI", 1)) return;
      let S = null;
      if (!SHEETS.has(sheetKey(((Number(T[team].logo) || 0) % NLOGO + NLOGO) % NLOGO, teamColours(T[team].cols), space))) {
        if (!budget) { st.partial = true; st.pend = st.pend || { logo: T[team].logo, cols: T[team].cols, space }; return; }
        budget--; S = sheetV193AI(T[team].logo, T[team].cols, space, Math.max(1, TUv("mascotPosesPerFrameV193AI", 4)));
        if (!S) { st.partial = true; st.pend = { logo: T[team].logo, cols: T[team].cols, space }; return; }   // still drawing: the next frames carry on
      } else S = sheetV193AI(T[team].logo, T[team].cols, space);
      const key = texFor(scene, S);
      if (!key) return;
      const img = scene.add.image(0, 0, key, POSE_IX.idleA);
      const sh = scene.add.ellipse(0, 0, 10, 3, 0x000000, TUv("sideShadowA", 0.26));
      st.list.push({ team, bank: team === "def" ? -1 : 1, S, key, img, sh, u: null, ph: i * 210, cel: null, lastPose: -1, vis: true, colsKey: S.key, name: T[team].name, other: T[team === "off" ? "def" : "off"].name, cols: teamColours(T[team].cols) });
    });
    st.teamsKey = teamsKeyV194B(scene, T, space);
  }
  // which bench a celebrating marker's team stands on
  const teamOfMarker = (m) => (String((m && (m.kit || m.team)) || "off") === "def" ? "def" : "off");
  function startCel(st, team, cel) {
    const m = st.list.find((q) => q.team === team); if (!m) return null;
    if (m.cel && m.cel.alive && m.cel.prio > cel.prio) return null;
    cel.alive = true; m.cel = cel; st.celN++;
    if (V.cels.length < 40) V.cels.push({ team, kind: cel.kind, name: cel.name || null, ms: Math.round(cel.ms), at: Math.round(performance.now()) });
    return cel;
  }
  function watchCelebrations(scene, st, now) {
    // HIS drawn bodies first (v161 A / v177 I runs), then anyone entering the drawn cheer cycle
    [[window.__V161A, "body"], [window.__V177I, "v177"]].forEach(([R, kind]) => {
      const run = R && R.active;
      if (!run || !run.alive || run === st.lastRun) return;
      st.lastRun = run;
      let team = "off"; try { const mk = (scene.markers || []).find((m) => m && m.__v161a === run); if (mk) team = teamOfMarker(mk); } catch (e) {}
      startCel(st, team, { kind, name: run.name, t0: run.t0, ms: run.total || 2600, run, prio: 2 });
    });
    const ms0 = TUv("celebrateMs", 2400), fm = TUv("celebrateFrameMs", 170);
    (scene.markers || []).forEach((m) => {
      if (!m) return;
      if (m.forceState === "celebrateSeq") {
        if (st.seen.has(m)) return; st.seen.add(m);
        startCel(st, teamOfMarker(m), { kind: "cycle", t0: now, ms: m._celMsV164G || ms0, fm, prio: 1 });
      } else if (st.seen.has(m)) st.seen.delete(m);
    });
  }
  function place(scene, st, m, G, now, cam) {
    if (on194()) {   // v194 B: the home mascot lives his own life — and a Phaser Text's canvas key (a UUID off Math.random) is paid from his own stream, never the game's
      const mR = Math.random; Math.random = QUIET_V194B;
      try { return placeV194B(scene, st, m, G, now, cam); } finally { Math.random = mR; }
    }
    const S = scene.side, img = m.img;
    // the spot: on its own bench's bank, just outside the painted line, near the ball — the nearest stretch of that
    // sideline the camera can see (re-chosen every `mascotSpotMsV193AI`; the mascot jogs there, it jumps only from afar)
    const lf = scene._lastField, YD = G.PLAY_W / 100;
    const adj = (x) => (G.VDIR > 0 ? x : G.FW - x);
    const losU = lf ? adj(G.PLAY_L + (Math.max(0, Math.min(100, lf[0])) / 100) * G.PLAY_W) : G.FW / 2;
    const paint = (S && S.paint) || 206;
    const fresh = m.tgt == null || now - (m.tgtAt || 0) > TUv("mascotSpotMsV193AI", 400) || m.tgtSide !== S;
    if (fresh || m.ageK == null) m.ageK = Math.max(TUv("mascotAgeMinV193AI", 0.7), (() => { try { return window.__V144 && window.__V144.ageK ? window.__V144.ageK() : 1; } catch (e) { return 1; } })());   // v144 A: the players' age scale, read once a spot
    const spotAt = (u) => {
      const p0 = scene.crowdProject(u, G.MIDY), p1 = scene.crowdProject(u, G.MIDY + 10);
      const pxPer = Math.max(0.01, Math.abs(p1.x - p0.x) / 10), sc0 = p0.s * m.ageK * TUv("mascotScaleV193AI", 1.45) / SCALE;
      const q = scene.crowdProject(u, G.MIDY + m.bank * (paint + TUv("mascotLaneV193AI", 8) + (13 * SCALE * sc0) / pxPer));
      q.sc = sc0; return q;
    };
    const uMin = G.PLAY_L - 3 * YD, uMax = G.PLAY_L + G.PLAY_W + 3 * YD, clampU = (u) => Math.max(uMin, Math.min(uMax, u));
    if (fresh) {
      m.tgtAt = now; m.tgtSide = S;
      const base = TUv("mascotLosYdV193AI", 8) + (m.team === "def" ? TUv("mascotSplitYdV193AI", 3) : 0);
      let best = clampU(losU + base * YD);
      if (cam && cam.worldView && cam.worldView.width > 0) {
        const wv = cam.worldView, offs = [-8, -4, 0, 4, 8, 12, 16, 20, 26, 32, 40, -12, -16];   // nearest the camera first: the biggest mascot that is in shot
        for (let i = 0; i < offs.length; i++) {
          const u = clampU(losU + (base + offs[i]) * YD), q = spotAt(u), half = 16 * q.sc * SCALE, tall = 62 * q.sc * SCALE;
          if (q.x - half > wv.x + 4 && q.x + half < wv.x + wv.width - 4 && q.y - tall > wv.y && q.y < wv.y + wv.height - 4) { best = u; break; }
        }
      }
      m.tgt = best;
    }
    const jog = TUv("mascotJogYdV193AI", 8) * YD * Math.min(0.1, Math.max(0, now - (m.lastT || now)) / 1000);
    m.lastT = now;
    if (m.u == null || Math.abs(m.u - m.tgt) > TUv("mascotJumpYdV193AI", 40) * YD) m.u = m.tgt;
    else m.u += Math.max(-jog, Math.min(jog, m.tgt - m.u));
    m.moving = Math.abs(m.u - m.tgt) > 0.5 * YD;
    const p = spotAt(m.u), sc = p.sc;
    // the dance at this instant
    let o;
    if (m.cel && m.cel.alive) {
      const t = m.cel.run && m.cel.run.hold != null ? m.cel.run.hold : now - m.cel.t0;
      if (t >= m.cel.ms) { m.cel.alive = false; o = null; } else o = celPose(m.cel, t);
    }
    const ex = S ? S.excite || 0 : 0;
    if (!o) o = idlePose(m.moving ? now * 2.2 : now, m.moving ? 0 : ex, m.ph);   // jogging: the same two steps, quicker
    const fi = POSE_IX[o.pose] != null ? POSE_IX[o.pose] : 0, f = m.S.frames[fi];
    if (fi !== m.lastPose) { img.setFrame(fi); m.lastPose = fi; }
    m.pose = o.pose;
    const flip = m.bank < 0 ? -1 : 1;   // each faces a little toward the field's middle
    const oy = f.hipY / LH;
    img.setOrigin(0.5, oy);
    const k = sc * SCALE;
    img.setScale(flip * sc * (o.sx || 1), sc * (o.sy || 1));
    img.setRotation(flip * (o.rot || 0) * DEG);
    img.setPosition(p.x + (o.dx || 0) * flip * -1 * k, p.y - (GY - f.hipY) * k - (o.lift || 0) * k);
    let depth = 3.5; try { depth = scene.sideDepth(p.y) + 0.0016; } catch (e) {}
    img.setDepth(depth);
    m.sh.setPosition(p.x + (o.dx || 0) * flip * -1 * k, p.y - 0.4 * k).setSize(11 * k * (1 - Math.min(0.5, (o.lift || 0) / 30)), 3 * k).setDepth(depth - 0.0006);
    // light: the bench's own shade (static half), refreshed when the sideline is rebuilt
    if (m.lightSide !== S) { m.lightSide = S; try { const f0 = scene.sideShadeBase(m.u, p.k, m.bank); const lv = Math.max(0, Math.min(255, Math.round(f0 * 255 / 8) * 8)); img.setTint((Math.round(lv * 0.98) << 16) | (Math.round(lv * 0.99) << 8) | Math.min(255, Math.round(lv * 1.02))); } catch (e) {} }
    // cull: off the camera, or too small to read
    let vis = true;
    if (cam) {
      const wv = cam.worldView, hPx = img.displayHeight * (cam.zoom || 1);
      if (hPx < TUv("mascotMinPxV193AI", 14)) vis = false;
      else if (wv && wv.width > 0 && (img.x + 40 * k < wv.x || img.x - 40 * k > wv.x + wv.width || img.y + 40 * k < wv.y || img.y - 60 * k > wv.y + wv.height)) vis = false;
    }
    if (vis !== m.vis) { m.vis = vis; img.setVisible(vis); m.sh.setVisible(vis); }
    vis ? V.shown++ : V.culled++;
    m.sx = p.x; m.sy = p.y; m.k = k;
  }
  function frame(scene, delta, geom) {
    const t0 = performance.now();
    V.calls = (V.calls || 0) + 1;
    const b0 = V.steps || 0, s0 = V.scenes;
    try {
      if (!scene || !scene.add || !scene.crowdProject) return;
      const on = active();
      const st = scene.__mascotV193AI;
      if (!on) { if (st && st.list && st.list.length) destroyAll(st); return; }
      const G = geo(geom); if (!G) return;
      const S = stateOf(scene);
      // who is playing: re-read on a new snap's sideline and once a second (a kit can change under a live game)
      let stale = (!S.list.length && !S.partial) || S.list.some((m) => !m.img || !m.img.scene);
      if (!stale && (S.side !== scene.side || t0 - (S.teamsAt || 0) > 1000)) { S.teamsAt = t0; stale = S.teamsKey !== teamsKeyV194B(scene, teamsFor(scene), spaceLevel()); }
      S.geom = geom;   // v194 B: the check drives frame() directly with the hook's own geometry
      if (stale) { build(scene, S); S.teamsAt = t0; }
      else if (S.partial && S.pend) { if (sheetV193AI(S.pend.logo, S.pend.cols, S.pend.space, Math.max(1, TUv("mascotPosesPerFrameV193AI", 4)))) build(scene, S); }   // a bench's sheet still drawing: the next slice, the sprites already up stay
      if (!S.list.length) return;
      watchCelebrations(scene, S, t0);
      const cam = scene.cameras && scene.cameras.main;
      S.list.forEach((m) => place(scene, S, m, G, t0, cam));
      if (S.side !== scene.side) S.side = scene.side;
      ensureCards();
    } catch (e) { err(e); }
    const dt = performance.now() - t0;
    V.frames++; V.frameMs += dt; V.frameMax = Math.max(V.frameMax, dt); if (V.ms.length < 600) V.ms.push(+dt.toFixed(3));
    if ((V.steps || 0) === b0 && V.scenes === s0) { V.steady = V.steady || []; if (V.steady.length < 600) V.steady.push(+dt.toFixed(3)); }   // the steady state: no sheet drawn, no new scene
  }

  /* ===== v194 B THE MASCOT COMES ALIVE =====
   * The owner: "Only the home team's mascot should be there. On great plays celebrate and on bad plays cry, act mad, run
   * around. Have his personality be dictated by how well the home team is doing. Really exaggerate. He should be near the
   * endzone most times, or on the sidelines if you can see well. Have him throwing merch in the stands. Doing cartwheels.
   * Jumping. Steering. Holding signs. Really bring him to life. Add text bubbles (over 50) giving quippy phrases."
   *   ONE MASCOT    the HOME team's (`window.__homeGameV93 !== false` → his own team, "off"; an away week → the opponent's).
   *                 `build` makes only that one; the membership gate (`active()`) is untouched.
   *   WHERE         `spotV194B` scores candidate spots every `mascotSpotMsV194B` ms: beside each end zone (outside the
   *                 sideline, by the corner — the bias `mascotEzBiasV194B` makes that "most times") and the sideline stretch
   *                 near the ball, both banks; only spots fully inside the camera's view count, a spot with a player on it
   *                 is marked down, a far one and a bank switch cost. He RUNS there (`mascotRunYdV194B` yd/s, the run cycle,
   *                 facing his way); a bank switch runs round behind the end line, never across the field. Every spot sits
   *                 outside the painted line, and every act's sideways travel (cartwheels, circles, the drive) goes OUTWARD.
   *                 Only an off-camera mascot is moved in one step.
   *   MOOD          `moodV194B`: the home margin (÷ `moodMarginV194B` 14, ×1.3 in the fourth quarter), the momentum of the
   *                 last plays (an EMA of each play's value for the home side, `moodMomentumKV194B` .45) and the season
   *                 record when it is his team → ecstatic / confident / nervous / desperate; two bad plays in a row make
   *                 him furious. The mood picks his idle (the swagger, the strut sign, nail-biting, pacing, slumping,
   *                 stomping) and how BIG every reaction is (more acts, higher jumps).
   *   REACTIONS     `classifyV194B` reads the whistle's payload from the home side: touchdown, takeaway, sack, big gain,
   *                 stop, field goal → celebrations (cartwheels, a backflip, jumps, the air chest bump, STEERING the
   *                 imaginary car, throwing merch); the opponent's touchdown, a giveaway, a sack taken, a flag on the home
   *                 side, a big gain against → crying (fountain tears), the temper (red face, steam, stomping), running in
   *                 circles, head in hands, kicking the turf. A drawn sign ("DE-FENSE", "GO <TEAM>!", "MAKE SOME NOISE",
   *                 "REF?!") comes up on defensive downs, third downs, flags and idles.
   *   MERCH         t-shirts, foam fingers and caps in the team's colours (`merchSheetV194B`, drawn once, pixel style) arc
   *                 out of his hand and land IN the stands — a crowd section on camera, its own box (`C.secs`).
   *   BUBBLES       `PHRASES_V194B`, 100+ lines in 20 buckets (touchdown, big play, takeaway, sack, bad play, opponent TD,
   *                 giveaway, sack taken, flag, red zone, third down, defense, each mood's idle, blowouts both ways); the
   *                 team's name where it is funny. A pixel bubble with a stepped tail over his head, a constant size on
   *                 screen, `mascotBubbleMsV194B` 2 s, never two at once, `mascotBubbleGapMsV194B` between them.
   *   POSES         26 new poses in the same sheet (run cycle, star, jump, cry, mad, sign, throw, steer, kick, slump,
   *                 nails, hips, bump, point) — drawn once like the rest.
   * Deterministic and cosmetic: every choice draws from a private seeded stream (`rngV194B`), never Math.random; nothing
   * is written to the play, the sim or the save. Kill switch TU `v194B` 0: v193 AI's two benches exactly. `window.__V194B`. */
  const on194 = () => !!TUv("v194B", 1);
  const V194 = (window.__V194B = window.__V194B || { home: null, team: "", mood: null, moodScore: 0, margin: 0, momentum: 0, record: 0, act: null, bubble: null, phrases: 0, buckets: {}, reactions: [], said: [], bubbles: 0, maxBubbles: 0, merch: { spawned: 0, landed: 0, inStands: 0, flying: 0, last: null }, spot: null, ez: 0, side: 0, moves: 0, teleports: 0, judged: 0, onField: 0, errs: [] });
  function homeTeamV194B() { return window.__homeGameV93 === false ? "def" : "off"; }
  function teamsKeyV194B(scene, T, space) { return JSON.stringify(T) + space + (on194() ? "|v194B:" + homeTeamV194B() : ""); }
  // a private stream (mulberry32): the mascot never draws from Math.random, so it can never move the sim's sample path
  function rngV194B(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const QUIET_V194B = rngV194B(0x194b);
  const pickV194B = (A, list) => list[Math.floor(A.rnd() * list.length) % list.length];

  /* ---- the lines: {T} his team, {O} the other one ---- */
  const PHRASES_V194B = {
    td: ["TOUCHDOWN, BABY!", "SIX POINTS OF PURE JOY!", "{T} IN THE HOUSE!", "PUT IT ON THE JUMBOTRON!", "I KNEW IT! I ALWAYS KNEW IT!", "SOMEBODY CALL MY MOM!", "THAT'S HOW THE {T} DO IT!", "END ZONE? MORE LIKE FUN ZONE!", "IT'S RAINING T-SHIRTS!"],
    big: ["LOOK AT HIM GO!", "HE'S GOT WHEELS!", "SOMEBODY CATCH HIM! ...NOT YOU, {O}!", "ZOOM ZOOM ZOOM!", "HIGHLIGHT REEL!", "MOVE THOSE CHAINS!", "BEEP BEEP! COMING THROUGH!"],
    takeaway: ["OUR BALL NOW!", "THANK YOU, {O}!", "TAKEAWAY TIME!", "GIMME THAT!", "FINDERS KEEPERS!", "TURNOVER! TURNOVER!"],
    sack: ["SACK ATTACK!", "PLANTED HIM!", "QB, MEET GRASS!", "THAT'S A SACK LUNCH!", "NOWHERE TO RUN!"],
    good: ["THAT'S MY TEAM!", "YES! YES! YES!", "KEEP IT COMIN'!", "LOVE TO SEE IT!", "STOPPED COLD!"],
    bad: ["NOOOOO!", "WHY?! WHY?!", "MY HEART CAN'T TAKE THIS", "I CAN'T WATCH...", "THAT'S NOT IN THE PLAYBOOK!", "WHO DREW UP THAT PLAY?!"],
    giveaway: ["GIVE IT BAAACK!", "BUTTERFINGERS!", "THAT'S OUR BALL, {O}!", "NOT THE TURNOVER! ANYTHING BUT THAT!", "HOLD ON TO IT!"],
    sackTaken: ["PROTECT THE QB!", "BLOCK SOMEBODY! ANYBODY!", "OUCH. JUST... OUCH.", "WHERE WAS THE LINE?!"],
    oppTd: ["THAT DIDN'T COUNT, RIGHT?", "I NEED A MINUTE.", "BOO! BOOOOOO!", "{O}?! ARE YOU KIDDING ME?!", "DEFENSE, WAKE UP!", "I'M NOT CRYING, YOU'RE CRYING!"],
    penalty: ["REF! GET YOUR EYES CHECKED!", "THAT'S A TERRIBLE CALL!", "I'VE SEEN BETTER CALLS AT BINGO!", "FLAG?! ON WHAT?!", "THE REF'S ON THEIR PAYROLL!"],
    flagThem: ["THROW THE FLAG! YEAH!", "FREE YARDS, THANK YOU!", "CHEATERS NEVER PROSPER, {O}!"],
    idleConfident: ["WE GOT THIS.", "TOO EASY.", "{T} NATION, STAND UP!", "IS THAT ALL YOU GOT, {O}?", "FEELING GOOD, LOOKING GOOD!", "SWAG LEVEL: MAXIMUM."],
    idleNervous: ["I'M NOT NERVOUS. YOU'RE NERVOUS.", "C'MON... C'MON...", "COME ON, {T}!", "DEEP BREATHS. DEEP BREATHS.", "THIS IS FINE. EVERYTHING'S FINE.", "MY NAILS ARE GONE."],
    idleEcstatic: ["BEST. DAY. EVER.", "SOMEBODY PINCH ME!", "WE'RE UNSTOPPABLE!", "I LOVE THIS TEAM!"],
    idleDesperate: ["WE NEED A MIRACLE!", "STILL TIME! STILL TIME!", "I BELIEVE! DO YOU BELIEVE?!", "ANYBODY GOT A MIRACLE?"],
    idleFurious: ["I'M SO MAD I COULD EAT MY HEAD!", "SOMEBODY HOLD MY FOAM FINGER!", "GRRRRRRR!", "I'M FINE! I'M TOTALLY FINE!"],
    blowoutWin: ["CALL THE MERCY RULE!", "SCOREBOARD! LOOK AT THE SCOREBOARD!", "THIS IS A PARADE NOW!", "{O} WANTS TO GO HOME!"],
    blowoutLoss: ["IT'S A REBUILDING YEAR...", "WAIT 'TIL NEXT SEASON!", "AT LEAST THE HOT DOGS ARE GOOD.", "STILL DANCING. NOBODY CAN STOP ME."],
    redZone: ["PUNCH IT IN!", "I CAN SMELL THE END ZONE!", "SO CLOSE I CAN TASTE IT!", "FINISH THE DRIVE!"],
    thirdDown: ["THIRD DOWN! GET LOUD!", "MAKE SOME NOISE!", "BIG DOWN! BIG DOWN!", "LOUDER! I CAN'T HEAR YOU!"],
    defense: ["DE-FENSE! DE-FENSE!", "HOLD THAT LINE!", "STOP 'EM COLD!"]
  };
  const PHRASE_N_V194B = Object.keys(PHRASES_V194B).reduce((a, k) => a + PHRASES_V194B[k].length, 0);
  V194.phrases = PHRASE_N_V194B; V194.buckets = Object.fromEntries(Object.keys(PHRASES_V194B).map((k) => [k, PHRASES_V194B[k].length]));
  const nickV194B = (name, dflt) => { const w = String(name || "").replace(/^.*'s /, "").trim().split(/\s+/).filter(Boolean); const n = w[w.length - 1] || ""; return (n && !/^(HOME|AWAY)$/i.test(n) ? n : dflt).toUpperCase(); };
  function phraseV194B(A, bucket) {
    const L = PHRASES_V194B[bucket] || PHRASES_V194B.good;
    let s = null;
    for (let i = 0; i < 6; i++) { s = pickV194B(A, L); if (A.recent.indexOf(s) < 0) break; }
    A.recent.push(s); if (A.recent.length > 10) A.recent.shift();
    return s.replace(/\{T\}/g, A.T).replace(/\{O\}/g, A.O);
  }

  /* ---- the acts: f(t, A) → the pose at t (ms into the act), its lift / turn (logical px, deg), its OUTWARD travel dx and
   * its along-the-sideline travel dy (logical px), and what it shows (tears, steam, a red face, a sign, a throw) ---- */
  const cyc = (t, ms, list) => list[Math.floor(t / ms) % list.length];
  const RUN_V194B = ["run0", "run1", "run2", "run3"];
  const ACTS_V194B = {
    cartwheel: { ms: 1500, f(t, A) { const u = t / 750, k = Math.floor(u), w = u - k; return { pose: w < 0.06 || w > 0.94 ? "armsUp" : "star", rot: (k % 2 ? -1 : 1) * 360 * w, lift: 9 * Math.sin(Math.PI * w) * A.big, dx: (k % 2 ? 1 - w : w) * 26 }; } },
    backflip: { ms: 1350, f(t, A) { const u = t / 1350; if (u < 0.16) return { pose: u < 0.08 ? "crouch" : "squat" }; if (u < 0.22) return { pose: "launch", lift: 6 }; if (u < 0.78) { const q = (u - 0.22) / 0.56; return { pose: "tuck", rot: -spinPhi(q), lift: 34 * A.big * 4 * q * (1 - q) + 4 }; } return { pose: u < 0.86 ? "landing" : "armsUp" }; } },
    jumps: { ms: 1500, f(t, A) { const k = Math.floor(t / 500), q = (t % 500) / 500; if (q < 0.2) return { pose: "crouch" }; const r = (q - 0.2) / 0.8; return { pose: k === 1 ? "star" : "jump", lift: 22 * A.big * 4 * r * (1 - r) }; } },
    starjump: { ms: 1600, f(t, A) { const q = (t % 400) / 400; return q < 0.25 ? { pose: "stand" } : { pose: "star", lift: 12 * A.big * Math.sin(Math.PI * (q - 0.25) / 0.75) }; } },
    airbump: { ms: 1300, f(t, A) { const k = Math.floor(t / 650), q = (t % 650) / 650; if (q < 0.25) return { pose: "run1", dx: 4 }; if (q < 0.8) { const r = (q - 0.25) / 0.55; return { pose: "bump", lift: 18 * A.big * 4 * r * (1 - r), rot: (k % 2 ? -14 : 14), dx: 4 }; } return { pose: "landing" }; } },
    steer: { ms: 2600, f(t) { return { pose: cyc(t, 230, ["steer1", "steer0", "steer2", "steer0"]), dx: 9 + 9 * Math.sin((2 * Math.PI * t) / 1300), dy: 10 * Math.sin((2 * Math.PI * t) / 2600), lift: 1.4 * Math.abs(Math.sin(t / 90)), rot: 6 * Math.sin((2 * Math.PI * t) / 650) }; } },
    merch: { ms: 2700, f(t) { const q = (t % 900) / 900; return { pose: q < 0.42 ? "throw0" : q < 0.75 ? "throw1" : "hips0", throwAt: Math.floor(t / 900), throwing: q >= 0.42 }; } },
    sign: { ms: 2800, f(t) { return { pose: cyc(t, 400, ["sign0", "sign1"]), lift: 1.2 * Math.abs(Math.sin(t / 130)), sign: true }; } },
    cry: { ms: 2800, f(t) { return { pose: cyc(t, 260, ["cry0", "cry1"]), sy: 1 + 0.05 * Math.sin(t / 50), tears: 1 }; } },
    headhands: { ms: 2200, f(t) { return { pose: "cry0", rot: 5 * Math.sin(t / 260), tears: 0.4 }; } },
    mad: { ms: 2400, f(t) { const k = Math.floor(t / 150) % 2; return { pose: k ? "mad1" : "mad0", dx: k ? 1.5 : -1.5, lift: k ? 0 : 2.5, steam: 1, red: 1 }; } },
    kick: { ms: 1500, f(t) { const q = (t % 500) / 500; return { pose: q < 0.45 ? "kick" : "stand", dirt: q < 0.1, red: 0.6 }; } },
    circles: { ms: 2600, f(t) { const a = (2 * Math.PI * t) / 1300; return { pose: cyc(t, 80, RUN_V194B), dx: 12 * (1 - Math.cos(a)), dy: 9 * Math.sin(a), face: Math.cos(a) >= 0 ? 1 : -1, sweat: 1 }; } },
    // the idles, by mood
    hips: { ms: 3000, f(t) { return { pose: cyc(t, 450, ["hips0", "hips1"]), dx: 2 * Math.sin(t / 290), lift: 0.8 * Math.abs(Math.sin(t / 143)) }; } },
    nails: { ms: 3000, f(t) { return { pose: cyc(t, 140, ["nails0", "nails1"]), sy: 1 + 0.02 * Math.sin(t / 40) }; } },
    slump: { ms: 3400, f(t) { return { pose: cyc(t, 900, ["slump0", "slump1"]), sy: 0.97 }; } },
    pace: { ms: 3600, f(t, A) { const a = (2 * Math.PI * t) / 3600; return { pose: cyc(t, A.mood === "furious" ? 90 : 140, RUN_V194B), dy: 16 * Math.sin(a), face: Math.cos(a) >= 0 ? 1 : -1 }; } },
    stomp: { ms: 2400, f(t) { const k = Math.floor(t / 260) % 2; return { pose: k ? "mad1" : "mad0", lift: k ? 0 : 1.5, steam: 0.5, red: 0.7 }; } },
    wave: { ms: 2000, f(t) { return { pose: cyc(t, 250, ["wave0", "wave1"]), lift: Math.abs(Math.sin(t / 160)) * 1.6 }; } },
    point: { ms: 1800, f(t) { return { pose: cyc(t, 450, ["point", "armsUp"]), lift: Math.abs(Math.sin(t / 150)) * 1.5 }; } }
  };
  const IDLE_V194B = { ecstatic: ["hips", "starjump", "sign", "steer", "point", "wave"], confident: ["hips", "sign", "wave", "point", "hips"], nervous: ["nails", "pace", "sign", "nails"], desperate: ["slump", "headhands", "sign", "slump"], furious: ["stomp", "pace", "sign", "kick"] };
  const SIGNS_V194B = { defense: ["DE-FENSE", "HOLD THAT LINE", "MAKE SOME NOISE"], offense: ["GO {T}!", "TOUCHDOWN {T}", "LOUDER!"], thirdDown: ["MAKE SOME NOISE", "3RD DOWN!", "LOUDER!"], flag: ["REF?!", "BOO!", "REALLY?!"],
    ecstatic: ["WE'RE #1", "GO {T}!", "SCOREBOARD!"], confident: ["GO {T}!", "#1 FANS", "LET'S GO!"], nervous: ["GO {T}!", "PLEASE?", "BELIEVE"], desperate: ["BELIEVE", "MIRACLE?", "PLEASE!"], furious: ["REF?!", "BOO!", "GRRR!"] };

  /* ---- what a whistle means for the HOME side ---- */
  function classifyV194B(pay, home) {
    if (!pay) return null;
    const d = String(pay.desc || "").toUpperCase(), yd = Number(pay.yards != null ? pay.yards : 0), ev = pay.event;
    const usBall = pay.offense !== "them", homeBall = home === "off" ? usBall : !usBall;
    const live = ev === "run" || ev === "pass" || ev === "scramble";
    const R = (kind, v) => ({ kind, v, homeBall, event: ev || null, yards: yd });
    if (ev === "xp" || ev === "twopt") return R(pay.scored === homeBall ? "goodLite" : "badLite", pay.scored === homeBall ? 0.2 : -0.2);
    if (pay.penalty) { const onOff = yd < 0, onHome = onOff ? homeBall : !homeBall; return onHome ? R("penalty", -0.55) : R("flagThem", 0.3); }
    const picked = d.includes("INTERCEPT"), fumbled = d.includes("FUMBLE") && /DEFENSE|TAKES OVER|TURNOVER|RECOVER|LOST/.test(d);
    if (pay.scored && ev !== "fg") { const defScored = picked || fumbled; return (homeBall !== defScored) ? R("td", 1) : R("oppTd", -1); }
    if (ev === "fg") { const good = !(d.includes("NO GOOD") || d.includes("MISS")); return good === homeBall ? R("fg", 0.55) : R(good ? "oppFg" : "badLite", good ? -0.55 : -0.4); }
    if (pay.safety || d.includes("SAFETY")) return homeBall ? R("giveaway", -0.85) : R("takeaway", 0.85);
    if (picked || fumbled) return homeBall ? R("giveaway", -0.9) : R("takeaway", 0.9);
    if (d.includes("ON DOWNS")) return homeBall ? R("giveaway", -0.6) : R("takeaway", 0.6);
    if (ev === "sack" || d.includes("SACK")) return homeBall ? R("sackTaken", -0.7) : R("sack", 0.8);
    if (ev === "punt" || ev === "kickoff") return R("neutral", 0);
    if ((live || ev === "incomplete") && yd >= TUv("mascotBigYdV194B", 15)) return homeBall ? R("big", 0.8) : R("oppBig", -0.75);
    if (ev === "incomplete" || (live && yd <= 0)) return homeBall ? R("stuffed", -0.35) : R("stop", 0.4);
    if (live && yd >= 4) return homeBall ? R("gain", 0.3) : R("oppGain", -0.3);
    return R("neutral", 0);
  }
  // the reaction to each kind: the bubble bucket, how good it is, and its acts (by mood for the bad ones)
  const BAD_V194B = { furious: ["mad", "kick", "circles"], desperate: ["cry", "headhands", "slump"], nervous: ["headhands", "circles", "cry"], confident: ["mad", "circles", "kick"], ecstatic: ["headhands", "kick", "mad"] };
  function planV194B(A, r) {
    const great = ["cartwheel", "backflip", "jumps", "airbump", "steer"], mood = A.mood, hype = mood === "ecstatic" ? 1 : 0;
    const g = (n, first) => { const out = first ? first.slice() : []; while (out.length < n) { const a = pickV194B(A, great); if (out.indexOf(a) < 0) out.push(a); } return out; };
    const b = (n, first) => { const pool = BAD_V194B[mood] || BAD_V194B.nervous, out = first ? first.slice() : []; for (let i = 0; out.length < n && i < 12; i++) { const a = pool[(i + Math.floor(A.rnd() * 3)) % pool.length]; if (out.indexOf(a) < 0) out.push(a); } return out; };
    switch (r.kind) {
      case "td": return { bucket: "td", acts: g(3 + hype, [pickV194B(A, ["cartwheel", "backflip"]), "merch"]) };
      case "takeaway": return { bucket: "takeaway", acts: g(2 + hype, ["merch"]) };
      case "sack": return { bucket: "sack", acts: g(2 + hype) };
      case "big": return { bucket: "big", acts: g(2 + hype, [pickV194B(A, ["steer", "cartwheel", "airbump"])]) };
      case "fg": return { bucket: "good", acts: g(1 + hype, ["jumps"]) };
      case "stop": case "gain": case "goodLite": return { bucket: A.rnd() < 0.4 ? "good" : null, acts: [pickV194B(A, ["starjump", "point", "hips", "jumps"])] };
      case "flagThem": return { bucket: "flagThem", acts: ["point"] };
      case "oppTd": return { bucket: "oppTd", acts: b(3, [mood === "furious" || mood === "confident" ? "mad" : "cry", "circles"]) };
      case "giveaway": return { bucket: "giveaway", acts: b(2 + (mood === "furious" ? 1 : 0)) };
      case "sackTaken": return { bucket: "sackTaken", acts: b(2) };
      case "oppBig": case "oppFg": return { bucket: "bad", acts: b(2) };
      case "penalty": return { bucket: "penalty", acts: ["sign", "mad"], sign: pickV194B(A, SIGNS_V194B.flag) };
      case "stuffed": case "oppGain": case "badLite": return { bucket: A.rnd() < 0.3 ? "bad" : null, acts: [pickV194B(A, mood === "furious" ? ["kick", "stomp"] : ["headhands", "nails", "kick"])] };
      default: return { bucket: null, acts: [] };
    }
  }
  function moodV194B(A) {
    const q = A.quarter >= 4 ? TUv("moodLateKV194B", 1.3) : 1;
    const marg = Math.max(-1.5, Math.min(1.5, A.margin / Math.max(1, TUv("moodMarginV194B", 14)))) * q;
    const s = marg * 0.55 + A.momentum * TUv("moodMomentumKV194B", 0.45) + A.record * 0.15;
    A.moodScore = +s.toFixed(3);
    const mood = A.momentum <= TUv("moodFuriousV194B", -0.55) && s < 0.4 ? "furious" : s >= 0.6 ? "ecstatic" : s >= 0.15 ? "confident" : s >= -0.3 ? "nervous" : "desperate";
    if (mood !== A.mood) { A.mood = mood; A.moodAt = performance.now(); }
    A.big = { ecstatic: 1.35, confident: 1.1, nervous: 1, desperate: 0.9, furious: 1.15 }[mood] || 1;
    return mood;
  }
  function scoreV194B(A, pay) {
    let us = null, them = null;
    if (pay && pay.usScore != null && pay.themScore != null) { us = Number(pay.usScore); them = Number(pay.themScore); }
    else { try { us = Number(document.getElementById("usScore").textContent) || 0; them = Number(document.getElementById("themScore").textContent) || 0; } catch (e) { us = them = 0; } }
    A.margin = A.home === "off" ? us - them : them - us;
    if (pay && pay.quarter != null) A.quarter = Number(pay.quarter) || A.quarter;
  }
  function recordV194B(home) {
    if (home !== "off") return 0;
    try { const st = window.__getGridironState && window.__getGridironState(), wr = (st && st.player && st.player.weekResults) || [], pl = wr.filter((w) => w.played); if (!pl.length) return 0; const w = pl.filter((x) => x.won).length; return (2 * w - pl.length) / Math.max(3, pl.length); } catch (e) { return 0; }
  }

  /* ---- the mascot's own state ---- */
  function initV194B(m) {
    const A = (m.v194 = { home: m.team, rnd: rngV194B(0x194b0 + (m.S.id.logo | 0) * 7919), recent: [], T: nickV194B(m.name, "TEAM"), O: nickV194B(m.other, "THEM"),
      mood: null, moodScore: 0, margin: 0, momentum: 0, record: recordV194B(m.team), quarter: 1, big: 1, act: null, queue: [], idleAt: 0, lastPlay: null, judgedPlay: null, sayAt: -1e9, bubble: null,
      pos: null, tgt: null, path: [], tgtAt: -1e9, fx: [], merch: [], signTxt: null, nextIdleBubble: 0, kcss: 1, kcssAt: -1e9 });
    scoreV194B(A, null); moodV194B(A);
    V194.home = A.home; V194.team = A.T; V194.opp = A.O;
    return A;
  }
  function dropV194B(m) {
    const A = m.v194; if (!A) return;
    const kill = (o) => { try { o && o.destroy(); } catch (e) {} };
    A.fx.forEach((p) => kill(p.o)); A.fx = [];
    A.merch.forEach((p) => kill(p.o)); A.merch = [];
    kill(A.bubbleBox); A.bubbleBox = null; kill(A.signBox); A.signBox = null;
    V194.bubble = null;
  }
  function say(A, scene, bucket, force) {
    if (!bucket || !TUv("mascotBubblesV194B", 1)) return null;
    const now = performance.now();
    if (!force && now - A.sayAt < TUv("mascotBubbleGapMsV194B", 3800)) return null;
    if (A.bubble && now < A.bubble.until && !force) return null;   // never two at once
    const text = phraseV194B(A, bucket);
    A.sayAt = now; A.bubble = { text, bucket, at: now, until: now + TUv("mascotBubbleMsV194B", 2000), drawn: null };
    V194.bubbles++; V194.said.push({ bucket, text }); if (V194.said.length > 40) V194.said.shift();
    return text;
  }
  function startActs(A, list, sign) {
    A.queue = list.slice(); A.act = null; A.signTxt = sign || null; nextAct(A, performance.now());
  }
  function nextAct(A, now) {
    const n = A.queue.shift();
    if (!n || !ACTS_V194B[n]) { A.act = null; return null; }
    const len = ACTS_V194B[n].ms * (n === "merch" ? 1 : Math.max(0.85, Math.min(1.3, A.big)));
    A.act = { name: n, t0: now, ms: len, react: true, thrown: -1 };
    if (n === "sign" && !A.signTxt) A.signTxt = signTextV194B(A, null);
    return A.act;
  }
  function signTextV194B(A, ctx) {
    const pool = SIGNS_V194B[ctx || (A.oppBall ? "defense" : A.mood)] || SIGNS_V194B.confident;
    return pickV194B(A, pool).replace(/\{T\}/g, A.T);
  }
  // a whistle: judge the play, move the mood, start the reaction and say something
  function judgeV194B(scene, m, pay) {
    const A = m.v194; const r = classifyV194B(pay, A.home); if (!r) return null;
    V194.judged++;
    scoreV194B(A, pay);
    const k = TUv("moodMomentumEmaV194B", 0.45);
    A.momentum = +(A.momentum * (1 - k) + r.v * k).toFixed(3);
    moodV194B(A);
    const plan = planV194B(A, r);
    if (plan.acts.length) startActs(A, plan.acts, plan.sign);
    let text = null;
    const blow = Math.abs(A.margin) >= TUv("mascotBlowoutV194B", 21);
    if (plan.bucket) text = say(A, scene, plan.bucket, /^(td|oppTd|takeaway|giveaway)$/.test(r.kind));
    else if (blow && A.rnd() < 0.35) text = say(A, scene, A.margin > 0 ? "blowoutWin" : "blowoutLoss");
    const rec = { kind: r.kind, v: r.v, homeBall: r.homeBall, acts: plan.acts.slice(), mood: A.mood, moodScore: A.moodScore, momentum: A.momentum, margin: A.margin, said: text, at: Math.round(performance.now()) };
    V194.reactions.push(rec); if (V194.reactions.length > 30) V194.reactions.shift();
    return rec;
  }
  // a snap: the down, the field, who has it
  function presnapV194B(scene, m, pay) {
    const A = m.v194; if (!pay) return;
    const usBall = pay.offense !== "them", homeBall = A.home === "off" ? usBall : !usBall;
    A.oppBall = !homeBall;
    if (pay.quarter != null) A.quarter = Number(pay.quarter) || A.quarter;
    const live = /^(run|pass|incomplete|sack|scramble)$/.test(pay.event || "");
    if (!live) return;
    const down = Number(pay.preDown != null ? pay.preDown : pay.down || 0), ytg = 100 - Number(pay.startBall != null ? pay.startBall : 50);
    if (A.act && A.act.react) return;   // still celebrating / sulking the last one
    if (homeBall && ytg <= 20 && A.rnd() < 0.6) { say(A, scene, "redZone"); return; }
    if (down === 3 && A.rnd() < 0.7) { A.signTxt = signTextV194B(A, homeBall ? "offense" : "thirdDown"); A.queue = []; A.act = { name: "sign", t0: performance.now(), ms: 2600, react: false }; say(A, scene, "thirdDown"); return; }
    if (!homeBall && A.rnd() < 0.45) { A.signTxt = signTextV194B(A, "defense"); A.queue = []; A.act = { name: "sign", t0: performance.now(), ms: 2600, react: false }; if (A.rnd() < 0.4) say(A, scene, "defense"); }
  }
  function idleV194B(A, scene, now) {
    const pool = IDLE_V194B[A.mood] || IDLE_V194B.confident, n = pickV194B(A, pool);
    A.signTxt = n === "sign" ? signTextV194B(A, null) : null;
    A.act = { name: n, t0: now, ms: ACTS_V194B[n].ms, react: false };
    if (now > A.nextIdleBubble) {
      A.nextIdleBubble = now + TUv("mascotIdleBubbleMsV194B", 9000) * (0.7 + A.rnd() * 0.8);
      const blow = Math.abs(A.margin) >= TUv("mascotBlowoutV194B", 21);
      const b = blow ? (A.margin > 0 ? "blowoutWin" : "blowoutLoss") : { ecstatic: "idleEcstatic", confident: "idleConfident", nervous: "idleNervous", desperate: "idleDesperate", furious: "idleFurious" }[A.mood];
      say(A, scene, b);
    }
  }

  /* ---- the merch: three items in his colours, drawn once a team ---- */
  function merchSheetV194B(scene, cols) {
    const key = "m194b_merch_" + cols.p1.slice(1) + cols.p2.slice(1), tm = scene.textures;
    if (tm.exists(key)) return key;
    const L = 14, cv = document.createElement("canvas"); cv.width = L * 3; cv.height = L;
    const D = painter(cv.getContext("2d"));
    // a t-shirt, a foam finger, a cap
    D.poly([3, 3, 5.5, 2, 8.5, 2, 11, 3, 13, 6, 11, 7, 10.5, 6, 10.5, 12.5, 3.5, 12.5, 3.5, 6, 3, 7, 1, 6], cols.p1); D.rect(3.5, 6.2, 7, 1.2, cols.p2); D.ell(7, 2.6, 1.6, 0.8, cols.p2);
    D.at(L, 0); D.poly([4, 13, 4, 7, 6, 6, 6, 1.5, 8, 1.5, 8, 6, 10, 6.5, 10, 13], cols.p2); D.rect(4.6, 9, 4.8, 1.6, cols.p1); D.restore();
    D.at(L * 2, 0); D.ell(7, 8, 5, 4.2, cols.p1); D.rect(1.5, 8, 11, 2.2, cols.p1); D.ell(11.5, 10, 2.6, 1, cols.p2); D.circ(7, 4.2, 0.9, cols.p2); D.restore();
    pixelate(cv);
    const up = document.createElement("canvas"); up.width = cv.width * 2; up.height = cv.height * 2;
    const ux = up.getContext("2d"); ux.imageSmoothingEnabled = false; ux.drawImage(cv, 0, 0, up.width, up.height);
    try { const tx = tm.addCanvas(key, up); for (let i = 0; i < 3; i++) tx.add(i, 0, i * L * 2, 0, L * 2, L * 2); } catch (e) { err(e); return null; }
    return key;
  }
  function throwMerchV194B(scene, m, A, from, now) {
    const C = scene.crowd; if (!C || !C.secs || !C.built) return null;
    const key = merchSheetV194B(scene, m.cols); if (!key) return null;
    const cam = scene.cameras && scene.cameras.main, wv = cam && cam.worldView;
    const all = C.secs.slice(0, C.built).filter((s) => s && s.mx != null);
    if (!all.length) return null;
    let on = wv ? all.filter((s) => s.mx > wv.x + 10 && s.mx < wv.x + wv.width - 10 && s.my > wv.y + 10 && s.my < wv.y + wv.height - 10) : all;
    if (!on.length) on = all;
    const near = on.map((s) => ({ s, d: Math.hypot(s.mx - from.x, s.my - from.y) })).sort((a, b) => a.d - b.d).slice(0, 3);
    const sec = near[Math.floor(A.rnd() * near.length) % near.length].s;
    const to = { x: sec.mx + (A.rnd() - 0.5) * Math.min(sec.bw * 0.5, 40), y: sec.my + (A.rnd() - 0.4) * Math.min(sec.hh || 10, 18) * 0.4 };
    const o = scene.add.image(from.x, from.y, key, Math.floor(A.rnd() * 3) % 3);
    const sz = Math.max(0.35, m.k * 0.55);
    o.setScale(sz).setDepth((m.img.depth || 3.5) + 0.004);
    const d = Math.hypot(to.x - from.x, to.y - from.y);
    A.merch.push({ o, t0: now, ms: TUv("mascotMerchMsV194B", 820) + d * 1.2, from: { x: from.x, y: from.y }, to, h: 40 + d * 0.35, spin: (A.rnd() < 0.5 ? -1 : 1) * (540 + A.rnd() * 360), sz, sec, landed: false });
    V194.merch.spawned++; V194.merch.flying = A.merch.length;
    return true;
  }
  function stepMerchV194B(scene, A, now) {
    for (let i = A.merch.length - 1; i >= 0; i--) {
      const p = A.merch[i], u = (now - p.t0) / p.ms;
      if (!p.o || !p.o.scene) { A.merch.splice(i, 1); continue; }
      if (u < 1) {
        p.o.setPosition(p.from.x + (p.to.x - p.from.x) * u, p.from.y + (p.to.y - p.from.y) * u - p.h * 4 * u * (1 - u));
        p.o.setRotation((p.spin * u * Math.PI) / 180).setScale(p.sz * (1 + 0.35 * Math.sin(Math.PI * u)));
        continue;
      }
      if (!p.landed) {
        p.landed = true; p.o.setPosition(p.to.x, p.to.y).setDepth(TUv("crowdDepth", 3.45) + 0.031);
        const s = p.sec, inBox = !!(s && p.to.x >= s.bx - 2 && p.to.x <= s.bx + s.bw + 2 && p.to.y >= s.by - 2 && p.to.y <= s.by + s.bh + 2);
        V194.merch.landed++; if (inBox) V194.merch.inStands++;
        V194.merch.last = { x: Math.round(p.to.x), y: Math.round(p.to.y), inStands: inBox, sec: s ? { bx: Math.round(s.bx), by: Math.round(s.by), bw: Math.round(s.bw), bh: Math.round(s.bh) } : null };
      }
      const f = (now - p.t0 - p.ms) / 520;   // a fan catches it: it bobs and goes
      if (f >= 1) { try { p.o.destroy(); } catch (e) {} A.merch.splice(i, 1); continue; }
      p.o.setPosition(p.to.x, p.to.y - Math.abs(Math.sin(f * Math.PI * 2)) * 4 * p.sz).setAlpha(1 - f * f);
    }
    V194.merch.flying = A.merch.length;
  }

  /* ---- the little things: tears, steam, sweat, dirt ---- */
  function puffV194B(scene, A, kind, x, y, k, depth) {
    if (A.fx.length > TUv("mascotFxMaxV194B", 40)) return;
    const r = A.rnd, s = Math.max(0.35, k);
    let o, p;
    // sizes and speeds in his own logical px (×k): exaggerated — fountain tears, a kettle's steam
    if (kind === "tear") { o = scene.add.ellipse(x, y, 3.6 * s, 4.6 * s, 0x6fcfff, 1).setStrokeStyle(Math.max(1, 0.8 * s), 0x1d5f9a, 1); p = { vx: (x < A.hx ? -1 : 1) * (30 + r() * 34) * s, vy: (-46 - r() * 30) * s, g: 300 * s, life: 640 }; }
    else if (kind === "steam") { o = scene.add.ellipse(x, y, 6 * s, 6 * s, 0xf4f4f4, 0.9); p = { vx: (x < A.hx ? -1 : 1) * (10 + r() * 14) * s, vy: (-50 - r() * 24) * s, g: 0, grow: 2.6, life: 720 }; }
    else if (kind === "sweat") { o = scene.add.ellipse(x, y, 2.6 * s, 3.4 * s, 0xbfe9ff, 1); p = { vx: (r() - 0.5) * 60 * s, vy: (-34 - r() * 20) * s, g: 220 * s, life: 460 }; }
    else { o = scene.add.ellipse(x, y, 5 * s, 3.6 * s, 0x6a4a2a, 0.95); p = { vx: (r() - 0.5) * 80 * s, vy: (-30 - r() * 24) * s, g: 180 * s, life: 540 }; }
    o.setDepth(depth);
    A.fx.push(Object.assign(p, { o, t: 0, x, y }));
  }
  function stepFxV194B(A, dt) {
    for (let i = A.fx.length - 1; i >= 0; i--) {
      const p = A.fx[i]; p.t += dt;
      if (p.t >= p.life || !p.o.scene) { try { p.o.destroy(); } catch (e) {} A.fx.splice(i, 1); continue; }
      const s = dt / 1000; p.vy += p.g * s; p.x += p.vx * s; p.y += p.vy * s;
      const f = p.t / p.life;
      p.o.setPosition(p.x, p.y).setAlpha(Math.min(1, (1 - f) * 1.6));
      if (p.grow) p.o.setScale(1 + f * p.grow);
    }
  }

  /* ---- the bubble and the sign (drawn in "text units", scaled to the screen / to him) ---- */
  const FONT_V194B = 'Oswald, "Arial Narrow", system-ui, sans-serif';
  function boxV194B(scene, text, o) {
    const tx = scene.add.text(0, 0, text, { fontFamily: FONT_V194B, fontSize: (o.fs || 20) + "px", fontStyle: "700", color: o.color || "#1a1420", align: "center", wordWrap: { width: o.wrap || 220 } }).setOrigin(0.5, 0.5);
    const w = Math.ceil(tx.width) + (o.padX || 16), h = Math.ceil(tx.height) + (o.padY || 8), g = scene.add.graphics(), B = 3, ink = 0x17131c;
    // a pixel box: the ink border with its corners notched, the fill, then (bubble) a stepped tail
    g.fillStyle(ink, 1); g.fillRect(-w / 2 + B, -h / 2, w - 2 * B, h); g.fillRect(-w / 2, -h / 2 + B, w, h - 2 * B);
    g.fillStyle(o.fill, 1); g.fillRect(-w / 2 + B, -h / 2 + B, w - 2 * B, h - 2 * B);
    if (o.trim != null) { g.fillStyle(o.trim, 1); g.fillRect(-w / 2 + B, h / 2 - B - 4, w - 2 * B, 4); }
    if (o.tail) {   // the stepped tail is its own piece, so it can point at him when the box is held inside the shot
      const t = scene.add.graphics();
      t.fillStyle(ink, 1); t.fillRect(-9, -B, 14, 6); t.fillRect(-6, 3, 9, 5); t.fillRect(-3, 8, 5, 4); t.fillStyle(o.fill, 1); t.fillRect(-6, -B - 1, 8, 6); t.fillRect(-3, 2, 3, 5);
      o.tailOut = t;
    }
    if (o.stick) { g.fillStyle(0x8a5a2c, 1); g.fillRect(-3, h / 2, 6, o.stick); g.fillStyle(ink, 1); g.fillRect(-4, h / 2, 1, o.stick); g.fillRect(3, h / 2, 1, o.stick); }
    const box = scene.add.container(0, 0, [g, tx]); box.__h = h; box.__w = w; box.__tail = o.tailOut || null;
    if (box.__tail) { const t = box.__tail; box.once("destroy", () => { try { t.destroy(); } catch (e) {} }); }
    return box;
  }
  const hexInt = (h) => parseInt(String(h).slice(1), 16) || 0;
  function kcssV194B(scene, A, now) {
    if (now - A.kcssAt > 1000) { A.kcssAt = now; try { const r = scene.game.canvas.getBoundingClientRect(); A.kcss = r.width > 0 ? r.width / (scene.scale.width || r.width) : 1; } catch (e) { A.kcss = 1; } }
    return A.kcss;
  }

  /* ---- where he stands ---- */
  const scaleV194B = () => TUv("mascotScaleV194B", 1.8);   // bigger than v193 AI's 1.45: he is the show now
  function laneW(scene, G, m, u, bank) {
    const paint = (scene.side && scene.side.paint) || 206;
    const p0 = scene.crowdProject(u, G.MIDY), p1 = scene.crowdProject(u, G.MIDY + 10);
    const pxPer = Math.max(0.01, Math.abs(p1.x - p0.x) / 10), sc0 = (p0.s * m.ageK * scaleV194B()) / SCALE;
    return bank * (paint + TUv("mascotLaneV193AI", 8) + (15 * SCALE * sc0) / pxPer);
  }
  function projV194B(scene, G, m, u, w) {
    const q = scene.crowdProject(u, G.MIDY + w);
    q.sc = (q.s * m.ageK * scaleV194B()) / SCALE;
    return q;
  }
  function inViewV194B(q, wv, head) {
    if (!wv || !(wv.width > 0)) return true;
    const half = 16 * q.sc * SCALE, tall = 62 * q.sc * SCALE * (head || 1);
    return q.x - half > wv.x + 4 && q.x + half < wv.x + wv.width - 4 && q.y - tall > wv.y && q.y < wv.y + wv.height - 4;
  }
  function spotV194B(scene, st, m, G, now, cam, losU) {
    const A = m.v194, YD = G.PLAY_W / 100, wv = cam && cam.worldView;
    const liveSnap = !!(scene.play && !scene.play.done);
    const cands = [];
    const EZ = G.PLAY_L;
    [EZ * 0.5, EZ * 0.85, G.FW - EZ * 0.5, G.FW - EZ * 0.85].forEach((u) => [-1, 1].forEach((bank) => cands.push({ u, bank, ez: true })));
    [-10, -5, 0, 5, 10, 15, -15].forEach((off) => [-1, 1].forEach((bank) => cands.push({ u: Math.max(G.PLAY_L + 2 * YD, Math.min(G.PLAY_L + G.PLAY_W - 2 * YD, losU + off * YD)), bank, ez: false })));
    const marks = (scene.markers || []).filter((mk) => mk && mk.root && mk.root.visible !== false).map((mk) => mk.root);
    let best = null, bestS = -1e9;
    const cur = A.tgt, zc = (cam ? cam.zoom || 1 : 1) * (A.kcss || 1), bubW = 44 / zc;   // the bubble's height in world px (constant on screen)
    const seen = [];
    cands.forEach((c) => {
      const w = laneW(scene, G, m, c.u, c.bank), q = projV194B(scene, G, m, c.u, w);
      if (!inViewV194B(q, wv, 1.15)) return;
      if (wv && wv.width > 0 && q.y - 62 * q.sc * SCALE - bubW < wv.y) return;   // no room for what he says
      seen.push({ c, w, q });
    });
    const maxK = seen.reduce((a, e) => Math.max(a, e.q.k), 0.01);
    seen.forEach(({ c, w, q }) => {
      const tall = 62 * q.sc * SCALE;
      // the size on screen first (a far end zone is a speck), then the end zone's pull: "near the endzone most times"
      let s = (q.k / maxK) * TUv("mascotSizeWV194B", 3) + (c.ez ? TUv("mascotEzBiasV194B", 2.4) : 0);
      if (A.pos) { s -= Math.abs(c.u - A.pos.u) / (YD * 40); if (Math.sign(w) !== Math.sign(A.pos.w)) s -= liveSnap ? 6 : 2; }
      if (cur && Math.abs(cur.u - c.u) < 3 * YD && Math.sign(cur.w) === Math.sign(w)) s += TUv("mascotStayBonusV194B", 1);
      if (marks.some((r) => Math.abs(r.x - q.x) < tall * 0.6 && Math.abs(r.y - q.y) < tall * 0.5)) s -= 3;   // a player is standing there
      if (s > bestS) { bestS = s; best = { u: c.u, w, ez: c.ez, bank: c.bank }; }
    });
    return best;
  }
  function pathTo(A, G, tgt) {
    // along his own sideline; a bank switch goes round behind the nearer end line (never across the field)
    if (!A.pos || Math.sign(A.pos.w) === Math.sign(tgt.w)) return [tgt];
    const back = A.pos.u + tgt.u < G.FW ? -TUv("mascotBackUV194B", 5) : G.FW + TUv("mascotBackUV194B", 5);
    return [{ u: back, w: A.pos.w }, { u: back, w: tgt.w }, tgt];
  }

  /* ---- one frame of the home mascot ---- */
  function placeV194B(scene, st, m, G, now, cam) {
    const img = m.img, A = m.v194 || initV194B(m), YD = G.PLAY_W / 100;
    const dt = Math.max(0, Math.min(100, now - (m.lastT || now))); m.lastT = now;
    if (m.ageK == null || now - (m.ageAt || 0) > 2000) { m.ageAt = now; m.ageK = Math.max(TUv("mascotAgeMinV193AI", 0.7), (() => { try { return window.__V144 && window.__V144.ageK ? window.__V144.ageK() : 1; } catch (e) { return 1; } })()); }
    // 1. the game: a new snap, a whistle, the score
    const P = scene.play;
    if (P && P !== A.lastPlay) { A.lastPlay = P; try { presnapV194B(scene, m, P.payload); } catch (e) { err(e); } }
    if (P && P.done && A.judgedPlay !== P) { A.judgedPlay = P; try { judgeV194B(scene, m, P.payload); } catch (e) { err(e); } }
    if (now - (A.scoreAt || 0) > 1000) { A.scoreAt = now; scoreV194B(A, null); moodV194B(A); }
    // 2. where: re-chosen every so often, or when his spot leaves the shot
    const lf = scene._lastField, adj = (x) => (G.VDIR > 0 ? x : G.FW - x);
    const losU = lf ? adj(G.PLAY_L + (Math.max(0, Math.min(100, lf[0])) / 100) * G.PLAY_W) : G.FW / 2;
    const wv = cam && cam.worldView;
    if (!A.pos) { const w0 = laneW(scene, G, m, G.PLAY_L * 0.5, 1); A.pos = { u: losU < G.FW / 2 ? G.PLAY_L * 0.5 : G.FW - G.PLAY_L * 0.5, w: w0 }; }
    const tgtGone = A.tgt && !inViewV194B(projV194B(scene, G, m, A.tgt.u, A.tgt.w), wv, 1);
    if (!A.tgt || tgtGone || now - A.tgtAt > TUv("mascotSpotMsV194B", 1400)) {
      A.tgtAt = now;
      const best = spotV194B(scene, st, m, G, now, cam, losU);
      if (best && (!A.tgt || Math.abs(best.u - A.tgt.u) > 0.5 * YD || Math.sign(best.w) !== Math.sign(A.tgt.w))) {
        A.tgt = best; A.path = pathTo(A, G, best); V194.moves++;
        const qNow = projV194B(scene, G, m, A.pos.u, A.pos.w);
        if (!m.vis || !inViewV194B(qNow, wv, 0.6)) { A.pos = { u: best.u, w: best.w }; A.path = []; V194.teleports++; }   // only where nobody sees it
      }
    }
    // 3. run along the path
    let moving = false, vx = 0;
    if (A.path.length && !(A.act && A.act.react && m.vis)) {   // a reaction is played where he stands
      const spd = TUv("mascotRunYdV194B", 10) * YD * (A.mood === "furious" ? 1.25 : 1) * (dt / 1000);
      let left = spd;
      while (left > 0 && A.path.length) {
        const wp = A.path[0], du = wp.u - A.pos.u, dw = wp.w - A.pos.w, d = Math.hypot(du, dw);
        if (d <= left) { A.pos = { u: wp.u, w: wp.w }; A.path.shift(); left -= d; }
        else { A.pos = { u: A.pos.u + (du / d) * left, w: A.pos.w + (dw / d) * left }; vx = dw; left = 0; }
      }
      moving = A.path.length > 0;
    }
    const p = projV194B(scene, G, m, A.pos.u, A.pos.w), sc = p.sc, k = sc * SCALE;
    const outS = A.pos.w >= 0 ? 1 : -1;   // + screen x is away from the field on the right bank
    // 4. what he is doing
    let o = null, celO = null;
    if (m.cel && m.cel.alive) {
      const t = m.cel.run && m.cel.run.hold != null ? m.cel.run.hold : now - m.cel.t0;
      if (t >= m.cel.ms) m.cel.alive = false; else celO = celPose(m.cel, t);
    }
    if (A.act && now - A.act.t0 >= A.act.ms) { if (A.act.react && A.queue.length) nextAct(A, now); else { A.act = null; A.idleAt = now + TUv("mascotIdleGapMsV194B", 500); } }
    if (moving && !(A.act && A.act.react)) {
      o = { pose: cyc(now, 85, RUN_V194B), lift: Math.abs(Math.sin(now / 85)) * 1.5, face: Math.abs(vx) > 1e-3 ? Math.sign(vx) : outS };
    } else if (celO && (!A.act || !A.act.react || (m.cel && m.cel.kind !== "cycle"))) o = celO;   // HIS mirrored body (v161 A / v177 I) or a scorer's cheer
    else {
      if (!A.act && now >= A.idleAt) idleV194B(A, scene, now);
      if (A.act) {
        const def = ACTS_V194B[A.act.name], t = now - A.act.t0;
        o = def.f(t, A);
        if (A.act.name === "sign") o.sign = true;
      }
    }
    if (!o) o = idlePose(now, 0, m.ph);
    if (REDUCED) { o.rot = 0; o.lift = Math.min(o.lift || 0, 2); }
    V194.act = A.act ? A.act.name : moving ? "run" : null; V194.mood = A.mood; V194.moodScore = A.moodScore; V194.margin = A.margin; V194.momentum = A.momentum; V194.record = +A.record.toFixed(3);
    // 5. draw him
    const fi = POSE_IX[o.pose] != null ? POSE_IX[o.pose] : 0, f = m.S.frames[fi];
    if (fi !== m.lastPose) { img.setFrame(fi); m.lastPose = fi; }
    m.pose = o.pose;
    const flip = o.face ? (o.face > 0 ? 1 : -1) : -outS;   // standing, he faces the field
    const ox = (o.dx || 0) * outS * k, oy = (o.dy || 0) * k * 0.6;
    img.setOrigin(0.5, f.hipY / LH);
    img.setScale(flip * sc * (o.sx || 1), sc * (o.sy || 1));
    img.setRotation(flip * (o.rot || 0) * DEG);
    const hx = p.x + ox, hy = p.y - (GY - f.hipY) * k - (o.lift || 0) * k + oy;
    img.setPosition(hx, hy);
    let depth = 3.5; try { depth = scene.sideDepth(p.y + oy) + 0.0016; } catch (e) {}
    img.setDepth(depth);
    m.sh.setPosition(p.x + ox, p.y + oy - 0.4 * k).setSize(11 * k * (1 - Math.min(0.5, (o.lift || 0) / 30)), 3 * k).setDepth(depth - 0.0006);
    // the light (the bench's shade, re-read now and then), and the temper's red face
    if (now - (m.lightAt || 0) > 600) { m.lightAt = now; try { const f0 = scene.sideShadeBase(A.pos.u, p.k, outS); m.lv = Math.max(0, Math.min(255, Math.round((f0 * 255) / 8) * 8)); } catch (e) { m.lv = 230; } }
    const lv = m.lv == null ? 230 : m.lv, red = o.red ? Math.min(1, o.red) * (0.75 + 0.25 * Math.sin(now / 70)) : 0;
    const tint = ((Math.round(lv * 0.98) << 16) | (Math.round(lv * (0.99 - 0.55 * red)) << 8) | Math.round(Math.min(255, lv * 1.02) * (1 - 0.6 * red))) >>> 0;
    if (tint !== m.tintNow) { m.tintNow = tint; img.setTint(tint); }
    // the cull
    let vis = true;
    if (cam) {
      const hPx = img.displayHeight * (cam.zoom || 1);
      if (hPx < TUv("mascotMinPxV193AI", 14)) vis = false;
      else if (wv && wv.width > 0 && (img.x + 40 * k < wv.x || img.x - 40 * k > wv.x + wv.width || img.y + 40 * k < wv.y || img.y - 60 * k > wv.y + wv.height)) vis = false;
    }
    if (vis !== m.vis) { m.vis = vis; img.setVisible(vis); m.sh.setVisible(vis); }
    vis ? V.shown++ : V.culled++;
    if (vis) { if (A.tgt && A.tgt.ez) V194.ez++; else V194.side++; }
    // never on the field of play: his feet are outside the painted line (or past the end line)
    if (Math.abs(A.pos.w) < ((scene.side && scene.side.paint) || 206) && A.pos.u > 0 && A.pos.u < G.FW) V194.onField++;
    V194.spot = { u: Math.round(A.pos.u), w: Math.round(A.pos.w), ez: !!(A.tgt && A.tgt.ez), moving, visible: vis, x: Math.round(img.x), y: Math.round(img.y) };
    m.sx = p.x; m.sy = p.y; m.k = k;
    // 6. the extras: world points of his eyes and fists
    const at = (lx, ly) => ({ x: hx + (lx - LW / 2) * k * flip, y: hy + (ly - f.hipY) * k });
    const fxD = depth + 0.002;
    A.fxClock = (A.fxClock || 0) + dt;
    if (vis && A.fxClock > 70) {
      A.fxClock = 0;
      const hd = at(f.head.x, f.head.y); A.hx = hd.x;
      if (o.tears && A.rnd() < o.tears) { puffV194B(scene, A, "tear", hd.x - 3.5 * k, hd.y - 1 * k, k, fxD); puffV194B(scene, A, "tear", hd.x + 3.5 * k, hd.y - 1 * k, k, fxD); }
      if (o.steam && A.rnd() < o.steam) { puffV194B(scene, A, "steam", hd.x - 7 * k, hd.y - 7 * k, k, fxD); puffV194B(scene, A, "steam", hd.x + 7 * k, hd.y - 7 * k, k, fxD); }
      if (o.sweat && A.rnd() < 0.5) puffV194B(scene, A, "sweat", hd.x + (A.rnd() - 0.5) * 10 * k, hd.y - 8 * k, k, fxD);
      if (o.dirt) for (let i = 0; i < 3; i++) puffV194B(scene, A, "dirt", p.x + ox + (A.rnd() - 0.5) * 8 * k, p.y + oy, k, fxD);
    }
    stepFxV194B(A, dt);
    if (o.throwing && A.act && A.act.name === "merch" && o.throwAt !== A.act.thrown) {
      A.act.thrown = o.throwAt;
      const hand = at(f.hands[1].x, f.hands[1].y);
      try { if (vis) throwMerchV194B(scene, m, A, hand, now); } catch (e) { err(e); }
    }
    stepMerchV194B(scene, A, now);
    // the sign over his head
    const wantSign = !!(o.sign && A.signTxt && vis);
    if (wantSign) {
      if (!A.signBox || A.signBox.__txt !== A.signTxt) {
        try { A.signBox && A.signBox.destroy(); } catch (e) {}
        A.signBox = boxV194B(scene, A.signTxt, { fs: 22, fill: 0xfbf7ea, color: m.cols.p1 && lum(m.cols.p1) < 0.75 ? m.cols.p1 : "#1a1420", trim: hexInt(m.cols.p2), padX: 14, padY: 10, wrap: 170 }); A.signBox.__txt = A.signTxt;
      }
      const hands = [at(f.hands[0].x, f.hands[0].y), at(f.hands[1].x, f.hands[1].y)], top = Math.min(hands[0].y, hands[1].y);
      const sk = Math.max((26 * k) / A.signBox.__h, 9 / (22 * (cam ? cam.zoom || 1 : 1) * kcssV194B(scene, A, now)));
      A.signBox.setScale(sk).setPosition((hands[0].x + hands[1].x) / 2, top - (A.signBox.__h / 2) * sk + 3 * k).setDepth(depth + 0.001).setVisible(true).setRotation(Math.sin(now / 200) * 0.05);
      V194.sign = A.signTxt;
    } else if (A.signBox) { A.signBox.setVisible(false); V194.sign = null; }
    // the bubble over his head: a constant size on screen, one at a time
    const B = A.bubble;
    if (B && now < B.until && vis) {
      if (B.drawn !== B.text || !A.bubbleBox) {
        try { A.bubbleBox && A.bubbleBox.destroy(); } catch (e) {}
        A.bubbleBox = boxV194B(scene, B.text, { fs: 20, fill: 0xffffff, tail: true, padX: 16, padY: 8, wrap: 230 }); B.drawn = B.text;
      }
      const z = (cam ? cam.zoom || 1 : 1) * kcssV194B(scene, A, now), want = TUv("mascotBubbleCssPxV194B", 12) / (20 * z);
      const age = now - B.at, pop = REDUCED ? 1 : 0.6 + 0.4 * Math.min(1, age / 140), fade = Math.min(1, (B.until - now) / 250);
      const topY = hy - f.hipY * k - 4 * k - (wantSign ? 30 * k : 0);
      const bw2 = (A.bubbleBox.__w / 2) * want, bh = A.bubbleBox.__h * want;
      let bx = hx, by = topY - (A.bubbleBox.__h / 2 + 12) * want;
      if (wv && wv.width > 0) { bx = Math.max(wv.x + bw2 + 3, Math.min(wv.x + wv.width - bw2 - 3, bx)); by = Math.max(wv.y + bh / 2 + 2, by); }   // held inside the shot
      A.bubbleBox.setScale(want * pop).setPosition(bx, by).setAlpha(fade).setDepth(TUv("mascotBubbleDepthV194B", 18)).setVisible(true);
      const tl = A.bubbleBox.__tail;
      if (tl) tl.setScale(want * pop).setPosition(Math.max(bx - bw2 + 12 * want, Math.min(bx + bw2 - 12 * want, hx)), by + bh / 2).setAlpha(fade).setDepth(TUv("mascotBubbleDepthV194B", 18) + 0.001).setVisible(true);
      V194.bubble = { text: B.text, bucket: B.bucket, x: Math.round(A.bubbleBox.x), y: Math.round(A.bubbleBox.y) };
    } else {
      if (A.bubbleBox) { A.bubbleBox.setVisible(false); if (A.bubbleBox.__tail) A.bubbleBox.__tail.setVisible(false); }
      if (B && now >= B.until) A.bubble = null;
      V194.bubble = null;
    }
    const nb = (st.list || []).filter((q) => q.v194 && q.v194.bubbleBox && q.v194.bubbleBox.visible).length; V194.maxBubbles = Math.max(V194.maxBubbles, nb);
  }
  // the check's and the dev harness's handles: judge a payload now, say a bucket now
  const API_V194B = {
    phrases: () => JSON.parse(JSON.stringify(PHRASES_V194B)), count: () => PHRASE_N_V194B, classify: classifyV194B, acts: () => Object.keys(ACTS_V194B),
    mascot: () => { const sc = window.__gridironScene, st = sc && sc.__mascotV193AI; return st && st.list ? st.list.find((q) => q.v194) || null : null; },
    react: (pay) => { const sc = window.__gridironScene, m = API_V194B.mascot(); return m ? judgeV194B(sc, m, pay) : null; },
    say: (bucket) => { const sc = window.__gridironScene, m = API_V194B.mascot(); return m ? say(m.v194, sc, bucket, true) : null; },
    act: (name) => { const m = API_V194B.mascot(); if (!m || !ACTS_V194B[name]) return null; startActs(m.v194, [name]); return name; },
    state: () => { const m = API_V194B.mascot(), A = m && m.v194; return A ? { home: A.home, team: A.T, opp: A.O, mood: A.mood, moodScore: A.moodScore, margin: A.margin, momentum: A.momentum, act: A.act ? A.act.name : null, queue: A.queue.slice(), bubble: A.bubble ? A.bubble.text : null, sign: A.signTxt, pos: A.pos, tgt: A.tgt, fx: A.fx.length, merch: A.merch.length } : null; }
  };
  V194.api = API_V194B;

  /* ---------------- off the field: the season hero's crest card and the Locker ---------------- */
  const LIVE = new Set();   // canvases animated by one shared, self-stopping timer
  let tick = null;
  function animate() {
    if (tick) return;
    tick = setInterval(() => {
      const now = performance.now();
      LIVE.forEach((c) => { if (!c.isConnected) { LIVE.delete(c); return; } try { c.__draw(now); } catch (e) { err(e); LIVE.delete(c); } });
      if (!LIVE.size) { clearInterval(tick); tick = null; }
    }, Math.round(1000 / Math.max(2, TUv("mascotFpsV193AI", 10))));
  }
  function myTeam() {
    const c = window.__GRIDIRON_TEAM_CUSTOM__ || {}, pals = window.TEAM_PALETTES || [];
    let name = c.teamName || ""; try { const st = window.__getGridironState && window.__getGridironState(); if (st && st.player && window.__NAMES_V123 && !name) name = ""; } catch (e) {}
    return { logo: c.logo != null ? c.logo | 0 : logoForTeam(name), cols: Array.isArray(c.col) ? c.col : pals[c.palette | 0] || ["#1f4fd0", "#e8c86a"] };
  }
  // a loop through the dances, for the cards: idle, the cheer, a flex — a pure function of the clock
  const SHOW = [["idleA", 420], ["idleB", 420], ["idleA", 420], ["idleB", 420], ["cheer0", 170], ["cheer1", 170], ["cheer2", 170], ["cheer3", 170], ["cheer0", 170], ["cheer1", 170], ["cheer2", 170], ["cheer3", 170],
    ["guard", 200], ["flexR", 300], ["flex2", 380], ["flex2low", 220], ["flexL", 260], ["pumpR", 300], ["armsUp", 420]];
  const SHOW_MS = SHOW.reduce((a, s) => a + s[1], 0);
  function showPose(now, ph) { let t = (now + (ph || 0)) % SHOW_MS; for (const s of SHOW) { if (t < s[1]) return s[0]; t -= s[1]; } return "stand"; }
  function mascotCanvas(w, h, teamFn, cls, ph) {
    const c = document.createElement("canvas"), dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = w + "px"; c.style.height = h + "px"; c.className = cls;
    c.__draw = (now) => {
      if (!onV193AI()) { c.getContext("2d").clearRect(0, 0, c.width, c.height); return; }
      const T = teamFn(); const S = sheetV193AI(T.logo, T.cols, T.space, Math.max(1, TUv("mascotPosesPerFrameV193AI", 4)));   // a cold sheet fills over a few ticks
      if (!S) return;
      const pose = showPose(now, ph); if (c.__last === pose + S.key) return; c.__last = pose + S.key;
      const x = c.getContext("2d"); x.clearRect(0, 0, c.width, c.height);
      const k = Math.min(c.width / FW_PX, c.height / FH_PX);
      frameInto(x, S, pose, (c.width - FW_PX * k) / 2, c.height - FH_PX * k, FW_PX * k, FH_PX * k);
      c.dataset.pose = pose; c.dataset.mascot = S.id.arch + ":" + S.id.variant;
    };
    c.__draw(performance.now());
    LIVE.add(c); animate();
    return c;
  }
  // the Locker: the look's own tile (28 calls this for category "mascot")
  function preview(el, it) {
    if (!el) return el;
    el.innerHTML = "";
    V.previews++;
    if (!it || it.id !== "mascot_team" || !onV193AI()) {
      const s = document.createElement("i"); s.className = "mascot-none-v193ai"; s.textContent = it && it.id === "mascot_team" ? "—" : "🚫"; el.appendChild(s); return el;
    }
    const r = el.getBoundingClientRect(), w = Math.max(40, Math.round(r.width || 56)), h = Math.max(46, Math.round(r.height || 56));
    el.appendChild(mascotCanvas(Math.min(w, 72), Math.min(h, 72), () => Object.assign(myTeam(), { space: false }), "mascot-pv-v193ai", 0));
    return el;
  }
  // the season hero: your mascot beside your crest (only while they are yours, or previewed)
  function decorate() {
    if (!active() || !TUv("mascotCardV193AI", 1)) { document.querySelectorAll(".mascot-card-v193ai").forEach((n) => n.remove()); return 0; }
    let n = 0;
    document.querySelectorAll(".sx-hero-v168 .sx-top").forEach((top) => {
      if (top.querySelector(".mascot-card-v193ai")) return;
      const crest = top.querySelector(".crest-v168"); if (!crest) return;
      const c = mascotCanvas(44, 54, () => Object.assign(myTeam(), { space: spaceLevel() }), "mascot-card-v193ai", 300);
      crest.insertAdjacentElement("afterend", c); n++; V.cards++;
    });
    return n;
  }
  let mo = null, moQueued = false;
  function ensureCards() {
    if (mo || !active() || !TUv("mascotCardV193AI", 1)) return;
    try {
      mo = new MutationObserver(() => { if (moQueued) return; moQueued = true; requestAnimationFrame(() => { moQueued = false; if (!active()) { disconnectCards(); return; } decorate(); }); });
      mo.observe(document.getElementById("screen") || document.body, { childList: true, subtree: true });
      decorate();
    } catch (e) { err(e); }
  }
  function disconnectCards() { try { mo && mo.disconnect(); } catch (e) {} mo = null; document.querySelectorAll(".mascot-card-v193ai").forEach((n) => n.remove()); }
  function refresh() { actCache.t = 0; if (active(true)) ensureCards(); else disconnectCards(); return active(); }
  try {
    const st = document.createElement("style"); st.id = "mascotCssV193AI";
    st.textContent = ".mascot-card-v193ai,.mascot-pv-v193ai{image-rendering:pixelated;image-rendering:crisp-edges;display:inline-block;vertical-align:bottom;flex:0 0 auto}" +
      ".mascot-card-v193ai{margin:0 2px 0 -4px;align-self:flex-end}.mascot-none-v193ai{font-style:normal;display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:22px;opacity:.55}" +
      ".mascot-galw-v193ai{margin-top:10px}.mascot-galg-v193ai{display:grid;grid-template-columns:repeat(auto-fill,minmax(68px,1fr));gap:6px}" +
      ".mascot-gal-v193ai{margin:0;padding:4px 2px 3px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);text-align:center}" +
      ".mascot-gal-v193ai img{width:52px;height:62px;image-rendering:pixelated;image-rendering:crisp-edges;display:block;margin:0 auto}" +
      ".mascot-gal-v193ai figcaption{font-size:10px;line-height:1.15;letter-spacing:.04em;text-transform:uppercase;opacity:.8;margin-top:2px}";
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}
  // the look changes (a member equips it, the store turns on): the cards follow
  setTimeout(() => { try { const C = window.RIB_COSMETICS; if (C && C.onChange) C.onChange(() => refresh()); refresh(); } catch (e) {} }, 0);

  /* ---------------- the contact sheet (the owner's view of every costume; the checks' screenshot) ---------------- */
  function contactSheet(o) {
    o = o || {};
    const list = o.logos || (o.all ? EMBLEM_V193AI.map((e, i) => i) : (() => { const seen = {}, out = []; EMBLEM_V193AI.forEach((e, i) => { if (!seen[e[0]]) { seen[e[0]] = 1; out.push(i); } }); return out; })());
    const pose = o.pose || "stand", cols = o.cols || (o.all ? 10 : 8), cw = FW_PX * (o.k || 1), ch = FH_PX * (o.k || 1) + 18;
    const cv = document.createElement("canvas"); cv.width = cols * cw; cv.height = Math.ceil(list.length / cols) * ch;
    const x = cv.getContext("2d"); x.fillStyle = o.bg || "#3f6e3a"; x.fillRect(0, 0, cv.width, cv.height);
    const pals = window.TEAM_PALETTES || [];
    list.forEach((logo, i) => {
      let pal = pals[(window.TEAM_LOGOS_V44 && window.TEAM_LOGOS_V44.palIdx) ? window.TEAM_LOGOS_V44.palIdx(logo) : i % 40] || ["#1f4fd0", "#e8c86a"];
      const S = sheetV193AI(logo, pal, !!o.space), cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
      x.fillStyle = (i + Math.floor(i / cols)) % 2 ? "rgba(0,0,0,.10)" : "rgba(255,255,255,.04)"; x.fillRect(cx, cy, cw, ch);
      frameInto(x, S, Array.isArray(pose) ? pose[i % pose.length] : pose, cx, cy, cw, ch - 18);
      x.fillStyle = "#ffffff"; x.font = "bold 11px sans-serif"; x.textAlign = "center";
      x.fillText(S.id.name.toUpperCase(), cx + cw / 2, cy + ch - 5);
    });
    return cv;
  }
  function poseSheet(logo, pal) {
    const S = sheetV193AI(logo, pal || ["#1f4fd0", "#e8c86a"], false), c = document.createElement("canvas"); c.width = S.cv.width; c.height = S.cv.height;
    const x = c.getContext("2d"); x.fillStyle = "#3f6e3a"; x.fillRect(0, 0, c.width, c.height); x.drawImage(S.cv, 0, 0); return c;
  }
  /* one pose of one costume, without a whole sheet (~1 ms) — the Locker's gallery */
  const PORTRAITS = new Map();
  function portraitURL(logo, colsIn, pose) {
    const cols = teamColours(colsIn), id = forLogo(logo), key = id.logo + cols.p1 + cols.p2 + (pose || "stand");
    if (PORTRAITS.has(key)) return PORTRAITS.get(key);
    const one = document.createElement("canvas"); one.width = LW; one.height = LH;
    try { drawPose(one.getContext("2d", { willReadFrequently: true }), POSES[pose] || POSES.stand, lookFor(id, cols, false)); } catch (e) { err(e); }
    pixelate(one);
    let url = ""; try { url = one.toDataURL(); } catch (e) { err(e); }
    PORTRAITS.set(key, url);
    return url;
  }
  // every archetype once, in its first crest's own palette: "every crest has its mascot"
  function galleryHTML() {
    if (!onV193AI()) return "";
    const seen = {}, pals = window.TEAM_PALETTES || [], TL = window.TEAM_LOGOS_V44, poses = ["stand", "cheer0", "flex2", "pumpR", "armsUp", "wave0", "guard", "cheer2"];
    let h = "", n = 0;
    EMBLEM_V193AI.forEach((e, i) => {
      if (seen[e[0]]) return; seen[e[0]] = 1;
      const pal = pals[TL && TL.palIdx ? TL.palIdx(i) : 0] || ["#1f4fd0", "#e8c86a"], url = portraitURL(i, pal, poses[n++ % poses.length]);
      h += '<figure class="mascot-gal-v193ai" data-arch="' + e[0] + '"><img alt="" src="' + url + '"><figcaption>' + ARCH[e[0]].name + "</figcaption></figure>";
    });
    return '<div class="mascot-galw-v193ai"><div class="pal-sub-v174">Every crest has its mascot<small>' + Object.keys(ARCH).length + " costumes over the " + NLOGO + " crests — each in its team's jersey; the home side's works the end zone, celebrating and sulking every play.</small></div><div class=\"mascot-galg-v193ai\">" + h + "</div></div>";
  }
  /* every team the game names, mapped (the check's enumeration) */
  function mapAll() {
    const N = window.__NAMES_V123, out = { emblems: [], names: {}, byArch: {} };
    for (let i = 0; i < NLOGO; i++) { const id = forLogo(i); out.emblems.push(id); (out.byArch[id.arch] = out.byArch[id.arch] || []).push(id.name); }
    const add = (n, lvl) => { const id = forTeam(n); out.names[n] = { arch: id.arch, variant: id.variant, logo: id.logo, lvl }; };
    try {
      if (N) {
        N.mascots().forEach((m) => N.towns().slice(0, 3).forEach((t) => add(t + " " + m, 3)));
        N.towns().forEach((t) => N.colleges().forEach((c) => add(t + " " + c, 5)));
        N.dfl().forEach((n) => add(n, 7));
      }
      ["COMBINE FIELD", "DRAFT PROSPECTS", "ALL-STARS", "THE NATIONAL TEAM"].forEach((n) => add(n, 6));
    } catch (e) { err(e); }
    return out;
  }

  window.RIB_MASCOTS = {
    version: "v193ai",
    archetypes: () => Object.keys(ARCH).map((k) => ({ id: k, name: ARCH[k].name, variants: Object.keys(VAR[k]).map((vk) => ({ id: vk, name: VAR[k][vk].name })) })),
    emblems: () => EMBLEM_V193AI.map((e, i) => forLogo(i)),
    forLogo, forTeam, mapAll, poses: () => POSE_NAMES.slice(),
    sheet: (logo, cols, space) => sheetV193AI(logo, cols, space), contactSheet, poseSheet,
    active, owned, frame, preview, decorate, refresh, celPose, idlePose, galleryHTML, portraitURL,
    // the live mascots, read (the checks)
    live: () => { const sc = window.__gridironScene, st = sc && sc.__mascotV193AI; return st && st.list ? st.list.map((m) => ({ team: m.team, home: !!m.v194, mood: m.v194 ? m.v194.mood : null, act: m.v194 && m.v194.act ? m.v194.act.name : null, arch: m.S.id.arch, variant: m.S.id.variant, logo: m.S.id.logo, pose: m.pose, celebrating: !!(m.cel && m.cel.alive), cel: m.cel && m.cel.alive ? { kind: m.cel.kind, name: m.cel.name || null } : null, x: Math.round(m.img.x), y: Math.round(m.img.y), h: Math.round(m.img.displayHeight), visible: !!m.img.visible, alive: !!m.img.scene, key: m.key, frame: m.lastPose, space: m.S.space })) : []; },
    // a manual cue (a later win screen, the dev harness): kind "cycle" | "body" (name flex/backflip/spike) | "v177" (name …)
    celebrate: (team, kind, name, ms) => { const sc = window.__gridironScene, st = sc && sc.__mascotV193AI; if (!st) return null; return startCel(st, team === "def" ? "def" : "off", { kind: kind || "cycle", name, t0: performance.now(), ms: ms || TUv("celebrateMs", 2400), fm: TUv("celebrateFrameMs", 170), prio: 3 }); },
    v194b: API_V194B,   // v194 B: the home mascot's mood, acts and lines
    stats: () => ({ builds: V.builds, buildMs: +V.buildMs.toFixed(2), buildMax: +V.buildMax.toFixed(2), stepMax: +(V.stepMax || 0).toFixed(2), frames: V.frames, frameAvg: V.frames ? +(V.frameMs / V.frames).toFixed(4) : 0, frameMax: +V.frameMax.toFixed(3), shown: V.shown, culled: V.culled, cached: SHEETS.size, live: LIVE.size, cards: V.cards, previews: V.previews })
  };
})();
