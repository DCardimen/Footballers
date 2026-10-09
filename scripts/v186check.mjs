// Dev check: v186 (src/07-career-app.js, src/05-field-renderer.js).
//   A: RINGS ARE EARNED — a UFF title is a ring only for a starter whose season average clears `ringPerfUffV186` (60); the
//      Interstellar ring wants `ringPerfIstV186` (80); a camp body or a weak season gets the title, not the ring
//   A: CHAOS LOCKS IN — a career started under chaos commits it (`state.chaosLockV186`): the dials cannot go below it,
//      only up; `chaosLockV186` 0 lets them down
//   the Apex and the Impossible are priced ×50 / ×500 by default and pay ×1.5 / ×2 (treeFx); the Interstellar League is
//   rated 700; the estimate puts ≥100 h between arriving out there and its ring
//   D: MY TEAM — the season screen's folded card lists the unit, the chemistry and how long each effect lasts
//   F: THE FLIP PAYS LATER — the deck's rarities (74 / 20 / 5 / 0.5 / 0.1%), Upgrade Point and Prestige cards add a
//      percentage paid at the season's end / the career's end (never mid-season), the coach card +1 and nothing at 70+,
//      Card Shark and Marked Cards
//   E: STARDUST — an Interstellar season pays it by its average (a ring pays 10), the Star Forge spends it on three
//      Interstellar-only upgrades (power, the ring's bar, PP)
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v186check.mjs
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
await p.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V186 && !!window.__V185, null, { timeout: 40000 })
await p.waitForTimeout(500); await p.evaluate(() => document.getElementById('splash')?.remove())

// A: the ring gate
const A = await p.evaluate(() => {
  const V = window.__V186
  const mk = (level, status) => ({ level, nflStateV11: status ? { status } : null })
  return {
    star: V.ringEarned(mk(7, 'starter'), 72), weak: V.ringEarned(mk(7, 'starter'), 52), camp: V.ringEarned(mk(7, 'camp'), 95),
    franchise: V.ringEarned(mk(7, 'franchise'), 61), ist: V.ringEarned(mk(8, 'starter'), 80), istDom: V.ringEarned(mk(8, 'starter'), 88),
    college: V.ringEarned(mk(5, 'camp'), 10), last: V.last()
  }
})
ok(A.star && !A.weak && !A.camp && A.franchise, 'a UFF ring: a starter (or franchise man) averaging 60+ — not a camp body, not a weak season', A)
ok(!A.ist && A.istDom, 'an Interstellar ring wants a dominant season (85+)', { ist: A.ist, istDom: A.istDom })
ok(A.college, 'below the UFF the gate does not apply (titles there are not rings)')
// the game itself: a won UFF season by a camp body is a title, not a ring
const G = await p.evaluate(() => {
  const AU = window.__GRIDIRON_AUDIT__, S = AU.freshState(); S.tutorialSeen = true; AU.setState(S)
  const s = AU.getState(); s.player = AU.newPlayer(); const pl = s.player; pl.pos = 'LB'; pl.originV11 = 'walk-on'; pl.level = 7; pl.age = 25
  for (const k in pl.attrs) pl.attrs[k] = 900
  window.RIB_TUNE.v156Bplayoffs = 0
  const won = () => { pl.weekResults = []; pl.playoffState = { qualified: true, champion: true } }
  won(); AU.simSeason(pl); const st0 = pl.nflStateV11 && pl.nflStateV11.status, r0 = pl.nflRings || 0, t0 = pl.titles || 0
  window.RIB_TUNE.ringPerfUffV186 = 0; if (pl.nflStateV11) pl.nflStateV11.status = 'starter'
  won(); AU.simSeason(pl); const r1 = pl.nflRings || 0, t1 = pl.titles || 0
  delete window.RIB_TUNE.ringPerfUffV186
  return { st0, r0, t0, r1, t1 }
})
ok(G.st0 !== 'starter' && G.r0 === 0 && G.t0 === 1, 'the game: a title won from training camp is a title, not a ring', G)
ok(G.r1 === 1 && G.t1 === 2, 'the same season as a starter who carried it: a ring', G)

// A: the chaos lock
const L = await p.evaluate(() => {
  const AU = window.__GRIDIRON_AUDIT__, s = AU.getState()
  s.player = null; s.chaosUnlocked = true; s.chaosCap = 6; s.chaos = {}; s.chaosLockV186 = 0; window.__chaosMaxV179()
  window.startCareer(true)
  const lock = window.__V186.lock(), k = Object.keys(s.chaos).find((q) => s.chaos[q] > 0)
  const before = window.__chaosTotalV179(); window.setChaos ? window.setChaos(k, -1) : null; const after = window.__chaosTotalV179()
  window.RIB_TUNE.chaosLockV186 = 0; window.setChaos && window.setChaos(k, -1); const freed = window.__chaosTotalV179(); delete window.RIB_TUNE.chaosLockV186
  return { lock, before, after, freed, hasSet: typeof window.setChaos }
})
ok(L.lock === 6, 'starting a career under chaos locks it in at what was played', L)
ok(L.hasSet !== 'function' || (L.after === L.before && L.freed === L.before - 1), 'the dials cannot go below the lock; chaosLockV186 0 lets them down', L)

