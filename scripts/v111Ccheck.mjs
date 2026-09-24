// Dev check: v111 C — the wear-and-tear section in the body card.
//
// Six claims, each asserted against the real hub in a browser rather than a copy
// of it:
//   1. The section renders inside the condition card with a load reading — a band
//      (LIGHT … BREAKING DOWN), the accumulated load against its scale, and the
//      season's own charge — and the v73 ledger it sits beside is still intact.
//   2. The next game is PRICED at the involvement the week carries: wear added,
//      injury chance, expected games missed, and the rating carried into the game
//      after it. The numbers agree with window.__V111_BODY.read().
//   3. The three drivers are legible — durability, opponent, stakes — each with
//      its multiplier, and a semifinal against a strong side costs more than a
//      routine week against a weak one. Proved twice: once on a week shaped the
//      way the schedule shapes one, and once end to end on a REAL save whose
//      regular season is played out and whose bracket the game itself builds.
//   3b. The card is a window onto window.__V111, not a second opinion: its four
//      numbers are forecast() to the digit, a model saying something unmistakable
//      reaches the pixels unaltered, and the local estimate is still a live
//      fallback when the model is taken away.
//   4. A lingering stat cut with a games countdown appears by name with its
//      remaining games.
//   5. A fresh save — no wear history, no model, nothing played — renders the
//      section without throwing.
//   6. The whole card fits a 400px viewport with no horizontal scroll.
import { chromium } from 'playwright'
import { CHROME, gameUrl } from './lib/env.mjs'

const URL = gameUrl('index.html')
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 400, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => {
  setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60)
})
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1400)

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }

const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  const r = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    const el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false
  }, { t, visSrc: vis })
  await page.waitForTimeout(700); return r
}

// ---- get into a career and onto the hub
await click('START NEW CAREER')
for (let i = 0; i < 8; i++) {
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
  await page.waitForTimeout(450)
  if (done) break
}
await click('PLAY 8-GAME SEASON')
await click('Balanced Program'); await click('CONFIRM TRAINING')
await page.evaluate(() => { document.getElementById('growthV42')?.remove(); window.go('hub') })
await page.waitForTimeout(700)

ok(await page.evaluate(() => !!(window.S && window.S.player)), 'a career is running', await page.evaluate(() => window.S && window.S.player && window.S.player.pos))
ok(await page.evaluate(() => typeof window.__V111_BODY === 'object' && typeof window.__V111_BODY.read === 'function'), 'the hook is mounted', 'window.__V111_BODY')

// ---- 1. the section renders with a load reading, beside an intact v73 ledger
const seed = await page.evaluate(() => {
  const pl = window.S.player, W = pl.weekResults || []
  // a season with a run of heavy weeks behind it and a semifinal ahead
  const keys = ['normal', 'heavy', 'normal', 'everysnap', 'heavy']
  W.slice(0, 5).forEach((w, i) => {
    w.played = true; w.perf = 62 + i; w.us = 24; w.them = 17; w.won = true
    w.usageV111 = keys[i]; w.snaps = 40 + i
  })
  const nx = W.find(w => w && !w.played)
  if (nx) {
    nx.usageV111 = 'heavy'
    // the shape the GAME writes for a bracket game (see cn() — playoff/round/roundIdx AND the
    // opponent row's importance all land together); a week dressed in only one of them is a week
    // the schedule never produces, so the check must not invent one
    const rounds = window.__GRIDIRON_AUDIT__.playoffRoundNames(window.S.player.level) || ['CHAMPIONSHIP']
    nx.playoff = true
    nx.roundIdx = Math.max(0, rounds.length - 2)
    nx.round = rounds[nx.roundIdx] || 'SEMIFINAL'
    nx.opponentV11 = Object.assign({}, nx.opponentV11 || {}, { rating: 96, importance: 'playoff', physicality: 88 })
  }
  // the season is pointed at a championship two weeks out — that is what the
  // decision line has to be about
  const last = W.filter(w => w && !w.played).pop()
  if (last && last !== nx) {
    last.round = 'NATIONAL CHAMPIONSHIP'
    last.opponentV11 = Object.assign({}, last.opponentV11 || {}, { rating: 98, importance: 'championship', physicality: 84 })
  }
  pl._wearV111 = { load: 74, lingering: [] }
  pl.conditionV11 = Object.assign(pl.conditionV11 || {}, { fatigue: 58 })
  window.go('hub')
  return true
})
await page.waitForTimeout(500)

