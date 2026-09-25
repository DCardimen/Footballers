// Dev check (v152 A THE LEGACY RANK) — the ledger in src/07-career-app.js (`legacy*V152`, window.__V152A) and the
// medals / pour / milestones / trophy case / collection book in src/31-legacy.js (window.RIB_LEGACY).
//
//   1. the art: 500 medals, every drawn medal exactly once, the drawn 500 is Rank 500, the five atlases + the mini load
//   2. the curve: ranks 1-20 fly by, every step costs more, Rank 500 is a few million XP, the level runs on past it
//   3. a REAL career end (a saved game-over restored at boot) pays Legacy XP once, prints the card, and the pour plays
//      to the right rank (the medal swapped on the way), then is marked seen and never replays on a reload
//   4. a season: the formula (grade, title, awards, the ring) and the real hook in finishSeasonGames' chain
//   5. a milestone pays its PP bounty once and shows its card on the hub; a big one (x00) says the new tier
//   6. Rank 500: the blackout sequence, the Ultimate Legacy medal, the Legacy Level beyond it
//   7. the profile: the trophy case (current medal, plaque, bar), the collection book (10 tiers, 50 per page, earned
//      vs locked, a page turn, a medal's detail), the chip on the card — all inside 400x860
//   8. the identity: the rank chip on the career top bar and on the main menu, the career setup line, a board row's medal
//   9. an old save's Hall of Fame is credited once at boot (not Rank 1); the kill switch pays nothing
//  10. nothing here spends Math.random(); no page errors
//
//   GAME_URL=http://localhost:5173/index.html node scripts/v152Acheck.mjs
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
const ctx = await browser.newContext({ viewport: { width: W, height: H }, reducedMotion: 'no-preference' })
await ctx.addInitScript(() => { setInterval(() => { try { document.querySelectorAll('.onboard').forEach((e) => e.remove()) } catch {} }, 60) })
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push(e.message || String(e)))
const E = (fn, arg) => page.evaluate(fn, arg)
const tap = (sel) => E((sel) => { const el = document.querySelector(sel); if (el) el.click(); return !!el }, sel)   // the splash can sit over the page; tap in-page
const shot = async (n) => { await E(() => { const sp = document.getElementById('splash'); if (sp) sp.remove() }); return page.screenshot({ path: SHOTS + '/v152A_' + n + '.png' }).catch(() => null) }
const boot = async () => {
  await page.goto(U(), { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.RIB_LEGACY && !!window.__V152A, null, { timeout: 40000 })
  await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  await page.waitForTimeout(700)
}
const fits = () => E(() => {
  const sc = document.getElementById('screen')
  return { docW: document.documentElement.scrollWidth, overX: sc ? sc.scrollWidth - sc.clientWidth : 99 }
})
// a fresh account with a player on the menu; `xp` preloads the ledger
const fresh = (o) => E((o) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); A.setState(S); S.tutorialSeen = true
  S.player = A.newPlayer(); S.player.name = o.name || 'Legacy Tester'; S.player.pos = 'QB'; S.player.traits = []; S.player.tiers = {}
  if (o.xp != null) S.legacyV152 = { v: 1, xp: o.xp, boot: 1, got: {}, log: [], ms: o.ms || 0 }
  S.view = o.view || 'hub'; window.GridironStorage.save(S)
}, o || {})

await page.goto(U(), { waitUntil: 'domcontentloaded' })
await E(() => localStorage.clear())
await boot()

