// Pack the uploaded crowd sheet into the atlas the v57 stands renderer draws from.
//
// The source is six full-width bleacher strips on a flat magenta matte, in three
// density tiers x two poses:
//   0 sparse idle   1 sparse cheer     (a half-empty high-school bleacher)
//   2 mid idle      3 mid cheer        (a filled college stand)
//   4 packed idle   5 packed cheer     (a sold-out pro deck; the cheer adds flags)
// Tier is picked at runtime from the level the game is played at; the pose pair is
// CROSSFADED, which is why the packing below matters more than it looks.
//
// Two rules make the crossfade work:
//   - every cell is the SAME size, so idle and cheer of a tier overlay pixel for
//     pixel and the bleachers underneath never drift between poses;
//   - every strip is BOTTOM-aligned in its cell, because the cheer strips are
//     taller than the idle ones (arms and flags go up, the seats do not move).
//     Centre them instead and the whole stand visibly sinks as the crowd sits.
// The people themselves are drawn in different seats between the two poses, which
// is intended — the fade reads as a crowd rising, not as one sprite morphing.
//
// Keying is the wheel sheet's exact-colour test (see pack_wheel.mjs), but the
// erode runs wider: the back railing on several strips is drawn in a DARK magenta
// that the bright-magenta test does not catch, and one un-eroded railing draws a
// hot purple line across the top of the stand on screen.
//
// Emits public/rib_crowd_v57.png + art/crowd_v57.cellmap.json.
// Run scripts/spritekit/bake_crowd.mjs afterwards to inline it into index.html.
import { chromium } from 'playwright'
import fs from 'fs'

const SRC = 'art/source/crowd stands pixel art.png'
const OUT = 'public/rib_crowd_v57.png'
// The stands render a few hundred screen px wide at most (the far-end margin is
// the widest they ever get), so the master's full 1254px is far more than the
// renderer can show. 0.55 keeps every tier legible and holds the baked data URL
// to a few hundred KB instead of two megabytes.
const SCALE = 0.55
// tier/pose per strip, in sheet order — the sheet is drawn idle-then-cheer per tier
const ORDER = ['sparse_idle', 'sparse_cheer', 'mid_idle', 'mid_cheer', 'packed_idle', 'packed_cheer']

const src = fs.readFileSync(SRC).toString('base64')
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
page.on('console', m => console.log('  [page]', m.text()))

