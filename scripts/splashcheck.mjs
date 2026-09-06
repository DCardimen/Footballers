// Dev check: v94 THE CHASE — the loading screen.
// Boots the game three ways and asserts the door opens every time:
//   1. the normal boot: the sheet lands, the chase draws (the canvas has turf and kit
//      pixels, the runner moves, the beats roll through look/juke/recover), the splash holds
//      for its minimum, plays the exit beat and is gone with the menu behind it; three
//      screenshots along the way (_splash_0.png, _splash_1.png, _splash_2.png, _splash_td.png);
//   2. reduced motion: one posed frame, the old timing;
//   3. the sheet never lands (the request is aborted): the football stands in and the
//      splash still leaves on the old timing;
//   4. the live game: the same chase mounts over .field-wrap as the broadcast boots, names the
//      matchup, and leaves once the scene is up (_splash_live.png).
//   node scripts/splashcheck.mjs
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const URL = process.env.SPLASH_URL || 'http://localhost:5173/'

async function boot(opts) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 }, reducedMotion: opts.rm ? 'reduce' : 'no-preference' })
  const page = await ctx.newPage(); const errs = []
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
  if (opts.noSheet) await page.route(/rib_field_v91\.(png|json)/, r => r.abort())
  await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
  // a warm-up load absorbs the one full-reload vite sends the first client after index.html changed
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 }); await page.waitForTimeout(1500); errs.length = 0
  const t0 = Date.now()
  await page.goto(URL, { waitUntil: 'commit', timeout: 30000 })
  return { page, ctx, errs, t0 }
}
const canvasStats = () => {
  const cv = document.getElementById('splashChase'); if (!cv || !cv.width) return null
  const x = cv.getContext('2d'), d = x.getImageData(0, 0, cv.width, cv.height).data
  let turf = 0, gold = 0, red = 0, chalk = 0, n = 0
  for (let i = 0; i < d.length; i += 16) { n++; const r = d[i], g = d[i + 1], b = d[i + 2]
    if (g > 80 && g > r + 20 && g > b + 20) turf++
    if (r > 200 && g > 150 && b < 110) gold++
    if (r > 150 && g < 90 && b < 90) red++
    if (r > 220 && g > 220 && b > 220) chalk++ }
  return { n, turf: turf / n, gold, red, chalk, w: cv.width, h: cv.height }
}

