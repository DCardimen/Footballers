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

// ---------- 2b. THE MONEY IS LOOSE: drag, tilt, weight, restock ----------
await setPP(900000)
await openV()
await page.waitForTimeout(900)
const phys = await page.evaluate(async () => {
  const V = window.__RIB_VAULT_DEV, s = V.scene(), M = window.__RIB_VAULT_MODEL
  const h = s.hoardBox(), cx = (h.x0 + h.x1) / 2, cy = (h.y0 + h.y1) / 2
  const got = V.drag(cx, cy)
  const b = Object.values(V.bodies())[0]
  const at0 = b ? { x: b.gx, y: b.gy } : null
  for (let i = 0; i < 12; i++) V.dragTo(cx + 70, cy - 90)
  const at1 = b ? { x: b.gx, y: b.gy } : null
  V.drop()
  await new Promise(r => setTimeout(r, 900))
  const at2 = b ? { x: b.gx, y: b.gy, sleep: b.sleep } : null
  const surf = b ? s.surfaceAt(b.gx, b.gz) : 0
  return { got, at0, at1, at2, surf: +surf.toFixed(4), held: b ? b.held : null,
    moved: at0 && at1 ? Math.abs(at1.x - at0.x) > 0.02 : false,
    onHeap: b ? b.gy >= surf - 0.02 : false, mass: b ? b.m : null }
})
ok(phys.got && phys.moved, 'a coin can be PICKED UP and dragged off the heap', phys)
ok(!phys.held && phys.onHeap, 'and when it is let go it falls and comes to rest ON the heap, not through it', phys)
ok(phys.at2 && phys.at2.sleep, 'and then it goes to sleep, so a settled hoard costs nothing', phys.at2)

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

const tilt = await page.evaluate(async () => {
  const V = window.__RIB_VAULT_DEV, s = V.scene()
  s.sleepAll(); s.setTilt(0, 0)
  V.tilt(-0.9, 0)                        // tip the phone hard to one side
  const before = Object.values(V.bodies()).map(b => b.gx)
  for (let t = 0; t < 90; t++) s.stepBodies(16)
  const after = Object.values(V.bodies()).map(b => b.gx)
  const n = before.length
  const drift = n ? (after.reduce((a, b) => a + b, 0) - before.reduce((a, b) => a + b, 0)) / n : 0
  V.tilt(0, 0)
  return { n, drift: +drift.toFixed(4) }
})
ok(tilt.n > 0, 'a tilt shakes the top of the heap loose', tilt)
ok(tilt.drift < -0.01, 'and the money slides the way the phone is tipped', tilt)
ok(tilt.n <= 150, 'with the number of moving coins held to a cap', tilt.n)

/* The three faults the phone found, each with the assertion that would have caught it. */

// (1) A THROWN COIN LEFT THE ROOM. `fling` was a per-EVENT displacement used as a per-
// MILLISECOND velocity, so a coin left the hand at the pointer's sample rate times its real
// speed — and nothing clamped the vertical, so it went straight up and out.
const thrown = await page.evaluate(async () => {
  const V = window.__RIB_VAULT_DEV, s = V.scene()
  s.sleepAll()
  const h = s.hoardBox(), cx = (h.x0 + h.x1) / 2, cy = (h.y0 + h.y1) / 2
  V.drag(cx, cy)
  const b = Object.values(V.bodies())[0]
  // a hard flick: eight samples, ~8ms apart, across a third of the screen
  for (let i = 1; i <= 8; i++) { V.dragTo(cx + i * 22, cy - i * 16); await new Promise(r => setTimeout(r, 8)) }
  V.drop()
  const launch = { vx: b.vx, vy: b.vy, vz: b.vz }
  let maxY = b.gy, escaped = false
  for (let t = 0; t < 260; t++) {
    s.stepBodies(16)
    maxY = Math.max(maxY, b.gy)
    // the room is sized to the hoard standing in it, so ask the scene where its walls are
    const lx = s.limX == null ? 1.55 : s.limX, lz = s.limZ == null ? 0.55 : s.limZ
    if (Math.abs(b.gx) > lx + 1e-6 || b.gy > 4 || Math.abs(b.gz) > lz + 1e-6) escaped = true
  }
  const rest = { gx: +b.gx.toFixed(3), gy: b.gy, gz: +b.gz.toFixed(3), sleep: b.sleep }
  s.sleepAll()
  return { launch, maxY: +maxY.toFixed(3), escaped, rest, wall: +(s.limX || 0).toFixed(2) }
})
ok(Math.abs(thrown.launch.vx) <= 0.0027 && Math.abs(thrown.launch.vy) <= 0.0017,
  'a coin thrown as hard as a finger can flick it leaves the hand at a SANE speed', thrown.launch)
ok(!thrown.escaped, 'and it never leaves the room', thrown)
ok(thrown.maxY < 3, 'and it never flies off into space', thrown.maxY)
ok(thrown.rest.sleep, 'it lands, and it settles', thrown.rest)

