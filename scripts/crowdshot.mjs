// Visual QA for the v57 crowd stands: drive into a live game and screenshot the
// REAL Phaser field canvas (not whatever canvas happens to be first in the DOM —
// the growth wheel is also a canvas) with the crowd idle, mid-roar, and removed,
// so the three can be compared side by side.
//   node scripts/crowdshot.mjs [tier]
import { chromium } from 'playwright'
import fs from 'fs'

const TIER = process.argv[2] || null
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 }, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.addInitScript(() => {
  setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60)
})
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(1000)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t === 'ARCH') el = els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
    else el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click() }
  }, { t, visSrc: vis })
  await page.waitForTimeout(850)
}
for (const s of ['START NEW CAREER', 'ARCH', 'QB Quarterback', 'Lock In Personality', 'PLAY 8-GAME SEASON',
  'Balanced Program', 'PLAY WEEK 1 LIVE', 'CONTINUE TO MATCH']) await click(s)

for (let i = 0; i < 40; i++) {
  const r = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.crowd && window.__gridironScene.crowd.built))
  if (r) break
  await page.waitForTimeout(400)
}
if (TIER) await page.evaluate((t) => { window.__CROWD_TIER = t }, TIER)
// CROWD_TUNE='{"crowdGap":34}' overrides dials live, so placement can be swept
// without re-baking the sheet
const TUNE = process.env.CROWD_TUNE ? JSON.parse(process.env.CROWD_TUNE) : null
await page.evaluate((tune) => {
  if (tune) { window.RIB_TUNE = window.RIB_TUNE || {}; for (const k in tune) window.RIB_TUNE[k] = tune[k] }
  window.__gridironScene.buildCrowd()
}, TUNE)

// Capture the GAME'S OWN framebuffer via Phaser's snapshot API. A DOM screenshot
// of the canvas region grabs whatever HTML overlay happens to sit on top of it
// (post-play cards, the growth decision list), which is not what we are checking.
// Pausing the scene freezes the players and the crowd animation but keeps the
// renderer running, so all three frames differ ONLY by the crowd.
await page.evaluate(() => { try { window.__gridironScene.scene.pause() } catch (e) {} })
const shot = async (name) => {
  const data = await page.evaluate(() => new Promise((res) => {
    const sc = window.__gridironScene
    sc.game.renderer.snapshot((img) => res(img.src || null))
    try { sc.sys.game.loop.step(performance.now()) } catch (e) {}
    setTimeout(() => res(null), 4000)
  }))
  if (!data) { console.log('SNAPSHOT FAILED for ' + name); return }
  fs.writeFileSync(`scripts/_crowd_${name}${process.env.CROWD_SUFFIX||''}.png`, Buffer.from(data.split(',')[1], 'base64'))
  console.log('wrote scripts/_crowd_' + name + (process.env.CROWD_SUFFIX||'') + '.png')
}
const setHeat = (h) => page.evaluate((h) => {
  const sc = window.__gridironScene, C = sc.crowd
  for (let i = 0; i < C.built; i++) {
    const s = C.secs[i]
    s.heat = h; s.pendAmt = 0
    s.spr.idle.setVisible(true); s.spr.cheer.setVisible(true).setAlpha(h).setPosition(s.bx, s.by)
  }
}, h)

await setHeat(0); await shot('idle')
await setHeat(1); await shot('cheer')
await page.evaluate(() => {
  const C = window.__gridironScene.crowd
  for (let i = 0; i < C.built; i++) { C.secs[i].spr.idle.setVisible(false); C.secs[i].spr.cheer.setVisible(false) }
})
await shot('none')
console.log('tier:', await page.evaluate(() => window.__gridironScene.crowd.tier))
console.log('page errors:', errs.length ? errs.join('\n') : 'none')
await browser.close()
