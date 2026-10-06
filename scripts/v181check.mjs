// Dev check: v181 THE BETA BENCH (src/07-career-app.js).
//   1. Settings carries 🧪 BETA TUNING with its eighteen dials, grouped (costs, gains, the scouts, cards & grades)
//   2. a dial moves the live tune at once: the core tree price doubles a core node's cost; the PP gain dial multiplies
//      the era payout; the device keeps a moved dial (localStorage, not the save) and applies it at the next boot;
//      "Reset all" clears them
//   4. (v182) the POST-GAME CARDS dials scale the cards (the face reads the dial), and THE ESTIMATE (time to the UFF, the
//      Interstellar League, its title) sits on the card and moves with the dials
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
ok(C.card && C.sliders >= 18, 'Settings carries 🧪 BETA TUNING with its dials', { sliders: C.sliders })

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

// 4. v182: the post-game cards and the estimate
const E = await page.evaluate(async () => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S)
  S.player = A.newPlayer(); const p = S.player; p.pos = 'WR'; p.level = 3; p._wonShown = true; p.originV11 = 'walk-on'; p.coachTrust = 50
  window.go('settings'); await new Promise((r) => setTimeout(r, 300))
  const panel0 = (document.getElementById('betaEtaV182') || {}).textContent || ''
  const e0 = window.__V182.eta(false)
  window.__V181.set('corePriceV179', 2, 0); const e1 = window.__V182.eta(false)
  const panel1 = (document.getElementById('betaEtaV182') || {}).textContent || ''
  window.__V181.set('istPotV179', 3000, 0); const e2 = window.__V182.eta(false)
  window.__V181.set('flipTrustV182', 10, 0); window.__V181.set('flipPPV182', 50, 0)
  const t0 = p.coachTrust; window.__V178 && window.__V179.applyFlip('trust', {}); const t1 = p.coachTrust
  const pp0 = S.pp || 0, bank0 = S.ppBankV136 || 0; window.__V179.applyFlip('pp', {}); const ppGot = (S.pp || 0) - pp0 + ((S.ppBankV136 || 0) - bank0)
  const html = window.__V178.reel ? '' : ''
  window.__V181.reset()
  return { panel0: panel0.slice(0, 600), changed: panel0 !== panel1, e0, e1, e2, trust: t1 - t0, ppGot }
})
console.log('E:', JSON.stringify(E).slice(0, 600))
ok(/Reach the UFF/.test(E.panel0) && /Interstellar title/.test(E.panel0), 'the beta card shows the estimated time to the UFF, the Interstellar League and its title', E.panel0)
ok(E.e1.uff < E.e0.uff && E.e1.ist < E.e0.ist && E.changed, 'cheaper prices shorten the estimate, and the panel redraws as the dial moves', { before: Math.round(E.e0.uff), after: Math.round(E.e1.uff) })
ok(E.e2.ist > E.e1.ist && Math.abs(E.e2.uff - E.e1.uff) < 0.01, 'a higher Interstellar bar moves only the Interstellar times', { ist: [Math.round(E.e1.ist), Math.round(E.e2.ist)] })
ok(E.trust === 10 && E.ppGot === 50, 'the post-game card dials scale the cards (trust +10, PP +50)', { trust: E.trust, pp: E.ppGot })

// 5. v183: the Interstellar League is a league of legends (team base 400), its dial, and the estimate's title gap follows it
const I = await page.evaluate(() => {
  const lb = window.__levelBaseV178 ? window.__levelBaseV178(8) : null
  window.RIB_TUNE.v183IST = 0; const old = window.__levelBaseV178 ? window.__levelBaseV178(8) : null; delete window.RIB_TUNE.v183IST
  const g0 = window.__V182.eta(false); const gap0 = g0.title - g0.ist
  window.__V181.set('aiBaseIstV178', 700, 0); const g1 = window.__V182.eta(false); const gap1 = g1.title - g1.ist; const lb1 = window.__levelBaseV178 ? window.__levelBaseV178(8) : null
  window.__V181.reset()
  return { lb, old, lb1, gap0: Math.round(gap0), gap1: Math.round(gap1) }
})
ok(I.lb === 400 && I.old === 100 && I.lb1 === 700, 'the Interstellar League\'s teams are rated 400 (TU v183IST 0: 100), and the beta dial moves it', I)
ok(I.gap1 > I.gap0 && I.gap0 >= 25, 'the estimate\'s gap from entering the Interstellar League to its title grows with the league\'s strength', { at400: I.gap0, at700: I.gap1 })

// 6. v184: chaos drives the late game, and the Interstellar title waits on outgrowing the league
const X = await page.evaluate(() => {
  const r = (set) => { window.__V181.reset(); for (const [k, v] of Object.entries(set)) window.__V181.set(k, v, 0); const e = window.__V182.eta(false); return { uff: Math.round(e.uff), ist: Math.round(e.ist), title: Math.round(e.title), chaos: e.chaos, era: e.era } }
  const none = r({ etaChaosShareV184: 0 }), some = r({}), weak = r({ aiBaseIstV178: 100 }), hard = r({ aiBaseIstV178: 700 })
  window.__V181.reset()
  return { none, some, weak, hard }
})
console.log('X:', JSON.stringify(X))
ok(X.none.uff === X.some.uff && X.some.ist < X.none.ist * 0.7 && X.some.title < X.none.title * 0.5 && X.some.chaos > 20 && X.some.era >= 1, 'chaos drives the late game: the full-chaos loop (v185) cuts the Interstellar times (eras, PP), and leaves the UFF climb alone', X)
ok(X.weak.title - X.weak.ist < 10 && X.hard.title - X.hard.ist > X.some.title - X.some.ist, 'the Interstellar title waits on outgrowing the league: rated 100 it follows entry, rated 700 it is far off', { gap100: X.weak.title - X.weak.ist, gap400: X.some.title - X.some.ist, gap700: X.hard.title - X.hard.ist })

console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
if (errors.length) console.log('page errors:', errors.slice(0, 6))
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
