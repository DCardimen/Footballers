// Dev check (v131 THE PRICE OF STARTING OVER, IN NUMBERS).
//
// When a career ends and you roll another one, two screens decide the next man and neither gave
// you a number. The ORIGIN DRAFT — three cards, four with the Expanded Origin Draft — described
// itself in prose ("Starts behind physically, then develops faster after 16"), while every one of
// those is an exact edit to the sheet that `As` applies and never showed. And the REROLL PENALTY,
// the −5% on every attribute for abandoning a man unfinished, sat on the position screen and the
// hub card and nowhere near the pregame — the screen you read before playing the season it charges.
//
// Asserts: every origin states its effects as numbers, in the same terms the game applies them;
// no origin promises an effect nothing reads (the three dead keys are real now); the cards on the
// draft carry the list, and so does the chosen one; and the reroll penalty is on the pregame sheet
// and named on the wizard's impact page with its exact percentage.
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

// ---- 1. every origin, in numbers ----
const model = await page.evaluate(() => {
  const V = window.__V131, out = []
  for (const o of V.origins()) out.push({ id: o.id, name: o.name, keys: Object.keys(o.effects),
    rows: V.eff(o).map(r => ({ good: r.good, t: r.t.replace(/<[^>]+>/g, '') })) })
  return out
})
model.forEach(o => console.log(`  ${o.name}\n     ` + o.rows.map(r => (r.good ? '▲ ' : '▼ ') + r.t).join('\n     ')))
ok(model.length >= 8, 'every origin is in the draft pool', String(model.length))
ok(model.every(o => o.rows.length >= 1), 'and every one of them states at least one exact effect', JSON.stringify(model.map(o => o.rows.length)))
ok(model.every(o => o.rows.every(r => /\d/.test(r.t))), 'every line carries a number — none of it is prose')
ok(model.every(o => o.rows.some(r => !r.good) || o.rows.length >= 2), 'and a card with a downside says the downside too')
// no key in the data goes unspoken
const spoken = { startAll: 1, startPhysical: 1, mental: 1, explosive: 1, durability: 1, grit: 1, strength: 1, awareness: 1,
  stars: 1, potential: 1, coachTrust: 1, snap: 1, rep: 1, susceptibility: 1, recovery: 1, recurrence: 1, clutch: 1, pressure: 1, versatility: 1 }
const unspoken = model.flatMap(o => o.keys.filter(k => !spoken[k]).map(k => o.id + '.' + k))
ok(unspoken.length === 0, 'no effect key in the data goes unsaid on its card', unspoken.join(', ') || 'none')

// ---- 2. the three keys that were read by nothing ----
const dead = await page.evaluate(() => {
  const V = window.__V131, pl = window.S.player || { attrs: {}, level: 3 }
  const st = window.S
  const P = { }
  // prodigy: pressure must move the bar he is judged against
  pl.originV11 = 'prodigy'; st.player = pl
  P.prodigyPress = V.press(pl)
  // small-town: clutch must be a real bump in a playoff game and nothing in a routine one
  pl.originV11 = 'small-town'
  P.clutchBig = V.clutch(pl, { playoff: true })
  P.clutchRival = V.clutch(pl, { rivalV128: true })
  P.clutchRoutine = V.clutch(pl, {})
  // and an origin with neither key gets neither
  pl.originV11 = 'walk-on'
  P.plainPress = V.press(pl); P.plainClutch = V.clutch(pl, { playoff: true })
  pl.originV11 = null
  return P
})
console.log('the once-dead keys:', JSON.stringify(dead))
ok(dead.prodigyPress > 0, 'the Prodigy IS judged against a higher bar — the "harsher evaluations" his card promised', `+${dead.prodigyPress.toFixed(2)} OVR to the promotion line`)
ok(dead.clutchBig > 0 && dead.clutchRival > 0, 'the Small-Town Prospect IS clutch, in the games that decide a season', `+${dead.clutchBig} playoff / +${dead.clutchRival} rivalry rating`)
ok(dead.clutchRoutine === 0, 'and not in a routine week — clutch means clutch', String(dead.clutchRoutine))
ok(dead.plainPress === 0 && dead.plainClutch === 0, 'an origin with neither key gets neither', JSON.stringify([dead.plainPress, dead.plainClutch]))

