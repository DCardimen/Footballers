// Dev check: v190 (src/07-career-app.js, src/31-legacy.js).
//   A: GAME-DAY NODES — retired in v193 E: perfPct is 0 whatever the tree holds (the old nodes pay other effects now)
//   B: THE STATED NUMBERS ARE PAID — `prestigeCap` ceilings are what the tree can buy (Position Guru ×8 = +8 starts)
//   C: THE TEAM NODES LIFT YOUR TEAMMATES — Superteam ×4 = +10% on your side's team OVR, capped at +15% together
//   D: THE MEDALS AT THE TOP — the Legacy card sits under the report card, the pot under it
//   E: THE WINDFALL, TO SCALE — the medal's PP windfall is a share of what a career pays
//   F: the audit's fixes — Chip on the Shoulder, Inevitable
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v190check.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const ctx = await browser.newContext({ viewport: { width: 400, height: 860 } })
await ctx.addInitScript(() => {
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, {})
  try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
  setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80)
})
const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(String(e.message || e)))
await page.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V190 && !!window.__V189, null, { timeout: 40000 })
await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
await page.evaluate(() => document.getElementById('splash')?.remove())
const M = (fn, arg) => page.evaluate(fn, arg)
const seed = (o = {}) => M((o) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; S.tree = o.tree || {}; A.setState(S)
  S.player = A.newPlayer(); const p = S.player; p.name = 'Node Man'; p.pos = o.pos || 'RB'; p.age = 14; p.originV11 = 'walk-on'; p._wonShown = true
  p.level = o.level != null ? o.level : 3; p.training = 'balanced'; p.points = 0; p.traits = []; A.startSeasonGames()
  window.go('season'); window.GridironStorage.save(S)
  return { weeks: p.weekResults.length }
}, o)

// A: game-day nodes
await seed({ level: 3 })
const A1 = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), V = window.__V190, p = S.player
  const avg = () => { let t = 0; const N = 400; for (let i = 0; i < N; i++) t += V.roll(p, {}).perf; return t / N }
  const has = true, snap = JSON.stringify(p)
  for (const k in p.attrs) p.attrs[k] = 52; p.coachTrust = 75
  const ct = p.coachTrust, inj = p.injured
  S.tree = {}; const p0 = V.perfPct(), a0 = has ? avg() : null
  S.tree = { engine: 6 }; const p1 = V.perfPct(), a1 = has ? avg() : null
  S.tree = { engine: 6, glassCannon: 5, zen: 5, trashTalk: 5 }; const p2 = V.perfPct()
  S.tree = {}; S.player = JSON.parse(snap)
  return { p0, p1, p2, has, a0, a1 }
})
ok(A1.p0 === 0 && A1.p1 === 0 && A1.p2 === 0, 'v193 E: the game-day percent is 0 whatever the tree holds (Twin Engines ×6, the old set maxed)', A1)
ok(Math.abs(A1.a1 - A1.a0) < 3.5, 'the simmed game (rollGamePerf) no longer moves with them', { a0: +A1.a0.toFixed(2), a1: +A1.a1.toFixed(2) })

// B: the stated numbers are paid
const B = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), V = window.__V190
  S.tree = { privateCoach: 8 }; const start = V.fx('startAll')
  S.tree = { engine: 6 }; const perf = V.fx('eGrowth')
  S.tree = { rawAthlete: 5 }; const phys = V.fx('physicalStart')
  window.RIB_TUNE.v190cap = 0; S.tree = { privateCoach: 8 }; const old = V.fx('startAll'); delete window.RIB_TUNE.v190cap
  S.tree = {}
  return { start, perf, phys, old }
})
ok(B.start === 8 && Math.abs(B.perf - 0.24) < 1e-9 && B.phys === 30, 'a maxed node pays its stated total (Position Guru ×8 = +8, Twin Engines ×6 = eGrowth 0.24 (v193 E), Raw Athlete ×5 = +30)', B)
ok(B.old < 6, 'v190cap 0 restores the v146 ceilings', B)

// C: the team nodes
const C = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), V = window.__V190, p = S.player
  S.tree = {}; const a = window.__TEAMPAIR_V76(p, { seed: 55 })
  S.tree = { juggernautTeam: 4 }; const lift = V.teamLift(), b = window.__TEAMPAIR_V76(p, { seed: 55 })
  S.tree = { juggernautTeam: 4, dynastyTeam: 4, gmEye: 6, goodProgram: 6 }; const cap = V.teamLift()
  S.tree = {}
  return { a: a.us, b: b.us, ratio: +(b.us / a.us).toFixed(3), lift, cap, oppSame: a.opp === b.opp }
})
ok(C.lift === 10 && C.ratio >= 1.07 && C.ratio <= 1.13 && C.oppSame, 'Superteam ×4: your side\'s team OVR +10%, the opponent untouched', C)
ok(C.cap === 15, 'the team nodes together cap at +15%', C)

// E: the windfall
const E = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), V = window.__V190
  S.payHistV190 = [10, 12, 30]
  const pot = window.__V189.pot(S.player), w = V.windfall(2)
  S.payHistV190 = []
  return { pot, w }
})
ok(E.w === Math.max(1, Math.round(Math.max(30, E.pot) * 0.1)), 'the medal windfall is a share of what a career pays (the best recent payout or this pot) — 10% since v192 A (was 40%)', E)

// D: the medals at the top of the season report
await seed({ level: 2 })
const D = await M(async () => {
  const A = window.__GRIDIRON_AUDIT__, S = A.getState(), p = S.player
  S.bankShownV189 = 0; S.bankSeasonV189 = null
  p.weekResults.forEach((w) => { w.played = true; if (!w.statLine) w.statLine = {} })
  window.finishSeasonGames(); await new Promise((r) => setTimeout(r, 900))
  const sc = document.getElementById('screen'), first = sc.querySelector('.card'), lg = sc.querySelector('.legacy-card-v152'), pot = document.getElementById('bankResultV189')
  const kids = [...sc.querySelectorAll('.card')], iL = kids.indexOf(lg), iP = kids.indexOf(pot)
  return { view: S.view, lg: !!lg, next: !!(first && lg && (first.nextElementSibling === lg || iL <= 2)), iL, iP, n: kids.length }
})
ok(D.view === 'result' && D.lg && D.iL >= 0 && D.iL <= 2, 'the Legacy medal card sits at the top of the season report', D)
ok(D.iP < 0 || D.iP === D.iL + 1, 'the pot sits right under it', D)

// F: the audit's fixes
const F = await M(() => {
  const A = window.__GRIDIRON_AUDIT__, S = A.getState(), V = window.__V190
  let pw = 40; S.tree = {}; while (pw < 200 && A.advanceChance(pw, 4, null, null, 1) < 20) pw += 4
  const adv = (t) => { S.tree = t; return A.advanceChance(pw, 4, null, null, 1) }
  const a0 = adv({}), a1 = adv({ inevitable: 1 })
  S.tree = { chipShoulder: 2 }; const grit = V.fx('start_grit')
  S.tree = { etWisdom: 12 }; const wis = V.fx('wisdomPtsV190'), capped = V.fx('pointsFlat')
  S.tree = {}
  return { a0, a1, grit, wis, capped }
})
ok(F.a1 > F.a0, 'Inevitable lifts the call-up chance (it was read by nobody)', F)
ok(F.grit === 6, 'Chip on the Shoulder pays +3 starting Grit a level', F)
ok(F.wis === 12 && F.capped === 0, 'Eternal Wisdom pays +1 a level, uncapped, on its own term', F)

console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
if (errors.length) console.log('page errors:', errors.slice(0, 6))
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
