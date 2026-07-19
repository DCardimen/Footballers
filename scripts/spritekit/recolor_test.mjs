// Gate test: does the detailed new art recolor correctly through the game's
// EXACT ribRecolor keys (navy->primary, gold->secondary)? Downscale sample
// frames to the 48px ship size, recolor with several team palettes, montage.
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
const SRC = 'art/source'
const OUT = '/tmp/claude-0/-home-user-Footballers/a0f4f9fa-21d7-5b3a-bcfc-e0e403d2b6b1/scratchpad'
// pull one run frame, one carry frame, one getup-stand frame
const jobs = [
  { file: 'cuts and jukes pixel art.png', sx: 55, sy: 52, sw: 91, sh: 120 },   // row1 col1 run
  { file: 'catches pixel art.png', sx: 1087, sy: 26, sw: 64, sh: 113 },        // carry run (right block)
  { file: 'get up pixel art.png', sx: 685, sy: 56, sw: 72, sh: 111 },          // stand (right cols)
]
const PALS = [['#2f9e4f', '#e8c86a'], ['#c8414b', '#c3c9d2'], ['#1f4fd0', '#ffffff'], ['#101820', '#a5acb5']]
const files = {}
for (const j of jobs) if (!files[j.file]) files[j.file] = fs.readFileSync(path.join(SRC, j.file)).toString('base64')
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
const url = await page.evaluate(async ({ jobs, files, PALS }) => {
  const imgs = {}
  for (const f in files) { const im = new Image(); await new Promise(r => { im.onload = r; im.src = 'data:image/png;base64,' + files[f] }); imgs[f] = im }
  // EXACT copy of ribRecolor keying (from index.html)
  function recolor(src48, p1hex, p2hex) {
    const cv = document.createElement('canvas'); cv.width = 48; cv.height = 48
    const c = cv.getContext('2d'); c.drawImage(src48, 0, 0)
    const im = c.getImageData(0, 0, 48, 48), d = im.data
    const hx = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
    const P = hx(p1hex), S = hx(p2hex)
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 20) continue
      const r = d[i], g = d[i + 1], b = d[i + 2]
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2
      if (L < 38) continue
      const sat = mx ? (mx - mn) / mx : 0
      let hue = 0
      if (mx !== mn) { if (mx === r) hue = (60 * ((g - b) / (mx - mn)) + 360) % 360; else if (mx === g) hue = 60 * ((b - r) / (mx - mn)) + 120; else hue = 60 * ((r - g) / (mx - mn)) + 240 }
      let base = null, ref = 0
      if (hue >= 190 && hue <= 265 && sat > 0.15) { base = P; ref = 95 }
      else if (hue >= 33 && hue <= 62 && sat > 0.3 && L > 60) { base = S; ref = 165 }
      if (base) { const sc = Math.min(1.75, Math.max(0.25, L / ref)); d[i] = Math.min(255, base[0] * sc); d[i + 1] = Math.min(255, base[1] * sc); d[i + 2] = Math.min(255, base[2] * sc) }
    }
    c.putImageData(im, 0, 0); return cv
  }
  // downscale a source region to a 48x48 (contain, centered)
  function to48(im, sx, sy, sw, sh) {
    const cv = document.createElement('canvas'); cv.width = 48; cv.height = 48
    const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = true
    const scale = Math.min(48 / sw, 48 / sh) * 0.96
    const dw = sw * scale, dh = sh * scale
    cx.drawImage(im, sx, sy, sw, sh, (48 - dw) / 2, (48 - dh) / 2, dw, dh)
    return cv
  }
  const cell = 48, pad = 6, cols = 1 + PALS.length
  const mont = document.createElement('canvas'); mont.width = cols * (cell + pad) + pad; mont.height = jobs.length * (cell + pad) + pad
  const mx = mont.getContext('2d'); mx.imageSmoothingEnabled = false
  mx.fillStyle = '#0d1420'; mx.fillRect(0, 0, mont.width, mont.height)
  jobs.forEach((j, ri) => {
    const base = to48(imgs[j.file], j.sx, j.sy, j.sw, j.sh)
    const gy = pad + ri * (cell + pad)
    mx.drawImage(base, pad, gy)
    PALS.forEach((p, ci) => { const rc = recolor(base, p[0], p[1]); mx.drawImage(rc, pad + (ci + 1) * (cell + pad), gy) })
  })
  return mont.toDataURL('image/png')
}, { jobs, files, PALS })
fs.writeFileSync(path.join(OUT, 'recolor_test.png'), Buffer.from(url.split(',')[1], 'base64'))
console.log('wrote recolor_test.png  (col1=original@48, then palettes: green/red/blue/black)')
await browser.close()
