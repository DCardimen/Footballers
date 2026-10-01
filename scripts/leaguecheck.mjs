// Dev check: v167 THE LEAGUE IS REAL (src/07-career-app.js).
//   A season has a league: you and `leagueTeamsV167` named, rated teams (16 at the Interstellar level, whose bracket is
//   16 deep), distinct names, a round-robin schedule. Every regular-season week's opponent is that week's league team, at
//   its league rating (the rivalry week keeps its lift). The other teams play each other by rating on a seeded stream, so
//   the table is stable when read twice and the strong teams RISE (rating vs final rank across many leagues). The playoff
//   opponents come from the top of the table: the title-game opponent is usually one of the best teams and never a team
//   with a losing record far below the field (the old one was a fresh random name whose scorebug record was a hash: 0-11).
//   The schedule rows carry each league opponent's record and place; the standings screen IS the league; the live
//   scorebug's opponent record is his league record. TU v167league 0: no league, the old weekly draws.
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/leaguecheck.mjs
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
const booted = (page) => page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V167, null, { timeout: 40000 })
  .then(() => page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null))
  .then(() => page.waitForTimeout(900))
const open = async (ctx, tag, q = []) => {
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(tag + ': ' + (e.message || e)))
  await p.goto(U(...q), { waitUntil: 'networkidle', timeout: 60000 }); await booted(p); await p.evaluate(() => document.getElementById('splash')?.remove()); return p
}
const M = (page, fn, arg) => page.evaluate(fn, arg)
const seed = (page, o = {}) => M(page, (o) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; S.tree = S.tree || {}
  A.setState(S)
  S.player = A.newPlayer(); const p = S.player; p.name = 'Test Man'; p.pos = 'QB'; p.age = 17; p.originV11 = p.originV11 || 'walk-on'; p._wonShown = true
  p.level = o.level || 0; p.training = 'balanced'; A.startSeasonGames()
  document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove()
  window.go('season'); window.GridironStorage.save(S)
  return { level: p.level, weeks: (p.weekResults || []).length }
}, o)

// ============================== A. the league and its schedule ==============================
const c = await newCtx(), a = await open(c, 'A')
for (const level of [0, 2, 4]) {
  await seed(a, { level })
  const L = await M(a, () => {
    const p = window.S.player, L = window.__V167.league(p), reg = p.weekResults.filter((w) => !w.playoff)
    const rows = reg.map((w, k) => { const pr = L.sched[k].find((q) => q[0] === 0 || q[1] === 0), li = pr[0] === 0 ? pr[1] : pr[0]
      return { opp: w.opp, li, idx: w.leagueIdxV167, name: L.teams[li].name, rating: w.opponentV11.rating, want: L.teams[li].rating, rival: !!w.rivalV128 } })
    return { on: window.__V167.on(), n: L.teams.length, names: new Set(L.teams.map((t) => t.name)).size, me: L.teams[0].me, mine: L.teams[0].name, team: window.S.player.teamIdentity && window.S.player.teamIdentity.name,
      rounds: L.sched.length, games: reg.length, rows, rated: L.teams.slice(1).every((t) => Number.isFinite(t.rating)), clash: L.teams.slice(1).some((t) => String(L.teams[0].name).toUpperCase().endsWith(' ' + String(t.name).toUpperCase())) }
  })
  const bad = L.rows.filter((r) => r.opp !== r.name || r.idx !== r.li || (!r.rival && r.rating !== Math.round(r.want)))
  ok(!L.clash, `level ${level}: no league team carries your own mascot`, { mine: L.mine })
  ok(L.on && L.n >= 10 && L.names === L.n && L.me && L.rated, `level ${level}: a league of ${L.n} distinct, rated teams with you at index 0`, { n: L.n, names: L.names })
  ok(L.rounds === L.games && bad.length === 0, `level ${level}: every regular-season week is that week's league opponent, at its league rating`, bad.slice(0, 3))
}
// the Interstellar bracket is 16 deep: the league holds 16
{
  const n8 = await M(a, () => { const p = window.S.player, q = Object.assign({}, p, { level: 8 }); return window.__V167.make(q).teams.length })
  ok(n8 >= 16, 'Interstellar (4 playoff rounds): the league holds the whole 16-team field', n8)
}
// a stubbed Math.random (v146Bcheck pins it to land a cut roll) draws one name forever: the league still ends, all distinct
{
  const st = await M(a, () => { const was = Math.random; Math.random = () => 0.001; let out
    try { const L = window.__V167.make(window.S.player); out = { n: L.teams.length, names: new Set(L.teams.map((t) => t.name)).size } } catch (e) { out = { err: String(e) } }
    Math.random = was; return out })
  ok(st.n >= 10 && st.names === st.n, 'a constant Math.random still builds a league of distinct names (the naming loop ends)', st)
}

