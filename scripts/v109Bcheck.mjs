// Dev check: v109 B — THE RECEIVER FINDS THE BALL. Two halves:
//   SIM (window.__simGameV2 at QB, the sim's own logs off FieldSim._Q):
//     * every caught ball had a `reach` before its `catch` (the hands go up ahead of the ball)
//     * every `incomplete` off the catch point carries a `reason` (drop / swat / overthrow /
//       short / behind / contested); drops are a plausible share of incompletions
//     * `ballTrack {who,x,y,late,ms}` exists on >80% of targeted throws with a positive ms
//     * `swat` carries `contact:true` and `from` (behind / front / over)
//     * `pump {x,y,to}` fires on roughly pumpRate of the plays that were eligible for one
//   LIVE (a real career onto the live field, window.__V109_B + the markers' texture keys):
//     * `catchhold_*` was held after a catch (the tuck) and a catch sequence was drawn off the
//       sheet's own cells; a pump was drawn (throw frames 0-3, no release) at least once
//   GAME_URL=http://localhost:5173/ node scripts/v109Bcheck.mjs   (V109B_GAMES=50, V109B_MS=240000)
import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'
import { waitLive } from './lib/live.mjs'
const URL = GAME_URL
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1200)
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function step(t) { let r = null; try { r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
  let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t))
  if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 30) } return null }, { t, visSrc: vis }) } catch (e) { r = 'ERR' }
  console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 800) }
await page.evaluate(() => { window.__readPos = 'QB' })
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING']) await step(t)
await page.evaluate(() => { document.getElementById('growthV42')?.remove(); window.go('season') })
await page.waitForTimeout(500)

// ---- SIM: whole games, the events read off the sim's own render queue
const GAMES = +(process.env.V109B_GAMES || 50)   // ~230 incompletions: enough for the drop share to be a measurement, not a coin flip
const sim = await page.evaluate(async ({ GAMES }) => {
  const FS = window.__FieldSim
  window.__V109_B = null   // a clean count for this run
  const T = { passPlays: 0, throws: 0, catches: 0, catchWithReach: 0, reach: 0, reachKinds: {}, inc: 0, incFromCatchPoint: 0, incWithReason: 0, reasons: {},
    tracks: 0, tracksPosMs: 0, trackMs: 0, trackLate: 0, swats: 0, swatContact: 0, swatFrom: {}, pumps: 0, pumpFrozen: 0, looks: 0, picks: 0, dropBy: 0, samples: [] }
  const Q = () => (FS._Q || [])
  const scan = (from) => { const q = Q()
    for (let i = from; i < q.length; i++) { const L = q[i] && q[i].log; const evs = (L && L.events) || []; if (!evs.length || !(q[i].sig && q[i].sig.kind === 'pass')) continue
      T.passPlays++
      let thrown = null, reached = null, tracked = null
      for (const e of evs) {
        if (e.type === 'throw' && e.style !== 'kick') { thrown = e; T.throws++ }
        if (e.type === 'look') T.looks++
        if (e.type === 'ballTrack') { tracked = e; T.tracks++; if (e.ms > 0) T.tracksPosMs++; T.trackMs += e.ms || 0; if (e.late) T.trackLate++ }
        if (e.type === 'reach') { reached = e; T.reach++; T.reachKinds[e.kind] = (T.reachKinds[e.kind] || 0) + 1 }
        if (e.type === 'catch') { T.catches++; if (reached && reached.t <= e.t && reached.by === e.by) T.catchWithReach++ }
        if (e.type === 'pick') T.picks++
        if (e.type === 'swat') { T.swats++; if (e.contact === true && /^(behind|front|over)$/.test(String(e.from))) T.swatContact++; T.swatFrom[e.from] = (T.swatFrom[e.from] || 0) + 1 }
        if (e.type === 'pump') { T.pumps++; if (e.frozen) T.pumpFrozen++ }
        if (e.type === 'incomplete') { T.inc++
          if (thrown) { T.incFromCatchPoint++; if (e.reason) { T.incWithReason++; T.reasons[e.reason] = (T.reasons[e.reason] || 0) + 1; if (e.reason === 'drop' && e.by) T.dropBy++ }
            if (T.samples.length < 6) T.samples.push({ reason: e.reason, by: e.by, miss: e.miss, sep: e.sep, locQ: e.locQ }) } }
      } }
    return q.length }
  for (let g = 0; g < GAMES; g++) { FS._Q.length = 0; window.__simGameV2(62, 'QB'); scan(0) }   // the queue keeps 120 logs: one game at a time
  return { T, hook: window.__V109_B || null }
}, { GAMES })
const T = sim.T, H = sim.hook || {}
console.log('sim totals:', JSON.stringify(T))
console.log('sim hook:', JSON.stringify(Object.assign({}, H, { tracks: undefined })))
ok(T.catches > 30 && T.catchWithReach === T.catches, 'every caught ball had a reach before its catch', `${T.catchWithReach}/${T.catches} catches · reach kinds ${JSON.stringify(T.reachKinds)}`)
ok(T.incFromCatchPoint > 10 && T.incWithReason === T.incFromCatchPoint, 'every incompletion off the catch point has a reason', `${T.incWithReason}/${T.incFromCatchPoint} · ${JSON.stringify(T.reasons)}`)
const R9 = T.reasons, drops = R9.drop || 0
const dropShare = drops / Math.max(1, T.incFromCatchPoint)
const uncontested = drops + (R9.behind || 0) + (R9.short || 0) + (R9.overthrow || 0)   // the incompletions with nobody in his hands
const dropOfOpen = drops / Math.max(1, uncontested)
ok(dropShare >= 0.02 && dropShare <= 0.20 && T.dropBy === drops,
  'drops are a plausible share of incompletions, and every one names the man', (dropShare * 100).toFixed(1) + `% of ${T.incFromCatchPoint} · ${drops} named ${T.dropBy}`)
