// Dev check: v192 C (src/14-personality.js, src/07-career-app.js).
//   PERSONALITY, BOTH SIDES — every pole of every slider has at least one real upside and one real downside, each
//     wired to a hook the game reads (the v20 levers + v192C's fatigue / growth / playoff / monster-game / Poise-rate);
//     the personality page draws EVERY effect of a slider position (both poles, every number) — the old page clipped
//     the chip row to ~6 and hid the per-row text; an old save picks the new levers up without being re-billed
//   POISE — `player.poiseV192C` 0-100: starts low, grows slowly a game (more in the playoffs, × the personality's
//     rate); low Poise widens the game-to-game swing, high Poise narrows it and lifts the floor of a bad game; the
//     same reshape rides the quick sim's rating, the watched game's form roll and ca()'s week swing
//   `TU("v192C", 0)` restores the old path.
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v192Ccheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
await page.addInitScript(() => { setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(gameUrl('index.html?stayStale&noFilmV114'), { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V192C && !!window.__personaV192C && !!window.__V190, null, { timeout: 40000 })
await page.waitForTimeout(800)
const M = (fn, arg) => page.evaluate(fn, arg)

const seed = (o = {}) => M((o) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true
  S.player = A.newPlayer(); S.player.name = 'Poise Tester'; S.player.pos = o.pos || 'RB'; S.player.level = o.level == null ? 4 : o.level
  if (o.persona) S.player.personaV13 = o.persona
  A.setState(S)
  window.RIB_TUNE = window.RIB_TUNE || {}
  delete window.RIB_TUNE.v192C
  return true
}, o)
const NEUTRAL = { aggression: 5, iq: 5, eq: 5, longterm: 5, workethic: 5, loyalty: 5, confidence: 5, coachability: 5 }

// ---------- 1. every pole: a real upside and a real downside ----------
const poles = await M(() => {
  const V = window.__personaV192C, out = []
  V.P.forEach(tr => ['lo', 'hi'].forEach(side => {
    const E = V.effectsOf(tr, side, 1)
    out.push({ pole: side === 'hi' ? tr.hi : tr.lo, up: E.filter(e => e.up).length, dn: E.filter(e => !e.up).length })
  }))
  return out
})
ok(poles.length === 16 && poles.every(p => p.up >= 1 && p.dn >= 1), 'all 16 poles carry at least one upside AND one downside', poles.filter(p => !(p.up >= 1 && p.dn >= 1)))

// the new levers reach the fx and the hooks read them
await seed({ persona: Object.assign({}, NEUTRAL, { workethic: 0 }) })
const coast = await M(() => { const V = window.__V192C; return { fx: V.fx(), fat: V.fatigueMul(), grow: V.growthMul() } })
ok(coast.fx && coast.fx.v192C === 1 && coast.fat < 0.7 && coast.grow < 1, 'Coasts (0): far less season fatigue (the owner\'s ask), slower growth', coast)
await seed({ persona: Object.assign({}, NEUTRAL, { workethic: 10 }) })
const rel = await M(() => { const V = window.__V192C; return { fat: V.fatigueMul(), grow: V.growthMul(), gas: V.fx().gasBurn } })
ok(rel.fat > 1 && rel.grow > 1 && rel.gas > 1, 'Relentless (10): grows faster, burns the tank and the season harder', rel)
await seed({ persona: Object.assign({}, NEUTRAL, { eq: 0 }) })
const vol = await M(() => window.__V192C.fx())
await seed({ persona: Object.assign({}, NEUTRAL, { eq: 10 }) })
const even = await M(() => window.__V192C.fx())
ok(vol.boomMult > 1.4 && vol.poiseRate < 0.6 && even.boomMult < 1 && even.poiseRate > 1.4, 'Volatile booms more and steadies slower; Even-Keeled the reverse', { vol, even })
await seed({ persona: Object.assign({}, NEUTRAL, { confidence: 10 }) })
const brash = await M(() => {
  const pl = window.S.player, V = window.__V190, snap = JSON.stringify(pl)
  const run = (playoff, tune) => { window.RIB_TUNE.v192C = tune; let s = 0; const N = 1500; for (let i = 0; i < N; i++) s += V.roll(pl, { playoff }).perf; delete window.RIB_TUNE.v192C; return s / N }
  const on = run(true, 1), off = run(true, 0)
  Object.assign(pl, JSON.parse(snap))
  return { big: window.__V192C.fx().bigGame, on: +on.toFixed(1), off: +off.toFixed(1) }
})
ok(brash.big === 3 && brash.on - brash.off > 1.5, 'Brash (10): +3 rating in playoff games, and the playoff roll pays it', brash)

// growth: the season growth roll reads the multiplier (process vs win-now on the same seeded preview)
const growPrev = await M(() => {
  const A = window.__GRIDIRON_AUDIT__, pl = window.S.player
  const lever = (p) => { pl.personaV13 = Object.assign({}, p); pl.personaFxV20 = null; return window.__V192C.growthMul(pl) }
  return { process: lever({ longterm: 10 }), winnow: lever({ longterm: 0 }), coachable: lever({ coachability: 10 }), stubborn: lever({ coachability: 0 }) }
})
ok(growPrev.process > 1.1 && growPrev.winnow < 0.9 && growPrev.coachable > 1 && growPrev.stubborn < 1, 'growth: Process / Coachable faster, Win-Now / Stubborn slower', growPrev)

// fatigue: a real game's wear charge (v111) bills a Coasts man less than a Relentless one
const fatGame = await M(() => {
  const pl = window.S.player
  const charge = (we) => {
    pl.personaV13 = { workethic: we }; pl.personaFxV20 = null; pl._wearV111 = { load: 0, lingering: [] }
    pl.conditionV11 = Object.assign(pl.conditionV11 || {}, { fatigue: 20 })
    window.__V111.charge(pl, null, { snaps: 50, teamSnaps: 60, touchMul: 1.2 })
    return +(pl.conditionV11.fatigue - 20).toFixed(2)
  }
  return { coasts: charge(0), neutral: charge(5), relentless: charge(10) }
})
ok(fatGame.coasts < fatGame.neutral && fatGame.neutral < fatGame.relentless && fatGame.neutral > 0, 'a game\'s fatigue charge: Coasts < neutral < Relentless', fatGame)

// ---------- 2. the page draws every effect ----------
await seed({ persona: { aggression: 9, iq: 2, eq: 7, longterm: 1, workethic: 0, loyalty: 8, confidence: 3, coachability: 6 } })
const page1 = await M(() => {
  const V = window.__personaV192C, pl = window.S.player
  window.__personaViewV192C()
  const el = document.getElementById('personaViewV192C'); if (!el) return null
  const rows = [...el.querySelectorAll('.pv13-row')]
  const per = V.P.map((tr, i) => {
    const v = pl.personaV13[tr.key], side = v > 5 ? 'hi' : 'lo', other = side === 'hi' ? 'lo' : 'hi'
    const act = rows[i].querySelector('.pv192-col.act'), cols = rows[i].querySelectorAll('.pv192-col')
    return { key: tr.key, shown: act ? act.querySelectorAll('.pv192-e').length : 0, want: V.effectsOf(tr, side, Math.abs(v - 5)).length,
      otherShown: [...cols].filter(c => c !== act).reduce((a, c) => a + c.querySelectorAll('.pv192-e').length, 0), otherWant: V.effectsOf(tr, other, 0).length }
  })
  const chips = el.querySelectorAll('.pv13-boosts .pv13-chip').length
  const box = el.querySelector('.pv13-boosts'), cs = getComputedStyle(box)
  const txt = el.textContent
  const r = { per, chips, overflowY: cs.overflowY, poiseLine: !!el.querySelector('.pv192-poise'),
    hasFat: /season fatigue/.test(txt), hasGrow: /attribute growth/.test(txt), hasBig: /playoff/.test(txt), hasBoom: /monster/.test(txt), hasPoise: /Poise grows/.test(txt) }
  el.remove()
  return r
})
ok(page1 && page1.per.every(r => r.shown === r.want && r.otherShown === r.otherWant), 'the page draws every effect of both poles of all 8 sliders (active at its points, the other per point)', page1 && page1.per)
ok(page1 && page1.chips >= 14 && page1.overflowY === 'auto', 'the totals row is not clipped to 6: every chip is there and the box scrolls', page1 && { chips: page1.chips, oy: page1.overflowY })
ok(page1 && page1.poiseLine && page1.hasFat && page1.hasGrow && page1.hasBig && page1.hasBoom && page1.hasPoise, 'the page names fatigue, growth, playoff, monster-game and Poise effects', page1)

// ---------- 3. an old save: new levers, never re-billed ----------
const old = await M(() => {
  const pl = window.S.player
  pl.personaV13 = { workethic: 0, eq: 9, loyalty: 1 }
  pl.personaFxV20 = { injMult: 1, varMult: 1, perfFlat: -1, gasBurn: 0.75, sprintIQ: 0 }   // a v20-era fx
  pl.coachTrust = 41; pl.snapShare = 0.3; pl._personaClashV13 = 1.7
  delete pl.poiseV192C; pl.seasonsSinceStart = 5
  const fx = window.__V192C.fx(pl)
  return { v: fx && fx.v192C, fat: fx && fx.fatigueMult, trust: pl.coachTrust, share: pl.snapShare, poise: window.__V192C.poise(pl), you: window.__youPersonaFxV20 === pl.personaFxV20,
    attr: fx && fx.attrFlatV193N, flat: window.__V193N && window.__V193N.flat(pl) }   // v193 N: the perfFlat becomes one attribute per pole
})
ok(old.v === 1 && old.fat < 1 && old.trust === 41 && old.share === 0.3 && old.you, 'an old save\'s fx gains the v192C levers; coach trust / snap share untouched', old)
ok(old.attr && old.attr.awareness === -1 && old.attr.vision === 1 && Object.keys(old.attr).length === 2 && old.flat && old.flat.all === 0, 'v193 N: the old save\'s all-stats perfFlat (−1) becomes Coasts −1 Awareness, Me-First +1 Vision — nothing on every stat', old.attr)
ok(old.poise === 25, 'an old save is seeded Poise from the seasons he has played (10 + 3 × 5)', old.poise)

// ---------- 4. POISE: the distribution at 0 / 50 / 100 ----------
await seed({ persona: NEUTRAL, level: 0 })
const dist = await M(() => {
  const pl = window.S.player, V = window.__V190, snap = JSON.stringify(pl), N = 6000
  const q = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))]
  const at = (poise, tune) => {
    if (tune != null) window.RIB_TUNE.v192C = tune
    const xs = []
    for (let i = 0; i < N; i++) { pl.poiseV192C = poise; xs.push(V.roll(pl, {}).perf); Object.assign(pl, JSON.parse(snap)) }  // rollGamePerf moves coach trust: restore every roll
    delete window.RIB_TUNE.v192C
    xs.sort((a, b) => a - b)
    const mean = xs.reduce((a, b) => a + b, 0) / N
    return { mean: +mean.toFixed(1), p10: q(xs, 0.1), p50: q(xs, 0.5), p90: q(xs, 0.9) }
  }
  const r = { off: at(0, 0), p0: at(0), p50: at(50), p100: at(100) }
  r.trustKept = pl.coachTrust === JSON.parse(snap).coachTrust
  return r
})
console.log('      perf distribution (6000 rolls each, a fresh RB at Pee Wee, neutral persona):')
for (const k of ['off', 'p0', 'p50', 'p100']) console.log('        ' + (k === 'off' ? 'v192C off ' : 'poise ' + k.slice(1).padEnd(4)) + JSON.stringify(dist[k]))
ok(dist.p0.p90 - dist.p0.p10 > dist.p50.p90 - dist.p50.p10 && dist.p50.p90 - dist.p50.p10 > dist.p100.p90 - dist.p100.p10, 'the swing (p90 − p10) narrows as Poise climbs', { s0: dist.p0.p90 - dist.p0.p10, s50: dist.p50.p90 - dist.p50.p10, s100: dist.p100.p90 - dist.p100.p10 })
ok(dist.p100.p10 > dist.p0.p10 + 2 && dist.p100.p10 > dist.p50.p10, 'high Poise lifts the floor of a bad game (p10)', { p0: dist.p0.p10, p50: dist.p50.p10, p100: dist.p100.p10 })
ok(Math.abs(dist.p100.mean - dist.p0.mean) < 3 && Math.abs(dist.p50.mean - dist.off.mean) < 2, 'the average barely moves (< 3 points end to end)', { off: dist.off.mean, p0: dist.p0.mean, p50: dist.p50.mean, p100: dist.p100.mean })
ok(dist.trustKept, 'the sampler restored the player (rollGamePerf moves coach trust)')

