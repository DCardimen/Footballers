// Dev check: v105 — THE BALL HAS A HANDLER. Asserts, in one live game:
//   * UNDER CENTER — before the snap of a scrimmage play the ball is at the center's feet (actor
//     5), not on a grass spot and not already in the QB's hand.
//   * THE SNAP IS A HAND — the snap opens a hand (`__V105.snap`), it lasts a real interval, and the
//     ball MOVES through it (its screen position at the hand's open and a few frames later differ).
//   * THE EXCHANGE IS DRAWN — a handoff opens a hand from the QB's hand to the back's (`handoff`);
//     a long one is a toss (reported, not required — the sim decides who gets the ball).
//   * THE TRAIL — the ribbon draws on frames where the ball travels (hands, flights) and on no
//     frame where it rests in a hand; in flight it is the spiral.
//   * THE HEAT — the book is written at the end of every scrimmage play, and with `heatHot`
//     forced to 0 the next travelling ball burns (`flameFrames`).
//   * THE DEPTH — a fresh save opens at 78% field perspective, and the slider says so.
//   node scripts/v105check.mjs        (READ_POS=RB; OUT=<prefix> also writes frame crops)
import { chromium } from 'playwright'
import fs from 'node:fs'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const errs = []
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5175/Footballers/', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)
await page.goto('http://localhost:5175/Footballers/', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(2500)
await page.waitForFunction(() => typeof window.__simGameV2 === 'function', null, { timeout: 60000 })

// ================= 0. the depth default =================
const fx = await page.evaluate(() => ({ depth: window.__FIELD_FX && window.__FIELD_FX.depth, saved: window.o && window.o.settings && window.o.settings.fxDepth }))
ok(fx.depth === 0.78 && fx.saved == null, 'a fresh save opens at 78% field perspective', JSON.stringify(fx))
const slider = await page.evaluate(() => { try { window.go('settings') } catch (e) {} const el = document.querySelector('input.fx-slider[oninput*="fxDepth"]'); const v = document.getElementById('fxDepth_val'); try { window.go('menu') } catch (e) {} return { value: el && el.value, label: v && v.textContent } })
ok(slider.value === '0.78' && slider.label === '78%', 'and the Settings slider defaults to it', JSON.stringify(slider))

await page.evaluate(p => { window.__readPos = p }, process.env.READ_POS || 'RB')
async function step(t) {
  const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
      : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className))
      : els.find(e => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis })
  console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900)
}
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
let scene = false
for (let i = 0; i < 60; i++) { scene = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length)); if (scene) break; await page.waitForTimeout(400) }
ok(scene, 'the broadcast is live')

// ================= 1. the ball through live play =================
const snap = async (path, cx, cy) => { const src = await page.evaluate(() => new Promise(res => { try { window.__gridironScene.game.renderer.snapshot(img => res({ src: img.src, w: img.width, h: img.height })) } catch (e) { res(null) } }))
  if (!src || !process.env.OUT) return
  const out = await page.evaluate(async ({ src, cx, cy }) => { const img = new Image(); img.src = src.src; await img.decode()
    const sc = window.__gridironScene, cam = sc.cameras.main, k = src.w / cam.width, wv = cam.worldView
    const x = (cx - wv.x) * cam.zoom * k, y = (cy - wv.y) * cam.zoom * k, R = 70 * k, Z = 3
    const cv = document.createElement('canvas'); cv.width = R * 2 * Z; cv.height = R * 2 * Z; const c = cv.getContext('2d'); c.imageSmoothingEnabled = false
    c.drawImage(img, x - R, y - R, R * 2, R * 2, 0, 0, cv.width, cv.height); return cv.toDataURL('image/png') }, { src, cx, cy })
  fs.writeFileSync(path, Buffer.from(out.split(',')[1], 'base64')) }
