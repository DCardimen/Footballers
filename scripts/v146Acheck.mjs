// Dev check: v146 A — EVERY MAN WHO GOES DOWN WAS TAKEN DOWN. Asserts:
//   * THE SACK HE TAKES IS TAKEN BY SOMEBODY — a quarterback who eats the ball (v82) braces on his
//     spot and the sack is emitted only on the tick the rusher is ON him (`sackContactPxV146`); the
//     old path resolved it with the rusher ~3 yards away.
//   * THE SCRIPT PUTS HIM THERE — over every scripted snap of ~20 games (both engines: FieldSim logs,
//     the v139 cut, the legacy choreographer), the NAMED tackler is within `contactPxV146` of the
//     carrier on the frame of the play-ending tackle; after it he rides the carrier down (glued) on
//     every tackle but the hit stick, where he stays on his own legs. With the pass switched off
//     (`contactV146: 0`) the same sampler finds the phantom downs again, so the test means something.
//   * NOTHING THE GAME BOOKS MOVES — the render pass never touches a seeded game's score or yards,
//     and it never renames the tackler or re-times the event.
//   * THE LIVE FIELD — on a real broadcast, the tackler's DRAWN marker is on the carrier's on every
//     tackle, both of them are on the ground after a plain tackle, and a hit-stick hitter stays up.
//   GAME_URL=http://localhost:5301/ node scripts/v146Acheck.mjs
import { chromium } from 'playwright'
const URL = process.env.GAME_URL || 'http://localhost:5173/'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const errs = [], bad = []
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const page = await browser.newPage({ viewport: { width: 400, height: 900 } })
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(2500)   // warm past vite's one-time reload after an edit
await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && typeof window.buildPlayScript === 'function', null, { timeout: 60000 })
await page.evaluate(p => { window.__readPos = p }, process.env.READ_POS || 'LB')
async function step(t) {
  const r = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
      : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className) || /RUN THIS PLAN|LOCK IT IN|CHOOSE/i.test(txt(e)))
        : els.find(e => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null
  }, { t, visSrc: vis })
  console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900)
}

// ================= 1. the sack he takes: the rusher gets there =================
const K = await page.evaluate((G) => {
  const FS = window.__FieldSim, at = (a, t) => { let b = a.frames[0]; for (const f of a.frames) { if (f.t <= t + 1e-6) b = f; else break } return b }
  const A = { taken: 0, braces: 0, far: 0, maxD: 0, closeMs: 0, badYards: 0 }
  const o = FS.pass.bind(FS)
  FS.pass = function (...a) {
    const b4 = (FS._Q || []).length, r = o(...a), q = FS._Q || []
    for (let i = b4; i < q.length; i++) { const lg = q[i].log || q[i]; if (!lg || !lg.events) continue
      const by = {}; for (const x of lg.actors || []) by[x.id] = x
      const br = lg.events.find(e => e.type === 'sackBrace')
      for (const e of lg.events) { if (e.type !== 'tackle' || !e.taken) continue
        A.taken++; if (br) A.braces++
        const k = by[e.tackler], c = by[e.carrier]; if (!k || !c) continue
        const d = Math.hypot(at(k, e.t).x - at(c, e.t).x, at(k, e.t).y - at(c, e.t).y)
        A.maxD = Math.max(A.maxD, +d.toFixed(1)); if (d > window.TU('sackContactPxV146', 8) + 1.5) A.far++
        A.closeMs += e.closeMs || 0
        if (br && Math.abs(br.x - e.x) > 0.01) A.badYards++ } }
    return r }
  for (let g = 0; g < G; g++) window.__simGameV2(50 + (g % 9) * 5, 'QB')
  FS.pass = o
  return A
}, Number(process.env.SACK_GAMES || 40))
console.log('taken sacks:', JSON.stringify(K))
ok(K.taken >= 3, 'sampled the sacks a quarterback takes', `${K.taken} taken`)
ok(K.braces === K.taken, 'every one of them braces first and waits for the man', `${K.braces}/${K.taken}`)
ok(K.far === 0, 'the rusher is ON him when the sack is booked — never yards away', `max ${K.maxD}px`)
ok(K.badYards === 0, 'and the spot is the spot he braced on (the yards are not moved by the wait)', `${K.badYards} moved`)

