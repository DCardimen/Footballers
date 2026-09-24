// Dev check (v139 A BEAT BEFORE THE WHEEL).
//
// The season's commitment wheel came up on its own 650ms after the season started and span itself:
// the single roll that decides how you live the whole year happened while you were still reading
// the training board. `cfg.gate` puts one beat in front of it — the wheel is built and drawn, then
// held behind a card that asks, and it starts when you say so.
//
// The gate's button carries the wheel's OWN id (`gv42go`) and the gate removes itself before the
// roll pop-up makes its own, so there is never two of it and everything that drives this wheel by
// tapping `#gv42go` until the overlay is gone keeps working — one extra tap at the front.
//
// Asserts: the gate is up with the wheel hidden behind it; it asks the question in those words;
// there is exactly one #gv42go and it reads ROLL IT; the old drive loop still clears the overlay;
// and the weekly plan wheel inside the pregame wizard is NOT gated.
//
//   node scripts/gatecheck.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
import { CHROME, gameUrl } from './lib/env.mjs'
const url = gameUrl('index.html')
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(url + (url.includes('?') ? '&' : '?') + 'stayStale', { waitUntil: 'networkidle', timeout: 25000 })
await page.waitForTimeout(1400)
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const step = async (t, w = 900) => { await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis).filter(e => !e.closest('#rib-coach-v119')); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim(); const el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : els.find(e => txt(e).includes(t)); if (el) { el.scrollIntoView({ block: 'center' }); el.click() } }, { t, visSrc: vis }).catch(() => {}); await page.waitForTimeout(w) }

for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON']) await step(t)
await page.waitForTimeout(1300)

const up = await page.evaluate(() => {
  const root = document.getElementById('growthV42'), g = document.getElementById('gv139gate')
  const gos = [...document.querySelectorAll('#gv42go')]
  const card = root && [...root.children].find(c => c.id !== 'gv139gate')
  return { root: !!root, gate: !!g, gos: gos.length, label: ((gos[0] || {}).textContent || '').trim(),
    wheelHidden: card ? getComputedStyle(card).display === 'none' : null,
    spun: !!(window.__WHEEL_V50_LAST && window.__WHEEL_V50_LAST.redraw),
    text: g ? g.innerText.replace(/\s+/g, ' ') : '' }
})
console.log('gate:', JSON.stringify({ ...up, text: up.text.slice(0, 120) }))
ok(up.root && up.gate, 'the season commitment opens on the gate, not on a spinning wheel')
ok(up.wheelHidden === true, 'the wheel is built and drawn but held behind it', `hidden=${up.wheelHidden}`)
ok(!up.spun, 'and it has not landed on anything yet')
ok(/Ready to roll for your career focus\?/.test(up.text), 'it asks in those words', up.text.slice(0, 90))
ok(up.gos === 1 && /ROLL IT/.test(up.label), 'with exactly one #gv42go, reading ROLL IT', `${up.gos} × "${up.label}"`)

// the old drive loop — tap #gv42go until the overlay is gone — must still clear it
let taps = 0
for (let i = 0; i < 90; i++) {
  const d = await page.evaluate(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') { g.click(); return 'tap' } return document.getElementById('growthV42') ? 'wait' : 'done' })
  if (d === 'tap') taps++
  if (d === 'done') break
  await page.waitForTimeout(250)
}
const after = await page.evaluate(() => ({ overlay: !!document.getElementById('growthV42'), gate: !!document.getElementById('gv139gate'), view: window.S.view }))
console.log('after:', JSON.stringify({ ...after, taps }))
ok(!after.overlay && !after.gate, 'tapping through clears the gate and the wheel', JSON.stringify(after))
ok(taps === 2, 'in exactly two taps — roll it, then continue', `${taps} taps`)
ok(after.view === 'training', 'and it hands back to the training board', after.view)

// the weekly plan wheel lives inside the pregame wizard, which is already a page you press through
await step('CONFIRM TRAINING', 1100)
await page.evaluate(() => { const el = [...document.querySelectorAll('button')].find(e => /PLAY WEEK \d+ LIVE/.test(e.innerText || '')); el && el.click() })
for (let i = 0; i < 40 && !(await page.evaluate(() => !!document.getElementById('pregameV1513'))); i++) await page.waitForTimeout(250)
// walk to the wheel page
for (let i = 0; i < 6; i++) {
  const at = await page.evaluate(() => { try { return window.__V112_D.page() } catch (e) { return -1 } })
  if (at >= 5 || at < 0) break
  await page.evaluate(() => { const b = document.getElementById('v112Next'); if (b && !b.disabled) b.click() }); await page.waitForTimeout(700)
}
await page.waitForTimeout(1200)
const weekly = await page.evaluate(() => ({
  wizard: !!document.getElementById('pregameV1513'),
  page: (() => { try { return window.__V112_D.page() } catch (e) { return -1 } })(),
  wheel: !!document.querySelector('#pregameV1513 #growthV42'),
  gate: !!document.getElementById('gv139gate') }))
console.log('weekly:', JSON.stringify(weekly))
ok(weekly.wizard && weekly.wheel && !weekly.gate, 'the weekly plan wheel inside the pregame wizard is NOT gated — the wizard already is one', JSON.stringify(weekly))

console.log('page errors:', errs.length ? errs.join('\n') : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
