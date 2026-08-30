// Dev check: drive into a live game, then verify the referee crew (v45):
//   - 7 officials exist on the field
//   - they MOVE during a play (not frozen)
//   - a foul spot draws a flag from an official
//   - v49: every pose comes from the officials' own 64px sheet (not the 48px zebra
//     recolor), feet sit on the players' foot line, and the whistle / touchdown /
//     flag / first-down sequences each reach a real texture
//   - screenshots the canvas, plus zoomed crops of one official mid-pose
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

// wait for the Phaser scene + referee crew
let report = null
for (let i = 0; i < 40; i++) {
  report = await page.evaluate(() => {
    const sc = window.__gridironScene
    if (!sc) return { scene: false }
    const refs = sc.refs || []
    return {
      scene: true, hasRefTex: !!(sc.textures && sc.textures.exists('spr_ref_dn_idle')),
      refCount: refs.length, roles: refs.map(r => r.role),
      pos: refs.map(r => ({ x: Math.round(r.sx), y: Math.round(r.sy) })),
      playing: !!sc.play,
    }
  })
  if (report && report.scene && report.refCount >= 7) break
  await page.waitForTimeout(400)
}
console.log('scene report:', JSON.stringify(report))

// sample ref positions across ~2.5s to prove they move during a play
async function snapPos() {
  return page.evaluate(() => (window.__gridironScene?.refs || []).map(r => [Math.round(r.sx), Math.round(r.sy)]))
}
const p0 = await snapPos()
await page.waitForTimeout(1400)
const p1 = await snapPos()
let moved = 0, maxD = 0
if (p0.length && p0.length === p1.length) {
  for (let i = 0; i < p0.length; i++) {
    const d = Math.hypot(p1[i][0] - p0[i][0], p1[i][1] - p0[i][1])
    if (d > 1.5) moved++
    maxD = Math.max(maxD, d)
  }
}
console.log(`refs that moved in 1.4s: ${moved}/${p0.length}  maxDelta=${maxD.toFixed(1)}px`)

// zoomed crops of one official mid-pose, for eyeballing the art
// The match keeps playing while this check runs, so a modal can slide over the
// field between poses — hide whatever is sitting on the canvas before each grab.
async function unmask() {
  return page.evaluate(() => {
    const sc = window.__gridironScene
    const cv = (sc && sc.sys && sc.sys.game && sc.sys.game.canvas) || document.querySelector('canvas')
    if (!cv) return 0
    const r = cv.getBoundingClientRect(), px = r.left + r.width / 2, py = r.top + r.height / 2
    let el = document.elementFromPoint(px, py), n = 0
    for (let i = 0; i < 24 && el && el !== cv && el !== document.body && el !== document.documentElement; i++) {
      el.style.visibility = 'hidden'; n++
      el = document.elementFromPoint(px, py)
    }
    return n
  })
}
async function crop(name, role) {
  await unmask(); await page.waitForTimeout(150); await unmask()
  const box = await page.evaluate(rl => {
    const sc = window.__gridironScene, cam = sc.cameras.main, wv = cam.worldView
    const r = (rl && rl.length <= 2 ? (sc.refs || []).find(f => f.role === rl) : (sc.refs || []).find(f => f.forceState === rl)) || (sc.refs || [])[0]
    const cv = (sc.sys && sc.sys.game && sc.sys.game.canvas) || document.querySelector('canvas'); if (!cv || !r) return null
    const cr = cv.getBoundingClientRect()
    const x = (r.root.x - wv.x) / wv.width * cr.width + cr.left
    const y = (r.root.y - wv.y) / wv.height * cr.height + cr.top
    const S = 46
    return { x: Math.max(0, x - S), y: Math.max(0, y - S), width: S * 2, height: S * 2, tex: r.tex,
      canvas: { l: Math.round(cr.left), t: Math.round(cr.top), w: Math.round(cr.width), h: Math.round(cr.height) },
      world: { x: Math.round(r.root.x), y: Math.round(r.root.y) }, wv: { x: Math.round(wv.x), y: Math.round(wv.y), w: Math.round(wv.width), h: Math.round(wv.height) } }
  }, role)
  if (!box) return console.log('crop', name, 'MISS')
  if (process.env.REF_CROP_DEBUG) { console.log('  box', JSON.stringify(box)); await page.screenshot({ path: `scripts/_ref_page_${name}.png` }) }
  await page.screenshot({ path: `scripts/_ref_${name}.png`, clip: { x: box.x, y: box.y, width: box.width, height: box.height } })
  console.log(`crop ${name}: ${box.tex}`)
}
// each pose is fired on whichever official is nearest, so crop the one actually holding it
const fire = (js) => page.evaluate(j => { const sc = window.__gridironScene; sc.refs.forEach(r => { r.forceState = null }); if (sc.play) sc.play._refWhistled = false; const t = sc.refs[6] || sc.refs[0]; eval(j) }, js)
await page.evaluate(() => (window.__gridironScene.refs || []).forEach(r => { r.forceState = null }))
await page.waitForTimeout(250)
await crop('idle', 'B')
await fire('sc.refSignalTD(t.sx, t.sy)'); await page.waitForTimeout(200); await crop('signal', 'signalSeq')
await fire('sc.refThrowFlag(t.sx + 12, t.sy)'); await page.waitForTimeout(430); await crop('flag', 'throwSeq')
await fire('sc.refWhistle(t.sx, t.sy)'); await page.waitForTimeout(160); await crop('whistle', 'whistleSeq')

