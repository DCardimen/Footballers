// Dev check: boot the game headless and batch-run the emergent game engine (window.__simGameV2),
// printing score/pace/event distributions. Usage: npm run dev, then: node scripts/simcheck.mjs
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(1000)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  const ok = await page.evaluate(({t, visSrc}) => {
    const vis = eval(visSrc)
    const els=[...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t==='ARCH') el = els.find(e=>/^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText||'').trim()))
    else el = els.find(e=>((e.innerText||e.textContent||'').replace(/\s+/g,' ').includes(t)))
    if(el){el.click(); return true} return false
  }, {t, visSrc:vis})
  await page.waitForTimeout(500)
  return ok
}
for (const s of ["START NEW CAREER","ARCH","QB Quarterback","PLAY 8-GAME SEASON","Balanced Program"]) await click(s)
const res = await page.evaluate(() => {
  const out = { games: [], errors: [] }
  for (let g = 0; g < 60; g++) {
    try {
      const r = window.__simGameV2(45 + Math.random() * 45, ["QB","RB","WR","DL","CB"][g % 5])
      const plays = r.plays
      const hdrs = plays.filter(x => x.header).length
      const scrim = plays.length - hdrs
      const evs = {}
      let badField = 0, lastQ = 0, qOrderOK = true
      for (const pl of plays) {
        evs[pl.event] = (evs[pl.event] || 0) + 1
        if (pl.quarter < lastQ) qOrderOK = false
        lastQ = pl.quarter
        for (const k of ["yards","startBall","endBall","usScore","themScore","down","toGo"])
          if (!Number.isFinite(pl[k])) badField++
        if (typeof pl.clock !== "string" || !/^\d+:\d\d$/.test(pl.clock)) badField++
      }
      const last = plays[plays.length - 1]
      out.games.push({ us: r.usScore, them: r.themScore, plays: plays.length, scrim, hdrs, evs,
        badField, qOrderOK, lastQ, tie: r.usScore === r.themScore,
        scoreMatch: last.usScore === r.usScore && last.themScore === r.themScore,
        top: r.team.top, third: r.team.third, sacks: r.team.sacks, yds: r.team.yds, oppYds: r.oppTeam.yds,
        pass: r.team.pass, rush: r.team.rush, turn: r.team.turn, first: r.team.first })
    } catch (e) { out.errors.push(String(e && e.stack || e)) }
  }
  return out
})
if (res.errors.length) { console.log('ENGINE ERRORS:\n' + res.errors.slice(0,3).join('\n---\n')) }
const G = res.games
const avg = (f) => (G.reduce((n, g) => n + f(g), 0) / G.length).toFixed(1)
const cnt = (f) => G.filter(f).length
console.log(`games=${G.length} ties=${cnt(g=>g.tie)} badFields=${cnt(g=>g.badField>0)} qOrderBad=${cnt(g=>!g.qOrderOK)} scoreMismatch=${cnt(g=>!g.scoreMatch)}`)
console.log(`avg score ${avg(g=>g.us)}–${avg(g=>g.them)} | min/max total pts ${Math.min(...G.map(g=>g.us+g.them))}/${Math.max(...G.map(g=>g.us+g.them))}`)
console.log(`avg plays=${avg(g=>g.plays)} (scrimmage=${avg(g=>g.scrim)}, drives=${avg(g=>g.hdrs)}) | OT games=${cnt(g=>g.lastQ>4)}`)
console.log(`avg team: yds=${avg(g=>g.yds)} pass=${avg(g=>g.pass)} rush=${avg(g=>g.rush)} first=${avg(g=>g.first)} sacksByD=${avg(g=>g.sacks)} turn=${avg(g=>g.turn)}`)
const ev = {}
G.forEach(g => Object.entries(g.evs).forEach(([k, v]) => ev[k] = (ev[k] || 0) + v))
console.log('events/game:', Object.fromEntries(Object.entries(ev).map(([k, v]) => [k, +(v / G.length).toFixed(1)])))
console.log('sample TOP:', G.slice(0,5).map(g=>g.top).join(' '), '| sample 3rd:', G.slice(0,5).map(g=>g.third).join(' '))
console.log('sample scores:', G.slice(0, 12).map(g => `${g.us}-${g.them}`).join('  '))
if (errs.length) console.log('PAGE ERRORS:\n' + errs.slice(0, 5).join('\n'))
await browser.close()
