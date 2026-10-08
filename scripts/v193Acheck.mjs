// Dev check (v193 A THE GEAR GROWS, AND SELLS): every piece has a level, the level is a flat % on
// every bonus, a season grows it, and SCRAP became SELL at a price set by the level it was received at.
//
// Asserts: the season hook sits in simSeason's settle (a read of the source); a fresh drop carries
// lvlV193 / lvl0V193 = 1 + tier × 5 and an old piece gets them lazily from its tier; the level multiplier
// reaches BOTH reads (gearFx for the base effect, gearV147 for the rolled modifiers — an integer modifier
// stays an integer) and the kill switch restores the raw numbers and the flat price; the multiplier is
// capped; a season settle adds 5 to every inventory piece AND the equipped copy (matched by id) and drops
// the totals memo; the sell price is by lvl0, not the grown level; a sale pays through the bank while a
// player is alive (and straight to PP with none), removes the piece and refuses an equipped one; a rare+
// piece asks through ribDialog and a common does not; the locker's chip row defaults to the player's
// position, filters the rows (ALL / a position / EQUIPPABLE), says what it hides, carries SELL ALL
// COMMONS, is sticky and sits in the GEAR tab; the compare view shows the level line and a SELL button
// with the price; rows show Lv / +% / price; the locker fits 400x860 with no page scroll; no page errors.
//
// v193 G GEAR THAT STAYS INTERESTING: each rarity has a level ceiling (25 · 40 · 60 · 85 · 110, TU knobs);
// a season stops growing a piece at it, in the bag AND on the body (twin and no twin), a piece received above
// it keeps its level, and TU("v193G", 0) grows past it; the row and the compare panel read Lv N / MAX and
// "maxed — a rarer piece grows further"; a sale during a career is tallied as flat side income (capped at the
// settle by half the career's own pay — a 214 PP mythic against a 100 PP career pays 50), not with the switch
// off; with no player alive a sale pays gearSellIdleShareV193G (half), and the dialog says so.
//
//   node scripts/v193Acheck.mjs        (GAME_URL=… to point it elsewhere)
import { chromium } from 'playwright'
import fs from 'node:fs'
import { CHROME, gameUrl } from './lib/env.mjs'
const url = gameUrl('index.html')
const OUT = process.env.SHOT_DIR || '/tmp/claude-0/shots'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 400, height: 860 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.addInitScript(() => {
  try { localStorage.setItem('rib.coachTour.v119', '0'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
  setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60)
})
const boot = async () => { await page.goto(url + (url.includes('?') ? '&' : '?') + 'stayStale', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200) }
await boot()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps
ok(await page.evaluate(() => !!window.__V193A && !!window.__V147C), 'window.__V193A is mounted')

// ---- 0. the source: the season hook sits in simSeason's settle ----
const src = fs.readFileSync(new URL('../src/07-career-app.js', import.meta.url), 'utf8')
ok(/gearSeasonV193\(\)[^\n]*,\s*\(e\.points \+= \$e\)/.test(src), 'simSeason calls gearSeasonV193 in its settle, right before the points land')
ok(/\/\* ===== v193 A THE GEAR GROWS, AND SELLS =====/.test(src), 'the banner is in 07')

// ---- 1. the level a piece is received at ----
const mk = await page.evaluate(() => {
  const V = window.__V147C, A = window.__GRIDIRON_AUDIT__, S = window.S
  const p = A.newPlayer(S, 'RB'); p.pos = 'RB'; p.level = 3; S.player = p
  const a = V.make(2), b = V.roll({ id: 'lv_t0', rarity: 'common', slot: 'cleats' }, 0), c = V.roll({ id: 'lv_t8', rarity: 'mythic', slot: 'chain' }, 8)
  const old = { id: 'old1', slot: 'gloves', rarity: 'epic', eff: 'ppMult', val: .1, icon: '🧤', modsV147: 1, tierV147: 4, mods: [{ k: 'a_speed', v: 10 }] }
  window.__V193A.ensure(old)
  const pre = { id: 'old2', slot: 'gloves', rarity: 'rare', eff: 'ppMult', val: .1, icon: '🧤' }   // a pre-v147 piece: the roll gives it the tier 0 level
  window.__V147C.ensure(pre)
  return { a: [a.lvlV193, a.lvl0V193, a.tierV147], b: [b.lvlV193, b.lvl0V193], c: [c.lvlV193, c.lvl0V193], old: [old.lvlV193, old.lvl0V193], pre: [pre.lvlV193, pre.lvl0V193] }
})
ok(mk.a[2] === 3 && mk.a[0] === 16 && mk.a[1] === 16, 'a drop at league level 3 is received at level 16 (1 + 3 × 5), lvl = lvl0', JSON.stringify(mk.a))
ok(mk.b[1] === 1 && mk.c[1] === 41, 'tier 0 → level 1, tier 8 → level 41', JSON.stringify([mk.b, mk.c]))
ok(mk.old[0] === 21 && mk.old[1] === 21, 'an old piece with a tier but no level gets 21 from its tier 4, once', JSON.stringify(mk.old))
ok(mk.pre[0] === 1 && mk.pre[1] === 1, 'a pre-v147 piece gets the tier-0 level with its roll', JSON.stringify(mk.pre))

// ---- 2. the multiplier reaches both reads; the kill switch; the cap ----
const mult = await page.evaluate(() => {
  const V = window.__V147C, G = window.__V193A, S = window.S
  const piece = () => ({ id: 'mx1', slot: 'chain', rarity: 'epic', name: 'Phantom Chain', eff: 'power', val: 4, icon: '📿', modsV147: 1, tierV147: 4, mods: [{ k: 'a_speed', v: 10 }, { k: 'p_rushYds', v: .1 }] })
  const A = piece(); S.inventory = [A]; S.equipped = { chain: A }
  const on = { m: G.mult(A), fx: G.fx('power'), sp: V.get('a_speed'), ry: V.get('p_rushYds'), price: G.price(A), pct: G.pct(A) }
  window.RIB_TUNE = window.RIB_TUNE || {}; window.RIB_TUNE.v193A = 0
  const B = piece(); S.equipped = { chain: B }   // a new object: the v147 memo keys on identity
  const off = { m: G.mult(B), fx: G.fx('power'), sp: V.get('a_speed'), ry: V.get('p_rushYds'), price: G.price(B) }
  delete window.RIB_TUNE.v193A
  const C = piece(); C.lvlV193 = 400; C.lvl0V193 = 21; S.equipped = { chain: C }
  const cap = { m: G.mult(C), sp: V.get('a_speed') }
  S.equipped = {}
  return { on, off, cap }
})
ok(near(mult.on.m, 1.21) && mult.on.pct === 21, 'level 21 is ×1.21 (+21%)', JSON.stringify(mult.on))
ok(near(mult.on.fx, 4.84), 'gearFx reads the base effect × the level (4 → 4.84)', mult.on.fx)
ok(mult.on.sp === 12, 'gearV147 reads an integer modifier × the level, rounded (10 → 12)', mult.on.sp)
ok(near(mult.on.ry, .121), 'gearV147 reads a % modifier × the level (.1 → .121)', mult.on.ry)
ok(mult.off.m === 1 && mult.off.fx === 4 && mult.off.sp === 10 && near(mult.off.ry, .1) && mult.off.price === 8, 'TU("v193A", 0): raw numbers and the flat price', JSON.stringify(mult.off))
ok(near(mult.cap.m, 2.5) && mult.cap.sp === 20, 'the multiplier is capped at ×2.5 (then the per-key cap)', JSON.stringify(mult.cap))

// ---- 3. the season settle: the bag and the equipped copy ----
const season = await page.evaluate(() => {
  const V = window.__V147C, G = window.__V193A, S = window.S
  const A = { id: 'sa', slot: 'chain', rarity: 'epic', name: 'Phantom Chain', eff: 'power', val: 4, icon: '📿', modsV147: 1, tierV147: 4, mods: [{ k: 'a_speed', v: 10 }] }
  const B = { id: 'sb', slot: 'cleats', rarity: 'common', name: 'Worn Cleats', eff: 'growth', val: .03, icon: '👟', modsV147: 1, tierV147: 0, mods: [] }
  const L = { id: 'loose', slot: 'gloves', rarity: 'rare', name: 'Custom Gloves', eff: 'ppMult', val: .05, icon: '🧤', modsV147: 1, tierV147: 2, mods: [] }
  S.inventory = [A, B]; S.equipped = { chain: JSON.parse(JSON.stringify(A)), gloves: L }   // the chain is a reload-style copy; the gloves have no twin
  const before = V.get('a_speed'), p0 = G.price(A)
  const n = G.season()
  const after = V.get('a_speed'), p1 = G.price(A)
  const out = { n, before, after, p0, p1, A: [A.lvlV193, A.lvl0V193], B: [B.lvlV193, B.lvl0V193], eq: [S.equipped.chain.lvlV193, S.equipped.chain.lvl0V193], L: [L.lvlV193, L.lvl0V193] }
  S.equipped = {}
  return out
})
ok(season.n === 4, 'the settle touches every piece once (2 in the bag, 2 on the body)', season.n)
ok(season.A[0] === 26 && season.A[1] === 21 && season.B[0] === 6 && season.B[1] === 1, 'every inventory piece grows +5; the level it was received at does not move', JSON.stringify([season.A, season.B]))
ok(season.eq[0] === 26 && season.eq[1] === 21, 'the equipped copy follows its inventory twin by id', JSON.stringify(season.eq))
ok(season.L[0] === 16 && season.L[1] === 11, 'an equipped piece with no twin grows on its own (rare t2: 11 → 16)', JSON.stringify(season.L))
ok(season.before === 12 && season.after === 13, 'the totals memo is dropped: the read moves with the level (12 → 13)', `${season.before} → ${season.after}`)
ok(season.p0 === 21 && season.p1 === 21, 'the sell price is by the level RECEIVED (21 → 8 × 2.68 = 21), not the grown one', `${season.p0} → ${season.p1}`)

// ---- 4. the price table ----
const prices = await page.evaluate(() => {
  const G = window.__V193A
  const mk = (r, t) => G.price({ id: 'pr_' + r + t, slot: 'chain', rarity: r, eff: 'power', val: 1, modsV147: 1, tierV147: t, mods: [] })
  return { c0: mk('common', 0), r0: mk('rare', 0), e3: mk('epic', 3), l5: mk('legendary', 5), m8: mk('mythic', 8) }
})
ok(prices.c0 === 1 && prices.r0 === 3 && prices.e3 === 18 && prices.l5 === 62 && prices.m8 === 214, 'the price table: 1 · 3 · 18 · 62 · 214 (common t0, rare t0, epic t3, legendary t5, mythic t8)', JSON.stringify(prices))

// ---- 5. the sale ----
const sale = await page.evaluate(async () => {
  const G = window.__V193A, S = window.S
  const A = { id: 'sellA', slot: 'chain', rarity: 'epic', name: 'Phantom Chain', eff: 'power', val: 4, icon: '📿', modsV147: 1, tierV147: 4, mods: [] }
  const B = { id: 'sellB', slot: 'cleats', rarity: 'common', name: 'Worn Cleats', eff: 'growth', val: .03, icon: '👟', modsV147: 1, tierV147: 0, mods: [] }
  const C = { id: 'sellC', slot: 'gloves', rarity: 'rare', name: 'Custom Gloves', eff: 'ppMult', val: .05, icon: '🧤', modsV147: 1, tierV147: 2, mods: [] }
  S.inventory = [A, B, C]; S.equipped = { chain: A }
  const bank0 = S.ppBankV136 || 0, pp0 = S.pp
  const paidB = G.sell('sellB')                       // a common, sold outright
  const bank1 = S.ppBankV136 || 0
  const refused = G.sell('sellA')                     // equipped
  const hasA = !!S.inventory.find(i => i.id === 'sellA'), hasB = !!S.inventory.find(i => i.id === 'sellB')
  // the dialog: a rare+ piece asks, a common does not
  const calls = [], real = window.ribDialog
  window.ribDialog = { confirm: (m, o) => { calls.push({ m, o }); return Promise.resolve(false) } }
  const askedC = await G.ask('sellC')
  const stillC = !!S.inventory.find(i => i.id === 'sellC')
  window.ribDialog = { confirm: (m, o) => { calls.push({ m, o }); return Promise.resolve(true) } }
  const soldC = await G.ask('sellC')
  const goneC = !S.inventory.find(i => i.id === 'sellC')
  const bank2 = S.ppBankV136 || 0
  window.ribDialog = real
  // no player alive: the sale pays PP straight
  S.equipped = {}; S.player = null
  S.inventory = [{ id: 'sellD', slot: 'chain', rarity: 'legendary', name: 'Golden Chain', eff: 'power', val: 4, icon: '📿', modsV147: 1, tierV147: 5, mods: [] }]
  const ppA = S.pp, paidD = G.sell('sellD'), ppB = S.pp
  return { paidB, bank0, bank1, refused, hasA, hasB, askedC, stillC, soldC, goneC, bank2, calls: calls.map(c => ({ t: c.o && c.o.title, ok: c.o && c.o.ok, m: c.m })), pp0, ppA, paidD, ppB }
})
ok(sale.paidB === 1 && sale.bank1 - sale.bank0 === 1 && !sale.hasB, 'a common sells on the tap for +1, banked through the career, and leaves the bag', JSON.stringify({ paid: sale.paidB, bank: sale.bank1 - sale.bank0 }))
ok(sale.refused === 0 && sale.hasA, 'an equipped piece is refused', JSON.stringify({ refused: sale.refused, hasA: sale.hasA }))
ok(sale.askedC === 0 && sale.stillC && sale.calls.length === 2 && sale.calls[0].t === 'Sell gear' && /\+6 PP/.test(sale.calls[0].ok), 'a rare piece asks through ribDialog (title "Sell gear", the price on the button) and a "no" keeps it', JSON.stringify(sale.calls[0]))
ok(sale.soldC === 6 && sale.goneC && sale.bank2 - sale.bank1 === 6, 'a "yes" sells it for +6 (3 × (1 + 11 × .08) = 5.64) through the bank', JSON.stringify({ sold: sale.soldC, bank: sale.bank2 - sale.bank1 }))
ok(sale.paidD === 31 && sale.ppB - sale.ppA === 31, 'with no player alive the sale pays PP straight, at the v193 G idle share (legendary t5: 62 → 31)', JSON.stringify({ paid: sale.paidD, pp: sale.ppB - sale.ppA }))

// ---- 5b. v193 G: the rarity ceilings ----
const ceil = await page.evaluate(() => {
  const G = window.__V193A, H = window.__V193G, S = window.S, A = window.__GRIDIRON_AUDIT__
  const p = A.newPlayer(S, 'RB'); p.pos = 'RB'; p.level = 3; S.player = p
  const maxes = ['common', 'rare', 'epic', 'legendary', 'mythic'].map(r => H.max(r))
  window.RIB_TUNE = window.RIB_TUNE || {}; window.RIB_TUNE.gearLvlMaxEpicV193G = 33
  const knob = H.max('epic'); delete window.RIB_TUNE.gearLvlMaxEpicV193G
  // a common one season short of its ceiling, in the bag with an equipped twin; a rare on the body with no twin
  const C = { id: 'cc', slot: 'cleats', rarity: 'common', name: 'Worn Cleats', eff: 'growth', val: .03, icon: '👟', modsV147: 1, tierV147: 0, mods: [], lvl0V193: 1, lvlV193: 22 }
  const R = { id: 'rr', slot: 'gloves', rarity: 'rare', name: 'Custom Gloves', eff: 'ppMult', val: .05, icon: '🧤', modsV147: 1, tierV147: 2, mods: [], lvl0V193: 11, lvlV193: 38 }
  const Hi = { id: 'hi', slot: 'chain', rarity: 'common', name: 'Worn Chain', eff: 'power', val: 1, icon: '📿', modsV147: 1, tierV147: 8, mods: [] }   // received at 41, above common's 25
  S.inventory = [C, Hi]; S.equipped = { cleats: JSON.parse(JSON.stringify(C)), gloves: R }
  G.season()
  const s1 = { C: C.lvlV193, eqC: S.equipped.cleats.lvlV193, R: R.lvlV193, Hi: [Hi.lvlV193, Hi.lvl0V193] }
  G.season(); G.season()
  const s3 = { C: C.lvlV193, eqC: S.equipped.cleats.lvlV193, R: R.lvlV193, Hi: Hi.lvlV193 }
  const txt = { C: H.lvlTxt(C), maxedC: H.maxed(C), Hi: H.lvlTxt(Hi), maxedHi: H.maxed(Hi), mult: G.mult(C) }
  // the kill switch: no ceiling
  window.RIB_TUNE.v193G = 0
  G.season()
  const off = { C: C.lvlV193, eqC: S.equipped.cleats.lvlV193, R: R.lvlV193, max: H.max('common'), txt: H.lvlTxt(C) }
  delete window.RIB_TUNE.v193G
  // the hard cap still holds for a mythic at its ceiling
  const M = { id: 'mm', slot: 'chain', rarity: 'mythic', name: 'GOAT Chain', eff: 'power', val: 1, icon: '📿', modsV147: 1, tierV147: 8, mods: [], lvl0V193: 41, lvlV193: 400 }
  const capM = G.mult(M)
  S.equipped = {}; S.inventory = []
  return { maxes, knob, s1, s3, txt, off, capM }
})
ok(ceil.maxes.join(' ') === '25 40 60 85 110', 'each rarity has its own level ceiling: 25 · 40 · 60 · 85 · 110', ceil.maxes.join(' '))
ok(ceil.knob === 33, 'the ceiling is a TU knob (gearLvlMaxEpicV193G)', ceil.knob)
ok(ceil.s1.C === 25 && ceil.s1.eqC === 25, 'a season grows a common in the bag only up to its ceiling (22 → 25, not 27), and its equipped copy agrees', JSON.stringify(ceil.s1))
ok(ceil.s1.R === 40, 'an equipped piece with no twin stops at its ceiling too (rare 38 → 40)', ceil.s1.R)
ok(ceil.s1.Hi[0] === 41 && ceil.s1.Hi[1] === 41 && ceil.s3.Hi === 41, 'a piece received above its ceiling keeps its level and does not grow (common t8: 41)', JSON.stringify(ceil.s1.Hi))
ok(ceil.s3.C === 25 && ceil.s3.eqC === 25 && ceil.s3.R === 40, 'more seasons do not move a maxed piece, in the bag or on the body', JSON.stringify(ceil.s3))
ok(ceil.txt.C === '25 / 25' && ceil.txt.maxedC && ceil.txt.Hi === '41 / 41' && ceil.txt.maxedHi && near(ceil.txt.mult, 1.25), 'the level reads N / MAX, maxed at the ceiling (×1.25 for a maxed common)', JSON.stringify(ceil.txt))
ok(ceil.off.C === 30 && ceil.off.eqC === 30 && ceil.off.R === 45 && ceil.off.max === Infinity && ceil.off.txt === '30', 'TU("v193G", 0): no ceilings, the pieces grow past them (25 → 30, 40 → 45)', JSON.stringify(ceil.off))
ok(near(ceil.capM, 2.5), 'the ×2.5 hard cap stays', ceil.capM)

// ---- 5c. v193 G: a sale is flat side income during a career; the idle sale pays the share ----
const flat = await page.evaluate(async () => {
  const G = window.__V193A, H = window.__V193G, S = window.S, B = window.__V136_C
  const myth = id => ({ id, slot: 'chain', rarity: 'mythic', name: 'GOAT Chain', eff: 'power', val: 4, icon: '📿', modsV147: 1, tierV147: 8, mods: [] })
  S.ppBankV136 = 0; S.ppBankFlatV192A = 0; S.ppBankLogV136 = []; S.equipped = {}
  S.inventory = [myth('fm1')]
  const price = G.price(S.inventory[0]), now = H.now(price)
  const paid = G.sell('fm1')
  const tally = { bank: S.ppBankV136, flat: S.ppBankFlatV192A, isFlat: H.flat('scrap') }
  // the settle: the career paid 100, so the side money pays up to 50
  const pp0 = S.pp, flushed = B.flush(100), settled = S.pp - pp0
  // with the switch off a sale is not flat
  window.RIB_TUNE = window.RIB_TUNE || {}; window.RIB_TUNE.v193G = 0
  S.inventory = [myth('fm2')]
  const paidOff = G.sell('fm2'), offFlat = S.ppBankFlatV192A || 0, offIsFlat = H.flat('scrap')
  B.flush(null)
  // no player alive, switch off: the full price straight
  const keep = S.player; S.player = null
  S.inventory = [myth('fm3')]; const ppO = S.pp, paidIdleOff = G.sell('fm3'), gotIdleOff = S.pp - ppO
  delete window.RIB_TUNE.v193G
  // no player alive, switch on: the share, and the dialog says so
  S.inventory = [myth('fm4')]; const ppI = S.pp
  const calls = [], real = window.ribDialog
  window.ribDialog = { confirm: (m, o) => { calls.push({ m, o }); return Promise.resolve(true) } }
  const paidIdle = await G.ask('fm4'), gotIdle = S.pp - ppI
  // and during a career the dialog says the PP is banked and capped
  S.player = keep; S.inventory = [myth('fm5')]
  await G.ask('fm5')
  window.ribDialog = real
  B.flush(null)
  S.inventory = []
  return { price, now, paid, tally, flushed, settled, paidOff, offFlat, offIsFlat, paidIdleOff, gotIdleOff, paidIdle, gotIdle, idleMsg: calls[0] && calls[0].m, idleOk: calls[0] && calls[0].o.ok, liveMsg: calls[1] && calls[1].m, liveOk: calls[1] && calls[1].o.ok }
})
ok(flat.price === 214 && flat.now === 214 && flat.paid === 214, 'during a career a mythic t8 sells for its full 214 PP, banked', JSON.stringify({ price: flat.price, now: flat.now, paid: flat.paid }))
ok(flat.tally.isFlat && flat.tally.bank === 214 && flat.tally.flat === 214, 'the sale is tallied as flat side income (ppBankFlatV192A)', JSON.stringify(flat.tally))
ok(flat.flushed === 50 && flat.settled === 50, 'at the settle it pays up to half the career\'s own pay (a 100 PP career: 50 of the 214)', JSON.stringify({ flushed: flat.flushed, settled: flat.settled }))
ok(flat.paidOff === 214 && flat.offFlat === 0 && !flat.offIsFlat, 'TU("v193G", 0): a sale is not flat', JSON.stringify({ paid: flat.paidOff, flat: flat.offFlat }))
ok(flat.paidIdleOff === 214 && flat.gotIdleOff === 214, 'TU("v193G", 0): the idle sale pays the full price straight', JSON.stringify({ paid: flat.paidIdleOff, got: flat.gotIdleOff }))
ok(flat.paidIdle === 107 && flat.gotIdle === 107 && /\+107 PP/.test(flat.idleOk || ''), 'with no player alive a sale pays the idle share (214 → 107), quoted on the button', JSON.stringify({ paid: flat.paidIdle, got: flat.gotIdle, ok: flat.idleOk }))
ok(/Between careers a sale pays half of the price/.test(flat.idleMsg || ''), 'the idle dialog says plainly that between careers you get half', flat.idleMsg)
ok(/\+214 PP/.test(flat.liveOk || '') && /PP is banked/.test(flat.liveMsg || '') && /up to half of what the career itself pays/.test(flat.liveMsg || ''), 'the career dialog says the PP is banked and side income pays up to half the career\'s own pay', flat.liveMsg)

// ---- 6. the locker: the chip row, the rows, the compare view ----
await page.evaluate(() => {
  const S = window.S, V = window.__V147C, A = window.__GRIDIRON_AUDIT__
  const p = A.newPlayer(S, 'RB'); p.pos = 'RB'; p.level = 2; S.player = p
  S.inventory = []; S.equipped = {}; window.__V193A.filter(null)
  const R = ['common', 'rare', 'epic', 'legendary', 'mythic'], slots = ['cleats', 'gloves', 'chain'], eff = ['power', 'perfFlat', 'ppMult', 'growth', 'injDown', 'startAll', 'pointsFlat']
  for (let i = 0; i < 24; i++) S.inventory.push(V.roll({ id: 'lk_' + i, slot: slots[i % 3], rarity: R[i % 5], name: ['Worn', 'Custom', 'Phantom', 'Golden', 'GOAT'][i % 5] + ' ' + ['Cleats', 'Gloves', 'Chain'][i % 3], eff: eff[i % 7], val: { power: 3, perfFlat: 2, ppMult: .08, growth: .05, injDown: .08, startAll: 3, pointsFlat: 2 }[eff[i % 7]], icon: ['👟', '🧤', '📿'][i % 3] }, i % 8))
  S.equipped = { gloves: S.inventory[4], cleats: S.inventory[3], chain: S.inventory[2] }
  window.go('locker')
})
await page.waitForTimeout(2500)
await page.evaluate(() => { try { document.getElementById('splash')?.remove(); window.closeTeamCreatorV153 && window.closeTeamCreatorV153(); document.getElementById('teamModalV153')?.remove() } catch (e) {} })
await page.waitForTimeout(500)
const measure = () => page.evaluate(() => {
  const a = document.getElementById('app'), sc = document.getElementById('screen'), list = document.querySelector('.gear-list-v147'), bar = document.querySelector('.gear-bar-v193')
  const G = window.__V193A, S = window.S
  const expect = k => S.inventory.filter(it => G.pass(it, k)).length
  return {
    page: document.scrollingElement.scrollHeight - innerHeight, app: a.scrollHeight - a.clientHeight, panelOver: sc.scrollHeight - sc.clientHeight,
    rows: document.querySelectorAll('.gear-row').length, chips: [...document.querySelectorAll('.gear-chips-v193 .gear-chip-v193')].map(b => b.dataset.chip),
    on: (document.querySelector('.gear-chips-v193 .gear-chip-v193.on') || {}).dataset?.chip, current: G.current(),
    expect: { all: expect('all'), RB: expect('RB'), QB: expect('QB'), OL: expect('OL'), eq: expect('eq') },
    sticky: bar && getComputedStyle(bar).position, inGear: !!bar && !bar.closest('.hubv75-sec[data-sec="style"]'),
    sellAll: (document.querySelector('.gear-chip-v193.sell') || {}).textContent || '', commons: G.commons().length,
    rowTxt: (document.querySelector('.gear-row .gr-eff') || {}).innerText || '', empty: (document.querySelector('.gear-empty-v193') || {}).innerText || '',
    sum: (document.querySelector('.gear-sum-v147') || {}).innerText || '', fold: !!document.querySelector('.gear-sum-v147.fold-v193'),
    listH: list ? list.clientHeight : 0, listScrolls: list ? list.scrollHeight > list.clientHeight + 1 : null
  }
})
let lk = await measure()
await page.screenshot({ path: `${OUT}/v193A_locker.png` })
ok(lk.chips.join(' ') === 'all QB RB WRTE OL DLLB DB eq', 'the chip row reads ALL · QB · RB · WR/TE · OL · DL/LB · DB · EQUIPPABLE', lk.chips.join(' '))
ok(lk.on === 'RB' && lk.current === null, "the player's own position is the chip opened first (RB, nothing chosen yet)", JSON.stringify({ on: lk.on, current: lk.current }))
ok(lk.rows === lk.expect.RB && lk.rows > 0 && lk.rows < 24, 'the RB chip shows the pieces live for a RB and hides the rest', `${lk.rows} of 24 (expected ${lk.expect.RB})`)
ok(lk.page <= 1 && lk.app <= 1, 'the locker fits 400x860 with no page scroll', JSON.stringify({ page: lk.page, app: lk.app, panelOver: lk.panelOver }))
ok(lk.sticky === 'sticky' && lk.inGear, 'the heading bar is sticky and sits in the GEAR tab', JSON.stringify({ sticky: lk.sticky, inGear: lk.inGear }))
ok(lk.commons >= 3 && /SELL ALL COMMONS · \+\d+ PP/.test(lk.sellAll), 'SELL ALL COMMONS sits in the heading bar with its total', lk.sellAll.trim())
ok(/Lv \d+ \/ \d+ · \+\d+%/.test(lk.rowTxt) && /💰 \d+ PP/.test(lk.rowTxt), 'a row shows its level, its +% and its price', lk.rowTxt.replace(/\s+/g, ' '))
ok(lk.fold && /TOTAL GEAR BONUSES/.test(lk.sum) && /[+−]\d/.test(lk.sum), 'the totals card folds to one line and still reads as lines', lk.sum.replace(/\s+/g, ' ').slice(0, 100))

await page.click('.gear-chips-v193 .gear-chip-v193[data-chip="all"]')
await page.waitForTimeout(400)
lk = await measure()
ok(lk.rows === 24 && lk.on === 'all' && lk.current === 'all', 'ALL shows every piece', `${lk.rows} rows, on=${lk.on}`)
ok(lk.page <= 1 && lk.app <= 1, 'and the page still does not scroll', JSON.stringify({ page: lk.page, app: lk.app }))
await page.click('.gear-chips-v193 .gear-chip-v193[data-chip="eq"]')
await page.waitForTimeout(400)
lk = await measure()
ok(lk.rows === 21 && lk.expect.eq === 21, 'EQUIPPABLE hides the three equipped pieces', `${lk.rows} rows`)
await page.click('.gear-chips-v193 .gear-chip-v193[data-chip="QB"]')
await page.waitForTimeout(400)
lk = await measure()
ok(lk.rows === lk.expect.QB && (lk.rows > 0 || /hidden/.test(lk.empty)), 'the QB chip filters by what is live for a QB (or says what it hides)', `${lk.rows} rows (expected ${lk.expect.QB}) ${lk.empty.replace(/\s+/g, ' ')}`)
// an empty filter says what it hides
const emptyTxt = await page.evaluate(() => {
  const S = window.S, G = window.__V193A
  const keep = S.inventory; S.inventory = keep.filter(it => it.rarity !== 'common' && it.mods.length && it.mods.every(m => m.k === 'p_passYds' || m.k === 'p_passTD'))
  if (!S.inventory.length) S.inventory = [{ id: 'qbonly', slot: 'chain', rarity: 'rare', name: 'Custom Chain', eff: 'power', val: 1, icon: '📿', modsV147: 1, tierV147: 0, mods: [{ k: 'p_passYds', v: .05 }] }]
  G.filter('OL'); const t = (document.querySelector('.gear-empty-v193') || {}).innerText || ''; const rows = document.querySelectorAll('.gear-row').length
  S.inventory = keep; G.filter('all'); return { t, rows }
})
ok(emptyTxt.rows === 0 && /No piece has a bonus for OL/.test(emptyTxt.t) && /hidden/.test(emptyTxt.t) && /Tap ALL/.test(emptyTxt.t), 'an empty chip says what it is hiding', emptyTxt.t.replace(/\s+/g, ' '))
await page.waitForTimeout(300)
// the compare view
await page.evaluate(() => { const r = [...document.querySelectorAll('.gear-row')].find(x => !/EQUIPPED/.test(x.innerText)); r.querySelector('.gr-info').click() })
await page.waitForTimeout(600)
const cmp = await page.evaluate(() => { const c = document.querySelector('.gear-cmp-v147'); return c ? { txt: c.innerText, lv: (c.querySelector('.gc-lv-v193') || {}).innerText || '', btn: (c.querySelector('.gr-sell-v193') || {}).innerText || '', page: document.scrollingElement.scrollHeight - innerHeight, app: (a => a.scrollHeight - a.clientHeight)(document.getElementById('app')) } : null })
await page.screenshot({ path: `${OUT}/v193A_compare.png` })
ok(cmp && /Level \d+ \/ \d+ \(received at \d+\) · \+\d+% to every bonus · (\+5 every season|maxed — a rarer piece grows further) · sells for \d+ PP \(banked/.test(cmp.lv), 'the compare view shows the level line', cmp && cmp.lv)
ok(cmp && /💰 SELL · \+\d+ PP/.test(cmp.btn), 'the compare view sells with the price on the button', cmp && cmp.btn)
ok(cmp && cmp.page <= 1 && cmp.app <= 1, 'and the page still does not scroll with the compare open', cmp && JSON.stringify({ page: cmp.page, app: cmp.app }))
// v193 G: a maxed piece says so in its row and its compare panel
const maxed = await page.evaluate(async () => {
  const S = window.S, eq = S.equipped
  window.__V193A.filter('all'); await new Promise(r => setTimeout(r, 200))
  const it = S.inventory.find(i => i.rarity === 'common' && !(eq[i.slot] && eq[i.slot].id === i.id) && document.querySelector('.gear-row[data-gear="' + i.id + '"]:not(.sel)'))
  it.lvl0V193 = 1; it.lvlV193 = 25
  window.__V193A.filter('all'); await new Promise(r => setTimeout(r, 200))
  document.querySelector('.gear-row[data-gear="' + it.id + '"] .gr-info').click(); await new Promise(r => setTimeout(r, 300))
  const row = document.querySelector('.gear-row[data-gear="' + it.id + '"]')
  const out = { row: (row.querySelector('.gr-eff') || {}).innerText || '', lv: (row.querySelector('.gc-lv-v193') || {}).innerText || '', btn: (row.querySelector('.gr-sell-v193') || {}).innerText || '', price: window.__V193A.price(it) }
  row.querySelector('.gr-info').click(); await new Promise(r => setTimeout(r, 200))   // close it again: the next test opens a common
  return out
})
ok(/Lv 25 \/ 25/.test(maxed.row) && /maxed — a rarer piece grows further/.test(maxed.row), 'a maxed row reads Lv 25 / 25 and "maxed — a rarer piece grows further"', maxed.row.replace(/\s+/g, ' '))
ok(/Level 25 \/ 25/.test(maxed.lv) && /maxed — a rarer piece grows further/.test(maxed.lv) && !/every season/.test(maxed.lv), 'the compare panel says it is maxed instead of +5 every season', maxed.lv)
ok(new RegExp('sells for ' + maxed.price + ' PP \\(banked').test(maxed.lv) && new RegExp('\\+' + maxed.price + ' PP').test(maxed.btn), "the compare panel's sell line quotes what the sale pays now (banked, during a career)", maxed.lv + ' | ' + maxed.btn)
// SELL from the compare view (a common: no dialog) pays and removes
const sold = await page.evaluate(async () => {
  const S = window.S, G = window.__V193A
  window.__V193A.filter('all'); await new Promise(r => setTimeout(r, 200))
  const row = [...document.querySelectorAll('.gear-row')].find(x => x.classList.contains('r-common') && !/EQUIPPED/.test(x.innerText))
  const id = row.dataset.gear; row.querySelector('.gr-info').click(); await new Promise(r => setTimeout(r, 200))
  const b = document.querySelector('.gear-row.sel .gr-sell-v193'); const price = G.price(S.inventory.find(i => i.id === id)); const bank0 = S.ppBankV136 || 0
  b.click(); await new Promise(r => setTimeout(r, 300))
  return { gone: !S.inventory.find(i => i.id === id), paid: (S.ppBankV136 || 0) - bank0, price, rows: document.querySelectorAll('.gear-row').length }
})
ok(sold.gone && sold.paid === sold.price && sold.rows === 23, 'SELL from the compare view pays the price and removes the piece', JSON.stringify(sold))
// SELL ALL COMMONS through the dialog
const all = await page.evaluate(async () => {
  const S = window.S, G = window.__V193A, real = window.ribDialog
  window.ribDialog = { confirm: () => Promise.resolve(true) }
  const L = G.commons(), total = L.reduce((R, it) => R + G.price(it), 0), bank0 = S.ppBankV136 || 0
  document.querySelector('.gear-chip-v193.sell').click(); await new Promise(r => setTimeout(r, 400))
  window.ribDialog = real
  return { n: L.length, total, paid: (S.ppBankV136 || 0) - bank0, left: G.commons().length, chip: !!document.querySelector('.gear-chip-v193.sell'), rows: document.querySelectorAll('.gear-row').length }
})
ok(all.n >= 3 && all.paid === all.total && all.left === 0 && !all.chip && all.rows === 23 - all.n, 'SELL ALL COMMONS sells every unequipped common for their total and the chip goes', JSON.stringify(all))
// the old name still works
ok(await page.evaluate(() => typeof window.scrapGear === 'function' && window.scrapGear === window.sellGearV193), 'window.scrapGear is the alias of window.sellGearV193')
// the totals card unfolds on a tap
await page.click('.gear-sum-v147')
await page.waitForTimeout(400)
ok(await page.evaluate(() => !document.querySelector('.gear-sum-v147.fold-v193') && /tap to fold/.test(document.querySelector('.gear-sum-v147').innerText)), 'the totals card unfolds on a tap')

// ---- 7. the shell: the list is a real scroll box on a tall screen ----
await page.setViewportSize({ width: 820, height: 760 })
await page.evaluate(() => { window.__V193A.sumToggle(); window.go('menu'); window.go('locker') })
await page.waitForTimeout(1500)
const shell = await page.evaluate(() => {
  const sc = document.getElementById('screen'), list = document.querySelector('.gear-list-v147')
  return { shell: document.documentElement.classList.contains('shell-v146'), one: document.documentElement.classList.contains('one-v170'), over: sc.scrollHeight - sc.clientHeight, listH: list ? list.clientHeight : 0, squeezed: !!(list && list.classList.contains('fill-v146')), rows: document.querySelectorAll('.gear-row').length }
})
await page.screenshot({ path: `${OUT}/v193A_shell.png` })
ok(shell.over <= 2, 'the locker fits the shell at 820x760', JSON.stringify(shell))
ok(!shell.squeezed || shell.listH >= 240 || shell.over > 2, 'when the shell squeezes the list it keeps at least 240px (FILL_MIN_V193)', JSON.stringify({ listH: shell.listH, squeezed: shell.squeezed }))

ok(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '))
// ---- v193 S: the economy stats take a quarter of the level ----
const ec = await page.evaluate(() => {
  const S = window.S, V = window.__V147C
  const it = V.roll({ id: 'ec_pp', slot: 'chain', rarity: 'legendary', eff: 'ppMult', val: 0.2, name: 'Test Chain', icon: '📿' }, 0)
  it.mods = []; it.lvlV193 = 150; it.lvl0V193 = 1
  const sp = { id: 'ec_sp', slot: 'cleats', rarity: 'legendary', eff: 'power', val: 4, name: 'Test Cleats', icon: '👟' }
  const it2 = V.roll(sp, 0); it2.mods = []; it2.lvlV193 = 150; it2.lvl0V193 = 1
  S.inventory = [it, it2]; S.equipped = { chain: it, cleats: it2 }
  const F = window.__V193A.fx, pp = F('ppMult'), pw = F('power')
  window.RIB_TUNE.gearLvlEconShareV193S = 1; const ppFull = F('ppMult'); delete window.RIB_TUNE.gearLvlEconShareV193S
  return { pp, pw, ppFull }
})
ok(near(ec.pp, 0.2 * 1.375, 1e-6) && near(ec.pw, 4 * 2.5, 1e-6), 'v193 S: a maxed piece\'s PP bonus grows ×1.375 (a quarter of the level), every other stat ×2.5', JSON.stringify(ec))
ok(near(ec.ppFull, 0.2 * 2.5, 1e-6), 'v193 S: gearLvlEconShareV193S 1 gives the economy stats the whole level again', JSON.stringify(ec))
console.log(JSON.stringify({ pass, fail }))
console.log('page errors:', errs.length)
await browser.close()
process.exit(fail ? 1 : 0)