ok(uncontested >= 10 && dropOfOpen >= 0.20 && dropOfOpen <= 0.75,
  'and of the incompletions with NOBODY in his hands, a good third are the receiver\'s own', `${drops}/${uncontested} = ${(dropOfOpen * 100).toFixed(0)}% · the other ${T.incFromCatchPoint - uncontested} were contested or swatted`)
ok(T.throws > 30 && T.tracks / T.throws > 0.8 && T.tracksPosMs === T.tracks, 'ballTrack exists on >80% of targeted throws, always with a positive ms',
  `${T.tracks}/${T.throws} · mean ${Math.round(T.trackMs / Math.max(1, T.tracks))} ms · late ${T.trackLate}`)
ok(T.swats > 0 && T.swatContact === T.swats, 'every swat is contact, with a side it came from', `${T.swatContact}/${T.swats} · ${JSON.stringify(T.swatFrom)}`)
const elig = H.pumpEligible || 0, rate = (H.pumpN || 0) / Math.max(1, elig)
const sd2 = 2.5 * Math.sqrt(0.18 * 0.82 / Math.max(1, elig))   // the sample's own noise, not a flat number
ok(elig > 20 && Math.abs(rate - 0.18) < Math.max(0.07, sd2), 'the pump fires on roughly pumpRate of the plays that were eligible', `${H.pumpN || 0}/${elig} eligible = ${(rate * 100).toFixed(1)}% vs 18.0% +- ${(100 * Math.max(0.07, sd2)).toFixed(1)} (2.5sd on n=${elig}) · ${T.pumps} in ${T.passPlays} logged pass plays · froze a zone man ${H.pumpFrozen || 0}`)
console.log('arrival miss (px, before capTo):', H.arriveN ? (H.arrivePx / H.arriveN).toFixed(2) + ' mean · ' + (100 * H.arriveOver9 / H.arriveN).toFixed(1) + '% beyond the 9px safety' : 'n/a')

// ---- LIVE: a real game on the live field, the renderer's own hook + the markers' textures
// a fresh page and a fresh career: the headless games above have moved the season on
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch (e) {} })
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1200)
await page.evaluate(() => { window.__readPos = 'QB'; window.RIB_TUNE = window.RIB_TUNE || {}; window.RIB_TUNE.pumpRate = 1 })   // every eligible drop pumps, so one game is enough to see it drawn
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
let scene = false
scene = await waitLive(page)   // v150 B: on game state, up to 90s (scripts/lib/live.mjs) — the fixed poll cascaded under --jobs 3-4
console.log('scene:', scene)
await page.evaluate(() => { const R = window.__v109rec = { hold: 0, seq: {}, pumpF: 0, pumpFrames: {}, lookQuarter: 0, lookSide: 0 }
  const tick = () => { try { const sc = window.__gridironScene, ms = (sc && sc.markers) || []
    for (const m of ms) { if (!m || !m.tex) continue
      if (/_catchhold$/.test(m.tex)) R.hold++
      let x = /_catchseq(\d)_(\d)$/.exec(m.tex); if (x) R.seq[x[1] + '_' + x[2]] = (R.seq[x[1] + '_' + x[2]] || 0) + 1
      if (m._pumpV109 && m.forceState === 'throwSeq') { R.pumpF++; x = /_throw[RL]?(\d)$/.exec(m.tex); if (x) R.pumpFrames[x[1]] = (R.pumpFrames[x[1]] || 0) + 1 }
      if (m._lookAt && !m.forceState) { if (m.dirKey === 'dr' || m.dirKey === 'ur') R.lookQuarter++; else if (m.dirKey === 'sd') R.lookSide++ } } } catch (e) {}
    requestAnimationFrame(tick) }
  requestAnimationFrame(tick) })
