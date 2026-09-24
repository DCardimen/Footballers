// Dev check: v109 C2 — THE FEET PLANT. Asserts, in one pass:
//   * THE PLANT — the sim emits `plant {who,x,y,fromY,toY,deg,hard,vel}` when the back's lane
//     moves, and the back's lateral motion after the plant goes the way the plant says.
//   * THE TURN — `mv()` emits `turn {who,deg,dir,vel}` for a moving man's real change of direction.
//   * DOWN MEN GO DOWN — a trucked or pancaked man emits `down {who,x,y,until,cause,dx,dy}` once,
//     with a clock in the future, and the slide is small.
//   * THE JOG RESUMES — `effort {kind:"resume"}` follows a jog / gives-up for a man back in the play.
//   * THE LIVE FIELD — `window.__V109_C2`: the lookahead planted men, the run cycle stalled on the
//     plant frame, men leaned into turns (> 0.1 rad), stumbles were drawn on the hurt frames, and no
//     running man's drawn facing flipped 180° in one frame.
//   GAME_URL=http://localhost:5173/ node scripts/v109C2check.mjs        (READ_POS=RB)
import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'
const URL = GAME_URL
const browser = await chromium.launch({ executablePath: CHROME })
const errs = [], bad = []
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(2500)   // warm: vite's one-time reload after an edit
await page.waitForFunction(() => typeof window.__simGameV2 === 'function', null, { timeout: 60000 })
await page.evaluate(p => { window.__readPos = p }, process.env.READ_POS || 'RB')
async function step(t) {
  const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
      : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className) || /RUN THIS PLAN|LOCK IT IN|CHOOSE/i.test(txt(e)))
      : els.find(e => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis })
  console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900)
}

