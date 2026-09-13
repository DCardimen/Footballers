// Dev check: v108 — THE EXCHANGE, AND WHICH WAY HE THROWS. Drives a real career onto the live
// field and watches the renderer's own counters (window.__V108) plus the markers' texture keys:
//   * THE THROW HAS A SIDE — spr_<kit>_up_throwR* / _throwL* (and the two exchanges) registered
//     for every kit, cut from the atlas's own cells.
//   * WHICH WAY HE THREW — a ball leaving to the QB's screen-right was drawn on throwR, one to
//     his left on throwL, and the release still lands on frame 4 with the flight (residual 0).
//   * THE EXCHANGE IS DRAWN — a handoff played handoff_up0..4 with frame 2 (the ball at arm's
//     length) on the sim's own handoff event; a toss played toss_up0..4 with frame 3 (the
//     release) on it.
//   * ONE FOOTBALL — over every drawn frame of those cycles the renderer's ball was hidden
//     exactly when the cell draws one and shown when it does not (ballDoubled/ballMissing 0).
//   * THE NUMBER IS STILL ON THE JERSEY — v104's band off each new texture, and the placed box
//     inside it.
//   node scripts/v108check.mjs        (READ_POS=QB, V108_MS=300000, V108_TOSS_MS=90000)
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1200)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const POS = process.env.READ_POS || 'QB'
async function step(t) { let r = null; try { r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
  let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t))
  if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis }) } catch (e) { r = 'ERR ' + e.message }
  console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900) }
await page.evaluate(p => { window.__readPos = p }, POS)
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
let scene = false
for (let i = 0; i < 40; i++) { scene = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length)); if (scene) break; await page.waitForTimeout(400) }
console.log('scene:', scene)
// the live game at its fastest setting — the same plays, four times as many of them per minute
const spd = await page.evaluate(() => { const b = [...document.querySelectorAll('.speed-btn[data-spd]')].sort((x, y) => parseFloat(y.dataset.spd) - parseFloat(x.dataset.spd))[0]
  if (b) b.click(); return window.__getGridironLiveSpeed ? window.__getGridironLiveSpeed() : 1 })
console.log('live speed:', spd)

// ---- the keys behind the states: every new cell registered, per kit, by its pixels ----
const tex = await page.evaluate(() => {
  const sc = window.__gridironScene, out = { kits: [], sig: {}, missing: [] }
  const url = (k) => { try { const im = sc.textures.get(k).getSourceImage(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); return c.toDataURL() } catch (e) { return null } }
  for (const kit of ['off', 'def', 'you']) {
    if (!sc.textures.exists('spr_' + kit + '_up_idle')) continue
    out.kits.push(kit)
    const keys = []
    for (let i = 0; i < 6; i++) { keys.push('up_throwR' + i); keys.push('up_throwL' + i) }
    for (let i = 0; i < 5; i++) { keys.push('up_handoff' + i); keys.push('up_toss' + i) }
    for (const k of keys) if (!sc.textures.exists('spr_' + kit + '_' + k)) out.missing.push(kit + ':' + k)
  }
  for (const k of ['up_throwR0', 'up_throwR2', 'up_throwR4', 'up_throwL0', 'up_throwL2', 'up_throwL4',
    'up_handoff0', 'up_handoff2', 'up_handoff4', 'up_toss0', 'up_toss3', 'up_throw0', 'up_throw4', 'up_idle'])
    out.sig[k] = url('spr_off_' + k)
  return out
})
const same = (a, b) => !!(tex.sig[a] && tex.sig[b] && tex.sig[a] === tex.sig[b])
const have = (a) => !!tex.sig[a]
ok(tex.kits.length >= 2 && tex.missing.length === 0,
  'the four new cycles registered for every kit (throwR, throwL, handoff, toss)', 'kits ' + tex.kits.join(',') + ' · missing ' + (tex.missing.length ? tex.missing.slice(0, 6).join(',') : 'none'))
ok(have('up_throwR0') && have('up_throwL0') && !same('up_throwR0', 'up_throwL0') && !same('up_throwR4', 'up_throwL4') && !same('up_throwR4', 'up_throw4'),
  'the two directions are two different drawings — the left one is not the right one mirrored')
ok(have('up_handoff2') && have('up_toss3') && !same('up_handoff0', 'up_handoff2') && !same('up_handoff2', 'up_handoff4') && !same('up_toss0', 'up_toss3') && !same('up_handoff2', 'up_idle'),
  'the exchange cycles are their own frames — the reach, the arm\'s length and the empty hand differ')

