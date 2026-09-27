// Dev check: v159 C — THE END ZONE AND THE SHELF, ALIVE (src/28-cosmetics.js), at a 400x860 phone:
//   1. the celebration system: every celebration item (v151 B, v153 G, v158 A) builds a plan under the particle cap,
//      on a four-stage timeline (anticipation / burst / linger / fade, ~1.5-2.5 s); its frames are drawn (ink at the
//      burst and the linger), change over time, are identical for the same seed and t, and are empty after the end;
//      the calm plan (prefers-reduced-motion) is shorter, has fewer particles, no hop and no kinetic tilt; building and
//      drawing every plan spends no Math.random
//   2. the Locker: every celebration previews as a looping canvas mini-stage (frames advance, it loops); reduced
//      motion → a still frame and nothing on the loop
//   3. the shelf: the profile card's shelf carries the glint (::before animation) and animated trophies, its pixels
//      change over time, the numbers count up when the card opens, a new trophy on HIS card pops; reduced motion → still
//   4. the live field: a forced touchdown by HIM plays the equipped celebration (stages observed in order at the plan's
//      timings, live particles under the cap, the draw cost within a bound, frames differ), a team-mate's does not;
//      every celebration item plays its sequence on the field; frame strips of four kinds go to $SHOTS
//   5. seeded simGameV2 box scores identical with and without the system (TU v159C); no page errors
// Screenshots go to $SHOTS (default /tmp/claude-0/shots/).
//   node scripts/v159Ccheck.mjs        (GAME_URL=http://localhost:5173/)
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
  await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && window.RIB_COSMETICS && window.__V159C && window.__V159C.plan, null, { timeout: 60000 })
  await page.waitForTimeout(600)
}
await boot(); await page.goto(GAME_URL, { waitUntil: 'networkidle' }); await boot()   // warm past vite's one-time reload
const shot = async (name) => { try { await page.screenshot({ path: SHOTS + 'v159C-' + name + '.png' }) } catch {} }
const savePng = (name, dataUrl) => { try { fs.writeFileSync(SHOTS + 'v159C-' + name + '.png', Buffer.from(String(dataUrl).split(',')[1], 'base64')) } catch {} }

