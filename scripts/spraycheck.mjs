// Dev check: v170 THE SPRAY MENU — HOLD, SLIDE, SLIDE (src/34-spray.js, + 22's training config / fold, 25's fit).
//   On a phone (375x667, touch, 2x): holding a bottom-bar button sprays its pages out (SEASON: six, STATS marked as
//   having more); sliding onto STATS sprays ITS pages; sliding onto STANDINGS and letting go lands on the stats screen's
//   standings — the press, slide, slide. Holding and letting go in place leaves the spray open to tap (a tap on LEAGUE
//   lands on the season's LEAGUE tab); a plain tap on a bar button just goes there (no spray). EVERY page in every bar
//   button's spray lands where it says (the hub's tabs and the life sim, the season's tabs and the stats, the skill
//   groups, the tree's pages, the menu's profile / locker / goals / boards / settings), and the life sim joins the hub's
//   spray at the UFF. One page, one scroll: on every
//   main screen the panel is the only scroller; the tab strip is gone and the section bar names the tab, turns it with
//   ‹ ›, opens the page's own spray from its middle and follows a swipe. On a desktop-width screen the tabs stay (no
//   one-scroll) and the spray still works. TU v170spray 0: a hold does nothing; TU v170one 0: the tab strip and the fitted
//   panel are back. No page errors.  GAME_URL=http://localhost:5173/ node scripts/spraycheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const open = async (w, h, tune, tag) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 540, hasTouch: true })
  await ctx.addInitScript((tune) => {
    window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, tune || {})
    try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off'); localStorage.setItem('rib.sprayHint.v170', '1') } catch {}
    setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80)
  }, tune || {})
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(tag + ': ' + (e.message || e)))
  await p.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
  await p.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V170 && !!window.__V169, null, { timeout: 40000 })
  await p.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  await p.waitForTimeout(700); await p.evaluate(() => document.getElementById('splash')?.remove())
  await p.evaluate(() => {
    const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; S.tree = S.tree || {}; A.setState(S)
    S.player = A.newPlayer(); const pl = S.player; pl.name = 'Test Man'; pl.pos = 'RB'; pl.age = 16; pl.originV11 = 'walk-on'; pl._wonShown = true; pl.level = 2
    for (const k in pl.attrs) pl.attrs[k] = 58; pl.training = 'balanced'; A.startSeasonGames()
    pl.weekResults.filter((w) => !w.playoff).slice(0, 4).forEach((w, i) => { w.played = true; w.won = i !== 2; w.us = w.won ? 28 : 10; w.them = w.won ? 14 : 24; w.perf = 75 })
    window.GridironStorage.save(S); window.go('hub')
  })
  await p.waitForTimeout(800)
  return { ctx, p }
}
const navPt = (p, k) => p.evaluate((k) => { const b = document.querySelector(`#navV139 button[data-k="${k}"]`); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }, k)
const bubPt = (p, label) => p.evaluate((label) => { const b = [...document.querySelectorAll('#sprayV170 .spr-b')].find((x) => x.querySelector('b').textContent === label); if (!b) return null; return { x: b.__p.x, y: b.__p.y } }, label)   // where it comes to rest (it may still be flying out)
const slide = async (p, a, b, steps = 10) => { for (let i = 1; i <= steps; i++) { await p.mouse.move(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps); await p.waitForTimeout(22) } }
const tabOn = (p) => p.evaluate(() => ((document.querySelector('#screen > .hubv75-tabs .hubv75-tab.on') || {}).dataset || {}).sec || null)