const one = await page.evaluate(() => {
  const card = document.querySelector('.condition-card-v11')
  const sec = card && card.querySelector('.wearv111')
  const R = window.__V111_BODY.read()
  const t = s => (s ? s.textContent.replace(/\s+/g, ' ').trim() : '')
  return {
    inCard: !!sec, ledgerRows: card ? card.querySelectorAll('.bodyv73-row').length : 0,
    netTxt: t(card && card.querySelector('.bodyv73-net')),
    band: t(sec && sec.querySelector('.wearv111-band')),
    num: t(sec && sec.querySelector('.wearv111-num')),
    bars: sec ? sec.querySelectorAll('.wearv111-spark u').length : 0,
    hot: sec ? sec.querySelectorAll('.wearv111-spark u.hot').length : 0,
    story: t(sec && sec.querySelector('.wearv111-sub')),
    load: R.load, season: Math.round(R.season), scale: R.scale, bandName: R.band.n, hist: R.hist.length, hasModel: R.api,
  }
})
console.log('section:', JSON.stringify(one))
ok(one.inCard, 'the wear section renders INSIDE the condition card')
ok(one.ledgerRows >= 3 && /RATING/.test(one.netTxt), 'the v73 ledger beside it is intact', `${one.ledgerRows} rows · "${one.netTxt}"`)
ok(/LIGHT|MANAGED|LOADED|HIGH MILEAGE|BREAKING DOWN/.test(one.band), 'a load BAND is read out, not a raw number', one.band)
ok(/\d/.test(one.num) && /LOAD/.test(one.num) && Math.abs(one.load - 74) < 0.5, 'the accumulated load is shown against its scale', `${one.num} (load=${one.load} scale=${one.scale})`)
ok(/this season/.test(one.band) && one.season > 0, "the season's own charge is stated", one.season + ' this season')
ok(one.bars === one.hist && one.bars >= 5, 'every played week is a bar, so the season is visible', `${one.bars} bars / ${one.hist} charged weeks`)
ok(one.hot >= 1 && /heavy week/.test(one.story), 'the heavy weeks stand out and are named as the reason', `${one.hot} hot bars · "${one.story}"`)

// ---- 2. what the next game costs
const two = await page.evaluate(() => {
  const sec = document.querySelector('.condition-card-v11 .wearv111')
  const cells = [...sec.querySelectorAll('.wearv111-grid > div')].map(d => ({
    v: d.querySelector('b').textContent.trim(), l: d.querySelector('small').textContent.trim(),
  }))
  const R = window.__V111_BODY.read()
  return {
    kick: sec.querySelector('.wearv111-kick').textContent.replace(/\s+/g, ' ').trim(), cells,
    fc: { load: R.fc.load, injPct: R.fc.injPct, gamesMissed: R.fc.gamesMissed, statCut: R.fc.statCut },
  }
})
console.log('next:', JSON.stringify(two))
const cellL = two.cells.map(c => c.l).join('|')
ok(/NEXT GAME/.test(two.kick) && /HEAVY/i.test(two.kick), 'the next game is priced at the involvement the week carries', two.kick)
ok(/WEAR/.test(cellL), 'the wear it adds is shown', two.cells[0] && two.cells[0].v)
ok(/INJURY/.test(cellL) && /%/.test(two.cells.find(c => /INJURY/.test(c.l)).v), 'the injury chance is shown as a percentage', two.cells.find(c => /INJURY/.test(c.l)).v)
ok(/GAMES LOST/.test(cellL), 'the expected games missed is shown', two.cells.find(c => /GAMES/.test(c.l)).v)
ok(/RATING AFTER/.test(cellL), 'the rating he carries into the NEXT game is shown', two.cells.find(c => /RATING/.test(c.l)).v)
const shownInj = parseFloat(two.cells.find(c => /INJURY/.test(c.l)).v)
ok(Math.abs(shownInj - Math.round(two.fc.injPct)) < 0.51, 'the drawn numbers are the forecast, not a second guess', `${shownInj}% vs forecast ${two.fc.injPct.toFixed(2)}%`)
ok(two.fc.gamesMissed >= 0 && two.fc.load > 0, 'the forecast is a real cost', JSON.stringify(two.fc))

