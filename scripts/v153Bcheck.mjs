// Dev check (v153 B THE LOCKER ROOM REMEMBERS WHO YOU ARE · ONE KEY STAT, OR TWO AND A RISK ·
// INJURIES STAY ON HIS MIND · MY PLAYS ARE MY SIDE OF THE BALL) — src/07-career-app.js (+ src/10, src/18, the coach).
//
//   1. the locker room: a toxic personality drives named teammates away (replaced by weaker men, the team's rating
//      drops), a team-first one lifts a named teammate; the roll is seeded per season; the roster and the season
//      screen name the men; story swings and the wheel move chemistry and earn a follow-up roll; the kill switch
//   2. the team's quality: the prestige share is halved (and its kill switch restores it), chemistry and the
//      sacrifice move the rating; SACRIFICE FOR A TEAMMATE takes points off his sheet and lifts a named teammate
//   3. training: every program is ONE key stat, or TWO with a risk; the risk is rolled once a season, prestige
//      shaves the odds but never below the floor; an injury risk multiplies the real injury roll; the board shows
//      it; the suggestion moves season to season
//   4. injuries: the prestige nodes, the Ironman path and the gear pay a fraction of what they did; kill switch
//   5. My Plays Only: free, on for a fresh save AND switched on once for an old one, your side of the ball
//
//   GAME_URL=http://localhost:6200/ node scripts/v153Bcheck.mjs
import { gameUrl, launch } from './lib/env.mjs'

const browser = await launch()
const page = await browser.newPage({ viewport: { width: 420, height: 900 } })
const errors = []
page.on('pageerror', e => errors.push(String(e.message || e)))
await page.goto(gameUrl('index.html?stayStale&noFilmV114'), { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V153B, null, { timeout: 40000 })
await page.waitForTimeout(1200)

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const M = (fn, arg) => page.evaluate(fn, arg)

// a seeded career: an RB at level 5 with a season in hand
const seed = (o = {}) => M((o) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true
  S.prestige = o.prestige || 0
  S.player = A.newPlayer(); S.player.name = o.name || 'Test Man'; S.player.pos = o.pos || 'RB'; S.player.level = o.level == null ? 5 : o.level
  if (o.persona) S.player.personaV13 = o.persona
  A.setState(S)
  window.RIB_TUNE = window.RIB_TUNE || {}
  return true
}, o)
const TOXIC = { aggression: 8, iq: 5, eq: 1, longterm: 5, workethic: 5, loyalty: 0, confidence: 10, coachability: 1 }
const TEAM = { aggression: 4, iq: 6, eq: 9, longterm: 6, workethic: 7, loyalty: 10, confidence: 2, coachability: 9 }
const NEUTRAL = { aggression: 5, iq: 5, eq: 5, longterm: 5, workethic: 5, loyalty: 5, confidence: 5, coachability: 5 }