// ============================== A. the gesture, on a phone ==============================
{
  const { ctx, p } = await open(375, 667, null, 'A')
  const s = await navPt(p, 'season')
  await p.mouse.move(s.x, s.y); await p.mouse.down(); await p.waitForTimeout(420)
  const A1 = await p.evaluate(() => ({ open: window.__V170.isOpen(), labels: window.__V170.bubbles(), more: [...document.querySelectorAll('#sprayV170 .spr-b.more b')].map((b) => b.textContent) }))
  ok(A1.open && A1.labels.join() === 'SCHEDULE,LEAGUE,OPPONENT,BODY,ROLE,STATS' && A1.more.join() === 'STATS', 'holding SEASON sprays its six pages; STATS is marked as having more', A1)
  const st = await bubPt(p, 'STATS'); await slide(p, s, st); await p.waitForTimeout(320)
  if (process.env.DBG) console.log('dbg', st, await p.evaluate(() => ({ hi: (document.querySelector('#sprayV170 .spr-b.hi b') || {}).textContent, pts: [...document.querySelectorAll('#sprayV170 .spr-b')].map((b) => b.querySelector('b').textContent + '@' + Math.round(b.getBoundingClientRect().left + 30) + ',' + Math.round(b.getBoundingClientRect().top + 30)) })))
  const A2 = await p.evaluate(() => window.__V170.bubbles())
  ok(['LEADERS', 'STANDINGS', 'PROMOTION', 'RECRUITING'].every((l) => A2.includes(l)), 'sliding onto STATS sprays its own pages', A2)
  const sd = await bubPt(p, 'STANDINGS'); await slide(p, st, sd, 8); await p.waitForTimeout(120)
  const hi = await p.evaluate(() => (document.querySelector('#sprayV170 .spr-b.hi b') || {}).textContent)
  await p.mouse.up(); await p.waitForTimeout(900)
  const A3 = await p.evaluate(() => ({ view: window.S.view, open: window.__V170.isOpen(), standings: /STANDINGS/.test((document.querySelector('.branch-tab.active') || {}).textContent || '') }))
  ok(hi === 'STANDINGS' && A3.view === 'stats' && A3.standings && !A3.open, 'press, slide, slide: letting go on STANDINGS lands on the stats screen\'s standings, the spray gone', { hi, ...A3 })
  // hold and let go in place: the spray stays to tap
  const h = await navPt(p, 'season'); await p.mouse.move(h.x, h.y); await p.mouse.down(); await p.waitForTimeout(420); await p.mouse.up(); await p.waitForTimeout(250)
  const B1 = await p.evaluate(() => window.__V170.isOpen())
  const lg = await bubPt(p, 'LEAGUE'); if (lg) await p.mouse.click(lg.x, lg.y); await p.waitForTimeout(900)
  const B2 = { view: await p.evaluate(() => window.S.view), tab: await tabOn(p), open: await p.evaluate(() => window.__V170.isOpen()) }
  ok(B1 && B2.view === 'season' && B2.tab === 'league' && !B2.open, 'a hold let go in place leaves the spray open to tap; a tap on LEAGUE lands on the season\'s LEAGUE tab', { B1, ...B2 })
  // a plain tap on a bar button just goes there
  const hb = await navPt(p, 'hub'); await p.mouse.click(hb.x, hb.y); await p.waitForTimeout(700)
  const C1 = await p.evaluate(() => ({ view: window.S.view, open: window.__V170.isOpen() }))
  ok(C1.view === 'hub' && !C1.open, 'a plain tap on HUB goes to the hub (no spray)', C1)

  // ============================== B. every page in every spray lands where it says ==============================
  const EXPECT = {
    'hub/NOW': ['hub', 'now'], 'hub/BODY': ['hub', 'body'], 'hub/ATTRIBUTES': ['hub', 'skills'], 'hub/TEAM': ['hub', 'team'], 'hub/STORY': ['hub', 'story'],
    'season/SCHEDULE': ['season', 'sched'], 'season/LEAGUE': ['season', 'league'], 'season/OPPONENT': ['season', 'opp'], 'season/BODY': ['season', 'body'], 'season/ROLE': ['season', 'role'],
    'season/STATS': ['stats', 'lead'], 'season/STATS/LEADERS': ['stats', 'lead'], 'season/STATS/STANDINGS': ['stats', 'lead'], 'season/STATS/PROMOTION': ['stats', 'odds'], 'season/STATS/RECRUITING': ['rank'],
    'upgrade/PHYSICAL': ['upgrade', null, 'PHYSICAL'], 'upgrade/BALL SKILLS': ['upgrade', null, 'BALL SKILLS'], 'upgrade/MENTAL': ['upgrade', null, 'MENTAL'],
    'shop/NODES': ['shop', 'nodes'], 'shop/PERKS': ['shop', 'perks'], 'shop/THE PATH': ['path'], 'shop/DYNASTY': ['dynasty'], 'shop/HALL OF FAME': ['hof'],
    'menu/MAIN MENU': ['menu'], 'menu/PROFILE': ['profile', 'card'], 'menu/PROFILE/CARD': ['profile', 'card'], 'menu/PROFILE/TROPHY CASE': ['profile', 'case'], 'menu/PROFILE/COLLECTION': ['profile', 'book'], 'menu/PROFILE/SIMS': ['profile', 'sims'],
    'menu/LOCKER': ['locker', 'gear'], 'menu/LOCKER/GEAR': ['locker', 'gear'], 'menu/LOCKER/STYLE': ['locker', 'style'], 'menu/GOALS': ['challenges'],
    'menu/BOARDS': ['leaderboard'], 'menu/BOARDS/ALL-TIME': ['leaderboard'], 'menu/BOARDS/SEASON': ['leaderboard'], 'menu/BOARDS/WEEKLY': ['leaderboard'], 'menu/BOARDS/TITLES': ['leaderboard'],
    'menu/SETTINGS': ['settings', 'game'], 'menu/SETTINGS/GAME': ['settings', 'game'], 'menu/SETTINGS/SOUND': ['settings', 'sound'], 'menu/SETTINGS/FIELD': ['settings', 'field'], 'menu/SETTINGS/SAVE': ['settings', 'save'],
  }
  const paths = await p.evaluate(() => { const out = []; const walk = (nodes, pre) => nodes.forEach((n) => { out.push(pre + '/' + n.label); if (n.kids) walk(n.kids, pre + '/' + n.label) }); for (const k of ['hub', 'season', 'upgrade', 'shop', 'menu']) walk(window.__V170.tree[k](), k); return out })
  ok(paths.length === Object.keys(EXPECT).length && paths.every((x) => EXPECT[x]), `every bar button's spray holds the pages it should (${paths.length})`, paths.filter((x) => !EXPECT[x]))
  const wrong = []
  for (const path of paths) {
    const want = EXPECT[path]; if (!want) continue
    await p.evaluate(() => { if (window.S.view === 'menu' || document.body.classList.contains('rib-menu-open')) { try { window.go('hub') } catch (e) {} } })
    await p.waitForTimeout(350)
    await p.evaluate((path) => { const parts = path.split('/'); let nodes = window.__V170.tree[parts[0]](), n = null; for (const l of parts.slice(1)) { n = nodes.find((x) => x.label === l); nodes = (n && n.kids) || [] } n && n.act() }, path)
    await p.waitForTimeout(950)
    const got = await p.evaluate(() => ({ view: window.S.view, tab: ((document.querySelector('#screen > .hubv75-tabs .hubv75-tab.on') || {}).dataset || {}).sec || null, tabs: document.querySelectorAll('#screen > .hubv75-tabs .hubv75-tab').length, group: window.__upGroupV97 || null }))
    // a screen with one section has no tabs to light (the stats standings): the view is the page
    const good = got.view === want[0] && (want[1] == null || got.tab === want[1] || (got.tab === null && got.tabs === 0)) && (want[2] == null || got.group === want[2])
    if (!good) wrong.push({ path, want, got })
  }
  ok(wrong.length === 0, `every page in every spray lands where it says (${paths.length} destinations)`, wrong.slice(0, 4))

  // the life sim joins the hub's spray at the UFF, and lands on the life screen
  const L = await p.evaluate(async () => { const pl = window.S.player, lv = pl.level; const before = window.__V170.tree.hub().map((n) => n.label)
    pl.level = 7; const node = window.__V170.tree.hub().find((n) => n.label === 'LIFE'); let view = null, kids = node ? node.kids.map((k) => k.label) : []
    if (node) { node.kids.find((k) => k.label === 'INVEST').act(); await new Promise((r) => setTimeout(r, 700)); view = window.S.view }
    pl.level = lv; window.go('hub'); await new Promise((r) => setTimeout(r, 500))
    return { before: before.includes('LIFE'), life: !!node, kids, view } })
  ok(!L.before && L.life && L.kids.join() === 'OVERVIEW,LIFESTYLE,HOME,INVEST,GOALS' && L.view === 'life', 'the life sim joins the HUB spray at the UFF (OVERVIEW · LIFESTYLE · HOME · INVEST · GOALS) and lands on the life screen', L)

  // ============================== C. one page, one scroll; the section bar ==============================
  await p.evaluate(() => { try { window.go('hub') } catch (e) {} }); await p.waitForTimeout(500)
  const scrollers = []
  for (const v of ['hub', 'season', 'training', 'upgrade', 'shop', 'stats', 'profile', 'settings', 'challenges', 'hof']) {
    await p.evaluate((v) => window.go(v), v); await p.waitForTimeout(800)
    const keys = await p.evaluate(() => [...document.querySelectorAll('#screen > .hubv75-tabs .hubv75-tab')].map((t) => t.dataset.sec))
    for (const k of (keys.length ? keys : [null])) {
      if (k) { await p.evaluate((k) => document.querySelector(`#screen > .hubv75-tabs .hubv75-tab[data-sec="${k}"]`).click(), k); await p.waitForTimeout(380) }
      const n = await p.evaluate(() => { const s = document.getElementById('screen'); return [...s.querySelectorAll('*')].filter((e) => { const cs = getComputedStyle(e); return e.getBoundingClientRect().height > 30 && /auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 6 && !e.closest('.chips') }).length })
      if (n) scrollers.push(v + (k ? ':' + k : '') + ' ' + n)
    }
  }
  ok(scrollers.length === 0, 'one page, one scroll: on every main screen and tab nothing inside the panel scrolls on its own', scrollers)
  await p.evaluate(() => { window.__HUB_V75.tabs.season = 'sched'; window.go('season') }); await p.waitForTimeout(900)
  const D = await p.evaluate(async () => { const bar = document.querySelector('#screen > .secbar-v170'), strip = document.querySelector('#screen > .hubv75-tabs')
    const name = () => ((bar && bar.querySelector('.sb-mid b')) || {}).textContent
    const out = { bar: !!bar, strip: strip ? getComputedStyle(strip).display : null, n0: name(), dots: bar ? bar.querySelectorAll('.sb-mid u').length : 0, one: document.documentElement.classList.contains('one-v170') }
    const b = () => document.querySelector('#screen > .secbar-v170')
    b().querySelector('.sb-next').click(); await new Promise((r) => setTimeout(r, 450)); out.n1 = ((b() || document).querySelector('.sb-mid b') || {}).textContent
    b().querySelector('.sb-prev').click(); await new Promise((r) => setTimeout(r, 450)); out.n2 = ((b() || document).querySelector('.sb-mid b') || {}).textContent
    b().querySelector('.sb-mid').click(); await new Promise((r) => setTimeout(r, 300)); out.spray = window.__V170.bubbles(); window.__V170.close()
    // a swipe left turns to the next section
    const scr = document.getElementById('screen'), t0 = scr.querySelector('.hubv75-sec.on') || scr, r = t0.getBoundingClientRect(), y = r.top + 120
    const touch = (x) => new Touch({ identifier: 7, target: t0, clientX: x, clientY: y })
    t0.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [touch(300)], changedTouches: [touch(300)] }))
    t0.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [touch(150)] }))
    await new Promise((r) => setTimeout(r, 450)); out.swiped = ((b() || document).querySelector('.sb-mid b') || {}).textContent
    return out })
  ok(D.one && D.bar && D.strip === 'none' && D.n0 === 'SCHEDULE' && D.dots === 5, 'the section bar names the tab (SCHEDULE, five dots) and the tab strip is gone', D)
  ok(D.n1 === 'LEAGUE' && D.n2 === 'SCHEDULE', 'the section bar\'s › and ‹ turn the page', { n1: D.n1, n2: D.n2 })
  ok(D.spray.join() === 'SCHEDULE,LEAGUE,OPPONENT,BODY,ROLE', 'a tap on the section bar sprays the page\'s own sections', D.spray)
  ok(D.swiped === 'LEAGUE', 'a swipe left on the page turns to the next section', D.swiped)
  await ctx.close()
}

