// Dev check: v72 — the painted field and the simulated field are the same field.
//
// warpField sampled the turf art by mapping its FULL HEIGHT onto the world's full
// width. That assumed the art's painted end zones are exactly EZ deep and that it
// has no apron outside them; it has a 10-yard end zone at each end and ~6 yards of
// grass beyond that, so the painted 100 yards covered 542 world px against the
// sim's 588. Every painted yard line sat off the sim's own, worst at the goal line:
// a carrier the sim had at the 0 was drawn four yards deep in the end zone.
//
// The check measures the art's goal-line rows ITSELF (so it cannot just agree with
// whatever the game measured), then asserts three things end to end:
//   1. the game found the same rows
//   2. the sim's goal lines map exactly onto the painted ones
//   3. on the WARPED canvas, the far painted goal line lands where PJ puts the sim's
//      far goal line — which is the thing you actually see
import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => {
  setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60)
})
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 25000 })
await page.waitForTimeout(1400)

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }

const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  const r = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t === 'ARCH') el = els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
    else el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false
  }, { t, visSrc: vis })
  await page.waitForTimeout(800); return r
}

// ---- 1. measure the art independently, before touching the game's answer
const art = await page.evaluate(async () => {
  const src = window.__RIB_FIELD
  if (!src) return { why: 'no field art on the page' }
  const im = new Image()
  await new Promise((r, j) => { im.onload = r; im.onerror = j; im.src = src })
  const W = im.width, H = im.height
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0)
  const d = g.getImageData(0, 0, W, H).data
  const xa = Math.round(W * 0.2), xb = Math.round(W * 0.8)
  const grass = []
  for (let y = 0; y < H; y++) {
    let n = 0, k = 0
    for (let x = xa; x < xb; x++) { const i = (y * W + x) * 4; k++
      if (d[i + 1] > d[i] + 10 && d[i + 1] > d[i + 2] + 10) n++ }
    grass.push(n / k > 0.5)
  }
  // close the white yard lines, then take the longest grass run as the playing surface
  const runs = []; let s0 = 0
  for (let y = 1; y <= H; y++) { if (y < H && grass[y] === grass[s0]) continue
    runs.push({ g: grass[s0], y0: s0, y1: y - 1, n: y - s0 }); s0 = y }
  for (const r of runs) if (!r.g && r.n < 16) for (let y = r.y0; y <= r.y1; y++) grass[y] = true
  let best = null; s0 = 0
  for (let y = 1; y <= H; y++) { if (y < H && grass[y] === grass[s0]) continue
    if (grass[s0] && (!best || y - s0 > best.n)) best = { y0: s0, y1: y - 1, n: y - s0 }
    s0 = y }
  const ppy = best.n / 100
  const ezTop = runs.filter(r => !r.g && r.y1 < best.y0).reduce((a, r) => a + r.n, 0)
  const ezBot = runs.filter(r => !r.g && r.y0 > best.y1).reduce((a, r) => a + r.n, 0)
  return { size: W + 'x' + H, y0: best.y1 + 0.5, y100: best.y0 - 0.5, field: best.n,
    ezTopYd: +(ezTop / ppy).toFixed(2), ezBotYd: +(ezBot / ppy).toFixed(2) }
})
console.log('art measured independently:', JSON.stringify(art))
ok(!art.why, 'the field art is on the page', art.size)
ok(Math.abs(art.ezTopYd - 10) < 1.2 && Math.abs(art.ezBotYd - 10) < 1.2,
  'the art paints a real ten-yard end zone at each end', art.ezTopYd + 'yd / ' + art.ezBotYd + 'yd')

