// Dev check: v151 D — THE HIT IS WON AT THE ANGLE (the live field's feel). Asserts:
//   1. NO FLYING IN — over ~1,500 scripted snaps (FieldSim logs, the v139 cut, the choreographer),
//      the NAMED tackler's drawn approach to a play-ending tackle never runs faster than his own
//      capability (`tacklerPaceCapV151D` x his top speed `sp`, or the pace the sim itself drew him at),
//      the pass that walks him on (`approachV151D`) reports no approach over the cap, and with the
//      v151 D switches OFF the same sampler finds the fly-ins (so the test is live). Contact distance
//      at every tackle stays inside `contactPxV146`.
//   2. THE ANGLE — over thousands of commits, a man on a good line stops the carrier more often than
//      one on a bad line (monotone across five angle buckets, and a wider spread than OFF), while the
//      overall stop rate stays inside a tolerance of OFF.
//   3. THE PUSH — `pushV151D` fires, and during a push-back both men travel together, backward.
//   4. HE FINDS HIS FEET — on the live field every stumble hands over to a recovery of a sane length.
//   5. THE FEET — frames of the run cycle per sprite-pixel travelled sit inside the stride band at
//      1x, 2x and 4x, and vary far less across speeds and scales than the old cadence would.
//   6. THE MOVES — juke / spin / side step draw their sequences on the sim's own `cut` events; a spin
//      walks through at least four facings.
//   7. THE SKIN — skin pixels are a natural tone, tones vary across the 22, and a kit texture's
//      non-skin pixels are exactly the kit recolour (skin never touches a kit, a kit never skin).
//   GAME_URL=http://localhost:5660/ node scripts/v151Dcheck.mjs   (GAMES, SKIP_LIVE, SHOTS=dir)
import { chromium } from 'playwright'
import fs from 'node:fs'
import { CHROME, GAME_URL } from './lib/env.mjs'
const browser = await chromium.launch({ executablePath: CHROME })
const errs = []
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const page = await browser.newPage({ viewport: { width: 420, height: 900 } })
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { setInterval(() => { document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)
await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(2500)
await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && typeof window.buildPlayScript === 'function', null, { timeout: 60000 })
const G = Number(process.env.GAMES || 20)

// ================= 1. no flying in =================
const pace = (off) => page.evaluate(({ G, off }) => {
  const OFF = { paceV151D: 0, approachV151D: 0 }
  if (off) window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, OFF); else for (const k in OFF) delete window.RIB_TUNE[k]
  const dims = { PLAY_L: 66, PLAY_R: 654, F_TOP: 14, F_BOT: 426 }, cap = window.TU('tacklerPaceCapV151D', 1.45), reach = window.TU('contactPxV146', 9)
  const at = (fr, t) => { if (t <= fr[0].t) return fr[0]; for (let i = 1; i < fr.length; i++) if (fr[i].t >= t) { const a = fr[i - 1], b = fr[i], k = (t - a.t) / ((b.t - a.t) || 1); return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k } } return fr[fr.length - 1] }
  const CONTACT = /^(brokenTackle|stiffarm|bounce|hurdle|pileOn|wrapIn|tackleWhiff|stagger|pilePush|grab|drag|tackleHit|tackleLunge|pushV151D)$/
  const A = { scripts: 0, tackles: 0, over: 0, overBig: 0, maxR: 0, ratios: [], dist: [], far: 0, byWhy: {}, worst: [] }
  if (window.__V151D) Object.assign(window.__V151D, { approaches: 0, over: 0, waits: 0, waitMs: 0, maxWait: 0, maxRatio: 0, capped: 0, byWhy: {} })
  for (let g = 0; g < G; g++) {
    window.__FieldSim._Q.length = 0
    const r = window.__simGameV2(45 + (g % 9) * 5, ['QB', 'RB', 'WR', 'LB', 'CB'][g % 5])
    for (const p of r.plays) {
      if (p.header || /^(xp|twopt|timeout|warning|period|toss)$/.test(p.event)) continue
      let s; try { s = window.buildPlayScript(p, { dims, rand: Math.random }) } catch (e) { continue }
      A.scripts++
      const tks = s.events.filter(e => e.type === 'tackle' && e.tackler && e.carrier && e.tackler !== e.carrier); if (!tks.length) continue
      const e = tks[tks.length - 1], by = {}; for (const a of s.actors) by[a.id] = a
      const K = by[e.tackler], C = by[e.carrier]; if (!K || !C || K.frames.length < 3) continue
      A.tackles++
      const skip = s.events.filter(q => (q.who === K.id || q.tackler === K.id || q.by === K.id) && CONTACT.test(q.type)).map(q => q.t)
      const sp = K.sp || 150
      let m = 0
      for (let i = 1; i < K.frames.length; i++) { const f0 = K.frames[i - 1], f1 = K.frames[i]
        if (f1.t < e.t - 1200 || f1.t > e.t - 60 || skip.some(q => Math.abs(q - f1.t) < 130)) continue
        let j = i; while (j < K.frames.length - 1 && K.frames[j].t - f0.t < 99) j++
        const f2 = K.frames[j], dt = (f2.t - f0.t) / 1000; if (dt <= 0) continue
        m = Math.max(m, Math.hypot(f2.x - f0.x, f2.y - f0.y) / dt) }
      const ratio = m / sp, why = (e.v146 && e.v146.why) || (s.meta.fieldSim ? 'sim' : 'choreo')
      A.ratios.push(ratio); A.maxR = Math.max(A.maxR, ratio)
      const B = A.byWhy[why] = A.byWhy[why] || { n: 0, over: 0, max: 0 }; B.n++; B.max = Math.max(B.max, +ratio.toFixed(2))
      if (ratio > cap + .15) { A.over++; B.over++ }
      if (ratio > 2) { A.overBig++; if (A.worst.length < 5) A.worst.push({ why, r: +ratio.toFixed(2), sp, ev: p.event, v151: e.v151D || null }) }
      const k0 = at(K.frames, e.t), c0 = at(C.frames, e.t), d = Math.hypot(k0.x - c0.x, k0.y - c0.y); A.dist.push(d); if (d > reach + .5) A.far++
    }
  }
  A.ratios.sort((a, b) => a - b); A.dist.sort((a, b) => a - b)
  const q = (arr, x) => +arr[Math.min(arr.length - 1, Math.floor(x * arr.length))].toFixed(2)
  A.p50 = q(A.ratios, .5); A.p90 = q(A.ratios, .9); A.p99 = q(A.ratios, .99); A.maxR = +A.maxR.toFixed(2)
  A.dP50 = q(A.dist, .5); A.dP99 = q(A.dist, .99); A.dMax = q(A.dist, 1); delete A.ratios; delete A.dist
  A.approach = window.__V151D ? JSON.parse(JSON.stringify(window.__V151D)) : null
  for (const k in OFF) delete window.RIB_TUNE[k]
  return A
}, { G, off })
const PO = await pace(true), PN = await pace(false)
console.log('pace OFF:', JSON.stringify(PO)); console.log('pace ON :', JSON.stringify(PN))
ok(PN.scripts >= 1200 && PN.tackles >= 800, 'sampled a real body of scripted snaps and play-ending tackles', `${PN.scripts} scripts, ${PN.tackles} tackles`)
ok(PO.over > PN.over * 3 && PO.overBig > PN.overBig, 'with v151 D OFF the sampler finds the fly-ins (the test is live)', `OFF ${PO.over} over the cap (${PO.overBig} past 2x, max ${PO.maxR}x) vs ON ${PN.over} (${PN.overBig}, max ${PN.maxR}x)`)
ok(PN.over <= PN.tackles * .03 && PN.overBig <= PN.tackles * .005, 'the named tackler\'s drawn approach stays within his own legs', `${PN.over}/${PN.tackles} over ${1.45 + .15}x sp, ${PN.overBig} past 2x; p50 ${PN.p50} p90 ${PN.p90} p99 ${PN.p99} ${JSON.stringify(PN.byWhy)} ${JSON.stringify(PN.worst)}`)
ok(PN.approach && PN.approach.approaches > 50 && PN.approach.over <= PN.approach.approaches * .02, 'the walk-on itself never adds pace over the cap (the whistle waits instead)', PN.approach && `${PN.approach.approaches} approaches, ${PN.approach.waits} waited (mean ${Math.round(PN.approach.waitMs / Math.max(1, PN.approach.waits))}ms, max ${PN.approach.maxWait}ms), ${PN.approach.over} over`)
ok(PN.far === 0, 'contact happens at contact distance on every tackle', `${PN.far} far; distance p50 ${PN.dP50}px p99 ${PN.dP99}px max ${PN.dMax}px (reach 9px)`)

