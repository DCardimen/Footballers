/* ===== v137 THE PRESTIGE VAULT — the room, the hoard, and the physics of spending =====
 *
 * A self-contained scene. It knows nothing about the career app: `open()` is handed a
 * balance, an upgrade and a commit callback, and it hands back exactly one commit.
 * public/rib-vault-bridge.js is the only file that knows both sides.
 *
 * THE LAYERS, back to front, all on one canvas under one camera:
 *   room -> floor light -> rear arch -> hoard(deep, baked) -> hoard(surface, live)
 *   -> flying coins -> the core -> the door -> haze + vignette -> DOM interface
 *
 * THE HOARD is not a picture of a pile and it is not a random scatter. MAX slots are
 * generated ONCE from a fixed seed. Slot i is born at fullness u_i = (i+.5)/MAX and is
 * placed on the surface of the mound AS IT IS AT u_i — radius R(u), height H(u). Because
 * the mound only ever grows, a coin born early is inside every later mound, so the pile
 * has real body and every coin keeps its place forever: N coins are always slots 0..N-1.
 * Spending lowers N, so coins leave from the top and the outside and the mound visibly
 * collapses; earning raises it and they land on top. Nothing reshuffles, ever.
 *
 * THE MIX is the denominations' share of your VALUE, softened, with blue held to a rare
 * accent — one coin worth a billion among a hundred worth a million each is the honest
 * picture of that balance, and it is what the reference art shows. The exact counts are in
 * the details drawer. See docs/PRESTIGE-VAULT.md.
 *
 * ROTATION is procedural: a coin spinning about an axis is exactly scaleX = |cos t|, so the
 * FACE and BACK sprites are squeezed through the EDGE sprite. The supplied 12-frame spin
 * rows are not a monotonic rotation (measured; see scripts/build-vault-art.py), and this is
 * both exact and cheaper.
 *
 * window.__RIB_VAULT is the hook. window.__RIB_VAULT_DEV exposes the model for the checks.
 */
(function () {
  'use strict';
  if (window.__RIB_VAULT) return;

  var ASSET = function (p) {
    return (window.__RIB_ASSET ? window.__RIB_ASSET(p) : './public/' + p);
  };
  var DEN = ['bronze', 'silver', 'gold', 'blue'];
  var DEN_VALUE = { bronze: 1, silver: 1e3, gold: 1e6, blue: 1e9 };
  var DEN_LABEL = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', blue: 'Electric Blue' };
  var DEN_TINT = { bronze: '#c87a44', silver: '#cfd6de', gold: '#f0bb45', blue: '#3da4ff' };

  /* ---------- seeded randomness: the hoard must be the same hoard every session ---------- */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- the number ---------- */
  function commas(n) { return Math.round(n).toLocaleString('en-US'); }
  function shortPP(n) {
    n = Math.max(0, Math.round(n));
    if (n < 1e4) return commas(n);
    if (n < 1e6) return (n / 1e3).toFixed(n < 1e5 ? 1 : 0).replace(/\.0$/, '') + 'K';
    if (n < 1e9) return (n / 1e6).toFixed(n < 1e8 ? 1 : 0).replace(/\.0$/, '') + 'M';
    if (n < 1e12) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
    return (n / 1e12).toFixed(2).replace(/\.?0+$/, '') + 'T';
  }

  /* exact decomposition of ONE integer balance into the four coin faces */
  function breakdown(pp) {
    pp = Math.max(0, Math.round(pp));
    var blue = Math.floor(pp / 1e9), r = pp - blue * 1e9;
    var gold = Math.floor(r / 1e6); r -= gold * 1e6;
    var silver = Math.floor(r / 1e3); r -= silver * 1e3;
    return { bronze: r, silver: silver, gold: gold, blue: blue };
  }

  /* how much of the pile each face takes up. Share of VALUE, softened so a balance that is
   * 99% gold still shows the silver and bronze it really holds; blue is capped at a rare
   * accent because that is what a coin worth a billion looks like among coins worth a
   * million, and it is what the reference hero shows. */
  function mixOf(pp) {
    var b = breakdown(pp), out = {}, sum = 0, i, d, v;
    if (pp <= 0) return { bronze: 1, silver: 0, gold: 0, blue: 0 };
    for (i = 0; i < 4; i++) {
      d = DEN[i]; v = b[d] * DEN_VALUE[d] / pp;
      out[d] = b[d] > 0 ? Math.max(0.022, Math.pow(v, 0.62)) : 0;
    }
    if (out.blue > 0) {
      var capped = Math.min(out.blue, 0.10 * (out.bronze + out.silver + out.gold + out.blue));
      out.gold += (out.blue - capped) * 0.86;
      out.silver += (out.blue - capped) * 0.14;
      out.blue = capped;
    }
    for (i = 0; i < 4; i++) sum += out[DEN[i]];
    if (sum <= 0) return { bronze: 1, silver: 0, gold: 0, blue: 0 };
    for (i = 0; i < 4; i++) out[DEN[i]] /= sum;
    return out;
  }

  /* ---------- how big the pile is. Eight illustrative states, interpolated in log space.
   * These are PRESENTATION only: no economic milestone lives here, and the exact balance is
   * always printed above the pile. The curve is anchored so a handful of PP is a handful of
   * coins on the floor and a billion overflows the room. ---------- */
  var TIERS = [
    { pp: 0,    n: 0.000, name: 'Empty vault' },
    { pp: 12,   n: 0.010, name: 'Almost empty' },
    { pp: 150,  n: 0.055, name: 'Modest savings' },
    { pp: 2e3,  n: 0.160, name: 'Growing wealth' },
    { pp: 25e3, n: 0.330, name: 'Large collection' },
    { pp: 5e5,  n: 0.540, name: 'Massive collection' },
    { pp: 25e6, n: 0.760, name: 'Nearly full vault' },
    { pp: 1e9,  n: 1.000, name: 'Overflowing vault' }
  ];
  function fullnessOf(pp) {
    pp = Math.max(0, pp);
    if (pp <= 0) return 0;
    for (var i = TIERS.length - 1; i >= 0; i--) {
      if (pp >= TIERS[i].pp) {
        if (i === TIERS.length - 1) {
          // past the top anchor it keeps creeping, but it cannot leave the room
          return Math.min(1.25, 1 + Math.log10(pp / TIERS[i].pp) * 0.06);
        }
        var a = TIERS[i], b = TIERS[i + 1];
        var lo = Math.log10(Math.max(a.pp, 1)), hi = Math.log10(b.pp);
        var t = (Math.log10(Math.max(pp, 1)) - lo) / Math.max(hi - lo, 1e-6);
        return a.n + (b.n - a.n) * Math.max(0, Math.min(1, t));
      }
    }
    return 0;
  }
  /* How many coins to draw for a balance. Above the literal line it is the presentation
   * curve against the device's coin budget; at or below it the vault draws your coins ONE
   * FOR ONE, because at that size you can count them and a vault that shows thirteen when
   * you own seven is lying about the only thing on the screen. The two meet within a tenth
   * of each other at the join, so nothing jumps. */
  var LITERAL_PP = 60;
  function coinsFor(pp, budget) {
    pp = Math.max(0, Math.round(pp));
    if (pp <= 0) return 0;
    if (pp <= LITERAL_PP) return pp;
    return Math.max(LITERAL_PP, Math.round(fullnessOf(pp) * budget));
  }

  function tierName(pp) {
    if (pp <= 0) return TIERS[0].name;
    var f = fullnessOf(pp), best = TIERS[1];      // any balance at all is past 'Empty vault'
    for (var i = 1; i < TIERS.length; i++) if (f >= TIERS[i].n - 1e-9) best = TIERS[i];
    return best.name;
  }

  /* ---------- the mound ---------- */
  var MOUND = {
    /* v137 F: THE HOARD IS TALLER THAN IT IS WIDE, ON SCREEN. Height alone was never the
     * problem — v137 E already raised the peak 40% and the heap still read as a puddle,
     * because the FOOTPRINT was growing with it. Measured on a 412px phone at the "large
     * collection" state, the drawn hoard was 400 CSS px across and 131 tall: 3.05 : 1. A
     * heap of anything reads as a heap at about 2 : 1, so the footprint comes in 15% and
     * the peak goes up 30%, which lands it at 1.99 : 1 with the same coins in it. */
    R: function (u) { return 0.26 + 0.59 * Math.pow(Math.max(u, 0), 0.34); },   // footprint
    H: function (u) { return 1.26 * Math.pow(Math.max(u, 0), 0.82); },          // peak
    // the profile is not a cone. A poured mass sits at its angle of repose: a broad base,
    // a shoulder about a third of the way out, and a ROUNDED crown — a cone profile put a
    // spire on the pile, which is the one shape a heap of discs never makes. The flank is
    // FULLER than it was (cos^0.92, not cos): a heap carries most of its mass low down,
    // and the thin shoulder was the other half of why this looked like spilled change.
    prof: function (q) { q = Math.min(1, Math.max(0, q));
      return Math.max(0, Math.pow(Math.cos(q * Math.PI * 0.5), 0.92) * (0.90 + 0.10 * Math.cos(q * 3.1))); },
    lobe: function (th) { return 1 + 0.17 * Math.sin(th * 2 + 0.7) + 0.11 * Math.sin(th * 3 - 1.9) + 0.06 * Math.sin(th * 5 + 0.3); }
  };

  /* ---------- the slots ---------- */
  /* THE HOARD IS MOSTLY STACKS.
   *
   * Loose discs alone read as a brown blob the moment there are more than a dozen of them —
   * there is no vertical structure for the eye to catch, so a hundred coins and a thousand
   * look the same. Money in a vault is STACKED. So most slots are columns: k coins of one
   * denomination drawn from the `flat` sprite, each one a coin's thickness above the last,
   * with a little wander so the column is not a machined cylinder, and now and then a coin
   * lying askew across the top. The rest stay loose and tilted, which is what keeps the
   * heap from looking stocked rather than poured.
   *
   * The budget is therefore counted in COINS, not slots: a stack of eight costs eight. That
   * keeps the draw call count bounded whatever the mix of stacks and singles comes out at,
   * and it keeps `n` meaning the one thing it should mean. `cum[i]` is the running total, so
   * the slots to draw for n coins are still a prefix — slot i is born when the count passes
   * cum[i], nothing reshuffles, and the eight wealth states still land where they did. */
  var STACK_SHARE = 0.74;        // most of the hoard is stacked — v137 F: more of it
  var LOOSE_FIRST = 14;          // ...but the first coins in an almost-empty vault are not
  var SEED = 0x5EED1337;         // fixed, so the vault is the same room every session
  function reseed() { SEED = (SEED * 1664525 + 1013904223) >>> 0; return SEED; }

  /* v137 F: A COIN TAKES UP SPACE.
   *
   * Slots were sampled independently, so nothing stopped two of them landing on the same
   * spot — and at 1700 coins in a footprint this size, plenty did. Coincident coins are
   * invisible as coins: they composite into one brighter blob, which is a third of why the
   * heap read as a texture rather than as objects. A coin now CLAIMS a volume, and a
   * candidate that lands inside one already claimed is re-rolled.
   *
   * It is not hard sphere packing — a heap of discs overlaps heavily and should — it is
   * only a floor on how close two centres may be. The test is in slot space with z opened
   * back out (the floor is an ellipse, so z is compressed by 0.62 there) and y weighted
   * down, because coins stacked a thickness apart are exactly what we want.
   *
   * The grid is a hash of 0.11-unit cells, so the whole build stays linear. */
  var CLAIM = 0.092;             // minimum centre separation, slot units
  var CLAIM_CELL = 0.11;
  var CLAIM_TRIES = 10;          // ...then take it anyway: a wedged build is worse
  function claimKey(x, z, y) {
    return (Math.round(x / CLAIM_CELL) + 512) + ':' +
      (Math.round(z / CLAIM_CELL) + 512) + ':' + Math.round(y / CLAIM_CELL);
  }
  function claimFree(grid, x, z, y) {
    var gx = Math.round(x / CLAIM_CELL), gz = Math.round(z / CLAIM_CELL), gy = Math.round(y / CLAIM_CELL);
    for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) for (var c = -1; c <= 1; c++) {
      var cell = grid[(gx + a + 512) + ':' + (gz + b + 512) + ':' + (gy + c)];
      if (!cell) continue;
      for (var i = 0; i < cell.length; i++) {
        var dx = cell[i][0] - x, dz = (cell[i][1] - z) / 0.62, dy = (cell[i][2] - y) * 0.55;
        if (dx * dx + dz * dz + dy * dy < CLAIM * CLAIM) return false;
      }
    }
    return true;
  }

  function buildSlots(coinBudget) {
    var R = rng(SEED), s = [], cum = [], total = 0, i = 0, grid = {};
    while (total < coinBudget) {
      var u = Math.min(0.9999, total / coinBudget);
      var th, q, spill, rr, h, sink, x0, z0, y0, tries = 0;
      do {
        th = R() * Math.PI * 2;
        // a coin lands on the mound's surface as it is at ITS birth, biased outward so the
        // footprint spreads as fast as the peak climbs
        q = Math.pow(R(), 0.62);
        spill = R() < 0.055;                     // a poured heap throws coins off its foot;
        rr = MOUND.R(u) * (spill ? 1.02 + R() * 0.42 : q) * MOUND.lobe(th);
        h = spill ? 0.012 * R()                  // without them the mound has a cut-out edge
          : MOUND.H(u) * MOUND.prof(q) * (0.80 + 0.20 * MOUND.lobe(th));
        /* v137 F: a coin RESTS on the heap it landed on. `sink` ran 0.55 to 1.0, so half
         * the hoard was parked at half the height of the surface it was supposed to have
         * landed on — the heap was hollow at the top and packed at the bottom, which is
         * the shape of a mat, not a mound. It settles a little now and no more; the coins
         * that end up deep are the ones that later coins are poured ON TOP OF, which is
         * how a real heap buries its own history. */
        sink = 0.80 + 0.20 * R();
        x0 = Math.cos(th) * rr;
        z0 = Math.sin(th) * rr * 0.62;           // the hoard is an ellipse on the floor
        y0 = h * sink;
      } while (!claimFree(grid, x0, z0, y0) && ++tries < CLAIM_TRIES);
      var ck = claimKey(x0, z0, y0);
      (grid[ck] || (grid[ck] = [])).push([x0, z0, y0]);
      /* HOW TALL A COLUMN STANDS. Two things have to be true at once or the heap loses its
       * outline. A column needs something to stand ON, so it is short near the crown where
       * there is no headroom left — that was already here. But it must ALSO be short out at
       * the RIM, and that was not: keyed on headroom alone, the tallest columns in the
       * hoard stood on its outer edge, where headroom is greatest, and the pile came out
       * with vertical walls and a flat top. A drum, not a mound. `edge` is 1 at the middle
       * of the footprint and 0 at its lip, and it governs both how tall a column may stand
       * and how likely a slot is to be one at all — so the silhouette tapers to a scatter
       * of loose coins at the lip, which is what the foot of a poured heap looks like. */
      var edge = 1 - Math.min(1, rr / Math.max(1e-3, MOUND.R(u) * MOUND.lobe(th)));
      var wantStack = total >= LOOSE_FIRST && !spill && R() < STACK_SHARE * (0.72 + 0.28 * edge);
      var room = (1 - Math.min(1, h / (MOUND.H(1) * 0.92))) * (0.40 + 0.60 * edge);
      var k = wantStack
        ? Math.max(2, 2 + Math.round(Math.pow(R(), 1.30) * (2.0 + 11.0 * room * room)))
        : 1;
      s.push({
        x: x0,
        z: z0,
        y: y0,
        tilt: R(),                               // 0 = lying flat, 1 = standing on edge
        rot: R() * Math.PI * 2,                  // spin in the ground plane
        mixU: R(),                               // stable draw against the mix's CDF
        size: 0.84 + 0.32 * R(),
        shade: 0.62 + 0.38 * R(),                // how much light this coin catches
        face: (function (a) { return a < 0.40 ? 'hero' : a < 0.76 ? 'flat' : a < 0.955 ? 'face' : 'edge'; })(R()),
        cnt: k,                                  // 1 = a loose coin, >1 = a column of k
        lean: R() * Math.PI * 2,                 // which way the column wanders as it climbs
        capped: k > 2 && R() < 0.36,             // a coin lying askew across the top
        capRot: (R() - 0.5) * 1.1,
        glint: R()
      });
      if (total + k > coinBudget) k = coinBudget - total;   // land exactly on the budget,
      s[s.length - 1].cnt = k;                              // so a re-pour draws the same
      total += k; cum.push(total); i++;                     // number of coins it did before
      if (i > 4000) break;                       // a belt for the braces
    }
    // how far out the hoard actually reaches, so the physics room can be built around it
    var ex = 0, ez = 0;
    for (i = 0; i < s.length; i++) {
      if (Math.abs(s[i].x) > ex) ex = Math.abs(s[i].x);
      if (Math.abs(s[i].z) > ez) ez = Math.abs(s[i].z);
    }
    // painter's order, far to near, computed once
    var order = new Array(s.length);
    for (i = 0; i < s.length; i++) order[i] = i;
    order.sort(function (a, b) { return (s[b].z - s[a].z) || (s[a].y - s[b].y); });
    return { slot: s, order: order, cum: cum, coins: total, max: s.length, ex: ex, ez: ez };
  }

  /* how many slots the first `n` coins fill — a binary search over the running total */
  function slotsFor(sl, n) {
    var lo = 0, hi = sl.cum.length;
    while (lo < hi) { var m = (lo + hi) >> 1; if (sl.cum[m] <= n) lo = m + 1; else hi = m; }
    return lo;
  }

  function denOf(slot, mix) {
    var u = slot.mixU, acc = 0;
    for (var i = 0; i < 4; i++) { acc += mix[DEN[i]]; if (u < acc) return DEN[i]; }
    return 'bronze';
  }

  /* ---------- sprites ---------- */
  function Sprites() {
    this.img = {}; this.ready = false; this.failed = [];
  }
  Sprites.prototype.load = function (names) {
    var self = this;
    return Promise.all(names.map(function (n) {
      return new Promise(function (res) {
        var im = new Image();
        im.onload = function () { self.img[n] = im; res(); };
        im.onerror = function () { self.failed.push(n); res(); };   // a missing sheet must
        im.src = ASSET('vault/' + n + '.webp');                     // never wedge the vault
      });
    })).then(function () { self.ready = true; return self; });
  };
  Sprites.prototype.get = function (n) { return this.img[n] || null; };

  var SPRITE_NAMES = (function () {
    var out = ['room', 'floor_plate', 'arch', 'beam_l', 'beam_r',
      'door_closed', 'door_open', 'door_front', 'door_rim', 'door_wheel', 'door_bolt',
      'core_idle', 'core_hover', 'core_charged', 'core_complete',
      'burst_gold', 'burst_blue', 'burst_mix'];
    DEN.forEach(function (d) {
      ['face', 'back', 'hero', 'flat', 'edge', 'stack_s', 'stack_m', 'stack_l'].forEach(function (k) {
        out.push('coin_' + d + '_' + k);
      });
    });
    return out;
  })();

  window.__RIB_VAULT_MODEL = {
    breakdown: breakdown, mixOf: mixOf, fullnessOf: fullnessOf, tierName: tierName,
    shortPP: shortPP, commas: commas, buildSlots: buildSlots, slotsFor: slotsFor, denOf: denOf,
    coinsFor: coinsFor, LITERAL_PP: LITERAL_PP, reseed: reseed,
    TIERS: TIERS, DEN: DEN, DEN_VALUE: DEN_VALUE, DEN_LABEL: DEN_LABEL, DEN_TINT: DEN_TINT,
    MOUND: MOUND, rng: rng, SPRITE_NAMES: SPRITE_NAMES, STACK_SHARE: STACK_SHARE
  };
})();

