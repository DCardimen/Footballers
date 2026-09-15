// Dev check: v109 D — THE GAME HAS A CLOCK. Asserts, in one pass:
//   * THE EXTRA POINT IS A PLAY — every touchdown row (outside an OT walk-off) is followed by exactly one
//     xp/twopt row that books the 1 or 2, and the last row's score is the game's score.
//   * THE CLOCK TELLS THE TRUTH — every snap row says why the clock stopped (or that it runs), how many
//     seconds the snap took and the runoff after it; a play the sim put out of bounds is never in bounds;
//     the aggregate out-of-bounds rate stays at the pre-v109 18% / 12%; the two-minute warning lands in Q2
//     and Q4; the periods turn on their own rows; the coin toss opens the game.
//   * TIMEOUTS ARE ROWS — a called timeout is its own row (no more text welded onto the previous play),
//     `toLeft` rides every row, and the scorebug shows the pips.
//   * THE FLAG HAS THREE BEATS — penalty rows carry `foul`, the choreography runs flag → announce → respot,
//     and a spot inside a yard of the sticks is measured.
//   * THE KICKS AND THE TACKLES GET THEIR NUMBERS — punts and kickoffs carry their results, runs name the
//     tackler and the direction, and no NaN reaches any row's stat line (P.ff / P.fum).
//   node scripts/v109Dcheck.mjs        (GAMES=60, GAME_URL=http://localhost:5173/)
import { chromium } from 'playwright'
const URL = process.env.GAME_URL || 'http://localhost:5173/'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
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
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(2500)   // warm: the one-time reload after an edit
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

