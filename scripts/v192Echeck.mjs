// Dev check: v192 E (src/05-field-renderer.js — the live broadcast).
//   PAN: THE PAN REACHES THE SCREEN FROM ANYWHERE — with the line deep in the north the bowl's screen is drawn above the
//        world's top (y < 0); the pan to it now lets the camera above the world (`camTopV192E`) so the whole screen is in
//        the frame on the opponent's 5 and 1 as on the own 20; the allowance glides back to 0 after the snap (no jump);
//        TU v192Epan 0 shows the old failure (the screen cut off at the top).
//   PERSP: THE NEAR FIELD KEEPS CONVERGING — behind the anchor the field's width keeps growing toward the viewer at every
//        line of scrimmage (it was a constant: parallel touchlines); no row moves (every yard line's y is identical with the
//        kill switch), nothing in front of the anchor changes; TU v192Epersp 0 is the flat band again.
//   DIVOT: THE TURF REMEMBERS THE BIG HITS — a major collision digs a divot (`addDivotV192E`) under the men that lasts the
//        game: it survives the snap's re-projection, two hits on one spot deepen one, the count is capped, a new game wipes
//        it; a minor tackle does not dig; a live game with the threshold at 0 digs them from real tackles.
//   CROWD: THE HOME CROWD CHEERS THE HOME TEAM — on an away game a touchdown by YOUR team is a groan from the stands and
//        theirs is a cheer (and the faces match: no 🎉 for a groan); at home the reverse; a missed field goal is the
//        defense's moment; TU v192Ecrowd 0 restores the old polarity.
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v192Echeck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } })
await ctx.addInitScript(() => {
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { dayNightV144: 0, wxV144: 0, divotKbV192E: 0 })
  try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off'); localStorage.setItem('rib.sprayHint.v170', '1') } catch {}
  setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80)
})
const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e.message || e)))
await p.goto(U, { waitUntil: 'networkidle', timeout: 90000 })
await p.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V170, null, { timeout: 60000 })
await p.waitForTimeout(600); await p.evaluate(() => document.getElementById('splash')?.remove())
await p.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S)
  S.player = A.newPlayer(); const pl = S.player; pl.name = 'Test Man'; pl.pos = 'LB'; pl.age = 16; pl.originV11 = 'walk-on'; pl._wonShown = true; pl.level = 3
  for (const k in pl.attrs) pl.attrs[k] = 60; A.startSeasonGames(); window.go('season')
})
await p.waitForTimeout(400)
await p.evaluate(() => window.prepareWeek103(true)); await p.waitForTimeout(1200)
await p.evaluate(() => window.__v112SkipD())
await p.waitForFunction(() => window.S && window.S.view === 'live' && window.__gridironScene && window.__FIELDMAP_V72 && window.__gridironScene.fieldSpr && window.__gridironScene.stadium && window.__gridironScene.stadium.rect, null, { timeout: 120000 }).catch(() => null)

// ---- DIVOT (live): with the threshold at 0 every real tackle is "major" — the hook in the tackle event digs them
{
  let made = 0
  for (let i = 0; i < 400 && made < 1; i++) { await p.waitForTimeout(400); made = await p.evaluate(() => (window.__V192E && window.__V192E.made) || 0) }
  const L = await p.evaluate(() => { const sc = window.__gridironScene; return { made: (window.__V192E || {}).made || 0, n: (sc.divotsV192E || []).length, g: !!sc.divotG, depth: sc.divotG ? sc.divotG.depth : null, field: sc.fieldSpr.depth } })
  ok(L.made >= 1 && L.n >= 1 && L.g, 'DIVOT: a real tackle in a live game digs a divot (threshold at 0)', L)
  ok(L.depth > L.field && L.depth < 3.4, 'DIVOT: drawn on the turf — over the field art, under the lines, shadows and men', L)
}

await p.evaluate(() => { window.RIB_TUNE.divotKbV192E = 7; window.__gridironScene.scene.pause() })
const fyd = `const M = window.__FIELDMAP_V72, vd = M.pj(M.PLAY_R, 220).y < M.pj(M.PLAY_L, 220).y ? 1 : -1, fyd = (x) => vd > 0 ? x : 100 - x, fx = (y) => M.PLAY_L + fyd(y) / 100 * (M.PLAY_R - M.PLAY_L);`

