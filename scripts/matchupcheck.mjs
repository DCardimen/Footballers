// Dev check: v171 THE MATCHUP CALL (07's v171 A block, 04's bracket, 11's page 5) + v171 B/C/D.
//   A — every opponent has a FACE (`__V171.identity`): a star and a weak link by name, a strong and a soft unit —
//   deterministic for the week, different across the schedule, on the preview's roster. The CALLS on page 5 come
//   from that face: the open set differs from week to week; SAY (coach trust + chemistry + Field General) opens
//   2 to 5 of them and runs them harder. In the engine, on paired games, "Load the Box" takes rushing yards off them,
//   "Send the House" blitzes more, "Take the Top Off" throws for more, "Shut Down" holds their star receiver; the
//   call lifts the units that run it and the plan's game rating lifts every teammate (`_mulV171`). A watched game
//   books its call (`callResV171`), the post-game card says so, and it pays exactly once. TU v171 0: no face, no
//   board, no lift. B — the specialization card is gone (TU v171Bspec 0 brings it back); the section bar stays ONE
//   bar even when a layer re-parents it. C — focus cards roll their own multiplier per week (some OFF, some HOT;
//   TU v171Cfocus 0 = ×1.2). D — the involvement rung is how hard he plays; aggression makes going hard pay more.
//   No page errors.  GAME_URL=http://localhost:5173/ node scripts/matchupcheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const open = async (tune, tag, w = 400, h = 860) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 540, hasTouch: true })
  await ctx.addInitScript((tune) => {
    window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, tune || {})
    try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off'); localStorage.setItem('rib.sprayHint.v170', '1') } catch {}
    setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80)
  }, tune || {})
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(tag + ': ' + (e.message || e)))
  await p.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
  await p.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V171 && !!window.__V170, null, { timeout: 40000 })
  await p.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  await p.waitForTimeout(600); await p.evaluate(() => document.getElementById('splash')?.remove())
  await p.evaluate(() => {
    const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; S.tree = S.tree || {}; A.setState(S)
    S.player = A.newPlayer(); const pl = S.player; pl.name = 'Test Man'; pl.pos = 'RB'; pl.age = 16; pl.originV11 = 'walk-on'; pl._wonShown = true; pl.level = 3
    for (const k in pl.attrs) pl.attrs[k] = 56; pl.training = 'balanced'; pl.coachTrust = 50; pl.seasonSeed = 4242; A.startSeasonGames()
    window.GridironStorage.save(S); window.go('hub')
  })
  await p.waitForTimeout(500)
  return { ctx, p }
}

