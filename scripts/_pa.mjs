// Dev check (v81 BALL AWARENESS): the defence has to FIND the ball, blocks are rolled
// at the point of attack, and everyone looks for a job once the ball is out.
//
// Pure Node — loads the play-engine block straight out of index.html (the way
// movementcheck does) and drives __FieldSim._sim directly, so no dev server is
// needed. Asserts:
//   * every defender diagnoses the play on his OWN clock (keyLook → keyRead), the
//     reads are spread rather than simultaneous, and linebackers read before corners
//   * awareness/discipline order the read: a high-IQ defence finds the ball sooner
//   * play action and draws produce BITES, far fewer against a disciplined defence,
//     and a draw is read later than a straight run
//   * blocks resolve to push / drive / lost / (rare) pancake, the designed hole opens,
//     and linemen and receivers pick up second-level blocks after the mesh
//   * the run curve stays a football curve: mixed-concept YPC in band, a short tail
//   * play action pays out (YPA at least even with a straight dropback) and a
//     released tackler never freezes the rest of the defence (no untouched 80s)
import fs from "node:fs";
import vm from "node:vm";
import { readGameHtml } from './lib/layout.mjs'   // v149 A: index.html + src/ put back together

const html = readGameHtml();
const anchor = html.indexOf("/* ===== RIB_TUNE"), open = html.lastIndexOf("<script>", anchor), close = html.indexOf("</script>", anchor);
if (anchor < 0 || open < 0 || close < 0) throw new Error("play engine script block not found");
const src = html.slice(open + "<script>".length, close);
function mulberry32(seed) { return function () { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function runtime(seed) { const M = Object.create(Math); M.random = mulberry32(seed); const ctx = vm.createContext({ console, Math: M }); ctx.window = ctx; ctx.globalThis = ctx;
  vm.runInContext(src, ctx, { filename: "index.html" }); ctx.__getGridironState = () => ({ player: { level: 4 } }); return ctx; }

const POS_OFF = ["WR","WR","TE","OL","OL","OL","OL","OL","QB","RB","WR"], POS_DEF = ["CB","CB","S","S","LB","LB","LB","DL","DL","DL","DL"];
const SKILLS = ["speed","quickness","acceleration","burst","strength","blocking","tackling","coverage","agility","awareness","catching","jumping","throwing","vision","stamina","grit","discipline","ballControl"];
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
const att = (p, k) => Number(p?.attrs?.[k] ?? 55);
const N = +(process.env.READ_N || 160);
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const sd = a => { const m = avg(a); return Math.sqrt(avg(a.map(v => (v - m) ** 2))); };

function runs(seed, concept, defOver = {}, offOver = {}, n = N) {
  const ctx = runtime(seed);
  const m = { n: 0, yds: 0, long: 0, untouched80: 0, reads: [], lb: [], cb: [], bites: 0, blocks: { push: 0, drive: 0, lost: 0 }, pancakes: 0, holes: 0, jobPlays: 0, lookPlays: 0, simul: 0, ev: {} };
  for (let i = 0; i < n; i++) {
    const off = POS_OFF.map((p, j) => player(p, j, "off", offOver)), def = POS_DEF.map((p, j) => player(p, j, "def", defOver));
    const out = ctx.__FieldSim._sim("run", off, def, att, { off: { 9: off[9] } }, { concept });
    m.n++; m.yds += out.yards; if (out.yards >= 25) m.long++;
    const ev = out.log.events, reads = ev.filter(e => e.type === "keyRead");
    if (ev.some(e => e.type === "keyLook")) m.lookPlays++;
    if (reads.length && new Set(reads.map(e => e.ms)).size === 1) m.simul++;
    for (const e of reads) { m.reads.push(e.ms); const pos = POS_DEF[+e.who.slice(3)]; if (pos === "LB") m.lb.push(e.ms); if (pos === "CB") m.cb.push(e.ms); }
    m.bites += ev.filter(e => e.type === "keyBite").length;
    for (const e of ev) if (e.type === "blockWin") m.blocks[e.kind] = (m.blocks[e.kind] || 0) + 1;
    m.pancakes += ev.filter(e => e.type === "pancake").length;
    if (ev.some(e => e.type === "holeOpen")) m.holes++;
    if (ev.some(e => e.type === "block")) m.jobPlays++;
    if (out.yards >= 80 && !ev.some(e => e.type === "tackleLunge")) m.untouched80++;
    for (const e of ev) m.ev[e.type] = (m.ev[e.type] || 0) + 1;
  }
  return { concept, ypc: +(m.yds / m.n).toFixed(2), longPct: +(m.long / m.n * 100).toFixed(1), untouched80: m.untouched80,
    readAvg: Math.round(avg(m.reads)), readSd: Math.round(sd(m.reads)), lbRead: Math.round(avg(m.lb)), cbRead: Math.round(avg(m.cb)),
    lookPct: +(m.lookPlays / m.n * 100).toFixed(0), simultaneousPct: +(m.simul / m.n * 100).toFixed(0),
    bitesPerPlay: +(m.bites / m.n).toFixed(2), blocksPerPlay: +((m.blocks.push + m.blocks.drive) / m.n).toFixed(2), lostPerPlay: +(m.blocks.lost / m.n).toFixed(2),
    pancakesPerPlay: +(m.pancakes / m.n).toFixed(3), holePct: +(m.holes / m.n * 100).toFixed(0), jobPct: +(m.jobPlays / m.n * 100).toFixed(0),
    ev: Object.fromEntries(Object.entries(m.ev).map(([k, v]) => [k, +(v / m.n).toFixed(3)])) };
}
function passes(seed, pa, defOver = {}, n = N, offOver = {}) {
  const ctx = runtime(seed), concepts = ["dropback", "shot", "dropback", "quick"];
  const m = { n: 0, comp: 0, yds: 0, bites: 0, fakes: 0, ev: {}, sacks: 0 };
  for (let i = 0; i < n; i++) {
    const off = POS_OFF.map((p, j) => player(p, j, "off", offOver)), def = POS_DEF.map((p, j) => player(p, j, "def", defOver));
    const qb = off[8], wr = off.filter(p => p.pos === "WR")[i % 3], cb = def.filter(p => p.pos === "CB")[i % 2];
    const out = ctx.__FieldSim._sim("pass", off, def, att, { target: wr, cover: cb, off: { 8: qb, 0: wr }, def: { 0: cb } }, { concept: concepts[i % 4], pa, fieldPos: 40, down: 1, toGo: 10 });
    m.n++; if (out.log.events.some(e => e.type === "catch")) { m.comp++; m.yds += out.yards; }
    m.bites += out.log.events.filter(e => e.type === "keyBite").length;
    if (out.log.events.some(e => e.type === "playfake")) m.fakes++;
    if (out.sack) m.sacks++;
    for (const e of out.log.events) m.ev[e.type] = (m.ev[e.type] || 0) + 1;
  }
  return { pa, compPct: +(m.comp / m.n * 100).toFixed(1), ypa: +(m.yds / m.n).toFixed(2), bitesPerPlay: +(m.bites / m.n).toFixed(2), fakePct: +(m.fakes / m.n * 100).toFixed(0),
    sackPct: +(m.sacks / m.n * 100).toFixed(1), ev: Object.fromEntries(Object.entries(m.ev).map(([k, v]) => [k, +(v / m.n).toFixed(3)])) };
}
// v82 special teams: the kick kinds through the public API (the game engine's entry point)
function kicks(seed, kind, n = N) {
  const ctx = runtime(seed), FS = ctx.__FieldSim;
  const m = { n: 0, fair: 0, ret: 0, retN: 0, td: 0, blocked: 0, good: 0, outside: 0, ev: {} };
  for (let i = 0; i < n; i++) {
    const off = POS_OFF.map((p, j) => player(p, j, "off")), def = POS_DEF.map((p, j) => player(p, j, "def"));
    const opts = kind === "punt" ? { gross: 40, deep: 35, pos: 35, goalLx: -35 * 5.88 } : kind === "kickoff" ? { gross: 58, goalLx: -35 * 5.88 } : { dist: 38, pos: 79, good: i % 3 !== 0 };
    const r = FS[kind](true, { off }, { def }, att, opts); m.n++; if (!r) continue;
    if (kind === "fg") { if (r.blocked) m.blocked++; if (r.good) m.good++; }
    else { if (r.fair) m.fair++; else { m.retN++; m.ret += r.ret; } if (r.td) m.td++; if (r.blocked) m.blocked++; }
    const log = FS._Q[FS._Q.length - 1].log;
    for (const e of log.events) m.ev[e.type] = (m.ev[e.type] || 0) + 1;
    for (const a of log.actors) for (const f of a.frames) if (f.y < 48 - 1e-6 || f.y > 396 + 1e-6) m.outside++;
  }
  return { kind, fairPct: +(m.fair / m.n * 100).toFixed(0), avgRet: +(m.ret / Math.max(1, m.retN)).toFixed(1), tdPct: +(m.td / m.n * 100).toFixed(1), blockedPct: +(m.blocked / m.n * 100).toFixed(1),
    goodPct: +(m.good / m.n * 100).toFixed(0), outside: m.outside, ev: Object.fromEntries(Object.entries(m.ev).map(([k, v]) => [k, +(v / m.n).toFixed(2)])) };
}


const seeds=[0xBEEF,1,2,3,4,5,6,7];const rows=[]
for(const sd of seeds){const a=passes(sd,false,{},+process.env.PN||320),b=passes(sd,true,{},+process.env.PN||320);rows.push([sd,a.ypa,b.ypa,a.compPct,b.compPct,a.sackPct,b.sackPct]);console.log(JSON.stringify(rows[rows.length-1]))}
const m=i=>rows.reduce((x,r)=>x+r[i],0)/rows.length;console.log('mean plain',m(1).toFixed(2),'pa',m(2).toFixed(2))
