// Dev check: v197 PRESTIGE V2 — POTENTIAL IS WHAT YOU BUILT (src/07-career-app.js).
//   1. potential's new part is the PP invested in STAT upgrades: a Physical node raises it, an Economy / Swagger / Fate
//      node does not (it costs PP and moves nothing); every ceiling node counts wherever it sits
//   2. the 🧬 Bloodline: no tab in the tree, its nodes locked, what was spent on it refunded ONCE, a career end adds none
//   3. the pity timer: 50 misses never take the bar under 80% of itself
//   4. the medals' share is ×v197medalK, not ×1.9; TU v197 0 restores all of it; no page errors
// GAME_URL=http://localhost:5173/ node scripts/v197check.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } })
await ctx.addInitScript(() => { try { localStorage.setItem('rib.coachTour.v119', 'off') } catch {} setInterval(() => { document.querySelector('.onboard')?.remove() }, 80) })
const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(String(e.message || e)))
await page.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V197 && !!window.__V179, null, { timeout: 40000 })
await page.evaluate(() => document.getElementById('splash')?.remove())
const M = (fn, arg) => page.evaluate(fn, arg)
const fresh = (o) => M((o) => { const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; Object.assign(S, o || {}); A.setState(S); return true }, o)

// 1. what counts
await fresh({ pp: 1e7, tree: {} })
const C = await M(() => {
  const V = window.__V197, P = () => window.__V179.potential(), out = { p0: P(), i0: V.invest() }
  const buy = (k) => { const pp0 = window.__getGridironState().pp; window.buy(k); return pp0 - window.__getGridironState().pp }
  out.costEcon = buy('endorse'); out.costSwag = buy('highlightReel'); out.costFate = buy('luckyBreaks'); out.pEcon = P(); out.iEcon = V.invest()
  out.costPhys = buy('genetics'); out.pPhys = P(); out.iPhys = V.invest()
  out.stat = { genetics: V.stat('genetics'), juggernaut: V.stat('juggernaut'), iron_sched: V.stat('iron_sched'), etCeiling: V.stat('etCeiling'), endorse: V.stat('endorse'), luckyBreaks: V.stat('luckyBreaks'), highlightReel: V.stat('highlightReel') }
  return out
})
ok(C.costEcon > 0 && C.costSwag > 0 && C.costFate > 0 && Math.abs(C.pEcon - C.p0) < 0.2 && C.iEcon === 0, 'Economy / Swagger / Fate nodes cost PP and do not move potential', C)
ok(C.costPhys > 0 && C.iPhys === C.costPhys && C.pPhys - C.pEcon > 1, 'a Physical node: its price is invested, and potential rises', { cost: C.costPhys, invest: C.iPhys, gain: +(C.pPhys - C.pEcon).toFixed(2) })
ok(C.stat.genetics && C.stat.juggernaut && C.stat.iron_sched && C.stat.etCeiling && !C.stat.endorse && !C.stat.luckyBreaks && !C.stat.highlightReel, 'stat upgrades = the four stat branches + every ceiling/growth node anywhere', C.stat)
const D = await M(() => { const V = window.__V197, out = []; for (let i = 0; i < 6; i++) { const i0 = V.invest(), p0 = V.pot(); window.buy('genetics'); out.push(+((V.pot() - p0) / Math.max(1, V.invest() - i0) * 1000).toFixed(3)) } return out })
ok(D.every((x, i) => !i || x <= D[i - 1] + 1e-9) && D[D.length - 1] < D[0], 'diminishing returns: each PP buys a little less potential than the last', D)

// 2. the bloodline retired
await fresh({ pp: 100, tree: { bloodFamily: 3, bloodPure: 1 }, bloodlineV195C: 40 })
const B = await M(async () => {
  const S = window.__getGridironState(), A = window.__GRIDIRON_AUDIT__
  const want = [0, 1, 2].reduce((t, k) => t + A.nodeCost(A.TREE_NODES.bloodFamily, k), 0) + A.nodeCost(A.TREE_NODES.bloodPure, 0)
  window.go('shop'); await new Promise((r) => setTimeout(r, 400))
  const pp1 = S.pp; window.go('menu'); await new Promise((r) => setTimeout(r, 300)); window.go('shop'); await new Promise((r) => setTimeout(r, 300))
  const tab = [...document.querySelectorAll('.branch-tab')].some((b) => /Bloodline/i.test(b.textContent))
  const locked = !A.nodeUnlocked(A.TREE_NODES.bloodFamily)
  return { want, pp1, pp2: S.pp, refunded: S.bloodRefundV197 && S.bloodRefundV197.pp, tree: Object.keys(S.tree || {}), tab, locked, potHasBlood: window.__V179.potential() }
})
ok(B.pp1 === 100 + B.want && B.pp2 === B.pp1 && B.refunded === B.want && !B.tree.some((k) => /^blood/.test(k)), 'what was spent on the 🧬 branch is refunded once (and only once)', B)
ok(!B.tab && B.locked, 'no 🧬 Bloodline tab, its nodes locked', { tab: B.tab, locked: B.locked })
const E = await M(() => { const S = window.__getGridironState(); const A = window.__GRIDIRON_AUDIT__; S.player = A.newPlayer(); S.player.level = 5; S.player._bloodV195C = null; const b0 = S.bloodlineV195C; try { window.__V195C && window.__V195C.award && window.__V195C.award(S.player, 5) } catch (e) {} return { b0, b1: S.bloodlineV195C, pot: window.__V179.potential() } })
ok(E.b1 === E.b0, 'a career end adds no bloodline', E)

// 3. pity
const P = await M(() => { const S = window.__getGridironState(); S.player = S.player || window.__GRIDIRON_AUDIT__.newPlayer(); S.player.level = 6; S.scoutPityV195A = { 6: 50 }; const B = window.__V179.bar(S.player); return { potBar: B.potBar, base: B.potBase } })
ok(P.base > 0 && P.potBar >= Math.round(P.base * 0.8) - 1, '50 misses never take the bar under 80% of itself', P)

// 4. medals and the kill switch
const K = await M(() => {
  const S = window.__getGridironState(); S.scoutPityV195A = {}
  const on = window.__V179.potential()
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v197: 0 }); S.bloodlineV195C = 0; const off = window.__V179.potential(); S.bloodlineV195C = 40; const offBlood = window.__V179.potential()
  window.RIB_TUNE.v197 = 1
  return { on, off, offBlood }
})
ok(K.offBlood > K.off, 'TU v197 0: the bloodline counts again (the old potential)', K)
ok(errors.length === 0, 'no page errors', errors.slice(0, 4))
await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