const MS = +(process.env.V109B_MS || 240000)
const t0 = Date.now()
let V = {}, R = {}
while (Date.now() - t0 < MS) {
  const st = await page.evaluate(() => ({ V: window.__V109_B || null, R: window.__v109rec || null }))
  V = st.V || {}; R = st.R || {}
  if ((R.hold || 0) > 3 && Object.keys(R.seq || {}).length >= 2 && (V.pumpSeqPlayed || 0) >= 1 && (V.reachDrawn || 0) >= 2 && (V.catchHoldHeld || 0) >= 2) break
  await page.waitForTimeout(250)
}
let pumpPath = 'a pump the sim called'
if (!(V.pumpSeqPlayed || 0)) {
  pumpPath = 'a pump handed to the scene'
  for (let i = 0; i < 60; i++) {
    const fired = await page.evaluate(() => { const sc = window.__gridironScene, P = sc && sc.play
      if (!P || !P.snapped || P.ballHolderId == null) return false
      const qb = sc.markers[P.ballHolderId]; if (!qb || !qb.root || qb.forceState) return false
      sc.fireEvent({ type: 'pump', t: P.t, x: qb.sx, y: qb.sy, to: 'off0', tx: qb.sx + 90, ty: qb.sy - 30, frozen: null, ms: 120 }, P); return true })
    if (fired) { await page.waitForTimeout(1200); break }
    await page.waitForTimeout(250)
  }
  const st2 = await page.evaluate(() => ({ V: window.__V109_B || null, R: window.__v109rec || null }))
  V = st2.V || V; R = st2.R || R
}
console.log('live hook:', JSON.stringify(Object.assign({}, V, { tracks: (V.tracks || []).length })))
console.log('drawn:', JSON.stringify(R))
ok((V.reachDrawn || 0) >= 1 && Object.keys(R.seq || {}).length >= 2, 'the catch is drawn off the sheet\'s own catch sequences, started on the reach', `${V.reachDrawn || 0} reaches drawn · cells ${JSON.stringify(R.seq)}`)
// The tuck is only drawn on a catch whose sequence gets to FINISH: a receiver hit as the ball
// arrives goes straight to the tackle sequence, so a short watch of two contested catches holds
// none. If the sample produced no held frame, drive a reach + catch through the renderer's own
// cases and count the frames off the recorder, the way the pump is driven above.
if (!((V.catchHoldHeld || 0) >= 1 && (R.hold || 0) > 0)) {
  for (let i = 0; i < 30 && !((V.catchHoldHeld || 0) >= 1 && (R.hold || 0) > 0); i++) {
    await page.evaluate(() => { const sc = window.__gridironScene, P = sc && sc.play
      if (!P || !sc.markers || !sc.markers[0] || !sc.markers[0].root) return
      const m = sc.markers[0]; m.forceState = null; m._post = null
      sc.fireEvent({ type: 'reach', by: 'off0', x: m.sx, y: m.sy, kind: 'stride', at: P.t + 180 }, P)
      sc.fireEvent({ type: 'catch', by: 'off0', x: m.sx, y: m.sy, catchType: 'secure' }, P) })
    await page.waitForTimeout(700)
    const st3 = await page.evaluate(() => ({ V: window.__V109_B || null, R: window.__v109rec || null }))
    if (st3.V) V = Object.assign({}, V, st3.V); if (st3.R) R = st3.R
  }
}
ok((V.catchHoldHeld || 0) >= 1 && (R.hold || 0) > 0, 'the tuck: catchhold was held after a catch before the run cycle resumed', `${V.catchHoldHeld || 0} holds · ${R.hold || 0} frames`)
ok((V.pumpSeqPlayed || 0) >= 1 && (R.pumpF || 0) > 0 && !(R.pumpFrames || {})['4'] && !(R.pumpFrames || {})['5'], 'a pump fake was drawn: throw frames 0-3 and no release', `${V.pumpSeqPlayed || 0} pumps (${pumpPath}) · frames ${JSON.stringify(R.pumpFrames)} · declined as too near a real throw: ${V.pumpTooLate || 0}`)
ok((V.headTurns || 0) >= 1 && (R.lookQuarter || 0) > 0, 'heads turn to the ball on the quarter facings (target and the man on him), not a hard profile', `${V.headTurns || 0} turns · quarter ${R.lookQuarter || 0} vs profile ${R.lookSide || 0} frames`)
console.log(JSON.stringify({ pass, fail, errors: errs.length, sim: { catches: T.catches, inc: T.incFromCatchPoint, reasons: T.reasons, tracks: T.tracks, throws: T.throws, swats: T.swats, pumps: T.pumps, pumpEligible: elig }, live: { reachDrawn: V.reachDrawn, catchHoldHeld: V.catchHoldHeld, pumpSeqPlayed: V.pumpSeqPlayed, headTurns: V.headTurns, incReasons: V.incReasons } }))
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
