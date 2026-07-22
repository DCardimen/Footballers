import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const refArg = process.argv.find(a => a.startsWith("--git-ref="));
const gitRef = refArg ? refArg.slice("--git-ref=".length) : null;
const html = gitRef
  ? execFileSync("git", ["show", `${gitRef}:index.html`], { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 })
  : fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

const scriptAnchor = html.indexOf("/* ===== RIB_TUNE");
const scriptOpen = html.lastIndexOf("<script>", scriptAnchor);
const scriptClose = html.indexOf("</script>", scriptAnchor);
if (scriptAnchor < 0 || scriptOpen < 0 || scriptClose < 0) throw new Error("play engine script block not found");
const engineSource = html.slice(scriptOpen + "<script>".length, scriptClose);

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function runtime(seed, level = 4) {
  const seededMath = Object.create(Math);
  seededMath.random = mulberry32(seed);
  const ctx = vm.createContext({ console, Math: seededMath });
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.runInContext(engineSource, ctx, { filename: gitRef ? `${gitRef}:index.html` : "index.html" });
  ctx.__getGridironState = () => ({ player: { level } });
  return ctx;
}

const POS_OFF = ["WR", "WR", "TE", "OL", "OL", "OL", "OL", "OL", "QB", "RB", "WR"];
const POS_DEF = ["CB", "CB", "S", "S", "LB", "LB", "LB", "DL", "DL", "DL", "DL"];
const SKILLS = ["speed", "quickness", "acceleration", "burst", "strength", "blocking", "tackling", "coverage", "agility", "awareness", "catching", "jumping", "throwing", "vision", "stamina", "grit", "discipline", "ballControl"];

function player(pos, index, side) {
  const base = side === "off" ? 58 : 57;
  const attrs = Object.fromEntries(SKILLS.map(k => [k, base]));
  if (pos === "QB") Object.assign(attrs, { throwing: 69, awareness: 65, vision: 64, agility: 55, speed: 52 });
  if (pos === "RB") Object.assign(attrs, { speed: 68, acceleration: 70, burst: 69, agility: 72, quickness: 70, vision: 64, ballControl: 64 });
  if (pos === "WR") Object.assign(attrs, { speed: 67, acceleration: 65, agility: 66, quickness: 65, catching: 63, jumping: 62 });
  if (pos === "TE") Object.assign(attrs, { catching: 62, strength: 65, speed: 58, blocking: 61 });
  if (pos === "OL") Object.assign(attrs, { blocking: 65, strength: 67, speed: 43, agility: 44 });
  if (pos === "CB") Object.assign(attrs, { coverage: 62, speed: 66, agility: 63, quickness: 62, awareness: 56, discipline: 55, catching: 54 });
  if (pos === "S") Object.assign(attrs, { coverage: 60, speed: 63, awareness: 61, discipline: 61, tackling: 59 });
  if (pos === "LB") Object.assign(attrs, { tackling: 62, awareness: 57, discipline: 56, strength: 63, speed: 57 });
  if (pos === "DL") Object.assign(attrs, { strength: 66, tackling: 62, quickness: 56, speed: 50 });
  return { id: `${side}-${pos}-${index}`, pos, attrs, body: { height: pos === "OL" || pos === "DL" ? 76 : 72 } };
}

function rosters() {
  return {
    off: POS_OFF.map((p, i) => player(p, i, "off")),
    def: POS_DEF.map((p, i) => player(p, i, "def")),
  };
}

const att = (p, key) => Number(p?.attrs?.[key] ?? 55);
const concepts = ["quick", "dropback", "shot", "fade", "screen"];
const TOP = 48, BOTTOM = 396, PLAY_L = 66, PLAY_R = 654;

function addLogMetrics(m, log) {
  for (const e of log.events) {
    if (e.type === "routeBreak") m.routeBreaks++;
    if (e.type === "routeReaction") { m.routeReactions++; if (e.badBite) m.badRouteBites++; }
    if (e.type === "cut" || e.type === "cutback") m.cuts++;
    if (e.type === "badAngle") m.badAngles++;
    if (e.type === "tackle" && e.oob) {
      m.oob++;
      if (Math.abs(e.y - TOP) > 1e-6 && Math.abs(e.y - BOTTOM) > 1e-6) m.oobSpotErrors++;
    }
  }
  for (const actor of log.actors) for (const f of actor.frames) {
    if (f.y < TOP - 1e-6 || f.y > BOTTOM + 1e-6) m.outsideFrames++;
  }
}

