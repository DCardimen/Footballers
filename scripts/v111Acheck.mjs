// v111 A dev check — THE MODEL AND THE ENGINE.
//
// Proves the half of "your game, your body" that lives in the model and the engine:
//   1. window.__V111 exposes all six contract members with the right shapes.
//   2. At "normal" with no focus the engine is IDENTICAL to the build before v111 — same
//      seeded games, same number of Math.random() calls (run with BASE_URL=<old build>).
//   3. At "limited" his snaps and his stat line fall materially while the TEAM's points and
//      plays do not — his teammates absorb the work.
//   4. At "everysnap" his stat line rises and the forecast's load rises with it.
//   5. forecast() responds to durability, opponent rating and stakes in the right direction.
//   6. charge() moves fatigue, moves the injury chance, and writes a lingering cut that decays
//      over its `games` countdown.
//   7. A rest snap credits him nothing: on the snaps he sits, the sim never names him.
//   8. A focus pick raises exactly one stat by 1.2x in effAttrsV85 AND in what the sim reads —
//      and all 27 picks across the nine positions land on the engine's own attribute accessor.
//   9. THE SEASON ARC, through REAL weeks resolved by resolveSequentialWeekV11: held at
//      "everysnap" the load climbs, the injury chance climbs with it, a lingering cut arrives
//      and his effective rating falls; dialled back to "limited" the load is paid off again.
//
// Env: GAME_URL (default http://localhost:5191/index.html), BASE_URL (the pre-v111 build, for
// the identity test — skipped when unset), GAMES (per involvement key, default 150), AB (games
// for the identity test, default 30), POS (default RB).
import { chromium } from 'playwright'

const URL = process.env.GAME_URL || 'http://localhost:5191/index.html'
const BASE = process.env.BASE_URL || ''
const N = Number(process.env.GAMES || 150)   // v120: 90 left the team-spread verdict inside its own sampling noise
const AB = Number(process.env.AB || 30)
const POS = process.env.POS || 'RB'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const pageErrors = []
const fails = []
const ok = (cond, label, extra) => { if (!cond) fails.push(label + (extra !== undefined ? ' — ' + JSON.stringify(extra) : '')) }

