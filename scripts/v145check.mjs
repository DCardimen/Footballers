// Dev check: v145 THE CAMERA FOLLOWS HIM. Drives a real career onto the live field as a WR and,
// sampling the LIVE scene every animation frame, proves:
//   1. Settings offers FOLLOW ME and FOLLOW BALL, appended after the v112 four (indices kept).
//   2. FOLLOW ME frames the you-player: on snaps he is on the field, the camera's centre sits near
//      HIS marker — through the carry, the flight and the loose ball, not only when he has it.
//   3. HE STAYS BIG AND STEADY: his on-screen size (zoom × the marker's own scale) is larger in
//      Follow Me than in Broadcast, and varies less across the play — the field moves, he does not.
//   4. THE FIELD MOVES: the camera pans far more per play in Follow Me than it zooms.
//   5. FOLLOW BALL keeps the ball-holder near the centre and at a steady size.
//   node scripts/v145check.mjs   (GAME_URL=…, READ_POS=WR)
import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'

const URL = GAME_URL
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 400, height: 860 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1500)
await page.waitForFunction(() => typeof window.__simGameV2 === 'function', null, { timeout: 60000 })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const med = xs => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0 }

// ---- 1. the panel
await page.evaluate(() => { try { window.go && window.go('settings') } catch (e) {} })
await page.waitForTimeout(700)
const ui = await page.evaluate(() => ({
  modes: (window.__CAM_MODES_V112 || []).map(m => m.id),
  btns: [...document.querySelectorAll('.camopt112')].map(e => (e.textContent || '').trim()),
  set: (() => { window.camModeSet112(4); const a = [window.__FIELD_FX.cam, (document.getElementById('fxCam_val') || {}).textContent]; window.camModeSet112(0); return a })(),
}))
console.log('panel:', JSON.stringify(ui))
ok(ui.modes.slice(0, 4).join(',') === 'broadcast,tight,wide,fixed' && ui.modes[4] === 'me' && ui.modes[5] === 'ball'
  && ui.btns.includes('Follow Me') && ui.btns.includes('Follow Ball') && ui.set[0] === 4 && ui.set[1] === 'Follow Me',
  'Settings › FIELD VIEW offers Follow Me and Follow Ball after the original four, and the setter reaches __FIELD_FX', ui.btns.join(' / '))
await page.evaluate(() => { try { window.go && window.go('menu') } catch (e) {} })
await page.waitForTimeout(700)

// ---- onto the live field
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const POS = process.env.READ_POS || 'WR'
async function step(t) {
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
await page.evaluate(p => { window.__readPos = p }, POS)
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
let scene = false
for (let i = 0; i < 90; i++) {
  scene = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length))
  if (scene) break
  if (i % 6 === 5) await page.evaluate(({ visSrc }) => {
    const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    for (const w of ['CONTINUE TO MATCH', 'PLAY WEEK', 'CONTINUE', 'NEXT', 'OK']) { const el = els.find(e => txt(e).toUpperCase().includes(w)); if (el) { el.click(); return } }
    const pl = els.find(e => /gs-card/i.test(e.className)); if (pl) pl.click()
  }, { visSrc: vis })
  await page.waitForTimeout(500)
}
ok(scene, 'the live scene is up')

