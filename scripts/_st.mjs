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
import { readGameHtml } from './lib/layout.mjs'   // v149 A: index.html + src/ put back together

const html = readGameHtml();
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


for (const sd of [7, 11, 12, 13]) { const o = {}; for (const lv of [4, 5, 7]) { const { rows } = run(lv, +process.env.SN || 400, {}, {}, sd); o[lv] = [rows.length, +rate(rows).toFixed(3), +mean(rows.filter(r=>r.odds!=null),'odds').toFixed(3)] } console.log(sd, JSON.stringify(o)) }