// ---- 3. the drivers, and the semifinal costing more than a routine week
const three = await page.evaluate(() => {
  const sec = document.querySelector('.condition-card-v11 .wearv111')
  const drv = [...sec.querySelectorAll('.wearv111-drv span')].map(s => ({
    k: s.querySelector('i').textContent.trim(), mul: s.querySelector('b').textContent.trim(), note: s.querySelector('s').textContent.trim(),
  }))
  const pl = window.S.player, nx = pl.weekResults.find(w => w && !w.played)
  const big = window.__V111_BODY.read()
  // the same week, made a routine game against a weak side. A routine week carries NONE of the
  // bracket markers — leaving `playoff`/`roundIdx` on it while renaming the round is a week the
  // schedule never produces, and would price as a playoff no matter what the label said.
  const keepR = nx.round, keepO = nx.opponentV11, keepP = nx.playoff, keepI = nx.roundIdx
  nx.round = null; delete nx.playoff; delete nx.roundIdx
  nx.opponentV11 = Object.assign({}, keepO, { rating: 44, importance: 'routine', physicality: 30 })
  const small = window.__V111_BODY.read()
  nx.round = keepR; nx.opponentV11 = keepO; nx.playoff = keepP; nx.roundIdx = keepI
  // durability: one more point of injuryResist must not make him more fragile
  const r0 = pl.attrs.injuryResist
  pl.attrs.injuryResist = Math.min(99, r0 + 40)
  const tough = window.__V111_BODY.read()
  pl.attrs.injuryResist = r0
  return { drv, bigLoad: big.fc.load, smallLoad: small.fc.load, toughLoad: tough.fc.load,
    bigStake: big.drivers.find(d => d.k === 'STAKES').mul, smallStake: small.drivers.find(d => d.k === 'STAKES').mul,
    bigOpp: big.drivers.find(d => d.k === 'OPPONENT').mul, smallOpp: small.drivers.find(d => d.k === 'OPPONENT').mul }
})
console.log('drivers:', JSON.stringify(three))
const dk = three.drv.map(d => d.k)
ok(dk.includes('DURABILITY'), 'DURABILITY is drawn as a driver', JSON.stringify(three.drv.find(d => d.k === 'DURABILITY')))
ok(dk.includes('OPPONENT'), 'OPPONENT is drawn as a driver', JSON.stringify(three.drv.find(d => d.k === 'OPPONENT')))
ok(dk.includes('STAKES'), 'STAKES is drawn as a driver', JSON.stringify(three.drv.find(d => d.k === 'STAKES')))
ok(three.drv.every(d => /^×\d/.test(d.mul)), 'every driver carries its multiplier', three.drv.map(d => d.k + d.mul).join(' '))
ok(/semifinal|championship|playoff/i.test(three.drv.find(d => d.k === 'STAKES').note), 'the stakes driver names the fixture', three.drv.find(d => d.k === 'STAKES').note)
ok(three.bigLoad > three.smallLoad * 1.15, 'a semifinal against a strong team is visibly more expensive than a routine week', `${three.bigLoad.toFixed(1)} vs ${three.smallLoad.toFixed(1)}`)
ok(three.bigStake > three.smallStake && three.bigOpp > three.smallOpp, 'both the stakes and the opponent move the price', `stakes ${three.bigStake.toFixed(2)}→${three.smallStake.toFixed(2)} · opp ${three.bigOpp.toFixed(2)}→${three.smallOpp.toFixed(2)}`)
ok(three.toughLoad < three.bigLoad, 'a more durable body is charged less', `${three.toughLoad.toFixed(1)} vs ${three.bigLoad.toFixed(1)}`)

// ---- 4. a lingering cut, named, with its countdown
const four = await page.evaluate(() => {
  const pl = window.S.player
  pl._tempStatBuffsV25 = [{ stat: 'speed', amt: -6, games: 3 }]
  pl._wearV111.lingering = [{ stat: 'strength', amt: -4, games: 1 }]
  window.go('hub')
  const sec = document.querySelector('.condition-card-v11 .wearv111')
  const chips = [...sec.querySelectorAll('.wearv111-ling em')].map(e => e.textContent.replace(/\s+/g, ' ').trim())
  return { chips, n: window.__V111_BODY.read().linger.length }
})
console.log('lingering:', JSON.stringify(four))
ok(four.chips.length === 2 && four.n === 2, 'both lingering cuts are listed', four.chips.length + ' chips')
ok(four.chips.some(c => /SPEED/i.test(c) && /−6|-6/.test(c) && /3 games left/.test(c)), 'the cut is named with its size and its remaining games', four.chips.join(' · '))
ok(four.chips.some(c => /1 game left/.test(c)), 'a one-game cut reads in the singular', four.chips.find(c => /1 game/.test(c)))

