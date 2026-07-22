// Show each row of a sheet as a labeled strip (frames 0..N) so row->facing can
// be assigned confidently. Usage: node scripts/spritekit/survey.mjs "cuts and jukes pixel art.png"
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
const SRC = 'art/source'
const OUT = process.env.SPRITE_SURVEY_OUT || '/tmp'
const name = process.argv[2]
const b64 = fs.readFileSync(path.join(SRC, name)).toString('base64')
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
const url = await page.evaluate(async ({ b64 }) => {
  const img = new Image(); await new Promise(r => { img.onload = r; img.src = 'data:image/png;base64,' + b64 })
  const W = img.width, H = img.height
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false; cx.drawImage(img, 0, 0)
  const D = cx.getImageData(0, 0, W, H).data
  const isSprite = (x, y) => { const i = (y * W + x) * 4, r = D[i], g = D[i + 1], b = D[i + 2], a = D[i + 3]; if (a < 70) return false; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0; if (r > 228 && g > 228 && b > 228) return false; if (sat < 0.16) return false; return true }
  function bands(proj, N, minRun, gapFrac) { const peak = Math.max(...proj), thr = Math.max(1, peak * 0.03); const on = []; for (let i = 0; i < N; i++) on.push(proj[i] > thr); const gm = Math.round(N * (gapFrac || 0.012)); for (let i = 0; i < N; i++) if (!on[i]) { let j = i; while (j < N && !on[j]) j++; if (j - i <= gm && i > 0 && j < N) for (let k = i; k < j; k++) on[k] = true; i = j } const out = []; let s = -1; for (let i = 0; i < N; i++) { if (on[i] && s < 0) s = i; else if (!on[i] && s >= 0) { if (i - s >= minRun) out.push([s, i]); s = -1 } } if (s >= 0 && N - s >= minRun) out.push([s, N]); return out }
  const rowProj = new Float32Array(H); for (let y = 0; y < H; y++) { let c = 0; for (let x = 0; x < W; x++) if (isSprite(x, y)) c++; rowProj[y] = c }
  const rows = bands(rowProj, H, Math.round(H * 0.02), 0.02)
  const CELL = 84, pad = 3, labelW = 26
  const perRowFrames = rows.map(([ry0, ry1]) => { const cp = new Float32Array(W); for (let x = 0; x < W; x++) { let c = 0; for (let y = ry0; y < ry1; y++) if (isSprite(x, y)) c++; cp[x] = c } return { ry0, ry1, cols: bands(cp, W, Math.round(W * 0.012), 0.006) } })
  const maxC = Math.max(...perRowFrames.map(r => r.cols.length))
  const mont = document.createElement('canvas'); mont.width = labelW + maxC * (CELL + pad) + pad; mont.height = rows.length * (CELL + pad) + pad
  const mx = mont.getContext('2d'); mx.imageSmoothingEnabled = false; mx.fillStyle = '#0d1420'; mx.fillRect(0, 0, mont.width, mont.height)
  mx.font = 'bold 16px monospace'; mx.textBaseline = 'middle'
  perRowFrames.forEach((rw, ri) => {
    const gy = pad + ri * (CELL + pad)
    mx.fillStyle = '#f0bb45'; mx.fillText(String(ri), 4, gy + CELL / 2)
    rw.cols.forEach(([cx0, cx1], ci) => {
      let x0 = cx1, x1 = cx0, y0 = rw.ry1, y1 = rw.ry0
      for (let y = rw.ry0; y < rw.ry1; y++) for (let x = cx0; x < cx1; x++) if (isSprite(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
      if (x1 < x0) return; x1++; y1++
      const gx = labelW + pad + ci * (CELL + pad)
      mx.strokeStyle = 'rgba(255,255,255,.08)'; mx.strokeRect(gx, gy, CELL, CELL)
      const sc = Math.min(CELL / (x1 - x0), CELL / (y1 - y0))
      const dw = (x1 - x0) * sc, dh = (y1 - y0) * sc
      mx.drawImage(cv, x0, y0, x1 - x0, y1 - y0, gx + (CELL - dw) / 2, gy + CELL - dh, dw, dh)  // bottom-aligned
      mx.fillStyle = 'rgba(255,255,255,.4)'; mx.font = '10px monospace'; mx.fillText(ci, gx + 2, gy + 8); mx.font = 'bold 16px monospace'
    })
  })
  return mont.toDataURL('image/png')
}, { b64 })
fs.writeFileSync(path.join(OUT, 'survey_' + name.replace(/[^a-z0-9]+/gi, '_') + '.png'), Buffer.from(url.split(',')[1], 'base64'))
console.log('wrote survey (rows labeled 0..N in gold, frame index top-left)')
await browser.close()
