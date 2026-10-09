// Dev check: v193 AB THE CARDS PAY IN PLAY (src/07-career-app.js `abDeckV193AB` / `abApplyV193AB`, the reel, the skill sheet,
// `ptsEarnV193AB`; src/11's pregame rows).
//   a NO TRUST — 2,000 seeded cards dealt and every one applied: coach trust never moves; the old trust card itself (a direct
//     call, a saved deck) is re-dealt as a Hot Streak
//   b HOT STREAK — at level 0 every percent lands in 5–50 and every duration in 1–10, each rarity in its slice (common 5–12 …
//     legendary 40–50), so the deck's odds skew it small; the boost is in the watched game's buff list (the stash `_raw`
//     reads) AND the quick sim's (`__aiSeasonGame` → `__simGameV2`), a seeded sim moves the stat line, rollGamePerf reads its
//     OVR; it counts down once per played game (a sat-out week does not), stacks to the cap, and expires
//   c SPILLOVER — 10 points at 20% put exactly +2 on the target across 50 single taps (50 → +10), 50 minuses take it all
//     back, the auto button and hold-to-spend spill too; the sheet's header and the target's pending chip; gone at the
//     season's end (finishSeasonGames)
//   d 2× POINTS — ~2% of 5,000 seeded slots (±0.6%); the week's paycheck is exactly doubled (once), the season's own points
//     exactly doubled (a seeded settle, on vs off), and it ends with the season
//   e THE NODES — Hot Hands Lv 5: 20–65% for 6–15 games, cap 75%; Spill Coach Lv 5: 30–75%, Lv 3 aims it (the reel's
//     picker); Double Shift Lv 4: ~1 in 10 and the first 2 games of next season; Apex, priced like Card Shark, each icon in
//     NODE_ART_V193Y
//   f THE REEL — the faces say the rolled numbers, the chosen 2× POINTS card buzzes `reward`; the hub / season chips and
//     the pregame rows; no decimals, no overflow at 360 px
//   h EVERY GAME DEALS — a Quick Play week (code and the dock's card), "sim the rest" and the playoff games each deal one card,
//     apply it once (picked for him: the best by rarity) and log it; "🃏 Cards this season" on the season screen and the result
//   g THE KILL SWITCH — TU v193AB 0: the old deck (trust, reps, attr), the trust card moves trust again, no boost / spill /
//     doubling
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v193ABcheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const page = await browser.newPage({ viewport: { width: 360, height: 800 } })
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
await page.addInitScript(() => { setInterval(() => { try { document.querySelector('.onboard')?.remove() } catch {} }, 60) })
await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V193AB && !!window.__V178 && !!window.__V179, null, { timeout: 40000 })
await page.waitForTimeout(800)
const M = (fn, arg) => page.evaluate(fn, arg)
const setup = (pos) => M((pos) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S); S.tree = {}
  const p = A.newPlayer(); p.pos = pos || 'RB'; p.name = 'Card Man'; p.originV11 = p.originV11 || 'walk-on'; p.level = 5; S.player = p; p.training = 'balanced'
  p.stars = 5; p.potentialCeil = 200; p.coachTrust = 50; p.seasonSeed = 4242
  for (const k in p.attrs) p.attrs[k] = 40
  p.points = 0; p.totalSeasons = 2
  window.RIB_TUNE = window.RIB_TUNE || {}; delete window.RIB_TUNE.v193AB
  document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove(); document.getElementById('splash')?.remove()
  document.querySelectorAll('#growV132,.decision-overlay,#reelHostV193AB').forEach((o) => o.remove())   // a season end's growth card, a week's card
  return true
}, pos)
// a seeded Math.random for the paired runs (restored after)
const SEEDED = `(seed) => { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }`
const DEC = /\d\.\d/

// ---- a: no card touches coach trust
await setup()
const A = await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), p = S.player, V = window.__V193AB, r = { moved: 0, n: 0, kinds: {} }
  for (let wk = 0; r.n < 2000; wk++) {
    const deck = V.deck({ week: wk, opp: 'T' + wk }, 10)
    for (const id of deck) {
      if (id === 'gear') { r.kinds.gear = (r.kinds.gear || 0) + 1; r.n++; continue }   // a gear drop is v186's, it never touched trust
      const t0 = p.coachTrust
      window.__V179.applyFlip(id, { week: wk, opp: 'T' + wk })
      if (p.coachTrust !== t0) r.moved++
      const k = (V.parse(id) || { kind: id }).kind; r.kinds[k] = (r.kinds[k] || 0) + 1; r.n++
      if (r.n % 50 === 0) { p.hotV193AB = []; delete p.spillV193AB; p.flipUpPctV186 = 0; p.flipPPPctV186 = 0 }
    }
  }
  r.legacyInDeck = 0
  for (let wk = 0; wk < 300; wk++) for (const id of V.deck({ week: wk, opp: 'L' + wk }, 10)) if (/^(trust|reps|attr)$/.test(id)) r.legacyInDeck++
  // the old trust card, called directly: a Hot Streak, trust untouched
  p.hotV193AB = []; p.coachTrust = 50
  const say = window.__V179.applyFlip('trust', { week: 1, opp: 'Q' })
  r.direct = { trust: p.coachTrust, hot: (p.hotV193AB || []).length }
  // a deck saved before the update: its unpicked old cards are re-dealt when the reel draws it
  const w = { week: 3, opp: 'Saved', payV178: { flip: { deck: ['trust', 'pt1', 'attr'], n: 1, picked: [] } } }
  p.weekResults = [w]; p.currentWeek = 0
  window.__V178.pick(1)   // the reel's tap: the deck is migrated before the pick
  r.migrated = w.payV178.flip.deck.slice()
  return r
})
ok(A.n >= 2000 && A.moved === 0, '2,000 seeded cards dealt and applied: coach trust never moved', { n: A.n, moved: A.moved, kinds: A.kinds })
ok(A.legacyInDeck === 0 && A.kinds.hot > 100 && A.kinds.spill > 100, 'the deck deals no trust / reps / +1 Permanent card — Hot Streaks and Spillovers in their place', A.kinds)
ok(A.direct.trust === 50 && A.direct.hot === 1, 'the old trust card, called directly, lands as a Hot Streak (trust untouched)', A.direct)
ok(/^hot:uncommon:/.test(A.migrated[0]) && A.migrated[1] === 'pt1' && /^spill:legendary:/.test(A.migrated[2]), 'a deck saved before the update re-deals its old cards (trust → an uncommon Hot Streak, +1 Permanent → a legendary Spillover)', A.migrated)

