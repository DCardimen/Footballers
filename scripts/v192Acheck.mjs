// Dev check: v192 A THE ECONOMY, TO SCALE (src/07-career-app.js, src/11-pregame-v1513.js).
//   1 MILESTONES pay a tenth (1 or 2 early, never 0)
//   2 FLAT PP — challenges / orders / title / nemesis / daily / the old PP card / Legacy bounties pay a tenth of their face;
//     the flat part of the bank is paid at the settle only up to half of what the career itself pays (min 3); the windfall is 10%
//   3 PER-GAME ATTRIBUTES — practice reps bank half, the Extra reps card is a quarter point
//   4 THE FATE ROLL — a percent of the attribute, which may pass the attribute cap for the one game (and is reverted)
//   5 THE EXTRA CARD — never dealt as a medal reward, the stored medal fx is ignored; an Impossible node at 1M+ PP
//   6 THE FLIP'S STAT — the reps / +1 cards draw across the position's stats; Focused Reps (Mental) leans them to the key ones
//   Kill switch v192A 0 restores every old path.
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v192Acheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
await page.addInitScript(() => { setInterval(() => { try { document.querySelector('.onboard')?.remove() } catch {} }, 60) })
await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V192A && !!window.__V179 && !!window.__runFateRoll, null, { timeout: 40000 })
await page.waitForTimeout(800)
const M = (fn, arg) => page.evaluate(fn, arg)
// a fresh account with an unsettled RB in Pee Wee (banking on)
const setup = () => M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.freshState(); S.tutorialSeen = true; X.setState(S); S.tree = {}
  const p = X.newPlayer(); p.pos = 'RB'; p.name = 'Check Man'; p.originV11 = p.originV11 || 'walk-on'; S.player = p; p.training = 'balanced'
  window.RIB_TUNE = window.RIB_TUNE || {}; delete window.RIB_TUNE.v192A
  return true
})

// ---- 1 + 2: flat PP
await setup()
const F = await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), V = window.__V192A, B = window.__V136_C
  const r = { mile: [1, 2, 3, 4, 5, 6, 7, 8].map((l) => V.milestone(l)), face: [V.flatFace(25), V.flatFace(3), V.flatFace(1e4), V.flatFace(0)] }
  S.milestones = {}; S.pp = 0; S.ppBankV136 = 0; S.ppBankFlatV192A = 0
  r.granted = X.grantMilestone(3); r.bankAfterMile = S.ppBankV136
  // a challenge through the real board: the ring
  S.challenges = {}; S.player.seasonStats = { playoffs: { champion: true }, awards: [], teamLosses: 3 }
  X.completeChallengesV134(S.player.seasonStats); r.chalBank = S.ppBankV136 - r.bankAfterMile
  // the settle cap: 40 flat banked + 10 non-flat, the career pays 20 → half of it (10) of the flat + the 10
  S.ppBankV136 = 0; S.ppBankFlatV192A = 0; S.pp = 0
  B.bank(40, 'goal'); B.bank(10, 'season')
  r.cut = V.flatCut(20); r.cap = V.flatCap(20)
  r.flushed = B.flush(20); r.pp = S.pp; r.flatLeft = S.ppBankFlatV192A
  // the minimum and a big career
  B.bank(5, 'goal'); r.flushMin = B.flush(1)
  B.bank(500, 'goal'); r.flushBig = B.flush(2000)
  r.wind = window.__V190.windfall(1)
  // OFF
  window.RIB_TUNE.v192A = 0
  r.offMile = V.milestone(5); r.offFace = V.flatFace(25)
  B.bank(40, 'goal'); r.offFlush = B.flush(8)
  window.RIB_TUNE = window.RIB_TUNE || {}; delete window.RIB_TUNE.v192A
  return r
})
ok(F.mile.slice(0, 4).every((v) => v === 1) && F.mile[4] === 2 && F.mile[7] === 22, 'milestones pay a tenth: 1,1,1,1,2 … 22 at the Interstellar League', F.mile)
ok(F.granted === 1 && F.bankAfterMile === 1, 'grantMilestone banks the tenth', F)
ok(F.face[0] === 3 && F.face[1] === 1 && F.face[2] === 1000 && F.face[3] === 0, 'a flat face pays 10% (never under 1)', F.face)
ok(F.chalBank === 3 || F.chalBank === 6 || F.chalBank === 9, 'the challenge board banks a tenth (Ring Season 25 → 3)', F.chalBank)
ok(F.cap === 10 && F.cut === 30 && F.flushed === 20 && F.pp === 20 && F.flatLeft === 0, 'the settle pays the flat bank only up to half the career\'s own pay (40 flat + 10, pay 20 → 10 + 10)', F)
ok(F.flushMin === 3 && F.flushBig === 500, 'the cap is at least 3, and a big career covers it all', F)
ok(F.wind >= 1 && F.wind <= 5, 'the medal windfall is 10% of a career (min 1)', F.wind)
ok(F.offMile === 24 && F.offFace === 25 && F.offFlush === 40, 'v192A 0: the old milestone, face and bank', F)

