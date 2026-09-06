// Dev check: v93 THE HOME END ZONES — the paint belongs to whoever owns the stadium.
// Drives a real career onto the live field (week 1, at home) and asserts the schedule
// carries alternating home weeks, the field's end zones were repainted in the user's
// palette with the user's name, that flipping to an away fixture repaints them in the
// opponent's palette (the same one their jerseys wear) with the opponent's name, both
// bands carry lettering, and the warped field on screen shows the new paint at the
// far end. No page errors.   node scripts/v93check.mjs   (V93_SHOTS=1 saves scripts/_v93_*.png)
import { chromium } from 'playwright'
import fs from 'node:fs'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function step(t) { const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
  let el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className) || /RUN THIS PLAN|LOCK IT IN|CHOOSE/i.test(txt(e))) : els.find(e => txt(e).includes(t))
  if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis }); console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900) }
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program']) await step(t)

// ---- 1. the schedule knows whose ground each week is
const sched = await page.evaluate(() => (window.S.player.weekResults || []).map(w => w.home))
console.log('schedule home flags:', JSON.stringify(sched))
ok(sched.length >= 4 && sched[0] === true && sched.every((h, i) => h === (i % 2 === 0)), 'week 1 is at home and the fixtures alternate', JSON.stringify(sched))

for (const t of ['PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
let scene = false
for (let i = 0; i < 40; i++) { scene = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length)); if (scene) break; await page.waitForTimeout(500) }
console.log('scene:', scene)
await page.waitForFunction(() => window.__V93 && window.__V93.painted, null, { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(600)
const snap = async (path) => { const src = await page.evaluate(() => new Promise(res => { try { window.__gridironScene.game.renderer.snapshot(img => res(img.src || null)) } catch (e) { res(null) } })); if (src) fs.writeFileSync(path, Buffer.from(src.split(',')[1], 'base64')) }
const SHOTS = !!process.env.V93_SHOTS
const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const near = (s, hex, k = 0.82, tol = 34) => { const P = hx(hex).map(v => v * k); return Math.abs(s.r - P[0]) < tol && Math.abs(s.g - P[1]) < tol && Math.abs(s.b - P[2]) < tol }

// ---- 2. at home: the user's colours and name
const home = await page.evaluate(() => { const V = window.__V93; const sc = window.__gridironScene; const nm = sc.teamNames()
  const usIdx = (window.__GRIDIRON_TEAM_CUSTOM__ && window.__GRIDIRON_TEAM_CUSTOM__.palette) || 0; const pal = window.TEAM_PALETTES[usIdx]
  return { flag: window.__homeGameV93, V: V && { home: V.home, key: V.key, name: V.name, cols: V.cols, ends: V.ends, painted: V.painted }, far: V.sample('far'), nearBand: V.sample('near'), pal, us: nm.us, them: nm.them } })
console.log('home:', JSON.stringify(home))
ok(home.flag === true && home.V && home.V.home === true && home.V.painted, 'week 1 is played at home and the field was repainted', home.V && home.V.key)
ok(home.V && home.V.name === home.us && home.V.cols[0] === home.pal[0], 'the paint is the user\'s palette with the user\'s name', `${home.V && home.V.name} ${home.V && home.V.cols.join('/')}`)
ok(home.V && home.V.ends && home.V.ends.far.label === 'TOUCHDOWN' && home.V.ends.far.cols[0] === home.pal[0] && home.V.ends.near.label === home.them, 'v97: TOUCHDOWN in the user\'s colours at the far end, the opponent\'s name at the near', home.V && home.V.ends && `${home.V.ends.far.label}/${home.V.ends.near.label}`)
ok(home.far && near(home.far, home.pal[0]), 'the far end zone on the flat art averages the home primary', JSON.stringify(home.far) + ' vs ' + home.pal[0])
ok(home.far && home.far.sec > 200, 'the far end zone carries lettering in the secondary colour', `sec far=${home.far && home.far.sec} near=${home.nearBand && home.nearBand.sec}`)

// the warped field on screen: park on the far end and sample the end zone block
const shot = async (name) => { const src = await page.evaluate(() => new Promise(res => { try { window.__gridironScene.game.renderer.snapshot(img => res(img.src || null)) } catch (e) { res(null) } })); return src }
const onScreen = await page.evaluate(async () => { const sc = window.__gridironScene, c = sc.cameras.main; sc.scene.pause(); c.centerOn(360, 369); await new Promise(r => setTimeout(r, 350))
  return new Promise(res => sc.game.renderer.snapshot(img => { try { const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const x = cv.getContext('2d'); x.drawImage(img, 0, 0)
    // the far end zone block lands just above the far goal line: sample a band of rows around the PJ of the end-zone middle
    const F = window.__FIELDMAP_V72, my = (14 + 426) / 2; const A = F.pj(F.PLAY_R + F.EZ * 0.5, my), Bp = F.pj(F.PLAY_L - F.EZ * 0.5, my); const P = A.y < Bp.y ? A : Bp; const wv = c.worldView, z = c.zoom   // whichever end is far this snap
    const sx = Math.round((P.x - wv.x) * z), sy = Math.round((P.y - wv.y) * z); const d = x.getImageData(Math.max(0, sx - 60), Math.max(0, sy - 4), 120, 8).data
    let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++ }
    res({ sx, sy, r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) }) } catch (e) { res({ err: e.message }) } })) })