// prices, the branches' pay, the league, the estimate
const P = await p.evaluate(() => {
  const AU = window.__GRIDIRON_AUDIT__, s = AU.getState(), N = AU.TREE_NODES
  const apex = Object.values(N).find((n) => n.branch === 'apex' && n.fx && Object.keys(n.fx).length && !/coachStart|pointsFlat|start_|startAll/.test(Object.keys(n.fx)[0])) // capped stats (prestigeCap) hide a multiplier
  const imp = Object.values(N).find((n) => n.branch === 'impossible' && n.fx && Object.keys(n.fx).length)
  const fxOf = (n) => { const k = Object.keys(n.fx)[0]; s.tree = { [n.key]: 1 }; const v = AU.treeFx ? AU.treeFx(k) : null; s.tree = {}; return { k, base: n.fx[k], v } }
  const e = window.__V182.eta(false)
  return { apexFx: window.__V186.branchFx('apex'), impFx: window.__V186.branchFx('impossible'), apex: apex && fxOf(apex), imp: imp && fxOf(imp), lb8: window.__levelBaseV178 ? window.__levelBaseV178(8) : null, gapH: Math.round((e.title - e.ist) * 7 / 60), istH: Math.round(e.ist * 7 / 60) }
})
ok(P.apexFx === 1.5 && P.impFx === 2, 'the Apex pays ×1.5 and the Impossible ×2', P)
ok(!P.apex || P.apex.v == null || Math.abs(P.apex.v - P.apex.base * 1.5) < 1e-6, 'treeFx carries the Apex multiplier', P.apex)
ok(P.gapH >= 100, 'the estimate: ≥100 h from arriving in the Interstellar League to its ring', { istH: P.istH, gapH: P.gapH })
ok(P.lb8 == null || P.lb8 === 700, 'the Interstellar League is rated 700', P.lb8)

// D: MY TEAM on the season screen
await p.evaluate(() => {
  const AU = window.__GRIDIRON_AUDIT__, s = AU.getState(); s.player = AU.newPlayer(); const pl = s.player
  pl.name = 'Team Man'; pl.pos = 'LB'; pl.age = 16; pl.originV11 = 'walk-on'; pl._wonShown = true; pl.level = 3
  for (const k in pl.attrs) pl.attrs[k] = 60
  AU.startSeasonGames(); window.go('season')
})
await p.waitForTimeout(600)
const D = await p.evaluate(() => { const c = document.getElementById('myTeamV186'); return c ? { text: c.textContent.replace(/\s+/g, ' ').slice(0, 400), rows: c.querySelectorAll('details > div:first-of-type > div').length } : null })
ok(!!D && /MY TEAM/.test(D.text) && /CHEMISTRY/.test(D.text) && /How long it lasts/.test(D.text) && D.rows >= 3, 'MY TEAM: the unit, the chemistry, how long each effect lasts', D)

// E: Stardust and the Star Forge
const E = await p.evaluate(() => {
  const AU = window.__GRIDIRON_AUDIT__, s = AU.getState(), V = window.__V186.forge
  s.stardustV186 = 0; s.forgeV186 = {}
  const pl = s.player; pl.level = 8
  const a = V.earn(pl, 92, false), b = V.earn(pl, 70, false), c = V.earn(pl, 50, true), d = V.earn(Object.assign({}, pl, { level: 7 }), 99, true)
  const sd = s.stardustV186, cost = V.cost('gravity'), pw0 = AU.playerPower ? AU.playerPower(pl) : null
  const bought = V.buy('gravity'), pw1 = AU.playerPower ? AU.playerPower(pl) : null
  window.go('hub')
  const card = document.getElementById('forgeV186')
  return { a, b, c, d, sd, cost, bought, left: s.stardustV186, lvl: V.lvl('gravity'), fx: V.fx('gravity'), pw0, pw1, card: !!card && /STAR FORGE/.test(card.textContent) }
})
ok(E.a === 3 && E.b === 1 && E.c === 10 && E.d === 0, 'Stardust: 3 for a 90+ Interstellar season, 1 for 65+, 10 for a ring; nothing below the Interstellar', E)
ok(E.bought && E.lvl === 1 && E.left === E.sd - E.cost && E.fx === 3, 'the Star Forge spends it: Gravity Well +3 power out there', E)
ok(E.card, 'the hub shows the ✨ STAR FORGE card', E.card)

