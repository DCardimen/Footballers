// Analyze the AI-generated sprite sheets: detect background type, drop shadows,
// and the real row/column grid via saturated-pixel projection (robust to soft
// shadows). Emits an overlay PNG per sheet (downscaled sheet + detected grid)
// so the segmentation can be eyeballed before any slicing is wired.
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
const SRC = 'art/source'
const OUT = '/tmp/claude-0/-home-user-Footballers/a0f4f9fa-21d7-5b3a-bcfc-e0e403d2b6b1/scratchpad'
const sheets = fs.readdirSync(SRC).filter(f => f.endsWith('.png'))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
for (const name of sheets) {
  const b64 = fs.readFileSync(path.join(SRC, name)).toString('base64')
  const res = await page.evaluate(async ({ b64, name }) => {
    const img = new Image()
    await new Promise(r => { img.onload = r; img.src = 'data:image/png;base64,' + b64 })
    const W = img.width, H = img.height
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H
    const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false; cx.drawImage(img, 0, 0)
    const d = cx.getImageData(0, 0, W, H).data
    // sample corner to detect bg (transparent vs white)
    const a00 = d[3]
    const bgTransparent = a00 < 20
    // content mask: SATURATED sprite pixel (ignores white bg AND grey drop shadows)
    const colProj = new Float32Array(W), rowProj = new Float32Array(H)
    let content = 0
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, r = d[i], g = d[i + 1], bl = d[i + 2], a = d[i + 3]
        if (a < 60) continue
        const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl)
        const sat = mx ? (mx - mn) / mx : 0
        // saturated color OR a dark saturated outline; excludes white(>230 all) and grey shadow
        const white = r > 228 && g > 228 && bl > 228
        const grey = sat < 0.16
        if (white || grey) continue
        colProj[x]++; rowProj[y]++; content++
      }
    }
    // find bands in a projection: runs where proj > threshold, with gap merging
    function bands(proj, N, minRun) {
      const peak = Math.max(...proj)
      const thr = Math.max(1, peak * 0.02)
      const on = []; for (let i = 0; i < N; i++) on.push(proj[i] > thr)
      // close small gaps
      const gapMerge = Math.round(N * 0.012)
      for (let i = 0; i < N; i++) if (!on[i]) { let j = i; while (j < N && !on[j]) j++; if (j - i <= gapMerge && i > 0 && j < N) for (let k = i; k < j; k++) on[k] = true; i = j }
      const out = []; let s = -1
      for (let i = 0; i < N; i++) { if (on[i] && s < 0) s = i; else if (!on[i] && s >= 0) { if (i - s >= minRun) out.push([s, i]); s = -1 } }
      if (s >= 0 && N - s >= minRun) out.push([s, N])
      return out
    }
    const rows = bands(rowProj, H, Math.round(H * 0.02))
    const cols = bands(colProj, W, Math.round(W * 0.015))
    // build a downscaled overlay (max 760 wide) with row/col band lines
    const scale = Math.min(1, 760 / W)
    const ov = document.createElement('canvas'); ov.width = Math.round(W * scale); ov.height = Math.round(H * scale)
    const ox = ov.getContext('2d'); ox.imageSmoothingEnabled = false
    if (!bgTransparent) { ox.fillStyle = '#101820'; ox.fillRect(0, 0, ov.width, ov.height) }
    ox.drawImage(cv, 0, 0, ov.width, ov.height)
    ox.lineWidth = 1
    ox.strokeStyle = 'rgba(255,80,80,.9)'
    rows.forEach(([a, b]) => { ox.strokeRect(0, a * scale, ov.width, (b - a) * scale) })
    ox.strokeStyle = 'rgba(80,180,255,.8)'
    cols.forEach(([a, b]) => { ox.strokeRect(a * scale, 0, (b - a) * scale, ov.height) })
    const url = ov.toDataURL('image/png')
    return { W, H, bgTransparent, content, rows, cols, overlay: url }
  }, { b64, name })
  const png = Buffer.from(res.overlay.split(',')[1], 'base64')
  const outName = name.replace(/\.png$/, '').replace(/[^a-z0-9]+/gi, '_') + '_grid.png'
  fs.writeFileSync(path.join(OUT, outName), png)
  console.log(`\n### ${name}  ${res.W}x${res.H}  bg=${res.bgTransparent ? 'transparent' : 'opaque'}  content=${res.content}`)
  console.log(`   rows(${res.rows.length}): ${res.rows.map(r => r[0] + '-' + r[1]).join(', ')}`)
  console.log(`   cols(${res.cols.length}): ${res.cols.map(c => c[0] + '-' + c[1]).join(', ')}`)
  console.log(`   -> ${outName}`)
}
await browser.close()
