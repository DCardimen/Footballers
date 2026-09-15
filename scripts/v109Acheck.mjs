// Dev check: v109 A — THE BALL HAS A SPEED. The throw as a release plus a velocity, the arc
// that follows the hang, the throw event that tells the truth, the miss with a direction, and
// the throwaway that is actually thrown. Asserts, in one pass:
//   * THE EVENT — every `throw` in a few hundred sim passes carries dur / vel / velMph / apex /
//     wobble / platform (and errDir on a real target), and the platform vocabulary is real.
//   * THE SPEED — `window.__V109_A.flightMs(distPx, thr, style)` grows with distance, shrinks
//     with the arm, hangs longer for a lob; and over the actual throw-distance mix the mean flight
//     is within 5% of the legacy ladder (`__V109_A.rows` carries both numbers per throw), with the
//     short ball a shade longer and the deep ball a shade shorter.
//   * THE ARC — a lob's apex is higher than a bullet's, and the height curve peaks past halfway.
//   * THE DIRECTION — a panicked throw's miss is biased short-and-behind more often than a calm
//     one's, whose miss is still isotropic; the wobble rises with panic.
//   * THE THROWAWAY — every `throwaway` is followed by a `throw{away:true}`, its `incomplete`
//     (`oob:true, away:true`) lands at the flight's end and never on the same tick, and at least
//     one ordinary miss leaves the field (`incomplete{oob:true}`).
//   * THE PICTURE — on the live field `__V109_A.last` reports the ball's numbers and the spin
//     rate differs between a bullet and a lob (a touch ball stands in if no lob is thrown).
//   GAME_URL=http://localhost:5173/ node scripts/v109Acheck.mjs        (READ_POS=QB)
import { chromium } from 'playwright'
const URL = process.env.GAME_URL || 'http://localhost:5173/'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const errs = []
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)   // warm: vite's one-time reload after an edit
await page.waitForFunction(() => typeof window.__simGameV2 === 'function', null, { timeout: 60000 })

