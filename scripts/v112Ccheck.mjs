// Dev check: v112 (C) — WHO YOU START AS. Drives the real character-creation screens and asserts:
//   * an eight-year-old's DISPLAYED height and weight are age-plausible, and the projected adult
//     frame is printed beside them, larger and labelled
//   * the frame grows toward the projection as the career climbs the levels, and lands on it exactly
//   * exactly two trait cards are offered, drawn from a pool of ten; tapping one assigns it, kills
//     the offer, and the existing Oe()/dt trait effects still resolve on it
//   * position fit (pa/ns/OVR) still reads the PROJECTION, so the scoreboard is untouched
//   * abandoning an unfinished career WARNS first, and the next man carries −5% that reaches BOTH
//     effAttrsV85().mult and the multiplier the live sim reads for the you-player (__condMultV54)
//   * the penalty survives a reload, cannot be erased by rerolling again, and clears on promotion
//   * a career that ENDED naturally (_settled) is not an abandonment and is never charged
// Usage: a static server on the port below, then: GAME_URL=http://localhost:5203/index.html node scripts/v112Ccheck.mjs
import { chromium } from 'playwright'
const URL = process.env.GAME_URL || 'http://localhost:5173/'
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d) : '')); c ? pass++ : fail++ }
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 400, height: 860 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
const dialogs = []
page.on('dialog', d => { dialogs.push(d.message()); d.accept() })
await page.addInitScript(() => { setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1500)
await page.waitForFunction(() => !!window.__V112_C, null, { timeout: 60000 })

const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const click = async t => { await page.evaluate(({ t, visSrc }) => {
  const vis = eval(visSrc), els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
  const el = t === 'ARCH' ? els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
    : els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click() } }, { t, visSrc: vis }); await page.waitForTimeout(700) }

/* ---------- 1. the curve itself, before any screen ---------- */
const curve = await page.evaluate(() => {
  const V = window.__V112_C, b = { height: 74, weight: 230, muscle: 60 }
  return { rows: [8, 10, 12, 15, 17, 19, 22, 26].map(a => { const n = V.bodyNow(b, a); return { a, h: n.height, w: n.weight, m: n.muscle, grown: n.grown } }), pool: V.pool }
})
const r8 = curve.rows[0], r22 = curve.rows[6]
ok(r8.h >= 46 && r8.h <= 56, 'age 8 height is a child\'s (46-56in)', r8.h)
ok(r8.w >= 50 && r8.w <= 85, 'age 8 weight is a child\'s (50-85lb)', r8.w)
ok(curve.rows.every((r, i) => i === 0 || (r.h >= curve.rows[i - 1].h && r.w >= curve.rows[i - 1].w)), 'the frame never shrinks with age')
ok(r22.h === 74 && r22.w === 230 && r22.grown === true, 'at the adult age he IS the projection', r22)
ok(curve.rows[7].h === 74 && curve.rows[7].w === 230, 'past the adult age nothing keeps growing')
ok(curve.pool.length === 10, 'the offer pool is ten traits', curve.pool.length)

/* ---------- 2. the creation flow, on the real screens ---------- */
for (const s of ['START NEW CAREER', 'ARCH', 'Lock In Personality']) await click(s)
const pos = await page.evaluate(() => {
  const p = window.S.player, V = window.__V112_C, n = V.bodyOf(p)
  const sc = document.getElementById('screen'), txt = (sc && sc.innerText) || ''
  const zs = v => Math.floor(v / 12) + "'" + (v % 12) + '"'
  return { view: window.S.view, age: p.age, level: p.level, proj: p.body, now: { h: n.height, w: n.weight, m: n.muscle },
    txt, shownNow: txt.includes(zs(n.height)) && txt.includes(String(n.weight)),
    shownProj: txt.includes(zs(p.body.height)) && txt.includes(String(p.body.weight)),
    projLabelled: /PROJECTS TO/.test(txt),
    cards: [...document.querySelectorAll('[data-trait-v112]')].map(e => e.getAttribute('data-trait-v112')),
    header: ((document.querySelector('#traitOfferV112 .l') || {}).textContent || '').trim(),
    traits: p.traits.slice(), offer: (p.traitOfferV112 || []).slice(),
    posBest: window.__V112_C && null, hOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }
})
ok(pos.view === 'choosePos', 'the position screen is up', pos.view)
ok(pos.age === 8 && pos.level === 0, 'a fresh career starts at Pee Wee, age 8', { age: pos.age, level: pos.level })
ok(pos.shownNow, 'the screen prints the AGE-TRUE height and weight', pos.now)
ok(pos.shownProj && pos.projLabelled, 'and prints the projection, labelled PROJECTS TO', pos.proj)
ok(pos.proj.height > pos.now.h && pos.proj.weight > pos.now.w, 'the projection is bigger than the boy', { now: pos.now, proj: pos.proj })
ok(pos.hOverflow === 0, 'no horizontal overflow at 400px', pos.hOverflow)
ok(pos.cards.length === 2, 'exactly two trait cards are offered', pos.cards)
ok(/2 OF 10/.test(pos.header), 'the card header names the pool of ten', pos.header)
ok(pos.cards.every(k => curve.pool.includes(k)), 'both cards come from the pool of ten', pos.cards)
ok(pos.traits.length === 1, 'only the guaranteed trait is held before the pick', pos.traits)

