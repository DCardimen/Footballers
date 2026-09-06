// Dev check: v99 THE SHADOWS FALL — one key light post, and everything on the grass casts
// from it. Asserts the key light is a mast that does not sway and never moves, that player
// shadows point away from it and swing as men cross the field, that a taller object throws a
// longer shadow than a short one (and the near end longer than the far), that a man in the
// air leaves his shadow on the ground, that the ball's shadow runs out from under it as it
// climbs, that the goalposts lay a whole H on the end zone, and that the lamps now HOLD
// (one frame, steady output) instead of cycling.
//   node scripts/v99check.mjs        (READ_POS=RB, V99_SHOTS=1 saves scripts/_v99_*.png)
import { chromium } from 'playwright'
import fs from 'node:fs'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const errs = []
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)   // warm: vite's one-time reload after an edit
await page.evaluate(p => { window.__readPos = p }, process.env.READ_POS || 'RB')
async function step(t) { const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
  let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className) || /RUN THIS PLAN|LOCK IT IN|CHOOSE/i.test(txt(e))) : els.find(e => txt(e).includes(t))
  if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis }); console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900) }
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
await page.waitForFunction(() => window.__V99 && window.__V92 && window.__V92.on, null, { timeout: 25000 }).catch(() => {})
await page.waitForTimeout(600)

// ---- the key light: one post, and it is one that does not sway
const S = []
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(600)
  S.push(await page.evaluate(() => { const V = window.__V92 || {}, W = window.__V99 || {}
    const men = []; for (let i = 0; i < 22; i++) { const m = W.man && W.man(i); if (m) men.push(m) }
    const sc = window.__gridironScene
    return { key: W.key ? (k => ({ x: Math.round(k.x), y: Math.round(k.y), i: k.i, on: k.on }))(W.key()) : null,
      towers: V.towerBoxes ? V.towerBoxes().map(t => [t.x, t.frame, t.sway]) : [],
      glow: V.lights ? V.lights().map(l => l.glow.a) : [], men, posts: W.posts ? W.posts() : null,
      ball: W.ball ? W.ball() : null, ballSpr: sc && sc.ballSpr && sc.ballSpr.scene ? { x: Math.round(sc.ballSpr.x), y: Math.round(sc.ballSpr.y) } : null }
  }))
}
const K = S[0].key
console.log('key light:', JSON.stringify(K), ' towers:', JSON.stringify(S[0].towers))
ok(K && K.on, 'the key light is a real mast on the stadium', JSON.stringify(K))
ok(new Set(S.map(s => s.key && s.key.x + ',' + s.key.y)).size === 1, 'the key light never moves', [...new Set(S.map(s => s.key && s.key.x + ',' + s.key.y))].join(' | '))
ok(S[0].towers[K.i] && !S[0].towers[K.i][2], 'the key light is one of the masts that does not sway', `mast ${K.i} sway=${S[0].towers[K.i] && S[0].towers[K.i][2]}`)

// ---- the lamps hold instead of cycling
const frameSets = S[0].towers.map((_, i) => new Set(S.map(s => s.towers[i] && s.towers[i][1])))
ok(frameSets.every(f => f.size === 1), 'every mast holds one lamp frame — no cycling', frameSets.map(f => [...f].join('/')).join(' '))
const glowSets = S[0].glow.map((_, i) => new Set(S.map(s => s.glow[i])))
ok(glowSets.every(g => g.size === 1), 'the light output holds steady — no breathing', glowSets.map(g => [...g][0]).join(' '))

// ---- the men: direction away from the light, and it swings as they cross the field
const frame = S.find(s => s.men.length >= 20) || S[0]
const dirs = frame.men.map(m => {
  const wantX = m.root.x - K.x, wantY = Math.max(30, m.root.y - K.y), d = Math.hypot(wantX, wantY)
  const gotX = Math.cos(m.rot), gotY = Math.sin(m.rot)
  return { dot: (wantX / d) * gotX + (wantY / d) * gotY, rot: m.rot, x: m.root.x, y: m.root.y, sx: m.sx, sy: m.sy, a: m.a }
})
console.log('men:', frame.men.length, 'dot range:', Math.min(...dirs.map(d => d.dot)).toFixed(4), '-', Math.max(...dirs.map(d => d.dot)).toFixed(4))
ok(frame.men.length >= 20, 'both sides are on the field with shadows', `${frame.men.length} shadows`)
ok(dirs.every(d => d.dot > 0.999), 'every shadow points directly away from the key light', `min dot=${Math.min(...dirs.map(d => d.dot)).toFixed(4)}`)
const rots = dirs.map(d => d.rot)
ok(Math.max(...rots) - Math.min(...rots) > 0.12, 'the shadows swing across the field, not one fixed angle', `spread=${(Math.max(...rots) - Math.min(...rots)).toFixed(3)} rad`)
const byY = [...dirs].sort((a, b) => a.y - b.y)
ok(byY[byY.length - 1].sx > byY[0].sx + 0.05, 'a man nearer the camera throws a longer shadow than one up at the far end', `far=${byY[0].sx} near=${byY[byY.length - 1].sx}`)
ok(byY[byY.length - 1].a <= byY[0].a, 'and a softer one', `far a=${byY[0].a} near a=${byY[byY.length - 1].a}`)

