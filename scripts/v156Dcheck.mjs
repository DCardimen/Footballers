// Dev check: v156 D — MY PLAYS ONLY, ON THE FIELD (src/07-career-app.js `v156 D MY PLAYS ONLY, ON THE FIELD`).
//   1. the box: #myPlaysV156D on the live field, top-right, right above the field — visible, in the field card's
//      right half, clear of the scorebug, the buff line, the speed row and the player strip — at 400x860 AND 1280x800
//   2. regular season: ticking it (a real click) saves `settings.myPlaysV156D`, and the live game from then on draws
//      only rows that name the you-player (`row.involved`, the engine log's truth) — checked against the live
//      playback's own log AND over the whole game log; unticking gives his side of the ball again (`playsSkipV153B`)
//   3. playoffs (a seeded playoff week and a championship): the box is disabled and says PLAYOFFS, a click does not
//      change the saved choice, the filter is exactly the side of the ball (skip-opponent included — a linebacker
//      never loses a defensive snap), and back in a regular-season week the saved choice is ticked again
//   4. Settings has the My plays only row (and the side-of-the-ball row), the coach points at the box
//   5. no Math.random() spent by the filter or the box; seeded games identical with the box on/off and v156D 0/1;
//      TU("v156D", 0) removes the box and restores the v153 B filter
//   6. no page errors
// Screenshots go to $SHOTS (default /tmp/claude-0/shots/).
//   node scripts/v156Dcheck.mjs        (GAME_URL=http://localhost:5531/)
import { chromium } from 'playwright'
import fs from 'node:fs'
import { CHROME, GAME_URL } from './lib/env.mjs'
const SHOTS = process.env.SHOTS || '/tmp/claude-0/shots/'
try { fs.mkdirSync(SHOTS, { recursive: true }) } catch {}
const browser = await chromium.launch({ executablePath: CHROME })
const ctx = await browser.newContext({ viewport: { width: 400, height: 860 } })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 4).join(' | ')))
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove() }, 60) })   // a fresh test player's first-week persona card
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const E = (fn, arg) => page.evaluate(fn, arg)
const wait = ms => page.waitForTimeout(ms)
const shot = async name => { try { await page.screenshot({ path: SHOTS + 'v156D-' + name + '.png' }) } catch {} }
const boot = async () => {
  await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 45000 }); await wait(1000)
  await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && window.__V156D && window.__GRIDIRON_AUDIT__, null, { timeout: 60000 })
  await wait(600)
}
await boot(); await page.goto(GAME_URL, { waitUntil: 'networkidle' }); await boot()   // warm past vite's one-time reload

// a seeded linebacker with a season in hand
const seed = (pos = 'LB') => E(pos => { const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true
  S.player = A.newPlayer(); S.player.name = 'Test Man'; S.player.pos = pos; S.player.level = 3; A.setState(S)
  try { window.startSeasonGames() } catch (e) {} document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove()
  window.S.view = 'season'; window.GridironStorage.save(window.S); return !!(window.S.player.weekResults && window.S.player.weekResults.length) }, pos)
// the live game for week `wk` (optionally a playoff / championship week), the way playWeek(true) builds it
const goLive = (wk, imp) => E(async ({ wk, imp }) => { const S = window.S, t = S.player; t.currentWeek = wk
  const w = t.weekResults[wk]
  if (imp) { w.playoff = true; w.opponentV11 = Object.assign({}, w.opponentV11 || {}, { importance: imp }) }
  // a JV linebacker can go a whole game without a snap that names him: take a game with a few of his plays in it
  // (a game is seeded by its week's perf, so try the season's other seeds for the one with the most of him)
  const mine = x => x.plays.filter(p => p.involved).length
  let g = window.__simGameV2(w.perf, t.pos)
  for (const o of t.weekResults) { if (mine(g) >= 4) break; const h = window.__simGameV2(o.perf, t.pos); if (mine(h) > mine(g)) g = h }
  S._liveGame = g; S._oppName = w.opp; window.go('live')
  for (let i = 0; i < 60 && !document.querySelector('.speed-row'); i++) await new Promise(r => setTimeout(r, 150))
  return !!document.querySelector('#myPlaysV156D') }, { wk, imp: imp || null })
