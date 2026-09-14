// Dev check: v111 (B) — THE PREGAME DECISION. Drives a real career to the pregame screen and
// works the two new controls the way a thumb would:
//   * THE LADDER — five involvement steps in one row, the MIDDLE one (`normal`) selected before
//     anything is touched, and nothing written to the week until it is (no pick = today's game).
//   * THE PICK IS THE STATE — tapping a step writes week.usageV111 and the priced cost on screen
//     moves with it: limited is cheaper than every snap, every snap is dearer than normal.
//   * THE LADDER IS TWO LADDERS — below `normal` it buys SNAPS (he is really off the field);
//     at `normal` he is already on for every snap his unit takes, so above it there are no more
//     snaps to sell and what it buys instead is the BALL. Both halves are monotone, and the
//     screen's own copy has to say which of the two rows is moving.
//   * THE NUMBERS ARE THE MODEL'S — every figure drawn in WHAT IT BUYS / WHAT IT COSTS is read
//     back out of window.__V111.forecast (or, when agent A's model is absent from this tree, the
//     screen's own neutral stub) and compared to the pixels.
//   * WHY THIS WEEK IS EXPENSIVE — the forecast's `parts` are on screen as chips (durability,
//     opponent, stakes), so the semifinal visibly prices higher than week three.
//   * THE FOCUS — exactly three cards, position-appropriate (each names a stat the position
//     actually uses) at x1.2; tapping one writes week.focusV111, tapping another REPLACES it.
//   * NOTHING WAS LOST — the coordinator still adopts a plan (player._gameScriptV23 carries a
//     gsPass) and the impact bar still draws its fill.
//   * IT IS A PHONE — the whole screen at a 400px viewport with no horizontal scroll.
//   node scripts/v111Bcheck.mjs        (GAME_URL, POS=RB, SHOT=path.png)
import { chromium } from 'playwright'

const URL = process.env.GAME_URL || 'http://localhost:5173/'
const POS = process.env.POS || 'RB'
const SHOT = process.env.SHOT || 'scripts/_v111B.png'
const POS_LABEL = { QB: 'QB Quarterback', RB: 'RB Running Back', WR: 'WR Wide Receiver', TE: 'TE Tight End', OL: 'OL Offensive Line', DL: 'DL Defensive Line', LB: 'LB Linebacker', CB: 'CB Cornerback', S: 'S Safety' }[POS] || POS

let pass = 0, fail = 0
const errs = []
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
// 400px wide on purpose: this game is played on a phone, so the check never sees a desktop layout
const page = await browser.newPage({ viewport: { width: 400, height: 1100 } })
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 })
await page.waitForTimeout(2500)

