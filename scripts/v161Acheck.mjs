// Dev check: v161 A — THEY CELEBRATE LIKE THEY MEAN IT (src/28-cosmetics.js + src/05-field-renderer.js), at a 400x860 phone:
//   1. the art: public/celebrations/ loads — the manifest (3 animations x 12 frames = 36, each with a rect, a foot anchor,
//      a centre of mass, a helmet), both atlases and the skin masks; grounded frames stand ON their anchor (the lowest
//      body row is the ground line, within 1 px) and the repeated stances keep their feet within 1 px of each other
//   2. the kit: a frame recoloured to a red / white kit has a red jersey (no navy left), white pants, and its skin and
//      ball untouched
//   3. the choice: the pick is deterministic from the play's token (same token → same body), all three appear over a set
//      of tokens, and picking spends no Math.random
//   4. the motion (pure functions of t): the backflip's height follows ONE parabola over the air (a fit of 4h·u(1-u)),
//      its spin increases monotonically through the air (0 → 360) and the drawn frames run 3 → 8 in order; the spike's
//      hop is an arc, its ball bounces with decreasing apexes and moves one way, the impact has a dirt burst and a flash;
//      the flex stomps with dust; the segment timings sum to the planned length (2.2-3.0 s); reduced motion → one calm
//      pose (the last frame), no arc / spin / particles / ball
//   5. the Locker: the celebration previews play the drawn bodies (all three appear across the tiles / loops), with the
//      "picked at random" note
//   6. the live field: a forced touchdown by HIM plays a body (the pick of the play's token) on his marker in his kit (a
//      non-navy uniform and helmet: the frame texture's jersey is the kit's), v159 C's layer still plays and its pose
//      stands down, the backflip lifts him and spins, the spike spawns the ball and shakes the camera, the marker is
//      handed back at the end; reduced motion → the calm pose, no shake; no Math.random; a draw-cost bound; frame
//      strips of the three bodies in a red kit go to $SHOTS
//   7. seeded simGameV2 box scores identical with TU v161A off and on; no page errors
//   node scripts/v161Acheck.mjs        (GAME_URL=http://localhost:5173/)
import { chromium } from 'playwright'
import fs from 'node:fs'
import { CHROME, GAME_URL } from './lib/env.mjs'
const SHOTS = process.env.SHOTS || '/tmp/claude-0/shots/'
try { fs.mkdirSync(SHOTS, { recursive: true }) } catch {}
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 400, height: 860 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 4).join(' | ')))
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { setInterval(() => { document.querySelector('.onboard')?.remove() }, 60) })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const E = (fn, arg) => page.evaluate(fn, arg)
const savePng = (name, dataUrl) => { try { fs.writeFileSync(SHOTS + 'v161A-' + name + '.png', Buffer.from(String(dataUrl).split(',')[1], 'base64')) } catch {} }
const boot = async () => {
  await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(1200)
  await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && window.RIB_COSMETICS && window.__V161A && window.__V161A.load, null, { timeout: 60000 })
  await E(() => new Promise(r => { window.__V161A.load(r); setTimeout(r, 15000) }))
}
await boot(); await page.goto(GAME_URL, { waitUntil: 'networkidle' }); await boot()   // warm past vite's one-time reload

