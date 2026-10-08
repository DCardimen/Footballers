// Dev check: v193 E's top-1% floor, END TO END — a real season, the real national rank, the real hub declare.
//   1 a strong Varsity RB plays a whole season through the game's own functions (startSeason, chooseTraining,
//     simRemainingWeeks, finishSeasonGames) and lands in the national top 1% (`__RANK_V52.sn`)
//   2 with v193Erank on, the rank floor under his declare is ≥ 99 (and ≤ 99.5); with it off, the old curve (< 99)
//   3 the hub's declare (the function its button calls) advances him on a roll of 98.5 (would fail under the old curve)
//   4 300 declares from the same moment: ≥ 97% advance (the floor is 99; 3 standard errors under it)
// Why a separate check: declarecheck's walk plays 0 seasons on main (scripts/known-failures.json), so the declare
// screen had no end-to-end cover for this change. No page errors.  GAME_URL=http://localhost:5173/ node scripts/v193Pcheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const page = await (await browser.newContext({ viewport: { width: 400, height: 860 } })).newPage()
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
await page.addInitScript(() => {
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v156Bplayoffs: 0 })
  try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
  setInterval(() => { for (const s of ['.onboard', '#personaV13', '#growthV42', '#gv139gate', '#ribDlgV149', '.lgm-v152']) document.querySelector(s)?.remove() }, 80)
})
await page.goto(gameUrl('index.html?stayStale&noFilmV114&noGrowV132'), { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V88 && !!window.__V193E && !!window.__V147A, null, { timeout: 40000 })

// 1: a real season at Varsity for a strong RB
const A = await page.evaluate(async () => {
  const X = window.__GRIDIRON_AUDIT__, sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const S0 = X.freshState(); S0.tutorialSeen = true; X.setState(S0)
  window.startCareer(true)
  const S = X.getState(), p0 = S.player
  if (!p0.originV11) { try { window.chooseOriginV11((p0.originOptionsV11 || [])[0] || 'walk-on') } catch (e) {} }
  if (!p0.originV11) p0.originV11 = 'walk-on'
  window.pickPos('RB'); await sleep(20)   // the position screen's own pick, as careersim does
  const p = S.player
  p.level = 4; p.seasonsAtLevel = 1; p.totalSeasons = 6; p.age = 16; p.traits = []
  for (const k in p.attrs) p.attrs[k] = Math.max(p.attrs[k], 120)
  window.go('hub'); await sleep(10)
  const views = []
  for (let step = 0; step < 400; step++) {
    const v = S.view, pl = S.player; views.push(v)
    if (v === 'hub' && pl.seasonsAtLevel >= 2 && !pl.weekResults) break
    if (v === 'hub') { window.startSeason(); await sleep(5); continue }
    if (v === 'training') { window.chooseTraining('balanced'); await sleep(5); continue }
    if (v === 'event') {
      const ev = X.EVENTS.find((z) => z.id === pl.pendingEvent)
      if (!ev) { pl.pendingEvent = null; window.go('sim'); continue }
      if (ev.id === 'bigGame' && window.rivalDeferV136) { window.rivalDeferV136(); await sleep(5); if (S.view === 'event') { pl.pendingEvent = null; window.go('sim') } continue }
      const i = window.__V147A.pickEvent(pl, ev); try { window.chooseEvent(Math.max(0, i)) } catch (e) {}
      if (S.view === 'event') { pl.pendingEvent = null; window.go('sim') }
      await sleep(5); continue
    }
    if (v === 'sim') { window.go('season'); await sleep(5); continue }
    if (v === 'season') {
      const left = (pl.weekResults || []).filter((w) => !w.played).length
      if (!pl.weekResults) { window.go('hub'); continue }
      if (!left) { window.finishSeasonGames(); await sleep(5); continue }
      window.simRemainingWeeks(); await sleep(5)
      if ((pl.weekResults || []).filter((w) => !w.played).length === left) { try { window.playWeek(false) } catch (e) {} await sleep(5) }
      continue
    }
    if (v === 'result') { window.go('hub'); await sleep(5); continue }
    window.go('hub'); await sleep(5)
  }
  const pl = S.player, rk = window.__RANK_V52.sn(pl, X.playerOVR(pl))
  return { level: pl.level, sal: pl.seasonsAtLevel, view: S.view, rank: rk.rank, of: rk.of, top: (rk.rank / rk.of) * 100, ovr: X.playerOVR(pl), trail: views.slice(-12).join('>') }
})
ok(A.level === 4 && A.sal >= 2, 'a strong Varsity RB played a real season through the game\'s own functions', A)
ok(A.top <= 1, 'and the national rank puts him in the top 1%', { rank: A.rank, of: A.of, top: +A.top.toFixed(3) })

// 2 + 3: the floor, on and off; the hub declare on a roll of 98.5
const B = await page.evaluate(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), p = S.player
  const on = window.__V88.rankChance(p)
  window.RIB_TUNE.v193Erank = 0; const off = window.__V88.rankChance(p); delete window.RIB_TUNE.v193Erank
  const ch = window.__V88.declareChance(p)
  const snap = JSON.stringify(S)
  window.__v193Psnap = snap
  const R = Math.random; Math.random = () => 0.985
  try { window.declareFromHub() } finally { Math.random = R }
  const after = { level: X.getState().player.level, view: X.getState().view }
  return { on, off, ch, after }
})
ok(B.on >= 99 && B.on <= 99.5, 'with the v193 E floor, the rank under his declare is 99–99.5', B)
ok(B.off < 99, 'without it (v193Erank 0) the old curve sits under 99', { off: B.off })
ok(B.ch >= 99, 'the declare chance the hub rolls against is ≥ 99', { ch: B.ch })
ok(B.after.level === 5, 'the hub\'s declare advances him to College on a roll of 98.5', B.after)

// 4: 300 declares from the same moment
const C = await page.evaluate(() => {
  const X = window.__GRIDIRON_AUDIT__; let up = 0; const n = 300
  for (let i = 0; i < n; i++) { X.setState(JSON.parse(window.__v193Psnap)); try { window.declareFromHub() } catch (e) {} if (X.getState().player.level === 5) up++ }
  return { up, n, rate: up / n }
})
ok(C.rate >= 0.97, '300 real declares from that moment: at least 97% reach College', C)

ok(errs.length === 0, 'no page errors', errs.slice(0, 3))
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail ? 1 : 0)
