// v137 B — look at the loose money: thickness, a coin in hand, a tilted phone, the restock.
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.goto('http://localhost:5173/?stayStale&noFilmV114', { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(2000)
await page.evaluate(() => { try { window.__splashDoneV94() } catch (e) {} })
await page.waitForFunction(() => { const s = document.getElementById('splash'); if (!s) return true
  const c = getComputedStyle(s); return c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0 }, null, { timeout: 25000 }).catch(() => {})
for (let i = 0; i < 4; i++) { const h = await page.evaluate(() => { const b = [...document.querySelectorAll('.onboard button,.onboard [onclick]')].find(e => e.getBoundingClientRect().height > 0); if (b) { b.click(); return true } return false }); if (!h) break; await page.waitForTimeout(220) }
await page.evaluate(() => { document.querySelectorAll('.onboard').forEach(e => e.remove())
  const o = window.__GRIDIRON_AUDIT__.getState(); o.pp = Number(2400000); o.prestige = 40; window.go('shop')
  try { localStorage.setItem('rib.vaultDoor.v137', '1'); localStorage.setItem('rib.coachTour.v119', '0') } catch (e) {} })
await page.evaluate(() => window.__RIB_VAULT_BRIDGE.open({ skipDoor: true }))
await page.waitForTimeout(1400)
await page.screenshot({ path: '_phys_rest.png' })

// a coin in hand
const box = await page.evaluate(() => { const s = window.__RIB_VAULT_DEV.scene(), h = s.hoardBox(); return { x: (h.x0 + h.x1) / 2, y: h.y0 + (h.y1 - h.y0) * 0.30 } })
await page.mouse.move(box.x, box.y); await page.mouse.down()
for (let i = 1; i <= 14; i++) { await page.mouse.move(box.x + i * 6, box.y - i * 9); await page.waitForTimeout(12) }
await page.screenshot({ path: '_phys_drag.png' })
console.log('dragging:', JSON.stringify(await page.evaluate(() => window.__RIB_VAULT_DEV.state())))
await page.mouse.up(); await page.waitForTimeout(700)
await page.screenshot({ path: '_phys_dropped.png' })

// the phone tipped over — driven through the REAL sensor handler, as a hand would
await page.evaluate(async () => {
  const V = window.__RIB_VAULT_DEV
  V.tiltArm()
  for (let i = 0; i < 12; i++) { V.tiltRaw(78, 1); await new Promise(r => setTimeout(r, 40)) }
})
await page.screenshot({ path: '_phys_level.png' })
for (let i = 0; i < 26; i++) {
  await page.evaluate(() => window.__RIB_VAULT_DEV.tiltRaw(78, -26))
  await page.waitForTimeout(40)
}
await page.screenshot({ path: '_phys_tilt.png' })
console.log('tilted:', JSON.stringify(await page.evaluate(() => window.__RIB_VAULT_DEV.state())))

// restock
await page.evaluate(() => { window.__RIB_VAULT_DEV.tilt(0, 0); window.__RIB_VAULT_DEV.restock() })
await page.waitForTimeout(500); await page.screenshot({ path: '_phys_restocking.png' })
await page.waitForTimeout(1400); await page.screenshot({ path: '_phys_restocked.png' })
console.log('restocked:', JSON.stringify(await page.evaluate(() => window.__RIB_VAULT_DEV.state())))
console.log('page errors:', errs.length ? errs.slice(0, 5) : 'none')
await browser.close()
