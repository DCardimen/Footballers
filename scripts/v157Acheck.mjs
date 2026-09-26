// Dev check: v157 A — WINGS THAT FLAP, CROWNS THAT SHINE (src/28-cosmetics.js), at a 400x860 phone:
//   1. the catalogue: >= 15 new wing items, each its own kind (art key) and its own picture — the rendered pixels
//      hash differently for every wing (old and new), and every new silhouette (alpha mask) is its own; the owner's
//      "harder" split (a few free, some earned — three waaay later — and the flashiest as member looks); angel wings
//      stay the super challenge's and the Career Pass still never draws them
//   2. the Locker's WINGS: every new wing is listed with a drawn preview and the right lock text for its source
//      (free: equips; earned: "🔒 Earn it: …"; member: "🔒 Membership")
//   3. the flap: the pose is a beat then a rest (the angle / squash move inside the beat and are exactly still outside
//      it); a Locker preview's pixels change during a beat and hold still at rest; TU v157Aflap 0 turns it off; with
//      prefers-reduced-motion nothing flaps
//   4. the crowns: every crown (the catalogue's and each pass style) renders without an error, differs from its v153 G
//      art (TU v157Acrown 0), is left-right symmetric (flame excepted), and holds more colours than before
//   5. the profile card: equipped wings flap on the card (its back layer's pixels change in a beat, hold at rest)
//   6. the live field: his wings are on him and flap (their rotation / scale move in a beat, rest between), the crown
//      catches the light (glint frame) on the scene clock, no Math.random from src/28
//   7. seeded games identical with nothing / every look equipped; no page errors
// Screenshots go to $SHOTS (default /tmp/claude-0/shots/).
//   node scripts/v157Acheck.mjs        (GAME_URL=http://localhost:5173/)
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
const boot = async () => {
  await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(1200)
  await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && window.RIB_COSMETICS && window.RIB_SEASONS && window.__V157A, null, { timeout: 60000 })
  await page.waitForTimeout(600)
}
await boot(); await page.goto(GAME_URL, { waitUntil: 'networkidle' }); await boot()   // warm past vite's one-time reload
const shot = async (name) => { try { await page.screenshot({ path: SHOTS + 'v157A-' + name + '.png' }) } catch {} }
// a canvas's pixels as a hash (and its alpha mask's)
await E(() => { window.__hash157 = (cv, alphaOnly) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 2166136261 >>> 0
  for (let i = 0; i < d.length; i += 4) { const v = alphaOnly ? (d[i + 3] > 100 ? 1 : 0) : (d[i] << 24 ^ d[i + 1] << 16 ^ d[i + 2] << 8 ^ d[i + 3]); h ^= v; h = Math.imul(h, 16777619) >>> 0 } return cv.width + 'x' + cv.height + ':' + h } })

// ================= 1. the catalogue =================
const cat = await E(() => { const C = window.RIB_COSMETICS, V = window.__V157A, all = C.catalog(), ids = V.items(), H = window.__hash157
  const wings = all.filter(i => i.cat === 'wings' && i.w), nw = ids.map(id => all.find(i => i.id === id)).filter(Boolean)
  const px = {}, sil = {}; wings.forEach(i => { const a = C.wingArt(i.w, 0); px[i.id] = H(a.cv); sil[i.id] = H(a.cv, true) })
  const src = {}; nw.forEach(i => { src[i.source] = (src[i.source] || []).concat(i.id) })
  const S = window.RIB_SEASONS; let angel = 0; for (let n = 1; n <= 6; n++) { const R = S.rewards('s' + n); R.free.concat(R.premium).forEach(r => { if (r.kind === 'wings' && (r.style === 'angel' || /Angel/.test(r.name))) angel++ }) }
  return { n: nw.length, kinds: new Set(nw.map(i => i.w.kind)).size, oldKinds: nw.filter(i => ['angel', 'seraph', 'bat', 'crystal', 'flame', 'mech', 'pixel', 'monarch'].includes(i.w.kind)).length,
    uniqPx: new Set(wings.filter(i => !/^pass\./.test(i.id)).map(i => px[i.id])).size, nWings: wings.filter(i => !/^pass\./.test(i.id)).length, uniqNew: new Set(nw.map(i => px[i.id])).size, uniqSil: new Set(nw.map(i => sil[i.id])).size,
    clash: nw.filter(i => wings.some(o => o.id !== i.id && px[o.id] === px[i.id])).map(i => i.id), src, rar: nw.map(i => i.rarity),
    ach: nw.filter(i => i.source === 'earned').map(i => i.ach), achOk: nw.filter(i => i.source === 'earned').every(i => C.achievements.some(a => a.id === i.ach) || /legacy300|rings3|rings5|gen5/.test(i.ach)),
    angelSrc: (all.find(i => i.id === 'wings_angel') || {}).source, angel, errs: V.errs.slice() } })
