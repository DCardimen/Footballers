// Dev check: v159 D — FLUTTER, CROWNS, MORE LIGHT (src/28-cosmetics.js, the v159 D block), at a 400x860 phone:
//   1. the flutter: the wing pose is never still (every 100 ms window of a 5 s sample moves, every family) yet each
//      period holds one strong flap (an amplitude spike well over the flutter's); the outer half lags (tip) for feathers,
//      membranes, bones and the ethereal ones and never for the mechanical ones (their stepped jitter instead); the
//      families move differently; prefers-reduced-motion → still; TU v159Dflutter 0 → v157 A's beat-then-rest pose
//   2. the canvases flutter: a Locker wing preview and the profile card's wing layer keep changing between flaps
//   3. the crowns: >= 15 new kinds, each its own picture (unique pixel hashes over every catalogue crown), symmetric,
//      sprite-sized, >= 6 colours; EVERY crown (old and new) animates (its frames differ), and the card, a Locker
//      preview and the live field show two different frames over time; reduced motion → still
//   4. the auras: >= 15 new, each its own program (fx) and picture, each animates (two times differ); a Locker preview
//      and the card animate one
//   5. sources: a few free, some earned (their achievements exist), the flashiest member — listed "🔒 Membership",
//      locked, never owned while the store is OFF
//   6. the live field: wings flutter on the scene clock (never still between flaps, a flap each period), the crown's
//      frames change, a new aura adds its layers; no Math.random from src/28; the perf probe (busy vs nothing)
//   7. seeded games identical with nothing / every new look equipped; no page errors
// Screenshots go to $SHOTS (default /tmp/claude-0/shots/), prefixed v159D-.
//   node scripts/v159Dcheck.mjs        (GAME_URL=http://localhost:5173/)
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
  await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && window.RIB_COSMETICS && window.__V159D && window.__V159D.pose, null, { timeout: 60000 })
  await page.waitForTimeout(600)
}
await boot(); await page.goto(GAME_URL, { waitUntil: 'networkidle' }); await boot()   // warm past vite's one-time reload
const shot = async (name) => { try { await page.screenshot({ path: SHOTS + 'v159D-' + name + '.png' }) } catch {} }
const saveUrl = (name, url) => { try { fs.writeFileSync(SHOTS + 'v159D-' + name + '.png', Buffer.from(url.split(',')[1], 'base64')) } catch {} }
await E(() => { window.__h159 = (cv, alphaOnly) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 2166136261 >>> 0
  for (let i = 0; i < d.length; i += 4) { const v = alphaOnly ? (d[i + 3] > 100 ? 1 : 0) : (d[i] << 24 ^ d[i + 1] << 16 ^ d[i + 2] << 8 ^ d[i + 3]); h ^= v; h = Math.imul(h, 16777619) >>> 0 } return cv.width + 'x' + cv.height + ':' + h } })
/* he owns a look: member looks by the v156 C grandfather list (the store is OFF here), earned ones by a grant */
const own = (ids) => E((ids) => {
  const C = window.RIB_COSMETICS, all = C.catalog(), k = 'rib.cosmetics.v1'
  const mem = ids.filter(id => (all.find(i => i.id === id) || {}).source === 'member')
  if (mem.length) { const d = JSON.parse(localStorage.getItem(k) || 'null') || { v: 1, owned: {}, equipped: {}, ach: {} }; d.gf156 = d.gf156 || {}; mem.forEach(id => { d.gf156[id] = 1 }); d.v156C = d.v156C || Date.now(); localStorage.setItem(k, JSON.stringify(d)); window.__V156C.reloadCosmetics() }
  ids.forEach(id => { const it = all.find(i => i.id === id); if (it && it.source === 'earned') C.grant(id, 'earned') })
  return ids.filter(id => C.owned(id)).length
}, ids)
// a canvas sampled on the rAF clock: the distinct pixel hashes in each named phase window of the flap period
const sample = (sel, ms) => E(async ({ sel, ms }) => { const H = window.__h159, T = window.RIB_TUNE || {}, P = T.wingFlapPeriodV157A || 3400, D = T.wingFlapMsV157A || 760
  const cv = document.querySelector(sel); if (!cv) return null; cv.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 120)); const beat = new Set(), flut = new Set(); const t0 = performance.now()
  await new Promise(r => { const f = () => { const t = performance.now(), ph = t % P; if (ph > 40 && ph < D - 40) beat.add(H(cv)); else if (ph > D + 700 && ph < P - 400) flut.add(H(cv)); if (t - t0 < ms) requestAnimationFrame(f); else r() }; requestAnimationFrame(f) })
  return { beat: beat.size, flutter: flut.size } }, { sel, ms })
const changes = (sel, ms) => E(async ({ sel, ms }) => { const cv = document.querySelector(sel); if (!cv) return null; cv.scrollIntoView && cv.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 60)); const a = cv.toDataURL(); await new Promise(r => setTimeout(r, ms)); return { has: true, moved: a !== cv.toDataURL() } }, { sel, ms })

