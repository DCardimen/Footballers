// Dev check: v193 AG — THE FIELD PASS (src/05-field-renderer.js — the live broadcast).
//   TUNNELS: exactly two ways out of the far bowl, one in each corner where it turns into a sideline, none in the middle
//        (`__V144.tunnels`: mid false, corners 2, every mouth at < 0.2 or > 0.8 along the bowl).
//   FAR STANDS: the northern blank is filled — the club level, the upper deck, the roof fascia and the canopy stand above
//        the bowl's rim (`__V193AG.stands`), and the frame between the roof and the rim is drawn stadium, not the flat sky
//        it is with the kill switch (pixels sampled off the drawn frame, both sides of the screen).
//   DIRT: `__V193AG.dirt(x, y, strength)` lays a solid scuff INTO the turf at that field spot (the warp canvas changes
//        there, to dirt), a stronger hit paints a bigger mark, it is still there after N frames and after a snap's
//        re-bake, it fades out by snap count, the count is capped (`dirtMaxV193AG`), and a real tackle in a live game
//        lays one.
//   TURF: the composite is 2x the art (`warpAK`), and the mowing stripes are in the baked turf.
//   PITCH: at the lowest and the highest field perspective (0% / 90%), the stand rows stay parallel to the field edge
//        along both sidelines, the bowl's top stays above the far end line, and at 0% the ground runs on to the bowl's
//        foot (no sky between the grass and the stand).
//   CAMERA: a frame wider than the field (the zoom floor) is centred on it.
//   KILL SWITCH: TU v193AG 0 brings the middle arch back, takes the far stands and the dirt away, composites at 1x.
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v193AGcheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } })
await ctx.addInitScript(() => {
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { dayNightV144: 0, wxV144: 0 })
  try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off'); localStorage.setItem('rib.sprayHint.v170', '1') } catch {}
  setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80)
})
const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e.message || e)))
await p.goto(U, { waitUntil: 'networkidle', timeout: 90000 })
await p.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V170, null, { timeout: 60000 })
await p.waitForTimeout(600); await p.evaluate(() => document.getElementById('splash')?.remove())
await p.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S)
  S.player = A.newPlayer(); const pl = S.player; pl.name = 'Test Man'; pl.pos = 'LB'; pl.age = 16; pl.originV11 = 'walk-on'; pl._wonShown = true; pl.level = 6
  for (const k in pl.attrs) pl.attrs[k] = 60; A.startSeasonGames(); window.go('season')
})
await p.waitForTimeout(400)
await p.evaluate(() => window.prepareWeek103(true)); await p.waitForTimeout(1200)
await p.evaluate(() => window.__v112SkipD())
const up = await p.waitForFunction(() => window.S && window.S.view === 'live' && window.__gridironScene && window.__FIELDMAP_V72 && window.__gridironScene.fieldSpr && window.__gridironScene.stadium && window.__gridironScene.stadium.rect && window.__V193AG && window.__V193AG.stands, null, { timeout: 120000 }).then(() => true).catch(() => false)
ok(up, 'the live broadcast is up')
if (!up) { console.log(JSON.stringify({ pass, fail, pageErrors: errors.length })); await browser.close(); process.exit(1) }

// ---- DIRT (live): a real tackle lays a scuff through the collision hook
{
  let made = 0
  for (let i = 0; i < 300 && made < 1; i++) { await p.waitForTimeout(400); made = await p.evaluate(() => (window.__V193AG && window.__V193AG.dirtMade) || 0) }
  const L = await p.evaluate(() => window.__V193AG.dirtInfo())
  ok(made >= 1 && L.on && L.n >= 1, 'DIRT: a real collision in a live game scuffs the turf', { made, n: L.n })
}
await p.evaluate(() => window.__gridironScene.scene.pause())