// ================= 1. the sim: the events, with their fields =================
const S = await page.evaluate(() => {
  const FS = window.__FieldSim
  const ev = { plant: 0, plantOk: 0, plantHard: 0, plantAgree: 0, plantMeasured: 0, plantDeg: 0,
    turn: 0, turnOk: 0, turnDeg: 0, turnDirPos: 0, turnMeasured: 0, turnMoved: 0,
    down: 0, downOk: 0, downTruck: 0, downPancake: 0, downDup: 0, downFuture: 0, downSlide: 0, downSlideMax: 0, downMeasured: 0,
    jog: 0, givesUp: 0, resume: 0, resumeAfterJog: 0 }
  let plays = 0, carries = 0
  const scan = (entry) => {
    const log = entry && entry.log ? entry.log : entry; if (!log || !log.events) return
    const byId = {}; for (const a of (log.actors || [])) byId[a.id] = a
    const frameAt = (a, tt) => { let best = null; for (const fr of a.frames) { if (fr.t <= tt) best = fr; else break } return best }
    const jogged = new Set(), downSeen = new Set()
    let sawCarry = false
    for (const e of log.events) {
      if (e.type === 'handoff' || e.type === 'catch') sawCarry = true
      if (e.type === 'plant') { ev.plant++
        if (typeof e.who === 'string' && Number.isFinite(e.fromY) && Number.isFinite(e.toY) && Number.isFinite(e.deg) && typeof e.hard === 'boolean' && Number.isFinite(e.vel)) ev.plantOk++
        if (e.hard) ev.plantHard++
        ev.plantDeg += e.deg || 0
        // the lane moved: over the next 300ms his lateral motion goes the way the plant says
        const a = byId[e.who]
        if (a && a.frames) { const f0 = frameAt(a, e.t), f1 = frameAt(a, e.t + 300)
          if (f0 && f1 && f1.t > f0.t) { ev.plantMeasured++; const want = Math.sign(e.toY - e.fromY), got = Math.sign(f1.y - f0.y); if (want === got || Math.abs(f1.y - f0.y) < 1) ev.plantAgree++ } }
      }
      else if (e.type === 'turn') { ev.turn++
        if (typeof e.who === 'string' && Number.isFinite(e.deg) && (e.dir === 1 || e.dir === -1) && Number.isFinite(e.vel) && e.vel >= .5) ev.turnOk++
        ev.turnDeg += e.deg || 0; if (e.dir === 1) ev.turnDirPos++
        // a man who TURNED went somewhere: a body jittering on a reached spot does not
        const a = byId[e.who]
        if (a && a.frames) { const f0 = frameAt(a, e.t), f1 = frameAt(a, e.t + 132)
          if (f0 && f1 && f1.t > f0.t) { ev.turnMeasured++; if (Math.hypot(f1.x - f0.x, f1.y - f0.y) >= 3) ev.turnMoved++ } } }
      else if (e.type === 'down') { ev.down++
        const key = e.who + ':' + e.cause; if (downSeen.has(key + ':' + Math.floor(e.t / 900))) ev.downDup++; downSeen.add(key + ':' + Math.floor(e.t / 900))
        if (typeof e.who === 'string' && Number.isFinite(e.until) && (e.cause === 'truck' || e.cause === 'pancake') && Number.isFinite(e.dx) && Number.isFinite(e.dy)) ev.downOk++
        if (e.cause === 'truck') ev.downTruck++; else ev.downPancake++
        if (e.until > e.t) ev.downFuture++
        const a = byId[e.who]
        if (a && a.frames) { const f0 = frameAt(a, e.t), f1 = frameAt(a, Math.min(e.until, e.t + 400))
          if (f0 && f1) { const d = Math.hypot(f1.x - f0.x, f1.y - f0.y); ev.downMeasured++; ev.downSlide += d; ev.downSlideMax = Math.max(ev.downSlideMax, d) } }
      }
      else if (e.type === 'effort') {
        if (e.kind === 'jog') { ev.jog++; jogged.add(e.who) }
        else if (e.kind === 'givesUp') { ev.givesUp++; jogged.add(e.who) }
        else if (e.kind === 'resume') { ev.resume++; if (jogged.has(e.who)) ev.resumeAfterJog++ }
      }
    }
    if (sawCarry) carries++
  }
  const wrap = (name) => { const o = FS[name].bind(FS); FS[name] = function (...a) {
    const before = (FS._Q || []).length; const r = o(...a); plays++
    const q = FS._Q || []; for (let i = before; i < q.length; i++) scan(q[i])
    return r } }
  wrap('run'); wrap('pass')
  for (let i = 0; i < 10; i++) window.__simGameV2(60 + i, 'RB')
  return { plays, carries, ev }
})
const E = S.ev
console.log('sim:', JSON.stringify({ plays: S.plays, plant: E.plant, turn: E.turn, down: E.down, jog: E.jog, givesUp: E.givesUp, resume: E.resume }))
ok(S.plays >= 300, 'sampled 300+ sim plays', `${S.plays} plays`)
ok(E.plant > 100 && E.plantOk === E.plant, 'the back PLANTS before a lane change, with who/fromY/toY/deg/hard/vel on every one', `${E.plantOk}/${E.plant} well-formed, ${E.plantHard} hard, mean ${(E.plantDeg / Math.max(1, E.plant)).toFixed(0)}°`)
ok(E.plantMeasured > 50 && E.plantAgree > E.plantMeasured * 0.7, 'and the plant PRECEDES the lane change: his lateral motion afterwards goes the way the plant said', `${E.plantAgree}/${E.plantMeasured} agree`)
ok(E.plant < S.plays * 6, 'plants are rate-limited to a few per carry', `${(E.plant / Math.max(1, S.plays)).toFixed(2)} per play`)
ok(E.turn > 200 && E.turnOk === E.turn, 'mv() emits the TURN with who/deg/dir/vel, only for a moving man', `${E.turnOk}/${E.turn}, mean ${(E.turnDeg / Math.max(1, E.turn)).toFixed(0)}°`)
ok(E.turnMeasured > 200 && E.turnMoved > E.turnMeasured * 0.8, 'and the man who turned went somewhere — a body jittering on a reached spot is not a turn', `${E.turnMoved}/${E.turnMeasured} moved 3px+ in the next 132ms, ${(E.turn / Math.max(1, S.plays)).toFixed(1)} per play`)
ok(E.turnDirPos > E.turn * 0.3 && E.turnDirPos < E.turn * 0.7, 'and the turn goes both ways', `${E.turnDirPos} left-handed of ${E.turn}`)
ok(E.down >= 4 && E.downOk === E.down, 'down men are announced ONCE: down {who,x,y,until,cause,dx,dy}', `${E.downOk}/${E.down} (${E.downTruck} trucks, ${E.downPancake} pancakes)`)
ok(E.downFuture === E.down && E.downDup === 0, 'with the get-up clock in the future and no repeat announcement', `${E.downFuture} future, ${E.downDup} dups`)
ok(E.downMeasured > 0 && E.downSlide / Math.max(1, E.downMeasured) < 14 && E.downSlideMax < 30, 'and the down man slides a little, not across the field', `mean ${(E.downSlide / Math.max(1, E.downMeasured)).toFixed(1)}px, max ${E.downSlideMax.toFixed(1)}px`)
ok(E.jog + E.givesUp > 20, 'men still jog and give up on lost plays', `${E.jog} jogs, ${E.givesUp} gave up`)
ok(E.resume >= 2 && E.resumeAfterJog === E.resume, 'and the jog RESUMES — effort {kind:"resume"} for a man who had jogged and is back in it', `${E.resumeAfterJog}/${E.resume}`)