// the shape itself, and the kill switch
const shape = await M(() => {
  const V = window.__V192C, pl = window.S.player
  pl.poiseV192C = 100; const hi = [V.shape(pl, -10), V.shape(pl, 10)]
  pl.poiseV192C = 0; const lo = [V.shape(pl, -10), V.shape(pl, 10)]
  window.RIB_TUNE.v192C = 0; const off = [V.shape(pl, -10), V.shape(pl, 10)], fxOff = window.__personaV192C.fxOf({ workethic: 0 }); delete window.RIB_TUNE.v192C
  return { hi, lo, off, offFat: fxOff.fatigueMult, sd0: +V.sdMul(Object.assign({}, pl, { poiseV192C: 0 })).toFixed(3), sd100: +V.sdMul(Object.assign({}, pl, { poiseV192C: 100 })).toFixed(3) }
})
ok(shape.hi[0] > -6.5 && shape.hi[1] < 8 && shape.lo[0] === -12 && shape.lo[1] === 12, 'Poise 100 halves a bad swing, trims a good one; Poise 0 widens both ×1.2', shape)
ok(shape.off[0] === -10 && shape.off[1] === 10 && shape.offFat === undefined, 'kill switch v192C 0: no reshape, no new levers', shape)
ok(shape.sd0 > 1 && shape.sd100 < 0.8, 'the v146 projection\'s swing sd follows Poise', shape)

