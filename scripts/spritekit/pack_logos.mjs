// Pack the three 5x6 team-emblem sheets (art/football-logo-sheet-*.png) into one
// 10x9 grid of 128px cells -> public/rib_logos_v44.png, and re-bake the sheet into
// index.html (window.__RIB_LOGOS_V44) — public/ is only reachable in vite dev.
//
// v44.2 CONTENT-AWARE SLICING: the source sheets are NOT on exact uniform grids —
// logos sit up to ~20px off their nominal cell and some spill across the grid line.
// Naive rectangular slicing left 42/90 cells visibly off-center and let neighbors
// bleed slivers into each other. So instead: connected alpha components are found
// across each WHOLE sheet, every component is assigned to the nominal cell that
// contains its center of mass, each cell crops the union bbox of ITS components
// (recovering any part that crossed the grid line), pixels belonging to other
// cells' components are masked out of the crop, and the result is contain-fit and
// exactly centered in its 128 box. A QA pass re-measures the finished atlas and
// fails the build if any cell is off-center or touches its cell edge.
//
// Index order is row-major across each sheet in file order (animals 0-29,
// warriors 30-59, concepts 60-89), matching the LOGO_DB table in index.html.
import { chromium } from 'playwright'
import fs from 'fs'

const SHEETS = [
  'art/football-logo-sheet-1-animals.png',
  'art/football-logo-sheet-2-warriors.png',
  'art/football-logo-sheet-3-bugs-concepts.png',
]
const COLS_SRC = 5, ROWS_SRC = 6      // every sheet is a 5-wide, 6-tall grid
const CELL = 128, COLS = 10, ROWS = 9 // packed layout: 90 cells, 1280x1152
const PAD = 5                          // breathing room inside each packed cell
const OUT = 'public/rib_logos_v44.png'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
const srcs = SHEETS.map(f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'))

const result = await page.evaluate(async ({ srcs, COLS_SRC, ROWS_SRC, CELL, COLS, ROWS, PAD }) => {
  const imgs = await Promise.all(srcs.map(src => new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src
  })))
  const atlas = document.createElement('canvas')
  atlas.width = COLS * CELL; atlas.height = ROWS * CELL
  const actx = atlas.getContext('2d')
  actx.imageSmoothingQuality = 'high'

  const DF = 4          // downsample factor for the component pass
  const ATH = 16        // alpha threshold: what counts as content
  const MIN_COMP = 3    // downsampled px — drop pure speck noise, keep design dots
  let idx = 0
  for (const img of imgs) {
    const W = img.width, H = img.height
    const cw = W / COLS_SRC, ch = H / ROWS_SRC
    const full = document.createElement('canvas'); full.width = W; full.height = H
    const fctx = full.getContext('2d', { willReadFrequently: true })
    fctx.drawImage(img, 0, 0)
    const data = fctx.getImageData(0, 0, W, H).data

    // --- downsampled alpha mask + connected components (BFS, 4-neighbor) ---
    const w4 = Math.ceil(W / DF), h4 = Math.ceil(H / DF)
    const mask = new Uint8Array(w4 * h4)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > ATH) mask[(y / DF | 0) * w4 + (x / DF | 0)] = 1
    }
    const label = new Int32Array(w4 * h4).fill(-1)
    const comps = []
    const qx = new Int32Array(w4 * h4), qy = new Int32Array(w4 * h4)
    for (let sy = 0; sy < h4; sy++) for (let sx = 0; sx < w4; sx++) {
      if (!mask[sy * w4 + sx] || label[sy * w4 + sx] !== -1) continue
      const id = comps.length
      let head = 0, tail = 0
      qx[tail] = sx; qy[tail] = sy; tail++; label[sy * w4 + sx] = id
      const c = { id, area: 0, sx: 0, sy: 0, minX: sx, maxX: sx, minY: sy, maxY: sy }
      while (head < tail) {
        const x = qx[head], y = qy[head]; head++
        c.area++; c.sx += x; c.sy += y
        if (x < c.minX) c.minX = x; if (x > c.maxX) c.maxX = x
        if (y < c.minY) c.minY = y; if (y > c.maxY) c.maxY = y
        if (x > 0 && mask[y * w4 + x - 1] && label[y * w4 + x - 1] === -1) { label[y * w4 + x - 1] = id; qx[tail] = x - 1; qy[tail] = y; tail++ }
        if (x < w4 - 1 && mask[y * w4 + x + 1] && label[y * w4 + x + 1] === -1) { label[y * w4 + x + 1] = id; qx[tail] = x + 1; qy[tail] = y; tail++ }
        if (y > 0 && mask[(y - 1) * w4 + x] && label[(y - 1) * w4 + x] === -1) { label[(y - 1) * w4 + x] = id; qx[tail] = x; qy[tail] = y - 1; tail++ }
        if (y < h4 - 1 && mask[(y + 1) * w4 + x] && label[(y + 1) * w4 + x] === -1) { label[(y + 1) * w4 + x] = id; qx[tail] = x; qy[tail] = y + 1; tail++ }
      }
      comps.push(c)
    }

    // --- assign components to the nominal cell holding their center of mass ---
    const cellOf = new Int32Array(comps.length).fill(-1)
    const cells = Array.from({ length: COLS_SRC * ROWS_SRC }, () => ({ ids: new Set(), minX: 1e9, maxX: -1, minY: 1e9, maxY: -1 }))
    for (const c of comps) {
      if (c.area < MIN_COMP) continue
      const cx = c.sx / c.area * DF, cy = c.sy / c.area * DF
      const col = Math.min(COLS_SRC - 1, Math.max(0, Math.floor(cx / cw)))
      const row = Math.min(ROWS_SRC - 1, Math.max(0, Math.floor(cy / ch)))
      const cell = cells[row * COLS_SRC + col]
      cellOf[c.id] = row * COLS_SRC + col
      cell.ids.add(c.id)
      cell.minX = Math.min(cell.minX, c.minX * DF); cell.maxX = Math.max(cell.maxX, c.maxX * DF + DF - 1)
      cell.minY = Math.min(cell.minY, c.minY * DF); cell.maxY = Math.max(cell.maxY, c.maxY * DF + DF - 1)
    }

    // --- crop each cell's union bbox, mask out other cells' pixels, center in the atlas ---
    for (let r = 0; r < ROWS_SRC; r++) for (let cIdx = 0; cIdx < COLS_SRC; cIdx++) {
      const cell = cells[r * COLS_SRC + cIdx]
      if (cell.maxX < 0) throw new Error('empty cell in sheet at grid ' + cIdx + ',' + r)
      const bx = Math.max(0, cell.minX - 1), by = Math.max(0, cell.minY - 1)
      const bw = Math.min(W - 1, cell.maxX + 1) - bx + 1, bh = Math.min(H - 1, cell.maxY + 1) - by + 1
      const crop = document.createElement('canvas'); crop.width = bw; crop.height = bh
      const cctx = crop.getContext('2d', { willReadFrequently: true })
      cctx.drawImage(full, bx, by, bw, bh, 0, 0, bw, bh)
      const cd = cctx.getImageData(0, 0, bw, bh)
      const me = r * COLS_SRC + cIdx
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        const a = cd.data[(y * bw + x) * 4 + 3]
        if (!a) continue
        const l = label[(((by + y) / DF) | 0) * w4 + (((bx + x) / DF) | 0)]
        if (l === -1 || cellOf[l] !== me) cd.data[(y * bw + x) * 4 + 3] = 0   // a neighbor's sliver
      }
      cctx.putImageData(cd, 0, 0)
      const dx = (idx % COLS) * CELL, dy = Math.floor(idx / COLS) * CELL
      const box = CELL - PAD * 2, k = Math.min(box / bw, box / bh, 1.5)
      const w = bw * k, h = bh * k
      actx.drawImage(crop, dx + (CELL - w) / 2, dy + (CELL - h) / 2, w, h)
      idx++
    }
  }

  // --- QA: re-measure the finished atlas; every cell must be centered and un-clipped ---
  const qctx = atlas.getContext('2d', { willReadFrequently: true })
  const flagged = []
  for (let i = 0; i < COLS * ROWS && i < 90; i++) {
    const d = qctx.getImageData((i % COLS) * CELL, Math.floor(i / COLS) * CELL, CELL, CELL).data
    let minX = CELL, minY = CELL, maxX = -1, maxY = -1
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
      if (d[(y * CELL + x) * 4 + 3] > ATH) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
    }
    const ox = (minX + maxX) / 2 - CELL / 2, oy = (minY + maxY) / 2 - CELL / 2
    const edge = minX <= 0 || minY <= 0 || maxX >= CELL - 1 || maxY >= CELL - 1
    if (maxX < 0 || Math.abs(ox) > 2.5 || Math.abs(oy) > 2.5 || edge) flagged.push({ i, ox, oy, edge, empty: maxX < 0 })
  }
  return { dataUrl: atlas.toDataURL('image/png'), flagged }
}, { srcs, COLS_SRC, ROWS_SRC, CELL, COLS, ROWS, PAD })

if (result.flagged.length) {
  console.error('QA FAILED — miscentered/clipped cells:', JSON.stringify(result.flagged))
  await browser.close()
  process.exit(1)
}
const buf = Buffer.from(result.dataUrl.split(',')[1], 'base64')
fs.writeFileSync(OUT, buf)
// Re-bake the sheet into index.html so the single-file / GitHub Pages build ships it.
const INDEX = 'index.html'
const html = fs.readFileSync(INDEX, 'utf8')
const line = `window.__RIB_LOGOS_V44 = "${result.dataUrl}";`
const re = /window\.__RIB_LOGOS_V44 = "data:image\/png;base64,[^"]*";/
if (!re.test(html)) throw new Error('index.html is missing the baked __RIB_LOGOS_V44 line')
fs.writeFileSync(INDEX, html.replace(re, line))
console.log(JSON.stringify({ out: OUT, cells: 90, bytes: buf.length, baked: true, qa: 'all cells centered' }))
await browser.close()
