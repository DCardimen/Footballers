// Dev check: v109 E — THE BROADCAST. Drives a real career onto the live field and, over a run of
// ≥8 plays, reads the renderer's own hook (window.__V109_E) and the scene state to prove:
//   1. THE CAMERA is a critically damped spring: its per-frame pan acceleration never exceeds a
//      bound (cam.maxJerk), it led the carrier along his heading (cam.leadFrames), it pulled WIDE
//      on the whistle (cam.whistleWide > 0) and re-aimed softly for the next snap (cam.softResets).
//   2. SHADOWS STAY UNDER THE BODIES: after resolveOverlaps every nudged man's shadow sits where a
//      cast from his nudged feet puts it (≤1 px), and the nudge is recorded on him.
//   3. TEAMMATES HELP EACH OTHER UP: helpUps > 0 and the helper walked over on the walk cycle.
//   4. CELEBRATION VARIETY: ≥2 celebrants on a touchdown (a scoring row is forced when the game
//      does not supply one) and the bench surged.
//   5. THE HUDDLE BREAKS BY POSITION: the recorded break timestamps differ by tier (line first, QB last).
//   6. THE CREW SPOTS THE BALL: spots > 0, an official arrived at a spot, the chains moved on a first down.
//   7. THE QB'S EYES AND THE FRONT'S CHESS: eyes turned and snapped back before the throw (the v107
//      arm still fired from `up`), and the pickup / blitz / linebackerDrop cases fired.
//   node scripts/v109Echeck.mjs        (GAME_URL=http://localhost:5186/, READ_POS=RB, V109_MS=150000)
import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'
const URL = GAME_URL
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(2000)   // warm: vite's one-time reload after an edit
await page.waitForFunction(() => typeof window.__simGameV2 === 'function', null, { timeout: 60000 })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const POS = process.env.READ_POS || 'RB'
async function step(t) { let r = null; try { r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
  let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t))
  if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis }) } catch (e) { r = 'ERR ' + e.message }
  console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900) }

// ================= 0. the sim emits what the renderer now answers =================
const sim = await page.evaluate(() => {
  const FS = window.__FieldSim, n = {}; let plays = 0
  const scan = (entry) => { const log = entry && entry.log ? entry.log : entry; if (!log || !log.events) return; for (const e of log.events) n[e.type] = (n[e.type] || 0) + 1 }
  const wrap = (name) => { const o = FS[name].bind(FS); FS[name] = function (...a) { const b4 = (FS._Q || []).length; const r = o(...a); plays++; const q = FS._Q || []; for (let i = b4; i < q.length; i++) scan(q[i]); return r } }
  wrap('run'); wrap('pass')
  for (let i = 0; i < 6; i++) window.__simGameV2(60 + i, 'RB')
  const pick = (k) => n[k] || 0
  return { plays, pickup: pick('pickup'), blitz: pick('blitz'), linebackerDrop: pick('linebackerDrop'), penetrate: pick('penetrate'), doubleTeam: pick('doubleTeam'), pocketSlide: pick('pocketSlide'), spring: pick('spring'), cutback: pick('cutback'), look: pick('look'), read: pick('read') }
})
console.log('sim events:', JSON.stringify(sim))
ok(sim.plays > 200 && sim.linebackerDrop > 0 && sim.blitz > 0 && sim.pickup > 0 && sim.look > 0, 'the sim emits the front-seven events the renderer used to ignore', JSON.stringify(sim))

// ================= 1. the live field =================
await page.evaluate(p => { window.__readPos = p }, POS)
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
let scene = false
for (let i = 0; i < 150; i++) { scene = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length)); if (scene) break
  if (i === 20 || i === 50 || i === 90) { await step('CONTINUE TO MATCH'); await step('Continue') }   // the flow can stall on a card the first pass missed
  await page.waitForTimeout(500) }
console.log('scene:', scene)

