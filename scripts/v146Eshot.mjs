// Dev shot (v146 E THE MENUS LIVE AT THE BOTTOM, AND NOTHING SCROLLS).
// Walks a real career into the loop and saves one screenshot per career screen (and per section
// tab) at 400x860 (SHOT_W / SHOT_H to change) to /tmp/claude-0/shots/v146E_<view>.png. LOOK at them.
//   node scripts/v146Eshot.mjs            (GAME_URL=http://localhost:5305/ for another port)
import { chromium } from 'playwright'
import fs from 'node:fs'
const W = +(process.env.SHOT_W || 400), H = +(process.env.SHOT_H || 860)
const OUT = process.env.SHOT_DIR || '/tmp/claude-0/shots'
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null
fs.mkdirSync(OUT, { recursive: true })
const url = process.env.GAME_URL || 'http://localhost:5173/'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: W, height: H } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.addInitScript(() => {
  try { localStorage.setItem('rib.coachTour.v119', '0'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
  setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60)
})
await page.goto(url + (url.includes('?') ? '&' : '?') + 'stayStale', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1800)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  const r = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    const el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.click(); return true } return false
  }, { t, visSrc: vis })
  await page.waitForTimeout(700); return r
}
const want = (n) => !ONLY || ONLY.some(o => n.startsWith(o))
const shot = async (name) => {
  if (!want(name)) return
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/v146E_${name}.png` })
  const m = await page.evaluate(() => {
    const a = document.getElementById('app'), s = document.getElementById('screen')
    const bot = ['navV139', 'dock'].map(id => document.getElementById(id)).concat([document.querySelector('#screen > .hubv75-tabs')])
      .filter(e => e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0).reduce((t, e) => Math.min(t, e.getBoundingClientRect().top), innerHeight)
    return { page: document.scrollingElement.scrollHeight - innerHeight, app: a.scrollHeight - a.clientHeight, panelOver: s.scrollHeight - s.clientHeight, bottomChrome: Math.round(innerHeight - bot) }
  })
  console.log('shot', name, JSON.stringify(m))
  if (process.env.TREE) console.log(await page.evaluate((DEPTH) => {
    const out = []
    const walk = (el, d) => {
      for (const c of el.children) {
        const h = Math.round(c.getBoundingClientRect().height); if (!h) continue
        out.push('  '.repeat(d) + (c.tagName.toLowerCase()) + '.' + String(c.className || '').replace(/\s+/g, '.').slice(0, 60) + ' ' + h + ' "' + (c.innerText || '').replace(/\s+/g, ' ').slice(0, 50) + '"' + (c.scrollHeight > c.clientHeight + 2 && getComputedStyle(c).overflowY !== 'visible' ? ' [scroll ' + c.scrollHeight + ']' : ''))
        if (d < DEPTH && h > 150) walk(c, d + 1)
      }
    }
    walk(document.getElementById('screen'), 1); return out.join('\n')
  }, +process.env.TREE || 2))
  if (process.env.DUMP) console.log('  DOCK:', await page.evaluate(() => (document.getElementById('dock') || {}).innerHTML?.replace(/\s+/g, ' ').slice(0, 900)))
}
await click('START NEW CAREER')
for (let i = 0; i < 8; i++) {
  const done = await page.evaluate(({ visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    for (const want of ['START YOUR LEGACY', 'Lock In Personality']) { const b = els.find(e => txt(e).includes(want)); if (b) { b.click(); return false } }
    const card = els.find(e => e.classList.contains('pos-card') || /^[A-Z]{1,2} /.test(txt(e)))
    if (card) { card.click(); return false }
    return true
  }, { visSrc: vis })
  await page.waitForTimeout(450)
  if (done) break
}
await page.waitForTimeout(600)
const tabs = async (name) => {
  await page.waitForTimeout(400)
  const ks = await page.evaluate(() => [...document.querySelectorAll('.hubv75-tab')].map(t => t.dataset.sec))
  if (!ks.length) return shot(name)
  for (const k of ks) {
    await page.evaluate((k) => document.querySelector(`.hubv75-tab[data-sec="${k}"]`)?.click(), k)
    await shot(`${name}_${k}`)
  }
}
await tabs('hub')
await page.evaluate(() => window.go('shop')); await page.waitForTimeout(700); await tabs('shop')
await page.evaluate(() => window.go('hub')); await page.waitForTimeout(500)
await click('GAME SEASON'); await page.waitForTimeout(500)
// the season commitment's READY TO ROLL gate sits over the board; look under it, then put it back
await page.evaluate(() => { const g = document.getElementById('growthV42'); if (g) g.style.visibility = 'hidden' })
await tabs('training')
await page.evaluate(() => { const g = document.getElementById('growthV42'); if (g) g.style.visibility = '' })
await click('Balanced Program'); await click('CONFIRM TRAINING')
await page.waitForTimeout(600)
await shot('wheel')
await page.evaluate(() => document.getElementById('growthV42')?.remove())
await page.waitForTimeout(400)
await tabs('season')
for (const v of ['upgrade', 'stats', 'challenges', 'settings', 'hof', 'locker', 'dynasty', 'rank']) {
  const ok = await page.evaluate((v) => { try { window.go(v); return (window.S || window.o || {}).view === v } catch (e) { return false } }, v)
  await page.waitForTimeout(700)
  if (ok) await tabs(v)
}

// play the season out to the report card through the game's own entry points (as coachcheck does)
async function toResult() {
  await page.evaluate(() => window.go('season')); await page.waitForTimeout(600)
  for (let i = 0; i < 30; i++) {
    const v = await page.evaluate(() => { try { return window.__GRIDIRON_AUDIT__.getState().view } catch (e) { return null } })
    if (v === 'result') break
    await page.evaluate(() => { try { window.simRemainingWeeks && window.simRemainingWeeks() } catch (e) {} }); await page.waitForTimeout(500)
    await page.evaluate(() => { const A = window.__GRIDIRON_AUDIT__, p = A.getState().player
      for (const w of (p.weekResults || [])) { if (!w || w.played) continue
        try { A.resolveSequentialWeekV11(p, w, 'balanced') } catch (e) {}
        w.played = true; w.won = !!(w.us > w.them) } }); await page.waitForTimeout(300)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^\s*(CONTINUE|OK|CLOSE|NEXT)\s*$/i.test((x.innerText || '').trim()) && x.getBoundingClientRect().height > 0 && !x.closest('#rib-coach-v119')); if (b) b.click() })
    await page.waitForTimeout(400)
    await page.evaluate(() => { try { window.finishSeasonGames && window.finishSeasonGames() } catch (e) {} }); await page.waitForTimeout(700)
  }
  // the offseason body screen and the coach's debrief come up over the card; look under them
  await page.evaluate(() => { document.getElementById('growV132')?.remove(); document.querySelector('.rib-coach')?.remove(); document.body.classList.remove('rib-coach-open') })
  await page.waitForTimeout(700)
  return page.evaluate(() => window.__GRIDIRON_AUDIT__.getState().view)
}
if (await toResult() === 'result') await tabs('result')
console.log('page errors:', errs.length ? '\n' + errs.join('\n') : 'none')
await browser.close()