// ================= 1. the celebration system =================
const sys = await E(() => {
  const V = window.__V159C, C = window.RIB_COSMETICS, items = C.catalog().filter(i => i.cat === 'celebration')
  let rnd = 0; const orig = Math.random; Math.random = function () { rnd++; return orig.apply(this, arguments) }
  const hash = (cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 2166136261, ink = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 24) ink++; h = Math.imul(h ^ (d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3] * 11), 16777619) } return { h: h >>> 0, ink } }
  const out = []
  try {
    for (const it of items) {
      const P = V.plan(it.id, 777), Pc = V.plan(it.id, 777, true), T = P.T, cv = document.createElement('canvas'); cv.width = 200; cv.height = 180
      const at = [T.a * 0.7, (T.a + T.b) / 2, (T.b + T.l) / 2, (T.l + T.end) / 2]
      const fr = at.map(t => { const live = V.renderAt(cv, it.id, t, 777); return Object.assign({ live }, hash(cv)) })
      V.renderAt(cv, it.id, at[1], 777); const again = hash(cv).h
      V.renderAt(cv, it.id, T.end + 50, 777); const after = hash(cv).ink
      const poseB = V.pose(it.id, (T.a + T.b) / 2), poseC = V.pose(it.id, (T.a + T.b) / 2, true), lt = V.letter(it.id, 0, T.a * 0.55 + 120), ltC = V.letter(it.id, 0, T.a * 0.55 + 60, true)
      out.push({ id: it.id, kind: P.kind, parts: P.parts, cap: P.cap, end: Math.round(T.end), calmEnd: Math.round(Pc.T.end), calmParts: Pc.parts, ink: fr.map(f => f.ink), live: fr.map(f => f.live), hs: fr.map(f => f.h), same: again === fr[1].h, after,
        hop: poseB ? Math.max(poseB.hop, Math.abs(1 - poseB.sy) * 20) : 0, calmPose: poseC, tilt: lt ? Math.abs(lt.rot) + Math.abs(lt.sc - 1) : 0, calmTilt: ltC ? Math.abs(ltC.rot) + Math.abs(ltC.sc - 1) : 0, say: P.say })
    }
  } finally { Math.random = orig }
  return { n: items.length, out, rnd, kinds: V.kinds(), tl: V.timeline(), tlc: V.timeline(true) }
})
const bad = (f) => sys.out.filter(f).map(o => o.id)
ok(sys.n >= 25 && sys.kinds.length >= 16, 'every celebration item (' + sys.n + ') is on the new system (' + sys.kinds.length + ' kinds)', sys.kinds)
ok(sys.tl.a > 150 && sys.tl.b > sys.tl.a + 250 && sys.tl.l > sys.tl.b + 500 && sys.tl.end > sys.tl.l + 250 && sys.tl.end >= 1500 && sys.tl.end <= 2500, 'the timeline has four stages — anticipation / burst / linger / fade — in 1.5-2.5 s', sys.tl)
ok(bad(o => !(o.parts >= 12 && o.parts <= o.cap)).length === 0, 'every plan has a real particle count under the cap (' + sys.out[0].cap + ')', sys.out.map(o => o.id + ':' + o.parts).join(' '))
ok(bad(o => !(o.ink[1] > 40 && o.ink[2] > 40)).length === 0, 'every celebration draws ink at the burst and the linger', bad(o => !(o.ink[1] > 40 && o.ink[2] > 40)))
ok(bad(o => new Set(o.hs).size < 4).length === 0, 'its frames differ across the four stages', bad(o => new Set(o.hs).size < 4))
ok(bad(o => !o.same).length === 0 && bad(o => o.after > 0).length === 0, 'the same seed and t draw the same frame (deterministic); nothing is left after the end', { diff: bad(o => !o.same), left: bad(o => o.after > 0) })
ok(sys.rnd === 0, 'building and drawing every plan spends no Math.random', sys.rnd)
ok(bad(o => !(o.calmEnd < o.end * 0.6 && o.calmParts <= Math.ceil(o.parts * 0.5))).length === 0 && sys.tlc.end < 1200, 'reduced motion: the calm plan is shorter (' + Math.round(sys.tlc.end) + ' ms) and has fewer particles', bad(o => !(o.calmEnd < o.end * 0.6 && o.calmParts <= Math.ceil(o.parts * 0.5))))
ok(bad(o => !(o.hop > 1)).length === 0 && bad(o => o.calmPose !== null).length === 0, 'he moves in the burst (a hop / squash); the calm plan does not move him', { still: bad(o => !(o.hop > 1)), calmMoves: bad(o => o.calmPose !== null) })
ok(bad(o => o.say && !(o.tilt > 0.05)).length === 0 && bad(o => o.calmTilt > 0.001).length === 0, 'the callout is kinetic (letters scale / tilt in); calm letters only fade', { flat: bad(o => o.say && !(o.tilt > 0.05)), calm: bad(o => o.calmTilt > 0.001) })