// how far every man's shadow sits from a cast taken at the feet he is standing on RIGHT NOW,
// split into the men resolveOverlaps pushed this frame and the men it did not (the control).
// A freeze-frame is skipped: update returns before placeMarker and resolveOverlaps run, so there
// is no nudge to measure and the mast's own shimmer has moved on since the cast.
await page.evaluate(() => { window.__shadowV109 = (sc) => {
  const out = { nud: [], ctl: [] }
  if (!sc || !sc._klV99 || sc.hitStop > 0) return out
  for (const m of (sc.markers || [])) { if (!m || !m.root || !m.shadow || !m.shadow.scene) continue
    let lift = 0; if (m._launchUntil && m.tms < m._launchUntil) { const kk = (m.tms - (m._launchT0 || m.tms)) / (m._launchUntil - (m._launchT0 || m.tms)); lift = Math.sin(Math.max(0, Math.min(1, kk)) * Math.PI) * (m._launchH || 11) }
    const H = ((window.RIB_TUNE && window.RIB_TUNE.shadowManH) || 21), DK = ((window.RIB_TUNE && window.RIB_TUNE.shadowDownK) || 0.45)
    const V = sc.shadowVecV99(m.root.x, m.root.y + lift * m.root.scale); if (!V) continue
    const at = (h) => { const len = h * V.slope; return Math.hypot(m.shadow.x - V.ux * len * 0.5, m.shadow.y - (24 + lift + V.uy * len * 0.5)) }
    const d = Math.min(at(H), at(H * DK))
    if (m._nudgeV109) { out.nud.push(d); if (d > 1) (window.__shBad = window.__shBad || []).push({ d: +d.toFixed(2), st: String(m.forceState || ''), nudge: +Math.hypot(m._nudgeV109.dx, m._nudgeV109.dy).toFixed(2), spd: Math.round(m._spdPx || 0) }) }
    else out.ctl.push(d) }
  return out } })
const MS = +(process.env.V109_MS || 150000), t0 = Date.now()
const tokens = new Set(); let shadowSamples = 0, shadowBad = 0, shadowMaxOff = 0, nudgedSeen = 0, fdSeen = 0, forcedTD = null, forcedCases = null, walkTexFrames = 0, refAtSpot = 0, last = null
let ctlSamples = 0, ctlMax = 0
while (Date.now() - t0 < MS) {
  const st = await page.evaluate(() => { const sc = window.__gridironScene; if (!sc) return null
    const P = sc.play, ms = sc.markers || [], V = window.__V109_E || null
    const S = window.__shadowV109(sc)
    const walkTex = ms.filter(m => m && m.tex && /_walk[01]$/.test(m.tex)).length
    const refSpot = (sc.refs || []).filter(r => r._spotTgt && r._spotTgt.there).length
    return { V, sh: S.nud, ctl: S.ctl, walkTex, refSpot, token: P && P.__ballTokenV1514, fd: !!(P && P.fdConverted), live: !!(P && !P.done && P.snapped && P.carrierId != null && P.t > (P.delay || 0) + 300), gap: !P, ev: P && P.payload && P.payload.event, t: P && P.t } })
  if (st) { last = st; if (st.token) tokens.add(st.token); if (st.fd) fdSeen++
    for (const d of st.sh) { shadowSamples++; if (d > 1) shadowBad++; if (d > shadowMaxOff) shadowMaxOff = d }
    for (const d of (st.ctl || [])) { ctlSamples++; if (d > ctlMax) ctlMax = d }
    nudgedSeen += st.sh.length; walkTexFrames += st.walkTex; refAtSpot += st.refSpot
    // force the touchdown once the ordinary plays have been sampled: a scoring row through the scene's
    // own animatePlay in the gap between plays; if the app's next snap tears it down first, the
    // scorer's own celebrate() on a live carrier is the same path the plane crossing takes
    if (!forcedTD && Date.now() - t0 > MS * 0.55 && (!st.V || (st.V.lastCelebrants || 0) < 2)) {
      if (st.gap) { forcedTD = 'row'; await page.evaluate(() => { const sc = window.__gridironScene; if (!sc) return
        sc.animatePlay({ offense: 'us', startBall: 92, endBall: 100, yards: 8, event: 'run', desc: 'TOUCHDOWN', scored: true, playerPos: 'RB', involved: true, down: 1, preToGo: 8, noHuddle: true }, () => {}) }) }
    }
    if (forcedTD === 'row' && Date.now() - t0 > MS * 0.8 && (!st.V || (st.V.lastCelebrants || 0) < 2) && st.live) { forcedTD = 'row+celebrate'
      await page.evaluate(() => { const sc = window.__gridironScene, P = sc && sc.play, cm = P && P.carrierId != null ? sc.markers[P.carrierId] : null; if (cm) sc.celebrate(cm.sx, cm.sy) }) }
    // the front's cases are natural events on pass plays; if the sample was all runs, fire them once through fireEvent
    if (!forcedCases && Date.now() - t0 > MS * 0.9 && st.live && st.V && !(st.V.cases.pickup && st.V.cases.blitz && st.V.cases.linebackerDrop)) { forcedCases = { ...st.V.cases }
      await page.evaluate(() => { const sc = window.__gridironScene, P = sc && sc.play; if (!P) return
        for (const e of [{ type: 'blitz', who: 'def4' }, { type: 'pickup', by: 'off9', on: 'def4' }, { type: 'linebackerDrop', who: 'def5', delay: 300 }]) sc.fireEvent(e, P) }) }
  }
  await page.waitForTimeout(70)
}
// post-loop, deterministic: wait for a live play and put the three named events through fireEvent
// if the sampled game did not happen to produce them, and wait for the crew before the measurement
for (let i = 0; i < 25; i++) {
  const c = await page.evaluate(() => ((window.__V109_E || {}).cases) || {})
  if (c.pickup && c.blitz && c.linebackerDrop) break
  if (!forcedCases) forcedCases = { ...c }
  await page.evaluate(() => { const sc = window.__gridironScene, P = sc && sc.play; if (!P || !sc.markers || !sc.markers.length) return
    for (const e of [{ type: 'blitz', who: 'def4' }, { type: 'pickup', by: 'off9', on: 'def4' }, { type: 'linebackerDrop', who: 'def5', delay: 300 }]) sc.fireEvent(e, P) })
  await page.waitForTimeout(400) }
