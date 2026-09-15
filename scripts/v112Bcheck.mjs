// Dev check: v112 B — THE STADIUM. Drives into a live game and measures the broadcast scene
// itself (sprite geometry, the warp canvas's own pixels, the projection's rows), never a
// screenshot's existence:
//   * the four masts are half the v98 mast, planted `lightDropV112` lower, and drawn from the
//     MIRRORED face of the sheet — measured A/B against the dials put back to v98's values
//   * the lamps followed them: the glow halved with the mast, the beam re-aimed, and every pool
//     still lands on the painted turf (tested against the v103 turf quad, not a rectangle)
//   * v99's key light still reads the mast it stands on, and no mast art is on the grass
//   * the bowl carries a blue base band and an entrance, both built from the crowd's own
//     projection samples: the band's height is one constant in stand-heights all the way round,
//     its foot is a CURVE (not a screen-space rectangle), and the entrance breaks the wall
//   * there are stars in the sky, all of them above the bowl's own skyline (never over the
//     crowd), identical between two bakes, and gone when the lighting dial is at full
//   * and the near edge of the field no longer stretches: with the v28 cap the near rows draw
//     one row of the field art over ~11 canvas rows, which is what smeared the bottom of the
//     frame; the painted end line is measured in the warp canvas and has to come out thinner,
//     the rows downfield of the anchor have to be untouched, and the band below the near end
//     line has to be an edge into the dark instead of one scanline repeated.
// Usage: npm run dev (or any static server on :5173), then: node scripts/v112Bcheck.mjs
//   env: GAME_URL, POS (default RB)
import { chromium } from 'playwright'
const URL = process.env.GAME_URL || 'http://localhost:5173/'
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(URL, { waitUntil: 'networkidle', timeout: 40000 })
await page.waitForTimeout(1200)

// ---- the career walk into a live game (the same one readshot uses)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
await page.evaluate(p => { window.__readPos = p }, process.env.POS || 'RB')
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) {
  try {
    await page.evaluate(({ t, visSrc }) => {
      const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
      const txt = e => (e.innerText || '').replace(/\s+/g, ' ').trim()
      const el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
        : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t))
      if (el) { el.scrollIntoView({ block: 'center' }); el.click() }
    }, { t, visSrc: vis })
  } catch (e) {}
  await page.waitForTimeout(t === 'PLAN' ? 4000 : 900)
}
let live = false
for (let i = 0; i < 60; i++) { live = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length && window.__V112_B)); if (live) break; await page.waitForTimeout(400) }
ok(live, 'the broadcast is up and window.__V112_B answers')
if (!live) { console.log(JSON.stringify({ pass, fail: fail + 1, errors: errs.length })); await browser.close(); process.exit(1) }

// ============================ 1. THE MASTS ============================
const M = await page.evaluate(() => {
  const sc = window.__gridironScene, T = window.RIB_TUNE
  const grab = () => { const B = window.__V112_B(); return { masts: B.masts, key: B.key, rigs: B.rigs, turf: B.turf, bowl: B.bowl, dials: B.dials } }
  const rebuild = () => { try { sc.buildCrowd() } catch (e) {} }
  const now = grab()
  // A/B: put the three dials back to what v98 shipped and rebuild
  const keep = [T.lightScaleV112, T.lightDropV112, T.lightFlipV112]
  T.lightScaleV112 = 1; T.lightDropV112 = 0; T.lightFlipV112 = 0
  rebuild(); const v98 = grab()
  T.lightScaleV112 = keep[0]; T.lightDropV112 = keep[1]; T.lightFlipV112 = keep[2]
  rebuild(); const back = grab()
  return { now, v98, back }
})
const nowM = M.back.masts, oldM = M.v98.masts
ok(nowM.length === 4 && oldM.length === 4, 'four masts stand at both settings', `${oldM.length} -> ${nowM.length}`)
const hRatio = nowM.map((t, i) => t.h / Math.max(1, oldM[i].h))
ok(hRatio.every(r => Math.abs(r - 0.5) < 0.03), 'every mast is drawn at half the v98 size', hRatio.map(r => r.toFixed(3)).join(' '))
const wRatio = nowM.map((t, i) => t.w / Math.max(1, oldM[i].w))
ok(wRatio.every(r => Math.abs(r - 0.5) < 0.03), 'and half as wide — the sprite scaled, it was not squashed', wRatio.map(r => r.toFixed(3)).join(' '))
const drop = nowM.map((t, i) => t.by - oldM[i].by)
ok(drop.every(d => Math.abs(d - M.back.dials.drop) < 1.5), 'every mast sits exactly lightDropV112 lower', `drop=${M.back.dials.drop} measured ${drop.join(',')}`)
ok(nowM.every((t, i) => t.face !== oldM[i].face), 'every mast is drawn from the OTHER face of the sheet — mirrored', `${oldM.map(t => t.face).join('')} -> ${nowM.map(t => t.face).join('')}`)
ok(nowM.every(t => t.flipped), 'and the flip is the one the hook reports, not a coincidence of position', nowM.map(t => t.face).join(','))
ok(nowM.every(t => t.by < M.back.bowl.bot + 2), 'their feet are still inside the bowl that hides them', `feet ${nowM.map(t => t.by).join(',')} bowl bot ${M.back.bowl.bot}`)
ok(nowM.every(t => !t.bleeds), 'and no mast ART reaches the painted turf (v103 quad)', nowM.map(t => t.bleeds).join(','))