// ---------- 5. growth: slow, more in the playoffs, shaped by personality ----------
const grow = await M(() => {
  const V = window.__V192C, pl = window.S.player
  const g = (persona, opts, from) => { pl.personaV13 = persona; pl.personaFxV20 = null; pl.poiseV192C = from; return V.grow(pl, opts) }
  const reg = g({}, {}, 10), po = g({}, { playoff: true }, 10), even = g({ eq: 10 }, {}, 10), vol = g({ eq: 0 }, {}, 10), late = g({}, {}, 90)
  // a whole career's worth: 25 seasons of 10 games + 2 playoff games, neutral
  pl.personaV13 = {}; pl.personaFxV20 = null; pl.poiseV192C = 10; const marks = []
  for (let s = 1; s <= 25; s++) { for (let k = 0; k < 10; k++) V.grow(pl, {}); for (let k = 0; k < 2; k++) V.grow(pl, { playoff: true }); if (s % 5 === 0) marks.push(Math.round(pl.poiseV192C)) }
  pl.personaV13 = { eq: 10 }; pl.personaFxV20 = null; pl.poiseV192C = 10; for (let s = 0; s < 10; s++) { for (let k = 0; k < 10; k++) V.grow(pl, {}); for (let k = 0; k < 2; k++) V.grow(pl, { playoff: true }) }
  const even10 = Math.round(pl.poiseV192C)
  return { reg, po, even, vol, late, marks, even10 }
})
ok(grow.reg > 0 && grow.reg < 0.5 && grow.po > grow.reg * 2, 'a regular game is a fraction of a point; a playoff game ×2.5', grow)
ok(grow.even > grow.reg * 1.4 && grow.vol < grow.reg * 0.6 && grow.late < grow.reg * 0.3, 'Even-Keeled grows it faster, Volatile slower; it slows near the top', grow)
ok(grow.marks[0] < 35 && grow.marks[4] > 55 && grow.marks[4] < 100, 'SLOWLY: a neutral man reaches ~half way in a long career (every 5 seasons)', grow.marks)
console.log('      neutral Poise every 5 seasons: ' + grow.marks.join(' → ') + '   · Even-Keeled 10 after 10 seasons: ' + grow.even10)

