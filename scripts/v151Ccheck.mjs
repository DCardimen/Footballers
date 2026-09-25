// Dev check (v151 C THE SEASON IS AN EVENT) — src/29-seasons.js (window.RIB_SEASONS: the calendar, the rollover,
// the Career Pass, the trophy case), the career boards in src/20-leaderboards.js (window.__lb.career,
// window.__lbCareerUI), the 07 hand-off (`seasonsCareerEndV151C`) and the menu's two doors.
//
//   1. the calendar: two UTC seasons a year off the epoch, named, with days left
//   2. Career Score is deterministic from a fixed career, and matches the documented formula
//   3. every board category populates from seeded careers and sorts right; "without prestige" excludes a career
//      with a node; "fastest" holds only UFF careers, ascending; the position boards hold only that position
//   4. a REAL career end (a saved game-over restored at boot, before 29 has loaded) lands on the board
//   5. pass XP from forced events and from the observer (a week played on the real save), challenges progress
//   6. tier claims grant cosmetics through the RIB_COSMETICS contract (stub) — and queue until it exists
//   7. premium: locked without the entitlement, open with RIB_MONETIZE.has("pass:<id>") or grantPremium(id)
//   8. rewards are cosmetic only (the validator, and it refuses PP / stat / gear)
//   9. the rollover with a faked clock: last season archived to the trophy case, the season board and the pass
//      reset, the careers (the save, the all-time board) untouched, the "Season N begins" card up
//  10. names are escaped (a hostile career name renders as text), the screens fit 400x860, no page errors
//
//   GAME_URL=http://localhost:5640/index.html node scripts/v151Ccheck.mjs
import fs from 'node:fs'
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = (...q) => url + (url.includes('?') ? '&' : '?') + ['stayStale', 'noFilmV114'].concat(q).join('&')
const SHOTS = process.env.SHOTS || '/tmp/claude-0/shots'
try { fs.mkdirSync(SHOTS, { recursive: true }) } catch {}
const W = 400, H = 860
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const T0 = Date.UTC(2026, 8, 24, 12)          // 24 Sep 2026: Season 1
const T1 = Date.UTC(2027, 0, 2, 12)           // 2 Jan 2027: Season 2