// ================= 1. the art =================
const art = await E(() => {
  const V = window.__V161A, M = V.manifest(); if (!M) return { none: true, errs: V.errs }
  const at = new Image(); at.src = window.__RIB_ASSET('celebrations/cel_v161a_1x.png')
  return new Promise(res => { at.onload = () => {
    const c = document.createElement('canvas'); c.width = at.width; c.height = at.height; const x = c.getContext('2d'); x.drawImage(at, 0, 0); const d = x.getImageData(0, 0, at.width, at.height).data
    const out = { anims: Object.keys(M.anims), n: 0, bad: [], feet: {}, ground: [] }
    for (const [name, A] of Object.entries(M.anims)) for (const f of A.frames) {
      out.n++
      if (!(f.r && f.r2 && f.a2 && isFinite(f.ax) && isFinite(f.ay) && isFinite(f.cx) && isFinite(f.cy) && f.helm && f.helm.length === 4)) out.bad.push(name + f.k)
      // the lowest opaque row and the feet's extent (the bottom 22% band) in the frame
      let low = -1, top = 1e9; const [rx, ry, w, h] = f.r
      for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) if (d[((ry + y) * at.width + rx + xx) * 4 + 3] > 200) { if (y > low) low = y; if (y < top) top = y }
      const band = low - Math.max(3, (low - top + 1) * 0.22); let x0 = 1e9, x1 = -1
      for (let y = Math.ceil(band); y <= low; y++) for (let xx = 0; xx < w; xx++) if (d[((ry + y) * at.width + rx + xx) * 4 + 3] > 200) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx }
      if (!f.air) out.ground.push({ f: name + f.k, dy: +(f.ay - (low + 1)).toFixed(2) })
      out.feet[name + f.k] = { fx: +((x0 + x1 + 1) / 2 - f.ax).toFixed(2), fy: +(low + 1 - f.ay).toFixed(2) }
    }
    out.ball = !!(M.anims.spike.ball && M.anims.spike.ballStart); out.atlas = [M.atlas1, M.atlas2]; out.stand = M.stand
    res(out) } })
})
ok(!art.none && art.n === 36 && art.anims.join() === 'flex,backflip,spike' && art.bad.length === 0, 'the manifest loads: 3 animations x 12 frames, each with a rect at 1x / 2x, a foot anchor, a centre of mass and a helmet', { n: art.n, bad: art.bad, atlas: art.atlas })
const offGround = art.ground ? art.ground.filter(g => Math.abs(g.dy) > 1.01) : ['none']
ok(offGround.length === 0 && art.ground.length >= 26, 'every grounded frame stands on its anchor: the lowest body row is the ground line within 1 px (' + (art.ground || []).length + ' frames)', offGround)
const pairs = [['flex9', 'flex10'], ['flex3', 'flex9'], ['flex0', 'flex11'], ['spike9', 'spike11']]
const pd = pairs.map(([a, b]) => ({ a, b, dx: Math.abs(art.feet[a].fx - art.feet[b].fx), dy: Math.abs(art.feet[a].fy - art.feet[b].fy) }))
ok(pd.every(p => p.dx <= 1.01 && p.dy <= 1.01), 'the stances register: their feet land within 1 px of each other frame to frame', pd)
ok(art.ball, 'the spike carries its loose ball as its own sprite, with where it lay')

