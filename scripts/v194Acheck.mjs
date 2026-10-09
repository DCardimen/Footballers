// Dev check: v194 A OUT OF BOUNDS + v194 A THE MESH. Asserts:
//   OUT OF BOUNDS (FieldSim + the game, over GAMES simmed games, ON vs the kill switch `v194A` 0)
//   1. carriers go out of bounds in the SIM: runs (the pitches above all) and catches end over the paint far more
//      often than OFF (OFF: 0% of runs, ~3% of catches) — the rates are reported against real football's 15-25%
//   2. every out-of-bounds end is a real crossing: the carrier's last frames are over the sideline (the broadcast
//      draws those frames, so he is seen crossing the white line)
//   3. stat-credit truth: an untouched step-out names NO tackler; a push-out names the man who had the grip
//      (a `pushOutV194A` event by him precedes it) — never a bystander
//   4. the game books it: a row whose sim play ended out of bounds stops the clock (`oob`) and its play-by-play says
//      "out of bounds"; with the switch ON a resolved row is never out of bounds on a side roll
//   5. scoring stays roughly neutral: points a game and yards a carry ON vs OFF inside a loose band (reported)
//   THE MESH
//   6. every handoff that is not a pitch is a meeting: the QB and the back within contact range (centre to centre
//      <= 8.5 px, under 1.5 yd) at the exchange, against ~43 px OFF; pitches are flagged `pitch`
//   7. through the exchange the ball never flies: it stays at hand height (h <= 6) and within 10 px of one of the
//      two men on every frame from the snap to just past the handoff
//   8. the broadcast: in a live game a handoff is drawn as a HAND (never the toss cycle), flat, and leaves no ribbon
//   9. no page errors
//   GAME_URL=http://localhost:5173/ node scripts/v194Acheck.mjs   (GAMES=40, OUT=<prefix> writes broadcast frames)
import { chromium } from 'playwright'
import fs from 'node:fs'
import { CHROME, GAME_URL } from './lib/env.mjs'
import { waitLive } from './lib/live.mjs'
const GAMES = Number(process.env.GAMES || 40)
const browser = await chromium.launch({ executablePath: CHROME })
const errs = []
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const info = (m, d) => console.log('info ' + m + (d !== undefined ? '  ' + d : ''))
const pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(1) + '%'

