// Pack selected sheet frames into a new 48x48 team atlas that the existing
// ribRecolor/ribRegisterTeam pipeline can consume. Frames are trimmed to sprite
// content, bottom-aligned (feet on a common baseline) and horizontally centered,
// downscaled to fit BODY px inside the 48 cell. Emits rib_atlas_v22.png at the
// project root (Vite serves it in dev) + a cellmap JSON printed to stdout and
// written to art/atlas_v22.cellmap.json.
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
const SRC = 'art/source'
const ROOT = 'public'
// ---- MAP: atlasCellName -> {sheet,row,col}. Directions the engine uses:
// dn(front/toward viewer), up(back/away), sd(side), dr(down-diag), ur(up-diag).
// The renderer mirrors L/R via flip, so base art faces one way (left here).
// v22 is ADDITIVE now: base run/idle stay the original chunky sprites. The
// overlay only enhances MOTION MOMENTS — the tackle-to-ground/dive sequence and
// the cutting/plant frame — by overriding the named action cells the engine
// already builds those textures from (dive0-3, down0-1, grab, cut_<dir>).
const DIVE = 'diving tackle pixel art.png'   // 8 dirs x 9 frames: col0 upright, 1-8 dive->grounded
const CUTS = 'cuts and jukes pixel art.png'
const MAP = {}
// dive arc + grounded fold, from a clean side row (row 2)
MAP['dive0'] = { sheet: DIVE, row: 2, col: 1 }   // launch
MAP['dive1'] = { sheet: DIVE, row: 2, col: 2 }   // extend
MAP['dive2'] = { sheet: DIVE, row: 2, col: 3 }   // full extension (also the standalone `dive` pose)
MAP['dive3'] = { sheet: DIVE, row: 2, col: 4 }   // landing
MAP['down0'] = { sheet: DIVE, row: 2, col: 6 }   // grounded
MAP['down1'] = { sheet: DIVE, row: 2, col: 8 }   // flat (also the `down` pose)
MAP['grab']  = { sheet: DIVE, row: 2, col: 2 }   // wrap/extended
// cutting/plant frame per direction (enhances the `cut` state only — base run untouched)
const cutRow = { dn: 6, dr: 2, sd: 4, ur: 1, up: 0 }, CUTF = 5
for (const [d, r] of Object.entries(cutRow)) MAP[`cut_${d}`] = { sheet: CUTS, row: r, col: CUTF }
// atlas grid
const names = Object.keys(MAP)
const COLS = 12
const rowsN = Math.ceil(names.length / COLS)
const cellmap = {}
names.forEach((n, i) => { cellmap[n] = [i % COLS, Math.floor(i / COLS)] })