const layout = () => E(() => { const R = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height } }
  const box = document.getElementById('myPlaysV156D'), cs = box && getComputedStyle(box)
  const o = { box: R('#myPlaysV156D'), field: R('.field-wrap canvas') || R('#field'), wrap: R('.field-wrap'), sb: R('.live-scoreboard'), buff: R('.live-buffline'), speed: R('.speed-row'), down: R('.live-down'),
    visible: !!(box && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.5), text: box ? box.textContent.replace(/\s+/g, ' ').trim() : '',
    fontPx: box ? parseFloat(getComputedStyle(box.querySelector('.mp156d-lbl')).fontSize) : 0, sw: document.scrollingElement.scrollWidth, iw: innerWidth }
  // what is actually on top at the box's centre (a veil or a loader over it would fail)
  if (o.box) { const el = document.elementFromPoint((o.box.l + o.box.r) / 2, (o.box.t + o.box.b) / 2); o.hit = !!(el && el.closest && el.closest('#myPlaysV156D')); o.hitBy = el ? (el.id || el.className || el.tagName) + '' : null }
  return o })
// the live game's loader (the "door") covers the card for its first seconds: wait for it to lift
const settled = async () => { let L; for (let i = 0; i < 40; i++) { L = await layout(); if (L.hit) break; await wait(500) } return L }
const over = (a, b) => !!(a && b && a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1)
const place = (L, tag) => {
  ok(L.box && L.visible && /MY PLAYS ONLY/.test(L.text) && L.fontPx >= 14, `${tag}: the MY PLAYS ONLY box is on the live field, visible, big type`, { text: L.text, font: L.fontPx })
  ok(L.box && L.field && L.box.b <= L.field.t + 1 && L.field.t - L.box.b < 30, `${tag}: it sits right above the field`, { boxBottom: L.box && L.box.b, fieldTop: L.field && L.field.t })
  ok(L.box && L.wrap && L.box.l > (L.wrap.l + L.wrap.r) / 2 && L.wrap.r - L.box.r < 24, `${tag}: on the right`, { l: L.box && L.box.l, r: L.box && L.box.r, wrap: L.wrap })
  ok(!over(L.box, L.sb) && !over(L.box, L.speed) && !over(L.box, L.buff) && !over(L.box, L.down) && !over(L.box, L.field), `${tag}: it covers none of the scorebug, the speed row, the buff line, the player strip or the field`)
  ok(L.sw <= L.iw + 1, `${tag}: no sideways page scroll`, { sw: L.sw, iw: L.iw })
}

// ================= 1. the box, at the phone and at 1280 =================
ok(await seed('LB'), 'a seeded linebacker with a season')
ok(await goLive(0), 'a regular-season live game draws the box')
let L = await settled(); place(L, '400x860'); ok(L.hit, '400x860: nothing sits over it (a tap reaches it)', L.hitBy)
await shot('400-regular')
await page.setViewportSize({ width: 1280, height: 800 }); await E(() => window.go('live'))
L = await settled(); place(L, '1280x800'); ok(L.hit, '1280x800: nothing sits over it', L.hitBy)
await shot('1280-regular')
await page.setViewportSize({ width: 400, height: 860 }); await E(() => window.go('live')); await wait(2500)

// ================= 2. regular season: tick → his plays only; untick → his side of the ball =================
const pre = await E(() => ({ pref: window.__V156D.pref(), side: !!window.S.settings.onlyInvolved, playoff: window.__V156D.playoff() }))
ok(!pre.pref && pre.side && !pre.playoff, 'a fresh save: the box unticked, the side of the ball on (v153 B), not a playoff week', pre)
const tickAt = await E(() => { const l = window.__V156D.log(); return l ? l.length : 0 })
await page.click('#myPlaysV156D')
await wait(200)
const ticked = await E(() => ({ pref: window.__V156D.pref(), active: window.__V156D.active(), checked: document.getElementById('myPlaysInputV156D').checked,
  on: document.getElementById('myPlaysV156D').classList.contains('on'), saved: /"myPlaysV156D":true/.test(localStorage.getItem('gridiron_save_v1') || JSON.stringify(window.GridironStorage.load ? window.GridironStorage.load() : '')),
  note: document.getElementById('myPlaysNoteV156D').textContent }))
