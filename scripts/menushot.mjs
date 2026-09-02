import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const out = process.env.OUT || 'menu_now'
for (const [w, h] of (process.env.SIZES || '390x844,430x932').split(',').map(x => x.split('x').map(Number))) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
  await page.goto(process.env.URL || 'http://127.0.0.1:5173/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('#rib-main-menu-v2', { state: 'attached', timeout: 20000 })
  await page.waitForFunction(() => document.documentElement.classList.contains('rib-assets-ready'), null, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${out}_${w}x${h}.png` })
  const m = await page.evaluate(() => { const r = s => { const el = document.querySelector(s); return el ? Math.round(el.getBoundingClientRect().height) : null }
    return { hero: r('.rib-menu-hero'), career: r('.rib-career-card'), legacy: r('.rib-legacy-card'), cta: r('.rib-primary-button'), shellScroll: document.querySelector('.rib-menu-shell')?.scrollHeight, ready: document.documentElement.classList.contains('rib-assets-ready') } })
  console.log(w + 'x' + h, JSON.stringify(m), errors.length ? 'ERRORS ' + errors.join(' | ') : 'no errors')
  await context.close()
}
await browser.close()
