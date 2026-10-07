// Dev check: v192 F (src/04-engine.js FieldSim, src/05-field-renderer.js the broadcast).
//   1. THE BACK IS A RECEIVER (04 `rbRouteV192F`): the back releases on most passes (always when he is the called
//      target) on a back's route drawn from the line; over G simulated games backs draw a UFF-ish share of the targets
//      (`RB_LO`–`RB_HI` %, was ~2%) while completion %, yards per attempt, points and the run game stay in their bands;
//      the kill switch `v192F` 0 puts the share back under 6%
//   2. STAT-CREDIT TRUTH: every completion's credited receiver is the man the log shows catching it (the catch event's
//      actor), and a catch booked to the you-player is a play whose resolved receiver is him
//   3. THE COVERAGE ON THE BROADCAST (04 `zoneV192F` / `manV192F` / `openV192F`): zones carry a centre and a size bigger
//      than the old preview's; man lines name a defender and a receiver and stop at the throw; the open man is a receiver
//      on a route, and his `openV192F` only ever fires before the throw; OFF emits none of it
//   4. the renderer (05 `coverEventV192F` / `drawCoverV192F`): on a live play the injected events draw zone fields and
//      man lines UNDER the players and the sparkle over them; the throw ends the man lines and the sparkle and fades the
//      zones; `v192F` 0 draws nothing
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v192Fcheck.mjs   (G=games per arm, default 24; SKIP_LIVE=1)
import { gameUrl, launch } from './lib/env.mjs'
import { waitLive } from './lib/live.mjs'

const G = +(process.env.G || 24), RB_LO = 10, RB_HI = 22
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
await page.addInitScript(() => { setInterval(() => { try { document.querySelector('.onboard')?.remove() } catch {} }, 60) })
await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__simGameV2 && !!window.__FieldSim, null, { timeout: 40000 })
await page.waitForTimeout(1000)

// ================= 1-3. the engine: sample games ON and OFF =================
const sample = (off) => page.evaluate(({ G, off }) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); A.setState(S); S.tutorialSeen = true
  S.player = A.newPlayer(); S.player.pos = 'RB'; S.player.level = 7
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, off ? { v192F: 0 } : {})
  const FS = window.__FieldSim, oP = FS.pass, oR = FS.run
  const R = { att: 0, comp: 0, yds: 0, ints: 0, runs: 0, runYd: 0, pts: 0, tgt: {}, credit: 0, creditBad: [], youCatch: 0, youBad: 0,
    rbRouteEv: 0, zoneEv: 0, zoneBig: 0, zoneBad: 0, manEv: 0, manBad: 0, manLate: 0, openEv: 0, openBad: 0, openLate: 0 }
  FS.run = function (...a) { const x = oR.apply(FS, a); if (x) { R.runs++; R.runYd += x.yards || 0 } return x }
  FS.pass = function (...a) {
    const X = oP.apply(FS, a), q = FS._Q, log = q && q.length ? q[q.length - 1].log : null
    if (!X || !log || !log.events) return X
    const ev = log.events, Aid = {}; for (const z of log.actors) Aid[z.id] = z
    const thr = ev.find(e => e.type === 'throw'), tThrow = thr ? thr.t : Infinity
    for (const e of ev) {
      if (e.type === 'rbRouteV192F') R.rbRouteEv++
      else if (e.type === 'zoneV192F') { R.zoneEv++; if (!(Aid[e.who] && Aid[e.who].side === 'def' && e.rx > 0 && e.ry > 0 && Number.isFinite(e.x))) R.zoneBad++; if (2 * e.ry >= 60 || 2 * e.rx >= 60) R.zoneBig++ }
      else if (e.type === 'manV192F') { R.manEv++; if (!Aid[e.who] || Aid[e.who].side !== 'def' || (e.on && (!Aid[e.on] || Aid[e.on].side !== 'off'))) R.manBad++; if (e.t > tThrow) R.manLate++ }
      else if (e.type === 'openV192F') { R.openEv++; const w = Aid[e.who]; if (!w || w.side !== 'off' || !['WR', 'TE', 'RB'].includes(w.label)) R.openBad++; if (e.t > tThrow) R.openLate++ }
    }
    if (!X.sack && !X.scramble) {
      R.att++; const p = (X.rec && X.rec.pos) || '?'; R.tgt[p] = (R.tgt[p] || 0) + 1
      if (X.intercepted) R.ints++
      if (X.complete) {
        R.comp++; R.yds += X.yards
        const c = ev.find(e => e.type === 'catch'), who = c && Aid[c.by]
        if (who && X.rec && who.nm === X.rec.name) R.credit++; else if (R.creditBad.length < 4) R.creditBad.push({ by: c && c.by, nm: who && who.nm, rec: X.rec && X.rec.name })
        if (X.rec && X.rec.you) { R.youCatch++; if (!(who && who.you)) R.youBad++ }
      }
    }
    return X
  }
  try { for (let g = 0; g < G; g++) { const r = window.__simGameV2(55 + (g % 7) * 5, ['QB', 'RB', 'WR', 'LB', 'CB'][g % 5]); R.pts += r.usScore + r.themScore } }
  finally { FS.pass = oP; FS.run = oR; delete window.RIB_TUNE.v192F }
  R.rbShare = +((R.tgt.RB || 0) / Math.max(1, R.att) * 100).toFixed(1)
  R.cmpPct = +(R.comp / Math.max(1, R.att) * 100).toFixed(1); R.ypa = +(R.yds / Math.max(1, R.att)).toFixed(2)
  R.ppg = +(R.pts / G).toFixed(1); R.ypc = +(R.runYd / Math.max(1, R.runs)).toFixed(2)
  return R
}, { G, off })