async function measure (tune) {
  const page = await browser.newPage()
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
  await page.addInitScript(t => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, t) }, tune)
  await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && window.__FieldSim && window.__FieldSim._Q, null, { timeout: 60000 })
  const R = await page.evaluate((N) => {
    const TOP = 48, BOT = 396
    const FS = window.__FieldSim, Q = FS._Q, logs = []
    let cur = null; const run0 = FS.run
    FS.run = function (...a) { cur = a[6] && a[6].play; try { return run0.apply(this, a) } finally { cur = null } }
    const push0 = Q.push.bind(Q); Q.push = x => { x.play = cur; logs.push(x); return push0(x) }
    const o = { pts: 0, games: 0, rushYd: 0, rushN: 0, run: { n: 0, oob: 0 }, pitch: { n: 0, oob: 0 }, catch: { n: 0, oob: 0 }, scr: { n: 0, oob: 0 },
      step: 0, push: 0, stepNamed: 0, pushBad: 0, noCross: 0, crossEx: [],
      rows: { simOob: 0, simOobClock: 0, simOobSaid: 0, said: [], rollOob: 0, resolved: 0 },
      mesh: { n: 0, far: 0, dists: [], pitch: 0, hBad: 0, gapBad: 0, frames: 0, ex: [] } }
    const poss = ['QB', 'RB', 'WR', 'CB', 'LB']
    for (let g = 0; g < N; g++) {
      logs.length = 0
      const r = window.__simGameV2(45 + (g % 9) * 5, poss[g % poss.length])
      o.games++; o.pts += r.usScore + r.themScore
      for (const p of r.plays) {
        if (p.event === 'run' && !/KICKOFF|PUNT/.test(p.desc || '') && Math.abs(p.yards) <= 99) { o.rushN++; o.rushYd += p.yards }
        if (p.event !== 'run' && p.event !== 'pass') continue
        if (p.oobSim && !/touchdown|end zone/i.test(p.desc || '')) { o.rows.simOob++; if (p.oob) o.rows.simOobClock++; if (/out of bounds/i.test(p.desc || '')) o.rows.simOobSaid++; else if (o.rows.said.length < 3) o.rows.said.push(p.desc) }
      }
      for (const { sig, log, play } of logs) {
        if (!log || !log.events || (sig.kind !== 'run' && sig.kind !== 'pass')) continue
        const ev = log.events, tk = ev.filter(e => e.type === 'tackle').pop(), oob = !!(tk && tk.oob && tk.plane === 'sideline')
        const isCatch = sig.kind === 'pass' && ev.some(e => e.type === 'catch'), isScr = sig.kind === 'pass' && ev.some(e => e.type === 'scramble')
        const pitch = /^(toss|jet|pnp|rev)$/.test(String(play || ''))
        if (sig.kind === 'run') { o.run.n++; if (oob) o.run.oob++; if (pitch) { o.pitch.n++; if (oob) o.pitch.oob++ } }
        else if (isCatch) { o.catch.n++; if (oob) o.catch.oob++ }
        else if (isScr) { o.scr.n++; if (oob) o.scr.oob++ }
        if (oob && (tk.stepOut || tk.pushOut)) {
          if (tk.stepOut) { o.step++; if (tk.tackler != null) o.stepNamed++ }
          else { o.push++; if (!ev.some(e => e.type === 'pushOutV194A' && e.who === tk.tackler && e.t <= tk.t)) o.pushBad++ }
          // the crossing: the carrier's own frames go over the paint
          const ca = log.actors.find(a => a.id === tk.carrier)
          const crossed = ca && ca.frames.some(f => f.t >= tk.t - 70 && (f.y <= TOP + 0.5 || f.y >= BOT - 0.5))
          const beyond = ca && ca.frames.some(f => f.t >= tk.t && (f.y < TOP - 4 || f.y > BOT + 4))
          if (!crossed || !beyond) { o.noCross++; if (o.crossEx.length < 3) o.crossEx.push([tk.y, ca && ca.frames.slice(-1)[0]]) }
        }
        const hf = ev.find(e => e.type === 'handoff')
        if (sig.kind === 'run' && hf) {
          if (hf.pitch) { o.mesh.pitch++; continue }
          const qb = log.actors.find(a => a.id === 'off8'), rb = log.actors.find(a => a.id === 'off9')
          const at = (a, t) => a.frames.find(f => f.t >= t) || a.frames[a.frames.length - 1]
          const fq = at(qb, hf.t), fr = at(rb, hf.t), d = Math.hypot(fq.x - fr.x, fq.y - fr.y)
          o.mesh.n++; o.mesh.dists.push(d); if (d > 8.5) { o.mesh.far++; if (o.mesh.ex.length < 3) o.mesh.ex.push(+d.toFixed(1)) }
          const sn = ev.find(e => e.type === 'snap')
          for (const b of (log.ball || [])) {
            if (!sn || b.t <= sn.t + 40 || b.t > hf.t + 66) continue
            o.mesh.frames++; if ((b.h || 0) > 6) o.mesh.hBad++
            const q2 = at(qb, b.t), r2 = at(rb, b.t)
            if (Math.min(Math.hypot(b.x - q2.x, b.y - q2.y), Math.hypot(b.x - r2.x, b.y - r2.y)) > 10) o.mesh.gapBad++
          }
        }
      }
    }
    const d = o.mesh.dists.sort((a, b) => a - b)
    o.mesh.p50 = d.length ? +d[Math.floor(d.length / 2)].toFixed(1) : null; o.mesh.p90 = d.length ? +d[Math.floor(d.length * 0.9)].toFixed(1) : null
    o.mesh.max = d.length ? +d[d.length - 1].toFixed(1) : null; delete o.mesh.dists
    o.ppg = o.pts / o.games; o.ypc = o.rushYd / Math.max(1, o.rushN)
    o.V = window.__V194A || null
    return o
  }, GAMES)
  await page.close()
  return R
}