ok(cat.n >= 15 && cat.kinds === cat.n && cat.oldKinds === 0, '>= 15 new wings, each its own new kind (its own art key)', { n: cat.n, kinds: cat.kinds })
ok(cat.uniqNew === cat.n && cat.clash.length === 0 && cat.uniqPx === cat.nWings && cat.uniqSil === cat.n, 'every catalogue wing\'s rendered pixels hash differently (old and new; no new one matches any pass wing either), and every new silhouette is its own', { wings: cat.nWings, uniqPx: cat.uniqPx, uniqSil: cat.uniqSil, clash: cat.clash })
ok((cat.src.free || []).length >= 2 && (cat.src.free || []).length <= 4 && (cat.src.earned || []).length >= 4 && (cat.src.member || []).length >= 7 && (cat.src.member || []).length >= (cat.src.free || []).length && cat.achOk,
  'the harder split: a few plain ones free, some earned (their achievements exist), the flashiest as member looks', { free: cat.src.free, earned: cat.src.earned, member: cat.src.member, ach: cat.ach })
ok(cat.ach.some(a => /rings3|rings5|gen5|legacy300/.test(a)) && cat.rar.filter(r => r === 'mythic').length >= 1, 'a few are earned waaay later (UFF rings, the fifth generation, Legacy medal 300) and the top ones are mythic', { ach: cat.ach, rar: cat.rar })
ok(cat.angelSrc === 'super' && cat.angel === 0, 'Angel Wings stay the super challenge\'s — no Career Pass reward draws them', { src: cat.angelSrc, pass: cat.angel })
ok(cat.errs.length === 0, 'the new art drew without an error', cat.errs)

// a gallery of the new wings (4x) for the eye
const gal = await E(() => { const C = window.RIB_COSMETICS, all = C.catalog(), ids = window.__V157A.items(), S = 4, cw = 60 * S, ch = 30 * S
  const cv = document.createElement('canvas'); cv.width = 4 * cw; cv.height = Math.ceil(ids.length / 4) * ch; const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#243044'; x.fillRect(0, 0, cv.width, cv.height)
  ids.forEach((id, i) => { const it = all.find(q => q.id === id), a = C.wingArt(it.w, 0), gx = (i % 4) * cw, gy = Math.floor(i / 4) * ch, cx = gx + cw / 2, cy = gy + 11 * S
    ;[1, -1].forEach(sd => { x.save(); x.translate(cx + sd * 3 * S, cy); x.scale(sd, 1); x.rotate(-0.32); x.drawImage(a.cv, -a.ax * S, -a.ay * S, a.w * S, a.h * S); x.restore() })
    x.fillStyle = '#c9cfd8'; x.fillRect(cx - 4 * S, cy - 5 * S, 8 * S, 18 * S); x.fillStyle = '#fff'; x.font = '14px sans-serif'; x.fillText(it.name, gx + 6, gy + ch - 8) })
  return cv.toDataURL() })
try { fs.writeFileSync(SHOTS + 'v157A-wings-gallery.png', Buffer.from(gal.split(',')[1], 'base64')) } catch {}