/* the pick */
const picked = await page.evaluate(() => { const want = document.querySelector('[data-trait-v112]').getAttribute('data-trait-v112')
  document.querySelector('[data-trait-v112]').click(); const p = window.S.player
  return { want, traits: p.traits.slice(), picked: p.traitPickedV112, offer: p.traitOfferV112,
    cards: document.querySelectorAll('[data-trait-v112]').length,
    // the existing trait plumbing still resolves on the chosen key
    oe: p.traits.map(k => ({ k, known: !!window.__V112_C.traits[k], name: window.__V112_C.traits[k] && window.__V112_C.traits[k].name })) } })
ok(picked.traits.includes(picked.want) && picked.picked === picked.want, 'tapping a card assigns that trait', picked)
ok(picked.offer === null && picked.cards === 0, 'the offer is spent — the other card is gone')
ok(picked.oe.every(t => t.known && t.name), 'every held trait still resolves through dt/Oe', picked.oe)

/* the ironFrame / glassBones effects the injury and wear models read still work on a chosen trait */
const traitFx = await page.evaluate(() => {
  const p = window.S.player, was = p.traits.slice()
  const base = window.__injModelV54.chance(p, {})
  p.traits = ['ironFrame']; const iron = window.__injModelV54.chance(p, {})
  p.traits = ['glassBones']; const glass = window.__injModelV54.chance(p, {})
  p.traits = was; return { base, iron, glass }
})
ok(traitFx.iron < traitFx.glass, 'ironFrame still divides the injury roll and glassBones still multiplies it', traitFx)

/* the fit still reads the projection, not the boy — this is what keeps the scoreboard still */
const fit = await page.evaluate(() => {
  const p = window.S.player, V = window.__V112_C, n = V.bodyOf(p)
  const now = { height: n.height, weight: n.weight, muscle: n.muscle }
  const shown = (document.getElementById('screen').innerText || '')
  const ranked = V.rank(p.attrs, p.body)                       // what the position list is built from
  return { fitProj: V.fit(p.body, 'QB'), fitNow: V.fit(now, 'QB'),
    ovrProj: V.ovr(p.attrs, ranked[0].pos, p.body), ovrNow: V.ovr(p.attrs, ranked[0].pos, now),
    bestShown: shown.includes(String(ranked[0].ovr)) }
})
ok(fit.fitProj !== fit.fitNow, 'the boy and the man do not grade the same', fit)
ok(fit.bestShown, 'the OVR the screen prints is the one built on the PROJECTION', { proj: fit.ovrProj, now: fit.ovrNow })
await click('QB Quarterback')
const hub = await page.evaluate(() => {
  const p = window.S.player, V = window.__V112_C, n = V.bodyOf(p)
  const txt = (document.getElementById('screen') || {}).innerText || ''
  const zs = v => Math.floor(v / 12) + "'" + (v % 12) + '"'
  return { view: window.S.view, txt, now: zs(n.height), proj: zs(p.body.height),
    showsNow: txt.includes(zs(n.height) ), showsProj: /projects/.test(txt),
    hOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }
})
ok(hub.view === 'hub', 'the hub is reached — the creation flow still completes')
ok(hub.showsNow && hub.showsProj, 'the hub prints the age-true frame and flags the projection', { now: hub.now, proj: hub.proj })
ok(hub.hOverflow === 0, 'hub has no horizontal overflow at 400px', hub.hOverflow)