// ---- the decision line
const call = await page.evaluate(() => {
  const sec = document.querySelector('.condition-card-v11 .wearv111')
  const el = sec.querySelector('.wearv111-call')
  return { txt: el ? el.textContent.replace(/\s+/g, ' ').trim() : '', bolds: el ? [...el.querySelectorAll('b')].map(b => b.textContent.trim()) : [] }
})
console.log('decision:', JSON.stringify(call))
ok(/%/.test(call.txt) && call.txt.length > 40 && call.txt.length < 330, 'the decision is ONE readable line, not a table', `${call.txt.length} chars`)
ok(/chance of missing/i.test(call.txt) || /last one/i.test(call.txt) || /not playing/i.test(call.txt), 'the line states the tradeoff in words', call.txt)

// ---- 4b. the card is a WINDOW onto the model, not a second opinion
// The model now ships in the same build, so there is no "before the model existed" state left to
// observe it replacing. What matters instead, and what is asserted here, is: (i) every number the
// card draws is window.__V111.forecast() to the digit, (ii) a model saying something unmistakable
// reaches the pixels unaltered, and (iii) the local estimate is still a live fallback — hide the
// model and the card keeps working, restore it and the model is back in charge.
const exact = await page.evaluate(() => {
  const pl = window.S.player, wk = pl.weekResults.find(w => w && !w.played)
  const key = (wk && wk.usageV111) || 'normal'
  const R = window.__V111_BODY.read(), D = window.__V111.forecast(pl, wk, key)
  const sec = document.querySelector('.condition-card-v11 .wearv111')
  const cells = [...sec.querySelectorAll('.wearv111-grid > div')].map(d => d.querySelector('b').textContent.trim())
  const drv = [...sec.querySelectorAll('.wearv111-drv span')].map(s => ({ k: s.querySelector('i').textContent.trim(), mul: s.querySelector('b').textContent.trim() }))
  const sg = v => (v >= 0 ? '+' : '−') + Math.abs(Math.round(v))
  return {
    api: R.api, stub: R.stub, key,
    card: { load: R.fc.load, injPct: R.fc.injPct, gamesMissed: R.fc.gamesMissed, statCut: R.fc.statCut },
    model: { load: D.load, injPct: D.injPct, gamesMissed: D.gamesMissed, statCut: D.statCut },
    cells,
    want: [sg(D.load), Math.round(D.injPct) + '%', (Number(D.gamesMissed) || 0).toFixed(1), sg(D.statCut || 0)],
    drvMul: drv.map(d => d.k + ' ' + d.mul).join(' '),
    wantDrv: 'DURABILITY ×' + D.durMul.toFixed(2) + ' OPPONENT ×' + D.oppMul.toFixed(2) + ' STAKES ×' + D.stakes.toFixed(2),
  }
})
console.log('exact:', JSON.stringify(exact))
ok(exact.api && !exact.stub, 'the card is reading the model, not its own estimate', `api=${exact.api} stub=${exact.stub}`)
ok(JSON.stringify(exact.card) === JSON.stringify(exact.model),
  "every number the card holds is window.__V111.forecast() exactly — not a rounded or re-derived copy",
  JSON.stringify(exact.card) + ' vs ' + JSON.stringify(exact.model))
ok(exact.cells.join('|') === exact.want.join('|'), "and the four drawn cells are those numbers formatted",
  exact.cells.join('|') + ' vs ' + exact.want.join('|'))
ok(exact.drvMul === exact.wantDrv, "the three drivers are the model's own multipliers", exact.drvMul + ' vs ' + exact.wantDrv)