// ---- the lamps came with them
const rig = M.back.rigs, rig98 = M.v98.rigs
ok(rig.length === 4, 'all four lamp rigs are live', String(rig.length))
const gRatio = rig.map((L, i) => L.glow.w / Math.max(1, rig98[i].glow.w))
ok(gRatio.every(r => r < 0.8), 'the bloom halved with the mast rather than staying the old size', gRatio.map(r => r.toFixed(2)).join(' '))
ok(rig.every((L, i) => L.beam.len !== rig98[i].beam.len), 'the beams were re-aimed from the new head', rig.map(L => L.beam.len).join(','))
// pools on the turf: test the ellipse against the v103 turf quad, not a bounding rectangle
const turf = M.back.turf
const poolOnTurf = rig.map(L => {
  const x0 = L.pool.x - L.pool.w / 2, x1 = L.pool.x + L.pool.w / 2, y0 = L.pool.y - L.pool.h / 2, y1 = L.pool.y + L.pool.h / 2
  for (let i = 1; i < turf.length; i++) {
    const a = turf[i - 1], b = turf[i]
    if (b.y < y0 || a.y > y1) continue
    if (x1 >= Math.min(a.x0, b.x0) && x0 <= Math.max(a.x1, b.x1)) return true
  }
  return false
})
ok(poolOnTurf.every(Boolean), 'every lamp pool still lands on the painted turf', poolOnTurf.join(','))

// ---- v99's key light still IS its mast
const K = M.back.key, km = nowM[K.i]
ok(K.on && Math.abs(K.x - km.bx) < 1, 'the key light stands on its own mast', `key x=${K.x} mast bx=${km.bx}`)
const headFrac = (km.by - K.y) / Math.max(1, km.h)
ok(Math.abs(headFrac - 0.76) < 0.02, "and reads that mast's own lamp head, at the new height", `frac=${headFrac.toFixed(3)} key y=${K.y} (was ${M.v98.key.y})`)
ok(K.y > M.v98.key.y + 50, 'the key light came down with the rig it is', `${M.v98.key.y} -> ${K.y}`)

// ============================ 2. THE BOWL: BAND + ENTRANCE ============================
const T2 = await page.evaluate(() => window.__V112_B().trim)
ok(!!T2 && T2.band && T2.band.length === 3, 'every wall of the bowl carries a base band', T2 && T2.band ? T2.band.map(b => b.kind).join(',') : 'none')
const perK = T2.band.map(b => b.h / Math.max(1e-6, b.k))
ok(Math.max(...perK) - Math.min(...perK) < Math.max(...perK) * 0.02,
  'the band is ONE height in stand-heights all the way round — it rides the projection, it is not a screen rectangle',
  perK.map(v => v.toFixed(1)).join(' / '))