const V = await page.evaluate(() => window.__V109_E || {})
const cases = V.cases || {}
console.log('hook:', JSON.stringify({ cam: V.cam, helpUps: V.helpUps, helpUpArrivals: V.helpUpArrivals, walkFrames: V.walkFrames, celebrations: V.celebrations, celebrants: V.celebrants, lastCelebrants: V.lastCelebrants, walkOffs: V.walkOffs, surges: V.surges,
  huddle: V.huddle && { staggered: V.huddle.staggered, walkFrames: V.huddle.walkFrames, breaks: (V.huddle.breaks || []).map(b => b.pos + ':' + b.at).join(' ') }, spots: V.spots, spotArrivals: V.spotArrivals, chainMoves: V.chainMoves, measures: V.measures, shadows: V.shadows, eyes: V.eyes, eyeSnaps: V.eyeSnaps, cases }))
console.log('sampled:', JSON.stringify({ plays: tokens.size, shadowSamples, shadowBad, shadowMaxOff: +shadowMaxOff.toFixed(3), nudgedSeen, walkTexFrames, refAtSpot, fdFrames: fdSeen, forcedTD, forcedCases }))
// the switch, on a pile built on purpose rather than one waited for: stack six men on one point,
// let resolveOverlaps push them apart, and measure the shadows with the follow off and then on
const sw = await page.evaluate(() => { const sc = window.__gridironScene
  if (!sc || !(sc.markers || []).length) return null
  sc.hitStop = 0; sc.shadowVecV99(360, 220)                       // the light cache the sampler reads
  const ms = sc.markers.slice(0, 6), bx = ms[0].sx, by = ms[0].sy
  const stack = () => ms.forEach((m, i) => sc.placeMarker(m, bx + i * 0.6, by + i * 0.4, 16))
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { shadowFollowV109: 0 })
  stack(); sc.resolveOverlaps()
  const off = window.__shadowV109(sc).nud
  delete window.RIB_TUNE.shadowFollowV109
  stack(); sc.resolveOverlaps()
  const on = window.__shadowV109(sc).nud
  return { n: off.length, off: +Math.max(0, ...off).toFixed(2), on: +Math.max(0, ...on).toFixed(2) } })