// ============================== 1. the art ==============================
{
  const m = await E(() => { const M = RIB_LEGACY.medals; return { n: M.drawn.length, uniq: new Set(M.drawn).size, last: M.drawn[499], fams: M.motifs.length, tiers: M.tiers.map((t) => t.name + ':' + t.from + '-' + t.to), sheets: M.sheets, mini: M.miniSheet, glow: M.glow.length } })
  ok(m.n === 500 && m.uniq === 500 && m.last === 500 && m.fams === 50 && m.glow === 500, 'every drawn medal once, the drawn 500 is Rank 500, 50 motifs', m)
  ok(m.tiers.length === 10 && m.tiers[0] === 'ROOKIE:1-50' && m.tiers[9] === 'MYTHIC:451-500', 'ten tiers of fifty', m.tiers)
  const metals = await E(() => { const n = RIB_LEGACY.medals.names; return { low: n.slice(0, 100).filter((x) => / · (Bronze|Silver)$/.test(x)).length, high: n.slice(200).filter((x) => / · (Bronze|Silver)$/.test(x)) } })
  ok(metals.low >= 80 && metals.high.length === 0, 'ranks 1-100 are mostly bronze and silver; no bronze or silver medal above Rank 200', metals)
  const img = await E(async (list) => Promise.all(list.map((p) => new Promise((res) => { const i = new Image(); i.onload = () => res(i.naturalWidth + 'x' + i.naturalHeight); i.onerror = () => res('ERR'); i.src = window.__RIB_ASSET(p) }))), m.sheets.concat([m.mini]))
  ok(img.slice(0, 5).every((s) => s === '1520x1520') && img[5] === '1200x960', 'the five atlases and the mini atlas load', img)
  const names = await E(() => [1, 10, 100, 200, 201, 361, 499, 500].map((r) => r + ' ' + RIB_LEGACY.name(r) + ' / ' + RIB_LEGACY.tierName(r)))
  ok(names[0].startsWith('1 Recruit Star · Bronze') && names.slice(0, 7).every((n) => / · /.test(n)) && names[7].includes('Ultimate Legacy'), 'medals are named by motif and metal', names)
}

// ============================== 2. the curve ==============================
{
  const c = await E(() => { const A = window.__V152A; const req = []; for (let r = 1; r <= 520; r++) req.push(A.req(r)); return { req1: req[0], mono: req.every((v, i) => !i || v >= req[i - 1]), x20: A.xpAt(20), x100: A.xpAt(100), x500: A.xpAt(500), r0: A.rank(0).rank, r501: A.rank(A.xpAt(501) + 1), past: A.rank(A.xpAt(640)).rank } })
  ok(c.r0 === 1 && c.req1 <= 80 && c.mono, 'Rank 1 at 0 XP, the first step is small, every step costs at least the last', c.req1)
  ok(c.x20 < 5000 && c.x100 > 60000 && c.x100 < 300000 && c.x500 > 2e6 && c.x500 < 1e7, 'ranks 1-20 fly by, 100 is a real climb, 500 is millions', { x20: c.x20, x100: c.x100, x500: c.x500 })
  ok(c.r501.rank === 501 && c.r501.medal === 500 && c.past === 640, 'past 500 the Legacy Level runs on on the one medal', c.r501)
}

