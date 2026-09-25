// Dev check (v128 RIVALRY WEEK MEANS SOMETHING).
//
// Rivalry Week offered five choices and told you nothing about any of them: "+Big performance,
// real injury risk" is not a number, "Safe, solid game" is not a number, and "Needs strong Grit or
// it backfires" named 84 Grit at Middle School — a line essentially nobody clears — so the option
// was a trap that silently took a −1.6× rating penalty when you picked it. There was also no
// rivalry GAME: the stage was a season-wide modifier wearing a fixture's name, and one of its five
// effects (`rank`) was read by nothing at all.
//
// Asserts:
//   * every option states its effects as NUMBERS, built from its own `eff` so the card cannot
//     drift from the model, and states its variance in words
//   * every option but the safe one is locked behind an attribute at a reachable line, the card
//     says the number you need and the number you have, and chooseEvent refuses a locked one
//   * nothing promises an effect the model does not read
//   * one fixture on the schedule is the rivalry, it is marked as such, and it pays DOUBLE:
//     the injury roll, the coach-trust swing, and a real growth bonus for winning it
//   * variance is a real multiplier on every game's rating, not a word
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
  }, { t, visSrc: vis }); await page.waitForTimeout(650); return r
}
for (const t of ['NEXT', 'NEXT', 'NEXT', 'NEW CAREER']) await click(t)
for (let i = 0; i < 6; i++) {
  const done = await page.evaluate(({ visSrc }) => {
    const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    for (const w of ['START YOUR LEGACY', 'Lock In Personality']) { const b = els.find(e => txt(e).includes(w)); if (b) { b.click(); return false } }
    const c = els.find(e => e.classList.contains('pos-card') || /^[A-Z]{1,2} /.test(txt(e))); if (c) { c.click(); return false }
    return true
  }, { visSrc: vis }); await page.waitForTimeout(500); if (done) break
}
ok(await page.evaluate(() => !!window.__V128), 'window.__V128 is mounted')

// ---- 1. the model: every option says what it does, in numbers ----
const model = await page.evaluate(() => {
  const V = window.__V128, pl = window.S.player, st = V.stage()
  pl.level = 3; ['grit', 'awareness', 'discipline'].forEach(k => { pl.attrs[k] = 55 })
  const rows = st.choices.map(c => ({ label: c.label, eff: c.eff,
    say: V.say(c.eff, pl), lock: V.lock(c.eff, pl), vary: V.vary(c.eff) }))
  return { id: st.id, title: st.title, n: st.choices.length, rows,
    text: typeof st.text === 'function' ? st.text({ player: pl }) : st.text }
})
console.log('stage:', model.title, '·', model.n, 'choices')
model.rows.forEach(r => console.log(`  ${r.label}\n     ${r.say.map(x => x.replace(/<[^>]+>/g, '')).join(' · ')}\n     VARIANCE ${r.vary.band} · lock ${r.lock ? r.lock.name + ' ' + r.lock.need : 'none'}`))
ok(model.n === 5, 'the stage still offers five ways to play the week', String(model.n))
ok(model.rows.every(r => r.say.length >= 1), 'every option states at least one effect as a number', JSON.stringify(model.rows.map(r => r.say.length)))
ok(model.rows.every(r => !r.eff.perf || r.say.some(x => /to your rating/.test(x))), 'the rating it adds is stated')
const bare = x => x.replace(/<[^>]+>/g, '')
ok(model.rows.filter(r => r.eff.inj).every(r => r.say.some(x => /injury risk ×[\d.]+/.test(bare(x)))), 'and so is the injury multiplier, as a multiplier', bare(model.rows[0].say[1] || ''))
ok(model.rows.every(r => r.vary && r.vary.band && /\w/.test(r.vary.line)), 'every option states its VARIANCE, in a band and in words', model.rows.map(r => r.vary.band).join(','))
ok(new Set(model.rows.map(r => r.vary.band)).size >= 3, 'and the five do not all say the same thing', [...new Set(model.rows.map(r => r.vary.band))].join(','))
ok(model.rows.every(r => (r.eff.varMult || 1) === 1 || /further from average|closer to average|widen/.test(r.vary.line)),
  'a wide option explains what wide MEANS — the good games better and the bad ones worse')
