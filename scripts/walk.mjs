import { chromium } from 'playwright'
const steps = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(1200)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function dump(tag) {
  const info = await page.evaluate((visSrc) => {
    const vis = eval(visSrc)
    const btns = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
      .map(el => (el.innerText||el.textContent||'').trim().replace(/\s+/g,' ').slice(0,32)).filter(Boolean)
    return { btns:[...new Set(btns)].slice(0,30), scrollH:document.documentElement.scrollHeight, clientH:document.documentElement.clientHeight, view: window.o?.view }
  }, vis)
  console.log(`### ${tag} | view=${info.view} scrollH=${info.scrollH} overflow=${info.scrollH-info.clientH}`)
  console.log('  ', info.btns.join(' | '))
}
async function click(text) {
  const ok = await page.evaluate(({t, visSrc}) => {
    const vis = eval(visSrc)
    const els=[...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t==='ARCH') el = els.find(e=>/^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText||'').trim()))
    else el = els.find(e=>((e.innerText||e.textContent||'').replace(/\s+/g,' ').includes(t)))
    if(el){el.scrollIntoView({block:'center'}); el.click(); return (el.innerText||'').replace(/\s+/g,' ').slice(0,30)} return null
  }, {t:text, visSrc:vis})
  console.log(`>>> "${text}" -> ${ok?('clicked: '+ok):'NOT FOUND'}`)
  await page.waitForTimeout(1000)
  await dump('after '+text)
}
await dump('start')
for (const s of steps) await click(s)
await page.screenshot({ path: 'scripts/_walk.png' })
if (errs.length) console.log('ERRORS:\n'+errs.join('\n'))
await browser.close()
