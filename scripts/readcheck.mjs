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

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
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
  const m = { n: 0, yds: 0, long: 0, untouched80: 0, reads: [], lb: [], cb: [], bites: 0, blocks: { push: 0, drive: 0, lost: 0 }, pancakes: 0, holes: 0, jobPlays: 0, lookPlays: 0, simul: 0 };
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
  }
  return { concept, ypc: +(m.yds / m.n).toFixed(2), longPct: +(m.long / m.n * 100).toFixed(1), untouched80: m.untouched80,
    readAvg: Math.round(avg(m.reads)), readSd: Math.round(sd(m.reads)), lbRead: Math.round(avg(m.lb)), cbRead: Math.round(avg(m.cb)),
    lookPct: +(m.lookPlays / m.n * 100).toFixed(0), simultaneousPct: +(m.simul / m.n * 100).toFixed(0),
    bitesPerPlay: +(m.bites / m.n).toFixed(2), blocksPerPlay: +((m.blocks.push + m.blocks.drive) / m.n).toFixed(2), lostPerPlay: +(m.blocks.lost / m.n).toFixed(2),
    pancakesPerPlay: +(m.pancakes / m.n).toFixed(3), holePct: +(m.holes / m.n * 100).toFixed(0), jobPct: +(m.jobPlays / m.n * 100).toFixed(0) };
}
function passes(seed, pa, defOver = {}) {
  const ctx = runtime(seed), concepts = ["dropback", "shot", "dropback", "quick"];
  const m = { n: 0, comp: 0, yds: 0, bites: 0, fakes: 0 };
  for (let i = 0; i < N; i++) {
    const off = POS_OFF.map((p, j) => player(p, j, "off")), def = POS_DEF.map((p, j) => player(p, j, "def", defOver));
    const qb = off[8], wr = off.filter(p => p.pos === "WR")[i % 3], cb = def.filter(p => p.pos === "CB")[i % 2];
    const out = ctx.__FieldSim._sim("pass", off, def, att, { target: wr, cover: cb, off: { 8: qb, 0: wr }, def: { 0: cb } }, { concept: concepts[i % 4], pa, fieldPos: 40, down: 1, toGo: 10 });
    m.n++; if (out.log.events.some(e => e.type === "catch")) { m.comp++; m.yds += out.yards; }
    m.bites += out.log.events.filter(e => e.type === "keyBite").length;
    if (out.log.events.some(e => e.type === "playfake")) m.fakes++;
  }
  return { pa, compPct: +(m.comp / m.n * 100).toFixed(1), ypa: +(m.yds / m.n).toFixed(2), bitesPerPlay: +(m.bites / m.n).toFixed(2), fakePct: +(m.fakes / m.n * 100).toFixed(0) };
}

const R = { inside: runs(0xC0FFEE, "inside"), power: runs(0xC0FFEE, "power"), sweep: runs(0xC0FFEE, "sweep"), draw: runs(0xC0FFEE, "draw"),
  lowIQ: runs(0xC0FFEE, "inside", { awareness: 30, discipline: 30 }, {}, N * 2), highIQ: runs(0xC0FFEE, "inside", { awareness: 90, discipline: 90 }, {}, N * 2),
  drawLowIQ: runs(0xBEEF, "draw", { awareness: 30, discipline: 30 }), drawHighIQ: runs(0xBEEF, "draw", { awareness: 90, discipline: 90 }),
  bigOL: runs(0xC0FFEE, "inside", {}, { blocking: 88, strength: 88 }) };
const Pz = { plain: passes(0xBEEF, false), pa: passes(0xBEEF, true), paLowIQ: passes(0xBEEF, true, { awareness: 30, discipline: 30 }), paHighIQ: passes(0xBEEF, true, { awareness: 90, discipline: 90 }) };
const mixed = +((R.inside.ypc * .49 + R.sweep.ypc * .21 + R.power.ypc * .15 + R.draw.ypc * .15)).toFixed(2);   // roughly the play-caller's mix
console.log(JSON.stringify({ runs: R, passes: Pz, mixedYpc: mixed }, null, 1));

