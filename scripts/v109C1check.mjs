// Dev check: v109 C1 — THE HIT HAS A POINT. Asserts, in one pass over ~400 sim runs and one live game:
//   * EVERY HIT HAS A POINT, A NORMAL, A WEIGHT AND AN ID — each `tackleLunge` carries a `cid` that is
//     echoed by EXACTLY ONE resolving event (whiff / hurdle / stiffarm / broken / bounce / stagger /
//     grab / instantaneous tackle), and every contact event carries `ix, iy, nx, ny, impact, side`.
//   * THE GANG CONVERGES — an instantaneous tackle with supporters emits one `wrapIn` per `sup`.
//   * THE PILE HAS A SHAPE AND A HEARTBEAT — `pileOn` carries `angle / mom / n`, and every grip that
//     lands as a dragged tackle emitted at least one `drag` heartbeat with `pull / n / strain / cid`.
//   * THE FUMBLE COMES LOOSE — every strip `fumble` is followed by `looseBall` and then `recover`,
//     `recover.defRec === fumble.defRec`, the returned `out.fumble` has the same shape (and the same
//     `defRec`) as the pre-v109 same-tick path (`looseV109` at 0), and the scramble is 8-15 ticks.
//   * BALL SECURITY IS VISIBLE — `ballLoose` fires, only ever with `secured: true`, and never
//     changes who has the ball (no `fumble` shares its cid).
//   * THE RENDERER — `window.__V109_C1.hits` counts drawn hits in a live game, `.drags` too.
//   GAME_URL=http://localhost:5183/ node scripts/v109C1check.mjs        (READ_POS=RB)
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

