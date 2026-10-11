// Dev check: v196 A THE SEASON FINISHES ONCE (src/07-career-app.js).
// The owner: "I'm able to finish the season over and over again getting unlimited points... switching to hub tab over and
// over, please only finish season once, and prevent any issue like this."
//   1. a real season (startSeasonGames → every week → finishSeasonGames) finishes ONCE: the season count, the points
//   2. after it, the season tab's dock offers no "Finish Season" (it says "Season Complete — Back to Hub"), nor v178's flow dock
//   3. hub → season → finishSeasonGames() again, many times (window.* and the dock's own onclick): nothing pays, he is sent to the hub
//   4. TU v196A 0 restores the old path (the re-run pays again — the exploit, for the record); no page errors
// GAME_URL=http://localhost:5173/ node scripts/v196Acheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const ctx = await browser.newContext({ viewport: { width: 400, height: 860 } })
await ctx.addInitScript(() => {
  try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
  setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove(); document.querySelectorAll('.decision-overlay,.life-event-overlay-v12').forEach((x) => x.remove()) }, 80)
})
const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(String(e.message || e)))
await page.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V196A, null, { timeout: 40000 })
await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
await page.evaluate(() => document.getElementById('splash')?.remove())
const M = (fn, arg) => page.evaluate(fn, arg)

const run = () => M(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; S.tree = S.tree || {}
  S.player = A.newPlayer(); A.setState(S)
  const p = window.S.player; p.name = 'Once Man'; p.pos = 'RB'; p.age = 14; p.originV11 = 'walk-on'; p._wonShown = true
  p.level = 3; p.training = 'balanced'; p.points = 0; p.traits = []
  A.startSeasonGames(); window.go('season'); await sleep(100)
  for (let k = 0; k < 40 && (p.weekResults || []).some((w) => !w.played); k++) {
    window.__GRIDIRON_AUDIT__.ensurePlayoffs && window.__GRIDIRON_AUDIT__.ensurePlayoffs(p)
    p.weekResults.forEach((w) => { if (!w.played) { w.played = true; w.won = true; w.us = 21; w.them = 7; w.perf = 70; w.statLine = w.statLine || {} } })
    window.__GRIDIRON_AUDIT__.ensurePlayoffs && window.__GRIDIRON_AUDIT__.ensurePlayoffs(p)
  }
  const n0 = window.__V196A.runs
  window.finishSeasonGames(); await sleep(300)
  const first = { view: window.S.view, seasons: p.totalSeasons, points: p.points, runs: window.__V196A.runs - n0, wr: p.weekResults }
  // the exploit route: hub → season tab, over and over
  const docks = [], flows = []
  for (let i = 0; i < 4; i++) {
    window.go('hub'); await sleep(80); window.go('season'); await sleep(120)
    const dock = (document.getElementById('dock') || {}).innerText || ''
    docks.push(dock)
    const b = [...document.querySelectorAll('#dock button')].find((x) => /Finish Season/i.test(x.textContent))
    b && b.click()
    try { window.finishSeasonGames() } catch (e) {}
    await sleep(120)
    try { flows.push(window.__V178.flowDock()) } catch (e) {}
  }
  return { first, docks, flows, after: { view: window.S.view, seasons: p.totalSeasons, points: p.points, refused: window.__V196A.refused } }
})

const R = await run()
ok(R.first.runs === 1 && R.first.view === 'result' && !R.first.wr, 'a real season finishes once (the report card, the weeks cleared)', R.first)
ok(R.docks.every((d) => !/Finish Season/i.test(d) && /Season Complete/i.test(d)), 'after it, the season tab offers no "Finish Season" — "Season Complete — Back to Hub"', R.docks[0])
ok(R.flows.every((d) => !/Finish Season/i.test(d)), "v178's flow dock offers no Finish Season either", R.flows[0])
ok(R.after.seasons === R.first.seasons && R.after.points === R.first.points && R.after.refused >= 4, 'hub → season → finish, over and over: no season, no points', { first: R.first.seasons + '/' + R.first.points, after: R.after })
ok(R.after.view === 'hub', 'a refused finish lands on the hub', R.after.view)

// the kill switch: the old path re-runs (the exploit)
const K = await M(async () => {
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v196A: 0 })
  const p = window.S.player, s0 = p.totalSeasons
  try { window.finishSeasonGames() } catch (e) {}
  await new Promise((r) => setTimeout(r, 300))
  window.RIB_TUNE.v196A = 1
  return { s0, s1: p.totalSeasons }
})
ok(K.s1 > K.s0, 'TU v196A 0: the old path (an empty schedule re-runs the season end)', K)
ok(errors.length === 0, 'no page errors', errors.slice(0, 4))
await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
