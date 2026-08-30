// Pack the uploaded skill-training art into the atlas the training decision draws
// from. The source is three 1254x1254 sheets, each a 2x2 grid of isometric scenes
// on a flat navy ground — twelve scenes for the twelve training themes.
//
// Two things the packer has to do beyond slicing. The scenes do not fill their
// quadrants and are not centred in them, so each is TIGHT-CROPPED to its own ink
// rather than to its grid cell; a grid crop would leave every icon a different size
// on screen for no reason but where the artist put it. And the flat ground is keyed
// out, so an icon can sit on a card of any colour.
//
// Emits public/rib_skill_v64.png + art/skill_v64.cellmap.json.
import { chromium } from 'playwright'
import fs from 'fs'

const SRC = [
  'art/file_0000000082d881f5aa30ee27d96802ef.png',
  'art/file_00000000def081f58ad0a997692521b7.png',
  'art/file_00000000efcc81f59fc1c11ce26094ae.png',
]
const CELL = +(process.env.SKILL_CELL || 176)     // packed size per icon
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
page.on('console', m => console.log('  [page]', m.text()))
const srcs = SRC.map(p => fs.readFileSync(p).toString('base64'))

const res = await page.evaluate(async ({ srcs, CELL }) => {
  const out = { tiles: [], bg: [], bgRGB: [] }
  const masks = []          // page-local, index-aligned with out.tiles — never returned
  const sheets = []
  for (const s of srcs) {
    const im = new Image()
    await new Promise(r => { im.onload = r; im.src = 'data:image/png;base64,' + s })
    sheets.push(im)
  }
  // ---- 1. slice each sheet into its 2x2 quadrants, key the flat ground, tight-crop
  for (let si = 0; si < sheets.length; si++) {
    const im = sheets[si], W = im.width, H = im.height
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H
    const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false
    cx.drawImage(im, 0, 0)
    const full = cx.getImageData(0, 0, W, H), d = full.data
    // the ground colour: the corner pixel, which is always background
    const bg = [d[0], d[1], d[2]]
    out.bg.push(bg.join(',')); (out.bgRGB = out.bgRGB || []).push(bg)
    const near = (i) => Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) <= 26
    for (let q = 0; q < 4; q++) {
      const qx = (q % 2) * (W / 2), qy = ((q / 2) | 0) * (H / 2), qw = (W / 2) | 0, qh = (H / 2) | 0
      // v65: the bbox cannot just be "every non-ground pixel in this quadrant". Some
      // scenes overhang the 2x2 split, so a neighbour's grass lands inside this
      // quadrant, drags the bbox out to the seam, and comes through as a sliver of
      // someone else's art down the edge of the packed cell. So label the ink into
      // connected components and drop the ones that are BOTH touching a quadrant
      // border and small next to the main scene — which is exactly what overflow
      // is, and never what a legitimate detached prop (a ball, a cone, a hurdle)
      // looks like, since those sit inside the quadrant with the scene.
      const lab = new Int32Array(qw * qh).fill(-1)
      const comps = []
      const stack = new Int32Array(qw * qh)
      for (let sy = 0; sy < qh; sy++) for (let sxi = 0; sxi < qw; sxi++) {
        const s0 = sy * qw + sxi
        if (lab[s0] !== -1 || near(((qy + sy) * W + (qx + sxi)) * 4)) continue
        const id = comps.length
        const c = { n: 0, x0: 1e9, x1: -1, y0: 1e9, y1: -1, edge: false }
        let sp = 0; stack[sp++] = s0; lab[s0] = id
        while (sp) {
          const cur = stack[--sp], cyi = (cur / qw) | 0, cxi = cur - cyi * qw
          c.n++
          if (cxi < c.x0) c.x0 = cxi; if (cxi > c.x1) c.x1 = cxi
          if (cyi < c.y0) c.y0 = cyi; if (cyi > c.y1) c.y1 = cyi
          if (cxi === 0 || cyi === 0 || cxi === qw - 1 || cyi === qh - 1) c.edge = true
          for (let k = 0; k < 4; k++) {
            const nx = cxi + [1, -1, 0, 0][k], ny = cyi + [0, 0, 1, -1][k]
            if (nx < 0 || ny < 0 || nx >= qw || ny >= qh) continue
            const ni = ny * qw + nx
            if (lab[ni] !== -1 || near(((qy + ny) * W + (qx + nx)) * 4)) continue
            lab[ni] = id; stack[sp++] = ni
          }
        }
        comps.push(c)
      }
      const main = comps.reduce((a, b) => (b.n > (a ? a.n : 0) ? b : a), null)
      const keep = comps.filter(c => c === main || !c.edge || c.n >= main.n * .25)
      const dropped = comps.length - keep.length
      let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1
      for (const c of keep) {
        if (c.x0 < x0) x0 = c.x0; if (c.x1 > x1) x1 = c.x1
        if (c.y0 < y0) y0 = c.y0; if (c.y1 > y1) y1 = c.y1
      }
      // the pixels of the dropped components have to go too, or a bbox that no
      // longer reaches them still paints them where they overlap what is kept
      const kill = new Set(comps.map((c, i) => keep.includes(c) ? -1 : i).filter(i => i >= 0))
      masks.push(kill.size ? { lab, kill, qw, qx, qy } : null)
      out.tiles.push({ sheet: si, q, x: qx + x0, y: qy + y0, w: x1 - x0 + 1, h: y1 - y0 + 1,
        dropped, comps: comps.length })
    }
  }
  // ---- 2. pack. One uniform cell per icon so the caller can blit any theme at any
  // size without a per-icon table, and each scene is fitted INSIDE its cell by its
  // own longest side, so a wide scene and a tall one come out the same visual
  // weight instead of the wide one dominating every row it appears in.
  const COLS = 4, ROWS = Math.ceil(out.tiles.length / COLS)
  const atlas = document.createElement('canvas')
  atlas.width = COLS * CELL; atlas.height = ROWS * CELL
  const ax = atlas.getContext('2d')
  ax.imageSmoothingEnabled = true; ax.imageSmoothingQuality = 'high'
  const scratch = document.createElement('canvas')
  const sx2 = scratch.getContext('2d')
  out.tiles.forEach((t, i) => {
    const im = sheets[t.sheet]
    // key the ground on a scratch canvas first: scaling a keyed image is fine, but
    // scaling THEN keying resamples the ground into every edge as a navy halo
    scratch.width = t.w; scratch.height = t.h
    sx2.imageSmoothingEnabled = false
    sx2.clearRect(0, 0, t.w, t.h)
    sx2.drawImage(im, t.x, t.y, t.w, t.h, 0, 0, t.w, t.h)
    const im2 = sx2.getImageData(0, 0, t.w, t.h), q = im2.data
    const bg = out.bgRGB[t.sheet]
    for (let p2 = 0; p2 < q.length; p2 += 4) {
      const dist = Math.abs(q[p2] - bg[0]) + Math.abs(q[p2 + 1] - bg[1]) + Math.abs(q[p2 + 2] - bg[2])
      if (dist <= 26) { q[p2] = q[p2 + 1] = q[p2 + 2] = q[p2 + 3] = 0 }
    }
    // and erase the overflow components the crop still overlaps
    const mk = masks[i]
    if (mk) {
      for (let yy = 0; yy < t.h; yy++) for (let xx = 0; xx < t.w; xx++) {
        const li = (t.y + yy - mk.qy) * mk.qw + (t.x + xx - mk.qx)
        if (li < 0 || li >= mk.lab.length) continue
        if (!mk.kill.has(mk.lab[li])) continue
        const o = (yy * t.w + xx) * 4
        q[o] = q[o + 1] = q[o + 2] = q[o + 3] = 0
      }
    }
    sx2.putImageData(im2, 0, 0)
    // v65: the gutter is what stops a cell bleeding into its neighbours. A CSS
    // background addresses these cells by percentage at whatever the device pixel
    // ratio happens to be, and it samples a little past the boundary; at the old 4%
    // that reached the next scene's grass and put a green sliver down the edge of
    // every tile. 9% also doubles as the icon's hold-off from a rounded plate, so
    // the art no longer sits on the corner radius and the consumers need no padding
    // of their own.
    const pad = Math.round(CELL * 0.09), box = CELL - pad * 2
    const sc = box / Math.max(t.w, t.h), dw = Math.round(t.w * sc), dh = Math.round(t.h * sc)
    const cx0 = (i % COLS) * CELL + Math.round((CELL - dw) / 2)
    const cy0 = ((i / COLS) | 0) * CELL + Math.round((CELL - dh) / 2)
    ax.drawImage(scratch, 0, 0, t.w, t.h, cx0, cy0, dw, dh)
    t.cell = [(i % COLS) * CELL, ((i / COLS) | 0) * CELL, CELL, CELL]
  })
  // ---- 3. quantize. Smooth-downscaled pixel art explodes the colour count and this
  // bakes into index.html as base64; 6 bits of RGB is invisible at icon size.
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
}, { srcs, CELL })

