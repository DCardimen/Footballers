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
const URL = process.env.GAME_URL || 'http://localhost:5173/'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
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
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
let scene = false
for (let i = 0; i < 70; i++) { scene = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length)); if (scene) break
  if (i === 20 || i === 40) await step('Continue')   // the flow can stall on a card the first pass missed
  await page.waitForTimeout(500) }
console.log('scene:', scene)

const MS = +(process.env.V109_MS || 150000), t0 = Date.now()
const tokens = new Set(); let shadowSamples = 0, shadowBad = 0, shadowMaxOff = 0, nudgedSeen = 0, fdSeen = 0, forcedTD = null, forcedCases = null, walkTexFrames = 0, refAtSpot = 0, last = null
while (Date.now() - t0 < MS) {
  const st = await page.evaluate(() => { const sc = window.__gridironScene; if (!sc) return null
    const P = sc.play, ms = sc.markers || [], V = window.__V109_E || null
    // shadows: for every nudged man, where would a cast from his nudged feet put the shadow?
    const sh = []
    for (const m of (sc._klV99 ? ms : [])) { if (!m || !m.root || !m._nudgeV109 || !m.shadow || !m.shadow.scene) continue
      let lift = 0; if (m._launchUntil && m.tms < m._launchUntil) { const kk = (m.tms - (m._launchT0 || m.tms)) / (m._launchUntil - (m._launchT0 || m.tms)); lift = Math.sin(Math.max(0, Math.min(1, kk)) * Math.PI) * (m._launchH || 11) }
      const down = /^(down|dive|tackleSeq|pancakeSeq|getup)/.test(String(m.forceState || '')) || (m._groundT > 0 && m.tms - m._groundT < 400)
      const h = (window.RIB_TUNE && window.RIB_TUNE.shadowManH || 21) * (down ? 0.45 : 1)
      const Vv = sc.shadowVecV99(m.root.x, m.root.y + lift * m.root.scale); if (!Vv) continue
      const len = h * Vv.slope, ex = Vv.ux * len * 0.5, ey = 24 + lift + Vv.uy * len * 0.5
      const d = Math.hypot(m.shadow.x - ex, m.shadow.y - ey)
      sh.push(d)
      if (d > 1) (window.__shBad = window.__shBad || []).push({ d: +d.toFixed(2), st: String(m.forceState || ''), post: !!m._post, nudge: +Math.hypot(m._nudgeV109.dx, m._nudgeV109.dy).toFixed(2), spd: Math.round(m._spdPx || 0), gt: m._groundT ? Math.round(m.tms - m._groundT) : -1, scene: !!m.shadow.scene }) }
    const walkTex = ms.filter(m => m && m.tex && /_walk[01]$/.test(m.tex)).length
    const refSpot = (sc.refs || []).filter(r => r._spotTgt && r._spotTgt.there).length
    return { V, sh, walkTex, refSpot, token: P && P.__ballTokenV1514, fd: !!(P && P.fdConverted), live: !!(P && !P.done && P.snapped && P.carrierId != null && P.t > (P.delay || 0) + 300), gap: !P, ev: P && P.payload && P.payload.event, t: P && P.t } })
  if (st) { last = st; if (st.token) tokens.add(st.token); if (st.fd) fdSeen++
    for (const d of st.sh) { shadowSamples++; if (d > 1) shadowBad++; if (d > shadowMaxOff) shadowMaxOff = d }
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
const V = (last && last.V) || {}
const cases = V.cases || {}
console.log('hook:', JSON.stringify({ cam: V.cam, helpUps: V.helpUps, helpUpArrivals: V.helpUpArrivals, walkFrames: V.walkFrames, celebrations: V.celebrations, celebrants: V.celebrants, lastCelebrants: V.lastCelebrants, walkOffs: V.walkOffs, surges: V.surges,
  huddle: V.huddle && { staggered: V.huddle.staggered, walkFrames: V.huddle.walkFrames, breaks: (V.huddle.breaks || []).map(b => b.pos + ':' + b.at).join(' ') }, spots: V.spots, spotArrivals: V.spotArrivals, chainMoves: V.chainMoves, measures: V.measures, shadows: V.shadows, eyes: V.eyes, eyeSnaps: V.eyeSnaps, cases }))
console.log('sampled:', JSON.stringify({ plays: tokens.size, shadowSamples, shadowBad, shadowMaxOff: +shadowMaxOff.toFixed(3), nudgedSeen, walkTexFrames, refAtSpot, fdFrames: fdSeen, forcedTD, forcedCases }))
const shBad = await page.evaluate(() => (window.__shBad || []).slice(0, 6))
console.log('shadow outliers:', JSON.stringify(shBad))
// the chain crew and the measurement are dead-ball dressing the sampled window may never have hit:
// drive both through the scene directly and prove the sideline props actually moved
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
console.log('chain/measure:', JSON.stringify(chain), JSON.stringify(chainAfter))
const throws = await page.evaluate(() => ((window.__V107 || {}).throws || []).map(r => ({ facing: r.facing, dir: r.dir, res: r.residualMs }))).catch(() => [])
console.log('v107 throws:', JSON.stringify(throws.slice(-8)))

ok(scene && tokens.size >= 8, 'a live game of at least eight plays was watched', `${tokens.size} plays`)
// 1. the camera
const cam = V.cam || {}
const jerkBound = +(process.env.V109_JERK || 32000)
ok(cam.frames > 200 && cam.maxJerk > 0 && cam.maxJerk < jerkBound, 'the camera is a spring: its per-frame pan acceleration stayed under the bound', `maxJerk=${cam.maxJerk} px/s² over ${cam.frames} frames (bound ${jerkBound})`)
ok(cam.leadFrames > 0, 'and it framed the carrier in the leading third along his heading', `${cam.leadFrames} lead frames`)
ok(cam.whistleWide > 0 && cam.wideFrames > 0, 'and pulled WIDE on the whistle for the gather', `${cam.whistleWide} whistles · ${cam.wideFrames} wide frames`)
ok(cam.softResets > 0, 'and re-aimed for the next snap through the glide instead of snapping', `${cam.softResets} soft resets`)
ok(cam.cuts > 0, 'the v98 handover cut still fires', `${cam.cuts} cuts`)
// 2. shadows
ok(nudgedSeen > 0 && (V.shadows || {}).recast > 0, 'bodies were nudged apart in piles and their shadows re-cast from the nudged feet', JSON.stringify(V.shadows))
ok(shadowSamples > 0 && shadowBad === 0, 'every nudged man\'s shadow sits within 1 px of a cast from where he now stands', `${shadowSamples} samples · max ${shadowMaxOff.toFixed(3)} px off`)
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
ok(chain.side && chain.moved >= 3 && (V.chainMoves || 0) > 0, 'the chain crew walks to a new line (the down marker and both rods)', `${chain.moved} props moved of ${chain.props} · ${V.chainMoves} walks`)
ok(chain.measures > 0 && chainAfter && chainAfter.meas >= 1, 'a measurement brings officials in with the chain between them', `${chain.measures} measurements · ${chainAfter && chainAfter.meas} officials in · chain drawn: ${chainAfter && chainAfter.drawn}`)
// 7. the eyes and the front
ok((V.eyes || 0) > 0 && (V.eyeSnaps || 0) > 0, 'the quarterback turned his eyes to a read and brought them back before the throw', `${V.eyes} looks · ${V.eyeSnaps} snaps back · skipped ${JSON.stringify(V.eyeSkips || {})}`)
ok(throws.length > 0 && throws.filter(t => t.facing === 'up').length >= throws.length * 0.5, 'and the v107 arm still fired from the rear facing', `${throws.filter(t => t.facing === 'up').length}/${throws.length} throws from up`)
ok((cases.pickup || 0) > 0 && (cases.blitz || 0) > 0 && (cases.linebackerDrop || 0) > 0, 'pickup / blitz / linebackerDrop reached the renderer as cases', JSON.stringify(cases) + (forcedCases ? ' (natural before the forced fire: ' + JSON.stringify(forcedCases) + ')' : ' (all natural)'))
console.log(JSON.stringify({ pass, fail, errors: errs.length }))
console.log(errs.length ? 'PAGE ERRORS:\n' + errs.slice(0, 8).join('\n') : 'page errors: none')
await browser.close()
if (fail || errs.length) process.exit(1)