// fire a flag through the nearest official at a made-up spot and confirm the throw animates
const flag = await page.evaluate(() => {
  const sc = window.__gridironScene
  if (!sc || !sc.refThrowFlag) return 'no-scene'
  const before = (sc.refs || []).map(r => r.forceState)
  const ok = sc.refThrowFlag(360, 220)
  const after = (sc.refs || []).map(r => r.forceState)
  return { ok, threw: after.filter(s => s === 'throwSeq').length, before, after }
})
console.log('flag throw:', JSON.stringify(flag))

// ---- v71 FLAG FOCUS -------------------------------------------------------
// The crew threw a real flag and the broadcast ignored it: the camera stayed on
// the ball carrier, who by then is standing still, while the thing that changed
// the down happened off to the side at six pixels tall. So: does a flag actually
// take the camera to the official, does the zoom go IN, does he sell it, and does
// the whole thing hand the camera back on its own?
const focus = await page.evaluate(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms))
  const sc = window.__gridironScene
  const cam = sc.cameras.main
  // The focus and the swell both run off the PLAY clock, so the flag has to be
  // thrown into a play with time left on it — fired into the dead time between
  // plays, resetCamera hands the camera straight back and there is nothing to see.
  // So wait for a play with room, throw, and sample; retry if the whistle beat us.
  const out = { attempts: 0, played: false, took: false, target: false, z0: 0, zMax: 0, zEnd: 0,
    dStart: 0, dMin: 1e9, scaleBase: 0, scaleMax: 0, scaleEnd: 0, released: false, emphOff: false, angle: -1 }
  for (let att = 0; att < 8 && out.zMax <= out.z0 * 1.15; att++) {
    out.attempts = att + 1
    sc.endFlagFocus()
    ;(sc.refs || []).forEach(r => { r.forceState = null; r.emphMs = 0 })
    let room = false
    for (let i = 0; i < 150; i++) {
      const P = sc.play
      if (P && P.script && (P.script.duration - P.t) > 2200) { room = true; break }
      await wait(80)
    }
    if (!room) continue
    out.played = true
    const z0 = cam.zoom
    sc.refThrowFlag(360, 220)
    const F = sc._flagCam, ref = F && F.m
    if (!ref) continue
    out.took = true; out.target = true; out.z0 = +z0.toFixed(3); out.zMax = +z0.toFixed(3)
    out.scaleBase = +ref.root.scaleX.toFixed(3)
    out.dStart = +Math.hypot(cam.midPoint.x - ref.root.x, cam.midPoint.y - ref.root.y).toFixed(1)
    out.dMin = out.dStart
    for (let i = 0; i < 24; i++) {
      out.zMax = Math.max(out.zMax, +cam.zoom.toFixed(3))
      out.zEnd = +cam.zoom.toFixed(3)
      if (ref.root) {
        out.dMin = Math.min(out.dMin, +Math.hypot(cam.midPoint.x - ref.root.x, cam.midPoint.y - ref.root.y).toFixed(1))
        out.scaleMax = Math.max(out.scaleMax, +ref.root.scaleX.toFixed(3))
        out.scaleEnd = +ref.root.scaleX.toFixed(3)
      }
      await wait(80)
    }
    await wait(900)
    out.released = !sc._flagCam
    out.emphOff = !ref.emphMs
    out.angle = +Math.abs(ref.root.angle).toFixed(2)
  }
  return out
})
console.log('v71 flag focus:', JSON.stringify(focus))
const f71 = []
const g71 = (c, m, d) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (d !== undefined ? '  ' + d : '')); if (!c) f71.push(m) }
g71(focus.took && focus.target, 'a flag opens a camera focus on the official who threw it', 'attempt ' + focus.attempts)
g71(focus.zMax > focus.z0 * 1.15, 'the camera zooms IN for the call',
  focus.z0 + ' -> ' + focus.zMax)
