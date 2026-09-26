// v137 — look at the Prestige Vault. Not a check: a camera.
//   node scripts/vaultshot.mjs            # the default sweep, into _vault_*.png
//   PP=25000000 KEY=playbook node scripts/vaultshot.mjs
//   WIDE=1 node scripts/vaultshot.mjs     # desktop framing
import { chromium } from 'playwright'
import fs from 'node:fs'
import { CHROME, gameUrl } from './lib/env.mjs'

const WIDE = !!process.env.WIDE
const vp = WIDE ? { width: 1280, height: 820 } : { width: 412, height: 915 }
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.goto(gameUrl('?stayStale&noFilmV114'), { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(2200)
// past the splash
await page.evaluate(() => { try { window.__splashDoneV94 && window.__splashDoneV94() } catch (e) {} })
await page.waitForFunction(() => { const s = document.getElementById('splash')
  if (!s) return true; const c = getComputedStyle(s)
  return c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0 }, null, { timeout: 25000 }).catch(() => {})
await page.waitForTimeout(800)
// the first-visit welcome cards sit at z-index 10000 — click through them
for (let i = 0; i < 4; i++) {
  const hit = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.onboard button, .onboard [onclick]')]
      .find(e => e.getBoundingClientRect().height > 0)
    if (b) { b.click(); return true } return false
  })
  if (!hit) break
  await page.waitForTimeout(280)
}
await page.evaluate(() => { document.querySelectorAll('.onboard').forEach(e => e.remove())
  try { localStorage.setItem('rib.coachTour.v119', '0') } catch (e) {} })
await page.waitForTimeout(200)

const shots = process.env.PP
  ? [[Number(process.env.PP), process.env.KEY || '', process.env.NAME || 'custom']]
  : [[0, '', 'empty'], [7, '', 'almost'], [420, '', 'modest'], [7500, '', 'growing'],
     [90000, '', 'large'], [2400000, '', 'massive'], [40000000, '', 'nearfull'],
     [1250000000, '', 'overflow']]

const pre = WIDE ? '_vault_wide_' : '_vault_'
for (const [pp, key, name] of shots) {
  await page.evaluate(({ pp }) => {
    const A = window.__GRIDIRON_AUDIT__, o = A.getState()
    o.pp = pp; o.prestige = Math.max(o.prestige || 0, 30); window.__V156A && window.__V156A.seed(140) /* v156 A: the medals open the tree */; o.view = 'shop'
    window.render && window.render()
  }, { pp })
  await page.evaluate(() => { try { localStorage.setItem('rib.vaultDoor.v137', '1') } catch (e) {} })
  await page.evaluate(({ key }) => window.__RIB_VAULT_BRIDGE.open(key ? { key } : { skipDoor: true }), { key })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${pre}${name}.png` })
  const st = await page.evaluate(() => window.__RIB_VAULT_DEV.state())
  console.log(name.padEnd(10), 'pp', String(pp).padStart(11), 'coins', String(st.n).padStart(5),
    '/', st.slots, 'missing', JSON.stringify(st.missing))
  await page.evaluate(() => window.__RIB_VAULT.close('shot'))
  await page.waitForTimeout(250)
}
console.log('page errors:', errs.length ? errs.slice(0, 8) : 'none')
await browser.close()