// ============================== 3. a real career end, restored at boot ==============================
{
  await E(() => { const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); A.setState(S); S.tutorialSeen = true
    S.player = A.newPlayer(); S.player.name = 'Real Ender'; S.player.pos = 'WR'; S.player.level = 5; S.player.totalSeasons = 12; S.player.titles = 1; S.player.peakOvr = 71; S.player.traits = []; S.player.tiers = {}
    S.player.career = [{ level: 'College', ovr: 60, age: 21 }]; S.view = 'gameover'; window.GridironStorage.save(S) })
  await E(() => localStorage.removeItem('rib.legacy.v152'))
  await boot()
  const r = await E(() => { const L = __GRIDIRON_AUDIT__.getState().legacyV152 || {}; const c = document.querySelector('.legacy-card-v152'); return { xp: L.xp, last: L.last && { why: L.last.why, gain: L.last.gain, from: L.last.from, to: L.last.to }, card: !!c, award: c && c.dataset.award, pending: !!(c && c.dataset.pending), hof: (__GRIDIRON_AUDIT__.getState().hof || [])[0] } })
  ok(r.xp > 0 && r.last && r.last.why === 'career' && r.last.gain === r.xp, 'the settle paid the career\'s Legacy XP', r.last)
  ok(r.card && r.award && r.hof && r.hof.legacyRank === r.last.to, 'the career-end card is printed and the Hall row carries the rank', { card: r.card, lr: r.hof && r.hof.legacyRank })
  await page.waitForTimeout(900); await shot('3_pour_mid')
  await page.waitForFunction(() => { const c = document.querySelector('.legacy-card-v152'); return c && !c.dataset.pending }, null, { timeout: 15000 }).catch(() => null)
  await page.waitForTimeout(900)
  const d = await E(() => { const c = document.querySelector('.legacy-card-v152'); return { num: +c.querySelector('.lgc-num').textContent, medal: +c.querySelector('.lgc-slot .lg-medal-v152:not(.lg-shard-v152)').dataset.rank, n: c.querySelectorAll('.lgc-slot .lg-medal-v152').length, swaps: window.__V152A_UI.swaps, pours: window.__V152A_UI.pours.length, seen: JSON.parse(localStorage.getItem('rib.legacy.v152') || '{}') } })
  ok(d.num === r.last.to && d.medal === Math.min(500, r.last.to) && d.n === 1 && d.pours === 1 && d.swaps >= 1 && d.seen.award === +r.award, 'the pour ran to the new rank, swapping the medal on the way, and was marked seen', d)
  await shot('3_pour_end')
  await boot()
  const again = await E(() => { const L = __GRIDIRON_AUDIT__.getState().legacyV152; const c = document.querySelector('.legacy-card-v152'); return { xp: L.xp, pending: !!(c && c.dataset.pending), pours: window.__V152A_UI.pours.length } })
  ok(again.xp === r.xp && !again.pending && again.pours === 0, 'a reload neither pays again nor replays the pour', again)
}

// ============================== 4. a season ==============================
{
  const s = await E(() => { const A = window.__V152A, e = { level: 7 }
    const plain = A.seasonXp(e, { grade: 'C' }), ace = A.seasonXp(e, { grade: 'A+' }), ring = A.seasonXp(e, { grade: 'B', playoffs: { champion: true, roundsWon: 3 }, awards: [{}, {}] }), pee = A.seasonXp({ level: 0 }, { grade: 'C' })
    return { plain: plain.gain, ace: ace.gain, ring: ring.gain, parts: ring.parts.map((p) => p[0]), pee: pee.gain } })
  ok(s.pee < s.plain && s.plain < s.ace && s.ring > s.ace + 2500, 'a season pays by level and grade; a ring, playoff wins and awards pay on top', s)
  const hook = await E(() => { const src = [...document.scripts].map((x) => x.src).find((x) => /07-career-app/.test(x)); return fetch(src).then((r) => r.text()).then((t) => /logSeasonV77\(e, t\),\s*legacySeasonV152\(e, t\)/.test(t)) })
  ok(hook, 'the season hook sits right after logSeasonV77 in finishSeasonGames')
}