// ---- b: the Hot Streak
await setup()
const B = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), p = S.player, V = window.__V193AB, r = { by: {}, pct: [1e9, -1e9], games: [1e9, -1e9], out: 0 }
  for (let wk = 0; wk < 1500; wk++) for (const id of V.deck({ week: wk, opp: 'H' + wk }, 12)) {
    const c = V.parse(id); if (!c || c.kind !== 'hot') continue
    const b = r.by[c.rar] || (r.by[c.rar] = { n: 0, pct: [1e9, -1e9], games: [1e9, -1e9], sum: 0 })
    b.n++; b.sum += c.pct
    b.pct = [Math.min(b.pct[0], c.pct), Math.max(b.pct[1], c.pct)]; b.games = [Math.min(b.games[0], c.games), Math.max(b.games[1], c.games)]
    r.pct = [Math.min(r.pct[0], c.pct), Math.max(r.pct[1], c.pct)]; r.games = [Math.min(r.games[0], c.games), Math.max(r.games[1], c.games)]
    const R = V.hotRange(c.rar); if (c.pct < R.pct[0] || c.pct > R.pct[1] || c.games < R.games[0] || c.games > R.games[1]) r.out++
    if (!Number.isInteger(c.pct) || !Number.isInteger(c.games)) r.out++
  }
  for (const k in r.by) r.by[k].mean = +(r.by[k].sum / r.by[k].n).toFixed(1)
  r.ranges = Object.fromEntries(['common', 'uncommon', 'rare', 'epic', 'legendary'].map((k) => [k, V.hotRange(k)]))
  return r
})
const RG = B.ranges
ok(RG.common.pct.join() === '5,12' && RG.uncommon.pct.join() === '10,20' && RG.rare.pct.join() === '18,32' && RG.epic.pct.join() === '30,42' && RG.legendary.pct.join() === '40,50', 'the rarity carries the size: common 5–12%, uncommon 10–20, rare 18–32, epic 30–42, legendary 40–50', Object.fromEntries(Object.entries(RG).map(([k, v]) => [k, v.pct.join('–') + '% · ' + v.games.join('–') + ' g'])))
ok(RG.common.games[0] === 1 && RG.legendary.games[1] === 10 && RG.common.games[1] < RG.rare.games[0] + 2 && RG.rare.games[1] < RG.legendary.games[1], 'the games skew the same way on 1–10', RG)
ok(B.pct[0] >= 5 && B.pct[1] <= 50 && B.games[0] >= 1 && B.games[1] <= 10 && B.out === 0, 'every dealt Hot Streak lands in 5–50% and 1–10 games, inside its rarity\'s slice, whole numbers', { pct: B.pct, games: B.games, out: B.out })
ok(B.by.common && B.by.rare && B.by.common.n > B.by.uncommon.n * 2 && B.by.uncommon.n > B.by.rare.n * 2 && B.by.common.mean < B.by.uncommon.mean && B.by.uncommon.mean < B.by.rare.mean, 'the deck\'s odds skew it: small boosts are common, big ones rare', Object.fromEntries(Object.entries(B.by).map(([k, v]) => [k, { n: v.n, mean: v.mean }])))