// ================= 2. the Locker =================
await E(() => { (window.RIB_TUNE = window.RIB_TUNE || {}).v156Ccos = 0 })
await E(() => window.go('locker')); await page.waitForTimeout(900)
await E(() => { const t = document.querySelector('.hubv75-tab[data-sec="style"]'); t && t.click() }); await page.waitForTimeout(500)
await E(() => { window.cosCatV151B && window.cosCatV151B('celebration') }); await page.waitForTimeout(400)
const lk0 = await E(() => ({ items: document.querySelectorAll('.cos-item-v151b').length, cv: document.querySelectorAll('.cos-item-v151b canvas.cos-cel-v159c').length, list: window.__V159C.previewList() }))
await page.waitForTimeout(700)
const lk1 = await E(() => ({ list: window.__V159C.previewList() }))
await page.waitForTimeout(2600)
const lk2 = await E(() => ({ list: window.__V159C.previewList(), pix: [...document.querySelectorAll('.cos-item-v151b canvas.cos-cel-v159c')].slice(0, 4).map(c => c.toDataURL().length) }))
const adv = lk1.list.filter(r => r.connected).every(r => { const r0 = lk0.list.find(q => q.id === r.id && q.connected); return r0 && r.frames > r0.frames })
ok(lk0.items >= 8 && lk0.cv === lk0.items, 'the Locker previews every celebration as a canvas mini-stage', { items: lk0.items, canvases: lk0.cv })
ok(adv && lk2.list.filter(r => r.connected).every(r => r.loops >= 1), 'the previews animate (frames advance) and LOOP', lk2.list.slice(0, 4))
await shot('locker-celebrations')
{ const strip = await E(async () => { const cvs = [...document.querySelectorAll('.cos-item-v151b canvas.cos-cel-v159c')].slice(0, 4), out = document.createElement('canvas'), n = 6, W = 128, H = 120; out.width = W * n; out.height = H * cvs.length
    const x = out.getContext('2d'); x.fillStyle = '#10151e'; x.fillRect(0, 0, out.width, out.height)
    for (let f = 0; f < n; f++) { cvs.forEach((c, i) => x.drawImage(c, f * W, i * H, W, H)); await new Promise(r => setTimeout(r, 330)) }
    return out.toDataURL() }); savePng('locker-preview-strip', strip) }

// ================= 3. the shelf =================
await E(() => { try { localStorage.removeItem('rib.cos.shelfSeen.v159c') } catch (e) {} })
const mk = `(v, self) => { const C = window.RIB_COSMETICS, d = C.profile(); Object.assign(d, v); d.cosmetics = Object.assign({}, d.cosmetics, { shelf: 'shelf_glass' });
  let host = document.getElementById('v159c-host'); if (!host) { host = document.createElement('div'); host.id = 'v159c-host'; host.style.cssText = 'position:fixed;left:0;top:0;width:380px;z-index:99999;background:#0b0f16'; document.body.appendChild(host) }
  host.className = self ? 'pcard-host-v151b' : ''; C.renderCard(d, host); return true }`
const s0 = await E(async ({ mk }) => { const f = eval(mk); f({ titles: 12, rings: 3, mvps: 5, hof: 1 }, true)
  const sh = document.querySelector('#v159c-host .pc-shelf-v151b'), b = [...sh.querySelectorAll('b')].map(e => e.textContent)
  await new Promise(r => setTimeout(r, 1400)); const b2 = [...sh.querySelectorAll('b')].map(e => e.textContent)
  const cs = getComputedStyle(sh, '::before'), ems = [...sh.querySelectorAll('em')].map(e => getComputedStyle(e).animationName), mat = getComputedStyle(sh, '::after').animationName
  return { cls: sh.className, b, b2, glint: cs.animationName, ems, mat, ups: window.__V159C.countUps } }, { mk })
ok(/s159c/.test(s0.cls) && s0.glint === 's159cGlint', 'the shelf catches the light: a glint sweeps it on a cycle', { cls: s0.cls, glint: s0.glint })
ok(s0.ems.filter(n => /s159c(Bob|Turn|Tilt)/.test(n)).length >= 3 && /s159c/.test(s0.mat), 'the trophies idle (bob / turn / tilt) and the material moves (glass reflections)', { ems: s0.ems, mat: s0.mat })
ok(s0.b.join() !== s0.b2.join() && s0.b2.join() === '12,3,5,1' && s0.b.some(v => v === '0'), 'the numbers count up when the card opens', { at0: s0.b, at1400: s0.b2 })
const box = await E(() => { const r = document.querySelector('#v159c-host .pc-shelf-v151b').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height } })
const frames = []; for (let i = 0; i < 8; i++) { frames.push((await page.screenshot({ clip: box })).toString('base64')); await page.waitForTimeout(500) }
ok(new Set(frames).size >= 3, 'the shelf animates: frames over four seconds differ', new Set(frames).size)
{ const strip = await E(async ({ frames }) => { const imgs = await Promise.all(frames.map(f => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + f })))
    const c = document.createElement('canvas'); c.width = imgs[0].width; c.height = imgs[0].height * imgs.length; const x = c.getContext('2d'); imgs.forEach((im, k) => x.drawImage(im, 0, k * im.height)); return c.toDataURL() }, { frames }); savePng('shelf-glint-strip', strip) }