// ============================== 5. milestones ==============================
{
  await fresh({ name: 'Milestone Man', xp: 0, view: 'hub' }); await boot()
  await E(() => localStorage.setItem('rib.legacy.v152', JSON.stringify({ award: 0, chip: 1, ms: 0 })))
  const m = await E(() => { const A = window.__V152A, S = __GRIDIRON_AUDIT__.getState(), pp0 = S.pp || 0
    const a = A.pay(S.player, A.xpAt(10) + 5, 'season', [['test', 1]]); A.save()
    return { to: a.to, ms: a.ms, bounty: a.bounty, pp: S.pp - pp0, want: A.bounty(10) } })
  ok(m.to === 10 && m.ms.length === 1 && m.bounty === m.want && m.pp === m.want, 'crossing Legacy 10 pays its PP bounty once', m)
  await E(() => window.RIB_LEGACY.refresh())
  await page.waitForSelector('.lgm-v152', { timeout: 5000 }).catch(() => null)
  await page.waitForTimeout(1300); await shot('5_milestone')
  const o = await E(() => { const o = document.querySelector('.lgm-v152'); return o && { title: o.querySelector('.lgm-title').textContent, big: o.classList.contains('big'), medal: +(o.querySelector('.lgm-slot .lg-medal-v152') || {}).dataset?.rank } })
  ok(o && /LEGACY\s*10/.test(o.title) && !o.big && o.medal === 10, 'the milestone card shows on the hub with the new medal', o)
  await tap('.lgm-ok'); await page.waitForTimeout(500)
  const gone = await E(() => !document.querySelector('.lgm-v152') && JSON.parse(localStorage.getItem('rib.legacy.v152')).ms === 10)
  ok(gone, 'it closes and is not shown again')
  // a big one: 100, the tier promotion
  await E(() => { const A = window.__V152A, S = __GRIDIRON_AUDIT__.getState(); A.pay(S.player, A.xpAt(100) - S.legacyV152.xp, 'season', []); A.save(); window.RIB_LEGACY.refresh() })
  await page.waitForSelector('.lgm-v152.big', { timeout: 5000 }).catch(() => null)
  await page.waitForTimeout(1500); await shot('5_milestone_100')
  const b = await E(() => { const o = document.querySelector('.lgm-v152.big'); return o && { tier: (o.querySelector('.lgm-tier') || {}).textContent, rw: o.querySelector('.lgm-rw').textContent } })
  ok(b && /ELITE/.test(b.tier) && /9 milestones/.test(b.rw), 'Legacy 100 is a big event: the new tier, every milestone crossed paid', b)
  await tap('.lgm-ok'); await page.waitForTimeout(400)
}

// ============================== 6. Rank 500 ==============================
{
  await fresh({ name: 'Ultimate Man', view: 'hub' }); await boot()
  await E(() => { const A = window.__V152A, S = __GRIDIRON_AUDIT__.getState(); localStorage.setItem('rib.legacy.v152', JSON.stringify({ award: 0, chip: 490, ms: 490 })); S.legacyV152 = { v: 1, xp: A.xpAt(495), boot: 1, got: {}, log: [], ms: 490 }
    A.pay(S.player, A.xpAt(500) - A.xpAt(495) + 10, 'career', []); A.save(); window.RIB_LEGACY.refresh() })
  await page.waitForSelector('.lgm-v152.r500', { timeout: 5000 }).catch(() => null)
  await page.waitForTimeout(1800); await shot('6_r500_assembly')
  await page.waitForTimeout(3000); await shot('6_r500_done')
  const r = await E(() => { const o = document.querySelector('.lgm-v152.r500'); return o && { done: o.classList.contains('lg5-done'), medal: +(o.querySelector('.lg5-stage .lg-medal-v152') || {}).dataset?.rank, t: o.querySelector('.lg5-t').textContent } })
  ok(r && r.done && r.medal === 500 && r.t === 'ULTIMATE LEGACY', 'Rank 500 plays its own sequence and lands the Ultimate Legacy medal', r)
  await tap('.r500 .lgm-ok'); await page.waitForTimeout(500)
}

