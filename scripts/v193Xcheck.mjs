// Dev check: v193 X ROLLS AND ITEMS IN PERCENT (src/07-career-app.js, src/16-18, src/11-pregame-v1513.js).
//   a CALIBRATION — at Pee Wee, College and UFF attribute levels the old flat roll vs the new percent: the percent matches
//     the flat outcome at College (within 15%), is fewer points below it and more above it, and scales with the attribute
//   b THE ROLLS, through the real functions — the growth wheel (genOptions → rollOutcome → applyOutcome → compose), the
//     plan roll (silentPlan off a staff deck: decidePlan → applyDecision → compose), the story wheel's buffs
//     (__mkTempBuffsV25), the "+1 Permanent" / Extra reps flips, the fate roll (re-based, whole), the projection's band
//   c THE ITEMS — a new piece's a_* modifiers roll as a percent (flat kept), an old piece migrates ONCE, the per-attribute
//     cap is a percent (25%), the v193 A level multiplier rides on top, the points land in effAttrsV85 off the attribute
//   d THE KILL SWITCH — TU v193X 0: every roll and every piece reads its old flat number
//   e NO DECIMALS — the locker's chips / totals / compare, the hub's growth chips, the roll lines, the flip and fate lines
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v193Xcheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const page = await browser.newPage({ viewport: { width: 400, height: 860 } })
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
await page.addInitScript(() => { setInterval(() => { try { document.querySelector('.onboard')?.remove() } catch {} }, 60) })
await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V193X && !!window.__GROWTH_V42 && !!window.__PREGAME_V51 && !!window.__V147C && !!window.__V179, null, { timeout: 40000 })
await page.waitForTimeout(800)
const M = (fn, arg) => page.evaluate(fn, arg)
const setup = () => M(() => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S); S.tree = {}
  const p = A.newPlayer(); p.pos = 'RB'; p.name = 'Pct Man'; p.originV11 = p.originV11 || 'walk-on'; p.level = 5; S.player = p; p.training = 'balanced'
  for (const k in p.attrs) p.attrs[k] = 72
  S.inventory = []; S.equipped = {}
  window.RIB_TUNE = window.RIB_TUNE || {}; delete window.RIB_TUNE.v193X
  return true
})
const DEC = /\d\.\d/

// ---- a: the calibration
await setup()
const C = await M(() => {
  const X = window.__V193X, R = X.refs(), flats = [3, 4, 5, 6, 7, 8, 9, 10]   // the plan's 3..5, the growth tiers' 3..10
  const at = (attr) => { const pl = { attrs: { speed: attr } }; const pts = flats.map((f) => X.pts(pl, 'speed', X.pct(f))); return { attr, flat: flats.reduce((a, b) => a + b, 0) / flats.length, pct: flats.map((f) => X.pct(f)), pts: pts.reduce((a, b) => a + b, 0) / pts.length } }
  return { refs: R, perPoint: X.perPoint(), peewee: at(X.ref(0)), college: at(X.ref(5)), uff: at(X.ref(7)), uff250: at(250), whole: flats.every((f) => Number.isInteger(X.pct(f))) }
})
console.log('     refs (key / all by level):', JSON.stringify(C.refs), '· per point', C.perPoint.toFixed(3) + '%')
for (const k of ['peewee', 'college', 'uff', 'uff250']) console.log(`     ${k.padEnd(8)} attr ${C[k].attr} · old flat mean +${C[k].flat.toFixed(2)} · new mean +${C[k].pts.toFixed(2)} (${(C[k].pts / C[k].attr * 100).toFixed(1)}% of the attribute)`)
ok(Math.abs(C.college.pts / C.college.flat - 1) <= 0.15, 'at College the percent outcome matches the old flat one (within 15%)', { flat: C.college.flat, pct: C.college.pts })
ok(C.peewee.pts < C.peewee.flat && C.uff.pts > C.uff.flat && C.uff250.pts > C.uff.pts, 'below College a roll is fewer points, above it more — and it keeps growing with the attribute', { peewee: C.peewee.pts, uff: C.uff.pts, uff250: C.uff250.pts })
ok(Math.abs(C.uff250.pts / 250 - C.college.pts / C.college.attr) < 0.012, 'the same share of the attribute at College and at 250', { college: C.college.pts / C.college.attr, at250: C.uff250.pts / 250 })
ok(C.whole && C.refs.key[5] > C.refs.key[0] && C.refs.key[7] > C.refs.key[5], 'the percents are whole numbers and the reference climbs with the level', C.refs.key)