// ================= 1. the sim: every hit, every id, every heartbeat =================
const S = await page.evaluate(() => {
  const FS = window.__FieldSim
  const RESOLVE = { tackleWhiff: 1, hurdle: 1, stiffarm: 1, brokenTackle: 1, bounce: 1, stagger: 1, grab: 1, tackle: 1 }
  const GEO = ['ix', 'iy', 'nx', 'ny', 'impact', 'side']
  const A = { plays: 0, runs: 0, lunges: 0, lungesNoCid: 0, resolvedOnce: 0, resolvedZero: 0, resolvedMany: 0,
    contact: 0, contactMissingGeo: 0, geoBad: 0, byType: {},
    instTackles: 0, instWithSup: 0, wrapIns: 0, wrapInMatch: 0, wrapInMismatch: 0, wrapInReachOk: 0,
    grabs: 0, dragged: 0, draggedWithDrag: 0, drags: 0, dragBadFields: 0, pileOns: 0, pileOnBad: 0, pileN: {},
    fumbles: 0, fumWithLoose: 0, fumWithRecover: 0, recDefRecMatch: 0, recTicksOk: 0, recTicks: [], recOrderOk: 0,
    outFumbles: 0, outShapeOk: 0, outDefRecOk: 0, outKeys: null, outYardsFinite: 0,
    bobbles: 0, bobbleSecured: 0, bobbleSharesFumble: 0, bobbleWithoutCid: 0,
    stiffArmEdge: 0, hurdleClear: 0, quietTrucks: 0, brokens: 0, maxSup: 0 }
  const scan = (entry, r, kind) => {
    const log = entry && entry.log ? entry.log : entry; if (!log || !log.events) return
    const ev = log.events; A.plays++; if (kind === 'run') A.runs++
    const byCid = {}
    for (const e of ev) { if (e.cid == null) continue; (byCid[e.cid] = byCid[e.cid] || []).push(e) }
    for (const e of ev) {
      if (e.type === 'tackleLunge') { A.lunges++; if (e.cid == null) { A.lungesNoCid++; continue }
        const res = (byCid[e.cid] || []).filter(x => RESOLVE[x.type] && !(x.type === 'tackle' && x.dragged))
        if (res.length === 1) A.resolvedOnce++; else if (res.length === 0) A.resolvedZero++; else A.resolvedMany++ }
      if (RESOLVE[e.type] || e.type === 'tackleHit') { if (e.type === 'tackle' && e.cid == null) continue   // finishCarry's out-of-bounds tackle has no commit
        A.contact++; A.byType[e.type] = (A.byType[e.type] || 0) + 1
        if (!GEO.every(k => Number.isFinite(e[k]))) A.contactMissingGeo++
        else if (Math.abs(Math.hypot(e.nx, e.ny) - 1) > .02 || e.impact < 0 || Math.abs(e.side) !== 1) A.geoBad++ }
      if (e.type === 'stiffarm' && Number.isFinite(e.armEdge)) A.stiffArmEdge++
      if (e.type === 'hurdle' && Number.isFinite(e.clearance)) A.hurdleClear++
      if (e.type === 'brokenTackle') { A.brokens++; if (e.quiet) A.quietTrucks++ }
      if (e.type === 'tackle' && e.cid != null && !e.dragged) { A.instTackles++; const sup = Array.isArray(e.sup) ? e.sup : []
        A.maxSup = Math.max(A.maxSup, sup.length)
        if (sup.length) { A.instWithSup++; const w = (byCid[e.cid] || []).filter(x => x.type === 'wrapIn')
          if (w.length === sup.length && w.every(x => sup.indexOf(x.who) >= 0)) A.wrapInMatch++; else A.wrapInMismatch++ } }
      if (e.type === 'wrapIn') { A.wrapIns++; if (Number.isFinite(e.bearing) && Number.isFinite(e.x) && e.cid != null) A.wrapInReachOk++ }
      if (e.type === 'grab') A.grabs++
      if (e.type === 'tackle' && e.dragged) { A.dragged++; if ((byCid[e.cid] || []).some(x => x.type === 'drag')) A.draggedWithDrag++ }
      if (e.type === 'drag') { A.drags++; if (!(Number.isFinite(e.pull) && Number.isFinite(e.n) && e.n >= 1 && typeof e.strain === 'boolean' && e.cid != null && e.by && e.carrier)) A.dragBadFields++ }
      if (e.type === 'pileOn') { A.pileOns++; A.pileN[e.n] = (A.pileN[e.n] || 0) + 1
        if (!(Number.isFinite(e.angle) && Number.isFinite(e.mom) && Number.isFinite(e.n) && e.cid != null)) A.pileOnBad++ }
      if (e.type === 'fumble' && e.strip) { A.fumbles++
        const iF = ev.indexOf(e), lb = ev.find((x, i) => i > iF && x.type === 'looseBall'), rc = ev.find((x, i) => i > iF && x.type === 'recover')
        if (lb) A.fumWithLoose++
        if (rc) { A.fumWithRecover++; if (rc.defRec === e.defRec) A.recDefRecMatch++
          const ticks = Math.round((rc.t - e.t) / 33); A.recTicks.push(ticks); if (ticks >= 8 && ticks <= 15) A.recTicksOk++
          if (lb && ev.indexOf(lb) < ev.indexOf(rc) && ev.indexOf(lb) === iF + 1) A.recOrderOk++
          if (r && r.fumble) { A.outFumbles++; const keys = Object.keys(r.fumble).sort().join(','); A.outKeys = A.outKeys || keys
            if (keys === 'by,defRec,forcedBy,x,y,yards') A.outShapeOk++; if (r.fumble.defRec === rc.defRec) A.outDefRecOk++
            if (Number.isFinite(r.yards)) A.outYardsFinite++ } } }
      if (e.type === 'ballLoose') { A.bobbles++; if (e.secured === true) A.bobbleSecured++; if (e.cid == null) A.bobbleWithoutCid++
        if ((byCid[e.cid] || []).some(x => x.type === 'fumble')) A.bobbleSharesFumble++ }
    }
  }
  const wrap = (name) => { const o = FS[name].bind(FS); FS[name] = function (...a) {
    const before = (FS._Q || []).length; const r = o(...a)
    const q = FS._Q || []; for (let i = before; i < q.length; i++) scan(q[i], r, name)
    return r } }
  wrap('run'); wrap('pass')
  for (let i = 0; i < Number(window.__V109C1_GAMES || 18); i++) window.__simGameV2(60 + i, 'RB')   // v110: the closest man now finishes more stops alone, so the gang sample needs more games
  return A
})
console.log('sim:', JSON.stringify({ plays: S.plays, lunges: S.lunges, contact: S.contact, byType: S.byType, instTackles: S.instTackles, wrapIns: S.wrapIns, grabs: S.grabs, drags: S.drags, pileOns: S.pileOns, pileN: S.pileN, fumbles: S.fumbles, bobbles: S.bobbles, quietTrucks: S.quietTrucks }))
ok(S.plays >= 400 && S.lunges > 400, 'sampled a real body of contact', `${S.plays} plays, ${S.lunges} lunges`)
ok(S.lungesNoCid === 0, 'every tackleLunge carries a cid', `${S.lungesNoCid} without`)
ok(S.resolvedOnce === S.lunges && S.resolvedZero === 0 && S.resolvedMany === 0, 'and every cid is echoed by EXACTLY ONE resolving event', `${S.resolvedOnce}/${S.lunges} once, ${S.resolvedZero} none, ${S.resolvedMany} many`)
ok(S.contact > 400 && S.contactMissingGeo === 0, 'every contact event carries ix/iy/nx/ny/impact/side', `${S.contactMissingGeo} of ${S.contact} missing`)
ok(S.geoBad === 0, 'the normal is unit length, the impact non-negative, the side ±1', `${S.geoBad} bad`)
ok(S.stiffArmEdge > 0 && S.hurdleClear > 0, 'stiffarm carries armEdge and hurdle carries clearance (for C2)', `${S.stiffArmEdge} stiff-arms, ${S.hurdleClear} hurdles`)
ok(S.instWithSup > 10 && S.wrapInMismatch === 0, 'an instantaneous tackle with supporters emits one wrapIn per sup', `${S.wrapInMatch}/${S.instWithSup} matched, ${S.wrapInMismatch} mismatched (max sup ${S.maxSup})`)
ok(S.wrapIns > 0 && S.wrapInReachOk === S.wrapIns, 'and every wrapIn carries who/carrier/x/y/bearing/cid', `${S.wrapIns}`)
ok(S.dragged > 100 && S.draggedWithDrag === S.dragged, 'every grip that landed as a dragged tackle beat at least one drag', `${S.draggedWithDrag}/${S.dragged}`)
ok(S.drags > S.dragged && S.dragBadFields === 0, 'the heartbeat carries carrier/by/pull/n/strain/cid', `${S.drags} drags, ${S.dragBadFields} bad`)
ok(S.pileOns > 10 && S.pileOnBad === 0, 'pileOn carries angle/mom/n/cid', `${S.pileOns} pile-ons`)
ok(S.fumbles > 0 && S.fumWithLoose === S.fumbles && S.fumWithRecover === S.fumbles, 'every strip fumble is followed by looseBall and recover', `${S.fumbles} strips, ${S.fumWithLoose} loose, ${S.fumWithRecover} recovered`)
ok(S.recDefRecMatch === S.fumbles && S.outDefRecOk === S.outFumbles, 'recover.defRec is the fumble\'s pre-rolled defRec, and so is out.fumble.defRec', `${S.recDefRecMatch}/${S.fumbles}, out ${S.outDefRecOk}/${S.outFumbles}`)
ok(S.recOrderOk === S.fumbles, 'fumble → looseBall (next event) → recover, in that order', `${S.recOrderOk}/${S.fumbles}`)
ok(S.recTicksOk === S.fumbles, 'the scramble runs 8-15 ticks', JSON.stringify(S.recTicks.slice(0, 12)))
ok(S.outFumbles > 0 && S.outShapeOk === S.outFumbles && S.outYardsFinite === S.outFumbles, 'the play\'s out.fumble keeps the same shape (by, forcedBy, defRec, yards, x, y)', S.outKeys)
ok(S.bobbles > 0 && S.bobbleSecured === S.bobbles && S.bobbleWithoutCid === 0, 'ballLoose fires, and only ever secured:true', `${S.bobbles} bobbles`)
ok(S.bobbleSharesFumble === 0, 'and never on the commit that became a fumble — no possession change rides it')
ok(S.brokens > 0, 'trucks are emitted (quiet past the fourth in a play)', `${S.brokens} brokens, ${S.quietTrucks} quiet`)

