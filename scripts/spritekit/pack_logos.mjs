// Pack the three 5x6 team-emblem sheets (art/football-logo-sheet-*.png) into one
// 10x9 grid of 128px cells -> public/rib_logos_v44.png. Index order is row-major
// across each sheet in file order (animals 0-29, warriors 30-59, concepts 60-89),
// matching the LOGO_DB table baked into index.html (v44 TEAM EMBLEMS). Each source
// cell is contain-fit into its 128 box with a small margin so every emblem reads
// at scoreboard size.
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const SHEETS = [
  'art/football-logo-sheet-1-animals.png',
  'art/football-logo-sheet-2-warriors.png',
  'art/football-logo-sheet-3-bugs-concepts.png',
]
const COLS_SRC = 5, ROWS_SRC = 6      // every sheet is a 5-wide, 6-tall grid
const CELL = 128, COLS = 10, ROWS = 9 // packed layout: 90 cells, 1280x1152
const PAD = 4                          // breathing room inside each packed cell
const OUT = 'public/rib_logos_v44.png'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
const srcs = SHEETS.map(f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'))

const dataUrl = await page.evaluate(async ({ srcs, COLS_SRC, ROWS_SRC, CELL, COLS, ROWS, PAD }) => {
  const imgs = await Promise.all(srcs.map(src => new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src
  })))
  const cv = document.createElement('canvas')
  cv.width = COLS * CELL; cv.height = ROWS * CELL
  const ctx = cv.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  let idx = 0
  for (const img of imgs) {
    const cw = img.width / COLS_SRC, ch = img.height / ROWS_SRC
    for (let r = 0; r < ROWS_SRC; r++) for (let c = 0; c < COLS_SRC; c++) {
      const dx = (idx % COLS) * CELL, dy = Math.floor(idx / COLS) * CELL
      const box = CELL - PAD * 2, k = Math.min(box / cw, box / ch)
      const w = cw * k, h = ch * k
      ctx.drawImage(img, c * cw, r * ch, cw, ch, dx + (CELL - w) / 2, dy + (CELL - h) / 2, w, h)
      idx++
    }
  }
  return cv.toDataURL('image/png')
}, { srcs, COLS_SRC, ROWS_SRC, CELL, COLS, ROWS, PAD })

const buf = Buffer.from(dataUrl.split(',')[1], 'base64')
fs.writeFileSync(OUT, buf)
// Re-bake the sheet into index.html (window.__RIB_LOGOS_V44) so the single-file /
// GitHub Pages build ships the emblems too — public/ is only reachable in vite dev.
const INDEX = 'index.html'
const html = fs.readFileSync(INDEX, 'utf8')
const line = `window.__RIB_LOGOS_V44 = "${dataUrl}";`
const re = /window\.__RIB_LOGOS_V44 = "data:image\/png;base64,[^"]*";/
if (!re.test(html)) throw new Error('index.html is missing the baked __RIB_LOGOS_V44 line')
fs.writeFileSync(INDEX, html.replace(re, line))
console.log(JSON.stringify({ out: OUT, cells: COLS_SRC * ROWS_SRC * SHEETS.length, bytes: buf.length, baked: true }))
await browser.close()
