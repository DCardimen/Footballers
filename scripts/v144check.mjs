// Dev check: v144 — THE FIELD, THE GROUND, THE SKY AND THE AGE OF THE MAN ON IT. Drives into a
// live game and measures the scene itself — the hooks, the markers' drawn geometry and the warp
// canvas's own pixels — never a screenshot's existence:
//   A  the sprites are scaled by the COHORT'S AGE, half-size in Pee Wee and full by the DFL, and
//      the shrink is taken off the HEAD: a smaller man's feet stay on the same ground
//   B  the stall watchdog is budgeted against the play rate, so half speed no longer truncates a
//      long play into its result line
//   C  the field is never frozen between plays — the shuffle ticks and the men actually move
//   D  the uprights stand in a padded socket, on the field and in the kick overlay both
//   E  the ground runs out to the frame on all four sides: the far apron is drawn above the end
//      line, and the near one keeps going past the painting with the art's own grain
//   F  one pylon per end-zone corner, with the real-football set of eight behind a dial
//   G  two rectangular vomitories in the far bowl's corners, mirrored, beside the middle arch
//   H  weather you can see — rain, snow, a sunny afternoon, a clear night — pinned from Settings
//      over the week's own roll, and moving NOTHING the sim rolls
// Usage: npm run dev (or any static server on :5173), then: node scripts/v144check.mjs
//   env: GAME_URL, POS (default RB)
import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'
const GAME = GAME_URL
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(GAME, { waitUntil: 'networkidle', timeout: 40000 })
await page.waitForTimeout(1200)

