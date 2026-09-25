import { chromium } from 'playwright'
import fs from 'node:fs'
import { pageSource } from './lib/layout.mjs'   // v149 A: the served page + the src/ files it names
import { CHROME, gameUrl } from './lib/env.mjs'
/* ===== v147 B THE MENU WEARS THE COIN — the gate =====
 * 1. the header's prestige mark is the Vault's gold coin (an <img>, loaded, a real size), no ★ is
 *    left for prestige in the chip, and the YOUR LEGACY prestige tile wears the same coin; the
 *    RECRUIT stars on the player card are still stars.
 * 2. the OVR ring's spark sits at the END of the coloured arc, on its band, for a spread of OVRs
 *    (under the soft max, just short of it, and past it on the gold lap): measured in PIXELS — the
 *    ring is shot with and without the spark, the spark's centre is the bright core of the
 *    difference, the arc's end is walked round the band's mid radius — and both are compared with
 *    the one number ringArcV147B returns (within 2px and 1.5 degrees).
 * 3. the trophy on the milestones card is the UFF's own (v153 D: the owner's goal trophy, trophy_goal_*.webp — it was card_trophy_uff.webp) and nothing the menu serves
 *    still names card_trophy.webp.
 * 4. no page errors.
 *   node scripts/v147Bcheck.mjs                  (dev server on :5173; GAME_URL= to point elsewhere)
 *   SHOTS=/tmp/claude-0/shots node scripts/v147Bcheck.mjs   also writes the chip, the rings and the card */
const BASE = gameUrl('index.html')
const URL = BASE + (BASE.includes('?') ? '&' : '?') + 'menuPreview'
const SHOTS = process.env.SHOTS || ''
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true })
const browser = await chromium.launch({ executablePath: CHROME })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await context.newPage()
const errors = []; page.on('pageerror', e => errors.push(e.message))
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForSelector('#rib-main-menu-v2 .rib9-ring', { state: 'attached', timeout: 30000 })
await page.waitForFunction(() => document.documentElement.classList.contains('rib-assets-ready'), null, { timeout: 30000 }).catch(() => {})
await page.waitForTimeout(1800)
// the splash (the film) stands over the menu until the app is ready — wait it out, since the ring is
// measured in pixels; anything still on top after that is named and set aside
const onTop = () => page.evaluate(() => { const ring = document.querySelector('#rib-main-menu-v2 .rib9-ring'); ring.scrollIntoView({ block: 'center' }); const r = ring.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!(el && el.closest('#rib-main-menu-v2')) })
for (let i = 0; i < 40 && !(await onTop()); i++) await page.waitForTimeout(500)
const covered = await page.evaluate(() => { const ring = document.querySelector('#rib-main-menu-v2 .rib9-ring'); const r = ring.getBoundingClientRect(); const out = []
  for (let i = 0; i < 6; i++) { const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); if (!el || el.closest('#rib-main-menu-v2')) break; let top = el; while (top.parentElement && top.parentElement !== document.body) top = top.parentElement; out.push(top.id || top.className || top.tagName); top.style.display = 'none' }
  return out })
const fails = []
const ok = (cond, what) => { if (!cond) fails.push(what) }

// ---- 1. the coin ----------------------------------------------------------------------------
const coin = await page.evaluate(async () => {
  const chip = document.querySelector('#rib-main-menu-v2 .rib9-prestige')
  const img = chip && chip.querySelector('img.rib9-coin-v147')
  if (img && !img.complete) await new Promise(r => { img.onload = img.onerror = r })
  const r = img ? img.getBoundingClientRect() : null
  // v153: the YOUR LEGACY tile for Honors wears the crest (⚜), and the coin stays on PP in the chip
  const tile = [...document.querySelectorAll('#rib-main-menu-v2 .rib9-lt')].find(t => /HONORS/.test(t.textContent))
  const timg = null
  return { chip: !!chip, src: img && img.getAttribute('src'), natural: img ? img.naturalWidth : 0, w: r ? r.width : 0, h: r ? r.height : 0,
    svgInChip: chip ? chip.querySelectorAll('svg').length : -1, starInChip: chip ? /[★★]/.test(chip.textContent) : true,
    tileCrest: !!(tile && /⚜/.test(tile.textContent) && !tile.querySelector('img')), chipCrest: !!(chip && /⚜/.test(chip.textContent)),
    recruitStars: document.querySelectorAll('#rib-main-menu-v2 .rib9-player .rib9-stars b, #rib-main-menu-v2 .rib9-player .rib9-stars u').length }
})
ok(coin.chip, 'header prestige chip missing')
ok(/vault\/coin_gold_face\.webp/.test(coin.src || ''), 'header prestige icon is not the vault gold coin: ' + coin.src)
ok(coin.natural > 0 && coin.w >= 14 && coin.h >= 14, `coin not loaded / too small (${coin.natural} natural, ${coin.w}x${coin.h})`)
ok(coin.svgInChip === 0 && !coin.starInChip, 'a star is still in the prestige chip')
ok(coin.tileCrest && coin.chipCrest, 'v153: the Honors tile and the chip wear the crest (the coin is PP): tile=' + coin.tileCrest + ' chip=' + coin.chipCrest)
ok(coin.recruitStars === 5, 'recruit stars on the card changed: ' + coin.recruitStars)
if (SHOTS) { const chip = page.locator('#rib-main-menu-v2 .rib9-prestige'); await chip.screenshot({ path: `${SHOTS}/v147b_chip.png` }) }

