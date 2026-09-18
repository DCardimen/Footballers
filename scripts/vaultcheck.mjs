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

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
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

async function boot (url = 'http://localhost:5173/?stayStale&noFilmV114') {
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
ok(await page.evaluate(() => !!window.__RIB_VAULT && !!window.__RIB_VAULT_BRIDGE && !!window.__RIB_VAULT_MODEL), 'the vault, its bridge and its model are mounted')
ok(await page.evaluate(() => typeof window.vaultBuy === 'function' && typeof window.openVaultV137 === 'function'), 'the game exposes the two ways in')
ok(await page.evaluate(() => typeof window.buy === 'function' && window.__V137 && typeof window.__V137.buy === 'function'), 'and `buy` is STILL the game\'s own authoritative handler')

// ---------- 1. the model: one currency, four faces, and a deterministic hoard ----------
const model = await page.evaluate(() => {
  const M = window.__RIB_VAULT_MODEL
  const cases = [0, 1, 999, 1000, 1500, 25000, 1e6, 25e6, 1.25e9, 9.87e9]
  return cases.map(pp => ({ pp, b: M.breakdown(pp), f: +M.fullnessOf(pp).toFixed(4), t: M.tierName(pp),
    mix: M.DEN.map(d => +M.mixOf(pp)[d].toFixed(3)) }))
})
const conserved = model.every(r => r.b.bronze + r.b.silver * 1e3 + r.b.gold * 1e6 + r.b.blue * 1e9 === r.pp)
ok(conserved, 'the four faces decompose the balance EXACTLY — no PP is invented or lost', model.map(r => r.pp))
ok(model.every(r => Math.abs(r.mix.reduce((a, b) => a + b, 0) - 1) < 1e-6), 'the pile mix is a distribution')
ok(model.every((r, i) => i === 0 || r.f >= model[i - 1].f), 'more PP is never a smaller pile', model.map(r => r.f))
ok(new Set(model.map(r => r.t)).size >= 6, 'the wealth states are distinct', [...new Set(model.map(r => r.t))])
ok(model[0].t === 'Empty vault' && model[1].t !== 'Empty vault', 'any balance at all is past "Empty vault"', [model[0].t, model[1].t])
const blueAccent = model.find(r => r.pp === 1.25e9)
ok(blueAccent.mix[3] > 0 && blueAccent.mix[3] <= 0.11, 'the billion-coin blue stays a RARE accent, never the pile', blueAccent.mix)

await setPP(2500)
await openV()
await page.waitForTimeout(900)
const s0 = await st()
ok(s0.open && s0.missing.length === 0, 'the vault opens with every sprite loaded', s0.missing)
ok(s0.n > 0 && s0.n <= s0.slots, 'the hoard renders a BOUNDED number of coins', [s0.n, s0.slots])

// spatial continuity: the same balance must lay out identically, and a changed balance must
// keep every coin it already had in the same place
const cont = await page.evaluate(() => {
  const V = window.__RIB_VAULT_DEV, s = V.scene()
  const snap = n => { const o = []; for (let i = 0; i < n; i++) o.push([s.slots.slot[i].x, s.slots.slot[i].y, s.slots.slot[i].z]); return o }
  s.setBalance(2500, false); const a = snap(60), na = Math.round(s.nShown)
  s.setBalance(900000, false); const b = snap(60), nb = Math.round(s.nShown)
  s.setBalance(2500, false); const c = snap(60)
  const same = (p, q) => p.every((v, i) => v.every((n, j) => n === q[i][j]))
  return { stable: same(a, c), kept: same(a, b), grew: nb > na }
})
ok(cont.stable, 'the same balance draws the same hoard')
ok(cont.kept, 'and a changed balance does not reorganise the coins it already had')
ok(cont.grew, 'a bigger balance is a bigger hoard')

// ---------- 2. a flying coin leaves the actual pile ----------
const flight = await page.evaluate(() => {
  const V = window.__RIB_VAULT_DEV, s = V.scene()
  const h = s.hoardBox()
  const p = s.pickSurface((h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2)
  return { inBox: p.x >= h.x0 - 30 && p.x <= h.x1 + 30 && p.y >= h.y0 - 30 && p.y <= h.y1 + 40, i: p.i, n: Math.round(s.nShown) }
})
ok(flight.inBox && flight.i >= 0 && flight.i < flight.n, 'a tap detaches a REAL surface coin, not a spawn point', flight)
await closeV()

// ---------- 3. THE TRANSACTION ----------
async function fundFully (key, pp) {
  await setPP(pp)
  const before = await game()
  await openV(key)
  await page.waitForTimeout(700)
  await page.evaluate(() => window.__RIB_VAULT_DEV.skip())
  await page.waitForTimeout(500)
  const after = await game(), v = await st()
  await closeV(); await page.waitForTimeout(200)
  return { before, after, v }
}
const KEY = 'gmEye'
const price = await page.evaluate(({ KEY }) => window.__prestigeNodesV137().price(KEY), { KEY })
let r = await fundFully(KEY, 5000)
ok(r.after.pp === r.before.pp - price, 'a completed purchase debits the price ONCE and exactly', [r.before.pp, r.after.pp, price])
ok((r.after.tree[KEY] || 0) === (r.before.tree[KEY] || 0) + 1, 'and the node really went up one level')
ok(r.v.committed, 'and the vault says so')

// affordability
await setPP(3)
await openV(KEY)
await page.waitForTimeout(600)
let g0 = await game()
await page.evaluate(() => window.__RIB_VAULT_DEV.skip())
await page.waitForTimeout(400)
let g1 = await game(), v1 = await st()
ok(g1.pp === g0.pp && !v1.committed, 'SKIP with insufficient funds buys nothing and debits nothing', [g0.pp, g1.pp])
ok(g1.pp >= 0, 'PP is never negative', g1.pp)
await closeV()

// cancel: pour, then walk out
await setPP(5000)
await openV(KEY)
await page.waitForTimeout(600)
const gBefore = await game()
await pressHoard(); await page.waitForTimeout(700)
const mid = await st()
ok(mid.pending > 0, 'a hold builds a reservation', mid.pending)
ok((await game()).pp === gBefore.pp, 'and the reservation is NOT a debit — the game\'s PP has not moved')
await page.mouse.up()
await page.waitForTimeout(80)
await closeV(); await page.waitForTimeout(250)
const gAfter = await game()
ok(gAfter.pp === gBefore.pp && (gAfter.tree[KEY] || 0) === (gBefore.tree[KEY] || 0),
  'CANCELLING mid-pour leaves the currency and the upgrade untouched', [gBefore.pp, gAfter.pp])
const reopened = await openV(KEY).then(() => page.waitForTimeout(400)).then(st)
ok(reopened.pending === 0, 'and a reservation never survives the screen', reopened.pending)
await closeV()

// double-commit protection
await setPP(5000)
await openV(KEY)
await page.waitForTimeout(600)
const dBefore = await game()
const dPrice = await page.evaluate(({ KEY }) => window.__prestigeNodesV137().price(KEY), { KEY })
await page.evaluate(() => { const V = window.__RIB_VAULT_DEV; V.skip(); V.skip(); V.skip(); V.v.commit(); V.v.commit() })
await page.waitForTimeout(400)
const dAfter = await game()
ok(dAfter.pp === dBefore.pp - dPrice, 'five commits in a row still debit exactly one price', [dBefore.pp, dAfter.pp, dPrice])
ok((dAfter.tree[KEY] || 0) === (dBefore.tree[KEY] || 0) + 1, 'and grant exactly one level')
await closeV()

// rapid tapping
await setPP(5000)
await openV(KEY)
await page.waitForTimeout(600)
const tBefore = await game()
const tp = await page.evaluate(() => { const s = window.__RIB_VAULT_DEV.scene(), h = s.hoardBox(); return { x: (h.x0 + h.x1) / 2, y: (h.y0 + h.y1) / 2 } })
for (let i = 0; i < 25; i++) { await page.mouse.click(tp.x, tp.y, { delay: 4 }) }
await page.waitForTimeout(500)
const tAfter = await game(), tv = await st()
const spent = tBefore.pp - tAfter.pp
ok(spent === 0 || spent === dPrice, 'twenty-five rapid taps spend either nothing or one whole price — never a part', spent)
ok(tAfter.pp >= 0 && tv.pending >= 0, 'and nothing goes negative')
await closeV()

// a LOCKED node is never sellable through the vault
const lockedProbe = await page.evaluate(() => {
  const o = window.__GRIDIRON_AUDIT__.getState(); o.prestige = 0; o.pp = 100000; o.tree = {}
  const N = window.__prestigeNodesV137()
  const key = N.keys().find(k => !N.open(k))
  if (!key) return { skip: true }
  const before = o.pp, lv = N.level(key)
  window.__RIB_VAULT_BRIDGE.open({ key, skipDoor: true })
  return { key, before, lv }
})
if (lockedProbe.skip) ok(true, 'no locked node available to probe (skipped)')
else {
  await page.waitForTimeout(600)
  const lv = await st()
  ok(lv.target === null, 'a LOCKED node is refused at the door — the vault will not select it', lv.target)
  await page.evaluate(() => window.__RIB_VAULT_DEV.skip())
  await page.waitForTimeout(300)
  const lg = await page.evaluate(({ k }) => { const o = window.__GRIDIRON_AUDIT__.getState(); return { pp: o.pp, lv: o.tree[k] || 0 } }, { k: lockedProbe.key })
  ok(lg.pp === lockedProbe.before && lg.lv === lockedProbe.lv, 'and nothing can be spent on it', lg)
  await closeV()
}

// a MAXED node: the shop's BUY must fall through to the game, never open an empty vault
const maxed = await page.evaluate(() => {
  const o = window.__GRIDIRON_AUDIT__.getState(); o.prestige = 60; o.pp = 100000
  const N = window.__prestigeNodesV137()
  const key = N.keys().find(k => N.node(k).max >= 1 && N.open(k))
  o.tree = {}; o.tree[key] = N.node(key).max
  const before = o.pp
  window.vaultBuy(key)
  return { key, before, after: o.pp, open: window.__RIB_VAULT.isOpen() }
})
ok(!maxed.open && maxed.after === maxed.before, 'a MAXED node neither opens the vault nor costs anything', maxed)

// ---------- 4. banked PP is not spendable, and the payout mints nothing ----------
await setPP(1200, { ppBankV136: 9999 })
await openV(KEY)
await page.waitForTimeout(700)
const bank = await st()
ok(bank.balance === 1200, 'the vault\'s balance is o.pp alone — v136\'s bank is NOT in it', [bank.balance, 9999])
const bankShown = await page.evaluate(() => (document.querySelector('#ribVault .rv-sub') || {}).textContent || '')
ok(/banked/i.test(bankShown), 'and the banked points are shown as pending, outside the balance', bankShown.trim().slice(0, 80))
await closeV()

const payout = await page.evaluate(async () => {
  const o = window.__GRIDIRON_AUDIT__.getState(); o.pp = 50000
  const before = o.pp
  await window.__RIB_VAULT_BRIDGE.payout(20000)
  await new Promise(r => setTimeout(r, 1800))
  const s = window.__RIB_VAULT_DEV.state()
  return { before, after: o.pp, shown: s.balance }
})
ok(payout.after === payout.before, 'replaying the career payout creates NO PP — it only shows what the game already awarded', payout)
ok(payout.shown === payout.after, 'and the vault lands on the balance the game actually holds', [payout.shown, payout.after])
await closeV()

// ---------- 5. reload, navigation, backgrounding ----------
await setPP(5000)
await openV(KEY)
await page.waitForTimeout(500)
await pressHoard(); await page.waitForTimeout(800)
const relBefore = await game()
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2200)
const relAfter = await page.evaluate(() => { const o = window.__GRIDIRON_AUDIT__.getState(); return { pp: o.pp, tree: JSON.parse(JSON.stringify(o.tree || {})) } })
ok(relAfter.pp === relBefore.pp, 'a RELOAD mid-pour loses nothing and buys nothing — the reservation was never written', [relBefore.pp, relAfter.pp])

await boot()
await setPP(5000)
await openV(KEY)
await page.waitForTimeout(500)
await pressHoard(); await page.waitForTimeout(500)
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })
await page.waitForTimeout(400)
const bg = await st()
ok(!bg.holding, 'a backgrounded app stops pouring')
await page.mouse.up().catch(() => {})
await closeV()