// ================= 2. the kit =================
const kit = await E(() => {
  const V = window.__V161A, px = (cv) => cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data
  const hsl = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2, sat = mx ? (mx - mn) / mx : 0; let h = 0
    if (mx !== mn) { if (mx === r) h = (60 * ((g - b) / (mx - mn)) + 360) % 360; else if (mx === g) h = 60 * ((b - r) / (mx - mn)) + 120; else h = 60 * ((r - g) / (mx - mn)) + 240 } return [h, sat, L] }
  const cmp = (name, k, scale) => { const a = px(V.frameCanvas(name, k, scale, null)), b = px(V.frameCanvas(name, k, scale, { p1: '#c82830', p2: '#eeeeee' })), o = { navy: 0, navyRed: 0, gold: 0, goldWhite: 0, ball: 0, ballSame: 0, warm: 0, warmNotKit: 0 }
    for (let i = 0; i < a.length; i += 4) { if (a[i + 3] < 200) continue; const [h, s, L] = hsl(a[i], a[i + 1], a[i + 2]), [h2, s2, L2] = hsl(b[i], b[i + 1], b[i + 2])
      if (h >= 190 && h <= 265 && s > 0.15 && L >= 38) { o.navy++; if ((h2 < 12 || h2 > 345) && s2 > 0.5) o.navyRed++ }
      else if (h >= 33 && h <= 62 && s > 0.3 && L > 60) { o.gold++; if (s2 < 0.12) o.goldWhite++ }
      else if (a[i] >= 70 && a[i] <= 185 && a[i + 1] < a[i] * 0.47 && a[i + 2] <= 22) { o.ball++; if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2]) o.ballSame++ }
      else if (h >= 8 && h < 31 && s > 0.3 && L > 40) { o.warm++; if (h2 >= 8 && h2 < 45 && s2 > 0.2) o.warmNotKit++ } }
    return o }
  return { s0: cmp('spike', 0, 1), f3: cmp('flex', 3, 2), b6: cmp('backflip', 6, 1) }
})
const fr = (a, b) => b ? a / b : 0
ok(['s0', 'f3', 'b6'].every(k => kit[k].navy > 100 && fr(kit[k].navyRed, kit[k].navy) > 0.9), 'the recolour puts him in his kit: the navy jersey and helmet come out the kit\'s red (1x and 2x, upright and inverted)', kit)
ok(['s0', 'f3', 'b6'].every(k => kit[k].gold > 50 && fr(kit[k].goldWhite, kit[k].gold) > 0.9), 'the gold pants take the kit\'s white', ['s0', 'f3', 'b6'].map(k => [kit[k].goldWhite, kit[k].gold]))
ok(kit.s0.ball > 15 && fr(kit.s0.ballSame, kit.s0.ball) > 0.85 && ['s0', 'f3'].every(k => kit[k].warm > 30 && fr(kit[k].warmNotKit, kit[k].warm) > 0.9), 'his skin keeps a skin tone and the ball its leather — neither takes the kit', { ball: [kit.s0.ballSame, kit.s0.ball], skin: ['s0', 'f3'].map(k => [kit[k].warmNotKit, kit[k].warm]) })

// ================= 3. the choice =================
const pick = await E(() => {
  const V = window.__V161A; let rnd = 0; const orig = Math.random; Math.random = function () { rnd++; return orig.apply(this, arguments) }
  const toks = []; for (let i = 0; i < 60; i++) toks.push(1000 + i * 37)
  let a, b; try { a = toks.map(t => V.pick(t)); b = toks.map(t => V.pick(t)) } finally { Math.random = orig }
  const c = {}; a.forEach(n => c[n] = (c[n] || 0) + 1)
  return { same: a.join() === b.join(), counts: c, rnd }
})
ok(pick.same, 'the same play token always picks the same body')
ok(Object.keys(pick.counts).length === 3 && Object.values(pick.counts).every(v => v >= 8), 'over 60 plays all three bodies appear', pick.counts)
ok(pick.rnd === 0, 'the pick spends no Math.random', pick.rnd)

