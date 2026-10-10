// Dev check: v195 A THE SCOUTS SEE THE SEASON (src/07-career-app.js).
//   1. A dominant season (top 10 at the position) with a fresh bloodline (no prestige, potential far under the bar)
//      gets a scouts' verdict of 10–20% at College → Combine and Combine → UFF (#1 → 20%); outside the top ten, or
//      at the Interstellar Call, no floor; the whole declare (season × verdict) for a #1 lands in 10–20%.
//   2. The pity timer: every failed declare eases that level's potential bar 8% (compounding, never under 35% of the
//      base); a make resets it; declareFromHub records both with the dice fixed.
//   3. A and A+ season grades need a top-10 rank at the position; else B+ (rankFloorV179 / gradeWhyHtmlV179 say why).
//   4. The hub line and HOW THE SCOUTS DECIDE name the floor and the pity. Kill switch v195A 0 restores v179.
//   No page errors.  GAME_URL=http://localhost:5173/ node scripts/v195Acheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } })
await ctx.addInitScript(() => {
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, {})
  try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
  setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80)
})
const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(String(e.message || e)))
await page.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V195A && !!window.__V179 && !!window.__V88, null, { timeout: 40000 })
await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
await page.evaluate(() => document.getElementById('splash')?.remove())
const M = (fn, arg) => page.evaluate(fn, arg)

// ---------------- 1. the dominant-season floor ----------------
const F = await M(() => {
  const AU = window.__GRIDIRON_AUDIT__, S = AU.freshState(); S.tutorialSeen = true; S.tree = {}; S.prestige = 0; AU.setState(S)
  S.player = AU.newPlayer(); const p = S.player; p.pos = 'QB'; p._wonShown = true; p.seasonsAtLevel = 1
  const at = (lv, attr) => { p.level = lv; for (const k in p.attrs) p.attrs[k] = attr; const B = window.__V179.bar(p); return { v: B.v, floor: B.floor, pot: B.pot, potBar: B.potBar, rank: window.__V195A.posRank(p), total: window.__V88.declareChance(p), season: window.__V88.declareChance(p, true) } }
  return { col1: at(5, 400), uff1: at(6, 400), colLow: at(5, 20), ist1: at(7, 400) }
})
console.log('F:', JSON.stringify(F))
ok(F.col1.rank && F.col1.rank.pos === 1 && F.col1.pot < F.col1.potBar * 0.5, 'the setup: a #1 at his position with a fresh bloodline far under the College bar', { rank: F.col1.rank, pot: F.col1.pot, bar: F.col1.potBar })
ok(Math.abs(F.col1.v - 0.2) < 0.005 && Math.abs(F.uff1.v - 0.2) < 0.005, 'a #1 season keeps the scouts\' verdict at 20% at College → Combine and Combine → UFF', { col: F.col1.v, uff: F.uff1.v })
ok(F.col1.total >= 10 && F.col1.total <= 21, 'the whole declare for a #1 with no prestige is 10–20%', { total: F.col1.total, season: F.col1.season })
ok(F.colLow.floor === 0 && F.colLow.v < 0.01, 'outside the top ten there is no floor', { rank: F.colLow.rank, v: F.colLow.v })
ok(F.ist1.floor === 0, 'the Interstellar Call stays the bloodline\'s (no floor at level 7)', F.ist1)
const F10 = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), p = S.player; p.level = 5; for (const k in p.attrs) p.attrs[k] = 400
  const T = window.RIB_TUNE; T.domTopV195A = 1; const one = window.__V195A.floor(p); delete T.domTopV195A
  return { one, def: window.__V195A.floor(p) }
})
ok(Math.abs(F10.def - 0.2) < 1e-9 && Math.abs(F10.one - 0.2) < 1e-9, 'the floor reads its tunables', F10)

