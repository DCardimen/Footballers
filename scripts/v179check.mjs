// Dev check: v179 THE LONG ROAD (src/07-career-app.js) — the prestige pacing.
//   A: the last two climbs CAN ask for Legacy medals (off by default since v179 F) — College → Combine `gateCombineV179`, Combine → UFF `gateUffV179`; short
//      of them the declare is capped at `gateCapV179`% and the hub says how many medals the scouts want; with them the
//      odds are the game's own
//   B: the Interstellar Call CAN wait on the era (`istEraV179`, off by default since v179 J): a UFF ring in an early era cannot answer it (the hub says so,
//      declareFromHub refuses); in the era it can
//   C: big PP reads K / M / B / T (`fmtBigV179`) on the top bar; the career-end card keeps a raw number under 100,000
//   D: the medal rewards (TU v179G): a medal deals two cards, each with its context line; the 10th is a MAJOR — two face-down
//      unique permanent upgrades; a claim lands in treeFx (the game's own readers), a major is owned once, Head Start
//      points reach a new player, an old save is not handed its whole history, the hub carries the 🎁 chip; v179G 0 = none
//   E: the scouts' bar (TU v179H): at the Combine, an OVR well under `scoutBarUffV179` cuts the declare odds to single
//      digits and the hub names the bar; over it the odds are the game's own; every attempt eases it by `scoutBarDecayV179`
//   F: the scouts judge POTENTIAL (`scoutPotUffV179`): the growth ceiling the tree gives (`rawCeilingV179`) — a bloodline
//      far under the bar is single digits at the Combine and the hub explains what raises it; the ceiling nodes count
//      `ceilNodeMultV179`×, a plain level only `ceilPerLevelV179`
//   K: the scouts' verdict (TU v179K): a declare is two rolls — the season, then the verdict (a coin flip at the potential
//      bar, diminishing returns over it toward a ceiling the declare-odds prestige raises), and the GM's second look when
//      the verdict says no; College → Combine has its own bar; a full-screen reveal plays the rolls; v179K 0 = one roll
//   L: the prestige tree opens with the BLOODLINE POTENTIAL card (the number, its parts, the three bars and what is left)
//      and the MEDAL REWARDS card (every permanent bonus in plain stats, the majors owned and to find); a node that moves
//      potential says what its next level adds; the medal chooser's cards carry stat lines; TU v179L 0 = none of it
//   M: the fair grade — the bar caps at 86 (a dominant season can earn an A+), last season counts less 6, the national
//      standing at your position floors the letter, and the report card says why; TU v179M 0 = the old grade
//   N: Lucky Draw (Apex, 10,000 PP, ×3 a level): +20% a level for an extra card pick each game (Lv 5 every game, 810,000
//      PP); the upgrade-point cards pay 10% / 20% of the week (never less than +1 / +2); TU v179N 0 = flat
//   TU v179 0: no medal cap, the old Interstellar Call
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v179check.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = (...q) => url + (url.includes('?') ? '&' : '?') + ['stayStale', 'noFilmV114', 'noGrowV132'].concat(q).join('&')
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const context = await browser.newContext({ viewport: { width: 400, height: 860 } })
await context.addInitScript(() => {
  try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
  setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80)
})
const page = await context.newPage()
page.on('pageerror', (e) => errors.push(String(e.message || e)))
await page.goto(U(), { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V179 && !!window.__V88, null, { timeout: 40000 })
await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
await page.evaluate(() => document.getElementById('splash')?.remove())
const M = (fn, arg) => page.evaluate(fn, arg)
await M(() => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { scoutPotUffV179: 0 }) })

