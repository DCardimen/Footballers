// Dev check: v193 Z THE FOCUS ROLL TILTS THE SEASON (src/07-career-app.js, src/18-growth-wheel.js).
//   a THE TILT — a forced −6% Speed season outcome sets a −12% Speed tilt (×2), a +6% one +12%; a midseason crossroads
//     adds to it; the cap holds (±40% at ×2); a weekly plan roll sets nothing
//   b THE PRICE, through window.alloc at a flat 1-pt band — 10 points buy 9 Speed levels at −12%, 11 at +12%; 50 single
//     +1 taps never lose or invent a fraction (charged + carry = levels × price); 50 minuses refund exactly and put the
//     carry back; hold-to-spend and the auto button pay the same tilted price
//   c THE SHEET — the header line, the row chip (red / green), the tilted price on the + and in the readout, the stat
//     card's chip; no decimals
//   d THE RESULT CARD — the season wheel's result says what the tilt will do, and buzzes (success / warning)
//   e THE SEASON END — the tilt is gone after the real season settle (finishSeasonGames) and on a new career
//   f THE FOCUS AMPLIFIER — a Mental node with a real price, bought through QUICK BUY (the plain purchase): Lv 1 → ×2.5
//     (−6% → −15%), the cap scales (±50%), the header names ×2.5
//   g THE KILL SWITCH — TU v193Z 0: the old prices (10 points buy 10 levels), no tilt set
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v193Zcheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const page = await browser.newPage({ viewport: { width: 400, height: 860 } })
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
await page.addInitScript(() => { setInterval(() => { try { document.querySelector('.onboard')?.remove() } catch {} }, 60) })
await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V193Z && !!window.__GROWTH_V42 && !!window.__V193L, null, { timeout: 40000 })
await page.waitForTimeout(800)
const M = (fn, arg) => page.evaluate(fn, arg)
const setup = () => M(() => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S); S.tree = {}
  const p = A.newPlayer(); p.pos = 'RB'; p.name = 'Tilt Man'; p.originV11 = p.originV11 || 'walk-on'; p.level = 5; S.player = p; p.training = 'balanced'
  p.stars = 5; p.potentialCeil = 200
  for (const k in p.attrs) p.attrs[k] = 40
  p.points = 0; p.totalSeasons = 2
  window.RIB_TUNE = window.RIB_TUNE || {}; delete window.RIB_TUNE.v193Z
  document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove(); document.getElementById('splash')?.remove()
  return true
})
// a resolved outcome through the wheel's own applyOutcome
const OUT = `(stats, sign, pct, ctx) => ({ card: 'track', icon: '', name: 'Check Roll', band: sign < 0 ? 'red' : 'green', sign, stats, amt: pct, pct, tier: { season: true }, permanent: false, story: '', ctx: ctx || 'season', fatigue: 0, tag: 'COMMITTED' })`
const DEC = /\d\.\d/

// ---- a: the tilt
await setup()
const T = await M((OUT) => {
  const S = window.__GRIDIRON_AUDIT__.getState(), p = S.player, G = window.__GROWTH_V42, Z = window.__V193Z, mk = eval(OUT), r = {}
  p.growthFxV42 = []
  G.applyOutcome(p, mk(['speed'], -1, 6))
  r.speed = Z.tilt('speed'); r.rec = JSON.parse(JSON.stringify(p.focusTiltV193Z))
  G.applyOutcome(p, mk(['agility', 'vision'], 1, 6))
  r.agility = Z.tilt('agility'); r.vision = Z.tilt('vision')
  G.applyOutcome(p, mk(['speed'], -1, 4, 'inseason|w3'))
  r.speedCross = Z.tilt('speed')
  G.applyOutcome(p, mk(['catching'], 1, 3, 'pregame'))
  r.plan = Z.tilt('catching')
  G.applyOutcome(p, mk(['strength'], 1, 30)); r.capPos = Z.tilt('strength')
  G.applyOutcome(p, mk(['tackling'], -1, 30)); r.capNeg = Z.tilt('tackling')
  r.mult = Z.mult(); r.cap = Z.cap()
  return r
}, OUT)
ok(T.speed === -0.12 && T.rec.season === 2 && T.rec.tilts.speed === -0.12, 'a −6% Speed season outcome sets a −12% Speed tilt for THIS season (player.focusTiltV193Z)', { tilt: T.speed, rec: T.rec })
ok(T.agility === 0.12 && T.vision === 0.12, 'a +6% outcome tilts every stat it touched +12%', { agility: T.agility, vision: T.vision })
ok(Math.abs(T.speedCross - -0.2) < 1e-9, 'a midseason crossroads (−4%) adds to it: −12% − 8% = −20%', T.speedCross)
ok(T.plan === 0, 'a weekly plan roll (ctx "pregame") sets no tilt', T.plan)
ok(T.mult === 2 && Math.abs(T.cap - 0.4) < 1e-9 && Math.abs(T.capPos - 0.4) < 1e-9 && Math.abs(T.capNeg + 0.4) < 1e-9, 'the cap holds: a ±30% outcome tilts ±40% at ×2', T)

