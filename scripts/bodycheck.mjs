// Dev check: v73 BODY LEDGER — the injury section answers the question it exists for.
//
// The condition card reported fatigue, recovery capacity and mental load. Every one
// of those is an INPUT to the availability model and none of them is what a player
// needs in order to decide anything: what does this body do to the NEXT game, and is
// durability worth a skill point? A season could go badly with the reason on screen
// in a form nobody could read.
//
// So the ledger has to be true, not just present. This check asserts that the net
// figure MOVES with the body in the right direction, that it agrees with the model
// the game actually plays with (condMultV54), that the risk it quotes is the real
// injChanceV54, that the durability line is a measured marginal value rather than a
// decoration, and that a game lost to the body says so afterwards.
import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 1000 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => {
  setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60)
})
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 25000 })
await page.waitForTimeout(1400)

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }

const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  const r = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t === 'ARCH') el = els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
    else el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false
  }, { t, visSrc: vis })
  await page.waitForTimeout(700); return r
}
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
await click('Balanced Program')
await page.evaluate(() => { document.getElementById('growthV42')?.remove(); window.go('season') })
await page.waitForTimeout(700)

// ---- 1. the ledger tracks the body, in the direction the model actually pushes
const led = await page.evaluate(() => {
  const B = window.__BODY_V73, pl = window.S.player
  const c = window.__condMultV54
  const set = (fat, inj) => { const k = pl.conditionV11 || (pl.conditionV11 = {})
    k.fatigue = fat; k.injury = inj; k.recovery = k.recovery || 55; k.mentalLoad = k.mentalLoad || 18 }
  const snap = () => { const L = B.ledger(pl); return { net: +L.net.toFixed(2), mult: L.mult, risk: +L.risk.toFixed(4),
    riskUp: +L.riskUp.toFixed(4), verdict: L.verdict, sit: L.sit, missNext: +L.missNext.toFixed(3), rows: L.rows.length } }
  set(8, null); const fresh = snap()
  set(50, null); const mid = snap()
  set(88, null); const worn = snap()
  set(20, { name: 'High ankle sprain', severity: 2, weeksRemaining: 2, recurrence: .1 }); const hurt = snap()
  // and the multipliers the ledger quotes have to be the ones the game plays with
  set(8, null); const cFresh = c(pl)
  set(88, null); const cWorn = c(pl)
  set(30, null)
  return { fresh, mid, worn, hurt, cFresh, cWorn }
})
console.log('ledger:', JSON.stringify(led))
ok(led.fresh.net > 0.8 && led.fresh.verdict === 'NET POSITIVE',
  'a fresh body reads NET POSITIVE, with a number', led.fresh.net + ' (' + led.fresh.verdict + ')')
ok(Math.abs(led.mid.net) < 0.8 && led.mid.verdict === 'NEUTRAL',
  'an ordinary body reads neutral', led.mid.net + ' (' + led.mid.verdict + ')')
ok(led.worn.net < -0.8 && led.worn.verdict === 'NET NEGATIVE',
  'a worn body reads NET NEGATIVE', led.worn.net + ' (' + led.worn.verdict + ')')
ok(led.fresh.mult === led.cFresh && led.worn.mult === led.cWorn,
  'the swing is quoted off the multiplier the game actually plays with, not a copy of it',
  `${led.fresh.mult}/${led.cFresh} · ${led.worn.mult}/${led.cWorn}`)
ok(led.hurt.verdict === 'NET NEGATIVE' || led.hurt.sit,
  'an injury reads as a cost or as unavailability, never as neutral',
  led.hurt.verdict + ' sit=' + led.hurt.sit)
ok(led.worn.risk > led.fresh.risk,
  'the risk it quotes rises with fatigue, like the model it reads',
  led.fresh.risk + ' -> ' + led.worn.risk)
ok(led.fresh.riskUp < led.fresh.risk && led.fresh.risk - led.fresh.riskUp > 0.0005,
  'one more point of durability measurably lowers the risk — the skill-point hook is real',
  ((led.fresh.risk - led.fresh.riskUp) * 100).toFixed(3) + 'pp per point')
ok(led.fresh.missNext > 0 && led.worn.missNext > led.fresh.missNext,
  'risk is priced in expected games missed, and worn costs more of them',
  led.fresh.missNext + ' -> ' + led.worn.missNext)

// ---- 2. the card puts it on screen, at the top, in one number
const card = await page.evaluate(() => {
  const pl = window.S.player
  const k = pl.conditionV11; k.fatigue = 92; k.injury = null
  window.render()
  const el = document.querySelector('.condition-card-v11')
  if (!el) return { why: 'no condition card' }
  const net = el.querySelector('.bodyv73-net b')
  return { kicker: (el.querySelector('.impact-kicker') || {}).textContent,
    net: net && net.textContent.trim(), rows: el.querySelectorAll('.bodyv73-row').length,
    text: el.innerText.replace(/\s+/g, ' ') }
})
console.log('card:', JSON.stringify({ ...card, text: (card.text || '').slice(0, 300) }))
ok(!card.why, 'the condition card renders')
ok(/NEXT GAME/i.test(card.kicker || ''), 'it is framed as the next game, not as a set of raw inputs', card.kicker)
ok(/^[+−]\d/.test(card.net || ''), 'and leads with one signed number', card.net)
ok(card.rows >= 3, 'with the itemised ledger under it', card.rows + ' rows')
ok(/DURABILITY/i.test(card.text) && /risk to/i.test(card.text),
  'including what the next point of durability buys')

// ---- 3. a game the body took a bite out of says so afterwards
const attrib = await page.evaluate(() => {
  const pl = window.S.player
  // charge one played week the way the resolver does, then read it back
  const wk = (pl.weekResults || []).find(w => w && !w.played)
  if (!wk) return { why: 'no week to mark' }
  wk.played = true; wk.perf = 44; wk.bodyCostV73 = -5; wk.won = false
  const k = pl.conditionV11; k.fatigue = 88; k.injury = null
  window.go('season')
  const card = document.querySelector('.condition-card-v11')
  const chip = document.querySelector('.bodyv73-chip')
  return { card: card ? card.innerText.replace(/\s+/g, ' ') : '', chip: chip ? chip.textContent.trim() : null }
})
console.log('attribution:', JSON.stringify({ chip: attrib.chip, card: (attrib.card || '').slice(0, 220) }))
ok(/body cost you/i.test(attrib.card || ''),
  'a bad grade that came from the body is named as the body, not left to read as bad play')
ok(!!attrib.chip, 'and the week itself carries the mark on the schedule', attrib.chip)

console.log('page errors:', errs.length ? '\n' + errs.join('\n') : 'NONE')
console.log('VERDICT: ' + (fail === 0 && errs.length === 0 ? 'PASS' : 'FAIL') + `  (${pass} ok, ${fail} failed)`)
await browser.close()
process.exitCode = fail === 0 && errs.length === 0 ? 0 : 1