// ---- b: the rolls, through the real functions
await setup()
const B = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), p = S.player, X = window.__V193X, G = window.__GROWTH_V42, r = {}
  p.attrs.speed = 80; p.attrs.agility = 50; p.attrs.acceleration = 120; p.attrs.ballControl = 64; p.attrs.vision = 30
  // the growth wheel: every tier's option, rolled and applied
  r.growth = []
  for (let i = 0; i < 12; i++) {
    let s = 7 + i * 31; const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
    const opts = G.genOptions(p, rand, 5); const opt = opts[i % opts.length]
    const out = G.rollOutcome(p, opt, rand, 'season'); p.growthFxV42 = []; out.permanent = false
    G.applyOutcome(p, out); const comp = G.compose(p) || []
    const want = out.stats.map((k) => ({ k, pct: out.sign * out.pct, pts: X.pts(p, k, out.sign * out.pct) }))
    r.growth.push({ tag: opt.tag, optPct: opt.pct === Math.abs(X.pct(opt.amt)), outPct: out.pct === Math.abs(X.pct(out.amt)),
      match: want.every((w) => { const c = comp.find((e) => e.stat === w.k); return c && c.pct === w.pct && c.amt === w.pts }), want, comp })
  }
  // a permanent: +1..3 as a percent
  { p.growthFxV42 = []; const R0 = Math.random; Math.random = () => 0.99; G.applyOutcome(p, { icon: '', name: 'P', story: '', sign: 1, stats: ['speed'], amt: 9, pct: 13, permanent: true, tier: {}, ctx: 'season', card: 'iron' }); Math.random = R0
    const fx = p.growthFxV42[0]; r.perm = { amt: fx.amt, pct: fx.pct, want: Math.abs(X.pct(fx.amt)), pts: (G.compose(p) || [])[0] } }
  // the plan roll: a staff deck off the page, the silent roll (decidePlan → applyDecision → compose)
  const panel = document.createElement('div')
  const btn = (id, name, up, ctrl, risk, scout) => `<button onclick="chooseGamePlanV11('${id}',${!!scout})"><span class="plan-icon">📋</span><b>${name}${scout ? ' · SCOUT PICK' : ''}</b><div class="mini-rating"><label><span>UPSIDE</span><span>${up}</span></label><label><span>CONTROL</span><span>${ctrl}</span></label><label><span>RISK</span><span>${risk}</span></label></div></button>`
  panel.innerHTML = btn('explosive', 'Explosive Start', 80, 30, 70) + btn('disciplined', 'Disciplined Execution', 40, 80, 20, true) + btn('filmgrind', 'Film Marathon', 50, 70, 30)
  r.plans = []
  for (let i = 0; i < 40 && r.plans.filter((x) => x.band !== 'neutral').length < 6; i++) {
    p.growthFxV42 = []; p.planPickV146 = null
    const res = window.__PREGAME_V51.silentPlan(p, panel); if (!res) continue
    const fx = p.growthFxV42[0], buffs = p._tempStatBuffsV25 || []
    r.plans.push({ band: res.band, lines: res.lines, fxPct: fx && fx.pct, fxAmt: fx && fx.amt, wantPct: fx && Math.abs(X.pct(fx.amt)),
      buffs: buffs.map((b) => ({ stat: b.stat, amt: b.amt, pct: b.pct, want: X.pts(p, b.stat, b.pct) })) })
  }
  // the projection's band carries the expected percent
  r.perPoint = X.perPoint()
  // the story wheel's buffs
  const sw = []; for (let i = 0; i < 20; i++) sw.push(...window.__mkTempBuffsV25(p, i % 3 ? 1 : -1, i / 20, (i * 7 % 10) / 10))
  r.story = sw.map((b) => ({ ok: b.pct === X.pct(b.flatV193X) && b.amt === X.pts(p, b.stat, b.pct), t: X.buff(b) }))
  // the flips: +1 Permanent and Extra reps
  for (const k in p.attrs) p.attrs[k] = 150
  const before = Object.assign({}, p.attrs); window.__V179.applyFlip('attr', { week: 3, opp: 'Q' })
  const up = Object.keys(p.attrs).filter((k) => p.attrs[k] !== before[k]).map((k) => ({ k, d: p.attrs[k] - before[k], want: X.pts({ attrs: before }, k, X.pct(1)) }))
  r.flipAttr = up
  p.practiceV178 = {}; window.__V179.applyFlip('reps', { week: 4, opp: 'Q' }); const bank = Object.values(p.practiceV178)
  r.flipReps = { bank, want: 0.25 * X.perPoint() * 150 / 100 }
  // the fate roll: re-based on the calibration, whole
  for (const k in p.attrs) p.attrs[k] = 40
  window.__GRIDIRON_AUDIT__.startSeasonGames(); S.view = 'season'
  r.fate = window.__fateAttrFor('explosive'); r.fateWant = X.pct(20); r.fateBase = p.attrs[r.fate.attr]   // startSeasonGames can move a stat off 40 (v193 N's personality flat, the season snapshot) — the roll reads the sheet as it stands
  return r
})
ok(B.growth.length === 12 && B.growth.every((g) => g.optPct && g.outPct), 'growth wheel: every option and outcome carries its flat roll as a whole percent', B.growth.map((g) => g.tag))
ok(B.growth.every((g) => g.match), 'growth wheel: compose turns the percent into points off each attribute (80 / 50 / 120 …)', B.growth.filter((g) => !g.match).slice(0, 2))
ok(B.perm.pct === B.perm.want && B.perm.pct >= 1, 'a permanent (+1..3) is a percent too', B.perm)
const pl = B.plans.filter((x) => x.band !== 'neutral')
ok(pl.length >= 4 && pl.every((x) => x.fxPct === x.wantPct && x.buffs.length && x.buffs.every((b) => b.pct != null && b.amt === b.want)), 'plan roll: a click / backfire is a percent of each pool stat, composed into points (silentPlan)', pl.slice(0, 2))
ok(pl.every((x) => /^[+−]\d+% [A-Za-z ]+ \([+−]\d+\)( · [+−]\d+% [A-Za-z ]+ \([+−]\d+\))*$/.test(x.lines)), 'plan roll: the lines read "+6% Speed (+5)"', pl.slice(0, 3).map((x) => x.lines))
ok(B.story.length >= 20 && B.story.every((s) => s.ok) && B.story.every((s) => /^[+−]\d+% .+ \([+−]\d+\)$/.test(s.t)), 'story wheel: its buffs are percents, in points off the sheet', B.story.slice(0, 3).map((s) => s.t))
ok(B.flipAttr.length === 1 && B.flipAttr[0].d === B.flipAttr[0].want && B.flipAttr[0].d >= 2, '"+1 Permanent" is a percent of the stat (150 → +' + (B.flipAttr[0] || {}).d + ')', B.flipAttr)
ok(B.flipReps.bank.length === 1 && Math.abs(B.flipReps.bank[0] - B.flipReps.want) < 1e-6, 'Extra reps banks a percent of the stat', B.flipReps)
ok(B.fate.pct === B.fateWant && Number.isInteger(B.fate.pct) && B.fate.amount === Math.max(1, Math.round(B.fateBase * B.fate.pct / 100)), 'the fate roll is re-based on the calibration, a whole percent', { fate: B.fate, base: B.fateBase })

