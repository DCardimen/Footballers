// Dev helper: boot the game in a headless browser and screenshot it.
// Usage: node scripts/shot.mjs [outfile.png] [url]
import { chromium } from 'playwright'

const out = process.argv[2] || 'shot.png'
const url = process.argv[3] || 'http://localhost:5173/'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(2500)
await page.screenshot({ path: out })
console.log('saved', out, '| console errors:', errs.length ? '\n' + errs.slice(0, 10).join('\n') : 'NONE')
await browser.close()
