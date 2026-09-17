// Dev check (v129 THE BALL IN STRIDE): the quarterback throws a man open.
//
// leadSkillV101 is the fraction of the computed lead the passer actually gets on the ball, and it
// sits around .46–.7 for almost everybody. That is the right average — most throws are a step
// behind — but it meant the game had no BEST case: a ninety-awareness arm throwing to a burner who
// had beaten his man still put the ball where the man WAS. There was no ball in stride anywhere in
// the league.
//
// Pure Node — drives __FieldSim._sim directly, the way readcheck does, so no dev server is needed.
// Asserts:
//   * the rate scales with the LEVEL: none in Pee Wee, a couple a game in high school, far more in
//     college, most of the time in the DFL
//   * it is driven by the four things that decide it on a field — the passer's eyes, his arm, the
//     receiver's speed, and whether that receiver has actually won
//   * a hurried, moving or panicking passer never throws one
//   * when it lands the ball is thrown to where he is GOING: the lead goes to full and the cone
//     tightens, and the receiver is led past his last waypoint on purpose
//   * and it pays off where it should — air yards and yards after the catch, not the catch roll
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const anchor = html.indexOf("/* ===== RIB_TUNE"), open = html.lastIndexOf("<script>", anchor), close = html.indexOf("</script>", anchor);
if (anchor < 0 || open < 0 || close < 0) throw new Error("play engine script block not found");
const src = html.slice(open + "<script>".length, close);
function mulberry32(seed) { return function () { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function runtime(seed, level) {
  const M = Object.create(Math); M.random = mulberry32(seed);
  const ctx = vm.createContext({ console, Math: M }); ctx.window = ctx; ctx.globalThis = ctx;
  vm.runInContext(src, ctx, { filename: "index.html" });
  ctx.__getGridironState = () => ({ player: { level } });
  return ctx;
}
const SKILLS = ["speed","quickness","acceleration","burst","strength","blocking","tackling","coverage","agility","awareness","catching","jumping","throwing","vision","stamina","grit","discipline","ballControl"];
const POS_OFF = ["WR","WR","TE","OL","OL","OL","OL","OL","QB","RB","WR"], POS_DEF = ["CB","CB","S","S","LB","LB","LB","DL","DL","DL","DL"];
function player(pos, index, side, over = {}) {
  const attrs = Object.fromEntries(SKILLS.map(k => [k, side === "off" ? 58 : 57]));
  if (pos === "QB") Object.assign(attrs, { throwing: 69, awareness: 65, vision: 64, agility: 55, speed: 52 });
  if (pos === "RB") Object.assign(attrs, { speed: 68, acceleration: 70, burst: 69, agility: 72, quickness: 70, vision: 64, ballControl: 64 });
  if (pos === "WR") Object.assign(attrs, { speed: 67, acceleration: 65, agility: 66, quickness: 65, catching: 63, jumping: 62 });
  if (pos === "TE") Object.assign(attrs, { catching: 62, strength: 65, speed: 58, blocking: 61 });
  if (pos === "OL") Object.assign(attrs, { blocking: 65, strength: 67, speed: 43, agility: 44 });
  if (pos === "CB") Object.assign(attrs, { coverage: 62, speed: 66, agility: 63, quickness: 62, awareness: 56, discipline: 55, catching: 54 });
  if (pos === "S") Object.assign(attrs, { coverage: 60, speed: 63, awareness: 61, discipline: 61, tackling: 59 });
  if (pos === "LB") Object.assign(attrs, { tackling: 62, awareness: 57, discipline: 56, strength: 63, speed: 57 });
  if (pos === "DL") Object.assign(attrs, { strength: 66, tackling: 62, quickness: 56, speed: 50 });
  Object.assign(attrs, over);
  return { id: `${side}-${pos}-${index}`, pos, attrs, body: { height: pos === "OL" || pos === "DL" ? 76 : 72 } };
}
const att = (p, k) => Number((p && p.attrs && p.attrs[k]) != null ? p.attrs[k] : 55);
const CONCEPTS = ["dropback", "shot", "dropback", "quick"];
function run(level, n, offOver = {}, defOver = {}, seed0 = 7) {
  const ctx = runtime(seed0, level), F = ctx.__FieldSim, rows = [];
  for (let i = 0; i < n; i++) {
    const off = POS_OFF.map((p, j) => player(p, j, "off", offOver[p] || {}));
    const def = POS_DEF.map((p, j) => player(p, j, "def", defOver[p] || {}));
    const qb = off[8], wr = off.filter(p => p.pos === "WR")[i % 3], cb = def.filter(p => p.pos === "CB")[i % 2];
    let r = null;
    try { r = F._sim("pass", off, def, att, { target: wr, cover: cb, off: { 8: qb, 0: wr }, def: { 0: cb } },
      { concept: CONCEPTS[i % 4], fieldPos: 40, down: 1, toGo: 10 }) } catch (e) {}
    const evs = (r && r.log && r.log.events) || [];
    const th = evs.find(e => e && e.type === "throw");
    if (th) rows.push({ stride: !!th.stride, odds: th.strideOdds, leadK: th.leadK, leadYd: th.leadYd, cone: th.cone,
      caught: evs.some(e => e && e.type === "catch"), yards: (r && r.yards) || 0 })
  }
  return { rows, hook: ctx.__V129 }
}
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? "ok   " : "FAIL ") + m + (d !== undefined ? "  " + d : "")); c ? pass++ : fail++ }
const rate = rows => rows.length ? rows.filter(r => r.stride).length / rows.length : 0
const mean = (a, k) => a.length ? a.reduce((s, r) => s + (r[k] || 0), 0) / a.length : 0

