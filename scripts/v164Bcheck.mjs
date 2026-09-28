// Dev check: v164 B THE SEASON SIMS TO THE TITLE GAME · v164 C WATCHING PAYS · v164 D LIVE SIM ONLY (src/07-career-app.js,
// src/20-leaderboards.js).
//   B: below the UFF a won regular season books the Semifinal — its dock keeps Quick Play and a "⏭ Sim to the
//      Championship", it is not the title week; the ⏭ sims it (and stops at the championship, or ends a lost run); the
//      championship week is locked (no Quick Play, the note says championship, playWeek(false) / the ⏭ / __silentWeekV85
//      refuse, the live SKIP is gone); at the UFF the season sim plays the earlier rounds and stops at the title game
//      (`lastSim.why === "playoffs"`, po ≥ 1) or finishes a lost run; TU v164Bsim 0 locks every playoff week again
//   C: the watched share → one multiplier (all watched ×1.25, none ×0.85, the title game weighs two games); the season's
//      Legacy XP carries it as a part and the championship pays double (×2 vs the switch off); the cut roll grows with
//      the simmed share; the report-card badge prints the share
//   D: a career started with LIVE SIM ONLY ticked carries the flag; its season dock offers only the live game (the note,
//      no Quick Play, no ⏭); playWeek(false) / prepareWeek103(false) / simRemainingWeeks refuse; the live SKIP is gone
//      and skipLive() refuses; the position screen shows the box; a finished career is recorded liveOnly and the boards
//      have a LIVE ONLY category that lists it and nothing else; TU v164Dlive 0 lifts the refusals
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v164Bcheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = (...q) => url + (url.includes('?') ? '&' : '?') + ['stayStale', 'noFilmV114', 'noGrowV132'].concat(q).join('&')
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const newCtx = async (tune) => {
  const context = await browser.newContext({ viewport: { width: 400, height: 860 } })
  await context.addInitScript((tune) => {
    window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, tune || {})
    try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
    setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80)
  }, tune || {})
  return context
}
const booted = (page) => page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V156B && !!window.__V164B && !!window.__V164C && !!window.__V164D, null, { timeout: 40000 })
  .then(() => page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null))
  .then(() => page.waitForTimeout(900))
const open = async (ctx, tag, q = []) => {
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(tag + ': ' + (e.message || e)))
  await p.goto(U(...q), { waitUntil: 'networkidle', timeout: 60000 }); await booted(p); await p.evaluate(() => document.getElementById('splash')?.remove()); return p
}
const M = (page, fn, arg) => page.evaluate(fn, arg)
const seed = (page, o = {}) => M(page, (o) => {
  const A = window.__GRIDIRON_AUDIT__, S = o.keep ? A.getState() : A.freshState(); S.tutorialSeen = true; S.tree = S.tree || {}
  if (!o.keep) A.setState(S)
  S.player = A.newPlayer(); const p = S.player; p.name = 'Test Man'; p.pos = 'QB'; p.age = 22; p.originV11 = p.originV11 || 'walk-on'; p._wonShown = true
  if ((o.level || 0) >= 7) { p.level = 6; p.totalSeasons = 12; p.career = []; S.view = 'hub'; A.advance(); window.__V146B.sign(2); for (const k in p.attrs) p.attrs[k] = 280; p.age = 27; if (p.nflStateV11) { p.nflStateV11.security = 90; p.nflStateV11.status = 'starter' } }
  else p.level = o.level || 0
  if (o.liveOnly) p.liveOnlyV164D = true
  p.training = 'balanced'; A.startSeasonGames()
  document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove()
  window.go('season'); window.GridironStorage.save(S)
  return { level: p.level, weeks: (p.weekResults || []).length }
}, o)
const dockOf = (page) => M(page, () => { const d = document.getElementById('dock'); return { txt: (d.innerText || '').replace(/\s+/g, ' '), sim: !!d.querySelector('[onclick^="seasonSkipV151A"]'), quick: !!d.querySelector('[onclick*="(false)"]'), note: !!d.querySelector('.playoff-live-v156b'), liveNote: !!d.querySelector('.live-only-v164d'), watch: !!d.querySelector('.watch-note-v164c') } })
const decide = (page, won, leave = 0) => M(page, ({ won, leave }) => { const p = window.S.player, r = p.weekResults.filter((w) => !w.playoff)
  r.slice(0, r.length - leave).forEach((w) => { w.played = true; w.won = won; w.us = won ? 31 : 10; w.them = won ? 10 : 31; w.perf = won ? 80 : 40; w.liveBookedV85 = true }); window.go('season')
  return p.weekResults.map((w) => (w.played ? 'P' : '.') + (w.playoff ? 'p' : '')).join('') }, { won, leave })