// A: the medal gate on the Combine → UFF climb
const A = await M(async () => {
  const AU = window.__GRIDIRON_AUDIT__, S = AU.freshState(); S.tutorialSeen = true; AU.setState(S)
  S.player = AU.newPlayer(); const p = S.player; p.pos = 'QB'; p.level = 6; p._wonShown = true; p.seasonsAtLevel = 1
  for (const k in p.attrs) p.attrs[k] = 300
  const G = window.__V179.medalGate(p)
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { gateUffV179: 999999, scoutBarUffV179: 0 })
  const short = window.__V88.declareChance(p), Gs = window.__V179.medalGate(p)
  window.go('hub'); await new Promise((r) => setTimeout(r, 300))
  const note = (document.querySelector('#dock .gate-v179') || {}).textContent || ''
  window.RIB_TUNE.gateUffV179 = 0
  const open = window.__V88.declareChance(p)
  window.RIB_TUNE.v179 = 0; window.RIB_TUNE.gateUffV179 = 999999
  const off = window.__V88.declareChance(p)
  delete window.RIB_TUNE.v179; delete window.RIB_TUNE.gateUffV179; delete window.RIB_TUNE.scoutBarUffV179
  const col = (() => { p.level = 5; const g = window.__V179.medalGate(p); p.level = 6; return g })()
  return { need: G.need, colNeed: col.need, short, open, off, gs: Gs, note }
})
console.log('A:', JSON.stringify(A))
ok(A.need === 0 && A.colNeed === 0, 'the medal walls ship off (the pacing is in the tree prices); `gateUffV179` / `gateCombineV179` turn them on', { uff: A.need, combine: A.colNeed })
ok(A.gs.short && A.short <= 2, 'short of the medals, the declare is capped at 2%', A.short)
ok(/Legacy medals/.test(A.note) && /999999/.test(A.note.replace(/,/g, '')), 'the hub says how many medals the scouts want', A.note)
ok(A.open > 2 && A.off > 2, 'with the medals (or TU v179 0) the odds are the game\'s own', { open: A.open, off: A.off })

// B: the Interstellar Call waits on the era
const B = await M(async () => {
  const S = window.__GRIDIRON_AUDIT__.getState(), p = S.player
  p.level = 7; p.nflRings = 1; p.seasonsAtLevel = 3; S.era = 1
  window.RIB_TUNE.istEraV179 = 6; window.RIB_TUNE.istPotV179 = 0 // the optional era gate (off by default since v179 J)
  const g1 = window.__V179.gate(p)
  window.go('hub'); await new Promise((r) => setTimeout(r, 300))
  const btn = [...document.querySelectorAll('#dock button')].some((b) => /Interstellar Call/.test(b.textContent))
  const note = (document.querySelector('#dock .gate-v179') || {}).textContent || ''
  const lv0 = p.level; window.declareFromHub(); const lv1 = p.level
  S.era = g1.need
  const g2 = window.__V179.gate(p)
  window.go('hub'); await new Promise((r) => setTimeout(r, 300))
  const btn2 = [...document.querySelectorAll('#dock button')].some((b) => /Interstellar Call/.test(b.textContent))
  window.RIB_TUNE.v179 = 0; S.era = 1; const g0 = window.__V179.gate(p); delete window.RIB_TUNE.v179
  delete window.RIB_TUNE.istEraV179; delete window.RIB_TUNE.istPotV179
  return { g1, btn, note, lv0, lv1, g2, btn2, g0 }
})
console.log('B:', JSON.stringify(B))
ok(!B.g1.ok && B.g1.need > 1 && !B.btn && /era/.test(B.note), 'a UFF ring in an early era cannot answer the Interstellar Call — the hub says which era it waits for', B.note)
ok(B.lv1 === B.lv0, 'declareFromHub refuses the call before the era', { before: B.lv0, after: B.lv1 })
ok(B.g2.ok && B.btn2, 'in the era the call is open', B.g2)
ok(B.g0.ok, 'TU v179 0: the old call (a ring is enough)', B.g0)

