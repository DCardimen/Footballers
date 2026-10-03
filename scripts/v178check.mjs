// Dev check: v178 THE WEEKLY PAYCHECK (src/07-career-app.js) — the season's upgrade points paid game by game.
//   A: a game's slice is the old season formula ÷ games (base, big game, a win's half point); a Quick-Played game pays it
//      ×1, a watched game ×2, through a fractional bank onto player.points; the season end pays only the win-% bonus, the
//      flats, the stock bonus and any game no ledger paid — a fully simmed season still pays the old total (×1)
//   B: the coach's receipt itemises the trust swing and adds up to the number the card lands; the season screen's
//      THIS WEEK card carries the depth ladder
//   C: a 3-win streak pays ×1.2 (5 ×1.35, 8 ×1.5); a snapped streak is recorded
//   D: three orders a week, fixed on the week row, judged on the booked stat line
//   E: practice reps bank on the three key attributes; a whole point is a level-up
//   F: a deck of three seeded cards: a simmed game picks one, a watched game two
//   G: the stock ticker moves and names its reasons; H: the pace and the season marks
//   I: the post-game card carries the reel (paycheck, orders, streak, receipt, reps, stock, pace, cards); a simmed week
//      shows a strip that never blocks a tap
//   TU v178 0: no ledger, the old season-end points
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v178check.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = (...q) => url + (url.includes('?') ? '&' : '?') + ['stayStale', 'noFilmV114', 'noGrowV132'].concat(q).join('&')
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const context = await browser.newContext({ viewport: { width: 400, height: 860 } })
await context.addInitScript(() => {
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, {})
  try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
  setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80)
})
const page = await context.newPage()
page.on('pageerror', (e) => errors.push(String(e.message || e)))
await page.goto(U(), { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V178 && !!window.__V164C, null, { timeout: 40000 })
await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
await page.evaluate(() => document.getElementById('splash')?.remove())
const M = (fn, arg) => page.evaluate(fn, arg)
const seed = (o = {}) => M((o) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; S.tree = S.tree || {}; A.setState(S)
  S.player = A.newPlayer(); const p = S.player; p.name = 'Pay Man'; p.pos = o.pos || 'RB'; p.age = 14; p.originV11 = 'walk-on'; p._wonShown = true
  p.level = o.level != null ? o.level : 2; p.training = 'balanced'; p.points = 0; p.traits = [] /* no Coach's Son / Big Game Hunter: the slice is the bare formula */; A.startSeasonGames()
  document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove()
  window.go('season'); window.GridironStorage.save(S)
  return { level: p.level, weeks: p.weekResults.length, games: p.weekResults.filter((w) => !w.playoff).length }
}, o)