// ---------------- 2. the pity timer ----------------
const P = await M(() => {
  const AU = window.__GRIDIRON_AUDIT__, S = AU.freshState(); S.tutorialSeen = true; S.tree = {}; AU.setState(S)
  S.player = AU.newPlayer(); const p = S.player; p.pos = 'QB'; p.level = 5; p._wonShown = true; p.seasonsAtLevel = 9
  for (const k in p.attrs) p.attrs[k] = 400
  const V = window.__V195A, b0 = window.__V179.bar(p).potBar
  for (let i = 0; i < 5; i++) V.record(5, false)
  const b5 = window.__V179.bar(p).potBar, n5 = V.pity(5)
  for (let i = 0; i < 60; i++) V.record(5, false)
  const bMin = window.__V179.bar(p).potBar
  V.record(5, true); const bReset = window.__V179.bar(p).potBar, n0 = V.pity(5)
  // the dice fixed: season ✓, verdict ✗, second look ✗ → a miss is recorded
  const R0 = Math.random, seq = (a) => { let i = 0; Math.random = () => a[Math.min(i++, a.length - 1)] }
  seq([0.01, 0.99, 0.99]); window.declareFromHub(); Math.random = R0
  const afterMiss = V.pity(5), lvMiss = S.player.level; document.getElementById('verdictV179')?.remove()
  const note = V.note()
  // a make resets it
  const S2 = AU.freshState(); S2.tutorialSeen = true; S2.tree = {}; S2.scoutPityV195A = { 5: 3 }; AU.setState(S2)
  S2.player = AU.newPlayer(); const q = S2.player; q.pos = 'QB'; q.level = 5; q._wonShown = true; q.seasonsAtLevel = 9
  for (const k in q.attrs) q.attrs[k] = 400
  seq([0.01, 0.1, 0.99]); window.declareFromHub(); Math.random = R0
  const afterMake = (S2.scoutPityV195A || {})[5], lvMake = q.level; const sub = (document.querySelector('#verdictV179') || {}).textContent || ''
  document.getElementById('verdictV179')?.remove()
  return { b0, b5, n5, bMin, bReset, n0, afterMiss, lvMiss, afterMake, lvMake, note, sub }
})
console.log('P:', JSON.stringify(P))
ok(P.n5 === 5 && Math.abs(P.b5 - P.b0 * Math.pow(0.92, 5)) <= 1, 'five misses ease the College bar 8% each, compounding', { b0: P.b0, b5: P.b5 })
ok(Math.abs(P.bMin - P.b0 * 0.35) <= 1, 'the bar never falls under 35% of its base', { bMin: P.bMin })
ok(P.n0 === 0 && P.bReset === P.b0, 'a make resets the level\'s count', { bReset: P.bReset })
ok(P.afterMiss === 1 && P.lvMiss === 5, 'declareFromHub records a miss (season ✓, verdict ✗, second look ✗)', { pity: P.afterMiss, level: P.lvMiss })
ok(P.afterMake === 0 && P.lvMake === 6, 'a #1 who beats the 20% verdict is in, and the count resets', { pity: P.afterMake, level: P.lvMake })
ok(/top-10 season/.test(P.note) && /passed 1×/.test(P.note), 'the hub note names the floor and the pity', P.note)
ok(/top-10 season keeps it at 20%/.test(P.sub), 'the verdict reveal says the season carried the scouts', P.sub.slice(0, 200))

// ---------------- 3. A is the top ten ----------------
const G = await M(() => {
  const AU = window.__GRIDIRON_AUDIT__, S = AU.freshState(); S.tutorialSeen = true; S.tree = {}; AU.setState(S)
  S.player = AU.newPlayer(); const p = S.player; p.pos = 'RB'; p.level = 5; p._wonShown = true
  const V = window.__V195A, R = window.__V179
  for (const k in p.attrs) p.attrs[k] = 400
  const top = { a: V.gradeCap('A'), ap: V.gradeCap('A+'), rf: R.rankFloor('A+', {}), rank: V.posRank(p) }
  for (const k in p.attrs) p.attrs[k] = 70
  const why = {}
  const mid = { a: V.gradeCap('A'), ap: V.gradeCap({ grade: 'A+' }).grade, b: V.gradeCap('B'), rf: R.rankFloor('A', why), rank: V.posRank(p), why: JSON.parse(JSON.stringify(why)) }
  const html = R.gradeWhy(Object.assign({ U: 90, Va: 80, bySay: 'x', needA: 87, needAp: 92, needB: 79 }, why), 'B+')
  window.RIB_TUNE.v195A = 0
  const off = { a: V.gradeCap('A'), rf: R.rankFloor('A', {}), floor: (p.level = 5, Object.keys(p.attrs).forEach(k => (p.attrs[k] = 400)), R.bar(p).floor) }
  delete window.RIB_TUNE.v195A
  return { top, mid, html, off }
})
console.log('G:', JSON.stringify(G))
ok(G.top.a === 'A' && G.top.ap === 'A+' && G.top.rf === 'A+', 'a top-10 player keeps his A and A+', G.top)
ok(G.mid.rank.pos > 10 && G.mid.a === 'B+' && G.mid.ap === 'B+' && G.mid.b === 'B' && G.mid.rf === 'B+', 'outside the top ten an A or A+ reads B+ (a B is untouched)', G.mid)
ok(/An A belongs to the top 10 at your position/.test(G.html), 'the report card says why', G.html.replace(/<[^>]+>/g, '').slice(0, 300))
ok(G.off.a === 'A' && G.off.rf === 'A' && G.off.floor === 0, 'v195A 0 restores v179 (no cap, no floor)', G.off)

// ---------------- 4. the explainer ----------------
const X = await M(() => {
  const AU = window.__GRIDIRON_AUDIT__, S = AU.freshState(); S.tutorialSeen = true; S.tree = {}; AU.setState(S)
  S.player = AU.newPlayer(); const p = S.player; p.pos = 'QB'; p.level = 5; p._wonShown = true
  return window.__V193E.explainHtml().replace(/<[^>]+>/g, '')
})
ok(/A dominant season always has a shot/.test(X) && /10–20%/.test(X) && /8%/.test(X), 'HOW THE SCOUTS DECIDE names the floor and the pity timer', X.slice(X.indexOf('A dominant'), X.indexOf('A dominant') + 260))

ok(errors.length === 0, 'no page errors', errors.slice(0, 3))
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