await E(() => window.RIB_COSMETICS._reset())
// ================= 1. the flutter model =================
const fl = await E(() => {
  const V = window.__V159D, T = window.RIB_TUNE || {}, P = T.wingFlapPeriodV157A || 3400, D = T.wingFlapMsV157A || 760
  const kinds = { feather: 'angel', membrane: 'demon', mech: 'jet', bone: 'skeleton', ether: 'galaxy' }, out = {}
  Object.keys(kinds).forEach(fam => { const k = kinds[fam], S = []
    for (let t = 7e5; t < 7e5 + 5000; t += 16) S.push(V.pose(t, k))
    let still = 0; for (let w = 0; w + 6 <= S.length; w += 6) { const rs = S.slice(w, w + 6).map(p => p.rot); if (Math.max(...rs) - Math.min(...rs) < 0.002) still++ }
    const per = []; for (let t0 = 7e5 - (7e5 % P); t0 < 7e5 + 5000 - P; t0 += P) { if (t0 < 7e5) continue; let pk = 0, fq = 0
      for (let ph = 0; ph < P; ph += 8) { const p = V.pose(t0 + ph, k); if (ph < D) pk = Math.max(pk, Math.abs(p.rot)); else if (ph > D + 700 && ph < P - 400) fq = Math.max(fq, Math.abs(p.rot)) } per.push({ pk: +pk.toFixed(3), fq: +fq.toFixed(3) }) }
    const all = []; for (let t = 7e5; t < 7e5 + 5000; t += 50) all.push(V.pose(t, k).rot)
    let pk2 = 0, fq2 = 0; for (let t = 7e5; t < 7e5 + 5000; t += 8) { const p = V.pose(t, k), ph = t % P; if (ph < D) pk2 = Math.max(pk2, Math.abs(p.rot)); else if (ph > D + 700 && ph < P - 400) fq2 = Math.max(fq2, Math.abs(p.rot)) }
    const tips = S.map(p => p.tip), tipSpan = Math.max(...tips) - Math.min(...tips)
    let hf = 0; for (let i = 2; i < tips.length; i++) hf += Math.abs(tips[i] - 2 * tips[i - 1] + tips[i - 2])
    out[fam] = { kind: k, fam: V.fam(k), windows: Math.floor(S.length / 6), still, pk: +pk2.toFixed(3), fq: +fq2.toFixed(3), tipSpan: +tipSpan.toFixed(3), hf: +(hf / tips.length).toFixed(5), beats: S.filter(p => p.beat).length, sig: all.map(v => v.toFixed(3)).join(',').slice(0, 400) }
  })
  return { P, D, out, on: V.on() }
})
const F = fl.out, fams = Object.keys(F)
ok(fl.on.flutter && fams.every(f => F[f].still === 0 && F[f].windows >= 50), 'the wings are never fully still: every 100 ms window of a 5 s sample moves (every wing family)', fams.map(f => f + ':' + F[f].still + '/' + F[f].windows).join(' '))
ok(fams.every(f => F[f].pk > 0.3 && F[f].fq < 0.15 && F[f].pk > 2.5 * F[f].fq && F[f].beats > 0), 'and each period holds one strong flap: the beat\'s amplitude is a spike well over the flutter\'s', fams.map(f => f + ':' + F[f].pk + '/' + F[f].fq).join(' '))
ok(F.mech.tipSpan === 0 && ['feather', 'membrane', 'bone', 'ether'].every(f => F[f].tipSpan > 0.03), 'secondary motion: the outer half lags / ripples for feathers, membranes, bones and the ethereal ones — never for the mechanical ones', fams.map(f => f + ':' + F[f].tipSpan).join(' '))
ok(F.membrane.hf > 2 * F.feather.hf && F.bone.hf > F.feather.hf && new Set(fams.map(f => F[f].sig)).size === fams.length && fams.every(f => F[f].fam === f), 'each family moves its own way (the membrane\'s shiver and the bones\' rattle are the high-frequency ones)', fams.map(f => f + ':' + F[f].hf).join(' '))
const det = await E(() => { const V = window.__V159D; const a = [], b = []; for (let t = 0; t < 4000; t += 37) { a.push(V.pose(t, 'demon').rot); b.push(V.pose(t, 'demon').rot) } return a.join() === b.join() })
ok(det, 'the pose is a pure function of the clock (deterministic)')
const ks = await E(() => { const V = window.__V159D, T = (window.RIB_TUNE = window.RIB_TUNE || {}), P = T.wingFlapPeriodV157A || 3400, D = T.wingFlapMsV157A || 760; T.v159Dflutter = 0
  const rest = new Set(); for (let t = 0; t < P; t += 20) { const p = V.pose(t, 'angel'); if (t % P >= D) rest.add(p.rot + '|' + p.sy) } const beat = V.pose(D / 4, 'angel').beat; delete T.v159Dflutter; return { rest: rest.size, beat } })
