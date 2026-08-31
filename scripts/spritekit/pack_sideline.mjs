// Pack the uploaded sideline sheets into the one atlas the v78 team-area renderer
// draws from. Emits public/rib_side_v78.png + art/side_v78.cellmap.json; run
// scripts/spritekit/bake_sideline.mjs afterwards to inline it into index.html.
//
// The sheets are free ARRANGEMENTS on a black matte, not grids: a full-width
// bench sits above a row of six trunks, so the row/column band detection the
// other packers use merges half a sheet into one cell. Items are found by
// CONNECTED COMPONENT instead — dilate the ink a few pixels so a trunk's latch
// and its shadow join the trunk, label, then read the boxes back in reading
// order (row bands by centre, left to right inside each). SHEETS below records
// how many components each sheet must yield; the run fails if a sheet drifts,
// because every selection is by INDEX and a drifted index silently packs the
// wrong object.
//
// Keying is by REACHABILITY, not by threshold. The matte is black and so are a
// black equipment trunk's own shadows, so a threshold test punches holes through
// the middle of the dark items; a flood fill inward from the border only ever
// removes matte that is actually outside something.
import { chromium } from 'playwright'
import fs from 'fs'

const OUT = 'public/rib_side_v78.png'
const MAP = 'art/side_v78.cellmap.json'
// Every sheet is drawn at roughly the same scale — a standing figure is ~270px,
// a 6ft bench ~370px — so ONE factor keeps the whole sideline in proportion with
// itself. 0.34 puts a coach at ~92px, about twice the player sprite, which is
// the headroom the renderer's k>1 near-camera rows want.
const SCALE = +(process.env.SIDE_SCALE || 0.34)
const PAD = 3                       // transparent gutter around every packed cell
const ATLAS_W = 1024

const SHEETS = {
  staff: { file: 'art/source/sideline staff pixel art.png', cells: 23 },
  eq: { file: 'art/source/sideline equipment pixel art.png', cells: 51 },
  gear: { file: 'art/source/sideline gear pixel art.png', cells: 51 },
  med: { file: 'art/source/sideline medical pixel art.png', cells: 41 },
  off: { file: 'art/source/sideline officials pixel art.png', cells: 44 },
}

// name -> [sheet, component index]. Grouped the way the renderer zones them.
const PICK = {
  // --- staff. Ten coaches and ten trainers; cells 0, 11 and 12 are the sheet's
  // own row captions and are deliberately skipped.
  coach0: ['staff', 1], coach1: ['staff', 2], coach2: ['staff', 3], coach3: ['staff', 4], coach4: ['staff', 5],
  coach5: ['staff', 6], coach6: ['staff', 7], coach7: ['staff', 8], coach8: ['staff', 9], coach9: ['staff', 10],
  trainer0: ['staff', 13], trainer1: ['staff', 14], trainer2: ['staff', 15], trainer3: ['staff', 16], trainer4: ['staff', 17],
  trainer5: ['staff', 18], trainer6: ['staff', 19], trainer7: ['staff', 20], trainer8: ['staff', 21], trainer9: ['staff', 22],
  // --- seating
  bench_long: ['gear', 0], bench_long_b: ['gear', 1], bench_short: ['gear', 2],
  bench_back: ['eq', 0], bench_back_b: ['eq', 1], bench_wood: ['eq', 2],
  chairs: ['eq', 3], chairs_b: ['eq', 4], stool: ['gear', 4],
  // --- hydration
  cooler_table: ['eq', 5], cooler_table_b: ['eq', 6], cup_stand: ['eq', 7],
  bottles: ['eq', 8], bottles_b: ['eq', 9], cooler: ['gear', 18], cooler_b: ['gear', 21],
  // --- medical
  med_cart: ['gear', 24], med_kit: ['eq', 50], med_bag: ['med', 18], stretcher: ['med', 20], towels: ['eq', 10],
  // --- playing gear
  helmet_rack: ['eq', 14], pad_rack: ['eq', 15], ball_bin: ['eq', 16], ball_rack: ['gear', 23],
  ponchos: ['eq', 11], tape_bin: ['eq', 49],
  // --- storage
  trunk: ['gear', 6], trunk_b: ['gear', 7], trunk_c: ['gear', 8],
  case_up: ['gear', 12], case_up_b: ['gear', 14], duffel: ['gear', 15], duffel_b: ['gear', 16],
  // --- coaching tech
  play_board: ['gear', 27], whiteboard: ['eq', 40], comms: ['gear', 26],
  table: ['eq', 34], table_b: ['gear', 42], camera: ['eq', 42],
  // --- the chain crew and everything that marks the field
  pylon: ['eq', 21], gmarker: ['eq', 22], cone: ['eq', 31], cone_b: ['eq', 32], discs: ['eq', 33], flag: ['eq', 23],
  down1: ['off', 17], down2: ['off', 18], down3: ['off', 19], down4: ['off', 20],
  chain_rod: ['gear', 33], yard10: ['off', 31], yard20: ['off', 32], yard30: ['off', 33], barrier: ['off', 42],
  // --- everything else that lives on a sideline
  fan: ['gear', 30], heater: ['gear', 29], kick_net: ['gear', 28], trash: ['gear', 31], recycle: ['gear', 32],
  cart: ['eq', 36], golf_cart: ['gear', 43], mat: ['gear', 40],
}

