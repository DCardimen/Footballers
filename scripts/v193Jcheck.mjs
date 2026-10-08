// Dev check: v193 J THE REDRAWN NODES ARE PAID BACK (src/07-career-app.js).
//   An old save that bought any of the seven nodes v193 E redrew (perfFlat: Twin Engines, Zen Focus, Trash Talk, Aura,
//   Eternal Form, The Wall, Glass Cannon) gets every level back as the PP it costs today, once, at boot; the levels go to 0,
//   every other node is untouched, a second reload pays nothing, a fresh save is marked with 0, and the kill switch skips it.
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v193Jcheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
await page.addInitScript(() => { try { localStorage.setItem('rib.coachTour.v119', 'off') } catch {} ; setInterval(() => { for (const s of ['.onboard', '#personaV13', '#growthV42', '#gv139gate']) document.querySelector(s)?.remove() }, 80) })
const boot = async () => {
  await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V193J, null, { timeout: 40000 })
  await page.evaluate(() => document.getElementById('splash')?.remove())
  await page.waitForTimeout(400)
}
const M = (fn, arg) => page.evaluate(fn, arg)
await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 })
await boot()

const fresh = await M(() => { const X = window.__GRIDIRON_AUDIT__; return { mark: X.getState().perfRefundV193J, nodes: window.__V193J.nodes() } })
ok(fresh.mark && fresh.mark.pp === 0, 'a save with none of the seven is marked at boot with 0 PP', fresh.mark)
ok(fresh.nodes.length === 7, 'the seven redrawn nodes are listed', fresh.nodes)

// an OLD save: three of the seven bought, one other node, no mark
const want = await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.freshState(); X.setState(S); S.tutorialSeen = true
  S.tree = { engine: 3, etForm: 12, glassCannon: 2, culture: 4 }; S.pp = 100
  S.player = X.newPlayer(); S.player.pos = 'RB'
  delete S.perfRefundV193J
  const N = X.TREE_NODES, paid = (k, l) => { let t = 0; for (let i = 0; i < l; i++) t += X.nodeCost(N[k], i); return t }
  const pp = paid('engine', 3) + paid('etForm', 12) + paid('glassCannon', 2)
  window.go('hub')   // goView saves
  return { pp, cost0: X.nodeCost(N.engine, 0), raw0: N.engine.cost }
})
await page.reload({ waitUntil: 'networkidle' })
await boot()
const A = await M(() => { const S = window.__GRIDIRON_AUDIT__.getState(); return { tree: { ...S.tree }, pp: S.pp, mark: S.perfRefundV193J } })
ok(!A.tree.engine && !A.tree.etForm && !A.tree.glassCannon, 'after a reload the three redrawn nodes are at 0', A.tree)
ok(A.tree.culture === 4, 'every other node keeps its levels', A.tree)
ok(A.pp === 100 + want.pp && want.pp > 0, 'the PP back is what the levels cost at today\'s prices (the branch factor included)', { pp: A.pp, want: 100 + want.pp })
ok(want.cost0 > want.raw0, 'today\'s price carries the branch factor (×24 on a core node), so the refund is not a 24th of it', want)
ok(A.mark && A.mark.pp === want.pp && A.mark.parts.length === 3, 'the save is marked with what was paid back', A.mark)
const toast = await page.waitForFunction(() => /redrawn — .* PP refunded/.test((document.getElementById('toast') || {}).textContent || ''), null, { timeout: 8000 }).then(() => true).catch(() => false)
ok(toast, 'a toast says the nodes were redrawn and the PP refunded')

await M(() => window.go('hub'))
await page.reload({ waitUntil: 'networkidle' })
await boot()
const B = await M(() => window.__GRIDIRON_AUDIT__.getState().pp)
ok(B === A.pp, 'a second reload pays nothing more', { before: A.pp, after: B })

// the kill switch: a fresh unmarked old save with v193J 0 keeps its levels
await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(); S.tree.zen = 2; delete S.perfRefundV193J; window.go('hub')
})
await page.addInitScript(() => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v193J: 0 }) })
await page.reload({ waitUntil: 'networkidle' })
await boot()
const K = await M(() => { const S = window.__GRIDIRON_AUDIT__.getState(); return { zen: S.tree.zen, mark: S.perfRefundV193J || null } })
ok(K.zen === 2 && !K.mark, 'kill switch v193J 0: nothing is refunded', K)

ok(errs.length === 0, 'no page errors', errs.slice(0, 3))
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail ? 1 : 0)
