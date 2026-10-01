// Dev check: v168 THE SEASON, REDRAWN (src/07-career-app.js seasonHeroV168 / leagueCardV168 / postGameSeasonV168 /
// seasonStripV168 / finalTableV168, src/32-season-ui.js, src/22-hub-sections.js, src/28-cosmetics.js).
//   The season screen opens on its hero (crest, record, league place, one pip a regular-season game with the playoff line
//   at the needed win, the next game as a matchup) and the eyebrow / H1 step aside; the LEAGUE tab is the table (every
//   team, you marked, the bracket line under the field). Explanations fold behind ONE ⓘ per card: the paragraphs stay in
//   the DOM, hidden, and the ⓘ opens a sheet carrying every one of them (GOT IT closes it); the dock's watch-live note is
//   an ⓘ at the front of the chip row. A tabbed section that runs past the panel ends on a pager whose NEXT opens the next
//   tab. The post-game card's season strip counts the game before it is booked; the hub's NOW tab carries the season
//   strip inside the player card (a tap opens the season); the season report's GRADE tab shows the final standings. The
//   recap skins' rules are scoped selector by selector (a cover skin no longer greys every card's small print). TU
//   v168info 0: nothing folds, no pager; TU v168season 0: no hero, the old header. No page errors.
//   GAME_URL=http://localhost:5173/ node scripts/v168check.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = (...q) => url + (url.includes('?') ? '&' : '?') + ['stayStale', 'noFilmV114', 'noGrowV132'].concat(q).join('&')
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const newCtx = async (tune, vp) => {
  const context = await browser.newContext({ viewport: vp || { width: 400, height: 860 } })
  await context.addInitScript((tune) => {
    window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, tune || {})
    try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
    setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80)
  }, tune || {})
  return context
}
const open = async (ctx, tag) => {
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(tag + ': ' + (e.message || e)))
  await p.goto(U(), { waitUntil: 'networkidle', timeout: 60000 })
  await p.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V168 && !!window.__V168UI, null, { timeout: 40000 })
  await p.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  await p.waitForTimeout(800); await p.evaluate(() => document.getElementById('splash')?.remove()); return p
}
const M = (page, fn, arg) => page.evaluate(fn, arg)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const seed = (page) => M(page, async () => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; S.tree = S.tree || {}; A.setState(S)
  S.player = A.newPlayer(); const p = S.player; p.name = 'Test Man'; p.pos = 'RB'; p.age = 16; p.originV11 = p.originV11 || 'walk-on'; p._wonShown = true
  p.level = 2; for (const k in p.attrs) p.attrs[k] = 58; p.training = 'balanced'; A.startSeasonGames()
  p.weekResults.filter((w) => !w.playoff).slice(0, 4).forEach((w, i) => { w.played = true; w.won = i !== 2; w.us = w.won ? 28 : 10; w.them = w.won ? 14 : 24; w.perf = 75; w.liveBookedV85 = true })
  window.go('season'); window.GridironStorage.save(S); await new Promise((r) => setTimeout(r, 700))
})
const tab = (page, sec) => M(page, async (sec) => { const b = document.querySelector(`.hubv75-tab[data-sec="${sec}"]`); b && b.click(); await new Promise((r) => setTimeout(r, 450)); return !!b }, sec)
const vis = (page, sel) => M(page, (sel) => { const n = document.querySelector(sel); if (!n) return null; const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(n).display !== 'none' }, sel)