const model = await page.evaluate(() => {
  const realModel = window.__V111
  window.__V111 = {
    KEYS: ['limited', 'reduced', 'normal', 'heavy', 'everysnap'],
    usage: () => ({ key: 'heavy', share: 0.92, touchMul: 1.3, label: 'HEAVY ROTATION', desc: '' }),
    forecast: () => ({
      load: 17.5, fatigueAfter: 61, injPct: 19.4, gamesMissed: 0.42, statCut: -4.1,
      parts: [{ label: 'Body durability', mul: 1.11 }, { label: 'Opponent front', mul: 1.44 }, { label: 'Occasion', mul: 1.6 }],
      stakes: 1.6, oppMul: 1.44, durMul: 1.11,
    }),
  }
  window.go('hub')
  const sec = document.querySelector('.condition-card-v11 .wearv111')
  const cells = [...sec.querySelectorAll('.wearv111-grid > div')].map(d => d.querySelector('b').textContent.trim())
  const drv = [...sec.querySelectorAll('.wearv111-drv span')].map(s => s.querySelector('i').textContent.trim() + ' ' + s.querySelector('b').textContent.trim())
  const after = window.__V111_BODY.read()
  const kick = sec.querySelector('.wearv111-kick').textContent.replace(/\s+/g, ' ').trim()
  // now HIDE the model entirely — the local estimate has to still be a live road, not dead code
  delete window.__V111
  window.go('hub')
  const F = window.__V111_BODY.read()
  const secF = document.querySelector('.condition-card-v11 .wearv111')
  const fb = { api: F.api, stub: F.stub, load: F.fc.load, rendered: !!secF,
    len: secF ? secF.innerHTML.length : 0,
    cells: secF ? [...secF.querySelectorAll('.wearv111-grid > div')].map(d => d.querySelector('b').textContent.trim()) : [],
    band: secF ? secF.querySelector('.wearv111-band').textContent.replace(/\s+/g, ' ').trim() : '',
    err: window.__V111_BODY.lastError }
  // and give the real one back — the rest of the check reads the shipped model, not a hole
  window.__V111 = realModel
  window.go('hub')
  const back = window.__V111_BODY.read()
  return { cells, drv, kick, fb,
    after: { load: after.fc.load, stub: after.stub, api: after.api, label: after.label },
    back: { api: back.api, stub: back.stub, load: back.fc.load } }
})
console.log('model:', JSON.stringify(model))
ok(model.cells.join('|') === '+18|19%|0.4|−4', "the drawn numbers are the MODEL's forecast", model.cells.join(' '))
ok(/HEAVY ROTATION/.test(model.kick), "the model's own involvement label is used", model.kick)
ok(model.drv.join(' ') === 'DURABILITY ×1.11 OPPONENT ×1.44 STAKES ×1.60', "the model's parts[] resolve onto the three drivers however it labels them", model.drv.join(' '))
// the model ships in this build, so the transition the card can actually be caught making is the
// other one: take the model AWAY and the local estimate must still carry the section
ok(model.fb.stub && !model.fb.api && !model.fb.err, 'with no model at all the card falls back to its own estimate', `api=${model.fb.api} stub=${model.fb.stub} err=${model.fb.err || 'none'}`)
ok(model.fb.rendered && model.fb.len > 400 && model.fb.cells.length === 4, 'and the section still renders every cell on that road', `${model.fb.len} chars · ${model.fb.cells.join('|')}`)
ok(/LIGHT|MANAGED|LOADED|HIGH MILEAGE|BREAKING DOWN/.test(model.fb.band) && /estimated/.test(model.fb.band), 'and it SAYS the number is an estimate rather than passing it off as the model', model.fb.band)
ok(model.back.api && !model.back.stub, 'the model takes the card straight back the moment it is there', `api=${model.back.api} stub=${model.back.stub} load=${model.back.load}`)
ok(model.back.load === exact.model.load, 'and it is the same model, answering the same number as before', `${model.back.load} vs ${exact.model.load}`)

