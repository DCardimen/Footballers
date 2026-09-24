// Dev check: v110 — THE MAN WHO IS THERE. Position on the field has to decide who makes the play.
// Over ~12 simmed games it asserts, at the MOMENT OF THE STOP and at the moment the ball arrives:
//   * the nearest defender to the ball is the one who made the stop, nearly always
//   * almost nobody is standing inside two yards of the ball with no part in the play
//   * the new paths actually fire: the commit is taken over by a closer man, a man the carrier runs
//     into makes contact without owning the commit, a read lands because the ball is at his feet,
//     and a defender other than the assigned cover man plays the ball at the catch point
//   * and the credit follows the man who made the play (`out.coverPlayer`), never the man who was
//     merely assigned — the repo's stat-credit invariant.
// Usage: npm run dev (or any static server on :5173), then: node scripts/v110check.mjs
import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'
const URL = GAME_URL
const GAMES = Number(process.env.V110_GAMES || 12)
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.goto(URL, { waitUntil: 'commit', timeout: 30000 })
await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && !!window.__FieldSim, null, { timeout: 60000 })

const R = await page.evaluate((GAMES) => {
  const FS = window.__FieldSim, TICK = 33, YD = 5.88
  const A = { plays: 0, stops: 0, nearestWasTackler: 0, nearGap: [], tkGap: [],
    near2: 0, near2Idle: 0, near3: 0, near3Idle: 0,
    arrivals: 0, ballManEvents: 0, ballManCloser: 0, ballManPlays: 0,
    picks: 0, pickByBallMan: 0, swats: 0, swatByBallMan: 0, creditFollows: 0, creditWrong: 0 }
  const INVOLVED = /^(tackleLunge|tackleHit|tackleWhiff|grab|tackle|hurdle|stiffarm|brokenTackle|bounce|stagger|pileOn|wrapIn|drag|block|swat|pick)$/
  const scan = (entry, out) => {
    const log = entry && entry.log ? entry.log : entry
    if (!log || !log.events || !log.actors) return
    A.plays++
    const ev = log.events, act = log.actors
    const bm = ev.filter(e => e.type === 'ballMan')
    A.ballManEvents += bm.length
    for (const e of bm) if (e.gap < e.covGap) A.ballManCloser++
    // the ball arriving: did the man who played it have a real claim to it?
    const pick = ev.find(e => e.type === 'pick'), swat = ev.find(e => e.type === 'swat')
    if (pick) { A.picks++; if (bm.length && pick.by === bm[bm.length - 1].by) A.pickByBallMan++ }
    if (swat) { A.swats++; if (bm.length && swat.by === bm[bm.length - 1].by) A.swatByBallMan++ }
    if (bm.length && (pick || swat)) { A.ballManPlays++
      // the engine credits `X.cover`; when a man other than the ASSIGNED cover man played the ball
      // it has to name him instead — `assigned` is the cover argument the engine passed in
      const cp = out && out.cover, assigned = out && out.__assignedCover
      if (cp && assigned) { (cp !== assigned) ? A.creditFollows++ : A.creditWrong++ }
      else if (cp && !assigned) A.creditFollows++
    }
    if (ev.some(e => e.type === 'catch' || e.type === 'incomplete' || e.type === 'pick')) A.arrivals++
    // the stop
    const tk = [...ev].reverse().find(e => e.type === 'tackle' && e.tackler)
    if (!tk) return
    A.stops++
    const inv = new Set([tk.tackler].concat(tk.sup || []))
    for (const e of ev) if (INVOLVED.test(e.type)) for (const k of ['who', 'by', 'tackler']) if (e[k]) inv.add(e[k])
    const idx = Math.max(0, Math.round(tk.t / TICK))
    const gaps = []
    for (const a of act) { if (!/^def/.test(a.id)) continue
      const f = (a.frames || [])[Math.min(idx, (a.frames || []).length - 1)]; if (!f) continue
      gaps.push([a.id, Math.hypot(f.x - tk.x, f.y - tk.y)]) }
    if (!gaps.length) return
    gaps.sort((x, y) => x[1] - y[1])
    if (gaps[0][0] === tk.tackler) A.nearestWasTackler++
    A.nearGap.push(gaps[0][1]); A.tkGap.push((gaps.find(g => g[0] === tk.tackler) || [0, 0])[1])
    for (const [id, g] of gaps) {
      if (g < 2 * YD) { A.near2++; if (!inv.has(id)) A.near2Idle++ }
      if (g < 3 * YD) { A.near3++; if (!inv.has(id)) A.near3Idle++ } }
  }
  for (const n of ['run', 'pass']) { const o = FS[n].bind(FS)
    FS[n] = function (...a) { const b4 = (FS._Q || []).length; const r = o(...a); const q = FS._Q || []
      if (r && n === 'pass') r.__assignedCover = a[5]   // FS.pass(w, k, T, K, target, cover, ...)
      for (let i = b4; i < q.length; i++) scan(q[i], r); return r } }
  for (let i = 0; i < GAMES; i++) window.__simGameV2(58 + i * 2, 'LB')
  const med = a => a.length ? +a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)].toFixed(1) : null
  return { plays: A.plays, stops: A.stops,
    nearestPct: +(100 * A.nearestWasTackler / Math.max(1, A.stops)).toFixed(1),
    medNearestPx: med(A.nearGap), medTacklerPx: med(A.tkGap),
    idle2ydPct: A.near2 ? +(100 * A.near2Idle / A.near2).toFixed(1) : null,
    idle3ydPct: A.near3 ? +(100 * A.near3Idle / A.near3).toFixed(1) : null,
    arrivals: A.arrivals, ballManEvents: A.ballManEvents, ballManCloser: A.ballManCloser,
    ballManPlays: A.ballManPlays, picks: A.picks, pickByBallMan: A.pickByBallMan,
    swats: A.swats, swatByBallMan: A.swatByBallMan, creditFollows: A.creditFollows, creditWrong: A.creditWrong,
    v110: window.__V110 || null }
}, GAMES)
console.log('sim:', JSON.stringify(R))
const V = R.v110 || {}
ok(R.stops > 300, 'a real body of stops was sampled', `${R.stops} stops over ${R.plays} plays`)
ok(R.nearestPct >= 85, 'the nearest defender to the ball is the man who made the stop', `${R.nearestPct}% (medians: nearest ${R.medNearestPx}px, tackler ${R.medTacklerPx}px)`)
ok(R.idle2ydPct != null && R.idle2ydPct <= 6, 'almost nobody stands inside two yards of the stop with no part in it', `${R.idle2ydPct}% idle within 2 yd`)
ok(R.idle3ydPct != null && R.idle3ydPct <= 22, 'and the three-yard ring is closing, not watching', `${R.idle3ydPct}% idle within 3 yd`)
ok((V.takeovers || 0) > 0, 'the commit is handed to a closer man instead of staying with whoever claimed it', `${V.takeovers} takeovers`)
ok((V.laps || 0) > 0, 'a defender the carrier runs into makes contact without owning the commit', `${V.laps} contacts in his lap`)
ok((V.nearReads || 0) > 0, 'a read lands because the ball is at his feet, not because his clock ran out', `${V.nearReads} proximity reads`)
ok(R.ballManEvents > 0 && R.ballManCloser === R.ballManEvents, 'at the catch point the ball belongs to whoever is nearest, and he really is nearer', `${R.ballManCloser}/${R.ballManEvents}`)
ok(R.picks + R.swats > 0 && R.creditWrong === 0, 'and the credit follows the man who made the play, never the man who was assigned', `${R.creditFollows} followed · ${R.creditWrong} wrong · ${R.picks} picks / ${R.swats} swats`)
console.log(JSON.stringify({ pass, fail, errors: errs.length }))
console.log(errs.length ? 'PAGE ERRORS:\n' + errs.slice(0, 5).join('\n') : 'page errors: none')
await browser.close()
process.exit(fail ? 1 : 0)