// ================= 2. the script: the named man is there, and they go down together =================
const sample = (off) => page.evaluate(({ G, off }) => {
  if (off) window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { contactV146: 0 }); else if (window.RIB_TUNE) delete window.RIB_TUNE.contactV146
  const dims = { PLAY_L: 66, PLAY_R: 654, F_TOP: 14, F_BOT: 426 }, reach = window.TU('contactPxV146', 9)
  const at = (fr, t) => { if (t <= fr[0].t) return fr[0]; for (let i = 1; i < fr.length; i++) if (fr[i].t >= t) { const a = fr[i - 1], b = fr[i], k = (t - a.t) / ((b.t - a.t) || 1); return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k } } return fr[fr.length - 1] }
  const A = { plays: 0, downs: 0, far: 0, maxD: 0, sacks: 0, farSacks: 0, stick: 0, stickGlued: 0, glued: 0, unglued: 0, renamed: 0, retimed: 0, byEngine: {}, worst: [] }
  for (let g = 0; g < G; g++) {
    window.__FieldSim._Q.length = 0
    const r = window.__simGameV2(50 + (g % 9) * 5, ['QB', 'RB', 'WR', 'DL', 'CB'][g % 5])
    for (const p of r.plays) {
      if (p.header || /^(xp|twopt|timeout|warning|period|toss)$/.test(p.event)) continue
      let s; try { s = window.buildPlayScript(p, { dims, rand: Math.random }) } catch (e) { continue }
      A.plays++
      const tks = s.events.filter(e => e.type === 'tackle' && e.tackler && e.carrier && e.tackler !== e.carrier); if (!tks.length) continue
      const e = tks[tks.length - 1], by = {}; for (const a of s.actors) by[a.id] = a
      const Kk = by[e.tackler], C = by[e.carrier]; if (!Kk || !C) continue
      A.downs++; const eng = s.meta.fieldSim ? (e.v139 ? 'cut' : 'sim') : 'choreo'
      const k0 = at(Kk.frames, e.t), c0 = at(C.frames, e.t), d = Math.hypot(k0.x - c0.x, k0.y - c0.y)
      const B = A.byEngine[eng] = A.byEngine[eng] || { n: 0, far: 0 }; B.n++
      if (e.sack) A.sacks++
      if (d > reach + 0.5) { A.far++; B.far++; if (e.sack) A.farSacks++; if (A.worst.length < 5) A.worst.push({ eng, d: Math.round(d), ev: p.event, sack: !!e.sack }) }
      A.maxD = Math.max(A.maxD, +d.toFixed(1))
      if (!off) {
        if (e.v146 && e.v146.why == null) A.renamed++
        // after the hit: glued (together) or not (the hit stick runs on)
        const post = Kk.frames.filter(f => f.t > e.t + 1)
        const maxPost = post.reduce((m, f) => { const c = at(C.frames, f.t); return Math.max(m, Math.hypot(f.x - c.x, f.y - c.y)) }, 0)
        if (e.v146 && e.v146.stick) { A.stick++; if (post.length > 3 && maxPost <= reach) A.stickGlued++ }
        else if (post.length) { if (maxPost <= reach + 0.5) A.glued++; else { A.unglued++; if (A.worst.length < 6) A.worst.push({ ug: Math.round(maxPost), eng, why: e.v146 && e.v146.why, v: e.v146, te: Math.round(e.t), dur: Math.round(s.duration), kf: Kk.frames.length, cf: C.frames.length, cLast: C.frames[C.frames.length-1].t }) } }
      }
    }
  }
  if (window.RIB_TUNE) delete window.RIB_TUNE.contactV146
  return A
}, { G: Number(process.env.GAMES || 20), off })
const OFF = await sample(true), ON = await sample(false)
console.log('off:', JSON.stringify(OFF))
console.log('on :', JSON.stringify(ON))
ok(OFF.downs > 600 && OFF.far > 20, 'with the pass OFF the sampler finds the phantom downs (the test is live)', `${OFF.far} of ${OFF.downs} tackles with the named man > ${9}px off, worst ${OFF.maxD}px`)
ok(ON.downs > 600, 'sampled a real body of play-ending tackles across both engines', `${ON.downs} tackles over ${ON.plays} scripts ${JSON.stringify(ON.byEngine)}`)
ok(ON.far === 0, 'EVERY play-ending tackle has the NAMED tackler on the carrier on the frame he goes down', `${ON.far} far, max ${ON.maxD}px ${JSON.stringify(ON.worst)}`)
ok(ON.sacks > 10 && ON.farSacks === 0, 'every sack has the sacker on the quarterback', `${ON.sacks} sacks, ${ON.farSacks} far`)
ok(ON.glued > ON.downs * 0.5 && ON.unglued === 0, 'after an ordinary tackle the tackler rides the carrier down — they go down together', `${ON.glued} glued, ${ON.unglued} not`)
ok(ON.stick > 5 && ON.stickGlued < ON.stick, 'a hit-stick hitter keeps his own legs after the hit', `${ON.stick} sticks, ${ON.stickGlued} glued`)