// ---- get onto a live field so the map is built
await click('START NEW CAREER')
for (let i = 0; i < 8; i++) {
  const done = await page.evaluate(({ visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    for (const want of ['START YOUR LEGACY', 'Lock In Personality']) {
      const b = els.find(e => txt(e).includes(want)); if (b) { b.click(); return false }
    }
    const card = els.find(e => e.classList.contains('pos-card') || /^[A-Z]{1,2} /.test(txt(e)))
    if (card) { card.click(); return false }
    return true
  }, { visSrc: vis })
  await page.waitForTimeout(500)
  if (done) break
}
for (const s of ['PLAY 8-GAME SEASON', 'Balanced Program', 'PLAY WEEK 1 LIVE']) await click(s)
for (let i = 0; i < 40; i++) {
  const done = await page.evaluate(() => {
    const g = document.getElementById('gv42go')
    if (g && g.style.display !== 'none') { g.click(); return false }
    document.getElementById('gv62card')?.click()
    return !document.getElementById('growthV42')
  })
  if (done) break
  await page.waitForTimeout(250)
}
await click('CONTINUE TO MATCH')
let map = null
for (let i = 0; i < 60; i++) {
  map = await page.evaluate(() => {
    const M = window.__FIELDMAP_V72
    if (!M || !window.__gridironScene) return null
    return { rows: M.rows, PLAY_L: M.PLAY_L, PLAY_R: M.PLAY_R, FW: M.FW, EZ: M.EZ,
      atGoal0: +M.artY(M.PLAY_L).toFixed(2), atGoal100: +M.artY(M.PLAY_R).toFixed(2),
      at50: +M.artY((M.PLAY_L + M.PLAY_R) / 2).toFixed(2),
      atNearEdge: +M.artY(0).toFixed(2), atFarEdge: +M.artY(M.FW).toFixed(2) }
  })
  if (map) break
  await page.waitForTimeout(400)
}
console.log('game map:', JSON.stringify(map))
ok(!!map, 'the live field built a goal-line map')
if (map) {
  ok(map.rows.src === 'measured', 'the game measured the rows off the art rather than using the fallback', map.rows.src)
  ok(Math.abs(map.rows.y0 - art.y0) < 2 && Math.abs(map.rows.y100 - art.y100) < 2,
    'and found the same goal lines this check found independently',
    `game ${map.rows.y0}/${map.rows.y100} vs check ${art.y0}/${art.y100}`)
  ok(Math.abs(map.atGoal0 - art.y0) < 1 && Math.abs(map.atGoal100 - art.y100) < 1,
    'the SIM goal lines land exactly on the PAINTED goal lines',
    `yard 0 -> row ${map.atGoal0} (painted ${art.y0}) · yard 100 -> row ${map.atGoal100} (painted ${art.y100})`)
  // and the fix is a real move: the old full-height map put yard 0 four yards off
  const oldRow = (1 - map.PLAY_L / map.FW) * (art.size.split('x')[1] | 0)
  const ppy = (art.y0 - art.y100) / 100
  ok(Math.abs(oldRow - art.y0) / ppy > 2,
    'and the old full-height map really was yards out at the goal line',
    ((oldRow - art.y0) / ppy).toFixed(1) + ' yards')
  // the whole world still has art under it — no row falls outside the image
  const H = art.size.split('x')[1] | 0
  ok(map.atNearEdge <= H && map.atFarEdge >= 0,
    'the whole world width still samples inside the art — the apron beyond each end line is real grass',
    `u=0 -> row ${map.atNearEdge} (art is ${H} tall) · u=FW -> row ${map.atFarEdge}`)
}

// ---- 3. end to end: on the WARPED canvas, does the painted far goal line land
// where the projection puts the sim's far goal line?
const onScreen = map ? await page.evaluate(() => {
  const sc = window.__gridironScene
  const cv = sc && sc._warpCv
  if (!cv) return { why: 'no warp canvas' }
  const g = cv.getContext('2d', { willReadFrequently: true })
  const d = g.getImageData(0, 0, cv.width, cv.height).data
  // sample a NARROW band on the centre line. Up at the far end the perspective has
  // squeezed the field to a few dozen pixels and warpField edge-extends the art's
  // outermost (green) columns across the rest of the row, so a wide window reads
  // that margin as turf and finds the goal line ten yards early.
  const xa = Math.round(cv.width * 0.492), xb = Math.round(cv.width * 0.508)
  // walk DOWN from the top of the turf: backdrop, then the far end zone, then grass.
  // Six consecutive grass rows, so one noisy row cannot call it.
  let firstGrass = -1, run = 0
  for (let y = 0; y < cv.height; y++) {
    let n = 0, k = 0
    for (let x = xa; x < xb; x++) { const i = (y * cv.width + x) * 4; k++
      if (d[i + 1] > d[i] + 10 && d[i + 1] > d[i + 2] + 10) n++ }
    if (n / k > 0.5) { if (++run >= 6) { firstGrass = y - 5; break } } else run = 0
  }
  // ...and where the projection puts the SIM's far goal line. The warp canvas is
  // 1200px wide against a 720px world but shares its rows one for one, so the y is
  // directly comparable — which is what makes this the end-to-end assertion.
  const M = window.__FIELDMAP_V72
  const mid = (M.F_TOP + M.F_BOT) / 2
  // which goal line is the FAR one depends on which way the offense is driving (PJ
  // flips x for a north-south camera), so take whichever projects highest up-screen
  const yd = (M.PLAY_R - M.PLAY_L) / 100
  const a = M.pj(M.PLAY_L, mid).y, b = M.pj(M.PLAY_R, mid).y
  const farIsL = a < b
  const proj = +Math.min(a, b).toFixed(1)
  // one yard ON SCREEN at that end, so the tolerance is in football units, not pixels
  const near = farIsL ? M.pj(M.PLAY_L + yd, mid).y : M.pj(M.PLAY_R - yd, mid).y
  const oneYd = Math.abs(near - proj)
  return { firstGrass, proj, oneYd: +oneYd.toFixed(2), offYd: +((firstGrass - proj) / oneYd).toFixed(2) }
}) : { why: 'no live field' }
console.log('warped canvas:', JSON.stringify(onScreen))
ok(!onScreen.why && onScreen.firstGrass > 0, 'the warped turf has a far end zone painted on it',
  'first grass row ' + onScreen.firstGrass)
ok(!onScreen.why && Math.abs(onScreen.offYd) < 0.6,
  'the painted far goal line lands where the projection puts the sim far goal line',
  onScreen.offYd + ' yards apart (' + (onScreen.firstGrass - onScreen.proj).toFixed(1) + 'px, one yard is ' + onScreen.oneYd + 'px there)')

console.log('page errors:', errs.length ? '\n' + errs.join('\n') : 'NONE')
console.log('VERDICT: ' + (fail === 0 && errs.length === 0 ? 'PASS' : 'FAIL') + `  (${pass} ok, ${fail} failed)`)
await browser.close()
process.exitCode = fail === 0 && errs.length === 0 ? 0 : 1