// ============================== A. the hero and the league tab ==============================
{
  const c = await newCtx(), a = await open(c, 'A')
  await seed(a)
  const H = await M(a, () => {
    const p = window.S.player, reg = p.weekResults.filter((w) => !w.playoff), hero = document.querySelector('.sx-hero-v168')
    const pips = [...document.querySelectorAll('.sx-hero-v168 .pip-v168')], need = Math.ceil(reg.length * 0.6)
    const next = reg.find((w) => !w.played)
    return { hero: !!hero, inSched: !!(hero && hero.closest('.hubv75-sec[data-sec="sched"]')), rec: (document.querySelector('.sx-rec b') || {}).textContent,
      want: reg.filter((w) => w.played && w.won).length + '-' + reg.filter((w) => w.played && !w.won).length, pips: pips.length, games: reg.length,
      w: pips.filter((x) => x.classList.contains('w')).length, l: pips.filter((x) => x.classList.contains('l')).length, line: pips.findIndex((x) => x.classList.contains('line')), need,
      nextPip: pips.findIndex((x) => x.classList.contains('next')), nextIdx: reg.indexOf(next), them: ((document.querySelector('.sx-side.them b') || {}).textContent || ''), opp: next && next.opp,
      h1: getComputedStyle(document.querySelector('#screen > .h1') || document.body).display, eyebrow: getComputedStyle(document.querySelector('#screen > .eyebrow') || document.body).display,
      place: (document.querySelector('.sx-rec small') || {}).textContent }
  })
  ok(H.hero && H.inSched, 'the season screen opens on its hero, on the SCHEDULE tab', H)
  ok(H.rec === H.want && /OF \d+/.test(H.place || ''), 'the hero shows the regular-season record and the league place', { rec: H.rec, want: H.want, place: H.place })
  ok(H.pips === H.games && H.w === 3 && H.l === 1 && H.line === H.need - 1 && H.nextPip === H.nextIdx, 'one pip a regular-season game: 3 won, 1 lost, the next one lit, the playoff line at the needed win', { pips: H.pips, w: H.w, l: H.l, line: H.line, need: H.need, next: H.nextPip })
  ok(H.them && H.opp && H.opp.toUpperCase().includes(H.them.toUpperCase().slice(0, 4)), 'the matchup names the next opponent', { them: H.them, opp: H.opp })
  ok(H.h1 === 'none' && H.eyebrow === 'none', 'the eyebrow and the H1 step aside for the hero')
  await tab(a, 'league')
  const L = await M(a, () => { const T = window.__V167.table(), rows = [...document.querySelectorAll('.league-card-v168 .lg-row-v168')], cut = document.querySelector('.league-card-v168 .lg-cut-v168')
    const all = [...document.querySelectorAll('.league-card-v168 .lg-rows-v168 > *')]
    return { on: !!document.querySelector('.hubv75-sec.on .league-card-v168'), rows: rows.length, n: T.teams.length, me: rows.findIndex((r) => r.classList.contains('me')), meWant: T.teams.findIndex((r) => r.me), cutAt: all.indexOf(cut), first: (rows[0] && rows[0].querySelector('.lg-nm') || {}).textContent, firstWant: T.teams[0].me ? null : T.teams[0].name } })
  ok(L.on && L.rows === L.n && L.me === L.meWant, 'the LEAGUE tab is the table: every team, your row where the table puts you', L)
  ok(L.cutAt === 4 && (L.firstWant == null || (L.first || '').toUpperCase().startsWith(L.firstWant.toUpperCase())), 'the bracket line sits under the top four (a two-round bracket), the leader first', { cutAt: L.cutAt, first: L.first })

  // ============================== B. ⓘ: the body card ==============================
  await tab(a, 'body')
  const B = await M(a, async () => {
    const card = document.querySelector('.hubv75-sec.on .condition-card-v11'); if (!card) return null
    const folded = [...card.querySelectorAll('.ribi-f-v168')], btns = card.querySelectorAll('.ribi-btn-v168')
    const hidden = folded.every((n) => getComputedStyle(n).display === 'none'), texts = folded.map((n) => (n.textContent || '').trim())
    btns[0] && btns[0].click(); await new Promise((r) => setTimeout(r, 350))
    const sh = document.getElementById('ribiSheetV168'), secs = sh ? sh.querySelectorAll('section').length : 0
    const shTxt = sh ? sh.innerText.replace(/\s+/g, ' ') : '', carries = texts.every((t) => shTxt.includes(t.replace(/\s+/g, ' ').slice(0, 30)))
    sh && sh.querySelector('.ribi-ok').click(); await new Promise((r) => setTimeout(r, 350))
    return { folded: folded.length, btns: btns.length, hidden, kept: texts.every(Boolean), secs, carries, closed: !document.getElementById('ribiSheetV168'), title: sh ? (sh.querySelector('.ribi-title') || {}).textContent : '' }
  })
  ok(B && B.folded >= 3 && B.btns === 1 && B.hidden && B.kept, 'the body card folds its paragraphs behind ONE ⓘ — hidden, still in the DOM', B)
  ok(B && B.secs === B.folded && B.carries && /BODY/i.test(B.title || ''), 'the ⓘ opens a sheet carrying every folded paragraph, titled for the card', B && { secs: B.secs, title: B.title })
  ok(B && B.closed, 'GOT IT closes the sheet')

  // ============================== C. the dock's ⓘ ==============================
  const D = await M(a, async () => { const row = document.querySelector('#dock .qa-row-v146'), b = document.querySelector('#dock .ribi-dock-v168'), note = document.querySelector('#dock .watch-note-v164c')
    const first = !!(row && b && row.firstElementChild === b), hidden = note ? getComputedStyle(note).display === 'none' : null
    b && b.click(); await new Promise((r) => setTimeout(r, 300)); const sh = document.getElementById('ribiSheetV168'), txt = sh ? sh.innerText : ''
    sh && sh.querySelector('.ribi-ok').click(); await new Promise((r) => setTimeout(r, 300))
    return { first, hidden, opened: /Watch live/i.test(txt) } })
  ok(D.first && D.hidden && D.opened, 'the dock\'s watch-live note is an ⓘ at the front of the chip row, and it opens the note', D)

  // ============================== E. the post-game strip ==============================
  const E = await M(a, () => { const p = window.S.player, wr = p.weekResults.find((w) => !w.played), h = window.__V168.postSeason(wr, 24, 10), d = document.createElement('div'); d.innerHTML = h
    return { rec: (d.querySelector('.sx-race-k span') || {}).textContent, now: d.querySelectorAll('.pip-v168.w.now').length, w: d.querySelectorAll('.pip-v168.w').length } })
  ok(E.rec === 'SEASON · 4-1' && E.now === 1 && E.w === 4, 'the post-game strip counts the game before it is booked (3-1 → 4-1, the new pip marked)', E)

  // ============================== F. the hub's season strip ==============================
  const F = await M(a, async () => { window.go('hub'); await new Promise((r) => setTimeout(r, 900)); const t = document.querySelector('.hubv75-tab[data-sec="now"]'); t && t.click(); await new Promise((r) => setTimeout(r, 500))
    const s = document.querySelector('.season-strip-v168'), inHero = !!(s && s.closest('.player-hero')), txt = s ? s.innerText.replace(/\s+/g, ' ') : ''
    s && s.click(); await new Promise((r) => setTimeout(r, 500)); return { strip: !!s, inHero, txt: txt.slice(0, 80), view: window.S.view } })
  ok(F.strip && F.inHero && /3-1/.test(F.txt) && F.view === 'season', 'the hub\'s NOW tab carries the season strip inside the player card, and a tap opens the season', F)

  // ============================== G. the season report's final standings ==============================
  const G = await M(a, async () => { const p = window.S.player
    for (let g = 0; g < 4; g++) { p.weekResults.forEach((w) => { if (!w.played) { w.played = true; w.won = true; w.us = 28; w.them = 14; w.perf = 82; w.liveBookedV85 = true } }); window.go('season'); await new Promise((r) => setTimeout(r, 300)) }
    if (p.playoffState) { p.playoffState.done = true; p.playoffState.champion = true; p.playoffState.alive = false }
    window.finishSeasonGames(); await new Promise((r) => setTimeout(r, 1200))
    const f = document.querySelector('.final-table-v168'); return { view: window.S.view, f: !!f, grade: !!(f && f.closest('.hubv75-sec[data-sec="grade"]')), txt: f ? f.innerText.replace(/\s+/g, ' ').slice(0, 60) : '' } })
  ok(G.view === 'result' && G.f && G.grade && /FINISHED \d+(ST|ND|RD|TH)/.test(G.txt), 'the season report\'s GRADE tab shows where the year finished in the league', G)

  // ============================== H. accordion titles end on a whole word ==============================
  const Hd = await M(a, async () => { window.go('hub'); await new Promise((r) => setTimeout(r, 900)); const out = []
    for (const k of ['now', 'body', 'team', 'story']) { const t = document.querySelector(`.hubv75-tab[data-sec="${k}"]`); t && t.click(); await new Promise((r) => setTimeout(r, 400)); document.querySelectorAll('.hubv75-sec.on .hubv97-head > span').forEach((s) => out.push(s.textContent)) }
    return out })
  ok(Hd.every((t) => t.length <= 35 && (t.length < 34 || /…$/.test(t)) && !/[a-z][A-Z]{2}/.test(t)), 'every accordion title fits, ends on a whole word or an ellipsis, and never runs two lines together', Hd)
  await c.close()
}

