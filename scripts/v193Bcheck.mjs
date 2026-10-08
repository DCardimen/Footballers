// Dev check: v193 B — THE PLAN SHOWS ITS ODDS, ROLLS BEFORE KICKOFF, AND YOUR TEAM IS ON THE SHEET.
// Drives a real career to the pregame at PHONE width (400x860) and proves:
//   * THE ODDS ARE VISIBLE — every tile on the plan board carries an odds class (odds-g / odds-y / odds-r) and
//     prints "N% clicks" equal to __PREGAME_V51.band(id)'s click odds; the best odds on the board wear BEST ODDS.
//   * THE DEFAULT IS MODIFIED BY THEM — when the scout's plan is not green and another green plan is within
//     planGreenGapV193 perf of it, the greenest such plan is lit (and the card says "Scout says X · odds say Y");
//     otherwise the scout's plan is lit, as before.
//   * THE PROJECTED SCORE — PROJECTED US–THEM on page 3 beside the WIN CHANCE and on page 5 above the tiles, from
//     the engine's own sampled games once three are in.
//   * ROLL THE PLAN — reveals the held band for the selected plan (the same dice, nothing re-rolled), names the result
//     (IT CLICKS / IT'LL DO / IT BACKFIRES) and the stats it moves, LOCKS the pick (tiles .locked, pick() refused,
//     the held plan unchanged), and the strip, the full box score and the projected score all move; page 7 says
//     "rolled: …"; CONTINUE applies the swing once at kickoff and books week.planRollV146 with the revealed band.
//   * YOUR TEAM — a page after the scout listing 22 men (11 offense, 11 defense) with the you-player marked, a header
//     from teamQualityV192B, and chips for what the prestige gives each man (or the nudge to the tree when it gives nothing).
//   * "recover" — PLAN_IDS carries the Rest & Recover id and matchupPlanModifier reads it as a rest plan.
//   * KILL SWITCH — v193B 0: no odds class, no roll button, no score, no team page.
//   * IT IS A PHONE — no horizontal scroll on any page; no page errors.
//   node scripts/v193Bcheck.mjs        (GAME_URL, POS=RB, SHOT=dir)
import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'

const URL = GAME_URL
const POS = process.env.POS || 'RB'
const SHOT = process.env.SHOT || 'scripts/_v193B'
const POS_LABEL = { QB: 'QB Quarterback', RB: 'RB Running Back', WR: 'WR Wide Receiver', TE: 'TE Tight End', OL: 'OL Offensive Line', DL: 'DL Defensive Line', LB: 'LB Linebacker', CB: 'CB Cornerback', S: 'S Safety' }[POS] || POS

let pass = 0, fail = 0
const errs = []
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }

const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 400, height: 860 } })
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })

const vis = `el => { if(!el) return false; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    const el = t === 'ARCH' ? els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
      : els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click() }
  }, { t, visSrc: vis })
  await page.waitForTimeout(650)
}
async function waitPregame() {
  for (let i = 0; i < 80; i++) {
    if (await page.evaluate(() => !!document.getElementById('pregameV1513'))) break
    await page.evaluate(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') g.click() })
    await page.waitForTimeout(250)
  }
  return page.evaluate(() => !!document.getElementById('pregameV1513'))
}
async function toPregame() {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 })
  await page.waitForTimeout(2500)
  for (const s of ['START NEW CAREER', 'ARCH', POS_LABEL, 'Lock In Personality', 'PLAY 8-GAME SEASON']) await click(s)
  for (let i = 0; i < 60; i++) { const d = await page.evaluate(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') { g.click(); return false } return !document.getElementById('growthV42') }); if (d) break; await page.waitForTimeout(300) }
  await click('Balanced Program'); await click('CONFIRM TRAINING')
  await page.evaluate(() => { const el = [...document.querySelectorAll('button')].find(e => /PLAY WEEK 1 LIVE/.test(e.innerText || '')); el && el.click() })
  return waitPregame()
}
const goPage = async id => { await page.evaluate(id => { const P = window.__V136_PAGES.active(); window.__V112_D.go(P.indexOf(id)) }, id); await page.waitForTimeout(300) }
const T = s => (s || '').replace(/\s+/g, ' ').trim()
const noWide = async tag => {
  const W = await page.evaluate(() => { const host = document.getElementById('pregameV1513'); const wide = host ? [...host.querySelectorAll('*')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > document.documentElement.clientWidth + 1 }).map(el => (el.className || el.tagName).toString().slice(0, 30)) : []; return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, wide: wide.slice(0, 4) } })
  ok(W.sw <= W.cw + 1 && !W.wide.length, `${tag}: no horizontal scroll at 400px`, W)
}

ok(await toPregame(), 'the pregame screen opened')

// ---------------------------------------------------------------- 1. the pages: YOUR TEAM after the scout
const A = await page.evaluate(() => ({ active: window.__V136_PAGES.active(), built: [...document.querySelectorAll('.v112-page')].map(p => p.id), on: window.__V193B && window.__V193B.on(), kick: (document.getElementById('v112Kick') || {}).innerText }))
ok(A.on, 'v193 B is on (choice mode, v193B 1)', A.on)
ok(A.built.length === 8 && A.active.length === 7 && A.active[3] === 'v112PageTeam' && /STEP 1 OF 7/.test(A.kick || ''), 'eight pages are built, seven live on an ordinary week — YOUR TEAM right after the scout', A.active.join('/'))

// ---------------------------------------------------------------- 2. the board: odds on every tile, the best badged, the default modified
await goPage('v112Page5')
const B = await page.evaluate(() => {
  const V = window.__PREGAME_V51, h = V.hold(), X = window.__V146, G = window.TU('planGreenV193', .5), GAP = window.TU('planGreenGapV193', 3)
  const T = el => el ? el.innerText.replace(/\s+/g, ' ').trim() : ''
  const tiles = [...document.querySelectorAll('#v112Page5 .v146-tile')].map(t => ({ id: t.dataset.plan, odds: +t.dataset.odds, cls: [...t.classList].find(c => /^odds-[gyr]$/.test(c)) || null, txt: T(t), on: t.classList.contains('on'), locked: t.classList.contains('locked'), badge: T(t.querySelector('s')) }))
  const bands = {}; h.plans.forEach(p => { const b = V.band(p.id); const f = X.facts(null, p.id); bands[p.id] = { g: b.g, r: b.r, perf: (f.perf || 0) + (f.match || 0), scout: !!b.scout } })
  const best = Object.keys(bands).reduce((a, k) => a == null || bands[k].g > bands[a].g ? k : a, null)
  return { tiles, bands, best, bestHook: window.__V193B.best(), held: h.d.win.id, pick: window.__V193B.pick(), lastPick: h.pl.planPickV146, card: T(document.getElementById('v146Card')), roll: !!document.getElementById('v193Roll'), score5: T(document.getElementById('v193Score5')), G, GAP, RED: window.TU('planRedV193', .35) }
})
ok(B.tiles.length >= 5 && B.tiles.every(t => t.cls), 'every tile carries an odds class', B.tiles.map(t => t.id + ':' + t.cls).join(' '))
ok(B.tiles.every(t => Math.abs(t.odds - Math.round(B.bands[t.id].g * 100)) <= 0 && new RegExp(t.odds + '% clicks').test(t.txt)), 'and prints "N% clicks" equal to band(id).g', B.tiles.map(t => t.id + ' ' + t.odds + '%').join(', '))
ok(B.tiles.every(t => { const g = B.bands[t.id].g, r = B.bands[t.id].r; const want = (r >= B.RED || g < .25) ? 'odds-r' : g >= B.G ? 'odds-g' : 'odds-y'; return t.cls === want }), 'the class follows the thresholds (green ≥ planGreenV193, red at planRedV193 backfires or < 25% clicks)', B.tiles.map(t => `${t.id} g${Math.round(B.bands[t.id].g * 100)} r${Math.round(B.bands[t.id].r * 100)} ${t.cls}`).join(' | '))
ok(B.best && B.bestHook === B.best && /BEST ODDS/.test((B.tiles.find(t => t.id === B.best) || {}).badge || '') && B.tiles.filter(t => /BEST ODDS/.test(t.badge)).length === 1, 'the tile with the best click odds wears BEST ODDS, and only it', `${B.best} (${Math.round(B.bands[B.best].g * 100)}%)`)
ok(B.tiles.some(t => /SCOUT/.test(t.badge)), "the scout's tile keeps SCOUT", B.tiles.filter(t => /SCOUT/.test(t.badge)).map(t => t.id).join(','))
{ // the default pick: the greenest within the gap when the scout's is not green
  const sp = Object.keys(B.bands).find(k => B.bands[k].scout)
  let want = sp, reason = "the scout's plan is green — it stands"
  if (sp && B.bands[sp].g < B.G) {
    const cands = Object.keys(B.bands).filter(k => k !== sp && B.bands[k].g >= B.G && B.bands[sp].perf - B.bands[k].perf <= B.GAP)
    if (cands.length) { want = cands.reduce((a, k) => a == null || B.bands[k].g > B.bands[a].g ? k : a, null); reason = `the scout's ${sp} is ${Math.round(B.bands[sp].g * 100)}% — the greenest within ${B.GAP} perf is ${want} (${Math.round(B.bands[want].g * 100)}%)` }
    else reason = `the scout's ${sp} is ${Math.round(B.bands[sp].g * 100)}% but no green plan sits within ${B.GAP} perf — it stands`
  }
  ok(!B.lastPick && B.held === want && B.tiles.find(t => t.on).id === want, 'the default pick is the scout\'s, modified by the odds: ' + reason, `held ${B.held}, lit ${B.tiles.find(t => t.on).id}, pick=${JSON.stringify(B.pick)}`)
  const mod = B.pick && B.pick.modified
  ok(mod ? /Scout says .+ odds say/.test(B.card) : !/odds say/.test(B.card), mod ? 'and the card says why — "Scout says X · odds say Y"' : 'and the card has no odds note when the scout\'s plan stood', B.card.slice(0, 120))
  ok(!!B.pick && B.pick.scout === sp && B.pick.pick === want, '__V193B.pick() reports the scout, the pick and whether it was modified', B.pick)
}
// the modification itself, deterministically: lower the green line to just under the best odds on the board so the
// scout's plan is not green and the best is, then ask the default again with the week's dice
{ const M = await page.evaluate(() => {
    const V = window.__PREGAME_V51, h = V.hold(), X = window.__V146, pl = h.pl, keepPick = pl.planPickV146, keepG = window.RIB_TUNE.planGreenV193
    const bands = {}; h.plans.forEach(p => { const b = V.band(p.id), f = X.facts(null, p.id); bands[p.id] = { g: b.g, perf: (f.perf || 0) + (f.match || 0), scout: !!b.scout } })
    const sp = Object.keys(bands).find(k => bands[k].scout), best = Object.keys(bands).reduce((a, k) => a == null || bands[k].g > bands[a].g ? k : a, null)
    if (!sp || !best || best === sp) return { skip: true, sp, best }
    window.RIB_TUNE.planGreenV193 = bands[best].g - 0.001; delete pl.planPickV146
    const G = window.RIB_TUNE.planGreenV193, GAP = window.TU('planGreenGapV193', 3)
    const cands = Object.keys(bands).filter(k => k !== sp && bands[k].g >= G && bands[sp].perf - bands[k].perf <= GAP)
    const want = cands.length ? cands.reduce((a, k) => a == null || bands[k].g > bands[a].g ? k : a, null) : sp
    const got = V.defaultPick(pl, h.plans, h.dice), o = V.oddsPick()
    // put the week back exactly as it was
    window.RIB_TUNE.planGreenV193 = keepG; if (keepPick) pl.planPickV146 = keepPick; V.defaultPick(pl, h.plans, h.dice)
    return { sp, best, G, GAP, want, got, o, cands, scoutG: bands[sp].g, perfs: Object.fromEntries(Object.keys(bands).map(k => [k, bands[k].perf])) } })
  if (M.skip) ok(true, '(the scout\'s plan already has the best odds — the modification cannot be forced this week)', M)
  else {
    ok(M.got === M.want && M.o && M.o.scout === M.sp && M.o.pick === M.want && M.o.modified === (M.want !== M.sp), `with the green line at ${Math.round(M.G * 100)}% the default is the greenest plan within ${M.GAP} perf of the scout's (${M.want}${M.want === M.sp ? ' — none within the gap, the scout stands' : ''})`, { got: M.got, want: M.want, cands: M.cands, scoutG: Math.round(M.scoutG * 100) / 100, modified: M.o && M.o.modified })
    ok(M.perfs[M.sp] - M.perfs[M.got] <= M.GAP, 'and the lit plan is never more than the gap below the scout\'s perf', M.perfs)
  }
}
ok(B.roll && /ROLL THE PLAN/.test(B.card + ' ' + (await page.evaluate(() => (document.getElementById('v193Roll') || {}).innerText || ''))), 'ROLL THE PLAN sits under the plan card', B.roll)
ok(/PROJECTED \d+–\d+/.test(B.score5), 'the projected score is above the tiles', B.score5)
await noWide('page 5')