// ================= 4. the motion =================
const mo = await E(() => {
  const V = window.__V161A, out = {}
  let rnd = 0; const orig = Math.random; Math.random = function () { rnd++; return orig.apply(this, arguments) }
  try {
    for (const n of V.anims) { const T = V.timeline(n); out['tl_' + n] = { total: Math.round(T.total), sum: Math.round(T.segs.reduce((a, s) => a + s.ms, 0)), segs: T.segs } }
    // the backflip's air
    const B = V.timeline('backflip'), air = B.land - B.takeoff, S = []
    for (let i = 0; i <= 40; i++) { const t = B.takeoff + air * i / 40, o = V.pose('backflip', t); S.push({ u: i / 40, lift: o.lift, phi: o.phi, k: o.k, air: o.air }) }
    const peak = Math.max(...S.map(s => s.lift)), resid = Math.max(...S.map(s => Math.abs(s.lift - peak * 4 * s.u * (1 - s.u))))
    let mono = true; for (let i = 1; i < S.length; i++) if (S[i].air && S[i - 1].air && S[i].phi < S[i - 1].phi) mono = false
    let order = true; const ks = S.filter(s => s.air).map(s => s.k); for (let i = 1; i < ks.length; i++) if (ks[i] < ks[i - 1]) order = false
    const pre = V.pose('backflip', B.takeoff - 30), post = V.pose('backflip', B.land + 30), land = V.pose('backflip', B.land + 40)
    out.flip = { peak: +peak.toFixed(1), resid: +resid.toFixed(3), mono, order, frames: [...new Set(ks)], phiEnd: +S[S.length - 2].phi.toFixed(0), pre: pre.lift, post: post.lift, landSquash: +(1 - land.sy).toFixed(3), shadowAtPeak: +V.pose('backflip', B.takeoff + air / 2).sh.toFixed(2) }
    // the spike
    const P = V.timeline('spike'), leap = P.segs.find(s => s.tag === 'leap'), L = []
    for (let i = 0; i <= 10; i++) L.push(V.pose('spike', leap.t0 + leap.ms * i / 10).lift)
    const fl = V.flights('spike'), ap = fl.map(f => f.apex)
    const bx = []; for (let t = P.release; t < P.total; t += 40) { const b = V.ball('spike', t); if (b) bx.push(b.x) }
    const parts = V.parts('spike', 7), fparts = V.parts('flex', 7), bparts = V.parts('backflip', 7)
    out.spike = { hop: L.map(v => +v.toFixed(1)), hopPeak: Math.max(...L), apexes: ap, decreasing: ap.every((a, i) => i === 0 || a < ap[i - 1]), ballBefore: V.ball('spike', P.release - 20), ballOneWay: bx.every((x, i) => i === 0 || x >= bx[i - 1] - 1e-6), ballN: bx.length,
      dirt: parts.filter(p => p.kind === 'dirt' && Math.abs(p.t0 - P.impact) < 40).length, flash: parts.filter(p => p.kind === 'flash').length, dust: { flex: fparts.filter(p => p.kind === 'dust').length, flip: bparts.filter(p => p.kind === 'dust').length } }
    // reduced motion
    out.calm = V.anims.map(n => { const T = V.timeline(n, true), o = V.pose(n, T.total / 2, true); return { n, total: T.total, k: o.k, lift: o.lift, rot: o.rot, sy: o.sy, parts: V.parts(n, 7, true).length, ball: V.ball(n, T.total / 2, true) } })
  } finally { Math.random = orig }
  out.rnd = rnd; out.errs = V.errs
  return out
})
for (const n of ['flex', 'backflip', 'spike']) console.log('     timing ' + n + ': ' + mo['tl_' + n].segs.map(s => s.k + '=' + s.ms + (s.tag ? '(' + s.tag + ')' : '')).join(' ') + '  = ' + mo['tl_' + n].total + ' ms')
ok(['flex', 'backflip', 'spike'].every(n => Math.abs(mo['tl_' + n].total - mo['tl_' + n].sum) <= 1 && mo['tl_' + n].total >= 2200 && mo['tl_' + n].total <= 3000), 'each body\'s segment timings sum to its planned length, 2.2-3.0 s', { flex: mo.tl_flex.total, backflip: mo.tl_backflip.total, spike: mo.tl_spike.total })
ok(mo.flip.peak > 40 && mo.flip.resid < 0.05 && mo.flip.pre === 0 && mo.flip.post === 0, 'the backflip\'s height follows one parabola over the air (peak ' + mo.flip.peak + ' px, fit residual ' + mo.flip.resid + ')', mo.flip)
ok(mo.flip.mono && mo.flip.phiEnd > 330 && mo.flip.order && mo.flip.frames.length >= 5, 'its spin increases monotonically through the air to a full turn, the drawn frames in order', { frames: mo.flip.frames, phiEnd: mo.flip.phiEnd })
ok(mo.flip.landSquash > 0.05 && mo.flip.shadowAtPeak < 0.7, 'a squash on landing, and his shadow shrinks while he is up', { squash: mo.flip.landSquash, shadow: mo.flip.shadowAtPeak })
ok(mo.spike.hopPeak > 6 && mo.spike.hop[0] < 0.01 && mo.spike.hop[10] < 0.01, 'the spike\'s leap is an arc that lands on the slam', mo.spike.hop)
ok(mo.spike.ballBefore === null && mo.spike.apexes.length >= 3 && mo.spike.decreasing && mo.spike.ballOneWay && mo.spike.ballN > 10, 'the ball is its own sprite from the frame it leaves his hand and bounces with decreasing height, one way', { apexes: mo.spike.apexes })
ok(mo.spike.dirt >= 10 && mo.spike.flash === 1 && mo.spike.dust.flex >= 6 && mo.spike.dust.flip >= 12, 'the slam throws a dirt burst and a flash; the stomp and the flip kick up dust', mo.spike)
ok(mo.calm.every(c => c.k === 11 && c.lift === 0 && c.rot === 0 && c.parts === 0 && c.ball === null && c.total <= 1500), 'reduced motion: one calm pose (the last frame) — no arc, spin, particles or ball', mo.calm)
ok(mo.rnd === 0 && mo.errs.length === 0, 'the motion spends no Math.random', { rnd: mo.rnd, errs: mo.errs })

