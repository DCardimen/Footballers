// Dev check: v68 — a maxed team-quality tree must be an edge, not the game.
//
// Every team-quality node fed one raw sum into the score generator, capped at .34
// against a base of .38 + .04/level and an opponent at ~.48: stacked out, that was
// close to doubling your own scoring rate, so a prestiged save won on the tree
// rather than on the player. v68 runs the whole prestige contribution through
// TU("teamQualK") at a tenth of the old weight.
//
// The check drives the REAL score generator (window.__TEAMQUAL_V68.score) over a
// large sample with every team-quality node maxed, at the old dial and the new one,
// and asserts the new setting is ~10x weaker in points-per-game AND that the edge
// survives at all — a nerf to zero would be its own bug.
import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 25000 })
await page.waitForTimeout(1200)

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }

const res = await page.evaluate(() => {
  const S = window.__TEAMQUAL_V68
  const st = window.S
  st.player = st.player || {}
  const pl = { level: 5, pos: 'RB', attrs: {}, stars: 3 }
  // a player the generator can rate: everything else held flat so the ONLY thing
  // moving between the runs is the tree
  const KEYS = ['speed','acceleration','agility','quickness','strength','stamina','awareness','vision',
    'discipline','grit','catching','throwing','tackling','blocking','jumping','injuryResist','ballControl']
  KEYS.forEach(k => pl.attrs[k] = 55)
  const N = 6000
  const run = (tree, k) => {
    st.tree = tree
    window.RIB_TUNE = window.RIB_TUNE || {}
    window.RIB_TUNE.teamQualK = k
    let us = 0, them = 0, won = 0
    for (let i = 0; i < N; i++) { const r = S.score(pl, 62, {}); us += r.us; them += r.them; if (r.won) won++ }
    return { us: +(us / N).toFixed(2), them: +(them / N).toFixed(2), win: +(won / N * 100).toFixed(1) }
  }
  const MAXED = { goodProgram: 6, dynastyTeam: 4, boosters: 6, crowdFavorite: 6, gmEye: 6, juggernautTeam: 4, homeField: 5 }
  const base = run({}, 0.1)
  const nerfed = run(MAXED, 0.1)
  const old = run(MAXED, 1)
  st.tree = {}
  delete window.RIB_TUNE.teamQualK
  return { base, nerfed, old }
})
console.log('no tree      :', JSON.stringify(res.base))
console.log('maxed, v68   :', JSON.stringify(res.nerfed))
console.log('maxed, pre-v68:', JSON.stringify(res.old))

const gainNew = res.nerfed.us - res.base.us
const gainOld = res.old.us - res.base.us
const ratio = gainOld / Math.max(1e-6, gainNew)
console.log('points/game from a maxed tree:', gainNew.toFixed(2), 'vs', gainOld.toFixed(2), '(' + ratio.toFixed(1) + 'x weaker)')
ok(ratio >= 7 && ratio <= 14, 'a maxed team-quality tree is ~10x weaker than it was', ratio.toFixed(1) + 'x')
ok(gainNew > 0.15, 'the nodes still do something — this is a nerf, not a deletion', '+' + gainNew.toFixed(2) + ' pts/game')
ok(gainNew < 2.5, 'and a maxed tree no longer swings a game on its own', '+' + gainNew.toFixed(2) + ' pts/game')
// 15, not 12. v76 rewrote the quick generator to model the team-OVR pair directly, so
// this check's synthetic player (every attribute flat 55 at level 5, where the level
// base is 78) is now correctly rated as the below-average player he is: the no-tree
// baseline moved from a 71% win rate to about 28%. The tree's points buy far more win
// PERCENTAGE from 28% than from 71% — that is the shape of the sigmoid, not a stronger
// tree. The claim this check exists to defend is the one above it, and it is unmoved:
// a maxed tree is worth ~10x less than it was, and +1.4 points a game.
ok(res.nerfed.win - res.base.win < 15, 'win rate moves by an edge, not a landslide',
  '+' + (res.nerfed.win - res.base.win).toFixed(1) + 'pp (was +' + (res.old.win - res.base.win).toFixed(1) + 'pp)')

console.log('page errors:', errs.length ? '\n' + errs.join('\n') : 'NONE')
console.log('VERDICT: ' + (fail === 0 && errs.length === 0 ? 'PASS' : 'FAIL') + `  (${pass} ok, ${fail} failed)`)
await browser.close()
process.exitCode = fail === 0 && errs.length === 0 ? 0 : 1