g71(focus.dMin < focus.dStart, 'and pans onto him', focus.dStart + 'px -> ' + focus.dMin + 'px')
g71(focus.scaleMax > focus.scaleBase * 1.12, 'the official sells it — he swells for the call',
  'base ' + focus.scaleBase + ' peak ' + focus.scaleMax)
g71(focus.scaleEnd < focus.scaleMax * 0.95, '...and settles back, so he is not left permanently bigger',
  'peak ' + focus.scaleMax + ' settled ' + focus.scaleEnd)
g71(focus.released && focus.emphOff && focus.angle < 0.5,
  'the focus hands the camera back on its own clock and leaves nothing behind',
  'flagCam=' + !focus.released + ' emph=' + !focus.emphOff + ' tilt=' + focus.angle)
if (f71.length) { console.log('v71 VERDICT: FAIL'); process.exitCode = 1 } else console.log('v71 VERDICT: PASS')

// ---- v49 REF ART ----------------------------------------------------------
// The crew must be drawn from the officials' own 64px sheet, not the 48px zebra
// recolor of a player, and every pose the renderer can ask for must exist.
const art = await page.evaluate(() => {
  const sc = window.__gridironScene
  const T = sc.textures
  const want = []
  for (const d of ['dn', 'dr', 'sd', 'ur', 'up']) {
    for (let i = 0; i < 8; i++) want.push(`spr_ref_${d}_run${i}`)
    for (let i = 0; i < 4; i++) want.push(`spr_ref_${d}_idle${i}`)
    want.push(`spr_ref_${d}_idle`)
  }
  for (let i = 0; i < 6; i++) { want.push('spr_ref_signal' + i); want.push('spr_ref_throw' + i) }
  for (let i = 0; i < 4; i++) want.push('spr_ref_whistle' + i)
  want.push('spr_ref_point', 'spr_ref_point2', 'spr_ref_whistle_point', 'spr_ref_stand', 'spr_ref_flag')
  const missing = want.filter(k => !T.exists(k))
  const keys = T.getTextureKeys().filter(k => k.startsWith('spr_ref'))
  const notSheet = keys.filter(k => T.get(k).source[0].width !== 64)
  // feet must land on the players' foot line (cell y=51) so a ref and a player
  // standing shoulder to shoulder are planted on the same turf
  const footOf = (key) => {
    const src = T.get(key).source[0].image
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64
    const cx = cv.getContext('2d'); cx.drawImage(src, 0, 0)
    const d = cx.getImageData(0, 0, 64, 64).data
    for (let y = 63; y >= 0; y--) for (let x = 0; x < 64; x++) if (d[(y * 64 + x) * 4 + 3] > 24) return y
    return -1
  }
  return {
    total: keys.length, missing, notSheet,
    feet: ['spr_ref_dn_idle0', 'spr_ref_sd_run3', 'spr_ref_up_run5', 'spr_ref_signal2', 'spr_ref_whistle0'].map(k => k + ':' + footOf(k)),
  }
})
console.log('v49 art:', JSON.stringify({ textures: art.total, missing: art.missing, wrongCellSize: art.notSheet }))
console.log('v49 foot line (want 51):', art.feet.join('  '))

// Drive each signalling sequence and confirm the renderer actually swaps to the
// matching sheet pose — a forceState that never reaches a texture is not a signal.
async function runSeq(call, wantPrefix) {
  // The match is still playing, so a snap can respawn the crew mid-poll and wipe the
  // sequence. Retry a few times and report the first pose that actually reached a texture.
  for (let attempt = 0; attempt < 4; attempt++) {
    const fired = await page.evaluate(c => {
      const sc = window.__gridironScene
      if (!sc || !sc.refs || !sc.refs.length) return 'no-refs'
      sc.refs.forEach(r => { r.forceState = null })
      if (sc.play) { sc.play._refWhistled = false; sc.play._refFdShown = false }   // the whistle is once-per-play by design
      try { return !!(sc[c.fn](c.x, c.y) ?? true) } catch (e) { return 'ERR ' + e.message }
    }, call)
    let seen = null
    for (let i = 0; i < 20 && !seen; i++) {
      seen = await page.evaluate(p => ((window.__gridironScene.refs || []).find(r => (r.tex || '').startsWith(p)) || {}).tex || null, wantPrefix)
      if (!seen) await page.waitForTimeout(50)
    }
    if (seen || fired !== true) { console.log(`${call.fn}: fired=${fired} pose=${seen || 'NEVER'} attempt=${attempt + 1}`); return seen }
  }
  console.log(`${call.fn}: pose=NEVER after 4 attempts`)
  return null
}
const poseTD = await runSeq({ fn: 'refSignalTD', x: 300, y: 200 }, 'spr_ref_signal')
const poseWh = await runSeq({ fn: 'refWhistle', x: 300, y: 200 }, 'spr_ref_whistle')
const poseFl = await runSeq({ fn: 'refThrowFlag', x: 360, y: 240 }, 'spr_ref_throw')
// a score and a dead ball at once must not land on the same official
const spread = await page.evaluate(() => {
  const sc = window.__gridironScene
  sc.refs.forEach(r => { r.forceState = null })
  if (sc.play) sc.play._refWhistled = false
  sc.refSignalTD(300, 200); sc.refWhistle(300, 200)
  return sc.refs.filter(r => r.forceState).map(r => r.role + ':' + r.forceState)
})
console.log('concurrent calls spread across:', JSON.stringify(spread))