// ================= 3. the book does not move =================
const N = await page.evaluate(() => {
  const real = Math.random
  const seed = s => { let x = s >>> 0; Math.random = () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296 } }
  const run = (off) => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, off ? { contactV146: 0 } : {}); if (!off) delete window.RIB_TUNE.contactV146
    const rows = []; const dims = { PLAY_L: 66, PLAY_R: 654, F_TOP: 14, F_BOT: 426 }
    for (let g = 0; g < 5; g++) { seed(771 + g * 31); window.__FieldSim._Q.length = 0
      const r = window.__simGameV2(55 + g, 'LB')
      const names = r.plays.map(p => { if (p.header) return ''; try { const s = window.buildPlayScript(p, { dims, rand: () => .5 }); const e = s.events.filter(q => q.type === 'tackle').pop(); return e ? e.tackler + '@' + Math.round(e.t) + ':' + Math.round(e.x) : '' } catch (er) { return 'x' } })
      rows.push(r.usScore + ':' + r.themScore + '|' + r.plays.map(p => (p.event || '') + ',' + (p.yards ?? '')).join(';') + '#' + names.join(';')) }
    return rows }
  try { const a = run(true), b = run(false); return { games: a.length, same: a.filter((r, i) => r === b[i]).length } }
  finally { Math.random = real; if (window.RIB_TUNE) delete window.RIB_TUNE.contactV146 }
})
ok(N.same === N.games, 'the render pass changes nothing booked: same score, yards, tackler, event time and spot, seeded, on and off', `${N.same}/${N.games}`)

