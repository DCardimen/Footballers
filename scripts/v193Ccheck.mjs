// Dev check: v193 C THE BUGS THE PASS FOUND (src/05-field-renderer.js, src/04-engine.js, src/07-career-app.js, src/24-bottom-nav.js).
//   A. the skin: on a kit whose SECOND colour is a skin-like tone, no skin pixel of a registered cell reads as p2
//      (every mask pixel is the drawn cell's), a deco that paints the gold band cannot overpaint it (deco first, the
//      skin last), a cell with under six skin pixels still gets its skin back, and the widened highlight window is
//      live (v193C off: the warm highlights beside the skin recolour to p2); the sideline backups draw those textures
//   B. the live watch: the down bar says KICKOFF / PAT / 2-PT TRY / "& GOAL" (the helper, and the sim's own rows);
//      endLive with no player does not throw; warnOnce counts per distinct message and warns once; the engine's
//      featured-player block survives a non-numeric attribute (finite frames, no error counted) and reports a failure
//   C. navigation: the bottom nav hides on tier / club and lights HUB / TREE / MENU per the table; entering `tier`
//      saves (a reload returns to it, chooseTier still works); rank's Back goes to the hub; a fresh save's menu
//      draws the Prestige Tree button; a settled-and-won career cannot sit in the hub (sealed to `win`, continueNFL
//      reopens it)
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v193Ccheck.mjs
import fs from 'node:fs'
import { gameUrl, launch } from './lib/env.mjs'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = [], warns = []
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'warn') warns.push(m.text()) })
await page.addInitScript(() => { setInterval(() => { for (const s of ['.onboard', '#personaV13', '#growthV42', '#gv139gate']) document.querySelector(s)?.remove() }, 80) })
const boot = async () => {
  await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V193C && !!window.__V193C.app && !!window.__NAV_V139 && !!window.__V91 && window.__V91.loaded, null, { timeout: 60000 })
  await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  await page.evaluate(() => document.getElementById('splash')?.remove())
  await page.waitForTimeout(400)
}
await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 })
await boot()
const M = (fn, arg) => page.evaluate(fn, arg)
// a career to stand on: a fresh state, a player at `level`
const setup = (o) => M((o) => {
  const X = window.__GRIDIRON_AUDIT__, S = X.freshState(); X.setState(S); S.tutorialSeen = true
  S.pp = o.pp || 0; S.tree = o.tree || {}
  if (o.noPlayer) { S.player = null; return true }
  S.player = X.newPlayer(); const p = S.player
  p.pos = 'RB'; p.level = o.level != null ? o.level : 2; p.totalSeasons = o.seasons || 3; p.personaV13 = { loyalty: 5 }; p.traits = []
  Object.assign(p, o.player || {})
  return true
}, o)

