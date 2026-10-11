// Dev check: v196 D A FULL STORAGE NEVER EATS A SAVE (src/06-phaser-launcher.js, src/07-career-app.js).
// The owner: "Progress didn't save last time for some reason... I should have 120ish medals?"
//   1. storage filled to the brim with the rolling backups in it: a save still lands (the main key holds the new state),
//      the oldest backups are what made room (__V196D.freed > 0)
//   2. storage so full that nothing can be freed: the save fails LOUDLY — a toast says progress was NOT saved
//   3. TU v196D 0: the old path (the quota error, silent); no page errors
// GAME_URL=http://localhost:5173/ node scripts/v196Dcheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } })
await ctx.addInitScript(() => { try { localStorage.setItem('rib.coachTour.v119', 'off') } catch {} setInterval(() => { document.querySelector('.onboard')?.remove() }, 80) })
const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(String(e.message || e)))
await page.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V196D && !!(window.ribSave || window.__PLATFORM_V149), null, { timeout: 40000 })
await page.evaluate(() => document.getElementById('splash')?.remove())

// fill the origin's storage: junk keys until setItem throws, then the save must still go in
const fill = () => page.evaluate(() => {
  const chunk = 'x'.repeat(256 * 1024); let n = 0
  for (let i = 0; i < 400; i++) { try { localStorage.setItem('junk_v196d_' + i, chunk); n++ } catch (e) { break } }
  for (let s = 32 * 1024; s >= 64; s = s >> 1) { for (let i = 0; i < 200; i++) { try { localStorage.setItem('junk_v196d_s' + s + '_' + i, 'y'.repeat(s)) } catch (e) { break } } }
  return n
})
const R = await page.evaluate(async () => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S)
  S.player = A.newPlayer(); S.player.name = 'Full Disk'; S.player.pos = 'RB'; S.player.level = 3; A.startSeasonGames()
  // a fat save and five rolling backups of it
  S.padV196D = 'p'.repeat(200 * 1024)
  window.GridironStorage.save(S)
  const B = window.ribSave && window.ribSave.backups
  for (let i = 0; i < 5; i++) { S.player.totalSeasons = i + 1; window.GridironStorage.save(S); B && B.snapshot('test' + i) }
  return { backups: B ? B.list().length : -1 }
})
const filled = await fill()
const S1 = await page.evaluate(() => {
  const S = window.__getGridironState(); S.player.name = 'Saved Anyway'; S.padV196D = 'q'.repeat(230 * 1024)
  window.__V196D.freed = 0; let err = null
  try { window.GridironStorage.save(S) } catch (e) { err = String(e.name || e) }
  const back = JSON.parse(localStorage.getItem('gridiron_save_v1') || '{}')
  return { err, name: back.player && back.player.name, freed: window.__V196D.freed, backups: JSON.parse(localStorage.getItem('rib_backups_v149') || '[]').length }
})
ok(R.backups >= 3 && filled > 0, 'set-up: rolling backups present and the storage filled to the brim', { R, filled })
ok(!S1.err && S1.name === 'Saved Anyway' && S1.freed > 0, 'a full storage: the save still lands — the oldest backups made room', S1)

// nothing left to free: the save fails loudly
const S2 = await page.evaluate(async () => {
  for (let k = 0; k < 20; k++) { try { const idx = JSON.parse(localStorage.getItem('rib_backups_v149') || '[]'); idx.forEach((m) => localStorage.removeItem('rib_backup_v149_' + m.id)); localStorage.removeItem('rib_backups_v149'); localStorage.removeItem('gridiron_save_v1_backup') } catch (e) {} }
  for (let i = 0; i < 40; i++) { try { localStorage.setItem('junk_v196d_more' + i, 'z'.repeat(64 * 1024)) } catch (e) { break } }
  const S = window.__getGridironState(); S.padV196D = 'r'.repeat(1500 * 1024)
  const fails0 = window.__V196D.fails
  window.__V196D.saveGame()
  await new Promise((r) => setTimeout(r, 300))
  const t = [...document.querySelectorAll('.toast, #toast, [class*="toast"]')].map((x) => x.textContent).join(' | ')
  return { fails: window.__V196D.fails - fails0, toast: /NOT saved/.test(t), t: t.slice(0, 200) }
})
ok(S2.fails >= 1 && S2.toast, 'nothing left to free: the save fails LOUDLY — "Progress NOT saved"', S2)
// the kill switch
const K = await page.evaluate(() => {
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v196D: 0 })
  const S = window.__getGridironState(); S.padV196D = 's'.repeat(1500 * 1024); let err = null
  try { window.GridironStorage.save(S) } catch (e) { err = String(e.name || e) }
  window.RIB_TUNE.v196D = 1
  for (let i = 0; i < localStorage.length; ) { const k = localStorage.key(i); if (/^junk_v196d/.test(k)) localStorage.removeItem(k); else i++ }
  return { err }
})
ok(/Quota/i.test(K.err || ''), 'TU v196D 0: the old path throws the quota error', K)
ok(errors.length === 0, 'no page errors', errors.slice(0, 4))
await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