// (2) TILT DID NOTHING ON A REAL PHONE. Neutral was hard-coded to a 48-degree hold, so
// however you were holding it you had either a permanent lean or none at all. Drive the
// REAL handler with the numbers a sensor sends.
const sensor = await page.evaluate(async () => {
  const V = window.__RIB_VAULT_DEV
  if (!V.tiltArm()) return { armed: false }
  // hold it upright and still for the calibration window, as a hand would
  for (let i = 0; i < 12; i++) { V.tiltRaw(78 + Math.random() * 1.2, 1 + Math.random() * 0.8); await new Promise(r => setTimeout(r, 45)) }
  const level = V.tiltRaw(78, 1)
  const leftSmall = V.tiltRaw(78, -9)     // a small wrist roll
  const leftHard = V.tiltRaw(78, -30)     // a real tilt
  const fwd = V.tiltRaw(60, 1)            // tipped away from you
  return { armed: true, level, leftSmall, leftHard, fwd }
})
ok(sensor.armed, 'the tilt handler arms')
ok(sensor.level && Math.abs(sensor.level.gx) < 0.02 && Math.abs(sensor.level.gz) < 0.02,
  'NEUTRAL is wherever the phone is actually being held, not a hard-coded angle', sensor.level)
ok(sensor.leftSmall.gx < -0.2 && sensor.leftHard.gx < -0.9,
  'a small wrist roll registers, and a real tilt saturates', [sensor.leftSmall.gx, sensor.leftHard.gx])
ok(sensor.fwd.gz < -0.5, 'and tipping it away from you drives the other axis', sensor.fwd.gz)

// (3) THE HEAVIEST COINS COULD NOT MOVE AT ALL. grip = 1+(m-1)*0.85 against MU 0.42 and a
// drive capped at 0.85 meant the billion-point coin's threshold was above the maximum.
const breakLoose = await page.evaluate(() => {
  const V = window.__RIB_VAULT_DEV, s = V.scene()
  const out = {}
  for (const [den, m] of [['bronze', 1], ['gold', 1.75], ['blue', 2.4]]) {
    let found = null
    for (let deg = 1; deg <= 45 && !found; deg++) {
      s.sleepAll()
      const b = s.wake(0); if (!b) break
      b.m = m; b.bounce = 0.34 / m; b.grip = 1 + (m - 1) * 0.85
      // On the FLAT floor outside the heap — on the slope this measures the slope, not the
      // tilt — and INSIDE the frame, or the screen-edge clamp moves it and reads as a slide.
      const gx0 = Math.min(0.92, s.limAt(0) * 0.8)
      b.gx = gx0; b.gz = 0; b.gy = s.surfaceAt(gx0, 0); b.vx = b.vy = b.vz = 0
      b.sleep = false; b.still = 0; b.cnt = 1
      const x0 = b.gx
      s.setTilt(-Math.min(1, deg / 24), 0)
      for (let t = 0; t < 60; t++) s.stepBodies(16)
      if (Math.abs(b.gx - x0) > 0.05) found = deg
    }
    out[den] = found
  }
  s.sleepAll(); s.setTilt(0, 0)
  return out
})
ok(breakLoose.bronze && breakLoose.gold && breakLoose.blue,
  'EVERY denomination breaks loose at a reachable angle — the billion-point coin included', breakLoose)
ok(breakLoose.bronze < breakLoose.gold && breakLoose.gold < breakLoose.blue,
  'and the heavier it is the more tilt it takes', breakLoose)
ok(breakLoose.blue <= 22, 'with even the heaviest inside a wrist turn', breakLoose.blue)

// (4) ...and it must not be SLOW. Once loose, a coin should cross the heap in about a second.
const slide = await page.evaluate(() => {
  const V = window.__RIB_VAULT_DEV, s = V.scene()
  s.sleepAll()
  const b = s.wake(0)
  const gx0 = Math.min(0.9, s.limAt(0) * 0.78)
  b.m = 1; b.grip = 1; b.cnt = 1; b.gx = gx0; b.gz = 0; b.gy = s.surfaceAt(gx0, 0)
  b.vx = b.vy = b.vz = 0; b.sleep = false; b.still = 0
  s.setTilt(-1, 0)
  const x0 = b.gx
  for (let t = 0; t < 63; t++) s.stepBodies(16)     // one second
  const moved = Math.abs(b.gx - x0)
  void moved
  s.sleepAll(); s.setTilt(0, 0)
  return +moved.toFixed(3)
})
ok(slide > 0.5, 'a coin on a hard tilt actually TRAVELS — about a heap-width a second', slide)