/* ---------- 3. the frame grows toward the projection across the levels ---------- */
const grow = await page.evaluate(() => {
  const p = window.S.player, V = window.__V112_C, A = [8, 10, 12, 15, 17, 19, 22, 23]
  const rows = A.map(a => { p.age = a; const n = V.bodyOf(p); return { a, h: n.height, w: n.weight, grown: n.grown } })
  p.age = 8; return { rows, proj: p.body }
})
ok(grow.rows.every((r, i) => i === 0 || (r.h >= grow.rows[i - 1].h && r.w >= grow.rows[i - 1].w)), 'the career-long frame only grows', grow.rows.map(r => r.a + ':' + r.h + '/' + r.w).join(' '))
ok(grow.rows[grow.rows.length - 1].h === grow.proj.height && grow.rows[grow.rows.length - 1].w === grow.proj.weight,
  'by the NFL he has arrived at his projection exactly', grow.rows[grow.rows.length - 1])

/* ---------- 4. no penalty on a first-ever character ---------- */
ok((await page.evaluate(() => window.__V112_C.mul())) === 1, 'a first career carries no penalty')
/* the neutrality argument, made exactly rather than statistically: with no penalty the reroll
 * factor is the number 1, so condMultV54 returns one of its three original constants unchanged —
 * and condMultV54 is the ONLY thing v112 (C) touches that the live engine can reach. */
const neutral = await page.evaluate(() => {
  const p = window.S.player, c = p.conditionV11 || (p.conditionV11 = { fatigue: 20 }), keep = { ...c }
  const out = {}
  c.injury = null; c.fatigue = 50; out.mid = window.__condMultV54(p)
  c.fatigue = 90; out.worn = window.__condMultV54(p)
  c.fatigue = 5; out.fresh = window.__condMultV54(p)
  Object.assign(c, keep)
  return { ...out, factor: window.__V112_C.mul() }
})
ok(neutral.factor === 1 && neutral.mid === 1 && neutral.worn === 0.9 && neutral.fresh === 1.05,
  'with no penalty condMultV54 is bit-identical to its pre-v112 constants (1 / 0.90 / 1.05)', neutral)
ok((await page.evaluate(() => window.__V112_C.eff().mult)) === (await page.evaluate(() => window.__condMultV54(window.S.player))),
  'the sheet and the sim read the SAME multiplier')

/* ---------- 5. abandon and reroll: warn, then charge ---------- */
const before = await page.evaluate(() => ({ mult: window.__condMultV54(window.S.player), careers: window.S.careers }))
dialogs.length = 0
await page.evaluate(() => window.confirmNew()); await page.waitForTimeout(800)
ok(dialogs.length === 1 && /REROLL PENALTY/.test(dialogs[0]) && /5%/.test(dialogs[0]),
  'abandoning an unfinished career warns, by name, before the new one exists', (dialogs[0] || '').slice(0, 60))
const after = await page.evaluate(() => {
  const V = window.__V112_C, p = window.S.player, L = V.ledger()
  p.attrs.speed = 60; p.attrs.strength = 60
  const eff = V.eff(p), armed = window.__condMultV54(p)
  L.active = false; const bare = window.__condMultV54(p), bareEff = V.eff(p); L.active = true
  return { ledger: L, armed, bare, effMult: eff.mult, ratio: +(armed / bare).toFixed(6),
    effRatio: +(eff.mult / bareEff.mult).toFixed(6), speedEff: eff.eff.speed, speedBare: bareEff.eff.speed,
    why: V.why(), careers: window.S.careers }
})
ok(after.ledger && after.ledger.active && after.ledger.pct === 5, 'the ledger is armed on the save root at −5%', after.ledger)
ok(after.ratio === 0.95, 'what the SIM reads (__condMultV54) is exactly 0.95× what it would be', { armed: after.armed, bare: after.bare })
ok(after.effRatio === 0.95, 'what the SHEET reads (effAttrsV85().mult) is the same 0.95×', { eff: after.effMult })
ok(after.speedEff < after.speedBare, 'and the effective attribute on the sheet actually drops', { eff: after.speedEff, bare: after.speedBare })
ok(/unfinished/.test(after.why), 'the game can say WHY he has it', after.why)
await page.evaluate(() => { window.S.view = 'hub'; window.q && window.q() })
const chip = await page.evaluate(() => {
  const el = document.querySelector('.rr-chip-v112, .rr-note-v112')
  return { present: !!el, txt: el ? (el.innerText || el.textContent || '').trim() : '' } })
ok(chip.present && /5%/.test(chip.txt), 'the penalty is drawn on the screen', chip.txt)

/* ---------- 5b. the LIVE SIM really reads it: count the calls during a real game ----------
 * _raw() multiplies the you-player's every attribute by window.__condMultV54(o.player) before
 * the engine plays with it. Wrap that export in a counter and play a game: if the count moves,
 * the penalty is inside the simulation, not merely printed on the sheet. */