// ============================== A / C / D / E / F / G / H: the ledger ==============================
await seed({ level: 2, pos: 'RB' })
const L = await M(() => {
  const V = window.__V178, p = window.S.player, out = {}
  out.worth = V.worth()
  // the slice: the old formula's per-game share (level 2: ge = 10, 9 games)
  const pot = V.pot({}, 80, true)
  out.pot = { raw: pot.raw, items: pot.items.map((i) => i.k) }
  const aw = p.attrs.awareness || 0, ge = 10, G = 9
  out.want = (80 / 94 * ge + ge * 0.6 + aw * 0.02) / G + 1 / 3 + 0.5
  out.heat = [2, 3, 5, 8].map((s) => V.heat(s).mult)
  // orders: drawn once, fixed on the row, judged on the stat line
  const w = p.weekResults.find((x) => !x.played)
  const o1 = V.orders(w), o2 = V.orders(w)
  out.orders = { n: o1.length, same: o1 === o2 && w.ordersV178 === o1, txt: o1.map((o) => o.txt) }
  const stat = {}; o1.forEach((o) => { if (o.k !== 'win') stat[o.k] = o.max != null ? o.max : (o.min || 1) + 1 })
  const j = V.judge(o1, stat, true); out.judgeAll = j.every((o) => o.ok)
  const j0 = V.judge(o1, {}, false); out.judgeNone = j0.filter((o) => o.ok).length
  // the deck is seeded: the same week deals the same cards
  out.deck = [V.deck(w).join(','), V.deck(w).join(',')]
  out.stock = [V.stock(10).txt, V.stock(90).txt]
  out.marks0 = V.marks()
  return out
})
console.log('ledger:', JSON.stringify(L))
ok(Math.abs(L.pot.raw - L.want) < 1e-6 && L.pot.items.join() === 'base,solid,win', 'a game\'s slice is the old season formula ÷ games (base) + the 72+ third + a win\'s half point', { raw: L.pot.raw, want: L.want })
ok(L.heat.join() === '1,1.2,1.35,1.5', 'the streak heat: under 3 ×1, 3 ×1.2, 5 ×1.35, 8 ×1.5', L.heat)
ok(L.orders.n === 3 && L.orders.same, 'three orders a week, drawn once and kept on the week row', L.orders.txt)
ok(L.judgeAll && L.judgeNone <= 1, 'the orders are judged on the stat line: met = cleared, an empty line clears at most a "0 of" order', { all: L.judgeAll, none: L.judgeNone })
ok(L.deck[0] === L.deck[1] && L.deck[0].split(',').length === 3, 'the card deck is seeded: three cards, the same deal every time', L.deck[0])
ok(/★/.test(L.stock[0]) && /★/.test(L.stock[1]) && L.stock[0] !== L.stock[1], 'the stock reads as recruiting stars below the college level', L.stock)
ok(Array.isArray(L.marks0) && L.marks0.length === 0, 'the season marks wait for two booked games', L.marks0)

// a Quick-Played week pays ×1 through the bank, picks one card, and shows the strip
const Q = await M(async () => {
  const p = window.S.player, i = p.weekResults.findIndex((w) => !w.played), pts0 = p.points, b0 = p.payBankV178 || 0
  window.playWeek(false)
  for (let k = 0; k < 80 && !(p.weekResults[i].played && p.weekResults[i].payV178); k++) await new Promise((r) => setTimeout(r, 150)) // the week is closed, then paid
  await new Promise((r) => setTimeout(r, 600))
  const w = p.weekResults[i], P = w.payV178 || {}
  const flipPts = (P.flip ? P.flip.picked : []).reduce((a, k) => a + (k.id === 'pt1' ? 1 : k.id === 'pt2' ? 2 : 0), 0)
  const strip = document.getElementById('stripV178')
  return { played: w.played, watched: P.watched, wmul: P.wmul, raw: P.raw, whole: P.whole, b0, bank: p.payBankV178, pts0, pts1: p.points, flipPts, picks: P.flip && P.flip.picked.length, paid: p.paidV178,
    strip: strip ? { go: strip.classList.contains('go'), pe: getComputedStyle(strip).pointerEvents, txt: strip.innerText } : null,
    week: !!document.getElementById('weekV178'), weekTxt: (document.getElementById('weekV178') || {}).innerText || '', receipt: P.coach, delta: w.coachDelta98, reps: (P.reps || []).length, stock: !!P.stock, orders: (P.orders || []).length }
})
console.log('quick play:', JSON.stringify(Q))
ok(Q.played && Q.watched === false && Q.wmul === 1, 'a Quick-Played week is paid at ×1', { watched: Q.watched, wmul: Q.wmul })
ok(Q.whole === Math.floor(Q.b0 + Q.raw + 1e-9) && Math.abs(Q.bank - (Q.b0 + Q.raw - Q.whole)) < 1e-6, 'its points go through the fractional bank: whole points out, the rest kept', { raw: Q.raw, whole: Q.whole, bank: Q.bank })
ok(Q.pts1 - Q.pts0 === Q.whole + Q.flipPts && Q.paid === Q.whole + Q.flipPts, 'the whole points (and a points card) land on player.points the same week', { pts0: Q.pts0, pts1: Q.pts1, flipPts: Q.flipPts })
ok(Q.picks === 1, 'a simmed game picks one card, automatically', Q.picks)
ok(Q.receipt && Q.receipt.total === Q.delta, 'the coach\'s receipt adds up to the trust swing that landed', { total: Q.receipt && Q.receipt.total, delta: Q.delta, items: Q.receipt && Q.receipt.items.map((i) => i.txt + ' ' + i.v) })
ok(Q.reps === 3 && Q.stock && Q.orders === 3, 'the week carries its reps (three key attributes), its stock move and its judged orders', Q)
ok(Q.strip && Q.strip.go && Q.strip.pe === 'none' && /pts/.test(Q.strip.txt), 'the simmed week shows the strip, and it never takes a tap', Q.strip)
ok(Q.week && /THIS WEEK/.test(Q.weekTxt) && /Depth chart/.test(Q.weekTxt) && /Orders/.test(Q.weekTxt), 'the season screen carries THIS WEEK: the bank, the streak, the next orders, the depth ladder', Q.weekTxt.replace(/\s+/g, ' ').slice(0, 160))

