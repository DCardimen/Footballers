import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 }, deviceScaleFactor: 2 })
await page.addInitScript(() => { setInterval(()=>{ try{if(window.o)window.o.tutorialSeen=true}catch{}; document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(1000)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  await page.evaluate(({t, visSrc}) => {
    const vis = eval(visSrc); const els=[...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t==='ARCH') el=els.find(e=>/^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText||'').trim()))
    else if (t==='PLAN') el=els.find(e=>/Execution|Spotlight|Highlight|Dirty|Recovery/i.test(e.className+' '+e.innerText))
    else el=els.find(e=>((e.innerText||'').replace(/\s+/g,' ').includes(t)))
    el&&(el.scrollIntoView({block:'center'}),el.click())
  }, {t, visSrc:vis})
  await page.waitForTimeout(850)
}
for (const s of ["START NEW CAREER","ARCH","QB Quarterback","PLAY 8-GAME SEASON","Balanced Program","PLAY WEEK 1 LIVE","PLAN"]) await click(s)
for (let i=0;i<12;i++){ await page.waitForTimeout(500); const c=await page.$('canvas'); if(c){ await c.screenshot({ path:`scripts/_field_${i}.png` }) } }
await browser.close()