// ---- the v104 bands on the new textures ----
const bands = await page.evaluate(() => {
  const TU = window.TU, B = window.__V104.bands, out = []
  const place = (b, rear) => {
    const room = b.waist - b.top - 0.5, cap = Math.min(TU('numCellH', 6), room), half = cap / 2
    const gap = Math.max(0, Math.min(TU('numWaistGap', 1), room - cap))
    let row = b.waist - (rear ? TU('numRearRise', 8) : TU('numFrontRise', 6))
    const hi = b.top + half + 0.5, lo = b.waist - half - gap
    row = Math.max(hi, Math.min(Math.max(hi, lo), row))
    return { row, cap, inkTop: row - half, inkBot: row + half }
  }
  const keys = []
  for (let i = 0; i < 6; i++) { keys.push('up_throwR' + i); keys.push('up_throwL' + i) }
  for (let i = 0; i < 5; i++) { keys.push('up_handoff' + i); keys.push('up_toss' + i) }
  for (const k of keys) { const b = B['spr_off_' + k]
    out.push(b ? { k, top: b.top, waist: b.waist, w: b.w, rear: place(b, true) } : { k, b: null }) }
  return out
})
const badBand = bands.filter(r => r.b === null || !(r.top < r.waist) || !(r.rear.inkTop >= r.top && r.rear.inkBot <= r.waist) || r.rear.cap < 6 * 0.9)
console.log('bands:', bands.map(r => r.b === null ? r.k + ':none' : `${r.k}:${r.top}-${r.waist}`).join(' '))
ok(badBand.length === 0, 'v104 read a jersey band off every new cell and the number box lands inside it',
  badBand.length ? badBand.map(r => r.k).join(',') : bands.length + ' cells · collar < waist, ink inside the jersey rows')

