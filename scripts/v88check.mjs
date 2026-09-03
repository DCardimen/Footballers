// Dev check: v88 — the call-up follows the ranking.
//   The promotion curve (rankCurveV88) is asserted on its own: #1 in the country is
//   near-certain at every level, the last man inside the level's advancing share is
//   a coin flip, well outside it is single digits, and the curve never rises with a
//   worse rank. Then the integration: a combine player who led the country by a
//   wide margin reads ≥90% on the hub's declare button, the number on the button is
//   the number the roll uses, and a mid-pack player is not handed the call.
//   node scripts/v88check.mjs
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 1000 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1200)
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function step(t) { const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
  let el = t === 'POS' ? (els.find(e => /^WR\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : els.find(e => txt(e).includes(t)); if (el) { el.click(); return txt(el).slice(0, 30) } return null }, { t, visSrc: vis }); console.log('>>', t, '->', r); await page.waitForTimeout(800) }
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program']) await step(t)
await page.evaluate(() => { document.getElementById('growthV42')?.remove(); window.go('hub') })
await page.waitForTimeout(500)

// ---- 1. the curve
const cv = await page.evaluate(() => { const C = window.__V88.curve, out = {}
  out.col1 = C(1, 16000, 5); out.col1500 = C(1500, 16000, 5); out.col4000 = C(4000, 16000, 5); out.col100 = C(100, 16000, 5)
  out.cmb1 = C(1, 1500, 6); out.cmb100 = C(100, 1500, 6); out.cmb480 = C(480, 1500, 6); out.cmb1000 = C(1000, 1500, 6)
  out.nfl1 = C(1, 1700, 7); out.nfl8 = C(8, 1700, 7)
  out.mono = [5, 6, 7].every(lv => { let prev = 200, okk = true; for (let r = 1; r <= 1500; r += 7) { const v = C(r, 1500, lv); if (v > prev + 1e-9) okk = false; prev = v } return okk })
  return out })
console.log('curve:', JSON.stringify(cv))
ok(cv.col1 >= 96 && cv.cmb1 >= 96 && cv.nfl1 >= 95, '#1 in the country is near-certain at college, the combine and the league', `${cv.col1.toFixed(1)} / ${cv.cmb1.toFixed(1)} / ${cv.nfl1.toFixed(1)}`)
ok(cv.col100 >= 90 && cv.cmb100 >= 85, 'a top-100 finish is a strong call-up at college and the combine', `${cv.col100.toFixed(1)} / ${cv.cmb100.toFixed(1)}`)
ok(Math.abs(cv.col1500 - 50) < 6 && Math.abs(cv.cmb480 - 50) < 6, 'the last man inside the advancing share is a coin flip', `college #1500 ${cv.col1500.toFixed(1)} · combine #480 ${cv.cmb480.toFixed(1)}`)
ok(cv.col4000 < 8 && cv.cmb1000 < 8 && cv.nfl8 < 35, 'well outside the share it is single digits, and the interstellar call stays for the very top', `${cv.col4000.toFixed(1)} / ${cv.cmb1000.toFixed(1)} / nfl #8 ${cv.nfl8.toFixed(1)}`)
ok(cv.mono, 'the curve never rises with a worse rank')

// ---- 2. integration: a combine player who led the country
const it = await page.evaluate(() => {
  const pl = window.S.player, V = window.__V88, R = window.__RANK_V52
  const keep = JSON.stringify({ level: pl.level, sal: pl.seasonsAtLevel, lsl: pl.lastSeasonLine, ss: pl.seasonStats, attrs: pl.attrs, wr: pl.weekResults })
  pl.level = 6; pl.seasonsAtLevel = 1; pl.weekResults = null
  const cfg = R.Ne()[pl.pos], prim = cfg.primary, sd = cfg.stats.find(x => x.key === prim), per = sd.per[6], games = 4
  const line = {}; cfg.stats.forEach(st => { line[st.key] = st.rate ? st.per[6] * 1.6 : st.per[6] * games * 2.4 })   // double a strong season
  pl.lastSeasonLine = { level: 6, pos: pl.pos, statLine: line, avg: 90 }
  const rk = R.sn(pl, R.ovr(pl))
  const chance = V.declareChance(pl), rankChance = V.rankChance(pl)
  window.go('hub')
  const btn = [...document.querySelectorAll('button')].find(b => /Declare for/.test(b.textContent))
  const shown = btn ? parseInt((btn.textContent.match(/(\d+)%/) || [])[1], 10) : null
  const card = document.querySelector('.chance-info .small'); const cardTxt = card ? card.textContent : ''
  // a mid-pack combine player
  const line2 = {}; cfg.stats.forEach(st => { line2[st.key] = st.rate ? st.per[6] * .9 : st.per[6] * games * .55 })
  pl.lastSeasonLine = { level: 6, pos: pl.pos, statLine: line2, avg: 50 }
  const rk2 = R.sn(pl, R.ovr(pl)), chance2 = V.declareChance(pl)
  const k = JSON.parse(keep); pl.level = k.level; pl.seasonsAtLevel = k.sal; pl.lastSeasonLine = k.lsl; pl.seasonStats = k.ss; pl.weekResults = k.wr
  window.go('hub')
  return { rank: rk.rank, of: rk.of, prodRank: rk.prodRank, chance, rankChance, shown, cardTxt, rank2: rk2.rank, chance2 }
})
console.log('integration:', JSON.stringify(it))
ok(it.rank <= 40 && it.chance >= 90, 'a combine player who led the country by a wide margin reads a near-certain call-up', `rank #${it.rank} of ${it.of} · ${it.chance.toFixed(1)}%`)
ok(it.shown != null && Math.abs(it.shown - Math.round(it.chance)) <= 1, 'the number on the hub declare button is the number the roll uses', `${it.shown}% vs ${it.chance.toFixed(1)}%`)
ok(/national rank/.test(it.cardTxt) && /#/.test(it.cardTxt), 'the odds card says the ranking is what decides', it.cardTxt.slice(0, 90))
ok(it.rank2 > it.rank && it.chance2 < it.chance - 20 && it.chance2 < 70, 'a mid-pack combine player is not handed the call', `rank #${it.rank2} · ${it.chance2.toFixed(1)}%`)
console.log(JSON.stringify({ pass, fail }))
console.log(errs.length ? 'PAGE ERRORS:\n' + errs.slice(0, 8).join('\n') : 'page errors: none')
await browser.close()
if (fail || errs.length) process.exit(1)