const offSamples = (sw && sw.n) || 0, offMax = (sw && sw.off) || 0, onMax = (sw && sw.on) || 0
console.log('the switch, on a built pile:', JSON.stringify(sw))
const bob = await page.evaluate(() => { const sc = window.__gridironScene
  if (!sc || !sc.markers) return null
  const m = sc.markers.find(m => m && m.bob && m.bob.active && m.root)
  if (!m) return null
  sc.resolveOverlaps()
  const sc0 = m.root.scale, want = m.root.y - ((window.RIB_TUNE && window.RIB_TUNE.bobLift) || 31) * sc0 + Math.sin(m.tms / 380) * 2 * sc0
  const flat = m.root.y - ((window.RIB_TUNE && window.RIB_TUNE.bobLift) || 31) * sc0
  const ring = m.ring && m.ring.active ? +Math.abs(m.ring.scaleX - sc0).toFixed(3) : null
  return { err: +Math.abs(m.bob.y - want).toFixed(3), float: +Math.abs(want - flat).toFixed(3), ringScaleErr: ring } })
console.log('plumbob after the nudge:', JSON.stringify(bob))
const shBad = await page.evaluate(() => (window.__shBad || []).slice(0, 6))
console.log('shadow outliers:', JSON.stringify(shBad))
// the chain crew and the measurement are dead-ball dressing the sampled window may never have hit:
// drive both through the scene directly and prove the sideline props actually moved
for (let i = 0; i < 30; i++) { const r = await page.evaluate(() => ((window.__gridironScene || {}).refs || []).length)
  if (r >= 7) break; await page.waitForTimeout(400) }   // the crew is spawned per play: the measurement needs them on the field
const chain = await page.evaluate(() => { const sc = window.__gridironScene, S = sc && sc.side
  if (!sc || !S || !sc.chainWalkV109) return { side: false, props: 0, moved: 0, measures: 0 }
  const before = S.items.filter(im => im._side && (/^down\d$/.test(im._side.name) || im._side.name === 'chain_rod')).map(im => [im.x, im.y])
  const n = sc.chainWalkV109((typeof PLAY_L === 'number' ? PLAY_L : 66) + 300, 1)
  sc.measureV109({ x: 360, y: 220 }, 1)
  return { side: true, props: before.length, moved: n, measures: (window.__V109_E || {}).measures || 0 } })
await page.waitForTimeout(1500)
const chainAfter = await page.evaluate(() => { const sc = window.__gridironScene, S = sc && sc.side
  if (!sc || !S) return { pos: [], meas: 0, drawn: false }
  return { pos: S.items.filter(im => im._side && (/^down\d$/.test(im._side.name) || im._side.name === 'chain_rod')).map(im => [Math.round(im.x), Math.round(im.y)]),
    meas: (sc.refs || []).filter(r => r._spotTgt && r._spotTgt.kind === 'measure').length, drawn: !!(sc.measG && sc.measG.commandBuffer && sc.measG.commandBuffer.length) } })
const V2 = await page.evaluate(() => window.__V109_E || {})
console.log('chain/measure:', JSON.stringify(chain), JSON.stringify(chainAfter), 'chainMoves now', V2.chainMoves)
const throws = await page.evaluate(() => ((window.__V107 || {}).throws || []).map(r => ({ facing: r.facing, dir: r.dir, res: r.residualMs }))).catch(() => [])
console.log('v107 throws:', JSON.stringify(throws.slice(-8)))