// ================= 1. the engine: sixty games of rows =================
const N = Math.max(10, Number(process.env.GAMES || 60))
const S = await page.evaluate((N) => {
  const o = { games: 0, errors: [], rows: 0, snaps: 0, tds: 0, tdTried: 0, tdMissingTry: [], tryBooksWrong: 0, finalOk: 0, tossFirst: 0, periodsOk: 0,
    badStop: 0, missingSecs: 0, noToLeft: 0, noPeriod: 0, pass: { n: 0, oob: 0, sim: 0, simInBounds: 0 }, run: { n: 0, oob: 0, sim: 0, simInBounds: 0 },
    warnNeeded: 0, warnFound: 0, warnBad: 0, timeouts: 0, weldedTimeouts: 0, toLeftDrops: 0, toLeftBad: 0, fgStealTO: 0,
    pen: 0, penFoulOk: 0, foulResults: {}, punts: 0, puntOk: 0, puntResults: {}, kos: 0, koOk: 0, runs: 0, runNamed: 0, runNamedSim: 0, runDir: 0, nan: 0,
    measures: 0, measureShort: 0, kneelQ2: 0, xp: 0, twopt: 0, xpGood: 0, samples: [] }
  const poss = ["QB", "RB", "WR", "DL", "CB"]
  const allowedStop = new Set(["incomplete", "oob", "timeout", "score", "turnover", "penalty", null])
  const snapEv = new Set(["run", "pass", "incomplete", "sack", "scramble", "turnover", "kneel", "penalty", "fg", "punt"])
  const clockS = c => { const m = /^(\d+):(\d\d)$/.exec(String(c || "")); return m ? +m[1] * 60 + +m[2] : null }
  for (let g = 0; g < N; g++) {
    try {
      const r = window.__simGameV2(45 + (g % 9) * 5, poss[g % 5]), pl = r.plays
      o.games++; o.rows += pl.length
      const last = pl[pl.length - 1]
      if (last && last.usScore + last.themScore === r.usScore + r.themScore) o.finalOk++
      if (pl[0] && pl[0].event === "toss" && pl[0].header) o.tossFirst++
      const subs = pl.filter(p => p.event === "period").map(p => p.sub)
      if (subs.includes("END OF 1ST") && subs.includes("HALFTIME") && subs.includes("END OF 3RD")) o.periodsOk++
      const crossed = { 2: false, 4: false }, warned = { 2: false, 4: false }
      let prevTO = null
      for (let i = 0; i < pl.length; i++) {
        const p = pl[i]
        if (p.period == null) o.noPeriod++
        if (!p.toLeft || p.toLeft.us == null || p.toLeft.them == null) o.noToLeft++
        else {
          if (p.toLeft.us < 0 || p.toLeft.us > 3 || p.toLeft.them < 0 || p.toLeft.them > 3) o.toLeftBad++
          if (prevTO && (p.toLeft.us < prevTO.us || p.toLeft.them < prevTO.them)) { o.toLeftDrops++; if (p.event !== "timeout") { o.samples.length < 6 && o.samples.push("TO dropped on a non-timeout row: " + p.event + " " + String(p.desc).slice(0, 60)) } }
          prevTO = p.toLeft
        }
        if (!p.header && snapEv.has(p.event)) {
          o.snaps++
          if (!allowedStop.has(p.clockStopped === undefined ? "MISSING" : p.clockStopped)) o.badStop++
          if (typeof p.secs !== "number" || typeof p.runoff !== "number") o.missingSecs++
          const cs = clockS(p.clock)
          if ((p.quarter === 2 || p.quarter === 4) && cs != null && cs <= 120 && cs > 0) crossed[p.quarter] = true
        }
        if (p.event === "warning") { if (p.header && p.clock === "2:00" && (p.quarter === 2 || p.quarter === 4)) warned[p.quarter] = true; else o.warnBad++ }
        const isTD = p.scored && p.event !== "fg" && p.event !== "xp" && p.event !== "twopt"
        if (isTD && (p.period || p.quarter) < 5) {
          o.tds++
          const nx = pl[i + 1], nx2 = pl[i + 2]
          if (nx && (nx.event === "xp" || nx.event === "twopt") && !(nx2 && (nx2.event === "xp" || nx2.event === "twopt"))) {
            o.tdTried++
            const pts = nx.try ? nx.try.pts : (nx.scored ? (nx.event === "xp" ? 1 : 2) : 0)
            if (nx.usScore + nx.themScore !== p.usScore + p.themScore + pts) o.tryBooksWrong++
          } else if (o.tdMissingTry.length < 5) o.tdMissingTry.push((nx ? nx.event : "END") + " | " + String(p.desc).slice(0, 70))
        }
        if (p.event === "xp") { o.xp++; if (p.scored) o.xpGood++ }
        if (p.event === "twopt") o.twopt++
        if (p.event === "pass") { o.pass.n++; if (p.oob) o.pass.oob++; if (p.oobSim) { o.pass.sim++; if (!p.oob) o.pass.simInBounds++ } }
        if (p.event === "run" && !/KICKOFF/.test(p.desc) && Math.abs(p.yards) <= 80) { o.run.n++; if (p.oob) o.run.oob++; if (p.oobSim) { o.run.sim++; if (!p.oob) o.run.simInBounds++ } }
        if (p.event === "timeout") { o.timeouts++; if (p.decorative) o.fgStealTO++; if (!p.header || !p.team || !p.toLeft) o.samples.length < 6 && o.samples.push("timeout row malformed: " + JSON.stringify({ h: p.header, team: p.team })) }
        if (p.event !== "timeout" && p.event !== "warning" && /⏱️/.test(String(p.desc || ""))) o.weldedTimeouts++
        if (p.event === "penalty") { o.pen++; const f = p.foul; if (f && f.name && (f.on === "us" || f.on === "them") && typeof f.yards === "number" && f.result) { o.penFoulOk++; o.foulResults[f.result] = (o.foulResults[f.result] || 0) + 1 } }
        if (p.event === "punt") { o.punts++; if (p.puntResult && typeof p.netYds === "number" && typeof p.gross === "number") { o.puntOk++; o.puntResults[p.puntResult] = (o.puntResults[p.puntResult] || 0) + 1 } }
        if (p.event === "kickoff") { o.kos++; if (p.koResult && typeof p.retYds === "number") o.koOk++ }
        if (p.event === "run" && !p.scored && !/FUMBLE|KICKOFF/.test(p.desc) && Math.abs(p.yards) < 80) { o.runs++; if (p.tackler) { o.runNamed++; if (p.tacklerSim) o.runNamedSim++ } if (p.dir) o.runDir++ }
        if (p.measure) { o.measures++; if (!/First down/.test(p.desc)) o.measureShort++ }
        if (p.event === "kneel" && p.quarter === 2) o.kneelQ2++
        for (const k in (p.stat || {})) if (typeof p.stat[k] === "number" && Number.isNaN(p.stat[k])) o.nan++
      }
      for (const q of [2, 4]) if (crossed[q]) { o.warnNeeded++; if (warned[q]) o.warnFound++ }
    } catch (e) { o.errors.push(String(e && e.stack || e).slice(0, 400)) }
  }
  o.hook = JSON.parse(JSON.stringify(window.__V109_D || null))
  // the script side, offline: a penalty row's three beats, and the extra point claiming a kick log
  try {
    const bps = window.buildPlayScript, dims = { PLAY_L: 6, PLAY_R: 714, F_TOP: 14, F_BOT: 426 }
    const pen = bps({ offense: "us", event: "penalty", penalty: true, yards: -5, startBall: 40, endBall: 35, preDown: 1, preToGo: 10, desc: "🚩 False Start, offense (#71 Doe) — 5 yards, replay the down.",
      foul: { name: "False Start", on: "us", side: "offense", player: { num: 71, name: "Doe" }, yards: 5, spot: 35, result: "replay", preSnap: true } }, { dims, rand: Math.random })
    const ev = pen.events.map(e => e.type), tf = pen.events.find(e => e.type === "flag"), ta = pen.events.find(e => e.type === "announce"), ts = pen.events.find(e => e.type === "respot")
    const a0 = pen.actors[0].frames, x0 = a0[0].x, x1 = a0[a0.length - 1].x
    o.flag = { duration: pen.duration, events: ev, order: !!(tf && ta && ts && tf.t < ta.t && ta.t < ts.t), beats: pen.meta.flagBeatsV109, moved: Math.round(x1 - x0), announce: ta && ta.text }
    // an fg log queued by the game, then an xp row asks for it
    const Q = window.__FieldSim && window.__FieldSim._Q
    const fgIdx = Q ? Q.findIndex(e => e.sig.kind === "fg") : -1
    if (fgIdx >= 0) {
      const off = Q[fgIdx].sig.off, before = Q.length
      const xp = bps({ offense: off ? "us" : "them", event: "xp", scored: true, yards: 0, startBall: 97, endBall: 97, preDown: 1, preToGo: 3, desc: "🦶 Extra point is GOOD. (7–0)", try: { kind: "xp", good: true, pts: 1, dist: 20 } }, { dims, rand: Math.random })
      o.xpScript = { fieldSim: !!(xp.meta && xp.meta.fieldSim), claimed: Q.length === before - 1, hasKick: xp.events.some(e => e.type === "kick" || e.type === "fgResult") }
    } else o.xpScript = { fieldSim: null, note: "no fg log left in the queue to claim" }
  } catch (e) { o.scriptErr = String(e && e.stack || e).slice(0, 300) }
  return o
}, N)
console.log('engine:', JSON.stringify(Object.assign({}, S, { samples: undefined, tdMissingTry: undefined, hook: undefined })))
if (S.samples.length) console.log('samples:', S.samples)
if (S.tdMissingTry.length) console.log('TDs without a try:', S.tdMissingTry)
console.log('hook:', JSON.stringify(S.hook))
ok(S.games === N && !S.errors.length, `${S.games} games simulated without an engine error`, S.errors[0])
ok(S.finalOk === S.games, 'the last row\'s score is the game\'s score', `${S.finalOk}/${S.games}`)
ok(S.tds > 0 && S.tdTried === S.tds, 'every touchdown is followed by exactly one xp/twopt row', `${S.tdTried}/${S.tds} (xp ${S.xp}, twopt ${S.twopt})`)
ok(S.tryBooksWrong === 0, 'the try row books exactly its points on top of the six', `${S.tryBooksWrong} wrong`)
ok(S.xpGood > 0 && S.xpGood < S.xp, 'extra points are made and missed', `${S.xpGood}/${S.xp} good`)
ok(S.xpScript && S.xpScript.fieldSim === true && S.xpScript.claimed && S.xpScript.hasKick, 'the extra point renders from the FG family\'s sim log', JSON.stringify(S.xpScript))
ok(S.badStop === 0 && S.missingSecs === 0, 'every snap row carries clockStopped ∈ {incomplete,oob,timeout,score,turnover,penalty,null}, secs and runoff', `${S.snaps} snaps, ${S.badStop} bad, ${S.missingSecs} without secs`)
ok(S.noToLeft === 0 && S.toLeftBad === 0 && S.noPeriod === 0, 'toLeft (0..3 a side) and the unclamped period ride every row', `${S.rows} rows, ${S.noToLeft} without toLeft, ${S.noPeriod} without period`)
const pr = S.pass.n ? S.pass.oob / S.pass.n : 0, rr = S.run.n ? S.run.oob / S.run.n : 0
ok(Math.abs(pr - .18) <= .03, 'completed passes go out of bounds 18% ±3 of the time', `${(pr * 100).toFixed(1)}% of ${S.pass.n} (sim said oob on ${(100 * S.pass.sim / Math.max(1, S.pass.n)).toFixed(1)}%)`)
ok(Math.abs(rr - .12) <= .03, 'runs go out of bounds 12% ±3 of the time', `${(rr * 100).toFixed(1)}% of ${S.run.n}`)
ok(S.pass.simInBounds === 0 && S.run.simInBounds === 0, 'a play the sim put out of bounds is never marked in bounds', `${S.pass.sim + S.run.sim} sim-oob plays`)
ok(S.warnNeeded > 0 && S.warnFound === S.warnNeeded && S.warnBad === 0, 'the two-minute warning lands in Q2 and Q4 whenever the clock crossed 2:00', `${S.warnFound}/${S.warnNeeded} halves, ${S.warnBad} malformed`)
ok(S.tossFirst === S.games && S.periodsOk === S.games, 'the coin toss opens every game and the periods turn on their own rows', `toss ${S.tossFirst}, periods ${S.periodsOk}`)
ok(S.timeouts > 0 && S.weldedTimeouts === 0, 'timeouts are rows, and no play row has one welded onto its text', `${S.timeouts} timeout rows (${S.fgStealTO} before a field-goal steal), ${S.weldedTimeouts} welded`)
ok(S.toLeftDrops > 0 && S.toLeftDrops === S.timeouts, 'every drop in toLeft is a timeout row (and every timeout row drops it)', `${S.toLeftDrops} drops / ${S.timeouts} rows`)
ok(S.pen > 0 && S.penFoulOk === S.pen, 'every penalty row carries foul.name / on / yards / result', `${S.penFoulOk}/${S.pen} ${JSON.stringify(S.foulResults)}`)
ok(S.flag && S.flag.order && S.flag.duration > 2000 && S.flag.moved < -20, 'the flag choreography runs flag → announce → respot, and the formation walks to the new spot', JSON.stringify(S.flag))
ok(S.measures > 0, 'spots inside a yard of the sticks are measured', `${S.measures} measurements (${S.measureShort} short)`)
ok(S.punts > 0 && S.puntOk === S.punts, 'every punt row carries puntResult / gross / netYds', `${S.puntOk}/${S.punts} ${JSON.stringify(S.puntResults)}`)
ok(S.kos > 0 && S.koOk === S.kos, 'every kickoff row carries koResult / retYds', `${S.koOk}/${S.kos}`)
ok(S.runs > 0 && S.runNamed / S.runs >= .9, '≥90% of run rows name a tackler', `${(100 * S.runNamed / Math.max(1, S.runs)).toFixed(1)}% (${(100 * S.runNamedSim / Math.max(1, S.runs)).toFixed(1)}% from the sim itself)`)
ok(S.runDir / Math.max(1, S.runs) >= .9, 'and a direction', `${(100 * S.runDir / Math.max(1, S.runs)).toFixed(1)}%`)
ok(S.nan === 0, 'no NaN in any row\'s stat line', `${S.nan}`)
ok(S.kneelQ2 > 0, 'the kneel reaches the end of the first half', `${S.kneelQ2} in ${S.games} games`)

