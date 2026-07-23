import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 358, height: 768 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.addInitScript(() => {
  setInterval(() => {
    try { if (window.o) window.o.tutorialSeen = true } catch {}
    document.querySelector('.onboard')?.remove()
  }, 60)
})
await page.goto('http://127.0.0.1:5173/menu-integration.html', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForSelector('#rib-main-menu-v2', { state: 'visible', timeout: 20000 })
const before = await page.evaluate(() => ({
  menuVisible: !!document.querySelector('#rib-main-menu-v2'),
  primary: document.querySelector('.rib-primary-button')?.textContent?.replace(/\s+/g, ' ').trim(),
  originalVisibleScreen: [...document.querySelectorAll('#app .screen')].find(el => !el.classList.contains('hidden'))?.textContent?.slice(0, 120),
}))
await page.locator('.rib-primary-button').click()
await page.waitForFunction(() => !document.querySelector('#rib-main-menu-v2'), null, { timeout: 10000 })
const after = await page.evaluate(() => ({
  menuVisible: !!document.querySelector('#rib-main-menu-v2'),
  view: window.o?.view,
  visibleScreen: [...document.querySelectorAll('#app .screen')].find(el => !el.classList.contains('hidden'))?.textContent?.slice(0, 160),
}))
console.log(JSON.stringify({ before, after, errors }, null, 2))
await browser.close()
if (!before.menuVisible || after.menuVisible || errors.length) process.exitCode = 1