// ---- b: the price
await setup()
const P = await M((OUT) => {
  const S = window.__GRIDIRON_AUDIT__.getState(), p = S.player, G = window.__GROWTH_V42, Z = window.__V193Z, mk = eval(OUT), r = {}
  window.go('upgrade')
  r.band = window.__drCostV97(p, 'speed') === 1 && window.__drCostV97(p, 'agility') === 1
  G.applyOutcome(p, mk(['speed'], -1, 6)); G.applyOutcome(p, mk(['agility'], 1, 6))
  const buy = (k, pts, taps) => { p.points = pts; const v0 = p.attrs[k]; for (let i = 0; i < (taps || 40); i++) window.alloc(k, 1); return { levels: p.attrs[k] - v0, left: p.points } }
  window.go('upgrade'); r.neg = buy('speed', 10)
  window.go('upgrade'); r.pos = buy('agility', 10)
  // 50 single taps from a fresh sheet, the accounting exact both ways
  const acct = (k) => {
    window.go('upgrade')
    const rec = p.focusTiltV193Z, c0 = (rec.carry && rec.carry[k]) || 0, pts0 = 1000, v0 = p.attrs[k]; p.points = pts0
    const charges = []
    for (let i = 0; i < 50; i++) { const b = p.points; window.alloc(k, 1); charges.push(b - p.points) }
    const levels = p.attrs[k] - v0, charged = pts0 - p.points, c1 = rec.carry[k], price = 1 / (1 + Z.tilt(k))
    const whole = charges.every((c) => Number.isInteger(c) && c >= 0)
    for (let i = 0; i < 50; i++) window.alloc(k, -1)
    return { levels, charged, c0, c1, err: Math.abs(charged + c1 - c0 - levels * price), whole, back: p.points === pts0 && p.attrs[k] === v0 && Math.abs(p.focusTiltV193Z.carry[k] - c0) < 1e-12, maxC: Math.max(...charges), minC: Math.min(...charges) }
  }
  r.accNeg = acct('speed'); r.accPos = acct('agility')
  // one minus refunds exactly what that level charged
  window.go('upgrade'); p.points = 100
  const seq = []; for (let i = 0; i < 9; i++) { const b = p.points; window.alloc('speed', 1); seq.push(b - p.points) }
  const refunds = []; for (let i = 0; i < 9; i++) { const b = p.points; window.alloc('speed', -1); refunds.push(p.points - b) }
  r.refund = { seq, refunds: refunds.reverse(), back: p.points === 100 }
  // the auto button pays the tilted price, and the fractions balance
  window.go('upgrade'); delete p.focusTiltV193Z
  G.applyOutcome(p, mk(Object.keys(p.attrs), -1, 20))
  const keys = Object.keys(p.attrs), rec = p.focusTiltV193Z, v0 = {}, c0 = {}
  keys.forEach((k) => { v0[k] = p.attrs[k]; c0[k] = (rec.carry && rec.carry[k]) || 0 })
  p.points = 60; window.autoAllocSpread()
  let owed = 0, lv = 0
  keys.forEach((k) => { const n = p.attrs[k] - v0[k]; lv += n; owed += n / (1 + Z.tilt(k)) - ((rec.carry[k] || 0) - c0[k]) })
  r.auto = { levels: lv, charged: 60 - p.points, owed: +owed.toFixed(9) }
  return r
}, OUT)
ok(P.band, 'the setup sits on a flat 1-pt band (drCost 1)')
ok(P.neg.levels === 9 && P.neg.left === 0, 'at −12% Speed, 10 points buy 9 levels (through window.alloc)', P.neg)
ok(P.pos.levels === 11 && P.pos.left === 0, 'at +12% Agility, 10 points buy 11 levels', P.pos)
ok(P.accNeg.whole && P.accNeg.err < 1e-6 && P.accNeg.levels === 50 && P.accNeg.maxC === 2 && P.accNeg.minC === 1, '50 single +1 taps at −12%: whole charges only, charged + carry = 50 × 1/(1−0.12) — nothing lost or invented', P.accNeg)
ok(P.accPos.whole && P.accPos.err < 1e-6 && P.accPos.levels === 50 && P.accPos.minC === 0 && P.accPos.maxC === 1, '50 single +1 taps at +12%: whole charges (some free), the fractions balance', P.accPos)
ok(P.accNeg.back && P.accPos.back, '50 minuses refund every point and put the carry back exactly', { neg: P.accNeg.back, pos: P.accPos.back })
ok(P.refund.back && P.refund.seq.join() === P.refund.refunds.join() && P.refund.seq.reduce((a, b) => a + b, 0) === 10, 'each minus refunds exactly what its level charged (9 levels: 10 points out, 10 back)', P.refund)
ok(P.auto.charged <= 60 && P.auto.charged >= 58 && P.auto.levels < 45 && Math.abs(P.auto.charged - P.auto.owed) < 1e-6, 'the auto button pays the tilted price: 60 points buy ~36 levels at −40% (not 60), and the fractions balance', P.auto)

