// Dev check: v163 A — THE GAME NEVER STOPS (src/05-field-renderer.js, src/06-phaser-launcher.js, src/07-career-app.js),
// on a live game at a 400x860 phone. Each case breaks the game the way a real stall did, then asserts the live log keeps
// moving (`__V156D.log()` grows: the rows the live loop has reached) and the field keeps drawing (the loop's frame count):
//   1. ONE BAD FRAME: an exception thrown inside a frame (a scene `update` listener). Before v163 A Phaser's loop asked
//      for the next frame only after the callback returned, so this ended the loop for good. Now it is caught
//      (`__V163A.caught`), frames keep coming and the game reaches its next rows
//   2. A DEAD TEXTURE ON THE FIELD: an image whose canvas texture is removed under it — whatever the renderer does
//      with it, the loop keeps running and the next rows come
//      — and one SWAPPED under it (remove + re-add, how the kits and the crowd re-register) is rebound before it is
//      drawn, with no error at all
//   3. THE LOOP STOPS (a pause whose resume never arrived): `loop.raf.stop()` — the play's wall-clock watch restarts it
//      (`restarts`) and the game goes on
//   4. AN ORPHANED PLAY: the scene loses the play's completion — the watch hands the play back (`released`) and the
//      game goes on
//   5. A THROW IN THE LIVE LOOP: GridironPhaser.animate throws once — the tick is retried (`tickErrors`), the game goes on
//   6. no Math.random spent by the watch; the kill switch TU v163A 0 (a fresh page): one bad frame stops the loop (the
//      bug this fixes); no page errors other than the injected ones
//   node scripts/v163Acheck.mjs        (GAME_URL=http://localhost:5173/)
import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'
import { waitLive } from './lib/live.mjs'
const browser = await chromium.launch({ executablePath: CHROME })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`

async function onto (tune) {
  const page = await browser.newPage({ viewport: { width: 400, height: 860 } })
  const errs = []
  page.on('pageerror', e => { if (!/INJECTED/.test(e.message)) errs.push('PAGEERROR: ' + e.message) })
  page.on('console', m => { if (m.type() === 'error' && !/INJECTED|Failed to load resource|net::ERR/.test(m.text())) errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
  await page.addInitScript((t) => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { speedGateV151A: 0 }, t) }, tune)
  await page.addInitScript(() => { setInterval(() => { document.querySelector('.onboard')?.remove() }, 60) })
  await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(1200)
  await page.waitForFunction(() => typeof window.__simGameV2 === 'function', null, { timeout: 60000 })
  await page.evaluate(() => { window.__readPos = 'QB' })
  for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) {
    await page.evaluate(({ t, visSrc }) => {
      const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
      const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
      const el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
        : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t))
      if (el) { el.scrollIntoView({ block: 'center' }); el.click() }
    }, { t, visSrc: vis }).catch(() => {})
    await page.waitForTimeout(t === 'PLAN' ? 4000 : 900)
  }
  const live = await waitLive(page, 90000)
  if (live) {
    // every snap on, at 2x, so the log moves quickly and the measure is the loop, not the filter
    await page.evaluate(() => { const st = window.__getGridironState(); st.settings.onlyInvolved = false; st.settings.skipOpp = false; st.settings.myPlaysV156D = false; try { window.setSpeed(2) } catch (e) {} })
    await page.waitForFunction(() => { const L = window.__V156D && window.__V156D.log(); return L && L.length >= 1 && window.__gridironScene && window.__gridironScene.game }, null, { timeout: 30000 }).catch(() => {})
  }
  return { page, errs, live }
}
const state = (page) => page.evaluate(() => {
  const sc = window.__gridironScene, g = sc && sc.game, L = window.__V156D && window.__V156D.log(), V = window.__V163A || {}
  return { rows: L ? L.length : 0, frame: g ? g.loop.frame : -1, caught: V.caught || 0, swept: V.swept || 0, restarts: V.restarts || 0, released: V.released || 0, tickErrors: V.tickErrors || 0, errors: (V.errors || []).map(e => e.where + ': ' + e.msg.slice(0, 50) + ' ×' + e.n) }
})
// the game is moving: `n` more rows reached within `ms`, and frames being drawn at the end
async function moves (page, n, ms) {
  const a = await state(page), t0 = Date.now()
  let b = a
  while (Date.now() - t0 < ms) { await page.waitForTimeout(500); b = await state(page); if (b.rows >= a.rows + n) break }
  const f0 = b.frame; await page.waitForTimeout(600); const f1 = (await state(page)).frame
  return { ok: b.rows >= a.rows + n && f1 > f0, rows: [a.rows, b.rows], frames: [f0, f1], s: b }
}

const { page, errs, live } = await onto({})
ok(live, 'the live game is up')
if (!live) { await browser.close(); process.exit(1) }
let m = await moves(page, 2, 40000)
ok(m.ok, 'baseline: the live log moves and the field draws', m)

// 1. one bad frame
let s0 = await state(page)
await page.evaluate(() => { window.__gridironScene.events.once('update', () => { throw new Error('INJECTED one bad frame') }) })
m = await moves(page, 2, 45000)
ok(m.s.caught > s0.caught, 'one bad frame: the exception is caught inside the loop', { before: s0.caught, after: m.s.caught })
ok(m.ok, 'one bad frame: frames keep coming and the game reaches its next rows', m)

// 2. a dead texture on the field
s0 = await state(page)
const dead = await page.evaluate(async () => {
  const sc = window.__gridironScene, cv = document.createElement('canvas'); cv.width = 16; cv.height = 16
  sc.textures.addCanvas('v163a_probe', cv); const im = sc.add.image(360, 300, 'v163a_probe').setDepth(50)
  sc.textures.remove('v163a_probe')
  await new Promise(r => setTimeout(r, 600))
  const alive = im.active && im.visible && im.texture && im.texture.key === 'v163a_probe'
  try { im.destroy() } catch (e) {}
  return { alive }
})
m = await moves(page, 2, 45000)
ok(m.ok, 'a dead texture on the field: the loop keeps running and the next rows come', { m, dead, caught: m.s.caught - s0.caught, swept: m.s.swept - s0.swept })

// 2b. a texture SWAPPED under a live sprite (remove + re-add under the same key: how the kits, the crowd and the number
//     fonts re-register) is rebound before it is drawn — no error at all
s0 = await state(page)
const swap = await page.evaluate(async () => {
  const sc = window.__gridironScene, mk = () => { const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16; return cv }
  sc.textures.addCanvas('v163a_swap', mk()); const im = sc.add.image(360, 300, 'v163a_swap').setDepth(50)
  const old = im.texture
  sc.textures.remove('v163a_swap'); sc.textures.addCanvas('v163a_swap', mk())
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  const out = { rebound: im.texture !== old && im.texture === sc.textures.get('v163a_swap'), visible: im.visible }
  im.destroy(); sc.textures.remove('v163a_swap')
  return out
})
const s1 = await state(page)
ok(swap.rebound && swap.visible && s1.caught === s0.caught, 'a texture swapped under a live sprite is rebound before it is drawn (no frame error)', { swap, caught: s1.caught - s0.caught })

// 3. the loop stops
s0 = await state(page)
await page.waitForFunction(() => { const sc = window.__gridironScene; return sc && sc.play && !sc.play.done }, null, { timeout: 30000 }).catch(() => {})
await page.evaluate(() => { const g = window.__gridironScene.game; g.loop.raf.stop() })
const stopped = await page.evaluate(async () => { const g = window.__gridironScene.game, f = g.loop.frame; await new Promise(r => setTimeout(r, 1500)); return g.loop.frame === f })
m = await moves(page, 2, 50000)
ok(stopped, 'the loop really stopped (the frame count held for 1.5 s)')
ok(m.s.restarts > s0.restarts, 'the play\'s watch restarts a stopped loop', { before: s0.restarts, after: m.s.restarts })
ok(m.ok, 'and the game goes on', m)

// 4. an orphaned play
s0 = await state(page)
await page.waitForFunction(() => { const sc = window.__gridironScene; return sc && sc.play && sc.completion && !sc.play.done }, null, { timeout: 30000 }).catch(() => {})
await page.evaluate(() => { window.__gridironScene.completion = void 0 })
m = await moves(page, 2, 50000)
ok(m.s.released > s0.released, 'an orphaned play is handed back by the watch', { before: s0.released, after: m.s.released })
ok(m.ok, 'and the game goes on', m)

// 5. a throw in the live loop
s0 = await state(page)
await page.evaluate(() => {
  const G = window.GridironPhaser, a0 = G.animate; let once = true
  G.animate = function () { if (once) { once = false; G.animate = a0; throw new Error('INJECTED the live loop') } return a0.apply(this, arguments) }
})
m = await moves(page, 2, 45000)
ok(m.s.tickErrors > s0.tickErrors, 'a throw in a live tick is recorded', { before: s0.tickErrors, after: m.s.tickErrors })
ok(m.ok, 'and the next tick is scheduled — the game goes on', m)

// 6. the watch spends no Math.random
const rnd = await page.evaluate(async () => {
  let n = 0; const r0 = Math.random; Math.random = function () { n++; return r0() }
  const sc = window.__gridironScene; const g = sc.game
  // freeze the scene's own draws out of the count: only the watch's interval runs in this window
  g.loop.sleep(); await new Promise(r => setTimeout(r, 1200)); const k = n; g.loop.wake(); Math.random = r0
  return k
})
ok(rnd === 0, 'the watch spends no Math.random', rnd)
ok(errs.length === 0, 'no page errors besides the injected ones', errs.slice(0, 4).join(' | '))
console.log('errors recorded:', JSON.stringify((await state(page)).errors))
await page.close()

// the kill switch: one bad frame ends the loop again
const off = await onto({ v163A: 0 })
if (off.live) {
  await off.page.evaluate(() => { window.__gridironScene.events.once('update', () => { throw new Error('INJECTED one bad frame (off)') }) })
  const held = await off.page.evaluate(async () => { const g = window.__gridironScene.game; await new Promise(r => setTimeout(r, 400)); const f = g.loop.frame; await new Promise(r => setTimeout(r, 2500)); return { f0: f, f1: g.loop.frame } })
  ok(held.f1 === held.f0, 'kill switch TU v163A 0: one bad frame stops the loop for good (the bug this fixes)', held)
} else ok(false, 'kill switch run reached the live game')
await off.page.close()
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
