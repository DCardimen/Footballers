// Pack the uploaded wheel art into the atlas the v50 decision wheel draws from.
//
// Three sources, all on a flat magenta matte (which keys far more cleanly than
// the referee sheet's near-white checkerboard — see pack_refs.mjs for what that
// cost). Items are found by connected banding rather than a fixed grid, because
// the hardware sheet mixes one huge rim with small pointer frames.
//
// Unlike the player/ref atlases this one is NOT a uniform cell grid: a 256px rim
// and a 56px icon in the same grid would waste most of the sheet. The cellmap is
// therefore rect-based — {name: [x, y, w, h]} — and packed onto shelves.
//
// Emits public/rib_wheel_v50.png + art/wheel_v50.cellmap.json.
// Run scripts/spritekit/bake_wheel.mjs afterwards to inline it into index.html.
import { chromium } from 'playwright'
import fs from 'fs'

const SRC = {
  hw: 'art/source/wheel hardware pixel art.png',
  ico: 'art/source/wheel icons pixel art.png',
  out: 'art/source/outcome icons pixel art.png',
}
const OUT = 'public/rib_wheel_v50.png'

// ---- what to pull out of each sheet, in reading order within each band.
// `size` is the box the item is fitted into, preserving aspect.
const WANT = [
  // hardware: row 0 is [rim, hub]; rows 1-2 are the pointer flapper deflecting
  // further and further as the wheel spins past it.
  { sheet: 'hw', band: 0, i: 0, name: 'rim', size: 256 },
  { sheet: 'hw', band: 0, i: 1, name: 'hub', size: 72 },
  { sheet: 'hw', band: 1, i: 0, name: 'ptr0', size: 64 },
  { sheet: 'hw', band: 1, i: 1, name: 'ptr1', size: 64 },
  { sheet: 'hw', band: 1, i: 2, name: 'ptr2', size: 64 },
  { sheet: 'hw', band: 1, i: 3, name: 'ptr3', size: 64 },
  // icons: a strict 4x4. Rows 0-2 are the twelve growth themes in THEMES order;
  // row 3 is the three outcome seals plus a die we do not need.
  ...['iron', 'track', 'film', 'hands', 'feet', 'flex', 'mentor', 'social', 'plyo', 'lab', 'craft', 'edge']
    .map((n, k) => ({ sheet: 'ico', band: (k / 4) | 0, i: k % 4, name: 'th_' + n, size: 56 })),
  { sheet: 'ico', band: 3, i: 0, name: 'seal_green', size: 56 },
  { sheet: 'ico', band: 3, i: 1, name: 'seal_neutral', size: 56 },
  { sheet: 'ico', band: 3, i: 2, name: 'seal_red', size: 56 },
  // outcome sheet: the stat arrows read the band at a glance on the result card
  { sheet: 'out', band: 1, i: 0, name: 'up_ball', size: 48 },
  { sheet: 'out', band: 3, i: 0, name: 'dn_ball', size: 48 },
]

const files = {}
for (const k in SRC) files[k] = fs.readFileSync(SRC[k]).toString('base64')

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
page.on('console', m => console.log('  [page]', m.text()))