// ================= A. the skin =================
const SK = await M(() => {
  const V = window.__V193C, API = window.__V151D_SKIN_API
  const px = (im) => { const c = document.createElement('canvas'); c.width = 48; c.height = 48; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, 48, 48).data }
  const d = (a, b, i) => Math.abs(a[i * 4] - b[i * 4]) + Math.abs(a[i * 4 + 1] - b[i * 4 + 1]) + Math.abs(a[i * 4 + 2] - b[i * 4 + 2])
  const P1 = '#1a2a5a', P2 = '#e8bc97'   // the second colour: a skin-like tone, so a skin pixel painted p2 fools the eye and not the mask
  const hsl = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2, sat = mx ? (mx - mn) / mx : 0; let h = 0; if (mx !== mn) { if (mx === r) h = (60 * ((g - b) / (mx - mn)) + 360) % 360; else if (mx === g) h = 60 * ((b - r) / (mx - mn)) + 120; else h = 60 * ((r - g) / (mx - mn)) + 240 } return { h, sat, L } }
  // a deco like the cosmetics' kitDeco: every pixel the RAW art classes as the gold band (hue 33-62) painted, over whatever is there
  const deco = (cv, src, band, raw) => {
    const c = cv.getContext('2d'), a = c.getImageData(0, 0, 48, 48), r = raw.getContext('2d').getImageData(0, 0, 48, 48).data
    for (let i = 0; i < 2304; i++) { if (r[i * 4 + 3] < 20) continue
      const { h, sat, L } = hsl(r[i * 4], r[i * 4 + 1], r[i * 4 + 2])
      if (L >= 38 && h >= 33 && h <= 62 && sat > .3 && L > 60) { a.data[i * 4] = 255; a.data[i * 4 + 1] = 0; a.data[i * 4 + 2] = 255 } }
    c.putImageData(a, 0, 0); return cv
  }
  const cells = ['idle_dn', 'idle_sd', 'idle_up', 'run_dn3', 'run_sd0', 'catch_dn0', 'celebrate_dn1', 'getup_dn3', 'plant_sd', 'stance3_up', 'handoff_up1', 'handoffL_up1']
  const R = { cells: 0, skinPx: 0, skinDiff: 0, decoDiff: 0, decoPainted: 0, hiPx: 0, off: { hiLost: 0, skinInP2: 0, cells: 0 }, p2: P2, floor: {} }
  for (const n of cells) {
    const cell = API.cell(n); if (!cell) continue
    const raw = px(cell), m = V.mask(cell); if (!m) continue
    const on = V.kitCell(n, P1, P2, null), onD = V.kitCell(n, P1, P2, deco), rec = px(V.recolor(cell, P1, P2))
    const a = px(on.cv), b = px(onD.cv)
    R.cells++
    for (let i = 0; i < 2304; i++) {
      if (m.mask[i]) { R.skinPx++; if (d(a, raw, i) > 3) R.skinDiff++; if (d(b, raw, i) > 3) R.decoDiff++; const c = hsl(raw[i * 4], raw[i * 4 + 1], raw[i * 4 + 2]); if (c.h >= 31 && c.h < 46) R.hiPx++ }
      else if (raw[i * 4 + 3] > 24 && d(b, rec, i) > 3) R.decoPainted++   // the deco did paint the kit (the test deco is live)
    }
  }
  // the floor: a cell with only three skin pixels left (the rest painted outline-dark, which no recolour touches)
  const few = (() => {
    const cell = API.cell('idle_dn'), m = V.mask(cell), c = document.createElement('canvas'); c.width = 48; c.height = 48
    const x = c.getContext('2d'); x.drawImage(cell, 0, 0); const img = x.getImageData(0, 0, 48, 48), o = img.data
    let kept = 0; for (let i = 0; i < 2304; i++) { if (o[i * 4 + 3] <= 24) continue
      const { h, sat } = hsl(o[i * 4], o[i * 4 + 1], o[i * 4 + 2]); if (!(sat > .3 && h >= 8 && h < 46)) continue   // every warm pixel but three goes outline-dark
      if (m.mask[i] && kept < 3) { kept++; continue } o[i * 4] = 20; o[i * 4 + 1] = 20; o[i * 4 + 2] = 22 }
    x.putImageData(img, 0, 0); return c
  })()
  { const raw = px(few), m = V.mask(few), out = V.kitCell(few, P1, P2, null), a = px(out.cv); let diff = 0; for (let i = 0; i < 2304; i++) if (m.mask[i] && d(a, raw, i) > 3) diff++
    R.floor.on = { n: m.n, restored: !!out.sk151, diff } }
  // OFF: a fresh copy of each cell (the mask cache is per canvas) under TU v193C 0 — the old mask, the old floor, the old order
  window.RIB_TUNE = window.RIB_TUNE || {}; window.RIB_TUNE.v193C = 0
  try {
    for (const n of cells) {
      const cell = API.cell(n); if (!cell) continue
      const copy = document.createElement('canvas'); copy.width = 48; copy.height = 48; copy.getContext('2d').drawImage(cell, 0, 0)
      const mOn = V.mask(cell), mOff = V.mask(copy), out = V.kitCell(copy, P1, P2, null), o = px(out.cv), raw = px(cell)
      R.off.cells++
      for (let i = 0; i < 2304; i++) if (mOn.mask[i] && !mOff.mask[i]) { R.off.hiLost++; if (d(o, raw, i) > 3) R.off.skinInP2++ }
    }
    const copy = document.createElement('canvas'); copy.width = 48; copy.height = 48; copy.getContext('2d').drawImage(few, 0, 0)
    const raw = px(few), m = V.mask(copy), out = V.kitCell(copy, P1, P2, null), a = px(out.cv); let diff = 0; for (let i = 0; i < 2304; i++) if (m.mask[i] && d(a, raw, i) > 3) diff++
    R.floor.off = { n: m.n, restored: !!out.sk151, diff }
  } finally { delete window.RIB_TUNE.v193C }
  return R
})
console.log('skin:', JSON.stringify(SK))
ok(SK.cells >= 10 && SK.skinPx > 300, 'sampled the skin on the registered kit cells, the second colour a skin-like tone', `${SK.cells} cells, ${SK.skinPx} skin px, p2 ${SK.p2}`)
ok(SK.skinDiff === 0, 'no skin pixel of a kit cell reads as the kit\'s second colour — every mask pixel is the drawn cell\'s', `${SK.skinDiff}/${SK.skinPx} differ`)
ok(SK.decoPainted > 100 && SK.decoDiff === 0, 'a deco that paints the gold band paints the kit, never restored skin (the deco first, the skin last)', `deco painted ${SK.decoPainted} kit px, ${SK.decoDiff} skin px`)
ok(SK.floor.on && SK.floor.on.n > 0 && SK.floor.on.n < 6 && SK.floor.on.restored && SK.floor.on.diff === 0 && SK.floor.off && !SK.floor.off.restored, 'a cell with under six skin pixels still gets its skin back (the floor is 1; v193C off: the old floor of 6 drops it)', JSON.stringify(SK.floor))
ok(SK.hiPx > 20 && SK.off.hiLost > 0 && SK.off.skinInP2 > 0, 'the widened window is live: the warm highlights beside the skin are in the mask, and with v193C off they recolour to p2', `${SK.hiPx} highlight px in the mask; OFF loses ${SK.off.hiLost}, ${SK.off.skinInP2} of them painted p2`)
const src05 = fs.readFileSync(new URL('../src/05-field-renderer.js', import.meta.url), 'utf8')
ok(/sidePlayer\(team, u, vv, o\) \{[\s\S]{0,200}"spr_" \+ team \+ "_" \+ dir \+ "_idle"/.test(src05) && /const built = kitCellV193C\(cell0, srcName, p1, p2, deco/.test(src05), 'the sideline backups draw the registered idle textures, which are built through kitCellV193C (the restore)')

// ================= B. the live watch =================
const L = await M(() => {
  const f = window.__V193C.app.label
  return {
    ko: f({ event: 'kickoff', down: 1, toGo: 10, preDown: 1, preToGo: 10, startBall: 35 }),
    xp: f({ event: 'xp', preDown: 1, preToGo: 3, startBall: 97 }),
    tp: f({ event: 'twopt', preDown: 1, preToGo: 3, startBall: 97 }),
    goal: f({ event: 'pass', preDown: 2, preToGo: 7, startBall: 93 }),
    goal2: f({ event: 'run', preDown: 1, preToGo: 10, startBall: 92 }),
    plain: f({ event: 'run', preDown: 3, preToGo: 4, startBall: 40 }),
    plain2: f({ event: 'pass', preDown: 1, preToGo: 10, startBall: 85 }),
    fourth: f({ event: 'punt', preDown: 4, preToGo: 12, startBall: 30 })
  }
})
ok(L.ko === 'KICKOFF' && L.xp === 'PAT' && L.tp === '2-PT TRY', 'the down bar says KICKOFF / PAT / 2-PT TRY on those plays', L)
ok(L.goal === '2nd & GOAL' && L.goal2 === '1st & GOAL' && L.plain === '3rd & 4' && L.plain2 === '1st & 10' && L.fourth === '4th & 12', 'and "& GOAL" once the line to gain is the goal line, the plain down and distance otherwise', L)
const LR = await M(() => {
  const f = window.__V193C.app.label, plays = [], out = { rows: 0, ko: [], tries: [], goalBad: 0, goalOk: 0, tenAtOwn: 0 }
  for (let g = 0; g < 4; g++) plays.push(...window.__simGameV2(55 + g * 5, ['QB', 'RB', 'WR', 'LB'][g]).plays)   // a few games: not every game logs a kickoff row
  out.rows = plays.length
  for (const t of plays) {
    if (t.header || /^(drive|timeout|warning|period|toss|penalty)$/.test(t.event)) continue
    const l = f(t)
    if (t.event === 'kickoff') { out.ko.push(l); continue }
    if (t.event === 'xp' || t.event === 'twopt') { out.tries.push(l); continue }
    const toGo = t.preToGo || t.toGo, goal = /& GOAL$/.test(l)
    if (goal !== (toGo >= 100 - t.startBall)) out.goalBad++; else if (goal) out.goalOk++
    if (/^1st & 10$/.test(l) && t.startBall < 50) out.tenAtOwn++
  }
  return out
})
ok(LR.ko.length > 0 && LR.ko.every(l => l === 'KICKOFF') && LR.tries.every(l => l === 'PAT' || l === '2-PT TRY'), 'on the sim\'s own rows every kickoff reads KICKOFF and every try PAT / 2-PT TRY — never "1st & 10"', `${LR.ko.length} kickoffs, ${LR.tries.length} tries over ${LR.rows} rows`)
ok(LR.goalBad === 0 && LR.tenAtOwn > 0, 'and & GOAL is said exactly when the to-go reaches the end zone', `${LR.goalOk} goal-to-go rows, ${LR.goalBad} wrong, ${LR.tenAtOwn} plain 1st & 10s`)
const EL = await M(() => { const X = window.__GRIDIRON_AUDIT__, S = X.freshState(); X.setState(S); S.player = null; try { window.__V193C.app.endLive(); return { threw: null, view: S.view } } catch (e) { return { threw: String(e && e.message || e) } } })
ok(EL.threw === null, 'endLive with the career gone does not throw', EL)
const W = await M(() => { const V = window.__V193C, n0 = V.n; V.warn('probe', new Error('INJECTED probe')); V.warn('probe', new Error('INJECTED probe')); V.warn('probe', new Error('INJECTED other')); return { n: V.n - n0, a: V.errs['probe: INJECTED probe'], b: V.errs['probe: INJECTED other'] } })
await page.waitForTimeout(100)
const probeWarns = warns.filter(w => /\[v193 C\] probe: INJECTED probe/.test(w)).length
ok(W.n === 3 && W.a === 2 && W.b === 1 && probeWarns === 1, 'warnOnce counts every throw per distinct message and warns the console once each', { ...W, consoleWarns: probeWarns })
await setup({ level: 4 })
const FE = await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), p = S.player
  const F = window.__FieldSim, e0 = F.featuredErrsV193C || 0, V = window.__V193C, k0 = Object.keys(V.errs).length
  const dims = { PLAY_L: 66, PLAY_R: 654, F_TOP: 14, F_BOT: 426 }
  const rows = []; for (let g = 0; g < 4 && rows.length < 12; g++) for (const t of window.__simGameV2(60 + g * 5, 'RB').plays) if (!t.header && t.involved && !/^(xp|twopt|kickoff|punt|fg)$/.test(t.event)) rows.push(t)
  const out = { built: 0, nonFinite: 0, errs: 0, involved: rows.length, rows: [] }
  p.attrs.speed = 'fast'; p.attrs.agility = undefined; p.attrs.acceleration = NaN   // the attributes a bad save could carry — read by the featured block as the plays are built (the sim already ran on sane ones)
  for (const t of rows) {
    let s; try { s = window.buildPlayScript(Object.assign({}, t, { playerPos: 'RB' }), { dims, rand: Math.random }) } catch (e) { out.errs++; continue }
    out.built++; if (out.rows.length < 3) out.rows.push(t)
    for (const a of s.actors) for (const f of a.frames) if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) { out.nonFinite++; break }
    if (out.built >= 12) break
  }
  out.counted = (F.featuredErrsV193C || 0) - e0; out.newKeys = Object.keys(V.errs).length - k0
  // and when the block DOES fail (the attributes unreadable), the failure is visible: counted, warned once
  const row = out.rows[0]
  if (row) {
    const desc = Object.getOwnPropertyDescriptor(p, 'attrs'), attrs = p.attrs
    Object.defineProperty(p, 'attrs', { configurable: true, get () { throw new Error('INJECTED attrs') } })
    try { for (let i = 0; i < 2; i++) window.buildPlayScript(Object.assign({}, row, { playerPos: 'RB' }), { dims, rand: Math.random }) } catch (e) { out.injThrew = String(e) } finally { if (desc) Object.defineProperty(p, 'attrs', desc); else { delete p.attrs; p.attrs = attrs } }
    out.injCounted = (F.featuredErrsV193C || 0) - e0 - out.counted
    out.injKeys = Object.keys(V.errs).filter(k => /featured attrs: INJECTED attrs/.test(k)).map(k => V.errs[k])
  }
  delete out.rows
  return out
})
ok(FE.built >= 5 && FE.nonFinite === 0 && FE.errs === 0 && FE.counted === 0 && FE.newKeys === 0, 'the engine\'s featured-player block survives a non-numeric attribute: finite frames, nothing counted as an error', FE)
ok(FE.injCounted === 2 && FE.injKeys && FE.injKeys[0] === 2 && !FE.injThrew, 'and when the block does fail the failure is visible: counted on __FieldSim and warned once per message', { counted: FE.injCounted, keys: FE.injKeys, threw: FE.injThrew })
await page.waitForTimeout(100)
ok(warns.filter(w => /\[v193 C\] featured attrs: INJECTED attrs/.test(w)).length === 1, 'the console carries that warning once', warns.filter(w => /featured attrs/.test(w)).length)