// the boost in play (the week's own cards are switched off — v178flip 0 — so a dealt card cannot add a boost of its own)
await setup()
const G = await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), p = S.player, V = window.__V193AB, r = {}
  window.RIB_TUNE.v178flip = 0
  X.startSeasonGames(); S.view = 'season'
  document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove()
  p._tempStatBuffsV25 = null; p.growthFxV42 = []
  const mine = () => (p.hotV193AB || []).filter((b) => b.tag === 'G').map((b) => b.gamesLeft)
  p.hotV193AB = [{ attr: 'speed', pct: 22, gamesLeft: 4, games: 4, rar: 'rare', tag: 'G' }]
  r.buffs = V.buffs()
  r.own = (window.__V111.ownBuffs(p) || []).filter((b) => b.v193AB === 'hot').map((b) => b.stat + ' ' + b.pct + '% +' + b.amt)
  r.lift = V.lift()
  // what each game path hands the engine: every write of the global `_raw` reads
  let cap = null, val = null
  Object.defineProperty(window, '__youTempBuffsV25', { configurable: true, get: () => val, set: (v) => { val = v; if (v) cap = v.filter((b) => b.v193AB === 'hot').map((b) => b.stat + ' ' + b.pct) } })
  // the quick sim (__aiSeasonGame → __simGameV2)
  const wk = p.weekResults.findIndex((w) => !w.played)
  cap = null; try { window.playWeek(false) } catch (e) { r.err = String(e) }
  r.quick = cap; r.afterQuick = mine(); r.wkPlayed = !!p.weekResults[wk].played
  // a sat-out week: no game, no countdown
  const cv = p.conditionV11 || (p.conditionV11 = {}); cv.injury = { name: 'Sprain', weeksRemaining: 1, severity: 2, seasonEnding: false }
  const wk2 = p.weekResults.findIndex((w) => !w.played)
  try { window.playWeek(false) } catch (e) { r.err2 = String(e) }
  r.satOut = !!p.weekResults[wk2].satOut; r.afterSat = mine()
  cv.injury = null
  delete window.__youTempBuffsV25; window.__youTempBuffsV25 = null
  // the watched game: playWeek(true) hands `_raw` wearBuffsV111(player) (window.__V111.buffs) — the boost is in it; a
  // watched week pre-books and then plays, so the game is spent TWICE on the same week: it counts down once
  r.watched = window.__V111.buffs(p).filter((b) => b.v193AB === 'hot').map((b) => b.stat + ' ' + b.pct)
  const w3 = p.weekResults.find((w) => !w.played)
  window.__V111.decay(p, w3); window.__V111.decay(p, w3)
  r.afterWatch = mine(); r.live = true
  window.go('season')
  delete window.RIB_TUNE.v178flip
  return r
})
ok(G.buffs.length === 1 && G.buffs[0].stat === 'speed' && G.buffs[0].pct === 22 && G.buffs[0].amt === Math.round(40 * 0.22) && G.own.length === 1, 'a +22% Speed boost is a v193 X percent buff (+9 on a 40) in v111\'s own list — the one `_raw` and the sheet read', { buffs: G.buffs, own: G.own })
ok(G.quick && G.quick.join() === 'speed 22' && G.wkPlayed, 'the quick sim plays with it: __aiSeasonGame hands __simGameV2 the boost', { seen: G.quick, err: G.err })
ok(G.live && G.watched && G.watched.join() === 'speed 22', 'the watched game plays with it: the list playWeek(true) hands the live game\'s `_raw` (wearBuffsV111) carries the boost', { watched: G.watched })
ok(G.lift > 0, 'rollGamePerf reads the OVR it adds', G.lift)
ok(G.afterQuick.join() === '3' && G.satOut && G.afterSat.join() === '3' && G.afterWatch.join() === '2', 'it counts down once per played game (4 → 3), a sat-out week does not count (3), a watched week (spent twice: pre-booked, then played) once (2)', { quick: G.afterQuick, sat: G.afterSat, watched: G.afterWatch })

// a measurable stat delta in the sim, seeded; stacking; expiry
await setup()
const D = await M((SEEDED) => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), p = S.player, V = window.__V193AB, mk = eval(SEEDED), r = {}
  const R0 = Math.random
  const run = (hot, bare) => {
    p.hotV193AB = hot; let yds = 0
    for (let i = 0; i < 24; i++) {
      Math.random = mk(1000 + i)
      window.__youTempBuffsV25 = bare ? null : window.__V111.buffs(p)   // the watched game's list, or a bare call (`_raw` falls back to ownBuffs)
      const g = window.__simGameV2(50, 'RB'); window.__youTempBuffsV25 = null
      yds += (g && g.stat && (g.stat.rush || 0)) || 0
    }
    Math.random = R0
    return yds
  }
  const HOT = [{ attr: 'speed', pct: 50, gamesLeft: 9 }, { attr: 'agility', pct: 50, gamesLeft: 9 }, { attr: 'strength', pct: 50, gamesLeft: 9 }, { attr: 'carrying', pct: 50, gamesLeft: 9 }]
  r.off = run([]); r.on = run(HOT); r.bareOff = run([], true); r.bareOn = run(HOT, true)
  // the stack cap: three 30% boosts on one stat hold 60%
  p.hotV193AB = [{ attr: 'speed', pct: 30, gamesLeft: 2 }, { attr: 'speed', pct: 30, gamesLeft: 1 }, { attr: 'speed', pct: 30, gamesLeft: 5 }]
  r.stack = V.buffs().find((b) => b.stat === 'speed').pct; r.cap = V.hotCap()
  // expiry: three games played
  X.startSeasonGames(); S.view = 'season'; document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove()
  window.RIB_TUNE.v178flip = 0
  p.hotV193AB = [{ attr: 'speed', pct: 10, gamesLeft: 2, games: 2 }]
  let played = 0
  for (let i = 0; i < 8 && played < 2; i++) {
    document.querySelectorAll('.decision-overlay').forEach((o) => o.remove()); S.view = 'season'; if (p.conditionV11) p.conditionV11.injury = null
    const w = p.weekResults.find((x) => !x.played); try { window.playWeek(false) } catch (e) { r.err = String(e) }
    if (w && w.played && !w.satOut) played++
    if (played === 1) r.mid = (p.hotV193AB || []).map((b) => b.gamesLeft).join()
  }
  delete window.RIB_TUNE.v178flip
  r.played = played; r.expired = (p.hotV193AB || []).length; r.buffsAfter = V.buffs().length
  return r
}, SEEDED)
ok(D.on > D.off * 1.05 && D.bareOn > D.bareOff * 1.05, 'a seeded sim moves the stat line through `_raw`: +50% on four RB stats rushes for more over 24 paired games (the watched list, and a bare sim)', { off: D.off, on: D.on, bareOff: D.bareOff, bareOn: D.bareOn })
ok(D.stack === 60 && D.cap === 60, 'boosts stack per stat up to hotStackCapV193AB (3 × 30% → 60%)', { stack: D.stack, cap: D.cap })
ok(D.played === 2 && D.mid === '1' && D.expired === 0 && D.buffsAfter === 0, 'a 2-game boost reads 1 game after the first and is gone after the second', { played: D.played, mid: D.mid, expired: D.expired, buffs: D.buffsAfter })