// ============================== D. a desktop-width screen: tabs stay, the spray works ==============================
{
  const { ctx, p } = await open(900, 900, null, 'desk')
  await p.evaluate(() => window.go('season')); await p.waitForTimeout(900)
  const E = await p.evaluate(() => ({ one: document.documentElement.classList.contains('one-v170'), strip: getComputedStyle(document.querySelector('#screen > .hubv75-tabs') || document.body).display, bar: !!document.querySelector('.secbar-v170'), opened: window.__V170.open('menu'), labels: window.__V170.bubbles() }))
  await p.evaluate(() => window.__V170.close())
  ok(!E.one && E.strip !== 'none' && !E.bar && E.opened && E.labels.includes('SETTINGS'), 'a desktop-width screen keeps its tab strip (no one-scroll) and the spray still opens', E)
  await ctx.close()
}

// ============================== E. the kill switches ==============================
{
  const { ctx, p } = await open(375, 667, { v170spray: 0, v170one: 0 }, 'off')
  const s = await navPt(p, 'season'); await p.mouse.move(s.x, s.y); await p.mouse.down(); await p.waitForTimeout(450)
  const K1 = await p.evaluate(() => !!document.getElementById('sprayV170')); await p.mouse.up(); await p.waitForTimeout(800)
  const K2 = await p.evaluate(() => ({ view: window.S.view, one: document.documentElement.classList.contains('one-v170'), strip: getComputedStyle(document.querySelector('#screen > .hubv75-tabs') || document.body).display, bar: !!document.querySelector('.secbar-v170'), fills: document.querySelectorAll('#screen .fill-v146').length }))
  ok(!K1 && K2.view === 'season', 'TU v170spray 0: a hold sprays nothing and the bar button still goes there', { K1, view: K2.view })
  ok(!K2.one && K2.strip !== 'none' && !K2.bar, 'TU v170one 0: the tab strip is back, no section bar', K2)
  await ctx.close()
}

ok(errors.length === 0, 'no page errors', errors.slice(0, 4))
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