await page.screenshot({ path: SHOTS + 'v159C-shelf-card.png', clip: { x: 0, y: 0, width: 380, height: 420 } }).catch(() => {})
const pop = await E(async ({ mk }) => { const f = eval(mk); f({ titles: 13, rings: 3, mvps: 5, hof: 1 }, true); const n = window.__V159C.pops.length
  await new Promise(r => setTimeout(r, 1200)); const sp = [...document.querySelectorAll('#v159c-host .pc-shelf-v151b > span')]
  const cls = sp.map(s => s.className), first = getComputedStyle(sp[0].querySelector('em')).animationName
  const other = (() => { f({ titles: 99, rings: 3, mvps: 5, hof: 1 }, false); return document.querySelectorAll('#v159c-host .pop159c').length })()
  return { pops: n, cls, first, other } }, { mk })
ok(pop.pops >= 1 && /pop159c/.test(pop.cls[0]) && !/pop159c/.test(pop.cls[1]) && pop.first === 's159cPop' && pop.other === 0, 'a trophy new since his card was last shown pops and shines (only that one, only on HIS card)', pop)
await page.emulateMedia({ reducedMotion: 'reduce' })
const rm = await E(async ({ mk }) => { const f = eval(mk); f({ titles: 12, rings: 3, mvps: 5, hof: 1 }, false)
  const sh = document.querySelector('#v159c-host .pc-shelf-v151b'), b = [...sh.querySelectorAll('b')].map(e => e.textContent)
  const g = getComputedStyle(sh, '::before').animationName, em = getComputedStyle(sh.querySelector('em')).animationName
  window.go('locker'); await new Promise(r => setTimeout(r, 600)); const t = document.querySelector('.hubv75-tab[data-sec="style"]'); t && t.click(); await new Promise(r => setTimeout(r, 300))
  window.cosCatV151B && window.cosCatV151B('stadium'); window.cosCatV151B && window.cosCatV151B('celebration'); await new Promise(r => setTimeout(r, 500))
  const cv = [...document.querySelectorAll('canvas.cos-cel-v159c')], live = window.__V159C.previewList().filter(r => r.connected).length
  const p1 = cv.slice(0, 3).map(c => c.toDataURL()); await new Promise(r => setTimeout(r, 700)); const p2 = cv.slice(0, 3).map(c => c.toDataURL())
  return { b, g, em, cv: cv.length, live, still: p1.join() === p2.join() } }, { mk })
ok(rm.b.join() === '12,3,5,1' && rm.g === 'none' && rm.em === 'none', 'reduced motion: the shelf is still and its numbers are final at once', rm)
ok(rm.cv >= 8 && rm.live === 0 && rm.still, 'reduced motion: the Locker previews draw one still frame (none on the loop)', { cv: rm.cv, live: rm.live, still: rm.still })
await page.emulateMedia({ reducedMotion: 'no-preference' })
await E(() => { const h = document.getElementById('v159c-host'); h && h.remove() })