const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    const el = t === 'ARCH' ? els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
      : els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click() }
  }, { t, visSrc: vis })
  await page.waitForTimeout(650)
}
for (const s of ['START NEW CAREER', 'ARCH', POS_LABEL, 'Lock In Personality', 'PLAY 8-GAME SEASON']) await click(s)
for (let i = 0; i < 60; i++) { const d = await page.evaluate(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') { g.click(); return false } return !document.getElementById('growthV42') }); if (d) break; await page.waitForTimeout(300) }
await click('Balanced Program')
await page.evaluate(() => { const el = [...document.querySelectorAll('button')].find(e => /PLAY WEEK 1 LIVE/.test(e.innerText || '')); el && el.click() })
for (let i = 0; i < 80; i++) {
  if (await page.evaluate(() => !!document.getElementById('pregameV1513'))) break
  await page.evaluate(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') g.click() })
  await page.waitForTimeout(250)
}
ok(await page.evaluate(() => !!document.getElementById('pregameV1513')), 'the pregame screen opened')

// ---- what the screen says, scraped back out of the DOM
const readUI = () => page.evaluate(() => {
  const T = el => el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : null
  const steps = [...document.querySelectorAll('.v111-step')].map(b => ({ key: b.getAttribute('data-key'), label: T(b), on: b.classList.contains('on'), top: Math.round(b.getBoundingClientRect().top) }))
  const rows = sel => [...document.querySelectorAll(sel + ' .v111-row')].map(r => ({ k: T(r.querySelector('span')), v: T(r.querySelector('b')) }))
  const focus = [...document.querySelectorAll('.v111-focus')].map(c => ({ key: c.getAttribute('data-key'), name: T(c.querySelector('.gs-card-top b')), mul: T(c.querySelector('.v111-mul')), on: c.classList.contains('gs-sel') }))
  const fill = document.querySelector('.gs-field-fill')
  const wk = window.__V111_UI ? window.__V111_UI.week() : null
  const st = window.__getGridironState ? window.__getGridironState() : window.o
  const pl = (st && st.player) || (window.__V111_UI && window.__V111_UI.player()) || null
  return {
    steps, buy: rows('.v111-col.buy'), cost: rows('.v111-col.cost'),
    buyNote: T(document.querySelector('.v111-col.buy .v111-note')),
    head: T(document.querySelector('#v111Wrap .gs-head small')),
    chips: [...document.querySelectorAll('.v111-parts .v111-chip')].map(T),
    desc: T(document.getElementById('v111Desc')), plan: T(document.getElementById('v111Plan')),
    impact: T(document.querySelector('.gs-impact')), fillPct: fill ? fill.style.width : null,
    focus, sheetFocus: T(document.getElementById('preFocusV111')),
    usageV111: wk ? wk.usageV111 : undefined, focusV111: wk ? wk.focusV111 : undefined,
    gsPass: pl && pl._gameScriptV23 ? pl._gameScriptV23.gsPass : null,
    gsName: pl && pl._gameScriptV23 ? pl._gameScriptV23.name : null,
    pos: pl && pl.pos, modelIsA: !!(window.__V111 && typeof window.__V111.forecast === 'function'),
    fc: window.__V111_UI ? window.__V111_UI.forecast() : null,
    us: window.__V111_UI ? window.__V111_UI.usage() : null,
    scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth
  }
})
const tapStep = async k => { await page.evaluate(k => window.__v111PickUsageV111(k), k); await page.waitForTimeout(200) }
const tapFocus = async k => { await page.evaluate(k => { document.getElementById('v111Focus_' + k).click() }, k); await page.waitForTimeout(200) }

const A = await readUI()
console.log('     model =', A.modelIsA ? "agent A's window.__V111" : "the screen's own neutral stub")

// 1. the ladder
ok(A.steps.length === 5, 'five involvement steps', A.steps.map(s => s.key).join('/'))
ok(A.steps.every(s => s.top === A.steps[0].top), 'they sit on ONE row, not five paragraphs', 'tops=' + [...new Set(A.steps.map(s => s.top))].join(','))
ok(A.steps.filter(s => s.on).length === 1 && A.steps[2].on && A.steps[2].key === 'normal', 'the middle step is selected by default', A.steps.find(s => s.on)?.key)
ok(A.usageV111 === undefined || A.usageV111 === 'normal', 'no pick writes nothing (the default is today\'s game)', 'week.usageV111=' + A.usageV111)
ok(!A.focusV111, 'and no focus is active', 'week.focusV111=' + A.focusV111)

// 2. the pick is the state, and the cost moves with it
const num = (rows, k) => { const r = rows.find(x => new RegExp(k, 'i').test(x.k)); return r ? Number(String(r.v).replace(/[^\d.\-]/g, '')) : NaN }
await tapStep('everysnap')
const H = await readUI()
ok(H.usageV111 === 'everysnap', 'tapping a step writes week.usageV111', 'week.usageV111=' + H.usageV111)
ok(H.steps.find(s => s.key === 'everysnap').on && H.steps.filter(s => s.on).length === 1, 'and exactly that step lights up')
ok(H.desc !== A.desc, 'the step explains itself', JSON.stringify(H.desc).slice(0, 66))
await tapStep('limited')
const L = await readUI()
ok(L.usageV111 === 'limited', 'and again for another step', 'week.usageV111=' + L.usageV111)
const snapsA = num(A.buy, 'snap'), snapsH = num(H.buy, 'snap'), snapsL = num(L.buy, 'snap')
const touchA = num(A.buy, 'touch'), touchH = num(H.buy, 'touch'), touchL = num(L.buy, 'touch')
const wearA = num(A.cost, 'wear'), wearH = num(H.cost, 'wear'), wearL = num(L.cost, 'wear')
const injA = num(A.cost, 'injury'), injH = num(H.cost, 'injury'), injL = num(L.cost, 'injury')
// THE LADDER IS TWO LADDERS, and the screen has to be honest about which one it is on.
// BELOW normal the dial buys SNAPS — he is genuinely off the field and the share falls. It cannot
// keep buying them above normal, because at normal he is already on for every snap his unit takes
// and there is nothing left to sell. What the top half buys is the BALL: the touch multiplier.
// So: snaps rise up to normal and then plateau at 100%, touch share rises all the way, and the
// whole ladder is monotone non-decreasing in both.
ok(snapsL < snapsA, 'below NORMAL the dial buys SNAPS — he really comes off the field', `limited ${snapsL}% < normal ${snapsA}%`)
ok(snapsA >= 99.5 && snapsH >= 99.5 && snapsH <= snapsA + 0.5,
  'at NORMAL he is already on for every snap, so the top of the ladder cannot sell him more',
  `normal ${snapsA}% · every ${snapsH}%`)
ok(touchA < touchH, 'above NORMAL the dial buys the BALL instead — the touch share is what rises', `normal ×${touchA} < every ×${touchH}`)
ok(touchL < touchA, 'and the bottom of the ladder gives the ball back too', `limited ×${touchL} < normal ×${touchA}`)
const steps = await page.evaluate(async () => {
  const out = []
  for (const k of window.__V111_UI.KEYS) { window.__v111PickUsageV111(k); const u = window.__V111_UI.usage(); out.push({ k, share: u.share, touch: u.touchMul }) }
  return out
})
ok(steps.every((s, i) => !i || (s.share >= steps[i - 1].share - 1e-9 && s.touch >= steps[i - 1].touch - 1e-9)),
  'every step up the ladder is more football than the one below it, never less',
  steps.map(s => `${s.k} ${Math.round(s.share * 100)}%/×${s.touch}`).join(' → '))
// and the SCREEN has to say that, not imply a snap count that is never coming
ok(!/more snaps means more/i.test(A.head || '') && /ball/i.test(A.head || ''),
  'the panel heading promises the ball above NORMAL, not more snaps', A.head)
ok(/sideline/i.test(L.buyNote || '') && /ball that moves/i.test(H.buyNote || ''),
  'WHAT IT BUYS names which of the two rows is actually moving', `limited: "${L.buyNote}" | every: "${H.buyNote}"`)
ok(wearL < wearA && wearA < wearH, 'and costs more wear', `${wearL} < ${wearA} < ${wearH}`)
ok(injL < injA && injA < injH, 'and a higher injury chance for this game', `${injL}% < ${injA}% < ${injH}%`)
ok(num(L.cost, 'games out') <= num(A.cost, 'games out') && num(A.cost, 'games out') <= num(H.cost, 'games out'), 'and more expected games missed', `${num(L.cost, 'games out')} <= ${num(A.cost, 'games out')} <= ${num(H.cost, 'games out')}`)

// 3. the numbers on screen ARE the forecast's
await tapStep('heavy')
const V = await readUI()
const fc = V.fc, us = V.us
ok(!!fc && !!us, 'the model answers for the selected step', fc ? 'load=' + Math.round(fc.load) : 'none')
ok(Math.abs(num(V.cost, 'wear') - Math.round(fc.load)) < 1, 'WEAR on screen is forecast.load', `${num(V.cost, 'wear')} vs ${Math.round(fc.load)}`)
ok(Math.abs(num(V.cost, 'injury') - Math.round(fc.injPct)) < 1, 'INJURY on screen is forecast.injPct', `${num(V.cost, 'injury')}% vs ${Math.round(fc.injPct)}%`)
ok(Math.abs(num(V.cost, 'games out') - Math.round(fc.gamesMissed * 10) / 10) < .06, 'GAMES OUT on screen is forecast.gamesMissed', `${num(V.cost, 'games out')} vs ${(Math.round(fc.gamesMissed * 10) / 10).toFixed(1)}`)
ok(Math.abs(num(V.buy, 'snap') - Math.round(us.share * 100)) < 1, 'TEAM SNAPS on screen is usage.share', `${num(V.buy, 'snap')}% vs ${Math.round(us.share * 100)}%`)
ok(Math.abs(num(V.buy, 'touch') - Math.round(us.touchMul * 100) / 100) < .011, 'TOUCH SHARE on screen is usage.touchMul', `${num(V.buy, 'touch')} vs ${us.touchMul}`)

// 4. why this week is expensive
const parts = Array.isArray(fc.parts) ? fc.parts : []
ok(parts.length >= 3, 'the forecast itemises why', parts.map(p => p.label).join(' | '))
ok(parts.every(p => V.chips.some(c => c.indexOf(String(p.label)) === 0)), 'and every part is a chip on screen', V.chips.join(' | '))
ok(/durab/i.test(V.chips.join(' ')) && /opponent/i.test(V.chips.join(' ')), 'durability and the opponent are named', V.chips.slice(0, 2).join(' | '))
ok(Number.isFinite(fc.stakes) && fc.stakes >= 1, 'the fixture carries stakes', 'stakes=' + fc.stakes + ' opp=' + (Math.round((fc.oppMul || 0) * 100) / 100) + ' dur=' + (Math.round((fc.durMul || 0) * 100) / 100))
// the semifinal must price above the week-three game: ask the model with a playoff week
const stakeCmp = await page.evaluate(() => {
  const U = window.__V111_UI, pl = window.o && window.o.player, wk = U.week()
  const plain = { ...wk, playoff: false, round: null, week: 3, opponentV11: { ...(wk.opponentV11 || {}), importance: 'regular' } }
  const semi = { ...wk, playoff: true, round: 'Semifinal', opponentV11: { ...(wk.opponentV11 || {}), importance: 'championship', rating: ((wk.opponentV11 || {}).rating || 60) + 12 } }
  const a = U.forecast('heavy', pl, plain), b = U.forecast('heavy', pl, semi)
  return { plain: a.load, semi: b.load, plainInj: a.injPct, semiInj: b.injPct }
})
ok(stakeCmp.semi > stakeCmp.plain && stakeCmp.semiInj > stakeCmp.plainInj, 'a semifinal against a strong opponent costs more than week three',
  `load ${Math.round(stakeCmp.plain)}→${Math.round(stakeCmp.semi)} · injury ${Math.round(stakeCmp.plainInj)}%→${Math.round(stakeCmp.semiInj)}%`)

// 5. the focus
const POS_STATS = { QB: ['throwing', 'agility', 'awareness'], RB: ['strength', 'agility', 'acceleration'], WR: ['catching', 'agility', 'speed'], TE: ['blocking', 'catching', 'strength'], OL: ['blocking', 'strength', 'awareness'], DL: ['strength', 'quickness', 'tackling'], LB: ['tackling', 'awareness', 'speed'], CB: ['speed', 'agility', 'catching'], S: ['tackling', 'awareness', 'speed'] }
const modelFocus = await page.evaluate(p => window.__V111_UI.focusFor(p), V.pos)
ok(V.focus.length === 3, 'exactly three focus cards', V.focus.map(f => f.name).join(' | '))
ok(V.focus.every(f => /×1\.2/.test(f.mul || '')), 'each shows the stat and the multiplier', V.focus.map(f => f.mul).join(' | '))
const want = POS_STATS[V.pos] || []
ok(!want.length || modelFocus.every(f => want.indexOf(f.stat) >= 0), `they are ${V.pos}-appropriate`, modelFocus.map(f => f.stat).join('/') + ' vs ' + want.join('/'))
await tapFocus(V.focus[0].key)
const F1 = await readUI()
ok(F1.focusV111 === V.focus[0].key, 'picking one writes week.focusV111', 'week.focusV111=' + F1.focusV111)
ok(F1.focus.filter(f => f.on).length === 1 && F1.focus[0].on, 'and it is the only one lit')
ok(!!F1.sheetFocus && /×1\.2/.test(F1.sheetFocus), 'the stat sheet names it', F1.sheetFocus)
await tapFocus(V.focus[2].key)
const F2 = await readUI()
ok(F2.focusV111 === V.focus[2].key, 'picking another REPLACES it', 'week.focusV111=' + F2.focusV111)
ok(F2.focus.filter(f => f.on).length === 1, 'still exactly one active', F2.focus.filter(f => f.on).map(f => f.key).join(','))
await tapFocus(V.focus[2].key)
ok((await readUI()).focusV111 === null, 'tapping the live one drops it back to no focus')
await tapFocus(V.focus[1].key)

// 5b. the screen takes agent A's model when it is there — a synthetic window.__V111 with
// unmistakable numbers has to reach the pixels, and the stub has to step out of the way
const swap = await page.evaluate(() => {
  const had = window.__V111
  window.__V111 = {
    KEYS: ['limited', 'reduced', 'normal', 'heavy', 'everysnap'],
    usage: () => ({ key: 'heavy', share: .77, touchMul: 1.44, label: 'Bell Cow', desc: 'model' }),
    forecast: () => ({ load: 41, fatigueAfter: 64, injPct: 29, gamesMissed: .7, statCut: -5.5, parts: [{ label: 'Model part', mul: 1.23 }], stakes: 1.5, oppMul: 1.2, durMul: 1.1 }),
    focusFor: () => [{ key: 'm1', icon: '🧪', stat: 'speed', name: 'Model One', mul: 1.2, desc: 'a' }, { key: 'm2', icon: '🧪', stat: 'strength', name: 'Model Two', mul: 1.2, desc: 'b' }, { key: 'm3', icon: '🧪', stat: 'grit', name: 'Model Three', mul: 1.2, desc: 'c' }]
  }
  window.__v111PickUsageV111('heavy')
  const T = el => el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : ''
  const out = { buy: T(document.querySelector('.v111-col.buy')), cost: T(document.querySelector('.v111-col.cost')), chips: T(document.getElementById('v111Parts')) }
  if (had === undefined) delete window.__V111; else window.__V111 = had
  window.__v111PickUsageV111('heavy')
  return out
})
ok(/77%/.test(swap.buy) && /1\.44/.test(swap.buy) && /Bell Cow/.test(swap.buy), "A's usage() reaches WHAT IT BUYS", swap.buy)
ok(/\+41/.test(swap.cost) && /29%/.test(swap.cost) && /0\.7/.test(swap.cost) && /-5\.5/.test(swap.cost), "A's forecast() reaches WHAT IT COSTS", swap.cost)
ok(/Model part ×1\.23/.test(swap.chips) && /fatigue after 64/.test(swap.chips), "and its parts are the chips", swap.chips)

// 6. nothing was lost
const P = await readUI()
ok(typeof P.gsPass === 'number' && P.gsPass > 0 && P.gsPass < 1, 'the coordinator still adopted a plan', `${P.gsName} · gsPass=${Math.round(P.gsPass * 100)}%`)
ok(/coordinator's plan/i.test(P.plan || '') && /% pass/.test(P.plan || ''), 'and it reads back as one compact line', P.plan)
ok(!!P.fillPct && parseFloat(P.fillPct) > 0, 'the impact bar still renders its fill', 'width=' + P.fillPct)
ok(/GAME SCRIPT/.test(P.impact || ''), 'with the game-script read under it', (P.impact || '').slice(0, 64))

// 7. it is a phone
ok(P.scrollW <= P.clientW + 1, 'no horizontal scroll at a 400px viewport', `scrollW=${P.scrollW} clientW=${P.clientW}`)
const wide = await page.evaluate(() => [...document.querySelectorAll('#v111Wrap *, #v111FocusWrap *')].filter(el => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1).map(el => el.className).slice(0, 4))
ok(!wide.length, 'and nothing in the two new blocks hangs off the right edge', wide.join(' | ') || 'clean')

await page.evaluate(() => { const el = document.getElementById('v111Wrap'); el && el.scrollIntoView({ block: 'center' }) })
await page.waitForTimeout(300)
await page.screenshot({ path: SHOT })
console.log('\nshot', SHOT)

// 8. the flow still opens
await page.evaluate(() => window.continuePregameV1513 && window.continuePregameV1513())
await page.waitForTimeout(1500)
ok(await page.evaluate(() => !document.getElementById('pregameV1513')), 'CONTINUE TO MATCH still leaves the screen')
console.log(`${pass} ok, ${fail} failed | page errors: ${errs.length ? '\n' + errs.slice(0, 6).join('\n') : 'NONE'}`)
await browser.close()
process.exit(fail ? 1 : 0)
