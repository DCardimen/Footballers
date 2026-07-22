// Full-game calibration for two exactly mirrored teams. This loads the real game
// engine without its heavyweight image payloads, then checks both fairness and
// football-shaped outcome ranges. Usage: CHROME_PATH=/path/to/chromium npm run check:equal
import fs from 'node:fs'
import { chromium } from 'playwright'

const gameCount = Math.max(20, Number(process.env.GAMES || 120))
const chromePath = process.env.CHROME_PATH || '/opt/pw-browsers/chromium'
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1])
if (scripts.length < 5) throw new Error(`Expected at least 5 inline scripts, found ${scripts.length}`)

const mirrorNeedle = 'U>=0&&(j[U]={name:o.player&&o.player.name||"You",num:xn(e),pos:e,isOff:c,you:!0,ovr:r,attrs:qr(),stat:a});'
const mirrorPatch = `${mirrorNeedle}if(window.__equalTalentBenchmarkV39){const Y=(_,ie)=>Object.assign({},_,{name:Hr(),isOff:ie,you:!1,attrs:Object.assign({},_.attrs||{}),stat:Object.assign({},_.stat||{})});v.off=P.off.map(_=>Y(_,!0)),v.def=P.def.map(_=>Y(_,!1))}`
let enginePatched = false
const runtimeScripts = scripts.slice(0, 5).map(source => {
  let lean = source.replace(/data:image\/[^;"']+;base64,[A-Za-z0-9+/=]+/g, 'data:image/png;base64,')
  if (lean.includes(mirrorNeedle)) {
    lean = lean.replace(mirrorNeedle, mirrorPatch)
    enginePatched = true
  }
  return lean
})
if (!enginePatched) throw new Error('Could not install the mirrored-roster benchmark hook')

const browser = await chromium.launch({ executablePath: chromePath })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const pageErrors = []
page.on('pageerror', error => {
  if (!error.message.includes("Cannot set properties of null (setting 'textContent')")) {
    pageErrors.push(error.message)
  }
})

await page.setContent(`<!doctype html><html><body>
  <div id="splash"><div class="splash-title"><b></b></div></div>
  <div id="app"><span id="prestigeCount"></span><span id="ppCount"></span><div id="screen"></div><div id="dock"></div></div>
  <div id="pwaStatus"></div><div id="toast"></div><div id="cinemaFlash"></div><div id="momentBanner"></div>
</body></html>`)
await page.evaluate(() => { window.__equalTalentBenchmarkV39 = true })
for (const source of runtimeScripts) await page.addScriptTag({ content: source })
await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && typeof window.__getGridironState === 'function')

const results = await page.evaluate(gameCount => {
  const positions = ['QB', 'RB', 'WR', 'DL', 'LB', 'CB']
  const attrNames = ['speed', 'acceleration', 'agility', 'quickness', 'strength', 'catching', 'throwing', 'tackling', 'blocking', 'awareness', 'vision', 'grit', 'stamina', 'injuryResist', 'jumping', 'ballControl', 'discipline']
  let seed = 0x39e91a7d
  Math.random = () => {
    seed |= 0
    seed = seed + 0x6D2B79F5 | 0
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed)
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
  const state = window.__getGridironState()
  state.prestige = 0
  state.tree = {}
  state.rosterPrestigeV158 = {}
  state._tempStatBuffsV25 = null
  window.__youStatBoostPctV20 = 0
  window.__youTempBuffsV25 = null
  window.__gameScriptBiasV23 = null

  const rosterSig = team => ({
    ovr: team.ovr,
    offOvr: team.offOvr,
    defOvr: team.defOvr,
    off: team.off.map(({ pos, ovr, attrs }) => ({ pos, ovr, attrs })),
    def: team.def.map(({ pos, ovr, attrs }) => ({ pos, ovr, attrs }))
  })
  const sideStats = (game, side) => {
    const box = side === 'us' ? game.team : game.oppTeam
    const plays = game.plays.filter(play => !play.header && play.event !== 'drive' && play.offense === side)
    const returns = play => /KICKOFF RETURN|PUNT RETURN/.test(play.desc || '')
    const rushAttempts = plays.filter(play => (play.event === 'run' && !returns(play)) || play.event === 'scramble').length
    const completions = plays.filter(play => play.event === 'pass').length
    const incompletions = plays.filter(play => play.event === 'incomplete').length
    const interceptions = plays.filter(play => play.event === 'turnover' && /INTERCEPT|PICK SIX/.test(play.desc || '')).length
    const sacksAllowed = plays.filter(play => play.event === 'sack').length
    return {
      points: side === 'us' ? game.usScore : game.themScore,
      yards: box.yds,
      rushYards: box.rush,
      passYards: box.pass,
      rushAttempts,
      completions,
      passAttempts: completions + incompletions + interceptions,
      interceptions,
      sacksAllowed,
      turnovers: box.turn,
      drives: game.plays.filter(play => play.header && play.offense === side).length
    }
  }

  const games = []
  for (let index = 0; index < gameCount; index++) {
    const pos = positions[index % positions.length]
    state.player = {
      level: 7,
      pos,
      name: 'Benchmark Player',
      // ~93 OVR on the game's nonlinear rating curve: level-7 teammates are in
      // the same band, so featured-player usage is neither a hidden buff nor tax.
      attrs: Object.fromEntries(attrNames.map(name => [name, 215]))
    }
    const game = window.__simGameV2(60, pos)
    games.push({
      us: sideStats(game, 'us'),
      them: sideStats(game, 'them'),
      exactMirror: JSON.stringify(rosterSig(game.roster.us)) === JSON.stringify(rosterSig(game.roster.opp)),
      teamOvr: game.roster.us.ovr,
      playerOvr: game.roster.us.off.concat(game.roster.us.def).find(player => player.you)?.ovr || 0
    })
  }
  return games
}, gameCount)
await browser.close()

const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0)
const rounded = (value, places = 2) => Number(value.toFixed(places))
const allSides = results.flatMap(game => [game.us, game.them])
const aggregateSide = side => {
  const rows = results.map(game => game[side])
  const rushAttempts = sum(rows, 'rushAttempts')
  const passAttempts = sum(rows, 'passAttempts')
  return {
    points: rounded(sum(rows, 'points') / rows.length, 1),
    yards: rounded(sum(rows, 'yards') / rows.length, 1),
    rushYards: rounded(sum(rows, 'rushYards') / rows.length, 1),
    ypc: rounded(sum(rows, 'rushYards') / Math.max(1, rushAttempts)),
    passYards: rounded(sum(rows, 'passYards') / rows.length, 1),
    completionPct: rounded(100 * sum(rows, 'completions') / Math.max(1, passAttempts), 1),
    passYpa: rounded(sum(rows, 'passYards') / Math.max(1, passAttempts)),
    interceptions: rounded(sum(rows, 'interceptions') / rows.length),
    sacksAllowed: rounded(sum(rows, 'sacksAllowed') / rows.length),
    turnovers: rounded(sum(rows, 'turnovers') / rows.length),
    drives: rounded(sum(rows, 'drives') / rows.length, 1)
  }
}
const us = aggregateSide('us')
const them = aggregateSide('them')
const margins = results.map(game => Math.abs(game.us.points - game.them.points)).sort((a, b) => a - b)
const p90Margin = margins[Math.max(0, Math.ceil(margins.length * 0.9) - 1)]
const usWins = results.filter(game => game.us.points > game.them.points).length
const avgTotal = allSides.reduce((total, side) => total + side.points, 0) / results.length
const summary = {
  games: results.length,
  exactMirrors: results.filter(game => game.exactMirror).length,
  averageTeamOvr: rounded(results.reduce((total, game) => total + game.teamOvr, 0) / results.length, 1),
  averagePlayerOvr: rounded(results.reduce((total, game) => total + game.playerOvr, 0) / results.length, 1),
  usWinPct: rounded(100 * usWins / results.length, 1),
  averageTotalPoints: rounded(avgTotal, 1),
  averageMargin: rounded(margins.reduce((total, margin) => total + margin, 0) / margins.length, 1),
  p90Margin,
  maxMargin: Math.max(...margins),
  shutouts: results.filter(game => game.us.points === 0 || game.them.points === 0).length,
  fortyPointMargins: results.filter(game => Math.abs(game.us.points - game.them.points) >= 40).length,
  sixtyPointTeams: allSides.filter(side => side.points >= 60).length,
  hundredPointTeams: allSides.filter(side => side.points >= 100).length,
  us,
  them,
  pageErrors
}

