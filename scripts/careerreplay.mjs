// Offline replay of the v179 declare rolls over measured careers — calibrate the scouts' bars in seconds, not hours.
//
// A careersim run in curve mode (`--until combine`, the bars off) logs, career by career, the account's POTENTIAL and the
// SEASON odds at each declare ("5:98@95/174/98" = level 5, odds 98, OVR 95, potential 174, season-only odds 98). The
// account's growth does not depend on the rolls before the first UFF (every career ends either way), so the first-UFF
// time can be replayed offline: career k succeeds when the season roll AND the scouts' verdict pass at College and at the
// Combine, with the verdict computed here from the same formula as `scoutBarV179` (src/07-career-app.js, v179 K).
//
//   node scripts/careerreplay.mjs <careersim.log> [<more logs>…] [--tune '{"scoutPotUffV179":150}'] [--n 20000] [--seasonMin 7]
//
// Prints, per log: mean / median / p10 / p90 seasons (and hours) to the first UFF.
import fs from 'node:fs'

const argv = process.argv.slice(2)
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d }
const files = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')))
const TUNE = JSON.parse(opt('tune', '{}')), N = +opt('n', 20000), SEASON_MIN = +opt('seasonMin', 7)
const TU = (k, d) => (k in TUNE ? TUNE[k] : d)

// the verdict (mirrors scoutBarV179 with v179K on); `adv` = the declare-odds prestige (treeFx advFlat), default 0
function verdict(lv, pot, tries, adv = TU('adv', 0)) {
  const potBase = lv === 5 ? TU('scoutPotCombineV179', 90) : lv === 6 ? TU('scoutPotUffV179', 150) : 0
  if (!potBase) return 1
  const potBar = Math.max(1, potBase - tries * TU('scoutBarDecayV179', 0.5) * TU('scoutPotDecayMultV179', 0.5) * (potBase / 150))
  const soft = Math.max(0.5, potBar * TU('scoutPotSoftPctV179', 0.04))
  const vMax = Math.min(TU('verdictCapV179', 96), TU('verdictBaseV179', 80) + adv * TU('verdictPerOddsV179', 1)) / 100
  const v = pot <= potBar ? 1 / (1 + Math.exp(-(pot - potBar) / soft)) : 0.5 + (vMax - 0.5) * (1 - Math.exp(-(pot - potBar) / (potBar * TU('verdictTauV179', 0.35))))
  const sl = pot >= potBar * TU('secondLookFloorV179', 0.8) ? Math.min(TU('secondLookCapV179', 50), TU('secondLookBaseV179', 10) + adv * TU('secondLookPerOddsV179', 1.5)) / 100 : 0
  return v + (1 - v) * sl
}

function parse(file) {
  const careers = []
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^run \d+ career \d+: .*? · (\d+) seasons/)
    if (!m) continue
    const c = { seasons: +m[1], d: {} }
    // "5:ch@ovr/pot/season" (the season-only odds; older logs have no /season — then the logged odds stand in)
    for (const x of line.matchAll(/(\d):(\d+)@(\d+)\/(\d+)(?:\/(\d+))?/g)) c.d[+x[1]] = { ovr: +x[3], pot: +x[4], season: x[5] != null ? +x[5] : +x[2] }
    careers.push(c)
  }
  // a career that failed College on the dice has no Combine odds: borrow the nearest career's (by potential)
  const withSix = careers.filter((c) => c.d[6])
  for (const c of careers) if (c.d[5] && !c.d[6] && withSix.length) {
    const near = withSix.reduce((a, b) => (Math.abs(b.d[6].pot - c.d[5].pot) < Math.abs(a.d[6].pot - c.d[5].pot) ? b : a))
    c.d[6] = { ...near.d[6], pot: c.d[5].pot, imputed: true }
  }
  return careers
}

function replay(careers) {
  const out = []
  for (let r = 0; r < N; r++) {
    let t5 = 0, t6 = 0, seasons = 0, done = null
    for (const c of careers) {
      seasons += c.seasons
      if (!c.d[5]) continue // the career ended before College
      const p5 = (c.d[5].season / 100) * verdict(5, c.d[5].pot, t5++)
      if (Math.random() >= p5) continue
      if (!c.d[6]) continue
      const p6 = (c.d[6].season / 100) * verdict(6, c.d[6].pot, t6++)
      if (Math.random() < p6) { done = seasons; break }
    }
    out.push(done == null ? Infinity : done)
  }
  out.sort((a, b) => a - b)
  const fin = out.filter(Number.isFinite), q = (p) => out[Math.min(out.length - 1, Math.floor(p * out.length))]
  return { mean: fin.length ? fin.reduce((a, b) => a + b, 0) / fin.length : Infinity, median: q(0.5), p10: q(0.1), p90: q(0.9), reached: fin.length / out.length }
}

const h = (s) => (Number.isFinite(s) ? (s * SEASON_MIN / 60).toFixed(1) + ' h' : 'never')
for (const f of files) {
  const C = parse(f), R = replay(C), total = C.reduce((a, c) => a + c.seasons, 0)
  console.log(`${f.split('/').pop()}: ${C.length} careers / ${total} seasons logged · first UFF mean ${Math.round(R.mean)} seasons (${h(R.mean)}) · median ${R.median} (${h(R.median)}) · p10 ${R.p10} · p90 ${R.p90} · reached within the log ${(R.reached * 100).toFixed(0)}%`)
}