// F: THE FLIP PAYS LATER
const F = await p.evaluate(() => {
  const AU = window.__GRIDIRON_AUDIT__, s = AU.getState(), pl = s.player, V = window.__V186.flip
  s.tree = {}
  // the deck's rarities over many weeks
  const RAR = { pt1: 'common', pp1: 'common', reps: 'common', pt2: 'uncommon', pp2: 'uncommon', trust: 'uncommon', pt3: 'rare', pp3: 'rare', gear: 'epic', attr: 'legendary' }
  const cnt = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, jackpot: 0 }; let N = 0
  const rarOf = (id) => (window.__V193AB ? window.__V193AB.rar(id) : RAR[id]) || 'common'   // v193 AB: the Hot Streak / Spillover ids carry their rarity; 2× POINTS is its own draw ("jackpot")
  for (let wk = 0; wk < 2000; wk++) for (const id of V.deck({ week: wk, opp: 'X' + wk }, 50)) { cnt[rarOf(id)]++; N++ }
  const share = Object.fromEntries(Object.entries(cnt).map(([k, v]) => [k, +(v / N).toFixed(4)]))
  // the cards: percentages, not points — and the coach card
  pl.flipUpPctV186 = 0; pl.flipPPPctV186 = 0; const pts0 = pl.points || 0, pp0 = s.pp || 0, bank0 = s.ppBankV136 || 0
  window.__V179.applyFlip('pt1', {}); window.__V179.applyFlip('pt3', {}); window.__V179.applyFlip('pp1', {}); window.__V179.applyFlip('pp3', {})
  const mid = { up: pl.flipUpPctV186, pp: pl.flipPPPctV186, pts: (pl.points || 0) - pts0, ppNow: (s.pp || 0) - pp0 + (s.ppBankV136 || 0) - bank0 }
  // v193 AB: no card touches coach trust — the old coach card is re-dealt as a Hot Streak; v193AB 0 is the v186 card
  pl.coachTrust = 50; window.__V179.applyFlip('trust', {}); const t0 = pl.coachTrust
  window.RIB_TUNE.v193AB = 0
  pl.coachTrust = 50; window.__V179.applyFlip('trust', {}); const t1 = pl.coachTrust
  pl.coachTrust = 70; window.__V179.applyFlip('trust', {}); const t2 = pl.coachTrust
  delete window.RIB_TUNE.v193AB
  // the season's end: 12% of a 100-point season's paycheck
  pl.weekResults = [{ played: true, payV178: { whole: 60 } }, { played: true, payV178: { whole: 40 } }]
  const p1 = pl.points || 0; const upBonus = V.upSettle(pl); const upGot = (pl.points || 0) - p1, upAfter = pl.flipUpPctV186
  // the prestige: 6% of a 1,000 PP payout
  const s1 = s.pp || 0; const ppBonus = V.ppSettle(pl, 1000); const ppGot = (s.pp || 0) - s1
  // Card Shark ×(1 + 0.1 × level × the Apex's 1.5); Marked Cards make the top three likelier
  s.tree = { cardShark: 2, markedCards: 2 }; const mult = V.mult(), odds = V.odds(); s.tree = {}
  pl.flipUpPctV186 = 0; s.tree = { cardShark: 2 }; window.__V179.applyFlip('pt1', {}); const shark = pl.flipUpPctV186; s.tree = {}
  return { share, N, mid, t0, t1, t2, upBonus, upGot, upAfter, ppBonus, ppGot, mult, odds, shark }
})
ok(F.share.common > 0.7 && F.share.uncommon > 0.17 && F.share.uncommon < 0.23 && F.share.rare > 0.04 && F.share.rare < 0.06 && F.share.epic > 0.0035 && F.share.epic < 0.0065 && F.share.legendary > 0.0004 && F.share.legendary < 0.0018, 'the deck: ~74% common, 20% uncommon, rare 1 in 20, epic 1 in 200, legendary 1 in 1,000', { N: F.N, share: F.share })
ok(F.mid.up === 12 && F.mid.pp === 6 && F.mid.pts === 0 && F.mid.ppNow === 0, 'Upgrade Point and Prestige cards pay nothing mid-season — they add a percentage (+2% +10% / +1% +5%)', F.mid)
ok(F.t0 === 50 && F.t1 === 51 && F.t2 === 70, 'the coach card: none since v193 AB (trust stays 50); with v193AB 0 it is +1 trust, and nothing at 70+', { now: F.t0, from50: F.t1, from70: F.t2 })
ok(F.upBonus === 12 && F.upGot === 12 && F.upAfter === 0, 'the season ends: +12% of its 100-point paycheck = +12 points, and the percentage resets', { bonus: F.upBonus, got: F.upGot })
ok(F.ppBonus === 60 && F.ppGot === 60, 'the career ends: +6% of a 1,000 PP payout = +60 PP', { bonus: F.ppBonus, got: F.ppGot })
ok(Math.abs(F.mult - 1.3) < 1e-9 && Math.abs(F.shark - 2.6) < 1e-6 && Math.abs(F.odds.rare - 0.05 * 1.9) < 1e-9 && Math.abs(F.odds.legendary - 0.001 * 1.9) < 1e-9, 'Card Shark (Apex) +10% a level to every percentage; Marked Cards +30% a level to the top three (×1.5 on the Apex)', { mult: F.mult, shark: F.shark, odds: F.odds })

console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
if (errors.length) console.log('page errors:', errors.slice(0, 6))
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
