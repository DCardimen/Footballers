// Dev check: v193 E THE ECONOMY, THE CHAOS CARD, AND HOW THE SCOUTS DECIDE (src/07-career-app.js).
//   1. `perfFlat` is gone: perfPct is 0 with every old game-day node maxed, the accessor / rollGamePerf / mr carry no
//      term, each repurposed node's new fx reaches treeFx, the paycheck reads payMultV179 through treeFx, and an old
//      Conditioning piece migrates to Growth (value rescaled).
//   2. SPEND NOW on the tree screen lists the cheapest affordable nodes (ascending, one-tap vaultBuy), or the cheapest
//      node and how far away when nothing is; the hub counts the affordable upgrades; Water Boys exists (6 PP ×1.025,
//      coachStart 0.25 a level) and `v193Esink` 0 hides it; Team Dinners is 10 PP ×1.03.
//   3. The chaos card shows WHAT IT COSTS / WHAT IT PAYS with the live numbers and the projection line; the stale
//      "+10% per level, per stat" is gone; the chaos growth bump reaches the growth projection; `v193Echaos` 0 removes it.
//   4. HOW THE SCOUTS DECIDE opens from the hub, the Recruiting Board and the potential card with the player's numbers;
//      a top-1% rank rolls at ≥ 99 and ≤ 99.5, top 5% ≥ 95; `v193Erank` 0 restores the curve.
//   Fits at 360×780. No page errors.  GAME_URL=http://localhost:5173/ node scripts/v193Echeck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } })
await ctx.addInitScript(() => {
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, {})
  try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off'); localStorage.setItem('rib.coachChaos.v153', '{"chaosLocked":1,"chaosOpen":1}') } catch {}
  setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80)
})
const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(String(e.message || e)))
await page.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V193E && !!window.__V190 && !!window.__V88, null, { timeout: 40000 })
await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
await page.evaluate(() => document.getElementById('splash')?.remove())
const M = (fn, arg) => page.evaluate(fn, arg)
const seed = (o = {}) => M((o) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; S.tree = o.tree || {}; A.setState(S)
  S.player = A.newPlayer(); const p = S.player; p.name = 'Node Man'; p.pos = o.pos || 'RB'; p.age = 14; p.originV11 = 'walk-on'; p._wonShown = true
  p.level = o.level != null ? o.level : 3; p.training = 'balanced'; p.points = 0; p.traits = []; A.startSeasonGames()
  window.go('season'); window.GridironStorage.save(S)
  return { weeks: p.weekResults.length }
}, o)
const OLD = { engine: 6, zen: 5, trashTalk: 5, legendAura: 4, etForm: 50, oline_wall: 5, glassCannon: 5 }

