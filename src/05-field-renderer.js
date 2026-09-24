
(function(){"use strict";
const mt=window.__RIB_PHASER_V149;// ===== GRIDIRON live-field bridge v3 — script playback (mt = Phaser) =====
// requires: buildPlayScript (playscript.js), pickFeaturedIndex below
function pickFeaturedIndex(payload, offLabels, defLabels, rand) {
  rand = rand || Math.random;
  const usOffense = payload.offense !== "them";
  const pos = payload.playerPos;
  const OFF = ["QB", "RB", "WR", "TE", "OL"];
  const pickFrom = (labels, base, want) => {
    const idxs = [];
    for (let i = 0; i < labels.length; i++) if (labels[i] === want || (want === "DL" && (labels[i] === "DE" || labels[i] === "DT"))) idxs.push(base + i);
    return idxs.length ? idxs[0] : -1;   // v87: the user's slot is the first of his position, never a random body
  };
  if (pos) {
    const meOff = OFF.includes(pos);
    if (usOffense && meOff) { const i = pickFrom(offLabels, 0, pos); if (i >= 0) return { index: i, isMe: true }; }
    if (!usOffense && !meOff) { const i = pickFrom(defLabels, offLabels.length, pos); if (i >= 0) return { index: i, isMe: true }; }
  }
  const prio = payload.event === "run" ? ["RB", "QB"] : ["WR", "TE", "RB", "QB"];
  for (const want of prio) { const i = pickFrom(offLabels, 0, want); if (i >= 0) return { index: i, isMe: false }; }
  return { index: usOffense ? 8 : 14, isMe: false };
}

const FW = 720, FH = 440, FVH = 576, LEG = 46, CH = FVH;
/* ===== v112 THE CAMERA HAS OPTIONS — the four behaviours Settings offers =====
 * `z` scales every zoom target, `tight` how hard the open-field pull-in bites, `lead` how far the
 * frame runs ahead of the man, `stiff` how eagerly the v109 spring chases. The Settings panel reads
 * this same list off `window.__CAM_MODES_V112`, so a mode is described in exactly one place. */
const CAM_MODES_V112 = [
  { id: "broadcast", n: "Broadcast", d: "Follows the ball, tightens when a runner breaks into space, opens up at the whistle.", z: 1, tight: 1, lead: 1, stiff: 1 },
  { id: "tight", n: "Tight", d: "Stays close on the ball the whole play. You see the man; you see less of the field.", z: 1.22, tight: 1.45, lead: 0.75, stiff: 1.35 },
  { id: "wide", n: "Wide", d: "Keeps the whole route tree and the pursuit in frame. Barely zooms at all.", z: 0.8, tight: 0.3, lead: 1.25, stiff: 0.85 },
  { id: "fixed", n: "Fixed", d: "The camera never moves — one frame on the line of scrimmage, every play.", z: 1, tight: 0, lead: 0, stiff: 1 },
  /* ===== v145 THE CAMERA FOLLOWS HIM — two follow cams on the end of the list =====
   * Appended, never inserted, so a saved `fxCam` index still names the mode it named. `follow`
   * says WHO the frame is locked to ("me" = the you-player's own marker, "ball" = whoever or
   * whatever has it), `lock` overrides v109's `camPerspLockK` (1 = his on-screen size held constant
   * as he runs through the perspective, so the FIELD moves and he does not), `keep` is how far off
   * dead centre he may drift before the pan drags the field under him. */
  { id: "me", n: "Follow Me", d: "Locks on YOUR player, snap to whistle. He stays big in the middle of the screen and the field moves under him. Off the field this play? It follows the ball.", z: 1.5, tight: 0, lead: 0.45, stiff: 2.8, follow: "me", lock: 1, keep: 0.12 },
  { id: "ball", n: "Follow Ball", d: "Locks on the ball — the carrier, the throw, the catch. Players stay big and the field scrolls past.", z: 1.4, tight: 0, lead: 0.6, stiff: 2.2, follow: "ball", lock: 1, keep: 0.14 },
];
try { window.__CAM_MODES_V112 = CAM_MODES_V112; } catch (e) {}
/* ===== v144 H THE SKY HAS OPTIONS — what Settings offers over the roll =====
 * Index 0 is AUTO: the week's own rolled weather (`__WX_V79`) and time of day (`__WX_DAY_V144`),
 * which is what a player sees unless they pin one. The rest pin a look without touching a single
 * outcome — the sim's weather multipliers are rolled in the engine and this dial never reaches
 * them. `wxV144()` reads the index off `__FIELD_FX.wx`; the panel reads this list, so a sky is
 * described in exactly one place. */
const WX_MODES_V144 = [
  { id: "auto", n: "Auto", d: "Whatever the week rolled — clear, rain or snow, under lights or in the afternoon." },
  { id: "night", n: "Clear night", d: "Under the floodlights, nothing falling. The look the broadcast has always had." },
  { id: "rain", n: "Rain", d: "A steady night rain through the lights. The sim's own wet-ball penalties are rolled by the week, not by this." },
  { id: "snow", n: "Snow", d: "Snow drifting down across the frame, lit from the masts." },
  { id: "day", n: "Sunny day", d: "An afternoon kickoff: blue sky, no stars, and the floodlights down to almost nothing." },
];
try { window.__WX_MODES_V144 = WX_MODES_V144; } catch (e) {}
const REDUCED_MOTION = (() => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } })();
function vib(ms) { try { if (!REDUCED_MOTION && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
const EZ = 66, PLAY_L = EZ, PLAY_R = FW - EZ, PLAY_W = PLAY_R - PLAY_L;
const F_TOP = 14, F_BOT = FH - 14;
/* ===== v6 pixel-broadcast presentation: perspective + procedural sprites =====
 * Sim logic and frame data are untouched — this is purely how frames are DRAWN. */
/* North-south presentation: the field runs vertically and the OFFENSE always
 * attacks toward the top of the screen. VDIR flips the world when possession
 * changes, exactly like a broadcast camera swinging ends. */
/* ===== v28 TRUE PROJECTIVE PERSPECTIVE (v27's piecewise curve retired) =====
 * ONE lateral-scale curve s(u) still drives sprites, the field image's width and the
 * x-spread (the "consistent sizing" rule) — but it is now a genuine pinhole curve,
 * s(u) = 1 / (1 + q·(u − ANCHOR_U)), and the row height integrates s² (a tilted ground
 * plane compresses rows quadratically while widths shrink linearly). That pair is a real
 * projective map, so every straight line in the art stays STRAIGHT on screen — v27's
 * taper-then-floor curve bent the sidelines into a mid-field kink ("the far half warps").
 * q is derived from the same dials: scale is exactly (1 − fxDepth) at fieldRadius() world
 * px past the anchor, no floor needed (s never reaches 0, so no horizon). Behind the
 * anchor s expands like a real camera, clamped at PERSP_BACKMAX so it can't blow up.
 * PJ projects: y = VB·(total − ∫s²), x-spread ∝ s, sprite scale ∝ s; the uploaded field
 * image is re-warped through the SAME mapping into a canvas texture each snap
 * (warpField), with its edge pixels stretched sideways so grass always fills the frame.
 * The old CSS rotateX on the #field canvas is dead — applyFieldFx clears it. */
let VDIR = 1, ANCHOR_U = null, PERSP = null;
// NSTOP is the field's top margin inside the warp canvas — everything above the far
// end line. It used to be 30px, which was invisible and therefore fine. The v57 END
// ZONE stands live in that band (they sit BEHIND the end line, so they project above
// it), and 30px is nowhere near enough: they landed at negative world y, outside the
// camera bounds, and never drew. Raising it costs a little of the warp canvas's
// height budget (VB's cap below) and shifts the whole projection down uniformly —
// the camera centres on focusPt, which moves with it, so framing is unchanged.
const NSTOP = 340, NSH = 1340, WORLD_H = 2800;
const PERSP_OA = 1.45, PERSP_AB = 46;          // art overscan; anchor sits ~8 yds behind the LOS
const PERSP_BACKMAX = 1.2;                     // behind-anchor magnification cap
function fieldRadius() { const r = (window.__FIELD_FX || {}).radius; return r == null ? 300 : r; }
function buildPersp() {
  if (ANCHOR_U == null) { PERSP = null; return; }
  const FX = window.__FIELD_FX || {};
  const dp = Math.max(0, Math.min(0.9, FX.depth == null ? 0.78 : +FX.depth));   // v105: 78% by default — most of the field in the frame
  const R = Math.max(60, fieldRadius());
  /* ===== v112 THE CAMERA STOPS CLOSING IN BEHIND THE BACKFIELD =====
   * 1/q is only ~85 world px at the shipped depth, so the pinhole's own centre sits a few yards
   * behind the anchor: s runs away there and PERSP_BACKMAX is what stops it. That cap is not a
   * camera any more, it is a floor, and 1.2 was never chosen against the ART. At 1.2 the near
   * band is laid out at 1.44x the row density and 1.2x the width of the anchor row, which draws
   * a 360x700 painting of a field at ELEVEN times its own resolution — the stretched, mushed
   * near edge, with the touchlines running dead parallel through it because a clamped s does
   * not converge. Capping at 1.0 says the plain thing instead: past the backfield the camera
   * stops closing in, and the ground behind it is drawn at the anchor's own scale. It takes a
   * third out of the vertical blow-up and a sixth out of the horizontal one, at the only place
   * it can honestly be taken from — these rows ARE the projection every sprite, stand and
   * shadow is placed by, so turf and men move together or not at all.
   * Nothing downfield of the anchor moves. VB, the row budget, is still measured against v28's
   * own backdrop (mkC at PERSP_BACKMAX) so it cannot change branch; and past the clamp point
   * both integrals lose exactly the same amount, so `total - C(u)` — the whole of a row's
   * position — is unchanged. `nearCapV112` at PERSP_BACKMAX puts v28 back exactly. */
  const AU = ANCHOR_U, kMax = Math.max(1, Math.min(PERSP_BACKMAX, TU("nearCapV112", 1)));
  const q = dp / ((1 - dp) * R);         // pinhole rate: s(AU + R) = 1 − dp, same dial meaning as v27
  const mkS = (km) => (u) => Math.min(km, 1 / Math.max(1 / km, 1 + q * (u - AU)));
  const mkC = (km) => (u) => {           // ∫0..u s² dt (piecewise, closed-form)
    if (q <= 0) return u;
    const uc = AU - (1 - 1 / km) / q;    // where the behind-anchor clamp engages
    let c = 0;
    const cl = Math.max(0, Math.min(u, uc));
    if (cl > 0) c += km * km * cl;
    const lo = Math.max(0, uc);
    if (u > lo) { const G = (t) => -1 / (q * (1 + q * (t - AU))); c += G(u) - G(lo); }
    return c;
  };
  const s = mkS(kMax), C = mkC(kMax);
  const sN = s(AU + PERSP_AB);           // normalizer: the LOS row keeps the pre-v27 baseline size
  const total = C(FW);
  // ideal row density keeps the LOS yard spacing of the flat view; cap it so the whole
  // projected field always fits inside the WORLD_H warp canvas
  const VB0 = Math.min(2 * PERSP_OA / (sN * sN), (WORLD_H - NSTOP - 10) / Math.max(1, mkC(PERSP_BACKMAX)(FW)));
  /* ===== v148 THE LINES HOLD TO THE GOAL LINE =====
   * VB is the row density — how many canvas rows a unit of ground gets — and the line above made
   * it pay for the WHOLE field fitting in the WORLD_H canvas, measured from wherever the anchor
   * happened to be. The anchor rides the LOS, so the further the drive got the more field lay
   * behind it and the lower VB went: 6.91 at the own 20, 4.72 at midfield, 2.68 on the goal line
   * at the shipped depth. Widths never read VB, so the ground was squashed top to bottom and
   * nowhere else — at the LOS row the picture is isotropic (17 px a yard both ways) on the own
   * 20 and 39% as tall as it is wide on the goal line. Every yard line, hash and number near the
   * attacking end zone crowded together under full-size players, and the end zone itself came
   * out a third of its depth; any zoom (the follow cams most of all, which ride up to 4.6x on
   * exactly that stretch) blew the squash up to fill the frame.
   * The density is now ONE number for the whole drive: the one the field has with the anchor
   * where a drive starts (`rowRefYdV148`, the own 25 — the ideal at the shipped depth, and
   * still the budget's cap at a depth where the budget binds even there). It no longer depends
   * on where the ball is. What pays for the canvas instead is ground nobody can see: everything
   * within `rowKeepYdV148` yards behind the clamp point keeps its full density, and past that
   * the ground recedes the way it recedes ahead of the anchor — a pinhole looking the other way,
   * s = kMax / (1 + (uk − u)/L), rows ∝ s², with `L` solved in closed form so the near end line
   * lands on the old budget row. Rows AND widths taper together, so a yard there is still a
   * square yard and a man there shrinks with the ground under him (it is only ever on screen
   * for a long return the wrong way). The far end line still sits on NSTOP, and the sprites,
   * stands and turf all read this same s and C, so they move together. `TU("v148", 0)` is the
   * old per-snap cap exactly. */
  let VB = VB0, Cf = C, sf = s, d0 = kMax * kMax, taper = null;
  if (TU("v148", 1) && q > 0) {
    const AUr = PLAY_L + Math.max(0, Math.min(100, TU("rowRefYdV148", 25))) / 100 * PLAY_W - PERSP_AB;
    const qr = (u) => { const uc = AUr - (1 - 1 / PERSP_BACKMAX) / q; let c = PERSP_BACKMAX * PERSP_BACKMAX * Math.max(0, Math.min(u, uc));
      const lo = Math.max(0, uc); if (u > lo) { const G = (t) => -1 / (q * (1 + q * (t - AUr))); c += G(u) - G(lo); } return c; };
    VB = Math.min(2 * PERSP_OA / (sN * sN), (WORLD_H - NSTOP - 10) / Math.max(1, qr(FW)));   // the drive-start density, not this snap's
    const room = (WORLD_H - NSTOP - 10) / VB, km2 = kMax * kMax;
    const uc = Math.max(0, Math.min(FW, AU - (1 - 1 / kMax) / q)), head = C(FW) - C(uc);
    if (C(FW) > room) {
      const avail = room - head;
      const keep = Math.min(uc, Math.max(0, TU("rowKeepYdV148", 25)) * PLAY_W / 100, Math.max(0, avail) * TU("rowKeepShareV148", 0.85) / km2);
      const uk = uc - keep, need = avail - km2 * keep;
      // ∫0..uk km²/(1 + (uk − t)/L)² dt = km²·L·uk/(L + uk): solve it for L
      if (uk > 0 && need > 0 && km2 * uk > need) {
        const L = (need / km2) * uk / (uk - need / km2), Ck = km2 * L * uk / (L + uk), Cuk = C(uk);
        Cf = (u) => u >= uk ? Ck + C(u) - Cuk : Ck - km2 * L * (uk - Math.max(0, u)) / (L + uk - Math.max(0, u));
        sf = (u) => u >= uk ? s(u) : kMax / (1 + (uk - u) / L);
        d0 = sf(0) * sf(0); taper = { uk: +uk.toFixed(1), L: +L.toFixed(1), keep: +keep.toFixed(1), s0: +sf(0).toFixed(3) };
      } else VB = VB0;                                // the ground ahead alone will not fit: the old cap, as before
    }
  }
  const total148 = Cf(FW);
  PERSP = { s: sf, C: Cf, total: total148, sN, VB, kMax, d0, VB0, taper };
  try { window.__V148 = Object.assign(window.__V148 || {}, { VB: +VB.toFixed(3), VB0: +VB0.toFixed(3), ideal: +(2 * PERSP_OA / (sN * sN)).toFixed(3), sN: +sN.toFixed(4), AU: +AU.toFixed(1), taper, lastRow: +(NSTOP + VB * total148).toFixed(1) }); } catch (e) {}
}
function perspK(x) {
  // carrier-lock helper: the pure perspective ratio at sim-x (1 at the LOS row)
  const u = VDIR > 0 ? x : FW - x;
  return PERSP ? PERSP.s(u) / PERSP.sN : 1;
}
function PJ(x, y) {
  // v27: ONE consistent perspective. Position AND size come from the same curve s(u), so a
  // player and the yard number he stands on always shrink together. Falls back to the flat
  // orthographic map until the first snap builds PERSP.
  const u = VDIR > 0 ? x : FW - x;                       // distance advanced toward the attacking end
  const v = VDIR > 0 ? y : (F_TOP + F_BOT) - y;          // mirror across so left/right stay coherent
  const _FX = window.__FIELD_FX || {};
  const _sp = _FX.spread == null ? 1 : _FX.spread, _sz = _FX.size == null ? 1.32 : _FX.size;
  const P = PERSP;
  /* v80 LATERAL CALIBRATION: the field ART draws its painted touchlines to true
   * scale, ~16% wider than the raw lateral map put the sim's F_TOP/F_BOT — so a
   * carrier "stepped out" four yards inside the painted boundary, and v72's fix
   * (rows reconciled by goal lines) had no lateral counterpart. latCal is that
   * counterpart: it scales the ONE place world-lateral becomes screen-x, so the
   * sim's boundary now lands ON the painted line at every depth. 1.16 = the
   * painted line's measured world position (239, warp-canvas probe, constant in
   * depth) over the sim half-width (206); sidelinecheck's luminance probe
   * asserts the coincidence, so drift here fails a check instead of moving the
   * boundary. Applied inside PJ/crowdProject only — the art (AW) is untouched,
   * which is the point: the world stretches to meet the art, not the reverse. */
  const _lc = 1.30 * TU("latCal", 1.16);
  if (!P) return { x: FW / 2 + (v - (F_TOP + F_BOT) / 2) * (_lc * _sp), y: NSTOP + (1 - u / FW) * NSH, s: _sz * 0.80 };
  const k = P.s(u) / P.sN;                               // 1.0 at the LOS row; <1 downfield, >1 behind
  return { x: FW / 2 + (v - (F_TOP + F_BOT) / 2) * (_lc * _sp * PERSP_OA * k),
           y: NSTOP + P.VB * (P.total - P.C(u)),
           s: _sz * 0.80 * k };
}
const OFF_NUMS = [80, 81, 87, 72, 74, 75, 76, 77, 12, 24, 83];
const DEF_NUMS = [21, 29, 31, 38, 52, 54, 56, 91, 95, 97, 94];
/* ===== RIB ART: real sprite atlas + 40-palette team recolor engine ===== */
window.__RIB_LOGOS_V44 = window.__RIB_ASSET("rib_logos_v44.png");
window.__RIB_FIELD = window.__RIB_ASSET("rib_field_base.jpg");
window.__RIB_ATLAS = window.__RIB_ASSET("rib_atlas_base.png");
window.__RIB_ATLAS_V22 = window.__RIB_ASSET("rib_atlas_v22.png");
window.__RIB_REFS_V49 = window.__RIB_ASSET("rib_refs_v49.png");
window.__RIB_WHEEL_V50 = window.__RIB_ASSET("rib_wheel_v50.png");
window.__RIB_CROWD_V57 = window.__RIB_ASSET("rib_crowd_v57.png");
window.__RIB_PLAN_V66 = window.__RIB_ASSET("rib_plan_v66.png");
window.__RIB_SKILL_V64 = window.__RIB_ASSET("rib_skill_v64.png");
window.__RIB_SIDE_V78 = window.__RIB_ASSET("rib_side_v78.png");
const RIB_META = {"run_dn0": [0, 0], "run_dn1": [1, 0], "run_dn2": [2, 0], "run_dn3": [3, 0], "run_dn4": [4, 0], "run_dn5": [5, 0], "run_dn6": [6, 0], "run_dn7": [7, 0], "run_dr0": [0, 1], "run_dr1": [1, 1], "run_dr2": [2, 1], "run_dr3": [3, 1], "run_dr4": [4, 1], "run_dr5": [5, 1], "run_dr6": [6, 1], "run_dr7": [7, 1], "run_sd0": [0, 2], "run_sd1": [1, 2], "run_sd2": [2, 2], "run_sd3": [3, 2], "run_sd4": [4, 2], "run_sd5": [5, 2], "run_sd6": [6, 2], "run_sd7": [7, 2], "run_ur0": [0, 3], "run_ur1": [1, 3], "run_ur2": [2, 3], "run_ur3": [3, 3], "run_ur4": [4, 3], "run_ur5": [5, 3], "run_ur6": [6, 3], "run_ur7": [7, 3], "run_up0": [0, 4], "run_up1": [1, 4], "run_up2": [2, 4], "run_up3": [3, 4], "run_up4": [4, 4], "run_up5": [5, 4], "run_up6": [6, 4], "run_up7": [7, 4], "idle_dn": [0, 5], "idle_up": [1, 5], "idle_sd": [2, 5], "stance_dn": [3, 5], "stance_up": [4, 5], "dive0": [5, 5], "dive1": [6, 5], "dive2": [7, 5], "dive3": [0, 6], "down0": [1, 6], "down1": [2, 6], "grab": [3, 6], "catch": [4, 6], "block_dn0": [5, 6], "block_dn1": [6, 6], "block_dn2": [7, 6], "block_dn3": [0, 7], "block_dn4": [1, 7], "block_dn5": [2, 7], "block_up0": [3, 7], "block_up1": [4, 7], "block_up2": [5, 7], "block_up3": [6, 7], "block_up4": [7, 7], "block_up5": [0, 8], "block_sd0": [1, 8], "block_sd1": [2, 8], "block_sd2": [3, 8], "block_sd3": [4, 8], "block_sd4": [5, 8], "block_sd5": [6, 8], "ball": [7, 8], "throw0": [0, 9], "throw1": [1, 9], "throw2": [2, 9], "throw3": [3, 9], "throw4": [4, 9], "throw5": [5, 9]};
const TEAM_PALETTES = window.TEAM_PALETTES = [["#2f9e4f","#e8c86a"],["#c8414b","#c3c9d2"],["#1f4fd0","#ffffff"],["#e07020","#ffffff"],["#12855e","#f2d24e"],["#7a2ea0","#e0d6ee"],["#c8102e","#ffb612"],["#003594","#ffb612"],["#0b6623","#ffffff"],["#5a1414","#c9a44a"],["#101820","#a5acaf"],["#4b92db","#ffffff"],["#aa0000","#b3995d"],["#0c2340","#c8102e"],["#ff7900","#101820"],["#5f259f","#ffc72c"],["#0085ca","#101820"],["#d50a0a","#8c8c8c"],["#125740","#ffffff"],["#7c1415","#ffd100"],["#003f2d","#c0c0c0"],["#241773","#9e7c0c"],["#fb4f14","#101820"],["#311d00","#ff8200"],["#006778","#d7a22a"],["#a71930","#ffffff"],["#002244","#69be28"],["#97233f","#ffb612"],["#0b2265","#a71930"],["#004c54","#a5acaf"],["#ffb612","#101820"],["#008e97","#f58220"],["#4f2683","#ffc62f"],["#002c5f","#a2aaad"],["#d3bc8d","#101820"],["#0080c6","#ffc20e"],["#773141","#c5b358"],["#136d6f","#e8e0c2"],["#2c5e4f","#e57200"],["#3d3d6b","#e6e6fa"],
/* v44 emblem-matched palettes (40-52): added so every emblem has a kit that reads as its own colors */
["#3d4a57","#59e0f0"],["#6b4423","#d9b380"],["#bcd8e8","#26547c"],["#7d8791","#e8e4d8"],["#15151c","#d50a0a"],["#69be28","#0b3d0b"],["#15181e","#d4a017"],["#f5f5f5","#26262e"],["#c0c5cc","#d4a017"],["#101820","#2ec4b6"],["#4a5d3a","#8fae6b"],["#2a7fd4","#bfe6ff"],["#bf5700","#f2e3c6"]];
const RIB = { img: null, ready: false, loaded: false, pendingScene: null, teams: {}, defName: null, cellCache: {}, v22img: null, v22cache: {}, refImg: null, refCache: {}, sideImg: null, sideCache: {}, crowdImg: null, crowdCache: {}, crowdAisle: {}, crowdTrim: {}, teamCols: {}, teamDeco: {}, regScenes: [], numBandSrc: {}, numBandTex: {}, numFont: null, numLast: null, numPlaced: 0 };
function ribHash(str) { let h = 0; for (let i = 0; i < (str || "").length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; }
/* ===== v44 TEAM EMBLEMS: 90 real logos, name -> emblem matching, emblem -> palette matching ===== */
/* The packed sheet (public/rib_logos_v44.png, built by scripts/spritekit/pack_logos.mjs) is a
 * 10x9 grid of 128px cells. LOGO_DB is in sheet order; each entry names its emblem and points at
 * the TEAM_PALETTES index whose kit reads as that emblem's own colors (indices 40+ were added
 * for combos the original 40 didn't cover). */
const LOGO_COLS = 10, LOGO_ROWS = 9, LOGO_CELL = 128;
const LOGO_SHEET_URL = window.__RIB_LOGOS_V44 || "/rib_logos_v44.png";
const LOGO_DB = [
  { n: "Wolf", p: 40 }, { n: "Grizzly", p: 41 }, { n: "Panther", p: 10 }, { n: "Eagle", p: 7 }, { n: "Gator", p: 8 },
  { n: "Shark", p: 11 }, { n: "Bull", p: 1 }, { n: "Boar", p: 17 }, { n: "Ram", p: 34 }, { n: "Bison", p: 23 },
  { n: "Tiger", p: 14 }, { n: "Lion", p: 30 }, { n: "Jaguar", p: 24 }, { n: "Hawk", p: 33 }, { n: "Polar Bear", p: 42 },
  { n: "Cobra", p: 10 }, { n: "Dragon", p: 4 }, { n: "Rhino", p: 43 }, { n: "Phoenix", p: 22 }, { n: "Octopus", p: 5 },
  { n: "Gorilla", p: 10 }, { n: "Owl", p: 43 }, { n: "Scorpion", p: 44 }, { n: "Mantis", p: 45 }, { n: "Hyena", p: 34 },
  { n: "Yeti", p: 42 }, { n: "Stag", p: 41 }, { n: "Jackal", p: 46 }, { n: "Unicorn", p: 47 }, { n: "Sea Serpent", p: 37 },
  { n: "Spartan", p: 6 }, { n: "Knight", p: 2 }, { n: "Viking", p: 3 }, { n: "Samurai", p: 12 }, { n: "Trojan", p: 19 },
  { n: "King", p: 7 }, { n: "Barbarian", p: 41 }, { n: "Cavalier", p: 7 }, { n: "Paladin", p: 48 }, { n: "Pirate", p: 10 },
  { n: "Outlaw", p: 9 }, { n: "Phantom", p: 39 }, { n: "Reaper", p: 49 }, { n: "Golem", p: 50 }, { n: "Frost Knight", p: 51 },
  { n: "Sorcerer", p: 45 }, { n: "Demon", p: 10 }, { n: "Sun King", p: 30 }, { n: "Moon Knight", p: 21 }, { n: "Crow", p: 39 },
  { n: "Berserker", p: 41 }, { n: "War Boar", p: 17 }, { n: "War Wolf", p: 40 }, { n: "Royal Lion", p: 7 }, { n: "Wyvern", p: 44 },
  { n: "Scarab", p: 24 }, { n: "Drake", p: 20 }, { n: "Valkyrie", p: 48 }, { n: "Flail", p: 43 }, { n: "Inferno", p: 22 },
  { n: "Killer Bee", p: 30 }, { n: "Green Mantis", p: 45 }, { n: "Black Scorpion", p: 39 }, { n: "Widow", p: 44 }, { n: "Firefly", p: 45 },
  { n: "Hornet", p: 30 }, { n: "Centipede", p: 44 }, { n: "Crab", p: 17 }, { n: "Sasquatch", p: 0 }, { n: "Nessie", p: 37 },
  { n: "Storm", p: 40 }, { n: "Bolt", p: 35 }, { n: "Wildfire", p: 22 }, { n: "Iceberg", p: 51 }, { n: "Volcano", p: 22 },
  { n: "Meteor", p: 14 }, { n: "Express", p: 13 }, { n: "Forge", p: 23 }, { n: "Oiler", p: 46 }, { n: "Lumberjack", p: 17 },
  { n: "Summit", p: 43 }, { n: "Swamp Thing", p: 50 }, { n: "Longhorn", p: 52 }, { n: "Angler", p: 33 }, { n: "Kraken", p: 16 },
  { n: "Salt", p: 47 }, { n: "Lighthouse", p: 13 }, { n: "Invader", p: 45 }, { n: "Jolly Roger", p: 10 }, { n: "Mine", p: 43 },
];
/* First match wins, so specific names sit above generic ones (polar bear before bear,
 * timberwolves hits the wolf rule before "timber" can reach the lumberjack rule, etc). */
const LOGO_RULES = [
  [/polar/, 14], [/yeti|abominable/, 25], [/bigfoot|sasquatch|squatch/, 68],
  [/wolf|wolves|lobo/, 0], [/wolverine/, 24],
  [/grizzl|bruin|\bbears?\b|\bcubs?\b|kodiak|bearcat/, 1],
  [/panther|cougar|puma|wildcat|bobcat|lynx|predator|prowler|claw/, 2],
  [/eagle/, 3], [/gator|croc|reptile|raptor|dino/, 4], [/shark|\bfins?\b/, 5],
  [/longhorn|steer/, 82], [/bull(?!dog|frog)|toro|matador|\box(en)?\b/, 6],
  [/razorback|warthog|\bboars?\b|\bhogs?\b|\bpigs?\b/, 7],
  [/\brams?\b|bighorn|\bgoats?\b/, 8], [/bison|buffalo|stampede|herd/, 9],
  [/tiger/, 10], [/royal|regal|pride/, 53], [/lion/, 11],
  [/jaguar|leopard|cheetah/, 12],
  [/hawk|falcon|raven|talon|vulture|buzzard|cardinal|thunderbird/, 13],
  [/hydra|leviathan|sea serpent|serpent of/, 29],
  [/cobra|viper|snake|serpent|python|rattl|diamondback|venom|fang/, 15],
  [/wyvern/, 54], [/\bdrakes?\b/, 56], [/dragon/, 16],
  [/rhino/, 17], [/phoenix|firebird/, 18], [/kraken|wave|tide|tsunami|surge/, 84], [/octop/, 19],
  [/gorilla|\bapes?\b|kong|silverback|primate/, 20], [/\bowls?\b/, 21],
  [/mantis/, 23], [/scorpion/, 22], [/stinger|hornet|wasp|yellow ?jacket|sting/, 65], [/\bbees?\b|bumble/, 60],
  [/hyena|coyote|dingo/, 24], [/stag|deer|\bbucks?\b|\belks?\b|moose|caribou|antler/, 26],
  [/anubis|jackal|pharaoh|sphinx/, 27], [/bulldog|\bdogs?\b|husky|hound|terrier|mastiff|canine/, 27],
  [/unicorn|colt|mustang|stallion|bronco|filly|horse/, 28],
  [/void|abyss|phantom|ghost|wraith|specter|spectre|shadow/, 41], [/meteor|comet|asteroid/, 75],
  [/spartan|gladiator/, 30], [/trojan|titan|giant|colossus/, 34],
  [/knight/, 31], [/viking|norse|raider of the north/, 32], [/samurai|shogun|ronin/, 33],
  [/king|sovereign|emperor|empire|monarch|reign|crown/, 35],
  [/berserk|shaman/, 50], [/barbarian|savage|brute|warrior|legion|soldier|brave/, 36],
  [/cavalier|musketeer|cavalry|lancer/, 37], [/paladin|crusader|templar|guardian/, 38],
  [/jolly roger|skull ?(and|&) ?bones/, 88], [/pirate|buccaneer|corsair|swashbuckl/, 39],
  [/raider|bandit|outlaw|renegade|rebel|desperado|gunslinger/, 40],
  [/reaper|grim/, 42], [/golem|\brocks?\b|boulder|stone/, 43],
  [/iceberg|glacier/, 73], [/frost|blizzard|\bice\b|icemen|polar vortex/, 44],
  [/sorcer|wizard|warlock|mage|magic|hex/, 45], [/demon|devil|diablo/, 46],
  [/\bsuns?\b|solar|\bstars?\b|all-? ?star/, 47], [/moon|lunar|crescent|eclipse|night/, 48],
  [/crow|plague/, 49], [/valkyrie|angel|seraph/, 57], [/flail|mace|chain|hammer/, 58],
  [/widow|spider|arachn|tarant/, 63], [/firefl|lightning bug/, 64], [/centipede|millipede/, 66],
  [/crab/, 67], [/nessie|loch|sea monster/, 69],
  [/storm|thunder|tempest|cyclone|hurricane|monsoon|typhoon|nebula/, 70],
  [/\bbolts?\b|lightning|charger|electric|volt|shock|blitz/, 71],
  [/wildfire|inferno|hellfire|blaze|flame|\bfires?\b/, 72], [/volcano|lava|magma/, 74],
  [/\bjets?\b|rocket|missile/, 75],
  [/express|train|locomotive|railroad|railer|steamer/, 76],
  [/steel|forge|anvil|\biron\b|smith/, 77], [/oiler|driller|derrick|gusher|crude/, 78],
  [/lumberjack|logger|axemen|woodsmen|timber/, 79],
  [/summit|mountain|peak|alpine|avalanche/, 80], [/swamp|bog|bayou|marsh/, 81],
  [/angler|piranha|barracuda/, 83], [/\bsalt\b/, 85], [/lighthouse|beacon|keeper/, 86],
  [/\bufo\b|alien|invader|martian|saucer|cosmo|galaxy|astro|andromeda|europa/, 87],
  [/\bmines?\b|miner/, 89],
];
function logoForName(name) {
  if (!name) return null;
  const s = String(name).toLowerCase();
  for (let i = 0; i < LOGO_RULES.length; i++) if (LOGO_RULES[i][0].test(s)) return LOGO_RULES[i][1];
  return ribHash(s.replace(/[^a-z]/g, "")) % LOGO_DB.length;   // deterministic per name, never random
}
function logoPalIdx(i) { const d = LOGO_DB[((Number(i) || 0) % 90 + 90) % 90]; return d ? d.p : 0; }
/* The sheet is a baked multi-MB data URL, so the image reference lives in ONE shared CSS
 * rule (.emblem-v44) instead of every element's inline style; logoCSS() only emits the
 * per-cell size/position. cssFull() (image included) exists for detached documents like
 * the uniform-preview popup, which can't see this page's stylesheet. */
(function () {
  const st = document.createElement("style");
  st.textContent = `.emblem-v44{background-image:url("${LOGO_SHEET_URL}")!important;background-repeat:no-repeat!important}`;
  (document.head || document.documentElement).appendChild(st);
})();
function logoCSS(i) {
  // %-based sprite cell: sizes with the element, so the same call serves a 20px chip
  // or a 100px crest (background-position p% pins the p% point of the sheet to the box)
  i = ((Number(i) || 0) % 90 + 90) % 90;
  const c = i % LOGO_COLS, r = Math.floor(i / LOGO_COLS);
  return `background-size:${LOGO_COLS * 100}% ${LOGO_ROWS * 100}%;background-position:${(c / (LOGO_COLS - 1) * 100).toFixed(3)}% ${(r / (LOGO_ROWS - 1) * 100).toFixed(3)}%`;
}
window.TEAM_LOGOS_V44 = {
  db: LOGO_DB, url: LOGO_SHEET_URL, cols: LOGO_COLS, cell: LOGO_CELL,
  forName: logoForName, palIdx: logoPalIdx,
  pal: (i) => TEAM_PALETTES[logoPalIdx(i)] || TEAM_PALETTES[0],
  name: (i) => (LOGO_DB[((Number(i) || 0) % 90 + 90) % 90] || {}).n || "",
  css: logoCSS,
  cssFull: (i) => `background-image:url('${LOGO_SHEET_URL}');background-repeat:no-repeat;${logoCSS(i)}`,
};
// the emblem sheet decodes up-front, like the sprite atlas; the field compositor waits on it
(function () {
  const img = new Image();
  img.onload = () => { RIB.logoImg = img; if (RIB._fieldLogo != null) ribApplyFieldLogo(RIB._fieldLogo, true); };
  img.onerror = () => console.warn("[v44] emblem sheet failed to load — letter marks stand in");
  img.src = LOGO_SHEET_URL;
})();
/* ===== v93 THE HOME END ZONES — the paint belongs to whoever owns the stadium =====
 * The shipped art has two navy end zones lettered TOUCHDOWN and END ZONE. A stadium
 * paints its end zones in the HOME team's colours with the home team's name, so the
 * field now says whose ground it is: week 1 is at home (the schedule carries `home`,
 * alternating; playoffs alternate by round), an away week wears the opponent's kit
 * palette — the same one ribSyncOpp registers for their jerseys — and both end zones
 * carry that team's name, the near one upside down as on the art. The paint goes on
 * the FLAT art inside ribApplyFieldLogo (before the crest), so warpField carries it
 * through the perspective like the turf; ribSyncEndZonesV93 recomposites only when
 * the (home, palette, name) key changes. The band geometry was measured on the shipped
 * 360x700 art and scales with it. Render-only. */
function ribEndZoneBandsV93(base) {
  const kx = base.width / 360, ky = base.height / 700;
  return { x0: TU("ezX0", 27) * kx, x1: TU("ezX1", 331) * kx,
    far: { y0: TU("ezFarY0", 37) * ky, y1: TU("ezFarY1", 84) * ky }, near: { y0: TU("ezNearY0", 616) * ky, y1: TU("ezNearY1", 663) * ky } };
}
function ribPaintEndZonesV93(ctx, base) {
  const Z = RIB._ezV93; if (!Z || !Z.cols) return 0;
  const B = ribEndZoneBandsV93(base), W = B.x1 - B.x0;
  const shade = (hex, k) => { const n = parseInt(String(hex).replace("#", ""), 16); const ch = (sh) => Math.max(0, Math.min(255, Math.round(((n >> sh) & 255) * k))); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; };
  let painted = 0;
  for (const end of ["far", "near"]) {
    // v97: the far end zone — the one the offense attacks — says TOUCHDOWN in the user's colours;
    // the near one is the opponent's, painted in their palette with their name facing their way
    const E = (Z.ends && Z.ends[end]) || { cols: Z.cols, label: Z.name };
    const cols = E.cols || Z.cols, label = String(E.label || "").toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim() || "END ZONE";
    const b = B[end], H = b.y1 - b.y0;
    ctx.save();
    ctx.fillStyle = shade(cols[0], TU("ezShade", 0.82)); ctx.fillRect(B.x0, b.y0, W, H);   // the paint, a shade under the jersey
    // a faint diagonal weave so the block reads as painted turf, not a flat rectangle
    ctx.globalAlpha = TU("ezWeave", 0.10); ctx.fillStyle = "#000";
    for (let x = B.x0 - H; x < B.x1; x += 8 * (base.width / 360)) { ctx.beginPath(); ctx.moveTo(x, b.y1); ctx.lineTo(x + H, b.y0); ctx.lineTo(x + H + 3, b.y0); ctx.lineTo(x + 3, b.y1); ctx.closePath(); ctx.fill(); }
    ctx.globalAlpha = 1;
    // the name, sized to the band, upright at the far end and upside down at the near
    ctx.translate((B.x0 + B.x1) / 2, (b.y0 + b.y1) / 2); if (end === "near") ctx.rotate(Math.PI);
    let px = Math.floor(H * TU("ezFontK", 0.78));
    ctx.font = `bold ${px}px Oswald, Impact, "Arial Black", sans-serif`;
    const maxW = W * TU("ezTextW", 0.86); const mw = ctx.measureText(label).width; if (mw > maxW) { px = Math.max(8, Math.floor(px * maxW / mw)); ctx.font = `bold ${px}px Oswald, Impact, "Arial Black", sans-serif`; }
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = Math.max(1, px * 0.09); ctx.strokeStyle = shade(cols[0], 0.45); ctx.strokeText(label, 0, 1);   // a dark rim keeps a light name off a light paint
    ctx.fillStyle = cols[1] || "#ffffff"; ctx.fillText(label, 0, 1);
    ctx.restore(); painted++;
  }
  return painted;
}
function ribSyncEndZonesV93(scene) {
  try {
    if (!TU("homeEndZones", 1)) return false;
    const names = scene && scene.teamNames ? scene.teamNames() : { us: "HOME", them: "AWAY" };
    const home = window.__homeGameV93 !== false;                          // no word from the career app: at home
    const usIdx = (window.__GRIDIRON_TEAM_CUSTOM__ && window.__GRIDIRON_TEAM_CUSTOM__.palette) || 0;
    const usPal = TEAM_PALETTES[usIdx] || TEAM_PALETTES[0];
    const cols = home ? [usPal[0], usPal[1]] : (RIB.defPal || [usPal[0], usPal[1]]);
    const name = home ? names.us : names.them;
    // v97: two ends, two stories — TOUCHDOWN in the user's colours where the offense scores, the
    // opponent's name in the opponent's colours at the near end, lettered to face their bench
    const oppCols = RIB.defPal || [usPal[0], usPal[1]];
    const ends = { far: { cols: [usPal[0], usPal[1]], label: TU("ezFarLabel", 1) ? "TOUCHDOWN" : names.us }, near: { cols: oppCols, label: names.them } };
    const key = (home ? "H:" : "A:") + cols.join("/") + ":" + name + "|" + ends.far.cols.join("/") + ":" + ends.far.label + "|" + ends.near.cols.join("/") + ":" + ends.near.label;
    if (RIB._ezV93 && RIB._ezV93.key === key) return false;
    RIB._ezV93 = { key, home, cols, name, ends };
    ribApplyFieldLogo(RIB._fieldLogo, true);                              // recomposite the flat art, re-warp the field
    window.__V93 = { home, key, name, cols, ends, painted: !!RIB.fieldImg,
      sample: (end) => { try { const im = RIB.fieldImg; const B = ribEndZoneBandsV93(im); const b = B[end || "far"]; const cv = document.createElement("canvas"); cv.width = im.width; cv.height = im.height;
        const c = cv.getContext("2d", { willReadFrequently: true }); c.drawImage(im, 0, 0); const d = c.getImageData(Math.round(B.x0), Math.round(b.y0), Math.round(B.x1 - B.x0), Math.round(b.y1 - b.y0)).data;
        const S2 = (RIB._ezV93.cols[1] || "#ffffff").replace("#", ""), sr = parseInt(S2.slice(0, 2), 16), sg = parseInt(S2.slice(2, 4), 16), sb = parseInt(S2.slice(4, 6), 16);
        let r = 0, g = 0, bl = 0, n = 0, lit = 0, sec = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; bl += d[i + 2]; n++; if (d[i] + d[i + 1] + d[i + 2] > 540) lit++; if (Math.abs(d[i] - sr) + Math.abs(d[i + 1] - sg) + Math.abs(d[i + 2] - sb) < 90) sec++; }
        return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(bl / n), n, lit, sec }; } catch (e) { return null; } },
      set: (h) => { window.__homeGameV93 = !!h; return ribSyncEndZonesV93(RIB.fieldScene); } };
    return true;
  } catch (e) { return false; }
}
function ribApplyFieldLogo(idx, force) {
  // Paint the home team's emblem onto the FLAT field art at the 50 (the art's exact center:
  // PLAY_L + PLAY_W/2 === FW/2). warpField() re-samples RIB.fieldImg every snap, so the logo
  // rides the same perspective curve as the turf, lines and players for free.
  try {
    if (idx == null && !RIB._ezV93) return;
    if (idx != null) RIB._fieldLogo = idx;
    if (!(RIB.fieldBase || RIB.fieldImg)) return;                    // the art hasn't decoded yet
    if (idx != null && !RIB.logoImg) return;                          // the emblem sheet hasn't (v93: end zones wait with it)
    if (!force && RIB._fieldLogoDrawn === idx) return;
    if (!RIB.fieldBase) RIB.fieldBase = RIB.fieldImg;               // keep the clean art for re-composites
    const base = RIB.fieldBase;
    const cv = RIB._fieldLogoCv || (RIB._fieldLogoCv = document.createElement("canvas"));
    cv.width = base.width; cv.height = base.height;
    const ctx = cv.getContext("2d");
    ctx.drawImage(base, 0, 0);
    try { ribPaintEndZonesV93(ctx, base); } catch (e) { console.warn("[v93 end zones]", e); }
    const i = ((Number(idx) || 0) % 90 + 90) % 90;
    const c = i % LOGO_COLS, r = Math.floor(i / LOGO_COLS);
    const w = base.width * TU("fieldLogoSize", 0.44);               // ~23yd across on a 53yd-wide field
    if (idx != null && RIB.logoImg) {
      ctx.globalAlpha = TU("fieldLogoAlpha", 0.8);
      ctx.drawImage(RIB.logoImg, c * LOGO_CELL, r * LOGO_CELL, LOGO_CELL, LOGO_CELL,
        (base.width - w) / 2, (base.height - w) / 2, w, w);
      ctx.globalAlpha = 1;
    }
    RIB.fieldImg = cv; RIB._fieldLogoDrawn = idx;
    window.__fieldLogoStateV44 = { drawn: i, name: (LOGO_DB[i] || {}).n, composited: true, baseW: base.width, crestW: Math.round(w) };
    try { RIB.fieldScene && RIB.fieldScene.refreshPersp && RIB.fieldScene.refreshPersp(); } catch (e) {}
  } catch (e) { console.warn("[v44 field logo]", e); }
}
window.__setFieldLogoV44 = ribApplyFieldLogo;
function ribCell(name) {
  if (RIB.cellCache[name]) return RIB.cellCache[name];
  const mc = RIB_META[name]; if (!mc || !RIB.img) return null;
  const cv = document.createElement("canvas"); cv.width = 48; cv.height = 48;
  const cx = cv.getContext("2d"); cx.imageSmoothingEnabled = false;
  cx.drawImage(RIB.img, mc[0] * 48, mc[1] * 48, 48, 48, 0, 0, 48, 48);
  RIB.cellCache[name] = cv; return cv;
}
/* ===== v22 SPRITE OVERLAY (ADDITIVE) — base run/idle remain the original
 * cells. Uploaded art supplies the short, readable motion moments: catches,
 * jukes, stiff-arms, hurdles, blocking, pancakes, get-ups and tackle falls.
 * Every cell still passes through team recoloring, and a missing overlay always
 * falls back to the original atlas rather than breaking a player marker. */
const RIB_META_V22 = {"dive0":[0,0],"dive1":[1,0],"dive2":[2,0],"dive3":[3,0],"down0":[4,0],"down1":[5,0],"grab":[6,0],"cut_dn":[7,0],"juke_dn0":[8,0],"juke_dn1":[9,0],"juke_dn2":[10,0],"juke_dn3":[11,0],"catch_dn0":[0,1],"divecatch_dn0":[1,1],"hurdle_dn0":[2,1],"catch_dn1":[3,1],"divecatch_dn1":[4,1],"hurdle_dn1":[5,1],"catch_dn2":[6,1],"divecatch_dn2":[7,1],"hurdle_dn2":[8,1],"stiff_dn0":[9,1],"stiff_dn1":[10,1],"stiff_dn2":[11,1],"stiff_dn3":[0,2],"block_dn0":[1,2],"block_dn1":[2,2],"block_dn2":[3,2],"block_dn3":[4,2],"block_dn4":[5,2],"block_dn5":[6,2],"cut_dr":[7,2],"juke_dr0":[8,2],"juke_dr1":[9,2],"juke_dr2":[10,2],"juke_dr3":[11,2],"catch_dr0":[0,3],"divecatch_dr0":[1,3],"hurdle_dr0":[2,3],"catch_dr1":[3,3],"divecatch_dr1":[4,3],"hurdle_dr1":[5,3],"catch_dr2":[6,3],"divecatch_dr2":[7,3],"hurdle_dr2":[8,3],"stiff_dr0":[9,3],"stiff_dr1":[10,3],"stiff_dr2":[11,3],"stiff_dr3":[0,4],"block_dr0":[1,4],"block_dr1":[2,4],"block_dr2":[3,4],"block_dr3":[4,4],"block_dr4":[5,4],"block_dr5":[6,4],"cut_sd":[7,4],"juke_sd0":[8,4],"juke_sd1":[9,4],"juke_sd2":[10,4],"juke_sd3":[11,4],"catch_sd0":[0,5],"divecatch_sd0":[1,5],"hurdle_sd0":[2,5],"catch_sd1":[3,5],"divecatch_sd1":[4,5],"hurdle_sd1":[5,5],"catch_sd2":[6,5],"divecatch_sd2":[7,5],"hurdle_sd2":[8,5],"stiff_sd0":[9,5],"stiff_sd1":[10,5],"stiff_sd2":[11,5],"stiff_sd3":[0,6],"block_sd0":[1,6],"block_sd1":[2,6],"block_sd2":[3,6],"block_sd3":[4,6],"block_sd4":[5,6],"block_sd5":[6,6],"cut_ur":[7,6],"juke_ur0":[8,6],"juke_ur1":[9,6],"juke_ur2":[10,6],"juke_ur3":[11,6],"catch_ur0":[0,7],"divecatch_ur0":[1,7],"hurdle_ur0":[2,7],"catch_ur1":[3,7],"divecatch_ur1":[4,7],"hurdle_ur1":[5,7],"catch_ur2":[6,7],"divecatch_ur2":[7,7],"hurdle_ur2":[8,7],"stiff_ur0":[9,7],"stiff_ur1":[10,7],"stiff_ur2":[11,7],"stiff_ur3":[0,8],"block_ur0":[1,8],"block_ur1":[2,8],"block_ur2":[3,8],"block_ur3":[4,8],"block_ur4":[5,8],"block_ur5":[6,8],"cut_up":[7,8],"juke_up0":[8,8],"juke_up1":[9,8],"juke_up2":[10,8],"juke_up3":[11,8],"catch_up0":[0,9],"divecatch_up0":[1,9],"hurdle_up0":[2,9],"catch_up1":[3,9],"divecatch_up1":[4,9],"hurdle_up1":[5,9],"catch_up2":[6,9],"divecatch_up2":[7,9],"hurdle_up2":[8,9],"stiff_up0":[9,9],"stiff_up1":[10,9],"stiff_up2":[11,9],"stiff_up3":[0,10],"block_up0":[1,10],"block_up1":[2,10],"block_up2":[3,10],"block_up3":[4,10],"block_up4":[5,10],"block_up5":[6,10],"pancake0":[7,10],"pancake1":[8,10],"pancake2":[9,10],"getup0":[10,10],"getup1":[11,10],"getup2":[0,11],"getup3":[1,11]};
function ribCellV22(name) {
  if (!RIB.v22img) return null;
  const mc = RIB_META_V22[name]; if (!mc) return null;
  if (RIB.v22cache[name]) return RIB.v22cache[name];
  const cv = document.createElement("canvas"); cv.width = 48; cv.height = 48;
  const cx = cv.getContext("2d"); cx.imageSmoothingEnabled = false;
  cx.drawImage(RIB.v22img, mc[0] * 48, mc[1] * 48, 48, 48, 0, 0, 48, 48);
  RIB.v22cache[name] = cv; return cv;
}
/* ===== v91 THE FIELD SHEETS — eight facings, the get-up, the celebration, the ball =====
 * Eight hand-drawn sheets (art/field/) cut by scripts/build-field-art.py into one 48px-cell
 * atlas, public/rib_field_v91.png, with the map below generated into RIB_META_V91. Cells are
 * named in the renderer's own vocabulary, so ribRegisterTeam finds them by the same names it
 * already asks for (run_dn3, cut_sd, catch_up1 ...) and every cell still passes ribRecolor.
 * New names add states: plant_/dive_/fall_ per facing, getup_<dd>0..7, celebrate_<dd>0..3,
 * hurt_<dd>0..1, walk_<dd>0..1, and ball_spin0..11 / ball_tumble0..11 (a spiral at one tilt
 * with the laces turning, and an end-over-end). The sheet loads on its own clock like the
 * crowd and the sideline; until it lands, v22 and the baked atlas stand exactly as before. */
/* RIB_META_V91_BEGIN */ const RIB_META_V91 = {"ball_spin0":[0,0],"ball_spin1":[1,0],"ball_spin10":[2,0],"ball_spin11":[3,0],"ball_spin2":[4,0],"ball_spin3":[5,0],"ball_spin4":[6,0],"ball_spin5":[7,0],"ball_spin6":[8,0],"ball_spin7":[9,0],"ball_spin8":[10,0],"ball_spin9":[11,0],"ball_tumble0":[12,0],"ball_tumble1":[13,0],"ball_tumble10":[14,0],"ball_tumble11":[15,0],"ball_tumble2":[0,1],"ball_tumble3":[1,1],"ball_tumble4":[2,1],"ball_tumble5":[3,1],"ball_tumble6":[4,1],"ball_tumble7":[5,1],"ball_tumble8":[6,1],"ball_tumble9":[7,1],"catch_dn0":[8,1],"catch_dn1":[9,1],"catch_dn2":[10,1],"catch_dr0":[11,1],"catch_dr1":[12,1],"catch_dr2":[13,1],"catch_up0":[14,1],"catch_up1":[15,1],"catch_up2":[0,2],"catchhold_dn":[1,2],"catchhold_dr":[2,2],"catchhold_up":[3,2],"catchseq_dn0_0":[4,2],"catchseq_dn0_1":[5,2],"catchseq_dn0_2":[6,2],"catchseq_dn0_3":[7,2],"catchseq_dn1_0":[8,2],"catchseq_dn1_1":[9,2],"catchseq_dn1_2":[10,2],"catchseq_dn1_3":[11,2],"catchseq_dn2_0":[12,2],"catchseq_dn2_1":[13,2],"catchseq_dn2_2":[14,2],"catchseq_dn2_3":[15,2],"catchseq_dn3_0":[0,3],"catchseq_dn3_1":[1,3],"catchseq_dn3_2":[2,3],"catchseq_dn3_3":[3,3],"catchseq_dr0_0":[4,3],"catchseq_dr0_1":[5,3],"catchseq_dr0_2":[6,3],"catchseq_dr0_3":[7,3],"catchseq_dr1_0":[8,3],"catchseq_dr1_1":[9,3],"catchseq_dr1_2":[10,3],"catchseq_dr2_0":[11,3],"catchseq_dr2_1":[12,3],"catchseq_dr2_2":[13,3],"catchseq_dr2_3":[14,3],"catchseq_dr3_0":[15,3],"catchseq_dr3_1":[0,4],"catchseq_dr3_2":[1,4],"catchseq_up0_0":[2,4],"catchseq_up0_1":[3,4],"catchseq_up0_2":[4,4],"catchseq_up0_3":[5,4],"catchseq_up1_0":[6,4],"catchseq_up1_1":[7,4],"catchseq_up1_2":[8,4],"catchseq_up1_3":[9,4],"catchseq_up2_0":[10,4],"catchseq_up2_1":[11,4],"catchseq_up2_2":[12,4],"catchseq_up2_3":[13,4],"catchseq_up3_0":[14,4],"catchseq_up3_1":[15,4],"catchseq_up3_2":[0,5],"catchseq_up3_3":[1,5],"celebrate_dn0":[2,5],"celebrate_dn1":[3,5],"celebrate_dn2":[4,5],"celebrate_dn3":[5,5],"celebrate_dr0":[6,5],"celebrate_dr1":[7,5],"celebrate_dr2":[8,5],"celebrate_dr3":[9,5],"celebrate_up0":[10,5],"celebrate_up1":[11,5],"celebrate_up2":[12,5],"celebrate_up3":[13,5],"celebrate_ur0":[14,5],"celebrate_ur1":[15,5],"celebrate_ur2":[0,6],"celebrate_ur3":[1,6],"cut_dn":[2,6],"cut_dr":[3,6],"cut_sd":[4,6],"cut_up":[5,6],"cut_ur":[6,6],"dive_dn":[7,6],"dive_dr":[8,6],"dive_sd":[9,6],"dive_up":[10,6],"dive_ur":[11,6],"fall_dn":[12,6],"fall_dr":[13,6],"fall_sd":[14,6],"fall_up":[15,6],"fall_ur":[0,7],"getup_dn0":[1,7],"getup_dn1":[2,7],"getup_dn2":[3,7],"getup_dn3":[4,7],"getup_dn4":[5,7],"getup_dn5":[6,7],"getup_dn6":[7,7],"getup_dn7":[8,7],"getup_dr0":[9,7],"getup_dr1":[10,7],"getup_dr2":[11,7],"getup_dr3":[12,7],"getup_dr4":[13,7],"getup_dr5":[14,7],"getup_dr6":[15,7],"getup_dr7":[0,8],"getup_up0":[1,8],"getup_up1":[2,8],"getup_up2":[3,8],"getup_up3":[4,8],"getup_up4":[5,8],"getup_up5":[6,8],"getup_up6":[7,8],"getup_up7":[8,8],"getup_ur0":[9,8],"getup_ur1":[10,8],"getup_ur2":[11,8],"getup_ur3":[12,8],"getup_ur4":[13,8],"getup_ur5":[14,8],"getup_ur6":[15,8],"getup_ur7":[0,9],"hurt_dn0":[1,9],"hurt_dn1":[2,9],"hurt_dr0":[3,9],"hurt_dr1":[4,9],"hurt_up0":[5,9],"hurt_up1":[6,9],"hurt_ur0":[7,9],"hurt_ur1":[8,9],"idle_dn":[9,9],"idle_dr":[10,9],"idle_sd":[11,9],"idle_up":[12,9],"idle_ur":[13,9],"plant_dn":[14,9],"plant_dr":[15,9],"plant_sd":[0,10],"plant_up":[1,10],"plant_ur":[2,10],"run_dn0":[3,10],"run_dn1":[4,10],"run_dn2":[5,10],"run_dn3":[6,10],"run_dn4":[7,10],"run_dn5":[8,10],"run_dn6":[9,10],"run_dn7":[10,10],"run_dr0":[11,10],"run_dr1":[12,10],"run_dr2":[13,10],"run_dr3":[14,10],"run_dr4":[15,10],"run_dr5":[0,11],"run_dr6":[1,11],"run_dr7":[2,11],"run_sd0":[3,11],"run_sd1":[4,11],"run_sd2":[5,11],"run_sd3":[6,11],"run_sd4":[7,11],"run_sd5":[8,11],"run_sd6":[9,11],"run_sd7":[10,11],"run_up0":[11,11],"run_up1":[12,11],"run_up2":[13,11],"run_up3":[14,11],"run_up4":[15,11],"run_up5":[0,12],"run_up6":[1,12],"run_up7":[2,12],"run_ur0":[3,12],"run_ur1":[4,12],"run_ur2":[5,12],"run_ur3":[6,12],"run_ur4":[7,12],"run_ur5":[8,12],"run_ur6":[9,12],"run_ur7":[10,12],"walk_dn0":[11,12],"walk_dn1":[12,12],"walk_dr0":[13,12],"walk_dr1":[14,12],"walk_up0":[15,12],"walk_up1":[0,13],"walk_ur0":[1,13],"walk_ur1":[2,13],"backpedal_up0":[0,14],"backpedal_up1":[1,14],"backpedal_up2":[2,14],"backpedal_up3":[3,14],"backpedal_up4":[4,14],"backpedal_up5":[5,14],"carry_up":[6,14],"handoffL_up0":[7,14],"handoffL_up1":[8,14],"handoffL_up2":[9,14],"handoffL_up3":[10,14],"handoffL_up4":[11,14],"handoff_up0":[12,14],"handoff_up1":[13,14],"handoff_up2":[14,14],"handoff_up3":[15,14],"handoff_up4":[0,15],"ready_up":[1,15],"stance3_up":[2,15],"throwL_up0":[3,15],"throwL_up1":[4,15],"throwL_up2":[5,15],"throwL_up3":[6,15],"throwL_up4":[7,15],"throwL_up5":[8,15],"throwR_up0":[9,15],"throwR_up1":[10,15],"throwR_up2":[11,15],"throwR_up3":[12,15],"throwR_up4":[13,15],"throwR_up5":[14,15],"throw_dn0":[15,15],"throw_dn1":[0,16],"throw_dn2":[1,16],"throw_dn3":[2,16],"throw_dn4":[3,16],"throw_dn5":[4,16],"throw_up0":[5,16],"throw_up1":[6,16],"throw_up2":[7,16],"throw_up3":[8,16],"throw_up4":[9,16],"throw_up5":[10,16],"throw_ur0":[11,16],"throw_ur1":[12,16],"throw_ur2":[13,16],"throw_ur3":[14,16],"throw_ur4":[15,16],"throw_ur5":[0,17],"toss_up0":[1,17],"toss_up1":[2,17],"toss_up2":[3,17],"toss_up3":[4,17],"toss_up4":[5,17],"_ballAngles":[2.283,2.184,2.187,2.176,2.16,2.1,2.076,2.227,2.311,2.405,2.447,2.405]}; /* RIB_META_V91_END */
function ribCellV91(name) {
  if (!RIB.v91img) return null;
  const mc = RIB_META_V91[name]; if (!mc) return null;
  if (RIB.v91cache[name]) return RIB.v91cache[name];
  const cv = document.createElement("canvas"); cv.width = 48; cv.height = 48;
  const cx = cv.getContext("2d"); cx.imageSmoothingEnabled = false;
  cx.drawImage(RIB.v91img, mc[0] * 48, mc[1] * 48, 48, 48, 0, 0, 48, 48);
  RIB.v91cache[name] = cv; return cv;
}
// v91: the ball as a sprite of the sheet's frames, carrying the markers the procedural
// football carries, so every reader of the ball object stays satisfied
function ribBallV91(scene, x, y) {
  if (!RIB.v91img || !scene || !scene.textures) return null;
  if (!scene.textures.exists("spr_ball_spin0")) ribRegisterBallV91(scene);
  if (!scene.textures.exists("spr_ball_spin0")) return null;
  const ball = scene.add.image(x, y, "spr_ball_spin0").setDepth(19);
  ball.name = "rib91-sheet-football"; ball.__rib20Football = true; ball.__rib91Football = true; ball.__baseWidth = 24; ball.__baseHeight = 12;
  ball.setVisible(true).setAlpha(1); return ball;
}
function ribRegisterBallV91(scene) {
  if (!RIB.v91img || !scene || !scene.textures) return;
  for (let i = 0; i < 12; i++) for (const kind of ["spin", "tumble"]) {
    const cv = ribCellV91("ball_" + kind + i); if (!cv) continue;
    try { scene.textures.remove("spr_ball_" + kind + i); } catch (e) {}
    scene.textures.addCanvas("spr_ball_" + kind + i, cv);
  }
}
/* ===== v49 REF ART — the officiating crew gets its own hand-drawn sheet =====
 * Until now the crew was the PLAYER atlas recolored white with stripes painted on
 * per-pixel (ribZebra) and a drawn ellipse for the cap. This replaces all of that
 * with real officials art: five screen directions of run cycles, a standing idle
 * cycle, the six-frame flag heave, the loose flag itself, both-arms-up for a score,
 * the dead-ball whistle and the extended point.
 *
 * The sheet does NOT go through ribRecolor/ribRegisterTeam — officials wear one
 * kit and recoloring them would be exactly wrong. Cells are 64px, not the players'
 * 48, because the both-arms-up signal is taller than a 48 cell; feet still land on
 * the players' foot line so a ref and a player standing together match.
 * Built by scripts/spritekit/pack_refs.mjs, inlined by bake_refs.mjs.
 * The zebra recolor below stays registered as the fallback for a sheet that never
 * decodes, so a failed load degrades to the old look instead of blank officials. */
const REF_CELL = 64;
const RIB_META_REF = {"run_dn0":[0,0],"run_dn1":[1,0],"run_dn2":[2,0],"run_dn3":[3,0],"run_dn4":[4,0],"run_dn5":[5,0],"run_dn6":[6,0],"run_dn7":[7,0],"run_dr0":[0,1],"run_dr1":[1,1],"run_dr2":[2,1],"run_dr3":[3,1],"run_dr4":[4,1],"run_dr5":[5,1],"run_dr6":[6,1],"run_dr7":[7,1],"run_sd0":[0,2],"run_sd1":[1,2],"run_sd2":[2,2],"run_sd3":[3,2],"run_sd4":[4,2],"run_sd5":[5,2],"run_sd6":[6,2],"run_sd7":[7,2],"run_up0":[0,3],"run_up1":[1,3],"run_up2":[2,3],"run_up3":[3,3],"run_up4":[4,3],"run_up5":[5,3],"run_up6":[6,3],"run_up7":[7,3],"idle0":[0,4],"idle1":[1,4],"idle2":[2,4],"idle3":[3,4],"stand_dr":[4,4],"stand_sd":[5,4],"stand_up":[6,4],"stand":[7,4],"signal0":[0,5],"signal1":[1,5],"signal2":[2,5],"signal3":[3,5],"signal4":[4,5],"signal5":[5,5],"throw0":[6,5],"throw1":[7,5],"throw2":[0,6],"throw3":[1,6],"throw4":[2,6],"throw5":[3,6],"point":[4,6],"point2":[5,6],"flag":[6,6],"whistle0":[7,6],"whistle1":[0,7],"whistle2":[1,7],"whistle3":[2,7],"whistle_point":[3,7]};
function ribCellRef(name) {
  if (!RIB.refImg) return null;
  const mc = RIB_META_REF[name]; if (!mc) return null;
  if (RIB.refCache[name]) return RIB.refCache[name];
  const cv = document.createElement("canvas"); cv.width = REF_CELL; cv.height = REF_CELL;
  const cx = cv.getContext("2d"); cx.imageSmoothingEnabled = false;
  cx.drawImage(RIB.refImg, mc[0] * REF_CELL, mc[1] * REF_CELL, REF_CELL, REF_CELL, 0, 0, REF_CELL, REF_CELL);
  RIB.refCache[name] = cv; return cv;
}
function ribRegisterRefs(scene) {
  if (!scene || !scene.textures || !RIB.refImg) return false;
  const put = (key, srcName) => {
    const cv = ribCellRef(srcName); if (!cv) return;
    try { scene.textures.remove(key); } catch (e) {}
    scene.textures.addCanvas(key, cv);
  };
  // Five screen directions out of four drawn rows: there is no back-three-quarter
  // art, so the up-diagonal borrows the back row, and the renderer mirrors L/R.
  const dirSrc = { dn: "dn", dr: "dr", sd: "sd", ur: "up", up: "up" };
  for (const d in dirSrc) {
    const s = dirSrc[d];
    for (let i = 0; i < 8; i++) put("spr_ref_" + d + "_run" + i, "run_" + s + i);
    // An official at rest is not a statue: front views get the four-frame weight
    // shift, the away views hold the first back-row frame (there is no back stand).
    for (let i = 0; i < 4; i++) put("spr_ref_" + d + "_idle" + i, d === "dn" ? "idle" + i : s === "up" ? "run_up0" : "run_" + s + "0");
    put("spr_ref_" + d + "_idle", d === "dn" ? "idle0" : s === "up" ? "run_up0" : "run_" + s + "0");
  }
  // Signalling poses are front-on and non-directional — an official turns to face
  // the press box to sell a call, so these carry no per-direction variant.
  for (let i = 0; i < 6; i++) { put("spr_ref_signal" + i, "signal" + i); put("spr_ref_throw" + i, "throw" + i); }
  for (let i = 0; i < 4; i++) put("spr_ref_whistle" + i, "whistle" + i);
  put("spr_ref_point", "point"); put("spr_ref_point2", "point2");
  put("spr_ref_whistle_point", "whistle_point");
  put("spr_ref_stand", "stand");
  put("spr_ref_flag", "flag");                    // the loose flag in flight
  try { if (scene.refs) scene.refs.forEach((r) => { r.tex = null; }); } catch (e) {}
  return true;
}
/* ===== v57 CROWD ART — the stands get their own sheet =====
 * Three density tiers (sparse / mid / packed) x two poses (idle / cheer), packed
 * bottom-aligned into six same-size cells so a tier's two poses overlay pixel for
 * pixel: the renderer CROSSFADES them, and any drift between the cells would show
 * up as the whole stand sliding when the crowd stands up.
 * Built by scripts/spritekit/pack_crowd.mjs, inlined by bake_crowd.mjs.
 * Tier is picked from the level being played at (see crowdTier) — a high-school
 * bleacher is not a sold-out pro deck, and the art says so. */
const RIB_META_CROWD = {"sparse_idle":[0,0,625,106,82],"sparse_cheer":[0,106,625,106,82],"mid_idle":[0,212,625,106,81],"mid_cheer":[0,318,625,106,81],"packed_idle":[0,424,625,106,82],"packed_cheer":[0,530,625,106,82]};
/* ===== v144 A THEY ARE THE SIZE OF THE AGE THEY ARE =====
 * Every man on the live field was drawn adult-sized, at Pee Wee as much as in the UFF, so an
 * eight-year-old's game looked like a pro game with the names changed. `LIVE_AGE_K_V144` is the
 * DRAWN size by age. Its young end is anchored on the v112 height fraction (`HT_FRAC_V112`, the
 * one the body model and every printed height already use) SQUARED, because a child is not only
 * shorter but narrower and the silhouette has to read as a child at a glance: 0.72 of an adult's
 * height is 0.52 of his drawn mass. From the mid-teens it deliberately runs below that square and
 * eases to 1 at 22 instead, because `HT_FRAC_V112` is flat by 18 and a college player is still
 * filling out on his way to the league. It is a table rather than a formula so the curve can be
 * read and retuned at a glance — nothing else derives from it.
 *
 * ONE scale for all twenty-two, taken from the LEVEL rather than from `o.player.age`: the opponent
 * has no modelled age, and a full-size opponent beside a half-size you-player reads as a bug, not
 * as youth football. Stamped once a snap (the state read is not free), applied in `placeMarker`
 * where the projection is applied, so the shadow, the number, the tackle hop, the launch arc, the
 * ball in his hands and the pair spread all follow it for nothing.
 * `window.__V144`; `v144check.mjs`. */
const LIVE_AGE_K_V144 = { 8:.52, 9:.56, 10:.60, 11:.64, 12:.68, 13:.73, 14:.79, 15:.85, 16:.90,
  17:.94, 18:.96, 19:.975, 20:.985, 21:.99 };
function liveAgeKV144() {
  if (!TU("liveAgeV144", 1)) return 1;
  const forced = window.__LIVE_AGE_FORCE_V144;                 // the dev checks pin an age
  let age = Number(forced);
  if (!isFinite(age)) {
    try {
      const st = (window.__GRIDIRON_AUDIT__ && window.__GRIDIRON_AUDIT__.getState && window.__GRIDIRON_AUDIT__.getState()) || window.o;
      const lv = (st && st.player && st.player.level) || 0;
      const L = (window.__GRIDIRON_AUDIT__ && window.__GRIDIRON_AUDIT__.LEVELS) || null;
      age = (L && L[lv] && L[lv].age) || 0;
      // a man who has sat at one level for a few seasons really is older than the cohort
      if (st && st.player && isFinite(st.player.age)) age = Math.max(age, Math.min(st.player.age, age + 3));
    } catch (e) { age = 0; }
  }
  age = Math.round(age);
  if (!isFinite(age) || age <= 0) return 1;
  const k = age >= 22 ? 1 : (LIVE_AGE_K_V144[age] != null ? LIVE_AGE_K_V144[age] : (age < 8 ? LIVE_AGE_K_V144[8] : 1));
  return cl144(k * TU("liveAgeScaleK", 1), TU("liveAgeMin", .35), TU("liveAgeMax", 1.25));
}
function cl144(v, a, b) { return v < a ? a : v > b ? b : v; }
try { window.__V144 = Object.assign(window.__V144 || {}, { ageK: liveAgeKV144, ageTable: LIVE_AGE_K_V144 }); } catch (e) {}
function crowdTier() {
  // an explicit override wins (dev harness / checks), then the career level
  const forced = window.__CROWD_TIER;
  if (forced && RIB_META_CROWD[forced + "_idle"]) return forced;
  let lv = 0;
  // same career-state accessor the rank/leaders code and the dev checks use — `o`
  // is not always reachable as a window property, and reading only it silently
  // pinned every stadium to the high-school bleacher.
  try {
    const st = (window.__GRIDIRON_AUDIT__ && window.__GRIDIRON_AUDIT__.getState && window.__GRIDIRON_AUDIT__.getState()) || window.o;
    lv = (st && st.player && st.player.level) || 0;
  } catch (e) {}
  return lv <= 2 ? "sparse" : lv <= 5 ? "mid" : "packed";
}
// debug surface for scripts/crowdcheck.mjs: the projection and the tier picker, so
// the check can verify the stands against the SAME map the renderer used.
try { window.__PJ_PROBE = (x, y) => PJ(x, y); window.__PERSPK_PROBE = (x) => perspK(x); window.__CROWD_TIER_PROBE = crowdTier;
  // the stair layout, so the check can look for spectators in the exact columns the
  // flights are drawn in rather than guessing where they landed
  window.__CROWD_STAIRS_PROBE = (W, tiles) => ribCrowdStairs(W, tiles); } catch (e) {}
// One pre-tiled strip per (tier, pose). The stand runs the whole length of the
// field, which is several times the master's width, so the cell is repeated
// end to end HERE — once — instead of the slice loop having to wrap a source
// window around the edge of the cell every frame.
/* ===== v59 CROWD AISLES — the stairways stop cutting people in half =====
 * v58 draws the stand's structure ON TOP of the finished crowd (source-atop, so no
 * mark can spill onto the turf). The stairways are the problem with that: they are
 * hard vertical bands at a fixed pitch, and the art seats spectators wherever it
 * likes, so every flight sliced whoever was in its way — a column of half heads and
 * chopped shoulders down both cheeks of every stairway, worst in the packed tier
 * where there is a fan in every seat.
 *
 * The stairs themselves are right: a stand needs them, and their unbroken vertical
 * line through every deck is most of the 3D read. What was wrong is that people
 * were sitting in the aisle. So clear the aisle FIRST, from the art's own bench.
 *
 * ribCrowdAisle() builds one narrow column of bare seating by walking the tier's
 * cell scanline by scanline and, on each line, copying the emptiest stretch of that
 * same line — the art's real bench pixels, from the row they belong to, so riser,
 * seat face and shadow line all stay put. Picking per scanline is what makes it
 * work at all: a stand that never empties out at any single x still empties out at
 * SOME x on every individual row.
 *
 * One patch, reused for every aisle on every deck of every wall, which is also what
 * makes the flights consistent: identical width, identical bench, identical pitch,
 * lined up through the whole stand instead of each one landing on whatever the art
 * happened to draw there. */
function ribCrowdStairs(W, tiles) {
  // The stair layout, in ONE place. The strip clears these columns and the
  // architecture pass draws into them; two copies of the formula is how half an
  // aisle gets cleared and the flight lands on somebody's face again.
  //
  // A stairway is about ONE SPECTATOR wide, and they run at a fixed pitch the whole
  // length of the stand. Both are sized off the TILE (a fixed number of people
  // across) rather than off the wall, so a flight stays one person wide and the
  // flights stay evenly spaced whether this strip is stretched down a sideline or
  // across an end zone.
  const per = Math.max(1, Math.round(TU("crowdStairsPerTile", 4)));
  const pitchX = W / (tiles * per);
  const sw = Math.max(2, Math.round(pitchX * TU("crowdStairW", 0.09)));
  const xs = [];
  for (let i = 0, x = Math.round(pitchX * 0.5); x < W; i++, x = Math.round(pitchX * (i + 0.5))) xs.push([i, x]);
  return { xs, sw, pitchX };
}
function ribCrowdTrim(tier) {
  // The master is one stand drawn end to end, and it ENDS on a stairwell: a diagonal
  // flight with its own handrail at each edge of the cell. Tiling the cell whole
  // therefore scatters a second, unrelated kind of stairway through the stand — at
  // the cell's rhythm, not the flights', sliding sideways deck to deck with the tile
  // offset, and mirrored into a facing pair at every other seam. Two stair systems
  // that agree about nothing.
  //
  // So tile the SEATING only. The trim is measured, not hard-coded, because the art
  // can be repacked: a stairwell block has no faces in it, so the leading and
  // trailing face-free columns bound it exactly. Taken as the max over the tier's two
  // poses — idle and cheer are crossfaded and have to overlay pixel for pixel, so a
  // trim that differed between them would slide the whole stand sideways every time
  // the crowd stood up.
  if (RIB.crowdTrim[tier]) return RIB.crowdTrim[tier];
  const c0 = RIB_META_CROWD[tier + "_idle"];
  if (!c0 || !RIB.crowdImg) return null;
  const W = c0[2], H = c0[3];
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const cx = cv.getContext("2d"); cx.imageSmoothingEnabled = false;
  let L = 0, R = 0;
  for (const pose of ["idle", "cheer"]) {
    const c = RIB_META_CROWD[tier + "_" + pose]; if (!c) continue;
    cx.clearRect(0, 0, W, H);
    cx.drawImage(RIB.crowdImg, c[0], c[1], c[2], c[3], 0, 0, c[2], c[3]);
    const d = cx.getImageData(0, 0, W, H).data;
    const face = new Uint8Array(W);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (d[i + 3] > 40 && d[i] > 130 && d[i] - d[i + 2] > 45 && d[i + 1] > d[i + 2] &&
        d[i] - d[i + 1] > 15 && d[i] - d[i + 1] < 90) face[x] = 1;
    }
    let l = 0; while (l < W && !face[l]) l++;
    let r = 0; while (r < W && !face[W - 1 - r]) r++;
    if (l > L) L = l; if (r > R) R = r;
  }
  // a runaway measurement must never eat the stand: fall back to tiling whole
  const cap = Math.floor(W * 0.2);
  if (L + R > W - 40) { L = 0; R = 0; }
  L = Math.min(L, cap); R = Math.min(R, cap);
  RIB.crowdTrim[tier] = { l: L, r: R, w: W - L - R };
  return RIB.crowdTrim[tier];
}
function ribCrowdAisle(tier, pose, aw, clr) {
  const ck = tier + "_" + pose + "_" + aw + "_" + clr;
  if (RIB.crowdAisle[ck]) return RIB.crowdAisle[ck];
  const c = RIB_META_CROWD[tier + "_" + pose];
  if (!c || !RIB.crowdImg || aw < 2 || aw > c[2]) return null;
  const W = c[2], H = c[3];
  const src = document.createElement("canvas"); src.width = W; src.height = H;
  const sx = src.getContext("2d"); sx.imageSmoothingEnabled = false;
  sx.drawImage(RIB.crowdImg, c[0], c[1], W, H, 0, 0, W, H);
  const d = sx.getImageData(0, 0, W, H).data;
  // search the SEATING only — the cell's own stairwell block reads as bare concrete
  // and would happily be copied in as "empty bench", stairs and handrail included
  const tr = ribCrowdTrim(tier) || { l: 0, w: W };
  const sL = tr.l, sR = tr.l + tr.w;
  // A fan is coloured, or brighter, or darker than the concrete he is sitting on;
  // bare bench is a desaturated mid grey. A LONG horizontal run of that test is not
  // a fan though — it is a lit seat nosing or the shadow under a slab, and those run
  // the whole width of the stand.
  const fan = new Uint8Array(W);
  const out = document.createElement("canvas"); out.width = aw; out.height = H;
  const ox = out.getContext("2d"); ox.imageSmoothingEnabled = false;
  const dst = ox.createImageData(aw, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = 0.3 * r + 0.59 * g + 0.11 * b;
      fan[x] = d[i + 3] > 40 && ((mx - mn) > 24 || L > 178 || L < 30) ? 1 : 0;
    }
    let run = 0;
    for (let x = 0; x <= W; x++) {
      const on = x < W && fan[x];
      if (on) { run++; continue; }
      if (run > 30) for (let k = x - run; k < x; k++) fan[k] = 0;
      run = 0;
    }
    // The emptiest window of aisle width on this line. The MARGINS are what the
    // score is really about: the flight itself covers the middle of the window, so
    // all anyone ever sees of this patch is the few pixels either side of it, and a
    // window that starts or ends mid-spectator puts that same half a person down the
    // side of every flight in the stadium. Brute force — the cell is 625 wide and
    // this runs once per tier and pose, then caches.
    let bx = sL, bs = 1e9;
    for (let x = sL; x + aw <= sR; x++) {
      let q = 0;
      for (let k = 0; k < aw; k++) if (fan[x + k]) q += (k < clr || k >= aw - clr) ? 10 : 1;
      q += 30 * (fan[x] + fan[x + aw - 1]);
      if (q < bs) { bs = q; bx = x; if (!q) break; }
    }
    // A sold-out deck has no empty window anywhere on some lines. Take the best one
    // and scrub what is left: each remaining spectator pixel becomes the nearest
    // bench pixel in the same window, so the aisle comes out bare either way.
    let flat = -1;
    if (bs > 0) {
      let bsat = 1e9;
      for (let x = sL; x < sR; x++) {
        const i = (y * W + x) * 4; if (d[i + 3] < 40) continue;
        const q = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
        if (q < bsat) { bsat = q; flat = i; }
      }
    }
    for (let x = 0; x < aw; x++) {
      let sx2 = bx + x;
      if (fan[sx2]) {
        let hit = -1;
        for (let r = 1; r < aw; r++) {
          if (x - r >= 0 && !fan[bx + x - r]) { hit = bx + x - r; break; }
          if (x + r < aw && !fan[bx + x + r]) { hit = bx + x + r; break; }
        }
        sx2 = hit >= 0 ? hit : -1;
      }
      const si = sx2 >= 0 ? (y * W + sx2) * 4 : flat;
      const di = (y * aw + x) * 4;
      if (si < 0) { dst.data[di + 3] = 0; continue; }
      dst.data[di] = d[si]; dst.data[di + 1] = d[si + 1];
      dst.data[di + 2] = d[si + 2]; dst.data[di + 3] = d[si + 3];
    }
  }
  ox.putImageData(dst, 0, 0);
  RIB.crowdAisle[ck] = out; return out;
}
function ribCrowdStrip(tier, pose, tiles, decks) {
  if (!RIB.crowdImg) return null;
  const c = RIB_META_CROWD[tier + "_" + pose]; if (!c) return null;
  const key = [tier, pose, tiles, decks, TU("crowdDeckLap", 10), TU("crowdArch", 1),
    TU("crowdStairsPerTile", 4), TU("crowdStairW", 0.09), TU("crowdConcourseH", 0.1), TU("crowdVomEvery", 2),
    TU("crowdTopShade", 0.2), TU("crowdAisleClear", 3)].join("_");
  if (RIB.crowdCache[key]) return RIB.crowdCache[key];
  const W = c[2] * tiles;
  const row = document.createElement("canvas"); row.width = W; row.height = c[3];
  const rx = row.getContext("2d"); rx.imageSmoothingEnabled = false;
  // Tile the SEATING BLOCK, not the whole cell — ribCrowdTrim explains why the cell's
  // own end stairwells have to go. The copies are butted at their natural width
  // rather than stretched to keep the old tile count, so nobody is widened; the strip
  // is the same width either way, which is all the perspective sweep cares about.
  // Every other copy is still mirrored: the seating ends mid-row, so butting raw
  // copies together repeats the same faces at a visible rhythm.
  const tr = ribCrowdTrim(tier) || { l: 0, r: 0, w: c[2] };
  for (let i = 0, x = 0; x < W; i++, x += tr.w) {
    rx.save();
    if (i % 2) { rx.translate(x + tr.w, 0); rx.scale(-1, 1); rx.drawImage(RIB.crowdImg, c[0] + tr.l, c[1], tr.w, c[3], 0, 0, tr.w, c[3]); }
    else rx.drawImage(RIB.crowdImg, c[0] + tr.l, c[1], tr.w, c[3], x, 0, tr.w, c[3]);
    rx.restore();
  }
  // DECKS. The master draws about five rows of seats; a stadium has many more, and
  // the stand has to be tall enough to still reach the frame now that the apron
  // reserves a full team area. Stacking the row is how it gets taller WITHOUT
  // stretching anybody — height derives from the strip's aspect, so N decks makes
  // the stand N times taller with the spectators exactly the same size. Each deck
  // is slid sideways so the decks do not line up into obvious vertical columns.
  // Stack by the DECK PITCH (cellmap[4], the seating block's own height), never by
  // the cell height: the cell is deliberately taller so the cheer pose has headroom
  // for raised arms and flags, and stacking by it leaves a transparent band between
  // decks that shows up on screen as green stripes of turf through the crowd.
  // ...and overlap them a few px. The strip's topmost rows are the back railing,
  // which the packer's fringe erode leaves thin, so butting decks exactly pitch
  // apart still leaves one near-empty row at every boundary — a hairline of turf
  // through the crowd. Tucking each deck slightly over the back row of the one
  // below removes it, which is also how real tiers sit.
  const pitch = Math.max(1, (c[4] || c[3]) - TU("crowdDeckLap", 10));
  const cv = document.createElement("canvas"); cv.width = W; cv.height = (decks - 1) * pitch + c[3];
  const cx = cv.getContext("2d"); cx.imageSmoothingEnabled = false;
  // A stand is a solid block of concrete with people on it. The art is not: the
  // master's stairwell leaves sloped transparent wedges, and mirroring tiles puts
  // those wedges at every seam — on screen they read as turf showing THROUGH the
  // crowd. Lay the structure down first and the art can have all the holes it
  // likes. Only the headroom above the top deck stays clear, because that is where
  // the cheer pose's arms and flags go.
  const seatTop = Math.max(0, c[3] - (c[4] || c[3]));
  cx.fillStyle = "#3b3e44"; cx.fillRect(0, seatTop, W, cv.height - seatTop);
  // ---- THE BACK OF THE STAND. Above the top deck's last row the strip was simply
  // transparent, so the stand ended at whatever silhouette the art's back railing
  // happened to leave and read as a sheet of seating with nothing behind it. A stand
  // has a back: a rear wall standing above the top row, in its own shade, with the
  // coping catching light along the top. It goes down FIRST, so the cheer pose's
  // raised arms and flags still break the skyline over it — which is the headroom
  // this band lives in, so it only takes the part of it the arms do not need.
  const bwH = Math.round(seatTop * Math.max(0, Math.min(1, TU("crowdBackWall", 0.6))));
  if (bwH > 1) {
    const wg = cx.createLinearGradient(0, seatTop - bwH, 0, seatTop);
    wg.addColorStop(0, "#31353c"); wg.addColorStop(1, "#232830");
    cx.fillStyle = wg; cx.fillRect(0, seatTop - bwH, W, bwH);
    cx.fillStyle = "rgba(150,158,170,0.55)"; cx.fillRect(0, seatTop - bwH, W, 1);
  }
  // Every aisle, on every deck, is the same bare column of the tier's own bench —
  // laid down BEFORE the architecture pass so the flight it draws next lands on
  // empty seating instead of on a row of faces. Same patch everywhere is the point:
  // it is what makes the flights read as one repeated piece of the building rather
  // than as a band dropped over whatever the art drew underneath.
  const SR = ribCrowdStairs(W, tiles);
  const clr = Math.max(0, Math.round(TU("crowdAisleClear", 3)));
  const aw = SR.sw + clr * 2;
  const aisle = TU("crowdArch", 1) > 0 ? ribCrowdAisle(tier, pose, aw, clr) : null;
  for (let d = 0; d < decks; d++) {
    const off = Math.round(((d * 0.37) % 1) * W), y = (decks - 1 - d) * pitch;
    cx.drawImage(row, off - W, y); cx.drawImage(row, off, y);
    if (aisle) for (const [, ax] of SR.xs) cx.drawImage(aisle, ax - clr, y);
  }
  ribCrowdArchitecture(cx, W, cv.height, pitch, decks, tiles);
  RIB.crowdCache[key] = cv; return cv;
}
/* Four identical decks stacked is a TEXTURE, not a stadium. It reads flat because
 * nothing in it says where one tier ends and the next begins, and there is no
 * built structure for the eye to take depth from. This draws the parts of a stand
 * that are not crowd: the concourse walkway between tiers, the stairways climbing
 * through the seating, and the vomitory tunnels that open onto each concourse.
 *
 * Two things make it read as one building rather than a stack:
 *   - the stairways line up VERTICALLY through every deck. The crowd art is slid
 *     sideways deck to deck so the faces do not repeat, but structure does not
 *     move between floors, and that continuous line is most of the 3D read.
 *   - it is all drawn in STRIP space, so the perspective sweep warps it with
 *     everything else — stairs climb the stand and concourses follow the tier
 *     lines, both converging on the yard lines' own vanishing point.
 *
 * `source-atop` keeps every mark inside the stand's existing silhouette, so none
 * of it can spill onto the turf. */
function ribCrowdArchitecture(cx, W, H, pitch, decks, tiles) {
  if (TU("crowdArch", 1) <= 0) return;
  cx.save();
  cx.globalCompositeOperation = "source-atop";
  const conH = Math.max(2, Math.round(pitch * TU("crowdConcourseH", 0.1)));
  const vomEvery = Math.max(1, Math.round(TU("crowdVomEvery", 2)));
  // Same layout the strip just cleared the seats out of — see ribCrowdStairs.
  const SR = ribCrowdStairs(W, tiles), stairX = SR.xs, sw = SR.sw;

  // ---- stairways: full height, aligned across every deck. The crowd art is slid
  // sideways deck to deck so faces do not repeat, but structure does not move
  // between floors, and that unbroken vertical line is most of the 3D read.
  // The aisle the strip cleared is a couple of pixels wider than the flight itself,
  // and its outer edge is where the seating resumes. In the packed tier that edge
  // has to fall through somebody — there is a fan in every seat, so no cut is
  // avoidable there — and a bare cut is exactly the sliced-face artefact this is all
  // about. Put the HANDRAIL on it: a shadow line and a lit rail, drawn over the two
  // columns the cut lands on. The edge stops reading as a chopped spectator and
  // starts reading as a fan standing at the rail, which is what it is.
  const rail = Math.max(0, Math.round(TU("crowdAisleClear", 3)));
  for (const [, x] of stairX) {
    cx.fillStyle = "#43464d"; cx.fillRect(x, 0, sw, H);                  // the run, darker than the seats
    cx.fillStyle = "rgba(150,156,166,0.5)";                              // tread nosings catching light
    for (let y = H - 2; y > 0; y -= 4) cx.fillRect(x, y, sw, 1);
    cx.fillStyle = "rgba(14,15,19,0.5)";                                 // shadowed cheeks give it width
    cx.fillRect(x - 1, 0, 1, H); cx.fillRect(x + sw, 0, 1, H);
    const l = x - rail, r = x + sw + rail - 1;
    cx.fillStyle = "rgba(11,12,16,0.62)";                                // the aisle's own shadow
    cx.fillRect(l - 1, 0, 1, H); cx.fillRect(r + 1, 0, 1, H);
    cx.fillStyle = "rgba(158,165,176,0.4)";                              // and the rail catching light
    cx.fillRect(l, 0, 1, H); cx.fillRect(r, 0, 1, H);
  }
  // ---- concourses: one walkway at the top of every deck but the last
  for (let m = 1; m < decks; m++) {
    const y = H - m * pitch;
    cx.fillStyle = "#2f333a"; cx.fillRect(0, y - conH, W, conH);         // the walkway, in shade
    cx.fillStyle = "rgba(158,165,176,0.7)"; cx.fillRect(0, y - conH, W, 1);     // front railing
    cx.fillStyle = "rgba(10,11,14,0.42)"; cx.fillRect(0, y - 1, W, 1);   // shadow onto the seats below
    // ...and the tier above OVERHANGS the one below, so its shadow falls across the
    // back rows of the next deck down. A hard line says "two textures butt here"; a
    // shadow that fades out over a few rows says "one deck is in front of the other",
    // which is the whole point of stacking them.
    const ovH = Math.max(2, Math.round(pitch * TU("crowdOverhang", 0.24)));
    const og = cx.createLinearGradient(0, y, 0, y + ovH);
    og.addColorStop(0, "rgba(7,9,13,0.5)"); og.addColorStop(1, "rgba(7,9,13,0)");
    cx.fillStyle = og; cx.fillRect(0, y, W, ovH);
    // vomitories: tunnel mouths opening onto this concourse
    for (const [i, x] of stairX) {
      if (i % vomEvery) continue;
      const vw = Math.max(3, Math.round(sw * 2.2)), vh = Math.max(3, Math.round(conH * 1.6));
      const vx = Math.round(x + sw / 2 - vw / 2);
      cx.fillStyle = "#14171c"; cx.fillRect(vx, y - vh, vw, vh);         // the dark of the tunnel
      cx.fillStyle = "rgba(132,139,150,0.55)"; cx.fillRect(vx, y - vh, vw, 1);   // lintel
    }
  }
  // ---- the upper deck sits deeper under the roof line: a soft top-down shade
  // separates the tiers in depth without touching the front rows
  const g = cx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(6,8,12," + TU("crowdTopShade", 0.2) + ")");
  g.addColorStop(0.5, "rgba(6,8,12,0)");
  cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  // ---- and the FRONT FASCIA. The bottom of the strip is the wall the lowest deck
  // stands on, at ground level and in the stand's own shadow. Without it the seating
  // runs straight into the turf and the stand reads as a decal lying on the grass;
  // with it there is a base for the whole thing to stand on.
  const fh = Math.max(2, Math.round(pitch * TU("crowdFascia", 0.12)));
  const fg = cx.createLinearGradient(0, H - fh, 0, H);
  fg.addColorStop(0, "rgba(9,11,15,0)"); fg.addColorStop(1, "rgba(9,11,15,0.6)");
  cx.fillStyle = fg; cx.fillRect(0, H - fh, W, fh);
  cx.restore();
}
function ribRecolor(src, p1hex, p2hex) {
  const cv = document.createElement("canvas"); cv.width = 48; cv.height = 48;
  const c = cv.getContext("2d"); c.drawImage(src, 0, 0);
  const img = c.getImageData(0, 0, 48, 48), d = img.data;
  const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const P = hx(p1hex), S = hx(p2hex);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 20) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2;
    if (L < 38) continue;                                        // outlines stay dark
    const sat = mx ? (mx - mn) / mx : 0;
    let hue = 0;
    if (mx !== mn) {
      if (mx === r) hue = (60 * ((g - b) / (mx - mn)) + 360) % 360;
      else if (mx === g) hue = 60 * ((b - r) / (mx - mn)) + 120;
      else hue = 60 * ((r - g) / (mx - mn)) + 240;
    }
    let base = null, ref = 0;
    if (hue >= 190 && hue <= 265 && sat > 0.15) { base = P; ref = 95; }         // navy -> primary
    else if (hue >= 33 && hue <= 62 && sat > 0.3 && L > 60) { base = S; ref = 165; } // gold -> secondary
    if (base) {
      const sc = Math.min(1.75, Math.max(0.25, L / ref));
      d[i] = Math.min(255, base[0] * sc); d[i + 1] = Math.min(255, base[1] * sc); d[i + 2] = Math.min(255, base[2] * sc);
    }
  }
  c.putImageData(img, 0, 0);
  return cv;
}
// v45 REFEREE ZEBRA: paint vertical black bars across the torso band of a
// recolored (white) official so the crew reads as the classic striped shirt
// from broadcast distance. Only light, opaque pixels in the chest rows are
// darkened — outlines, skin and legs are left alone, so any pose still stripes
// cleanly without a per-frame torso mask.
function ribZebra(cv) {
  try {
    const c = cv.getContext("2d");
    const img = c.getImageData(0, 0, 48, 48), d = img.data;
    for (let y = 11; y <= 27; y++) {
      for (let x = 0; x < 48; x++) {
        const i = (y * 48 + x) * 4;
        if (d[i + 3] < 40) continue;                     // transparent — background stays clear
        const L = (d[i] + d[i + 1] + d[i + 2]) / 3;
        if (L < 78) continue;                            // dark outlines / shadow seams survive
        if (((x >> 1) & 1) === 0) continue;              // 2px white / 2px black vertical stripe
        d[i] = 24; d[i + 1] = 26; d[i + 2] = 30;
      }
    }
    c.putImageData(img, 0, 0);
  } catch (e) {}
  return cv;
}
/* ===== v78 SIDELINE ART — the team area gets its own sheet =====
 * v57 reserved `crowdGap` as "the team area: apron between the touchline and the
 * stand's front row, for a later system to populate". This is that system, and
 * this block is its atlas.
 *
 * One rect-keyed sheet (RIB_META_SIDE, packed by scripts/spritekit/pack_sideline.mjs)
 * holding everything a sideline carries: ten coaches, ten trainers, benches and
 * chairs, hydration, medical, equipment racks, storage, coaching tech, the chain
 * crew's markers, and the loose kit that ends up on a touchline. Cells are
 * variable-size and trimmed, so the map stores a full rect per name rather than
 * a grid index — a bench and a football have nothing in common but their sheet.
 *
 * The staff are NOT recolored. They wear one drawn kit, for the same reason the
 * officials do (v49): every pose is hand-drawn in it, and the alternative is
 * multiplying a navy jacket and khaki trousers by a team primary, which turns
 * both to mud. The BACKUPS are a different matter — they are the same player
 * sprites the sim uses, so they come out of ribRegisterTeam already wearing the
 * right kit for the sideline they stand on.
 *
 * Render-only, like the crowd and the crew: no sim actor, no stat, no event. */
const RIB_META_SIDE = {"coach0":[3,3,33,94],"coach2":[39,3,57,94],"coach1":[99,3,37,93],"coach3":[139,3,32,93],"coach4":[174,3,38,91],"coach6":[215,3,41,91],"coach7":[259,3,33,90],"coach8":[295,3,36,90],"coach9":[334,3,43,90],"trainer0":[380,3,42,90],"trainer1":[425,3,40,90],"trainer3":[468,3,38,90],"trainer4":[509,3,38,90],"trainer5":[550,3,41,90],"trainer8":[594,3,40,90],"coach5":[637,3,46,89],"trainer6":[686,3,34,89],"trainer7":[723,3,36,89],"trainer2":[762,3,40,88],"trainer9":[805,3,37,87],"chain_rod":[845,3,17,86],"yard30":[865,3,21,76],"helmet_rack":[889,3,82,67],"pad_rack":[3,100,81,67],"med_cart":[87,100,70,61],"ball_rack":[160,100,66,59],"cooler_table":[229,100,65,57],"ball_bin":[297,100,57,56],"ponchos":[357,100,36,56],"table_b":[396,100,90,56],"camera":[489,100,37,56],"cooler_table_b":[529,100,101,55],"yard10":[633,100,20,55],"yard20":[656,100,21,55],"case_up":[680,100,31,54],"cart":[714,100,58,54],"trunk":[775,100,82,53],"case_up_b":[860,100,30,53],"comms":[893,100,34,53],"kick_net":[930,100,71,53],"golf_cart":[3,170,91,53],"whiteboard":[97,170,50,51],"fan":[150,170,54,51],"chairs_b":[207,170,63,50],"heater":[273,170,43,50],"chairs":[319,170,75,49],"cup_stand":[397,170,30,49],"trunk_b":[430,170,64,49],"play_board":[497,170,61,49],"down1":[561,170,30,49],"down2":[594,170,30,49],"down3":[627,170,30,49],"down4":[660,170,30,49],"bench_back":[693,170,96,48],"trunk_c":[792,170,64,47],"bench_long":[3,226,169,46],"bench_back_b":[175,226,78,45],"cooler":[256,226,33,45],"recycle":[292,226,45,45],"trash":[340,226,42,44],"med_bag":[385,226,50,41],"table":[438,226,68,41],"pylon":[509,226,12,39],"bottles":[524,226,61,38],"duffel":[588,226,53,38],"flag":[644,226,27,38],"barrier":[674,226,51,38],"bottles_b":[728,226,62,37],"tape_bin":[793,226,51,37],"duffel_b":[847,226,48,36],"bench_wood":[898,226,87,35],"cooler_b":[988,226,26,35],"bench_long_b":[3,275,132,34],"stretcher":[138,275,82,34],"towels":[223,275,51,34],"cone":[277,275,23,33],"cone_b":[303,275,22,33],"med_kit":[328,275,30,31],"mat":[361,275,49,30],"stool":[413,275,26,29],"bench_short":[442,275,56,27],"gmarker":[501,275,31,26],"discs":[535,275,23,25]};
function ribCellSide(name) {
  if (!RIB.sideImg) return null;
  if (RIB.sideCache[name]) return RIB.sideCache[name];
  const c = RIB_META_SIDE[name]; if (!c) return null;
  const cv = document.createElement("canvas"); cv.width = c[2]; cv.height = c[3];
  const cx = cv.getContext("2d"); cx.imageSmoothingEnabled = false;
  cx.drawImage(RIB.sideImg, c[0], c[1], c[2], c[3], 0, 0, c[2], c[3]);
  RIB.sideCache[name] = cv;
  return cv;
}
/* v79: the staff wear the TEAM's colours without paying for a hand-drawn kit per
 * palette. Multiplying the whole sprite by a team primary turns khakis and skin
 * to mud (the reason v78 left staff untinted), so this masks the kit's drawn
 * NAVY only — blue-dominant, dark-to-mid pixels — and rebuilds just those from
 * the team primary at the pixel's own luminance. Caps, jackets and shorts turn;
 * faces, khakis and the white shirts never do. Cached per team+palette; a
 * palette change (a new opponent) invalidates and re-tints. */
function ribSideStaffTint(name, p1) {
  const src = ribCellSide(name); if (!src) return null;
  const cv = document.createElement("canvas"); cv.width = src.width; cv.height = src.height;
  const cx = cv.getContext("2d"); cx.drawImage(src, 0, 0);
  try {
    const img = cx.getImageData(0, 0, cv.width, cv.height), d = img.data;
    const pr = parseInt(p1.slice(1, 3), 16), pg = parseInt(p1.slice(3, 5), 16), pb = parseInt(p1.slice(5, 7), 16);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 40) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (!(b > r + 12 && b > g + 6 && b > 40 && b < 200)) continue;   // the kit's navy, nothing else
      const f = (r + g + b) / 3 / 62;                                  // keep the drawn shading
      d[i] = Math.min(255, pr * f); d[i + 1] = Math.min(255, pg * f); d[i + 2] = Math.min(255, pb * f);
    }
    cx.putImageData(img, 0, 0);
  } catch (e) { return null; }
  return cv;
}
function ribRegisterSideTeams(scene) {
  if (!scene || !scene.textures || !RIB.sideImg) return;
  RIB._sideStaffPal = RIB._sideStaffPal || {};
  for (const team of ["off", "def"]) {
    const cols = RIB.teamCols[team]; if (!cols || !cols[0]) continue;
    const stamp = team + "|" + cols[0];
    if (RIB._sideStaffPal[team] === stamp && scene.textures.exists("spr_side_" + team + "_coach0")) continue;
    let n = 0;
    for (const name in RIB_META_SIDE) {
      if (!/^(coach|trainer)\d/.test(name)) continue;
      const cv = ribSideStaffTint(name, cols[0]); if (!cv) continue;
      const key = "spr_side_" + team + "_" + name;
      try { if (scene.textures.exists(key)) scene.textures.remove(key); scene.textures.addCanvas(key, cv); n++; } catch (e) {}
    }
    if (n) RIB._sideStaffPal[team] = stamp;
  }
}
/* ===== v92 THE LIGHTS AND THE BIG SCREEN — the sky behind the bowl =====
 * v57 painted a dark gradient above the far end line ("the dark behind the stands")
 * and left it empty. This fills it: floodlight towers standing BEHIND the bowl (their
 * masts hidden by the crowd, the lamp heads rising into the sky, the lamps breathing
 * through the sheet's six frames) and a big screen above the far stand carrying a
 * second Phaser camera — the broadcast feed, following the ball — that freezes on the
 * whistle into a replay still and goes live again at the snap. Both are placed from
 * the bowl sections buildCrowd just built, so they ride the same perspective and only
 * exist while the far bowl does. RIB_META_V92 is GENERATED by scripts/build-stadium-art.py.
 * Render-only: no sim actor, no stat, no event. ?noV92 leaves the sky as it was. */
/* RIB_META_V92_BEGIN */ const RIB_META_V92 = {"cell":[128,160],"cols":6,"rows":2,"faces":{"left":0,"right":1},"frames":6}; /* RIB_META_V92_END */
function ribRegisterLightsV92(scene) {
  if (!scene || !scene.textures || !RIB.lightsImg) return false;
  try { if (!scene.textures.exists("rib_lights_v92")) scene.textures.addSpriteSheet("rib_lights_v92", RIB.lightsImg, { frameWidth: RIB_META_V92.cell[0], frameHeight: RIB_META_V92.cell[1] }); return true; } catch (e) { return false; }
}
function ribRegisterSide(scene) {
  if (!scene || !scene.textures || !RIB.sideImg) return false;
  let n = 0;
  for (const name in RIB_META_SIDE) {
    const key = "spr_side_" + name;
    const cv = ribCellSide(name); if (!cv) continue;
    try { if (scene.textures.exists(key)) scene.textures.remove(key); scene.textures.addCanvas(key, cv); n++; } catch (e) {}
  }
  try { window.__SIDE_ART_V78 = { cells: Object.keys(RIB_META_SIDE).length, registered: n }; } catch (e) {}
  return n > 0;
}
/* ===== v104 THE NUMBER ON THE JERSEY =====
 * The jersey number used to be a flat text object: a hard-coded font size ("10px" chest,
 * "9px" back, "8px" stance) at a hard-coded local offset (-3 / +1.5 / +0.5), re-set every
 * frame. Three things fell out of that. The offsets were guesses against ONE pose, so the
 * back number — meant to ride the shoulder blades — actually landed on the waistband and
 * bled into the pants on every up-facing frame, idle and block alike. The size was fixed
 * in screen px while the BODY is scaled twice (the v27 perspective on the container, and
 * the per-position body trait, 0.96..1.15 tall and 0.90..1.23 wide), so the same number
 * read small on a tackle and oversized on a corner, and the near-camera rows upsampled a
 * 10px raster by a fifth. And `setFontSize` re-rasterized ~100 text canvases a frame.
 *
 * So the ART says where the number goes. Every player cell is scanned once, at register
 * time, for the same kit bands ribRecolor keys on, and three landmarks come out: the
 * WAISTBAND where the trousers take over, the COLLAR where the helmet gives way to the
 * pads, and the row the jersey itself runs out on (which is not always the trousers — a
 * lineman in a three-point stance has his legs tucked behind him, so his shirt ends at his
 * elbows and the pants never show at all). That is a band per texture: one per pose, per
 * facing. The number is then hung from the WAIST — the stable landmark, where the collar
 * wanders a couple of rows through a run cycle — at a height held constant in cell rows so
 * it never pulses, clamped so the glyphs can reach neither the pants nor the helmet.
 * Everything is in CELL rows, multiplied by the body's own build, so the number is painted
 * on the jersey rather than floating at a fixed screen size over it. The label is
 * rasterized once at a larger font and scaled DOWN, which is the sharp direction.
 * `window.__V104` is what the checks read. */
const NUM_CELL_V104 = 48;
function numBandV104(srcName, cell) {
  // one scan per SOURCE cell — the hue bands are the drawn kit, not the team's, so every
  // team registered off the same cell shares the answer
  if (RIB.numBandSrc[srcName] !== undefined) return RIB.numBandSrc[srcName];
  let band = null;
  try {
    const N = NUM_CELL_V104, d = cell.getContext("2d").getImageData(0, 0, N, N).data;
    const P = new Array(N).fill(0), S = new Array(N).fill(0), W = new Array(N).fill(0);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      if (d[i + 3] < 40) continue;
      W[y]++;
      const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2;
      if (L < 38) continue;                                    // outlines are not kit
      const sat = mx ? (mx - mn) / mx : 0;
      let hue = 0;
      if (mx !== mn) {
        if (mx === r) hue = (60 * ((g - b) / (mx - mn)) + 360) % 360;
        else if (mx === g) hue = 60 * ((b - r) / (mx - mn)) + 120;
        else hue = 60 * ((r - g) / (mx - mn)) + 240;
      }
      if (hue >= 190 && hue <= 265 && sat > 0.15) P[y]++;              // jersey (navy -> primary)
      else if (hue >= 33 && hue <= 62 && sat > 0.3 && L > 60) S[y]++;  // pants  (gold -> secondary)
    }
    let head = 0; while (head < N && !W[head]) head++;
    if (head < N - 8) {
      // the waistband: the first row the pants colour owns outright (a gold sleeve trim or a
      // stripe always has jersey around it, so the P<=2 gate is what keeps this off the chest)
      // and holds for four rows running.
      let waist = -1;
      for (let y = head + 12; y < N - 4; y++) {
        if (!(S[y] >= 6 && P[y] <= 2)) continue;
        if (S[y + 1] >= 5 && S[y + 1] > P[y + 1] && S[y + 2] >= 5 && S[y + 2] > P[y + 2] && S[y + 3] >= 4 && S[y + 3] > P[y + 3]) { waist = y; break; }
      }
      if (waist < 0) waist = Math.min(N - 4, head + 26);
      // the collar, read two ways off the silhouette, because neither alone covers every pose.
      // A rear helmet is one unbroken block of jersey colour, so hue finds nothing here; width
      // does. PINCH is the narrowest row just under the head — right on most poses, but fooled
      // by a celebration with both arms flung out, where the widest rows ARE the shoulders.
      // BREAK is the last row still no wider than the helmet itself — right on those, but it
      // runs away down the body in a throwing pose whose torso is barely wider than the head.
      // The HIGHER of the two is the answer: the collar is never below both.
      let pinch = head + 10, pw = 1e9;
      for (let y = head + 8; y <= Math.min(head + 16, waist - 5); y++) if (W[y] < pw) { pw = W[y]; pinch = y; }
      let hw = 0; for (let y = head; y <= Math.min(head + 6, N - 1); y++) hw = Math.max(hw, W[y]);
      let brk = head + 10;
      for (let y = head + 4; y <= waist - 5; y++) if (W[y] <= hw + TU("numNeckSlack", 2)) brk = y;
      const top = Math.min(pinch, brk) + 1;
      // ...and the shirt can run out ABOVE the trousers: a lineman in a three-point stance has
      // his legs tucked behind him, so the pants colour never shows until his shins, while the
      // jersey stops at his elbows. The number belongs on the last row still wearing jersey.
      let jEnd = top;
      for (let y = top; y <= waist; y++) if (P[y] >= TU("numJerseyMin", 3)) jEnd = y;
      waist = Math.min(waist, jEnd + 1);
      if (waist - top >= 4) {
        const ws = []; for (let y = Math.min(top + 2, waist - 1); y <= Math.max(waist - 2, top + 1); y++) ws.push(W[y]);
        ws.sort((a, b) => a - b);
        band = { top, waist, w: ws[ws.length >> 1] || 22 };   // the chest's own width, medianed past a swung arm
      }
    }
  } catch (e) {}
  RIB.numBandSrc[srcName] = band; return band;
}
const NUM_BAND_FALLBACK_V104 = { top: 12, waist: 27, w: 22 };
function numStyleV104(team) {
  return { fontFamily: "Oswald, sans-serif", fontSize: TU("numFontPx", 20) + "px", fontStyle: "bold",
    color: team === "you" ? "#1b1406" : "#ffffff" };
}
function numFontV104(scene) {
  // the INK, not the line box: a text object centres its line box, and the digits sit below
  // that centre by however much descender room the face carries. Measure the raster once and
  // the number lands where the art says it should, whatever font actually resolved.
  if (RIB.numFont) return RIB.numFont;
  const px = TU("numFontPx", 20);
  let met = { cap: px * 0.72, mid: px * 0.09, w: px * 1.1 }, t = null, read = false;
  try {
    t = scene.add.text(-9999, -9999, "88", numStyleV104("off")).setOrigin(0.5);
    const sw = TU("numStroke", 2.2); if (sw > 0) t.setStroke("#0a0e14", sw);
    const cv = t.canvas, cx = cv.getContext("2d"), res = t.height ? cv.height / t.height : 1;
    const d = cx.getImageData(0, 0, cv.width, cv.height).data;
    let y0 = -1, y1 = -1, x0 = -1, x1 = -1;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++)
      if (d[(y * cv.width + x) * 4 + 3] > 30) { if (y0 < 0) y0 = y; y1 = y; if (x0 < 0 || x < x0) x0 = x; if (x > x1) x1 = x; }
    if (y1 > y0) { met = { cap: (y1 - y0 + 1) / res, mid: ((y0 + y1 + 1) / 2) / res - t.height / 2, w: (x1 - x0 + 1) / res }; read = true; }
  } catch (e) {}
  if (t) { try { t.destroy(); } catch (e) {} }
  if (read) RIB.numFont = met;        // a scene torn down mid-measure gets the estimate, not a cached one
  return met;
}
try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { RIB.numFont = null; }); } catch (e) {}
// the dev hook. `cell` hands a check the SOURCE art any texture was cut from, so it can re-derive
// a band rather than trust the one the renderer cached; everything else is read live off RIB, so
// placing a hundred numbers a frame allocates nothing.
window.__V104 = Object.assign(window.__V104 || {}, {
  cell: (n) => ribCellV91(n) || ribCellV22(n) || ribCell(n),
  get bands() { return RIB.numBandTex; },
  get font() { return RIB.numFont; },
  get placed() { return RIB.numPlaced || 0; },
  get last() { const m = RIB.numLast; if (!m) return null;
    const half = (m._numCapV104 || 0) / 2;
    return { num: m.num, tex: m.tex, rear: m._numRearV104, band: m._numBandV104, row: m._numRowV104,
      cap: m._numCapV104, inkTop: m._numRowV104 - half, inkBot: m._numRowV104 + half, scale: m._numScaleV104,
      onScreenH: m._numCapV104 * (m.body.scaleY || 1) * (m.root ? m.root.scale : 1) }; }
});
/* ===== v108 THE EXCHANGE, AND WHICH WAY HE THROWS =====
 * v107 gave the throw a facing; it could not give it a SIDE. `faceMarker` never flips an `up`
 * man (there is one rear drawing and a mirror of it would put the ball in the wrong hand), so a
 * quarterback throwing at a receiver twenty yards in FRONT of him was turned onto the quarter
 * cycle — he threw across his body at a man he was looking straight at. The sheet now carries the
 * rear throw twice: `throwR_up*`, the ball leaving to his screen-right, and `throwL_up*`, the arm
 * coming across and finishing to his left (drawn, not mirrored). Inside a cone off straight ahead
 * he keeps the facing and picks the ARM; a target off to the side or behind him still turns.
 *
 * And the exchange is drawn at last. v105 made the handoff and the pitch a ball travelling between
 * two hands, but the quarterback's BODY kept running through it: he never reached, never extended,
 * never came back empty. `handoff_up0..4` (reach, ball in hand, THE BALL AT ARM'S LENGTH, the hand
 * empty, the recovery) and `toss_up0..4` (the belly, the wind at the hip, the swing, THE RELEASE,
 * the follow) play under the same lookahead the throw uses, back-dated so the frame that lets go
 * lands on the sim's own `handoff` event.
 *
 * THE BALL, ONCE. Every one of these cycles draws a football on some frames and not on others, and
 * the renderer carries its own — so `BALL_DRAWN_V108` says, per cycle, which frames the ART has it
 * (measured off the atlas, not assumed: the rear throw only really shows it cocked at the ear on
 * frame 3, the front and quarter cycles carry it 0-3, and the new cells draw it at the ear / at
 * arm's length / at the belly). On those frames ours is scaled away; on every other frame the man
 * still holds it and ours rides the CELL's hand at the offset `HAND_V108` measured off the same
 * pixels. Never two, never none, right up to the release. `window.__V108` counts both. */
const THROW_DIR_V108 = { R: "throwR_up", L: "throwL_up" };
// the frames whose CELL draws a football (index into the cycle, measured off rib_field_v91.png)
const BALL_DRAWN_V108 = { throw_up: [3], throw_dn: [0, 1, 2, 3], throw_ur: [0, 1, 2, 3],
  throwR_up: [1, 2, 3], throwL_up: [1, 2, 3], handoff_up: [0, 1, 2, 3], handoffL_up: [0, 1, 2, 3], toss_up: [0, 1, 2] };   // v118: the quarterback's own sheets (build-field-art.py prints these)
// and where the ball sits in that cell — CELL pixels off its centre (24, 24), the same units the
// v105 hand offset works in. Ours is mounted here whether it is drawn or hidden, so the exchange
// leaves the hand the drawing puts it in.
const HAND_V108 = {   // v118: measured by build-field-art.py off the cut cells (the ball where it is drawn, the throwing hand where it is not)
  throwR_up:   [[9.5, -1.0], [7.7, -2.8], [10.8, -8.0], [10.8, -8.0], [9.3, -21.5], [12.7, -10.6]],
  throwL_up:   [[9.5, -1.0], [7.7, -2.8], [10.8, -8.0], [10.8, -8.0], [-13.1, -17.7], [-8.3, 4.1]],
  handoff_up:  [[6.1, -1.9], [8.8, -1.6], [12.3, -4.3], [12.6, -4.3], [15.9, -4.4]],
  handoffL_up: [[-6.2, -1.9], [-8.9, -1.6], [-12.4, -4.3], [-12.7, -4.3], [-16.0, -4.4]],
  toss_up:     [[6.9, -3.8], [9.8, -0.7], [12.3, -1.6], [15.6, -2.3], [15.8, -3.5]],
};
const EX_V108 = {   // v118: five cells each — the turn, the ball out low, at arm's length, ONE HAND AT FULL STRETCH (cell 3, on the event), the hand empty
  handoff:  { st: "handoff",  cyc: "handoff_up",  n: 5, rel: 3, ms: () => TU("handoffFrameMs", 70) },
  handoffL: { st: "handoffL", cyc: "handoffL_up", n: 5, rel: 3, ms: () => TU("handoffFrameMs", 70) },   // v118: the same reach mirrored, for a back off his LEFT
  toss:     { st: "toss",     cyc: "toss_up",     n: 5, rel: 3, ms: () => TU("tossFrameMs", 80) },      // the turn, the wind at the hip, the ball out, THE RELEASE (cell 3), the hand empty
};
const TOSS_CALL_V108 = /toss|sweep|pitch|reverse|pin and pull|outside zone/i;   // the playbook's sweep family: a CALL, read before the event
function v108Hook() {
  const V7 = (window.__V107 = window.__V107 || { throws: [] });
  const V8 = (window.__V108 = window.__V108 || { handoffs: [], tosses: [], ballDoubled: 0, ballMissing: 0 });
  V8.throws = V7.throws; return V8;
}
function cycleV108(m) {
  // which drawn cycle this man is on this frame, and the frame of it — the one place the ball
  // block, the hook and the state machine agree about what the cell is showing
  if (!m || !m.forceState) return null;
  if (m.forceState === "throwSeq") {
    const cyc = m._thrDirV108 ? THROW_DIR_V108[m._thrDirV108] : (RIB.throwV107 && RIB.throwV107[m.dirKey]);
    if (!cyc) return null;
    return { cyc, f: Math.max(0, Math.min(5, Math.floor((m.tms - (m.seqT || 0)) / TU("throwFrameMs", 85)))) };
  }
  if (m.forceState === "handSeq" && m._exV108) { const E = m._exV108;
    return { cyc: E.cyc, f: Math.max(0, Math.min(E.n - 1, Math.floor((m.tms - (m.seqT || 0)) / E.fm))) }; }
  return null;
}
function ribRegisterTeam(scene, team, p1, p2, deco) {
  // Re-register for every live scene. A global ready flag is not proof that this scene
  // owns the required texture keys, and stale cache state caused all-or-nothing players.
  RIB.teams[team] = p1 + p2;
  RIB.teamCols[team] = [p1, p2];                       // v22: remember for re-register when the overlay loads late
  // v45: an optional per-team texture decorator (the referee crew paints zebra
  // stripes over the recolored jersey). Persist it so the v22-overlay reload path
  // re-applies the same treatment instead of dropping the officials to plain kit.
  if (deco) (RIB.teamDeco || (RIB.teamDeco = {}))[team] = deco;
  else deco = RIB.teamDeco && RIB.teamDeco[team];
  if (RIB.regScenes.indexOf(scene) < 0) RIB.regScenes.push(scene);
  // v49: the officials own their art. Their sheet covers every pose they can strike,
  // so skip the whole player-state recolor for them — it was ~200 unused canvases per
  // scene (refs never block, juke, dive or catch) and any path that re-registers teams
  // would otherwise stamp the zebra stand-in back over the real crew.
  if (team === "ref" && RIB.refImg) { ribRegisterRefs(scene); return; }
  const put = (key, srcName) => {
    const cell0 = ribCellV91(srcName) || ribCellV22(srcName) || ribCell(srcName); if (!cell0) return;   // v91 > v22 > baked, by name
    RIB.numBandTex[key] = numBandV104(srcName, cell0);   // v104: where this pose wears its number
    let cv = ribRecolor(cell0, p1, p2);
    if (deco) { try { cv = deco(cv) || cv; } catch (e) {} }
    try { scene.textures.remove(key); } catch (e) {}
    scene.textures.addCanvas(key, cv);
  };
  ["dn", "dr", "sd", "ur", "up"].forEach((dd) => {
    for (let i = 0; i < 8; i++) put("spr_" + team + "_" + dd + "_run" + i, "run_" + dd + i);
    put("spr_" + team + "_" + dd + "_idle", dd === "up" ? "idle_up" : dd === "dn" ? "idle_dn" : "idle_sd");
    put("spr_" + team + "_" + dd + "_catch", "catch");
    put("spr_" + team + "_" + dd + "_cut", "run_" + dd + "2");
    // v22 additive: a dedicated detailed cutting/plant frame overrides ONLY the
    // cut state (base run frame 2 is left alone) when the overlay provides it
    if (ribCellV91("cut_" + dd) || ribCellV22("cut_" + dd)) put("spr_" + team + "_" + dd + "_cut", "cut_" + dd);
    // v91: the new facings' states. The get-up, celebration, hurt and walk sheets carry four
    // facings; the side view borrows the down-right one.
    const d4 = dd === "sd" ? "dr" : dd;
    put("spr_" + team + "_" + dd + "_plant", "plant_" + dd); put("spr_" + team + "_" + dd + "_fall", "fall_" + dd); put("spr_" + team + "_" + dd + "_divex", "dive_" + dd);
    put("spr_" + team + "_" + dd + "_catchhold", "catchhold_" + (dd === "up" || dd === "ur" ? "up" : dd === "dn" ? "dn" : "dr"));
    for (let ai = 0; ai < 8; ai++) put("spr_" + team + "_" + dd + "_getup" + ai, "getup_" + d4 + ai);
    for (let ai = 0; ai < 4; ai++) put("spr_" + team + "_" + dd + "_celebrate" + ai, "celebrate_" + d4 + ai);
    for (let ai = 0; ai < 2; ai++) { put("spr_" + team + "_" + dd + "_hurt" + ai, "hurt_" + d4 + ai); put("spr_" + team + "_" + dd + "_walk" + ai, "walk_" + d4 + ai); }
    for (let ai = 0; ai < 4; ai++) {
      put("spr_" + team + "_" + dd + "_juke" + ai, "juke_" + dd + ai);
      put("spr_" + team + "_" + dd + "_stiff" + ai, "stiff_" + dd + ai);
    }
    for (let ai = 0; ai < 3; ai++) {
      put("spr_" + team + "_" + dd + "_catch" + ai, "catch_" + dd + ai);
      put("spr_" + team + "_" + dd + "_divecatch" + ai, "divecatch_" + dd + ai);
      put("spr_" + team + "_" + dd + "_hurdle" + ai, "hurdle_" + dd + ai);
    }
  });
  for (let bi = 0; bi < 6; bi++) {
    put("spr_" + team + "_dn_block" + bi, "block_dn" + bi);
    put("spr_" + team + "_up_block" + bi, "block_up" + bi);
    put("spr_" + team + "_sd_block" + bi, "block_sd" + bi);
    put("spr_" + team + "_dr_block" + bi, "block_dn" + bi);
    put("spr_" + team + "_ur_block" + bi, "block_up" + bi);
  }
  put("spr_" + team + "_dn_stance", "stance_dn"); put("spr_" + team + "_up_stance", "stance_up"); put("spr_" + team + "_sd_stance", "stance_dn");
  put("spr_" + team + "_dn_stance2", "stance_dn"); put("spr_" + team + "_up_stance2", "stance_up"); put("spr_" + team + "_sd_stance2", "stance_up");
  put("spr_" + team + "_sd_dive", "dive2"); put("spr_" + team + "_dn_dive", "dive2"); put("spr_" + team + "_up_dive", "dive2");
  put("spr_" + team + "_sd_grab", "grab"); put("spr_" + team + "_dn_grab", "grab"); put("spr_" + team + "_up_grab", "grab");
  // tackle-to-ground sequence: the carrier visibly folds to the turf after the whistle.
  // dive0-3 are the fall arc, down0-1 settle him flat — driven by the "tackleSeq" pose.
  ["dive0", "dive1", "dive2", "dive3", "down0", "down1"].forEach((src, i) => put("spr_" + team + "_tackle" + i, src));
  ["pancake0", "pancake1", "pancake2"].forEach((src, i) => put("spr_" + team + "_pancake" + i, src));
  ["getup0", "getup1", "getup2", "getup3"].forEach((src, i) => put("spr_" + team + "_getup" + i, src));
  put("spr_" + team + "_down", "down1");
  /* ===== v107 THE ARM, THE DROP, THE STANCE =====
   * The throw was one baked, facing-less six-frame cycle stamped onto all five facings, the
   * dropback was the run cycle played backwards, and the whole offense waited on the snap in
   * the defense's two-point stance. The v91 sheet now carries a throw per facing (up, dn and
   * the quarter ur), a backpedal seen from behind, and the offense's own pre-snap poses — so
   * each of those states is drawn instead of borrowed. Nobody drew a pure profile or a
   * down-diagonal throw: `sd` borrows the quarter (the arm already comes across the body) and
   * `dr` the front (the only cycle facing the camera). Without the atlas (?noV91) the baked
   * frames stand in exactly as before. */
  const thrSrcV107 = { up: "throw_up", dn: "throw_dn", ur: "throw_ur", sd: "throw_ur", dr: "throw_dn" };
  RIB.throwV107 = {};
  try { const V7 = (window.__V107 = window.__V107 || { throws: [] }); V7.map = RIB.throwV107; V7.v91 = !!RIB.v91img; } catch (e) {}
  ["up", "dn", "sd", "dr", "ur"].forEach((dd) => {
    const src = ribCellV91(thrSrcV107[dd] + "0") ? thrSrcV107[dd] : null;   // the drawn cycle, or the baked fallback
    RIB.throwV107[dd] = src;
    for (let ti = 0; ti < 6; ti++) put("spr_" + team + "_" + dd + "_throw" + ti, src ? src + ti : "throw" + ti);
  });
  // v107: rear-view only — the sheet is drawn from behind, so these dress the OFFENSE
  for (let bi = 0; bi < 6; bi++) put("spr_" + team + "_up_backpedal" + bi, "backpedal_up" + bi);
  put("spr_" + team + "_up_stance3", "stance3_up");   // the drawn centre-over-the-ball pose is not used: its arms read wrong
  put("spr_" + team + "_up_ready", "ready_up"); put("spr_" + team + "_up_carry", "carry_up");
  // v108: the throw's two sides and the two exchanges — rear-view art again, so the offense only
  for (let ti = 0; ti < 6; ti++) { put("spr_" + team + "_up_throwR" + ti, "throwR_up" + ti); put("spr_" + team + "_up_throwL" + ti, "throwL_up" + ti); }
  for (let hi = 0; hi < 5; hi++) { put("spr_" + team + "_up_handoff" + hi, "handoff_up" + hi); put("spr_" + team + "_up_handoffL" + hi, "handoffL_up" + hi); put("spr_" + team + "_up_toss" + hi, "toss_up" + hi); }   // v118: and the reach to his left
  /* ===== v109 THE RECEIVER FINDS THE BALL =====
   * The sheet carries four drawn catch sequences per facing — 46 cells (up/dn/dr, four frames
   * each, two dr variants three) — that were cut but never registered, so the broadcast kept
   * playing the three baked catch frames over them. Registered under every facing now, sd
   * borrowing dr and ur up as catchhold does; a variant short a frame holds its last one.
   * Which variant plays is the KIND of the reach (RIB.catchseqV109), read off the cells: 0 is in
   * stride, 2 the two-hand high point, up1/dn3/dr2 the turn back over the shoulder, and up3/dn1
   * the bobble that ends on the ground — the drop. */
  const csV109 = { up: "up", ur: "up", dn: "dn", dr: "dr", sd: "dr" }; let csN = 0;
  ["up", "dn", "sd", "dr", "ur"].forEach((dd) => { for (let v = 0; v < 4; v++) { let last = null;
    for (let f = 0; f < 4; f++) { const nm = "catchseq_" + csV109[dd] + v + "_" + f; if (ribCellV91(nm)) { last = nm; csN++; } if (last) put("spr_" + team + "_" + dd + "_catchseq" + v + "_" + f, last); } } });
  RIB.catchseqV109 = { stride: { up: 0, dn: 0, dr: 0 }, high: { up: 2, dn: 2, dr: 0 }, "back-shoulder": { up: 1, dn: 3, dr: 2 }, drop: { up: 3, dn: 1, dr: 3 } };
  try { const B = (window.__V109_B = window.__V109_B || {}); B.catchseqRegistered = csN; B.catchseqMap = RIB.catchseqV109; } catch (e) {}
  // bust every live marker's texture cache so re-registered keys rebind immediately
  try { if (scene.markers) scene.markers.forEach((m) => { m.tex = null; }); } catch (e) {}
}
function ribSyncOpp(scene) {
  if (!RIB.ready) return;
  try {
    const opp = scene.teamNames ? (scene.teamNames().them || "") : "";
    if (opp === RIB.defName && RIB.defPal) { ribSyncEndZonesV93(scene); ribPaintScorebugV98(opp); }   // v93: the paint follows the fixture even when the kit is cached
    // v28.1: the name cache alone is NOT proof this scene owns the def textures — the
    // live view remounts the Phaser game, wiping them while RIB.defName survives. That
    // left the whole defense on the white fallback for a full game. Skip only when this
    // scene really has the keys; otherwise fall through and re-register.
    if (opp === RIB.defName && scene.textures && scene.textures.exists("spr_def_dn_idle")) return;
    RIB.defName = opp;
    // v20: never let the opponent land on the user team's palette (or any palette
    // with the same jersey color) — walk forward from the hashed pick until the
    // kits are actually distinguishable.
    const pal = ribOppPalV98(opp);
    try{window.__oppJerseyV25=parseInt(String(pal[0]).replace("#",""),16);}catch(_e){}
    ribRegisterTeam(scene, "def", pal[0], pal[1]);
    RIB.defPal = [pal[0], pal[1]]; ribSyncEndZonesV93(scene);           // v93: an away week paints their colours on the field
    ribPaintScorebugV98(opp);                                             // v98: the scorebug follows the kits
  } catch (e) {}
}
/* ===== v98 THE SCOREBUG WEARS THE KITS =====
 * The live scoreboard used to be green-for-us and red-for-them whatever the teams wore.
 * Now the two sides carry the same palettes the kits and the end zones do: the user's
 * palette on the left, the opponent's (by the v44 emblem walk, so it never clashes with
 * ours) on the right. The colours land as CSS variables on the root, so the markup can be
 * re-rendered as often as the career app likes and still come up dressed. The score
 * itself is the primary lifted until it reads on the dark bug. */
function ribOppPalV98(opp) {
  const usIdx = (window.__GRIDIRON_TEAM_CUSTOM__ && window.__GRIDIRON_TEAM_CUSTOM__.palette) || 0;
  const usPal = TEAM_PALETTES[usIdx] || TEAM_PALETTES[0];
  // v44: the opponent's kit starts from their EMBLEM's matched palette (Wolves take the
  // field in wolf colors); the distinguishability walk below still guarantees the two
  // kits never blur together, falling forward to the next palette on a clash.
  const _li = logoForName(opp);
  let pi = _li != null ? logoPalIdx(_li) : 1 + ribHash(opp) % (TEAM_PALETTES.length - 1);
  for (let tries = 0; tries < TEAM_PALETTES.length; tries++) {
    const cand = TEAM_PALETTES[pi];
    if (pi !== usIdx && cand && String(cand[0]).toLowerCase() !== String(usPal[0]).toLowerCase()) break;
    pi = 1 + (pi % (TEAM_PALETTES.length - 1));
  }
  return TEAM_PALETTES[pi] || TEAM_PALETTES[1];
}
function ribPaintScorebugV98(opp) {
  try {
    const usIdx = (window.__GRIDIRON_TEAM_CUSTOM__ && window.__GRIDIRON_TEAM_CUSTOM__.palette) || 0;
    const us = TEAM_PALETTES[usIdx] || TEAM_PALETTES[0];
    const them = (opp && opp === RIB.defName && RIB.defPal) ? RIB.defPal : ribOppPalV98(opp || RIB.defName || "");
    const hex = (c) => { const n = parseInt(String(c).replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const lum = (r) => (0.2126 * r[0] + 0.7152 * r[1] + 0.0722 * r[2]) / 255;
    // the score glows in the primary, lifted toward white until it reads on the dark bug
    const lift = (c) => { let r = hex(c); for (let i = 0; i < 8 && lum(r) < TU("sbScoreLum", 0.62); i++) r = r.map((v) => Math.round(v + (255 - v) * 0.22)); return "rgb(" + r.join(",") + ")"; };
    const st = document.documentElement.style;
    st.setProperty("--sbUs1", us[0]); st.setProperty("--sbUs2", us[1]); st.setProperty("--sbUsSc", lift(us[0]));
    st.setProperty("--sbThem1", them[0]); st.setProperty("--sbThem2", them[1]); st.setProperty("--sbThemSc", lift(them[0]));
    window.__SCOREBUG_V98 = { us: [us[0], us[1]], them: [them[0], them[1]], usSc: lift(us[0]), themSc: lift(them[0]), opp: opp || RIB.defName || "" };
  } catch (e) {}
}
window.__ribPaintScorebugV98 = ribPaintScorebugV98;
/* ===== v109 THE SCOREBUG COUNTS THE TIMEOUTS — three pips a side, lit while the timeout is still held =====
 * The pips are created on first paint under each side's `.sb-meta` (the career app re-renders the markup freely, so
 * nothing is assumed to exist), and every row the playback driver shows repaints them from its `toLeft`. */
function ribPaintTimeoutsV109(toLeft) {
  try {
    const sb = document.querySelector(".live-scoreboard"); if (!sb) return;
    const out = {};
    ["us", "them"].forEach(side => {
      const host = sb.querySelector(".sb-side." + side + " .sb-meta"); if (!host) return;
      let el = host.querySelector(".sb-to-v109");
      if (!el) { el = document.createElement("span"); el.className = "sb-to-v109"; el.title = "Timeouts left"; el.innerHTML = "<i></i><i></i><i></i>"; host.appendChild(el); }
      const n = toLeft && toLeft[side] != null ? Math.max(0, Math.min(3, Number(toLeft[side]))) : 3;
      [...el.children].forEach((pip, i) => pip.classList.toggle("on", i < n));
      out[side] = n;
    });
    window.__V109_D = window.__V109_D || {}; window.__V109_D.pips = out;
  } catch (e) {}
}
window.__ribPaintTimeoutsV109 = ribPaintTimeoutsV109;
/* ===== v96 HIS OWN KIT — the you-player wears his team's colours =====
 * "you" used to be its own gold-and-navy kit, so the user's man never matched the ten
 * around him. Now the "you" textures are a copy of his team's kit ("off" is the user's
 * palette, "def" the opponent's; since v105.2 a marker's kit follows possession, not its
 * side), re-registered only when that palette changes. The plumbob still says which one he is. */
function ribSyncYouKitV96(scene, side) {
  try {
    const c = RIB.teamCols[side]; if (!c) return;
    const key = side + ":" + c[0] + c[1];
    if (RIB.youKitV96 === key && scene.textures && scene.textures.exists("spr_you_dn_idle")) return;
    RIB.youKitV96 = key; ribRegisterTeam(scene, "you", c[0], c[1]);
  } catch (e) {}
}
// the atlas decodes the moment the page loads — long before any game starts
(function () {
  if (!window.__RIB_ATLAS) return;
  const img = new Image();
  img.onload = () => { RIB.img = img; RIB.loaded = true; if (RIB.pendingScene) ribActivate(RIB.pendingScene); };
  img.onerror = (e) => console.error("[RIB] ATLAS FAILED TO DECODE — no sprites will render", e);
  img.src = window.__RIB_ATLAS;
  const fimg = new Image();
  fimg.onload = () => { RIB.fieldImg = fimg; if (RIB.fieldScene) ribField(RIB.fieldScene); };
  fimg.onerror = (e) => console.error("[RIB] FIELD ART FAILED TO DECODE", e);
  fimg.src = window.__RIB_FIELD;
  // v22 overlay atlas: prefer a baked data-URL (offline single file) if present,
  // else the dev-served PNG. On success, re-register every team on every live
  // scene so the higher-fidelity cells take over; on failure, stay on the baked atlas.
  const v22 = new Image();
  v22.onload = () => {
    RIB.v22img = v22; RIB.v22cache = {};
    try {
      RIB.regScenes.forEach((sc) => {
        if (!sc || !sc.textures) return;
        for (const tm in RIB.teamCols) { const c = RIB.teamCols[tm]; try { ribRegisterTeam(sc, tm, c[0], c[1], RIB.teamDeco && RIB.teamDeco[tm]); } catch (e) {} }
      });
    } catch (e) {}
    console.log("[RIB] v22 sprite overlay active");
  };
  v22.onerror = () => { /* no overlay available — baked atlas stands */ };
  v22.src = window.__RIB_ATLAS_V22 || window.__RIB_ASSET("rib_atlas_v22.png");
  // v49: the officials' own sheet, decoded alongside. It arrives on its own clock,
  // so re-register every live scene when it lands — the zebra recolor holds the
  // spr_ref_* keys until then and simply gets overwritten.
  const refs = new Image();
  refs.onload = () => {
    RIB.refImg = refs; RIB.refCache = {};
    try { RIB.regScenes.forEach((sc) => ribRegisterRefs(sc)); } catch (e) {}
    console.log("[RIB] v49 referee art active");
  };
  refs.onerror = () => console.warn("[v49] referee sheet failed to load — zebra recolor stands in");
  refs.src = window.__RIB_REFS_V49 || window.__RIB_ASSET("rib_refs_v49.png");
  // v57: the crowd sheet, on its own clock like the officials'. Until it decodes
  // there are simply no stands — the margin outside the sidelines keeps the
  // edge-extended grass warpField already puts there, which is what shipped
  // before this system existed. Rebuild every live scene when it lands.
  const crowd = new Image();
  crowd.onload = () => {
    RIB.crowdImg = crowd; RIB.crowdCache = {}; RIB.crowdAisle = {}; RIB.crowdTrim = {};
    try { RIB.regScenes.forEach((sc) => { if (sc && sc.buildCrowd) sc.buildCrowd(); }); } catch (e) {}
    console.log("[RIB] v57 crowd art active");
  };
  crowd.onerror = () => console.warn("[v57] crowd sheet failed to load — stands stay empty");
  crowd.src = window.__RIB_CROWD_V57 || window.__RIB_ASSET("rib_crowd_v57.png");
  // v78: the sideline sheet, same contract as the two above. Until it decodes the
  // team area is the bare apron v57 left, and the game plays exactly as before.
  const side = new Image();
  side.onload = () => {
    RIB.sideImg = side; RIB.sideCache = {};
    try { RIB.regScenes.forEach((sc) => { if (sc && sc.buildSideline) { ribRegisterSide(sc); sc.buildSideline(); } }); } catch (e) {}
    console.log("[RIB] v78 sideline art active");
  };
  side.onerror = () => console.warn("[v78] sideline sheet failed to load — the team area stays empty");
  side.src = window.__RIB_SIDE_V78 || window.__RIB_ASSET("rib_side_v78.png");
  // v91: the field sheets. Same contract: on its own clock, re-register every live scene
  // when it lands (teams for the player cells, the ball frames on their own), and until then
  // the v22 overlay and the baked atlas stand exactly as before.
  const fld = new Image();
  const noV91 = /[?&]noV91\b/.test(location.search);   // ?noV91: the field without the sheet, for a side-by-side
  fld.onload = () => {
    RIB.v91img = fld; RIB.v91cache = {};
    try {
      RIB.regScenes.forEach((sc) => {
        if (!sc || !sc.textures) return;
        for (const tm in RIB.teamCols) { const c = RIB.teamCols[tm]; try { ribRegisterTeam(sc, tm, c[0], c[1], RIB.teamDeco && RIB.teamDeco[tm]); } catch (e) {} }
        try { ribRegisterBallV91(sc); } catch (e) {}
      });
    } catch (e) {}
    window.__V91 = Object.assign(window.__V91 || {}, { loaded: true, cells: Object.keys(RIB_META_V91).length, cacheKeys: () => Object.keys(RIB.v91cache || {}), teamCols: () => RIB.teamCols });
    console.log("[RIB] v91 field art active");
  };
  fld.onerror = () => console.warn("[v91] field sheet failed to load — v22 and the baked atlas stand");
  if (!noV91) fld.src = window.__RIB_FIELD_V91 || window.__RIB_ASSET("rib_field_v91.png");
  // v92: the stadium sheet (floodlight towers). Same contract; the big screen needs no art.
  const lit = new Image();
  const noV92 = /[?&]noV92\b/.test(location.search);   // ?noV92: the sky as v57 left it
  lit.onload = () => {
    RIB.lightsImg = lit;
    try { RIB.regScenes.forEach((sc) => { if (sc && sc.buildStadiumV92) { ribRegisterLightsV92(sc); sc.buildStadiumV92(); } }); } catch (e) {}
    window.__V92 = Object.assign(window.__V92 || {}, { loaded: true });
    console.log("[RIB] v92 stadium art active");
  };
  lit.onerror = () => console.warn("[v92] lights sheet failed to load — the sky behind the bowl stays empty");
  if (!noV92) lit.src = window.__RIB_LIGHTS_V92 || window.__RIB_ASSET("rib_lights_v92.png");
})();
function ribField(scene) {
  if (!RIB.fieldImg || !scene || !scene.add || scene.fieldSpr) return;
  try {
    if (!scene.textures.exists("rib_field")) scene.textures.addImage("rib_field", RIB.fieldImg);
    // v27 USER FIELD ART: the uploaded flat field image IS the turf, but it is displayed
    // through warpField() — re-baked each snap with the same consistent perspective curve
    // the players use. Created flat here, then refreshPersp() swaps in the warped texture.
    scene.fieldSpr = scene.add.image(FW / 2, NSTOP + NSH / 2, "rib_field").setScale(2).setDepth(0.6);
    scene.fieldWash = null;
    try { scene.refreshPersp && scene.refreshPersp(); } catch (e) {}
    console.log("[RIB] user field art active (v27 warp)");
  } catch (e) { console.error("[RIB] field art failed", e); }
}
function ribActivate(scene) {
  RIB.fieldScene = scene; ribField(scene);
  if (!scene || !RIB.loaded) return;
  RIB.ready = true; window.__RIB_FRAMES = 8; window.__RIB_BLOCKF = 6;   // base run cycle (v22 is additive; it does not touch run)
  try { scene.textures.remove("spr_ball"); } catch (e) {}
  scene.textures.addCanvas("spr_ball", ribCell("ball"));   // fix: the ball texture lives in the atlas now
  try { ribRegisterBallV91(scene); } catch (e) {}          // v91: the spiral and the tumble, when the sheet is in
  { const _tc = window.__GRIDIRON_TEAM_CUSTOM__, _p = (_tc && TEAM_PALETTES[_tc.palette]) || TEAM_PALETTES[0];
    ribRegisterTeam(scene, "off", _p[0], _p[1]); try{window.__usJerseyV25=parseInt(String(_p[0]).replace("#",""),16);}catch(_e){} }
  ribRegisterTeam(scene, "you", "#f0bb45", "#20304a");
  // v45 OFFICIALS: a seventh "team" — the referee crew. White base kit recolored
  // then zebra-striped across the chest. v49 replaces this with the real officials
  // sheet the moment it decodes; the recolor only survives as the never-decoded fallback.
  ribRegisterTeam(scene, "ref", "#f2f4f7", "#15181c", ribZebra);
  ribRegisterRefs(scene);                              // v49: real officials art overwrites the zebra stand-in
  ribSyncOpp(scene);
  console.log("[RIB] sprite atlas active — 40-palette recolor online");
}
function ribInit(scene) {
  if (!scene) return;
  RIB.pendingScene = scene;
  if (RIB.loaded) ribActivate(scene);
  // If the image is still decoding, the scene keeps its fallback characters and
  // ribActivate will replace them the instant decoding completes.
}
/* Drop-in art pipeline: feed a 3-column x 11-row sprite sheet (front/back/side ×
 * idle,run0-3,cut,catch,stance,dive,grab,down) and it replaces the procedural set.
 * Usage: window.__GRIDIRON_LOAD_SHEET(imageSrcOrDataURL, "off"|"def"|"you") */
window.__GRIDIRON_LOAD_SHEET = function (src, team) {
  const scene = window.__gridironScene;
  if (!scene) return console.warn("[sheet] scene not ready");
  const img = new Image();
  img.onload = function () {
    const COLS = 3, ROWS = 11, cw = img.width / COLS, chh = img.height / ROWS;
    const rows = ["idle","run0","run1","run2","run3","cut","catch","stance","dive","grab","down"];
    const cols = ["dn","up","sd"];
    rows.forEach((st, r) => cols.forEach((fc, c2) => {
      let key;
      if (st === "down") { if (c2 !== 2) return; key = "spr_" + team + "_down"; }
      else if ((st === "stance" || st === "dive" || st === "grab") && c2 !== 2) return;
      else key = "spr_" + team + "_" + fc + "_" + st;
      const cv = document.createElement("canvas"); cv.width = 48; cv.height = 48;
      const cx = cv.getContext("2d"); cx.imageSmoothingEnabled = false;
      cx.drawImage(img, c2 * cw, r * chh, cw, chh, 0, 0, 48, 48);
      try { scene.textures.remove(key); } catch (e) {}
      scene.textures.addCanvas(key, cv);
    }));
    console.log("[sheet] loaded", team);
  };
  img.src = src;
};
function ribEnsureFallback(scene) {
  if (!scene || scene.textures.exists("rib_player_fallback")) return;
  const cv = document.createElement("canvas"); cv.width = 48; cv.height = 48;
  const c = cv.getContext("2d"); c.imageSmoothingEnabled = false;
  c.fillStyle = "rgba(0,0,0,.28)"; c.beginPath(); c.ellipse(24,39,12,4,0,0,Math.PI*2); c.fill();
  c.fillStyle = "#f3f6fb"; c.strokeStyle = "#111827"; c.lineWidth = 2;
  c.beginPath(); c.arc(24,17,8,0,Math.PI*2); c.fill(); c.stroke();
  c.fillRect(18,24,12,13); c.strokeRect(18,24,12,13);
  c.fillRect(15,27,4,10); c.fillRect(29,27,4,10);
  c.fillRect(19,36,4,8); c.fillRect(25,36,4,8);
  scene.textures.addCanvas("rib_player_fallback", cv);
}
class Ot extends mt.Scene {
  field; markers = []; fxObjs = []; ballSpr; completion;
  play = null;                                    // active playback state
  offLabels = ["WR","WR","TE","OL","OL","OL","OL","OL","QB","RB","WR"];
  defLabels = ["CB","CB","S","S","LB","LB","LB","DE","DT","DT","DE"];
  constructor() { super("LiveField"); }
  create() {
    window.__gridironScene = this;
    ribEnsureFallback(this);
    ribInit(this);
    this.field = this.add.graphics().setDepth(0.8); this.trail = this.add.graphics().setDepth(3);   // v25: procedural turf sits ABOVE the baked art (which we hide)
    this.fieldLines = this.add.graphics().setDepth(3.4);   // LOS + first-down markers, above turf art, below players
    this.speedFx = this.add.graphics().setDepth(3.6);
    this.drawField(50, 60);
    // Madden rig: the main camera lives on the field and follows the ball; the legend gets its own fixed camera
    try {
      const cam = this.cameras.main;
      cam.setViewport(0, 0, FW, FVH); cam.setBounds(0, 0, FW, WORLD_H);
      this.hitStop = 0; this.zoomPunch = 0;
    } catch (e) {}
  }

  teamNames() {
    try {
      const us = document.querySelector(".sb-side.us .team"), them = document.querySelector(".sb-side.them .team");
      return { us: (us && us.textContent.trim().slice(0,10)) || "HOME", them: (them && them.textContent.trim().slice(0,10)) || "AWAY" };
    } catch (e) { return { us: "HOME", them: "AWAY" }; }
  }
  trackFx(o) { this.fxObjs.push(o); return o; }
  dropFx(o) { const i = this.fxObjs.indexOf(o); if (i >= 0) this.fxObjs.splice(i, 1); try { o.destroy(); } catch (e) {} }
  killAllFx() { for (const o of this.fxObjs.splice(0)) { try { o.destroy(); } catch (e) {} } }

  renderStatic(et) {
    this.stopActiveAnimation();
    const rt = et.offense !== "them";
    VDIR = rt ? 1 : -1;
    ribSyncOpp(this);
    const it = rt ? (et.startBall ?? 50) : 100 - (et.startBall ?? 50),
      ht = mt.Math.Clamp(it + (rt ? 1 : -1) * (et.preToGo ?? 10), 0, 100);
    this.drawField(it, ht);
    this.drawWearV86(et);   // v86: the static view keeps the game's wear (a new game wipes it when the quarter goes back to 1)
    this.drawGoalpostsV87();
    this.staticFormation(it, rt);
    const f = pickFeaturedIndex(et, this.offLabels, this.defLabels);
    this.highlight(this.markers[f.index], f.isMe);
    try { window.applyFieldFx && window.applyFieldFx(); } catch (e) {}
  }

  softStop() {   // between plays: clear FX/tweens but keep markers for gliding
    this.play = null; this.tweens.killAll(); this.time.removeAllEvents();
    this.completion = void 0; this.killAllFx(); this.clearRefs();
    if (this.trail) this.trail.clear();
    if (this.ballSpr) { try { this.ballSpr.destroy(); } catch (e) {} this.ballSpr = void 0; }
    if (this.ballShad) { try { this.ballShad.destroy(); } catch (e) {} this.ballShad = void 0; }
    if (this.speedFx) this.speedFx.clear();
    this.hitStop = 0; this.zoomPunch = 0;
    this.resetCamera();
  }
  resetCamera() {
    try { const c = this.cameras.main;
      const z0 = (((window.__FIELD_FX && window.__FIELD_FX.zoom) || 1.16)) * TU("perspZoomK", 0.78);
      this._pcam = null; this._cvx = 0; this._cvy = 0;     // v27: clear the predictive lead between plays
      this._camHitV112 = null;                             // v112: a hit's step out never outlives its play
      if (this.play) { this.play._camCut = null; this.play._camCarV98 = null; this.play._camLandV112 = null; }   // v98: a cut never outlives its play
      this.endFlagFocus();                                 // v71: a focus never outlives its play
      const f = this.focusPt || { x: FW / 2, y: WORLD_H / 2 };
      /* ===== v109 THE BROADCAST CAMERA — the re-frame is a move, not a cut =====
       * The whistle pulls the camera wide (startPostV86 / camPostV109); the next snap used to SNAP
       * it back onto the new line of scrimmage the instant the post phase ended. Inside `camSoftMs`
       * of a whistle the reset only re-aims — the glide branch of `update` then carries the frame
       * onto the new line through the spring as the huddle forms — and the hard snap is kept for
       * every other caller (the static view, a torn-down scene). The soft window arms a real-time
       * fallback, so a reset that is NOT followed by a play still lands where it always did. */
      const soft = this._camSoftV109 && performance.now() < this._camSoftV109 && this.markers && this.markers.length && !this.camOffV112();
      if (soft) { const V = this.v109E(); V.cam.softResets = (V.cam.softResets || 0) + 1;
        const tk = this._camSoftTokV109 = (this._camSoftTokV109 || 0) + 1;
        setTimeout(() => { try { if (this._camSoftTokV109 === tk && !this.play && this.cameras && this.cameras.main) { this._camSoftV109 = 0; this.resetCamera(); } } catch (e) {} }, TU("camSoftMs", 900) + 30);
        return; }
      this._camSoftV109 = 0; this._camSpr = null;
      c.setZoom(z0); c.centerOn(f.x, f.y - 80); } catch (e) {}
  }
  /* ===== v109 THE BROADCAST (agent E) — the hook every v109 E check reads ===== */
  v109E() {
    const V = window.__V109_E = window.__V109_E || { cam: { maxJerk: 0, cuts: 0, whistleWide: 0, softResets: 0, frames: 0, leadFrames: 0, wideFrames: 0 }, cases: {},
      helpUps: 0, helpUpArrivals: 0, walkFrames: 0, celebrations: 0, celebrants: 0, lastCelebrants: 0, walkOffs: 0, surges: 0,
      huddle: { breaks: [], staggered: 0, walkFrames: 0 }, spots: 0, spotArrivals: 0, chainMoves: 0, measures: 0,
      shadows: { nudged: 0, recast: 0 }, eyes: 0, eyeSnaps: 0 };
    return V;
  }
  caseV109(t) { const C = this.v109E().cases; C[t] = (C[t] || 0) + 1; }
  /* The camera is a critically damped spring on pan and (log) zoom — one state, one integrator,
   * every framing decision above it only moves the TARGET. A lerp behind a dead-band stalled on
   * small corrections and micro-stepped on large ones; a spring has no dead-band, no step, and
   * its acceleration is capped (`camAccelMax`, px/s²), which is the number the hook reports as
   * `maxJerk` — the worst per-frame change of pan velocity a viewer would have felt. */
  camSpringV109(cam, cx, cy, tz, delta, stiffK, tv) {
    // v147 D: `tv` = the target's own velocity and how much of it to damp against (0 = the v109 spring)
    const ff = tv && tv.ff > 0 ? tv.ff : 0, tvx = ff ? tv.vx * ff : 0, tvy = ff ? tv.vy * ff : 0;
    const dt = Math.min(0.05, Math.max(0.004, (delta || 16) / 1000)), sk = stiffK || 1;
    const S = this._camSpr || (this._camSpr = { vx: 0, vy: 0, vz: 0, px: cam.midPoint.x, py: cam.midPoint.y, pvx: 0, pvy: 0, n: 0, t0: 0 });
    // the measurement is of the SPRING's own continuity: a frame the camera was moved by something
    // else (resetCamera between plays, a shake, a freeze-frame that skipped the integrator) is not
    // a jerk the spring produced, so it re-seeds the sample instead of counting one
    const nowMs = performance.now();
    if (Math.abs(cam.midPoint.x - S.px) > TU("camBreakPx", 24) || Math.abs(cam.midPoint.y - S.py) > TU("camBreakPx", 24) || (S.t0 && nowMs - S.t0 > dt * 1000 * 2.2 + 10)) { S.n = 0; const KB = this.v109E().cam; KB.breaks = (KB.breaks || 0) + 1; }
    S.t0 = nowMs;
    const k = TU("camStiff", 40) * sk, c = 2 * Math.sqrt(k) * TU("camDamp", 1), aMax = TU("camAccelMax", 9000) * Math.sqrt(sk);
    const x = cam.midPoint.x, y = cam.midPoint.y;
    const kz = TU("camZoomStiff", 45) * sk, cz = 2 * Math.sqrt(kz) * TU("camDamp", 1);
    const lz0 = Math.log(Math.max(0.05, cam.zoom)), ltz = Math.log(Math.max(0.05, tz));
    /* v147 D: one frame is several SUB-STEPS when the spring is stiff for the frame it is given —
     * a follow cam in a cut at 4× (ω ≈ 24/s) on a 45 ms frame was ωdt ≈ 1.1, where a semi-implicit
     * step overshoots and rings, frame to frame. The same continuous spring, integrated finely
     * enough; at 1× in Broadcast ωdt ≈ 0.1 and it is still exactly one step. */
    const nSub = !TU("camRateV147", 1) ? 1 : Math.max(1, Math.min(8, Math.ceil(Math.sqrt(Math.max(k, kz)) * dt / Math.max(0.05, TU("camSubstepWdtV147", 0.35)))));
    const h = dt / nSub, v0x = S.vx, v0y = S.vy;
    if (nSub > 1 && window.__V147D) window.__V147D.sub++;
    let px = x, py = y, lz = lz0;
    for (let s = 0; s < nSub; s++) {
      let ax = k * (cx + tvx * h * s - px) - c * (S.vx - tvx), ay = k * (cy + tvy * h * s - py) - c * (S.vy - tvy);
      const am = Math.hypot(ax, ay); if (am > aMax) { ax *= aMax / am; ay *= aMax / am; }
      S.vx += ax * h; S.vy += ay * h; px += S.vx * h; py += S.vy * h;
      // zoom in log space, so a pull-in and the pull-back out of it take the same time
      S.vz += (kz * (ltz - lz) - cz * S.vz) * h; lz += S.vz * h;
    }
    const nx = px, ny = py;
    const jerk = Math.hypot(S.vx - v0x, S.vy - v0y) / dt, step = Math.hypot(nx - x, ny - y);
    cam.setZoom(Math.exp(lz)); cam.centerOn(nx, ny);
    // v147 D: a pan the bounds stopped keeps no velocity into the wall, or the feed-forward winds it up
    if (ff) { if (Math.abs(cam.midPoint.x - nx) > 0.5) S.vx = 0; if (Math.abs(cam.midPoint.y - ny) > 0.5) S.vy = 0; }
    { const V = this.v109E().cam;
      if (jerk > V.maxJerk) V.maxJerk = Math.round(jerk);
      if (step > (V.maxStepPx || 0)) V.maxStepPx = +step.toFixed(2);
      V.frames++; }
    S.px = nx; S.py = ny; S.n++;
  }
  /* ===== v147 D THE CAMERA HOLDS STILL AT 4× =====
   * Every dial on the camera was tuned at 1×, in WALL time, against a world that moves at 1×. At 4×
   * the world moves four times as far per frame and the camera did three things wrong with it:
   *  1. the predictive lead was the focus's velocity in WALL px/s × `camLeadMs`, so it came out four
   *     times as long — it sat pinned on `camLeadMax` / the keep-clamp and FLIPPED end to end on
   *     every juke and every hand-over (the target's own shake, `tHf`, measured ~2× the focus's);
   *  2. nothing on its way to the spring was filtered for speed: the target's shake measured 2–3× the
   *     focus's own at 4×, and the camera passed it to the screen — pan shake 2–3× the 1× picture;
   *  3. the zoom target — `1/perspK` of the man under a lock, the open-field pull-in, the hit step
   *     out — changed four times as fast, and the zoom spring pumped with it frame to frame (2–4×).
   * The eye watches the camera in WALL time, so that is where it is held still. The focus's velocity
   * is measured in PLAY time (the lead is the 1× lead for the same run, stretched by √speed) and
   * smoothed over a wall window that lengthens with the speed; the pan TARGET rides a fading-memory
   * g-h filter (`camPanTauMsV147`) whose velocity is fed forward into the spring, so the spring tracks
   * a steady run with no lag at its 1× stiffness instead of being stiffened into the shake; the zoom
   * target rides a first-order low-pass (`camZoomTauMsV147`); a ball in the air may open the zoom off
   * where the camera actually IS. The FOLLOW cams, locked to one man in a box an eighth of the frame
   * wide, get a dead zone (`camFollowDeadV147`), a plain low-pass, a speed^0.35 spring, a shorter lead,
   * and stand a little further back at speed (`camFollowZoomRateExpV147`, and the play frame for a ball
   * in the air). The spring sub-steps whenever ωdt would ring (`camSubstepWdtV147`). Every time constant
   * scales with (speed − 1) / 3 and every exponent is of the speed, so 1× is the old camera (the same
   * plays measure within a few % at 1×). Measured on the SAME plays, 4× against 1× (geometric mean of
   * pan acc / pan shake / reversals / zoom shake): Broadcast 1.9–2.5× → 0.6–0.95×, Follow Me
   * 2.1–2.6× → 0.5–0.85×, the ball in frame as before. `camRateV147` is the one read of the user's
   * speed; `TU("camRateV147", 0)` restores the old camera exactly. `window.__V147D` is the hook
   * (`frames`, `rate`, `pre`, `resets`, `sub`); `scripts/v147Dcheck.mjs` the gate. */
  camRateV147() {
    if (!TU("camRateV147", 1)) return 1;
    const u = Number(window.__getGridironLiveSpeed ? window.__getGridironLiveSpeed() : 1);
    return Math.min(TU("camRateMaxV147", 8), Math.max(1, Number.isFinite(u) ? u : 1));
  }
  camStiffRateV147(r, fol) { return Math.pow(r, fol ? TU("camFollowStiffRateExpV147", 0.35) : TU("camStiffRateExpV147", 0)); }
  // the pan and zoom targets, low-passed in wall time; the constant is 0 at 1× and grows with the speed
  camPreV147(P, cx, cy, tz, delta, r, fol, hw, hh, air) {
    const V = window.__V147D = window.__V147D || { frames: 0, rate: 1, pre: 0, resets: 0, sub: 0 };
    V.frames++; V.rate = r;
    let Q = this._camPreV147;
    if (!Q || Q.P !== P || r <= 1) { Q = this._camPreV147 = { P, x: cx, y: cy, vx: 0, vy: 0, lz: Math.log(Math.max(0.05, tz)) }; if (r > 1) V.resets++; return { x: cx, y: cy, z: tz, vx: 0, vy: 0, ff: 0 }; }
    const s = (r - 1) / 3, d = Math.max(1, delta || 16), dt = d / 1000;
    /* the pan target rides a FADING-MEMORY g-h filter (Brown's double smoothing: θ = e^(−dt/τ), g = 1 − θ²,
     * h = (1 − θ)²) — it takes the shake out of the target and still tracks a steady run with no lag,
     * which a plain low-pass cannot: a lag here is a 4× runner at the edge of the frame. Its velocity is
     * handed to the spring as a feed-forward, so the spring damps against the TARGET's motion instead of
     * against standing still — no steady-state lag either, and no need to stiffen it into the shake. */
    /* a FOLLOW cam is locked to one man inside a box an eighth of the frame wide, so at 4× every step he
     * takes is a step the whole field takes. It gets a DEAD ZONE instead (`camFollowDeadV147` of the half
     * frame at 4×): the target holds while he jostles inside it and moves only when he pushes its edge —
     * a follow cam's shake measured WORSE than his own marker's through any smoothing that let it lag. */
    if (fol && hw && !air) { const dx = hw * TU("camFollowDeadV147", 0.25) * s, dy = (hh || hw) * TU("camFollowDeadV147", 0.25) * s;
      cx += Math.max(-dx, Math.min(dx, Q.x - cx)); cy += Math.max(-dy, Math.min(dy, Q.y - cy)); }
    const gh = fol ? TU("camFollowGhV147", 0) : TU("camGhV147", 1);   // 0: a plain first-order low-pass
    /* a ball in the AIR: Broadcast filters it like anything else (`camAirTauKV147` 1 — a shorter window
     * measured SHAKIER, the catch and the release swinging the lead through it) and leans on the
     * edge-open below to keep it in the picture; a FOLLOW cam, zoomed in three times as far, takes half
     * the window (`camFollowAirTauKV147`), half the lead stretch and none of the stiffening in the air —
     * each of those, tried at full, doubled the shake of a punt */
    const airK = !air ? 1 : fol ? TU("camFollowAirTauKV147", 0.5) : TU("camAirTauKV147", 1);
    const th = Math.exp(-d / Math.max(1, (fol ? TU("camFollowPanTauMsV147", 200) : TU("camPanTauMsV147", 500)) * s * airK)), g = gh ? 1 - th * th : 1 - th, h = gh ? (1 - th) * (1 - th) : 0;
    const px = Q.x + Q.vx * dt, py = Q.y + Q.vy * dt, ex = cx - px, ey = cy - py;
    Q.x = px + g * ex; Q.y = py + g * ey; Q.vx += h * ex / dt; Q.vy += h * ey / dt;
    const az = 1 - Math.exp(-d / Math.max(1, (fol ? TU("camFollowZoomTauMsV147", 700) : TU("camZoomTauMsV147", 600)) * s * airK));
    Q.lz += (Math.log(Math.max(0.05, tz)) - Q.lz) * az;
    V.pre++;
    return { x: Q.x, y: Q.y, z: Math.exp(Q.lz), vx: Q.vx, vy: Q.vy, ff: Math.min(1, s) * (fol ? TU("camFollowFeedFwdV147", 0) : TU("camFeedFwdV147", 1)) };
  }
  // the whistle: wide, on the ball, for as long as the post phase runs
  camPostV109(P, delta) {
    if (this.camOffV112() || !P.post || !P.post.camWide) return;
    try { const cam = this.cameras.main, W = P.post.camWide, sp = PJ(P.post.spot.x, P.post.spot.y);
      const hw = FW / (2 * cam.zoom), hh = FVH / (2 * cam.zoom);
      let cx = hw >= FW / 2 ? FW / 2 : mt.Math.Clamp(sp.x, hw, FW - hw), cy = mt.Math.Clamp(sp.y - TU("camWhistleRise", 30), hh, WORLD_H - hh);
      // v112: the WIDE for the gather belongs to the mode too, and the hit's own smaller step out
      // holds in front of it — the tackle reads as its own beat before the frame opens up
      let tz = W.z * this.camModeV112().z;
      /* v145: a follow cam does not open up for the gather — it holds the size it has been riding,
       * and FOLLOW ME stays on him wherever the whistle caught him */
      const MDf = this.camModeV112();
      if (MDf.follow) {
        const me = this.camMeV145(P), xb = this.camSideV145(cam); if (me) { cx = hw >= FW / 2 + xb ? FW / 2 : mt.Math.Clamp(me.root.x, hw - xb, FW + xb - hw); cy = mt.Math.Clamp(me.root.y - TU("camWhistleRise", 30), hh, WORLD_H - hh); }
        if (this._camFollowZV145) tz = Math.max(tz, this._camFollowZV145 * TU("camFollowPostK", 0.94));
        this.v112E().followPost = (this.v112E().followPost || 0) + 1;
      }
      P.post._camT = (P.post._camT || 0) + delta;
      const H = this._camHitV112, zs = H ? H.z0 * H.k : 0;
      if (H && P.post._camT < TU("camHitPostMs", 320) && zs > tz) { tz = zs; this.v112E().hitHold++; }
      tz = this.camZoomFitV112(tz);
      this.camSpringV109(cam, cx, cy, tz, delta, TU("camWhistleStiffK", 0.7) * this.camModeV112().stiff); this.v109E().cam.wideFrames++; } catch (e) {}
  }
  /* ===== v112 THE CAMERA FINDS THE BALL =====
   * v109 framed the CARRIER, and the carrier is the right man only while he is actually holding it.
   * `P.carrierId` survives the throw, so for the whole flight of a pass — and the whole hang of a
   * punt — the frame sat on the man who had just let the ball go while the ball, and the man it was
   * going to, ran off the edge of it: a punt drew four seconds of empty grass, and a catch was made
   * at the frame's corner and only then cut to. Possession is read FRESH every frame now. The man
   * with it while a man has it (the HOLDER, so a fumble recovery the sim never named a carrier for
   * is followed too), the BALL itself the moment it is in the air or on the grass, and on a flight
   * the frame eases toward where that flight is going to come down, so it ARRIVES with the ball
   * instead of chasing it. `camFocusV112` is the one answer and everything above it reads `kind`. */
  camFocusV112(P, glide) {
    // v145: FOLLOW ME frames his own marker the whole play, the glide in and the whistle included;
    // a snap his unit is not on the field for falls through to the ball like every other mode
    const me = this.camMeV145(P);
    if (me) return { m: me, id: P.featIdx, x: me.root.x, y: me.root.y, kind: "me" };
    const mode = P.ballMode || "ground";
    const loose = !!P.__looseBall || mode === "loose" || mode === "bounce";
    const air = mode === "flight" || mode === "kick" || mode === "tip";
    const hid = P.ballHolderId != null ? P.ballHolderId : P.carrierId;
    const man = (!glide && !air && !loose && hid != null) ? this.markers[hid] : null;
    if (man && man.root) return { m: man, id: hid, x: man.root.x, y: man.root.y, kind: "carry" };
    const fp = this.focusPt || { x: FW / 2, y: WORLD_H / 2 };
    const bx = this.ballSpr ? this.ballSpr.x : fp.x, by = this.ballSpr ? this.ballSpr.y : fp.y;
    if (!air) {
      /* On a kick the ball is with the deep man a tenth of a second after the snap, and he stands
       * fourteen yards behind the ball: framed on the spot, the camera spent the whole long snap
       * travelling. It starts on him instead — which is where a broadcast frames a punt anyway. */
      if (!P.snapped && /^(fg|punt|kickoff|xp)$/i.test(String(P.payload && P.payload.event || ""))) {
        const k = this.markers[8];
        if (k && k.root) return { m: null, id: null, x: k.root.x, y: k.root.y, kind: glide ? "glide" : "ground" };
      }
      return { m: null, id: null, x: bx, y: by, kind: loose ? "loose" : glide ? "glide" : "ground" };
    }
    let fx = bx, fy = by;
    const L = this.camLandV112(P);
    if (L) { const q = Math.min(1, Math.max(0, (P.t - (P.ballReleaseAt || P.t)) / L.ms)), b = TU("camAirBias", 0.55) * q;
      fx += (L.x - bx) * b; fy += (L.y - by) * b; }
    return { m: null, id: null, x: fx, y: fy, kind: mode === "kick" ? "kick" : "flight" };
  }
  // where this flight comes down, in screen space, read once off the script's own ball frames
  camLandV112(P) {
    const rel = P.ballReleaseAt || 0;
    if (P._camLandV112 && P._camLandV112.rel === rel) return P._camLandV112.pt;
    let pt = null;
    try { const bf = P.script.ball, i0 = Math.max(0, Math.floor((P.t - (P.delay || 0)) / 33));
      let up = false;
      for (let k = i0; k < bf.length; k++) {
        if (bf[k].h > 2) up = true;
        else if (up && bf[k].h <= 1.4) { const p = PJ(bf[k].x, bf[k].y); pt = { x: p.x, y: p.y, ms: Math.max(140, (k - i0) * 33) }; break; }
      }
      if (!pt && bf.length) { const b = bf[bf.length - 1], p = PJ(b.x, b.y); pt = { x: p.x, y: p.y, ms: Math.max(140, (bf.length - i0) * 33) }; }
    } catch (e) { pt = null; }
    P._camLandV112 = { rel, pt };
    return pt;
  }
  /* ===== v112 THE FRAME TIGHTENS ON HIM =====
   * A back who breaks into space is the one thing worth filling the screen with, so the pull-in is
   * read off the field itself — how far the nearest man who could tackle him actually is, times how
   * fast he is going. In traffic it is exactly 1, so nothing happens in the pocket or at the pile,
   * and it only ever moves the spring's TARGET: a lean-in, never a second lerp fighting the first. */
  camTightV112(P, m, zStr, MD) {
    const V = this.v112E();
    if (!m || !MD.tight) { V.tight.idle++; return 1; }
    const hid = P.ballHolderId != null ? P.ballHolderId : P.carrierId, off = hid < 11;
    const i0 = off ? 11 : 0, i1 = off ? this.markers.length : 11;
    let best = 1e9;
    for (let i = i0; i < i1; i++) { const d = this.markers[i];
      if (!d || d === m || d.active === false) continue;
      const dd = Math.hypot(d.sx - m.sx, d.sy - m.sy); if (dd < best) best = dd; }
    const near = TU("camSpaceNearPx", 22), far = TU("camSpaceFarPx", 72);
    const space = Math.min(1, Math.max(0, (best - near) / Math.max(1, far - near)));
    const sMin = TU("camSpaceSpdMin", 28), sFull = TU("camSpaceSpdFull", 110);
    const sp = Math.min(1, Math.max(0, ((m.sSm || 0) - sMin) / Math.max(1, sFull - sMin)));
    // the SPACE decides; the speed only modulates it. A man standing still in the open is not
    // worth filling the screen with, but a man with the field in front of him is, at any pace.
    const f = TU("camTightSpdFloor", 0.35), k = space * (f + (1 - f) * sp);
    const mul = 1 + TU("camTightMax", 0.34) * k * zStr * MD.tight;
    V.tight.n++; V.tight.sum += mul; if (mul > V.tight.max) V.tight.max = +mul.toFixed(3);
    const bin = space > 0.6 ? V.tight.open : space <= 0 ? V.tight.traffic : null;
    if (bin) { bin.push(+mul.toFixed(3)); if (bin.length > 600) bin.shift(); }
    V.tight.spaceSum += space; V.tight.spdSum += sp;
    return mul;
  }
  // the tackle is its own, smaller step out — armed on the hit, held through the whistle's beat
  camHitV112(P, e) {
    if (this.camOffV112() || !this.cameras || !this.cameras.main) return;
    const z = this.cameras.main.zoom;
    this._camHitV112 = { w0: performance.now(), ms: Math.max(120, TU("camHitOutMs", 760)), k: Math.min(1, Math.max(0.6, TU("camHitOutK", 0.9))), z0: z };
    const V = this.v112E(); V.hits.push({ z0: +z.toFixed(3), zMin: +z.toFixed(3), big: !!(e && e.bigHit) });
    if (V.hits.length > 80) V.hits.shift();
  }
  camHitZoomV112(cam) {
    const H = this._camHitV112; if (!H || H.done) return 1;
    const q = (performance.now() - H.w0) / H.ms;
    if (q >= 1) { H.done = true; return 1; }
    const V = this.v112E(), r = V.hits[V.hits.length - 1];
    if (r && cam && cam.zoom < r.zMin) r.zMin = +cam.zoom.toFixed(3);
    // out on the hit and HELD while the whistle catches up, then back to 1 if the play runs on
    return H.k + (1 - H.k) * Math.pow(Math.max(0, (q - TU("camHitHoldFrac", 0.45)) / (1 - TU("camHitHoldFrac", 0.45))), 2);
  }
  /* ===== v112 THE CAMERA HAS OPTIONS =====
   * Four behaviours, not a slider: BROADCAST is everything above, TIGHT stays close on the ball at
   * all times, WIDE keeps the field in frame and barely pulls in, FIXED never moves at all (the
   * frame the next snap is set on, held) for anyone who dislikes the motion — which is also where
   * the OS reduced-motion preference has always landed. `camZoom` scales how hard any of them
   * tightens. Both ride `window.__FIELD_FX`, which the camera re-reads every frame, so a change in
   * Settings is on the live field before the panel closes. */
  camModeV112() {
    const F = window.__FIELD_FX || {}, L = CAM_MODES_V112;
    return L[Math.max(0, Math.min(L.length - 1, Math.round(Number(F.cam) || 0)))];
  }
  camOffV112() { return REDUCED_MOTION || this.camModeV112().id === "fixed"; }
  /* v145: the camera's side bounds were the painted field's 0..FW, but the near rows PROJECT wider
   * than that and the turf and the team area are painted ~240 px past it before the page's ground
   * shows — so a man on the near sideline was a man no pan could reach. A follow cam may run
   * `camFollowSidePx` past either side (inside the painting); every other mode keeps 0..FW. */
  camSideV145(cam) {
    const xb = this.camModeV112().follow ? Math.max(0, TU("camFollowSidePx", 180)) : 0;
    try { const b = cam._bounds; if (!b || b.x !== -xb || b.width !== FW + 2 * xb) cam.setBounds(-xb, 0, FW + 2 * xb, WORLD_H); } catch (e) {}
    return xb;
  }
  // v145: the you-player's marker, when this mode follows him and he is on the field this snap
  camMeV145(P) {
    if (!P || this.camModeV112().follow !== "me") return null;
    const m = this.markers && this.markers[P.featIdx];
    return m && m.root && m.team === "you" && m.active !== false ? m : null;
  }
  camZoomStrV112() { const F = window.__FIELD_FX || {}; const v = F.camZoom == null ? 1 : Number(F.camZoom); return Math.max(0, Math.min(2, Number.isFinite(v) ? v : 1)); }
  /* Nothing v112 does may open the frame wider than the picture the FIELD VIEW dials already set:
   * the floor and the ceiling are read off the reset zoom itself, so the Field-zoom slider keeps its
   * whole range at both ends of the depth slider and the wide mode, the whistle and the step out all
   * stop at the edge of the painted field instead of past it. */
  camZoomFitV112(z) {
    const base = (((window.__FIELD_FX && window.__FIELD_FX.zoom) || 1.16)) * TU("perspZoomK", 0.78);
    // v145: a follow cam holds his size as he runs deep, which needs more room at the top than the
    // broadcast's ceiling allows — the floor, which is what keeps the frame on the painted field, is untouched
    const ceil = this.camModeV112().follow ? TU("camFollowCeilK", 4.6) : TU("camZoomCeilK", 3);
    return Math.min(base * ceil, Math.max(base * TU("camZoomFloorK", 0.862), z));
  }
  v112E() {
    return window.__V112_E = window.__V112_E || { mode: "", zoomStr: 1, frames: 0, focus: {}, dist: {},
      tight: { n: 0, sum: 0, max: 1, open: [], traffic: [], idle: 0, spaceSum: 0, spdSum: 0 }, hits: [], hitHold: 0, fixedFrames: 0, edgeOpens: 0 };
  }
  /* ===== v101 THE SIM LOADS BEHIND THE DOOR =====
   * `buildPlayScript` is the whole play — every actor's frames for every tick — and it was
   * only ever built at the instant the play was asked to run. On the first snap of a game
   * that instant is the moment the loading chase finishes, so the player watched a loader,
   * then watched the game think. It is the same work either way, so do it while the chase
   * is still running: the career app calls `prewarm` the moment the door goes up, the script
   * is cached against its own payload, and `animatePlay` finds it already made. */
  prebuildV101(et) {
    if (!et) return null;
    const c = this._preV101;
    if (c && c.payload === et) return c.script;
    let script = null;
    try { script = buildPlayScript(et, { dims: { PLAY_L, PLAY_R, F_TOP, F_BOT }, rand: Math.random }); } catch (e) { script = null; }
    this._preV101 = script ? { payload: et, script } : null;
    try { const W = window.__PREWARM_V101 = window.__PREWARM_V101 || { built: 0, hits: 0, misses: 0 }; if (script) W.built++; } catch (e) {}
    return script;
  }
  animatePlay(et, rt) {
    this.softStop();
    this.completion = rt;
    try {
      const _pre = this._preV101 && this._preV101.payload === et ? this._preV101.script : null;   // v101: built behind the loader
      this._preV101 = null;
      try { const W = window.__PREWARM_V101 = window.__PREWARM_V101 || { built: 0, hits: 0, misses: 0 }; _pre ? W.hits++ : W.misses++; } catch (e) {}
      const script = _pre || buildPlayScript(et, { dims: { PLAY_L, PLAY_R, F_TOP, F_BOT }, rand: Math.random });
      const it = et.offense !== "them";
      VDIR = it ? 1 : -1;
      ribSyncOpp(this);
      const losAbs = it ? (et.startBall ?? 50) : 100 - (et.startBall ?? 50),
        tgtAbs = mt.Math.Clamp(losAbs + (it ? 1 : -1) * (et.preToGo ?? 10), 0, 100);
      this.drawField(losAbs, tgtAbs);
      this.drawWearV86(et);   // v86: the turf remembers the game so far
      this.drawGoalpostsV87();   // v87: uprights at both ends
      this.stadiumLiveV92();     // v92: the big screen goes back to the feed
      this.resetCamera();   // v23: re-center on THIS play's line of scrimmage (focusPt was just refreshed by drawField)
      this.clearAlerts();   // v23: reset any scramble-warning ❗ from the previous play
      // build or GLIDE markers to the new formation (no teleporting between plays)
      let glide = this.markers.length === script.actors.length;
      if (glide) {
        let maxD = 0;
        script.actors.forEach((a, i) => {
          const m = this.markers[i], f0 = a.frames[0];
          this.setTeam(m, a.side === "off" ? "off" : "def", this.kitForV105_2(a.side, et));   // v105.2: side AND kit
          m.body.clearTint(); m.body.setScale(1); m.body.setAlpha(1); m.body.setRotation(0); m.label.setAlpha(1); m.label.setVisible(true);
          m.isLine = (a.label === "OL" || a.label === "DE" || a.label === "DT" || a.label === "DL");
          m.homeDir = i < 11 ? "up" : "dn";
          m.forceState = null;
          m._dropback = false; m._dropped = false; m._hitched = false; m._lean = 0; m._lookAt = null; m._post = null; m._presnapFace = false;   // v86
          m._dropT107 = 0; m._thrRecV107 = null;   // v107
          m._thrDirV108 = null; m._exV108 = null;   // v108
          m._flyV112 = null; m._flySpinV112 = 0; m._launchUntil = 0; m._launchH = 0;   // v112: no man is ever drawn in the air when the next play starts
          m._hud = null; m._hudFaced = false;   // v87
          m.body.setPosition(0, 0);
          m._jog = { x: f0.x, y: f0.y }; m._jogDone = false;
          m.label.setText(String(i < 11 ? OFF_NUMS[i] : DEF_NUMS[i - 11]));
          maxD = Math.max(maxD, Math.hypot(f0.x - m.sx, f0.y - m.sy));
        });
        this._jogDelay = Math.min(1650, Math.max(380, (maxD / TU("jogSpeed",340)) * 1000 + 200));
        this._hud = this.planHuddleV87(et, script, losAbs);   // v87: both sides huddle on the way to the line
      } else {
        this.clearActors();
        this.markers = script.actors.map((a, i) => {
          const f0 = a.frames[0];
          const m = this.marker(f0.x, f0.y, a.side === "off" ? "off" : "def", i < 11 ? OFF_NUMS[i] : DEF_NUMS[i - 11], 0, a.side === "off" ? -1 : 1, this.kitForV105_2(a.side, et));   // v105.2
          m.isLine = (a.label === "OL" || a.label === "DE" || a.label === "DT" || a.label === "DL");
          m.homeDir = i < 11 ? "up" : "dn";
          if (m.isLine) { m.forceState = "stance"; this.placeMarker(m, m.sx, m.sy, 16); }
          return m;
        });
      }
      // v15.20: position data is wired into the active Phaser markers before rendering.
      const AGE_K_THIS_PLAY_V144 = liveAgeKV144();
      script.actors.forEach((actor, idx) => {
        const marker = this.markers[idx];
        if (!marker) return;
        marker.posLabel = actor.label;
        marker.actorId = actor.id;
        marker._ageKV144 = AGE_K_THIS_PLAY_V144;   // v144: one state read a snap, not 22 a frame
        marker._idleHomeV144 = null; marker._idleToV144 = null; marker._idleNextV144 = null;   // v144 C: the shuffle's leash belongs to ONE gap
        if (window.__RIB20_applyAppearance) window.__RIB20_applyAppearance(this, marker, actor.label, idx);
      });
      const feat = script.meta.featured || pickFeaturedIndex(et, this.offLabels, this.defLabels);
      this.highlight(this.markers[feat.index], feat.isMe);
      // ball sprite
      const bp0 = PJ(script.ball[0].x, script.ball[0].y);
      this.ballShad = this.add.ellipse(bp0.x, bp0.y + 3, 10, 4, 0x000000, 0.32).setDepth(3.5);
      this.ballSpr = ribBallV91(this, bp0.x, bp0.y) || (window.__RIB20_createFootball ? window.__RIB20_createFootball(this, bp0.x, bp0.y) : this.add.image(bp0.x, bp0.y, "spr_ball").setScale(0.8).setDepth(19));
      // target route preview line
      if (script.meta.targetRoute) this.routeLine(script.meta.targetRoute, feat.isMe && ["WR","TE","RB"].includes(et.playerPos));
      this.trail.clear();
      const big = Math.abs(Number(et.yards ?? 0)) >= 15 || et.scored || /INTERCEPT|FUMBLE/i.test(String(et.desc||""));
      this.play = { script, t: 0, evIdx: 0, done: false, payload: et, featIdx: feat.index, lastTrail: 0,
        carrierId: null, ballHolderId: null, ballMode: "ground", ballStyle: "touch",
        delay: glide ? (this._jogDelay || 420) : 0, big, hud: glide ? (this._hud || null) : null };
      this._hud = null;
      // v15.14: never inherit football interpolation/spiral state from a prior play.
      this.play._pbx = null; this.play._pby = null; this.play.lastBallDot = 0;
      this.play.__ballTokenV1514 = (Date.now() + Math.random()).toString(36);
      this.play.losX = PLAY_L + (losAbs / 100) * PLAY_W;
      this.badgesPresnapV95(et, losAbs);   // v95: the wall reads the down and the spot as the huddle breaks
      // v45: the officiating crew takes the field with the offense, homed off the LOS
      this.spawnRefs(this.play.losX, script.meta.dir || VDIR || 1);
      // FG uprights
      if (et.event === "fg") this.drawUprights(script.meta.dir);
      // pre-play broadcast ribbon: down & distance from the scoreboard
      // (pre-play ribbon removed by request — only the post-play result ribbon shows)
      /* ===== v144 B THE WATCHDOG WAS EATING THE PLAY =====
       * This is a wall-clock budget for a play that runs on a SLOWED clock, and it only ever
       * budgeted for `script.duration`. But a play is three things on that same clock — the glide
       * in (the huddle, up to 2700 script-ms), the script itself, and the post-play phase
       * (`postPlayMs`, 1450) — and on top of those the slow-motion windows and the hit-stops each
       * spend real milliseconds while the script stands still.
       * At 1x the old `duration/0.35 + 4200` happened to cover all of it. At ½× it did not: the
       * budget is the same number while everything it has to cover takes twice as long, so the
       * timer fired MID-PLAY and called `complete()`. The play vanished into its own result text —
       * the quarterback frozen in the mesh, the yardage printed underneath — which is exactly what
       * a running back at half speed sees, because a run script is the shortest (smallest budget),
       * carries the most slow-motion windows, and reaches its handoff earliest of any play.
       * The budget now covers the whole timeline and is always computed at the SLOWEST rate the
       * user can select, so switching speed mid-play cannot truncate it either.
       * `TU("watchdogSlackMs")` is the headroom for slow-mo and hit-stop. */
      const wdRate144 = Math.max(.05, TU("watchdogSlowestSpeed", .5) * TU("basePlayRate", 0.7));
      const wdSpan144 = script.duration + ((this.play && this.play.delay) || 0) + TU("postPlayMs", 1450);
      const wdMs144 = wdSpan144 / wdRate144 + TU("watchdogSlackMs", 6000);
      try { (window.__V144 = window.__V144 || {}).watchdog = { ms: Math.round(wdMs144), span: Math.round(wdSpan144), rate: +wdRate144.toFixed(3), dur: Math.round(script.duration), delay: Math.round((this.play && this.play.delay) || 0) }; } catch (e) {}
      this.time.delayedCall(wdMs144, () => { try { (window.__V144 = window.__V144 || {}).watchdogFired = (window.__V144.watchdogFired || 0) + 1; } catch (e) {} this.complete(); });
    } catch (err) { console.warn("[LiveField] animate error:", err); this.complete(); }
  }

  update(time, delta) {
    const P = this.play;
    // v57: the crowd lives between plays too, so it ticks BEFORE the no-play return
    this.updateCrowd(delta);
    this.updateStadiumV92(delta);   // v92: the lamps and the big screen live between plays too
    this._wxTickV144 = (this._wxTickV144 || 0) + 1;   // v144 H: one weather read a frame
    this.wxTickV144(delta);                            // v144 H: and it falls between plays as well
    this._klV99 = null; this._lgV101 = null;   // v99/v101: one read of the masts per tick, shared by every shadow
    /* v144 C: the field is not dead between plays. `complete()` clears `this.play`, and the row
     * loop then sits on a timer before the next one is handed down — half a second at 1x, a full
     * second at ½× — during which this early return used to leave twenty-two men frozen on the
     * exact frame the whistle caught them. Then the next play's glide started and they all
     * sprinted off together. They breathe and shuffle through the gap now, so the restart is a
     * continuation rather than a cut. */
    if (!P) { this.idleBetweenV144(delta); return; }
    if (P.done) { if (P.post) this.updatePostV86(P, delta); return; }   // v86: the whistle is not the end of the picture
    if (this.hitStop > 0) { this.hitStop -= delta; return; }   // freeze-frame on big moments
    // v24: base movement runs 30% slower for everyone — a more deliberate, readable
    // pace where cuts, jukes and pursuit angles land as real moves instead of a blur.
    // The user's 1x/2x speed control still multiplies on top of this base.
    // v37 cinematic contact: one real-world second at half playback speed. It is
    // intentionally layered on top of the user's speed setting and never changes
    // sim events/outcomes — only how clearly the decisive movement reads.
    const cineScale=(P.slowMoUntilReal||0)>performance.now()?(P.slowMoScale||TU("cinematicScale",0.5)):1;
    // v102: the moment is SEEN COMING. The script is built before it plays, so the renderer knows
    // when the catch, the juke, the truck is going to land and eases the clock down INTO it
    // rather than reacting a frame after it has happened.
    const antic = this.slomoV102(P, delta);
    const spd = Math.max(0.5, window.__getGridironLiveSpeed?.() ?? 1) * TU("basePlayRate", 0.7) * Math.min(cineScale, antic);
    P.t += delta * spd;
    const S = P.script, T = Math.min(Math.max(0, P.t - (P.delay || 0)), S.duration);
    // Madden-style follow camera: track the ball with look-ahead, wider on big plays
    try {
      const cam = this.cameras.main;
      if (this.camOffV112()) { const VF = this.v112E(); VF.fixedFrames++; VF.mode = this.camModeV112().id; this.camSideV145(cam); }
      else {
        if (this.zoomPunch > 0) this.zoomPunch = Math.max(0, this.zoomPunch - delta * 0.0016);
        const gliding0 = P.t < (P.delay || 0);
        // v27: perspZoomK compensates for the overscanned warp art (near field draws
        // ~1.45x bigger); the camera leads PREDICTIVELY along the smoothed velocity of
        // its focus instead of a fixed northward offset — it arrives where he's going.
        // v28 CARRIER LOCK: once someone has the ball the camera FOLLOWS HIM and the
        // zoom rides 1/perspK(carrier), so his on-screen size stays CONSTANT while the
        // field around him rescales dynamically as he moves through the perspective.
        const _zf = (((window.__FIELD_FX && window.__FIELD_FX.zoom) || 1.16) / 1.16) * TU("perspZoomK", 0.78);
        // v112: the focus is POSSESSION, read fresh — the man only while a man has it, else the ball
        const FOC = this.camFocusV112(P, gliding0), MD = this.camModeV112(), zStr = this.camZoomStrV112(), r147 = this.camRateV147(), air147 = /^(flight|kick|loose)$/.test(FOC.kind);   // v147 D: the speed, read once a frame
        const carM = FOC.kind === "carry" || FOC.kind === "me" ? FOC.m : null;
        const kc = carM && carM.root ? Math.max(0.2, perspK(carM.sx)) : null;
        // v98 THE HANDOVER CUT: the moment the ball changes hands mid-play (the handoff, the
        // catch, the pick, the punt fielded) the camera commits to the new man — a short
        // re-frame that pans and zooms faster than the cruising follow and leads him down
        // the field, so it arrives on the runner instead of trailing the throw or the
        // exchange. Eases back to the ordinary lock over camCutMs.
        // v112: off the FOCUS man, so the cut also lands on a fumble the sim never named a carrier for
        if (!gliding0 && FOC.id != null && FOC.id !== P._camCarV98) {
          if (P._camCarV98 != null || P.t > (P.delay || 0) + 250) P._camCut = { t: 0, ms: Math.max(120, TU("camCutMs", 520)), from: P._camCarV98 };
          P._camCarV98 = FOC.id; }
        let cut = 0;
        if (P._camCut) { P._camCut.t += delta; const q = P._camCut.t / P._camCut.ms; if (q >= 1) P._camCut = null; else cut = 1 - q * q; }
        // v71: while a flag focus is alive the camera follows the OFFICIAL, not the
        // ball. A penalty is the one moment in a play where the ball is not the story.
        const FC = this.flagCamTarget(delta);
        const fx = FC ? FC.x : FOC.x, fy = FC ? FC.y : FOC.y;
        { const V = this.v112E(); V.frames++; V.mode = MD.id; V.zoomStr = zStr;
          const kd = (this._camFlagV112 = !!FC) ? "flag" : FOC.kind; V.focus[kd] = (V.focus[kd] || 0) + 1;
          const d = Math.hypot(cam.midPoint.x - fx, cam.midPoint.y - fy);
          const R = V.dist[kd] = V.dist[kd] || { n: 0, sum: 0, max: 0 }; R.n++; R.sum += d; if (d > R.max) R.max = Math.round(d); }
        // locked plays ignore the zoomBig wide-angle: the carrier reads the SAME size on
        // every play, and the compensating zoom already widens/narrows the view for him
        const baseZ = (gliding0 ? 1.0 : (P.big ? TU("zoomBig",1.04) : TU("zoomPlay",1.34))) * _zf;
        /* ===== v109 THE BROADCAST CAMERA =====
         * v28 locked the zoom to 1/perspK(carrier) so the runner never changed size — the opposite
         * of a broadcast, where a man coming down the near sideline fills the frame. `camPerspLockK`
         * softens the lock (1 is v28's constant size, 0 no compensation at all). The pan and the
         * zoom then ride one critically damped spring (camSpringV109) instead of a lerp behind a
         * dead-band, and the carrier is framed in the LEADING THIRD along his heading (camLeadFrac)
         * rather than dead centre. The v98 handover cut and the v71 flag focus still steer the
         * target; they stiffen the spring instead of swapping lerp constants. */
        const lockK = MD.lock != null ? MD.lock : TU("camPerspLockK", 0.5);
        /* v112: the mode scales every target, the open-field pull-in rides on top of it, and the
         * tackle's own step out multiplies the lot — one target, still one spring under it. */
        const hitZ = this.camHitZoomV112(cam);
        /* v145: a follow cam never falls back to the loose wide frame when nobody holds the ball —
         * a throw, a bounce, the glide — it holds the locked size it last had, so the players do
         * not shrink and swell every time the ball leaves a hand. `camFollowZoomK` is how close
         * the follow sits, scaled by the Settings strength like every other pull-in. */
        const flw = MD.follow && !FC, lockZ = kc ? mt.Math.Clamp(TU("zoomPlay",1.34) * _zf / Math.pow(kc, lockK), TU("zoomLockMin", 0.6), flw ? TU("camFollowLockMax", 3.6) : TU("zoomLockMax", 2.4)) : null;
        let fZ = flw ? (lockZ || this._camFollowZV145 || baseZ) : null;
        // v147 D: at speed a follow cam with nobody to hold — a punt, a pass in the air — does not keep the
        // size it last had; it stands back to the ordinary play frame, or a 4× punt leaves the picture
        if (flw && !lockZ && air147 && r147 > 1) fZ = Math.min(fZ, baseZ * TU("camFollowAirOpenV147", 1));
        if (flw && lockZ) this._camFollowZV145 = lockZ;
        const targetZoom = this.camZoomFitV112(FC ? FC.zoom
          : flw ? (fZ * MD.z * (TU("camFollowZoomK", 1) + (zStr - 1) * 0.35) * Math.pow(r147, -TU("camFollowZoomRateExpV147", 0.25)) + this.zoomPunch) * hitZ
          : ((lockZ || baseZ)
            * MD.z * this.camTightV112(P, carM, zStr, MD) + this.zoomPunch) * hitZ);
        try { window.__CAMCUT_V98 = Object.assign(window.__CAMCUT_V98 || { cuts: 0 }, { active: !!cut, k: +cut.toFixed(3), carrier: P.carrierId }); if (P._camCut && P._camCut.t <= delta) window.__CAMCUT_V98.cuts++; } catch (e) {}
        /* v147 D: the focus's velocity is measured on the PLAY clock (px per play-second, the number a
         * 1× run of the same play gives) and smoothed over a WALL window that lengthens with the speed
         * (`camVelRateExpV147`; alpha is exactly 0.15 a frame at 1×), so the lead neither balloons nor
         * flips end to end on every cut a 4× runner makes in a quarter of the time. */
        if (this._pcam) { const dtc = Math.max(16, delta) * r147;
          const nvx = (fx - this._pcam.x) / dtc * 1000, nvy = (fy - this._pcam.y) / dtc * 1000;
          const va = 1 - Math.pow(1 - TU("camVelAlpha", 0.15), Math.pow(r147, -(air147 ? 0 : TU("camVelRateExpV147", 1))));   // a ball in the air is not shaking: its velocity is read at the 1× rate
          this._cvx = (this._cvx || 0) + (nvx - (this._cvx || 0)) * va;
          this._cvy = (this._cvy || 0) + (nvy - (this._cvy || 0)) * va; }
        this._pcam = { x: fx, y: fy };
        // the predictive lead exists to keep a RUNNER in frame; on a flag it would
        // only drag the official back off the edge of it
        // v147 D: the lead window is play time too, stretched a little with the speed because the
        // spring lags a 4× runner by more world than a 1× one (`camLeadRateExpV147`; a flight in
        // Broadcast keeps the old full stretch, `camAirLeadRateExpV147`, or a punt runs off the frame)
        const leadMs147 = TU("camLeadMs", 420) * Math.pow(r147, air147 ? (MD.follow ? TU("camFollowAirLeadRateExpV147", 0.5) : TU("camAirLeadRateExpV147", 1)) : TU("camLeadRateExpV147", 0.5));
        let lx = FC ? 0 : (this._cvx || 0) * leadMs147 / 1000, ly = FC ? 0 : (this._cvy || 0) * leadMs147 / 1000;
        if (cut && !FC && carM) {   // v98: lead the new carrier the way the play is going, not the way the ball just came
          const dir = (S.meta && S.meta.dir) || VDIR || 1, kk = kc || 1;
          lx += lx * 0.35 * cut; ly -= dir * TU("camCutLead", 70) * kk * cut; }
        // v109 THE LEADING THIRD: a runner sits a fraction of the frame behind its centre, along the
        // way he is going, so the field he is running INTO is what the viewer sees
        const vsp = Math.hypot(this._cvx || 0, this._cvy || 0), leadMin = TU("camLeadMinSpd", 40);
        if (!FC && carM && vsp > leadMin) {
          const lf = TU("camLeadFrac", 0.18) * Math.min(1, (vsp - leadMin) / 120);
          lx += (this._cvx / vsp) * lf * (FW / cam.zoom); ly += (this._cvy / vsp) * lf * (FVH / cam.zoom);
          this.v109E().cam.leadFrames++; }
        if (!FC && MD.lead !== 1) { lx *= MD.lead; ly *= MD.lead; }   // v112: a wide frame runs further ahead, a tight one less
        // v147 D: a follow cam's lead is its leading third swinging end to end on every juke; at speed it is
        // most of what shakes the frame, and the dead zone holds him in the picture without it
        if (!FC && MD.follow && !air147 && r147 > 1) { const lk = Math.pow(r147, -TU("camFollowLeadRateExpV147", 0.5)); lx *= lk; ly *= lk; }
        const lm = Math.hypot(lx, ly), mL = TU("camLeadMax", 130) * (cut ? 1.3 : 1) + (carM && !FC ? TU("camLeadFracMax", 120) : 0);
        if (lm > mL) { lx *= mL / lm; ly *= mL / lm; }
        /* ===== v112 THE BALL STAYS IN THE PICTURE =====
         * The v109 lead is the right instinct and it keeps its direction — but unbounded it could
         * run the full `camLeadMax` plus the leading third, and a carrier 290 px off a 288 px half
         * frame is a carrier at the edge of it. The target is pulled back onto the focus so the man
         * with the ball never leaves the middle of the frame, whatever the lead asked for. */
        const hw = FW / (2 * cam.zoom), hh = FVH / (2 * cam.zoom), xb = this.camSideV145(cam);
        // v147 D: a follow cam's dead-centre box MAY widen with the speed (`camKeepRateExpV147`, 0 — off:
        // camPreV147's dead zone holds him still for less of the frame)
        const keep147 = MD.keep != null ? Math.min(TU("camKeepMaxV147", 0.3), MD.keep * Math.pow(r147, TU("camKeepRateExpV147", 0))) : null;
        const kx = hw * (keep147 != null ? keep147 : TU("camKeepFracX", 0.4)), ky = hh * (keep147 != null ? keep147 : TU("camKeepFracY", 0.4));   // v145: a follow cam keeps him near dead centre
        const cx = hw >= FW / 2 + xb ? FW / 2 : mt.Math.Clamp(mt.Math.Clamp(fx + lx, fx - kx, fx + kx), hw - xb, FW + xb - hw);
        const cy = mt.Math.Clamp(mt.Math.Clamp(fy + ly - (MD.follow ? 40 / Math.max(1, cam.zoom) : 40), fy - ky, fy + ky), hh, WORLD_H - hh);   // v145: the lift is a share of the frame, not 40 world px at 3x
        /* v112: the near sideline PROJECTS past the painted field, and the camera's bounds are the
         * painted field — so a man out on the numbers is a man the pan can never reach. It opens
         * UP for him instead of scrolling off the art: the zoom is capped at whatever brings the
         * focus back inside `camEdgeFrac` of the frame from where the pan was actually allowed to
         * stop. In ordinary play the keep-clamp already holds the focus well inside that, so the
         * cap is above the target and does nothing at all. */
        const dxE = Math.abs(fx - cx), dyE = Math.abs(fy - cy), edge = TU("camEdgeFrac", 0.8);
        let zTgt = targetZoom;
        if (dxE > 1) zTgt = Math.min(zTgt, FW * edge / (2 * dxE));
        if (dyE > 1) zTgt = Math.min(zTgt, FVH * edge / (2 * dyE));
        if (zTgt < targetZoom) this.v112E().edgeOpens++;
        // v147 D: the targets through the speed's low-pass; a follow cam's spring stiffens with speed^0.35
        const fol147 = !!(MD.follow && !FC), pre147 = this.camPreV147(P, cx, cy, zTgt, delta, r147, fol147, hw, hh, !FC && air147);
        /* at speed the man or the ball can outrun the pan, and the smoothed pan lags the target it is
         * allowed; so the edge-open also reads where the camera IS — applied after the low-pass, so it is
         * not itself held back by it. It only bites past `camEdgeFrac` of the half frame, which the 1×
         * framing never asks for: without it a 4× punt was off the frame on up to half its frames, and
         * Tight's carrier on one in ten (`camLiveEdgeV147` 0 turns it off) */
        if (!FC && r147 > 1 && TU("camLiveEdgeV147", 1)) {
          const bs = air147 && this.ballSpr ? this.ballSpr : { x: fx, y: fy }, ax = Math.max(Math.abs(fx - cam.midPoint.x), Math.abs(bs.x - cam.midPoint.x)), ay = Math.max(Math.abs(fy - cam.midPoint.y), Math.abs(bs.y - cam.midPoint.y));
          if (ax > 1) pre147.z = Math.min(pre147.z, FW * edge / (2 * ax));
          if (ay > 1) pre147.z = Math.min(pre147.z, FVH * edge / (2 * ay)); }
        this.camSpringV109(cam, pre147.x, pre147.y, this.camZoomFitV112(pre147.z), delta, (FC ? TU("flagCamStiffK", 2.2) : (1 + cut * TU("camCutStiffK", 1.6)) * MD.stiff) * this.camStiffRateV147(r147, fol147 && !air147), pre147);
        if (P._camCut && P._camCut.t <= delta) this.v109E().cam.cuts++;
      }
    } catch (e) {}
    // interpolate actors (skip during the glide-in so formations flow between plays)
    const fi = T / 33, i0 = Math.min(Math.floor(fi), 1e9), frac = fi - Math.floor(fi);
    const gliding = P.t < (P.delay || 0);
    if (gliding) {
      // v10: everyone JOGS to their next assignment at 2x — no more teleport-slide between plays
      // v87: by way of the huddle — jog in, stand in the ring facing the middle, break, then to the line
      const H = P.hud;
      if (H && !H.broke && P.t >= H.b) { H.broke = true; this.huddleBreakV87(); }
      const js9 = TU("jogSpeed", 340), ws9 = TU("walkSpeed", 100), now9 = performance.now(), V9 = this.v109E();
      this.markers.forEach((m) => {
        if (!m._jog) return;
        let gx = m._jog.x, gy = m._jog.y;
        /* ===== v109 THE HUDDLE BREAKS LIKE A HUDDLE ===== every man holds the ring until HIS
         * break (`_hudBreakAt`, staggered by position in huddleBreakV87), walks the first
         * `huddleWalkMs` out of it and only then trots — where the budget allows it: a man who
         * could not still make the line at a jog afterwards goes straight to the jog. */
        if (H && m._hud && (P.t < H.b || (m._hudBreakAt != null && P.t < m._hudBreakAt))) {
          if (P.t >= H.a) {   // the hold: stand in the ring and face the middle
            if (!m._hudFaced) { m._hudFaced = true; const a0 = PJ(m.sx, m.sy), a1 = PJ(H.cx[m._hud.side], H.cy); this.faceMarker(m, a1.x - a0.x, a1.y - a0.y); if (m.isLine) m.forceState = "idle"; }
            this.placeMarker(m, m.sx, m.sy, delta); return; }
          gx = m._hud.x; gy = m._hud.y;
          const hdx = gx - m.sx, hdy = gy - m.sy, hd = Math.hypot(hdx, hdy);
          if (hd < 2) { this.placeMarker(m, m.sx, m.sy, delta); return; }
          const hs = Math.min(hd, js9 * (delta * spd) / 1000);
          this.placeMarker(m, m.sx + hdx / hd * hs, m.sy + hdy / hd * hs, delta * spd * 2); return;
        }
        if (m._hudBreakAt != null) { m._hudBreakAt = null; if (m.forceState === "idle") m.forceState = null; m._hudFaced = false; }   // v109: his own break
        if (m._celRateV109 && m.forceState === "celebrateSeq") m.seqT -= delta * (m._celRateV109 - 1); else m._celRateV109 = 0;   // v109: each celebrant on his own cadence
        const jdx = m._jog.x - m.sx, jdy = m._jog.y - m.sy, jd = Math.hypot(jdx, jdy);
        if (jd < 2) {
          if (!m._jogDone) { m._jogDone = true; m._walk = false;
            if (m.homeDir) { m.dirKey = m.homeDir; m.flip = false; }
            if (m.isLine) m.forceState = "stance"; }
          this.placeMarker(m, m.sx, m.sy, delta);
          return;
        }
        // v109: the walk out of the break / the walk-off after a score — only while he can still make the line at a jog
        const canWalk = jd < Math.max(0, (P.delay || 0) - P.t) * js9 / 1000 * 0.85;
        const walking = canWalk && ((m._hudWalkUntil != null && P.t < m._hudWalkUntil) || (m._walkOffV109 && now9 < m._walkOffV109));
        m._walk = !!walking; if (walking && H) V9.huddle.walkFrames++;
        const stp = Math.min(jd, (walking ? ws9 : js9) * (delta * spd) / 1000);
        this.placeMarker(m, m.sx + jdx / jd * stp, m.sy + jdy / jd * stp, delta * spd * 2);
      });
      this.resolveOverlaps();
    } else {
      this.meshV118(P);   // v118: the exchange is planned off the script before anyone moves
      S.actors.forEach((a, k) => {
        const m = this.markers[k]; if (!m) return;
        const f = a.frames, n = f.length,
          A = f[Math.min(i0, n - 1)], B = f[Math.min(i0 + 1, n - 1)];
        let x = A.x + (B.x - A.x) * frac, y = A.y + (B.y - A.y) * frac;
        if (k === 8) { const o = this.meshOffsetV118(P, Math.max(0, P.t - (P.delay || 0)));   // v118: the quarterback goes to the back
          m._meshFaceV118 = !!o; if (o) { x += o.x; y += o.y; } }
        this.placeMarker(m, x, y, delta * spd);
      });
      this.resolveOverlaps();
      this.qbTickV86(P);   // v86: dropback, hitch, tuck
      this.windupV107(P);   // v107: the arm starts four frames before the ball leaves
      this.plantV109(P);   // v109: and the feet plant before the cut
      this.exchangeV108(P);   // v108: and the reach two frames before the ball changes hands
      // v10: live yardage ticker rides the carrier, counting up as he earns it
      if (P.carrierId != null && this.markers[P.carrierId] && !P.ydDone && P.losX != null) {
        const cmY = this.markers[P.carrierId];
        const yd = Math.floor(((cmY.sx - P.losX) * (S.meta.dir || 1)) / (PLAY_W / 100));
        if (yd >= 1) {
          if (!P.ydTxt) { P.ydTxt = this.trackFx(this.add.text(0, 0, "", { fontFamily: "Oswald, sans-serif", fontSize: "15px", fontStyle: "bold", color: "#ffe9ad", stroke: "#0a0f16", strokeThickness: 4 }).setOrigin(0.5).setDepth(24)); P.ydShown = 0; }
          P.ydTxt.setPosition(cmY.root.x, cmY.root.y - 30 * cmY.root.scale);
          if (yd !== P.ydShown) { P.ydShown = yd; P.ydTxt.setText("+" + yd);
            this.tweens.add({ targets: P.ydTxt, scale: 1.35, yoyo: true, duration: 80 }); }
        }
      }
    }
    // v45: the officiating crew moves every frame — trailing the ball, running when
    // the players run (a touch slower), and dodging out of the bodies around the play
    this.updateRefs(delta * spd, gliding);
    this.updateSideline(delta * spd);   // v78: the team area shifts its weight
    // v16.3 pre-snap play preview — your team's design, until the snap
    if (!P.snapped) { this.drawPreview(P); if (!gliding) this.presnapV86(P, T, delta * spd); }   // v86: the line is alive before the snap
    // v10: speed trails — fast movers leave streaks
    if (this.speedFx) {
      this.speedFx.clear();
      this.markers.forEach((m, mi) => {
        if (!m._hist || m._hist.length < 3 || (m._spdPx || 0) < TU("trailMin",170)) return;
        const h = m._hist, col = mi === P.carrierId ? 0xf0bb45 : 0xdfe8ef;
        /* v144: the +7 is a drop from the marker's origin to his FEET, and the age scale shrank
         * the body underneath it — so on a Pee Wee field the streak ran behind his head. Back the
         * scale out of the offset and it lands on the grass at every age. */
        const trK144 = 7 * ((m && m.root && m.root.scale) || 1) / Math.max(.2, PJ(m ? m.sx : 0, m ? m.sy : 0).s || 1);
        this.speedFx.lineStyle(3, col, 0.14).lineBetween(h[0].x, h[0].y + trK144, h[2].x, h[2].y + trK144);
        this.speedFx.lineStyle(2, col, 0.26).lineBetween(h[1].x, h[1].y + trK144, m.root.x, m.root.y + trK144);
      });
    }
    // v16.3 sprint stamina bars — a small draining bar over a player only while
    // their short-sprint burst is active
    if (!this.sprintBars) this.sprintBars = this.add.graphics().setDepth(26);
    this.sprintBars.clear();
    this.markers.forEach(m => {
      if (!m || !m._sprintEnd || P.t >= m._sprintEnd || !m.root) return;
      const frac = Math.max(0, Math.min(1, (m._sprintEnd - P.t) / Math.max(1, m._sprintDur || 500)));
      const sc = m.root.scale || 1, w = 16 * sc, h = 3 * sc;
      const bx = m.root.x - w / 2, by = m.root.y - 30 * sc;
      this.sprintBars.fillStyle(0x000000, 0.5).fillRect(bx - 1, by - 1, w + 2, h + 2);
      const col = frac > 0.5 ? 0x5fce74 : frac > 0.25 ? 0xf0bb45 : 0xe0645a;
      this.sprintBars.fillStyle(col, 0.95).fillRect(bx, by, w * frac, h);
    });
    // v81: a "?" floats over every defender still looking for the ball; it drops the
    // tick he finds it (keyRead), so you can watch the diagnosis ripple through the D
    this.markers.forEach(m => {
      const looking = m && m.root && m._lookUntil && P.t < m._lookUntil && P.snapped;
      if (looking) {
        if (!m._qTxt) m._qTxt = this.trackFx(this.add.text(0, 0, "?", { fontFamily: "Oswald, sans-serif", fontSize: "13px", fontStyle: "bold",
          color: m._lookBite ? "#ff9a9a" : "#e8f0f8", stroke: "#0a0f16", strokeThickness: 3 }).setOrigin(0.5).setDepth(26));
        const sc = m.root.scale || 1;
        m._qTxt.setPosition(m.root.x, m.root.y - 34 * sc + Math.sin(P.t / 90) * 1.5).setScale(Math.max(.6, sc)).setVisible(true).setAlpha(0.9);
      } else if (m && m._qTxt) m._qTxt.setVisible(false);
    });
    /* ===== v36 HAND-MOUNTED FOOTBALL + FLIGHT ROTATION ===== */
    // ball
    const bf = Array.isArray(S.ball) ? S.ball : [], bn = bf.length;
    const validBallFrame = f => !!f && Number.isFinite(Number(f.x)) && Number.isFinite(Number(f.y)) && Number.isFinite(Number(f.h));
    let BA = bn ? bf[Math.min(Math.max(0, i0), bn - 1)] : null;
    let BB = bn ? bf[Math.min(Math.max(0, i0 + 1), bn - 1)] : null;
    if (!validBallFrame(BA)) BA = validBallFrame(BB) ? BB : { x: S.meta?.losX || 360, y: 222, h: 0 };
    if (!validBallFrame(BB)) BB = BA;
    const safeFrac = Number.isFinite(frac) ? Math.max(0, Math.min(1, frac)) : 0;
    const bh = Number(BA.h) + (Number(BB.h) - Number(BA.h)) * safeFrac;
    if ((!this.ballSpr || this.ballSpr.active === false || !this.ballSpr.scene) && !gliding) {
      try {
        const seed = PJ(Number(BA.x), Number(BA.y));
        this.ballSpr = ribBallV91(this, seed.x, seed.y) || (window.__RIB20_createFootball ? window.__RIB20_createFootball(this, seed.x, seed.y) : this.add.image(seed.x, seed.y, "spr_ball").setScale(0.8).setDepth(19));
      } catch (e) { this.ballSpr = void 0; }
    }
    if ((!this.ballShad || this.ballShad.active === false || !this.ballShad.scene) && !gliding) {
      try {
        const seed = PJ(Number(BA.x), Number(BA.y));
        this.ballShad = this.add.ellipse(seed.x, seed.y + 3, 10, 4, 0x000000, 0.32).setDepth(3.5);
      } catch (e) { this.ballShad = void 0; }
    }
    if (this.ballSpr && gliding) {
      // v105: while the offense jogs to the line the ball is on the grass where the crew spotted it —
      // under every player in depth, at ground size — and the center picks it up when he sets
      try { const bp = PJ(Number(BA.x), Number(BA.y)); this.ballSpr.setPosition(bp.x, bp.y).setScale(0.40 * bp.s, 0.36 * bp.s).setDepth(TU("ballGroundDepth", 3.9)).setRotation(-this.ballFrameV91("spin", 0));
        if (this.ballShad) this.ballShad.setPosition(bp.x, bp.y + 3 * bp.s).setVisible(true); } catch (e) {}
    }
    if (this.ballSpr && !gliding) {
      const bgx = Number(BA.x) + (Number(BB.x) - Number(BA.x)) * safeFrac,
        bgy = Number(BA.y) + (Number(BB.y) - Number(BA.y)) * safeFrac;
      // v45: hand the officiating crew the ball's field-space spot for their tracking
      if (Number.isFinite(bgx)) P._refBX = bgx;
      if (Number.isFinite(bgy)) P._refBY = bgy;
      const bpp = PJ(Number.isFinite(bgx) ? bgx : Number(BA.x), Number.isFinite(bgy) ? bgy : Number(BA.y));
      // v36 BALL OWNERSHIP + ROTATION. A possessed football is mounted to one hand,
      // never the actor's center point. In the air its nose follows the velocity vector
      // while the laces roll around that axis; tips and loose balls tumble instead.
      const airY = Math.min(TU("ballAirCap", 64), bh * TU("ballAirK", 0.8)) * bpp.s;
      const airSw = bh > 2 ? 1 + Math.min(0.45, bh / 150) : 1;
      const mode = P.ballMode || (bh > 2 ? "flight" : "ground");
      const flight = bh > 2 || mode === "flight" || mode === "tip" || mode === "kick";
      const loose = !!P.__looseBall || mode === "loose" || mode === "bounce";
      // v105: before the snap the ball is under CENTER, not on a spot on the grass
      const kickPlay = /^(fg|punt|kickoff|xp)$/i.test(String(P.payload && P.payload.event || ""));
      const centerV105 = (!P.snapped && !flight && !loose && P.ballHolderId == null && !kickPlay && this.markers[5] && this.markers[5].root) ? this.markers[5] : null;
      const holder = !flight && !loose && P.ballHolderId != null ? this.markers[P.ballHolderId] : centerV105;
      let ballX = bpp.x, ballY = bpp.y - airY, ballDepth = flight ? 20 : loose ? 30 : 9;
      let baseSX = (flight ? 0.58 : loose ? 0.52 : 0.40) * airSw * bpp.s;
      let baseSY = (flight ? 0.52 : loose ? 0.45 : 0.36) * airSw * bpp.s;
      if (mode === "bounce") {
        const age = Math.max(0, P.t - (P.ballReleaseAt || P.t)), decay = Math.max(0, 1 - age / 720);
        ballX += (P.ballBounceDir || 1) * Math.min(18, age * 0.024) * bpp.s;
        ballY -= Math.abs(Math.sin(age / 92)) * 13 * decay * bpp.s;
      }
      /* ===== v109 THE FUMBLE COMES LOOSE (the ball) =====
       * The sim's ball frames carry the skid now (the loose point wanders through the scramble);
       * this is the bounce on top of it: an oval tumbling end over end with a jittered hop, phased
       * from the play's token so a replay bounces the same way, dying as the ball settles. Open
       * from `fumble`/`looseBall` until `recover`; the `loose` mode alone used to ride the straight path. */
      else if (loose && P.__looseV109) {
        const Lb = P.__looseV109, age = Math.max(0, P.t - Lb.t0), decay = Math.max(0, 1 - age / TU("looseBounceMs", 520));
        const ph = age / TU("looseHopMs", 78) + Lb.seed, hop = Math.abs(Math.sin(ph)), sq = Math.abs(Math.cos(ph * .5 + Lb.seed));
        ballY -= hop * TU("looseHopPx", 9) * decay * bpp.s;
        ballX += Math.sin(age * .031 + Lb.seed) * TU("looseJitterFx", 1.6) * decay * bpp.s;
        baseSX *= 1 + .32 * sq; baseSY *= 1 - .22 * sq;
        P._looseDrawV109 = (P._looseDrawV109 || 0) + 1;
      }
      if (holder && holder.root) {
        const sc = holder.root.scale || bpp.s || 1, rightHand = holder._rib20Traits?.handed !== "left";
        const sideView = holder.dirKey === "sd", rear = holder.dirKey === "up" || holder.dirKey === "ur";
        const facingX = sideView || holder.dirKey === "dr" || holder.dirKey === "ur" ? (holder.flip ? 1 : -1) : 0;
        // Anatomical right appears screen-left from the front and screen-right from behind.
        let handX = sideView ? facingX : (rightHand === rear ? 1 : -1);
        // v107: on a DRAWN throw cycle the arm is the artist's, not the anatomy's — the ball
        // starts on the side the CELL puts it on (throw_up right, throw_dn and throw_ur left)
        // and crosses with the sprite when a quarter facing is mirrored for a man working right.
        const cycV108 = cycleV108(holder);   // v108: the drawn cycle and its frame, throw or exchange
        const thrCellV107 = holder.forceState === "throwSeq" && cycV108 ? cycV108.cyc : null;
        if (thrCellV107) { const cellX = /^throw[RL]?_up$/.test(thrCellV107) ? 1 : -1;
          handX = (holder.flip && (sideView || holder.dirKey === "dr" || holder.dirKey === "ur")) ? -cellX : cellX; }
        // v108: the drawn exchange is right-handed art too — a left-hander does not hand off on the
        // other side of a cell that reaches to its right
        else if (cycV108) handX = 1;
        // and carry_up is cut with the ball in the screen-RIGHT hand, so ours rides there too and
        // the two read as one football — a left-hander tucks it on the wrong side for this pose only
        else if (/_up_carry$/.test(String(holder.tex || ""))) handX = 1;
        let ox = handX * (holder.posLabel === "QB" ? 8.5 : 7.2), oy = holder.posLabel === "QB" ? -3.5 : -1.5;
        if (holder.posLabel === "QB" && holder.forceState === "throwSeq") {
          // v107: the hand rides the FRAMES, not a clock of its own — cocked at the ear on frame
          // 3, through the ball on frame 4, which is the frame the flight starts on
          const rel = Math.max(1, TU("throwFrameMs", 85) * TU("throwReleaseFrame", 4));
          const wp = Math.max(0, Math.min(1.4, (holder.tms - (holder.seqT || holder.tms)) / rel));
          // One throwing arm: tuck -> cock beside the helmet -> extend through release.
          const cock = Math.sin(Math.min(1, wp / 0.78) * Math.PI * 0.5);
          const follow = Math.max(0, (wp - 0.78) / 0.56);
          ox = handX * (8.5 + cock * 2.2) + facingX * follow * 5.5;
          oy = -3.5 - cock * 7.2 + follow * 5.2;
        }
        // v108: on a cycle whose ball we measured off the cell, the offset IS the drawing's — the
        // ball rides the hand the artist put it in, whether ours is the one being seen or not, so
        // the exchange leaves exactly where the arm ends
        const handV108 = cycV108 && HAND_V108[cycV108.cyc] && HAND_V108[cycV108.cyc][cycV108.f];
        if (handV108) { ox = handV108[0]; oy = handV108[1]; }
        if (holder === centerV105) { ox = 0; oy = TU("ballUnderCenterY", 13); }   // v105: at his feet, on the line — in front of his shins, where the camera can see it
        ballX = holder.root.x + ox * sc; ballY = holder.root.y + oy * sc;
        // A back-facing carry sits just behind the torso plane; front/side carries sit
        // just above it. The lateral hand offset keeps either case out of the body core.
        ballDepth = holder.root.depth + (holder === centerV105 ? 0.05 : rear ? -0.06 : 0.08);
        baseSX = 0.40 * sc; baseSY = 0.36 * sc;
        // v107/v108: a cell that already carries a football hides ours — two otherwise. Which
        // frames those are is per cycle and MEASURED (BALL_DRAWN_V108), not the flat 0-3 v107
        // assumed: the rear throw only shows it cocked at the ear. The v1513 ball guard forces
        // visible/alpha back every update, so the scale is the only lever that holds.
        if (cycV108) { const drawn = (BALL_DRAWN_V108[cycV108.cyc] || []).indexOf(cycV108.f) >= 0;
          if (drawn) { baseSX = 0; baseSY = 0; }
          P._cycV108 = { cyc: cycV108.cyc, f: cycV108.f, drawn };   // audited below, off the sprite itself
        } else P._cycV108 = null;
      } else P._cycV108 = null;
      // The first frames leave the actual throwing hand, rather than snapping from the
      // hand to the QB's center-based simulation coordinate.
      if (flight && P.ballReleasePos && P.ballReleaseAt != null) {
        const age = Math.max(0, P.t - P.ballReleaseAt), rf = Math.min(1, age / TU("ballReleaseBlendMs", 135));
        const rq = rf * rf * (3 - 2 * rf);
        ballX = P.ballReleasePos.x + (ballX - P.ballReleasePos.x) * rq;
        ballY = P.ballReleasePos.y + (ballY - P.ballReleasePos.y) * rq;
      }
      // v105: a ball mid-hand is between the spot it left and the hand it is chasing
      const handV105 = holder ? this.handPosV105(P, ballX, ballY, bpp.s) : (P._hand = null);
      if (handV105) { ballX = handV105.x; ballY = handV105.y; ballDepth = Math.max(ballDepth, holder.root.depth + 0.1); }
      this.ballSpr.setPosition(ballX, ballY).setScale(baseSX, baseSY).setDepth(ballDepth);
      // v108: the audit, read off the sprite that just went down — while a man holds the ball on
      // one of the drawn cycles there is exactly one football on screen, his cell's or ours
      if (P._cycV108) { const C = P._cycV108, shown = Math.abs(this.ballSpr.scaleX) > 0.0001, V8 = v108Hook();
        if (C.drawn && shown) V8.ballDoubled++; else if (!C.drawn && !shown) V8.ballMissing++;
        V8.last = { cyc: C.cyc, f: C.f, drawn: C.drawn, shown }; V8.ballFrames = (V8.ballFrames || 0) + 1; }
      if (flight && mode !== "kick") {
        if (P._pbx != null && Math.hypot(ballX - P._pbx, ballY - P._pby) > 0.18) {
          const target = Math.atan2(ballY - P._pby, ballX - P._pbx);
          if (!Number.isFinite(P._ballNoseAngle)) P._ballNoseAngle = target;
          let da = target - P._ballNoseAngle; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
          P._ballNoseAngle += da * 0.42;
        }
        /* ===== v109 THE BALL HAS A SPEED (the picture) =====
         * The spin was a clock — the same frame rate for a rope and a rainbow — and the wobble
         * was an invisible 0.015 rad on every ordinary ball. The spin rate now rides the throw's
         * `vel` (a bullet's laces blur, a lob's turn over lazily) and the wobble amplitude rides
         * its `wobble`: a clean set throw is a tight spiral, a hurried one visibly wobbles. */
        const velK = P.ballVelV109 != null ? P.ballVelV109 / TU("ballVelRef", .36) : 1;
        const wobAmp = mode === "tip" ? 0 : TU("wobbleBaseRad", .012) + (P.ballWobbleV109 || 0) * TU("wobbleGainRad", .16);
        const wobble = mode === "tip" ? Math.sin(P.t * 0.036) * 0.22 : Math.sin(P.t * TU("wobbleHz", 0.022)) * wobAmp;
        // v91: the spiral — the laces turn through the twelve frames while the sprite is
        // rotated by the heading less the tilt each frame was drawn at
        const spinRate = TU("ballSpinRate", 0.02) * Math.pow(Math.max(.2, velK), TU("ballSpinVelPow", 1));
        const bf = this.ballFrameV91("spin", Math.floor((P.t - (P.ballReleaseAt || 0)) * spinRate));
        this.ballSpr.rotation = (P._ballNoseAngle || 0) + wobble - bf;
        try { const H = window.__V109_A = window.__V109_A || {}; H.last = { vel: P.ballVelV109 ?? null, wobble: P.ballWobbleV109 ?? null, dur: P.ballDurV109 ?? null,
          apex: P.ballApexV109 ?? null, spinRate: +spinRate.toFixed(4), wobAmp: +wobAmp.toFixed(3), style: P.ballStyle || null };
          H.byStyle = H.byStyle || {}; if (P.ballStyle && P.ballVelV109 != null) H.byStyle[P.ballStyle] = H.last; } catch (e) {}   // only balls the sim priced
      } else if (mode === "kick" || loose) {
        const rate = mode === "kick" ? 0.017 : 0.021;
        const bf = this.ballFrameV91("tumble", Math.floor((P.t - (P.ballReleaseAt || 0)) * TU("ballTumbleRate", 0.014)));
        this.ballSpr.rotation = RIB.v91img ? (VDIR > 0 ? 0 : Math.PI) : (P._ballTumbleBase || 0) + (P.t - (P.ballReleaseAt || 0)) * rate * VDIR;
      } else if (handV105 && handV105.toss) {
        // v105: a toss goes end over end
        const bf = this.ballFrameV91("tumble", Math.floor((P.t - (P._hand ? P._hand.t0 : 0)) * TU("tossTumbleRate", 0.02)));
        this.ballSpr.rotation = RIB.v91img ? 0 : (P.t - (P._hand ? P._hand.t0 : 0)) * 0.02;
      } else if (holder) {
        const rear = holder.dirKey === "up" || holder.dirKey === "ur";
        const bf = this.ballFrameV91("spin", 0);
        this.ballSpr.rotation = (rear ? 0.34 : holder.dirKey === "dn" || holder.dirKey === "dr" ? -0.34 : (holder.flip ? 0.14 : -0.14)) - bf;
        P._ballNoseAngle = null;
      } else this.ballSpr.rotation = -this.ballFrameV91("spin", 0);
      // v105: the trail — drawn only while the ball travels; fire when its man is hot
      try {
        const dtV105 = Math.max(1, delta * (typeof spd === "number" ? spd : 1));   // the play clock's own step this frame
        const spdV105 = P._pbx != null ? Math.hypot(ballX - P._pbx, ballY - P._pby) / dtV105 * 1000 : 0;
        const owner = flight ? (P._thrower != null ? P._thrower : 8) : holder && holder !== centerV105 ? P.ballHolderId : null;
        const hot = owner != null && this.hotV105(P, owner);
        const why = handV105 ? (handV105.kind === "snap" ? "snap" : "hand") : flight && mode !== "kick" ? "flight" : mode === "kick" ? "kick" : loose ? "loose" : (hot && holder && spdV105 > TU("trailCarrySpd", 90)) ? "carry" : null;
        this.trailV105(P, ballX, ballY, bpp.s, ballDepth, dtV105, why, hot);
      } catch (er) {}
      if (!Number.isFinite(this.ballSpr.x) || !Number.isFinite(this.ballSpr.y)) {
        this.ballSpr.setPosition(bpp.x, bpp.y);
      }
      P._pbx = this.ballSpr.x; P._pby = this.ballSpr.y;
      if (window.__RIB20_syncFootballFx) window.__RIB20_syncFootballFx(this, P, bh);
      if (this.ballShad) {
        // v99: a ball in the air throws its shadow away from the light post, further the
        // higher it is — the one cue that says how high a throw really got
        const VB = this.shadowVecV99(bpp.x, bpp.y), off = airY * TU("ballShadK", 0.85);
        this.ballShad.setPosition(bpp.x + VB.ux * off, bpp.y + 3 * bpp.s + VB.uy * off).setVisible(!holder);
        this.ballShad.setScale(Math.max(0.28, 1 - bh / 90) * bpp.s); this.ballShad.setAlpha((bh > 1 ? 0.25 : 0.32) * (1 - VB.reach * TU("shadowFade", 0.22))); }
      if (flight && T - (P.lastBallDot || 0) > 50) { P.lastBallDot = T;
        if (P._trailBallX != null) this.trail.lineStyle(P.ballStyle === "bullet" ? 1.7 : 1.2, 0xe8c39a, P.ballStyle === "bullet" ? 0.17 : 0.11).lineBetween(P._trailBallX, P._trailBallY, ballX, ballY);
        this.trail.fillStyle(0xffffff, 0.08).fillEllipse(ballX, ballY, 4.5, 1.3); P._trailBallX = ballX; P._trailBallY = ballY;
      } else if (!flight) { P._trailBallX = null; P._trailBallY = null; }
      // catch anticipation: the target raises his hands as the ball arrives
      if (P.awaitCatch2 != null && bh > 1) {
        const tm2 = this.markers[P.awaitCatch2];
        if (tm2 && Math.hypot(tm2.root.x - bpp.x, tm2.root.y - bpp.y) < 52) { tm2.forceState = "catch"; P.awaitCatch2 = null; }
      }
      /* v109 THE RECEIVER FINDS THE BALL — heads turn. The target's turns the moment the sim says
       * he found it (`ballTrack` -> m._trackV109; a script with no such event turns him at once, as
       * v86 did), and the man covering him (P.contestDef) has been watching the passer all along,
       * so his turns from the throw. `_lookAt` carries the ball's screen point and placeMarker
       * holds the QUARTER facing toward it instead of v86's hard profile. */
      if (P._trackScriptV109 !== P.script) { P._trackScriptV109 = P.script; P._hasTrackV109 = ((P.script && P.script.events) || []).some(ev => ev && ev.type === "ballTrack"); }
      if (bh > 1 && !loose && (P.awaitCatch != null || P.contestDef != null)) {
        const lm = P.awaitCatch != null ? this.markers[P.awaitCatch] : null, dm = P.contestDef != null ? this.markers[P.contestDef] : null;
        [lm && (lm._trackV109 || !P._hasTrackV109) ? lm : null, dm !== lm ? dm : null].forEach((mm, i) => { if (!mm || mm.forceState) return;
          if (!mm._lookAt) { try { if (!i) (window.__V86 = window.__V86 || {}).lookbacks = ((window.__V86 || {}).lookbacks || 0) + 1; const B = window.__V109_B = window.__V109_B || {}; B.headTurns = (B.headTurns || 0) + 1; if (i) B.defHeadTurns = (B.defHeadTurns || 0) + 1; } catch (e) {} }
          mm._lookAt = { x: ballX, y: ballY }; });
      } else this.markers.forEach(mm => { if (mm._lookAt) mm._lookAt = null; if (!flight) mm._trackV109 = false; });
      if (P.awaitCatch != null && bh > 1) {
        const tm = this.markers[P.awaitCatch];
        // v109: a reach already has his hands up on the drawn sequence — the 52px catch pose stands down
        if (tm && Math.hypot(tm.root.x - bpp.x, tm.root.y - bpp.y) < 52) { if (!tm._reachV109) tm.forceState = "catch"; P.awaitCatch = null; P.catchArmed = this.actorIdxSafe(tm); }
      }
    }
    // carrier trail
    if (P.carrierId != null && T - P.lastTrail > 66) {
      P.lastTrail = T;
      const m = this.markers[P.carrierId];
      const tc = P.carrierId >= 11 ? 0xff5a5a : 0xf0bb45;   // turnover returns paint red
      if (m) { this.trail.fillStyle(tc, 0.16).fillCircle(m.root.x, m.root.y + 10 * PJ(m.sx, m.sy).s, 4); }
    }
    // v20 QB VISION CONE — while the QB cycles his reads, draw a translucent cone
    // from the QB to the receiver he's currently looking at: green = separated,
    // yellow = close window, red = tight/unsafe throw.
    try {
      if (!this.lookG || !this.lookG.scene) this.lookG = this.add.graphics().setDepth(3.1);
      this.lookG.clear();
      if (P.lookIdx != null && P.lookIdx >= 0) {
        const qm = this.markers[8], rm = this.markers[P.lookIdx];
        if (qm && rm && qm.root && rm.root) {
          const x1 = qm.root.x, y1 = qm.root.y, x2 = rm.root.x, y2 = rm.root.y;
          const dx = x2 - x1, y = y2 - y1, len = Math.hypot(dx, y) || 1;
          const px = -y / len, py = dx / len;                    // perpendicular
          /* v101: the cone the QB is drawn looking through is the sim's ACCURACY cone, in the
           * sim's own yards — it fans open as the pocket goes or panic rises, and closes to a
           * tight green wedge when protection holds and the receiver has won. `lookCone` is the
           * same number the throw will miss by, so what you see is what he is about to do. */
          const coneYd = P.lookCone == null ? TU("coneNominalYd", 1.15) : P.lookCone;
          const w = Math.min(TU("conePxMax", 58), (6 + len * 0.10) * (0.55 + coneYd * TU("conePxK", 0.62)));
          const col = P.lookWindow==="green" ? 0x57e07a : P.lookWindow==="yellow" ? 0xf0bb45 : 0xe0484f;
          this.lookG.fillStyle(col, 0.13).fillTriangle(x1, y1, x2 + px * w, y2 + py * w, x2 - px * w, y2 - py * w);
          this.lookG.lineStyle(1.5, col, 0.45).lineBetween(x1, y1, x2, y2);
          this.lookG.lineStyle(2, col, 0.8).strokeCircle(x2, y2, 10 * (PJ(rm.sx, rm.sy).s || 1) + 6);
        }
      }
    } catch (_e) {}
    // pending TD: celebrate the exact frame the carrier crosses the plane (sim space)
    if (P.pendTD) {
      const cm = this.markers[P.pendTD.idx];
      const cross=cm&&this.markerPlaneCross(cm,P.pendTD.goalX,P.pendTD.dirTD);
      if (cross) {
        this.celebrate(P.pendTD.goalX, cross.y); vib([30, 40, 60]); this.endzoneFlash(); this.setSpot(P.pendTD.goalX, cross.y);
        P.pendTD = null;
      } else if (T >= S.duration - 33 && P.pendTD) {   // absolute fallback: never lose the moment
        this.celebrate(P.pendTD.x, P.pendTD.y); this.endzoneFlash(); P.pendTD = null;
      }
    }
    // events
    while (P.evIdx < S.events.length && S.events[P.evIdx].t <= T) this.fireEvent(S.events[P.evIdx++], P);
    if (T >= S.duration && !P.done) {
      P.done = true;
      this.stadiumWhistleV92();   // v92: the big screen freezes on the whistle
      let rt = this.resultText(P.payload);
      if (P.payload.penalty) rt = "FLAG ON THE PLAY · " + (Number(P.payload.yards ?? 0) < 0 ? "OFFENSE" : "DEFENSE");
      else if (P.fdConverted && !P.payload.scored) rt += " · FIRST DOWN";
      if (!this.badgesWhistleV95(P)) this.ribbon(rt, 900);   // v95: the wall tells the result when it has a badge for it
      const postMs = this.postPlayMsV86(P);
      if (postMs > 0) this.startPostV86(P, postMs);
      else this.time.delayedCall(P.payload.scored ? 430 : 260, () => { this.resetCamera(); this.complete(); });
    }
  }
  /* ===== v86 BETWEEN THE WHISTLES — seven animations, no new art =====
   * Every one of these is built from frames the sheets already carry (idle, stance,
   * run, block, tackle, wrap, dive, down, get-up, catch, throw) plus tweens and the
   * graphics layer the renderer already draws dust with. None of them changes a
   * play's outcome or timing in the sim; they change what the frames between the
   * whistles look like.
   *   1. POST-PLAY (startPostV86/updatePostV86) — the script used to end on the
   *      tackle frame and the next play's glide started from there, so both lines
   *      stood frozen at the old line of scrimmage while the play ended 25 yards
   *      away. Now the whistle opens a short phase: the pile unpiles (tackler first,
   *      with a push-off; the carrier a beat later), the ball is left at the spot
   *      for the crew, and everyone jogs toward the ball on his own side of it.
   *   2. PRE-SNAP (presnapV86) — the QB looks left and right at the line, squares up
   *      and claps; receivers look in for the signal and turn back upfield; the
   *      defensive front sways in its stance. The offensive line holds dead still —
   *      that is what a false start is.
   *   3. THE QB (qbTickV86) — a dropback is drawn as a backpedal facing the line, not
   *      a run toward his own goal; the moment he settles he hitches; a scramble
   *      leans into the run (m._lean); a scramble that ends in a tackle past the
   *      line is a SLIDE (dive frame, low hop, the tackler stays up).
   *   4. TACKLE STYLES (in case "tackle") — from the geometry the sim already
   *      resolved: a tackler BEHIND the carrier drags him down (the carrier keeps
   *      running, leaning, before he folds); a square hit with knock-back knocks him
   *      backward before he goes down; a low or side tackle at speed is a fall
   *      forward for the extra yard.
   *   5. THE BALL IN THE AIR — the target runs with his head turned to the ball
   *      (side profile toward it, m._lookAt); a tipped ball pulls every nearby body
   *      into a reach (the tip drill).
   *   6. FIELD WEAR + SHADOWS (addWearV86/drawWearV86) — tackles, piles, cuts and
   *      every snap between the hashes wear the turf, stored in field space and
   *      re-projected every snap so the marks stay where the game put them; player
   *      shadows stretch and drift a little further each quarter.
   * Dials: postPlayMs, unpileMs, postJogSpeed, postGatherOff/Def, cadenceLookMs,
   * wrLookMs, stanceSway, hitchSpd, tuckLean, slideP, knockKb, fallFwdSpd, dragMs,
   * wearMax, shadowStretchQ. */
  /* ===== v87 THE HUDDLE, THE POSTS, THE SAFETY =====
   * planHuddleV87 turns the between-play glide into three beats: everyone jogs to his
   * side's ring (the offense seven yards behind the new line with the QB in the
   * middle, the defense five yards on its side), holds facing the middle, breaks
   * with a hop and a clap, then jogs to the formation. Kicks and a hurry-up offense
   * (the engine's `noHuddle` flag) skip it. drawGoalpostsV87 paints uprights at BOTH
   * end lines every snap (field space, re-projected), so the field reads as a field
   * and not a stretch of grass; the FG overlay still lights the attacked posts. */
  planHuddleV87(et, script, losAbs) {
    try {
      if (!TU("huddle", 1) || REDUCED_MOTION || et.noHuddle || /^(fg|punt|kickoff|xp)$/i.test(String(et.event || ""))) return null;
      this.markers.forEach((m) => { m._hudBreakAt = null; m._hudWalkUntil = null; m._walkOffV109 = 0; m._celRateV109 = 0; });   // v109: no flag from the last snap survives into this one
      const dir = script.meta.dir || VDIR || 1, YDF = PLAY_W / 100, MIDY = (F_TOP + F_BOT) / 2;
      const losX = PLAY_L + (losAbs / 100) * PLAY_W;
      const cx = { off: losX - dir * TU("huddleOffYd", 7) * YDF, def: losX + dir * TU("huddleDefYd", 5) * YDF };
      const clx = v => Math.max(PLAY_L - EZ * 0.4, Math.min(PLAY_R + EZ * 0.4, v));
      cx.off = clx(cx.off); cx.def = clx(cx.def);
      const R = TU("huddleR", 15);
      let maxA = 0, maxB = 0;
      ["off", "def"].forEach(side => {
        const idx = this.markers.map((m, i) => i).filter(i => (i < 11) === (side === "off"));
        const ring = idx.filter(i => !(side === "off" && i === 8)).sort((a, b) => this.markers[a]._jog.y - this.markers[b]._jog.y);
        ring.forEach((i, k) => { const ang = -Math.PI / 2 + (k / ring.length) * Math.PI * 2;
          const m = this.markers[i]; m._hud = { side, x: cx[side] + Math.cos(ang) * R * (side === "off" ? 1 : 1.05), y: MIDY + Math.sin(ang) * R }; m._hudFaced = false;
          maxA = Math.max(maxA, Math.hypot(m._hud.x - m.sx, m._hud.y - m.sy)); maxB = Math.max(maxB, Math.hypot(m._jog.x - m._hud.x, m._jog.y - m._hud.y)); });
        if (side === "off") { const qb = this.markers[8]; if (qb) { qb._hud = { side, x: cx.off + dir * 2, y: MIDY }; qb._hudFaced = false;
          maxA = Math.max(maxA, Math.hypot(qb._hud.x - qb.sx, qb._hud.y - qb.sy)); maxB = Math.max(maxB, Math.hypot(qb._jog.x - qb._hud.x, qb._jog.y - qb._hud.y)); } }
      });
      const js = TU("jogSpeed", 340);
      // v109: the break is staggered by position and walked for its first `huddleWalkMs`, so the leg to the line is budgeted for both
      const wm = TU("huddleWalkMs", 300), stag = TU("huddleBreakStaggerMs", 90) * 3.5, walkPx = TU("walkSpeed", 100) * wm / 1000;
      const a = Math.min(1100, Math.max(260, maxA / js * 1000 + 120)), hold = TU("huddleHoldMs", 420), b2 = Math.min(1500, Math.max(320, Math.max(0, maxB - walkPx) / js * 1000 + wm + stag + 160));
      this._jogDelay = Math.min(TU("huddleMaxMs", 2700), a + hold + b2);
      try { (window.__V87 = window.__V87 || {}).huddles = ((window.__V87 || {}).huddles || 0) + 1; } catch (e) {}
      return { a, b: a + hold, cx, cy: MIDY, broke: false };
    } catch (e) { return null; }
  }
  huddleBreakV87() {
    /* ===== v109 THE HUDDLE BREAKS LIKE A HUDDLE =====
     * v87 broke all eleven on one frame with one identical hop. Now the break is staggered by
     * position — the line first, the backs and tight ends next, the receivers after them, the
     * quarterback last — each man's hop has its own height and length, and the glide branch
     * holds each man in the ring until his own `_hudBreakAt` and walks him out of it
     * (`_hudWalkUntil`) before the trot. The stagger is `huddleBreakStaggerMs` per tier. */
    const H = this.play && this.play.hud, st = TU("huddleBreakStaggerMs", 90), V = this.v109E().huddle, rec = [];
    const base = H ? H.b : (this.play ? this.play.t : 0), wm = TU("huddleWalkMs", 300);
    const tier = (m, i) => i === 8 ? 3 : m.isLine ? 0 : /^(WR|CB|S)$/.test(String(m.posLabel || "")) ? 2 : 1;
    this.markers.forEach((m, i) => { if (!m._hud) return;
      const tr = tier(m, i), at = tr * st + Math.random() * st * 0.5;
      m._hudBreakAt = base + at; m._hudWalkUntil = base + at + wm;
      rec.push({ i, pos: m.posLabel || (i < 11 ? "O" : "D"), tier: tr, at: Math.round(at) });
      const hop = TU("huddleHopPx", 3) * (0.6 + Math.random() * 0.8), dur = 110 + Math.random() * 60;
      if (m.body) this.tweens.add({ targets: m.body, y: -hop, yoyo: true, duration: dur, delay: at });
      if (i === 8 && m.body) this.tweens.add({ targets: m.body, scaleX: 1.14, scaleY: 0.92, yoyo: true, duration: 110, delay: at }); });   // the clap, when HE breaks
    V.breaks = rec; V.staggered++;
  }
  /* ===== v109 THE QUARTERBACK'S EYES =====
   * `look` and `read` name the man the quarterback is on; the HUD drew a cone and his body stayed
   * on the rear idle. Now each read gives him a brief quarter facing toward the target (`ur`, or
   * `dr` for a man behind him) for `qbEyeMs`, never inside `qbEyeGuardMs` + the wind-up lead of
   * the scripted throw (scanned ahead the way windupV107 does), so the v107 arm still fires
   * from `up`. */
  qbEyeV109(P, to) {
    if (!TU("qbEyeV109", 1) || REDUCED_MOTION || !to) return;
    const qb = this.markers[8], ti = this.actorIdx(to), tm = ti >= 0 ? this.markers[ti] : null;
    const K = this.v109E(), sk = K.eyeSkips || (K.eyeSkips = {});
    const no = (why) => { sk[why] = (sk[why] || 0) + 1; };
    if (!qb || !tm || !qb.root) return no("noman");
    if (qb.forceState) return no("forced");                             // throwing, handing off, on the ground
    if ((qb.homeDir || "up") !== "up") return no("facing");
    if (P.ballHolderId !== 8 || P._thrown) return no("noball");
    if ((qb._spdPx || 0) > TU("qbEyeSpdMax", 60)) return no("running");  // he is scrambling, not reading
    const T = Math.max(0, P.t - (P.delay || 0)), nx = this.nextThrowV109(P, T);
    // the turn must be OVER before the v107 wind-up needs him square: the guard is the brief's
    // 400 ms plus the wind-up's own lead, and a window too short to read is not worth turning for
    const guard = TU("qbEyeGuardMs", 120) + TU("throwFrameMs", 85) * TU("throwReleaseFrame", 4);   // v109: the wind-up lead plus a small margin — a wider guard than the drop itself skipped every read (the snap-back in qbTickV86 is what actually guarantees he is square)
    const endT = nx ? nx.t + (P.delay || 0) - guard : 1e9;
    if (endT - P.t < TU("qbEyeMinMs", 110)) return no("guard");
    const a = PJ(qb.sx, qb.sy), b = PJ(tm.sx, tm.sy), dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) < TU("qbEyeMinDx", 8)) return no("straight");       // dead ahead: there is nothing to turn onto
    qb.dirKey = dy > 6 ? "dr" : "ur"; qb.flip = dx > 0; qb._dropback = false;   // the quarter cycle outranks the backpedal for as long as it holds
    qb._eyeV109 = { until: Math.min(P.t + TU("qbEyeMs", 300), endT), to: ti };
    K.eyes++;
  }
  nextThrowV109(P, T) { for (const e of ((P.script && P.script.events) || [])) if (e && e.type === "throw" && e.style !== "kick" && !e.fg && e.t > T) return e; return null; }
  drawGoalpostsV87() {
    if (!this.goalG) this.goalG = this.add.graphics().setDepth(3.95);
    if (!this.postShadG) this.postShadG = this.add.graphics().setDepth(TU("postShadDepth", 3.44));   // v99: on the grass, under everyone
    const g = this.goalG; g.clear();
    const sg = this.postShadG; sg.clear(); sg.setVisible(!!TU("shadowsV99", 1));
    const MIDY = (F_TOP + F_BOT) / 2, W = TU("postHalfW", 62);
    [PLAY_L - EZ * 0.72, PLAY_R + EZ * 0.72].forEach(x => {
      const base = PJ(x, MIDY), l = PJ(x, MIDY - W), r = PJ(x, MIDY + W), s = base.s;
      const barY = base.y - TU("postH", 46) * s, up = TU("uprightH", 150) * s;   // v92: real proportions, not a garden fence
      // v99: THE FRAME ON THE GRASS. The whole H is projected point by point away from the
      // light post — the mast, the crossbar and both uprights — so the shadow is a real
      // goalpost lying on the end zone and not a smudge, and it swings with the light.
      if (TU("shadowsV99", 1)) {
        const V = this.shadowVecV99(base.x, base.y), k = V.slope * TU("postShadK", 0.8);
        const drop = (px, py, h) => ({ x: px + V.ux * h * k, y: py + V.uy * h * k });
        const n = { x: -V.uy, y: V.ux };                                    // across the shadow, for its width
        const barH = TU("postH", 46) * s, topH = barH + up;
        const bar = drop(base.x, base.y, barH), tip = drop(base.x, base.y, topH);
        const lB = drop(l.x, base.y, barH), rB = drop(r.x, base.y, barH);
        const lT = drop(l.x, base.y, topH), rT = drop(r.x, base.y, topH);
        const a0 = TU("postShadA", 0.3) * (1 - V.reach * 0.3) * this.shadowMulV100(), w0 = 3.2 * s, w1 = 5.4 * s;
        sg.fillStyle(0x04070d, a0);
        const quad = (p0, p1, wa, wb) => sg.fillPoints([{ x: p0.x - n.x * wa, y: p0.y - n.y * wa }, { x: p1.x - n.x * wb, y: p1.y - n.y * wb },
          { x: p1.x + n.x * wb, y: p1.y + n.y * wb }, { x: p0.x + n.x * wa, y: p0.y + n.y * wa }], true);
        quad({ x: base.x, y: base.y }, bar, w0, w1);                        // the mast
        quad(lB, rB, w1 * 0.85, w1 * 0.85);                                  // the crossbar, laid across
        quad(lB, lT, w1 * 0.75, w1 * 0.75); quad(rB, rT, w1 * 0.75, w1 * 0.75); // both uprights
        const padK144 = TU("postPadV144", 1) ? TU("postPadSocketKV144", 1.5) : 1;   // v144 D: the pad is wider than the post, so its socket is too
        sg.fillStyle(0x04070d, a0 * 0.5); sg.fillEllipse(base.x, base.y + 1, 13 * s * padK144, 5 * s * padK144);   // the socket it stands in
        if (!this._postShadDbgV99) this._postShadDbgV99 = {};
        // keyed by where the end lands ON SCREEN, not by field x — VDIR decides which end
        // of the field is the near one, and that flips with the drive
        this._postShadDbgV99[V.reach > 0.5 ? "near" : "far"] = { base: { x: Math.round(base.x), y: Math.round(base.y) }, tip: { x: Math.round(tip.x), y: Math.round(tip.y) },
          len: Math.round(Math.hypot(tip.x - base.x, tip.y - base.y)), reach: +V.reach.toFixed(3) };
      }
      g.lineStyle(5 * s, 0x1a1408, 0.55); g.lineBetween(base.x, base.y + 2, base.x, barY);            // the post's shadow edge
      g.lineStyle(3.5 * s, 0xffe08a, 0.98); g.lineBetween(base.x, base.y, base.x, barY);              // the post
      this.postPadV144(g, base, s);                                                                    // v144 D: and the pad wrapped round its foot
      g.lineStyle(3 * s, 0xffe08a, 0.98); g.lineBetween(l.x, barY, r.x, barY);                          // the crossbar
      g.lineBetween(l.x, barY, l.x, barY - up); g.lineBetween(r.x, barY, r.x, barY - up);              // the uprights
      g.fillStyle(0xf0bb45, 0.9); g.fillCircle(l.x, barY - up, 1.6 * s); g.fillCircle(r.x, barY - up, 1.6 * s);
    });
  }
  /* ===== v144 D THE PAD ROUND THE FOOT OF THE POST =====
   * A real goalpost stands in a thick padded collar, and ours stood bare on the grass. It is drawn
   * into whichever Graphics the caller is already using, in PJ space, every dimension multiplied by
   * that end's own `s` — the one rule this function has to keep, or the far post's pad is the size
   * of the near one. The blue is the stadium's own: `baseBandColV112`, the band round the foot of
   * the bowl, so the pad reads as part of the same building. Drawn after the post and before the
   * crossbar, at `goalG`'s depth (3.95): in front of the turf, the lines, the shadow and the
   * sideline furniture, behind every player — a man in the end zone passes in front of it. */
  postPadV144(g, base, s) {
    if (!TU("postPadV144", 1)) return;
    const h = TU("postPadHV144", 15) * s, w = TU("postPadWV144", 6.2) * s;
    const col = TU("postPadColV144", 0x1a4694), lip = TU("postPadLipV144", 0x6f9be6);
    const top = base.y - h, cap = Math.max(1, w * TU("postPadCapKV144", .42));
    g.fillStyle(0x04070d, .35); g.fillEllipse(base.x, base.y + 1.5 * s, w * 2.25, cap * 1.5);   // it sits IN the grass
    g.fillStyle(col, 1);
    g.fillRect(base.x - w, top, w * 2, h);                                      // the collar
    g.fillEllipse(base.x, top, w * 2, cap);                                     // its rounded top
    g.fillEllipse(base.x, base.y, w * 2, cap);                                  // and its rounded foot
    g.fillStyle(lip, TU("postPadLipAV144", .55));
    g.fillEllipse(base.x, top, w * 2, cap * .55);                               // the light catching the top edge
    g.fillStyle(0x000000, TU("postPadShadeAV144", .22));
    g.fillRect(base.x + w * TU("postPadShadeKV144", .30), top, w * (1 - TU("postPadShadeKV144", .30)), h);   // the round of it
    const D = (window.__V144 = window.__V144 || {});
    (D.pads = D.pads || []).length > 8 && (D.pads.length = 0);
    D.pads.push({ x: Math.round(base.x), y: Math.round(base.y), h: +h.toFixed(1), w: +w.toFixed(1), s: +s.toFixed(3) });
  }
  /* ===== v144 C NOBODY STANDS PERFECTLY STILL =====
   * Between the whistle and the next snap the markers used to hold one frame. This keeps them
   * alive on the cheapest possible terms: no script, no pathing, no new state that the next play
   * has to clear. Each man drifts a couple of yards toward a loose spot on his own side of the
   * ball, at a walk, and rolls his facing now and then — the milling about that happens while the
   * officials spot it. It is deliberately slower than `walkSpeed`: they are not going anywhere.
   * Reduced motion keeps the pose and drops the motion, the way the crowd does. */
  idleBetweenV144(delta) {
    if (!TU("idleBetweenV144", 1) || REDUCED_MOTION) return;
    const M = this.markers; if (!M || !M.length) return;
    const now = this._idleClockV144 = (this._idleClockV144 || 0) + delta;   // not `tms` — that name is the MARKER's own clock
    const sp = TU("idleShuffleSpeed", 26) * (delta / 1000);
    for (let i = 0; i < M.length; i++) {
      const m = M[i]; if (!m || !m.root || m.root.visible === false) continue;
      /* a man in a drawn SEQUENCE is busy — a celebration outranks the get-up and the wind-up
       * everywhere else in this file, and it outranks the shuffle too. Only a man standing idle
       * (or with nothing forced on him) mills, and only he has his `forceState` touched: clearing
       * it indiscriminately cut a scorer's celebration off at the end of the post-play phase. */
      if (m.forceState && m.forceState !== "idle") { m._idleNextV144 = null; continue; }
      /* Every target is a step from where the WHISTLE left him, never from where he last wandered
       * to. Two earlier cuts of this both drifted: building the target off the ball spot walked
       * all twenty-two men into one band around the football, and a small per-pick pull toward
       * the new line did the same thing geometrically over a long gap (16% of the distance, ten
       * picks, 83% of the way there). Either way the field lost its depth — measured, the near/far
       * spread fell from ~390px to ~50px, which is the thing that makes the near men read as near.
       * A man between plays mills where he is; the next snap's glide is what moves him to the
       * formation, and it already does that. So: one home per gap, and a leash on it. */
      if (m._idleHomeV144 == null) m._idleHomeV144 = { x: m.sx, y: m.sy };
      if (m._idleNextV144 == null || now > m._idleNextV144) {
        const h = m._idleHomeV144, r = TU("idleShuffleR", 18);
        m._idleToV144 = { x: h.x + (Math.random() * 2 - 1) * r,
                          y: h.y + (Math.random() * 2 - 1) * TU("idleShuffleSpread", 26) };
        m._idleNextV144 = now + TU("idleShuffleEveryMs", 900) + Math.random() * TU("idleShuffleJitterMs", 1100);
      }
      const T = m._idleToV144; if (!T) continue;
      const dx = T.x - m.sx, dy = T.y - m.sy, d = Math.hypot(dx, dy);
      /* `placeMarker(m, sx, sy, dtms)` takes the spot he is moving TO and derives his speed and
       * his facing from it against the one he is on — so the new position must be passed IN, not
       * written onto `m.sx` first, or it reads a standing man and never turns him. `idleCycleK`
       * slows his animation clock: this is an amble, not a jog. */
      const dt144 = Math.max(1, delta * TU("idleCycleK", .5));
      if (d > TU("idleShuffleStopPx", 4)) {
        const st = Math.min(d, sp);
        m.forceState = null;
        this.placeMarker(m, m.sx + dx / d * st, m.sy + dy / d * st, dt144);
      } else {
        this.placeMarker(m, m.sx, m.sy, dt144);   // standing: no step, but the idle cycle keeps running
      }
    }
    try { (window.__V144 = window.__V144 || {}).idleTicks = (window.__V144.idleTicks || 0) + 1; } catch (e) {}
  }
  postPlayMsV86(P) {
    const pay = P.payload || {};
    if (REDUCED_MOTION) return 0;
    if (/^(fg|punt|kickoff|xp)$/i.test(String(pay.event || ""))) return 0;   // the kicking game has its own shape
    if (pay.scored || pay.penalty) return 0;                                  // the celebration and the flag own those moments
    // v103: the post-play phase has to be long enough to hold a second of live contact AND
    // still show everyone letting go and gathering afterwards
    return TU("postPlayMs", 1450) + TU("postGatherExtraMs", 260);   /* v144 C: the gather had 600ms of a 1450ms window once the late contact had its 850 — it reaches the huddle spot now */
  }
  startPostV86(P, ms) {
    const S = P.script, dir = S.meta.dir || VDIR || 1, YDF = PLAY_W / 100, MIDY = (F_TOP + F_BOT) / 2;
    const spot = { x: P._refBX != null ? P._refBX : (P.losX != null ? P.losX : PLAY_L + PLAY_W / 2), y: P._refBY != null ? P._refBY : MIDY };
    P.post = { t: 0, ms, spot, dir };
    try { P.lookIdx = null; P.lookCone = null; P.lookProt = null; if (this.lookG) this.lookG.clear(); if (this.previewG) this.previewG.clear(); } catch (e) {}   // the read cone dies with the play
    this.markers.forEach((m, i) => {
      const off = i < 11;
      const grounded = /^(tackleSeq|down|dive|pancakeSeq)$/.test(String(m.forceState || "")) || (m._groundT > 0 && m.tms - m._groundT < 500);
      const carrier = i === P.carrierId;
      m._post = { grounded, rose: false,
        up: grounded ? TU("unpileMs", 340) + (carrier ? TU("unpileCarrierMs", 200) : 0) + Math.random() * 120 : 0,
        tx: spot.x - dir * (off ? TU("postGatherOff", 6) : -TU("postGatherDef", 7)) * YDF + (Math.random() - 0.5) * 3 * YDF,
        ty: spot.y + (m.sy - spot.y) * TU("postSpreadK", 0.7) + (Math.random() - 0.5) * TU("postJitterY", 26) };
      /* v103 THE WHISTLE IS NOT THE END OF THE CONTACT — v86 let go of everything on the
       * whistle: every grab, every block released on the same frame and twenty-two men
       * turned and jogged to their spots as one, which is the single most artificial beat
       * in the broadcast. Football does not stop on the whistle. For `lateContactMs` the
       * pile keeps churning, the men with hands on keep them on, and anybody who was still
       * closing ARRIVES — a shove into the heap, a shove back, and only then does everyone
       * peel off and gather. `late` marks the men who are still in it. */
      // the heap is the men AT the spot — a man holding a grip twenty yards away is not in it
      const dSpot = Math.hypot(m.sx - spot.x, m.sy - spot.y);
      const inPile = dSpot < TU("pileRadiusPx", 26);
      const holding = dSpot < TU("pileHoldPx", 52) && /^(grab|tackleSeq|down|dive)$/.test(String(m.forceState || ""));
      m._late = null;
      if (TU("lateContactV103", 1) && !REDUCED_MOTION && (inPile || holding)) {
        m._late = { kind: grounded ? "pile" : "hold", ph: Math.random() * 6.28, amp: 1.2 + Math.random() * 1.6 };
        if (!grounded && holding) { m._lean = 0; m._lookAt = null; m._dropback = false; return; }   // he keeps his grip
      }
      if (!grounded && m.forceState && m.forceState !== "getupSeq") m.forceState = null;   // grabs, blocks and stances let go at the whistle
      m._lean = 0; m._lookAt = null; m._dropback = false; m._walk = false; m._eyeV109 = null;   // v109: the walk and the eyes end with the play too
      if (m.body) { m.body.x = 0; m.body.y = 0; }
      try { this.unpair(i); } catch (e) {}
    });
    // the late arrivals: the two or three nearest men who were NOT in the pile still crash in
    P.post.late = [];
    if (TU("lateContactV103", 1) && !REDUCED_MOTION) {
      const cand = this.markers.map((m, i) => ({ m, i, d: Math.hypot(m.sx - spot.x, m.sy - spot.y) }))
        .filter((q) => q.m && q.m._post && !q.m._post.grounded && !q.m._late
          && q.d > TU("pileRadiusPx", 26) && q.d < TU("lateReachPx", 150))
        .sort((a, b) => a.d - b.d).slice(0, Math.max(0, Math.round(TU("lateArrivals", 3))));
      for (const q of cand) {
        P.post.late.push({ i: q.i, at: TU("lateFromMs", 120) + Math.random() * TU("lateSpreadMs", 380), hit: false,
          tx: spot.x + (q.m.sx - spot.x) * .22, ty: spot.y + (q.m.sy - spot.y) * .22 });
        q.m._post.late = true;
      }
      try { const V = window.__V103 = window.__V103 || {}; V.late = (V.late || 0) + P.post.late.length; } catch (e) {}
    }
    /* ===== v109 TEAMMATES HELP EACH OTHER UP =====
     * v86 stood every downed man up on his own timer, alone. Now, with `helpUpP`, the nearest
     * standing teammate (his own side, not in the pile, not a late arrival, within
     * `helpUpMaxPx`) walks over on the walk cycle, stops beside him facing him with a hand out,
     * and only when the man is up do both of them gather. All inside the existing post budget. */
    P.post.helps = [];
    if (TU("helpUpV109", 1) && !REDUCED_MOTION) {
      const taken = new Set();
      this.markers.forEach((g, gi) => {
        const q = g._post; if (!q || !q.grounded || Math.random() >= TU("helpUpP", 0.6)) return;
        let best = -1, bd = TU("helpUpMaxPx", 90);
        this.markers.forEach((h, hi) => { const hq = h._post; if (hi === gi || !hq || hq.grounded || hq.late || hq.help || h._late || taken.has(hi) || (hi < 11) !== (gi < 11)) return;
          const d = Math.hypot(h.sx - g.sx, h.sy - g.sy); if (d < bd) { bd = d; best = hi; } });
        if (best < 0) return;
        taken.add(best);
        const h = this.markers[best], side = Math.sign(h.sx - g.sx) || (gi < 11 ? -dir : dir);
        h._post.help = { to: gi, tx: g.sx + side * TU("helpUpStandPx", 11), ty: g.sy + (h.sy > g.sy ? 4 : -4), at: TU("helpUpDelayMs", 120) + Math.random() * 160, there: false, done: false };
        q.helped = best;
        P.post.helps.push({ helper: best, downed: gi });
      });
      this.v109E().helpUps += P.post.helps.length;
    }
    /* ===== v109 THE CREW SPOTS THE BALL, AND THE STICKS MOVE (the post-play half) ===== */
    if (!REDUCED_MOTION) {
      const pay9 = P.payload || {};
      // the camera pulls WIDE on the whistle (camPostV109 rides the spring toward it every post frame)
      const z0 = (((window.__FIELD_FX && window.__FIELD_FX.zoom) || 1.16)) * TU("perspZoomK", 0.78);
      P.post.camWide = { z: z0 * TU("camWhistleZoom", 0.88) }; this.v109E().cam.whistleWide++;
      if (P.fdConverted) this.chainWalkV109(spot.x, dir);        // a new set of downs: the chain crew walks to the new line
      if (pay9.measure) this.measureV109(spot, dir);            // another system may flag a measurement on the row — read defensively
    }
    // the ball is dead: it stays at the spot for the crew, nobody jogs off with it
    P.ballHolderId = null; P.ballMode = "ground"; P.__looseBall = false;
    try { if (this.ballSpr) { const bp = PJ(spot.x, spot.y); this.ballSpr.setPosition(bp.x, bp.y - 2 * bp.s).setScale(0.40 * bp.s, 0.36 * bp.s).setDepth(9).setRotation(0.2);
      if (this.ballShad) this.ballShad.setPosition(bp.x, bp.y + 3 * bp.s).setScale(bp.s).setAlpha(0.32).setVisible(true); } } catch (e) {}
    try { (window.__V86 = window.__V86 || {}).posts = ((window.__V86 || {}).posts || 0) + 1; } catch (e) {}
  }
  updatePostV86(P, delta) {
    const spd = Math.max(0.5, window.__getGridironLiveSpeed?.() ?? 1) * TU("basePlayRate", 0.7);
    const dt = delta * spd; P.post.t += dt;
    const k = P.post.t;
    /* v103: the first second is still contact. The pile churns on its own phase, the men
     * holding a grip keep holding it, and the late arrivals cross the last few yards and
     * shove into the heap — a puff, a jolt of the pile, a knock of the camera — before
     * everybody lets go and the v86 gather takes over. */
    const lateMs = TU("lateContactMs", 850);
    if (P.post.late && k < lateMs) {
      for (const L of P.post.late) {
        const m = this.markers[L.i]; if (!m || !m.root) continue;
        if (k < L.at) continue;
        const dx = L.tx - m.sx, dy = L.ty - m.sy, d = Math.hypot(dx, dy);
        if (d > 4) { const stp = Math.min(d, TU("lateChargeSpeed", 210) * dt / 1000);
          this.placeMarker(m, m.sx + dx / d * stp, m.sy + dy / d * stp, dt); }
        else if (!L.hit) {
          L.hit = true; m.forceState = "grab";
          this.puffFx(m.sx, m.sy, 3, 0xc8d6cb, 0.45);
          this.hitStop = Math.max(this.hitStop, TU("lateHitStop", 22));
          REDUCED_MOTION || this.cameras.main.shake(120, 0.005);
          try { const V = window.__V103 = window.__V103 || {}; V.lateHits = (V.lateHits || 0) + 1; } catch (e) {}
          this.time.delayedCall(TU("lateHoldMs", 320), () => { if (m.forceState === "grab") m.forceState = null; });
        }
      }
    }
    if (k < lateMs) {
      // the heap is still moving: everyone in it jostles on his own phase
      for (const m of this.markers) { const q = m && m._late; if (!q || !m.body) continue;
        const f = 1 - k / lateMs;
        m.body.x = Math.sin(k / TU("pileChurnMs", 90) + q.ph) * q.amp * f;
        m.body.y = Math.cos(k / (TU("pileChurnMs", 90) * 1.4) + q.ph) * q.amp * .5 * f; }
    } else if (P.post._lateDone !== true) {
      P.post._lateDone = true;
      for (const m of this.markers) { if (m && m._late) { m._late = null; if (m.body) { m.body.x = 0; m.body.y = 0; }
        if (m.forceState === "grab") m.forceState = null; } }
    }
    const V9 = this.v109E();
    this.markers.forEach((m, i) => {
      const q = m._post; if (!m.root) return;
      if (m._flyV112) { this.placeMarker(m, m.sx, m.sy, delta); return; }   // v112: a man still in the air comes down before anything else moves him
      if (!q) return;
      if (m._late && k < lateMs) return;               // still in the scrap: he is not going anywhere yet
      if (q.late && k < lateMs) return;                // still arriving
      if (q.help && !q.help.done) {                    // v109: the helper walks over and stands by him until he is up
        const Hh = q.help, g = this.markers[Hh.to], gq = g && g._post;
        if (!gq || (gq.rose && String(g.forceState || "") !== "getupSeq")) { Hh.done = true; m._walk = false; if (m.forceState === "idle") m.forceState = null; }
        else if (k < Hh.at) { this.placeMarker(m, m.sx, m.sy, delta); return; }
        else {
          const dx = Hh.tx - m.sx, dy = Hh.ty - m.sy, d = Math.hypot(dx, dy);
          if (d > 3 && !Hh.there) { m._walk = true; const stp = Math.min(d, TU("walkSpeed", 100) * dt / 1000); this.placeMarker(m, m.sx + dx / d * stp, m.sy + dy / d * stp, dt); V9.walkFrames++; }
          else { if (!Hh.there) { Hh.there = true; m._walk = false; const a = PJ(m.sx, m.sy), b = PJ(g.sx, g.sy); this.faceMarker(m, b.x - a.x, b.y - a.y); m.forceState = "idle";
              if (m.body) this.tweens.add({ targets: m.body, x: (b.x > a.x ? 1 : -1) * TU("helpUpReachPx", 3), y: 1, yoyo: true, duration: 260, repeat: 1 });   // the hand goes out
              V9.helpUpArrivals++; }
            this.placeMarker(m, m.sx, m.sy, delta); }
          return;
        }
      }
      if (q.grounded && !q.rose) {
        if (k < q.up) { this.placeMarker(m, m.sx, m.sy, delta); return; }
        q.rose = true; m._launchUntil = 0; m._flyV112 = null; m._flySpinV112 = 0; if (m.forceState !== "celebrateSeq") { m.forceState = "getupSeq"; m.seqT = m.tms; } if (m.body) m.body.setAlpha(1);   // v91: a celebration outranks the get-up
        // the man on top pushes off the pile as he rises
        if (i !== P.carrierId && m.body) this.tweens.add({ targets: m.body, x: (m.flip ? -1 : 1) * TU("pushOffPx", 4), yoyo: true, duration: 150 });
      }
      if (/^(getupSeq|tackleSeq|down|dive|pancakeSeq)$/.test(String(m.forceState || ""))) { this.placeMarker(m, m.sx, m.sy, delta); return; }
      const dx = q.tx - m.sx, dy = q.ty - m.sy, d = Math.hypot(dx, dy);
      if (d < 3) { this.placeMarker(m, m.sx, m.sy, delta); return; }
      const stp = Math.min(d, TU("postJogSpeed", 150) * dt / 1000);
      this.placeMarker(m, m.sx + dx / d * stp, m.sy + dy / d * stp, dt);
    });
    this.resolveOverlaps();
    try { this.updateRefs(dt, false); this.updateSideline(dt); } catch (e) {}
    this.camPostV109(P, delta);   // v109: wide on the ball while they gather
    if (k >= P.post.ms) { P.post = null; this.markers.forEach(m => { m._post = null; m._walk = false; m._flyV112 = null; m._flySpinV112 = 0; if (m.forceState === "idle") m.forceState = null; });   // v112: nobody carries a flight into the next snap
      this._camSoftV109 = performance.now() + TU("camSoftMs", 900);   // v109: the next reset re-aims instead of snapping — the glide carries the frame to the new line
      this.resetCamera(); this.complete(); }
  }
  /* ===== v109 THE CREW SPOTS THE BALL, AND THE STICKS MOVE =====
   * The crew whistled and pointed but nobody went to the ball, and the chain crew on the v78
   * sideline stood where the last snap put it. Now setSpot sends the nearest FREE official
   * (the whistler is already busy) to the spot at a run (`refSpotSpd`); he arrives beside the
   * ball, points the offense's way (`pointSeq`, `refSpotHoldMs`) as the ball settles, then goes
   * back to his role. On a first down the down marker and both rods walk to the new line
   * (`chainWalkMs`); a row flagged `measure` brings both wing officials in to the spot with the
   * chain drawn between them for `measureHoldMs`. `__V109_E.spots` counts the spots. */
  refSpotV109(x, y) {
    const P = this.play; if (!P || P._refSpotV109 || !TU("refSpotV109", 1) || REDUCED_MOTION) return;
    if (P.payload && P.payload.scored) return;             // a score is signalled, not spotted
    P._refSpotV109 = true;
    const r = this.refNearest(x, y, true); if (!r) return;
    const dir = (P.script && P.script.meta && P.script.meta.dir) || VDIR || 1;
    r._spotTgt = { x: x - dir * 6, y: y + (r.sy > y ? 14 : -14), kind: "spot", dir, hold: TU("refSpotHoldMs", 700), there: false };
    this.v109E().spots++;
  }
  measureV109(spot, dir) {
    if (!this.refs || !this.refs.length) return;
    for (const r of this.refs) if (r.role === "H" || r.role === "L") { r.forceState = null;
      r._spotTgt = { x: spot.x - dir * 4, y: spot.y + (r.role === "H" ? -16 : 16), kind: "measure", dir, hold: TU("measureHoldMs", 900), there: false }; }
    this.v109E().measures++;
  }
  chainWalkV109(spotX, dir) {
    const S = this.side; if (!S || !S.items) return 0;
    const YDF = PLAY_W / 100, adj = (x) => (VDIR > 0 ? x : FW - x), togo = spotX + dir * 10 * YDF;
    let n = 0, rod = 0;
    for (const im of S.items) { const sd = im && im._side; if (!sd || im.active === false) continue;
      let ux = null;
      if (/^down\d$/.test(sd.name)) ux = spotX; else if (sd.name === "chain_rod") ux = rod++ === 0 ? spotX - 3 : togo; else continue;
      const p = this.crowdProject(adj(ux), sd.vv), ms = TU("chainWalkMs", 900), dl = TU("chainWalkDelayMs", 350);
      // the item's contact shadow is its own object (sideShadow): the one at its depth goes with it
      let sh = null, bd = 1e9; for (const f of (S.fx || [])) { const dd = Math.abs(f.depth - (im.depth - .0006)); if (dd < 1e-6 && dd < bd) { bd = dd; sh = f; } }
      this.tweens.add({ targets: im, x: p.x, y: p.y, duration: ms, delay: dl, ease: "Sine.easeInOut" });
      if (sh) this.tweens.add({ targets: sh, x: sh.x + (p.x - im.x), y: sh.y + (p.y - im.y), duration: ms, delay: dl, ease: "Sine.easeInOut" });
      n++; }
    if (n) this.v109E().chainMoves++;
    return n;
  }
  presnapV86(P, T, dt) {
    if (P._snapAt == null) { const ev = (P.script.events || []).find(e => e && e.type === "snap"); P._snapAt = ev ? ev.t : 640; }
    const left = P._snapAt - T; if (left < 0) return;
    const qb = this.markers[8];
    // the cadence: he looks down the line one way, then squares up and claps for it
    if (qb && !qb.forceState && qb.sSm < 8) {
      const look = TU("cadenceLookMs", 520), sq = TU("cadenceSetMs", 210);
      if (left < look && left > sq) { if (!qb._presnapFace) { qb._presnapFace = true; qb.dirKey = "sd"; qb.flip = (Math.floor(P._snapAt / 97) % 2) === 0; } }
      else if (qb._presnapFace && left <= sq) { qb._presnapFace = false; qb.dirKey = qb.homeDir || "up"; qb.flip = false;
        if (qb.body) this.tweens.add({ targets: qb.body, scaleX: 1.14, scaleY: 0.92, yoyo: true, duration: 110 });
        try { (window.__V86 = window.__V86 || {}).cadences = ((window.__V86 || {}).cadences || 0) + 1; } catch (e) {} }
    }
    // receivers look in for the signal, then turn back upfield
    const qp = qb ? PJ(qb.sx, qb.sy) : null;
    this.markers.forEach((m, i) => {
      if (i >= 11 || !m.posLabel || !/^(WR|TE)$/.test(m.posLabel) || m.forceState || m.sSm > 8) return;
      const w0 = TU("wrLookMs", 640), w1 = TU("wrLookEndMs", 330);
      if (left < w0 && left > w1) { if (!m._presnapFace) { m._presnapFace = true; m.dirKey = "sd"; m.flip = qp ? qp.x > PJ(m.sx, m.sy).x : false; } }
      else if (m._presnapFace && left <= w1) { m._presnapFace = false; m.dirKey = m.homeDir || "up"; m.flip = false; }
    });
    // the defensive front sways in its stance; the offensive line holds dead still (that is a false start)
    this.markers.forEach((m, i) => { if (i < 11 || !m.isLine || !m.body) return;
      m.body.y = Math.sin(m.tms / TU("stanceSwayMs", 170) + m.num) * TU("stanceSway", 0.7); });
  }
  qbTickV86(P) {
    const qb = this.markers[8]; if (!qb || !qb.root) return;
    const dir = (P.script.meta && P.script.meta.dir) || VDIR || 1;
    const hasBall = P.snapped && P.ballHolderId === 8 && !P._thrown;
    const dropping = hasBall && P.carrierId !== 8 && !P.scrambling && (qb._spdPx || 0) > 30 && ((qb.sx - (qb.prevSx == null ? qb.sx : qb.prevSx)) * dir) < -0.15;
    qb._dropback = dropping && !qb._eyeV109;   // v109: while his eyes are on a read the quarter facing holds, not the backpedal
    // v107: the test is one frame's delta, which flickers as the interpolation crosses it — and
    // the pose flickered with it. Hold the drop a beat past the last backward step so the
    // backpedal reads as one continuous movement rather than a stutter through the run cycle.
    if (dropping) qb._dropT107 = qb.tms;
    else if (hasBall && qb._dropT107 && qb.tms - qb._dropT107 < TU("dropHoldMs", 200) && (qb._spdPx || 0) > 18) qb._dropback = true;
    if (dropping) qb._dropped = true;
    else if (qb._dropped && !qb._hitched && hasBall && (qb._spdPx || 0) < TU("hitchSpd", 26)) { qb._hitched = true;
      if (qb.body) this.tweens.add({ targets: qb.body, scaleY: 0.9, y: 2, yoyo: true, duration: TU("hitchMs", 95) });
      try { (window.__V86 = window.__V86 || {}).hitches = ((window.__V86 || {}).hitches || 0) + 1; } catch (e) {} }
    // the tuck: a scrambling QB leans into his run
    qb._lean = (P.carrierId === 8 && P.scrambling && !qb.forceState && (qb._spdPx || 0) > 40) ? (qb.flip ? 1 : -1) * TU("tuckLean", 0.16) * (qb.dirKey === "sd" ? 1 : 0.4) : 0;
    // v109 THE QUARTERBACK'S EYES: the quarter-turn to a read (qbEyeV109) comes back square to the
    // line on its own clock, and the moment he moves, is forced, or the ball is out — always before
    // the v107 wind-up, which runs right after this tick and needs him on `up`
    if (qb._eyeV109) { const E = qb._eyeV109;
      if (P.t >= E.until || qb.forceState || qb._dropback || P._thrown || P.carrierId === 8 || (qb._spdPx || 0) > 34) {
        qb._eyeV109 = null; if (!qb.forceState && qb.dirKey !== "up") { qb.dirKey = "up"; qb.flip = false; } this.v109E().eyeSnaps++; } }
  }
  /* v107 THE ARM — the release is frame 4, so the sequence has to START four frames before the
   * flight does. The legacy choreographer emits `windup` 300 ms out (one frame short of the 340
   * the six frames need) and FieldSim — the path that renders ~9 plays in 10 — emits none at
   * all, so the QB never wound up on it. Both now go through one lookahead into the script's
   * own `throw`, back-dated so frame 4 is drawn the tick the ball leaves. */
  /* ===== v109 THE FEET PLANT — the renderer looks ahead for the cut =====
   * The script is built before playback, so the field can see a cut coming the way v107 sees a
   * throw. Two to three keyframes ahead of every running man, the heading of his own recorded
   * path is compared with the heading he is on now; a swing past plantLookRad schedules the
   * registered-and-never-used `plant_<dd>` frame for plantMs with the run cadence stalled, and
   * the ordinary cut skid then takes over the moment the heading actually changes — so the
   * picture is plant, cut, drive instead of a slide between two frames. The sim's own `plant`
   * and `turn` events feed the same gate. `window.__V109_C2` is what the check reads. */
  hookV109() {
    return window.__V109_C2 || (window.__V109_C2 = { plants: 0, plantBy: {}, plantFrames: 0, lastPlant: null, turns: 0, downs: 0, downFalls: 0, jogs: 0, resumes: 0, jogFrames: 0,
      leans: { max: 0, n: 0 }, stumbles: 0, stumbleFrames: 0, face: { max: 0, flips: 0, steps: 0, n: 0 }, arms: { L: 0, R: 0 }, hurdleH: [] });
  }
  plantV109(P) {
    if (!P || !P.script || !TU("plantV109", 1) || P.t < (P.delay || 0)) return;
    const S = P.script, T = Math.max(0, P.t - (P.delay || 0)), i0 = Math.floor(T / 33), look = Math.max(2, TU("plantLookFrames", 3)), thr = TU("plantLookRad", .9), minPx = TU("plantLookMinPx", 1.6);
    if (!S.actors || i0 < 1) return;
    S.actors.forEach((a, k) => {
      const m = this.markers[k], f = a && a.frames;
      if (!m || !m.root || m.forceState || m.isLine || !f || i0 + look >= f.length || m.tms < (m._plantCoolV109 || 0)) return;
      const A = f[i0 - 1], B = f[i0], C = f[i0 + look - 1], D = f[i0 + look];
      const p0 = PJ(A.x, A.y), p1 = PJ(B.x, B.y), p2 = PJ(C.x, C.y), p3 = PJ(D.x, D.y);
      const v0x = p1.x - p0.x, v0y = p1.y - p0.y, v1x = p3.x - p2.x, v1y = p3.y - p2.y;
      if (Math.hypot(v0x, v0y) < minPx || Math.hypot(v1x, v1y) < minPx) return;   // both legs of the path must be a moving man
      let d = Math.abs(Math.atan2(v1y, v1x) - Math.atan2(v0y, v0x)); if (d > Math.PI) d = 2 * Math.PI - d;
      if (d >= thr) this.plantMarkerV109(m, "look", d);
    });
  }
  plantMarkerV109(m, src, rad) {
    const ms = TU("plantMs", 120), H = this.hookV109();
    m._plantUntilV109 = m.tms + ms; m._plantCoolV109 = m.tms + ms + TU("plantCoolMs", 260); m._plantSrcV109 = src;
    H.plants++; H.plantBy[src] = (H.plantBy[src] || 0) + 1; H.lastPlant = { src, rad: rad == null ? null : Math.round(rad * 100) / 100, t: Math.round(m.tms), who: m.num };
  }
  windupV107(P) {
    if (!P || !P.script || !TU("windupV107", 1)) return;
    const S = P.script, T = Math.max(0, P.t - (P.delay || 0));
    if (!P._thrPlanV107 || P._thrPlanV107.script !== S) {
      const list = [];
      for (const e of (S.events || [])) if (e && e.type === "throw" && e.style !== "kick" && !e.fg) list.push(e);
      P._thrPlanV107 = { script: S, list, i: 0 };
    }
    const plan = P._thrPlanV107;
    while (plan.i < plan.list.length && T >= plan.list[plan.i].t) plan.i++;
    const nx = plan.list[plan.i]; if (!nx) return;
    const lead = TU("throwFrameMs", 85) * TU("throwReleaseFrame", 4);
    if (T < nx.t - lead) return;
    const wi = P.ballHolderId != null ? P.ballHolderId : 8, m = this.markers[wi];
    if (!m || !m.root || m.forceState === "throwSeq" || m.forceState === "celebrateSeq") return;   // a celebration outranks the wind-up, as it does the get-up
    this.startThrowV107(P, m, nx, T);
  }
  startThrowV107(P, m, e, T, pump) {
    const fm = TU("throwFrameMs", 85), rf = TU("throwReleaseFrame", 4);
    // he turns on the target first: the facing picks the drawn cycle and the flip decides which
    // side of his body the arm — and the ball riding in it — comes through on
    let dir = null, tdx = null;
    if (e && e.tx != null) {
      const a = PJ(m.sx, m.sy), b = PJ(e.tx, e.ty != null ? e.ty : m.sy), dx = b.x - a.x, dy = b.y - a.y;
      tdx = Math.round(dx);
      // v108: WHICH WAY HE THROWS. A man in FRONT of him is thrown to off the rear cycles — right
      // arm through for a target to his screen-right, across the body for one to his left (the
      // dead-straight ball goes right: he is a right-hander) — and the quarterback keeps facing
      // the way he is looking. Only a target out of the cone is worth turning the whole body onto.
      const cone = TU("throwDirConeDeg", 70) * Math.PI / 180;
      if ((m.homeDir || "up") === "up" && this.textures.exists("spr_" + (m.kit || m.team) + "_up_throwR0")
          && dy < 0 && Math.atan2(Math.abs(dx), -dy) <= cone) { dir = dx < 0 ? "L" : "R"; m.dirKey = "up"; m.flip = false; }
      else this.faceMarker(m, dx, dy);
    }
    m._thrDirV108 = dir;
    m.forceState = "throwSeq"; m._dropback = false; m._lean = 0; if (!pump) P._thrown = true; m._exV108 = null;
    m.seqT = m.tms - (e && e.t != null ? Math.max(0, T - (e.t - fm * rf)) : 0);   // back-dated: frame rf lands on the flight
    if (pump) {
      /* ===== v109 THE PUMP FAKE ===== the same arm, aborted before the release: frames 0-3 play
       * exactly as a throw does (the cell's own ball on the frames that draw it, ours on the rest),
       * and the tick frame 4 would start he is back on his ready/carry pose with the ball still in
       * his hand. No record on __V107.throws, no flight, nothing for the release audit to count. */
      const tok = m._pumpV109 = (m._pumpV109 || 0) + 1; m._thrRecV107 = null;
      m._pumpAbortV109 = m.seqT + fm * rf; m._pumpSeqTV109 = m.seqT;   // on HIS clock (placeMarker aborts it there); the timer below is only a safety net
      this.time.delayedCall(fm * rf * 3, () => {
        if (m._pumpV109 !== tok) return; m._pumpV109 = 0;
        if (m.forceState === "throwSeq") { m.forceState = null; m._thrDirV108 = null; } });
      try { const B = window.__V109_B = window.__V109_B || {}; B.pumpSeqPlayed = (B.pumpSeqPlayed || 0) + 1; } catch (er) {}
      return;
    }
    const V7 = (window.__V107 = window.__V107 || { throws: [] }); v108Hook();   // v108 reads the same array back
    const rec = { facing: m.dirKey, flip: !!m.flip, dir, targetDx: tdx,
      src: dir ? THROW_DIR_V108[dir] : ((RIB.throwV107 && RIB.throwV107[m.dirKey]) || null),
      frames: [], releaseFrame: rf, relMs: null, flightStartMs: null, residualMs: null };
    m._thrRecV107 = P._thrRecV107 = rec;
    V7.throws.push(rec); if (V7.throws.length > 24) V7.throws.shift();
  }
  /* v108 THE EXCHANGE — the same lookahead as the arm, one event earlier in the play. The reach
   * has to START two frames (a pitch three) before the sim hands the ball over, so the frame that
   * lets go of it is the frame the ball leaves. A script with no warning falls back to starting at
   * the event itself, which at least plays the release and the empty hand. */
  tossCallV108(P) { return TOSS_CALL_V108.test(String(P && P.payload && P.payload.desc || "")); }
  exchangeV108(P) {
    if (!P || !P.script || !P.snapped || !TU("exchangeV108", 1)) return;   // he cannot reach with it before he has it
    const S = P.script, T = Math.max(0, P.t - (P.delay || 0));
    if (!P._exPlanV108 || P._exPlanV108.script !== S) {
      const list = [];
      for (const e of (S.events || [])) if (e && e.type === "handoff") list.push(e);
      P._exPlanV108 = { script: S, list, i: 0 };
    }
    const plan = P._exPlanV108;
    while (plan.i < plan.list.length && T >= plan.list[plan.i].t) plan.i++;
    const nx = plan.list[plan.i]; if (!nx) return;
    // v118: the reach goes to the side the back is on, and it is a HAND only if he is in reach.
    // A back off his LEFT takes the mirrored handoff (`handoffL_up`, the same drawing turned
    // round — two hands on the ball through the reach, so no hand is the wrong one; the pitch is
    // not mirrored, because a pitch is thrown and he throws right-handed, so a far or called toss
    // to his left is the two-handed reach with the ball flown as a pitch). To his right, a back
    // still out of arm's reach after the mesh step (`P._meshV118.far`), or a called sweep, gets
    // the underhand pitch; only a back the step actually reached gets the hand.
    const m = this.markers[P.ballHolderId != null ? P.ballHolderId : 8];
    const bk = (S.actors && S.actors[9] && S.actors[9].frames) || null;
    const bf = bk ? bk[Math.max(0, Math.min(bk.length - 1, Math.round(nx.t / 33)))] : (this.markers[9] || null);
    const sdx = m && bf ? Math.round(PJ(bf.x, bf.y).x - PJ(m.sx, m.sy).x) : null;
    const left = sdx != null && sdx < TU("exchangeSideMinPx", -3), toss = this.tossCallV108(P) || !!(P._meshV118 && P._meshV118.far);
    const E = EX_V108[left ? "handoffL" : toss ? "toss" : "handoff"], fm = E.ms(), lead = fm * E.rel;
    if (T < nx.t - lead) return;
    plan.i++;   // decided once, on the frame the reach is due — not re-tested every frame after it
    this.startExchangeV108(P, m, E, fm, Math.max(0, T - (nx.t - lead)), nx.t, sdx);
  }
  /* ===== v118 THE MESH — the quarterback goes to the back =====
   * The sim stages no mesh: at its `handoff` event the back is standing in his alignment, five to
   * seven yards to the quarterback's side, and neither man has moved since the snap — so the ball
   * crossed that gap on its own in a fifth of a second, and every handoff read as a short pass
   * whatever the arm was doing. The picture now closes the gap the way a quarterback does: from
   * the snap he steps toward where the back will be at the event, as far as a jog allows in the
   * time the script gives him (`meshMaxYdPerS` over the snap-to-event window, capped at
   * `meshStepYd`, never inside `meshReachYd` of the back), holds there through the reach, and
   * eases back onto his own path after. It is an OFFSET on his drawn position, in script units,
   * planned once per script off the frames themselves — nothing in the sim moves, no yard changes.
   * What the step cannot close decides the picture: a back still out of arm's reach at the event
   * is PITCHED to (the toss cycle and the toss flight), because a ball crossing five yards of
   * grass is a pitch whatever the call sheet says; a back the step reached gets the hand.
   * `window.__V118` is the hook. */
  meshV118(P) {
    if (!P || !P.script || !TU("meshV118", 1)) return;
    const S = P.script;
    if (P._meshV118 !== undefined && (!P._meshV118 || P._meshV118.script === S)) return;   // planned once per script
    P._meshV118 = null;
    const ev = (S.events || []).find(e => e && e.type === "handoff"), snap = (S.events || []).find(e => e && e.type === "snap");
    const f8 = S.actors && S.actors[8] && S.actors[8].frames, f9 = S.actors && S.actors[9] && S.actors[9].frames;
    if (!ev || !f8 || !f9 || !f8.length || !f9.length) return;
    const at = (f, t) => f[Math.max(0, Math.min(f.length - 1, Math.round(t / 33)))];
    const q = at(f8, ev.t), b = at(f9, ev.t), t0 = (snap ? snap.t : Math.max(0, ev.t - 300)) + TU("meshDelayMs", 60);
    const ydPx = PLAY_W / 100, gx = b.x - q.x, gy = b.y - q.y, gap = Math.hypot(gx, gy);
    const reach = TU("meshReachYd", 2.2) * ydPx, win = Math.max(0, ev.t - t0) / 1000;
    const step = Math.max(0, Math.min(gap - reach, TU("meshMaxYdPerS", 6.5) * ydPx * win, TU("meshStepYd", 5) * ydPx));
    const ux = gap > 0.01 ? gx / gap : 0, uy = gap > 0.01 ? gy / gap : 0;
    P._meshV118 = { script: S, t0, t1: ev.t, ox: ux * step, oy: uy * step, gap, step, far: gap - step > reach + 0.5 };
    const V = window.__V118 = window.__V118 || { meshes: 0, far: 0, near: 0, last: null, steps: [] };
    V.meshes++; if (P._meshV118.far) V.far++; else V.near++;
    V.last = { gapYd: +(gap / ydPx).toFixed(2), stepYd: +(step / ydPx).toFixed(2), winMs: Math.round(ev.t - t0), far: P._meshV118.far };
    V.steps.push(V.last); if (V.steps.length > 24) V.steps.shift();
  }
  meshOffsetV118(P, T) {
    const M = P._meshV118; if (!M || !(M.step > 0)) return null;
    const hold = TU("meshHoldMs", 220), back = TU("meshReturnMs", 550); let w;
    if (T <= M.t0) return null;
    else if (T < M.t1) { const k = (T - M.t0) / Math.max(1, M.t1 - M.t0); w = k * k * (3 - 2 * k); }
    else if (T < M.t1 + hold) w = 1;
    else { const k = Math.min(1, (T - M.t1 - hold) / back); w = 1 - k * k * (3 - 2 * k); }
    if (!(w > 0.001)) return null;
    const V = window.__V118; if (V) V.offsetFrames = (V.offsetFrames || 0) + 1;
    return { x: M.ox * w, y: M.oy * w, w };
  }
  startExchangeV108(P, m, E, fm, over, eventT, sideDx) {
    if (!m || !m.root || m.forceState) return;                       // a throw, a celebration or a fall outranks the exchange
    if (m.dirKey !== "up" || !this.textures.exists("spr_" + (m.kit || m.team) + "_up_" + E.st + "0")) return;   // rear-view art only
    m.forceState = "handSeq"; m.seqT = m.tms - over; m._dropback = false; m._lean = 0;
    m._exV108 = { st: E.st, cyc: E.cyc, n: E.n, rel: E.rel, fm };
    const V8 = v108Hook(), arr = E.st === "toss" ? V8.tosses : V8.handoffs;
    arr.push({ t: Math.round(P.t), eventT: eventT == null ? null : Math.round(eventT), frameAtEvent: null, toss: E.st === "toss", mirror: E.st === "handoffL", sideDx: sideDx == null ? null : sideDx });
    if (arr.length > 24) arr.shift();
  }
  addWearV86(x, y, r, a) {
    const W = this.wearV86 || (this.wearV86 = []);
    for (const w of W) if (Math.abs(w.x - x) < 9 && Math.abs(w.y - y) < 7) { w.n = Math.min(8, w.n + 1); w.r = Math.max(w.r, r); return; }
    W.push({ x, y, r, a, n: 1 });
    if (W.length > TU("wearMax", 160)) W.shift();
  }
  drawWearV86(et) {
    if (!this.wearG) this.wearG = this.add.graphics().setDepth(0.9);
    const q = et && et.quarter != null ? Number(et.quarter) : null;
    if (q != null) { if (this._wearQ != null && q < this._wearQ) this.wearV86 = []; this._wearQ = q; }   // a new game starts on fresh turf
    const g = this.wearG; g.clear();
    for (const w of (this.wearV86 || [])) { const p = PJ(w.x, w.y);
      g.fillStyle(0x5e4b2c, Math.min(0.42, w.a * w.n)).fillEllipse(p.x, p.y + 6 * p.s, w.r * 2.2 * p.s, w.r * 1.1 * p.s); }
  }

  actorIdx(id) { return id ? (id[0] === "o" ? +id.slice(3) : 11 + +id.slice(3)) : -1; }
  finishYd(e) {
    const P = this.play;
    if (!P || !P.ydTxt || P.ydDone || !(P.ydShown > 0)) return;
    P.ydDone = true;
    const yt = P.ydTxt;
    yt.setText("+" + P.ydShown + " YD");
    /* ===== v112 THE YARDAGE AND THE CALLOUT DO NOT SHARE A PIXEL =====
     * The ticker is drawn on the CANVAS at the carrier; a v95 stage badge is a DOM card placed over
     * the same point in the same instant — the badge lanes keep badges off each other, but neither
     * one can see the other, so a big hit that ends a play printed "+28 YD" straight through "OFF
     * HIS FEET". Whichever of the two arrives second is the one that must move: the ticker is the
     * number, it is read in a glance, and the badge is the sentence. So when a stage badge is up as
     * the ticker pops, the ticker starts `badgeYdLiftPx` higher — the same pop, over the pile
     * instead of through the card. Nothing moves when no badge is showing. ===== */
    try { if (BADGE_V95.current) yt.y -= TU("badgeYdLiftPx", 34); } catch (e) {}
    this.tweens.add({ targets: yt, scale: TU("finishPop",2.0), duration: 200, ease: "Back.easeOut", onComplete: () => {
      this.tweens.add({ targets: yt, y: yt.y - 28, alpha: 0, duration: 560, delay: 300, onComplete: () => this.dropFx(yt) });
    } });
    const cm = this.markers[P.carrierId];
    this.flash(cm ? cm.sx : e.x, cm ? cm.sy : e.y, 0xf0bb45);
    this.puffFx(cm ? cm.sx : e.x, cm ? cm.sy : e.y, 3, 0xffe9ad, 0.55);
    vib(22);
  }
  actorIdxSafe(m) { return this.markers.indexOf(m); }
  clearLand() { const P = this.play; if (P && P.landG) { this.dropFx(P.landG); P.landG = null; } }
  /* ===== v102 THE MOMENT SLOWS DOWN =====
   * v37's cinematic beat was REACTIVE: the catch event fired, then the clock dropped to half
   * speed for a second — so the thing you were meant to see had already happened by the time
   * the picture slowed, and the slow second was mostly the receiver jogging away. The whole
   * play is scripted before it runs, so the renderer can read the moments ahead of time.
   * `slomoV102` looks down the event list for the next one worth slowing for — the catch
   * point (the contest, the high-point, the grab), the moves (juke, spin, stiff-arm, hurdle,
   * truck, the broken tackle), the collisions (the big hit, the pancake, the sack), the ball
   * changing hands (the pick, the strip, the swat) and the score — and eases the play clock
   * DOWN toward it over `slomoLeadMs`, holds it slow through the beat, then eases back up over
   * `slomoTailMs`. Each moment names its own floor: a truck slows harder than a first down.
   * Two moments back to back share one window, and a cooldown keeps a busy play from being
   * one long replay. On screen it is read as slow motion, not lag: a letterbox drops in with
   * the clock, a ring pulls onto the men involved, and a zoom punch lands on the beat.
   * Render-only, like everything here — the sim decided the play long before the clock bent. */
  slomoV102(P, delta) {
    if (!P || !P.script || !TU("slomoV102", 1) || REDUCED_MOTION) { this.slomoDrawV102(P, 1, null); return 1; }
    const S = P.script, T = Math.max(0, P.t - (P.delay || 0));
    const BOOK = this.slomoBookV102 || (this.slomoBookV102 = {
      catch: .45, highpoint: .4, contest: .5, pick: .35, swat: .5, fumble: .4, td: .45,
      cut: .4, stiffarm: .4, hurdle: .36, brokenTackle: .42, stagger: .5,
      tackleHit: .45, pancake: .42, toetap: .4,
      gripBreak: .34, secondEffort: .42, pileOn: .55 });   // v103: the moments the grip creates
    // a `cut` is only a moment when it is a MOVE — the sim names the kind (juke, spin, a
    // stutter); an ordinary route cut or a lane change is not
    const isMove = (e) => e.type !== "cut" || /juke|spin|stutter|hesi|hurdle|truck/i.test(String(e.kind || ""));
    const lead = TU("slomoLeadMs", 340), tail = TU("slomoTailMs", 300), floorK = TU("slomoFloorK", 1);
    // THE PLAN, once per play: every moment in the script, grouped into windows, and only the
    // biggest few kept — a play is a highlight or two, not a replay of everything in it. Without
    // the cap a busy play slowed four or five times and a game ran minutes long.
    if (!P._sloPlan || P._sloPlan.script !== S) {
      const cands = [], ev = S.events;
      for (let j = 0; j < ev.length; j++) {
        const e = ev[j], w = BOOK[e.type]; if (!w || !isMove(e)) continue;
        const last = cands[cands.length - 1];
        if (last && e.t <= last.end + TU("slomoMergeMs", 420) && e.t - last.start <= TU("slomoMaxMs", 900)) {
          last.end = e.t; last.floor = Math.min(last.floor, w * floorK); last.kinds.push(e.type);
          for (const key of ["who", "by", "carrier", "off", "def", "to"]) if (e[key] != null) last.who.push(e[key]);
        } else cands.push({ start: e.t, end: e.t, floor: w * floorK, kinds: [e.type], who: [e.who, e.by, e.carrier, e.off, e.def, e.to].filter((x) => x != null) });
      }
      // the biggest moments first (the lowest floor is the hardest slow), then back into time order,
      // and no two closer than the cooldown
      const keep = [], n = Math.max(0, Math.round(TU("slomoMaxPerPlay", 2)));
      for (const c of cands.slice().sort((a, b) => a.floor - b.floor || a.start - b.start)) {
        if (keep.length >= n) break;
        if (keep.some((k) => Math.abs(k.start - c.start) < TU("slomoCoolMs", 1400))) continue;
        keep.push(c);
      }
      keep.sort((a, b) => a.start - b.start);
      P._sloPlan = { script: S, wins: keep, i: 0 };
      try { const V = window.__SLOMO_V102 = window.__SLOMO_V102 || { windows: 0, kinds: {}, minRate: 1, plays: 0 }; V.plays = (V.plays || 0) + 1; V.windows += keep.length; V.lastPlan = { cands: cands.length, kept: keep.length }; for (const k of keep) for (const kd of k.kinds) V.kinds[kd] = (V.kinds[kd] || 0) + 1; } catch (e) {}
    }
    const plan = P._sloPlan;
    while (plan.i < plan.wins.length && T > plan.wins[plan.i].end + tail) plan.i++;
    const W = plan.wins[plan.i];
    if (!W || T < W.start - lead) { this.slomoDrawV102(P, 1, null); return 1; }
    let k = 1;
    if (T < W.start) k = 1 - (1 - W.floor) * this.easeV102(Math.max(0, 1 - (W.start - T) / lead));          // easing down into it
    else if (T <= W.end) k = W.floor;                                                                       // through the beat
    else k = W.floor + (1 - W.floor) * this.easeV102(Math.min(1, (T - W.end) / tail));                      // and back up
    if (T >= W.start && !W.punched) { W.punched = true; this.zoomPunch = Math.max(this.zoomPunch, TU("slomoPunch", 0.1)); }
    try { const V = window.__SLOMO_V102; if (V) { V.minRate = Math.min(V.minRate, k); V.live = { k: +k.toFixed(3), kinds: W.kinds, T: Math.round(T), start: Math.round(W.start), end: Math.round(W.end) }; } } catch (e) {}
    this.slomoDrawV102(P, k, W);
    return k;
  }
  easeV102(q) { q = Math.max(0, Math.min(1, q)); return q < .5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2; }
  // the read: a letterbox that drops with the clock (a DOM overlay on the field — a camera-fixed
  // graphic would still take the follow camera's zoom), and a ring on the men in the moment
  slomoDrawV102(P, k, W) {
    if (!this.add) return;
    const on = k < 0.98 && W;
    const depth = on ? Math.min(1, (1 - k) / Math.max(0.05, 1 - (W.floor || .4))) : 0;   // 0..1: how deep into the slow we are
    try {
      let el = this._slomoEl;
      if (!el || !el.isConnected) {
        const wrap = document.querySelector('#screen .field-wrap') || (document.querySelector('#field') && document.querySelector('#field').parentElement);
        if (wrap) { el = wrap.querySelector('.rib-slomo-v102'); if (!el) { el = document.createElement('div'); el.className = 'rib-slomo-v102'; el.innerHTML = '<i></i><i></i><b>SLOW MOTION</b>'; wrap.appendChild(el); } this._slomoEl = el; }
      }
      if (el) { el.style.setProperty('--k', depth.toFixed(3)); el.classList.toggle('on', depth > 0.02);
        if (on && W.kinds && el._kinds !== W.kinds.join()) { el._kinds = W.kinds.join(); el.querySelector('b').textContent = (W.kinds[0] || '').replace(/([A-Z])/g, ' $1').toUpperCase() + ' · SLOW MOTION'; } }
      try { const V = window.__SLOMO_V102 = window.__SLOMO_V102 || { windows: 0, kinds: {}, minRate: 1 }; V.bars = { depth: +depth.toFixed(3), on: !!(el && el.classList.contains('on')) }; V.maxDepth = Math.max(V.maxDepth || 0, depth); } catch (e) {}
    } catch (e) {}
    if (!this.slomoRing || !this.slomoRing.scene) this.slomoRing = this.add.graphics().setDepth(TU("slomoRingDepth", 3.9));
    const r = this.slomoRing; r.clear();
    if (!on) return;
    const ids = [...new Set(W.who)];
    for (const id of ids) {
      const idx = typeof id === "number" ? id : this.actorIdx(id); const m = idx >= 0 ? this.markers[idx] : null;
      if (!m || !m.root) continue;
      const rad = (TU("slomoRingR", 14) + 3 * Math.sin(performance.now() / 120)) * (m.root.scale || 1);
      r.lineStyle(2, 0xf0bb45, 0.7 * depth); r.strokeEllipse(m.root.x, m.root.y + 22 * (m.root.scale || 1), rad * 2, rad * 0.9);
    }
  }
  slowMoment(P, scale=TU("cinematicScale",0.5), realMs=TU("cinematicMs",1000)) {
    if(!P)return;
    const now=performance.now();
    // One decisive beat per contact/catch sequence. A catch event a few frames
    // after its high-point does not extend the effect into a long replay.
    if((P.slowMoUntilReal||0)>now)return;
    P.slowMoScale=scale; P.slowMoUntilReal=now+realMs;
  }
  markerPlaneCross(m, plane, dir) {
    if(!m)return null;
    const x0=m.prevSx==null?m.sx:m.prevSx,y0=m.prevSy==null?m.sy:m.prevSy,x1=m.sx,y1=m.sy;
    const beyond=dir>0?x1>=plane:x1<=plane;
    if(!beyond)return null;
    const den=x1-x0,q=Math.max(0,Math.min(1,Math.abs(den)<1e-6?1:(plane-x0)/den));
    return {x:plane,y:y0+(y1-y0)*q};
  }

  fireEvent(e, P) {
    const pay = P.payload;
    this.crowdReact(e, P);      // v57: the stands hear every play
    try { this.sideReact(e); } catch (er) {}   // v79: so does the bench

    switch (e.type) {
      /* ===== v109 THE RECEIVER FINDS THE BALL ===== */
      case "ballTrack": { const m = this.markers[this.actorIdx(e.who)]; if (m) m._trackV109 = true;   // his head may turn now
        try { const B = window.__V109_B = window.__V109_B || {}; B.trackDrawn = (B.trackDrawn || 0) + 1; (B.tracks = B.tracks || []).push({ ms: e.ms, late: !!e.late, shoulder: e.shoulder }); if (B.tracks.length > 60) B.tracks.shift(); } catch (er) {}
        break; }
      case "reach": {
        // THE HANDS GO UP before the ball gets there: he faces it and the drawn sequence for this KIND
        // of catch starts now; `catch` will only confirm the ball, and if nothing does they come down empty
        const m = this.markers[this.actorIdx(e.by)]; if (!m) break;
        const fs = m.forceState; if (fs && fs !== "catch" && fs !== "grab" && !/^(catchSeq|diveCatchSeq|catchseqSeq)$/.test(fs)) break;   // a man on the ground does not reach
        const a = PJ(m.sx, m.sy), b = PJ(e.x, e.y); if (Math.hypot(b.x - a.x, b.y - a.y) > 2) this.faceMarker(m, b.x - a.x, b.y - a.y);
        const kit = m.kit || m.team, face3 = m.dirKey === "dn" ? "dn" : (m.dirKey === "dr" || m.dirKey === "sd") ? "dr" : "up", CS = RIB.catchseqV109 || {};
        m._reachV109 = { kind: e.kind, at: e.at, t: m.tms }; m._preCatch = false; m._handfight = false; m._lookAt = null; m._tuckV109 = 0;
        if (e.kind === "dive") { m.forceState = "diveCatchSeq"; m.seqT = m.tms; m._launchT0 = m.tms; m._launchUntil = m.tms + 285; m._launchH = 5; }
        else if (this.textures.exists("spr_" + kit + "_" + face3 + "_catchseq0_0")) { m._csVarV109 = (CS[e.kind] || CS.stride || {})[face3] || 0; m.forceState = "catchseqSeq"; m.seqT = m.tms;
          if (e.kind === "high") { m._launchT0 = m.tms; m._launchUntil = m.tms + TU("catchHopMs", 300); m._launchH = TU("catchHopH", 12); } }
        else { m.forceState = "catchSeq"; m.seqT = m.tms; }
        // nothing confirming the ball means the sequence simply runs out with no tuck — the hands
        // come down empty on his own clock; this timer only drops the flag, well after (the play
        // clock runs slower than the wall's: basePlayRate, the slow-motion moment)
        const tok = m._reachV109, T9 = Math.max(0, P.t - (P.delay || 0));
        this.time.delayedCall((Math.max(120, (e.at || T9) - T9) + TU("reachEmptyMs", 260)) * 4, () => { if (m._reachV109 === tok) m._reachV109 = null; });
        try { const B = window.__V109_B = window.__V109_B || {}; B.reachDrawn = (B.reachDrawn || 0) + 1; (B.reachKindsDrawn = B.reachKindsDrawn || {})[e.kind] = (B.reachKindsDrawn[e.kind] || 0) + 1; } catch (er) {}
        break;
      }
      case "pump": {
        // THE PUMP FAKE: the arm to the cock and back, the ball never leaving the hand; the zone man who bit plants
        const qb = this.markers[P.ballHolderId != null ? P.ballHolderId : 8];
        try { const B = window.__V109_B = window.__V109_B || {}; B.pumpEvents = (B.pumpEvents || 0) + 1; if (!qb || !qb.root || qb.forceState) (B.pumpBail = B.pumpBail || {})[String(qb && qb.forceState)] = ((B.pumpBail || {})[String(qb && qb.forceState)] || 0) + 1; } catch (er) {}
        if (!qb || !qb.root || qb.forceState) break;
        const fm = TU("throwFrameMs", 85), rf = TU("throwReleaseFrame", 4), T9 = Math.max(0, P.t - (P.delay || 0));
        // the arm belongs to the REAL throw first: v107 arms it fm*rf before the release and refuses
        // to start while anything else holds forceState, so a fake that would still be running then
        // is not drawn at all (the sim's own gate keeps them apart too — this is the belt)
        const nxThr = ((P.script && P.script.events) || []).find(ev => ev && ev.type === "throw" && ev.style !== "kick" && !ev.fg && ev.t >= T9);
        if (nxThr && nxThr.t - T9 < fm * rf * 2 + TU("pumpClearMs", 60)) { try { const B = window.__V109_B; B.pumpTooLate = (B.pumpTooLate || 0) + 1; } catch (er) {} break; }
        this.startThrowV107(P, qb, { tx: e.tx != null ? e.tx : e.x + 60, ty: e.ty != null ? e.ty : e.y, t: T9 + fm * rf }, T9, true);
        const zm = e.frozen ? this.markers[this.actorIdx(e.frozen)] : null; if (zm && !zm.forceState) zm.cutUntil = zm.tms + (e.ms || 120);
        this.popText(e.x, e.y - 24, "PUMP", "#f7e2a8", 11);
        break; }
      case "comeback": {
        // the ball is short of him: he plants and works back to it (the pop only when he read it)
        const m = this.markers[this.actorIdx(e.who)]; if (!m) break;
        if (!m.forceState) { m.cutUntil = m.tms + TU("comebackPlantMs", 150); const b = PJ(e.x, e.y); m._lookAt = { x: b.x, y: b.y }; }
        if (e.smart) this.popText(e.x, e.y - 22, "WORKS BACK", "#bfe3ae", 11);
        try { const B = window.__V109_B = window.__V109_B || {}; B.comebacks = (B.comebacks || 0) + 1; } catch (er) {}
        break; }
      case "boxOut": {
        // he puts his body between the man and the ball: squared up on the defender, hands on him, the defender off the spot
        const m = this.markers[this.actorIdx(e.who)], d = this.markers[this.actorIdx(e.on)]; if (!m) break;
        if (d) { const a = PJ(m.sx, m.sy), b = PJ(d.sx, d.sy);
          if (!m.forceState) { if (Math.hypot(b.x - a.x, b.y - a.y) > 2) this.faceMarker(m, b.x - a.x, b.y - a.y); m.forceState = "grab"; m._boxV109 = true;
            this.time.delayedCall(TU("boxOutMs", 220), () => { if (m._boxV109) { m._boxV109 = false; if (m.forceState === "grab") m.forceState = null; } }); }
          if (!d.forceState) { d.cutUntil = d.tms + 200; this.puffFx(d.sx, d.sy, 1, 0xdce7f3, 0.3); } }
        this.popText(e.x, e.y - 22, "BOXES HIM OUT", "#bfe3ae", 11);
        try { const B = window.__V109_B = window.__V109_B || {}; B.boxOuts = (B.boxOuts || 0) + 1; } catch (er) {}
        break; }
      case "catch": {
        this.clearLand();
        P.carrierId = this.actorIdx(e.by);
        P.ballHolderId = P.carrierId; P.ballMode = "held"; P.__looseBall = false;
        // the contesting defender lost the ball battle — he stumbles out of the rep
        if (P.contestDef != null && P.contestDef !== P.carrierId) {
          const lm = this.markers[P.contestDef];
          if (lm) { lm.forceState = null; lm.cutUntil = lm.tms + 260; this.puffFx(lm.sx, lm.sy, 2); }
          P.contestDef = null; P.awaitCatch2 = null;
        }
        const cm = this.markers[P.carrierId];
        // v21.2 HIGH-POINT CATCH: the receiver LEAPS for the ball (arms-up catch cell
        // + a launch-parabola hop) instead of a flat static grab, then settles.
        if (cm) { const diving=e.catchType==="dive";
          /* v109 THE HANDS WENT UP ALREADY: a reach has the drawn sequence running, so the catch only
           * CONFIRMS the ball (no restart, no second hop); then THE TUCK — catchhold for catchTuckMs
           * once the sequence lands, before the run cycle resumes. A catch nothing reached for (a
           * legacy script) starts the sequence here as it always did. */
          const running = cm._reachV109 && /^(catchseqSeq|catchSeq|diveCatchSeq)$/.test(String(cm.forceState));
          if (!running) { cm._preCatch=false; cm.forceState = diving?"diveCatchSeq":"catchSeq"; cm.seqT=cm.tms;
            cm._launchT0 = cm.tms; cm._launchUntil = cm.tms + (diving?285:TU("catchHopMs", 300)); cm._launchH = diving?5:(e.catchType==="high"?TU("catchHopH", 12):7); }
          cm._reachV109 = null;
          const seqMs = cm.forceState === "catchseqSeq" ? 4 * TU("catchSeqFrameMs", 75) : cm.forceState === "diveCatchSeq" ? 3 * 95 : 3 * 90;
          cm._tuckV109 = (cm.seqT || cm.tms) + seqMs + TU("catchTuckMs", 160);
          try { const B = window.__V109_B = window.__V109_B || {}; B.catchHoldHeld = (B.catchHoldHeld || 0) + 1; if (running) B.catchConfirmed = (B.catchConfirmed || 0) + 1; } catch (er) {} }
        P.awaitCatch = null;
        this.flash(e.x, e.y, 0xf0bb45);
        this.puffFx(e.x, e.y, 2, 0xffe9ad, 0.55);
        this.hitStop = Math.max(this.hitStop, 55); this.zoomPunch = Math.max(this.zoomPunch, 0.16);
        if(e.catchType==="high"||e.catchType==="dive")this.slowMoment(P);
        vib(30);
        break;
      }
      case "handoff": P.carrierId = 9; P.ballHolderId = 9; P.ballMode = "held"; this.handV105(P, "handoff"); break;   // v105: the exchange is drawn — a hand, or a toss
      case "windup": { P.ballHolderId = 8; P.ballMode = "held"; P._thrown = true; const qb = this.markers[8];
        // v107: the lookahead has normally started the arm 340ms back — this only catches a script with no throw of its own
        if (qb && qb.forceState !== "throwSeq") this.startThrowV107(P, qb, null, Math.max(0, P.t - (P.delay || 0))); break; }
      case "contest": { P.awaitCatch2 = this.actorIdx(e.def); P.contestDef = P.awaitCatch2; break; }
      case "handfight": {
        const om=this.markers[this.actorIdx(e.off)], dm=this.markers[this.actorIdx(e.def)];
        [om,dm].forEach(m=>{ if(m && !m._reachV109){ m.forceState="grab"; m._handfight=true;   // v109: a man already reaching keeps his hands up
          this.time.delayedCall(170,()=>{ if(m._handfight){m._handfight=false;if(m.forceState==="grab")m.forceState=null;} }); }});
        this.puffFx(e.x,e.y,2,0xdce7f3,0.3);
        break;
      }
      case "highpoint": {
        const om=this.markers[this.actorIdx(e.off)], dm=this.markers[this.actorIdx(e.def)];
        [om,dm].forEach((m,i)=>{ if(m){ m._handfight=false; m._preCatch=true; m.forceState="catch";
          m._launchT0=m.tms; m._launchUntil=m.tms+(e.deep?280:210); m._launchH=e.deep?(i?10:12):(i?7:9);
          this.time.delayedCall(e.deep?250:190,()=>{if(m._preCatch){m._preCatch=false;if(m.forceState==="catch")m.forceState=null;}}); }});
        if(e.deep)this.slowMoment(P);
        break;
      }
      case "snap": { P.snapped = true; if (this.previewG) this.previewG.clear();
        P.ballHolderId = 8; P.ballMode = "held";
        // v105: the ball leaves the center's hands and zaps back to the QB's — a real snap. Kicks
        // keep the sim's own long-snap flight (the ball frames carry it); a kickoff has no snap.
        if (!e.kickoff && !/^(fg|punt|kickoff|xp)$/i.test(String(P.payload && P.payload.event || ""))) this.handV105(P, "snap");
        // and a man who is hot says so, once, when he takes the field with it
        try { const Sd = this._heatSaidV105 || (this._heatSaidV105 = {}); for (const idx of [8, 9, 0, 1, 2, 10]) { const k = this.heatKeyV105(P, idx), m = this.markers[idx];
          if (m && this.hotV105(P, idx) && !Sd[k]) { Sd[k] = 1; this.popText(m.sx, m.sy - 26, "ON FIRE!", "#ff9a3c", 13); this.puffFx(m.sx, m.sy + 2, 2, 0xff8a3a, 0.5); }
          else if (m && !this.hotV105(P, idx)) delete Sd[k]; } } catch (er) {}
        if (this.previewTxt) { this.previewTxt.forEach(t => t && t.destroy && t.destroy()); this.previewTxt = []; }
        this.markers.forEach((m) => { if (m.forceState === "stance") m.forceState = null; if (m.body) m.body.y = 0; if (m._presnapFace) { m._presnapFace = false; m.dirKey = m.homeDir || m.dirKey; m.flip = false; } });   // v86
        try { this.addWearV86(P.losX != null ? P.losX : e.x, (F_TOP + F_BOT) / 2, 12, 0.03); } catch (er) {}   // v86: the trenches wear the turf between the hashes
        break; }
      case "pick": {
        this.clearLand();
        P.carrierId = this.actorIdx(e.by);
        P.ballHolderId = P.carrierId; P.ballMode = "held"; P.__looseBall = false;
        // the receiver lost this one — beaten at the catch point
        if (P.contestDef != null) {
          const lw = this.markers[P.contestDef === P.carrierId ? -1 : P.contestDef];
          if (lw) { lw.forceState = null; lw.cutUntil = lw.tms + 260; }
          P.contestDef = null; P.awaitCatch2 = null;
        }
        const pm = this.markers[P.carrierId];
        // v21.2: the defender high-points the pick too — leap + settle
        if (pm) { pm._preCatch=false; pm.forceState = "catchSeq"; pm.seqT=pm.tms; pm._launchT0 = pm.tms; pm._launchUntil = pm.tms + 270; pm._launchH = 10; }
        P.awaitCatch = null;
        BADGE_V95.show("intercepted", { x: e.x, y: e.y, scene: this, token: "int:" + P.__ballTokenV1514 });   // v95
        this.hitStop = Math.max(this.hitStop, 70);
        this.slowMoment(P);
        REDUCED_MOTION || this.cameras.main.shake(140, 0.005); break;
      }
      /* ===== v109 THE FEET PLANT — the sim's plant, turn, down and effort ===== */
      case "plant": { const m = this.markers[this.actorIdx(e.who)];
        if (m && !m.forceState && !(m._plantUntilV109 > m.tms)) this.plantMarkerV109(m, "sim", e.deg != null ? e.deg * Math.PI / 180 : null); break; }
      case "turn": { const m = this.markers[this.actorIdx(e.who)]; this.hookV109().turns++;
        if (m && !m.forceState && !m.isLine && (e.deg || 0) >= TU("turnPlantDeg", 60) && !(m._plantUntilV109 > m.tms)) this.plantMarkerV109(m, "turn", (e.deg || 0) * Math.PI / 180); break; }
      case "down": {
        // he goes DOWN: the fall frame facing along his slide, the turf until the sim's own clock, and
        // the existing get-up takes him off it. A man the truck or the pancake already dropped keeps
        // that fall; only the clock is set
        const m = this.markers[this.actorIdx(e.who)], H = this.hookV109(); H.downs++;
        if (m && m.root) {
          const fallMs = TU("fallMs", 160), untilMs = Math.max(fallMs + 120, (e.until || 0) - (e.t || 0));
          m._downUntilV109 = m.tms + untilMs; m._downCauseV109 = e.cause;
          if (!m.forceState || m.forceState === "grab") { H.downFalls++; this.unpair(this.actorIdx(e.who));
            if (e.dx != null) { const a = PJ(m.sx, m.sy), b = PJ(m.sx + e.dx * 10, m.sy + (e.dy || 0) * 10); this.faceMarker(m, b.x - a.x, b.y - a.y); }
            m.forceState = "fall"; m._lean = 0; m._leanSrc = null; m._leanV109 = 0;
            this.time.delayedCall(fallMs, () => { if (m.forceState === "fall") m.forceState = null; }); }   // then cadenceV109 holds "down" to the clock
          this.time.delayedCall(untilMs, () => { if (m.forceState === "down") m.forceState = null; });
        }
        break; }
      case "effort": {
        // a real case at last: the jog is a slowed cycle, the man who gave up walks, and `resume`
        // puts the full cadence back the moment the play comes back to him
        const m = this.markers[this.actorIdx(e.who)], H = this.hookV109();
        if (m) { m._effortV109 = e.kind === "resume" ? null : e.kind; if (e.kind === "resume") H.resumes++; else H.jogs++; }
        break; }
      case "cut": {
        const isSpin = e.kind === "spin", isStep = e.kind === "sidestep";   // v139
        this.popText(e.x, e.y - 22, isSpin ? "SPIN!" : isStep ? "SIDE STEP!" : "JUKE!", "#8fe7ff", 14);
        const cm2 = this.markers[P.carrierId];
        if (cm2) {
          // v24: FLUIDITY scales with the carrier's elusiveness (agility+quickness,
          // rode in on the event). An elite back's move is crisp and fast to recover;
          // a low-rated one is slower, wobblier, and hangs in the cut longer.
          const flu = mt.Math.Clamp(((e.elus != null ? e.elus : 55) - 30) / 55, 0, 1);
          cm2.cutUntil = cm2.tms + (300 - flu * 130);            // higher rating recovers quicker
          if(!isSpin){cm2.forceState="jukeSeq";cm2.seqT=cm2.tms;}
          this.skidFx(e.x, e.y); this.puffFx(e.x, e.y, 2);
          try { this.addWearV86(e.x, e.y, 4, 0.05); } catch (er) {}   // v86: a planted foot tears the turf
          // a spin whips the body around; a juke throws a sharp lateral lean-and-recover.
          if (cm2.body) {
            if (isSpin) {
              this.tweens.add({ targets: cm2.body, angle: (Math.random()<0.5?360:-360), duration: 360 - flu*150, ease: flu>0.6 ? "Cubic.Out" : "Sine.InOut", onComplete: () => { if (cm2.body) cm2.body.setAngle(0); } });
            } else {
              const dir = Number(e.direction)|| (Math.random()<0.5?1:-1);
              /* v139: a side step is a short, flat shuffle off one foot — it travels FURTHER
               * sideways than a juke and leans almost none, where a juke is a hard lean-and-go */
              const wide = isStep ? TU("stepWideV139", 1.8) : 1, tilt = isStep ? TU("stepTiltV139", .3) : 1;
              this.tweens.add({ targets: cm2.body, x: (cm2.body.x||0) + dir*(3 + flu*4)*wide, angle: dir*(12 + flu*10)*tilt, duration: (130 - flu*55)*(isStep?1.25:1), yoyo: true, ease: "Sine.InOut", onComplete: () => { if (cm2.body) { cm2.body.setAngle(0); } } });
            }
          }
        }
        break;
      }
      case "stiffarm": {
        // the carrier wards the tackler off — defender is shoved back and stumbles down
        const carrier = this.markers[P.carrierId >= 0 ? P.carrierId : this.actorIdx(e.carrier)];
        if(carrier){carrier.forceState="stiffSeq";carrier.seqT=carrier.tms;}
        const tk = this.markers[this.actorIdx(e.who)];
        // v109: the ARM is the side he came from (`e.side`, or where the two of them stand): the
        // carrier leans into the shove, the tackler is thrown down facing away from it
        const sa9 = this.sideV109(e, carrier, tk); this.hookV109().arms[sa9 > 0 ? "R" : "L"]++;
        if (carrier) { carrier._lean = sa9 * TU("stiffLean", .14); carrier._leanSrc = "stiff"; this.time.delayedCall(300, () => { if (carrier._leanSrc === "stiff") { carrier._leanSrc = null; carrier._lean = 0; } }); }
        if (tk && tk.dirKey !== "up" && tk.dirKey !== "dn") tk.flip = sa9 > 0;
        if (tk) { tk.forceState = "grab";
          this.time.delayedCall(160, () => { if (tk.active !== false) tk.forceState = "down"; });
          this.time.delayedCall(760, () => { if (tk.forceState === "down") tk.forceState = null; }); }
        this.popText(e.x, e.y - 22, "STIFF ARM!", "#ffd97a", 14);
        this.slowMoment(P);
        this.puffFx(e.x, e.y, 2); vib(16);
        break;
      }
      case "stagger": {
        // grazing arm-tackle: the runner is knocked off-stride but stays up; the
        // defender stumbles a beat. Bumps read as real contact, not a clean stop.
        const tk = this.markers[this.actorIdx(e.who)];
        if (tk) { tk.forceState = "grab"; this.time.delayedCall(300, () => { if (tk.forceState === "grab") tk.forceState = null; }); }
        const cm3 = this.markers[P.carrierId >= 0 ? P.carrierId : this.actorIdx(e.carrier)];
        // v109: the stumble — a broken stride on the hurt frames at half cadence, leaning AWAY from
        // the arm that grazed him, then the run comes back
        if (cm3) { this.stumbleV109(cm3, this.sideV109(e, cm3, tk), TU("stumbleMs", 250)); this.tweens.add({ targets: cm3.body, scaleX: 0.78, yoyo: true, duration: 110 }); }
        this.popText(e.x, e.y - 20, "SHAKES IT OFF!", "#bfe3ae", 12);
        this.puffFx(e.x, e.y, 1);
        break;
      }
      case "sprint": {
        // a burst is triggered — arm the draining stamina bar over that player's head
        const m = this.markers[this.actorIdx(e.who)];
        if (m) { m._sprintEnd = P.t + (e.dur || 500); m._sprintDur = e.dur || 500; }
        break;
      }
      case "gassed": {
        // v20: this player started the play with an empty tank — he's moving slow
        const m = this.markers[this.actorIdx(e.who)];
        if (m) { m._gassedV20 = true;
          if (m.team === "you") this.popText(e.x, e.y - 24, "GASSED 🥵", "#8fb7d6", 12); }
        break;
      }
      case "gassedOut": {
        // v20: the tank just hit empty — the recovery clock starts now
        const m = this.markers[this.actorIdx(e.who)];
        if (m && m.team === "you") this.popText(m.sx, m.sy - 26, "TANK EMPTY — " + (e.plays || 5) + " PLAYS TO RECOVER", "#ff9a9a", 12);
        break;
      }
      case "swim": {
        // a defensive end beats the tackle with a quick finesse move
        const m = this.markers[this.actorIdx(e.who)];
        this.unpair(this.actorIdx(e.who));   // v83
        if (m) { m.forceState = null; m.cutUntil = m.tms + 200; m.body && m.body.setTint(0xbfe0ff);
          this.time.delayedCall(360, () => { m.body && m.body.clearTint(); }); }
        this.popText(e.x, e.y - 20, "SWIM MOVE!", "#8fe7ff", 13);
        this.puffFx(e.x, e.y, 2);
        break;
      }
      case "beaten": {
        const m = this.markers[this.actorIdx(e.who)];
        if (m) { m.body.setAlpha(0.55); this.time.delayedCall(600, () => m.body && m.body.setAlpha(1)); }
        break;
      }
      /* ===== v103 THE GRAB, DRAWN — the two of them travel as one thing =====
       * The sim now holds the carrier in a grip and writes the tackler's position from his,
       * so the recorded frames already carry the pair moving together. This is the LOOK of it:
       * the tackler locks on with the grab pose, the carrier leans hard into the drag and keeps
       * his legs going, a scuff of turf comes up under them for as long as it lasts, and the
       * pile that gathers rides along behind. It ends on the ordinary `tackle` event, which
       * folds them both — the difference is that by then they have covered real ground. */
      case "grab": {
        const tk = this.markers[this.actorIdx(e.who)], cm = this.markers[this.actorIdx(e.carrier)];
        if (tk) { tk.forceState = "grab"; tk._whiffed = false; tk._launchUntil = 0; tk._grabT = tk.tms; }
        if (cm) {
          cm._dragging = true;                                   // read by placeMarker for the lean and the scuff
          cm._lean = (cm.flip ? 1 : -1) * TU("dragGripLean", 0.2);
          cm.forceState = null;                                  // his legs are still going: keep the run cycle
        }
        P.gripPair = { tk: this.actorIdx(e.who), cm: this.actorIdx(e.carrier), t: 0 };
        // v109: the wrap lands AT the point of contact, the scuff squashed along the hit's normal
        this.puffFx(Number.isFinite(e.ix) ? e.ix : e.x, Number.isFinite(e.iy) ? e.iy : e.y, 2, 0xcfe0d2, 0.42);
        this.hitFx(e.x, e.y, false, false, e);
        this.hitStop = Math.max(this.hitStop, TU("grabHitStop", 26));
        try { const V = window.__V103 = window.__V103 || {}; V.grabs = (V.grabs || 0) + 1; } catch (er) {}
        break;
      }
      case "pileOn": {
        // another man gets hands on and rides along — he latches, he does not tackle
        const a = this.markers[this.actorIdx(e.who)];
        if (a) { a.forceState = "grab"; a._launchUntil = 0;
          // v109 THE PILE HAS A SHAPE: posed from the bearing he arrived on — facing along it into
          // the heap, leaning in — and kept facing the carrier through the hold like a wrapped-in man
          if (Number.isFinite(e.angle)) { const p0 = PJ(e.x, e.y), p1 = PJ(e.x + Math.cos(e.angle) * 10, e.y + Math.sin(e.angle) * 10);
            this.faceMarker(a, p1.x - p0.x, p1.y - p0.y); a._lean = (p1.x >= p0.x ? 1 : -1) * TU("pileLean", .14); }
          const cmI = this.actorIdx(e.carrier); if (cmI >= 0 && this.markers[cmI]) { a._pair = cmI; a._pairT = a.tms; }
          a._wrapInV109 = P.t; }
        this.puffFx(e.x, e.y, 2 + Math.min(2, Math.round(Number(e.mom || 0) / 60)), 0xc8d6cb, 0.34);   // v109: a heavier man kicks up more
        this.hitStop = Math.max(this.hitStop, TU("pileHitStop", 18));
        this.hookV109C1().pileOns++;
        try { const V = window.__V103 = window.__V103 || {}; V.pileOn = (V.pileOn || 0) + 1; } catch (er) {}
        break;
      }
      case "gripBreak": {
        // he ripped out of the wrap and the play is live again
        const tk = this.markers[this.actorIdx(e.who)], cm = this.markers[this.actorIdx(e.carrier)];
        if (tk) { tk.forceState = "stagger"; this.time.delayedCall(320, () => { if (tk.forceState === "stagger") tk.forceState = null; }); }
        if (cm) { cm._dragging = false; cm._lean = 0; cm.forceState = null; }
        P.gripPair = null;
        this.popText(e.x, e.y - 30, "OUT OF THE TACKLE!", "#57e07a", 13);
        BADGE_V95.show("bigplay", { sub: "REFUSED TO GO DOWN", x: e.x, y: e.y, scene: this });
        this.puffFx(e.x, e.y, 4, 0xffe9ad, 0.5); vib(24);
        this.slowMoment(P, TU("breakSlow", 0.45), 700);
        try { this.crowdReact({ type: "brokenTackle", x: e.x }, P); } catch (er) {}
        try { const V = window.__V103 = window.__V103 || {}; V.breaks = (V.breaks || 0) + 1; } catch (er) {}
        break;
      }
      case "secondEffort": {
        // a yard from the marker, still on his feet, still driving
        this.popText(e.x, e.y - 34, "SECOND EFFORT", "#f0bb45", 12);
        this.puffFx(e.x, e.y + 4, 3, 0x8a7a55, 0.45);
        try { this.crowdReact({ type: "firstdown", x: e.x }, P); } catch (er) {}
        try { const V = window.__V103 = window.__V103 || {}; V.strains = (V.strains || 0) + 1; } catch (er) {}
        break;
      }
      case "horseCollar": {
        this.popText(e.x, e.y - 30, "BY THE COLLAR", "#e0484f", 12);
        break;
      }
      case "tackleLunge": {
        // v17 TACKLE LAUNCH — the closer commits from ~50% further out and LEAPS into
        // the carrier: a dive pose + an airborne hop (placeMarker lifts the whole sprite
        // along a parabola) so a stop reads as a real launch, not a step-in wrap.
        const tk = this.markers[this.actorIdx(e.who)];
        if (tk) {
          const L = this.lungeV139(e);   // v139: a man closing at speed leaves his feet; a step-in wrap does not
          /* v143: and WHERE he aimed decides the shape of it — a cut block is long and flat along
           * the ground, a chest hit is short and tall. One number, and the three tackles read as
           * three different moves from the stands. */
          const aimK = e.aim === "low" ? TU("lungeLowHKV143", .5) : e.aim === "high" ? TU("lungeHighHKV143", 1.45) : 1;
          const aimMs = e.aim === "low" ? TU("lungeLowMsKV143", 1.18) : e.aim === "high" ? TU("lungeHighMsKV143", .88) : 1;
          const Lms = Math.round(L.ms * aimMs);
          tk.forceState = "dive"; tk._launchT0 = tk.tms; tk._launchUntil = tk.tms + Lms; tk._launchH = L.h * aimK;
          this.time.delayedCall(Lms, () => { if (tk.forceState === "dive" && !tk._whiffed) tk.forceState = null; });
        }
        // a whoosh trail sells the launch — a low dive scrapes up more of it
        this.puffFx(e.x, e.y, e.aim === "low" ? 4 : 2, 0xdfe8ef, e.aim === "low" ? 0.46 : 0.38);
        break;
      }
      case "tackleWindup": {
        /* v143: he breaks down before he goes. A man who is SET plants and gathers (a puff at his
         * feet, the dust of a man sinking his hips); a RUSHED man is still sprinting and gets
         * nothing — which is the tell that the lunge coming next is a wild one. */
        // the longer he had to gather, the more he kicks up planting his feet
        if (e.set) this.puffFx(e.x, e.y, (e.need || 0) > 170 ? 3 : 2, 0xc8d4e0, 0.3);
        break;
      }
      case "hurdle": {
        // v18: the carrier LEAPS clean over a low tackle attempt — big airborne arc
        const hm = this.markers[this.actorIdx(e.carrier)];
        // v109: how HIGH he goes is the sim's clearance (the spring he had over the wrap); the man
        // under him dives on toward the side he came from
        const cl9 = typeof e.clearance === "number" ? Math.max(0, Math.min(1, (e.clearance + 12) / 40)) : 0.6, h9 = Math.round(TU("hurdleHMin", 16) + (TU("hurdleHMax", 30) - TU("hurdleHMin", 16)) * cl9);
        if (hm) { hm.forceState="hurdleSeq"; hm.seqT=hm.tms; hm._launchT0 = hm.tms; hm._launchUntil = hm.tms + 460; hm._launchH = h9; const HH = this.hookV109().hurdleH; HH.push(h9); if (HH.length > 24) HH.shift(); }
        const htk = this.markers[this.actorIdx(e.who)];
        if (htk && htk.dirKey !== "up" && htk.dirKey !== "dn") htk.flip = this.sideV109(e, hm, htk) < 0;
        if (htk) { htk.forceState = "dive"; this.time.delayedCall(220, () => { if (htk.active !== false) htk.forceState = "down"; });
          this.time.delayedCall(820, () => { if (htk.forceState === "down") htk.forceState = null; }); }
        this.popText(e.x, e.y - 26, "HURDLED!", "#8fe7ff", 14);
        this.slowMoment(P);
        this.puffFx(e.x, e.y, 2);
        break;
      }
      /* ===== v109 THE GANG CONVERGES (renderer) =====
       * A supporter the sim nudged into the heap closes on screen too: the grab pose facing the
       * carrier, and a one-way pair so placeMarker keeps him turned to the man through the hold.
       * The `tackle` case then folds every wrapped-in man a beat after the tackler, so the pile
       * forms ON the whistle instead of freezing apart with one man wrapping. */
      case "wrapIn": {
        const sm = this.markers[this.actorIdx(e.who)], cmI = this.actorIdx(e.carrier), cm = this.markers[cmI];
        if (sm && cm && sm !== cm) {
          sm.forceState = "grab"; sm._launchUntil = 0; sm._whiffed = false; sm._wrapInV109 = P.t;
          const p0 = PJ(sm.sx, sm.sy), p1 = PJ(cm.sx, cm.sy); this.faceMarker(sm, p1.x - p0.x, p1.y - p0.y);
          sm._lean = (p1.x >= p0.x ? 1 : -1) * TU("wrapInLean", .12);
          sm._pair = cmI; sm._pairT = sm.tms;                    // one-way: the carrier keeps his own pairing
          this.puffFx(e.x, e.y, 1, 0xcfe0d2, 0.35);
        }
        this.hookV109C1().wrapIns++;
        break;
      }
      /* ===== v109 THE PILE HAS A HEARTBEAT (renderer) =====
       * `drag` arrives every ~99ms while the grip travels. Both men churn — feet driving, a short
       * bob on the body — at a cadence set by the pull and slowed as the pile grows, and the
       * carrier's lean deepens with every man on his back. */
      case "drag": {
        const tk = this.markers[this.actorIdx(e.by)], cm = this.markers[this.actorIdx(e.carrier)];
        const n = Math.max(1, Number(e.n || 1)), pull = Math.max(.05, Number(e.pull || .1));
        const cad = Math.round(TU("dragChurnMs", 130) * (1 + (n - 1) * TU("dragPileSlowK", .35)) * Math.min(1.6, Math.max(.6, .3 / pull)));
        const amp = TU("dragChurnPx", 1.5) * Math.min(1.4, .5 + pull * 2);
        const bodies = [tk, cm].filter(mm => mm && mm.body).map(mm => mm.body);
        if (bodies.length && !REDUCED_MOTION) this.tweens.add({ targets: bodies, y: -amp, duration: Math.max(40, cad / 2), yoyo: true, ease: "Sine.easeInOut",
          onComplete: () => bodies.forEach(b => { if (b.active !== false) b.y = 0; }) });
        if (cm) { cm._dragging = true; cm._lean = (cm.flip ? 1 : -1) * (TU("dragGripLean", 0.2) + (n - 1) * TU("dragPileLeanK", .06)); }
        if (e.strain) this.puffFx(e.x, e.y + 4, 1, 0x8a7a55, 0.4);
        const V = this.hookV109C1(); V.drags++; V.lastDrag = { n, pull, cad, strain: !!e.strain, cid: e.cid };
        P.__dragV109 = { t: P.t, n, pull, cad };
        break;
      }
      /* ===== v109 THE FUMBLE COMES LOOSE (renderer) =====
       * `looseBall` opens the loose window the ball block draws (the oval, the jittered bounce —
       * deterministic per play from the ball token); `recover` closes it with the man diving on. */
      case "looseBall": {
        const tok = String(P.__ballTokenV1514 || e.t || 0), seed = tok.split("").reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 9973, 7);
        P.__looseV109 = { t0: P.t, x: e.x, y: e.y, vx: Number(e.vx || 0), vy: Number(e.vy || 0), seed, cid: e.cid };
        this.puffFx(e.x, e.y, 2, 0xffe9ad, 0.5);
        this.popText(e.x, e.y - 30, "BALL IS LOOSE!", "#ff9fa5", 14);
        this.hookV109C1().loose++;
        break;
      }
      /* ===== v109 BALL SECURITY IS VISIBLE (renderer) =====
       * A bobble he secures: the carrier clutches (the catch-hold cell when the kit has one, the
       * catch pose otherwise) while the ball hops off the hand and comes back. The nudge is applied
       * on `postupdate`, after the ball block has mounted the ball this frame, so nothing is fought. */
      case "ballLoose": {
        const m = this.markers[this.actorIdx(e.who)], ms = Math.max(120, Number(e.ms || 260));
        if (m && !m.forceState) {
          const kit = m.kit || m.team, clutch = this.textures.exists("spr_" + kit + "_" + m.dirKey + "_catchhold") ? "catchhold" : "catch";
          m.forceState = clutch; this.time.delayedCall(ms, () => { if (m.active !== false && m.forceState === clutch) m.forceState = null; });
        }
        if (this.ballSpr && !REDUCED_MOTION) {
          const t0 = P.t, side = Number(e.side || 1) || 1, hop = TU("bobbleHopPx", 7), out = TU("bobbleOutPx", 5);
          const fn = () => { const spr = this.ballSpr; if (!spr || spr.active === false || this.play !== P) { this.events.off("postupdate", fn); return; }
            const f = (P.t - t0) / ms; if (f >= 1) { this.events.off("postupdate", fn); return; }
            const s = Math.sin(Math.PI * Math.max(0, f)), sc = spr.scaleX ? Math.abs(spr.scaleX) / .4 : 1;
            spr.y -= hop * s * sc; spr.x += side * out * Math.sin(Math.PI * 2 * Math.max(0, f)) * sc; spr.rotation += s * .9; };
          this.events.on("postupdate", fn);
        }
        this.popText(e.x, e.y - 28, "BOBBLED — SECURED", "#f7e2a8", 12);
        this.hookV109C1().bobbles++;
        break;
      }
      case "tackleHit": {
        // the lunge landed — wrap him up. v29: the grab HOLDS while the carrier fights
        // (the tackle event that follows re-arms it into the fall) instead of a blink.
        // v109: the scuff is at the point of contact
        this.puffFx(Number.isFinite(e.ix) ? e.ix : e.x, Number.isFinite(e.iy) ? e.iy : e.y, 1, 0xdfe8ef, 0.36);
        const tk = this.markers[this.actorIdx(e.who)];
        if (tk) { tk._whiffed = false; tk.forceState = "grab"; this.time.delayedCall(TU("wrapGrabMs",700), () => { if (tk.forceState === "grab") tk.forceState = null; }); }
        this.slowMoment(P);
        break;
      }
      case "tackleWhiff": {
        // the lunge missed — the defender hits the turf and the runner slips past
        const tk = this.markers[this.actorIdx(e.who)];
        if (tk) { tk._whiffed = true; tk.forceState = "dive";
          /* v139: he does not snap to the turf a fifth of a second after leaving his feet — he
           * finishes the arc he is already in, LANDS on it (the puff, the skid and the wear are
           * the landing, not the miss), lies there a beat and gets up like any other down man. */
          const air = Math.max(0, (tk._launchUntil || 0) - tk.tms);
          const fall = Math.max(TU("whiffFallMsV139", 170), air);
          this.time.delayedCall(fall, () => { if (tk.active === false) return;
            tk.forceState = "down"; tk._launchUntil = 0; tk._launchH = 0;
            this.puffFx(tk.sx, tk.sy, 3); this.skidFx(tk.sx, tk.sy);
            try { this.addWearV86(tk.sx, tk.sy, 6, .08); } catch (er) {} });
          this.time.delayedCall(fall + TU("whiffDownMsV139", 580), () => {
            if (tk.forceState === "down") { tk.forceState = "getupSeq"; tk.seqT = tk.tms; tk._whiffed = false; } }); }
        this.popText(e.x, e.y - 22, "MISSED TACKLE!", "#8fe7ff", 12);
        this.puffFx(Number.isFinite(e.ix) ? e.ix : e.x, Number.isFinite(e.iy) ? e.iy : e.y, 2);   // v109: where he reached and missed
        break;
      }
      case "tackle": {
        this.slowMoment(P);
        this.camHitV112(P, e);   // v112: the hit is its own, smaller step out, before the whistle opens up
        const big = e.bigHit || (pay.yards ?? 0) <= 0;
        const bump = Number(e.kb || 0);
        // v109 THE HIT HAS A POINT: the rings, the scuff, the wear and the shake all ride the
        // sim's impact point and its weight — a routine wrap barely moves the frame
        const ixV109 = Number.isFinite(e.ix) ? e.ix : e.x, iyV109 = Number.isFinite(e.iy) ? e.iy : e.y;
        const impK = Math.min(1, Math.max(0, Number(e.impact || 0)) / TU("impactShakeRef", 90));
        REDUCED_MOTION || this.cameras.main.shake(big ? 190 : 110, (big ? (bump >= 10 ? 0.011 : 0.008) : 0.004) * (0.7 + impK * 0.6));
        if (big) this.hitStop = Math.max(this.hitStop, TU("hitStopBig", bump >= 10 ? 110 : 80));
        if (bump >= 10) this.popText(e.x, e.y - 56, "LEVELED!", "#ff9fa5", 15);
        const mine = P.script.meta.featured && P.script.meta.featured.isMe && e.tackler === P.script.meta.featured.actorId;
        if (mine) { this.flash(e.x, e.y, 0xf0bb45); this.popText(e.x, e.y - 44, "YOUR TACKLE!", "#f0bb45", 13); }
        this.hitFx(e.x, e.y, big, !!e.bigHit, e); vib(big ? 40 : 18);
        this.puffFx(ixV109, iyV109, big ? 4 : 2);
        this.setSpot(e.x, e.y);
        this.finishYd(e);
        const m = this.markers[P.carrierId >= 0 ? P.carrierId : this.actorIdx(e.carrier)];
        const tk = this.markers[this.actorIdx(e.tackler)];
        // v112 THE HIT HAS WEIGHT: the sim measured this collision and said the carrier left his
        // feet. When it did, the ballistic arc owns his pose, his lift and his landing — every
        // fixed-height fold below (the style, the hit stick) stands aside for it.
        const willFly112 = !!(m && TU("flyV112", 1) && e.flyWho && e.flyWho === e.carrier && Number(e.flyVz) > 0);
        try { this.addWearV86(ixV109, iyV109, (big ? 9 : 6) * (0.8 + impK * 0.5), 0.08); } catch (er) {}   // v86: the turf remembers the pile (v109: where the bodies met)
        /* v86 TACKLE STYLES — read off the geometry the sim already resolved. Where the
         * tackler is relative to the carrier's heading says what kind of tackle it was:
         * from behind is a drag-down, square with knock-back is a knock-back, low or from
         * the side at speed is a fall forward. A scrambling QB caught past the line slides. */
        let tstyle = null, slide = false;
        if (m && tk && !e.hitStick) {
          const kb = Number(e.kb || 0), speed = m.sSm || 0, dirP = P.script.meta.dir || 1;
          if (P.carrierId === 8 && P.scrambling && !e.sack && kb < 4 && Math.random() < TU("slideP", 0.75)) slide = true;
          else {
            const hd = m.hd != null ? m.hd : Math.atan2(0, dirP), ang = Math.atan2(tk.sy - m.sy, tk.sx - m.sx);
            let rel = Math.abs(ang - hd); if (rel > Math.PI) rel = 2 * Math.PI - rel;   // 0 = the tackler is ahead of him, PI = behind
            if (rel > Math.PI * 0.62 && !e.gang && speed > TU("dragSpd", 30)) tstyle = "drag";
            else if (rel < Math.PI * 0.4 && (kb >= TU("knockKb", 5) || big)) tstyle = "knock";
            else if (speed > TU("fallFwdSpd", 95) && (e.style === "low" || rel > Math.PI * 0.35)) tstyle = "forward";
          }
          try { const V = (window.__V86 = window.__V86 || {}); const key = slide ? "slides" : tstyle ? tstyle + "s" : "plain"; V[key] = (V[key] || 0) + 1; } catch (er) {}
        }
        P.scrambling = false;
        /* ===== v146 A THEY GO DOWN TOGETHER (renderer) =====
         * `F146` is decided once, here: whether this is the one tackle the hitter walks away from
         * (the hit stick / a launch), and when the CARRIER starts to fall — the wrap beat on a plain
         * stop (longer on a sack, where the rusher wraps and twists him down), the drag or the
         * knock-back where v86 already read one — so the tackler's fold can be timed off it. The
         * contact itself is guaranteed upstream (`contactV146` walks the named man onto him before
         * the event); `__V146R` measures what was actually drawn on the frame he went down. */
        const F146 = (TU("togetherV146", 1) && m && tk && !slide) ? {
          stick: !!(e.hitStick || willFly112),
          foldMs: tstyle === "drag" ? TU("dragMs", 240) + Number(e.kb || 0) * 20 : tstyle === "knock" ? TU("knockMs", 150)
            : tstyle === "forward" ? TU("fallFwdMs", 260) : e.sack ? TU("sackWrapMsV146", 220) : TU("wrapBeatMsV146", 110)
        } : null;
        try { const R = window.__V146R = window.__V146R || { downs: 0, far: 0, maxD: 0, stick: 0, together: 0, sacks: 0, samples: [] };
          if (m) { R.downs++; if (e.sack) R.sacks++;
            const dd = tk ? Math.hypot(tk.sx - m.sx, tk.sy - m.sy) : 999; R.maxD = Math.max(R.maxD, Math.round(dd * 10) / 10);
            if (dd > TU("contactPxV146", 9) + 3) { R.far++; if (R.samples.length < 10) R.samples.push({ d: Math.round(dd), sack: !!e.sack, why: e.v146 && e.v146.why, fs: !!P.script.meta.fieldSim }); }
            if (F146) F146.stick ? R.stick++ : R.together++; } } catch (er) {}
        // v103: the grip is over — clear the drag look, and say what the drag was worth
        try { const cmD = this.markers[P.carrierId]; if (cmD) { cmD._dragging = false; } } catch (er) {}
        P.gripPair = null;
        if (e.dragged) {
          const dy = Number(e.dragYd || 0);
          try { const V = window.__V103 = window.__V103 || {}; V.drags = (V.drags || 0) + 1; V.dragYd = (V.dragYd || 0) + dy; } catch (er) {}
          if (dy >= TU("dragCallYd", 2)) {
            this.popText(e.x, e.y - 46, "CARRIED HIM " + dy.toFixed(1) + " YD", "#f0bb45", 12);
            BADGE_V95.show("bigplay", { sub: "CARRIED HIM", x: e.x, y: e.y, scene: this });
          } else if (e.strain) this.popText(e.x, e.y - 46, "DROVE FOR IT", "#f0bb45", 12);
        }
        if (e.horseCollar) this.popText(e.x, e.y - 58, "HORSE COLLAR?", "#e0484f", 12);
        if (slide && tk) {
          // he gives himself up: a low forward slide, and the man over him pulls up
          m.forceState = "dive"; m._launchT0 = m.tms; m._launchUntil = m.tms + TU("slideMs", 260); m._launchH = 3; m._lean = 0;
          this.time.delayedCall(TU("slideMs", 260), () => { if (m.active !== false && m.forceState === "dive") m.forceState = "down"; });
          this.time.delayedCall(TU("slideMs", 260) + 420, () => { if (m.forceState === "down") m.forceState = null; });
          tk.forceState = "grab"; this.time.delayedCall(260, () => { if (tk.forceState === "grab") tk.forceState = null; });
          this.popText(e.x, e.y - 24, "SLIDES", "#8fe7ff", 12);
          break;
        }
        if (tk) {
          // fast closers launch a flying tackle; otherwise it's a jersey-grab drag-down,
          // then the tackler folds to the turf and STAYS down — the pile holds until the
          // next snap resets the formation (no popping back up to idle mid-replay).
          // v29 INTRICATE TACKLES: the wrap is a visible GRAB held for the whole
          // drag/drive/knockback phase — the longer the carrier fights (drive or kb),
          // the longer the tackler hangs on before both fold with the tackleSeq arc.
          const holdMs = TU("grabHoldMs",260) + Math.max(Number(e.drive||0), Number(e.kb||0)) * TU("grabHoldK",30);
          if (F146) {
            /* v146 A: the hitter who laid the hit stick is the ONE man who stays up — he stands in
             * his grab through the collision and runs on (the script walks him through). Everyone
             * else goes down WITH the man he tackled: a low aim leaves his feet at the legs, the
             * rest wrap, and his fold is timed off the carrier's own (F146.foldMs) so the two of
             * them hit the grass together instead of one of them a quarter-second late. */
            if (F146.stick) { tk.forceState = "grab"; tk._lean = 0;
              this.time.delayedCall(TU("stickHoldMsV146", 260), () => { if (tk.active !== false && tk.forceState === "grab") tk.forceState = null; }); }
            else {
              tk.forceState = (e.style === "low" || (e.gang !== true && Math.random() < TU("diveChance",0.4) && e.style !== "high")) ? "dive" : "grab";
              if (tk.forceState === "dive") { tk._launchT0 = tk.tms; tk._launchUntil = tk.tms + Math.max(120, F146.foldMs); tk._launchH = e.style === "low" ? 2 : 4; }
              this.time.delayedCall(F146.foldMs + TU("tkFoldLagMsV146", 50), () => { if (tk.active !== false && tk.forceState !== "getupSeq") { tk.forceState = "tackleSeq"; tk.seqT = tk.tms; tk._lean = 0; } });
            }
          } else {
          tk.forceState = big || e.gang !== true && !e.stayUp && Math.random() < TU("diveChance",0.4) ? "dive" : "grab";
          // v30: a tackler who WON the wrap outright (stayUp) finishes on his feet,
          // standing over the runner — only the carrier goes to the turf.
          if (e.stayUp) this.time.delayedCall(holdMs + 320, () => { if (tk.active !== false && tk.forceState === "grab") tk.forceState = null; });
          else this.time.delayedCall(holdMs, () => { if (tk.active !== false && tk.forceState != null) { tk.forceState = "tackleSeq"; tk.seqT = tk.tms; } });
          }
          // a genuinely assisted stop shows it: the nearest support wrapper latches on
          // with his own grab a beat later, then joins the pile on the ground
          // v109 THE GANG CONVERGES: every man who closed in (`wrapIn` / `pileOn`) is already in
          // the heap in his grab — they fold a beat after the tackler, in order, and the one-man
          // latch below is kept only for a supporter the sim never walked in
          const supsV109 = (Array.isArray(e.sup) ? e.sup : []).map(id => this.markers[this.actorIdx(id)]).filter(sm => sm && sm !== tk && sm !== m);
          const wrappedV109 = supsV109.filter(sm => sm._wrapInV109);
          if (wrappedV109.length) wrappedV109.forEach((sm, i) => { sm.forceState = "grab";
            this.time.delayedCall(holdMs + 180 + i * TU("wrapFoldStepMs", 60), () => { if (sm.active !== false && sm.forceState === "grab") { sm.forceState = "tackleSeq"; sm.seqT = sm.tms; sm._lean = 0; } }); });
          else if (e.gang === true && supsV109.length) {
            const sm = supsV109[0];
            this.time.delayedCall(TU("supGrabMs",120), () => { if (sm.active !== false) sm.forceState = "grab"; });
            this.time.delayedCall(holdMs + 180, () => { if (sm.active !== false && sm.forceState === "grab") { sm.forceState = "tackleSeq"; sm.seqT = sm.tms; } });
          }
        }
        if (m) {
          if (willFly112) {
            // he does not fold, he is thrown: the arc, the landing and the skid (placeMarker)
            if (m.body) { this.tweens.killTweensOf(m.body); m.body.x = 0; m.body.y = 0; m.body.angle = 0; }
            this.flyStartV112(m, e.flyVz, this.sideV109(e, m, tk));
            this.popText(e.x, e.y - 68, "OFF HIS FEET", "#ff9fa5", 13);
            this.hookV112F().flying++;
          } else if (tstyle === "drag") {
            // caught from behind: he keeps his feet and his lean for a beat, then folds
            const dragMs = TU("dragMs", 240) + Number(e.kb || 0) * 20;
            m.forceState = null; m._lean = (m.flip ? 1 : -1) * TU("dragLean", 0.26);
            this.time.delayedCall(dragMs, () => { if (m.active !== false) { m._lean = 0; m.forceState = "tackleSeq"; m.seqT = m.tms; } });
          } else if (tstyle === "knock") {
            // met square: knocked backward off the spot before he goes down
            const a0 = PJ(m.sx, m.sy), a1 = PJ(m.sx - (P.script.meta.dir || 1) * TU("knockPx", 8), m.sy);
            m.forceState = null;
            if (m.body) this.tweens.add({ targets: m.body, x: a1.x - a0.x, angle: (a1.x - a0.x) > 0 ? 18 : -18, duration: TU("knockMs", 150), ease: "Quad.easeOut" });
            this.time.delayedCall(TU("knockMs", 150), () => { if (m.active !== false) { if (m.body) { m.body.x = 0; m.body.angle = 0; } m.forceState = "tackleSeq"; m.seqT = m.tms; } });
          } else if (tstyle === "forward") {
            // hit low or from the side at speed: he falls forward for the extra yard
            m.forceState = "dive"; m._launchT0 = m.tms; m._launchUntil = m.tms + TU("fallFwdMs", 260); m._launchH = 5; m._lean = 0;
            this.time.delayedCall(TU("fallFwdMs", 260), () => { if (m.active !== false && m.forceState === "dive") m.forceState = "down"; });
          } else if (F146 && !F146.stick && F146.foldMs > 0) {
            // v146 A: the wrap is SEEN before the fall — he is held up in the tackler's arms for a
            // beat (a sack twists him round with it), then the two of them go down as one
            m.forceState = null; const dirW = (tk.sx - m.sx) >= 0 ? -1 : 1;
            m._lean = dirW * TU("wrapLeanV146", 0.18);
            if (e.sack && m.body && !REDUCED_MOTION) this.tweens.add({ targets: m.body, angle: dirW * TU("sackTwistDegV146", 22), duration: F146.foldMs, ease: "Quad.easeIn" });
            this.time.delayedCall(F146.foldMs, () => { if (m.active !== false && m.forceState !== "getupSeq") { m._lean = 0; if (m.body) { this.tweens.killTweensOf(m.body); m.body.angle = 0; } m.forceState = "tackleSeq"; m.seqT = m.tms; } });
          } else {
            // the carrier visibly folds to the ground after the whistle and stays down
            m.forceState = "tackleSeq"; m.seqT = m.tms;
          }
        }
        // v25 HIT STICK (defense levels the carrier): the baked dive→down flight + a
        // heavy freeze-frame. Height geometry adds flavor: high wrap = they fold
        // together, low hit = a shoestring trip.
        if (e.hitStick && m) {
          if (!willFly112) {   // v112: a launched man is already in the air on his own arc
            m.forceState = "dive"; m._launchT0 = m.tms; m._launchUntil = m.tms + 300; m._launchH = 14;
            this.time.delayedCall(280, () => { if (m.active !== false) { m.forceState = "down"; } });
          }
          // v112: on a launch the callout waits for the LANDING — the takeover's freeze and the
          // full-field badge otherwise sit on top of the very arc they are celebrating
          if (willFly112) this.time.delayedCall(this.flyBadgeMsV112(e.flyVz), () => BADGE_V95.show("bighit", { sub: "OFF HIS FEET", x: e.x, y: e.y, scene: this }));
          else BADGE_V95.show("bighit", { sub: "HIT STICK", x: e.x, y: e.y, scene: this });   // v95
          /* v103 IMPACT WEIGHT — every big hit used to shake the camera by exactly the same
           * amount for exactly the same time. The sim already measured the collision (the
           * knock-back it produced and how many men were in it), so the picture uses it: a
           * routine wrap barely moves the frame, a genuine collision throws it. */
          const wgt = Math.min(1, (Math.abs(Number(e.kb || 0)) / 14 + (Number(e.handsOn || 0)) * .12));
          this.hitStop = Math.max(this.hitStop, TU("hitStopBig", 120) * (.7 + wgt * .7));
          this.puffFx(e.x, e.y, 4 + Math.round(wgt * 5)); vib(Math.round(32 + wgt * 30));
          REDUCED_MOTION || this.cameras.main.shake(Math.round(160 + wgt * 140), 0.008 + wgt * 0.011);
        } else if (e.style === "low") this.popText(e.x, e.y - 30, "SHOESTRING!", "#8fe7ff", 12);
        if (e.sack) BADGE_V95.show("sack", { sub: badgeYdsV95(pay.yards), x: e.x, y: e.y, scene: this, token: "sack:" + P.__ballTokenV1514 });   // v95
        else if (e.oob) this.popText(e.x, e.y - 26, "PUSHED OUT OF BOUNDS", "#8fe7ff", 13);
        else if (e.gang) this.popText(e.x, e.y - 40, e.handsOn >= 2 ? "GANG TACKLE ×" + (e.handsOn + 1) : "GANG TACKLE", "#93a0b1", 12);
        if (!(P.ydDone && Number(pay.yards ?? 0) > 0)) this.impact(e.x, e.y, Number(pay.yards ?? 0));
        break;
      }
      case "td": { this.zoomPunch = Math.max(this.zoomPunch || 0, 0.2); this.finishYd(e);
        if (Number(pay.yards ?? 0) >= TU("badgeBreakawayYds", 40) && (pay.event === "run" || pay.event === "pass")) BADGE_V95.show("breakaway", { sub: "HE'S GONE", x: e.x, y: e.y, scene: this, token: "brk:" + P.__ballTokenV1514, hold: 900 });   // v95
        // HARD RULE: the TOUCHDOWN celebration only fires once the carrier's
        // rendered position has crossed the goal line — never before.
        const dirTD = P.script.meta.scoreDir || P.script.meta.dir || 1;
        const goalX = dirTD > 0 ? PLAY_R : PLAY_L;
        const cm = this.markers[P.carrierId >= 0 ? P.carrierId : this.actorIdx(e.carrier)];
        const crossed = this.markerPlaneCross(cm,goalX,dirTD);
        if (crossed) { this.celebrate(goalX,crossed.y); vib([30,40,60]); this.endzoneFlash(); this.setSpot(goalX,crossed.y); }
        else P.pendTD = { x: goalX, y: e.y, goalX, dirTD, idx: P.carrierId >= 0 ? P.carrierId : this.actorIdx(e.carrier) };
        break;
      }
      case "score": {
        // data-inconsistent scoring play (spot short of the goal): modest flair
        // only — the full TOUCHDOWN moment is reserved for actual goal-line crossings
        this.popText(e.x, e.y - 26, "SCORING PLAY!", "#f0bb45", 16);
        this.flash(e.x, e.y, 0xf0bb45); this.setSpot(e.x, e.y);
        break;
      }
      case "incomplete": {
        this.clearLand(); P.awaitCatch2 = null; P.contestDef = null;
        P.ballHolderId = null; P.ballMode = "bounce"; P.ballReleaseAt = P.t; P._ballTumbleBase = this.ballSpr?.rotation || 0;
        P.ballBounceDir = ((P.ballSpr?.x || 0) < PJ(e.x, e.y).x ? 1 : -1);
        /* ===== v109 AN INCOMPLETION HAS A REASON ===== the pop says what happened, and a DROP is a
         * bobble: the drop variant of the drawn sequence from frame 1 (the ball already off the
         * hands), a hop, the rings at the hands. A reach nothing confirmed comes down empty. A ball
         * landing out of bounds (e.oob) is not chased off the field — he pulls up at the paint — and
         * a throwaway (e.away) gets no receiver at all. The legacy script keeps its target teleport. */
        const rs = e.reason || (e.away ? "away" : null);
        const lab = rs === "drop" ? ["DROPPED!", "#ff6b6b", 16] : (rs === "swat" || rs === "contested") ? ["BROKEN UP", "#f7e2a8", 14]
          : rs === "overthrow" ? ["OVERTHROWN", "#ff9fa5", 14] : rs === "short" ? ["SHORT", "#ff9fa5", 14] : rs === "behind" ? ["BEHIND HIM", "#ff9fa5", 14]
          : rs === "away" ? ["THROWN AWAY", "#93a0b1", 13] : ["INCOMPLETE", "#ff9fa5", 15];
        this.popText(e.x, e.y - 24, lab[0], lab[1], lab[2]);
        const ti = (rs === "drop" && e.by) ? this.actorIdx(e.by) : e.on ? this.actorIdx(e.on) : P.awaitCatch != null ? P.awaitCatch : (P.script.meta.targetId ? this.actorIdx(P.script.meta.targetId) : -1);
        const m = ti >= 0 ? this.markers[ti] : null;
        if (m && e.away) { m._reachV109 = null; if (/^(catchseqSeq|catchSeq|diveCatchSeq)$/.test(String(m.forceState))) m.forceState = null; }
        else if (m) {
          const ey = Math.max(F_TOP + 6, Math.min(F_BOT - 6, e.y + 8)), ex = e.oob ? m.sx : e.x;
          if (!e.oob || Math.abs(m.sy - ey) > 2) { const ip = PJ(ex, ey); this.tweens.add({ targets: m.root, x: ip.x, y: ip.y, duration: 200 }); m.sx = ex; m.sy = ey; }
          if (rs === "drop") {
            const kit = m.kit || m.team, face3 = m.dirKey === "dn" ? "dn" : (m.dirKey === "dr" || m.dirKey === "sd") ? "dr" : "up", CS = RIB.catchseqV109 || {};
            if (this.textures.exists("spr_" + kit + "_" + face3 + "_catchseq0_0")) { m._csVarV109 = (CS.drop || {})[face3] || 0; m.forceState = "catchseqSeq"; m.seqT = m.tms - TU("catchSeqFrameMs", 75); }
            m._tuckV109 = 0; m._launchT0 = m.tms; m._launchUntil = m.tms + 200; m._launchH = 6;
            this.hitFx(e.x, e.y - 6, false); this.puffFx(e.x, e.y - 4, 2, 0xffe9ad, 0.5); this.hitStop = Math.max(this.hitStop, 40);
            P.ballBounceDir = m.flip ? 1 : -1;
          } else if (m._reachV109 && /^(catchseqSeq|catchSeq|diveCatchSeq)$/.test(String(m.forceState))) { m.forceState = null; m.cutUntil = m.tms + 160; }
          m._reachV109 = null;
        }
        try { const B = window.__V109_B = window.__V109_B || {}; (B.incDrawn = B.incDrawn || {})[rs || "none"] = (B.incDrawn[rs || "none"] || 0) + 1; } catch (er) {}
        break;
      }
      case "shed": {
        const m = this.markers[this.actorIdx(e.who)];
        this.unpair(this.actorIdx(e.who));   // v83
        if (m) { this.flash(m.sx, m.sy, 0xff8a5c); m.body.setTint(0xffc9a8); }
        this.popText(e.x, e.y - 20, "SHEDS THE BLOCK!", "#ffb08a", 12); break;
      }
      case "contact": {
        const m = this.markers[P.carrierId >= 0 ? P.carrierId : this.actorIdx(e.carrier)];
        if (m) this.tweens.add({ targets: m.body, scaleX: 0.8, yoyo: true, duration: 90 });
        // v109: contact he runs through still breaks the stride — a short stumble away from it
        if (m && !m.forceState && !m._stumbleV109) this.stumbleV109(m, this.sideV109(e, m, this.markers[this.actorIdx(e.by)]), TU("contactStumbleMs", 160));
        break;
      }
      case "pancake": {
        this.unpair(this.actorIdx(e.who));   // v83
        const m = this.markers[this.actorIdx(e.who)];
        if (m) { m.forceState = "pancakeSeq"; m.seqT=m.tms; m.body.setAlpha(0.8); }
        this.puffFx(e.x, e.y, 3);
        this.popText(e.x, e.y - 24, "PANCAKE!", "#ffd97a", 16);
        REDUCED_MOTION || this.cameras.main.shake(130, 0.005);
        vib(25);
        break;
      }
      case "getup": {
        const m = this.markers[this.actorIdx(e.who)];
        if (m) { m.forceState="getupSeq"; m.seqT=m.tms; m.body.setAlpha(1); }
        break;
      }
      case "block": {
        this.puffFx(e.x, e.y, 1, 0xd8e6da, 0.4);
        if (e.big) { this.popText(e.x, e.y - 18, "BIG BLOCK!", "#bfe3ae", 12); REDUCED_MOTION || this.cameras.main.shake(70, 0.002); }
        const bm = this.markers[this.actorIdx(e.by)];
        if (bm) { bm.forceState = "block"; this.time.delayedCall(420, () => { if (bm.forceState === "block") bm.forceState = null; }); }
        if (e.on || e.who) this.pairUp(this.actorIdx(e.by), this.actorIdx(e.on || e.who));   // v83
        break;
      }
      case "flush": {
        this.popText(e.x, e.y - 24, "FLUSHED — QB SCRAMBLES!", "#8fe7ff", 14);
        this.zoomPunch = Math.max(this.zoomPunch || 0, 0.1);
        REDUCED_MOTION || this.cameras.main.shake(90, 0.003);
        vib(15);
        break;
      }
      case "land": break;
      case "motion": { const m = this.markers[this.actorIdx(e.who)]; if (m) this.flash(m.sx, m.sy, 0x8ec3ee); break; }
      case "playfake": this.popText(e.x, e.y - 22, e.draw ? "DRAW" : "PLAY ACTION", "#8ec3ee", 12); break;
      /* ===== v81 BALL AWARENESS — you can watch the defence find the ball =====
       * keyLook arms a "?" over a defender still reading his keys (drawn in update,
       * next to the sprint bars); keyRead drops it the tick he diagnoses the play;
       * keyBite is the wrong first step on a fake; blockWin / holeOpen are the point
       * of attack — a driven block, and the lane it opened lighting up on the turf. */
      case "keyLook": {
        const m = this.markers[this.actorIdx(e.who)];
        if (m) { m._lookUntil = e.until; m._lookBite = !!e.bite; }
        break;
      }
      case "keyRead": {
        const m = this.markers[this.actorIdx(e.who)];
        if (m) { m._lookUntil = 0; m._readAt = P.t;
          if (m.team === "you") this.popText(e.x, e.y - 26, e.bite ? "LATE — BIT ON IT" : "READS IT!", e.bite ? "#ff9a9a" : "#f0bb45", 12);
          else if (!e.bite && (P._readPops = (P._readPops || 0) + 1) <= TU("readPopMax", 2)) this.popText(e.x, e.y - 24, "!", "#e8f0f8", 14); }
        break;
      }
      case "keyBite": {
        const m = this.markers[this.actorIdx(e.who)];
        if (m) { m.forceState = null; m.cutUntil = m.tms + 220; this.puffFx(e.x, e.y, 1); }
        this.popText(e.x, e.y - 22, m && m.team === "you" ? "YOU BIT ON THE FAKE!" : "BITES!", "#ff9a9a", m && m.team === "you" ? 12 : 11);
        break;
      }
      case "blockWin": {
        const bm = this.markers[this.actorIdx(e.who)], dm = this.markers[this.actorIdx(e.on)];
        this.pairUp(this.actorIdx(e.who), this.actorIdx(e.on));   // v83
        if (bm) { bm.forceState = "block"; this.time.delayedCall(600, () => { if (bm.forceState === "block") bm.forceState = null; }); }
        if (e.kind === "drive") { this.puffFx(e.x, e.y, 2, 0xd8e6da, 0.45);
          if (dm) { dm.forceState = null; dm.cutUntil = dm.tms + 300; }
          this.popText(e.x, e.y - 18, bm && bm.team === "you" ? "YOU DRIVE HIM BACK!" : (e.lev === "lost" ? "WASHED INTO THE HOLE" : "SEALED!"), e.lev === "lost" ? "#ffb08a" : "#bfe3ae", 12); }
        else if (e.kind === "push") this.puffFx(e.x, e.y, 1, 0xd8e6da, 0.35);
        else if (e.kind === "lost" && bm && bm.team === "you") this.popText(e.x, e.y - 18, "BEATEN!", "#ff9a9a", 11);
        break;
      }
      case "holeOpen": {
        this.laneFlash(e.x, e.y);
        if (pay && pay.involved && (pay.playerPos === "RB" || pay.playerPos === "OL" || pay.playerPos === "TE")) this.popText(e.x + 10, e.y - 24, "LANE!", "#bfe3ae", 12);
        break;
      }
      case "badAngle": {
        const m = this.markers[this.actorIdx(e.who)];
        if (m) { m.forceState = null; m.cutUntil = m.tms + 160; this.puffFx(e.x, e.y, 1);
          if (m.team === "you") this.popText(e.x, e.y - 22, "BAD ANGLE", "#ff9a9a", 11); }
        break;
      }
      /* ===== v82 — the front's plan, the disguise, the pocket, the catch point, the pile ===== */
      case "stuntWin": { const m = this.markers[this.actorIdx(e.who)]; this.unpair(this.actorIdx(e.who)); if (m) { this.flash(m.sx, m.sy, 0xff8a5c); m.body && m.body.setTint(0xffc9a8); }
        this.popText(e.x, e.y - 22, "STUNT — HE'S FREE!", "#ffb08a", 13); break; }
      case "stuntPassOff": this.puffFx(e.x, e.y, 1, 0xd8e6da, 0.35); break;
      case "spyAttack": { const m = this.markers[this.actorIdx(e.who)]; if (m && m.team === "you") this.popText(e.x, e.y - 22, "SPY — GO!", "#8fe7ff", 12); break; }
      case "spy": case "protection": case "disguise": case "press": break;
      /* ===== v109 THE FRONT'S CHESS — the events the renderer ignored =====
       * pickup pairs the back (or the sliding lineman) on the blitzer in the block state; blitz
       * flashes the blitzer and leans him in; linebackerDrop holds the LB on the quarterback while he
       * retreats (his own backpedal if his kit has it for his facing, else the walk); penetrate,
       * doubleTeam, pocketSlide, spring and cutback each get a pairing / facing / flash — no text. */
      case "pickup": { const bi = this.actorIdx(e.by), oi = this.actorIdx(e.on), bm = this.markers[bi];
        this.pairUp(bi, oi);
        if (bm) { bm.forceState = "block"; this.time.delayedCall(TU("pickupBlockMs", 520), () => { if (bm.forceState === "block") bm.forceState = null; }); this.puffFx(bm.sx, bm.sy, 1, 0xd8e6da, 0.35); }
        this.caseV109("pickup"); break; }
      case "blitz": { const m = this.markers[this.actorIdx(e.who)];
        if (m) { this.flash(m.sx, m.sy, 0xff6b52); m._lean = (m.flip ? 1 : -1) * TU("blitzLean", 0.12); this.time.delayedCall(TU("blitzLeanMs", 320), () => { if (m._lean) m._lean = 0; }); }
        this.caseV109("blitz"); break; }
      case "linebackerDrop": { const m = this.markers[this.actorIdx(e.who)];
        if (m && !m.forceState) { m._dropback = true; m._walk = !this.textures.exists("spr_" + (m.kit || m.team) + "_" + (m.homeDir || "dn") + "_backpedal0");
          this.time.delayedCall(TU("lbDropMs", 900), () => { if (m._dropback) { m._dropback = false; m._walk = false; } }); }
        this.caseV109("linebackerDrop"); break; }
      case "penetrate": { const i9 = this.actorIdx(e.who), m = this.markers[i9]; this.unpair(i9);
        if (m) { this.flash(m.sx, m.sy, 0xffb08a); m.cutUntil = m.tms + 160; } this.caseV109("penetrate"); break; }
      case "doubleTeam": { const oi = this.actorIdx(e.on), dm = this.markers[oi];
        if (dm) { let best = -1, bd = TU("doubleTeamPx", 30);
          this.markers.forEach((m, i) => { if (i < 11 && m.isLine && m.root && m._pair == null) { const d = Math.hypot(m.sx - dm.sx, m.sy - dm.sy); if (d < bd) { bd = d; best = i; } } });
          if (best >= 0 && dm._pair == null) this.pairUp(best, oi);
          this.flash(dm.sx, dm.sy, 0xd8e6da); }
        this.caseV109("doubleTeam"); break; }
      case "pocketSlide": { const qb = this.markers[8]; if (qb && qb.body && !qb.forceState) this.tweens.add({ targets: qb.body, x: (VDIR > 0 ? -1 : 1) * TU("pocketSlidePx", 3), yoyo: true, duration: 170 });
        this.caseV109("pocketSlide"); break; }
      case "spring": { this.flash(e.x, e.y, 0xffe9ad); this.zoomPunch = Math.max(this.zoomPunch || 0, TU("springPunch", 0.05));
        const cm9 = P.carrierId != null ? this.markers[P.carrierId] : null; if (cm9) this.puffFx(cm9.sx, cm9.sy + 4, 2, 0x8a7a55, 0.4); this.caseV109("spring"); break; }
      case "cutback": { const cm9 = P.carrierId != null ? this.markers[P.carrierId] : null;
        if (cm9 && !cm9.forceState) { cm9.cutUntil = cm9.tms + TU("cutbackCutMs", 200); this.skidFx(cm9.sx, cm9.sy); this.puffFx(cm9.sx, cm9.sy + 3, 2, 0x8a7a55, 0.36); }
        this.caseV109("cutback"); break; }
      case "chip": { this.pairUp(this.actorIdx(e.who), this.actorIdx(e.on)); this.time.delayedCall(560, () => this.unpair(this.actorIdx(e.who))); break; }
      case "rotate": { const m = this.markers[this.actorIdx(e.who)]; if (m) this.popText(e.x, e.y - 24, "ROTATES DOWN", "#8ec3ee", 11); break; }
      case "fooled": this.popText(e.x, e.y - 24, "DISGUISED!", "#ff9a9a", 12); break;
      case "jam": { const m = this.markers[this.actorIdx(e.on)]; if (m) { m.forceState = null; m.cutUntil = m.tms + 240; }
        this.puffFx(e.x, e.y, 1); this.popText(e.x, e.y - 20, "JAMMED", "#93a0b1", 11); break; }
      case "rollout": this.popText(e.x, e.y - 22, "ROLLOUT", "#8ec3ee", 12); break;
      case "stepUp": this.popText(e.x, e.y - 22, "STEPS UP", "#bfe3ae", 11); break;
      case "swat": {
        /* ===== v109 A PASS BREAK-UP IS CONTACT ===== the arm goes THROUGH the hands: both men face the
         * ball, the defender takes the grab pose ON the catch point for swatHoldMs (pulled onto it the
         * way the receiver is on an incompletion, from the side `from` says the arm came from), and
         * the receiver's catch sequence is cut short — the hands close on nothing. */
        const dm = this.markers[this.actorIdx(e.by)], om = this.markers[this.actorIdx(e.on)], b = PJ(e.x, e.y);
        if (dm) { const a = PJ(dm.sx, dm.sy); if (Math.hypot(b.x - a.x, b.y - a.y) > 2) this.faceMarker(dm, b.x - a.x, b.y - a.y);
          dm._preCatch = false; dm._handfight = false; dm._lookAt = null; dm.forceState = "grab"; dm._swatV109 = true; dm._launchUntil = 0;
          const dp = PJ(e.x + (e.from === "front" ? 5 : e.from === "behind" ? -6 : 0), e.y + 4); this.tweens.add({ targets: dm.root, x: dp.x, y: dp.y, duration: 120 });
          this.time.delayedCall(TU("swatHoldMs", 250), () => { if (!dm._swatV109) return; dm._swatV109 = false; if (dm.forceState === "grab") { dm.forceState = null; dm.cutUntil = dm.tms + 200; } }); }
        if (om) { const a = PJ(om.sx, om.sy); if (Math.hypot(b.x - a.x, b.y - a.y) > 2) this.faceMarker(om, b.x - a.x, b.y - a.y);
          if (/^(catchseqSeq|catchSeq|diveCatchSeq|catch)$/.test(String(om.forceState))) { om.forceState = null; om.cutUntil = om.tms + 220; } om._reachV109 = null; om._tuckV109 = 0; }
        this.flash(e.x, e.y, 0xffffff); this.puffFx(e.x, e.y - 4, 2, 0xdce7f3, 0.45); this.hitStop = Math.max(this.hitStop, 45);
        this.popText(e.x, e.y - 22, e.from === "front" ? "UNDERCUTS IT!" : e.from === "behind" ? "SWATS IT FROM BEHIND!" : "SWATTED AWAY!", "#f7e2a8", 14);
        try { const B = window.__V109_B = window.__V109_B || {}; B.swatDrawn = (B.swatDrawn || 0) + 1; (B.swatFromDrawn = B.swatFromDrawn || {})[e.from || "none"] = (B.swatFromDrawn[e.from || "none"] || 0) + 1; } catch (er) {}
        break; }
      case "bounce": { const tk = this.markers[this.actorIdx(e.who)]; if (tk) { tk.forceState = null; tk.cutUntil = tk.tms + 320; }
        // v109: the man who bounced off staggers away from the body he bounced off; the carrier is jarred
        const cb9 = this.markers[this.actorIdx(e.carrier)];
        if (tk) this.stumbleV109(tk, this.sideV109(e.side == null ? e : {}, tk, cb9), TU("stumbleMs", 250) + 80);
        if (cb9 && !cb9.forceState && !cb9._stumbleV109 && !e.glancing) this.stumbleV109(cb9, this.sideV109(e, cb9, tk), TU("contactStumbleMs", 160));
        this.puffFx(e.x, e.y, 2); this.popText(e.x, e.y - 22, "BOUNCES OFF!", "#8fe7ff", 13); break; }
      case "pilePush": this.puffFx(e.x, e.y, 1, 0xd8e6da, 0.4); break;
      case "snapCatch": { P.carrierId = this.actorIdx(e.by); P.ballHolderId = P.carrierId; P.ballMode = "held"; break; }
      /* ===== v83 BLOCK FACING + 2.5D — each blocker squares up to HIS man ===== */
      case "engage": case "stuntPassOff": { (e.pairs || []).forEach(pr => this.pairUp(this.actorIdx(pr[0]), this.actorIdx(pr[1]))); if (e.type === "stuntPassOff") this.puffFx(e.x, e.y, 1, 0xd8e6da, 0.35); break; }
      case "disengage": { this.unpair(this.actorIdx(e.who)); break; }
      case "kickBlocked": { this.flash(e.x, e.y, 0xff6b52); this.popText(e.x, e.y - 26, "BLOCKED!!", "#ff9fa5", 18); REDUCED_MOTION || this.cameras.main.shake(140, 0.005); break; }
      case "kick": break;
      case "firstdown": {
        P.fdConverted = true;
        BADGE_V95.show("firstdown", { sub: Math.abs(Number(pay.yards || 0)) + "-yard " + (pay.event === "pass" ? "reception" : pay.penalty ? "penalty" : "run"), scene: this, token: "fd:" + P.__ballTokenV1514 });   // v95
        const g = this.trackFx(this.add.graphics().setDepth(6));
        { const fa = PJ(e.x, F_TOP), fb = PJ(e.x, F_BOT); g.lineStyle(7, 0xf0bb45, 0.75).lineBetween(fa.x, fa.y, fb.x, fb.y); }
        this.tweens.add({ targets: g, alpha: 0, duration: 650, onComplete: () => this.dropFx(g) });
        break;
      }
      case "brokenTackle": {
        const m = this.markers[this.actorIdx(e.who)];
        // v109: past the fourth truck in a play the event is `quiet` — he still goes down, no flair
        if (e.quiet) { if (m) { m.forceState = "down"; this.time.delayedCall(720, () => { if (m.forceState === "down") m.forceState = null; }); }
          this.hookV109C1().quietTrucks++; break; }
        this.slowMoment(P);
        this.hitFx(e.x, e.y, Number(e.kb || 0) >= 8, false, e);   // v109: the rings at the point he was run through, along the carrier's line
        /* v112 THE HIT HAS WEIGHT: run through this hard and the beaten man leaves his feet. The
         * arc flies him back along the truck's own knock-back — the ground the sim already moved
         * him — and lands him in `down`, so the badge, the shake and the freeze still fire below. */
        const fly112 = !!(m && TU("flyV112", 1) && e.flyWho && e.flyWho === e.who && Number(e.flyVz) > 0);
        if (fly112) {
          this.flyStartV112(m, e.flyVz, this.sideV109(e, m, this.markers[this.actorIdx(e.carrier)]));
          this.hookV112F().flying++;
          if (m.body) m.body.setAlpha(0.85);
          this.time.delayedCall(TU("launchDownMs", 900), () => { if (m.body) { m.body.setAlpha(1); if (m.forceState === "down" && !m._flyV112) m.forceState = null; } });
          this.time.delayedCall(this.flyBadgeMsV112(e.flyVz), () => BADGE_V95.show("bighit", { sub: e.hitStick ? "TRUCKED HIM" : "OFF HIS FEET", x: e.x, y: e.y, scene: this }));   // v112: the callout lands with him
          this.hitStop = Math.max(this.hitStop, TU("hitStopBig", 120));
          this.puffFx(e.x, e.y, 6); vib(48);
          REDUCED_MOTION || this.cameras.main.shake(240, 0.014);
          break;
        }
        // v25 HIT STICK (offense trucks the defender): fling the beaten man with the
        // baked dive→down frames along the carrier's motion, big shake + freeze-frame.
        if (e.hitStick && m) {
          m.forceState = "dive"; m._launchT0 = m.tms; m._launchUntil = m.tms + 300; m._launchH = 15;
          this.time.delayedCall(280, () => { if (m.body) { m.forceState = "down"; m.body.setAlpha(0.85);
            this.time.delayedCall(720, () => { if (m.body) { m.body.setAlpha(1); if (m.forceState === "down") m.forceState = null; } }); } });
          BADGE_V95.show("bighit", { sub: "TRUCKED HIM", x: e.x, y: e.y, scene: this });   // v95: the carrier levels the tackler
          this.hitStop = Math.max(this.hitStop, TU("hitStopBig", 120));
          this.puffFx(e.x, e.y, 6); vib(48);
          REDUCED_MOTION || this.cameras.main.shake(240, 0.014);
          break;
        }
        if (m) { m.forceState = "down"; m.body.setAlpha(0.7);
          this.time.delayedCall(720, () => { if (m.body) { m.body.setAlpha(1); if (m.forceState === "down") m.forceState = null; } }); }
        this.popText(e.x, e.y - 20, Number(e.kb||0) >= 8 ? "TRUCKED!" : "BROKEN!", Number(e.kb||0) >= 8 ? "#ff9fa5" : "#8fe7ff", Number(e.kb||0) >= 8 ? 15 : 13);
        this.puffFx(e.x, e.y, Number(e.kb||0) >= 8 ? 4 : 2);
        REDUCED_MOTION || this.cameras.main.shake(Number(e.kb||0) >= 8 ? 150 : 90, Number(e.kb||0) >= 8 ? 0.006 : 0.003);
        break;
      }
      case "fumble": {
        BADGE_V95.show("fumble", { x: e.x, y: e.y, scene: this, token: "fum:" + P.__ballTokenV1514 });   // v95
        REDUCED_MOTION || this.cameras.main.shake(200, 0.009);
        P.carrierId = null;
        P.ballHolderId = null; P.ballMode = "loose"; P.ballReleaseAt = P.t; P._ballTumbleBase = this.ballSpr?.rotation || 0;
        P.__looseBall = true;
        // v109: the loose window opens here (the `looseBall` that follows a strip adds the direction)
        { const tok = String(P.__ballTokenV1514 || e.t || 0); P.__looseV109 = { t0: P.t, x: e.x, y: e.y, vx: 0, vy: 0, seed: tok.split("").reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 9973, 7), cid: e.cid }; }
        if (window.__RIB20_onFumble) window.__RIB20_onFumble(this, P, e);
        break;
      }
      case "recover": {
        const m = this.markers[this.actorIdx(e.by)];
        if (m) this.flash(m.sx, m.sy, 0xff6b52);
        // v109 THE FUMBLE COMES LOOSE: the man who wins the scramble dives onto it and covers it
        if (m && e.strip) { m.forceState = "dive"; m._launchT0 = m.tms; m._launchUntil = m.tms + TU("recoverDiveMs", 240); m._launchH = 6; m._lean = 0;
          this.time.delayedCall(TU("recoverDiveMs", 240), () => { if (m.active !== false && m.forceState === "dive") m.forceState = "down"; });
          this.puffFx(e.x, e.y + 3, 3, 0x8a7a55, 0.45); }
        P.__looseV109 = null; this.hookV109C1().recovers++;
        if (e.side === "def") { P.turnoverV95 = "FUMBLE"; BADGE_V95.show("turnover", { sub: "DEFENSE RECOVERS", x: e.x, y: e.y, scene: this, token: "to:" + P.__ballTokenV1514 }); }   // v95
        else this.popText(e.x, e.y - 24, "RECOVERED — OFFENSE!", "#f7e2a8", 15);
        P.__looseBall = false;
        P.ballHolderId = this.actorIdx(e.by); P.ballMode = "held";
        if (window.__RIB20_onRecovery) window.__RIB20_onRecovery(this, P, e);
        break;
      }
      case "fgResult": BADGE_V95.show(e.good ? "fieldgoal" : "missed", { sub: P.fgDistV95 ? (e.good ? P.fgDistV95 + " YARDS · GOOD" : P.fgDistV95 + "-yard attempt") : (e.good ? "IT'S GOOD" : "NO GOOD"), x: e.x, y: e.y, scene: this, token: "fg:" + P.__ballTokenV1514 });   // v95
        if (e.good) REDUCED_MOTION || this.cameras.main.shake(140, 0.004); break;
      case "puntCatch": { P.carrierId = this.actorIdx(e.by); P.ballHolderId = P.carrierId; P.ballMode = "held"; this.flash(e.x, e.y, 0xffffff); break; }
      case "faircatch": this.popText(e.x, e.y - 20, "FAIR CATCH", "#93a0b1", 13); break;
      case "scramble": { P.carrierId = 8; P.ballHolderId = 8; P.ballMode = "held"; P.scrambling = true; this.popText(e.x, e.y - 22, "SCRAMBLING!", "#8fe7ff", 13); break; }
      case "toetap": this.popText(e.x, e.y - 18, "TOE TAP!", "#57e07a", 13); break;
      case "wrap": {
        this.popText(e.x, e.y - 18, e.gang ? "GANG WRAP — DRAGGED DOWN!" : "WRAPPED UP", e.gang ? "#ffb08a" : "#93a0b1", e.gang ? 13 : 11);
        // every defender in the pile clamps on: jersey-grab pose while the carrier grinds
        this.markers.forEach((mm, mi) => {
          if (mi === P.carrierId || mi < 11 === (P.carrierId < 11)) return;
          const cm2 = this.markers[P.carrierId]; if (!cm2) return;
          if (Math.hypot(mm.sx - cm2.sx, mm.sy - cm2.sy) < 16) mm.forceState = "grab";
        });
        break;
      }
      case "qbHit": { this.flash(e.x, e.y, 0xff6b52); this.popText(e.x, e.y - 22, "QB HIT!", "#ff9fa5", 13);
        REDUCED_MOTION || this.cameras.main.shake(110, 0.005); break; }
      // v23: a defender has broken through and is bearing down on the QB — flag him
      // so the player sees the scramble/sack coming a beat early.
      case "pressureAlert": case "freeRusher": { const m = this.markers[this.actorIdx(e.who)]; if (m) this.alertMark(m, true); break; }
      case "tip": { P.ballMode = "tip"; P.ballHolderId = null; P._ballNoseAngle = this.ballSpr?.rotation || P._ballNoseAngle;
        this.flash(e.x, e.y, 0xffffff); this.popText(e.x, e.y - 20, "TIPPED!", "#f7e2a8", 13);
        // v86 tip drill: every body near a tipped ball reaches for it
        this.markers.forEach((mm) => { if (mm.forceState || Math.hypot(mm.sx - e.x, mm.sy - e.y) > TU("tipReachPx", 40)) return;
          mm.forceState = "catch"; mm._lookAt = null; this.time.delayedCall(TU("tipReachMs", 220), () => { if (mm.forceState === "catch") mm.forceState = null; }); });
        break; }
      case "pull": break;
      case "stunt": break;
      case "shell": break;
      case "flag": {
        // v45: the nearest official heaves his flag toward the spot. If the crew
        // isn't on the field yet (atlas still decoding) fall back to a dropped flag.
        if (!this.refThrowFlag(e.x, e.y)) {
          const fp = PJ(e.x, e.y);
          const f = this.trackFx(this.add.rectangle(fp.x, fp.y - 90, 10, 10, 0xffd75e).setDepth(23).setAngle(20));
          this.tweens.add({ targets: f, y: fp.y, angle: 340, duration: 480, ease: "Quad.easeIn" });
        }
        BADGE_V95.show("flag", { sub: Number(pay.yards ?? 0) < 0 ? "ON THE OFFENSE" : "ON THE DEFENSE", x: e.x, y: e.y, scene: this, token: "flag:" + P.__ballTokenV1514 });   // v95
        vib(30);
        break;
      }
      case "blitzLook": { const m = this.markers[this.actorIdx(e.who)]; if (m) this.flash(m.sx, m.sy, 0xff6b52); break; }
      case "look": {
        // v33: the cone is a three-state throwing-window grade from the sim.
        P.lookIdx = this.actorIdx(e.to); P.lookWindow=e.window||(e.open?"green":"red"); P.lookOpen=e.window?e.window==="green":!!e.open;
        P.lookCone = e.cone == null ? null : e.cone; P.lookProt = e.prot == null ? null : e.prot;   // v101: the live cone
        try { const V = window.__V101 = window.__V101 || {}; V.look = { cone: e.cone, prot: e.prot, panic: e.panic, window: P.lookWindow };
          (V.lookCones || (V.lookCones = [])).push(e.cone); if (V.lookCones.length > 400) V.lookCones.shift(); } catch (_e) {}
        this.qbEyeV109(P, e.to);   // v109: his eyes go where the cone goes
        break;
      }
      case "read": {
        // the QB comes off his first read — swing the cone to the new man
        if (e.to && e.to !== "off9") { P.lookIdx = this.actorIdx(e.to); P.lookOpen = false; }
        else if (e.to === "off9") { P.lookIdx = 9; P.lookOpen = true; }
        this.qbEyeV109(P, e.to);   // v109: and come off the first read with his eyes, not just the cone
        break;
      }
      case "throw": {
        P.lookIdx = null; if (this.lookG) this.lookG.clear();
        P.ballReleasePos = this.ballSpr ? { x: this.ballSpr.x, y: this.ballSpr.y } : null;
        P._thrower = P.ballHolderId; P._hand = null;   // v105: whose arm this is, for the flame; a hand still open is over
        // v107: how close the drawn release landed to the flight — 0 when the lookahead armed it
        if (P._thrRecV107) { const rc = P._thrRecV107; rc.flightStartMs = P.t;
          rc.residualMs = rc.relMs == null ? null : Math.round(P.t - rc.relMs); P._thrRecV107 = null; }
        P.ballReleaseAt = P.t; P.ballHolderId = null; P._ballNoseAngle = null; P._ballTumbleBase = this.ballSpr?.rotation || 0;
        const kicking = /^(fg|punt|kickoff|xp)$/i.test(String(pay.event || ""));
        P.ballMode = kicking ? "kick" : "flight";
        P.ballStyle = e.style || (kicking ? "kick" : Math.abs(Number(pay.yards || 0)) >= 18 ? "lob" : Math.abs(Number(pay.yards || 0)) <= 7 ? "bullet" : "touch");
        // v109: the ball's own numbers, for the spin, the wobble and the laces (null when the sim did not say)
        P.ballVelV109 = Number.isFinite(e.vel) ? e.vel : null; P.ballWobbleV109 = Number.isFinite(e.wobble) ? e.wobble : null;
        P.ballDurV109 = Number.isFinite(e.dur) ? e.dur : null; P.ballApexV109 = Number.isFinite(e.apex) ? e.apex : null;
        this.clearAlerts();   // v23: ball's out — the scramble warning is moot
        const ti = e.to ? this.actorIdx(e.to) : (P.script.meta.targetId ? this.actorIdx(P.script.meta.targetId) : -1);
        if (ti >= 0) P.awaitCatch = ti;
        this.zoomPunch = Math.max(this.zoomPunch, 0.06);
        if(e.style)this.popText(e.x,e.y-24,String(e.style).toUpperCase(),e.style==="bullet"?"#8fe7ff":e.style==="lob"?"#f7e2a8":"#bfe3ae",12);
        // v13: landing-spot reticle — find where this flight returns to earth and mark it
        try {
          const bf = P.script.ball, idx = Math.max(0, Math.floor((P.t - (P.delay || 0)) / 33));
          let land = null, up = false;
          for (let k = idx; k < bf.length; k++) {
            if (bf[k].h > 2) up = true;
            else if (up && bf[k].h <= 1.4) { land = bf[k]; break; }
          }
          if (e.tx!=null&&e.ty!=null) land={x:e.tx,y:e.ty};
          if (land) {
            this.clearLand();
            const lp = PJ(land.x, land.y);
            const gL = this.trackFx(this.add.graphics().setDepth(2.8));
            const lc=e.window==="green"?0x57e07a:e.window==="red"?0xe0484f:0xf0bb45;
            gL.lineStyle(2.5, lc, 0.9).strokeEllipse(lp.x, lp.y, 26 * lp.s, 12 * lp.s);
            gL.lineStyle(1.5, lc, 0.5).strokeEllipse(lp.x, lp.y, 40 * lp.s, 18 * lp.s);
            gL.fillStyle(lc, 0.75).fillCircle(lp.x, lp.y, 2.5 * lp.s);
            this.tweens.add({ targets: gL, alpha: 0.4, yoyo: true, repeat: -1, duration: 300 });
            P.landG = gL;
          }
        } catch (e) {}
        break;
      }
      case "firstdown_": break;
    }
  }

  setSpot(x, y) {
    if (!this.spotG) this.spotG = this.add.graphics().setDepth(3);
    const p = PJ(x, y);
    this.spotG.clear();
    this.spotG.fillStyle(0xffffff, 0.55).fillCircle(p.x, p.y, 4 * p.s);
    this.spotG.lineStyle(1.5, 0xffffff, 0.35).strokeCircle(p.x, p.y, 8 * p.s);
    // v49: spotting the ball IS the dead ball — every path that ends a play (tackle,
    // incomplete, out of bounds, score) already comes through here, so the crew's
    // whistle hangs off the one hook instead of five separate event cases.
    try { this.refWhistle(x, y); } catch (e) {}
    try { this.refSpotV109(x, y); } catch (e) {}   // v109: and the nearest free official goes to the ball
  }
  endzoneFlash() {
    const dir = this.play && (this.play.script.meta.scoreDir || this.play.script.meta.dir) || 1;
    const x0 = dir > 0 ? PLAY_R : 0, x1 = dir > 0 ? FW : PLAY_L;
    const g = this.trackFx(this.add.graphics().setDepth(6));
    const a = PJ(x0, F_TOP), b = PJ(x1, F_TOP), c = PJ(x1, F_BOT), d = PJ(x0, F_BOT);
    g.fillStyle(0xf0bb45, 0.3).fillPoints([a, b, c, d], true);
    this.tweens.add({ targets: g, alpha: 0, duration: 620, onComplete: () => this.dropFx(g) });
  }
  downDistText(losAbs) {
    let dd = "";
    try { const el = document.getElementById("downDist"); dd = el ? el.textContent.trim() : ""; } catch (e) {}
    const on = Math.round(losAbs <= 50 ? losAbs : 100 - losAbs);
    return (dd ? dd + " · " : "") + "BALL ON " + on;
  }
  /* v95: the pre-snap badges. The payload carries the down it was played on (preDown) and
   * the spot (startBall, from the offense's own goal); a fourth down that is being played
   * out (not a kick) and a snap inside the five each get their badge as the huddle breaks. */
  badgesPresnapV95(et, losAbs) {
    try {
      BADGE_V95.preload();
      const P = this.play; if (!P) return;
      let us = 0, them = 0;
      try { us = Number(document.getElementById("usScore").textContent) || 0; them = Number(document.getElementById("themScore").textContent) || 0; } catch (e) {}
      P.preScoreV95 = { us, them };
      const live = et.event === "run" || et.event === "pass" || et.event === "incomplete";
      const down = Number(et.preDown ?? et.down ?? 0), toGo = Number(et.preToGo ?? et.toGo ?? 10);
      const dir = P.script && P.script.meta && P.script.meta.dir || VDIR || 1;
      const ytg = dir > 0 ? 100 - losAbs : losAbs;          // yards to the goal the offense attacks
      P.fgDistV95 = et.event === "fg" ? Math.round(ytg + 17) : 0;   // the kick's distance, for the FIELD GOAL / MISSED caption
      if (!live) return;
      const atGoal = ytg <= TU("badgeGoalLineYds", 5), goalToGo = atGoal || toGo >= ytg;
      if (down === 4) BADGE_V95.show("fourthdown", { sub: goalToGo ? "Goal to go" : toGo + " yard" + (toGo === 1 ? "" : "s") + " to go", scene: this, token: "4th:" + P.__ballTokenV1514, hold: 1250 });
      else if (atGoal) BADGE_V95.show("goalline", { sub: "Ball on the " + Math.max(1, Math.round(ytg)), scene: this, token: "gl:" + P.__ballTokenV1514, hold: 1250 });
    } catch (e) {}
  }
  /* v95: the badges that need the whistle. Returns true when a badge (this one or one that
   * fired during the play) already told the result, so the ribbon stays down. */
  badgesWhistleV95(P) {
    let told = false;
    try {
      const pay = P.payload || {}, yd = Number(pay.yards ?? 0), d = String(pay.desc || "").toUpperCase();
      const tok = P.__ballTokenV1514, live = pay.event === "run" || pay.event === "pass";
      const cm = P.carrierId != null && P.carrierId >= 0 ? this.markers[P.carrierId] : null, at = { scene: this, x: cm ? cm.sx : undefined, y: cm ? cm.sy : undefined };
      const picked = d.includes("INTERCEPT"), fumbled = d.includes("FUMBLE") && (P.turnoverV95 === "FUMBLE" || /DEFENSE|TAKES OVER|TURNOVER/.test(d));
      const onDowns = !pay.scored && !pay.penalty && (d.includes("ON DOWNS") || (Number(pay.preDown ?? 0) === 4 && (live || pay.event === "incomplete") && yd < Number(pay.preToGo ?? 10)));
      const turnover = picked || fumbled || onDowns;
      told = !!(pay.scored || pay.event === "fg" || picked || d.includes("FUMBLE") || d.includes("SACK") || pay.penalty);
      if (turnover) { told = true; BADGE_V95.show("turnover", Object.assign({ sub: picked ? "INTERCEPTION" : fumbled ? "FUMBLE" : "ON DOWNS", token: "to:" + tok }, at)); }
      else if (live && !pay.scored && !pay.penalty && yd >= TU("badgeBreakawayYds", 40)) { told = true; BADGE_V95.show("breakaway", Object.assign({ sub: badgeYdsV95(yd), token: "brk:" + tok }, at)); }
      else if (live && !pay.scored && !pay.penalty && yd >= TU("badgeBigPlayYds", 20)) { told = true; BADGE_V95.show("bigplay", Object.assign({ sub: badgeYdsV95(yd), token: "big:" + tok }, at)); }
      /* v109 THE STICKS COME OUT — a spot inside a yard of the marker gets the chains before the verdict; the ribbon
       * then reads MEASUREMENT · FIRST DOWN / SHORT, so the badge must not count as having told it */
      if (pay.measure && !turnover && !pay.scored && !pay.penalty) {
        BADGE_V95.show("firstdown", Object.assign({ sub: "MEASUREMENT", token: "meas:" + tok, force: true, hold: TU("measureHoldMs", 1100) }, at));
        try { const V = window.__V109_D = window.__V109_D || {}; V.measureBadges = (V.measureBadges || 0) + 1; } catch (e) {}
        told = false;
      }
      // a fourth-quarter lead change, or a late takeaway with the game inside one score
      const pre = P.preScoreV95, q = Number(pay.quarter ?? 0);
      if (pre && q >= 4 && pay.usScore != null && pay.themScore != null) {
        const before = Math.sign(pre.us - pre.them), after = Math.sign(Number(pay.usScore) - Number(pay.themScore));
        const flipped = after !== 0 && before !== after, tight = Math.abs(Number(pay.usScore) - Number(pay.themScore)) <= 8;
        if (flipped || (turnover && tight)) BADGE_V95.show("gamechanger", { sub: flipped ? "LEAD CHANGE" : "TAKEAWAY", scene: this, token: "gc:" + tok });
      }
    } catch (e) {}
    return told;
  }
  resultText(pay) {
    const yd = Number(pay.yards ?? 0), d = String(pay.desc || "").toUpperCase();
    /* ===== v109 THE GAME HAS A CLOCK — the try, the punt's numbers, the measurement, the stopped clock ===== */
    if (pay.event === "xp") return "EXTRA POINT · " + (pay.scored ? "GOOD" : "NO GOOD");
    if (pay.event === "twopt") return "2-PT · " + (pay.scored ? "GOOD" : "NO GOOD");
    if (pay.scored && pay.event !== "fg") return "TOUCHDOWN";
    if (pay.event === "fg") return d.includes("NO GOOD") || d.includes("MISS") ? "FIELD GOAL NO GOOD" : "FIELD GOAL IS GOOD";
    if (pay.event === "punt") {
      const pr = pay.puntResult, g = pay.gross != null ? pay.gross : yd;
      if (pr === "touchback") return "PUNT · " + g + " YDS, TOUCHBACK";
      if (pr === "blocked") return "PUNT BLOCKED";
      if (pr === "muff") return "MUFFED PUNT";
      if (pr === "fair") return "PUNT · " + g + " YDS, FAIR CATCH";
      if (pr === "downed") return "PUNT · " + g + " YDS, DOWNED";
      if (pr === "return") return "PUNT · " + g + " YDS, RETURNED " + (pay.returnYds || 0);
      return "PUNT · " + g + " YDS";
    }
    if (pay.measure && !pay.penalty && !d.includes("FUMBLE") && !d.includes("INTERCEPT")) {
      const fd = d.includes("FIRST DOWN"), conv = this.play && this.play.fdConverted;   // the whistle site appends its own "· FIRST DOWN" when the event fired
      return "MEASUREMENT" + (fd ? (conv ? "" : " · FIRST DOWN") : " · SHORT") + (pay.clockStopped ? " · CLOCK STOPS" : "");
    }
    const stop = (pay.event === "run" || pay.event === "pass" || pay.event === "incomplete" || pay.event === "sack" || pay.event === "scramble") && pay.clockStopped ? " · CLOCK STOPS" : "";
    if (stop) return this.resultTextCoreV109(pay, yd, d) + stop;
    if (pay.event === "kickoff") return "KICKOFF · " + String(pay.desc || "").replace(/^.*returned (\d+).*$/, "RETURNED $1");
    if (d.includes("FUMBLE")) return "FUMBLE — TURNOVER";
    if (d.includes("INTERCEPT")) return "INTERCEPTED";
    if (d.includes("SACK")) return "SACKED FOR " + yd;
    if (pay.safety || d.includes("SAFETY")) return "SAFETY · 2 POINTS";   // v87
    if (pay.event === "incomplete") return "INCOMPLETE";
    return (yd >= 0 ? "GAIN OF " + yd : "LOSS OF " + Math.abs(yd));
  }
  /* v109: the pre-v109 tail of resultText, so a stopped clock can be appended to it */
  resultTextCoreV109(pay, yd, d) {
    if (d.includes("FUMBLE")) return "FUMBLE — TURNOVER";
    if (d.includes("INTERCEPT")) return "INTERCEPTED";
    if (d.includes("SACK")) return "SACKED FOR " + yd;
    if (pay.safety || d.includes("SAFETY")) return "SAFETY · 2 POINTS";
    if (pay.event === "incomplete") return "INCOMPLETE";
    return (yd >= 0 ? "GAIN OF " + yd : "LOSS OF " + Math.abs(yd));
  }
  ribbon(txt, hold) {
    let rx = FW / 2, ry = 34;
    try { const c = this.cameras.main; rx = c.midPoint.x; ry = c.scrollY + 40 / c.zoom; } catch (e) {}
    const bg = this.trackFx(this.add.rectangle(rx, ry, 320, 30, 0x0b1119, 0.88)
      .setStrokeStyle(1, 0xf0bb45, 0.5).setDepth(24));
    const t = this.trackFx(this.add.text(rx, ry, txt, {
      fontFamily: "Oswald, sans-serif", fontSize: "15px", fontStyle: "bold", color: "#eef2f7",
    }).setOrigin(0.5).setDepth(25));
    bg.width = Math.max(160, t.width + 44);
    this.tweens.add({ targets: [bg, t], alpha: 0, delay: hold, duration: 380,
      onComplete: () => { this.dropFx(bg); this.dropFx(t); } });
  }
  drawUprights(dir) {
    // v92: the FG highlight lights the SAME posts drawGoalpostsV87 draws (crossbar up on
    // its post, uprights the full height), instead of a short fence on the ground
    const x = dir > 0 ? PLAY_R + EZ * 0.72 : PLAY_L - EZ * 0.72, my = (F_TOP + F_BOT) / 2, W = TU("postHalfW", 62);
    const g = this.trackFx(this.add.graphics().setDepth(6));
    const base = PJ(x, my), t = PJ(x, my - W), b = PJ(x, my + W), s = base.s;
    const barY = base.y - TU("postH", 46) * s, up = TU("uprightH", 150) * s;
    g.lineStyle(4 * s, 0xffd75e, 0.95);
    g.lineBetween(base.x, base.y, base.x, barY);             // the post
    this.postPadV144(g, base, s);                            // v144 D: this overlay sits at depth 6 — without the pad here it would vanish for the whole kick
    g.lineBetween(t.x, barY, b.x, barY);                     // crossbar (horizontal, at the attacking end)
    g.lineBetween(t.x, barY, t.x, barY - up);                // uprights point skyward
    g.lineBetween(b.x, barY, b.x, barY - up);
  }
  // v16.3 pre-snap play preview (your team only). Shows the DESIGN of the play —
  // never the outcome — during the pre-snap beat, then clears at the snap. If your
  // team has the ball: routes, OL block direction, the RB's aim. If your defense is
  // out: the coverage read (man vs zone), safety deep zones, LB box.
  drawPreview(P) {
    try {
      if (!this.previewG) { this.previewG = this.add.graphics().setDepth(6); this.previewTxt = []; }
      const g = this.previewG; g.clear();
      (this.previewTxt || []).forEach(t => t && t.destroy && t.destroy()); this.previewTxt = [];
      const et = P.payload; if (!et || et.header || et.event === "drive" || et.event === "fg" || et.event === "punt") return;
      const dir = (P.script.meta && P.script.meta.dir) || 1, M = this.markers, YP = PLAY_W / 100;
      const line = (ax, ay, bx, by, col, a, w) => { const p1 = PJ(ax, ay), p2 = PJ(bx, by);
        g.lineStyle(w || 2, col, a == null ? 0.7 : a).lineBetween(p1.x, p1.y, p2.x, p2.y); };
      const dot = (sx, sy, r, col, a) => { const p = PJ(sx, sy); g.fillStyle(col, a == null ? 0.6 : a).fillCircle(p.x, p.y, r); };
      const label = (sx, sy, txt, col) => { const p = PJ(sx, sy);
        this.previewTxt.push(this.add.text(p.x, p.y, txt, { fontFamily: "Oswald, sans-serif", fontSize: "8px", fontStyle: "bold", color: col, stroke: "#0a0f16", strokeThickness: 3 }).setOrigin(0.5).setDepth(7)); };
      if (et.offense === "us") {
        const isPass = et.isPass || et.event === "pass" || et.event === "incomplete";
        const depth = ({ shot: 26, deep: 24, fade: 9, quick: 7, dropback: 13, screen: -2 })[et.concept] || (isPass ? 12 : 0);
        const routes = ["go", "post", "out", "slant", "dig"]; let ri = 0;
        M.forEach((m, i) => { if (i > 10 || !m) return; const lb = m.posLabel;
          if (isPass && (lb === "WR" || lb === "TE" || lb === "RB")) {
            const d = (lb === "TE" ? Math.max(5, depth * 0.6) : depth) * YP * dir, side = m.sy < 220 ? -1 : 1;
            const type = et.concept === "screen" ? "screen" : routes[ri++ % routes.length];
            const pts = [[m.sx, m.sy]];
            if (type === "screen") pts.push([m.sx - dir * 2 * YP, m.sy + side * 8]);
            else if (type === "slant") { pts.push([m.sx + dir * 2 * YP, m.sy], [m.sx + d, m.sy - side * 40]); }
            else if (type === "out") { pts.push([m.sx + d, m.sy], [m.sx + d, m.sy + side * 36]); }
            else if (type === "post") { pts.push([m.sx + d * 0.6, m.sy], [m.sx + d, 220]); }
            else if (type === "dig") { pts.push([m.sx + d, m.sy], [m.sx + d, m.sy - side * 42]); }
            else pts.push([m.sx + d, m.sy]);
            for (let k = 1; k < pts.length; k++) line(pts[k-1][0], pts[k-1][1], pts[k][0], pts[k][1], 0xffd97a, 0.85, 2);
            dot(pts[pts.length-1][0], pts[pts.length-1][1], 3, 0xffd97a, 0.9);
          } else if (!isPass && lb === "RB") {
            const gapY = et.concept === "sweep" ? (m.sy < 220 ? 150 : 290) : 220;
            line(m.sx, m.sy, m.sx + dir * 8 * YP, gapY, 0x8fe7ff, 0.85, 2);
            dot(m.sx + dir * 8 * YP, gapY, 3, 0x8fe7ff, 0.9);
          } else if (lb === "OL") { line(m.sx, m.sy, m.sx + dir * 3 * YP, m.sy, 0x9fb0c0, 0.55, 2); }
        });
        if (M[8]) label(M[8].sx - dir * 7 * YP, 202, isPass ? "PASS" : "RUN", "#ffd97a");
      } else {
        const manLook = (Number(et.down) >= 3 && Number(et.toGo) <= 7);
        const wrs = M.map((m, i) => ({ m, i })).filter(o => o.i >= 0 && o.i <= 10 && o.m && (o.m.posLabel === "WR" || o.m.posLabel === "TE"));
        M.forEach((m, i) => { if (i < 11 || !m) return; const lb = m.posLabel;
          if (lb === "S") { const p = PJ(m.sx, m.sy); g.fillStyle(0xe0645a, 0.12).fillEllipse(p.x, p.y, 120, 58); g.lineStyle(1.5, 0xe0645a, 0.45).strokeEllipse(p.x, p.y, 120, 58); }
          else if (lb === "CB") {
            if (manLook && wrs.length) { const w = wrs.slice().sort((a, b) => Math.hypot(a.m.sx - m.sx, a.m.sy - m.sy) - Math.hypot(b.m.sx - m.sx, b.m.sy - m.sy))[0]; line(m.sx, m.sy, w.m.sx, w.m.sy, 0xe0645a, 0.6, 1.5); }
            else { const p = PJ(m.sx, m.sy); g.lineStyle(1.5, 0xe0645a, 0.4).strokeCircle(p.x, p.y, 26); }
          } else if (lb === "LB") { const p = PJ(m.sx, m.sy); g.lineStyle(1.5, 0xffd97a, 0.32).strokeCircle(p.x, p.y, 22); }
        });
        if (M[13]) label(M[13].sx, 118, manLook ? "MAN" : "ZONE", "#ff9fa5");
      }
    } catch (e) {}
  }
  routeLine(pts, isMe) {
    const g = this.trackFx(this.add.graphics().setDepth(2));
    const col = isMe ? 0xf0bb45 : 0xffffff;
    g.lineStyle(2, col, isMe ? 0.7 : 0.4);
    for (let i = 1; i < pts.length; i++) {
      // dashed segments, projected into the broadcast perspective
      const a = pts[i - 1], b = pts[i], L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.floor(L / 14));
      for (let k = 0; k < n; k++) {
        const f0 = k / n, f1 = (k + 0.55) / n;
        const pa = PJ(a.x + (b.x - a.x) * f0, a.y + (b.y - a.y) * f0), pb = PJ(a.x + (b.x - a.x) * f1, a.y + (b.y - a.y) * f1);
        g.lineBetween(pa.x, pa.y, pb.x, pb.y);
      }
    }
    this.tweens.add({ targets: g, alpha: 0, delay: 1600, duration: 600, onComplete: () => this.dropFx(g) });
  }
  laneFlash(x, y) {   // v81: a short-lived glow on the turf where the hole opened
    try {
      const pts = [[x - 6, y - 13], [x + 24, y - 13], [x + 24, y + 13], [x - 6, y + 13]].map(([a, b]) => { const p = PJ(a, b); return new mt.Geom.Point(p.x, p.y); });
      const g = this.trackFx(this.add.graphics().setDepth(3.6));
      g.fillStyle(0x9be79a, 0.28).fillPoints(pts, true); g.lineStyle(1.5, 0xd6ffd0, 0.5).strokePoints(pts, true);
      this.tweens.add({ targets: g, alpha: 0, duration: TU("laneFlashMs", 700), onComplete: () => this.dropFx(g) });
    } catch (e) {}
  }
  flash(x, y, c) {
    const fp = PJ(x, y); x = fp.x; y = fp.y;
    const r = this.trackFx(this.add.circle(x, y, 9 * fp.s).setStrokeStyle(3, c, 1).setDepth(20));
    this.tweens.add({ targets: r, scale: 2.6, alpha: 0, duration: 260, onComplete: () => this.dropFx(r) });
  }
  /* ===== v109 THE HIT HAS A POINT (renderer) =====
   * `hitFx` takes the event (or any {ix,iy,nx,ny,impact,cid}) as a fifth argument: the rings are
   * drawn AT the impact point instead of the carrier's centre, squashed along the collision normal,
   * sized by the momentum mismatch (`impactFxK`), and the harder the hit the more debris flies
   * off along that normal. `window.__V109_C1` is the hook: `.hits` counts every drawn hit,
   * `.last` is the last one's geometry, and the new events each keep a counter. */
  hookV109C1() { return (window.__V109_C1 = window.__V109_C1 || { hits: 0, last: null, wrapIns: 0, drags: 0, pileOns: 0, loose: 0, recovers: 0, bobbles: 0, quietTrucks: 0, lastDrag: null }); }
  hitFx(x, y, big, stick, geo) {
    const g = geo && Number.isFinite(geo.ix) && Number.isFinite(geo.iy) ? geo : null;
    if (g) { x = g.ix; y = g.iy; }
    const sx = x, sy = y;
    const hp = PJ(x, y); x = hp.x; y = hp.y;
    const imp = g ? Math.max(0, Number(g.impact) || 0) : 0, k = g ? Math.min(2.2, Math.max(0.7, 0.7 + imp * TU("impactFxK", .012))) : 1;
    let ang = 0; if (g) { const p1 = PJ(g.ix + (Number(g.nx) || 0) * 10, g.iy + (Number(g.ny) || 0) * 10); ang = Math.atan2(p1.y - y, p1.x - x); }
    for (let i = 0; i < (big ? 3 : 2); i++) {
      const r = this.trackFx((g ? this.add.ellipse(x, y, (12 + i * 8) * hp.s * k, (8 + i * 5) * hp.s * k).setRotation(ang) : this.add.circle(x, y, (6 + i * 4) * hp.s))
        .setStrokeStyle(3 - i * 0.7, big ? 0xff6b52 : 0xffffff, 0.9).setDepth(20));
      this.tweens.add({ targets: r, scale: 2.4 + i, alpha: 0, duration: 230 + i * 90, onComplete: () => this.dropFx(r) });
    }
    if (g && !REDUCED_MOTION) { const n = Math.min(6, 1 + Math.round(imp / 30));
      for (let i = 0; i < n; i++) { const a2 = ang + (Math.random() - .5) * 1.1, dist = (10 + Math.random() * 14) * k * hp.s;
        const d = this.trackFx(this.add.rectangle(x, y, 3 * hp.s, 1.6 * hp.s, i % 2 ? 0xfff2c8 : 0xffb28a, .9).setRotation(a2).setDepth(20));
        this.tweens.add({ targets: d, x: x + Math.cos(a2) * dist, y: y + Math.sin(a2) * dist - 4 * hp.s, alpha: 0, duration: 220 + Math.random() * 120, ease: "Quad.easeOut", onComplete: () => this.dropFx(d) }); } }
    const V = this.hookV109C1(); V.hits++;
    V.last = g ? { ix: g.ix, iy: g.iy, nx: Number(g.nx) || 0, ny: Number(g.ny) || 0, impact: imp, cid: g.cid, big: !!big, k } : { x: sx, y: sy, big: !!big, k: 1 };
    if (g) { V.hitsGeo = (V.hitsGeo || 0) + 1; V.lastGeo = V.last; }   // the ones placed from the sim's point (other cases still call hitFx bare)
    if (stick) BADGE_V95.show("bighit", { x: sx, y: sy, scene: this });   // v95: the badge is the sim's hit stick, not every stop for no gain
  }
  popText(x, y, txt, color, size) {
    const pp = PJ(x, y); x = pp.x; y = pp.y;
    const t = this.trackFx(this.add.text(mt.Math.Clamp(x, 50, FW - 50), mt.Math.Clamp(y, 30, WORLD_H - 26), txt, {
      fontFamily: "Oswald, sans-serif", fontSize: size + "px", fontStyle: "bold",
      color, stroke: "#0a0f16", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(22));
    this.tweens.add({ targets: t, y: t.y - 16, alpha: 0, delay: 260, duration: 440, onComplete: () => this.dropFx(t) });
    return t;
  }
  bounceBall(x, y) {
    if (!this.ballSpr) return;
    const bp = PJ(x, y);
    this.tweens.add({ targets: this.ballSpr, x: bp.x + mt.Math.Between(-20, 20), y: bp.y + 10, angle: 220, duration: 380, ease: "Bounce.easeOut" });
  }
  impact(x, y, yd) {
    const ip = PJ(x, y); x = ip.x; y = ip.y;
    const t = this.trackFx(this.add.text(mt.Math.Clamp(x, 54, FW - 54), mt.Math.Clamp(y - 30, 30, WORLD_H - 30), `${yd >= 0 ? "+" : ""}${yd} YD`, {
      fontFamily: "Oswald, sans-serif", fontSize: "18px", fontStyle: "bold",
      color: yd < 0 ? "#ff9fa5" : "#f7e2a8", stroke: "#0a0f16", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(21));
    this.tweens.add({ targets: t, y: t.y - 16, alpha: 0, delay: 180, duration: 380, onComplete: () => this.dropFx(t) });
  }
  // v91: put the ball on frame k of a sheet row and return the tilt that frame was drawn at
  // (so the caller can rotate by heading minus tilt); 0 and the baked ball when the sheet is out
  /* ===== v105 THE BALL HAS A HANDLER =====
   * The football used to appear in the quarterback's hand the instant the snap event fired:
   * before it the sprite sat on the sim's ground spot at the line, and `case "snap"` simply set
   * `ballHolderId = 8`, so on the broadcast the QB "started with it". Every exchange was the same
   * teleport — the handoff switched the holder to the back in one frame, the toss did not exist.
   *
   * Now the ball is always in SOMEBODY'S hands or in the air between two pairs of them. Before the
   * snap it is mounted under the CENTER (actor 5), low, at the line. The snap is a HAND — a short
   * zap from the center's spot to wherever the QB's throwing hand is that frame (it is re-aimed
   * every frame, so a QB already dropping back still receives it). A handoff is a hand from the
   * QB's hand to the back's; when the back is far enough away it is a TOSS, on a higher arc, with
   * the ball tumbling end over end. The throw keeps v36's release blend and gains the same trail.
   *
   * THE TRAIL is the motion itself: a tapered ribbon of the ball's last quarter second, drawn only
   * while the ball is genuinely travelling — a hand, a flight, a kick, a loose ball — pale like a
   * gust for an ordinary ball, wound into a double helix in flight (the SPIRAL), and burning —
   * flame core, ember sparks — when the man who threw or carries it is HOT. Heat is bookkept per
   * offense per actor at the end of every play (`heatV105`): big gains and scores heat a man up,
   * empty plays cool everyone down, and `heatHot` is the line. All of it is render-only: no sim
   * frame, no stat, no event is touched. `window.__V105` is what v105check reads. */
  handV105(P, kind) {
    // open a hand: the ball leaves the spot it is drawn at NOW and chases the holder's hand
    if (!this.ballSpr || !P) return;
    const x0 = this.ballSpr.x, y0 = this.ballSpr.y;
    let ms = TU("handoffMs", 170), arc = TU("handoffArc", 3), toss = false;
    if (kind === "snap") { ms = TU("snapZapMs", 150); arc = TU("snapArc", 2); }
    else if (kind === "handoff") {
      const qb = this.markers[8], rb = this.markers[P.ballHolderId];
      const d = qb && rb && qb.root && rb.root ? Math.hypot(rb.root.x - qb.root.x, rb.root.y - qb.root.y) / Math.max(0.5, (qb.root.scale || 1) / (qb._ageKV144 || 1)) : 0;   /* v144: back out the age scale — this is a screen distance being read as sim units */
      // a toss is a CALL — the playbook's sweep family (toss, jet, outside zone, pin and pull, the
      // reverse). Everything else is a hand: the sim does not stage a mesh (the QB drifts while the
      // back is already on his path, so the two are a few yards apart at the exchange), so the hand
      // is a quick, low flick that closes whatever gap there is, timed by the distance.
      const called = this.tossCallV108(P) || !!(P._meshV118 && P._meshV118.far);   // v108: one regex, read by the lookahead too; v118: or a back out of reach after the mesh step
      this._lastHandD = d;
      if (called) { toss = true; ms = TU("tossMs", 320) + d * TU("tossMsPerPx", 2.2); arc = TU("tossArc", 15); }
      else { ms = TU("handoffMs", 170) + d * TU("handoffMsPerPx", 0.6); arc = TU("handoffArc", 3); }
    }
    P._hand = { kind, x0, y0, t0: P.t, ms, arc, toss, d: kind === "handoff" ? +(this._lastHandD || 0).toFixed(1) : 0 };
    P._trailV105 = [];
    // v108: the quarterback's own body through the exchange. The lookahead has normally had him
    // reaching for two frames already — this catches a script that gave no warning, and books the
    // frame the hand actually opened on either way.
    if (kind === "handoff") {
      const qb = this.markers[8], rb = this.markers[9];
      const sdx = qb && rb ? Math.round(PJ(rb.sx, rb.sy).x - PJ(qb.sx, qb.sy).x) : null, left = sdx != null && sdx < TU("exchangeSideMinPx", -3);
      const E = EX_V108[left ? "handoffL" : toss ? "toss" : "handoff"];   // v118: the mirrored reach for a back off his left; the pitch only to his right
      if (qb && qb.forceState !== "handSeq" && sdx != null) this.startExchangeV108(P, qb, E, E.ms(), 0, P.t, sdx);
      const V8 = v108Hook(), arr = E.st === "toss" ? V8.tosses : V8.handoffs, rec = arr[arr.length - 1], cy = cycleV108(qb);   // v118: the record follows the DRAWN cycle (a far-left exchange is the reach with a pitched ball)
      if (rec && rec.frameAtEvent == null) rec.frameAtEvent = cy ? cy.f : null;
    }
    try { const V = window.__V105 = window.__V105 || {}; V.hands = (V.hands || 0) + 1; V[kind] = (V[kind] || 0) + 1; if (toss) V.tosses = (V.tosses || 0) + 1; V.lastHand = { kind, ms: Math.round(ms), toss, t: P.t, desc: String(P.payload && P.payload.desc || "").slice(0, 40),
      qb: this.markers[8] && [Math.round(this.markers[8].sx), Math.round(this.markers[8].sy)], to: this.markers[P.ballHolderId] && [Math.round(this.markers[P.ballHolderId].sx), Math.round(this.markers[P.ballHolderId].sy)] }; } catch (e) {}
  }
  handPosV105(P, x, y, s) {
    // where the ball is THIS frame: on its way from the hand it left to the hand it is chasing
    const H = P._hand; if (!H) return null;
    const k = (P.t - H.t0) / Math.max(1, H.ms);
    if (k >= 1) { P._hand = null; return null; }
    // a snap zaps (out fast, settles); a hand and a toss travel evenly and lift on an arc
    const e = H.kind === "snap" ? 1 - Math.pow(1 - k, 2.2) : k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    return { x: H.x0 + (x - H.x0) * e, y: H.y0 + (y - H.y0) * e - Math.sin(k * Math.PI) * H.arc * s, k, kind: H.kind, toss: H.toss };
  }
  trailV105(P, x, y, s, depth, dtms, why, hot) {
    // the ribbon: the ball's last quarter second, tapered to the tail; a helix when it spirals;
    // fire when the man it belongs to is hot. Cleared every frame it is not travelling.
    const g = this.ballTrailG && this.ballTrailG.scene ? this.ballTrailG : (this.ballTrailG = this.add.graphics());
    g.clear(); g.setDepth(depth - 0.01);
    const h = P._trailV105 || (P._trailV105 = []);
    if (!why) { h.length = 0; if (P._embersV105) P._embersV105.length = 0; return; }
    h.push({ x, y, t: P.t });
    const life = TU("trailMs", hot ? 300 : 230);
    while (h.length && P.t - h[0].t > life) h.shift();
    if (h.length > 28) h.splice(0, h.length - 28);
    const V = window.__V105 = window.__V105 || {};
    if (h.length < 3) return;
    V.trailFrames = (V.trailFrames || 0) + 1; if (hot) V.flameFrames = (V.flameFrames || 0) + 1;
    const spiral = why === "flight" && TU("spiralV105", 1);
    const W = (hot ? TU("trailWHot", 5.2) : TU("trailW", 3.4)) * Math.max(0.5, s);
    // the strands: one for a gust, two wound around the path for a spiral, and for fire an outer
    // red glow under an orange body under a near-white core
    const strands = hot ? [[0xff3d1a, 1.0, 0.42], [0xff9a2e, 0.62, 0.7], [0xfff1a8, 0.28, 0.95]] : why === "snap" ? [[0xfff4c4, 1.0, 0.7]] : [[0xdff2ff, 1.0, 0.62]];
    const n = h.length;
    for (const [col, wk, ak] of strands) for (let side = spiral ? -1 : 0; side <= (spiral ? 1 : 0); side += 2) {
      for (let i = 1; i < n; i++) {
        const a = h[i - 1], b = h[i], q = i / (n - 1);          // q: 0 at the tail, 1 at the ball
        let ax = a.x, ay = a.y, bx = b.x, by = b.y;
        if (spiral) {
          // a helix: each point pushed off the path, across its own direction of travel, by a
          // sine of its age — the two strands in antiphase read as the seam turning
          const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
          const r = TU("spiralR", 3.2) * Math.max(0.5, s) * (0.35 + 0.65 * q);
          const oa = Math.sin(a.t * TU("spiralRate", 0.05)) * r * side, ob = Math.sin(b.t * TU("spiralRate", 0.05)) * r * side;
          ax += nx * oa; ay += ny * oa; bx += nx * ob; by += ny * ob;
        }
        g.lineStyle(Math.max(0.4, W * wk * q), col, ak * q * (hot ? (0.85 + 0.15 * Math.sin(P.t / 23 + i)) : 1));
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.strokePath();
      }
    }
    if (hot) {
      // embers: thrown off the ball, drifting up and dying — the part of a fire that moves
      const E = P._embersV105 || (P._embersV105 = []);
      P._emberAccV105 = (P._emberAccV105 || 0) + dtms;
      while (P._emberAccV105 > TU("emberEveryMs", 34)) { P._emberAccV105 -= TU("emberEveryMs", 34);
        E.push({ x: x + (Math.random() - 0.5) * 4 * s, y: y + (Math.random() - 0.5) * 4 * s, vx: (Math.random() - 0.5) * 26, vy: -20 - Math.random() * 30, t: 0, life: 260 + Math.random() * 220, r: (1 + Math.random() * 1.6) * s }); }
      for (let i = E.length - 1; i >= 0; i--) { const em = E[i]; em.t += dtms; if (em.t > em.life) { E.splice(i, 1); continue; }
        em.x += em.vx * dtms / 1000; em.y += em.vy * dtms / 1000; em.vy += 24 * dtms / 1000;
        const k = 1 - em.t / em.life; g.fillStyle(k > 0.5 ? 0xffd27a : 0xff5a1f, 0.9 * k); g.fillCircle(em.x, em.y, em.r * (0.4 + 0.6 * k)); }
    }
  }
  heatKeyV105(P, idx) { const pay = P && P.payload || {}; return (pay.offense === "them" ? "them" : "us") + ":" + idx; }
  hotV105(P, idx) { const H = this._heatV105; if (!H || idx == null || idx < 0) return false; return (H[this.heatKeyV105(P, idx)] || 0) >= TU("heatHot", 3); }
  heatV105(P) {
    // the book, at the end of every play: production heats a man, an empty play cools everyone
    if (!P || !P.payload) return;
    const pay = P.payload, ev = String(pay.event || ""), H = this._heatV105 || (this._heatV105 = {});
    if (!/^(pass|run|incomplete|sack|turnover)$/.test(ev)) return;
    const yd = Number(pay.yards || 0), big = yd >= TU("heatBigYd", 15) || !!pay.scored;
    const side = pay.offense === "them" ? "them" : "us";
    const bump = (idx, amt) => { const k = side + ":" + idx; H[k] = Math.max(0, Math.min(TU("heatCap", 6), (H[k] || 0) + amt)); };
    const fin = P.carrierId;
    if (ev === "pass") bump(8, big ? 2 : 1); else if (ev !== "run") bump(8, -1);          // the arm
    if (fin != null && fin !== 8 && (ev === "pass" || ev === "run")) bump(fin, big ? 2 : yd >= 5 ? 1 : 0);   // the hands
    for (const k in H) if (k.startsWith(side + ":") && k !== side + ":8" && k !== side + ":" + fin) H[k] = Math.max(0, H[k] - TU("heatCool", 0.5));
    try { const V = window.__V105 = window.__V105 || {}; V.heat = Object.assign({}, H); V.plays = (V.plays || 0) + 1; } catch (e) {}
  }
  ballFrameV91(kind, k) {
    const cur = this.ballSpr && this.ballSpr.texture ? this.ballSpr.texture.key : null;
    if (!RIB.v91img || !this.ballSpr || !cur) { if (cur && cur !== "spr_ball" && this.textures.exists("spr_ball")) this.ballSpr.setTexture("spr_ball"); return 0; }
    const i = ((k % 12) + 12) % 12, key = "spr_ball_" + kind + i;
    if (!this.textures.exists(key)) return 0;
    if (cur !== key) this.ballSpr.setTexture(key);
    const V = (window.__V91 = window.__V91 || {}); V.ballFrames = (V.ballFrames || 0) + (this.ballSpr._lastV91 !== key ? 1 : 0); this.ballSpr._lastV91 = key;
    return kind === "spin" ? ((RIB_META_V91._ballAngles || [])[i] || 0) : 0;
  }
  celebrate(x, y) {
    try { this.refSignalTD(x, y); } catch (e) {}          // v45: nearest official signals the score, both arms up
    try { const P = this.play, cm = P && P.carrierId != null ? this.markers[P.carrierId] : null;   // v91: the scorer plays the drawn celebration
      if (cm && RIB.v91img && this.textures.exists("spr_" + cm.team + "_dn_celebrate0")) { cm.forceState = "celebrateSeq"; cm.seqT = cm.tms; } } catch (e) {}
    /* ===== v109 CELEBRATION VARIETY, AND A BENCH THAT SURGES =====
     * v91 celebrated the scorer alone while the other ten jogged to their gather spots. Now the
     * nearest two or three teammates turn to him (a different drawn cycle per facing) and join
     * on a staggered start (`celebrateStaggerMs`) from a random frame, each on his own cadence
     * (`_celRateV109`, ±20% of celebrateFrameMs, advanced by the glide branch); the other
     * eleven walk off on the walk cycle (`walkOffMs`); sideReact's td pushes a real bench surge. */
    try { const P = this.play, ci = P && P.carrierId != null ? P.carrierId : -1, cm = ci >= 0 ? this.markers[ci] : null;
      if (cm && cm.root && RIB.v91img && !REDUCED_MOTION && TU("celebrateJoinV109", 1)) {
        const V = this.v109E(), fm = TU("celebrateFrameMs", 170), off9 = ci < 11;
        const pool9 = this.markers.map((m, i) => ({ m, i, d: Math.hypot(m.sx - cm.sx, m.sy - cm.sy) }))
          .filter(q => q.i !== ci && (q.i < 11) === off9 && q.m.root && !/^(tackleSeq|down|pancakeSeq|getupSeq)$/.test(String(q.m.forceState || "")))
          .sort((a, b) => a.d - b.d);
        // the nearest men run in; on a long score nobody is inside the radius, and a scorer
        // celebrating alone in the end zone is the one thing that never happens — the closest
        // two celebrate where they are, turned toward him
        let near = pool9.filter(q => q.d < TU("celebrateJoinPx", 260)).slice(0, 2 + (Math.random() < 0.5 ? 1 : 0));
        if (!near.length) near = pool9.slice(0, TU("celebrateFarJoin", 2));
        near.forEach((q, k) => { const m = q.m, rate = 0.8 + Math.random() * 0.4;
          this.time.delayedCall(60 + k * TU("celebrateStaggerMs", 110) + Math.random() * 60, () => { if (!m.root || m._post) return;
            const a = PJ(m.sx, m.sy), b = PJ(cm.sx, cm.sy); this.faceMarker(m, b.x - a.x, b.y - a.y);
            m.forceState = "celebrateSeq"; m.seqT = m.tms - Math.floor(Math.random() * 4) * fm; m._celRateV109 = rate; m._lean = 0; m._dropback = false; m._walk = false;
            V.celebrants++; }); });
        cm._celRateV109 = 1; V.celebrations++; V.lastCelebrants = 1 + near.length;
        V.lastJoin = { n: near.length, d: near.map(q => Math.round(q.d)), all: this.markers.map((m, i) => (i < 11) === off9 && i !== ci ? Math.round(Math.hypot(m.sx - cm.sx, m.sy - cm.sy)) : null).filter(d => d != null).sort((x, y) => x - y).slice(0, 4) };
        this.markers.forEach((m, i) => { if ((i < 11) !== off9 && m.root) { m._walkOffV109 = performance.now() + TU("walkOffMs", 900); V.walkOffs++; } });
        const S9 = this.side; if (S9) { S9.surge = { t: 0, ms: TU("sideSurgeMs", 1600), team: cm.kit || (off9 ? "off" : "def") }; V.surges++; }
      }
    } catch (e) {}
    { const P = this.play, pay = P && P.payload || {};   // v95: the badge is the TOUCHDOWN text, anchored on the crossing
      BADGE_V95.show("touchdown", { sub: pay.event === "run" || pay.event === "pass" ? badgeYdsV95(pay.yards).replace("+", "") : "", x, y, scene: this, token: "td:" + (P ? P.__ballTokenV1514 : Date.now()) }); }
    const cp = PJ(x, y); x = cp.x; y = cp.y;
    REDUCED_MOTION || this.cameras.main.shake(220, 0.005);
    for (let i = 0; i < 22; i++) {
      const c = this.trackFx(this.add.rectangle(x, y, 5, 9, mt.Display.Color.RandomRGB().color).setDepth(19));
      this.tweens.add({ targets: c, x: x + mt.Math.Between(-130, 130), y: y + mt.Math.Between(-110, 110),
        angle: mt.Math.Between(-180, 180), alpha: 0, duration: mt.Math.Between(400, 680), onComplete: () => this.dropFx(c) });
    }
  }
  highlight(d, isMe) {
    if (!d) return;
    if (isMe) {
      d.kitSide = d.kit && d.kit !== "you" ? d.kit : (d.kitSide || "off");   // v96/v105.2: his own team's palette, whichever side of the ball he plays — the plumbob says which one he is
      ribSyncYouKitV96(this, d.kitSide);
      try { const V = window.__V105_2 = window.__V105_2 || {}; V.you = { side: d.team, kitSide: d.kitSide }; } catch (e) {}
      this.setTeam(d, "you");
      /* ===== v70 PLUMBOB — the you-marker is a crystal over the head, not an aura =====
       * v18 stacked four gold effects on the GROUND under your player: a pulsing glow
       * disc, a bright pulsing ring, four spinning arc segments, and a bobbing chevron.
       * On a 22-man field that is a lot of moving gold in the one place the eye is
       * already busy — the turf, where the ball, the line of scrimmage, the first-down
       * marker and twenty-one other pairs of feet all live. It also washed out at the
       * exact moment it mattered: inside a pile, the aura is under the pile.
       *
       * A Sims plumbob solves both. It sits in EMPTY SPACE above the head, where
       * nothing else is drawn, so it survives a pile and a zoom-out; and because it
       * spins it reads as "this one" instantly without pulsing at you. It is drawn
       * per frame (drawPlumbob) rather than tweened, because the rotation IS the
       * silhouette changing shape — there is no sprite to rotate.
       *
       * The ground keeps the SAME plain ring every other player gets, in gold rather
       * than white. That is the marker, not an aura: it says where his feet are. */
      d.ring = this.trackFx(this.add.ellipse(d.root.x, d.root.y + 13, 30, 12).setStrokeStyle(2, 0xffd257, 0.9).setDepth(3.8));
      d.bob = this.trackFx(this.add.graphics().setDepth(23));
      let nm = ""; try { const st = window.__getGridironState && window.__getGridironState(); nm = (st && st.player && st.player.name) || ""; } catch (e) {}
      const parts = nm.trim().split(/\s+/);
      const tagTxt = (parts.length > 1 ? parts[0][0] + ". " + parts.slice(1).join(" ") : (nm || "YOU")).toUpperCase().slice(0, 14);
      d.tag = this.trackFx(this.add.text(d.root.x, d.root.y + 24, tagTxt, { fontFamily: "Oswald, sans-serif", fontSize: "10px", fontStyle: "bold", color: "#ffe9ad", stroke: "#0a0f16", strokeThickness: 3 }).setOrigin(0.5).setDepth(23));
      this.placeMarker(d, d.sx, d.sy, 16);
    } else {
      d.ring = this.trackFx(this.add.ellipse(d.root.x, d.root.y + 13, 28, 11).setStrokeStyle(2, 0xffffff, 0.75).setDepth(3.8));
      this.placeMarker(d, d.sx, d.sy, 16);
    }
  }
  cancel() { this.stopActiveAnimation(); }
  stopActiveAnimation() {
    this.play = null; this.resetCamera();
    this.tweens.killAll(); this.time.removeAllEvents();
    this.completion = void 0; this.killAllFx(); this.clearActors();
    if (this.trail) this.trail.clear();
  }
  complete() { try { this.heatV105(this.play); } catch (e) {} if (this.ballTrailG) this.ballTrailG.clear();   // v105
    const et = this.completion; this.completion = void 0; this.play = null; et?.(); }
  clearActors() {
    this.clearRefs();
    for (const et of this.markers) {
      try { et.root.destroy(true); } catch (e) {}
      try { et.ring && et.ring.destroy(); } catch (e) {}
      try { et.tag && et.tag.destroy(); } catch (e) {}
      try { et._qTxt && this.dropFx(et._qTxt); } catch (e) {}   // v81
      et._pair = null;   // v83
    }
    this.markers = [];
    if (this.ballSpr) { try { this.ballSpr.destroy(); } catch (e) {} this.ballSpr = void 0; }
    if (this.ballShad) { try { this.ballShad.destroy(); } catch (e) {} this.ballShad = void 0; }
    if (this.ballTrailG) { try { this.ballTrailG.destroy(); } catch (e) {} this.ballTrailG = void 0; }   // v105
  }
  // v23 SCRAMBLE WARNING: a red ❗ that floats over a defender's head the moment he
  // breaks through the line and bears down on the QB — telegraphing that a
  // scramble (or sack) is coming so the player can read it live. The badge is a
  // child of the marker container, so it tracks + depth-scales with the defender.
  alertMark(m, on) {
    if (!m || !m.root || !m.root.scene) return;
    if (on) {
      if (!m.alert || !m.alert.scene) {
        m.alert = this.add.text(0, -30, "❗", { fontFamily: "Oswald, sans-serif", fontSize: "18px", fontStyle: "bold", color: "#ff5a5a" }).setOrigin(0.5);
        m.alert.setStroke("#2a0808", 3);
        try { m.root.add(m.alert); } catch (e) {}
        m._alertTw = this.tweens.add({ targets: m.alert, y: -36, scale: 1.18, yoyo: true, repeat: -1, duration: 300, ease: "Sine.easeInOut" });
      }
      m.alert.setVisible(true);
    } else if (m.alert) {
      m.alert.setVisible(false);
    }
  }
  clearAlerts() { for (const m of this.markers) { if (m && m.alert) m.alert.setVisible(false); } }
  staticFormation(losAbs, usOff) {
    this.clearActors();
    const it = usOff ? 1 : -1, ht = PLAY_L + (losAbs / 100) * PLAY_W;
    const d = [78,372,306,158,190,222,254,286,222,262,120], c = [78,372,140,306,172,222,276,150,206,242,295];
    this.offLabels.forEach((h, r) => {
      const n = h === "QB" ? -38 : h === "RB" ? -54 : h === "WR" && r === 10 ? -10 : 0;
      const m = this.marker(ht + it * n, d[r] ?? 222, "off", OFF_NUMS[r], 0, -1);
      m.homeDir = "up"; m.posLabel = h; m.actorId = "off" + r;
      if (window.__RIB20_applyAppearance) window.__RIB20_applyAppearance(this, m, h, r);
      if (h === "OL") { m.isLine = true; m.forceState = "stance"; }
      this.placeMarker(m, m.sx, m.sy, 16);
      this.markers.push(m);
    });
    this.defLabels.forEach((h, r) => {
      const n = h === "S" ? 88 : h === "LB" ? 52 : h === "CB" ? 25 : 15;
      const m = this.marker(ht + it * n, c[r] ?? 222, "def", DEF_NUMS[r], 0, 1);
      m.homeDir = "dn"; m.posLabel = h; m.actorId = "def" + r;
      if (window.__RIB20_applyAppearance) window.__RIB20_applyAppearance(this, m, h, r + 11);
      if (h === "DE" || h === "DT" || h === "DL") { m.isLine = true; m.forceState = "stance"; }
      this.placeMarker(m, m.sx, m.sy, 16);
      this.markers.push(m);
    });
    this.resolveOverlaps();
  }
  marker(sx, sy, team, num, faceDx, faceDy, kit) {
    kit = kit || team;   // v105.2: the palette he wears; the side is `team`
    const shadow = this.add.ellipse(0, 24, 26, 9, 0x000000, 0.32);
    const fill = this.add.ellipse(0, 24, 26, 9, 0x000000, 0.14);   // v101: the second lamp's softer cast
    const initialKey = this.textures.exists("spr_" + kit + "_dn_idle") ? "spr_" + kit + "_dn_idle" : "rib_player_fallback";
    const body = this.add.image(0, 0, initialKey);
    if (initialKey === "rib_player_fallback") body.setTint(kit === "def" ? 0xe86560 : kit === "you" ? 0xf0bb45 : 0x5fce74);
    // v104: rasterized ONCE at the larger base size and scaled down per frame (the sharp
    // direction) — the old path re-set the font size on every marker on every frame.
    const label = this.add.text(0, -3, String(num), numStyleV104(team)).setOrigin(0.5);
    { const sw = TU("numStroke", 2.2); if (sw > 0) label.setStroke("#0a0e14", sw); }
    const root = this.add.container(0, 0, [fill, shadow, body, label]).setDepth(4);
    const m = { root, body, label, shadow, fill, team, kit, num, sx, sy, dirKey: "dn", flip: false, ft: 0, hd: null, cutUntil: 0, tms: 0 };
    if (faceDx != null) this.faceMarker(m, faceDx, faceDy || 0);
    this.placeMarker(m, sx, sy, 16);
    return m;
  }
  /* ===== v83 BLOCK FACING + 2.5D =====
   * A blocker used to hold his pre-snap facing for the whole block ("engaged
   * linemen hold their facing"), so a guard driving his man sideways or a tight end
   * sealing an end was drawn square to the line, and an engaged pair stood on one
   * screen column with the nearer sprite hiding the other. The sim now says who has
   * hands on whom (`engage`, `block`, `blockWin`, `pickup`, `chip`; `shed`, `swim`,
   * `pancake`, `stuntWin`, `disengage` end it), and each man in a pair SQUARES UP to
   * his partner every frame — up, down or side frames by the direction to him — with
   * the block frames cycling faster while the pair is moving (a drive) than while it
   * is a stalemate. Paired sprites are also NUDGED apart laterally on screen, and the
   * offensive man lifts a hair in depth, so both bodies read (2.5D), not one. */
  pairUp(i, j) {
    const a = this.markers[i], b = this.markers[j];
    if (!a || !b || a === b) return;
    if (a._pair != null && a._pair !== j) this.unpair(i);
    if (b._pair != null && b._pair !== i) this.unpair(j);
    a._pair = j; b._pair = i; a._pairT = a.tms; b._pairT = b.tms;
  }
  unpair(i) {
    const a = this.markers[i]; if (!a || a._pair == null) return;
    const b = this.markers[a._pair]; if (b && b._pair === i) b._pair = null;
    a._pair = null;
  }
  faceMarker(m, dx, dy) {
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax > 2.414 * ay) { m.dirKey = "sd"; m.flip = dx > 0; }
    else if (ay > 2.414 * ax) { m.dirKey = dy < 0 ? "up" : "dn"; m.flip = false; }
    else if (dy > 0) { m.dirKey = "dr"; m.flip = dx > 0; }      // down diagonals
    else { m.dirKey = "ur"; m.flip = dx > 0; }                  // up diagonals
  }
  /* ===== v109 THE FEET PLANT — he leans into it, the facing turns through the crossover =====
   * `m._lean` was drawn every frame (`body.setRotation`) and set only for the QB's tuck and the
   * drag. `leanV109` gives every running man one: the signed rate of his motion heading,
   * smoothed, leans him INTO the turn (the horizontal component of the centripetal direction,
   * so a man running up the screen who bends right tips right) up to leanMax and decays back
   * upright at leanDecay. It never overrides a lean someone else set — a tuck, a drag, a
   * stumble (`m._leanSrc`) — and hands the rotation back to zero when it is done. The drawn
   * facing is rate-limited here too: `faceMarker` quantises to eight buckets with no memory,
   * so a 180° reversal flipped in one frame; a running man's facing now steps at most
   * faceStepRad a frame, so the reversal passes through the side profile — the crossover. */
  faceAngV109(m) {
    const k = m.dirKey;
    return k === "sd" ? (m.flip ? 0 : Math.PI) : k === "up" ? -Math.PI / 2 : k === "dn" ? Math.PI / 2
      : k === "ur" ? (m.flip ? -Math.PI / 4 : -3 * Math.PI / 4) : (m.flip ? Math.PI / 4 : 3 * Math.PI / 4);
  }
  leanV109(m, dtms, spdPx, lineLocked, engaged, hd) {
    const dt = Math.max(1, dtms || 16) / 1000, H = this.hookV109();
    const wrap = d => { while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
    const running = !m.forceState && !lineLocked && !engaged && !m._dropback && !m._lookAt && spdPx > 34;
    if (running && m._faceAngV109 != null && TU("faceStepV109", 1)) {
      const step = wrap(this.faceAngV109(m) - m._faceAngV109), cap = TU("faceStepRad", 1.6);
      if (Math.abs(step) > cap) {   // too far for one frame: draw the bucket part-way round and finish next frame
        const sgn = Math.abs(Math.abs(step) - Math.PI) < 1e-6 ? ((m._hdRateV109 || 0) >= 0 ? 1 : -1) : Math.sign(step);
        const mid = m._faceAngV109 + sgn * cap; this.faceMarker(m, Math.cos(mid), Math.sin(mid)); H.face.steps++; }
      const drawn = Math.abs(wrap(this.faceAngV109(m) - m._faceAngV109));
      H.face.n++; H.face.max = Math.max(H.face.max, Math.round(drawn * 1000) / 1000); if (drawn > 2.6) H.face.flips++;
      m._faceStepMaxV109 = Math.max(m._faceStepMaxV109 || 0, drawn);   // per marker, for the check
    }
    m._faceAngV109 = this.faceAngV109(m);
    // the heading rate, off the motion heading placeMarker just measured
    const sm = TU("leanSmooth", .7);
    if (m._hdPrevV109 != null && hd != null && spdPx > 30) m._hdRateV109 = (m._hdRateV109 || 0) * sm + (wrap(hd - m._hdPrevV109) / dt) * (1 - sm);
    else m._hdRateV109 = (m._hdRateV109 || 0) * sm;
    if (spdPx > 4) m._hdPrevV109 = hd;
    const foreign = m._leanSrc != null ? m._leanSrc !== "turn" : ((m._lean || 0) !== 0 && (m._lean || 0) !== (m._leanV109 || 0));
    if (foreign) { m._leanV109 = 0; return; }           // a tuck, a drag or a stumble owns the lean
    const lim = TU("leanMax", .28);
    const target = m.forceState || spdPx < 30 || hd == null ? 0 : Math.max(-lim, Math.min(lim, -Math.sin(hd) * (m._hdRateV109 || 0) * TU("leanK", .05)));
    let L = (m._leanV109 || 0) + (target - (m._leanV109 || 0)) * Math.min(1, dt * TU("leanDecay", 9));
    if (target === 0 && Math.abs(L) < 0.004) L = 0;
    m._lean = L; m._leanV109 = L; m._leanSrc = L === 0 ? null : "turn";
    if (L !== 0) { H.leans.n++; H.leans.max = Math.max(H.leans.max, Math.round(Math.abs(L) * 1000) / 1000); }
  }
  /* the run cadence's special cases: the plant (the feet stop, the cycle stalls), the stumble (the
   * hurt frames at half cadence), the jog and the man who gave up (a slowed cycle, the walk) */
  cadenceV109(m, dtms) {
    const dt = dtms || 16, H = this.hookV109();
    if (m._plantUntilV109 > m.tms) { H.plantFrames++; return "plant"; }
    if (m._downUntilV109 > m.tms && m.sSm < TU("downHoldSpd", 14)) return "down";   // the sim's clock keeps him on the turf
    const SB = m._stumbleV109;
    if (SB) {
      if (m.tms >= SB.until) { m._stumbleV109 = null; if (m._leanSrc === "stumble") { m._leanSrc = null; m._lean = 0; m._leanV109 = 0; } }
      else if (m.sSm >= 8) { m.ft += dt * Math.min(2.4, m.sSm / 58) * TU("stumbleCadence", .5); H.stumbleFrames++;
        return "hurt" + (Math.floor((m.tms - SB.t0) / Math.max(40, TU("stumbleMs", 250) / 2)) % 2); }
    }
    const E = m._effortV109;
    if (E && m.sSm >= 8 && m.tms >= m.cutUntil) { H.jogFrames++;
      if (E === "givesUp") { m.ft += dt; return "walk" + (Math.floor(m.ft / TU("walkFrameMs", 190)) % 2); }
      m.ft += dt * Math.min(2.4, m.sSm / 58) * TU("jogCadence", .65); return "run" + (Math.floor(m.ft / 96) % (window.__RIB_FRAMES || 4)); }
    return null;
  }
  /* which side the contact came from, in SCREEN x: the sim's `side` (C1: +1 when the defender is
   * on the carrier's low-y side) mapped through the projection, or the two markers themselves */
  sideV109(e, m, other) {
    let sgn = null;
    if (m && m.root && (e.side === 1 || e.side === -1)) { const a = PJ(m.sx, m.sy), b = PJ(m.sx, m.sy - e.side * 10); sgn = Math.sign(b.x - a.x) || null; }
    if (sgn == null && m && m.root && other && other.root) sgn = Math.sign(PJ(other.sx, other.sy).x - PJ(m.sx, m.sy).x) || null;
    return sgn || (Math.random() < .5 ? -1 : 1);
  }
  stumbleV109(m, sideSgn, ms) {
    if (!m || !m.root) return;
    const H = this.hookV109(); H.stumbles++;
    m._stumbleV109 = { t0: m.tms, until: m.tms + (ms || TU("stumbleMs", 250)), side: sideSgn };
    m._lean = -sideSgn * TU("stumbleLean", .22); m._leanSrc = "stumble"; m._leanV109 = 0;   // knocked AWAY from the contact
  }
  /* ===== v105.2 THE KIT FOLLOWS THE TEAM =====
   * The kits are registered by PALETTE — "off" is the user's team's colours, "def" the
   * opponent's — but every marker was dressed by its SIDE (`a.side === "off" ? "off" : "def"`),
   * so on any play where the user's team was defending, the offense on the field (the
   * opponent) wore the user's colours and the user's defense wore the opponent's; v96 then
   * dressed the you-player to match the wrong side. A marker now carries two things: `m.team`,
   * the side, which the depth and gameplay rules keep reading, and `m.kit`, the palette it
   * wears, chosen from possession (`kitForV105_2`). `window.__V105_2` is what the check reads. */
  kitForV105_2(side, et) {
    // the user's team wears "off" (its own palette) whichever side of the ball it is on
    const usOff = !et || et.offense !== "them";
    return (side === "off") === usOff ? "off" : "def";
  }
  setTeam(m, team, kit) {
    m.team = team; m.kit = kit || (team === "you" ? "you" : m.kit || team);
    m.label.setColor("#ffffff");   // v96: the same number as the rest of his team
    const k = "spr_" + m.kit + "_" + m.dirKey + "_idle";
    const use = this.textures.exists(k) ? k : "rib_player_fallback";
    m.body.setTexture(use); m.tex = use;
    if (use === "rib_player_fallback") m.body.setTint(m.kit === "def" || (m.kit === "you" && m.kitSide === "def") ? 0xe86560 : 0x5fce74); else m.body.clearTint();
  }
  /* v70 — one octahedron, orthographic, drawn straight into a Graphics. The
   * silhouette WIDTH is the rotation (a diamond seen edge-on is narrow, face-on is
   * wide) and the near vertical crease sweeps across it, which is the whole read;
   * a spinning sprite would have to be an animation, and a tween on `angle` would
   * only tip it over rather than turn it. `hot` is the gassed state, because a
   * plumbob that also carries mood is the reason the Sims one works. */
  drawPlumbob(g, tms, sc, hot) {
    const R = TU("bobW", 6.6) * sc, H = TU("bobH", 9.6) * sc;
    const th = tms / Math.max(120, TU("bobSpinMs", 1700)) * Math.PI * 2;
    const W = R * (0.42 + 0.58 * Math.abs(Math.cos(th)));   // never fully edge-on: an
    const seam = W * Math.sin(th) * 0.74;                    // invisible marker is no marker
    const dark = hot ? 0x9c3524 : 0xb8801a, lit = hot ? 0xff8a5c : 0xffdf78, edge = hot ? 0xffd3bd : 0xfff4c8;
    g.clear();
    const dia = (x0, x1) => { g.beginPath(); g.moveTo(0, -H); g.lineTo(x1, 0); g.lineTo(0, H); g.lineTo(x0, 0); g.closePath(); };
    // a dark outline first, or the crystal disappears into a bright crowd behind it
    g.lineStyle(2.6 * sc, 0x080d14, 0.62); dia(-W, W); g.strokePath();
    g.fillStyle(dark, 0.97); dia(-W, W); g.fillPath();       // the far facet, as the whole body
    g.fillStyle(lit, 0.98); dia(-W, seam); g.fillPath();     // the near facet over its share of it
    g.lineStyle(1.1 * sc, edge, 0.92); dia(-W, W); g.strokePath();
    g.lineStyle(0.9 * sc, edge, 0.5);                        // the crease between the two facets
    g.beginPath(); g.moveTo(0, -H); g.lineTo(seam, 0); g.lineTo(0, H); g.strokePath();
    // a specular chip high on the lit facet — what makes it read as cut glass
    g.fillStyle(0xffffff, 0.55);
    g.beginPath(); g.moveTo(-W * 0.30, -H * 0.44); g.lineTo(-W * 0.06, -H * 0.22); g.lineTo(-W * 0.32, -H * 0.06); g.closePath(); g.fillPath();
    // what the frame actually drew, for scripts/bobcheck.mjs — the rotation is the
    // silhouette, and the silhouette is not readable back out of a command buffer
    g._bobW = W; g._bobSeam = seam;
  }
  /* v104: put the number where the jersey is. The band came off the ART at register time
   * (numBandV104), so a crouched stance, a block frame and a full sprint each carry their own
   * waistline; the number is hung from that waist at a height held CONSTANT in cell rows, so
   * it never breathes through a run cycle, then clamped inside the band at both ends. Cell
   * rows are multiplied by the body's own height trait — the number is on the shirt, not
   * floating at a fixed screen size in front of it. */
  numPlaceV104(m, rear) {
    const L = m.label; if (!L) return;
    const b = RIB.numBandTex[m.tex] || NUM_BAND_FALLBACK_V104;
    const met = numFontV104(this);
    const H = m.body.scaleY || 1, Wb = Math.abs(m.body.scaleX || 1);
    // the numeral is a CONSTANT height in cell rows — it must not breathe through a run cycle.
    // A jersey too short for it gives up its breathing room at the waist FIRST, and only a pose
    // with almost no shirt left to write on (doubled over, tucked around a caught ball) shrinks
    // the numeral itself, rather than letting it spill out onto the pants.
    const room = b.waist - b.top - 0.5;
    const cap = Math.min(TU("numCellH", 6), room), half = cap / 2;
    const gap = Math.max(0, Math.min(TU("numWaistGap", 1), room - cap));
    // the back number rides the shoulder blades, the chest number sits a touch lower
    let row = b.waist - (rear ? TU("numRearRise", 8) : TU("numFrontRise", 6));
    const hi = b.top + half + 0.5, lo = b.waist - half - gap;
    row = Math.max(hi, Math.min(Math.max(hi, lo), row));                   // never the helmet, never the pants
    let sc = cap * H / Math.max(1, met.cap);
    // and never wider than the chest it is painted on (a two-digit number in a fallback face)
    const maxW = b.w * Wb * TU("numWidthK", 0.62);
    if (L.width * sc > maxW) sc = maxW / Math.max(1, L.width);
    L.setScale(sc);
    L.setY((row + 0.5 - NUM_CELL_V104 / 2) * H - met.mid * sc);
    m._numRowV104 = row; m._numScaleV104 = sc; m._numCapV104 = cap; m._numRearV104 = !!rear; m._numBandV104 = b;
    RIB.numLast = m; RIB.numPlaced = (RIB.numPlaced || 0) + 1;   // the hook below reads these; no per-frame garbage
  }
  /* ===== v112 THE HIT HAS WEIGHT (renderer) =====
   * `_launchUntil` / `_launchH` is a LIFT, not a flight: a fixed height, on a fixed sin() hump,
   * for a fixed number of milliseconds — three numbers with nothing to do with one another, so a
   * man levelled by a free safety rose exactly as far, and for exactly as long, as a man who
   * hopped for a catch. A man who has been levelled is not lifted. He is THROWN.
   * So a launch here is a real projectile. The sim hands over ONE number, `flyVz` (the vertical
   * speed he left the ground with); `launchG` is the gravity; and the hang (2·vz/g), the peak
   * (vz²/2g) and the whole shape of the arc fall out of those two — there is no height dial to
   * fight the duration. The GROUND is not invented here either: the drawn body simply LAGS the
   * script's own position by the ground he has not covered yet, so he flies back along the line
   * the sim already knocked him down, lands SHORT of the booked spot, and skids the last
   * `launchSkid` of it along the turf with a bounce scaled by what energy is left. The lag is
   * zero the frame the skid ends, so the spot, the yardage and every man's resting place are
   * exactly what they would be with `launchV112` off — the arc is presentation over a result
   * that was booked before it started. He lands in `down`, which is where the v86 gather and the
   * get-up path already pick a man up off the turf. */
  hookV112F() { return window.__V112_F = window.__V112_F || { launches: 0, lands: 0, ends: 0, airborne: 0, maxLift: 0, flying: 0, samples: [] }; }
  // the flight's hang time in REAL milliseconds — the play clock runs at the live speed dial times
  // basePlayRate, so a fixed wait would put the callout mid-air at ½× and long after him at 4×
  /* ===== v139 THE LUNGE HAS A SIZE =====
   * Every committed tackle leapt exactly 17px, whether it was a linebacker closing at full speed
   * from eight yards or a lineman falling forward onto a back who ran into him. The leap is the
   * lunge's OWN force now — the closing momentum and the impact the sim already put on the
   * event — so a hit you can hear looks like one, and a wrap looks like a wrap. */
  lungeV139(e) { return window.__V139.lunge(e); }
  flyBadgeMsV112(vz) {
    const rate = Math.max(.15, (window.__getGridironLiveSpeed ? window.__getGridironLiveSpeed() : 1) * TU("basePlayRate", .7));
    return Math.round(Math.min(TU("launchBadgeMaxMs", 1500), (2 * Number(vz || .12) / Math.max(1e-5, TU("launchG", .001))) / rate));
  }
  flyStartV112(m, vz, spin) {
    if (!m || !TU("flyV112", 1) || !(Number(vz) > 0)) return false;
    const g = Math.max(1e-5, TU("launchG", .001)), v = Number(vz);
    const dur = 2 * v / g, peak = v * v / (2 * g);                       // the hang and the height are the same measurement
    m._flyV112 = { t0: m.tms, dur, g, vz: v, peak, x0: m.sx, y0: m.sy, k: 0, lift: 0, landed: false,
      skid: TU("launchSkid", .22), skidMs: Math.round(TU("launchSkidMs", 150) + dur * TU("launchSkidK", .5)),
      bh: peak * TU("launchBounceK", .17), bFrac: TU("launchBounceFrac", .55), spin: (spin || 1) * TU("launchSpin", .38) };
    m._launchUntil = 0; m._launchH = 0; m._launchT0 = 0;   /* v139: the hop is over — the flight owns his height now */
    m._lean = 0; m._leanSrc = null; m._leanV109 = 0; m._stumbleV109 = null;
    m.forceState = "dive"; m._groundT = 0;
    const V = this.hookV112F(); V.launches++;
    V.samples.push({ vz: +v.toFixed(4), dur: Math.round(dur), peak: +peak.toFixed(2) });
    if (V.samples.length > 40) V.samples.shift();
    return true;
  }
  placeMarker(m, sx, sy, dtms) {
    const dx = sx - m.sx, dy = sy - m.sy;
    m.prevSx=m.sx; m.prevSy=m.sy;
    m.sx = sx; m.sy = sy; m.tms += (dtms || 16);
    const spdPx = Math.hypot(dx, dy) / Math.max(1, dtms || 16) * 1000;
    m.sSm = m.sSm == null ? spdPx : m.sSm * 0.7 + spdPx * 0.3;   // v11: smoothed speed kills state flicker
    const lineLocked = m.isLine && !m.forceState && m.sSm < TU("blockBand",78);   // engaged linemen hold their facing
    if (spdPx > 34 && !m.forceState && !lineLocked) {
      const p0 = PJ(sx - dx, sy - dy), p1 = PJ(sx, sy);
      this.faceMarker(m, p1.x - p0.x, p1.y - p0.y);       // facing in SCREEN space (NS aware)
    }
    if (lineLocked && m.homeDir) { m.dirKey = m.homeDir; m.flip = false; }
    // v86: a QB dropping back backpedals facing the line; a target with the ball in the
    // air runs with his head turned to it — the side profile toward the ball
    if ((m._dropback || m._meshFaceV118) && !m.forceState) { m.dirKey = m.homeDir || "up"; m.flip = false; }   // v118: and a QB stepping to the mesh keeps his back to the camera
    else if (m._lookAt && !m.forceState && spdPx > 34) {
      // v109: the head turns on the QUARTER facing toward the ball — the up quarter for a ball
      // upfield of him, the down quarter for one coming from below; the profile only when it is level
      const bx = m._lookAt.x - m.root.x, by = m._lookAt.y == null ? 0 : m._lookAt.y - m.root.y;
      if (m._lookAt.y == null || Math.abs(bx) > TU("lookProfileK", 2.414) * Math.abs(by)) { m.dirKey = "sd"; m.flip = bx > 0; }
      else { m.dirKey = by < 0 ? "ur" : "dr"; m.flip = bx > 0; }
    }
    // v83: a man with hands on someone faces THAT man, whatever the line's home facing
    let engaged = null;
    if (m._pair != null) { const pm = this.markers[m._pair];
      if (pm && pm.root && Math.hypot(pm.sx - sx, pm.sy - sy) < TU("engagePx", 34)) { engaged = pm;
        const p0 = PJ(sx, sy), p1 = PJ(pm.sx, pm.sy); this.faceMarker(m, p1.x - p0.x, p1.y - p0.y);
        m._engFace = m.dirKey; }
      else if (pm && Math.hypot(pm.sx - sx, pm.sy - sy) > TU("engageBreakPx", 60)) this.unpair(this.markers.indexOf(m)); }
    const hd = Math.atan2(dy, dx);
    let cutSkid = false;
    if (m.hd != null && spdPx > 30 && !lineLocked) { let d = Math.abs(hd - m.hd); if (d > Math.PI) d = 2 * Math.PI - d;
      if (d > 0.9) { if (m.tms >= m.cutUntil) cutSkid = true; m.cutUntil = m.tms + 160; } }
    if (spdPx > 4) m.hd = hd;
    this.leanV109(m, dtms, spdPx, lineLocked, engaged, m.hd);   // v109: the lean, and the facing's rate
    let st;
    if (m.forceState) {
      st = m.forceState;
      if (st === "stance" && (m.num % 2)) st = "stance2";
      if (st === "throwSeq") {                       // 6-frame throwing motion, 85ms/frame
        const fi9 = Math.floor((m.tms - (m.seqT || 0)) / TU("throwFrameMs", 85));
        if (fi9 >= TU("throwSeqFrames", 7)) { m.forceState = null; st = "idle"; m._thrRecV107 = null; m._thrDirV108 = null; }
        else { const tf = Math.min(5, fi9); st = "throw" + (m._thrDirV108 || "") + tf;   // v108: R or L when the side is drawn
          // v107: only the baked cycle has one facing to force; a drawn one keeps the mirror
          // `faceMarker` gave it, so a throw to his left comes out the other way round
          if (!(RIB.throwV107 && RIB.throwV107[m.dirKey])) m.flip = false;
          const rc = m._thrRecV107;
          if (rc && rc.frames[rc.frames.length - 1] !== tf) { rc.frames.push(tf);
            if (tf === rc.releaseFrame && rc.relMs == null) rc.relMs = this.play ? this.play.t : 0; }
        }
      }
      if (st === "handSeq") {                         // v108: the exchange — the reach, the arm's length, the empty hand
        const E = m._exV108, fi8 = E ? Math.floor((m.tms - (m.seqT || 0)) / E.fm) : 1e9;
        if (!E || fi8 >= E.n) { m.forceState = null; m._exV108 = null; st = m.sSm > 8 ? "run0" : "idle"; }
        else { st = E.st + Math.min(E.n - 1, fi8);
          const V8 = v108Hook(); V8[E.st === "toss" ? "tossFrames" : "handoffFrames"] = (V8[E.st === "toss" ? "tossFrames" : "handoffFrames"] || 0) + 1; }
      }
      if (st === "tackleSeq") {                       // 6-frame fall to the turf, then HOLD flat
        const fi = Math.floor((m.tms - (m.seqT || 0)) / TU("tackleFrameMs", 70));
        st = "tackle" + Math.min(5, fi);              // clamps on the final grounded frame — he stays down
        // v21.2: kick up a spray of turf the instant the body hits the ground (once per takedown)
        if (fi >= 4 && m._puffSeq !== m.seqT) { m._puffSeq = m.seqT; this.puffFx(sx, sy + 3, 3, 0x8a7a55, 0.42); }
      }
      // Uploaded pose sheets provide true frame-by-frame action silhouettes.
      // These are brief overlays only; actor movement and play outcomes remain
      // driven by the simulation frames underneath.
      if (m._pumpV109 && m.seqT === m._pumpSeqTV109 && st.indexOf("throw") === 0 && m.tms >= (m._pumpAbortV109 || 0)) {   // v109: the pump aborts before the release frame — pinned to the fake's OWN sequence, never a real throw's
        m.forceState = null; m._thrDirV108 = null; m._pumpV109 = 0; st = m.sSm > 8 ? "run0" : "idle"; }
      if (st === "catchhold") {                        // v109: the tuck — held to _tuckV109 after the catch, then the run cycle
        if (!m._tuckV109 || m.tms >= m._tuckV109) { m.forceState = null; m._tuckV109 = 0; st = m.sSm > 8 ? "run0" : "idle"; }
        else { const B = window.__V109_B = window.__V109_B || {}; B.catchHoldFrames = (B.catchHoldFrames || 0) + 1; }
      }
      const actionSeq = {
        catchSeq:["catch",3,90], diveCatchSeq:["divecatch",3,95],
        catchseqSeq:["catchseq" + (m._csVarV109 || 0) + "_", 4, TU("catchSeqFrameMs", 75)],   // v109: the sheet's own catch, variant by the KIND of the reach
        jukeSeq:["juke",4,65], stiffSeq:["stiff",4,70], hurdleSeq:["hurdle",3,105],
        pancakeSeq:["pancake",3,90], getupSeq: RIB.v91img ? ["getup",8,TU("getupFrameMs",85)] : ["getup",4,105],
        celebrateSeq:["celebrate",4,TU("celebrateFrameMs",170)]   // v91: loops for celebrateMs, then stands
      }[st];
      if (actionSeq) {
        const af = Math.floor((m.tms - (m.seqT || 0)) / actionSeq[2]);
        if (st === "celebrateSeq") {
          if (m.tms - (m.seqT || 0) > TU("celebrateMs", 2400)) { m.forceState = null; st = "idle"; }
          else st = "celebrate" + (af % 4);
        } else if (af >= actionSeq[1]) {
          if (st === "pancakeSeq") { m.forceState = "down"; st = "down"; }
          else if (/^(catchseqSeq|catchSeq|diveCatchSeq)$/.test(st) && m._tuckV109 && m.tms < m._tuckV109 + TU("catchTuckGraceMs", 260)) {
            m.forceState = "catchhold"; st = "catchhold"; m._tuckV109 = m.tms + TU("catchTuckMs", 160); }   // v109: the tuck, held from the frame the hands CLOSE (the reach starts the sequence early, so a window timed off the catch was already spent here)
          else { if (st === "getupSeq") m._groundT = 0; m.forceState = null; st = m.sSm > 8 ? "run0" : "idle"; }
        } else st = actionSeq[0] + af;
        if (st.indexOf("getup") === 0 || st.indexOf("celebrate") === 0) { const V = (window.__V91 = window.__V91 || {}); V[st.indexOf("getup") === 0 ? "getupFrames" : "celebrateFrames"] = (V[st.indexOf("getup") === 0 ? "getupFrames" : "celebrateFrames"] || 0) + 1; }
      }
    }
    else if ((st = this.cadenceV109(m, dtms)) != null) {}   // v109: the plant, the stumble, the jog
    else if (m.tms < m.cutUntil) st = "cut";
    else if (m.sSm < 8) st = "idle";
    else if (m._walk && this.textures.exists("spr_" + (m.kit || m.team) + "_" + m.dirKey + "_walk0")) { m.wt = (m.wt || 0) + (dtms || 16); st = "walk" + (Math.floor(m.wt / TU("walkFrameMs", 170)) % 2); this.v109E().walkFrames++; }   // v109 WALK: a man told to walk (m._walk — the huddle break, the helper, the walk-off, the LB drop) uses the drawn walk cycle
    else { m.ft += (dtms || 16) * Math.min(2.4, m.sSm / 58); st = "run" + (Math.floor(m.ft / 96) % (window.__RIB_FRAMES || 4)); }
    // v107: a dropback is a BACKPEDAL, not the run cycle played facing the line. Paced by the
    // ground he covers, the same way the run frames are, so a hurried seven-step churns.
    if (!m.forceState && m._dropback && m.dirKey === "up" && st !== "idle"
        && this.textures.exists("spr_" + (m.kit || m.team) + "_up_backpedal0")) {
      m.bpt = (m.bpt || 0) + (dtms || 16) * Math.min(2.2, Math.max(0.5, m.sSm / TU("backpedalSpd", 58)));
      st = "backpedal" + (Math.floor(m.bpt / TU("backpedalFrameMs", 110)) % 6);
      const V7 = (window.__V107 = window.__V107 || { throws: [] }); V7.backpedalFrames = (V7.backpedalFrames || 0) + 1;
    }
    // v11: engaged linemen BLOCK across the whole grind band — one stable state, no flapping
    if (!m.forceState && m.isLine && m.sSm > 3 && m.sSm < TU("blockBand",78) && (st === "idle" || st.indexOf("run") === 0)) st = "block";
    // v83: anyone squared up on a partner is blocking (or being blocked) — and the pair's own
    // motion sets the tempo: a stalemate churns slowly, a drive or a wash cycles fast
    if (engaged && !m.forceState && m.sSm < TU("blockBand",78) && (st === "idle" || st.indexOf("run") === 0 || st === "cut")) st = "block";
    if (st === "block") { const pairSpd = engaged ? Math.max(m.sSm, engaged.sSm || 0) : m.sSm;
      const frameMs = pairSpd > TU("driveSpd", 22) ? TU("blockDriveFrameMs", 105) : TU("blockFrameMs",170);
      m.bt = (m.bt || 0) + (dtms || 16); st = "block" + (Math.floor(m.bt / frameMs) % (window.__RIB_BLOCKF || 1)); }
    // v21.2 GET-UP RECOVERY: a downed player no longer teleports upright. Track the
    // last frame he was on the turf; the moment he's free and roughly stationary,
    // play a brief crouch (stance) → stand (idle) recovery before normal states
    // resume — killing the pile "pop" and reading as the get-up the sim implies.
    const _grounded = st === "down" || st.indexOf("tackle") === 0 || st.indexOf("pancake") === 0;
    if (_grounded) m._groundT = m.tms;
    else if (m._groundT && !m.forceState && m.sSm < TU("getupSpd", 30)) {
      const gk = m.tms - m._groundT;
      if (RIB.v91img && gk < 40) { m.forceState = "getupSeq"; m.seqT = m.tms; m._groundT = 0; st = "getup0"; }   // v91: the drawn get-up
      else if (gk < TU("getupMs", 320)) st = gk < TU("getupMs", 320) * 0.5 ? "stance" : "idle";
      else m._groundT = 0;
    } else if (m._groundT) m._groundT = 0;
    if (st === "stance" && (m.num % 2)) st = "stance2";
    // v107: the offense has its own pre-snap. The center is bent over the ball (actor 5), the
    // rest of the line is in a three-point, the skill men wait in a ready stance instead of a
    // dead idle, and a man standing with the ball has it tucked. Rear-view art, so this is the
    // offense only — the defense keeps the two-point stance and the ordinary idle.
    if (m.dirKey === "up" && m.homeDir === "up") {   // the offense, the you-player included, whichever side he is dressed for
      const kit7 = m.kit || m.team, P7 = this.play;
      let want7 = null;
      if (st === "stance" || st === "stance2") want7 = "stance3";   // the centre too — the ball is under him from v105, the pose is the line's
      else if (st === "idle" && !m.forceState) {
        // the tuck only once the ball is actually in his hands: before the snap it is under center (v105), whatever ballHolderId says
        if (P7 && P7.snapped && P7.ballMode === "held" && P7.ballHolderId != null && this.markers[P7.ballHolderId] === m) want7 = "carry";
        else if (P7 && !P7.snapped && P7.t >= (P7.delay || 0) && /^(QB|RB|FB|WR|TE)$/.test(String(m.posLabel || ""))) want7 = "ready";   // once the huddle has broken and he is on the line
      }
      if (want7 && this.textures.exists("spr_" + kit7 + "_up_" + want7)) { st = want7;
        const V7 = (window.__V107 = window.__V107 || { throws: [] });
        const kk = want7 === "stance3" ? "stance3Frames" : want7 === "ready" ? "readyFrames" : "carryFrames";
        V7[kk] = (V7[kk] || 0) + 1; }
    }
    const kit = m.kit || m.team;   // v105.2: the palette he wears, not the side he plays
    let tex = st === "down" ? "spr_" + kit + "_down"
      : st.indexOf("tackle") === 0 ? "spr_" + kit + "_" + st          // non-directional fall-to-ground frames
      : st.indexOf("pancake") === 0 ? "spr_" + kit + "_" + st
      : st.indexOf("getup") === 0 ? (this.textures.exists("spr_" + kit + "_" + m.dirKey + "_" + st) ? "spr_" + kit + "_" + m.dirKey + "_" + st : "spr_" + kit + "_" + st)
      : "spr_" + kit + "_" + m.dirKey + "_" + st;
    if (!this.textures.exists(tex)) tex = "spr_" + kit + "_sd_" + st;
    if (!this.textures.exists(tex)) tex = "spr_" + kit + "_" + m.dirKey + "_idle";
    if (!this.textures.exists(tex)) tex = "rib_player_fallback";
    if (m.tex !== tex) { m.tex = tex; m.body.setTexture(tex); }
    if (tex === "rib_player_fallback") m.body.setTint(kit === "def" ? 0xe86560 : kit === "you" ? 0xf0bb45 : 0x5fce74);
    else if (TU("shadeV101", 1) && this.stadium && this.stadium.on) {
      // v101: the men are lit by the MASTS, not by a fixed grey ramp. `shadeTintV101` reads
      // the light actually landing where he is standing — the pools, the ambient floor, the
      // v100 dial — so running through a pool warms him and the gap between lamps cools him.
      // The ball's own broadcast spotlight rides on top of that rather than instead of it.
      let spotK = 1;
      if (this.ballSpr && this.ballSpr.active !== false) {
        const dd = Math.hypot(m.root.x - this.ballSpr.x, m.root.y - this.ballSpr.y);
        const spot = Math.max(0, 1 - dd / TU("lightSpotR", 200));
        spotK = TU("lightAmb", 0.9) + (1 - TU("lightAmb", 0.9)) * spot;
      }
      m.body.setTint(this.shadeTintV101(m.root.x, m.root.y, spotK));
    } else {
      // v29 DYNAMIC LIGHTING: a broadcast key light on the players — ambient falls off
      // with depth into the far field, and a soft spotlight rides the ball so the men
      // around the action read a touch brighter than the fringes. Brightness quantizes
      // to 8-value steps so the canvas tint path isn't thrashed with unique tints.
      let lb = 1 - Math.min(1, Math.max(0, (VDIR > 0 ? sx : FW - sx) / FW)) * TU("lightDepth", 0.12);
      if (this.ballSpr && this.ballSpr.active !== false) {
        const dd = Math.hypot(m.root.x - this.ballSpr.x, m.root.y - this.ballSpr.y);
        const spot = Math.max(0, 1 - dd / TU("lightSpotR", 200));
        lb *= TU("lightAmb", 0.9) + (1 - TU("lightAmb", 0.9)) * spot;
      }
      const lv = Math.max(0, Math.min(255, Math.round(lb * 255 / 8) * 8));
      m.body.setTint((lv << 16) | (lv << 8) | lv);
    }
    m.body.setFlipX(m.flip && (m.dirKey === "sd" || m.dirKey === "dr" || m.dirKey === "ur" || st === "down" || st === "dive" || st === "grab" || st === "stance" || st.indexOf("tackle") === 0));
    // flat, clean sprites — only the diving tackle gets a slight tilt
    // v112: and a man in the air off a hit keeps turning through the flight, then settles as he skids
    m.body.setRotation((st === "dive" ? (m.flip ? 0.3 : -0.3) : (m._lean || 0)) + (m._flySpinV112 || 0));   // v86: a lean survives the frame
    // v41: side profiles NEVER show a number (chest/back art isn't visible from the
    // side, any state), while linemen keep their numbers even in the pre-snap stance.
    const ribSideProfile = m.dirKey === "sd";
    const ribRearFacing = m.dirKey === "up" || m.dirKey === "ur";
    const detailedAction = /^(juke|stiff|hurdle|catch\d|divecatch|pancake|getup)/.test(st);
    const ribStance = st === "stance" || st === "stance2" || st === "stance3";   // v107
    const numberAllowed = st !== "down" && st !== "dive" && (!ribStance || m.isLine) && st.indexOf("tackle") !== 0 && !detailedAction && !ribSideProfile;
    m.label.setVisible(numberAllowed);
    if (numberAllowed) this.numPlaceV104(m, ribRearFacing);
    m._ribRearFacing=ribRearFacing;
    if (window.__RIB20_updateAppearance) window.__RIB20_updateAppearance(this, m, st, spdPx);
    // turf spray at speed, skid streaks on hard cuts
    if (cutSkid && st !== "down") { this.skidFx(sx, sy); this.puffFx(sx, sy + 3, 2, 0x8a7a55, 0.34); }   // v21.2: jukes/plants kick turf
    if (st.indexOf("run") === 0 && spdPx > TU("runDustSpd", 100) && m.tms - (m.lastDust || 0) > 140) { m.lastDust = m.tms; this.puffFx(sx, sy + 6, spdPx > 190 ? 2 : 1, 0x7c6a48, 0.32); }
    // v103: a man being dragged is churning, not gliding — the turf comes up under him the
    // whole time he is in the grip, at a fraction of the running speed that normally throws it
    if (m._dragging && m.tms - (m.lastDust || 0) > TU("dragDustMs", 110)) { m.lastDust = m.tms; this.puffFx(sx, sy + 5, 2, 0x8a7a55, 0.4); }
    /* v112 THE HIT HAS WEIGHT: the flight, the landing, the skid. The arc is integrated from the
     * launch speed the sim measured; the ground is the script's own knock-back, held back so it is
     * covered over the hang instead of in one tick, and paid off in full by the end of the skid. */
    let flyDX = 0, flyDY = 0, flyLift = 0;
    const FLY = m._flyV112;
    if (FLY) {
      const age = m.tms - FLY.t0, V12 = this.hookV112F();
      if (age >= FLY.dur + FLY.skidMs) { m._flyV112 = null; m._flySpinV112 = 0; FLY.k = 1; V12.ends++; }
      else if (age < FLY.dur) {                                        // in the air: v·t − ½g·t²
        flyLift = Math.max(0, FLY.vz * age - 0.5 * FLY.g * age * age);
        FLY.k = (age / FLY.dur) * (1 - FLY.skid);
        m._flySpinV112 = FLY.spin * Math.min(1, age / Math.max(1, FLY.dur * 0.6));
        if (m.forceState !== "dive") m.forceState = "dive";            // the flight OWNS the pose — a stray timer from the play he was in does not get to stand him up in mid-air
        V12.airborne++; V12.maxLift = Math.max(V12.maxLift, +flyLift.toFixed(2));
      } else {                                                          // down: the bounce, then the skid runs the rest of the ground out
        if (!FLY.landed) { FLY.landed = true; V12.lands++; m.forceState = "down"; m._groundT = m.tms;
          this.puffFx(sx, sy + 2, 3, 0x8a7a55, 0.5); }
        if (m.forceState !== "down") m.forceState = "down";             // and he stays on the turf for the whole skid
        const j = (age - FLY.dur) / Math.max(1, FLY.skidMs);
        FLY.k = (1 - FLY.skid) + FLY.skid * (1 - (1 - j) * (1 - j));   // the slide decelerates into the booked spot
        if (j < FLY.bFrac) flyLift = Math.sin((j / FLY.bFrac) * Math.PI) * FLY.bh;
        m._flySpinV112 = FLY.spin * Math.max(0, 1 - j) * 0.6;
      }
      flyDX = (FLY.x0 - sx) * (1 - FLY.k); flyDY = (FLY.y0 - sy) * (1 - FLY.k);
      FLY.lift = flyLift; FLY.dx = flyDX; FLY.dy = flyDY; FLY.fx = sx + flyDX; FLY.fy = sy + flyDY;   // what he is actually drawn on, for the check
    } else if (m._flySpinV112) m._flySpinV112 = 0;
    const p = PJ(sx + flyDX, sy + flyDY);
    /* v144: the age scale rides the projection, so everything below that reads `p.s` — the shadow,
     * the number, the tackle hop, the launch arc, the pair spread, the ball in his hand — follows
     * it for free. The y nudge puts his FEET back on the row: the container's origin is the
     * sprite's centre and its ground plane is local y=24, so a smaller man would otherwise float. */
    const ageK144 = m._ageKV144 || 1;
    if (ageK144 !== 1) { p.y += 24 * (1 - ageK144) * p.s; p.s *= ageK144; }
    // v83 2.5D: paired sprites are pushed apart on screen so the man behind still reads —
    // a stable side per marker (the lower slot goes left), scaled with the projection
    if (engaged) { const side = this.markers.indexOf(m) < m._pair ? -1 : 1; m._nudgeX = side * TU("engageSpread", 6) * p.s; }
    else m._nudgeX = 0;
    p.x += m._nudgeX || 0;
    // v17 tackle-launch hop: lift the whole sprite along a parabola while a leap is
    // in flight, so a committed tackle reads as an airborne launch into the carrier.
    let liftV99 = 0;
    /* v139: a man in a v112 F flight is NOT also hopping — the two lifts used to stack and put him
     * above his own arc. The flight is the authority while it lasts. */
    if (m._flyV112) { if (m._launchUntil) { m._launchUntil = 0; m._launchH = 0 } }
    else if (m._launchUntil && m.tms < m._launchUntil) { const kk = (m.tms - (m._launchT0 || m.tms)) / (m._launchUntil - (m._launchT0 || m.tms));
      liftV99 = Math.sin(Math.max(0, Math.min(1, kk)) * Math.PI) * (m._launchH || 11); p.y -= liftV99 * p.s; }
    else if (m._launchUntil) m._launchUntil = 0;
    if (flyLift > 0) { liftV99 = Math.max(liftV99, flyLift); p.y -= flyLift * p.s; }   // v112: the thrown man is above the grass the shadow stays on
    m.root.setPosition(p.x, p.y); m.root.setScale(p.s);
    // v99: cast from the one light post — it swings around him as he crosses the field and
    // stays on the grass under a man in the air. A man ON the ground has almost no height
    // left to cast, so his shadow collapses to the patch he is lying in.
    if (m.shadow) { const down = /^(down|dive|tackleSeq|pancakeSeq|getup)/.test(String(m.forceState || "")) || (m._groundT > 0 && m.tms - m._groundT < 400);
      const h = TU("shadowManH", 21) * (down ? TU("shadowDownK", 0.45) : 1);
      this.castShadowV99(m.shadow, p.x, p.y + liftV99 * p.s, h, { lift: liftV99 });
      // v101: at a sprint the cast smears along its own axis and thins — motion, not a taller man
      const smear = Math.max(0, Math.min(1, (spdPx - TU("smearFromV101", 120)) / TU("smearSpanV101", 130))) * TU("smearKV101", 0.34);
      if (smear > 0) { m.shadow.setScale(m.shadow.scaleX * (1 + smear), m.shadow.scaleY * (1 - smear * 0.35));
        m.shadow.setAlpha(m.shadow.alpha * (1 - smear * 0.3)); }
      if (m.fill) this.castFillV101(m.fill, p.x, p.y + liftV99 * p.s, h, { lift: liftV99 }); }
    // v41: stable per-marker epsilon breaks depth ties so engaged sprites at equal
    // sy don't z-flicker through each other frame to frame.
    // v83: inside a pair the OFFENSIVE man draws in front — the sim glues his man a few
    // px downfield of him, which put the defender in front on every snap
    m.root.setDepth(4 + sy * 0.02 + (m.num % 16) * 0.0004 + (engaged && m.team !== "def" ? TU("engageLift", 0.12) : 0));
    m._spdPx = spdPx;
    (m._hist || (m._hist = [])).push({ x: p.x, y: p.y });
    if (m._hist.length > 4) m._hist.shift();
    if (m.ring && m.ring.active) m.ring.setPosition(p.x, p.y + 16 * p.s).setScale(p.s); else m.ring = null;
    if (m.bob && m.bob.active) {
      // it floats, and it turns. The float is small on purpose — a big bounce reads as
      // a bug when the player himself is sprinting.
      m.bob.setPosition(p.x, p.y - TU("bobLift", 31) * p.s + Math.sin(m.tms / 380) * 2 * p.s);
      this.drawPlumbob(m.bob, m.tms, p.s, !!m._gassedV20);
    } else m.bob = null;
    if (m.tag && m.tag.active) m.tag.setPosition(p.x, p.y + 27 * p.s).setScale(p.s); else m.tag = null;
    return p;
  }
  resolveOverlaps() {
    // render-side separation: sprites never stack, no matter how tight the sim pile is
    const ms = this.markers;
    const px0 = ms.map(m => m.root ? m.root.x : 0), py0 = ms.map(m => m.root ? m.root.y : 0);   // v109: where placeMarker stood him
    for (let pass = 0; pass < 3; pass++)
      for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
        const a = ms[i], b = ms[j];
        if (!a.root || !b.root) continue;
        // v41: engaged trench bodies need a wider berth than skill players so
        // defenders never read as clipping through a blocker.
        const r = ((a.isLine || b.isLine) ? TU("sepRadiusLine", 17) : TU("sepRadius", 14.5)) * ((a.root.scale + b.root.scale) / 2);
        let dx = b.root.x - a.root.x, dy = b.root.y - a.root.y;
        const d = Math.hypot(dx, dy);
        if (d <= 0.01) { b.root.x += 4; b.root.y += 3; continue; }
        if (d < r) {
          const push = Math.min(2.6, (r - d) / 2), ux = dx / d, uy = dy / d;   // v11: eased separation, no pops
          a.root.x -= ux * push; a.root.y -= uy * push;
          b.root.x += ux * push; b.root.y += uy * push;
        }
      }
    /* ===== v109 SHADOWS STAY UNDER THE BODIES =====
     * The nudge moved the container and left everything placeMarker had computed for the
     * un-nudged man: the shadow and the fill were cast from the point he no longer stands on, the
     * sprint smear with them, his depth still said the old row, and the plumbob lost its float
     * and the ring its scale on every frame. Every nudged man is now re-cast from the point he
     * was pushed to (`m._nudgeV109` says how far), a man pushed toward the camera draws in front,
     * and the ring / bob / tag get exactly what placeMarker gives them. */
    const V9 = this.v109E().shadows;
    ms.forEach((m, i) => {
      if (!m.root) return;
      const ndx = m.root.x - px0[i], ndy = m.root.y - py0[i], nd = Math.hypot(ndx, ndy);
      m._nudgeV109 = nd > 0.01 ? { dx: ndx, dy: ndy } : null;
      if (nd > 0.01 && TU("shadowFollowV109", 1)) { V9.nudged++;
        let lift = 0; if (m._launchUntil && m.tms < m._launchUntil) { const kk = (m.tms - (m._launchT0 || m.tms)) / (m._launchUntil - (m._launchT0 || m.tms)); lift = Math.sin(Math.max(0, Math.min(1, kk)) * Math.PI) * (m._launchH || 11); }
        if (m.shadow && TU("shadowsV99", 1)) {
          const down = /^(down|dive|tackleSeq|pancakeSeq|getup)/.test(String(m.forceState || "")) || (m._groundT > 0 && m.tms - m._groundT < 400);
          const h = TU("shadowManH", 21) * (down ? TU("shadowDownK", 0.45) : 1), gy = m.root.y + lift * m.root.scale;
          this.castShadowV99(m.shadow, m.root.x, gy, h, { lift });
          const smear = Math.max(0, Math.min(1, ((m._spdPx || 0) - TU("smearFromV101", 120)) / TU("smearSpanV101", 130))) * TU("smearKV101", 0.34);
          if (smear > 0) { m.shadow.setScale(m.shadow.scaleX * (1 + smear), m.shadow.scaleY * (1 - smear * 0.35)); m.shadow.setAlpha(m.shadow.alpha * (1 - smear * 0.3)); }
          if (m.fill) this.castFillV101(m.fill, m.root.x, gy, h, { lift });
          V9.recast++; }
      }
      if (m.ring && m.ring.active) m.ring.setPosition(m.root.x, m.root.y + 16 * m.root.scale).setScale(m.root.scale);
      if (m.bob && m.bob.active) m.bob.setPosition(m.root.x, m.root.y - TU("bobLift", 31) * m.root.scale + Math.sin(m.tms / 380) * 2 * m.root.scale);
      if (m.tag && m.tag.active) m.tag.setPosition(m.root.x, m.root.y + 27 * m.root.scale).setScale(m.root.scale);
    });
  }
  /* ===== v57 CROWD STANDS — a real crowd outside both sidelines =====
   * The broadcast view is full-bleed turf: warpField() stretches the field art's
   * outermost grass pixels across the margins so there is never a horizon. But the
   * perspective leaves a margin that WIDENS toward the far end (the playing surface
   * narrows with distance while the canvas does not), and that margin is the apron
   * outside the sideline. This is what fills it.
   *
   * A stand is a WALL, not ground, so it cannot be baked into warpField's row loop:
   * that loop paints one depth per output row, and a wall occupies many rows at a
   * single depth. It is drawn instead as a column sweep — the same trick from the
   * other side. Sample the sideline at a series of depths; each sample projects
   * through PJ to a ground point and carries the perspective ratio k, so the stand's
   * on-screen height there is just crowdHeight*k. Consecutive samples bound a thin
   * quad, and a 3-point affine maps the matching slice of the art onto it. Because
   * PJ is a genuine projective map, the tiers stay straight and converge on the same
   * vanishing point the yard lines do.
   *
   * Samples are spaced uniformly in SCREEN Y (uniform in the C(u) integral, inverted
   * by bisection exactly like warpField does) rather than in yards — the far half of
   * the sideline is where the stand is actually visible, and spacing by yards would
   * spend most of the slices on the near end, which is off the side of the frame.
   *
   * Animation is a CROSSFADE between the tier's idle and cheer cells, per section,
   * never a redraw: the geometry above is rebuilt only when the perspective is
   * (once per snap), while the crowd reacts every frame by moving alpha. Sections
   * carry their own heat, so a roar spreads out from where the play happened instead
   * of the whole stadium flipping on at once like a light switch.
   *
   * Render-only, like the officials: no sim actor, no stat, no event of its own.
   * Math.random() here decides which section flutters next — cosmetic only, and it
   * never touches the play. */
  crowdC(u) {
    // PERSP.C integrates s² from 0, and clamps anything below 0 to 0 — every negative
    // u collapses onto the near goal line. The END ZONE stands sit BEHIND the end
    // lines (u < 0 and u > FW), so extend it linearly through the behind-anchor
    // region, where s is already pinned at PERSP_BACKMAX and the integral really is
    // linear. Without this the near end-zone stand is drawn ON the goal line.
    const P = PERSP;
    return u >= 0 ? P.C(u) : u * (P.taper ? P.d0 : PERSP_BACKMAX * PERSP_BACKMAX);   // v148: past a tapered near end, the taper's own density
  }
  crowdProject(u, vv) {
    // PJ, but in the direction-adjusted (u, vv) space the stands are laid out in, and
    // through crowdC so it keeps working past both end lines.
    const P = PERSP, FX = window.__FIELD_FX || {};
    const sp = FX.spread == null ? 1 : FX.spread, sz = FX.size == null ? 1.32 : FX.size;
    const k = Math.max(0.02, P.s(u) / P.sN);
    return { x: FW / 2 + (vv - (F_TOP + F_BOT) / 2) * (1.30 * TU("latCal", 1.16) * sp * PERSP_OA * k),
      y: NSTOP + P.VB * (P.total - this.crowdC(u)), k, s: sz * 0.80 * k };
  }
  crowdInvertC(want) {
    // screen-y -> field depth u. Same 18-step bisection warpField uses.
    const P = PERSP; let lo = 0, hi = FW;
    for (let it = 0; it < 18; it++) { const mid = (lo + hi) / 2; if (P.C(mid) < want) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  buildCrowd() {
    const P = PERSP;
    if (!RIB.crowdImg || !P || !this.add || !this.textures) return false;
    const tier = crowdTier(), cell = RIB_META_CROWD[tier + "_idle"];
    if (!cell) return false;
    const CELL_W = cell[2], CELL_H = cell[3];
    const SEC = Math.max(2, Math.round(TU("crowdSections", 7)));
    const NS = Math.max(SEC * 6, Math.round(TU("crowdSlices", 144)));
    // How many times the strip repeats down the sideline. With the k-integral
    // mapping below this is really a PEOPLE-SIZE dial: more tiles packs more,
    // smaller spectators in, and the stand's height follows from the art's own
    // proportions rather than being dialled in separately.
    const tiles = Math.max(1, Math.round(TU("crowdTiles", 3)));
    const decks = Math.max(1, Math.round(TU("crowdDecks", 4)));
    const HK = TU("crowdHeightK", 1);               // artistic multiplier on the derived height
    // THE TEAM AREA. The apron between the sideline and the stand's front row is
    // deliberately wide enough to hold everything that belongs on a real sideline —
    // benches, coaches, the players not on the field, the chain crew — so a later
    // system can populate it without the stands having to move. ~14 yards: deep
    // enough for a bench row, a coaching box in front of it and players standing at
    // the boundary, with room left over.
    //
    // It used to be floored at the LOS/first-down line extension, because those
    // markers paint on the ground out to F_BOT+lineExtend and a stand inside that
    // reach got the blue and gold stripes drawn across the crowd. That was the wrong
    // fix for a real problem: ground beyond the stand's front row is BEHIND the
    // bleachers, so the stand should occlude those stripes, not dodge them.
    // crowdDepth now sits above fieldLines, so the apron is free to be whatever the
    // sideline actually needs.
    //
    // v59: back to ~7 yards from v58's ~14. The apron is the one dial that decides
    // whether the stands are ON SCREEN at all. Lateral spread grows as 1.885*k with
    // depth, so the stand's front row sits at 1.885*k*(HALF+GAP) px from the centre
    // line while the camera only ever shows ~400 of them: at GAP 112 the near half of
    // both stands was outside the frame and all that survived was a sliver in the top
    // corners, which reads as a smudge rather than as a stadium. 56 still leaves a
    // real team area — the dev check holds it to at least 40 world units, about five
    // yards, enough for a bench, a coaching box and players standing at the boundary
    // — and puts a proper bank of crowd down both edges of the frame.
    const GAP = TU("crowdGap", 104);
    const MIDY = (F_TOP + F_BOT) / 2, HALF = (F_BOT - F_TOP) / 2;

    if (!this.crowd || this.crowd.sec !== SEC) { this.clearCrowd(); this.crowd = { secs: [], t: 0, excite: 0, sec: SEC, tier }; }
    const C = this.crowd; C.tier = tier;
    C.decks = decks; C.tiles = tiles;
    const strips = { idle: ribCrowdStrip(tier, "idle", tiles, decks), cheer: ribCrowdStrip(tier, "cheer", tiles, decks) };
    if (!strips.idle || !strips.cheer) return false;
    C.strips = strips;                       // kept for the dev check to scan for deck seams
    // take the built strip's real dimensions — decks stack by pitch, not cell height
    const stripW = strips.idle.width, stripH = strips.idle.height;

    // ---- THE BOWL. A wall is just a line of ground points the stand stands on; the
    // sweep below does not care whether that line runs down a sideline or across the
    // back of an end zone. Sidelines are sampled uniformly in screen Y (each sample a
    // different depth); end-zone walls sit at ONE depth and are sampled across the
    // field, so their k is constant and they come out as a straight band. The end
    // zone stands span exactly the sideline stands' lateral range, so the four walls
    // meet at the corners and the bowl closes.
    // v63: the end apron goes 16 -> 44. A sweeping corner has to buy its radius from
    // somewhere: with the bowl's back only 16 units behind the end line, a 130-unit
    // corner cuts the diagonal so tightly that the stand passes within a few units
    // of the field's own corner — closer than the sidelines are allowed anywhere
    // along their length. Pushing the back of the bowl out is what lets the corner
    // sweep AROUND the end zone instead of across it.
    const vOut = HALF + GAP, EZG = TU("crowdEndGap", 44);
    /* v63: the north end is a BOWL, not a third wall. It used to be a straight band
     * across the back of the end zone, butted against two sidelines that ran all the
     * way to the end line — which left an open wedge of nothing at each corner, and
     * a hard right-angle turn where a stadium has a sweep. The sidelines now stop a
     * corner radius short and the end is one continuous curve that starts exactly
     * where the near sideline stopped, bows out behind the end line and finishes
     * exactly where the far sideline starts.
     *
     * The curve is a superellipse in (depth, lateral): |t| is the lateral parameter,
     * and u = (FW - CR) + (CR + EZG)·(1 - |t|^n)^(1/n). Two properties earn it. Its
     * ends land ON the sideline ends, so the bowl closes with no seam to hide. And
     * its slope there is vertical in t, so it leaves the sideline running PARALLEL
     * to it — the join is tangent-continuous and reads as one sweep rather than two
     * walls meeting. The exponent is the only shape dial: 2 is an ellipse, large is
     * a rectangle, and around 3.5 is the flat-backed, round-cornered end a real
     * bowl has. */
    const CR = Math.max(10, TU("crowdCornerR", 130));          // corner radius, in field depth
    const BN = Math.max(1.4, TU("crowdBowlN", 5));             // superellipse exponent
    const uEnd = Math.max(FW * 0.5, FW - CR);                  // where the sidelines stop
    const walls = [
      { kind: "side", vv: MIDY - vOut, uMax: uEnd, sec: SEC },
      { kind: "side", vv: MIDY + vOut, uMax: uEnd, sec: SEC },
      // ONLY the far end. A bowl behind the NEAR end line is behind the camera, and
      // these stands are billboards: "up the screen" means "further away", so it
      // would rise out of the bottom of the frame and paint itself over the field it
      // is supposed to sit behind. The camera swings ends with possession and this
      // list is rebuilt every snap, so both real end zones get their bowl — each one
      // while it is the end being attacked.
      { kind: "bowl", sec: Math.max(3, Math.round(SEC * 0.9)) },
    ];

    const fieldX = (u) => Math.max(0, Math.min(FW, VDIR > 0 ? u : FW - u));
    let n = 0;
    const built = [];
    for (const wall of walls) {
      const pts = [];
      if (wall.kind === "side") {
        const cMax = P.C(wall.uMax);
        for (let j = 0; j <= NS; j++) {
          const u = this.crowdInvertC(cMax * (j / NS));
          const p = this.crowdProject(u, wall.vv);
          // w: distance along the wall, in world units. x: where on the FIELD this
          // sits, which is what the roar's wave measures its distance from.
          pts.push({ w: u, x: fieldX(u), sx: p.x, sy: p.y, k: p.k, c: 0, vv: wall.vv });
        }
      } else {
        // The curve, sampled dense in t and then RESAMPLED by arc length. Uniform t
        // spends its samples on the flat back of the bowl and starves the corners,
        // which are the only part of it that bends.
        const raw = [], DENSE = 400;
        for (let j = 0; j <= DENSE; j++) {
          const t = -1 + 2 * (j / DENSE), at = Math.min(1, Math.abs(t));
          let u = uEnd + (CR + EZG) * Math.pow(Math.max(0, 1 - Math.pow(at, BN)), 1 / BN);
          const vv = MIDY + vOut * t;
          // A guarantee, not a shaper: wherever the curve is laterally INSIDE the
          // touchlines it must also be behind the end line, or the corner of the
          // bowl is standing on the corner of the pitch. With the dials above it
          // never binds — it is here so no future retune can put a stand on the
          // field by accident.
          if (Math.abs(vv - MIDY) < HALF) u = Math.max(u, FW + TU("crowdEndMin", 8));
          raw.push({ u, vv });
        }
        const arc = [0];
        for (let j = 1; j <= DENSE; j++)
          arc.push(arc[j - 1] + Math.hypot(raw[j].u - raw[j - 1].u, raw[j].vv - raw[j - 1].vv));
        const L = arc[DENSE] || 1, NE = Math.max(16, Math.round(NS / 2));
        let g = 0;
        for (let j = 0; j <= NE; j++) {
          const want = L * (j / NE);
          while (g < DENSE - 1 && arc[g + 1] < want) g++;
          const span = Math.max(1e-6, arc[g + 1] - arc[g]), f = Math.max(0, Math.min(1, (want - arc[g]) / span));
          const u = raw[g].u + (raw[g + 1].u - raw[g].u) * f, vv = raw[g].vv + (raw[g + 1].vv - raw[g].vv) * f;
          const p = this.crowdProject(u, vv);
          pts.push({ w: want, x: fieldX(u), sx: p.x, sy: p.y, k: p.k, c: 0, vv });
        }
      }
      const NP = pts.length - 1;
      // ---- texture coordinate: the INTEGRAL OF k along the wall, not raw distance.
      // Advancing the source column linearly squeezes every PERSON horizontally
      // wherever the wall foreshortens, which is what turned the far half of a
      // sideline into vertical smears. Real perspective does not distort a spectator:
      // it scales them by k and packs MORE of them into the same screen length.
      // Advancing at a rate proportional to k makes the horizontal texture scale
      // (screen-length rate)/(dc/dw) = k²/k = k, matching the vertical scale, so the
      // art keeps its drawn proportions the whole way along.
      let cum = 0;
      for (let j = 1; j <= NP; j++) {
        cum += 0.5 * (pts[j - 1].k + pts[j].k) * Math.abs(pts[j].w - pts[j - 1].w);
        pts[j].c = cum;
      }
      const flip = wall.kind === "side" && VDIR < 0;   // keep sideline art pinned to the stadium
      for (const q of pts) { const f = cum > 0 ? q.c / cum : 0; q.c = (flip ? 1 - f : f) * stripW; }
      // ---- height follows the art. Once the horizontal scale is k everywhere, the
      // height that leaves the spectators undistorted is fixed by the strip's own
      // aspect and how densely it was tiled: h/stripH must equal the horizontal
      // scale, so HH = stripH * seg / (dc * k). Constant along the wall up to
      // sampling noise, so take the median.
      const est = [];
      for (let j = 0; j < NP; j++) {
        const dc = Math.abs(pts[j + 1].c - pts[j].c);
        if (dc < 1e-6) continue;
        const seg = Math.hypot(pts[j + 1].sx - pts[j].sx, pts[j + 1].sy - pts[j].sy);
        est.push(stripH * seg / (dc * pts[j].k));
      }
      est.sort((x2, y2) => x2 - y2);
      built.push({ wall, pts, NP, est });
    }
    /* ---- ONE height for the whole bowl. This used to be solved per wall, which is
     * where the north end's sizing went wrong: a wall's height and its texture scale
     * are two views of the same number, and each wall was forcing the strip to span
     * it exactly once and then taking whatever height fell out. The sidelines are
     * long, so they got tall stands with big spectators; the end is short, so it got
     * a stand a third the height with spectators to match — a different crowd, on
     * the same terrace, forty yards away. Nobody shrinks when they walk round a
     * stadium.
     *
     * The sidelines set the size (they are the reference — most of the bowl, and
     * always on camera), and every other wall is given the texture span that MATCHES
     * it: dc = stripH·seg/(HH·k), integrated along the wall. The end simply uses
     * less of the strip than the sidelines do, which is what "the same people, seen
     * across a shorter run of terrace" actually means. */
    const sideEst = [];
    for (const B of built) if (B.wall.kind === "side") sideEst.push(...B.est);
    sideEst.sort((a, b) => a - b);
    const HH = (sideEst.length ? sideEst[sideEst.length >> 1] : 160) * HK;
    for (const B of built) {
      if (B.wall.kind === "side") continue;
      const P2 = B.pts;
      let c = 0; const raw = [0];
      for (let j = 1; j <= B.NP; j++) {
        const seg = Math.hypot(P2[j].sx - P2[j - 1].sx, P2[j].sy - P2[j - 1].sy);
        const kk = Math.max(.02, .5 * (P2[j].k + P2[j - 1].k));
        c += stripH * seg / (HH * kk);
        raw.push(c);
      }
      // If the wall is long enough to want more strip than there is, fall back to
      // spanning it once — a slightly small crowd beats sampling past the art.
      const sc = c > stripW ? stripW / c : 1;
      // and start it at the far end of the strip, so the bowl is not showing the
      // same faces the sidelines open with
      const off = c * sc >= stripW ? 0 : stripW - c * sc;
      for (let j = 0; j <= B.NP; j++) P2[j].c = off + raw[j] * sc;
    }
    for (const B of built) {
      const { wall, pts, NP } = B;
      // sections share their boundary sample, so neighbours butt up with no seam
      const SS = wall.sec, side = wall.kind === "side" ? (wall.vv < MIDY ? -1 : 1) : 0;
      for (let i = 0; i < SS; i++) {
        const a = Math.floor(i * NP / SS), b = Math.floor((i + 1) * NP / SS);
        if (b <= a) continue;
        const seg = pts.slice(a, b + 1);
        // The rake leans a stand AWAY from the field, and around the bowl's corners
        // "away" swings from sideways to straight back. Ramp it with how far round
        // the curve the section sits, so the lean turns with the wall instead of
        // snapping off at the corner. Kept separate from `side`, which stays the
        // wall's identity — the dev checks and the roar both read that.
        for (const q of seg) q.rk = side || Math.max(-1, Math.min(1, ((q.vv == null ? MIDY : q.vv) - MIDY) / Math.max(1, vOut)));
        this.crowdSection(n++, side, side, seg, strips, stripW, stripH, HH);
      }
    }
    for (let i = n; i < C.secs.length; i++) { const s = C.secs[i]; try { s.spr.idle.setVisible(false); s.spr.cheer.setVisible(false); } catch (e) {} }
    C.built = n;
    this.bowlTrimV112(built, HH);   // v112: the blue band round the foot of the bowl, and the way out of it
    try { ribRegisterLightsV92(this); this.buildStadiumV92(); } catch (e) {}   // v92: the sky behind the bowl
    try {
      window.__CROWD_V57 = { tier, sections: n, sec: SEC, tiles, decks, height: +HH.toFixed(1), gap: GAP, endGap: EZG,
        walls: walls.length, cornerR: CR, bowlN: BN,
        pitch: Math.max(1, (RIB_META_CROWD[tier + "_idle"][4] || 0) - TU("crowdDeckLap", 10)),
        heat: () => (this.crowd ? this.crowd.secs.slice(0, this.crowd.built).map((s) => +s.heat.toFixed(3)) : []),
        boxes: () => (this.crowd ? this.crowd.secs.slice(0, this.crowd.built).map((s) => [Math.round(s.bx), Math.round(s.by), Math.round(s.bw), Math.round(s.bh)]) : []) };
    } catch (e) {}
    return true;
  }
  /* ===== v112 THE FOOT OF THE BOWL, AND THE WAY OUT =====
   * Two things a stand has that v57's terrace of people did not: a wall at the bottom of it,
   * and a hole somewhere in that wall for the teams to come out of.
   *
   * Both are drawn off the SAME sample points the crowd sections are cut from — `pts[j].sx/sy`
   * is the ground the stand stands on at that depth, `k` is the perspective there and `rk` is
   * the rake v57 leans the terrace back by — so they ride the bowl's own projection rather
   * than being a rectangle in screen space. The band's height is a fraction of the stand's
   * drawn height at each point, which means it foreshortens with the stand instead of
   * pinching at the far corner; round the bowl's sweep the ribbon simply follows the curve.
   *
   * THE WAY OUT sits in the FAR bowl, left of centre. The bowl is the only wall whose base is
   * on camera at every anchoring the game produces (the sidelines run out of the bottom of the
   * frame), and dead centre is behind the goalpost upright with the big screen's two legs
   * coming down into it — so an opening there reads as a gap in the structure rather than as a
   * tunnel. A third of the way along, it stands in clear terrace on the side the team area is
   * on, which is where a team actually comes out. It is cut as an arch: the mouth's height is
   * rolled off at both ends so the terrace closes over it, the base band breaks across it (a
   * vomitory interrupts the wall, it does not sit on it), and it carries a lit lintel, so it
   * reads as a mouth with something behind it and not as a bite out of the crowd. ===== */
  /* ===== v144 H THE GAME IS PLAYED IN WEATHER, AND AT A TIME OF DAY =====
   * The sim has rolled a weather since v79 — rain, wind, snow or clear, and it really does move
   * the passing, the kicking and the fumble rolls — but the only thing that ever SHOWED it was the
   * sideline swapping towels for ponchos. You could play a game in the rain and never see a drop.
   * And there was no time of day at all: v98 made it a night game and left it there.
   * `wxV144()` is the one read: what is falling, and whether the sun is up. The Settings override
   * wins over the roll so a player can pin a look; `__WX_V79` / `__WX_DAY_V144` are the roll.
   * It is resolved once a frame and cached, because it is read by the sky bake, the lamps and the
   * particle layer. */
  wxV144() {
    /* the guard has to check the VALUE, not just the frame: before the first `update` tick both
     * counters are undefined, `undefined === undefined` is true, and this returned the cache it
     * had never filled — so the first bake (renderStatic, before any tick) read `.day` off
     * undefined and threw inside warpField's try/catch, silently losing the whole field. */
    if (this._wxV144 && this._wxFrameV144 === this._wxTickV144) return this._wxV144;
    this._wxFrameV144 = this._wxTickV144;
    let precip = "none", day = false;
    try {
      const ov = (window.__FIELD_FX && window.__FIELD_FX.wx) | 0;   // 0 auto, 1 clear-night, 2 rain, 3 snow, 4 sunny
      if (ov === 1) { precip = "none"; day = false; }
      else if (ov === 2) { precip = "rain"; day = false; }
      else if (ov === 3) { precip = "snow"; day = false; }
      else if (ov === 4) { precip = "none"; day = true; }
      else {
        const w = window.__WX_V79 || "clear";
        precip = w === "rain" ? "rain" : w === "snow" ? "snow" : "none";
        day = !!window.__WX_DAY_V144;
      }
    } catch (e) {}
    if (!TU("wxV144", 1)) { precip = "none"; day = false; }
    if (!TU("dayNightV144", 1)) day = false;
    return (this._wxV144 = { precip, day });
  }
  /* The day factor every night-time flourish multiplies by: the lamps, their pools, the mast tint,
   * the baked wash and the stars. One number, so "sunny" cannot half-apply. It is NOT folded into
   * `lightMulV100` because that is the player's own brightness dial and must keep working. */
  dayMulV144() { return this.wxV144().day ? TU("dayLampMulV144", 0.12) : 1; }
  /* ===== the weather you can see =====
   * One retained Graphics, cleared and redrawn each frame, with the drops in a plain array and a
   * time accumulator — the pattern `trailV105` already uses for the ball's embers, and the reason
   * there is not one Phaser object per drop. It is NOT `trackFx`'d: `softStop()` kills those
   * between every play, and weather does not stop for the whistle.
   * The drops live in normalised camera space and are mapped through `cameras.main.worldView`
   * every frame, so they survive the zoom, the handover cut and the camera shake for free.
   * Reduced motion keeps the weather and stops it moving, the way `updateCrowd` does. */
  wxTickV144(delta) {
    const W = this.wxV144();
    if (!this.wxFx || !this.wxFx.scene) { this.wxFx = this.add.graphics().setDepth(TU("wxDepthV144", 28)); }
    const g = this.wxFx; g.clear();
    const H = (window.__V144 = window.__V144 || {});
    H.wx = { precip: W.precip, day: W.day, drops: 0, ticks: (H.wx && H.wx.ticks || 0) + 1 };
    if (W.precip === "none") { this._wxDropsV144 = null; return; }
    const rain = W.precip === "rain";
    const v = this.cameras.main.worldView, z = this.cameras.main.zoom || 1;
    const want = Math.round(TU(rain ? "rainCountV144" : "snowCountV144", rain ? 190 : 120));
    let D = this._wxDropsV144;
    if (!D || D.kind !== W.precip) {
      D = this._wxDropsV144 = { kind: W.precip, p: [] };
      for (let i = 0; i < want; i++) D.p.push(this.wxDropV144(rain, Math.random()));
    }
    while (D.p.length < want) D.p.push(this.wxDropV144(rain, Math.random()));
    if (D.p.length > want) D.p.length = want;
    const dt = REDUCED_MOTION ? 0 : Math.min(60, delta) / 1000;
    const fall = TU(rain ? "rainFallV144" : "snowFallV144", rain ? 1.55 : 0.22);
    const drift = TU(rain ? "rainDriftV144" : "snowDriftV144", rain ? 0.10 : 0.16);
    const col = rain ? TU("rainColV144", 0xbfd8f0) : TU("snowColV144", 0xffffff);
    const alpha = TU(rain ? "rainAlphaV144" : "snowAlphaV144", rain ? 0.34 : 0.72);
    for (let i = 0; i < D.p.length; i++) {
      const d = D.p[i];
      d.y += fall * d.z * dt; d.x += drift * d.z * dt * d.sw;
      if (!rain) d.x += Math.sin((d.y + d.ph) * 9) * 0.0016;
      if (d.y > 1.05) { D.p[i] = this.wxDropV144(rain, -0.05); continue; }
      if (d.x > 1.08) d.x -= 1.16; else if (d.x < -0.08) d.x += 1.16;
      const sx = v.x + d.x * v.width, sy = v.y + d.y * v.height;
      if (rain) {
        const len = TU("rainLenV144", 9) * d.z / z;
        g.lineStyle(Math.max(0.6, TU("rainPxV144", 1.1) * d.z / z), col, alpha * d.z);
        g.lineBetween(sx, sy, sx + len * drift * 5, sy + len);
      } else {
        g.fillStyle(col, alpha * d.z);
        g.fillCircle(sx, sy, Math.max(0.5, TU("snowPxV144", 1.5) * d.z / z));
      }
    }
    H.wx.drops = D.p.length;
  }
  wxDropV144(rain, y0) {
    return { x: Math.random() * 1.16 - 0.08, y: y0 == null ? Math.random() : y0 + Math.random() * 0.02,
      z: TU("wxNearV144", 0.55) + Math.random() * TU("wxSpreadV144", 0.75),
      sw: Math.random() < 0.5 ? -1 : 1, ph: Math.random() * 6.28 };
  }
  bowlTrimV112(built, HH) {
    const C = this.crowd; if (!C || !this.add) return false;
    let g = C.trimG;
    if (!g || !g.scene) g = C.trimG = this.add.graphics();
    g.clear();
    // just above both crowd poses (dep, dep+0.005): this is the wall in FRONT of the terrace
    g.setDepth(TU("crowdDepth", 3.45) + 0.012).setVisible(true);
    if (!TU("bowlTrimV112", 1)) { C.trim112 = null; return false; }
    const RK = TU("crowdRake", 0.24), COL = TU("baseBandColV112", 0x1a4694);
    const FR = Math.max(0.01, TU("baseBandFracV112", 0.068));          // of the stand's own height
    const dbg = { band: [], ent: null, col: COL, frac: FR };
    const top = (p) => { const h = HH * p.k * FR; return { x: p.sx + (p.rk == null ? 0 : p.rk) * RK * h, y: p.sy - h, h }; };
    for (const B of built) {
      const P = B.pts; if (!P || P.length < 2) continue;
      const foot = [], cap = [];
      for (const p of P) { foot.push({ x: p.sx, y: p.sy }); cap.push(top(p)); }
      g.fillStyle(COL, TU("baseBandAV112", 0.92));
      g.fillPoints(foot.concat(cap.slice().reverse()), true);
      // a paler lip along the top of the band — a painted wall has an edge, and it is what
      // stops the terrace above it from looking like it is standing in the grass
      g.lineStyle(Math.max(1, TU("baseBandLipPx", 1.6) * (P[P.length >> 1].k / 0.43)), TU("baseBandLipCol", 0x6f9be6), TU("baseBandLipA", 0.85));
      g.strokePoints(cap, false);
      const m = P[P.length >> 1];
      dbg.band.push({ kind: B.wall.kind, n: P.length, k: +m.k.toFixed(3), h: +(HH * m.k * FR).toFixed(1),
        mid: [Math.round(m.sx), Math.round(m.sy)], midTop: [Math.round(top(m).x), Math.round(top(m).y)],
        foot: foot.map((p) => [+p.x.toFixed(2), +p.y.toFixed(2)]) });
    }
    // ---- the ways out
    const B = built.find((b) => b.wall && b.wall.kind === "bowl");
    if (B && TU("entranceV112", 1) && B.pts.length > 8) {
      const P = B.pts, N = P.length - 1;
      /* One cut, drawn wherever it is asked for along the bowl. `rect` is the whole difference
       * between the middle arch and the two corner tunnels: the arch rolls its height off toward
       * both jambs (the terrace closes over it), a rectangular mouth holds full height to square
       * jambs and a flat lintel. Nothing here needs a rotation term to "face the corner" — near
       * the ends of this polyline the bowl's own tangent has already swung round toward the
       * sideline and `rk` has ramped with it, so the mouth leans and skews with the wall it is
       * cut into. A VDIR term would be wrong: `crowdProject` carries no mirror, so pts[0] is
       * ALWAYS screen-left and pts[N] always screen-right, whichever way the drive is going. */
      const cut = (at, wd, rect) => {
        at = Math.max(0.04, Math.min(0.96, at)); wd = Math.max(0.025, wd);
        const i0 = Math.max(0, Math.round((at - wd / 2) * N)), i1 = Math.min(N, Math.round((at + wd / 2) * N));
        const seg = P.slice(i0, i1 + 1);
        if (seg.length < 3) return null;
        const HF = Math.max(0.05, rect ? TU("cornerTunnelHighV144", 0.26) : TU("tunnelHighV112", 0.3)), M = seg.length - 1;
        const hAt = rect
          ? (j) => HH * seg[j].k * HF
          : (j) => HH * seg[j].k * HF * Math.pow(Math.sin(Math.PI * (j / M)), 0.34);
        const mouth = [], arch = [];
        for (let j = 0; j <= M; j++) { const p = seg[j], h = hAt(j);
          mouth.push({ x: p.sx, y: p.sy }); arch.push({ x: p.sx + (p.rk == null ? 0 : p.rk) * RK * h, y: p.sy - h }); }
        const poly = mouth.concat(arch.slice().reverse());
        g.fillStyle(TU("tunnelDarkV112", 0x06080c), 1); g.fillPoints(poly, true);
        // something behind it: the tunnel's own lights, a warm line run along the underside of
        // the lintel across the middle of the mouth, faint enough never to compete with the field
        const mid = arch[M >> 1], base = mouth[M >> 1];
        const j0 = Math.max(1, Math.round(M * 0.2)), j1 = Math.min(M - 1, Math.round(M * 0.8));
        const lint = arch.slice(j0, j1 + 1).map((p) => ({ x: p.x, y: p.y + (base.y - mid.y) * TU("tunnelLintelDrop", 0.16) }));
        if (lint.length > 1) { g.lineStyle(Math.max(1, TU("tunnelLintelPx", 1.4) * (seg[M >> 1].k / 0.43)), TU("tunnelGlowV112", 0xffd79a), TU("tunnelGlowA", 0.5));
          g.strokePoints(lint, false); }
        // the frame, in the trim the wall it interrupts is painted in. A square mouth gets its
        // jambs drawn too — an arch's frame closes itself, a rectangle's does not.
        g.lineStyle(Math.max(1, TU("tunnelFramePx", 2) * (seg[M >> 1].k / 0.43)), TU("baseBandLipCol", 0x6f9be6), 0.95);
        g.strokePoints(arch, false);
        if (rect) { g.strokePoints([mouth[0], arch[0]], false); g.strokePoints([mouth[M], arch[M]], false); }
        return { i0, i1, n: seg.length, k: +seg[M >> 1].k.toFixed(3), rect: !!rect,
          h: +(base.y - mid.y).toFixed(1), w: +Math.hypot(mouth[M].x - mouth[0].x, mouth[M].y - mouth[0].y).toFixed(1),
          mouth: mouth.map((p) => [Math.round(p.x), Math.round(p.y)]), arch: arch.map((p) => [Math.round(p.x), Math.round(p.y)]) };
      };
      // the middle arch, unchanged — `dbg.ent` still means THIS one, which is what v112Bcheck reads
      dbg.ent = cut(TU("tunnelAtV112", 0.34), TU("tunnelWideV112", 0.1), false);
      /* ===== v144 G A WAY OUT IN EACH UPPER CORNER =====
       * Rectangular mouths cut where the bowl turns into each sideline — the players' tunnels, one
       * per corner, facing in toward the corner of the field. */
      dbg.corners = [];
      if (TU("cornerTunnelV144", 1)) {
        const cAt = Math.max(0.03, Math.min(0.25, TU("cornerTunnelAtV144", 0.085)));
        const cWd = Math.max(0.025, TU("cornerTunnelWideV144", 0.075));
        for (const a of [cAt, 1 - cAt]) { const e = cut(a, cWd, true); if (e) dbg.corners.push(e); }
      }
    }
    C.trim112 = dbg;
    try { (window.__V144 = window.__V144 || {}).tunnels = { mid: !!dbg.ent, corners: (dbg.corners || []).length,
      cornerW: (dbg.corners || []).map((e) => e.w), cornerH: (dbg.corners || []).map((e) => e.h) }; } catch (e) {}
    return true;
  }
  crowdSection(idx, sgn, rakeSgn, pts, strips, stripW, CELL_H, HH) {
    const C = this.crowd;
    if (pts.length < 2) return;
    const h = pts.map((p) => HH * p.k);
    // ---- RAKE. A stand is not a billboard: its back row is both higher AND further
    // from the field than its front row, so in this projection the top of the stand
    // has to sit OUTBOARD of its own base, not straight above it. The slice transform
    // below carries that as a shear — the source column's vertical axis maps to a
    // sloped screen vector instead of to straight up — which costs nothing and is
    // what turns a flat wall of texture into something with a face and a back.
    // Outward is away from the field: sgn is which side of the centre line this wall
    // is on, and the shear is proportional to the slice's own height, so it
    // foreshortens with distance exactly as the rest of the stand does. End-zone
    // walls are seen square on (sgn 0) and rake straight back, which the height
    // already carries.
    // Per POINT, not per section. A section-wide rake notches the skyline at every
    // section boundary as soon as the lean starts turning — which is exactly what
    // the bowl's corners make it do. Per point the lean turns with the wall and the
    // remaining discontinuity is one slice wide, which is a pixel or two of source.
    const RK0 = TU("crowdRake", 0.24);
    const rk = pts.map((p) => (p.rk == null ? (rakeSgn == null ? sgn : rakeSgn) : p.rk) * RK0);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let j = 0; j < pts.length; j++) {
      const p = pts[j], tx = p.sx + rk[j] * h[j];
      if (p.sx < x0) x0 = p.sx; if (p.sx > x1) x1 = p.sx;
      if (tx < x0) x0 = tx; if (tx > x1) x1 = tx;
      if (p.sy > y1) y1 = p.sy; if (p.sy - h[j] < y0) y0 = p.sy - h[j];
    }
    const PAD = 3;
    x0 = Math.floor(x0 - PAD); y0 = Math.floor(y0 - PAD); x1 = Math.ceil(x1 + PAD); y1 = Math.ceil(y1 + PAD);
    const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);

    let s = C.secs[idx];
    if (!s) {
      s = C.secs[idx] = { heat: 0, pendAmt: 0, pendAt: 0, phase: Math.random() * Math.PI * 2, cv: {}, spr: {} };
      for (const pose of ["idle", "cheer"]) {
        const key = "crowd_" + idx + "_" + pose;
        s.cv[pose] = document.createElement("canvas"); s.cv[pose].width = 8; s.cv[pose].height = 8;
        try { this.textures.remove(key); } catch (e) {}
        this.textures.addCanvas(key, s.cv[pose]);
        s.spr[pose] = this.add.image(0, 0, key).setOrigin(0, 0);
      }
      s.key = "crowd_" + idx;
    }
    s.sgn = sgn; s.bx = x0; s.by = y0; s.bw = bw; s.bh = bh;
    const mid = pts[pts.length >> 1];
    s.ux = mid.x; s.k = mid.k;
    // a point that is definitely ON this stand — the box is axis-aligned over a
    // diagonal band, so its own corners are not
    s.hh = HH * mid.k;                                // this stand's drawn height here
    s.mx = mid.sx + (rk[pts.length >> 1] || 0) * HH * mid.k * .22;
    s.my = mid.sy - HH * mid.k * .22;                 // just above the front rows
    // Depth: just above fieldLines (3.4) so the stand OCCLUDES the outer tips of the
    // LOS/first-down stripes — that ground is behind the bleachers — and below the
    // ground shadows and highlight rings under the players (3.5+), which only ever
    // sit on the playing surface the stands never reach.
    const dep = TU("crowdDepth", 3.45);

    for (const pose of ["idle", "cheer"]) {
      const key = "crowd_" + idx + "_" + pose;
      let cv = s.cv[pose];
      // grow-only: a canvas swap costs a texture re-upload, so round up and reuse
      if (cv.width < bw || cv.height < bh) {
        const nw = Math.max(cv.width, Math.ceil(bw / 32) * 32), nh = Math.max(cv.height, Math.ceil(bh / 32) * 32);
        cv = s.cv[pose] = document.createElement("canvas"); cv.width = nw; cv.height = nh;
        try { this.textures.remove(key); } catch (e) {}
        this.textures.addCanvas(key, cv);
        try { s.spr[pose].setTexture(key); } catch (e) {}
      }
      const cx = cv.getContext("2d");
      cx.setTransform(1, 0, 0, 1, 0, 0);
      cx.clearRect(0, 0, cv.width, cv.height);
      cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = "high";
      const img = strips[pose];
      for (let j = 0; j < pts.length - 1; j++) {
        const p = pts[j], q = pts[j + 1];
        let dc = q.c - p.c;
        if (Math.abs(dc) < 1e-4) continue;
        // 3-point affine: art (c,CELL_H)->ground, (c+dc,CELL_H)->next ground,
        // (c,0)->top of the stand at this depth. Exact for the slice's parallelogram;
        // the trapezoid error across one slice is far under a pixel at this spacing.
        // The third mapping is where the rake lives: the top lands RK*h outboard of
        // the base rather than directly over it, which is the g term below.
        const a = (q.sx - p.sx) / dc, b = (q.sy - p.sy) / dc, d = h[j] / CELL_H;
        const g = -rk[j] * d;
        const e = p.sx - a * p.c - g * CELL_H - x0, f = p.sy - b * p.c - d * CELL_H - y0;
        cx.setTransform(a, b, g, d, e, f);
        // sample one extra column so neighbouring slices overlap instead of hairlining
        const sx = Math.min(p.c, q.c), sw = Math.min(Math.abs(dc) + 1, stripW - sx);
        if (sw > 0) cx.drawImage(img, sx, 0, sw, CELL_H, sx, 0, sw, CELL_H);
      }
      cx.setTransform(1, 0, 0, 1, 0, 0);
      // ---- AERIAL PERSPECTIVE. The far end of a stand is a quarter of a mile of air
      // away and reads that way: it goes down in contrast and toward the colour of
      // the sky behind it. Without this every section is lit identically and the
      // whole bank sits at one distance however hard the geometry recedes. Ramped
      // between the section's own end depths and clipped to what is already drawn, so
      // it is smooth inside a section and continuous across the joins (neighbours
      // share their boundary sample). A wall at one depth — an end zone — comes out
      // as a flat tint, which is correct there.
      const haze = TU("crowdHaze", 0.4);
      if (haze > 0) {
        const p0 = pts[0], pN = pts[pts.length - 1];
        const hz = (kk) => haze * Math.max(0, Math.min(1, (TU("crowdHazeNear", 1.05) - kk) /
          Math.max(0.05, TU("crowdHazeNear", 1.05) - TU("crowdHazeFar", 0.34))));
        // one side of the bowl faces the light and the other does not; a touch of
        // difference between them keeps the two banks from reading as one flat plane
        const side = sgn < 0 ? TU("crowdSideShade", 0.09) : 0;
        const gr = cx.createLinearGradient(p0.sx - x0, p0.sy - y0, pN.sx - x0, pN.sy - y0);
        gr.addColorStop(0, "rgba(15,22,34," + (hz(p0.k) + side).toFixed(3) + ")");
        gr.addColorStop(1, "rgba(15,22,34," + (hz(pN.k) + side).toFixed(3) + ")");
        cx.globalCompositeOperation = "source-atop";
        cx.fillStyle = gr; cx.fillRect(0, 0, bw, bh);
        cx.globalCompositeOperation = "source-over";
      }
      try { this.textures.get(key).refresh(); } catch (e) {}
      s.spr[pose].setPosition(x0, y0).setDepth(pose === "idle" ? dep : dep + 0.005).setVisible(true);
    }
    s.spr.idle.setAlpha(1);
    s.spr.cheer.setAlpha(s.heat);
  }
  crowdCheer(amt, atX) {
    const C = this.crowd; if (!C || !C.built) return;
    amt = Math.max(0, Math.min(1, amt)); if (amt <= 0) return;
    C.excite = Math.min(1, C.excite + amt * 0.7);
    const x0 = atX == null ? PLAY_L + PLAY_W / 2 : atX;
    for (let i = 0; i < C.built; i++) {
      const s = C.secs[i], d = Math.abs(s.ux - x0);
      // the roar starts at the play and rolls out along the sideline, thinning as it goes
      const at = C.t + d * TU("crowdWaveMsPerPx", 1.1);
      const a = amt * (1 - Math.min(0.5, d / (FW * 1.7)));
      if (a > s.pendAmt) { s.pendAmt = a; s.pendAt = at; }
    }
  }
  /* ===== v63 CROWD VOICES — the stands answer back =====
   * The crowd already reacted: heat rises, the roar rolls out along the terrace as
   * a wave. All of that is texture, though — you feel a stadium get louder without
   * anyone in it saying anything. These are the words. A short shout pops out of
   * the sections nearest the play, rides up off the terrace and fades.
   *
   * Deliberately small and deliberately rationed. Big enough to read at the size a
   * stand draws (a floor on the font size, because a section at the far corner is
   * drawn at k = 0.43 and 15·k there is six pixels of nothing), capped so it never
   * competes with the field, and behind a cooldown so a busy play produces a shout
   * rather than a running commentary. Anchored on a point that is genuinely ON the
   * stand — the section's own mid sample, half a stand-height up — because the
   * section's bounding box is axis-aligned over a band that runs diagonally, so its
   * corners hang out over the turf.
   *
   * Render-only, like the rest of the crowd: no sim actor, no stat, no event. The
   * Math.random() here picks which fan shouts and what they shout, nothing else. */
  /* ===== v101 THE STANDS HAVE A VOCABULARY =====
   * v98 gave the terraces two emoji pools — one for everything good, one for everything
   * bad — so a strip sack, a dropped pass and a flag all sent up the same eight faces.
   * A crowd does not react generically; it reacts to the THING. Every moment the stands
   * can see now names its own handful, and the shout bubbles carry one too, so the line
   * and the faces beside it are talking about the same play. Falls back to the v98 pools
   * for anything unnamed, so a new event type is never silent. */
  emoBookV101(type, good) {
    const B = {
      td:        ["\uD83C\uDF89", "\uD83D\uDD25", "\uD83D\uDE4C", "\uD83C\uDFC8", "\uD83E\uDD73"],   // 🎉 🔥 🙌 🏈 🥳
      score:     ["\uD83C\uDF89", "\uD83D\uDD25", "\uD83D\uDE4C", "\uD83E\uDD73"],
      fgResult:  ["\uD83C\uDFAF", "\uD83D\uDE4C", "\uD83E\uDD1E"],                                       // 🎯 🙌 🤞
      pick:      ["\uD83E\uDD2F", "\uD83D\uDE31", "\uD83E\uDDE4", "\uD83D\uDC40"],                      // 🤯 😱 🧤 👀
      fumble:    ["\uD83D\uDE31", "\uD83E\uDEE3", "\uD83D\uDC40"],                                        // 😱 🫣 👀
      recover:   ["\uD83D\uDCAA", "\uD83D\uDE24", "\uD83E\uDD1D"],                                        // 💪 😤 🤝
      sack:      ["\uD83D\uDCA5", "\uD83D\uDE24", "\uD83E\uDDF1", "\uD83D\uDD28"],                      // 💥 😤 🧱 🔨
      safety:    ["\uD83D\uDE31", "\uD83D\uDCA5", "\uD83E\uDD2F"],
      swat:      ["\uD83D\uDEAB", "\uD83E\uDDE4", "\uD83D\uDC4B"],                                        // 🚫 🧤 👋
      flag:      ["\uD83D\uDE21", "\uD83E\uDD2C", "\uD83D\uDC41\uFE0F", "\uD83E\uDD26"],               // 😡 🤬 👁️ 🤦
      firstdown: ["\uD83D\uDC49", "\uD83D\uDC4F", "\uD83D\uDCC8"],                                        // 👉 👏 📈
      brokenTackle:["\uD83D\uDCAA", "\uD83D\uDE2E", "\uD83D\uDD25"],                                      // 💪 😮 🔥
      truck:     ["\uD83D\uDE9B", "\uD83D\uDCAA", "\uD83D\uDE2E"],                                        // 🚛 💪 😮
      stiffarm:  ["\uD83E\uDD1A", "\uD83D\uDE2E", "\uD83D\uDD25"],                                        // 🤚 😮 🔥
      hurdle:    ["\uD83E\uDD38", "\uD83D\uDE33", "\uD83E\uDD8C"],                                        // 🤸 😳 🦌
      juke:      ["\uD83D\uDC83", "\uD83D\uDE02", "\uD83E\uDDCA"],                                        // 💃 😂 🧊
      spin:      ["\uD83C\uDF00", "\uD83D\uDE02", "\uD83D\uDE33"],                                        // 🌀 😂 😳
      pancake:   ["\uD83E\uDD5E", "\uD83D\uDCAA", "\uD83D\uDE06"],                                        // 🥞 💪 😆
      highpoint: ["\uD83E\uDD79", "\uD83E\uDD32", "\uD83D\uDE2E"],                                        // 🥹 🤲 😮
      toetap:    ["\uD83E\uDDB6", "\uD83D\uDC40", "\uD83D\uDC4F"],                                        // 🦶 👀 👏
      catch:     ["\uD83E\uDDE4", "\uD83D\uDC4F", "\uD83D\uDC4C"],                                        // 🧤 👏 👌
      sprint:    ["\uD83D\uDCA8", "\uD83C\uDFC3", "\uD83D\uDE2E"],                                        // 💨 🏃 😮
      scramble:  ["\uD83C\uDFC3", "\uD83D\uDE05", "\uD83D\uDC40"],                                        // 🏃 😅 👀
      doubleMove:["\uD83E\uDDCA", "\uD83D\uDE02", "\uD83D\uDC40"],
      blitz:     ["\uD83D\uDE08", "\uD83D\uDCA5", "\uD83D\uDC40"],                                        // 😈 💥 👀
      qbHit:     ["\uD83D\uDCA5", "\uD83D\uDE2C", "\uD83D\uDE24"],
      tackleHit: ["\uD83D\uDCA5", "\uD83D\uDE2C", "\uD83D\uDD14"],                                        // 💥 😬 🔔
      incomplete:["\uD83D\uDE29", "\uD83E\uDD26", "\uD83E\uDEE0"],                                        // 😩 🤦 🫠
      playfake:  ["\uD83E\uDD2B", "\uD83D\uDC40"],                                                          // 🤫 👀
      holeOpen:  ["\uD83D\uDEAA", "\uD83D\uDC49"],                                                          // 🚪 👉
      gripBreak: ["\uD83D\uDCAA", "\uD83D\uDE32", "\uD83D\uDD25"],                                          // 💪 😲 🔥
      secondEffort: ["\uD83D\uDE24", "\uD83D\uDCAA", "\uD83D\uDC4F"],                                       // 😤 💪 👏
      pileOn:    ["\uD83D\uDE2C", "\uD83E\uDDF1", "\uD83D\uDCA5"],                                          // 😬 🧱 💥
      grab:      ["\uD83E\uDD1C", "\uD83D\uDE2C"],                                                            // 🤜 😬
      horseCollar: ["\uD83D\uDE21", "\uD83E\uDD2C"],                                                          // 😡 🤬
    };
    const own = B[type];
    if (own && own.length) return own;
    return good
      ? ["\uD83D\uDD25", "\uD83D\uDE4C", "\uD83D\uDC4F", "\uD83C\uDF89", "\uD83D\uDCAA", "\uD83D\uDE31", "\uD83C\uDFC8", "\uD83E\uDD2F"]
      : ["\uD83D\uDE29", "\uD83E\uDD26", "\uD83D\uDE24", "\uD83D\uDE2C", "\uD83D\uDE48", "\uD83D\uDC94", "\uD83D\uDE21"];
  }
  crowdBubble(good, atX, type) {
    const C = this.crowd; if (!C || !C.built || !this.add) return;
    if (C.t - (C.voiceAt == null ? -1e9 : C.voiceAt) < TU("crowdVoiceGapMs", 1100)) return;
    C.voiceAt = C.t;
    const GOOD = ["LET'S GO!", "YESSS!", "THAT'S IT!", "HUGE!", "OH MY!", "GO! GO!", "ATTABOY!", "ALL DAY!"];
    const BAD = ["AWW COME ON", "NO NO NO", "OH NO", "REF?!", "YOU'RE KIDDING", "UGH", "COME ON!", "THAT HURT"];
    const pool = good ? GOOD : BAD;
    const x0 = atX == null ? PLAY_L + PLAY_W / 2 : atX;
    // ON CAMERA first, closest to the play second. Sorting by field position alone
    // hands the shout to the near sidelines every time — they are the sections
    // beside the ball, and they are also the ones the perspective throws furthest
    // outside the frame, so the bubble spawned where nobody could see it. A stand
    // nobody can see does not get a line.
    // Comfortably inside the frame, not merely within it: the camera is panning
    // while the shout is alive, and an anchor sitting on the edge at spawn is gone
    // by the time it has finished popping in.
    // Inset by roughly a bubble's half-width at the sides — any more and the test
    // excludes the frame edges, which is the ONLY place the perspective puts a
    // stand — and by more at the top, where the camera pans and where the stands
    // run away up the screen fastest.
    let view = null;
    try { const w = this.cameras.main.worldView;
      view = { x0: w.x + 44, y0: w.y + w.height * .08, x1: w.right - 44, y1: w.bottom - 24 }; } catch (er) {}
    const on = C.secs.slice(0, C.built).filter((s) => !view ||
      (s.mx > view.x0 && s.mx < view.x1 && s.my > view.y0 && s.my < view.y1));
    if (!on.length) return;
    const near = on.map((s) => ({ s, d: Math.abs(s.ux - x0) })).sort((a, b) => a.d - b.d).slice(0, 5);
    const howMany = Math.min(near.length, 1 + (Math.random() < .45 ? 1 : 0));
    C.voices = C.voices || [];
    for (let i = 0; i < howMany; i++) {
      const s = near[(Math.random() * Math.min(near.length, 4)) | 0].s;
      // v101: the line and the face beside it are reacting to the same play
      const emo = TU("crowdVoiceEmojiV101", 1) ? this.emoBookV101(type, good) : null;
      const txt = pool[(Math.random() * pool.length) | 0]
        + (emo && emo.length ? " " + emo[(Math.random() * emo.length) | 0] : "");
      const fs = Math.round(Math.max(TU("crowdVoiceMinPx", 9), Math.min(TU("crowdVoiceMaxPx", 14), 15 * s.k)));
      try {
        const g = this.add.graphics(), tx = this.add.text(0, 0, txt, {
          fontFamily: 'Oswald, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif', fontSize: fs + "px",
          color: good ? "#dff6e4" : "#ffdad6", fontStyle: "700",
        }).setOrigin(.5, .5);
        const w = Math.ceil(tx.width) + fs * .9, h = Math.ceil(tx.height) + fs * .42, r = Math.min(h / 2, fs * .6);
        g.fillStyle(good ? 0x123021 : 0x33161a, .92); g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
        g.lineStyle(1, good ? 0x6fe08a : 0xff8a80, .75); g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
        g.fillStyle(good ? 0x123021 : 0x33161a, .92);                        // the tail, pointing back down
        g.fillTriangle(-fs * .3, h / 2 - .5, fs * .3, h / 2 - .5, 0, h / 2 + fs * .5);
        const box = this.add.container(s.mx + (Math.random() - .5) * s.bw * .3, s.my, [g, tx]);
        box.setDepth(TU("crowdDepth", 3.45) + .02).setScale(.55).setAlpha(0);
        C.voices.push({ box, t: 0, life: TU("crowdVoiceMs", 1500), rise: fs * 1.1 });
      } catch (er) {}
    }
    // never let them stack up: the oldest goes when the crowd gets talkative
    const cap = Math.max(1, Math.round(TU("crowdVoiceMax", 4)));
    while (C.voices.length > cap) { const v = C.voices.shift(); try { v.box.destroy() } catch (er) {} }
  }
  crowdReact(e, P) {
    if (!this.crowd || !this.crowd.built) return;
    // off:true = an OFFENSIVE highlight. The stands are the home crowd, so who it is
    // good for flips with who has the ball, and the away half of the reaction is a
    // fraction of a home one rather than a separate (undrawn) groan pose.
    const T = {
      td: [1, 1], score: [1, 1], pick: [0.95, 0], fumble: [0.75, 0], recover: [0.85, 0], fgResult: [0.8, 1],
      firstdown: [0.5, 1], brokenTackle: [0.5, 1], stiffarm: [0.42, 1], hurdle: [0.46, 1], pancake: [0.4, 1],
      highpoint: [0.5, 1], toetap: [0.5, 1], catch: [0.34, 1], sprint: [0.22, 1],
      tackle: [0.26, 0], tackleHit: [0.36, 0], qbHit: [0.42, 0], incomplete: [0.22, 0], contest: [0.24, 0],
      snap: [0.1, 1],
      // v101: the moments the stands were sitting through in silence
      sack: [0.62, 0], safety: [0.95, 0], swat: [0.44, 0], throwaway: [0.2, 0], flag: [0.6, 0],
      // v103: the wrap, the heap, the man who would not go down
      grab: [0.24, 0], pileOn: [0.34, 0], gripBreak: [0.6, 1], secondEffort: [0.52, 1], horseCollar: [0.5, 0],
      juke: [0.44, 1], spin: [0.44, 1], truck: [0.5, 1], scramble: [0.4, 1], doubleMove: [0.38, 1],
      boxOut: [0.34, 1], playfake: [0.24, 1], blitz: [0.3, 0], holeOpen: [0.3, 1], pilePush: [0.24, 1],
    };
    const t = T[e.type]; if (!t) return;
    let ours = true;
    try { ours = ((P && P.payload && P.payload.offense) !== "them") === !!t[1]; } catch (er) {}
    const amt = t[0] * (ours ? 1 : TU("crowdAwayFrac", 0.3));
    const atX = e && e.x != null ? e.x : (P && P.losX);
    this.crowdCheer(amt, atX);
    // A shout needs a moment worth shouting about, judged on the event's own weight
    // rather than on `amt` — the away version of a big play is a groan, and a groan
    // is exactly what the stands should be doing there.
    if (t[0] >= TU("crowdVoiceMin", 0.34)) this.crowdBubble(ours, atX, e.type);
    if (t[0] >= TU("crowdEmojiMin", 0.24)) this.crowdEmojiV98(ours, atX, t[0], e.type);
  }
  /* ===== v98 THE STANDS REACT — emoji off the terraces =====
   * The bubbles are one fan with a line; this is the rest of the section. A moment worth
   * reacting to sends a handful of emoji up off the stands nearest the play (on camera
   * first, like the bubbles): flames and raised hands for the home crowd's good moments,
   * groans and facepalms when it goes against them, more of them and bigger for the
   * bigger plays. Each one pops in, drifts up with a little wobble and fades. Render-only,
   * like everything in the crowd: Math.random() picks the fan, the emoji and the wobble. */
  crowdEmojiV98(good, atX, weight, type) {
    const C = this.crowd; if (!C || !C.built || !this.add || !TU("crowdEmojiV98", 1)) return;
    const BIG = /^(td|score|pick|fumble|recover|fgResult|safety|sack)$/.test(type || "");
    // v101: the gap keeps the terraces from chattering, but a moment this big jumps it
    if (C.t - (C.emojiAt == null ? -1e9 : C.emojiAt) < TU("crowdEmojiGapMs", 650) * (BIG ? TU("crowdEmojiBigGapK", 0.25) : 1)) return;
    C.emojiAt = C.t;
    // v101: the faces belong to the moment, not to a blanket good/bad
    const pool = this.emoBookV101(type, good);
    const x0 = atX == null ? PLAY_L + PLAY_W / 2 : atX;
    let view = null;
    try { const w = this.cameras.main.worldView; view = { x0: w.x + 30, y0: w.y + w.height * .06, x1: w.right - 30, y1: w.bottom - 20 }; } catch (er) {}
    // on camera first; failing that (the lock is tight on a runner mid-field) the sections
    // nearest the play, which the pull-back at the whistle brings into frame while they rise
    const all = C.secs.slice(0, C.built);
    let on = all.filter((s) => !view || (s.mx > view.x0 && s.mx < view.x1 && s.my > view.y0 && s.my < view.y1));
    const offCam = !on.length; if (offCam) on = all;
    if (!on.length) return;
    const near = on.map((s) => ({ s, d: Math.abs(s.ux - x0) })).sort((a, b) => a.d - b.d).slice(0, 6);
    const n = Math.max(1, Math.round((BIG ? TU("crowdEmojiBig", 6) : TU("crowdEmojiN", 3)) * (good ? 1 : TU("crowdEmojiAwayK", 0.6)) * (0.7 + weight * 0.6)));
    C.emojis = C.emojis || [];
    for (let i = 0; i < n; i++) {
      const s = near[(Math.random() * near.length) | 0].s;
      const fs = Math.round(Math.max(TU("crowdEmojiMinPx", 11), Math.min(TU("crowdEmojiMaxPx", 20), (BIG ? 22 : 17) * s.k)));
      try {
        const tx = this.add.text(s.mx + (Math.random() - .5) * s.bw * .7, s.my + (Math.random() - .3) * s.hh * .4, pool[(Math.random() * pool.length) | 0],
          { fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif', fontSize: fs + "px" }).setOrigin(.5, 1);
        tx.setDepth(TU("crowdDepth", 3.45) + .03).setScale(.4).setAlpha(0);
        C.emojis.push({ tx, t: -Math.random() * TU("crowdEmojiStaggerMs", 420) - (offCam ? TU("crowdEmojiHoldMs", 500) : 0), life: TU("crowdEmojiMs", 1500) * (0.85 + Math.random() * .3) * (offCam ? 1.5 : 1), rise: fs * (1.6 + Math.random()), wob: fs * .35, seed: Math.random() * 6.28, x0: tx.x, y0: tx.y });
      } catch (er) {}
    }
    const cap = Math.max(2, Math.round(TU("crowdEmojiMax", 12)));
    while (C.emojis.length > cap) { const v = C.emojis.shift(); try { v.tx.destroy() } catch (er) {} }
    try { const E = window.__EMOJI_V98 = window.__EMOJI_V98 || { spawned: 0, calls: 0, offCam: 0 }; E.spawned += n; E.calls++; if (offCam) E.offCam++; E.live = C.emojis.length; } catch (er) {}
  }
  updateCrowd(delta) {
    const C = this.crowd; if (!C || !C.built) return;
    const dt = Math.max(0, Math.min(120, delta));
    C.t += dt;
    if (C.voices && C.voices.length) {
      for (let i = C.voices.length - 1; i >= 0; i--) {
        const v = C.voices[i]; v.t += dt;
        const f = v.t / v.life;
        if (f >= 1 || !v.box.active) { try { v.box.destroy() } catch (er) {} C.voices.splice(i, 1); continue; }
        // pop, ride up off the terrace, then go
        const pop = Math.min(1, v.t / (REDUCED_MOTION ? 1 : 130));
        v.box.setScale(REDUCED_MOTION ? 1 : .55 + .45 * (1 - Math.pow(1 - pop, 3)));
        v.box.y = v.y0 == null ? (v.y0 = v.box.y) : v.y0 - v.rise * f;
        v.box.setAlpha(f < .12 ? f / .12 : f > .72 ? Math.max(0, (1 - f) / .28) : 1);
      }
    }
    if (C.emojis && C.emojis.length) {   // v98: the emoji ride up off the terrace and fade
      for (let i = C.emojis.length - 1; i >= 0; i--) {
        const v = C.emojis[i]; v.t += dt; if (v.t < 0) continue;
        const f = v.t / v.life;
        if (f >= 1 || !v.tx.active) { try { v.tx.destroy() } catch (er) {} C.emojis.splice(i, 1); continue; }
        const pop = Math.min(1, v.t / (REDUCED_MOTION ? 1 : 160)), ease = 1 - Math.pow(1 - f, 2);
        v.tx.setScale(REDUCED_MOTION ? 1 : .4 + .6 * (1 - Math.pow(1 - pop, 3)) + Math.sin(f * Math.PI) * .12);
        v.tx.setPosition(v.x0 + Math.sin(f * 6.5 + v.seed) * v.wob * f, v.y0 - v.rise * ease);
        v.tx.setAlpha(f < .1 ? f / .1 : f > .7 ? Math.max(0, (1 - f) / .3) : 1);
      }
    }
    C.excite = Math.max(0, C.excite - dt / TU("crowdCalmMs", 2800));
    const bobMs = TU("crowdBobMs", 780), bobPx = TU("crowdBobPx", 1.7), swayPx = TU("crowdSwayPx", 0.9);
    const decay = TU("crowdDecayMs", 1600), ambient = TU("crowdAmbientMs", 7000);
    for (let i = 0; i < C.built; i++) {
      const s = C.secs[i];
      if (s.pendAmt > 0 && C.t >= s.pendAt) { s.heat = Math.min(1, s.heat + s.pendAmt); s.pendAmt = 0; }
      // ambient life: even a dead game has a few sections on their feet, and the
      // baseline rises with how excited the stadium already is
      if (Math.random() < dt / ambient * (0.5 + C.excite * 2.2)) s.heat = Math.min(1, s.heat + 0.3 + Math.random() * 0.35);
      s.heat = Math.max(0, s.heat - dt / decay);
      // Only the CHEER layer moves. Both cells carry the same bleachers, so bobbing
      // the idle layer too would visibly wobble the concrete; bouncing just the
      // overlay reads as people rising and settling while the stand stays put.
      const ph = C.t / bobMs * Math.PI * 2 + s.phase;
      const amp = s.k * (0.25 + s.heat * 1.35);
      s.spr.cheer.setAlpha(s.heat)
        .setPosition(s.bx + Math.cos(ph * 0.63) * swayPx * amp, s.by - Math.abs(Math.sin(ph)) * bobPx * amp);
    }
  }
  /* ===== v92 THE LIGHTS AND THE BIG SCREEN (scene side) =====
   * buildStadiumV92 runs at the end of every buildCrowd: it reads the bowl sections'
   * boxes (top edge, bottom edge, perspective k) and stands the towers and the screen
   * on them. updateStadiumV92 runs every frame: the lamps breathe, the screen's camera
   * viewport is re-derived from where the screen's inner rectangle lands on the main
   * camera (a camera viewport is in SCREEN pixels, the screen is in WORLD pixels), the
   * feed follows the ball, and the whole thing switches itself off while the screen is
   * out of the main camera's view — a second camera renders the display list again,
   * so it only runs while somebody can see it. On the whistle the feed's pixels are
   * snapshotted into a still that holds, with a slow push-in, until the next snap. */
  buildStadiumV92() {
    try {
      const C = this.crowd; if (!C || !C.built || !this.add) return false;
      // the BACK of the bowl: the sections across the middle of the frame. The corners
      // curve toward the camera and stand taller and lower on screen, so measuring the
      // whole bowl would sink the masts to the corners' feet and hide the lamps.
      const all = C.secs.slice(0, C.built).filter((s) => s.sgn === 0 && s.bh > 0);
      const back = all.filter((s) => s.bx < FW * 0.7 && s.bx + s.bw > FW * 0.3);
      const bowl = back.length ? back : all;
      const ST = this.stadium || (this.stadium = { towers: [], t: 0, mode: "live", shots: 0, on: false });
      if (!bowl.length || !TU("stadiumV92", 1)) { this.hideStadiumV92(); return false; }
      let top = 1e9, bot = -1e9, k = 0;
      for (const s of bowl) { top = Math.min(top, s.by); bot = Math.max(bot, s.by + s.bh); k += s.k; }
      k /= bowl.length; const KS = k / 0.43;                  // the far end's perspective, relative to the shape it was tuned at
      ST.top = top; ST.bot = bot; ST.k = k; ST.on = true;
      const depT = TU("crowdDepth", 3.45) - 0.25, depS = TU("crowdDepth", 3.45) - 0.15;   // behind the bowl, above the sky
      // ---- the towers: four masts across the back of the bowl, heads turned toward the field.
      // v98: planted on a FIXED row, not on the bowl's remeasured foot. The perspective is
      // re-anchored at every snap, so the bowl's bottom edge wanders by twenty-odd pixels
      // between plays and the masts used to hop with it. Their feet now sit a fixed height
      // above the far end line (inside the bowl's band at every anchoring the game
      // produces, so the stand still hides them), at a fixed scale; only when the bowl
      // rises above that row do they follow it up, so a foot never shows on the grass.
      /* ===== v112 THE LIGHTS SIT LOWER, SMALLER, AND FACE THE OTHER WAY =====
       * Three dials on the same four masts, each one its own number so any of them can be
       * put back on its own. `lightScaleV112` is how much of the v98 mast is drawn (0.5 =
       * half); `lightDropV112` walks the whole rig DOWN the screen from the row v98 planted
       * it on, so the fixtures tuck into the top of the bowl instead of filling the sky; and
       * `lightFlipV112` takes the OTHER drawn face off the sheet, so a mast's lamp bank hangs
       * on the opposite side of its own pole. The drop is added AFTER v98's min(), not inside
       * it, so the foot row is exactly as stable between snaps as it was — v99's key light
       * reads that row, and a key light that hops is a shadow that swims.
       * Everything the lamps do follows by construction: `lightRigV98` derives the head, the
       * bloom and the beam from `displayHeight`/`_bx`/`_by`, so halving the mast halves the
       * glow and shortens the beam without a second dial. The POOL is deliberately not
       * halved — the pool is the light on the grass, not the fixture — and rides
       * `lightPoolKV112` if it ever should be. ===== */
      const LSC = Math.max(0.15, TU("lightScaleV112", 0.5));                            // v112: half the drawn mast
      const KS0 = TU("lightKS", 1.07), H = TU("lightH", 240) * KS0 * LSC, xs = [0.02, 0.2, 0.8, 0.98].map((f) => FW * f);
      const footY = Math.min(NSTOP - TU("lightFootUp", 40), bot - TU("lightSink", 4) * KS) + TU("lightDropV112", 44);
      const flip = !!TU("lightFlipV112", 1);                                            // v112: the mirrored fixture
      const hasArt = !!(RIB.lightsImg && this.textures.exists("rib_lights_v92"));
      ST.lights = ST.lights || [];
      xs.forEach((x, i) => {
        let tw = ST.towers[i];
        if (hasArt && (!tw || !tw.scene)) { tw = ST.towers[i] = this.add.image(0, 0, "rib_lights_v92", 0).setOrigin(0.5, 1); tw._phase = i * 1.7; }
        if (!tw || !tw.scene) return;
        const inward = x < FW / 2, side = flip ? !inward : inward;                       // v112: which way the fixture hangs
        const face = side ? RIB_META_V92.faces.right : RIB_META_V92.faces.left;   // heads turned in toward the field
        tw._face = face; tw.setFrame(face * RIB_META_V92.frames);
        tw._bx = x; tw._by = footY; tw._sway = [0, 1, 0, 0.7][i] || 0;                 // v98: two of the four masts move in the wind
        tw.setPosition(x, footY).setScale(H / RIB_META_V92.cell[1]).setDepth(depT).setVisible(true);
        { const lm = this.lightMulV100() * this.dayMulV144(), g = Math.max(0, Math.min(255, Math.round(255 * Math.min(1, 0.28 + 0.72 * lm))));   // v100: dark masts. v144: and by day they are just steel when the lights are down
          tw.setTint((g << 16) | (g << 8) | g); }
        tw._poolK = TU("lightPoolKV112", 1);        // v112: the pool is the light, not the fixture — it does not halve
        this.lightRigV98(i, tw, side ? 1 : -1, depT);
      });
      this.buildMirrorMastsV102(depT, KS0, H, hasArt);   // v102: the same masts at the near end and along the touchlines
      // ---- the screen: a bezel above the bowl's top edge on two legs, the feed inside it
      const W = TU("jumboW", 300) * KS, Hh = TU("jumboH", 112) * KS, cx = FW / 2, y1 = top - TU("jumboLift", 10) * KS, y0 = y1 - Hh;
      const bz = 5 * KS, strip = TU("jumboStrip", 11) * KS;   // the bezel's bottom strip carries the LIVE / REPLAY tag and the score
      ST.rect = { x: cx - W / 2 + bz, y: y0 + bz, w: W - 2 * bz, h: Hh - 2 * bz - strip };
      if (!ST.frame || !ST.frame.scene) ST.frame = this.add.graphics();
      const g = ST.frame; g.clear(); g.setDepth(depS).setVisible(true);
      g.fillStyle(0x1b2027, 1); g.fillRect(cx - 14 * KS, y1 - 4, 8 * KS, top - y1 + 30 * KS); g.fillRect(cx + 6 * KS, y1 - 4, 8 * KS, top - y1 + 30 * KS);   // the legs, down behind the top deck
      g.fillStyle(0x0b0d12, 1); g.fillRect(cx - W / 2, y0, W, Hh);                                   // the bezel
      g.lineStyle(1.2 * KS, 0x3a4250, 1); g.strokeRect(cx - W / 2, y0, W, Hh);
      g.fillStyle(0x000000, 1); g.fillRect(ST.rect.x, ST.rect.y, ST.rect.w, ST.rect.h);              // the panel (black until the feed is on)
      // the tag lives on the strip BELOW the panel: the feed camera paints over the panel, so
      // anything the main camera draws inside it is covered while the feed is on
      if (!ST.tag || !ST.tag.scene) ST.tag = this.add.text(0, 0, "● LIVE", { fontFamily: "Oswald, sans-serif", fontSize: "12px", fontStyle: "bold", color: "#ff5a5a" }).setOrigin(0, 0.5);
      ST.tag.setPosition(ST.rect.x + 1 * KS, y1 - bz - strip / 2).setScale(KS * 0.8).setDepth(depS + 0.02).setVisible(true);
      if (!ST.score || !ST.score.scene) ST.score = this.add.text(0, 0, "", { fontFamily: "Oswald, sans-serif", fontSize: "12px", fontStyle: "bold", color: "#f2e6c4" }).setOrigin(1, 0.5);
      ST.score.setPosition(ST.rect.x + ST.rect.w - 1 * KS, y1 - bz - strip / 2).setScale(KS * 0.8).setDepth(depS + 0.02).setVisible(true);
      try { const nm = this.teamNames(), sc = this.scoreLineV92(); ST.score.setText((nm.us + " " + sc.us + "  –  " + sc.them + " " + nm.them).toUpperCase()); } catch (e) {}
      // ---- the feed: a second camera, ignoring the stadium itself so it never films its own screen
      if (!ST.cam) {
        ST.cam = this.cameras.add(0, 0, 8, 8, false, "jumboV92");
        ST.cam.setBounds(0, 0, FW, WORLD_H).setRoundPixels(true).setVisible(false);
      }
      try { ST.cam.ignore([g, ST.tag, ST.score].concat(ST.towers.filter((t) => t && t.scene), ST.still && ST.still.scene ? [ST.still] : [],
        (ST.lights || []).flatMap((L) => L ? [L.glow, L.beam].filter((o) => o && o.scene) : []))); } catch (e) {}
      if (ST.still && ST.still.scene) ST.still.setPosition(ST.rect.x + ST.rect.w / 2, ST.rect.y + ST.rect.h / 2).setDisplaySize(ST.rect.w, ST.rect.h).setDepth(depS + 0.01);
      this.stadiumModeV92(ST.mode === "replay" && ST.still && ST.still.scene ? "replay" : "live");
      /* v112: one hook for the stadium pass — the masts' size/row/face, the lamps, the bowl's
       * band and its entrance, the stars in the sky, and the near rows of the warped turf. */
      try { window.__V112_B = () => {
        const T = (ST.towers || []).filter((t) => t && t.scene);
        const M = window.__FIELDMAP_V72 || null;
        const near = (() => { if (!M) return null; const rows = [];
          for (const u of [0, 20, 60, 120, 240, 400, 600, 700]) { const p = M.pj(u, (F_TOP + F_BOT) / 2); rows.push({ u, y: +p.y.toFixed(1), art: +M.artY(u).toFixed(2), k: +p.s.toFixed(4) }); }
          const px = (a, b) => { const A = M.pj(a, 220), B2 = M.pj(b, 220); return +(Math.abs(B2.y - A.y) / Math.max(1e-6, Math.abs(M.artY(b) - M.artY(a)))).toFixed(3) };
          return { rows, pxPerArtRow: { near: px(2, 30), mid: px(330, 390), far: px(690, 716) } }; })();
        return {
          masts: T.map((t, i) => ({ i, x: Math.round(t.x), bx: Math.round(t._bx), by: Math.round(t._by), h: Math.round(t.displayHeight), w: Math.round(t.displayWidth),
            top: Math.round(t._by - t.displayHeight), face: t._face, flipped: t._face !== (t._bx < FW / 2 ? RIB_META_V92.faces.right : RIB_META_V92.faces.left),
            drawn: !!t.visible, bleeds: this.onTurfV103(t.getBounds()) })),
          dials: { scale: TU("lightScaleV112", 0.5), drop: TU("lightDropV112", 44), flip: TU("lightFlipV112", 1), baseRow: Math.round(Math.min(NSTOP - TU("lightFootUp", 40), ST.bot - TU("lightSink", 4) * (ST.k / 0.43))) },
          key: (() => { const K = this.keyLightV99(); return { x: Math.round(K.x), y: Math.round(K.y), i: K.i, on: K.on }; })(),
          rigs: (ST.lights || []).filter((L) => L && L.glow && L.glow.scene).map((L) => ({
            glow: { x: Math.round(L.glow.x), y: Math.round(L.glow.y), w: Math.round(L.glow.displayWidth), on: !!L.glow.visible },
            beam: { len: Math.round(L.beam.displayHeight), rot: +L.beam.rotation.toFixed(3) },
            pool: { x: Math.round(L.pool.x), y: Math.round(L.pool.y), w: Math.round(L.pool.displayWidth), h: Math.round(L.pool.displayHeight) } })),
          turf: this.turfRowsV103().map((r) => ({ y: Math.round(r.y), x0: Math.round(r.x0), x1: Math.round(r.x1) })),
          bowl: { top: Math.round(ST.top), bot: Math.round(ST.bot), k: +ST.k.toFixed(3) },
          trim: (this.crowd && this.crowd.trim112) || null,
          stars: this._starsV112 || null,
          nstop: NSTOP, worldH: WORLD_H, backMax: PERSP && PERSP.kMax != null ? +PERSP.kMax.toFixed(3) : null,
          wasBackMax: PERSP_BACKMAX, depth: (window.__FIELD_FX || {}).depth, edge: this._nearEdgeV112 || null,
          field: near }; }; } catch (e) {}
      try { window.__V99 = { key: () => this.keyLightV99(), posts: () => this._postShadDbgV99 || null,
        cast: (x, y) => { const V = this.shadowVecV99(x, y); return { ux: +V.ux.toFixed(3), uy: +V.uy.toFixed(3), slope: +V.slope.toFixed(3), reach: +V.reach.toFixed(3) }; },
        man: (i) => { const m = this.markers[i]; if (!m || !m.shadow) return null; const sh = m.shadow;
          return { x: +sh.x.toFixed(2), y: +sh.y.toFixed(2), rot: +sh.rotation.toFixed(3), sx: +sh.scaleX.toFixed(3), sy: +sh.scaleY.toFixed(3), a: +sh.alpha.toFixed(3), root: { x: Math.round(m.root.x), y: Math.round(m.root.y), s: +m.root.scale.toFixed(3) } }; },
        dial: () => ({ light: +this.lightMulV100().toFixed(3), shadow: +this.shadowMulV100().toFixed(3), setting: (window.__FIELD_FX || {}).light }),
        ball: () => this.ballShad && this.ballShad.scene ? { x: Math.round(this.ballShad.x), y: Math.round(this.ballShad.y), a: +this.ballShad.alpha.toFixed(3), vis: this.ballShad.visible } : null }; } catch (e) {}
      try { window.__V92 = Object.assign(window.__V92 || {}, { on: true, towers: ST.towers.filter((t) => t && t.scene && t.visible).length, bowl: { top: Math.round(top), bot: Math.round(bot), k: +k.toFixed(3) },
        screen: () => ({ mode: ST.mode, rect: ST.rect, cam: ST.cam ? { x: ST.cam.x, y: ST.cam.y, w: ST.cam.width, h: ST.cam.height, zoom: ST.cam.zoom, visible: ST.cam.visible } : null, shots: ST.shots, hasArt }),
        towerBoxes: () => ST.towers.filter((t) => t && t.scene).map((t) => ({ x: Math.round(t.x), y: Math.round(t.y), top: Math.round(t.y - t.displayHeight), w: Math.round(t.displayWidth), depth: t.depth, frame: t.frame.name, face: t._face, bx: t._bx, by: t._by, sway: t._sway, tint: t.tintTopLeft })),
        key: () => { const K = this.keyLightV99(); return { x: Math.round(K.x), y: Math.round(K.y), i: K.i, on: K.on }; },
        // v102: the mirrored masts, their rigs, and the live breath
        mirror: () => (ST.mirror || []).filter((t) => t && t.scene && (t.visible || t._litOnly)).map((t) => ({ id: t._mirror, x: Math.round(t.x), y: Math.round(t.y), top: Math.round(t.y - t.displayHeight), h: Math.round(t.displayHeight), face: t._face, sway: t._sway, k: +(t._k || 0).toFixed(3), depth: t.depth, drawn: !!t.visible })),
        // v103: the painted turf as the guard reads it, and every mast sprite tested against it
        turf: () => this.turfRowsV103().map((r) => ({ y: Math.round(r.y), x0: Math.round(r.x0), x1: Math.round(r.x1) })),
        onTurf: () => ST.towers.concat(ST.mirror || []).filter((t) => t && t.scene).map((t) => ({ id: t._mirror || "far", drawn: !!t.visible, bleeds: this.onTurfV103(t.getBounds()) })),
        mirrorLights: () => (ST.mirrorLights || []).filter((L) => L && L.glow && L.glow.scene).map((L) => ({ glow: { x: Math.round(L.glow.x), y: Math.round(L.glow.y), a: +L.glow.alpha.toFixed(3), drawn: !!L.glow.visible }, pool: { x: Math.round(L.pool.x), y: Math.round(L.pool.y), a: +L.pool.alpha.toFixed(3), w: Math.round(L.pool.displayWidth) }, beam: { len: Math.round(L.beam.displayHeight), a: +L.beam.alpha.toFixed(3) } })),
        live: () => ({ all: +this.lightLiveAllV102().toFixed(4), per: ST.towers.concat(ST.mirror || []).filter((t) => t && t.scene).map((t) => +this.lightLiveV102(t).toFixed(4)), sputters: (window.__V102 || {}).sputters || 0, sputtering: ST.towers.concat(ST.mirror || []).filter((t) => t && t._sput).length }),
        lights: () => (ST.lights || []).filter((L) => L && L.glow && L.glow.scene).map((L) => ({ glow: { x: Math.round(L.glow.x), y: Math.round(L.glow.y), a: +L.glow.alpha.toFixed(3), depth: L.glow.depth, blend: L.glow.blendMode },
          beam: L.beam && L.beam.scene ? { x: Math.round(L.beam.x), y: Math.round(L.beam.y), rot: +L.beam.rotation.toFixed(3), len: Math.round(L.beam.displayHeight), a: +L.beam.alpha.toFixed(3), depth: L.beam.depth } : null,
          pool: L.pool && L.pool.scene ? { x: Math.round(L.pool.x), y: Math.round(L.pool.y), a: +L.pool.alpha.toFixed(3), depth: L.pool.depth } : null })) }); } catch (e) {}
      return true;
    } catch (e) { return false; }
  }
  /* ===== v98 UNDER THE LIGHTS — the lamps =====
   * Each mast carries three additive sprites: a glow at the lamp head, a beam from the
   * head down onto the field it faces, and a pool on the turf where the beam lands. All
   * three breathe on the mast's own phase — the glow brightest when its lamps are — so the
   * light is alive without ever flashing. The glow and beam are sky objects (the feed
   * camera ignores them); the pool sits between the grass and the paint, so the field's
   * lines and the players' shadows stay on top of it. Textures are drawn once per scene. */
  lightTexV98() {
    const T = this.textures; if (!T) return false;
    if (!T.exists("rib_glow_v98")) {
      const cv = document.createElement("canvas"); cv.width = cv.height = 160; const c = cv.getContext("2d");
      const g = c.createRadialGradient(80, 80, 0, 80, 80, 80);
      g.addColorStop(0, "rgba(255,250,235,1)"); g.addColorStop(0.18, "rgba(255,244,210,.75)"); g.addColorStop(0.5, "rgba(255,236,190,.22)"); g.addColorStop(1, "rgba(255,230,180,0)");
      c.fillStyle = g; c.fillRect(0, 0, 160, 160); T.addCanvas("rib_glow_v98", cv);
    }
    if (!T.exists("rib_beam_v98")) {
      const W = 128, Hh = 320, cv = document.createElement("canvas"); cv.width = W; cv.height = Hh; const c = cv.getContext("2d");
      for (let y = 0; y < Hh; y++) {               // a cone: narrow at the head, wide and faint where it lands, soft at both edges
        const f = y / Hh, w = 10 + (W - 10) * f, a = Math.pow(1 - f, 1.35) * 0.9;
        const g = c.createLinearGradient(W / 2 - w / 2, 0, W / 2 + w / 2, 0);
        g.addColorStop(0, "rgba(255,240,205,0)"); g.addColorStop(0.5, "rgba(255,240,205," + a.toFixed(3) + ")"); g.addColorStop(1, "rgba(255,240,205,0)");
        c.fillStyle = g; c.fillRect(W / 2 - w / 2, y, w, 1);
      }
      T.addCanvas("rib_beam_v98", cv);
    }
    if (!T.exists("rib_pool_v98")) {
      const cv = document.createElement("canvas"); cv.width = 256; cv.height = 128; const c = cv.getContext("2d");
      c.save(); c.scale(1, 0.5);
      const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, "rgba(255,246,220,.9)"); g.addColorStop(0.5, "rgba(255,246,220,.32)"); g.addColorStop(1, "rgba(255,246,220,0)");
      c.fillStyle = g; c.fillRect(0, 0, 256, 256); c.restore(); T.addCanvas("rib_pool_v98", cv);
    }
    return true;
  }
  lightRigV98(i, tw, dir, depT, store, litOnly) {
    const ST = this.stadium; if (!ST || !TU("lightsV98", 1) || !this.lightTexV98()) return;
    const ADD = (mt.BlendModes && mt.BlendModes.ADD) != null ? mt.BlendModes.ADD : 1;
    const rigs = store || ST.lights;   // v102: the mirrored masts keep their rigs in their own store
    let L = rigs[i];
    if (!L || !L.glow || !L.glow.scene) {
      L = rigs[i] = {
        glow: this.add.image(0, 0, "rib_glow_v98").setBlendMode(ADD).setTint(0xfff1c8),
        beam: this.add.image(0, 0, "rib_beam_v98").setOrigin(0.5, 0).setBlendMode(ADD).setTint(0xffe9bd),
        pool: this.add.image(0, 0, "rib_pool_v98").setBlendMode(ADD).setTint(0xfff4d8),
        phase: tw._phase || 0, dir };
    }
    const dh = tw.displayHeight, dw = tw.displayWidth;
    // the head: the lamp bank sits in the top quarter of the cell, leaning toward the field
    L.hx = tw._bx + dir * dw * TU("lightHeadX", 0.08); L.hy = tw._by - dh * TU("lightHeadFrac", 0.76);
    const gw = Math.min(TU("mirrorGlowMax", 400), dh * TU("lightGlowW", 0.95));   // v102: a near mast is three times the size; its bloom is not
    // v103: a lit-only mast is not drawn, so neither is the bloom around its lamp bank —
    // a glow with no lamp under it is the same lie. The beam and the pool ARE the light, and stay.
    L.glow.setPosition(L.hx, L.hy).setDisplaySize(gw, gw).setDepth(depT + 0.01).setVisible(!litOnly);
    // the beam: from the head to the patch of field this mast faces (v102: a mirrored mast
    // names its own patch — the near half, or the touchline it stands behind)
    const ax = tw._aimX != null ? tw._aimX : FW / 2 + dir * FW * TU("beamAimX", 0.1), ay = tw._aimY != null ? tw._aimY : NSTOP + TU("beamAimDown", 300);
    const ddx = ax - L.hx, ddy = ay - L.hy, dist = Math.hypot(ddx, ddy);
    L.beam.setPosition(L.hx, L.hy).setRotation(Math.atan2(ddy, ddx) - Math.PI / 2)
      .setScale(TU("beamW", 1.15) * dh / 240, dist * TU("beamReach", 0.8) / 320).setDepth(TU("crowdDepth", 3.45) + 0.006).setVisible(true);
    // the pool: where the beam lands, pulled in a little toward the field
    const pk = tw._poolK || 1;
    L.pool.setPosition(tw._poolX != null ? tw._poolX : FW / 2 + (tw._bx - FW / 2) * 0.88, tw._poolY != null ? tw._poolY : NSTOP + TU("fieldPoolDown", 150))
      .setDisplaySize(TU("poolW", 540) * pk, TU("poolH", 250) * pk).setDepth(0.62).setVisible(true);
  }
  /* ===== v102 THE LIGHTS ARE MIRRORED, AND THEY BREATHE =====
   * Four masts stood behind the far bowl and nothing stood anywhere else, so the stadium
   * was lit from one end: every pool was on the far half, every fill shadow came from up
   * there, and the near half of the field fell away into the dark. A ground has masts at
   * BOTH ends and along the sides. The far four are untouched (the checks, the key light
   * and the v98 sway all read them as they always did); this adds their mirror.
   *
   * v103: `mirrorMastsV102` now DEFAULTS TO 0 — the lights are on the north side of the
   * ground only, which is how it was asked for. The near half is lit by the far bank and the
   * turf's own baked wash again, as it was in v98. Everything below still works and is one
   * number away, and the guard it goes through (`onTurfV103`) is what keeps it honest if it
   * comes back on; what follows describes the bank as it is built when it does:
   *   - the NEAR four, at the near corners — the far masts' lateral positions carried
   *     through the crowd's own projection to the near end line, so they stand exactly
   *     where the far ones would if the camera turned round, scaled by the near end's
   *     perspective. They are behind the camera most of the time, which is right: what
   *     you see of them is their LIGHT — pools on the near half, the beams, and a fill
   *     shadow that now comes from the camera side for a man on the near half;
   *   - the two SIDE masts, one behind each touchline stand at midfield, whose heads rise
   *     over the stand at the edge of the frame in ordinary play.
   * All of them go through the same rig, the same dial, and the same light field the men
   * are shaded by (`lightRigsV101`), so a mirrored mast is a real light and not a picture.
   *
   * And every lamp now BREATHES. v99 held the output dead steady because the old six-frame
   * walk read as a strobe and swam the shadows. This is not that: `lightLiveV102` is a slow,
   * per-mast, multi-octave shimmer of a few percent — the way a lamp bank reads across a
   * stadium, never the same brightness two seconds running — plus a rare SPUTTER, a bulb
   * dipping for a tenth of a second (a different sheet frame while it dips, so one bulb in
   * the bank visibly flickers) every ten seconds or so per mast. The key light's POSITION
   * never moves, so shadows keep their direction and only their weight breathes with the
   * light that casts them. `lightLiveV102` at 0 puts the v99 stillness back. */
  buildMirrorMastsV102(depT, KS0, H, hasArt) {
    const ST = this.stadium; if (!ST) return;
    this._turfV103 = null;   // v103: re-read the painted quad — the perspective sliders move it
    ST.mirror = ST.mirror || []; ST.mirrorLights = ST.mirrorLights || [];
    if (!TU("mirrorMastsV102", 0) || !hasArt || !this.crowdProject) { for (const t of ST.mirror) { try { t._litOnly = false; t.setVisible(false); } catch (e) {} }
      for (const L of ST.mirrorLights) { try { L.glow.setVisible(false); L.beam.setVisible(false); L.pool.setVisible(false); } catch (e) {} } return; }
    const FX = window.__FIELD_FX || {}, sp = FX.spread == null ? 1 : FX.spread;
    const latK = 1.30 * TU("latCal", 1.16) * sp * PERSP_OA;   // crowdProject's lateral scale, per unit of k
    const kFar = Math.max(0.05, ST.k || 0.43);
    const EZG = TU("crowdEndGap", 44), GAP = TU("crowdGap", 104), MIDY = (F_TOP + F_BOT) / 2, HALF = (F_BOT - F_TOP) / 2;
    const specs = [];
    // the near four: the far masts' lateral fractions, mirrored to the near end line
    [0.02, 0.2, 0.8, 0.98].forEach((f, j) => {
      const vv = MIDY + (f - 0.5) * FW / (latK * kFar);                       // the far mast's lateral, in crowd space
      const p = this.crowdProject(-EZG * TU("mirrorNearOut", 1), vv);         // ...projected at the near end
      specs.push({ id: "near" + j, x: p.x, y: p.y + TU("mirrorNearSink", 8) * p.k, k: p.k, face: f < 0.5 ? RIB_META_V92.faces.right : RIB_META_V92.faces.left,
        dir: f < 0.5 ? 1 : -1, sway: [0.7, 0, 1, 0][j], phase: 4.1 + j * 1.3,
        aimX: FW / 2 + (f < 0.5 ? 1 : -1) * FW * TU("beamAimX", 0.1), aimY: NSTOP + NSH - TU("beamAimDown", 300),
        poolX: FW / 2 + (p.x - FW / 2) * TU("mirrorPoolPull", 0.3), poolY: NSTOP + NSH - TU("fieldPoolDown", 150), poolK: TU("mirrorNearPoolK", 1.5) });
    });
    /* v103: the touchline masts are GONE. There is nowhere along a sideline to stand one.
     * The stands there are drawn as diagonal billboards, and the crowd builder documents that
     * such a band's bounding box NECESSARILY overhangs the playing surface — so anchoring a
     * mast anywhere inside that box put a pole on the grass, bleeding over the sideline and
     * the field itself at any ordinary play zoom. Projecting the foot further out instead put
     * it on the apron in front of the benches. Both are worse than not having them: the near
     * and far masts already light the whole field, and a floodlight you can see standing on
     * the twenty is a bigger cost than a slightly flatter midfield. */
    const cap = TU("mirrorScaleCap", 3.2);
    specs.forEach((sp2, i) => {
      let tw = ST.mirror[i];
      if (!tw || !tw.scene) { tw = ST.mirror[i] = this.add.image(0, 0, "rib_lights_v92", 0).setOrigin(0.5, 1); }
      tw._phase = sp2.phase; tw._face = sp2.face; tw.setFrame(sp2.face * RIB_META_V92.frames);
      tw._bx = sp2.x; tw._by = sp2.y; tw._sway = sp2.sway; tw._mirror = sp2.id; tw._k = sp2.k;
      tw._aimX = sp2.aimX; tw._aimY = sp2.aimY; tw._poolX = sp2.poolX; tw._poolY = sp2.poolY; tw._poolK = sp2.poolK;
      const scale = (H / RIB_META_V92.cell[1]) * Math.min(cap, Math.max(0.6, sp2.k / kFar));
      tw.setPosition(sp2.x, sp2.y).setScale(scale).setDepth(depT).setVisible(true);
      /* v103 NOTHING STANDS ON THE GRASS: a near mast is BEHIND the camera, so whatever
       * part of its art reaches the frame is a far-end mast drawn from the wrong side —
       * and at the near end that lands squarely on the turf. Keep it as a LIGHT (the rig,
       * the shading field, the breath) and stop drawing the fixture. */
      tw._litOnly = this.onTurfV103(tw.getBounds());
      if (tw._litOnly) tw.setVisible(false);
      { const lm = this.lightMulV100(), g = Math.max(0, Math.min(255, Math.round(255 * Math.min(1, 0.28 + 0.72 * lm)))); tw.setTint((g << 16) | (g << 8) | g); }
      this.lightRigV98(i, tw, sp2.dir, depT, ST.mirrorLights, tw._litOnly);
    });
    for (let i = specs.length; i < ST.mirror.length; i++) { try { ST.mirror[i].setVisible(false); } catch (e) {} }
    try { ST.cam && ST.cam.ignore(ST.mirror.filter((t) => t && t.scene)); } catch (e) {}
  }
  /* ===== v103 NOTHING STANDS ON THE GRASS =====
   * The playing surface is not a rectangle. PJ fans it out toward the camera — some 400
   * scene px across at the far end line, 1200 at the near one — so the world-rect guard this
   * version first shipped ("is the foot inside 0..FW / NSTOP..NSTOP+NSH?") cleared masts
   * whose art sat on the near-end grass with room to spare, which is what a player saw
   * standing over the right touchline. Test against the real quad instead: sample the two
   * painted touchlines through PJ at a row per fraction of the field, and ask whether a
   * sprite's box crosses the band between any two rows. Anything that does is not drawn.
   * The rows are cheap (a couple of dozen PJ calls) and are taken at build time, so they
   * follow the perspective sliders without needing to be invalidated. */
  turfRowsV103() {
    const rows = [], N = Math.max(4, Math.round(TU("turfProbeRows", 24)));
    for (let i = 0; i <= N; i++) {
      const u = (i / N) * FW, a = PJ(u, F_TOP), b = PJ(u, F_BOT);
      rows.push({ y: a.y, x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x) });
    }
    return rows.sort((p, q) => p.y - q.y);   // VDIR flips which end is which; depth order does not
  }
  /* Does this box put anything on the painted grass? mastClearPx is a small tolerance around
   * the quad, deliberately small: a scene pixel at the far end line is worth several yards of
   * depth, so a generous margin there would condemn the far masts, which stand honestly behind
   * the end line with their feet a few px clear of the paint. */
  onTurfV103(box) {
    const rows = this._turfV103 || (this._turfV103 = this.turfRowsV103()), c = TU("mastClearPx", 8);
    const L = box.x, R = box.right != null ? box.right : box.x + box.width, T = box.y, B = box.bottom != null ? box.bottom : box.y + box.height;
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1], b = rows[i];
      if (b.y < T - c || a.y > B + c) continue;                     // this band of turf is clear of the art
      if (R >= Math.min(a.x0, b.x0) - c && L <= Math.max(a.x1, b.x1) + c) return true;
    }
    return false;
  }
  // the live breath of one mast: a few percent of slow shimmer, and the rare sputter
  lightLiveV102(tw) {
    const A = TU("lightShimmerA", 0.065) * TU("lightLiveV102", 1);
    if (A <= 0 || !tw) return 1;
    const ST = this.stadium, t = ST ? ST.t : 0, ph = tw._phase || 0;
    let k = 1 + A * (0.6 * Math.sin(t / 1700 + ph) * Math.sin(t / 530 + ph * 2.3) + 0.4 * Math.sin(t / 4100 + ph * 0.7));
    if (tw._sputAt == null) tw._sputAt = t + TU("sputterMinMs", 14000) + Math.random() * TU("sputterSpanMs", 26000);
    if (t >= tw._sputAt) {
      if (!tw._sput) { tw._sput = { t0: t, ms: 80 + Math.random() * 90, d: TU("sputterDepth", 0.18) + Math.random() * 0.17, twice: Math.random() < 0.35, f: 1 + Math.floor(Math.random() * (RIB_META_V92.frames - 1)) };
        try { const S2 = window.__V102 = window.__V102 || { sputters: 0 }; S2.sputters++; } catch (e) {} }
      const q = (t - tw._sput.t0) / tw._sput.ms;
      if (q < 1) k *= 1 - tw._sput.d * Math.sin(q * Math.PI);
      else if (tw._sput.twice && q < 3) { if (q > 2) k *= 1 - tw._sput.d * 0.7 * Math.sin((q - 2) * Math.PI); }
      else { tw._sput = null; tw._sputAt = t + TU("sputterMinMs", 14000) + Math.random() * TU("sputterSpanMs", 26000); }
    }
    return k;
  }
  // the whole stadium's breath, for everything that is lit by all of it at once
  lightLiveAllV102() {
    const ST = this.stadium; if (!ST || !ST.on || !TU("lightLiveV102", 1)) return 1;
    if (ST._liveT === ST.t && ST._live != null) return ST._live;
    let sum = 0, n = 0;
    for (const t of (ST.towers || [])) if (t && t.scene && t.visible) { sum += this.lightLiveV102(t); n++; }
    for (const t of (ST.mirror || [])) if (t && t.scene && (t.visible || t._litOnly)) { sum += this.lightLiveV102(t); n++; }
    ST._liveT = ST.t; ST._live = n ? sum / n : 1;
    return ST._live;
  }
  /* ===== v99 THE SHADOWS FALL =====
   * A stadium with four masts and no shadows reads as a field at noon. Everything on
   * the grass now casts from ONE light post — the key light, deliberately a mast that
   * does not sway, read from its FIXED base (`tw._bx/_by`), so a shadow never wobbles
   * or hunts between sources. From that one light everything else follows:
   *   - direction is the vector from the light to the object's feet, so a shadow swings
   *     around a man as he crosses the field and rakes the same way for everything on it;
   *   - length is the object's own height times a slope that opens with distance from the
   *     light (`shadowSlope`), which is what makes the goalposts throw a long frame across
   *     the end zone while a pylon barely marks the grass — the highs and the lows;
   *   - a man in the air (a launched tackler, a ref's flag hop) leaves his shadow ON THE
   *     GROUND, shrinking and softening under him, which is the whole reason you read the
   *     leap as a leap;
   *   - the far end reads flatter than the near one (`shadowFade`), because that light is
   *     right on top of it.
   * The v86 per-quarter stretch lives inside `shadowVecV99` now, so exactly one system
   * writes these properties. */
  /* ===== v100 THE LIGHTING DIAL =====
   * One number, in Settings under FIELD VIEW, for how hard this stadium is lit. It is not a
   * brightness filter over the finished picture — it is the strength of the LIGHT, so it moves
   * everything the light is responsible for and nothing else: the wash and the pools baked on
   * the turf, the glow, beams and pools off the masts, and how deep a shadow falls. Two
   * details keep it honest at the ends of its travel: the falloff into the corners deepens as
   * the lights come DOWN (a dark stadium is not evenly dark), and shadows keep a floor of
   * ambient weight at 0 so nothing floats off the grass when the floodlights are out.
   * Changing it re-bakes the turf through the ordinary applyFieldFx -> refreshPersp path. */
  lightMulV100() {
    const f = window.__FIELD_FX || {}, v = f.light == null ? 1 : +f.light;
    return Number.isFinite(v) ? Math.max(0, Math.min(2, v)) : 1;
  }
  shadowMulV100() { return Math.max(0.2, Math.min(1.6, 0.35 + 0.65 * this.lightMulV100())) * (this.lightLiveAllV102 ? this.lightLiveAllV102() : 1); }   // v102: the weight breathes with the light
  // the turf takes the whole dial on the way DOWN and only part of it on the way up: the baked
  // wash is broad enough that a linear top end clips the far end zone to white paper
  bakedMulV100() { const m = this.lightMulV100(); return m <= 1 ? m : 1 + (m - 1) * TU("lightBakedTopK", 0.6); }
  keyLightV99() {
    const ST = this.stadium, i = Math.max(0, Math.min(3, Math.round(TU("keyLightIdx", 2))));
    const tw = ST && ST.on && ST.towers && ST.towers[i];
    if (tw && tw.scene && tw.visible && tw._bx != null)
      return { x: tw._bx, y: tw._by - tw.displayHeight * TU("lightHeadFrac", 0.76), i, on: true };
    return { x: FW * TU("keyLightFallbackX", 0.8), y: NSTOP - TU("keyLightFallbackUp", 150), i, on: false };
  }
  shadowVecV99(gx, gy) {
    const L = this._klV99 || (this._klV99 = this.keyLightV99());
    const vx = gx - L.x, vy = Math.max(30, gy - L.y), d = Math.hypot(vx, vy) || 1;
    const reach = Math.max(0, Math.min(1, (gy - NSTOP) / Math.max(1, WORLD_H - NSTOP)));
    const q = (this.play && this.play.payload && this.play.payload.quarter) || 1;
    const slope = TU("shadowSlope", 0.7) * (0.45 + reach * 1.35) * (1 + (q - 1) * TU("shadowStretchQ", 0.16));
    return { ux: vx / d, uy: vy / d, slope, reach, L };
  }
  // sh: an ellipse parented to the sprite's container, so its coordinates are the
  // container's own (the perspective scale cancels and never has to be undone here)
  castShadowV99(sh, gx, gy, h, o) {
    if (!sh || !sh.scene || !TU("shadowsV99", 1)) return null;
    o = o || {};
    const V = this.shadowVecV99(gx, gy), lift = Math.max(0, o.lift || 0);
    const len = h * V.slope, base = o.base || 26, y0 = o.y0 == null ? 24 : o.y0;
    const air = lift > 0 ? Math.max(TU("shadowAirMin", 0.45), 1 - lift / TU("shadowAirFade", 30)) : 1;
    sh.setRotation(Math.atan2(V.uy, V.ux));
    sh.setPosition(V.ux * len * 0.5, y0 + lift + V.uy * len * 0.5);
    sh.setScale(((base + len) / base) * air, air);
    sh.setAlpha((o.a == null ? TU("shadowA", 0.32) : o.a) * (1 - V.reach * TU("shadowFade", 0.22)) * air * this.shadowMulV100());
    return V;
  }
  /* ===== v101 THE LIGHT MOVES ON HIM =====
   * v99 gave the field one key light and one shadow apiece, and that shadow was the same
   * shadow all night: same darkness, same crispness, whether the man was standing on the
   * halfway line or running through the pool under a mast. A real stadium is lit by four
   * lamps at once, which is why a player out there carries a hard shadow and a second,
   * fainter one crossing it, why he brightens as he runs into a pool and cools between
   * them, and why a shadow smears when its owner is moving.
   * So three things move now, all of them off the SAME masts v99 and v92 already put in
   * the sky, none of them touching the key light's own geometry (that stays exactly the
   * single, non-wobbling cast v99 built):
   *   - `fillVecV101` / `castFillV101` — a SECOND, softer shadow from the next-nearest
   *     mast, shorter and much fainter than the key's, so the cast fans as a man crosses;
   *   - `lightAtV101` — the light landing on a point, as the sum of the four pools with
   *     distance falloff over an ambient floor, which is what makes running into a pool
   *     visibly brighter than standing between two;
   *   - a SPEED SMEAR on the key shadow: at a sprint it stretches along its own axis and
   *     thins, which reads as motion rather than as a longer man.
   * All of it rides the v100 dial: turn the lights down and the fill goes first, the pools
   * flatten toward ambient, and the smear has nothing left to stretch. */
  lightRigsV101() {
    if (this._lgV101 !== undefined && this._lgV101 !== null) return this._lgV101;
    const ST = this.stadium, out = [];
    if (ST && ST.on && ST.towers) {
      const all = ST.towers.concat(ST.mirror || []);   // v102: the mirrored masts are lights too
      for (let i = 0; i < all.length; i++) {
        const tw = all[i];
        if (!tw || !tw.scene || !(tw.visible || tw._litOnly) || tw._bx == null) continue;   // v103: lit but not drawn still lights
        out.push({ i, x: tw._bx, y: tw._by - tw.displayHeight * TU("lightHeadFrac", 0.76), py: tw._by, near: /^near/.test(tw._mirror || "") });
      }
    }
    return (this._lgV101 = out);
  }
  // the fill: the nearest mast that is NOT the key. One per frame, like the key light.
  fillLightV101(gx, gy) {
    const rigs = this.lightRigsV101(); if (!rigs.length) return null;
    const key = this._klV99 || (this._klV99 = this.keyLightV99());
    let best = null, bd = Infinity;
    for (const r of rigs) {
      if (r.i === key.i) continue;
      const d = Math.hypot(r.x - gx, Math.max(30, r.py - gy));
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }
  fillVecV101(gx, gy) {
    const L = this.fillLightV101(gx, gy); if (!L) return null;
    const vx = gx - L.x, vy = Math.max(30, gy - L.y), d = Math.hypot(vx, vy) || 1;
    const reach = Math.max(0, Math.min(1, (gy - NSTOP) / Math.max(1, WORLD_H - NSTOP)));
    return { ux: vx / d, uy: vy / d, slope: TU("fillSlopeV101", 0.44) * (0.45 + reach * 1.25), reach };
  }
  castFillV101(sh, gx, gy, h, o) {
    if (!sh || !sh.scene) return null;
    if (!TU("shadowsV99", 1) || !TU("fillShadowV101", 1)) { sh.setVisible(false); return null; }
    o = o || {};
    const V = this.fillVecV101(gx, gy);
    if (!V) { sh.setVisible(false); return null; }
    sh.setVisible(true);
    const lift = Math.max(0, o.lift || 0), len = h * V.slope, base = o.base || 26, y0 = o.y0 == null ? 24 : o.y0;
    const air = lift > 0 ? Math.max(TU("shadowAirMin", 0.45), 1 - lift / TU("shadowAirFade", 30)) : 1;
    sh.setRotation(Math.atan2(V.uy, V.ux));
    sh.setPosition(V.ux * len * 0.5, y0 + lift + V.uy * len * 0.5);
    sh.setScale(((base + len) / base) * air, air);
    // the fill is what the OTHER lamps could not cancel: faint to begin with, and the first
    // thing to go as the dial comes down, because a dim stadium has only one light worth the name
    sh.setAlpha(TU("fillShadowA", 0.14) * (1 - V.reach * TU("shadowFade", 0.22)) * air
      * Math.max(0, Math.min(1.4, this.lightMulV100())));
    return V;
  }
  /* the light landing on a spot: an ambient floor plus every lamp's pool, falling off with
   * distance. Returns 0..~1.5 — 1 is "ordinary lit turf", above that is standing in a pool. */
  lightAtV101(gx, gy) {
    const amb = TU("lightAmbV101", 0.72), dial = this.lightMulV100() * (this.lightLiveAllV102 ? this.lightLiveAllV102() : 1);   // v102: the shimmer is on the men too
    const rigs = this.lightRigsV101();
    if (!rigs.length) return amb + (1 - amb) * Math.min(1, dial);
    // the masts stand behind the FAR end, so their reach down the field is what makes the far
    // half read brighter than the near one — squash the lengthwise distance hard or the pools
    // die a few yards off the mast and the whole field flattens to ambient
    const R = TU("lightPoolRV101", 900);
    let sum = 0;
    for (const r of rigs) {
      const d = Math.hypot(gx - r.x, (gy - r.py) * TU("lightPoolSquashV101", 0.32));
      sum += Math.max(0, 1 - d / R) * Math.max(0, 1 - d / R);   // quadratic falloff — a pool, not a wash
    }
    return amb * (0.45 + 0.55 * Math.min(1, dial)) + sum * TU("lightPoolKV101", 0.16) * dial;
  }
  /* the tint that light makes on a sprite: warm where the lamps reach, cool and dim between
   * them, times whatever the broadcast spotlight is doing. Quantized to 8-value steps so the
   * canvas tint path is never handed a unique colour twice in a row. */
  shadeTintV101(gx, gy, spotK) {
    const L = this.lightAtV101(gx, gy) * (spotK == null ? 1 : spotK);
    const k = Math.max(TU("shadeFloorV101", 0.58), Math.min(TU("shadeCeilV101", 1.16), L));
    const warm = Math.max(0, Math.min(1, (k - 0.86) / 0.32));       // how much of the lamp is on him
    const r = k * (1 + 0.075 * warm), g = k * (1 + 0.03 * warm), b = k * (1 - 0.075 * warm);
    const q = (v) => Math.max(0, Math.min(255, Math.round(v * 255 / 8) * 8));
    return (q(r) << 16) | (q(g) << 8) | q(b);
  }
  hideStadiumV92() {
    const ST = this.stadium; if (!ST) return; ST.on = false;
    for (const t of ST.towers.concat(ST.mirror || [])) { try { t.setVisible(false); } catch (e) {} }
    for (const L of (ST.lights || []).concat(ST.mirrorLights || [])) { try { L.glow.setVisible(false); L.beam.setVisible(false); L.pool.setVisible(false); } catch (e) {} }
    try { ST.frame && ST.frame.setVisible(false); ST.tag && ST.tag.setVisible(false); ST.score && ST.score.setVisible(false); ST.still && ST.still.setVisible(false); ST.cam && ST.cam.setVisible(false); } catch (e) {}
    try { if (window.__V92) window.__V92.on = false; } catch (e) {}
  }
  stadiumModeV92(mode) {
    const ST = this.stadium; if (!ST) return; ST.mode = mode;
    const replay = mode === "replay" && ST.still && ST.still.scene;
    try { if (ST.still && ST.still.scene) ST.still.setVisible(!!replay && ST.on); } catch (e) {}
    try { ST.tag && ST.tag.setText(replay ? "▶ REPLAY" : "● LIVE").setColor(replay ? "#ffd75e" : "#ff5a5a"); } catch (e) {}
    if (replay && ST.still) { try { this.tweens.killTweensOf(ST.still); ST.still.setScale(ST.still.scaleX / (ST._push || 1), ST.still.scaleY / (ST._push || 1)); ST._push = 1;
      this.tweens.add({ targets: ST.still, scaleX: ST.still.scaleX * TU("jumboPushIn", 1.08), scaleY: ST.still.scaleY * TU("jumboPushIn", 1.08), duration: TU("jumboPushMs", 3200), ease: "Sine.easeOut" }); } catch (e) {} }
  }
  // the whistle: freeze the feed into a still. Only possible while the screen is on the
  // main camera (a snapshot reads the canvas), which is exactly when anyone can see it.
  stadiumWhistleV92() {
    const ST = this.stadium; if (!ST || !ST.on || !ST.cam || !ST.cam.visible) return false;
    try {
      const c = ST.cam, x = Math.round(c.x), y = Math.round(c.y), w = Math.round(c.width), h = Math.round(c.height);
      if (w < 8 || h < 8) return false;
      this.game.renderer.snapshotArea(x, y, w, h, (img) => {
        try {
          if (!img || !this.scene || !this.textures) return;
          const key = "jumbo_still_v92";
          if (this.textures.exists(key)) this.textures.remove(key);
          this.textures.addImage(key, img);
          if (!ST.still || !ST.still.scene) { ST.still = this.add.image(0, 0, key); try { ST.cam.ignore(ST.still); } catch (e) {} }
          else ST.still.setTexture(key);
          ST._push = 1;
          ST.still.setPosition(ST.rect.x + ST.rect.w / 2, ST.rect.y + ST.rect.h / 2).setDisplaySize(ST.rect.w, ST.rect.h).setDepth(ST.frame.depth + 0.01);
          ST.shots++; this.stadiumModeV92("replay");
        } catch (e) {}
      });
      return true;
    } catch (e) { return false; }
  }
  stadiumLiveV92() { const ST = this.stadium; if (ST) this.stadiumModeV92("live"); }
  scoreLineV92() {
    try { const rd = (sel) => { const el = document.querySelector(sel); const n = el ? parseInt(String(el.textContent).replace(/[^\d]/g, ""), 10) : NaN; return Number.isFinite(n) ? n : 0; };
      return { us: rd("#usScore"), them: rd("#themScore") }; } catch (e) { return { us: 0, them: 0 }; }
  }
  updateStadiumV92(delta) {
    const ST = this.stadium; if (!ST || !ST.on) return;
    try {
      // the lamps breathe: each tower walks its face's six frames on its own phase
      ST.t += delta;
      const fm = Math.max(60, TU("lightFrameMs", 420)), NF = RIB_META_V92.frames;
      // v99: the lamps HOLD. They used to walk their six frames and breathe their glow,
      // which reads as a flicker on a still stadium and, worse, swims the light the
      // shadows are cast from. One frame per face — the brightest one the sheet has — and
      // one steady output; `lightCycleV99` puts the old walk back for anyone who wants it.
      const hold = !TU("lightCycleV99", 0), HOLDF = [3, 0];
      const swPx = TU("lightSwayPx", 2.4), swDeg = TU("lightSwayDeg", 0.9), swMs = Math.max(400, TU("lightSwayMs", 3400));
      // v102: the far four and their mirror run the same loop — same sway, same breath, own rigs
      const sets = [[ST.towers, ST.lights]].concat(ST.mirror && ST.mirror.length ? [[ST.mirror, ST.mirrorLights]] : []);
      for (const [towers, rigs] of sets) towers.forEach((t, i) => { if (!t || !t.scene || !t.visible) return;
        // v102: a sputtering lamp shows a different bulb frame for the tenth of a second it dips
        const live = this.lightLiveV102(t);
        const f = t._sput ? (HOLDF[t._face || 0] === t._sput.f ? (t._sput.f + 1) % NF : t._sput.f) : hold ? (HOLDF[t._face || 0] || 0) : Math.floor(ST.t / fm + t._phase) % NF; const want = (t._face || 0) * NF + f;
        if (t.frame.name !== want && t.frame.name !== String(want)) t.setFrame(want);
        // v98: the masts that move, move in the wind — a slow drift and a lean from the foot
        { const lm = this.lightMulV100(), g = Math.max(0, Math.min(255, Math.round(255 * Math.min(1, 0.28 + 0.72 * lm))));   // v100: the dial can move mid-play
          if (t._tintV100 !== g) { t._tintV100 = g; t.setTint((g << 16) | (g << 8) | g); } }
        if (t._sway && t._bx != null) {
          const w = Math.sin(ST.t / swMs * Math.PI * 2 + t._phase) * 0.7 + Math.sin(ST.t / (swMs * 0.37) + t._phase * 2) * 0.3;
          t.setPosition(t._bx + w * swPx * t._sway, t._by).setAngle(w * swDeg * t._sway);
        }
        // v98: the light breathes on the mast's own phase — the glow, its beam and its pool together
        // v102: ...and on the live shimmer, which is the breath that is actually on by default
        const L = rigs && rigs[i]; if (!L || !L.glow || !L.glow.scene) return;
        const br = 0.5 + 0.5 * Math.sin(ST.t / TU("lightBreatheMs", 1900) + t._phase) * Math.sin(ST.t / 730 + t._phase * 2.3) * 0.6 + 0.2 * Math.sin(ST.t / 3100 + t._phase);
        const k = (hold ? 1 : 0.72 + 0.28 * Math.max(0, Math.min(1, br))) * live;
        const LM = this.lightMulV100() * this.dayMulV144();   // v100: the dial is the strength of the light itself. v144: and the lamps are off in the afternoon
        L.glow.setAlpha(TU("lightGlowA", 0.62) * k * LM); L.beam.setAlpha(TU("lightBeamA", 0.2) * k * LM); L.pool.setAlpha(TU("fieldPoolLiveA", 0.11) * k * LM);
        L.glow.setVisible(LM > 0.01); L.beam.setVisible(LM > 0.01); L.pool.setVisible(LM > 0.01);
        if (t._sway) { L.glow.x = L.hx + (t.x - t._bx) * 0.9; L.beam.x = L.hx + (t.x - t._bx) * 0.9; }
      });
      // the screen: where does its panel land on the main camera?
      const cm = this.cameras.main, R = ST.rect, wv = cm.worldView, z = cm.zoom;
      const sx = (R.x - wv.x) * z, sy = (R.y - wv.y) * z, sw = R.w * z, sh = R.h * z;
      const onScreen = sw >= 8 && sh >= 6 && sx + sw > 0 && sx < FW && sy + sh > 0 && sy < FVH;
      const live = onScreen && ST.mode !== "replay";
      if (!live) { if (ST.cam.visible) ST.cam.setVisible(false); return; }
      const cx = Math.max(0, sx), cy = Math.max(0, sy), cw = Math.min(FW, sx + sw) - cx, ch = Math.min(FVH, sy + sh) - cy;   // clipped to the canvas
      if (cw < 8 || ch < 6) { if (ST.cam.visible) ST.cam.setVisible(false); return; }
      ST.cam.setViewport(Math.round(cx), Math.round(cy), Math.round(cw), Math.round(ch));
      if (!ST.cam.visible) ST.cam.setVisible(true);
      // the feed: a fixed slice of world around the ball, so the picture never breathes with the main zoom
      ST.cam.setZoom(cw / (TU("jumboViewW", 520) * (cw / sw)));
      const P = this.play, fx = this.ballSpr ? this.ballSpr.x : FW / 2, fy = this.ballSpr ? this.ballSpr.y : WORLD_H / 2;
      const tx = fx, ty = fy - TU("jumboLeadY", 24);
      if (ST._fx == null) { ST._fx = tx; ST._fy = ty; }
      const lp = P ? TU("jumboLerp", 0.12) : 0.2;
      ST._fx += (tx - ST._fx) * lp; ST._fy += (ty - ST._fy) * lp;
      ST.cam.centerOn(ST._fx, ST._fy);
    } catch (e) {}
  }
  clearCrowd() {
    const C = this.crowd; if (!C) return;
    if (C.voices) { for (const v of C.voices) { try { v.box.destroy() } catch (e) {} } C.voices.length = 0; }
    if (C.emojis) { for (const v of C.emojis) { try { v.tx.destroy() } catch (e) {} } C.emojis.length = 0; }
    if (C.trimG) { try { C.trimG.destroy() } catch (e) {} C.trimG = null; }   // v112: the bowl's band and its entrance
    for (const s of C.secs) for (const pose of ["idle", "cheer"]) {
      try { s.spr[pose].destroy(); } catch (e) {}
      try { this.textures.remove("crowd_" + C.secs.indexOf(s) + "_" + pose); } catch (e) {}
    }
    this.crowd = null;
  }
  /* ===== v78 SIDELINE — the apron finally holds a team =====
   * v57 cut a `crowdGap` apron between the touchline and the stand's front row
   * and called it "the team area … so a later system can populate it". This is
   * that system (v78 also widened the apron, crowdGap 56 -> 104, because a real
   * team area is three lanes deep).
   *
   * The lanes are what makes it read as a sideline rather than as scattered
   * props, and they are the categories:
   *   EDGE   (~0.32 of the apron out)  the boundary: coaches working the line,
   *                                    backups standing to watch, the chain crew
   *   BENCH  (~0.62)                   the bench row itself, hydration, the
   *                                    trainers and their cart
   *   KIT    (~0.88)                   equipment: helmet and pad racks, ball
   *                                    racks, trunks, tables, heaters and fans,
   *                                    bins, the kicking net, the carts
   * Everything is placed by a fraction `t` along the team area, which spans the
   * 25 to the 25 the way a real one does, so retuning the apron or the span
   * moves the whole sideline together instead of scattering it.
   *
   * Everything here is a BILLBOARD, projected through the same crowdProject the
   * stands use (PJ, but valid past the end lines) and scaled by that point's own
   * k. It is deliberately NOT the crowd's slice-affine treatment: a stand is one
   * continuous surface a hundred yards long and has to be mapped, while a trunk
   * is a metre wide and reads correctly from any angle — the same reason every
   * player, official and ball in this game is a billboard. `sideArtScale` is the
   * one number that ties the sheet to the players: the art packs a standing
   * figure at ~92px, twice the 48px player cell, so 0.5 makes a coach and a
   * linebacker the same height on screen.
   *
   * The layout is SEEDED, not random per frame: the geometry is rebuilt at every
   * snap (the perspective is), and an unseeded sideline would reshuffle the
   * bench on every play. v79 keys the seed on the season week as well as the
   * team, so every GAME gets its own arrangement while every SNAP keeps it.
   *
   * ===== v79 SIDELINE LIGHT & LIFE — the polish pass =====
   * v78 proved the sideline; v79 makes it sit in the stadium instead of on it.
   *
   *   GROUNDED   every sprite casts a contact shadow (`sideShadow`), and the
   *              whole band runs through the SAME lighting the players get —
   *              the v29 depth falloff and ball spotlight at `RIB ART`'s marker
   *              tint — plus the crowd's own aerial fade and bank shade
   *              (`sideShadeBase`/`sideRelight`). The turf itself gets the
   *              painted boundary that tells you where the team area starts:
   *              warpField lays a white border and the dashed coaches' box
   *              outside the touchline (it is GROUND, so unlike a stand it can
   *              go straight into the row loop).
   *   SEATED     the benches are occupied: backups drawn a step outboard with
   *              their legs sunk behind the bench front (`sink`), which at this
   *              sprite size reads as sitting. Standing figures mix front,
   *              back and PROFILE poses — a sideline watches the field.
   *   FACING     directional art (benches, racks, carts, tables — anything the
   *              artist drew from a front-left three-quarter view) carries
   *              `face`, and is mirrored per BANK so its open side points at
   *              the field from either sideline, whichever end the camera is
   *              shooting from. Long low items lean a few degrees along the
   *              line's own screen direction (`along`) — a suggestion of
   *              recession, deliberately capped: fully aligning a side-view
   *              billboard to a line this steep tips the bench on its end.
   *   ALIVE      `sideReact` (fed by fireEvent, next to crowdReact) pumps a
   *              shared excitement level that scales the idle sway into a
   *              bench-clearing bounce on a score; a carrier heading out of
   *              bounds scatters the boundary figures near his landing spot
   *              (`_scat`, screen-space, so it never disturbs the layout); a
   *              knot of coaches and backups is anchored to the LOS and walks
   *              the line with the ball; bob phases are seeded by index, not
   *              Math.random(), so a rebuild no longer teleports every figure
   *              mid-sway. Yr's weather roll (rain/wind/snow) is exposed as
   *              window.__WX_V79: rain swaps the towel service for ponchos on
   *              the line, snow doubles the heaters and sends the fans away.
   *   TIDY       staff jackets recolor to each team's primary (`ribSideStaffTint`
   *              masks the drawn navy only — khakis and skin never tint, which
   *              is what multiplying the whole sprite would do); a separation
   *              pass stops trunks intersecting; clustered placement replaces
   *              the ruled rows; props that would land under ~4px at the far
   *              end are culled instead of rendering as mush (people and the
   *              field's own markers are exempt).
   *
   * Render-only, like the crowd and the crew: no sim actor, no stat, no event. */
  sideRng(k) {
    // one small deterministic stream per side, so the two sidelines differ from
    // each other and neither differs from itself between snaps
    let h = (this.side && this.side.seed || 1) ^ (k * 2654435761 >>> 0);
    return () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
  }
  sideDepth(py) {
    // Between the stands and the turf FX. Above crowdDepth so a bench occludes
    // the stand behind it and the LOS line extension painted past the touchline;
    // below the ground shadows (3.5) and the players (4+), so a man ON the field
    // always draws in front of the furniture behind him. Ordered by screen y, so
    // the near end of a lane covers the far end of it.
    return TU("crowdDepth", 3.45) + .01 + Math.max(0, Math.min(1, py / WORLD_H)) * .03;
  }
  // The static half of the lighting: the v29 depth falloff the players get, the
  // aerial fade the stands get, and the crowd's bank shade. The ball spotlight is
  // the DYNAMIC half and is folded in per frame by sideRelight.
  sideShadeBase(u, k, sgn) {
    let f = 1 - Math.min(1, Math.max(0, u / FW)) * TU("lightDepth", 0.12);
    f *= 1 - Math.max(0, Math.min(1, 1 - k)) * TU("sideAerial", .16);
    if (sgn < 0) f *= 1 - TU("crowdSideShade", 0.09) * .7;
    return f;
  }
  // one soft ellipse under every sprite — without it the whole band floats a
  // pixel above the turf, which is the single loudest "pasted on" tell
  sideShadow(im, p, wide) {
    const w = Math.max(4, im.displayWidth * (wide ? .68 : .5)), h = Math.max(2, w * .16);
    const sh = this.add.ellipse(p.x, p.y - h * .12, w, h, 0x000000, TU("sideShadowA", .26));
    // v99: the team area is lit by the same one light post — a bench barely marks the grass,
    // a mast of a coach or a stack of equipment throws a real streak off it
    if (TU("shadowsV99", 1)) { const V = this.shadowVecV99(p.x, p.y), len = im.displayHeight * V.slope * TU("sideShadowK", 0.8);
      sh.setRotation(Math.atan2(V.uy, V.ux)).setPosition(p.x + V.ux * len * .5, p.y - h * .12 + V.uy * len * .5)
        .setScale((w + len) / w, 1).setAlpha(TU("sideShadowA", .26) * (1 - V.reach * TU("shadowFade", 0.22)) * this.shadowMulV100()); }
    sh.setDepth(im.depth - .0006);
    this.side.fx.push(sh);
    return sh;
  }
  sideItem(name, u, vv, o) {
    o = o || {};
    // team-tinted staff first (v79), the shared cell when no tint exists
    let tex = o.team ? "spr_side_" + o.team + "_" + name : null;
    if (!tex || !this.textures.exists(tex)) tex = "spr_side_" + name;
    if (!this.textures.exists(tex)) return null;
    const p = this.crowdProject(u, vv);
    const sc = p.s * TU("sideArtScale", .5) * (o.sc || 1);
    // far-end cull: a trunk at 3px is noise, not equipment (people and field
    // markers are exempt — a silhouette still reads where a latch cannot)
    const mc = RIB_META_SIDE[name];
    if (!o.keep && mc && mc[3] * sc < TU("sideMinPx", 3.5)) return null;
    // OFF THE FIELD, guaranteed: the ground point being outside the paint is not
    // enough, because sprites have WIDTH — push the placement outboard until the
    // whole drawn box clears the painted line (pylons opt out: they stand ON it)
    if (!o.onLine) {
      const halfW = ((mc ? mc[2] : 40) * sc) / 2, latPx = 1.30 * TU("latCal", 1.16) * ((window.__FIELD_FX && window.__FIELD_FX.spread) || 1) * PERSP_OA * p.k;
      const MID2 = (F_TOP + F_BOT) / 2, need = ((this.side && this.side.paint) || 206) + TU("sideLineMargin", 6) + halfW / Math.max(.01, latPx);
      if (Math.abs(vv - MID2) < need) { vv = MID2 + (vv < MID2 ? -need : need); const p2 = this.crowdProject(u, vv); p.x = p2.x; p.y = p2.y; p.k = p2.k; }
    }
    const im = this.add.image(p.x, p.y, tex).setOrigin(.5, 1);
    // FACING: mirror three-quarter art so its open side points at the field from
    // either bank — resolved on the SCREEN side, because the camera swinging
    // ends is exactly when "toward the field" flips on screen
    let flip = !!o.flip;
    if (o.face) flip = (vv < (F_TOP + F_BOT) / 2) !== !!o.flip;
    im.setScale(flip ? -sc : sc, sc);
    im.setDepth(this.sideDepth(p.y) + (o.dbias || 0));
    im._side = { name, u: (o.fu != null ? o.fu : u), vv, lane: o.lane || null, kind: "kit" };
    im._lbase = this.sideShadeBase(u, p.k, vv < (F_TOP + F_BOT) / 2 ? -1 : 1);
    this.side.items.push(im);
    if (!o.noshadow) this.sideShadow(im, p, !/^(coach|trainer)/.test(name));
    if (o.bob) { im._bob = o.bob; im._ph = (this.side.items.length * 2.399) % 6.2832; im._y0 = im.y; im._x0 = im.x; im._k = p.s; this.side.live.push(im); }
    return im;
  }
  // A backup, in the kit of the sideline he is standing on. These are the sim's
  // own player textures, so they come recolored by ribRegisterTeam for free —
  // which is why the staff can afford a tint pass and these need nothing at all.
  sidePlayer(team, u, vv, o) {
    o = o || {};
    const dir = o.dir || "dn";
    let tex = "spr_" + team + "_" + dir + "_idle";
    if (!this.textures.exists(tex)) tex = "spr_" + team + "_dn_idle";
    if (!this.textures.exists(tex)) tex = "rib_player_fallback";
    if (!this.textures.exists(tex)) return null;
    let p = this.crowdProject(u, vv);
    // the same off-the-field clamp the props get — a backup's shoulder can hang
    // over the boundary as easily as a bench end can
    {
      const halfW = 24 * (o.sc || 1), latPx = 1.30 * TU("latCal", 1.16) * ((window.__FIELD_FX && window.__FIELD_FX.spread) || 1) * PERSP_OA * p.k;
      const MID2 = (F_TOP + F_BOT) / 2, need = ((this.side && this.side.paint) || 206) + TU("sideLineMargin", 6) + (halfW * p.s) / Math.max(.01, latPx);
      if (Math.abs(vv - MID2) < need) { vv = MID2 + (vv < MID2 ? -need : need); p = this.crowdProject(u, vv); }
    }
    // the player cell draws its feet at +23 from centre in a 48px cell — the same
    // offset the on-field marker puts its shadow at
    const im = this.add.image(p.x, p.y, tex).setOrigin(.5, 47 / 48);
    const sc = p.s * (o.sc || 1);
    im.setScale(o.flip ? -sc : sc, sc);
    im.setDepth(this.sideDepth(p.y) + (o.dbias || 0));
    // SEATED: crop the sprite at the knee and drop it a step, so the figure
    // ends at the seat line instead of pushing his feet through the turf — he
    // sits IN FRONT of the seat sprite, so the backrest shows behind him
    if (o.seat) { im.setCrop(0, 0, 48, TU("sideSitCrop", 34)); im.y += TU("sideSitDrop", 6) * sc; }
    if (tex === "rib_player_fallback") { im.setTint(team === "def" ? 0xe86560 : 0x5fce74); im._noLight = true; }
    im._side = { name: tex, u: (o.fu != null ? o.fu : u), vv, lane: o.lane || null, kind: "player", team, seated: !!o.seat };
    im._lbase = this.sideShadeBase(u, p.k, vv < (F_TOP + F_BOT) / 2 ? -1 : 1);
    this.side.items.push(im);
    if (!o.seat) this.sideShadow(im, p, false);
    im._bob = o.seat ? .25 : .6; im._ph = (this.side.items.length * 2.399) % 6.2832;
    im._y0 = im.y; im._x0 = im.x; im._k = p.s;
    this.side.live.push(im);
    return im;
  }
  buildSideline() {
    if (!RIB.sideImg || !PERSP || !this.add || !this.textures) return false;
    if (!this.textures.exists("spr_side_coach0") && !ribRegisterSide(this)) return false;
    try { ribRegisterSideTeams(this); } catch (e) {}
    // per-GAME seed: same all game (currentWeek and totalSeasons hold still
    // between snaps), different every week — v78's palette-only seed built the
    // identical sideline in every stadium of a career
    let seed = ((window.__GRIDIRON_TEAM_CUSTOM__ && window.__GRIDIRON_TEAM_CUSTOM__.palette || 7) * 7919 + 104729);
    try { const pl = window.S && window.S.player; if (pl) seed += ((pl.currentWeek || 0) + (pl.totalSeasons || 0) * 31) * 2903; } catch (e) {}
    this.clearSideline();
    this.side = { items: [], live: [], fx: [], seed, t: 0, excite: 0, _lt: 0 };
    this.side.paint = TU("sidePaintHalf", 206) / ((window.__FIELD_FX && window.__FIELD_FX.spread) || 1);
    const wx = (typeof window !== "undefined" && window.__WX_V79) || "clear";

    const MIDY = (F_TOP + F_BOT) / 2, HALF = (F_BOT - F_TOP) / 2, GAP = TU("crowdGap", 104);
    /* THE PAINTED LINE IS THE LINE. The field ART paints its touchline ~35 world
     * units OUTSIDE the sim's F_TOP/F_BOT — the sim plays inside a slightly
     * narrower field than the art draws (pre-existing lateral calibration; the
     * rows were reconciled in v72, the columns never were). v78/v79 anchored the
     * team area on the SIM's line, which parked the whole formation visibly ON
     * the painted playing surface. Everything here now measures from PAINT: the
     * art's painted boundary in world-lateral units, measured off the warp
     * canvas (240.5 on both banks, constant in depth because the art and the
     * projection share the same k; /sp because the spread FX scales the
     * projection's lateral map but never the art's). */
    const sp = (window.__FIELD_FX && window.__FIELD_FX.spread) || 1;
    const PAINT = TU("sidePaintHalf", 206) / sp;
    const APR = Math.max(24, HALF + GAP - PAINT);        // the apron actually outside the paint
    const LANE = { edge: PAINT + APR * TU("sideLaneEdge", .16), bench: PAINT + APR * TU("sideLaneBench", .48), kit: PAINT + APR * TU("sideLaneKit", .8) };
    // the team area runs 25 to 25, like a real one — but `at` is unclamped, so
    // the dressing that belongs OUTSIDE the numbers (carts, nets, cameras) can
    // spill toward the end zones the way it actually does
    const IN = TU("sideAreaYd", 25) * (PLAY_W / 100);
    const U0 = PLAY_L + IN, U1 = PLAY_R - IN, SPAN = U1 - U0;
    const at = (t) => Math.max(40, Math.min(FW - 40, U0 + SPAN * t));
    // where the ball sits, for the knot of people that follows it
    const lf = this._lastField;
    const adj = (x) => (VDIR > 0 ? x : FW - x);
    const losU = lf ? adj(PLAY_L + (Math.max(0, Math.min(100, lf[0])) / 100) * PLAY_W) : (U0 + U1) / 2;

    for (const sgn of [-1, 1]) {
      // Which TEAM camps here. The bench belongs to a side of the STADIUM, which
      // is a world y — the camera swinging ends with possession is what carries
      // it across the screen. Key it on the screen side instead and both teams
      // change benches at every change of possession.
      const stadium = sgn;
      const team = stadium < 0 ? "def" : "off";
      const rnd = this.sideRng(stadium + 2);
      const lane = (name) => MIDY + sgn * LANE[name];
      const jit = (a) => (rnd() - .5) * a;

      // ---- KIT lane. Everything the equipment staff brought, categorised: racks
      // together, storage together, the heavy stuff at the ends. `face` marks the
      // three-quarter art that has to open toward the field.
      const KIT = [
        ["trunk", .02, { face: 1, sc: .9 }], ["trunk_b", .07, { face: 1, sc: .9 }], ["case_up", .11, { face: 1 }], ["duffel", .145],
        ["helmet_rack", .19, { face: 1, sc: .92 }], ["pad_rack", .26, { face: 1, sc: .92 }], ["ball_rack", .33, { face: 1, sc: .9 }], ["ball_bin", .38, { face: 1 }],
        ["tape_bin", .42], ["stretcher", .45, { sc: .8 }], ["med_kit", .48, { sc: .7 }],
        ["table_b", .5, { face: 1, sc: .8 }], ["play_board", .53, { sc: .7 }], ["whiteboard", .57, { face: 1 }], ["comms", .6, { sc: .7 }],
        ["ponchos", .64, { sc: .85 }], ["camera", .66, { sc: .75, face: 1 }],
        ["kick_net", .68, { sc: .9 }], ["heater", .73, { sc: .85 }], ["fan", .77, { sc: .85 }],
        ["trunk_c", .81, { face: 1, sc: .9 }], ["table", .835, { sc: .75, face: 1 }], ["case_up_b", .85, { face: 1 }], ["duffel_b", .88, { sc: .8 }],
        ["trash", .91, { sc: .8 }], ["recycle", .94, { sc: .8 }], ["cart", .97, { face: 1 }],
      ];
      // weather dressing (Yr's own roll, via __WX_V79): rain strikes the towel
      // service and breaks out ponchos; snow doubles the heaters and the fans go
      // back on the truck
      if (wx === "snow") { KIT.push(["heater", .35, { sc: .85 }]); const fi = KIT.findIndex((k2) => k2[0] === "fan"); if (fi >= 0) KIT.splice(fi, 1); }
      // ---- BENCH lane. COMPACT seating only, repeated down the lane — the long
      // bench sheets are drawn in full side view, and a five-man bench laid as a
      // billboard runs ACROSS a lane that runs up the screen: it read as
      // furniture angled ninety degrees wrong, so it stays in the trunk. A
      // two-seater is as deep as it is wide and reads right from any angle.
      // [name, t, opts, sitters] — sitters ride the SAME field depth as their
      // seat, spread along its lateral width, all facing the field.
      const BENCH = [
        ["cooler_table", .03, { face: 1 }], ["cup_stand", .08, { sc: .8 }], [wx === "rain" ? "ponchos" : "towels", .58, { sc: .6 }],
        ["bottles", .12, { sc: .8 }],
        ["bench_back", .18, { face: 1, sc: .85 }, 2], ["bench_short", .27, { face: 1 }, 1], ["bench_wood", .35, { face: 1, sc: .9 }, 2],
        ["bench_back_b", .44, { face: 1 }, 2], ["stool", .52, { sc: .9 }, 1],
        ["med_cart", .62, { face: 1 }],
        ["bench_wood", .7, { face: 1, sc: .9 }, 2], ["bench_short", .78, { face: 1 }, 1],
        ["chairs", .85, { sc: .9, face: 1 }], ["cooler", .93], ["cooler_table_b", .97, { face: 1 }],
      ];
      // ---- a separation pass per lane: fixed t plus jitter happily parks a
      // trunk inside a bench; walk each lane in order and hold a minimum gap
      const sep = (list, laneName, jA, jV) => {
        const placed = list.map(([n, t, o, sit]) => ({ n, u: at(t) + jit(jA), vv: lane(laneName) + jit(jV), o: o || {}, sit: sit || 0 }));
        placed.sort((a2, b2) => a2.u - b2.u);
        const min = TU("sideMinSep", 15);
        for (let i = 1; i < placed.length; i++) if (placed[i].u - placed[i - 1].u < min) placed[i].u = placed[i - 1].u + min;
        return placed;
      };
      // which way a profile faces so it looks AT the field: unflipped side art
      // faces screen-left, so flip on the screen-left bank. crowdProject does
      // NOT carry PJ's VDIR mirror — a bank's screen side IS its world side,
      // always — so no VDIR term belongs here. The first cut had one, and every
      // figure and every three-quarter face on the sideline spent half of each
      // game turned politely away from the football.
      const fieldFlip = sgn < 0;
      for (const it of sep(KIT, "kit", 6, 4)) this.sideItem(it.n, it.u, it.vv, Object.assign({ lane: "kit" }, it.o));
      for (const it of sep(BENCH, "bench", 4, 3)) {
        const seat = this.sideItem(it.n, it.u, it.vv, Object.assign({ lane: "bench" }, it.o));
        // everyone on a bench is WATCHING THE FIELD: same depth as the seat,
        // spread along its width, in profile, facing the touchline
        if (seat && it.sit) for (let s2 = 0; s2 < it.sit; s2++)
          this.sidePlayer(team, it.u, it.vv + (s2 - (it.sit - 1) / 2) * 4.5 + jit(1.5), {
            lane: "bench", dbias: .0008, seat: 1, sc: .94, dir: "sd", flip: fieldFlip,
          });
      }
      // the carts park at the ends of the area, out of the way
      this.sideItem("golf_cart", at(-.06), lane("kit"), { sc: .85, face: 1, lane: "kit" });

      // ---- EDGE lane. The people — CLUSTERED, not ruled: a sideline knots up
      // around a coordinator and leaves gaps, it does not space itself evenly.
      const anchors = [];
      for (let a2 = 0; a2 < 4; a2++) anchors.push(.06 + .84 * ((a2 + .2 + rnd() * .6) / 4));
      const knot = (i2) => anchors[i2 % anchors.length] + (rnd() + rnd() - 1) * .07;
      for (let i2 = 0; i2 < 6; i2++)
        this.sideItem("coach" + ((i2 * 3 + (stadium < 0 ? 1 : 0)) % 10), at(knot(i2)), lane("edge") + jit(5),
          { lane: "edge", bob: .5, flip: fieldFlip, team });
      [.58, .64, .9].forEach((t, i2) => this.sideItem("trainer" + ((i2 * 4 + (stadium < 0 ? 2 : 0)) % 10),
        at(t + jit(.05)), lane("edge") + jit(6), { lane: "edge", bob: .5, flip: fieldFlip, team }));
      const N = Math.max(0, Math.round(TU("sideBackups", 8)));
      for (let i2 = 0; i2 < N; i2++) {
        const prof = rnd() < TU("sideWatchP", .85);
        this.sidePlayer(team, at(knot(i2 + 2)) + jit(6), lane("edge") + jit(5),
          { lane: "edge", dir: prof ? "sd" : "dn", flip: prof ? fieldFlip : rnd() < .5 });
      }
      // ---- the knot that follows the ball: a coach on the spot with two
      // backups craning past him. losU moves with _lastField, so this group
      // walks the line as the drive moves — the one part of the layout that is
      // anchored to the GAME rather than to the stadium.
      const cl = (x2) => Math.max(U0 - 30, Math.min(U1 + 30, x2));
      this.sideItem("coach" + ((stadium < 0 ? 4 : 7)) , cl(losU - 10), lane("edge") + 2, { lane: "edge", bob: .6, team });
      this.sidePlayer(team, cl(losU + 12), lane("edge") + jit(4), { lane: "edge", dir: "sd", flip: fieldFlip });
      this.sidePlayer(team, cl(losU - 26), lane("edge") + jit(4), { lane: "edge", dir: "sd", flip: fieldFlip });

      // ---- outside the numbers: the dressing that belongs beyond the 25s, so
      // the biggest, nearest stretch of apron is not bare grass
      this.sideItem("cone", at(-.03), lane("edge"), { sc: .7, lane: "edge" });
      this.sideItem("discs", at(1.03), lane("edge"), { sc: .7, lane: "edge" });
      this.sideItem("barrier", at(1.07), lane("bench"), { sc: .8, lane: "bench" });
      this.sideItem("camera", at(1.11), lane("edge") + 4, { sc: .8, face: 1, lane: "edge" });
      this.sideItem("trainer" + (stadium < 0 ? 5 : 8), at(-.09), lane("edge") + 2, { sc: .9, bob: .5, lane: "edge", team, flip: fieldFlip });
      if (wx === "rain") for (let i2 = 0; i2 < 2; i2++) this.sideItem("ponchos", at(.15 + i2 * .5 + jit(.06)), lane("edge") + 8, { sc: .95, lane: "edge" });
    }

    // ---- The markers that belong to the FIELD rather than to a team.
    this.sidePylons();
    this.sideChainCrew(MIDY, HALF, GAP);
    this.sideYardMarks(MIDY, HALF, GAP);

    try {
      window.__SIDE_V78 = { items: this.side.items.length, live: this.side.live.length, fx: this.side.fx.length,
        gap: GAP, lanes: LANE, span: [Math.round(U0), Math.round(U1)], half: HALF, midy: MIDY, wx, paint: +PAINT.toFixed(1), apron: +APR.toFixed(1),
        excite: () => this.side ? +this.side.excite.toFixed(3) : 0,
        list: () => this.side.items.map((i) => Object.assign({}, i._side, { x: Math.round(i.x), y: Math.round(i.y),
          w: Math.round(i.displayWidth), h: Math.round(i.displayHeight), depth: +i.depth.toFixed(4),
          sx: i.scaleX < 0 ? -1 : 1, tint: i.tintTopLeft })) };
    } catch (e) {}
    this.sideRelight(true);
    return true;
  }
  // The pylons stand ON the corner rather than in the apron — they are the only
  // thing in this system that is part of the playing field. PLAY_L/PLAY_R are the
  // GOAL lines (the end zones are the EZ margins outside them); the full set adds
  // the two end lines. Which of those are drawn is v144 F's call, below.
  sidePylons() {
    // on the PAINTED corners — the pylon is the one sprite that belongs on the
    // line itself, so it alone opts out of the off-the-field clamp
    const MIDY = (F_TOP + F_BOT) / 2, PAINT = (this.side && this.side.paint) || 206;
    /* v144 F: ONE marker per corner. The full set is eight — a pylon on each of the four corners of
     * each end zone, which is what the real game uses — but the goal-line pylon and the end-line
     * pylon behind it are only eleven yards apart in depth, so through the broadcast camera they
     * foreshorten into one doubled, thick-looking marker at every corner. Keeping the GOAL-LINE
     * pair is keeping the ones that matter: they mark the plane the ball has to cross.
     * `TU("pylonAllCornersV144", 1)` puts the real-football set of eight back. */
    const PYL_X_V144 = TU("pylonAllCornersV144", 0) ? [3, PLAY_L, PLAY_R, FW - 3] : [PLAY_L, PLAY_R];
    try { (window.__V144 = window.__V144 || {}).pylons = PYL_X_V144.length * 2; } catch (e) {}
    for (const x of PYL_X_V144)
      for (const dy of [-PAINT, PAINT]) {
        const im = this.sideItem("pylon", x, MIDY + dy, { sc: TU("sidePylonScale", .55), keep: 1, noshadow: 1, onLine: 1 });
        if (im) im.setDepth(this.sideDepth(im.y) + .002);
      }
  }
  // The chain crew works one sideline and follows the ball, so unlike everything
  // else here it is placed off the live play rather than off the seed. Rebuilt
  // with the rest of the sideline at every snap, which is exactly when the down,
  // the line of scrimmage and the sticks all change. Projection u is direction-
  // adjusted (crowdProject space); _side.u keeps the FIELD value for the checks.
  sideChainCrew(MIDY, HALF, GAP) {
    const lf = this._lastField; if (!lf) return;
    const fxr = (yd) => PLAY_L + (Math.max(0, Math.min(100, yd)) / 100) * PLAY_W;
    const adj = (x) => (VDIR > 0 ? x : FW - x);
    const losX = fxr(lf[0]), togo = fxr(lf[1]);
    const pay = this.play && this.play.payload;
    const dn = Math.max(1, Math.min(4, Math.round(Number(pay && pay.down) || 1)));
    const vv = MIDY + ((this.side && this.side.paint) || 206) + 8;
    this.sideItem("down" + dn, adj(losX), vv, { sc: .8, keep: 1, fu: losX });
    this.sideItem("chain_rod", adj(losX - 3), vv + 5, { sc: .7, keep: 1, fu: losX - 3 });
    this.sideItem("chain_rod", adj(togo), vv + 5, { sc: .7, keep: 1, fu: togo });
  }
  // The orange yardage markers that stand outside the touchline at their own
  // yard line, opposite the chain crew.
  sideYardMarks(MIDY, HALF, GAP) {
    const YDF = PLAY_W / 100;
    const vv = MIDY - (((this.side && this.side.paint) || 206) + 7);
    for (const [n, yd] of [["yard10", 10], ["yard20", 20], ["yard30", 30], ["yard30", 70], ["yard20", 80], ["yard10", 90]])
      this.sideItem(n, PLAY_L + yd * YDF, vv, { sc: .6, keep: 1 });
  }
  // fireEvent feeds the sideline the same play the crowd hears; the excitement
  // decays in updateSideline and scales the idle sway into a real reaction
  sideReact(e) {
    const S = this.side; if (!S) return;
    const T = { td: 1, score: 1, fgResult: .7, pick: .6, fumble: .5, firstdown: .5, highpoint: .5,
      brokenTackle: .45, hurdle: .45, stiffarm: .4, pancake: .35, tackleHit: .35, catch: .3 };
    const t = T[e.type]; if (!t) return;
    S.excite = Math.max(S.excite || 0, t);
    // v109: a score is a SURGE, not a taller sway — the scorer's bench steps to the touchline and back
    if ((e.type === "td" || e.type === "score") && !S.surge) { const P = this.play, ci = P && P.carrierId != null ? P.carrierId : -1, cm = ci >= 0 ? this.markers[ci] : null;
      S.surge = { t: 0, ms: TU("sideSurgeMs", 1600), team: (cm && cm.kit) || (ci >= 0 && ci < 11 ? "off" : "def") }; this.v109E().surges++; }
  }
  // the dynamic half of the lighting: fold the ball spotlight (the exact v29
  // player formula) onto each sprite's static base. Throttled — the spot only
  // moves as fast as the ball does.
  sideRelight(force) {
    const S = this.side; if (!S) return;
    const amb = TU("lightAmb", 0.9), R = TU("lightSpotR", 200);
    const ball = this.ballSpr && this.ballSpr.active !== false ? this.ballSpr : null;
    for (const im of S.items) {
      if (im._noLight || im._lbase == null) continue;
      let f = im._lbase;
      if (ball) { const dd = Math.hypot(im.x - ball.x, im.y - ball.y); f *= amb + (1 - amb) * Math.max(0, 1 - dd / R); }
      // quantized like the players so the tint path is not thrashed, and a hint
      // of blue in the fade so distance reads as air, not as dirt
      const lv = Math.max(0, Math.min(255, Math.round(f * 255 / 8) * 8));
      const tint = ((Math.round(lv * .97)) << 16) | ((Math.round(lv * .99)) << 8) | Math.min(255, Math.round(lv * 1.03));
      if (im._tint !== tint || force) { im._tint = tint; im.setTint(tint); }
    }
  }
  updateSideline(delta) {
    const S = this.side; if (!S) return;
    const dt = (delta || 16) / 1000;
    S.t += dt;
    // excitement decays on a half-life; it drives both the sway's height and its
    // tempo, so a touchdown reads as the bench coming off the bench
    S.excite = (S.excite || 0) * Math.pow(.5, dt / TU("sideExciteHalf", 1.3));
    if (S.excite < .01) S.excite = 0;
    const amp = TU("sideBobPx", 1.6) * (1 + S.excite * TU("sideExciteAmp", 2.6));
    const freq = 1.1 + S.excite * 2.4;
    // a carrier bearing down on the boundary scatters the figures near his spot —
    // screen-space only, so the seeded layout itself never moves
    const P = this.play, MIDY = (F_TOP + F_BOT) / 2, HALF2 = (F_BOT - F_TOP) / 2;
    const car = P && P.carrierId != null ? this.markers[P.carrierId] : null;
    if (car && car.sx != null && Math.abs(car.sy - MIDY) > HALF2 - 8) {
      const cu = VDIR > 0 ? car.sx : FW - car.sx, bank = car.sy < MIDY ? -1 : 1;
      for (const im of S.live) {
        const sd = im._side;
        if (!sd || sd.lane !== "edge") continue;
        if ((sd.vv < MIDY ? -1 : 1) !== bank) continue;
        if (Math.abs(sd.u - cu) > TU("sideScatR", 28)) continue;
        im._scat = Math.max(im._scat || 0, 1);
      }
    }
    // v109 THE BENCH SURGES: the edge lane of the scoring team's bank steps toward the touchline
    // and back over sideSurgeMs (bank -1 is the "def" kit's side of the stadium, +1 the "off" kit's)
    let surgeK = 0, surgeBank = 0;
    if (S.surge) { S.surge.t += dt * 1000; const q = S.surge.t / S.surge.ms; if (q >= 1) S.surge = null; else { surgeK = Math.sin(q * Math.PI); surgeBank = S.surge.team === "def" ? -1 : 1; } }
    for (const im of S.live) {
      let x = im._x0;
      if (surgeK && im._side && im._side.lane === "edge" && ((im._side.vv < MIDY) ? -1 : 1) === surgeBank) {
        x += Math.sign(FW / 2 - im._x0) * surgeK * TU("sideSurgePx", 16) * im._k; }
      if (im._scat) {
        im._scat = Math.max(0, im._scat - dt / .9);
        const ease = Math.sin(Math.min(1, 1 - im._scat) * Math.PI);
        x += Math.sign(im._x0 - FW / 2) * ease * TU("sideScatPx", 22) * im._k;
        if (!im._scat) x = im._x0;
      }
      im.x = x;
      im.y = im._y0 - Math.abs(Math.sin(S.t * freq + im._ph)) * amp * im._bob * im._k;
    }
    // the ball spotlight rides across the band as the play moves
    S._lt += dt;
    if (S._lt > .12) { S._lt = 0; this.sideRelight(); }
  }
  clearSideline() {
    const S = this.side; if (!S) return;
    for (const im of S.items) { try { im.destroy(); } catch (e) {} }
    for (const im of S.fx || []) { try { im.destroy(); } catch (e) {} }
    this.side = null;
  }
  /* ===== v45 REFEREE CREW — seven officials that move with the play =====
   * The crew is rendered off to the side of the sim: they are NOT sim actors,
   * carry no stats, and never appear in this.markers. Each frame every official
   * eases toward a role-based target keyed on the ball (or ball-carrier), runs at
   * a fraction of the ball's speed ("slightly slower than the players"), and is
   * gently repelled out of any nearby body so he stays off the pile. The referee
   * works from the offensive backfield; a flag on the play is heaved by the
   * nearest official, and a score is signalled with both arms up.
   *
   * v49: every pose below is real referee art (see `v49 REF ART`) instead of a
   * zebra-striped player. The drawn cap ellipse is gone — the sprite wears one —
   * and the crew now works the dead ball too: whistle, first-down point, and a
   * flag that actually leaves the official's hand on the heave frame. */
  refMarker(sx, sy) {
    const shadow = this.add.ellipse(0, 23, 20, 7, 0x000000, 0.3);   // a shade tighter than a player's — no pads
    const key = this.textures.exists("spr_ref_dn_idle") ? "spr_ref_dn_idle" : "rib_player_fallback";
    const body = this.add.image(0, 0, key);
    if (key === "rib_player_fallback") body.setTint(0xf2f4f7);
    const root = this.add.container(0, 0, [shadow, body]).setDepth(4);
    return { root, body, shadow, team: "ref", sx, sy, dirKey: "dn", flip: false, ft: 0, it: 0, tms: 0, sSm: 0, hd: null, forceState: null };
  }
  // Resolve a ref pose to a texture, degrading through the keys the zebra
  // fallback registers so a sheet that never decodes still animates.
  refTex(m, st, dirless) {
    const t = this.textures, k = dirless ? "spr_ref_" + st : "spr_ref_" + m.dirKey + "_" + st;
    if (t.exists(k)) return k;
    if (dirless) {                                        // signal/whistle/point have no zebra equivalent
      const base = String(st).replace(/\d+$/, "");
      if (base !== st && t.exists("spr_ref_" + base + "0")) return "spr_ref_" + base + "0";
      if (t.exists("spr_ref_" + m.dirKey + "_" + st)) return "spr_ref_" + m.dirKey + "_" + st;
    } else {
      const base = String(st).replace(/\d+$/, "");        // idle3 -> idle, run5 -> run0
      if (base === "idle" && t.exists("spr_ref_" + m.dirKey + "_idle")) return "spr_ref_" + m.dirKey + "_idle";
    }
    if (t.exists("spr_ref_" + m.dirKey + "_idle")) return "spr_ref_" + m.dirKey + "_idle";
    return "rib_player_fallback";
  }
  placeRef(m, sx, sy, dtms) {
    const dx = sx - m.sx, dy = sy - m.sy;
    m.sx = sx; m.sy = sy; m.tms += (dtms || 16);
    const spdPx = Math.hypot(dx, dy) / Math.max(1, dtms || 16) * 1000;
    m.sSm = m.sSm == null ? spdPx : m.sSm * 0.7 + spdPx * 0.3;
    if (spdPx > 20 && !m.forceState) {                    // face the way he runs (screen space, NS aware)
      const p0 = PJ(sx - dx, sy - dy), p1 = PJ(sx, sy);
      this.faceMarker(m, p1.x - p0.x, p1.y - p0.y);
    }
    // Signalling poses are drawn front-on and carry their own mirror, so they opt
    // out of the directional key entirely: an official turns to face the field to
    // sell a call rather than signalling with his back to it.
    let st = null, dirless = false, seqFlip = false;
    const seqF = (ms) => Math.floor((m.tms - (m.seqT || 0)) / ms);
    if (m.forceState === "throwSeq") {                    // 6-frame flag heave, then back to the crew
      const fi = seqF(TU("refFlagFrameMs", 105));
      if (fi >= 6) m.forceState = null;
      else { st = "throw" + fi; dirless = true; seqFlip = !!m.seqFlip; }
    } else if (m.forceState === "signalSeq") {            // both arms up: snapped, then HELD
      const fi = seqF(TU("refSignalFrameMs", 150));
      if (fi >= (m.seqLen || 12)) m.forceState = null;
      else { st = "signal" + (fi < 2 ? fi : 2 + (fi % 4)); dirless = true; }
    } else if (m.forceState === "whistleSeq") {           // dead ball — whistle at the mouth
      const fi = seqF(TU("refWhistleFrameMs", 130));
      if (fi >= (m.seqLen || 6)) m.forceState = null;
      else { st = "whistle" + (fi % 4); dirless = true; }
    } else if (m.forceState === "pointSeq") {             // first down / spot: arm out, held
      const fi = seqF(TU("refPointFrameMs", 190));
      if (fi >= (m.seqLen || 7)) m.forceState = null;
      else { st = fi % 2 ? "point2" : "point"; dirless = true; seqFlip = !!m.seqFlip; }
    }
    if (st == null) {
      if (m.sSm < 8) { m.it += (dtms || 16); st = "idle" + (Math.floor(m.it / TU("refIdleFrameMs", 540)) % 4); }
      else { m.ft += (dtms || 16) * Math.min(2.4, m.sSm / 58); st = "run" + (Math.floor(m.ft / 96) % (window.__RIB_FRAMES || 4)); }
    }
    const tex = this.refTex(m, st, dirless);
    if (m.tex !== tex) { m.tex = tex; m.body.setTexture(tex); }
    if (tex === "rib_player_fallback") m.body.setTint(0xf2f4f7); else m.body.clearTint();
    m.body.setFlipX(dirless ? seqFlip : (m.flip && (m.dirKey === "sd" || m.dirKey === "dr" || m.dirKey === "ur")));
    m.body.setRotation(0);
    const p = PJ(sx, sy);
    let emph = 1, hop = 0;                                // v71 flag emphasis
    if (m.emphMs) {
      m.emphT = (m.emphT || 0) + (dtms || 16);
      if (m.emphT >= m.emphMs) { m.emphMs = 0; m.root.setAngle(0); }
      else {
        const sw = Math.sin(Math.PI * m.emphT / m.emphMs);
        emph = 1 + TU("flagEmphScale", .42) * sw;
        hop = -TU("flagEmphHop", 7) * sw;
        m.root.setAngle(Math.sin(m.emphT / 46) * TU("flagEmphTilt", 3.5) * sw);
      }
    }
    m.root.setPosition(p.x, p.y + hop * p.s); m.root.setScale(p.s * emph);
    // v99: the crew casts too — the flag heave lifts an official off the grass, and his
    // shadow stays where he left it
    if (m.shadow) this.castShadowV99(m.shadow, p.x, p.y, TU("shadowRefH", 19), { lift: Math.max(0, -hop), base: 20, y0: 23, a: 0.3 });
    m.root.setDepth(4 + sy * 0.02 + 0.006 + (m.emphMs ? 18 : 0));
    m._spdPx = spdPx;
    return p;
  }
  spawnRefs(losX, dir) {
    this.clearRefs();
    if (!this.textures.exists("spr_ref_dn_idle")) return;   // atlas not decoded yet — skip gracefully
    const YDF = PLAY_W / 100, MIDY = (F_TOP + F_BOT) / 2;
    // home marks: referee deep in the backfield, umpire off the middle, two wing
    // officials on the LOS, two deep on the numbers, back judge deepest of all.
    const roles = [
      { role: "R", x: losX - dir * 11 * YDF, y: MIDY + 46 },
      { role: "U", x: losX + dir * 5 * YDF, y: MIDY - 34 },
      { role: "H", x: losX, y: F_TOP + 12 },
      { role: "L", x: losX, y: F_BOT - 12 },
      { role: "S", x: losX + dir * 20 * YDF, y: F_TOP + 12 },
      { role: "F", x: losX + dir * 20 * YDF, y: F_BOT - 12 },
      { role: "B", x: losX + dir * 25 * YDF, y: MIDY },
    ];
    this.refs = roles.map((r) => {
      const x = Math.max(46, Math.min(FW - 46, r.x)), y = Math.max(F_TOP + 6, Math.min(F_BOT - 6, r.y));
      const m = this.refMarker(x, y);
      m.role = r.role; m.homeX = x; m.homeY = y; m.dirKey = dir > 0 ? "dn" : "up";
      this.placeRef(m, x, y, 16);
      return m;
    });
  }
  updateRefs(dtms, gliding) {
    if (!this.refs || !this.refs.length) return;
    const P = this.play; if (!P) return;
    const dir = (P.script && P.script.meta && P.script.meta.dir) || VDIR || 1;
    const losX = P.losX != null ? P.losX : PLAY_L + PLAY_W / 2;
    const YDF = PLAY_W / 100, MIDY = (F_TOP + F_BOT) / 2;
    const dt = Math.max(1, dtms) / 1000;
    // key on the ball-carrier when there is one, else the loose/airborne ball
    const carM = P.carrierId != null ? this.markers[P.carrierId] : null;
    const kx = carM && carM.sx != null ? carM.sx : (P._refBX != null ? P._refBX : losX);
    const ky = carM && carM.sy != null ? carM.sy : (P._refBY != null ? P._refBY : MIDY);
    if (P._refKPrev) {
      const s = Math.hypot(kx - P._refKPrev.x, ky - P._refKPrev.y) / dt;
      P._refKSpd = P._refKSpd == null ? s : P._refKSpd * 0.75 + s * 0.25;
    }
    P._refKPrev = { x: kx, y: ky };
    // the crew runs when the players run — slightly slower (85%), with a floor so
    // they still drift into position when the ball is idle.
    const crewSpd = Math.max(TU("refMinSpd", 26), Math.min(TU("refMaxSpd", 260), (P._refKSpd || 0) * TU("refSpeedFrac", 0.85)));
    const step = (gliding ? TU("refHomeSpd", 80) : crewSpd) * dt;
    const clX = (v) => Math.max(46, Math.min(FW - 46, v)), clY = (v) => Math.max(F_TOP + 6, Math.min(F_BOT - 6, v));
    // v109: the measurement chain between the two wings, drawn only while both are in
    if (this.measG) this.measG.clear();
    const inMeas = this.refs.filter(r => r._spotTgt && r._spotTgt.kind === "measure" && r._spotTgt.there);
    if (inMeas.length === 2) { if (!this.measG) this.measG = this.add.graphics().setDepth(3.92);
      const a = PJ(inMeas[0].sx, inMeas[0].sy), b = PJ(inMeas[1].sx, inMeas[1].sy);
      this.measG.lineStyle(2 * a.s, 0xf0bb45, 0.85).lineBetween(a.x, a.y + 14 * a.s, b.x, b.y + 14 * b.s); }
    for (const r of this.refs) {
      /* ===== v109 THE CREW SPOTS THE BALL ===== an official sent to the spot (refSpotV109 /
       * measureV109) runs there ahead of his role, plants beside the ball, points the offense's
       * way as it is set down, holds, and only then goes back to trailing the play. */
      if (r._spotTgt && (!r.forceState || r._spotTgt.kind === "measure")) {   // v109: a measurement outranks a signal — the wings come in even if the crew was already calling something
        const T9 = r._spotTgt;
        if (r.forceState) { r.forceState = null; r.seqLen = 0; }
        if (!T9.there) {
          const ddx = T9.x - r.sx, ddy = T9.y - r.sy, d = Math.hypot(ddx, ddy);
          if (d > 2.5) { const s = Math.min(d, TU("refSpotSpd", 230) * dt); this.placeRef(r, r.sx + ddx / d * s, r.sy + ddy / d * s, dtms); continue; }
          T9.there = true; T9.t0 = r.tms; this.v109E().spotArrivals++;
          const a = PJ(r.sx, r.sy), b = PJ(T9.x + T9.dir * 2, T9.y - (r.sy > T9.y ? 14 : -14));
          if (T9.kind === "spot") { r.forceState = "pointSeq"; r.seqT = r.tms; r.sSm = 0; r.seqFlip = PJ(r.sx + T9.dir * 40, r.sy).x > a.x;
            r.seqLen = Math.max(2, Math.round(T9.hold / TU("refPointFrameMs", 190)));
            try { if (this.ballSpr) this.tweens.add({ targets: this.ballSpr, y: this.ballSpr.y - 2, yoyo: true, duration: 110 }); } catch (e) {}   // the ball is set down as he points
          } else this.faceMarker(r, b.x - a.x, b.y - a.y);
        }
        if (T9.there && r.tms - T9.t0 >= T9.hold + (T9.kind === "spot" ? 140 : 0)) { r._spotTgt = null; }
        else if (T9.there) { this.placeRef(r, r.sx, r.sy, dtms); continue; }
      }
      // v49: an official signalling PLANTS. Sliding downfield with both arms up (or
      // mid-heave) reads as a bug, so a forced sequence freezes him where he stands.
      if (r.forceState) { this.placeRef(r, r.sx, r.sy, dtms); continue; }
      let tx, ty;
      switch (r.role) {
        case "R": tx = kx - dir * 8 * YDF; ty = ky + 34; break;                  // referee trails from behind
        case "U": tx = losX + dir * 5 * YDF + (kx - losX) * 0.3; ty = ky - 40; break; // umpire holds the middle
        case "H": tx = kx; ty = F_TOP + 12; break;                               // down judge on the top sideline
        case "L": tx = kx; ty = F_BOT - 12; break;                               // line judge on the bottom sideline
        case "S": tx = kx + dir * 13 * YDF; ty = F_TOP + 12; break;              // side judge deep top
        case "F": tx = kx + dir * 13 * YDF; ty = F_BOT - 12; break;              // field judge deep bottom
        case "B": tx = kx + dir * 18 * YDF; ty = MIDY + (ky - MIDY) * 0.5; break; // back judge deepest
        default: tx = r.homeX; ty = r.homeY;
      }
      if (gliding) { tx = r.homeX; ty = r.homeY; }
      tx = clX(tx); ty = clY(ty);
      let ddx = tx - r.sx, ddy = ty - r.sy, d = Math.hypot(ddx, ddy);
      let nx = r.sx, ny = r.sy;
      if (d > 0.5) { const s = Math.min(d, step); nx += ddx / d * s; ny += ddy / d * s; }
      if (!gliding) {
        // stay away from players — soft repulsion out of any body he drifts into
        const AR = TU("refAvoidR", 16);
        for (const m of this.markers) {
          if (!m || m.sx == null) continue;
          const ex = nx - m.sx, ey = ny - m.sy, ed = Math.hypot(ex, ey);
          if (ed < AR && ed > 0.01) { const push = (AR - ed) * TU("refAvoidK", 0.5); nx += ex / ed * push; ny += ey / ed * push; }
        }
        // and out of each other, so the crew never stacks
        for (const o of this.refs) {
          if (o === r || o.sx == null) continue;
          const ex = nx - o.sx, ey = ny - o.sy, ed = Math.hypot(ex, ey);
          if (ed < 12 && ed > 0.01) { const push = (12 - ed) * 0.25; nx += ex / ed * push; ny += ey / ed * push; }
        }
        nx = clX(nx); ny = clY(ny);
      }
      this.placeRef(r, nx, ny, dtms);
    }
  }
  // Nearest official to a spot, skipping anyone already mid-signal so two calls at
  // once (a score AND the dead-ball whistle) land on two different men.
  refNearest(x, y, freeOnly) {
    if (!this.refs || !this.refs.length) return null;
    let best = null, bd = 1e9;
    for (const r of this.refs) {
      if (freeOnly && r.forceState) continue;
      const d = Math.hypot(r.sx - x, r.sy - y); if (d < bd) { bd = d; best = r; }
    }
    return best || (freeOnly ? this.refNearest(x, y, false) : null);
  }
  /* ===== v71 FLAG FOCUS — the camera goes to the official =====
   * v45/v49 got the crew throwing a real flag from a real hand, and then the
   * broadcast ignored it: the camera stayed locked on the ball carrier, who by then
   * is standing still, while the one thing that just changed the down happened
   * somewhere off to the side at 6 pixels tall. A penalty is the single moment in a
   * play where the ball is NOT the story.
   *
   * So a flag takes the frame. `_flagCam` re-points the follow at the official and
   * pushes the zoom in, on an ease-in / hold / ease-out envelope so the pull-in and
   * the release are both a move the eye can follow rather than a cut; the predictive
   * lead is suppressed for its duration, because that lead exists to keep a RUNNER in
   * frame and here it would only drag the official back off the edge of it.
   *
   * Zooming in on a man standing still is not emphasis, so he also SELLS it:
   * `refEmphasize` swells him, lifts him off his heels and puts a shiver through the
   * throw, and a ring goes off his feet. Everything is render-only and additive —
   * no sim actor moves, no call changes, and the whole thing expires on its own
   * clock, so a dropped frame or a torn-down scene cannot leave the camera stuck. */
  // the focus and the emphasis are one beat and they end together. They also both
  // run off the PLAY clock, so if a play dies mid-swell (the whistle came fast, the
  // scene tore down) the official would otherwise be left permanently 40% bigger and
  // tilted — this is the one place that can happen and the only place that clears it.
  endFlagFocus() {
    const F = this._flagCam; this._flagCam = null;
    try { if (F && F.m) { F.m.emphMs = 0; F.m.emphT = 0; if (F.m.root) F.m.root.setAngle(0); } } catch (e) {}
  }
  flagCamTarget(delta) {
    const F = this._flagCam;
    if (!F) return null;
    F.t += Math.max(0, delta || 16);
    if (F.t >= F.ms || !F.m || !F.m.root || F.m.root.active === false) { this.endFlagFocus(); return null; }
    const k = F.t / F.ms, IN = TU("flagCamInK", .22), OUT = TU("flagCamOutK", .26);
    const w = k < IN ? k / IN : k > 1 - OUT ? (1 - k) / OUT : 1;
    const e = w * w * (3 - 2 * w);                        // smoothstep in and out of the hold
    return { x: F.m.root.x, y: F.m.root.y - TU("flagCamRise", 12), zoom: F.z0 + (F.z1 - F.z0) * e, k: e };
  }
  // one swell with a shiver on it: the swell says LOOK, the shiver says he means it
  refEmphasize(m, ms) { if (m) { m.emphT = 0; m.emphMs = ms || TU("flagEmphMs", 950); } }
  refThrowFlag(x, y) {
    const best = this.refNearest(x, y, true);
    if (!best) return false;
    best.forceState = "throwSeq"; best.seqT = best.tms; best.sSm = 0;
    // v71: take the camera, and give it something to land on
    try {
      this._flagCam = { m: best, t: 0, ms: TU("flagCamMs", 1650),
        z0: this.cameras.main.zoom, z1: this.cameras.main.zoom * TU("flagCamZoomK", 1.62) };
      this.refEmphasize(best);
      const hp = PJ(best.sx, best.sy);
      const ring = this.trackFx(this.add.ellipse(hp.x, hp.y + 16 * hp.s, 20, 8)
        .setStrokeStyle(2.6, 0xffd75e, .95).setDepth(3.9));
      this.tweens.add({ targets: ring, scaleX: 5.4, scaleY: 5.4, alpha: 0, duration: 820,
        ease: "Quad.easeOut", onComplete: () => this.dropFx(ring) });
    } catch (e) {}
    // heave toward the spot, not away from it — in SCREEN space, since PJ can flip
    // the sim's x for a north-south camera
    best.seqFlip = PJ(x, y).x > PJ(best.sx, best.sy).x;
    const frameMs = TU("refFlagFrameMs", 105);
    // The flag leaves the hand on the heave frame, not on the windup, and it
    // tumbles through an arc instead of sliding flat to the spot.
    this.time.delayedCall(frameMs * 4, () => { try {
      if (!best.root || best.root.active === false) return;
      this.cameras.main.shake(150, TU("flagShake", 0.0035));
      const hand = PJ(best.sx, best.sy), spot = PJ(x, y);
      const key = this.textures.exists("spr_ref_flag") ? "spr_ref_flag" : null;
      const f = this.trackFx(key
        ? this.add.image(hand.x + (best.seqFlip ? 7 : -7) * hand.s, hand.y - 20 * hand.s, key).setScale(hand.s).setDepth(23)
        : this.add.rectangle(hand.x, hand.y - 20 * hand.s, 6, 6, 0xffd75e).setDepth(23).setAngle(20));
      const apex = Math.min(hand.y, spot.y) - TU("refFlagArc", 26) * hand.s;
      this.tweens.add({ targets: f, x: spot.x, duration: 620, ease: "Linear" });
      this.tweens.add({ targets: f, angle: 400, duration: 620, ease: "Linear" });
      this.tweens.add({ targets: f, y: apex, duration: 250, ease: "Quad.easeOut",
        onComplete: () => this.tweens.add({ targets: f, y: spot.y, duration: 370, ease: "Quad.easeIn",
          onComplete: () => this.tweens.add({ targets: f, alpha: 0, delay: 900, duration: 400, onComplete: () => this.dropFx(f) }) }) });
    } catch (e) {} });
    return true;
  }
  refSignalTD(x, y) {
    const best = this.refNearest(x, y, true);
    if (!best) return;
    best.forceState = "signalSeq"; best.seqT = best.tms; best.sSm = 0;
    best.seqLen = Math.max(4, Math.round(TU("refSignalHoldMs", 1700) / TU("refSignalFrameMs", 150)));
  }
  // Dead ball: the closest free official blows it, and if the play moved the
  // chains a wing official points the offense's way. Called from setSpot, which
  // every dead-ball path already runs through.
  refWhistle(x, y) {
    const P = this.play;
    if (P && P._refWhistled) return;                       // one whistle per play, however the ball died
    if (P) P._refWhistled = true;
    const best = this.refNearest(x, y, true);
    if (!best) return;
    best.forceState = "whistleSeq"; best.seqT = best.tms; best.sSm = 0;
    best.seqLen = Math.max(3, Math.round(TU("refWhistleHoldMs", 760) / TU("refWhistleFrameMs", 130)));
    if (!P || !P.fdConverted || P._refFdShown) return;
    P._refFdShown = true;
    const dir = (P.script && P.script.meta && P.script.meta.dir) || VDIR || 1;
    const downfield = PJ(x + dir * 40, y).x > PJ(x, y).x;  // which way is downfield ON SCREEN
    this.time.delayedCall(TU("refFirstDownDelayMs", 420), () => {
      const w = this.refNearest(x, y, true); if (!w) return;
      w.forceState = "pointSeq"; w.seqT = w.tms; w.sSm = 0;
      w.seqFlip = downfield;                               // arm extended the way the offense is driving
      w.seqLen = Math.max(3, Math.round(TU("refPointHoldMs", 1250) / TU("refPointFrameMs", 190)));
    });
  }
  clearRefs() {
    if (this.refs) for (const r of this.refs) { try { r.root.destroy(true); } catch (e) {} }
    this.refs = [];
    try { if (this.measG) this.measG.clear(); } catch (e) {}   // v109: the measurement chain dies with the crew
  }
  puffFx(sx, sy, n, col, alpha) {
    const p = PJ(sx, sy);
    for (let i = 0; i < (n || 2); i++) {
      const r = this.trackFx(this.add.rectangle(p.x + (Math.random() - 0.5) * 10, p.y + 8 * p.s, 3 * p.s, 2 * p.s, col == null ? 0x7fae6e : col, alpha == null ? 0.5 : alpha).setDepth(19));
      this.tweens.add({ targets: r, y: r.y - (4 + Math.random() * 7), x: r.x + (Math.random() - 0.5) * 12, alpha: 0, duration: 320 + Math.random() * 200, onComplete: () => this.dropFx(r) });
    }
  }
  skidFx(sx, sy) {
    const p = PJ(sx, sy);
    const g = this.trackFx(this.add.graphics().setDepth(2.5));
    g.lineStyle(2.5 * p.s, 0x1c4726, 0.5);
    g.lineBetween(p.x - 7 * p.s, p.y + 9 * p.s, p.x + 4 * p.s, p.y + 10.5 * p.s);
    g.lineBetween(p.x - 4 * p.s, p.y + 11 * p.s, p.x + 6 * p.s, p.y + 12 * p.s);
    this.tweens.add({ targets: g, alpha: 0, duration: 700, onComplete: () => this.dropFx(g) });
  }
  refreshPersp() {   // re-project + re-warp after a slider change or late art decode
    this._wxV144 = null;   // v144 H: the sky is cached per FRAME, and a Settings click lands between two of them
    if (this._lastField) this.drawField(this._lastField[0], this._lastField[1]);
  }
  /* ===== v72 END-ZONE MAPPING — the painted field and the simulated one are the
   * same field. warpField sampled the art by mapping its FULL HEIGHT onto the
   * world's full width. That quietly assumed two things about the art that are not
   * true of it: that its painted end zones are exactly EZ deep, and that it has no
   * apron outside them. It has a 10-yard end zone at each end AND ~6 yards of grass
   * beyond that, so the painted 100 yards occupied 542 world pixels while the sim's
   * 100 yards occupied 588 — every painted yard line sat off the sim's own yard
   * line, worst at the goal line, where a carrier the sim had at the 0 was drawn
   * four yards deep in the end zone.
   *
   * The art is mapped by its GOAL LINES instead: yard 0 to the painted 0, yard 100
   * to the painted 100, extrapolated past both, which puts the painted end zones at
   * exactly ten yards and leaves the rest of the world width as the apron the art
   * already draws. The rows are MEASURED off the art rather than typed in, so new
   * field art works without a code change; the measurement falls back to the values
   * measured on the shipped image if it cannot find the bands. ===== */
  fieldGoalRows() {
    if (this._goalRows) return this._goalRows;
    const FB = { y0: 613.5, y100: 85.5, src: "fallback" };   // measured on the shipped 360x700 art
    try {
      // fieldBase, not fieldImg: v44 composites the home crest onto fieldImg at the 50
      // at 44% of the field's width, and a crest is not grass — measuring the composite
      // splits the playing surface in half at midfield and finds a "field" that is one
      // hemisphere long. fieldBase is the same art before the crest goes on.
      const fimg = RIB.fieldBase || RIB.fieldImg;
      if (!fimg || !fimg.width) { FB.why = "art not decoded"; return FB; }   // do NOT cache
      const W = fimg.width, H = fimg.height;
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(fimg, 0, 0);
      const d = g.getImageData(0, 0, W, H).data;
      const xa = Math.round(W * .2), xb = Math.round(W * .8);
      const grass = [];
      for (let y = 0; y < H; y++) {
        let n = 0, k = 0;
        for (let x = xa; x < xb; x++) { const i = (y * W + x) * 4; k++;
          if (d[i + 1] > d[i] + 10 && d[i + 1] > d[i + 2] + 10) n++; }
        grass.push(n / k > .5);
      }
      // The painted yard lines are white, so they read as NOT grass and would cut the
      // playing surface into a dozen short runs. Close any gap too thin to be an end
      // zone first; then the profile really is apron / EZ / FIELD / EZ / apron and the
      // longest grass run IS the playing surface.
      const MINEZ = Math.max(8, Math.round(H * .035));
      const runs = []; let s0 = 0;
      for (let y = 1; y <= H; y++) { if (y < H && grass[y] === grass[s0]) continue;
        runs.push({ g: grass[s0], y0: s0, y1: y - 1, n: y - s0 }); s0 = y; }
      for (const r of runs) if (!r.g && r.n < MINEZ) for (let y = r.y0; y <= r.y1; y++) grass[y] = true;
      let best = null; s0 = 0;
      for (let y = 1; y <= H; y++) { if (y < H && grass[y] === grass[s0]) continue;
        if (grass[s0] && (!best || y - s0 > best.n)) best = { y0: s0, y1: y - 1, n: y - s0 };
        s0 = y; }
      // sanity: the playing surface has to be most of the art, or the detection found
      // something else and the measured constants are the safer answer
      // the playing surface is centred in the art: if the run we found is lopsided,
      // something on the turf (a crest, a logo, a stripe) cut it and the measured
      // constants are the safer answer
      const lop = best ? Math.abs(best.y0 - (H - 1 - best.y1)) : 1e9;
      if (best && best.n > H * .5 && best.y0 > 2 && best.y1 < H - 3 && lop < H * .06)
        this._goalRows = { y0: best.y1 + .5, y100: best.y0 - .5, src: "measured" };
      else FB.why = "no plausible playing surface: " + JSON.stringify(best);
    } catch (e) { FB.why = "threw: " + e.message; }
    return this._goalRows || FB;
  }
  // world u -> the art row that belongs there. Linear through the two goal lines and
  // extrapolated past them, so the apron beyond each end line comes from the apron
  // the art actually paints there.
  fieldArtY(u) {
    const G = this.fieldGoalRows();
    return G.y0 + (u - PLAY_L) * (G.y100 - G.y0) / (PLAY_R - PLAY_L);
  }
  warpField() {
    // v27: bake the uploaded field image through the SAME s(u) curve the players use —
    // each output row samples the art row the projection puts there, drawn at width ∝ s.
    // The outermost art pixels (plain grass) are stretched across the margins so every
    // row bleeds grass to the canvas edge: full-bleed, horizon impossible.
    try {
      const fimg = RIB.fieldImg, P = PERSP;
      if (!fimg || !P) return;
      const CW = 1200, CH = WORLD_H, AW = FW * PERSP_OA;
      if (!this._warpCv) { this._warpCv = document.createElement("canvas"); this._warpCv.width = CW; this._warpCv.height = CH; }
      const ctx = this._warpCv.getContext("2d");
      // Everything above the far end line is BEYOND the stadium, not more turf. It
      // used to be filled by stretching the art's topmost row across it, which was
      // invisible while that band was 30px tall; now that it is deep enough to hold
      // the end-zone stands it has to read as the dark behind them instead of as
      // grass floating above the goal line.
      const sky = ctx.createLinearGradient(0, 0, 0, NSTOP);
      /* v144 H: and by day it is a sky you can see. v98 made this a night game and nothing since
       * has given it an alternative; the lamps, the stars and the warm wash below all key off the
       * same `day` so a sunny afternoon cannot half-apply. Night is still the default and still
       * exactly the old two stops. */
      const DAY144 = this.wxV144().day;
      if (DAY144) { sky.addColorStop(0, TU("daySkyTopV144", "#4d86c4")); sky.addColorStop(1, TU("daySkyLowV144", "#bcd6ea")); }
      else { sky.addColorStop(0, "#010204"); sky.addColorStop(1, "#080b10"); }   // v98: darker still, so the lamps have something to glow against
      ctx.fillStyle = sky; ctx.fillRect(0, 0, CW, NSTOP + 1);
      this.starsV112(ctx, CW, NSTOP);   // v112: and the sky has stars in it
      const SWa = fimg.width, SHa = fimg.height;         // 360x700 art
      /* ===== v112 THE NEAR EDGE IS AN EDGE, NOT A SMEAR =====
       * Below the near end line the loop used to pin `u = 0` and copy that ONE art scanline
       * down the rest of the canvas — a few rows of it at the shipped anchoring, hundreds at
       * others, and either way it came out as the vertical green streaking along the bottom of
       * the frame. Two things replace it. v72 already documented that the art paints an APRON
       * past its own end line, so keep WALKING DOWN it (behind the anchor s is clamped, so the
       * row integral is linear there and the continuation is one division); and when the art's
       * apron genuinely runs out, close the picture the way the far end is closed — the
       * ground's own edge falling into the dark beyond the ground — rather than stretching a
       * scanline into infinity. `nearEdgeV112` at 0 puts the old smear back. */
      const SLOPE = Math.abs(P.s(0)) || 1, EXT = TU("nearEdgeV112", 1);
      /* ===== v144 E THE SAME GRASS ON ALL FOUR SIDES =====
       * The two long sides already bleed grass to the frame edge at every depth (the art's
       * outermost columns are stretched outward on every row). The two ENDS did not match.
       *   NORTH: `if (target <= 0) continue` threw away every row above the far end line, so the
       *     ~5 yards of apron the art paints beyond that end zone were never drawn and the stands
       *     sat straight on the end line.
       *   SOUTH: the apron was drawn as far as the painting went and then fell into black — v112
       *     made that a deliberate edge because the alternative it replaced was one scanline
       *     smeared over hundreds of rows, which streaked.
       * Both ends now carry grass. North draws the real painted apron. South keeps going past the
       * painting by CYCLING a band of the art's own apron rows — real grass pixels with real
       * texture, not one row stretched — and recedes under a gentle darkening instead of a wall of
       * black. `TU("apronV144", 0)` restores the v112 near edge and the bare far end line. */
      const APRON144 = TU("apronV144", 1);
      const SLOPE_N = Math.abs(P.s(FW)) || 1;
      const A_BAND = Math.max(6, TU("apronBandV144", 22)), A_MINROW = TU("apronFarMinRowV144", 3);
      let edgeI = -1, apronRows144 = 0, farRows144 = 0;
      for (let i = 0; i < CH; i++) {
        const target = (i - NSTOP) / P.VB;               // = total − C(u) at this row
        let u;
        if (target <= 0) {                                // above the far end line
          if (!APRON144) continue;                        // v112 and earlier: backdrop, not turf
          const uN = FW + (-target) / (SLOPE_N * SLOPE_N);
          if (this.fieldArtY(uN) < A_MINROW) continue;    // v144 E: past the painting — this really is sky
          u = uN; farRows144++;                           // v144 E: the far apron the art has always carried
        }
        else if (target >= P.total) u = EXT ? (P.total - target) / (P.d0 || SLOPE * SLOPE) : 0;   // v148: the density the curve has at u=0 (the taper's, when it runs)
        else { let lo = 0, hi = FW; const want = P.total - target;
          for (let it = 0; it < 18; it++) { const mid = (lo + hi) / 2; if (P.C(mid) < want) lo = mid; else hi = mid; }
          u = (lo + hi) / 2; }
        if (EXT && this.fieldArtY(u) > SHa - 4) {
          if (edgeI < 0) edgeI = i;                       // v112 still reports where the PAINTED apron ended
          if (!APRON144) break;                           // v112: no apron left to draw
          /* v144 E: the ground does not stop where the painting does. Cycle a band of the art's
           * own grass rows so the continuation has grain, and run it the full width — this far
           * down the field is wider than the canvas anyway. */
          /* ping-pong rather than wrap, and start on the row the painting stopped at: consecutive
           * canvas rows then always come from ADJACENT art rows, so there is no seam where the
           * continuation begins and no repeat line where a wrap would have jumped back. */
          const span144 = Math.max(2, A_BAND - 4), tt144 = (i - edgeI) % (span144 * 2);
          const sYa = (SHa - 4) - (tt144 < span144 ? tt144 : span144 * 2 - 1 - tt144);
          ctx.drawImage(fimg, 0, sYa, SWa, 1, 0, i, CW, 1);
          apronRows144++;
          continue;
        }
        const sY = Math.max(3, Math.min(SHa - 4, this.fieldArtY(u)));   // v72: by goal line, not by height
        const w = AW * (P.s(u) / P.sN), x0 = (CW - w) / 2;
        if (x0 > 0) {                                     // edge-extend the grass margins
          ctx.drawImage(fimg, 0, sY, 2, 1, 0, i, x0 + 1, 1);
          ctx.drawImage(fimg, SWa - 2, sY, 2, 1, x0 + w - 1, i, CW - x0 - w + 1, 1);
        }
        ctx.drawImage(fimg, 0, sY, SWa, 1, x0, i, w, 1);
        /* v79: the painted apron — REBASED in v79.2 on the art's OWN touchline.
         * The art paints its boundary ~35 world units outside the sim's F_BOT,
         * so the first cut of this block laid a second white "border" in the
         * open grass between the two lines, which read as a phantom boundary
         * with the team standing on the field side of the real one. The solid
         * band is gone — the art already HAS a boundary — and what the apron
         * genuinely lacks stays: the dashed coaches' box in front of the bench
         * and a grounding shade under the equipment row, both measured outward
         * from the same PAINT the sprites are anchored to. Lateral placement is
         * the exact PJ formula, which is what keeps the paint under the
         * sprites' own feet at every depth. Skipped past the end lines. */
        if (target < P.total && u > 4 && u < FW - 4) {
          const _fx2 = window.__FIELD_FX || {}, _sp2 = _fx2.spread == null ? 1 : _fx2.spread;
          const kk = P.s(u) / P.sN, lat = 1.30 * TU("latCal", 1.16) * _sp2 * PERSP_OA * kk;
          const HALF2 = (F_BOT - F_TOP) / 2, GAP2 = TU("crowdGap", 104);
          const PW = TU("sidePaintHalf", 206) / _sp2, APR2 = Math.max(24, HALF2 + GAP2 - PW);
          const band = (v0, v1, style) => { ctx.fillStyle = style;
            const a2 = (PW + v0) * lat, b2 = (PW + v1) * lat;
            ctx.fillRect(CW / 2 + a2, i, b2 - a2, 1); ctx.fillRect(CW / 2 - b2, i, b2 - a2, 1); };
          const inBox = u > PLAY_L + 25 * (PLAY_W / 100) && u < PLAY_R - 25 * (PLAY_W / 100);
          if (inBox && Math.floor(u / 11) % 2 === 0)
            band(APR2 * .3, APR2 * .3 + 2.6, "rgba(255,255,255," + TU("sideBoxA", .3) + ")");
          band(APR2 * .62, APR2 * .95, "rgba(0,0,0," + TU("sideKitShadeA", .10) + ")");
        }
      }
      if (edgeI >= 0 && edgeI < CH) {
        if (APRON144) {
          /* v144 E: the grass carried on above; all this has to do is let it recede. A soft, and
           * deliberately PARTIAL, darkening — the ground should read as running out of light, not
           * as running out of ground. */
          const gn = CH - edgeI;
          const ge = ctx.createLinearGradient(0, edgeI, 0, CH);
          ge.addColorStop(0, "rgba(6,10,14,0)");
          ge.addColorStop(1, "rgba(5,8,12," + TU("apronFadeAV144", .5) + ")");
          ctx.fillStyle = ge; ctx.fillRect(0, edgeI, CW, gn);
        } else {
          // v112: the ground ends here. Its own last apron rows carry the colour a short way
          // down and fall into the dark — one soft edge instead of several hundred rows of one
          // stretched scanline.
          const fade = Math.max(8, TU("nearEdgeFadePx", 110)), n = Math.min(CH - edgeI, fade);
          ctx.drawImage(fimg, 0, SHa - 3, SWa, 2, 0, edgeI, CW, n);
          const ge = ctx.createLinearGradient(0, edgeI, 0, edgeI + n);
          ge.addColorStop(0, "rgba(6,10,14,0)"); ge.addColorStop(1, "rgba(5,8,12,1)");
          ctx.fillStyle = ge; ctx.fillRect(0, edgeI, CW, n);
          if (edgeI + n < CH) { ctx.fillStyle = "#05080c"; ctx.fillRect(0, edgeI + n, CW, CH - edgeI - n); }
        }
      }
      this._nearEdgeV112 = { edgeI, lastTurfY: Math.round(NSTOP + P.VB * P.total), kMax: +(P.kMax || 0).toFixed(3) };
      try { (window.__V144 = window.__V144 || {}).apron = { on: !!APRON144, southRows: apronRows144, northRows: farRows144, edgeI }; } catch (e) {}
      this.lightFieldV98(ctx, CW, CH);   // v98: the lamps' wash, their pools and the edge falloff, baked on the turf
      if (this.textures.exists("rib_field_warp")) this.textures.get("rib_field_warp").refresh();
      else this.textures.addCanvas("rib_field_warp", this._warpCv);
      if (this.fieldSpr) this.fieldSpr.setTexture("rib_field_warp").setPosition(FW / 2, CH / 2).setScale(1).setVisible(true);
    } catch (e) { console.warn("[v27 warpField]", e); }
  }
  /* ===== v112 THE SKY HAS STARS =====
   * v98 painted the band above the far end line as a near-black gradient "so the lamps have
   * something to glow against" and left it at that, which is a sky with nothing in it. This
   * puts a sky there. Three things keep it from turning into noise:
   *   - it is BAKED INTO THE WARP CANVAS, at depth 0.6, so the bowl (3.45), the masts (3.2)
   *     and the big screen (3.30) all draw over it. A star is never on a spectator's face;
   *   - the field is re-warped at every snap, so the pattern is rolled from ONE FIXED SEED.
   *     A re-rolled sky would flicker like television static between plays;
   *   - there is no day setting in this game — v98 made it a night game and the only dial
   *     above it is v100's lighting intensity — so the stadium's own rig is what washes them
   *     out: crank the lights and the sky goes flat, take them down and the field is under a
   *     full one. They also fade as they come down to the stand's skyline, which is where
   *     the bowl's own glow is.
   * Still, not twinkling: the bake is per snap, not per frame, so nothing here costs a frame. */
  starsV112(ctx, CW, HT) {
    if (!TU("starsV112", 1)) return;
    const N = Math.round(TU("starCountV112", 190));
    if (N <= 0 || HT < 20) return;
    if (this.wxV144().day) { this._starsV112 = { n: 0, washedOut: "day" }; return; }   // v144 H: no stars in an afternoon sky
    const wash = Math.max(0, Math.min(1, (TU("starWashAt", 1.8) - this.lightMulV100()) / Math.max(0.05, TU("starWashSpan", 1.25))));
    if (wash <= 0.02) { this._starsV112 = { n: 0, wash: +wash.toFixed(3) }; return; }
    // the band they live in. The camera sits low: at an ordinary anchoring only the strip of
    // sky just above the bowl's skyline is on screen, so that strip is where the sky has to
    // be — a field of stars packed into the top of the canvas would be a sky nobody ever sees.
    const top = HT * TU("starTopFrac", 0.12), bot = HT * TU("starFloorFrac", 0.84);
    let sd = 0x1120b112 >>> 0;                       // the one fixed seed
    const rnd = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    let n = 0, maxA = 0;
    for (let i = 0; i < N; i++) {
      const x = rnd() * CW, f = rnd(), y = top + f * (bot - top);
      const r = TU("starRMin", 0.5) + rnd() * TU("starRSpan", 1.0);
      const a = TU("starAlphaV112", 0.8) * wash * (0.55 + 0.45 * (1 - f)) * (0.4 + 0.6 * rnd());
      const c = rnd() < 0.17 ? "186,206,255" : rnd() < 0.2 ? "255,234,202" : "228,236,250";
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      g.addColorStop(0, "rgba(" + c + "," + a.toFixed(3) + ")");
      g.addColorStop(0.34, "rgba(" + c + "," + (a * 0.4).toFixed(3) + ")");
      g.addColorStop(1, "rgba(" + c + ",0)");
      ctx.fillStyle = g; ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
      n++; maxA = Math.max(maxA, a);
    }
    ctx.restore();
    this._starsV112 = { n, wash: +wash.toFixed(3), band: [Math.round(top), Math.round(bot)], maxA: +maxA.toFixed(3) };
  }
  /* ===== v98 UNDER THE LIGHTS — the field lighting =====
   * The turf used to be the art, flat from end line to end line. The stadium has four
   * masts behind the far bowl, so the field now carries their light: a warm wash that is
   * strongest at the far end and fades down the field, a pool under each mast where its
   * beam lands, and a dark falloff out past the touchlines and toward the near corners,
   * which is what gives a floodlit field its depth. Baked into the warped canvas, so it
   * costs nothing per frame and rides the same perspective as the paint; the live part
   * of the light (the pools breathing with their lamps) is a handful of additive sprites
   * the stadium owns. All of it below the players' shadows, above the grass. */
  lightFieldV98(ctx, CW, CH) {
    if (!TU("fieldLightV98", 1)) return;
    try {
      const x0 = (CW - FW) / 2, H = CH - NSTOP, LM = this.bakedMulV100() * this.dayMulV144();   // v100: the dial, softened at the top. v144: and all but gone by day
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      /* v144 H: by day the light does not come from four masts — it comes from everywhere. The
       * wash and the pools below are gone (LM is ~0.12), so without this the afternoon turf is
       * DARKER than the floodlit one: a blue sky over a night field. One flat, even sheet of sun
       * across the whole playing surface instead, still riding the player's own brightness dial. */
      if (this.wxV144().day) {
        ctx.fillStyle = "rgba(255,250,230," + (TU("daySunA", 0.22) * this.lightMulV100()).toFixed(3) + ")";
        ctx.fillRect(0, NSTOP, CW, H);
      }
      // the wash: warm at the far end, gone by mid-field
      const wash = ctx.createLinearGradient(0, NSTOP, 0, NSTOP + H * TU("fieldWashReach", 0.48));
      wash.addColorStop(0, "rgba(255,238,196," + (TU("fieldWashA", 0.15) * LM).toFixed(3) + ")"); wash.addColorStop(1, "rgba(255,238,196,0)");
      ctx.fillStyle = wash; ctx.fillRect(0, NSTOP, CW, H);
      // the pools: one under each mast, pulled in toward the field it aims at
      const R = TU("fieldPoolR", 430), py = NSTOP + TU("fieldPoolDown", 150), pa = TU("fieldPoolA", 0.12) * LM;
      for (const f of [0.02, 0.2, 0.8, 0.98]) {
        const px = x0 + FW / 2 + (f - 0.5) * FW * 0.88;
        const g = ctx.createRadialGradient(px, py, 0, px, py, R);
        g.addColorStop(0, "rgba(255,244,214," + pa.toFixed(3) + ")"); g.addColorStop(0.55, "rgba(255,244,214," + (pa * 0.35).toFixed(3) + ")"); g.addColorStop(1, "rgba(255,244,214,0)");
        ctx.fillStyle = g; ctx.fillRect(px - R, Math.max(NSTOP, py - R), 2 * R, 2 * R);
      }
      // the falloff: the light thins out past the touchlines and down toward the near corners
      ctx.globalCompositeOperation = "source-over";
      // as the lights come down the corners go deeper, not flatter — a dark stadium is not evenly dark
      /* v144 H: daylight is flat. The vignette is what tells the eye the stadium is a pool of
       * light in the dark, so by day it mostly goes — otherwise a sunny sky sits over a field
       * with night-time corners. */
      const va = TU("fieldVignA", 0.34) * Math.max(0.35, Math.min(1.5, 2 - LM)) * (this.wxV144().day ? TU("dayVignKV144", 0.3) : 1), vc = { x: CW / 2, y: NSTOP + H * 0.42 };
      const v = ctx.createRadialGradient(vc.x, vc.y, CW * 0.38, vc.x, vc.y, CW * 1.05);
      v.addColorStop(0, "rgba(3,6,14,0)"); v.addColorStop(1, "rgba(3,6,14," + va.toFixed(3) + ")");
      ctx.fillStyle = v; ctx.fillRect(0, NSTOP, CW, H);
      ctx.restore();
    } catch (e) {}
  }
  drawField(losYd, tgtYd) {
    try { window.__FIELDMAP_V72 = { rows: this.fieldGoalRows(), artY: (u) => this.fieldArtY(u),
      PLAY_L, PLAY_R, FW, EZ, F_TOP, F_BOT, pj: (x, y) => PJ(x, y) }; } catch (e) {}
    // v27: the WARPED field image (see warpField) is the turf/lines/numbers; drawField
    // only rebuilds the projection for this snap and lays the moving LOS (blue) +
    // first-down (gold) markers on top through the same PJ curve.
    const g = this.field; g.clear();
    this._lastField = [losYd, tgtYd];
    const fxr = (yd) => PLAY_L + (yd / 100) * PLAY_W;
    const fx = (yd) => fxr(mt.Math.Clamp(yd, 0, 100));
    // v27: anchor the perspective at the offensive backfield, rebuild the projection and
    // re-warp the field image through it — the offense reads the same size at every snap
    // and the WHOLE scene (art + sprites + lines) recedes with one consistent curve.
    { const lxw = fx(losYd), losU = VDIR > 0 ? lxw : FW - lxw; ANCHOR_U = losU - PERSP_AB; }
    buildPersp();
    this._klV99 = null; this._lgV101 = null;   // v99: the masts moved with the projection — re-read the key light (v101: and the rig)
    this.warpField();
    this.buildCrowd();          // v57: the stands ride the same rebuilt perspective
    this.buildSideline();       // v78: and the team area is rebuilt on it too
    if (this.fieldSpr) { try { this.fieldSpr.setVisible(true); } catch (e) {} }
    else { g.fillStyle(0x2f5f2c, 1).fillRect(0, 0, FW, WORLD_H + 20); }   // fallback until the field image decodes
    const yline = (yd, w, col, al) => {
      // v29: the LOS/first-down stripes run past the numbers to the broadcast edge
      const ext = TU("lineExtend", 34);
      const a = PJ(fxr(yd), F_TOP - ext), b = PJ(fxr(yd), F_BOT + ext);
      g.lineStyle(w * ((a.s + b.s) / 2), col, al == null ? 1 : al).lineBetween(a.x, a.y, b.x, b.y);
    };
    // ---- LOS (blue) + first-down target (gold), painted over the field image ----
    yline(losYd, 6, 0x4a90e2, 0.22); yline(losYd, 2.6, 0x6bb2ff, 0.95);
    yline(tgtYd, 6, 0xf0bb45, 0.22); yline(tgtYd, 2.6, 0xffcf5e, 0.96);
    if (this.fieldLines) {
      const fl = this.fieldLines; fl.clear();
      const stroke = (yd, w, col, al) => { const ext = TU("lineExtend", 34); const a = PJ(fxr(yd), F_TOP - ext), b = PJ(fxr(yd), F_BOT + ext); fl.lineStyle(w * ((a.s + b.s) / 2), col, al).lineBetween(a.x, a.y, b.x, b.y); };
      stroke(losYd, 2.6, 0x6bb2ff, 0.95); stroke(tgtYd, 2.6, 0xffcf5e, 0.96);
    }
    this.focusPt = PJ(fx(losYd), (F_TOP + F_BOT) / 2);
    this.drawFieldText(fxr);
  }
  drawFieldText(fxr) {
    // Field numbers/words come from the baked field image now — nothing to draw here.
    if (this.ftext) this.ftext.forEach((t) => { try { t.destroy(); } catch (e) {} });
    this.ftext = [];
  }
  drawLegend() {
    const LEGY = WORLD_H + 120;          // parked far below the field so the main camera can never see it
    const y = LEGY + LEG / 2, g = this.add.graphics().setDepth(2);
    g.fillStyle(0x0b1119, 1).fillRect(0, LEGY, FW, LEG);
    g.lineStyle(1, 0xffffff, 0.12).lineBetween(0, LEGY, FW, LEGY);
    const items = [
      { t: "YOU", c: 0xf0bb45, dot: true }, { t: "OFFENSE", c: 0x2f9e4f, dot: true },
      { t: "DEFENSE", c: 0xc23a44, dot: true }, { t: "LOS", c: 0x4a90e2, dot: false }, { t: "TARGET", c: 0xf0bb45, dot: false },
      { t: "SPOT", c: 0xffffff, dot: true },
    ];
    let x = 56;
    const st = { fontFamily: "Oswald, sans-serif", fontSize: "13px", color: "#93a0b1", fontStyle: "600" };
    items.forEach((it) => {
      if (it.dot) g.fillStyle(it.c, 1).fillCircle(x, y, 7); else g.fillStyle(it.c, 1).fillRect(x - 9, y - 2.5, 18, 5);
      const t = this.add.text(x + 14, y, it.t, st).setOrigin(0, 0.5).setDepth(2);
      x += 34 + t.width + 32;
    });
  }
}
/* ===== v95 THE CALLOUT WALL — the drawn badges are a presentation system, not pop-ins =====
 * Fifteen hand-drawn badges (art/badges/, cut by scripts/build-badge-art.py into
 * public/badges/<name>.webp) replace the Oswald pop-text for the big moments. Every badge is
 * a row in BADGE_BOOK_V95 — tier, priority, entrance, hold, shake, camera punch, freeze,
 * slow-motion, dim, rays, particles, sound — so a new badge is a new row, never new code.
 *   TIER 1, the broadcast takeover (TOUCHDOWN, TURNOVER, GAME CHANGER, FIELD GOAL): the play
 *     freezes for a beat, the camera punches in, the field dims, rays turn behind the badge as
 *     it slams in (0.65 → 1.1 → 1), sparks or confetti leave its edges, the crowd flash lands,
 *     the game runs slow underneath, and it leaves with a fast zoom and fade.
 *   TIER 2, the stinger (INTERCEPTED, FUMBLE, FLAG, BIG PLAY, BREAKAWAY, SACK, BIG HIT): each
 *     has its own motion language — a streak, a wobble with the ball spinning loose, a flag
 *     that whips on first, a metallic slam from below, speed lines, a crush from above, a
 *     one-frame flash with a shockwave — and enters from the side the play happened on,
 *     sitting in the upper or lower middle so it never covers the carrier. It leaves by
 *     shrinking toward the scorebug.
 *   TIER 3, the scorebug panel (FIRST DOWN, 4TH DOWN, GOAL LINE, MISSED): a restrained HUD
 *     panel that slides in under the scoreboard with its context ("18-yard reception",
 *     "2 yards to go", "Ball on the 2", "47-yard attempt") and retracts. Its own lane, so a
 *     panel and a stinger can share the screen.
 * The anchor: a stage badge with a field position first flashes small over the player, then
 * flies to its mark and expands — the graphic originates from the play. The promotion: a
 * stronger badge that follows a related one MORPHS the one on screen (INTERCEPTED flips
 * into TURNOVER, then into TOUCHDOWN captioned PICK SIX; BIG PLAY +38 into TOUCHDOWN)
 * instead of stacking four graphics. Otherwise a bigger moment cuts a smaller one short, a
 * smaller one waits (two deep) or is dropped, a token fires once, and a kind never
 * stutters. window.__BADGE_V95 exposes show/clear/log for the dev checks. */
/* RIB_BADGES_V95_BEGIN */ const RIB_BADGES_V95 = {"intercepted":[480,256],"fumble":[480,248],"flag":[474,306],"bigplay":[466,326],"breakaway":[477,298],"sack":[480,271],"bighit":[480,269],"firstdown":[480,233],"fourthdown":[480,231],"goalline":[480,269],"missed":[480,259],"touchdown":[480,328],"turnover":[480,310],"fieldgoal":[480,317],"gamechanger":[480,340]}; /* RIB_BADGES_V95_END */
const BADGE_BOOK_V95 = {
  touchdown:   { tier: 1, prio: 10, entrance: "slam",      hold: 1250, freeze: 150, punch: 0.22, slow: [0.45, 420], shake: [260, 0.012], dim: 0.28, rays: "#ffd76a", flash: 0.55, particles: { kind: "confetti", colors: ["#ffd76a", "#fff2c4", "#ffffff", "#f0bb45"], n: 36 }, sound: "takeover" },
  gamechanger: { tier: 1, prio: 9,  entrance: "cinematic", hold: 1400, freeze: 120, punch: 0.2,  slow: [0.4, 500],  shake: [340, 0.01],  dim: 0.32, rays: "#7fc4ff", flash: 0.7,  particles: { kind: "sparks",   colors: ["#8fd3ff", "#ffffff", "#ffd76a"], n: 30 }, sound: "takeover" },
  turnover:    { tier: 1, prio: 8,  entrance: "spin",      hold: 1200, freeze: 90,  punch: 0.16, slow: [0.5, 360],  shake: [220, 0.011], dim: 0.26, rays: "#ff5a4a", flash: 0.4,  particles: { kind: "shards",   colors: ["#ff6b52", "#ffb08a", "#ffffff"], n: 26 }, sound: "crunch" },
  fieldgoal:   { tier: 1, prio: 7,  entrance: "arc",       hold: 1150, punch: 0.1,  shake: [140, 0.005], dim: 0.22, rays: "#8fe7a5", flash: 0.35, particles: { kind: "confetti", colors: ["#8fe7a5", "#ffd76a", "#ffffff"], n: 22 }, sound: "takeover" },
  intercepted: { tier: 2, prio: 8,  entrance: "streak",    hold: 1050, shake: [120, 0.005], streak: "#59b6ff", particles: { kind: "sparks", colors: ["#59b6ff", "#bfe6ff", "#ffffff"], n: 18 }, sound: "stinger" },
  fumble:      { tier: 2, prio: 7,  entrance: "wobble",    hold: 1100, shake: [200, 0.009], ball: 1, particles: { kind: "dirt", colors: ["#7a4a24", "#a8622f", "#4d5a2a"], n: 16 }, sound: "crunch" },
  flag:        { tier: 2, prio: 5,  entrance: "flutter",   hold: 1150, flag: 1, sound: "whistle" },
  bigplay:     { tier: 2, prio: 4,  entrance: "slamup",    hold: 1000, shake: [100, 0.004], particles: { kind: "sparks", colors: ["#ffd76a", "#8fd3ff", "#ffffff"], n: 14 }, sound: "stinger" },
  breakaway:   { tier: 2, prio: 6,  entrance: "speed",     hold: 950,  lines: "#8fe7a5", sound: "whoosh" },
  sack:        { tier: 2, prio: 6,  entrance: "crush",     hold: 1050, shake: [180, 0.01], particles: { kind: "dirt", colors: ["#9aa3ad", "#5d6670", "#ffffff"], n: 16 }, sound: "crunch" },
  bighit:      { tier: 2, prio: 5,  entrance: "shock",     hold: 950,  shake: [200, 0.012], flash: 0.8, ring: "#ff8a70", sound: "crunch" },
  firstdown:   { tier: 3, prio: 3,  entrance: "hud", hold: 1500, sound: "tick" },
  fourthdown:  { tier: 3, prio: 2,  entrance: "hud", hold: 1500, pulse: "#ff5a5a", sound: "tick" },
  goalline:    { tier: 3, prio: 2,  entrance: "hud", hold: 1500, pulse: "#59b6ff", sound: "tick" },
  missed:      { tier: 3, prio: 4,  entrance: "hud", hold: 1500, snap: "#ff5a5a", sound: "bad" },
};
// the promotions: "on screen > arriving" -> the caption the arriving badge wears (empty: its own)
const BADGE_PROMO_V95 = {
  "intercepted>touchdown": "PICK SIX", "fumble>touchdown": "SCOOP AND SCORE", "bigplay>touchdown": "", "breakaway>touchdown": "TO THE HOUSE",
  "intercepted>turnover": "INTERCEPTION", "fumble>turnover": "DEFENSE RECOVERS", "sack>turnover": "STRIP SACK", "bigplay>breakaway": "",
  "touchdown>gamechanger": "", "turnover>gamechanger": "", "fieldgoal>gamechanger": "",
};
const BADGE_V95 = (() => {
  const lanes = { stage: { cur: null, q: [], timer: null }, hud: { cur: null, q: [], timer: null } };
  const log = [], seen = {}; let host = null, preloaded = false, dimEl = null;
  const base = () => window.__RIB_BADGES_V95_URL || window.__RIB_ASSET("badges/");
  const url = (k) => base() + k + ".webp";
  const RM = () => REDUCED_MOTION;
  const rnd = (a, b) => a + Math.random() * (b - a);
  function preload() {
    if (preloaded) return; preloaded = true;
    for (const k in RIB_BADGES_V95) { const im = new Image(); im.decoding = "async"; im.src = url(k); }
  }
  function mount() {
    const wrap = document.querySelector(".field-wrap") || document.body;
    if (host && host.parentNode === wrap) return host;
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = document.createElement("div"); host.className = "rib-badge-host-v95"; wrap.appendChild(host); dimEl = null; return host;
  }
  // where things are: the host covers the field-wrap; the canvas sits inside it under the scorebug
  function geom() {
    const h = mount(), hr = h.getBoundingClientRect();
    const cv = document.querySelector("#field"); const cr = cv ? cv.getBoundingClientRect() : hr;
    const sb = h.parentNode.querySelector(".live-scoreboard"); const sr = sb ? sb.getBoundingClientRect() : null;
    return { w: hr.width, h: hr.height, cv: { x: cr.left - hr.left, y: cr.top - hr.top, w: cr.width || hr.width, h: cr.height || hr.height },
      sb: sr ? { x: sr.left - hr.left + sr.width / 2, y: sr.top - hr.top + sr.height / 2, bottom: sr.bottom - hr.top } : { x: hr.width / 2, y: 20, bottom: 0 } };
  }
  // a sim position -> a point in the host, through the scene camera
  function originOf(opts, g) {
    if (opts.x == null || opts.y == null || !opts.scene) return null;
    try {
      const p = PJ(opts.x, opts.y), v = opts.scene.cameras.main.worldView;
      const fx = (p.x - v.x) / v.width, fy = (p.y - v.y) / v.height;
      if (!(fx > -0.2 && fx < 1.2 && fy > -0.2 && fy < 1.2)) return null;
      return { x: g.cv.x + fx * g.cv.w, y: g.cv.y + fy * g.cv.h, fx, fy };
    } catch (e) { return null; }
  }
  function show(kind, opts) {
    opts = opts || {};
    const cfg = BADGE_BOOK_V95[kind]; if (!cfg || !RIB_BADGES_V95[kind]) return false;
    const now = Date.now(), token = opts.token || null;
    if (token && seen[token]) return false;                                            // this moment already fired
    if (!opts.force && seen[kind] && now - seen[kind] < TU("badgeRepeatMs", 2500)) return false;   // no stutter
    if (token) seen[token] = now; seen[kind] = now;
    const item = { kind, cfg, prio: cfg.prio, tier: cfg.tier, sub: opts.sub || "", hold: opts.hold || cfg.hold, at: now,
      x: opts.x, y: opts.y, scene: opts.scene || window.__gridironScene || null };
    log.push({ kind, sub: item.sub, at: now, tier: cfg.tier }); if (log.length > 80) log.shift();
    const L = lanes[cfg.tier === 3 ? "hud" : "stage"];
    if (L.cur) {
      const promo = BADGE_PROMO_V95[L.cur.kind + ">" + kind];
      if (promo != null) { item.sub = promo || item.sub; morph(L, item); return true; }             // the badge on screen becomes the stronger one
      if (item.prio > L.cur.prio) { L.q.unshift(item); retire(L, true); return true; }            // the bigger moment cuts in
    }
    if (L.cur || L.q.length) {
      L.q.push(item); L.q.sort((a, b) => b.prio - a.prio || a.at - b.at);
      while (L.q.length > TU("badgeQueueMax", 2)) L.q.pop();                                // the least of the wait is dropped
      return true;
    }
    L.q.push(item); next(L); return true;
  }
  function next(L) {
    if (L.cur || !L.q.length) return;
    const item = L.q.shift(); const h = mount(); if (!h) return;
    L.cur = item;
    const lead = !RM() && item.tier === 1 ? gameplayFx(item) : 0;   // the freeze and the punch land before the badge does
    item.lead = setTimeout(() => { item.lead = null; if (L.cur !== item) return; stage(L, item); }, lead);
  }
  // the takeover's grip on the game: an impact freeze, a camera punch, a beat of slow motion
  function gameplayFx(item) {
    const sc = item.scene, c = item.cfg; if (!sc || !sc.play) return 0;
    try {
      if (c.freeze) sc.hitStop = Math.max(sc.hitStop || 0, c.freeze);
      if (c.punch) sc.zoomPunch = Math.max(sc.zoomPunch || 0, c.punch);
      if (c.slow && sc.slowMoment) { sc.play.slowMoUntilReal = 0; sc.slowMoment(sc.play, c.slow[0], c.slow[1] + (c.freeze || 0)); }
    } catch (e) {}
    return c.freeze || 0;
  }
  function shake(item) { const sc = item.scene, s = item.cfg.shake; if (!sc || !s || RM()) return; try { sc.cameras.main.shake(s[0], s[1]); } catch (e) {} }
  function build(item, g) {
    const dim = RIB_BADGES_V95[item.kind], el = document.createElement("div");
    el.className = "rib-badge-v95 t" + item.tier + " " + item.kind; el.style.setProperty("--ar", dim[0] / dim[1]);
    el.innerHTML = (item.tier === 1 ? '<div class="rib-badge-rays-v95"></div>' : '') + '<div class="rib-badge-glow-v95"></div><img alt="' + item.kind + '" src="' + url(item.kind) + '">'
      + '<div class="rib-badge-sub-v95"' + (item.sub ? '' : ' hidden') + '>' + item.sub + '</div>';
    if (item.cfg.rays) el.style.setProperty("--ray", item.cfg.rays);
    return el;
  }
  // the marks: tier 1 dead centre; tier 2 upper or lower middle, whichever half the play is not in
  function markOf(item, g, o) {
    if (item.tier === 1) return { x: g.cv.x + g.cv.w * 0.5, y: g.cv.y + g.cv.h * 0.46 };
    const upper = o ? o.fy > 0.5 : (item.kind === "sack" || item.kind === "bighit");
    const side = o ? (o.fx < 0.4 ? -1 : o.fx > 0.6 ? 1 : 0) : 0;
    return { x: g.cv.x + g.cv.w * (0.5 + side * 0.05), y: g.cv.y + g.cv.h * (upper ? 0.3 : 0.7), side, upper };
  }
  function stage(L, item) {
    const h = mount(), g = geom();
    if (item.tier === 3) return hud(L, item, g);
    const o = originOf(item, g), m = markOf(item, g, o), el = build(item, g);
    el.style.left = m.x + "px"; el.style.top = m.y + "px";
    el.style.width = Math.min(item.tier === 1 ? g.cv.w * 0.72 : g.cv.w * 0.58, item.tier === 1 ? 340 : 280) + "px";
    h.appendChild(el); item.el = el; item.mark = m; item.origin = o;
    const side = o ? (o.fx < 0.45 ? -1 : o.fx > 0.55 ? 1 : 0) : (Math.random() < 0.5 ? -1 : 1);
    const T = (x, y, s, r, k) => "translate(calc(-50% + " + x + "px), calc(-50% + " + y + "px)) scale(" + s + ") rotate(" + (r || 0) + "deg)" + (k ? " skewX(" + k + "deg)" : "");
    const ox = o ? o.x - m.x : side * g.cv.w * 0.7, oy = o ? o.y - m.y : 0;
    let frames, dur = 520, easing = "cubic-bezier(.2,.9,.25,1.1)";
    if (RM()) { frames = [{ opacity: 0, transform: T(0, 0, 1) }, { opacity: 1, transform: T(0, 0, 1) }]; dur = 220; easing = "ease-out"; }
    else {
      // the anchor flight: small over the player, a flash, then to the mark
      const A = o ? [{ opacity: 0, transform: T(ox, oy, 0.18), offset: 0 }, { opacity: 1, transform: T(ox, oy, 0.28), offset: 0.1 }, { opacity: 0.5, transform: T(ox, oy, 0.22), offset: 0.18 }, { opacity: 1, transform: T(ox, oy, 0.28), offset: 0.26 }] : null;
      switch (item.cfg.entrance) {
        case "slam": frames = A ? A.concat([{ transform: T(0, 0, 1.12, -2), offset: 0.62 }, { transform: T(0, 0, 0.96, 1), offset: 0.8 }, { transform: T(0, 0, 1) }])
          : [{ opacity: 0, transform: T(0, 0, 0.65, -3) }, { opacity: 1, transform: T(0, 0, 1.1, 1), offset: 0.55 }, { transform: T(0, 0, 0.97), offset: 0.8 }, { transform: T(0, 0, 1) }]; dur = A ? 560 : 420; break;
        case "cinematic": frames = [{ opacity: 0, transform: T(0, 0, 1.7), filter: "blur(10px)" }, { opacity: 1, transform: T(0, 0, 0.98), filter: "blur(0)", offset: 0.6 }, { transform: T(0, 0, 1.02), offset: 0.8 }, { transform: T(0, 0, 1), filter: "blur(0)" }]; dur = 620; easing = "cubic-bezier(.15,.85,.2,1)"; break;
        case "spin": frames = (A || [{ opacity: 0, transform: T(ox, oy, 0.3, -540), offset: 0 }]).concat([{ opacity: 1, transform: T(0, 0, 1.12, -12), offset: 0.62 }, { transform: T(0, 0, 0.96, 4), offset: 0.8 }, { transform: T(0, 0, 1, 0) }]); dur = 600; break;
        case "arc": frames = [{ opacity: 0, transform: T(ox * 0.5, g.cv.h * 0.45, 0.5, 8), offset: 0 }, { opacity: 1, transform: T(ox * 0.15, -g.cv.h * 0.06, 1.08, -2), offset: 0.62 }, { transform: T(0, 0, 0.97), offset: 0.82 }, { transform: T(0, 0, 1) }]; dur = 620; easing = "cubic-bezier(.3,.8,.3,1)"; break;
        case "streak": frames = (A || [{ opacity: 0, transform: T(side * g.cv.w * 0.8, -g.cv.h * 0.25, 0.9, 0, -22), offset: 0 }]).concat([{ opacity: 1, transform: T(side * 18, -8, 1.06, side * -3, side * -14), offset: 0.7 }, { transform: T(0, 0, 1, 0, 0) }]); dur = 420; easing = "cubic-bezier(.1,.9,.2,1)"; break;
        case "wobble": frames = (A || [{ opacity: 0, transform: T(ox, oy, 0.4), offset: 0 }]).concat([{ opacity: 1, transform: T(6, -4, 1.06, 5), offset: 0.55 }, { transform: T(-7, 3, 1, -6), offset: 0.66 }, { transform: T(5, -2, 1.02, 4), offset: 0.77 }, { transform: T(-3, 2, 1, -2), offset: 0.88 }, { transform: T(0, 0, 1, 0) }]); dur = 640; easing = "ease-out"; break;
        case "flutter": frames = [{ opacity: 0, transform: T(0, -g.cv.h * 0.5, 0.9, 6), offset: 0 }, { opacity: 1, transform: T(0, 12, 1.04, -2), offset: 0.7 }, { transform: T(0, -4, 0.99, 1), offset: 0.86 }, { transform: T(0, 0, 1) }]; dur = 520; easing = "cubic-bezier(.4,.7,.4,1)"; break;
        case "slamup": frames = (A || [{ opacity: 0, transform: T(0, g.cv.h * 0.6, 0.8), offset: 0 }]).concat([{ opacity: 1, transform: T(0, -10, 1.08), offset: 0.62 }, { transform: T(0, 3, 0.98), offset: 0.82 }, { transform: T(0, 0, 1) }]); dur = 420; easing = "cubic-bezier(.1,.9,.2,1)"; break;
        case "speed": frames = [{ opacity: 0, transform: T(side * g.cv.w * 1.1, 0, 0.9, 0, side * -28), offset: 0 }, { opacity: 1, transform: T(side * -14, 0, 1.05, 0, side * -10), offset: 0.55 }, { transform: T(0, 0, 1, 0, 0) }]; dur = 360; easing = "cubic-bezier(.05,.9,.15,1)"; break;
        case "crush": frames = [{ opacity: 0, transform: T(ox * 0.3, -g.cv.h * 0.7, 0.85), offset: 0 }, { opacity: 1, transform: T(0, 0, 1) + " scale(1.16,.8)", offset: 0.5 }, { transform: T(0, -6, 1) + " scale(.96,1.06)", offset: 0.72 }, { transform: T(0, 0, 1) }]; dur = 440; easing = "cubic-bezier(.6,0,.4,1)"; break;
        case "shock": frames = [{ opacity: 0, transform: T(ox * 0.4, oy * 0.4, 1.6) }, { opacity: 1, transform: T(0, 0, 1.6), offset: 0.12 }, { transform: T(0, 0, 0.95), offset: 0.5 }, { transform: T(0, 0, 1.03), offset: 0.75 }, { transform: T(0, 0, 1) }]; dur = 380; break;
        default: frames = [{ opacity: 0, transform: T(ox, oy, 0.5) }, { opacity: 1, transform: T(0, 0, 1) }];
      }
    }
    el.style.opacity = "1";
    const anim = el.animate(frames, { duration: dur, easing, fill: "forwards" }); item.anim = anim;
    dress(item, g, m, side, dur);
    L.timer = setTimeout(() => retire(L, false), dur + item.hold);
  }
  // everything around the badge: dim, rays, flash, streaks, flag, ball, particles, shake, sound
  function dress(item, g, m, side, dur) {
    const c = item.cfg, h = host; if (!h) return;
    sfx(c.sound);
    if (RM()) return;
    shake(item);
    if (c.dim) { const d = dimOn(c.dim); item.dim = d; }
    if (c.flash) setTimeout(() => flash(c.flash), item.tier === 1 ? dur * 0.62 : 0);
    if (c.streak) streak(item, g, m, side);
    if (c.lines) speedLines(item, g, m, side);
    if (c.flag) flagWhip(item, g, m);
    if (c.ball) looseBall(item, g, m, side);
    if (c.ring) ring(item, g, m);
    if (c.particles) setTimeout(() => emit(item, c.particles), item.tier === 1 ? dur * 0.6 : dur * 0.5);
  }
  function dimOn(a) {
    if (!dimEl || !dimEl.parentNode) { dimEl = document.createElement("div"); dimEl.className = "rib-badge-dim-v95"; host.appendChild(dimEl); }
    dimEl.getAnimations().forEach(x => x.cancel()); dimEl.animate([{ opacity: 0 }, { opacity: a }], { duration: 160, fill: "forwards" }); return dimEl;
  }
  function dimOff() { if (!dimEl) return; const d = dimEl; dimEl = null; d.animate([{ opacity: getComputedStyle(d).opacity }, { opacity: 0 }], { duration: 260, fill: "forwards" }).onfinish = () => d.remove(); }
  function flash(a) { const f = document.createElement("div"); f.className = "rib-badge-flash-v95"; host.appendChild(f); f.animate([{ opacity: a }, { opacity: 0 }], { duration: 420, easing: "ease-out", fill: "forwards" }).onfinish = () => f.remove(); }
  function streak(item, g, m, side) {
    const s = document.createElement("div"); s.className = "rib-badge-streak-v95"; s.style.top = (m.y - g.cv.h * 0.1) + "px"; s.style.setProperty("--c", item.cfg.streak);
    s.style.transform = "rotate(" + (side * -14) + "deg)"; host.appendChild(s);
    s.animate([{ opacity: 0, left: (side < 0 ? -g.w : g.w) + "px" }, { opacity: 1, offset: 0.3 }, { opacity: 0, left: (side < 0 ? g.w * 0.6 : -g.w * 0.6) + "px" }], { duration: 480, easing: "cubic-bezier(.1,.9,.2,1)", fill: "forwards" }).onfinish = () => s.remove();
  }
  function speedLines(item, g, m, side) {
    for (let i = 0; i < 7; i++) {
      const s = document.createElement("div"); s.className = "rib-badge-line-v95"; s.style.setProperty("--c", item.cfg.lines);
      s.style.top = (m.y + rnd(-70, 70)) + "px"; s.style.width = rnd(60, 220) + "px"; s.style.height = rnd(2, 4) + "px"; host.appendChild(s);
      s.animate([{ opacity: 0, left: (side < 0 ? -300 : g.w + 80) + "px" }, { opacity: 0.9, offset: 0.25 }, { opacity: 0, left: (side < 0 ? g.w : -300) + "px" }], { duration: rnd(300, 460), delay: i * 25, easing: "cubic-bezier(.05,.9,.15,1)", fill: "forwards" }).onfinish = () => s.remove();
    }
  }
  function flagWhip(item, g, m) {
    const f = document.createElement("div"); f.className = "rib-badge-flag-v95"; host.appendChild(f);
    f.animate([{ transform: "translate(" + (m.x - g.w * 0.6) + "px," + (m.y - g.cv.h * 0.55) + "px) rotate(0deg)", opacity: 1 },
      { transform: "translate(" + (m.x - 20) + "px," + (m.y - 90) + "px) rotate(380deg)", offset: 0.55 },
      { transform: "translate(" + (m.x + 30) + "px," + (m.y + 70) + "px) rotate(560deg)", opacity: 1, offset: 0.9 },
      { transform: "translate(" + (m.x + 34) + "px," + (m.y + 80) + "px) rotate(600deg)", opacity: 0 }], { duration: 900, easing: "cubic-bezier(.3,.6,.5,1)", fill: "forwards" }).onfinish = () => f.remove();
  }
  function looseBall(item, g, m, side) {
    // the v91 ball frames, tumbling, or a plain leather ellipse when the sheet isn't in
    const b = document.createElement("canvas"); b.width = 48; b.height = 48; b.className = "rib-badge-ball-v95"; host.appendChild(b);
    const cx = b.getContext("2d"); cx.imageSmoothingEnabled = false; let f = 0;
    const draw = () => { cx.clearRect(0, 0, 48, 48); const cell = typeof ribCellV91 === "function" ? ribCellV91("ball_tumble" + (f % 12)) : null;
      if (cell) cx.drawImage(cell, 0, 0); else { cx.fillStyle = "#7a4a24"; cx.beginPath(); cx.ellipse(24, 24, 14, 8, f * 0.5, 0, 6.3); cx.fill(); } f++; };
    draw(); const iv = setInterval(draw, 55);
    const dx = (side || 1) * -rnd(120, 200);
    b.animate([{ transform: "translate(" + (m.x - 24) + "px," + (m.y - 24) + "px) scale(1.2)", opacity: 0 }, { opacity: 1, offset: 0.1 },
      { transform: "translate(" + (m.x - 24 + dx * 0.5) + "px," + (m.y - 24 - 90) + "px) scale(1.6)", offset: 0.5 },
      { transform: "translate(" + (m.x - 24 + dx) + "px," + (m.y - 24 + 40) + "px) scale(1.2)", opacity: 1, offset: 0.9 }, { opacity: 0 }], { duration: 900, easing: "cubic-bezier(.3,.5,.5,1)", fill: "forwards" }).onfinish = () => { clearInterval(iv); b.remove(); };
  }
  function ring(item, g, m) {
    const r = document.createElement("div"); r.className = "rib-badge-ring-v95"; r.style.left = m.x + "px"; r.style.top = m.y + "px"; r.style.setProperty("--c", item.cfg.ring); host.appendChild(r);
    r.animate([{ transform: "translate(-50%,-50%) scale(.2)", opacity: 1 }, { transform: "translate(-50%,-50%) scale(3.2)", opacity: 0 }], { duration: 520, easing: "cubic-bezier(.1,.8,.3,1)", fill: "forwards" }).onfinish = () => r.remove();
  }
  function emit(item, p) {
    const el = item.el; if (!el || !el.parentNode) return;
    const hr = host.getBoundingClientRect(), r = el.getBoundingClientRect();
    const x0 = r.left - hr.left, y0 = r.top - hr.top, w = r.width, h = r.height;
    for (let i = 0; i < p.n; i++) {
      const d = document.createElement("div"); d.className = "rib-badge-p-v95 " + p.kind; d.style.background = p.colors[i % p.colors.length];
      const t = Math.random(), per = 2 * (w + h); let px, py, nx, ny;   // a point on the edge, pushed outward
      if (t * per < w) { px = t * per; py = 0; nx = 0; ny = -1; } else if (t * per < w + h) { px = w; py = t * per - w; nx = 1; ny = 0; }
      else if (t * per < 2 * w + h) { px = 2 * w + h - t * per; py = h; nx = 0; ny = 1; } else { px = 0; py = per - t * per; nx = -1; ny = 0; }
      d.style.left = (x0 + px) + "px"; d.style.top = (y0 + py) + "px"; host.appendChild(d);
      const sp = p.kind === "sparks" ? rnd(80, 220) : rnd(50, 170), ang = Math.atan2(ny, nx) + rnd(-0.9, 0.9), grav = p.kind === "confetti" ? 90 : p.kind === "dirt" ? 120 : 40;
      const tx = Math.cos(ang) * sp, ty = Math.sin(ang) * sp + grav, dur = rnd(520, 980);
      d.animate([{ transform: "translate(0,0) rotate(0deg)", opacity: 1 }, { transform: "translate(" + tx + "px," + ty + "px) rotate(" + rnd(-540, 540) + "deg)", opacity: 0 }], { duration: dur, easing: "cubic-bezier(.15,.7,.4,1)", fill: "forwards" }).onfinish = () => d.remove();
    }
  }
  // tier 3: the scorebug panel
  function hud(L, item, g) {
    const el = document.createElement("div"); el.className = "rib-hud-v95 " + item.kind; item.el = el;
    if (item.cfg.pulse) el.style.setProperty("--pulse", item.cfg.pulse);
    el.innerHTML = '<img alt="' + item.kind + '" src="' + url(item.kind) + '"><div class="rib-hud-txt-v95">' + (item.sub || "") + '</div>' + (item.cfg.snap ? '<i class="rib-hud-snap-v95" style="--c:' + item.cfg.snap + '"></i>' : '');
    el.style.top = Math.max(g.sb.bottom, g.cv.y) + 8 + "px"; host.appendChild(el);
    const dur = RM() ? 200 : 360;
    item.anim = el.animate(RM() ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: "translateX(112%)", opacity: 0.6 }, { transform: "translateX(-3%)", opacity: 1, offset: 0.75 }, { transform: "translateX(0)", opacity: 1 }], { duration: dur, easing: "cubic-bezier(.2,.9,.25,1)", fill: "forwards" });
    if (item.cfg.pulse && !RM()) el.animate([{ boxShadow: "0 0 0 0 " + item.cfg.pulse + "00" }, { boxShadow: "0 0 0 5px " + item.cfg.pulse + "55", offset: 0.5 }, { boxShadow: "0 0 0 0 " + item.cfg.pulse + "00" }], { duration: 700, iterations: 3, delay: dur });
    sfx(item.cfg.sound);
    L.timer = setTimeout(() => retire(L, false), dur + item.hold);
  }
  // the promotion: the badge on screen flips, becomes the stronger one, moves to its mark
  function morph(L, item) {
    const old = L.cur; clearTimeout(L.timer); if (old.lead) { clearTimeout(old.lead); old.lead = null; }
    if (!old.el || old.tier === 3 || item.tier === 3) { L.q.unshift(item); retire(L, true); return; }
    const el = old.el, g = geom(), m = markOf(item, g, null);
    item.el = el; item.mark = m; item.scene = item.scene || old.scene; L.cur = item; item.at = Date.now();
    log[log.length - 1].promo = old.kind;
    if (!RM() && item.tier === 1) gameplayFx(item);
    const flip = RM() ? [{ opacity: 1 }, { opacity: 0.3 }] : [{ transform: "translate(-50%,-50%) rotateY(0deg) scale(1)" }, { transform: "translate(-50%,-50%) rotateY(90deg) scale(1.1)" }];
    el.getAnimations().forEach(a => a.cancel());
    el.animate(flip, { duration: 150, easing: "ease-in", fill: "forwards" }).onfinish = () => {
      const dim = RIB_BADGES_V95[item.kind]; el.className = "rib-badge-v95 t" + item.tier + " " + item.kind; el.style.setProperty("--ar", dim[0] / dim[1]);
      if (item.cfg.rays) el.style.setProperty("--ray", item.cfg.rays);
      if (item.tier === 1 && !el.querySelector(".rib-badge-rays-v95")) { const r = document.createElement("div"); r.className = "rib-badge-rays-v95"; el.insertBefore(r, el.firstChild); }
      el.querySelector("img").src = url(item.kind); const sub = el.querySelector(".rib-badge-sub-v95"); sub.textContent = item.sub; sub.hidden = !item.sub;
      el.style.left = m.x + "px"; el.style.top = m.y + "px"; el.style.width = Math.min(item.tier === 1 ? g.cv.w * 0.72 : g.cv.w * 0.58, item.tier === 1 ? 340 : 280) + "px";
      const back = RM() ? [{ opacity: 0.3 }, { opacity: 1 }] : [{ transform: "translate(-50%,-50%) rotateY(-90deg) scale(1.1)" }, { transform: "translate(-50%,-50%) rotateY(0deg) scale(1.14)", offset: 0.6 }, { transform: "translate(-50%,-50%) rotateY(0deg) scale(1)" }];
      el.animate(back, { duration: 260, easing: "cubic-bezier(.2,.9,.25,1.1)", fill: "forwards" });
      dress(item, g, m, 0, 260);
      L.timer = setTimeout(() => retire(L, false), 260 + item.hold);
    };
  }
  function retire(L, cut) {
    const item = L.cur; if (!item) return;
    clearTimeout(L.timer); if (item.lead) { clearTimeout(item.lead); item.lead = null; }
    L.cur = null; const el = item.el; if (item.dim || dimEl) dimOff();
    if (!el) { next(L); return; }
    const g = geom(); let frames, dur;
    if (RM()) { frames = [{ opacity: 1 }, { opacity: 0 }]; dur = 200; }
    else if (item.tier === 3) { frames = [{ transform: "translateX(0)", opacity: 1 }, { transform: "translateX(112%)", opacity: 0.4 }]; dur = cut ? 140 : 300; }
    else if (item.tier === 1) { frames = [{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: "translate(-50%,-50%) scale(1.28)", opacity: 0 }]; dur = cut ? 120 : 240; }
    else { const dx = g.sb.x - (item.mark ? item.mark.x : g.w / 2), dy = g.sb.y - (item.mark ? item.mark.y : 0);   // the stinger shrinks toward the scorebug
      frames = [{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px)) scale(.22)", opacity: 0 }]; dur = cut ? 140 : 380; }
    el.getAnimations().forEach(a => { try { a.commitStyles(); } catch (e) {} a.cancel(); });
    el.animate(frames, { duration: dur, easing: "cubic-bezier(.5,0,.8,.4)", fill: "forwards" }).onfinish = () => { el.remove(); next(L); };
  }
  function clear() {
    for (const k in lanes) { const L = lanes[k]; clearTimeout(L.timer); L.q.length = 0; if (L.cur) { if (L.cur.lead) clearTimeout(L.cur.lead); if (L.cur.el) L.cur.el.remove(); L.cur = null; } }
    if (host) host.querySelectorAll(".rib-badge-v95,.rib-hud-v95,.rib-badge-p-v95,.rib-badge-flash-v95,.rib-badge-streak-v95,.rib-badge-line-v95,.rib-badge-flag-v95,.rib-badge-ball-v95,.rib-badge-ring-v95,.rib-badge-dim-v95").forEach(e => e.remove());
    dimEl = null;
  }
  // the audio cues: short synthesised stingers on the game's own sound setting
  let actx = null;
  function sfx(name) {
    try {
      const st = window.__getGridironState && window.__getGridironState(); if (!st || !st.settings || !st.settings.sound) return;
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; actx = actx || new AC(); const a = actx, t = a.currentTime;
      const tone = (type, f0, f1, t0, len, g) => { const o = a.createOscillator(), v = a.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t + t0); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + t0 + len);
        v.gain.setValueAtTime(1e-4, t + t0); v.gain.exponentialRampToValueAtTime(g, t + t0 + 0.012); v.gain.exponentialRampToValueAtTime(1e-4, t + t0 + len); o.connect(v); v.connect(a.destination); o.start(t + t0); o.stop(t + t0 + len + 0.03); };
      const noise = (t0, len, g, fc) => { const n = a.createBufferSource(), buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        n.buffer = buf; const f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = fc; const v = a.createGain(); v.gain.setValueAtTime(g, t + t0); v.gain.exponentialRampToValueAtTime(1e-4, t + t0 + len); n.connect(f); f.connect(v); v.connect(a.destination); n.start(t + t0); };
      switch (name) {
        case "takeover": tone("sine", 440, 0, 0, 0.1, 0.07); tone("sine", 660, 0, 0.09, 0.1, 0.07); tone("sine", 880, 1320, 0.18, 0.32, 0.08); noise(0.17, 0.35, 0.05, 2400); break;
        case "stinger": tone("triangle", 520, 780, 0, 0.09, 0.06); tone("triangle", 780, 1040, 0.08, 0.16, 0.06); break;
        case "crunch": tone("sawtooth", 110, 48, 0, 0.22, 0.07); noise(0, 0.18, 0.06, 900); break;
        case "whoosh": noise(0, 0.32, 0.05, 1800); break;
        case "whistle": tone("sine", 2300, 2100, 0, 0.26, 0.05); break;
        case "tick": tone("sine", 900, 0, 0, 0.05, 0.05); break;
        case "bad": tone("sawtooth", 300, 120, 0, 0.22, 0.05); break;
      }
    } catch (e) {}
  }
  return { show, preload, clear, log, lanes, meta: RIB_BADGES_V95, book: BADGE_BOOK_V95, promo: BADGE_PROMO_V95, get queue() { return lanes.stage.q; }, get current() { return lanes.stage.cur; }, get hudCurrent() { return lanes.hud.cur; } };
})();
window.__BADGE_V95 = BADGE_V95;
// the badge's caption for a yardage
function badgeYdsV95(yd) { yd = Number(yd || 0); return yd > 0 ? "+" + yd + " YARDS" : yd < 0 ? "LOSS OF " + Math.abs(yd) : ""; }
class Dt {
  game; scene; canvas; pending = [];
  drawStatic(et) { const rt = document.querySelector("#field"); return rt ? (this.withScene(rt, (it) => it.renderStatic(et)), !0) : !1; }
  animate(et, rt) { const it = document.querySelector("#field"); return it ? (this.withScene(it, (ht) => ht.animatePlay(et, rt)), !0) : !1; }
  // v101: mount the game and build the play while the loading chase is still on screen
  prewarm(et, done) { const it = document.querySelector("#field"); if (!it) { try { done && done(); } catch (e) {} return !1; }
    this.withScene(it, (ht) => { try { ht.prebuildV101(et); } catch (e) {} try { done && done(); } catch (e) {} }); return !0; }
  cancel() { this.scene?.cancel(); }
  destroy() { this.scene = void 0; this.canvas = void 0; this.pending = []; this.game?.destroy(!1); this.game = void 0; }
  withScene(et, rt) { (this.canvas !== et || !this.game) && this.mount(et); this.scene ? rt(this.scene) : this.pending.push(rt); }
  mount(et) {
    this.destroy(); this.canvas = et; et.width = 720; et.height = CH;
    const rt = this;
    class it extends Ot { create() { super.create(); rt.scene = this; rt.pending.splice(0).forEach((p) => p(this)); } }
    this.game = new mt.Game({
      type: mt.CANVAS, width: 720, height: CH, canvas: et, transparent: !1, backgroundColor: "#0a1018",
      render: { antialias: !0, pixelArt: !1, roundPixels: !0 }, audio: { noAudio: !0 }, scene: it,
    });
  }
}
window.PhaserFieldBridge = Dt;
window.__pickFeaturedIndex = pickFeaturedIndex;

})();
