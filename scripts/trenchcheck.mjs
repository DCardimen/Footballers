// Dev check: v81 REAL FOOTBALL — the trench, the swarm, and how plays end.
//   - a run play BLOCKS people: WR stalk blocks, the TE seal and the OL climbs
//     put ~8 of 11 defenders on a block a second into the play (it was 4.5 — the
//     four paired DL and nobody else, with seven defenders running free at the
//     ball on every snap)
//   - no cartoon piles: at the whistle the carrier has ~2-3 defenders near him,
//     not a ring of eight — pursuit deals ROLES (two attack, two take away the
//     field ahead, the rest rally through the wake)
//   - contact ENDS plays: ~1.4 contacts per play, first contact to whistle a
//     few hundred ms, gang share ~30%
//   - the yardage keeps a football shape: TFLs exist, mode at 0-5, a 20+ tail
//     that is a tail rather than a fifth of all carries
// Pure Node (loads the FieldSim block directly, like movementcheck) — no server.
// node scripts/trenchcheck.mjs
import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const a0 = html.indexOf("/* ===== RIB_TUNE");
const so = html.lastIndexOf("<script>", a0), sc = html.indexOf("</script>", a0);
const src = html.slice(so + 8, sc);
function mulberry32(seed) { return function () { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const seededMath = Object.create(Math); seededMath.random = mulberry32(0xBEEF01);
const ctx = vm.createContext({ console, Math: seededMath }); ctx.window = ctx; ctx.globalThis = ctx;
vm.runInContext(src, ctx);
if (process.env.TUNE) Object.assign(ctx.RIB_TUNE = ctx.RIB_TUNE || {}, JSON.parse(process.env.TUNE));
const SK = ["speed","quickness","acceleration","burst","strength","blocking","tackling","coverage","agility","awareness","catching","jumping","throwing","vision","stamina","grit","discipline","ballControl"];
function player(pos, i, side) {
  const base = side === "off" ? 58 : 57;
  const attrs = Object.fromEntries(SK.map(k => [k, base]));
  if (pos === "QB") Object.assign(attrs, { throwing: 69, awareness: 65, vision: 64, agility: 55, speed: 52 });
  if (pos === "RB") Object.assign(attrs, { speed: 68, acceleration: 70, burst: 69, agility: 72, quickness: 70, vision: 64, ballControl: 64 });
  if (pos === "WR") Object.assign(attrs, { speed: 67, acceleration: 65, agility: 66, quickness: 65, catching: 63, jumping: 62 });
  if (pos === "TE") Object.assign(attrs, { catching: 62, strength: 65, speed: 58, blocking: 61 });
  if (pos === "OL") Object.assign(attrs, { blocking: 65, strength: 67, speed: 43, agility: 44 });
  if (pos === "CB") Object.assign(attrs, { coverage: 62, speed: 66, agility: 63, quickness: 62, awareness: 56, discipline: 55 });
  if (pos === "S") Object.assign(attrs, { coverage: 60, speed: 63, awareness: 61, discipline: 61, tackling: 59 });
  if (pos === "LB") Object.assign(attrs, { tackling: 62, awareness: 57, discipline: 56, strength: 63, speed: 57 });
  if (pos === "DL") Object.assign(attrs, { strength: 66, tackling: 62, quickness: 56, speed: 50 });
  return { id: `${side}-${pos}-${i}`, pos, attrs, body: { height: pos === "OL" || pos === "DL" ? 76 : 72 } };
}
const OFF = ["WR","WR","TE","OL","OL","OL","OL","OL","QB","RB","WR"], DEF = ["CB","CB","S","S","LB","LB","LB","DL","DL","DL","DL"];
const att = (p, k) => Number(p?.attrs?.[k] ?? 55);
const N = +(process.env.N || 1200);
const M = { plays: 0, yards: [], contacts: [], mob: [], mobMax: [], firstToEnd: [], blockedAt1s: [], solo: 0, gang: 0, none: 0,
  evasions: { whiff: 0, hurdle: 0, stiffarm: 0, broken: 0, stagger: 0 }, wraps: 0, attempts: 0, tfl: 0, ten: 0, twenty: 0 };
for (let i = 0; i < N; i++) {
  const off = OFF.map((p, j) => player(p, j, "off")), def = DEF.map((p, j) => player(p, j, "def"));
  const rb = off.find(p => p.pos === "RB");
  const out = ctx.__FieldSim._sim("run", off, def, att, { off: { 9: rb } }, {});
  const log = out.log, ev = log.events;
  M.plays++; M.yards.push(out.yards);
  if (out.yards < 0) M.tfl++; if (out.yards >= 10) M.ten++; if (out.yards >= 20) M.twenty++;
  const lunges = ev.filter(e => e.type === "tackleLunge");
  M.stalks = (M.stalks || 0) + ev.filter(e => e.type === "stalk").length;
  M.sheds = (M.sheds || 0) + ev.filter(e => e.type === "shedBlock").length;
  M.contacts.push(lunges.length);
  for (const e of ev) if (M.evasions[e.type === "tackleWhiff" ? "whiff" : e.type] !== undefined) M.evasions[e.type === "tackleWhiff" ? "whiff" : e.type]++;
  const tk = ev.filter(e => e.type === "tackle").pop();
  if (tk) { if (!tk.tackler) M.none++; else if (tk.gang) M.gang++; else M.solo++; }
  const firstC = lunges[0];
  if (tk && firstC) M.firstToEnd.push(tk.t - firstC.t);
  // mob size: defenders within 30px of the carrier at the tackle moment, from frames
  if (tk && tk.carrier) {
    const when = tk.t;
    const carA = log.actors.find(x => x.id === tk.carrier);
    const cf = carA && carA.frames.filter(f => f.t <= when).pop();
    if (cf) {
      let mob = 0;
      for (const x of log.actors) {
        if (!x.id.startsWith("def") || x.id === tk.carrier) continue;
        const f = x.frames.filter(g => g.t <= when).pop();
        if (f && Math.hypot(f.x - cf.x, f.y - cf.y) < 30) mob++;
      }
      M.mob.push(mob);
    }
  }
  // blocked defenders at t=1000: within 16px of an offensive blocker (OL/TE/WR)
  const T0 = 1000;
  const offB = log.actors.filter(x => x.id.startsWith("off"));
  let blocked = 0;
  for (const x of log.actors) {
    if (!x.id.startsWith("def")) continue;
    const f = x.frames.filter(g => g.t <= T0).pop(); if (!f) continue;
    for (const o of offB) {
      const of = o.frames.filter(g => g.t <= T0).pop();
      if (of && Math.hypot(of.x - f.x, of.y - f.y) < 15) { blocked++; break; }
    }
  }
  M.blockedAt1s.push(blocked);
}
const stat = (a) => { const s = a.slice().sort((x, y) => x - y); const n = s.length || 1;
  return { mean: +(a.reduce((p, q) => p + q, 0) / n).toFixed(2), p50: s[n >> 1], p90: s[Math.floor(n * .9)] }; };
// histogram + how the 20+ runs got out
const H = {}; for (const y of M.yards) { const b = y < 0 ? "<0" : y < 3 ? "0-2" : y < 6 ? "3-5" : y < 10 ? "6-9" : y < 20 ? "10-19" : y < 40 ? "20-39" : "40+"; H[b] = (H[b] || 0) + 1; }
console.log("yards histogram:", JSON.stringify(H));
console.log(JSON.stringify({
  plays: M.plays, ypc: +(M.yards.reduce((a, b) => a + b, 0) / M.plays).toFixed(2),
  tflPct: +(M.tfl / M.plays * 100).toFixed(1), tenPct: +(M.ten / M.plays * 100).toFixed(1), twentyPct: +(M.twenty / M.plays * 100).toFixed(1),
  contactsPerPlay: stat(M.contacts), mobAtWhistle: stat(M.mob), firstContactToEndMs: stat(M.firstToEnd),
  blockedDefAt1s: stat(M.blockedAt1s),
  stops: { solo: M.solo, gang: M.gang, none: M.none, gangPct: +(M.gang / Math.max(1, M.solo + M.gang) * 100).toFixed(1) },
  evasionsPer100Plays: Object.fromEntries(Object.entries(M.evasions).map(([k, v]) => [k, +(v / M.plays * 100).toFixed(0)])),
}, null, 1))

// ---- verdict
const fails = [];
const ok = (c, label, detail) => { console.log(`${c ? "ok  " : "FAIL"} ${label}  ${detail}`); if (!c) fails.push(label); };
const ypc = M.yards.reduce((a, b) => a + b, 0) / M.plays;
const mob = stat(M.mob), cts = stat(M.contacts), blk = stat(M.blockedAt1s), f2e = stat(M.firstToEnd);
const gangPct = M.gang / Math.max(1, M.solo + M.gang) * 100;
ok(blk.mean >= 6.5, "a run play blocks most of the defense", `${blk.mean} defenders on a block at 1s (>= 6.5)`);
ok(mob.mean <= 3.2 && mob.p90 <= 4, "no eight-man piles at the whistle", `mean ${mob.mean}, p90 ${mob.p90} defenders within 30px`);
ok(cts.mean <= 1.75 && cts.p50 <= 1, "one or two contacts settle a play", `mean ${cts.mean}, median ${cts.p50}`);
ok(f2e.mean <= 420, "first contact to whistle stays tight", `${f2e.mean}ms mean`);
ok(gangPct >= 18 && gangPct <= 42, "solo/gang split holds near the 70/30 design", `${gangPct.toFixed(1)}% gang`);
ok(ypc >= 5.0 && ypc <= 9.2, "raw YPC stays in the calibration corridor", `${ypc.toFixed(2)} (movementcheck gates the exact band)`);
ok(M.tfl / M.plays >= 0.025, "TFLs exist", `${(M.tfl / M.plays * 100).toFixed(1)}%`);
ok(M.twenty / M.plays <= 0.12, "the 20+ tail is a tail", `${(M.twenty / M.plays * 100).toFixed(1)}%`);
ok((M.stalks || 0) >= N * 1.2, "receivers actually stalk-block the corners", `${M.stalks} stalk engagements over ${N} plays`);
ok((M.sheds || 0) >= N * 0.5, "and the blocks get SHED, not welded", `${M.sheds} shed-block events`);
if (fails.length) { console.log("\nFAILED: " + fails.join(", ")); process.exit(1); }
console.log("\nall good");
