// Dev check: v148 THE LINES HOLD TO THE GOAL LINE. Drives a career onto the live field, freezes the
// scene, and re-lays the field (drawField) with the line of scrimmage at points along a whole drive,
// then measures the projection, the baked turf and the DRAWN frame:
//   1. ONE ROW DENSITY FOR THE WHOLE DRIVE: the rows the yard in front of the LOS gets are the same
//      on the own 3 as on the opponent's 1 (before v148 they fell 2.6x as the drive went on, which is
//      what squashed every line, hash and number near the attacking end zone), at two depths.
//   2. THE PAINT IS WHERE THE PROJECTION SAYS: in the warp canvas, every yard line from the 20 to the
//      goal line, and the end line, is a white run within a fraction of a yard of the row PJ puts it
//      on, straight across the field (the same row at every sampled column), and the end zone keeps
//      its real depth against the 10 yards in front of it.
//   3. THE DRAWN FRAME, IN EVERY CAMERA MODE, AT THE MODE'S OWN ZOOM CEILING: a renderer snapshot
//      centred on the far goal line (and, for the follow cams, pushed out to their widened side
//      bound) finds each predicted yard line straight across the frame and in order, and the LOS and
//      first-down overlays (the blue / gold vector lines) sit on the painted 5-yard and goal lines.
//   4. The near end (LOS on the own 3) still draws the v144 apron and the paint there still registers.
// Usage: npm run dev, then: node scripts/v148check.mjs   (GAME_URL=…, KILL=1 runs with TU("v148",0))
import { chromium } from 'playwright'
import { GAME_URL } from './lib/env.mjs'
const URL = GAME_URL
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 420, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript((kill) => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { dayNightV144: 0, wxV144: 0 }, kill ? { v148: 0 } : {}) }, !!process.env.KILL)
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(URL, { waitUntil: 'networkidle', timeout: 40000 })
await page.waitForTimeout(1200)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function walk() {
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) {
  try {
    await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
      const txt = e => (e.innerText || '').replace(/\s+/g, ' ').trim()
      const el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t))
      if (el) { el.scrollIntoView({ block: 'center' }); el.click() } }, { t, visSrc: vis })
  } catch (e) {}
  await page.waitForTimeout(t === 'PLAN' ? 4000 : 900)
}
  for (let i = 0; i < 60; i++) { const live = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length && window.__FIELDMAP_V72)); if (live) return true; await page.waitForTimeout(400) }
  return false
}
let live = await walk()
if (!live) { await page.goto(URL, { waitUntil: 'networkidle', timeout: 40000 }); await page.waitForTimeout(1200); live = await walk() }   // the walk can miss a button on a slow boot; one more go
ok(live, 'the broadcast is up')
if (!live) { console.log(JSON.stringify({ pass, fail, errors: errs.length })); await browser.close(); process.exit(1) }
await page.waitForTimeout(1500)

// every helper lives in the page; `a` is ATTACK yards (0 = own goal line, 100 = the goal being attacked)
await page.evaluate(() => {
  const sc = window.__gridironScene
  sc.scene.pause()
  const H = window.__H148 = {}
  H.map = () => window.__FIELDMAP_V72
  H.vd = () => { const M = H.map(); return M.pj(M.PLAY_R, 220).y < M.pj(M.PLAY_L, 220).y ? 1 : -1 }
  H.fyd = (a) => H.vd() > 0 ? a : 100 - a                       // attack yards -> drawField's field yards
  H.fxr = (a) => { const M = H.map(); return M.PLAY_L + H.fyd(a) / 100 * (M.PLAY_R - M.PLAY_L) }
  H.pj = (a, v) => H.map().pj(H.fxr(a), v == null ? 220 : (H.vd() > 0 ? v : 440 - v))
  H.lay = (a, tgt) => { sc.drawField(H.fyd(a), H.fyd(tgt == null ? Math.min(100, a + 10) : tgt)); try { sc.drawGoalpostsV87() } catch (e) {} }
  // a painted line is a RIDGE: brighter than the grass around it and colourless. Relative, because the
  // art's 5-yard lines are one faint row of paint, bilinearly stretched into a pale band on the canvas.
  H.lum = (col, y) => { const i = y * 4; return (col[i] + col[i + 1] + col[i + 2]) / 3 }
  H.grey = (col, y) => { const i = y * 4; return Math.max(col[i], col[i + 1], col[i + 2]) - Math.min(col[i], col[i + 1], col[i + 2]) < 70 }
  // the ridge nearest `y` in a column of RGBA data, within +-tol rows: its centre, or null
  H.runAt = (col, h, y, tol) => {
    const y0 = Math.max(0, Math.floor(y - tol)), y1 = Math.min(h - 1, Math.ceil(y + tol))
    const w = Math.max(6, Math.ceil(tol * 2.5)), ring = []
    for (let yy = Math.max(0, y0 - w); yy <= Math.min(h - 1, y1 + w); yy++) if (yy < y0 || yy > y1) ring.push(H.lum(col, yy))
    ring.sort((a, b) => a - b); const base = ring.length ? ring[ring.length >> 1] : 0
    const on = (yy) => H.lum(col, yy) > base + 32 && H.lum(col, yy) > 110 && H.grey(col, yy)
    let best = null
    for (let yy = y0; yy <= y1; yy++) { if (!on(yy)) continue
      let a = yy, b = yy; while (a - 1 >= 0 && on(a - 1)) a--; while (b + 1 < h && on(b + 1)) b++
      const c = (a + b) / 2; if (best == null || Math.abs(c - y) < Math.abs(best - y)) best = c; yy = b }
    return best
  }
  // v positions between the hashes and the numbers, clear of both (and of the centre logo off the 50)
  H.VV = [220 - 130, 220 - 110, 220 - 50, 220 - 30, 220 + 30, 220 + 50, 220 + 110, 220 + 130]
})

