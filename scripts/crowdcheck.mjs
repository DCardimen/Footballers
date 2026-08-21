// Dev check: v57 crowd stands. Drives into a live game, then asserts the crowd is
// real geometry that reacts, not a decal:
//   - the sheet decodes and every tier/pose cell is present
//   - sections exist on BOTH sidelines and are actually on screen
//   - the stands RECEDE: a far section is smaller than a near one, and its base
//     sits closer to the field centre line (they converge on the vanishing point)
//   - the stands sit OUTSIDE the sideline, never over the playing surface
//   - crowdCheer raises heat, the roar arrives as a WAVE (near sections first),
//     and heat decays back down afterwards
//   - the cheer layer MOVES while the idle layer stays planted (bleachers do not bob)
//   - a touchdown event reaches the crowd through fireEvent
//   - tiers differ, and the level actually picks one
// Screenshots the field with the crowd idle and mid-roar.
import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => {
  setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60)
})
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(1000)

const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  const ok = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t === 'ARCH') el = els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
    else el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false
  }, { t, visSrc: vis })
  console.log(`>> ${t} -> ${ok ? 'ok' : 'MISS'}`)
  await page.waitForTimeout(850)
}
for (const s of ['START NEW CAREER', 'ARCH', 'QB Quarterback', 'Lock In Personality', 'PLAY 8-GAME SEASON',
  'Balanced Program', 'PLAY WEEK 1 LIVE', 'CONTINUE TO MATCH', 'Continue']) await click(s)

// The career flow does not always present the same screens (a pregame wheel or an
// extra confirm can sit in the way), so rather than trusting a fixed click script,
// keep nudging the obvious forward buttons until the live scene actually exists.
const probe = () => page.evaluate(() => {
  const sc = window.__gridironScene
  if (!sc) return { scene: false, sections: 0 }
  const C = window.__CROWD_V57
  return { scene: true, crowd: !!C, sections: C ? C.sections : 0, tier: C ? C.tier : null, playing: !!sc.play }
})
let boot = await probe()
for (let round = 0; round < 12 && !(boot.scene && boot.sections >= 4); round++) {
  for (const s of ['CONTINUE TO MATCH', 'Continue to Match', 'PLAY WEEK', 'Lock In', 'Continue', 'CONFIRM', 'Next']) {
    boot = await probe(); if (boot.scene && boot.sections >= 4) break
    await click(s)
  }
  boot = await probe()
  if (!(boot.scene && boot.sections >= 4)) await page.waitForTimeout(500)
}
console.log('boot:', JSON.stringify(boot))
if (!boot.scene) {
  console.log('page errors:', errs.length ? '\n' + errs.join('\n') : 'none')
  console.log('\nFAILED: never reached the live field — cannot check the crowd')
  await browser.close(); process.exit(1)
}

const fail = []
const ok = (cond, msg, extra) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg + (extra != null ? '  ' + JSON.stringify(extra) : '')); if (!cond) fail.push(msg) }

ok(!!boot.scene, 'live scene exists')
ok(!!boot.crowd && boot.sections >= 4, 'crowd built with sections', boot.sections)

// ---- geometry: sides, on-screen, receding, outside the sideline
const geom = await page.evaluate(() => {
  const sc = window.__gridironScene, C = sc.crowd
  const secs = C.secs.slice(0, C.built).map(s => ({
    sgn: s.sgn, ux: Math.round(s.ux), k: +s.k.toFixed(3),
    bx: Math.round(s.bx), by: Math.round(s.by), bw: Math.round(s.bw), bh: Math.round(s.bh),
    visIdle: s.spr.idle.visible, visCheer: s.spr.cheer.visible,
    depthIdle: s.spr.idle.depth, depthCheer: s.spr.cheer.depth,
  }))
  const cam = sc.cameras.main
  return {
    secs, built: C.built, tier: C.tier,
    cam: { sx: Math.round(cam.scrollX), sy: Math.round(cam.scrollY), zoom: +cam.zoom.toFixed(3), w: cam.width, h: cam.height },
    fieldDepth: sc.fieldSpr ? sc.fieldSpr.depth : null,
  }
})
const left = geom.secs.filter(s => s.sgn < 0), right = geom.secs.filter(s => s.sgn > 0)
ok(left.length >= 2 && right.length >= 2, 'sections on BOTH sidelines', { left: left.length, right: right.length })
ok(geom.secs.every(s => s.visIdle), 'every section visible')
ok(geom.secs.every(s => s.depthIdle > geom.fieldDepth && s.depthCheer > s.depthIdle),
  'crowd draws above the turf, cheer above idle', { field: geom.fieldDepth, idle: geom.secs[0].depthIdle, cheer: geom.secs[0].depthCheer })