ok(ks.rest === 1 && ks.beat, 'TU v159Dflutter 0: v157 A\'s pose again (a beat, then exactly still)', ks)
// the wing motion strip: one wing drawn through the real paint path at 24 moments of a period (flutter, raise, flap, settle)
const strip = await E(() => { const V = window.__V159D, C = window.RIB_COSMETICS, T = window.RIB_TUNE || {}, P = T.wingFlapPeriodV157A || 3400
  const rows = [['wings_angel', 'angel'], ['wings_demon', 'demon'], ['wings_jet', 'jet'], ['wings_skeleton', 'skeleton']], N = 12, cw = 130, ch = 96
  const cv = document.createElement('canvas'); cv.width = N * cw; cv.height = rows.length * ch + 18; const x = cv.getContext('2d'); x.fillStyle = '#16202e'; x.fillRect(0, 0, cv.width, cv.height); x.imageSmoothingEnabled = false
  const ts = []; for (let i = 0; i < N; i++) ts.push(1e6 + ((P - 900 + i * (P * 0.62 / N)) % P))
  rows.forEach((r, ri) => { const it = C.catalog().find(i => i.id === r[0]); ts.forEach((t, i) => { const p = V.pose(t, r[1]); x.save(); x.beginPath(); x.rect(i * cw, ri * ch, cw, ch); x.clip()
    V.paintWings(x, it.w, { cx: i * cw + cw / 2, top: ri * ch + 34, bot: ri * ch + 90, h: 56 }, 2, Object.assign({}, p, { t })); x.fillStyle = '#c9cfd8'; x.fillRect(i * cw + cw / 2 - 6, ri * ch + 34, 12, 50); x.restore(); x.strokeStyle = '#2a3648'; x.strokeRect(i * cw + 0.5, ri * ch + 0.5, cw - 1, ch - 1) }) })
  x.fillStyle = '#fff'; x.font = '12px sans-serif'; ts.forEach((t, i) => { const p = V.pose(t, 'angel'); x.fillText(p.phase, i * cw + 6, rows.length * ch + 13) })
  return cv.toDataURL() })
saveUrl('wing-motion-strip', strip)

// ================= 2. the canvases flutter =================
await E(() => window.go('locker')); await page.waitForTimeout(900)
await E(() => { const t = document.querySelector('.hubv75-tab[data-sec="style"]'); t && t.click() }); await page.waitForTimeout(500)
await E(() => window.cosCatV151B('wings')); await page.waitForTimeout(1100)
const pv = await sample('.cos-item-v151b[data-cos="wings_paper"] canvas.cos-fl-v153g', 7200)
ok(pv && pv.beat >= 3 && pv.flutter >= 4, 'a Locker wing preview flaps AND keeps fluttering between flaps (its pixels keep changing)', pv)
const reg = await E(() => window.__V159D.registered().filter(r => r.on && r.where === 'preview'))
ok(reg.length >= 10 && reg.every(r => r.kind), 'every Locker wing preview is registered with its kind (its family\'s flutter)', { n: reg.length, kinds: [...new Set(reg.map(r => r.kind))].length })
await shot('locker-wings')
await page.emulateMedia({ reducedMotion: 'reduce' })
await E(() => { window.cosCatV151B('crown'); window.cosCatV151B('wings') }); await page.waitForTimeout(700)
const pvRm = await sample('.cos-item-v151b[data-cos="wings_paper"] canvas.cos-fl-v153g', 3800)
const rmPose = await E(() => { const V = window.__V159D; let moved = 0; for (let t = 0; t < 5000; t += 16) { const p = V.pose(t, 'demon'); if (p.rot !== 0 || p.sy !== 1 || p.tip !== 0) moved++ } return { moved, bob: V.bob(1234), crownSame: V.crownAt({ kind: 'orbit', col: ['#ffd76f', '#fff6c0', '#2a1a5a'] }, 100).key === V.crownAt({ kind: 'orbit', col: ['#ffd76f', '#fff6c0', '#2a1a5a'] }, 900).key } })
ok(pvRm && pvRm.beat <= 1 && pvRm.flutter <= 1 && rmPose.moved === 0 && rmPose.bob === 0 && rmPose.crownSame, 'prefers-reduced-motion: the wings are still, the crown neither bobs nor animates', { pvRm, rmPose })
await page.emulateMedia({ reducedMotion: 'no-preference' })

