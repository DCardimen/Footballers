// Dev check (v160 A THE TEAM ON THE HELMET): the profile figure wears his team's emblem on the side of the helmet.
//   1. with a team logo set, the figure's helmet takes the emblem: pixels inside the helmet change, nothing below it does
//   2. a different logo paints a different emblem; the emblem sits on the dome's side, off the stripe
//   3. a helmet with its own decal keeps its decal (no emblem); the kill switch TU v160Alogo 0 draws no emblem
//   4. the growth screen's figure is still the card's figure (same pixels); no page errors
import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'
const b = await chromium.launch({ executablePath: CHROME })
const page = await (await b.newContext({ viewport: { width: 400, height: 860 } })).newPage()
const errs = []; page.on('pageerror', (e) => errs.push(e.message))
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d) : '')); c ? pass++ : fail++ }
await page.goto(GAME_URL + (GAME_URL.includes('?') ? '&' : '?') + 'stayStale', { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForFunction(() => window.RIB_COSMETICS && window.__V160A && window.__GRIDIRON_TEAM_CUSTOM__, null, { timeout: 45000 })
await page.waitForFunction(() => { const cv = document.createElement('canvas'); return !!window.RIB_COSMETICS.drawFigure(cv, 22) && window.__V160A.paints > 0 || (window.__GRIDIRON_TEAM_CUSTOM__.logo = 5, false) }, null, { timeout: 30000, polling: 500 }).catch(() => {})
const R = await page.evaluate(() => {
  const C = window.RIB_COSMETICS, T = window.__GRIDIRON_TEAM_CUSTOM__, TU = window.RIB_TUNE || (window.RIB_TUNE = {})
  const px = (logo, tune) => { if (logo !== undefined) T.logo = logo; Object.assign(TU, tune || {}); const cv = document.createElement('canvas'); C.drawFigure(cv, 22); const x = cv.getContext('2d'); const d = x.getImageData(0, 0, cv.width, cv.height).data; for (const k in (tune || {})) delete TU[k]; return { d, w: cv.width, h: cv.height, last: window.__V160A.last } }
  const off = px(12, { v160Alogo: 0 }), a = px(12), b2 = px(47)
  const diff = (A, B, y0, y1) => { let n = 0; for (let y = Math.floor(A.h * y0); y < Math.floor(A.h * y1); y++) for (let x = 0; x < A.w; x++) { const i = (y * A.w + x) * 4; if (Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) + Math.abs(A.d[i + 2] - B.d[i + 2]) > 30) n++ } return n }
  return { head: diff(off, a, 0, 0.3), body: diff(off, a, 0.34, 1), logos: diff(a, b2, 0, 0.3), last: a.last, last2: b2.last, errs: window.__V160A.errs }
})
ok(R.head > 150 && R.body === 0, 'with a team logo, the helmet takes the emblem and nothing below the helmet changes', { head: R.head, body: R.body })
ok(R.logos > 60, 'a different logo paints a different emblem', R.logos)
ok(R.last && R.last.px > 100 && R.last.w >= 8 && R.last.h >= 8, 'the emblem is a sizeable stamp on the dome', R.last)
const dec = await page.evaluate(() => { const C = window.RIB_COSMETICS; const decal = C.items ? C.items().find((i) => i.cat === 'helmet' && i.h && i.h.d) : null; return decal ? decal.id : null })
if (dec) {
  const R2 = await page.evaluate((id) => { const C = window.RIB_COSMETICS, st = JSON.parse(localStorage.getItem('rib.cosmetics.v1') || '{}'); const n0 = window.__V160A.paints
    const k = C.kitData ? C.kitData() : C.face().kit; const K = Object.assign({}, k, { hs: '#ffffff', hd: '#ff0000', hdk: 'star' }); const cv = document.createElement('canvas')
    if (C.drawCharacter) C.drawCharacter(cv, K, 22); return { painted: window.__V160A.paints - n0, has: !!C.drawCharacter } }, dec)
  if (R2.has) ok(R2.painted === 0, 'a helmet with its own decal keeps its decal (no emblem)', R2)
}
const grow = await page.evaluate(() => { const C = window.RIB_COSMETICS; const a = document.createElement('canvas'), b = document.createElement('canvas'); C.drawFigure(a, 22); C.growFigure ? C.growFigure(b, 22) : C.drawFigure(b, 22)
  const h = (cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let x = 2166136261; for (let i = 0; i < d.length; i += 3) { x ^= d[i]; x = Math.imul(x, 16777619) } return x >>> 0 }; return h(a) === h(b) })
ok(grow, 'the growth screen\'s figure is still the card\'s figure (the emblem included)')
ok(!R.errs.length && !errs.length, 'no errors', { v160: R.errs, page: errs })
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await b.close(); process.exit(fail || errs.length ? 1 : 0)