// ---------------- 1. perfFlat is gone ----------------
await seed({ level: 3 })
const P1 = await M((OLD) => {
  const S = window.__GRIDIRON_AUDIT__.getState(), V = window.__V193E, V0 = window.__V190, p = S.player
  const snap = JSON.stringify(p)
  for (const k in p.attrs) p.attrs[k] = 52; p.coachTrust = 75
  const avg = () => { let t = 0; const N = 600; for (let i = 0; i < N; i++) t += V0.roll(p, {}).perf; return t / N }
  S.tree = {}; const p0 = V.perfPct(), q0 = V0.perfPct(), a0 = avg()
  S.tree = Object.assign({}, OLD); const p1 = V.perfPct(), q1 = V0.perfPct(), flat = V.fx('perfFlat'), a1 = avg()
  const fx = { eGrowth: V.fx('eGrowth'), varDown: V.fx('varDown'), ppMult: V.fx('ppMult'), advFlat: V.fx('advFlat'), pay: V.fx('payMultV179'), injDown: V.fx('injDown'), injUp: V.fx('injUp') }
  S.tree = {}; S.player = JSON.parse(snap)
  return { p0, q0, p1, q1, flat, a0, a1, fx }
}, OLD)
ok(P1.p0 === 0 && P1.p1 === 0 && P1.q0 === 0 && P1.q1 === 0 && P1.flat === 0, 'perfPct is 0 with every old game-day node maxed, and treeFx("perfFlat") is 0', P1)
ok(Math.abs(P1.a1 - P1.a0) < 3.5, 'the simmed game (rollGamePerf) gains nothing from the old nodes', { a0: +P1.a0.toFixed(2), a1: +P1.a1.toFixed(2) })
const F = P1.fx, near = (a, b) => Math.abs(a - b) < 1e-6
ok(near(F.eGrowth, 0.24) && near(F.varDown, 0.5) && near(F.ppMult, 0.15) && near(F.advFlat, 12), 'the repurposed nodes reach treeFx: Twin Engines eGrowth 0.24, Zen + Aura varDown 0.5, Trash Talk ppMult 0.15, Aura advFlat 12', F)
ok(near(F.pay, 0.8) && near(F.injDown, 0.4) && near(F.injUp, 0.9), 'Eternal Form ×50 + Glass Cannon ×5 = payMultV179 0.8; The Wall injDown 0.4; Glass Cannon injUp 0.9', F)
const SRC = await M(async () => { const r = await fetch('src/07-career-app.js'); return await r.text() })
const rawBlock = SRC.slice(SRC.indexOf('v111: the focus is a multiplier'), SRC.indexOf('v111: the focus is a multiplier') + 700)
ok(!/perfPctV190|treeFx\(\s*"perfFlat"\s*\)/.test(rawBlock) && /gearAttrV147\(k\)/.test(rawBlock), 'the game accessor (_raw) carries no tree game-day term (the personality nudge and the gear stay)')
ok(!/playerPower\(e\)\s*\*\s*\(1\s*\+\s*perfPctV190/.test(SRC) && /xi\(\(e - a\) \* 2\.4 \+ 50\), 1, 100\)/.test(SRC), 'rollGamePerf and mr carry no term')
ok(/\(1 \+ treeFx\(\s*"payMultV179"\s*\)\)/.test(SRC) && !/medalFxV179\(\s*"payMultV179"\s*\)\s*\)\s*\*\s*TU\("betaPay/.test(SRC), 'the paycheck reads payMultV179 through treeFx (the medal inside it, Eternal Form and Glass Cannon beside it)')
ok(!/key:\s*"perfFlat",\s*name:\s*"Conditioning"/.test(SRC) && !/perfFlat:\s*3,|perfFlat:\s*70,/.test(SRC), 'Conditioning is out of GEAR_EFFECTS and perfFlat out of prestigeCap')

// the Conditioning piece migrates
const G = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), V = window.__V147C
  const it = { id: 'cond_1', slot: 'cleats', rarity: 'rare', name: 'Custom Cleats', eff: 'perfFlat', val: 1.36, icon: '👟', modsV147: 1, mods: [] }
  S.inventory = [it]; S.equipped = { cleats: it }
  const n = V.migrate()
  window.go('locker')
  const txt = document.getElementById('screen').textContent
  const attr = V.attr('speed')
  S.inventory = []; S.equipped = {}
  return { eff: it.eff, val: it.val, tag: it.migratedV193E, n, hasAll: /to ALL stats/.test(txt), growth: /growth/i.test(txt), attr }
})
ok(G.eff === 'growth' && Math.abs(G.val - 0.051) < 1e-6 && G.tag === 'perfFlat' && G.n >= 1, 'an old Conditioning piece migrates to Growth (1.36 / 0.8 × 0.03 = 0.051)', G)
ok(!G.hasAll && G.attr === 0, 'the locker never says "to ALL stats" and gearAttrV147 adds no Conditioning', G)