// ================= 2. the live field: the plant, the lean, the stumble, the crossover =================
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN']) await step(t)
let live = false
for (let i = 0; i < 6 && !live; i++) {
  for (const t of ['CONTINUE TO MATCH', 'Continue to Match', 'PLAY', 'CONTINUE']) {
    live = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length))
    if (live) break
    await step(t)
  }
  live = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length))
  if (!live) await page.waitForTimeout(2500)
}
ok(live, 'the broadcast came up')
// sample the drawn facing frame to frame ourselves too: a running man's bucket must never jump by PI in one frame
let hdFlips = 0, hdSamples = 0, plantTex = 0, hurtTex = 0, fallTex = 0, walkTex = 0, D = null
const dispatch = () => page.evaluate(() => { const sc = window.__gridironScene, P = sc && sc.play; if (!sc || !P || !P.script || P.t < (P.delay || 0)) return null
  const idx = sc.markers.findIndex((m, i) => i >= 11 && m && m.root && !m.forceState); if (idx < 0) return null
  const m = sc.markers[idx], who = 'def' + (idx - 11), T = Math.round(P.t)
  sc.fireEvent({ t: T, type: 'down', who, x: m.sx, y: m.sy, until: T + 900, cause: 'truck', dx: 1, dy: 0 }, P)
  const afterDown = { state: m.forceState, until: Math.round(m._downUntilV109 - m.tms), tex: null }
  sc.placeMarker(m, m.sx, m.sy, 16); afterDown.tex = m.tex
  sc.fireEvent({ t: T, type: 'effort', who, kind: 'jog', x: m.sx, y: m.sy }, P); const jog = m._effortV109
  sc.fireEvent({ t: T, type: 'effort', who, kind: 'resume', x: m.sx, y: m.sy }, P); const resume = m._effortV109
  // and the stumble: a bounce on a second free man, drawn once at running speed
  const j = sc.markers.findIndex((mm, i) => i >= 11 && i !== idx && mm && mm.root && !mm.forceState); let stumble = null
  if (j >= 0) { const m2 = sc.markers[j]
    sc.fireEvent({ t: T, type: 'bounce', who: 'def' + (j - 11), carrier: 'off9', x: m2.sx, y: m2.sy, glancing: true }, P)
    m2.sSm = 60; sc.placeMarker(m2, m2.sx + 1, m2.sy, 16); stumble = { tex: m2.tex, lean: m2._lean, src: m2._leanSrc, on: !!m2._stumbleV109 } }
  return { afterDown, jog, resume, stumble, V: JSON.parse(JSON.stringify(window.__V109_C2)) } })