const src = {}
for (const k in SHEETS) src[k] = fs.readFileSync(SHEETS[k].file).toString('base64')

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
page.on('console', m => console.log('  [page]', m.text()))

const res = await page.evaluate(async ({ src, SHEETS, PICK, SCALE, PAD, ATLAS_W, DEBUG }) => {
  const THR = 40, DIL = 5, MIN_AREA = 1400

  function loadSheet(b64) {
    return new Promise(r => { const im = new Image(); im.onload = () => r(im); im.src = 'data:image/png;base64,' + b64 })
  }
  // components + the alpha-keyed pixels, computed once per sheet
  function analyse(im) {
    const W = im.width, H = im.height
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.imageSmoothingEnabled = false
    cx.drawImage(im, 0, 0)
    const img = cx.getImageData(0, 0, W, H), d = img.data
    const dark = new Uint8Array(W * H)
    for (let p = 0; p < W * H; p++) { const i = p * 4; dark[p] = (d[i] + d[i + 1] + d[i + 2]) <= THR ? 1 : 0 }

    // ---- 1. key by REACHABILITY. Flood the black matte inward from the border;
    // black INSIDE an object is never reached, so a black trunk keeps its middle.
    const outside = new Uint8Array(W * H)
    const st = []
    const push = (x, y) => { const p = y * W + x; if (!outside[p] && dark[p]) { outside[p] = 1; st.push(p) } }
    for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1) }
    for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y) }
    while (st.length) {
      const p = st.pop(), x = p % W, y = (p / W) | 0
      if (x > 0) push(x - 1, y); if (x < W - 1) push(x + 1, y)
      if (y > 0) push(x, y - 1); if (y < H - 1) push(x, y + 1)
    }
    // clearing alpha alone leaves the matte's RGB behind, which the downscale
    // resamples back in as a black rim — kill the colour with it
    for (let p = 0; p < W * H; p++) if (outside[p]) { const i = p * 4; d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0 }
    cx.putImageData(img, 0, 0)

    // ---- 2. components, on the DILATED ink so an object's own parts join up
    const ink = new Uint8Array(W * H)
    for (let p = 0; p < W * H; p++) ink[p] = d[p * 4 + 3] ? 1 : 0
    const dil = new Uint8Array(W * H), R = DIL >> 1
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!ink[y * W + x]) continue
      for (let dy = -R; dy <= R; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue
        for (let dx = -R; dx <= R; dx++) { const xx = x + dx; if (xx < 0 || xx >= W) continue; dil[yy * W + xx] = 1 } }
    }
    const lab = new Int32Array(W * H).fill(-1)
    const boxes = []
    for (let p0 = 0; p0 < W * H; p0++) {
      if (!dil[p0] || lab[p0] >= 0) continue
      const id = boxes.length; lab[p0] = id
      const q = [p0]; let x0 = p0 % W, x1 = x0, y0 = (p0 / W) | 0, y1 = y0, area = 0
      while (q.length) {
        const p = q.pop(), x = p % W, y = (p / W) | 0
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
        if (ink[p]) area++
        const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]
        for (const n of nb) if (n >= 0 && dil[n] && lab[n] < 0) { lab[n] = id; q.push(n) }
      }
      if (area < MIN_AREA) { boxes.push(null); continue }
      // trim the dilation back off, to the real ink
      let tx0 = x1, tx1 = x0, ty0 = y1, ty1 = y0
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (!ink[y * W + x]) continue
        if (x < tx0) tx0 = x; if (x > tx1) tx1 = x; if (y < ty0) ty0 = y; if (y > ty1) ty1 = y
      }
      boxes.push([tx0, ty0, tx1 - tx0 + 1, ty1 - ty0 + 1])
    }
    const keep = boxes.filter(Boolean)
    // reading order: row bands by vertical centre, then left to right
    keep.sort((a, b) => (a[1] + a[3] / 2) - (b[1] + b[3] / 2))
    const rows = []; let cur = []
    for (const b of keep) {
      const cy = b[1] + b[3] / 2
      if (cur.length && cy - (cur[0][1] + cur[0][3] / 2) > Math.max(60, cur[0][3] * 0.7)) { rows.push(cur); cur = [] }
      cur.push(b)
    }
    if (cur.length) rows.push(cur)
    const cells = []
    for (const r of rows) { r.sort((a, b) => a[0] - b[0]); cells.push(...r) }
    return { cv, cells }
  }

  const sheets = {}, counts = {}, montage = {}
  for (const k in SHEETS) { sheets[k] = analyse(await loadSheet(src[k])); counts[k] = sheets[k].cells.length }

  // SIDE_DEBUG emits one labelled contact sheet per source, which is how the
  // indices in PICK were read off in the first place. Re-run it whenever a count
  // drifts rather than guessing which object moved.
  if (DEBUG) for (const k in sheets) {
    const S = sheets[k], CW = 118, CH = 118, COLS = 10, rows = Math.ceil(S.cells.length / COLS)
    const cv = document.createElement('canvas'); cv.width = COLS * CW; cv.height = rows * (CH + 16)
    const cx = cv.getContext('2d'); cx.fillStyle = '#111'; cx.fillRect(0, 0, cv.width, cv.height)
    cx.font = '13px monospace'
    S.cells.forEach((c, i) => {
      const sc = Math.min((CW - 10) / c[2], (CH - 10) / c[3]), w = c[2] * sc, h = c[3] * sc
      const px = (i % COLS) * CW, py = ((i / COLS) | 0) * (CH + 16)
      cx.drawImage(S.cv, c[0], c[1], c[2], c[3], px + (CW - w) / 2, py + 16 + (CH - 10 - h) / 2, w, h)
      cx.fillStyle = '#fd0'; cx.fillText(String(i), px + 4, py + 13)
      cx.strokeStyle = '#333'; cx.strokeRect(px, py, CW - 1, CH + 15)
    })
    montage[k] = cv.toDataURL('image/png')
  }

  // ---- 3. cut every pick at SCALE, then shelf-pack by height
  const cut = []
  for (const name in PICK) {
    const [sh, idx] = PICK[name], S = sheets[sh]
    const c = S.cells[idx]
    if (!c) { cut.push({ name, missing: true }); continue }
    const w = Math.max(1, Math.round(c[2] * SCALE)), h = Math.max(1, Math.round(c[3] * SCALE))
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h
    const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high'
    cx.drawImage(S.cv, c[0], c[1], c[2], c[3], 0, 0, w, h)
    cut.push({ name, cv, w, h })
  }
  const missing = cut.filter(c => c.missing).map(c => c.name)
  const items = cut.filter(c => !c.missing).sort((a, b) => b.h - a.h)
  let x = PAD, y = PAD, shelf = 0
  const map = {}
  for (const it of items) {
    if (x + it.w + PAD > ATLAS_W) { x = PAD; y += shelf + PAD; shelf = 0 }
    map[it.name] = [x, y, it.w, it.h]
    it.px = x; it.py = y
    x += it.w + PAD
    if (it.h > shelf) shelf = it.h
  }
  const AH = y + shelf + PAD
  const out = document.createElement('canvas'); out.width = ATLAS_W; out.height = AH
  const ox = out.getContext('2d'); ox.imageSmoothingEnabled = false
  for (const it of items) ox.drawImage(it.cv, it.px, it.py)
  return { png: out.toDataURL('image/png'), map, counts, missing, montage, w: ATLAS_W, h: AH }
}, { src, SHEETS, PICK, SCALE, PAD, ATLAS_W, DEBUG: !!process.env.SIDE_DEBUG })

await browser.close()

if (process.env.SIDE_DEBUG) {
  const dir = process.env.SIDE_DEBUG_DIR || 'scripts'
  for (const k in res.montage) {
    const f = `${dir}/_side_${k}.png`
    fs.writeFileSync(f, Buffer.from(res.montage[k].split(',')[1], 'base64'))
    console.log('montage ->', f)
  }
}

let bad = false
for (const k in SHEETS) {
  const got = res.counts[k], want = SHEETS[k].cells
  console.log(`${got === want ? 'ok  ' : 'FAIL'} ${k}: ${got} components (expected ${want})`)
  if (got !== want) bad = true
}
if (res.missing.length) { console.log('FAIL missing picks:', res.missing.join(', ')); bad = true }
if (bad) { console.error('\nsegmentation drifted — every pick is by index, so refusing to pack the wrong objects'); process.exit(1) }

fs.writeFileSync(OUT, Buffer.from(res.png.split(',')[1], 'base64'))
fs.writeFileSync(MAP, JSON.stringify(res.map))
console.log(`\npacked ${Object.keys(res.map).length} cells into ${res.w}x${res.h} -> ${OUT} (${(fs.statSync(OUT).size / 1024) | 0}KB)`)
console.log('cellmap ->', MAP)
