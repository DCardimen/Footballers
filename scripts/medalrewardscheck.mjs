// Dev check: the medal rewards end to end (v179 G "pick one of two", src/07-career-app.js).
//   1. EARNING: an account's medals rising (the honors floor) queues one reward per new medal — two cards each, every 10th
//      medal a face-down MAJOR — and an old save is not handed its history; a new era deals a major too
//   2. THE CHOOSER: the hub's 🎁 chip opens it; a small medal's two cards each name what they pay (a stat line); a major's
//      cards are face down until the first tap, the second tap claims; the next waiting reward follows; "pick the rest
//      for me" clears the queue with the stronger cards
//   3. EVERY EFFECT LANDS WHERE THE GAME READS IT: a new player's attributes (+1 one, +3 all) and upgrade points (Head
//      Start); coach trust, PP %, growth, injuries, team, titles, playoffs, cut lives, the ceiling (potential) through
//      treeFx; declare odds (the scouts' verdict ceiling and second look); the post-game reel (Extra Card: one more pick;
//      Golden Paycheck: the week pays ×1.1; Loaded Deck: rare cards turn up more); PP now (the windfall); a look in the
//      Locker (when the catalog has an earned one left)
//   4. IT LASTS: the rewards ride the save — a reload keeps every bonus and the queue
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/medalrewardscheck.mjs
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
  await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V179 && !!window.__V178, null, { timeout: 40000 })
  await page.evaluate(() => document.getElementById('splash')?.remove())
}
await boot()
const M = (fn, arg) => page.evaluate(fn, arg)
const sleep = (ms) => page.waitForTimeout(ms)

// 1. earning
const E = await M(async () => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; S.careers = 4; A.setState(S)
  S.player = A.newPlayer(); const p = S.player; p.pos = 'QB'; p.level = 3; p._wonShown = true; p.originV11 = 'walk-on'
  const Md = window.__V179.medals, st = Md.store()
  S.honorsV156A = { floor: 7 }; const first = Md.sync()                 // an old save: starts where it is
  S.honorsV156A = { floor: 19 }; const n = Md.sync()                     // 12 new medals
  const ranks = st.pending.map((x) => x.rank), majors = st.pending.filter((x) => x.major).map((x) => x.rank)
  const twoEach = st.pending.every((x) => x.opts.length === 2)
  st.pending = []
  window.RIB_TUNE.eraChaosStepV179 = 0; const up = Md.eraUp(); delete window.RIB_TUNE.eraChaosStepV179
  const era = st.pending[0] ? { major: st.pending[0].major, era: st.pending[0].era } : null
  st.pending = []
  return { first, n, ranks, majors, twoEach, up, era }
})
console.log('earning:', JSON.stringify(E))
ok(E.first === 0, 'an old save is not handed its medal history', E.first)
ok(E.n === 12 && E.ranks[0] === 8 && E.ranks[11] === 19 && E.twoEach, 'twelve new medals queue twelve rewards (#8–#19), two cards each', { n: E.n, ranks: E.ranks })
ok(JSON.stringify(E.majors) === '[10]', 'only the 10th medal is a MAJOR', E.majors)
ok(E.up && E.era && E.era.major && E.era.era >= 1, 'a new era deals a major too', E.era)

// 2. the chooser, through the UI
const C = await M(async () => {
  const A = window.__GRIDIRON_AUDIT__, S = A.getState(), Md = window.__V179.medals, st = Md.store()
  S.honorsV156A = { floor: 23 }; Md.sync()                               // #20 (a major) .. #23
  window.go('hub'); await new Promise((r) => setTimeout(r, 300))
  const chip = document.getElementById('medalChipV179'), chipText = chip ? chip.textContent : ''
  chip && chip.click(); await new Promise((r) => setTimeout(r, 150))
  const kicker = (document.querySelector('#medalPickV179 .decision-kicker') || {}).textContent || ''
  const down0 = document.querySelectorAll('#medalPickV179 .mp-card.down').length
  const cards = document.querySelectorAll('#medalPickV179 .mp-card')
  cards[0] && cards[0].click(); await new Promise((r) => setTimeout(r, 120))   // the first tap turns the major over
  const down1 = document.querySelectorAll('#medalPickV179 .mp-card.down').length, left0 = st.pending.length
  const lines = [...document.querySelectorAll('#medalPickV179 .mp-fx')].map((x) => x.textContent)
  document.querySelectorAll('#medalPickV179 .mp-card')[1].click(); await new Promise((r) => setTimeout(r, 150))   // the second tap claims
  const left1 = st.pending.length, claimed = st.log[st.log.length - 1], nextKicker = (document.querySelector('#medalPickV179 .decision-kicker') || {}).textContent || ''
  const smallLines = [...document.querySelectorAll('#medalPickV179 .mp-card em')].map((x) => x.textContent)
  const rest = [...document.querySelectorAll('#medalPickV179 button')].find((b) => /Pick the rest/.test(b.textContent))
  rest && rest.click(); await new Promise((r) => setTimeout(r, 200))
  return { chipText, kicker, down0, down1, lines, left0, left1, claimed, nextKicker, smallLines, restLeft: st.pending.length, open: !!document.getElementById('medalPickV179'), chipAfter: !!document.getElementById('medalChipV179') }
})
console.log('chooser:', JSON.stringify(C))
ok(/4/.test(C.chipText) && /MYSTERY/.test(C.chipText), 'the hub\'s 🎁 chip says how many rewards wait and that a mystery major is among them', C.chipText)
ok(/MAJOR/.test(C.kicker) && C.down0 === 2 && C.down1 === 0, 'the major opens face down; the first tap turns both cards over', { kicker: C.kicker, before: C.down0, after: C.down1 })
ok(C.lines.length === 2 && C.lines.every((l) => l.length > 8), 'each major card names what it pays (a stat line)', C.lines)
ok(C.left1 === C.left0 - 1 && C.claimed && C.claimed.major && /LEGACY MEDAL 21/.test(C.nextKicker), 'the second tap claims it and the next medal (#21) follows', { claimed: C.claimed, next: C.nextKicker })
ok(C.smallLines.length === 2 && C.smallLines.every((l) => l.length > 15), 'a small medal\'s two cards each say what they do', C.smallLines)
ok(C.restLeft === 0 && !C.open, '"Pick the rest for me" clears the queue and closes the chooser', { left: C.restLeft, open: C.open })

