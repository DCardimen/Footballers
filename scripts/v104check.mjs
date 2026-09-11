// Dev check: v104 — THE NUMBER ON THE JERSEY. Asserts, in one pass:
//   * THE ART SAYS WHERE — every texture that can show a number carries a band read off the
//     drawn cell (neck .. waistband), and the states that never show one are allowed to miss.
//   * NEVER THE PANTS — for every such band, the numeral's ink box sits strictly inside the
//     jersey: clear of the waistband below and of the collar above. This is the v103-era bug
//     the pass exists to kill (the back number used to be hung 8 rows into the trousers).
//   * THE BACK NUMBER IS A BACK NUMBER — rear-facing poses wear it HIGHER than front-facing
//     ones do, on the shoulder blades rather than the belt.
//   * ONE SIZE — the numeral is a constant height in cell rows, so it does not pulse through a
//     run cycle, and on screen it tracks the body it is painted on instead of floating at a
//     fixed pixel size: the number/body height ratio holds across the whole field.
//   * RASTERIZED ONCE — the font size is never re-set per frame (the old path re-rendered ~100
//     text canvases every tick).
//   node scripts/v104check.mjs        (READ_POS=RB)
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const errs = [], bad = []
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(2500)   // warm: vite's one-time reload after an edit
await page.waitForFunction(() => typeof window.__simGameV2 === 'function', null, { timeout: 60000 })
await page.evaluate(p => { window.__readPos = p }, process.env.READ_POS || 'RB')
async function step(t) {
  const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
      : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className) || /RUN THIS PLAN|LOCK IT IN|CHOOSE/i.test(txt(e)))
      : els.find(e => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis })
  console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900)
}
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
let scene = false
for (let i = 0; i < 60; i++) { scene = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length)); if (scene) break; await page.waitForTimeout(400) }
ok(scene, 'the broadcast is live with markers on the field')

// ================= 1. the bands the ART gave, and the ink placed inside them =================
// The states that never show a number (a man on the ground, a dive, a detailed catch/juke pose)
// are exempt — placement is only ever asked of the poses the renderer actually numbers.
const NEVER = /_(down|divex|dive|tackle\d|pancake\d|getup\d?|catch\d|divecatch\d|juke\d|stiff\d|hurdle\d)$/
const B = await page.evaluate(() => {
  const RIBnum = window.__V104 && window.__V104.bands || {}
  const out = {}; for (const k in RIBnum) out[k] = RIBnum[k]; return out
})
const keys = Object.keys(B)
const numbered = keys.filter(k => !NEVER.test(k))
const missing = numbered.filter(k => !B[k])
ok(keys.length > 300, 'every registered player texture was scanned for its kit bands', `${keys.length} textures`)
ok(missing.length === 0, 'every pose that can show a number carries a band read off the art',
  missing.length ? missing.slice(0, 8).join(', ') : `${numbered.length} numbered poses`)

// replay the renderer's own placement maths over every band a numbered pose can hand it
const P = await page.evaluate((keys) => {
  const TU = window.TU, bands = window.__V104.bands
  const place = (b, rear) => {
    const room = b.waist - b.top - 0.5
    const cap = Math.min(TU('numCellH', 6), room), half = cap / 2
    const gap = Math.max(0, Math.min(TU('numWaistGap', 1), room - cap))
    let row = b.waist - (rear ? TU('numRearRise', 8) : TU('numFrontRise', 6))
    const hi = b.top + half + 0.5, lo = b.waist - half - gap
    row = Math.max(hi, Math.min(Math.max(hi, lo), row))
    return { row, cap, gap, inkTop: row - half, inkBot: row + half }
  }
  const rows = []
  for (const k of keys) { const b = bands[k]; if (!b) continue
    rows.push({ k, b, front: place(b, false), rear: place(b, true) }) }
  return { rows }
}, numbered)
const REAR = /_(up|ur)_/
// the poses a drive is actually made of — what the eye is on for most of a play
const CORE = /_(up|ur|dn|dr)_(idle|run\d|block\d|walk\d|cut|plant|stance2?|throw\d)$/
const onPants = P.rows.filter(r => r.front.inkBot > r.b.waist || r.rear.inkBot > r.b.waist)
const onHelmet = P.rows.filter(r => r.front.inkTop < r.b.top || r.rear.inkTop < r.b.top)
const rearRows = P.rows.filter(r => REAR.test(r.k))
// ...wherever the shirt has room for it: a QB at full extension has eight rows of jersey and
// the number is already as high as it can go, chest or back.
const rearCore = rearRows.filter(r => CORE.test(r.k) && r.b.waist - r.b.top >= 11)
const higher = rearCore.filter(r => r.rear.row < r.front.row)
const notLower = rearRows.filter(r => r.rear.row <= r.front.row)
const coreRows = P.rows.filter(r => CORE.test(r.k))
const nominal = await page.evaluate(() => window.TU('numCellH', 6))
const minCap = Math.min(...coreRows.map(r => Math.min(r.front.cap, r.rear.cap)))
const full = coreRows.filter(r => r.front.cap >= nominal && r.rear.cap >= nominal)
ok(onPants.length === 0, 'no pose puts the number on the pants — the ink clears the waistband',
  onPants.length ? onPants.slice(0, 4).map(r => r.k).join(', ') : `${P.rows.length} poses clear`)