const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const click = async (t) => {
  await page.evaluate(({ t, visSrc }) => { const v = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(v)
    const el = t === 'ARCH' ? els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
      : els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click() } }, { t, visSrc: vis })
  await page.waitForTimeout(800)
}
for (const s of ['START NEW CAREER', 'ARCH', (process.env.POS || 'RB') + ' ', 'Lock In Personality',
  'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await click(s)
for (let i = 0; i < 60; i++) { if (await page.evaluate(() => !!window.__gridironScene && !!window.__gridironScene.markers)) break; await page.waitForTimeout(400) }
await page.waitForTimeout(3000)
const live = await page.evaluate(() => !!window.__gridironScene && (window.__gridironScene.markers || []).length >= 22)
ok(live, 'the broadcast is up with both elevens on the field')
if (!live) { console.log('page errors:', errs.join('\n')); await browser.close(); process.exit(1) }

// ====================== A. THE AGE OF THE MAN ON THE FIELD ======================
const A = await page.evaluate(() => {
  const sc = window.__gridironScene, T = window.RIB_TUNE, H = window.__V144
  const tab = H.ageTable
  // the same marker, drawn at the same world spot, at the two ends of the table
  const m = sc.markers.find(x => x && x.root && x.root.visible) || sc.markers[0]
  // the container's ground plane is local y=24 (see placeMarker), so THAT is where his feet are
  const at = (k) => { m._ageKV144 = k; sc.placeMarker(m, m.sx, m.sy)
    return { s: +m.root.scale.toFixed(4), y: +m.root.y.toFixed(2),
             foot: +(m.root.y + 24 * m.root.scale).toFixed(2) } }
  const keep = m._ageKV144
  const grown = at(1), pee = at(tab[8]), teen = at(tab[14])
  m._ageKV144 = keep; sc.placeMarker(m, m.sx, m.sy)
  const keys = Object.keys(tab).map(Number).sort((a, b) => a - b)
  window.__LIVE_AGE_FORCE_V144 = 8
  const forced = H.ageK()
  window.RIB_TUNE.liveAgeV144 = 0; const off = H.ageK(); delete window.RIB_TUNE.liveAgeV144
  window.__LIVE_AGE_FORCE_V144 = 21; const near = H.ageK()
  delete window.__LIVE_AGE_FORCE_V144
  const stamped = sc.markers.filter(x => x && x._ageKV144 != null).length
  return { keys, tab, grown, pee, teen, forced, off, near, stamped, markers: sc.markers.length }
})
ok(A.keys[0] === 8 && A.keys[A.keys.length - 1] === 21 && A.keys.every((k, i) => !i || A.tab[k] > A.tab[A.keys[i - 1]]),
  'A: the age table runs 8 to 21 and never goes backwards', `${A.tab[8]} .. ${A.tab[21]}`)
ok(A.tab[8] <= 0.55 && A.tab[21] >= 0.97, 'A: a Pee Wee body is about half an adult one, and an about-to-declare body is nearly grown',
  `${Math.round(A.tab[8] * 100)}% -> ${Math.round(A.tab[21] * 100)}%`)
ok(Math.abs(A.pee.s / A.grown.s - A.tab[8]) < 0.02 && Math.abs(A.teen.s / A.grown.s - A.tab[14]) < 0.02,
  'A: and the drawn sprite really is that much smaller', `${(A.pee.s / A.grown.s).toFixed(3)} / ${(A.teen.s / A.grown.s).toFixed(3)}`)
ok(Math.abs(A.pee.foot - A.grown.foot) < 3 && Math.abs(A.teen.foot - A.grown.foot) < 3,
  'A: the shrink comes off the HEAD — a smaller man stands on the same ground, he does not sink into it',
  `foot ${A.grown.foot} -> ${A.pee.foot} (head ${A.grown.y} -> ${A.pee.y})`)
ok(A.forced === A.tab[8] && A.near === A.tab[21], 'A: the cohort age picks the factor out of the table', `${A.forced} / ${A.near}`)
ok(A.off === 1, 'A: and the kill-switch puts every man back to full size', A.off + '')
ok(A.stamped >= 22, 'A: every man on the field carries the factor, read ONCE a snap rather than 22 times a frame', `${A.stamped}/${A.markers}`)

// ====================== B. THE WATCHDOG IS BUDGETED ======================
const B = await page.evaluate(() => {
  const W = (window.__V144 || {}).watchdog, T = window.RIB_TUNE
  if (!W) return null
  const base = (T && T.basePlayRate) || 0.7, slow = (T && T.watchdogSlowestSpeed) || 0.5
  const post = (T && T.postPlayMs) || 1450
  return { W, need: W.span / (base * slow), old: W.dur * 2 + 4000, base, slow, post }
})
ok(!!B && B.W.ms > 0, 'B: the stall watchdog is armed with a budget it publishes', B ? `${B.W.ms}ms for ${B.W.span}ms of script` : 'no hook')
if (B) {
  ok(B.W.span >= B.W.dur + B.W.delay, 'B: the budget covers the whole play — the script, its delay and the gather after the whistle',
    `${B.W.span} >= ${B.W.dur} + ${B.W.delay}`)
  ok(B.W.ms > B.need, 'B: and it is longer than the play takes at the SLOWEST speed the game offers — half speed cannot truncate a play any more',
    `${Math.round(B.W.ms)}ms budget vs ${Math.round(B.need)}ms needed`)
  ok(B.W.rate > 0.05 && B.W.rate <= 1, 'B: the rate it divides by is the real one, floored so a zero speed cannot make the budget infinite', B.W.rate + '')
}

// ====================== C. NOTHING FREEZES BETWEEN PLAYS ======================
const C = await page.evaluate(async () => {
  const sc = window.__gridironScene
  // keyed on the MARKER OBJECT, never on its index: the per-play actors loop rebuilds the array
  // between snaps, so slot i before and slot i after are two different men
  /* WORLD coordinates (`m.sx/m.sy`), not screen: the shuffle is what moves those, while `root.x/y`
     also carries the camera, which opens up and re-frames between plays and can read as 200px/s of
     "sprinting" that no man did. Keyed on the MARKER OBJECT, never on its index — the per-play
     actors loop rebuilds the array between snaps, so slot i before and slot i after are two
     different men. */
  const snap = () => new Map(sc.markers.filter(m => m && m.root).map(m => [m, [m.sx, m.sy]]))
  const wait = (ms) => new Promise(r => setTimeout(r, ms))
  /* Sampled in SHORT steps and only ever between two samples that both fall with no play in hand:
   * the gap is about a second, and a snap landing inside a long window moves all twenty-two men
   * to their new alignment at once, which is not a shuffle and not this test's business. */
  const STEP = 90
  let tA = 0, tB = 0, moved = 0, n = 0, fastest = 0, spans = 0, everIdle = false
  for (let gap = 0; gap < 8 && spans < 4; gap++) {
    for (let i = 0; i < 140 && sc.play; i++) await wait(120)     // wait this play out
    if (sc.play) break
    everIdle = true
    let prev = snap(); if (!tA) tA = (window.__V144 || {}).idleTicks || 0
    for (let i = 0; i < 12 && spans < 4; i++) {
      await wait(STEP)
      if (sc.play) break                                          // the next snap has been called
      const now = snap(); spans++
      tB = (window.__V144 || {}).idleTicks || 0
      for (const [m, p0] of prev) {
        const p1 = now.get(m); if (!p1) continue
        n++
        const d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
        if (d > 0.3) moved++
        fastest = Math.max(fastest, d / (STEP / 1000))            // world units a second
      }
      prev = now
    }
  }
  return { idle: everIdle, spans, tA, tB, moved, n, fastest: +fastest.toFixed(1) }
})
const TU_IDLE = await page.evaluate(() => (window.RIB_TUNE && window.RIB_TUNE.idleShuffleSpeed) || 26)
ok(C.idle, 'C: the play ends and the scene keeps running')
ok(C.tB > C.tA, 'C: the between-plays tick keeps firing with no play in hand', `${C.tA} -> ${C.tB}`)
ok(C.moved >= 8, 'C: and men actually shuffle in the gap instead of standing to attention', `${C.moved} of ${C.n} samples moved over ${C.spans} windows`)
ok(C.spans >= 3 && C.fastest < TU_IDLE * 2, 'C: a shuffle, not a sprint — nobody breaks into a run between snaps', `fastest ${C.fastest} world units/s against a ${TU_IDLE}/s walk, over ${C.spans} windows`)

// ====================== D. THE UPRIGHTS STAND IN A PAD ======================
const D = await page.evaluate(() => {
  const P = (window.__V144 || {}).pads || [], T = window.RIB_TUNE
  const keep = T.postPadV144
  window.RIB_TUNE.postPadV144 = 0
  const sc = window.__gridironScene; try { sc.drawGoalpostsV87 && sc.drawGoalpostsV87() } catch (e) {}
  const after = ((window.__V144 || {}).pads || []).length
  window.RIB_TUNE.postPadV144 = keep
  return { pads: P, n: P.length, offAdded: after - P.length }
})
ok(D.n >= 2, 'D: both goalposts are drawn standing in a pad', `${D.n} pads`)
ok(D.pads.every(p => p.h > 0 && p.w > 0), 'D: every pad has real height and width at its own depth', D.pads.map(p => `${p.h}x${p.w}`).join(' '))
ok(new Set(D.pads.map(p => Math.round(p.y))).size >= 2, 'D: and there is one at each end of the field, at its own scale',
  D.pads.map(p => `y${Math.round(p.y)}@${p.s}`).join(' '))
ok(D.offAdded === 0, 'D: the dial takes it back off', `${D.offAdded} drawn with it off`)

// ====================== E. GRASS ON ALL FOUR SIDES ======================
const E = await page.evaluate(() => {
  const sc = window.__gridironScene, H = window.__V144 || {}
  const NS = window.__V112_B().nstop
  const cv = sc._warpCv, g = cv.getContext('2d', { willReadFrequently: true })
  // is the row just above the far end line GRASS, or is it backdrop? sample the middle third
  const rowGreen = (y) => { const d = g.getImageData(cv.width / 3 | 0, y, cv.width / 3 | 0, 1).data
    let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 1] > d[i] + 8 && d[i + 1] > d[i + 2] + 8 && d[i + 1] > 40) n++
    return n / (d.length / 4) }
  /* exactly the rows the hook says it drew, not a fixed three: how far the far apron reaches above
     the end line is a function of the projection, which moves with the snap's own line of
     scrimmage, so the count is 3 or 4 depending on the play */
  /* exactly the rows the far branch drew, and no more. It runs while `target <= 0`, i.e. from
     canvas row NSTOP itself UPWARD — so N rows means NS-0 .. NS-(N-1). Sampling NS-1 .. NS-N reads
     one row past the top of the apron, which is sky, and how far the apron reaches moves with the
     snap's own line of scrimmage, so a fixed count is wrong too. */
  const N = Math.max(0, (H.apron && H.apron.northRows) || 0)
  const far = []
  for (let i = 0; i < N; i++) far.push(rowGreen(NS - i))
  // and the near continuation: rows below where the PAINTING stopped
  const e = H.apron ? H.apron.edgeI : -1
  const near = e > 0 && e + 40 < cv.height ? [rowGreen(e + 8), rowGreen(e + 24)] : []
  // the continuation has GRAIN — two rows 1px apart are not the same scanline
  const rowOf = (y) => Array.from(g.getImageData(0, y, cv.width, 1).data)
  const grain = e > 0 && e + 40 < cv.height
    ? rowOf(e + 10).reduce((a, v, i) => a + Math.abs(v - rowOf(e + 11)[i]), 0) : 0
  return { apron: H.apron, far, near, grain, NS, h: cv.height }
})
ok(E.apron && E.apron.on, 'E: the apron extension is on')
ok(E.apron.northRows > 0, 'E: the far end draws the grass the art paints BEYOND the end zone — the stands no longer sit on the end line',
  `${E.apron.northRows} rows above the end line`)
