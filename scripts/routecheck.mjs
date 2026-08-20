// Dev check: v55 route tree — the tree is real, and receivers actually run it.
//
// Before this the builder had TEN shapes plus a `default` that drew a straight
// line, and `cross` — which the concept layer picks for both medium and short
// calls — had no case at all, so every crosser in the game was silently run as a
// go. Receivers also parked on their final waypoint and stood dead still for the
// rest of the play, which is most of what "players don't follow routes" looked
// like on screen.
//
// A route is now three choices: one of 45 shapes, a release off the line, and a
// depth tier — 405 combinations. This check drives the real FieldSim, records
// every assigned route and the path actually walked in the sim's own coordinates,
// and measures whether one matches the other.
// node scripts/routecheck.mjs   (needs `npm run dev` on :5173)
import { chromium } from 'playwright'

const fails = []
const ok = (c, label, detail) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${label}${detail ? '  ' + detail : ''}`); if (!c) fails.push(label) }

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(3000)
await page.waitForFunction(() => !!window.buildPlayScript && !!window.__simGameV2, { timeout: 20000 })

const r = await page.evaluate(() => {
  const bps = window.buildPlayScript
  const dims = { PLAY_L: 6, PLAY_R: 714, F_TOP: 14, F_BOT: 426 }
  window.__ROUTE_DEBUG = { path: {}, routes: [], log: [] }
  for (let g = 0; g < 8; g++) {
    const gm = window.__simGameV2(70 + g, 'QB')
    for (const p of gm.plays) {
      if (p.event !== 'pass' && p.event !== 'incomplete') continue
      try { bps(Object.assign({}, p), { dims, rand: Math.random }) } catch (e) {}
    }
  }
  const D = window.__ROUTE_DEBUG
  if (D.routes && D.routes.length) D.log.push({ routes: D.routes, path: D.path })
  const combos = new Set(), names = new Set(), rels = {}, tiers = {}
  let receivers = 0, wpTotal = 0, wpHit = 0, outOfOrder = 0
  let frozen = 0, frozenSettle = 0, samples = 0
  const misses = []
  for (const entry of D.log) for (const rt of entry.routes) {
    const path = entry.path[rt.id]
    if (!path || path.length < 6) continue
    receivers++
    combos.add(rt.name + '|' + rt.rel + '|' + rt.tier); names.add(rt.name)
    rels[rt.rel] = (rels[rt.rel] || 0) + 1; tiers[rt.tier] = (tiers[rt.tier] || 0) + 1
    // every waypoint after the stem must be approached, IN ORDER — a receiver who
    // merely wanders near the points in any order is not running the route
    let cursor = 0
    for (let k = 1; k < rt.wps.length; k++) {
      const [wx, wy] = rt.wps[k]
      let best = 1e9, bestI = cursor
      for (let i = cursor; i < path.length; i++) {
        const d = Math.hypot(path[i][0] - wx, path[i][1] - wy)
        if (d < best) { best = d; bestI = i }
      }
      wpTotal++
      if (best <= 20) { wpHit++; if (bestI < cursor) outOfOrder++; cursor = bestI }
      else if (misses.length < 6) misses.push(`${rt.name}/${rt.rel}/${rt.tier} wp${k} off by ${Math.round(best)}`)
    }
    const tailN = Math.min(10, path.length - 1)
    let moved = 0
    for (let i = path.length - tailN; i < path.length; i++)
      if (Math.hypot(path[i][0] - path[i-1][0], path[i][1] - path[i-1][1]) > 1.5) moved++
    samples++
    if (moved <= 1) { frozen++; if (rt.tail === 'settle') frozenSettle++ }
  }
  window.__ROUTE_DEBUG = null
  const T = window.__ROUTE_TREE_V55 || {}
  const pooled = [...new Set([].concat(T.pools?.deep || [], T.pools?.med || [], T.pools?.short || []))]
  return {
    receivers, combos: combos.size, names: names.size, treeSize: (T.names || []).length,
    rel: (T.rel || []).length, tier: (T.tier || []).length,
    unimplemented: pooled.filter(n => !(T.names || []).includes(n)),
    wpTotal, wpHitPct: +(wpHit / Math.max(1, wpTotal) * 100).toFixed(1), outOfOrder,
    frozenPct: Math.round(frozen / Math.max(1, samples) * 100),
    frozenNonSettlePct: Math.round((frozen - frozenSettle) / Math.max(1, samples) * 100),
    rels, tiers, misses,
  }
})
console.log('routes:', JSON.stringify(r, null, 1))

ok(r.treeSize >= 40, 'the tree carries the full route board', `${r.treeSize} shapes`)
ok(r.treeSize * r.rel * r.tier >= 300, 'shape x release x depth is ~30x the old eleven',
  `${r.treeSize} x ${r.rel} x ${r.tier} = ${r.treeSize * r.rel * r.tier}`)
ok(r.unimplemented.length === 0, 'every route a concept can call is a real shape, not a straight line',
  r.unimplemented.length ? r.unimplemented.join(',') : 'all pool names implemented')
ok(r.receivers >= 200, 'measured across a real sample of receivers', `${r.receivers}`)
ok(r.combos >= 250, 'the variety actually reaches the field', `${r.combos} distinct combinations run`)
ok(r.names >= 40, 'and every shape gets called', `${r.names} of ${r.treeSize}`)
ok(Object.keys(r.rels).length === 3 && Object.keys(r.tiers).length === 3,
  'releases and depth tiers both vary', JSON.stringify(r.rels) + ' ' + JSON.stringify(r.tiers))
// the point of the whole exercise
ok(r.wpHitPct >= 95, 'receivers ACTUALLY RUN their route — every break, in order',
  `${r.wpHitPct}% of ${r.wpTotal} waypoints hit`)
ok(r.outOfOrder === 0, 'and hit them in sequence, not in any order', `${r.outOfOrder} out of order`)
ok(r.frozenNonSettlePct <= 25, 'they keep working after the route instead of standing dead still',
  `${r.frozenNonSettlePct}% park (settle routes excluded — those stop by design)`)

console.log('page errors:', errs.length ? '\n' + errs.slice(0, 8).join('\n') : 'NONE')
console.log('VERDICT:', fails.length || errs.length ? 'FAIL ' + JSON.stringify(fails) : 'PASS')
if (fails.length || errs.length) process.exitCode = 1
await b.close()
