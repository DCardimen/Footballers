// Dev check: v146 D — THE PLAN IS YOURS, AND THE NUMBERS SAY WHAT IT COSTS. Drives a real career to
// the pregame at PHONE size (400x860) for each position in POS and proves three things:
//   * THE PLAN IS CHOSEN — page 5 is the board (no wheel), one tile per plan the staff offered, each
//     carrying its variance; tapping a tile makes it the held plan, the pregame's pending plan and the
//     player's remembered pick; decidePlan with a pick returns THAT plan for every plan on the board
//     (no draw decides it) and re-pricing never re-rolls the week's dice; and CONTINUE books exactly
//     the tapped plan (week.planV11 / week.planRollV146), once. `planWheelV146` 1 brings the wheel back.
//   * THE PROJECTION IS THE GAME — the week's baseline is played headless in the real engine
//     (`__V146.sampleN`), and for three usage/plan configs the projection is held against M games
//     booked through the REAL path (__silentWeekV85: the chosen plan, its fit roll, the v50 fate roll,
//     ca() and __aiSeasonGame with the form swing) off the same saved state, restored before every
//     game. The headline stat's projected mean must sit inside 3 combined standard errors of the
//     booked mean (the projection's own sampling error from NB baseline games plus the booked games'
//     error from M — a projection cannot be held tighter than the noise of the game it projects), and
//     its 80% band must hold 60–97% of the booked games (more only if the band is narrower than 4 booked
//     standard deviations — a small count floored at 0 covers everything). A week the player SITS OUT
//     (an injury rolled in that week's own game books it as a DNP — the game's rule, not v146's) has no
//     box score: it is counted and reported, not projected.
//   * VARIANCE MEANS SOMETHING — a choice the card calls wider really is wider: LIMITED's projected
//     variance is above EVERY SNAP's and the booked games agree (relative spread of the headline, within
//     the sampling error of a spread measured off M games),
//     and Chase the Highlight's form swing, as rolled in the booked games, is ≥2x Disciplined
//     Execution's and matches the ±pts/√3 the card states.
//   node scripts/v146Dcheck.mjs        (GAME_URL, POS=RB,WR,LB (any of QB/RB/WR/TE/DL/LB/CB/S), M=36 booked games a config, NB=30 baseline games, SHOT=dir)
import { chromium } from 'playwright'

const URL = process.env.GAME_URL || 'http://localhost:5173/'
const POSS = (process.env.POS || 'RB,WR,LB').split(',').map(s => s.trim()).filter(Boolean)
const M = +(process.env.M || 36), NB = +(process.env.NB || 30)
const SHOT = process.env.SHOT || '/tmp/claude-0/shots'
const LABEL = { QB: 'QB Quarterback', RB: 'RB Running Back', WR: 'WR Wide Receiver', TE: 'TE Tight End', OL: 'OL Offensive Line', DL: 'DL Defensive Line', LB: 'LB Linebacker', CB: 'CB Cornerback', S: 'S Safety' }

let pass = 0, fail = 0
const errs = []
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { if(!el) return false; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })

async function openPage() {
  const page = await browser.newPage({ viewport: { width: 400, height: 860 } })
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
  await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
  return page
}
async function click(page, t) {
  // a one-time reload (v106.1 freshness, or the dev server's own) can land mid-click: wait it out and carry on
  try { await clickIn(page, t) } catch (e) { await page.waitForTimeout(2500); try { await clickIn(page, t) } catch (e2) {} }
}
async function clickIn(page, t) {
  await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    const el = t === 'ARCH' ? els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
      : els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click() }
  }, { t, visSrc: vis })
  await page.waitForTimeout(650)
}
async function toPregame(page, pos) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 })
  await page.waitForTimeout(2500)
  for (const s of ['START NEW CAREER', 'ARCH', LABEL[pos], 'Lock In Personality', 'PLAY 8-GAME SEASON']) await click(page, s)
  for (let i = 0; i < 60; i++) { const d = await page.evaluate(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') { g.click(); return false } return !document.getElementById('growthV42') }); if (d) break; await page.waitForTimeout(300) }
  await click(page, 'Balanced Program'); await click(page, 'CONFIRM TRAINING')
  await page.evaluate(() => { const el = [...document.querySelectorAll('button')].find(e => /PLAY WEEK 1 LIVE/.test(e.innerText || '')); el && el.click() })
  for (let i = 0; i < 80; i++) {
    if (await page.evaluate(() => !!document.getElementById('pregameV1513'))) break
    await page.evaluate(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') g.click() })
    await page.waitForTimeout(250)
  }
  return page.evaluate(() => !!document.getElementById('pregameV1513'))
}
const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / Math.max(1, a.length - 1)) }
const r1 = v => Math.round(v * 10) / 10
const summary = []

