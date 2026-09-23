// Dev check: v147 A — THE CAREER RUNS TO THE END, AND ENDS WHEN YOU SAY.
//
// Three phone reports from the DFL and the Interstellar League:
//   1. the career could not be ended — the life screen's RETIRE FROM FOOTBALL was buried (STORY tab,
//      folded) and, once there, clipped out of the retirement card by the v146 E shell's fit(), and
//      hidden under age 30 unless the exit plan was funded;
//   2. Sim Remaining did not finish the season — a stale v11 `nflStateV11.offers` list stops
//      `silentWeekV85` dead (0 weeks, no word), and the sim never covered the playoffs;
//   3. story decisions interrupt the season (the season event screen, rivalry week, DFL life events).
//
// Asserts, for a DFL save AND an Interstellar save (400x860, touch):
//   - one tap on "Sim the Rest of the Season" plays every regular-season and playoff game and lands on
//     the season report card
//   - a stale v11 offer list no longer stops the sim: it becomes the three-club screen, and signing
//     resumes the sim to the report card; a real mid-sim cut says the sim is paused and resumes too
//   - no story decision screen appears: a season event, Rivalry Week and a DFL life event are all
//     answered off screen (recorded on `autoDecisionsV147`), and quick play never shows an overlay
//   - ending the career works from each entry point: the hub's LIFE & RETIRE chip → the life screen's
//     docked RETIRE (visible, hit-testable, under age 30), the club screen's RETIRE INSTEAD, the report
//     card's ACCEPT RELEASE and RETIRE AT AGE — each lands on the career-end screen with `_settled`
//   - below the DFL nothing changed: the event screen still asks
//   - no page errors
//   node scripts/v147Acheck.mjs   (GAME_URL=http://localhost:5311/ to point it elsewhere)
import { chromium } from 'playwright'

const url = process.env.GAME_URL || 'http://localhost:5173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []

async function boot() {
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
  page.on('dialog', d => d.accept())
  await page.addInitScript(() => {
    try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
    setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove() }, 60)
  })
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'stayStale&noGrowV132', { waitUntil: 'networkidle', timeout: 40000 })
  await page.waitForTimeout(2000)
  await page.waitForFunction(() => { const s = document.getElementById('splash'); return !s || getComputedStyle(s).display === 'none' || s.classList.contains('gone') || getComputedStyle(s).opacity === '0' }, null, { timeout: 25000 }).catch(() => {})
  await page.evaluate(() => document.getElementById('splash')?.remove())
  return { ctx, page }
}

// a signed DFL (7) or Interstellar (8) player, strong enough to keep his job, on the season screen
const seed = (page, lv, opts = {}) => page.evaluate(({ lv, opts }) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.getState()
  S.tree = {}
  S.player = A.newPlayer(); const p = S.player
  p.pos = opts.pos || 'QB'; p.level = 6; p.age = 22; p.totalSeasons = 12; p.career = []
  p._wonShown = true; S.view = 'hub'
  A.advance(); window.__V146B.sign(2)
  if (lv === 8) { p.level = 8; p.nflRings = 1 }
  for (const k in p.attrs) p.attrs[k] = opts.av || 280
  p.age = opts.age || 27; p.originV11 = p.originV11 || 'walk-on'
  if (p.nflStateV11) { p.nflStateV11.security = 90; p.nflStateV11.status = 'starter' }
  if (opts.season !== false) { p.training = 'balanced'; A.startSeasonGames() }
  return { level: p.level, ovr: A.playerOVR(p), view: S.view, weeks: (p.weekResults || []).length }
}, { lv, opts })