// ---------------- 2. always something to buy ----------------
const T2 = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), V = window.__V193E, A = window.__GRIDIRON_AUDIT__
  const N = A.TREE_NODES || null
  S.tree = {}; S.pp = 1000; window.go('shop')
  const strip = document.getElementById('spendNowV193E'), rows = strip ? [...strip.querySelectorAll('.sn-row-v193e')] : []
  const costs = rows.map((r) => parseInt((r.querySelector('button').textContent.match(/[\d,]+/) || ['0'])[0].replace(/,/g, ''), 10))
  const keys = rows.map((r) => (r.querySelector('button').getAttribute('onclick').match(/vaultBuy\('([^']+)'\)/) || [])[1])
  const aff = V.affordable(), cheapest = aff.filter((x) => x.cost <= 1000).slice(0, 5).map((x) => x.key)
  const head = strip ? strip.querySelector('.l').textContent : ''
  const kids = [...document.getElementById('screen').children], iB = kids.findIndex((k) => k.classList.contains('pts-banner')), iS = kids.findIndex((k) => k.id === 'spendNowV193E'), iP = kids.findIndex((k) => k.id === 'potCardV179'), after = iS > iB && iS - iB <= 2 && (iP < 0 || iS < iP)
  S.pp = 0; window.go('shop')
  const strip0 = document.getElementById('spendNowV193E'), away = strip0 ? strip0.querySelector('.sn-away-v193e') : null, awayTxt = away ? away.textContent : ''
  const rows0 = strip0 ? strip0.querySelectorAll('.sn-row-v193e').length : -1
  const cheapestAll = aff[0]
  S.pp = 1000
  return { has: !!strip, n: rows.length, costs, keys, cheapest, head, after, sorted: costs.every((c, i) => !i || c >= costs[i - 1]), rows0, awayTxt, cheapestAll, count: V.affordableCount() }
})
ok(T2.has && T2.n === 5 && T2.sorted && T2.keys.join() === T2.cheapest.join() && T2.after === true, 'SPEND NOW sits under the PP banner (above the potential card) with the five cheapest affordable nodes, one-tap vaultBuy each', { n: T2.n, costs: T2.costs, keys: T2.keys, after: T2.after })
ok(/SPEND NOW/.test(T2.head) && new RegExp('\\b' + T2.count + ' affordable').test(T2.head), 'its header counts every affordable node', T2.head)
ok(T2.rows0 === 0 && /PP away/.test(T2.awayTxt) && /career pays ~/.test(T2.awayTxt) && new RegExp(T2.cheapestAll.cost + ' PP away').test(T2.awayTxt), 'with 0 PP: the cheapest node, how far away, and what a career at this level pays', T2.awayTxt)

const T3 = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), V = window.__V193E
  S.pp = 1000; window.go('hub')
  const line = document.querySelector('#dock .afford-v193e'), txt = line ? line.textContent : ''
  S.pp = 0; window.go('hub')
  const line0 = document.querySelector('#dock .afford-v193e'), txt0 = line0 ? line0.textContent : ''
  S.pp = 1000
  return { txt, txt0, count: V.affordableCount() }
})
ok(new RegExp('🌳 ' + T3.count + ' upgrades? affordable').test(T3.txt.replace(/\s+/g, ' ')) && !/upgrades? affordable/.test(T3.txt0), 'the hub says "🌳 N upgrades affordable" when N > 0 and not when 0', { txt: T3.txt.slice(0, 80), txt0: T3.txt0.slice(0, 80) })

