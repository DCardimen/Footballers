// Dev check: v112 (D) — THE PREGAME, ONE DECISION AT A TIME. Drives a real career to the pregame
// screen at PHONE width and works the wizard the way a thumb would:
//   * ONE DECISION A PAGE — four pages, exactly one visible at a time, and the page carrying a
//     decision carries only that decision: the ladder is alone on page 1, the focus cards alone on
//     page 2, the scout and the coordinator's plan on page 3, the stat sheet on page 4.
//   * NEXT AND BACK — NEXT walks forward, BACK walks back, the step counter and the dots follow,
//     and BACK from page 1 leaves the pregame screen entirely (the old Back button's job).
//   * A CHOICE SURVIVES THE ROUND TRIP — pick an involvement on 1 and a focus on 2, walk to the
//     end and back, and both are still written to the week AND still lit on their own page.
//   * THE DEFAULTS REACH THE GAME UNTOUCHED — open the screen, press nothing, skip: usageV111 is
//     unwritten (or `normal`), focusV111 is unset, and the coordinator's plan is still adopted.
//   * THE LAST PAGE IS THE MODEL — every number in THE IMPACT ON NEXT GAME is compared against
//     window.__V111.forecast/usage for the step that is actually selected, and it MOVES when the
//     step moves. The sheet under it re-renders with the focus applied.
//   * ONE WAY TO THE FIELD, ALWAYS — a visible control whose label contains CONTINUE TO MATCH on
//     every single page (the skip strip on 1-3, the primary button on 4), never two at once, and
//     it really does reach the live game.
//   * IT IS A PHONE — no horizontal scroll and nothing off the right edge, on any of the pages.
//   node scripts/v112Dcheck.mjs        (GAME_URL, POS=RB, SHOT=dir)
import { chromium } from 'playwright'

const URL = process.env.GAME_URL || 'http://localhost:5173/'
const POS = process.env.POS || 'RB'
const SHOT = process.env.SHOT || 'scripts/_v112D'
const POS_LABEL = { QB: 'QB Quarterback', RB: 'RB Running Back', WR: 'WR Wide Receiver', TE: 'TE Tight End', OL: 'OL Offensive Line', DL: 'DL Defensive Line', LB: 'LB Linebacker', CB: 'CB Cornerback', S: 'S Safety' }[POS] || POS