// a helper living in the page: the frame (main camera) as pixels, after a render
const snapSrc = `(sc) => new Promise(res => sc.game.renderer.snapshot(img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); window.__agFrame = c.toDataURL(); res({ w: c.width, h: c.height, d: x.getImageData(0, 0, c.width, c.height).data }) }))`

// ---- TUNNELS + FAR STANDS (on, then the kill switch)
const stadium = (tune, band) => p.evaluate(async ({ tune, snapSrc, band }) => {
  const snap = eval(snapSrc)
  Object.assign(window.RIB_TUNE, tune)
  const sc = window.__gridironScene, cam = sc.cameras.main
  sc.refreshPersp(); await new Promise(r => setTimeout(r, 60))
  const st = window.__V193AG.stands, tun = Object.assign({}, window.__V144.tunnels)
  // the band over the far bowl's back, between the roof line and the rim (the kill switch is read over the SAME rows)
  const rimTop = band ? band.rim : st.rimMid, roof = band ? band.roof : st.roofMid
  const keep = [cam.scrollX, cam.scrollY, cam.zoom]
  cam.setZoom(1); cam.setScroll(0, Math.max(-200, roof - 60))
  try { sc.stadium.cam.setVisible(false) } catch (e) {}
  sc.scene.resume(); await new Promise(r => setTimeout(r, 40)); sc.scene.pause()
  cam.setZoom(1); cam.setScroll(0, Math.max(-200, roof - 60))
  const F = await snap(sc), wv = cam.worldView
  const sky = { n: 0, of: 0 }
  // the night sky (pinned: dayNightV144 0) is near-black — #010204..#080b10 plus a few stars
  const at = (wx, wy) => { const x = Math.round((wx - wv.x) * cam.zoom), y = Math.round((wy - wv.y) * cam.zoom); if (x < 0 || y < 0 || x >= F.w || y >= F.h) return null; const i = (y * F.w + x) * 4; return [F.d[i], F.d[i + 1], F.d[i + 2]] }
  const ref = null
  for (const wx of [175, 195, 215, 235, 255, 465, 485, 505, 525, 545])   // either side of the screen (its dark panel is not sky)
    for (let k = 0.15; k <= 0.9; k += 0.15) {
    const y0 = roof + 4, y1 = rimTop - 4, wy = y0 + (y1 - y0) * k, c = at(wx, wy); if (!c) continue
    sky.of++; if (c[0] + c[1] + c[2] < 40) sky.n++
  }
  cam.setZoom(keep[2]); cam.setScroll(keep[0], keep[1])
  return { st: st && Object.assign({}, st), tun, rimTop, roof, skyShare: sky.of ? +(sky.n / sky.of).toFixed(3) : null, samples: sky.of, ref }
}, { tune, snapSrc, band })
const ON = await stadium({ v193AG: 1 })
if (process.env.AGDBG) { const fs = await import('node:fs'); fs.writeFileSync(process.env.AGDBG, Buffer.from((await p.evaluate(() => window.__agFrame)).split(',')[1], 'base64')); console.log('rim', ON.rimTop, 'roof', ON.roof) }
ok(ON.tun.mid === false && ON.tun.corners === 2, 'TUNNELS: two ways out of the far bowl and no middle arch', ON.tun)
ok(Array.isArray(ON.tun.at) && ON.tun.at.length === 2 && ON.tun.at.every(a => a < 0.2 || a > 0.8) && ON.tun.at.some(a => a < 0.5) && ON.tun.at.some(a => a > 0.5),
  'TUNNELS: one on each side (where the bowl turns into each sideline), none in the middle', ON.tun.at)
ok(ON.st && ON.st.on && ON.st.slices > 20 && ON.st.lamps > 4, 'FAR STANDS: the upper deck, club level and roof are built over the rim', ON.st && { slices: ON.st.slices, lamps: ON.st.lamps, tier: ON.st.tier })
ok(ON.st && ON.st.roofTop < ON.st.rimTop - 40 && ON.st.depth < 3.2, 'FAR STANDS: they rise well above the rim, behind the bowl and the masts', ON.st && { roofTop: ON.st.roofTop, rimTop: ON.st.rimTop, depth: ON.st.depth })
ok(ON.samples >= 20 && ON.skyShare < 0.1, 'FAR STANDS: the frame between the roof line and the rim is stadium, not sky', { skyShare: ON.skyShare, samples: ON.samples })

