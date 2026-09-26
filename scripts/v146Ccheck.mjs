// Dev check (v146 C THE HOARD BUYS THE IMPOSSIBLE): the mega-expensive branch, and Evergreen gone.
//
// Asserts: Evergreen is off the tree and ageCutV139 ignores a stale level of it; a save that bought
// it is refunded exactly what the tree charged (cost·mult^i), ONCE — a second boot pays nothing and
// a flagged save that somehow still carries it pays nothing either; the Impossible branch has 10–14
// nodes, every one 100,000 PP or more and Honors-gated; buying CRACK THE WALL through the real
// `window.buy` and spending a point past the wall through the real `window.alloc` costs 4× the band
// price instead of 5×; the other nodes move the numbers their hooks read (the wall, the band width,
// the band ceiling, the soft cap, the fatigue slope, the injury clock, the season's points, PP, the
// recruit stars); the prestige screen renders the branch with its millions formatted; and the
// vault's bridge funds a 10,000,000 PP node.
//
//   node scripts/v146Ccheck.mjs        (GAME_URL=… to point it elsewhere)
import { chromium } from 'playwright'
import fs from 'node:fs'
import { CHROME, gameUrl } from './lib/env.mjs'
const url = gameUrl('index.html')
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 520, height: 1000 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
const boot = async () => { await page.goto(url + (url.includes('?') ? '&' : '?') + 'stayStale', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200) }
await boot()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }

ok(await page.evaluate(() => !!window.__V146C), 'window.__V146C is mounted')

// ---- 1. Evergreen is gone, and the years are real ----
const ever = await page.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = window.S
  const onTree = !!A.TREE_NODES.evergreen || Object.values(A.TREE).some(b => b.nodes.some(n => n.key === 'evergreen'))
  S.tree = {}; const plain = window.__ageV139.cut({ age: 36 })
  S.tree = { evergreen: 2 }; const stale = window.__ageV139.cut({ age: 36 })
  S.tree = {}
  return { onTree, plain, stale }
})
ok(!ever.onTree, 'Evergreen is no longer on the prestige tree')
ok(ever.plain > 0 && ever.stale === ever.plain, 'a stale Evergreen level takes nothing off the age cut', `36: ${ever.plain} / ${ever.stale}`)

// ---- 2. the refund, exactly once ----
const SAVE = 'gridiron_save_v1'
await page.evaluate((SAVE) => {
  const st = JSON.parse(JSON.stringify(window.S)); st.pp = 1000; st.tree = { evergreen: 2, genetics: 1 }; delete st.evergreenRefundV146
  localStorage.setItem(SAVE, JSON.stringify(st)); localStorage.removeItem(SAVE + '_backup')
}, SAVE)
await boot()
const r1 = await page.evaluate(() => ({ pp: window.S.pp, ev: window.S.tree.evergreen, gen: window.S.tree.genetics, flag: window.S.evergreenRefundV146 }))
ok(r1.pp === 1174 && r1.ev === undefined && r1.gen === 1, 'a save with Evergreen Lv 2 is paid back 60 + 114 = 174 PP and loses the node', JSON.stringify(r1))
ok(r1.flag && r1.flag.pp === 174 && r1.flag.lv === 2, 'and the refund is recorded on the save', JSON.stringify(r1.flag))
await page.evaluate(() => window.go('menu'))           // te() saves
await boot()
const r2 = await page.evaluate(() => ({ pp: window.S.pp, ev: window.S.tree.evergreen }))
ok(r2.pp === 1174 && r2.ev === undefined, 'a second boot pays nothing', JSON.stringify(r2))
await page.evaluate((SAVE) => { const st = JSON.parse(localStorage.getItem(SAVE)); st.tree.evergreen = 1; localStorage.setItem(SAVE, JSON.stringify(st)) }, SAVE)
await boot()
const r3 = await page.evaluate(() => ({ pp: window.S.pp, ev: window.S.tree.evergreen }))
ok(r3.pp === 1174 && r3.ev === undefined, 'a flagged save that still carries the node has it removed and is NOT paid twice', JSON.stringify(r3))

