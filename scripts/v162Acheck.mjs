// Dev check: v162 A — THE HANDOVER IS SMOOTH (src/05-field-renderer.js), with a LINEBACKER at a 400x860 phone:
//   1. the live loop is held (GridironPhaser.animate / drawStatic stubbed) and the scene is driven with real plays off
//      the game's log, so every count below is one call, not a race with the broadcast
//   2. a change of possession to the OPPONENT (the drive header → `renderStatic`) bakes the field ONCE (it used to bake
//      twice: its own drawField and applyFieldFx → refreshPersp), dresses the eleven by possession (the opponent's
//      offense "def", his defense "off" — v105.2's kit), and leaves HIM in his own team's palette (kitSide "off"), so
//      no "you" recolour runs (__V159A_FIELD regs / clones unchanged)
//   3. the drive's first snap at the same spot (`animatePlay`) does not bake again (a skip), and dresses the same way
//   4. a new spot, a flipped direction, a Settings change (__FIELD_FX) and an explicit refreshPersp all DO bake
//   5. the crowd: after a bake with the stands quiet, the cheer layers' repaints are queued, drained within ~40 frames
//      by the crowd's own tick, and a queued section that heats up is painted at once; the drained cheer canvas is the
//      same picture a non-deferred bake paints (TU v162Acheer 0)
//   6. kill switch TU v162A 0: the header bakes twice and dresses by side (the old path)
//   7. no page errors
//   node scripts/v162Acheck.mjs        (GAME_URL=http://localhost:5173/, READ_POS=LB)
import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'
import { waitLive } from './lib/live.mjs'
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 400, height: 860 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { speedGateV151A: 0 }) })
await page.addInitScript(() => { setInterval(() => { document.querySelector('.onboard')?.remove() }, 60) })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(1200)
await page.waitForFunction(() => typeof window.__simGameV2 === 'function', null, { timeout: 60000 })

// ---- onto the live field (the v145 walk)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
await page.evaluate(p => { window.__readPos = p }, process.env.READ_POS || 'LB')
async function step (t) {
  const r = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    const el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
      : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) }
    return null
  }, { t, visSrc: vis }).catch(e => 'ERR ' + e.message)
  console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900)
}
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
const live = await waitLive(page, 90000)
ok(live, 'the live scene is up')
if (!live) { console.log(errs.join('\n')); await browser.close(); process.exit(1) }
await page.waitForFunction(() => window.__gridironScene && window.__gridironScene.crowd && window.__gridironScene.crowd.built > 4 && window.__V162A, null, { timeout: 30000 })

// ---- hold the broadcast: the log stops advancing, the scene is ours
await page.evaluate(() => {
  window.GridironPhaser.animate = () => true; window.GridironPhaser.drawStatic = () => true
  const sc = window.__gridironScene; try { sc.softStop() } catch (e) {}
})
await page.waitForTimeout(600)

const run = (tune) => page.evaluate(async (tune) => {
  const T = window.RIB_TUNE = window.RIB_TUNE || {}; Object.assign(T, tune)
  const sc = window.__gridironScene, V = window.__V162A, F = window.__V159A_FIELD
  const frames = (n) => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f) })
  const g = (window.__getGridironState && window.__getGridironState()._liveGame) || null
  const plays = (g && g.plays) || []
  const real = (off) => plays.find(p => !p.header && p.event !== 'drive' && (p.event === 'run' || p.event === 'pass' || p.event === 'incomplete') && p.offense === off)
  const pl = real('them'), pu = real('us')
  if (!pl || !pu) return { err: 'no plays in the log', n: plays.length }
  const kits = () => sc.markers.map(m => m.kit === 'you' ? (m.kitSide || 'off') : m.kit)
  const snap = () => ({ bakes: V.bakes, skips: V.skips, regs: F.regs, clones: F.clones, you: JSON.stringify((window.__V105_2 || {}).you || null) })
  const d = (a, b) => ({ bakes: b.bakes - a.bakes, skips: b.skips - a.skips, regs: b.regs - a.regs, clones: b.clones - a.clones })
  const out = {}
  // start from the user's own ball, so the header really is a change of possession
  sc.renderStatic(Object.assign({}, pu, { header: true, event: 'drive', playerPos: 'LB' })); await frames(3)
  let a = snap()
  sc.renderStatic(Object.assign({}, pl, { header: true, event: 'drive', playerPos: 'LB' }))
  let b = snap(); out.header = d(a, b); out.headerKits = kits(); out.headerYou = (window.__V105_2 || {}).you || null
  await frames(3)
  a = snap()
  sc.animatePlay(pl, () => {})
  b = snap(); out.snap = d(a, b); out.snapKits = kits()
  await frames(6); sc.softStop()
  // what does bake
  a = snap(); sc.animatePlay(Object.assign({}, pl, { startBall: Math.max(5, Math.min(90, (pl.startBall || 50) + 9)) }), () => {}); out.newSpot = d(a, snap()); sc.softStop()
  a = snap(); sc.renderStatic(Object.assign({}, pu, { header: true, event: 'drive' })); out.flip = d(a, snap())
  a = snap(); const FX = window.__FIELD_FX; window.__FIELD_FX = Object.assign({}, FX, { depth: ((FX && FX.depth) || 0.78) - 0.05 }); sc.drawField(sc._lastField[0], sc._lastField[1]); out.fx = d(a, snap()); window.__FIELD_FX = FX
  a = snap(); sc.drawField(sc._lastField[0], sc._lastField[1]); out.fxBack = d(a, snap())
  a = snap(); sc.drawField(sc._lastField[0], sc._lastField[1]); out.same = d(a, snap())
  a = snap(); sc.refreshPersp(); out.refresh = d(a, snap())
  return out
}, tune)