const T4 = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), V = window.__V193E, N = window.__GRIDIRON_AUDIT__.TREE_NODES
  const w = N && N.lkWater, all = N && N.lkAll
  S.tree = { lkWater: 8 }; const coach = V.fx('coachStart')
  S.tree = { lkWater: 400 }; const coachCap = V.fx('coachStart')
  S.tree = {}
  const tab = () => { const b = [...document.querySelectorAll('.branch-tab')].find((x) => /Locker/.test(x.textContent)); b && b.click() }
  window.go('shop'); tab()
  const txt = document.getElementById('branchNodes') ? document.getElementById('branchNodes').textContent : document.getElementById('screen').textContent
  const shown = V.shown('lkWater')
  window.RIB_TUNE.v193Esink = 0
  const shownOff = V.shown('lkWater'); window.go('shop'); tab()
  const txtOff = document.getElementById('branchNodes') ? document.getElementById('branchNodes').textContent : document.getElementById('screen').textContent
  delete window.RIB_TUNE.v193Esink
  return { w: w && { cost: w.cost, mult: w.mult, max: w.max, fx: w.fx }, all: all && { cost: all.cost, mult: all.mult }, coach, coachCap, has: /Water Boys/.test(txt), shown, shownOff, hasOff: /Water Boys/.test(txtOff) }
})
ok(T4.w && T4.w.cost === 6 && T4.w.mult === 1.025 && T4.w.max === 999 && T4.w.fx.coachStart === 0.25 && Math.abs(T4.coach - 2) < 1e-9, 'Water Boys: 6 PP ×1.025, FOREVER, +0.25 starting coach trust a level (×8 = +2 through treeFx)', T4)
ok(T4.coachCap > 40 && T4.coachCap < 100, 'past 160 levels prestigeCap tapers it softly (400 levels = 100 → ~70), as the node says', +T4.coachCap.toFixed(1))
ok(T4.all && T4.all.cost === 10 && T4.all.mult === 1.03, 'Team Dinners is 10 PP ×1.03', T4.all)
ok(T4.has && T4.shown && !T4.shownOff && !T4.hasOff, 'v193Esink 0 hides Water Boys from the Locker Room', T4)