// ---- 2-5. sample each mode in round-robin rounds on live, snapped frames
const run = await page.evaluate(async () => {
  const sc = window.__gridironScene
  const acc = { 0: { off: [], ox: [], oy: [], wallOff: [], clampX: 0, size: [], pan: 0, zoomMove: 0, n: 0, meN: 0, focus: {} }, 4: { off: [], ox: [], oy: [], wallOff: [], clampX: 0, size: [], pan: 0, zoomMove: 0, n: 0, meN: 0, focus: {} },
    5: { off: [], ox: [], oy: [], wallOff: [], clampX: 0, size: [], pan: 0, zoomMove: 0, n: 0, meN: 0, focus: {} } }
  // each mode runs until it has WANT framed frames (or a cap): the you-player is only on the field for
  // his unit's snaps AND his share of them, so a fixed window can land entirely on the sideline
  const WANT = 260, CAP = 75000
  for (const i of [0, 4, 5]) {
    window.camModeSet112(i); const a = acc[i]
    await new Promise(r => setTimeout(r, 700))
    let pc = null; const t0 = performance.now()
    while (a.n < WANT && performance.now() - t0 < (i === 4 ? CAP * 3 : CAP)) {
      await new Promise(r => requestAnimationFrame(r))
      const P = sc.play, c = sc.cameras.main
      if (!P || P.done || P.post || sc._camFlagV112 || P.t <= (P.delay || 0) + 300) { pc = null; continue }
      // who this mode is meant to be on: the you-marker (Follow Me) / the holder (Broadcast, Follow Ball)
      const you = sc.markers[P.featIdx], youOn = you && you.team === 'you' && you.root
      const hid = P.ballHolderId != null ? P.ballHolderId : P.carrierId
      const tgt = i === 4 ? (youOn ? you : null) : (P.ballMode === 'held' && hid != null ? sc.markers[hid] : null)
      if (pc) { a.pan += Math.hypot(c.midPoint.x - pc.x, c.midPoint.y - pc.y); a.zoomMove += Math.abs(c.zoom - pc.z) }
      pc = { x: c.midPoint.x, y: c.midPoint.y, z: c.zoom }
      if (!tgt || !tgt.root) continue
      a.n++; if (i === 4 && youOn) a.meN++
      const hw = 720 / (2 * c.zoom), hh = 576 / (2 * c.zoom)
      const ox = Math.abs(tgt.root.x - c.midPoint.x) / hw, oy = Math.abs(tgt.root.y - c.midPoint.y) / hh
      a.ox.push(ox); a.oy.push(oy)
      // a man the pan cannot reach: the frame is already against the camera's side bound (v145 widens it for the follow cams)
      const bx = c._bounds.x, bw = c._bounds.width
      const wall = hw >= bw / 2 || c.midPoint.x <= bx + hw + 12 || c.midPoint.x >= bx + bw - hw - 12
      a.zMax = Math.max(a.zMax || 0, c.zoom)
      if (wall) { a.clampX++; a.wallOff.push(Math.max(ox, oy)); if (i === 4 && a.clampX % 8 === 0) (a.wallLog = a.wallLog || []).push([Math.round(tgt.root.x), Math.round(tgt.root.y), +c.zoom.toFixed(2), Math.round(c.midPoint.x), +ox.toFixed(2), +oy.toFixed(2), P.ballMode, Math.round(P.t - (P.delay || 0))]); continue }   // the edge-open owns these frames
      a.off.push(Math.max(ox, oy)); a.size.push(c.zoom * Math.abs(tgt.root.scaleY || 1))
    }
  }
  window.camModeSet112(0)
  const f = (window.__V112_E || {}).focus || {}
  return { acc, focus: f }
})
const S = {}
for (const i of [0, 4, 5]) {
  const a = run.acc[i], m = a.size.reduce((x, y) => x + y, 0) / Math.max(1, a.size.length)
  const sd = Math.sqrt(a.size.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.size.length))
  const w = a.wallOff.slice().sort((x, y) => x - y)
  S[i] = { n: a.size.length, wallP90: +(w[Math.floor(w.length * .9)] || 0).toFixed(3), zMax: +(a.zMax || 0).toFixed(2), ox: +med(a.ox).toFixed(3), oy: +med(a.oy).toFixed(3), wall: a.clampX, off: +med(a.off).toFixed(3), size: +m.toFixed(3), cv: +(sd / Math.max(1e-6, m)).toFixed(3), panPerZoom: +(a.pan / Math.max(1e-3, a.zoomMove * 100)).toFixed(2) }
}
console.log('wall log:', JSON.stringify(run.acc[4].wallLog || []))
console.log('modes:', JSON.stringify(S), 'focus:', JSON.stringify(run.focus))
ok((run.focus.me || 0) > 100, 'the renderer framed the you-player by name (focus kind "me")', `me frames ${run.focus.me || 0}`)
ok(S[4].n > 40 && S[4].off < 0.3, 'Follow Me keeps HIM near the middle of the frame', `median offset ${S[4].off} of the half frame over ${S[4].n} frames (broadcast on the ball: ${S[0].off})`)
ok(S[4].size > S[0].size * 1.15, 'Follow Me draws him bigger than Broadcast draws the ball-carrier', `${S[4].size} vs ${S[0].size}`)
ok(S[4].cv < 0.12, 'and his size barely changes through the play — the field moves, he does not', `coefficient of variation ${S[4].cv} (broadcast ${S[0].cv})`)
ok(S[4].wall < 20 || S[4].wallP90 < 0.9, 'and when he is split out on the sideline, where the pan meets the painted field, he stays inside the frame', `p90 offset ${S[4].wallP90} over ${S[4].wall} wall frames`)
ok(S[5].n > 60 && S[5].off < 0.25 && S[5].size > S[0].size * 1.1, 'Follow Ball keeps the carrier centred and big', `median offset ${S[5].off}, size ${S[5].size} vs broadcast ${S[0].size}`)
console.log('\npage errors:', errs.length ? errs.slice(0, 8) : 'none')
console.log(`\n${pass} ok, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
