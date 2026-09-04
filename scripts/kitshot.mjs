import { chromium } from 'playwright'
// Renders the menu kit in a saturated palette (crimson jersey, gold helmet and pants) so the team tint is judged on more than the default slate: OUT=/tmp/kit.png node scripts/kitshot.mjs
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await (await b.newContext({ viewport: { width: 1080, height: 1500 }, deviceScaleFactor: 2 })).newPage()
await p.goto('http://127.0.0.1:5173/index.html?menuPreview=1', { waitUntil: 'domcontentloaded' })
await p.waitForSelector('#rib-main-menu-v2 .rib9-tint'); await p.waitForTimeout(1500)
await p.evaluate(() => { for (const t of document.querySelectorAll('.rib9-tint')) t.style.setProperty('--tp', /_p$/.test(t.dataset.mask) ? '#a3161c' : '#e9b93a') })
await p.waitForTimeout(300)
await p.screenshot({ path: process.env.OUT || 'pal.png', clip: { x: 0, y: 60, width: 1080, height: 1400 } })
await b.close()