// ---------------- 3. the chaos card ----------------
const C = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), V = window.__V193E, F = window.__V153F
  S.chaosUnlocked = true; S.chaosCap = 12; S.chaos = { speed: 6, strength: 4 }
  window.go('dynasty')
  const sc = document.getElementById('screen'), txt = sc.textContent.replace(/\s+/g, ' '), card = document.getElementById('chaosTruthV193E'), ctxt = card ? card.textContent.replace(/\s+/g, ' ') : ''
  const proj = sc.querySelector('.chaos-proj-v193e'), ptxt = proj ? proj.textContent.replace(/\s+/g, ' ') : ''
  const pr = V.project(), lift = window.__V185.lift(S.player.level), ppm = F.ppMult()
  const note = !!sc.querySelector('.chaos-reward-v153')
  const g10 = V.chaosGrowth(), pct10 = V.chaosGrowthPct()
  const pj = window.__V85.project(S.player), sum = (o) => Object.values(o).reduce((a, b) => a + (+b || 0), 0)
  window.RIB_TUNE.v193Echaos = 0; const g10off = V.chaosGrowth(); const pjOff = window.__V85.project(S.player); delete window.RIB_TUNE.v193Echaos
  const grow = sum(pj), growOff = sum(pjOff)
  const stale = /per level, per stat/.test(txt), cols = card ? card.children.length : 0, maxBtn = [...sc.querySelectorAll('button')].find((b) => /MAX CHAOS/.test(b.textContent))
  return { has: !!card, cols, ctxt, ptxt, pr, lift, ppm, note, g10, pct10, g10off, grow, growOff, stale, maxBtn: maxBtn ? maxBtn.textContent : '', pts: [...sc.querySelectorAll('.cr-pct')].map((x) => x.textContent) }
})
ok(C.has && C.cols === 2 && /WHAT IT COSTS/.test(C.ctxt) && /WHAT IT PAYS/.test(C.ctxt) && !C.stale, 'the chaos card has WHAT IT COSTS / WHAT IT PAYS and the stale "+10% per level, per stat" is gone', { cols: C.cols, stale: C.stale })
ok(new RegExp('\\+' + Math.round(C.lift) + ' rating').test(C.ctxt) && new RegExp('×' + C.ppm.toFixed(1)).test(C.ctxt) && /Pee Wee 6%/.test(C.ctxt) && /UFF 100%/.test(C.ctxt) && /\+3 a point/.test(C.ctxt) && /\+1\.6 a point/.test(C.ctxt), 'its numbers are live: the opponent lift, the PP multiplier, the share banked at Pee Wee … the UFF, cap +3, potential +1.6', { lift: C.lift, ppm: C.ppm })
ok(/Legacy XP \+8% a point/.test(C.ctxt) && /rarity weight/.test(C.ctxt) && /×1\.2 PP forever/.test(C.ctxt) && /\+1\.1% attribute growth a point/.test(C.ctxt) && /now \+11\.0%/.test(C.ctxt), 'and the Legacy XP, gear rarity, eras and the growth bump (chaos 10: +11.0%)', C.ctxt.slice(0, 120))
ok(/at chaos 0 → ~/.test(C.ptxt) && new RegExp('~' + C.pr.at0.toLocaleString('en-US') + ' PP').test(C.ptxt.replace(/,/g, '')) || /at chaos 0/.test(C.ptxt) && /at chaos 10/.test(C.ptxt) && C.pr.atC > C.pr.at0, 'the projection line: the next career at the best level, chaos 0 → chaos 10', { ptxt: C.ptxt, pr: C.pr })
ok(C.note, 'chaosRewardNoteV153F still sits on the card (v153 F reads it)')
ok(Math.abs(C.g10 - 0.5) < 1e-9 && Math.abs(C.pct10 - 11) < 1e-6 && C.g10off === 0, 'chaos 10 = +0.5 on the growth sum (+11% growth); v193Echaos 0 = nothing', { g10: C.g10, pct10: C.pct10, off: C.g10off })
ok(C.grow > C.growOff * 1.04, 'the growth projection feels the chaos growth bump', { on: +C.grow.toFixed(2), off: +C.growOff.toFixed(2) })
ok(/fill all 12 points/.test(C.maxBtn) && C.pts.includes('6 pt') && C.pts.includes('—'), 'the MAX button says what it fills and each row reads in points', { maxBtn: C.maxBtn, pts: C.pts.slice(0, 4) })