/* ===== v137 THE PRESTIGE VAULT — the scene ===== */
(function () {
  'use strict';
  var M = window.__RIB_VAULT_MODEL;
  var DEN = M.DEN;

  /* ---------- the camera. One point, on the floor of the room art. ----------
   * Ground space: gx in [-1,1] across the floor, gz in [0,1] from the near edge to the
   * back wall, gy above the floor. Everything in the scene — hoard, coins in flight, the
   * core, the door — is placed in this space and projected by ONE function, which is why
   * a coin that leaves the pile arrives at the core on a line that looks physical. */
  var CAM = {
    depth: 2.35,        // how hard the floor foreshortens
    horizon: 0.408,     // where the floor meets the back wall, as a fraction of height
    bottom: 1.12,       // where the near edge of the floor sits (just off-screen)
    spread: 0.62,       // half-width of the floor at the near edge, as a fraction of width
    lift: 0.34,         // how a unit of height reads as screen height
    coin: 78,           // a coin's diameter in CSS px at a 430px-wide viewport, at the pile
    /* v137 F: PERSPECTIVE ON THE COINS THEMSELVES. A coin's drawn size was the raw
     * foreshortening `k`, and across the hoard's own depth that is a 1.28x spread between
     * the nearest coin and the furthest — not enough to read as distance, so the heap came
     * out looking like one flat layer of discs. Raising `k` to a power exaggerates the
     * near/far difference without moving anything: 1.67x now, which the eye reads as depth.
     * The exponent is chosen so a coin at the pile's own depth is EXACTLY the size it was
     * (k=0.612 at PILE.z, and 0.612^1.28 * 78 = 0.612 * 68), so nothing else re-tunes. */
    sizeExp: 1.28
  };
  function Cam(w, h) {
    this.w = w; this.h = h;
    this.kf = 1 / (1 + CAM.depth);
    /* The room is composed for a phone held upright. On a wide screen the extra width is
     * ROOM, not hoard — the floor's half-width and the coins' size are both measured
     * against this span rather than the viewport, so a desktop shows more of the vault
     * instead of a pile smeared across a monitor. */
    this.span = Math.min(w, h * 1.05);
    this.u = Math.min(1.7, Math.max(0.62, this.span / 430));
  }
  Cam.prototype.k = function (gz) { return 1 / (1 + gz * CAM.depth); };
  Cam.prototype.project = function (gx, gy, gz, out) {
    var k = this.k(gz), t = (k - this.kf) / (1 - this.kf);
    out = out || {};
    out.k = k;
    out.x = this.w * 0.5 + gx * k * CAM.spread * this.span;
    out.y = this.h * (CAM.horizon + (CAM.bottom - CAM.horizon) * t) - gy * k * CAM.lift * this.h;
    out.s = Math.pow(k, CAM.sizeExp) * CAM.coin * this.u;
    return out;
  };

  /* the hoard's footprint in ground space.
   * v137 F: `dz` was 0.150, which gave the whole hoard a depth of about a tenth of the
   * room — every coin was at nearly the same distance from the camera, so there was no
   * near and no far to read. At 0.26 the pile occupies real depth: the back of it sits
   * higher up the receding floor AND is drawn visibly smaller, which is the only honest
   * way to say "this thing has a front and a back". */
  var PILE = { z: 0.27, dz: 0.26, dx: 1.20, dy: 0.98 };

  /* ---------- pre-shaded sprite variants ----------
   * A coin in a hoard is lit by how deep in the hoard it sits. Compositing a darkening
   * pass per coin would cost a state change per draw; four baked brightness steps cost one
   * canvas each at load and make the hoard a straight run of drawImage calls. */
  var SHADES = [0.42, 0.60, 0.78, 1.0];
  function shadeBake(img) {
    return SHADES.map(function (s) {
      if (s >= 1) return img;
      var c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      var x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      x.globalCompositeOperation = 'source-atop';
      x.fillStyle = 'rgba(0,0,0,' + (1 - s).toFixed(3) + ')';
      x.fillRect(0, 0, c.width, c.height);
      return c;
    });
  }
  function shadowBlob(r) {
    var c = document.createElement('canvas');
    c.width = c.height = r * 2;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, 'rgba(0,0,0,.62)');
    g.addColorStop(0.55, 'rgba(0,0,0,.30)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2);
    return c;
  }

  /* ---------- the scene ---------- */
  function Scene(canvas, sprites) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.sp = sprites;
    this.shade = {};                 // name -> [4 canvases]
    this.blob = shadowBlob(64);
    this.slots = M.buildSlots(Scene.budget());
    this.deep = document.createElement('canvas');
    this.deepKey = '';
    this.pp = 0; this.mix = M.mixOf(0); this.n = 0; this.nShown = 0;
    this.flyers = []; this.pool = [];
    this.sparks = [];
    this.coreState = 'idle'; this.coreGlow = 0; this.corePulse = 0;
    this.doorT = 1;                  // 1 = the room is open and visible
    this.t0 = performance.now(); this.frames = 0; this.fps = 60; this.slow = 0;
    this.reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.resize();
    var self = this;
    Object.keys(sprites.img).forEach(function (n) {
      if (n.indexOf('coin_') === 0) self.shade[n] = shadeBake(sprites.img[n]);
    });
  }
  /* An intelligently bounded number of objects: the hoard never renders more COINS than
   * this, whatever the balance, and a weak device gets fewer. Counted in coins rather than
   * slots because most slots are stacks — a column of eight costs eight draws, and that is
   * the number the frame actually pays for. */
  Scene.budget = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var px = (window.innerWidth || 400) * (window.innerHeight || 700) * dpr * dpr;
    var mem = navigator.deviceMemory || 4;
    if (px > 2.4e6 && mem >= 4) return 2400;
    if (px > 1.0e6 && mem >= 3) return 1700;
    return 1050;
  };

  Scene.prototype.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, this.slow > 6 ? 1.25 : 2);
    var w = this.cv.clientWidth || window.innerWidth;
    var h = this.cv.clientHeight || window.innerHeight;
    if (this.cw === w && this.ch === h && this.dpr === dpr) return;
    this.cw = w; this.ch = h; this.dpr = dpr;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.cam = new Cam(w, h);
    this.deepKey = '';
    this.deep.width = this.cv.width; this.deep.height = this.cv.height;
    this.bakeRoom();
  };

  /* the room, baked once per size: the art, the banner words the art misspells, and the
   * floor light. Nothing here changes while the vault is open, so it never costs a frame. */
  Scene.prototype.bakeRoom = function () {
    var w = this.cw, h = this.ch;
    if (!this.room) this.room = document.createElement('canvas');
    this.room.width = this.cv.width; this.room.height = this.cv.height;
    var x = this.room.getContext('2d');
    x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    x.fillStyle = '#03060a'; x.fillRect(0, 0, w, h);
    var im = this.sp.get('room');
    if (im) {
      /* The room art is square and a phone is not, so a cover-fit throws away the side
       * walls, the banners and the whole sense of a room — which is what it did. Instead
       * the art is fitted to the WIDTH, uniformly (no squashing), and anchored so its own
       * floor line sits on the camera's horizon. The band above and the band below are
       * filled by STRETCHING the art's own top and bottom rows: the ceiling recedes and the
       * near floor foreshortens least, so a vertical stretch is what more of each would
       * actually look like. */
      /* A phone wants the room fitted to its WIDTH, so the side walls and both banners
       * are in frame. A landscape screen fitted the same way blows the art up until the
       * banners are the size of doors; there it is fitted to HEIGHT and the room is left
       * standing in the middle of a darker hall. */
      var portrait = w / h < 0.95;
      var s = portrait ? (w / im.width * 1.16) : (h / im.height * 1.02);
      var dw = im.width * s, dh = im.height * s;
      var dx = (w - dw) / 2;
      var FLOORLINE = 0.503;                       // where room.webp's floor meets the wall
      var dy = h * CAM.horizon - dh * FLOORLINE;
      x.drawImage(im, dx, dy, dw, dh);
      if (dy > 0) {                                 // ceiling: stretch the art's top rows up
        var cut = Math.max(2, Math.round(im.height * 0.16));
        x.drawImage(im, 0, 0, im.width, cut, dx, 0, dw, dy + 1);
        this.ceilTo = dy;
      } else this.ceilTo = 0;
      this.floorTop = dy + dh;
      if (dx > 0) {
        /* The hall either side of the room, on a screen wider than the art. Stretching the
         * art's edge columns out there smears them into visible horizontal banding, so the
         * sides are simply DARK — the room stands in an unlit hall, which is what the
         * architecture implies anyway, and the eye is left on the vault. */
        var lg = x.createLinearGradient(0, 0, dx * 1.35, 0);
        lg.addColorStop(0, 'rgba(2,4,8,1)');
        lg.addColorStop(0.62, 'rgba(2,4,8,.92)');
        lg.addColorStop(1, 'rgba(2,4,8,0)');
        x.fillStyle = lg; x.fillRect(0, 0, dx * 1.35, h);
        var rg2 = x.createLinearGradient(w, 0, w - dx * 1.35, 0);
        rg2.addColorStop(0, 'rgba(2,4,8,1)');
        rg2.addColorStop(0.62, 'rgba(2,4,8,.92)');
        rg2.addColorStop(1, 'rgba(2,4,8,0)');
        x.fillStyle = rg2; x.fillRect(w - dx * 1.35, 0, dx * 1.35, h);
      }
      this.roomBox = { x: dx, y: dy, w: dw, h: dh };
    }
    this.drawCeiling(x, w, h);
    this.drawFloor(x, w, h);
    this.bannerWords(x, w, h);
    /* the art is lit for a hero render; the vault is a room the interface has to be read
     * over and the hoard has to be the brightest thing in it. This is the grade. */
    var grade = x.createLinearGradient(0, 0, 0, h);
    grade.addColorStop(0, 'rgba(2,5,9,.80)');
    grade.addColorStop(0.30, 'rgba(2,5,9,.34)');
    grade.addColorStop(0.55, 'rgba(2,5,9,.16)');
    grade.addColorStop(1, 'rgba(2,5,9,.58)');
    x.fillStyle = grade; x.fillRect(0, 0, w, h);
    var side = x.createLinearGradient(0, 0, w, 0);
    side.addColorStop(0, 'rgba(2,5,9,.55)');
    side.addColorStop(0.28, 'rgba(2,5,9,0)');
    side.addColorStop(0.72, 'rgba(2,5,9,0)');
    side.addColorStop(1, 'rgba(2,5,9,.55)');
    x.fillStyle = side; x.fillRect(0, 0, w, h);
    /* ===== v151 B THE VAULT WEARS A THEME =====
     * An equipped vault theme (src/28-cosmetics.js) grades the room toward its colour, tints the coins
     * (`Sprites.get` below hands out tinted copies, cached per theme) and hangs its motes over the stage
     * (`vaultDress` on open). The classic hoard returns null and the room is exactly as it was. Looks only:
     * nothing here touches a balance, a reservation or a purchase. */
    var thV151B = null; try { thV151B = window.RIB_COSMETICS && window.RIB_COSMETICS.vaultTheme ? window.RIB_COSMETICS.vaultTheme() : null; } catch (e) {}
    this._themeV151B = thV151B ? thV151B.id : '';
    if (thV151B && thV151B.room) {
      x.save(); x.globalCompositeOperation = 'color'; x.globalAlpha = Math.max(0, Math.min(1, thV151B.roomMix || 0.5));
      x.fillStyle = thV151B.room; x.fillRect(0, 0, w, h); x.restore();
    }
    /* v137 F: THE DOOR ON THE RIGHT IS GONE. A second leaf was parked half off the right
     * edge as set dressing, and it read as a mistake rather than as a door: cropped by the
     * frame, at a scale that fought the room's own perspective, and close enough to the
     * hoard to crowd it. The room art already has a vault door on the far wall, which is
     * the one the opening sequence swings. `door_closed` is still cut and still loaded —
     * the opening uses `door_front` — it is simply not painted into the room any more. */
    // warm pool on the floor, under where the hoard sits
    var p = this.cam.project(0, 0, PILE.z, {});
    var g = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, w * 0.85);
    g.addColorStop(0, 'rgba(255,196,96,.20)');
    g.addColorStop(0.42, 'rgba(255,170,60,.07)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.globalCompositeOperation = 'lighter';
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'source-over';
  };

  /* The band above the art. Two rows of recessed lights running to the same vanishing
   * point the room does, so the stretch under them reads as a ceiling receding rather than
   * as a black bar behind the interface. */
  Scene.prototype.drawCeiling = function (x, w, h) {
    var to = this.ceilTo || 0;
    if (to <= 4) return;
    var g = x.createLinearGradient(0, 0, 0, to * 1.15);
    g.addColorStop(0, 'rgba(3,5,9,.94)');
    g.addColorStop(0.7, 'rgba(3,5,9,.45)');
    g.addColorStop(1, 'rgba(3,5,9,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, to * 1.15);
    x.save(); x.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 5; i++) {
      var t = (i + 0.7) / 5.4;                       // down the ceiling toward the far wall
      var y = to * (1 - t * t * 0.92);
      var spread = 0.46 * (1 - t) + 0.10;
      [-1, 1].forEach(function (side) {
        var cx = w * (0.5 + side * spread);
        var r = Math.max(2, w * 0.034 * (1 - t * 0.55));
        var rg = x.createRadialGradient(cx, y, 0, cx, y, r * 3.2);
        rg.addColorStop(0, 'rgba(255,214,140,' + (0.42 * (1 - t * 0.4)).toFixed(3) + ')');
        rg.addColorStop(0.3, 'rgba(255,186,90,.10)');
        rg.addColorStop(1, 'rgba(255,186,90,0)');
        x.fillStyle = rg; x.fillRect(cx - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
        x.fillStyle = 'rgba(255,232,186,' + (0.55 * (1 - t * 0.5)).toFixed(3) + ')';
        x.beginPath(); x.ellipse(cx, y, r * 0.55, r * 0.20, 0, 0, Math.PI * 2); x.fill();
      });
    }
    x.restore();
  };

  /* The near floor. The art runs out below its own bottom edge and stretching those rows
   * down leaves vertical smears, so the band in front of the room is DRAWN: the plate art
   * laid in perspective on the camera's own ground plane, gold rings that converge on the
   * same vanishing point the room does, and a seam blended across the join. */
  Scene.prototype.drawFloor = function (x, w, h) {
    var top = this.floorTop == null ? h * CAM.horizon : this.floorTop;
    if (top >= h) return;
    var g = x.createLinearGradient(0, top - h * 0.06, 0, h);
    g.addColorStop(0, 'rgba(10,9,7,0)');
    g.addColorStop(0.18, 'rgba(16,13,9,.92)');
    g.addColorStop(1, 'rgba(6,6,7,1)');
    x.fillStyle = g; x.fillRect(0, top - h * 0.06, w, h - top + h * 0.06);
    var plate = this.sp.get('floor_plate');
    if (plate) {
      var pw = w * 2.15, ph = pw * (plate.height / plate.width) * 0.42;
      x.save();
      x.globalAlpha = 0.85; x.globalCompositeOperation = 'lighter';
      x.drawImage(plate, w * 0.5 - pw / 2, h * 0.80 - ph / 2, pw, ph);
      x.restore();
    }
    // the rings the room's own floor carries, continued toward the camera
    var cy = h * CAM.horizon, i, ry, rx, a;
    x.save(); x.globalCompositeOperation = 'lighter';
    for (i = 1; i <= 7; i++) {
      var t = i / 7;
      ry = cy + (h * CAM.bottom - cy) * t * t;
      if (ry < top - h * 0.05) continue;
      rx = w * (0.10 + 1.15 * t * t);
      a = 0.11 * (1 - t * 0.55);
      x.strokeStyle = 'rgba(255,196,104,' + a.toFixed(3) + ')';
      x.lineWidth = Math.max(1, h * 0.0018 * (1 + t));
      x.beginPath();
      x.ellipse(w * 0.5, ry, rx, rx * 0.20, 0, 0, Math.PI * 2);
      x.stroke();
    }
    // the seam: a soft wash so the drawn floor meets the art rather than butting it
    var sm = x.createLinearGradient(0, top - h * 0.10, 0, top + h * 0.07);
    sm.addColorStop(0, 'rgba(255,186,90,0)');
    sm.addColorStop(0.5, 'rgba(255,186,90,.085)');
    sm.addColorStop(1, 'rgba(255,186,90,0)');
    x.fillStyle = sm; x.fillRect(0, top - h * 0.10, w, h * 0.17);
    x.restore();
  };

  /* The supplied room art's banners are misspelled — at native resolution the left one
   * reads PRESTIOS. The build script paints the lettering out; the words are drawn here,
   * in the game's own face, correctly, and they scale with the room. */
  Scene.prototype.bannerWords = function (x, w, h) {
    var b = this.roomBox; if (!b) return;
    /* The boxes are the lettering the build script painted out, as fractions of room.webp
     * (cell (58,100)-(118,168) and (390,121)-(440,170) at the 2.6x it is written out). */
    var BAN = [
      { x0: 0.1157, y0: 0.2050, x1: 0.2352, y1: 0.3446, words: ['DISCIPLINE', 'PROGRESS', 'PRESTIGE', 'IMMORTALITY'] },
      { x0: 0.7770, y0: 0.2484, x1: 0.8766, y1: 0.3486, words: ['BIGGER', 'PLAYERS', 'BRIGHTER', 'TOMORROW'] }
    ];
    x.save();
    x.textAlign = 'center'; x.textBaseline = 'middle';
    BAN.forEach(function (n) {
      var cx = b.x + b.w * (n.x0 + n.x1) / 2;
      var y0 = b.y + b.h * n.y0, y1 = b.y + b.h * n.y1;
      if (y1 < 0 || y0 > h) return;
      var box = b.w * (n.x1 - n.x0);
      var lh = (y1 - y0) / n.words.length;
      var fs = Math.min(lh * 0.62, box * 0.165);
      if (fs < 4) return;
      x.font = '600 ' + fs.toFixed(1) + 'px Oswald, sans-serif';
      x.shadowColor = 'rgba(240,187,69,.55)'; x.shadowBlur = fs * 1.1;
      x.fillStyle = 'rgba(226,178,88,.88)';
      n.words.forEach(function (word, i) {
        var t = x.measureText(word).width;
        if (t > box * 0.94) { x.save(); x.scale(box * 0.94 / t, 1);
          x.fillText(word, cx / (box * 0.94 / t), y0 + lh * (i + 0.5)); x.restore(); }
        else x.fillText(word, cx, y0 + lh * (i + 0.5));
      });
    });
    x.restore();
  };

  /* ---------- what the hoard shows ---------- */
  Scene.prototype.setBalance = function (pp, animate) {
    this.pp = Math.max(0, Math.round(pp));
    this.mix = M.mixOf(this.pp);
    this.n = Math.max(0, Math.min(this.slots.coins, M.coinsFor(this.pp, this.slots.coins)));
    if (!animate) this.nShown = this.n;
  };

  Scene.prototype.coinImg = function (den, kind, shadeIx) {
    var n = 'coin_' + den + '_' + kind;
    // v151 B: a vault theme's coins are the tinted sprite, shaded the same four ways (baked once per theme)
    var T = this._tV151B;
    if (T && this.sp.img && window.RIB_COSMETICS && window.RIB_COSMETICS.vaultTint) {
      var cc = this._shadeV151B || (this._shadeV151B = {}), ck = T.id + ':' + n;
      if (cc[ck] === undefined) { var raw = this.sp.img[n], tt = raw ? window.RIB_COSMETICS.vaultTint(raw, n) : null; cc[ck] = tt ? shadeBake(tt) : null; }
      if (cc[ck]) return cc[ck][shadeIx];
    }
    var v = this.shade[n];
    return v ? v[shadeIx] : this.sp.get(n);
  };

  /* one coin, anywhere in the scene. `spin` is the rotation about the coin's own axis:
   * scaleX = |cos spin| is exactly what a spinning disc does, and the face flips to the
   * back through the crossing, where the edge sprite is blended in. */
  var THICK = { face: 0.085, back: 0.085, flat: 0.070, hero: 0.045, edge: 0 };
  /* v137 F: A COLUMN IS MADE OF THINGS, and each thing has a side to it. The per-coin rise
   * was 0.086 of a diameter with the edge pass turned down to 0.55 — so a stack of eight
   * stood 0.60 diameters tall and the discs in it had almost no visible thickness. They
   * are 0.118 apart now (a coin in this camera presents a shallow ellipse, so the rise
   * reads as rather more than a real coin's 1/16th) and each one draws its full edge, so
   * the gap between two discs is filled by the SIDE of the lower one. Same eight coins,
   * 0.83 diameters of column, and you can count them. */
  var STACK_RISE = 0.118;
  var EDGE_MUL = 1.15;
  Scene.prototype.drawCoin = function (x, den, kind, px, py, size, rot, spin, shadeIx, tilt, thickMul) {
    var img, sx = 1, alt = null, altA = 0;
    if (spin != null) {
      var c = Math.cos(spin);
      kind = c >= 0 ? 'face' : 'back';
      sx = Math.abs(c);
      if (sx < 0.30) { alt = this.coinImg(den, 'edge', shadeIx); altA = 1 - sx / 0.30; }
    }
    img = this.coinImg(den, kind, shadeIx);
    if (!img) return;
    /* `size` is the coin's DIAMETER. For every face-on sprite that is the width, but the
     * edge view is a tall sliver — 27x117 — so fitting it by width draws a plank four
     * diameters long. It fits by height. */
    var w, hgt;
    if (kind === 'edge') { hgt = size; w = size * (img.width / img.height); }
    else { w = size; hgt = size * (img.height / img.width); }
    if (tilt != null) hgt *= (0.34 + 0.66 * (1 - tilt));   // lying flat vs standing up
    x.save();
    x.translate(px, py);
    if (rot) x.rotate(rot);
    // the edge of the coin, under its face
    var thk = this.lite ? 0 : (THICK[kind] || 0) * size * (thickMul == null ? 1 : thickMul);
    if (thk > 0.55 && size > 8) {
      var rim = this.coinImg(den, kind, 0);
      if (rim) {
        var rh = (kind === 'edge') ? size : size * (rim.height / rim.width);
        if (tilt != null) rh *= (0.34 + 0.66 * (1 - tilt));
        x.globalAlpha = 0.95;
        x.drawImage(rim, -size * sx / 2, -rh / 2 + thk, size * sx, rh);
        x.globalAlpha = 1;
      }
    }
    if (altA > 0 && alt) {
      x.globalAlpha = 1 - altA;
      x.drawImage(img, -w * sx / 2, -hgt / 2, w * sx, hgt);
      x.globalAlpha = altA;
      var ew = size * (alt.width / alt.height) * (hgt / size) * 0.9;
      x.drawImage(alt, -ew / 2, -hgt / 2, ew, hgt);
    } else {
      x.drawImage(img, -w * sx / 2, -hgt / 2, w * sx, hgt);
    }
    x.restore();
  };

  /* the deep layer: everything below the live surface, baked. Re-baked only when the
   * quantised count moves, so a 16x stream re-bakes a few times a second, not 60. */
  Scene.prototype.bakeDeep = function (nDeep) {
    var step = Math.max(10, Math.round(this.slots.coins * 0.012));
    var q = Math.round(nDeep / step) * step;
    /* v137 F: `_deepSeq` counts how many times a coin has entered or left the DEEP layer.
     * The deep layer is a baked canvas, which is why picking used to be restricted to the
     * live surface band — grab a coin from underneath and the bake kept drawing it where
     * it had been. Every coin is grabbable now, so the bake has to be re-run on the frame
     * a deep coin is lifted, and again when it comes home. It is bumped only for coins
     * that are actually deep, so an ordinary lift off the surface still costs nothing. */
    var key = q + '|' + this.mixKey() + '|' + (this._deepSeq || 0);
    if (key === this.deepKey) return;
    this.deepKey = key;
    var x = this.deep.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, this.deep.width, this.deep.height);
    x.scale(this.dpr, this.dpr);
    this.deepSlots = M.slotsFor(this.slots, q);
    this._skip = this._bodies;                  // whatever is loose is drawn live, not baked
    baseDrawRange.call(this, x, 0, this.deepSlots, true);
    this._skip = null;
  };
  Scene.prototype.mixKey = function () {
    return DEN.map(function (d) { return Math.round(this.mix[d] * 40); }, this).join(',');
  };

  Scene.prototype.drawRange = function (x, from, to, withShadow) {
    var s = this.slots.slot, ord = this.slots.order, cam = this.cam, p = {};
    var blob = this.blob, i, k, sl, den, size, shadeIx;
    for (k = 0; k < ord.length; k++) {
      i = ord[k];
      if (i < from || i >= to) continue;
      if (this._skip && this._skip[i]) continue;   // this one is loose; the physics draws it
      sl = s[i];
      cam.project(sl.x * PILE.dx, sl.y * PILE.dy, PILE.z + sl.z * PILE.dz, p);
      size = p.s * sl.size;
      /* v137 F: HOW DEEP IN THE HEAP THIS COIN SITS, and therefore how much light reaches
       * it. Brightness used to key on the slot's own height, which is not the same thing:
       * a coin sitting at 0.4 is on the SURFACE of a quarter-full vault and buried under
       * half a metre of money in a full one, and it was drawn identically in both. `ao` is
       * the coin's height as a fraction of the heap's surface at its own (x,z) RIGHT NOW,
       * so the crown catches the room and the inside of the pile goes properly dark. That
       * darkness is the single thing that makes a heap of discs read as having a volume
       * rather than as a texture, and it costs one `surfaceAt` per drawn coin. */
      var ao = 1;
      if (this.surfaceAt) {
        var sv = this.surfaceAt(sl.x * PILE.dx, sl.z * PILE.dz) / PILE.dy;
        if (sv > 1e-3) ao = Math.min(1, sl.y / sv);
      }
      if (withShadow) {
        if (sl.y < 0.10) {                       // on the floor: the heap's own contact shadow
          x.globalAlpha = 0.5;
          x.drawImage(blob, p.x - size * 0.72, p.y - size * 0.24, size * 1.44, size * 0.5);
          x.globalAlpha = 1;
        } else if (size > 6) {
          /* ...and on the heap: a coin PRESSES INTO what it is lying on. Without this every
           * coin floats on the one behind it and the pile has no interior. */
          x.globalAlpha = 0.28 + 0.24 * ao;
          x.drawImage(blob, p.x - size * 0.56, p.y - size * 0.02, size * 1.12, size * 0.40);
          x.globalAlpha = 1;
        }
      }
      den = M.denOf(sl, this.mix);
      shadeIx = Math.min(3, Math.max(0, Math.round(ao * 2.4 + sl.shade * 0.75 - 0.35)
        - (den === 'blue' ? 1 : 0)));
      if (sl.cnt > 1 && size > 7) { this.drawStack(x, sl, den, p.x, p.y, size, shadeIx); continue; }
      this.drawCoin(x, den, sl.face, p.x, p.y, size,
        (sl.rot - Math.PI) * (sl.face === 'edge' ? 0.10 : sl.face === 'face' ? 0.55 : 0.26),
        null, shadeIx, sl.face === 'face' ? 0.06 + sl.tilt * 0.40 : null);
    }
  };

  /* The bake must never go through the physics module's wrapper: that wrapper draws the
   * LOOSE coins at their live positions, and baking those in freezes a coin you are still
   * holding into the canvas behind it. */
  var baseDrawRange = Scene.prototype.drawRange;

  /* A COLUMN. k coins of one denomination — you sort your money — each a coin's thickness
   * above the last, off the `flat` sprite, which is the shallow ellipse a coin lying in a
   * stack actually presents to this camera. Two things stop it reading as a machined
   * cylinder: the column WANDERS as it climbs (a stack of coins is never plumb), and the
   * light climbs with it, so the top catches more than the buried foot. A fifth of the
   * taller ones carry a coin lying askew across the top. */
  Scene.prototype.drawStack = function (x, sl, den, px, py, size, shadeIx) {
    return this.drawStackN(x, sl, den, px, py, size, shadeIx, sl.cnt);
  };
  Scene.prototype.drawStackN = function (x, sl, den, px, py, size, shadeIx, n) {
    var k = Math.max(1, n | 0), step = size * STACK_RISE;
    var wx = Math.cos(sl.lean) * size * 0.085, wy = Math.sin(sl.lean) * size * 0.030;
    var rot = (sl.rot - Math.PI) * 0.16;
    var j, sx, sy, ix;
    for (j = 0; j < k; j++) {
      var t = j / Math.max(1, k - 1);
      sx = px + wx * t * t + (j & 1 ? size * 0.018 : -size * 0.015);
      sy = py - j * step + wy * t * t;
      /* THE LIGHT CLIMBS THE COLUMN, and it climbs it smoothly. A single step at 58% made
       * every stack two flat blocks of tone; a ramp over the whole column is what a stack
       * of metal discs under one overhead light actually does, and it is most of what says
       * "this is a column" rather than "these are discs at different heights". */
      ix = Math.max(0, Math.min(3, Math.round(shadeIx - 0.85 + t * 1.7)));
      this.drawCoin(x, den, 'flat', sx, sy, size, rot + t * 0.10, null, ix, null, EDGE_MUL);
    }
    if (sl.capped && k === sl.cnt) {          // the coin lying across the top goes first
      this.drawCoin(x, den, 'hero', px + wx, py - (k - 0.30) * step,
        size * 0.95, sl.capRot, null, Math.min(3, shadeIx + 1), null);
    }
  };

  Scene.prototype.drawHoard = function (x) {
    var n = Math.round(this.nShown);
    if (n <= 0) return;
    /* The live band is deliberately NOT tied to the quality flip. It sets where the deep
     * layer ends, so changing it changes the bake key and re-draws 1700 sprites on the very
     * frame the scene decided it was behind — a 160ms stall caused by the attempt to avoid
     * one. Lite mode saves its frame by dropping the edge pass and capping bodies instead,
     * neither of which moves this boundary. */
    var live = Math.min(n, Math.max(40, Math.round(this.slots.coins * 0.16)));
    var deepN = Math.max(0, n - live);
    this.bakeDeep(deepN);
    // one big contact shadow tying the whole hoard to the floor
    var f = n / this.slots.coins;
    var p = this.cam.project(0, 0, PILE.z, {});
    var rw = this.cam.span * (0.20 + 0.52 * Math.pow(f, 0.45));
    x.globalAlpha = 0.9;
    x.drawImage(this.blob, p.x - rw * 1.18, p.y - rw * 0.30, rw * 2.36, rw * 0.86);
    x.globalAlpha = 0.72;
    x.drawImage(this.blob, p.x - rw * 0.72, p.y - rw * 0.16, rw * 1.44, rw * 0.50);
    x.globalAlpha = 1;
    if (this.deepSlots > 0) {
      x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
      x.drawImage(this.deep, 0, 0); x.restore();
    }
    this._looseFrom = 0;              // loose coins from ANY depth are drawn in this pass
    this.drawRange(x, this.deepSlots, M.slotsFor(this.slots, n), true);
    this._looseFrom = null;
  };

  // STACK_RISE crosses the module line: `pickSurface` and `hoardBox` live in the next
  // block and both have to agree with `drawStackN` about how tall a column stands, or
  // the thing you aim at and the thing you hit are different objects.
  window.__RIB_VAULT_SCENE = { Scene: Scene, Cam: Cam, CAM: CAM, PILE: PILE,
    STACK_RISE: STACK_RISE, EDGE_MUL: EDGE_MUL };
})();