// ---- 5. a fresh save with no wear history at all
const five = await page.evaluate(() => {
  const pl = window.S.player
  delete pl._wearV111; pl._tempStatBuffsV25 = null
  pl.weekResults.forEach(w => { w.played = false; w.perf = null; w.us = null; w.them = null; w.won = null; delete w.usageV111 })
  pl.conditionV11 = { fatigue: 0, recovery: 100, mentalLoad: 0 }
  let threw = null
  let html = ''
  try { html = window.__V111_BODY.section() } catch (e) { threw = String(e && e.message || e) }
  window.go('hub')
  const sec = document.querySelector('.condition-card-v11 .wearv111')
  return { threw, len: html.length, rendered: !!sec, bars: sec ? sec.querySelectorAll('.wearv111-spark u').length : -1,
    story: sec ? sec.querySelector('.wearv111-sub').textContent.replace(/\s+/g, ' ').trim() : '',
    band: sec ? sec.querySelector('.wearv111-band').textContent.replace(/\s+/g, ' ').trim() : '' }
})
console.log('fresh:', JSON.stringify(five))
ok(!five.threw, 'a player with no wear history does not throw', five.threw || 'clean')
ok(five.rendered && five.len > 400, 'the section still renders on a fresh save', five.len + ' chars')
ok(five.bars === 0 && /No games on the body yet/.test(five.story), 'it says so instead of drawing an empty chart', five.story)
ok(/LIGHT/.test(five.band), 'a body with nothing on it reads LIGHT', five.band)

// ---- 4c. A REAL PLAYOFF WEEK, IN A REAL SAVE, PRICES ABOVE A REAL REGULAR WEEK
// This is the claim the whole feature rests on, so it is not proved on a week this check dressed
// up. The regular season is PLAYED through the game's own weekly resolver, the bracket is then
// built by the game's own ensurePlayoffs() — so the playoff week under test is an object cn()
// made, with whatever markers cn() chooses to put on it — and both weeks are priced by the model
// against the same body on the same afternoon.
const real = await page.evaluate(() => {
  const AU = window.__GRIDIRON_AUDIT__, pl = window.S.player
  pl._wearV111 = null
  pl.playoffState = null
  // strip every piece of dressing the earlier sections put on this schedule — from here the save
  // is an ordinary unplayed regular season with the opponents the game itself generated
  pl.weekResults = (pl.weekResults || []).filter(w => w && !w.playoff)
  pl.weekResults.forEach(w => {
    w.played = false; w.won = null; w.perf = null; w.us = null; w.them = null; w.injured = false
    delete w.round; delete w.roundIdx; delete w.playoff; delete w.usageV111
    delete w.wearV111; delete w.snapsV111; delete w._wearSpentV111; delete w.satOut
    if (w.opponentV11) delete w.opponentV11.importance
  })
  // play the whole regular season for real
  let guard = 0
  for (;;) {
    const w = (pl.weekResults || []).find(x => x && !x.played && !x.playoff)
    if (!w || guard++ > 40) break
    w.usageV111 = 'normal'
    try { AU.resolveSequentialWeekV11(pl, w, 'balanced') } catch (e) { return { err: String(e).slice(0, 200) } }
    w.played = true; w.won = true            // qualify him — the bracket is what is under test
  }
  const reg = (pl.weekResults || []).filter(w => w && !w.playoff)
  const regular = reg[Math.min(2, reg.length - 1)]        // week three — the fixture the pitch names
  AU.ensurePlayoffs(pl)                      // the game builds the bracket
  const po = (pl.weekResults || []).filter(w => w && w.playoff)
  if (!po.length) return { err: 'ensurePlayoffs built no bracket', state: pl.playoffState }
  const bracket = po[po.length - 1]
  bracket.usageV111 = 'heavy'; regular.usageV111 = 'heavy'
  const V = window.__V111
  const R = V.forecast(pl, regular, 'heavy'), P = V.forecast(pl, bracket, 'heavy')
  // and what the CARD draws, with that real playoff week as the next game
  window.go('hub')
  const sec = document.querySelector('.condition-card-v11 .wearv111')
  const stakeChip = [...sec.querySelectorAll('.wearv111-drv span')].find(s => /STAKES/.test(s.querySelector('i').textContent))
  return {
    markers: { playoff: !!bracket.playoff, roundIdx: bracket.roundIdx, round: bracket.round,
      importance: bracket.opponentV11 && bracket.opponentV11.importance },
    regular: { round: regular.round || null, load: R.load, stakes: R.stakes, label: R.stakesLabel },
    playoff: { load: P.load, stakes: P.stakes, label: P.stakesLabel },
    normalPlayoff: V.forecast(pl, bracket, 'normal').load,
    kick: sec.querySelector('.wearv111-kick').textContent.replace(/\s+/g, ' ').trim(),
    stakeChip: stakeChip ? stakeChip.querySelector('b').textContent.trim() + ' ' + stakeChip.querySelector('s').textContent.trim() : null,
  }
})
console.log('realSave:', JSON.stringify(real))
ok(!real.err, 'the regular season plays and the bracket builds on a real save', real.err || 'clean')
ok(real.markers && real.markers.playoff === true && real.markers.roundIdx != null && !!real.markers.round,
  'the bracket week the GAME built carries the markers the model reads', JSON.stringify(real.markers))