// ---- PAN
const pan = (a, tune) => p.evaluate(({ a, tune, src }) => {
  // eslint-disable-next-line no-eval
  const M = window.__FIELDMAP_V72, vd = M.pj(M.PLAY_R, 220).y < M.pj(M.PLAY_L, 220).y ? 1 : -1, fyd = (x) => vd > 0 ? x : 100 - x
  Object.assign(window.RIB_TUNE, tune)
  const sc = window.__gridironScene
  sc._panV175 = null; sc._panTopV192E = null
  sc.drawField(fyd(a), fyd(Math.min(100, a + 10)))
  sc._camSoftV109 = 0; sc.resetCamera()
  sc._panV175 = { why: 'scoreboard', t: 0, wall: performance.now(), scored: false }
  for (let i = 0; i < 420; i++) sc.screenPanTickV175(16)
  const c = sc.cameras.main; c.preRender()
  const R = sc.stadium.rect, wv = c.worldView
  const inFrame = R.x >= wv.x - 1 && R.x + R.w <= wv.x + wv.width + 1 && R.y >= wv.y - 1 && R.y + R.h <= wv.y + wv.height + 1
  const out = { a, rectY: Math.round(R.y), rectH: Math.round(R.h), top: Math.round(wv.y), zoom: +c.zoom.toFixed(3), inFrame, boundsY: c._bounds ? c._bounds.y : null }
  // the snap: the camera glides home; the allowance above the world follows it down, never snapping the frame
  sc.screenPanSnapV175()
  let maxJump = 0, prev = c.midPoint.y; const f = sc.focusPt
  for (let i = 0; i < 400; i++) {
    sc.camSideV145(c)
    sc.camSpringV109(c, f.x, Math.max(f.y - 80, FVHh(c)), c.zoom, 16, 1)
    c.preRender(); maxJump = Math.max(maxJump, Math.abs(c.midPoint.y - prev) - 0); prev = c.midPoint.y
  }
  function FVHh (c) { return c.height / (2 * c.zoom) }
  out.after = { boundsY: c._bounds ? c._bounds.y : null, allowance: sc._panTopV192E ? sc._panTopV192E.top : 0, maxStep: +maxJump.toFixed(1) }
  for (const k in tune) delete window.RIB_TUNE[k]
  sc._panV175 = null
  return out
}, { a, tune: tune || {} })
const P = {}
for (const a of [20, 60, 95, 99]) P[a] = await pan(a)
console.log('pan: ' + JSON.stringify(P))
ok([20, 60, 95, 99].every((a) => P[a].inFrame), 'PAN: the whole screen is in the frame after the pan at the own 20, midfield, the opponent\'s 5 and 1', Object.values(P).map((r) => [r.a, r.rectY, r.top, r.inFrame]))
ok(P[95].rectY < 0 && P[99].rectY < 0 && P[95].boundsY < 0 && P[95].boundsY <= P[95].rectY, 'PAN: deep in the north the screen is above the world\'s top and the camera is let up to it', { r95: P[95].rectY, b95: P[95].boundsY, r99: P[99].rectY })
ok(P[20].boundsY === 0, 'PAN: where the screen is inside the world nothing about the bounds changes', P[20])
ok([95, 99].every((a) => P[a].after.boundsY === 0 && P[a].after.allowance === 0 && P[a].after.maxStep < 40), 'PAN: after the snap the allowance glides back to 0 with the camera (no jump)', [P[95].after, P[99].after])
const POFF = await pan(95, { v192Epan: 0 })
const PFLAT = await pan(95, { v192Epersp: 0 })
ok(Math.abs(PFLAT.rectY - P[95].rectY) <= 1 && Math.abs(PFLAT.rectH - P[95].rectH) <= 1, 'PERSP: the bowl and its screen stand exactly where they did (the near field\'s widening does not resize the stands)', { on: [P[95].rectY, P[95].rectH], flat: [PFLAT.rectY, PFLAT.rectH] })
ok(!POFF.inFrame && POFF.top >= 0,'PAN: TU v192Epan 0 is the old failure — the screen cut off at the world\'s top', POFF)

