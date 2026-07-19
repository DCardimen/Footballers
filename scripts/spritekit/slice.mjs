// Slice one sheet into trimmed per-frame sprites and emit a labeled montage
// (transparent-safe, drop-shadow-aware). Row bands are global; column bands are
// detected LOCAL to each row so wide poses in one row don't merge across rows.
// Usage: node scripts/spritekit/slice.mjs "get up pixel art.png" [cell]
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
const SRC = 'art/source'
const OUT = '/tmp/claude-0/-home-user-Footballers/a0f4f9fa-21d7-5b3a-bcfc-e0e403d2b6b1/scratchpad'
const name = process.argv[2]
const cell = Number(process.argv[3] || 64)
const b64 = fs.readFileSync(path.join(SRC, name)).toString('base64')
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
const res = await page.evaluate(async ({ b64, cell }) => {
  const img = new Image()
  await new Promise(r => { img.onload = r; img.src = 'data:image/png;base64,' + b64 })
  const W = img.width, H = img.height
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false; cx.drawImage(img, 0, 0)
  const D = cx.getImageData(0, 0, W, H).data
  const bgTransparent = D[3] < 20
  // sprite pixel = opaque, saturated color (excludes white bg AND grey shadow)
  const isSprite = (x, y) => {
    const i = (y * W + x) * 4, r = D[i], g = D[i + 1], b = D[i + 2], a = D[i + 3]
    if (a < 70) return false
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    const sat = mx ? (mx - mn) / mx : 0
    if (r > 228 && g > 228 && b > 228) return false        // white bg
    if (sat < 0.16) return false                            // grey shadow / neutral
    return true
  }
  function bands(proj, N, minRun, gapFrac) {
    const peak = Math.max(...proj), thr = Math.max(1, peak * 0.03)
    const on = []; for (let i = 0; i < N; i++) on.push(proj[i] > thr)
    const gm = Math.round(N * (gapFrac || 0.012))
    for (let i = 0; i < N; i++) if (!on[i]) { let j = i; while (j < N && !on[j]) j++; if (j - i <= gm && i > 0 && j < N) for (let k = i; k < j; k++) on[k] = true; i = j }
    const out = []; let s = -1
    for (let i = 0; i < N; i++) { if (on[i] && s < 0) s = i; else if (!on[i] && s >= 0) { if (i - s >= minRun) out.push([s, i]); s = -1 } }
    if (s >= 0 && N - s >= minRun) out.push([s, N])
    return out
  }
  // global row projection
  const rowProj = new Float32Array(H)
  for (let y = 0; y < H; y++) { let c = 0; for (let x = 0; x < W; x++) if (isSprite(x, y)) c++; rowProj[y] = c }
  const rows = bands(rowProj, H, Math.round(H * 0.02), 0.02)
  // per-row column detection + trimmed extraction
  const frames = []   // {row,col,sx,sy,sw,sh,url}
  rows.forEach(([ry0, ry1], ri) => {
    const colProj = new Float32Array(W)
    for (let x = 0; x < W; x++) { let c = 0; for (let y = ry0; y < ry1; y++) if (isSprite(x, y)) c++; colProj[x] = c }
    const cols = bands(colProj, W, Math.round(W * 0.012), 0.006)
    cols.forEach(([cx0, cx1], ci) => {
      // tight bbox of sprite pixels within this cell (include shadow for footing? no—sprite only)
      let x0 = cx1, x1 = cx0, y0 = ry1, y1 = ry0
      for (let y = ry0; y < ry1; y++) for (let x = cx0; x < cx1; x++) if (isSprite(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
      if (x1 < x0 || y1 < y0) return
      x1++; y1++
      frames.push({ row: ri, col: ci, sx: x0, sy: y0, sw: x1 - x0, sh: y1 - y0 })
    })
  })
  // montage: cell grid, each frame trimmed + centered (preserve aspect, contain)
  const maxCols = Math.max(...rows.map((_, ri) => frames.filter(f => f.row === ri).length))
  const nrows = rows.length
  const pad = 2
  const mont = document.createElement('canvas'); mont.width = maxCols * (cell + pad) + pad; mont.height = nrows * (cell + pad) + pad
  const mx = mont.getContext('2d'); mx.imageSmoothingEnabled = false
  mx.fillStyle = '#0d1420'; mx.fillRect(0, 0, mont.width, mont.height)
  frames.forEach(f => {
    const gx = pad + f.col * (cell + pad), gy = pad + f.row * (cell + pad)
    mx.strokeStyle = 'rgba(255,255,255,.08)'; mx.strokeRect(gx, gy, cell, cell)
    const sc = Math.min(cell / f.sw, cell / f.sh)
    const dw = Math.round(f.sw * sc), dh = Math.round(f.sh * sc)
    mx.drawImage(cv, f.sx, f.sy, f.sw, f.sh, gx + (cell - dw) / 2, gy + (cell - dh) / 2, dw, dh)
  })
  const perRow = rows.map((_, ri) => frames.filter(f => f.row === ri).length)
  return { W, H, bgTransparent, nrows, perRow, montage: mont.toDataURL('image/png') }
}, { b64, cell })
fs.writeFileSync(path.join(OUT, 'slice_' + name.replace(/[^a-z0-9]+/gi, '_') + '.png'), Buffer.from(res.montage.split(',')[1], 'base64'))
console.log(name, `${res.W}x${res.H} bg=${res.bgTransparent ? 'transp' : 'opaque'} rows=${res.nrows} framesPerRow=[${res.perRow.join(',')}]`)
await browser.close()