// hold-to-spend: the held + pays the same tilted price and stops when the points run out
await setup()
await M((OUT) => {
  const S = window.__GRIDIRON_AUDIT__.getState(), p = S.player, mk = eval(OUT)
  window.__GROWTH_V42.applyOutcome(p, mk(['speed'], -1, 6)); p.points = 10; window.go('upgrade')
  if (window.upSegV153) { const g = document.querySelector('.up-attr[data-k="speed"]')?.closest('.up-group-v97'); g && window.upSegV153(g.dataset.g) }
}, OUT)
const plus = page.locator('#plus-speed')
await plus.scrollIntoViewIfNeeded()
const box = await plus.boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
await page.waitForTimeout(2600)
await page.mouse.up()
await page.waitForTimeout(200)
const H = await M(() => { const p = window.__GRIDIRON_AUDIT__.getState().player; return { levels: p.attrs.speed - 40, left: p.points } })
ok(H.levels === 9 && H.left === 0, 'hold-to-spend at −12%: the held + buys 9 levels for 10 points, then stops', H)

// ---- c: the sheet
await setup()
const C = await M((OUT) => {
  const S = window.__GRIDIRON_AUDIT__.getState(), p = S.player, mk = eval(OUT), G = window.__GROWTH_V42
  G.applyOutcome(p, mk(['speed'], -1, 6)); G.applyOutcome(p, mk(['agility'], 1, 5))
  p.points = 25; window.go('upgrade')
  const sc = document.getElementById('screen'), line = document.getElementById('focusLineV193Z')
  const chip = document.querySelector('#tilt-speed .up-tilt-v193z'), chipA = document.querySelector('#tilt-agility .up-tilt-v193z')
  const plain = document.querySelector('#tilt-catching .up-tilt-v193z')
  const cost = document.querySelector('#plus-speed .stepcost'), capTxt = document.getElementById('cap-speed').textContent, capA = document.getElementById('cap-agility').textContent
  const how = document.querySelector('.up-how-note-v153')?.textContent || ''
  const text = sc.innerText + ' ' + sc.textContent
  window.statInfoV142 && window.statInfoV142('speed')
  const card = document.getElementById('statInfoV142'), cardTxt = card ? card.textContent : ''
  window.statInfoCloseV142 && window.statInfoCloseV142()
  return { line: line && line.textContent.replace(/\s+/g, ' ').trim(), chip: chip && chip.textContent, chipNeg: !!chip && chip.classList.contains('neg'), chipA: chipA && chipA.textContent, chipPos: !!chipA && chipA.classList.contains('pos'), plain: !!plain, cost: cost && cost.textContent, costNeg: !!cost && cost.classList.contains('tilt-neg'), capTxt, capA, how: /focus roll tilts/i.test(how), dec: (text.match(DEC_RE()) || []).slice(0, 5), cardTxt }
  function DEC_RE() { return /\d\.\d/g }
}, OUT)
ok(C.line && /Focus roll ×2: Speed −12% · Agility \+10% — this season only/.test(C.line), 'the sheet header: "Focus roll ×2: Speed −12% · Agility +10% — this season only"', C.line)
ok(/−12% this season/.test(C.chip || '') && C.chipNeg && /\+10% this season/.test(C.chipA || '') && C.chipPos && !C.plain, 'a tilted row carries its chip (red −12% / green +10%), an untilted row none', { speed: C.chip, agility: C.chipA })
ok(C.cost === '1' && C.costNeg && /10 pts buy 9 levels/.test(C.capTxt) && /10 pts buy 11 levels/.test(C.capA), 'the price reads tilted: the + shows the next whole charge, the readout "10 pts buy 9 levels" (and 11 at +10%)', { cost: C.cost, cap: C.capTxt, capA: C.capA })
ok(C.how, 'HOW PRICES WORK explains the focus roll\'s tilt')
ok(/FOCUS\s*−12%\s*THIS SEASON/.test(C.cardTxt), 'the stat card (v142) shows the tilt as a chip', C.cardTxt.slice(0, 160))
ok(!C.dec.length, 'no decimals on the sheet', C.dec)