ok(ticked.pref && ticked.active && ticked.checked && ticked.on && /ONLY THE SNAPS YOU/.test(ticked.note), 'a click ticks it: the choice is on, the box shows ✓, the line says only your snaps', ticked)
ok(ticked.saved, 'and it is in the save', ticked.saved)
await E(() => window.setSpeed(2))
// the live loader and the first plays take a while under load: wait until his first snap has been drawn
for (let i = 0; i < 180; i++) { const st = await E(at => { const l = (window.__V156D.log() || []).slice(at).filter(x => x.mine); return { n: l.length, drawn: l.filter(x => !x.skip).length } }, tickAt); if (st.n >= 10 && st.drawn >= 1) break; await wait(500) }
await shot('400-ticked')
const liveMine = await E(at => { const g = window.S._liveGame, l = (window.__V156D.log() || []).slice(at).filter(x => x.mine) /* rows judged after the tick landed */
  const drawn = l.filter(x => !x.skip), passed = l.filter(x => x.skip)
  return { n: l.length, drawn: drawn.length, passed: passed.length, allMine: drawn.every(x => g.plays[x.i] && g.plays[x.i].involved && x.mine),
    passedNotMine: passed.every(x => !(g.plays[x.i] && g.plays[x.i].involved)) } }, tickAt)
ok(liveMine.n > 5 && liveMine.passed > 0 && liveMine.allMine && liveMine.passedNotMine, 'the live game from the next play on: every play drawn names him, every play passed over does not', liveMine)
const whole = await E(() => { const g = window.S._liveGame, V = window.__V156D
  const shown = g.plays.filter(p => !V.skip(p)), inv = g.plays.filter(p => p.involved)
  return { total: g.plays.length, shown: shown.length, involved: inv.length, exact: shown.every(p => p.involved) && inv.every(p => !V.skip(p)) } })
ok(whole.exact && whole.shown === whole.involved && whole.involved > 0 && whole.shown < whole.total, 'over the whole engine log: shown == the plays that name him', whole)
// untick — on a fresh copy of the game (ticked, a game with few of his snaps runs to its whistle quickly)
await goLive(0); await settled()
const untickAt = await E(() => (window.__V156D.log() || []).length)
await page.click('#myPlaysV156D'); await wait(200)
const unticked = await E(() => { const g = window.S._liveGame, V = window.__V156D, B = window.__V153B
  return { pref: V.pref(), checked: document.getElementById('myPlaysInputV156D').checked, note: document.getElementById('myPlaysNoteV156D').textContent,
    side: g.plays.every(p => V.skip(p) === B.playsSkip(p)), oppSnaps: g.plays.filter(p => !V.skip(p) && !p.header && p.offense === 'them').length } })
ok(!unticked.pref && !unticked.checked && unticked.side && unticked.oppSnaps > 10 && /DEFENSE/.test(unticked.note), 'unticked: his side of the ball again (a linebacker sees every defensive snap)', unticked)
for (let i = 0; i < 120; i++) { const any = await E(at => { const g = window.S._liveGame; return (window.__V156D.log() || []).slice(at).some(x => !x.skip && !g.plays[x.i].involved) }, untickAt); if (any) break; await wait(500) }
const liveSide = await E(at => { const g = window.S._liveGame, B = window.__V153B, l = (window.__V156D.log() || []).slice(at).filter(x => !x.mine) /* rows judged after the untick landed */
  return { n: l.length, ok: l.every(x => x.skip === B.playsSkip(g.plays[x.i])), anyOther: l.some(x => !x.skip && !g.plays[x.i].involved) } }, untickAt)
