// Dev check: v92 THE LIGHTS AND THE BIG SCREEN, the taller posts, and no decimals on the sheets.
// Part 1 drives a real career onto the live field and asserts the lights sheet decoded, four
// towers stand behind the far bowl with their heads in the sky, the big screen sits above the
// bowl, its camera tracks the screen's panel on the main camera, the whistle freezes it into a
// replay still and the snap brings the feed back, and the posts carry real proportions.
// Part 2 walks every career screen and fails on any decimal number in the visible text
// (the four sprint times on the attribute sheet are the one allowed exception).
//   node scripts/v92check.mjs        (READ_POS=RB, V92_MS=40000, V92_SHOTS=1)
import { chromium } from 'playwright'
import fs from 'node:fs'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const errs = []
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function newPage() {
  const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
  await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)
  return page
}
async function step(page, t) { const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
  let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className) || /RUN THIS PLAN|LOCK IT IN|CHOOSE/i.test(txt(e))) : els.find(e => txt(e).includes(t))
  if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis }); console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900) }

// ================= Part 1: the field =================
const page = await newPage()
await page.evaluate(p => { window.__readPos = p }, process.env.READ_POS || 'RB')
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(page, t)
let scene = false
for (let i = 0; i < 40; i++) { scene = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length)); if (scene) break; await page.waitForTimeout(500) }
console.log('scene:', scene)
await page.waitForFunction(() => window.__V92 && window.__V92.loaded && window.__V92.on, null, { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(800)
const snap = async (path) => { const src = await page.evaluate(() => new Promise(res => { try { window.__gridironScene.game.renderer.snapshot(img => res(img.src || null)) } catch (e) { res(null) } })); if (src) fs.writeFileSync(path, Buffer.from(src.split(',')[1], 'base64')) }
const SHOTS = !!process.env.V92_SHOTS

const st = await page.evaluate(() => { const sc = window.__gridironScene, V = window.__V92 || {}, T = sc.textures
  const frames = T.exists('rib_lights_v92') ? T.get('rib_lights_v92').frameTotal : 0
  return { loaded: !!V.loaded, on: !!V.on, frames, towers: V.towerBoxes ? V.towerBoxes() : [], bowl: V.bowl, screen: V.screen ? V.screen() : null, crowdDepth: window.TU('crowdDepth', 3.45) } })
console.log('stadium:', JSON.stringify({ loaded: st.loaded, on: st.on, frames: st.frames, bowl: st.bowl, towers: st.towers.length, rect: st.screen && st.screen.rect }))
ok(st.loaded && st.frames >= 12, 'the lights sheet decoded as a twelve-frame sprite sheet', `frames=${st.frames}`)
ok(st.on && st.towers.length === 4, 'four floodlight towers stand at the far bowl', `towers=${st.towers.length}`)
const B = st.bowl || { top: 0, bot: 0 }
ok(st.towers.length && st.towers.every(t => t.depth < st.crowdDepth && t.y >= B.top && t.y <= B.bot + 8), 'every mast is planted inside the bowl band and drawn behind the crowd', JSON.stringify(st.towers.map(t => [t.y, t.depth])))
ok(st.towers.length && st.towers.every(t => t.top < B.top - 30), 'every lamp head rises into the sky above the bowl', `heads=${st.towers.map(t => t.top).join(',')} bowlTop=${B.top}`)
ok(st.towers.length && st.towers.every(t => (t.x < 360) === (t.face === 1)), 'the heads are turned in toward the field', JSON.stringify(st.towers.map(t => [t.x, t.face])))
const R = st.screen && st.screen.rect
ok(R && R.y + R.h < B.top && Math.abs(R.x + R.w / 2 - 360) < 2 && R.w > 200, 'the big screen hangs centred above the far stand', R && `bottom=${Math.round(R.y + R.h)} bowlTop=${B.top} w=${Math.round(R.w)}`)

// park the camera on the far end with the scene paused (update stops, rendering goes on)
const park = await page.evaluate(async () => { const sc = window.__gridironScene, c = sc.cameras.main
  sc.scene.pause(); c.centerOn(360, 369); await new Promise(r => setTimeout(r, 250)); sc.updateStadiumV92(16); await new Promise(r => setTimeout(r, 250)); sc.updateStadiumV92(16); await new Promise(r => setTimeout(r, 120))
  const S1 = window.__V92.screen(); const wv = c.worldView, z = c.zoom, R = S1.rect
  const raw = { x: (R.x - wv.x) * z, y: (R.y - wv.y) * z, w: R.w * z, h: R.h * z }   // clipped to the canvas, as the viewport must be
  const want = { x: Math.max(0, raw.x), y: Math.max(0, raw.y), w: Math.min(720, raw.x + raw.w) - Math.max(0, raw.x), h: Math.min(576, raw.y + raw.h) - Math.max(0, raw.y) }
  const whistle = sc.stadiumWhistleV92(); await new Promise(r => setTimeout(r, 800)); sc.updateStadiumV92(16); await new Promise(r => setTimeout(r, 150))
  const S2 = window.__V92.screen(); const stillTex = sc.textures.exists('jumbo_still_v92'); const still = sc.stadium.still; const stillVis = !!(still && still.visible)
  sc.stadiumLiveV92(); sc.updateStadiumV92(16); await new Promise(r => setTimeout(r, 150))
  const S3 = window.__V92.screen(); const stillVis3 = !!(still && still.visible)
  return { wvY: wv.y, live: S1, want, whistle, replay: S2, stillTex, stillVis, back: S3, stillVis3 } })
console.log('park:', JSON.stringify({ wvY: park.wvY, cam: park.live.cam, want: park.want, whistle: park.whistle, replay: park.replay.mode, shots: park.replay.shots }))
const C1 = park.live.cam
ok(C1 && C1.visible && C1.w >= 8 && C1.x >= 0 && C1.y >= 0 && C1.x + C1.w <= 720 && C1.y + C1.h <= 576, 'with the far end in view the feed camera is on, inside the canvas', JSON.stringify(C1))
ok(C1 && Math.abs(C1.x - park.want.x) <= 2 && Math.abs(C1.y - park.want.y) <= 2 && Math.abs(C1.w - park.want.w) <= 2, 'the feed camera\'s viewport is exactly where the screen\'s panel lands on the main camera', `cam=${[C1.x, C1.y, C1.w].join(',')} want=${[park.want.x, park.want.y, park.want.w].map(Math.round).join(',')}`)
ok(park.whistle && park.replay.mode === 'replay' && park.replay.shots === 1 && park.stillTex && park.stillVis, 'the whistle freezes the feed into a replay still', `whistle=${park.whistle} mode=${park.replay.mode} shots=${park.replay.shots} still=${park.stillTex}/${park.stillVis}`)
ok(park.back.mode === 'live' && !park.stillVis3 && park.back.cam.visible, 'the snap brings the feed back', `mode=${park.back.mode} still=${park.stillVis3} cam=${park.back.cam.visible}`)
if (SHOTS) await snap('scripts/_v92_far.png')
await page.evaluate(() => { window.__gridironScene.scene.resume() })

// the posts: real proportions in the source, and drawn at both ends every snap
const src = await page.evaluate(async () => (await (await fetch('/index.html')).text()))
const up = +(src.match(/TU\("uprightH", (\d+)\)/) || [])[1], ph = +(src.match(/TU\("postH", (\d+)\)/) || [])[1]
ok(up >= 120 && ph >= 40, 'the goalposts stand at real proportions (crossbar on a post, tall uprights)', `postH=${ph} uprightH=${up}`)
const posts = await page.evaluate(() => { const sc = window.__gridironScene; return { g: !!(sc.goalG && sc.goalG.visible), cmds: sc.goalG && sc.goalG.commandBuffer ? sc.goalG.commandBuffer.length : 0 } })
ok(posts.g && posts.cmds >= 20, 'the posts are drawn at both ends', JSON.stringify(posts))

// watch: the lamps breathe and the screen only films while it can be seen
const MS = +(process.env.V92_MS || 30000), t0 = Date.now(); const seen = { frames: 0, changed: 0, camOn: 0, camOnScreen: 0, samples: 0 }; let lastF = null
while (Date.now() - t0 < MS) { await page.waitForTimeout(150)
  const s = await page.evaluate(() => { const V = window.__V92; const t = V.towerBoxes()[0]; const S = V.screen(); const c = window.__gridironScene.cameras.main; return { f: t && t.frame, cam: S.cam.visible, top: c.worldView.y } })
  seen.samples++; if (s.f !== lastF) seen.changed++; lastF = s.f; if (s.cam) { seen.camOn++; if (s.top < 200) seen.camOnScreen++ } }
console.log('watch:', JSON.stringify(seen))
ok(seen.changed >= 6, 'the lamps walk their frames over the watch', `frame changes=${seen.changed}/${seen.samples}`)
ok(seen.camOn === seen.camOnScreen, 'the feed camera only renders while the far end is in the frame', `on=${seen.camOn} inFrame=${seen.camOnScreen}`)
if (SHOTS) await snap('scripts/_v92_field.png')
await page.close()

// ================= Part 2: no decimals on the sheets =================
const p2 = await browser.newPage({ viewport: { width: 430, height: 932 } })
p2.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await p2.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await p2.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 25000 }); await p2.waitForTimeout(1200)
await p2.evaluate(p => { window.__readPos = p }, process.env.READ_POS || 'RB')
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program']) await step(p2, t)
await p2.evaluate(async () => { document.getElementById('growthV42')?.remove(); window.go('season'); window.simRemainingWeeks(); await new Promise(r => setTimeout(r, 1500)) })
const VIEWS = ['hub', 'season', 'result', 'training', 'upgrade', 'stats', 'leaderboard', 'life', 'shop', 'settings', 'highscore', 'hall', 'hof', 'roster', 'team', 'rank', 'body', 'money', 'prestige', 'locker', 'goals', 'declare', 'career', 'sim', 'event', 'daily']
const found = {}, shown = []
for (const v of VIEWS) {
  const r = await p2.evaluate(async (v) => { try { window.go(v) } catch (e) { return { err: e.message } } await new Promise(r => setTimeout(r, 350))
    document.querySelectorAll('.toast, .toasts, #toasts').forEach(t => t.remove())
    if (window.S.view !== v) return { skipped: window.S.view }
    const txt = document.body.innerText || ''
    // a decimal is a digit, a point, a digit — the four sprint times ("4.52s") are the one exception
    const hits = [...txt.matchAll(/[^\s]*\d\.\d[^\s]*/g)].map(m => m[0]).filter(h => !/^\d\.\d\ds$/.test(h) && !/^v\d/.test(h) && !/2\.5D/.test(h))
    return { hits: [...new Set(hits)].slice(0, 12), len: txt.length } }, v)
  if (r.hits) { shown.push(v); if (r.hits.length) found[v] = r.hits }
}
console.log('views shown:', shown.join(' '), '\ndecimals:', JSON.stringify(found))
ok(shown.length >= 8, 'the career screens rendered for the scan', `${shown.length} views`)
ok(Object.keys(found).length === 0, 'no decimal numbers on any career screen (sprint times excepted)', JSON.stringify(found).slice(0, 600))
await p2.close()

console.log(JSON.stringify({ pass, fail }))
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