// ---- d: the result card (the real season wheel)
await setup()
await M(() => {
  window.__hapV193Z = []; const h0 = window.ribHaptic; window.ribHaptic = (k) => { window.__hapV193Z.push(k); try { h0 && h0(k) } catch {} }
  const p = window.__GRIDIRON_AUDIT__.getState().player; p.growthFxV42 = []; delete p.focusTiltV193Z
  window.__GROWTH_V42.showWheel(p, 'season', 'SEASON COMMITMENT · CHECK', () => { window.__doneV193Z = 1 })
})
await page.waitForSelector('#growthV42', { timeout: 5000 })
await page.evaluate(() => document.getElementById('gv42go')?.click())   // the v139 gate
await page.waitForFunction(() => { const o = document.getElementById('gv42out'); return o && o.style.display !== 'none' }, null, { timeout: 25000 })
await page.waitForTimeout(150)
const D0 = await M(() => { const t = document.querySelector('#gv42out .gv-tilt-v193z'); return { txt: t ? t.textContent : '', hap: window.__hapV193Z.slice() } })
await page.evaluate(() => { const b = document.getElementById('gv42go'); b && b.click() })
await page.waitForTimeout(300)
const D = await M(() => { const p = window.__GRIDIRON_AUDIT__.getState().player, Z = window.__V193Z, r = Z.rec(p); return { rec: r && JSON.parse(JSON.stringify(r)), done: window.__doneV193Z, tilts: r ? Object.keys(r.pcts).map((k) => Z.name(k) + ' ' + Z.pctTxt(Z.tilt(k))) : [] } })
const tiltPct = D.rec ? Object.values(D.rec.tilts)[0] : 0
ok(D0.txt && /now, and [−+]\d+% on every/.test(D0.txt) && /this season/.test(D0.txt) && !DEC.test(D0.txt), 'the season wheel\'s result card says what the tilt will do ("… −6% now, and −12% on every … point you spend this season")', D0.txt)
ok(D.done && D.rec && D.tilts.length && D0.txt.includes(Math.abs(Math.round(tiltPct * 100)) + '% on every'), 'resolving it sets the tilt the card named', { tilts: D.tilts })
ok(D0.hap.includes(tiltPct < 0 ? 'warning' : 'success'), 'the result buzzes (' + (tiltPct < 0 ? 'warning' : 'success') + ')', D0.hap)

// ---- e: the season end, a new career
await setup()
const E = await M((OUT) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.getState(), p = S.player, mk = eval(OUT), r = {}
  try { A.startSeasonGames ? A.startSeasonGames() : window.startSeasonGames() } catch (e) { r.err0 = String(e) }
  document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove()
  window.__GROWTH_V42.applyOutcome(p, mk(['speed'], -1, 6))
  r.before = window.__V193Z.tilt('speed'); r.ts0 = p.totalSeasons
  ;(p.weekResults || []).forEach((w) => { w.played = true; w.perf = 40; w.us = 7; w.them = 21; w.won = false })
  try { window.finishSeasonGames() } catch (e) { r.err = String(e) }
  r.ts1 = p.totalSeasons; r.view = S.view; r.after = window.__V193Z.tilt('speed'); r.field = 'focusTiltV193Z' in p
  // a new career: a fresh player carries none; a stale record copied across is not read
  const q = A.newPlayer(); r.fresh = 'focusTiltV193Z' in q
  q.focusTiltV193Z = { season: q.totalSeasons | 0, career: (S.careers | 0) - 1, pcts: { speed: -6 }, tilts: { speed: -0.12 }, carry: {} }
  S.player = q; r.stale = window.__V193Z.tilt('speed')
  return r
}, OUT)
ok(E.before === -0.12 && E.ts1 === E.ts0 + 1 && E.after === 0 && !E.field && !E.err, 'the real season end (finishSeasonGames → simSeason) clears the tilt', E)
ok(!E.fresh && E.stale === 0, 'a new career starts with none (and a stale record from another career is never read)', { fresh: E.fresh, stale: E.stale })

