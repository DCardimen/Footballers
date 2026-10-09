// Dev check: v193 AJ ANIMATION V2 + v193 AJ PHYSICS. Asserts:
//   THE SIM
//   1. the animation is presentation only — under one seed, the games simmed with `v193AJ` on and off are identical,
//      play for play (the stat-credit truth cannot have moved: nothing the sim books reads the switch)
//   2. physics: no dead stops — the first stride of every tick gives up at most what the man's brakes allow
//      (`__V193AJP.maxDrop` <= 1), and the frame-level arrival stops are reported against OFF
//   3. physics: a carrier who was not gripped falls forward by his momentum (ON only)
//   4. physics: a pass's height is a parabola in time (quadratic-fit residual far under OFF's), and its apex follows
//      ONE gravity whatever the throw's style (apex / dur² the same for every style)
//   THE BROADCAST (a Pee Wee game, the you-player at RB)
//   5. the contact gap: on the frame a lunge, a wrap, a whiff, a stiff arm, a hurdle, a truck resolves, the two men are
//      drawn within the new bound (p90 in drawn body widths — the age and the projection backed out) and closer than OFF
//   6. the run cycle's stride matches the ground covered (mean foot slide under 15% of a stride) and the stride hook
//      stays in v151 D's band
//   7. every move draws its own frames when it fires (the lab: two men on clear grass, driven frame by frame through
//      the scene's own fireEvent): juke, spin, side step, swim (and the beaten blocker), hurdle (and the man under it),
//      stiff arm (the man shoved off it), whiff (dive and slide), the spin's grasp at air, the diving catch, the push out
//      of bounds, the ankle / air / wrap / hit-stick tackles — each sequence distinct from every other
//   8. a whiffed tackler slides on the turf and stays down for the recovery delay before he gets up
//   9. the diving catch puts his HANDS on the ball's spot, and he lands and slides
//  10. the fall follows the momentum of both men: a heavy fast hitter puts a light carrier down backward, a big back
//      running into a still man falls forward, and the drawn lie faces the fall
//  11. physics: every hop is a parabola under one gravity (h = g·D²/8), and a loose ball's bounces die away
//  12. the kill switches: `v193AJ` 0 draws today's poses (no clip, the old whiff), `v193AJphys` 0 the old sine hop
//  13. performance: the per-frame cost of placing the 22 men with AJ on is within budget of OFF
//  14. no page errors
//   GAME_URL=http://localhost:5173/ node scripts/v193AJcheck.mjs   (GAMES, LIVE_MS)
import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'
const browser = await chromium.launch({ executablePath: CHROME })
const errs = []
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { setInterval(() => { document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)
await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(2500)
await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && window.__FieldSim, null, { timeout: 60000 })
const G = Number(process.env.GAMES || 4)

// ================= 1. presentation only =================
const SAME = await page.evaluate(({ G }) => {
  const R0 = Math.random
  const run = (aj) => {
    let s = 9137; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let v = Math.imul(s ^ s >>> 15, 1 | s); v = v + Math.imul(v ^ v >>> 7, 61 | v) ^ v; return ((v ^ v >>> 14) >>> 0) / 4294967296 }
    window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v193AJ: aj })
    const out = []
    try { for (let g = 0; g < G; g++) { window.__FieldSim._Q.length = 0; const r = window.__simGameV2(60, ['RB', 'LB', 'WR', 'CB'][g % 4]); out.push(JSON.stringify((r.plays || []).map(p => [p.event, p.yards, p.desc]))) } } finally { Math.random = R0; delete window.RIB_TUNE.v193AJ }
    return out
  }
  const a = run(1), b = run(0)
  return { games: a.length, same: a.every((x, i) => x === b[i]), plays: a.reduce((n, x) => n + JSON.parse(x).length, 0) }
}, { G })
ok(SAME.games === G && SAME.same && SAME.plays > 100 * G, 'the animation is presentation only: one seed, v193AJ on and off, the same games play for play', `${SAME.games} games, ${SAME.plays} plays, identical ${SAME.same}`)