// ---- DIRT (forced)
const D = await p.evaluate(async () => {
  const sc = window.__gridironScene, V = window.__V193AG, M = window.__FIELDMAP_V72
  const ox = V.warpOx, cv = sc._warpCv, c2 = cv.getContext('2d', { willReadFrequently: true })
  const x = (M.PLAY_L + M.PLAY_R) / 2 + 37, y = 160
  const px = () => { const q = window.__PJ_PROBE(x, y); const d = c2.getImageData(Math.round(q.x + ox) - 1, Math.round(q.y) - 1, 3, 3).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2] } return [Math.round(r / 9), Math.round(g / 9), Math.round(b / 9)] }
  // how much of the turf round the spot is dirt (r >= g; grass is green-dominant) — robust to the grid the mark lands on
  const patch = () => { const q = window.__PJ_PROBE(x, y); const d = c2.getImageData(Math.round(q.x + ox) - 10, Math.round(q.y) - 10, 21, 21).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] >= d[i + 1] && d[i] + d[i + 1] + d[i + 2] < 420) n++; return n }
  const before = px(), patch0 = patch()
  const laid = V.dirt(x, y, 0.8)
  const after = px()
  const hook = typeof V.dirt === 'function' && V.dirt.length === 3
  // N frames later (the scene running), and after a snap's re-bake
  sc.scene.resume(); await new Promise(r => setTimeout(r, 700)); sc.scene.pause()
  const frames = px(), patchF = patch()
  sc.refreshPersp(); const rebaked = px(), patchR = patch()
  // strength scales the mark: the same spot rasterised at 0.2 and at 1 on a scratch canvas
  const scratch = document.createElement('canvas'); scratch.width = 1200; scratch.height = 3000; const sx = scratch.getContext('2d')
  const small = sc.rasterMarkV193AG(sx, ox, { x, y, s: 0.2, ang: 0, seed: 0.3 }, 'scuff', 1)
  const big = sc.rasterMarkV193AG(sx, ox, { x, y, s: 1, ang: 0, seed: 0.3 }, 'scuff', 1)
  // the fade: by snap count, gone after hold + fade
  const info0 = V.dirtInfo(), mark = (sc.dirtV193AG || []).find(d => Math.abs(d.x - x) < 1 && Math.abs(d.y - y) < 1)
  const a0 = mark ? sc.dirtAlphaV193AG(mark, 'scuff') : null
  sc._snapV193AG += window.RIB_TUNE.dirtHoldV193AG || 4; sc._snapV193AG += 3
  const aMid = mark ? sc.dirtAlphaV193AG(mark, 'scuff') : null
  sc._snapV193AG += 40; sc.refreshPersp()
  const gone = !(sc.dirtV193AG || []).includes(mark)
  // the cap
  for (let i = 0; i < 90; i++) V.dirt(M.PLAY_L + (i % 18) * 30, 40 + Math.floor(i / 18) * 70, 0.5)
  const capped = (sc.dirtV193AG || []).length, cap = V.dirtInfo().cap
  return { before, after, laid, hook, frames, rebaked, patch0, patchF, patchR, small, big, a0, aMid, gone, capped, cap, n0: info0.n }
})
const dirtish = (c) => c[0] > c[2] + 8 && c[1] < 150 && Math.abs(c[0] - c[1]) < 40 && c[1] < D.before[1] - 10
ok(D.hook && D.laid, 'DIRT: window.__V193AG.dirt(x, y, strength) lays a mark at field coordinates', { hook: D.hook, laid: D.laid })
ok(dirtish(D.after), 'DIRT: the turf at that spot is dirt now (painted into the field itself)', { before: D.before, after: D.after })
ok(D.patchF >= D.patch0 + 25 && D.patchR >= D.patch0 + 25, 'DIRT: it is still there N frames later and after the snap re-bakes the turf', { dirtPxBefore: D.patch0, afterFrames: D.patchF, afterRebake: D.patchR })
ok(D.big > D.small * 2 && D.small > 0, 'DIRT: a harder hit paints a bigger mark', { s02: D.small, s1: D.big })
ok(D.a0 === 1 && D.aMid > 0 && D.aMid < 1 && D.gone, 'DIRT: it holds, fades by the snap count and is gone after the drive', { fresh: D.a0, fading: D.aMid, gone: D.gone })
ok(D.capped === D.cap, 'DIRT: the count is capped (the oldest goes)', { n: D.capped, cap: D.cap })

