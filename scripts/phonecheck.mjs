// Dev check: v169 BIG ON A PHONE (src/33-phone.js, + 32's pager placement, 22's fold titles, 07's pace note).
//   On a phone (360x740 and 375x667, touch, 2x) the career screens read: no visible text under 12px on the hub, the
//   season's tabs, the league, training, skills and stats, and at most half of it under
//   13px (the 12px floor is for uppercase labels); the html carries phone-v169 / short-v169; a short phone folds the
//   ticker; the section tabs stand 48px+ with the icon over the label; the dock's main button is 46px+; training shows
//   three programs a row with the chosen program's panel in view; the season hero's next-up is one line on a short
//   phone; the pregame wizard and the post-game card meet the same floor, and the post-game card's Continue is on
//   screen. TU v169phone 0: none of it (no classes, nothing lifted). No page errors.
//   GAME_URL=http://localhost:5173/ node scripts/phonecheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const open = async (w, h, tune, tag) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await ctx.addInitScript((tune) => {
    window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, tune || {})
    try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
    setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80)
  }, tune || {})
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(tag + ': ' + (e.message || e)))
  await p.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
  await p.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V169 && !!window.__V168UI, null, { timeout: 40000 })
  await p.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  await p.waitForTimeout(700); await p.evaluate(() => document.getElementById('splash')?.remove())
  await p.evaluate(() => {
    const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; S.tree = S.tree || {}; A.setState(S)
    S.player = A.newPlayer(); const pl = S.player; pl.name = 'Test Man'; pl.pos = 'RB'; pl.age = 16; pl.originV11 = 'walk-on'; pl._wonShown = true; pl.level = 2
    for (const k in pl.attrs) pl.attrs[k] = 58; pl.training = 'balanced'; A.startSeasonGames()
    pl.weekResults.filter((w) => !w.playoff).slice(0, 4).forEach((w, i) => { w.played = true; w.won = i !== 2; w.us = w.won ? 28 : 10; w.them = w.won ? 14 : 24; w.perf = 75 })
    window.GridironStorage.save(S)
  })
  return { ctx, p }
}
// the visible text under `roots`: characters by font size, inside the viewport and outside the bottom chrome
const audit = (p, roots) => p.evaluate((roots) => {
  const out = { chars: 0, under12: 0, under13: 0, worst: [] }
  const chrome = Math.min(...['#dock', '.hubv75-tabs', '#navV139'].map((s) => { const n = document.querySelector(s); const r = n && n.getBoundingClientRect(); return r && r.height > 0 && getComputedStyle(n).display !== 'none' ? r.top : innerHeight }))
  for (const sel of roots.split(',')) for (const root of document.querySelectorAll(sel)) {
    const fixed = root.id !== 'screen'
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n
    while ((n = w.nextNode())) {
      const t = n.textContent.trim(); if (!t) continue
      const el = n.parentElement, r = el.getBoundingClientRect(), cs = getComputedStyle(el)
      if (!r.width || !r.height || cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue
      if (r.bottom < 0 || r.top > (fixed ? innerHeight : chrome)) continue
      if (el.closest('canvas,svg,.pip-v168,.crest-v168,.emblem-v44,[aria-hidden="true"]')) continue
      const fs = parseFloat(cs.fontSize); if (!(fs > 0)) continue   // an icon whose letter is drawn (font-size 0)
      out.chars += t.length
      if (fs < 12 - 0.05) { out.under12 += t.length; if (out.worst.length < 5) out.worst.push(fs + 'px ' + String(el.className || el.tagName).slice(0, 24) + ' "' + t.slice(0, 18) + '"') }
      if (fs < 13 - 0.05) out.under13 += t.length
    }
  }
  return out
}, roots)
const go = (p, v, sec) => p.evaluate(async ({ v, sec }) => {
  if (window.S.view !== v) window.go(v); await new Promise((r) => setTimeout(r, 650))
  if (sec) { const b = document.querySelector(`.hubv75-tab[data-sec="${sec}"]`); b && b.click(); await new Promise((r) => setTimeout(r, 420)) }
  return window.S.view
}, { v, sec })

for (const [w, h] of [[360, 740], [375, 667]]) {
  const { ctx, p } = await open(w, h, null, `${w}x${h}`)
  const cls = await p.evaluate(() => ({ phone: document.documentElement.classList.contains('phone-v169'), short: document.documentElement.classList.contains('short-v169') }))
  ok(cls.phone && cls.short === (h <= 760), `${w}x${h}: html carries phone-v169${h <= 760 ? ' and short-v169' : ''}`, cls)
  for (const [v, sec] of [['hub', 'now'], ['season', 'sched'], ['season', 'league'], ['season', 'opp'], ['season', 'body'], ['training'], ['upgrade'], ['stats', 'lead']]) {
    await go(p, v, sec)
    const a = await audit(p, '#screen,#dock')
    ok(a.under12 === 0 && a.under13 <= a.chars / 2, `${w}x${h} ${v}${sec ? ':' + sec : ''}: no text under 12px, no more than half under 13px (the labels)`, { chars: a.chars, under13: a.under13, worst: a.worst })
  }
  // the chrome: ticker, tabs, main button
  await go(p, 'season', 'sched')
  const C = await p.evaluate(() => { const t = document.getElementById('tickV146'), tabs = [...document.querySelectorAll('.hubv75-tab')], m = document.querySelector('#dock .qa-main-v146')
    const tb = tabs[0] && tabs[0].getBoundingClientRect(), ic = tabs[0] && tabs[0].querySelector('i'), icR = ic && ic.getBoundingClientRect()
    return { ticker: t ? getComputedStyle(t).display : 'none', tabH: tb ? Math.round(tb.height) : 0, iconAbove: !!(icR && tb && icR.bottom <= tb.top + tb.height * 0.62), main: m ? Math.round(m.getBoundingClientRect().height) : 0 } })
  ok((h <= 760 ? C.ticker === 'none' : true) && C.tabH >= 48 && C.iconAbove && C.main >= 46, `${w}x${h}: the ticker folds on a short phone; tabs 48px+ with the icon over the label; the main button 46px+`, C)
  // the hero's next-up on a short phone
  const N = await p.evaluate(() => { const you = document.querySelector('.sx-mu > .sx-side:not(.them)'), them = document.querySelector('.sx-mu > .sx-side.them')
    return { you: you ? getComputedStyle(you).display : null, them: !!(them && them.getBoundingClientRect().height > 0), h: Math.round((document.querySelector('.sx-hero-v168') || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height) } })
  ok(h <= 760 ? N.you === 'none' && N.them : N.them, `${w}x${h}: the hero's next-up is the opponent on one line on a short phone`, N)
  // training: three a row, the chosen program in view
  await go(p, 'training')
  const T = await p.evaluate(() => { const g = document.querySelector('.tp-grid-v113'), tiles = [...document.querySelectorAll('.tp-tile-v113')], pan = document.querySelector('#screen > .tp-panel-v113')
    const tops = tiles.slice(0, 4).map((t) => Math.round(t.getBoundingClientRect().top)), pr = pan && pan.getBoundingClientRect(), dock = document.getElementById('dock').getBoundingClientRect()
    return { perRow: tops.filter((t) => t === tops[0]).length, panelTop: pr ? Math.round(pr.top) : null, dockTop: Math.round(dock.top), gridScrolls: g ? g.scrollHeight > g.clientHeight : null } })
  ok(T.perRow === 3 && T.panelTop != null && T.panelTop < T.dockTop - 60, `${w}x${h}: training is three programs a row and the chosen program's panel is on screen`, T)
  // the pregame wizard
  await p.evaluate(async () => { window.go('season'); await new Promise((r) => setTimeout(r, 400)); try { window.playWeek(true) } catch (e) {} await new Promise((r) => setTimeout(r, 1400)) })
  const W = await audit(p, '#pregameV1513')
  ok(W.chars > 50 && W.under12 === 0, `${w}x${h}: the pregame wizard meets the floor`, { chars: W.chars, under13: W.under13, worst: W.worst })
  await ctx.close()
}

// the post-game card on a short phone: the floor, and Continue on screen
{
  const { ctx, p } = await open(375, 667, null, 'post')
  await p.evaluate(async () => { const S = window.S, t = S.player, a = t.weekResults.findIndex((n) => !n.played); t.currentWeek = a
    S._liveGame = window.__simGameV2(75, t.pos); S._oppName = t.weekResults[a].opp; window.go('live') })
  await p.waitForTimeout(3500); await p.evaluate(() => { try { window.skipLive() } catch (e) {} })
  let card = false; for (let i = 0; i < 40 && !card; i++) { await p.waitForTimeout(300); card = await p.evaluate(() => !!document.getElementById('pgOverlayV13')) }
  if (card) {
    await p.waitForTimeout(800)
    const A = await audit(p, '#pgOverlayV13')
    const B = await p.evaluate(() => { const b = [...document.querySelectorAll('#pgOverlayV13 .btn')].pop(), r = b && b.getBoundingClientRect(), t = document.querySelector('#pgOverlayV13 .decision-title')
      return { btn: r ? Math.round(r.bottom) : null, vh: innerHeight, titleLines: t ? Math.round(t.getBoundingClientRect().height / parseFloat(getComputedStyle(t).fontSize)) : null } })
    ok(A.under12 === 0, 'post-game: the card meets the floor', { chars: A.chars, worst: A.worst })
    ok(B.btn != null && B.btn <= B.vh && B.titleLines <= 2, 'post-game: Continue is on screen (it rides the bottom) and the scoreline is one line', B)
  } else ok(false, 'post-game: a live game reached the card')
  await ctx.close()
}

// the kill switch
{
  const { ctx, p } = await open(375, 667, { v169phone: 0 }, 'off')
  await go(p, 'season', 'sched')
  const K = await p.evaluate(() => ({ phone: document.documentElement.classList.contains('phone-v169'), lifted: document.querySelectorAll('[data-tf169]').length, ticker: getComputedStyle(document.getElementById('tickV146') || document.body).display }))
  ok(!K.phone && K.lifted === 0 && K.ticker !== 'none', 'TU v169phone 0: no phone classes, nothing lifted, the ticker stays', K)
  await ctx.close()
}

ok(errors.length === 0, 'no page errors', errors.slice(0, 4))
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
