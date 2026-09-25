// v153 C — a camera, not a check: photographs the payday (the vault's reward sequence) at
// several moments so the feel can be judged by eye. Writes $SHOTS/v153C_<gain>_<ms>.png.
//
//   npm run dev, then: node scripts/v153Cshot.mjs            (GAINS=1284,250000 to choose)
//   REDUCED=1 for the reduced-motion path, WIDE=1 for desktop, RECORD=1 for the record storm.
import fs from 'node:fs'
import { gameUrl, launch } from './lib/env.mjs'

const SHOTS = process.env.SHOTS || '/tmp/claude-0/shots'
try { fs.mkdirSync(SHOTS, { recursive: true }) } catch {}
const GAINS = (process.env.GAINS || '12,1284,250000').split(',').map(Number)
const BASE = +(process.env.BASE || 4200)
const AT = (process.env.AT || '300,900,1500,2100,2600,3200,3900,4800').split(',').map(Number)
const browser = await launch()
const ctx = await browser.newContext({ viewport: process.env.WIDE ? { width: 1280, height: 800 } : { width: 412, height: 915 },
  deviceScaleFactor: process.env.WIDE ? 1 : 2, reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference' })
await ctx.addInitScript(() => { try { localStorage.setItem('rib.vaultDoor.v137', '1'); localStorage.setItem('rib.coachTour.v119', '0') } catch (e) {}
  setInterval(() => { try { document.querySelectorAll('.onboard').forEach(e => e.remove()) } catch (e) {} }, 80) })
const page = await ctx.newPage()
page.on('pageerror', e => console.log('PAGEERROR', e.message))
await page.goto(gameUrl('?stayStale&noFilmV114'), { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__RIB_VAULT_BRIDGE && !!window.__GRIDIRON_AUDIT__, null, { timeout: 40000 })
await page.evaluate(() => { try { window.__splashDoneV94 && window.__splashDoneV94() } catch (e) {} const sp = document.getElementById('splash'); if (sp) sp.remove() })
await page.waitForTimeout(800)
for (const gain of GAINS) {
  await page.evaluate(({ gain, base }) => { const o = window.__GRIDIRON_AUDIT__.getState(); o.pp = base + gain; window.go('shop') }, { gain, base: BASE })
  await page.evaluate(({ gain, base, rec }) => window.__RIB_VAULT_BRIDGE.open({ skipDoor: true, payday: { from: base, to: base + gain, gain, record: rec } }), { gain, base: BASE, rec: !!process.env.RECORD })
  const t0 = Date.now()
  for (const ms of AT) {
    const wait = ms - (Date.now() - t0); if (wait > 0) await page.waitForTimeout(wait)
    const st = await page.evaluate(() => window.__RIB_VAULT_DEV.payday())
    await page.screenshot({ path: `${SHOTS}/v153C_${gain}_${ms}.png` })
    console.log(gain, ms, JSON.stringify({ shown: st.shown, spawned: st.spawned, landed: st.landed, live: st.live, locked: st.locked, done: st.done, parts: st.parts }))
  }
  await page.evaluate(() => window.__RIB_VAULT.close('shot'))
  await page.waitForTimeout(300)
}
await browser.close()