ok(liveSide.n > 0 && liveSide.ok && liveSide.anyOther, 'and the live playback follows it from the next play (snaps without him are drawn again)', liveSide)

// ================= 3. playoffs and the championship =================
await E(() => { window.S.settings.myPlaysV156D = true; window.S.settings.skipOpp = true; window.GridironStorage.save(window.S) })
const saveBefore = await E(() => window.S.settings.myPlaysV156D)
for (const imp of ['playoff', 'championship']) {
  const wk = imp === 'playoff' ? 1 : 2
  await goLive(wk, imp); await wait(2500)
  const P = await E(() => { const inp = document.getElementById('myPlaysInputV156D'), box = document.getElementById('myPlaysV156D')
    return { playoff: window.__V156D.playoff(), active: window.__V156D.active(), disabled: !!(inp && inp.disabled), checked: !!(inp && inp.checked), locked: !!(box && box.classList.contains('locked')),
      note: (document.getElementById('myPlaysNoteV156D') || {}).textContent || '' } })
  ok(P.playoff && !P.active && P.disabled && !P.checked && P.locked && /PLAYOFFS/.test(P.note) && /SIDE/.test(P.note), `${imp}: the box is locked off and says PLAYOFFS · every snap on your side`, P)
  if (imp === 'playoff') { L = await settled(); place(L, '400x860 playoffs'); await shot('400-playoffs') }
  const logAt = await E(() => (window.__V156D.log() || []).length)
  await page.click('#myPlaysV156D', { force: true }); await wait(300)
  const still = await E(() => ({ pref: window.__V156D.pref(), disabled: document.getElementById('myPlaysInputV156D').disabled }))
  ok(still.pref === true && still.disabled, `${imp}: a tap does not change the saved choice`, still)
  const F = await E(() => { const g = window.S._liveGame, V = window.__V156D, B = window.__V153B
    return { side: g.plays.every(p => V.skip(p) === B.playsSkip(p)), defSkipped: g.plays.filter(p => V.skip(p) && !p.header && p.offense === 'them' && !/^(punt|kickoff|onside|fg|xp|kick)$/.test(p.event || '')).length,
      involvedSkipped: g.plays.filter(p => p.involved && V.skip(p)).length } })
  ok(F.side && F.defSkipped === 0 && F.involvedSkipped === 0, `${imp}: the filter is his side of the ball — skip-opponent and My Plays Only cannot hide a defensive snap`, F)
  for (let i = 0; i < 120 && (await E(at => (window.__V156D.log() || []).length - at, logAt)) < 3; i++) await wait(500)
  const LP = await E(at => { const g = window.S._liveGame, B = window.__V153B, l = (window.__V156D.log() || []).slice(at)
    return { n: l.length, ok: l.every(x => x.playoff && !x.mine && x.skip === B.playsSkip(g.plays[x.i])) } }, logAt)
  ok(LP.n > 0 && LP.ok, `${imp}: the live playback follows the side-of-the-ball rule`, LP)
}
// the championship with every skip setting off: every snap
const allOff = await E(() => { const s = window.S.settings, keep = [s.onlyInvolved, s.skipOpp, s.myPlaysV156D]; s.onlyInvolved = false; s.skipOpp = false; s.myPlaysV156D = false
  const g = window.S._liveGame, n = g.plays.filter(p => window.__V156D.skip(p)).length; [s.onlyInvolved, s.skipOpp, s.myPlaysV156D] = keep; return n })
ok(allOff === 0, 'playoffs with every skip setting off: every snap is drawn', allOff)
// back to the regular season: the saved choice is there, ticked
await goLive(3); await wait(1500)
const back = await E(() => ({ pref: window.__V156D.pref(), playoff: window.__V156D.playoff(), active: window.__V156D.active(), checked: document.getElementById('myPlaysInputV156D').checked, disabled: document.getElementById('myPlaysInputV156D').disabled }))
ok(saveBefore === true && back.pref && !back.playoff && back.active && back.checked && !back.disabled, 'a regular-season week after: the saved choice is restored, ticked and live', back)
await E(() => { window.S.settings.skipOpp = false })