// ============================ 1. ONE ROW DENSITY FOR THE WHOLE DRIVE ============================
const D = await page.evaluate(() => {
  const H = window.__H148, out = {}
  for (const dp of [0.78, 0.9]) {
    window.__FIELD_FX.depth = dp; const rows = []
    for (const a of [3, 25, 50, 75, 90, 95, 99]) { H.lay(a); rows.push([a, +(5 * Math.abs(H.pj(a).y - H.pj(a + 1).y)).toFixed(2), +Math.abs(H.pj(a).x - H.pj(a, 320).x).toFixed(2)]) }
    out[dp] = rows
  }
  window.__FIELD_FX.depth = 0.78
  return out
})
for (const dp of Object.keys(D)) {
  const r = D[dp].map(x => x[1]), lat = D[dp].map(x => x[2])
  const spread = Math.max(...r) / Math.min(...r)
  ok(spread < 1.03, `depth ${dp}: the yard in front of the LOS gets the same rows (x5 shown) from the own 3 to the opponent's 1`, D[dp].map(x => `${x[0]}:${x[1]}`).join(' ') + `  (max/min ${spread.toFixed(2)})`)
  const asp = D[dp].map(x => x[1] / x[2]), aspS = Math.max(...asp) / Math.min(...asp)
  ok(aspS < 1.03, `depth ${dp}: and the ground at the LOS keeps one aspect (rows per yard over width per yard) all drive long`, asp.map(v => v.toFixed(3)).join(' '))
}

// ============================ 2. THE PAINT IS WHERE THE PROJECTION SAYS ============================
const W = await page.evaluate(() => {
  const H = window.__H148, sc = window.__gridironScene, out = []
  for (const a of [90, 95, 99, 3]) {
    H.lay(a)
    const cv = sc._warpCv, g = cv.getContext('2d', { willReadFrequently: true }), X0 = (cv.width - 720) / 2
    const lines = a === 3 ? [0, 5, 10, 15, 20, -10] : [80, 85, 90, 95, 100, 110]   // the art paints each end line 10 yards past its goal line
    const res = []
    for (const L of lines) {
      const yA = H.pj(L).y, yd1 = Math.abs(H.pj(L + (L >= 100 ? -1 : 1)).y - yA)
      const tol = Math.max(2.5, yd1 * 0.4), cs = []
      for (const v of H.VV) { const x = Math.round(X0 + H.pj(L, v).x); if (x < 0 || x >= cv.width) continue
        const col = g.getImageData(x, 0, 1, cv.height).data, c = H.runAt(col, cv.height, yA, tol); if (c != null) cs.push(c) }
      res.push({ L, y: +yA.toFixed(1), yd1: +yd1.toFixed(2), tol: +tol.toFixed(1), n: cs.length, of: H.VV.length,
        dev: cs.length ? +Math.max(...cs.map(c => Math.abs(c - yA))).toFixed(2) : null, spread: cs.length ? +(Math.max(...cs) - Math.min(...cs)).toFixed(2) : null })
    }
    const ez = Math.abs(H.pj(110).y - H.pj(100).y), front = Math.abs(H.pj(100).y - H.pj(90).y)
    out.push({ a, res, ez: +ez.toFixed(1), front: +front.toFixed(1), apron: (window.__V144 || {}).apron || null })
  }
  return out
})
for (const w of W) {
  const tag = w.a === 3 ? 'near end (LOS on the own 3)' : `far end (LOS on the ${100 - w.a})`
  const found = w.res.filter(r => r.n >= Math.ceil(r.of * 0.6))
  ok(found.length === w.res.length, `${tag}: every yard line, the goal line and the end line are painted where PJ puts them`, w.res.map(r => `${r.L}@${r.y}:${r.n}/${r.of}${r.dev != null ? ' d' + r.dev : ''}`).join(' '))
  ok(w.res.every(r => r.spread == null || r.spread <= Math.max(1.5, r.yd1 * 0.15)), `${tag}: and each runs straight across the baked field (same row in every column, to a sixth of a yard)`, w.res.map(r => `${r.L}:${r.spread}`).join(' '))
  if (w.a === 3) ok(!!(w.apron && w.apron.on && w.apron.southRows > 0), `${tag}: the v144 apron still runs past the near end line`, JSON.stringify(w.apron))
}