ok(E.far.length >= 2 && E.far.every(v => v > 0.5), 'E: and every one of those rows really is green in the canvas', `${E.far.length} rows: ${E.far.map(v => v.toFixed(2)).join(' ')}`)
ok(E.apron.southRows > 200, 'E: the near end keeps going past where the painting stops, instead of falling into black',
  `${E.apron.southRows} rows of continuation`)
ok(E.near.length === 2 && E.near.every(v => v > 0.4), 'E: and that continuation is grass too', E.near.map(v => v.toFixed(2)).join(' '))
ok(E.grain > 0, 'E: it is the art\'s own rows cycled, not one scanline copied — adjacent rows differ', `${E.grain} of difference`)

// ====================== F. ONE PYLON A CORNER ======================
const F = await page.evaluate(() => {
  const sc = window.__gridironScene, keep = window.RIB_TUNE.pylonAllCornersV144
  const one = (window.__V144 || {}).pylons
  const mark = sc.side.items.length
  window.RIB_TUNE.pylonAllCornersV144 = 1; sc.sidePylons()
  const all = (window.__V144 || {}).pylons
  window.RIB_TUNE.pylonAllCornersV144 = keep
  for (const im of sc.side.items.splice(mark)) { try { im.destroy() } catch (e) {} }
  return { one, all }
})
ok(F.one === 4, 'F: four pylons — one upright marker on each end-zone corner, not the doubled pair the camera foreshortened into one', F.one + '')
ok(F.all === 8, 'F: and the dial puts the real-football set of eight back', F.all + '')

