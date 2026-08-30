// Pack the uploaded game-plan art into the atlas the PREGAME wheel draws from.
// Unlike the skill sheets (three 2x2 grids), each source here is ONE 1254x1254
// scene on the same flat navy ground — ten scenes for the ten weekly game plans.
//
// So there is no quadrant split and no overflow to label out; the packer keys the
// ground, tight-crops each scene to its own ink, and fits every crop inside one
// uniform cell by its longest side so a wide scene and a tall one come out the
// same visual weight on the wheel face.
//
// Emits public/rib_plan_v66.png + art/plan_v66.cellmap.json.
import { chromium } from 'playwright'
import fs from 'fs'

// index -> the plan the scene depicts. The ids are the weekly deck's own ids
// (the ones chooseGamePlanV11 is called with), so nothing has to be renamed.
const SRC = [
  ['explosive',   'art/file_0000000057f481f597e8b859c9670c69.png'],  // full-extension diving catch
  ['recovery',    'art/file_0000000064b881f5afb80facbf9f910b.png'],  // trainer taping an ankle
  ['redzone',     'art/file_0000000069b881f5b3959606dc75e2f4.png'],  // catch over the pylon
  ['enforcer',    'art/file_000000009ea481f596bae157d43e21bd.png'],  // two-man hit on the carrier
  ['shadow',      'art/file_00000000a0c881f5bbc8fd0be6313c0e.png'],  // chalkboard with the opponent pinned to it
  ['team',        'art/file_00000000ab5881f5849caf92ac2e72b4.png'],  // sled push and the tyre
  ['filmgrind',   'art/file_00000000cc6881f598bc13fc632dad7e.png'],  // film desk, playbook on the monitor
  ['disciplined', 'art/file_00000000f72881f5852485c8454279e0.png'],  // set in a clean stance, ball secure
  ['feature',     'art/file_00000000fd8481f58b3c6761284a2f68.png'],  // under the lights, calling for it
  ['recover',     'art/file_00000000ff3481f58c36694c6d49d608.png'],  // ice pack, flat on the treatment bench
]
const CELL = +(process.env.PLAN_CELL || 176)      // packed size per icon
const COLS = 4, ROWS = Math.ceil(SRC.length / COLS)

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
page.on('console', m => console.log('  [page]', m.text()))
const srcs = SRC.map(([, p]) => fs.readFileSync(p).toString('base64'))

const res = await page.evaluate(async ({ srcs, CELL, COLS, ROWS }) => {
  const out = { tiles: [], bg: [] }
  const sheets = []
  for (const s of srcs) {
    const im = new Image()
    await new Promise(r => { im.onload = r; im.src = 'data:image/png;base64,' + s })
    sheets.push(im)
  }
  const atlas = document.createElement('canvas')
  atlas.width = COLS * CELL; atlas.height = ROWS * CELL
  const ax = atlas.getContext('2d')
  ax.imageSmoothingEnabled = true; ax.imageSmoothingQuality = 'high'
  const scratch = document.createElement('canvas')
  const sx = scratch.getContext('2d')

  for (let i = 0; i < sheets.length; i++) {
    const im = sheets[i], W = im.width, H = im.height
    scratch.width = W; scratch.height = H
    sx.imageSmoothingEnabled = false
    sx.clearRect(0, 0, W, H)
    sx.drawImage(im, 0, 0)
    const full = sx.getImageData(0, 0, W, H), d = full.data
    const bg = [d[0], d[1], d[2]]                 // the ground colour: a corner pixel
    out.bg.push(bg.join(','))
    // key the ground FIRST, then crop and scale. Scaling before keying resamples
    // the navy into every edge and lands a halo round the scene.
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1
    for (let p = 0; p < d.length; p += 4) {
      const dist = Math.abs(d[p] - bg[0]) + Math.abs(d[p + 1] - bg[1]) + Math.abs(d[p + 2] - bg[2])
      if (dist <= 26) { d[p] = d[p + 1] = d[p + 2] = d[p + 3] = 0; continue }
      const px = (p >> 2) % W, py = (p >> 2) / W | 0
      if (px < x0) x0 = px; if (px > x1) x1 = px
      if (py < y0) y0 = py; if (py > y1) y1 = py
    }
    sx.putImageData(full, 0, 0)
    const w = x1 - x0 + 1, h = y1 - y0 + 1
    // the same 9% gutter the skill atlas uses, and for the same two reasons: a CSS
    // background addresses these cells by percentage at the device's DPR and samples
    // a little past the boundary, and the gutter doubles as the scene's hold-off
    // from a rounded plate, so neither consumer pads.
    const pad = Math.round(CELL * 0.09), box = CELL - pad * 2
    const sc = box / Math.max(w, h), dw = Math.round(w * sc), dh = Math.round(h * sc)
    const cx0 = (i % COLS) * CELL, cy0 = ((i / COLS) | 0) * CELL
    ax.drawImage(scratch, x0, y0, w, h,
      cx0 + Math.round((CELL - dw) / 2), cy0 + Math.round((CELL - dh) / 2), dw, dh)
    out.tiles.push({ src: w + 'x' + h, cell: [cx0, cy0, CELL, CELL] })
  }
  // quantize: a smooth downscale of pixel art explodes the colour count and this
  // bakes into index.html as base64. 6 bits of RGB is invisible at icon size.
  const aim = ax.getImageData(0, 0, atlas.width, atlas.height), ad = aim.data
  let ink = 0
  for (let i = 0; i < ad.length; i += 4) {
    if (ad[i + 3] < 24) { ad[i] = ad[i + 1] = ad[i + 2] = ad[i + 3] = 0; continue }
    ink++
    ad[i] &= 0xfc; ad[i + 1] &= 0xfc; ad[i + 2] &= 0xfc
  }
  ax.putImageData(aim, 0, 0)
  out.atlas = atlas.toDataURL('image/png')
  out.size = [atlas.width, atlas.height]
  out.inkPct = +(ink / (atlas.width * atlas.height)).toFixed(3)
  return out
}, { srcs, CELL, COLS, ROWS })

console.log('background per sheet:', res.bg.join(' | '))
const cellmap = {}
SRC.forEach(([k], i) => {
  if (!res.tiles[i]) return
  cellmap[k] = res.tiles[i].cell
  console.log(`  ${k.padEnd(12)} ink ${res.tiles[i].src.padEnd(10)} -> cell ${res.tiles[i].cell.join(',')}`)
})

fs.mkdirSync('public', { recursive: true })
fs.writeFileSync('public/rib_plan_v66.png', Buffer.from(res.atlas.split(',')[1], 'base64'))
fs.writeFileSync('art/plan_v66.cellmap.json', JSON.stringify(cellmap))
console.log(JSON.stringify({
  atlas: res.size.join('x'), grid: COLS + 'x' + ROWS, cells: Object.keys(cellmap).length, inkPct: res.inkPct,
  bytes: fs.statSync('public/rib_plan_v66.png').size,
  base64KB: Math.round(fs.statSync('public/rib_plan_v66.png').size * 4 / 3 / 1024),
}, null, 1))
if (Object.keys(cellmap).length !== SRC.length) { console.error('expected ' + SRC.length + ' cells'); process.exitCode = 1 }
await browser.close()