const ctx = await browser.newContext({ viewport: { width: W, height: H } })
await ctx.addInitScript(() => { setInterval(() => { try { document.querySelectorAll('.onboard').forEach((e) => e.remove()) } catch {} }, 60) })
await ctx.addInitScript(() => { window.RIB_SEASONS_CONFIG = { now: () => +(localStorage.getItem('v151c.now') || Date.now()) } })
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push(e.message || String(e)))
const E = (fn, arg) => page.evaluate(fn, arg)
const boot = async () => {
  await page.goto(U(), { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.RIB_SEASONS && !!(window.__lb && window.__lb.career), null, { timeout: 40000 })
  await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  await page.waitForTimeout(800)
}
const fits = () => E(() => {
  const sc = document.getElementById('screen'), dk = document.getElementById('dock'), app = document.getElementById('app')
  const r = dk && dk.getBoundingClientRect()
  return { docW: document.documentElement.scrollWidth, screenOverX: sc ? sc.scrollWidth - sc.clientWidth : 99, appScroll: app ? app.scrollHeight - app.clientHeight : 0,
    dockIn: !!(r && r.bottom <= innerHeight + 1 && r.top > innerHeight * 0.5), shell: document.documentElement.classList.contains('shell-v146') }
})
const fitOk = (f) => f.docW <= W && f.screenOverX <= 1 && f.dockIn && f.shell

await page.goto(U(), { waitUntil: 'domcontentloaded' })
await E((t) => { localStorage.clear(); localStorage.setItem('v151c.now', String(t)) }, T0)
await boot()

// ============================== 1. the calendar ==============================
{
  const c = await E(() => {
    const S = RIB_SEASONS, at = (y, m, d) => S.seasonAt(Date.UTC(y, m, d, 12))
    return { cur: S.current(), a: at(2026, 6, 1), b: at(2026, 11, 31), c: at(2027, 0, 1), d: at(2027, 6, 1), pre: at(2026, 0, 15) }
  })
  ok(c.cur.id === 's1' && c.cur.name === 'Season 1 · Kickoff', 'the faked clock (24 Sep 2026) is in Season 1 · Kickoff', c.cur.name)
  ok(c.a.id === 's1' && c.a.start === Date.UTC(2026, 6, 1) && c.a.end === Date.UTC(2027, 0, 1), 'Season 1 runs UTC Jul 1 2026 → Jan 1 2027')
  ok(c.b.id === 's1' && c.c.id === 's2' && c.c.name === 'Season 2 · Two-Minute Drill' && c.d.id === 's3', 'Dec 31 is still S1; Jan 1 opens S2 (Two-Minute Drill); Jul 1 2027 opens S3', [c.b.id, c.c.name, c.d.id])
  ok(c.cur.daysLeft === Math.ceil((Date.UTC(2027, 0, 1) - T0) / 864e5), 'days left counts to the season end', c.cur.daysLeft)
  ok(c.pre.id === 'pre1', 'before the epoch it is the preseason', c.pre.id)
}

// ============================== 2. Career Score is deterministic ==============================
const FIX = {
  hof: { name: 'Fixture Man', pos: 'RB', peak: 88, titles: 2, rings: 1, reached: 7, seasons: 12, won: true, gen: 3,
    box: { totals: { wins: 70, games: 110, playoffWins: 9, awards: 5 }, awards: [{ n: 'All-State', c: 2 }, { n: 'League MVP', c: 1 }],
      log: [{ n: 1, level: 3, age: 17, avg: 55, awards: [] }, { n: 2, level: 5, age: 19, avg: 71, awards: ['🏆 League MVP'] }, { n: 3, level: 7, age: 21, avg: 80, awards: ['⭐ All-Pro', '🏆 League MVP'] }] } },
  level: 7, traits: 2, age: 33, nodes: 4, surname: 'Man', careerNo: 1, at: T0, team: { school: 'Riverton', name: 'Rams', colors: ['#aa2233', '#ffffff', 'javascript:alert(1)'], logo: 3 }
}
{
  const r = await E((F) => { const C = __lb.career, a = C.build(F), b = C.build(F); return { a, b, levelPts: C.levelPts } }, FIX)
  const x = r.a
  // the documented formula, computed here independently
  const want = r.levelPts[7] + 4 * 88 + 60 * 2 + 150 * 1 + 8 * 9 + 2 * 70 + 15 * 5 + 40 * 2 + 5 * 12 + 200
  ok(x.score === want, 'Career Score = level pts + 4·peak + 60·titles + 150·rings + 8·playoff W + 2·W + 15·awards + 40·MVP + 5·seasons + 200 UFF', { got: x.score, want })
  ok(JSON.stringify(r.a) === JSON.stringify(r.b), 'the same career builds the same entry twice (score, chaos, id)')
  const crazy = 12 * 7 + 15 * 2 + 20 * 2 + 8 * 2 + (80 - 55) / 2 + 0 + 0 + 40 + 0
  ok(x.crazy === Math.round(crazy), 'Craziest Career follows its formula (level, traits, generation, award kinds, swing, UFF by 21)', { got: x.crazy, want: Math.round(crazy) })
  ok(x.toUff === 2 && x.mvps === 2 && x.seasonId === 's1', 'fastest-to-league = seasons before the first UFF season; MVPs counted off the log; stamped Season 1', { toUff: x.toUff, mvps: x.mvps })
  ok(JSON.stringify(x.team.colors) === JSON.stringify(['#aa2233', '#ffffff']) && x.team.logo === 3, 'team colours keep colour strings only; the logo is an index', x.team)
}

// ============================== 3. every board populates and sorts right ==============================
const SEED = [
  { name: 'Ace QB', pos: 'QB', level: 7, won: true, seasons: 10, peak: 90, titles: 3, rings: 1, nodes: 0, pre: 6 },
  { name: 'Bolt RB', pos: 'RB', level: 6, won: false, seasons: 9, peak: 80, titles: 1, rings: 0, nodes: 2, pre: 9 },
  { name: 'Cash WR', pos: 'WR', level: 7, won: true, seasons: 7, peak: 84, titles: 0, rings: 0, nodes: 5, pre: 4 },
  { name: 'Dunk TE', pos: 'TE', level: 4, won: false, seasons: 6, peak: 70, titles: 2, rings: 0, nodes: 0, pre: 6 },
  { name: 'Edge DL', pos: 'DL', level: 8, won: true, seasons: 14, peak: 95, titles: 4, rings: 2, nodes: 9, pre: 8 },
  { name: 'Fort OL', pos: 'OL', level: 5, won: false, seasons: 8, peak: 75, titles: 0, rings: 0, nodes: 0, pre: 8 },
  { name: 'Gap LB', pos: 'LB', level: 7, won: true, seasons: 11, peak: 86, titles: 1, rings: 0, nodes: 1, pre: 5 },
  { name: 'Hawk CB', pos: 'CB', level: 3, won: false, seasons: 4, peak: 66, titles: 0, rings: 0, nodes: 0, pre: 4, old: true }
]
{
  const r = await E(({ SEED, T0 }) => {
    const q = window.__seasonsQV151C || (window.__seasonsQV151C = [])
    SEED.forEach((s, i) => {
      const log = []
      for (let n = 1; n <= s.seasons; n++) log.push({ n, level: n <= s.pre ? Math.min(6, 1 + (n >> 1)) : 7, age: 12 + n, avg: 50 + n, awards: n % 4 === 0 ? ['🏅 All-Conference'] : [] })
      q.push({ hof: { name: s.name, pos: s.pos, peak: s.peak, titles: s.titles, rings: s.rings, reached: s.level, seasons: s.seasons, won: s.won, gen: 1 + (i % 3),
        box: { totals: { wins: s.seasons * 6, games: s.seasons * 10, playoffWins: s.titles * 2, awards: Math.floor(s.seasons / 4) }, awards: [], log } },
        level: s.level, traits: i % 3, age: 12 + s.seasons, nodes: s.nodes, surname: 'Seed', careerNo: 10 + i, at: s.old ? T0 - 30 * 864e5 : T0 - i * 1000, team: { name: 'Seeds', colors: ['#224488'] } })
    })
    RIB_SEASONS.flush()
    const C = __lb.career, o = { seasonId: 's1', week: C.isoWeek(T0) }, out = {}
    C.categories().forEach((c) => { out[c.id] = C.rows(c.id, o).map((e) => ({ name: e.name, pos: e.pos, score: e.score, v: c.id === 'titles' ? e.titles + e.rings : c.id === 'crazy' ? e.crazy : c.id === 'fastest' ? e.toUff : e.score, nodes: e.nodes, level: e.level, week: e.week })) })
    return { out, cats: C.categories().map((c) => c.id), week: o.week }
  }, { SEED, T0 })
  const { out } = r
  const sorted = (a, asc) => a.every((e, i) => i === 0 || (asc ? a[i - 1].v <= e.v : a[i - 1].v >= e.v))
  ok(r.cats.join() === 'alltime,season,weekly,qb,rb,wr,te,ol,def,titles,crazy,fastest,noprestige', 'thirteen categories', r.cats)
  for (const id of r.cats) ok(out[id].length > 0 && sorted(out[id], id === 'fastest'), `board "${id}" populates and sorts ${id === 'fastest' ? 'ascending' : 'descending'}`, out[id].map((e) => e.name + ':' + e.v).slice(0, 4))
  ok(out.alltime.length === SEED.length, 'all-time holds every career', out.alltime.length)
  ok(out.noprestige.every((e) => e.nodes === 0) && !out.noprestige.some((e) => e.name === 'Bolt RB'), '"without prestige" excludes a career with a node', out.noprestige.map((e) => e.name))
  ok(out.fastest.every((e) => e.level >= 7) && out.fastest[0].name === 'Cash WR', '"fastest" holds only UFF careers, fewest seasons first', out.fastest.map((e) => e.name + ':' + e.v))
  ok(out.qb.every((e) => e.pos === 'QB') && out.def.every((e) => ['DL', 'LB', 'CB', 'S'].includes(e.pos)) && out.ol.every((e) => e.pos === 'OL'), 'position boards hold only their positions (DEF = DL/LB/CB/S)')
  ok(out.titles[0].name === 'Edge DL', 'most championships: titles + UFF rings', out.titles.slice(0, 3))
  ok(!out.weekly.some((e) => e.name === 'Hawk CB') && out.weekly.length === SEED.length - 1, 'the weekly board holds only this week\'s careers', out.weekly.length)
}

// ============================== 4. a real career end, restored at boot ==============================
{
  const before = await E(() => __lb.career.all().length)
  await E(() => { const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); A.setState(S); S.tutorialSeen = true
    S.player = A.newPlayer(); S.player.name = 'Real Ender'; S.player.pos = 'WR'; S.player.level = 5; S.player.totalSeasons = 6; S.player.titles = 1; S.player.traits = []; S.player.tiers = {}
    S.player.career = [{ level: 'College', ovr: 60, age: 21 }]; S.view = 'gameover'; window.GridironStorage.save(S) })
  await boot()   // the boot restores the game-over screen from the top level of 07, before 29 exists: the hand-off is queued
  const r = await E(() => ({ all: __lb.career.all(), view: __GRIDIRON_AUDIT__.getState().view, settled: !!__GRIDIRON_AUDIT__.getState().player._settled, q: (window.__seasonsQV151C || []).length }))
  const mine = r.all.filter((e) => e.name === 'Real Ender')
  ok(r.view === 'gameover' && r.settled, 'the saved game-over restored and settled', r.view)
  ok(mine.length === 1 && r.all.length === before + 1 && r.q === 0, 'the real career end is on the board exactly once (queued before 29 loaded, flushed at its boot)', { n: mine.length, before, after: r.all.length })
  ok(mine[0] && mine[0].pos === 'WR' && mine[0].level === 5 && mine[0].titles === 1 && mine[0].score > 0, 'its entry carries the career (pos, level, titles, score)', mine[0] && { score: mine[0].score, lvl: mine[0].levelName })
  const tro = await E(() => RIB_SEASONS.trophies().map((t) => t.kind + ':' + t.label))
  ok(tro.some((t) => /^title:1× Champion — Real Ender/.test(t)), 'its championship is in the trophy case', tro.filter((t) => /Real Ender/.test(t)))
}