// ---- c: the Spillover
await setup()
const C = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), p = S.player, V = window.__V193AB, r = {}
  r.keys = V.keys()
  const tgt = r.keys.find((k) => k !== 'speed') || r.keys[0], src = r.keys.find((k) => k !== tgt && window.__drCostV97(p, k) === 1)
  r.tgt = tgt; r.src = src
  window.__V179.applyFlip('spill:rare:' + tgt + ':20', { week: 1, opp: 'S' })
  window.go('upgrade')
  r.band = window.__drCostV97(p, src) === 1
  const t0 = p.attrs[tgt]; p.points = 1000
  const at = []
  for (let i = 0; i < 50; i++) { window.alloc(src, 1); at.push(p.attrs[tgt] - t0) }
  r.at10 = at[9]; r.at50 = at[49]; r.units = V.spill().units[tgt]
  r.line = (document.getElementById('spillLineV193AB') || {}).textContent || ''
  const chip = document.getElementById('spillChipV193AB-' + tgt); r.chip = chip ? chip.textContent : ''
  r.uv = (document.getElementById('uv-' + tgt) || {}).textContent
  window.alloc(src, 1); window.alloc(src, 1); window.alloc(src, 1)   // 53 points: 10 landed, 60% pending
  const chip2 = document.getElementById('spillChipV193AB-' + tgt); r.chip2 = chip2 ? chip2.textContent : ''
  for (let i = 0; i < 53; i++) window.alloc(src, -1)
  r.back = { tgt: p.attrs[tgt] - t0, pts: p.points, units: V.spill().units[tgt], landed: V.spill().landed[tgt] || 0 }
  r.dec = ((document.getElementById('screen').innerText || '').match(/\d\.\d/g) || []).slice(0, 4)
  r.width = document.scrollingElement.scrollWidth
  // the auto button: 30 points across the board spill 6
  window.go('upgrade'); const tA = p.attrs[tgt]; p.points = 30; window.autoAllocSpread()
  r.auto = { landed: V.spill().landed[tgt], units: V.spill().units[tgt], left: p.points }
  return r
})
ok(C.band && C.at10 === 2, 'SPILLOVER 20%: 10 points spent on another stat put exactly +2 on ' + C.tgt, { at10: C.at10 })
ok(C.at50 === 10 && C.units === 1000, '50 single taps: +10 exactly (1,000 units, nothing lost or invented)', { at50: C.at50, units: C.units })
ok(C.back.tgt === 0 && C.back.pts === 1000 && C.back.units === 0 && C.back.landed === 0, '53 minuses take every spilled point and fraction back exactly', C.back)
ok(/20% of every point you spend →/.test(C.line) && /\(this season\)/.test(C.line), 'the sheet\'s header: "20% of every point you spend → <stat> (this season)"', C.line)
ok(/\+10 · 0% to the next \+1/.test(C.chip) && /60% to the next \+1/.test(C.chip2) && C.uv === String(40 + 10), 'the target row shows what landed and the pending share ("+10 · 60% to the next +1"), its value redrawn', { chip: C.chip, chip2: C.chip2, uv: C.uv })
ok(C.auto.left === 0 && C.auto.units === 600 && C.auto.landed === 6, 'the auto button spills too: 30 points → 600 units → +6', C.auto)
ok(!C.dec.length && C.width <= 360, 'no decimals on the sheet, no overflow at 360 px', { dec: C.dec, width: C.width })

// hold-to-spend spills
await setup()
const tgtH = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), p = S.player, V = window.__V193AB
  const tgt = V.keys().find((k) => k !== 'speed')
  window.__V179.applyFlip('spill:rare:' + tgt + ':50', { week: 1, opp: 'S' }); p.points = 10; window.go('upgrade')
  if (window.upSegV153) { const g = document.querySelector('.up-attr[data-k="speed"]')?.closest('.up-group-v97'); g && window.upSegV153(g.dataset.g) }
  window.__t0 = p.attrs[tgt]; return tgt
})
const plus = page.locator('#plus-speed')
await plus.scrollIntoViewIfNeeded()
const box = await plus.boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down(); await page.waitForTimeout(2600); await page.mouse.up(); await page.waitForTimeout(200)
const H = await M((tgt) => { const p = window.__GRIDIRON_AUDIT__.getState().player; return { left: p.points, spilled: p.attrs[tgt] - window.__t0, speed: p.attrs.speed - 40 } }, tgtH)
ok(H.left === 0 && H.speed === 10 && H.spilled === 5, 'hold-to-spend spills too: 10 held points at 50% → +5 on the target', H)

// the season's end
await setup()
const E = await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), p = S.player, V = window.__V193AB, r = {}
  X.startSeasonGames(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove()
  window.__V179.applyFlip('spill:rare:' + V.keys()[0] + ':20', { week: 1, opp: 'S' })
  window.__V179.applyFlip('dbl', { week: 1, opp: 'S' })
  r.before = { spill: !!V.spill(), dbl: V.dbl() }
  ;(p.weekResults || []).forEach((w) => { w.played = true; w.perf = 40; w.us = 7; w.them = 21; w.won = false })
  const ts0 = p.totalSeasons
  try { window.finishSeasonGames() } catch (e) { r.err = String(e) }
  r.ts = p.totalSeasons - ts0
  r.after = { spill: !!V.spill(), dbl: V.dbl(), fieldS: 'spillV193AB' in p, fieldD: 'dblPtsV193AB' in p }
  return r
})
ok(E.before.spill && E.before.dbl && E.ts === 1 && !E.after.spill && !E.after.dbl && !E.after.fieldS && !E.after.fieldD && !E.err, 'the real season end (finishSeasonGames → simSeason) spends the Spillover and 2× POINTS', E)

