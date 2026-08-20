// Pack the uploaded referee sheet into a dedicated officials atlas the v49 ref
// renderer consumes directly (no team recolor, no procedural zebra pass).
//
// The source is a 8x8 grid of hand-drawn officials on a near-white checkerboard
// matte with NO alpha channel, so the background is keyed by flood-filling the
// near-neutral bright pixels in from the image border (interior white stripes,
// gloves and shoes sit behind dark outlines and survive), then the anti-aliased
// white rim left over from that matte is eroded away.
//
// Every sprite is packed with ONE global scale — a per-frame "fit the cell" scale
// makes the crew visibly breathe between frames — bottom-aligned on a shared foot
// line and centred on the FOOT centroid so an extended arm or a thrown flag never
// slides the body sideways mid-animation.
//
// Emits public/rib_refs_v49.png (8 cols x 9 rows of 64px cells) +
// art/refs_v49.cellmap.json. Run scripts/spritekit/bake_refs.mjs afterwards to
// inline it into index.html.
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const SRC = 'art/source/referee crew pixel art.png'
const OUT = 'public/rib_refs_v49.png'
const CELL = 64          // 64, not the players' 48: the both-arms-up signal is taller than a 48 cell
const FOOT_Y = 52        // bottom pixel row lands on cell y=51 — the players' +19px-from-centre foot line
const BODY = 38          // standing height in px. Players are 40 in their 48 cell; officials wear no pads.
const COLS = 8

// ---- sheet rows, as drawn (verified frame by frame against the contact sheet)
//   0 front run x8      1 three-quarter run x8   2 side run x8   3 back run x8
//   4 front stand x8    5 [0]=stand, [1..7]=both arms up (touchdown)
//   6 flag sequence: idle / reach to belt / point with flag / flag out / heave
//     (+ the loose flag drawn between cols 4 and 5) / stand / point left x2
//   7 whistle at the mouth x8, [4] adds an extended point
// `mir` mirrors a frame while packing. The engine's convention (see faceMarker:
// `m.flip = dx > 0`) is that UNFLIPPED art faces LEFT — the player atlas is drawn
// that way — but this sheet's side and three-quarter rows face right, as do the
// flag heave and the extended point. Mirroring here keeps every frame obeying the
// one rule the renderer relies on.
const MAP = {}
const dirRow = { dn: [0, false], dr: [1, true], sd: [2, true], up: [3, false] }
for (const [d, [r, mir]] of Object.entries(dirRow)) for (let i = 0; i < 8; i++) MAP[`run_${d}${i}`] = { row: r, col: i, mir }
// A standing official is not a statue: four near-identical stand frames give a
// slow weight shift instead of a frozen sprite.
for (let i = 0; i < 4; i++) MAP[`idle${i}`] = { row: 4, col: i }
// There is no side/back STAND on the sheet, and parking a sideways official on a
// mid-stride run frame reads as a freeze-frame. col:-1 means "pick this row's most
// planted frame" — the one whose feet are closest together — which stands still.
MAP['stand_dr'] = { row: 1, col: -1, mir: true }
MAP['stand_sd'] = { row: 2, col: -1, mir: true }
MAP['stand_up'] = { row: 3, col: -1 }
MAP['stand'] = { row: 5, col: 0 }
// touchdown: officials SNAP both arms up and hold, so these are hold frames, not a raise
for (let i = 0; i < 6; i++) MAP[`signal${i}`] = { row: 5, col: i + 1 }
// Six-frame flag heave — the state contract the renderer already speaks. Row 6
// bands 9 shapes, not 8: the loose flag is drawn between the heave and the stand,
// so every column after it is shifted one across.
for (let i = 0; i < 5; i++) MAP[`throw${i}`] = { row: 6, col: i, mir: true }
MAP['throw5'] = { row: 6, col: 6, mir: true }  // hands back down after the heave
MAP['point'] = { row: 6, col: 7 }              // arm extended — already drawn facing left
MAP['point2'] = { row: 6, col: 8 }
MAP['flag'] = { row: 6, col: 5, loose: true }  // the thrown flag itself — centred, not foot-aligned
for (let i = 0; i < 4; i++) MAP[`whistle${i}`] = { row: 7, col: i }
MAP['whistle_point'] = { row: 7, col: 4, mir: true }

const names = Object.keys(MAP)
const rowsN = Math.ceil(names.length / COLS)
const cellmap = {}
names.forEach((n, i) => { cellmap[n] = [i % COLS, Math.floor(i / COLS)] })

