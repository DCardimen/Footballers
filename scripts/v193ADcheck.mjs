// Dev check: v193 AD LEGENDS (src/07-career-app.js; one-line reads in src/17-pregame-wheel.js, src/18-growth-wheel.js).
//   a THE CATALOGUE — 24 Prestige Paths (the old five first), each with a name, icon, colour, tag, summary and a category;
//     all ten categories covered (performance, athletic, luck, card, career focus, variance, IQ, live game, attribute
//     boost, team); every path lists its effects with real numbers and every new one names a trade-off
//   b THE OLD FIVE, AUDITED — growth is a real multiplier (Grinder +25%, Phenom −8%, Magnate −4% on a seeded season);
//     Prodigy opens a locked v128 option; Ironman's injury chance is −21% (0.3 × the v153 B dial), +2 seasons, and a
//     season-ender costs him 4 games; Phenom +18 at the start; each path's branch is 25% cheaper
//   c THE NEW NINETEEN — each main effect moves its number, sampled from the reader with the path on vs off
//   d THE UNLOCKS — a fresh save: none unlocked, the Path closed, choosePath refuses a locked legend, the screen shows
//     every locked card greyed with "Play 3 seasons — 0/3" and a bar; a real season end (finishSeasonGames) counts a
//     season; the third unlocks The Natural with the NEW LEGEND UNLOCKED pop-up and ribHaptic('success'); choosing it
//     works; medals 12 open Phenom + Grinder (the v156 A gate, kept)
//   e OLD SAVES — a save past the old 12-medal gate keeps the old five, a save with a path keeps it; history counts
//   f THE KILL SWITCH — TU v193AD 0: the old five, the old medal gate, a new legend in the save sleeps
//   g 360 PX — no horizontal overflow on the screen or a card; screenshots at 360 and 1280
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v193ADcheck.mjs [--shots <dir>]
import fs from 'node:fs'
import { gameUrl, launch } from './lib/env.mjs'
const argv = process.argv.slice(2)
const SHOTS = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const ctx = await browser.newContext({ viewport: { width: 400, height: 860 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
await page.addInitScript(() => { setInterval(() => { try { document.querySelectorAll('.onboard,#growthV42,#gv139gate').forEach((e) => e.remove()) } catch {} }, 60) })
const U = gameUrl('index.html') + (gameUrl('index.html').includes('?') ? '&' : '?') + 'stayStale&noFilmV114'
const boot = async () => {
  await page.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V193AD && !!window.__V156A && !!window.__GROWTH_V42 && !!window.__PREGAME_V51, null, { timeout: 40000 })
  await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  await page.evaluate(() => document.getElementById('splash')?.remove())
  await page.waitForTimeout(300)
}
const M = (fn, arg) => page.evaluate(fn, arg)
await page.goto(U, { waitUntil: 'domcontentloaded' })
await M(() => { localStorage.clear(); localStorage.setItem('rib.coachTour.v119', 'off') })
await boot()

// a seeded Math.random, a fresh account with one player, helpers — installed in the page
await M(() => {
  const R0 = Math.random
  window.__seedAD = (seed) => { let s = (seed >>> 0) || 1; Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 } }
  window.__unseedAD = () => { Math.random = R0 }
  window.__setupAD = (o) => {
    o = o || {}
    const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S); S.tree = {}
    window.RIB_TUNE = window.RIB_TUNE || {}; delete window.RIB_TUNE.v193AD
    const p = A.newPlayer(); p.pos = o.pos || 'RB'; p.name = 'Legend Tester'; p.level = o.level != null ? o.level : 3; p.training = 'balanced'
    for (const k in p.attrs) p.attrs[k] = o.attr || 30
    p.potential = 1; p.totalSeasons = o.seasons != null ? o.seasons : 2; p.seasonsSinceStart = 2; p.age = 15
    p.personaFxV20 = null; p.seasonMod = null; p.traits = []; p.coachTrust = 55 /* the same man every run: no persona swing, no season mod, no trait */
    S.player = p; S.view = 'hub'
    return true
  }
  window.__withPathAD = (k, fn) => { const S = window.__GRIDIRON_AUDIT__.getState(), was = S.path; S.path = k; try { return fn() } finally { S.path = was } }
})