// ============================== 5. pass XP: forced events and the observer ==============================
{
  const r = await E(() => {
    const S = RIB_SEASONS, x0 = S.pass().xp
    S.event('game', { live: true, won: true, stat: { rushYds: 120, rushTD: 2 }, pos: 'RB' })
    const x1 = S.pass().xp
    S.event('daily'); S.event('scoreAttack'); S.event('season', { champion: true, awards: 2, mvps: 1 })
    const x2 = S.pass().xp, m = S.metrics(), T = S.xpTable
    return { x0, x1, x2, m, T, bogus: S.event('nonsense'), ch: S.challenges().length, wk: S.weekly().length, chTitles: S.challenges().filter((c) => c.k === 'titles').map((c) => c.have) }
  })
  ok(r.x1 - r.x0 === r.T.game + r.T.live + r.T.win, 'a live win = game + live + win XP', r.x1 - r.x0)
  const want = r.T.daily + r.T.scoreAttack + r.T.season + r.T.title + 2 * r.T.award + r.T.mvp
  ok(r.x2 - r.x1 >= want, 'daily, score attack and a title season with 2 awards and an MVP add their XP (plus any challenge they complete)', { got: r.x2 - r.x1, base: want })
  ok(r.m.yards === 120 && r.m.tds === 2 && r.m.daily === 1 && r.m.titles === 1, 'the metrics count the stat line and the events', r.m)
  ok(r.bogus === false && r.ch === 20 && r.wk === 3, 'an unknown event is refused; 20 season challenges, 3 weekly', { ch: r.ch, wk: r.wk })
  const same = await E(() => { const a = RIB_SEASONS.challenges().map((c) => c.id + c.t).join(), b = RIB_SEASONS.challenges().map((c) => c.id + c.t).join(); return a === b })
  ok(same, 'the season\'s challenges are the same list every time (rotated by season id, no Math.random)')
  // the observer: a week played on the real save earns XP once, and moves nothing in the save
  const o = await E(async () => {
    const A = __GRIDIRON_AUDIT__, S = A.freshState(); A.setState(S); S.tutorialSeen = true; S.careers = 3
    S.player = A.newPlayer(); S.player.name = 'Obs Erver'; S.player.pos = 'QB'; S.player.level = 2
    S.player.weekResults = [{ opp: 'Alpha', played: false, won: false }, { opp: 'Beta', played: false }]
    RIB_SEASONS.observe()
    const x0 = RIB_SEASONS.pass().xp
    const w = S.player.weekResults[0]; w.played = true; w.won = true; w.liveBookedV85 = true; w.statLine = { passYds: 250, passTD: 3 }
    const snap = JSON.stringify(S.player)
    RIB_SEASONS.observe(); const x1 = RIB_SEASONS.pass().xp
    RIB_SEASONS.observe(); const x2 = RIB_SEASONS.pass().xp
    S.player.level = 3; RIB_SEASONS.observe(); const x3 = RIB_SEASONS.pass().xp
    return { d1: x1 - x0, d2: x2 - x1, d3: x3 - x2, untouched: JSON.stringify(Object.assign({}, S.player, { level: 2 })) === snap, T: RIB_SEASONS.xpTable }
  })
  ok(o.d1 >= o.T.game + o.T.live + o.T.win && o.d2 === 0, 'the observer books a played week once (a live win), and never twice', o)
  ok(o.d3 >= o.T.promo, 'a promotion is booked', o.d3)
  ok(o.untouched, 'observing wrote nothing into the player')
}

