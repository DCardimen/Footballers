// Dev check: the national rank and the leaders board must describe the SAME
// world. Three things had drifted apart (v52):
//   1. POPULATION — A[].slots on the level table, a hardcoded array inside sn(),
//      and Ii for the leaders board were three different numbers for one thing.
//      Middle School read 420k on the rank card against the table's 600k.
//   2. AGREEMENT — sn() ranked on the overall rating alone, which mid-season sits
//      near A[level].need-8 (OVR only reaches `need` at the END of a level), so it
//      parked everyone near the 50th percentile. A player the leaders board had at
//      #18 in the country was told #200k of 420k on the same screen.
//   3. MONOTONICITY — producing more must never rank you worse.
// node scripts/rankcheck.mjs   (needs `npm run dev` on :5173)
import { chromium } from 'playwright'

const SLOTS = [18e5, 11e5, 6e5, 28e4, 11e4, 16e3, 1500, 1700, 96]   // A[].slots, the level table
const fails = []
const ok = (cond, label, detail) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${detail ? '  ' + detail : ''}`)
  if (!cond) fails.push(label)
}

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1200)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t === 'ARCH') el = els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
    else el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click() }
  }, { t, visSrc: vis })
  await page.waitForTimeout(650)
}
const clearWheel = async () => { for (let i = 0; i < 50; i++) { const d = await page.evaluate(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') { g.click(); return true } if (window.continuePregameV1513 && document.getElementById('pregameV1513')) { window.continuePregameV1513(); return false } return !document.getElementById('growthV42') }); if (d) break; await page.waitForTimeout(300) } }

for (const s of ['START NEW CAREER', 'ARCH', 'QB Quarterback', 'Lock In Personality', 'PLAY 8-GAME SEASON']) await click(s)
await clearWheel()

const has = await page.evaluate(() => !!window.__RANK_V52)
ok(has, 'the rank model is reachable for testing')
if (!has) { console.log('page errors:', errs.join('\n') || 'NONE'); await b.close(); process.exit(1) }

// ---- 1. ONE population, straight off the level table ------------------------
const pools = await page.evaluate(() => {
  const R = window.__RANK_V52
  return [0,1,2,3,4,5,6,7,8].map(l => ({ l, nat: R.natPool(l), pos: R.posPool(l) }))
})
console.log('pools:', JSON.stringify(pools))
const poolBad = pools.filter(p => p.nat !== SLOTS[p.l])
ok(poolBad.length === 0, 'every level ranks against the population on the level table',
  poolBad.length ? JSON.stringify(poolBad) : `${pools.length} levels`)
const splitBad = pools.filter(p => Math.abs(p.pos * 9 - p.nat) > 9)
ok(splitBad.length === 0, 'the positional pool is exactly the national pool split 9 ways',
  splitBad.length ? JSON.stringify(splitBad) : 'all levels')

// ---- 2 & 3. the two boards agree, and more production never ranks you worse --
const sweep = await page.evaluate(() => {
  const st = window.__GRIDIRON_AUDIT__?.getState?.() || window.o
  const p = st.player, R = window.__RANK_V52
  const keep = { level: p.level, wr: JSON.parse(JSON.stringify(p.weekResults || [])) }
  const out = []
  for (const level of [0, 2, 4, 5]) {
    p.level = level
    const cfg = R.Ne()[p.pos], prim = cfg.primary, sd = cfg.stats.find(x => x.key === prim)
    const rows = []
    for (const perf of [45, 60, 72, 85, 95]) {
      p.weekResults = [1, 2, 3, 4].map(() => ({ played: true, playoff: false, perf, won: true, us: 24, them: 14 }))
      const ln = R.line(p)
      rows.push({ perf, leaders: R.kr(level, sd, ln.line[prim]), ...(r => ({ cardPos: r.posRank, nat: r.rank, of: r.of, posOf: r.posSize }))(R.sn(p, R.ovr(p))) })
    }
    out.push({ level, rows })
  }
  // a level with NO stat line must still produce a sane rank from the rating alone
  p.level = 3; p.weekResults = []
  const bare = R.sn(p, R.ovr(p))
  p.level = keep.level; p.weekResults = keep.wr
  return { out, bare: { posRank: bare.posRank, rank: bare.rank, of: bare.of, prodRank: bare.prodRank } }
})
for (const { level, rows } of sweep.out) {
  console.log(`L${level}:`, rows.map(r => `perf${r.perf} board#${r.leaders} card#${r.cardPos}`).join('  '))
  // agreement: the card's positional rank must track the board's, not sit orders of magnitude away
  const worst = Math.max(...rows.map(r => {
    const a = Math.max(1, r.leaders), c = Math.max(1, r.cardPos)
    return Math.max(a / c, c / a)
  }))
  ok(worst <= 4, `L${level}: the rank card tracks the leaders board`, `worst factor ${worst.toFixed(2)}x`)
  // monotone: producing more can never rank you worse
  const mono = rows.every((r, i) => i === 0 || r.cardPos <= rows[i - 1].cardPos)
  ok(mono, `L${level}: producing more never ranks you worse`, rows.map(r => r.cardPos).join(' >= '))
  // and the national rank must stay inside its own population
  ok(rows.every(r => r.nat >= 1 && r.nat <= r.of), `L${level}: the national rank stays inside the population`)
}
console.log('no stat line yet:', JSON.stringify(sweep.bare))
ok(sweep.bare.prodRank == null, 'with nothing produced yet, the rating carries the rank alone')
ok(sweep.bare.posRank >= 1 && sweep.bare.rank <= sweep.bare.of, 'the ratings-only fallback still ranks sanely')

// ---- 4. the screen the player actually reads --------------------------------
await click('Balanced Program')
for (let w = 0; w < 3; w++) { await click('QUICK PLAY WEEK'); await clearWheel(); await page.waitForTimeout(300) }
await click('LEADERS')
await page.waitForTimeout(900)
const screen = await page.evaluate(() => {
  const t = document.getElementById('screen')?.innerText || ''
  const board = t.match(/You rank\s+#?([\d.kM]+)\s+of\s+([\d.kM]+)\s+(\w+)s nationally/i)
  return { board: board ? board[0] : null, hasThresholds: /rank/i.test(t) }
})
console.log('leaders screen:', JSON.stringify(screen))
ok(!!screen.board, 'the leaders screen still states a rank and a population', screen.board || '')
await page.screenshot({ path: 'scripts/_rank.png', fullPage: true })

console.log('page errors:', errs.length ? '\n' + errs.slice(0, 10).join('\n') : 'NONE')
console.log('VERDICT:', fails.length || errs.length ? 'FAIL ' + JSON.stringify(fails) : 'PASS')
if (fails.length || errs.length) process.exitCode = 1
await b.close()