// ================= 4. Settings + the coach =================
const set = await E(async () => { window.go('settings'); await new Promise(r => setTimeout(r, 400))
  const rows = [...document.querySelectorAll('.toggle-row')].map(r => ({ t: r.textContent.replace(/\s+/g, ' ').trim(), on: !!r.querySelector('.switch.on') }))
  const mine = rows.find(r => /^My plays only/i.test(r.t)), side = rows.find(r => /^Your side of the ball/i.test(r.t))
  const before = window.S.settings.myPlaysV156D; window.toggleSetting('myPlaysV156D'); const flipped = window.S.settings.myPlaysV156D !== before; window.toggleSetting('myPlaysV156D')
  return { mine: mine && mine.t.slice(0, 80), mineOn: mine && mine.on, side: side && side.t.slice(0, 80), flipped } })
ok(set.mine && set.mineOn && set.side && set.flipped, 'Settings: a My plays only row (on, it toggles) beside the side-of-the-ball row', set)
const coach = await E(async () => { const src = [...document.scripts].map(s => s.src).find(s => /rib-menu-coach\.js/.test(s)); let t = src ? await (await fetch(src)).text() : document.documentElement.innerHTML
  return /MY PLAYS ONLY box up top[^\n]*s: 'myPlays'/.test(t) && /myPlays: '#myPlaysV156D'/.test(t) })
ok(coach, 'the coach points at the box at the first broadcast')

// ================= 5. no randomness; seeded games identical; the kill switch =================
const rnd = await E(() => { const g = window.S._liveGame, V = window.__V156D, R = Math.random; let n = 0; Math.random = function () { n++; return R() }
  try { for (let k = 0; k < 3; k++) { g.plays.forEach(p => V.skip(p)); V.note(); V.playoff() } window.S.player.currentWeek = 3; V.toggle(true); V.toggle(false); V.toggle(true) } finally { Math.random = R }
  return n })
ok(rnd === 0, 'the filter and the box spend no Math.random()', rnd)
const same = await E(() => { const t = window.S.player, w = t.weekResults[4], T = window.RIB_TUNE, R = Math.random
  const run = (on, v) => { const P = JSON.parse(JSON.stringify(t)); window.S.settings.myPlaysV156D = on; if (v != null) T.v156D = v; else delete T.v156D
    let s = 12345; Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    try { const g = window.__simGameV2(w.perf, t.pos); return JSON.stringify([g.plays.map(p => [p.desc, p.usScore, p.themScore, !!p.involved]), g.box || g.stats || null]) } finally { Math.random = R; window.S.player = Object.assign(window.S.player, P) } }
  const a = run(false), b = run(true), c = run(true, 0); window.S.settings.myPlaysV156D = true
  return { ab: a === b, ac: a === c, len: a.length } })
ok(same.ab && same.ac && same.len > 1000, 'seeded games are identical with the box on or off and with v156D 0/1', same)
const kill = await E(async () => { const T = window.RIB_TUNE; T.v156D = 0; window.go('live'); await new Promise(r => setTimeout(r, 1200))
  const g = window.S._liveGame, B = window.__V153B
  const out = { box: !!document.getElementById('myPlaysV156D') }
  window.go('settings'); await new Promise(r => setTimeout(r, 300))
  out.row = [...document.querySelectorAll('.toggle-row')].some(r => /^My plays only.*MY PLAYS ONLY box/i.test(r.textContent.replace(/\s+/g, ' ').trim()))
  delete T.v156D; window.go('live'); await new Promise(r => setTimeout(r, 1200)); out.back = !!document.getElementById('myPlaysV156D'); return out })
ok(!kill.box && !kill.row && kill.back, 'TU("v156D", 0): no box, no Settings row; back on, the box returns', kill)

// ================= 6. errors =================
await E(() => window.go('menu')); await wait(500)
ok(errs.length === 0, 'no page errors', errs.slice(0, 4))
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