// ============================== 6–8. claims, the cosmetics contract, premium, the validator ==============================
{
  const r = await E(() => {
    const S = RIB_SEASONS, out = {}
    delete window.RIB_COSMETICS
    S.dev.addXp(5000 - (S.pass().xp % 1000))
    out.tier = S.pass().tier
    out.queued = S.claim('free', 1)                       // no cosmetics module yet: queued
    out.pendingN = S.pending().length
    const granted = []
    window.RIB_COSMETICS = { grant: (id, src) => { granted.push([id, src]); return true }, owned: () => false, catalog: () => [], profile: () => ({ name: 'Stub' }), renderCard: () => '' }
    S.flush()
    out.flushed = granted.slice(); out.pendingAfter = S.pending().length
    out.free2 = S.claim('free', 2); out.again = S.claim('free', 2); out.locked = S.claim('free', 30)
    out.prem = S.claim('premium', 1)
    const M = window.RIB_MONETIZE, has0 = M && M.has
    if (M) M.has = (k) => k === 'pass:' + S.current().id
    out.ownedByEnt = S.premiumOwned()
    if (M) M.has = has0
    out.ownedAfterRestore = S.premiumOwned()
    out.grant = S.grantPremium(S.current().id)
    out.prem2 = S.claim('premium', 1)
    out.all = S.claimAll().length
    out.granted = granted.slice()
    const rw = [], bad = []
    ;['s1', 's2', 's3', 's4', 'pre1'].forEach((sid) => { const R = S.rewards(sid); R.free.concat(R.premium).forEach((x) => { rw.push(x); if (!S.validateReward(x).ok) bad.push(x.id) }) })
    out.rewardN = rw.length; out.bad = bad
    out.kinds = [...new Set(rw.map((x) => x.kind))].sort()
    out.refusePP = S.validateReward({ id: 'pass.s1.free.1', kind: 'pp' }).ok
    out.refuseField = S.validateReward({ id: 'pass.s1.free.1', kind: 'banner', stat: 5 }).ok
    out.refuseGear = S.validateReward({ id: 'pass.s1.free.1', kind: 'gear' }).ok
    out.freeN = S.rewards('s1').free.length; out.premN = S.rewards('s1').premium.length
    return out
  })
  ok(r.tier >= 5, 'forced XP reaches tier 5', r.tier)
  ok(r.queued.ok && r.queued.granted === 'queued' && r.pendingN === 1, 'with no RIB_COSMETICS a claim is kept and queued', r.queued)
  ok(r.flushed.length === 1 && r.flushed[0][0] === 'pass.s1.free.1' && r.flushed[0][1] === 'pass' && r.pendingAfter === 0, 'the queue flushes through RIB_COSMETICS.grant(id, "pass") when it appears', r.flushed)
  ok(r.free2.ok && r.free2.granted === 'granted' && !r.again.ok && !r.locked.ok && r.locked.reason === 'tier locked', 'a reached tier claims once; a second claim and a locked tier are refused', { again: r.again.reason, locked: r.locked.reason })
  ok(!r.prem.ok && r.prem.reason === 'premium not owned', 'premium is locked without the entitlement', r.prem.reason)
  ok(r.ownedByEnt && !r.ownedAfterRestore, 'RIB_MONETIZE.has("pass:<season>") opens the premium track')
  ok(r.grant && r.prem2.ok && r.all > 0, 'grantPremium(season) opens it; claim all collects the rest', { claimedAll: r.all })
  ok(r.granted.every((g) => /^pass\.s1\.(free|premium)\.\d+$/.test(g[0]) && g[1] === 'pass'), 'every grant is a pass cosmetic id, source "pass"', r.granted.length)
  ok(r.bad.length === 0 && r.rewardN === 5 * (r.freeN + r.premN) && r.freeN === 37 && r.premN === 50, 'every reward of five seasons validates as cosmetic (37 free + 50 premium a season — v153 G)', { n: r.rewardN, bad: r.bad })
  ok(r.kinds.every((k) => ['badge', 'banner', 'celebration', 'frame', 'icon', 'kit', 'nameplate', 'title', 'jersey', 'helmet', 'trail', 'wings', 'crown', 'aura', 'numfont'].includes(k)), 'reward kinds are cosmetic kinds only', r.kinds)
  ok(!r.refusePP && !r.refuseField && !r.refuseGear, 'the validator refuses PP, a stat field and gear')
}