// ================= 4. the live field =================
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
await page.waitForTimeout(1500)
/* his marker (or, when the broadcast has not dressed one yet, the featured man made his) */
const youIdx = () => E(() => { const sc = window.__gridironScene; let i = sc.markers.findIndex(m => m && m.team === 'you' && m.root); if (i < 0) { try { sc.highlight(sc.markers[5], true) } catch (e) {} i = sc.markers.findIndex(m => m && m.team === 'you' && m.root); if (i < 0) i = 5 } return i })
const yi = await youIdx()
// the forced touchdown by HIM (the v151 B / v153 G approach), the equipped celebration
await E(() => { const C = window.RIB_COSMETICS; C.grant('cel_stars', 'pass'); C.equip('celebration', 'cel_stars') })
const live = await E(async (yi) => { const sc = window.__gridironScene, m = sc.markers[yi]
  const P = sc.play || (sc.play = { payload: {}, t: 0 }); const keep = P.carrierId; P.carrierId = yi
  let rnd = 0; const C = window.RIB_COSMETICS, orig = Math.random; Math.random = function () { rnd++; return orig.apply(this, arguments) }
  try { C.celebrate(sc, m.root.x, m.root.y, m) } finally { Math.random = orig }
  window.__V159C.active && window.__V159C.active.stop('probe'); const n0 = window.__V151B.celebrations.length
  const fr = []; let raf = true; const ts = []; const loop = (t) => { ts.push(t); if (raf) requestAnimationFrame(loop) }; requestAnimationFrame(loop)
  try { sc.celebrate(m.sx, m.sy) } catch (e) { return { err: String(e) } } P.carrierId = keep
  const run = window.__V159C.active, cv = sc.game.canvas
  const snap = () => { const c = document.createElement('canvas'); c.width = 120; c.height = 120; const cam = sc.cameras.main, sx = (m.root.x - cam.worldView.x) * cam.zoom, sy = (m.root.y - cam.worldView.y) * cam.zoom
    c.getContext('2d').drawImage(cv, sx - 90, sy - 110, 180, 180, 0, 0, 120, 120); return c.toDataURL().length + ':' + c.toDataURL().slice(-40) }
  for (let k = 0; k < 5; k++) { await new Promise(r => setTimeout(r, 330)); fr.push(snap()) }
  await new Promise(r => setTimeout(r, 900)); raf = false
  const gaps = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b)
  const last = window.__V151B.celebrations[window.__V151B.celebrations.length - 1]
  const oi = sc.markers.findIndex((q, k) => q && q.team !== 'you' && k < 11), n1 = window.__V151B.celebrations.length; P.carrierId = oi; try { sc.celebrate(sc.markers[oi].sx, sc.markers[oi].sy) } catch (e) {} P.carrierId = keep
  return { n0, n1, n2: window.__V151B.celebrations.length, last, rnd, err: window.__V151B.celebrateErr || null, run: run && { kind: run.kind, stages: run.stages, T: run.T, parts: run.parts, cap: run.cap, maxLive: run.maxLive, frames: run.frames, avg: run.drawMs / Math.max(1, run.frames), max: run.drawMax, med: run.ms.slice().sort((a, b) => a - b)[run.ms.length >> 1] || 0, ended: run.ended, pose: run.pose, u: run.u, zoom: run.zoom, letters: run.letters },
    fr, p50: gaps[gaps.length >> 1], p90: gaps[Math.floor(gaps.length * 0.9)], errs: window.__V159C.errs } }, yi)
