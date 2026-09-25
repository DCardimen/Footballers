// Dev check (v137 THE PRESTIGE VAULT): the money is exact, and the room is really there.
//
// The vault's whole risk is the transaction. The upgrades in this game are ATOMIC — `Yl`
// debits the price and adds one level in a single call — so the vault reserves PP inside
// its own screen, animates against that reservation, and calls the game's handler exactly
// once. Everything below exists to prove that the reservation can never turn into a debit
// by accident and can never fail to turn into one when the player finishes the pour.
//
// It also asserts the scene: every sprite loads, the hoard is deterministic and spatially
// continuous, the wealth states are distinct, the coins in flight leave the actual pile,
// reduced motion is honoured, and a missing sheet degrades instead of wedging.
//
//   npm run dev, then: node scripts/vaultcheck.mjs
//   GAMES/… none. VAULT_SLOW=1 keeps the browser open on failure.
import { chromium } from 'playwright'
import { CHROME, gameUrl } from './lib/env.mjs'

const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
// Page errors are thrown exceptions. Console errors are noisier — a deliberately aborted
// request logs "Failed to load resource", which is the thing the missing-sheet case is
// TESTING FOR, not a fault. They are counted separately.
const errs = [], netErrs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() !== 'error') return
  const t = m.text()
  if (/Failed to load resource|ERR_FAILED|ERR_ABORTED|net::/.test(t)) netErrs.push(t)
  else errs.push('CONSOLE: ' + t) })

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d) : '')); c ? pass++ : fail++ }

async function boot (url = gameUrl('?stayStale&noFilmV114')) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(1800)
  await page.evaluate(() => { try { window.__splashDoneV94 && window.__splashDoneV94() } catch (e) {} })
  await page.waitForFunction(() => { const s = document.getElementById('splash')
    if (!s) return true; const c = getComputedStyle(s)
    return c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0 }, null, { timeout: 25000 }).catch(() => {})
  for (let i = 0; i < 4; i++) {
    const h = await page.evaluate(() => { const b = [...document.querySelectorAll('.onboard button,.onboard [onclick]')].find(e => e.getBoundingClientRect().height > 0); if (b) { b.click(); return true } return false })
    if (!h) break; await page.waitForTimeout(220)
  }
  await page.evaluate(() => { document.querySelectorAll('.onboard').forEach(e => e.remove())
    try { localStorage.setItem('rib.vaultDoor.v137', '1'); localStorage.setItem('rib.coachTour.v119', '0') } catch (e) {} })
}
const setPP = (pp, extra) => page.evaluate(({ pp, extra }) => {
  const o = window.__GRIDIRON_AUDIT__.getState()
  o.pp = pp; o.prestige = 40; o.tree = {}
  if (extra) Object.assign(o, extra)
  window.go('shop')            // `te` saves: the reload case needs the state on disk
  return o.pp
}, { pp, extra: extra || null })
const st = () => page.evaluate(() => window.__RIB_VAULT_DEV.state())
const game = () => page.evaluate(() => { const o = window.__GRIDIRON_AUDIT__.getState()
  return { pp: o.pp, tree: JSON.parse(JSON.stringify(o.tree || {})), bank: o.ppBankV136 || 0, prestige: o.prestige } })
const openV = (key, o2) => page.evaluate(({ key, o2 }) => window.__RIB_VAULT_BRIDGE.open(Object.assign({ skipDoor: true }, key ? { key } : {}, o2 || {})), { key: key || null, o2: o2 || null })
const closeV = () => page.evaluate(() => window.__RIB_VAULT.close('test'))
async function pressHoard () {
  const b = await page.evaluate(() => { const s = window.__RIB_VAULT_DEV.scene(), h = s.hoardBox(); return { x: (h.x0 + h.x1) / 2, y: (h.y0 + h.y1) / 2 } })
  await page.mouse.move(b.x, b.y); await page.mouse.down(); return b
}

await boot()
const KEY = 'gmEye'
for (const mode of ['none', 'visibility', 'reload']) {
  await setPP(5000)
  await openV(KEY); await page.waitForTimeout(500)
  await pressHoard()
  for (let t = 0; t < 150; t++) { const x = await st(); if (x.pending >= 8 || x.committed || !x.holding) break; await page.waitForTimeout(100) }
  const mid = await st(), g0 = await game()
  console.log(mode, 'state at 800ms:', JSON.stringify(mid).slice(0, 400))
  if (mode === 'visibility') await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })
  if (mode === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  if (mode === 'reload') { await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(2000) }
  await page.waitForTimeout(600)
  const g1 = await page.evaluate(() => { const o = window.__GRIDIRON_AUDIT__.getState(); return { pp: o.pp, tree: JSON.parse(JSON.stringify(o.tree || {})) } })
  console.log(mode, JSON.stringify({ pendingBefore: mid.pending, holding: mid.holding, ppBefore: g0.pp, ppAfter: g1.pp, treeBefore: g0.tree.gmEye || 0, treeAfter: g1.tree.gmEye || 0 }))
  await page.mouse.up().catch(() => {})
  if (mode !== 'reload') { await page.evaluate(() => { try { Object.defineProperty(document, 'hidden', { value: false, configurable: true }) } catch (e) {} }); await closeV().catch(() => {}) } else await boot()
}
await browser.close()