// ============================== 10a. screens fit, the menu doors, XSS ==============================
{
  await E(() => { window.__seasonsQV151C.push({ hof: { name: '<img src=x onerror="window.__xss151=1">Evil', pos: 'S', peak: 99, titles: 9, rings: 3, reached: 8, seasons: 20, won: true, gen: 2, box: { totals: {}, log: [] } }, level: 8, nodes: 0, careerNo: 99, at: Date.now() }); RIB_SEASONS.flush() })
  await E(() => { const A = __GRIDIRON_AUDIT__; A.getState().player = null; window.go('menu') }); await page.waitForTimeout(900)
  const tiles = await E(() => [...document.querySelectorAll('#rib-main-menu-v2 .rib9-tile')].map((t) => t.dataset.ribAction + '|' + (t.querySelector('small') || {}).textContent))
  ok(tiles.some((t) => /^seasons\|S1 · \d+ DAYS LEFT · TIER \d+/.test(t)) && tiles.some((t) => /^boards\|/.test(t)), 'the main menu has the SEASON PASS tile (with the countdown) and the LEADERBOARDS tile', tiles.filter((t) => /seasons|boards/.test(t)))
  await page.click('#rib-main-menu-v2 .rib9-tile[data-rib-action="boards"]'); await page.waitForTimeout(900)
  const lb = await E(() => ({ view: __GRIDIRON_AUDIT__.getState().view, mode: __lbUI.getMode(), local: !!document.querySelector('#screen .lb151-local'), cats: document.querySelectorAll('#screen .lb151-cat').length, rows: document.querySelectorAll('#screen .lb151-row').length, xss: window.__xss151 || 0, img: document.querySelectorAll('#screen img[src="x"]').length, evilText: /onerror/.test(document.getElementById('screen').textContent) }))
  ok(lb.view === 'leaderboard' && lb.mode === 'career' && lb.local && lb.cats === 13 && lb.rows > 0, 'the LEADERBOARDS tile opens the career boards: 13 category tabs, rows, labelled LOCAL', lb)
  ok(lb.xss === 0 && lb.img === 0 && lb.evilText, 'a hostile career name renders as text, never markup', lb)
  let f = await fits(); ok(fitOk(f), 'the career boards fit 400x860 in the shell (no sideways scroll, dock in view)', f)
  await page.screenshot({ path: SHOTS + '/v151c-leaderboards.png' })
  await E(() => __lbCareerUI.cat('fastest')); await page.waitForTimeout(200)
  const fr = await E(() => [...document.querySelectorAll('#screen .lb151-row .lb151-who b')].map((b) => b.textContent))
  ok(fr[0] === 'Cash WR', 'the "fastest" tab draws its own ranking', fr.slice(0, 3))
  await E(() => __lbCareerUI.cat('alltime')); await page.waitForTimeout(150)
  await page.click('#screen .lb151-row'); await page.waitForTimeout(300)
  const sh = await E(() => { const s = document.getElementById('lb151Sheet'); return s ? { parts: s.querySelectorAll('.lb151-parts tr').length, score: s.querySelector('.lb151-sheet-score b').textContent, xss: window.__xss151 || 0 } : null })
  ok(sh && sh.parts >= 3 && sh.xss === 0, 'tapping a row opens the career\'s profile sheet with its score broken down', sh)
  await page.screenshot({ path: SHOTS + '/v151c-profile-sheet.png' })
  await E(() => __lbCareerUI.close())
  // Pro gating of the advanced filters (only when the store is on)
  const g = await E(() => { const M0 = window.RIB_MONETIZE; const off = __lb.career.advancedUnlocked()
    window.RIB_MONETIZE = { enabled: true, has: () => false }; __lbCareerUI.redraw(); const locked = !__lb.career.advancedUnlocked() && document.querySelectorAll('#screen .lb151-adv select[disabled]').length > 0 && document.querySelectorAll('#screen .lb151-cat').length === 13
    window.RIB_MONETIZE = { enabled: true, has: (k) => k === 'pro' }; const pro = __lb.career.advancedUnlocked(); window.RIB_MONETIZE = M0; __lbCareerUI.redraw(); return { off, locked, pro } })
  ok(g && g.off && g.locked && g.pro, 'advanced filters: free while the store is off; Pro-gated when it is on (the categories stay free)', g)
  // the Score Attack mode still works in the same view
  await E(() => __lbUI.mode('score')); await page.waitForTimeout(400)
  ok(await E(() => /lb-tab/.test(document.getElementById('screen').innerHTML) && !!document.querySelector('.lb151-mode')), 'the Score Attack boards are one tap away in the same view')
  // the season screen, each tab
  for (const t of ['season', 'pass', 'trophies']) {
    await E((t) => seasonsOpenV151C(t), t); await page.waitForTimeout(500)
    f = await fits()
    const has = await E(() => ({ view: __GRIDIRON_AUDIT__.getState().view, tab: document.querySelector('.ss151-tabs button.on') && document.querySelector('.ss151-tabs button.on').dataset.tab }))
    ok(has.view === 'seasons' && has.tab === t && fitOk(f), `the ${t.toUpperCase()} tab draws and fits 400x860`, Object.assign(has, f))
    await page.screenshot({ path: SHOTS + `/v151c-${t}.png` })
  }
  await E(() => seasonsOpenV151C('pass')); await page.waitForTimeout(300)
  const passUi2 = await E(() => ({ rows: document.querySelectorAll('.ss151-track .ss151-row').length, head: document.querySelector('.ss151-passhead').textContent }))
  ok(passUi2.rows === 50 && /PREMIUM/.test(passUi2.head), 'the pass screen lists 50 tiers, free and premium side by side (v153 G)', passUi2.rows)
  await E(() => __seasonsUI.subtab('challenges')); await page.waitForTimeout(200)
  ok(await E(() => document.querySelectorAll('.ss151-chs .ss151-ch').length === 20), 'the challenges list shows the season\'s 20 with progress')
  await page.screenshot({ path: SHOTS + '/v151c-pass-challenges.png' })
  await E(() => __seasonsUI.subtab('tiers'))
}

