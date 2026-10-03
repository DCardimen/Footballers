// Dev check: v179 THE LONG ROAD (src/07-career-app.js) — the prestige pacing.
//   A: the last two climbs ask for Legacy medals — College → Combine `gateCombineV179`, Combine → UFF `gateUffV179`; short
//      of them the declare is capped at `gateCapV179`% and the hub says how many medals the scouts want; with them the
//      odds are the game's own
//   B: the Interstellar Call waits on the era (`istEraV179`): a UFF ring in an early era cannot answer it (the hub says so,
//      declareFromHub refuses); in the era it can
//   C: big PP reads K / M / B / T (`fmtBigV179`) on the top bar; the career-end card keeps a raw number under 100,000
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
ok(A.need > 0 && A.colNeed > 0 && A.need > A.colNeed, 'the Combine → UFF climb asks for more medals than College → Combine', { uff: A.need, combine: A.colNeed })
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
ok(C.a === '999' && C.b === '123K' && C.c === '2.50M' && C.d === '3.40B' && C.e === '7.10T' && C.f === '4.00Qa', 'PP reads K / M / B / T / Qa', C)
ok(C.bar === '3.40B', 'the top bar shows a billion PP as 3.40B', C.bar)

console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
if (errors.length) console.log('page errors:', errors.slice(0, 6))
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