const ON = await measure({})
const OFF = await measure({ v194A: 0 })
const rate = R => `runs ${pc(R.run.oob, R.run.n)} (pitches ${pc(R.pitch.oob, R.pitch.n)}) · catches ${pc(R.catch.oob, R.catch.n)} · scrambles ${pc(R.scr.oob, R.scr.n)} · run+catch ${pc(R.run.oob + R.catch.oob, R.run.n + R.catch.n)}`
info('ON  out of bounds', rate(ON))
info('OFF out of bounds', rate(OFF))
// 1
ok(ON.run.oob / ON.run.n > Math.max(0.02, 3 * OFF.run.oob / Math.max(1, OFF.run.n)), 'runs end out of bounds in the sim (OFF: almost never)', `${pc(ON.run.oob, ON.run.n)} vs OFF ${pc(OFF.run.oob, OFF.run.n)}`)
ok(ON.pitch.oob / Math.max(1, ON.pitch.n) > 0.08, 'the pitch — a perimeter play — is where the run goes out', `${pc(ON.pitch.oob, ON.pitch.n)} of ${ON.pitch.n}`)
ok(ON.catch.oob / ON.catch.n > 0.12 && ON.catch.oob / ON.catch.n > 2 * OFF.catch.oob / Math.max(1, OFF.catch.n), 'catches end out of bounds far more often than OFF', `${pc(ON.catch.oob, ON.catch.n)} vs OFF ${pc(OFF.catch.oob, OFF.catch.n)}`)
// 2
ok(ON.step + ON.push > 20 && ON.noCross === 0, 'every out-of-bounds end is a real crossing — the carrier\'s frames go over the paint', `${ON.step} step-outs, ${ON.push} push-outs, ${ON.noCross} without a crossing ${JSON.stringify(ON.crossEx)}`)
// 3
ok(ON.step > 0 && ON.stepNamed === 0, 'an untouched step-out names no tackler', `${ON.stepNamed}/${ON.step} named`)
ok(ON.push > 0 && ON.pushBad === 0, 'a push-out names the man who had the grip and drove him over', `${ON.pushBad}/${ON.push} without his push`)
// 4
ok(ON.rows.simOob > 10 && ON.rows.simOobClock === ON.rows.simOob, 'a row the sim ran out of bounds stops the clock', `${ON.rows.simOobClock}/${ON.rows.simOob}`)
ok(ON.rows.simOob > 10 && ON.rows.simOobSaid === ON.rows.simOob, 'and its play-by-play says "out of bounds"', `${ON.rows.simOobSaid}/${ON.rows.simOob} ${JSON.stringify(ON.rows.said)}`)
// 5
info('scoring', `ON ${ON.ppg.toFixed(1)} pts/game, ${ON.ypc.toFixed(2)} yd/carry · OFF ${OFF.ppg.toFixed(1)}, ${OFF.ypc.toFixed(2)} (${GAMES} games each; one run of a heavy-tailed game — compare several)`)
ok(Math.abs(ON.ppg - OFF.ppg) < 6 && Math.abs(ON.ypc - OFF.ypc) < 1.2, 'scoring stays roughly neutral (a loose band for one sample)', `Δ ${(ON.ppg - OFF.ppg).toFixed(1)} pts, Δ ${(ON.ypc - OFF.ypc).toFixed(2)} yd/carry`)
// 6-7
info('the mesh', `ON p50 ${ON.mesh.p50} / p90 ${ON.mesh.p90} / max ${ON.mesh.max} px over ${ON.mesh.n} handoffs (${ON.mesh.pitch} pitches) · OFF p50 ${OFF.mesh.p50} / max ${OFF.mesh.max}`)
ok(ON.mesh.n > 50 && ON.mesh.far === 0, 'every handoff is a meeting: QB and back within contact range at the exchange', `${ON.mesh.far}/${ON.mesh.n} apart ${JSON.stringify(ON.mesh.ex)}`)
ok(OFF.mesh.p50 > 20, 'and OFF they were yards apart (what the broadcast had to fly across)', `OFF p50 ${OFF.mesh.p50} px`)
ok(ON.mesh.pitch > 10, 'pitches are flagged as pitches (they may fly)', `${ON.mesh.pitch}`)
ok(ON.mesh.frames > 100 && ON.mesh.hBad === 0 && ON.mesh.gapBad === 0, 'the ball never leaves the two men\'s hands through the exchange — hand height, within reach', `${ON.mesh.hBad} high, ${ON.mesh.gapBad} loose of ${ON.mesh.frames} frames`)