ok(model.rows.every(r => r.eff.rank === undefined), 'no option promises an effect the model never reads (the dead `rank` is gone)')
ok(/DOUBLE/.test(model.text) && /stronger/i.test(model.text), 'the stage itself says the fixture is harder and pays double', model.text.slice(0, 120) + '…')

// ---- 2. the locks are real and reachable ----
const locks = await page.evaluate(() => {
  const V = window.__V128, pl = window.S.player, st = V.stage(), out = { byLevel: {}, open: 0 }
  for (const lv of [2, 3, 4, 5, 6]) { pl.level = lv
    out.byLevel[lv] = st.choices.map(c => { const l = V.lock(c.eff, pl); return l ? l.need : null }) }
  pl.level = 3
  out.open = st.choices.filter(c => !V.lock(c.eff, pl)).length
  out.attrs = [...new Set(st.choices.map(c => c.eff.reqAttr).filter(Boolean))]
  // an old-style requirement would have been Da(base, level) = base + level*22
  out.old = st.choices.map(c => c.eff.reqBase != null ? Math.round(c.eff.reqBase + 3 * 22) : null)
  return out
})
console.log('locks by level:', JSON.stringify(locks.byLevel))
ok(locks.open === 1, 'exactly one option is always open — the safe one', String(locks.open))
ok(locks.attrs.length >= 3, 'and the locks are spread across different attributes, not all Grit', locks.attrs.join(','))
ok(Object.values(locks.byLevel).every(a => a.filter(Boolean).every(v => v > 0 && v < 100)), 'every requirement is a reachable number at every level', JSON.stringify(locks.byLevel[6]))
ok(locks.byLevel[3].filter(Boolean).every((v, i) => v < locks.old.filter(Boolean)[i]), 'and lower than the old +22-a-level line that nobody cleared',
  `${JSON.stringify(locks.byLevel[3].filter(Boolean))} vs ${JSON.stringify(locks.old.filter(Boolean))}`)

// ---- 3. the screen, and the refusal ----
const screen = await page.evaluate(() => {
  const pl = window.S.player
  pl.level = 4; ['grit', 'awareness', 'discipline'].forEach(k => { pl.attrs[k] = 12 })   // nothing cleared
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { rivalSpinOnWeekV136: 0 })   // v136: the approach is spun on game week by default; this section tests the choice screen itself
  pl.pendingEvent = 'bigGame'; window.S.view = 'event'; window.render()
  const cards = [...document.querySelectorAll('#screen .pos-card')]
  const before = JSON.stringify(pl.eventChoice || null)
  // try to take a locked one
  const lockedIdx = cards.findIndex(c => /🔒/.test(c.textContent))
  if (lockedIdx >= 0) window.chooseEvent(lockedIdx)
  return { cards: cards.length,
    locked: cards.filter(c => /🔒 NEEDS/.test(c.textContent)).length,
    dimmed: cards.filter(c => parseFloat(getComputedStyle(c).opacity) < .6).length,
    says: cards.filter(c => c.querySelector('.rivsay-v128')).length,
    varies: cards.filter(c => c.querySelector('.rivvar-v128')).length,
    lockNote: cards.filter(c => c.querySelector('.rivlock-v128')).length,
    sample: (cards[0] && cards[0].textContent || '').replace(/\s+/g, ' ').slice(0, 170),
    tookLocked: JSON.stringify(pl.eventChoice || null) !== before }
})
console.log('event screen:', JSON.stringify({ ...screen, sample: undefined }))
console.log('  card 1:', screen.sample)
ok(screen.cards === 5, 'the screen draws all five', String(screen.cards))
ok(screen.says === 5 && screen.varies === 5, 'every card carries its effect list and its variance line', `says=${screen.says} varies=${screen.varies}`)
ok(screen.locked === 4, 'with nothing trained, the four locked options say what they need and what you have', String(screen.locked))
ok(screen.dimmed === 4 && screen.lockNote === 4, 'they are dimmed and carry the shortfall', `dim=${screen.dimmed} note=${screen.lockNote}`)
ok(screen.tookLocked === false, 'and chooseEvent REFUSES a locked one — it is not merely punished for')