let underCenter = 0, presnapFrames = 0, inQbHandPresnap = 0, restFramesWithTrail = 0, restFrames = 0, travelFrames = 0, travelWithTrail = 0
const hands = []
let snapMove = null, flightSpiral = 0, shots = { snap: 0, hand: 0, flight: 0, flame: 0 }, forcedHot = false, lastV = null, sawScrimmage = false
for (let i = 0; i < 2600; i++) {
  const st = await page.evaluate(() => { const sc = window.__gridironScene, P = sc && sc.play; if (!P || !sc.ballSpr) return null
    const c = sc.markers[5], q = sc.markers[8], b = sc.ballSpr, V = window.__V105 || {}
    const trailOn = !!(sc.ballTrailG && sc.ballTrailG.commandBuffer && sc.ballTrailG.commandBuffer.length > 2)
    return { t: P.t, delay: P.delay || 0, snapped: !!P.snapped, ev: P.payload && P.payload.event, mode: P.ballMode, holder: P.ballHolderId, hand: P._hand ? { kind: P._hand.kind, t0: P._hand.t0, ms: P._hand.ms, toss: P._hand.toss } : null,
      ball: [b.x, b.y], center: c && c.root ? [c.root.x, c.root.y, c.root.scale] : null, qb: q && q.root ? [q.root.x, q.root.y] : null, trailOn,
      V: { hands: V.hands || 0, snap: V.snap || 0, handoff: V.handoff || 0, tosses: V.tosses || 0, handD: P._hand ? P._hand.d : null, trailFrames: V.trailFrames || 0, flameFrames: V.flameFrames || 0, plays: V.plays || 0, heat: V.heat || null, lastHand: V.lastHand || null } } })
  if (st) {
    lastV = st.V
    const scrim = /^(run|pass|incomplete|sack|turnover)$/.test(String(st.ev))
    if (scrim) sawScrimmage = true
    // the set phase: the huddle glide is over (the ball is on the grass at the spot until then) and the snap has not come
    if (scrim && !st.snapped && st.t > st.delay + 60 && st.center) { presnapFrames++
      if (presnapFrames === 6 && process.env.OUT) await snap(`${process.env.OUT}_set.png`, st.center[0], st.center[1] + 8 * (st.center[2] || 1))   // the set phase, on the center
      const s = st.center[2] || 1, dx = Math.abs(st.ball[0] - st.center[0]) / s, dy = (st.ball[1] - st.center[1]) / s
      if (dx < 7 && dy > 5 && dy < 20) underCenter++
      // the QB's hand, as the renderer mounts a held ball: eight and a half px to the side, a hair up
      if (st.qb && Math.min(Math.hypot(st.ball[0] - (st.qb[0] + 8.5 * s), st.ball[1] - (st.qb[1] - 3.5 * s)), Math.hypot(st.ball[0] - (st.qb[0] - 8.5 * s), st.ball[1] - (st.qb[1] - 3.5 * s))) < 5 * s) inQbHandPresnap++ }
    if (st.hand) { travelFrames++; if (st.trailOn) travelWithTrail++
      if (st.hand.kind === 'handoff' && st.V.lastHand) hands.push({ toss: st.hand.toss, d: st.V.handD, desc: st.V.lastHand.desc })
      if (st.hand.kind === 'snap') { if (!snapMove || snapMove.t0 !== st.hand.t0) snapMove = { t0: st.hand.t0, x0: st.ball[0], y0: st.ball[1], moved: snapMove ? snapMove.moved : 0 }   // the best any snap managed: the sampler may catch a zap on one frame only
        else snapMove.moved = Math.max(snapMove.moved, Math.hypot(st.ball[0] - snapMove.x0, st.ball[1] - snapMove.y0))
        if (shots.snap < 3 && process.env.OUT && st.center) { shots.snap++; await snap(`${process.env.OUT}_snap${shots.snap}.png`, st.center[0], st.center[1] + 14 * (st.center[2] || 1)) } }   // framed on the center: the ball is somewhere between him and the QB
      else if (shots.hand < 3 && process.env.OUT) { shots.hand++; await snap(`${process.env.OUT}_hand${shots.hand}${st.hand.toss ? '_toss' : ''}.png`, st.ball[0], st.ball[1]) } }
    else if (st.mode === 'flight') { travelFrames++; if (st.trailOn) { travelWithTrail++; flightSpiral++ }
      if (shots.flight < 3 && process.env.OUT && st.trailOn) { shots.flight++; await snap(`${process.env.OUT}_flight${shots.flight}${forcedHot ? '_flame' : ''}.png`, st.ball[0], st.ball[1]) } }
    else if (st.mode === 'held' && st.snapped && st.holder != null && !forcedHot) { restFrames++; if (st.trailOn) restFramesWithTrail++ }
    // once the book has two plays in it, force the line to zero and watch the next ball burn
    if (!forcedHot && st.V.plays >= 2) { forcedHot = true; await page.evaluate(() => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { heatHot: 0 }) }) }
    if (forcedHot && st.V.flameFrames > 40 && shots.flame < 1 && process.env.OUT && st.trailOn) { shots.flame++; await snap(`${process.env.OUT}_flame.png`, st.ball[0], st.ball[1]) }
    if (st.V.handoff >= 1 && st.V.snap >= 2 && flightSpiral > 10 && st.V.flameFrames > 40 && st.V.plays >= 3 && presnapFrames > 30) break
  }
  await page.waitForTimeout(35)
}
await page.evaluate(() => { if (window.RIB_TUNE) delete window.RIB_TUNE.heatHot })
console.log('counters', JSON.stringify({ presnapFrames, underCenter, inQbHandPresnap, travelFrames, travelWithTrail, restFrames, restFramesWithTrail, flightSpiral, snapMove, V: lastV && { ...lastV, heat: undefined }, heat: lastV && lastV.heat }))
ok(sawScrimmage && presnapFrames > 8, 'scrimmage plays were watched from before the snap', `${presnapFrames} pre-snap frames`)
ok(presnapFrames > 0 && underCenter / presnapFrames > 0.85, 'before the snap the ball is under CENTER — at his feet, on the line', `${underCenter}/${presnapFrames} frames`)
ok(presnapFrames > 0 && inQbHandPresnap / presnapFrames < 0.15, 'and NOT already in the quarterback\'s hand', `${inQbHandPresnap}/${presnapFrames} frames near the QB`)
ok(lastV && lastV.snap >= 1 && lastV.lastHand && lastV.lastHand.ms >= 80, 'the snap opens a hand that lasts a real interval', JSON.stringify(lastV && lastV.lastHand))
ok(snapMove && snapMove.moved > 6, 'and the ball MOVES through it — center to quarterback', snapMove && `${snapMove.moved.toFixed(1)}px across the hand`)
const handKinds = [...new Map(hands.map(h => [h.desc + h.d, h])).values()]
ok(lastV && lastV.handoff >= 1, 'the exchange to the back is drawn as a hand', lastV && `${lastV.handoff} handoffs, ${lastV.tosses} of them tosses · ` + handKinds.map(h => `${h.toss ? 'TOSS' : 'hand'} d${h.d} "${h.desc}"`).join(' | '))
ok(travelFrames > 10 && travelWithTrail / travelFrames > 0.6, 'the trail draws while the ball travels — hands and flights', `${travelWithTrail}/${travelFrames} travelling frames carried a ribbon`)
ok(restFrames > 10 && restFramesWithTrail / restFrames < 0.05, 'and never while it rests in a hand', `${restFramesWithTrail}/${restFrames} resting frames`)
ok(flightSpiral > 10, 'in flight it is the spiral', `${flightSpiral} flight frames`)
ok(lastV && lastV.plays >= 2 && lastV.heat && Object.keys(lastV.heat).length > 0, 'the heat book is written at the end of every scrimmage play', lastV && JSON.stringify(lastV.heat))
ok(lastV && lastV.flameFrames > 40, 'with the line at zero, the next travelling ball burns', lastV && `${lastV.flameFrames} flame frames`)

console.log(JSON.stringify({ pass, fail, errors: errs.length }))
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