// ---------------- 4. how the scouts decide ----------------
const X = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), V = window.__V193E
  S.chaos = {}; S.chaosUnlocked = false
  const open = () => { const d = document.querySelector('.card-v149'); return d ? { title: (d.querySelector('h3') || {}).textContent || '', txt: d.textContent.replace(/\s+/g, ' '), w: d.getBoundingClientRect().width } : null }
  const D = V.explainData()
  window.go('hub'); const hub = !!document.querySelector('#dock .scouts-i-v193e')
  window.go('rank'); const rank = !!document.querySelector('.scouts-line-v193e .scouts-i-v193e'), rankLine = (document.querySelector('.scouts-line-v193e') || {}).textContent || ''
  window.go('shop'); const pot = !!document.querySelector('#potCardV179 .scouts-i-v193e')
  const el = document.querySelector('#potCardV179 .scouts-i-v193e'); el && el.click()
  const dlg = open()
  window.ribDialog && window.ribDialog.close()
  return { D, hub, rank, rankLine, pot, dlg }
})
ok(X.hub && X.rank && X.pot, 'the ⓘ is on the hub, the Recruiting Board and the BLOODLINE POTENTIAL card', { hub: X.hub, rank: X.rank, pot: X.pot })
ok(X.dlg && /HOW THE SCOUTS DECIDE/.test(X.dlg.title) && /RECRUIT STARS/.test(X.dlg.txt) && /NATIONAL RANK/.test(X.dlg.txt) && /BLOODLINE POTENTIAL/.test(X.dlg.txt) && /LEGACY MEDALS/.test(X.dlg.txt), 'tapping it opens HOW THE SCOUTS DECIDE with the four blocks', X.dlg && X.dlg.title)
ok(X.dlg && new RegExp('#' + X.D.rank.toLocaleString('en-US').replace(/,/g, ',?') + ' of').test(X.dlg.txt) && new RegExp('top ' + X.D.topPct + '%').test(X.dlg.txt) && new RegExp(X.D.stars + ' of 5').test(X.dlg.txt) && /never rolls/.test(X.dlg.txt) && /One roll; a miss ends the career/.test(X.dlg.txt), 'with this player\'s numbers: his rank and top-%, his stars, the one roll', { rank: X.D.rank, topPct: X.D.topPct, stars: X.D.stars })
ok(X.dlg && /top 1% ≥ 99%/.test(X.dlg.txt) && /before, 97%/.test(X.dlg.txt) && /College → Combine/.test(X.dlg.txt) && new RegExp(X.D.medals + ' — the ACCOUNT').test(X.dlg.txt), 'it answers the owner: a top-1% season rolls at ≥ 99% now (before 97%); the potential bars and the medals', { medals: X.D.medals })
ok(X.dlg && X.dlg.w <= 360, 'the dialog fits at 360 wide', X.dlg && X.dlg.w)
ok(/#\d/.test(X.rankLine) && /top [\d.]+%/.test(X.rankLine) && /floor under the declare roll/.test(X.rankLine), 'the Recruiting Board says "#N National · top N% — the floor under the declare roll"', X.rankLine.slice(0, 90))

const R = await M(() => {
  const V = window.__V193E, C = window.__V88.curve
  const r = { one: V.rankFloor(1, 100000, 4), top1: V.rankFloor(1000, 100000, 4), top5: V.rankFloor(5000, 100000, 4), mid: V.rankFloor(20000, 100000, 4), peewee: V.rankFloor(1000, 100000, 0), college: V.rankFloor(100, 16000, 5), collegeCurve: C(100, 16000, 5), curve1: C(1000, 100000, 4), curve5: C(5000, 100000, 4) }
  window.RIB_TUNE.v193Erank = 0; r.off1 = V.rankFloor(1000, 100000, 4); delete window.RIB_TUNE.v193Erank
  return r
})
ok(R.top1 >= 99 && R.top1 <= 99.5 && R.one >= 99 && R.one <= 99.5 && R.peewee >= 99, 'a top-1% national rank rolls at ≥ 99 and ≤ 99.5 (Varsity → College, and Pee Wee)', R)
ok(R.top5 >= 95 && R.top5 <= 99.5 && R.mid < 60, 'top 5% rolls at ≥ 95; mid-pack is untouched', R)
ok(Math.abs(R.college - R.collegeCurve) < 1e-9, 'from College on the floor stops (rankTopMaxLevelV193E 4) — the scouts\' verdict is the gate there', { college: +R.college.toFixed(2) })
ok(R.curve1 < 98.5 && R.off1 < 98.5 && Math.abs(R.off1 - R.curve1) < 1e-9, 'v193Erank 0 restores the v88 curve (top 1% at Varsity ≈ 97%)', { curve1: +R.curve1.toFixed(2), off1: +R.off1.toFixed(2) })

// ---------------- fits at 360×780 ----------------
const W = await M(() => {
  const out = {}
  for (const v of ['shop', 'dynasty', 'rank', 'hub']) { window.go(v); out[v] = document.documentElement.scrollWidth }
  return out
})
ok(Object.values(W).every((w) => w <= 360), 'no horizontal overflow at 360 wide on the tree, Rings & Chaos, the Recruiting Board and the hub', W)
await page.screenshot({ path: 'scripts/_v193E_shop.png', fullPage: false }).catch(() => null)

console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
if (errors.length) console.log('PAGE ERRORS:\n' + errors.slice(0, 8).join('\n'))
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