// ============================== 7. the profile ==============================
{
  await fresh({ name: 'Collector', xp: 0, view: 'menu' }); await boot()
  await E(() => { const A = window.__V152A, S = __GRIDIRON_AUDIT__.getState(); A.pay(S.player, A.xpAt(137) + 40, 'career', []); A.save(); localStorage.setItem('rib.legacy.v152', JSON.stringify({ award: 99, chip: 137, ms: 130 })) })
  await E(() => { const S = __GRIDIRON_AUDIT__.getState(); window.__keepP = S.player; S.player = null })   // the account's profile, between careers
  await E(() => window.go('profile')); await page.waitForTimeout(1200)
  const p = await E(() => { const sc = document.getElementById('screen'), c = sc.querySelector('.lg-case-v152'), b = sc.querySelector('.lg-book-v152')
    return { cse: !!c, caseMedal: c && +c.querySelector('.lgk-slot .lg-medal-v152').dataset.rank, plaque: c && c.querySelector('.lgk-name').textContent, book: !!b, tabs: b && b.querySelectorAll('.lgb-tab').length, cells: b && b.querySelectorAll('.lgb-cell').length,
      owned: b && b.querySelectorAll('.lgb-cell:not(.locked)').length, cur: b && +(b.querySelector('.lgb-cell.cur') || {}).dataset?.rank, chip: !!sc.querySelector('.pc-legacy-v152'), page: b && b.querySelector('.lgb-pt b').textContent, want: RIB_LEGACY.name(137) } })
  ok(p.cse && p.caseMedal === 137 && p.plaque === p.want, 'the trophy case holds the current medal and its plaque', p.plaque)
  ok(p.book && p.tabs === 10 && p.cells === 50 && p.owned === 37 && p.cur === 137 && p.page === 'ELITE', 'the collection book opens on his tier: 50 medals, the earned ones in colour', { owned: p.owned, page: p.page })
  ok(p.chip, 'the profile card wears the rank')
  await shot('7_profile')
  const tabs = await E(() => [...document.querySelectorAll('.hubv75-tab')].map((t) => t.dataset.sec).join(','))
  ok(tabs === 'card,case,book', 'the profile is three tabs: the card, the trophy case, the collection book', tabs)
  await tap('.hubv75-tab[data-sec="case"]'); await page.waitForTimeout(700); await shot('7_case')
  const cs = await E(() => { const c = document.querySelector('.lg-case-v152'); return { h: c.getBoundingClientRect().height, sh: c.scrollHeight } })
  ok(cs.h >= cs.sh - 2 && cs.h > 300, 'the trophy case shows whole on its tab', cs)
  await tap('.hubv75-tab[data-sec="book"]'); await page.waitForTimeout(700); await shot('7_book')
  const bk = await E(() => { const c = document.querySelector('.lg-book-v152'); return { h: c.getBoundingClientRect().height, sh: c.scrollHeight } })
  ok(bk.h >= bk.sh - 2 && bk.h > 350, 'the collection book shows whole on its tab', bk)
  await tap('.lgb-tab[data-page="0"]'); await page.waitForTimeout(500)
  const pg = await E(() => ({ page: document.querySelector('.lgb-pt b').textContent, owned: document.querySelectorAll('.lgb-cell:not(.locked)').length }))
  ok(pg.page === 'ROOKIE' && pg.owned === 50, 'a page turn: the rookie page is complete', pg)
  await tap('.lgb-tab[data-page="3"]'); await page.waitForTimeout(500)
  await tap('.lgb-cell[data-rank="160"]'); await page.waitForTimeout(300)
  const det = await E(() => document.querySelector('.lgb-detail.on') && document.querySelector('.lgb-detail').textContent)
  ok(det && /RANK 160/.test(det) && /Unlocks at/.test(det) && /MILESTONE/.test(det), 'a locked medal says what it costs', det && det.slice(0, 90))
  await E(() => document.querySelector('.lgb-detail').scrollIntoView()); await shot('7_detail')
  const f = await fits()
  ok(f.docW <= W && f.overX <= 1, 'the profile fits 400 wide', f)
}