// a watched game: the card pays ×2, two picks, the reel
const W = await M(async () => {
  const S = window.S, t = S.player, a = t.weekResults.findIndex((n) => !n.played); t.currentWeek = a
  const pts0 = t.points
  S._liveGame = window.__simGameV2(t.weekResults[a].perf || 60, t.pos); S._oppName = t.weekResults[a].opp; window.go('live')
  for (let i = 0; i < 40 && !document.querySelector('.speed-row'); i++) await new Promise((r) => setTimeout(r, 150))
  window.skipLive()
  for (let i = 0; i < 60 && !document.getElementById('pgOverlayV13'); i++) await new Promise((r) => setTimeout(r, 150))
  const w = t.weekResults[a], P = w.payV178 || {}, reel = document.getElementById('reelV178')
  const rows = reel ? [...reel.querySelectorAll('.rv-row .rv-k')].map((k) => k.textContent) : []
  const pts1 = t.points
  // two taps: the two picks, then the cards are spent
  window.__V178.pick(0); window.__V178.pick(1); window.__V178.pick(2)
  const picks = P.flip ? P.flip.picked.length : 0
  window.__V178.finish()
  const shown = reel ? reel.querySelectorAll('.rv-row.in').length : 0
  const card = document.getElementById('pgCoachV98'), cd = card ? parseInt(card.querySelector('b').textContent, 10) : null
  const coachBefore = Math.round((S.experience95 || {}).coach || 50)
  window.__pgContinueV13 && window.__pgContinueV13()
  await new Promise((r) => setTimeout(r, 900))
  return { card: !!document.getElementById('pgOverlayV13'), watched: P.watched, wmul: P.wmul, raw: P.raw, rows, pts0, pts1, whole: P.whole, picks, shown, nrows: rows.length, receipt: P.coach && P.coach.total, cd, coachBefore, coachAfter: Math.round((S.experience95 || {}).coach || 50), paidTwice: w.payV178 === P, view: S.view }
})
console.log('watched:', JSON.stringify(W))
ok(W.watched === true && W.wmul === 2, 'a watched game is paid at ×2', { watched: W.watched, wmul: W.wmul })
ok(W.rows.includes('PAYCHECK') && W.rows.includes('STREAK') && W.rows.includes("COACH'S RECEIPT") && W.rows.includes('PRACTICE REPS') && W.nrows >= 6, 'the post-game card carries the reel: paycheck, streak, coach\'s receipt, reps, and the rest', W.rows)
ok(W.picks === 2, 'a watched game picks two cards, and a third tap does nothing', W.picks)
ok(W.shown === W.nrows, 'a tap on the reel finishes it', { shown: W.shown, rows: W.nrows })
ok(W.receipt === W.cd && W.coachAfter === Math.max(0, Math.min(100, W.coachBefore + W.cd)), 'the receipt\'s total is the card\'s COACH TRUST swing, and that is what lands', { receipt: W.receipt, card: W.cd, before: W.coachBefore, after: W.coachAfter })
ok(W.paidTwice && W.pts1 - W.pts0 === W.whole, 'the ledger is written once: Continue / processWeek95 do not pay the week again', { pts0: W.pts0, pts1: W.pts1, whole: W.whole })