/* ===== v137 THE PRESTIGE VAULT — the core, the door, the light, and the frame ===== */
(function () {
  'use strict';
  var M = window.__RIB_VAULT_MODEL, S = window.__RIB_VAULT_SCENE;
  var Scene = S.Scene, CAM = S.CAM, PILE = S.PILE, STACK_RISE = S.STACK_RISE;

  /* The receiver sits where the room's rear arch is, above the hoard. It is placed in
   * SCREEN space and the projection is asked for nothing, because it is the one thing in
   * the scene that must hold the same place on every aspect ratio — a coin's flight is
   * aimed at it, so if it moved the flight would stop reading as physical. */
  Scene.prototype.corePoint = function () {
    return { x: this.cw * 0.5, y: this.ch * 0.337, r: Math.min(this.cw, this.ch) * 0.132 };
  };

  Scene.prototype.drawCore = function (x, now) {
    var c = this.corePoint();
    var name = this.coreState === 'complete' ? 'core_complete'
      : this.coreState === 'charged' ? 'core_charged'
        : this.coreState === 'hot' ? 'core_hover' : 'core_idle';
    var img = this.sp.get(name);
    var pulse = 1 + this.corePulse * 0.13 + Math.sin(now / 900) * 0.012;
    var r = c.r * pulse;
    if (this.coreGlow > 0.01) {
      var g = x.createRadialGradient(c.x, c.y, r * 0.3, c.x, c.y, r * 2.5);
      var blue = this.coreState === 'charged';
      g.addColorStop(0, (blue ? 'rgba(90,180,255,' : 'rgba(255,196,96,') + (0.30 * this.coreGlow).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.globalCompositeOperation = 'lighter';
      x.fillStyle = g; x.fillRect(c.x - r * 2.6, c.y - r * 2.6, r * 5.2, r * 5.2);
      x.globalCompositeOperation = 'source-over';
    }
    if (img) x.drawImage(img, c.x - r, c.y - r * (img.height / img.width), r * 2, r * 2 * (img.height / img.width));
    // the funding ring, drawn on the core's own rim
    if (this.progress != null) {
      x.save();
      x.translate(c.x, c.y);
      x.lineWidth = Math.max(3, r * 0.075);
      x.lineCap = 'round';
      x.strokeStyle = 'rgba(0,0,0,.45)';
      x.beginPath(); x.arc(0, 0, r * 1.10, 0, Math.PI * 2); x.stroke();
      var p = Math.max(0, Math.min(1, this.progress));
      if (p > 0.0005) {
        x.strokeStyle = this.progress >= 1 ? '#6ee38b' : '#f0bb45';
        x.shadowColor = x.strokeStyle; x.shadowBlur = r * 0.30;
        x.beginPath(); x.arc(0, 0, r * 1.10, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); x.stroke();
      }
      x.restore();
    }
    this.corePulse *= 0.88;
    this.coreGlow += ((this.coreState === 'idle' ? 0.25 : 1) - this.coreGlow) * 0.06;
  };

  /* The door rests at the right edge, seen at an angle, the way the reference composes it.
   * `doorT` runs 0 (shut, filling the frame) to 1 (open, parked at the edge) and the whole
   * opening is one sprite under an affine transform plus one rotating wheel — the leaf's
   * geometry never changes between frames, which is the thing the brief rules out. */
  /* THE OPENING, AS A CUE SHEET.
   *
   *   .00-.24  UNLOCK   the lock wheel turns a turn and a quarter and settles
   *   .20-.46  BOLTS    eight bolts draw IN, toward the hub — that is what unlocking is
   *   .46-.92  SWING    the leaf pivots about its right edge and sweeps out of the frame
   *   .72-1.0  REVEAL   the room comes up behind it, and the camera settles out of a push
   *
   * The leaf, its wheel and its bolts are drawn inside ONE transform, so they are a single
   * rigid body throughout: the wheel cannot drift off the hub and the bolts cannot detach
   * from the door they are holding shut. The pivot is a horizontal squash anchored on the
   * HINGE rather than on the centre — a door turning away from you projects exactly that
   * way, and anchoring it at the centre is what makes a swing read as a slide. */
  var DOOR_CUE = { wheel: [0.00, 0.24], bolt: [0.20, 0.46], swing: [0.46, 0.92] };
  function cue(t, c) { return Math.max(0, Math.min(1, (t - c[0]) / (c[1] - c[0]))); }
  function easeOut(k) { return 1 - Math.pow(1 - k, 2.6); }

  Scene.prototype.drawDoor = function (x, now) {
    var t = this.doorT;
    if (t >= 0.999) return;            // at rest the door is baked into the room, on the wall
    var leaf = this.sp.get('door_front'), wheel = this.sp.get('door_wheel');
    var rim = this.sp.get('door_rim'), bolt = this.sp.get('door_bolt');
    var w = this.cw, h = this.ch;
    var kw = easeOut(cue(t, DOOR_CUE.wheel));
    var kb = cue(t, DOOR_CUE.bolt);
    var ks = easeOut(cue(t, DOOR_CUE.swing));

    // While the door is shut the room behind it is not visible. The wash lifts with the
    // swing, so the reveal is the room ARRIVING rather than the leaf sliding off a picture.
    // holds near-opaque through most of the swing, then lets go quickly — a linear lift
    // shows the hoard through the door while the door is still shut
    x.fillStyle = 'rgba(2,4,7,' + (0.95 * Math.pow(1 - ks, 0.55)).toFixed(3) + ')';
    x.fillRect(0, 0, w, h);

    var cy = h * 0.46;
    var H = Math.min(w * 1.26, h * 0.76);
    var LW = leaf ? H * (leaf.width / leaf.height) : H;
    var hingeX = w * 0.5 + LW * 0.5;                    // the right edge of the leaf

    // the frame the leaf sits in: it never moves, and the tunnel behind it is what the
    // swing uncovers
    if (rim) {
      var rw = H * (rim.width / rim.height);
      x.save();
      // the frame fades with the last of the swing rather than vanishing on the frame the
      // sequence ends — a pop there is the one thing a two-second shot cannot afford
      x.globalAlpha = 0.94 * Math.min(1, (1 - t) / 0.16);
      x.drawImage(rim, w * 0.5 - rw / 2, cy - H / 2, rw, H);
      x.restore();
    }

    if (leaf) {
      var open = Math.cos(ks * 1.42);                   // 1 shut, ~0.15 swung away
      x.save();
      x.translate(hingeX, cy);
      x.scale(Math.max(0.05, open), 1 - ks * 0.05);     // pivot ON THE HINGE
      x.globalAlpha = Math.max(0, 1 - ks * 0.10);
      x.drawImage(leaf, -LW, -H / 2, LW, H);

      // the bolts, on the leaf's own radius, drawing IN as they release
      if (bolt && kb < 1) {
        var br = H * 0.415 * (1 - kb * 0.26), bw = H * 0.080;
        for (var i = 0; i < 8; i++) {
          var a = i / 8 * Math.PI * 2 + Math.PI / 16;
          x.save();
          x.translate(-LW * 0.5 + Math.cos(a) * br, Math.sin(a) * br);
          x.rotate(a);
          x.globalAlpha = 0.85 * (1 - kb * 0.65);
          x.drawImage(bolt, -bw / 2, -bw * 0.24, bw, bw * 0.48);
          x.restore();
        }
      }
      // the lock wheel, on the hub, a turn and a quarter
      if (wheel) {
        var ww = LW * 0.40, wh = ww * (wheel.height / wheel.width);
        x.save();
        x.translate(-LW * 0.5, -H * 0.012);
        x.rotate(kw * Math.PI * 2.5);
        x.globalAlpha = 0.97;
        x.drawImage(wheel, -ww / 2, -wh / 2, ww, wh);
        x.restore();
      }
      x.restore();

      // the seal cracking: a line of light down the leading edge as it lets go
      if (ks > 0.02 && ks < 0.75) {
        var gx = hingeX - LW * Math.max(0.05, open);
        var gg = x.createLinearGradient(gx - H * 0.05, 0, gx + H * 0.05, 0);
        gg.addColorStop(0, 'rgba(255,200,110,0)');
        gg.addColorStop(0.5, 'rgba(255,214,140,' + (0.55 * (1 - ks)).toFixed(3) + ')');
        gg.addColorStop(1, 'rgba(255,200,110,0)');
        x.save(); x.globalCompositeOperation = 'lighter';
        x.fillStyle = gg; x.fillRect(gx - H * 0.05, cy - H / 2, H * 0.10, H);
        x.restore();
      }
    }
  };

  /* atmosphere: the haze the room sits in, and the vignette that keeps the interface
   * readable over it. Cheap, and the only full-screen passes in the frame. */
  Scene.prototype.drawAir = function (x, now) {
    var w = this.cw, h = this.ch;
    if (!this.vig || this.vigW !== w || this.vigH !== h) {
      this.vigW = w; this.vigH = h;
      this.vig = document.createElement('canvas');
      this.vig.width = Math.max(2, Math.round(w / 3)); this.vig.height = Math.max(2, Math.round(h / 3));
      var v = this.vig.getContext('2d');
      var g = v.createRadialGradient(this.vig.width / 2, this.vig.height * 0.46, 0,
        this.vig.width / 2, this.vig.height * 0.46, this.vig.width * 0.95);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.62, 'rgba(0,0,0,.18)');
      g.addColorStop(1, 'rgba(0,0,0,.62)');
      v.fillStyle = g; v.fillRect(0, 0, this.vig.width, this.vig.height);
    }
    x.drawImage(this.vig, 0, 0, w, h);
    // a slow wash of warm haze off the hoard, so the room has air in it
    var p = this.cam.project(0, 0.2, PILE.z, {});
    var a = 0.05 + 0.02 * Math.sin(now / 2600);
    var gg = x.createLinearGradient(0, p.y - h * 0.30, 0, p.y + h * 0.18);
    gg.addColorStop(0, 'rgba(255,186,86,0)');
    gg.addColorStop(0.5, 'rgba(255,186,86,' + a.toFixed(3) + ')');
    gg.addColorStop(1, 'rgba(255,186,86,0)');
    x.globalCompositeOperation = 'lighter';
    x.fillStyle = gg; x.fillRect(0, p.y - h * 0.30, w, h * 0.48);
    x.globalCompositeOperation = 'source-over';
  };

  /* ---------- coins in flight ---------- */
  function Flyer() { this.live = false; }
  Scene.prototype.launch = function (den, from, opts) {
    opts = opts || {};
    var f = null, i;
    for (i = 0; i < this.flyers.length; i++) if (!this.flyers[i].live) { f = this.flyers[i]; break; }
    if (!f) {
      if (this.flyers.length >= (this.reduced ? 18 : 88)) return null;
      f = new Flyer(); this.flyers.push(f);
    }
    var c = this.corePoint();
    var lift = 0.34 + Math.random() * 0.30;
    f.live = true; f.den = den;
    f.x0 = from.x; f.y0 = from.y;
    f.x1 = c.x + (Math.random() - 0.5) * c.r * 0.5;
    f.y1 = c.y + (Math.random() - 0.5) * c.r * 0.5;
    // a real arc: the control point is above and biased the way the coin left the pile
    f.cx = (f.x0 + f.x1) / 2 + (f.x0 - this.cw / 2) * (0.30 + Math.random() * 0.4);
    f.cy = Math.min(f.y0, f.y1) - this.ch * lift;
    f.t = 0;
    f.dur = (opts.dur || 560) * (0.82 + Math.random() * 0.36);
    f.spin = Math.random() * Math.PI * 2;
    f.spinV = (0.010 + Math.random() * 0.020) * (Math.random() < 0.5 ? -1 : 1);
    f.size = (opts.size || this.cam.project(0, 0, PILE.z, {}).s) * (0.72 + Math.random() * 0.34);
    f.trail = opts.trail !== false;
    f.px = f.x0; f.py = f.y0;
    return f;
  };
  Scene.prototype.stepFlyers = function (dt, onArrive) {
    var i, f, t, mt, x, y, n = 0;
    for (i = 0; i < this.flyers.length; i++) {
      f = this.flyers[i]; if (!f.live) continue;
      n++;
      f.t += dt / f.dur;
      if (f.t >= 1) {
        f.live = false;
        this.corePulse = Math.min(1.3, this.corePulse + 0.22);
        this.burst(f.x1, f.y1, f.den);
        if (onArrive) onArrive(f);
        continue;
      }
      t = f.t < 0 ? 0 : f.t;
      var e = t * t * (3 - 2 * t);          // ease so it leaves fast and arrives soft
      mt = 1 - e;
      f.px = mt * mt * f.x0 + 2 * mt * e * f.cx + e * e * f.x1;
      f.py = mt * mt * f.y0 + 2 * mt * e * f.cy + e * e * f.y1;
      f.spin += f.spinV * dt;
    }
    this.flyLive = n;
  };
  Scene.prototype.drawFlyers = function (x) {
    var i, f;
    for (i = 0; i < this.flyers.length; i++) {
      f = this.flyers[i]; if (!f.live) continue;
      var shrink = 1 - f.t * 0.34;                 // it recedes toward the core
      if (f.trail && !this.reduced) {
        x.save();
        x.globalCompositeOperation = 'lighter';
        var tg = x.createRadialGradient(f.px, f.py, 0, f.px, f.py, f.size * 1.5);
        var tint = M.DEN_TINT[f.den];
        tg.addColorStop(0, tint + 'aa'); tg.addColorStop(1, tint + '00');
        x.fillStyle = tg;
        x.fillRect(f.px - f.size * 1.5, f.py - f.size * 1.5, f.size * 3, f.size * 3);
        x.restore();
      }
      this.drawCoin(x, f.den, 'face', f.px, f.py, f.size * shrink, 0, f.spin, 3, null);
    }
  };

  Scene.prototype.burst = function (px, py, den) {
    if (this.reduced) return;
    var n = 5 + Math.round(Math.random() * 4);
    for (var i = 0; i < n && this.sparks.length < 160; i++) {
      var a = Math.random() * Math.PI * 2, sp = 0.04 + Math.random() * 0.13;
      this.sparks.push({ x: px, y: py, vx: Math.cos(a) * sp * this.cw, vy: Math.sin(a) * sp * this.cw,
        life: 1, den: den, r: 1.2 + Math.random() * 2.2 });
    }
  };
  Scene.prototype.stepSparks = function (dt) {
    for (var i = this.sparks.length - 1; i >= 0; i--) {
      var s = this.sparks[i];
      s.x += s.vx * dt / 1000; s.y += s.vy * dt / 1000;
      s.vy += dt * 0.0006 * this.ch / 700;
      s.life -= dt / 620;
      if (s.life <= 0) this.sparks.splice(i, 1);
    }
  };
  Scene.prototype.drawSparks = function (x) {
    if (!this.sparks.length) return;
    x.save(); x.globalCompositeOperation = 'lighter';
    for (var i = 0; i < this.sparks.length; i++) {
      var s = this.sparks[i];
      x.globalAlpha = Math.max(0, s.life) * 0.9;
      x.fillStyle = M.DEN_TINT[s.den];
      x.beginPath(); x.arc(s.x, s.y, s.r * s.life, 0, Math.PI * 2); x.fill();
    }
    x.restore();
  };

  /* where on the hoard's visible surface a coin actually is. A flying coin must LEAVE the
   * pile, so the tap picks a real slot near the touch and hands back its screen point. */
  /* v137 F: WHATEVER YOU TOUCH IS WHAT YOU GET.
   *
   * This used to search the last 22% of the slot list and return whichever of those had
   * its centre nearest the finger — with no distance limit at all. Two things were wrong
   * with that and both of them are the "sometimes it just doesn't respond" you can feel.
   * Coins outside that window — which is most of the hoard, and all of the deep layer —
   * could not be picked AT ALL; and because the nearest of the candidates always won, a
   * press on one of them silently grabbed a coin somewhere else, often off the far side of
   * the pile, so the coin under your finger sat there while something you were not looking
   * at moved. Both read as dead touch.
   *
   * Now it walks the painter's order BACKWARDS — nearest to the camera first, which is the
   * order your eye picks a coin out of the heap in — and returns the first one whose drawn
   * body actually contains the point. A column is tested as the whole column, base to top,
   * because that is what you can see and therefore what you will aim at. Only if nothing is
   * under the finger at all does it fall back to the nearest centre, and that search now
   * covers the whole hoard rather than a window of it. */
  Scene.prototype.pickSurface = function (px, py) {
    var n = M.slotsFor(this.slots, Math.round(this.nShown));
    if (n <= 0) {
      var c = this.cam.project(0, 0, PILE.z, {});
      return { x: c.x, y: c.y, i: -1, s: c.s };
    }
    var s = this.slots.slot, ord = this.slots.order, p = {}, i, k, sl, size, rise, top, dx, dy;
    var bd = 1e9, bi = -1, bx = 0, by = 0, bs = 0;
    for (k = ord.length - 1; k >= 0; k--) {
      i = ord[k];
      if (i >= n) continue;
      sl = s[i];
      this.cam.project(sl.x * PILE.dx, sl.y * PILE.dy, PILE.z + sl.z * PILE.dz, p);
      size = p.s * sl.size;
      rise = sl.cnt > 1 ? (sl.cnt - 1) * size * STACK_RISE : 0;
      top = p.y - rise;
      dx = px - p.x;
      // inside the column's own span the vertical miss is zero; outside it, the overhang
      dy = py < top ? py - top : (py > p.y ? py - p.y : 0);
      var rx = size * 0.54, ry = size * 0.32;
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
        this.bx = p.x; this.by = top; this.bs = size;
        return { x: p.x, y: top, i: i, s: size, hit: true };
      }
      var d = dx * dx + (py - top) * (py - top);
      if (d < bd) { bd = d; bi = i; bx = p.x; by = top; bs = size; }
    }
    this.bx = bx; this.by = by; this.bs = bs;
    return { x: bx, y: by, i: bi, s: bs, hit: false };
  };
  /* The hoard's box on screen, measured off the coins that are actually drawn rather than
   * guessed from the mound's formula. It gates every pointer event, so a guess that runs
   * short is another way for a press to do nothing — and the formula ran short at the top
   * of a tall pile and at the spill around its foot. Cached against the coin count, so the
   * cost is one pass per change of balance, not one per event. */
  Scene.prototype.hoardBox = function () {
    var n = Math.round(this.nShown);
    if (this._hbN === n && this._hb && this._hbW === this.cw && this._hbH === this.ch) return this._hb;
    var k = M.slotsFor(this.slots, n), s = this.slots.slot, p = {}, i;
    var box;
    if (k <= 0) {
      var c = this.cam.project(0, 0, PILE.z, {});
      box = { x0: c.x - c.s, x1: c.x + c.s, y0: c.y - c.s, y1: c.y + c.s * 0.8 };
    } else {
      var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (i = 0; i < k; i++) {
        this.cam.project(s[i].x * PILE.dx, s[i].y * PILE.dy, PILE.z + s[i].z * PILE.dz, p);
        var sz = p.s * s[i].size;
        var rise = s[i].cnt > 1 ? (s[i].cnt - 1) * sz * STACK_RISE : 0;
        if (p.x - sz * 0.6 < x0) x0 = p.x - sz * 0.6;
        if (p.x + sz * 0.6 > x1) x1 = p.x + sz * 0.6;
        if (p.y - rise - sz * 0.5 < y0) y0 = p.y - rise - sz * 0.5;
        if (p.y + sz * 0.4 > y1) y1 = p.y + sz * 0.4;
      }
      box = { x0: x0, x1: x1, y0: y0, y1: Math.min(this.ch, y1) };
    }
    this._hbN = n; this._hbW = this.cw; this._hbH = this.ch; this._hb = box;
    return box;
  };

  /* Where a point on the screen lands in the hoard's own ground space. The horizontal is
   * the projection inverted at the pile's depth; the vertical is read off the hoard's own
   * drawn box, because higher up the picture means further back in the room. It is only
   * ever used as the EPICENTRE of a disturbance, which has a generous radius, so it does
   * not need to be more exact than that — and unlike `pickSurface` it is O(1), which
   * matters because a hold asks for it many times a second. */
  Scene.prototype.groundAt = function (px, py) {
    var cam = this.cam, k = cam.k(PILE.z);
    var gx = (px - this.cw * 0.5) / (k * CAM.spread * cam.span);
    var h = this.hoardBox();
    var t = h.y1 > h.y0 ? (py - h.y0) / (h.y1 - h.y0) : 0.5;
    t = Math.min(1, Math.max(0, t));
    return { gx: gx, gz: (0.5 - t) * 1.6 * PILE.dz };
  };

  /* ---------- the frame ---------- */
  Scene.prototype.frame = function (now, dt) {
    this.resize();
    // v151 B: a theme equipped (or taken off) since the room was baked re-bakes the room and the deep layer once
    try { var tV = window.RIB_COSMETICS && window.RIB_COSMETICS.vaultTheme ? window.RIB_COSMETICS.vaultTheme() : null;
      this._tV151B = tV;
      if ((tV ? tV.id : '') !== (this._themeV151B || '')) { this.bakeRoom(); this.deepKey = ''; } } catch (e) {}
    var x = this.ctx;
    x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.room) {
      x.setTransform(1, 0, 0, 1, 0, 0);
      // a restrained push out of the opening: the room settles from 6% in as the door clears
      var push = this.doorT < 0.999 ? 1 + 0.06 * (1 - Math.max(0, (this.doorT - 0.55) / 0.45)) : 1;
      if (push > 1.0005) {
        var pw = this.cv.width * push, ph = this.cv.height * push;
        x.drawImage(this.room, (this.cv.width - pw) / 2, (this.cv.height - ph) / 2, pw, ph);
      } else x.drawImage(this.room, 0, 0);
      x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
    else { x.fillStyle = '#04070b'; x.fillRect(0, 0, this.cw, this.ch); }
    // the hoard eases toward its true count so a spend collapses rather than snapping
    if (this.nShown !== this.n) {
      var d = this.n - this.nShown;
      this.nShown += Math.abs(d) < 0.6 ? d : d * Math.min(1, dt / 90);
    }
    if (this.tidyTick) this.tidyTick(now);
    this.stepBodies(dt);
    this.drawHoard(x);
    this.stepFlyers(dt, this.onArrive);
    this.stepSparks(dt);
    this.drawFlyers(x);
    this.drawCore(x, now);
    this.drawSparks(x);
    this.drawDoor(x, now);
    this.drawAir(x, now);
    /* ADAPTIVE QUALITY. The worst case is the biggest hoard on a high-density phone with a
     * heap coming apart under the hand: ~270 live surface coins plus a couple of hundred
     * loose bodies, each of which draws its face AND its edge. Measured, that is about a
     * thousand drawImage calls a frame. Rather than let it fall, the scene watches its own
     * frame time and drops the edge pass and caps the bodies when it has to — the hoard
     * loses a little of its metal, and keeps its frame rate. */
    this.frames++;
    this.ft = this.ft == null ? dt : this.ft * 0.9 + dt * 0.1;
    /* The flip must NOT force a re-bake: the deep layer is 1700 sprites and re-drawing it
     * on the frame the scene decided it was struggling costs a 160ms stall, which is the
     * one thing the decision was made to avoid. It keeps whatever it last baked — a static
     * backdrop with or without its edge pass is not something the eye catches mid-slide —
     * and picks the new setting up on its next ordinary re-bake. */
    if (this.ft > 21 && !this.lite) this.lite = true;
    else if (this.ft < 14.5 && this.lite) this.lite = false;
    if (dt > 34) this.slow++; else if (this.slow > 0) this.slow -= 0.02;
  };
})();