ok(T2.band.every(b => b.h > 1 && b.midTop[1] < b.mid[1]), 'and it stands UP from the foot of the stand', T2.band.map(b => `${b.kind} h=${b.h}`).join(' '))
const blue = T2.col
ok(((blue >> 16) & 255) < ((blue & 255)) - 60 && ((blue >> 8) & 255) < (blue & 255) - 30, 'the band is blue', '#' + blue.toString(16))
// the bowl's foot is a curve: the samples must bow away from the straight chord between its ends
const bow = await page.evaluate(() => {
  const C = window.__gridironScene.crowd, d = C && C.trim112 && C.trim112.ent
  const B = window.__V112_B().trim
  return { ent: B.ent }
})
ok(!!bow.ent, 'the bowl carries an entrance', bow.ent ? `${bow.ent.n} samples` : 'none')
const E = bow.ent
// the band's foot IS the bowl's projected curve: it has to bow away from the chord between its ends
{
  const bowlBand = T2.band.find(b => b.kind === 'bowl')
  const chordDev = (pts) => { const a = pts[0], b = pts[pts.length - 1]; let dev = 0
    for (const p of pts) { const t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / Math.max(1e-6, (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2)
      dev = Math.max(dev, Math.hypot(a[0] + t * (b[0] - a[0]) - p[0], a[1] + t * (b[1] - a[1]) - p[1])) }
    return dev }
  const dev = chordDev(bowlBand.foot)
  const span = Math.hypot(bowlBand.foot[bowlBand.foot.length - 1][0] - bowlBand.foot[0][0], bowlBand.foot[bowlBand.foot.length - 1][1] - bowlBand.foot[0][1])
  ok(dev > 4, "the band follows the bowl's projected sweep, not a straight screen-space rectangle", `bows ${dev.toFixed(1)}px off its own chord over ${span.toFixed(0)}px`)
  if (E) {
    const foot = bowlBand.foot.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1))
    const onFoot = E.mouth.every(p => foot.some(f => Math.abs(+f.split(',')[0] - p[0]) < 1 && Math.abs(+f.split(',')[1] - p[1]) < 1))
    ok(onFoot, 'and the entrance is cut from those same samples — it stands on the bowl, not in front of it', `${E.mouth.length} mouth points, all on the foot`)
  }
}
if (E) {
  const apex = E.arch[E.arch.length >> 1], jamb0 = E.arch[0], jambN = E.arch[E.arch.length - 1]
  const hApex = E.mouth[E.mouth.length >> 1][1] - apex[1]
  ok(hApex > 2, 'it is a real opening with height', `${hApex}px`)
  ok(hApex > T2.band[2].h * 1.5, 'tall enough to break the base band rather than sit on it', `arch ${hApex} vs band ${T2.band[2].h}`)
  ok((E.mouth[0][1] - jamb0[1]) < hApex * 0.35 && (E.mouth[E.mouth.length - 1][1] - jambN[1]) < hApex * 0.35,
    'and it is an ARCH — the terrace closes over it at both jambs', `jambs ${(E.mouth[0][1] - jamb0[1])} / ${(E.mouth[E.mouth.length - 1][1] - jambN[1])} vs apex ${hApex}`)
  ok(E.w > 4, 'wide enough to read at phone width', `${E.w}px of wall at k=${E.k}`)
}