// ================= 3. the crowns =================
const cr = await E(() => { const C = window.RIB_COSMETICS, V = window.__V159D, H = window.__h159, all = C.catalog(), kinds = V.crownKinds()
  const crowns = all.filter(i => i.cat === 'crown' && i.cr), nw = V.items().map(id => all.find(i => i.id === id)).filter(i => i && i.cat === 'crown')
  const colours = cv => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, s = new Set(); for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) s.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); return s.size }
  const sym = cv => { const W = cv.width, Hh = cv.height, d = cv.getContext('2d').getImageData(0, 0, W, Hh).data; let bad = 0; for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) if ((d[(y * W + x) * 4 + 3] > 100) !== (d[(y * W + W - 1 - x) * 4 + 3] > 100)) bad++; return bad }
  const px = {}; crowns.forEach(i => { px[i.id] = H(C.crownArt(i.cr, 0).cv) })
  const rows = nw.map(i => { const a = C.crownArt(i.cr, 0); return { id: i.id, kind: i.cr.kind, cols: colours(a.cv), asym: sym(a.cv), w: a.w, h: a.h, key: a.key } })
  const N = 24, frames = crowns.map(i => { const s = new Set(); for (let f = 0; f < N; f++) s.add(H(V.crownFrame(i.cr, f).cv)); return { id: i.id, n: s.size } })
  const src = {}; nw.forEach(i => { src[i.source] = (src[i.source] || []).concat(i.id) })
  return { n: nw.length, kinds: kinds.length, uniqKinds: new Set(nw.map(i => i.cr.kind)).size, newKind: nw.every(i => kinds.includes(i.cr.kind)),
    newUniq: new Set(nw.map(i => px[i.id])).size, clash: nw.filter(i => crowns.some(o => o.id !== i.id && px[o.id] === px[i.id])).map(i => i.id), nCrowns: crowns.length, rows, frames, src, rar: nw.map(i => i.rarity),
    achOk: nw.filter(i => i.source === 'earned').every(i => C.achievements.some(a => a.id === i.ach) || /legacy300|rings3|rings5|gen5/.test(i.ach)), errs: V.errs.slice().concat(window.__V157A.errs) } })
const crBad = cr.rows.filter(r => r.cols < 6 || r.asym !== 0 || r.w > 19 || r.h > 16 || !/^c157\|/.test(r.key))
ok(cr.n >= 15 && cr.uniqKinds === cr.n && cr.newKind && cr.kinds >= 15, '>= 15 new crowns, each its own new kind', { n: cr.n, kinds: cr.kinds })
ok(cr.newUniq === cr.n && cr.clash.length === 0, 'every new crown draws its own picture: unique pixel hashes, none matching any other catalogue crown (old or Career Pass)', { crowns: cr.nCrowns, unique: cr.newUniq, clash: cr.clash })
ok(crBad.length === 0 && cr.errs.length === 0, 'the new crowns are v157 A quality: symmetric pixel maps, >= 6 colours, sprite-sized (<= 19x16), drawn through crownArtV157A without an error', crBad.length ? crBad : cr.rows.map(r => r.kind + ':' + r.cols + 'c ' + r.w + 'x' + r.h).join(' '))
const stillCr = cr.frames.filter(f => f.n < 4)
ok(stillCr.length === 0, 'EVERY crown animates: its 24 frames hold >= 4 different pictures (sweep, twinkle, glint, its own motion)', stillCr.length ? stillCr : cr.frames.map(f => f.id.replace('crown_', '') + ':' + f.n).join(' '))
// the crown gallery at 4x: frame 0 and three animation frames of every new crown
const gal = await E(() => { const C = window.RIB_COSMETICS, V = window.__V159D, all = C.catalog(), S = 4, list = V.items().map(id => all.find(i => i.id === id)).filter(i => i.cat === 'crown')
  const cw = 21 * S, ch = 19 * S, F = [null, 3, 9, 17], cols = 2
  const cv = document.createElement('canvas'); cv.width = cols * F.length * cw; cv.height = Math.ceil(list.length / cols) * (ch + 16); const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#243044'; x.fillRect(0, 0, cv.width, cv.height)
  list.forEach((it, i) => { const gx = (i % cols) * F.length * cw, gy = Math.floor(i / cols) * (ch + 16); F.forEach((f, k) => { const a = f == null ? C.crownArt(it.cr, 0) : V.crownFrame(it.cr, f); x.drawImage(a.cv, gx + k * cw + cw / 2 - a.ax * S, gy + ch - 4 - a.h * S, a.w * S, a.h * S) })
    x.fillStyle = '#fff'; x.font = '12px sans-serif'; x.fillText(it.name + ' · ' + it.rarity + ' · ' + it.source, gx + 4, gy + ch + 12) })
  return cv.toDataURL() })
saveUrl('crown-gallery-4x', gal)
// the Locker: crowns listed with an animated preview and the right lock line
await E(() => window.cosCatV151B('crown')); await page.waitForTimeout(1000)
const lkC = await E(() => { const C = window.RIB_COSMETICS, all = C.catalog(), out = []
  window.__V159D.items().filter(id => /^crown_/.test(id)).forEach(id => { const it = all.find(i => i.id === id), el = document.querySelector('.cos-item-v151b[data-cos="' + id + '"]'), src = el && el.querySelector('.cos-src-v151b'), txt = src ? src.textContent : null
    const want = it.source === 'free' ? /EQUIP/.test(txt || '') : it.source === 'member' ? /🔒 Membership/.test(txt || '') && el.classList.contains('locked') && !C.owned(id) : it.source === 'earned' ? /🔒 Earn it: /.test(txt || '') && el.classList.contains('locked') : false
    out.push({ id, src: it.source, listed: !!el, cv: !!(el && el.querySelector('canvas')), want }) }); return out })