/* ===== v137 THE PRESTIGE VAULT — the controller =====
 *
 * TRANSACTION RULES, which the rest of this file exists to serve:
 *
 *   The game's prestige upgrades are ATOMIC — `Yl(key)` debits the whole price and adds one
 *   level, in one call, and there is no partial-funding rule anywhere in the tree. So the
 *   vault does NOT invent one. `pending` is PP the player has poured but which has NOT been
 *   debited: it is a reservation held entirely inside this screen. The committed balance
 *   only ever changes inside `commit()`, which calls the game's own handler EXACTLY ONCE,
 *   guarded by `committed`.
 *
 *   * cancel / back / navigate away  -> pending is dropped. Nothing was ever debited.
 *   * reload mid-spend               -> the same, for free: nothing was written.
 *   * skip                           -> the same one commit, immediately.
 *   * a second tap on a funded core  -> `committed` refuses it.
 *
 *   Every number here is an integer. `pending` is clamped to min(cost, balance) so the
 *   balance can never go negative and the upgrade can never be granted for less than its
 *   price. Banked PP (v136) never reaches this screen — the bridge passes o.pp alone.
 */
(function () {
  'use strict';
  var M = window.__RIB_VAULT_MODEL, SC = window.__RIB_VAULT_SCENE;

  /* `rate` is the share of the upgrade's PRICE poured per second, so the throughput scales
   * with what is actually being bought: a 300 PP Apex node and an 8 PP first level both
   * take about the same time to pour, and neither needs a thousand taps. The ramp is slow
   * enough at the bottom that the player sees it climb rather than arriving at 16x. */
  var STAGES = [
    { at: 0,    mult: 1,  rate: 0.030, coins: 4 },
    { at: 420,  mult: 2,  rate: 0.060, coins: 9 },
    { at: 950,  mult: 4,  rate: 0.115, coins: 16 },
    { at: 1550, mult: 8,  rate: 0.230, coins: 26 },
    { at: 2300, mult: 16, rate: 0.460, coins: 40 }
  ];

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  function Vault() {
    this.open_ = false; this.built = false; this.raf = 0;
    this.balance = 0; this.pending = 0; this.target = null;
    this.committed = false; this.committing = false;
    this.holdFrom = 0; this.holding = false; this.stage = 0;
    this.depositQ = 0;
    this.sprites = null; this.scene = null;
    this.spend = 0;          // PP poured but not yet carried by a coin that has landed
    this.spendAcc = 0;
    this.doorSeen = false;
    try { this.doorSeen = localStorage.getItem('rib.vaultDoor.v137') === '1'; } catch (e) {}
  }

  /* ---------- the markup ---------- */
  Vault.prototype.build = function () {
    if (this.built) return;
    this.built = true;
    var r = el('div'); r.id = 'ribVault';
    r.innerHTML =
      '<canvas class="rv-stage" aria-hidden="true"></canvas>' +
      '<div class="rv-ui">' +
        '<div class="rv-top">' +
          '<button class="rv-btn rv-back" type="button">&lsaquo; BACK</button>' +
          '<div class="rv-title"><b>PRESTIGE VAULT</b><small>A LEGACY YOU CAN SEE</small></div>' +
          '<button class="rv-btn rv-sound" type="button" aria-label="Sound">&#9834;</button>' +
        '</div>' +
        '<div class="rv-bal" role="status" aria-live="polite">' +
          '<small>YOUR VAULT &middot; SPENDABLE PRESTIGE POINTS</small>' +
          '<b class="rv-num">0<span class="u">PP</span></b>' +
          '<em class="rv-sub"></em>' +
        '</div>' +
        '<div class="rv-mid"></div>' +
        '<div class="rv-tgt" hidden>' +
          '<div class="nm"></div><div class="lv"></div>' +
          '<div class="rv-track"><i></i></div>' +
          '<div class="num"></div>' +
        '</div>' +
        '<div class="rv-hint">TAP THE PILE TO INVEST &middot; HOLD TO POUR</div>' +
        '<div class="rv-act">' +
          '<button class="rv-btn rv-restock" type="button">&#8635; RESTOCK</button>' +
          '<button class="rv-btn rv-details" type="button">DETAILS</button>' +
          '<button class="rv-btn rv-skipbtn" type="button" hidden>SKIP ANIMATION</button>' +
          '<button class="rv-btn go rv-choose" type="button" hidden>CHOOSE AN UPGRADE</button>' +
        '</div>' +
      '</div>' +
      '<div class="rv-mult" aria-hidden="true">&times;1</div>' +
      '<div class="rv-panel"><h4>WHAT IS IN THE VAULT</h4><div class="rv-dens"></div>' +
        '<div class="rv-note"></div>' +
        '<div style="height:10px"></div>' +
        '<button class="rv-btn rv-closepanel" type="button" style="width:100%">CLOSE</button></div>' +
      '<div class="rv-modal"><div class="rv-card">' +
        '<div class="ttl"></div><div class="bd"></div>' +
        '<div class="row"><button class="rv-btn rv-no" type="button">CANCEL</button>' +
        '<button class="rv-btn go rv-yes" type="button">CONFIRM</button></div></div></div>';
    document.body.appendChild(r);
    this.root = r;
    var $ = function (s) { return r.querySelector(s); };
    this.cv = $('.rv-stage'); this.elNum = $('.rv-num'); this.elSub = $('.rv-sub');
    this.elTgt = $('.rv-tgt'); this.elHint = $('.rv-hint'); this.elMult = $('.rv-mult');
    this.elBar = $('.rv-track i'); this.elDens = $('.rv-dens'); this.elNote = $('.rv-note');
    this.elSkip = $('.rv-skipbtn'); this.elChoose = $('.rv-choose'); this.elSound = $('.rv-sound');
    this.elRestock = $('.rv-restock');
    this.elModal = $('.rv-modal'); this.elCardT = $('.rv-card .ttl'); this.elCardB = $('.rv-card .bd');

    var self = this;
    $('.rv-back').onclick = function () { self.close('back'); };
    $('.rv-details').onclick = function () { self.root.classList.toggle('panel'); self.fillPanel(); };
    $('.rv-closepanel').onclick = function () { self.root.classList.remove('panel'); };
    this.elSkip.onclick = function () { self.skip(); };
    this.elRestock.onclick = function () { self.restock(); };
    this.elChoose.onclick = function () { self.close('choose'); };
    this.elSound.onclick = function () {
      var on = window.__RIB_VAULT_AUDIO && window.__RIB_VAULT_AUDIO.toggle();
      self.elSound.classList.toggle('off', !on);
      self.elSound.innerHTML = on ? '&#9834;' : '&#9834;&#818;';
    };
    $('.rv-no').onclick = function () { self.root.classList.remove('modal'); self.modalNo && self.modalNo(); };
    $('.rv-yes').onclick = function () { self.root.classList.remove('modal'); self.modalYes && self.modalYes(); };
    this.bindPointer();
    window.addEventListener('resize', function () { self.scene && self.scene.resize(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) self.release();          // a backgrounded app must not keep pouring
    });
  };

  /* ---------- tap and hold ----------
   * The listeners live on the canvas and only inside the hoard's own box, so a hold never
   * swallows a scroll, the BACK button or the details drawer. */
  Vault.prototype.bindPointer = function () {
    var self = this, id = null;
    function inHoard(e) {
      if (!self.scene) return false;
      var b = self.cv.getBoundingClientRect();
      var x = e.clientX - b.left, y = e.clientY - b.top;
      var h = self.scene.hoardBox();
      return x >= h.x0 - 24 && x <= h.x1 + 24 && y >= h.y0 - 16 && y <= h.y1 + 16;
    }
    this.cv.addEventListener('pointerdown', function (e) {
      if (id !== null || !inHoard(e)) return;
      id = e.pointerId;
      try { self.cv.setPointerCapture(id); } catch (_) {}
      var b = self.cv.getBoundingClientRect();
      self.press(e.clientX - b.left, e.clientY - b.top);
      e.preventDefault();
    }, { passive: false });
    var up = function (e) {
      if (id === null || (e.pointerId != null && e.pointerId !== id)) return;
      try { self.cv.releasePointerCapture(id); } catch (_) {}
      id = null; self.release();
    };
    this.cv.addEventListener('pointerup', up);
    this.cv.addEventListener('pointercancel', up);
    this.cv.addEventListener('pointermove', function (e) {
      if (id === null) return;
      var b = self.cv.getBoundingClientRect();
      var px = e.clientX - b.left, py = e.clientY - b.top;
      var from = self.touch || { x: px, y: py };
      self.touch = { x: px, y: py };
      /* GESTURE DISAMBIGUATION. A press on the hoard is an INVEST hold. A press that then
       * travels is a DRAG of the coin under the finger. The pour is not delayed waiting to
       * find out — the first tap pays immediately, because a laggy tap is worse than an
       * extra coin — but the moment the finger has moved far enough the hold is released
       * and the gesture becomes a drag. Nothing is ever charged twice for it. */
      if (!self.dragging) {
        var d = Math.abs(px - self.pressAt.x) + Math.abs(py - self.pressAt.y);
        if (d > 13) { self.release(); self.startDrag(px, py); }
      }
      if (self.dragging) self.moveDrag(px, py, px - from.x, py - from.y);
    });
    window.addEventListener('blur', function () { self.release(); });
  };

  Vault.prototype.press = function (x, y) {
    this.touch = { x: x, y: y };
    this.pressAt = { x: x, y: y };
    this.dragging = null;
    this.holding = true; this.holdFrom = performance.now(); this.stage = 0;
    this.haptic(8);
    if (!this.target) { this.bumpHint('PICK AN UPGRADE TO INVEST IN'); this.pop(x, y, true); return; }
    if (this.remaining() <= 0) { this.bumpHint('FULLY FUNDED &middot; RELEASE TO CONFIRM'); return; }
    if (this.balance - this.pending <= 0) { this.bumpHint('NOT ENOUGH PRESTIGE POINTS'); return; }
    this.pour(this.tapChunk(), true);
  };
  /* THE THROW. `fling` is a VELOCITY in ground units per millisecond, measured against the
   * clock — not a per-event displacement. It was the latter, which is why a coin left the
   * hand at roughly the pointer's sample rate times its real speed and was through the wall
   * inside a frame. A pointermove stream is 60-120Hz and irregular, so the delta is divided
   * by the time that actually elapsed, smoothed, and clamped; the vertical component is
   * clamped hardest, because that is the one that throws a coin out of the room. */
  var THROW_V = 0.0026;          // ground units per ms — about a room's width a second
  var THROW_VY = 0.0016;
  var PLOUGH_STEP = 0.055;       // how far a held coin travels before it shoves again
  var PLOUGH_K = 0.60;           // ...and how hard. Lighter than a lift: it is a graze

  Vault.prototype.endDrag = function () {
    if (!this.dragging) return;
    var o = this.dragging; this.dragging = null;
    o.held = false; o.sleep = false;
    var k = 0.62 / o.m;                        // a heavier coin carries less of the hand
    var vx = (this.flingX || 0) * k, vy = (this.flingY || 0) * k, vz = (this.flingZ || 0) * k;
    var vh = Math.sqrt(vx * vx + vz * vz);
    if (vh > THROW_V) { vx *= THROW_V / vh; vz *= THROW_V / vh; }
    o.vx = vx; o.vz = vz;
    o.vy = Math.max(-THROW_VY, Math.min(THROW_VY, vy));
    o.vs = o.vx * 1.4;
    o.travel = 0; o.energy = 0;              // it was placed, not shaken loose
    this.flingX = this.flingY = this.flingZ = 0;
    this.haptic(5);
  };

  /* pick up the coin under the finger */
  Vault.prototype.startDrag = function (px, py) {
    var s = this.scene;
    var pick = s.pickSurface(px, py);
    if (pick.i < 0) return;
    /* A DRAG IS NOT A HOLD, and the invariant has to hold however startDrag is reached.
     * The pointer handler releases the hold before it calls this, but nothing MADE that
     * true — and a hold left standing keeps the pour running and (since v137 F) keeps
     * shaking the heap, with the finger no longer on it. It ends here by construction.
     * Not `release()`: that would commit a fully-funded upgrade, and starting to drag a
     * coin is not a decision to buy. */
    this.holding = false; this.stage = 0;
    this.elMult && this.elMult.classList.remove('on');
    var o = s.wake(pick.i);
    if (!o) return;
    o.held = true; o.sleep = false; o.vx = o.vy = o.vz = 0;
    o._ploughV137 = null; o.shakenV137 = 0;    // your hand, not the heap: no leash
    // lifting a coin out opens a gap, and the coins around it give way into it. The coin in
    // the HAND is not one of them: `disturb` reaches its own slot too, and a coin that is
    // put back down still carrying the lift's energy skates off down the slope instead of
    // staying where it was placed. So it is cleared AFTER the shake, not before.
    s.disturb(o.gx, o.gz, 1);
    o.energy = 0; o.travel = 0;
    this.dragging = o;
    this.flingX = this.flingY = this.flingZ = 0;
    this.dragT = performance.now();
    this.haptic(9);
    if (window.__RIB_VAULT_AUDIO) window.__RIB_VAULT_AUDIO.coin(M.denOf(s.slots.slot[pick.i], s.mix), 0);
  };

  /* The coin follows the hand, but it does not STICK to it: it lags by its own weight,
   * which is most of what makes a drag feel like holding something. The lag is a time
   * constant rather than a per-event fraction, so a 120Hz pointer does not whip the coin
   * along twice as fast as a 60Hz one. */
  Vault.prototype.moveDrag = function (px, py, dx, dy) {
    var o = this.dragging, s = this.scene;
    if (!o) return;
    var now = performance.now();
    var dt = Math.max(6, Math.min(80, now - (this.dragT || now - 16)));
    this.dragT = now;
    var cam = s.cam;
    var k = cam.k(SC.PILE.z + o.gz);
    var tau = 52 * Math.pow(o.m, 0.5);
    var lag = 1 - Math.exp(-dt / tau);
    var tgx = (px - s.cw * 0.5) / (k * 0.62 * cam.span);
    var lift = (s.cam.project(o.gx, 0, SC.PILE.z + o.gz, {}).y - py) / (k * 0.34 * s.ch);
    var ox = o.gx, oy = o.gy;
    o.gx += (tgx - o.gx) * lag;
    o.gy += (Math.max(s.surfaceAt(o.gx, o.gz) - 0.02, lift) - o.gy) * lag;
    o.spin += dx * 0.004;
    /* v137 F: DRAGGING PLOUGHS. A coin hauled across the top of a heap does not pass
     * through it — it shoves what it crosses out of the way and leaves a furrow. The lift
     * already opens a gap where the coin came from; this is the rest of the gesture. It
     * fires on DISTANCE TRAVELLED rather than per move event, so a slow drag disturbs the
     * same ground once and a fast one leaves an evenly spaced wake instead of a single
     * hammer blow wherever the pointer happened to sample. */
    var pl = o._ploughV137;
    if (!pl || Math.abs(o.gx - pl.x) + Math.abs(o.gz - pl.z) > PLOUGH_STEP) {
      o._ploughV137 = { x: o.gx, z: o.gz };
      if (pl) s.disturb(o.gx, o.gz, PLOUGH_K);   // not on the first sample — that is the lift
    }
    var ex = Math.exp(-dt / 70);               // EMA on the MEASURED velocity, not on a delta
    this.flingX = ((o.gx - ox) / dt) * (1 - ex) + (this.flingX || 0) * ex;
    this.flingY = ((o.gy - oy) / dt) * (1 - ex) + (this.flingY || 0) * ex;
  };

  Vault.prototype.release = function () {
    this.endDrag();
    if (!this.holding) return;
    this.holding = false; this.stage = 0;
    this.elMult && this.elMult.classList.remove('on');
    if (this.target && this.remaining() <= 0 && !this.committed) this.commit();
  };

  Vault.prototype.tapChunk = function () {
    if (!this.target) return 0;
    return Math.max(1, Math.round(this.target.cost * 0.02));
  };
  Vault.prototype.remaining = function () {
    return this.target ? Math.max(0, this.target.cost - this.pending) : 0;
  };
  Vault.prototype.spendable = function () { return Math.max(0, this.balance - this.pending); };

  /* pour n PP into the reservation, and throw the coins that carry it */
  Vault.prototype.pour = function (n, tap) {
    if (!this.target || this.committed) return 0;
    n = Math.min(Math.round(n), this.remaining(), this.spendable());
    if (n <= 0) return 0;
    this.pending += n;
    this.scene.setBalance(this.balance - this.pending, true);
    var coins = tap ? 1 : 1;
    for (var i = 0; i < coins; i++) this.throwCoin(n / coins);
    this.paint();
    if (window.__RIB_VAULT_AUDIO) window.__RIB_VAULT_AUDIO.coin(this.lastDen, this.stage);
    if (this.remaining() <= 0 && !this.holding) this.commit();
    return n;
  };

  Vault.prototype.throwCoin = function (worth) {
    var t = this.touch || { x: this.scene.cw / 2, y: this.scene.ch * 0.72 };
    var pick = this.scene.pickSurface(t.x + (Math.random() - 0.5) * 40,
                                      t.y + (Math.random() - 0.5) * 28);
    /* The coin in the air is the coin that left the hoard — its face is read off the slot
     * the pick actually landed on, not off the size of the chunk. A bronze coin rising out
     * of a silver hoard is the tell that the flight is decorative, and it is the one thing
     * this whole mechanic is supposed to avoid. */
    var den = pick.i >= 0 ? M.denOf(this.scene.slots.slot[pick.i], this.scene.mix)
                          : this.denFor(worth);
    this.lastDen = den;
    this.scene.launch(den, pick, { size: pick.s, dur: 520 });
    this.scene.burst(pick.x, pick.y, den);
  };
  /* the face a flying coin wears is the biggest one its worth can actually buy */
  Vault.prototype.denFor = function (worth) {
    if (worth >= 1e9) return 'blue';
    if (worth >= 1e6) return 'gold';
    if (worth >= 1e3) return 'silver';
    return 'bronze';
  };

  /* ---------- the commit: ONE call, ever ---------- */
  Vault.prototype.commit = function () {
    if (this.committed || this.committing || !this.target) return;
    if (this.pending < this.target.cost) return;
    this.committing = true;
    var ok = false;
    try { ok = this.onCommit ? this.onCommit(this.target, this.target.cost) !== false : false; }
    catch (e) { console.warn('[vault] commit failed', e); ok = false; }
    this.committing = false;
    if (!ok) {                       // the game refused: give the reservation back, debit nothing
      this.pending = 0;
      this.scene.setBalance(this.balance, true);
      this.bumpHint('THE UPGRADE COULD NOT BE PURCHASED');
      this.paint();
      return;
    }
    this.committed = true;
    this.balance = Math.max(0, this.balance - this.target.cost);
    this.pending = 0;
    this.scene.setBalance(this.balance, true);
    this.scene.coreState = 'complete';
    this.scene.corePulse = 1.3;
    this.celebrate();
    this.paint();
  };

  Vault.prototype.skip = function () {
    if (!this.target || this.committed) return;
    var need = this.remaining();
    if (need > this.spendable()) { this.bumpHint('NOT ENOUGH PRESTIGE POINTS'); return; }
    this.pending += need;
    this.scene.setBalance(this.balance - this.pending, false);
    this.commit();
  };

  Vault.prototype.celebrate = function () {
    var s = this.scene, c = s.corePoint(), i;
    if (window.__RIB_VAULT_AUDIO) window.__RIB_VAULT_AUDIO.complete();
    this.haptic([12, 40, 24]);
    if (!s.reduced) for (i = 0; i < 90; i++) {
      var a = Math.random() * Math.PI * 2, sp = 0.06 + Math.random() * 0.36;
      s.sparks.push({ x: c.x, y: c.y, vx: Math.cos(a) * sp * s.cw, vy: Math.sin(a) * sp * s.cw - s.ch * 0.10,
        life: 1 + Math.random(), den: Math.random() < 0.25 ? 'blue' : 'gold', r: 1.4 + Math.random() * 3 });
    }
    this.bumpHint('UPGRADE UNLOCKED');
  };

  /* ---------- earning: coins arrive and the pile grows ---------- */
  Vault.prototype.deposit = function (amount, done) {
    amount = Math.max(0, Math.round(amount));
    if (!this.scene || amount <= 0) { done && done(); return; }
    var self = this, s = this.scene;
    var from = this.balance;
    this.balance = from + amount;
    var t0 = performance.now(), dur = s.reduced ? 220 : 1500;
    if (window.__RIB_VAULT_AUDIO) window.__RIB_VAULT_AUDIO.payout();
    this.depositTick = function (now) {
      var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      s.setBalance(from + amount * e, true);
      self.elNum.innerHTML = M.commas(from + amount * e) + '<span class="u">PP</span>';
      if (!s.reduced && Math.random() < 0.5) {
        var den = self.denFor(amount / 14);
        var f = s.launch(den, { x: s.cw * (0.2 + Math.random() * 0.6), y: -40 },
          { dur: 900, trail: false });
        if (f) {                                     // fall INTO the hoard, not to the core
          var land = s.pickSurface(s.cw * (0.3 + Math.random() * 0.4), s.ch * 0.70);
          f.x1 = land.x; f.y1 = land.y;
          f.cx = (f.x0 + f.x1) / 2; f.cy = s.ch * 0.18;
        }
      }
      if (k >= 1) { self.depositTick = null; self.paint(); done && done(); }
    };
  };

  window.__RIB_VAULT_CTRL = { Vault: Vault, STAGES: STAGES, el: el, esc: esc };
})();

