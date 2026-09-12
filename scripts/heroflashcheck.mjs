// Dev check: v107.1 — the hero's camera flashes are only ever over the CROWD.
//
// The FX layer (public/rib-menu.js, `startHeroFx`) draws on a canvas stretched over the whole
// hero. Everything on it used to be placed in fractions of THAT BOX, but the photograph under it
// is `object-fit: cover`, so the box crops it differently at every aspect ratio and the same
// fractions land somewhere else in the picture each time — at a phone width they landed on the
// TUNNEL WALLS either side of the mouth. v107.1 places every mark in PICTURE percent, inside a
// traced crowd region, and maps it through the cover box.
//
// At 390x844, 430x932 and 900x1100 this runs the layer for ~6 s and asserts, for every spawn the
// page logged:
//   * it is inside the crowd region in PICTURE space (the polygons the page itself publishes);
//   * it is inside the current cover box, and on the canvas, in BOX space, and the two agree;
//   * the PICTURE PIXEL under it is crowd and not wall — the tunnel walls are dark neutral greys
//     (luma under ~45), the stands are bright warm amber, so the bar is luma > 70 with r-b > 20;
//   * both v106 kit masks are transparent there, so nothing pops on the man himself.
// It also checks the lamps and the sun now hang off the picture: each lamp's inline --x/--y is the
// mapped picture point, and the point under it is a burning-bright pixel on the far rim ABOVE the
// tiers rather than a spot on a wall.
//
//   npm run dev            # leave running
//   node scripts/heroflashcheck.mjs
import { chromium } from 'playwright'

const URL = 'http://127.0.0.1:5173/index.html?stayStale'
const SIZES = [{ width: 390, height: 844 }, { width: 430, height: 932 }, { width: 900, height: 1100 }]
const RUN_MS = 6000
const LUMA_MIN = 70, WARM_MIN = 20, MASK_MAX = 8   // crowd, not wall; and not on the man
const LAMP_LUMA_MIN = 150, LAMP_Y = [14, 28.5]     // the lit rim above the tiers

const errs = [], bad = []
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }

// point in polygon, in picture percent — the same test the page runs, re-done here on the page's
// own published region so the check never trusts the page's answer
const inPoly = (poly, x, y) => {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const out = {}

for (const size of SIZES) {
  const tag = `${size.width}x${size.height}`
  const page = await browser.newPage({ viewport: size })
  page.on('pageerror', e => errs.push(`${tag} PAGEERROR: ` + e.message))
  page.on('console', m => { if (m.type() === 'error') errs.push(`${tag} CONSOLE: ` + m.text().slice(0, 200)) })
  page.on('response', r => { if (r.status() >= 400) bad.push(`${tag} ` + r.status() + ' ' + r.url()) })
  page.on('requestfailed', r => bad.push(`${tag} FAILED ` + r.url()) )
  await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1000)
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(2500)   // warm: vite's one-time reload after an edit

  // the picture and the two kit masks, read back pixel by pixel from the page's own copies
  await page.evaluate(async () => {
    const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(src)); i.src = src })
    const sheet = async (src) => { const im = await load(src); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); return x }
    const pic = await sheet('./public/menu/hero_tunnel.webp')
    const mp = await sheet('./public/menu/hero_mask_p.webp'), ms = await sheet('./public/menu/hero_mask_s.webp')
    // a 3x3 average, so one stray pixel neither passes nor fails a point on its own
    const at = (ctx, px, py) => { const w = ctx.canvas.width, h = ctx.canvas.height
      const x = Math.min(w - 2, Math.max(1, Math.round(w * px / 100))), y = Math.min(h - 2, Math.max(1, Math.round(h * py / 100)))
      const d = ctx.getImageData(x - 1, y - 1, 3, 3).data; let r = 0, g = 0, b = 0, a = 0
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; a = Math.max(a, d[i + 3]) }
      return { r: r / 9, g: g / 9, b: b / 9, a } }
    window.__HFC = (px, py) => { const c = at(pic, px, py)
      return { luma: 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b, warm: c.r - c.b, mp: at(mp, px, py).a, ms: at(ms, px, py).a } }
  })

  await page.waitForTimeout(RUN_MS)

  const r = await page.evaluate(() => {
    const F = window.__RIB_MENU_FX_V102
    if (!F) return { fx: false }
    const lampEls = [...document.querySelectorAll('.rib9-lamp')]
    const sunEl = document.querySelector('.rib9-sun')
    const px = (v) => parseFloat(String(v).replace('px', ''))
    return {
      fx: true, on: F.on, frames: F.frames, skipped: F.skipped, box: F.box, canvas: F.canvas,
      crowd: F.crowd, crowdBox: F.crowdBox, lamps: F.lamps, sun: F.sun,
      log: F.flashLog.map(f => ({ ...f, pixel: window.__HFC(f.px, f.py) })),
      lampAt: lampEls.map((el, i) => ({ x: px(el.style.getPropertyValue('--x')), y: px(el.style.getPropertyValue('--y')), pixel: window.__HFC(F.lamps[i][0], F.lamps[i][1]) })),
      // the sun's own core sits behind the man on purpose — it is the glare he is walking into —
      // so the light it stands in is read either side of him, off the helmet
      sunAt: sunEl ? { x: px(sunEl.style.left), y: px(sunEl.style.top), pixel: window.__HFC(F.sun[0], F.sun[1]),
        side: [window.__HFC(F.sun[0] - 10, F.sun[1]), window.__HFC(F.sun[0] + 10, F.sun[1])] } : null,
      heroBox: (() => { const h = document.querySelector('.rib9-hero'); const b = h && h.getBoundingClientRect(); return b ? { w: b.width, h: b.height } : null })(),
    }
  })

  console.log(`\n===== ${tag} =====`)
  if (!r.fx) { ok(false, 'the hero FX layer is running', 'no window.__RIB_MENU_FX_V102'); await page.close(); continue }
  ok(r.on && r.frames > 60, 'the hero canvas loop is running', `${r.frames} frames`)
  ok(!!r.box && r.box.w > 0 && r.box.h > 0, 'the FX layer knows where the photograph sits in its box', JSON.stringify(r.box && { x: +r.box.x.toFixed(1), y: +r.box.y.toFixed(1), w: +r.box.w.toFixed(1), h: +r.box.h.toFixed(1) }))
  ok(r.log.length >= 6, 'flashes are popping and logged in picture coordinates', `${r.log.length} spawns in ${RUN_MS} ms, ${r.skipped} skipped`)

  // 1. every spawn is inside the crowd region, in PICTURE space
  const offPoly = r.log.filter(f => !r.crowd.some(p => inPoly(p, f.px, f.py)))
  ok(offPoly.length === 0, 'every spawn is inside the crowd region in picture space', offPoly.length ? JSON.stringify(offPoly.slice(0, 4)) : `${r.log.length}/${r.log.length}`)

  // 2. every spawn is inside the cover box and on the canvas, and box pixels match picture percent
  const b = r.box
  const offBox = r.log.filter(f => f.x < b.x - 0.6 || f.x > b.x + b.w + 0.6 || f.y < b.y - 0.6 || f.y > b.y + b.h + 0.6)
  const offCv = r.log.filter(f => f.x < 0 || f.x > r.canvas.w || f.y < 0 || f.y > r.canvas.h)
  const drift = r.log.map(f => Math.max(Math.abs(b.x + f.px / 100 * b.w - f.x), Math.abs(b.y + f.py / 100 * b.h - f.y)))
  ok(offBox.length === 0, 'every spawn is inside the picture\'s cover box in box pixels', offBox.length ? JSON.stringify(offBox.slice(0, 3)) : `${r.log.length}/${r.log.length}`)
  ok(offCv.length === 0, 'every spawn is on the canvas', offCv.length ? JSON.stringify(offCv.slice(0, 3)) : `${r.log.length}/${r.log.length}`)
  ok(Math.max(0, ...drift) < 0.6, 'the logged box pixels are the picture point mapped through that box', `max drift ${Math.max(0, ...drift).toFixed(2)} px`)

  // 3. the real test: the PICTURE PIXEL under each spawn is crowd, not tunnel wall, and not the man
  const dark = r.log.filter(f => f.pixel.luma <= LUMA_MIN)
  const cold = r.log.filter(f => f.pixel.warm <= WARM_MIN)
  const onKit = r.log.filter(f => f.pixel.mp > MASK_MAX || f.pixel.ms > MASK_MAX)
  const minL = Math.min(...r.log.map(f => f.pixel.luma)), minW = Math.min(...r.log.map(f => f.pixel.warm))
  const maxM = Math.max(...r.log.map(f => Math.max(f.pixel.mp, f.pixel.ms)))
  ok(dark.length === 0, `no spawn sits on dark tunnel wall (luma > ${LUMA_MIN})`, `dimmest ${minL.toFixed(0)}` + (dark.length ? ' ' + JSON.stringify(dark.slice(0, 3).map(f => [f.px, f.py, Math.round(f.pixel.luma)])) : ''))
  ok(cold.length === 0, `every spawn is on warm lit stand (r-b > ${WARM_MIN})`, `coldest ${minW.toFixed(0)}` + (cold.length ? ' ' + JSON.stringify(cold.slice(0, 3).map(f => [f.px, f.py, Math.round(f.pixel.warm)])) : ''))
  ok(onKit.length === 0, 'no spawn lands on the player — both v106 kit masks are clear there', `max mask alpha ${maxM}`)

  // 4. the lamps and the sun ride the picture too
  const cbX0 = r.crowdBox.x0, cbX1 = r.crowdBox.x1
  const lampBad = r.lampAt.filter((l, i) => {
    const want = { x: b.x + r.lamps[i][0] / 100 * b.w, y: b.y + r.lamps[i][1] / 100 * b.h }
    return !(Math.abs(l.x - want.x) < 0.6 && Math.abs(l.y - want.y) < 0.6)
  })
  const lampDim = r.lampAt.filter(l => l.pixel.luma < LAMP_LUMA_MIN)
  const lampRow = r.lamps.filter(([, y]) => y < LAMP_Y[0] || y > LAMP_Y[1])
  ok(r.lampAt.length === 5 && lampBad.length === 0, 'all five lamps hang off the picture, not off the box', `${r.lampAt.length} lamps, ${lampBad.length} adrift`)
  ok(lampDim.length === 0, `every lamp sits on the burning far rim of the stands (luma >= ${LAMP_LUMA_MIN})`, JSON.stringify(r.lampAt.map(l => Math.round(l.pixel.luma))))
  ok(lampRow.length === 0, 'the lamp row is above the tiers and below the tunnel roof', JSON.stringify(r.lamps))
  const sunWant = r.sunAt && { x: b.x + r.sun[0] / 100 * b.w, y: b.y + r.sun[1] / 100 * b.h }
  const sunInMouth = r.sun[0] > cbX0 && r.sun[0] < cbX1 && r.sun[1] >= LAMP_Y[0] && r.sun[1] <= 32
  ok(!!r.sunAt && Math.abs(r.sunAt.x - sunWant.x) < 0.6 && Math.abs(r.sunAt.y - sunWant.y) < 0.6 && sunInMouth
    && Math.min(...r.sunAt.side.map(p => p.luma)) >= LAMP_LUMA_MIN,
    'the sun hangs on the picture, in the glare at the mouth', r.sunAt ? `at ${r.sunAt.x.toFixed(0)},${r.sunAt.y.toFixed(0)} — glare either side ${r.sunAt.side.map(p => p.luma.toFixed(0)).join('/')}` : 'no sun')

  // 5. the shimmer's clip is the crowd's own bounding box, inside the picture
  const cb = r.crowdBox
  ok(cb && cb.x0 >= 0 && cb.x1 <= 100 && cb.y0 >= 0 && cb.y1 <= 100 && cb.x1 > cb.x0 && cb.y1 > cb.y0,
    'the shimmer is clipped to the crowd\'s bounding box in picture percent', JSON.stringify(cb))

  out[tag] = {
    hero: r.heroBox, box: r.box && { x: +r.box.x.toFixed(1), y: +r.box.y.toFixed(1), w: +r.box.w.toFixed(1), h: +r.box.h.toFixed(1) },
    spawns: r.log.length, skipped: r.skipped, offPoly: offPoly.length, offBox: offBox.length, onKit: onKit.length,
    minLuma: +minL.toFixed(1), minWarm: +minW.toFixed(1), maxMaskAlpha: maxM,
    pxRange: [Math.min(...r.log.map(f => f.px)), Math.max(...r.log.map(f => f.px))].map(v => +v.toFixed(1)),
    pyRange: [Math.min(...r.log.map(f => f.py)), Math.max(...r.log.map(f => f.py))].map(v => +v.toFixed(1)),
    lampLuma: r.lampAt.map(l => Math.round(l.pixel.luma)), sunLuma: r.sunAt && Math.round(r.sunAt.pixel.luma),
  }
  await page.close()
}

await browser.close()
console.log('\n' + JSON.stringify(out, null, 2))
console.log('\npage errors: ' + (errs.length ? '\n  ' + errs.join('\n  ') : 'none'))
console.log('bad requests: ' + (bad.length ? '\n  ' + bad.join('\n  ') : 'none'))
if (errs.length) fail += errs.length
if (bad.length) fail += bad.length
console.log(`\n${pass} ok, ${fail} failed`)
process.exit(fail ? 1 : 0)