// ============================ 3. THE DRAWN FRAME, IN EVERY MODE ============================
const MODES = [[0, 'Broadcast'], [1, 'Tight'], [2, 'Wide'], [4, 'Follow Me'], [5, 'Follow Ball']]
const F = []
for (const [mode, name] of MODES) for (const side of [0, 1]) for (const a of [95, 99]) {
  const r = await page.evaluate(async ({ mode, side, a }) => {
    const H = window.__H148, sc = window.__gridironScene, cam = sc.cameras.main
    window.camModeSet112(mode); sc.scene.pause()
    H.lay(a, 100)                                   // the blue LOS on the 5 (or the 1), the gold first-down line on the goal line
    // the zoom this mode can reach, and the side bound it may pan to
    const z = sc.camZoomFitV112(99), xb = sc.camSideV145(cam), hw = 720 / (2 * z)
    const g0 = H.pj(100), cx = side ? hw - xb : g0.x
    const hide = []; for (const m of sc.markers || []) if (m.root && m.root.visible) { m.root.setVisible(false); hide.push(m) }
    cam.setZoom(z); cam.centerOn(cx, g0.y + 60 / z)
    const snap = () => new Promise(res => sc.game.renderer.snapshot(img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); res({ w: c.width, h: c.height, d: x.getImageData(0, 0, c.width, c.height).data }) }))
    const both = await snap()
    sc.field.setVisible(false); if (sc.fieldLines) sc.fieldLines.setVisible(false)
    const paint = await snap()
    sc.field.setVisible(true); if (sc.fieldLines) sc.fieldLines.setVisible(true)
    for (const m of hide) m.root.setVisible(true)
    const wv = cam.worldView, sx = (wx) => (wx - wv.x) * cam.zoom, sy = (wy) => (wy - wv.y) * cam.zoom
    const colAt = (D, x) => { const o = new Uint8ClampedArray(D.h * 4); for (let y = 0; y < D.h; y++) for (let k = 0; k < 4; k++) o[y * 4 + k] = D.d[(y * D.w + x) * 4 + k]; return o }
    const cols = H.VV.map(v => ({ v })).filter(c => true)
    const lines = [85, 90, 95, 100, 110], res = []
    for (const L of lines) {
      const y = sy(H.pj(L).y); if (y < 70 || y > paint.h - 6) continue
      const tol = Math.max(3, Math.abs(y - sy(H.pj(L + (L >= 100 ? -1 : 1)).y)) * 0.4), cs = []; let n = 0
      for (const v of H.VV.concat([28, 412])) { const x = Math.round(sx(H.pj(L, v).x)); if (x < 4 || x >= paint.w - 4) continue; n++
        const c = H.runAt(colAt(paint, x), paint.h, y, tol); if (c != null) cs.push({ v, c }) }
      res.push({ L, y: +y.toFixed(1), n, hit: cs.length, cs, dev: cs.length ? +Math.max(...cs.map(q => Math.abs(q.c - y))).toFixed(1) : null,
        spread: cs.length ? +(Math.max(...cs.map(q => q.c)) - Math.min(...cs.map(q => q.c))).toFixed(1) : null, tol: +tol.toFixed(1) })
    }
    // the overlays, found by colour in the full frame, against the painted line they claim to sit on
    const over = []
    for (const [L, blue] of [[a, true], [100, false]]) {
      const P = res.find(q => q.L === L); if (!P) continue
      for (const { v, c } of P.cs) { const x = Math.round(sx(H.pj(L, v).x)); let best = null
        for (let yy = Math.max(0, Math.floor(c - 8)); yy <= Math.min(both.h - 1, Math.ceil(c + 8)); yy++) { const i = (yy * both.w + x) * 4, rr = both.d[i], gg = both.d[i + 1], bb = both.d[i + 2]
          const m = blue ? (bb > 190 && bb - rr > 50) : (rr > 190 && gg > 140 && rr - bb > 60); if (m) { let e = yy; while (e + 1 < both.h) { const j = ((e + 1) * both.w + x) * 4; const r2 = both.d[j], g2 = both.d[j + 1], b2 = both.d[j + 2]; if (blue ? (b2 > 190 && b2 - r2 > 50) : (r2 > 190 && g2 > 140 && r2 - b2 > 60)) e++; else break }
            const cc = (yy + e) / 2; if (best == null || Math.abs(cc - c) < Math.abs(best - c)) best = cc; yy = e } }
        over.push({ L, blue, off: best == null ? null : +(best - c).toFixed(1) }) }
    }
    const e5 = Math.abs(sy(H.pj(95).y) - sy(H.pj(100).y)), eEZ = Math.abs(sy(H.pj(100).y) - sy(H.pj(110).y)) / 2
    for (const q of res) delete q.cs
    // with no yard line in the frame (a follow cam at its widened side bound), the frame must still be
    // PAINTED ground: no void rows, no black past the end of the art
    let voidPx = 0, tot = 0
    for (let y = Math.floor(paint.h * 0.5); y < paint.h; y += 3) for (let x = 0; x < paint.w; x += 3) { const i = (y * paint.w + x) * 4; tot++; if (paint.d[i] + paint.d[i + 1] + paint.d[i + 2] < 36) voidPx++ }
    return { z: +z.toFixed(2), xb, cx: +cx.toFixed(0), res, over, voidShare: +(voidPx / Math.max(1, tot)).toFixed(4), sp5: +(e5 / z).toFixed(2), spEZ: +(eEZ / z).toFixed(2), order: eEZ <= e5 + 0.5 }
  }, { mode, side, a })
  F.push({ mode, name, side, a, ...r })
}
await page.evaluate(() => window.camModeSet112(0))
for (const f of F) {
  const tag = `${f.name} z${f.z}${f.side ? ` at its side bound (${f.cx})` : ''}, LOS on the ${100 - f.a}`
  const inF = f.res.filter(r => r.n > 0)
  if (inF.length) {
    ok(inF.every(r => r.hit >= Math.max(1, Math.ceil(r.n * 0.6))), `${tag}: every yard line in the frame is painted where PJ puts it`, inF.map(r => `${r.L}@${r.y}:${r.hit}/${r.n}${r.dev != null ? ' d' + r.dev : ''}`).join(' '))
    ok(inF.every(r => r.spread == null || r.spread <= 2.5), `${tag}: and runs straight across the frame`, inF.map(r => `${r.L}:${r.spread}`).join(' '))
  } else ok(f.voidShare < 0.01, `${tag}: no yard line reaches this far out, and the frame is painted ground all the same (no void)`, `void ${f.voidShare}`)
  ok(f.order, `${tag}: the spacing shrinks toward the end line, never grows`, `goal-to-5 ${f.sp5}, per 5 yards of end zone ${f.spEZ} (world rows)`)
  const o = f.over.filter(q => q.off != null)
  if (f.over.length) ok(o.length >= f.over.length * 0.8 && o.every(q => Math.abs(q.off) <= Math.max(2, 1.25 * f.z)), `${tag}: the LOS and first-down overlays lie on the painted lines under them (to a world pixel and a quarter)`, o.map(q => (q.blue ? 'B' : 'G') + q.L + ':' + q.off).join(' ') + ` (${o.length}/${f.over.length})`)
}
// the frame changes with the mode's zoom and nothing else: the painted spacing, in world units, is one number
for (const a of [95, 99]) { const w = F.filter(f => f.a === a).map(f => f.sp5)
  ok(Math.max(...w) - Math.min(...w) < 0.3, `LOS on the ${100 - a}: the ground under every mode is the same ground (goal-to-5 in world rows, all modes and bounds)`, w.join(' ')) }
// and the drive does not change it either: goal-to-5 with the LOS on the 5 against the same 5 yards with the LOS on the own 20
const sp20 = await page.evaluate(() => { const H = window.__H148; H.lay(20); return +Math.abs(H.pj(20).y - H.pj(25).y).toFixed(2) })
const spG = F.find(f => f.a === 95).sp5
ok(spG / sp20 > 0.9, 'the 5 yards in front of the goal line are drawn as deep as the 5 yards in front of a drive-start LOS', `${spG} vs ${sp20} (${(spG / sp20).toFixed(2)})`)
const hook = await page.evaluate(() => window.__V148 || null)
ok(!!hook && (process.env.KILL || hook.VB > 0), 'window.__V148 reports the density', JSON.stringify(hook))
console.log('page errors:', errs.length ? errs.slice(0, 5) : 'none')
ok(errs.length === 0, 'no page errors')
console.log(JSON.stringify({ pass, fail, errors: errs.length }))
await browser.close()
process.exit(fail ? 1 : 0)