// ---- 2. the ring ----------------------------------------------------------------------------
// the digits are hidden while the ring is measured: they paint over the band and over a spark near 12 o'clock,
// which would bias both the arc walk and the spark's centroid (the shots under SHOTS are taken first, with the digits)
await page.addStyleTag({ content: `.rib9-ring,.rib9-ring:before,.rib9-ring-spark-v132{transition:none!important}.rib9-ring-spark-v132:before{animation:none!important;transform:none!important;opacity:1!important}.rib9-ring-val{animation:none!important}html.v147b-measure .rib9-ring-val,html.v147b-measure .rib9-ring-lab{visibility:hidden!important}#rib-main-menu-v2 .rib9-player{transform:none!important}` })
await page.evaluate(() => document.querySelector('#rib-main-menu-v2 .rib9-ring').scrollIntoView({ block: 'center' }))
const CASES = [[40, 250], [75, 250], [99, 250], [148, 250], [148, 600], [230, 250], [148, 120], [300, 250], [99, 100]]
const rings = []
for (const [ovr, sm] of CASES) {
  const G = await page.evaluate(([ovr, sm]) => {
    const ring = document.querySelector('#rib-main-menu-v2 .rib9-ring')
    const G = window.__V147B.ringArc(ring, ovr, sm, true)
    ring.style.setProperty('--rib-ovr-color', G.color); ring.classList.toggle('over', G.over)
    ring.querySelector('.rib9-ring-val').textContent = String(ovr)
    const spark = ring.querySelector('.rib9-ring-spark-v132'); spark.style.visibility = ''
    return G
  }, [ovr, sm])
  await page.waitForTimeout(120)
  const loc = page.locator('#rib-main-menu-v2 .rib9-ring')
  if (SHOTS) await loc.screenshot({ path: `${SHOTS}/v147b_ring_${ovr}_of_${sm}.png` })
  await page.evaluate(() => document.documentElement.classList.add('v147b-measure'))
  await page.waitForTimeout(60)
  const withDot = await loc.screenshot()
  await page.evaluate(() => { document.querySelector('#rib-main-menu-v2 .rib9-ring-spark-v132').style.visibility = 'hidden' })
  await page.waitForTimeout(60)
  const noDot = await loc.screenshot()
  await page.evaluate(() => { document.querySelector('#rib-main-menu-v2 .rib9-ring-spark-v132').style.visibility = ''; document.documentElement.classList.remove('v147b-measure') })
  const M = await page.evaluate(async ({ a, b, G }) => {
    const load = async (b64) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, c.width, c.height) }
    const A = await load(a), B = await load(b)
    const W = A.width, H = A.height, dpr = window.devicePixelRatio || 1
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2
    // the spark: the bright core that is there only when it is
    let sx = 0, sy = 0, sw = 0
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2])
      const bright = Math.min(A.data[i], A.data[i + 1], A.data[i + 2])
      if (d > 60 && bright > 225) { sx += x; sy += y; sw++ }
    }
    const dot = sw ? { x: sx / sw, y: sy / sw } : null
    const angOf = (x, y) => { let a = Math.atan2(x - cx, -(y - cy)) * 180 / Math.PI; return a < 0 ? a + 360 : a }
    // the arc's end: walk the band's mid radius clockwise from 12 o'clock on the picture WITHOUT the spark
    const mid = (G.band.inner + G.band.outer) / 2 * R
    const hex = (h) => [1, 3, 5].map(j => parseInt(h.slice(j, j + 2), 16))
    const want = G.over ? hex('#ffd66b') : hex(G.color)
    // sampled at three radii across the band, because the OVR's digits can cross its inner edge
    const at = (deg, rr) => { const t = deg * Math.PI / 180; const x = Math.round(cx + Math.sin(t) * rr), y = Math.round(cy - Math.cos(t) * rr); const i = (y * W + x) * 4
      return Math.hypot(B.data[i] - want[0], B.data[i + 1] - want[1], B.data[i + 2] - want[2]) < 70 }
    const isArc = (deg) => [mid, (mid + G.band.outer * R) / 2 - 1, (mid + G.band.inner * R) / 2 + 1].some(rr => at(deg, rr))
    // the end is the LAST coloured angle clockwise from 12 (a digit over the band leaves a gap, not an end)
    let end = null
    for (let d = 0.5; d < 359.5; d += 0.25) if (isArc(d)) end = d + 0.125
    const t = (end ?? 360) * Math.PI / 180
    const endPt = { x: cx + Math.sin(t) * mid, y: cy - Math.cos(t) * mid }
    return { W, H, dpr, R: R / dpr, dot: dot && { x: dot.x / dpr, y: dot.y / dpr, ang: angOf(dot.x, dot.y), r: Math.hypot(dot.x - cx, dot.y - cy) / dpr }, px: sw,
      arcEnd: end, midR: mid / dpr, gap: dot ? Math.hypot(dot.x - endPt.x, dot.y - endPt.y) / dpr : null, startsAt12: isArc(1) }
  }, { a: withDot.toString('base64'), b: noDot.toString('base64'), G })
  const angErr = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d) }
  const row = { ovr, softMax: sm, over: G.over, headDeg: +G.headDeg.toFixed(2), arcEndPx: M.arcEnd, dotDeg: M.dot && +M.dot.ang.toFixed(2), dotR: M.dot && +M.dot.r.toFixed(2), bandMidR: +M.midR.toFixed(2),
    dotVsArcDeg: M.dot && M.arcEnd != null ? +angErr(M.dot.ang, M.arcEnd).toFixed(2) : null, dotVsHeadDeg: M.dot ? +angErr(M.dot.ang, G.headDeg).toFixed(2) : null, dotToArcEndPx: M.gap && +M.gap.toFixed(2) }
  rings.push(row)
  const full = G.headDeg >= 359.5
  ok(M.dot, `${ovr}/${sm}: no spark found`)
  ok(M.startsAt12, `${ovr}/${sm}: the arc does not start at 12 o'clock`)
  if (M.dot) {
    ok(row.dotVsHeadDeg <= 1.5, `${ovr}/${sm}: spark at ${row.dotDeg}deg, arc head ${row.headDeg}deg`)
    ok(Math.abs(M.dot.r - M.midR) <= 2, `${ovr}/${sm}: spark at radius ${row.dotR}px, band mid ${row.bandMidR}px (off the bar)`)
    if (!full) {
      ok(M.arcEnd != null && Math.abs(M.arcEnd - G.headDeg) <= 1.5, `${ovr}/${sm}: drawn arc ends at ${M.arcEnd}deg, head says ${row.headDeg}deg`)
      ok(row.dotVsArcDeg <= 1.5 && row.dotToArcEndPx <= 2, `${ovr}/${sm}: spark ${row.dotVsArcDeg}deg / ${row.dotToArcEndPx}px from the drawn arc's end`)
    }
  }
}

