// Does the training art actually reach every screen a season's training is CHOSEN
// on, and is the sheet packed so it can be addressed without bleeding?
//
// There are two such screens and they are rendered by different code in different
// scopes: the offseason "Choose Your Training" board (the legacy career app, plain
// DOM) and the v42 growth wheel (canvas plus its own rows). wheelcheck.mjs owns the
// wheel. This owns the board, plus the one property of the ATLAS that both depend
// on: a gutter around every cell. A CSS background addresses these cells by
// percentage at whatever device pixel ratio the phone has and samples a little past
// the boundary, so without a gutter each tile shows a sliver of its neighbour's
// scene down its edge — which is what a 4% gutter was doing before v65.
import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 1000 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 25000 })
await page.waitForTimeout(1400)

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }

const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  const r = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const el = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
      .find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false
  }, { t, visSrc: vis })
  await page.waitForTimeout(650); return r
}

// ---------- the atlas ----------
const atlas = await page.evaluate(async () => {
  const src = window.__RIB_SKILL_V64
  const cells = window.__SKILL_V64 && window.__SKILL_V64.cells
  if (!src || !cells) return { err: 'no sheet on the page' }
  const im = new Image()
  await new Promise((r, j) => { im.onload = r; im.onerror = j; im.src = src })
  const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height
  const g = cv.getContext('2d'); g.drawImage(im, 0, 0)
  const d = g.getImageData(0, 0, im.width, im.height).data
  // the gutter: the outer 5% ring of every cell must be empty, or a background
  // positioned a fraction of a pixel off picks up the neighbouring scene
  const dirty = []
  for (const k in cells) {
    const [x, y, w, h] = cells[k]
    const ring = Math.round(w * .05)
    let worst = 0
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      if (xx >= ring && xx < w - ring && yy >= ring && yy < h - ring) continue
      const a = d[((y + yy) * im.width + (x + xx)) * 4 + 3]
      if (a > worst) worst = a
    }
    if (worst > 8) dirty.push(k + ':' + worst)
  }
  return { size: im.width + 'x' + im.height, cells: Object.keys(cells).length, dirty,
    alias: Object.keys(window.__SKILL_V64.alias || {}).length }
})
console.log('atlas:', JSON.stringify(atlas))
ok(!atlas.err, 'the skill sheet is on the page and decodes', atlas.size)
ok(atlas.cells === 12, 'twelve scenes, one per training theme', atlas.cells)
ok(atlas.dirty && atlas.dirty.length === 0,
  'every cell has an empty gutter, so a CSS background cannot sample its neighbour',
  atlas.dirty && atlas.dirty.length ? 'ink in the gutter of ' + atlas.dirty.join(', ') : 'all 12 clean')
ok(atlas.alias === 12, 'the offseason board has an alias onto all twelve cells', atlas.alias)

// ---------- the offseason board ----------
// the career-creation flow offers its origin and position steps in a different
// order run to run, so walk it by what is on screen rather than by a fixed script
for (const t of ['NEXT', 'NEXT', 'NEXT', 'NEW CAREER']) await click(t)
for (let i = 0; i < 6; i++) {
  const done = await page.evaluate(({ visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    for (const want of ['START YOUR LEGACY', 'Lock In Personality']) {
      const b = els.find(e => txt(e).includes(want)); if (b) { b.click(); return false }
    }
    const card = els.find(e => e.classList.contains('pos-card') || /^[A-Z]{1,2} /.test(txt(e)))
    if (card) { card.click(); return false }
    return true
  }, { visSrc: vis })
  await page.waitForTimeout(500)
  if (done) break
}
// startSeason IS the button the hub's "PLAY N-GAME SEASON" is wired to, so this
// enters the board the same way a player does — just without depending on the hub
// having settled first
await page.evaluate(() => window.startSeason())
await page.waitForTimeout(600)
await page.evaluate(() => { const e = document.getElementById('growthV42'); if (e) e.remove() })

const board = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.train-card')]
  const ico = [...document.querySelectorAll('.train-card .gv64-ico')]
  const r = ico[0] && ico[0].getBoundingClientRect()
  return {
    cards: cards.length,
    art: ico.filter(e => !e.classList.contains('gv64-emo')).length,
    emo: document.querySelectorAll('.train-card .gv64-emo').length,
    distinct: new Set(ico.map(e => e.style.backgroundPosition)).size,
    sized: !!r && r.width >= 32 && Math.abs(r.width - r.height) < 2,
    image: ico[0] ? getComputedStyle(ico[0]).backgroundImage.slice(0, 24) : '',
    sheet: !!document.getElementById('gv64css'),
    keys: cards.map(c => (c.getAttribute('onclick') || '').replace(/\D*'(\w+)'.*/, '$1')),
  }
})
console.log('board:', JSON.stringify({ ...board, image: undefined }))
ok(board.cards === 12, 'the offseason board offers all twelve programs', board.cards)
ok(board.sheet, 'the icon rules are a document-level sheet, not the wheel overlay’s')
ok(board.art === board.cards && board.cards > 0,
  'every program on the board shows ART, not the emoji it replaced',
  board.art + ' of ' + board.cards + ', ' + board.emo + ' on the emoji fallback')
ok(board.image.includes('url('), 'the tiles are a real image', board.image)
ok(board.sized, 'the tiles are square and big enough to read')
ok(board.distinct === board.cards,
  'each program shows its OWN scene — no picture appears twice on a board that shows every program at once',
  board.distinct + ' distinct of ' + board.cards)

// the fallback still works: with the sheet off, the board re-renders on its emoji
const off = await page.evaluate(() => {
  window.__SKILL_V64.off = true
  window.startSeason()
  const n = document.querySelectorAll('.train-card .gv64-emo').length
  const art = document.querySelectorAll('.train-card .gv64-ico:not(.gv64-emo)').length
  window.__SKILL_V64.off = false
  return { emo: n, art }
})
ok(off.emo === 12 && off.art === 0,
  'and with the sheet switched off every program falls back to the emoji it replaced',
  off.emo + ' emoji, ' + off.art + ' art')

console.log('page errors:', errs.length ? '\n' + errs.join('\n') : 'NONE')
console.log('VERDICT: ' + (fail === 0 && errs.length === 0 ? 'PASS' : 'FAIL') + `  (${pass} ok, ${fail} failed)`)
await browser.close()
process.exitCode = fail === 0 && errs.length === 0 ? 0 : 1
