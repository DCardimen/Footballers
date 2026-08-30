import { chromium } from 'playwright'
import fs from 'node:fs'

const integrationUrl = process.env.MENU_INTEGRATION_URL || 'http://127.0.0.1:5173/index.html'
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium' })
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
  // ---- v74 MENU POLISH: the structural claims, at three window heights ----
  // The menu used to lay out to 1045px inside a 900px window while both <html> and
  // the menu root carried overflow:hidden, so the bottom row of buttons could not be
  // reached at all; and where it DID fit it left a dead black band (92px at 390x844).
  // So: every control reachable, nothing clipped, no dead band, at short and tall.
  const fit = []
  for (const [w, h] of [[358, 768], [390, 844], [520, 900], [430, 1180]]) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(360)
    fit.push(await page.evaluate(({ w, h }) => {
      const shell = document.querySelector('.rib-menu-shell')
      const last = document.querySelector('.rib-bottom-grid')
      const lastBottom = Math.round(last.getBoundingClientRect().bottom)
      const scrollable = shell.scrollHeight > shell.clientHeight + 1
      // reachable = visible without scrolling, OR the shell can actually scroll to it
      const reachable = lastBottom <= h + 1 || scrollable
      // dead band = shell space below the last control that nothing occupies
      const dead = Math.max(0, h - lastBottom)
      const hero = Math.round(document.querySelector('.rib-menu-hero').getBoundingClientRect().height)
      return { size: w + 'x' + h, lastBottom, reachable, scrollable, dead, hero }
    }, { w, h }))
  }
  await page.setViewportSize({ width: 358, height: 768 })
  await page.waitForTimeout(300)
  const chrome = await page.evaluate(() => ({
    hudChips: document.querySelectorAll('.rib-hud-chip').length,
    hudLabels: [...document.querySelectorAll('.rib-hud-chip small')].map(e => e.textContent.trim()),
    oldPills: [...document.querySelectorAll('.rib-hud-pill, .rib-hud-coin, .rib-hud-value')]
      .filter(e => getComputedStyle(e).display !== 'none').length,
    legacyIcons: [...document.querySelectorAll('.rib-legacy-stat')].filter(t => {
      const i = t.querySelector('i'); if (!i) return false
      const cs = getComputedStyle(i)
      return cs.backgroundImage !== 'none' || !!i.querySelector('svg:not([style*="display: none"])')
    }).length,
    legacyTiles: document.querySelectorAll('.rib-legacy-stat').length,
    cog: !!document.querySelector('.rib-hud-cog[data-rib-action="settings"]'),
  }))
  result.v74 = { fit, chrome }
  const bad = []
  for (const f of fit) {
    if (!f.reachable) bad.push(`${f.size}: the bottom row is off-screen and the shell will not scroll`)
    if (f.dead > 60) bad.push(`${f.size}: ${f.dead}px of dead band under the last control`)
  }
  if (chrome.hudChips !== 2) bad.push(`the HUD should carry two labelled chips, found ${chrome.hudChips}`)
  if (chrome.oldPills) bad.push(`${chrome.oldPills} of the unlabelled pills the chips replace are still visible`)
  if (!chrome.cog) bad.push('the HUD settings control is missing')
  if (chrome.legacyIcons !== chrome.legacyTiles) bad.push(`${chrome.legacyTiles - chrome.legacyIcons} legacy tiles have no icon`)
  result.v74.failures = bad
  console.log(JSON.stringify(result, null, 2))
  if (bad.length) console.error('v74 FAILURES:\n  ' + bad.join('\n  '))
  if (!assetsApplied || !result.menuRestored || !result.sameMainMenu || errors.length || failedRequests.length || bad.length) process.exitCode = 1
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