// ---- f: the Focus Amplifier
await setup()
const F = await M((OUT) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.getState(), p = S.player, mk = eval(OUT), Z = window.__V193Z, N = A.TREE_NODES, r = {}
  const n = N && N.focusAmpV193Z
  r.node = n && { branch: n.branch, cost: n.cost, mult: n.mult, max: n.max, fx: n.fx, desc: n.desc }
  S.honorsV156A = Object.assign({}, S.honorsV156A || {}, { floor: 99 }); S.pp = 1e6
  window.RIB_TUNE.quickVaultV193U = 0
  const pp0 = S.pp
  window.__V193L.buy('focusAmpV193Z')
  delete window.RIB_TUNE.quickVaultV193U
  r.lv = S.tree.focusAmpV193Z | 0; r.paid = pp0 - S.pp
  r.mult = Z.mult(); r.cap = Z.cap()
  window.__GROWTH_V42.applyOutcome(p, mk(['speed'], -1, 6)); r.tilt = Z.tilt('speed')
  window.__GROWTH_V42.applyOutcome(p, mk(['strength'], 1, 30)); r.capPos = Z.tilt('strength')
  window.go('upgrade'); const l = document.getElementById('focusLineV193Z'); r.line = l ? l.textContent.replace(/\s+/g, ' ') : ''
  window.go('shop'); const tab = [...document.querySelectorAll('.branch-tab')].find((x) => /Mental/.test(x.textContent)); tab && tab.click()
  r.shop = /Focus Amplifier/.test(document.getElementById('screen').textContent)
  S.tree = {}; r.mult0 = Z.mult()
  return r
}, OUT)
ok(F.node && F.node.branch === 'mental' && F.node.cost > 0 && F.node.max === 6 && F.node.fx && F.node.fx.focusAmpV193Z === 1 && /a good roll pays more, a bad one costs more/.test(F.node.desc), 'FOCUS AMPLIFIER is a Mental node with a real price, 6 levels, read through treeFx; its desc names both sides', F.node)
ok(F.lv === 1 && F.paid > 0, 'it is bought through QUICK BUY (the plain purchase), at its price', { lv: F.lv, paid: F.paid })
ok(F.mult === 2.5 && Math.abs(F.tilt + 0.15) < 1e-9, 'Lv 1 → ×2.5: a −6% roll tilts −15%', { mult: F.mult, tilt: F.tilt })
ok(Math.abs(F.cap - 0.5) < 1e-9 && Math.abs(F.capPos - 0.5) < 1e-9, 'the cap scales with it (20% × 2.5 = 50%) — never silently capped away', { cap: F.cap, capPos: F.capPos })
ok(/Focus roll ×2\.5:/.test(F.line) && /Speed −15%/.test(F.line), 'the sheet header names ×2.5', F.line)
ok(F.shop && F.mult0 === 2, 'the prestige screen draws it; without it the multiplier is ×2', { shop: F.shop, mult0: F.mult0 })

// ---- g: the kill switch
await setup()
const K = await M((OUT) => {
  const S = window.__GRIDIRON_AUDIT__.getState(), p = S.player, mk = eval(OUT), Z = window.__V193Z, r = {}
  window.__GROWTH_V42.applyOutcome(p, mk(['speed'], -1, 6))
  window.RIB_TUNE.v193Z = 0
  window.go('upgrade'); p.points = 10; const v0 = p.attrs.speed
  for (let i = 0; i < 20; i++) window.alloc('speed', 1)
  r.levels = p.attrs.speed - v0; r.tilt = Z.tilt('speed'); r.line = !!document.getElementById('focusLineV193Z'); r.chip = !!document.querySelector('#tilt-speed .up-tilt-v193z')
  delete p.focusTiltV193Z
  window.__GROWTH_V42.applyOutcome(p, mk(['agility'], 1, 6)); r.set = 'focusTiltV193Z' in p
  delete window.RIB_TUNE.v193Z
  return r
}, OUT)
ok(K.levels === 10 && K.tilt === 0 && !K.line && !K.chip && !K.set, 'TU v193Z 0: the old prices (10 points, 10 levels), no chip, no header, no tilt set', K)

ok(!errs.length, 'no page errors', errs.slice(0, 3))
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
