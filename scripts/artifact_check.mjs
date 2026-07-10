import { chromium } from 'playwright'
const f = process.argv[2]
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERR: ' + e.message))
await page.goto('file://' + f, { waitUntil: 'domcontentloaded', timeout: 20000 })
await page.waitForTimeout(2500)
await page.screenshot({ path: 'scripts/_artifact_check.png' })
const hasStart = await page.evaluate(()=>!!document.querySelector('button,[onclick]') && document.body.innerText.includes('START'))
console.log('JS errors:', errs.length? errs.slice(0,5).join(' | '):'NONE', '| START button present:', hasStart)
await browser.close()
