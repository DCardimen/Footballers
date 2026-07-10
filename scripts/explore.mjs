import { chromium } from 'playwright'
const url = 'http://localhost:5173/'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(1500)

async function dump(tag) {
  const info = await page.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }
    const btns = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
      .map(el => (el.innerText||el.textContent||'').trim().replace(/\s+/g,' ').slice(0,40)).filter(Boolean)
    const screen = document.querySelector('#screen') || document.querySelector('.screen')
    const scrollH = document.documentElement.scrollHeight
    const clientH = document.documentElement.clientHeight
    return { btns: [...new Set(btns)].slice(0,25), scrollH, clientH, view: window.o?.view }
  })
  console.log(`\n### ${tag} | view=${info.view} scrollH=${info.scrollH} clientH=${info.clientH}`)
  console.log('buttons:', info.btns.join(' | '))
}
await dump('initial')
await browser.close()
if (errs.length) console.log('\nERRORS:', errs.join('\n'))
