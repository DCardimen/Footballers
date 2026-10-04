// Dev check: v179 THE LONG ROAD (src/07-career-app.js) — the prestige pacing.
//   A: the last two climbs CAN ask for Legacy medals (off by default since v179 F) — College → Combine `gateCombineV179`, Combine → UFF `gateUffV179`; short
//      of them the declare is capped at `gateCapV179`% and the hub says how many medals the scouts want; with them the
//      odds are the game's own
//   B: the Interstellar Call waits on the era (`istEraV179`): a UFF ring in an early era cannot answer it (the hub says so,
//      declareFromHub refuses); in the era it can
//   C: big PP reads K / M / B / T (`fmtBigV179`) on the top bar; the career-end card keeps a raw number under 100,000
//   D: the medal rewards (TU v179G): a medal deals two cards, each with its context line; the 10th is a MAJOR — two face-down
//      unique permanent upgrades; a claim lands in treeFx (the game's own readers), a major is owned once, Head Start
//      points reach a new player, an old save is not handed its whole history, the hub carries the 🎁 chip; v179G 0 = none
//   E: the scouts' bar (TU v179H): at the Combine, an OVR well under `scoutBarUffV179` cuts the declare odds to single
//      digits and the hub names the bar; over it the odds are the game's own; every attempt eases it by `scoutBarDecayV179`
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

// A: the medal gate on the Combine → UFF climb
const A = await M(async () => {
  const AU = window.__GRIDIRON_AUDIT__, S = AU.freshState(); S.tutorialSeen = true; AU.setState(S)
  S.player = AU.newPlayer(); const p = S.player; p.pos = 'QB'; p.level = 6; p._wonShown = true; p.seasonsAtLevel = 1
  for (const k in p.attrs) p.attrs[k] = 300
  const G = window.__V179.medalGate(p)
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { gateUffV179: 999999 })
  const short = window.__V88.declareChance(p), Gs = window.__V179.medalGate(p)
  window.go('hub'); await new Promise((r) => setTimeout(r, 300))
  const note = (document.querySelector('#dock .gate-v179') || {}).textContent || ''
  window.RIB_TUNE.gateUffV179 = 0
  const open = window.__V88.declareChance(p)
  window.RIB_TUNE.v179 = 0; window.RIB_TUNE.gateUffV179 = 999999
  const off = window.__V88.declareChance(p)
  delete window.RIB_TUNE.v179; delete window.RIB_TUNE.gateUffV179
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

console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
if (errors.length) console.log('page errors:', errors.slice(0, 6))
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