ok(scene && tokens.size >= 8, 'a live game of at least eight plays was watched', `${tokens.size} plays`)
// 1. the camera
const cam = V.cam || {}
const jerkBound = +(process.env.V109_JERK || 32000)
ok(cam.frames > 200 && cam.maxJerk > 0 && cam.maxJerk < jerkBound && (cam.maxStepPx || 0) < 70,
  'the camera is a spring: the acceleration it puts into its own pan velocity stayed under the bound, and no single frame jumped the frame',
  `maxJerk=${cam.maxJerk} px/s² · biggest step ${cam.maxStepPx} px · ${cam.frames} frames (bound ${jerkBound})`)
ok(cam.leadFrames > 0, 'and it framed the carrier in the leading third along his heading', `${cam.leadFrames} lead frames`)
ok(cam.whistleWide > 0 && cam.wideFrames > 0, 'and pulled WIDE on the whistle for the gather', `${cam.whistleWide} whistles · ${cam.wideFrames} wide frames`)
ok(cam.softResets > 0, 'and re-aimed for the next snap through the glide instead of snapping', `${cam.softResets} soft resets`)
ok(cam.cuts > 0, 'the v98 handover cut still fires', `${cam.cuts} cuts`)
// 2. shadows
ok(nudgedSeen > 0 && (V.shadows || {}).recast > 0, 'bodies were nudged apart in piles and their shadows re-cast from the nudged feet', JSON.stringify(V.shadows))
ok(shadowSamples > 200 && shadowMaxOff <= Math.max(1, ctlMax + 0.02), 'a nudged man\'s shadow sits as tightly under him as a man who was never nudged (≤1 px, or the frame\'s own floor)',
  `nudged ${shadowSamples} samples max ${shadowMaxOff.toFixed(2)} px · control ${ctlSamples} samples max ${ctlMax.toFixed(2)} px`)
// the shadow and the fill are CHILDREN of the nudged container, so they travel with the body: what
// the nudge left stale is the cast itself — its direction and length were solved for the feet he
// stood on before the push. shadowFollowV109=0 leaves that residual in; the recast takes it out.
ok(offSamples >= 4 && offMax > onMax && onMax <= 0.02, 'and shadowFollowV109=0 leaves the stale cast in — the recast re-solves it at the feet he was pushed to',
  `${offSamples} men pushed apart: ${offMax} px of residual mis-cast with the follow off, ${onMax} px with it on`)
ok(!bob || (bob.err <= 0.01 && bob.float > 0), 'the plumbob keeps its float and the ring its scale through the nudge (neither is a child of the pushed container)',
  bob ? `bob off by ${bob.err} px with a ${bob.float} px float in play · ring scale err ${bob.ringScaleErr}` : 'no you-marker on screen to measure')
