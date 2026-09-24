import { chromium } from 'playwright'
import fs from 'node:fs'
import { CHROME, gameUrl } from './lib/env.mjs'

const browser = await chromium.launch({ headless: true, executablePath: CHROME })
const context = await browser.newContext({
  viewport: { width: 358, height: 768 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.goto(gameUrl('menu-preview.html?menuPreview=1'), { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForSelector('#rib-main-menu-v2', { state: 'attached', timeout: 20000 })
await page.waitForFunction(() => document.documentElement.classList.contains('rib-assets-ready'), null, { timeout: 30000 })
await page.waitForTimeout(300)
await page.screenshot({ path: 'menu-preview.png', fullPage: true })
const metrics = await page.evaluate(() => ({
  viewport: { width: innerWidth, height: innerHeight },
  pageHeight: document.documentElement.scrollHeight,
  menu: document.querySelector('#rib-main-menu-v2')?.getBoundingClientRect().toJSON(),
  hero: document.querySelector('.rib9-hero')?.getBoundingClientRect().toJSON(),
  player: document.querySelector('.rib9-player')?.getBoundingClientRect().toJSON(),
  legacy: document.querySelector('.rib9-legacy')?.getBoundingClientRect().toJSON(),
  tiles: document.querySelectorAll('.rib9-tile').length,
  assets: window.__RIB_MENU_ASSETS,
}))
fs.writeFileSync('menu-preview-metrics.json', JSON.stringify({ metrics, errors }, null, 2))
console.log(JSON.stringify({ metrics, errors }, null, 2))
await browser.close()
/* v139: a FLOOR, not an exact count. This asserted exactly six tiles, was written at PR #92,
 * and has never been updated — v111 added HOW TO PLAY and v119 the COACH'S TOUR switch, so it
 * has failed on every branch since v111 for a menu that is working correctly. That is not a
 * harmless red light: this job stops at the first failing step, so steps 9 and 10 never ran,
 * and `menu-integration-check.mjs` — the part that exercises the assembled Pages output —
 * has not executed in CI since. The regression worth catching here is a menu that LOSES its
 * navigation, so the check is that the navigation is still there. */
if (errors.length || !metrics.assets?.ready || !(metrics.tiles >= 6)) process.exitCode = 1