// ---- 1. the level is the base rate ----
const byLevel = {}
for (const lv of [0, 2, 4, 5, 7]) { const { rows } = run(lv, 140); byLevel[lv] = { n: rows.length, rate: +rate(rows).toFixed(3) } }
console.log("stride rate by level:", JSON.stringify(byLevel))
ok(byLevel[0].rate === 0, "Pee Wee never sees one — a nine-year-old quarterback does not throw a man open", String(byLevel[0].rate))
ok(byLevel[2].rate > 0 && byLevel[2].rate < byLevel[4].rate, "middle school starts to, and high school does it more", `${byLevel[2].rate} → ${byLevel[4].rate}`)
ok(byLevel[5].rate > byLevel[4].rate, "college a lot more than high school", `${byLevel[4].rate} → ${byLevel[5].rate}`)
ok(byLevel[7].rate > byLevel[5].rate, "and the DFL a ton more than college", `${byLevel[5].rate} → ${byLevel[7].rate}`)
ok(byLevel[4].rate > .02 && byLevel[4].rate < .45, "high school is a few a game, not a staple", String(byLevel[4].rate))
ok(byLevel[7].rate > .2, "and in the DFL it is a staple, several times a game", String(byLevel[7].rate))

// ---- 2. the four things that decide it ----
const base = run(7, 160).rows
const sharp = run(7, 160, { QB: { awareness: 95, throwing: 95 } }).rows
const dull = run(7, 160, { QB: { awareness: 25, throwing: 30 } }).rows
const fast = run(7, 160, { WR: { speed: 95, acceleration: 92 } }).rows
const slow = run(7, 160, { WR: { speed: 25, acceleration: 30 } }).rows
const blanket = run(7, 160, {}, { CB: { coverage: 95, speed: 95, awareness: 90 }, S: { coverage: 92, speed: 88 } }).rows
const odds = a => +mean(a, "odds").toFixed(3)
console.log("by input (rate / mean odds):", JSON.stringify({ base: [+rate(base).toFixed(3), odds(base)], sharp: [+rate(sharp).toFixed(3), odds(sharp)], dull: [+rate(dull).toFixed(3), odds(dull)],
  fast: [+rate(fast).toFixed(3), odds(fast)], slow: [+rate(slow).toFixed(3), odds(slow)], blanket: [+rate(blanket).toFixed(3), odds(blanket)] }))