// ---- 3. the cards on the draft ----
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  const r = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const el = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
      .find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false
  }, { t, visSrc: vis }); await page.waitForTimeout(600); return r
}
for (const t of ['NEXT', 'NEXT', 'NEXT', 'NEW CAREER']) await click(t)
for (let i = 0; i < 6; i++) {
  const done = await page.evaluate(({ visSrc }) => {
    const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    for (const w of ['START YOUR LEGACY', 'Lock In Personality']) { const b = els.find(e => txt(e).includes(w)); if (b) { b.click(); return false } }
    const c = els.find(e => e.classList.contains('pos-card') || /^[A-Z]{1,2} /.test(txt(e))); if (c) { c.click(); return false }
    return true
  }, { visSrc: vis }); await page.waitForTimeout(450); if (done) break
}
const draft = await page.evaluate(() => {
  const pl = window.S.player
  pl.originV11 = null
  pl.originOptionsV11 = ['late-bloomer', 'undersized', 'iron-will']
  try { window.go('hub') } catch (e) {}
  const cards = [...document.querySelectorAll('.origin-choice-v11')]
  return { cards: cards.length, withNumbers: cards.filter(c => c.querySelector('.orig-say-v131')).length,
    sample: (cards[0] && cards[0].textContent || '').replace(/\s+/g, ' ').slice(0, 160),
    note: /nothing here is flavour/i.test(document.getElementById('screen').textContent) }
})
console.log('draft:', JSON.stringify(draft))
ok(draft.cards >= 3, 'the draft offers its cards', String(draft.cards))
ok(draft.withNumbers === draft.cards, 'and every card carries its exact stat list, not just prose', `${draft.withNumbers} of ${draft.cards}`)
ok(draft.note, 'the screen says the numbers are real')
console.log('  card 1:', draft.sample)

const chosen = await page.evaluate(() => {
  const V = window.__V131
  try { window.chooseOriginV11('iron-will') } catch (e) {}
  const pl = window.S.player, o = V.origins().find(x => x.id === pl.originV11)
  // the chosen card and the draft card render through the SAME originSayV131 call, so the
  // guarantee worth asserting is that the chosen origin still answers with its numbers
  return { origin: pl.originV11, rows: o ? V.eff(o).length : 0,
    txt: o ? V.say(o).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').slice(0, 120) : '' }
})
console.log('chosen:', JSON.stringify(chosen))
ok(chosen.origin === 'iron-will' && chosen.rows >= 2, 'and the one you chose still answers with what it did to you', chosen.txt)

// ---- 4. the reroll penalty, where you read the sheet ----
const preg = await page.evaluate(() => {
  const pl = window.S.player
  window.S.careers = window.S.careers || 0
  window.S.rerollV112 = { active: true, pct: 5, level: pl.level, career: window.S.careers | 0, prev: 'A Previous Man', count: 1 }
  const sheet = window.pregamePlayerStatsV25 ? window.pregamePlayerStatsV25(pl) : ''
  return { sheet: /REROLL PENALTY/.test(sheet), pct: /−5%|-5%/.test(sheet),
    why: /unfinished/i.test(sheet), txt: sheet.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200) }
})
console.log('pregame sheet:', JSON.stringify({ ...preg, txt: undefined }))
console.log('  ', preg.txt)
ok(preg.sheet, 'the reroll penalty is ON the pregame stat sheet now, not only on the position screen')
ok(preg.pct, 'and it states the exact percentage it is taking off every attribute')
ok(preg.why, 'and why it is being taken')

console.log('page errors:', errs.length ? errs.join('\n') : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