// ---- PERSP
const persp = (a, tune) => p.evaluate(({ a, tune }) => {
  const M = window.__FIELDMAP_V72, vd = M.pj(M.PLAY_R, 220).y < M.pj(M.PLAY_L, 220).y ? 1 : -1, fyd = (x) => vd > 0 ? x : 100 - x, fx = (y) => M.PLAY_L + fyd(y) / 100 * (M.PLAY_R - M.PLAY_L)
  Object.assign(window.RIB_TUNE, tune)
  const sc = window.__gridironScene
  sc.drawField(fyd(a), fyd(Math.min(100, a + 10)))
  const rows = []
  for (let y = a + 20; y >= -8; y -= 2) { const L = M.pj(fx(y), 20), R = M.pj(fx(y), 420); rows.push({ y, w: +Math.abs(R.x - L.x).toFixed(2), py: +M.pj(fx(y), 220).y.toFixed(2), lx: +L.x.toFixed(2) }) }
  for (const k in tune) delete window.RIB_TUNE[k]
  return { a, rows, anchorYd: a - 46 / 5.82, taper: !!(window.__V148 || {}).taper }
}, { a, tune: tune || {} })
const PS = {}
for (const a of [30, 60, 90, 99]) PS[a] = { on: await persp(a), off: await persp(a, { v192Epersp: 0 }) }
for (const a of [30, 60, 90, 99]) {
  const on = PS[a].on.rows, off = PS[a].off.rows, anc = PS[a].on.anchorYd
  const behind = on.filter((r) => r.y < anc - 1), behindOff = off.filter((r) => r.y < anc - 1)
  const grows = behind.every((r, i) => i === 0 || r.w > behind[i - 1].w + 0.05)
  const flatOff = behindOff.every((r) => Math.abs(r.w - behindOff[0].w) < 0.01)
  const sameRows = on.every((r, i) => Math.abs(r.py - off[i].py) < 0.01)
  const front = on.filter((r) => r.y > anc + 1).every((r) => { const o = off.find((q) => q.y === r.y); return Math.abs(o.w - r.w) < 0.01 })
  const ratio = behind.length ? +(behind[behind.length - 1].w / behind[0].w).toFixed(3) : null
  ok(behind.length >= 2 && grows, `PERSP: LOS ${a} — behind the anchor the field keeps WIDENING toward the viewer, row after row (converging lines)`, { n: behind.length, ratio, first: behind[0], last: behind[behind.length - 1] })
  ok(sameRows && front, `PERSP: LOS ${a} — no yard line moves up or down, and nothing in front of the anchor changes`, { sameRows, front })
  ok(behindOff.length < 2 || flatOff, `PERSP: LOS ${a} — TU v192Epersp 0 is v112's flat band (parallel)`, { flatOff })
}
{ // the touchline is one straight-ish line across the anchor: no kink (the slope on either side of the anchor matches)
  const on = PS[90].on.rows, anc = PS[90].on.anchorYd
  const slope = (a, b) => (b.lx - a.lx) / (b.py - a.py)
  const i = on.findIndex((r) => r.y < anc)
  const s1 = slope(on[i - 2], on[i - 1]), s2 = slope(on[i], on[i + 1])
  ok(Math.abs(s1 - s2) / Math.abs(s1) < 0.35, 'PERSP: the touchline carries on through the anchor without a kink (slopes either side within 35%)', { s1: +s1.toFixed(3), s2: +s2.toFixed(3) })
}
ok(Object.values(PS).every((x) => !x.on.taper), 'PERSP: no v148 taper runs at any line of scrimmage')