// ---- the field: an in-page collector on requestAnimationFrame ----
await page.evaluate(({ tossMs }) => {
  const R = window.__v108rec = { thr: {}, ex: {}, forced: 0, plays: 0, t0: Date.now(), lastPlay: null }
  const tick = () => { try { const sc = window.__gridironScene, P = sc && sc.play, ms = (sc && sc.markers) || [], qb = ms[8]
    if (P && qb && qb.tex) {
      let m2 = /_throw([RL])(\d)$/.exec(qb.tex); if (m2) R.thr[m2[1] + m2[2]] = (R.thr[m2[1] + m2[2]] || 0) + 1
      m2 = /_(handoff|toss)(\d)$/.exec(qb.tex); if (m2) R.ex[m2[1] + m2[2]] = (R.ex[m2[1] + m2[2]] || 0) + 1
      // if the playbook has not called a sweep by now, force the family on ONE run play so the
      // pitch cycle is exercised — the same description the renderer's own regex reads
      if (P !== R.lastPlay) { R.lastPlay = P; R.plays++
        const V8 = window.__V108 || {}
        if (Date.now() - R.t0 > tossMs && !(V8.tosses || []).length && !R._forcedOne
            && P.payload && /^run$/i.test(String(P.payload.event)) && (P.script.events || []).some(e => e && e.type === 'handoff')) {
          P.payload.desc = 'Toss Sweep Right'; R._forcedOne = true; R.forced++ }
      }
    } } catch (e) {}
    requestAnimationFrame(tick) }
  requestAnimationFrame(tick)
}, { tossMs: +(process.env.V108_TOSS_MS || 90000) })
const MS = +(process.env.V108_MS || 300000)
const t0 = Date.now()
let lastV = null, R = {}, week = 1, stall = 0, lastPlays = -1
const tap = async (t, ms = 900) => { try { await page.locator('button', { hasText: t }).first().click({ timeout: ms }); return true } catch (e) { return false } }
// one game does not always throw both ways: when the post-game card comes up, take the next week
// live and keep watching (the same walk the season screen does)
async function nextGame() {
  week++
  await page.evaluate(() => { const el = document.getElementById('pgOverlayV13'); if (!el) return
    const b = [...el.querySelectorAll('button')].find(x => /CONTINUE|NEXT|CLOSE/i.test(x.innerText || '')); if (b) b.click(); else el.remove() })
  await page.waitForTimeout(800)
  await tap('PLAY WEEK ' + week + ' LIVE', 2500)
  for (let i = 0; i < 60; i++) {
    const stage = await page.evaluate(() => {
      if (document.getElementById('growthV42')) { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') { g.click(); return 'wheel' } return 'wheel-spinning' }
      if (document.getElementById('pregameV1513')) { window.continuePregameV1513 && window.continuePregameV1513(); return 'watch' }
      const sc = window.__gridironScene; return sc && sc.play ? 'live' : null })
    if (stage === 'live') break
    if (!stage) { if (await tap('CONTINUE TO MATCH', 600)) { await page.waitForTimeout(300); continue }
      const gs = await page.evaluate(() => { const c = document.querySelector('[class*=gs-card]'); if (c) { c.click(); return true } return false }); if (gs) { await page.waitForTimeout(2500); continue } }
    await page.waitForTimeout(500)
  }
  await page.evaluate(() => { const b = [...document.querySelectorAll('.speed-btn[data-spd]')].sort((x, y) => parseFloat(y.dataset.spd) - parseFloat(x.dataset.spd))[0]; if (b) b.click() })
  console.log('>> week', week, 'live')
}
// poll SPARINGLY: an evaluate round trip every frame costs the live game most of its play rate
while (Date.now() - t0 < MS) {
  const st = await page.evaluate(() => ({ V: window.__V108 || null, R: window.__v108rec || null, over: !!document.getElementById('pgOverlayV13') }))
  if (st) { lastV = st.V; R = st.R || {}
    const V = st.V || {}, done = (V.throws || []).filter(r => r.flightStartMs != null)
    if (done.some(r => r.dir === 'R') && done.some(r => r.dir === 'L')
        && (V.handoffs || []).some(h => h.frameAtEvent != null) && (V.tosses || []).some(h => h.frameAtEvent != null)) break
    // the post-game card, or a live view that has stopped producing plays, means this game is done
    if ((R.plays || 0) !== lastPlays) { lastPlays = R.plays || 0; stall = 0 } else stall++
    if ((st.over || stall > 8) && week < 8) { stall = 0; await nextGame() } }
  await page.waitForTimeout(2500)
}
const V = lastV || {}
const done = (V.throws || []).filter(r => r.flightStartMs != null)
const inOrder = (f) => { let p = -1; for (const x of f) { if (x < p) return false; p = x } return true }
const right = done.filter(r => r.dir === 'R'), left = done.filter(r => r.dir === 'L')
const relOk = done.filter(r => r.dir && r.residualMs != null && Math.abs(r.residualMs) <= 85 && r.frames.includes(4) && inOrder(r.frames))
const sideOk = done.filter(r => r.dir && r.targetDx != null && (r.dir === 'R' ? r.targetDx >= 0 : r.targetDx < 0))
console.log('throws:', JSON.stringify(done.slice(-6)))
console.log('handoffs:', JSON.stringify((V.handoffs || []).slice(-5)), 'tosses:', JSON.stringify((V.tosses || []).slice(-5)))
console.log('drawn on the QB:', JSON.stringify({ thr: R.thr, ex: R.ex, forcedToss: R.forced, plays: R.plays }))
console.log('one ball:', JSON.stringify({ ballFrames: V.ballFrames, ballDoubled: V.ballDoubled, ballMissing: V.ballMissing, last: V.last }))
console.log('dirs:', JSON.stringify(done.map(r => r.dir)), '· exchanges skipped (the back came off his left):', V.skippedLeft || 0, JSON.stringify(V.skips || []))
ok(right.length >= 1 && (R.thr || {}).R4 > 0, 'a throw to his screen-RIGHT was drawn on the throwR cycle',
  `${right.length} right-hand throws · frames ` + JSON.stringify(R.thr))
ok(left.length >= 1 && (R.thr || {}).L4 > 0, 'and one to his LEFT came across the body on throwL',
  `${left.length} left throws · targetDx ` + left.map(r => r.targetDx).join(','))
ok(sideOk.length === right.length + left.length && sideOk.length >= 2, 'every drawn direction matches the side the target was on',
  sideOk.length + '/' + (right.length + left.length))
ok(relOk.length >= 1 && relOk.length >= right.length + left.length - 1, 'the release is still frame 4, on the tick the flight starts',
  'residuals ' + done.filter(r => r.dir).map(r => r.residualMs).join(',') + ' ms')
const hOK = (V.handoffs || []).filter(h => h.frameAtEvent === 2)
const tOK = (V.tosses || []).filter(h => h.frameAtEvent === 3)
ok(hOK.length >= 1 && (R.ex || {}).handoff2 > 0, 'a handoff played handoff_up0..4 with the ball at arm\'s length ON the event',
  `${hOK.length}/${(V.handoffs || []).length} handoffs · frames ` + JSON.stringify(R.ex))
ok(tOK.length >= 1 && (R.ex || {}).toss3 > 0, 'and a toss played toss_up0..4 with the release ON the event',
  `${tOK.length}/${(V.tosses || []).length} tosses` + (R.forced ? ' (one sweep forced onto a run play)' : ''))
ok((V.ballFrames || 0) >= 20 && V.ballDoubled === 0 && V.ballMissing === 0,
  'one football through every drawn frame of those cycles — never two, never none',
  `${V.ballFrames || 0} frames · doubled ${V.ballDoubled} · missing ${V.ballMissing}`)
console.log(JSON.stringify({ pass, fail, errors: errs.length }))
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
