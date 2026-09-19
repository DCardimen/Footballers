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
ok(s0.n > 0 && s0.n <= s0.budget, 'the hoard renders a BOUNDED number of coins', [s0.n, s0.budget])
ok(s0.stacks / s0.piles > 0.5, 'and most of the hoard is STACKED, not a jumble of loose discs',
  [s0.stacks, s0.piles, +(s0.stacks / s0.piles).toFixed(2)])
const stackShape = await page.evaluate(() => {
  const s = window.__RIB_VAULT_DEV.scene().slots
  const k = s.slot.map(q => q.cnt)
  const tall = k.filter(v => v > 1)
  return { coins: s.coins, sum: k.reduce((a, b) => a + b, 0), slots: k.length,
    loose: k.filter(v => v === 1).length, maxK: Math.max(...k),
    avg: +(tall.reduce((a, b) => a + b, 0) / Math.max(1, tall.length)).toFixed(2),
    firstFew: k.slice(0, 8), cumOk: s.cum[s.cum.length - 1] === s.coins }
})
ok(stackShape.sum === stackShape.coins && stackShape.cumOk,
  'the running total accounts for every coin a stack stands for', stackShape)
ok(stackShape.firstFew.every(v => v === 1),
  'an almost-empty vault is loose coins on the floor, never a column of eight', stackShape.firstFew)
ok(stackShape.maxK >= 6 && stackShape.avg >= 3,
  'the columns have real height', [stackShape.maxK, stackShape.avg])

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
const prefix = await page.evaluate(() => {
  const V = window.__RIB_VAULT_DEV, s = V.scene(), M = window.__RIB_VAULT_MODEL
  const a = M.slotsFor(s.slots, 400), b = M.slotsFor(s.slots, 900)
  return { a, b, mono: b >= a, exact: s.slots.cum[a - 1] <= 400 && (a >= s.slots.cum.length || s.slots.cum[a] > 400) }
})
ok(prefix.mono && prefix.exact, 'and the slots for n coins are still a prefix, so nothing reshuffles', prefix)

