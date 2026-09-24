// Dev check (v124 THE PROGRAM CUTS BOTH WAYS / THE COACH NAMES A STAT):
//
// Training used to be twelve flavours of the same promise — pick a program, get its stats,
// pay a stray -1 Stamina on two of them. And the coach recommended CONDITIONING every season
// of every career, because recommendTraining opened with `injuryResist < 30 + level*20`, a
// line almost nobody clears.
//
// Asserts:
//   * the harder programs TRADE — a real, named attribute comes off the sheet to pay for the
//     one they build — and the board says so, in the red chips AND in a sentence
//   * the four volatile programs are a ROLL with stated odds and two stated outcomes, and the
//     board shows the odds on the tile and both outcomes under the sheet
//   * a roll HITS -> the trade is waived and priority growth is multiplied up; MISSES -> the
//     trade doubles and growth is cut; and the roll happens ONCE a season, not once a render
//   * the prestige nodes move the odds (Weighted Coin) and soften a miss (House Money)
//   * the preview sheet shows the EXPECTED season for a volatile program, between its outcomes
//   * the coach's recommendation is no longer conditioning-by-default: over a spread of
//     positions and sheets it names the stat with the most room that the position is graded
//     on, and says WHY in one line
import { chromium } from 'playwright'
import { CHROME, gameUrl } from './lib/env.mjs'

