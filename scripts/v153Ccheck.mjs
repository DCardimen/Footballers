// v153 C — PAYDAY: the Prestige Vault's reward sequence ("your run becomes wealth").
//
// What it proves:
//   1. the shower's size is LOGARITHMIC in the gain and lands in the owner's tiers
//      (tiny 8-15 · small 20-35 · medium 40-70 · large 80-120 · huge 120-180 · storm ~200)
//   2. a REAL career end (a saved game-over restored at boot) makes the award pending; the
//      career-end button offers to watch it; opening the vault plays it ONCE: the old balance
//      first, "+N PRESTIGE", one coin alone, then the shower, the count climbing only as coins
//      land, the total locking on the final coin, the controls live only after
//   3. the shown-state is written BEFORE it plays (outside the save); reopening and reloading
//      never replay it; the button becomes a plain way in
//   4. PP truth: `state.pp` and the vault's own balance never move during any of it
//   5. a tap accelerates, a second skips to the locked final state; a pointer on the room
//      during the sequence can never start a pour
//   6. a NEW RECORD is a storm and says so; a small award is a small rain (the tier scales)
//   7. pooled and capped: live coins never exceed the pool, rain voices never exceed their cap,
//      haptics are a handful per sequence, never one per coin
//   8. after it settles, a touch on the pile wiggles the top layer with a quiet metal sound
//   9. prefers-reduced-motion: a quick count-up, a few coins, the final pulse — no particles
//  10. the reserve (towers, crates, sacks) appears only at extreme totals; the kill switch
//  11. no Math.random in the payday block; no page errors
//
//   npm run dev, then: node scripts/v153Ccheck.mjs      (GAME_URL=… for another server)
//   The sequence is driven through its own clock (`__RIB_VAULT_DEV.payStep`) in fixed 16ms
//   steps, so the assertions do not depend on the frame rate of a loaded box.
import fs from 'node:fs'
import { gameUrl, launch } from './lib/env.mjs'

const SHOTS = process.env.SHOTS || '/tmp/claude-0/shots'
try { fs.mkdirSync(SHOTS, { recursive: true }) } catch {}
const U = gameUrl('?stayStale&noFilmV114')
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []

async function newPage (reduced) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, reducedMotion: reduced ? 'reduce' : 'no-preference' })
  await ctx.addInitScript(() => {
    try { localStorage.setItem('rib.vaultDoor.v137', '1'); localStorage.setItem('rib.coachTour.v119', '0') } catch (e) {}
    setInterval(() => { try { document.querySelectorAll('.onboard').forEach(e => e.remove()) } catch (e) {} }, 60)
  })
  const page = await ctx.newPage()
  page.on('pageerror', e => errors.push(e.message || String(e)))
  return page
}
async function boot (page) {
  await page.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__RIB_VAULT_BRIDGE && !!window.__V153C, null, { timeout: 40000 })
  await page.evaluate(() => { try { window.__splashDoneV94 && window.__splashDoneV94() } catch (e) {} })
  await page.waitForFunction(() => { const s = document.getElementById('splash'); if (!s) return true; const c = getComputedStyle(s); return c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0 || s.classList.contains('gone') }, null, { timeout: 25000 }).catch(() => {})
  await page.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove() })
  // the sequence's clock moves only through payStep: exact on any box, however loaded
  await page.evaluate(() => window.__RIB_VAULT_DEV.payFreeze(true))
  await page.waitForTimeout(500)
}
const E = (page, fn, arg) => page.evaluate(fn, arg)
const game = page => E(page, () => { const o = window.__GRIDIRON_AUDIT__.getState(); return { pp: o.pp, careers: o.careersCompleted || 0, life: o.ppLifetimeV151A } })
const pay = page => E(page, () => window.__RIB_VAULT_DEV.payday())
const step = (page, ms, draw) => E(page, ({ ms, draw }) => window.__RIB_VAULT_DEV.payStep(ms, draw), { ms, draw: !!draw })
const numText = page => E(page, () => +(document.querySelector('#ribVault .rv-num').firstChild.textContent || '').replace(/[^0-9]/g, ''))
// a later award, the way the game makes one: a settle counts the career and pays; the save tracks lifetime PP
const award = (page, n) => E(page, (n) => { const o = window.__GRIDIRON_AUDIT__.getState(); o.careersCompleted = (o.careersCompleted || 0) + 1; o.pp = (o.pp || 0) + n; window.go('shop'); return o.pp }, n)
/* run a sequence to its end in 16ms steps, sampling the displayed number; returns the samples */
async function runOut (page, draw, cap = 20000) {
  const s = []
  for (let t = 0; t < cap; t += 160) {
    const p = await step(page, 160, draw)
    if (!p) break
    s.push({ t: p.t, shown: p.shown, landed: p.landed, spawned: p.spawned, live: p.live, locked: p.locked, done: p.done, parts: p.parts, paying: p.paying })
    if (p.done) break
  }
  return s
}

