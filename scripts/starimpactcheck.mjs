// Paired full-game calibration for one player rated above an otherwise mirrored
// team. Each pass uses deterministic seeds and compares every configured talent
// gap with the same no-star baseline.
//
// Usage:
//   CHROME_PATH=/path/to/chromium npm run check:star
//   RUNS=10 PAIRS=1 npm run check:star
//   GAPS=10,20,30,40 RUNS=10 PAIRS=1 npm run check:star
//   PAIRS=20 ASSERT=1 STAR_SCALES='{"RB":0.12}' npm run check:star
import fs from 'node:fs'
import { chromium } from 'playwright'

const runs = Math.max(1, Number(process.env.RUNS || 1))
const pairs = Math.max(1, Number(process.env.PAIRS || 4))
const passOffset = Math.max(0, Number(process.env.PASS || 0))
const assertBalance = process.env.ASSERT === '1'
const chromePath = process.env.CHROME_PATH || '/opt/pw-browsers/chromium'
const gaps = [...new Set(String(process.env.GAPS || process.env.STAR_GAP || '20').split(',').map(Number).filter(value => Number.isFinite(value) && value > 0))]
if (!gaps.length) throw new Error('GAPS must contain at least one positive number')
const scaleOverrides = process.env.STAR_SCALES ? JSON.parse(process.env.STAR_SCALES) : {}
for (const pos of ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S']) {
  const value = process.env[`STAR_${pos}`]
  if (value != null) scaleOverrides[pos] = Number(value)
}

const allArchetypes = [
  { pos: 'QB', name: 'pocket', attrs: { awareness: 30, power: 30, hands: 30, strength: 30, speed: 10, accel: 10, agility: 10, burst: 10 } },
  { pos: 'QB', name: 'mobile', attrs: { speed: 30, accel: 30, agility: 30, awareness: 30, burst: 10, power: 10, strength: 10, hands: 10 } },
  { pos: 'QB', name: 'balanced', attrs: { awareness: 30, power: 30, speed: 30, agility: 30, accel: 10, burst: 10, strength: 10, hands: 10 } },
  { pos: 'RB', name: 'elusive', attrs: { speed: 30, accel: 30, agility: 30, burst: 30, strength: 10, awareness: 10, hands: 10, catching: 10 } },
  { pos: 'RB', name: 'power', attrs: { strength: 30, power: 30, awareness: 30, burst: 30, speed: 10, accel: 10, agility: 10, hands: 10 } },
  { pos: 'RB', name: 'receiving', attrs: { catching: 30, hands: 30, speed: 30, agility: 30, accel: 10, burst: 10, awareness: 10, strength: 10 } },
  { pos: 'WR', name: 'deep', attrs: { speed: 30, accel: 30, burst: 30, catching: 30, hands: 10, agility: 10, awareness: 10, strength: 10 } },
  { pos: 'WR', name: 'route', attrs: { agility: 30, awareness: 30, catching: 30, hands: 30, speed: 10, accel: 10, burst: 10, strength: 10 } },
  { pos: 'WR', name: 'contested', attrs: { catching: 30, hands: 30, strength: 30, power: 30, speed: 10, accel: 10, agility: 10, awareness: 10 } },
  { pos: 'TE', name: 'seam', attrs: { speed: 30, accel: 30, catching: 30, hands: 30, awareness: 10, agility: 10, strength: 10, blocking: 10 } },
  { pos: 'TE', name: 'inline', attrs: { strength: 30, blocking: 30, catching: 30, hands: 30, awareness: 10, power: 10, speed: 10, accel: 10 } },
  { pos: 'TE', name: 'red-zone', attrs: { catching: 30, hands: 30, strength: 30, power: 30, speed: 10, accel: 10, awareness: 10, blocking: 10 } },
  { pos: 'OL', name: 'pass-protector', attrs: { blocking: 30, strength: 30, awareness: 30, agility: 30, power: 10, accel: 10, burst: 10, tackling: 10 } },
  { pos: 'OL', name: 'mauler', attrs: { blocking: 30, strength: 30, power: 30, burst: 30, awareness: 10, agility: 10, accel: 10, speed: 10 } },
  { pos: 'OL', name: 'athletic', attrs: { blocking: 30, agility: 30, accel: 30, burst: 30, strength: 10, power: 10, awareness: 10, speed: 10 } },
  { pos: 'DL', name: 'power', attrs: { strength: 30, power: 30, tackling: 30, awareness: 30, speed: 10, accel: 10, burst: 10, agility: 10 } },
  { pos: 'DL', name: 'edge', attrs: { speed: 30, accel: 30, burst: 30, agility: 30, strength: 10, power: 10, tackling: 10, awareness: 10 } },
  { pos: 'DL', name: 'balanced', attrs: { strength: 30, burst: 30, tackling: 30, speed: 30, power: 10, awareness: 10, accel: 10, agility: 10 } },
  { pos: 'LB', name: 'run-stopper', attrs: { tackling: 30, strength: 30, power: 30, awareness: 30, speed: 10, accel: 10, coverage: 10, agility: 10 } },
  { pos: 'LB', name: 'coverage', attrs: { coverage: 30, speed: 30, agility: 30, awareness: 30, tackling: 10, accel: 10, burst: 10, hands: 10 } },
  { pos: 'LB', name: 'blitzer', attrs: { burst: 30, accel: 30, tackling: 30, strength: 30, speed: 10, power: 10, awareness: 10, agility: 10 } },
  { pos: 'CB', name: 'man', attrs: { coverage: 30, speed: 30, agility: 30, awareness: 30, accel: 10, burst: 10, hands: 10, tackling: 10 } },
  { pos: 'CB', name: 'ballhawk', attrs: { coverage: 30, awareness: 30, hands: 30, speed: 30, agility: 10, accel: 10, burst: 10, tackling: 10 } },
  { pos: 'CB', name: 'press', attrs: { coverage: 30, strength: 30, tackling: 30, awareness: 30, speed: 10, accel: 10, agility: 10, hands: 10 } },
  { pos: 'S', name: 'centerfield', attrs: { coverage: 30, speed: 30, awareness: 30, hands: 30, agility: 10, accel: 10, tackling: 10, burst: 10 } },
  { pos: 'S', name: 'box', attrs: { tackling: 30, strength: 30, power: 30, awareness: 30, speed: 10, accel: 10, coverage: 10, burst: 10 } },
  { pos: 'S', name: 'hybrid', attrs: { coverage: 30, tackling: 30, speed: 30, awareness: 30, agility: 10, accel: 10, hands: 10, strength: 10 } }
]
const requestedPositions = new Set((process.env.POSITIONS || 'QB,RB,WR,TE,OL,DL,LB,CB,S').split(',').map(value => value.trim().toUpperCase()).filter(Boolean))
const archetypes = allArchetypes.filter(archetype => requestedPositions.has(archetype.pos))
if (!archetypes.length) throw new Error('POSITIONS did not select a benchmark position')

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1])
if (scripts.length < 5) throw new Error(`Expected at least 5 inline scripts, found ${scripts.length}`)