// receding: sort one side by depth ratio k (1 at the LOS row, smaller downfield)
const bySide = right.slice().sort((a, b) => b.k - a.k)
const nearS = bySide[0], farS = bySide[bySide.length - 1]
ok(farS.k < nearS.k, 'far sections have a smaller perspective ratio', { near: nearS.k, far: farS.k })
ok(farS.bh < nearS.bh, 'far section draws SHORTER than the near one (recedes)', { nearH: nearS.bh, farH: farS.bh })
// converge: the far section's box sits nearer the field centre line than the near one
const FWc = 360
const nearOff = Math.abs(nearS.bx - FWc), farOff = Math.abs(farS.bx - FWc)
ok(farOff < nearOff, 'far section converges toward the vanishing point', { nearOff, farOff })

// ---- the stands must never cover the playing surface, and must leave a real
// TEAM AREA between the sideline and the stand's front row (benches, coaches and
// the players not on the field go there). Measured on the DRAWN PIXELS, not the
// bounding box: the band runs diagonally, so its axis-aligned box necessarily
// overhangs the field even when no pixel does.
//
// Note the stand is ALLOWED to cover the LOS / first-down line extension. Those
// markers paint on the ground past the sideline, and ground beyond the stand's
// front row is behind the bleachers — so the stand occluding them is correct, and
// crowdDepth sits above fieldLines to make that happen.
const intrude = await page.evaluate(() => {
  const sc = window.__gridironScene, C = sc.crowd
  const F_TOP = 14, F_BOT = 426, FW = 720, MIDY = 220
  const yAt = (x) => window.__PJ_PROBE(x, MIDY).y
  const dec = yAt(0) > yAt(FW)
  const xAtY = (Y) => {
    let lo = 0, hi = FW
    for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if ((yAt(m) > Y) === dec) lo = m; else hi = m }
    return (lo + hi) / 2
  }
  let overField = 0, minClearWorld = 1e9, samples = 0
  for (let i = 0; i < C.built; i++) {
    const s = C.secs[i], cv = s.cv.idle
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data
    for (let py = 0; py < s.bh; py += 3) {
      const Y = s.by + py, x = xAtY(Y)
      if (x <= 0.5 || x >= FW - 0.5) continue           // past the end lines: no field on this row
      const edge = window.__PJ_PROBE(x, s.sgn < 0 ? F_TOP : F_BOT).x
      const k = window.__PERSPK_PROBE(x) || 1
      for (let px = 0; px < s.bw; px += 2) {
        if (d[((py * cv.width) + px) * 4 + 3] < 40) continue
        const X = s.bx + px
        samples++
        const over = Math.abs(edge - 360) - Math.abs(X - 360)   // >0 means inside the field
        if (over > overField) overField = over
        // convert the screen clearance back to WORLD lateral units, so the team area
        // is measured in yards of sideline rather than in perspective-shrunk pixels
        const clearWorld = -over / (1.30 * 1.45 * k)
        if (clearWorld < minClearWorld) minClearWorld = clearWorld
      }
    }
  }
  return { overField: Math.round(overField), minClearWorld: Math.round(minClearWorld), samples,
    gap: (window.__CROWD_V57 || {}).gap }
})
ok(intrude.samples > 500, 'the intrusion scan actually found crowd pixels', intrude.samples)
ok(intrude.overField <= 2, 'no crowd pixel is drawn over the playing surface (px)', intrude.overField)
// 40 world units is ~5 yards of sideline — enough to stand a bench, a coaching box
// and a row of players in front of the seats.
ok(intrude.minClearWorld >= 40, 'a TEAM AREA is reserved between sideline and stands (world units)',
  { clear: intrude.minClearWorld, gap: intrude.gap })