// the switch: looseV109 at 0 puts the same-tick ending back, with the same out shape
const off = await page.evaluate(() => {
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { looseV109: 0 })
  const FS = window.__FieldSim; let fum = 0, shapeOk = 0, sameTick = 0, plays = 0, tackles = 0
  const wrap = (name) => { const o = FS[name].bind(FS); FS[name] = function (...a) { const b4 = (FS._Q || []).length; const r = o(...a); plays++
    const q = FS._Q || []; for (let i = b4; i < q.length; i++) { const lg = q[i].log || q[i]; const ev = lg.events || []
      for (const e of ev) if (e.type === 'tackle') tackles++
      const f = ev.find(e => e.type === 'fumble' && e.strip), rc = ev.find(e => e.type === 'recover')
      if (f && r && r.fumble) { fum++; if (Object.keys(r.fumble).sort().join(',') === 'by,defRec,forcedBy,x,y,yards') shapeOk++; if (rc && rc.t === f.t) sameTick++ } }
    return r } }
  wrap('run'); wrap('pass')
  for (let i = 0; i < 6; i++) window.__simGameV2(80 + i, 'RB')
  delete window.RIB_TUNE.looseV109
  return { fum, shapeOk, sameTick, plays, tackles }
})
ok(off.fum > 0 && off.shapeOk === off.fum && off.sameTick === off.fum, 'looseV109 at 0 puts the same-tick ending back with the identical out.fumble shape', JSON.stringify(off))

