// v137 — the opening, and the payout. Photographs both sequences.
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
for (let i = 0; i < 4; i++) { const h = await page.evaluate(() => { const b = [...document.querySelectorAll('.onboard button,.onboard [onclick]')].find(e => e.getBoundingClientRect().height > 0); if (b) { b.click(); return true } return false }); if (!h) break; await page.waitForTimeout(240) }
await page.evaluate(() => { document.querySelectorAll('.onboard').forEach(e => e.remove())
  try { localStorage.removeItem('rib.vaultDoor.v137'); localStorage.setItem('rib.coachTour.v119', '0') } catch (e) {} })
await page.evaluate(() => { const o = window.__GRIDIRON_AUDIT__.getState(); o.pp = 240000; o.prestige = 40; o.view = 'shop'; window.render() })

// --- the opening. A screenshot costs a few hundred ms, so the cue points are FROZEN
// rather than sampled, or the sequence is over before the camera gets there. ---
await page.evaluate(() => window.__RIB_VAULT_BRIDGE.open({}))
await page.waitForTimeout(400)
for (const t of [0.05, 0.22, 0.38, 0.55, 0.70, 0.86, 1.0]) {
  await page.evaluate((t) => {
    const V = window.__RIB_VAULT_DEV
    V.v.doorTick = null                       // hold the sequence where we want it
    V.scene().doorT = t
    V.v.root.classList.toggle('opening', t < 0.74)
  }, t)
  await page.waitForTimeout(220)
  await page.screenshot({ path: `_vault_door_${t.toFixed(2)}.png` })
  console.log('doorT', t.toFixed(2))
}
await page.evaluate(() => { window.__RIB_VAULT_DEV.v.root.classList.remove('opening') })
await page.evaluate(() => window.__RIB_VAULT.close('door'))
await page.waitForTimeout(300)

// --- the payout: the game has already awarded; this only SHOWS it ---
const before = await page.evaluate(() => window.__GRIDIRON_AUDIT__.getState().pp)
await page.evaluate(() => window.__RIB_VAULT_BRIDGE.payout(160000))
await page.waitForTimeout(320); await page.screenshot({ path: '_vault_payout_a.png' })
await page.waitForTimeout(600); await page.screenshot({ path: '_vault_payout_b.png' })
await page.waitForTimeout(900); await page.screenshot({ path: '_vault_payout_c.png' })
const after = await page.evaluate(() => ({ pp: window.__GRIDIRON_AUDIT__.getState().pp, v: window.__RIB_VAULT_DEV.state() }))
console.log('payout: game pp before', before, 'after', after.pp, '(must be identical)')
console.log('vault shows', after.v.balance, 'coins', after.v.n)
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none')
await browser.close()