// ---- d: 2× POINTS
await setup()
const P = await M((SEEDED) => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), V = window.__V193AB, mk = eval(SEEDED), r = {}
  let n = 0, d = 0
  for (let wk = 0; n < 5000; wk++) for (const id of V.deck({ week: wk, opp: 'D' + wk }, 50)) { n++; if (id === 'dbl') d++ }
  r.share = d / n; r.odds = V.dblOdds()
  // the week's paycheck, paired: the same week, the same player, with and without the card
  X.startSeasonGames(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove()
  const snap = JSON.stringify(S.player)
  const payOnce = (dbl) => {
    S.player = JSON.parse(snap); const p = S.player
    if (dbl) window.__V179.applyFlip('dbl', { week: 1, opp: 'P' })
    const w = p.weekResults.find((x) => !x.played); w.played = true; w.perf = 78; w.won = true; w.us = 28; w.them = 14
    const pts0 = p.points || 0; const P = window.__V178.pay(w, { s0: 0, perf: 78, won: true, watched: false })
    return { raw: P.raw, whole: P.whole, bank0: P.bank0, mult: P.dblV193AB, got: (p.points || 0) - pts0 }
  }
  r.off = payOnce(false); r.on = payOnce(true)
  // the season's own points, paired on a seeded settle
  const R0 = Math.random
  const settle = (dbl) => {
    S.player = JSON.parse(snap); const p = S.player
    if (dbl) window.__V179.applyFlip('dbl', { week: 1, opp: 'P' })
    p.flipUpPctV186 = 0
    p.weekResults.forEach((w) => { w.played = true; w.perf = 70; w.us = 14; w.them = 21; w.won = false })   // no playoffs: the season settles at once
    Math.random = mk(77)
    try { window.finishSeasonGames() } catch (e) { r.errS = String(e) }
    Math.random = R0
    return { earned: p.seasonStats && p.seasonStats.pointsEarned, dblAfter: V.dbl(p) }
  }
  r.sOff = settle(false); r.sOn = settle(true)
  r.earn = [V.earn(7)]
  return r
}, SEEDED)
ok(Math.abs(P.share - 0.02) <= 0.006 && P.odds === 0.02, '2× POINTS turns up on ~2% of 5,000 seeded slots (its own draw, before the rarity)', { share: +P.share.toFixed(4), odds: P.odds })
ok(P.off.mult === 1 && P.on.mult === 2 && P.on.raw === P.off.raw * 2 && P.on.whole === Math.floor(P.on.bank0 + P.on.raw + 1e-9) && P.on.got === P.on.whole, 'the week\'s paycheck is doubled exactly once (raw ×2 into the bank, the whole points paid)', { off: P.off, on: P.on })
ok(P.sOff.earned > 0 && P.sOn.earned === P.sOff.earned * 2 && !P.sOn.dblAfter, 'the season\'s own points are doubled exactly (a seeded settle, on vs off), and the card ends with the season', { off: P.sOff, on: P.sOn, err: P.errS })

// ---- e: the nodes
await setup()
const N = await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), p = S.player, V = window.__V193AB, T = X.TREE_NODES, r = {}
  const span = (f) => { const all = ['common', 'uncommon', 'rare', 'epic', 'legendary'].map(f); return [Math.min(...all.map((x) => x[0])), Math.max(...all.map((x) => x[1]))] }
  r.nodes = ['hotHands', 'spillCoach', 'doubleShift', 'cardShark', 'markedCards'].map((k) => T[k] && { k, branch: T[k].branch, max: T[k].max, cost: X.nodeCost(T[k]), icon: T[k].icon, art: !!(window.__V193Y && window.__V193Y.map[String(T[k].icon).replace(/️/g, '')] || window.__V193Y.map[T[k].icon]), fx: T[k].fx, desc: T[k].desc })
  r.h0 = { pct: span((k) => V.hotRange(k).pct), games: span((k) => V.hotRange(k).games), cap: V.hotCap() }
  S.tree = { hotHands: 5 }; r.h5 = { pct: span((k) => V.hotRange(k).pct), games: span((k) => V.hotRange(k).games), cap: V.hotCap() }
  S.tree = { spillCoach: 5 }; r.s5 = span((k) => V.spillRange(k)); S.tree = {}; r.s0 = span((k) => V.spillRange(k))
  // Spill Coach Lv 3 aims it; Lv 2 does not
  const k0 = V.keys()[0], k1 = V.keys()[1]
  window.__V179.applyFlip('spill:common:' + k0 + ':10', {})
  S.tree = { spillCoach: 2 }; r.aim2 = V.aim(0, k1); S.tree = { spillCoach: 3 }; r.aim3 = V.aim(0, k1); r.aimed = V.spill().list[0].attr === k1
  S.tree = { doubleShift: 4 }; r.d4 = V.dblOdds()
  let n = 0, d = 0; for (let wk = 0; n < 5000; wk++) for (const id of V.deck({ week: wk, opp: 'E' + wk }, 50)) { n++; if (id === 'dbl') d++ }
  r.d4share = d / n
  // Double Shift Lv 4: the card lasts into the first 2 games of next season
  X.startSeasonGames(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove()
  window.__V179.applyFlip('dbl', { week: 1, opp: 'S' })
  r.say = p.dblPtsV193AB && p.dblPtsV193AB.next
  p.weekResults.forEach((w) => { w.played = true; w.perf = 60; w.us = 14; w.them = 21; w.won = false })
  try { window.finishSeasonGames() } catch (e) { r.err = String(e) }
  r.carry = V.dbl()
  X.startSeasonGames(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove()
  r.mults = []; window.RIB_TUNE.v178flip = 0
  for (let i = 0; i < 3; i++) { const w = p.weekResults.find((x) => !x.played); w.played = true; w.perf = 60; w.won = true; const P = window.__V178.pay(w, { s0: 0, perf: 60, won: true, watched: false }); r.mults.push(P.dblV193AB) }
  S.tree = {}; delete window.RIB_TUNE.v178flip
  return r
})
const nd = Object.fromEntries(N.nodes.map((x) => [x.k, x]))
ok(['hotHands', 'spillCoach', 'doubleShift'].every((k) => nd[k] && nd[k].branch === 'apex' && nd[k].art), 'Hot Hands, Spill Coach and Double Shift are Apex nodes (with Lucky Draw / Card Shark / Marked Cards), each icon in NODE_ART_V193Y', N.nodes.map((x) => x.k + ':' + x.branch + ':' + x.icon))
ok(nd.hotHands.cost === nd.cardShark.cost && nd.doubleShift.cost === nd.markedCards.cost && nd.hotHands.max === 5 && nd.spillCoach.max === 5 && nd.doubleShift.max === 4, 'priced like their neighbours (Card Shark / Marked Cards), 5 / 5 / 4 levels', N.nodes.map((x) => x.k + ' ' + x.cost + ' ×' + x.max))
ok(N.h0.pct.join() === '5,50' && N.h0.games.join() === '1,10' && N.h0.cap === 60 && N.h5.pct.join() === '20,65' && N.h5.games.join() === '6,15' && N.h5.cap === 75, 'Hot Hands Lv 5: 5–50% → 20–65%, 1–10 → 6–15 games, the stack cap 60% → 75%', { lv0: N.h0, lv5: N.h5 })
ok(N.s0.join() === '5,50' && N.s5.join() === '30,75', 'Spill Coach Lv 5: 5–50% → 30–75%', { lv0: N.s0, lv5: N.s5 })
ok(!N.aim2 && N.aim3 && N.aimed, 'Spill Coach Lv 3 lets you aim a Spillover at a key stat (Lv 2 does not)', { lv2: N.aim2, lv3: N.aim3 })
ok(Math.abs(N.d4 - 0.02 * Math.pow(1.5, 4)) < 1e-12 && Math.abs(N.d4share - N.d4) < 0.015, 'Double Shift Lv 4: the 2× card ×1.5 a level → ~1 in 10 (dealt ' + (N.d4share * 100).toFixed(1) + '%)', { odds: N.d4, share: N.d4share })
ok(N.say === 2 && N.carry && N.mults.join() === '2,2,1', 'Double Shift Lv 4: the card lasts into the first 2 games of next season (then ×1)', { next: N.say, carry: N.carry, mults: N.mults, err: N.err })
ok(/20–65%/.test(nd.hotHands.desc) && /6–15 games/.test(nd.hotHands.desc) && /30–75%/.test(nd.spillCoach.desc) && /1 card in 10/.test(nd.doubleShift.desc), 'each desc states its totals at max', N.nodes.slice(0, 3).map((x) => x.desc))