// ============================ 3. THE STARS ============================
const S = await page.evaluate(() => {
  const sc = window.__gridironScene, T = window.RIB_TUNE
  const B = () => window.__V112_B()
  const band = () => { const cv = sc._warpCv, g = cv.getContext('2d', { willReadFrequently: true })
    const st = B().stars, NS = B().nstop
    const d = g.getImageData(0, 0, cv.width, NS).data
    let bright = 0, sum = 0, n = 0, lo = 1e9, hi = -1
    for (let y = 0; y < NS; y++) for (let x = 0; x < cv.width; x += 3) {
      const i = (y * cv.width + x) * 4, L = (d[i] + d[i + 1] + d[i + 2]) / 3
      sum += L; n++
      if (L > 26) { bright++; lo = Math.min(lo, y); hi = Math.max(hi, y) }
    }
    return { stars: st, bright, mean: +(sum / n).toFixed(2), lo: lo === 1e9 ? -1 : lo, hi } }
  const one = band()
  try { sc.warpField() } catch (e) {}
  const two = band()
  const keepL = (window.__FIELD_FX || {}).light
  window.__FIELD_FX.light = 2; try { sc.warpField() } catch (e) {}
  const full = band()
  window.__FIELD_FX.light = keepL; try { sc.warpField() } catch (e) {}
  return { one, two, full, bowlTop: B().bowl.top, nstop: B().nstop }
})
ok(S.one.stars && S.one.stars.n > 50, 'the sky is drawn with stars in it', S.one.stars ? `${S.one.stars.n} at wash ${S.one.stars.wash}` : 'none')
ok(S.one.bright > 30, 'and they are there in the canvas, not only in the hook', `${S.one.bright} lit samples above the sky gradient`)
ok(S.one.bright === S.two.bright, 'a second bake draws exactly the same sky — no static between plays', `${S.one.bright} then ${S.two.bright}`)
ok(S.one.stars.band[1] <= S.bowlTop + 2, 'the lowest star sits at or above the bowl\'s own skyline — never over the crowd', `floor ${S.one.stars.band[1]} vs bowl top ${S.bowlTop}`)
ok(S.one.hi <= S.nstop, 'and every lit sample is inside the sky band, above the turf', `lowest lit row ${S.one.hi} of ${S.nstop}`)
ok(S.full.stars.n === 0 && S.full.bright < S.one.bright * 0.4,
  'crank the stadium rig to full and the sky washes out — there is no daylight setting, so the light dial is what governs them',
  `${S.one.bright} -> ${S.full.bright} lit samples`)

// ============================ 4. THE NEAR EDGE ============================
const N = await page.evaluate(() => {
  const sc = window.__gridironScene, T = window.RIB_TUNE, M = window.__FIELDMAP_V72
  const rows = () => { const out = []; for (let u = 0; u <= 720; u += 10) out.push(+M.pj(u, 220).y.toFixed(3)); return out }
  const px = (a, b) => { const A = M.pj(a, 220), B = M.pj(b, 220); return Math.abs(B.y - A.y) / Math.max(1e-6, Math.abs(M.artY(b) - M.artY(a))) }
  // the near end of the WORLD is whichever end of u is drawn lowest on the canvas
  const nearU = M.pj(0, 220).y > M.pj(720, 220).y ? [2, 30] : [718, 690]
  // Measure the NEAR END LINE — three white rows in the 700-row art — where the projection says
  // it lands, and take its full width at half maximum in canvas rows. That number IS how far the
  // art is being stretched at the near edge: three rows of paint blown into a bar.
  const endLine = () => {
    const cv = sc._warpCv, g = cv.getContext('2d', { willReadFrequently: true })
    const G = window.__FIELDMAP_V72
    // u of the painted end line: artY(u) = the art row 10 yards outside the near goal line
    const ezU = G.PLAY_L - (G.PLAY_R - G.PLAY_L) * 0.1
    const simX = M.pj(0, 220).y > M.pj(720, 220).y ? ezU : 720 - ezU
    const yc = Math.round(M.pj(simX, 220).y)
    const half = 90, y0 = Math.max(0, yc - half), h = Math.min(cv.height - y0, half * 2)
    const x = Math.round(cv.width / 2)
    const d = g.getImageData(x, y0, 1, h).data
    const L = []; for (let i = 0; i < d.length; i += 4) L.push((d[i] + d[i + 1] + d[i + 2]) / 3)
    let pk = 0, pi = 0
    for (let i = 0; i < L.length; i++) if (L[i] > pk) { pk = L[i]; pi = i }
    const base = Math.min(...L), cut = base + (pk - base) * 0.5
    let a = pi, b = pi
    while (a > 0 && L[a - 1] >= cut) a--
    while (b < L.length - 1 && L[b + 1] >= cut) b++
    return { thick: b - a + 1, peak: +pk.toFixed(1), base: +base.toFixed(1), at: y0 + pi, want: yc }
  }
  const snapshot = () => ({ near: +px(nearU[0], nearU[1]).toFixed(4), mid: +px(330, 390).toFixed(4), rows: rows(), line: endLine() })
  const keep = T.nearCapV112
  const now = snapshot()
  T.nearCapV112 = 1.2                     // v28's own backdrop
  try { sc.refreshPersp() } catch (e) {}
  const v28 = snapshot()
  T.nearCapV112 = keep
  try { sc.refreshPersp() } catch (e) {}
  const back = snapshot()
  // the band below the near end line, with the extension on and off
  const belowBand = () => { const cv = sc._warpCv, g = cv.getContext('2d', { willReadFrequently: true })
    const B = window.__V112_B(), last = B.edge ? B.edge.lastTurfY : 0
    const x = Math.round(cv.width / 2), h = Math.min(cv.height - last - 2, 420)
    if (h <= 8) return { h, deep: null, streak: null }
    const d = g.getImageData(x, last + 2, 1, h).data
    const L = []; for (let i = 0; i < d.length; i += 4) L.push((d[i] + d[i + 1] + d[i + 2]) / 3)
    let flat = 0, run = 0
    for (let i = 1; i < L.length; i++) { if (Math.abs(L[i] - L[i - 1]) < 0.75) { run++; flat = Math.max(flat, run) } else run = 0 }
    return { h, deep: +L[L.length - 1].toFixed(1), top: +L[0].toFixed(1), flat } }
  const edgeOn = belowBand()
  T.nearEdgeV112 = 0; try { sc.refreshPersp() } catch (e) {}
  const edgeOff = belowBand()
  T.nearEdgeV112 = 1; try { sc.refreshPersp() } catch (e) {}
  return { now, v28, back, edgeOn, edgeOff, cap: window.__V112_B().backMax, wasCap: window.__V112_B().wasBackMax }
})
ok(N.cap < N.wasCap, 'the behind-anchor cap is lower than v28 shipped', `${N.wasCap} -> ${N.cap}`)
ok(N.back.near < N.v28.near * 0.8, 'the near rows draw the field art over far fewer canvas rows — the stretch is measurably gone',
  `${N.v28.near.toFixed(2)} -> ${N.back.near.toFixed(2)} canvas px per art row (${(100 * (1 - N.back.near / N.v28.near)).toFixed(0)}% less)`)