// ---- TURF
const T = await p.evaluate(() => {
  const sc = window.__gridironScene, V = window.__V193AG, M = window.__FIELDMAP_V72, c2 = sc._warpCv.getContext('2d', { willReadFrequently: true })
  // two adjacent five-yard bands at midfield, sampled between the numbers and the hashes, off every line
  const vd = M.pj(M.PLAY_R, 220).y < M.pj(M.PLAY_L, 220).y ? 1 : -1, fx = (yd) => M.PLAY_L + (vd > 0 ? yd : 100 - yd) / 100 * (M.PLAY_R - M.PLAY_L)
  const lum = (yd) => { let s = 0, n = 0; for (const v of [130, 150, 290, 310]) for (const dy of [-0.8, 0, 0.8]) { const q = window.__PJ_PROBE(fx(yd + dy), v); const d = c2.getImageData(Math.round(q.x + V.warpOx), Math.round(q.y), 1, 1).data; if (d[1] > d[0] + 10) { s += d[1]; n++ } } return n ? s / n : null }
  return { AK: V.warpAK, turf: V.turf || null, a: lum(32.5), b: lum(37.5), c: lum(42.5), d: lum(47.5) }
})
ok(T.AK === 2 && T.turf && T.turf.K === 2, 'TURF: the field is composited at twice the art', { AK: T.AK, K: T.turf && T.turf.K, ms: T.turf && T.turf.ms })
{ const B = (T.turf && T.turf.bands) || [], alt = (q) => q.length === 4 && q.every(Number.isFinite) && Math.sign(q[0] - q[1]) === Math.sign(q[2] - q[1]) && Math.sign(q[1] - q[2]) === Math.sign(q[3] - q[2])
  const art = [Math.abs(B[0] - B[1]) / B[1], Math.abs(B[1] - B[2]) / B[1], Math.abs(B[2] - B[3]) / B[3]]
  ok(alt(B) && art.every(x => x > 0.12), 'TURF: the art is mowed in alternating five-yard stripes', { green: B, contrast: art.map(x => +x.toFixed(3)) })
  const W = [T.a, T.b, T.c, T.d], dif = [Math.abs(T.a - T.b) / T.b, Math.abs(T.b - T.c) / T.b, Math.abs(T.c - T.d) / T.d]
  ok(alt(W) && dif.every(x => x > 0.05), 'TURF: and the stripes survive the warp onto the broadcast field', { green: W.map(Math.round), contrast: dif.map(x => +x.toFixed(3)) }) }