// ---------------------------------------------------------------- shared page plumbing
async function open (url, seeded) {
  const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
  page.on('pageerror', e => pageErrors.push(url + ' PAGEERROR: ' + e.message))
  page.on('console', m => { if (m.type() === 'error') pageErrors.push(url + ' CONSOLE: ' + m.text()) })
  await page.addInitScript(({ seeded }) => {
    if (seeded) { // a deterministic clock for the identity test — two builds cannot be compared without one
      let s = 1
      window.__rc = 0
      window.__seed = v => { s = (v >>> 0) || 1; window.__rc = 0 }
      Math.random = function () { window.__rc++; s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 }
    }
    setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60)
  }, { seeded })
  await page.goto(url, { waitUntil: 'commit', timeout: 30000 })
  await page.waitForFunction(() => typeof window.__simGameV2 === 'function', null, { timeout: 60000 })
  await page.waitForTimeout(400)
  return page
}
const VIS = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click (page, t) {
  await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t === 'ARCH') el = els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
    else el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) el.click()
  }, { t, visSrc: VIS })
  await page.waitForTimeout(350)
}
async function career (page, pos) {
  for (const s of ['START NEW CAREER', 'ARCH', pos + ' ', 'Lock In Personality', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING']) await click(page, s)
}

// ================================================================ 1/2. the API, and identity
// Career creation is not reproducible under a seeded clock (the menus consume randomness on
// their own timers), so the identity run plays seeded games with no career loaded at all —
// which is exactly the state every other engine check sims in.
const fingerprint = async (url) => {
  const page = await open(url, true)
  const rows = await page.evaluate(({ AB, POS }) => {
    const out = []
    for (let g = 0; g < AB; g++) {
      window.__seed(1000 + g * 7)
      const x = window.__simGameV2(45 + (g % 9) * 5, POS)
      out.push([window.__rc, x.usScore, x.themScore, x.plays.length, x.team.yds, x.oppTeam.yds, x.team.pass,
        x.team.rush, x.team.sacks, x.team.turn, x.stat.rush, x.stat.rec, x.stat.td, x.stat.carries, x.stat.tackle].join('|'))
    }
    return out
  }, { AB, POS })
  await page.close()
  return rows
}
const mine = await fingerprint(URL)
let identity = { ran: false }
if (BASE) {
  const base = await fingerprint(BASE)
  let diff = 0, first = null
  for (let i = 0; i < mine.length; i++) if (mine[i] !== base[i]) { diff++; if (!first) first = { i, mine: mine[i], base: base[i] } }
  identity = { ran: true, games: mine.length, identical: diff === 0, differing: diff, first }
  ok(diff === 0, 'DEFAULTS ARE NOT BYTE-IDENTICAL to the pre-v111 build', first)
}

// ================================================================ the rest, on one career
const page = await open(URL, false)
await career(page, POS)
const res = await page.evaluate(({ N, POS }) => {
  const R = {}
  const ST = window.__GRIDIRON_AUDIT__.getState(), pl = ST.player, V = window.__V111
  const AU = window.__GRIDIRON_AUDIT__
  pl.pos = POS
  const wk = () => pl.weekResults.find(w => w && !w.played)
  const round = (v, d = 2) => +Number(v).toFixed(d)

  // ---- 1. the API surface --------------------------------------------------------------
  const u = V.usage(pl), fc = V.forecast(pl, undefined, 'normal'), fl = V.focusFor(POS)
  R.api = {
    members: ['KEYS', 'usage', 'forecast', 'charge', 'focusFor', 'buffFor'].filter(k => V[k] === undefined),
    keys: V.KEYS, keysOk: Array.isArray(V.KEYS) && V.KEYS.join(',') === 'limited,reduced,normal,heavy,everysnap',
    usageShape: ['key', 'share', 'touchMul', 'label', 'desc'].filter(k => u[k] === undefined),
    forecastShape: ['load', 'fatigueAfter', 'injPct', 'gamesMissed', 'statCut', 'parts', 'stakes', 'oppMul', 'durMul'].filter(k => fc[k] === undefined),
    partsOk: Array.isArray(fc.parts) && fc.parts.length > 0 && fc.parts.every(p => p.label && typeof p.mul === 'number'),
    focusN: fl.length,
    focusShape: fl.every(x => x.key && x.name && x.icon && x.stat && x.mul === 1.2 && x.desc),
    focusEveryPos: ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'].filter(p => {
      const l = V.focusFor(p); return !(l.length === 3 && l.every(x => x.stat && window.__GRIDIRON_AUDIT__.ATTRS.indexOf(x.stat) >= 0))
    }),
    // every focus must name a key FieldSim actually builds an agent from — a buff on a stat
    // nobody asks for would show on the sheet and do nothing on the grass
    focusDeadStats: ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'ATH']
      .reduce((bad, p) => bad.concat(V.focusFor(p).filter(x => V.SIM_KEYS.indexOf(x.stat) < 0).map(x => p + ':' + x.stat)
        .concat((V.focusFor(p).flatMap(x => (x.also || []).map(k => [p, x.key, k]))).filter(([, , k]) => V.SIM_KEYS.indexOf(k) < 0).map(([p2, kk, k]) => p2 + ':' + kk + '→' + k))), []),
    buffNull: V.buffFor(undefined) === null,
    // v120: NORMAL is the share the coach trusts him with (trustShareV120), not every snap; the ball is untouched
    normalIsNoop: u.key === 'normal' && u.touchMul === 1 && u.share > .2 && u.share <= 1 && Math.abs(u.share - window.__V120.trustShare(pl)) < 1e-9
  }

  // ---- 3/4. the dial reaches the snap ---------------------------------------------------
  const you = k => {
    wk().usageV111 = k
    const a = { us: 0, them: 0, plays: 0, yds: 0, prod: 0, touch: 0, on: 0, team: 0, snapRows: 0 }
    for (let g = 0; g < N; g++) {
      const r = window.__simGameV2(55, POS)
      a.us += r.usScore; a.them += r.themScore; a.plays += r.plays.length; a.yds += r.team.yds
      const s = r.stat
      a.prod += (s.rush || 0) + (s.rec || 0) + (s.pass || 0) + (s.tackle || 0) * 10 + (s.pd || 0) * 10 + (s.sack || 0) * 10
      a.touch += (s.carries || 0) + (s.rec_c || 0) + (s.tackle || 0) + (s.pd || 0)
      if (r.snapsV111 && r.snapsV111.on != null) { a.on += r.snapsV111.on; a.team += r.snapsV111.team; a.snapRows++ }
    }
    return { key: k, us: round(a.us / N), them: round(a.them / N), plays: round(a.plays / N, 1), yds: round(a.yds / N, 1),
      prod: round(a.prod / N, 1), touch: round(a.touch / N), snapPct: a.team ? round(100 * a.on / a.team, 1) : 100 }
  }
  R.dial = V.KEYS.map(you)
  wk().usageV111 = 'normal'
  const lim = R.dial[0], nor = R.dial[2], hev = R.dial[3], evr = R.dial[4]
  R.dialVerdict = {
    snapsFell: lim.snapPct > 15 && lim.snapPct < (R.dial.find(r => r.key === 'normal') || { snapPct: 100 }).snapPct - 8,   // he really is off the field (v120: NORMAL itself is the coach's share, so LIMITED is measured against it)
    statsFell: lim.prod < nor.prod * 0.72 && lim.touch < nor.touch * 0.72, // and it shows on the sheet
    statsRose: evr.prod > nor.prod * 1.12 && evr.touch > nor.touch * 1.12,
    ladder: lim.touch < nor.touch && nor.touch < hev.touch && hev.touch <= evr.touch,
    teamHeld: (Math.max(...R.dial.map(r => r.us)) - Math.min(...R.dial.map(r => r.us))) <= 4.5
      && (Math.max(...R.dial.map(r => r.plays)) - Math.min(...R.dial.map(r => r.plays))) <= 10,
    teamSpread: { us: round(Math.max(...R.dial.map(r => r.us)) - Math.min(...R.dial.map(r => r.us)), 1),
      plays: round(Math.max(...R.dial.map(r => r.plays)) - Math.min(...R.dial.map(r => r.plays)), 1) }
  }

  // ---- 7. a rest snap credits him nothing -----------------------------------------------
  // The engine swaps a backup into his roster slot for the snaps he sits, so the credited
  // actors on those plays can never be him. Measured as: he is involved in no more plays than
  // the snaps he was actually on the field for.
  wk().usageV111 = 'limited'
  let creditViolations = 0, involvedTot = 0, onTot = 0
  for (let g = 0; g < 40; g++) {
    const r = window.__simGameV2(55, POS)
    const inv = r.plays.filter(p => p && p.involved && !p.header).length
    involvedTot += inv; onTot += (r.snapsV111 && r.snapsV111.on) || 0
    if (inv > ((r.snapsV111 && r.snapsV111.on) || 0)) creditViolations++
  }
  R.restCredit = { games: 40, involved: involvedTot, onField: onTot, violations: creditViolations }
  ok2(creditViolations === 0)
  wk().usageV111 = 'normal'

  // ---- 5. the forecast reads the body, the opponent and the fixture ---------------------
  // At "normal" the bill is zero by construction (a normal week costs exactly what a week of
  // rest returns), so the directional tests are run where the dial is actually spending.
  const w = wk()
  const savedOpp = w.opponentV11, savedPo = w.playoff, savedRi = w.roundIdx, savedResist = pl.attrs.injuryResist
  const L = k => V.forecast(pl, w, k).load
  w.opponentV11 = { rating: 45 + pl.level * 5.5, name: 'Par' }
  const parEvery = L('everysnap'), parNormal = L('normal')
  pl.attrs.injuryResist = Math.min(99, savedResist + 30); const toughEvery = L('everysnap')
  pl.attrs.injuryResist = Math.max(1, savedResist - 5); const brittleEvery = L('everysnap')
  pl.attrs.injuryResist = savedResist
  w.opponentV11 = { rating: 45 + pl.level * 5.5 + 30, name: 'Monster' }; const hardEvery = L('everysnap')
  w.opponentV11 = { rating: Math.max(5, 45 + pl.level * 5.5 - 30), name: 'Cupcake' }; const softEvery = L('everysnap')
  w.opponentV11 = { rating: 45 + pl.level * 5.5, name: 'Par' }
  const savedLvl = pl.level
  pl.level = 7                                   // a bracket with a wild card, a semifinal and a final
  w.opponentV11 = { rating: 45 + pl.level * 5.5, name: 'Par' }
  const rounds = window.__GRIDIRON_AUDIT__.playoffRoundNames(pl.level)
  const parLvl7 = L('everysnap')
  w.playoff = true; w.roundIdx = rounds.length - 1; const finalEvery = L('everysnap'); const finalStakes = V.forecast(pl, w, 'everysnap').stakes
  w.roundIdx = rounds.length - 2; const semiEvery = L('everysnap'); const semiStakes = V.forecast(pl, w, 'everysnap').stakes
  w.playoff = savedPo; w.roundIdx = savedRi; pl.level = savedLvl; w.opponentV11 = savedOpp
  R.forecast = { parNormal: round(parNormal, 1), parEvery: round(parEvery, 1), toughEvery: round(toughEvery, 1), brittleEvery: round(brittleEvery, 1),
    softEvery: round(softEvery, 1), hardEvery: round(hardEvery, 1), parLvl7: round(parLvl7, 1), semiEvery: round(semiEvery, 1), finalEvery: round(finalEvery, 1),
    rounds: rounds.length,
    semiStakes: round(semiStakes), finalStakes: round(finalStakes), regularStakes: round(V.forecast(pl, w, 'everysnap').stakes) }
  R.forecastVerdict = {
    normalIsFree: Math.abs(parNormal) < 0.5,
    durability: toughEvery < parEvery && brittleEvery > parEvery,
    opponent: hardEvery > parEvery && softEvery < parEvery,
    stakes: finalEvery > semiEvery && semiEvery > parLvl7 && finalStakes > semiStakes && semiStakes > 1,
    dialRises: L('everysnap') > L('heavy') && L('heavy') > L('normal') && L('normal') > L('reduced') && L('reduced') > L('limited')
  }

  // ---- 6. the charge bites: fatigue, the injury roll, and a cut that decays --------------
  // injChanceV54 clamps at .55, and a pee-wee back with a rookie's injuryResist facing his own
  // level's opponents is often sitting on that ceiling before anything is charged — on him the
  // wear term cannot be seen moving the roll at all. The charge is therefore billed against a
  // body with headroom, which is the only configuration the claim is falsifiable on.
  const savedResist6 = pl.attrs.injuryResist
  pl.attrs.injuryResist = Math.max(savedResist6, 85)
  pl._wearV111 = null
  pl.conditionV11.fatigue = 20
  const inj0 = window.__injChanceV54(pl, { wk: w })
  const fat0 = pl.conditionV11.fatigue
  // Eight games, not six. The cut opens at `wearCutFrom` (45) and six heavy games land on ~47 —
  // inside the swing a single trait puts on wear (ironFrame x0.78, glassBones x1.3), so whether
  // this claim could be tested at all came down to the career's trait roll: it passed or failed
  // about one run in two, on both this build and its base. Eight games clear the threshold with
  // room on either side of that swing, which is what makes "charge() writes a cut" falsifiable.
  const bills = []
  for (let i = 0; i < 8; i++) bills.push(V.charge(pl, w, { snaps: 44, teamSnaps: 44, touchMul: 1.5, touches: 30 }))
  const inj1 = window.__injChanceV54(pl, { wk: w })
  const linger0 = JSON.parse(JSON.stringify(V.wear(pl).lingering))
  const cutStat = linger0[0] && linger0[0].stat
  const effCut = window.__V85.effAttrs(pl)
  // decay(pl, null) skips the once-a-week stamp the real path uses, so two games can be spent here
  V.decay(pl, null); const linger1 = JSON.parse(JSON.stringify(V.wear(pl).lingering))
  V.decay(pl, null); const linger2 = JSON.parse(JSON.stringify(V.wear(pl).lingering))
  R.charge = { bills: bills.map(b => ({ load: b.load, after: b.loadAfter, fat: b.fatigueAfter, cut: b.statCut, pct: b.statCutPct })),
    fat0, fat1: pl.conditionV11.fatigue, inj0: round(inj0 * 100, 1), inj1: round(inj1 * 100, 1),
    linger0, lingerGames1: linger1.map(b => b.games), linger2: linger2.length,
    cutStat, cutBase: cutStat && pl.attrs[cutStat], cutEff: cutStat && effCut.eff[cutStat] }
  R.chargeVerdict = {
    loadAccrues: bills[0].load > 0 && bills[5].loadAfter > bills[0].loadAfter,
    fatigueMoved: pl.conditionV11.fatigue > fat0 + 20,
    injuryMoved: inj1 > inj0 * 1.15,
    cutWritten: linger0.length > 0 && linger0.every(b => b.games > 0 && (b.mul < 1 || b.amt < 0)),
    cutReachesSheet: !!cutStat && effCut.eff[cutStat] < pl.attrs[cutStat],
    cutDecays: linger1.length === linger0.length && linger1.every(b => b.games === linger0[0].games - 1) && linger2.length === 0
  }

  // ---- a light week pays it back --------------------------------------------------------
  const heavyLoad = V.wear(pl).load
  for (let i = 0; i < 4; i++) V.charge(pl, w, { snaps: 20, teamSnaps: 44, touchMul: 0.7, touches: 6 })
  R.recovery = { from: round(heavyLoad), to: round(V.wear(pl).load), paidBack: V.wear(pl).load < heavyLoad }
  pl.attrs.injuryResist = savedResist6

  // ---- 8. the focus is a 1.2x that reaches the sheet AND the sim -------------------------
  pl._wearV111 = null
  pl.conditionV11.fatigue = 20
  const pick = V.focusFor(POS)[0]
  const before = window.__V85.effAttrs(pl)
  w.focusV111 = pick.key
  const after = window.__V85.effAttrs(pl)
  const active = V.buffFor(w)
  const simSees = V.buffs(pl).filter(b => b && b.v111 === 'focus')
  const moved = window.__GRIDIRON_AUDIT__.ATTRS.filter(k => after.eff[k] !== before.eff[k])
  w.focusV111 = null
  R.focus = { pick: pick.key, stat: pick.stat, mul: pick.mul, moved, base: pl.attrs[pick.stat],
    before: before.eff[pick.stat], after: after.eff[pick.stat], active, simSees,
    expected: Math.max(1, Math.round(Math.round(pl.attrs[pick.stat] * before.mult) * 1.2)) }
  R.focusVerdict = {
    exactlyOne: moved.length === 1 && moved[0] === pick.stat,
    isTwentyPct: after.eff[pick.stat] === R.focus.expected && after.eff[pick.stat] > before.eff[pick.stat],
    reachesSim: simSees.length === 1 && simSees[0].stat === pick.stat && simSees[0].mul === 1.2,
    buffForActive: active && active.stat === pick.stat && active.mul === 1.2
  }

  // ---- every focus, at every position, reaches the engine's own accessor -----------------
  // The multiplier lands inside `_raw`, the accessor FieldSim asks for each agent field by name.
  // One game per pick, reading back what that accessor returned for him.
  const bite = []
  const savedPos = pl.pos
  for (const p of ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S']) {
    pl.pos = p
    for (const pk of V.focusFor(p)) {
      w.focusV111 = pk.key
      let rows = null
      for (let tries = 0; tries < 4 && !rows; tries++) rows = window.__simGameV2(60, p).focusV111
      w.focusV111 = null
      bite.push(rows ? { pos: p, key: pk.key, keys: rows.map(r => r.stat + (r.kind === 'focusAlso' ? '*' : '')),
        on: rows.map(r => ({ stat: r.stat, rosterHas: r.rosterHas, base: r.base, raw: round(r.raw, 1), att: r.att, peerAtt: r.peerAtt })),
        lands: rows.every(r => r.raw > r.base * 1.1) } : { pos: p, key: pk.key, stat: pk.stat, lands: false, rows: null })
    }
  }
  pl.pos = savedPos
  R.bite = bite
  R.biteVerdict = { all: bite.every(b => b.lands), dead: bite.filter(b => !b.lands).map(b => b.pos + ':' + b.key + ' ' + (b.keys || [b.stat]).join('+')) }

  // ---- the weekly resolver bills the body -----------------------------------------------
  pl._wearV111 = null
  const wr = wk()
  if (wr) {
    wr.usageV111 = 'everysnap'
    try { AU.resolveSequentialWeekV11(pl, wr, 'balanced') } catch (e) { R.resolveErr = String(e).slice(0, 200) }
    R.resolve = { wear: wr.wearV111 ? { load: wr.wearV111.load, fat: wr.wearV111.fatigueAfter } : null,
      snaps: wr.snapsV111, ledgerLoad: V.wear(pl).load }
    wr.played = true; wr.won = true   // the week is over — ca() pre-books, the caller closes it
  }

  // ---- 9. THE SEASON ARC: the dial, left alone for weeks, through the real weekly path ---
  // Not charge() in a loop — actual weeks, resolved by the game's own resolveSequentialWeekV11,
  // so the load that accrues is billed from what the engine says he ACTUALLY did. Held at
  // "everysnap" the body has to walk toward the injury roll and a lingering cut; dialled back to
  // "limited" it has to pay load off again.
  pl._wearV111 = null
  pl._tempStatBuffsV25 = null
  // A body with HEADROOM, for the same reason section 6 needs one: injChanceV54 clamps at .55,
  // and a pee-wee back with a rookie's frame is pinned on that ceiling before a snap is played,
  // so neither the climb nor the recovery can be observed on him at all. A durable frame on
  // fresh legs keeps the whole arc inside the model's range.
  pl.attrs.injuryResist = Math.max(pl.attrs.injuryResist, 95)
  pl.conditionV11.fatigue = 5
  // REAL fixtures to spend, built by the game's own scheduler — and a fresh season rolled the
  // moment one runs out, so the arc is as long as the claim needs rather than as long as an
  // eight-game slate happens to be.
  const newSeason = () => { try { pl.playoffState = null; pl.weekResults = AU.buildSeasonSchedule(pl); pl.currentWeek = 0 } catch (e) { R.arcErr = 'schedule: ' + String(e).slice(0, 120) } }
  newSeason()
  // ca() pre-books a week and is idempotent on it (`if(t.generatedV11) return t`); closing the
  // week is the caller's job, exactly as lt() does it on the real path. An already-booked week is
  // skipped rather than re-billed.
  const freeWeek = () => pl.weekResults.find(w => w && !w.played && !w.generatedV11)
  const arcWeek = () => freeWeek() || (newSeason(), freeWeek())
  const arcRow = (key) => {
    const w = arcWeek()
    if (!w) return null
    w.usageV111 = key
    try { AU.resolveSequentialWeekV11(pl, w, 'balanced') } catch (e) { R.arcErr = String(e).slice(0, 160); return null }
    w.played = true; w.won = !!(w.us > w.them)
    const eff = window.__V85.effAttrs(pl)
    const L = V.wear(pl).lingering.filter(b => b && (b.games | 0) > 0)
    return { key, load: round(V.wear(pl).load, 1), billed: w.wearV111 ? round(w.wearV111.load, 1) : null,
      fat: Math.round(pl.conditionV11.fatigue || 0), satOut: !!w.satOut, injured: !!w.injured,
      inj: round(window.__injChanceV54(pl, { wk: w }) * 100, 1),
      cuts: L.map(b => b.stat + ' ' + b.amt + '/' + b.games).join(','),
      cutPts: L.reduce((t, b) => t + Math.abs(b.amt || 0), 0),
      // how far BELOW the condition-only number the sheet actually draws him — that gap is the
      // lingering cut arriving on the attribute page, and nothing else
      sheetGap: L.reduce((t, b) => t + Math.max(0, Math.round((pl.attrs[b.stat] || 0) * eff.mult) - (eff.eff[b.stat] || 0)), 0),
      effSum: window.__GRIDIRON_AUDIT__.ATTRS.reduce((t, k) => t + (eff.eff[k] || 0), 0) }
  }
  const heavyArc = [], lightArc = []
  for (let i = 0; i < 8 && arcWeek(); i++) { const r = arcRow('everysnap'); if (r) heavyArc.push(r) }
  const peak = heavyArc.length ? heavyArc[heavyArc.length - 1] : null
  for (let i = 0; i < 4 && arcWeek(); i++) { const r = arcRow('limited'); if (r) lightArc.push(r) }
  const floorRow = lightArc.length ? lightArc[lightArc.length - 1] : null
  R.arc = { heavy: heavyArc, light: lightArc }
  R.arcVerdict = peak && floorRow ? {
    loadClimbs: peak.load > heavyArc[0].load && peak.load > 35 && heavyArc.every((r, i) => !i || r.load > heavyArc[i - 1].load),
    injuryClimbs: peak.inj > heavyArc[0].inj * 1.15,
    cutArrives: peak.cutPts > 0 && !heavyArc[0].cuts,
    ratingDrops: peak.sheetGap > 0 && peak.effSum < heavyArc[0].effSum,
    dialBackPays: floorRow.load < peak.load - 10,
    injuryEases: floorRow.inj < peak.inj,
  } : { ran: false }
  return R

  function ok2 () {}
}, { N, POS })

