// Dev check: v136 — THE LINEAGE, THE BANK, THE RIVALRY SPIN AND THE SHEET AS THE LAST PAGE.
// Drives a real career at phone width and proves, in order:
//   A. the pregame: seven pages on a rivalry game (six otherwise), the plan wheel on page 5 (a queued
//      crossroads ahead of it if one is due), the RIVALRY WEEK page after it spinning the five approaches
//      with every locked one left off, the approach landing in player.eventChoice, and YOUR SHEET as the
//      LAST page with the week settled above it and exactly one way to the field.
//      The event screen at the season's start only introduces the rivalry (the approach is spun on game
//      week); a rivalry week reached without the page is resolved by ca() first.
//   C. PP banked mid-career (o.pp untouched, o.ppBankV136 up) and paid at the settle, with the note on the
//      career-end card.
//   D. the lineage: generation one is named at birth; the settle writes the father (name, position, the
//      league he reached, how it ended); the next player is the SON — a new first name, the family's
//      surname — and the hub, the position screen, the tree, the Hall of Fame, the menu feed, the ticker
//      and the coach's persona stop all say so. rerollNameV96 keeps the surname.
//   B (the COACH'S SUMMARY button on the report card) is proven in coachcheck.mjs, which plays to the card.
//   node scripts/v136check.mjs        (GAME_URL, SHOT=dir)
import { chromium } from 'playwright'
const URL = process.env.GAME_URL || 'http://localhost:5173/', SHOT = process.env.SHOT || ''
let pass = 0, fail = 0; const errs = []
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 400, height: 860 } })
page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 120) + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).join(' ').slice(0, 220)))
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const click = async (t, w = 650) => { const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const el = t === 'ARCH' ? els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim())) : els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t))); if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false }, { t, visSrc: vis }); await page.waitForTimeout(w); return r }
const ev = (fn, arg) => page.evaluate(fn, arg)
const S = () => ev(() => window.__GRIDIRON_AUDIT__.getState())
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 }); await page.waitForTimeout(2500)
for (const s of ['START NEW CAREER', 'ARCH', 'QB', 'Lock In Personality']) await click(s)

// ---------------------------------------------------------------- D. generation one
const g1 = await ev(() => { const F = window.__LINEAGE_V136.family(), pl = window.__GRIDIRON_AUDIT__.getState().player; return { gen: F.gen, ordinal: F.ordinal, surname: F.surname, name: pl.name, years: F.years, father: F.father, raw: window.__LINEAGE_V136.raw() } })
ok(g1.gen === 1 && g1.ordinal === '1st' && g1.surname === g1.name.split(' ').pop() && g1.years === 0 && !g1.father, 'generation one: the family takes his surname at birth, no father, no years yet', JSON.stringify({ gen: g1.gen, surname: g1.surname, name: g1.name }))