// C: big numbers
const C = await M(() => {
  const f = window.__V179.fmt, S = window.__GRIDIRON_AUDIT__.getState()
  S.pp = 3.4e9; window.go('hub')
  const bar = (document.getElementById('ppCount') || {}).textContent
  return { a: f(999), b: f(123456), c: f(2.5e6), d: f(3.4e9), e: f(7.1e12), f: f(4e15), bar }
})
console.log('C:', JSON.stringify(C))
ok(C.a === '999' && C.b === '123.46K' && C.c === '2.5M' && C.d === '3.4B' && C.e === '7.1T' && C.f === '4Qa', 'PP reads K / M / B / T / Qa (the v146 C style)', C)
ok(C.bar === '3.4B', 'the top bar shows a billion PP as 3.4B', C.bar)

// D: the medal rewards
const D = await M(async () => {
  const AU = window.__GRIDIRON_AUDIT__, S = AU.freshState(); S.tutorialSeen = true; S.player = AU.newPlayer(); S.player.pos = 'QB'; S.player._wonShown = true; S.careers = 3; AU.setState(S)
  const Md = window.__V179.medals, st = Md.store()
  const synced = Md.sync() // an old save starts where it is
  const small = Md.deal(7, st), major = Md.deal(10, st)
  st.pending = [small, major]
  window.go('hub'); await new Promise((r) => setTimeout(r, 300))
  const chip = (document.getElementById('medalChipV179') || {}).textContent || ''
  Md.open(); await new Promise((r) => setTimeout(r, 100))
  const cards0 = document.querySelectorAll('#medalPickV179 .mp-card').length
  const ctx = [...document.querySelectorAll('#medalPickV179 .mp-face em')].map((e) => e.textContent)
  const pp0 = S.pp || 0, fx0 = JSON.stringify(st.fx)
  Md.tap(0) // claims the small card
  const gotSmall = st.log[st.log.length - 1], fx1 = JSON.stringify(st.fx), pp1 = S.pp || 0
  await new Promise((r) => setTimeout(r, 100))
  const down = document.querySelectorAll('#medalPickV179 .mp-card.down').length
  Md.tap(0) // turns the major over
  const down2 = document.querySelectorAll('#medalPickV179 .mp-card.down').length
  // claim a known major to prove the effect path
  st.pending = [{ rank: 20, major: true, opts: [{ id: 'silverSpoon', fx: { startAll: 3 } }, { id: 'headStart', fx: { startPointsV179: 10 } }] }]
  const all0 = AU.treeFx ? AU.treeFx('startAll') : null
  Md.claim(0)
  const all1 = AU.treeFx ? AU.treeFx('startAll') : null
  st.pending = [{ rank: 30, major: true, opts: [{ id: 'headStart', fx: { startPointsV179: 10 } }, { id: 'fortune', fx: { ppMult: 0.1 } }] }]
  const pts0 = (Md.newPlayer().points || 0); Md.claim(0); const pts1 = (Md.newPlayer().points || 0)
  const next = Md.deal(40, st), nextIds = next.opts.map((c) => c.id)
  const unique = !nextIds.includes('silverSpoon') && !nextIds.includes('headStart')
  document.getElementById('medalPickV179')?.remove()
  st.pending = []; const era0 = S.era || 0
  let eraUp = false, eraP = null
  if (window.__V179.medals.eraUp) { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { eraChaosStepV179: 0 }); eraUp = window.__V179.medals.eraUp(); delete window.RIB_TUNE.eraChaosStepV179; eraP = st.pending[0] || null }
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v179G: 0 }); st.pending = [small]
  window.go('hub'); await new Promise((r) => setTimeout(r, 300))
  const chipOff = !!document.getElementById('medalChipV179'), fxOff = Md.fx('startAll')
  delete window.RIB_TUNE.v179G
  return { eraUp, eraP: eraP && { era: eraP.era, major: eraP.major, n: eraP.opts.length, name: eraP.eraName }, era0, synced, small: small.opts.map((c) => c.id), smallMajor: small.major, major: major.opts.map((c) => c.id), majorFlag: major.major, chip, cards0, ctx, pp0, pp1, fx0, fx1, gotSmall, down, down2, all0, all1, pts0, pts1, nextIds, unique, chipOff, fxOff }
})
console.log('D:', JSON.stringify(D))
ok(D.synced === 0, 'an old save is not handed its whole medal history at once', D.synced)
ok(!D.smallMajor && D.small.length === 2 && D.majorFlag && D.major.length === 2, 'a medal deals two cards; the 10th is a MAJOR with two', { small: D.small, major: D.major })
ok(/2/.test(D.chip) && /MYSTERY/.test(D.chip), 'the hub carries the 🎁 medal-reward chip (and says a mystery major waits)', D.chip)
ok(D.cards0 === 2 && D.ctx.length === 2 && D.ctx.every((t) => t.length > 20), 'the chooser shows two cards, each saying what it does and where', D.ctx)
ok(D.gotSmall && (D.fx1 !== D.fx0 || D.pp1 > D.pp0 || /look|\(/.test(D.gotSmall.name)), 'claiming a small card pays it (PP, a permanent effect or a look)', D.gotSmall)
ok(D.down === 2 && D.down2 === 0, 'the major\'s cards are face-down until the first tap turns them over', { before: D.down, after: D.down2 })
ok(D.all0 != null && D.all1 - D.all0 === 3, 'Silver Spoon lands in treeFx: +3 to every starting attribute', { before: D.all0, after: D.all1 })
ok(D.pts1 - D.pts0 === 10, 'Head Start: a new player carries 10 upgrade points', { before: D.pts0, after: D.pts1 })
ok(D.unique, 'an owned major is never dealt again', D.nextIds)
ok(D.eraUp && D.eraP && D.eraP.major && D.eraP.n === 2 && D.eraP.era === D.era0 + 1, 'a new era deals a mystery major too', D.eraP)
ok(!D.chipOff && D.fxOff === 0, 'TU v179G 0: no chip, no effects', { chip: D.chipOff, fx: D.fxOff })

// E: the scouts' bar
const E = await M(async () => {
  const AU = window.__GRIDIRON_AUDIT__, S = AU.freshState(); S.tutorialSeen = true; AU.setState(S)
  S.player = AU.newPlayer(); const p = S.player; p.pos = 'QB'; p.level = 6; p._wonShown = true; p.seasonsAtLevel = 1
  for (const k in p.attrs) p.attrs[k] = 300
  const ovr = window.__V179.bar(p).ovr || Math.round(AU.playerOVR(p)), T = window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, {})
  const free = window.__V88.declareChance(p)
  T.scoutBarUffV179 = ovr + 30; T.scoutBarDecayV179 = 2
  const under = window.__V88.declareChance(p), B = window.__V179.bar(p)
  window.go('hub'); await new Promise((r) => setTimeout(r, 300))
  const note = (document.querySelector('#dock .gate-v179') || {}).textContent || ''
  S.scoutTriesV179 = { 6: 5 }; const eased = window.__V179.bar(p).bar
  S.scoutTriesV179 = {}
  T.scoutBarUffV179 = ovr - 30; const over = window.__V88.declareChance(p)
  T.scoutBarUffV179 = ovr + 30; T.v179H = 0; const off = window.__V88.declareChance(p)
  delete T.v179H; delete T.scoutBarUffV179; delete T.scoutBarDecayV179
  return { ovr, free, under, bar: B.bar, note, eased, over, off }
})
console.log('E:', JSON.stringify(E))
ok(E.under < 10 && E.free > 50, 'well under the scouts\' bar the Combine declare is single digits', { free: E.free, under: E.under })
ok(/scouts' bar/.test(E.note) && E.note.includes(String(E.bar)), 'the hub names the bar', E.note)
ok(E.eased === E.bar - 10, 'every attempt eases the bar', { bar: E.bar, after5: E.eased })
ok(E.over > 50 && E.off > 50, 'over the bar (or TU v179H 0) the odds are the game\'s own', { over: E.over, off: E.off })

// F: potential
const F = await M(async () => {
  delete window.RIB_TUNE.scoutPotUffV179
  const AU = window.__GRIDIRON_AUDIT__, S = AU.freshState(); S.tutorialSeen = true; AU.setState(S)
  S.player = AU.newPlayer(); const p = S.player; p.pos = 'QB'; p.level = 6; p._wonShown = true; p.seasonsAtLevel = 1
  for (const k in p.attrs) p.attrs[k] = 300
  const pot0 = window.__V179.potential(), B = window.__V179.bar(p), low = window.__V88.declareChance(p)
  window.go('hub'); await new Promise((r) => setTimeout(r, 300))
  const note = (document.querySelector('#dock .gate-v179') || {}).textContent || ''
  S.tree = Object.assign({}, S.tree, { etFortune: 40 }); const potEt = window.__V179.potential()
  S.tree = { freak: 2 }; const potFreak = window.__V179.potential()
  S.tree = {}; window.RIB_TUNE.scoutPotUffV179 = Math.round(pot0) - 40; const high = window.__V88.declareChance(p)
  delete window.RIB_TUNE.scoutPotUffV179
  return { pot0, potBar: B.potBar, low, note, potEt, potFreak, high }
})
console.log('F:', JSON.stringify(F))
ok(F.potBar > F.pot0 + 30 && F.low < 10, 'a fresh bloodline far under the scouts\' potential bar is single digits at the Combine', F)
ok(/POTENTIAL/.test(F.note) && /Freak/.test(F.note), 'the hub says the scouts judge potential and what raises it', F.note)
ok(F.potEt - F.pot0 < 2 && F.potFreak - F.pot0 >= 70, 'forty levels of an eternal stack barely move potential; two levels of Freak move it by 72', { base: F.pot0, eternal40: F.potEt, freak2: F.potFreak })
ok(F.high > 50, 'over the potential bar the odds are the game\'s own', F.high)

// J: the Interstellar Call judges potential
const J = await M(async () => {
  const AU = window.__GRIDIRON_AUDIT__, S = AU.freshState(); S.tutorialSeen = true; AU.setState(S)
  S.player = AU.newPlayer(); const p = S.player; p.pos = 'QB'; p.level = 7; p._wonShown = true; p.nflRings = 1; p.seasonsAtLevel = 3
  for (const k in p.attrs) p.attrs[k] = 300
  const B = window.__V179.bar(p), low = window.__V88.declareChance(p), gate = window.__V179.gate(p)
  window.go('hub'); await new Promise((r) => setTimeout(r, 300))
  const note = (document.querySelector('#dock .gate-v179') || {}).textContent || ''
  window.RIB_TUNE.istPotV179 = Math.round(B.pot) - 60; const high = window.__V88.declareChance(p)
  window.RIB_TUNE.istPotV179 = 0; const base = window.__V88.declareChance(p); delete window.RIB_TUNE.istPotV179
  return { potBar: B.potBar, pot: B.pot, low, gate, note, high, base }
})
console.log('J:', JSON.stringify(J))
ok(J.gate.ok && J.potBar > J.pot && J.low <= Math.max(0.3, J.base * 0.01), 'the Interstellar Call is open in any era, but a bloodline far under its potential bar is single digits', J)
ok(/Interstellar League/.test(J.note) && /POTENTIAL/.test(J.note), 'the hub says the Interstellar League judges potential', J.note)
ok(J.high > J.base * 0.5 && J.high < J.base, 'over the bar the call is the season\'s odds times the scouts\' verdict', { high: J.high, base: J.base })

// K: the scouts' verdict
const K = await M(async () => {
  const AU = window.__GRIDIRON_AUDIT__, S = AU.freshState(); S.tutorialSeen = true; AU.setState(S)
  S.player = AU.newPlayer(); const p = S.player; p.pos = 'QB'; p.level = 6; p._wonShown = true; p.seasonsAtLevel = 1
  for (const k in p.attrs) p.attrs[k] = 300
  const T = window.RIB_TUNE, pot = window.__V179.potential()
  const at = (bar) => { T.scoutPotUffV179 = bar; return window.__V179.bar(p) }
  const atBar = at(pot).v, over35 = at(pot / 1.35).v, over2 = at(pot / 2).v, over4 = at(pot / 4).v, vMax = at(pot / 4).vMax
  const st = window.__V179.medals.store(); st.fx.advFlat = 10
  const B10 = at(pot / 2); delete st.fx.advFlat
  p.level = 5; delete T.scoutPotUffV179; const col = window.__V179.bar(p); p.level = 6
  // the rolls, with the dice fixed: season ✓ · verdict ✗ · second look ✓ → in
  T.scoutPotUffV179 = pot / 2
  const R0 = Math.random, seq = (a) => { let i = 0; Math.random = () => a[Math.min(i++, a.length - 1)] }
  seq([0.01, 0.99, 0.01]); window.declareFromHub(); Math.random = R0
  const lvA = p.level, last1 = window.__V179.verdict && window.__V179.verdict(), rows1 = document.querySelectorAll('#verdictV179 .vr-row').length, end1 = (document.querySelector('#verdictV179 .vr-end') || {}).textContent || ''
  document.getElementById('verdictV179')?.remove()
  // season ✓ · verdict ✗ · second look ✗ → not this year
  const S2 = AU.freshState(); S2.tutorialSeen = true; AU.setState(S2); S2.player = AU.newPlayer(); const q = S2.player; q.pos = 'QB'; q.level = 6; q._wonShown = true; q.seasonsAtLevel = 1
  for (const k in q.attrs) q.attrs[k] = 300
  seq([0.01, 0.99, 0.99]); window.declareFromHub(); Math.random = R0
  const lvB = q.level, rows2 = document.querySelectorAll('#verdictV179 .vr-row').length, end2 = (document.querySelector('#verdictV179 .vr-end') || {}).textContent || ''
  document.getElementById('verdictV179')?.remove()
  T.v179K = 0; const off = window.__V179.bar(q); delete T.v179K; delete T.scoutPotUffV179
  return { atBar, over35, over2, over4, vMax, v10: B10.v, vMax10: B10.vMax, sl: B10.sl, col: col.potBar, lvA, rows1, end1, lvB, rows2, end2, offV: off.v, offSl: off.sl, colOff: null }
})
console.log('K:', JSON.stringify(K))
ok(Math.abs(K.atBar - 0.5) < 0.01, 'at the potential bar the scouts\' verdict is a coin flip', K.atBar)
ok(K.over35 > 0.65 && K.over2 > K.over35 && K.over4 > K.over2 && K.over4 < K.vMax && K.vMax < 0.85, 'over the bar: diminishing returns toward a ceiling (80% with no declare-odds prestige)', { over35: K.over35, over2: K.over2, over4: K.over4, vMax: K.vMax })
ok(K.vMax10 > K.vMax && K.v10 > K.over2 && K.sl > 0.15, 'declare-odds prestige raises the ceiling and the GM\'s second look', { vMax10: K.vMax10, v10: K.v10, secondLook: K.sl })
ok(K.col > 0 && K.col < 150, 'College → Combine has its own (lower) potential bar', K.col)
ok(K.lvA === 7 && K.rows1 === 3 && /IN/.test(K.end1), 'season ✓ · verdict ✗ · second look ✓: he is in, and the reveal plays all three rolls', { level: K.lvA, rows: K.rows1, end: K.end1 })
ok(K.lvB === 6 && K.rows2 === 3 && /NOT THIS YEAR/.test(K.end2), 'season ✓ · verdict ✗ · second look ✗: not this year', { level: K.lvB, rows: K.rows2, end: K.end2 })
ok(K.offSl === 0, 'TU v179K 0: no second look (the one-roll declare)', { v: K.offV, sl: K.offSl })

// L: the bloodline on the tree
const L = await M(async () => {
  const AU = window.__GRIDIRON_AUDIT__, S = AU.freshState(); S.tutorialSeen = true; S.pp = 5e6
  S.tree = { freak: 2, juggernaut: 1, etFortune: 12 }; AU.setState(S)
  const st = window.__V179.medals.store(); st.fx = { ppMult: 0.12, startAll: 3, advFlat: 4 }; st.owned = { silverSpoon: true }
  window.go('shop'); await new Promise((r) => setTimeout(r, 400))
  const card = document.getElementById('potCardV179'), mc = document.getElementById('medalCardV179')
  const big = (card && card.querySelector('.pv-h b') || {}).textContent, bars = card ? card.querySelectorAll('.pv-bars > div').length : 0
  const parts = window.__V179.parts(), gainFreak = window.__V179.potGain('freak'), gainFortune = window.__V179.potGain('etFortune')
  const tags = [...document.querySelectorAll('.pot-tag-v179')].map((t) => t.textContent)
  const medalText = mc ? mc.textContent : ''
  st.pending = [{ rank: 20, major: true, opts: [{ id: 'silverSpoon', icon: '🥄', name: 'Silver Spoon', rar: 'legendary', fx: { startAll: 3 }, ctx: 'x' }, { id: 'fortune', icon: '🏦', name: 'Fortune', rar: 'legendary', fx: { ppMult: 0.1 }, ctx: 'y' }] }]
  window.__V179.medals.open(); await new Promise((r) => setTimeout(r, 100))
  const fxLines = [...document.querySelectorAll('#medalPickV179 .mp-fx')].map((x) => x.textContent)
  window.__V179.medals.close(); st.pending = []
  window.RIB_TUNE.v179L = 0; window.go('menu'); window.go('shop'); await new Promise((r) => setTimeout(r, 300))
  const off = !!document.getElementById('potCardV179') || document.querySelectorAll('.pot-tag-v179').length > 0; delete window.RIB_TUNE.v179L
  return { big, bars, total: Math.round(parts.total), nodes: parts.nodes, gainFreak, gainFortune, tags, medalText: medalText.replace(/\s+/g, ' ').slice(0, 1500), fxLines, off }
})
console.log('L:', JSON.stringify(L))
ok(L.big === String(L.total) && L.bars === 3, 'the prestige tree opens with the bloodline potential and its three bars', { shown: L.big, potential: L.total, bars: L.bars })
ok(L.nodes === 2 * 12 * 3 + 12 * 3 && Math.round(L.gainFreak) === 36 && L.gainFortune < 0.95, 'the parts add up: Freak 2 (+72) and Juggernaut 1 (+36) at ×3; a Freak level adds 36, an eternal Fortune level nothing', { nodes: L.nodes, freak: L.gainFreak, fortune: L.gainFortune })
ok(L.tags.some((t) => /\+36 POTENTIAL/.test(t)), 'a node card that moves potential says what its next level adds', L.tags)
ok(/\+12% Prestige Points from every source/.test(L.medalText) && /\+3 to every starting attribute/.test(L.medalText) && /declare odds/.test(L.medalText) && /OWNED/.test(L.medalText), 'the medal card lists every permanent bonus in plain stats and the majors owned', L.medalText)
ok(L.fxLines.length === 2 && /every starting attribute/.test(L.fxLines[0]) && /Prestige Points/.test(L.fxLines[1]), 'the medal chooser\'s cards carry their stat lines', L.fxLines)
ok(!L.off, 'TU v179L 0: no card, no tags', L.off)

// M: the fair grade
const MG = await M(async () => {
  const AU = window.__GRIDIRON_AUDIT__, S = AU.freshState(); S.tutorialSeen = true; AU.setState(S)
  S.player = AU.newPlayer(); const p = S.player; p.pos = 'WR'; p.level = 7; p._wonShown = true
  for (const k in p.attrs) p.attrs[k] = 300
  const V = window.__V179
  const star = V.fairGrade(100, 0.9, 72)
  p.performanceExpectationV12 = 95; const repeat = V.fairGrade(95, 0.9, 72)
  delete p.performanceExpectationV12
  const html = V.gradeWhy(star, star.grade)
  window.RIB_TUNE.v179M = 0; const offFloor = V.rankFloor('D', {}); delete window.RIB_TUNE.v179M
  const why = {}; const floored = V.rankFloor('D', why)
  return { star, repeat, html, offFloor, floored, why }
})
console.log('M:', JSON.stringify(MG).slice(0, 700))
ok(MG.star.grade === 'A+' && MG.star.Va <= 86, 'a dominant UFF season (100 a game) can earn an A+ — the bar caps at 86', { grade: MG.star.grade, bar: MG.star.Va, A: MG.star.needA, Ap: MG.star.needAp })
ok(['A', 'A+'].includes(MG.repeat.grade), 'repeating a great season keeps an A (last season counts less 6)', MG.repeat)
ok(/Why A\+/.test(MG.html) && /averaged/.test(MG.html) && /A at \d+\+/.test(MG.html), 'the report card says why: the average, the bar, what an A takes', MG.html.replace(/<[^>]+>/g, '').slice(0, 220))
ok(MG.offFloor === 'D' && (MG.floored !== 'D' ? !!MG.why.floored : true) && MG.why.rank && MG.why.rank.of > 0, 'the national standing at your position floors the letter (and TU v179M 0 does not)', { off: MG.offFloor, floored: MG.floored, rank: MG.why.rank })

// N: Lucky Draw and the percent cards
const N = await M(async () => {
  const AU = window.__GRIDIRON_AUDIT__, S = AU.freshState(); S.tutorialSeen = true; AU.setState(S)
  S.player = AU.newPlayer(); const p = S.player; p.pos = 'WR'; p.level = 4; p._wonShown = true; p.seasonSeed = 7
  const node = AU.TREE_NODES.luckyDraw, c1 = AU.nodeCost(node)
  S.tree = { luckyDraw: 4 }; const c5 = AU.nodeCost(node)
  const freq = (lv) => { S.tree = lv ? { luckyDraw: lv } : {}; let n = 0; for (let w = 1; w <= 400; w++) if (window.__V179.flipDeal({ week: w, opp: 'X' + w }, 1).lucky) n++; return n / 400 }
  const f = [0, 1, 3, 5].map(freq)
  S.tree = { luckyDraw: 5 }; const d5 = window.__V179.flipDeal({ week: 3, opp: 'Y' }, 2)
  const p0 = p.points || 0
  const big = window.__V179.applyFlip('pt1', { payV178: { whole: 60 } }), small = window.__V179.applyFlip('pt1', { payV178: { whole: 3 } }), two = window.__V179.applyFlip('pt2', { payV178: { whole: 60 } })
  window.RIB_TUNE.v179N = 0; const flat = window.__V179.applyFlip('pt1', { payV178: { whole: 60 } }); delete window.RIB_TUNE.v179N
  return { c1, c5, f, d5: { n: d5.n, deck: d5.deck.length, lucky: d5.lucky }, big, small, two, flat, gained: (p.points || 0) - p0 }
})
console.log('N:', JSON.stringify(N))
ok(N.c1 === 10000 && N.c5 === 810000, 'Lucky Draw costs 10,000 PP, and the 100% level 810,000', { lv1: N.c1, lv5: N.c5 })
ok(N.f[0] === 0 && Math.abs(N.f[1] - 0.2) < 0.07 && Math.abs(N.f[2] - 0.6) < 0.08 && N.f[3] === 1, 'an extra card 20% of games a level — every game at Lv 5', N.f)
ok(N.d5.lucky && N.d5.n === 3 && N.d5.deck >= 3, 'the lucky game deals the extra pick (a watched game: 2 + 1)', N.d5)
ok(N.big === 6 && N.small === 1 && N.two === 12 && N.flat === 1 && N.gained === 6 + 1 + 12 + 1, 'the points cards pay 10% / 20% of the week (never under +1 / +2); TU v179N 0 = flat', { pct10of60: N.big, of3: N.small, pct20of60: N.two, flat: N.flat })

console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
if (errors.length) console.log('page errors:', errors.slice(0, 6))
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