// a clean profile: the page can reload itself while it boots, so the clear is retried
async function clean (page) {
  for (let i = 0; i < 4; i++) {
    try { await page.goto(U, { waitUntil: 'networkidle', timeout: 60000 }); await page.evaluate(() => localStorage.clear()); return } catch (e) { await page.waitForTimeout(500) }
  }
}
const page = await newPage(false)
await clean(page)
await boot(page)

// ============================== 1. the plan: logarithmic, in the owner's tiers ==============================
{
  const P = await E(page, () => {
    const plan = window.__V153C.plan
    const gains = [1, 5, 12, 24, 40, 150, 249, 400, 1284, 2400, 5000, 20000, 49000, 250000, 1e6, 1e7, 9.9e7, 1e8, 1e9, 1e12]
    return { rows: gains.map(g => ({ g, ...(({ tier, coins, storm }) => ({ tier, coins, storm }))(plan(g)) })),
      rec: plan(50, { record: true }), red: plan(1e6, { reduced: true }), zero: plan(0) }
  })
  const by = g => P.rows.find(r => r.g === g)
  const mono = P.rows.every((r, i) => !i || r.coins >= P.rows[i - 1].coins)
  ok(mono, 'more PP is never a smaller shower', P.rows.map(r => r.g + ':' + r.coins))
  const inTier = (g, tier, lo, hi) => { const r = by(g); return r.tier === tier && r.coins >= lo && r.coins <= hi }
  ok(inTier(5, 'tiny', 8, 15) && inTier(12, 'tiny', 8, 15), 'a tiny gain is 8-15 coins', [by(5), by(12)])
  ok(inTier(40, 'small', 20, 35) && inTier(150, 'small', 20, 35), 'a small gain is 20-35', [by(40), by(150)])
  ok(inTier(400, 'medium', 40, 70) && inTier(1284, 'medium', 40, 70), 'a medium gain is 40-70', [by(400), by(1284)])
  ok(inTier(5000, 'large', 80, 120) && inTier(20000, 'large', 80, 120), 'a large gain is 80-120', [by(5000), by(20000)])
  ok(inTier(250000, 'huge', 120, 180) && inTier(1e7, 'huge', 120, 180), 'a huge gain is 120-180', [by(250000), by(1e7)])
  ok(by(1e8).tier === 'storm' && by(1e8).coins === 200 && by(1e12).coins === 200 && P.rec.tier === 'storm' && P.rec.coins === 200,
    'a new record (or a 100M+ award) is the ~200-coin prestige storm — and nothing ever goes past it', [by(1e8), by(1e12), P.rec])
  // log, not linear: x100 the PP is nowhere near x100 the coins
  ok(by(1e7).coins < by(250000).coins * 1.6 && by(20000).coins < by(150).coins * 5,
    'the volume is LOGARITHMIC: 40x the PP is well under 2x the coins, 130x under 5x', [by(250000).coins, by(1e7).coins, by(150).coins, by(20000).coins])
  ok(P.red.coins <= 6, 'reduced motion caps the rain at a handful', P.red.coins)
}