// the engine's samples: wait for the projection to be ready so the roll moves real numbers
await page.waitForFunction(() => window.__V146.samples().length >= window.TU('projMinV146', 3), null, { timeout: 60000 }).catch(() => null)
await page.waitForTimeout(400)
const S0 = await page.evaluate(() => { const T = el => el ? el.innerText.replace(/\s+/g, ' ').trim() : ''; const id = window.__V135.hold().d.win.id; const S = window.__V193B.score(id); const P = window.__V146.project({ usage: 'normal', plan: id, band: window.__PREGAME_V51.band(id) }); return { id, S, strip: T(document.getElementById('v146Proj')), score5: T(document.getElementById('v193Score5')), head: P && P.rows.find(r => r.head) && P.rows.find(r => r.head).mean, grade: P && P.grade && P.grade.mean, n: window.__V146.samples().length, sample: window.__V146.samples()[0] } })
ok(S0.S && S0.S.ready && S0.S.src === 'engine' && S0.sample && S0.sample.us != null && S0.sample.them != null, 'the projected score comes from the engine\'s sampled games, each carrying its scoreline', { n: S0.n, us: S0.S && S0.S.usR, them: S0.S && S0.S.themR, src: S0.S && S0.S.src })
ok(!S0.S.fixed && Math.abs(S0.S.roll - (B.bands[S0.id].g * 3 - B.bands[S0.id].r * 3)) < 1e-6, 'before the roll the score carries the EXPECTED value of the click and the backfire at the band\'s odds', { roll: S0.S.roll, g: B.bands[S0.id].g, r: B.bands[S0.id].r })
await goPage('v112Page3')
const P3 = await page.evaluate(() => { const T = el => el ? el.innerText.replace(/\s+/g, ' ').trim() : ''; return { score3: T(document.getElementById('v193Score3')), win: T(document.querySelector('.odds-big-v20')) } })
ok(/PROJECTED \d+–\d+/.test(P3.score3) && /WIN CHANCE/.test(P3.win), 'page 3 shows it beside the WIN CHANCE', P3.score3 + ' · ' + P3.win)
await noWide('page 3')