// ---- PITCH: the lowest and the highest field perspective
const pitch = (dp, tune) => p.evaluate(async ({ dp, tune }) => {
  Object.assign(window.RIB_TUNE, tune || {})
  window.fieldFxSet('fxDepth', dp, false)
  const sc = window.__gridironScene; sc.refreshPersp()
  const G = window.__V193AG.standGeom(), V = window.__V193AG
  // the warp canvas just below the bowl's foot, mid-bowl: grass or sky?
  const c2 = sc._warpCv.getContext('2d', { willReadFrequently: true }), f = G.bowl.footMid
  const d = c2.getImageData(Math.round(f[0] + V.warpOx), Math.max(0, Math.round(f[1]) + 1), 1, 1).data
  return { G, foot: [d[0], d[1], d[2]], fill: Object.assign({}, V.farFill), st: V.stands && { roofTop: V.stands.roofTop, rimTop: V.stands.rimTop } }
}, { dp, tune })
const ground = (c) => c[0] + c[1] + c[2] > 60   // not the night sky (near-black): grass, or the end zone's paint at a deep perspective
for (const dp of [0, 0.9]) {
  const R = await pitch(dp)
  ok(R.G.sides.length === 2 && R.G.sides.every(s => s.n >= 3 && s.maxDeg < 2), `PITCH ${dp * 100}%: the stand rows stay parallel to the field edge along both sidelines (the rim runs to the touchlines' vanishing point, < 2°)`, R.G.sides)
  ok(R.G.bowl && R.G.bowl.lowestTop < R.G.farEndY - 4, `PITCH ${dp * 100}%: the bowl's top stays above the far end line`, { lowestTop: R.G.bowl && R.G.bowl.lowestTop, farEndY: R.G.farEndY })
  ok(ground(R.foot), `PITCH ${dp * 100}%: the ground runs on under the bowl's foot — no sky between the grass and the stand`, { px: R.foot, fillRows: R.fill.rows })
  if (dp === 0) {
    const K = await pitch(0, { v193AGpitch: 0 })
    ok(!ground(K.foot), 'PITCH 0%: (with v193AGpitch 0 that strip is sky again — the old seam)', { px: K.foot })
    await p.evaluate(() => { window.RIB_TUNE.v193AGpitch = 1 })
  }
}
await p.evaluate(() => { window.fieldFxSet('fxDepth', 0.78, false); window.__gridironScene.refreshPersp() })

// ---- CAMERA: a frame wider than the field is centred on it
const CM = await p.evaluate(async () => {
  const sc = window.__gridironScene, cam = sc.cameras.main
  sc.camSideV145(cam, 0.78); cam.setZoom(0.78); cam.centerOn(360, 900); cam.preRender()
  const wv = cam.worldView
  return { x0: Math.round(wv.x), x1: Math.round(wv.x + wv.width) }
})
ok(Math.abs((CM.x0 + CM.x1) / 2 - 360) < 3 && CM.x0 < 0, 'CAMERA: at the zoom floor the frame is centred on the field, not pinned to its left edge', CM)

// ---- KILL SWITCH
const OFF = await stadium({ v193AG: 0 }, { rim: ON.rimTop, roof: ON.roof })
const offDirt = await p.evaluate(() => { const r = window.__V193AG.dirt(300, 200, 1); const lg = window.__fieldLogoStateV44; window.__setFieldLogoV44(lg ? lg.drawn : null, true); window.__gridironScene.refreshPersp(); return { r, AK: window.__V193AG.warpAK } })
ok(OFF.tun.mid === true && OFF.tun.corners === 2, 'KILL: TU v193AG 0 cuts the middle arch again', OFF.tun)
ok(OFF.st && OFF.st.on === false && OFF.skyShare > ON.skyShare + 0.25, 'KILL: and the far stands are gone (that band is mostly sky again — the masts and the screen stand in it)', { stands: OFF.st && OFF.st.on, skyOff: OFF.skyShare, skyOn: ON.skyShare })
ok(offDirt.r === false && offDirt.AK === 1, 'KILL: no dirt is laid and the field composites at the art\'s own size', offDirt)
await p.evaluate(() => { window.RIB_TUNE.v193AG = 1; const lg = window.__fieldLogoStateV44; window.__setFieldLogoV44(lg ? lg.drawn : null, true); window.__gridironScene.refreshPersp(); window.__gridironScene.scene.resume() })
await p.waitForTimeout(800)

ok(errors.length === 0, 'no page errors', errors.slice(0, 3))
console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