// the projection prices a click / backfire as the percent, per stat
await setup()
const P = await M(() => {
  const V = window.__V146, S = window.__GRIDIRON_AUDIT__.getState(), p = S.player; if (!V || !V.project) return null
  window.__GRIDIRON_AUDIT__.startSeasonGames(); S.view = 'season'
  const band = (pctG, amtG) => ({ g: 1, n: 0, r: 0, statsG: ['speed', 'agility', 'vision'], statsR: [], pctG, amtG })
  const read = (b) => { const x = V.project({ band: b }); return x && x.mult ? [x.mult.EM, x.mult.EM2] : null }
  const lo = read(band(1, 1)), hi = read(band(20, 1))
  window.RIB_TUNE.v193X = 0; const offLo = read(band(1, 1)), offHi = read(band(20, 1)); delete window.RIB_TUNE.v193X
  return { lo, hi, offLo, offHi }
})
ok(P && P.lo && P.hi && P.lo.some((v, i) => v !== P.hi[i]) && JSON.stringify(P.offLo) === JSON.stringify(P.offHi), 'the projection prices the band\'s percent (and ignores it while off)', P && { lo: P.lo.slice(0, 3), hi: P.hi.slice(0, 3) })

// ---- c: the items
await setup()
const I = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), p = S.player, X = window.__V193X, V = window.__V147C, L = window.__V193A, r = {}
  // a new piece: find one whose roll carries an attribute modifier
  let it = null
  for (let i = 0; i < 200 && !it; i++) { const x = V.roll({ id: 'xr_' + i, slot: 'chain', rarity: 'mythic', name: 'GOAT Chain', eff: 'growth', val: 0.05, icon: '📿' }, 5); if (x.mods.some((m) => /^a_/.test(m.k))) it = x }
  const am = it.mods.filter((m) => /^a_/.test(m.k))
  r.newPiece = { tag: it.attrPctV193X, mods: am, ok: am.every((m) => m.flatV193X > 0 && m.v === X.gearPct(m.flatV193X, 5) && Number.isInteger(m.v)) }
  // an old piece migrates once
  const old = { id: 'old_x', slot: 'gloves', rarity: 'epic', name: 'Phantom Gloves', eff: 'growth', val: 0.05, icon: '🧤', modsV147: 1, tierV147: 4, mods: [{ k: 'a_speed', v: 6 }, { k: 'p_rushYds', v: 0.1 }] }
  V.ensure(old); const once = JSON.stringify(old.mods); V.ensure(old); V.ensure(old)
  r.migrate = { mods: old.mods, tag: old.attrPctV193X, want: X.gearPct(6, 4), twice: JSON.stringify(old.mods) === once }
  // as strong as before at the tier it dropped: at the reference attribute it is ~6 points
  S.equipped = { gloves: old }; L.ensure(old); old.lvlV193 = 0
  const ref4 = X.ref(4, true); p.attrs.speed = ref4; r.atRef = { ref4, pts: V.effAttrs(p).gear.speed }
  // the level multiplier rides on top, and the points keep pace with the attribute
  old.lvlV193 = 20; S.equipped = { gloves: old }; Object.assign(S.equipped, {})   // a new equip resets the totals memo
  S.equipped = Object.assign({}, S.equipped)
  r.level = { mult: L.mult(old), got: V.get('a_speed'), want: Math.round(r.migrate.want * L.mult(old)) }
  p.attrs.speed = 80; const e80 = V.effAttrs(p); p.attrs.speed = 200; const e200 = V.effAttrs(p)
  r.pts = { at80: e80.gear.speed, at200: e200.gear.speed, want80: Math.max(1, Math.round(80 * r.level.got / 100)), want200: Math.max(1, Math.round(200 * r.level.got / 100)) }
  // the cap: two pieces of 20% on one attribute
  const pc = (id, slot, v) => ({ id, slot, rarity: 'mythic', name: 'Cap', eff: 'growth', val: 0, icon: '📿', modsV147: 1, tierV147: 0, attrPctV193X: 1, lvlV193: 0, lvl0V193: 1, mods: [{ k: 'a_speed', v, flatV193X: 18 }] })
  S.equipped = { chain: pc('c1', 'chain', 20), cleats: pc('c2', 'cleats', 20) }
  r.cap = { got: V.get('a_speed'), cap: X.gearCap() }
  // the kill switch reads the old flat numbers (and the old 20 cap)
  window.RIB_TUNE.v193X = 0; S.equipped = Object.assign({}, S.equipped)
  r.capOff = V.get('a_speed')
  S.equipped = { gloves: old }; p.attrs.speed = 80
  r.off = { got: V.get('a_speed'), want: Math.round(6 * L.mult(old)), gear: V.effAttrs(p).gear.speed }
  delete window.RIB_TUNE.v193X; S.equipped = Object.assign({}, S.equipped)
  r.back = V.get('a_speed')
  return r
})
ok(I.newPiece.tag === 1 && I.newPiece.ok, 'a new piece rolls its attribute modifiers as whole percents of the tier\'s typical attribute (flat kept)', I.newPiece.mods)
ok(I.migrate.tag === 1 && I.migrate.mods[0].v === I.migrate.want && I.migrate.mods[0].flatV193X === 6 && I.migrate.mods[1].v === 0.1 && I.migrate.twice, 'an old piece migrates its a_* once (+6 Speed at tier 4 → +' + I.migrate.want + '%), production lines untouched', I.migrate)
ok(Math.abs(I.atRef.pts - 6) <= 1, 'at the tier\'s typical attribute the piece is as strong as before (~+6)', I.atRef)
ok(I.level.got === I.level.want && I.level.mult > 1, 'the v193 A level multiplier rides on top (a whole percent)', I.level)
ok(I.pts.at80 === I.pts.want80 && I.pts.at200 === I.pts.want200 && I.pts.at200 > I.pts.at80, 'effAttrsV85: the points are the percent of his own attribute (keeps pace)', I.pts)
ok(I.cap.got === I.cap.cap && I.cap.cap === 25, 'two +20% pieces are capped at gearAttrPctCapV193X (25%)', I.cap)