// ============================== a. the catalogue ==============================
{
  const r = await M(() => {
    const V = window.__V193AD, keys = V.keys(), cats = V.cats()
    return {
      keys, n: keys.length, old: V.old, first5: keys.slice(0, 5),
      fields: keys.filter((k) => { const P = V.path(k); return !(P && P.name && P.icon && P.color && P.tag && P.desc) }),
      catOf: Object.fromEntries(keys.map((k) => [k, V.cat(k)])), catNames: Object.keys(cats),
      lines: Object.fromEntries(keys.map((k) => [k, V.lines(k)])),
      unlocks: V.unlocks(),
      art: Object.fromEntries(keys.map((k) => [k, window.__V193Y ? window.__V193Y.concept(V.path(k).icon) : 'no __V193Y'])),
      catArt: Object.values(cats).map((c) => (window.__V193Y ? window.__V193Y.concept(c.icon) : null))
    }
  })
  ok(Object.values(r.art).every((c) => c && c !== 'no __V193Y') && r.catArt.every(Boolean), 'every legend icon (and every category icon) is drawn by the v193 Y art (a mapped concept)', r.art)
  ok(r.n === 24, 'there are 24 Prestige Paths', r.n)
  ok(JSON.stringify(r.first5) === JSON.stringify(['phenom', 'grinder', 'prodigy', 'magnate', 'ironman']), 'the old five come first, in their order', r.first5)
  ok(r.fields.length === 0, 'every path has a name, icon, colour, tag and summary', r.fields)
  const need = ['performance', 'athletic', 'luck', 'card', 'focus', 'variance', 'iq', 'live', 'attr', 'team']
  const per = {}; Object.values(r.catOf).forEach((c) => (per[c] = (per[c] || 0) + 1))
  ok(need.every((c) => per[c] >= 2), 'all ten categories are covered, at least two legends each', per)
  const newKeys = r.keys.filter((k) => !r.old.includes(k))
  ok(newKeys.length === 19, '19 new legends', newKeys.length)
  const thin = r.keys.filter((k) => !(r.lines[k].up.length >= 1 && r.lines[k].up.concat(r.lines[k].down).every((x) => /\d|never|No boom|open|×/.test(x))))
  ok(thin.length === 0, 'every legend lists its effects, each with a real number', thin)
  const noTrade = r.keys.filter((k) => !r.lines[k].down.length)
  ok(noTrade.length === 0, 'every legend (the old five included) names a trade-off', noTrade)
  ok(r.keys.every((k) => r.unlocks[k] && r.unlocks[k][1] > 0), 'every legend has an unlock milestone', r.keys.filter((k) => !r.unlocks[k]))
  const L = r.lines
  ok(L.ironman.up.some((x) => /−21% injury chance/.test(x)) && L.cardshark.up.some((x) => /×2 as likely/.test(x)) && L.cardshark.down.some((x) => /×0\.5/.test(x)) && L.grinder.up.some((x) => /\+20% attribute growth/.test(x)) && L.phenom.down.some((x) => /−8% attribute growth/.test(x)) && L.phenom.up.some((x) => /\+10 to every starting attribute/.test(x)),
    'the numbers come from the keys: Ironman −21% injury, Card Shark ×2 rare cards / ×0.5 gear, Grinder +20%, Phenom +10 / −8%', { iron: L.ironman.up, shark: L.cardshark })
}