const ON = await sample(false), OFF = await sample(true)
const brief = R => ({ att: R.att, rbShare: R.rbShare, tgt: R.tgt, cmpPct: R.cmpPct, ypa: R.ypa, ppg: R.ppg, runYpc: R.ypc, ints: R.ints })
console.log('ON ', JSON.stringify(brief(ON)))
console.log('OFF', JSON.stringify(brief(OFF)))
ok(ON.rbRouteEv > ON.att * 0.25, 'the back runs a route on a good share of passes', { rbRoutes: ON.rbRouteEv, att: ON.att })
ok(ON.rbShare >= RB_LO && ON.rbShare <= RB_HI, `backs draw ${RB_LO}-${RB_HI}% of the targets`, { on: ON.rbShare, off: OFF.rbShare })
ok(OFF.rbShare < 6 && OFF.rbRouteEv === 0, 'OFF: the old share (backs ~2%), and no v192 F route', { off: OFF.rbShare, ev: OFF.rbRouteEv })
ok(ON.cmpPct >= 58 && ON.cmpPct <= 82 && Math.abs(ON.cmpPct - OFF.cmpPct) < 6, 'completion % stays in its band', { on: ON.cmpPct, off: OFF.cmpPct })
ok(ON.ypa >= 6 && ON.ypa <= 11 && ON.ypa > OFF.ypa - 2, 'yards per attempt stay in their band (short throws to backs pull it a little)', { on: ON.ypa, off: OFF.ypa })
ok(ON.ppg >= 25 && ON.ppg <= 60 && Math.abs(ON.ppg - OFF.ppg) < 12, 'scoring stays in its band (24 games an arm: ~3.5 pts of noise each)', { on: ON.ppg, off: OFF.ppg })
ok(Math.abs(ON.ypc - OFF.ypc) < 1, 'the run game is untouched', { on: ON.ypc, off: OFF.ypc })
ok(ON.comp > 50 && ON.credit === ON.comp, 'every completion is credited to the man the log shows catching it', { comp: ON.comp, credit: ON.credit, bad: ON.creditBad })
ok(ON.youBad === 0, 'a catch booked to the you-player is a play whose resolved receiver is him', { youCatch: ON.youCatch, bad: ON.youBad })
ok(ON.zoneEv > 0 && ON.zoneBad === 0 && ON.zoneBig === ON.zoneEv, 'zone fields: a defender, a centre and a size (bigger than the old preview)', { n: ON.zoneEv, bad: ON.zoneBad, big: ON.zoneBig })
ok(ON.manEv > 0 && ON.manBad === 0 && ON.manLate === 0, 'man lines: a defender on a receiver, never after the throw', { n: ON.manEv, bad: ON.manBad, late: ON.manLate })
ok(ON.openEv > 0 && ON.openBad === 0 && ON.openLate === 0, 'the open man: a receiver on a route, before the throw', { n: ON.openEv, bad: ON.openBad, late: ON.openLate })
ok(OFF.zoneEv + OFF.manEv + OFF.openEv === 0, 'OFF emits none of the coverage events', { z: OFF.zoneEv, m: OFF.manEv, o: OFF.openEv })

