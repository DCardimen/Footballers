import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
// persistent onboard killer, installed before any app code runs
await page.addInitScript(() => {
  setInterval(() => {
    try { if (window.o) window.o.tutorialSeen = true } catch {}
    document.querySelector('.onboard')?.remove()
  }, 60)
})
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(1200)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  const ok = await page.evaluate(({t, visSrc}) => {
    const vis = eval(visSrc)
    const els=[...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t==='ARCH') el = els.find(e=>/^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText||'').trim()))
    else if (t==='PLAN') el = els.find(e=>/plan|Execution|Spotlight|Highlight|Dirty|Recovery/i.test(e.className+' '+e.innerText))
    else el = els.find(e=>((e.innerText||e.textContent||'').replace(/\s+/g,' ').includes(t)))
    if(el){el.scrollIntoView({block:'center'}); el.click(); return (el.innerText||'').replace(/\s+/g,' ').slice(0,28)} return null
  }, {t, visSrc:vis})
  console.log(`>> ${t} -> ${ok||'MISS'}`)
  await page.waitForTimeout(900)
}
for (const s of ["START NEW CAREER","ARCH","QB Quarterback","PLAY 8-GAME SEASON","Balanced Program","PLAY WEEK 1 LIVE","PLAN","CONTINUE TO MATCH"]) await click(s)
// wait for live canvas
let live=false
for (let i=0;i<20;i++){ const c=await page.evaluate(()=>document.querySelectorAll('canvas').length); if(c){live=true;break} await page.waitForTimeout(300) }
console.log('view=', await page.evaluate(()=>window.o?.view), 'liveCanvas=', live)
const geo = await page.evaluate(() => {
  const cs=[...document.querySelectorAll('canvas')].map(c=>{const r=c.getBoundingClientRect();return{w:c.width,h:c.height,cssW:Math.round(r.width),cssH:Math.round(r.height),left:Math.round(r.left),top:Math.round(r.top)}})
  return { canvases: cs, scrollH:document.documentElement.scrollHeight, clientH:document.documentElement.clientHeight }
})
console.log('geo:', JSON.stringify(geo))
for (let i=0;i<12;i++){ await page.screenshot({ path:`scripts/_live_${i}.png` }); await page.waitForTimeout(550) }
if (errs.length) console.log('ERRORS:\n'+errs.join('\n'))
await browser.close()