// ============================== 2. a REAL career end, restored at boot ==============================
let award1
{
  await E(page, () => {
    const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); A.setState(S); S.tutorialSeen = true
    S.pp = 3000
    S.player = A.newPlayer(); S.player.name = 'Payday Tester'; S.player.pos = 'WR'; S.player.level = 5; S.player.totalSeasons = 12
    S.player.titles = 1; S.player.peakOvr = 71; S.player.traits = []; S.player.tiers = {}
    S.player.career = [{ level: 'College', ovr: 60, age: 21 }]; S.view = 'gameover'; window.GridironStorage.save(S)
    localStorage.removeItem('rib.vaultPay.v153')
  })
  await boot(page)
  const g = await game(page)
  const pend = await E(page, () => window.__RIB_VAULT_BRIDGE.pending())
  ok(g.careers === 1 && g.pp > 3000, 'the settle paid the career and counted it', g)
  ok(pend && pend.to === g.pp && pend.gain > 0 && pend.from === g.pp - pend.gain && !pend.record,
    'the award is PENDING: the vault owes the player the sight of it (old balance -> the balance the game holds)', pend)
  award1 = pend
  // the real way on from a cut: make the vow, which goes straight to the Prestige tree...
  const vow = await E(page, () => { const b = document.querySelector('#dock .qa-main-v146') || [...document.querySelectorAll('#dock button')].find(x => /Open Prestige/.test(x.textContent)); if (b) b.click(); return !!b })
  await page.waitForTimeout(600)
  const inShop = await E(page, () => window.__GRIDIRON_AUDIT__.getState().view)
  ok(vow && inShop === 'shop', 'the career end hands the player to the Prestige tree', { vow, view: inShop })
  ok(await E(page, () => window.__RIB_VAULT_BRIDGE.pending() !== null), 'and the award is still owed there — nothing has shown it yet')
  const auBefore = await E(page, () => window.__RIB_VAULT_AUDIO.stats())
  // ...and from the tree, the vault
  await E(page, () => { const b = [...document.querySelectorAll('button')].find(x => /Visit the Vault/.test(x.textContent)); b.click() })
  await page.waitForFunction(() => window.__RIB_VAULT.isOpen() && !!window.__RIB_VAULT_DEV.payday(), null, { timeout: 15000 })
  const p0 = await pay(page)
  const rec0 = await E(page, () => JSON.parse(localStorage.getItem('rib.vaultPay.v153') || 'null'))
  const n0 = await numText(page)
  const sc0 = await E(page, () => ({ pp: window.__RIB_VAULT_DEV.scene().pp, bal: window.__RIB_VAULT_DEV.state().balance }))
  ok(p0 && p0.active && p0.from === pend.from && p0.to === pend.to, 'opening the vault starts the payday for exactly that award', p0 && { from: p0.from, to: p0.to })
  ok(n0 === pend.from && sc0.pp === pend.from, 'it shows the OLD balance first — the number and the hoard', { shown: n0, hoard: sc0.pp, from: pend.from })
  ok(sc0.bal === g.pp, '...while the vault\'s own balance is already the truth', sc0)
  ok(rec0 && rec0.careers === 1 && rec0.n === 1 && rec0.last && rec0.last.gain === pend.gain, 'the award is marked shown BEFORE it plays — outside the save', rec0)
  ok(await E(page, () => { const j = JSON.stringify(window.__GRIDIRON_AUDIT__.getState()); const o = window.__GRIDIRON_AUDIT__.getState(); return !/vaultPay\.v153/.test(j) && !Object.keys(o).concat(Object.keys(o.player || {})).some(k => /v153|payday/i.test(k)) }), 'and nothing about it is written into the save')
  const hold = await step(page, 200)
  ok(hold.shown === pend.from && hold.label.hidden && hold.spawned === 0, 'for the first moment it HOLDS: old balance, no label, no coin', hold)
  let p = await step(page, 380)
  ok(!p.label.hidden && p.label.text.includes('+' + pend.gain.toLocaleString('en-US')) && /PRESTIGE/.test(p.label.text), '"+N PRESTIGE" appears above the pile', p.label)
  // the first coin falls ALONE
  let alone = true, sawFirst = false
  for (let i = 0; i < 60 && p.landed === 0; i++) { p = await step(page, 32); if (p.spawned > 1) alone = false; if (p.spawned === 1) sawFirst = true }
  ok(sawFirst && alone && p.landed === 1, 'ONE coin drops and lands before any other falls', { spawned: p.spawned, landed: p.landed })
  const ctrl = await E(page, () => { const b = document.querySelector('#ribVault .rv-restock'); return { pe: getComputedStyle(b).pointerEvents, op: +getComputedStyle(document.querySelector('#ribVault .rv-act')).opacity } })
  ok(ctrl.pe === 'none', 'the controls are asleep while it runs', ctrl)
  await page.screenshot({ path: SHOTS + '/v153C_check_first.png' })
  const s = await runOut(page, true)
  const last = s[s.length - 1]
  const shownSeq = [hold.shown, ...s.map(x => x.shown)]
  ok(shownSeq.every((v, i) => !i || v >= shownSeq[i - 1]), 'the balance only ever counts UP', shownSeq.slice(0, 12))
  ok(s.filter(x => !x.locked).every(x => x.shown < pend.to), 'it never reaches the total before the final coin lands', s.filter(x => !x.locked).slice(-2))
  const mid = s.find(x => x.landed > 4 && !x.locked)
  ok(mid && mid.shown > pend.from && mid.shown < pend.to, 'it climbs WHILE the coins fall', mid)
  ok(last.done && last.shown === pend.to && (await numText(page)) === pend.to, 'and locks on exactly the new total', { last: last.shown, to: pend.to })
  const fin = await pay(page)
  ok(fin.spawned === fin.plan.coins && fin.landed === fin.plan.coins, 'every coin of the plan fell and landed', { spawned: fin.spawned, plan: fin.plan.coins, tier: fin.plan.tier })
  ok(fin.maxLive <= fin.cap, 'the live coins stayed inside the pool', [fin.maxLive, fin.cap])
  ok(fin.haptics[0] === 'LIGHT:first' && /^(MEDIUM|HEAVY):lock$/.test(fin.haptics[fin.haptics.length - 1]) && fin.haptics.length <= 2 + Math.ceil(fin.t / 320) && fin.haptics.length < fin.spawned / 2,
    'haptics: light on the first coin, a few on big impacts, stronger at the lock — never per coin', fin.haptics)
  const au = await E(page, () => window.__RIB_VAULT_AUDIO.stats())
  ok(au.rain > auBefore.rain && au.peak <= au.max && au.finals > auBefore.finals, 'the rain is voiced, the rain voices never exceed their cap, one final CLINK', au)
  const ctrl2 = await E(page, () => ({ pe: getComputedStyle(document.querySelector('#ribVault .rv-restock')).pointerEvents, paying: document.getElementById('ribVault').classList.contains('rv-paying') }))
  ok(ctrl2.pe === 'auto' && !ctrl2.paying, 'RESTOCK / DETAILS / CHOOSE AN UPGRADE are live once it has settled', ctrl2)
  const g2 = await game(page)
  ok(g2.pp === g.pp, 'PP TRUTH: the game\'s balance never moved', [g.pp, g2.pp])
  await page.screenshot({ path: SHOTS + '/v153C_check_locked.png' })
  // after it settles: a touch on the pile wiggles the top layer, quietly
  const w0 = await E(page, () => window.__RIB_VAULT_AUDIO.stats().wiggles)
  const hb = await E(page, () => { const h = window.__RIB_VAULT_DEV.scene().hoardBox(); return { x: (h.x0 + h.x1) / 2, y: h.y0 + (h.y1 - h.y0) * 0.35 } })
  await page.mouse.move(hb.x, hb.y); await page.mouse.down(); await page.waitForTimeout(120); await page.mouse.up()
  const wig = await E(page, () => ({ bodies: window.__RIB_VAULT_DEV.state().bodies, w: window.__RIB_VAULT_AUDIO.stats().wiggles, pend: window.__RIB_VAULT_DEV.state().pending }))
  ok(wig.bodies > 0 && wig.w > w0 && wig.pend === 0, 'after it settles, touching the pile shifts the top coins with a quiet metal sound (and spends nothing)', wig)
  await E(page, () => window.__RIB_VAULT.close('test'))
  await page.waitForTimeout(250)
  const btn2 = await E(page, () => window.vaultPayBtnV137(window.__GRIDIRON_AUDIT__.getState().player))
  ok(/Open the Vault/.test(btn2) && !/Watch/.test(btn2), 'the career-end vault button (the win screen\'s) is now a plain way in, not a replay', btn2.replace(/<[^>]+>/g, '').trim())
}