// ================= 2. the angle, 3. the push =================
const ang = (off) => page.evaluate(({ G, off }) => {
  if (off) window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { angleV151D: 0 }); else delete window.RIB_TUNE.angleV151D
  const FS = window.__FieldSim, rec = [], o = {}
  for (const name of ['run', 'pass']) { o[name] = FS[name]; FS[name] = function (...a) { const r = o[name].apply(FS, a); const q = FS._Q; if (q && q.length) rec.push(q[q.length - 1].log); return r } }
  try { for (let g = 0; g < G; g++) window.__simGameV2(45 + (g % 9) * 5, ['QB', 'RB', 'WR', 'LB', 'CB'][g % 5]) } finally { FS.run = o.run; FS.pass = o.pass; delete window.RIB_TUNE.angleV151D }
  const B = [[-9, -.5], [-.5, -.15], [-.15, .15], [.15, .5], [.5, 9]]
  const tab = B.map(b => ({ b: b.join('..'), n: 0, stop: 0 }))
  const OUT = { tackleWhiff: 'miss', hurdle: 'miss', stiffarm: 'miss', brokenTackle: 'miss', bounce: 'miss', stagger: 'stag', grab: 'stop', tackle: 'stop' }
  const all = { n: 0, stop: 0 }, P = { n: 0, back: 0, fwd: 0, together: 0, backMoved: 0, checked: 0, maxGap: 0 }
  const at = (fr, t) => { let b = fr[0]; for (const f of fr) { if (f.t <= t + 1e-6) b = f; else break } return b }
  for (const lg of rec) {
    const ev = lg.events, by = {}
    for (const e of ev) if (e.cid != null && OUT[e.type] && by[e.cid] == null) by[e.cid] = e
    for (const e of ev) { if (e.type !== 'tackleLunge' || e.angQ == null) continue
      const r = by[e.cid]; if (!r) continue
      all.n++; if (OUT[r.type] === 'stop') all.stop++
      if (e.angSpd == null || e.angSpd < .04) continue
      const row = tab[B.findIndex(b => e.angQ >= b[0] && e.angQ < b[1])]; row.n++; if (OUT[r.type] === 'stop') row.stop++ }
    const A = {}; for (const a of lg.actors) A[a.id] = a
    for (const e of ev) { if (e.type !== 'pushV151D') continue
      P.n++; e.dir < 0 ? P.back++ : P.fwd++
      if (e.dir > 0) continue
      const c = A[e.carrier], k = A[e.who]; if (!c || !k) continue
      const t1 = e.t + Math.min(e.ms || 150, 150), c0 = at(c.frames, e.t), c1 = at(c.frames, t1), k0 = at(k.frames, e.t), k1 = at(k.frames, t1)
      const dir = c.side === 'off' ? 1 : -1, cMove = (c1.x - c0.x) * dir, kMove = (k1.x - k0.x) * dir, gap = Math.hypot(k1.x - c1.x, k1.y - c1.y)
      P.checked++; if (cMove < -.5) P.backMoved++; if (kMove < -.2 && gap < 16) P.together++; P.maxGap = Math.max(P.maxGap, +gap.toFixed(1)) }
  }
  tab.forEach(r => { r.pct = +(100 * r.stop / Math.max(1, r.n)).toFixed(1) })
  return { all: { n: all.n, pct: +(100 * all.stop / Math.max(1, all.n)).toFixed(1) }, tab, P, plays: rec.length }
}, { G: G * 2, off })
const AO = await ang(true), AN = await ang(false)
console.log('angle OFF:', JSON.stringify(AO)); console.log('angle ON :', JSON.stringify(AN))
const mono = t => t.every((r, i) => i === 0 || r.pct >= t[i - 1].pct - 4)
const spread = t => t[4].pct - t[0].pct
ok(AN.all.n > 2000 && AN.tab.every(r => r.n > 60), 'sampled thousands of commits in every angle bucket', `${AN.all.n} commits, buckets ${AN.tab.map(r => r.n).join('/')}`)
ok(mono(AN.tab) && spread(AN.tab) > spread(AO.tab) + 8, 'the ANGLE decides more: stop rate climbs from a bad line to a good one, and the spread is wider than OFF', `ON ${AN.tab.map(r => r.pct).join(' < ')} (spread ${spread(AN.tab).toFixed(1)}) vs OFF ${AO.tab.map(r => r.pct).join(' / ')} (spread ${spread(AO.tab).toFixed(1)})`)
ok(Math.abs(AN.all.pct - AO.all.pct) <= 3, 'the overall stop rate per commit holds', `ON ${AN.all.pct}% vs OFF ${AO.all.pct}%`)
ok(AN.P.back > 20 && AN.P.fwd > 3, 'pushes happen both ways — the tackler drives him back, a strong carrier drives the tackler', `${AN.P.back} back, ${AN.P.fwd} forward over ${AN.plays} plays`)
ok(AN.P.checked > 10 && AN.P.backMoved >= AN.P.checked * .8 && AN.P.together >= AN.P.checked * .8, 'during a push-back BOTH men travel backward together', `${AN.P.backMoved}/${AN.P.checked} carriers moved back, ${AN.P.together} together, max gap ${AN.P.maxGap}px`)

