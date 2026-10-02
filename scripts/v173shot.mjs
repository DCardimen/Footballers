// v173 THE PILE IS THE BUTTON — look at a tap on the pile. Not a check: a camera.
//   node scripts/v173shot.mjs                 # 400x860 phone, into $OUT (default .) as _v173_*.png
//   OFF=1 node scripts/v173shot.mjs           # the same shots with RIB_TUNE.v173pile = 0 (v137's box)
//   PP=40000000 KEY=gmEye WIDE=1 node scripts/v173shot.mjs  (VW=375 VH=667 for any other viewport)
// The mid-tap frames are FROZEN: the vault's loop is stopped and the scene stepped by hand,
// so the coins in the air and the "+N PP" are where they are 144ms after the tap, every run.
import { CHROME, gameUrl } from './lib/env.mjs'
import { chromium } from 'playwright'
import path from 'node:path'

const OUT = process.env.OUT || '.'
const OFF = !!process.env.OFF
const WIDE = !!process.env.WIDE
const PP = Number(process.env.PP || 2500)
const KEY = process.env.KEY || 'gmEye'
const vp = process.env.VW ? { width: +process.env.VW, height: +(process.env.VH || 860) } : WIDE ? { width: 1280, height: 820 } : { width: 400, height: 860 }
const tag = (OFF ? 'off_' : '') + (WIDE ? 'wide_' : '') + (process.env.VW ? vp.width + 'x' + vp.height + '_' : '')
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `_v173_${tag}${name}.png`) })

const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.goto(gameUrl('?stayStale&noFilmV114'), { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(1800)
await page.evaluate(() => { try { window.__splashDoneV94 && window.__splashDoneV94() } catch (e) {} })
await page.waitForFunction(() => { const s = document.getElementById('splash'); if (!s) return true
  const c = getComputedStyle(s); return c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0 }, null, { timeout: 25000 }).catch(() => {})
await page.evaluate(() => { document.querySelectorAll('.onboard').forEach(e => e.remove())
  try { localStorage.setItem('rib.vaultDoor.v137', '1'); localStorage.setItem('rib.coachTour.v119', '0') } catch (e) {} })
await page.evaluate(({ OFF, PP }) => {
  if (OFF) window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v173pile: 0 })
  const o = window.__GRIDIRON_AUDIT__.getState(); o.pp = PP; o.prestige = 40
  window.__V156A && window.__V156A.seed(200); o.tree = {}; window.go('shop')
}, { OFF, PP })
await page.evaluate((key) => window.__RIB_VAULT_BRIDGE.open({ key, skipDoor: true }), KEY)
await page.waitForTimeout(1600)
await shot(page, '1_idle')

// a tap, frozen 144ms in: the coins it knocked loose are in the air, the "+N PP" is up
const frozen = await page.evaluate(() => {
  const D = window.__RIB_VAULT_DEV, V = D.v, s = D.scene()
  cancelAnimationFrame(V.raf); V.raf = 0
  const c = V.pileCentreV173 ? V.pileCentreV173() : { x: s.cw / 2, y: s.ch * 0.74 }
  let now = performance.now()
  V.press(c.x, c.y); V.release()
  for (let i = 0; i < 9; i++) { now += 16; V.tick(now, 16); s.frame(now, 16) }
  document.querySelectorAll('#ribVault .rv-pop').forEach(el => { clearTimeout(el._t); el.style.animationDelay = '-170ms'; el.style.animationPlayState = 'paused' })
  return { pending: V.pending, v173: D.v173 ? D.v173() : null }
})
await shot(page, '2_tap')
await page.evaluate(() => { const V = window.__RIB_VAULT_DEV.v; V.loop() })

// a run of taps, then let it settle: the hoard keeps its shape
const tp = await page.evaluate(() => { const V = window.__RIB_VAULT_DEV.v; return V.pileCentreV173 ? V.pileCentreV173() : null })
for (let i = 0; i < 6; i++) { await page.mouse.click(tp.x + (i % 3 - 1) * 40, tp.y - 10, { delay: 40 }); await page.waitForTimeout(260) }
await page.waitForTimeout(1600)
await shot(page, '3_settled')

// a hold, frozen once it has climbed to x4: the pour, the light under the finger, the badge on the core
await page.evaluate(() => window.__RIB_VAULT_DEV.restock())
await page.waitForTimeout(1500)
await page.mouse.move(tp.x, tp.y); await page.mouse.down()
await page.waitForTimeout(1150)
await page.evaluate(() => { const V = window.__RIB_VAULT_DEV.v; cancelAnimationFrame(V.raf); V.raf = 0
  document.querySelectorAll('#ribVault .rv-pop').forEach(el => { clearTimeout(el._t); el.style.animationPlayState = 'paused' }) })
await shot(page, '4_hold')
await page.mouse.up()
await page.evaluate(() => window.__RIB_VAULT_DEV.v.loop())
console.log(JSON.stringify({ off: OFF, pending: frozen.pending, v173: frozen.v173 && { kicked: frozen.v173.kicked, airborne: frozen.v173.airborne, pops: frozen.v173.pops },
  after: await page.evaluate(() => { const d = window.__RIB_VAULT_DEV; return { st: d.state().pending, v: d.v173 ? d.v173().taps : null } }) }))
console.log('page errors:', errs.length ? errs.slice(0, 5) : 'none')
await browser.close()