const state = (page) => page.evaluate(() => {
  const p = window.S.player, vis = e => { if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' }
  return {
    view: window.S.view, settled: !!(p && p._settled), level: p && p.level,
    overlays: [...document.querySelectorAll('.decision-overlay,.story-overlay-v11,.life-event-overlay-v12,.nfl-offers-overlay-v11')].filter(vis).map(e => e.className),
    auto: (p && p.autoDecisionsV147 || []).map(r => r.kind + ':' + r.title + ' → ' + r.choice),
    lastSim: window.__V147A && window.__V147A.lastSim, club: !!(p && p.offersV146B), weeks: p && p.weekResults ? p.weekResults.map(w => (w.played ? 'P' : '.') + (w.playoff ? 'p' : '')).join('') : null,
    screen: ((document.getElementById('screen') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 160)
  }
})
// the visible, un-covered button whose words match, tapped like a finger would
async function tap(page, re, where = 'button') {
  const box = await page.evaluate(({ src, where }) => {
    const re = new RegExp(src, 'i')
    const el = [...document.querySelectorAll(where)].find(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && re.test((b.innerText || '').replace(/\s+/g, ' ')) })
    if (!el) return null
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, top = document.elementFromPoint(cx, cy)
    return { cx, cy, onScreen: r.top >= 0 && r.bottom <= innerHeight, hit: !!top && (top === el || el.contains(top)), text: el.innerText.replace(/\s+/g, ' ').slice(0, 60) }
  }, { src: re.source, where })
  if (box && box.hit && box.onScreen) { await page.touchscreen.tap(box.cx, box.cy) }
  return box
}
const waitView = (page, v, ms = 20000) => page.waitForFunction((v) => window.S && window.S.view === v, v, { timeout: ms }).then(() => true).catch(() => false)

for (const LV of [7, 8]) {
  const tag = LV === 7 ? 'DFL' : 'INTERSTELLAR'
  // ------------------------------------------------------------ the sim runs to the report card
  {
    const { ctx, page } = await boot()
    const s0 = await seed(page, LV)
    await page.evaluate(() => window.go('season')); await page.waitForTimeout(700)
    const t = await tap(page, /Sim the Rest of the Season/)
    ok(t && t.hit && t.onScreen, `${tag}: the season screen shows a tappable "Sim the Rest of the Season" from week 1`, t)
    const landed = await waitView(page, 'result', 60000)
    await page.waitForTimeout(600)
    const st = await state(page)
    const log = await page.evaluate(() => { const p = window.S.player, l = (p.seasonLogV77 || p.seasonLog || []); return { po: p.playoffState || null, season: p.totalSeasons } })
    ok(landed && st.view === 'result', `${tag}: one tap sims the whole season and lands on the season report`, { view: st.view, lastSim: st.lastSim })
    ok(st.lastSim && st.lastSim.left === 0 && !st.lastSim.why && st.lastSim.n >= s0.weeks, `${tag}: every game was played (${s0.weeks} regular${st.lastSim && st.lastSim.po ? ' + ' + st.lastSim.po + ' playoff' : ''})`, st.lastSim)
    ok(st.overlays.length === 0, `${tag}: no decision overlay left on the report card`, st.overlays)

    // ---------------------------------------------------------- Retire at age (the report card's own exit)
    await page.evaluate(() => { const p = window.S.player; p.age = 45; p.retirementPending = true; window.go('result') }); await page.waitForTimeout(700)
    const ra = await tap(page, /Retire at Age/)
    await page.waitForTimeout(900)
    const st2 = await state(page)
    ok(ra && ra.hit && st2.view === 'gameover' && st2.settled, `${tag}: RETIRE AT AGE on the report card ends the career`, { tap: ra, view: st2.view, settled: st2.settled })
    await ctx.close()
  }
  // ------------------------------------------------------------ a playoff team: the sim plays the playoffs too
  {
    const { ctx, page } = await boot()
    await seed(page, LV)
    const reg = await page.evaluate(() => { const p = window.S.player, r = p.weekResults.filter(w => !w.playoff); r.slice(0, -1).forEach(w => { w.played = true; w.won = true; w.us = 31; w.them = 10; w.perf = 80 }); window.go('season'); return r.length })
    await page.waitForTimeout(700)
    const t = await tap(page, /Sim the Rest of the Season/)
    const landed = await waitView(page, 'result', 60000)
    const st = await state(page)
    ok(t && t.hit && landed && st.lastSim && st.lastSim.po >= 1 && st.lastSim.left === 0, `${tag}: with one week left and a playoff record, one tap plays the last week AND the playoffs, then the report`, st.lastSim)
    await ctx.close()
  }
  // ------------------------------------------------------------ stale v11 offers, a real cut
  {
    const { ctx, page } = await boot()
    await seed(page, LV)
    await page.evaluate(() => { const p = window.S.player, s = p.nflStateV11; s.offers = [{ id: 'old1', team: 'Old Club', role: 'active-backup', years: 1, salary: 900000, security: 40, schemeFit: 50, guaranteed: .2 }]; s.status = 'waivers'; window.go('season') })
    await page.waitForTimeout(800)
    let st = await state(page)
    ok(st.view === 'club' && st.club, `${tag}: an old v11 offer list opens the three-club screen instead of stopping the sim silently`, { view: st.view })
    await page.click('.club-card-v146b >> nth=0'); await page.click('#clubSignV146B'); await page.waitForTimeout(700)
    const t = await tap(page, /Sim the Rest of the Season/)
    const landed = await waitView(page, 'result', 60000)
    st = await state(page)
    ok(t && landed && st.lastSim && st.lastSim.left === 0, `${tag}: after signing, the sim runs the season out`, st.lastSim)
    await ctx.close()
  }
  {
    const { ctx, page } = await boot()
    await seed(page, LV)
    await page.evaluate(() => { const p = window.S.player; p.nflStateV11.security = 0; p.nflStateV11.status = 'practice-squad'; window.go('season') }); await page.waitForTimeout(700)
    await tap(page, /Sim the Rest of the Season/)
    await waitView(page, 'club', 30000); await page.waitForTimeout(500)
    let st = await state(page)
    const note = await page.evaluate(() => (document.querySelector('.sim-note-v147') || {}).innerText || '')
    ok(st.view === 'club' && /sim is paused after \d+ game/i.test(note), `${tag}: a real cut stops the sim on the club screen, and the screen says the sim is paused`, { view: st.view, note })
    const chip = await page.evaluate(() => { const b = document.querySelector('#dock .retire-chip-v147'); return b ? b.innerText : null })
    ok(/Retire Instead/i.test(chip || ''), `${tag}: the club screen offers RETIRE INSTEAD`, chip)
    await page.evaluate(() => { window.S.player.nflStateV11.security = 95 })
    await page.click('.club-card-v146b >> nth=2'); await page.click('#clubSignV146B')
    const landed = await waitView(page, 'result', 60000)
    st = await state(page)
    ok(landed && st.lastSim && st.lastSim.left === 0, `${tag}: signing picks the sim back up and it runs to the report card`, st.lastSim)
    await ctx.close()
  }
  // ------------------------------------------------------------ no story decisions mid-season
  {
    const { ctx, page } = await boot()
    await seed(page, LV, { season: false })
    // the season event (70% after training) — forced, so the screen would have to ask
    await page.evaluate(() => { const p = window.S.player; p.pendingEvent = 'coach'; window.go('event') }); await page.waitForTimeout(900)
    let st = await state(page)
    ok(st.view === 'season' && st.auto.some(a => /^event:Scheme Conflict/.test(a)), `${tag}: the season event is answered off screen and the season starts`, { view: st.view, auto: st.auto })
    // Rivalry Week: booked for game week, never a screen
    await page.evaluate(() => { const p = window.S.player; p.weekResults = null; p.pendingEvent = 'bigGame'; window.go('event') }); await page.waitForTimeout(900)
    st = await state(page)
    const riv = await page.evaluate(() => { const c = window.S.player.eventChoice || {}; return { pending: !!c.pendingV136, rival: !!c.rivalV128 } })
    ok(st.view === 'season' && riv.rival && riv.pending, `${tag}: Rivalry Week is booked for game week, no screen`, { view: st.view, riv })
    // a DFL life event queued on the player is answered before the screen draws
    await page.evaluate(() => { window.__V90.queueLife(window.S.player, 3); window.go('season') }); await page.waitForTimeout(700)
    st = await state(page)
    const q = await page.evaluate(() => ((window.S.player.lifeV12 || {}).eventQueue || []).length)
    ok(q === 0 && st.overlays.length === 0 && st.auto.some(a => /^life:/.test(a)), `${tag}: a DFL life event is answered off screen`, { left: q, overlays: st.overlays, auto: st.auto.filter(a => /^life/.test(a)) })
    // quick play the first weeks: never an overlay, and the rivalry week is decided when it comes
    let seen = []
    for (let k = 0; k < 7; k++) {
      const t = await tap(page, /Quick Play/)
      if (!t) break
      await page.waitForTimeout(1200)
      const s = await state(page)
      seen.push(...s.overlays)
      if (s.view !== 'season') seen.push('view:' + s.view)
    }
    ok(seen.length === 0, `${tag}: seven weeks of quick play never stop for a decision`, seen)
    await ctx.close()
  }
  // ------------------------------------------------------------ ending the career: hub → life → retire (under 30)
  {
    const { ctx, page } = await boot()
    await seed(page, LV, { season: false, age: 26 })
    await page.evaluate(() => window.go('hub')); await page.waitForTimeout(900)
    const hub = await tap(page, /Life & Retire/)
    ok(hub && hub.hit && hub.onScreen, `${tag}: the hub has a visible LIFE & RETIRE chip`, hub)
    await waitView(page, 'life', 5000); await page.waitForTimeout(600)
    const r = await tap(page, /Retire From Football/, '#dock button')
    ok(r && r.hit && r.onScreen, `${tag}: the life screen's RETIRE is in the dock, on screen and not covered (age 26)`, r)
    await page.waitForTimeout(1000)
    const st = await state(page)
    ok(st.view === 'gameover' && st.settled && /Retire|walks away/i.test(st.screen), `${tag}: retiring lands on the career-end screen with the career closed`, { view: st.view, settled: st.settled, screen: st.screen.slice(0, 80) })
    await ctx.close()
  }
  // ------------------------------------------------------------ club screen: retire instead; report card: accept release
  {
    const { ctx, page } = await boot()
    await seed(page, LV)
    await page.evaluate(() => { window.__V146B.cut('test'); window.go('season') }); await page.waitForTimeout(800)
    const t = await tap(page, /Retire Instead/, '#dock button')
    await page.waitForTimeout(900)
    const st = await state(page)
    ok(t && t.hit && st.view === 'gameover' && st.settled, `${tag}: RETIRE INSTEAD on the club screen ends the career`, { tap: t, view: st.view })
    await ctx.close()
  }
  {
    const { ctx, page } = await boot()
    await seed(page, LV)
    await page.evaluate(() => window.go('season')); await page.waitForTimeout(500)
    await tap(page, /Sim the Rest of the Season/)
    await waitView(page, 'result', 60000); await page.waitForTimeout(500)
    await page.evaluate(() => { window.S.player.nflCutPending = true; window.go('result') }); await page.waitForTimeout(700)
    const t = await tap(page, /Accept Release/)
    await page.waitForTimeout(900)
    const st = await state(page)
    ok(t && t.hit && st.view === 'gameover' && st.settled, `${tag}: ACCEPT RELEASE on the report card ends the career`, { tap: t, view: st.view })
    await ctx.close()
  }
}

// ------------------------------------------------------------ below the DFL, the event screen still asks
{
  const { ctx, page } = await boot()
  const r = await page.evaluate(() => {
    const A = window.__GRIDIRON_AUDIT__, S = A.getState()
    S.player = A.newPlayer(); const p = S.player; p.pos = 'QB'; p.level = 5; p.age = 20; p.originV11 = p.originV11 || 'walk-on'
    p.pendingEvent = 'coach'; window.go('event')
    return { view: S.view, cards: document.querySelectorAll('#screen .pos-card').length, auto: (p.autoDecisionsV147 || []).length }
  })
  ok(r.view === 'event' && r.cards >= 3 && r.auto === 0, 'college: the season event screen still asks (lower levels unchanged)', r)
  await ctx.close()
}

console.log('page errors:', errs.length ? errs.join('\n') : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await b.close()
process.exit(fail || errs.length ? 1 : 0)