// 3. every effect lands where the game reads it
const F = await M(async () => {
  const A = window.__GRIDIRON_AUDIT__, S0 = A.freshState(); S0.tutorialSeen = true; A.setState(S0)
  const S = A.getState(), Md = window.__V179.medals, st = Md.store(), V = window.__V179
  // a fixed random stream so the same new player is rolled twice
  const R0 = Math.random, seq = () => { let x = 12345; Math.random = () => ((x = (x * 16807) % 2147483647) / 2147483647) }
  const roll = () => { seq(); const p = Md.newPlayer(); Math.random = R0; return p }
  const claim = (opt) => { st.pending = [{ rank: 99, major: !!opt.major, opts: [opt, opt] }]; return Md.claim(0) }
  const fx = (k) => A.treeFx(k)
  const out = {}
  // starting attributes
  const a0 = roll(); claim({ id: 'start', fx: { start_speed: 1 } }); const a1 = roll()
  claim({ id: 'silverSpoon', major: true, fx: { startAll: 3 } }); const a2 = roll()
  out.speed = a1.attrs.speed - a0.attrs.speed; out.allDelta = Object.keys(a2.attrs).filter((k) => k !== 'injuryResist').map((k) => a2.attrs[k] - a1.attrs[k])
  // Head Start
  const h0 = roll().points || 0; claim({ id: 'headStart', major: true, fx: { startPointsV179: 10 } }); out.headStart = (roll().points || 0) - h0
  // treeFx-read effects
  for (const [id, k, v] of [['trust', 'coachStart', 2], ['ppPct', 'ppMult', 0.01], ['growth', 'eGrowth', 0.05], ['ironBody', 'injDown', 0.08], ['pedigree', 'teamQual', 0.05], ['titleHunter', 'titleMult', 0.15], ['clutch', 'playoffPerf', 2], ['secondLife', 'cutLives', 1]]) {
    const b = fx(k); claim({ id, fx: { [k]: v } }); out[k] = +(fx(k) - b).toFixed(4)
  }
  const p0 = V.potential(); claim({ id: 'ceiling', major: true, fx: { ceilPlus: 3 } }); out.potential = +(V.potential() - p0).toFixed(2)
  // declare odds: the scouts' verdict ceiling and the second look
  S.player = A.newPlayer(); const pl = S.player; pl.pos = 'QB'; pl.level = 6; pl._wonShown = true; pl.originV11 = 'walk-on'
  window.RIB_TUNE.scoutPotUffV179 = 20
  const b0 = V.bar(pl); claim({ id: 'scoutsEye', major: true, fx: { advFlat: 3 } }); const b1 = V.bar(pl); delete window.RIB_TUNE.scoutPotUffV179
  out.vMax = +((b1.vMax - b0.vMax) * 100).toFixed(2); out.sl = +((b1.sl - b0.sl) * 100).toFixed(2); out.adv = +(fx('advFlat')).toFixed(2)
  // the post-game reel: one more pick, a bigger paycheck, luckier cards
  pl.level = 3; A.startSeasonGames()
  const wk = () => { const w = pl.weekResults.find((x) => !x.played) || pl.weekResults[0]; Object.assign(w, { played: true, won: true, us: 21, them: 7, perf: 75 }); delete w.payV178; return w }
  window.RIB_TUNE.extraCardV192A = 0 // v192 A: the Extra Card is an Impossible node now; the medal's old path is what this measures (v192Acheck has the new)
  const w0 = wk(); V.flipDeal; window.__V178.pay(w0, { live: false }); const n0 = w0.payV178.flip ? w0.payV178.flip.n : null, raw0 = w0.payV178.raw
  claim({ id: 'fourthCard', major: true, fx: { flipPicksV179: 1 } }); claim({ id: 'paycheck', major: true, fx: { payMultV179: 0.1 } })
  const w1 = wk(); window.__V178.pay(w1, { live: false }); const n1 = w1.payV178.flip ? w1.payV178.flip.n : null, raw1 = w1.payV178.raw
  delete window.RIB_TUNE.extraCardV192A
  out.picks = [n0, n1]; out.payRatio = raw0 ? +(raw1 / raw0).toFixed(3) : null
  const rare = () => { let r = 0, t = 0; for (let k = 0; k < 3000; k++) { const d = window.__V178.deck({ week: k, opp: 'L' + k }); for (const id of d) { t++; if (/^(pt3|pp3|gear|attr)$/.test(id)) r++ } } return r / t } // v186 F: the rare, epic and legendary cards
  const r0 = rare(); claim({ id: 'luckyDeck', major: true, fx: { flipLuckV179: 1 } }); const r1 = rare()
  out.rare = [+(r0.toFixed(3)), +(r1.toFixed(3))]
  // PP now; a look
  const pp0 = S.pp || 0; claim({ id: 'pp', amt: 500, fx: {} }); out.pp = (S.pp || 0) - pp0
  let look = null
  try { const C = window.RIB_COSMETICS; const it = C && C.catalog ? (C.catalog() || []).find((x) => x && x.source === 'earned' && !C.owned(x.id)) : null
    if (it) { claim({ id: 'skin', look: it.id, fx: {} }); look = { id: it.id, owned: !!C.owned(it.id) } } } catch (e) { look = { err: e.message } }
  out.look = look
  out.owned = Object.keys(st.owned)
  return out
})
console.log('effects:', JSON.stringify(F))
ok(F.speed === 1, 'a +1 starting attribute card: a new player is born with +1 Speed', F.speed)
ok(F.allDelta.length > 10 && F.allDelta.every((d) => d === 3), 'Silver Spoon: +3 to every starting attribute', F.allDelta)
ok(F.headStart === 10, 'Head Start: a new player starts with 10 upgrade points', F.headStart)
ok(F.coachStart === 2 && F.ppMult === 0.01 && F.eGrowth === 0.05 && F.injDown === 0.08 && F.teamQual === 0.05 && F.titleMult === 0.15 && F.playoffPerf === 2 && F.cutLives === 1, 'trust, PP %, growth, injuries, team, titles, playoffs and cut lives land in the game\'s own treeFx', { coachStart: F.coachStart, ppMult: F.ppMult, eGrowth: F.eGrowth, injDown: F.injDown, teamQual: F.teamQual, titleMult: F.titleMult, playoffPerf: F.playoffPerf, cutLives: F.cutLives })
ok(Math.round(F.potential) === 9, 'Higher Ceiling: +3 ceiling = +9 potential (ceiling nodes ×3)', F.potential)
ok(F.adv >= 3 && F.vMax > 0 && F.sl > 0, 'The Scout\'s Eye: declare odds up, and with them the scouts\' verdict ceiling and the GM\'s second look', { advFlat: F.adv, vMax: F.vMax, secondLook: F.sl })
ok(F.picks[1] === F.picks[0] + 1, 'The Extra Card (the pre-v192 medal, extraCardV192A 0): one more pick after the game', F.picks)
ok(Math.abs(F.payRatio - 1.1) < 0.02, 'Golden Paycheck: the same week pays ×1.1', F.payRatio)
ok(F.rare[1] > F.rare[0] * 1.3, 'Loaded Deck: rare, epic and legendary cards turn up more often', F.rare)
ok(F.pp === 500, 'a Prestige windfall pays into the balance now', F.pp)
ok(F.look === null || (F.look && F.look.owned), 'a look card puts the look in the Locker (when an earned one is left)', F.look)

// 4. it lasts
await M(async () => { const S = window.__GRIDIRON_AUDIT__.getState(), Md = window.__V179.medals, st = Md.store(); st.pending = [Md.deal(31, st)]; window.GridironStorage.save(S) })
const before = await M(() => { const st = window.__V179.medals.store(); return { fx: JSON.stringify(st.fx), owned: Object.keys(st.owned).sort().join(','), pending: st.pending.length } })
await boot()
const after = await M(() => { const st = window.__V179.medals.store(); return { fx: JSON.stringify(st.fx), owned: Object.keys(st.owned).sort().join(','), pending: st.pending.length, treeAll: window.__GRIDIRON_AUDIT__.treeFx('startAll') } })
ok(after.fx === before.fx && after.owned === before.owned && after.pending === 1 && after.treeAll >= 3, 'a reload keeps every bonus, the majors owned and the waiting reward', { before: before.pending, after })

console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
if (errors.length) console.log('page errors:', errors.slice(0, 6))
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