// ============================== 3. reopening and reloading never replay it ==============================
{
  // back on the tree (the vault returns there): its Visit the Vault button again
  await E(page, () => window.__RIB_VAULT_DEV.forgetPayday())
  const clicked = await E(page, () => { const b = [...document.querySelectorAll('button')].find(x => /Visit the Vault/.test(x.textContent)); if (b) b.click(); return !!b })
  await page.waitForTimeout(300)
  ok(clicked && (await E(page, () => window.__RIB_VAULT.isOpen())) && (await pay(page)) === null, 'Visit the Vault again: the vault opens WITHOUT replaying the award', { clicked })
  await E(page, () => window.__RIB_VAULT.close('test'))
  await E(page, () => window.__RIB_VAULT_DEV.forgetPayday())
  await E(page, () => window.vaultPayoutV137())
  await page.waitForTimeout(250)
  ok((await pay(page)) === null, 'nor does the career-end payout button')
  await E(page, () => window.__RIB_VAULT.close('test'))
  await E(page, () => window.__RIB_VAULT_DEV.forgetPayday())
  await E(page, () => window.__RIB_VAULT_BRIDGE.open({ skipDoor: true }))
  await page.waitForTimeout(200)
  const p = await pay(page)
  const g = await game(page)
  ok(p === null && (await numText(page)) === g.pp, 'reopening the vault any other way shows the balance at once — no replay', { payday: p, pp: g.pp })
  await E(page, () => window.__RIB_VAULT.close('test'))
  await boot(page)
  ok(await E(page, () => window.__RIB_VAULT_BRIDGE.pending() === null), 'after a RELOAD nothing is pending')
  await E(page, () => window.__RIB_VAULT_BRIDGE.open({ skipDoor: true }))
  await page.waitForTimeout(200)
  ok((await pay(page)) === null, 'and opening after a reload does not replay it')
  await E(page, () => window.__RIB_VAULT.close('test'))
}