// ================= 2. the live field: the scorebug, the clock, the sticks =================
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
let pips = null, sawStopped = false, sawRunning = false, downTexts = new Set(), rt = null, rowsSeen = 0
for (let i = 0; i < 360; i++) {
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^CONTINUE$/i.test((x.innerText || '').trim()) && x.offsetParent); if (b) b.click() })
  const st = await page.evaluate(() => {
    const us = document.querySelector('.sb-side.us .sb-to-v109'), them = document.querySelector('.sb-side.them .sb-to-v109'), ck = document.getElementById('gameClock')
    const sc = window.__gridironScene
    let rt = null
    try { if (sc && !rt) rt = { xp: sc.resultText({ event: 'xp', scored: true }), tp: sc.resultText({ event: 'twopt', scored: false }), punt: sc.resultText({ event: 'punt', puntResult: 'return', gross: 44, returnYds: 8, yards: 0 }), tb: sc.resultText({ event: 'punt', puntResult: 'touchback', gross: 51 }), inc: sc.resultText({ event: 'incomplete', clockStopped: 'incomplete', yards: 0 }), meas: sc.resultText({ event: 'run', measure: true, yards: 4, desc: 'x 🟢 First down!' }), short: sc.resultText({ event: 'run', measure: true, yards: 4, desc: 'x' }) } } catch (e) { rt = { err: String(e) } }
    return { pips: us && them ? { us: us.querySelectorAll('i').length, usOn: us.querySelectorAll('i.on').length, them: them.querySelectorAll('i').length, themOn: them.querySelectorAll('i.on').length } : null,
      stopped: !!(ck && ck.classList.contains('stopped')), stop: ck ? ck.dataset.stop : null, dd: (document.getElementById('downDist') || {}).textContent || '', rt, idx: window.Z ? window.Z.idx : -1 }
  })
  if (st.pips) pips = st.pips
  if (st.stopped) sawStopped = true; else if (st.stop === '') sawRunning = true
  if (st.dd) downTexts.add(st.dd)
  if (st.rt && !rt) rt = st.rt
  rowsSeen = Math.max(rowsSeen, st.idx)
  await page.waitForTimeout(70)
}
const V = await page.evaluate(() => JSON.parse(JSON.stringify(window.__V109_D || null)))
console.log('live hook:', JSON.stringify(V), 'downDist texts:', [...downTexts].slice(0, 12).join(' | '), 'rows seen', rowsSeen)
ok(pips && pips.us === 3 && pips.them === 3, 'the scorebug shows three timeout pips a side', JSON.stringify(pips))
ok(V && V.pips && V.pips.us <= 3 && V.pips.them <= 3, 'and paints them from the row\'s toLeft', JSON.stringify(V && V.pips))
ok(sawStopped || sawRunning, 'the clock on the bug knows whether it is stopped', `stopped seen: ${sawStopped}, running seen: ${sawRunning}`)
ok(rt && rt.xp === 'EXTRA POINT · GOOD' && rt.tp === '2-PT · NO GOOD' && rt.punt === 'PUNT · 44 YDS, RETURNED 8' && rt.tb === 'PUNT · 51 YDS, TOUCHBACK' && rt.inc === 'INCOMPLETE · CLOCK STOPS' && /^MEASUREMENT/.test(rt.meas) && rt.short === 'MEASUREMENT · SHORT', 'resultText reads the try, the punt\'s numbers, the stopped clock and the measurement', JSON.stringify(rt))
ok(V && (V.fdEvents || 0) + (V.flagScripts || 0) + (V.measureBadges || 0) > 0, 'the renderer saw the sticks, a flag script or a measurement', JSON.stringify({ fd: V && V.fdEvents, flags: V && V.flagScripts, meas: V && V.measureBadges }))

console.log(JSON.stringify({ pass, fail, errors: errs.length, badRequests: bad.length }))
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errs.length || bad.length ? 1 : 0)