// ---- depth: the crowd must sit ABOVE fieldLines (so it occludes the marker tips
// rather than being painted over) but BELOW the ground shadows/rings under players.
const depths = await page.evaluate(() => {
  const sc = window.__gridironScene, s = sc.crowd.secs[0]
  return { idle: s.spr.idle.depth, cheer: s.spr.cheer.depth,
    fieldLines: sc.fieldLines ? sc.fieldLines.depth : null, field: sc.fieldSpr ? sc.fieldSpr.depth : null }
})
ok(depths.idle > depths.fieldLines && depths.cheer < 3.5,
  'crowd draws above the LOS/first-down lines and below the players\' ground FX', depths)

// ---- decks must butt up: the cell carries headroom for the cheer pose's raised
// arms, so stacking by cell height instead of the seating pitch leaves transparent
// bands that show up on screen as green stripes of turf running through the crowd.
const seams = await page.evaluate(() => {
  const cv = window.__gridironScene.crowd.strips.idle
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data
  // Measure per-ROW ink coverage, not per-column runs: the art has its own stairwell
  // silhouette, so plenty of individual columns are legitimately transparent partway
  // up. A deck seam is different in kind — it is a band that is empty ACROSS THE
  // WHOLE WIDTH, and that is what puts turf through the middle of the crowd.
  const frac = []
  for (let y = 0; y < cv.height; y++) {
    let n = 0
    for (let x = 0; x < cv.width; x += 3) if (d[((y * cv.width) + x) * 4 + 3] > 40) n++
    frac.push(n / Math.ceil(cv.width / 3))
  }
  let first = -1, last = -1
  for (let y = 0; y < frac.length; y++) if (frac[y] >= 0.5) { if (first < 0) first = y; last = y }
  let worst = 1, worstY = -1
  for (let y = first; y <= last; y++) if (frac[y] < worst) { worst = frac[y]; worstY = y }
  return { minRowInk: +worst.toFixed(3), atRow: worstY, solidSpan: [first, last],
    size: [cv.width, cv.height], decks: (window.__CROWD_V57 || {}).decks }
})
ok(seams.minRowInk >= 0.15, 'no turf shows through between stacked decks (min row ink)', seams)

// ---- cheering: heat rises, arrives as a wave, then decays
const cheer = await page.evaluate(async () => {
  const sc = window.__gridironScene, C = sc.crowd
  for (const s of C.secs) { s.heat = 0; s.pendAmt = 0 }
  const before = C.secs.slice(0, C.built).map(s => s.heat)
  // roar from one end of the field, so the wave has somewhere to travel
  sc.crowdCheer(1, 80)
  const pend = C.secs.slice(0, C.built).map(s => ({ ux: Math.round(s.ux), at: Math.round(s.pendAt - C.t), amt: +s.pendAmt.toFixed(3) }))
  const wait = ms => new Promise(r => setTimeout(r, ms))
  await wait(420)
  const mid = C.secs.slice(0, C.built).map(s => +s.heat.toFixed(3))
  const midAlpha = C.secs.slice(0, C.built).map(s => +s.spr.cheer.alpha.toFixed(3))
  await wait(2600)
  const after = C.secs.slice(0, C.built).map(s => +s.heat.toFixed(3))
  return { before, pend, mid, midAlpha, after }
})
ok(cheer.mid.some(h => h > 0.4), 'crowdCheer raises section heat', { peak: Math.max(...cheer.mid) })
ok(cheer.midAlpha.some(a => a > 0.4), 'cheer layer alpha follows heat (the crossfade actually renders)', { peak: Math.max(...cheer.midAlpha) })
// wave: the section nearest the roar is scheduled before the farthest
const pnear = cheer.pend.reduce((m, p) => Math.abs(p.ux - 80) < Math.abs(m.ux - 80) ? p : m)
const pfar = cheer.pend.reduce((m, p) => Math.abs(p.ux - 80) > Math.abs(m.ux - 80) ? p : m)
ok(pfar.at > pnear.at + 40, 'the roar arrives as a WAVE, near sections first', { near: pnear.at, far: pfar.at })
ok(pnear.amt > pfar.amt, 'the roar is loudest nearest the play', { near: pnear.amt, far: pfar.amt })
ok(Math.max(...cheer.after) < Math.max(...cheer.mid), 'heat decays back down after the roar',
  { peak: Math.max(...cheer.mid), later: Math.max(...cheer.after) })