// ------------------------------------------------------------------------ verdicts
const A = res.api
ok(A.members.length === 0, 'window.__V111 is missing contract members', A.members)
ok(A.keysOk, 'KEYS is wrong', A.keys)
ok(A.usageShape.length === 0, 'usage() is missing fields', A.usageShape)
ok(A.forecastShape.length === 0, 'forecast() is missing fields', A.forecastShape)
ok(A.partsOk, 'forecast().parts is not a list of {label,mul}')
ok(A.focusN === 3 && A.focusShape, 'focusFor() must return exactly 3 {key,name,icon,stat,mul:1.2,desc}', { n: A.focusN })
ok(A.focusEveryPos.length === 0, 'focusFor() does not cover every position with real attributes', A.focusEveryPos)
ok(A.focusDeadStats.length === 0, 'a focus names a stat FieldSim never asks for — it would do nothing on the field', A.focusDeadStats)
ok(A.buffNull, 'buffFor() must be null with no focus picked')
ok(A.normalIsNoop, 'usage() at "normal" must be the coach\'s trust share (v120) / touchMul 1', A)

const D = res.dialVerdict
ok(D.snapsFell, 'at "limited" his share of snaps did not fall to the dial', res.dial)
ok(D.statsFell, 'at "limited" his stat line did not fall materially', res.dial)
ok(D.statsRose, 'at "everysnap" his stat line did not rise', res.dial)
ok(D.ladder, 'the dial is not monotone in touches', res.dial.map(r => r.touch))
ok(D.teamHeld, 'the TEAM\'s points or plays moved with the dial', res.dial)
ok(res.restCredit.violations === 0, 'a rest snap credited him', res.restCredit)

