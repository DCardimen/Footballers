// Dev check: v162 B — THE HELMET IS THE HELMET (src/28-cosmetics.js `helmShellV162B`), at a 400x860 phone:
//   1. the shell mask: read off idle_dn_hi.png once, a sensible size, never below the neck, covers the dome AND the
//      left jaw flap (x 36-44, y 46-58 — outside the old ellipse), and none of the left / right shoulder pads
//   2. the recolour (red jersey, white helmet, black pants): the jaw flap's navy pixels come out HELMET white, not
//      jersey red; the shoulder pads stay red; every shell pixel that was navy is helmet-coloured (no red in the shell)
//   3. kill switch TU v162Bhelm 0: the jaw flap is jersey red again (the old ellipse) — the check is measuring the fix
//   4. the drawn profile figure (RIB_COSMETICS.drawCharacter) still draws; no page errors
//   node scripts/v162Bcheck.mjs        (GAME_URL=http://localhost:5173/)
import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 400, height: 860 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { setInterval(() => { document.querySelector('.onboard')?.remove() }, 60) })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForFunction(() => window.__V153E && window.__V153E.fig && window.__V153E.fig.img && window.__V153E.figCell, null, { timeout: 60000 })

const probe = (on) => page.evaluate((on) => {
  window.RIB_TUNE = window.RIB_TUNE || {}; window.RIB_TUNE.v162Bhelm = on
  const E = window.__V153E; E.fig.cache = {}; E.fig.shellV162B = null
  const K = { j: '#d02020', p: '#202020', hs: '#f4f4f4', hst: '#1060e0', hf: 'matte', pat: 'solid' }
  const c = E.figCell(K), im = E.fig.img, W = im.naturalWidth, H = im.naturalHeight
  const sc = document.createElement('canvas'); sc.width = W; sc.height = H; const sx = sc.getContext('2d'); sx.drawImage(im, 0, 0)
  const src = sx.getImageData(0, 0, W, H).data, out = c.getContext('2d').getImageData(0, 0, W, H).data
  const navy = (i) => { const r = src[i], g = src[i + 1], b = src[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx === mn || mx <= 14) return false
    const hue = mx === r ? (60 * ((g - b) / (mx - mn)) + 360) % 360 : mx === g ? 60 * ((b - r) / (mx - mn)) + 120 : 60 * ((r - g) / (mx - mn)) + 240
    return hue >= 190 && hue <= 265 && (mx - mn) / mx > 0.25 && src[i + 3] >= 20 }
  const red = (i) => out[i] > 120 && out[i] > out[i + 1] * 1.8 && out[i] > out[i + 2] * 1.8
  const white = (i) => Math.max(out[i], out[i + 1], out[i + 2]) > 55 && Math.max(out[i], out[i + 1], out[i + 2]) - Math.min(out[i], out[i + 1], out[i + 2]) < 40
  const box = (x0, x1, y0, y1) => { let n = 0, r = 0, w = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; if (!navy(i)) continue; n++; if (red(i)) r++; if (white(i)) w++ } return { n, red: r, white: w } }
  const V = window.__V162B, m = on && V ? V.mask() : null
  let shellNavy = 0, shellRed = 0, left = 0, right = 0
  if (m) for (let j = 0; j < W * H; j++) if (m[j]) { const i = j * 4; if (navy(i)) { shellNavy++; if (red(i)) shellRed++ } const x = j % W, y = (j / W) | 0; if (y > 50 && x < 26) left++; if (y > 50 && x > 100) right++ }
  return { W, H, V: V ? { px: V.px, lowest: V.lowest, neck: V.neck } : null, jaw: box(36, 44, 46, 58), lShoulder: box(12, 26, 54, 70), rShoulder: box(100, 110, 54, 70), shellNavy, shellRed, left, right }
}, on)

const A = await probe(1)
ok(!!A.V && A.V.px > 1200 && A.V.px < 3000, 'the shell mask is read off the art, a helmet-sized region', A.V)
ok(A.V && A.V.lowest < A.V.neck, 'the shell never runs below the neck', A.V)
ok(A.left === 0 && A.right === 0, 'the shell stays off both shoulder pads', { left: A.left, right: A.right })
ok(A.jaw.n > 40 && A.jaw.white / A.jaw.n > 0.7 && A.jaw.red === 0, 'the jaw flap beside the face mask wears the HELMET colour, not the jersey', A.jaw)
ok(A.lShoulder.n > 40 && A.lShoulder.red / A.lShoulder.n > 0.7, 'the left shoulder pad stays the jersey colour', A.lShoulder)
ok(A.rShoulder.n > 20 && A.rShoulder.red / A.rShoulder.n > 0.7, 'the right shoulder pad stays the jersey colour', A.rShoulder)
ok(A.shellNavy > 1000 && A.shellRed === 0, 'no pixel of the shell is painted the jersey colour', { navy: A.shellNavy, red: A.shellRed })

const B = await probe(0)
ok(B.jaw.red / Math.max(1, B.jaw.n) > 0.5, 'kill switch TU v162Bhelm 0: the jaw flap is jersey red again (the old ellipse)', B.jaw)
await page.evaluate(() => { window.RIB_TUNE.v162Bhelm = 1; window.__V153E.fig.cache = {}; window.__V153E.fig.shellV162B = null })

const drawn = await page.evaluate(() => { const cv = document.createElement('canvas'); const r = window.RIB_COSMETICS.drawCharacter(cv, { j: '#d02020', p: '#202020', hs: '#f4f4f4' }, 22); return { r: !!r, w: cv.width } })
ok(drawn.r && drawn.w > 0, 'the profile figure still draws', drawn)
ok(errs.length === 0, 'no page errors', errs.slice(0, 4).join(' | '))
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