// ====================== G. THE CORNERS HAVE TUNNELS ======================
const G = await page.evaluate(() => {
  const sc = window.__gridironScene, keep = window.RIB_TUNE.cornerTunnelV144
  const on = (window.__V144 || {}).tunnels
  window.RIB_TUNE.cornerTunnelV144 = 0; sc.bowlTrimV112 && sc.crowd && sc.bowlTrimV112(sc.crowd.secs || [], sc.crowd.HH || 0)
  const off = (window.__V144 || {}).tunnels
  window.RIB_TUNE.cornerTunnelV144 = keep
  try { sc.buildCrowd && sc.buildCrowd() } catch (e) {}
  return { on, off }
})
ok(G.on && G.on.corners === 2, 'G: two vomitories in the far bowl, one in each upper corner', G.on ? G.on.corners + '' : 'none')
ok(G.on.mid, 'G: beside the middle arch, which is untouched')
ok(G.on.cornerW.every(w => w > 4) && G.on.cornerH.every(h => h > 4),
  'G: both are real rectangular openings, wide and tall enough to read at phone width', `${G.on.cornerW.map(Math.round)} x ${G.on.cornerH.map(Math.round)}`)
ok(Math.abs(G.on.cornerW[0] - G.on.cornerW[1]) < 2 && Math.abs(G.on.cornerH[0] - G.on.cornerH[1]) < 2,
  'G: and they are mirrored — the same mouth on both sides', `${G.on.cornerW} / ${G.on.cornerH}`)
ok(G.off && G.off.corners === 0, 'G: the dial takes them back out', G.off ? G.off.corners + '' : '?')