// screenshot the canvas region a few times
const box = await page.evaluate(() => { const sc = window.__gridironScene; const c = (sc && sc.sys && sc.sys.game && sc.sys.game.canvas) || document.querySelector('canvas'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height } })
if (box) for (let i = 0; i < 4; i++) { await page.screenshot({ path: `scripts/_ref_${i}.png`, clip: box }); await page.waitForTimeout(500) }

// ---- v49 FALLBACK --------------------------------------------------------
// A sheet that never decodes must degrade to the old zebra recolor, not to blank
// officials: block the asset and the data URL and drive the whole flow again.
const fb = await (async () => {
  const p2 = await browser.newPage({ viewport: { width: 520, height: 900 } })
  const e2 = []
  p2.on('pageerror', e => e2.push('PAGEERROR: ' + e.message))
  await p2.route('**/rib_refs_v49.png', r => r.abort())
  await p2.addInitScript(() => {
    Object.defineProperty(window, '__RIB_REFS_V49', { get: () => 'data:image/png;base64,AAAA', set: () => {} })
    setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60)
  })
  await p2.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 })
  await p2.waitForTimeout(1200)
  for (const t of ['START NEW CAREER', 'ARCH', 'QB Quarterback', 'Lock In Personality', 'PLAY 8-GAME SEASON',
    'Balanced Program', 'PLAY WEEK 1 LIVE', 'CONTINUE TO MATCH']) {
    await p2.evaluate(({ t, visSrc }) => {
      const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
      let el
      if (t === 'ARCH') el = els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
      else el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
      if (el) { el.scrollIntoView({ block: 'center' }); el.click() }
    }, { t, visSrc: vis })
    await p2.waitForTimeout(850)
  }
  for (let i = 0; i < 40; i++) { const n = await p2.evaluate(() => (window.__gridironScene?.refs || []).length); if (n >= 7) break; await p2.waitForTimeout(400) }
  const r = await p2.evaluate(() => {
    const sc = window.__gridironScene
    if (!sc || !sc.refs) return { refs: 0 }
    sc.refs.forEach(f => { f.forceState = null })
    if (sc.play) sc.play._refWhistled = false
    sc.refSignalTD(300, 200); sc.refThrowFlag(340, 220); sc.refWhistle(320, 210)
    return { refs: sc.refs.length, cellSizes: [...new Set(sc.textures.getTextureKeys().filter(k => k.startsWith('spr_ref')).map(k => sc.textures.get(k).source[0].width))] }
  })
  await p2.waitForTimeout(700)
  const poses = await p2.evaluate(() => (window.__gridironScene.refs || []).map(f => f.tex))
  await p2.close()
  return { ...r, poses, blank: poses.filter(t => !t || t === 'rib_player_fallback').length, errs: e2 }
})()
console.log('v49 fallback (sheet blocked):', JSON.stringify({ refs: fb.refs, cellSizes: fb.cellSizes, blank: fb.blank, poses: fb.poses }))
const fbBad = fb.refs !== 7 || fb.blank > 0 || (fb.cellSizes || []).some(w => w !== 48) || fb.errs.length

const bad = art.missing.length || art.notSheet.length || !poseTD || !poseWh || !poseFl || fbBad
console.log('v49 VERDICT:', bad ? 'FAIL' : 'PASS')
console.log('page errors:', errs.length ? '\n' + errs.slice(0, 12).join('\n') : 'NONE')
if (bad || errs.length) process.exitCode = 1
await browser.close()