// ---------- 6. reduced motion, mute, and a missing sheet ----------
await page.emulateMedia({ reducedMotion: 'reduce' })
await boot()
await setPP(900000)
await openV()
await page.waitForTimeout(900)
const rm = await page.evaluate(() => {
  const s = window.__RIB_VAULT_DEV.scene()
  s.sparks.length = 0
  for (let i = 0; i < 20; i++) s.burst(100, 100, 'gold')
  const cap = s.flyers.length
  for (let i = 0; i < 200; i++) s.launch('gold', { x: 100, y: 500 }, {})
  return { reduced: s.reduced, sparks: s.sparks.length, flyers: s.flyers.length, doorT: s.doorT, capBefore: cap }
})
ok(rm.reduced, 'reduced motion is detected')
ok(rm.sparks === 0, 'and no spark particles are emitted', rm.sparks)
ok(rm.flyers <= 18, 'and the coins in flight are held to a small pool', rm.flyers)
ok(rm.doorT === 1, 'and the door opening is skipped entirely', rm.doorT)
await closeV()
await page.emulateMedia({ reducedMotion: 'no-preference' })

const audio = await page.evaluate(() => {
  const A = window.__RIB_VAULT_AUDIO
  const was = A.on(); A.toggle(); const off = A.on(); A.toggle(); const back = A.on()
  let stored = null; try { stored = localStorage.getItem('rib.vaultMute.v137') } catch (e) {}
  return { was, off, back, stored, manifest: A.manifest().length }
})
ok(audio.off === !audio.was && audio.back === audio.was, 'the mute switch toggles', audio)
ok(audio.stored !== null, 'and it persists', audio.stored)
ok(audio.manifest >= 14, 'the audio manifest names every sound category the vault raises', audio.manifest)