// ====================== H. WEATHER YOU CAN SEE ======================
const H = await page.evaluate(async () => {
  const sc = window.__gridironScene
  const L = window.__WX_MODES_V144 || []
  const set = async (i) => { window.wxModeSet144(i); await new Promise(r => setTimeout(r, 420))
    const w = (window.__V144 || {}).wx
    return { precip: w.precip, day: w.day, drops: w.drops, stars: (sc._starsV112 || {}).n, wx: window.__WX_V79 } }
  const keepSet = (window.o && window.o.settings && window.o.settings.fxWx) || 0
  const night = await set(1), rain = await set(2), snow = await set(3), day = await set(4)
  // the baked turf, lit: how much light is on the grass by night and by day
  const NS = window.__V112_B().nstop
  // down the WHOLE playing surface, not one row: the night rig lights the far end hard and the
  // near end barely at all, so a single row says more about where it was taken than about the sky
  const turf = () => { const cv = sc._warpCv, g = cv.getContext('2d', { willReadFrequently: true })
    let s = 0, n = 0
    for (const f of [0.08, 0.2, 0.35, 0.5, 0.65]) {
      const d = g.getImageData(0, Math.round(NS + (cv.height - NS) * f), cv.width, 1).data
      for (let i = 0; i < d.length; i += 4) { s += (d[i] + d[i + 1] + d[i + 2]) / 3; n++ }
    }
    return +(s / n).toFixed(1) }
  window.wxModeSet144(1); const tNight = turf()
  window.wxModeSet144(4); const tDay = turf()
  // the layer survives the whistle: the drops keep being drawn with no play in hand
  window.wxModeSet144(2); await new Promise(r => setTimeout(r, 300))
  for (let i = 0; i < 120 && sc.play; i++) await new Promise(r => setTimeout(r, 150))
  const gapTicks = (window.__V144 || {}).wx.ticks
  await new Promise(r => setTimeout(r, 500))
  const gapAfter = (window.__V144 || {}).wx
  // the kill-switch
  window.RIB_TUNE.wxV144 = 0; await new Promise(r => setTimeout(r, 300))
  const off = (window.__V144 || {}).wx
  delete window.RIB_TUNE.wxV144
  window.wxModeSet144(keepSet)
  return { L, night, rain, snow, day, tNight, tDay, gapTicks, gapAfter, off }
})
ok(H.L.length === 5 && H.L[0].id === 'auto', 'H: Settings offers the week\'s own roll plus four skies to pin', H.L.map(m => m.n).join(' / '))
ok(H.night.precip === 'none' && !H.night.day && H.rain.precip === 'rain' && H.snow.precip === 'snow' && H.day.day,
  'H: and each one pins what it says on the button', `${H.night.precip}/${H.rain.precip}/${H.snow.precip}/day=${H.day.day}`)
ok(H.rain.drops > 50 && H.snow.drops > 50, 'H: rain and snow put real particles in the frame', `${H.rain.drops} drops / ${H.snow.drops} flakes`)
ok(H.night.drops === 0 && H.day.drops === 0, 'H: a clear sky puts none there', `${H.night.drops} / ${H.day.drops}`)
ok(H.night.stars > 20 && H.day.stars === 0, 'H: the stars are out at night and gone in the afternoon', `${H.night.stars} -> ${H.day.stars}`)
ok(H.tDay > H.tNight * 1.15, 'H: and the grass is genuinely lit by day, not a night game with a blue sky over it',
  `turf luma ${H.tNight} -> ${H.tDay}`)
ok(H.gapAfter.ticks > H.gapTicks, 'H: the weather does not stop for the whistle — it is not one of the per-play effects',
  `${H.gapTicks} -> ${H.gapAfter.ticks} with no play in hand`)
ok(H.off.precip === 'none' && !H.off.day, 'H: the kill-switch puts the old clear night back', `${H.off.precip}/${H.off.day}`)
ok(H.rain.wx === H.night.wx && H.day.wx === H.night.wx,
  'H: and pinning a look never touches the week\'s ROLLED weather, which is the only thing the sim reads', `__WX_V79 stays ${H.night.wx}`)

console.log(JSON.stringify({ pass, fail, errors: errs.length,
  age: { pee: A.tab[8], drawn: +(A.pee.s / A.grown.s).toFixed(3), foot: +(A.pee.foot - A.grown.foot).toFixed(2) },
  watchdog: B && B.W, idle: { moved: C.moved, fastest: C.fastest, spans: C.spans, walk: TU_IDLE }, pads: D.n,
  apron: E.apron, pylons: F, tunnels: G.on, wx: { night: H.tNight, day: H.tDay, drops: [H.rain.drops, H.snow.drops] } }))
console.log('page errors:', errs.length ? errs.slice(0, 4).join('\n') : 'none')
await browser.close()
process.exit(fail ? 1 : 0)