const R = live.run || {}, st = (R.stages || []).map(s => s.s), at = Object.fromEntries((R.stages || []).map(s => [s.s, s.at]))
ok(live.n1 === live.n0 + 1 && live.last && live.last.kind === 'stars' && live.last.v159c && live.last.made >= 10 && live.last.say === 'STARBOY' && !live.err, 'a forced touchdown by HIM plays the equipped celebration on the new system', live.last)
ok(live.n2 === live.n1, 'a team-mate\'s touchdown does not play it', { n1: live.n1, n2: live.n2 })
ok(st.join() === 'anticipation,burst,linger,fade' && R.ended === 'done', 'the field observed the four stages in order and the sequence ended by itself', { stages: R.stages, ended: R.ended })
const pv = Object.fromEntries((R.stages || []).map(s => [s.s, s.prev])), onTime = (k, T) => at[k] >= T - 1 && pv[k] < T   // the first frame at or past T (a loaded box may pass a whole stage in one frame)
ok(onTime('burst', R.T.a) && onTime('linger', R.T.b) && onTime('fade', R.T.l), 'each stage began on the first frame at or past the plan\'s timing (the frame before it was still in the stage before)', { at, prevFrame: pv, plan: R.T && { a: Math.round(R.T.a), b: Math.round(R.T.b), l: Math.round(R.T.l), end: Math.round(R.T.end) } })
ok(R.maxLive > 10 && R.maxLive <= R.cap && R.parts <= R.cap, 'live particles stayed under the cap', { maxLive: R.maxLive, parts: R.parts, cap: R.cap })
ok(R.pose > 10 && R.letters >= 5, 'he hopped (the marker was posed ' + R.pose + ' frames) and the callout was kinetic type', { pose: R.pose, letters: R.letters })
ok(new Set(live.fr).size >= 4, 'the field frames differ over the celebration', live.fr.map(f => f.slice(-8)))
ok(R.frames > 5 && R.med < 2 && R.avg < 6, 'the draw cost stays inside the frame: median ' + (R.med || 0).toFixed(2) + ' ms, avg ' + (R.avg || 0).toFixed(2) + ' ms, max ' + (R.max || 0).toFixed(1) + ' ms over ' + R.frames + ' frames; rAF p50 ' + Math.round(live.p50) + ' ms / p90 ' + Math.round(live.p90) + ' ms', { avg: R.avg, max: R.max, frames: R.frames })
ok(live.rnd === 0 && (live.errs || []).length === 0, 'the celebration spends no Math.random and raised no error', { rnd: live.rnd, errs: live.errs })
// every celebration item plays its sequence on the field
await E(() => { const sc = window.__gridironScene; if (!window.__updV159C) { window.__updV159C = [sc.update, sc.killAllFx]; sc.update = function () {}; sc.killAllFx = function () {} } })   // hold the broadcast: no next play clears the fx
const every = await E(async (yi) => { const sc = window.__gridironScene, m = sc.markers[yi], V = window.__V159C, ids = window.RIB_COSMETICS.catalog().filter(i => i.cat === 'celebration').map(i => i.id), res = []
  for (const id of ids) { const run = V.play(sc, m.root.x, m.root.y, m, id); await new Promise(r => { const w = () => (!run.alive ? r() : setTimeout(w, 60)); setTimeout(w, 200) })
    res.push({ id, st: run.stages.map(s => s.s).join(','), ended: run.ended, maxLive: run.maxLive, cap: run.cap, avg: +(run.drawMs / Math.max(1, run.frames)).toFixed(2), med: +(run.ms.slice().sort((a, b) => a - b)[run.ms.length >> 1] || 0).toFixed(2), max: +run.drawMax.toFixed(1) }) }
  return { res, errs: V.errs } }, yi)
const badEv = every.res.filter(r => r.st !== 'anticipation,burst,linger,fade' || r.ended !== 'done' || !(r.maxLive > 0 && r.maxLive <= r.cap))
ok(every.res.length >= 25 && badEv.length === 0 && every.errs.length === 0, 'every celebration item (' + every.res.length + ') played its four-stage sequence on the field, under the cap, and ended', badEv.length ? badEv : { worstAvgMs: Math.max(...every.res.map(r => r.avg)), worstMaxMs: Math.max(...every.res.map(r => r.max)) })
ok(every.res.every(r => r.med < 2), 'every kind draws cheaply (worst median ' + Math.max(...every.res.map(r => r.med)) + ' ms a frame)', every.res.map(r => r.id + ':' + r.med + '/' + r.avg).join(' '))
// the calm variant on the field
const calm = await E(async (yi) => { const sc = window.__gridironScene, m = sc.markers[yi], run = window.__V159C.play(sc, m.root.x, m.root.y, m, 'cel_lightning', { calm: true })
  await new Promise(r => { const w = () => (!run.alive ? r() : setTimeout(w, 50)); setTimeout(w, 100) }); return { st: run.stages.map(s => s.s).join(','), end: run.T.end, pose: run.pose, shake: run.shake, parts: run.parts } }, yi)