// ================= 1. the sim: the event, the speed, the direction, the throwaway =================
const sim = await page.evaluate(() => {
  const FS = window.__FieldSim, orig = FS.pass.bind(FS), logs = []
  FS.pass = function (...a) { const r = orig(...a); try { const L = FS._Q[FS._Q.length - 1]; if (L && L.log) logs.push(L.log.events) } catch (e) {} return r }
  if (window.__V109_A && window.__V109_A.rows) window.__V109_A.rows.length = 0
  const pos = ['QB', 'WR', 'RB', 'LB', 'CB', 'S']
  let i = 0; while (logs.length < 450 && i < 80) { window.__simGameV2(55 + (i % 15), pos[i % pos.length]); i++ }
  FS.pass = orig
  const fields = ['dur', 'vel', 'velMph', 'apex', 'wobble', 'platform']
  let n = 0, missing = 0, noDir = 0, throwawayN = 0, throwawayNoThrow = 0, awayOK = 0, awayBad = 0, sameTick = 0, oobInc = 0, incTotal = 0, awayLate = 0
  const plat = {}, biasedPanic = [0, 0], biasedCalm = [0, 0], dirPanic = [], dirCalm = [], awaySide = { top: 0, bot: 0 }
  for (const ev of logs) {
    const ta = ev.find(e => e.type === 'throwaway')
    if (ta) { throwawayN++; const th = ev.find(e => e.type === 'throw' && e.away)
      if (!th) throwawayNoThrow++
      else { const inc = ev.find(e => e.type === 'incomplete' && e.away)
        if (!inc || !inc.oob || !th.oob) awayBad++
        else { awayOK++; if (inc.t <= th.t) sameTick++; if (Math.abs(inc.t - th.t - th.dur) > 33) awayLate++; awaySide[th.ty < 220 ? 'top' : 'bot']++ } } }
    const ti = ev.findIndex(e => e.type === 'throw'); if (ti < 0) continue
    const th = ev[ti]; n++
    if (!fields.every(f => th[f] != null)) missing++
    plat[th.platform] = (plat[th.platform] || 0) + 1
    if (!th.away) { if (th.errDir == null) noDir++
      if (th.panic > .35) { biasedPanic[th.errBiased ? 0 : 1]++; dirPanic.push(Math.abs(th.errDir)) }
      else if (th.panic < .05) { biasedCalm[th.errBiased ? 0 : 1]++; dirCalm.push(Math.abs(th.errDir)) } }
    for (const e of ev.slice(ti + 1)) if (e.type === 'incomplete') { incTotal++; if (e.oob && !e.away) oobInc++ }
  }
  const rows = (window.__V109_A && window.__V109_A.rows || []).slice()
  const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
  const B = [[0, 60], [60, 90], [90, 120], [120, 150], [150, 200], [200, 999]]
  const buckets = B.map(([a, b]) => { const g = rows.filter(r => r.d >= a && r.d < b); return { px: a + '-' + b, n: g.length, legacy: Math.round(mean(g.map(r => r.legacy)) || 0), now: Math.round(mean(g.map(r => r.dur)) || 0) } })
  const byStyle = {}; for (const s of ['bullet', 'touch', 'lob']) { const g = rows.filter(r => r.style === s); byStyle[s] = { n: g.length, legacy: Math.round(mean(g.map(r => r.legacy)) || 0), now: Math.round(mean(g.map(r => r.dur)) || 0), apex: Math.round(mean(g.map(r => r.apex)) || 0) } }
  const F = window.__V109_A
  // the height curve, read off the logged flights: where along the flight the ball was highest.
  // The logged h is rounded to the pixel, so a flat ball has a plateau of ties at the top — the
  // centroid of that plateau is the apex, not its first frame. Higher arcs, averaged.
  const apexAts = []
  for (let k = logs.length - 1; k >= 0 && apexAts.length < 30; k--) { const L = FS._Q.find(q => q.log && q.log.events === logs[k]); const bf = L && L.log.ball; const th = logs[k].find(e => e.type === 'throw' && !e.away)
    if (!bf || !th || !(th.apex >= 25)) continue; const end = logs[k].find(e => e.t > th.t && /^(catch|incomplete|pick|swat)$/.test(e.type)); if (!end) continue
    const seg = bf.filter(f => f.t >= th.t && f.t <= end.t); if (seg.length < 8) continue
    const top = Math.max(...seg.map(f => f.h)); const idx = seg.map((f, j) => f.h >= top - .5 ? j : -1).filter(j => j >= 0)
    apexAts.push(mean(idx) / (seg.length - 1)) }
  const apexAt = mean(apexAts)
  return { plays: logs.length, n, missing, noDir, plat, throwawayN, throwawayNoThrow, awayOK, awayBad, sameTick, awayLate, awaySide, oobInc, incTotal,
    biasedPanic, biasedCalm, dirPanic: mean(dirPanic), dirCalm: mean(dirCalm), nPanic: dirPanic.length, nCalm: dirCalm.length, apexAt, apexN: apexAts.length,
    overall: { n: rows.length, legacy: Math.round(mean(rows.map(r => r.legacy))), now: Math.round(mean(rows.map(r => r.dur))) }, buckets, byStyle,
    fn: { short: F.flightMs(50, 80, 'bullet'), mid: F.flightMs(130, 80, 'bullet'), deep: F.flightMs(230, 80, 'bullet'), lob: F.flightMs(130, 80, 'lob'), touch: F.flightMs(130, 80, 'touch'), weak: F.flightMs(130, 40, 'bullet'), strong: F.flightMs(130, 95, 'bullet') },
    wob: { calm: mean(rows.filter(r => r.panic < .05).map(r => r.wobble)), hot: mean(rows.filter(r => r.panic > .35).map(r => r.wobble)) } }
})
console.log('sim:', JSON.stringify(sim))
ok(sim.n >= 200, 'sampled a real body of throws', `${sim.n} throws over ${sim.plays} passes`)
ok(sim.missing === 0, 'every throw event carries dur / vel / velMph / apex / wobble / platform', `${sim.missing} missing`)
ok(sim.noDir === 0 && Object.keys(sim.plat).every(p => /^(set|roll|slide|hurried)$/.test(p)) && Object.keys(sim.plat).length >= 2,
  'a real target gets errDir, and the platform vocabulary is set / roll / slide / hurried', JSON.stringify(sim.plat))