const G = await M(() => {
  window.go('challenges')
  const rows = [...document.querySelectorAll('#screen .shop-item')].map((e) => { const t = e.textContent.replace(/\s+/g, ' '); const m = t.match(/([\d,]+) PP/); return { t, pp: m ? Number(m[1].replace(/,/g, '')) : 0 } })
  const f = (re) => (rows.find((r) => re.test(r.t)) || {}).pp
  return { ring: f(/Ring Season/), dfl: f(/Man Who Won It/), gal: f(/Best in the Galaxy/) }
})
ok(G.ring === 3 && G.dfl === 10000 && G.gal === 1000000, 'the board shows a tenth (Ring Season 3) — the two title-as-MVP feats keep 10,000 / 1,000,000', G)

// ---- 3: per-game attributes
await setup()
const R = await M(() => {
  const V = window.__V192A, S = window.__GRIDIRON_AUDIT__.getState(), p = S.player
  const r = { mult: V.repsMult(), card: V.flipReps() }
  for (const k in p.attrs) p.attrs[k] = 20
  p.practiceV178 = {}
  window.__V179.applyFlip('reps', { week: 1, opp: 'X' })
  r.bank = Object.values(p.practiceV178).reduce((a, b) => a + b, 0)
  window.RIB_TUNE.v192A = 0; r.offMult = V.repsMult(); r.offCard = V.flipReps(); delete window.RIB_TUNE.v192A
  return r
})
ok(R.mult === 0.5 && R.card === 0.25 && Math.abs(R.bank - 0.25) < 1e-9, 'practice reps ×0.5, the Extra reps card a quarter point', R)
ok(R.offMult === 1 && R.offCard === 0.5, 'v192A 0: the old reps', R)

// ---- 4: the fate roll
await setup()
const T = await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), p = S.player, r = {}
  X.startSeasonGames(); S.view = 'season'
  const a = window.__fateAttrFor('explosive')
  r.a = a
  for (const k in p.attrs) p.attrs[k] = 40
  r.at40 = window.__fateAttrFor('explosive')
  // a hit: the buff lands past the cap and is gone after the game is generated
  const cap = window.__V190 && window.__V190.fx ? null : null
  const k = r.at40.attr, hi = 1000
  p.attrs[k] = hi
  const seen = []; let v = p.attrs[k]
  Object.defineProperty(p.attrs, k, { configurable: true, enumerable: true, get () { return v }, set (n) { seen.push(n); v = n } })
  const R0 = Math.random; Math.random = () => 0
  const ch = window.chooseGamePlanV11.__originalV1514 || window.chooseGamePlanV11 // the fate layer, under the pregame wizard
  try { ch('explosive', false) } catch (e) { r.err = String(e && e.message) } finally { Math.random = R0 }
  r.seen = seen.slice(0, 4); r.after = p.attrs[k]; r.hi = hi
  r.last = S._fateLast
  r.card = window.__V192A.fate('team')
  window.RIB_TUNE.v192A = 0; for (const x in p.attrs) p.attrs[x] = 40; r.off = window.__fateAttrFor('explosive'); delete window.RIB_TUNE.v192A
  return r
})
ok(T.at40.pct === 20 && T.at40.amount === 8, 'explosive is +20% of the attribute (40 → +8)', T.at40)
ok(T.seen.length >= 2 && T.seen[0] === T.hi + 200 && T.after === T.hi, 'a hit buffs past the cap for the game, then reverts', { seen: T.seen, after: T.after, err: T.err })
ok(/^\+20% /.test(T.last || ''), 'the last-roll text reads as a percent', T.last)
ok(T.off.pct == null && T.off.amount === 20, 'v192A 0: the old flat +20', T.off)
// the plan card text
const card = await M(() => {
  const d = document.createElement('div'); d.innerHTML = '<button class="gameplan-choice" onclick="chooseGamePlanV11(\'feature\')"><div class="gameplan-meta"></div></button>'; document.body.appendChild(d)
  window.__decoratePlans(d); const t = (d.querySelector('.fate-odds-row') || {}).innerText || ''; d.remove(); return t
})
ok(/\+12% .* this game \(\+\d+, may pass the cap\)/.test(card), 'the plan card shows the percent and the points', card)