// ============================== B. the strong teams rise; the title game is against one of them ==============================
await seed(a, { level: 2 })
const B = await M(a, () => {
  const p0 = window.S.player, V = window.__V167
  const rankCorr = [], topVsBottom = [], titlePct = [], titleWinPct = [], titleRank = [], minRec = [], stable = []
  for (let s = 1; s <= 160; s++) {
    const q = Object.assign({}, p0, { seasonSeed: 1000 + s * 7919 })
    q.leagueV167 = V.make(q)
    const L = q.leagueV167, games = L.sched.length
    // you win every game (you qualify) — the question is who ELSE rises
    q.weekResults = L.sched.map((_, k) => ({ week: k + 1, played: true, won: true, us: 28, them: 14, leagueIdxV167: -1 }))
    const T = V.table(q), T2 = V.table(q)
    stable.push(JSON.stringify(T.teams.map((r) => [r.idx, r.w])) === JSON.stringify(T2.teams.map((r) => [r.idx, r.w])))
    const others = T.teams.filter((r) => !r.me), n = others.length
    // Spearman: league rating rank vs final table rank among the AI teams
    const byRating = others.slice().sort((x, y) => y.rating - x.rating).map((r) => r.idx)
    let d2 = 0; others.forEach((r, k) => { const rr = byRating.indexOf(r.idx); d2 += (rr - k) ** 2 })
    rankCorr.push(1 - (6 * d2) / (n * (n * n - 1)))
    const half = Math.floor(n / 3)
    const mean = (xs) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length)
    topVsBottom.push(mean(others.slice(0, half).map((r) => r.rating)) - mean(others.slice(n - half).map((r) => r.rating)))
    // the title game: the last round's opponent
    const R = q.level >= 2 ? 2 : 1, li = V.playoffOpp(R - 1, q)
    const opp = T.teams.find((r) => r.idx === li)
    const sorted = others.map((r) => r.rating).sort((x, y) => x - y)
    titlePct.push(sorted.filter((x) => x < opp.rating).length / Math.max(1, n - 1))
    titleWinPct.push(opp.w / Math.max(1, opp.w + opp.l))
    titleRank.push(others.indexOf(opp) + 1)
    minRec.push(opp.w + '-' + opp.l)
  }
  const mean = (xs) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length)
  const worst = titleWinPct.slice().sort((x, y) => x - y)
  return { corr: mean(rankCorr), gap: mean(topVsBottom), pct: mean(titlePct), win: mean(titleWinPct), worstWin: worst[0], p10Win: worst[Math.floor(worst.length * 0.1)],
    rank1to2: titleRank.filter((r) => r <= 2).length / titleRank.length, maxRank: Math.max(...titleRank), stable: stable.every(Boolean), sample: minRec.slice(0, 8) }
})
console.log('league sample:', JSON.stringify(B))
ok(B.stable, 'the table is the same whenever it is read (the AI games are seeded)')
ok(B.corr >= 0.55, 'the strong teams rise: league rating vs final rank among the AI teams (Spearman, 160 leagues)', B.corr.toFixed(3))
// the ratings are drawn as the weekly opponents always were (a 13-point spread), so a league's top-to-bottom range is ~13
ok(B.gap >= 4, 'the top third of the table is rated well above the bottom third (mean OVR gap)', B.gap.toFixed(1))
ok(B.pct >= 0.7, 'the title-game opponent is one of the best teams (mean rating percentile among the league)', B.pct.toFixed(3))
ok(B.win >= 0.65 && B.p10Win >= 0.5, 'the title-game opponent has a winning record (mean win%, and the worst tenth still ≥ .500)', { win: B.win.toFixed(3), p10: B.p10Win.toFixed(3), worst: B.worstWin.toFixed(3) })
ok(B.rank1to2 >= 0.6 && B.maxRank <= 3, 'semifinal field: the title opponent is the #1 or #2 AI team most seasons, never below the field', { rank1to2: B.rank1to2.toFixed(2), maxRank: B.maxRank })