// ---- 3. the branch ----
const br = await page.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = window.S; S.tree = {}
  const T = A.TREE.impossible
  return T ? T.nodes.map(n => ({ k: n.key, cost: A.nodeCost(A.TREE_NODES[n.key]), top: Math.round(n.cost * Math.pow(n.mult, n.max - 1)), max: n.max, honors: n.req && n.req.honors, medals: window.__V156A ? window.__V156A.nodeReq(n.key) : null, onTree: !!A.TREE_NODES[n.key] })) : null
})
console.log('nodes:', JSON.stringify(br))
ok(br && br.length >= 10 && br.length <= 14, 'the Impossible branch has 10–14 nodes', br && br.length)
ok(br && br.every(n => n.cost >= 100000 && n.onTree), 'every one of them starts at 100,000 PP or more and is on the tree', br && br.map(n => n.k + ':' + n.cost).join(' '))
ok(br && br.every(n => n.honors >= 30), 'and every one is gated behind 30+ Honors')
ok(br && br.every(n => n.medals == null || n.medals >= 260), 'v156 A: which is 260+ medals now (ruby and up)', br && br.map(n => n.medals).join(','))
ok(br && br.some(n => n.cost >= 1e7), 'the top of it is eight figures', br && Math.max(...br.map(n => n.cost)))

// ---- 4. CRACK THE WALL, bought and spent through the real functions ----
const wall = await page.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = window.S, V = window.__V146C
  S.tree = {}; window.__V156A && window.__V156A.seed(500) /* v156 A: the medals open the branch */; S.prestige = 100; S.pp = 5e6
  const p = A.newPlayer(S, 'RB'); p.pos = 'RB'; S.player = p; p.points = 5000
  const spend = () => { p.attrs.speed = 260; window.go('upgrade'); const b = p.points; window.alloc('speed', 1); return b - p.points }
  const mult0 = V.wallMult(), soft = V.softCap(p, 'speed'), c0 = spend(), cost0 = A.nodeCost(A.TREE_NODES.wallCrack)
  const pp0 = S.pp; window.buy('wallCrack'); const paid = pp0 - S.pp
  const mult1 = V.wallMult(), c1 = spend()
  S.tree.wallCrack = 3; const mult3 = V.wallMult(); S.tree.wallCrack = 9; const floor = V.wallMult()
  S.tree = {}
  return { mult0, mult1, mult3, floor, soft, c0, c1, cost0, paid, lvl: 1 }
})
console.log('wall:', JSON.stringify(wall))
ok(wall.mult0 === 5 && wall.mult1 === 4, 'the wall multiplier is ×5, and ×4 after one level of Crack the Wall', `${wall.mult0} → ${wall.mult1}`)
ok(wall.paid === 100000 && wall.cost0 === 100000, 'window.buy charged the 100,000 PP the card says', wall.paid)
ok(wall.c0 > 0 && wall.c1 * 5 === wall.c0 * 4, 'a point past the wall through window.alloc costs 4/5 of what it did', `${wall.c0} → ${wall.c1} pts (soft cap ${wall.soft})`)
ok(wall.mult3 === 2 && wall.floor === 2, 'Lv 3 is ×2, and nothing goes under the floor', `${wall.mult3} / ${wall.floor}`)

