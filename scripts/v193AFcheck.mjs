// v193 AF — growth fills the points bar too. The owner: "Can you apply attribute bonus to the upgrade exp bar as well?"
// Every game's paycheck toward the next upgrade point (`payWeekV178` → the season screen's "next point" bar) is multiplied by
// the season's growth bonus (the tree's eGrowth, chaos, gear, the school tier, the legend). Paired paychecks on one week:
// with the bonus the raw pay moves by exactly the multiplier; the bar's row names it; v193AF 0 restores the old pay.
import { gameUrl, launch } from './lib/env.mjs'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const page = await browser.newPage({ viewport: { width: 360, height: 800 } })
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
await page.addInitScript(() => { setInterval(() => { try { document.querySelector('.onboard')?.remove() } catch {} }, 60) })
await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V193AF && !!window.__V193AD && !!window.__V178, null, { timeout: 40000 })
await page.waitForTimeout(800)

const R = await page.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  window.RIB_TUNE = window.RIB_TUNE || {}; delete window.RIB_TUNE.v193AF
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S); S.tree = {}; S.path = null
  const p = A.newPlayer(); p.pos = 'RB'; p.name = 'Bar Man'; p.originV11 = 'walk-on'; p.level = 5; S.player = p; p.training = 'balanced'
  for (const k in p.attrs) p.attrs[k] = 70; p.points = 0; p.totalSeasons = 2
  document.querySelectorAll('#splash,#growthV42,#gv139gate,#growV132,.decision-overlay').forEach((o) => o.remove())
  A.startSeasonGames(); document.querySelectorAll('.decision-overlay').forEach((o) => o.remove())
  const w = p.weekResults.find((x) => !x.played)
  Object.assign(w, { played: true, perf: 70, won: true, us: 28, them: 14 })
  const pay = () => window.__V193AF.pay(p, w, false).raw
  const r = {}
  r.m0 = window.__V193AF.mult(p); r.raw0 = pay()
  // a growth bonus: Eternal Growth ×5 (eGrowth) and a Blue-Blood program
  S.tree = { etGrowth: 5 }; p.tiers = { college: 'blue' }
  r.m1 = window.__V193AF.mult(p); r.raw1 = pay()
  // a legend whose growth is slower (the Phenom, −8%)
  S.tree = {}; p.tiers = {}; S.path = 'phenom'
  r.m2 = window.__V193AF.mult(p); r.raw2 = pay()
  // the bar's row names the bonus
  S.path = null; S.tree = { etGrowth: 5 }; p.tiers = { college: 'blue' }
  S.view = 'season'; window.render(); await wait(300)
  const g = document.getElementById('growPayV193AF'); r.row = g ? g.textContent.trim() : ''
  r.width = document.scrollingElement.scrollWidth
  // the kill switch
  window.RIB_TUNE.v193AF = 0
  r.mOff = window.__V193AF.mult(p); r.rawOff = pay()
  delete window.RIB_TUNE.v193AF
  S.tree = {}; p.tiers = {}
  return r
})
const near = (a, b) => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b))
ok(R.m0 === 1 && R.raw0 > 0, 'no growth bonus: the paycheck is unchanged (×1)', { m: R.m0, raw: R.raw0 })
ok(R.m1 > 1.1 && near(R.raw1, R.raw0 * R.m1), 'a growth bonus (Eternal Growth ×5, a Blue-Blood program) multiplies the paycheck by exactly the growth multiplier', R)
ok(R.m2 < 1 && near(R.raw2, R.raw0 * R.m2), 'a slower-growing legend (the Phenom) slows the bar too', { m: R.m2, raw: R.raw2, base: R.raw0 })
ok(new RegExp('🌱 \\+' + Math.round((R.m1 - 1) * 100) + '% growth').test(R.row), 'the season screen\'s "next point" row names the bonus', R.row)
ok(R.width <= 360, 'no overflow at 360 px', R.width)
ok(R.mOff === 1 && near(R.rawOff, R.raw0), 'v193AF 0: the old paycheck', { m: R.mOff, raw: R.rawOff })
ok(!errs.length, 'no page errors', errs.slice(0, 3))
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