for (let i = 0; i < 460; i++) {
  if (!D && i > 20) D = await dispatch()
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^CONTINUE$/i.test((x.innerText || '').trim()) && x.offsetParent); if (b) b.click() })
  const st = await page.evaluate(() => { const sc = window.__gridironScene; if (!sc || !sc.markers) return null
    let flips = 0, n = 0, plant = 0, hurt = 0, fall = 0, walk = 0
    for (const m of sc.markers) { if (!m || !m.root) continue
      // the per-marker record of the biggest facing step ever drawn in ONE frame (leanV109 keeps it)
      if (m._faceStepMaxV109 != null) { n++; if (m._faceStepMaxV109 > 2.6) flips++ }
      const tx = m.tex || ''; if (/_plant$/.test(tx)) plant++; if (/_hurt\d$/.test(tx)) hurt++; if (/_fall$/.test(tx)) fall++; if (/_walk\d$/.test(tx)) walk++ }
    return { flips, n, plant, hurt, fall, walk } })
  if (st) { hdFlips += st.flips; hdSamples += st.n; plantTex += st.plant; hurtTex += st.hurt; fallTex += st.fall; walkTex += st.walk }
  await page.waitForTimeout(70)
}
const V = await page.evaluate(() => window.__V109_C2 || null)
console.log('live:', JSON.stringify(V), 'sampled', { hdFlips, hdSamples, plantTex, hurtTex, fallTex, walkTex })
ok(!!V, 'the renderer exposes window.__V109_C2')
ok(V && V.plants > 0 && (V.plantBy.look || 0) > 0, 'the renderer LOOKED AHEAD and planted men before their cuts', V && JSON.stringify(V.plantBy))
ok(V && V.plantFrames > 0 && plantTex > 0, 'the plant frame (registered since v91, never drawn) is on the field with the cadence stalled', `${V && V.plantFrames} frames, ${plantTex} sampled`)
ok(V && V.leans.max > 0.1 && V.leans.n > 50, 'men LEAN into their turns', V && `max ${V.leans.max} rad over ${V.leans.n} frames`)
ok(V && V.stumbles > 0 && V.stumbleFrames > 0, 'contact breaks the stride: stumbles on the hurt frames', V && `${V.stumbles} stumbles, ${V.stumbleFrames} frames`)
ok(D && D.stumble && D.stumble.on && /_hurt\d$/.test(D.stumble.tex || '') && D.stumble.src === 'stumble' && Math.abs(D.stumble.lean || 0) > 0.1, 'a bounce puts the man on the hurt frames, leaning away from the contact', D && JSON.stringify(D.stumble))
ok(V && V.face.flips === 0 && V.face.max <= 1.62, 'no running man flipped 180° in one frame — the facing steps through the crossover', V && `max step ${V.face.max} rad, ${V.face.steps} capped, ${V.face.n} measured`)
ok(hdSamples > 500 && hdFlips === 0, 'and per marker, no one ever drew a one-frame reversal', `${hdFlips} markers of ${hdSamples} samples`)
ok(V && V.turns > 0, 'the renderer heard the sim\'s turns', V && `${V.turns}`)
// the down and the effort cases, dispatched deterministically at a live marker (a truck or a jog
// may not happen in any one sampled game): the fall frame, the sim's clock, the jog and its resume
console.log('dispatch:', JSON.stringify(D))
ok(D && D.afterDown && D.afterDown.state === 'fall' && /_fall$/.test(D.afterDown.tex || '') && D.afterDown.until > 800, 'a `down` drops him on the fall frame (registered since v91, never drawn) with the sim\'s own get-up clock', D && JSON.stringify(D.afterDown))
ok(D && D.jog === 'jog' && D.resume == null && D.V && D.V.downs > 0 && D.V.jogs > 0 && D.V.resumes > 0, 'an `effort` jog slows the cycle and its `resume` puts the full cadence back', D && `jog=${D.jog} resume=${D.resume}`)

console.log(JSON.stringify({ pass, fail, errors: errs.length, badRequests: bad.length }))
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errs.length || bad.length ? 1 : 0)