// ---- 5: the extra card
await setup()
const C = await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), N = X.TREE_NODES, V = window.__V192A, Md = window.__V179.medals
  const r = { node: N.extraCard && { branch: N.extraCard.branch, max: N.extraCard.max, cost: X.nodeCost(N.extraCard) } }
  const Mx = Md.store(); Mx.fx.flipPicksV179 = 1; r.medalIgnored = V.extraPicks()
  let dealt = 0; for (let rank = 10; rank <= 2000; rank += 10) { Mx.owned = {}; const d = Md.deal(rank, Mx); if (d.opts.some((o) => o.id === 'fourthCard')) dealt++ }
  r.dealt = dealt
  S.tree = { extraCard: 1 }; r.withNode = V.extraPicks()
  const w = { week: 2, opp: 'Y' }; r.flipN = window.__V179.flipDeal(w, 1 + V.extraPicks()).n
  S.tree = {}
  window.RIB_TUNE.v192A = 0; r.off = V.extraPicks(); let dOff = 0; for (let rank = 10; rank <= 2000; rank += 10) { Mx.owned = {}; if (Md.deal(rank, Mx).opts.some((o) => o.id === 'fourthCard')) dOff++ } r.dealtOff = dOff; delete window.RIB_TUNE.v192A
  Mx.fx = {}
  return r
})
ok(C.node && C.node.branch === 'impossible' && C.node.max === 1 && C.node.cost >= 1e6, 'The Extra Card is an Impossible node at 1M+ PP', C.node)
ok(C.medalIgnored === 0 && C.dealt === 0, 'the medal is never dealt and its stored fx is ignored', C)
ok(C.withNode === 1 && C.flipN >= 2, 'the node adds the pick', C)
ok(C.off === 1 && C.dealtOff > 0, 'v192A 0: the medal again', C)

// ---- 6: the flip's stat
await setup()
const D = await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), p = S.player, V = window.__V192A
  const W = X.POSITIONS[p.pos].w, top3 = Object.keys(W).sort((a, b) => W[b] - W[a]).slice(0, 3)
  const draw = () => { const n = {}; for (let i = 0; i < 600; i++) { const k = V.stat({ week: i, opp: 'Z' + (i % 7) }, 'reps'); n[k] = (n[k] || 0) + 1 } return n }
  const share = (n) => top3.reduce((a, k) => a + (n[k] || 0), 0) / 600
  const n0 = draw(); S.tree = { focusReps: 5 }; const n5 = draw(); S.tree = {}
  const node = X.TREE_NODES.focusReps
  // the cards themselves
  for (const k in p.attrs) p.attrs[k] = 20
  const before = Object.assign({}, p.attrs); const got = {}
  for (let i = 0; i < 40; i++) { p.practiceV178 = {}; window.__V179.applyFlip('reps', { week: i, opp: 'Q' }); for (const k in p.practiceV178) got[k] = 1 }
  const before2 = Object.assign({}, p.attrs), up = {}
  for (let i = 0; i < 40; i++) { window.__V179.applyFlip('attr', { week: i, opp: 'R' }) }
  for (const k in p.attrs) if (p.attrs[k] > before2[k]) up[k] = p.attrs[k] - before2[k]
  return { stats0: Object.keys(n0).length, share0: share(n0), stats5: Object.keys(n5).length, share5: share(n5), node: node && { branch: node.branch, max: node.max, cost: X.nodeCost(node) }, repsStats: Object.keys(got).length, attrStats: Object.keys(up).length, onlyPos: Object.keys(n0).every((k) => W[k] > 0) }
})
ok(D.stats0 >= 7 && D.share0 < 0.55 && D.onlyPos, 'at Lv 0 the draws spread over the position\'s stats (top three take < 55%)', D)
ok(D.share5 > 0.6 && D.share5 > D.share0 + 0.25, 'Focused Reps Lv 5 leans them onto the key stats', D)
ok(D.node && D.node.branch === 'mental' && D.node.max === 5 && D.node.cost >= 100, 'Focused Reps is a 5-level Mental node', D.node)
ok(D.repsStats >= 4 && D.attrStats >= 4, 'the reps and +1 cards land on several stats', D)

console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
if (errs.length) console.log('page errors:', errs.slice(0, 6))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