// ---- 1. the normal boot
{
  const { page, errs, t0 } = await boot({})
  let ready = false
  for (let i = 0; i < 60; i++) { ready = await page.evaluate(() => !!(window.__SPLASH_V94 && window.__SPLASH_V94.ready)); if (ready) break; await page.waitForTimeout(100) }
  ok(ready, 'the sheet lands and the chase starts', (Date.now() - t0) + 'ms after boot')
  await page.waitForTimeout(150)
  const hasClass = await page.evaluate(() => document.getElementById('splash').classList.contains('chase') && getComputedStyle(document.getElementById('splashChase')).display !== 'none' && getComputedStyle(document.querySelector('.splash-ball')).display === 'none')
  ok(hasClass, 'the canvas shows and the football is put away')
  await page.screenshot({ path: '_splash_0.png' })
  const s0 = await page.evaluate(canvasStats)
  ok(s0 && s0.turf > 0.25, 'turf on the canvas', s0 && s0.turf.toFixed(2))
  ok(s0 && s0.gold > 0 && s0.red > 0, 'both kits drawn (gold runner, red defender)', s0 && (s0.gold + '/' + s0.red))
  ok(s0 && s0.chalk > 0, 'chalk lines drawn', s0 && s0.chalk)
  const x0 = await page.evaluate(() => window.__SPLASH_V94.state.run.x)
  await page.waitForTimeout(700)
  const x1 = await page.evaluate(() => window.__SPLASH_V94.state.run.x)
  ok(x1 > x0 + 40, 'the runner moves', (x1 - x0).toFixed(0) + 'px in 0.7s')
  await page.screenshot({ path: '_splash_1.png' })
  const frames0 = await page.evaluate(() => window.__SPLASH_V94.frames)
  await page.waitForTimeout(1600)
  await page.screenshot({ path: '_splash_2.png' })
  const st = await page.evaluate(() => ({ beats: window.__SPLASH_V94.beats.slice(), frames: window.__SPLASH_V94.frames, exiting: window.__SPLASH_V94.exiting, done: window.__SPLASH_V94.done, up: !!document.getElementById('splash') }))
  ok(st.frames > frames0 + 30, 'the loop keeps drawing', (st.frames - frames0) + ' frames in 1.6s')
  ok(st.beats.includes('juke') || st.beats.includes('look'), 'the beats roll (look / juke)', st.beats.join(' '))
  // the door: the app was ready ~1s in; the splash must still be up until the minimum, then leave
  let gone = false, goneAt = 0
  let tdShot = false
  for (let i = 0; i < 120; i++) { const r = await page.evaluate(() => { const S = window.__SPLASH_V94.state; if (S && S.confetti && S.confetti.length) window.__confettiSeenV94 = (window.__confettiSeenV94 || 0) + 1; return { gone: !document.getElementById('splash'), crossed: !!(S && S.crossed) } }); gone = r.gone
    if (r.crossed && !tdShot) { tdShot = true; await page.screenshot({ path: '_splash_td.png' }) }
    if (gone) { goneAt = Date.now() - t0; break }; await page.waitForTimeout(100) }
  const final = await page.evaluate(() => ({ beats: window.__SPLASH_V94.beats.slice(), done: window.__SPLASH_V94.done, crossed: !!(window.__SPLASH_V94.state && window.__SPLASH_V94.state.crossed), confetti: window.__confettiSeenV94, menu: !!document.querySelector('#screen') && document.querySelector('#screen').innerHTML.length > 200 }))
  ok(gone, 'the splash leaves', goneAt + 'ms after boot')
  ok(final.beats.includes('exit'), 'the exit beat played', final.beats.slice(-4).join(' '))
  const ex = final.beats.indexOf('exit'), before = final.beats.slice(0, ex)
  ok(before.includes('recover') && (before.includes('juke') || before.includes('spin')), 'one full cycle (a move and the recovery) played before the exit', before.join(' '))
  ok(final.crossed && final.confetti !== undefined, 'the runner crossed and the touchdown played out', 'confetti seen: ' + final.confetti)
  ok(goneAt >= 2600, 'the splash held its minimum', goneAt + 'ms')
  ok(goneAt < 14000, 'the splash did not overstay', goneAt + 'ms')
  ok(final.menu, 'the app is rendered behind it')
  console.log('page errors (normal):', errs.length ? errs.slice(0, 6).join('\n') : 'NONE'); if (errs.length) fail++
  await page.context().close()
}
// ---- 2. reduced motion
{
  const { page, errs, t0 } = await boot({ rm: true })
  let gone = false, goneAt = 0
  for (let i = 0; i < 80; i++) { gone = await page.evaluate(() => !document.getElementById('splash')); if (gone) { goneAt = Date.now() - t0; break }; await page.waitForTimeout(100) }
  const fr = await page.evaluate(() => window.__SPLASH_V94 ? window.__SPLASH_V94.frames : -1)
  ok(gone, 'reduced motion: the splash leaves', goneAt + 'ms')
  ok(fr === 0, 'reduced motion: no animation loop ran', fr)
  console.log('page errors (reduced):', errs.length ? errs.slice(0, 6).join('\n') : 'NONE'); if (errs.length) fail++
  await page.context().close()
}
// ---- 3. no sheet
{
  const { page, errs, t0 } = await boot({ noSheet: true })
  await page.waitForTimeout(600)
  const fb = await page.evaluate(() => { const s = document.getElementById('splash'); return s ? { chase: s.classList.contains('chase'), ball: getComputedStyle(document.querySelector('.splash-ball')).display } : null })
  ok(fb && !fb.chase && fb.ball !== 'none', 'no sheet: the football stands in', JSON.stringify(fb))
  let gone = false, goneAt = 0
  for (let i = 0; i < 80; i++) { gone = await page.evaluate(() => !document.getElementById('splash')); if (gone) { goneAt = Date.now() - t0; break }; await page.waitForTimeout(100) }
  ok(gone, 'no sheet: the splash still leaves', goneAt + 'ms')
  const real = errs.filter(e => !/rib_field_v91|ERR_FAILED/.test(e)); console.log('page errors (no sheet):', real.length ? real.slice(0, 6).join('\n') : 'NONE'); if (real.length) fail++
  await page.context().close()
}
// ---- 4. the live game's loader
{
  const ctx = await browser.newContext({ viewport: { width: 520, height: 900 } }); const page = await ctx.newPage(); const errs = []
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
  await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 }); await page.waitForTimeout(1500)
  const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
  async function step(t) { let r = null; try { r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    let el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis }) } catch (e) { r = 'ERR ' + e.message }
    console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900) }
  for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'PLAY WEEK 1 LIVE', 'PLAN']) await step(t)
  // a story / training roll can sit over the screen: its CONTINUE clears it (never the match's own Continue)
  const dismiss = async () => { for (let i = 0; i < 4; i++) { const hit = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(e => /^continue$/i.test((e.textContent || '').trim()) && e.getBoundingClientRect().height > 0); if (b) { b.click(); return true } return false }); if (!hit) break; await page.waitForTimeout(700) } }
  await dismiss()
  // the pregame wheel and a story roll take their own time: wait for the match button, clearing any roll's CONTINUE on the way
  let clicked = null
  for (let i = 0; i < 60 && !clicked; i++) {
    clicked = await page.evaluate((visSrc) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
      const m = els.find(e => /Continue to Match/i.test(e.textContent || '')); if (m) { m.click(); return 'match' }
      const c = els.find(e => /^continue$/i.test((e.textContent || '').trim())); if (c) c.click(); return null }, vis)
    if (!clicked) await page.waitForTimeout(300)
  }
  console.log('>> Continue to Match ->', clicked)
  let seen = null
  for (let i = 0; i < 40; i++) { seen = await page.evaluate(() => { const el = document.querySelector('.rib-liveload-v94'); if (!el) return null; const cv = el.querySelector('canvas'); return { chase: el.classList.contains('chase'), inWrap: !!el.closest('.field-wrap'), cap: el.querySelector('.rib-liveload-cap-v94 b').textContent, w: cv ? cv.width : 0, shows: window.__LIVELOAD_V94.shows } }); if (seen && seen.chase) break; await page.waitForTimeout(100) }
  ok(!!seen, 'the live loader mounts over the field', JSON.stringify(seen))
  ok(seen && seen.inWrap && seen.chase && seen.w > 0, 'it runs the chase inside .field-wrap', seen && (seen.w + 'px'))
  ok(seen && /vs/i.test(seen.cap), 'the caption names the matchup', seen && seen.cap)
  await dismiss(); await page.waitForTimeout(200)
  try { await page.locator('.rib-liveload-v94').screenshot({ path: '_splash_live.png' }) } catch (e) { await page.screenshot({ path: '_splash_live.png' }) }
  let gone = false, sceneUp = false; const t1 = Date.now()
  for (let i = 0; i < 120; i++) { const r = await page.evaluate(() => ({ gone: !document.querySelector('.rib-liveload-v94'), scene: !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length) })); sceneUp = sceneUp || r.scene; if (r.gone) { gone = true; break }; await page.waitForTimeout(100) }
  ok(gone, 'the loader leaves once the scene is up', (Date.now() - t1) + 'ms')
  ok(sceneUp, 'the broadcast scene came up under it')
  const again = await page.evaluate(() => window.__LIVELOAD_V94.shows)
  ok(again === 1, 'it showed once for the game', again)
  console.log('page errors (live):', errs.length ? errs.slice(0, 6).join('\n') : 'NONE'); if (errs.length) fail++
  await ctx.close()
}
console.log(JSON.stringify({ pass, fail }))
await browser.close()
process.exit(fail ? 1 : 0)
