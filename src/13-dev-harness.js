
/* ===== RIB DEV HARNESS — live tuning + measurement (DEV.help() for the map) ===== */
(function () {
  const T = window.RIB_TUNE = window.RIB_TUNE || {};
  const DEFAULTS = {
    shedDelay: 430, shedRand: 520, shed2Gap: 280, flushRadius: 44, convergeCap: 300, leadAir: 3.8,
    contactSlow: 0.5, pileFloor: 0.34, dtPush: 0.74, pancakeRun: 0.07, pancakePass: 0.04, stunMs: 1450,
    jogSpeed: 340, trailMin: 170, blockBand: 78, blockFrameMs: 170, hitStopBig: 80,
    zoomPlay: 1.34, zoomBig: 1.04, diveChance: 0.4, finishPop: 2.0,
    ballAirCap: 64, ballAirK: 0.8, ballReleaseBlendMs: 135, camLeadMs: 420, camLeadMax: 130,
    perspZoomK: 0.78, zoomLerp: 0.06,
    zoomLockMin: 0.6, zoomLockMax: 2.4, zoomLockLerp: 0.12,
    gangOpen: 0.10, gangBox: 0.24, gangHandsK: 0.24, pileStrK: 0.014, pileDriveK: 7,
    overshootMs: 420, overshootPace: 1.0, angleErrK: 0.017, angleLatPx: 26,
    supportHold: 26, pilePushP: 0.3, grabHoldMs: 260, grabHoldK: 30, supGrabMs: 120,
    wrapGrabMs: 700, lineExtend: 34, lightDepth: 0.12, lightSpotR: 200, lightAmb: 0.9,
    tackleCreditPx: 20, gasHitCostD: 4, gasHitCostC: 6, wearK: 0.05, wearMax: 24,
    bigStickEdge: 1.6, rideDownEdge: 0.5, stayUpEdge: 0.42,
    // v112 THE HIT HAS WEIGHT — who leaves his feet, and the one number that decides the arc
    launchV112: 1, flyV112: 1, launchGate: 168, launchMinKb: 5, launchMaxHands: 1,
    launchImpactK: 1, launchStrK: 0.9, launchKbK: 2.4, launchStickPow: 26, launchLevK: 1.6, launchBehindPow: 40,
    launchMassMin: 0.6, launchMassMax: 1.8, launchVzBase: 0.1, launchVzK: 0.0011, launchVzMin: 0.1, launchVzMax: 0.17,
    launchG: 0.001, launchSkid: 0.22, launchSkidMs: 150, launchSkidK: 0.5,
    launchBounceK: 0.17, launchBounceFrac: 0.55, launchSpin: 0.38, launchDownMs: 900, launchBadgeMaxMs: 1500,
    containWideY: 46, containLxMax: 22, containDepth: 10, containWide: 16,
    holdFlagMs: 900, dpiSep: -0.8, holdFlagP: 0.5, dpiFlagP: 0.2, fmFlagP: 0.08,
    safetyRoofLx: 55, safetyCushion: 44,
    routeReactBase: 285, routeReactMin: 70, routeReactMax: 390, routeBadBiteK: 0.008,
    jukePlantMs: 170, jukeLanePx: 14, cinematicScale: 0.5, cinematicMs: 1000,
    planeEpsilon: 0.05,
    accelRestartTurn: 0.34, accelResetFrac: 0.08, turnLossBase: 0.30, turnLossAgilityK: 0.0024,
    turnRetentionFloor: 0.54, accelLaunchMs: 260, burstAccelK: 0.0042,
    accelBasePerSec: 3.0, accelRatingK: 0.040, rollingAccelScale: 3.0, rollingReadyMs: 132, brakeBasePerSec: 3.0,
    brakeAgilityK: 0.020, brakeAccelK: 0.006, whistleBrakeScale: 0.46,
    fieldSpeedCap: 1.35, choreoSpeedCap: 2.15, pileSpeedFrac: 0.12,
    catchRunThroughMs: 550, catchStrideLocationK: 0.32, catchStrideMax: 0.16
  };
  const DEV = window.DEV = {
    defaults: DEFAULTS,
    set(k, v) { if (!(k in DEFAULTS)) console.warn("[DEV] unknown dial:", k, "- DEV.list() shows all"); T[k] = v; return DEV.get(k); },
    get(k) { return k ? (T[k] !== undefined ? T[k] : DEFAULTS[k]) : Object.fromEntries(Object.keys(DEFAULTS).map(x => [x, DEV.get(x)])); },
    reset(k) { if (k) delete T[k]; else Object.keys(T).forEach(x => delete T[x]); return DEV.get(); },
    list() { console.table(Object.keys(DEFAULTS).map(k => ({ dial: k, value: DEV.get(k), default: DEFAULTS[k], changed: T[k] !== undefined }))); },
    _mix(i) { const r = i % 5, ball = 20 + (i * 13) % 60;
      if (r < 2) return { offense: "us", startBall: ball, endBall: ball + 3 + (i % 9), yards: 3 + (i % 9), event: "run", desc: "Run up the middle", playerPos: "RB", involved: true, preToGo: 10 };
      if (r === 2) return { offense: "us", startBall: ball, endBall: ball + 5 + (i % 16), yards: 5 + (i % 16), event: "pass", desc: "Complete pass", playerPos: "WR", involved: true, preToGo: 10 };
      if (r === 3) return { offense: "us", startBall: ball, endBall: ball, yards: 0, event: "pass", desc: "Incomplete pass", playerPos: "WR", involved: true, preToGo: 10 };
      return { offense: "us", startBall: ball, endBall: ball - 7, yards: -7, event: "sack", desc: "SACKED", playerPos: "QB", involved: true, preToGo: 10 }; },
    sim(n) {
      n = n || 150;
      if (typeof buildPlayScript !== "function") { console.error("[DEV] engine not loaded"); return null; }
      const dims = { PLAY_L: 66, PLAY_R: 654, F_TOP: 14, F_BOT: 426 };
      const ev = {}, durs = []; let maxStep = 0;
      for (let i = 0; i < n; i++) {
        const s = buildPlayScript(DEV._mix(i), { dims, rand: Math.random });
        durs.push(s.duration);
        s.events.forEach(e => ev[e.type] = (ev[e.type] || 0) + 1);
        for (const a of s.actors) { const f = a.frames;
          for (let k = 1; k < f.length; k++) { const st = Math.hypot(f[k].x - f[k-1].x, f[k].y - f[k-1].y); if (st > maxStep) maxStep = st; } }
      }
      durs.sort((a, b) => a - b);
      const out = { plays: n, p50ms: durs[n >> 1], p90ms: durs[Math.floor(n * 0.9)], maxStepPx: +maxStep.toFixed(1) };
      for (const k of ["tackle","catch","shed","flush","block","pancake","contact","whistle","forwardprogress","pushback","coverageBust"])
        out[k] = +((ev[k] || 0) / n).toFixed(2);
      console.table([out]); return out;
    },
    compare(changes, n) {
      console.log("[DEV] BASELINE:");
      const before = DEV.sim(n);
      const saved = Object.assign({}, T); Object.assign(T, changes);
      console.log("[DEV] WITH " + JSON.stringify(changes) + ":");
      const after = DEV.sim(n);
      Object.keys(T).forEach(k => delete T[k]); Object.assign(T, saved);
      const delta = {}; for (const k in before) if (typeof before[k] === "number" && k !== "plays") delta[k] = +(after[k] - before[k]).toFixed(2);
      console.log("[DEV] DELTA (after - before):"); console.table([delta]);
      return { before, after, delta };
    },
    play(payload) {
      const dims = { PLAY_L: 66, PLAY_R: 654, F_TOP: 14, F_BOT: 426 };
      const s = buildPlayScript(Object.assign({ offense: "us", startBall: 30, endBall: 38, yards: 8, event: "run", desc: "Run", playerPos: "RB", involved: true, preToGo: 10 }, payload || {}), { dims, rand: Math.random });
      console.table(s.events.map(e => ({ t: Math.round(e.t), type: e.type, who: e.who || e.by || e.tackler || "", x: Math.round(e.x || 0), y: Math.round(e.y || 0) })));
      return s;
    },
    help() { console.log(
"RUNNING IT BACK - DEV HARNESS\n" +
"=============================\n" +
"ARCHITECTURE (single HTML, multiple script blocks):\n" +
"  1. Choreography ENGINE (window.buildPlayScript): stat-AUTHORITATIVE. Takes a play payload\n" +
"     (yards/event fixed by the season sim) and choreographs 22 actors x 33ms frames + events.\n" +
"     Never changes outcomes, only how they look. Systems: pocket/sheds/QB flush, contact piles,\n" +
"     escort blocking, flight convergence (no catch teleports), pancake/stun, coverage AI.\n" +
"  2. Phaser BRIDGE (scene class): PRESENTATION ONLY. Plays frames through PJ() north-south\n" +
"     projection (offense always attacks screen-top; VDIR flips on possession). placeMarker() is\n" +
"     the animation state machine (smoothed speed sSm, 8 facings, block band, forceState poses).\n" +
"     RIB atlas: 72 cells, 40-palette recolor, opponent palette hashed from team name.\n" +
"  3. LEGACY season sim (minified): careers, stats, prestige. Patch via string replacement only;\n" +
"     save keys (gridiron_save_v1) and window API names must never be renamed.\n" +
"WORKFLOW FOR ANY CHANGE:\n" +
"  DEV.list() | DEV.set('flushRadius',60) | DEV.sim(200) | DEV.compare({shedDelay:900},200)\n" +
"  DEV.play({event:'pass',yards:18}) | DEV.reset()\n" +
"DIALS: rush (shedDelay/shedRand/shed2Gap/flushRadius) | catch (convergeCap/leadAir) |\n" +
"contact (contactSlow/pileFloor/dtPush) | pancake (pancakeRun/pancakePass/stunMs) |\n" +
"look/feel (jogSpeed/trailMin/blockBand/blockFrameMs/hitStopBig/zoomPlay/zoomBig/diveChance/finishPop)"); }
  };
  console.log("[DEV] harness ready - DEV.help() | DEV.list() | DEV.compare({flushRadius:70},200)");
})();