ok(sim.fn.short < sim.fn.mid && sim.fn.mid < sim.fn.deep && sim.fn.short >= 390, 'flight time is a release plus distance over a velocity', `50px=${Math.round(sim.fn.short)} 130px=${Math.round(sim.fn.mid)} 230px=${Math.round(sim.fn.deep)} ms`)
ok(sim.fn.strong < sim.fn.weak && sim.fn.lob > sim.fn.touch && sim.fn.touch > sim.fn.mid, 'a stronger arm gets it there sooner and a lob hangs longest', `arm40=${Math.round(sim.fn.weak)} arm95=${Math.round(sim.fn.strong)} · bullet=${Math.round(sim.fn.mid)} touch=${Math.round(sim.fn.touch)} lob=${Math.round(sim.fn.lob)}`)
const drift = Math.abs(sim.overall.now - sim.overall.legacy) / sim.overall.legacy
ok(drift <= .05, 'over the real distance mix the mean flight is within 5% of the legacy ladder', `legacy=${sim.overall.legacy} now=${sim.overall.now} ms (${(drift * 100).toFixed(1)}%) · ${sim.buckets.map(b => b.px + ':' + b.legacy + '->' + b.now).join(' ')}`)
const bk = sim.buckets.filter(b => b.n >= 20)
ok(bk.length >= 3 && bk[0].now >= bk[0].legacy && bk[bk.length - 1].now <= bk[bk.length - 1].legacy, 'the short ball hangs a shade longer and the deep ball gets there a shade sooner', `${bk[0].px}: ${bk[0].legacy}->${bk[0].now} · ${bk[bk.length - 1].px}: ${bk[bk.length - 1].legacy}->${bk[bk.length - 1].now}`)
ok(sim.byStyle.lob.now > sim.byStyle.touch.now && sim.byStyle.touch.now > sim.byStyle.bullet.now, 'lob > touch > bullet in the mean, as the lead is solved against', `bullet=${sim.byStyle.bullet.now} touch=${sim.byStyle.touch.now} lob=${sim.byStyle.lob.now} ms`)
ok(sim.byStyle.lob.apex > sim.byStyle.bullet.apex * 1.5, 'the arc follows the hang: a lob peaks well above a bullet', `bullet=${sim.byStyle.bullet.apex}px lob=${sim.byStyle.lob.apex}px`)
ok(sim.apexAt != null && sim.apexAt > .5 && sim.apexAt < .7, 'and the ball peaks past halfway, so it comes down steeper than it went up', `apex at ${sim.apexAt == null ? '?' : (sim.apexAt * 100).toFixed(0)}% of the flight (${sim.apexN} flights)`)
const pb = sim.biasedPanic[0] / Math.max(1, sim.biasedPanic[0] + sim.biasedPanic[1]), cb = sim.biasedCalm[0] / Math.max(1, sim.biasedCalm[0] + sim.biasedCalm[1])
ok(sim.nPanic >= 10 && pb > cb + .15 && cb < .2, 'a panicked throw\'s miss is pulled short-and-behind; a calm one\'s is still isotropic', `biased: panicked ${(pb * 100).toFixed(0)}% (${sim.nPanic}) · calm ${(cb * 100).toFixed(0)}% (${sim.nCalm})`)
ok(sim.nPanic >= 10 && sim.dirPanic > sim.dirCalm, 'so the panicked miss points back toward the passer more than the calm one does', `mean |errDir| panicked=${sim.dirPanic && sim.dirPanic.toFixed(2)} calm=${sim.dirCalm && sim.dirCalm.toFixed(2)} rad (π is straight short)`)
ok(sim.wob.hot > sim.wob.calm, 'the wobble rises with panic', `calm=${sim.wob.calm && sim.wob.calm.toFixed(2)} hot=${sim.wob.hot && sim.wob.hot.toFixed(2)}`)
ok(sim.throwawayN >= 1 && sim.throwawayNoThrow === 0, 'every throwaway is preceded by a thrown ball — throw{away:true}', `${sim.throwawayN} throwaways · ${sim.throwawayNoThrow} without a throw`)
ok(sim.throwawayN >= 1 && sim.awayBad === 0 && sim.sameTick === 0 && sim.awayLate === 0, 'and its incomplete{oob,away} lands at the flight\'s end, never on the same tick', `${sim.awayOK} booked at the landing · ${sim.sameTick} same-tick · ${sim.awayLate} off the flight`)
ok(sim.awaySide.top + sim.awaySide.bot === sim.awayOK, 'aimed past the NEAR sideline, whichever side he is on', `top=${sim.awaySide.top} bottom=${sim.awaySide.bot}`)
ok(sim.oobInc >= 1, 'an ordinary miss can leave the field — incomplete{oob:true}', `${sim.oobInc} of ${sim.incTotal} incompletions out of bounds`)