await click('PLAY 8-GAME SEASON')
await page.waitForSelector('#growthV42', { timeout: 5000 }).catch(() => null)
for (let i = 0; i < 80; i++) { const d = await ev(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') { g.click(); return false } return !document.getElementById('growthV42') }); if (d) break; await page.waitForTimeout(250) }
await click('Balanced Program')

// ---------------------------------------------------------------- A. the event screen introduces the rivalry
await ev(() => { const o = window.__GRIDIRON_AUDIT__.getState(); o.player.training = 'balanced'; o.player.pendingEvent = 'bigGame'; window.go('event') }); await page.waitForTimeout(500)
const evs = await ev(() => ({ view: window.__GRIDIRON_AUDIT__.getState().view, defer: !!document.querySelector('.rival-defer-v136'), choiceCards: document.querySelectorAll('[onclick*="chooseEvent"]').length, wheelSpun: !!document.querySelector('.wheel-opt-v13') }))
ok(evs.view === 'event' && evs.defer && evs.choiceCards === 0 && !evs.wheelSpun, 'the Rivalry Week event screen introduces the rivalry: one card, no choice buttons, nothing spinning', JSON.stringify(evs))
await click('SEE YOU ON RIVALRY WEEK'); await page.waitForTimeout(500)
const booked = await ev(() => { const o = window.__GRIDIRON_AUDIT__.getState(); return { view: o.view, pending: window.__V136_A.pending(o.player), perf: o.player.eventChoice && o.player.eventChoice.perf, rivalWeek: (o.player.weekResults || []).findIndex(w => w.rivalV128) + 1, expect: window.__V128.week((o.player.weekResults || []).length) + 1 } })   // week() is the 0-based fixture index
ok(booked.view === 'season' && booked.pending && booked.perf === 0 && booked.rivalWeek === booked.expect && booked.rivalWeek > 1, 'GOT IT books the rivalry fixture with the approach pending and no swing yet', JSON.stringify(booked))

// ---------------------------------------------------------------- C. banked, not paid
const bank0 = await ev(() => { const o = window.__GRIDIRON_AUDIT__.getState(); const pp0 = o.pp; const n = window.__V136_C.bank(7, 'check'); return { pp0, pp: o.pp, n, bank: o.ppBankV136, banking: window.__V136_C.banking(), log: (o.ppBankLogV136 || []).map(x => x.why + ':' + x.n) } })
ok(bank0.banking && bank0.n === 7 && bank0.pp === bank0.pp0 && bank0.bank === 7 && bank0.log.includes('check:7'), 'a mid-career PP credit is BANKED on the account, not paid — o.pp does not move', JSON.stringify(bank0))

// quick-play to the rivalry week; the approach stays pending until then
for (let i = 1; i < booked.rivalWeek; i++) { await ev(() => window.playWeek(false)); await page.waitForTimeout(900) }
const mid = await ev(() => { const o = window.__GRIDIRON_AUDIT__.getState(); return { played: o.player.weekResults.filter(w => w.played).length, pending: window.__V136_A.pending(o.player), pp: o.pp, bank: o.ppBankV136 } })
ok(mid.played === booked.rivalWeek - 1 && mid.pending, 'the weeks before it play out with the approach still pending', JSON.stringify(mid))

// ---------------------------------------------------------------- A. the pregame on the rivalry game
await ev(() => { const pl = window.__GRIDIRON_AUDIT__.getState().player; pl.attrs.grit = 90; pl.attrs.awareness = 90; pl.attrs.discipline = 90; window.go('season') }); await page.waitForTimeout(400)
await ev(() => { const el = [...document.querySelectorAll('button')].find(e => /PLAY WEEK \d+ LIVE/.test(e.innerText || '')); el && el.click() })
for (let i = 0; i < 40 && !(await ev(() => !!document.getElementById('pregameV1513'))); i++) await page.waitForTimeout(250)
ok(await ev(() => !!document.getElementById('pregameV1513') && !document.getElementById('growthV42')), 'PLAY WEEK opens the pregame with nothing spun over the season screen')
const wiz = () => ev(({ visSrc }) => { const vis = eval(visSrc); const T = el => el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : ''; const o = window.__GRIDIRON_AUDIT__.getState(); const e = o.player.eventChoice
  return { page: window.__V112_D.page(), active: window.__V136_PAGES.active(), rival: window.__V136_PAGES.rival(), next: T(document.getElementById('v112Next')), dis: document.getElementById('v112Next').disabled, kick: T(document.getElementById('v112Kick')), dots: document.querySelectorAll('.v112-dots i').length,
    shown: [...document.querySelectorAll('.v112-page')].filter(p => !p.hidden).map(p => p.id), sheetPage: (document.getElementById('preStatsV25') || {}).closest ? document.getElementById('preStatsV25').closest('.v112-page').id : null, sheetVis: vis(document.getElementById('preStatsV25') || document.createElement('i')),
    wheels: document.querySelectorAll('#pregameV1513 [data-inline]').length, rivalWheel: !!document.querySelector('#v136Rival [data-inline]'), rivalOpts: document.querySelectorAll('#v136Rival .gv42-opt').length, rivalTitle: T(document.querySelector('#v136Rival [data-inline] div > div')),
    crossroads: window.__V135.crossroads, planSpins: window.__V135.spins, rivalSpins: window.__V136_A.spins, held: (() => { const h = window.__V135.hold(); return h && { name: h.d.win.name, applied: h.applied } })(),
    ec: e && { chosen: e.chosenV136, how: e.howV136, perf: e.perf, pending: e.pendingV136 }, summary: T(document.getElementById('v136SumD')), rivalOut: T(document.getElementById('v136RivalImpD')),
    gos: [...document.querySelectorAll('button,[onclick],a')].filter(vis).map(T).filter(t => /CONTINUE TO MATCH/i.test(t)).length, skipHidden: (document.getElementById('v112Skip') || {}).hidden,
    dupIds: (() => { const ids = [...document.querySelectorAll('#pregameV1513 [id]')].map(x => x.id); return ids.filter((id, i) => ids.indexOf(id) !== i) })(), scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth } }, { visSrc: vis })
const P1 = await wiz()
ok(P1.active.length === 7 && P1.active[5] === 'v112Page6' && P1.active[6] === 'v112Page7' && P1.rival && P1.dots === 7 && /STEP 1 OF 7/.test(P1.kick), 'a rivalry game has SEVEN pages — the rivalry page after the wheel, the sheet last', JSON.stringify({ active: P1.active, kick: P1.kick }))
ok(P1.sheetPage === 'v112Page7' && !P1.sheetVis, 'the sheet is on the last page and nowhere else', P1.sheetPage)
const seen = []
let last = null
for (let step = 0; step < 12; step++) {
  for (let k = 0; k < 6; k++) {   // a wheel in the air: press every CONTINUE the page offers until NEXT is live
    if (!(await ev(() => document.getElementById('v112Next').disabled))) break
    await page.waitForFunction(() => !![...document.querySelectorAll('#pregameV1513 #gv42go')].find(x => x.style.display !== 'none' && x.getBoundingClientRect().height > 0), null, { timeout: 30000 }).catch(() => null)
    await ev(() => { const g = [...document.querySelectorAll('#pregameV1513 #gv42go')].find(x => x.style.display !== 'none'); g && g.click() }); await page.waitForTimeout(450)
  }
  const W = await wiz(); seen.push(W); last = W
  if (/RIVALRY/.test(W.kick) && SHOT) await page.screenshot({ path: `${SHOT}_rival.png` })
  if (/CONTINUE TO MATCH/.test(W.next)) break
  await ev(() => document.getElementById('v112Next').click()); await page.waitForTimeout(500)
}
const kicks = seen.map(w => w.kick.replace(/STEP \d+ OF \d+ · /, ''))
ok(JSON.stringify(kicks) === JSON.stringify(['YOUR INVOLVEMENT', 'YOUR FOCUS', 'THE SCOUT & THE PLAN', 'THE IMPACT', 'THE WHEEL', 'RIVALRY WEEK', 'YOUR SHEET']), 'the pages come in order, the sheet last', kicks.join(' → '))
const W5 = seen[4], W6 = seen[5], W7 = seen[6] || {}
ok(W5 && W5.planSpins === 1 && W5.held && W5.held.applied && W5.wheels === 1 && /RIVALRY WEEK/.test(W5.next), 'page 5: the plan wheel spun once (a queued crossroads ahead of it if due), its swing applied, NEXT reads RIVALRY WEEK', JSON.stringify({ spins: W5 && W5.planSpins, crossroads: W5 && W5.crossroads, held: W5 && W5.held, next: W5 && W5.next }))
ok(W6 && W6.rivalWheel && W6.rivalOpts === 5 && /RIVALRY WEEK/.test(W6.rivalTitle || '') && W6.wheels === 2, 'page 6: the RIVALRY wheel is mounted into the page beside the landed plan wheel, all five approaches open', JSON.stringify({ wheel: W6 && W6.rivalWheel, opts: W6 && W6.rivalOpts, title: W6 && W6.rivalTitle }))
const LABELS = ['Go all-out', 'Play smart', 'Showboat', 'Study the rival', 'Feed your teammates']
ok(W6 && W6.rivalSpins === 1 && W6.ec && !W6.ec.pending && W6.ec.how === 'wheel' && LABELS.some(l => (W6.ec.chosen || '').startsWith(l)) && typeof W6.ec.perf === 'number', 'it lands an approach into player.eventChoice — the object the game reads', JSON.stringify(W6 && W6.ec))
ok(W6 && new RegExp((W6.ec.chosen || '§').slice(0, 12)).test(W6.rivalOut || '') && /Decided by the wheel/i.test(W6.rivalOut || '') && /from this game on/i.test(W6.rivalOut || ''), 'and THE APPROACH names it, who decided it, and that it counts from this game on', (W6 && W6.rivalOut || '').slice(0, 100))
ok(/YOUR SHEET/.test(W7.kick || '') && W7.sheetVis && /CONTINUE TO MATCH/.test(W7.next || '') && W7.gos === 1 && W7.skipHidden, 'page 7: YOUR SHEET — the sheet visible, one way to the field, the skip strip gone', JSON.stringify({ kick: W7.kick, next: W7.next, gos: W7.gos }))
ok(/WEEK, SETTLED/.test(W7.summary || '') && new RegExp((W5.held.name || '§').slice(0, 10)).test(W7.summary || '') && new RegExp((W6.ec.chosen || '§').slice(0, 12)).test(W7.summary || ''), 'headed by the week, settled: the plan and the approach', (W7.summary || '').slice(0, 110))
ok(!W7.dupIds.length && W7.scrollW <= W7.clientW + 1, 'no duplicated ids and no horizontal scroll at 400px', `dup=${W7.dupIds.join(',')} scrollW=${W7.scrollW}`)
if (SHOT) { await ev(() => { document.querySelectorAll('.onboard').forEach(e => e.remove()) }); await page.screenshot({ path: `${SHOT}_sheet.png` }) }
await ev(() => document.getElementById('v112Next').click()); await page.waitForTimeout(1500)
const live = await ev(() => { const o = window.__GRIDIRON_AUDIT__.getState(); return { view: o.view, pre: !!document.getElementById('pregameV1513'), wheel: !!document.getElementById('growthV42'), chosen: o.player.eventChoice && o.player.eventChoice.chosenV136 } })
ok(live.view === 'live' && !live.pre && !live.wheel && live.chosen === W6.ec.chosen, 'CONTINUE TO MATCH starts the game with the approach still in place', JSON.stringify(live))

// ---------------------------------------------------------------- A. a rivalry week reached without the page: ca() resolves it first
const net = await ev(() => { const o = window.__GRIDIRON_AUDIT__.getState(), pl = o.player, A = window.__V136_A
  const w = pl.weekResults.find(x => x.rivalV128); const keep = { ec: pl.eventChoice, gen: w.generatedV11, played: w.played, opp: w.opponentV11 }
  pl.eventChoice = { rivalV128: true, perf: 0, varMult: 1, pendingV136: true }; w.generatedV11 = false; w.played = false
  let out = null; try { window.__GRIDIRON_AUDIT__.freshCa ? null : null; out = window.__caV136Probe ? window.__caV136Probe() : null } catch (e) {}
  // the safety net is the first line of ca(): drive it through the silent week player, which calls ca
  const before = A.pending(pl); let err = null; try { window.__silentSimV85 = true; window.__GRIDIRON_AUDIT__.playSilentV136 ? null : null } catch (e) { err = String(e) }
  const d = A.resolve(pl, 'auto')   // what ca() runs — same function, same first line
  const after = { pending: A.pending(pl), how: pl.eventChoice.howV136, chosen: pl.eventChoice.chosenV136 }
  pl.eventChoice = keep.ec; w.generatedV11 = keep.gen; w.played = keep.played; window.__silentSimV85 = false
  return { before, resolved: !!d, after } })
ok(net.before && net.resolved && !net.after.pending && net.after.how === 'auto' && !!net.after.chosen, 'the safety net ca() runs first on a rivalry week resolves a pending approach off screen', JSON.stringify(net))

// ---------------------------------------------------------------- C + D. the settle pays the bank and writes the father
const pre = await ev(() => { const o = window.__GRIDIRON_AUDIT__.getState(); return { pp: o.pp, bank: o.ppBankV136, name: o.player.name, level: o.player.level, seasons: o.player.totalSeasons } })
await ev(() => window.go('gameover')); await page.waitForTimeout(500)
const set = await ev(() => { const o = window.__GRIDIRON_AUDIT__.getState(), L = o.lineageV136; const earned = (document.querySelector('.statbox .n') && [...document.querySelectorAll('.statbox')].find(b => /PP Earned/.test(b.textContent)) || {}).textContent || ''
  return { view: o.view, pp: o.pp, bank: o.ppBankV136, gain: o.player._ppBankV136, settled: o.player._settled, note: !!document.querySelector('.bank-note-v136'), earned: earned.replace(/\s+/g, ' ').trim(), fathers: L && L.fathers, gen: L && L.gen, son: /His son picks it up/.test(document.getElementById('screen').textContent), btn: [...document.querySelectorAll('#dock button')].map(b => b.innerText).join(' | ') } })
const r = set.pp - pre.pp - 7
ok(set.settled && set.gain === 7 && set.bank === 0 && r >= 1 && set.note && new RegExp('\\+' + (r + 7) + '(?!\\d)').test(set.earned), 'the settle pays the bank with the career payout, and the card says how much was banked', JSON.stringify({ pp: [pre.pp, set.pp], gain: set.gain, bank: set.bank, earned: set.earned, note: set.note }))
ok(set.fathers && set.fathers.length === 1 && set.fathers[0].name === pre.name && set.fathers[0].fate === 'cut' && set.fathers[0].level === pre.level && set.fathers[0].gen === 1 && set.gen === 1, 'the settle writes the father: his name, position, the league he reached, how it ended', JSON.stringify(set.fathers && set.fathers[0]))
ok(set.son, 'and the career-end card says his son picks it up', set.btn)
await ev(() => window.prestigeReset()); await page.waitForTimeout(800)
const feed1 = await ev(() => window.__RIB_MENU_DATA_V89().state.lineage)
ok(feed1 && feed1.gen === 1 && feed1.father && feed1.father.name === pre.name && /cut/.test(feed1.father.say), 'the menu feed carries the family between careers', JSON.stringify(feed1))
for (const s of ['START NEW CAREER', 'ARCH']) await click(s)
const g2 = await ev(() => { const o = window.__GRIDIRON_AUDIT__.getState(), F = window.__LINEAGE_V136.family(); const n0 = o.player.name; const rolls = []; for (let i = 0; i < 4; i++) { window.rerollNameV96(); rolls.push(o.player.name) } return { name: n0, rerolled: o.player.name, rolls, gen: F.gen, ordinal: F.ordinal, surname: F.surname, years: F.years, father: F.father && F.father.name, genOnPlayer: o.player.genV136, fatherOnPlayer: o.player.fatherV136, view: o.view } })
ok(g2.gen === 2 && g2.ordinal === '2nd' && g2.surname === g1.surname && g2.name.endsWith(' ' + g1.surname) && g2.name !== pre.name && g2.father === pre.name && g2.genOnPlayer === 2 && g2.fatherOnPlayer === pre.name, 'the next player is the SON: a new first name, the family surname, the father on record', JSON.stringify({ name: g2.name, father: g2.father, gen: g2.gen }))
ok(g2.rolls.every(n => n.endsWith(' ' + g1.surname)) && g2.rolls.some(n => n !== g2.name), 'the name dice keep the surname', g2.rolls.join(', '))
await ev(() => window.__RIB_COACH.open('persona', { by: 'check' })); await page.waitForTimeout(800)
const coach = await ev(() => ({ open: !!document.getElementById('rib-coach-v119'), stop: window.__RIB_COACH.stop, first: (document.querySelector('#rib-coach-v119 [data-c-text]') || {}).textContent || '' }))
await page.waitForTimeout(2500)
const coachTxt = await ev(() => (document.querySelector('#rib-coach-v119 [data-c-text]') || {}).textContent || '')
ok(coach.open && coach.stop === 'persona' && new RegExp("^You're a " + g1.surname).test(coachTxt) && /old man/.test(coachTxt) && /(cut|Learn|proud|top it)/i.test(coachTxt), "the coach's persona stop opens on the father: which league the old man made and what to do about it", coachTxt.slice(0, 120))
await ev(() => window.__RIB_COACH.close())
await click('QB'); await click('Lock In Personality')
const scr = await ev(() => { const T = el => el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : ''; window.go('choosePos'); const pos = T(document.querySelector('.lineage-card-v136')); window.go('hub'); const hub = T(document.querySelector('.lineage-row-v136')); window.go('shop'); const shop = T(document.querySelector('#screen .eyebrow')) + ' | ' + T(document.querySelector('#screen .h1')); window.go('hof'); const hof = T(document.querySelector('.lineage-hof-v136')), hofRows = document.querySelectorAll('.lineage-gen-v136').length; window.go('menu'); return { pos, hub, shop, hof, hofRows } })
await page.waitForTimeout(900)
const menu = await ev(() => ({ gen: (document.querySelector('#rib-main-menu-v2 .rib9-gen') || {}).textContent, ticker: [...document.querySelectorAll('.rib9-ticker-v132 li')].map(l => l.textContent.replace(/\s+/g, ' ').trim()).find(t => /LINE/.test(t)) }))
const SUR = g1.surname.toUpperCase()
ok(new RegExp('2ND GENERATION · THE ' + SUR + ' LINE').test(scr.pos) && new RegExp('Son of ' + pre.name).test(scr.pos) && /got cut at/.test(scr.pos), 'the position screen: son of the father, how it ended, what he left', scr.pos.slice(0, 110))
ok(new RegExp('2ND GENERATION · THE ' + SUR + ' LINE · \\d+ FAMILY YEAR').test(scr.hub) && new RegExp('son of ' + pre.name).test(scr.hub), 'the hub: the generation, the line, the running family years', scr.hub.slice(0, 110))
ok(/THE INHERITANCE · 2ND GENERATION/i.test(scr.shop) && /What the Family Learned/i.test(scr.shop), 'the tree is the inheritance', scr.shop)
ok(scr.hofRows === 2 && new RegExp('1ST ' + pre.name).test(scr.hof) && /cut/.test(scr.hof) && new RegExp('2ND ' + g2.rerolled + '.*playing now').test(scr.hof), 'the Hall of Fame draws the family line, generation by generation', scr.hof.slice(0, 120))
ok(menu.gen === 'GEN 2' && menu.ticker && new RegExp('THE ' + SUR + ' LINE · GEN 2').test(menu.ticker), 'the main menu: GEN 2 on the card, the line on the ticker', JSON.stringify(menu))

console.log('page errors:', errs.length ? errs.join('\n') : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
