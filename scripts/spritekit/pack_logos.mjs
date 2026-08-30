// Pack the three 5x6 team-emblem sheets (art/football-logo-sheet-*.png) into one
// 10x9 grid of 128px cells -> public/rib_logos_v44.png. Index order is row-major
// across each sheet in file order (animals 0-29, warriors 30-59, concepts 60-89),
// matching the LOGO_DB table baked into index.html (v44 TEAM EMBLEMS).
//
// v69 — the emblem is found by its OWN INK, not by the grid line.
//
// The first cut sliced each sheet on a rigid 5x6 grid and contain-fit the whole
// grid cell into the packed cell. Two things follow from that and both were on
// screen. The artist did not centre every emblem in its square, so contain-fitting
// the SQUARE left each emblem sitting wherever it happened to sit — high, low, hard
// against one side — and no two crests lined up with each other. And several
// emblems overhang their square, so a neighbour's ink lands inside this cell,
// survives the crop and comes through as a sliver of someone else's logo along the
// packed cell's edge (and the overhanging part of the emblem's own art was clipped
// off at the same time).
//
// So the sheet is labelled into connected components ONCE, and each component is
// assigned to the cell its centroid falls in. An emblem that overhangs its square
// keeps the overhanging part, because the part belongs to the component, not to the
// square; a neighbour's overhang can never be picked up, because its centroid is in
// a different cell. Each emblem is then tight-cropped to the union of its own
// components and centred on that — so every crest is centred on ITSELF and they all
// come out the same visual weight.
import { chromium } from 'playwright'
import fs from 'fs'