const res = await page.evaluate(async ({ src, ORDER, SCALE }) => {
  const im = new Image()
  await new Promise(r => { im.onload = r; im.src = 'data:image/png;base64,' + src })
  const W = im.width, H = im.height
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false
  cx.drawImage(im, 0, 0)
  const img = cx.getImageData(0, 0, W, H), d = img.data

  // ---- 1. key the flat magenta matte. Nothing in the art is magenta, so an exact
  // colour test is safe and cannot eat sprite interiors the way a brightness test can.
  const isMag = i => d[i] > 150 && d[i + 2] > 150 && d[i + 1] < 130 && (d[i] - d[i + 1]) > 60 && (d[i + 2] - d[i + 1]) > 60
  // Clearing alpha is not enough: a keyed pixel KEEPS its magenta RGB, and the
  // downscale below resamples colour across it, blending the matte back in as a
  // purple rim. Killing the colour with the alpha is what makes the key stick.
  const clear = i => { d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0 }
  let keyed = 0
  for (let i = 0; i < d.length; i += 4) if (isMag(i)) { clear(i); keyed++ }

  // ---- 2. erode the magenta fringe. Four passes rather than the wheel's two, and
  // the test is brightness-free: the darkened magenta railing along the top of
  // several strips survives the bright test above and has to come off here, or it
  // paints a purple line across the top row of the stand.
  let eroded = 0
  for (let pass = 0; pass < 4; pass++) {
    const kill = []
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x, i = p * 4
      if (!d[i + 3]) continue
      const magish = (d[i] - d[i + 1]) > 20 && (d[i + 2] - d[i + 1]) > 20
      if (!magish) continue
      if ((x > 0 && !d[(p - 1) * 4 + 3]) || (x < W - 1 && !d[(p + 1) * 4 + 3]) ||
        (y > 0 && !d[(p - W) * 4 + 3]) || (y < H - 1 && !d[(p + W) * 4 + 3])) kill.push(i)
    }
    for (const i of kill) clear(i)
    eroded += kill.length
  }
  cx.putImageData(img, 0, 0)
  const A = (x, y) => d[(y * W + x) * 4 + 3] > 24

  // ---- 3. band the sheet into its six strips by row projection
  const bands = (proj, N, gap, minLen) => {
    const out = []; let s = null, last = null
    for (let i = 0; i < N; i++) {
      if (proj[i] > 0) { if (s === null) s = i; last = i }
      else if (s !== null && i - last > gap) { out.push([s, last]); s = null }
    }
    if (s !== null) out.push([s, last])
    return out.filter(b => b[1] - b[0] + 1 >= minLen)
  }
  const rp = new Int32Array(H)
  for (let y = 0; y < H; y++) { let c = 0; for (let x = 0; x < W; x++) if (A(x, y)) c++; rp[y] = c }
  const strips = bands(rp, H, 6, 20)

  // tight box per strip (the matte leaves a stray column or two at the edges)
  const boxes = strips.map(([y0, y1]) => {
    let bx0 = 1e9, bx1 = -1, by0 = 1e9, by1 = -1, mass = 0
    for (let y = y0; y <= y1; y++) for (let x = 0; x < W; x++) if (A(x, y)) {
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; mass++
    }
    return { x: bx0, y: by0, w: bx1 - bx0 + 1, h: by1 - by0 + 1, mass }
  })
  if (boxes.length !== ORDER.length) return { fatal: 'expected ' + ORDER.length + ' strips, found ' + boxes.length, shape: boxes.length }

  // ---- 4. one cell size for every tier: the widest and tallest strip on the sheet.
  // Uniform cells are what let the renderer swap tiers and crossfade poses without
  // re-deriving any geometry.
  const CW = Math.round(Math.max(...boxes.map(b => b.w)) * SCALE)
  const CH = Math.round(Math.max(...boxes.map(b => b.h)) * SCALE)

  const atlas = document.createElement('canvas'); atlas.width = CW; atlas.height = CH * ORDER.length
  const ax = atlas.getContext('2d'); ax.imageSmoothingEnabled = true; ax.imageSmoothingQuality = 'high'

  const cellmap = {}
  boxes.forEach((b, k) => {
    const dw = Math.round(b.w * SCALE), dh = Math.round(b.h * SCALE)
    const dx = 0, dy = k * CH + (CH - dh)          // BOTTOM-aligned: the seats never move
    ax.drawImage(cv, b.x, b.y, b.w, b.h, dx, dy, dw, dh)
    cellmap[ORDER[k]] = [0, k * CH, CW, CH]
  })

  // ---- 5. quantize. Smooth-downscaling pixel art explodes the colour count, and a
  // high-colour PNG of a dense crowd bakes into index.html as well over a megabyte
  // of base64. Snapping RGB to 6 bits and alpha to a hard edge costs nothing at the
  // size the stands actually draw and roughly halves the file. Alpha is binary
  // because these strips are solid blocks — only the outer silhouette is partial,
  // and a soft edge there would halo against the turf anyway.
  const aimg = atlas.getContext('2d').getImageData(0, 0, atlas.width, atlas.height)
  {
    const q = aimg.data
    for (let i = 0; i < q.length; i += 4) {
      if (q[i + 3] < 40) { q[i] = q[i + 1] = q[i + 2] = q[i + 3] = 0; continue }
      q[i + 3] = 255
      // The back railing along the top of several strips is drawn in a dark
      // magenta the bright key never sees and the erode cannot reach without
      // eating the rail itself. Desaturate the cast instead of deleting the
      // pixel: the rail survives, the purple does not.
      if ((q[i] - q[i + 1]) > 20 && (q[i + 2] - q[i + 1]) > 20) {
        q[i] = Math.min(q[i], q[i + 1] + 12); q[i + 2] = Math.min(q[i + 2], q[i + 1] + 12)
      }
      q[i] &= 0xfc; q[i + 1] &= 0xfc; q[i + 2] &= 0xfc
    }
    atlas.getContext('2d').putImageData(aimg, 0, 0)
  }

  // per-cell alpha mass, so the check can prove the tiers really differ in density
  const ad = aimg.data
  const density = {}
  ORDER.forEach((n, k) => {
    let c = 0
    for (let y = k * CH; y < (k + 1) * CH; y++) for (let x = 0; x < CW; x++) if (ad[(y * CW + x) * 4 + 3] > 24) c++
    density[n] = +(c / (CW * CH)).toFixed(4)
  })
  // any magenta left anywhere in the packed atlas is a keying failure
  let magLeft = 0
  for (let i = 0; i < ad.length; i += 4) {
    if (ad[i + 3] < 24) continue
    if ((ad[i] - ad[i + 1]) > 20 && (ad[i + 2] - ad[i + 1]) > 20) magLeft++
  }

  // debug contact sheet: the keyed source with each strip boxed and named
  const dbg = document.createElement('canvas'); dbg.width = W; dbg.height = H
  const dc = dbg.getContext('2d')
  dc.fillStyle = '#3c4a3a'; dc.fillRect(0, 0, W, H); dc.drawImage(cv, 0, 0)
  dc.strokeStyle = '#00e5ff'; dc.lineWidth = 2; dc.font = '20px monospace'; dc.fillStyle = '#00e5ff'
  boxes.forEach((b, k) => { dc.strokeRect(b.x, b.y, b.w, b.h); dc.fillText(ORDER[k], b.x + 4, b.y - 4) })

  return {
    atlas: atlas.toDataURL('image/png'), debug: dbg.toDataURL('image/png'),
    cellmap, cell: [CW, CH], size: [atlas.width, atlas.height],
    boxes, density, keyed, eroded, magLeft,
  }
}, { src, ORDER, SCALE })