// ============================== b. the old five, audited ==============================
{
  const r = await M(() => {
    const A = window.__GRIDIRON_AUDIT__, V = window.__V193AD, out = {}
    window.__setupAD({ level: 1, attr: 10 })
    const S = A.getState(); S.tree = { freak: 3 } /* a ceiling well above him: the growth is not damped */
    const base = JSON.parse(JSON.stringify(S.player))
    // a seeded season, the same dice, path by path: the real growth (whole points + the banked fraction)
    const season = (k) => window.__withPathAD(k, () => {
      const p = JSON.parse(JSON.stringify(base)); p.weekResults = null; p.playoffState = null; p.growthBank = {}; S.player = p
      window.__seedAD(4242); let t; try { t = A.simSeason(p) } finally { window.__unseedAD() }
      return Math.round((Object.values(t.gains || {}).reduce((a, b) => a + b, 0) + Object.values(p.growthBank || {}).reduce((a, b) => a + b, 0)) * 1000) / 1000
    })
    out.g = { none: season(null), grinder: season('grinder'), phenom: season('phenom'), magnate: season('magnate') }
    window.RIB_TUNE.v193AD = 0; out.gOff = { none: season(null), grinder: season('grinder'), phenom: season('phenom') }; delete window.RIB_TUNE.v193AD
    S.player = JSON.parse(JSON.stringify(base))
    // Prodigy: a v128 option locked behind Grit 99
    const eff = { perf: 10, reqAttr: 'grit', reqBase: 99 }
    out.lockNone = V.probe.lock(eff).ok; out.lockProd = window.__withPathAD('prodigy', () => V.probe.lock(eff).ok)
    window.RIB_TUNE.v193AD = 0; out.lockOff = window.__withPathAD('prodigy', () => V.probe.lock(eff).ok); delete window.RIB_TUNE.v193AD
    // Ironman: the injury dial, the seasons, the season-ender
    out.injNone = V.probe.injMul(); out.injIron = window.__withPathAD('ironman', () => V.probe.injMul())
    window.RIB_TUNE.v193AD = 0; out.injIronOff = window.__withPathAD('ironman', () => V.probe.injMul()); delete window.RIB_TUNE.v193AD
    // Prodigy's advance odds (a mid-range roll, no rank floor at another level)
    const adv = () => A.advanceChance(50, 3, 'RB', 55, 1)
    out.advNone = adv(); out.advProd = window.__withPathAD('prodigy', adv)
    window.RIB_TUNE.v193AD = 0; out.advProdOff = window.__withPathAD('prodigy', adv); delete window.RIB_TUNE.v193AD
    out.maxNone = V.probe.maxSeasons(); out.maxIron = window.__withPathAD('ironman', () => V.probe.maxSeasons())
    const ender = (k) => window.__withPathAD(k, () => {
      const p = S.player; p.conditionV11 = p.conditionV11 || {}; p.conditionV11.injury = null; p._trainerRoomUsedV134 = true
      window.__forceSeasonEnderV134 = true; const wk = { injured: true, week: 3, opp: 'X' }
      try { A.materializeInjuryV134(p, wk) } finally { window.__forceSeasonEnderV134 = false }
      const j = p.conditionV11.injury; p.conditionV11.injury = null
      return j ? { ender: !!j.seasonEnding, wk: j.weeksRemaining } : null
    })
    out.enderNone = ender(null); out.enderIron = ender('ironman')
    // Phenom's start, seeded
    const start = (k) => window.__withPathAD(k, () => { window.__seedAD(77); try { const p = A.newPlayer(); return A.ATTRS.reduce((a, x) => a + p.attrs[x], 0) / A.ATTRS.length } finally { window.__unseedAD() } })
    out.startNone = start(null); out.startPhenom = start('phenom')
    window.RIB_TUNE.v193AD = 0; out.startPhenomOff = start('phenom'); delete window.RIB_TUNE.v193AD
    // each path's cheaper branch
    const N = A.TREE_NODES, first = (b) => Object.keys(N).find((k) => N[k].branch === b)
    out.cheap = ['phenom', 'grinder', 'prodigy', 'magnate', 'ironman'].map((k) => { const P = V.path(k), nk = first(P.cheapBranch); return { k, b: P.cheapBranch, off: V.probe.cost(nk), on: window.__withPathAD(k, () => V.probe.cost(nk)) } })
    out.ceilNone = V.probe.ceil(); out.ceilPhenom = window.__withPathAD('phenom', () => V.probe.ceil())
    return out
  })
  const g = r.g
  ok(g.none > 5 && Math.abs(g.grinder / g.none - 1.2) < 0.03, 'Grinder: a seeded season grows +20% (it was ~+4%: capped at 1.18, then ×0.22)', g)
  ok(Math.abs(g.phenom / g.none - 0.92) < 0.03 && Math.abs(g.magnate / g.none - 0.96) < 0.03, 'Phenom (−8%) and Magnate (−4%) really grow slower (the old term was floored at 0)', g)
  ok(r.gOff.phenom === r.gOff.none && r.gOff.grinder > r.gOff.none && r.gOff.grinder / r.gOff.none < 1.08, 'the kill switch keeps the old growth (Phenom = none, Grinder ~+4%)', r.gOff)
  ok(!r.lockNone && r.lockProd && !r.lockOff, 'Prodigy opens a v128 option locked behind an attribute (off: locked)', { none: r.lockNone, prodigy: r.lockProd, off: r.lockOff })
  ok(Math.abs(r.injIron / r.injNone - 0.79) < 0.005 && Math.abs(r.injIronOff - 0.865) < 0.005, 'Ironman: −21% injury chance, as the card says (off: pathCap floored it to −13.5%)', { none: r.injNone, iron: r.injIron, off: r.injIronOff })
  ok(r.maxIron - r.maxNone === 2, 'Ironman: +2 seasons allowed at the level', { none: r.maxNone, iron: r.maxIron })
  ok(r.enderNone && r.enderNone.ender && r.enderIron && !r.enderIron.ender && r.enderIron.wk === 4, 'Ironman: a forced season-ender costs 4 games, not the season', { none: r.enderNone, iron: r.enderIron })
  ok(Math.abs(r.startPhenom - r.startNone - 10) < 1 && Math.abs(r.startPhenomOff - r.startNone - 6) < 1, 'Phenom: +10 to every starting attribute (seeded; off: the card said +18, pathCap paid +6)', { none: r.startNone, phenom: r.startPhenom, off: r.startPhenomOff })
  ok(Math.abs(r.advProd - r.advNone - 5) < 0.6 && r.advProdOff === r.advProd, 'Prodigy: +5% advance odds, as the card says now (it said +8; pathCap paid 5)', { none: r.advNone, on: r.advProd, off: r.advProdOff })
  ok(r.cheap.every((c) => Math.abs(c.on - Math.max(1, Math.round(c.off * 0.75))) <= 1 && c.on < c.off), "each old path's branch is 25% cheaper", r.cheap)
  ok(r.ceilPhenom - r.ceilNone > 25, 'Phenom: a higher potential ceiling (+27)', { none: r.ceilNone, phenom: r.ceilPhenom })
}

