// Dev check: v70 PLUMBOB — the you-marker moved off the turf and onto the head.
//
// v18 marked your player with four gold effects on the GROUND: a pulsing glow disc,
// a pulsing ring, four spinning arc segments and a bobbing chevron. The turf is the
// busiest part of the frame (ball, LOS, first-down marker, 21 other pairs of feet)
// and, worse, inside a pile the aura is UNDER the pile. The marker is now a spinning
// crystal in the empty space above the head.
//
// So the claims are: the ground FX are gone, a crystal object exists and sits above
// the sprite, it actually turns (its silhouette changes frame to frame), and it
// changes colour when the player is gassed — a plumbob that carries mood is the
// reason the Sims one works. Also saves a zoomed crop so the shape can be eyeballed.
import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 }, deviceScaleFactor: 3 })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => {
  setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60)
})
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 25000 })
await page.waitForTimeout(1400)

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }

const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  const r = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t === 'ARCH') el = els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
    else el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false
  }, { t, visSrc: vis })
  await page.waitForTimeout(800); return r
}
// the creation flow offers its steps in a different order run to run, so walk it by
// what is on screen rather than by a fixed script
await click('START NEW CAREER')
for (let i = 0; i < 8; i++) {
  const done = await page.evaluate(({ visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    for (const want of ['START YOUR LEGACY', 'Lock In Personality']) {
      const b = els.find(e => txt(e).includes(want)); if (b) { b.click(); return false }
    }
    const card = els.find(e => e.classList.contains('pos-card') || /^[A-Z]{1,2} /.test(txt(e)))
    if (card) { card.click(); return false }
    return true
  }, { visSrc: vis })
  await page.waitForTimeout(500)
  if (done) break
}
for (const s of ['PLAY 8-GAME SEASON', 'Balanced Program', 'PLAY WEEK 1 LIVE']) await click(s)
// the pregame plan rolls on the wheel; run it out and continue into the match
for (let i = 0; i < 40; i++) {
  const done = await page.evaluate(() => {
    const g = document.getElementById('gv42go')
    if (g && g.style.display !== 'none') { g.click(); return false }
    document.getElementById('gv62card')?.click()
    return !document.getElementById('growthV42')
  })
  if (done) break
  await page.waitForTimeout(250)
}
await click('CONTINUE TO MATCH')
await page.waitForTimeout(1500)

// let a play actually run so the markers are live
let scene = null
for (let i = 0; i < 60; i++) {
  scene = await page.evaluate(() => {
    const sc = window.__gridironScene
    if (!sc || !sc.markers || !sc.markers.length) return null
    const me = sc.markers.find(m => m.bob)
    if (!me || !me.root) return null
    return { markers: sc.markers.length, hasBob: !!me.bob, hasGlow: !!me.glow, hasChev: !!me.chev,
      hasSpin: !!me.spin, hasRing: !!me.ring }
  })
  if (scene) break
  await page.waitForTimeout(400)
}
console.log('scene:', JSON.stringify(scene))
ok(!!scene, 'the live field is up and the you-marker carries a crystal')
if (scene) {
  ok(scene.hasBob, 'the you-marker has a plumbob object')
  ok(!scene.hasGlow && !scene.hasChev && !scene.hasSpin,
    'and none of the v18 ground FX survive (glow disc, chevron, spinning arcs)',
    `glow=${scene.hasGlow} chev=${scene.hasChev} spin=${scene.hasSpin}`)
  ok(scene.hasRing, 'the plain foot ring stays — it says where he is standing, it is not an aura')
}

// ---- it sits ABOVE the sprite, and it TURNS
const geom = scene ? await page.evaluate(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms))
  const sc = window.__gridironScene
  const me = sc.markers.find(m => m.bob)
  const above = me.bob.y < me.root.y
  const lift = +(me.root.y - me.bob.y).toFixed(1)
  const depth = me.bob.depth
  // the silhouette IS the rotation, so sample the drawn half-width over time. The
  // draw records it (a command buffer cannot be read back into a shape).
  const ws = []
  for (let i = 0; i < 20; i++) { ws.push(+(me.bob._bobW || 0).toFixed(2)); await wait(80) }
  return { above, lift, depth, ws, spread: +(Math.max(...ws) - Math.min(...ws)).toFixed(2) }
}) : { above: false, lift: 0, depth: 0, ws: [], spread: 0 }
console.log('geometry:', JSON.stringify(geom))
ok(geom.above && geom.lift > 12, 'the crystal floats above the head, in the empty part of the frame',
  '+' + geom.lift + 'px above the sprite root')
ok(geom.depth >= 20, 'it draws over the players, so a pile cannot bury it', 'depth ' + geom.depth)
ok(geom.spread > 1, 'it turns — the silhouette changes frame to frame, it is not a static badge',
  'width swings ' + geom.spread + 'px across ' + geom.ws.length + ' samples')

// ---- the mood tint
const mood = scene ? await page.evaluate(async () => {
  const sc = window.__gridironScene
  const me = sc.markers.find(m => m.bob)
  const shot = () => { const g = sc.add.graphics(); sc.drawPlumbob(g, 1000, 1, false)
    const cool = (g.commandBuffer || []).filter(c => typeof c === 'number' && c > 0x100000)
    g.destroy(); return cool.slice() }
  const shotHot = () => { const g = sc.add.graphics(); sc.drawPlumbob(g, 1000, 1, true)
    const hot = (g.commandBuffer || []).filter(c => typeof c === 'number' && c > 0x100000)
    g.destroy(); return hot.slice() }
  const a = shot(), b = shotHot()
  return { cool: a.map(n => n.toString(16)), hot: b.map(n => n.toString(16)),
    differs: a.length === b.length && a.some((v, i) => v !== b[i]) }
}) : { cool: [], hot: [], differs: false }
console.log('mood:', JSON.stringify(mood))
ok(mood.differs, 'a gassed player gets a different crystal — the marker carries mood, not just identity',
  'cool ' + mood.cool.join(',') + ' vs hot ' + mood.hot.join(','))

// ---- a zoomed crop of the crystal, for the eye
const box = scene ? await page.evaluate(() => {
  const sc = window.__gridironScene
  const me = sc.markers.find(m => m.bob)
  const cv = sc.game.canvas, r = cv.getBoundingClientRect()
  const kx = r.width / cv.width, ky = r.height / cv.height
  const cx = r.left + me.bob.x * kx, cy = r.top + me.bob.y * ky
  const x = Math.max(0, Math.min(innerWidth - 76, cx - 38)), y = Math.max(0, Math.min(innerHeight - 68, cy - 34))
  return { x, y, width: 76, height: 68 }
}) : null
if (box) try { await page.screenshot({ path: 'scripts/_bob_zoom.png', clip: box }) } catch (e) { console.log('crop skipped:', e.message) }
await page.screenshot({ path: 'scripts/_bob_field.png' })

console.log('page errors:', errs.length ? '\n' + errs.join('\n') : 'NONE')
console.log('VERDICT: ' + (fail === 0 && errs.length === 0 ? 'PASS' : 'FAIL') + `  (${pass} ok, ${fail} failed)`)
await browser.close()
process.exitCode = fail === 0 && errs.length === 0 ? 0 : 1