// ================= 2-4. physics in the sim =================
const phys = (tune) => page.evaluate(({ G, tune }) => {
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, tune); window.__V193AJP = null
  const FS = window.__FieldSim, rec = [], o = {}
  for (const name of ['run', 'pass']) { o[name] = FS[name]; FS[name] = function (...a) { const r = o[name].apply(FS, a); const q = FS._Q; if (q && q.length) rec.push(q[q.length - 1].log); return r } }
  try { for (let g = 0; g < G; g++) window.__simGameV2(55 + g * 5, ['QB', 'RB', 'WR', 'LB', 'CB'][g % 5]) } finally { FS.run = o.run; FS.pass = o.pass; for (const k in tune) delete window.RIB_TUNE[k] }
  let ticks = 0, stops = 0
  const arcs = [], apexK = {}
  const fit = (pts) => { const n = pts.length, t0 = pts[0][0], t1 = pts[n - 1][0]; const S = [0, 0, 0, 0, 0], T = [0, 0, 0]
    for (const [t, h] of pts) { const u = (t - t0) / Math.max(1, t1 - t0); S[0] += 1; S[1] += u; S[2] += u * u; S[3] += u ** 3; S[4] += u ** 4; T[0] += h; T[1] += u * h; T[2] += u * u * h }
    const M = [[S[4], S[3], S[2]], [S[3], S[2], S[1]], [S[2], S[1], S[0]]], Y = [T[2], T[1], T[0]]
    const det = A => A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0])
    const D = det(M), col = k => M.map((r, i) => r.map((v, j) => j === k ? Y[i] : v)), a = det(col(0)) / D, b = det(col(1)) / D, c = det(col(2)) / D
    let mx = 0, hm = 1; for (const [t, h] of pts) { const u = (t - t0) / Math.max(1, t1 - t0); mx = Math.max(mx, Math.abs(a * u * u + b * u + c - h)); hm = Math.max(hm, h) } return mx / hm }
  for (const lg of rec) {
    const ev = lg.events || [], snapT = (ev.find(e => e.type === 'snap') || { t: 0 }).t
    const endT = ev.filter(e => /^(tackle|td|incomplete|pick|recover)$/.test(e.type)).map(e => e.t)[0] ?? 1e9
    const busy = {}; for (const e of ev) for (const f of ['who', 'carrier', 'tackler', 'by', 'on', 'off', 'def']) if (e[f]) (busy[e[f]] = busy[e[f]] || []).push(e.t)
    for (const a of lg.actors) { const fr = a.frames || [], bt = busy[a.id] || []
      for (let i = 2; i < fr.length - 1; i++) { const t = fr[i].t; if (t < snapT + 60 || t > endT - 60 || bt.some(q => Math.abs(q - t) < 200)) continue
        const v0 = Math.hypot(fr[i].x - fr[i - 1].x, fr[i].y - fr[i - 1].y) / Math.max(1, fr[i].t - fr[i - 1].t), v1 = Math.hypot(fr[i + 1].x - fr[i].x, fr[i + 1].y - fr[i].y) / Math.max(1, fr[i + 1].t - fr[i].t)
        ticks++; if (v0 > .1 && v1 < .01 && a.label !== 'OL' && a.label !== 'DL') stops++ } }
    const thr = ev.find(e => e.type === 'throw' && e.dur), end = thr && ev.find(e => e.t > thr.t && /^(catch|incomplete|pick|swat)$/.test(e.type))
    if (thr && end && arcs.length < 60) { const seg = (lg.ball || []).filter(b => b.t >= thr.t && b.t <= end.t && b.h > 0).map(b => [b.t, b.h]); if (seg.length > 6) arcs.push(fit(seg)) }
    if (thr && thr.apex > 8 && thr.dur > 200) { const k = thr.style || 'touch'; (apexK[k] = apexK[k] || []).push(thr.apex / (thr.dur * thr.dur) * 1e4) }
  }
  arcs.sort((a, b) => a - b)
  const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)
  const K = Object.fromEntries(Object.entries(apexK).filter(([, v]) => v.length > 4).map(([k, v]) => [k, +mean(v).toFixed(3)]))
  return { logs: rec.length, stopsPer1k: +(1000 * stops / Math.max(1, ticks)).toFixed(2), P: window.__V193AJP ? JSON.parse(JSON.stringify(window.__V193AJP)) : null, arcP50: +(arcs[Math.floor(arcs.length / 2)] || 0).toFixed(3), arcN: arcs.length, apexK: K }
}, { G: G + 2, tune })
const PH1 = await phys({ v193AJphys: 1 }), PH0 = await phys({ v193AJphys: 0 }), PHD = await phys({ v193AJphys: 1, decelV193: 1 })
const brief = R => JSON.stringify(Object.assign({}, R, { P: R.P && Object.assign({}, R.P, { turns: R.P.turns ? R.P.turns.length : 0 }) }))
console.log('physics ON :', brief(PH1)); console.log('physics OFF:', brief(PH0))
const B = (PH1.P && PH1.P.brake) || {}, bk = Object.values(B)
ok(bk.length >= 2 && bk.every(b => b.maxRatio <= 1.001) && B.heavy && B.light && B.heavy.rate / B.heavy.n < B.light.rate / B.light.n, 'deceleration is bounded: a man never brakes harder than his (mass-scaled) brakes, and a heavy man brakes softer than a light one',
  JSON.stringify(Object.fromEntries(Object.entries(B).map(([k, b]) => [k, { n: b.n, meanRate: +(b.rate / b.n).toFixed(2), worst: b.maxRatio }]))))
