import { chromium } from 'playwright'
import fs from 'node:fs'

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 358, height: 768 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.goto('http://127.0.0.1:5173/menu-preview.html?menuPreview=1', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForSelector('#rib-main-menu-v2', { state: 'attached', timeout: 20000 })
await page.waitForFunction(() => document.documentElement.classList.contains('rib-assets-ready'), null, { timeout: 30000 })
await page.waitForTimeout(300)
await page.screenshot({ path: 'menu-preview.png', fullPage: true })
const metrics = await page.evaluate(() => ({
  viewport: { width: innerWidth, height: innerHeight },
  pageHeight: document.documentElement.scrollHeight,
  menu: document.querySelector('#rib-main-menu-v2')?.getBoundingClientRect().toJSON(),
  hero: document.querySelector('.rib-menu-hero')?.getBoundingClientRect().toJSON(),
  career: document.querySelector('.rib-career-card')?.getBoundingClientRect().toJSON(),
  legacy: document.querySelector('.rib-legacy-card')?.getBoundingClientRect().toJSON(),
  assets: window.__RIB_MENU_ASSETS,
}))
fs.writeFileSync('menu-preview-metrics.json', JSON.stringify({ metrics, errors }, null, 2))
console.log(JSON.stringify({ metrics, errors }, null, 2))
await browser.close()
if (errors.length || !metrics.assets?.ready) process.exitCode = 1