const sheetsNeeded = [...new Set(names.map(n => MAP[n].sheet))]
const files = {}; for (const s of sheetsNeeded) files[s] = fs.readFileSync(path.join(SRC, s)).toString('base64')

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
const url = await page.evaluate(async ({ files, MAP, cellmap, COLS, rowsN }) => {
  const imgs = {}, DATA = {}
  for (const s in files) { const im = new Image(); await new Promise(r => { im.onload = r; im.src = 'data:image/png;base64,' + files[s] }); const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false; cx.drawImage(im, 0, 0); DATA[s] = { W: im.width, H: im.height, d: cx.getImageData(0, 0, im.width, im.height).data, cv } }
  const isSprite = (S, x, y) => { const { W, d } = DATA[S]; const i = (y * W + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3]; if (a < 70) return false; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0; if (r > 228 && g > 228 && b > 228) return false; if (sat < 0.16) return false; return true }
  function bands(proj, N, minRun, gapFrac) { const peak = Math.max(...proj), thr = Math.max(1, peak * 0.03); const on = []; for (let i = 0; i < N; i++) on.push(proj[i] > thr); const gm = Math.round(N * (gapFrac || 0.012)); for (let i = 0; i < N; i++) if (!on[i]) { let j = i; while (j < N && !on[j]) j++; if (j - i <= gm && i > 0 && j < N) for (let k = i; k < j; k++) on[k] = true; i = j } const out = []; let s = -1; for (let i = 0; i < N; i++) { if (on[i] && s < 0) s = i; else if (!on[i] && s >= 0) { if (i - s >= minRun) out.push([s, i]); s = -1 } } if (s >= 0 && N - s >= minRun) out.push([s, N]); return out }
  // cache per-sheet row/col band structure
  const struct = {}
  function sheetStruct(S) {
    if (struct[S]) return struct[S]
    const { W, H } = DATA[S]
    const rp = new Float32Array(H); for (let y = 0; y < H; y++) { let c = 0; for (let x = 0; x < W; x++) if (isSprite(S, x, y)) c++; rp[y] = c }
    const rows = bands(rp, H, Math.round(H * 0.02), 0.02)
    const rowCols = rows.map(([ry0, ry1]) => { const cp = new Float32Array(W); for (let x = 0; x < W; x++) { let c = 0; for (let y = ry0; y < ry1; y++) if (isSprite(S, x, y)) c++; cp[x] = c } return { ry0, ry1, cols: bands(cp, W, Math.round(W * 0.012), 0.006) } })
    return struct[S] = { rows, rowCols }
  }
  // Cut a padded cell region out of the sheet with the WHITE MATTE + grey drop
  // shadow removed by flood-fill from the border (interior white gloves/shoes,
  // enclosed by dark outlines, are preserved), then return a canvas tightly
  // cropped to the remaining opaque pixels.
  function cutout(S, cx0, cx1, ry0, ry1) {
    const D = DATA[S]
    const padX = 8, padD = 10
    const x0 = Math.max(0, cx0 - padX), x1 = Math.min(D.W, cx1 + padX)
    const y0 = Math.max(0, ry0 - 4), y1 = Math.min(D.H, ry1 + padD)   // extra below for shoes/shadow
    const w = x1 - x0, h = y1 - y0
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h
    const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false
    cx.drawImage(D.cv, x0, y0, w, h, 0, 0, w, h)
    const im = cx.getImageData(0, 0, w, h), d = im.data
    const isBg = i => { const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3]; if (a < 40) return true; const mn = Math.min(r, g, b), mx = Math.max(r, g, b), sat = mx ? (mx - mn) / mx : 0, L = (mx + mn) / 2; if (mn > 216) return true; if (sat < 0.14 && L > 110) return true; return false }
    const seen = new Uint8Array(w * h), stack = []
    for (let x = 0; x < w; x++) { stack.push(x); stack.push(x + (h - 1) * w) }
    for (let y = 0; y < h; y++) { stack.push(y * w); stack.push(w - 1 + y * w) }
    while (stack.length) { const px = stack.pop(); if (seen[px]) continue; seen[px] = 1; const i = px * 4; if (!isBg(i)) continue; d[i + 3] = 0; const xx = px % w, yy = (px / w) | 0; if (xx > 0) stack.push(px - 1); if (xx < w - 1) stack.push(px + 1); if (yy > 0) stack.push(px - w); if (yy < h - 1) stack.push(px + w) }
    cx.putImageData(im, 0, 0)
    // tight bbox on remaining opaque pixels
    let bx0 = w, bx1 = 0, by0 = h, by1 = 0
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 30) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y }
    if (bx1 < bx0) return null
    const tw = bx1 - bx0 + 1, th = by1 - by0 + 1
    const out = document.createElement('canvas'); out.width = tw; out.height = th
    out.getContext('2d').drawImage(cv, bx0, by0, tw, th, 0, 0, tw, th)
    return out
  }
  const atlas = document.createElement('canvas'); atlas.width = COLS * 48; atlas.height = rowsN * 48
  const ax = atlas.getContext('2d'); ax.imageSmoothingEnabled = true
  const BODY = 45   // px of the 48 cell the sprite height fills
  for (const name in MAP) {
    const m = MAP[name], st = sheetStruct(m.sheet)
    const rc = st.rowCols[m.row]; if (!rc) continue
    const cb = rc.cols[m.col]; if (!cb) continue
    const co = cutout(m.sheet, cb[0], cb[1], rc.ry0, rc.ry1); if (!co) continue
    const sc = Math.min(48 / co.width, BODY / co.height)
    const dw = co.width * sc, dh = co.height * sc
    const [gc, gr] = cellmap[name]
    const dx = gc * 48 + (48 - dw) / 2         // horizontally centered
    const dy = gr * 48 + (47 - dh)             // bottom-aligned (feet near y=47)
    ax.drawImage(co, 0, 0, co.width, co.height, dx, dy, dw, dh)
  }
  return atlas.toDataURL('image/png')
}, { files, MAP, cellmap, COLS, rowsN })
fs.writeFileSync(path.join(ROOT, 'rib_atlas_v22.png'), Buffer.from(url.split(',')[1], 'base64'))
fs.writeFileSync('art/atlas_v22.cellmap.json', JSON.stringify(cellmap))
console.log('wrote rib_atlas_v22.png cells=' + names.length)
await browser.close()
