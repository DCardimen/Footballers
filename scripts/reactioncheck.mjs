// Dev check: v56 reaction time — the stat that claims to drive it now does.
//
// Three faults this guards against:
//   1. `reactMs` ("quickness: first-step latency") was computed on EVERY agent and
//      read by nothing — the identifier appeared exactly once in the whole file.
//      Agents re-aimed instantly every tick; the only brake on a direction change
//      was turn radius, which is agility.
//   2. The route-break delay was clamped hard at 390ms, which ate the bottom half
//      of the stat range: on a 90-degree break every defender below rxq~46
//      produced the SAME 390ms, so awareness 10 and awareness 45 were identical.
//   3. RECOGNITION (reading the break) and REACTION (redirecting once you have)
//      were blurred into one blend, weighted 58% awareness even for the reaction.
// node scripts/reactioncheck.mjs   (needs `npm run dev` on :5173)
import { chromium } from 'playwright'

const fails = []
const ok = (c, label, detail) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${label}${detail ? '  ' + detail : ''}`); if (!c) fails.push(label) }

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(3000)
await page.waitForFunction(() => !!window.buildPlayScript && !!window.__simGameV2, { timeout: 20000 })

// The model is defined inside the sim's play-resolution scope, so it does not
// exist until a play has actually been resolved — warm it up first.
await page.evaluate(() => {
  const dims = { PLAY_L: 6, PLAY_R: 714, F_TOP: 14, F_BOT: 426 }
  const gm = window.__simGameV2(11, 'QB')
  for (const p of gm.plays.slice(0, 12)) { try { window.buildPlayScript(Object.assign({}, p), { dims, rand: Math.random }) } catch (e) {} }
})

// ---- 1. the curve keeps its shape across the WHOLE stat range ---------------
const curve = await page.evaluate(() => {
  const R = window.__REACT_V56; if (!R) return { err: 'no __REACT_V56' }
  const hard = 1.571 / 1.2, shallow = 0.785 / 1.2      // 90-degree and 45-degree breaks
  const at = (st, ang) => R.delay(R.rxq(st, st, st), Math.max(.2, Math.min(1.35, ang)), false)
  return {
    hard: { s10: at(10, hard), s30: at(30, hard), s50: at(50, hard), s99: at(99, hard) },
    shallow: { s10: at(10, shallow), s50: at(50, shallow), s99: at(99, shallow) },
    // the blends must actually differ in what they lean on
    rxqQuickLead: R.rxq(99, 10, 10) > R.rxq(10, 99, 10),
    iqAwareLead: R.iq(10, 99, 10) > R.iq(99, 10, 10),
    reactMs: { q10: R.reactMs(10), q50: R.reactMs(50), q99: R.reactMs(99) }, posK: R.posK,
  }
})
console.log('curve:', JSON.stringify(curve))
ok(!curve.err, 'the reaction model is reachable')
const H = curve.hard
ok(H.s10 > H.s30 && H.s30 > H.s50 && H.s50 > H.s99, 'a sharp break separates every stat level',
  `10:${H.s10} 30:${H.s30} 50:${H.s50} 99:${H.s99} ms`)
// the old clamp made 10 and 50 differ by 17ms; that dead zone must be gone
ok(H.s10 - H.s50 >= 60, 'the bottom half of the range is no longer clamped flat',
  `${H.s10 - H.s50}ms between stat 10 and 50 (was 17ms)`)
ok(H.s10 - H.s99 >= 200, 'and the full range is a real spread', `${H.s10 - H.s99}ms`)
const S = curve.shallow
ok(S.s10 > S.s50 && S.s50 > S.s99, 'shallow breaks still separate too', `${S.s10}/${S.s50}/${S.s99} ms`)
ok(H.s50 > S.s50, 'a sharper break costs more time than a shallow one', `${H.s50} vs ${S.s50} ms`)
ok(curve.rxqQuickLead, 'the REACTION blend leans on quickness')
ok(curve.iqAwareLead, 'the RECOGNITION blend leans on awareness')
ok(curve.reactMs.q10 > curve.reactMs.q99, 'first-step latency falls as quickness rises',
  `${curve.reactMs.q10} -> ${curve.reactMs.q99} ms`)
// the roster hands every defender the TEAM AVERAGE +-8, so without this a nose
// tackle and a corner reacted identically
const P = curve.posK || {}
ok(P.CB > P.S && P.S > P.LB && P.LB > P.DE && P.DE > P.DT,
  'reaction is position-aware — a corner is not a nose tackle',
  `CB ${P.CB} > S ${P.S} > LB ${P.LB} > DE ${P.DE} > DT ${P.DT}`)
ok(P.CB / P.DT >= 1.25, 'and the spread between them is worth having', `${(P.CB/P.DT).toFixed(2)}x`)

// ---- 2. and it is actually CONSUMED by the sim ------------------------------
const live = await page.evaluate(() => {
  const bps = window.buildPlayScript
  const dims = { PLAY_L: 6, PLAY_R: 714, F_TOP: 14, F_BOT: 426 }
  window.__REACT_DEBUG = { n: 0, ms: 0, byQuick: {} }
  for (let g = 0; g < 6; g++) {
    const gm = window.__simGameV2(120 + g, 'QB')
    for (const p of gm.plays) { try { bps(Object.assign({}, p), { dims, rand: Math.random }) } catch (e) {} }
  }
  const D = window.__REACT_DEBUG
  window.__REACT_DEBUG = null
  const avg = k => D.byQuick[k] ? Math.round(D.byQuick[k].ms / D.byQuick[k].n) : null
  return { fired: D.n, avgMs: D.n ? Math.round(D.ms / D.n) : 0,
    low: avg('low'), mid: avg('mid'), high: avg('high'),
    qMin: D.qMin, qMax: D.qMax, qMean: D.n ? Math.round(D.qSum / D.n) : null,
    counts: Object.fromEntries(Object.entries(D.byQuick).map(([k, v]) => [k, v.n])) }
})
console.log('live latency:', JSON.stringify(live))
ok(live.fired > 200, 'first-step latency actually fires in the sim — reactMs is no longer dead code',
  `${live.fired} holds`)
ok(live.avgMs >= 40 && live.avgMs <= 320, 'and the holds are a believable length', `${live.avgMs}ms mean`)
if (live.low != null && live.high != null)
  ok(live.low > live.high, 'quicker defenders hold for less time than slower ones',
    `low-quickness ${live.low}ms vs high ${live.high}ms`)

// ---- 3. the scoreboard is part of the contract ------------------------------
// A latency bug does not surface as a wrong number in this file — it surfaces as
// defences that cannot cover. The first version of this change held the agent's
// remembered INTENT as well as its steering vector, so every tick re-measured
// against a stale heading, re-triggered, and defenders never escaped the hold.
// Every assertion above still passed while games were finishing 251-249.
const board = await page.evaluate(() => {
  let pts = 0, games = 0, hi = 0
  for (let g = 0; g < 14; g++) {
    const gm = window.__simGameV2(300 + g, 'QB')
    const tot = (gm.usScore || 0) + (gm.themScore || 0)
    pts += tot; hi = Math.max(hi, tot); games++
  }
  return { avgCombined: Math.round(pts / games), highest: hi }
})
console.log('scoreboard:', JSON.stringify(board))
ok(board.avgCombined >= 12 && board.avgCombined <= 90,
  'defences still cover — combined score stays in a football range',
  `${board.avgCombined} avg combined`)
ok(board.highest <= 140, 'and no game runs away entirely', `${board.highest} highest combined`)

console.log('page errors:', errs.length ? '\n' + errs.slice(0, 8).join('\n') : 'NONE')
console.log('VERDICT:', fails.length || errs.length ? 'FAIL ' + JSON.stringify(fails) : 'PASS')
if (fails.length || errs.length) process.exitCode = 1
await b.close()