// 8. the broadcast
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.addInitScript(() => { setInterval(() => { document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)
await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(2500)
await page.evaluate(() => { window.__readPos = 'RB' })
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function step (t) {
  await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    const el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click() } }, { t, visSrc: vis })
  await page.waitForTimeout(t === 'PLAN' ? 4000 : 900)
}
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
const live = await waitLive(page)
ok(live, 'the broadcast is live')
const snapPng = async (path, cx, cy) => {
  if (!process.env.OUT) return
  if (process.env.FULL) { await page.screenshot({ path }); return }
  const src = await page.evaluate(() => new Promise(res => { try { window.__gridironScene.game.renderer.snapshot(img => res({ src: img.src, w: img.width })) } catch (e) { res(null) } }))
  if (!src) return
  const out = await page.evaluate(async ({ src, cx, cy }) => { const img = new Image(); img.src = src.src; await img.decode()
    const sc = window.__gridironScene, cam = sc.cameras.main, k = src.w / cam.width, wv = cam.worldView
    const x = (cx - wv.x) * cam.zoom * k, y = (cy - wv.y) * cam.zoom * k, R = 80 * k, Z = 3
    const cv = document.createElement('canvas'); cv.width = R * 2 * Z; cv.height = R * 2 * Z; const c = cv.getContext('2d'); c.imageSmoothingEnabled = false
    c.drawImage(img, x - R, y - R, R * 2, R * 2, 0, 0, cv.width, cv.height); return cv.toDataURL('image/png') }, { src, cx, cy })
  fs.writeFileSync(path, Buffer.from(out.split(',')[1], 'base64'))
}
const hands = []; let shots = 0, oobSeen = 0, oobShots = 0
for (let i = 0; i < 3000 && live; i++) {
  const st = await page.evaluate(() => { const sc = window.__gridironScene, P = sc && sc.play; if (!P || !sc.ballSpr) return null
    const ev = (P.script && P.script.events) || [], hf = ev.find(e => e && e.type === 'handoff'), tk = ev.filter(e => e && e.type === 'tackle').pop()
    const trailOn = !!(sc.ballTrailG && sc.ballTrailG.commandBuffer && sc.ballTrailG.commandBuffer.length > 2)
    const cm = P.carrierId != null ? sc.markers[P.carrierId] : null
    return { t: P.t - (P.delay || 0), hand: P._hand ? { kind: P._hand.kind, toss: P._hand.toss, mesh: !!P._hand.mesh, arc: P._hand.arc, t0: P._hand.t0 } : null, trailOn,
      hf: hf ? { mesh: !!hf.mesh, pitch: !!hf.pitch, t: hf.t } : null, ball: [sc.ballSpr.x, sc.ballSpr.y], cyc: sc.markers[8] && sc.markers[8].forceState,
      oob: tk && tk.oob ? { t: tk.t, stepOut: !!tk.stepOut } : null, cm: cm && cm.root ? { sy: cm.sy, x: cm.root.x, y: cm.root.y } : null } })
  if (st && st.hand && st.hand.kind === 'handoff') {
    const key = st.hand.t0
    let h = hands.find(x => x.key === key); if (!h) { h = { key, mesh: st.hf && st.hf.mesh, pitch: st.hf && st.hf.pitch, toss: st.hand.toss, arc: st.hand.arc, trail: 0, frames: 0 }; hands.push(h) }
    h.frames++; if (st.trailOn) h.trail++
    if (h.mesh && shots < 3) { shots++; await snapPng(`${process.env.OUT}_mesh${shots}.png`, st.ball[0], st.ball[1]) }
  }
  if (st && st.oob && st.cm && st.t > st.oob.t + 200 && (st.cm.sy < 48 || st.cm.sy > 396)) { oobSeen++; if (oobShots < 2) { oobShots++; await snapPng(`${process.env.OUT}_oob${oobShots}.png`, st.cm.x, st.cm.y) } }
  if (hands.filter(h => h.mesh).length >= 3 && (oobSeen > 0 || i > 1800)) break
  await page.waitForTimeout(35)
}
const meshHands = hands.filter(h => h.mesh)
ok(meshHands.length >= 1 && meshHands.every(h => !h.toss && h.arc === 0), 'on the broadcast a meshed handoff is a HAND, flat — never the toss', JSON.stringify(hands.map(h => ({ mesh: h.mesh, pitch: h.pitch, toss: h.toss, arc: h.arc }))))
ok(meshHands.length >= 1 && meshHands.every(h => h.trail <= 1), 'and leaves no motion ribbon — nothing flew (a sampled frame may still hold the snap\'s)', JSON.stringify(meshHands.map(h => `${h.trail}/${h.frames}`)))
info('a carrier drawn over the sideline after an out-of-bounds whistle in the live game', `${oobSeen} frames`)

ok(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '))
console.log(JSON.stringify({ pass, fail, errors: errs.length, V: ON.V }))
await browser.close()
process.exit(fail ? 1 : 0)