// ================= 4. the broadcast =================
if (!process.env.SKIP_LIVE) {
  async function step (t) {
    await page.evaluate((t) => {
      const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
      const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
      const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
      const el = t === 'POS' ? (els.find(e => /^WR\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
        : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className) || /RUN THIS PLAN|LOCK IT IN|CHOOSE/i.test(txt(e)))
          : els.find(e => txt(e).includes(t))
      if (el) { el.scrollIntoView({ block: 'center' }); el.click() }
    }, t)
    await page.waitForTimeout(t === 'PLAN' ? 3000 : 800)
  }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1200)
  for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN']) await step(t)
  const live = await waitLive(page, 60000)
  ok(live, 'the broadcast came up')
  if (live) {
    // a live snap: inject a zone, a man pairing and an open receiver on real actors
    let inj = null
    for (let i = 0; i < 300 && !inj; i++) {
      inj = await page.evaluate(() => {
        const sc = window.__gridironScene, P = sc && sc.play
        if (!P || !P.script || !P.snapped || P.done || P.post || !P.script.actors || P.script.actors.length < 22) return null
        const id = j => P.script.actors[j].id, wr = sc.markers[0], cb = sc.markers[11 + 9]
        if (!wr || !wr.root || !cb || !cb.root) return null
        window.__V192F_R = { zones: 0, man: 0, sparks: 0, frames: 0, events: 0, last: null }
        sc.coverEventV192F({ type: 'zoneV192F', who: id(13), x: cb.sx + 40, y: cb.sy, rx: 60, ry: 80, deep: true }, P)
        sc.coverEventV192F({ type: 'manV192F', who: id(20), on: id(0) }, P)
        sc.coverEventV192F({ type: 'openV192F', who: id(0), open: true, sep: 1.2 }, P)
        return { wr: id(0), cb: id(20) }
      })
      if (!inj) { await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(q => /^(CONTINUE|NEXT PLAY|NEXT)$/i.test((q.innerText || '').trim()) && q.offsetParent); if (b) b.click() }); await page.waitForTimeout(60) }
    }
    ok(!!inj, 'coverage events could be fed to a live play')
    if (inj) {
      await page.waitForTimeout(400)
      const D = await page.evaluate(() => {
        const sc = window.__gridironScene, R = window.__V192F_R, P = sc.play
        const under = sc.covG ? sc.covG.depth : null, over = sc.sparkG ? sc.sparkG.depth : null
        const minMan = Math.min(...sc.markers.filter(m => m && m.root).map(m => m.root.depth))
        return { R: { ...R }, under, over, minMan, endAt: P && P._covV192F ? P._covV192F.endAt : 'gone' }
      })
      ok(D.R.zones > 0 && D.R.man > 0 && D.R.sparks > 0, 'the zone field, the man line and the sparkle are drawn', D.R)
      ok(D.under != null && D.under < D.minMan && D.over > D.minMan, 'zones and man lines sit under the players, the sparkle over them', D)
      const E = await page.evaluate(() => {
        const sc = window.__gridironScene, P = sc.play; if (!P || !P._covV192F) return null
        sc.coverEventV192F({ type: 'throw' }, P); const C = P._covV192F
        const r0 = { ...window.__V192F_R }
        return { man: Object.keys(C.man).length, open: Object.keys(C.open).length, endAt: C.endAt, r0 }
      })
      await page.waitForTimeout(300)
      const E2 = await page.evaluate(() => ({ ...window.__V192F_R }))
      ok(E && E.man === 0 && E.open === 0 && E.endAt != null && E2.sparks === E.r0.sparks && E2.man === E.r0.man, 'the throw ends the man lines and the sparkle', { E, E2 })
      const K = await page.evaluate(() => {
        const sc = window.__gridironScene, P = sc.play; if (!P) return null
        window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v192F: 0 })
        P._covV192F = null; sc.coverEventV192F({ type: 'zoneV192F', who: 'def2', x: 100, y: 200, rx: 60, ry: 60 }, P)
        const none = !P._covV192F; delete window.RIB_TUNE.v192F; return { none }
      })
      ok(K && K.none, 'v192F 0: the renderer takes none of it', K)
    }
  }
}

console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
if (errs.length) console.log('page errors:', errs.slice(0, 6))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
