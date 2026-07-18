// Dev check: verify the YOU-player's tackle credits match sim truth.
// Boots the game as an LB, wraps FieldSim.run/pass to record who the sim
// actually named as tackler/assist, sims games, and compares the credited
// stat line against the sim's ground truth.
// Usage: npm run dev, then: node scripts/creditcheck.mjs
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.addInitScript(() => { setInterval(() => { try { const s=window.__getGridironState&&window.__getGridironState(); if (s) s.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1000)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  await page.evaluate(({t, visSrc}) => { const vis = eval(visSrc)
    const els=[...document.querySelectorAll('button,[onclick],a')].filter(vis); let el
    if (t==='ARCH') el = els.find(e=>/^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText||'').trim()))
    else el = els.find(e=>((e.innerText||e.textContent||'').replace(/\s+/g,' ').includes(t)))
    if(el)el.click() }, {t, visSrc:vis})
  await page.waitForTimeout(450)
}
for (const s of ["START NEW CAREER","ARCH","LB Linebacker","PLAY 8-GAME SEASON","Balanced Program"]) await click(s)
const res = await page.evaluate(() => {
  const FS = window.__FieldSim
  const rec = []
  const wrap = (name) => { const orig = FS[name].bind(FS)
    FS[name] = function(...a){ const r = orig(...a)
      if (r) rec.push({ kind: name, off: !!a[0],
        youTackler: !!(r.tackler && r.tackler.you), youAssist: !!(r.assist && r.assist.you),
        anyTackler: !!r.tackler }); return r } }
  wrap('run'); wrap('pass')
  const games = []
  for (let g = 0; g < 60; g++) {
    rec.length = 0
    const out = window.__simGameV2(55 + (g % 20), "LB")
    // sim ground truth: opponent-drive snaps where the sim named YOU tackler/assist
    const oppSnaps = rec.filter(p => !p.off)
    const truth = oppSnaps.filter(p => p.youTackler || p.youAssist).length
    const assists = oppSnaps.filter(p => !p.youTackler && p.youAssist).length
    games.push({ credited: out.stat.tackle, sacks: out.stat.sack, truth, assists, oppSnaps: oppSnaps.length })
  }
  const sum = k => games.reduce((a, g) => a + g[k], 0)
  // invariant: credited tackles never exceed sim-truth + sacks (sacks are resolved
  // outside FieldSim; gash-promoted plays can drop truth-credits, never add them)
  const violations = games.filter(g => g.credited > g.truth + g.sacks)
  return { games: games.length, avgCredited: sum('credited')/games.length,
    avgTruth: sum('truth')/games.length, avgAssists: sum('assists')/games.length,
    avgSacks: sum('sacks')/games.length, avgOppSnaps: sum('oppSnaps')/games.length,
    violations: violations.length, sample: games.slice(0, 6) }
})
console.log(JSON.stringify(res, null, 2))
console.log('page errors:', errs.length ? errs : 'none')
await browser.close()
process.exit(res.violations > 0 || errs.length ? 1 : 0)