// ---------- 2. a flying coin leaves the actual pile ----------
const flight = await page.evaluate(() => {
  const V = window.__RIB_VAULT_DEV, s = V.scene()
  const h = s.hoardBox()
  const p = s.pickSurface((h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2)
  return { inBox: p.x >= h.x0 - 30 && p.x <= h.x1 + 30 && p.y >= h.y0 - 30 && p.y <= h.y1 + 40, i: p.i, n: Math.round(s.nShown) }
})
ok(flight.inBox && flight.i >= 0 && flight.i < flight.n, 'a tap detaches a REAL surface coin, not a spawn point', flight)
await closeV()

// ---------- 2b. THE MONEY IS LOOSE: drag, the avalanche, weight, restock ----------
await setPP(900000)
await openV()
await page.waitForTimeout(900)

// THE PILE IS A PILE. The whole mechanic being sold is a HOARD, and a low spread reads as a
// carpet of change rather than a heap of money — so v137 E stands the mound 40% taller
// against exactly the same footprint. The peak is the one number that says so.
const shape = await page.evaluate(() => {
  const M = window.__RIB_VAULT_MODEL, s = window.__RIB_VAULT_DEV.scene()
  const h = s.hoardBox()
  return { peak: +M.MOUND.H(1).toFixed(4), r: M.MOUND.R,
    boxW: Math.round(h.x1 - h.x0), boxH: Math.round(h.y1 - h.y0) }
})
ok(shape.peak >= 0.979, 'the heap stands at least 40% higher than the pile it replaces', shape)
ok(shape.boxH > 0 && shape.boxW > 0, 'and it is a real box on the screen', shape)

const phys = await page.evaluate(async () => {
  const V = window.__RIB_VAULT_DEV, s = V.scene()
  const h = s.hoardBox(), cx = (h.x0 + h.x1) / 2, cy = (h.y0 + h.y1) / 2
  const got = V.drag(cx, cy)
  /* THE COIN IN THE HAND IS `V.v.dragging`, and it has to be asked for by name. It used to
   * be read as `Object.values(V.bodies())[0]`, which worked only while a lift woke exactly
   * one body: the map is keyed by SLOT INDEX, so `[0]` is the lowest-numbered woken slot,
   * and since v137 E a lift also shakes the coins around it — dozens of them. */
  const b = V.v.dragging
  const at0 = b ? { x: b.gx, y: b.gy } : null
  for (let i = 0; i < 12; i++) V.dragTo(cx + 70, cy - 90)
  const at1 = b ? { x: b.gx, y: b.gy } : null
  // hold it still for a moment before letting go, the way a hand that is PLACING a coin
  // does — otherwise this is a throw, and where a thrown coin ends up is the next probe
  for (let i = 0; i < 8; i++) { await new Promise(r => setTimeout(r, 30)); V.dragTo(cx + 70, cy - 90) }
  const air = b ? b.gy - s.surfaceAt(b.gx, b.gz) : 0
  const dropX = b ? b.gx : 0, dropZ = b ? b.gz : 0
  V.drop()
  await new Promise(r => setTimeout(r, 900))
  const at2 = b ? { x: b.gx, y: b.gy, sleep: b.sleep } : null
  const surf = b ? s.surfaceAt(b.gx, b.gz) : 0
  return { got, at0, at1, at2, air: +air.toFixed(3), surf: +surf.toFixed(4),
    fell: b ? +Math.abs(b.gx - dropX).toFixed(3) : 0, held: b ? b.held : null,
    moved: at0 && at1 ? Math.abs(at1.x - at0.x) > 0.02 : false,
    onHeap: b ? Math.abs(b.gy - surf) <= 0.03 : false, mass: b ? b.m : null }
})
/* v137 F: WHATEVER YOU TOUCH RESPONDS. The reported symptom was "sometimes when I go to
 * click one it's not responsive" — and it was real: picking searched a window of the slot
 * list and returned the nearest centre in it with no distance limit, so most of the hoard
 * could not be grabbed at all and a press on one of those silently moved a coin somewhere
 * else. This walks a grid over the whole hoard and asks, at every point that has a coin
 * drawn on it, whether the pick lands on a coin that actually covers that point. */
const reach = await page.evaluate(() => {
  const V = window.__RIB_VAULT_DEV, s = V.scene(), SC = window.__RIB_VAULT_SCENE
  const M = window.__RIB_VAULT_MODEL, P = SC.PILE, RISE = SC.STACK_RISE
  s.sleepAll()
  const h = s.hoardBox(), n = M.slotsFor(s.slots, Math.round(s.nShown))
  // every coin's drawn footprint, so the probe knows where the hoard actually IS
  const discs = [], p = {}
  for (let i = 0; i < n; i++) {
    const sl = s.slots.slot[i]
    s.cam.project(sl.x * P.dx, sl.y * P.dy, P.z + sl.z * P.dz, p)
    const size = p.s * sl.size
    discs.push({ i, x: p.x, yb: p.y, yt: p.y - (sl.cnt > 1 ? (sl.cnt - 1) * size * RISE : 0), size })
  }
  const covers = (d, x, y) => {
    const dx = x - d.x
    const dy = y < d.yt ? y - d.yt : (y > d.yb ? y - d.yb : 0)
    return (dx * dx) / (d.size * 0.54 * d.size * 0.54) + (dy * dy) / (d.size * 0.32 * d.size * 0.32) <= 1
  }
  let onCoin = 0, hit = 0, wrong = 0, deepHits = 0, far = 0
  for (let gx = 0; gx <= 20; gx++) for (let gy = 0; gy <= 20; gy++) {
    const x = h.x0 + (h.x1 - h.x0) * (gx / 20), y = h.y0 + (h.y1 - h.y0) * (gy / 20)
    if (!discs.some(d => covers(d, x, y))) continue
    onCoin++
    const pick = s.pickSurface(x, y)
    if (!pick.hit) { far++; continue }
    hit++
    const d = discs[pick.i]
    if (!d || !covers(d, x, y)) wrong++
    if (pick.i < (s.deepSlots || 0)) deepHits++
  }
  return { onCoin, hit, wrong, far, deepHits, deepSlots: s.deepSlots, slots: n }
})
ok(reach.onCoin > 120, 'the probe is sampling a real hoard', reach)
ok(reach.far === 0, 'EVERY point of the hoard that has a coin drawn on it picks a coin', reach)
ok(reach.wrong === 0, 'and the coin it picks is one that actually covers the point you touched', reach)
ok(reach.deepHits > 0, 'including coins in the BAKED deep layer, which could not be picked at all before', reach)

// ...and a deep coin really comes out of the bake when it is lifted
const deep = await page.evaluate(async () => {
  const V = window.__RIB_VAULT_DEV, s = V.scene()
  s.sleepAll()
  const before = s.deepKey
  let i = -1
  for (let k = 0; k < (s.deepSlots || 0); k++) { i = k; break }
  if (i < 0) return { skipped: true }
  const b = s.wake(i)
  const seq = s._deepSeq
  s.bakeDeep(Math.max(0, Math.round(s.nShown) - 200))
  const after = s.deepKey
  s.sleepAll()
  return { woke: !!b, rebaked: before !== after, seq: seq > 0 }
})
ok(deep.skipped || (deep.woke && deep.seq && deep.rebaked),
  'lifting a coin out of the baked layer forces that layer to be repainted without it', deep)

ok(phys.got && phys.moved, 'a coin can be PICKED UP and dragged off the heap', phys)
ok(phys.air > 0.1, 'and it is really held clear of the heap while the hand has it', phys.air)
ok(!phys.held && phys.onHeap, 'and when it is PLACED it falls and comes to rest on the heap, not through it', phys)
ok(phys.fell < 0.12, 'and it stays where it was put — placing a coin is not throwing one', phys)
ok(phys.at2 && phys.at2.sleep, 'and then it goes to sleep, so a settled hoard costs nothing', phys.at2)

/* A THROWN COIN ONCE LEFT THE ROOM. `fling` was a per-EVENT displacement used as a per-
 * MILLISECOND velocity, so a coin left the hand at the pointer's sample rate times its real
 * speed — and nothing clamped the vertical, so it went straight up and out. */
const thrown = await page.evaluate(async () => {
  const V = window.__RIB_VAULT_DEV, s = V.scene()
  s.sleepAll()
  const h = s.hoardBox(), cx = (h.x0 + h.x1) / 2, cy = (h.y0 + h.y1) / 2
  V.drag(cx, cy)
  const b = V.v.dragging                   // the coin in the hand, by name (see above)
  // a hard flick: eight samples, ~8ms apart, across a third of the screen
  for (let i = 1; i <= 8; i++) { V.dragTo(cx + i * 22, cy - i * 16); await new Promise(r => setTimeout(r, 8)) }
  V.drop()
  const launch = { vx: b.vx, vy: b.vy, vz: b.vz }
  let maxY = b.gy, escaped = false
  for (let t = 0; t < 260; t++) {
    s.stepBodies(16)
    maxY = Math.max(maxY, b.gy)
    // the room is sized to the hoard standing in it, so ask the scene where its walls are
    const lx = s.limAt(b.gz), lz = s.limZ == null ? 0.55 : s.limZ
    if (Math.abs(b.gx) > Math.max(lx, b.lim0 || 0) + 1e-6 || b.gy > 4 || Math.abs(b.gz) > lz + 1e-6) escaped = true
  }
  const rest = { gx: +b.gx.toFixed(3), gy: +b.gy.toFixed(4), gz: +b.gz.toFixed(3), sleep: b.sleep,
    under: +(b.gy - Math.min(0, s.surfaceAt(b.gx, b.gz))).toFixed(4) }
  s.sleepAll()
  return { launch, maxY: +maxY.toFixed(3), escaped, rest }
})
ok(Math.abs(thrown.launch.vx) <= 0.0027 && Math.abs(thrown.launch.vy) <= 0.0017,
  'a coin thrown as hard as a finger can flick it leaves the hand at a SANE speed', thrown.launch)
ok(!thrown.escaped, 'and it never leaves the room', thrown)
ok(thrown.maxY < 3, 'and it never flies off into space', thrown.maxY)
ok(thrown.rest.sleep && thrown.rest.under >= -0.001, 'it lands on something, and it settles', thrown.rest)

const weight = await page.evaluate(async () => {
  const V = window.__RIB_VAULT_DEV, s = V.scene(), M = window.__RIB_VAULT_MODEL
  s.sleepAll()
  const out = {}
  for (const den of ['bronze', 'gold', 'blue']) {
    // drop one of each from the same height with the same sideways push and see how far
    // it gets before it stops — heavier coins scrub off speed faster
    const i = s.slots.slot.findIndex((q, k) => k < M.slotsFor(s.slots, Math.round(s.nShown)))
    s.sleepAll()
    const b = s.wake(i); if (!b) continue
    b.m = { bronze: 1, gold: 1.75, blue: 2.4 }[den]
    b.bounce = 0.34 / b.m; b.grip = 1 + (b.m - 1) * 0.85
    b.gx = 0; b.gz = 0; b.gy = 1.2; b.vx = 0.0022; b.vy = 0; b.vz = 0; b.sleep = false
    for (let t = 0; t < 400; t++) s.stepBodies(16)
    out[den] = +Math.abs(b.gx).toFixed(4)
  }
  s.sleepAll()
  return out
})
ok(weight.bronze > weight.gold && weight.gold > weight.blue,
  'WEIGHT is real: the same shove carries a bronze coin further than a gold one, and a gold further than a billion', weight)

/* ---------- v137 E: THE AVALANCHE ----------
 * Lifting one coin out of a heap does not leave a hole in it. The coins around the gap give
 * way into it — the ones on the steep flank run, the ones on a flat shoulder barely shift,
 * and none of them goes anywhere near far enough to leave the picture. That sentence is
 * four separate claims and this is all four of them. */
const avalanche = await page.evaluate(() => {
  const V = window.__RIB_VAULT_DEV, s = V.scene(), SC = window.__RIB_VAULT_SCENE
  const e = 0.02, P = SC.PILE
  /* "How steep is the heap under this coin", measured the way the MODEL measures it — in
   * the mound's own slot space, both axes. Taking the world-x gradient alone (which this
   * did) reads the near and far faces of the pile as flat, because their fall is almost
   * entirely in z, and z is a seventh of the size of x in ground units. Probe and model
   * then disagreed about which coins were steep and the comparison was meaningless. */
  const slopeAt = (x, z) => {
    const a = (s.surfaceAt(x + e, z) - s.surfaceAt(x - e, z)) / (2 * e) * P.dx / P.dy
    const b = (s.surfaceAt(x, z + e) - s.surfaceAt(x, z - e)) / (2 * e) * (P.dz * 0.62) / P.dy
    return Math.sqrt(a * a + b * b)
  }
  s.sleepAll()
  const h = s.hoardBox()
  const pick = s.pickSurface((h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2)
  const seed = s.wake(pick.i)
  const gx = seed.gx, gz = seed.gz
  s.sleepAll()                                  // the lift itself is not what is measured
  const woke = s.disturb(gx, gz, 1)
  const start = {}, slope = {}, began = {}
  const outside = (o) => {
    const p = s.cam.project(o.gx, o.gy, SC.PILE.z + o.gz, {})
    return p.x < -1 || p.x > s.cw + 1
  }
  for (const k in V.bodies()) {
    const o = V.bodies()[k]
    start[k] = { x: o.gx, z: o.gz }; slope[k] = slopeAt(o.gx, o.gz); began[k] = outside(o)
  }
  let offscreen = 0
  for (let t = 0; t < 240; t++) {
    s.stepBodies(16)
    for (const k in V.bodies()) if (!began[k] && outside(V.bodies()[k])) offscreen++
  }
  // the STEEPEST THIRD against the FLATTEST THIRD, rather than a fixed gradient: the
  // populations then stay comparable whatever shape the mound is tuned to next
  const seats = []
  for (const k in V.bodies()) {
    const o = V.bodies()[k], a = start[k]; if (!a) continue
    seats.push({ sl: slope[k], m: Math.hypot(o.gx - a.x, o.gz - a.z) })
  }
  seats.sort((p, q) => p.sl - q.sl)
  const third = Math.max(1, Math.floor(seats.length / 3))
  const d = seats.map(q => q.m)
  const flat = seats.slice(0, third).map(q => q.m)
  const steep = seats.slice(-third).map(q => q.m)
  d.sort((p, q) => p - q)
  const avg = (a) => a.length ? a.reduce((p, q) => p + q, 0) / a.length : 0
  const asleep = Object.values(V.bodies()).filter(o => o.sleep).length
  s.sleepAll()
  return { woke, n: d.length, moved: d.filter(v => v > 0.004).length,
    max: +(d[d.length - 1] || 0).toFixed(4), median: +(d[d.length >> 1] || 0).toFixed(4),
    offscreen, asleep, steep: +avg(steep).toFixed(4), flat: +avg(flat).toFixed(4),
    nSteep: steep.length, nFlat: flat.length }
})
ok(avalanche.woke > 15, 'lifting a coin out wakes the HEAP around it, not just the coin', avalanche.woke)
ok(avalanche.moved > 8, 'and those coins really do give way into the gap', avalanche)
ok(avalanche.max < 0.30, 'but nothing travels far — the money slides down the pile, it does not leave it', avalanche)
ok(avalanche.offscreen === 0, 'and not one coin is pushed out of the picture', avalanche)
ok(avalanche.nSteep > 2 && avalanche.nFlat > 2 && avalanche.steep > avalanche.flat * 1.15,
  'SOME A LOT, SOME A LITTLE: a coin seated on the steep flank runs further than one on a flat shoulder', avalanche)
ok(avalanche.asleep > avalanche.n * 0.8, 'and it is all asleep again a few seconds later', avalanche)

/* ...and the slide has to be worth watching. On the steepest part of the flank a shaken
 * coin should visibly travel, and the heavier it is the less of that it does. */
const slide = await page.evaluate(() => {
  const V = window.__RIB_VAULT_DEV, s = V.scene()
  const e = 0.02
  /* Put the coin ON THE FLANK, with heap left below it to slide down. Taking the steepest
   * point anywhere used to land it exactly on the mound's rim, where the gradient is
   * highest and the slide is over in one frame because the next step is off the heap onto
   * flat floor — so what got measured was one frame of drive and then three seconds of
   * rolling friction, and the weight order came out of the noise in that. The seat has to
   * carry at least a quarter of the peak's height under it to be a flank at all. */
  const peak = s.surfaceAt(0, 0)
  let gx = 0.2, best = 0
  for (let q = 0.05; q < 1.4; q += 0.02) {
    if (s.surfaceAt(q, 0) < peak * 0.25) continue
    const sl = Math.abs((s.surfaceAt(q + e, 0) - s.surfaceAt(q - e, 0)) / (2 * e))
    if (sl > best) { best = sl; gx = q }
  }
  const out = { at: +gx.toFixed(2), slope: +best.toFixed(3) }
  for (const [den, m] of [['bronze', 1], ['gold', 1.75], ['blue', 2.4]]) {
    s.sleepAll()
    const b = s.wake(0); if (!b) break
    b.m = m; b.bounce = 0.34 / m; b.grip = 1 + (m - 1) * 0.85; b.cnt = 1
    b.gx = gx; b.gz = 0; b.gy = s.surfaceAt(gx, 0)
    b.vx = b.vy = b.vz = 0; b.sleep = false; b.still = 0
    b.energy = 0.85; b.travel = 0                  // exactly what a disturbance hands it
    b.shakenV137 = 1; b.hx = b.gx; b.hz = b.gz
    s.grantSlide(b)                                // ...including the slide it is granted
    for (let t = 0; t < 200; t++) s.stepBodies(16)
    out[den] = +Math.abs(b.gx - gx).toFixed(4)
  }
  s.sleepAll()
  return out
})
ok(slide.bronze > 0.04, 'a shaken coin on the steep flank actually TRAVELS', slide)
ok(slide.bronze > slide.gold && slide.gold > slide.blue,
  'and the same shake moves a billion-point coin least of all', slide)
ok(slide.bronze < 0.30, 'and even the lightest one stops inside the heap', slide)

const repose = await page.evaluate(() => {
  /* A hoard that has NOT been shaken must sit there. The slope acts only on a coin that
   * still holds disturbance energy — spend that energy and the heap has to hold its own
   * angle, or every woken coin creeps downhill and the pile quietly deflates. */
  const V = window.__RIB_VAULT_DEV, s = V.scene()
  s.sleepAll()
  const h = s.hoardBox()
  const p = s.pickSurface((h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2)
  const seed = s.wake(p.i)
  s.disturb(seed.gx, seed.gz, 1)
  Object.values(V.bodies()).forEach(b => {
    b.sleep = false; b.still = 0; b.energy = 0; b.vx = b.vy = b.vz = 0
  })
  const before = Object.values(V.bodies()).map(b => ({ x: b.gx, y: b.gy }))
  for (let t = 0; t < 120; t++) s.stepBodies(16)
  const after = Object.values(V.bodies()).map(b => ({ x: b.gx, y: b.gy }))
  let worst = 0
  for (let i = 0; i < before.length; i++)
    worst = Math.max(worst, Math.abs(after[i].x - before[i].x) + Math.abs(after[i].y - before[i].y))
  const asleep = Object.values(V.bodies()).filter(b => b.sleep).length
  s.sleepAll()
  return { n: before.length, worst: +worst.toFixed(4), asleep }
})
ok(repose.n > 20, 'the probe really did shake the top of the heap loose', repose.n)
ok(repose.worst < 0.05, 'and an UNDISTURBED woken coin sits at its angle of repose instead of creeping downhill', repose)
ok(repose.asleep > repose.n * 0.7, 'and settles back to sleep, so a shaken hoard costs nothing once it is still', repose)

// THE MONEY STAYS IN THE PICTURE. The wall used to come from the slot list's outermost
// spill — a ground coordinate with no relation to the viewport — so a shake slid coins off
// the side of the screen, and gz was free to wander to the back of the room where the
// perspective draws a coin high and small and it reads as floating.
const framed = await page.evaluate(() => {
  const V = window.__RIB_VAULT_DEV, s = V.scene(), SC = window.__RIB_VAULT_SCENE
  s.sleepAll()
  const outside = (o) => {
    const p = s.cam.project(o.gx, o.gy, SC.PILE.z + o.gz, {})
    return Math.max(p.x < 0 ? -p.x : 0, p.x > s.cw ? p.x - s.cw : 0)
  }
  /* The hoard's own outer spill legitimately sits past the frame edge — the static pile is
   * drawn that way too — so the claim is not "nothing is ever off-frame". It is that a
   * shake never pushes anything OUT that was IN, however hard the heap is worked over. */
  const began = {}
  const note = () => { for (const k in V.bodies()) if (began[k] === undefined) began[k] = outside(V.bodies()[k]) > 0 }
  let off = 0, worst = 0, samples = 0
  for (let r = 0; r < 6; r++) {
    for (let q = -0.9; q <= 0.901; q += 0.3) s.disturb(q, ((r % 3) - 1) * 0.06, 1)
    note()
    for (let t = 0; t < 60; t++) {
      s.stepBodies(16); note()
      if (t % 10) continue
      for (const k in V.bodies()) {
        const o = V.bodies()[k]; samples++
        if (began[k]) continue
        const over = outside(o)
        if (over > 0) off++
        worst = Math.max(worst, over)
      }
    }
  }
  // a shed coin is airborne for a moment — that is the mechanic. What must not happen is one
  // LEFT hanging there. Let it all settle, then look.
  for (let t = 0; t < 400; t++) s.stepBodies(16)
  let air = 0, maxAir = 0
  for (const k in V.bodies()) {
    const o = V.bodies()[k]
    const a = o.gy - s.surfaceAt(o.gx, o.gz)
    if (a > 0.05) air++
    maxAir = Math.max(maxAir, a)
  }
  const beganOutside = Object.values(began).filter(Boolean).length
  return { samples, pushedOut: off, beganOutside, worstPx: +worst.toFixed(1),
    air, maxAir: +maxAir.toFixed(4), settled: s.bodyCount() }
})
ok(framed.pushedOut === 0, 'working the whole heap over never pushes a coin that was IN the picture off the side of it', framed)
ok(framed.air === 0, 'and once it has all settled, no coin is left standing in the air', framed)

// A COLUMN COMES APART. It is not one rigid body: shake the heap under a stack and its
// coins come off the top and go their own way.
const topple = await page.evaluate(() => {
  const V = window.__RIB_VAULT_DEV, s = V.scene()
  s.sleepAll()
  for (let q = -0.9; q <= 0.901; q += 0.15) s.disturb(q, 0, 1)
  const before = { towers: Object.values(V.bodies()).filter(b => b.cnt > 1).length,
    coins: Object.values(V.bodies()).reduce((a, b) => a + b.cnt, 0) }
  for (let r = 0; r < 8; r++) {
    for (let q = -0.9; q <= 0.901; q += 0.15) s.disturb(q, ((r % 3) - 1) * 0.05, 1)
    for (let t = 0; t < 40; t++) s.stepBodies(16)
  }
  const after = { towers: Object.values(V.bodies()).filter(b => b.cnt > 1 && !b.shard).length,
    shards: Object.values(V.bodies()).filter(b => b.shard).length,
    coins: Object.values(V.bodies()).reduce((a, b) => a + b.cnt, 0) }
  return { before, after }
})
ok(topple.before.towers > 10, 'the probe woke real columns', topple.before.towers)
ok(topple.after.shards > 10, 'a shaken column SHEDS — its coins come off the top and go their own way', topple.after)
ok(topple.after.towers < topple.before.towers,
  'and the towers come apart rather than riding it out intact', [topple.before.towers, topple.after.towers])

// and RESTOCK has to put the columns back together, not just move them
const rebuilt = await page.evaluate(async () => {
  const V = window.__RIB_VAULT_DEV, s = V.scene()
  V.restock()
  await new Promise(r => setTimeout(r, 1500))
  const left = Object.values(V.bodies())
  const wrong = s.slots.slot.filter((q, i) => false).length
  return { bodies: s.bodyCount(), shards: left.filter(b => b.shard).length }
})
ok(rebuilt.bodies === 0 && rebuilt.shards === 0,
  'RESTOCK puts the shed coins back in their columns and clears the shards', rebuilt)

const restock = await page.evaluate(async () => {
  const V = window.__RIB_VAULT_DEV, s = V.scene()
  const o = window.__GRIDIRON_AUDIT__.getState()
  const ppBefore = o.pp, nBefore = Math.round(s.nShown), disturbed = s.bodyCount()
  V.restock()
  await new Promise(r => setTimeout(r, 1400))
  const tidy = s.bodyCount()
  // a second press on a tidy hoard re-pours it
  const layout0 = s.slots.slot.slice(0, 40).map(q => q.x)
  V.restock()
  await new Promise(r => setTimeout(r, 200))
  const layout1 = s.slots.slot.slice(0, 40).map(q => q.x)
  return { ppBefore, ppAfter: o.pp, nBefore, nAfter: Math.round(s.nShown), disturbed, tidy,
    repoured: layout0.some((v, i) => v !== layout1[i]) }
})
ok(restock.tidy === 0, 'RESTOCK puts every disturbed coin back and empties the displacement map', restock)
ok(restock.repoured, 'and pressing it on a tidy hoard pours the same money into a different heap', restock)
ok(restock.ppAfter === restock.ppBefore && restock.nAfter === restock.nBefore,
  'neither one touches a single Prestige Point, or the number of coins', restock)
await closeV()

// the physics must not survive the screen
await openV()
await page.waitForTimeout(600)
const clean = await st()
ok(clean.bodies === 0 && !clean.dragging,
  'a fresh visit opens on a tidy hoard with nothing in the hand', clean)
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