// ---- 5. the other hooks read their node ----
const hooks = await page.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = window.S, V = window.__V146C
  const p = A.newPlayer(S, 'RB'); p.pos = 'RB'; S.player = p
  const at = (tree, fn) => { S.tree = tree; const r = fn(); S.tree = {}; return r }
  const sc = at({}, () => V.softCap(p, 'speed'))
  const cost = (v, tree) => at(tree, () => { p.attrs.speed = v; return V.drCost(p, 'speed') })
  const out = {
    wallAt: [at({}, V.wallAt), at({ wallPush: 1 }, V.wallAt), at({ wallPush: 4 }, V.wallAt)],
    past255: [cost(255, {}), cost(255, { wallPush: 1 })],
    bandW: [at({}, V.bandW), at({ longBands: 4 }, V.bandW)],
    band12: [cost(sc + 12, {}), cost(sc + 12, { longBands: 1 })],
    top: [cost(Math.min(240, sc + 100), {}), cost(Math.min(240, sc + 100), { priceCeiling: 1 }), cost(Math.min(240, sc + 100), { priceCeiling: 3 })],
    soft: [sc, at({ capRaise: 5 }, () => V.softCap(p, 'speed'))],
    fat: [at({}, () => window.__fatigueMulV120(100)), at({ ironLungs: 1 }, () => window.__fatigueMulV120(100)), at({ ironLungs: 3 }, () => window.__fatigueMulV120(100)), at({ ironLungs: 3 }, () => window.__fatigueMulV120(100, true))],
    heal: [at({}, () => V.heal(4)), at({ fastHeal: 1 }, () => V.heal(4)), at({ fastHeal: 2 }, () => V.heal(4)), at({ fastHeal: 2 }, () => V.heal(1))],
    points: [at({}, V.reps), at({ megaReps: 2 }, V.reps)],
    pp: [at({}, () => V.fx('ppMult')), at({ megaPP: 1 }, () => V.fx('ppMult'))],
    prod: [at({}, () => V.fx('statProd')), at({ statLegend: 2 }, () => V.fx('statProd'))],
    ceil: [at({}, () => V.fx('ceilPlus')), at({ ceilLift: 1 }, () => V.fx('ceilPlus'))],
  }
  const stars = tree => at(tree, () => { let s = 0; for (let i = 0; i < 40; i++) s += A.newPlayer(S, 'RB').stars; return s / 40 })
  out.stars = [stars({}), stars({ bornStar: 1 })]
  const trust = tree => at(tree, () => { let s = 0; for (let i = 0; i < 40; i++) s += A.newPlayer(S, 'RB').coachTrust; return s / 40 })
  out.coach = [trust({}), trust({ handPicked: 3 })]
  // an injury rolled through the real materializer
  const inj = tree => at(tree, () => { const q = A.newPlayer(S, 'RB'); q.pos = 'RB'; S.player = q; let n = 0, w = 0
    for (let i = 0; i < 200 && n < 25; i++) { const wk = { injured: true }; if (q.conditionV11) q.conditionV11.injury = null; A.materializeInjuryV134(q, wk); const j = q.conditionV11 && q.conditionV11.injury; if (j && !j.seasonEnding && !j.knock) { n++; w += j.weeksRemaining || 0 } }
    return n ? +(w / n).toFixed(2) : null })
  out.injWeeks = [inj({}), inj({ fastHeal: 2 })]
  return out
})
console.log('hooks:', JSON.stringify(hooks))
ok(hooks.wallAt.join() === '250,275,350' && hooks.past255[1] * 5 === hooks.past255[0], 'Move the Wall: 250 → 275 → 350, and a point at 255 drops out of the ×5', `${hooks.wallAt.join('/')} · 255: ${hooks.past255.join(' → ')}`)
ok(hooks.bandW.join() === '10,22' && hooks.band12[0] === 3 && hooks.band12[1] === 2, 'Long Bands: the band is 10 → 22 wide, and soft cap +12 costs 2 instead of 3', `${hooks.bandW.join('/')} · ${hooks.band12.join(' → ')}`)
ok(hooks.top[0] > 8 && hooks.top[1] === 8 && hooks.top[2] === 4, 'The Price Ceiling: the band price stops at 8, then 4', hooks.top.join(' → '))
ok(hooks.soft[1] > hooks.soft[0], 'Raise the Bar lifts the soft cap', hooks.soft.join(' → '))
ok(Math.abs(hooks.fat[0] - .8) < 1e-9 && Math.abs(hooks.fat[1] - .84) < 1e-9 && Math.abs(hooks.fat[2] - .92) < 1e-9 && hooks.fat[3] === .9, 'Iron Lungs: 100 fatigue is −20% → −16% → −8%, and hurt still holds −10%', hooks.fat.join(' / '))
ok(hooks.heal.join() === '4,4,3,1', 'Miracle Hands (v153 B: 7.5% a level): a 4-game injury is 4, then 3; a 1-game knock stays 1', hooks.heal.join('/'))
ok(hooks.injWeeks[0] != null && hooks.injWeeks[1] != null && hooks.injWeeks[1] <= hooks.injWeeks[0], 'and the real injury materializer hands out shorter layoffs', hooks.injWeeks.join(' → '))
ok(hooks.points[1] - hooks.points[0] === 8, 'Endless Reps: +4 season points a level on the season roll\'s total', hooks.points.join(' → '))
ok(hooks.pp[1] - hooks.pp[0] === 1, 'Dragon\'s Hoard: +100% to the settlement\'s ppMult', hooks.pp.join(' → '))
ok(hooks.coach[1] - hooks.coach[0] >= 25, 'Hand-Picked: a new player (through the real newPlayer) starts ~+30 coach trust at Lv 3', hooks.coach.join(' → '))
ok(Math.abs(hooks.prod[1] - hooks.prod[0] - .5) < 1e-9, 'Box-Score Myth: +50% statProd at Lv 2', hooks.prod.join(' → '))
ok(hooks.ceil[1] - hooks.ceil[0] === 25, 'Beyond Potential: +25 ceilPlus', hooks.ceil.join(' → '))
ok(hooks.stars[1] > hooks.stars[0], 'Born Five-Star: new players are rated higher', hooks.stars.join(' → '))