// ================= 2. the Locker's WINGS =================
await E(() => window.go('locker')); await page.waitForTimeout(900)
await E(() => { const t = document.querySelector('.hubv75-tab[data-sec="style"]'); t && t.click() }); await page.waitForTimeout(500)
await E(() => window.cosCatV151B('wings')); await page.waitForTimeout(1100)
const lk = await E(() => { const C = window.RIB_COSMETICS, all = C.catalog(), out = []
  window.__V157A.items().forEach(id => { const it = all.find(i => i.id === id), el = document.querySelector('.cos-item-v151b[data-cos="' + id + '"]'), src = el && el.querySelector('.cos-src-v151b')
    const txt = src ? src.textContent : null, cv = el && el.querySelector('canvas.cos-fl-v153g')
    let ink = 0; if (cv) { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) ink++ }
    const want = it.source === 'free' ? /EQUIP/.test(txt || '') : it.source === 'member' ? /🔒 Membership/.test(txt || '') && el.classList.contains('locked') : it.source === 'earned' ? (C.owned(id) ? /EQUIP/.test(txt || '') : /🔒 Earn it: /.test(txt || '') && el.classList.contains('locked')) : false
    out.push({ id, src: it.source, listed: !!el, txt, ink, want }) })
  return out })
const bad = lk.filter(r => !r.listed || !r.want || r.ink < 60)
ok(bad.length === 0, 'every new wing is listed in the Locker with a drawn preview and the lock text of its source', bad.length ? bad : lk.map(r => r.id + ':' + r.src).join(' '))
await shot('locker-wings')

// ================= 3. the flap =================
const pose = await E(() => { const V = window.__V157A, T = window.RIB_TUNE || {}, P = T.wingFlapPeriodV157A || 3400, D = T.wingFlapMsV157A || 760, beat = [], rest = []
  for (let t = 0; t < P * 2; t += 10) { const p = V.pose(t), ph = t % P; (ph < D ? beat : rest).push(p) }
  const rots = beat.map(p => p.rot), sgn = rots.slice(1).filter((r, i) => (r > 0.02) !== (rots[i] > 0.02)).length
  return { P, D, bMax: Math.max(...rots), bMin: Math.min(...rots), sy: Math.min(...beat.map(p => p.sy)), restStill: rest.every(p => p.rot === 0 && p.sy === 1 && !p.beat), beatOn: beat.filter(p => p.beat).length, sgn, on: V.flapOn() } })
ok(pose.on && pose.P >= 2500 && pose.P <= 5000 && pose.bMax > 0.25 && pose.bMin < -0.15 && pose.sy < 0.95 && pose.restStill && pose.sgn >= 3, 'the pose: every few seconds a quick beat (the wings swing up and down, squash on the downstroke), exactly still between', pose)
// a Locker preview, sampled against the clock through a beat and a rest
const sample = (sel, ms) => E(async ({ sel, ms }) => { const H = window.__hash157, V = window.__V157A, T = window.RIB_TUNE || {}, P = T.wingFlapPeriodV157A || 3400, D = T.wingFlapMsV157A || 760
  const cv = document.querySelector(sel); if (!cv) return null; const beat = new Set(), rest = new Set(); const t0 = performance.now()
  await new Promise(r => { const f = () => { const t = performance.now(), ph = t % P; if (ph > 40 && ph < D - 40) beat.add(H(cv)); else if (ph > D + 120 && ph < P - 40) rest.add(H(cv)); if (t - t0 < ms) requestAnimationFrame(f); else r() }; requestAnimationFrame(f) })
  return { beat: beat.size, rest: rest.size } }, { sel, ms })
const pv = await sample('.cos-item-v151b[data-cos="wings_paper"] canvas.cos-fl-v153g', 7500)
ok(pv && pv.beat >= 3 && pv.rest === 1, 'a Locker preview flaps: its pixels change through a beat and hold still at rest', pv)
await E(() => { (window.RIB_TUNE = window.RIB_TUNE || {}).v157Aflap = 0; window.cosCatV151B('crown'); window.cosCatV151B('wings') }); await page.waitForTimeout(700)
const pvOff = await sample('.cos-item-v151b[data-cos="wings_paper"] canvas.cos-fl-v153g', 3800)
const offPose = await E(() => window.__V157A.pose(200))
ok(pvOff && pvOff.beat <= 1 && pvOff.rest <= 1 && offPose.on === false, 'TU v157Aflap 0: no flap (the v153 G still wings)', { pvOff, offPose })
await E(() => { delete window.RIB_TUNE.v157Aflap })
await page.emulateMedia({ reducedMotion: 'reduce' })
await E(() => { window.cosCatV151B('crown'); window.cosCatV151B('wings') }); await page.waitForTimeout(700)
const pvRm = await sample('.cos-item-v151b[data-cos="wings_paper"] canvas.cos-fl-v153g', 3800)
const rmPose = await E(() => { const V = window.__V157A; let moved = 0; for (let t = 0; t < 4000; t += 20) { const p = V.pose(t); if (p.rot !== 0 || p.sy !== 1) moved++ } return { moved, reduced: V.reduced(), glint: V.glint(10) } })
ok(pvRm && pvRm.beat <= 1 && pvRm.rest <= 1 && rmPose.moved === 0 && rmPose.reduced && rmPose.glint === 0, 'prefers-reduced-motion: nothing flaps and no crown glints', { pvRm, rmPose })
await page.emulateMedia({ reducedMotion: 'no-preference' })