const F = res.forecastVerdict
ok(F.normalIsFree, '"normal" must cost the body nothing by construction', res.forecast)
ok(F.durability, 'forecast does not respond to durability', res.forecast)
ok(F.opponent, 'forecast does not respond to the opponent', res.forecast)
ok(F.stakes, 'forecast does not respond to the stakes of the fixture', res.forecast)
ok(F.dialRises, 'forecast load is not monotone in the dial', res.forecast)

const C = res.chargeVerdict
ok(C.loadAccrues, 'charge() does not accrue load', res.charge)
ok(C.fatigueMoved, 'charge() does not move conditionV11.fatigue', res.charge)
ok(C.injuryMoved, 'charge() does not move injChanceV54', res.charge)
ok(C.cutWritten, 'charge() did not write a lingering cut', res.charge)
ok(C.cutReachesSheet, 'the lingering cut does not reach effAttrsV85', res.charge)
ok(C.cutDecays, 'the lingering cut does not decay over its games countdown', res.charge)
ok(res.recovery.paidBack, 'a light week does not pay load back', res.recovery)

const X = res.focusVerdict
ok(X.exactlyOne, 'the focus moved more than one stat', res.focus)
ok(X.isTwentyPct, 'the focus is not a 1.2x on the sheet', res.focus)
ok(X.reachesSim, 'the focus does not reach what the sim reads', res.focus)
ok(X.buffForActive, 'buffFor() does not report the active pick', res.focus)
ok(res.biteVerdict.all, 'a focus does not reach the engine\'s attribute accessor', res.biteVerdict.dead)
ok(res.resolve && res.resolve.wear && res.resolve.wear.load !== undefined, 'the weekly resolver did not bill the body', res.resolve)
if (res.resolveErr) fails.push('the weekly resolver threw — ' + res.resolveErr)