function goalCheck(ctx, payload, expectedPlane, direction) {
  const s = ctx.buildPlayScript(payload, {
    dims: { PLAY_L, PLAY_R, F_TOP: 14, F_BOT: 426 },
    rand: ctx.Math.random,
  });
  const td = s.events.find(e => e.type === "td");
  if (!td) return { ok: false, reason: "missing td event" };
  const actor = s.actors.find(a => a.id === td.carrier);
  const first = actor?.frames.find(f => direction > 0 ? f.x >= expectedPlane : f.x <= expectedPlane);
  return {
    ok: !!first && Math.abs(td.x - expectedPlane) < 1e-6 && td.t === first.t,
    eventT: td.t,
    firstCrossT: first?.t ?? null,
    eventX: td.x,
    eventY: td.y,
  };
}

function batch(passIndex) {
  const ctx = runtime(0xC0FFEE + passIndex * 7919);
  const m = {
    pass: passIndex + 1, runs: 0, runYards: 0, passes: 0, completions: 0, passYards: 0, passAirYards: 0, interceptions: 0,
    oob: 0, oobSpotErrors: 0, outsideFrames: 0, routeBreaks: 0, routeReactions: 0, badRouteBites: 0,
    cuts: 0, badAngles: 0,
  };
  for (let i = 0; i < 60; i++) {
    const r = rosters(), rb = r.off.find(p => p.pos === "RB");
    const out = ctx.__FieldSim._sim("run", r.off, r.def, att, { off: { 9: rb } }, {});
    m.runs++; m.runYards += out.yards; addLogMetrics(m, out.log);
  }
  for (let i = 0; i < 60; i++) {
    const r = rosters(), qb = r.off.find(p => p.pos === "QB"), wr = r.off.filter(p => p.pos === "WR")[i % 3], cb = r.def.filter(p => p.pos === "CB")[i % 2];
    const out = ctx.__FieldSim._sim("pass", r.off, r.def, att,
      { target: wr, cover: cb, off: { 8: qb, 0: wr }, def: { 0: cb } },
      { concept: concepts[i % concepts.length], fieldPos: 20 + (i % 7) * 10, down: i % 4 + 1, toGo: 4 + i % 9 });
    const catchEvent = out.log.events.find(e => e.type === "catch"), complete = !!catchEvent;
    m.passes++; m.completions += Number(complete); m.interceptions += Number(!!out.intercepted);
    m.passYards += complete ? out.yards : 0;
    m.passAirYards += complete ? Math.max(0, catchEvent.x / 5.88) : 0;
    addLogMetrics(m, out.log);
  }
  const tdRun = goalCheck(ctx, { offense: "us", startBall: 94, endBall: 100, yards: 6, event: "run", desc: "TOUCHDOWN", scored: true, playerPos: "RB", involved: true }, PLAY_R, 1);
  const pickSix = goalCheck(ctx, { offense: "us", startBall: 18, endBall: 0, yards: 0, event: "turnover", desc: "PICK SIX", pickSix: true, scored: true, playerPos: "CB", involved: true }, PLAY_L, -1);
  return {
    ...m,
    runYpc: +(m.runYards / m.runs).toFixed(2),
    completionPct: +(m.completions / m.passes * 100).toFixed(1),
    passYpa: +(m.passYards / m.passes).toFixed(2),
    airYpa: +(m.passAirYards / m.passes).toFixed(2),
    yacPerCompletion: +((m.passYards - m.passAirYards) / Math.max(1, m.completions)).toFixed(2),
    interceptionPct: +(m.interceptions / m.passes * 100).toFixed(1),
    goalLineChecks: Number(tdRun.ok) + Number(pickSix.ok),
    goalLineDetail: { tdRun, pickSix },
  };
}

