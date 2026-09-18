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
  function tierName(pp) {
    if (pp <= 0) return TIERS[0].name;
    var f = fullnessOf(pp), best = TIERS[1];      // any balance at all is past 'Empty vault'
    for (var i = 1; i < TIERS.length; i++) if (f >= TIERS[i].n - 1e-9) best = TIERS[i];
    return best.name;
  }

  /* ---------- the mound ---------- */
  var MOUND = {
    R: function (u) { return 0.30 + 0.70 * Math.pow(Math.max(u, 0), 0.34); },   // footprint
    H: function (u) { return 0.70 * Math.pow(Math.max(u, 0), 0.86); },          // peak
    // the profile is not a cone. A poured mass sits at its angle of repose: a broad base,
    // a shoulder about a third of the way out, and a ROUNDED crown — a cone profile put a
    // spire on the pile, which is the one shape a heap of discs never makes.
    prof: function (q) { q = Math.min(1, Math.max(0, q));
      return Math.max(0, Math.cos(q * Math.PI * 0.5) * (0.88 + 0.12 * Math.cos(q * 3.1))); },
    lobe: function (th) { return 1 + 0.17 * Math.sin(th * 2 + 0.7) + 0.11 * Math.sin(th * 3 - 1.9) + 0.06 * Math.sin(th * 5 + 0.3); }
  };

  /* ---------- the slots ---------- */
  function buildSlots(max) {
    var R = rng(0x5EED1337), s = new Array(max), i;
    for (i = 0; i < max; i++) {
      var u = (i + 0.5) / max;
      var th = R() * Math.PI * 2;
      // a coin lands on the mound's surface as it is at ITS birth, biased outward so the
      // footprint spreads as fast as the peak climbs
      var q = Math.pow(R(), 0.62);
      var spill = R() < 0.085;                   // a poured heap throws coins off its foot;
      var rr = MOUND.R(u) * (spill ? 1.05 + R() * 0.55 : q) * MOUND.lobe(th);
      var h = spill ? 0.012 * R()                // without them the mound has a cut-out edge
        : MOUND.H(u) * MOUND.prof(q) * (0.80 + 0.20 * MOUND.lobe(th));
      var sink = 0.55 + 0.45 * R();              // some coins are half-buried, not perched
      s[i] = {
        x: Math.cos(th) * rr,
        z: Math.sin(th) * rr * 0.62,             // the hoard is an ellipse on the floor
        y: h * sink,
        tilt: R(),                               // 0 = lying flat, 1 = standing on edge
        rot: R() * Math.PI * 2,                  // spin in the ground plane
        mixU: R(),                               // stable draw against the mix's CDF
        size: 0.84 + 0.32 * R(),
        shade: 0.62 + 0.38 * R(),                // how much light this coin catches
        face: (function (a) { return a < 0.40 ? 'hero' : a < 0.76 ? 'flat' : a < 0.955 ? 'face' : 'edge'; })(R()),
        stack: R() < 0.055,                      // a few are stack modules sunk in the hoard
        glint: R()
      };
    }
    // painter's order, far to near, computed once
    var order = new Array(max);
    for (i = 0; i < max; i++) order[i] = i;
    order.sort(function (a, b) { return (s[b].z - s[a].z) || (s[a].y - s[b].y); });
    return { slot: s, order: order, max: max };
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
    shortPP: shortPP, commas: commas, buildSlots: buildSlots, denOf: denOf,
    TIERS: TIERS, DEN: DEN, DEN_VALUE: DEN_VALUE, DEN_LABEL: DEN_LABEL, DEN_TINT: DEN_TINT,
    MOUND: MOUND, rng: rng, SPRITE_NAMES: SPRITE_NAMES
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
    coin: 68            // a near coin's diameter in CSS px at a 430px-wide viewport
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
    out.s = k * CAM.coin * this.u;
    return out;
  };

  /* the hoard's footprint in ground space */
  var PILE = { z: 0.27, dz: 0.150, dx: 1.06, dy: 1.30 };

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
  /* an intelligently bounded number of objects: the hoard never renders more than this,
   * whatever the balance, and a weak device gets fewer. */
  Scene.budget = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var px = (window.innerWidth || 400) * (window.innerHeight || 700) * dpr * dpr;
    var mem = navigator.deviceMemory || 4;
    if (px > 2.4e6 && mem >= 4) return 1350;
    if (px > 1.0e6 && mem >= 3) return 980;
    return 620;
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
    // the door at rest is part of the room: it is on the far wall, BEHIND the hoard, and
    // nothing about it changes while the vault is open. Baked, it costs nothing and it
    // stops occluding the pile it stands behind.
    var dcl = this.sp.get('door_closed');
    if (dcl) {
      var dh2 = Math.min(h * 0.32, w * 0.62), dw2 = dh2 * (dcl.width / dcl.height);
      x.save(); x.globalAlpha = 0.95;
      x.drawImage(dcl, w * 1.08 - dw2 * 0.62, h * 0.46 - dh2 / 2, dw2, dh2);
      x.restore();
    }
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
    this.n = Math.round(M.fullnessOf(this.pp) * this.slots.max);
    this.n = Math.max(0, Math.min(this.slots.max, this.n));
    if (!animate) this.nShown = this.n;
  };

  Scene.prototype.coinImg = function (den, kind, shadeIx) {
    var n = 'coin_' + den + '_' + kind;
    var v = this.shade[n];
    return v ? v[shadeIx] : this.sp.get(n);
  };

  /* one coin, anywhere in the scene. `spin` is the rotation about the coin's own axis:
   * scaleX = |cos spin| is exactly what a spinning disc does, and the face flips to the
   * back through the crossing, where the edge sprite is blended in. */
  Scene.prototype.drawCoin = function (x, den, kind, px, py, size, rot, spin, shadeIx, tilt) {
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
    var step = Math.max(6, Math.round(this.slots.max * 0.012));
    var q = Math.round(nDeep / step) * step;
    var key = q + '|' + this.mixKey();
    if (key === this.deepKey) return;
    this.deepKey = key;
    var x = this.deep.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, this.deep.width, this.deep.height);
    x.scale(this.dpr, this.dpr);
    this.drawRange(x, 0, q, true);
    this.deepN = q;
  };
  Scene.prototype.mixKey = function () {
    return DEN.map(function (d) { return Math.round(this.mix[d] * 40); }, this).join(',');
  };

  Scene.prototype.drawRange = function (x, from, to, withShadow) {
    var s = this.slots.slot, ord = this.slots.order, cam = this.cam, p = {};
    var blob = this.blob, i, k, sl, den, size;
    for (k = 0; k < ord.length; k++) {
      i = ord[k];
      if (i < from || i >= to) continue;
      sl = s[i];
      cam.project(sl.x * PILE.dx, sl.y * PILE.dy, PILE.z + sl.z * PILE.dz, p);
      size = p.s * sl.size;
      if (withShadow && sl.y < 0.10) {
        x.globalAlpha = 0.5;
        x.drawImage(blob, p.x - size * 0.72, p.y - size * 0.24, size * 1.44, size * 0.5);
        x.globalAlpha = 1;
      }
      den = M.denOf(sl, this.mix);
      var shadeIx = Math.min(3, Math.max(0, Math.round(sl.shade * 2.2 + (sl.y / 0.9) * 1.4)
        - (den === 'blue' ? 1 : 0)));
      if (sl.stack && size > 16) {
        var st = this.coinImg(den, sl.y > 0.3 ? 'stack_s' : 'stack_m', shadeIx);
        if (st) {
          var sw = size * 0.92, sh = sw * (st.height / st.width);
          x.drawImage(st, p.x - sw / 2, p.y - sh * 0.72, sw, sh);
          continue;
        }
      }
      this.drawCoin(x, den, sl.face, p.x, p.y, size,
        (sl.rot - Math.PI) * (sl.face === 'edge' ? 0.10 : sl.face === 'face' ? 0.55 : 0.26),
        null, shadeIx, sl.face === 'face' ? 0.06 + sl.tilt * 0.40 : null);
    }
  };

  Scene.prototype.drawHoard = function (x) {
    var n = Math.round(this.nShown);
    if (n <= 0) return;
    var live = Math.min(n, Math.max(24, Math.round(this.slots.max * 0.16)));
    var deepN = Math.max(0, n - live);
    this.bakeDeep(deepN);
    // one big contact shadow tying the whole hoard to the floor
    var f = n / this.slots.max;
    var p = this.cam.project(0, 0, PILE.z, {});
    var rw = this.cam.span * (0.20 + 0.52 * Math.pow(f, 0.45));
    x.globalAlpha = 0.9;
    x.drawImage(this.blob, p.x - rw * 1.18, p.y - rw * 0.30, rw * 2.36, rw * 0.86);
    x.globalAlpha = 0.72;
    x.drawImage(this.blob, p.x - rw * 0.72, p.y - rw * 0.16, rw * 1.44, rw * 0.50);
    x.globalAlpha = 1;
    if (this.deepN > 0) {
      x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
      x.drawImage(this.deep, 0, 0); x.restore();
    }
    this.drawRange(x, this.deepN, n, true);
  };

  window.__RIB_VAULT_SCENE = { Scene: Scene, Cam: Cam, CAM: CAM, PILE: PILE };
})();