// a missing sheet must degrade, not wedge
await page.route('**/vault/coin_gold_hero.webp', route => route.abort())
await page.route('**/vault/room.webp', route => route.abort())
await boot()
await setPP(500000)
const missErrs = errs.length
await openV()
await page.waitForTimeout(1400)
const miss = await st()
ok(miss.open && miss.n > 0, 'with two sheets missing the vault still opens and still draws a hoard', miss.missing)
ok(miss.missing.length === 2, 'and reports exactly which sheets it could not get', miss.missing)
ok(errs.length === missErrs, 'and throws nothing doing it (the aborted fetches are the point)',
  errs.slice(missErrs, missErrs + 3))
await closeV()
await page.unroute('**/vault/coin_gold_hero.webp')
await page.unroute('**/vault/room.webp')

// ---------- 7. the frame ----------
await boot()
await setPP(1.25e9)
await openV()
await page.waitForTimeout(1400)
const perf = await page.evaluate(() => new Promise(res => {
  const V = window.__RIB_VAULT_DEV, s = V.scene()
  V.hold(true)
  let n = 0, worst = 0, t0 = performance.now(), last = t0
  const step = now => { const dt = now - last; last = now; if (n++) worst = Math.max(worst, dt)
    if (now - t0 < 2200) requestAnimationFrame(step)
    else { V.hold(false); res({ frames: n, ms: +(now - t0).toFixed(0), fps: +(n / ((now - t0) / 1000)).toFixed(1), worst: +worst.toFixed(1), slots: s.slots.max }) } }
  requestAnimationFrame(step)
}))
console.log('frame:', JSON.stringify(perf))
ok(perf.fps >= 30, 'the vault holds a usable frame rate under a 16x pour', perf)
await closeV()
const stopped = await page.evaluate(async () => {
  const V = window.__RIB_VAULT_DEV
  const a = V.scene().frames
  await new Promise(r => setTimeout(r, 500))
  return { a, b: V.scene().frames, raf: V.v.raf }
})
ok(stopped.a === stopped.b && !stopped.raf, 'and the loop STOPS when the vault closes', stopped)

// ---------- 8. the game underneath is unchanged ----------
await boot()
const shop = await page.evaluate(() => {
  const o = window.__GRIDIRON_AUDIT__.getState(); o.pp = 5000; o.prestige = 40; o.tree = {}
  window.go('shop')
  const sc = document.getElementById('screen')
  return { items: sc.querySelectorAll('.shop-item').length,
    pp: [...sc.querySelectorAll('.shop-item .buy')].filter(b => /\d+ PP/.test(b.textContent)).length,
    vault: !!document.querySelector('#dock button[onclick*="openVaultV137"]'),
    branches: sc.querySelectorAll('.branch-tab').length }
})
ok(shop.items > 0 && shop.pp > 0, 'the prestige tree still renders its rows and its prices', shop)
ok(shop.branches >= 4, 'and its branches', shop.branches)
ok(shop.vault, 'and it offers a way into the vault that needs no upgrade selected')

console.log('\npage errors:', errs.length ? errs.slice(0, 8) : 'none')
console.log('network errors (expected 2, from the missing-sheet case):', netErrs.length)
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length, netErrors: netErrs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