for (const pos of POSS) {
  console.log(`\n==================== ${pos} ====================`)
  // ------------------------------------------------------------------ phase 1: the board, the pick, the booking
  let page = await openPage()
  ok(await toPregame(page, pos), `${pos}: the pregame opened`)
  ok(await page.evaluate(() => window.__PREGAME_V51.choice() === true), `${pos}: choice mode is the default (planWheelV146 = 0)`)
  const p5 = await page.evaluate(() => window.__V136_PAGES.active().indexOf('v112Page5'))
  await page.evaluate(i => window.__V112_D.go(i), p5)
  await page.waitForTimeout(500)
  // the engine plays the week behind the pages; wait for the book
  await page.waitForFunction(() => window.__V146 && window.__V146.samples().length >= 4, null, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(300)
  const B = await page.evaluate(({ visSrc }) => {
    const vis = eval(visSrc), T = el => el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : ''
    const h = window.__PREGAME_V51.hold(), wiz = document.getElementById('pregameV1513')
    const tiles = [...document.querySelectorAll('.v146-tile')].map(t => ({ id: t.getAttribute('data-plan'), on: t.classList.contains('on'), txt: T(t), vis: vis(t) }))
    return { tiles, plans: h ? h.plans.map(p => p.id) : [], held: h && h.d.win.id, wheel: !!document.querySelector('#v135Wheel #growthV42') || !!document.getElementById('growthV42'),
      card: T(document.getElementById('v146Card')), strip: T(document.getElementById('v146Proj')), kick: T(document.getElementById('v112Kick')),
      fits: wiz ? { sh: wiz.scrollHeight, ch: wiz.clientHeight } : null, next: T(document.getElementById('v112Next')),
      scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }
  }, { visSrc: vis })
  ok(/GAME PLAN/.test(B.kick) && !B.wheel, `${pos}: page 5 is THE GAME PLAN board, and no wheel spins on it`, B.kick)
  ok(B.tiles.length === B.plans.length && B.tiles.length >= 5 && B.tiles.every(t => t.vis), `${pos}: one tile for every plan the staff offered`, `${B.tiles.length} tiles / ${B.plans.length} plans`)
  ok(B.tiles.every(t => /±\d+%/.test(t.txt)), `${pos}: every tile carries its variance`, B.tiles.map(t => t.id + ' ' + (t.txt.match(/±\d+%/) || ['?'])[0]).join(', '))
  ok(B.tiles.filter(t => t.on).length === 1 && B.tiles.find(t => t.on).id === B.held, `${pos}: the lit tile is the held plan (the default: last pick, else the scout's)`, B.held)
  ok(/Game rating/.test(B.card) && /The roll/.test(B.card) && /Fate roll/.test(B.card) && /Form swing/.test(B.card) && /Body/.test(B.card) && /VARIANCE ±\d+%/.test(B.card), `${pos}: the card details the plan — rating, roll, fate, swing, body, variance`, B.card.slice(0, 150))
  ok(/PROJECTED/.test(B.strip) && /VARIANCE ±\d+%/.test(B.strip), `${pos}: the projection strip is on the page with its variance`, B.strip.slice(0, 120))
  ok(B.fits && B.fits.sh <= B.fits.ch + 2 && B.scrollW <= B.clientW, `${pos}: page 5 fits a 400x860 phone with no scroll`, JSON.stringify(B.fits))
  await page.screenshot({ path: `${SHOT}/v146D_${pos}_plan.png` })
  // tap a different plan — as a thumb would
  const target = B.plans.find(id => id !== B.held && id !== 'recovery') || B.plans[1]
  await page.evaluate(id => document.querySelector(`.v146-tile[data-plan="${id}"]`).click(), target)
  await page.waitForTimeout(300)
  const T1 = await page.evaluate(() => { const h = window.__PREGAME_V51.hold(), pl = window.__GRIDIRON_AUDIT__.getState().player; return { held: h.d.win.id, on: (document.querySelector('.v146-tile.on') || {}).dataset?.plan, pick: pl.planPickV146, card: (document.getElementById('v146Card') || {}).innerText || '', dice: JSON.stringify(h.dice) } })
  ok(T1.held === target && T1.on === target && T1.pick === target, `${pos}: a tap makes it the plan — held, lit and remembered`, `${target} → held ${T1.held}, lit ${T1.on}, pick ${T1.pick}`)
  // no random roll decides WHICH plan: every pick comes back as itself, and re-pricing never re-rolls the dice
  const D = await page.evaluate(() => { const V = window.__PREGAME_V51, h = V.hold(), res = []
    for (const p of h.plans) for (let k = 0; k < 5; k++) { const d = V.decidePlan(h.pl, h.plans, p.id, h.dice); res.push(d.win.id === p.id && d.chosen) }
    const b1 = JSON.stringify(V.band(h.plans[2].id)), b2 = JSON.stringify(V.band(h.plans[2].id))
    return { all: res.every(Boolean), n: res.length, same: b1 === b2 } })
  ok(D.all && D.same, `${pos}: decidePlan returns the picked plan every time (no draw), and pricing it twice rolls nothing`, `${D.n} picks`)
  ok(T1.dice && (await page.evaluate(() => JSON.stringify(window.__PREGAME_V51.hold().dice))) === T1.dice, `${pos}: the week's dice are held across taps`)
  // the projection moves with the decisions on the other pages
  const U = await page.evaluate(() => { const X = window.__V146, V = window.__PREGAME_V51, id = V.hold().d.win.id, b = V.band(id)
    const lo = X.project({ usage: 'limited', plan: id, band: b }), hi = X.project({ usage: 'everysnap', plan: id, band: b })
    const before = (document.getElementById('v146Proj') || {}).innerText || ''
    window.__v111PickUsageV111('everysnap'); const after = (document.getElementById('v146Proj') || {}).innerText || ''; window.__v111PickUsageV111('normal')
    return { lo: lo.head && lo.head.k && lo.rows.find(r => r.head).mean, hi: hi.head && hi.rows.find(r => r.head).mean, before, after } })
  ok(U.hi > U.lo && U.before !== U.after, `${pos}: asking for EVERY SNAP projects more than LIMITED, and the strip redraws when the ladder moves`, `${r1(U.lo)} → ${r1(U.hi)}`)
  await page.evaluate(i => window.__V112_D.go(i), p5 - 1)
  await page.waitForTimeout(400)
  const F4 = await page.evaluate(() => (document.getElementById('v146FullD') || {}).innerText || '')
  ok(/PROJECTED BOX SCORE/.test(F4) && /Variance/.test(F4) && /Game grade/.test(F4), `${pos}: page 4 carries the whole projection — every row, the grade, the variance`, F4.replace(/\s+/g, ' ').slice(0, 140))
  await page.screenshot({ path: `${SHOT}/v146D_${pos}_impact.png` })
  // the wheel is only a dial away
  ok(await page.evaluate(() => { window.RIB_TUNE.planWheelV146 = 1; const off = window.__PREGAME_V51.choice(); window.RIB_TUNE.planWheelV146 = 0; return off === false }), `${pos}: planWheelV146 = 1 restores the wheel`)
  // CONTINUE books the tapped plan, once
  const wkIdx = await page.evaluate(() => { const pl = window.__GRIDIRON_AUDIT__.getState().player; return pl.weekResults.findIndex(w => !w.played) })
  await page.evaluate(() => window.continuePregameV1513())
  await page.waitForTimeout(1500)
  const C = await page.evaluate(i => { const pl = window.__GRIDIRON_AUDIT__.getState().player, w = pl.weekResults[i]; return { plan: w.planV11, roll: w.planRollV146, gen: !!w.generatedV11, pick: pl.planPickV146, hist: (pl.planHistoryV11 || []).slice(0, 2), held: window.__PREGAME_V51.hold() } }, wkIdx)
  ok(C.gen && C.plan === target && C.roll && C.roll.id === target && C.pick === target && !C.held, `${pos}: CONTINUE books the tapped plan — the week, the roll and the remembered pick all name it, and the hold is spent`, JSON.stringify({ plan: C.plan, roll: C.roll && C.roll.id + ' ' + C.roll.band, hist: C.hist }))
  await page.close()

  // ------------------------------------------------------------------ phase 2: projection vs the booked game
  page = await openPage()
  ok(await toPregame(page, pos), `${pos}: a fresh career for the booking test`)
  await page.evaluate(() => { window.__V146.stop(); window.closePregameV1513(); window.__V146.stop()
    const A = window.__GRIDIRON_AUDIT__, pl = A.getState().player, w = pl.weekResults.find(x => !x.played); w.usageV111 = 'normal'; w.focusV111 = null
    window.__snap146 = JSON.stringify(A.getState()) })
  const nb = await page.evaluate(n => { window.__V146.reset(); return window.__V146.sampleN(n) }, NB)
  ok(nb >= NB * .9, `${pos}: the week's baseline was played in the real engine`, `${nb} games`)
  const CFG = [{ usage: 'normal', plan: 'disciplined' }, { usage: 'everysnap', plan: 'explosive' }, { usage: 'limited', plan: 'disciplined' }]
  const res = {}
  for (const cfg of CFG) {
    const proj = await page.evaluate(c => { const V = window.__PREGAME_V51, h = V.hold(); const b = h ? V.band(c.plan) : null; return window.__V146.project({ usage: c.usage, focus: null, plan: c.plan, band: b }) }, cfg)
    const t0 = Date.now()
    const all = await page.evaluate(({ c, M }) => {
      const A = window.__GRIDIRON_AUDIT__, rows = []
      for (let j = 0; j < M; j++) {
        A.setState(JSON.parse(window.__snap146))
        const pl = A.getState().player, w = pl.weekResults.find(x => !x.played)
        w.usageV111 = c.usage; w.focusV111 = null; pl.planPickV146 = c.plan
        window.__silentWeekV85(pl, w)
        rows.push({ played: !!w.played, dnp: !w.statLine, plan: w.planV11, stat: w.statLine || {}, perf: w.perf, form: w.formV146, band: w.wheelV85 && w.wheelV85.band })
      }
      A.setState(JSON.parse(window.__snap146))
      return rows
    }, { c: cfg, M: M })
    // a week he sat out (the game's own injury / bench rules) has no box score and no plan: it is reported, not projected
    const dnp = all.filter(r => r.dnp).length, out = all.filter(r => !r.dnp)
    const head = proj.rows.find(r => r.head), k = head.k
    const xs = out.map(r => Number(r.stat[k]) || 0), sm = mean(xs), ss = sd(xs)
    const seP = (head.cvSim * head.mean) / Math.sqrt(nb), seS = ss / Math.sqrt(xs.length), z = (head.mean - sm) / Math.sqrt(seP * seP + seS * seS || 1)
    const cover = xs.filter(x => x >= head.lo - 1e-9 && x <= head.hi + 1e-9).length / xs.length
    const planned = out.every(r => r.plan === cfg.plan)
    ok(planned && all.every(r => r.played) && out.length >= M * .5, `${pos} ${cfg.usage}/${cfg.plan}: every booked game ran the chosen plan`, `${out.filter(r => r.plan === cfg.plan).length}/${out.length}${dnp ? ` (+${dnp} sat out)` : ''} (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
    ok(Math.abs(z) <= 3, `${pos} ${cfg.usage}/${cfg.plan}: projected ${head.label} ${r1(head.mean)} vs booked ${r1(sm)} ±${r1(seS)} — inside 3 combined standard errors`, `z=${z.toFixed(2)} (projection's own error ±${r1(seP)})`)
    // under-coverage is the misleading direction (a band that promises more certainty than the game has);
    // a small count floored at 0 can cover everything, so above 97% the band must at least be informative —
    // no wider than 4 booked standard deviations, or than 0–2, the tightest whole-number band round a sub-1 count
    ok(cover >= .6 && (cover <= .97 || head.hi - head.lo <= Math.max(4 * ss, 2)), `${pos} ${cfg.usage}/${cfg.plan}: the 80% band ${r1(head.lo)}–${r1(head.hi)} holds ${Math.round(cover * 100)}% of the booked games`)
    const others = proj.rows.filter(r => !r.head && r.mean != null && r.mean >= .3).map(r => { const v = out.map(o => Number(o.stat[r.k]) || 0); return `${r.label} ${r1(r.mean)}/${r1(mean(v))}` }).join(' · ')
    const perfs = out.map(r => r.perf)
    console.log(`      rows proj/booked: ${others || '—'} · grade ${proj.grade ? Math.round(proj.grade.mean) : '—'}/${Math.round(mean(perfs))} (sd ${proj.grade ? r1(proj.grade.sd) : '—'}/${r1(sd(perfs))}) · variance ±${proj.head.pct}% (booked ±${Math.round(100 * ss / Math.max(1e-9, sm))}%)`)
    res[cfg.usage + '/' + cfg.plan] = { proj, xs, sm, ss, forms: out.map(r => r.form || 0), perfs, z, cover }
    summary.push({ pos, cfg: cfg.usage + '/' + cfg.plan, stat: head.label, proj: r1(head.mean), band: `${r1(head.lo)}–${r1(head.hi)}`, booked: r1(sm), bookedSd: r1(ss), z: +z.toFixed(2), cover: Math.round(cover * 100) + '%', varProj: proj.head.pct + '%', varBooked: Math.round(100 * ss / Math.max(1e-9, sm)) + '%', grade: `${proj.grade ? Math.round(proj.grade.mean) : '—'}/${Math.round(mean(perfs))}` })
  }
  // variance means something
  const L = res['limited/disciplined'], E = res['everysnap/explosive'], N0 = res['normal/disciplined']
  const cvL = L.ss / Math.max(1e-9, L.sm), cvE = E.ss / Math.max(1e-9, E.sm)
  // the booked spread is itself an estimate: a CV off n games carries cv·sqrt(1/2n + cv²/n) of error, so the
  // booked games must agree with the ordering unless the gap is inside two combined errors (a defender's
  // one-or-two-tackle games can hide it)
  const seCv = (cv, n) => cv * Math.sqrt(1 / (2 * n) + cv * cv / n), gapSe = Math.sqrt(seCv(cvL, L.xs.length) ** 2 + seCv(cvE, E.xs.length) ** 2)
  ok(L.proj.head.pct > E.proj.head.pct && cvL > cvE - 2 * gapSe, `${pos}: LIMITED is called wider than EVERY SNAP, and the booked games are wider too (or level inside their own error)`, `projected ±${L.proj.head.pct}% vs ±${E.proj.head.pct}% · booked ±${Math.round(cvL * 100)}% vs ±${Math.round(cvE * 100)}% (±${Math.round(gapSe * 100)})`)
  const fsE = sd(E.forms), fsD = sd(N0.forms), cardE = E.proj.plan.formPts / Math.sqrt(3), cardD = N0.proj.plan.formPts / Math.sqrt(3)
  ok(fsE >= 2 * fsD && Math.abs(fsE - cardE) <= .3 * cardE, `${pos}: Chase the Highlight's form swing, as rolled in the booked games, is ≥2x Disciplined's and what its card says`, `sd ${r1(fsE)} (card ${r1(cardE)}) vs ${r1(fsD)} (card ${r1(cardD)})`)
  ok(E.proj.grade && N0.proj.grade && E.proj.grade.sd > N0.proj.grade.sd, `${pos}: the grade band is wider on the wider plan`, `grade sd projected ${r1(E.proj.grade.sd)} vs ${r1(N0.proj.grade.sd)} · booked ${r1(sd(E.perfs))} vs ${r1(sd(N0.perfs))}`)
  await page.close()
}

console.log('\nSUMMARY ' + JSON.stringify(summary, null, 1))
console.log(`\n${pass} passed, ${fail} failed`)
console.log('page errors: ' + (errs.length ? '\n  ' + [...new Set(errs)].slice(0, 12).join('\n  ') : 'none'))
ok(errs.length === 0, 'no page errors')
await browser.close()
process.exit(fail ? 1 : 0)