// ---- f: the reel, the chips, the pregame rows
await setup()
const F = await M(async () => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), p = S.player, V = window.__V193AB, r = {}
  S.tree = { spillCoach: 3 }
  X.startSeasonGames(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove()
  window.__hapV193AB = []; const h0 = window.ribHaptic; window.ribHaptic = (k) => { window.__hapV193AB.push(k); try { h0 && h0(k) } catch {} }
  const k0 = V.keys()[0]
  const wi = p.weekResults.findIndex((x) => !x.played), w = p.weekResults[wi]; w.played = true; w.perf = 70; w.won = true; w.us = 21; w.them = 10
  const P = window.__V178.pay(w, { s0: 0, perf: 70, won: true, watched: false })
  P.flip = { deck: ['hot:rare:speed:22:4', 'spill:common:' + k0 + ':20', 'dbl'], n: 3, picked: [], lucky: false }
  p.currentWeek = wi
  const host = document.createElement('div'); host.id = 'reelHostV193AB'; host.innerHTML = window.__V178.reel(w); document.body.appendChild(host)
  r.faces = [...host.querySelectorAll('.rvc-v178 .b')].map((b) => b.textContent.replace(/\s+/g, ' ').trim())
  window.__V178.pick(2); await new Promise((res) => setTimeout(res, 50))
  r.hapDbl = window.__hapV193AB.slice()
  window.__V178.pick(1); await new Promise((res) => setTimeout(res, 50))
  const aim = host.querySelector('#rvAimV193AB .ab-aim-v193ab'); r.aimBtns = aim ? aim.querySelectorAll('button').length : 0
  const k1 = V.keys()[1]; const btn = aim && [...aim.querySelectorAll('button')].find((b) => b.getAttribute('onclick').includes("'" + k1 + "'")); btn && btn.click()
  const pk1 = P.flip.picked.find((x) => x.i === 1); r.aimed = !!(pk1 && pk1.ab && V.spill().list[pk1.ab.idx].attr === k1)   // the week's own dealt card may hold a Spillover too
  window.__V178.pick(0); await new Promise((res) => setTimeout(res, 50))
  r.picked = P.flip.picked.map((x) => x.say)
  r.haps = window.__hapV193AB.slice()
  window.ribHaptic = h0; host.remove()
  // the chips on the season screen and the hub, the pregame rows
  document.querySelectorAll('.decision-overlay').forEach((o) => o.remove())
  window.go('season'); await new Promise((res) => setTimeout(res, 120))
  const cs = document.getElementById('abChipsV193AB'); r.season = cs ? cs.textContent.replace(/\s+/g, ' ').trim() : ''
  r.seasonRight = cs ? Math.max(...[...cs.children].map((c) => c.getBoundingClientRect().right)) : 0
  r.width = document.scrollingElement.scrollWidth
  window.go('hub'); await new Promise((res) => setTimeout(res, 120))
  const ch = document.getElementById('abChipsV193AB'); r.hub = ch ? ch.textContent.replace(/\s+/g, ' ').trim() : ''
  r.widthHub = document.scrollingElement.scrollWidth
  r.pregame = (window.pregameTempStats(p, p.weekResults.find((x) => !x.played)) || []).filter((x) => /Hot streak|Upgrade points/.test(x.l)).map((x) => x.l + ': ' + x.v)
  S.tree = {}
  return r
})
ok(/\+22% Speed · 4 games/.test(F.faces[0]) && /20% → /.test(F.faces[1]) && /2× POINTS · this season/.test(F.faces[2]), 'the cards\' faces say what they rolled ("+22% Speed · 4 games", "20% → <stat>", "2× POINTS · this season")', F.faces)
ok(F.hapDbl.includes('reward'), 'the chosen 2× POINTS card buzzes `reward`', F.hapDbl)
ok(F.aimBtns >= 3 && F.aimed, 'Spill Coach Lv 3: a picker under the card aims the Spillover', { buttons: F.aimBtns, aimed: F.aimed })
ok(F.picked.length === 3 && F.picked.every((s) => !DEC.test(s)), 'the picked cards read whole numbers', F.picked)
ok(/\+22% Speed · 4 games/.test(F.season) && /20% of every point → /.test(F.season) && /2× POINTS · this season/.test(F.season), 'the season screen shows the held cards as chips', F.season)
ok(/\+22% Speed · 4 games/.test(F.hub), 'the hub shows them too', F.hub)
ok(F.pregame.some((x) => /Hot streak: \+22% Speed \(\+9\) · 4 games/.test(x)) && F.pregame.some((x) => /2× this game/.test(x)), 'the pregame sheet lists the boost (and a 2× game)', F.pregame)
ok(F.width <= 360 && F.widthHub <= 360 && F.seasonRight <= 360, 'no overflow at 360 px (season, hub, the chips)', { season: F.width, hub: F.widthHub, chipsRight: Math.round(F.seasonRight) })
ok(!DEC.test(F.season) && !DEC.test(F.hub), 'no decimals on the chips')

