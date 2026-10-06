// Dev check: v185 THE CHAOS LOOP (src/07-career-app.js).
//   1. the scouts and the national rankings see chaos: the declare odds (advanceChance) and the national rank of the same
//      player fall under chaos by the same lift the games use (chaosOppBoost); TU v185 0 = the old 0.45 a point, no rank lift
//   1b. the lift grows with each level's own opponent rating (chaosNeedBaseV185 + chaosNeedPerV185 a point); the depth chart
//      (your own teammates) keeps the flat lift
//   2. the dials move it (chaosDeclareShareV185 / chaosRankShareV185 0 = no lift; the lift's base and per-point dials)
//   3. the capacity rises ONCE a career — the first ring at full chaos, by chaosCapStepV185 — however many rings follow
//   4. an early exit keeps the chaos bonus the dials say (chaosBankExpV185 / chaosBankFloorV185)
//   4b. the estimate's loop: notches at full chaos (`etaNotchSeasonsV185`, scaled by the wall's steepness and the notch)
//   5. the CHAOS group in the beta menu
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v185check.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } })
await ctx.addInitScript(() => {
  try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
  setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} for (const s of ['.onboard', '#personaV13', '#growthV42', '#gv139gate']) document.querySelector(s)?.remove() }, 80)
})
const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e.message || e)))
await p.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
await p.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V185 && !!window.__V181, null, { timeout: 40000 })
await p.waitForTimeout(500); await p.evaluate(() => document.getElementById('splash')?.remove())

// a high-school player on an account with chaos unlocked
await p.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S)
  const s = A.getState(); s.player = A.newPlayer(); const pl = s.player; pl.name = 'Chaos Man'; pl.pos = 'LB'; pl.age = 15; pl.originV11 = 'walk-on'; pl._wonShown = true; pl.level = 3
  for (const k in pl.attrs) pl.attrs[k] = 190
  s.chaosUnlocked = true; s.chaosCap = 0; s.chaos = {}
})
const at = (chaos, tune) => p.evaluate(([chaos, tune]) => {
  const A = window.__GRIDIRON_AUDIT__, s = A.getState(), pl = s.player
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, tune || {})
  s.chaosCap = chaos; s.chaos = {}; if (chaos) window.__chaosMaxV179()
  const ovr = A.playerOVR(pl), adv = A.advanceChance(ovr, pl.level, pl.pos, 70, 1), rk = window.__RANK_V52.sn(pl, ovr)
  const out = { chaos: window.__chaosTotalV179(), lift: +window.__V185.lift().toFixed(2), ovr: Math.round(ovr), adv: +adv.toFixed(1), rank: rk && rk.rank, of: rk && rk.of }
  for (const k in tune || {}) delete window.RIB_TUNE[k]
  return out
}, [chaos, tune])

// 1. the odds and the rank see chaos
const c0 = await at(0), c10 = await at(10), c30 = await at(30), old30 = await at(30, { v185: 0 })
ok(c10.lift === 22 + 10 * 1.05 && c30.lift === 22 + 30 * 1.05 + 12, 'the lift: 22 + 1.05 a point (+12 every 30)', { c10: c10.lift, c30: c30.lift })
ok(c0.adv > c10.adv && c10.adv >= c30.adv && c30.adv < 10, 'the declare odds fall as chaos rises (the next level\'s peers are lifted) — to the floor at 30', [c0.adv, c10.adv, c30.adv])
ok(c0.rank < c10.rank && c10.rank < c30.rank, 'the national rank falls as chaos rises (the country is lifted too)', [c0.rank, c10.rank, c30.rank])
ok(old30.adv > c30.adv && old30.rank === c0.rank, 'TU v185 0: the old odds (0.45 a point) and an unlifted rank', { old: old30, now: c30 })

// 1b. the lift grows with the level's own rating (Pee Wee barely, high school and the UFF a lot); the depth chart keeps the flat lift
const L = await p.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, s = A.getState(); s.chaosCap = 6; s.chaos = {}; window.__chaosMaxV179()
  const V = window.__V185, need = A.LEVELS.map((l) => l.need)
  const out = { flat: +V.lift().toFixed(2), pw: +V.lift(0).toFixed(2), jv: +V.lift(3).toFixed(2), uff: +V.lift(7).toFixed(2), need: [need[0], need[3], need[7]] }
  window.RIB_TUNE.v185 = 0; out.off = +V.lift(3).toFixed(2); delete window.RIB_TUNE.v185
  return out
})
const share6 = 0.15 + 6 * 0.03
ok(Math.abs(L.pw - (L.flat + L.need[0] * share6)) < 0.01 && Math.abs(L.jv - (L.flat + L.need[1] * share6)) < 0.01 && L.uff > L.jv && L.jv - L.flat > 3 * (L.pw - L.flat), 'the lift = flat + the level\'s rating × (0.15 + 0.03 a point): Pee Wee barely, high school and the UFF a lot', L)
ok(L.off === L.flat, 'TU v185 0: the flat lift at every level', L)