// ============================== 8. the identity ==============================
{
  await E(() => { __GRIDIRON_AUDIT__.getState().player = window.__keepP; window.go('hub') }); await page.waitForTimeout(900)
  const top = await E(() => { const c = document.querySelector('.legacy-chip-v152.top'); return c && { rank: +c.dataset.rank, vis: c.getBoundingClientRect().width > 20, txt: c.textContent } })
  ok(top && top.rank === 137 && top.vis, 'the career top bar carries the rank chip', top)
  await shot('8_hub')
  await E(() => window.go('menu')); await page.waitForTimeout(1500)
  const menu = await E(() => { const c = document.querySelector('.legacy-chip-v152.menu'); return c && { rank: +c.dataset.rank, w: c.getBoundingClientRect().width } })
  ok(menu && menu.rank === 137 && menu.w > 20, 'the main menu carries the rank chip', menu)
  await shot('8_menu')
  const f = await fits(); ok(f.docW <= W, 'the menu still fits 400 wide', f)
  await E(() => { const S = __GRIDIRON_AUDIT__.getState(); S.view = 'choosePos'; window.go('choosePos') }); await page.waitForTimeout(900)
  const setup = await E(() => { const e = document.querySelector('.lg-setup-v152'); return e && e.textContent })
  ok(setup && /LEGACY RANK 137/.test(setup), 'career setup says the rank he carries in', setup)
  await shot('8_setup')
  const row = await E(() => { const e = { name: 'X', pos: 'QB', lr: 222, levelName: 'UFF', id: 'z' }; return window.RIB_LEGACY.medalHtml(e.lr, 20, { cls: 'lb' }) })
  ok(/data-rank="222"/.test(row), 'a board row can draw its medal')
  const lbSrc = await E(() => fetch([...document.scripts].map((x) => x.src).find((x) => /20-leaderboards/.test(x))).then((r) => r.text()))
  ok(/lgMedal\(e\)/.test(lbSrc) && /lr: Math\.max/.test(lbSrc), 'the career boards carry and draw the rank')
}

// ============================== 9. the old save; the switch ==============================
{
  await E(() => { const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); A.setState(S); S.tutorialSeen = true
    S.hof = [{ name: 'Old One', pos: 'QB', peak: 88, reached: 7, seasons: 22, titles: 4, rings: 2, won: true, goat: 400 }, { name: 'Old Two', pos: 'RB', peak: 64, reached: 4, seasons: 10, titles: 0, rings: 0, goat: 90 }]
    delete S.legacyV152; S.view = 'menu'; window.GridironStorage.save(S) })
  await boot()
  const g = await E(() => { const L = __GRIDIRON_AUDIT__.getState().legacyV152; return { xp: L.xp, rank: window.__V152A.rank(L.xp).rank, grand: L.grandV152 } })
  ok(g.xp > 10000 && g.rank > 20 && g.grand === g.xp, 'a pre-v152 Hall is credited once at boot', g)
  await boot()
  const g2 = await E(() => __GRIDIRON_AUDIT__.getState().legacyV152.xp)
  ok(g2 === g.xp, 'and only once', g2)
  const off = await E(() => { window.RIB_TUNE = window.RIB_TUNE || {}; window.RIB_TUNE.legacyV152 = 0; const S = __GRIDIRON_AUDIT__.getState(), x = S.legacyV152.xp; const a = window.__V152A.pay({ name: 'n' }, 5000, 'season', []); delete window.RIB_TUNE.legacyV152; return { a, same: S.legacyV152.xp === x } })
  ok(off.a === null && off.same, 'TU("legacyV152", 0) pays nothing', off)
}

// ============================== 10. no randomness, no errors ==============================
{
  const src = fs.readFileSync('src/31-legacy.js', 'utf8'), app = fs.readFileSync('src/07-career-app.js', 'utf8')
  const blk = app.slice(app.indexOf('v152 A THE LEGACY RANK (the ledger)'), app.indexOf('function hofWings()'))
  ok(!/Math\.random/.test(src) && blk.length > 1000 && !/Math\.random/.test(blk), 'the ledger and the medals never spend Math.random()')
  ok(errors.length === 0, 'no page errors', errors.slice(0, 5))
}

console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