ok(lkC.every(r => r.listed && r.cv && r.want), 'every new crown is listed in the Locker with a drawn preview and its source\'s lock line (member: "🔒 Membership", locked)', lkC.filter(r => !(r.listed && r.cv && r.want)))
const lkMove = await changes('.cos-item-v151b[data-cos="crown_orbit"] canvas', 700)
const lkMove2 = await changes('.cos-item-v151b[data-cos="crown_gold"] canvas', 900)
ok(lkMove && lkMove.moved && lkMove2 && lkMove2.moved, 'the Locker\'s crown previews animate (Crown of Stars — a new one — and Champion\'s Crown — an old one)', { orbit: lkMove, gold: lkMove2 })
await shot('locker-crowns')

// ================= 4. the auras =================
const au = await E(() => { const C = window.RIB_COSMETICS, V = window.__V159D, all = C.catalog(), nw = V.items().map(id => all.find(i => i.id === id)).filter(i => i && i.cat === 'aura')
  const h = (c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let x = 2166136261 >>> 0, ink = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 30) ink++; x ^= (d[i] >> 3) | ((d[i + 1] >> 3) << 5) | ((d[i + 2] >> 3) << 10) | ((d[i + 3] >> 5) << 15); x = Math.imul(x, 16777619) >>> 0 } return { x, ink } }
  const rows = nw.map(i => { const a = V.sampleAura(i.id, 20000), b = V.sampleAura(i.id, 20330), ha = h(a), hb = h(b); return { id: i.id, fx: i.au.fx, hash: ha.x, ink: ha.ink, moved: ha.x !== hb.x } })
  const old = window.__V157B.auraKinds()
  return { n: nw.length, fx: new Set(nw.map(i => i.au.fx)).size, kinds: V.auraKinds().length, clash: nw.filter(i => old.includes(i.au.fx)).map(i => i.id), uniq: new Set(rows.map(r => r.hash)).size, moved: rows.filter(r => r.moved).length, minInk: Math.min(...rows.map(r => r.ink)), rows } })
ok(au.n >= 15 && au.fx === au.n && au.kinds === au.n && au.clash.length === 0, '>= 15 new auras, each its own program (fx) in the v159 D registry, none reusing a v157 B one', { n: au.n, fx: au.fx, clash: au.clash })
ok(au.uniq === au.n && au.minInk > 300, 'every new aura draws its own picture (distinct pixel signatures, each well inked)', { unique: au.uniq, minInk: au.minInk })
ok(au.moved === au.n, 'every new aura is animated (a third of a second later it draws differently)', au.rows.filter(r => !r.moved).map(r => r.id))
// the aura gallery: the Locker's animated previews for every new aura
await E(() => { document.getElementById('g159')?.remove(); (window.RIB_TUNE = window.RIB_TUNE || {}).v157BpvRes = 3; const V = window.__V159D, C = window.RIB_COSMETICS, all = C.catalog(), g = document.createElement('div'); g.id = 'g159'
  g.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0b1320;display:grid;grid-template-columns:repeat(4,1fr);align-content:start;gap:4px;padding:6px;overflow:auto;font:700 10px Oswald,sans-serif;color:#e8edf4'
  V.items().filter(id => /^aura_/.test(id)).forEach(id => { const it = all.find(i => i.id === id), c = document.createElement('div'); c.style.cssText = 'display:flex;flex-direction:column;align-items:center;background:#16202e;border-radius:8px;padding:3px'
    const b = document.createElement('div'); b.className = 'cos-pvbox-v151b'; b.style.cssText = 'width:92px;height:92px'; c.appendChild(b); it.preview(b); const cv = b.querySelector('canvas'); if (cv) cv.style.cssText = 'width:92px;height:92px;image-rendering:pixelated'
    const t = document.createElement('div'); t.textContent = it.name + ' · ' + it.source; t.style.cssText = 'text-align:center;line-height:1.1'; c.appendChild(t); g.appendChild(c) })
  document.body.appendChild(g) })
await page.waitForTimeout(800); await shot('aura-gallery')
const gA = await E(() => new Promise(r => { const cv = [...document.querySelectorAll('#g159 canvas')], grab = () => cv.map(c => c.toDataURL().length + ':' + c.toDataURL().slice(-40)); const a = grab(); setTimeout(() => { const b = grab(); r({ n: cv.length, moved: a.filter((x, i) => x !== b[i]).length }) }, 400) }))
await E(() => { document.getElementById('g159')?.remove(); delete window.RIB_TUNE.v157BpvRes })
ok(gA.n === au.n && gA.moved >= au.n - 1, 'the Locker previews of the new auras animate', gA)