if (res.fatal) { console.error('FATAL:', res.fatal); process.exit(1) }

fs.mkdirSync('public', { recursive: true })
fs.writeFileSync(OUT, Buffer.from(res.atlas.split(',')[1], 'base64'))
fs.writeFileSync('art/crowd_v57.cellmap.json', JSON.stringify(res.cellmap))
const dbgPath = process.env.CROWD_DEBUG_OUT
if (dbgPath) fs.writeFileSync(dbgPath, Buffer.from(res.debug.split(',')[1], 'base64'))

console.log(JSON.stringify({
  strips: res.boxes.map(b => `${b.w}x${b.h}`),
  cell: res.cell.join('x'), atlas: res.size.join('x'), cells: Object.keys(res.cellmap).length,
  density: res.density, keyedPx: res.keyed, erodedPx: res.eroded, magentaLeft: res.magLeft,
  bytes: fs.statSync(OUT).size,
}, null, 1))
// A cheer pose must carry MORE ink than its idle (arms and flags go up); if it does
// not, the strips are paired wrong and the crossfade would play backwards.
const bad = ['sparse', 'mid', 'packed'].filter(t => res.density[t + '_cheer'] <= res.density[t + '_idle'])
if (bad.length) { console.error('pose pairing looks wrong (cheer no denser than idle):', bad); process.exitCode = 1 }
if (res.magLeft > 0) { console.error('magenta survived the key:', res.magLeft, 'px'); process.exitCode = 1 }
await browser.close()