const rosterNeedle = 'U>=0&&(j[U]={name:o.player&&o.player.name||"You",num:xn(e),pos:e,isOff:c,you:!0,ovr:r,attrs:qr(),stat:a});'
const rosterHook = `${rosterNeedle}if(window.__starImpactBenchmarkV40&&U>=0){const star=j[U],peers=j.filter((_,idx)=>idx!==U),avg=(key)=>peers.reduce((sum,pl)=>sum+(Number(pl.attrs&&pl.attrs[key])||45),0)/Math.max(1,peers.length),clone=(pl,isOff)=>Object.assign({},pl,{name:pl.name+" Mirror",isOff,you:!1,attrs:Object.assign({},pl.attrs||{}),stat:Object.assign({},pl.stat||{})}),keys=Object.keys(star.attrs||{}),peerOvr=Math.round(peers.reduce((sum,pl)=>sum+(Number(pl.ovr)||45),0)/Math.max(1,peers.length));star.ovr=peerOvr,keys.forEach(key=>star.attrs[key]=avg(key));v.off=P.off.map(pl=>clone(pl,!0)),v.def=P.def.map(pl=>clone(pl,!1));const boost=window.__starImpactBoostV40,gap=Math.max(1,Number(window.__starImpactGapV40)||20),attrScale=gap/20;if(boost){star.ovr=peerOvr+gap;Object.entries(boost).forEach(([key,delta])=>star.attrs[key]=(Number(star.attrs[key])||45)+Number(delta||0)*attrScale)}}`
let installed = false
const runtimeScripts = scripts.slice(0, 5).map(source => {
  let lean = source.replace(/data:image\/[^;"']+;base64,[A-Za-z0-9+/=]+/g, 'data:image/png;base64,')
  if (lean.includes(rosterNeedle)) {
    lean = lean.replace(rosterNeedle, rosterHook)
    installed = true
  }
  return lean
})
if (!installed) throw new Error('Could not install the star-gap benchmark hook')

const browser = await chromium.launch({ executablePath: chromePath })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const pageErrors = []
page.on('pageerror', error => {
  if (!error.message.includes("Cannot set properties of null (setting 'textContent')")) pageErrors.push(error.message)
})
await page.setContent(`<!doctype html><html><body>
  <div id="splash"><div class="splash-title"><b></b></div></div>
  <div id="app"><span id="prestigeCount"></span><span id="ppCount"></span><div id="screen"></div><div id="dock"></div></div>
  <div id="pwaStatus"></div><div id="toast"></div><div id="cinemaFlash"></div><div id="momentBanner"></div>
</body></html>`)
await page.evaluate(({ scaleOverrides }) => {
  window.__starImpactBenchmarkV40 = true
  window.__starImpactScalesV40 = scaleOverrides
}, { scaleOverrides })
for (const source of runtimeScripts) await page.addScriptTag({ content: source })
await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && typeof window.__getGridironState === 'function')

const rows = await page.evaluate(({ archetypes, runs, pairs, passOffset, gaps }) => {
  const attrNames = ['speed', 'acceleration', 'agility', 'quickness', 'strength', 'catching', 'throwing', 'tackling', 'blocking', 'awareness', 'vision', 'grit', 'stamina', 'injuryResist', 'jumping', 'ballControl', 'discipline']
  const state = window.__getGridironState()
  state.prestige = 0
  state.tree = {}
  state.rosterPrestigeV158 = {}
  state._tempStatBuffsV25 = null
  window.__youStatBoostPctV20 = 0
  window.__youTempBuffsV25 = null
  window.__gameScriptBiasV23 = null
  const seeded = input => {
    let seed = input | 0
    Math.random = () => {
      seed |= 0
      seed = seed + 0x6D2B79F5 | 0
      let value = Math.imul(seed ^ seed >>> 15, 1 | seed)
      value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value
      return ((value ^ value >>> 14) >>> 0) / 4294967296
    }
  }
  const output = []
  for (let run = 0; run < runs; run++) {
    for (let archetypeIndex = 0; archetypeIndex < archetypes.length; archetypeIndex++) {
      const archetype = archetypes[archetypeIndex]
      state.player = { level: 7, pos: archetype.pos, name: 'Benchmark Player', attrs: Object.fromEntries(attrNames.map(name => [name, 215])) }
      for (let pair = 0; pair < pairs; pair++) {
        const pass = passOffset + run + 1
        const seed = (0x40a11ce + pass * 0x1000193 + archetypeIndex * 0x9e3779b + pair * 0x85ebca6b) | 0
        window.__starImpactBoostV40 = null
        seeded(seed)
        const baseline = window.__simGameV2(60, archetype.pos)
        for (const gap of gaps) {
          window.__starImpactGapV40 = gap
          window.__starImpactBoostV40 = archetype.attrs
          seeded(seed)
          const boosted = window.__simGameV2(60, archetype.pos)
          const star = boosted.roster.us.off.concat(boosted.roster.us.def).find(player => player.you)
          const unit = ['QB', 'RB', 'WR', 'TE', 'OL'].includes(archetype.pos) ? boosted.roster.us.off : boosted.roster.us.def
          const peerOvr = Math.round(unit.filter(player => !player.you).reduce((sum, player) => sum + player.ovr, 0) / Math.max(1, unit.filter(player => !player.you).length))
          output.push({
            pass,
            gap,
            pos: archetype.pos,
            archetype: archetype.name,
            baselineMargin: baseline.usScore - baseline.themScore,
            boostedMargin: boosted.usScore - boosted.themScore,
            baselineUs: baseline.usScore,
            baselineThem: baseline.themScore,
            boostedUs: boosted.usScore,
            boostedThem: boosted.themScore,
            boostedWin: boosted.usScore > boosted.themScore,
            boostedTie: boosted.usScore === boosted.themScore,
            starOvr: star && star.ovr,
            peerOvr
          })
        }
      }
    }
  }
  return output
}, { archetypes, runs, pairs, passOffset, gaps })
await browser.close()

const rounded = (value, places = 1) => Number(value.toFixed(places))
const summarize = sample => {
  const projectedMargins = sample.map(row => row.boostedMargin)
  const projectedMarginMean = projectedMargins.reduce((sum, margin) => sum + margin, 0) / sample.length
  const marginVariance = projectedMargins.reduce((sum, margin) => sum + (margin - projectedMarginMean) ** 2, 0) / Math.max(1, sample.length - 1)
  const marginStandardError = Math.sqrt(marginVariance / sample.length)
  const pairedMargins = sample.map(row => row.boostedMargin - row.baselineMargin)
  const pairedMarginMean = pairedMargins.reduce((sum, margin) => sum + margin, 0) / sample.length
  const pairedVariance = pairedMargins.reduce((sum, margin) => sum + (margin - pairedMarginMean) ** 2, 0) / Math.max(1, sample.length - 1)
  const pairedStandardError = Math.sqrt(pairedVariance / sample.length)
  return {
    pairs: sample.length,
    projectedMargin: rounded(projectedMarginMean),
    projectedMarginSE: rounded(marginStandardError, 2),
    projectedMargin95: [rounded(projectedMarginMean - 1.96 * marginStandardError), rounded(projectedMarginMean + 1.96 * marginStandardError)],
    baselineMargin: rounded(sample.reduce((sum, row) => sum + row.baselineMargin, 0) / sample.length),
    pairedMarginDelta: rounded(pairedMarginMean),
    pairedMarginDeltaSE: rounded(pairedStandardError, 2),
    pairedMarginDelta95: [rounded(pairedMarginMean - 1.96 * pairedStandardError), rounded(pairedMarginMean + 1.96 * pairedStandardError)],
    boostedWinPct: rounded(100 * sample.filter(row => row.boostedWin).length / sample.length),
    baselineScore: rounded(sample.reduce((sum, row) => sum + row.baselineUs, 0) / sample.length),
    boostedScore: rounded(sample.reduce((sum, row) => sum + row.boostedUs, 0) / sample.length),
    opponentScore: rounded(sample.reduce((sum, row) => sum + row.boostedThem, 0) / sample.length),
    avgStarGap: rounded(sample.reduce((sum, row) => sum + row.starOvr - row.peerOvr, 0) / sample.length),
    fortyPointWins: sample.filter(row => row.boostedMargin >= 40).length,
    sixtyPointTeams: sample.filter(row => row.boostedUs >= 60 || row.boostedThem >= 60).length,
    hundredPointTeams: sample.filter(row => row.boostedUs >= 100 || row.boostedThem >= 100).length
  }
}

const positions = [...new Set(archetypes.map(archetype => archetype.pos))]
const passSummaries = []
for (const gap of gaps) {
  for (const pass of [...new Set(rows.map(row => row.pass))]) {
    const sample = rows.filter(row => row.gap === gap && row.pass === pass)
    passSummaries.push({
      pass,
      gap,
      positions: Object.fromEntries(positions.map(pos => [pos, summarize(sample.filter(row => row.pos === pos))]))
    })
  }
}
const gapResults = Object.fromEntries(gaps.map(gap => [gap, Object.fromEntries(positions.map(pos => [pos, summarize(rows.filter(row => row.gap === gap && row.pos === pos))]))]))
const calibrationGap = gaps.includes(20) ? 20 : gaps[0]
const byPosition = gapResults[calibrationGap]
const byArchetype = Object.fromEntries(archetypes.map(({ pos, name }) => [`${pos}-${name}`, summarize(rows.filter(row => row.gap === calibrationGap && row.pos === pos && row.archetype === name))]))
const summary = {
  runs,
  pairsPerArchetype: pairs,
  pairedGames: rows.length,
  fullGameSimulations: rows.length + rows.length / gaps.length,
  gaps,
  calibrationGap,
  scales: { QB: .55, RB: .18, WR: .36, TE: .32, OL: .55, DL: 1, LB: .27, CB: .28, S: .4, ...scaleOverrides },
  passes: passSummaries,
  gapResults,
  positions: byPosition,
  archetypes: byArchetype,
  pageErrors
}
console.log(JSON.stringify(summary, null, 2))

if (assertBalance) {
  const bands = { QB: [6.5, 8.5], RB: [1, 7], WR: [1, 7], TE: [1, 7], OL: [.5, 6], DL: [.5, 7], LB: [2.5, 5], CB: [1.5, 6.5], S: [1, 7] }
  const calibrationRows = rows.filter(row => row.gap === calibrationGap)
  const checks = positions.map(pos => [`${pos} paired margin swing is ${bands[pos][0]}–${bands[pos][1]}`, byPosition[pos].pairedMarginDelta >= bands[pos][0] && byPosition[pos].pairedMarginDelta <= bands[pos][1]])
  checks.push(['every benchmark star has the requested OVR gap', rows.every(row => Math.abs(row.starOvr - row.peerOvr - row.gap) <= .1)])
  checks.push(['40-point wins are <= 5%', calibrationRows.filter(row => row.boostedMargin >= 40).length / calibrationRows.length <= .05])
  checks.push(['60-point games are <= 8%', calibrationRows.filter(row => row.boostedUs >= 60 || row.boostedThem >= 60).length / calibrationRows.length <= .08])
  checks.push(['no team scores 100', rows.every(row => row.boostedUs < 100 && row.boostedThem < 100)])
  checks.push(['no page errors', pageErrors.length === 0])
  console.log(`\n+${calibrationGap} OVR checks:`)
  for (const [label, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'}  ${label}`)
  if (checks.some(([, passed]) => !passed)) process.exitCode = 1
}