// ---- the geometry itself: height in, length out; and a man in the air
const geo = await page.evaluate(() => { const sc = window.__gridironScene, W = window.__V99
  const near = W.cast(360, 1800), far = W.cast(360, 500)
  const m = sc.markers.find(m => m && m.shadow); const sh = m.shadow
  const grounded = (() => { sc.castShadowV99(sh, m.root.x, m.root.y, 21, { lift: 0 }); return { y: +sh.y.toFixed(2), sx: +sh.scaleX.toFixed(3), a: +sh.alpha.toFixed(3) } })()
  const air = (() => { sc.castShadowV99(sh, m.root.x, m.root.y, 21, { lift: 14 }); return { y: +sh.y.toFixed(2), sx: +sh.scaleX.toFixed(3), a: +sh.alpha.toFixed(3) } })()
  const tall = (() => { sc.castShadowV99(sh, m.root.x, m.root.y, 60, { lift: 0 }); return +sh.scaleX.toFixed(3) })()
  const off = (() => { window.RIB_TUNE.shadowsV99 = 0; const r = sc.castShadowV99(sh, m.root.x, m.root.y, 21, {}); delete window.RIB_TUNE.shadowsV99; return r })()
  return { near, far, grounded, air, tall, off } })
console.log('geometry:', JSON.stringify(geo))
ok(geo.near.slope > geo.far.slope * 1.4, 'the light rakes harder the further from it you stand', `far=${geo.far.slope} near=${geo.near.slope}`)
ok(geo.tall > geo.grounded.sx + 0.5, 'a taller object throws a longer shadow from the same spot', `man=${geo.grounded.sx} tall=${geo.tall}`)
ok(geo.air.y > geo.grounded.y + 8 && geo.air.sx < geo.grounded.sx && geo.air.a < geo.grounded.a, 'a man in the air leaves his shadow on the ground, smaller and softer', JSON.stringify([geo.grounded, geo.air]))
ok(geo.off === null, 'shadowsV99=0 switches the whole cast off', String(geo.off))

// ---- the ball climbs away from its shadow (burst-sampled: an arc is over in a heartbeat)
const burst = await page.evaluate(async () => { const out = [], sc = window.__gridironScene
  for (let i = 0; i < 260; i++) { const b = window.__V99.ball(), sp = sc.ballSpr && sc.ballSpr.scene ? { x: sc.ballSpr.x, y: sc.ballSpr.y } : null
    if (b && b.vis && sp) out.push({ bx: Math.round(b.x - sp.x), by: Math.round(b.y - sp.y), d: Math.hypot(b.x - sp.x, b.y - sp.y) })
    await new Promise(r => setTimeout(r, 80)) }
  return out })
const flights = burst.concat(S.filter(s => s.ball && s.ballSpr && s.ball.vis).map(s => ({ d: Math.hypot(s.ball.x - s.ballSpr.x, s.ball.y - s.ballSpr.y), bx: s.ball.x - s.ballSpr.x, by: s.ball.y - s.ballSpr.y })))
const maxFlight = flights.length ? flights.reduce((a, b) => a.d > b.d ? a : b) : null
console.log('ball frames:', flights.length, 'max separation:', maxFlight && maxFlight.d.toFixed(1))
ok(maxFlight && maxFlight.d > 6, 'the ball in the air is separated from its own shadow', maxFlight && `${maxFlight.d.toFixed(1)}px`)
ok(maxFlight && maxFlight.by > 0, 'and the shadow runs out to the camera side, away from the light', maxFlight && `dx=${maxFlight.bx} dy=${maxFlight.by}`)

// ---- the goalposts lay a frame on the grass
const posts = S.map(s => s.posts).filter(Boolean).pop()
console.log('posts:', JSON.stringify(posts))
ok(posts && posts.near && posts.far, 'both goalposts cast', JSON.stringify(posts))
ok(posts && posts.near.len > 60, 'the near frame is thrown right across the end zone', posts && `${posts.near.len}px`)
ok(posts && posts.near.len > posts.far.len * 2, 'the far posts, standing under the light, barely mark the grass', posts && `near=${posts.near.len} far=${posts.far.len}`)
const depths = await page.evaluate(() => { const sc = window.__gridironScene
  return { posts: sc.postShadG && sc.postShadG.depth, goal: sc.goalG && sc.goalG.depth, man: sc.markers[0] && sc.markers[0].root.depth, ball: sc.ballShad && sc.ballShad.depth } })
ok(depths.posts < depths.man && depths.posts < depths.goal, 'the post shadow lies under the players and under the posts themselves', JSON.stringify(depths))

if (process.env.V99_SHOTS) {
  const snap = async (path) => { const src = await page.evaluate(() => new Promise(res => { try { window.__gridironScene.game.renderer.snapshot(img => res(img.src || null)) } catch (e) { res(null) } })); if (src) fs.writeFileSync(path, Buffer.from(src.split(',')[1], 'base64')) }
  await snap('scripts/_v99_play.png')
  await page.evaluate(async () => { const sc = window.__gridironScene, c = sc.cameras.main; sc.scene.pause(); c.setZoom(0.78); c.centerOn(360, 600); await new Promise(r => setTimeout(r, 300)) })
  await snap('scripts/_v99_wide.png')
  await page.evaluate(() => { const sc = window.__gridironScene; sc.scene.resume() })
}
console.log(JSON.stringify({ pass, fail, errors: errs.length }))
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