// ---- d: the kill switch
ok(I.capOff === 20 && I.off.got === I.off.want && I.off.gear === I.off.got && I.back === I.level.got, 'v193X 0: gear reads its old flat roll (and the flat cap of 20); back on, the percent', { capOff: I.capOff, off: I.off, back: I.back })
await setup()
const K = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), p = S.player, G = window.__GROWTH_V42, X = window.__V193X, r = {}
  window.RIB_TUNE.v193X = 0
  p.attrs.speed = 150; p.growthFxV42 = []
  G.applyOutcome(p, { icon: '', name: 'K', story: '', sign: 1, stats: ['speed'], amt: 5, pct: 7, permanent: false, tier: { games: 3 }, ctx: 'season', card: 'iron' })
  r.compose = G.compose(p)
  r.story = window.__mkTempBuffsV25(p, 1, 0.5, 0.5).map((b) => ({ pct: b.pct, amt: b.amt, t: X.buff(b) }))
  for (const k in p.attrs) p.attrs[k] = 40
  window.__GRIDIRON_AUDIT__.startSeasonGames(); S.view = 'season'
  r.fate = window.__fateAttrFor('explosive')
  const before = Object.assign({}, p.attrs); window.__V179.applyFlip('attr', { week: 3, opp: 'Q' })
  r.flipAttr = Object.keys(p.attrs).map((k) => p.attrs[k] - before[k]).filter((d) => d)
  delete window.RIB_TUNE.v193X
  r.composeOn = G.compose(p)
  return r
})
ok(K.compose.length === 1 && K.compose[0].amt === 5 && K.compose[0].pct == null, 'v193X 0: a growth effect is its flat +5 again', K.compose)
ok(K.story.every((b) => b.pct == null && !/%/.test(b.t)), 'v193X 0: the story wheel hands out flat points', K.story)
ok(K.fate.pct === 20 && K.fate.amount === 8, 'v193X 0: the fate roll is v192 A\'s one-for-one percent', K.fate)
ok(K.flipAttr.length === 1 && K.flipAttr[0] === 1, 'v193X 0: "+1 Permanent" is +1', K.flipAttr)
ok(K.composeOn[0].pct === 7 && K.composeOn[0].amt === Math.round(40 * 0.07), 'and back on, the same effect is its percent (7% of 40)', K.composeOn)