// ================= 2. the picture: the spin and the wobble ride the throw =================
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function step(t) { let r = null; try { r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
  let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t))
  if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis }) } catch (e) { r = 'ERR ' + e.message }
  console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900) }
// the live field occasionally does not mount behind the loader on a cold browser; one more try
let scene = false
for (let attempt = 0; attempt < 2 && !scene; attempt++) {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)
  await page.evaluate(p => { window.__readPos = p }, process.env.READ_POS || 'QB')
  for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
  for (let i = 0; i < 80; i++) { scene = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length)); if (scene) break; await page.waitForTimeout(500) }
  console.log('scene:', scene, attempt ? '(retry)' : '')
}
// a real priced ball first: a FieldSim throw carries vel/wobble/dur/apex, and the ball block
// reports them (legacy-choreographer plays price nothing, so those never fill `byStyle`)
const MS = +(process.env.LIVE_MS || 150000), t0 = Date.now()
let H = null
while (Date.now() - t0 < MS) {
  H = await page.evaluate(() => { const H = window.__V109_A || {}; return { last: H.last || null, byStyle: H.byStyle || {} } })
  if (Object.keys(H.byStyle).length) break
  await page.waitForTimeout(300)
}
console.log('live:', JSON.stringify(H))
const S = H && H.byStyle || {}, seen = Object.values(S)[0]
ok(!!(seen && seen.vel != null && seen.wobble != null && seen.dur != null && seen.apex != null && seen.spinRate != null),
  'the renderer reads the ball\'s numbers off the throw — __V109_A.last = {vel, wobble, dur, apex, spinRate}', seen ? JSON.stringify(seen) : 'no priced ball drawn in ' + MS + 'ms')
// then the same ball block driven with a bullet's numbers and a lob's, so the comparison does not
// wait on the play-caller: the renderer reads P.ballVelV109 / P.ballWobbleV109 every flight frame
const inj = await page.evaluate(async () => {
  const sc = window.__gridironScene, out = {}
  for (const [s, v, w] of [['bullet', .425, .9], ['lob', .228, .05]]) {
    const until = Date.now() + 6000
    while (Date.now() < until) { const P = sc && sc.play
      if (P && P.script) { P.ballMode = 'flight'; P.ballStyle = s; P.ballVelV109 = v; P.ballWobbleV109 = w; P.ballDurV109 = 600; P.ballApexV109 = 30; if (P.ballReleaseAt == null) P.ballReleaseAt = P.t }
      await new Promise(r => setTimeout(r, 120))
      const B = window.__V109_A && window.__V109_A.byStyle && window.__V109_A.byStyle[s]
      if (B && B.vel === v) { out[s] = B; break } }
  }
  return out
})
console.log('driven:', JSON.stringify(inj))
ok(!!(inj.bullet && inj.lob) && inj.bullet.spinRate > inj.lob.spinRate, 'and a bullet spins faster than a lob',
  inj.bullet && inj.lob ? `bullet=${inj.bullet.spinRate} (${inj.bullet.vel} px/ms) lob=${inj.lob.spinRate} (${inj.lob.vel} px/ms)` : 'drove ' + Object.keys(inj).join(',') || 'nothing')
ok(!!(inj.bullet && inj.lob) && inj.bullet.wobAmp > inj.lob.wobAmp * 2, 'and a hurried ball wobbles wider than a clean spiral',
  inj.bullet && inj.lob ? `wobble .9 -> ${inj.bullet.wobAmp} rad · wobble .05 -> ${inj.lob.wobAmp} rad` : '')

console.log(JSON.stringify({ pass, fail, errors: errs.length, throws: sim.n, throwaways: sim.throwawayN, oob: sim.oobInc, drift: +(drift * 100).toFixed(2) }))
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