const simReads = await page.evaluate(() => {
  const real = window.__condMultV54
  let n = 0, seen = new Set()
  window.__condMultV54 = function (e) { const v = real.apply(this, arguments); n++; seen.add(v); return v }
  let plays = 0
  try { const r = window.__simGameV2(60, 'QB'); plays = r.plays.length } catch (_) {}
  window.__condMultV54 = real
  return { n, plays, values: [...seen], armedValue: real(window.S.player) }
})
ok(simReads.n > 0, 'the live sim asks for the multiplier while it plays', `${simReads.n} reads over ${simReads.plays} rows`)
ok(simReads.values.length === 1 && Math.abs(simReads.values[0] - simReads.armedValue) < 1e-9,
  'and the value it gets is the penalised one', simReads.values)

/* ---------- 6. it survives a reload ---------- */
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1800)
await page.waitForFunction(() => !!window.__V112_C, null, { timeout: 30000 })
ok((await page.evaluate(() => window.__V112_C.mul())) === 0.95, 'the penalty survives a save/reload')

/* ---------- 7. rerolling again cannot erase it ---------- */
dialogs.length = 0
await page.evaluate(() => { window.S.view = 'hub'; window.confirmNew() }); await page.waitForTimeout(800)
const again = await page.evaluate(() => ({ mul: window.__V112_C.mul(), ledger: window.__V112_C.ledger() }))
ok(again.mul === 0.95 && again.ledger.count === 2, 'a second reroll re-arms the same −5% (it does not stack, and it does not clear)', again.ledger)

/* ---------- 8. it clears on promotion, and not before ---------- */
const clears = await page.evaluate(() => {
  const p = window.S.player, V = window.__V112_C, at = V.ledger().level
  p.level = at; const same = V.mul()
  p.level = at + 1; const up = V.mul()
  p.level = at; const back = V.mul()
  return { same, up, back }
})
ok(clears.same === 0.95 && clears.back === 0.95, 'still charged while he is on the same level', clears)
ok(clears.up === 1, 'one promotion and it is paid off', clears)

/* ---------- 9. a career that ENDED naturally is not a reroll ----------
 * Both endings funnel through the same screen: running out of seasons / being cut renders the
 * career-result screen (`gameover`), and a FAILED DECLARE lands on `declineResult` and then hands
 * off to that same screen (declarecheck.mjs walks that route). The screen is what sets
 * player._settled as it pays the prestige out, so driving the real screen — not setting a flag by
 * hand — is what proves the two endings are told apart. */
await page.evaluate(() => { window.S.rerollV112 = null })
const ended = await page.evaluate(() => {
  window.endCareer()                                    // the real career-result screen
  const txt = (document.getElementById('screen') || {}).innerText || ''
  return { view: window.S.view, settled: !!window.S.player._settled, abandoned: window.__V112_C.abandoned(),
    epitaph: /End of the Road|Career Log/i.test(txt) }
})
ok(ended.view === 'gameover' && ended.epitaph, 'the real career-result screen renders', ended.view)
ok(ended.settled === true, 'ending a career settles it (the screen sets _settled as it pays out)')
ok(ended.abandoned === false, 'a settled (finished) career is NOT an abandonment')
const afterReset = await page.evaluate(() => { window.prestigeReset(); return { player: window.S.player, abandoned: window.__V112_C.abandoned() } })
ok(afterReset.player === null && afterReset.abandoned === false, 'and neither is the empty slot prestigeReset leaves behind')
dialogs.length = 0
const fresh = await page.evaluate(() => { window.startCareer(); const p = window.S.player; return { ledger: window.__V112_C.ledger(), mul: window.__V112_C.mul(), traits: p.traits.length, offer: (p.traitOfferV112 || []).length } })
ok(dialogs.length === 0, 'starting the next career after a natural ending asks for nothing', dialogs)
ok(fresh.mul === 1 && !fresh.ledger, 'and it carries no penalty', fresh)
ok(fresh.traits === 1 && fresh.offer === 2, 'and it is still one guaranteed trait plus two cards', fresh)

ok(errs.length === 0, 'no page errors', errs.slice(0, 3))
console.log(`\n${pass} passed, ${fail} failed`)
if (errs.length) console.log('PAGE ERRORS:\n' + errs.slice(0, 6).join('\n'))
await browser.close()
process.exit(fail ? 1 : 0)