// ---- e: no decimals on the screens touched
await setup()
await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), p = S.player, V = window.__V147C
  for (let i = 0; i < 18; i++) S.inventory.push(V.roll({ id: 'lk_' + i, slot: ['cleats', 'gloves', 'chain'][i % 3], rarity: ['common', 'rare', 'epic', 'legendary', 'mythic'][i % 5], name: 'Piece ' + i, eff: 'growth', val: 0.05, icon: '📿' }, i % 9))
  S.equipped = { cleats: S.inventory[4], gloves: S.inventory[2], chain: S.inventory[3] }
  window.__V193A && window.__V193A.filter('all')
  window.go('locker')
})
await page.waitForTimeout(1200)
const E = await M(() => {
  const names = Object.keys(window.__GRIDIRON_AUDIT__.getState().player.attrs).map((k) => window.__statLabelV25(k)).filter(Boolean)
  const isAttr = (t) => names.some((n) => new RegExp('% ' + n + '( |$)').test(t))
  const chips = [...document.querySelectorAll('.gm-v147')].map((x) => x.textContent.trim()).filter(isAttr)
  try { window.gearSumToggleV193 && window.gearSumToggleV193() } catch (e) {}
  const row = document.querySelector('.gear-row .gr-info'); row && row.click()
  const cmp = [...document.querySelectorAll('.gc-row-v147 span')].map((x) => x.textContent.trim()).filter(isAttr)
  return { chips, cmp, flatLeft: [...document.querySelectorAll('.gm-v147')].map((x) => x.textContent.trim()).filter((t) => names.some((n) => new RegExp('^\\+\\d+ ' + n + '$').test(t))) }
})
ok(E.chips.length >= 3 && E.chips.every((t) => /^\+\d+% .+ \(\+\d+\)( · CAP)?$/.test(t) && !DEC.test(t)), 'the locker\'s attribute chips read "+12% Speed (+9)", whole numbers', E.chips.slice(0, 4))
ok(E.flatLeft.length === 0, 'no attribute chip left as a flat number', E.flatLeft)
ok(E.cmp.every((t) => !DEC.test(t)), 'the compare panel\'s attribute lines are whole numbers', E.cmp.slice(0, 3))
// the hub's growth chips and the roll lines
await setup()
await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), p = S.player, G = window.__GROWTH_V42
  p.growthFxV42 = []; G.applyOutcome(p, { icon: '🏋️', name: 'Dawn Patrol Lifts', story: '', sign: 1, stats: ['strength', 'speed'], amt: 6, pct: G.pctOf(6), permanent: false, tier: { games: 5 }, ctx: 'season', card: 'iron' })
  window.__GRIDIRON_AUDIT__.startSeasonGames(); window.go('hub')
})
await page.waitForTimeout(2200)
const H = await M(() => {
  const G = window.__GROWTH_V42, p = window.__GRIDIRON_AUDIT__.getState().player
  return { chips: (document.querySelector('.gv42-chips') || {}).innerText || '', line: G.statTxt(p, 'speed', -1, 4, G.pctOf(4), 'SPD'), fateLast: (() => { try { return window.__GRIDIRON_AUDIT__.getState()._fateLast || '' } catch (e) { return '' } })() }
})
ok(/\+\d+% · 5g/.test(H.chips) && !DEC.test(H.chips), 'the hub\'s growth chips read "+8% · 5g"', H.chips.replace(/\s+/g, ' ').slice(0, 120))
ok(/^−\d+% SPD \(−\d+\)$/.test(H.line), 'a roll line reads "−6% SPD (−4)"', H.line)
const allTxt = [].concat(B.plans.map((x) => x.lines), B.story.map((s) => s.t), [H.line])
ok(allTxt.every((t) => !DEC.test(t)), 'no decimals in any roll line', allTxt.filter((t) => DEC.test(t)).slice(0, 3))

ok(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '))
console.log(JSON.stringify({ pass, fail }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