// ============================== 4. a tiny award is a tiny rain ==============================
let tinyPlan
{
  await award(page, 9)
  await E(page, () => window.__RIB_VAULT_BRIDGE.open({ skipDoor: true }))
  await page.waitForTimeout(150)
  const p = await pay(page)
  ok(p && p.gain === 9 && p.plan.tier === 'tiny' && !p.record, 'a 9-PP award plays as a tiny rain', p && p.plan)
  const s = await runOut(page, false)
  const f = await pay(page)
  tinyPlan = f.plan
  const lockT = s.find(x => x.locked)
  ok(f.done && f.shown === f.to && f.spawned === f.plan.coins && f.plan.coins <= 15 && lockT && lockT.t <= 2400 && f.t <= 2900,
    'it is over in about two seconds, on the exact total', { lockedBy: lockT && lockT.t, done: f.t, coins: f.spawned })
  await E(page, () => window.__RIB_VAULT.close('test'))
}

// ============================== 5. a new record: the storm; accelerate, then skip ==============================
{
  const before = await game(page)
  await award(page, 150000)
  const g = await game(page)
  await E(page, () => window.__RIB_VAULT_BRIDGE.open({ skipDoor: true }))
  await page.waitForTimeout(150)
  let p = await pay(page)
  ok(p && p.record && p.plan.tier === 'storm' && p.plan.coins === 200, 'a bigger award than any before is a NEW RECORD and a prestige storm', p && { record: p.record, plan: p.plan.tier, coins: p.plan.coins })
  ok(p.plan.coins > tinyPlan.coins * 10, 'the shower scales with the gain', [tinyPlan.coins, p.plan.coins])
  p = await step(page, 1500, true)
  await page.screenshot({ path: SHOTS + '/v153C_check_storm_a.png' })
  // a pointer on the ROOM (not a button) during the sequence: accelerate, and never a pour
  await page.mouse.click(206, 520)
  p = await pay(page)
  ok(p.taps === 1 && p.k > 2 && !p.locked, 'a tap ACCELERATES the sequence', { taps: p.taps, k: p.k })
  const t1 = p.t; const tw = Date.now()
  p = await step(page, 480, true)
  ok(p.t - t1 >= 480 * 2.4, 'and its clock really runs faster', { advanced: p.t - t1 })
  await page.screenshot({ path: SHOTS + '/v153C_check_storm_b.png' })
  const mid = await E(page, () => window.__RIB_VAULT_DEV.state())
  ok(mid.pending === 0 && !mid.holding, 'a tap on the room during the sequence never starts a pour', { pending: mid.pending, holding: mid.holding })
  ok(p.maxLive <= p.cap && p.live > 20, 'the storm is dense but the pool is capped', { live: p.live, max: p.maxLive, cap: p.cap })
  await page.mouse.click(206, 520)
  p = await pay(page)
  ok(p.taps === 2 && p.locked && p.skipped && p.shown === g.pp && (await numText(page)) === g.pp, 'a second tap SKIPS to the locked final state', { locked: p.locked, shown: p.shown, to: g.pp })
  p = await step(page, 400, true)
  ok(p.done && !p.paying, 'and the controls come back straight away', { done: p.done, paying: p.paying })
  ok(p.label.rec && /NEW PRESTIGE RECORD/.test(p.label.text), 'NEW PRESTIGE RECORD is shown', p.label)
  await page.screenshot({ path: SHOTS + '/v153C_check_storm_skip.png' })
  const g2 = await game(page)
  ok(g2.pp === g.pp && g.pp === before.pp + 150000, 'PP TRUTH: skipping and accelerating changed nothing', [before.pp, g.pp, g2.pp])
  const au = await E(page, () => window.__RIB_VAULT_AUDIO.stats())
  ok(au.peak <= au.max, 'even a storm never stacks more rain voices than the cap', au)
  await E(page, () => window.__RIB_VAULT.close('test'))
  // leaving MID-sequence: nothing replays, nothing is minted
  await award(page, 4000)
  const g3 = await game(page)
  await E(page, () => window.__RIB_VAULT_BRIDGE.open({ skipDoor: true }))
  await page.waitForTimeout(100)
  await step(page, 1200)
  await E(page, () => window.__RIB_VAULT.close('back'))
  await E(page, () => window.__RIB_VAULT_DEV.forgetPayday())
  await E(page, () => window.__RIB_VAULT_BRIDGE.open({ skipDoor: true }))
  await page.waitForTimeout(150)
  ok((await pay(page)) === null && (await game(page)).pp === g3.pp && (await numText(page)) === g3.pp, 'leaving MID-shower and coming back: no replay, no extra PP, the true balance', { pp: g3.pp })
  await E(page, () => window.__RIB_VAULT.close('test'))
}