const on = await run({ v162A: 1, v162Acheer: 1 })
if (on.err) ok(false, 'real plays to drive the scene with', on)
else {
  const theirOff = on.headerKits.slice(0, 11), ourDef = on.headerKits.slice(11)
  ok(on.header.bakes === 1, 'a change of possession (the drive header) bakes the field ONCE', on.header)
  ok(theirOff.every(k => k === 'def') && ourDef.every(k => k === 'off'), 'the header dresses by possession: their offense "def", his defense "off"', { off: [...new Set(theirOff)], def: [...new Set(ourDef)] })
  ok(on.headerYou && on.headerYou.kitSide !== 'def', 'he keeps his own team\'s palette on the header (kitSide not "def")', on.headerYou)
  ok(on.header.regs === 0 && on.header.clones === 0 && on.snap.regs === 0 && on.snap.clones === 0, 'no kit recolour on the header or the snap', { header: on.header, snap: on.snap })
  ok(on.snap.bakes === 0 && on.snap.skips >= 1, 'the drive\'s first snap at the same spot does not bake again', on.snap)
  ok(on.snapKits.slice(0, 11).every(k => k === 'def') && on.snapKits.slice(11).every(k => k === 'off'), 'the snap dresses the same way as its header', { off: [...new Set(on.snapKits.slice(0, 11))], def: [...new Set(on.snapKits.slice(11))] })
  ok(on.newSpot.bakes === 1, 'a new spot bakes', on.newSpot)
  ok(on.flip.bakes === 1, 'a flipped direction bakes (once)', on.flip)
  ok(on.fx.bakes === 1 && on.fxBack.bakes === 1, 'a Settings change (__FIELD_FX) bakes, and so does changing it back', { fx: on.fx, back: on.fxBack })
  ok(on.same.bakes === 0 && on.same.skips === 1, 'the same call again is answered from the bake on screen', on.same)
  ok(on.refresh.bakes === 1, 'an explicit refreshPersp always bakes', on.refresh)
}

// ---- the crowd's deferred cheer layers
const cheer = await page.evaluate(async () => {
  const sc = window.__gridironScene, C = sc.crowd, T = window.RIB_TUNE, V = window.__V162A
  const frames = (n) => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f) })
  const hash = (cv) => { const x = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 0; for (let i = 0; i < x.length; i += 7) h = (h * 31 + x[i]) >>> 0; return h + ':' + cv.width + 'x' + cv.height }
  T.crowdAmbientMs = 1e9; for (const s of C.secs) { s.heat = 0; s.pendAmt = 0 }
  const c0 = V.cheers
  sc.refreshPersp()
  const queued = C.jobsV162A || 0, pending = C.secs.slice(0, C.built).filter(s => s.cheerJobV162A).length
  // a queued section that heats up is painted on its next tick
  const hot = C.secs.slice(0, C.built).find(s => s.cheerJobV162A)
  if (hot) hot.heat = 0.8
  await frames(2)
  const hotDone = hot ? !hot.cheerJobV162A : null
  await frames(40)
  const left = C.jobsV162A || 0, drained = V.cheers - c0
  const deferred = C.secs.slice(0, C.built).map(s => hash(s.cv.cheer))
  const geomOk = C.secs.slice(0, C.built).every(s => s.spr.cheer.visible && Math.abs(s.spr.cheer.x - s.bx) < 4 && Math.abs(s.spr.cheer.y - s.by) < 4)
  for (const s of C.secs) { s.heat = 0; s.pendAmt = 0 }
  T.v162Acheer = 0; sc.refreshPersp()
  const direct = C.secs.slice(0, C.built).map(s => hash(s.cv.cheer)), q0 = C.jobsV162A || 0
  T.v162Acheer = 1; delete T.crowdAmbientMs
  return { queued, pending, hotDone, left, drained, same: deferred.filter((h, i) => h === direct[i]).length, n: deferred.length, geomOk, q0 }
})
ok(cheer.queued > 4 && cheer.queued === cheer.pending, 'a bake with the stands quiet queues the cheer repaints', cheer)
ok(cheer.hotDone === true, 'a queued section that heats up is painted on its next tick', cheer)
ok(cheer.left === 0 && cheer.drained >= cheer.queued, 'the queue drains within 40 frames of the crowd\'s tick', cheer)
ok(cheer.geomOk, 'the cheer sprites stand on their new boxes from the bake on (the geometry never waits)', cheer)
ok(cheer.same === cheer.n && cheer.q0 === 0, 'the drained cheer canvases are the picture a non-deferred bake paints (TU v162Acheer 0)', { same: cheer.same, n: cheer.n })

// ---- the kill switch
const off = await run({ v162A: 0 })
if (!off.err) {
  ok(off.header.bakes === 2, 'kill switch TU v162A 0: the header bakes twice again (the old path)', off.header)
  ok(off.headerKits.slice(0, 11).every(k => k === 'off'), 'kill switch: the header dresses by side again (their offense in "off")', [...new Set(off.headerKits.slice(0, 11))])
  ok(off.snap.bakes === 1, 'kill switch: the snap bakes again', off.snap)
}
await page.evaluate(() => { window.RIB_TUNE.v162A = 1 })
ok(errs.length === 0, 'no page errors', errs.slice(0, 4).join(' | '))
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