// ================= 4. the crowns =================
const cr = await E(() => { const C = window.RIB_COSMETICS, V = window.__V157A, H = window.__hash157, T = (window.RIB_TUNE = window.RIB_TUNE || {})
  const list = C.catalog().filter(i => i.cat === 'crown' && i.cr).map(i => ({ id: i.id, cr: i.cr }))
  ;[['crown', ['#d9dee6', '#1f5fbf', '#4a5260']], ['king', ['#ffd76f', '#c8102e', '#6b4a0e']], ['halo', ['#bfe6ff', '#ffffff', '#3a7fbf']], ['laurel', ['#ffd76f', '#b8903a', '#5a4210']], ['circlet', ['#f0bb45', '#3fbf7f', '#6b4a0e']],
    ['horns', ['#ff5a1a', '#5c0f16', '#1a0508']], ['flame', ['#e0f7ff', '#6fd3ff', '#1f6fff']], ['star', ['#ffd76f', '#ffffff', '#5a4210']]].forEach(v => list.push({ id: 'style:' + v[0], cr: { kind: v[0], col: v[1] } }))
  const colours = cv => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, s = new Set(); for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) s.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); return s.size }
  const sym = cv => { const W = cv.width, Hh = cv.height, d = cv.getContext('2d').getImageData(0, 0, W, Hh).data; let bad = 0; for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) if ((d[(y * W + x) * 4 + 3] > 100) !== (d[(y * W + W - 1 - x) * 4 + 3] > 100)) bad++; return bad }
  const out = list.map(c => { let nw = null, old = null, err = null
    try { delete T.v157Acrown; nw = C.crownArt(c.cr, 0); T.v157Acrown = 0; old = C.crownArt(c.cr, 0); delete T.v157Acrown } catch (e) { err = String(e) }
    return { id: c.id, kind: c.cr.kind, err, key: nw && nw.key, differs: !!(nw && old && H(nw.cv) !== H(old.cv)), cols: nw ? colours(nw.cv) : 0, oldCols: old ? colours(old.cv) : 0, asym: nw ? sym(nw.cv) : -1, w: nw && nw.w, h: nw && nw.h } })
  const gl = C.crownArt(list[0].cr, 2), g0 = C.crownArt(list[0].cr, 0)
  return { out, glint: H(gl.cv) !== H(g0.cv), errs: V.errs.slice() } })
const crBad = cr.out.filter(c => c.err || !/^c157\|/.test(c.key || '') || !c.differs || c.cols < 6 || (c.kind !== 'flame' && c.asym !== 0) || c.w > 19 || c.h > 16)
ok(cr.out.length >= 19 && crBad.length === 0 && cr.errs.length === 0, 'every crown (catalogue + each pass style) is redrawn: no error, differs from the v153 G art, >= 6 colours, symmetric, sprite-sized', crBad.length ? crBad : cr.out.map(c => c.id + ':' + c.oldCols + '→' + c.cols).join(' '))
ok(cr.glint, 'the glint frame lays a sparkle over the crown', cr.glint)
const crOff = await E(() => { const T = window.RIB_TUNE; T.v157Acrown = 0; const a = window.RIB_COSMETICS.crownArt({ kind: 'king', col: ['#ffd76f', '#1f5fbf', '#6b4a0e'] }, 0); delete T.v157Acrown; return a.key })
ok(/^c\|/.test(crOff), 'TU v157Acrown 0: the v153 G crowns again', crOff)
// before / after at 4x for the eye
const cmp = await E(() => { const C = window.RIB_COSMETICS, T = window.RIB_TUNE, list = C.catalog().filter(i => i.cat === 'crown' && i.cr), S = 4, cw = 20 * S, ch = 16 * S
  const cv = document.createElement('canvas'); cv.width = list.length * cw; cv.height = ch * 2; const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#243044'; x.fillRect(0, 0, cv.width, cv.height)
  list.forEach((it, i) => { T.v157Acrown = 0; const o = C.crownArt(it.cr, 0); delete T.v157Acrown; const n = C.crownArt(it.cr, 0)
    x.drawImage(o.cv, i * cw + cw / 2 - o.ax * S, ch - 4 - o.h * S, o.w * S, o.h * S); x.drawImage(n.cv, i * cw + cw / 2 - n.ax * S, 2 * ch - 4 - n.h * S, n.w * S, n.h * S) })
  return cv.toDataURL() })