ok(real.playoff.stakes > real.regular.stakes,
  'a real playoff week carries higher stakes than a real regular week', `${real.regular.label} ×${real.regular.stakes.toFixed(2)} → ${real.playoff.label} ×${real.playoff.stakes.toFixed(2)}`)
ok(real.playoff.load > real.regular.load,
  'and it genuinely costs the body more at the same involvement', `${real.regular.load} → ${real.playoff.load} wear`)
ok(Math.abs(real.normalPlayoff) < 0.001,
  'while playing it at NORMAL still costs exactly nothing — the dial is the decision, not the schedule', 'normal=' + real.normalPlayoff)
ok(/playoff|final|championship/i.test(real.kick) && /×1\.[2-9]/.test(real.stakeChip || ''),
  'and the card names the fixture and draws its multiplier', `${real.kick} · ${real.stakeChip}`)

// ---- 6. 400px, no horizontal scroll
const six = await page.evaluate(() => {
  const pl = window.S.player
  pl.weekResults.slice(0, 5).forEach((w, i) => { w.played = true; w.perf = 60 + i; w.usageV111 = i % 2 ? 'heavy' : 'normal' })
  pl._wearV111 = { load: 96, lingering: [{ stat: 'acceleration', amt: -5, games: 2 }] }
  window.go('hub')
  const sec = document.querySelector('.condition-card-v11 .wearv111')
  const wide = [...sec.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 0.6)
  return {
    docW: document.documentElement.scrollWidth, winW: window.innerWidth,
    secW: Math.round(sec.getBoundingClientRect().width), overflow: wide.length,
    worst: wide.slice(0, 3).map(e => e.className + '@' + Math.round(e.getBoundingClientRect().right)),
    h: Math.round(sec.getBoundingClientRect().height),
  }
})
console.log('fit:', JSON.stringify(six))
ok(six.docW <= six.winW + 1, 'the page does not scroll sideways at 400px', `${six.docW} vs ${six.winW}`)
ok(six.overflow === 0, 'nothing in the section runs off the right edge', six.worst.join(' '))
ok(six.h < 420, 'the section stays compact', six.h + 'px tall')

// ---- the picture: the hub's BODY tab, where the card actually lives
await page.waitForTimeout(500)                     // let the v75 sectioner adopt the screen
await page.evaluate(() => { document.querySelector('.hubv75-tab[data-sec="body"]')?.click() })
await page.waitForTimeout(500)
const onBody = await page.evaluate(() => {
  const sec = document.querySelector('.hubv75-sec[data-sec="body"]')
  return !!(sec && sec.classList.contains('on') && sec.querySelector('.condition-card-v11 .wearv111'))
})
ok(onBody, 'the hub has a BODY tab and the card sits under it')
await page.evaluate(() => { document.querySelector('.condition-card-v11')?.scrollIntoView({ block: 'start' }) })
await page.waitForTimeout(300)
await page.screenshot({ path: process.env.SHOT || '/tmp/v111C-wear.png', fullPage: false })
await page.evaluate(() => { document.querySelector('.condition-card-v11 .wearv111')?.scrollIntoView({ block: 'center' }) })
await page.waitForTimeout(300)
await page.screenshot({ path: (process.env.SHOT || '/tmp/v111C-wear.png').replace(/\.png$/, '-card.png') })

const lastErr = await page.evaluate(() => window.__V111_BODY.lastError)
ok(!lastErr, 'the section never fell back to its own error path', lastErr || 'clean')

console.log('page errors:', errs.length, errs.slice(0, 6).join(' | '))
ok(errs.length === 0, 'no page errors')
console.log(JSON.stringify({ pass, fail, errors: errs.length }))
await browser.close()
process.exit(fail ? 1 : 0)
