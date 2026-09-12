// scratch: element screenshots of the menu kit with vivid forced colours (red primary / cyan secondary)
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const out = process.env.OUT || 'kit'
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
for (const [w, h] of (process.env.SIZES || '430x932,900x1100').split(',').map(x => x.split('x').map(Number))) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: w < 700, hasTouch: w < 700 })
  const page = await context.newPage()
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
  await page.goto('http://127.0.0.1:5173/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('#rib-main-menu-v2', { state: 'attached', timeout: 20000 })
  await page.waitForFunction(() => document.documentElement.classList.contains('rib-assets-ready'), null, { timeout: 30000 }).catch(() => {})
  const click = async (t) => { const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis); const el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t))); if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false }, { t, visSrc: vis }); await page.waitForTimeout(700); return r }
  await page.waitForTimeout(800); await click('START NEW CAREER')
  for (let i = 0; i < 8; i++) {
    const done = await page.evaluate(({ visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
      for (const want of ['START YOUR LEGACY', 'Lock In Personality']) { const b = els.find(e => txt(e).includes(want)); if (b) { b.click(); return false } }
      const card = els.find(e => e.classList.contains('pos-card') || /^[A-Z]{1,2} /.test(txt(e))); if (card) { card.click(); return false } return true }, { visSrc: vis })
    await page.waitForTimeout(450); if (done) break
  }
  await click('PLAY 8-GAME SEASON'); await click('Balanced Program')
  const colors = (process.env.COLORS || '#e01818,#18c8e0').split(',')
  await page.evaluate((colors) => { document.getElementById('growthV42')?.remove()
    const feed = window.__RIB_MENU_DATA_V89; window.__RIB_MENU_DATA_V89 = () => { const d = feed(); d.team.colors = colors; return d }
    window.go('menu') }, colors)
  await page.waitForSelector('#rib-main-menu-v2 .rib9-shell', { state: 'visible', timeout: 12000 })
  await page.waitForFunction(() => document.documentElement.classList.contains('rib-assets-ready'), null, { timeout: 30000 }).catch(() => {})
  await page.addStyleTag({ content: '#rib-main-menu-v2 *, #rib-main-menu-v2 *::before, #rib-main-menu-v2 *::after { animation: none !important; transition: none !important; } .rib9-hero-fx { display: none !important }' })
  await page.waitForTimeout(1200)
  for (const [name, sel] of [['hero', '.rib9-hero'], ['card', '.rib9-continue'], ['portrait', '.rib9-portrait']]) {
    const el = await page.$(sel); if (!el) { console.log('missing', sel); continue }
    await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(500)
    await el.screenshot({ path: `${out}_${name}_${w}.png` })
  }
  console.log(w + 'x' + h, errors.length ? 'ERRORS ' + errors.join(' | ') : 'no errors')
  await context.close()
}
await browser.close()