// ================= C. navigation =================
await setup({ level: 4 })
const NAVT = await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), N = window.__NAV_V139
  window.go('hub')
  document.body.classList.remove('rib-menu-open'); document.getElementById('rib-main-menu-v2')?.remove()   // the baked menu's overlay stays up over a programmatic go(); the bar hides under it by design
  const lit = () => { N.sync(); const b = N.bar(); const on = !!(b && b.classList.contains('on')); const tabs = b ? [...b.children].filter(x => x.classList.contains('on')).map(x => x.dataset.k) : []; return { on, tabs } }
  const R = {}
  for (const v of ['hub', 'rank', 'stats', 'hof', 'profile', 'life', 'daily', 'seasons', 'shop', 'dynasty', 'path', 'locker', 'settings', 'highscore', 'leaderboard', 'season', 'upgrade', 'tier', 'club', 'menu', 'win']) { S.view = v; R[v] = lit() }
  S.view = 'hub'; N.sync()
  return R
})
const want = { hub: 'hub', rank: 'hub', stats: 'hub', hof: 'hub', profile: 'hub', life: 'hub', daily: 'hub', seasons: 'hub', shop: 'shop', dynasty: 'shop', path: 'shop', locker: 'shop', settings: 'menu', highscore: 'menu', leaderboard: 'menu', season: 'season', upgrade: 'upgrade' }
const badLit = Object.entries(want).filter(([v, k]) => !(NAVT[v] && NAVT[v].on && NAVT[v].tabs.length === 1 && NAVT[v].tabs[0] === k)).map(([v]) => v + '=' + JSON.stringify(NAVT[v]))
ok(badLit.length === 0, 'the bottom nav lights HUB for rank/stats/hof/profile/life/daily/seasons, TREE for shop/dynasty/path/locker, MENU for settings/highscore/leaderboard', badLit.length ? badLit.join(' ') : Object.keys(want).length + ' views')
ok(['tier', 'club', 'menu', 'win'].every(v => NAVT[v] && !NAVT[v].on), 'and hides on tier and club (as on the menu and the win screen)', ['tier', 'club', 'menu', 'win'].map(v => v + ':' + (NAVT[v] && NAVT[v].on)).join(' '))
// entering `tier` saves: a reload returns to the choice, and chooseTier still works
await setup({ level: 3 })
const T0 = await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), p = S.player
  p.tiers = {}; p.seasonsAtLevel = 2; p.career = p.career || []
  try { X.advance() } catch (e) { return { threw: String(e && e.stack || e) } }   // → level 4 (varsity, a tiered level) → goView('tier')
  return { view: S.view, level: p.level, cards: document.querySelectorAll('.pos-card[onclick^="chooseTier"]').length, nav: !!(window.__NAV_V139.bar() && window.__NAV_V139.bar().classList.contains('on')) }
})
ok(T0.view === 'tier' && T0.level === 4 && T0.cards >= 2, 'advancing to a tiered level lands on the program choice', T0)
await page.reload({ waitUntil: 'networkidle', timeout: 60000 })
await boot()
const T1 = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState()
  const before = { view: S.view, cards: document.querySelectorAll('.pos-card[onclick^="chooseTier"]').length }
  const card = document.querySelector('.pos-card[onclick^="chooseTier"]'); card && card.click()
  return { before, after: S.view, tier: S.player && S.player.tiers && S.player.tiers.varsity }
})
ok(T1.before.view === 'tier' && T1.before.cards >= 2, 'a reload returns to the tier choice (entering it saved)', T1.before)
ok(T1.after === 'hub' && !!T1.tier, 'and chooseTier still works after the reload', { view: T1.after, tier: T1.tier })
// rank's Back
await setup({ level: 4 })
const RK = await M(() => { window.go('rank'); const b = [...document.querySelectorAll('#dock button')].find(x => /Back/.test(x.textContent)); return { onclick: b ? b.getAttribute('onclick') : null, view: window.__GRIDIRON_AUDIT__.getState().view } })
ok(RK.onclick === "go('hub')", 'rank\'s Back goes to the hub, one branch', RK)
// the fresh save's menu
await setup({ noPlayer: true, pp: 0 })
const PM = await M(() => {
  window.go('menu')
  const app = document.getElementById('app'), els = [...app.querySelectorAll('button, a, [onclick], [role="button"]')].filter(el => !el.dataset.ribBridge && !el.closest('#rib-main-menu-v2'))
  const b = els.find(el => /PRESTIGE/i.test((el.textContent || '').replace(/\s+/g, ' ')))
  return { found: !!b, text: b ? b.textContent.trim() : null, onclick: b ? b.getAttribute('onclick') : null, pp: window.__GRIDIRON_AUDIT__.getState().pp }
})
ok(PM.found && /Prestige Tree/.test(PM.text) && PM.onclick === "go('shop')", 'a fresh save (0 PP, no tree) still draws the Prestige Tree button — the baked menu\'s PRESTIGE tile has a target', PM)
// the Hall's Back after a win
await setup({ level: 7, seasons: 9, player: { _settled: true, _wonShown: true, titles: 1, career: [{ level: 'College', ovr: 80, age: 22 }] } })
const WN = await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), p = S.player
  const seq = []
  window.go('hof'); seq.push(S.view)
  window.go('menu'); seq.push(S.view)
  window.go('hub'); seq.push(S.view)
  const sealed = window.__V192B.sealed(p)
  const dock = document.getElementById('dock'), keep = dock && [...dock.querySelectorAll('button')].find(b => /Keep Playing/.test(b.textContent))
  keep && keep.click()
  const after = { view: S.view, settled: p._settled, arrived: !!p._arrivedV154, keepBtn: !!keep }
  window.go('hub')
  return { seq, sealed, after, hubAgain: S.view, player: !!S.player }
})
ok(WN.seq[2] === 'win' && WN.sealed === 'win', 'a settled-and-won career cannot sit in the hub: win → Hall → menu → CONTINUE lands back on the win screen', WN.seq)
ok(WN.after.view === 'hub' && WN.after.settled === false && WN.after.arrived && WN.hubAgain === 'hub' && WN.player, 'and "Keep Playing UFF Seasons" (continueNFL) reopens it: the hub is his again', WN.after)
// the skin chooser on the position screen
await setup({ level: 0 })
const SC = await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState()
  window.go('choosePos')
  const row = document.querySelector('.skin-row-v193c'), sw = row ? [...row.querySelectorAll('.skin-sw-v193c')] : []
  const before = { swatches: sw.length, on: sw.findIndex(b => b.classList.contains('on')) }
  sw[5] && sw[5].click()
  const sw2 = [...document.querySelectorAll('.skin-row-v193c .skin-sw-v193c')]
  return { before, after: { tone: S.player.skinTone, on: sw2.findIndex(b => b.classList.contains('on')) }, live: window.__skinToneV151D({ skinTone: S.player.skinTone, name: S.player.name }) }
})
ok(SC.before.swatches === 8 && SC.before.on >= 0 && SC.after.tone === 5 && SC.after.on === 5 && SC.live === 5, 'the position screen carries eight skin swatches, the current one ringed; a tap sets player.skinTone and the live field reads it', SC)

await browser.close()
const E = errs.filter(e => !/INJECTED/.test(e))
E.forEach(e => console.log('FAIL ' + e))
console.log(JSON.stringify({ pass, fail, pageErrors: E.length }))
process.exit(fail || E.length ? 1 : 0)