const repose = await page.evaluate(() => {
  // with the phone level, a woken hoard must SIT there. Weighting the slope as heavily as
  // the tilt made every disturbed coin creep off the heap and the pile quietly deflated.
  const V = window.__RIB_VAULT_DEV, s = V.scene()
  s.sleepAll(); s.setTilt(0, 0)
  s._lastWake = 0                       // the wake is throttled to 220ms; this is a probe
  s.tiltWake()
  Object.values(V.bodies()).forEach(b => { b.sleep = false; b.still = 0 })
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
ok(repose.worst < 0.05, 'and with the phone LEVEL a disturbed hoard sits at its angle of repose instead of creeping downhill', repose)
ok(repose.asleep > repose.n * 0.7, 'and settles back to sleep, so a shaken hoard costs nothing once it is still', repose)

// (5) THE MONEY LEFT THE PICTURE, AND THE BACK OF THE ROOM LOOKED LIKE THE AIR. The wall
// was derived from the slot list's outermost spill — a ground coordinate with no relation to
// the viewport — so a tilt slid most of the hoard off the side of the screen, and gz was free
// to wander to the back of the room where the perspective draws a coin high and small.
const framed = await page.evaluate(() => {
  const V = window.__RIB_VAULT_DEV, s = V.scene(), SC = window.__RIB_VAULT_SCENE
  s.sleepAll(); s._lastWake = 0; s.tiltWake()
  Object.values(V.bodies()).forEach(b => { b.sleep = false; b.still = 0 })
  s.setTilt(-1, 0)
  /* The hoard's own outer spill legitimately sits past the frame edge — the static pile is
   * drawn that way too — so the claim is not "nothing is ever off-frame". It is that the
   * TILT never pushes anything out that was in: a coin that starts inside the picture stays
   * inside it, however hard the phone is tipped. */
  const outside = (o) => {
    const p = s.cam.project(o.gx, o.gy, SC.PILE.z + o.gz, {})
    return Math.max(p.x < 0 ? -p.x : 0, p.x > s.cw ? p.x - s.cw : 0)
  }
  const began = {}
  for (const k in V.bodies()) began[k] = outside(V.bodies()[k]) > 0
  let off = 0, worst = 0, n = 0, wasOut = Object.values(began).filter(Boolean).length
  for (let t = 0; t < 220; t++) {
    s.stepBodies(16)
    if (t % 20) continue
    for (const k in V.bodies()) {
      const o = V.bodies()[k]; n++
      if (began[k]) continue                    // it was already out there
      const over = outside(o)
      if (over > 0) off++
      worst = Math.max(worst, over)
    }
  }
  // a shed coin is airborne for a moment — that is the mechanic. What must not happen is one
  // LEFT hanging there. Let it all settle, then look.
  s.setTilt(0, 0)
  for (let t = 0; t < 400; t++) s.stepBodies(16)
  let air = 0, maxAir = 0
  for (const k in V.bodies()) {
    const o = V.bodies()[k]
    const a = o.gy - s.surfaceAt(o.gx, o.gz)
    if (a > 0.05) air++
    maxAir = Math.max(maxAir, a)
  }
  return { samples: n, pushedOut: off, beganOutside: wasOut, worstPx: +worst.toFixed(1),
    air, maxAir: +maxAir.toFixed(4), settled: s.bodyCount() }
})
ok(framed.pushedOut === 0, 'a hard tilt never pushes a coin that was IN the picture off the side of it', framed)
ok(framed.air === 0, 'and once it has all settled, no coin is left standing in the air', framed)

// (6) A COLUMN COMES APART. It was one rigid body: tip the phone and the whole tower slid
// across the floor like a bar of soap and stood there against the wall, intact.
const topple = await page.evaluate(async () => {
  const V = window.__RIB_VAULT_DEV, s = V.scene()
  s.sleepAll(); s._lastWake = 0; s.tiltWake()
  Object.values(V.bodies()).forEach(b => { b.sleep = false; b.still = 0 })
  const before = { towers: Object.values(V.bodies()).filter(b => b.cnt > 1).length,
    coins: Object.values(V.bodies()).reduce((a, b) => a + b.cnt, 0), shards: 0 }
  s.setTilt(-1, 0)
  for (let t = 0; t < 260; t++) s.stepBodies(16)
  const after = { towers: Object.values(V.bodies()).filter(b => b.cnt > 1 && !b.shard).length,
    shards: Object.values(V.bodies()).filter(b => b.shard).length,
    coins: Object.values(V.bodies()).reduce((a, b) => a + b.cnt, 0) }
  s.setTilt(0, 0)
  return { before, after }
})
ok(topple.before.towers > 10, 'the probe woke real columns', topple.before.towers)
ok(topple.after.shards > 30, 'a driven column SHEDS — its coins come off the top and go their own way', topple.after)
ok(topple.after.towers < topple.before.towers * 0.4,
  'and the towers come apart rather than sliding across the floor intact', [topple.before.towers, topple.after.towers])

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
ok(clean.bodies === 0 && !clean.tilt && !clean.dragging,
  'a fresh visit opens on a tidy hoard with the sensor off', clean)
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