// ================= 5. the Locker =================
await E(() => { (window.RIB_TUNE = window.RIB_TUNE || {}).v156Ccos = 0 })
await E(() => window.go('locker')); await page.waitForTimeout(900)
await E(() => { const t = document.querySelector('.hubv75-tab[data-sec="style"]'); t && t.click() }); await page.waitForTimeout(500)
await E(() => { window.cosCatV151B && window.cosCatV151B('celebration') }); await page.waitForTimeout(2600)
const lk = await E(async () => { const seen = new Set(); for (let i = 0; i < 12; i++) { window.__V161A.previewList().forEach(r => { if (r.connected && r.body) seen.add(r.body.name) }); await new Promise(r => setTimeout(r, 250)) }
  return { note: !!document.querySelector('.cos-note-v161a'), seen: [...seen], n: window.__V161A.previewList().filter(r => r.connected).length, pf: window.__V161A.prevFrames } })
ok(lk.note && lk.seen.length === 3 && lk.pf > 20, 'the Locker previews play the drawn bodies (all three across the tiles), with the "picked at random" note', lk)
try { const box = await E(() => { const r = document.querySelector('.cos-style-v151b').getBoundingClientRect(); return { x: 0, y: Math.max(0, r.top), width: 400, height: Math.min(560, 860 - Math.max(0, r.top)) } }); await page.screenshot({ path: SHOTS + 'v161A-locker.png', clip: box }) } catch {}
{ const strip = await E(async () => { const cvs = [...document.querySelectorAll('.cos-item-v151b canvas.cos-cel-v159c')].slice(0, 3), out = document.createElement('canvas'), n = 10, W = 192, H = 180; out.width = W * n; out.height = H * cvs.length
    const x = out.getContext('2d'); x.fillStyle = '#10151e'; x.fillRect(0, 0, out.width, out.height)
    for (let f = 0; f < n; f++) { cvs.forEach((c, i) => x.drawImage(c, f * W, i * H, W, H)); await new Promise(r => setTimeout(r, 260)) }
    return out.toDataURL() }); savePng('locker-preview-strip', strip) }

// ================= 6. the live field =================
await page.evaluate(p => { window.__readPos = p }, 'RB')
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function step(t) {
  const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
      : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis })
  await page.waitForTimeout(t === 'PLAN' ? 3000 : 800); return r
}
await E(() => window.go('menu')); await page.waitForTimeout(800)
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
let scene = false
for (let i = 0; i < 150; i++) { scene = await E(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.some(m => m && m.team === 'you'))); if (scene) break
  await E(() => { const g = document.getElementById('gv42go'); if (g && g.offsetParent) g.click() })
  if (i === 20 || i === 50 || i === 90) { await step('CONTINUE TO MATCH'); await step('Continue') }
  await page.waitForTimeout(500) }