// ---------------------------------------------------------------- A: the face, the board, the say
{
  const { ctx, p } = await open({}, 'main')
  const F = await p.evaluate(() => {
    const pl = window.S.player, W = pl.weekResults.filter((w) => !w.playoff)
    const ids = W.map((w) => { delete w.idV171; return window.__V171.identity(w) })
    const again = W.map((w) => { delete w.idV171; return JSON.stringify(window.__V171.identity(w)) })
    const pv = window.__previewMatchupV22(pl.pos)
    const opp = pv && pv.opp.players
    const sets = W.map((w) => window.__V171.offer(w).calls.filter((c) => !c.locked).map((c) => c.id).sort().join(','))
    return {
      n: ids.length, det: ids.every((I, i) => JSON.stringify(I) === again[i]),
      starPos: [...new Set(ids.map((I) => I.star.pos))], strong: [...new Set(ids.map((I) => I.strong.unit))],
      named: !!(opp && opp.some((x) => x.star && x.name === ids[0].star.name) && opp.some((x) => x.weak && x.name === ids[0].weak.name)),
      sets: [...new Set(sets)].length, shape: ids.every((I) => I.star.name && I.star.num && I.weak.name && I.strong.pct > 0 && I.soft.pct > 0 && I.strong.unit !== I.soft.unit)
    }
  })
  ok(F.det && F.shape, 'every week has a deterministic face: a named star and weak link, a strong and a different soft unit', F)
  ok(F.starPos.length >= 3 && F.strong.length >= 2, 'the faces differ across the schedule (star positions, strong units)', { star: F.starPos, strong: F.strong })
  ok(F.named, "the pregame preview's roster carries the star and the weak link by name")
  ok(F.sets >= 3, 'the open calls differ from week to week', { distinctSets: F.sets, weeks: F.n })

  const SAY = await p.evaluate(() => {
    const pl = window.S.player, w = pl.weekResults[0]
    const at = (trust, chem, fg) => { pl.coachTrust = trust; pl.worldState = Object.assign(pl.worldState || {}, { teamChemistry: chem }); window.S.tree.fieldGeneral = fg; const O = window.__V171.offer(w); return { say: O.say, n: O.calls.filter((c) => !c.locked).length, all: O.calls.length, str: O.str, locked: O.calls.filter((c) => c.locked).map((c) => c.id) } }
    const lo = at(30, 40, 0), mid = at(50, 50, 0), hi = at(95, 85, 1)
    // a locked call cannot be picked
    pl.coachTrust = 30; window.S.tree.fieldGeneral = 0; pl.worldState.teamChemistry = 40
    const lockedPick = lo.locked.length ? window.__V171.pick(lo.locked[0], w) : null
    pl.coachTrust = 50; pl.worldState.teamChemistry = 50
    return { lo, mid, hi, lockedPick }
  })
  ok(SAY.lo.n === 2 && SAY.hi.n >= Math.min(5, SAY.hi.all) && SAY.hi.n > SAY.lo.n, 'SAY opens the board: low trust shows 2 calls, high trust + chemistry + Field General opens up to 5', SAY)
  ok(SAY.hi.str > SAY.mid.str && SAY.mid.str > SAY.lo.str, 'more say runs the call harder (str)', [SAY.lo.str, SAY.mid.str, SAY.hi.str])
  ok(SAY.lockedPick === false, 'a locked call cannot be picked')

  // ---------------------------------------------------------- the engine: paired games, call vs no call
  const ENG = await p.evaluate(() => {
    const pl = window.S.player, W = pl.weekResults.filter((w) => !w.playoff)
    pl.coachTrust = 95; pl.worldState.teamChemistry = 85
    const run = (callId, metric, N) => {
      let a = 0, b = 0, n = 0, blitzA = 0, blitzB = 0, tries = 0
      while (n < N && tries < 400) {
        tries++; pl.seasonSeed = 9000 + tries * 131; const w = W[tries % W.length]; delete w.idV171
        const I = window.__V171.identity(w), c = window.__V171.calls.find((x) => x.id === callId); if (!(c.fit(I) > 0)) continue
        const looks = (g) => { const st = [...g.roster.opp.off].find((x) => x._starV171); const t = (st && st.stat) || {}; return (t.tgt != null ? t.tgt : t.rec_c || 0) }
        const game = (cid) => { w.callV171 = cid; const mu = window.__V171.ctx(w, pl, 0); window.__oppMulV22 = 1.04; window.__matchupV171 = mu; window.__V165D && (window.__V165D.blitzes = 0, window.__V165D.calls = 0); const g = window.__simGameV2(60, pl.pos); const bl = window.__V165D ? window.__V165D.blitzes : 0; window.__matchupV171 = null; window.__oppMulV22 = null; w.callV171 = null; return { m: metric === 'starLooks' ? looks(g) : window.__V171.metric(metric, g), bl, g } }
        const A1 = game(callId), B1 = game(null)
        a += A1.m; b += B1.m; blitzA += A1.bl; blitzB += B1.bl; n++
      }
      return { n, call: Math.round(a / n), none: Math.round(b / n), blitzCall: blitzA, blitzNone: blitzB }
    }
    return { box: run('box', 'oppRush', 10), blitz: run('blitz', 'pressure', 10), air: run('air', 'usPass', 10), shut: run('shut', 'starLooks', 14) }
  })
  ok(ENG.box.call < ENG.box.none, '"Load the Box" takes rushing yards off them (paired games)', ENG.box)
  ok(ENG.blitz.blitzCall > ENG.blitz.blitzNone * 1.5, '"Send the House" blitzes far more often', ENG.blitz)
  ok(ENG.air.call > ENG.air.none, '"Take the Top Off" throws for more', ENG.air)
  ok(ENG.shut.call < ENG.shut.none, '"Shut Down" takes looks away from their star receiver (targets, paired games)', ENG.shut)

  const LIFT = await p.evaluate(() => {
    const pl = window.S.player, w = pl.weekResults.find((x) => { delete x.idV171; const I = window.__V171.identity(x); return window.__V171.calls.find((c) => c.id === 'box').fit(I) > 0 })
    w.callV171 = 'box'; const mu = window.__V171.ctx(w, pl, 10); window.__oppMulV22 = 1.04; window.__matchupV171 = mu
    const g = window.__simGameV2(60, pl.pos); window.__matchupV171 = null; window.__oppMulV22 = null; w.callV171 = null
    const us = [...g.roster.us.off, ...g.roster.us.def], dl = us.filter((x) => x.pos === 'DL' || x.pos === 'LB'), ol = us.filter((x) => x.pos === 'OL')
    const star = [...g.roster.opp.off, ...g.roster.opp.def].find((x) => x._starV171)
    return { teamMul: mu.teamMul, edge: mu.K.edge, dl: dl.map((x) => x._mulV171), ol: ol.map((x) => x._mulV171), star: star && star._mulV171, starName: star && star.name, faceName: mu.I.star.name, res: g.callV171, box: g.boxV171 }
  })
  ok(Math.abs(LIFT.teamMul - 1.04) < 1e-9 && LIFT.ol.every((m) => Math.abs(m - 1.04) < 1e-6), "the plan's game rating lifts every teammate (+10 rating points → ×1.04)", { teamMul: LIFT.teamMul, ol: LIFT.ol.slice(0, 2) })
  ok(LIFT.edge > 0 && LIFT.dl.every((m) => Math.abs(m - 1.04 * (1 + LIFT.edge)) < 1e-6), 'the call lifts the units that run it (Load the Box → DL and LB)', { edge: LIFT.edge, dl: LIFT.dl.slice(0, 2) })
  ok(LIFT.starName === LIFT.faceName && LIFT.star > 1.1, 'their star is on the field by name, with his edge', { star: LIFT.starName, mul: LIFT.star })
  ok(LIFT.res && LIFT.res.id === 'box' && typeof LIFT.res.ok === 'boolean' && LIFT.res.thr > 0 && LIFT.box && LIFT.box.oppRush != null, 'the game judges the call against its line and keeps the box line', LIFT.res)

  // ---------------------------------------------------------- the page, the watched game, the bill
  await p.evaluate(() => { const pl = window.S.player; pl.coachTrust = 80; pl.worldState.teamChemistry = 70; window.go('season') })
  await p.waitForTimeout(400)
  await p.evaluate(() => { window.prepareWeek103(true) })
  await p.waitForTimeout(1200)
  await p.evaluate(() => { const P = window.__V112_D.PAGES.filter((x) => !x.when || x.when()); window.__V112_D.go(P.findIndex((x) => x.id === 'v112Page5')) })
  await p.waitForTimeout(900)
  const PG = await p.evaluate(() => {
    const b = document.getElementById('v171Board'), cards = [...document.querySelectorAll('#v171Board .v171-c:not(.locked):not(.coach)')]
    const tiles = [...document.querySelectorAll('.v146-tile')].map((t) => (t.querySelector('em') || {}).textContent || '')
    const face = b && b.querySelector('.v171-face'), say = b && b.querySelector('.v171-say')
    const first = cards[0] && cards[0].dataset.call
    if (cards[0]) cards[0].click()
    const w = window.S.player.weekResults.find((x) => !x.played)
    return { board: !!b, face: !!(face && /#\d+/.test(face.textContent)), say: !!say, cards: cards.length, goal: cards.every((c) => /WIN IF/.test(c.textContent) && /trust/.test(c.textContent)), first, picked: w.callV171, on: !!document.querySelector('#v171Board .v171-c.on[data-call="' + first + '"]'), tiles, tilePct: tiles.filter((t) => /%/.test(t)).length }
  })
  ok(PG.board && PG.face && PG.say && PG.cards >= 2 && PG.goal, "page 5 opens on the opponent's face, the say meter and the open calls, each with its line and its pay", PG)
  ok(PG.first && PG.picked === PG.first && PG.on, 'a tap on a call makes it the call', { first: PG.first, picked: PG.picked })
  ok(PG.tiles.length >= 3 && PG.tilePct === 0, "the plan tiles name each plan's own rating, not the engine's variance", PG.tiles)
  await p.evaluate(() => window.__v112SkipD())
  await p.waitForTimeout(2500)
  await p.evaluate(() => { try { window.skipLive() } catch (e) {} })
  await p.waitForFunction(() => !!document.getElementById('pgOverlayV13'), null, { timeout: 60000 }).catch(() => null)
  await p.waitForTimeout(800)
  const POST = await p.evaluate(() => { const o = document.getElementById('pgOverlayV13'); const l = o && o.querySelector('.call-line-v171'); return { overlay: !!o, line: l ? l.textContent.replace(/\s+/g, ' ').trim() : null, live: window.S._liveGame && window.S._liveGame.callV171 } })
  ok(POST.line && /MATCHUP CALL/.test(POST.line) && /(IT WORKED|IT BACKFIRED)/.test(POST.line), 'the post-game card says how the call went', POST.line)
  const BOOK = await p.evaluate(async () => {
    const pl = window.S.player, i = pl.currentWeek, w = pl.weekResults[i], t0 = pl.coachTrust
    try { window.__pgContinueV13() } catch (e) { return { err: e.message } }   // the post-game card's Continue books the week
    await new Promise((r) => setTimeout(r, 900))
    const R = w.callResV171, t1 = pl.coachTrust
    window.__V171.payRow(w, pl); const t2 = pl.coachTrust
    return { R, paid: R && R.paid, t0, t1, t2 }
  })
  const want = BOOK.R ? ({ 1: { ok: 2, no: -1 }, 2: { ok: 4, no: -2 }, 3: { ok: 7, no: -4 } })[BOOK.R.risk][BOOK.R.ok ? 'ok' : 'no'] : null
  ok(BOOK.R && BOOK.paid && BOOK.paid.trust === want, 'the watched game books the call and the week pays its risk-priced trust', BOOK)
  ok(BOOK.R && BOOK.t2 === BOOK.t1, 'and it pays exactly once', { t1: BOOK.t1, t2: BOOK.t2 })

  // ---------------------------------------------------------- C: the focus roll · D: how hard he plays
  const FOC = await p.evaluate(() => {
    const pl = window.S.player, W = pl.weekResults.filter((w) => !w.playoff), V = window.__V111
    const all = []; for (const pos of ['QB', 'RB', 'WR', 'DL', 'CB']) for (const w of W) all.push(...V.focusFor(pos, w))
    const muls = [...new Set(all.map((f) => f.mul))]
    const det = JSON.stringify(V.focusFor('RB', W[1])) === JSON.stringify(V.focusFor('RB', W[1]))
    return { n: all.length, distinct: muls.length, min: Math.min(...all.map((f) => f.mul)), max: Math.max(...all.map((f) => f.mul)), off: all.filter((f) => f.off).length, hot: all.filter((f) => f.tier === 'HOT').length, det }
  })
  ok(FOC.det && FOC.distinct >= 8 && FOC.max >= 1.35 && FOC.min < 1.15, 'C: each focus card rolls its own multiplier for the week (not ×1.2 every time)', FOC)
  ok(FOC.off >= 1, 'C: and sometimes the drill goes sideways onto a stat the position barely uses', { off: FOC.off, of: FOC.n })
  const HARD = await p.evaluate(() => {
    const pl = window.S.player, w = pl.weekResults.find((x) => !x.played), V = window.__V111
    const at = (use, agg) => { w.usageV111 = use; pl.personaV13 = { aggression: agg, confidence: 5 }; return V.intensity(pl, w) }
    const r = { safe: at('limited', 5), calm: at('everysnap', 1), mid: at('everysnap', 5), wild: at('everysnap', 10), normal: at('normal', 10) }
    w.usageV111 = 'everysnap'; pl.personaV13 = { aggression: 10 }
    const b = V.buffs(pl).filter((x) => x.v111 === 'intensity')
    w.usageV111 = 'normal'
    return { ...r, sees: b.length, str: (b.find((x) => x.stat === 'strength') || {}).mul, dis: (b.find((x) => x.stat === 'discipline') || {}).mul }
  })
  ok(HARD.safe.pct < 0 && HARD.normal.pct === 0 && HARD.mid.pct > 0, 'D: LIMITED plays it safe, NORMAL is his ordinary game, EVERY SNAP goes hard', { safe: HARD.safe.pct, normal: HARD.normal.pct, mid: HARD.mid.pct })
  ok(HARD.wild.pct > HARD.mid.pct && HARD.mid.pct > HARD.calm.pct, 'D: an aggressive man gets more out of going hard than a composed one', { calm: HARD.calm.pct, mid: HARD.mid.pct, wild: HARD.wild.pct })
  ok(HARD.sees >= 8 && HARD.str > 1 && HARD.dis < 1, 'D: the intensity reaches the engine (hard keys up, discipline down)', { n: HARD.sees, str: HARD.str, dis: HARD.dis })

  // ---------------------------------------------------------- B: no specialization · one section bar
  await p.evaluate(() => window.go('shop')); await p.waitForTimeout(1500)
  const SP = await p.evaluate(() => ({ card: !!document.querySelector('.specialization-card-v11'), spec: window.S.specializationV11 }))
  ok(!SP.card, 'B: the prestige specialization card is gone from the tree', SP)
  const BAR = await p.evaluate(async () => {
    const bar = document.querySelector('#screen > .secbar-v170'), sec = document.querySelector('#screen > .hubv75-sec')
    if (!bar || !sec) return { skip: true }
    sec.insertBefore(bar, sec.firstChild)   // what a re-parenting layer did to it
    await new Promise((r) => setTimeout(r, 1500))
    return { n: document.querySelectorAll('.secbar-v170').length, direct: document.querySelectorAll('#screen > .secbar-v170').length }
  })
  ok(BAR.skip || (BAR.n === 1 && BAR.direct === 1), 'B: a section bar carried into a section is replaced, never stacked (one bar)', BAR)
  await ctx.close()
}

// ---------------------------------------------------------------- the kill switches
{
  const { ctx, p } = await open({ v171: 0, v171Cfocus: 0, v171Dhard: 0, v171Bspec: 0 }, 'off')
  const OFF = await p.evaluate(() => {
    const pl = window.S.player, w = pl.weekResults[0]
    window.__oppMulV22 = 1.04; window.__matchupV171 = window.__V171.ctx(w, pl, 10)
    const g = window.__simGameV2(60, pl.pos); window.__matchupV171 = null; window.__oppMulV22 = null
    w.usageV111 = 'everysnap'; const I = window.__V111.intensity(pl, w); w.usageV111 = 'normal'
    return { id: window.__V171.identity(w), offer: window.__V171.offer(w), mul: [...g.roster.us.off, ...g.roster.opp.def].filter((x) => x._mulV171).length, call: g.callV171 || null, focus: [...new Set(window.__V111.focusFor('RB', w).map((f) => f.mul))], hard: I.pct }
  })
  ok(OFF.id === null && OFF.offer === null && OFF.mul === 0 && OFF.call === null, 'TU v171 0: no face, no board, no lift on any man', OFF)
  ok(OFF.focus.length === 1 && OFF.focus[0] === 1.2, 'TU v171Cfocus 0: every focus is ×1.2 again', OFF.focus)
  ok(OFF.hard === 0, 'TU v171Dhard 0: the rung no longer changes how hard he plays', OFF.hard)
  await p.evaluate(() => window.go('shop')); await p.waitForTimeout(1500)
  ok(await p.evaluate(() => !!document.querySelector('.specialization-card-v11')), 'TU v171Bspec 0: the specialization card is back')
  await ctx.close()
}

ok(errors.length === 0, 'no page errors', errors.slice(0, 4))
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
