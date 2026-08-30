// Dev check: v67 SOFT-CAP LEGIBILITY — is the price of a point stated on the two
// screens where it decides something?
//
// v21 charges 1 skill point per +1 below a stat's soft cap and 2, 3, 4… above it,
// forever. Before v67 that was said only on the upgrade screen, in a hover title —
// invisible on a phone, and one screen too late: the season's TRAINING is chosen
// first, and committing a season of priority growth to four already-capped stats is
// exactly the mistake the number exists to prevent.
//
// So: every focus stat on the offseason board carries its own price badge, every
// program carries a verdict, and every upgrade row carries a permanent readout that
// tracks the points as they are spent. The badges must also agree with drCost —
// a decorative badge that drifts from the real charge is worse than none.
import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 1000 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
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

// ---------- get into a career, same walk skillartcheck uses ----------
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

// ---------- 1. the offseason training board ----------
// Push one focus stat clean through its soft cap first, so the board has a genuinely
// expensive program on it and the check is not just reading the cheap default.
await page.evaluate(() => {
  const pl = window.S.player, S = window.__CAPV67
  // strength/tackling/blocking = the Weight Room's focus. Park them past the cap so
  // that program has to price itself honestly.
  for (const k of ['strength', 'tackling', 'blocking']) pl.attrs[k] = Math.min(S.abs(), S.cap(pl, k) + 24)
})
await page.evaluate(() => window.startSeason())
await page.waitForTimeout(700)
await page.evaluate(() => { const e = document.getElementById('growthV42'); if (e) e.remove() })

const board = await page.evaluate(() => {
  const S = window.__CAPV67, pl = window.S.player
  const cards = [...document.querySelectorAll('.train-card')]
  const rows = cards.map(c => ({
    key: (c.getAttribute('onclick') || '').replace(/\D*'(\w+)'.*/, '$1'),
    badges: [...c.querySelectorAll('.capv67')].map(b => b.textContent.trim()),
    meta: (c.querySelector('.train-meta') || {}).innerText || '',
  }))
  // every badge must agree with what drCost would actually charge
  const drift = []
  for (const c of cards) {
    for (const chip of c.querySelectorAll('.train-chip')) {
      const b = chip.querySelector('.capv67'); if (!b) continue
      const name = chip.textContent.replace(b.textContent, '').trim()
      const k = S.keyOfLabel(name); if (!k) continue
      const want = pl.attrs[k] >= S.abs() ? 'MAX'
        : S.cost(pl, k) === 1 ? '1 pt' : S.cost(pl, k) + ' pts'
      if (!b.textContent.includes(want)) drift.push(k + ' shows "' + b.textContent + '" wants "' + want + '"')
    }
  }
  return {
    cards: cards.length,
    withBadges: rows.filter(r => r.badges.length).length,
    badgeTotal: rows.reduce((n, r) => n + r.badges.length, 0),
    verdicts: rows.filter(r => /CHEAP ZONE|PAST SOFT CAP|EXPENSIVE|MOSTLY CAPPED|ALL CAPPED/.test(r.meta)).length,
    weight: rows.find(r => r.key === 'weight') || null,
    drift,
  }
})
console.log('board:', JSON.stringify(board))
ok(board.cards === 12, 'the offseason board still offers all twelve programs', board.cards)
ok(board.withBadges === board.cards, 'every program prices the stats it would push',
  board.withBadges + ' of ' + board.cards + ' (' + board.badgeTotal + ' badges)')
ok(board.verdicts === board.cards, 'every program carries a one-line cost verdict', board.verdicts)
ok(board.drift.length === 0, 'every badge quotes what drCost would actually charge',
  board.drift.length ? board.drift.join(' · ') : 'all badges agree with the pricing')
ok(!!board.weight && /MOSTLY CAPPED|ALL CAPPED|EXPENSIVE/.test(board.weight.meta),
  'a program whose focus stats are all past the cap says so, loudly',
  board.weight ? board.weight.meta.replace(/\s+/g, ' ') : 'no weight-room card')
ok(!!board.weight && board.weight.badges.every(b => !/^1 pt/.test(b)),
  'and none of its stats still claims the cheap price',
  board.weight ? board.weight.badges.join(' / ') : '-')
await page.screenshot({ path: 'scripts/_cap_board.png', fullPage: true })

// ---------- 2. the upgrade screen ----------
await page.evaluate(() => {
  const pl = window.S.player
  pl.points = 60
  window.go('upgrade')
  return null
})
await page.waitForTimeout(500)
const rows = await page.evaluate(() => {
  const lines = [...document.querySelectorAll('.up-cap')]
  return {
    n: lines.length,
    filled: lines.filter(e => e.textContent.trim().length > 6).length,
    hasCheap: lines.some(e => /1 pt per \+1/.test(e.textContent)),
    hasDear: lines.some(e => /pts per \+1|MAXED/.test(e.textContent)),
    sample: lines.slice(0, 3).map(e => e.textContent.replace(/\s+/g, ' ').trim()),
  }
})
console.log('upgrade rows:', JSON.stringify(rows))
ok(rows.n > 0 && rows.filled === rows.n, 'every upgrade row states its cap without a hover',
  rows.filled + ' of ' + rows.n)
ok(rows.hasCheap && rows.hasDear, 'and both sides of the cap are named on that screen',
  rows.sample.join(' | '))

// the readout must TRACK spending, not just render once. Pick a stat still inside
// the cheap zone: deep past the cap the band is 10 wide, so a single point changes
// nothing and a "the text moved" assertion would be measuring the wrong thing.
const tracked = await page.evaluate(async () => {
  const S = window.__CAPV67, pl = window.S.player
  const k = [...document.querySelectorAll('.up-cap')].map(e => e.id.slice(4))
    .find(k => S.cost(pl, k) === 1 && S.cap(pl, k) - pl.attrs[k] > 1) || 'strength'
  const before = document.getElementById('cap-' + k).textContent
  window.alloc(k, 1)
  await new Promise(r => setTimeout(r, 60))
  return { k, before: before.replace(/\s+/g, ' ').trim(), after: document.getElementById('cap-' + k).textContent.replace(/\s+/g, ' ').trim() }
})
console.log('after one point:', JSON.stringify(tracked))
ok(tracked.before !== tracked.after,
  'the readout follows the points as they are spent',
  tracked.k + ': ' + tracked.before + ' -> ' + tracked.after)
await page.screenshot({ path: 'scripts/_cap_upgrade.png', fullPage: true })

console.log('page errors:', errs.length ? '\n' + errs.join('\n') : 'NONE')
console.log('VERDICT: ' + (fail === 0 && errs.length === 0 ? 'PASS' : 'FAIL') + `  (${pass} ok, ${fail} failed)`)
await browser.close()
process.exitCode = fail === 0 && errs.length === 0 ? 0 : 1