// ============================== c. the new nineteen ==============================
{
  const r = await M(() => {
    const A = window.__GRIDIRON_AUDIT__, V = window.__V193AD, P = V.probe, G = window.__GROWTH_V42, W = window.__PREGAME_V51, out = {}
    window.__setupAD({ level: 4, attr: 45 })
    const S = A.getState(), p = S.player, W_ = (k, fn) => window.__withPathAD(k, fn)
    const sample = (k, opts, n) => W_(k, () => { window.__seedAD(9001); try { const a = []; for (let i = 0; i < (n || 250); i++) { p.coachTrust = 30; a.push(P.perf(p, opts).perf) }; return a } finally { window.__unseedAD() } })
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length, sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))) }
    const reg0 = sample(null, {}), po0 = sample(null, { playoff: true })
    out.closer = { reg: mean(sample('closer', {})) - mean(reg0), po: mean(sample('closer', { playoff: true })) - mean(po0) }
    out.natural = mean(sample('natural', {})) - mean(reg0)
    out.var = { none: sd(reg0), wild: sd(sample('wildcard', {})), metro: sd(sample('metronome', {})) }
    const start = (k) => W_(k, () => { window.__seedAD(31); try { return A.newPlayer().attrs } finally { window.__unseedAD() } })
    const s0 = start(null), sf = start('freak'), sg = start('fieldgeneral'), so = start('oracle'), sl = start('lucky')
    out.freak = { speed: sf.speed - s0.speed, aware: sf.awareness - s0.awareness }
    out.fg = { speed: sg.speed - s0.speed }
    out.oracle = { aware: so.awareness - s0.awareness, vision: so.vision - s0.vision }
    out.lucky = { start: sl.catching - s0.catching }
    out.engine = { none: P.fatigue(p), on: W_('engine', () => P.fatigue(p)) }
    // the growth wheel's "it pays" odds, the same dice
    const wheel = (k) => W_(k, () => { let s = 5; const rand = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }; const opt = G.genOptions(p, rand, 5)[0]; return G.rollOutcome(p, opt, rand, 'season').odds.g })
    out.lucky.g = { none: wheel(null), on: wheel('lucky') }
    // the scouts at College, a low potential: the GM's second look
    p.level = 5; out.longshot = { none: P.scout(p).sl, on: W_('longshot', () => P.scout(p).sl) }
    out.longshotAdv = { none: A.advanceChance(60, 3, 'RB', 60, 1), on: W_('longshot', () => A.advanceChance(60, 3, 'RB', 60, 1)) }
    p.level = 4
    // the deck and the gear
    out.flip = { none: P.flipOdds().rare, shark: W_('cardshark', () => P.flipOdds().rare), pct0: P.flipPct(), pctShark: W_('cardshark', () => P.flipPct()), pctColl: W_('collector', () => P.flipPct()) }
    const gear = (k) => W_(k, () => { window.__seedAD(555); try { let rare = 0; for (let i = 0; i < 1500; i++) P.gear() !== 'common' && rare++; return rare / 1500 } finally { window.__unseedAD() } })
    out.gear = { none: gear(null), shark: gear('cardshark'), coll: gear('collector') }
    out.focus = { none: P.tilt(-6), zealot: W_('zealot', () => P.tilt(-6)), zealotUp: W_('zealot', () => P.tilt(6)), monkDown: W_('monk', () => P.tilt(-6)), monkUp: W_('monk', () => P.tilt(6)) }
    // the game plan's click odds, the same dice
    const plans = [{ id: 'disciplined', name: 'Disciplined Execution', icon: '', rec: true, scout: true, up: 40, ctrl: 75, risk: 30 }, { id: 'explosive', name: 'Chase the Highlight', icon: '', rec: false, scout: false, up: 85, ctrl: 30, risk: 70 }]
    const click = (k) => W_(k, () => { window.__seedAD(8); try { const d = W.decidePlan(p, plans, 'disciplined', { nz: 0.5, rr: 0.5, am: 0.5 }); return d ? d.odds.g : null } finally { window.__unseedAD() } })
    out.fg.click = { none: click(null), on: click('fieldgeneral') }
    p.coachTrust = 60; out.fg.say = { none: P.say(p), on: W_('fieldgeneral', () => P.say(p)) }
    const fk = P.fateKeys()[0]
    out.oracle.fate = { none: P.fate(fk), on: W_('oracle', () => P.fate(fk)) }
    out.oracle.xp = W_('oracle', () => P.xp())
    // the paycheck, a watched and a simmed game
    A.startSeasonGames(); const w = p.weekResults[0]; w.played = true; w.perf = 70; w.won = true; w.us = 21; w.them = 10
    const pay = (k, watched) => W_(k, () => P.pay(p, w, watched).raw)
    out.pay = { w0: pay(null, true), s0: pay(null, false), wShow: pay('showman', true), sShow: pay('showman', false), wExec: pay('executive', true), sExec: pay('executive', false) }
    p.weekResults.forEach((x) => { x.played = true; x.liveBookedV85 = false })
    out.xpCut = { none: P.watch(p).mult, exec: W_('executive', () => P.watch(p).mult) }
    p.weekResults = null
    // the team
    out.team = { none: P.team(p), cap: W_('captain', () => P.team(p)), merc: W_('mercenary', () => P.team(p)), liftCap: W_('captain', () => P.teamLift()), liftMerc: W_('mercenary', () => P.teamLift()) }
    // the Specialist: a seeded season, key vs other attributes
    const keys = (() => { const Wt = A.POSITIONS[p.pos].w; return Object.keys(Wt).sort((a, b) => Wt[b] - Wt[a]).slice(0, 3) })()
    p.level = 1; for (const x in p.attrs) p.attrs[x] = 10; S.tree = { freak: 3 }; const base = JSON.parse(JSON.stringify(p))
    const grow = (k) => W_(k, () => { const q = JSON.parse(JSON.stringify(base)); q.weekResults = null; q.playoffState = null; q.growthBank = {}; S.player = q; window.__seedAD(1234); let t; try { t = A.simSeason(q) } finally { window.__unseedAD() } const g = {}; A.ATTRS.forEach((x) => (g[x] = ((t.gains || {})[x] || 0) + ((q.growthBank || {})[x] || 0))); return { key: +keys.reduce((a, x) => a + g[x], 0).toFixed(3), other: +A.ATTRS.filter((x) => !keys.includes(x)).reduce((a, x) => a + g[x], 0).toFixed(3) } })
    out.spec = { none: grow(null), on: grow('specialist') }
    out.specMul = { key: W_('specialist', () => V.growth(base, keys[0])), other: W_('specialist', () => V.growth(base, 'discipline')) }
    S.player = base
    return out
  })
  ok(Math.abs(r.closer.po - 8) < 0.6 && Math.abs(r.closer.reg + 3) < 0.6, 'The Closer: + in playoff games, − in the regular season', r.closer)
  ok(Math.abs(r.natural - 5) < 0.6, 'The Natural: + to every game rating', r.natural)
  ok(r.var.wild > r.var.none * 1.25 && r.var.metro < r.var.none * 0.8, 'The Wildcard swings wider, The Metronome narrower (game-rating spread)', r.var)
  ok(r.freak.speed >= 8 && r.freak.aware <= -4, 'The Freak: +10 physical / −8 mental at the start', r.freak)
  ok(r.engine.on < r.engine.none * 0.75 && r.engine.on > 0, 'The Engine: less fatigue from a game (×0.6 of the wear)', r.engine)
  ok(r.lucky.g.on - r.lucky.g.none > 0.08 && r.lucky.start <= -3, 'The Lucky Charm: +10% "it pays" on the growth wheel, −4 at the start', r.lucky)
  ok(r.longshot.none === 0 && r.longshot.on >= 0.3 && r.longshotAdv.on < r.longshotAdv.none, 'The Long Shot: the GM looks again far below the bar (0 → 30%+), the season roll is harder', { sl: r.longshot, adv: r.longshotAdv })
  ok(Math.abs(r.flip.shark / r.flip.none - 2) < 1e-6 && Math.abs(r.flip.pctShark / r.flip.pct0 - 1.25) < 1e-6 && Math.abs(r.flip.pctColl / r.flip.pct0 - 0.6) < 1e-6, 'The Card Shark: rare cards ×2, card % ×1.25; The Collector: card % ×0.6', r.flip)
  ok(r.gear.shark < r.gear.none * 0.8 && r.gear.coll > r.gear.none * 1.15, 'gear drops: The Card Shark rarer pieces less often, The Collector more often (1,500 seeded rolls)', r.gear)
  ok(Math.abs(r.focus.zealot - 2 * r.focus.none) < 1e-9 && r.focus.zealotUp > 0.2 && r.focus.monkDown === 0 && Math.abs(r.focus.monkUp - 0.06) < 1e-9, 'The Zealot doubles the focus tilt both ways; The Monk ignores a bad roll, halves a good one', r.focus)
  ok(r.fg.click.on - r.fg.click.none > 0.08 && r.fg.say.on - r.fg.say.none > 0.15 && r.fg.speed <= -5, 'The Field General: game plans click more, more say, −6 physical start', r.fg)
  ok(Math.abs(r.oracle.fate.on - r.oracle.fate.none - 0.2) < 0.01 && r.oracle.xp === 0.85 && r.oracle.aware >= 6, 'The Oracle: +20% training fate odds, +8 mind at the start, Legacy XP ×0.85', r.oracle)
  ok(Math.abs(r.pay.wShow / r.pay.w0 - 1.5) < 0.01 && Math.abs(r.pay.sShow / r.pay.s0 - 0.6) < 0.01, 'The Showman: a watched game pays ×1.5, a simmed one ×0.6', r.pay)
  ok(Math.abs(r.pay.sExec / r.pay.s0 - 1.5) < 0.01 && Math.abs(r.pay.wExec / r.pay.w0 - 0.75) < 0.01 && r.xpCut.none < 1 && r.xpCut.exec === 1, 'The Executive: a simmed game pays ×1.5 and costs no Legacy XP, a watched one ×0.75', { pay: r.pay, xp: r.xpCut })
  ok(r.team.cap > r.team.none && r.team.merc < r.team.none && r.team.liftCap === 8 && r.team.liftMerc === -6, 'The Captain lifts the team OVR (+8%), The Mercenary lowers it (−6%)', r.team)
  ok(r.spec.on.key > r.spec.none.key && r.spec.on.other < r.spec.none.other && r.specMul.key === 1.35 && r.specMul.other === 0.75, 'The Specialist: the three key attributes grow more, the rest less (seeded season)', { spec: r.spec, mul: r.specMul })
}