console.log('background per sheet:', res.bg.join(' | '))
res.tiles.forEach((t, i) => console.log(`  tile ${i} sheet${t.sheet} q${t.q}  ${t.w}x${t.h} -> cell ${t.cell.join(',')}  ${t.comps} components, ${t.dropped} dropped as overflow`))

// theme order the cells are addressed by. The art depicts nine of the twelve
// training themes squarely; the three study/social themes have no scene of their
// own, so they take the nearest thing the set offers and are called out as such.
const ORDER = ['hands', 'feet', 'iron', 'film', 'flex', 'edge', 'track', 'social', 'craft', 'plyo', 'mentor', 'lab']
const cellmap = {}
ORDER.forEach((k, i) => { if (res.tiles[i]) cellmap[k] = res.tiles[i].cell })

fs.mkdirSync('public', { recursive: true })
fs.writeFileSync('public/rib_skill_v64.png', Buffer.from(res.atlas.split(',')[1], 'base64'))
fs.writeFileSync('art/skill_v64.cellmap.json', JSON.stringify(cellmap))
console.log(JSON.stringify({
  atlas: res.size.join('x'), cells: Object.keys(cellmap).length, inkPct: res.inkPct,
  bytes: fs.statSync('public/rib_skill_v64.png').size,
  base64KB: Math.round(fs.statSync('public/rib_skill_v64.png').size * 4 / 3 / 1024),
}, null, 1))
if (Object.keys(cellmap).length !== 12) { console.error('expected 12 cells'); process.exitCode = 1 }
await browser.close()
