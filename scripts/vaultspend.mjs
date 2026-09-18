// v137 — drive a real spend in a real browser and photograph each stage.
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.goto('http://localhost:5173/?stayStale&noFilmV114', { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(2200)
await page.evaluate(() => { try { window.__splashDoneV94() } catch (e) {} })
await page.waitForFunction(() => { const s = document.getElementById('splash')
  if (!s) return true; const c = getComputedStyle(s)
  return c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0 }, null, { timeout: 25000 }).catch(() => {})
await page.waitForTimeout(700)
for (let i = 0; i < 4; i++) {
  const hit = await page.evaluate(() => { const b = [...document.querySelectorAll('.onboard button,.onboard [onclick]')].find(e => e.getBoundingClientRect().height > 0); if (b) { b.click(); return true } return false })
  if (!hit) break; await page.waitForTimeout(250)
}
await page.evaluate(() => { document.querySelectorAll('.onboard').forEach(e => e.remove())
  try { localStorage.setItem('rib.vaultDoor.v137', '1'); localStorage.setItem('rib.coachTour.v119', '0') } catch (e) {} })

const KEY = process.env.KEY || 'gmEye'
const setup = await page.evaluate(({ KEY }) => {
  const o = window.__GRIDIRON_AUDIT__.getState()
  o.pp = 60000; o.prestige = 40; o.tree = {}; o.view = 'shop'
  window.render()
  const N = window.__prestigeNodesV137()
  return { pp: o.pp, price: N.price(KEY), level: N.level(KEY), open: N.open(KEY), name: N.node(KEY).name }
}, { KEY })
console.log('setup', JSON.stringify(setup))

await page.evaluate(({ KEY }) => window.__RIB_VAULT_BRIDGE.open({ key: KEY, skipDoor: true }), { KEY })
await page.waitForTimeout(1200)
await page.screenshot({ path: '_vault_selected.png' })
console.log('selected', JSON.stringify(await page.evaluate(() => window.__RIB_VAULT_DEV.state())))

// one tap
const box = await page.evaluate(() => { const s = window.__RIB_VAULT_DEV.scene(); const h = s.hoardBox(); return { x: (h.x0 + h.x1) / 2, y: (h.y0 + h.y1) / 2 } })
await page.mouse.move(box.x, box.y)
await page.mouse.down()
await page.waitForTimeout(160)
await page.screenshot({ path: '_vault_tap.png' })
console.log('after tap', JSON.stringify(await page.evaluate(() => window.__RIB_VAULT_DEV.state())))

// hold through the stages
for (const [ms, name] of [[500, 'x2'], [700, 'x4'], [700, 'x8'], [900, 'x16']]) {
  await page.waitForTimeout(ms)
  await page.screenshot({ path: `_vault_hold_${name}.png` })
  const st = await page.evaluate(() => window.__RIB_VAULT_DEV.state())
  console.log(name.padEnd(4), 'pending', st.pending, 'stage', st.stage, 'flyers', st.flyers, 'coins', st.n)
}
await page.mouse.up()
await page.waitForTimeout(900)
await page.screenshot({ path: '_vault_done.png' })
const fin = await page.evaluate(() => {
  const o = window.__GRIDIRON_AUDIT__.getState()
  return { vault: window.__RIB_VAULT_DEV.state(), pp: o.pp, tree: o.tree }
})
console.log('final', JSON.stringify(fin))
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none')
await browser.close()
