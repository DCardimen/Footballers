import { chromium } from 'playwright'
/* v89 menu QA: screenshots the LIVE main menu at a set of sizes. CAREER=1 starts a career and
 * plays three silent weeks first so the card, season row and latest game are populated.
 *   SIZES=390x844,900x1100 OUT=/tmp/menu CAREER=1 node scripts/menushot.mjs */
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const out = process.env.OUT || 'menu_now'
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
for (const [w, h] of (process.env.SIZES || '390x844,430x932,900x1100').split(',').map(x => x.split('x').map(Number))) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 700, hasTouch: true })
  const page = await context.newPage()
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
  await page.goto(process.env.URL || 'http://127.0.0.1:5173/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('#rib-main-menu-v2', { state: 'attached', timeout: 20000 })
  await page.waitForFunction(() => document.documentElement.classList.contains('rib-assets-ready'), null, { timeout: 30000 }).catch(() => {})
  if (process.env.CAREER) {
    const click = async (t) => { const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis); const el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t))); if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false }, { t, visSrc: vis }); await page.waitForTimeout(700); return r }
    await page.waitForTimeout(800); await click('START NEW CAREER')
    for (let i = 0; i < 8; i++) {
      const done = await page.evaluate(({ visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
        for (const want of ['START YOUR LEGACY', 'Lock In Personality']) { const b = els.find(e => txt(e).includes(want)); if (b) { b.click(); return false } }
        const card = els.find(e => e.classList.contains('pos-card') || /^[A-Z]{1,2} /.test(txt(e))); if (card) { card.click(); return false } return true }, { visSrc: vis })
      await page.waitForTimeout(450); if (done) break
    }
    await click('PLAY 8-GAME SEASON'); await click('Balanced Program')
    await page.evaluate(async () => { document.getElementById('growthV42')?.remove(); const pl = window.S.player; const c = pl.conditionV11 || {}; c.fatigue = 10; c.injury = null
      for (let i = 0; i < 3; i++) { const wk = pl.weekResults.find(x => !x.played); if (wk) { window.__silentWeekV85(pl, wk); await new Promise(r => setTimeout(r, 200)) } }
      window.go('menu') })
    await page.waitForSelector('#rib-main-menu-v2 .rib9-shell', { state: 'visible', timeout: 12000 })
  }
  await page.waitForTimeout(1600)
  await page.screenshot({ path: `${out}_${w}x${h}.png` })
  await page.evaluate(() => document.querySelector('#rib-main-menu-v2').scrollTo(0, 1e6)); await page.waitForTimeout(400)
  await page.screenshot({ path: `${out}_${w}x${h}_bottom.png` })
  const m = await page.evaluate(() => { const r = s => { const el = document.querySelector(s); return el ? Math.round(el.getBoundingClientRect().height) : null }; const menu = document.querySelector('#rib-main-menu-v2')
    return { hero: r('.rib9-hero'), player: r('.rib9-player'), continueCard: r('.rib9-continue'), tiles: document.querySelectorAll('.rib9-tile').length, dots: document.querySelectorAll('.rib9-dot').length, scroll: menu.scrollHeight, ready: document.documentElement.classList.contains('rib-assets-ready') } })
  console.log(w + 'x' + h, JSON.stringify(m), errors.length ? 'ERRORS ' + errors.join(' | ') : 'no errors')
  await context.close()
}
await browser.close()