// ============================== I. the pager (a short phone: the body tab runs past the panel) ==============================
{
  const c = await newCtx(null, { width: 400, height: 640 }), a = await open(c, 'I')
  await seed(a); await tab(a, 'body'); await a.waitForTimeout(900)
  const P = await M(a, async () => { const pg = document.querySelector('.hubv75-sec.on .pager-v168'), next = pg && pg.querySelector('.pg-next'), prev = pg && pg.querySelector('.pg-prev')
    const want = next && next.dataset.go; next && next.click(); await new Promise((r) => setTimeout(r, 450))
    return { pager: !!pg, next: next ? next.textContent : null, prev: prev ? prev.textContent : null, want, now: (document.querySelector('.hubv75-tab.on') || {}).dataset?.sec } })
  ok(P.pager && /OPPONENT/.test(P.prev || '') && /ROLE/.test(P.next || ''), 'a long BODY tab ends on a pager naming its neighbours (‹ OPPONENT · ROLE ›)', P)
  ok(P.want && P.now === P.want, 'the pager\'s NEXT opens the next tab', P)
  await c.close()
}

// ============================== J. the kill switches ==============================
{
  const c = await newCtx({ v168info: 0, v168season: 0 }), a = await open(c, 'J')
  await seed(a); await tab(a, 'body')
  const K = await M(a, () => ({ hero: !!document.querySelector('.sx-hero-v168'), btns: document.querySelectorAll('.ribi-btn-v168').length, folded: document.querySelectorAll('.ribi-f-v168').length,
    h1: getComputedStyle(document.querySelector('#screen > .h1') || document.body).display, league: !!document.querySelector('.league-card-v168'), pager: !!document.querySelector('.pager-v168') }))
  ok(!K.hero && !K.league && K.h1 !== 'none', 'TU v168season 0: no hero, no league tab, the old header', K)
  ok(K.btns === 0 && K.folded === 0 && !K.pager, 'TU v168info 0: nothing folds, no ⓘ, no pager', K)
  await c.close()
}

// ============================== K. the recap skins are scoped selector by selector ==============================
{
  const c = await newCtx(), a = await open(c, 'K')
  const S = await M(a, () => { const st = document.getElementById('cosV158Acss'); if (!st) return null; const bad = []
    for (const r of st.sheet.cssRules) { const sel = r.selectorText || ''; if (!sel || /^\.rc-/.test(sel)) continue; for (const q of sel.split(',')) if (/#screen/.test(q) && !/^html\[data-cos-recap=/.test(q.trim())) bad.push(q.trim()) }
    return { bad: bad.slice(0, 4), n: bad.length } })
  ok(S && S.n === 0, 'every recap-skin selector is scoped to its skin (none paints every card)', S)
  await c.close()
}

ok(errors.length === 0, 'no page errors', errors.slice(0, 4))
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