// ---------------------------------------------------------------- 3. the roll
await goPage('v112Page5')
await page.evaluate(() => document.getElementById('v193Roll').click())
const mid = await page.evaluate(() => ({ rolling: !!document.querySelector('#v193Out.rolling'), spin: !!document.querySelector('.v193-die.spin') }))
await page.waitForTimeout(1200)
const R = await page.evaluate(() => {
  const T = el => el ? el.innerText.replace(/\s+/g, ' ').trim() : ''; const V = window.__PREGAME_V51, h = V.hold(), id = h.d.win.id, b = V.band(id), rv = V.revealed()
  const other = h.plans.find(p => p.id !== id).id, tried = V.pick(other), after = V.hold().d.win.id
  const tiles = [...document.querySelectorAll('#v112Page5 .v146-tile')].map(t => ({ id: t.dataset.plan, on: t.classList.contains('on'), locked: t.classList.contains('locked') }))
  const S = window.__V193B.score(id), P = window.__V146.project({ usage: 'normal', plan: id, band: b })
  return { id, band: h.d.band, revealed: h.revealedV193, rv, applied: h.applied, out: T(document.getElementById('v193Out')), roll: !!document.getElementById('v193Roll'), tiles, tried, after, toast: T(document.getElementById('toast')),
    b, S, strip: T(document.getElementById('v146Proj')), score5: T(document.getElementById('v193Score5')), card: T(document.getElementById('v146Card')), head: P && P.rows.find(r => r.head) && P.rows.find(r => r.head).mean, grade: P && P.grade && P.grade.mean, buffs: (h.pl._tempStatBuffsV25 || []).length, locked: window.__V193B.locked() }
})
ok(mid.rolling && mid.spin, 'the tap starts a dice spin', mid)
ok(R.revealed === R.id && R.rv && R.rv.band === R.band && !R.applied, 'ROLL reveals the held band for the selected plan — and applies nothing yet', { id: R.id, band: R.band, applied: R.applied })
const SAY = { green: 'IT CLICKS', neutral: "IT'LL DO", red: 'IT BACKFIRES' }[R.band]
ok(new RegExp(SAY.replace(/'/g, "['’]")).test(R.out) && (R.band === 'neutral' ? /no swing/.test(R.out) : (R.out.match(/[+−]\d+ [A-Z]{2,4}/g) || []).length === R.rv.stats.length) && /locked/i.test(R.out), 'the result line names the band and every stat it moves (one "+N STAT" a stat), and says the pick is locked', R.out.slice(0, 140))
ok(!R.roll, 'the ROLL button is gone', R.roll)
ok(R.tiles.every(t => t.locked) && R.tiles.filter(t => t.on).length === 1 && R.tiles.find(t => t.on).id === R.id, 'the tiles are locked, the rolled plan still lit', R.tiles.filter(t => t.on).map(t => t.id).join(','))
ok(R.tried === null && R.after === R.id && R.locked && /rolled/i.test(R.toast), 'pickPlanV146 refuses another plan with a toast — the plan stands', { tried: R.tried, after: R.after, toast: R.toast })
ok(R.b.fixed && R.b[{ green: 'g', neutral: 'n', red: 'r' }[R.band]] === 1 && (R.b.g + R.b.n + R.b.r) === 1, 'band(id) is now the FIXED band', { g: R.b.g, n: R.b.n, r: R.b.r })
ok(R.strip !== S0.strip && /🎲/.test(R.strip) && new RegExp(SAY.replace(/'/g, "['’]")).test(R.strip), 'the projection strip redraws with the roll in it', R.strip.slice(0, 120))
ok(R.head != null && S0.head != null && Math.abs(R.head - S0.head) > 1e-6, 'and the projected headline stat moved (the mixture became the one outcome)', `${S0.head} → ${R.head}`)
ok(R.S && R.S.fixed && Math.abs(R.S.us - S0.S.us) > 1e-6 && R.S.roll === ({ green: 3, neutral: 0, red: -3 })[R.band], 'the projected score moved by the roll (click +3 / backfire −3 / nothing)', { before: S0.S.us, after: R.S.us, roll: R.S.roll })
ok(/PROJECTED \d+–\d+/.test(R.score5) && /rolled/.test(R.score5), 'PROJECTED on page 5 says it is rolled', R.score5)
ok(/ROLLED/.test(R.card) && new RegExp(SAY.replace(/'/g, "['’]")).test(R.card), 'the plan card says ROLLED — and the band', (R.card.match(/The roll[^|]{0,60}/) || [''])[0])
await noWide('page 5 rolled')
await page.evaluate(() => { const b = document.getElementById('v146Plan'); b && b.scrollIntoView({ block: 'start' }) }); await page.waitForTimeout(150)
await page.screenshot({ path: `${SHOT}_rolled.png` })
await page.evaluate(() => window.__V112_D.go(window.__V136_PAGES.active().length - 1)); await page.waitForTimeout(300)
const P7 = await page.evaluate(() => ((document.getElementById('v136SumD') || {}).innerText || '').replace(/\s+/g, ' '))
ok(/rolled:/.test(P7) && new RegExp(SAY.replace(/'/g, "['’]")).test(P7) && !/rolls at kickoff/.test(P7), 'page 7 says "rolled: …" instead of "rolls at kickoff"', P7.slice(0, 120))
await noWide('page 7')

// ---------------------------------------------------------------- 4. your team
await goPage('v112PageTeam')
const TM = await page.evaluate(() => {
  const T = el => el ? el.innerText.replace(/\s+/g, ' ').trim() : ''
  const men = [...document.querySelectorAll('#v193Roster .v193-man')].map(m => ({ pos: m.dataset.pos, you: m.classList.contains('you'), ovr: +T(m.querySelector('.ovr')), chips: [...m.querySelectorAll('.chips i')].map(T), nm: T(m.querySelector('.nm')) }))
  const Q = window.__V192B.team()
  const you = men.find(m => m.you)
  const page = document.getElementById('v112PageTeam'), host = document.getElementById('pregameV1513'), roster = document.getElementById('v193Roster')
  return { men, n: men.length, off: [...document.querySelectorAll('#v193Roster h5')].map(T), you, Q, head: T(document.getElementById('v193TeamHead')), nudge: T(document.getElementById('v193Nudge')), kick: T(document.getElementById('v112Kick')), next: T(document.getElementById('v112Next')),
    fits: { sh: host.scrollHeight, ch: host.clientHeight, rh: roster ? roster.clientHeight : 0, rs: roster ? roster.scrollHeight : 0 }, top5: [...document.querySelectorAll('#v112Page3 .pregame-card-v1513')].slice(0, 1).map(c => [...c.querySelectorAll('b')].map(T)) }
})
ok(/STEP 4 OF 7/.test(TM.kick) && /YOUR TEAM/.test(TM.kick), 'page 4 is YOUR TEAM', TM.kick)
ok(TM.n === 22 && TM.men.filter((m, i) => i < 11).length === 11 && TM.off.length === 2 && /OFFENSE/.test(TM.off[0]) && /DEFENSE/.test(TM.off[1]), 'it lists 22 men — eleven on offense, eleven on defense', `${TM.n} men · ${TM.off.join(' / ')}`)
ok(TM.you && TM.you.chips.includes('YOU') && TM.men.filter(m => m.you).length === 1 && TM.you.pos === POS, 'the you-player is in it, marked YOU, at his position', TM.you)
ok(TM.you && TM.you.chips.some(c => /📋|🎲|[A-Za-z]/.test(c) && c !== 'YOU'), 'with what he carries (the plan, the focus, any boost)', TM.you && TM.you.chips.join(' · '))
ok(TM.top5.length && TM.top5[0].every(nm => TM.men.some(m => m.nm === nm)), "the men are the same men page 3's TOP 5 names", TM.top5[0].join(', '))
ok(TM.Q && new RegExp(`from ${TM.Q.base} → ${TM.Q.full}`).test(TM.head) && /team nodes/.test(TM.head) && /Locker Room/.test(TM.head) && /legacy share/.test(TM.head), 'the header: "Your prestige lifts this team from N → N (team nodes, Locker Room, legacy share)" from teamQualityV192B', TM.head)
{ const lifted = TM.Q && (TM.Q.lift > 0 || TM.Q.locker > 0)
  const chips = TM.men.filter(m => !m.you).flatMap(m => m.chips).filter(c => /Locker Room|team nodes/.test(c))
  ok(lifted ? chips.length > 0 : (!!TM.nudge && /Prestige tree/.test(TM.nudge) && !chips.length), lifted ? 'the lift shows as chips on the men' : 'a fresh career: no lift, so the one-line nudge to the tree', lifted ? chips.slice(0, 3).join(' · ') : TM.nudge) }
ok(TM.fits.sh <= TM.fits.ch + 2 && TM.fits.rs > TM.fits.rh, 'the page fits the phone — the roster scrolls inside its own box', TM.fits)
await noWide('team page')
await page.screenshot({ path: `${SHOT}_team.png` })

// ---------------------------------------------------------------- 5. the lift reaches the men when the tree has it
const L = await page.evaluate(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), pl = S.player, keep = JSON.stringify(S.tree || {})
  S.tree = Object.assign({}, S.tree || {}); const T0 = window.__V190 && window.__V190.teamLift ? window.__V190.teamLift() : 0
  // push the team-lift nodes and the Locker Room groups
  const K = ['lkSkill', 'lkLine', 'lkFront', 'lkBack', 'lkCaptain', 'lkAll']
  Object.keys(window.__GRIDIRON_AUDIT__.TREE_NODES || {}).forEach(k => { const n = window.__GRIDIRON_AUDIT__.TREE_NODES[k]; if (n && n.fx && n.fx.teamLiftV190) S.tree[k] = 10 })
  K.forEach(k => { S.tree[k] = 20 })
  const pv = window.__previewMatchupV22(pl.pos, null)
  const Q = window.__V192B.team(), liftPct = window.__V190 && window.__V190.teamLift ? window.__V190.teamLift() : 0
  const men = pv.us.players.filter(m => !m.you)
  const out = { liftPct, lift: men.map(m => m.lift), locker: men.map(m => m.locker), Q, K: K.length, T0 }
  S.tree = JSON.parse(keep)
  return out
})
ok(L.liftPct > 0 && L.lift.every(v => v > 0) && L.Q.lift > 0, 'with team nodes in the tree every teammate carries m.lift (the nodes\' lift in OVR points) and the header\'s team-nodes figure rises', { liftPct: L.liftPct, lift: L.lift[0], Qlift: L.Q.lift })
ok(!L.K || L.locker.some(v => v > 0), 'with Locker Room levels the men carry m.locker', { K: L.K, locker: L.locker.filter(v => v > 0).length })

// ---------------------------------------------------------------- 6. "recover"
const src = await (await fetch(URL.replace(/\/?$/, '/') + 'src/07-career-app.js')).text()
ok(/PLAN_IDS = \[[^\]]*"recover"/.test(src) && /\(t === "recovery" \|\| t === "recover"\)/.test(src) && /\(a === "recovery" \|\| a === "recover"\)/.test(src) && /id === "recovery" \|\| id === "recover" \? 0\.08/.test(src) && (src.match(/recover: -10/g) || []).length >= 2, '"recover" (Rest & Recover) is read everywhere "recovery" is — PLAN_IDS, the matchup modifier, the injury terms, the fatigue tables', 'source')

// ---------------------------------------------------------------- 7. CONTINUE: the swing lands once, the week books the revealed band
await page.evaluate(() => window.__V112_D.go(window.__V136_PAGES.active().length - 1)); await page.waitForTimeout(200)
// watch the commit itself: the swing lands exactly there, once, and the live game may consume the buffs after it
await page.evaluate(() => { const V = window.__PREGAME_V51, c = V.commit; window.__v193chk = { commits: 0 }; V.commit = function () { const h = c.apply(this, arguments); window.__v193chk.commits++; window.__v193chk.applied = !!(h && h.applied); window.__v193chk.buffs = h ? (h.pl._tempStatBuffsV25 || []).length : -1; return h } })
await click('CONTINUE TO MATCH')
await page.waitForTimeout(2000)
const K = await page.evaluate(() => { const o = window.__GRIDIRON_AUDIT__.getState(), pl = o.player; const w = (pl.weekResults || []).find(x => x && x.planRollV146); return { gone: !document.getElementById('pregameV1513'), roll: w && w.planRollV146, chk: window.__v193chk, held: !!window.__PREGAME_V51.hold() } })
ok(K.gone && K.roll && K.roll.id === R.id && K.roll.band === R.band && K.roll.revealedV193 === true && !K.held, 'CONTINUE books week.planRollV146 with the revealed plan and band, and the hold is spent', K.roll)
ok(K.chk && K.chk.commits === 1 && K.chk.applied && (R.band === 'neutral' || K.chk.buffs > 0), 'the swing is applied at kickoff, once — not before', K.chk)

// ---------------------------------------------------------------- 8. the kill switch
await page.addInitScript(() => { const t = setInterval(() => { if (window.RIB_TUNE) { window.RIB_TUNE.v193B = 0 } }, 20) })
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch (e) {} })   // a clean boot: the live game just started must not be the save the next career opens over
ok(await toPregame(), 'the pregame opens again with v193B 0')
await page.evaluate(() => { window.RIB_TUNE.v193B = 0 })
const OFF = await page.evaluate(() => { const P = window.__V136_PAGES.active(); window.__V112_D.go(P.indexOf('v112Page5')); return null })
await page.waitForTimeout(300)
const OF = await page.evaluate(() => ({ active: window.__V136_PAGES.active(), tiles: [...document.querySelectorAll('.v146-tile')].map(t => [...t.classList].some(c => /^odds-/.test(c)) || !!t.querySelector('.v193-odds')), roll: !!document.getElementById('v193Roll'), score: !!document.getElementById('v193Score5') || !!document.getElementById('v193Score3'), pick: window.__V193B.pick(), kick: (document.getElementById('v112Kick') || {}).innerText }))
ok(!OF.active.includes('v112PageTeam') && OF.active.length === 6 && OF.tiles.length && OF.tiles.every(x => !x) && !OF.roll && !OF.score && (!OF.pick || !OF.pick.modified), 'v193B 0: six live pages, no odds shading, no roll button, no score, no odds-modified default', { active: OF.active.length, roll: OF.roll, score: OF.score, kick: OF.kick })

console.log(`\n${pass} ok, ${fail} failed | page errors: ${errs.length ? '\n' + errs.slice(0, 6).join('\n') : 'NONE'}`)
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