try { fs.writeFileSync(SHOTS + 'v157A-crowns-before-after.png', Buffer.from(cmp.split(',')[1], 'base64')) } catch {}

// ================= 5. the profile card =================
// the drawing is what is tested from here on: the v156 C sources off so a member look can be granted (v156Ccheck covers them)
await E(() => { window.RIB_TUNE.v156Ccos = 0; const C = window.RIB_COSMETICS; ['wings_demon', 'wings_dragon', 'crown_king', 'crown_gold'].forEach(id => C.grant(id, 'earned')); C.equip('wings', 'wings_dragon'); C.equip('crown', 'crown_king'); C.equip('aura', null) })
await E(() => window.go('profile')); await page.waitForTimeout(1900)
const cd = await sample('#screen .pcard-v151b .pc-fl-v153g.back', 7500)
const cardReg = await E(() => window.__V157A.registered().filter(r => r.where === 'card' && r.on).length)
ok(cd && cd.beat >= 3 && cd.rest === 1 && cardReg >= 1, 'the profile card: his wings flap (the back layer changes through a beat, holds still at rest)', { cd, cardReg })
await shot('profile-wings')

// ================= 6. the live field =================
await page.evaluate(p => { window.__readPos = p }, 'RB')
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function step (t) {
  const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    const el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
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
if (!scene) { await shot('no-field'); console.log(JSON.stringify({ pass, fail, errors: errs.length })); await browser.close(); process.exit(1) }
await page.waitForTimeout(1500)
// hold the broadcast still and drive his marker by hand (placeMarker, the real per-frame path) on a hand-set clock
await E(() => { const sc = window.__gridironScene; if (!window.__upd157) { window.__upd157 = sc.update; sc.update = function () {} } sc.time.paused = true; try { sc.tweens.pauseAll() } catch (e) {} })
const field = await E(async () => {
  const C = window.RIB_COSMETICS, sc = window.__gridironScene, V = window.__V157A, T = window.RIB_TUNE, P = T.wingFlapPeriodV157A || 3400, D = T.wingFlapMsV157A || 760
  C.equip('wings', 'wings_demon'); C.equip('crown', 'crown_king'); C.equip('trail', null); C.equip('aura', null)
  let m = sc.markers.find(q => q && q.team === 'you'); if (!m) { sc.highlight(sc.markers[5], true); m = sc.markers[5] }
  m.forceState = null; if (m.body) { m.body.setRotation(0); m.body.setVisible(true) }
  let rnd = 0; const orig = Math.random; Math.random = function () { if (/28-cosmetics/.test(String(new Error().stack))) rnd++; return orig() }
  const at = (t) => { sc.time.now = t; m._spdPx = 0; sc.placeMarker(m, m.sx, m.sy, 16); return { rot: +m._wrV153G.rotation.toFixed(4), sy: +m._wrV153G.scaleY.toFixed(4), vis: m._wrV153G.visible && m._wlV153G.visible, ck: m._crV153G && m._crV153G.texture.key } }
  const base = P * 400, beat = [], rest = []
  try { for (let t = 0; t < P; t += 20) (t % P < D ? beat : rest).push(at(base + t)) } finally { Math.random = orig }
  const GP = T.crownGlintPeriodV157A || 2900, gl = [at(GP * 600 + 50), at(GP * 600 + 1500)]
  const bR = beat.map(s => s.rot), rR = new Set(rest.map(s => s.rot + '|' + s.sy))
  return { beatSpan: Math.max(...bR) - Math.min(...bR), sy: Math.min(...beat.map(s => s.sy)), restStates: rR.size, vis: beat.concat(rest).every(s => s.vis), rnd, glint: gl[0].ck !== gl[1].ck, kind: V.field && V.field.kind, n: V.fieldN, errs: window.__V153G.errs.slice().concat(V.errs) }
})
ok(field.vis && field.kind === 'demon' && field.n > 50, 'the live field: his equipped wings (Demon Wings) are on his marker', { vis: field.vis, kind: field.kind, n: field.n })
ok(field.beatSpan > 0.4 && field.sy < 0.95 && field.restStates === 1, 'and they flap on the scene clock: the angle and squash swing through a beat, one still pose between beats', { span: +field.beatSpan.toFixed(3), sy: field.sy, rest: field.restStates })
ok(field.glint && field.rnd === 0 && field.errs.length === 0, 'the crown catches the light (the glint frame) on the scene clock; not one Math.random from src/28; no fx error', { glint: field.glint, rnd: field.rnd, errs: field.errs })
const snap = await E(async () => { const sc = window.__gridironScene, m = sc.markers.find(q => q && q.team === 'you'), c = sc.cameras.main, T = window.RIB_TUNE, P = T.wingFlapPeriodV157A || 3400
  sc.time.now = P * 500 + 190; sc.placeMarker(m, m.sx, m.sy, 16)
  try { c.stopFollow() } catch (e) {} c.setZoom(3.2 / Math.max(0.2, m.root.scale)); c.centerOn(m.root.x, m.root.y - 6 * m.root.scale); await new Promise(r => setTimeout(r, 150))
  const gx = (m.root.x - c.scrollX - c.width * c.originX) * c.zoom + c.width * c.originX, gy = (m.root.y - c.scrollY - c.height * c.originY) * c.zoom + c.height * c.originY
  const x0 = Math.max(0, Math.min(c.width - 300, Math.round(gx - 150))), y0 = Math.max(0, Math.min(c.height - 300, Math.round(gy - 170)))
  return await new Promise(r => sc.game.renderer.snapshotArea(x0, y0, 300, 300, img => { const cv = document.createElement('canvas'); cv.width = 300; cv.height = 300; cv.getContext('2d').drawImage(img, 0, 0); r(cv.toDataURL()) })) })
try { fs.writeFileSync(SHOTS + 'v157A-field-wings.png', Buffer.from(snap.split(',')[1], 'base64')) } catch {}
await E(() => { const sc = window.__gridironScene; sc.time.paused = false; try { sc.tweens.resumeAll() } catch (e) {} if (window.__upd157) { sc.update = window.__upd157; delete window.__upd157 } })

// ================= 7. no gameplay change =================
const neutral = await E(() => { const C = window.RIB_COSMETICS, st = window.__getGridironState(), keep = JSON.stringify(st.player || null)
  const seedRun = () => { let s = 5757; const orig = Math.random; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let v = Math.imul(s ^ s >>> 15, 1 | s); v = v + Math.imul(v ^ v >>> 7, 61 | v) ^ v; return ((v ^ v >>> 14) >>> 0) / 4294967296 }
    const out = []; try { for (let g = 0; g < 6; g++) { const r = window.__simGameV2(50 + g * 4, ['QB', 'RB', 'WR', 'LB'][g % 4]); out.push([r.usScore, r.themScore, r.plays.length, r.team.yds, r.oppTeam.yds]) } } finally { Math.random = orig }
    return JSON.stringify(out) }
  C.slots.forEach(s => C.equip(s, C.cats[s].def)); const a = seedRun(); st.player = JSON.parse(keep)
  C.equip('wings', 'wings_demon'); C.equip('crown', 'crown_king')
  const eq = [C.equipped('wings'), C.equipped('crown')]; const b = seedRun(); st.player = JSON.parse(keep)
  return { same: a === b, a: a.slice(0, 80), eq } })
ok(neutral.same && neutral.eq.join() === 'wings_demon,crown_king', 'seeded games score identically with nothing equipped and with new wings and a crown equipped', neutral)
await E(() => { delete window.RIB_TUNE.v156Ccos })

ok(errs.length === 0, 'no page errors', errs.slice(0, 6))
console.log(JSON.stringify({ pass, fail, errors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