/* ===== v137 THE PRESTIGE VAULT — the core, the door, the light, and the frame ===== */
(function () {
  'use strict';
  var M = window.__RIB_VAULT_MODEL, S = window.__RIB_VAULT_SCENE;
  var Scene = S.Scene, CAM = S.CAM, PILE = S.PILE;

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
  Scene.prototype.drawDoor = function (x, now) {
    var t = this.doorT;
    if (t >= 0.999) return;            // at rest the door is baked into the room, on the wall
    // the cinematic: the leaf front-on, swinging out on its hinge as t rises
    var leaf = this.sp.get('door_front'), wheel = this.sp.get('door_wheel');
    var rim = this.sp.get('door_rim');
    var e = t < 0.55 ? 0 : Math.pow((t - 0.55) / 0.45, 1.7);       // the swing
    // while the door is shut the room behind it is not visible. The wash lifts with the
    // swing, so the reveal is the room arriving rather than the leaf sliding off a picture.
    x.fillStyle = 'rgba(2,4,7,' + (0.94 * (1 - e)).toFixed(3) + ')';
    x.fillRect(0, 0, this.cw, this.ch);
    var cx = this.cw * (0.5 + e * 0.50), cy = this.ch * 0.46;
    var h2 = Math.min(this.cw * 1.30, this.ch * 0.74) * (1 - e * 0.42);
    if (rim) {
      var rw = h2 * (rim.width / rim.height);
      x.save(); x.globalAlpha = 0.92;
      x.drawImage(rim, this.cw * 0.5 - rw / 2, cy - h2 / 2, rw, h2);
      x.restore();
    }
    if (leaf) {
      var lw = h2 * (leaf.width / leaf.height);
      var open = Math.max(0.06, Math.cos(e * 1.32));               // the leaf turning away
      x.save();
      x.translate(cx, cy);
      x.globalAlpha = Math.max(0, 1 - e * 0.15);
      x.drawImage(leaf, -lw * open / 2, -h2 / 2, lw * open, h2);
      if (wheel && open > 0.30) {
        var ww = lw * open * 0.40, wh = ww * (wheel.height / wheel.width);
        x.save();
        x.translate(0, -h2 * 0.012);
        x.rotate(Math.min(1, t / 0.55) * Math.PI * 3.2);           // the lock wheel spinning
        x.globalAlpha = 0.95;
        x.drawImage(wheel, -ww / 2, -wh / 2, ww, wh);
        x.restore();
      }
      x.restore();
    }
    // the bolts drawing back, four of them, on the leaf's own radius
    var bolt = this.sp.get('door_bolt');
    if (bolt && t < 0.62) {
      var back = Math.max(0, Math.min(1, (t - 0.18) / 0.34));
      var br = h2 * 0.40 * (1 + back * 0.22), bw = h2 * 0.085;
      for (var i = 0; i < 8; i++) {
        var a = i / 8 * Math.PI * 2;
        x.save();
        x.translate(this.cw * 0.5 + Math.cos(a) * br, cy + Math.sin(a) * br);
        x.rotate(a);
        x.globalAlpha = 0.8 * (1 - back * 0.5);
        x.drawImage(bolt, -bw / 2, -bw * 0.24, bw, bw * 0.48);
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
  Scene.prototype.pickSurface = function (px, py) {
    var n = Math.round(this.nShown);
    if (n <= 0) {
      var c = this.cam.project(0, 0, PILE.z, {});
      return { x: c.x, y: c.y, i: -1, s: c.s };
    }
    var s = this.slots.slot, best = -1, bd = 1e9, p = {}, i, d;
    var lo = Math.max(0, n - Math.max(40, Math.round(this.slots.max * 0.22)));
    for (i = lo; i < n; i++) {
      this.cam.project(s[i].x * PILE.dx, s[i].y * PILE.dy, PILE.z + s[i].z * PILE.dz, p);
      d = (p.x - px) * (p.x - px) + (p.y - py) * (p.y - py);
      if (d < bd) { bd = d; best = i; this.bx = p.x; this.by = p.y; this.bs = p.s; }
    }
    return { x: this.bx, y: this.by, i: best, s: this.bs };
  };
  Scene.prototype.hoardBox = function () {
    var f = Math.max(0.04, this.nShown / this.slots.max);
    var near = this.cam.project(0, 0, PILE.z - PILE.dz, {});
    var top = this.cam.project(0, M.MOUND.H(f) * PILE.dy, PILE.z, {});
    var half = this.cam.span * (0.16 + 0.46 * Math.pow(f, 0.42));
    return { x0: this.cw / 2 - half, x1: this.cw / 2 + half,
      y0: top.y - near.s * 0.8, y1: Math.min(this.ch, near.y + near.s * 0.6) };
  };

  /* ---------- the frame ---------- */
  Scene.prototype.frame = function (now, dt) {
    this.resize();
    var x = this.ctx;
    x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.room) { x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(this.room, 0, 0); x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }
    else { x.fillStyle = '#04070b'; x.fillRect(0, 0, this.cw, this.ch); }
    // the hoard eases toward its true count so a spend collapses rather than snapping
    if (this.nShown !== this.n) {
      var d = this.n - this.nShown;
      this.nShown += Math.abs(d) < 0.6 ? d : d * Math.min(1, dt / 90);
    }
    this.drawHoard(x);
    this.stepFlyers(dt, this.onArrive);
    this.stepSparks(dt);
    this.drawFlyers(x);
    this.drawCore(x, now);
    this.drawSparks(x);
    this.drawDoor(x, now);
    this.drawAir(x, now);
    // an honest frame-time watch: three slow seconds and the scene sheds detail
    this.frames++;
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
    this.elModal = $('.rv-modal'); this.elCardT = $('.rv-card .ttl'); this.elCardB = $('.rv-card .bd');

    var self = this;
    $('.rv-back').onclick = function () { self.close('back'); };
    $('.rv-details').onclick = function () { self.root.classList.toggle('panel'); self.fillPanel(); };
    $('.rv-closepanel').onclick = function () { self.root.classList.remove('panel'); };
    this.elSkip.onclick = function () { self.skip(); };
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
      self.touch = { x: e.clientX - b.left, y: e.clientY - b.top };
    });
    window.addEventListener('blur', function () { self.release(); });
  };

  Vault.prototype.press = function (x, y) {
    this.touch = { x: x, y: y };
    this.holding = true; this.holdFrom = performance.now(); this.stage = 0;
    this.haptic(8);
    if (!this.target) { this.bumpHint('PICK AN UPGRADE TO INVEST IN'); this.pop(x, y, true); return; }
    if (this.remaining() <= 0) { this.bumpHint('FULLY FUNDED &middot; RELEASE TO CONFIRM'); return; }
    if (this.balance - this.pending <= 0) { this.bumpHint('NOT ENOUGH PRESTIGE POINTS'); return; }
    this.pour(this.tapChunk(), true);
  };
  Vault.prototype.release = function () {
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
  Sprites.prototype.get = function (n) { return this.img[n] || null; };

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
  Vault.prototype.tick = function (now, dt) {
    if (this.depositTick) this.depositTick(now);
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

    var boot = this.sprites ? Promise.resolve(this.sprites)
      : new Sprites().load(M.SPRITE_NAMES).then(function (s) { self.sprites = s; return s; });
    return boot.then(function (sp) {
      if (!self.scene) self.scene = new SC.Scene(self.cv, sp);
      self.scene.resize();
      self.scene.setBalance(self.balance, false);
      self.scene.flyers.length = 0; self.scene.sparks.length = 0;
      self.scene.doorT = (self.doorSeen || opts.skipDoor || self.scene.reduced) ? 1 : 0;
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
        n: V.scene ? Math.round(V.scene.nShown) : 0,
        slots: V.scene ? V.scene.slots.max : 0,
        flyers: V.scene ? V.scene.flyers.filter(function (f) { return f.live; }).length : 0,
        doorT: V.scene ? V.scene.doorT : 1,
        stage: V.stage, holding: V.holding,
        missing: V.sprites ? V.sprites.failed.slice() : null };
    },
    pour: function (n) { return V.pour(n, true); },
    hold: function (on) { if (on) { V.touch = { x: V.scene.cw / 2, y: V.scene.ch * 0.74 }; V.press(V.scene.cw / 2, V.scene.ch * 0.74); } else V.release(); },
    skip: function () { V.skip(); }
  };
})();