// ---- 3. the trophy --------------------------------------------------------------------------
const idxSrc = await page.evaluate(pageSource)
const trophy = await page.evaluate(async (idx) => {
  const imgs = [...document.querySelectorAll('#rib-main-menu-v2 .rib9-milestones img.rib9-goal-img')]
  for (const i of imgs) if (!i.complete) await new Promise(r => { i.onload = i.onerror = r })
  const srcs = [...document.querySelectorAll('#rib-main-menu-v2 img')].map(i => i.getAttribute('src') || '')
  const served = await Promise.all(['./public/rib-menu.js', './public/rib-menu-v89-runtime.js', './public/rib-menu-v89.css'].map(u => fetch(u, { cache: 'no-store' }).then(r => r.text()).catch(() => '')))
  const oldRe = /card_trophy(?!_uff)(\.webp|['"])/
  return { n: imgs.length, uff: imgs.every(i => /trophy_goal_(uff|interstellar)\.webp/.test(i.getAttribute('src'))), loaded: imgs.every(i => i.naturalWidth > 0), nat: imgs.map(i => i.naturalWidth + 'x' + i.naturalHeight),
    oldInDom: srcs.some(s => oldRe.test(s)), oldServed: served.some(t => oldRe.test(t)) || oldRe.test(idx), warmed: (window.__RIB_MENU_ASSETS || {}).loaded?.includes('trophy_goal_uff') }
}, idxSrc)
ok(trophy.n >= 1 && trophy.uff && trophy.loaded, 'milestones trophy is not the loaded UFF trophy: ' + JSON.stringify(trophy))
ok(!trophy.oldInDom && !trophy.oldServed, 'card_trophy.webp is still referenced')
if (SHOTS) {
  const card = page.locator('#rib-main-menu-v2 .rib9-milestones').first()
  await card.scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await card.screenshot({ path: `${SHOTS}/v147b_trophy_card.png` })
  const legacy = page.locator('#rib-main-menu-v2 .rib9-legacy').first(); await legacy.screenshot({ path: `${SHOTS}/v147b_legacy.png` })
}
ok(errors.length === 0, 'page errors: ' + errors.join(' | '))
console.log(JSON.stringify({ covered, coin, rings, trophy, fails, pass: fails.length === 0 }, null, 1))
console.log(errors.length ? 'page errors: ' + errors.join(' | ') : 'page errors: none')
await browser.close()
process.exit(fails.length ? 1 : 0)