// ================= 5. sources =================
const srcs = await E(() => { const C = window.RIB_COSMETICS, V = window.__V159D, all = C.catalog(), nw = V.items().map(id => all.find(i => i.id === id))
  const by = {}; nw.forEach(i => { by[i.cat + ':' + i.source] = (by[i.cat + ':' + i.source] || 0) + 1 })
  const how = nw.map(i => ({ id: i.id, s: i.source, r: i.rarity, h: C.howTo(i), l: C.listed(i), o: C.owned(i.id) }))
  const bad = how.filter(x => !(x.s === 'member' ? x.h === 'Membership' && x.l && !x.o : x.s === 'earned' ? /^Earn it: /.test(x.h) && x.l && !x.o : x.s === 'free' ? x.h === 'Free' && x.l && x.o : false))
  const rules = window.__V156C.rules(), mem = V.member()
  return { by, bad, memberRules: mem.every(id => rules[id] === 'member'), memberHard: how.filter(x => x.s === 'member').every(x => /epic|legendary|mythic/.test(x.r)), freeSoft: how.filter(x => x.s === 'free').every(x => /common|rare/.test(x.r)),
    achOk: nw.filter(i => i.source === 'earned').every(i => C.achievements.some(a => a.id === i.ach) || /legacy300|rings3|rings5|gen5/.test(i.ach)), mem: mem.length } })
ok(srcs.by['crown:free'] >= 2 && srcs.by['crown:earned'] >= 4 && srcs.by['crown:member'] >= 4 && srcs.by['aura:free'] >= 1 && srcs.by['aura:earned'] >= 3 && srcs.by['aura:member'] >= 6 && srcs.achOk && srcs.memberHard && srcs.freeSoft,
  'the owner\'s split: a few plain ones free, some earned (their achievements exist), the flashiest (epic or better) member', srcs.by)
ok(srcs.bad.length === 0 && srcs.memberRules, 'member items are listed and locked ("Membership", never owned with the store OFF); earned "Earn it: …"; free owned — and v156 C\'s rule table names the member ones', srcs.bad.slice(0, 4))