const wk = (page) => M(page, () => window.S.player.weekResults.map((w) => (w.played ? 'P' : '.') + (w.playoff ? 'p' : '')).join(''))
const goLive = (page) => M(page, async () => { const S = window.S, t = S.player, a = t.weekResults.findIndex((n) => !n.played); t.currentWeek = a
  S._liveGame = window.__simGameV2(t.weekResults[a].perf || 60, t.pos); S._oppName = t.weekResults[a].opp; window.go('live')
  for (let i = 0; i < 40 && !document.querySelector('.speed-row'); i++) await new Promise((r) => setTimeout(r, 150))
  return { skip: !!document.querySelector('.speed-row [onclick="skipLive()"]'), row: !!document.querySelector('.speed-row'), playoff: !!t.weekResults[a].playoff } })

// ============================== B. below the UFF: the semifinal sims, the championship is watched ==============================
{
  const c = await newCtx(), a = await open(c, 'B')
  await seed(a, { level: 2 })
  const w0 = await decide(a, true)
  const d0 = await dockOf(a)
  const t0 = await M(a, () => ({ title: window.__V164B.title(), simLeft: window.__V164B.simLeft(), lock: window.__V156B.playoffLock(), next: (window.S.player.weekResults.find((w) => !w.played) || {}).round }))
  console.log('semifinal week:', w0, JSON.stringify(d0), JSON.stringify(t0))
  ok(/\.p$/.test(w0) && t0.next === 'Semifinal' && !t0.title && !t0.lock && t0.simLeft, 'a won regular season books the Semifinal — not the title week, not locked, and there is something left to sim', t0)
  ok(d0.quick && d0.sim && /Sim to the Championship/i.test(d0.txt) && !d0.note && d0.watch, 'the Semifinal\'s dock keeps Quick Play, offers "⏭ Sim to the Championship" and says what watching pays', d0)
  // the ⏭ sims the semifinal: a win books the championship (locked), a loss ends the run
  const sim = await M(a, async () => { window.seasonSkipV151A(); await new Promise((r) => setTimeout(r, 2500)); const p = window.S.player
    return { last: window.__V164B.lastSim, wk: p.weekResults.map((w) => (w.played ? 'P' : '.') + (w.playoff ? 'p' : '')).join(''), po: p.playoffState, next: (p.weekResults.find((w) => !w.played) || {}).round, title: window.__V164B.title(), lock: window.__V156B.playoffLock(), view: window.S.view } })
  console.log('after the sim:', JSON.stringify(sim))
  const won = !!(sim.po && sim.po.alive && !sim.po.done)
  ok(sim.last && sim.last.po === 1 && (won ? (sim.last.why === 'title' && /CHAMPIONSHIP/.test(sim.next) && sim.title && sim.lock && /Pp\.p$/.test(sim.wk)) : (sim.po.done && !sim.po.champion)), 'the ⏭ simmed the Semifinal: a win booked the CHAMPIONSHIP (locked, the sim stopped there), a loss ended the run', { won, last: sim.last, next: sim.next })
  if (won) {
    const d1 = await dockOf(a)
    ok(!d1.quick && !d1.sim && d1.note && /championship is played live/i.test(d1.txt), 'the championship week\'s dock offers only "▶ Play … Live" — the note names the championship', d1)
    const tries = await M(a, async () => { const p = window.S.player, w = p.weekResults.find((x) => !x.played), n0 = p.weekResults.filter((x) => x.played).length, r0 = window.__V156B.refused
      window.playWeek(false); window.prepareWeek103(false); window.seasonSkipV151A(); const sw = window.__silentWeekV85(p, w); await new Promise((r) => setTimeout(r, 600))
      return { n0, n1: p.weekResults.filter((x) => x.played).length, sw, refused: window.__V156B.refused - r0 } })
    ok(tries.n1 === tries.n0 && tries.sw === false && tries.refused >= 3, 'playWeek(false), prepareWeek103(false), the ⏭ and __silentWeekV85 cannot play the championship', tries)
    const live = await goLive(a)
    const sk = await M(a, async () => { const v0 = window.S.view; window.skipLive(); await new Promise((r) => setTimeout(r, 300)); return { v0, v1: window.S.view } })
    ok(live.row && live.playoff && !live.skip && sk.v1 === 'live', 'the championship on the field has no SKIP, and skipLive() refuses', { live, sk })
  }
  // the kill switch: every playoff week locked again
  await seed(a, { keep: true, level: 2 }); await decide(a, true)
  const ks = await M(a, async () => { window.RIB_TUNE.v164Bsim = 0; window.go('season'); await new Promise((r) => setTimeout(r, 200)); const d = document.getElementById('dock'); const out = { lock: window.__V156B.playoffLock(), quick: !!d.querySelector('[onclick*="(false)"]'), sim: !!d.querySelector('[onclick^="seasonSkipV151A"]') }; delete window.RIB_TUNE.v164Bsim; return out })
  ok(ks.lock && !ks.quick && !ks.sim, 'TU v164Bsim 0: the Semifinal is locked to live play again (v156 B)', ks)
  await c.close()
}
// ============================== B. the UFF: the season sim runs the rounds, stops at the title game ==============================
{
  const c = await newCtx(), a = await open(c, 'B-uff')
  const s = await seed(a, { level: 7 })
  ok(s.level >= 7, 'a UFF man with a season in hand', s)
  await decide(a, true)
  const u = await M(a, async () => { window.seasonSkipV151A(); for (let i = 0; i < 60 && window.S.view === 'live'; i++) await new Promise((r) => setTimeout(r, 200)); await new Promise((r) => setTimeout(r, 2500)); const p = window.S.player
    return { view: window.S.view, last: window.__V147A.lastSim, wk: p.weekResults ? p.weekResults.map((w) => (w.played ? 'P' : '.') + (w.playoff ? 'p' : '')).join('') : null, po: p.playoffState, title: window.__V164B.title(), used: p.simsUsedV156B } })
  console.log('UFF sim:', JSON.stringify(u))
  const stopped = u.last && u.last.why === 'playoffs', done = u.view === 'result' || (u.po && u.po.done)
  ok((stopped && u.last.po >= 1 && u.title && /Pp.*\.p$/.test(u.wk || '')) || (done && u.last && u.last.po >= 1) || (done && u.last && u.last.po === 0 && u.po && !u.po.qualified), 'UFF: the sim plays the earlier rounds and stops at the title game (or a lost round ends the run)', { stopped, done, last: u.last, wk: u.wk })
  await c.close()
}
// ============================== C. watching pays ==============================
{
  const c = await newCtx(), a = await open(c, 'C')
  await seed(a, { level: 2 })
  const w = await M(a, () => { const p = window.S.player, V = window.__V164C, out = {}
    const rows = p.weekResults.filter((x) => !x.playoff); rows.forEach((x) => { x.played = true; x.satOut = false })
    rows.forEach((x) => { x.liveBookedV85 = true; delete x.wheelV85 }); out.all = V.watch()
    rows.forEach((x) => { x.liveBookedV85 = false; x.wheelV85 = true }); out.none = V.watch()
    rows.forEach((x, i) => { x.liveBookedV85 = i % 2 === 0; x.wheelV85 = !x.liveBookedV85 }); out.half = V.watch()
    // the title game weighs two: one title week watched among simmed regular games
    p.weekResults.push({ playoff: true, roundIdx: 1, round: 'CHAMPIONSHIP', played: true, liveBookedV85: true, opponentV11: { importance: 'championship' } })
    rows.forEach((x) => { x.liveBookedV85 = false; x.wheelV85 = true }); out.titleOnly = V.watch(); p.weekResults.pop()
    out.cutNone = V.cutRisk(); rows.forEach((x) => { x.liveBookedV85 = true; delete x.wheelV85 }); out.cutAll = V.cutRisk()
    const xp = V.seasonXp(p, { grade: 'A', playoffs: { champion: true, roundsWon: 1 } }); window.RIB_TUNE.titleXpMultV164C = 1; const xp1 = V.seasonXp(p, { grade: 'A', playoffs: { champion: true, roundsWon: 1 } }); delete window.RIB_TUNE.titleXpMultV164C
    out.xp = { gain: xp.gain, parts: xp.parts.map((q) => q[0]), gain1: xp1.gain, title: (xp.parts.find((q) => /Championship/.test(q[0])) || [])[1], title1: (xp1.parts.find((q) => /Championship/.test(q[0])) || [])[1] }
    out.badge = V.badge({ watchV164C: out.half }); window.RIB_TUNE.v164Cwatch = 0; out.off = V.watch(); out.offMult = V.titleMult(); delete window.RIB_TUNE.v164Cwatch
    return out })
  console.log('watch:', JSON.stringify(w))
  const wantHalf = Math.round((1 + 0.25 * w.half.share - 0.15 * (1 - w.half.share)) * 100) / 100
  ok(w.all.mult === 1.25 && w.all.share === 1 && w.none.mult === 0.85 && w.none.share === 0 && w.half.mult === wantHalf, 'every game watched ×1.25, none ×0.85, a share in between interpolates', { all: w.all.mult, none: w.none.mult, half: w.half.mult, want: wantHalf })
  ok(w.titleOnly.watched === 2 && w.titleOnly.games === w.none.games + 2, 'the championship weighs two games in the watched share', w.titleOnly)
  ok(Math.abs(w.xp.title - w.xp.title1 * 2) <= 1 && w.xp.gain > w.xp.gain1 && w.xp.parts.some((q) => /×2/.test(q)) && w.xp.parts.some((q) => /Watched live ×1.25/.test(q)), 'the season\'s Legacy XP: the championship pays double (×2 in the part\'s name) and the watched share is a labelled part', w.xp)
  ok(w.cutNone > 1.29 && w.cutNone < 1.31 && w.cutAll === 1, 'the cut roll is ×1.3 for a season simmed from the sofa, ×1 for one watched', { none: w.cutNone, all: w.cutAll })
  ok(new RegExp(Math.round(w.half.share * 100) + '% watched').test(w.badge) && w.badge.includes('×' + w.half.mult.toFixed(2)), 'the report card\'s badge prints the share and the multiplier', w.badge)
  ok(w.off.mult === 1 && w.offMult === 1, 'TU v164Cwatch 0: every multiplier is 1', { off: w.off.mult, title: w.offMult })
  await c.close()
}
// ============================== D. live sim only ==============================
{
  const c = await newCtx(), a = await open(c, 'D')
  const st = await M(a, async () => { const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S); S.liveOnlyNextV164D = true; window.startCareer(true); await new Promise((r) => setTimeout(r, 400))
    return { view: window.S.view, flag: !!window.S.player.liveOnlyV164D, card: !!document.querySelector('.live-only-card-v164d'), on: /LIVE SIM ONLY · ON/.test((document.querySelector('.live-only-card-v164d') || {}).textContent || '') } })
  ok(st.view === 'choosePos' && st.flag && st.card && st.on, 'a career started with LIVE SIM ONLY ticked carries the flag; the position screen shows the box, ON', st)
  const tg = await M(a, async () => { window.toggleLiveOnlyV164D(); await new Promise((r) => setTimeout(r, 200)); const off = { flag: !!window.S.player.liveOnlyV164D, next: window.__V164D.next() }; window.toggleLiveOnlyV164D(); await new Promise((r) => setTimeout(r, 200)); return { off, flag: !!window.S.player.liveOnlyV164D } })
  ok(!tg.off.flag && !tg.off.next && tg.flag, 'the box toggles the flag on a career that has not played yet', tg)
  await seed(a, { level: 2, liveOnly: true })
  const d = await dockOf(a)
  ok(/Play .*Live/i.test(d.txt) && !d.quick && !d.sim && d.liveNote && /LIVE SIM ONLY/.test(d.txt), 'its season dock offers only the live game — the note, no Quick Play, no ⏭', d)
  const tries = await M(a, async () => { const p = window.S.player, n0 = p.weekResults.filter((x) => x.played).length, r0 = window.__V164D.refused
    window.playWeek(false); window.prepareWeek103(false); window.simRemainingWeeks(); window.seasonSkipV151A(); await new Promise((r) => setTimeout(r, 800))
    return { n0, n1: p.weekResults.filter((x) => x.played).length, refused: window.__V164D.refused - r0, on: window.__V164D.on() } })
  ok(tries.n1 === tries.n0 && tries.refused >= 4 && tries.on, 'playWeek(false), prepareWeek103(false), simRemainingWeeks and the ⏭ refuse', tries)
  const live = await goLive(a)
  const sk = await M(a, async () => { window.skipLive(); await new Promise((r) => setTimeout(r, 300)); return window.S.view })
  ok(live.row && !live.skip && sk === 'live', 'a live game has no SKIP and skipLive() refuses', { live, sk })
  // the boards
  const lb = await M(a, () => { const L = window.__lb.career; const cats = L.categories().map((c) => c.id)
    const e1 = L.record({ hof: { name: 'Live Man', pos: 'QB', peak: 80, titles: 1, rings: 0, reached: 5, seasons: 6, won: false, box: {} }, level: 5, liveOnly: true, careerNo: 3, at: Date.now() })
    const e2 = L.record({ hof: { name: 'Sofa Man', pos: 'QB', peak: 90, titles: 2, rings: 0, reached: 5, seasons: 6, won: false, box: {} }, level: 5, liveOnly: false, careerNo: 4, at: Date.now() })
    const rows = L.rank(L.all(), 'liveonly', { limit: 50 }); const all = L.rank(L.all(), 'alltime', { limit: 50 })
    const live = L.live()
    return { cats, e1: !!e1.liveOnly, e2: !!e2.liveOnly, rows: rows.map((r) => r.name), all: all.length, liveRow: live && live.liveOnly } })
  ok(lb.cats.includes('liveonly') && lb.e1 && !lb.e2 && lb.rows.includes('Live Man') && !lb.rows.includes('Sofa Man') && lb.all >= 2 && lb.liveRow === true, 'the boards: a LIVE ONLY category lists the live-only career and not the other; the career being played is marked too', lb)
  const ui = await M(a, async () => { window.go('leaderboard'); await new Promise((r) => setTimeout(r, 400)); window.__lbCareerUI.cat('liveonly'); await new Promise((r) => setTimeout(r, 300)); const sc = document.getElementById('screen'); const on = sc.querySelector('.lb151-cat.on'); return { cats: sc.querySelectorAll('.lb151-cat').length, on: on && on.dataset.cat, rows: [...sc.querySelectorAll('.lb151-row')].map((r) => (r.textContent || '').replace(/\s+/g, ' ').slice(0, 60)), marks: sc.querySelectorAll('.lb151-row .lb151-liveonly').length, tv: (sc.textContent || '').includes('📺') } })
  ok(ui.cats === 14 && ui.on === 'liveonly' && ui.rows.some((r) => /Live Man/i.test(r)) && !ui.rows.some((r) => /Sofa Man/i.test(r)) && ui.marks >= 1, 'the leaderboard screen has the fourteenth tab, lists the live-only career alone and marks it 📺 LIVE ONLY', { cats: ui.cats, on: ui.on, rows: ui.rows, marks: ui.marks })
  const ks = await M(a, async () => { window.RIB_TUNE.v164Dlive = 0; window.go('season'); const p = window.S.player, r0 = window.__V164D.refused; const d = document.getElementById('dock'); const out = { on: window.__V164D.on(), quick: !!d.querySelector('[onclick*="(false)"]') }; delete window.RIB_TUNE.v164Dlive; return out })
  ok(!ks.on && ks.quick, 'TU v164Dlive 0: the flag stays but nothing refuses — Quick Play is back', ks)
  await c.close()
}
console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
console.log('page errors:', errors.length ? errors.slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