ok(onHelmet.length === 0, 'and none rides up over the collar into the helmet',
  onHelmet.length ? onHelmet.slice(0, 4).map(r => r.k).join(', ') : 'all inside the jersey')
ok(higher.length === rearCore.length && notLower.length === rearRows.length,
  'the back number sits higher than the chest number — shoulder blades, not belt',
  `${higher.length}/${rearCore.length} core, ${notLower.length}/${rearRows.length} never lower | ` +
  rearCore.filter(r=>!(r.rear.row<r.front.row)).slice(0,8).map(r=>r.k+JSON.stringify(r.b)).join(' '))
ok(full.length / coreRows.length > 0.9 && minCap >= nominal * 0.9,
  'and it is the SAME numeral pose to pose — nothing a drive is made of shrinks it by a tenth',
  `${full.length}/${coreRows.length} at full height, smallest ${minCap.toFixed(2)} of ${nominal}`)
// the bug this pass exists to kill: the old back number was pinned +1.5px below the sprite's
// own centre, which on an up-facing idle or run is rows INTO the trousers.
const legacy = P.rows.filter(r => /_(up|ur)_(idle|run\d|walk\d)$/.test(r.k))
const legacyBad = legacy.filter(r => 24 + 1.5 + 3.2 > r.b.waist)
ok(legacy.length > 0 && legacyBad.length / legacy.length > 0.9,
  'and the old fixed offset really was in the pants on those poses (the regression this guards)',
  `${legacyBad.length}/${legacy.length} rear poses`)

// ================= 2. what the field actually draws, over live play =================
let minH = 1e9, maxH = 0, minR = 1e9, maxR = 0, seenRear = 0, seenFront = 0, fonts = new Set(), seen = 0
const rowsByTex = {}
for (let i = 0; i < 170; i++) {
  const st = await page.evaluate(() => { const sc = window.__gridironScene; if (!sc) return null
    return (sc.markers || []).filter(m => m && m.tex && m.label && m.label.visible && m._numRowV104 != null).map(m => ({
      tex: m.tex, row: m._numRowV104, rear: !!m._ribRearFacing, fs: m.label.style.fontSize,
      // the ink on screen, and the body it is painted on
      inkH: (window.TU('numCellH', 6)) * (m.body.scaleY || 1) * m.root.scale,
      bodyH: m.body.displayHeight * m.root.scale })) })
  for (const r of (st || [])) { seen++
    fonts.add(r.fs)
    if (r.rear) seenRear++; else seenFront++
    minH = Math.min(minH, r.inkH); maxH = Math.max(maxH, r.inkH)
    const ratio = r.inkH / r.bodyH; minR = Math.min(minR, ratio); maxR = Math.max(maxR, ratio)
    ;(rowsByTex[r.tex] || (rowsByTex[r.tex] = new Set())).add(r.row.toFixed(2)) }
  await page.waitForTimeout(70)
}
ok(seen > 400 && seenRear > 0 && seenFront > 0, 'numbers were drawn front and back through live play',
  `${seen} placements, ${seenFront} front / ${seenRear} back`)
ok(fonts.size === 1, 'the label is rasterized ONCE — the font size is never re-set per frame',
  [...fonts].join(','))
// painted on the shirt: the number keeps its share of the body wherever he is on the field
ok(maxR / Math.max(1e-6, minR) < 1.35, 'the number holds its share of the body across the whole field',
  `ratio ${minR.toFixed(4)}..${maxR.toFixed(4)} (${(maxR / minR).toFixed(2)}x)`)
ok(minH > 3.2 && maxH < 9, 'and it stays inside a sane on-screen size band', `${minH.toFixed(2)}..${maxH.toFixed(2)} px`)
// one texture = one row: a run cycle must not make the number breathe
const pulsing = Object.entries(rowsByTex).filter(([, s]) => s.size > 1)
ok(pulsing.length === 0, 'one pose, one anchor — the number does not wander frame to frame',
  pulsing.length ? pulsing.slice(0, 4).map(([k, s]) => k + ':' + [...s].join('/')).join(', ') : `${Object.keys(rowsByTex).length} poses drawn`)

console.log(JSON.stringify({ pass, fail, errors: errs.length, badRequests: bad.length }))
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errs.length || bad.length ? 1 : 0)
