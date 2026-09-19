// v137 F — look at the loose money: a coin in hand, the wake a drag ploughs, the shake a
// HOLD raises, the avalanche a lift starts, and the restock that puts it all back.
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

// lift a coin out of the heap and watch what the heap does about it
const seat = await page.evaluate(() => {
  const s = window.__RIB_VAULT_DEV.scene()
  const h = s.hoardBox()
  return { x: (h.x0 + h.x1) / 2 - 30, y: h.y0 + (h.y1 - h.y0) * 0.30 }
})
await page.mouse.move(seat.x, seat.y); await page.mouse.down()
for (let i = 1; i <= 16; i++) { await page.mouse.move(seat.x + i * 5, seat.y - i * 7); await page.waitForTimeout(14) }
await page.screenshot({ path: '_phys_lift.png' })
await page.mouse.up()
await page.waitForTimeout(180); await page.screenshot({ path: '_phys_slide_a.png' })
await page.waitForTimeout(500); await page.screenshot({ path: '_phys_slide_b.png' })
await page.waitForTimeout(900); await page.screenshot({ path: '_phys_settled.png' })
console.log('after the lift:', JSON.stringify(await page.evaluate(() => window.__RIB_VAULT_DEV.state())))

// a HOLD shakes the heap under the finger, harder as the multiplier climbs
const hold = await page.evaluate(() => {
  const s = window.__RIB_VAULT_DEV.scene(), h = s.hoardBox()
  return { x: (h.x0 + h.x1) / 2, y: h.y0 + (h.y1 - h.y0) * 0.45 }
})
await page.mouse.move(hold.x, hold.y); await page.mouse.down()
await page.waitForTimeout(700); await page.screenshot({ path: '_phys_hold_a.png' })
await page.waitForTimeout(1400); await page.screenshot({ path: '_phys_hold_b.png' })
console.log('holding:', JSON.stringify(await page.evaluate(() => window.__RIB_VAULT_DEV.state())))
await page.mouse.up(); await page.waitForTimeout(900)

// a DRAG ploughs a furrow across what it crosses
const from = await page.evaluate(() => {
  const s = window.__RIB_VAULT_DEV.scene(), h = s.hoardBox()
  return { x: h.x0 + (h.x1 - h.x0) * 0.24, y: h.y0 + (h.y1 - h.y0) * 0.40 }
})
await page.mouse.move(from.x, from.y); await page.mouse.down()
for (let i = 1; i <= 26; i++) { await page.mouse.move(from.x + i * 7, from.y + i * 1.5); await page.waitForTimeout(16) }
await page.screenshot({ path: '_phys_plough.png' })
await page.mouse.up(); await page.waitForTimeout(900)
await page.screenshot({ path: '_phys_plough_after.png' })
console.log('after the plough:', JSON.stringify(await page.evaluate(() => window.__RIB_VAULT_DEV.state())))

// restock
await page.evaluate(() => { window.__RIB_VAULT_DEV.restock() })
await page.waitForTimeout(500); await page.screenshot({ path: '_phys_restocking.png' })
await page.waitForTimeout(1400); await page.screenshot({ path: '_phys_restocked.png' })
console.log('restocked:', JSON.stringify(await page.evaluate(() => window.__RIB_VAULT_DEV.state())))
console.log('page errors:', errs.length ? errs.slice(0, 5) : 'none')
await browser.close()