const checks = [
  ['all rosters are exact mirrors', summary.exactMirrors === summary.games],
  ['featured player matches team talent', Math.abs(summary.averagePlayerOvr - summary.averageTeamOvr) <= 3],
  ['either side wins 38–62%', summary.usWinPct >= 38 && summary.usWinPct <= 62],
  ['average score gap is <= 3.5', Math.abs(us.points - them.points) <= 3.5],
  ['YPC gap is <= 0.65', Math.abs(us.ypc - them.ypc) <= 0.65],
  ['completion gap is <= 5 points', Math.abs(us.completionPct - them.completionPct) <= 5],
  ['pass YPA gap is <= 0.8', Math.abs(us.passYpa - them.passYpa) <= 0.8],
  ['INT gap is <= 0.45/game', Math.abs(us.interceptions - them.interceptions) <= 0.45],
  ['sack gap is <= 0.75/game', Math.abs(us.sacksAllowed - them.sacksAllowed) <= 0.75],
  ['average total is 30–60', summary.averageTotalPoints >= 30 && summary.averageTotalPoints <= 60],
  ['combined YPC is 3.2–5.8', (us.ypc + them.ypc) / 2 >= 3.2 && (us.ypc + them.ypc) / 2 <= 5.8],
  ['combined completion rate is 54–74%', (us.completionPct + them.completionPct) / 2 >= 54 && (us.completionPct + them.completionPct) / 2 <= 74],
  ['combined pass YPA is 5.0–9.5', (us.passYpa + them.passYpa) / 2 >= 5 && (us.passYpa + them.passYpa) / 2 <= 9.5],
  ['combined INT rate is 0.2–2.0/team', (us.interceptions + them.interceptions) / 2 >= 0.2 && (us.interceptions + them.interceptions) / 2 <= 2],
  ['combined sack rate is 1.0–5.5/team', (us.sacksAllowed + them.sacksAllowed) / 2 >= 1 && (us.sacksAllowed + them.sacksAllowed) / 2 <= 5.5],
  ['40-point margins are <= 5%', summary.fortyPointMargins / summary.games <= 0.05],
  ['60-point teams are <= 6%', summary.sixtyPointTeams / allSides.length <= 0.06],
  ['no team scores 100', summary.hundredPointTeams === 0],
  ['no page errors', summary.pageErrors.length === 0]
]

console.log(JSON.stringify(summary, null, 2))
console.log('\nEqual-talent checks:')
for (const [label, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'}  ${label}`)
if (checks.some(([, passed]) => !passed)) process.exitCode = 1