/* ===== v137 THE PRESTIGE VAULT — open, paint, run ===== */
(function () {
  'use strict';
  var M = window.__RIB_VAULT_MODEL, SC = window.__RIB_VAULT_SCENE, C = window.__RIB_VAULT_CTRL;
  var Vault = C.Vault, STAGES = C.STAGES, esc = C.esc;

  function Sprites() { this.img = {}; this.failed = []; }
  Sprites.prototype.load = function (names) {
    var self = this;
    return Promise.all(names.map(function (n) {
      return new Promise(function (res) {
        var im = new Image();
        im.onload = function () { self.img[n] = im; res(); };
        im.onerror = function () { self.failed.push(n); res(); };
        im.src = (window.__RIB_ASSET ? window.__RIB_ASSET('vault/' + n + '.webp')
                                     : './public/vault/' + n + '.webp');
      });
    })).then(function () { return self; });
  };
  Sprites.prototype.get = function (n) {
    var im = this.img[n] || null;
    // v151 B: a vault theme's coins — a tinted copy, cached per theme; the classic hoard gets the sprite itself
    if (im && n.indexOf('coin_') === 0 && window.RIB_COSMETICS && window.RIB_COSMETICS.vaultTint) { try { var t = window.RIB_COSMETICS.vaultTint(im, n); if (t) return t; } catch (e) {} }
    return im;
  };

  Vault.prototype.haptic = function (p) {
    try { if (navigator.vibrate && this.hapticOn !== false) navigator.vibrate(p); } catch (e) {}
  };
  Vault.prototype.bumpHint = function (h) {
    if (!this.elHint) return;
    this.elHint.innerHTML = h;
    this.elHint.classList.add('hot');
    clearTimeout(this._ht);
    var self = this;
    this._ht = setTimeout(function () {
      self.elHint.classList.remove('hot');
      self.elHint.innerHTML = self.idleHint();
    }, 1500);
  };
  Vault.prototype.idleHint = function () {
    if (this.committed) return 'UPGRADE UNLOCKED';
    if (!this.target) return 'YOUR WEALTH, WHERE YOU CAN SEE IT';
    if (this.target.cost > this.balance) return 'NOT ENOUGH &mdash; ' + M.commas(this.target.cost - this.balance) + ' PP SHORT';
    return 'TAP THE PILE TO INVEST &middot; HOLD TO POUR';
  };
  Vault.prototype.pop = function (x, y) {
    if (this.scene) this.scene.burst(x, y, 'gold');
  };

  /* ---------- painting the interface ---------- */
  Vault.prototype.paint = function () {
    if (!this.built) return;
    var shown = Math.max(0, this.balance - this.pending);
    this.elNum.innerHTML = M.commas(shown) + '<span class="u">PP</span>';
    var sub = [];
    if (this.banked > 0) sub.push('&#127974; <b>' + M.commas(this.banked) + ' PP</b> banked &middot; paid when this career ends');
    sub.push(M.tierName(shown).toUpperCase());
    this.elSub.innerHTML = sub.join(' &nbsp;&middot;&nbsp; ');
    var t = this.target;
    this.elTgt.hidden = !t;
    this.elSkip.hidden = !t || this.committed;
    this.elChoose.hidden = !!t && !this.committed;
    this.elChoose.textContent = this.committed ? 'BACK TO THE TREE' : 'CHOOSE AN UPGRADE';
    if (t) {
      var p = this.committed ? 1 : Math.max(0, Math.min(1, this.pending / t.cost));
      this.elTgt.querySelector('.nm').textContent = t.name;
      this.elTgt.querySelector('.lv').textContent =
        (this.committed ? 'NOW LEVEL ' + (t.level + 1) : 'LEVEL ' + t.level + ' → ' + (t.level + 1)) +
        (t.max ? ' · MAX ' + t.max : '');
      this.elBar.style.width = (p * 100).toFixed(2) + '%';
      this.elTgt.classList.toggle('done', this.committed || p >= 1);
      this.elTgt.querySelector('.num').innerHTML =
        this.committed ? '<b>PURCHASED</b> &middot; ' + M.commas(t.cost) + ' PP'
          : '<b>' + M.commas(this.pending) + '</b> / ' + M.commas(t.cost) + ' PP';
      this.scene.progress = p;
      this.scene.coreState = this.committed ? 'complete'
        : p >= 1 ? 'charged' : (p > 0 || this.holding) ? 'hot' : 'idle';
    } else {
      this.scene.progress = null;
      this.scene.coreState = 'idle';
    }
    this.elHint.innerHTML = this.idleHint();
  };

  Vault.prototype.fillPanel = function () {
    var shown = Math.max(0, this.balance - this.pending);
    var b = M.breakdown(shown), rows = '';
    M.DEN.slice().reverse().forEach(function (d) {
      rows += '<div class="rv-den">' +
        '<img alt="" src="' + (window.__RIB_ASSET ? window.__RIB_ASSET('vault/coin_' + d + '_face.webp') : './public/vault/coin_' + d + '_face.webp') + '">' +
        '<div class="d"><b>' + M.DEN_LABEL[d] + '</b><small>' + M.commas(M.DEN_VALUE[d]) + ' PP EACH</small></div>' +
        '<div class="n">' + M.commas(b[d]) + '</div></div>';
    });
    this.elDens.innerHTML = rows;
    var n = Math.round(this.scene.nShown);
    this.elNote.innerHTML =
      'Your balance is <b>' + M.commas(shown) + ' PP</b> &mdash; one currency, shown as four faces. ' +
      'The vault is drawing <b>' + n + '</b> coins to stand for it (' + M.tierName(shown).toLowerCase() +
      '), so at large balances one drawn coin represents more than one real one; the exact counts are above. ' +
      (this.banked > 0 ? 'Your <b>' + M.commas(this.banked) + ' PP</b> of banked points are not in this room yet &mdash; ' +
        'they are paid into the vault when the current career settles.' : '');
  };

  /* ---------- the hold ---------- */
  /* v137 F: A HOLD SHAKES THE MONEY.
   *
   * Pressing on a heap of coins and having it sit there perfectly still is the single most
   * inert thing this screen did. A hold now disturbs the hoard under the finger on its own
   * clock, and harder as the multiplier climbs — at x16 the pile is visibly working, which
   * is also the clearest read you get that the pour has gone up a gear. It runs whether or
   * not an upgrade is selected, because pressing the money should always move the money.
   *
   * It is rate-limited rather than run per frame: `disturb` wakes dozens of coins and they
   * each need a few hundred milliseconds to spend the energy they were handed, so shaking
   * at 60Hz would just pin every coin at full energy and the heap would boil. */
  var SHAKE_MS = 95;
  var SHAKE_K = [0.40, 0.62, 0.86, 1.15, 1.50];   // by stage: tap, x2, x4, x8, x16

  Vault.prototype.tick = function (now, dt) {
    if (this.depositTick) this.depositTick(now);
    if (this.holding && !this.dragging && this.scene && this.touch &&
        now - (this._shakeAt || 0) > SHAKE_MS) {
      this._shakeAt = now;
      var g = this.scene.groundAt(this.touch.x, this.touch.y);
      this.scene.disturb(g.gx, g.gz, SHAKE_K[Math.min(SHAKE_K.length - 1, this.stage || 0)]);
    }
    if (!this.holding || !this.target || this.committed) return;
    var held = now - this.holdFrom, st = 0, i;
    for (i = 0; i < STAGES.length; i++) if (held >= STAGES[i].at) st = i;
    if (st !== this.stage) {
      this.stage = st;
      this.haptic(6);
      if (st > 0) {
        this.elMult.textContent = '×' + STAGES[st].mult;
        this.elMult.classList.add('on');
        if (window.__RIB_VAULT_AUDIO) window.__RIB_VAULT_AUDIO.stage(STAGES[st].mult);
      }
    }
    if (st === 0) return;                       // the first tap already paid; stage 0 waits
    var S = STAGES[st];
    this.spendAcc += this.target.cost * S.rate * (dt / 1000);
    var whole = Math.floor(this.spendAcc);
    if (whole >= 1) {
      this.spendAcc -= whole;
      var per = Math.max(1, Math.round(whole / Math.max(1, Math.round(S.coins * dt / 1000))));
      var left = this.pour(whole, false);
      // the stream: more coins in the air the harder it pours
      var extra = Math.min(6, Math.round(S.coins * dt / 1000));
      for (var k = 1; k < extra && left > 0; k++) this.throwCoin(left / extra);
    }
    if (this.remaining() <= 0 || this.spendable() <= 0) this.release();
  };

  /* RESTOCK. Every coin that has been dragged, shaken or thrown flies back to the slot it
   * was built in — the hoard's layout is deterministic, so "tidy" is just clearing the
   * displacement map, and the flight home is the animation of it. Press it on an already
   * tidy hoard and it RE-POURS instead: a fresh seed, a visibly different heap of exactly
   * the same money. Neither one touches a single Prestige Point. */
  Vault.prototype.restock = function () {
    var s = this.scene; if (!s) return;
    var n = s.bodyCount();
    if (n > 0) {
      s.tidy();
      this.bumpHint('RESTOCKING &mdash; ' + n + ' COIN' + (n === 1 ? '' : 'S') + ' BACK IN PLACE');
      if (window.__RIB_VAULT_AUDIO) window.__RIB_VAULT_AUDIO.payout();
      this.haptic([6, 30, 6]);
      return;
    }
    s.reseed();
    this.bumpHint('THE VAULT IS RESTACKED');
    if (window.__RIB_VAULT_AUDIO) window.__RIB_VAULT_AUDIO.stage(4);
    this.haptic(10);
  };

  /* ---------- open / close ---------- */
  Vault.prototype.open = function (opts) {
    opts = opts || {};
    this.build();
    var self = this;
    this.balance = Math.max(0, Math.round(opts.balance || 0));
    this.banked = Math.max(0, Math.round(opts.banked || 0));
    this.target = opts.upgrade || null;
    this.onCommit = opts.onCommit || null;
    this.onClose = opts.onClose || null;
    this.hapticOn = opts.haptics !== false;
    this.pending = 0; this.committed = false; this.committing = false;
    this.spendAcc = 0; this.holding = false; this.stage = 0;
    this.root.classList.remove('panel', 'modal');
    this.open_ = true;
    this.root.classList.add('up');
    document.documentElement.style.overflow = 'hidden';
    try { if (window.RIB_COSMETICS && window.RIB_COSMETICS.vaultDress) window.RIB_COSMETICS.vaultDress(this.root); } catch (e) {}   // v151 B: the theme's motes

    var boot = this.sprites ? Promise.resolve(this.sprites)
      : new Sprites().load(M.SPRITE_NAMES).then(function (s) { self.sprites = s; return s; });
    return boot.then(function (sp) {
      if (!self.scene) self.scene = new SC.Scene(self.cv, sp);
      self.scene.resize();
      self.scene.setBalance(self.balance, false);
      self.scene.flyers.length = 0; self.scene.sparks.length = 0;
      self.scene.sleepAll(); self.scene.tidyTick = null;
      self.scene.doorT = (self.doorSeen || opts.skipDoor || self.scene.reduced) ? 1 : 0;
      self.root.classList.remove('opening');
      if (self.scene.doorT < 1) self.runDoor();
      if (window.__RIB_VAULT_AUDIO) {
        window.__RIB_VAULT_AUDIO.arm(opts.sound !== false);
        self.elSound.classList.toggle('off', !window.__RIB_VAULT_AUDIO.on());
      }
      self.paint();
      self.loop();
      return self;
    });
  };

  /* the opening, once per install unless the player asks for it again. A repeat visit
   * walks straight into the room — the brief's "support skipping repeat openings". */
  Vault.prototype.runDoor = function () {
    var s = this.scene, t0 = performance.now(), self = this;
    if (window.__RIB_VAULT_AUDIO) window.__RIB_VAULT_AUDIO.door();
    this.doorTick = function (now) {
      var k = Math.min(1, (now - t0) / 2300);
      s.doorT = k < 0.55 ? k * 0.55 / 0.55 * 0.55 : 0.55 + Math.pow((k - 0.55) / 0.45, 0.8) * 0.45;
      if (k >= 1) { s.doorT = 1; self.doorTick = null; self.doorSeen = true;
        try { localStorage.setItem('rib.vaultDoor.v137', '1'); } catch (e) {} }
    };
    this.elHint.innerHTML = 'OPENING&hellip;';
    var skip = function () { if (self.doorTick) { s.doorT = 1; self.doorTick = null; self.doorSeen = true;
      try { localStorage.setItem('rib.vaultDoor.v137', '1'); } catch (e) {} } };
    this.cv.addEventListener('pointerdown', skip, { once: true });
  };

  Vault.prototype.loop = function () {
    var self = this, last = performance.now();
    cancelAnimationFrame(this.raf);
    var step = function (now) {
      if (!self.open_) return;
      var dt = Math.min(64, now - last); last = now;
      if (self.doorTick) self.doorTick(now);
      self.tick(now, dt);
      self.scene.frame(now, dt);
      self.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  };

  Vault.prototype.close = function (why) {
    if (!this.open_) return;
    this.release();
    this.open_ = false;
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.doorTick = null; this.depositTick = null;
    this.dragging = null;
    if (this.scene) { this.scene.sleepAll(); this.scene.tidyTick = null; }
    this.pending = 0;                       // a reservation never survives the screen
    this.spendAcc = 0;
    if (this.scene) { this.scene.flyers.length = 0; this.scene.sparks.length = 0; }
    if (window.__RIB_VAULT_AUDIO) window.__RIB_VAULT_AUDIO.stop();
    this.root.classList.remove('up', 'panel', 'modal');
    document.documentElement.style.overflow = '';
    var cb = this.onClose; this.onClose = null;
    if (cb) try { cb(why || 'back', this.committed, this.target); } catch (e) { console.warn('[vault]', e); }
  };

  /* ---------- the hook ---------- */
  var V = new Vault();
  window.__RIB_VAULT = {
    open: function (o) { return V.open(o); },
    close: function (w) { V.close(w); },
    isOpen: function () { return V.open_; },
    deposit: function (n, done) { V.deposit(n, done); },
    setBalance: function (n) { V.balance = Math.max(0, Math.round(n)); if (V.scene) V.scene.setBalance(V.balance - V.pending, true); V.paint(); },
    version: 'v137'
  };
  window.__RIB_VAULT_DEV = {
    v: V,
    scene: function () { return V.scene; },
    model: M,
    state: function () {
      return { open: V.open_, balance: V.balance, pending: V.pending, committed: V.committed,
        target: V.target ? { key: V.target.key, cost: V.target.cost } : null,
        n: V.scene ? Math.round(V.scene.nShown) : 0,          // COINS on screen
        slots: V.scene ? M.slotsFor(V.scene.slots, Math.round(V.scene.nShown)) : 0,
        budget: V.scene ? V.scene.slots.coins : 0,
        stacks: V.scene ? V.scene.slots.slot.filter(function (q) { return q.cnt > 1 }).length : 0,
        piles: V.scene ? V.scene.slots.slot.length : 0,
        flyers: V.scene ? V.scene.flyers.filter(function (f) { return f.live; }).length : 0,
        doorT: V.scene ? V.scene.doorT : 1,
        stage: V.stage, holding: V.holding,
        bodies: V.scene ? V.scene.bodyCount() : 0,
        dragging: !!V.dragging,
        missing: V.sprites ? V.sprites.failed.slice() : null };
    },
    pour: function (n) { return V.pour(n, true); },
    hold: function (on) { if (on) { V.touch = { x: V.scene.cw / 2, y: V.scene.ch * 0.74 }; V.press(V.scene.cw / 2, V.scene.ch * 0.74); } else V.release(); },
    skip: function () { V.skip(); },
    drag: function (x, y) { V.press(x, y); V.startDrag(x, y); return !!V.dragging },
    dragTo: function (x, y) { V.moveDrag(x, y, 2, 2) },
    drop: function () { V.endDrag() },
    disturb: function (gx, gz, k) { return V.scene.disturb(gx, gz, k == null ? 1 : k) },
    fling: function () { return { x: V.flingX || 0, y: V.flingY || 0 } },
    restock: function () { V.restock() },
    bodies: function () { return V.scene._bodies || {} }
  };
})();

/* ===== v137 B THE MONEY IS LOOSE — drag, the heap's answer, and the tidy-up =====
 *
 * The hoard's layout is a deterministic seeded slot list and that has to stay true: it is
 * what makes a balance draw the same room twice and what makes spending take coins off the
 * top without reshuffling the rest. So nothing here MOVES a slot. A disturbed coin gets a
 * row in a sparse DISPLACEMENT map — its own position, velocity and sleep state — and the
 * renderer draws it there instead. Clear the map and the hoard is exactly the hoard again,
 * which is what RESTOCK does.
 *
 * Only coins in the live surface band can be disturbed: the deep layer is a baked canvas
 * and moving one of its coins would cost a re-bake per frame. That is also the honest
 * limit — you can push the money on top of the pile around, not the money underneath it.
 *
 * The bodies are capped (`MAX_BODIES`) and they SLEEP: a settled coin costs one lookup a
 * frame, so a hoard that has been shaken and left alone is as cheap as one that has not.
 *
 * Gravity is the mound's own surface. `surfaceAt(gx, gz)` is the height the heap has at a
 * point for the current fullness — the same MOUND functions the slots were built from — so
 * a coin slides DOWN THE HEAP it came off and comes to rest on it, rather than falling
 * through it to the floor.
 */
(function () {
  'use strict';
  var M = window.__RIB_VAULT_MODEL, S = window.__RIB_VAULT_SCENE, C = window.__RIB_VAULT_CTRL;
  var Scene = S.Scene, PILE = S.PILE, MOUND = M.MOUND, Vault = C.Vault;

  var MAX_BODIES = 420;          /* an intelligently bounded number of moving objects. A
   * settled shard costs a lookup and a draw, which is what a hoard slot costs anyway, so
   * the ceiling is about draw calls rather than about physics — and it has to be well clear
   * of the woken column count or the last towers to reach the wall cannot come apart and
   * stand there intact while everything around them has collapsed. */
  var SLEEP_V = 0.00035;         // ground units per ms below which a coin is asleep
  var GRAV = 0.0000320;          // ground units per ms squared — coins FALL, they do not drift
  var BOUNCE = 0.34, ROLL = 0.982;
  var MU = 0.42;                 // static friction: metal on metal, and it is most of this
  /* v137 F: the mound is 1.5x steeper than the one this was tuned against (a narrower
   * footprint under a taller peak), and the slope term reads that gradient directly — so
   * the same disturbance threw coins about twice as far as it used to, right across the
   * heap. The constant comes down by the same factor it went up by, which leaves the FEEL
   * where v137 E put it and the travel where the checks assert it. */
  var SLOPE_K = 1.20;            // how hard the slope pulls a coin that has been shaken loose
  var STILL_FRAMES = 9;          // consecutive quiet frames before a coin is allowed to sleep

  /* THE HEAP ANSWERS WHEN YOU TOUCH IT.
   *
   * There is no tilt any more. The only thing that moves this hoard is you moving a coin in
   * it, and what happens then is local: the coins right around the one you lifted give way
   * and slide a little way down the slope, the ones further off barely twitch, and the ones
   * on a flat shoulder hardly move at all because there is nowhere for them to go. Each
   * disturbed coin gets an ENERGY, and energy is the only thing that lets the slope act on
   * it — so the heap is still stable at rest, it just has a short memory of being touched.
   *
   * Every number here is small on purpose. The ask was that they move a LITTLE. */
  var DIST_R = 0.30;             // how far from the lifted coin the heap notices, in ground units
  var DIST_E = 0.85;             // energy at the centre of a disturbance
  var E_DECAY = 260;             // ms for that energy to fall by 1/e
  var E_FLOOR = 0.05;            // below this it is over
  /* HOW FAR ONE SHAKEN COIN IS ALLOWED TO SLIDE, and this is the whole of "some a lot,
   * some a little". It used to be a single constant, and a single constant turns out to be
   * the ONLY thing that decided the distance: the slope sets how fast a coin gets going,
   * but with light rolling friction it keeps accumulating speed for the whole ~700ms the
   * disturbance lasts, so every coin — on the steepest flank or the flattest shoulder —
   * ran into the same cap and stopped in the same place. Measured, a coin on a flat
   * shoulder travelled 0.165 and one on the steep flank 0.152: backwards, and both pinned
   * to the cap. Dropping the slope constant by 14x did not change it, which is what said
   * the cap was the mechanism rather than the physics.
   *
   * So the allowance is what carries the meaning. A coin is granted a slide when it is
   * disturbed, measured off the gradient of the heap UNDER IT and divided by its own grip:
   * a light coin on the steep flank gets the full run, a billion-point coin on a flat
   * shoulder barely shifts, and everything in between is in between. It is a designed
   * allowance rather than a simulated one, which is what the rest of this model is too. */
  var SLIDE_MIN = 0.030;         // ...the least, on flat ground under the heaviest coin
  var SLIDE_MAX = 0.175;         // ...and the most, on the steep flank under a bronze one
  var SLOPE_REF = 1.80;          // the gradient that earns a full slide (slot units)
  /* ...and the furthest it may END UP from it, by any means. `SLIDE_MAX` caps the driven
   * part of the journey only, so a coin could spend its energy, get flicked off a column
   * or bounce off the flank, and then COAST — in the air, where nothing brakes it — for
   * half the room. That is the "coins go flying off" this whole mechanic is supposed not
   * to do. A shaken coin is on a leash from the spot it was shaken at, and it is a leash
   * rather than a wall: past it the coin is damped hard instead of being teleported back,
   * so it comes to rest just outside and nothing ever snaps. A coin you are DRAGGING or
   * have THROWN is not on it — that is your hand, not the heap, and it has its own limits
   * in THROW_V and the room's own walls. */
  var LEASH = 0.24;
  var MAX_V = 0.0030;            // ground units per ms — the heap is about one unit across
  var MAX_VY = 0.0060;           // ...and nothing leaves the room upward
  var SHED_RATE = 0.024;         // chance per ms that a driven column sheds its top coin
  /* Shedding has to be FAST or the towers survive the trip: at a tenth of this rate a
   * ten-coin column slid the width of the room still standing up and then stood there
   * against the wall, which is the one thing a toppling stack must not do. At this rate a
   * disturbed column is in pieces inside about a third of a second. */
  var SCREEN_PAD = 26;           // px of viewport a coin is never allowed past
  /* Weight still decides how far a shaken coin gets: `grip` divides the energy, so a
   * bronze coin skates off the shoulder while a billion-point coin barely shifts under the
   * same disturbance. */

  /* WEIGHT. Gravity is the same for all of them — that is physics — but everything else a
   * heavier coin does is different: it bounces less, it scrubs off speed faster, it takes
   * more to get moving, and it lands with more of a thud than a clatter. A billion-point
   * coin should feel like picking up a bar. The numbers below are the only place that
   * difference is described. */
  var MASS = { bronze: 1.00, silver: 1.30, gold: 1.75, blue: 2.40 };
  function massOf(den) { return MASS[den] || 1; }

  /* The height of the heap at a point, for the fullness it is at now.
   *
   * The arguments are in WORLD ground units — a body stores gx = slot.x * PILE.dx and
   * gz = slot.z * PILE.dz — while the mound functions are defined in the slot space the
   * hoard was built in. They have to be converted back, and the answer converted forward.
   * Evaluating the mound directly on the world coordinates compares a radius scaled by 1.20
   * in x and 0.150 in z against a radius in neither, so every coin was handed a surface
   * height that had nothing to do with the heap it was sitting on: some floated, some were
   * buried, and the slope the physics read off it pointed the wrong way. */
  Scene.prototype.surfaceAt = function (gx, gz) {
    var f = Math.max(0, Math.min(1, this.nShown / this.slots.coins));
    if (f <= 0) return 0;
    var sx = gx / PILE.dx, sz = gz / PILE.dz;    // back into slot space
    var r = Math.sqrt(sx * sx + (sz / 0.62) * (sz / 0.62));
    var th = Math.atan2(sz / 0.62, sx);
    var R = MOUND.R(f) * MOUND.lobe(th);
    if (R <= 1e-6) return 0;
    return MOUND.H(f) * MOUND.prof(r / R) * (0.80 + 0.20 * MOUND.lobe(th)) * PILE.dy;
  };

  /* Pour the hoard again. The slot list is rebuilt from a NEW seed, so the heap is a
   * visibly different arrangement of exactly the same money — the balance, the mix and the
   * coin count are untouched, and `o.pp` is never even read. This is the one place the
   * layout is allowed to change, because the player asked it to. */
  Scene.prototype.reseed = function () {
    M.reseed();
    this.slots = M.buildSlots(Scene.budget());
    this._bodies = {}; this._nBodies = 0; this.tidyTick = null;
    this._deepSeq = (this._deepSeq || 0) + 1;
    this.limZ = null; this._shardN = 0; this._hb = null;
    this.deepKey = ''; this.deepSlots = 0;
    this.setBalance(this.pp, false);
  };

  /* the widest a coin at this depth can be and still be inside the frame */
  Scene.prototype.limAt = function (gz) {
    var k = this.cam.k(PILE.z + gz);
    var half = (this.cw * 0.5 - SCREEN_PAD) / (k * 0.62 * this.cam.span);
    return Math.max(0.25, half);
  };

  Scene.prototype.bodies = function () { return this._bodies || (this._bodies = {}); };
  Scene.prototype.bodyCount = function () { this.bodies(); return this._nBodies || 0; };

  /* wake slot i as a physical body, seeded at exactly where it is being drawn */
  Scene.prototype.wake = function (i) {
    var b = this.bodies();
    if (b[i]) return b[i];
    if ((this._nBodies || 0) >= MAX_BODIES) return null;
    var sl = this.slots.slot[i];
    var m = massOf(M.denOf(sl, this.mix));
    b[i] = { i: i, gx: sl.x * PILE.dx, gy: sl.y * PILE.dy, gz: sl.z * PILE.dz,
      vx: 0, vy: 0, vz: 0, spin: sl.rot, vs: 0, sleep: false, held: false, t: 0,
      cnt: sl.cnt, energy: 0, travel: 0,
      m: m, bounce: BOUNCE / m, grip: 1 + (m - 1) * 0.85,
      // the hoard's own outer spill legitimately runs past the frame edge, so a coin that
      // WAKES out there must not be teleported into view — it is simply not allowed to go
      // any further out, and once it comes inside the frame it is held inside
      lim0: Math.abs(sl.x * PILE.dx) };
    this._nBodies = (this._nBodies || 0) + 1;
    // a coin leaving the BAKED deep layer has to be painted out of it — see bakeDeep
    if (i < (this.deepSlots || 0)) this._deepSeq = (this._deepSeq || 0) + 1;
    return b[i];
  };
  Scene.prototype.sleepAll = function () {
    if (this._nBodies) this._deepSeq = (this._deepSeq || 0) + 1;
    this._bodies = {}; this._nBodies = 0;
  };

  Scene.prototype.bodyCap = function () { return this.lite ? Math.round(MAX_BODIES * 0.55) : MAX_BODIES; };

  Scene.prototype.shed = function (o) {
    if (o.shard || o.cnt <= 1) return null;
    var b = this.bodies();
    if ((this._nBodies || 0) >= this.bodyCap()) return null;
    var sl = this.slots.slot[o.i];
    // the drawn column's step, converted out of screen pixels into ground height
    var p = this.cam.project(o.gx, o.gy, PILE.z + o.gz, {});
    var stepPx = p.s * sl.size * S.STACK_RISE;
    var lift = Math.max(1e-6, this.cam.k(PILE.z + o.gz) * 0.34 * this.ch);
    var top = o.gy + (o.cnt - 1) * (stepPx / lift);
    o.cnt--;
    var key = 'sh' + (this._shardN = (this._shardN || 0) + 1);
    var away = (o.gx >= 0 ? 1 : -1);
    b[key] = { i: o.i, shard: true, cnt: 1,
      gx: o.gx + away * 0.02, gy: top, gz: o.gz,
      vx: away * (0.0004 + Math.random() * 0.0011) + o.vx * 0.85,
      vy: 0.0003 + Math.random() * 0.0004, vz: (Math.random() - 0.5) * 0.0006,
      spin: sl.rot + Math.random() * 3, vs: (Math.random() - 0.5) * 0.012,
      sleep: false, held: false, still: 0, energy: 0, travel: 0,
      /* a coin shed off a shaken column is still part of that disturbance, so it inherits
       * the leash post — without it the shards were the one thing in the avalanche with no
       * limit on where they could end up, and they were exactly what "coins go flying off"
       * meant. It is pinned to the COLUMN's post, not the shard's own spot, so a tower that
       * sheds six coins does not walk its leash across the room one coin at a time. */
      shakenV137: o.shakenV137 ? 1 : 0, slideCap: o.slideCap,
      hx: o.shakenV137 ? o.hx : o.gx, hz: o.shakenV137 ? o.hz : o.gz,
      m: o.m, bounce: o.bounce, grip: o.grip };
    this._nBodies++;
    return b[key];
  };

  /* Wake the coins around a point and give them a reason to move. `strength` scales the
   * whole disturbance: lifting a coin out is a light one, dropping one back in is heavier.
   * The falloff is what makes it read as a heap rather than a switch — the nearest coins
   * give way, the ones a little further off shift, and past DIST_R nothing happens at all. */
  /* HOW STEEP IS THE HEAP UNDER THIS COIN, and therefore how far it is allowed to slide.
   *
   * The gradient has to be measured in the mound's OWN space, not in the room's. The room
   * is 1.20 wide and 0.26 deep in ground units, so a step across the pile's depth is worth
   * seven steps across its width — measure there and the z term swamps everything, every
   * coin in the hoard comes out at the maximum gradient, and every coin is granted the
   * same full slide. Measured: 22 of 24 coins in one avalanche were handed an identical
   * allowance whether the heap under them fell away at 0.04 or at 1.43. In slot space both
   * axes are the circle the mound is actually built on, and the numbers mean what they say. */
  Scene.prototype.grantSlide = function (o) {
    var eg = 0.02;
    var gx = (this.surfaceAt(o.gx + eg, o.gz) - this.surfaceAt(o.gx - eg, o.gz)) / (2 * eg);
    var gz = (this.surfaceAt(o.gx, o.gz + eg) - this.surfaceAt(o.gx, o.gz - eg)) / (2 * eg);
    gx *= PILE.dx / PILE.dy;
    gz *= (PILE.dz * 0.62) / PILE.dy;
    var gt = Math.min(1, Math.sqrt(gx * gx + gz * gz) / SLOPE_REF);
    o.slideCap = (SLIDE_MIN + (SLIDE_MAX - SLIDE_MIN) * gt * gt) / o.grip;
    return o.slideCap;
  };

  Scene.prototype.disturb = function (gx, gz, strength) {
    var n = M.slotsFor(this.slots, Math.round(this.nShown));
    if (n <= 0) return 0;
    var s = this.slots.slot, woke = 0;
    /* v137 F: never reach below the BAKED layer. A deep coin can be picked up deliberately
     * — that is one event and one re-bake — but a shake wakes dozens of coins many times a
     * second, and re-baking 1400 sprites on each of those is a stall you can feel. The
     * live surface band is what a shake moves, which is also the honest limit. */
    var lo = Math.max(this.deepSlots || 0, n - Math.max(30, Math.round(this.slots.slot.length * 0.34)));
    var r2 = DIST_R * DIST_R;
    for (var i = n - 1; i >= lo; i--) {
      var sx = s[i].x * PILE.dx - gx;
      var sz = (s[i].z * PILE.dz - gz) / 0.55;      // the floor is an ellipse; so is the reach
      var d2 = sx * sx + sz * sz;
      if (d2 > r2) continue;
      var o = this.wake(i);
      if (!o) break;                                 // out of budget
      var f = 1 - Math.sqrt(d2) / DIST_R;
      f = f * f * (3 - 2 * f);                       // smooth, so there is no hard rim
      o.sleep = false; o.still = 0;
      o.energy = Math.max(o.energy || 0, DIST_E * f * strength);
      o.travel = o.travel || 0;
      /* The leash post and the slide allowance are both granted ONCE, at the start of the
       * disturbance, and describe where this coin was SITTING when the heap gave way.
       * Re-granting them on every disturb — and a landing coin raises one of its own —
       * meant a coin that had already slid somewhere steeper was handed a fresh, longer
       * allowance from there, so the distance stopped having anything to do with the seat
       * it started from. Which is the claim. */
      if (!o.shakenV137) {
        o.shakenV137 = 1; o.hx = o.gx; o.hz = o.gz;
        this.grantSlide(o);
      }
      // a nudge outward from the hand, so the gap opens rather than only sagging
      var d = Math.max(1e-4, Math.sqrt(d2));
      // the outward nudge is slope-INDEPENDENT, so it has to stay small: it is what makes
      // the gap open rather than only sag, but every unit of it dilutes the one thing the
      // avalanche is supposed to say, which is that where a coin sat decides where it goes
      o.vx += (sx / d) * 0.00007 * f * strength;
      o.vz += (sz / d) * 0.00003 * f * strength;
      woke++;
    }
    return woke;
  };

  Scene.prototype.stepBodies = function (dt) {
    var b = this._bodies; if (!b) return;
    dt = Math.min(34, dt);
    var any = false, decay = Math.exp(-dt / E_DECAY);
    for (var k in b) {
      var o = b[k];
      if (o.held) { any = true; continue; }
      // a coin on its way home is under RESTOCK's hand, not gravity's — stepping it here
      // too meant the two pulled against each other and it never arrived
      if (o.homing) { any = true; continue; }
      if (o.sleep) continue;
      any = true;
      o.vy -= GRAV * dt;
      var onGround = o.gy <= this.surfaceAt(o.gx, o.gz) + 0.004;
      o.driven = false;
      if (onGround) {
        /* A hoard at rest holds its own shape — coins in a heap interlock, which is why a
         * pile of them stands at an angle no single coin would hold alone. So the slope
         * only acts on a coin that has been SHAKEN LOOSE, in proportion to how much of that
         * disturbance it still has. With the slope acting unconditionally every woken coin
         * crept downhill and the pile quietly deflated; with it never acting, nothing ever
         * slid. Energy is the difference, and it runs out in about a quarter of a second. */
        var e = 0.02;
        var sx2 = (this.surfaceAt(o.gx + e, o.gz) - this.surfaceAt(o.gx - e, o.gz)) / (2 * e);
        var sz2 = (this.surfaceAt(o.gx, o.gz + e) - this.surfaceAt(o.gx, o.gz - e)) / (2 * e);
        var en = o.energy || 0;
        if (en > E_FLOOR && (o.travel || 0) < (o.slideCap || SLIDE_MAX)) {
          o.driven = true;
          /* HOW FAR A COIN GOES IS WHERE IT WAS SITTING. On the steep flank of the heap the
           * slope is most of a unit and it runs; on a flat shoulder there is nothing to run
           * down and it barely shifts. That is the whole of "some a lot, some a little". */
          var g2 = en / Math.max(MU * o.grip, 1e-6);
          o.vx -= sx2 * SLOPE_K * g2 * GRAV * dt;
          o.vz -= sz2 * SLOPE_K * 0.6 * g2 * GRAV * dt;
        } else {                                     // it stays put, and settles
          /* A coin that has SPENT its slide brakes hard. Letting it merely stop being
           * driven leaves it coasting on whatever speed it had, so `SLIDE_MAX` capped the
           * driven part of the journey and the coin then rolled on past it under its own
           * momentum — which is how a "moves a little" avalanche ends up halfway across
           * the room. Out of energy is out of energy. */
          var brake = ((o.travel || 0) >= (o.slideCap || SLIDE_MAX)) ? 0.055 : 0.014;
          o.vx -= o.vx * Math.min(1, brake * dt);
          o.vz -= o.vz * Math.min(1, brake * dt);
        }
        o.energy = en * decay;
      }
      var vh = Math.sqrt(o.vx * o.vx + o.vz * o.vz);
      if (vh > MAX_V) { o.vx *= MAX_V / vh; o.vz *= MAX_V / vh; }
      if (o.vy > MAX_VY) o.vy = MAX_VY;            // a belt on the throw's braces
      if (o.vy < -MAX_VY * 2) o.vy = -MAX_VY * 2;
      /* A column sheds when something is PUSHING it sideways — not merely because it is
       * awake. Including the vertical velocity here meant the first frame of gravity after
       * a wake (-GRAV*dt, already past the sleep threshold) shed a coin off every column in
       * the hoard, untouched. */
      if (o.cnt > 1 && (o.driven || vh > SLEEP_V * 2) && Math.random() < SHED_RATE * dt) this.shed(o);
      var gy0 = o.gy, px0 = o.gx, pz0 = o.gz;
      o.gx += o.vx * dt; o.gy += o.vy * dt; o.gz += o.vz * dt;
      o.spin += o.vs * dt;
      o.travel = (o.travel || 0) + Math.abs(o.gx - px0) + Math.abs(o.gz - pz0);
      /* A coin BURIED in the heap is already resting — on the coins around it, not on the
       * surface above it. Clamping it up to the surface popped every buried body out of the
       * mound the first time it was woken, which is a hoard visibly swelling for no reason.
       * The floor is never ABOVE where the coin already was: it can land on the surface,
       * it can never be lifted onto it. */
      var floor = Math.min(this.surfaceAt(o.gx, o.gz), gy0);
      /* v137 F: A SLIDING COIN FOLLOWS THE SLOPE — it does not take off down it. On the
       * flank of a heap this steep, one frame of drive carries a coin further sideways
       * than gravity pulls it down in the same frame, so a coin that started ON the
       * surface ended the frame ABOVE the surface at its new spot and went ballistic. Once
       * airborne it is not `onGround`, so the slope stops acting on it entirely: it got a
       * single frame of push and then coasted. Measured, a coin on the steepest flank
       * travelled 0.018 of a ground unit — under three pixels, which is nothing. Holding a
       * driven coin down onto the surface is both what a coin sliding down a pile actually
       * does and what makes the slide visible. It only applies while the coin is being
       * driven and was already resting; a thrown or shed coin flies as before. */
      if (onGround && o.driven && o.gy > floor && o.vy <= 0) { o.gy = floor; o.vy = 0; }
      if (o.gy <= floor) {
        o.gy = floor;
        /* v137 F: A COIN AT REST DOES NOT BOUNCE. The gate was two frames of gravity
         * (0.0007), which every settled coin in the hoard crosses on every single frame it
         * sits there — so the whole heap was in a permanent micro-bounce, spending part of
         * every frame off the ground where the slope cannot act on it. It shows up as a
         * shimmer, and it silently INVERTED the weight order of an avalanche: a light coin
         * bounces higher (bounce = 0.34/m), so it spent more of the slide airborne and
         * undriven than a heavy one did, and travelled less. The gate is a real impact
         * now — the same threshold `landed` already uses to decide something happened. */
        if (o.vy < -SLEEP_V * 6) {
          var hit = -o.vy;
          o.vy = hit * o.bounce; o.vs = o.vx * 0.9;
          this.landed(o, hit);                 // the thud, and the dust
        } else o.vy = 0;
        var roll = Math.pow(ROLL, o.grip);
        o.vx *= roll; o.vz *= roll;
        // it ROLLS: the spin is the ground speed, not a decaying leftover of the throw
        o.vs = o.vs * 0.55 + (o.vx * 26) * 0.45;
        var sp = Math.abs(o.vx) + Math.abs(o.vz) + Math.abs(o.vy);
        /* A coin that has just been shaken loose has not reached the sleep threshold YET,
         * so a bare `sp < SLEEP_V` puts it to sleep on its very first step and zeroes the
         * velocity it was just given. It sleeps only when it is quiet AND nothing is pushing
         * it, and only after it has been quiet for several frames running. */
        if (sp < SLEEP_V && !o.driven) {
          if ((o.still = (o.still || 0) + 1) >= STILL_FRAMES) {
            o.sleep = true; o.vx = o.vy = o.vz = o.vs = 0; o.still = 0; o.energy = 0;
          }
        } else o.still = 0;
      }
      if (o.shakenV137) {
        var lx = o.gx - o.hx, lz = o.gz - o.hz, ld2 = lx * lx + lz * lz;
        if (ld2 > LEASH * LEASH * 0.7225) {          // the last 15% of the leash is a brake
          var ld = Math.sqrt(ld2);
          /* The brake zone has to be NARROW. Starting it at 60% of the leash braked almost
           * every coin in the avalanche, and a brake applied to everything is just a second
           * speed limit: every coin came to rest in the same thin band whatever slope it
           * started on, which erased the one thing the mechanic is for. It catches the
           * outliers now and leaves the rest of the spread alone. */
          var over = Math.min(1, (ld - LEASH * 0.85) / (LEASH * 0.15));
          var lk = Math.pow(1 - 0.34 * over, dt / 16);
          o.vx *= lk; o.vz *= lk;
          if (over >= 1) {
            /* AT the leash, the OUTWARD part of the velocity is removed outright. Damping
             * alone does not hold a line: a coin moving at the speed cap covers 0.048 of a
             * unit a frame and a 14%-a-frame decay lets it coast a third of a unit past
             * the limit before it stops. Taking the radial component leaves it free to
             * slide along the leash or come back in — which is what a coin caught by the
             * coins around it does — but it cannot get further from where it was shaken. */
            var nx = lx / ld, nz = lz / ld, rad = o.vx * nx + o.vz * nz;
            if (rad > 0) { o.vx -= rad * nx; o.vz -= rad * nz; }
            o.energy = 0;
          }
        }
      }
      /* THE ROOM IS WHAT YOU CAN SEE. `limAt` inverts the projection at this coin's own
       * depth, so whatever the aspect ratio a coin stops at the edge of the frame. The
       * hoard's own outer spill legitimately sits past that edge, so a coin that WAKES out
       * there is not teleported in — it just cannot go further out, and once it comes inside
       * the frame it is held inside. */
      var frame = this.limAt(o.gz), lz0 = this.limZ;
      if (lz0 == null) lz0 = this.limZ = PILE.dz * 0.95;
      if (o.lim0 && Math.abs(o.gx) <= frame) o.lim0 = 0;     // it came in; keep it in
      var lim = Math.max(frame, o.lim0 || 0);
      if (o.gx < -lim) { o.gx = -lim; o.vx = Math.abs(o.vx) * BOUNCE * 0.5 }
      if (o.gx > lim) { o.gx = lim; o.vx = -Math.abs(o.vx) * BOUNCE * 0.5 }
      if (o.gz < -lz0) { o.gz = -lz0; o.vz = Math.abs(o.vz) * BOUNCE * 0.5 }
      if (o.gz > lz0) { o.gz = lz0; o.vz = -Math.abs(o.vz) * BOUNCE * 0.5 }
    }
    this.bodiesAwake = any;
  };

  /* a coin arriving on the heap: the heavier it is and the harder it lands, the more it
   * says about it */
  Scene.prototype.landed = function (o, hit) {
    if (hit < SLEEP_V * 6) return;
    var now = performance.now();
    if (now - (o.lastHit || 0) < 90) return;
    o.lastHit = now;
    var sl = this.slots.slot[o.i], den = M.denOf(sl, this.mix);
    // a coin coming down on the heap shakes the coins it lands among
    if (hit > SLEEP_V * 10) this.disturb(o.gx, o.gz, Math.min(1, hit / 0.004) * 0.75);
    if (window.__RIB_VAULT_AUDIO) window.__RIB_VAULT_AUDIO.land(den, Math.min(1, hit / 0.006), o.m);
    if (!this.reduced && hit > SLEEP_V * 14) {
      var p = this.cam.project(o.gx, o.gy, PILE.z + o.gz, {});
      this.burst(p.x, p.y, den);
    }
  };

  /* every disturbed coin flies home to the slot it was built in */
  Scene.prototype.tidy = function () {
    var b = this._bodies; if (!b) return 0;
    var n = 0, self = this;
    for (var k in b) {
      if (b[k].shard) { delete b[k]; this._nBodies = Math.max(0, this._nBodies - 1); n++; continue; }
      b[k].homing = true; b[k].sleep = false; b[k].held = false;
      b[k].cnt = this.slots.slot[b[k].i].cnt;      // the column gets its coins back
      n++;
    }
    var t0 = performance.now();
    this.tidyTick = function (now) {
      var bb = self._bodies; if (!bb) { self.tidyTick = null; return }
      var left = 0;
      for (var q in bb) {
        var o = bb[q], sl = self.slots.slot[o.i];
        var tx2 = sl.x * PILE.dx, ty = sl.y * PILE.dy, tz2 = sl.z * PILE.dz;
        o.gx += (tx2 - o.gx) * 0.14; o.gy += (ty - o.gy) * 0.14; o.gz += (tz2 - o.gz) * 0.14;
        o.spin += (sl.rot - o.spin) * 0.12;
        o.vx = o.vy = o.vz = o.vs = 0;
        if (Math.abs(tx2 - o.gx) + Math.abs(ty - o.gy) + Math.abs(tz2 - o.gz) > 0.004) left++;
        else {
          if (bb[q].i < (self.deepSlots || 0)) self._deepSeq = (self._deepSeq || 0) + 1;
          delete bb[q]; self._nBodies = Math.max(0, (self._nBodies || 0) - 1);
        }
      }
      if (!left || now - t0 > 2600) {
        if (self._nBodies) self._deepSeq = (self._deepSeq || 0) + 1;
        self._bodies = {}; self._nBodies = 0; self.tidyTick = null;
      }
    };
    return n;
  };

  /* ---------- the renderer's hook: a disturbed slot is drawn where it IS ---------- */
  var baseRange = Scene.prototype.drawRange;
  Scene.prototype.drawRange = function (x, from, to, withShadow) {
    var b = this._bodies;
    if (!b) return baseRange.call(this, x, from, to, withShadow);
    // the settled hoard first, minus anything that has been knocked loose. Shards are keyed
    // apart ('sh12'), so the slot they came off keeps drawing the coins still in it.
    this._skip = b;
    baseRange.call(this, x, from, to, withShadow);
    this._skip = null;
    /* ...then the loose coins, in their own depth order. `_looseFrom` is how a coin lifted
     * out of the DEEP layer gets drawn at all: the deep layer is blitted from a bake that
     * has already painted it out, so the live pass has to reach back past its own `from`
     * to find it. Without this a deep coin you picked up simply vanished. */
    var lf = this._looseFrom == null ? from : this._looseFrom;
    var keys = [], k;
    for (k in b) { if (b[k].i >= lf && b[k].i < to) keys.push(b[k]); }
    keys.sort(function (p, q) { return q.gz - p.gz; });
    var cam = this.cam, p = {}, i;
    for (i = 0; i < keys.length; i++) {
      var o = keys[i], sl = this.slots.slot[o.i];
      cam.project(o.gx, o.gy, PILE.z + o.gz, p);
      var size = p.s * sl.size;
      var den = M.denOf(sl, this.mix);
      var shadeIx = o.held ? 3 : Math.min(3, Math.max(1, Math.round(sl.shade * 2.4)));
      if (withShadow) {
        var lift = Math.max(0, o.gy - this.surfaceAt(o.gx, o.gz));
        var g = cam.project(o.gx, this.surfaceAt(o.gx, o.gz), PILE.z + o.gz, {});
        x.globalAlpha = 0.45 / (1 + lift * 5);
        x.drawImage(this.blob, g.x - size * 0.8, g.y - size * 0.26, size * 1.6, size * 0.55);
        x.globalAlpha = 1;
      }
      if (o.cnt > 1) this.drawStackN(x, sl, den, p.x, p.y, size, shadeIx, o.cnt);
      else this.drawCoin(x, den, o.shard ? 'flat' : sl.face, p.x, p.y,
        size * (o.held ? 1.16 : 1), o.spin, null, shadeIx,
        (!o.shard && sl.face === 'face') ? 0.06 + sl.tilt * 0.40 : null);
    }
  };

  window.__RIB_VAULT_PHYS = { MAX_BODIES: MAX_BODIES, GRAV: GRAV };
})();