const passes = Array.from({ length: 10 }, (_, i) => batch(i));
passes.forEach(p => console.log(JSON.stringify(p)));

const sum = key => passes.reduce((n, p) => n + p[key], 0);
const average = key => +(sum(key) / passes.length).toFixed(2);
const range = key => +(Math.max(...passes.map(p => p[key])) - Math.min(...passes.map(p => p[key]))).toFixed(2);
const V37_REFERENCE = { avgRunYpc: 7.8, avgCompletionPct: 68.5, avgPassYpa: 7.98, avgAirYpa: 4.78, avgYacPerCompletion: 4.68 };
const summary = {
  source: gitRef || "worktree",
  simulations: passes.length,
  plays: sum("runs") + sum("passes"),
  avgRunYpc: average("runYpc"), avgCompletionPct: average("completionPct"), avgPassYpa: average("passYpa"),
  avgAirYpa: average("airYpa"), avgYacPerCompletion: average("yacPerCompletion"),
  avgInterceptionPct: average("interceptionPct"), completionSpread: range("completionPct"),
  oob: sum("oob"), oobSpotErrors: sum("oobSpotErrors"), outsideFrames: sum("outsideFrames"),
  goalLineChecks: sum("goalLineChecks"), routeBreaks: sum("routeBreaks"), routeReactions: sum("routeReactions"),
  badRouteBites: sum("badRouteBites"), cuts: sum("cuts"), badAngles: sum("badAngles"),
};
const profileCtx = runtime(0xACC311);
summary.accelerationProfile = typeof profileCtx.__FieldSim?._accelTest === "function" ? {
  low: profileCtx.__FieldSim._accelTest(25, 25, 40),
  mid: profileCtx.__FieldSim._accelTest(60, 60, 60),
  elite: profileCtx.__FieldSim._accelTest(90, 90, 90),
} : null;
const pctDelta = (value, baseline) => +((value - baseline) / baseline * 100).toFixed(1);
summary.balanceVsV37 = Object.fromEntries(Object.entries(V37_REFERENCE).map(([key, baseline]) => [key, {
  baseline, current: summary[key], deltaPct: pctDelta(summary[key], baseline),
}]));
console.log("summary", JSON.stringify(summary, null, 2));

if (!gitRef) {
  const failures = [];
  if (summary.oobSpotErrors) failures.push(`${summary.oobSpotErrors} out-of-bounds spots missed the plane`);
  if (summary.outsideFrames) failures.push(`${summary.outsideFrames} player frames escaped the field`);
  if (summary.goalLineChecks !== 20) failures.push(`${20 - summary.goalLineChecks} goal-line crossings were late/misplaced`);
  if (!summary.routeBreaks || !summary.routeReactions) failures.push("route breaks did not affect coverage movement");
  if (!summary.cuts || !summary.badAngles) failures.push("directional cuts did not produce any pursuit mistakes");
  const ap = summary.accelerationProfile;
  if (!ap) failures.push("acceleration profile hook is missing");
  else {
    if (!(ap.elite.t50 < ap.mid.t50 && ap.mid.t50 < ap.low.t50)) failures.push("acceleration rating did not order 0-50 times");
    if (!(ap.elite.t80 < ap.mid.t80 && ap.mid.t80 < ap.low.t80)) failures.push("acceleration rating did not order 0-80 times");
    if (!(ap.elite.t90 <= ap.mid.t90 && ap.mid.t90 <= ap.low.t90)) failures.push("acceleration rating inverted 0-90 times");
    if (!(ap.elite.distance330 > ap.mid.distance330 && ap.mid.distance330 > ap.low.distance330)) failures.push("burst rating did not order first-step distance");
    if (!(ap.elite.brake50 < ap.low.brake50)) failures.push("agility did not improve braking time");
  }
  for (const [key, comparison] of Object.entries(summary.balanceVsV37)) {
    if (Math.abs(comparison.deltaPct) > 12) failures.push(`${key} moved ${comparison.deltaPct}% from the v37 calibration`);
  }
  if (failures.length) {
    console.error("movementcheck failed:", failures.join("; "));
    process.exitCode = 1;
  }
}