// ================= 2. the live field: the hits are drawn at their point =================
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
// 2a. the real broadcast: watch until a drawn contact hit and a drag heartbeat have come through
// the real event stream (nearly every tackled play), with a generous cap
let sawChurn = false, polls = 0, Vw = null
const POLLS = Number(process.env.V109_POLLS || 1400)
for (; polls < POLLS; polls++) {
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^CONTINUE$/i.test((x.innerText || '').trim()) && x.offsetParent); if (b) b.click() })
  const st = await page.evaluate(() => { const sc = window.__gridironScene, P = sc && sc.play, V = window.__V109_C1 || null
    return { V, churn: !!(P && P.__dragV109 && P.t - P.__dragV109.t < 200 && sc.markers.some(m => m && m.body && Math.abs(m.body.y) > 0.2)) } })
  if (st.churn) sawChurn = true
  Vw = st.V
  if (Vw && Vw.hitsGeo > 0 && Vw.drags > 0 && sawChurn) break
  await page.waitForTimeout(70)
}
console.log('live (watched):', JSON.stringify(Vw), 'polls', polls)
ok(Vw && Vw.hitsGeo > 0 && Vw.lastGeo && Number.isFinite(Vw.lastGeo.ix) && Number.isFinite(Vw.lastGeo.impact), 'the real broadcast drew contact hits placed from the sim\'s ix/iy/impact', Vw && `${Vw.hitsGeo} placed, last ${JSON.stringify(Vw.lastGeo)}`)
ok(Vw && Vw.drags > 0, 'and the heartbeat reached the renderer from real plays', Vw && `${Vw.drags} drags`)
ok(sawChurn, 'and the pair visibly churned on it (body bob)')
console.log('   (informational, rare in a short window) real wrap-ins', Vw && Vw.wrapIns, 'pile-ons', Vw && Vw.pileOns)
// 2b. deterministic: drive the real `fireEvent` cases on the live scene with a scripted gang
// tackle, a strip and a bobble — an instantaneous gang tackle is a ~2% play, so a short
// broadcast window cannot be relied on to contain one
const D = await page.evaluate(() => {
  const sc = window.__gridironScene, P = sc && sc.play; if (!sc || !P || !sc.markers || sc.markers.length < 22) return { err: 'no live play' }
  const V0 = JSON.parse(JSON.stringify(window.__V109_C1 || {}))
  const cmI = P.carrierId >= 0 && P.carrierId < 11 ? P.carrierId : 9, cm = sc.markers[cmI], carrier = 'off' + cmI
  const tk = sc.markers[13], s1 = sc.markers[14], s2 = sc.markers[15], rc = sc.markers[16]
  const x = cm.sx, y = cm.sy, t = P.t
  const geo = { cid: 9001, ix: (x + tk.sx) / 2, iy: (y + tk.sy) / 2, nx: .6, ny: .8, impact: 48, side: 1 }
  const fire = e => sc.fireEvent(Object.assign({ t }, e), P)
  fire({ type: 'grab', who: 'def2', carrier, x, y, behind: false, style: 'even', gang: false, ms: 200, handsOn: 0, ...geo })
  fire({ type: 'drag', carrier, by: 'def2', x, y, pull: .2, n: 1, strain: false, vel: .2, cid: 9001 })
  fire({ type: 'pileOn', who: 'def3', carrier, x, y, n: 2, angle: Math.atan2(y - s1.sy, x - s1.sx), mom: 70, cid: 9001 })
  fire({ type: 'drag', carrier, by: 'def2', x, y, pull: .12, n: 2, strain: true, vel: .1, cid: 9001 })
  fire({ type: 'wrapIn', who: 'def4', carrier, x: s2.sx, y: s2.sy, bearing: Math.atan2(y - s2.sy, x - s2.sx), cid: 9001 })
  const mid = { wrapHold: !!(s2._wrapInV109 && s2.forceState === 'grab'), wrapFaces: s2._pair === cmI, pileHold: !!(s1._wrapInV109 && s1.forceState === 'grab'), pileLean: Math.abs(s1._lean || 0) > 0,
    tkGrab: tk.forceState === 'grab', carrierDragging: !!cm._dragging, bodyChurn: [tk, cm].some(m => m.body && Math.abs(m.body.y) > 0.05) || !!(P.__dragV109 && P.__dragV109.n === 2) }
  fire({ type: 'tackle', tackler: 'def2', carrier, x, y, gang: true, bigHit: false, bothFall: false, stayUp: false, kb: 3, drive: 1, sup: ['def3', 'def4'], youIn: undefined, style: 'even', hitStick: false, handsOn: 2, dragged: true, dragMs: 200, dragYd: .5, strain: true, ...geo })
  const afterTackle = { supsStillGrab: [s1, s2].every(m => m.forceState === 'grab'), lastGeoCid: window.__V109_C1.lastGeo && window.__V109_C1.lastGeo.cid }
  fire({ type: 'fumble', x, y, by: carrier, forcedBy: 'def3', defRec: true, strip: true, cid: 9001 })
  fire({ type: 'looseBall', x, y, vx: 1, vy: -.5, by: carrier, cid: 9001 })
  const looseOpen = !!(P.__looseV109 && P.__looseV109.cid === 9001 && P.ballMode === 'loose')
  fire({ type: 'recover', by: 'def5', x: x + 3, y: y - 2, ms: 330, defRec: true, side: 'def', strip: true, cid: 9001 })
  const recovered = P.__looseV109 == null && rc.forceState === 'dive' && P.ballMode === 'held'
  fire({ type: 'ballLoose', who: carrier, x, y, ms: 260, secured: true, cid: 9002, impact: 60, side: 1 })
  const V1 = JSON.parse(JSON.stringify(window.__V109_C1))
  const d = k => (V1[k] || 0) - (V0[k] || 0)
  return { delta: { wrapIns: d('wrapIns'), pileOns: d('pileOns'), drags: d('drags'), hitsGeo: d('hitsGeo'), loose: d('loose'), recovers: d('recovers'), bobbles: d('bobbles'), hits: d('hits') }, mid, afterTackle, looseOpen, recovered, lastDrag: V1.lastDrag }
})
console.log('live (driven):', JSON.stringify(D))
ok(!D.err, 'a live play was available to drive', D.err)
ok(D.delta && D.delta.wrapIns === 1 && D.mid.wrapHold && D.mid.wrapFaces, 'case "wrapIn": the supporter closes into the heap in his grab, paired to the carrier, and the hook counts it', JSON.stringify(D.mid))
ok(D.delta && D.delta.pileOns === 1 && D.mid.pileHold && D.mid.pileLean, 'case "pileOn": the joiner is posed from his arrival angle, leaning in, and holds his grab')
ok(D.delta && D.delta.drags === 2 && D.mid.tkGrab && D.mid.carrierDragging && D.mid.bodyChurn, 'case "drag": two heartbeats churned the pair and deepened the drag', D.lastDrag && JSON.stringify(D.lastDrag))
ok(D.delta && D.delta.hitsGeo >= 2 && D.afterTackle.lastGeoCid === 9001 && D.afterTackle.supsStillGrab, 'case "tackle": the hit was drawn at the sim\'s point with its cid, and every wrapped-in man is still in the heap to fold', JSON.stringify(D.afterTackle))
ok(D.delta && D.delta.loose === 1 && D.looseOpen, 'case "looseBall": the loose window opened on the ball block with the play\'s cid')
ok(D.delta && D.delta.recovers === 1 && D.recovered, 'case "recover": the window closed and the recovering man dived onto it')
ok(D.delta && D.delta.bobbles === 1, 'case "ballLoose": the bobble was drawn and counted')

console.log(JSON.stringify({ pass, fail, errors: errs.length, badRequests: bad.length }))
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errs.length || bad.length ? 1 : 0)
