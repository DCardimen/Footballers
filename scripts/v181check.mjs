// Dev check: v181 THE BETA BENCH (src/07-career-app.js).
//   1. Settings carries 🧪 BETA TUNING with its eighteen dials, grouped (costs, gains, the scouts, cards & grades)
//   2. a dial moves the live tune at once: the core tree price doubles a core node's cost; the PP gain dial multiplies
//      the era payout; the device keeps a moved dial (localStorage, not the save) and applies it at the next boot;
//      "Reset all" clears them
//   3. the championship, locked to "play it live", carries a 🧪 BETA skip that sims it (the week is played, the lock is
//      back afterwards); TU v181 0 hides both
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v181check.mjs
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
  setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80)
})
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push(String(e.message || e)))
const boot = async () => {
  await page.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V181, null, { timeout: 40000 })
  await page.evaluate(() => document.getElementById('splash')?.remove())
}
await boot()
await page.evaluate(() => { try { localStorage.removeItem('rib.betaTune.v181') } catch {} })

// 1. the card
const C = await page.evaluate(async () => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S)
  window.go('settings'); await new Promise((r) => setTimeout(r, 300))
  const card = document.getElementById('betaCardV181')
  return { card: !!card, sliders: card ? card.querySelectorAll('input[type=range]').length : 0, text: card ? card.textContent.replace(/\s+/g, ' ').slice(0, 160) : '' }
})
ok(C.card && C.sliders >= 10 && C.sliders <= 20 && /PRESTIGE COSTS/.test(C.text) || (C.card && C.sliders === 18), 'Settings carries 🧪 BETA TUNING with its dials', { sliders: C.sliders })

// 2. a dial moves the live tune; the device keeps it
const D = await page.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, n = A.TREE_NODES.genetics, c0 = A.nodeCost(n), e0 = A.eraMult()
  window.__V181.set('corePriceV179', 12, 1); window.__V181.set('betaPPGainV181', 2, 1)
  const c1 = A.nodeCost(n), e1 = A.eraMult(), stored = window.__V181.read(), saveHas = JSON.stringify(A.getState()).includes('betaPPGainV181')
  return { c0, c1, e0, e1, stored, saveHas, label: (document.getElementById('bt_corePriceV179_val') || {}).textContent }
})
ok(D.c1 === D.c0 * 2 && D.e1 === D.e0 * 2, 'a dial moves the live tune: the core price ×12 doubles a core node; the gain dial ×2 doubles the era payout', D)
ok(D.stored.corePriceV179 === 12 && D.stored.betaPPGainV181 === 2 && !D.saveHas, 'the device keeps the moved dials — never in the save', { stored: D.stored, inSave: D.saveHas })
await boot()
const R = await page.evaluate(() => ({ core: window.RIB_TUNE.corePriceV179, gain: window.RIB_TUNE.betaPPGainV181 }))
ok(R.core === 12 && R.gain === 2, 'a reload applies the device\'s dials at boot', R)
const Z = await page.evaluate(async () => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S); window.go('settings'); await new Promise((r) => setTimeout(r, 200))
  window.__V181.reset(); await new Promise((r) => setTimeout(r, 200))
  return { stored: window.__V181.read(), core: window.RIB_TUNE.corePriceV179, cost: A.nodeCost(A.TREE_NODES.genetics) }
})
ok(Object.keys(Z.stored).length === 0 && Z.core == null, '"Reset all" clears them (the game\'s values again)', Z)

// 3. the championship skip
const T = await page.evaluate(async () => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S)
  S.player = A.newPlayer(); const p = S.player; p.pos = 'WR'; p.level = 3; p._wonShown = true; p.name = 'Beta Man'; p.originV11 = 'walk-on'
  for (const k in p.attrs) p.attrs[k] = 90
  A.startSeasonGames()
  // a won season and a won bracket, up to the CHAMPIONSHIP (the one week the game locks to "play it live")
  const win = (w) => Object.assign(w, { played: true, won: true, us: 28, them: 7, perf: 80 })
  const rounds = A.playoffRoundNames(p.level), finalName = rounds[rounds.length - 1]
  for (let k = 0; k < 30; k++) {
    const left = p.weekResults.filter((w) => !w.played)
    if (left[0] && left[0].playoff && left[0].round === finalName) break
    if (left[0]) win(left[0])
    try { A.ensurePlayoffs(p) } catch (e) {}
  }
  window.go('season'); await new Promise((r) => setTimeout(r, 300))
  const next = (p.weekResults || []).find((w) => !w.played)
  const btn = document.getElementById('betaSkipV181'), label = btn ? btn.textContent : ''
  const lockBefore = window.RIB_TUNE.v156Bplayoffs
  window.RIB_TUNE.v181 = 0; window.go('season'); await new Promise((r) => setTimeout(r, 200)); const hidden = !document.getElementById('betaSkipV181'); delete window.RIB_TUNE.v181
  window.go('season'); await new Promise((r) => setTimeout(r, 200))
  let played = false
  if (next) { const idx = p.weekResults.indexOf(next); window.__V181.skip(); const cur = () => (A.getState().player.weekResults || [])[idx] || {}; for (let i = 0; i < 100 && !cur().played; i++) await new Promise((r) => setTimeout(r, 150)); played = !!cur().played; window.__dbgV181 = { view: A.getState().view, champ: A.getState().player.playoffState, toast: (document.getElementById('toast') || {}).textContent } }
  await new Promise((r) => setTimeout(r, 400))
  return { dbg: window.__dbgV181, next: next && { playoff: next.playoff, round: next.round }, label, hidden, played, lockAfter: window.RIB_TUNE.v156Bplayoffs, lockBefore, skips: window.__V181.state.skips }
})
console.log('T:', JSON.stringify(T))
ok(T.next && T.next.playoff && /BETA/.test(T.label), 'the locked championship week carries the 🧪 BETA skip', { next: T.next, label: T.label })
ok(T.played && T.skips === 1, 'the beta skip sims the championship', { played: T.played })
ok(T.lockAfter === T.lockBefore, 'and the play-it-live lock is back afterwards', { before: T.lockBefore, after: T.lockAfter })
ok(T.hidden, 'TU v181 0: no beta skip', T.hidden)

console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
if (errors.length) console.log('page errors:', errors.slice(0, 6))
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
