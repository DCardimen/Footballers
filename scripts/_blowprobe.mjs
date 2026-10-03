import { gameUrl, launch } from './lib/env.mjs'
const b = await launch(); const p = await b.newPage()
await p.goto(gameUrl('index.html?stayStale&noFilmV114'), { waitUntil: 'networkidle' })
await p.waitForFunction(() => !!window.__simGameV2 && !!window.__GRIDIRON_AUDIT__, null, { timeout: 40000 }); await p.waitForTimeout(1500)
const N = +(process.env.N || 60)
const out = await p.evaluate(async ({ N, cfgs, TUNE }) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S); S.player = A.newPlayer()
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, JSON.parse(TUNE || '{}')); const pl = S.player, BASE = [18, 30, 42, 54, 66, 78, 86, 90, 95], res = []
  for (const c of cfgs) {
    S.prestige = c.pr || 0; S.tree = {}; pl.level = c.lv; pl.pos = c.pos; A.startSeasonGames && A.startSeasonGames()
    for (const k in pl.attrs) pl.attrs[k] = Math.round(BASE[c.lv] + c.boost)
    window.__oppMulV22 = c.om
    const rows = []
    for (let i = 0; i < N; i++) { const g = window.__simGameV2([30, 55, 80][i % 3], pl.pos); rows.push([g.roster.us.ovr - g.roster.opp.ovr, g.usScore - g.themScore]) }
    const gap = rows.reduce((a, r) => a + r[0], 0) / N, m = rows.map(r => r[1]).sort((x, y) => x - y)
    res.push({ ...c, gap: +gap.toFixed(1), mean: +(m.reduce((a, x) => a + x, 0) / N).toFixed(1), win: Math.round(100 * m.filter(x => x > 0).length / N), b28: Math.round(100 * m.filter(x => x >= 28).length / N), p50: m[N >> 1], p90: m[Math.floor(N * 0.9)], sd: +Math.sqrt(m.reduce((a, x) => a + x * x, 0) / N - Math.pow(m.reduce((a, x) => a + x, 0) / N, 2)).toFixed(1), want: +(0.7 * gap).toFixed(1) })
  }
  delete window.__oppMulV22
  return res
}, { N, cfgs: JSON.parse(process.env.CFG), TUNE: process.env.TUNE || '{}' })
for (const r of out) console.log(JSON.stringify(r))
await b.close()