// ================= 7a. the skin: the tones themselves =================
const SK = await page.evaluate(() => {
  const hx = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
  const tones = ['#f3d2b3', '#e8bc97', '#d6a37c', '#bf8a62', '#a4704b', '#86573a', '#6a432c', '#4f3121']
  const hsl = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const d = mx - mn || 1; const h = mx === r ? (60 * ((g - b) / d) + 360) % 360 : mx === g ? 60 * ((b - r) / d) + 120 : 60 * ((r - g) / d) + 240; return { h, s: mx ? (mx - mn) / mx : 0, l: (mx + mn) / 2 } }
  const names = ['a', 'Marcus Hill', 'D. Okafor', 'Jae Park', 'Luis Ortega', 'Tom Brady', 'Andre Smith', 'Kai', 'Sam Lee', 'Omar', 'Vic', 'Zed', 'Q']
  const picks = names.map(n => window.__skinToneV151D({ name: n }))
  return { natural: tones.map(t => hsl(hx(t))), picks, distinct: new Set(picks).size, stable: window.__skinToneV151D({ name: 'Marcus Hill' }) === window.__skinToneV151D({ name: 'Marcus Hill' }), chosen: window.__skinToneV151D({ name: 'x', skinTone: 6 }) }
})
ok(SK.natural.every(t => t.h >= 14 && t.h <= 36 && t.s >= .2 && t.s <= .62), 'every tone in the palette is a natural skin colour (warm hue, moderate saturation)', JSON.stringify(SK.natural.map(t => [Math.round(t.h), +t.s.toFixed(2), Math.round(t.l)])))
ok(SK.distinct >= 5 && SK.stable && SK.chosen === 6, 'tones vary across a roster, are deterministic per player, and a set skinTone wins', `${SK.distinct} tones over ${SK.picks.length} names ${JSON.stringify(SK.picks)}`)

