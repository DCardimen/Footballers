// Dev check: v85 — ratings past 99, the wheel in the background, the body on the
// sheet, and the season ahead.
//
// Four claims, each asserted against the game rather than a copy of it:
//   1. OVR is open-ended: a prestiged NFL roster and its team rating clear 99 on the
//      same builder (Wr) the engine plays with, and the scoreboard pair (teamPairV76)
//      does too. The you-player's curve and the tier labels are unchanged.
//   2. A quick-played week and "sim the rest" roll the v51 plan wheel silently
//      (decidePlan, applyDecision), book the week through ca() — engine stat line,
//      plan, fate roll, injuries materialised — and leave nothing on screen.
//   3. The attribute sheet shows the EFFECTIVE value of every attribute for the next
//      game (condMultV54 + the wheel's swing) with the cut drawn on the track, plus
//      the injury-risk badge; the pregame stat list agrees with it.
//   4. The season projection is the resolver's own gain formula run as an expected
//      value: positive, plan-sensitive (a speed program projects more speed than a
//      film program), and drawn as a hollow extension with a "+N" label.
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
    const el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
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

// ---- 1. ratings past 99, on the builder the engine plays with
const ovr = await page.evaluate(() => {
  const pl = window.S.player, o = window.S
  const keep = { level: pl.level, prestige: o.prestige }
  try {
    pl.level = 7; o.prestige = 40
    const pair = window.__TEAMPAIR_V76(pl, {})
    const pv = window.__previewMatchupV22(pl.pos, 92)
    const top = pv ? Math.max(...pv.us.players.map(p => p.ovr)) : 0
    return { pairUs: pair.us, pairOpp: pair.opp, teamOvr: pv && pv.us.ovr, topPlayer: top, oppOvr: pv && pv.opp.ovr }
  } finally { pl.level = keep.level; o.prestige = keep.prestige }
})
console.log('ovr:', JSON.stringify(ovr))
ok(ovr.pairUs > 99, 'a prestiged NFL side clears 99 on the scoreboard pair', ovr.pairUs + ' vs ' + ovr.pairOpp)
ok(ovr.teamOvr > 99 && ovr.topPlayer > 99, 'the roster builder rates the team and its best player past 99', ovr.teamOvr + ' team · ' + ovr.topPlayer + ' best')
ok(ovr.oppOvr <= 130, 'the opponent stays on its own scale (no runaway)', ovr.oppOvr)

// ---- 2a. a quick-played week rolls the wheel in the background
const q1 = await page.evaluate(async () => {
  const pl = window.S.player
  const before = pl.weekResults.filter(w => w.played).length
  window.playWeek(false)
  await new Promise(r => setTimeout(r, 900))
  const w = pl.weekResults[before]
  return {
    played: !!(w && w.played), gen: !!(w && w.generatedV11), stat: !!(w && (w.statLine || w.satOut)), sat: !!(w && w.satOut), wheel: w && w.wheelV85 || null,
    plan: w && w.planV11, perf: w && w.perf, overlays: document.querySelectorAll('.gameplan-overlay,#pregameV1513,#growthV42,.wheel-overlay-v50').length,
    view: window.S.view,
  }
})
console.log('quick:', JSON.stringify(q1))
ok(q1.played && q1.gen && q1.stat, 'quick play books the week through ca() with an engine stat line (or a DNP when the body gave out)', `played=${q1.played} gen=${q1.gen} stat=${q1.stat} sat=${q1.sat} perf=${q1.perf}`)
ok(q1.wheel && /green|neutral|red|scout/.test(q1.wheel.band), 'the plan wheel rolled in the background and the week says so', JSON.stringify(q1.wheel))
ok(q1.overlays === 0 && q1.view === 'season', 'nothing was drawn: no deck, no wheel, no pregame panel', `overlays=${q1.overlays} view=${q1.view}`)

// ---- 3. the sheet shows what the body does to every number
const body = await page.evaluate(() => {
  const pl = window.S.player, V = window.__V85
  const c = pl.conditionV11 || (pl.conditionV11 = {})
  const keepFat = c.fatigue, keepInj = c.injury
  c.fatigue = 88; c.injury = null
  const ef = V.effAttrs(pl)
  const big = Object.keys(pl.attrs).sort((a, b) => pl.attrs[b] - pl.attrs[a])[0]
  window.go('hub')
  const loss = document.querySelectorAll('.attr .track .loss').length
  const dn = document.querySelectorAll('.attr .eff.dn').length
  const badge = document.querySelector('.bodyv85')
  const badgeTxt = badge ? badge.textContent.replace(/\s+/g, ' ').trim() : ''
  const pre = window.pregamePlayerStatsV25(pl)
  const led = window.__BODY_V73.ledger(pl)
  c.fatigue = 8
  const ef2 = V.effAttrs(pl)
  window.go('hub')
  const gain = document.querySelectorAll('.attr .track .gain').length
  const up = document.querySelectorAll('.attr .eff.up').length
  c.fatigue = keepFat; c.injury = keepInj
  return { mult: ef.mult, big, base: pl.attrs[big], eff: ef.eff[big], loss, dn, badgeTxt, preHasRisk: /injury risk/.test(pre), preHasCut: /\(-\d+\)/.test(pre),
    risk: led.risk, badgeRisk: (badgeTxt.match(/([\d.]+)% injury risk/) || [])[1], mult2: ef2.mult, gain, up }
})
console.log('body:', JSON.stringify(body))
ok(body.mult < 1 && body.eff < body.base, 'a worn body lowers the effective value below the true one', `${body.big} ${body.base} → ${body.eff} (×${body.mult})`)
ok(body.loss > 0 && body.dn > 0, 'the hub sheet draws the cut on the track and the effective number in red', `loss bars=${body.loss} red values=${body.dn}`)
ok(/injury risk/.test(body.badgeTxt) && /games expected missed/.test(body.badgeTxt) && /WORN DOWN/.test(body.badgeTxt), 'the injury-risk badge is on the sheet: % this game, games expected, the body\'s state', body.badgeTxt)
ok(body.badgeRisk && Math.abs(parseFloat(body.badgeRisk) - body.risk * 100) < 0.06, 'the badge quotes the real injChanceV54 through the ledger', `${body.badgeRisk}% vs ${(body.risk * 100).toFixed(2)}%`)
ok(body.preHasRisk && body.preHasCut, 'the pregame stat list carries the same badge and the same cut', `risk=${body.preHasRisk} cut=${body.preHasCut}`)
ok(body.mult2 > 1 && body.gain > 0 && body.up > 0, 'fresh legs read as a lift, in green', `×${body.mult2} gain bars=${body.gain}`)