// ---- movement: the cheer layer moves, the idle layer (the bleachers) does not
const motion = await page.evaluate(async () => {
  const sc = window.__gridironScene, C = sc.crowd
  sc.crowdCheer(1, 360)
  const wait = ms => new Promise(r => setTimeout(r, ms))
  await wait(500)
  const samples = []
  for (let i = 0; i < 14; i++) {
    // offsets from the section's own base box: a snap rebuilding the geometry
    // mid-sample moves the base too, and would otherwise read as animation
    samples.push(C.secs.slice(0, C.built).map(s => ({
      cy: s.spr.cheer.y - s.by, cx: s.spr.cheer.x - s.bx,
      iy: s.spr.idle.y - s.by, ix: s.spr.idle.x - s.bx })))
    await wait(70)
  }
  const spread = (get) => {
    let worst = 0
    for (let k = 0; k < C.built; k++) {
      const v = samples.map(s => get(s[k]))
      worst = Math.max(worst, Math.max(...v) - Math.min(...v))
    }
    return +worst.toFixed(3)
  }
  return { cheerY: spread(o => o.cy), cheerX: spread(o => o.cx), idleY: spread(o => o.iy), idleX: spread(o => o.ix) }
})
ok(motion.cheerY > 0.15, 'the cheering crowd MOVES vertically', motion.cheerY)
ok(motion.cheerX > 0.05, 'the cheering crowd sways horizontally', motion.cheerX)
ok(motion.idleY === 0 && motion.idleX === 0, 'the bleachers themselves never move', { y: motion.idleY, x: motion.idleX })
ok(motion.cheerY < 12, 'the movement stays SLIGHT (px)', motion.cheerY)

// ---- a touchdown reaches the crowd through the real event path
const viaEvent = await page.evaluate(() => {
  const sc = window.__gridironScene, C = sc.crowd
  for (const s of C.secs) { s.heat = 0; s.pendAmt = 0; s.pendAt = 0 }
  const P = sc.play || { payload: { offense: 'us' }, losX: 360 }
  sc.crowdReact({ type: 'td', x: 360 }, P)
  const sched = C.secs.slice(0, C.built).filter(s => s.pendAmt > 0).length
  for (const s of C.secs) { s.heat = 0; s.pendAmt = 0 }
  sc.crowdReact({ type: 'read', x: 360 }, P)      // a non-reaction event must NOT roar
  const noise = C.secs.slice(0, C.built).filter(s => s.pendAmt > 0).length
  return { sched, noise }
})
ok(viaEvent.sched >= 4, 'a touchdown event schedules a roar across the stands', viaEvent.sched)
ok(viaEvent.noise === 0, 'an unremarkable event does not move the crowd', viaEvent.noise)

// ---- tiers: the level picks one, and they really differ.
// Measured as the share of inked pixels that are COLOURED rather than grey. Raw
// alpha mass does not work: every tier draws the same solid bleacher structure, so
// the totals sit within noise of each other. What separates a half-empty
// high-school bleacher from a sold-out deck is how much of that structure is
// covered by people — skin, shirts, flags — and those are the saturated pixels.
const tiers = await page.evaluate(() => {
  const sc = window.__gridironScene
  const out = {}
  for (const t of ['sparse', 'mid', 'packed']) {
    window.__CROWD_TIER = t
    sc.buildCrowd()
    const cv = sc.crowd.strips.idle, d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data
    let ink = 0, col = 0
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 40) continue
      ink++
      const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2])
      if (mx - mn > 26) col++
    }
    out[t] = +(col / Math.max(1, ink)).toFixed(4)
  }
  delete window.__CROWD_TIER
  const byLevel = {}
  const st = window.__GRIDIRON_AUDIT__?.getState?.() || window.o
  const keep = st.player.level
  for (const lv of [0, 4, 8]) { st.player.level = lv; byLevel[lv] = window.__CROWD_TIER_PROBE() }
  st.player.level = keep
  sc.buildCrowd()
  return { peopleShare: out, byLevel }
})
ok(tiers.peopleShare.packed > tiers.peopleShare.mid && tiers.peopleShare.mid > tiers.peopleShare.sparse,
  'the three tiers really differ in how full the stand is', tiers.peopleShare)