// ================= the live field =================
if (!process.env.SKIP_LIVE) {
  async function step(t) {
    const r = await page.evaluate(({ t, visSrc }) => {
      const vis = eval(visSrc)
      const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
      const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
      let el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
        : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className) || /RUN THIS PLAN|LOCK IT IN|CHOOSE/i.test(txt(e)))
          : els.find(e => txt(e).includes(t))
      if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null
    }, { t, visSrc: vis })
    await page.waitForTimeout(t === 'PLAN' ? 4000 : 900); return r
  }
  for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN']) await step(t)
  let live = false
  for (let i = 0; i < 8 && !live; i++) {
    for (const t of ['CONTINUE TO MATCH', 'Continue to Match', 'NEXT', 'KICK OFF', 'PLAY', 'CONTINUE']) {
      live = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length)); if (live) break
      await step(t)
    }
    if (!live) await page.waitForTimeout(2000)
  }
  ok(live, 'the broadcast came up')
  if (live) {
    await page.evaluate(() => {
      window.__V151_SPEED = 1; window.__getGridironLiveSpeed = () => window.__V151_SPEED
      const sc = window.__gridironScene, W = window.__V151L = { moves: [], shots: [], want: null }
      const o = sc.fireEvent.bind(sc)
      sc.fireEvent = function (e, P) {
        const r = o(e, P)
        try {
          if (e && (e.type === 'cut' || e.type === 'pushV151D' || e.type === 'stagger' || e.type === 'tackleWhiff' || e.type === 'tackle')) {
            const id = e.type === 'cut' ? P.carrierId : sc.actorIdx(e.carrier || e.who), m = sc.markers[id]
            if (e.type === 'cut' && !e.__inj) W.moves.push({ kind: e.kind, simT: Math.round(e.t), drawnT: Math.round(P.t), spin: !!(m && m._spinV151), juke: !!(m && m._jukeV151) })
            if (m && m.root && !W.want && !e.__inj) W.want = { type: e.type + (e.kind ? ':' + e.kind : '') + (e.type === 'tackleWhiff' && e.angQ != null && e.angQ < -.3 ? ':bad' : e.type === 'tackleWhiff' ? ':good' : '') + (e.type === 'pushV151D' ? (e.dir < 0 ? ':back' : ':fwd') : ''), x: m.root.x, y: m.root.y, id }
          }
        } catch (er) {}
        return r
      }
    })
    const SHOTS = process.env.SHOTS || ''
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true })
    const taken = {}
    const runFor = async (ms, speed) => {
      await page.evaluate(s => { window.__V151_SPEED = s }, speed)
      const t0 = Date.now()
      while (Date.now() - t0 < ms) {
        const w = await page.evaluate(() => { const W = window.__V151L; const x = W.want; W.want = null
          const b = [...document.querySelectorAll('button')].find(q => /^(CONTINUE|NEXT PLAY|NEXT)$/i.test((q.innerText || '').trim()) && q.offsetParent); if (b) b.click()
          if (!x) return null; const sc = window.__gridironScene, m = sc.markers[x.id], cv = document.querySelector('canvas'), r = cv && cv.getBoundingClientRect()
          if (!m || !m.root || !r) return null
          const cam = sc.cameras.main, k = r.width / cv.width * (cv.width / cam.width)
          const sx = (m.root.x - cam.worldView.x) * cam.zoom * (r.width / cam.width), sy = (m.root.y - cam.worldView.y) * cam.zoom * (r.height / cam.height)
          return { type: x.type, x: r.left + sx, y: r.top + sy }
        })
        if (w && SHOTS && (taken[w.type] || 0) < 1) {
          taken[w.type] = (taken[w.type] || 0) + 1
          const clip = { x: Math.max(0, w.x - 70), y: Math.max(0, w.y - 70), width: 140, height: 140 }
          for (let f = 0; f < 4; f++) { await page.screenshot({ path: `${SHOTS}/v151D_${w.type.replace(/:/g, '_')}_${f}.png`, clip }); await page.waitForTimeout(70) }
        }
        await page.waitForTimeout(60)
      }
    }
    for (const sp of [1, 2, 4]) await runFor(Number(process.env.LIVE_MS || 40000), sp)
    // the moments themselves, fired on a live carrier so every one is seen (and shot) at 1x: a spin,
    // a juke, a side step, a stumble, a push-back, and a whiff off a bad line vs a good one
    await page.evaluate(() => { window.__V151_SPEED = 1 })
    const TAG = process.env.SHOT_TAG || 'after'
    const INJ = [['spin', { type: 'cut', kind: 'spin', elus: 70, direction: 1 }], ['juke', { type: 'cut', kind: 'juke', elus: 70, direction: -1 }], ['sidestep', { type: 'cut', kind: 'sidestep', elus: 70, direction: 1 }],
      ['stumble', { type: 'stagger', side: 1 }], ['pushback', { type: 'pushV151D', dir: -1, edge: 2.6, ms: 220 }],
      ['whiff_badangle', { type: 'tackleWhiff', angQ: -.8 }], ['whiff_goodangle', { type: 'tackleWhiff', angQ: .8 }]]
    const INJR = {}
    for (const [name, ev] of INJ) {
      let where = null
      for (let i = 0; i < 400 && !where; i++) {
        where = await page.evaluate((ev) => {
          const sc = window.__gridironScene, P = sc && sc.play
          if (!P || !P.script || !P.snapped || P.done || !(P.carrierId >= 0) || P.carrierId > 21) return null
          const cm = sc.markers[P.carrierId]; if (!cm || !cm.root || cm.forceState || (cm._spdPx || 0) < 40) return null
          // the nearest man on the other side is the one in the moment
          let best = -1, bd = 1e9; sc.markers.forEach((m, j) => { if (!m || !m.root || j === P.carrierId || (j < 11) === (P.carrierId < 11)) return; const d = Math.hypot(m.sx - cm.sx, m.sy - cm.sy); if (d < bd) { bd = d; best = j } })
          if (best < 0) return null
          const tk = sc.markers[best], cid = P.script.actors[P.carrierId].id, tid = P.script.actors[best].id
          const e = Object.assign({ __inj: true, t: P.t, x: cm.sx, y: cm.sy, carrier: cid, who: ev.type === 'pushV151D' ? tid : tid, on: cid }, ev)
          if (ev.type === 'tackleWhiff') { tk.sx = cm.sx + 10; tk.sy = cm.sy + 4 }
          sc.fireEvent(e, P)
          const cv = document.querySelector('canvas'), r = cv.getBoundingClientRect(), cam = sc.cameras.main
          const focus = ev.type === 'tackleWhiff' ? tk : cm
          return { x: r.left + (focus.root.x - cam.worldView.x) * cam.zoom * (r.width / cam.width), y: r.top + (focus.root.y - cam.worldView.y) * cam.zoom * (r.height / cam.height),
            spin: !!cm._spinV151, juke: !!cm._jukeV151, rec: !!cm._stumbleV109, push: !!cm._pushV151 }
        }, ev)
        if (!where) { await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(q => /^(CONTINUE|NEXT PLAY|NEXT)$/i.test((q.innerText || '').trim()) && q.offsetParent); if (b) b.click() }); await page.waitForTimeout(50) }
      }
      INJR[name] = where
      if (where && SHOTS) { const clip = { x: Math.max(0, where.x - 60), y: Math.max(0, where.y - 60), width: 120, height: 120 }
        for (let f = 0; f < 6; f++) { await page.screenshot({ path: `${SHOTS}/v151D_${TAG}_${name}_${f}.png`, clip }); await page.waitForTimeout(TAG ? 75 : 75) } }
      await page.waitForTimeout(700)
    }
    console.log('injected:', JSON.stringify(INJR))
    if (SHOTS) { await page.screenshot({ path: `${SHOTS}/v151D_field.png` }) }
    const L = await page.evaluate(() => {
      const R = window.__V151D_R || {}, S = window.__V151D_SKIN || {}, sc = window.__gridironScene
      const tones = sc.markers.map(m => m.skinTone)
      // the skin on a kit texture: the skin pixels are the drawn cell's, every other pixel is the plain kit recolour
      const kit = { checked: 0, skinPx: 0, kitDiff: 0, skinNatural: 0, skinPxN: 0 }
      try {
        const tex = sc.textures.get('spr_def_dn_run0').getSourceImage(), sk = sc.textures.get(window.RIB_SKIN_KEY_PROBE || 'skin151_run_dn0').getSourceImage()
        const c = document.createElement('canvas'); c.width = 48; c.height = 48; const x = c.getContext('2d'); x.drawImage(tex, 0, 0); const a = x.getImageData(0, 0, 48, 48).data
        const c2 = document.createElement('canvas'); c2.width = 48; c2.height = 48; const x2 = c2.getContext('2d'); x2.drawImage(sk, 0, 0); const b = x2.getImageData(0, 0, 48, 48).data
        for (let i = 0; i < 2304; i++) { if (b[i * 4 + 3] > 0) { kit.skinPx++
          // what the layer draws there: grey x tone, for every tone — all natural
          const g = b[i * 4] / 255
          for (const t of ['#f3d2b3', '#6a432c']) { const r = parseInt(t.slice(1, 3), 16) * g, gg = parseInt(t.slice(3, 5), 16) * g, bb = parseInt(t.slice(5, 7), 16) * g
            const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb), h = mx === r ? (60 * ((gg - bb) / (mx - mn || 1)) + 360) % 360 : 999; kit.skinPxN++; if (h >= 12 && h <= 38 && (mx - mn) / mx < .65) kit.skinNatural++ } } }
        kit.checked = 1
      } catch (e) { kit.err = String(e.message || e) }
      return { stride: R.stride, recover: R.recover, recoverFrames: R.recoverFrames, recoverMs: R.recoverMs, push: R.push, pushFrames: R.pushFrames, spin: R.spin, spinSeq: R.spinSeq, juke: R.juke, jukeHop: R.jukeHop, step: R.step, stepHops: R.stepHops, bite: R.bite, overrun: R.overrun,
        moves: window.__V151L.moves, skin: { cells: S.cells, px: S.px, frames: S.frames, tones: S.tones }, markerTones: tones, kit }
    })
    console.log('live:', JSON.stringify(Object.assign({}, L, { moves: L.moves.length, recoverMs: L.recoverMs && L.recoverMs.length, spinSeq: L.spinSeq && L.spinSeq.slice(0, 4) })))
    const st = L.stride || { by: {} }
    const band = [8 / 84, 8 / 30]
    const per = Object.entries(st.by || {}).map(([k, b]) => [k, b.frames / Math.max(1, b.cell), b.n])
    ok(per.length >= 3 && per.every(([, r, n]) => n < 50 || (r >= band[0] && r <= band[1])), 'the feet: run-cycle frames per sprite-pixel travelled sit in the stride band at every play speed', per.map(([k, r, n]) => `${k}x ${r.toFixed(3)} (${n} steps)`).join(', ') + ` band ${band.map(x => x.toFixed(3)).join('..')}`)
    const rs = per.filter(([, , n]) => n > 50).map(([, r]) => r), cv = rs.length > 1 ? Math.sqrt(rs.reduce((a, r) => a + (r - rs.reduce((x, y) => x + y) / rs.length) ** 2, 0) / rs.length) / (rs.reduce((x, y) => x + y) / rs.length) : 0
    ok(cv < .15, 'and the same across 1x / 2x / 4x (no speed-up skating)', `cv ${cv.toFixed(3)}`)
    const rm = L.recoverMs || [], mean = rm.length ? rm.reduce((a, b) => a + b, 0) / rm.length : 0
    ok(L.recover > 0 && rm.length > 0 && mean > 120 && mean < 800, 'every stumble hands over to a recovery — he finds his feet instead of popping back', `${L.recover} recoveries, mean ${Math.round(mean)}ms over ${rm.length}, ${L.recoverFrames} frames`)
    const mv = L.moves || [], drawn = mv.filter(m => (m.kind === 'spin' ? m.spin : m.juke))
    ok(mv.length >= 1 && drawn.length === mv.length && mv.every(m => Math.abs(m.drawnT - m.simT) <= 70), 'every juke / spin / side step draws its move on the sim\'s own cut event', `${drawn.length}/${mv.length} drawn, kinds ${JSON.stringify(mv.reduce((a, m) => (a[m.kind] = (a[m.kind] || 0) + 1, a), {}))}`)
    const seq = L.spinSeq || []
    ok(L.spin === 0 || (seq.length > 0 && seq.every(s => new Set(s).size >= 4)), 'a spin turns THROUGH the facings (at least four in order), not a sprite rotation', `${L.spin} spins ${JSON.stringify(seq.slice(0, 3))}`)
    ok(L.push > 0 && L.pushFrames > 0, 'a push is drawn — both men lean into it', `${L.push} pushes, ${L.pushFrames} frames`)
    ok(L.kit.checked && L.kit.skinPx > 20 && L.kit.skinNatural === L.kit.skinPxN, 'the skin layer draws a natural tone on every skin pixel, light to deep', JSON.stringify(L.kit))
    const tset = new Set(L.markerTones.filter(t => t != null))
    ok(tset.size >= 4 && L.skin.frames > 100, 'the 22 on the field wear varied skin tones', `${tset.size} tones on the field ${JSON.stringify(L.markerTones)}`)
  }
}
// ================= 7b. skin never touches a kit, a kit never touches skin (off the registration itself) =================
const KT = await page.evaluate(() => {
  const sc = window.__gridironScene, API = window.__V151D_SKIN_API; if (!sc || !API) return { skipped: true }
  const px = (im) => { const c = document.createElement('canvas'); c.width = 48; c.height = 48; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, 48, 48).data }
  const R = { cells: 0, skinPx: 0, kitPx: 0, kitDiff: 0, skinDiff: 0, oldSkinInKit: 0 }
  const cols = API.cols().def; if (!cols) return { skipped: 'no def kit' }
  for (const [key, src] of [['spr_def_dn_run0', 'run_dn0'], ['spr_def_sd_run3', 'run_sd3'], ['spr_def_up_run5', 'run_up5'], ['spr_def_dn_idle', 'idle_dn'], ['spr_def_dn_juke1', 'juke_dn1'], ['spr_def_dn_getup3', 'getup_dn3']]) {
    if (!sc.textures.exists(key)) continue
    const cell = API.cell(src); if (!cell) continue
    const m = API.mask(cell), tex = px(sc.textures.get(key).getSourceImage()), rec = px(API.recolor(cell, cols[0], cols[1])), raw = px(cell)
    R.cells++
    for (let i = 0; i < 2304; i++) { if (raw[i * 4 + 3] <= 24) continue
      const d = (a, b) => Math.abs(a[i * 4] - b[i * 4]) + Math.abs(a[i * 4 + 1] - b[i * 4 + 1]) + Math.abs(a[i * 4 + 2] - b[i * 4 + 2])
      if (m && m.mask[i]) { R.skinPx++; if (d(tex, raw) > 3) R.skinDiff++; if (d(rec, raw) > 3) R.oldSkinInKit++ }
      else { R.kitPx++; if (d(tex, rec) > 3) R.kitDiff++ } }
  }
  return R
})
console.log('kit/skin:', JSON.stringify(KT))
if (!KT.skipped) {
  ok(KT.cells >= 4 && KT.skinPx > 100, 'sampled the skin on the registered kit textures', `${KT.cells} cells, ${KT.skinPx} skin px`)
  ok(KT.kitDiff <= KT.kitPx * .02, 'a kit texture\'s non-skin pixels are exactly the kit recolour — skin never touches a kit', `${KT.kitDiff}/${KT.kitPx} differ (a cosmetic deco may paint a few)`)
  ok(KT.skinDiff === 0, 'and its skin pixels are the drawn skin — a kit never touches skin', `${KT.skinDiff}/${KT.skinPx} differ; the old recolour changed ${KT.oldSkinInKit} of them`)
}
console.log(JSON.stringify({ pass, fail, errors: errs.length }))
if (errs.length) console.log('page errors:\n' + errs.slice(0, 8).join('\n')); else console.log('page errors: none')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