const fails = [];
const ok = (c, msg) => { console.log((c ? "ok   " : "FAIL ") + msg); if (!c) fails.push(msg); };
ok(R.inside.lookPct === 100, `every run play announces who is still looking (${R.inside.lookPct}%)`);
ok(R.inside.simultaneousPct === 0 && R.inside.readSd >= 40, `reads are spread, not simultaneous (sd ${R.inside.readSd}ms, ${R.inside.simultaneousPct}% same-tick)`);
ok(R.inside.lbRead < R.inside.cbRead - 60, `linebackers read before corners (${R.inside.lbRead} vs ${R.inside.cbRead}ms)`);
ok(R.highIQ.readAvg < R.inside.readAvg - 60 && R.inside.readAvg < R.lowIQ.readAvg - 40, `awareness orders the read (${R.highIQ.readAvg} < ${R.inside.readAvg} < ${R.lowIQ.readAvg}ms)`);
ok(R.draw.readAvg > R.inside.readAvg + 300, `a draw is read later than a straight run (${R.draw.readAvg} vs ${R.inside.readAvg}ms)`);
ok(R.draw.bitesPerPlay >= 0.6 && R.inside.bitesPerPlay === 0, `draws draw bites (${R.draw.bitesPerPlay}/play), straight runs do not (${R.inside.bitesPerPlay})`);
ok(R.drawHighIQ.bitesPerPlay * 2.5 < R.drawLowIQ.bitesPerPlay, `discipline resists the draw (${R.drawHighIQ.bitesPerPlay} vs ${R.drawLowIQ.bitesPerPlay} bites/play)`);
ok(Pz.pa.fakePct >= 95 && Pz.plain.bitesPerPlay === 0 && Pz.pa.bitesPerPlay >= 0.6, `play action fakes and gets bitten on (${Pz.pa.fakePct}% faked, ${Pz.pa.bitesPerPlay} bites/play)`);
ok(Pz.paHighIQ.bitesPerPlay * 2.5 < Pz.paLowIQ.bitesPerPlay, `discipline resists play action (${Pz.paHighIQ.bitesPerPlay} vs ${Pz.paLowIQ.bitesPerPlay} bites/play)`);
ok(Pz.pa.ypa >= Pz.plain.ypa - 0.3, `play action pays out at least even with a straight dropback (${Pz.pa.ypa} vs ${Pz.plain.ypa} YPA)`);
ok(R.inside.blocksPerPlay >= 0.6 && R.inside.blocksPerPlay <= 3.5, `blocks are won at the point of attack (${R.inside.blocksPerPlay} push+drive per play)`);
ok(R.inside.pancakesPerPlay > 0 && R.inside.pancakesPerPlay <= 0.06, `pancakes happen and stay rare (${R.inside.pancakesPerPlay}/play)`);
ok(R.bigOL.pancakesPerPlay > R.inside.pancakesPerPlay * 2 && R.bigOL.blocksPerPlay > R.inside.blocksPerPlay, `a dominant line wins more and flattens more (${R.bigOL.pancakesPerPlay}/play, ${R.bigOL.blocksPerPlay} wins)`);
ok(R.inside.holePct >= 35, `the designed hole opens on a real share of runs (${R.inside.holePct}%)`);
ok(R.inside.jobPct >= 60, `linemen and receivers find second-level blocks (${R.inside.jobPct}% of plays)`);
ok(mixed >= 5.5 && mixed <= 10.5, `mixed-concept YPC stays a football number (${mixed})`);
ok(R.highIQ.ypc < R.lowIQ.ypc, `a smarter defence gives up less (${R.highIQ.ypc} vs ${R.lowIQ.ypc} YPC)`);
ok(Math.max(R.inside.longPct, R.power.longPct, R.sweep.longPct) <= 12, `the long tail is a tail (max ${Math.max(R.inside.longPct, R.power.longPct, R.sweep.longPct)}% of runs go 25+)`);
const untouched = Object.values(R).reduce((n, r) => n + r.untouched80, 0), sampled = Object.values(R).length * N + 2 * N;
// a chain of bad angles (the force corner bites on a cutback, the filling safety is
// stalk-blocked, the linebacker chases from behind) can let one go untouched — that is
// football, at about one in two thousand; a pattern is not
ok(untouched <= 2, `an untouched 80 is a freak, not a pattern (${untouched} in ~${sampled} runs)`);
console.log(fails.length ? `VERDICT: FAIL (${fails.length})` : "VERDICT: PASS");
process.exitCode = fails.length ? 1 : 0;
