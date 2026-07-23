import { chromium } from 'playwright'
import fs from 'node:fs'

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 358, height: 768 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await context.newPage()
const errors = []
const failedRequests = []
page.on('pageerror', error => errors.push(error.message))
page.on('requestfailed', request => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText || 'failed'}`))
await page.addInitScript(() => {
  setInterval(() => {
    try { if (window.o) window.o.tutorialSeen = true } catch {}
    document.querySelector('.onboard')?.remove()
  }, 60)
})

const menuSnapshot = () => page.evaluate(() => ({
  text: document.querySelector('#rib-main-menu-v2')?.innerText?.replace(/\s+/g, ' ').trim(),
  heroAsset: getComputedStyle(document.querySelector('.rib-menu-hero')).backgroundImage,
  panelAsset: getComputedStyle(document.querySelector('.rib-career-card')).backgroundImage,
  iconAsset: getComputedStyle(document.querySelector('.rib-prestige-button .rib-nav-icon')).backgroundImage,
  menuHeight: Math.round(document.querySelector('#rib-main-menu-v2')?.getBoundingClientRect().height || 0),
}))

const returnHome = async () => {
  const logo = page.locator('#app .logo').first()
  if (await logo.count()) {
    await logo.click({ force: true })
  } else {
    const fallback = page.locator('#app button, #app [role="button"], #app a').filter({ hasText: /MAIN MENU|HOME|RUNNING IT BACK/i }).first()
    await fallback.click({ force: true })
  }
  await page.waitForSelector('#rib-main-menu-v2', { state: 'visible', timeout: 12000 })
}

try {
  await page.goto('http://127.0.0.1:5173/menu-integration.html', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('#rib-main-menu-v2', { state: 'visible', timeout: 20000 })
  await page.waitForTimeout(800)

  const before = await menuSnapshot()
  const assetsApplied = [
    'a_clean_high_resolution_game_ui_asset_sheet_on_a_1_batch_1.png',
    'a_clean_ui_graphic_assets_sprite_sheet_mockup_im_2_batch_2.png',
    'a_clean_graphic_artwork_ui_icon_sheet_on_a_trans_3_batch_3.png',
  ].every((name, index) => [before.heroAsset, before.panelAsset, before.iconAsset][index].includes(name))

  await page.locator('.rib-primary-button').click()
  await page.waitForFunction(() => !document.querySelector('#rib-main-menu-v2'), null, { timeout: 10000 })
  const routed = await page.evaluate(() => ({
    view: window.o?.view,
    visibleScreen: [...document.querySelectorAll('#app .screen')].find(el => !el.classList.contains('hidden'))?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 180),
  }))

  await returnHome()
  await page.waitForTimeout(700)
  const afterReturn = await menuSnapshot()

  await page.locator('.rib-prestige-button').click()
  await page.waitForFunction(() => !document.querySelector('#rib-main-menu-v2'), null, { timeout: 10000 })
  await returnHome()
  await page.waitForTimeout(500)
  const afterSecondReturn = await menuSnapshot()

  const result = {
    before,
    routed,
    afterReturn,
    afterSecondReturn,
    assetsApplied,
    menuRestored: !!afterReturn.text && !!afterSecondReturn.text,
    sameMainMenu: before.text === afterReturn.text && before.text === afterSecondReturn.text,
    errors,
    failedRequests,
  }
  console.log(JSON.stringify(result, null, 2))
  if (!assetsApplied || !result.menuRestored || !result.sameMainMenu || errors.length || failedRequests.length) process.exitCode = 1
} catch (error) {
  const diagnostics = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    readyState: document.readyState,
    bodyText: document.body?.innerText?.slice(0, 1200),
    bodyClasses: document.body?.className,
    appText: document.querySelector('#app')?.innerText?.slice(0, 1200),
    visibleScreens: [...document.querySelectorAll('#app .screen')].filter(el => !el.classList.contains('hidden')).map(el => ({ className: el.className, text: el.innerText.slice(0, 500) })),
    menuExists: !!document.querySelector('#rib-main-menu-v2'),
    hasHero: !!document.querySelector('#app .hero'),
    stateView: window.o?.view,
  })).catch(() => ({}))
  fs.writeFileSync('menu-integration-diagnostics.json', JSON.stringify({ error: String(error), diagnostics, errors, failedRequests }, null, 2))
  await page.screenshot({ path: 'menu-integration-failure.png', fullPage: true }).catch(() => {})
  console.error(JSON.stringify({ error: String(error), diagnostics, errors, failedRequests }, null, 2))
  process.exitCode = 1
}

await browser.close()