// ---- 4. the season ahead: positive, plan-sensitive, drawn hollow
const proj = await page.evaluate(() => {
  const pl = window.S.player, V = window.__V85
  const keep = pl.training
  pl.training = 'speed'; const ps = V.project(pl)
  pl.training = 'film'; const pf = V.project(pl)
  pl.training = keep
  window.go('hub')
  const hollow = document.querySelectorAll('.attr .track .proj').length
  const labels = [...document.querySelectorAll('.attr .projn')].map(e => e.textContent.trim())
  const sum = Object.values(ps).reduce((a, b) => a + b, 0)
  const legend = document.querySelector('.attrs-legend-v85')
  return { speed: ps.speed, speedFilm: pf.speed, aware: ps.awareness, awareFilm: pf.awareness, sum, hollow, labels: labels.slice(0, 6), legend: !!legend, n: Object.keys(ps).length }
})
console.log('proj:', JSON.stringify(proj))
ok(proj.n > 10 && proj.sum > 0, 'the projection covers the sheet and expects growth', `${proj.n} attrs · +${proj.sum.toFixed(1)} total`)
ok(proj.speed > proj.speedFilm && proj.awareFilm > proj.aware, 'the projection follows the plan: a speed program projects more speed, a film program more awareness', `speed ${proj.speed}/${proj.speedFilm} · awareness ${proj.aware}/${proj.awareFilm}`)
ok(proj.hollow > 0 && proj.labels.length > 0 && proj.labels.every(l => /^▹[+-]\d+$/.test(l)), 'hollow green extensions with +N labels are on the sheet', `${proj.hollow} bars · ${proj.labels.join(' ')}`)
ok(proj.legend, 'the legend names what the marks mean')

// ---- 2b. sim the rest: every week rolled, every week booked, nothing on screen
const sim = await page.evaluate(async () => {
  const pl = window.S.player
  const c = pl.conditionV11 || {}; c.fatigue = 20; c.injury = null
  window.go('season')
  window.simRemainingWeeks()
  await new Promise(r => setTimeout(r, 1200))
  const reg = pl.weekResults.filter(w => !w.playoff)
  return {
    total: reg.length, played: reg.filter(w => w.played).length,
    gen: reg.filter(w => w.generatedV11 || w.satOut).length,
    stat: reg.filter(w => w.statLine || w.satOut).length,
    wheel: reg.filter(w => w.wheelV85 || w.satOut).length,
    bands: reg.map(w => w.wheelV85 && w.wheelV85.band).filter(Boolean),
    sat: reg.filter(w => w.satOut).length,
    overlays: document.querySelectorAll('.gameplan-overlay,#pregameV1513').length,
    left: [...document.querySelectorAll('[class*="overlay"],[id*="wheel"],[class*="wheel"]')].map(e => (e.id || '') + '.' + String(e.className).slice(0, 40)).slice(0, 4),
    view: window.S.view, perfs: reg.map(w => w.perf),
  }
})
console.log('sim:', JSON.stringify(sim))
ok(sim.played === sim.total, 'sim the rest plays every regular-season week', `${sim.played}/${sim.total}`)
ok(sim.gen === sim.total && sim.stat === sim.total, 'every simmed week went through ca() and carries an engine stat line (or sat out, hurt)', `gen=${sim.gen} stat=${sim.stat} sat=${sim.sat}`)
ok(sim.wheel === sim.total, 'the wheel rolled for every simmed week', `bands: ${sim.bands.join(',')}`)
ok(sim.overlays === 0 && sim.view === 'season', 'no pregame deck or panel is left on screen', `overlays=${sim.overlays} view=${sim.view} left=${sim.left.join('|')}`)

// ---- 2c. the live game you watched is the one the season counts
const live = await page.evaluate(() => {
  const pl = window.S.player
  const w = pl.weekResults.find(x => x.played && !x.satOut && x.statLine)
  if (!w) return null
  const g = window.__simGameV2(60, pl.pos)
  const before = { perf: w.perf, us: w.us, them: w.them, key: JSON.stringify(w.statLine) }
  window.bookLiveGameV85(pl, w, g)
  return { same: w.statLine === g.stat, us: w.us === g.usScore && w.them === g.themScore, perfMoved: w.perf !== before.perf || JSON.stringify(g.stat) === before.key, perf: [before.perf, w.perf], booked: !!w.liveBookedV85 }
})
console.log('live:', JSON.stringify(live))
ok(live && live.same && live.us && live.booked, 'a watched game overwrites the pre-booked one: its stat line and score are what the week keeps', live && `perf ${live.perf[0]} → ${live.perf[1]}`)

await browser.close()
console.log(JSON.stringify({ pass, fail }))
console.log('page errors:', errs.length ? errs : 'none')
if (fail || errs.length) process.exit(1)