// ============================== 6. the old payout hook is presentation only ==============================
{
  const g = await game(page)
  await E(page, () => window.__RIB_VAULT_BRIDGE.payout(2000))
  await page.waitForTimeout(150)
  const p = await pay(page)
  ok(p && p.replay && p.to === g.pp && p.from === g.pp - 2000, 'bridge.payout(n) with nothing pending is a replay of n, landing on the balance the game holds', p && { from: p.from, to: p.to })
  await runOut(page, false)
  ok((await game(page)).pp === g.pp && (await E(page, () => window.__RIB_VAULT_BRIDGE.pending())) === null, 'and it mints nothing and records nothing')
  await E(page, () => window.__RIB_VAULT.close('test'))
}

// ============================== 7. the reserve, the kill switch, the source ==============================
{
  const lv = await E(page, () => { const R = window.__V153C.reserveLevel; return [5e7, 1e8, 2e9, 5e10, 5e11, 2e12].map(R) })
  ok(lv.join() === '0,1,2,3,4,5', 'beyond a pile: towers at 100M, crates at 1B, sacks at 10B, stacked at 100B, a treasury at 1T', lv)
  await E(page, () => { const o = window.__GRIDIRON_AUDIT__.getState(); o.pp = 5e10; window.go('shop') })
  await E(page, () => window.__RIB_VAULT_BRIDGE.open({ skipDoor: true, noPayday: true }))
  await page.waitForTimeout(700)
  const r = await E(page, () => window.__RIB_VAULT_DEV.reserve())
  ok(r && r.level === 3, 'a 50B vault draws its reserve beside the hoard', r)
  await page.screenshot({ path: SHOTS + '/v153C_check_reserve.png' })
  await E(page, () => window.__RIB_VAULT.close('test'))
  await award(page, 777)
  await E(page, () => { window.RIB_TUNE = window.RIB_TUNE || {}; window.RIB_TUNE.v153C = 0 })
  await E(page, () => window.__RIB_VAULT_DEV.forgetPayday())
  await E(page, () => window.__RIB_VAULT_BRIDGE.open({ skipDoor: true }))
  await page.waitForTimeout(150)
  ok((await pay(page)) === null, 'RIB_TUNE.v153C = 0 turns the sequence off')
  await E(page, () => { window.__RIB_VAULT.close('test'); delete window.RIB_TUNE.v153C })
  const src = fs.readFileSync(new URL('../public/rib-vault.js', import.meta.url), 'utf8')
  const blk = src.slice(src.indexOf('/* ===== v153 C PAYDAY')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  ok(blk.length > 1000 && !/Math\.random/.test(blk), 'the payday block never draws on Math.random (a local PRNG)')
}

// ============================== 8. reduced motion ==============================
{
  const rp = await newPage(true)
  await clean(rp)
  await boot(rp)
  await E(rp, () => { const o = window.__GRIDIRON_AUDIT__.getState(); o.pp = 1000; window.go('shop') })
  await E(rp, () => window.__RIB_VAULT_BRIDGE.open({ skipDoor: true }))      // first sight: records the baseline
  await E(rp, () => window.__RIB_VAULT.close('test'))
  await award(rp, 25000)
  const g = await game(rp)
  await E(rp, () => window.__RIB_VAULT_BRIDGE.open({ skipDoor: true }))
  await rp.waitForTimeout(150)
  const p0 = await pay(rp)
  ok(p0 && p0.reduced && p0.plan.coins <= 6, 'reduced motion: the same award, a handful of coins', p0 && p0.plan)
  let maxParts = 0, s = []
  for (let t = 0; t < 4000; t += 80) { const p = await step(rp, 80, true); maxParts = Math.max(maxParts, p.parts); s.push(p.shown); if (p.done) break }
  const f = await pay(rp)
  ok(f.done && f.shown === g.pp && f.t <= 1800, 'a QUICK count-up to the exact total', { t: f.t, shown: f.shown })
  ok(maxParts === 0, 'no particles, no shake', maxParts)
  ok(s.every((v, i) => !i || v >= s[i - 1]), 'still only counting up', s.slice(0, 8))
  await rp.screenshot({ path: SHOTS + '/v153C_check_reduced.png' })
  await rp.context().close()
}

ok(errors.length === 0, 'no page errors', errors.slice(0, 4))
console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
await browser.close()
process.exit(fail ? 1 : 0)