if (!scene) scene = await E(() => { const sc = window.__gridironScene; return !!(sc && sc.markers && sc.markers.length >= 12) })
ok(scene, 'a new career reached the live field')
if (!scene) { console.log(JSON.stringify({ pass, fail, errors: errs.length })); await browser.close(); process.exit(1) }
await page.waitForTimeout(1500)
const yi = await E(() => { const sc = window.__gridironScene; let i = sc.markers.findIndex(m => m && m.team === 'you' && m.root); if (i < 0) { try { sc.highlight(sc.markers[5], true) } catch (e) {} i = sc.markers.findIndex(m => m && m.team === 'you' && m.root); if (i < 0) i = 5 } return i })
// dress him in a red uniform and a white helmet with a red stripe (the recolour has to show)
await E(() => { const C = window.RIB_COSMETICS, T = (window.RIB_TUNE = window.RIB_TUNE || {}); T.cosKitClashV151B = 0
  C.grant('uni_crimson_chev', 'pass'); C.equip('uniform', 'uni_crimson_chev'); C.grant('hel_gloss_white', 'pass'); C.equip('helmet', 'hel_gloss_white'); window.__COS_FIELD_V151B.resync(window.__gridironScene) })
await E(() => { const sc = window.__gridironScene; if (!window.__updV161A) { window.__updV161A = [sc.update, sc.killAllFx, sc.animatePlay]; sc.update = function () {}; sc.killAllFx = function () {}; sc.animatePlay = function () {} } })   // hold the broadcast: no next play clears it or starts
const live = await E(async (yi) => {
  const sc = window.__gridironScene, m = sc.markers[yi], V = window.__V161A, P = sc.play || (sc.play = { payload: {}, t: 0 }), keep = P.carrierId, tokKeep = P.__ballTokenV1514
  P.carrierId = yi; P.__ballTokenV1514 = 4242
  let rnd = 0; const orig = Math.random; Math.random = function () { rnd++; return orig.apply(this, arguments) }
  const shakes = []; const cam = sc.cameras.main, sh0 = cam.shake; cam.shake = function () { shakes.push([...arguments]); return sh0.apply(this, arguments) }
  try { window.RIB_COSMETICS.celebrate(sc, m.root.x, m.root.y, m) } finally { Math.random = orig }
  const run = V.active, want = V.pick(4242), body0 = m.body.texture.key, root0 = { x: m.root.x, y: m.root.y }
  const c159 = window.__V159C.active
  // the texture he wears is in his kit: sample its jersey
  const src = sc.textures.get(body0).getSourceImage(), d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data
  let red = 0, navy = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2
    if (r > 100 && g < 80 && b < 90 && r > g * 1.7) red++; else if (L >= 38 && b > r + 25 && b > g + 5 && r < 90) navy++ }   // lit navy (the art's dark outline stays dark, as on every field cell)
  await new Promise(r => { const w = () => (!run.alive ? r() : setTimeout(w, 60)); setTimeout(w, 200) })
  cam.shake = sh0; P.carrierId = keep; P.__ballTokenV1514 = tokKeep
  const lifts = run.lifts, maxLift = Math.max(...lifts), ks = [...new Set(run.seq.map(s => s.k))]
  return { name: run.name, want, key0: body0, red, navy, ended: run.ended, frames: run.frames, ks, maxLift, maxRot: Math.max(...run.rots), balls: run.balls.length, shake: run.shake, shakes: shakes.length, rnd,
    c159: c159 ? { kind: c159.kind, skipped: c159.body161 || 0, pose: c159.pose } : null, back: { tex: m.body.texture.key, ox: m.body.originX, sx: m.body.scaleX, rot: m.body.rotation, y: m.root.y, shadow: m.shadow.y },
    med: run.ms.slice().sort((a, b) => a - b)[run.ms.length >> 1] || 0, avg: run.drawMs / Math.max(1, run.frames), max: run.drawMax, build: V.buildMs, errs: V.errs, total: Math.round(run.total) } }, yi)