// ---- 4. the fixture is real, and it pays double ----
const fixture = await page.evaluate(() => {
  const V = window.__V128, pl = window.S.player
  pl.level = 4; ['grit', 'awareness', 'discipline'].forEach(k => { pl.attrs[k] = 90 })
  const st = V.stage(), eff = st.choices[0].eff
  pl.pendingEvent = 'bigGame'; window.chooseEvent(0)
  const chosen = pl.eventChoice
  // build the schedule the way the season does
  const rows = window.__V128 && window.S ? (window.__lsV128 ? window.__lsV128(pl) : null) : null
  return { chosen: !!chosen, rival: !!(chosen && chosen.rivalV128), varMult: chosen && chosen.varMult,
    week: V.week(10), weeks: [8, 9, 10, 12].map(g => V.week(g)), mult: V.mult() }
})
console.log('fixture:', JSON.stringify(fixture))
ok(fixture.chosen && fixture.rival, 'taking a rivalry choice arms a real rivalry FIXTURE', `rivalV128=${fixture.rival}`)
ok(fixture.varMult > 1, 'and carries its variance multiplier into the season', `×${fixture.varMult}`)
ok(fixture.weeks.every((w, i) => w >= 1 && w < [8, 9, 10, 12][i]), 'the rivalry lands mid-season at every schedule length', JSON.stringify(fixture.weeks))
ok(fixture.mult === 2, 'and everything it pays lands DOUBLE', `×${fixture.mult}`)

// the schedule, played, marks it and doubles what it charges
const season = await page.evaluate(() => {
  const V = window.__V128, pl = window.S.player
  pl.level = 4; ['grit', 'awareness', 'discipline'].forEach(k => { pl.attrs[k] = 90 })
  pl.eventChoice = V.stage().choices[0].eff          // the choice the season is built under
  const wr = V.sched(pl) || []
  // and with no rivalry chosen at all, nothing on the schedule is one
  pl.eventChoice = null
  const plain = (V.sched(pl) || []).filter(w => w && w.rivalV128).length
  return { n: wr.length, rivals: wr.filter(w => w && w.rivalV128).length,
    idx: wr.findIndex(w => w && w.rivalV128), importance: ((wr.find(w => w && w.rivalV128) || {}).opponentV11 || {}).importance,
    others: wr.filter(w => w && !w.rivalV128 && w.opponentV11 && w.opponentV11.importance === 'rivalry').length,
    lift: (() => { const r = wr.find(w => w && w.rivalV128), o = wr.filter(w => w && !w.rivalV128); if (!r || !o.length) return null; const avg = o.reduce((a, w) => a + w.opponentV11.rating, 0) / o.length; return +(r.opponentV11.rating / avg).toFixed(2) })(),
    plain, rows: wr.map(w => !!w.rivalV128) }
})
console.log('season:', JSON.stringify(season))
ok(season.n > 0, 'the season builds a schedule')
ok(season.rivals === 1, 'exactly ONE fixture on it is the rivalry', `${season.rivals} of ${season.n}`)
ok(season.idx > 0 && season.idx < season.n - 1, 'and it is mid-season, not week one and not the finale', `week ${season.idx + 1} of ${season.n}`)
ok(season.importance === 'rivalry', 'the row is marked, so the schedule and the pregame can both say so', String(season.importance))
ok(season.plain === 0, 'and a season with no rivalry stage has no rivalry fixture — nothing else changed', String(season.plain))
ok(season.others === 0, 'it is the ONLY rivalry on the schedule — no other week is dressed as one', String(season.others))
ok(season.lift > 1.05, 'and that side is notably stronger than the rest of the slate', `×${season.lift} the average opponent`)

const shown = await page.evaluate(() => {
  const V = window.__V128, pl = window.S.player
  pl.eventChoice = V.stage().choices[0].eff
  pl.weekResults = V.sched(pl); pl.currentWeek = 0
  try { window.go('season') } catch (e) {}
  const rows = [...document.querySelectorAll('#screen .sched-row')]
  return { rows: rows.length, marked: rows.filter(r => /RIVALRY/.test(r.textContent)).length }
})
console.log('schedule rows:', JSON.stringify(shown))
ok(shown.rows > 0 && shown.marked === 1, 'and exactly one row on the schedule screen says RIVALRY', JSON.stringify(shown))