// H: after two games the season's marks are set from his own line, rise, and stay put
const MK = await M(() => { const V = window.__V178, a = V.marks(), b = V.marks(), pc = V.pace(); return { a, same: a === b, pace: pc && { total: pc.total, games: pc.games, next: pc.next, toGo: pc.toGo } } })
ok(MK.a.length >= 2 && MK.a[0] < MK.a[MK.a.length - 1] && MK.same && MK.pace && MK.pace.games === 2, 'after two games the season has rising marks, fixed for the season, and a pace line', MK)

// ============================== A: the season end pays only what is left ==============================
const E = await M(() => {
  const V = window.__V178, p = window.S.player
  const mk = (n, won, paid) => Array.from({ length: n }, () => ({ played: true, perf: 70, won, payV178: paid ? { whole: 1 } : undefined }))
  const rows = p.weekResults, paid0 = p.paidV178
  p.weekResults = mk(9, true, true)
  const allPaid = V.season(p.weekResults, [], 1, false)
  // the season's own rows win over a fresh AI-simmed set once any game was paid: nothing is paid twice
  const fresh = V.season(mk(9, true, false), [], 1, false)
  p.weekResults = []; p.paidV178 = 0
  const nonePaid = V.season(mk(9, true, false), [], 1, false)
  p.weekResults = rows; p.paidV178 = paid0
  // the old season formula for the same nine games (level 2, ×1, no tree): base + 3 solid thirds + 9 × 0.5 + the 90% bonus
  const aw = p.attrs.awareness || 0, ge = 10, old = Math.round(70 / 94 * ge + ge * 0.6 + aw * 0.02) + 0 + Math.floor(0 / 3) + Math.round(9 * 0.5) + 4
  return { allPaid, fresh, nonePaid, old }
})
console.log('season end:', JSON.stringify(E))
ok(E.allPaid.unpaid === 0 && E.allPaid.pts === 4 + E.allPaid.stock, 'every game paid on the night: the season end pays the win-% bonus (+4 at 90%) and the scouts\' buzz only', E.allPaid)
ok(E.fresh.unpaid === 0, 'a fresh AI-simmed set of games never pays again for games the ledger paid', E.fresh)
ok(E.nonePaid.unpaid === 9 && Math.abs(E.nonePaid.pts - E.nonePaid.stock - E.old) <= 1, 'no game paid (an AI-simmed season): the season end pays the old total at ×1', { got: E.nonePaid.pts - E.nonePaid.stock, old: E.old })

// a real season end through the screen: the banner splits game-by-game and season-end points
const R = await M(async () => {
  const p = window.S.player
  window.simRemainingWeeks()
  await new Promise((r) => setTimeout(r, 1500))
  for (let i = 0; i < 30 && p.weekResults.some((w) => !w.played); i++) {
    const w = p.weekResults.find((x) => !x.played); if (!w) break
    w.played = true; w.won = true; w.perf = 70; w.us = 21; w.them = 7
    await new Promise((r) => setTimeout(r, 30))
  }
  const paidBefore = p.paidV178, pts0 = p.points
  try { window.finishSeasonGames() } catch (e) { return { err: String(e) } }
  await new Promise((r) => setTimeout(r, 900))
  const sp = document.querySelector('.pay-split-v178')
  return { view: window.S.view, paidBefore, pts0, pts1: p.points, split: sp ? sp.innerText : null, paidAfter: p.paidV178, err: window.__V178.state.lastError || null }
})
console.log('report:', JSON.stringify(R))
ok(R.view === 'result' && R.split && /paid game by game/.test(R.split) && R.paidAfter === 0, 'the season report says what was paid game by game and what the season end added; the season tally resets', R)
ok(!R.err, 'no error inside the ledger', R.err)

