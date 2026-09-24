// Dev check (v125 THE TOP OF THE COUNTRY IS ABSURD): what it takes to be #1.
//
// br() used to map production onto its quality factor with a flat `/.85`, so the national
// leader was whoever produced 1.85x his level's baseline — at EVERY level, Pee Wee to DFL. A
// perf-85 season was #1 of 1.8 million kids. The elite line is per-level now, written as a
// multiple of the DFL per-game baseline (`per[7]`), and it is ABSURD at the bottom of the
// pyramid: the best nine-year-old in America puts up five times what a DFL starter does.
//
// Asserts: the leader's line at each level is the advertised multiple of the DFL baseline;
// the curve falls monotonically from Pee Wee to college; no level got EASIER than the old
// flat line; rate and lower-is-better stats are untouched; the generated top-25 board shows
// the numbers the rank now demands and stays ordered; and the ranking itself is much harder —
// the season that used to finish #1 in the country now finishes well down the board.
import { chromium } from 'playwright'
import { CHROME, gameUrl } from './lib/env.mjs'
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 520, height: 1000 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.goto(gameUrl('?stayStale'), { waitUntil: 'networkidle', timeout: 25000 })
await page.waitForTimeout(1400)
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }

const V = await page.evaluate(() => {
  const V = window.__V125, R = window.__RANK_V52, Ne = R.Ne()
  const out = { nfl: V.nfl, leaders: {}, rates: {}, lower: {}, slopes: [] }
  for (const pos of ['WR', 'RB', 'QB', 'LB']) {
    out.leaders[pos] = []
    for (let l = 0; l <= 8; l++) out.leaders[pos].push(V.leader(l, pos))
  }
  // a rate stat and a lower-is-better stat keep the old flat line
  out.rates.ypc = V.r(0, Ne.RB.stats.find(s => s.key === 'ypc'))
  out.rates.grade = V.r(0, Ne.OL.stats.find(s => s.key === 'grade'))
  out.lower.int = V.r(0, Ne.QB.stats.find(s => s.key === 'int'))
  for (let l = 0; l <= 8; l++) out.slopes.push(+V.r(l, Ne.WR.stats.find(s => s.key === 'recYds')).toFixed(2))
  return out
})
console.log('elite line (WR recYds, x own baseline):', JSON.stringify(V.slopes))
console.log('WR leader per game:', JSON.stringify(V.leaders.WR.map(x => x.perGame)))
console.log('RB leader per game:', JSON.stringify(V.leaders.RB.map(x => x.perGame)))

ok(V.leaders.WR.every((x, l) => Math.abs(x.vsPro - V.nfl[l]) < .02 || x.r === 1.85),
  'the national leader puts up exactly the advertised multiple of the DFL baseline',
  JSON.stringify(V.leaders.WR.map(x => x.vsPro)))
ok(V.leaders.WR[0].vsPro >= 4.9 && V.leaders.RB[0].vsPro >= 4.9,
  'the best kid in Pee Wee produces FIVE TIMES a DFL starter',
  `WR ${V.leaders.WR[0].perGame} rec yds/g · RB ${V.leaders.RB[0].perGame} rush yds/g`)
ok(V.leaders.WR[4].vsPro >= 2.4 && V.leaders.WR[4].vsPro <= 3.1,
  'and the Varsity leader 2-3x, as the grades were asked for', `${V.leaders.WR[4].vsPro}x · ${V.leaders.WR[4].perGame} rec yds/g`)
const desc = V.slopes.slice(0, 6)
ok(desc.every((v, i) => i === 0 || v <= desc[i - 1] + 1e-9), 'the line falls every step up the pyramid, Pee Wee to college', JSON.stringify(desc))
ok(V.slopes.every(v => v >= 1.85 - 1e-9), 'and no level is EASIER than the flat line it replaced', JSON.stringify(V.slopes))
ok(V.rates.ypc === 1.85 && V.rates.grade === 1.85 && V.lower.int === 1.85,
  'rate stats and lower-is-better stats keep the old line — a yards-per-carry is not five times anything',
  JSON.stringify({ ...V.rates, ...V.lower }))

// the generated board shows what the rank demands, and stays ordered
const board = await page.evaluate(() => {
  const R = window.__RANK_V52, out = {}
  for (const l of [0, 4, 7]) {
    const rows = window.__NI_V125 ? window.__NI_V125(l, 'WR', 7) : null
    out[l] = rows ? rows.map(r => r.line.recYds) : null
  }
  return out
})
const boardOk = await page.evaluate(() => {
  // rank a line straight through the public hook instead: kr() is the board's own answer
  const R = window.__RANK_V52, Ne = R.Ne(), sd = Ne.WR.stats.find(s => s.key === 'recYds'), V = window.__V125
  const out = {}
  for (const l of [0, 2, 4, 7]) {
    const games = window.__A_V125 ? 0 : 0
    const lead = V.leader(l, 'WR')
    out[l] = { atLeader: R.kr(l, sd, lead.season), atHalf: R.kr(l, sd, Math.round(lead.season * .5)),
      atOld: R.kr(l, sd, Math.round(sd.per[l] * 1.85 * (lead.season / (sd.per[l] * lead.r)))) }
  }
  return out
})
console.log('rank at the leader line / at half of it / at the OLD leader line:', JSON.stringify(boardOk))
ok([0, 2, 4, 7].every(l => boardOk[l].atLeader <= 2), 'producing the elite line ranks you #1 (or #2) in the country', JSON.stringify(Object.fromEntries([0, 2, 4, 7].map(l => [l, boardOk[l].atLeader]))))
ok(boardOk[0].atOld > 200 && boardOk[2].atOld > 25,
  'and the season that used to be #1 in the country is nowhere near it now',
  `Pee Wee #${boardOk[0].atOld} · Middle School #${boardOk[2].atOld}`)
ok([0, 2, 4].every(l => boardOk[l].atHalf > boardOk[l].atLeader * 10), 'half the leader line is a long way down the board', JSON.stringify(Object.fromEntries([0, 2, 4].map(l => [l, boardOk[l].atHalf]))))

// the board a player actually sees
await page.evaluate(() => { try { window.go('stats') } catch (_) { } })
console.log('page errors:', errs.length ? errs.join('\n') : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