// ============================== 9. the rollover ==============================
{
  const pre = await E(() => { const S = __GRIDIRON_AUDIT__.getState()
    S.player = __GRIDIRON_AUDIT__.newPlayer(); S.player.name = 'Keeps Playing'; S.careers = 7; S.view = 'menu'; window.GridironStorage.save(S)
    return { careers: S.careers, name: S.player.name, all: __lb.career.all().length, s1board: __lb.career.rows('season', { seasonId: 's1' }).length, xp: RIB_SEASONS.pass().xp, tro: RIB_SEASONS.trophies().length } })
  await E((t) => localStorage.setItem('v151c.now', String(t)), T1)
  await boot()
  await page.waitForTimeout(1800)
  const r = await E(() => { const S = __GRIDIRON_AUDIT__.getState(), R = RIB_SEASONS, h = R.history()[0]
    return { cur: R.current().id, h: h && { id: h.id, careers: h.careers, best: h.best && h.best.name, tier: h.tier, medal: h.medal && h.medal.name }, xp: R.pass().xp, tier: R.pass().tier,
      s2board: __lb.career.rows('season', { seasonId: 'sR'.replace('R', '2') }).length, s1board: __lb.career.rows('season', { seasonId: 's1' }).length, all: __lb.career.all().length,
      careers: S.careers, name: S.player && S.player.name, tro: R.trophies().map((t) => t.kind), card: !!document.getElementById('ss151Event'), cardText: (document.getElementById('ss151Event') || {}).textContent || '' } })
  ok(r.cur === 's2', 'the first boot after Jan 1 is Season 2', r.cur)
  ok(r.h && r.h.id === 's1' && r.h.careers === pre.s1board && r.h.best && r.h.tier >= 5, 'Season 1 is archived: its board, the best career, the pass tier', r.h)
  ok(r.tro.includes('season') && r.tro.includes('pass') && r.tro.includes('badge') && r.tro.length > pre.tro, 'the finish, the pass tier and the season badge went into the trophy case', r.tro.filter((k) => /season|pass|badge/.test(k)))
  ok(r.xp === 0 && r.tier === 0 && r.s2board === 0, 'the pass and the season board reset', { xp: r.xp, s2: r.s2board })
  ok(r.all === pre.all && r.s1board === pre.s1board && r.careers === pre.careers && r.name === pre.name, 'the careers are untouched: the save, the all-time board, last season\'s entries', { all: r.all, careers: r.careers, name: r.name })
  ok(r.card && /Season 2/.test(r.cardText) && /Season 1/.test(r.cardText) && /RECAP/i.test(r.cardText), 'the "Season 2 begins" card is up with last season\'s recap', r.cardText.slice(0, 120))
  await page.screenshot({ path: SHOTS + '/v151c-season-event-card.png' })
  await E(() => RIB_SEASONS.dismissEvent()); await page.waitForTimeout(200)
  ok(await E(() => !document.getElementById('ss151Event') && !RIB_SEASONS.pendingEvent()), 'dismissing the card keeps it dismissed')
  await boot()
  ok(await E(() => !document.getElementById('ss151Event') && RIB_SEASONS.current().id === 's2' && RIB_SEASONS.history().length === 1), 'a second boot in the same season changes nothing')
  await E(() => seasonsOpenV151C('trophies')); await page.waitForTimeout(500)
  await page.screenshot({ path: SHOTS + '/v151c-trophy-case.png' })
  const store = await E(() => ({ save: !!localStorage.getItem('gridiron_save_v1') && !/rib\.seasons|pass\.s1/.test(localStorage.getItem('gridiron_save_v1')), keys: Object.keys(localStorage).filter((k) => /season|careers\.v1/.test(k)) }))
  ok(store.save && store.keys.includes('rib.seasons.v1') && store.keys.includes('rib.lb.careers.v1'), 'season, pass and trophy data live outside the career save', store.keys)
}

// ============================== the hub chip ==============================
{
  const hub = await E(async () => { const A = __GRIDIRON_AUDIT__, S = A.getState(); S.player = A.newPlayer(); S.player.name = 'Hub Guy'; S.player.pos = 'RB'; window.go('hub'); await new Promise((r) => setTimeout(r, 1800)); const c = document.querySelector('.season-chip-v151c'); return c ? c.textContent : null })
  ok(hub && /S2 · \d+D · T\d+/.test(hub), 'the career hub carries the season countdown chip', hub)
}

console.log('page errors:', errors.length ? errors : 'none')
ok(errors.length === 0, 'no page errors', errors.slice(0, 3))
console.log(JSON.stringify({ pass, fail }))
await browser.close()
process.exit(fail ? 1 : 0)