// ============================== K: the week flows ==============================
await seed({ level: 3, pos: 'WR' })
const F0 = await M(async () => {
  const p = window.S.player; p.points = 0; p.payBankV178 = 0.95
  window.go('season'); await new Promise((r) => setTimeout(r, 300))
  const b = [...document.querySelectorAll('#dock button')].find((x) => /Quick Play/.test(x.textContent))
  const wired = b && b.getAttribute('onclick')
  b && b.click()
  for (let k = 0; k < 80 && !document.getElementById('simCardV178'); k++) {
    const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none' && g.getBoundingClientRect().height) g.click()
    await new Promise((r) => setTimeout(r, 150))
  }
  const card = document.getElementById('simCardV178')
  return { wired, card: !!card, rows: card ? card.querySelectorAll('.rv-row').length : 0, title: card ? (card.querySelector('.decision-title') || {}).textContent : null, pts: p.points }
})
console.log('sim card:', JSON.stringify(F0))
ok(F0.wired === 'window.__V178.quick()' && F0.card && F0.rows >= 5 && /WIN|LOSS/.test(F0.title || ''), 'a TAPPED Quick Play shows the scorecard: the result and the reel', F0)
const F1 = await M(async () => {
  window.__V178.finish(); window.__V178.closeCard(); await new Promise((r) => setTimeout(r, 500))
  const d = document.getElementById('dock')
  return { view: window.S.view, banner: !!document.getElementById('flowBannerV178'), live: !![...d.querySelectorAll('button')].find((x) => /Play Week 2 Live/i.test(x.textContent) && /playWeek\(true\)/.test(x.getAttribute('onclick'))), quick: !![...d.querySelectorAll('button')].find((x) => /Quick Play Week 2/i.test(x.textContent)) }
})
ok(F1.view === 'upgrade' && F1.banner && F1.live && F1.quick, 'Continue goes straight to the skill sheet, whose dock is the next week (Play Live / Quick Play)', F1)
const F2 = await M(async () => {
  const p = window.S.player, i = p.weekResults.findIndex((w) => !w.played); p.points = 0
  window.go('season'); await new Promise((r) => setTimeout(r, 200))
  window.playWeek(false)
  for (let k = 0; k < 80 && !(p.weekResults[i].played && p.weekResults[i].payV178); k++) await new Promise((r) => setTimeout(r, 150))
  await new Promise((r) => setTimeout(r, 500))
  return { card: !!document.getElementById('simCardV178'), view: window.S.view }
})
ok(!F2.card && F2.view === 'season', 'playWeek(false) from code gets no card and stays on the season screen (the strip)', F2)
const F3 = await M(async () => {
  window.RIB_TUNE.v178flow = 0
  window.go('season'); await new Promise((r) => setTimeout(r, 200))
  const b = [...document.querySelectorAll('#dock button')].find((x) => /Quick Play/.test(x.textContent))
  const out = { wired: b && b.getAttribute('onclick') }
  delete window.RIB_TUNE.v178flow
  return out
})
ok(F3.wired === 'playWeek(false)', 'TU v178flow 0: the dock\'s Quick Play is the old button', F3)

// ============================== the kill switch ==============================
await seed({ level: 2, pos: 'WR' })
const K = await M(async () => {
  window.RIB_TUNE.v178 = 0
  const p = window.S.player, i = p.weekResults.findIndex((w) => !w.played), pts0 = p.points
  window.playWeek(false)
  for (let k = 0; k < 40 && !p.weekResults[i].played; k++) await new Promise((r) => setTimeout(r, 150))
  await new Promise((r) => setTimeout(r, 400))
  const out = { pay: !!p.weekResults[i].payV178, pts: p.points - pts0, week: !!document.getElementById('weekV178'), season: window.__V178.season([], [], 1, false), note: (document.querySelector('.watch-note-v164c') || {}).innerText || '' }
  delete window.RIB_TUNE.v178
  return out
})
console.log('off:', JSON.stringify(K))
ok(!K.pay && K.pts === 0 && !K.week && K.season === null && /\+25%/.test(K.note), 'TU v178 0: no ledger, no points a game, no THIS WEEK card, the season end is the old formula, v164 C\'s note is back', K)

console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
if (errors.length) console.log('page errors:', errors.slice(0, 6))
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