// ---- h: every way a game is played deals a card, applies it once, and logs it
// (the owner: "Make sure if you sim a game the card bonus still flips. Same with the season.")
await setup()
const W = await M(async () => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), p = S.player, V = window.__V193AB, r = {}
  const wait = (ms) => new Promise((res) => setTimeout(res, ms))
  const clear = () => { document.querySelectorAll('.decision-overlay,#growV132,#growthV42,#gv139gate').forEach((o) => o.remove()) }
  r.best = V.best(['pt1', 'hot:rare:speed:20:4', 'dbl', 'spill:epic:speed:30'])
  for (const k in p.attrs) p.attrs[k] = 160   // good enough to make the playoffs
  X.startSeasonGames(); clear(); S.view = 'season'
  const games = () => p.weekResults.filter((w) => w.played && !w.satOut)
  const flips = (ws) => ws.map((w) => { const F = w.payV178 && w.payV178.flip; return F ? F.picked.length + '/' + F.n : 'none' })
  const logN = () => ((V.log() || {}).list || []).length
  // 1 — a Quick Play week from code (the strip): the card is picked for him at once
  const w1 = p.weekResults.find((w) => !w.played)
  window.playWeek(false); clear()
  r.quick = { flip: flips([w1]), auto: !!(w1.payV178 && w1.payV178.flip && w1.payV178.flip.picked.every((x) => x.auto)), log: logN() }
  // 2 — a Quick Play tapped on the dock: the Quick Play card's reel; Continue picks what is left
  S.view = 'season'; window.render(); await wait(200)
  const w2 = p.weekResults.find((w) => !w.played)
  const qb = [...document.querySelectorAll('#dock button')].find((b) => /Quick Play/.test(b.textContent)); qb && qb.click(); await wait(500)
  r.card = !!document.getElementById('simCardV178')
  const cont = document.querySelector('#simCardV178 .btn'); cont && cont.click(); await wait(300); clear()
  r.tap = { flip: flips([w2]), log: logN() }
  // 3 — sim the rest of the regular season (and the playoff rounds the sim plays)
  S.view = 'season'
  const before = games().length
  window.simRemainingWeeks(); await wait(400); clear()
  S.view = 'season'; window.render(); await wait(200)
  const g = games()
  r.rest = { simmed: g.length - before, flips: flips(g), log: logN(), games: g.length }
  // applied once: a second auto-pick on every week (a Continue tapped twice, a reload) adds nothing
  const picks0 = g.reduce((a, w) => a + ((w.payV178 && w.payV178.flip && w.payV178.flip.picked.length) || 0), 0)
  g.forEach((w) => V.auto(w))
  r.picksAgain = g.reduce((a, w) => a + ((w.payV178 && w.payV178.flip && w.payV178.flip.picked.length) || 0), 0) - picks0
  r.logAgain = logN()
  // the summary on the season screen
  const sm = document.getElementById('cardLogV193AB')
  r.summary = sm ? sm.querySelector('summary').textContent.replace(/\s+/g, ' ').trim() : ''
  r.rows = sm ? sm.querySelectorAll('.ab-log-row-v193ab').length : 0
  r.rowTxt = sm ? [...sm.querySelectorAll('.ab-log-row-v193ab')].slice(0, 4).map((x) => x.textContent.replace(/\s+/g, ' ').trim()) : []
  r.width = document.scrollingElement.scrollWidth
  // the playoffs: a winning record is forced (the sim's own record varies), the bracket is drawn, the sim plays its rounds
  // and any game still to play (the championship is played live) is played from code — each deals, applies and logs a card
  if (!(p.playoffState && p.playoffState.qualified)) {
    p.weekResults.filter((w) => !w.playoff).forEach((w) => { w.won = true; w.us = Math.max(w.us || 0, (w.them || 0) + 7) })
    p.playoffState = null; S.view = 'season'; window.render(); await wait(200)
  }
  r.poRows = p.weekResults.filter((w) => w.playoff).length
  const heal = () => { if (p.conditionV11) p.conditionV11.injury = null }   // a hurt man sits a game out (no game, no card) — this measures the games
  heal(); window.simRemainingWeeks(); await wait(300); clear()
  r.playoff = flips(p.weekResults.filter((w) => w.playoff && w.played && !w.satOut))
  for (let i = 0; i < 4 && p.weekResults.some((w) => !w.played); i++) { clear(); heal(); S.view = 'season'; try { window.playWeek(false) } catch (e) { r.errPo = String(e) } }
  r.leftover = p.weekResults.filter((w) => !w.played).map((w) => w.round || w.opp)
  p.weekResults.filter((w) => !w.played).forEach((w) => { w.played = true; w.satOut = true; w.won = false; w.us = 0; w.them = 7 })   // a round the code path could not play (the live-only final): out of the count
  if (p.playoffState) { p.playoffState.done = true; p.playoffState.alive = false }
  const g2 = games()
  r.allFlips = flips(g2); r.allLog = logN(); r.allGames = g2.length
  r.poGames = g2.filter((w) => w.playoff).length; r.poFlips = flips(g2.filter((w) => w.playoff))
  r.ps = JSON.stringify(p.playoffState); r.rec = p.weekResults.map((w) => (w.won ? 'W' : 'L') + (w.playoff ? 'p' : '')).join('')
  // the season's result shows the log too
  try { window.finishSeasonGames() } catch (e) { r.errF = String(e) }
  await wait(300)
  const rs = document.querySelector('#cardLogV193AB[data-where="result"]')
  r.result = rs ? rs.querySelector('summary').textContent.replace(/\s+/g, ' ').trim() : ''
  r.view = S.view
  return r
})
ok(W.best.join() === '2,3,1,0', 'a game he did not see picks the best card by rarity (2× POINTS, then epic, rare … — a tie goes to the first dealt)', W.best)
ok(W.quick.flip.join() === '1/1' && W.quick.auto && W.quick.log === 1, 'a Quick Play week (from code): one card dealt, picked for him, logged', W.quick)
ok(W.card && W.tap.flip.join() === '1/1' && W.tap.log === 2, 'a Quick Play tapped on the dock shows its card; Continue picks it — one card, logged', { card: W.card, tap: W.tap })
ok(W.rest.simmed >= 8 && W.rest.flips.every((f) => f === '1/1') && W.rest.log === W.rest.games, '"sim the rest": every simmed game deals exactly one card and applies it (' + W.rest.simmed + ' games, ' + W.rest.log + ' cards logged)', W.rest)
ok(W.poGames >= 1 && W.poFlips.every((f) => f === '1/1'), 'the playoff games (simmed rounds and the championship from code) each deal and apply their card', { playoff: W.poFlips, simmedRounds: W.playoff, rows: W.poRows, ps: W.ps, rec: W.rec })
ok(W.picksAgain === 0 && W.logAgain === W.rest.log && W.allLog === W.allGames && W.allFlips.every((f) => f === '1/1'), 'applied once: a second auto-pick adds nothing; one log line per game played', { again: W.picksAgain, log: W.allLog, games: W.allGames })
ok(new RegExp('Cards this season · ' + W.rest.log + ' · \\d+ picked for you').test(W.summary) && W.rows === W.rest.log && W.width <= 360, 'the season screen: "🃏 Cards this season · N · M picked for you", a line per card (week, what it gave)', { summary: W.summary, rows: W.rows, first: W.rowTxt })
ok(W.rowTxt.every((t) => /^(WK \d+|[A-Za-z].*?)\s/.test(t) && !/\d\.\d/.test(t)), 'each line names its game and what the card gave, in whole numbers', W.rowTxt)
ok(W.view === 'result' && new RegExp('Cards this season · ' + W.allLog).test(W.result), 'the season\'s result lists them too', { view: W.view, result: W.result, err: W.errF, leftover: W.leftover })