// ============================== C. the season screen, the playoff row, standings, the scorebug ==============================
await seed(a, { level: 2 })
const C = await M(a, async () => {
  const p = window.S.player, reg = p.weekResults.filter((w) => !w.playoff)
  reg.forEach((w) => { w.played = true; w.won = true; w.us = 31; w.them = 10; w.perf = 80; w.liveBookedV85 = true })
  window.go('season'); await new Promise((r) => setTimeout(r, 200))
  const row = p.weekResults.find((w) => w.playoff && !w.played) || {}
  const tags = document.querySelectorAll('#screen .sched-rec167').length
  const card = ((document.querySelector('#screen .opponent-card-v11 .league-line-v167') || {}).textContent || '').trim()
  const T = window.__V167.table(p), others = T.teams.filter((r) => !r.me)
  const L = window.__V167.league(p), want = L && row.leagueIdxV167 != null ? L.teams[row.leagueIdxV167].rating : null
  const semi = row.leagueIdxV167 != null ? T.teams.find((r) => r.idx === row.leagueIdxV167) : null
  // the standings screen is the league
  window.go('stats'); window.setStatsTab && window.setStatsTab('standings'); await new Promise((r) => setTimeout(r, 250))
  const txt = (document.getElementById('screen').innerText || '').replace(/\s+/g, ' ')
  const named = others.slice(0, 4).filter((r) => txt.toUpperCase().includes(r.name.toUpperCase())).length
  // the live scorebug
  const a = p.weekResults.findIndex((w) => !w.played); p.currentWeek = a
  window.S._liveGame = window.__simGameV2(80, p.pos); window.S._oppName = p.weekResults[a].opp; window.go('live')
  for (let i = 0; i < 40 && !document.querySelector('.sb-side.them .rec'); i++) await new Promise((r) => setTimeout(r, 150))
  const rec = (document.querySelector('.sb-side.them .rec') || {}).textContent || ''
  const usRec = (document.querySelector('.sb-meta .rec') || {}).textContent || ''
  return { round: row.round, idx: row.leagueIdxV167, rating: row.opponentV11 && row.opponentV11.rating, want, tags, card, regs: reg.length, named, semi: semi && semi.w + '-' + semi.l, rec, usRec, top: others.slice(0, 4).map((r) => r.name) }
})
console.log('season C:', JSON.stringify(C))
ok(C.idx != null && C.rating >= Math.round(C.want), 'the Semifinal opponent is a league team at its league rating plus the playoff lift', { round: C.round, rating: C.rating, league: C.want })
ok(C.tags >= C.regs, 'every league row on the schedule shows the opponent\'s record and place', { tags: C.tags, regs: C.regs })
ok(C.semi && C.card.startsWith(C.semi + ' · ') && /of \d+ · \d+ OVR$/.test(C.card), 'the next-opponent card says his league record, place and the OVR he plays at', C.card)
ok(C.named >= 3, 'the standings screen lists the league\'s top teams', { named: C.named, top: C.top })
ok(C.rec === C.semi && /^\d+-\d+$/.test(C.rec), 'the scorebug shows the playoff opponent\'s league record', { scorebug: C.rec, league: C.semi })
ok(C.usRec === C.regs + '-0', 'the scorebug shows YOUR regular-season record (the playoffs are not the record)', C.usRec)
await c.close()

// ============================== D. the kill switch ==============================
{
  const k = await newCtx({ v167league: 0 }), p = await open(k, 'D')
  await seed(p, { level: 2 })
  const D = await M(p, () => { const pl = window.S.player; return { on: window.__V167.on(), lg: !!pl.leagueV167, tagged: pl.weekResults.filter((w) => w.leagueIdxV167 != null).length, weeks: pl.weekResults.length } })
  ok(!D.on && !D.lg && D.tagged === 0 && D.weeks > 0, 'TU v167league 0: no league, the old weekly draws', D)
  await k.close()
}

ok(errors.length === 0, 'no page errors', errors.slice(0, 4))
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
