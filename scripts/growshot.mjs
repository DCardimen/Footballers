// v132 QA: drives a fresh career through one silent season to the report card and screenshots the
// offseason body screen (A YEAR OLDER) at three moments of its timeline. VET=42 replays it as a veteran's
// year (age 42, synthetic decline) once the report card is up; OUT=/path/prefix names the shots.
//   OUT=/tmp/grow node scripts/growshot.mjs      VET=42 OUT=/tmp/vet node scripts/growshot.mjs
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })
const page = await ctx.newPage(); const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { try { localStorage.setItem('rib.coachTour.v119', 'off') } catch {} setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/?noFilmV114', { waitUntil: 'networkidle', timeout: 60000 })
for (let i = 0; i < 200; i++) { if (await page.evaluate(() => !document.getElementById('splash'))) break; await page.waitForTimeout(100) }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function step(t) { await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim(); const el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : els.find(e => txt(e).includes(t)); if (el) { el.scrollIntoView({ block: 'center' }); el.click() } }, { t, visSrc: vis }); await page.waitForTimeout(900) }
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON']) await step(t)
for (let i = 0; i < 60; i++) { const d = await page.evaluate(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') { g.click(); return false } return !document.getElementById('growthV42') }); if (d) break; await page.waitForTimeout(300) }
if (process.env.BOARD) { await page.waitForTimeout(600); await page.screenshot({ path: (process.env.OUT || '/tmp/grow_v132') + '_board.png', fullPage: true }); await page.evaluate(() => { const t = document.querySelector('.tp-tile-v113.tier-red'); if (t) t.click() }); await page.waitForTimeout(500); await page.screenshot({ path: (process.env.OUT || '/tmp/grow_v132') + '_board_red.png', fullPage: true }) }
await step('CONFIRM TRAINING')
const AGE = Number(process.env.AGE || 0)
if (AGE) await page.evaluate((a) => { const p = window.__GRIDIRON_AUDIT__.getState().player; p.age = a; p.level = 7; }, AGE)
for (let i = 0; i < 30; i++) {
  const v = await page.evaluate(() => { try { return window.__GRIDIRON_AUDIT__.getState().view } catch (e) { return null } })
  if (v === 'result') break
  await page.evaluate(() => { try { window.simRemainingWeeks && window.simRemainingWeeks() } catch (e) {} }); await page.waitForTimeout(400)
  await page.evaluate(() => { const A = window.__GRIDIRON_AUDIT__, p = A.getState().player; for (const w of (p.weekResults || [])) { if (!w || w.played) continue; try { A.resolveSequentialWeekV11(p, w, 'balanced') } catch (e) {} w.played = true; w.won = !!(w.us > w.them) } }); await page.waitForTimeout(200)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^\s*(CONTINUE|OK|CLOSE|NEXT)\s*$/i.test((x.innerText || '').trim()) && x.getBoundingClientRect().height > 0 && !x.closest('#rib-coach-v119')); if (b) b.click() }); await page.waitForTimeout(300)
  await page.evaluate(() => { try { window.finishSeasonGames && window.finishSeasonGames() } catch (e) {} }); await page.waitForTimeout(600)
}
for (let i = 0; i < 20; i++) { const d = await page.evaluate(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none' && g.getBoundingClientRect().height > 0) { g.click(); return false } return !document.getElementById('growthV42') }); if (d) break; await page.waitForTimeout(400) }
if (process.env.VET) await page.evaluate((a) => { const p = window.__GRIDIRON_AUDIT__.getState().player; p.age = a; p.seasonStats.ageProfile = null; p.seasonStats.ageChanges = { speed: { from: 70, to: 68, delta: -2 }, strength: { from: 66, to: 65, delta: -1 }, agility: { from: 60, to: 59, delta: -1 }, awareness: { from: 60, to: 61, delta: 1 } }; p.seasonStats.gains = { awareness: 1 }; window.__GROW_V132.show() }, Number(process.env.VET))
if (process.env.REPLAY) await page.evaluate(() => window.__GROW_V132.show())
const st = await page.evaluate(() => ({ view: window.__GRIDIRON_AUDIT__.getState().view, open: !!(window.__GROW_V132 && window.__GROW_V132.open), last: window.__GROW_V132 && window.__GROW_V132.last && (({ age, prev, mode, b0, b1, ovr0, ovr1, gains, drops }) => ({ age, prev, mode, b0: [b0.height, b0.weight, b0.muscle], b1: [b1.height, b1.weight, b1.muscle], ovr0, ovr1, gains: gains.length, drops: drops.length }))(window.__GROW_V132.last) }))
console.log(JSON.stringify(st))
const out = process.env.OUT || '/tmp/grow_v132'
await page.waitForTimeout(700); await page.screenshot({ path: out + '_1.png' })
await page.waitForTimeout(2200); await page.screenshot({ path: out + '_2.png' })
await page.waitForTimeout(2600); await page.screenshot({ path: out + '_3.png', fullPage: false })
console.log('errors:', errs.length ? errs.join(' | ') : 'none')
await browser.close()