const SHEETS = [
  'art/football-logo-sheet-1-animals.png',
  'art/football-logo-sheet-2-warriors.png',
  'art/football-logo-sheet-3-bugs-concepts.png',
]
const COLS_SRC = 5, ROWS_SRC = 6      // every sheet is a 5-wide, 6-tall grid
const CELL = 128, COLS = 10, ROWS = 9 // packed layout: 90 cells, 1280x1152
const PAD = 6                          // breathing room inside each packed cell
const ALPHA = 24                       // what counts as ink
const OUT = 'public/rib_logos_v44.png'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
const srcs = SHEETS.map(f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'))

const res = await page.evaluate(async ({ srcs, COLS_SRC, ROWS_SRC, CELL, COLS, ROWS, PAD, ALPHA }) => {
  const imgs = await Promise.all(srcs.map(src => new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src
  })))
  const atlas = document.createElement('canvas')
  atlas.width = COLS * CELL; atlas.height = ROWS * CELL
  const ax = atlas.getContext('2d')
  ax.imageSmoothingEnabled = true; ax.imageSmoothingQuality = 'high'
  const scratch = document.createElement('canvas')
  const sx = scratch.getContext('2d', { willReadFrequently: true })
  const report = []
  let idx = 0

  for (const img of imgs) {
    const W = img.width, H = img.height, N = W * H
    const cw = W / COLS_SRC, ch = H / ROWS_SRC
    scratch.width = W; scratch.height = H
    sx.clearRect(0, 0, W, H); sx.drawImage(img, 0, 0)
    const im = sx.getImageData(0, 0, W, H), d = im.data

    // ---- label the whole sheet once. A component is one blob of ink; an emblem is
    // usually one, sometimes a few (a detached spark, an outline flake).
    const lab = new Int32Array(N).fill(-1)
    const stack = new Int32Array(N)
    const comps = []
    for (let p = 0; p < N; p++) {
      if (lab[p] !== -1 || d[p * 4 + 3] <= ALPHA) continue
      const id = comps.length
      const c = { n: 0, sx: 0, sy: 0, x0: W, x1: -1, y0: H, y1: -1 }
      let sp = 0; stack[sp++] = p; lab[p] = id
      while (sp) {
        const cur = stack[--sp], cy = (cur / W) | 0, cx = cur - cy * W
        c.n++; c.sx += cx; c.sy += cy
        if (cx < c.x0) c.x0 = cx; if (cx > c.x1) c.x1 = cx
        if (cy < c.y0) c.y0 = cy; if (cy > c.y1) c.y1 = cy
        if (cx > 0) { const q = cur - 1; if (lab[q] === -1 && d[q * 4 + 3] > ALPHA) { lab[q] = id; stack[sp++] = q } }
        if (cx < W - 1) { const q = cur + 1; if (lab[q] === -1 && d[q * 4 + 3] > ALPHA) { lab[q] = id; stack[sp++] = q } }
        if (cy > 0) { const q = cur - W; if (lab[q] === -1 && d[q * 4 + 3] > ALPHA) { lab[q] = id; stack[sp++] = q } }
        if (cy < H - 1) { const q = cur + W; if (lab[q] === -1 && d[q * 4 + 3] > ALPHA) { lab[q] = id; stack[sp++] = q } }
      }
      comps.push(c)
    }
    // ---- each component belongs to the cell its CENTROID is in. This is the whole
    // fix: overhang follows its own emblem, and can never follow anyone else's.
    comps.forEach(c => {
      const gx = Math.min(COLS_SRC - 1, Math.max(0, Math.floor((c.sx / c.n) / cw)))
      const gy = Math.min(ROWS_SRC - 1, Math.max(0, Math.floor((c.sy / c.n) / ch)))
      c.cell = gy * COLS_SRC + gx
    })
    // ...and specks are dropped rather than dragging a bbox out to nothing: an
    // emblem's real detail is never a thousandth of its own mass.
    const byCell = new Map()
    for (const c of comps) { const a = byCell.get(c.cell) || []; a.push(c); byCell.set(c.cell, a) }
    for (const [cell, list] of byCell) {
      const main = list.reduce((a, b) => (b.n > (a ? a.n : 0) ? b : a), null)
      byCell.set(cell, list.filter(c => c.n >= main.n * 0.002))
    }

    for (let cell = 0; cell < COLS_SRC * ROWS_SRC; cell++, idx++) {
      const keep = byCell.get(cell) || []
      if (!keep.length) { report.push({ idx, empty: true }); continue }
      const keepIds = new Set(keep.map(c => comps.indexOf(c)))
      let x0 = W, x1 = -1, y0 = H, y1 = -1
      for (const c of keep) { if (c.x0 < x0) x0 = c.x0; if (c.x1 > x1) x1 = c.x1
        if (c.y0 < y0) y0 = c.y0; if (c.y1 > y1) y1 = c.y1 }
      const w = x1 - x0 + 1, h = y1 - y0 + 1
      // lift ONLY this emblem's pixels out of the sheet — a neighbour whose bbox
      // overlaps this crop is still labelled someone else's and stays behind
      const cut = document.createElement('canvas'); cut.width = w; cut.height = h
      const cg = cut.getContext('2d')
      const cim = cg.createImageData(w, h), cd = cim.data
      let alien = 0
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        const sp2 = ((y0 + yy) * W + (x0 + xx)) * 4, dp = (yy * w + xx) * 4
        const l = lab[(y0 + yy) * W + (x0 + xx)]
        if (l < 0) continue
        if (!keepIds.has(l)) { alien++; continue }     // a neighbour reaching into this crop
        cd[dp] = d[sp2]; cd[dp + 1] = d[sp2 + 1]; cd[dp + 2] = d[sp2 + 2]; cd[dp + 3] = d[sp2 + 3]
      }
      cg.putImageData(cim, 0, 0)
      // contain-fit the EMBLEM, centred on the emblem — so every crest lands on the
      // same optical centre and at the same visual weight
      const dx = (idx % COLS) * CELL, dy = Math.floor(idx / COLS) * CELL
      const box = CELL - PAD * 2, k = Math.min(box / w, box / h)
      const dw = w * k, dh = h * k
      ax.drawImage(cut, 0, 0, w, h, dx + (CELL - dw) / 2, dy + (CELL - dh) / 2, dw, dh)
      report.push({ idx, src: w + 'x' + h, comps: keep.length, alienPx: alien,
        overhang: (x0 < Math.floor((cell % COLS_SRC) * cw) || x1 > Math.ceil(((cell % COLS_SRC) + 1) * cw) - 1
          || y0 < Math.floor(Math.floor(cell / COLS_SRC) * ch) || y1 > Math.ceil((Math.floor(cell / COLS_SRC) + 1) * ch) - 1) })
    }
  }
  // quantize. The emblems now fill their cells, which is the point, but it also
  // means far more ink per cell — and this sheet bakes into index.html as base64.
  // 6 bits of RGB is invisible at 128px and takes a large bite out of the PNG.
  const aim = ax.getImageData(0, 0, atlas.width, atlas.height), ad = aim.data
  for (let i = 0; i < ad.length; i += 4) {
    if (ad[i + 3] < 16) { ad[i] = ad[i + 1] = ad[i + 2] = ad[i + 3] = 0; continue }
    ad[i] &= 0xfc; ad[i + 1] &= 0xfc; ad[i + 2] &= 0xfc
  }
  ax.putImageData(aim, 0, 0)
  return { url: atlas.toDataURL('image/png'), report, size: [atlas.width, atlas.height] }
}, { srcs, COLS_SRC, ROWS_SRC, CELL, COLS, ROWS, PAD, ALPHA })

const dataUrl = res.url
const buf = Buffer.from(dataUrl.split(',')[1], 'base64')
fs.writeFileSync(OUT, buf)
const empty = res.report.filter(r => r.empty)
const alien = res.report.filter(r => r.alienPx > 0)
const over = res.report.filter(r => r.overhang)
console.log('emblems that overhang their own square (kept whole now):', over.map(r => r.idx).join(', ') || 'none')
console.log('crops a neighbour reaches into (its ink was left behind):', alien.map(r => r.idx + ':' + r.alienPx + 'px').join(', ') || 'none')
if (empty.length) console.error('EMPTY CELLS:', empty.map(r => r.idx).join(', '))

// Re-bake the sheet into index.html (window.__RIB_LOGOS_V44) so the single-file /
// GitHub Pages build ships the emblems too — public/ is only reachable in vite dev.
const INDEX = 'index.html'
const html = fs.readFileSync(INDEX, 'utf8')
const line = `window.__RIB_LOGOS_V44 = "${dataUrl}";`
const re = /window\.__RIB_LOGOS_V44 = "data:image\/png;base64,[^"]*";/
if (!re.test(html)) throw new Error('index.html is missing the baked __RIB_LOGOS_V44 line')
fs.writeFileSync(INDEX, html.replace(re, line))
console.log(JSON.stringify({ out: OUT, atlas: res.size.join('x'), cells: res.report.length,
  empty: empty.length, bytes: buf.length, baked: true }))
await browser.close()
process.exitCode = empty.length ? 1 : 0