ok(tiers.byLevel[0] === 'sparse' && tiers.byLevel[4] === 'mid' && tiers.byLevel[8] === 'packed',
  'the level being played at picks the tier', tiers.byLevel)

// ---- FALLBACK: a sheet that never decodes must leave the pre-v57 look (plain
// edge-extended grass in the margin) and must NOT break the live field.
const fb = await (async () => {
  const p2 = await browser.newPage({ viewport: { width: 520, height: 900 } })
  const e2 = []
  p2.on('pageerror', e => e2.push('PAGEERROR: ' + e.message))
  p2.on('console', m => { if (m.type() === 'error') e2.push('CONSOLE: ' + m.text()) })
  await p2.route('**/rib_crowd_v57.png', r => r.abort())
  await p2.addInitScript(() => {
    Object.defineProperty(window, '__RIB_CROWD_V57', { get: () => 'data:image/png;base64,AAAA', set: () => {} })
    setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60)
  })
  await p2.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 })
  await p2.waitForTimeout(1200)
  for (const t of ['START NEW CAREER', 'ARCH', 'QB Quarterback', 'Lock In Personality', 'PLAY 8-GAME SEASON',
    'Balanced Program', 'PLAY WEEK 1 LIVE', 'CONTINUE TO MATCH', 'Continue']) {
    await p2.evaluate(({ t, visSrc }) => {
      const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
      let el
      if (t === 'ARCH') el = els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
      else el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
      if (el) { el.scrollIntoView({ block: 'center' }); el.click() }
    }, { t, visSrc: vis })
    await p2.waitForTimeout(850)
  }
  for (let i = 0; i < 40; i++) { if (await p2.evaluate(() => !!window.__gridironScene)) break; await p2.waitForTimeout(400) }
  const r = await p2.evaluate(() => {
    const sc = window.__gridironScene
    if (!sc) return { scene: false }
    // the whole reaction surface must be safe to call with no stands at all
    sc.buildCrowd(); sc.crowdCheer(1, 360); sc.crowdReact({ type: 'td', x: 360 }, sc.play || { payload: {} }); sc.updateCrowd(16)
    return { scene: true, crowd: !!sc.crowd, built: sc.crowd ? sc.crowd.built : 0, markers: (sc.markers || []).length, refs: (sc.refs || []).length }
  })
  await p2.waitForTimeout(600)
  await p2.close()
  return { ...r, errs: e2 }
})()
ok(fb.scene, 'the live field still boots with the crowd sheet blocked')
ok(!fb.built, 'no stands are built when the sheet never decodes', fb.built)
ok(fb.markers > 0, 'players still take the field without the crowd sheet', fb.markers)
ok(fb.errs.length === 0, 'a blocked crowd sheet raises no page errors', fb.errs.slice(0, 4))

// ---- screenshots: idle vs mid-roar
const canvasShot = async (name) => {
  const c = await page.$('canvas')
  if (c) await c.screenshot({ path: `scripts/_crowd_${name}.png` })
}
await page.evaluate(() => { const C = window.__gridironScene.crowd; for (const s of C.secs) { s.heat = 0; s.pendAmt = 0 } })
await page.waitForTimeout(120); await canvasShot('idle')
await page.evaluate(() => { const C = window.__gridironScene.crowd; for (const s of C.secs) { s.heat = 1; s.pendAmt = 0 } window.__gridironScene.updateCrowd(16) })
await page.waitForTimeout(120); await canvasShot('cheer')

console.log('\npage errors:', errs.length ? '\n' + errs.join('\n') : 'none')
console.log(JSON.stringify({ tier: geom.tier, sections: geom.built, camera: geom.cam }, null, 1))
if (errs.length) fail.push('page errors')
console.log(fail.length ? `\nFAILED (${fail.length}): ${fail.join(' | ')}` : '\nALL CHECKS PASSED')
await browser.close()
process.exit(fail.length ? 1 : 0)