const TT = (PH1.P && PH1.P.turns) || [], corr = (() => { const n = TT.length; if (n < 20) return 0; const mx = TT.reduce((a, r) => a + r[0], 0) / n, my = TT.reduce((a, r) => a + r[1], 0) / n; let sxy = 0, sx = 0, sy = 0; for (const [x, y] of TT) { sxy += (x - mx) * (y - my); sx += (x - mx) ** 2; sy += (y - my) ** 2 } return sxy / Math.sqrt(sx * sy) })()
const lossK = w => { const r = TT.filter(q => (w ? q[2] >= .95 : q[2] <= .62) && q[0] > .1); return r.length ? r.reduce((a, q) => a + q[1] / q[0], 0) / r.length : null }
ok(TT.length >= 50 && corr > .8 && lossK(1) > lossK(0), 'a cut costs speed in proportion to its angle, and more for a heavier man', `${TT.length} cuts, corr(angle, speed lost) ${corr.toFixed(2)}; lost per unit of turn heavy ${(lossK(1) || 0).toFixed(3)} vs light ${(lossK(0) || 0).toFixed(3)}`)
ok(PHD.P && PHD.P.moves > 1000 && PHD.P.maxDrop <= 1.001 && PHD.stopsPer1k < PH0.stopsPer1k, 'no dead stops (decelV193): the ground a man covers obeys the same brake — he runs through a spot he cannot stop on', PHD.P && `${PHD.P.moves} bounded strides, ${PHD.P.carried} carried through, worst ${PHD.P.maxDrop} of the brake; free-running dead stops ${PHD.stopsPer1k}/1k ticks vs ${PH0.stopsPer1k} OFF (off by default: it moved yards per carry, see docs/CHANGELOG.md)`)
ok(PH1.P && PH1.P.falls > 0 && PH1.P.fwdPx > 0 && !(PH0.P && PH0.P.falls), 'a carrier who was not gripped falls forward on his momentum (ON only)', PH1.P && `${PH1.P.falls} falls, ${(PH1.P.fwdPx / Math.max(1, PH1.P.falls)).toFixed(2)} px mean, max ${PH1.P.maxPx} px`)
ok(PH1.arcN > 10 && PH1.arcP50 <= .03 && PH1.arcP50 < PH0.arcP50, 'a pass climbs and falls on a parabola in time', `quadratic-fit residual p50 ${PH1.arcP50} of the apex ON vs ${PH0.arcP50} OFF over ${PH1.arcN} throws`)
const kv = Object.values(PH1.apexK), kv0 = Object.values(PH0.apexK)
const spread = a => a.length > 1 ? (Math.max(...a) - Math.min(...a)) / Math.min(...a) : 0
ok(kv.length >= 2 && spread(kv) < .12 && spread(kv) < spread(kv0), 'one gravity: apex / hang² is the same for every style of throw', `ON ${JSON.stringify(PH1.apexK)} (spread ${spread(kv).toFixed(2)}) vs OFF ${JSON.stringify(PH0.apexK)} (spread ${spread(kv0).toFixed(2)})`)

