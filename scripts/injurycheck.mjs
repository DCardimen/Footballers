// Dev check: serious injuries force DNP weeks (no stats), heal after serving the time, and clear the worn flag. node scripts/injurycheck.mjs
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 500, height: 900 } })
page.on('pageerror', e => console.log('PAGEERROR:', e.message))
await page.addInitScript(() => { setInterval(() => { try { const s=window.__getGridironState&&window.__getGridironState(); if (s) s.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(1500)
async function click(t) {
  await page.evaluate((t) => {
    const els=[...document.querySelectorAll('button,[onclick],a')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0})
    let el
    if (t==='ARCH') el = els.find(e=>/^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText||'').trim()))
    else el = els.find(e=>((e.innerText||e.textContent||'').replace(/\s+/g,' ').toLowerCase().includes(t.toLowerCase())))
    if(el){el.scrollIntoView({block:'center'});el.click()}
  }, t); await page.waitForTimeout(600)
}
for (const s of ["START NEW CAREER","ARCH","RB Running Back","PLAY 8-GAME SEASON","Balanced Program","Lock In Personality"]) await click(s)
await page.waitForTimeout(700)
console.log(await page.evaluate(() => {
  const p=window.__getGridironState().player
  p.conditionV11={fatigue:80,injury:{name:"MCL sprain",severity:2,weeksRemaining:2,recurrence:.3}}
  window.playWeek(false)
  window.playWeek(false)
  const played=(p.weekResults||[]).filter(w=>w.played)
  return {mustSit:window.__mustSitV18(p), played:played.length, satOut:played.map(w=>({so:!!w.satOut,grade:w.gameGrade,stat:!!w.statLine,perf:w.perf,inj:w.injName})), inj:p.conditionV11.injury, fat:p.conditionV11.fatigue, worn:window.__isWornV18(p)}
}))
await browser.close()