const AR = res.arcVerdict || {}
ok(AR.ran !== false, 'the season arc did not run at all', res.arc)
if (res.arcErr) fails.push('a real week threw during the season arc — ' + res.arcErr)
ok(AR.loadClimbs, 'weeks at "everysnap" do not drive the load up', res.arc && res.arc.heavy)
ok(AR.injuryClimbs, 'weeks at "everysnap" do not raise the injury chance', res.arc && res.arc.heavy)
ok(AR.cutArrives, 'weeks at "everysnap" never produce a lingering stat cut', res.arc && res.arc.heavy)
ok(AR.ratingDrops, 'the lingering cut never reaches his effective rating', res.arc && res.arc.heavy)
ok(AR.dialBackPays, 'dialling back to "limited" does not pay the load off', res.arc && res.arc.light)
ok(AR.injuryEases, 'dialling back does not bring the injury chance down', res.arc && res.arc.light)

console.log(JSON.stringify({ identity, api: res.api, dial: res.dial, dialVerdict: res.dialVerdict, restCredit: res.restCredit,
  forecast: res.forecast, forecastVerdict: res.forecastVerdict, charge: res.charge, chargeVerdict: res.chargeVerdict,
  recovery: res.recovery, focus: res.focus, focusVerdict: res.focusVerdict, bite: res.bite, biteVerdict: res.biteVerdict, resolve: res.resolve,
  arc: res.arc, arcVerdict: res.arcVerdict,
  fails: fails.length, pageErrors: pageErrors.length }, null, 1))
if (fails.length) console.log('FAILURES:\n' + fails.join('\n'))
if (pageErrors.length) console.log('PAGE ERRORS:\n' + pageErrors.slice(0, 6).join('\n'))
console.log(fails.length || pageErrors.length ? 'v111A: FAIL' : 'v111A: PASS')
await browser.close()
process.exit(fails.length || pageErrors.length ? 1 : 0)