const src = fs.readFileSync(SRC).toString('base64')
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
page.on('console', m => console.log('  [page]', m.text()))

const res = await page.evaluate(async ({ src, MAP, cellmap, COLS, rowsN, CELL, FOOT_Y, BODY }) => {
  const im = new Image()
  await new Promise(r => { im.onload = r; im.src = 'data:image/png;base64,' + src })
  const W = im.width, H = im.height
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false
  cx.drawImage(im, 0, 0)
  const img = cx.getImageData(0, 0, W, H), d = img.data

  // ---- 1. key the matte: flood-fill bright near-neutral pixels in from the border
  const bgish = i => {
    const r = d[i], g = d[i + 1], b = d[i + 2]
    return Math.min(r, g, b) >= 234 && (Math.max(r, g, b) - Math.min(r, g, b)) <= 14
  }
  const seen = new Uint8Array(W * H), stack = []
  for (let x = 0; x < W; x++) { stack.push(x, x + (H - 1) * W) }
  for (let y = 0; y < H; y++) { stack.push(y * W, W - 1 + y * W) }
  while (stack.length) {
    const p = stack.pop(); if (seen[p]) continue; seen[p] = 1
    const i = p * 4; if (!bgish(i)) continue
    d[i + 3] = 0
    const xx = p % W, yy = (p / W) | 0
    if (xx > 0) stack.push(p - 1); if (xx < W - 1) stack.push(p + 1)
    if (yy > 0) stack.push(p - W); if (yy < H - 1) stack.push(p + W)
  }
  // ---- 2. erode the anti-aliased white rim the matte left behind. Only very light,
  // near-neutral pixels that touch transparency go — the shirt's white stripes sit
  // inside the figure's dark outline and are never on that boundary.
  for (let pass = 0; pass < 2; pass++) {
    const kill = []
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x, i = p * 4
      if (d[i + 3] === 0) continue
      const mn = Math.min(d[i], d[i + 1], d[i + 2]), mx = Math.max(d[i], d[i + 1], d[i + 2])
      if (mn < 206 || mx - mn > 18) continue
      const edge = (x > 0 && d[(p - 1) * 4 + 3] === 0) || (x < W - 1 && d[(p + 1) * 4 + 3] === 0) ||
        (y > 0 && d[(p - W) * 4 + 3] === 0) || (y < H - 1 && d[(p + W) * 4 + 3] === 0)
      if (edge) kill.push(i)
    }
    for (const i of kill) d[i + 3] = 0
  }
  cx.putImageData(img, 0, 0)
  const A = (x, y) => d[(y * W + x) * 4 + 3] > 24

  // ---- 3. band the sheet into rows, then each row into sprite columns
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
  const rows = bands(rp, H, 8, 5)
  const grid = rows.map(([y0, y1]) => {
    const cp = new Int32Array(W)
    for (let x = 0; x < W; x++) { let c = 0; for (let y = y0; y <= y1; y++) if (A(x, y)) c++; cp[x] = c }
    return { y0, y1, cols: bands(cp, W, 10, 4) }
  })
  const shape = grid.map(g => g.cols.length)

  // ---- 4. per-sprite metrics: tight bbox + the FOOT centroid (bottom 18% of the
  // silhouette), which is the anchor an extended arm must not be able to move.
  const metric = (x0, x1, y0, y1) => {
    let bx0 = 1e9, bx1 = -1, by0 = 1e9, by1 = -1
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (A(x, y)) {
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y
    }
    if (bx1 < 0) return null
    const h = by1 - by0 + 1
    const fy = by1 - Math.max(2, Math.round(h * 0.18))
    let sx = 0, n = 0
    for (let y = fy; y <= by1; y++) for (let x = bx0; x <= bx1; x++) if (A(x, y)) { sx += x; n++ }
    const footX = n ? sx / n : (bx0 + bx1) / 2
    return { bx0, bx1, by0, by1, w: bx1 - bx0 + 1, h, footX }
  }
  // widest-planted-stance search: the frame whose feet occupy the least horizontal
  // spread is the one standing still rather than mid-stride
  const planted = {}
  const plantedCol = (row) => {
    if (planted[row] != null) return planted[row]
    const g = grid[row]
    let bi = 0, bw = 1e9
    g.cols.forEach((cb, ci) => {
      const b = metric(cb[0], cb[1], g.y0, g.y1); if (!b) return
      let x0 = 1e9, x1 = -1
      const fy = b.by1 - Math.max(2, Math.round(b.h * 0.1))
      for (let y = fy; y <= b.by1; y++) for (let x = b.bx0; x <= b.bx1; x++) if (A(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x }
      const w = x1 - x0
      if (w >= 0 && w < bw) { bw = w; bi = ci }
    })
    return planted[row] = bi
  }
  const cellOf = (m) => {
    const g = grid[m.row]; if (!g) return null
    const cb = g.cols[m.col < 0 ? plantedCol(m.row) : m.col]; if (!cb) return null
    return metric(cb[0], cb[1], g.y0, g.y1)
  }

  // ---- 5. ONE global scale for the whole crew, pinned to the standing pose
  const standHs = grid[4].cols.map(cb => metric(cb[0], cb[1], grid[4].y0, grid[4].y1)).filter(Boolean).map(m => m.h).sort((a, b) => a - b)
  const standH = standHs[standHs.length >> 1]
  const S = BODY / standH

  const atlas = document.createElement('canvas'); atlas.width = COLS * CELL; atlas.height = rowsN * CELL
  const ax = atlas.getContext('2d')
  ax.imageSmoothingEnabled = true; ax.imageSmoothingQuality = 'high'

  const report = {}
  for (const name in MAP) {
    const m = MAP[name]
    const b = cellOf(m); if (!b) { report[name] = 'MISSING'; continue }
    const [gc, gr] = cellmap[name]
    const dw = b.w * S, dh = b.h * S
    let dx, dy
    if (m.loose) {                                   // the loose flag rides mid-cell, it has no feet
      dx = gc * CELL + (CELL - dw) / 2
      dy = gr * CELL + (CELL - dh) / 2
    } else {
      dx = gc * CELL + CELL / 2 - (b.footX - b.bx0 + 0.5) * S    // foot centroid on the cell centre line
      dy = gr * CELL + FOOT_Y - dh                               // feet on the shared baseline
    }
    if (m.mir) {
      ax.save(); ax.translate(dx + dw, dy); ax.scale(-1, 1)
      ax.drawImage(cv, b.bx0, b.by0, b.w, b.h, 0, 0, dw, dh)
      ax.restore()
    } else ax.drawImage(cv, b.bx0, b.by0, b.w, b.h, dx, dy, dw, dh)
    report[name] = { src: [b.bx0, b.by0, b.w, b.h], out: [Math.round(dw), Math.round(dh)] }
  }

  // debug contact sheet: the keyed source, each sprite boxed and labelled row.col
  const dbg = document.createElement('canvas'); dbg.width = W; dbg.height = H
  const dc = dbg.getContext('2d')
  dc.fillStyle = '#6b6b6b'; dc.fillRect(0, 0, W, H)
  dc.drawImage(cv, 0, 0)
  dc.strokeStyle = '#00e5ff'; dc.lineWidth = 2; dc.font = '18px monospace'; dc.fillStyle = '#00e5ff'
  grid.forEach((g, ri) => g.cols.forEach((cb, ci) => {
    dc.strokeRect(cb[0], g.y0, cb[1] - cb[0], g.y1 - g.y0)
    dc.fillText(ri + '.' + ci, cb[0] + 2, g.y0 - 3)
  }))

  return {
    atlas: atlas.toDataURL('image/png'), debug: dbg.toDataURL('image/png'),
    shape, standH, scale: S, report,
  }
}, { src, MAP, cellmap, COLS, rowsN, CELL, FOOT_Y, BODY })

fs.mkdirSync('public', { recursive: true })
fs.writeFileSync(OUT, Buffer.from(res.atlas.split(',')[1], 'base64'))
fs.writeFileSync('art/refs_v49.cellmap.json', JSON.stringify(cellmap))
const dbgPath = process.env.REF_DEBUG_OUT
if (dbgPath) fs.writeFileSync(dbgPath, Buffer.from(res.debug.split(',')[1], 'base64'))
const missing = Object.entries(res.report).filter(([, v]) => v === 'MISSING').map(([k]) => k)
console.log(JSON.stringify({
  sheetShape: res.shape, standH: res.standH, scale: +res.scale.toFixed(4),
  cells: names.length, grid: `${COLS}x${rowsN} @${CELL}px`, missing,
  bytes: fs.statSync(OUT).size,
}, null, 1))
if (missing.length) process.exitCode = 1
await browser.close()