// 2. the dials
const noDecl = await at(30, { chaosDeclareShareV185: 0, chaosRankShareV185: 0 }), softer = await at(30, { chaosBoostPerV185: 0.5 })
ok(noDecl.rank === c0.rank && noDecl.adv > c30.adv, 'the share dials at 0: the scouts and the rankings ignore the lift', noDecl)
ok(softer.lift < c30.lift && softer.adv >= c30.adv, 'the per-point dial softens the lift and the odds follow', { softer: softer.lift, now: c30.lift })

// 3. the capacity: once a career
const C = await p.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, s = A.getState(), pl = s.player
  window.RIB_TUNE.v156Bplayoffs = 0
  pl.level = 7; pl.age = 25; for (const k in pl.attrs) pl.attrs[k] = 900; s.chaosCap = 6; s.chaos = {}; window.__chaosMaxV179(); s.objectivesCompleted = 40
  const cap0 = s.chaosCap, caps = []
  window.RIB_TUNE.ringPerfUffV186 = 0 // v186 gates a ring on the season's average; this test plays no games
  const champ = () => { if (pl.nflStateV11) pl.nflStateV11.status = 'starter' /* v186: and on starting */; pl.weekResults = []; pl.playoffState = { qualified: true, champion: true } } // a won season (simSeason reads the played playoffs)
  for (let i = 0; i < 8 && (pl.nflRings || 0) < 3; i++) { champ(); try { A.simSeason(pl) } catch (e) { caps.push('threw ' + e.message); break } caps.push(s.chaosCap + '/' + (pl.nflRings || 0)); window.__chaosMaxV179() }
  const rings = pl.nflRings || 0, cap1 = s.chaosCap
  // a new career: the next ring at full chaos raises it again
  pl.chaosBumpV185 = false; let cap2 = cap1
  for (let i = 0; i < 6; i++) { const r0 = pl.nflRings; champ(); try { A.simSeason(pl) } catch (e) { break } if (pl.nflRings > r0) { cap2 = s.chaosCap; break } }
  return { cap0, cap1, cap2, rings, caps, step: window.__V185.step(false), gate: window.__V186 && window.__V186.last(), st: pl.nflStateV11 && pl.nflStateV11.status }
})
ok(C.rings >= 2 && C.cap1 === C.cap0 + C.step, 'a career\'s rings at full chaos raise the capacity ONCE, by the step (3)', C)
ok(C.cap2 === C.cap1 + C.step, 'the next career\'s first ring raises it again', C)

// 4. the early-exit bank
const B = await p.evaluate(() => {
  const s = window.__GRIDIRON_AUDIT__.getState(); s.chaosCap = 20; s.chaos = {}; window.__chaosMaxV179()
  const V = window.__V185, m = V.ppMult(), e = [0, 3, 5, 7].map((lv) => +V.earned(lv).toFixed(2))
  window.RIB_TUNE.chaosBankExpV185 = 0; const flat = V.earned(3); delete window.RIB_TUNE.chaosBankExpV185
  return { m: +m.toFixed(2), e, flat: +flat.toFixed(2) }
})
ok(B.e[0] < B.e[1] && B.e[1] < B.e[2] && Math.abs(B.e[3] - B.m) < 0.01, 'an early exit keeps less of the chaos bonus; the UFF keeps all of it', B)
ok(Math.abs(B.flat - B.m) < 0.01, 'chaosBankExpV185 0: every exit keeps the whole bonus', B)

// 4b. the estimate: the full-chaos loop notches (each notch a wall, then the ring); below full the capacity never grows
const E = await p.evaluate(() => {
  const r = (t) => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, t); const e = window.__V182.eta(false); for (const k in t) delete window.RIB_TUNE[k]; return { ist: Math.round(e.ist), title: Math.round(e.title), notch: Math.round(e.notchSeasons), chaos: e.chaos } }
  return { full: r({}), part: r({ etaChaosShareV184: 0.7 }), none: r({ etaChaosShareV184: 0 }), steep: r({ chaosNeedPerV185: 0.05 }), big: r({ chaosCapStepV185: 6 }) }
})
ok(E.full.notch > 0 && E.part.notch === 0 && E.full.title < E.part.title && E.part.title < E.none.title && E.full.chaos > E.part.chaos, 'the estimate: the full-chaos loop is the fast road; below full the capacity stays and the title is far later', E)
ok(E.steep.notch > E.full.notch && E.big.notch > E.full.notch, 'a steeper wall or a bigger notch makes each notch take longer', { full: E.full.notch, steep: E.steep.notch, big: E.big.notch })

// 5. the beta menu
const M = await p.evaluate(() => { window.go('settings'); const c = document.getElementById('betaCardV181'); return { card: !!c, chaos: !!(c && /CHAOS/.test(c.textContent)), dials: ['chaosBoostBaseV185', 'chaosDeclareShareV185', 'chaosCapStepV185', 'chaosBankExpV185'].every((k) => !!document.getElementById('bt_' + k)) } })
ok(M.card && M.chaos && M.dials, 'the beta menu has the CHAOS group and its dials', M)

console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
if (errors.length) console.log('page errors:', errors.slice(0, 6))
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