// ---- DIVOT (forced)
const D = await p.evaluate(() => {
  const sc = window.__gridironScene, M = window.__FIELDMAP_V72
  sc.divotsV192E = []
  const major = { tackle: sc.divotMajorV192E({ type: 'tackle', kb: 2, impact: 20 }), big: sc.divotMajorV192E({ bigHit: true }), stick: sc.divotMajorV192E({ hitStick: true }), kb: sc.divotMajorV192E({ kb: 9 }), gang: sc.divotMajorV192E({ gang: true, handsOn: 2 }), sack: sc.divotMajorV192E({ sack: true }) }
  const x = M.PLAY_L + 0.4 * (M.PLAY_R - M.PLAY_L), y = 200
  sc.addDivotV192E(x, y, 0.3, 1.2)
  sc.addDivotV192E(x + 3, y + 2, 0.3, 1)        // same spot: deepens, does not stack
  const merged = { n: sc.divotsV192E.length, w: +sc.divotsV192E[0].w.toFixed(2), hits: sc.divotsV192E[0].n }
  // the snap re-projects: the divot stays and is redrawn where the ground under it went
  const before = window.__V192E.drawn
  sc.drawWearV86({ quarter: 2 }); sc.drawField(55, 65); sc.drawWearV86({ quarter: 2 })
  const kept = { n: sc.divotsV192E.length, redrawn: window.__V192E.drawn > before }
  for (let i = 0; i < 80; i++) sc.addDivotV192E(M.PLAY_L + (i % 20) * 25, 60 + Math.floor(i / 20) * 80, 0, 1)
  const capped = sc.divotsV192E.length
  sc.drawWearV86({ quarter: 1 })               // a new game: the quarter goes back
  const wiped = sc.divotsV192E.length
  return { major, merged, kept, capped, cap: 36, wiped }
})
ok(!D.major.tackle && D.major.big && D.major.stick && D.major.kb && D.major.gang && D.major.sack, 'DIVOT: a routine wrap does not dig; a big hit, hit stick, knock-back, gang heap and sack do', D.major)
ok(D.merged.n === 1 && D.merged.hits === 2 && D.merged.w > 1.2, 'DIVOT: two hits on one spot deepen one divot', D.merged)
ok(D.kept.n === 1 && D.kept.redrawn, 'DIVOT: it lasts through the snap and is redrawn on the new projection', D.kept)
ok(D.capped === D.cap, 'DIVOT: the count is capped (the oldest goes)', D.capped)
ok(D.wiped === 0, 'DIVOT: a new game starts on fresh turf', D.wiped)
const DOFF = await p.evaluate(() => { const sc = window.__gridironScene; window.RIB_TUNE.v192Edivot = 0; const r = sc.addDivotV192E(300, 200, 0, 1); delete window.RIB_TUNE.v192Edivot; return { r: r === null, n: (sc.divotsV192E || []).length } })
ok(DOFF.r && DOFF.n === 0, 'DIVOT: TU v192Edivot 0 digs nothing', DOFF)

// ---- CROWD
const C = await p.evaluate(() => {
  const sc = window.__gridironScene, calls = []
  const orig = sc.crowdEmojiV98, origB = sc.crowdBubble
  sc.crowdEmojiV98 = function (good, atX, w, type) { calls.push({ good, type, pool: this.emoBookV101(type, good) }) }
  sc.crowdBubble = function () {}
  const run = (home, offense, type, extra) => { window.__homeGameV93 = home; calls.length = 0; sc.crowdReact(Object.assign({ type, x: 300 }, extra || {}), { payload: { offense } }); return calls[0] || null }
  const r = {
    homeYourTD: run(true, 'us', 'td'), homeTheirTD: run(true, 'them', 'td'),
    awayYourTD: run(false, 'us', 'td'), awayTheirTD: run(false, 'them', 'td'),
    awayYourPick: run(false, 'them', 'pick'), awayTheirPick: run(false, 'us', 'pick'),
    homeYourMissedFG: run(true, 'us', 'fgResult', { good: false }), homeYourFG: run(true, 'us', 'fgResult', { good: true }),
  }
  window.RIB_TUNE.v192Ecrowd = 0
  r.offAwayYourTD = run(false, 'us', 'td')
  delete window.RIB_TUNE.v192Ecrowd
  sc.crowdEmojiV98 = orig; sc.crowdBubble = origB; window.__homeGameV93 = true
  return r
})
const party = '🎉'
ok(C.homeYourTD.good && !C.homeTheirTD.good, 'CROWD: at home your touchdown is a cheer and theirs a groan', [C.homeYourTD.good, C.homeTheirTD.good])
ok(!C.awayYourTD.good && C.awayTheirTD.good, 'CROWD: on the road the HOME crowd groans at your touchdown and cheers theirs', [C.awayYourTD.good, C.awayTheirTD.good])
ok(!C.awayYourPick.good && C.awayTheirPick.good, 'CROWD: on the road your interception is a groan, theirs a cheer', [C.awayYourPick.good, C.awayTheirPick.good])
ok(!C.awayYourTD.pool.includes(party) && C.awayTheirTD.pool.includes(party), 'CROWD: the faces match — no 🎉 in a groan, 🎉 in the cheer', [C.awayYourTD.pool, C.awayTheirTD.pool])
ok(!C.homeYourMissedFG.good && C.homeYourFG.good, 'CROWD: your missed field goal at home is a groan, a make a cheer', [C.homeYourMissedFG.good, C.homeYourFG.good])
ok(C.offAwayYourTD.good, 'CROWD: TU v192Ecrowd 0 restores the old polarity (the stands cheer you everywhere)', C.offAwayYourTD.good)

ok(errors.length === 0, 'no page errors', errors.slice(0, 4))
console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