// ============================== d. the unlocks ==============================
await M(() => { window.__hapticsAD = []; const H = window.ribHaptic; window.ribHaptic = (k) => { window.__hapticsAD.push(k); try { H && H(k) } catch (e) {} } })
{
  const r = await M(() => {
    const A = window.__GRIDIRON_AUDIT__, V = window.__V193AD, V6 = window.__V156A, out = {}
    window.__setupAD({ level: 1, attr: 20, seasons: 0 }); const S = A.getState()
    V6.seed(1)
    out.unlocked0 = V.keys().filter((k) => V.unlocked(k)); out.open0 = V6.pathOpen()
    window.choosePath('phenom'); out.refused = S.path == null
    window.go('path')
    const cards = [...document.querySelectorAll('#screen .legend-card-v193ad')]
    out.cards = cards.length; out.locked = cards.filter((c) => c.classList.contains('locked')).length
    const nat = document.querySelector('#screen .legend-card-v193ad[data-path="natural"]')
    out.natTxt = nat ? nat.querySelector('.lg-lock')?.textContent.replace(/\s+/g, ' ').trim() : null
    out.natBar = !!(nat && nat.querySelector('.lg-bar i'))
    out.greyed = nat ? getComputedStyle(nat.querySelector('.lg-head')).opacity : null
    out.clickable = document.querySelectorAll('#screen .pos-card[onclick^="choosePath"]').length
    out.stats0 = JSON.parse(JSON.stringify(V.stats()))
    return out
  })
  ok(r.unlocked0.length === 0 && !r.open0, 'a fresh save: no legend unlocked, the Path closed', r.unlocked0)
  ok(r.refused, 'choosePath refuses a locked legend')
  ok(r.cards === 24 && r.locked === 24 && r.clickable === 0, 'the screen shows all 24, every one locked and greyed (no choosePath on a locked card)', { cards: r.cards, locked: r.locked, greyed: r.greyed })
  ok(/Play 3 seasons — 0\/3/.test(r.natTxt || '') && r.natBar && +r.greyed < 1, 'a locked card says its milestone and progress ("Play 3 seasons — 0/3") over a bar', r.natTxt)
}
{
  // a real season end counts; the third unlocks The Natural
  const r = await M(async () => {
    const A = window.__GRIDIRON_AUDIT__, V = window.__V193AD, S = A.getState(), p = S.player, out = {}
    const C = V.stats(); C.seasons = 2; out.games0 = C.games
    A.startSeasonGames(); A.ensurePlayoffs(p)
    p.weekResults.forEach((w, i) => { w.played = true; w.perf = 70; w.won = i % 2 === 0; w.us = 20; w.them = 14; w.liveBookedV85 = i < 2 })
    p.playoffState = { qualified: false, round: 0, alive: false, done: true, champion: false }
    const n = p.weekResults.filter((w) => w.played && !w.satOut).length
    window.__hapticsAD.length = 0
    try { window.finishSeasonGames() } catch (e) { out.err = String(e) }
    await new Promise((r) => setTimeout(r, 300))
    out.seasons = V.stats().seasons; out.games = V.stats().games; out.watched = V.stats().watched; out.n = n
    out.natural = V.unlocked('natural'); out.pop = document.getElementById('legendPopV193AD')?.textContent.replace(/\s+/g, ' ') || ''
    out.haptic = window.__hapticsAD.slice(); out.popped = V.popped.map((x) => x.join(','))
    out.toast = document.getElementById('toast')?.textContent || ''
    window.go('path')
    const nat = document.querySelector('#screen .legend-card-v193ad[data-path="natural"]')
    out.natLocked = nat ? nat.classList.contains('locked') : null; out.natNew = !!(nat && nat.querySelector('.lg-badge.new'))
    out.sum = document.querySelector('#screen .legend-sum-v193ad')?.textContent.replace(/\s+/g, ' ') || ''
    nat && nat.click()
    await new Promise((r) => setTimeout(r, 200))
    out.dlg = !!(window.ribDialog && window.ribDialog.isOpen)
    return out
  })
  ok(!r.err && r.seasons === 3 && r.games === r.games0 + r.n && r.watched === 2, 'finishSeasonGames counts the season, its games and the watched ones', r)
  ok(r.natural && /NEW LEGEND UNLOCKED/.test(r.pop) && /The Natural/.test(r.pop) && r.haptic.includes('success'), "the third season unlocks The Natural: the NEW LEGEND UNLOCKED pop-up and ribHaptic('success')", { pop: r.pop, haptic: r.haptic })
  ok(r.natLocked === false && r.natNew && /1 of 24/.test(r.sum), 'the card opens with a NEW badge; the count reads 1 of 24', { sum: r.sum })
  if (r.dlg) { await page.click('#ribDlgV149 button:last-child').catch(() => null); await page.waitForTimeout(200) }
  const chosen = await M(() => { const S = window.__GRIDIRON_AUDIT__.getState(); if (S.path !== 'natural' && !(window.ribDialog && window.ribDialog.isOpen)) { window.RIB_TUNE.v192Bconfirm = 0; window.choosePath('natural'); delete window.RIB_TUNE.v192Bconfirm } return S.path })
  ok(chosen === 'natural', 'an unlocked legend is chosen', chosen)
  const m = await M(() => {
    const A = window.__GRIDIRON_AUDIT__, V = window.__V193AD, V6 = window.__V156A, S = A.getState()
    S.pp = 1000
    V6.seed(11); const at11 = ['phenom', 'grinder'].map((k) => V.unlocked(k))
    V6.seed(12); const at12 = ['phenom', 'grinder'].map((k) => V.unlocked(k))
    window.RIB_TUNE.v192Bconfirm = 0; window.choosePath('phenom'); const sw = { path: S.path, pp: S.pp }; window.choosePath('prodigy'); const lockedSwitch = S.path; delete window.RIB_TUNE.v192Bconfirm
    window.go('shop'); const dock = document.getElementById('dock')?.textContent.replace(/\s+/g, ' ') || ''
    return { at11, at12, sw, lockedSwitch, dock }
  })
  ok(!m.at11.some(Boolean) && m.at12.every(Boolean), '12 medals open Phenom and Grinder (the v156 A gate, kept as their milestone)', m)
  ok(m.sw.path === 'phenom' && m.sw.pp === 750 && m.lockedSwitch === 'phenom', 'the switch cost holds (25% of 1,000 PP); a switch to a locked legend is refused', m)
  ok(/The Phenom · \d+\/24/.test(m.dock), "the tree's dock button names the legend and the unlocked count", m.dock)
}