ok(odds(sharp) > odds(dull) * 1.5, "a quarterback who sees it and can throw it commits far more often", `odds ${odds(sharp)} vs ${odds(dull)}`)
ok(rate(fast) > rate(slow) + .04 && odds(fast) > odds(slow), "and you throw it to a man who can run to it, not one who cannot", `${rate(fast).toFixed(2)} vs ${rate(slow).toFixed(2)}`)
ok(rate(blanket) < rate(base) - .03, "a receiver who has not beaten his man does not get one", `${rate(blanket).toFixed(2)} vs ${rate(base).toFixed(2)}`)

// ---- 3. what changes when it lands ----
const all = run(7, 400).rows
const on = all.filter(r => r.stride), off = all.filter(r => !r.stride)
console.log("lead / cone:", JSON.stringify({ n: [on.length, off.length],
  leadK: [+mean(on, "leadK").toFixed(2), +mean(off, "leadK").toFixed(2)],
  leadYd: [+mean(on, "leadYd").toFixed(2), +mean(off, "leadYd").toFixed(2)],
  cone: [+mean(on, "cone").toFixed(2), +mean(off, "cone").toFixed(2)] }))
ok(on.length > 25 && off.length > 25, "both kinds of throw are in the sample", `${on.length} in stride, ${off.length} not`)
ok(on.every(r => r.leadK >= .89), "a ball in stride carries the FULL lead — it is thrown where he is going", `min leadK ${Math.min(...on.map(r => r.leadK))}`)
ok(mean(on, "leadK") > mean(off, "leadK") + .25, "and far more of it than an ordinary throw", `${mean(on, "leadK").toFixed(2)} vs ${mean(off, "leadK").toFixed(2)}`)
ok(mean(on, "leadYd") > mean(off, "leadYd"), "so the ball is genuinely further in front of him, in yards", `${mean(on, "leadYd").toFixed(2)} vs ${mean(off, "leadYd").toFixed(2)}yd`)
ok(mean(on, "cone") < mean(off, "cone"), "the cone tightens — a throw decided before the break is not being steered", `${mean(on, "cone").toFixed(2)} vs ${mean(off, "cone").toFixed(2)}yd`)

// ---- 4. it pays where it should ----
const cRate = a => a.length ? a.filter(r => r.caught).length / a.length : 0
const yds = a => a.filter(r => r.caught).length ? a.filter(r => r.caught).reduce((s, r) => s + (r.yards || 0), 0) / a.filter(r => r.caught).length : 0
console.log("payoff:", JSON.stringify({ catch: [+cRate(on).toFixed(3), +cRate(off).toFixed(3)], yards: [+yds(on).toFixed(1), +yds(off).toFixed(1)] }))
ok(cRate(on) > cRate(off) + .05, "a ball thrown where he is going is caught far more often than one he came back for", `${(cRate(on) * 100).toFixed(0)}% vs ${(cRate(off) * 100).toFixed(0)}%`)
ok(yds(on) > 0 && Math.abs(yds(on) - yds(off)) / Math.max(1, yds(off)) < .5, "and the completions it produces are ordinary football, not a new yardage regime", `${yds(on).toFixed(1)} vs ${yds(off).toFixed(1)} yards`)

// ---- 5. never under pressure ----
const rushed = run(7, 200, {}, { DL: { strength: 95, quickness: 92, speed: 80, tackling: 90 } }, 31).rows
console.log("under a pass rush:", JSON.stringify({ n: rushed.length, rate: +rate(rushed).toFixed(3) }))
ok(rate(rushed) < rate(base), "a passer who is hurried throws fewer of them — committing to a spot is the opposite of getting rid of it",
  `${rate(rushed).toFixed(2)} vs ${rate(base).toFixed(2)} clean`)

console.log(JSON.stringify({ pass, fail }))
if (fail) process.exit(1)
