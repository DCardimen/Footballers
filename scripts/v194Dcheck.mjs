// Dev check: v194 D — IDLE V2, THE HUDDLE FACES IN, THE STIFF ARM, THE TURF REMEMBERS ITS PAINT. Asserts:
//   THE SIM
//   1. the stiff arm's grade is presentation data: under three seeds the games simmed with `v194D` on and off are
//      identical play for play (no roll added, no yard moved — scoring neutral by construction)
//   2. stiff arms happen at a sane rate (graded stiff arms + trucks delivered with the arm, per committed contact), every
//      one carries its grade (pow 0-1, drop, sick), the sick ones are a minority, and with the switch off none is graded
//   3. stat-credit truth: a stiff-armed man is never the tackler inside his beaten window, and never on the same contact
//   THE BROADCAST (a live game, the you-player at RB)
//   4. the huddle faces in: every man in the hold faces the middle of his huddle-mates (drawn facing against the true
//      bearing, mean and worst), the QB included, in both huddles
//   5. idle V2: every whistle plans each man's start, pace, gait and pose — several gaits and poses, staggered starts,
//      many paces; between the plays nobody leaves his whistle-spot leash and the field keeps its spread (no convergence)
//   6. the stiff arm in the lab (two men on clear grass, the scene's own fireEvent): the arm locks out (stiff3) pointing
//      AT the man, who is drawn ON the hand while it is locked, his head snaps back; a graded `drop` puts him down and up again, a weak one staggers back on his feet;
//      a sick one freezes the frame, a plain one barely does; an ungraded event keeps v193 AJ's shove
//   7. the turf's paint: an impact on a yard line reads white, one between the lines reads grass green, one in the end
//      zone reads its paint; a scuff laid on the line keeps that paint and its burst throws it — with no Math.random
//   8. the kill switches (`v194D` 0: no paint read, no huddle turn, no idle plan, the old stiff arm); no page errors
//   GAME_URL=http://localhost:5173/ node scripts/v194Dcheck.mjs   (GAMES, LIVE_MS)
import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'
const browser = await chromium.launch({ executablePath: CHROME })
const errs = []
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { setInterval(() => { document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1500)
await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && window.__FieldSim, null, { timeout: 60000 })
const G = Number(process.env.GAMES || 4)

// ================= 1-3. the sim =================
const SIM = await page.evaluate(({ G }) => {
  const R0 = Math.random
  const run = (on, seed) => {
    let s = seed; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let v = Math.imul(s ^ s >>> 15, 1 | s); v = v + Math.imul(v ^ v >>> 7, 61 | v) ^ v; return ((v ^ v >>> 14) >>> 0) / 4294967296 }
    window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v194D: on })
    const FS = window.__FieldSim, o = {}, logs = []
    for (const name of ['run', 'pass']) { o[name] = FS[name]; FS[name] = function (...a) { const r = o[name].apply(FS, a); const q = FS._Q; if (q && q.length) logs.push(q[q.length - 1].log); return r } }
    const out = { games: [], sa: 0, graded: 0, sick: 0, drop: 0, truckSA: 0, contacts: 0, credInWindow: 0, credSame: 0, credLater: 0, credOob: 0, badPow: 0 }
    try {
      for (let g = 0; g < G; g++) { FS._Q.length = 0; logs.length = 0
        const res = window.__simGameV2(60, ['RB', 'LB', 'WR', 'CB'][g % 4])
        out.games.push(JSON.stringify((res.plays || []).map(p => [p.event, p.yards, p.desc])))
        for (const lg of logs) { const ev = (lg && lg.events) || [], armed = {}
          for (const e of ev) {
            if (e.type === 'tackleLunge') out.contacts++
            const isSA = e.type === 'stiffarm' || (e.type === 'brokenTackle' && e.stiffArm)
            if (e.type === 'stiffarm') out.sa++
            if (e.type === 'brokenTackle' && e.stiffArm) out.truckSA++
            if (isSA || (e.type === 'stiffarm')) { if (e.pow != null) { out.graded++; if (!(e.pow >= 0 && e.pow <= 1) || typeof e.drop !== 'boolean' || typeof e.sick !== 'boolean') out.badPow++; if (e.sick) out.sick++; if (e.drop) out.drop++ }
              armed[e.who] = e.t }
            if (e.type === 'tackle' && e.tackler && armed[e.tackler] != null) { const dt = e.t - armed[e.tackler]
              if (e.oob && dt < 520) out.credOob++   // the sideline's nearest-chaser credit (not this system's: reported, not asserted)
              else if (dt <= 0) out.credSame++; else if (dt < 520) out.credInWindow++; else out.credLater++ }
          } }
      }
    } finally { Math.random = R0; FS.run = o.run; FS.pass = o.pass; delete window.RIB_TUNE.v194D }
    return out
  }
  const seeds = []
  for (const seed of [9137, 4242, 777]) { const a = run(1, seed), b = run(0, seed); seeds.push({ seed, same: a.games.every((x, i) => x === b.games[i]) && a.games.length === b.games.length, on: { ...a, games: a.games.length }, offGraded: b.graded, plays: a.games.reduce((n, x) => n + JSON.parse(x).length, 0) }) }
  return seeds
}, { G })
console.log('sim:', JSON.stringify(SIM.map(s => ({ seed: s.seed, same: s.same, plays: s.plays, ...s.on, offGraded: s.offGraded }))))
const tot = k => SIM.reduce((n, s) => n + (s.on[k] || 0), 0)
ok(SIM.every(s => s.same) && SIM.every(s => s.plays > 80 * G), 'the stiff arm\'s grade is presentation data: three seeds, v194D on and off, the same games play for play', SIM.map(s => `${s.seed}:${s.same}`).join(' '))
const saN = tot('sa') + tot('truckSA'), rate = saN / Math.max(1, tot('contacts'))
ok(saN >= 6 * G && rate > 0.015 && rate < 0.2, 'stiff arms happen at a sane rate (graded stiff arms + trucks delivered with the arm, per committed contact)', `${tot('sa')} stiff arms + ${tot('truckSA')} arm-trucks / ${tot('contacts')} contacts = ${(rate * 100).toFixed(1)}%`)
ok(tot('graded') === saN && tot('badPow') === 0 && tot('sick') < saN * 0.5 && tot('drop') > 0 && tot('drop') < saN, 'every stiff arm carries its grade (pow 0-1, drop, sick); the sick ones are a minority', `${tot('graded')} graded · ${tot('drop')} drop · ${tot('sick')} sick`)
ok(SIM.every(s => s.offGraded === 0), 'with v194D off no event is graded (the old stiff arm, exactly)', SIM.map(s => s.offGraded).join(','))
ok(tot('credSame') === 0 && tot('credInWindow') === 0, 'stat-credit truth: a stiff-armed man is never the tackler on that contact or inside his beaten window', `same ${tot('credSame')} · in-window ${tot('credInWindow')} · later (a fresh pursuit) ${tot('credLater')}`)
if (tot('credOob')) console.log(`info the sideline's forced-out credit (nearest chaser within tackleCreditPx) named a just-stiff-armed man ${tot('credOob')}x — that rule does not exclude a beaten man (pre-existing, outside this system)`)