// ============================== e. old saves ==============================
{
  const save = async (o) => {
    await M((o) => {
      const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true
      S.player = null; S.view = 'menu'; S.path = o.path || null
      S.legacyV152 = { v: 1, xp: 0, boot: 1, got: {}, log: [], ms: 0 }
      if (o.floor) S.honorsV156A = { old: 40, rep: 0, floor: o.floor, at: 1 }
      if (o.hof) S.hof = o.hof
      if (o.careers) S.careersCompleted = o.careers
      window.GridironStorage.save(S)
    }, o)
    await boot()
    return M(() => { const V = window.__V193AD, S = window.__GRIDIRON_AUDIT__.getState(); return { unlocked: V.keys().filter((k) => V.unlocked(k)), rec: S.pathUnlocksV193AD, stats: S.pathStatsV193AD, path: S.path } })
  }
  const a = await save({ floor: 200, path: 'magnate', hof: Array.from({ length: 6 }, (_, i) => ({ name: 'Old ' + i, seasons: 12, reached: 4, titles: 1, goat: 10 })), careers: 6 })
  const old5 = ['phenom', 'grinder', 'prodigy', 'magnate', 'ironman']
  ok(old5.every((k) => a.unlocked.includes(k)) && old5.every((k) => a.rec && a.rec[k] && a.rec[k].how === 'kept') && a.path === 'magnate', 'a save past the old medal gate keeps the old five and its path', { rec: a.rec })
  ok(a.stats && a.stats.seasons === 72 && a.unlocked.includes('natural') && a.unlocked.includes('executive') && a.unlocked.includes('metronome'), 'its history counts: 72 seasons from the Hall, 6 careers — The Natural, The Executive, The Metronome open', { stats: a.stats, unlocked: a.unlocked })
  const b = await save({ path: 'ironman' })
  ok(b.unlocked.includes('ironman') && b.rec.ironman && b.unlocked.length === 1, 'a save with a path below the gate keeps that path (and only it)', b.unlocked)
  // the kill switch on the same save
  const off = await M(() => {
    const V = window.__V193AD, V6 = window.__V156A, S = window.__GRIDIRON_AUDIT__.getState()
    window.RIB_TUNE.v193AD = 0
    const out = { open1: V6.pathOpen() }
    V6.seed(12); out.open12 = V6.pathOpen()
    S.path = 'captain'; out.sleep = window.__GRIDIRON_AUDIT__.pathVal('teamLift', 0)
    S.path = null; window.go('path')
    out.cards = document.querySelectorAll('#screen .pos-card').length; out.newCards = document.querySelectorAll('#screen .legend-card-v193ad').length
    out.oldDesc = /durability never limits you/.test(document.getElementById('screen').textContent)
    delete window.RIB_TUNE.v193AD
    return out
  })
  ok(!off.open1 && off.open12 && off.sleep === 0 && off.cards === 5 && off.newCards === 0 && off.oldDesc, 'TU v193AD 0: the old five and the 12-medal gate; a new legend in the save sleeps', off)
}

