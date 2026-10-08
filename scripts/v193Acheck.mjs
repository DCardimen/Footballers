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
ok(sale.paidD === 62 && sale.ppB - sale.ppA === 62, 'with no player alive the sale pays PP straight (legendary t5 → 62)', JSON.stringify({ paid: sale.paidD, pp: sale.ppB - sale.ppA }))

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
ok(/Lv \d+ · \+\d+%/.test(lk.rowTxt) && /💰 \d+ PP/.test(lk.rowTxt), 'a row shows its level, its +% and its price', lk.rowTxt.replace(/\s+/g, ' '))
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
ok(cmp && /Level \d+ \(received at \d+\) · \+\d+% to every bonus · \+5 every season · sells for \d+ PP/.test(cmp.lv), 'the compare view shows the level line', cmp && cmp.lv)
ok(cmp && /💰 SELL · \+\d+ PP/.test(cmp.btn), 'the compare view sells with the price on the button', cmp && cmp.btn)
ok(cmp && cmp.page <= 1 && cmp.app <= 1, 'and the page still does not scroll with the compare open', cmp && JSON.stringify({ page: cmp.page, app: cmp.app }))
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
console.log(JSON.stringify({ pass, fail }))
console.log('page errors:', errs.length)
await browser.close()
process.exit(fail ? 1 : 0)