const res = await page.evaluate(async ({ files, WANT }) => {
  const sheets = {}
  for (const k in files) {
    const im = new Image()
    await new Promise(r => { im.onload = r; im.src = 'data:image/png;base64,' + files[k] })
    const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height
    const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false; cx.drawImage(im, 0, 0)
    const img = cx.getImageData(0, 0, im.width, im.height), d = img.data
    // ---- key the magenta matte. A flat key needs no flood-fill: nothing in the
    // art is magenta, so a colour test alone is exact and cannot eat sprite
    // interiors the way a brightness test can.
    const isMag = i => d[i] > 150 && d[i + 2] > 150 && d[i + 1] < 130 && (d[i] - d[i + 1]) > 60 && (d[i + 2] - d[i + 1]) > 60
    for (let i = 0; i < d.length; i += 4) if (isMag(i)) d[i + 3] = 0
    // ---- kill the magenta fringe the generator's anti-aliasing left: any
    // surviving pixel that still leans magenta and touches transparency goes.
    const W = im.width, H = im.height
    for (let pass = 0; pass < 2; pass++) {
      const kill = []
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const p = y * W + x, i = p * 4
        if (!d[i + 3]) continue
        const magish = (d[i] - d[i + 1]) > 24 && (d[i + 2] - d[i + 1]) > 24
        if (!magish) continue
        if ((x > 0 && !d[(p - 1) * 4 + 3]) || (x < W - 1 && !d[(p + 1) * 4 + 3]) ||
          (y > 0 && !d[(p - W) * 4 + 3]) || (y < H - 1 && !d[(p + W) * 4 + 3])) kill.push(i)
      }
      for (const i of kill) d[i + 3] = 0
    }
    cx.putImageData(img, 0, 0)
    sheets[k] = { cv, d, W, H }
  }
  const A = (S, x, y) => S.d[(y * S.W + x) * 4 + 3] > 24
  const bands = (proj, N, gap, minLen) => {
    const out = []; let s = null, last = null
    for (let i = 0; i < N; i++) {
      if (proj[i] > 0) { if (s === null) s = i; last = i }
      else if (s !== null && i - last > gap) { out.push([s, last]); s = null }
    }
    if (s !== null) out.push([s, last])
    return out.filter(b => b[1] - b[0] + 1 >= minLen)
  }
  const grids = {}
  for (const k in sheets) {
    const S = sheets[k]
    const rp = new Int32Array(S.H)
    for (let y = 0; y < S.H; y++) { let c = 0; for (let x = 0; x < S.W; x++) if (A(S, x, y)) c++; rp[y] = c }
    const rows = bands(rp, S.H, 14, 12)
    grids[k] = rows.map(([y0, y1]) => {
      const cp = new Int32Array(S.W)
      for (let x = 0; x < S.W; x++) { let c = 0; for (let y = y0; y <= y1; y++) if (A(S, x, y)) c++; cp[x] = c }
      return { y0, y1, cols: bands(cp, S.W, 16, 10) }
    })
  }
  const shape = {}; for (const k in grids) shape[k] = grids[k].map(g => g.cols.length)

  // Tight box plus a PIVOT: the centroid of the topmost sliver of the sprite. For
  // the pointer frames that sliver is the mounting bracket, which is the point
  // the flapper actually turns about — anchoring the frames by their centres
  // instead makes the pointer jump sideways as it deflects.
  const bbox = (S, x0, x1, y0, y1) => {
    let bx0 = 1e9, bx1 = -1, by0 = 1e9, by1 = -1
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (A(S, x, y)) {
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y
    }
    if (bx1 < 0) return null
    const h = by1 - by0 + 1
    const top = by0 + Math.max(1, Math.round(h * 0.12))
    let sx = 0, n = 0
    for (let y = by0; y <= top; y++) for (let x = bx0; x <= bx1; x++) if (A(S, x, y)) { sx += x; n++ }
    return { x: bx0, y: by0, w: bx1 - bx0 + 1, h, pvx: (n ? sx / n : (bx0 + bx1) / 2) - bx0, pvy: 0 }
  }

  // ---- shelf-pack every wanted item into one atlas
  const items = [], miss = []
  for (const want of WANT) {
    const S = sheets[want.sheet], g = grids[want.sheet][want.band]
    const cb = g && g.cols[want.i]
    if (!cb) { miss.push(want.name); continue }
    const b = bbox(S, cb[0], cb[1], g.y0, g.y1)
    if (!b) { miss.push(want.name); continue }
    const sc = Math.min(want.size / b.w, want.size / b.h)
    items.push({ name: want.name, S, src: b, w: Math.max(1, Math.round(b.w * sc)), h: Math.max(1, Math.round(b.h * sc)),
      pv: [Math.round(b.pvx * sc), Math.round(b.pvy * sc)] })
  }
  const AW = 512
  let sx = 0, sy = 0, shelfH = 0
  for (const it of items) {
    if (sx + it.w > AW) { sx = 0; sy += shelfH + 2; shelfH = 0 }
    it.x = sx; it.y = sy; sx += it.w + 2; shelfH = Math.max(shelfH, it.h)
  }
  const AH = sy + shelfH + 2
  const atlas = document.createElement('canvas'); atlas.width = AW; atlas.height = AH
  const ax = atlas.getContext('2d'); ax.imageSmoothingEnabled = true; ax.imageSmoothingQuality = 'high'
  const cellmap = {}
  for (const it of items) {
    ax.drawImage(it.S.cv, it.src.x, it.src.y, it.src.w, it.src.h, it.x, it.y, it.w, it.h)
    cellmap[it.name] = [it.x, it.y, it.w, it.h, it.pv[0], it.pv[1]]   // x,y,w,h + pivot within the rect
  }
  return { atlas: atlas.toDataURL('image/png'), cellmap, shape, miss, size: [AW, AH] }
}, { files, WANT })

fs.mkdirSync('public', { recursive: true })
fs.writeFileSync(OUT, Buffer.from(res.atlas.split(',')[1], 'base64'))
fs.writeFileSync('art/wheel_v50.cellmap.json', JSON.stringify(res.cellmap))
console.log(JSON.stringify({
  sheetShapes: res.shape, atlas: res.size.join('x'), items: Object.keys(res.cellmap).length,
  missing: res.miss, bytes: fs.statSync(OUT).size,
}, null, 1))
if (res.miss.length) process.exitCode = 1
await browser.close()