// ============================== g. 360 px ==============================
{
  await M(() => {
    const A = window.__GRIDIRON_AUDIT__, V = window.__V193AD, S = A.getState()
    S.path = 'phenom'; const C = V.stats(); C.seasons = 20; C.watched = 30; C.focus = 20; C.games = 180
    window.__V156A.seed(30); S.careersCompleted = 2; S.titlesWon = 2; S.bestLevel = 4
    V.check(true); window.go('path')
  })
  for (const [w, name] of [[360, 'legends360.png'], [1280, 'legends1280.png']]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.waitForTimeout(250)
    const o = await M(() => {
      const de = document.scrollingElement || document.documentElement, W = de.clientWidth
      const cards = [...document.querySelectorAll('#screen .legend-card-v193ad')]
      const wide = cards.filter((c) => c.scrollWidth > c.clientWidth + 1 || c.getBoundingClientRect().right > W + 1).map((c) => c.dataset.path)
      return { sw: de.scrollWidth, W, wide, n: cards.length, unlocked: cards.filter((c) => !c.classList.contains('locked')).length, art: document.querySelectorAll('#screen .legend-card-v193ad .lg-ic rib-art').length }
    })
    ok(o.sw <= o.W + 1 && o.wide.length === 0 && o.n === 24 && o.art === 24, `${w} px: no horizontal overflow on the screen or any card; every card's icon is drawn art`, o)
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: SHOTS + '/' + name, fullPage: w === 360 }); console.log('shot', SHOTS + '/' + name) }
  }
  if (SHOTS) {
    await page.setViewportSize({ width: 360, height: 900 })
    await M(() => { const c = document.querySelector('#screen .legend-card-v193ad.locked'); c && c.scrollIntoView({ block: 'start' }) })
    await page.waitForTimeout(200)
    await page.screenshot({ path: SHOTS + '/legends360-locked.png' }); console.log('shot', SHOTS + '/legends360-locked.png')
  }
}

ok(errs.length === 0, 'no page errors', errs.slice(0, 5))
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail ? 1 : 0)