// ================= 2b / 3b / 4b. the profile card =================
await own(['wings_demon', 'crown_orbit', 'aura_blackhole', 'crown_king', 'aura_dragon'])
await E(() => { const C = window.RIB_COSMETICS; C.equip('wings', 'wings_demon'); C.equip('crown', 'crown_orbit'); C.equip('aura', 'aura_blackhole') })
await E(() => window.go('profile')); await page.waitForTimeout(1900)
const cdW = await sample('#screen .pcard-v151b .pc-fl-v153g.back', 7200)
ok(cdW && cdW.beat >= 3 && cdW.flutter >= 4, 'the profile card: his wings flap and keep fluttering between flaps (the wing layer keeps changing)', cdW)
const cdC = await changes('#screen .pcard-v151b .pc-fl-v153g.front', 500)
const cdA = await changes('#screen .pcard-v151b .pc-au-v157b.back', 400)
const cdReg = await E(() => { const f = document.querySelector('#screen .pcard-v151b .pc-fl-v153g.front'); return { crown: f && f.dataset.crown, reg: f && f._crRegV159D, anim: window.__V157B.animating() } })
ok(cdC && cdC.moved && cdReg.crown === 'crown_orbit' && cdReg.reg === 'card' && cdA && cdA.moved, 'the card animates his crown (Crown of Stars: two frames of its layer differ) and the new aura (Event Horizon)', { crown: cdC, aura: cdA, reg: cdReg })
await shot('profile-card')

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
const allNew = await E(() => window.__V159D.items())
const owned = await own(allNew.concat(['wings_demon', 'wings_jet']))
ok(owned === allNew.length + 2, 'every new look can be owned for the field pass (member ones grandfathered, earned ones granted)', { owned, want: allNew.length + 2 })
await E(() => { const sc = window.__gridironScene; if (!window.__upd159) { window.__upd159 = sc.update; sc.update = function () {} } sc.time.paused = true; try { sc.tweens.pauseAll() } catch (e) {} })
const field = await E(async () => {
  const C = window.RIB_COSMETICS, sc = window.__gridironScene, V = window.__V159D, T = window.RIB_TUNE || {}, P = T.wingFlapPeriodV157A || 3400, D = T.wingFlapMsV157A || 760
  ;['trail', 'wings', 'crown', 'aura', 'numfont'].forEach(s => C.equip(s, null))
  C.equip('wings', 'wings_demon'); C.equip('crown', 'crown_storm'); C.equip('aura', 'aura_tesla')
  let m = sc.markers.find(q => q && q.team === 'you'); if (!m) { sc.highlight(sc.markers[5], true); m = sc.markers[5] }
  m.forceState = null; if (m.body) { m.body.setRotation(0); m.body.setVisible(true) }
  let rnd = 0; const orig = Math.random; Math.random = function () { if (/28-cosmetics/.test(String(new Error().stack))) rnd++; return orig() }
  const at = (t) => { sc.time.now = t; m._spdPx = 0; sc.placeMarker(m, m.sx, m.sy, 16); return { rot: m._wrV153G.rotation, sx: m._wrV153G.scaleX, vis: m._wrV153G.visible && m._wlV153G.visible, ck: m._crV153G && m._crV153G.texture.key, auB: !!(m._auBV157B && m._auBV157B.parentContainer === m.root), auF: !!(m._auFV157B && m._auFV157B.parentContainer === m.root) } }
  const base = P * 500, S = []
  try { for (let t = 0; t < 5000; t += 16) S.push(Object.assign(at(base + t), { ph: (base + t) % P })) } finally { Math.random = orig }
  let still = 0; for (let w = 0; w + 6 <= S.length; w += 6) { const rs = S.slice(w, w + 6).map(s => s.rot + s.sx); if (Math.max(...rs) - Math.min(...rs) < 0.002) still++ }
  const rest0 = -0.32   /* the wing's spread (cosWingSpreadV153G) */, beat = S.filter(s => s.ph < D).map(s => Math.abs(s.rot - rest0)), flut = S.filter(s => s.ph > D + 700 && s.ph < P - 400).map(s => Math.abs(s.rot - rest0))
  return { n: S.length, still, windows: Math.floor(S.length / 6), vis: S.every(s => s.vis), beatMax: Math.max(...beat), flutMax: Math.max(...flut), crownFrames: new Set(S.map(s => s.ck)).size, au: S.every(s => s.auB && s.auF), prims: window.__V157B.field.auraPrims, rnd, errs: window.__V153G.errs.concat(V.errs, window.__V157B.errs) }
})
ok(field.vis && field.still === 0 && field.windows > 40, 'the live field: his wings are never still — every 100 ms window of 5 s on the scene clock moves', { still: field.still, windows: field.windows })
ok(field.beatMax > 0.3 && field.flutMax < 0.18 && field.beatMax > 2 * field.flutMax, 'and a strong flap comes each period (the beat\'s swing a spike over the flutter\'s)', { beat: +field.beatMax.toFixed(3), flutter: +field.flutMax.toFixed(3) })
ok(field.crownFrames >= 6 && field.au && field.prims > 5 && field.prims <= 135, 'the crown animates on the field (its frames change on the scene clock); the new aura (Tesla Coils) adds its layers under its cap', { crownFrames: field.crownFrames, au: field.au, prims: field.prims })
ok(field.rnd === 0 && field.errs.length === 0, 'not one Math.random from src/28 while the field draws; no fx error', { rnd: field.rnd, errs: field.errs.slice(0, 3) })
const snap = await E(async () => { const sc = window.__gridironScene, m = sc.markers.find(q => q && q.team === 'you'), c = sc.cameras.main, T = window.RIB_TUNE || {}, P = T.wingFlapPeriodV157A || 3400
  sc.time.now = P * 520 + 200; sc.placeMarker(m, m.sx, m.sy, 16)
  try { c.stopFollow() } catch (e) {} c.useBounds = false; c.setZoom(3.2 / Math.max(0.2, m.root.scale)); c.centerOn(m.root.x, m.root.y - 6 * m.root.scale); await new Promise(r => setTimeout(r, 150))
  const RW = sc.game.renderer.width, RH = sc.game.renderer.height, gx = (m.root.x - c.worldView.x) * c.zoom + c.x, gy = (m.root.y - c.worldView.y) * c.zoom + c.y, Sz = Math.min(300, RW, RH)
  const x0 = Math.max(0, Math.min(RW - Sz, Math.round(gx - Sz / 2))), y0 = Math.max(0, Math.min(RH - Sz, Math.round(gy - Sz * 0.6)))
  return await new Promise(r => sc.game.renderer.snapshotArea(x0, y0, Sz, Sz, img => { const cv = document.createElement('canvas'); cv.width = Sz; cv.height = Sz; cv.getContext('2d').drawImage(img, 0, 0); r(cv.toDataURL()) })) })
