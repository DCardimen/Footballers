import { chromium } from 'playwright'
import fs from 'node:fs'

const integrationUrl = process.env.MENU_INTEGRATION_URL || 'http://127.0.0.1:5173/menu-integration.html'
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
  iconAsset: getComputedStyle(document.querySelector('.rib-goals-button .rib-nav-icon')).backgroundImage,
  menuHeight: Math.round(document.querySelector('#rib-main-menu-v2')?.getBoundingClientRect().height || 0),
  assetsReady: document.documentElement.classList.contains('rib-assets-ready'),
  assetsFailed: document.documentElement.classList.contains('rib-assets-failed'),
}))

const routeAndReturn = async (selector) => {
  await page.locator(selector).click()
  await page.waitForFunction(() => !document.querySelector('#rib-main-menu-v2'), null, { timeout: 10000 })
  const routed = await page.evaluate(() => ({
    visibleScreen: [...document.querySelectorAll('#app .screen')].find(el => !el.classList.contains('hidden'))?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 220),
  }))
  await page.evaluate(() => {
    const logo = document.querySelector('#app .logo')
    if (!logo?.onclick) throw new Error('Main-menu logo handler is unavailable')
    logo.onclick.call(logo, new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  })
  await page.waitForSelector('#rib-main-menu-v2', { state: 'visible', timeout: 12000 })
  await page.waitForTimeout(400)
  return { routed, menu: await menuSnapshot() }
}

try {
  await page.goto(integrationUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('#rib-main-menu-v2', { state: 'attached', timeout: 20000 })
  await page.waitForFunction(() => document.documentElement.classList.contains('rib-assets-ready'), null, { timeout: 30000 })
  await page.waitForSelector('#rib-main-menu-v2', { state: 'visible', timeout: 10000 })
  await page.waitForTimeout(500)

  const before = await menuSnapshot()
  const assetsApplied = before.assetsReady && !before.assetsFailed && [before.heroAsset, before.panelAsset, before.iconAsset].every((value) => value.includes('blob:'))
  const firstReturn = await routeAndReturn('.rib-goals-button')
  const secondReturn = await routeAndReturn('.rib-hall-button')

  const result = {
    integrationUrl,
    before,
    firstReturn,
    secondReturn,
    assetsApplied,
    menuRestored: !!firstReturn.menu.text && !!secondReturn.menu.text,
    sameMainMenu: before.text === firstReturn.menu.text && before.text === secondReturn.menu.text,
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
    assets: window.__RIB_MENU_ASSETS,
    goType: typeof window.go,
    goSource: typeof window.go === 'function' ? String(window.go).slice(0, 1600) : '',
    controls: [...document.querySelectorAll('#app button, #app a, #app [role="button"]')].map(el => ({ text: (el.textContent || '').replace(/\s+/g, ' ').trim(), cls: el.className, hidden: el.hidden, bridge: el.dataset.ribBridge })).slice(0, 100),
    logo: (() => { const el = document.querySelector('#app .logo'); return el ? { text: el.textContent, onclick: el.getAttribute('onclick'), handler: String(el.onclick || '').slice(0, 500) } : null })(),
  })).catch(() => ({}))
  fs.writeFileSync('menu-integration-diagnostics.json', JSON.stringify({ error: String(error), integrationUrl, diagnostics, errors, failedRequests }, null, 2))
  await page.screenshot({ path: 'menu-integration-failure.png', fullPage: true }).catch(() => {})
  console.error(JSON.stringify({ error: String(error), integrationUrl, diagnostics, errors, failedRequests }, null, 2))
  process.exitCode = 1
}

await browser.close()