// ================= 4. the live field =================
if (!process.env.SKIP_LIVE) {
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN']) await step(t)
let live = false
for (let i = 0; i < 6 && !live; i++) {
  for (const t of ['CONTINUE TO MATCH', 'Continue to Match', 'PLAY', 'CONTINUE']) {
    live = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length)); if (live) break
    await step(t)
  }
  live = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length))
  if (!live) await page.waitForTimeout(2500)
}
ok(live, 'the broadcast came up')
await page.evaluate(s => { window.__V146_SPEED = s }, Number(process.env.LIVE_SPEED || 2))
await page.evaluate(() => {
  if (window.__V146_SPEED) window.__getGridironLiveSpeed = () => window.__V146_SPEED   // the check's own clock: more snaps in the same wall time
  const sc = window.__gridironScene, W = window.__V146L = { tackles: 0, farDrawn: 0, maxD: 0, plainBothDown: 0, plainChecked: 0, plainTkUp: 0, stickChecked: 0, stickTkDown: 0, sacks: 0, rows: [] }
  const GROUND = /^(tackleSeq|down|dive|pancakeSeq)$/
  const o = sc.fireEvent.bind(sc)
  sc.fireEvent = function (e, P) {
    let pre = null
    if (e && e.type === 'tackle' && P) {
      const m = sc.markers[P.carrierId >= 0 ? P.carrierId : sc.actorIdx(e.carrier)], tk = sc.markers[sc.actorIdx(e.tackler)]
      if (m && tk) pre = { m, tk, d: Math.hypot(tk.sx - m.sx, tk.sy - m.sy), stick: !!(e.hitStick || (e.flyWho && e.flyWho === e.carrier && e.flyVz > 0)), slide: P.carrierId === 8 && P.scrambling && !e.sack }
    }
    const r = o(e, P)
    if (pre) {
      W.tackles++; if (e.sack) W.sacks++
      W.maxD = Math.max(W.maxD, Math.round(pre.d * 10) / 10); if (pre.d > window.TU('contactPxV146', 9) + 3) { W.farDrawn++; if (W.rows.length < 6) W.rows.push({ d: Math.round(pre.d), sack: !!e.sack, why: e.v146 && e.v146.why }) }
      const t0 = performance.now(); let cDown = false, kDown = false
      const tick = () => {
        if (GROUND.test(String(pre.m.forceState || '')) || pre.m._flyV112) cDown = true
        if (GROUND.test(String(pre.tk.forceState || ''))) kDown = true
        if (performance.now() - t0 < 1400 && !(cDown && kDown && !pre.stick)) return requestAnimationFrame(tick)
        if (pre.slide) return
        if (pre.stick) { W.stickChecked++; if (kDown) W.stickTkDown++ }
        else { W.plainChecked++; if (cDown && kDown) W.plainBothDown++; else if (cDown && !kDown) W.plainTkUp++ }
      }
      requestAnimationFrame(tick)
    }
    return r
  }
})
const L = await page.evaluate(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms))
  for (let i = 0; i < 2600 && window.__V146L.tackles < 24; i++) {
    const b = [...document.querySelectorAll('button')].find(x => /^CONTINUE$/i.test((x.innerText || '').trim()) && x.offsetParent); if (b) b.click()
    await wait(60)
  }
  await wait(1600)
  // a hit stick on the live field (the natural rate is a few a game): the hitter must stay up
  const sc = window.__gridironScene, STK = { fired: 0, tkDown: 0, carrierDown: 0, discard: 0 }
  for (let k = 0; k < 2; k++) {
    let P = null
    for (let i = 0; i < 600; i++) { P = sc.play
      if (P && P.script && P.snapped && P.carrierId >= 0 && P.carrierId < 11 && sc.markers[P.carrierId] && sc.markers[13] && !P.done) break
      P = null; const b = [...document.querySelectorAll('button')].find(x => /^CONTINUE$/i.test((x.innerText || '').trim()) && x.offsetParent); if (b) b.click(); await wait(40) }
    if (!P) continue
    const cm = sc.markers[P.carrierId], tk = sc.markers[13]
    tk.sx = cm.sx + 6; tk.sy = cm.sy + 2
    sc.fireEvent({ t: P.t, type: 'tackle', tackler: 'def2', carrier: 'off' + P.carrierId, x: cm.sx, y: cm.sy, gang: false, bigHit: true, hitStick: true, kb: 12, drive: 0, sup: [], style: 'high', handsOn: 0 }, P)
    const n0 = window.__V146L.tackles - 1; let kd = false, cd = false
    for (let i = 0; i < 20; i++) { await wait(40); if (String(tk.forceState || '') === 'tackleSeq') kd = true; if (/^(tackleSeq|down|dive)$/.test(String(cm.forceState || '')) || cm._flyV112) cd = true }
    if (window.__V146L.tackles !== n0 + 1 || sc.play !== P) { k--; if (++STK.discard > 4) break; await wait(1500); continue }   // the real play ended on top of it — not a sample
    STK.fired++; if (kd) STK.tkDown++; if (cd) STK.carrierDown++
    await wait(2500)
  }
  return { L: window.__V146L, R: window.__V146R || null, STK }
})
console.log('live:', JSON.stringify(L.L), 'renderer hook:', JSON.stringify(L.R && { downs: L.R.downs, far: L.R.far, maxD: L.R.maxD, together: L.R.together, stick: L.R.stick }))
ok(L.L.tackles >= 10, 'watched a real run of tackles on the live broadcast', `${L.L.tackles} tackles (${L.L.sacks} sacks)`)
ok(L.L.farDrawn === 0, 'ZERO downs with nobody on him: the tackler\'s DRAWN marker is on the carrier on every tackle', `${L.L.farDrawn} far, max ${L.L.maxD}px ${JSON.stringify(L.L.rows)}`)
ok(L.R && L.R.far === 0, 'and the renderer\'s own count agrees', L.R && `${L.R.far} of ${L.R.downs}`)
ok(L.L.plainChecked > 5 && L.L.plainBothDown === L.L.plainChecked, 'on every ordinary tackle BOTH men end up on the grass', `${L.L.plainBothDown}/${L.L.plainChecked} (${L.L.plainTkUp} tackler left standing)`)
ok(L.L.stickTkDown === 0 && L.STK.fired > 0 && L.STK.tkDown === 0 && L.STK.carrierDown === L.STK.fired, 'and a hit-stick hitter stays on his feet while the man he hit goes down', `natural ${L.L.stickChecked} (${L.L.stickTkDown} down), fired ${JSON.stringify(L.STK)}`)

}
console.log(JSON.stringify({ pass, fail, errors: errs.length, badRequests: bad.length }))
if (errs.length) console.log('page errors:\n' + errs.slice(0, 8).join('\n')); else console.log('page errors: none')
if (bad.length) console.log('bad requests:\n' + bad.slice(0, 5).join('\n'))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
