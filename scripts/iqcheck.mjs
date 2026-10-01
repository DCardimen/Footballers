// v165 A / B check: THE MIND HAS NO CEILING + FOOTBALL IQ. Loads the engine without the image payloads
// (no dev server), patches makeAgents to hand back the agents it built, and asserts:
//   1. a you-RB's mind keys clear the old carrier ceiling (72) and keep climbing 250 -> 400 -> 999 as
//      effective IQ (awareE / visE), while his BODY keys keep the v141 ceiling;
//   2. the level's football sense lands on every AI man (awareE - aware = iqLvlPtsV165B[level]);
//   3. a sharp man is consistent: his per-snap speed swing narrows with awareness;
//   4. the decisions read it, on paired seeds: a 600-mind QB throws to the best read he saw more often
//      than a 120-mind one; a 600-mind back reads the open field past the line (v165 C) where a 120-mind
//      one weaves, and gains more a carry for it — but not 1.4x (the carrier ceiling's reason stands);
//   4b. v165 F: a 600-mind receiver's separation after the break beats a 120-mind one's;
//   4c. v165 H: a sharp corner's pick odds as the ball man rise with the eyes on (same seeds, under the cap);
//   5. the kill switch (v165Biq 0, v165Amind 0) gives back the bare ratings everywhere.
// Usage: node scripts/iqcheck.mjs   (GAMES per outcome cell via GAMES, default 10)
import { gameScripts } from './lib/layout.mjs'
import { launch } from './lib/env.mjs'
const needle = 'return { off, def, all: off.concat(def), formV164P };'
const patch = 'if(root.__AP){root.__AP.push(off.concat(def).map(a=>({lb:a.lb,you:!!(a.player&&a.player.you),aware:a.aware,vis:a.vis,disc:a.disc,str:a.str,spdA:a.spdA,awareE:a.awareE,visE:a.visE,discE:a.discE})))}' + needle
let hit = 0
const runtime = gameScripts(['inline:0', 'inline:1', 'inline:2', 'src/03-splash.js', 'src/04-engine.js', 'src/07-career-app.js']).map(s => {
  let l = s.replace(/data:image\/[^;"']+;base64,[A-Za-z0-9+/=]+/g, 'data:image/png;base64,')
  if (l.includes(needle)) { l = l.replace(needle, patch); hit++ }
  return l
})
if (!hit) throw new Error('could not patch makeAgents')
const browser = await launch()
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.setContent(`<!doctype html><html><body><div id="splash"><div class="splash-title"><b></b></div></div><div id="app"><span id="prestigeCount"></span><span id="ppCount"></span><div id="screen"></div><div id="dock"></div></div><div id="pwaStatus"></div><div id="toast"></div><div id="cinemaFlash"></div><div id="momentBanner"></div></body></html>`)
for (const s of runtime) await page.addScriptTag({ content: s })
await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && typeof window.__getGridironState === 'function')
const GAMES = Math.max(4, Number(process.env.GAMES || 10))
const out = await page.evaluate((GAMES) => {
  const st = window.__getGridironState(); st.prestige = 0; st.tree = {}; st.rosterPrestigeV158 = {}; st._tempStatBuffsV25 = null
  window.__youStatBoostPctV20 = 0; window.__youTempBuffsV25 = null; window.__gameScriptBiasV23 = null
  const names = ['speed', 'acceleration', 'quickness', 'agility', 'strength', 'catching', 'throwing', 'tackling', 'blocking', 'awareness', 'vision', 'grit', 'stamina', 'jumping', 'ballControl', 'discipline', 'injuryResist']
  const flat = v => Object.fromEntries(names.map(n => [n, v]))
  const mind = (body, m) => Object.assign(flat(body), { awareness: m, vision: m, discipline: m })
  let seed = 0
  const reseed = s => { seed = s; Math.random = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let v = Math.imul(seed ^ seed >>> 15, 1 | seed); v = v + Math.imul(v ^ v >>> 7, 61 | v) ^ v; return ((v ^ v >>> 14) >>> 0) / 4294967296 } }
  const tune = on => { window.RIB_TUNE = window.RIB_TUNE || {}; window.RIB_TUNE.v165Biq = on; window.RIB_TUNE.v165Amind = on }
  const mean = (a, k) => a.length ? a.reduce((s, x) => s + x[k], 0) / a.length : null
  const sd = (a, k) => { const m = mean(a, k); return Math.sqrt(a.reduce((s, x) => s + (x[k] - m) ** 2, 0) / Math.max(1, a.length - 1)) }
  const run = (level, pos, attrs, n, s0) => {
    st.player = { level, pos, name: 'P', attrs }; window.__AP = []
    const V = window.__V165B; V.qbReads = V.qbBest = V.laneReads = V.laneOpen = V.of = V.wrSep = V.wrSepN = V.youIntP = V.youIntN = V.convoy = 0
    let yds = 0, car = 0
    for (let g = 0; g < n; g++) { reseed((s0 || 7000) + g); const r = window.__simGameV2(9 + g, pos); yds += (r.stat && r.stat.rush) || 0; car += (r.stat && r.stat.carries) || 0 }
    const you = [], ai = []; window.__AP.forEach(sn => sn.forEach(a => { (a.you ? you : ai).push(a) }))
    return { you, ai, qbReads: V.qbReads, qbBest: V.qbBest, laneReads: V.laneReads, laneOpen: V.laneOpen, of: V.of, wrSep: V.wrSepN ? V.wrSep / V.wrSepN : null, wrSepN: V.wrSepN, intP: V.youIntN ? V.youIntP / V.youIntN : null, intN: V.youIntN, convoy: V.convoy, ypc: car ? yds / car : 0 }
  }
  const r1 = x => +(+x).toFixed(1), r3 = x => +(+x).toFixed(3)
  const res = { mind: {}, level: [], calm: {}, decide: {}, off: {} }
  tune(1)
  for (const m of [250, 400, 999]) { const x = run(7, 'RB', mind(250, m), 2); res.mind[m] = { vis: r1(mean(x.you, 'vis')), visE: r1(mean(x.you, 'visE')), awareE: r1(mean(x.you, 'awareE')), str: r1(mean(x.you, 'str')) } }
  for (const L of [0, 4, 7, 8]) { const x = run(L, 'LB', flat(200), 1); res.level.push({ L, shift: r1(mean(x.ai, 'awareE') - mean(x.ai, 'aware')), want: window.__V165B.lvlPts[L] }) }
  { const lo = run(7, 'LB', Object.assign(flat(200), { awareness: 40 }), 2, 300), hi = run(7, 'LB', Object.assign(flat(200), { awareness: 400 }), 2, 300)
    res.calm = { sdLo: r1(sd(lo.you, 'spdA')), sdHi: r1(sd(hi.you, 'spdA')) } }
  const qbLo = run(7, 'QB', mind(250, 120), GAMES), qbHi = run(7, 'QB', mind(250, 600), GAMES)
  const rbLo = run(7, 'RB', mind(250, 120), GAMES), rbHi = run(7, 'RB', mind(250, 600), GAMES)
  const wrLo = run(7, 'WR', mind(250, 120), GAMES), wrHi = run(7, 'WR', mind(250, 600), GAMES)
  // v165 H: the same mid corner (sheet 200, mind 300 — under the v76 cap) with the eyes off and on, on the same seeds
  window.RIB_TUNE.v165Heyes = 0; const cbLo = run(7, 'CB', mind(200, 300), GAMES); window.RIB_TUNE.v165Heyes = 1
  const cbHi = run(7, 'CB', mind(200, 300), GAMES)
  res.decide = {
    wrLo: r3(wrLo.wrSep), wrHi: r3(wrHi.wrSep), wrN: wrLo.wrSepN + wrHi.wrSepN,
    intLo: r3(cbLo.intP), intHi: r3(cbHi.intP), intN: cbLo.intN + cbHi.intN,
    qbLo: r3(qbLo.qbBest / Math.max(1, qbLo.qbReads)), qbHi: r3(qbHi.qbBest / Math.max(1, qbHi.qbReads)), qbN: qbLo.qbReads + qbHi.qbReads,
    laneLo: r3(rbLo.laneOpen / Math.max(1, rbLo.laneReads)), laneHi: r3(rbHi.laneOpen / Math.max(1, rbHi.laneReads)), laneN: rbLo.laneReads + rbHi.laneReads,
    ofLo: rbLo.of, ofHi: rbHi.of, convoyHi: rbHi.convoy,
    ypcLo: r1(rbLo.ypc), ypcHi: r1(rbHi.ypc)
  }
  tune(0)
  { const x = run(7, 'RB', mind(250, 999), 1), y = run(0, 'LB', flat(200), 1)
    const all = x.you.concat(x.ai, y.ai)
    res.off = { visMax: Math.max(...x.you.map(a => a.vis)), same: all.every(a => a.awareE === a.aware && a.visE === a.vis && a.discE === a.disc) } }
  tune(1)
  return res
}, GAMES)
await browser.close()
const checks = []
const ok = (name, pass, detail) => checks.push({ name, pass: !!pass, detail })
const M = out.mind
ok(`a you-RB's vision clears the old 72 carrier ceiling at 250 (${M[250].vis})`, M[250].vis > 72)
ok(`his effective vision keeps climbing 250 -> 400 -> 999 (${M[250].visE} -> ${M[400].visE} -> ${M[999].visE})`, M[400].visE > M[250].visE + 10 && M[999].visE > M[400].visE + 5)
ok(`his effective awareness past the wall is headroom (999: ${M[999].awareE})`, M[999].awareE >= 115)
ok(`his body keeps the carrier ceiling (strength ${M[999].str} <= 76)`, M[999].str <= 76)
for (const l of out.level) ok(`level ${l.L}: every AI man's IQ moves by the level's sense (${l.shift} vs ${l.want})`, Math.abs(l.shift - l.want) < 0.05)
ok(`a sharp man is consistent: his speed swing narrows (sd ${out.calm.sdLo} at 40 aware -> ${out.calm.sdHi} at 400)`, out.calm.sdHi < out.calm.sdLo * 0.8)
const D = out.decide
ok(`a 600-mind QB throws to the best read he saw more often (${D.qbLo} -> ${D.qbHi}, ${D.qbN} reads)`, D.qbN >= 60 && D.qbHi >= D.qbLo + 0.06)
ok(`a 600-mind back finds the open lane at least as often (${D.laneLo} -> ${D.laneHi}, ${D.laneN} reads)`, D.laneN >= 40 && D.laneHi >= D.laneLo)
ok(`past the line the 600-mind back reads the open field and the 120-mind one weaves (${D.ofHi} reads vs ${D.ofLo})`, D.ofHi >= 100 && D.ofLo === 0)
ok(`v165 I: he runs behind his blockers — some of his reads take a lane a blocker is leading up (${D.convoyHi} of ${D.ofHi})`, D.convoyHi >= 5 && D.convoyHi < D.ofHi)
ok(`and the reads pay: more a carry on the same seeds (ypc ${D.ypcLo} -> ${D.ypcHi})`, D.ypcHi > D.ypcLo)
ok(`but not a cheat code: under 1.4x a carry (${D.ypcLo} -> ${D.ypcHi})`, D.ypcHi < D.ypcLo * 1.4)
ok(`v165 F: a 600-mind receiver wins more at the break (separation ${D.wrLo} -> ${D.wrHi}, ${D.wrN} breaks)`, D.wrN >= 30 && D.wrHi >= D.wrLo + 0.4)
ok(`v165 H: a sharp corner reads the quarterback's eyes — his pick odds as the ball man rise with the eyes on (${D.intLo} -> ${D.intHi}, ${D.intN} balls)`, D.intN >= 20 && D.intHi >= D.intLo + 0.01 && D.intHi < 0.18)
ok(`kill switch: the bare ratings everywhere (visMax ${out.off.visMax}, E == bare: ${out.off.same})`, out.off.same && out.off.visMax <= 80)
ok('no page errors', errs.length === 0, errs.slice(0, 3))
for (const c of checks) console.log((c.pass ? 'ok   ' : 'FAIL ') + c.name)
const fails = checks.filter(c => !c.pass).length
console.log(JSON.stringify({ pass: checks.length - fails, fail: fails, pageErrors: errs.length, decide: D }))
process.exit(fails ? 1 : 0)