// ---- 6. the screen and the vault can carry millions ----
const ui = await page.evaluate(() => {
  const S = window.S; S.tree = {}; window.__V156A && window.__V156A.seed(500) /* v156 A: the medals open the branch */; S.prestige = 100; S.pp = 12345678
  window.go('shop'); window.setBranch('impossible')
  const sc = document.getElementById('screen')
  const items = [...sc.querySelectorAll('#branchNodes .shop-item')]
  const btns = items.map(i => i.querySelector('.buy').textContent.trim())
  const tab = [...sc.querySelectorAll('.branch-tab')].some(b => /Impossible/.test(b.textContent))
  const banner = (sc.querySelector('.pts-banner .n') || {}).textContent
  return { n: items.length, btns, tab, banner, fmt: [1234, 100000, 2500000, 1e7].map(window.__V146C.fmt) }
})
console.log('ui:', JSON.stringify(ui))
ok(ui.tab && ui.n === br.length, 'the prestige screen has the Impossible tab and draws every node', `${ui.n} nodes`)
ok(ui.btns.includes('100K PP') && ui.btns.includes('1M PP') && ui.btns.includes('10M PP'), 'the buy buttons read 100K / 1M / 10M, not a wall of digits', ui.btns.join(' | '))
ok(ui.banner === '12,345,678', 'the balance is printed with commas', ui.banner)
ok(ui.fmt.join() === '1,234,100K,2.5M,10M', 'ppFmtV146', ui.fmt.join(' | '))
// the vault: tap the 10M node, pour the rest, and the bridge commits through window.buy
const vd = await page.evaluate(() => { const S = window.S; S.pp = 2e7; const d = window.__RIB_VAULT_BRIDGE && window.__RIB_VAULT_BRIDGE.describe('priceCeiling'); window.vaultBuy('priceCeiling'); return d && { cost: d.cost, locked: d.locked } })
await page.waitForTimeout(2500)
const v0 = await page.evaluate(() => window.__RIB_VAULT_DEV && window.__RIB_VAULT_DEV.state())
await page.evaluate(() => window.__RIB_VAULT_DEV && window.__RIB_VAULT_DEV.skip())
await page.waitForTimeout(1500)
const v1 = await page.evaluate(() => ({ lv: window.__GRIDIRON_AUDIT__.nodeLvl('priceCeiling'), pp: window.S.pp, st: window.__RIB_VAULT_DEV && window.__RIB_VAULT_DEV.state() }))
try { await page.evaluate(() => window.__RIB_VAULT && window.__RIB_VAULT.close('back')) } catch (_) {}
console.log('vault:', JSON.stringify({ vd, target: v0 && v0.target, balance: v0 && v0.balance, lv: v1.lv, pp: v1.pp, committed: v1.st && v1.st.committed }))
ok(vd && vd.cost === 1e7 && !vd.locked && v0 && v0.target && v0.target.cost === 1e7 && v0.balance === 2e7, 'the vault opens on a 10,000,000 PP node with a 20,000,000 PP hoard', JSON.stringify(v0 && { target: v0.target, balance: v0.balance }))
ok(v1.lv === 1 && v1.pp === 1e7, 'and funding it in the vault buys Lv 1 for exactly 10,000,000 PP', JSON.stringify({ lv: v1.lv, pp: v1.pp }))

await page.evaluate(() => { window.S.tree = {}; window.S.pp = 0; window.S.player = null })
console.log('page errors:', errs.length ? errs.join('\n') : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