ok(calm.st === 'anticipation,burst,linger,fade' && calm.end < 1100 && calm.pose === 0 && calm.shake === 0, 'reduced motion on the field: a short calm version (' + Math.round(calm.end) + ' ms, no hop, no shake)', calm)
// frame strips: four kinds, eight frames each, held at fixed t
const strips = await E(async (yi) => { const sc = window.__gridironScene, m = sc.markers[yi], V = window.__V159C, cv = sc.game.canvas, out = {}
  for (const id of ['cel_fireworks', 'cel_lightning', 'cel_halo', 'cel_meteor', 'cel_rainbow', 'cel_flame']) {
    const run = V.play(sc, m.root.x, m.root.y, m, id), T = run.T, ts = [0.5 * T.a, T.a + 40, T.a + 160, (T.a + T.b) / 2, T.b + 120, (T.b + T.l) / 2, T.l + 80, (T.l + T.end) / 2]
    const W = 170, H = 190, Z = 2, c = document.createElement('canvas'); c.width = W * Z * ts.length; c.height = H * Z; const x = c.getContext('2d'); x.imageSmoothingEnabled = false
    for (let k = 0; k < ts.length; k++) { run.setHold(ts[k]); await new Promise(r => setTimeout(r, 90)); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      const cam = sc.cameras.main, sx = (m.root.x - cam.worldView.x) * cam.zoom, sy = (m.root.y - cam.worldView.y) * cam.zoom
      x.drawImage(cv, sx - W / 2, sy - H * 0.72, W, H, k * W * Z, 0, W * Z, H * Z); x.fillStyle = '#fff'; x.font = '16px monospace'; x.fillText(Math.round(ts[k]) + ' ms', k * W * Z + 6, 18) }
    run.setHold(null); run.stop('strip'); out[id] = c.toDataURL() }
  return out }, yi)
for (const [id, d] of Object.entries(strips)) savePng('field-strip-' + id.replace(/^cel_/, ''), d)
await E(() => { const sc = window.__gridironScene; if (window.__updV159C) { sc.update = window.__updV159C[0]; sc.killAllFx = window.__updV159C[1]; delete window.__updV159C } })
await shot('field-after')

// ================= 5. no gameplay change =================
const neutral = await E(() => { const st = window.__getGridironState(), keep = JSON.stringify(st.player || null)
  const seedRun = () => { let s = 4242; const orig = Math.random; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let v = Math.imul(s ^ s >>> 15, 1 | s); v = v + Math.imul(v ^ v >>> 7, 61 | v) ^ v; return ((v ^ v >>> 14) >>> 0) / 4294967296 }
    const out = []; try { for (let g = 0; g < 6; g++) { const r = window.__simGameV2(50 + g * 4, ['QB', 'RB', 'WR', 'LB'][g % 4]); out.push([r.usScore, r.themScore, r.plays.length, r.team.yds, r.oppTeam.yds]) } } finally { Math.random = orig }
    return JSON.stringify(out) }
  const T = (window.RIB_TUNE = window.RIB_TUNE || {}); T.v159C = 0; const a = seedRun(); st.player = JSON.parse(keep)
  T.v159C = 1; const b = seedRun(); st.player = JSON.parse(keep)
  return { same: a === b, a: a.slice(0, 80) } })
ok(neutral.same, 'seeded games score identically with the system off and on', neutral)

console.log(JSON.stringify({ pass, fail, errors: errs.length }))
console.log('page errors:', errs.length ? errs.slice(0, 8) : 'none')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