let pass = 0, fail = 0
const errs = []
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
// 400px on purpose — the complaint this whole version answers is that the screen was a wall on a phone
const page = await browser.newPage({ viewport: { width: 400, height: 900 } })
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })

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
async function toPregame() {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 })
  await page.waitForTimeout(2500)
  for (const s of ['START NEW CAREER', 'ARCH', POS_LABEL, 'Lock In Personality', 'PLAY 8-GAME SEASON']) await click(s)
  for (let i = 0; i < 60; i++) { const d = await page.evaluate(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') { g.click(); return false } return !document.getElementById('growthV42') }); if (d) break; await page.waitForTimeout(300) }
  await click('Balanced Program'); await click('CONFIRM TRAINING')
  await page.evaluate(() => { const el = [...document.querySelectorAll('button')].find(e => /PLAY WEEK 1 LIVE/.test(e.innerText || '')); el && el.click() })
  for (let i = 0; i < 80; i++) {
    if (await page.evaluate(() => !!document.getElementById('pregameV1513'))) break
    await page.evaluate(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') g.click() })
    await page.waitForTimeout(250)
  }
  return page.evaluate(() => !!document.getElementById('pregameV1513'))
}

ok(await toPregame(), 'the pregame screen opened')

// ---- what the wizard says, scraped back out of the DOM as a viewer would see it
const readWiz = () => page.evaluate(({ visSrc }) => {
  const vis = eval(visSrc)
  const T = el => el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : null
  const host = document.getElementById('pregameV1513')
  const pages = [...document.querySelectorAll('.v112-page')].map(p => ({ id: p.id, shown: vis(p) }))
  const S = window.__V112_D ? window.__V112_D.state() : null
  // every visible control anywhere on the screen whose label offers the field
  const gos = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    .map(e => T(e)).filter(t => t && /CONTINUE TO MATCH/i.test(t))
  const dots = [...document.querySelectorAll('.v112-dots i')].map(d => d.className)
  const wideR = host ? [...host.querySelectorAll('*')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > document.documentElement.clientWidth + 1 }).map(el => (el.className || el.tagName).toString().slice(0, 34)) : []
  return {
    page: S ? S.page : null, pages, dots, gos,
    kick: T(document.getElementById('v112Kick')), title: T(document.getElementById('v112Title')),
    next: T(document.getElementById('v112Next')), back: T(document.getElementById('v112Back')),
    skipHidden: (document.getElementById('v112Skip') || {}).hidden,
    // the decision controls, and whether the viewer can actually SEE them right now
    ladder: [...document.querySelectorAll('.v111-step')].map(b => ({ k: b.getAttribute('data-key'), on: b.classList.contains('on'), vis: vis(b), h: Math.round(b.getBoundingClientRect().height) })),
    focus: [...document.querySelectorAll('.v111-focus')].map(c => ({ k: c.getAttribute('data-key'), on: c.classList.contains('gs-sel'), vis: vis(c), h: Math.round(c.getBoundingClientRect().height) })),
    planVis: vis(document.getElementById('v111PlanWrap') || document.createElement('i')),
    plan: T(document.getElementById('v111Plan')), impactBar: T(document.querySelector('.gs-impact')),
    fillPct: (document.querySelector('.gs-field-fill') || {}).style?.width || null,
    imp: T(document.getElementById('v112ImpD')), sheet: T(document.getElementById('preStatsV25')),
    sheetFocus: T(document.getElementById('preFocusV111')),
    S, wideR: wideR.slice(0, 4),
    scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth
  }
}, { visSrc: vis })
const tapNext = async () => { await page.evaluate(() => document.getElementById('v112Next').click()); await page.waitForTimeout(260) }
const tapBack = async () => { await page.evaluate(() => document.getElementById('v112Back').click()); await page.waitForTimeout(260) }
const impNum = (imp, k) => { const m = new RegExp(k + '\\s+([^A-Za-z]*[-+]?[\\d.]+)', 'i').exec(imp || ''); return m ? Number(m[1].replace(/[^\d.\-]/g, '')) : NaN }
// the panel prints a signed number the way v111Sig does: whole above ten, one decimal below it
const sig = n => Math.abs(n) >= 10 ? Math.round(n) : Math.round(n * 10) / 10
const impSnaps = imp => { const m = /Involvement[^\n]*?(\d+)% snaps/.exec(imp || ''); return m ? Number(m[1]) : NaN }

// ---------------------------------------------------------------- 1. one decision a page
const P1 = await readWiz()
ok(P1.pages.length === 4, 'the screen is four pages', P1.pages.map(p => p.id).join('/'))
ok(P1.pages.filter(p => p.shown).length === 1 && P1.pages[0].shown, 'exactly one of them is on screen, and it is the first', P1.pages.map(p => p.id + '=' + p.shown).join(' '))
ok(/STEP 1 OF 4/.test(P1.kick) && /INVOLVEMENT/i.test(P1.kick), 'page 1 announces itself', P1.kick + ' — "' + P1.title + '"')
ok(P1.ladder.length === 5 && P1.ladder.every(s => s.vis), 'the five-step ladder is the decision on page 1', P1.ladder.map(s => s.k).join('/'))
ok(P1.ladder.every(s => s.h >= 44), 'and its steps are thumb-sized', 'min height ' + Math.min(...P1.ladder.map(s => s.h)) + 'px')
ok(!P1.focus.some(f => f.vis) && !P1.planVis, 'the focus cards and the coordinator are NOT competing with it', `focus visible=${P1.focus.filter(f => f.vis).length} plan=${P1.planVis}`)
ok(P1.dots.length === 4 && P1.dots[0] === 'on', 'a page indicator says where he is', P1.dots.join('|'))

await tapNext()
const P2 = await readWiz()
ok(P2.page === 1 && P2.pages[1].shown && P2.pages.filter(p => p.shown).length === 1, 'NEXT moves to page 2 and nothing else comes with it', P2.kick)
ok(P2.focus.length === 3 && P2.focus.every(f => f.vis), 'the three focus cards are the decision on page 2', P2.focus.map(f => f.k).join('/'))
ok(P2.focus.every(f => f.h >= 60), 'and they are cards, not lines', 'min height ' + Math.min(...P2.focus.map(f => f.h)) + 'px')
ok(!P2.ladder.some(s => s.vis), 'the ladder is behind him now', 'ladder visible=' + P2.ladder.filter(s => s.vis).length)

await tapNext()
const P3 = await readWiz()
ok(P3.page === 2 && P3.pages[2].shown, 'page 3 is the scout and the plan', P3.kick)
ok(P3.planVis && /coordinator's plan/i.test(P3.plan || '') && /% pass/.test(P3.plan || ''), 'the coordinator reads back as one line', P3.plan)
ok(/GAME SCRIPT/.test(P3.impactBar || '') && !!P3.fillPct && parseFloat(P3.fillPct) > 0, 'and the impact bar draws its fill', 'width=' + P3.fillPct)
ok(/NEXT/i.test(P3.next), 'nothing on it is required — NEXT is live with no input', P3.next)

await tapNext()
const P4 = await readWiz()
ok(P4.page === 3 && P4.pages[3].shown, 'page 4 is the impact', P4.kick)
ok(!!P4.imp && !!P4.sheet, 'the effect on next game, and the sheet under it', (P4.imp || '').slice(0, 58))
ok(/CONTINUE TO MATCH/i.test(P4.next || ''), 'and the button into the game is the primary one', P4.next)

// ---------------------------------------------------------------- 2. back, and the choice survives
await tapBack(); await tapBack()
const B2 = await readWiz()
ok(B2.page === 1, 'BACK walks back a page at a time', 'page ' + (B2.page + 1) + ' — ' + B2.kick)
await page.evaluate(() => document.getElementById('v111Focus_' + window.__V111_UI.focusFor(window.__V111_UI.player().pos)[2].key).click())
await page.waitForTimeout(250)
const pickedFocus = (await readWiz()).S.weekFocus
ok(!!pickedFocus, 'a focus picked on page 2 writes week.focusV111', 'week.focusV111=' + pickedFocus)
await tapBack()
const B1 = await readWiz()
ok(B1.page === 0 && B1.ladder.every(s => s.vis), 'and BACK again is the ladder', B1.kick)
await page.evaluate(() => document.getElementById('v111Step_everysnap').click())
await page.waitForTimeout(250)
const U = await readWiz()
ok(U.S.weekUsage === 'everysnap' && U.ladder.find(s => s.k === 'everysnap').on, 'an involvement picked on page 1 writes week.usageV111', 'week.usageV111=' + U.S.weekUsage)

await tapNext(); await tapNext(); await tapNext()      // all the way to the end
await tapBack(); await tapBack(); await tapBack()      // and all the way home
const R = await readWiz()
ok(R.page === 0, 'the round trip lands back on page 1', R.kick)
ok(R.S.weekUsage === 'everysnap' && R.ladder.find(s => s.k === 'everysnap').on && R.ladder.filter(s => s.on).length === 1,
  'the involvement he chose is still chosen, and still lit', 'week.usageV111=' + R.S.weekUsage)
await tapNext()
const R2 = await readWiz()
ok(R2.S.weekFocus === pickedFocus && R2.focus.find(f => f.k === pickedFocus).on && R2.focus.filter(f => f.on).length === 1,
  'and so is the focus, on its own page', 'week.focusV111=' + R2.S.weekFocus)

// ---------------------------------------------------------------- 3. BACK from page 1 leaves
await tapBack()
await tapBack()
ok(await page.evaluate(() => !document.getElementById('pregameV1513')), 'BACK from page 1 leaves the pregame screen, as the old Back button did')

// ---------------------------------------------------------------- 4. the last page IS the model
ok(await toPregame(), 'the screen opens again on a clean week')
const seen = []
for (const k of ['limited', 'normal', 'everysnap']) {
  await page.evaluate(() => window.__V112_D.go(0))
  await page.evaluate(k => document.getElementById('v111Step_' + k).click(), k)
  await page.waitForTimeout(180)
  await page.evaluate(() => window.__V112_D.go(3))
  await page.waitForTimeout(260)
  const F = await readWiz()
  const m = F.S.forecast, us = F.S.usage
  const row = { k, wear: impNum(F.imp, 'Wear this game'), inj: impNum(F.imp, 'Injury at this load'), miss: impNum(F.imp, 'Games it costs'), snaps: impSnaps(F.imp), mLoad: m.load, mInj: m.injPct, mMiss: m.gamesMissed, mShare: us.share }
  seen.push(row)
  ok(F.S.key === k, `the last page is priced for the step he actually chose (${k})`, 'key=' + F.S.key)
  ok(Math.abs(row.wear - sig(m.load)) < .06, '  WEAR equals forecast.load', `${row.wear} vs ${sig(m.load)}`)
  ok(Math.abs(row.inj - Math.round(m.injPct)) < 1, '  INJURY AT THIS LOAD equals forecast.injPct', `${row.inj}% vs ${Math.round(m.injPct)}%`)
  ok(Math.abs(row.miss - Math.round(m.gamesMissed * 10) / 10) < .06, '  GAMES IT COSTS equals forecast.gamesMissed', `${row.miss} vs ${(Math.round(m.gamesMissed * 10) / 10).toFixed(1)}`)
  ok(Math.abs(row.snaps - Math.round(us.share * 100)) < 1, '  INVOLVEMENT names usage.share', `${row.snaps}% vs ${Math.round(us.share * 100)}%`)
}
ok(seen[0].mLoad < seen[1].mLoad && seen[1].mLoad < seen[2].mLoad && seen[0].wear < seen[2].wear,
  'and the panel MOVES with the step — limited is cheaper than every snap', seen.map(r => `${r.k} ${r.wear}`).join(' → '))
// the focus reaches the sheet on the same page
const fk = await page.evaluate(() => { window.__V112_D.go(1); const l = window.__V111_UI.focusFor(window.__V111_UI.player().pos); document.getElementById('v111Focus_' + l[0].key).click(); return l[0].key })
await page.waitForTimeout(200)
await page.evaluate(() => window.__V112_D.go(3)); await page.waitForTimeout(300)
const FP = await readWiz()
ok(/Game focus/i.test(FP.imp) && !/None/.test(FP.imp.split('Body')[0]), 'the focus he picked is named on the last page', (FP.imp || '').slice(0, 120))
ok(!!FP.sheetFocus && /×1\.2/.test(FP.sheetFocus), 'and the stat sheet under it carries the multiplier', FP.sheetFocus)
ok(/%/.test((FP.imp.match(/Body[^A-Za-z]*([-+]?\d+% to every attribute)/) || [])[1] || ''), 'the body\'s own swing is stated too', (FP.imp.match(/Body[^A-Za-z]*([-+]?\d+% to every attribute)/) || [])[1])

// ---------------------------------------------------------------- 5. the way to the field, on every page
for (let i = 0; i < 4; i++) {
  await page.evaluate(i => window.__V112_D.go(i), i)
  await page.waitForTimeout(220)
  const W = await readWiz()
  ok(W.gos.length === 1, `page ${i + 1}: exactly one visible CONTINUE TO MATCH`, W.gos.join(' | ') || 'NONE')
  ok(W.scrollW <= W.clientW + 1 && !W.wideR.length, `page ${i + 1}: no horizontal scroll at 400px`, `scrollW=${W.scrollW} clientW=${W.clientW}${W.wideR.length ? ' over:' + W.wideR.join(',') : ''}`)
  const h = await page.evaluate(() => document.getElementById('pregameV1513').scrollHeight)
  await page.setViewportSize({ width: 400, height: Math.min(2400, Math.max(900, h + 20)) })
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${SHOT}_p${i + 1}.png` })
  await page.setViewportSize({ width: 400, height: 900 })
}
console.log('     shots', `${SHOT}_p1..p4.png`)

// ---------------------------------------------------------------- 6. the defaults reach the game untouched
ok(await toPregame(), 'a third open, and this time he touches nothing')
const D = await readWiz()
ok(D.S.weekUsage === undefined || D.S.weekUsage === 'normal', 'no involvement is written', 'week.usageV111=' + D.S.weekUsage)
ok(!D.S.weekFocus, 'no focus is written', 'week.focusV111=' + D.S.weekFocus)
ok(D.ladder.filter(s => s.on).length === 1 && D.ladder[2].on, 'the ladder still shows NORMAL as the standing default', D.ladder.find(s => s.on).k)
ok(typeof D.S.gsPass === 'number' && D.S.gsPass > 0 && D.S.gsPass < 1, 'and the coordinator has adopted his plan anyway', 'gsPass=' + Math.round(D.S.gsPass * 100) + '%')
// the skip strip on page 1 is a real one-tap road to the field
await click('CONTINUE TO MATCH')
await page.waitForTimeout(2500)
const ST = `() => window.__GRIDIRON_AUDIT__?.getState?.() || window.o || null`
const live = await page.evaluate(src => ({ gone: !document.getElementById('pregameV1513'), view: (eval(src)() || {}).view }), ST)
ok(live.gone, 'skipping from page 1 leaves the pregame screen', 'view=' + live.view)
for (let i = 0; i < 80; i++) { if (await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length))) break; await page.waitForTimeout(400) }
ok(await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length)),
  'and it reaches the live game', 'view=' + (await page.evaluate(src => (eval(src)() || {}).view, ST)))
ok(await page.evaluate(src => { const st = eval(src)(); const w = ((st && st.player && st.player.weekResults) || []).find(x => x && x.usageV111 !== undefined); return !w || w.usageV111 === 'normal' }, ST),
  'with the defaults still exactly what they were — nothing was written on his behalf')

console.log(`\n${pass} ok, ${fail} failed | page errors: ${errs.length ? '\n' + errs.slice(0, 6).join('\n') : 'NONE'}`)
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