// ---- g: the kill switch
await setup()
const K = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), p = S.player, V = window.__V193AB, r = {}
  window.RIB_TUNE.v193AB = 0
  const ids = {}; for (let wk = 0; wk < 600; wk++) for (const id of V.deck({ week: wk, opp: 'K' + wk }, 10)) ids[id.split(':')[0]] = (ids[id.split(':')[0]] || 0) + 1
  r.ids = ids
  p.coachTrust = 50; window.__V179.applyFlip('trust', {}); r.trust = p.coachTrust
  p.hotV193AB = [{ attr: 'speed', pct: 30, gamesLeft: 3 }]; r.buffs = V.buffs().length; r.own = window.__V111.ownBuffs(p).filter((b) => b.v193AB).length
  p.dblPtsV193AB = { season: p.totalSeasons, next: 0 }; r.dbl = V.dbl(); r.earn = V.earn(5)
  p.spillV193AB = { season: p.totalSeasons, list: [{ attr: 'speed', pct: 50 }], units: {}, landed: {} }
  window.go('upgrade'); p.points = 4; const a0 = p.attrs.speed; for (let i = 0; i < 4; i++) window.alloc('agility', 1); r.spilled = p.attrs.speed - a0
  r.line = !!document.getElementById('spillLineV193AB')
  delete window.RIB_TUNE.v193AB
  return r
})
ok(K.ids.trust > 0 && K.ids.reps > 0 && !K.ids.hot && !K.ids.spill && !K.ids.dbl, 'v193AB 0: the old deck (trust, reps …), no Hot Streak / Spillover / 2× card', K.ids)
ok(K.trust === 51, 'v193AB 0: the old coach card (+1 trust) again', K.trust)
ok(K.buffs === 0 && K.own === 0 && !K.dbl && K.earn === 5 && K.spilled === 0 && !K.line, 'v193AB 0: no boost, no doubling, no spill', K)

ok(!errs.length, 'no page errors', errs.slice(0, 3))
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