ok(live.name === live.want && /^cel161_/.test(live.key0), 'a forced touchdown by HIM plays the body the play\'s token picks (' + live.name + ') on his marker', { name: live.name, want: live.want, tex: live.key0 })
ok(live.red > 60 && live.navy < live.red * 0.08, 'he celebrates in the kit he played in: the frame\'s jersey is the red uniform', { red: live.red, navy: live.navy })
ok(live.c159 && live.c159.skipped > 5, 'v159 C\'s equipped effect still plays around him, its squash / hop standing down for the body', live.c159)
ok(live.ended === 'done' && live.frames > 20 && live.ks.length >= 8, 'the body ran its frames (' + live.ks.length + ' drawn frames over ' + live.frames + ' ticks) and ended by itself', { ks: live.ks, ended: live.ended })
ok(/^spr_/.test(live.back.tex) || live.back.tex === 'rib_player_fallback' || live.back.ox === 0.5 && live.back.sx === 1 && live.back.rot === 0, 'the marker is handed back at the end (origin, scale, rotation; placeMarker re-dresses him)', live.back)
ok(live.rnd === 0 && live.errs.length === 0, 'the field celebration spends no Math.random and raised no error', { rnd: live.rnd, errs: live.errs })
ok(live.med < 1.5 && live.avg < 3 && live.build < 80, 'the draw cost stays inside the frame: median ' + live.med.toFixed(2) + ' ms, avg ' + live.avg.toFixed(2) + ' ms, max ' + live.max.toFixed(1) + ' ms; the kit\'s textures built in ' + live.build + ' ms', { med: live.med, avg: live.avg, build: live.build })
// each body on the field: the flip lifts and spins, the spike shakes and throws the ball; strips at fixed t
const each = await E(async (yi) => { const sc = window.__gridironScene, m = sc.markers[yi], V = window.__V161A, cv = sc.game.canvas, out = {}
  const shakes = []; const cam = sc.cameras.main, sh0 = cam.shake; cam.shake = function () { shakes.push(1); return sh0.apply(this, arguments) }
  for (const name of V.anims) {
    shakes.length = 0; const run = V.play(sc, m, { name, tok: 'strip' })
    await new Promise(r => { const w = () => (!run.alive ? r() : setTimeout(w, 60)); setTimeout(w, 200) })
    const res = { maxLift: Math.max(...run.lifts), maxRot: Math.max(...run.rots), balls: run.balls.length, ballKs: [...new Set(run.balls.map(b => b.k))].length, shake: shakes.length, ended: run.ended, maxLive: run.maxLive }
    // the strip: twelve times through the body, held
    const T = V.timeline(name), ts = []; T.segs.forEach(s => { if (s.k === 'air') { for (let i = 0; i < 6; i++) ts.push(s.t0 + s.ms * (i + 0.5) / 6) } else ts.push(s.t0 + Math.min(s.ms * 0.5, 90)) })
    const z0 = cam.zoom, sc0 = [cam.scrollX, cam.scrollY], fx = m.root.x, fy = m.root.y - 34 * m.root.scaleY; cam.setZoom(z0 * 3.2); cam.centerOn(fx, fy)   // a close-up on his spot (the ground stays put, he leaves it)
    const run2 = V.play(sc, m, { name, tok: 'strip' }), W = 170, H = 230, Z = 1, c = document.createElement('canvas'); c.width = W * Z * ts.length; c.height = H * Z; const x = c.getContext('2d'); x.imageSmoothingEnabled = false
    x.fillStyle = '#000'; for (let k = 0; k < ts.length; k++) { run2.setHold(ts[k]); cam.setZoom(z0 * 3.2); cam.centerOn(fx, fy); await new Promise(r => setTimeout(r, 70)); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      const z = cam.zoom, sx = (fx - cam.worldView.x) * z, sy = (fy + 34 * m.root.scaleY - cam.worldView.y) * z
      const kx = cv.width / (sc.scale ? sc.scale.width : cv.width); x.drawImage(cv, (sx - W / 2) * kx, (sy - H * 0.78) * kx, W * kx, H * kx, k * W * Z, 0, W * Z, H * Z); x.fillStyle = '#fff'; x.font = '15px monospace'; x.fillText(Math.round(ts[k]) + 'ms', k * W * Z + 4, 16) }
    run2.setHold(null); run2.stop('strip'); cam.setZoom(z0); cam.setScroll(sc0[0], sc0[1]); res.strip = c.toDataURL(); out[name] = res }
  cam.shake = sh0
  // reduced motion on the field
  const rc = V.play(sc, m, { name: 'spike', tok: 'calm', calm: true }); shakes.length = 0; cam.shake = function () { shakes.push(1); return sh0.apply(this, arguments) }
  await new Promise(r => { const w = () => (!rc.alive ? r() : setTimeout(w, 60)); setTimeout(w, 200) }); cam.shake = sh0
  out.calm = { ks: [...new Set(rc.seq.map(s => s.k))], maxLift: Math.max(...rc.lifts), shake: rc.shake, camShakes: shakes.length, balls: rc.balls.length, maxLive: rc.maxLive, total: rc.total }
  return out }, yi)
