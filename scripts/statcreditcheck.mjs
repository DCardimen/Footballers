// Dev check: the box score may only credit plays the user's roster actor actually made (or was in the pile for). node scripts/statcreditcheck.mjs
// v18 check: stat credit must match the involved flag and play events
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(1200)
async function click(t) {
  await page.evaluate((t) => {
    const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0 }
    const els=[...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t==='ARCH') el = els.find(e=>/^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText||'').trim()))
    else el = els.find(e=>((e.innerText||e.textContent||'').replace(/\s+/g,' ').includes(t)))
    if(el) el.click()
  }, t)
  await page.waitForTimeout(500)
}
for (const s of ["START NEW CAREER","ARCH","WR Wide Receiver","PLAY 8-GAME SEASON","Balanced Program"]) await click(s)
const res = await page.evaluate(() => {
  const out = { pos: {}, problems: [] }
  for (const pos of ["WR","RB","CB","LB","QB"]) {
    let inv = 0, plays = 0, recMismatch = 0, games = 0
    for (let g = 0; g < 12; g++) {
      const r = window.__simGameV2(50 + Math.random() * 40, pos)
      games++
      const scrim = r.plays.filter(p => !p.header && p.event !== "drive")
      plays += scrim.length
      inv += scrim.filter(p => p.involved).length
      // "YOU"-flavored commentary must always carry involved:true
      for (const p of scrim) {
        if (/\bYOU\b|You jump|You haul|You beat|You hit the hole|You read|you blanket|your fingertips|You escape/.test(p.desc||"") && !p.involved)
          out.problems.push(pos+": YOU-desc but involved=false: "+p.desc)
      }
      const st = r.stat || (r.plays[r.plays.length-1]||{}).stat
    }
    out.pos[pos] = { games, plays, involvedPct: Math.round(inv/plays*100) }
  }
  return out
})
console.log(JSON.stringify(res, null, 1).slice(0, 2500))
console.log(errs.length ? errs.join('\n') : 'no page errors')
await browser.close()
