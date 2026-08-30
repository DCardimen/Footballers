// Dev check: how far does each screen overflow a phone, and is what overflows worth
// the scroll? Walks a real career, visits every screen the career loop reaches, and
// reports the overflow in screens (1.0 = you must scroll a whole extra screen).
//
// This is the measurement behind the v75 compaction: a screen that needs a flick is
// fine, a screen that needs three is a screen whose primary control the player cannot
// see. `worst` is the number that matters — the deepest screen in the loop.
import { chromium } from 'playwright'

const W = +(process.env.SCROLL_W || 390), H = +(process.env.SCROLL_H || 844)
const LIMIT = +(process.env.SCROLL_LIMIT || 1.35)   // screens of overflow we accept

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: W, height: H } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.addInitScript(() => {
  setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60)
})
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 25000 })
await page.waitForTimeout(1600)

const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  const r = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t === 'ARCH') el = els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
    else el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false
  }, { t, visSrc: vis })
  await page.waitForTimeout(700); return r
}
// <html> carries overflow:hidden in this app, so the document is never the scroller —
// find the element that actually scrolls and measure THAT.
const measure = (tag) => page.evaluate((tag) => {
  let best = null
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    if (!/auto|scroll/.test(cs.overflowY)) continue
    if (el.closest('#rib-main-menu-v2')) continue
    const over = el.scrollHeight - el.clientHeight
    if (el.clientHeight > 200 && (!best || over > best.over)) best = { el, over }
  }
  const el = best ? best.el : document.documentElement
  const screen = document.getElementById('screen')
  return { tag, view: (window.S && window.S.view) || null,
    scroller: el.id || el.className || el.tagName,
    scrollH: el.scrollHeight, clientH: el.clientHeight,
    over: +((el.scrollHeight - el.clientHeight) / el.clientHeight).toFixed(2),
    cards: screen ? screen.querySelectorAll('.card').length : 0 }
}, tag)

const rows = []
const at = async (tag) => { const m = await measure(tag); rows.push(m); return m }

// walk into a career
await click('START NEW CAREER')
for (let i = 0; i < 8; i++) {
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
  await page.waitForTimeout(420)
  if (done) break
}
await at('hub')
await click('PLAY 8-GAME SEASON')
await at('training')
await click('Balanced Program')
await page.evaluate(() => document.getElementById('growthV42')?.remove())
await page.waitForTimeout(400)
await at('season')

// the rest of the loop, reached from the hub/season screens by name
for (const [label, tag] of [['LEADERS', 'leaders'], ['STANDINGS', 'standings']]) {
  if (await click(label)) { await at(tag); await click('Back') }
}
await page.evaluate(() => window.go('hub'))
await page.waitForTimeout(500)
for (const [view, tag] of [['upgrade', 'upgrade'], ['stats', 'stats'], ['roster', 'roster'],
  ['settings', 'settings'], ['shop', 'prestige tree'], ['legacy', 'legacy']]) {
  const ok = await page.evaluate((v) => { try { window.go(v); return true } catch (e) { return false } }, view)
  if (!ok) continue
  await page.waitForTimeout(600)
  const m = await at(tag)
  if (m.view !== view) rows.pop()                     // that view name is not a screen
}

rows.sort((a, b) => b.over - a.over)
console.log(`viewport ${W}x${H} — overflow in screens (0 = fits)`)
for (const r of rows) console.log(`  ${String(r.over).padStart(5)}  ${r.tag.padEnd(14)} ${r.scrollH}px / ${r.clientH}px  ${r.cards} cards  [${r.scroller}]`)
const worst = rows[0]
console.log('worst:', worst ? `${worst.tag} at ${worst.over} screens` : 'none')
const over = rows.filter(r => r.over > LIMIT)
console.log((over.length ? 'FAIL ' : 'ok   ') +
  `every screen stays inside ${LIMIT} screens of scroll` +
  (over.length ? '  — over: ' + over.map(r => `${r.tag} ${r.over}`).join(', ') : ''))
console.log('page errors:', errs.length ? '\n' + errs.join('\n') : 'NONE')
console.log('VERDICT: ' + (!over.length && !errs.length ? 'PASS' : 'FAIL'))
await browser.close()
process.exitCode = (!over.length && !errs.length) ? 0 : 1