// a real season game grows it once (the shared __aiSeasonGame path)
const real = await M(() => {
  const A = window.__GRIDIRON_AUDIT__, S = window.S, pl = S.player
  pl.personaV13 = {}; pl.personaFxV20 = null; pl.poiseV192C = 10
  try { A.simSeason(pl) } catch (e) { return { err: String(e) } }
  return { after: pl.poiseV192C, games: (pl.weekResults || []).filter(w => w.played).length }
})
ok(real.after > 10 && real.after < 20, 'a simmed season grows Poise a few points', real)

// ---------- 6. the hub card ----------
await seed({ persona: NEUTRAL })
const hub = await M(async () => {
  const S = window.S; S.view = 'hub'; S.player.poiseV192C = 64
  try { window.go('hub') } catch (e) {}
  await new Promise(r => setTimeout(r, 400))
  const c = document.querySelector('.poise-card-v192c')
  return { card: !!c, txt: c ? c.textContent.replace(/\s+/g, ' ').slice(0, 600) : null }
})
ok(hub.card && /UNFAZED/.test(hub.txt) && /64/.test(hub.txt), 'the hub carries the Poise card (band, number, what it does)', hub)
const hubOpen = await M(async () => { const a = document.querySelector('.poise-card-v192c a'); a && a.click(); await new Promise(r => setTimeout(r, 100)); const ok = !!document.getElementById('personaViewV192C'); document.getElementById('personaViewV192C')?.remove(); return ok })
ok(hubOpen, 'the card opens the personality page')

ok(errs.length === 0, 'no page errors', errs.slice(0, 5))
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail ? 1 : 0)