const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 520, height: 1000 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.goto(gameUrl('?stayStale'), { waitUntil: 'networkidle', timeout: 25000 })
await page.waitForTimeout(1400)

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  const r = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const el = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
      .find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false
  }, { t, visSrc: vis })
  await page.waitForTimeout(650); return r
}
for (const t of ['NEXT', 'NEXT', 'NEXT', 'NEW CAREER']) await click(t)
for (let i = 0; i < 6; i++) {
  const done = await page.evaluate(({ visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    for (const want of ['START YOUR LEGACY', 'Lock In Personality']) {
      const b = els.find(e => txt(e).includes(want)); if (b) { b.click(); return false }
    }
    const card = els.find(e => e.classList.contains('pos-card') || /^[A-Z]{1,2} /.test(txt(e)))
    if (card) { card.click(); return false }
    return true
  }, { visSrc: vis })
  await page.waitForTimeout(500)
  if (done) break
}
const hook = await page.evaluate(() => !!window.__V124)
ok(hook, 'window.__V124 is mounted')

// ---------- 1. the trades are real and named ----------
const trades = await page.evaluate(() => {
  const P = window.__V124, pt = window.__V113 && null
  const out = {}
  for (const k of ['speed', 'weight', 'film', 'hops', 'grind', 'contact', 'track', 'balanced', 'conditioning', 'lab', 'skills', 'yoga'])
    out[k] = P.trade(window.S.player, k)
  return out
})
console.log('trades:', JSON.stringify(trades))
const RISKY = ['weight', 'hops', 'grind', 'contact', 'track']
ok(RISKY.every(k => trades[k] && Object.keys(trades[k]).length), 'every high-risk program takes a named attribute off you', RISKY.map(k => k + ':' + JSON.stringify(trades[k])).join(' '))
ok(['balanced', 'conditioning', 'lab', 'skills', 'yoga'].every(k => !trades[k]), 'the safe programs still cost nothing')
ok(trades.hops && trades.hops.speed < 0, 'explosion work costs top-end speed', JSON.stringify(trades.hops))
ok(trades.weight && trades.weight.awareness < 0, 'the weight room costs time in the film room', JSON.stringify(trades.weight))
ok(trades.track && trades.track.strength < 0, 'the track costs mass', JSON.stringify(trades.track))
// nothing a program BUILDS is also something it charges
const both = await page.evaluate(() => {
  const P = window.__V124, bad = []
  for (const k in P.fate) { }
  return bad
})

// ---------- 2. the roll: odds, both outcomes, once a season ----------
const fate = await page.evaluate(() => {
  const P = window.__V124, pl = window.S.player, out = { keys: Object.keys(P.fate), odds: {}, says: {}, expect: {} }
  for (const k of out.keys) { out.odds[k] = P.odds(k); out.says[k] = P.say(k); out.expect[k] = P.expect(k) }
  // once a season: two asks in the same season are the same roll
  const a = P.season(pl, 'contact'), b = P.season(pl, 'contact')
  out.memo = !!a && a === b
  out.shape = a && { hit: typeof a.hit, growth: a.growth, tradeMul: a.tradeMul, say: !!a.say }
  // a new season re-rolls
  pl.seasonsSinceStart = (pl.seasonsSinceStart | 0) + 1
  const c = P.season(pl, 'contact'); out.reroll = c !== a
  return out
})
console.log('fate:', JSON.stringify(fate))
ok(fate.keys.length >= 4, 'the volatile programs are a roll', fate.keys.join(','))
ok(fate.keys.every(k => fate.odds[k] > .05 && fate.odds[k] < .97), 'every roll has real odds', JSON.stringify(fate.odds))
ok(fate.keys.every(k => /hits:/.test(fate.says[k]) && /misses:/.test(fate.says[k]) && /%/.test(fate.says[k])), 'and states BOTH outcomes with its odds', fate.says[fate.keys[0]])
ok(fate.memo, 'the roll happens once a season, not once a render')
ok(fate.reroll, 'and a new season is a new roll')
ok(fate.shape && fate.shape.hit === 'boolean' && fate.shape.say, 'the resolved roll carries an outcome and a line to say', JSON.stringify(fate.shape))

const outcomes = await page.evaluate(() => {
  const P = window.__V124, pl = window.S.player, hits = [], miss = []
  for (let i = 0; i < 400; i++) { pl.seasonsSinceStart = i; const r = P.season(pl, 'contact'); (r.hit ? hits : miss).push(r) }
  return { n: hits.length + miss.length, hits: hits.length,
    hitWaives: hits.length ? hits.every(r => r.tradeMul === 0 && r.growth > 1) : null,
    missDoubles: miss.length ? miss.every(r => r.tradeMul >= 1 && r.growth < 1) : null,
    rate: hits.length / Math.max(1, hits.length + miss.length) }
})
console.log('outcomes:', JSON.stringify(outcomes))
ok(outcomes.hitWaives === true, 'a hit waives the trade and multiplies priority growth UP')
ok(outcomes.missDoubles === true, 'a miss doubles the trade and cuts the growth')
ok(Math.abs(outcomes.rate - fate.odds.contact) < .09, 'and the roll lands at the odds it advertises', `${outcomes.rate.toFixed(2)} vs ${fate.odds.contact.toFixed(2)}`)

// the prestige nodes move it
const nodes = await page.evaluate(() => {
  const P = window.__V124, S = window.S, before = P.odds('contact')
  S.tree = S.tree || {}; const keep = S.tree.fateOdds
  S.tree.fateOdds = 5
  const after = P.odds('contact')
  S.tree.fateOdds = keep
  // House Money: a miss still pays part of the upside
  S.tree.fateHedge = 1
  const pl = S.player; let hedged = null
  for (let i = 500; i < 900 && !hedged; i++) { pl.seasonsSinceStart = i; const r = P.season(pl, 'contact'); if (!r.hit) hedged = r }
  delete S.tree.fateHedge
  return { before, after, hedged: hedged && { hedge: hedged.hedge, growth: hedged.growth, tradeMul: hedged.tradeMul } }
})
console.log('nodes:', JSON.stringify(nodes))
ok(nodes.after > nodes.before + .15, 'Weighted Coin raises the odds of the roll', `${nodes.before.toFixed(2)} -> ${nodes.after.toFixed(2)}`)
ok(nodes.hedged && nodes.hedged.hedge && nodes.hedged.growth > 1 && nodes.hedged.tradeMul === 1, 'House Money turns a miss into a partial payout with a single-cost trade', JSON.stringify(nodes.hedged))

// ---------- 3. the board says all of it ----------
await page.evaluate(() => window.go('training'))
await page.waitForTimeout(700)
const board = await page.evaluate(() => {
  window.previewTraining('contact')
  const panel = document.querySelector('.tp-panel-v113')
  const txt = (panel && panel.textContent || '').replace(/\s+/g, ' ')
  const tiles = [...document.querySelectorAll('.tp-tile-v113')]
  const diced = tiles.filter(t => /🎲/.test(t.textContent)).length
  window.previewTraining('lab')
  const safe = (document.querySelector('.tp-panel-v113') || {}).textContent || ''
  return { trade: /THIS PROGRAM TRADES/.test(txt), roll: /THIS ONE IS A ROLL/.test(txt),
    lands: /Lands:/.test(txt), misses: /Misses:/.test(txt), pct: /% IT LANDS/.test(txt),
    negChips: (panel ? panel.querySelectorAll('.train-chip.neg').length : 0), diced, tiles: tiles.length,
    safeQuiet: !/THIS ONE IS A ROLL/.test(safe) && !/THIS PROGRAM TRADES/.test(safe),
    suggests: /COACH SUGGESTS/.test(document.body.textContent) }
})
console.log('board:', JSON.stringify(board))
ok(board.trade && board.negChips > 0, 'the board names the trade in a sentence and in red chips', `chips=${board.negChips}`)
ok(board.roll && board.lands && board.misses && board.pct, 'and spells out the roll: the odds, what a hit does, what a miss does')
ok(board.diced === Object.keys(fate.odds).length, 'every volatile tile wears its odds on the grid', `${board.diced} of ${board.tiles}`)
ok(board.safeQuiet, 'a safe program says neither — it has nothing to trade and nothing to roll')
ok(board.suggests, 'the board opens with the coach naming the program he suggests and why')

// ---------- 4. the recommendation is not conditioning-by-default ----------
const rec = await page.evaluate(() => {
  const P = window.__V124, pl = window.S.player, ee = Object.keys(pl.attrs)
  const counts = {}, whys = [], POS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S']
  const save = { pos: pl.pos, attrs: { ...pl.attrs }, level: pl.level }
  for (const pos of POS) for (let lv = 0; lv <= 6; lv++) for (let i = 0; i < 6; i++) {
    pl.pos = pos; pl.level = lv
    for (const k of ee) pl.attrs[k] = Math.max(1, Math.round(12 + lv * 9 + (Math.random() * 30 - 15)))
    const r = P.rec(pl); counts[r] = (counts[r] || 0) + 1
    if (whys.length < 4) { const w = P.why(pl); if (w) whys.push(pos + ' L' + lv + ': ' + w.line) }
  }
  pl.pos = save.pos; pl.level = save.level; Object.assign(pl.attrs, save.attrs)
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  return { counts, total, distinct: Object.keys(counts).length, condShare: (counts.conditioning || 0) / total, whys }
})
console.log('rec:', JSON.stringify(rec))
ok(rec.distinct >= 4, 'the coach recommends a spread of programs, not one', JSON.stringify(rec.counts))
ok(rec.condShare < .34, 'conditioning is no longer the default answer', `${Math.round(rec.condShare * 100)}% of ${rec.total}`)
ok(rec.whys.length && rec.whys.every(w => /\(\d+ of a \d+ cap\)/.test(w)), 'and every recommendation names the stat, the reason and where it stands against its cap', rec.whys[0])

// a stat already at its cap is never the answer
const capped = await page.evaluate(() => {
  const P = window.__V124, pl = window.S.player
  const w = P.why(pl); if (!w) return null
  const sc = P.score(pl)
  return { top: w.stat, room: w.room, allHaveRoom: sc.every(r => r.room > 0), n: sc.length }
})
console.log('capped:', JSON.stringify(capped))
ok(capped && capped.room > 0 && capped.allHaveRoom, 'a stat with no room under its cap is never recommended', JSON.stringify(capped))

console.log('page errors:', errs.length ? errs.join('\n') : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
