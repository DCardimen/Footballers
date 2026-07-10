import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 760 } }) // phone-ish
page.on('pageerror', e => console.log('PAGEERR', e.message))
await page.addInitScript(() => { setInterval(()=>{ try{if(window.o)window.o.tutorialSeen=true}catch{}; document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(1200)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  await page.evaluate(({t, visSrc}) => {
    const vis = eval(visSrc); const els=[...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t==='ARCH') el=els.find(e=>/^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText||'').trim()))
    else el=els.find(e=>((e.innerText||'').replace(/\s+/g,' ').includes(t)))
    el&&(el.scrollIntoView({block:'center'}),el.click())
  }, {t, visSrc:vis})
  await page.waitForTimeout(800)
}
for (const s of ["START NEW CAREER","ARCH","QB Quarterback"]) await click(s)
// We're on the season hub. Measure scroll + dock.
async function report(tag){
  const r = await page.evaluate(()=>{
    const de=document.documentElement
    window.scrollTo(0, de.scrollHeight)
    const dock=document.querySelector('.dock')
    const dr=dock?dock.getBoundingClientRect():null
    // bottom-most interactive element
    const els=[...document.querySelectorAll('button,[onclick]')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0})
    let low=null; els.forEach(e=>{const b=e.getBoundingClientRect(); if(!low||b.bottom>low.bottom) low={t:(e.innerText||'').slice(0,20),bottom:Math.round(b.bottom)}})
    return { scrollY:Math.round(window.scrollY), maxScroll:Math.round(de.scrollHeight-de.clientHeight), clientH:de.clientHeight,
      dockTop: dr?Math.round(dr.top):null, dockH: dr?Math.round(dr.height):null, lowest: low }
  })
  console.log(tag, JSON.stringify(r))
}
await report('HUB (scrolled to bottom)')
await page.screenshot({ path:'scripts/_scroll_hub.png' })
await browser.close()
