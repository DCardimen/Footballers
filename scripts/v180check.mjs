// Dev check: v180 (src/05-field-renderer.js, src/07-career-app.js).
//   A: THE BOARD PLAYS AT ANY SPEED — at 4× the board's party plays its whole course (the post phase runs at the 1× pace
//      while a pan holds the screen; before, the next snap cut every party off after ~0.6 s)
//   B: the floodlights default to 60% (`__FIELD_FX.light`, the slider's default, the renderer's dial)
//   C: THE PLAY STAYS IN THE MIDDLE — over live Broadcast frames the ball rides the middle of the frame's height
//      (mean 0.44–0.56, 0 the top), not the bottom half
//   D: HALF TACKLES — a stop two men made is half a tackle each (solo stops whole), the line says so, a total reads 4.5;
//      TU v180D 0 = whole
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v180check.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const ALL_PANS = { speedGateV151A: 0, dayNightV144: 0, wxV144: 0, screenPanChanceV175: 1, screenPanGapV175: 0, partyKindsV177C: ['touchdown', 'turnover', 'intercepted', 'sack', 'bighit', 'scoreboard'] }
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
await ctx.addInitScript((tune) => {
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, tune)
  try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off'); localStorage.setItem('rib.sprayHint.v170', '1') } catch {}
  setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80)
}, ALL_PANS)
const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e.message || e)))
await p.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
await p.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V180, null, { timeout: 40000 })
await p.waitForTimeout(600); await p.evaluate(() => document.getElementById('splash')?.remove())

// B (before a career sets anything): the default lighting
const B = await p.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S)
  window.fieldFxSet && window.fieldFxSet('fxDepth', (window.__FIELD_FX || {}).depth || 0.78, 0) // re-push the settings
  return { light: (window.__FIELD_FX || {}).light, setting: S.settings ? S.settings.fxLight : undefined }
})
ok(B.light === 0.6 && B.setting == null, 'the floodlights default to 60% (no saved setting)', B)

// onto the live field
await p.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = A.getState()
  S.player = A.newPlayer(); const pl = S.player; pl.name = 'Test Man'; pl.pos = 'WR'; pl.age = 16; pl.originV11 = 'walk-on'; pl._wonShown = true; pl.level = 3
  for (const k in pl.attrs) pl.attrs[k] = 60; A.startSeasonGames(); window.go('season')
})
await p.waitForTimeout(400)
await p.evaluate(() => window.prepareWeek103(true)); await p.waitForTimeout(1200)
await p.evaluate(() => window.__v112SkipD())
const live = await p.waitForFunction(() => window.S && window.S.view === 'live' && window.__gridironScene && window.__gridironScene.stadium && window.__gridironScene.stadium.rect, null, { timeout: 60000 }).then(() => true).catch(() => false)
ok(live, 'the live field is up')
const B2 = await p.evaluate(() => { const sc = window.__gridironScene; return sc && sc.lightMulV100 ? { dial: (window.__FIELD_FX || {}).light } : null })
ok(B2 && B2.dial === 0.6, 'the renderer reads the 60% dial', B2)

// C: where the ball rides in the frame, live Broadcast at 1×
await p.evaluate(() => {
  window.setSpeed(1); window.camModeSet112 && window.camModeSet112(0)
  const sc = window.__gridironScene, orig = sc.camSpringV109; window.__vyV180 = []
  sc.camSpringV109 = function (cam) {
    const r = orig.apply(this, arguments), P = this.play
    try { if (P && !P.done && !P.post && P.t > (P.delay || 0) && this.ballSpr && !this._panV175) { const hh = cam.height / (2 * cam.zoom); window.__vyV180.push((this.ballSpr.y - (cam.midPoint.y - hh)) / (2 * hh)) } } catch (e) {}
    return r
  }
})
await p.waitForTimeout(16000)
const C = await p.evaluate(() => { const a = window.__vyV180 || []; const m = a.reduce((x, y) => x + y, 0) / Math.max(1, a.length); return { n: a.length, mean: +m.toFixed(3) } })
ok(C.n > 100 && C.mean >= 0.44 && C.mean <= 0.56, 'live Broadcast frames: the ball rides the middle of the frame, not the bottom half', C)

// A: at 4× the board's party plays its whole course (before v180 A the next snap cut every one off after ~0.6 s)
await p.evaluate(() => window.setSpeed(4))
let A = null
for (let i = 0; i < 360; i++) {
  A = await p.evaluate(() => { const V = window.__V177C || {}; return { speed: window.__getGridironLiveSpeed ? window.__getGridironLiveSpeed() : null, ended: V.ended || 0, log: (V.log || []).filter((x) => x && x.ended).slice(-4).map((x) => ({ ended: x.ended, ms: x.ms })) } })
  if (A.log.length >= 2) break
  await p.waitForTimeout(250)
}
ok(A && A.speed === 4 && A.log.length >= 2 && A.log.every((x) => x.ended === 'done' && x.ms >= 2000), 'at 4× the board\'s party plays its whole course (ended on its own, ≥ 2 s), not cut off by the next snap', A)

// D: half tackles
const D = await p.evaluate(() => {
  const V = window.__V180
  const gang = V.tkCredit({ tackler: 3, assist: 5 }), solo = V.tkCredit({ tackler: 3, assist: null }), zero = V.tkCredit({ tackler: 0, assist: 1 })
  const note = V.tkNote({ tackler: 3, assist: 5 }), fmt = V.fmtLead({ key: 'tackles' }, 4.5), fmtY = V.fmtLead({ key: 'yards' }, 4.5)
  window.RIB_TUNE.v180D = 0; const off = V.tkCredit({ tackler: 3, assist: 5 }); delete window.RIB_TUNE.v180D
  return { gang, solo, zero, note, fmt, fmtY, off }
})
ok(D.gang === 0.5 && D.zero === 0.5 && D.solo === 1, 'a gang tackle is half a tackle each (the man at index 0 too); a solo stop is whole', D)
ok(/½ tackle/.test(D.note) && D.fmt === '4.5' && D.fmtY === 5, 'the play line says "½ tackle" and a total reads 4.5 (other stats still round)', { note: D.note, fmt: D.fmt, yards: D.fmtY })
ok(D.off === 1, 'TU v180D 0: whole tackles', D.off)
// the game engine: a defender's season of games credits only whole and half tackles
const G = await p.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = A.getState(); const pl = S.player; pl.pos = 'LB'; pl.level = 4
  let tot = 0, halves = 0, bad = 0, games = 0
  for (let k = 0; k < 40; k++) {
    try { const r = window.__simGameV2(55 + (k % 20), 'LB'); const t = r && r.stat ? r.stat.tackle : null
      if (t == null) continue; games++; tot += t; if (t % 1) halves++; if (Math.round(t * 2) !== t * 2) bad++ } catch (e) {}
  }
  return { games, tot, halves, bad }
})
ok(G.games >= 10 && G.bad === 0 && G.halves > 0, 'simulated games credit whole and half tackles only — and some halves', G)

console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
if (errors.length) console.log('page errors:', errors.slice(0, 6))
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
