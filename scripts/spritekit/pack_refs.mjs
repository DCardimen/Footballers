// Repack the raw referee sprite sheet (art/referee-sprite-sheet.png)
// into a compact, feet-anchored spr_ref atlas the live-field renderer can slice.
//
// The raw sheet is 1254x1254, white (253,253,253) background, 8 rows of poses:
//   row0 front(dn) run  row1 side walk  row2 side(sd) run  row3 back(up) run
//   row4 front idle     row5 arms-up TD signal            row6 flag-throw
//   row7 face variants (unused)
// Each pose is normalized to a 64x64 cell at a uniform scale with the FEET pinned
// to (32,56) so every official stands on the same baseline regardless of source
// height (arms-up and flag poses simply reach higher inside the cell).
//
// Output: public/rib_ref.png  +  /tmp .../refmeta.json  {dataUrl, meta, cell, cols}
// Run:  node scripts/spritekit/pack_refs.mjs
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const SRC = 'art/referee-sprite-sheet.png'
const CELL = 64, COLS = 8, SCALE = 0.42, FEET_X = 32, FEET_Y = 56

// bounding boxes [x,y,w,h] harvested from the sheet (scripts/_analyze_ref2.mjs)
const row0 = [[87,29,67,103],[245,25,60,106],[397,25,66,105],[554,26,63,104],[706,24,63,106],[859,24,62,105],[1008,22,63,106],[1161,25,62,103]]
const row2 = [[84,294,63,98],[238,293,63,97],[393,292,67,98],[549,292,61,100],[704,292,59,98],[855,292,63,98],[1005,291,63,99],[1156,291,63,99]]
const row3 = [[90,423,62,107],[246,420,59,107],[401,420,60,106],[556,422,60,105],[708,420,61,105],[861,420,60,105],[1012,420,60,105],[1162,420,61,107]]
const row4 = [[92,557,59,106]]
const row5 = [[86,736,65,103],[238,712,76,125],[394,706,72,131],[549,705,72,132],[701,705,71,132],[853,705,71,132],[1005,705,72,132],[1156,705,72,132]]
const row6 = [[78,889,67,107],[237,889,58,107],[392,889,90,107],[549,889,105,107],[705,887,83,109],[806,904,34,24],[857,887,60,109],[982,887,87,109],[1133,886,87,110]]

// texture-name -> source box, in atlas order
const POSES = []
POSES.push(['dn_idle', row4[0]])
row0.forEach((b, i) => POSES.push(['dn_run' + i, b]))
POSES.push(['up_idle', row3[0]])
row3.forEach((b, i) => POSES.push(['up_run' + i, b]))
POSES.push(['sd_idle', row2[0]])
row2.forEach((b, i) => POSES.push(['sd_run' + i, b]))
;[row6[1], row6[2], row6[3], row6[4], row6[6], row6[7]].forEach((b, i) => POSES.push(['throw' + i, b]))
;[row5[2], row5[3], row5[4]].forEach((b, i) => POSES.push(['signal' + i, b]))

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage()
const dataUrl = 'data:image/png;base64,' + fs.readFileSync(SRC).toString('base64')
const res = await page.evaluate(async ({ src, POSES, CELL, COLS, SCALE, FEET_X, FEET_Y }) => {
  const img = new Image(); img.src = src; await img.decode()
  const W = img.width, H = img.height
  const s = document.createElement('canvas'); s.width = W; s.height = H
  const sc = s.getContext('2d'); sc.imageSmoothingEnabled = false; sc.drawImage(img, 0, 0)
  // key the near-white background to transparent
  const id = sc.getImageData(0, 0, W, H), sd = id.data
  for (let i = 0; i < sd.length; i += 4) {
    if (sd[i] > 236 && sd[i + 1] > 236 && sd[i + 2] > 236) sd[i + 3] = 0
  }
  sc.putImageData(id, 0, 0)
  // read back for feet detection
  const op = sc.getImageData(0, 0, W, H).data
  const rows = Math.ceil(POSES.length / COLS)
  const AW = COLS * CELL, AH = rows * CELL
  const a = document.createElement('canvas'); a.width = AW; a.height = AH
  const ac = a.getContext('2d'); ac.imageSmoothingEnabled = false
  const meta = {}
  POSES.forEach(([name, box], idx) => {
    const [bx, by, bw, bh] = box
    // feet = centroid of opaque pixels in the bottom 16px of the box
    let sx = 0, n = 0, maxY = by
    for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) { if (op[(y * W + x) * 4 + 3] > 40 && y > maxY) maxY = y }
    for (let y = maxY - 15; y <= maxY; y++) for (let x = bx; x < bx + bw; x++) { if (op[(y * W + x) * 4 + 3] > 40) { sx += x; n++ } }
    const feetX = n ? sx / n : bx + bw / 2, feetY = maxY
    const col = idx % COLS, rw = (idx / COLS) | 0
    const ox = col * CELL, oy = rw * CELL
    const dx = ox + FEET_X - (feetX - bx) * SCALE, dy = oy + FEET_Y - (feetY - by) * SCALE
    ac.drawImage(s, bx, by, bw, bh, dx, dy, bw * SCALE, bh * SCALE)
    meta[name] = [col, rw]
  })
  return { dataUrl: a.toDataURL('image/png'), meta, cols: COLS, cell: CELL, w: AW, h: AH }
}, { src: dataUrl, POSES, CELL, COLS, SCALE, FEET_X, FEET_Y })
await b.close()

const pngBuf = Buffer.from(res.dataUrl.split(',')[1], 'base64')
fs.mkdirSync('public', { recursive: true })
fs.writeFileSync('public/rib_ref.png', pngBuf)
const outDir = process.env.SPRITE_SURVEY_OUT || '/tmp'
fs.writeFileSync(path.join(outDir, 'refmeta.json'), JSON.stringify({ dataUrl: res.dataUrl, meta: res.meta, cols: res.cols, cell: res.cell }))
console.log('atlas', res.w + 'x' + res.h, '| poses', Object.keys(res.meta).length, '| png', (pngBuf.length / 1024).toFixed(1) + 'KB', '| dataURL', (res.dataUrl.length / 1024).toFixed(1) + 'KB')
console.log('meta', JSON.stringify(res.meta))