// ================= the broadcast =================
async function step (t) {
  const r = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    const el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
      : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className) || /RUN THIS PLAN|LOCK IT IN|CHOOSE/i.test(txt(e)))
        : els.find(e => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null
  }, { t, visSrc: vis })
  await page.waitForTimeout(t === 'PLAN' ? 4000 : 900); return r
}
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN']) await step(t)
let live = false
for (let i = 0; i < 10 && !live; i++) {
  for (const t of ['CONTINUE TO MATCH', 'Continue to Match', 'NEXT', 'KICK OFF', 'PLAY', 'CONTINUE']) {
    live = await page.evaluate(() => { const sk = document.getElementById('v112Skip'); if (sk && sk.getBoundingClientRect().width > 0 && document.getElementById('pregameV1513')) sk.click(); return !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length) }); if (live) break
    await step(t)
  }
  if (!live) await page.waitForTimeout(2000)
}
ok(live, 'the broadcast came up')
if (live) {
  // ================= 4-5. the huddle and the idle, live =================
  const LIVE = Number(process.env.LIVE_MS || 75000)
  await page.evaluate(() => { window.__getGridironLiveSpeed = () => 1.5 })
  const t0 = Date.now(); let gapS = 0, leashMax = 0, gapSpread = [], hudSamples = 0, inward = 0, qbIn = 0, qbS = 0
  while (Date.now() - t0 < LIVE) {
    const st = await page.evaluate(() => {
      const sc = window.__gridironScene, P = sc && sc.play; if (!sc) return null
      const PJ = window.__PJ_PROBE
      if (!P) {   // the gap between the plays
        let leash = 0; const ys = []
        for (const m of sc.markers) { if (!m || !m.root) continue; ys.push(m.sy); if (m._idleHomeV144) leash = Math.max(leash, Math.hypot((m.sx - m._idleHomeV144.x) / 18, (m.sy - m._idleHomeV144.y) / 26)) }
        return { ph: 'gap', leash, spread: ys.length ? Math.max(...ys) - Math.min(...ys) : 0 }
      }
      const H = P.hud
      if (H && P.t >= H.a && P.t < H.b) {   // the hold: the facing against the middle of his huddle-mates
        const out = []
        sc.markers.forEach((m, i) => { if (!m || !m._hud) return
          let sx = 0, sy = 0, n = 0; for (const o of sc.markers) if (o && o !== m && o._hud && o._hud.side === m._hud.side) { sx += o._hud.x; sy += o._hud.y; n++ }
          const a = PJ(m.sx, m.sy), b = PJ(sx / n, sy / n), want = Math.atan2(b.y - a.y, b.x - a.x), have = sc.faceAngV109(m)
          let d = Math.abs(want - have); if (d > Math.PI) d = 2 * Math.PI - d
          out.push({ i, d: +d.toFixed(3) }) })
        return { ph: 'hud', out }
      }
      return { ph: 'play' }
    }).catch(() => null)
    if (st && st.ph === 'gap') { gapS++; leashMax = Math.max(leashMax, st.leash); gapSpread.push(st.spread) }
    if (st && st.ph === 'hud') for (const r of st.out) { hudSamples++; if (r.d < 0.8) inward++; if (r.i === 8) { qbS++; if (r.d < 0.8) qbIn++ } }
    await page.waitForTimeout(st && st.ph === 'hud' ? 40 : 90)
  }
  const V = await page.evaluate(() => { const H = window.__V194D || {}; return { idle: H.idle, huddle: { ...(H.huddle || {}), men: undefined } } })
  const K = V.huddle || {}, I = V.idle || {}
  console.log('huddle:', JSON.stringify({ hook: K, hudSamples, inward, qbS, qbIn }))
  console.log('idle:', JSON.stringify({ plans: I.plans, men: I.men, kinds: I.kinds, ends: I.ends, poses: I.poses, outcomes: I.outcomes, pats: I.pats, offers: I.offers, gapActs: I.gapActs, steps: I.steps, whistleSpread: (I.spread || []).slice(0, 8) }), 'gap:', JSON.stringify({ gapS, leashMax: +leashMax.toFixed(2), spread: gapSpread.slice(0, 6).map(Math.round) }))
  ok(K.n > 30 && K.sumErr / K.n < 0.3 && K.maxErr <= 0.45 && K.qb > 0, 'the huddle faces in: every man held in the ring faces the middle of his huddle-mates, the QB included (the hook)', `${K.n} turns · mean ${(K.sumErr / Math.max(1, K.n)).toFixed(3)} rad · worst ${K.maxErr} · QB ${K.qb}`)
  ok(hudSamples > 20 && inward / hudSamples > 0.97 && qbS > 0 && qbIn === qbS, 'measured on the field in the hold: the drawn facings point inward (within 45° of the middle)', `${inward}/${hudSamples} · QB ${qbIn}/${qbS}`)
  const starts = (I.starts || []), mean = starts.reduce((a, b) => a + b, 0) / Math.max(1, starts.length), sd = Math.sqrt(starts.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, starts.length))
  const kinds = Object.keys(I.kinds || {}), ends = Object.keys(I.ends || {}), paces = new Set((I.spds || []).map(v => Math.round(v / 4))).size
  ok(I.plans >= 3 && kinds.length >= 4 && ends.length >= 3, 'idle V2: every whistle plans each man — several gaits and several poses', `${I.plans} whistles · gaits ${kinds.join(',')} · poses ${ends.join(',')}`)
  ok(sd > 60 && paces >= 8, 'no synchronized turn-away: the starts are staggered and the paces are each man\'s own', `start sd ${sd.toFixed(0)} ms · ${paces} distinct paces`)
  const pz = I.poses || {}, gestures = ['fistpump', 'point', 'shake', 'offer', 'pat', 'knees', 'hips', 'headDown', 'swagger', 'droop', 'trudge', 'back'].filter(k => pz[k] > 0)
  ok(gestures.length >= 6, 'the gestures and poses all get played (swagger, droop, trudge, backpedal, fist pump, point, shake, a hand out, hands on hips / knees, head down)', gestures.join(','))
  const wsp = (I.spread || []).map(s => s.y), wMean = wsp.reduce((a, b) => a + b, 0) / Math.max(1, wsp.length), gMean = gapSpread.reduce((a, b) => a + b, 0) / Math.max(1, gapSpread.length)
  ok(gapS > 0 ? (leashMax <= 1.6 && gMean > wMean * 0.45) : true, 'between the plays nobody leaves his whistle-spot leash and the field keeps its spread (no twenty-two-man convergence)', `${gapS} gap samples · worst leash ${leashMax.toFixed(2)} (1 = the shuffle's box) · spread ${gMean.toFixed(0)} vs ${wMean.toFixed(0)} at the whistle`)

  // ================= 6. the stiff arm, in the lab =================
  await page.evaluate(() => { const sc = window.__gridironScene
    return new Promise(res => { const iv = setInterval(() => { const P = sc.play; if (P && P.snapped && !P.done && P.script) { clearInterval(iv); res() } }, 50); setTimeout(() => { clearInterval(iv); res() }, 60000) }) })
  const lab = (ev) => page.evaluate((ev) => {
    const sc = window.__gridironScene, P = sc.play; sc.game.loop.sleep()
    let T = performance.now(); const step = (dt) => { T += dt; sc.sys.events.emit('preupdate', T, dt); sc.sys.events.emit('update', T, dt) }
    const cam = sc.cameras.main
    let best = null, bd = 1e9; sc.markers.forEach(m => { if (!m || !m.root) return; const d = Math.hypot(m.root.x - cam.worldView.centerX, m.root.y - cam.worldView.centerY); if (d < bd) { bd = d; best = m } })
    const base = { x: best.sx, y: Math.max(120, Math.min(320, best.sy)) }, orig = {}, P0 = { carrierId: P.carrierId, ballHolderId: P.ballHolderId, ballMode: P.ballMode }
    const mk = (side, num, idx, label) => { const m = sc.marker(base.x, base.y, side, num, 0, 1, side); m.posLabel = label; m._ajSide = side; m._ajLabel = label; m._ajSp = 150; orig[idx] = sc.markers[idx]; sc.markers[idx] = m; return m }
    const C = mk('off', 24, 9, 'RB'), D = mk('def', 52, 15, 'LB')
    P.carrierId = 9; P.ballHolderId = 9; P.ballMode = 'held'
    const dir = (P.script.meta && P.script.meta.dir) || 1, S0 = (window.__V194D && window.__V194D.stiff.n) || 0, AJ0 = (window.__V193AJ && window.__V193AJ.clips && window.__V193AJ.clips.shoved) || 0
    const tr = { C: [], D: [], stop: 0, armN: 0 }
    sc.hitStop = 0
    for (let f = 0; f <= 110; f++) {
      const fms = f * 11.7
      if (f === 13) sc.fireEvent(Object.assign({ t: Math.max(0, P.t - (P.delay || 0)), x: C.sx, y: C.sy, carrier: 'off9', who: 'def4', ix: (C.sx + D.sx) / 2, iy: (C.sy + D.sy) / 2 }, ev), P)
      sc.placeMarker(C, base.x + dir * fms * .13, base.y, 11.7); sc.placeMarker(D, base.x + dir * (28 - Math.min(fms, 150) * .09), base.y - 6, 11.7)
      const ct = C.tex.replace(/^spr_[a-z]+_/, ''), dt = D.tex.replace(/^spr_[a-z]+_/, '')
      tr.C.push(ct); tr.D.push(dt)
      if (/stiff3$/.test(ct)) { tr.armN++; (tr.glue = tr.glue || []).push([Math.round(D.root.x - C.root.x), Math.round(D.root.y - C.root.y), C.body.flipX ? -1 : 1]) }
      tr.stop = Math.max(tr.stop, sc.hitStop || 0)
      step(16.7)
    }
    const dSide = Math.sign(D.root.x - C.root.x)
    const S = window.__V194D && window.__V194D.stiff
    const out = { glue: (tr.glue || []).slice(4, -2), C: [...new Set(tr.C)], D: [...new Set(tr.D)], stop: Math.round(tr.stop), armN: tr.armN, graded: S ? S.n - S0 : 0, shoved: ((window.__V193AJ && window.__V193AJ.clips && window.__V193AJ.clips.shoved) || 0) - AJ0, dSide }
    for (const k of Object.keys(orig)) { const m = sc.markers[k]; sc.ajResetV193 && sc.ajResetV193(m); try { m.root.destroy(true) } catch (e) {} sc.markers[k] = orig[k] }
    Object.assign(P, P0); sc.hitStop = 0
    sc.game.loop.wake()
    return out
  }, ev)
  // the arm's direction, measured once on its own (a carrier with a man to his screen-left and one to his right)
  const AIM = await page.evaluate(() => {
    const sc = window.__gridironScene; sc.game.loop.sleep()
    const res = []
    for (const side of [-1, 1]) {
      const C = sc.marker(360, 220, 'off', 24, 0, 1, 'off'), D = sc.marker(360, 220, 'def', 52, 0, 1, 'def')
      // put D to the screen side asked for, a few yards off
      const a = window.__PJ_PROBE(360, 220), b = window.__PJ_PROBE(360, 230), sy = Math.sign(b.x - a.x)
      sc.placeMarker(C, 360, 220, 16); sc.placeMarker(D, 360, 220 + side * sy * 12, 16)
      sc.stiffArmV194D(sc.play || { t: 0 }, { pow: .6, drop: false, sick: false, x: 360, y: 220, who: 'def4', carrier: 'off9' }, C, D, false)
      for (let f = 0; f < 12; f++) sc.placeMarker(C, 360, 220, 16)
      // the drawn stiff cell: the atlas's stiff-arm row holds the arm out to the screen RIGHT, so a flipX one holds it LEFT
      res.push({ want: Math.sign(D.root.x - C.root.x), tex: C.tex, hand: C.body.flipX ? -1 : 1 })
      sc.ajResetV193(C); sc.ajResetV193(D); C.root.destroy(true); D.root.destroy(true)
    }
    sc.game.loop.wake(); sc.hitStop = 0
    return res
  })
  const SICK = await lab({ type: 'stiffarm', armEdge: 30, pow: .95, drop: true, sick: true })
  const WEAK = await lab({ type: 'stiffarm', armEdge: 2, pow: .3, drop: false, sick: false })
  const OLD = await lab({ type: 'stiffarm', armEdge: 12, side: 1 })
  console.log('lab:', JSON.stringify({ AIM, SICK, WEAK, OLD }))
  ok(SICK.armN >= 8 && SICK.C.some(t => /stiff1$/.test(t)) && SICK.C.some(t => /stiff2$/.test(t)), 'the arm goes out, LOCKS straight (stiff3, held), and comes back', `${SICK.armN} locked frames · ${SICK.C.join(',')}`)
  { const g = SICK.glue || [], good = g.filter(([dx, dy, h]) => Math.abs(dx) >= 8 && Math.abs(dx) <= 48 && Math.abs(dy) <= 8 && Math.sign(dx) === h).length
    ok(g.length >= 5 && good / g.length >= 0.8, 'while the arm is locked the man is ON the hand: beside the carrier on the arm\'s side, at an arm\'s length, his feet on the carrier\'s line', `${good}/${g.length} · ${JSON.stringify(g.slice(0, 6))}`) }
  ok(AIM.every(r => /_(sd|dr|ur)_stiff/.test(r.tex) && r.hand === r.want), 'the locked arm points AT the man, whichever side of him he is (the mirrored stiff row is handled)', AIM.map(r => `${r.want > 0 ? 'right' : 'left'}:${r.tex.replace(/^spr_[a-z]+_/, '')}/${r.hand > 0 ? 'R' : 'L'}`).join(' '))
  ok(SICK.D.some(t => /_idle$/.test(t)) && SICK.D.includes('down') && SICK.D.some(t => /getup/.test(t)), 'a graded drop: his head snaps back off the hand, he goes down, and he gets up', SICK.D.join(','))
  ok(WEAK.D.some(t => /walk[01]$/.test(t)) && !WEAK.D.includes('down'), 'a weak one: he staggers back on his heels and stays up', WEAK.D.join(','))
  ok(SICK.stop >= 150 && WEAK.stop <= 60 && SICK.graded === 1 && WEAK.graded === 1, 'a sick one freezes the frame; a plain one barely does', `sick ${SICK.stop} ms · plain ${WEAK.stop} ms`)
  ok(OLD.graded === 0 && OLD.shoved === 1, 'an ungraded stiff arm keeps v193 AJ\'s shove', `graded ${OLD.graded} · shoved ${OLD.shoved}`)

  // ================= 7. the paint =================
  const PAINT = await page.evaluate(() => {
    const sc = window.__gridironScene, H = sc.hookV194D(), Gm = H.geo
    const yAt = Gm.F_TOP + (Gm.F_BOT - Gm.F_TOP) * 0.3, xYd = yd => Gm.PLAY_L + yd / 100 * Gm.PLAY_W
    const white = p => p && p.kind === 'paint' && Math.min(...p.rgb) > 165 && (Math.max(...p.rgb) - Math.min(...p.rgb)) < 60
    const green = p => p && p.kind === 'grass' && p.rgb[1] > p.rgb[0] * 1.08 && p.rgb[1] > p.rgb[2] * 1.15
    // the 30-yard line: the nearest sample that reads as paint, within half a yard of the sim's line
    let line = null, lineX = null; for (let d = -1.5; d <= 1.5; d += .25) { const p = H.paintAt(xYd(30) + d, yAt); if (white(p)) { line = p; lineX = xYd(30) + d; break } }
    const mid = H.paintAt(xYd(32.5), yAt), mid2 = H.paintAt(xYd(27.5), yAt)
    const ezL = H.paintAt(Gm.PLAY_L - Gm.EZ * .5, (Gm.F_TOP + Gm.F_BOT) / 2 + 40), ezR = H.paintAt(Gm.PLAY_L + Gm.PLAY_W + Gm.EZ * .5, (Gm.F_TOP + Gm.F_BOT) / 2 + 40)
    // a scuff laid on the line keeps the line's paint, and its burst throws it — and nothing touched Math.random
    const R0 = Math.random; let draws = 0; Math.random = function () { draws++; return R0() }
    let d = null; try { d = sc.addDirtV193AG(lineX || xYd(30), yAt, .6, 0) } finally { Math.random = R0 }
    const burst = H.paint.lastBurst
    const dg = sc.addDirtV193AG(xYd(32.5), yAt + 3, .6, 0)
    const burstG = H.paint.lastBurst
    return { line, lineX, mid, mid2, ezL: ezL && ezL.kind, ezR: ezR && ezR.kind, ezCss: [ezL && ezL.css.base, ezR && ezR.css.base], dPaint: d && d.paint && d.paint.kind, burst, draws, gPaint: dg && dg.paint && dg.paint.kind, burstG,
      whiteOK: white(line), greenOK: green(mid) && green(mid2) }
  })
  console.log('paint:', JSON.stringify(PAINT))
  ok(PAINT.whiteOK, 'an impact on a yard line reads WHITE (the paint)', PAINT.line && PAINT.line.css.base)
  ok(PAINT.greenOK, 'an impact between the lines reads grass GREEN', [PAINT.mid && PAINT.mid.css.base, PAINT.mid2 && PAINT.mid2.css.base].join(' '))
  ok(PAINT.ezL === 'paint' || PAINT.ezR === 'paint', 'an impact in an end zone reads its paint, not grass', PAINT.ezCss.join(' '))
  ok(PAINT.dPaint === 'paint' && PAINT.burst && PAINT.burst.kind === 'paint' && PAINT.gPaint === 'grass' && PAINT.burstG && PAINT.burstG.kind === 'grass' && PAINT.draws === 0, 'the scuff and its burst take the colour they landed on (white off the line, green off the grass) — no Math.random drawn', `${JSON.stringify(PAINT.burst)} · ${JSON.stringify(PAINT.burstG)} · draws ${PAINT.draws}`)

  // ================= 8. the kill switches =================
  const OFF = await page.evaluate(() => {
    const sc = window.__gridironScene; window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v194D: 0 })
    try {
      const p = sc.turfPaintAtV194D(300, 200)
      const m = sc.markers[3], H = { cx: { off: m.sx + 20, def: m.sx }, cy: m.sy }, hud0 = m._hud; m._hud = { side: 'off', x: m.sx, y: m.sy }
      const turned = sc.hudFaceInV194D(m, H); m._hud = hud0
      const stiff = sc.stiffArmV194D(sc.play || { t: 0 }, { pow: .9, sick: true }, null, null, false)
      return { p, turned, stiff, idle: sc.idleOnV194D(), between: sc.idleBetweenV194D(16) }
    } finally { delete window.RIB_TUNE.v194D }
  })
  ok(OFF.p === null && OFF.turned === false && OFF.stiff === null && OFF.idle === false && OFF.between === false, 'v194D 0: no paint read, no huddle turn, no graded stiff arm, no idle plan (v193 AG / v87 / v193 AJ / v144 C as they were)', JSON.stringify(OFF))
}
ok(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '))
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail ? 1 : 0)