for (const n of ['flex', 'backflip', 'spike']) { savePng('field-strip-' + n, each[n].strip); delete each[n].strip }
ok(each.backflip.maxLift > 40 && each.backflip.maxRot > 330, 'on the field the backflip lifts him (' + each.backflip.maxLift.toFixed(0) + ' px) and turns him a full circle', each.backflip)
ok(each.spike.balls > 20 && each.spike.ballKs >= 3 && each.spike.shake >= 1 && each.spike.maxLive >= 10, 'the spike throws the ball (it bounces on) and the slam shakes the camera', each.spike)
ok(each.flex.ended === 'done' && each.flex.shake >= 1 && each.flex.balls > 5, 'the flex stomps (a small shake) and tosses the ball aside', each.flex)
ok(each.calm.ks.join() === '11' && each.calm.maxLift === 0 && each.calm.shake === 0 && each.calm.balls === 0 && each.calm.maxLive === 0, 'reduced motion on the field: the calm pose, no arc, no shake, no ball', each.calm)
await E(() => { const sc = window.__gridironScene; if (window.__updV161A) { sc.update = window.__updV161A[0]; sc.killAllFx = window.__updV161A[1]; sc.animatePlay = window.__updV161A[2]; delete window.__updV161A } })

// ================= 7. no gameplay change =================
const neutral = await E(() => { const st = window.__getGridironState(), keep = JSON.stringify(st.player || null)
  const seedRun = () => { let s = 4242; const orig = Math.random; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let v = Math.imul(s ^ s >>> 15, 1 | s); v = v + Math.imul(v ^ v >>> 7, 61 | v) ^ v; return ((v ^ v >>> 14) >>> 0) / 4294967296 }
    const out = []; try { for (let g = 0; g < 6; g++) { const r = window.__simGameV2(50 + g * 4, ['QB', 'RB', 'WR', 'LB'][g % 4]); out.push([r.usScore, r.themScore, r.plays.length, r.team.yds, r.oppTeam.yds]) } } finally { Math.random = orig }
    return JSON.stringify(out) }
  const T = (window.RIB_TUNE = window.RIB_TUNE || {}); T.v161A = 0; const a = seedRun(); st.player = JSON.parse(keep)
  T.v161A = 1; const b = seedRun(); st.player = JSON.parse(keep)
  return { same: a === b, a: a.slice(0, 80) } })
ok(neutral.same, 'seeded games score identically with the celebrations off and on', neutral)

console.log(JSON.stringify({ pass, fail, errors: errs.length }))
console.log('page errors:', errs.length ? errs.slice(0, 8) : 'none')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