console.log('on screen:', JSON.stringify(onScreen))
// the sample strip crosses the lettering, so the block reads as paint OR lettering — never the art's navy, never grass
const dTo = (s, hex, k = 1) => { const P = hx(hex); return Math.hypot(s.r - P[0] * k, s.g - P[1] * k, s.b - P[2] * k) }
// the warp downsamples paint and lettering together, so the sample lies on the SEGMENT between the two colours
const dSeg = (s, hexA, hexB) => { const A = hx(hexA).map(v => v * 0.82), B = hx(hexB), P = [s.r, s.g, s.b]; const AB = B.map((v, i) => v - A[i]), AP = P.map((v, i) => v - A[i])
  const t = Math.max(0, Math.min(1, AB.reduce((a, v, i) => a + v * AP[i], 0) / Math.max(1, AB.reduce((a, v) => a + v * v, 0)))); return Math.hypot(...P.map((v, i) => v - (A[i] + AB[i] * t))) }
const dist = dSeg(onScreen, home.pal[0], home.pal[1]), dNavy = dTo(onScreen, '#0b1e2c')
ok(!onScreen.err && dist < 60 && dist < dNavy && !(onScreen.g > onScreen.r + 30 && onScreen.g > onScreen.b + 30), 'the far end zone on the broadcast field wears the paint, not the art\'s navy or the grass', `rgb(${onScreen.r},${onScreen.g},${onScreen.b}) vs ${home.pal.join('/')} dist=${Math.round(dist)} navy=${Math.round(dNavy)}`)
if (SHOTS) { const s = await shot(); if (s) fs.writeFileSync('scripts/_v93_home.png', Buffer.from(s.split(',')[1], 'base64')) }

// ---- 3. away: the opponent's palette (their jersey palette) and name
const away = await page.evaluate(async () => { const V = window.__V93; const changed = V.set(false); await new Promise(r => setTimeout(r, 400)); const V2 = window.__V93; const sc = window.__gridironScene
  const def = V2.cols; const jersey = window.__V91 && window.__V91.teamCols ? window.__V91.teamCols().def : null
  return { changed, home: V2.home, name: V2.name, cols: def, jersey, them: sc.teamNames().them, far: V2.sample('far'), nearBand: V2.sample('near') } })
console.log('away:', JSON.stringify(away))
ok(away.changed && away.home === false && away.name === away.them, 'an away fixture repaints for the opponent, with the opponent\'s name', `${away.name} home=${away.home}`)
ok(away.jersey && away.cols[0] === away.jersey[0] && away.cols[1] === away.jersey[1], 'the away paint is the palette the opponent\'s jerseys wear', `${away.cols && away.cols.join('/')} vs ${away.jersey && away.jersey.join('/')}`)
ok(away.nearBand && near(away.nearBand, away.cols[0], 0.82, 60), 'v97: the near end zone averages the opponent primary on the road', JSON.stringify(away.nearBand) + ' vs ' + away.cols[0])
ok(away.far && away.far.sec > 150 && away.nearBand && away.nearBand.sec > 100, 'TOUCHDOWN at the far end and the opponent\'s name at the near are both lettered', `sec far=${away.far.sec} near=${away.nearBand.sec}`)
if (SHOTS) { const s = await shot(); if (s) fs.writeFileSync('scripts/_v93_away.png', Buffer.from(s.split(',')[1], 'base64')) }
await page.evaluate(() => { window.__V93.set(true); window.__gridironScene.scene.resume() })
await page.waitForTimeout(3000)

console.log(JSON.stringify({ pass, fail }))
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