// ================= the broadcast =================
async function step (t) {
  const r = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    const el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
      : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className) || /RUN THIS PLAN|LOCK IT IN|CHOOSE/i.test(txt(e)))
        : els.find(e => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null
  }, { t, visSrc: vis })
  await page.waitForTimeout(t === 'PLAN' ? 4000 : 900); return r
}
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN']) await step(t)
let live = false
for (let i = 0; i < 8 && !live; i++) {
  for (const t of ['CONTINUE TO MATCH', 'Continue to Match', 'NEXT', 'KICK OFF', 'PLAY', 'CONTINUE']) {
    live = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length)); if (live) break
    await step(t)
  }
  if (!live) await page.waitForTimeout(2000)
}
ok(live, 'the broadcast came up')
if (live) {
  await page.evaluate(() => {
    window.__AJ_SPEED = 4; window.__getGridironLiveSpeed = () => window.__AJ_SPEED
    const sc = window.__gridironScene, T = window.__AJT = { on: { ms: 0, n: 0 }, off: { ms: 0, n: 0 } }
    const pm = sc.placeMarker.bind(sc)
    sc.placeMarker = function (...a) { const t0 = performance.now(), r = pm(...a); const k = window.TU('v193AJ', 1) ? 'on' : 'off'; T[k].ms += performance.now() - t0; T[k].n++; return r }
  })
  const runFor = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(q => /^(CONTINUE|NEXT PLAY|NEXT)$/i.test((q.innerText || '').trim()) && q.offsetParent); if (b) b.click() }); await page.waitForTimeout(300) } }
  const LIVE = Number(process.env.LIVE_MS || 60000)
  await runFor(LIVE)
  await page.evaluate(() => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v193AJ: 0 }) })
  await runFor(LIVE * .8)
  await page.evaluate(() => { delete window.RIB_TUNE.v193AJ })
  const LV = await page.evaluate(() => {
    const H = window.__V193AJ || {}, gaps = (H.reach && H.reach.gaps) || []
    const q = (a, x) => { const s = a.slice().sort((p, r) => p - r); return s.length ? +s[Math.min(s.length - 1, Math.floor(x * s.length))].toFixed(2) : null }
    const pick = on => gaps.filter(g => g.on === on && g.type !== 'tackleWhiff').map(g => g.bw)
    const sim = on => gaps.filter(g => g.on === on).map(g => g.sim)
    const T = window.__AJT, R = (window.__V151D_R || {}).stride || {}
    return { n1: pick(1).length, n0: pick(0).length, p50on: q(pick(1), .5), p90on: q(pick(1), .9), p50off: q(pick(0), .5), p90off: q(pick(0), .9), simP50on: q(sim(1), .5), simP50off: q(sim(0), .5),
      age: gaps.length ? gaps[0].age : null, stride: H.stride, band: R.n ? R.frames / Math.max(1, R.cell) : null, lunges: H.lunges, windups: H.windups, handfight: H.handfight, backpedal: H.backpedal,
      msOn: T.on.n ? T.on.ms / T.on.n : 0, msOff: T.off.n ? T.off.ms / T.off.n : 0 }
  })
  console.log('live:', JSON.stringify(LV))
  ok(LV.n1 >= 15 && LV.n0 >= 10, 'sampled contact frames with the switch on and off', `${LV.n1} on, ${LV.n0} off (age scale ${LV.age})`)
  ok(LV.p90on != null && LV.p90on <= 1.15 && LV.p90on < LV.p90off, 'the contact gap: drawn within an arm\'s length on the frame it resolves, and closer than OFF', `body widths p50 ${LV.p50on} / p90 ${LV.p90on} ON vs p50 ${LV.p50off} / p90 ${LV.p90off} OFF; the sim's own gap is unchanged (p50 ${LV.simP50on} vs ${LV.simP50off} field px)`)
  const slide = LV.stride && LV.stride.slideN ? LV.stride.slide / LV.stride.slideN : 1
  ok(slide < .15 && LV.band >= 8 / 84 && LV.band <= 8 / 30, 'the run cycle\'s stride matches the ground covered', `mean foot slide ${(slide * 100).toFixed(1)}% of a stride over ${LV.stride && LV.stride.n} steps; ${LV.band && LV.band.toFixed(3)} frames a sprite px (band ${(8 / 84).toFixed(3)}..${(8 / 30).toFixed(3)})`)
  ok(LV.lunges > 0 && LV.handfight > 0, 'the lunge is seen coming and every engaged pair hand-fights', `${LV.lunges} lunges (${LV.windups} with a windup), ${LV.handfight} hand-fight frames, ${LV.backpedal} backpedal frames`)
  ok(LV.msOn <= LV.msOff * 1.6 + .05, 'performance: placing a man costs about what it did', `${(LV.msOn * 1000).toFixed(1)}µs a placement ON vs ${(LV.msOff * 1000).toFixed(1)}µs OFF (x22 a frame)`)

  // ================= 7-12. the lab =================
  await page.evaluate(() => {
    window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v163A: 0 })
    const sc = window.__gridironScene
    return new Promise(res => { const iv = setInterval(() => { const P = sc.play; if (P && P.snapped && !P.done && P.script) { clearInterval(iv); res() } }, 50); setTimeout(() => { clearInterval(iv); res() }, 60000) })
  })
  await page.evaluate(() => {
    const sc = window.__gridironScene; sc.game.loop.sleep()
    const L = window.__LAB = { t: performance.now() }
    L.step = (dt) => { L.t += dt; sc.sys.events.emit('preupdate', L.t, dt); sc.sys.events.emit('update', L.t, dt) }
  })
  const SCN = {
    juke: { n: 60, C: f => ({ x: f * .13, y: f > 140 ? (f - 140) * .07 : 0 }), D: f => ({ x: 26 - f * .02, y: -3 }), ev: [[140, { type: 'cut', kind: 'juke', direction: 1, elus: 70 }]] },
    spin: { n: 60, C: f => ({ x: f * .13, y: f > 140 ? (f - 140) * .05 : 0 }), D: f => ({ x: 26 - f * .02, y: -3 }), ev: [[140, { type: 'cut', kind: 'spin', direction: 1, elus: 70 }]] },
    sidestep: { n: 60, C: f => ({ x: f * .12, y: f > 140 ? Math.min(14, (f - 140) * .09) : 0 }), D: f => ({ x: 26 - f * .02, y: -3 }), ev: [[140, { type: 'cut', kind: 'sidestep', direction: 1, elus: 70 }]] },
    hurdle: { n: 90, C: f => ({ x: f * .14, y: 0 }), D: f => ({ x: 30 - Math.min(f, 200) * .05, y: 2 }), ev: [[150, { type: 'hurdle', clearance: 14 }]] },
    stiffarm: { n: 110, C: f => ({ x: f * .13, y: 0 }), D: f => ({ x: 28 - Math.min(f, 150) * .09, y: -6 }), ev: [[150, { type: 'stiffarm', armEdge: 12, side: 1 }]] },
    swim: { n: 60, line: true, C: f => ({ x: -2, y: 0 }), D: f => ({ x: 4 - (f > 120 ? (f - 120) * .1 : 0), y: f > 120 ? Math.min(10, (f - 120) * .06) : 0 }), ev: [[120, { type: 'swim' }]] },
    whiff: { n: 150, C: f => ({ x: f * .13, y: f > 150 ? (f - 150) * .06 : 0 }), D: f => ({ x: f < 150 ? 34 - f * .14 : f < 400 ? 13 - (f - 150) * .05 : .5 + (f - 400) * .1, y: -4 + Math.min(f, 400) * .01 }), ev: [[150, { type: 'tackleLunge', aim: 'mid' }], [150, { type: 'tackleWhiff', angQ: .5 }]], lunge: 150 },
    divecatch: { n: 130, C: f => ({ x: f * .1, y: f * .05 }), D: null, ev: [[60, { type: 'reach', kind: 'dive', dx: 30, dy: 16, at: 240 }], [240, { type: 'catch', catchType: 'dive' }]] },
    tackle_low: { n: 80, C: f => ({ x: Math.min(f, 160) * .13 + Math.max(0, f - 160) * .03, y: 0 }), D: f => ({ x: 28 - Math.min(f, 160) * .08, y: 3 }), ev: [[160, { type: 'tackleLunge', aim: 'low' }], [160, { type: 'tackle', style: 'low', kb: 0, drive: 2 }]], lunge: 160 },
    tackle_wrap: { n: 80, C: f => ({ x: Math.min(f, 160) * .13, y: 0 }), D: f => ({ x: 28 - Math.min(f, 160) * .08, y: 3 }), ev: [[160, { type: 'tackleLunge', aim: 'mid' }], [160, { type: 'tackle', style: 'even', kb: 3 }]], lunge: 160 },
    hitstick: { n: 80, C: f => ({ x: Math.min(f, 160) * .13 - Math.max(0, f - 160) * .05, y: 0 }), D: f => ({ x: 30 - f * .12, y: 1 }), ev: [[160, { type: 'tackleLunge', aim: 'high' }], [160, { type: 'tackle', style: 'high', hitStick: true, bigHit: true, kb: 12 }]], lunge: 160 },
    air: { n: 80, C: f => ({ x: f * .08, y: 0 }), D: f => ({ x: 22 - Math.min(f, 160) * .1, y: -3 }), ev: [[100, { type: 'catch', catchType: 'high' }], [160, { type: 'tackle', style: 'high', catchTackle: true, kb: 2 }]] },
    oob: { n: 70, C: f => ({ x: f * .06, y: Math.min(f, 150) * .12 }), D: f => ({ x: 4 + f * .05, y: -14 + Math.min(f, 150) * .12 }), ev: [[150, { type: 'tackle', oob: true }]], sideline: true },
    backfall: { n: 50, C: f => ({ x: Math.min(f, 160) * .05, y: 0 }), D: f => ({ x: 20 - Math.min(f, 160) * .16, y: 0 }), heavyD: true, ev: [[160, { type: 'tackle', style: 'even', kb: 2 }]] },
    fwdfall: { n: 50, C: f => ({ x: Math.min(f, 160) * .15, y: 0 }), D: f => ({ x: 24, y: 0 }), heavyC: true, ev: [[160, { type: 'tackle', style: 'even', kb: 0 }]] }
  }
  const lab = (name, sc0) => page.evaluate(({ name, S }) => {
    const sc = window.__gridironScene, P = sc.play, L = window.__LAB, H = window.__V193AJ || {}
    const fn = s => s ? new Function('f', 'return (' + s + ')(f)') : null, fC = fn(S.C), fD = fn(S.D)
    const cam = sc.cameras.main
    let best = null, bd = 1e9; sc.markers.forEach(m => { if (!m || !m.root) return; const d = Math.hypot(m.root.x - cam.worldView.centerX, m.root.y - cam.worldView.centerY); if (d < bd) { bd = d; best = m } })
    const base = { x: best.sx, y: S.sideline ? 396 : Math.max(120, Math.min(320, best.sy)) }
    const orig = {}, P0 = { carrierId: P.carrierId, ballHolderId: P.ballHolderId, ballMode: P.ballMode }
    const mk = (side, num, idx, label) => { const m = sc.marker(base.x, base.y, side, num, 0, 1, side); m.posLabel = label; m._ajSide = side; m._ajLabel = label; m._ajSp = 150; orig[idx] = sc.markers[idx]; sc.markers[idx] = m; return m }
    const C = mk('off', 24, 9, S.heavyC ? 'TE' : 'RB'), D = mk('def', 52, 15, S.heavyD ? 'DT' : S.light ? 'CB' : 'LB')
    if (S.line) { C.isLine = true; D.isLine = true; C.homeDir = 'up'; D.homeDir = 'dn'; sc.pairUp(9, 15) }
    P.carrierId = 9; P.ballHolderId = 9; P.ballMode = 'held'
    const dir = (P.script.meta && P.script.meta.dir) || 1, fired = {}, track = { C: [], D: [] }
    const n0 = H.serial || 0, since = a => (a || []).filter(r => r && r.n > n0)
    const clips0 = Object.assign({}, H.clips || {})
    for (let f = 0; f <= S.n; f++) {
      const fms = f * 11.7
      for (const [t, e0] of (S.ev || [])) {
        if (S.lunge != null && e0.type === 'tackleLunge' && fms >= S.lunge - 150 && !fired.pre && sc.ajOnV193 && sc.ajOnV193()) { fired.pre = 1; sc.ajLungeV193(D, C, { aim: e0.aim }, 150) }
        if (fms < t || fired[t + e0.type]) continue
        fired[t + e0.type] = 1
        const e = Object.assign({ t: Math.max(0, P.t - (P.delay || 0)), x: C.sx, y: C.sy, carrier: 'off9', who: 'def4', tackler: 'def4', by: e0.type === 'reach' || e0.type === 'catch' ? 'off9' : 'def4', ix: (C.sx + D.sx) / 2, iy: (C.sy + D.sy) / 2 }, e0)
        if (e0.type === 'reach') { e.x = base.x + dir * e0.dx; e.y = base.y + e0.dy; e.at = e.t + (e0.at - t) }
        if (e0.type === 'tackle' && e0.gang) { e.sup = []; e.downV153A = [] }
        sc.fireEvent(e, P)
      }
      const at = fnp => { const q = fnp(fms); return [base.x + dir * q.x, base.y + q.y] }
      if (fC) sc.placeMarker(C, ...at(fC), 11.7); else sc.placeMarker(C, base.x - dir * 60, base.y - 40, 11.7)
      if (fD) sc.placeMarker(D, ...at(fD), 11.7); else sc.placeMarker(D, base.x + dir * 80, base.y + 60, 11.7)
      track.C.push([C.tex, C.forceState || '', +(C.body.rotation || 0).toFixed(2), +C.sx.toFixed(1), +C.sy.toFixed(1), C._ajSimX != null ? +C._ajSimX.toFixed(1) : null, C._ajSimY != null ? +C._ajSimY.toFixed(1) : null, C.flip ? 1 : 0])
      track.D.push([D.tex, D.forceState || '', +(D.body.rotation || 0).toFixed(2), +D.sx.toFixed(1), +D.sy.toFixed(1), D._ajSimX != null ? +D._ajSimX.toFixed(1) : null, D._ajSimY != null ? +D._ajSimY.toFixed(1) : null, D.flip ? 1 : 0])
      L.step(16.7)
    }
    const newSeq = {}; for (const r of since(H.seqLog)) (newSeq[r.kind] = newSeq[r.kind] || []).push(r.rec)
    // the clips still running at the end are read off the men
    for (const m of [C, D]) if (m._ajClip && m._ajClip.rec.length) (newSeq[m._ajClip.kind] = newSeq[m._ajClip.kind] || []).push(m._ajClip.rec.slice())
    const clips = {}; for (const k in (H.clips || {})) if ((H.clips[k] || 0) > (clips0[k] || 0)) clips[k] = H.clips[k] - (clips0[k] || 0)
    const out = { name, seq: newSeq, clips, whiffs: since(H.whiffs), layouts: since(H.layouts), falls: since(H.falls), arcs: since(H.arcs),
      texC: [...new Set(track.C.map(r => r[0].replace(/^spr_[a-z]+_/, '')))], texD: [...new Set(track.D.map(r => r[0].replace(/^spr_[a-z]+_/, '')))], track, base, dir }
    for (const k of Object.keys(orig)) { try { sc.unpair(+k) } catch (e) {} const m = sc.markers[k]; sc.ajResetV193 && sc.ajResetV193(m); try { m.root.destroy(true); m.bob && m.bob.destroy() } catch (e) {} sc.markers[k] = orig[k] }
    Object.assign(P, P0)
    return out
  }, { name, S: Object.fromEntries(Object.entries(sc0).map(([k, v]) => [k, typeof v === 'function' ? v.toString() : v])) })
  const LAB = {}
  for (const name of Object.keys(SCN)) LAB[name] = await lab(name, SCN[name])
  // the grasp at air (the whiff a spin answers) — straight through the method, on a lab man
  const GR = await page.evaluate(() => {
    const sc = window.__gridironScene, P = sc.play, L = window.__LAB, H = window.__V193AJ, n0 = H.serial || 0
    const m = sc.marker(sc.markers[9].sx, sc.markers[9].sy, 'def', 52, 0, 1, 'def'); m._ajSide = 'def'; m._ajLabel = 'LB'; m._ajSp = 150
    sc.ajGraspV193(m, 1, 0, .12, {})
    for (let f = 0; f < 90; f++) { sc.placeMarker(m, m._ajSimX != null ? m._ajSimX + .6 : m.sx, m.sy, 11.7); L.step(16.7) }
    const r = (H.seqLog || []).filter(q => q.n > n0 && q.kind === 'grasp').map(q => q.rec); try { m.root.destroy(true) } catch (e) {} return r
  })
  const kinds = {}
  const addSeq = (k, v) => { if (v && v.length) kinds[k] = kinds[k] || v.map(s => s.join(' ')).find(s => s.split(' ').length >= 2) || v[0].join(' ') }
  for (const r of Object.values(LAB)) for (const [k, v] of Object.entries(r.seq)) addSeq(k, v)
  addSeq('grasp', GR)
  console.log('lab sequences:', JSON.stringify(kinds))
  const WANT = ['juke', 'spin', 'sidestep', 'swim', 'beaten', 'diveUnder', 'shoved', 'whiffDive', 'grasp', 'layout', 'shovedOut', 'shove', 'trip', 'ankleDive', 'airFall', 'wrapTwist', 'stick', 'lunge']
  const missing = WANT.filter(k => !kinds[k])
  const flat = WANT.filter(k => kinds[k] && new Set(kinds[k].split(' ').map(s => s.split('/')[0])).size < 2 && !/^(spin|wrapTwist)$/.test(k))
  ok(missing.length === 0, 'every move fires its own animation', missing.length ? 'missing ' + missing.join(', ') : `${WANT.length} kinds`)
  ok(flat.length === 0, 'and each is a SEQUENCE of distinct cells (the spin walks the facings, the wrap twists)', flat.length ? 'single-cell: ' + flat.join(', ') : 'ok')
  const sp = (kinds.spin || '').split(' ').map(s => s.split('/')[1]), facings = new Set(sp)
  ok(facings.size >= 3, 'the spin turns through the facings', `${facings.size} facings: ${kinds.spin}`)
  const sigs = WANT.filter(k => kinds[k]).map(k => kinds[k]), dup = sigs.length - new Set(sigs).size
  ok(dup === 0, 'no two moves draw the same sequence', `${new Set(sigs).size} distinct of ${sigs.length}`)
  // 8. the whiff slides and stays down
  const W = (LAB.whiff.whiffs || []).find(w => w.kind === 'whiffDive')
  ok(W && W.slidPx > .5 && W.groundMs >= 250, 'a whiffed tackler lands, slides on the turf and stays down before he gets up', W && `slid ${W.slidPx} px (planned ${W.slidePlan}), down ${W.groundMs} ms (lie ${W.down} ms) then the get-up`)
  const dT = LAB.whiff.track.D.map(r => r[0].replace(/^spr_[a-z]+_/, '')), iDown = dT.findIndex(t => /down|tackle4/.test(t)), iUp = dT.findIndex((t, i) => i > iDown && /getup/.test(t))
  ok(iDown > 0 && iUp > iDown + 8, 'no instant reset: the get-up comes frames after he hits the grass', `down at frame ${iDown}, up at ${iUp}`)
  // 9. the layout
  const LY = LAB.divecatch.layouts[0]
  ok(LY && LY.handsAt != null && LY.handsAt <= 3 && LY.slidPx > .5 && /divecatch/.test(kinds.layout || ''), 'the diving catch: his hands are on the ball\'s spot as it arrives, he lands and slides', LY && `hands ${LY.handsAt} px off the spot (arm ${LY.arm} px), slid ${LY.slidPx} px; ${kinds.layout}`)
  // 10. the fall follows momentum
  const fb = LAB.backfall.falls[0], ff = LAB.fwdfall.falls[0]
  const dot = (f, track) => { const v = f.vC, n = Math.hypot(v[0], v[1]) || 1; return (f.ux * v[0] + f.uy * v[1]) / n }
  const momOk = f => { const px = f.mT * f.vT[0] + f.mC * f.vC[0], py = f.mT * f.vT[1] + f.mC * f.vC[1], n = Math.hypot(px, py) || 1; return Math.abs(px / n - f.ux) < .02 && Math.abs(py / n - f.uy) < .02 }
  ok(fb && ff && dot(fb) < -.3 && dot(ff) > .3 && momOk(fb) && momOk(ff), 'the fall follows the momentum of both men: a heavy hitter puts him down backward, a big back falls forward', fb && ff && `heavy hitter: fall·carrier-heading ${dot(fb).toFixed(2)} (${fb.mT} vs ${fb.mC}); big back: ${dot(ff).toFixed(2)} (${ff.mC} vs ${ff.mT})`)
  const lie = (L, f) => { const fl = L.track.C.filter(r => /tackle|down/.test(r[0])).map(r => r[7]); return fl.length ? fl[fl.length - 1] === (f.fsx < 0 ? 1 : 0) : false }
  ok(lie(LAB.backfall, fb) && lie(LAB.fwdfall, ff), 'and he LIES the way he fell', `flip ${fb && fb.flip} / ${ff && ff.flip}`)
  const sl = [LAB.backfall, LAB.fwdfall].map(L => { const f = L.falls[0], r = L.track.C[L.track.C.length - 1]; const ox = r[3] - r[5], oy = r[4] - r[6], n = Math.hypot(ox, oy); return { n: +n.toFixed(2), dot: n > .1 ? +((ox * f.ux + oy * f.uy) / n).toFixed(2) : null, d: f.d } })
  ok(sl.every(s => s.d > .2 && s.dot > .95 && Math.abs(s.n - s.d) < .3), 'physics: the pile slides along that momentum and stops on friction (v²/2μ)', JSON.stringify(sl))
  // 11. physics in the air and on the ground
  const arcs = Object.values(LAB).flatMap(r => r.arcs).filter(a => a.s.length > 4)
  const g = await page.evaluate(() => window.TU('ajGravV193', .001))
  const dev = arcs.map(a => Math.max(...a.s.map(([k, l]) => Math.abs(l - 4 * a.h * k * (1 - k)))) / Math.max(.3, a.h)), gdev = arcs.map(a => Math.abs(a.h - g * a.D * a.D / 8) / Math.max(.3, a.h))
  ok(arcs.length >= 4 && Math.max(...dev) < .02 && Math.max(...gdev) < .02, 'physics: every hop is a parabola under one gravity (h = g·D²/8)', `${arcs.length} hops, worst shape ${(Math.max(...dev) * 100).toFixed(2)}%, worst gravity ${(Math.max(...gdev) * 100).toFixed(2)}% (${arcs.slice(0, 4).map(a => a.D + 'ms/' + a.h).join(' ')})`)
  const BN = await page.evaluate(() => { const sc = window.__gridironScene; const out = []; for (const s of [3, 41, 977, 2024]) { sc._ajBnc = {}; const R = sc.ajBounceV193('chk' + s, s, { z0: 7, vz0: .07 }); out.push(R.apex) } return out })
  ok(BN.every(a => a.length >= 3 && a.slice(1).every((h, i) => i === 0 || h < a[i])) && new Set(BN.map(a => a[1])).size > 1, 'physics: a loose ball\'s bounces die away, each hop its own height (a prolate ball)', JSON.stringify(BN.map(a => a.slice(0, 5))))
  // 12. the kill switches
  await page.evaluate(() => { window.RIB_TUNE.v193AJ = 0 })
  const K0 = {}
  for (const name of ['juke', 'whiff', 'tackle_wrap']) K0[name] = await lab(name, SCN[name])
  await page.evaluate(() => { delete window.RIB_TUNE.v193AJ; window.RIB_TUNE.v193AJphys = 0 })
  const KP = await lab('juke', SCN.hurdle)
  await page.evaluate(() => { delete window.RIB_TUNE.v193AJphys })
  const noClip = Object.values(K0).every(r => Object.keys(r.clips).length === 0)
  const oldWhiff = K0.whiff.texD.some(t => /^sd_dive$|_dive$/.test(t)) && K0.whiff.texD.includes('down') && !K0.whiff.texD.includes('tackle4')
  ok(noClip && oldWhiff, 'kill switch v193AJ 0: no clip runs and the whiff is the old dive-then-down', `clips ${JSON.stringify(Object.values(K0).map(r => r.clips))}; whiff cells ${K0.whiff.texD.join(' ')}`)
  ok(KP.arcs.length === 0, 'kill switch v193AJphys 0: the hop is the old sine (no gravity conversion)', `${KP.arcs.length} converted hops`)
  await page.evaluate(() => { const sc = window.__gridironScene; sc.game.loop.wake() })
}
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
if (errs.length) console.log('page errors:\n' + errs.slice(0, 8).join('\n'))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
