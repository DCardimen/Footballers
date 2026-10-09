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
 *   WHERE         the live broadcast: one mascot on each team's sideline (v78's banks: "off" = your team, "def" the
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
    plank2: { legs: [8, 18, 4, 2], arms: [160, 10, 146, 20], w: 0, s: 0 }
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
      B.frames.push({ name: n, x: fx, y: fy, w: FW_PX, h: FH_PX, hipY: J ? J.hip.y : 40 });
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
    (st.list || []).forEach((m) => { try { m.img && m.img.destroy(); } catch (e) {} try { m.sh && m.sh.destroy(); } catch (e) {} });
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
    let budget = 1; st.partial = false;
    ["off", "def"].forEach((team, i) => {
      if (team === "def" && !TUv("mascotBothV193AI", 1)) return;
      let S = null;
      if (!SHEETS.has(sheetKey(((Number(T[team].logo) || 0) % NLOGO + NLOGO) % NLOGO, teamColours(T[team].cols), space))) {
        if (!budget) { st.partial = true; return; }
        budget--; S = sheetV193AI(T[team].logo, T[team].cols, space, Math.max(1, TUv("mascotPosesPerFrameV193AI", 8)));
        if (!S) { st.partial = true; return; }   // still drawing: the next frame carries on
      } else S = sheetV193AI(T[team].logo, T[team].cols, space);
      const key = texFor(scene, S);
      if (!key) return;
      const img = scene.add.image(0, 0, key, POSE_IX.idleA);
      const sh = scene.add.ellipse(0, 0, 10, 3, 0x000000, TUv("sideShadowA", 0.26));
      st.list.push({ team, bank: team === "def" ? -1 : 1, S, key, img, sh, u: null, ph: i * 210, cel: null, lastPose: -1, vis: true, colsKey: S.key });
    });
    st.teamsKey = JSON.stringify(T) + space;
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
      let stale = !S.list.length || S.partial || S.list.some((m) => !m.img || !m.img.scene);
      if (!stale && (S.side !== scene.side || t0 - (S.teamsAt || 0) > 1000)) { S.teamsAt = t0; stale = S.teamsKey !== JSON.stringify(teamsFor(scene)) + spaceLevel(); }
      if (stale) { build(scene, S); S.teamsAt = t0; }
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
      const T = teamFn(); const S = sheetV193AI(T.logo, T.cols, T.space);
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
    return '<div class="mascot-galw-v193ai"><div class="pal-sub-v174">Every crest has its mascot<small>' + Object.keys(ARCH).length + " costumes over the " + NLOGO + " crests — each in its team's jersey, on both benches, dancing the players' celebrations.</small></div><div class=\"mascot-galg-v193ai\">" + h + "</div></div>";
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
    live: () => { const sc = window.__gridironScene, st = sc && sc.__mascotV193AI; return st && st.list ? st.list.map((m) => ({ team: m.team, arch: m.S.id.arch, variant: m.S.id.variant, logo: m.S.id.logo, pose: m.pose, celebrating: !!(m.cel && m.cel.alive), cel: m.cel && m.cel.alive ? { kind: m.cel.kind, name: m.cel.name || null } : null, x: Math.round(m.img.x), y: Math.round(m.img.y), h: Math.round(m.img.displayHeight), visible: !!m.img.visible, alive: !!m.img.scene, key: m.key, frame: m.lastPose, space: m.S.space })) : []; },
    // a manual cue (a later win screen, the dev harness): kind "cycle" | "body" (name flex/backflip/spike) | "v177" (name …)
    celebrate: (team, kind, name, ms) => { const sc = window.__gridironScene, st = sc && sc.__mascotV193AI; if (!st) return null; return startCel(st, team === "def" ? "def" : "off", { kind: kind || "cycle", name, t0: performance.now(), ms: ms || TUv("celebrateMs", 2400), fm: TUv("celebrateFrameMs", 170), prio: 3 }); },
    stats: () => ({ builds: V.builds, buildMs: +V.buildMs.toFixed(2), buildMax: +V.buildMax.toFixed(2), stepMax: +(V.stepMax || 0).toFixed(2), frames: V.frames, frameAvg: V.frames ? +(V.frameMs / V.frames).toFixed(4) : 0, frameMax: +V.frameMax.toFixed(3), shown: V.shown, culled: V.culled, cached: SHEETS.size, live: LIVE.size, cards: V.cards, previews: V.previews })
  };
})();