// 3. help-ups
ok((V.helpUps || 0) > 0, 'a downed man got a teammate walking over to help him up', `${V.helpUps} help-ups · ${V.helpUpArrivals} arrivals`)
ok((V.walkFrames || 0) > 0 && walkTexFrames > 0, 'and the walk was drawn on the walk cycle (m._walk → walk0/1)', `${V.walkFrames} walk frames · ${walkTexFrames} sampled with a walk texture`)
// 4. the celebration
ok((V.celebrations || 0) > 0 && (V.lastCelebrants || 0) >= 2, 'a touchdown had at least two celebrants (the scorer and the men who ran to him)', `${V.celebrations} celebrations · last had ${V.lastCelebrants} · joined ${V.celebrants} · via ${forcedTD || 'the game'} · ${JSON.stringify(V.lastJoin || {})}`)
ok((V.surges || 0) > 0 && (V.walkOffs || 0) > 0, 'the bench surged on the score and the other eleven were sent off at a walk', `${V.surges} surges · ${V.walkOffs} walk-offs`)
// 5. the huddle
const br = (V.huddle && V.huddle.breaks) || []
const tierAt = (t) => br.filter(b => b.tier === t).map(b => b.at)
const lineMax = Math.max(-1, ...tierAt(0)), qbAt = Math.min(1e9, ...tierAt(3)), wrMin = Math.min(1e9, ...tierAt(2))
ok((V.huddle || {}).staggered > 0 && br.length >= 20 && lineMax >= 0 && qbAt < 1e9 && lineMax < wrMin && wrMin < qbAt, 'the huddle broke by position: the line first, the receivers after, the quarterback last', `line ≤${lineMax}ms · WR ≥${wrMin === 1e9 ? '-' : wrMin}ms · QB ${qbAt === 1e9 ? '-' : qbAt}ms (${br.length} men)`)
ok((V.huddle || {}).walkFrames > 0, 'and the men walked out of the break before the trot', `${(V.huddle || {}).walkFrames} walk frames`)
// 6. the crew
ok((V.spots || 0) > 0 && (V.spotArrivals || 0) > 0 && refAtSpot > 0, 'an official went to the ball on the dead-ball spot and planted there', `${V.spots} spots · ${V.spotArrivals} arrivals · ${refAtSpot} sampled frames at the spot`)
ok(chain.side && chain.moved >= 3 && (V2.chainMoves || 0) > 0, 'the chain crew walks to a new line (the down marker and both rods)', `${chain.moved} props moved of ${chain.props} · ${V2.chainMoves} walks`)
ok((V2.measures || 0) > 0 && chainAfter && chainAfter.meas >= 1, 'a measurement brings officials in with the chain between them', `${V2.measures} measurements · ${chainAfter && chainAfter.meas} officials in`)
// 7. the eyes and the front
// A `look` only reaches the renderer on a pass play whose read is off-centre and early enough in the
// drop, so a short watch can hold none at all. If the sample produced none, drive one through the
// renderer's own case and assert the turn AND the snap back off the hook, the way the front's cases
// are driven above.
if (!(V.eyes > 0 && V.eyeSnaps > 0)) {
  for (let i = 0; i < 30 && !(V.eyes > 0 && V.eyeSnaps > 0); i++) {
    const r = await page.evaluate(() => { const sc = window.__gridironScene, P = sc && sc.play
      if (!P || !sc.markers || !sc.markers[8] || !sc.markers[8].root) return null
      const qb = sc.markers[8]; qb.forceState = null; qb._spdPx = 0; qb.homeDir = "up"
      P.snapped = true; P.ballHolderId = 8; P._thrown = false; P.carrierId = null; P.scrambling = false
      sc.fireEvent({ type: "look", to: "off0", window: "green", sep: 1.4, open: true }, P)
      const V = window.__V109_E || {}, turned = !!qb._eyeV109, dir = qb.dirKey
      if (turned) { qb.forceState = "throwSeq"; sc.qbTickV86(P, 16); qb.forceState = null }   // the wind-up arms: he must come back square
      return { turned, dir, back: qb.dirKey, eyes: V.eyes || 0, snaps: V.eyeSnaps || 0, skips: V.eyeSkips || {} } })
    if (r) { V.eyes = r.eyes; V.eyeSnaps = r.snaps; V.eyeSkips = r.skips; V.eyeDriven = r }
    await page.waitForTimeout(120)
  }
}
ok((V.eyes || 0) > 0 && (V.eyeSnaps || 0) > 0, 'the quarterback turned his eyes to a read and brought them back before the throw', `${V.eyes} looks · ${V.eyeSnaps} snaps back · skipped ${JSON.stringify(V.eyeSkips || {})}`)
ok(throws.length > 0 && throws.filter(t => t.facing === 'up').length >= throws.length * 0.5, 'and the v107 arm still fired from the rear facing', `${throws.filter(t => t.facing === 'up').length}/${throws.length} throws from up`)
ok((cases.pickup || 0) > 0 && (cases.blitz || 0) > 0 && (cases.linebackerDrop || 0) > 0, 'pickup / blitz / linebackerDrop reached the renderer as cases', JSON.stringify(cases) + (forcedCases ? ' (natural before the forced fire: ' + JSON.stringify(forcedCases) + ')' : ' (all natural)'))
console.log(JSON.stringify({ pass, fail, errors: errs.length }))
console.log(errs.length ? 'PAGE ERRORS:\n' + errs.slice(0, 8).join('\n') : 'page errors: none')
await browser.close()
if (fail || errs.length) process.exit(1)