// ---------- 1. the locker room ----------
await seed({ persona: TOXIC })
const toxic = await M(async () => {
  const V = window.__V153B, pl = window.S.player
  const before = { dq: V.decisionQ(), us: V.teamPair().us }
  window.startSeasonGames(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove()
  const L = JSON.parse(JSON.stringify(V.locker())), R = pl.teamRosterV158 || []
  const leaves = L.events.filter(v => v.kind === 'leave')
  const inRoster = leaves.every(v => R[v.slot] && R[v.slot].name === v.newName && v.ovrTo < v.ovrFrom)
  // many seasons: how often a toxic man drives somebody out, and how many
  let seasonsWithLeave = 0, maxOut = 0, lifts = 0; const N = 40
  for (let i = 0; i < N; i++) { pl.totalSeasons = 100 + i; pl.lockerV153B = null; const out = V.roll('season'); const n = out.filter(v => v.kind === 'leave').length; if (n) seasonsWithLeave++; maxOut = Math.max(maxOut, n); lifts += out.filter(v => v.kind !== 'leave').length }
  // seeded: the same season rolls the same men
  let st = 777, a = ''
  for (; st < 800 && !a; st++) { pl.totalSeasons = st; pl.lockerV153B = null; a = V.roll('season').map(v => v.slot + '>' + v.newName).join() }
  pl.totalSeasons = st - 1; pl.lockerV153B = null; const b = V.roll('season').map(v => v.slot + '>' + v.newName).join()
  pl.totalSeasons = 0; pl.lockerV153B = null
  window.go('season'); await new Promise(r => setTimeout(r, 500))
  return { persona: V.persona(), before, L, inRoster, leaves: leaves.length, seasonsWithLeave, N, maxOut, lifts, same: a === b && a.length > 0, a }
})
console.log('toxic:', JSON.stringify({ persona: toxic.persona, leaves: toxic.leaves, ovrDelta: toxic.L.ovrDelta, rate: toxic.seasonsWithLeave + '/' + toxic.N, maxOut: toxic.maxOut }))
ok(toxic.persona.tox > 1.2 && toxic.persona.team === 0, 'a me-first, brash, volatile, stubborn kid reads as toxic', toxic.persona)
ok(toxic.seasonsWithLeave / toxic.N > 0.55 && toxic.maxOut >= 2 && toxic.maxOut <= 3 && toxic.lifts === 0, 'a toxic man drives 1-3 teammates away most seasons — and lifts nobody', `${toxic.seasonsWithLeave}/${toxic.N}, most ${toxic.maxOut}`)
ok(toxic.same, 'the roll is seeded per season: the same season sends the same men away', toxic.a)

// the real season start (fresh page state): the named men, the roster, the rating
await seed({ persona: TOXIC, name: 'Rotten Apple' })
const real = await M(async () => {
  const V = window.__V153B, pl = window.S.player
  let tries = 0, L = null, before = null
  // a season where somebody leaves (seeded — step the season until one does)
  for (; tries < 12; tries++) {
    pl.lockerV153B = null; pl.totalSeasons = tries; pl.worldState = { teamChemistry: 50, programMomentum: 50, mediaHeat: 20 }
    before = V.teamPair().us
    window.startSeasonGames(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove()
    L = V.locker(); if (L.leaves) break
  }
  const R = pl.teamRosterV158 || [], ev = L.events.filter(v => v.kind === 'leave')
  window.go('season'); await new Promise(r => setTimeout(r, 500))
  const card = (document.getElementById('lockerV153B') || {}).textContent || ''
  return { tries, leaves: L.leaves, names: ev.map(v => v.name), inRoster: ev.every(v => R[v.slot] && R[v.slot].name === v.newName && R[v.slot].ovr < v.ovrFrom),
    notInRoster: ev.every(v => !R.some(p => p.name === v.name)), ovrDelta: L.ovrDelta, before, after: V.teamPair().us, card, chem: V.chem() }
})
console.log('real:', JSON.stringify(real))
ok(real.leaves >= 1 && real.names.length && real.inRoster, 'at season start the named teammates leave the persistent roster, replaced by weaker men', real.names.join(', '))
ok(real.ovrDelta < 0 && real.after < real.before, 'and the team rating drops', `roster ${real.ovrDelta} · team ${real.before} → ${real.after}`)
ok(real.names.every(n => real.card.includes(n)) && /LOCKER ROOM/.test(real.card), 'the season screen names every man who left', real.card.slice(0, 140))

await seed({ persona: TEAM, name: 'Captain Glue' })
const team = await M(async () => {
  const V = window.__V153B, pl = window.S.player
  let seasons = 0, leaves = 0, liftAmt = []; const N = 40
  for (let i = 0; i < N; i++) { pl.totalSeasons = 200 + i; pl.lockerV153B = null; const out = V.roll('season'); if (out.some(v => v.kind === 'lift')) seasons++; leaves += out.filter(v => v.kind === 'leave').length; out.filter(v => v.kind === 'lift').forEach(v => liftAmt.push(v.amt)) }
  pl.totalSeasons = 0; pl.lockerV153B = null
  const dq0 = V.decisionQ(), ev = V.roll('season', { force: 'lift' })[0], dq1 = V.decisionQ()
  const R = pl.teamRosterV158 || []
  return { persona: V.persona(), seasons, N, leaves, liftAmt: liftAmt.slice(0, 5), ev, named: !!(ev && R[ev.slot] && R[ev.slot].name === ev.name && ev.ovrTo > ev.ovrFrom), dq0, dq1 }
})
console.log('team:', JSON.stringify(team))
ok(team.persona.team > 1 && team.persona.tox === 0, 'a team-first, even-keeled, coachable, humble kid reads as a leader', team.persona)
ok(team.seasons / team.N > 0.35 && team.leaves === 0, 'a leader lifts a teammate in a good share of seasons and drives nobody away', `${team.seasons}/${team.N}, amounts ${team.liftAmt.join(',')}`)
ok(team.named && team.dq1 > team.dq0, 'the lifted man is NAMED, plays at his new number, and the team is better for it', `${team.ev && team.ev.name} ${team.ev && team.ev.ovrFrom}→${team.ev && team.ev.ovrTo}`)

await seed({ persona: NEUTRAL })
const neutral = await M(() => {
  const V = window.__V153B, pl = window.S.player; let n = 0
  for (let i = 0; i < 30; i++) { pl.totalSeasons = 300 + i; pl.lockerV153B = null; n += V.roll('season').length }
  return n
})
ok(neutral === 0, 'a neutral personality leaves the roster alone', String(neutral))

await seed({ persona: TOXIC })
const kill = await M(() => {
  const V = window.__V153B, pl = window.S.player; window.RIB_TUNE.v153Broster = 0; let n = 0
  for (let i = 0; i < 20; i++) { pl.totalSeasons = 400 + i; pl.lockerV153B = null; n += V.roll('season').length }
  delete window.RIB_TUNE.v153Broster; return n
})
ok(kill === 0, 'TU("v153Broster", 0) turns the rolls off', String(kill))

// story swings and the wheel
await seed({ persona: NEUTRAL })
const moves = await M(() => {
  const V = window.__V153B, pl = window.S.player
  const c0 = V.chem(); V.story({ chemistry: 14, trust: 5 }); const c1 = V.chem(), storyRolls = V.locker().rolled.story || 0
  V.spin(pl, { card: 'social', sign: 1, name: 'Host the Team Cookouts' }); const c2 = V.chem()
  V.spin(pl, { card: 'edge', sign: -1, name: 'Underground 7-on-7s' }); const c3 = V.chem()
  V.spin(pl, { card: 'iron', sign: 1, name: 'Old-School Iron' }); const c4 = V.chem()
  return { c0, c1, storyRolls, c2, c3, c4, spinRolls: V.locker().rolled.spin || 0 }
})
console.log('moves:', JSON.stringify(moves))
ok(moves.c1 - moves.c0 === 14 && moves.storyRolls === 1, 'a story swing moves the chemistry and earns a follow-up roll', moves)
ok(moves.c2 - moves.c1 === 4 && moves.c3 - moves.c2 === -3 && moves.c4 === moves.c3 && moves.spinRolls === 2, 'the wheel: team cookouts warm the room, an underground 7-on-7 gone wrong sours it, the weight room does neither')

// ---------- 2. the team's quality ----------
await seed({ persona: NEUTRAL, prestige: 15 })
const tq = await M(() => {
  const V = window.__V153B, pl = window.S.player
  const on = V.teamPair().us, pq = V.prestigeQ(1)
  window.RIB_TUNE.v153Bteam = 0; const off = V.teamPair().us, pqOff = V.prestigeQ(1); delete window.RIB_TUNE.v153Bteam
  pl.worldState = { teamChemistry: 85, programMomentum: 50, mediaHeat: 20 }; const warm = V.teamPair().us
  pl.worldState.teamChemistry = 15; const sour = V.teamPair().us
  pl.worldState.teamChemistry = 50
  return { on, off, pq, pqOff, warm, sour }
})
console.log('team quality:', JSON.stringify(tq))
ok(Math.abs(tq.pq - 0.525) < 1e-9 && Math.abs(tq.pqOff - 1.05) < 1e-9, 'the prestige share of the team is halved (0.525 of 1.05); the kill switch restores it', tq)
ok(tq.off - tq.on >= 8, 'a fully prestiged save fields a clearly weaker team from prestige alone', `${tq.off} → ${tq.on}`)
ok(tq.warm - tq.sour >= 5, 'the locker room carries real weight: a warm room vs a sour one', `${tq.sour} → ${tq.warm}`)

await seed({ persona: NEUTRAL })
const sac = await M(async () => {
  const V = window.__V153B, pl = window.S.player
  window.go('training'); await new Promise(r => setTimeout(r, 500))
  const card = (document.getElementById('lockerV153B') || {}).textContent || ''
  const sum = () => Object.values(pl.attrs).reduce((a, b) => a + b, 0)
  const s0 = sum(), c0 = V.chem(), dq0 = V.decisionQ(), cost = V.sacrificeCost()
  const ev = V.sacrifice(null, { silent: true })
  const s1 = sum(), c1 = V.chem(), dq1 = V.decisionQ(), again = V.sacrifice(null, { silent: true })
  const R = pl.teamRosterV158 || []
  return { card, cost, drop: s0 - s1, chem: c1 - c0, dq0, dq1, ev, again, named: !!(ev && R[ev.slot] && R[ev.slot].name === ev.name) }
})
console.log('sacrifice:', JSON.stringify({ cost: sac.cost, drop: sac.drop, chem: sac.chem, ev: sac.ev && [sac.ev.name, sac.ev.pos, sac.ev.amt], dq: [sac.dq0, sac.dq1] }))
ok(/SACRIFICE FOR A TEAMMATE/.test(sac.card) && /GIVE UP/.test(sac.card), 'the offseason board offers SACRIFICE FOR A TEAMMATE, naming the man and the price', sac.card.slice(0, 120))
ok(sac.drop === sac.cost && sac.cost === 7, 'it takes its price off his own sheet (2 + level points)', `${sac.drop} of ${sac.cost}`)
ok(sac.named && sac.ev.amt >= 8 && sac.chem === 6 && sac.dq1 > sac.dq0, 'a named teammate grows, the room warms, the team is better', sac.ev && sac.ev.name)
ok(sac.again === null, 'once a season')

// ---------- 3. training ----------
await seed({ persona: NEUTRAL })
const tr = await M(async () => {
  const V = window.__V153B, P = V.programs(), pl = window.S.player, S = window.S
  const shape = {}
  for (const k in P) shape[k] = { n: P[k].focus.length, risk: V.riskOdds(k) }
  const liveFocus = window.__GRIDIRON_AUDIT__ && null
  const base = V.riskOdds('weight')
  S.tree = S.tree || {}; S.tree.fateOdds = 10; S.tree.fateHedge = 1; S.tree.quickstudy = 10
  const soft = V.riskOdds('weight'), softContact = V.riskOdds('contact'); S.tree = {}
  window.RIB_TUNE.v153BriskFloor = .3; S.tree.fateOdds = 10; const floor = V.riskOdds('weight'); delete window.RIB_TUNE.v153BriskFloor; S.tree = {}
  // the roll: once a season, and a hit costs something real
  const r1 = V.risk('weight'), r2 = V.risk('weight')
  let hit = null
  for (let i = 0; i < 60 && !hit; i++) { pl.totalSeasons = 500 + i; pl.riskV153B = null; const r = V.risk('weight'); if (r.hit) hit = r }
  // a sturdy, rested body, so the roll sits well under its ceiling and the multiplier shows whole
  const dur0 = pl.attrs.injuryResist; pl.attrs.injuryResist = 90; pl.conditionV11 && (pl.conditionV11.fatigue = 0)
  const injOn = hit ? window.__injChanceV54(pl, {}) : 0, mul = V.riskInjMul()
  pl.riskV153B = null; const injOff = window.__injChanceV54(pl, {}); pl.attrs.injuryResist = dur0
  let filmHit = null, spd0 = 0
  for (let i = 0; i < 60 && !filmHit; i++) { pl.totalSeasons = 600 + i; pl.riskV153B = null; spd0 = pl.attrs.speed; const r = V.risk('film'); if (r.hit) filmHit = { r, spd0, spd1: pl.attrs.speed } }
  pl.totalSeasons = 0; pl.riskV153B = null
  // the board
  window.go('training'); await new Promise(r => setTimeout(r, 500))
  window.previewTraining('weight'); await new Promise(r => setTimeout(r, 200))
  const riskTxt = (document.querySelector('.tp-risk-v153b') || {}).textContent || ''
  const pills = document.querySelectorAll('.tp-riskpill-v153b').length
  window.previewTraining('lab'); await new Promise(r => setTimeout(r, 200))
  const labQuiet = !document.querySelector('.tp-risk-v153b')
  // the programs the season roll reads are the new ones (and the kill switch brings the old ones back)
  const PR = window.__V124 && window.__V133 ? null : null
  return { shape, base, soft, softContact, floor, same: r1 === r2, hit, mul, injOn, injOff, filmHit, riskTxt, pills, labQuiet }
})
console.log('training:', JSON.stringify({ shape: tr.shape, base: tr.base, soft: tr.soft, floor: tr.floor, mul: tr.mul, inj: [tr.injOff, tr.injOn], film: tr.filmHit && [tr.filmHit.spd0, tr.filmHit.spd1] }))
const sh = Object.entries(tr.shape)
ok(sh.every(([k, v]) => v.n === 1 || v.n === 2) && sh.filter(([k, v]) => v.n === 2).every(([k, v]) => v.risk >= .15) && sh.filter(([k, v]) => v.n === 1).every(([k, v]) => v.risk === 0), 'every program trains ONE key stat, or TWO with a real risk', sh.map(([k, v]) => k + ':' + v.n + (v.risk ? '@' + v.risk : '')).join(' '))
ok(tr.soft < tr.base && tr.soft >= tr.base - .08 - 1e-9 && tr.softContact >= .15, 'prestige shaves the odds a little (at most 8 points) but never removes the risk', `${tr.base} → ${tr.soft}`)
ok(Math.abs(tr.floor - .3) < 1e-9, 'and the floor holds whatever the tree says', String(tr.floor))
ok(tr.same, 'the risk is rolled once a season, not once a render')
ok(tr.hit && tr.mul === 1.35 && tr.injOn > tr.injOff * 1.3, 'a Weight Room hit is a tweaked back: the real injury roll is ×1.35 all season', `${tr.injOff.toFixed(4)} → ${tr.injOn.toFixed(4)}`)
ok(tr.filmHit && tr.filmHit.spd1 < tr.filmHit.spd0, 'a Film Study hit costs him a step of Speed', tr.filmHit && `${tr.filmHit.spd0} → ${tr.filmHit.spd1}`)
ok(/TWO KEY STATS · A REAL RISK/.test(tr.riskTxt) && tr.pills === 5 && tr.labQuiet, 'the board says it: the risk sentence on the sheet, the odds on each risky tile, nothing on a safe one', `${tr.pills} tiles · ${tr.riskTxt.slice(0, 80)}`)

const focusLive = await M(() => {
  const V124 = window.__V124, pl = window.S.player
  const g = k => window.__V133.grade(pl, k).focus.join('+')
  const on = { speed: g('speed'), weight: g('weight') }
  window.RIB_TUNE.v153Btrain = 0; const off = { speed: g('speed'), weight: g('weight') }; delete window.RIB_TUNE.v153Btrain
  return { on, off }
})
ok(focusLive.on.speed === 'speed' && focusLive.off.speed.split('+').length === 4 && focusLive.off.weight.split('+').length === 3, 'the kill switch brings the old focus lists back, live', focusLive)

// the suggestion moves through a career
const mix = await M(() => {
  const V = window.__V153B, pl = window.S.player, recs = []
  pl.trainHistV153B = []
  for (let s = 0; s < 10; s++) {
    pl.totalSeasons = s; pl.seasonsSinceStart = s
    const k = V.rec(); recs.push(k); pl.trainHistV153B.push(k)
    // a season of growth on what he trained
    for (const st of (V.programs()[k] || { focus: [] }).focus) pl.attrs[st] = (pl.attrs[st] || 0) + 6
  }
  const counts = {}; recs.forEach(k => counts[k] = (counts[k] || 0) + 1)
  let runs = 0; for (let i = 1; i < recs.length; i++) if (recs[i] === recs[i - 1]) runs++
  return { recs, distinct: Object.keys(counts).length, top: Math.max(...Object.values(counts)), runs }
})
console.log('suggestions:', mix.recs.join(' > '))
ok(mix.distinct >= 4 && mix.top <= 4 && mix.runs <= 2, 'the coach suggests a different program as the career goes on', `${mix.distinct} programs, most ${mix.top} of 10, ${mix.runs} repeats`)

// ---------- 4. injuries ----------
await seed({ persona: NEUTRAL })
const inj = await M(() => {
  const V = window.__V153B, S = window.S, pl = S.player
  const at = (tree, fn) => { S.tree = tree; const v = fn(); S.tree = {}; return v }
  const base = window.__injChanceV54(pl, {})
  const maxed = at({ recovery: 6, ligaments: 5, oline_wall: 5, etAegis: 40 }, () => window.__injChanceV54(pl, {}))
  window.RIB_TUNE.v153Binj = 0
  const maxedOff = at({ recovery: 6, ligaments: 5, oline_wall: 5, etAegis: 40 }, () => window.__injChanceV54(pl, {}))
  const nodeOff = at({ medic: 6, unstoppable: 2 }, () => V.inj.nodeMul()), healOff = at({ fastHeal: 2 }, () => V.inj.heal(6))
  delete window.RIB_TUNE.v153Binj
  const nodeOn = at({ medic: 6, unstoppable: 2 }, () => V.inj.nodeMul()), healOn = at({ fastHeal: 2 }, () => V.inj.heal(6))
  S.path = 'ironman'; const iron = V.inj.nodeMul(); S.path = null
  const nodes = window.__GRIDIRON_AUDIT__ && window.__GRIDIRON_AUDIT__.TREE_NODES
  const desc = nodes ? ['iron', 'recovery', 'ligaments', 'trainerRoom', 'fastHeal'].map(k => nodes[k] && nodes[k].desc) : []
  return { base, maxed, maxedOff, cut: 1 - maxed / base, cutOff: 1 - maxedOff / base, nodeOn, nodeOff, healOn, healOff, iron, ironStep: V.inj.iron(), trainer: V.inj.trainerWeeks(), desc }
})
console.log('injuries:', JSON.stringify(inj))
ok(inj.cut <= 0.25 + 1e-9 && inj.cut > 0.1 && inj.cutOff > 0.5, 'a maxed injury tree takes at most 25% off the roll (it took over half)', `${Math.round(inj.cutOff * 100)}% → ${Math.round(inj.cut * 100)}%`)
ok(inj.nodeOn > 0.75 && inj.nodeOff < 0.4, 'Team Medical Staff + Unstoppable pay ~30% of what they did', `${inj.nodeOff.toFixed(2)} → ${inj.nodeOn.toFixed(2)}`)
ok(inj.iron > 0.75, 'the Ironman path is no longer injury-proof', inj.iron.toFixed(2))
ok(inj.healOn > inj.healOff && inj.healOn < 6, 'Miracle Hands still shortens a layoff, by much less', `${inj.healOff} → ${inj.healOn} of 6`)
ok(inj.ironStep === 2 && inj.trainer === 6, 'Iron Body is +2 Durability a level; Trainer\'s Room a six-game layoff, not three')
ok(!inj.desc.length || (/\+2 starting Durability/.test(inj.desc[0]) && /2% rarer/.test(inj.desc[1]) && /six games/.test(inj.desc[3])), 'and the node descriptions say the new numbers', inj.desc.join(' | ').slice(0, 160))

// ---------- 5. My Plays Only ----------
const plays = await M(async () => {
  const A = window.__GRIDIRON_AUDIT__, V = window.__V153B
  const fresh = A.freshState()
  const out = { freshOn: fresh.settings.onlyInvolved === true }
  // an old save: the setting stored OFF, never migrated — switched on once, then respected
  const S = A.freshState(); S.tutorialSeen = true; S.careersCompleted = 0; S.settings = { skipOpp: false, onlyInvolved: false, fastSim: false, sound: true, haptics: true }
  S.player = A.newPlayer(); S.player.pos = 'LB'; S.player.level = 3; A.setState(S)
  out.gate = window.__V151A.gates().playsOnly.ok
  window.go('settings'); await new Promise(r => setTimeout(r, 400))
  const row = [...document.querySelectorAll('.toggle-row')].find(r => /My plays only/i.test(r.textContent))
  out.row = row ? row.textContent.replace(/\s+/g, ' ').trim() : ''
  out.rowOn = !!(row && row.querySelector('.switch.on'))
  out.migrated = window.S.settings.onlyInvolved === true
  window.toggleSetting('onlyInvolved'); out.offAfterToggle = window.S.settings.onlyInvolved === false
  window.go('settings'); await new Promise(r => setTimeout(r, 200)); out.stillOff = window.S.settings.onlyInvolved === false
  window.toggleSetting('onlyInvolved')
  // the side of the ball
  window.startSeasonGames(); document.getElementById('growthV42')?.remove()
  const t = window.S.player, g = window.__simGameV2(t.weekResults[0].perf, t.pos)
  const shown = g.plays.filter(p => !V.playsSkip(p))
  out.lb = { total: g.plays.length, shown: shown.length, oppSnaps: shown.filter(p => !p.header && p.offense === 'them').length,
    ours: shown.filter(p => p.offense === 'us' && !p.involved).length, st: shown.filter(p => /^(punt|kickoff|fg|xp)$/.test(p.event) && !p.involved).length,
    involved: g.plays.filter(p => p.involved).every(p => !V.playsSkip(p)) }
  t.pos = 'QB'
  const g2 = window.__simGameV2(t.weekResults[1].perf, 'QB'), shown2 = g2.plays.filter(p => !V.playsSkip(p))
  out.qb = { total: g2.plays.length, shown: shown2.length, theirs: shown2.filter(p => p.offense === 'them' && !p.involved).length, ours: shown2.filter(p => !p.header && p.offense === 'us').length }
  window.RIB_TUNE.v153Bplays = 0; S.careersCompleted = 0; S.hof = []; out.gateOff = window.__V151A.gates().playsOnly.ok; delete window.RIB_TUNE.v153Bplays
  return out
})
console.log('plays:', JSON.stringify(plays))
ok(plays.freshOn && plays.gate, 'My Plays Only is free and ON for a fresh save', plays)
ok(plays.migrated && plays.rowOn && !/🔒/.test(plays.row) && /side of the ball/.test(plays.row), 'an old save that had it off is switched on once, the Settings row is unlocked and says what it does', plays.row.slice(0, 100))
ok(plays.offAfterToggle && plays.stillOff, 'and the player can still turn it off — it stays off')
ok(plays.lb.oppSnaps > 10 && plays.lb.ours === 0 && plays.lb.st === 0 && plays.lb.involved, 'a linebacker watches his defense on the field: every opponent snap, none of our offense, special teams only when he is in them', plays.lb)
ok(plays.qb.ours > 10 && plays.qb.theirs === 0, 'a quarterback watches his offense', plays.qb)
ok(plays.gateOff === false, 'TU("v153Bplays", 0) restores the v151 A gate')

const coach = await M(async () => {
  const src = [...document.scripts].map(s => s.src).find(s => /rib-menu-coach\.js/.test(s))
  if (!src) return false
  const t = await (await fetch(src)).text()
  return /id: 'live'[^\n]*\n(?:[^\n]*\n){0,4}[^\n]*My Plays Only is on by default/.test(t)
})
ok(coach, 'the coach explains it at the first broadcast')

ok(errors.length === 0, 'no page errors', errors.slice(0, 3).join(' | ') || 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