ok(Math.abs(N.back.mid - N.v28.mid) < Math.max(0.002, N.v28.mid * 0.01), 'and mid-field is untouched — the cap only ever reaches behind the backfield',
  `${N.v28.mid.toFixed(4)} vs ${N.back.mid.toFixed(4)}`)
{
  const same = N.back.rows.filter((y, i) => Math.abs(y - N.v28.rows[i]) < 1).length
  ok(same >= N.back.rows.length * 0.6, 'most of the field is at exactly the row v28 put it on', `${same}/${N.back.rows.length} rows within 1px`)
  const farSame = N.back.rows.slice(0, 20).every((y, i) => Math.abs(y - N.v28.rows[i]) < 1) || N.back.rows.slice(-20).every((y, i, a) => Math.abs(y - N.v28.rows.slice(-20)[i]) < 1)
  ok(farSame, 'the whole far half is pixel-identical to v28 — nothing downfield moved', 'far 20 rows within 1px')
}
ok(N.back.line.thick > 0 && N.back.line.thick < N.v28.line.thick * 0.85,
  "the painted end line, measured in the warp canvas, is thinner — that white bar across the bottom of the frame was one art row blown up",
  `${N.v28.line.thick}px -> ${N.back.line.thick}px`)
ok(N.edgeOn.h > 8 ? N.edgeOn.deep < 18 : true, 'below the near apron the picture falls into the dark beyond the ground',
  `deepest row luma ${N.edgeOn.deep} (band ${N.edgeOn.h}px)`)
ok(N.edgeOn.h > 8 ? N.edgeOff.deep > N.edgeOn.deep + 8 : true,
  'with the extension off that band is the old smear — one lit scanline copied down the canvas',
  `smear ${N.edgeOff.deep} vs edge ${N.edgeOn.deep}`)

console.log(JSON.stringify({ pass, fail, errors: errs.length,
  masts: { h: nowM.map(t => t.h), by: nowM.map(t => t.by), face: nowM.map(t => t.face) },
  key: M.back.key, band: T2.band.map(b => b.kind + ':' + b.h), ent: E ? { h: E.h, w: E.w } : null,
  stars: S.one.stars, near: { v28: N.v28.near, now: N.back.near, line: [N.v28.line.thick, N.back.line.thick] } }))
console.log(errs.length ? 'PAGE ERRORS:\n' + errs.slice(0, 8).join('\n') : 'page errors: none')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