saveUrl('field-wings-crown-aura', snap)
// the perf probe: the broadcast runs (his marker walked every frame by the stubbed update); a frame = prestep → postrender
const perf = (looks) => E(async (looks) => {
  const C = window.RIB_COSMETICS, sc = window.__gridironScene, game = sc.game
  ;['trail', 'wings', 'crown', 'aura', 'numfont'].forEach(s => C.equip(s, null)); looks.forEach(id => { const it = C.catalog().find(i => i.id === id); if (it) C.equip(it.cat, id) })
  const live = q => q && q.body && q.body.scene, m = sc.markers.find(q => live(q) && q.team === 'you') || sc.markers.find(live), hx = m.sx, hy = m.sy
  let k = 0, t0 = 0; const T = []
  sc.time.paused = false
  sc.update = function () { sc.time.now = 3e6 + k * 16; m._spdPx = 170; sc.placeMarker(m, hx + (k % 60) * 0.9, hy + (k % 60) * 0.15, 16); k++ }
  const pre = () => { t0 = performance.now() }, post = () => { if (t0) T.push(performance.now() - t0); t0 = 0 }
  game.events.on('prestep', pre); game.events.on('postrender', post)
  await new Promise(r => setTimeout(r, 2000))
  game.events.off('prestep', pre); game.events.off('postrender', post); sc.update = function () {}; sc.time.paused = true
  const b0 = performance.now(); for (let j = 0; j < 400; j++) { sc.time.now = 4e6 + j * 16; m._spdPx = 170; sc.placeMarker(m, hx + (j % 60) * 0.9, hy + (j % 60) * 0.15, 16) } const fx = (performance.now() - b0) / 400
  sc.placeMarker(m, hx, hy, 16)
  const mean = (a) => { const s = a.slice(Math.min(10, a.length >> 2)); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : null }
  return { frames: T.length, mean: T.length >= 12 ? +mean(T).toFixed(2) : null, fx: +fx.toFixed(4) }
}, looks)
const busy = ['wings_demon', 'crown_orbit', 'aura_blackhole', 'trail_inferno']
const PR = { none: [], busy: [] }
await perf(busy)   // a warm-up: the crown's frame textures and the aura's first draw are made once
for (let r = 0; r < 5; r++) { PR.none.push(await perf([])); PR.busy.push(await perf(busy)) }   // paired, interleaved
// the quietest credible run of each (>= 30 frames in 2 s): a machine under load only ever adds time. When no run of
// either kind is credible (a swamped machine drawing < 15 fps) the frame comparison is not judged — the flair's own
// CPU cost (placeMarker, measured directly) still is.
const best = (a, k) => { const v = a.filter(x => k !== 'mean' || x.frames >= 30).map(x => x[k]).filter(v => v != null); return v.length ? Math.min(...v) : null }
const pn = best(PR.none, 'mean'), pb = best(PR.busy, 'mean'), fn = best(PR.none, 'fx'), fb = best(PR.busy, 'fx'), judged = pn != null && pb != null
if (!judged) console.log('INFO the frame-time comparison was not judged: no credible quiet run (the machine is under load)')
ok((!judged || pb <= pn * 1.5 + 3) && fb < 1, 'perf: the quietest frame with fluttering wings + an animated crown + the busiest new aura + a trail stays within 50% (+3 ms) of the quietest with nothing equipped; his placeMarker (all the flair) < 1 ms', { judged, none: pn, busy: pb, placeMarkerMs: [fn, fb], runs: PR })
await E(() => { const sc = window.__gridironScene; sc.time.paused = false; try { sc.tweens.resumeAll() } catch (e) {} if (window.__upd159) { sc.update = window.__upd159; delete window.__upd159 } })

// ================= 7. no gameplay change =================
const neutral = await E(() => { const C = window.RIB_COSMETICS, st = window.__getGridironState(), keep = JSON.stringify(st.player || null)
  const seedRun = () => { let s = 5959; const orig = Math.random; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let v = Math.imul(s ^ s >>> 15, 1 | s); v = v + Math.imul(v ^ v >>> 7, 61 | v) ^ v; return ((v ^ v >>> 14) >>> 0) / 4294967296 }
    const out = []; try { for (let g = 0; g < 6; g++) { const r = window.__simGameV2(50 + g * 4, ['QB', 'RB', 'WR', 'LB'][g % 4]); out.push([r.usScore, r.themScore, r.plays.length, r.team.yds, r.oppTeam.yds]) } } finally { Math.random = orig }
    return JSON.stringify(out) }
  ;['trail', 'wings', 'crown', 'aura', 'numfont'].forEach(s => C.equip(s, null)); const a = seedRun(); st.player = JSON.parse(keep)
  C.equip('wings', 'wings_jet'); C.equip('crown', 'crown_skull'); C.equip('aura', 'aura_phoenix')
  const eq = [C.equipped('wings'), C.equipped('crown'), C.equipped('aura')]; const b = seedRun(); st.player = JSON.parse(keep)
  return { same: a === b, a: a.slice(0, 80), eq } })
ok(neutral.same && neutral.eq.join() === 'wings_jet,crown_skull,aura_phoenix', 'seeded games score identically with nothing equipped and with fluttering wings, a new crown and a new aura', neutral)
const fe = await E(() => window.__V159D.errs.concat(window.__V157A.errs, window.__V157B.errs, window.__V153G.errs))
ok(fe.length === 0, 'the v159 D drawers ran without an error', fe)
ok(errs.length === 0, 'no page errors', errs.slice(0, 6))
console.log(JSON.stringify({ pass, fail, errors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