// ---- 6. v136 A: the approach is spun on game week ----
const defer = await page.evaluate(() => {
  const pl = window.S.player, A = window.__V136_A
  delete window.RIB_TUNE.rivalSpinOnWeekV136
  pl.level = 4; ['grit', 'awareness', 'discipline'].forEach(k => { pl.attrs[k] = 12 })
  pl.eventChoice = null; pl.pendingEvent = 'bigGame'; window.S.view = 'event'; window.render()
  const card = document.querySelector('.rival-defer-v136'), choices = document.querySelectorAll('#screen .pos-card[onclick*="chooseEvent"]').length, spun = !!document.querySelector('.wheel-opt-v13')
  const listed = card ? card.querySelectorAll('li').length : 0, locked = card ? [...card.querySelectorAll('li')].filter(l => /🔒/.test(l.textContent)).length : 0
  const btn = [...document.querySelectorAll('#screen button')].find(b => /RIVALRY WEEK/.test(b.innerText)); btn && btn.click()
  const ec = pl.eventChoice, pending = A.pending(pl), view = window.S.view
  const one = A.deck(pl); ['grit', 'awareness', 'discipline'].forEach(k => { pl.attrs[k] = 90 }); const five = A.deck(pl)
  const W = five.open.map(c => c.w), floor = window.TU('wheelWedgeFloor', .035)
  const d = A.resolve(pl, 'auto')
  return { card: !!card, choices, spun, listed, locked, pending, view, ecPerf: ec && ec.perf, oneOpen: one.open.length, fiveOpen: five.open.length, wSum: +W.reduce((a, b) => a + b, 0).toFixed(3), wMin: +Math.min(...W).toFixed(3), floor,
    resolved: !!d, chosen: pl.eventChoice && pl.eventChoice.chosenV136, how: pl.eventChoice && pl.eventChoice.howV136, stillPending: A.pending(pl), perfNow: pl.eventChoice && pl.eventChoice.perf, logged: (pl.eventLog || []).some(e => /Rivalry Week/.test(e.title) && e.choice === (pl.eventChoice && pl.eventChoice.chosenV136)),
    again: A.resolve(pl, 'auto') } })
console.log('v136 defer:', JSON.stringify(defer))
ok(defer.card && defer.choices === 0 && !defer.spun, 'v136: the event screen INTRODUCES the rivalry — one card, no choice buttons, no story wheel rolling over them', JSON.stringify({ card: defer.card, choices: defer.choices, spun: defer.spun }))
ok(defer.listed === 5 && defer.locked === 4, '  it lists the five approaches and which are locked for this player', `${defer.listed} listed, ${defer.locked} locked`)
ok(defer.pending && /^(sim|season)$/.test(defer.view) && defer.ecPerf === 0, '  GOT IT books the fixture with the approach PENDING and no swing yet', JSON.stringify({ pending: defer.pending, view: defer.view, perf: defer.ecPerf }))
ok(defer.oneOpen === 1 && defer.fiveOpen === 5, '  the deck leaves locked approaches off the wheel: one open untrained, five with the attributes there', `${defer.oneOpen} → ${defer.fiveOpen}`)
ok(Math.abs(defer.wSum - 1) < .01 && defer.wMin >= defer.floor - 1e-6, '  the wedges sum to one and none falls under the wedge floor', `sum=${defer.wSum} min=${defer.wMin} floor=${defer.floor}`)
ok(defer.resolved && defer.chosen && defer.how === 'auto' && !defer.stillPending && typeof defer.perfNow === 'number' && defer.logged, '  resolve lands an approach into eventChoice — the object ca() reads — with its label logged', JSON.stringify({ chosen: defer.chosen, how: defer.how, perf: defer.perfNow }))
ok(defer.again === null, '  and a resolved week is never re-rolled', String(defer.again))

console.log('page errors:', errs.length ? errs.join('\n') : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
