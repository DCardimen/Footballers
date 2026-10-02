// Dev check: v177 F/G/H — TEN NEW FOOTSTEPS, TEN NEW WINGS, EVERY HAT FLOATS (src/28-cosmetics.js, the v177 F/G/H
// blocks), at a 400x860 phone:
//   1. the catalogue: 10 new footprints and 10 new wings, every one mythic and SUPER (only a super challenge grants
//      one: locked, listed "Super challenge: …", an earned / pass grant is refused), each its own fx / kind
//   2. every new footprint draws a non-empty picture of its own and animates; TU v177Ftrail 0 → its base v153 G kind
//   3. every new wing's art is well inked, its own (unique pixel hash over every catalogue wing), and animates (its
//      frames differ, the frame clock cycles); TU v177Gwings 0 → frame 0
//   4. the ten new super challenges join v156 C's list, each paying a wing + a footprint; finishing one grants both,
//      once; the section rows name both
//   5. the Locker lists them (drawn previews, locked, "Super challenge")
//   6. every hat hovers: each catalogue crown's baseline sits ABOVE the helmet (on a canvas, its opaque ink ends over
//      the helmet top), it bobs, a shadow / glow sits under it; reduced motion → still; TU v177Hfloat 0 → seated again;
//      the profile card draws it (the hover layer counted)
//   7. the live field: each new footprint draws behind him (distinct frames), each new wing is worn (its kind posed),
//      the crown hovers over the helmet with its shadow image under it; no Math.random from src/28
//   8. seeded games identical with nothing / the new looks equipped; no page errors
// Screenshots go to $SHOTS (default /tmp/claude-0/shots/), prefixed v177F_ / v177G_ / v177H_.
//   node scripts/v177FGHcheck.mjs        (GAME_URL=http://localhost:5173/)
import fs from 'node:fs'
import { gameUrl, launch } from './lib/env.mjs'
const SHOTS = process.env.SHOTS || '/tmp/claude-0/shots/'
try { fs.mkdirSync(SHOTS, { recursive: true }) } catch {}
const browser = await launch()
const page = await browser.newPage({ viewport: { width: 400, height: 860 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).join(' | ')))
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { setInterval(() => { document.querySelector('.onboard')?.remove() }, 60) })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const E = (fn, arg) => page.evaluate(fn, arg)
const boot = async () => {
  await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(1200)
  await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && window.RIB_COSMETICS && window.__V177F && window.__V177G && window.__V177H && window.__V177H.off, null, { timeout: 60000 })
  await page.waitForTimeout(600)
}
await boot(); await page.goto(gameUrl(), { waitUntil: 'networkidle' }); await boot()   // warm past vite's one-time reload
const shot = async (name) => { try { await page.screenshot({ path: SHOTS + name + '.png' }) } catch {} }
const saveUrl = (name, url) => { try { if (url) fs.writeFileSync(SHOTS + name + '.png', Buffer.from(url.split(',')[1], 'base64')) } catch {} }
await E(() => { window.__h177 = (cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 2166136261 >>> 0, ink = 0
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 30) ink++; h ^= (d[i] >> 3) | ((d[i + 1] >> 3) << 5) | ((d[i + 2] >> 3) << 10) | ((d[i + 3] >> 5) << 15); h = Math.imul(h, 16777619) >>> 0 } return { h, ink } } })
await E(() => { window.RIB_COSMETICS._reset(); window.__V156C.resetSuper() })

// ================= 1. the catalogue =================
const cat = await E(() => {
  const C = window.RIB_COSMETICS, all = C.catalog(), F = window.__V177F.ids(), G = window.__V177G.ids(), by = id => all.find(i => i.id === id)
  const fi = F.map(by).filter(Boolean), gi = G.map(by).filter(Boolean)
  const otherKinds = all.filter(i => i.cat === 'wings' && i.w && !G.includes(i.id)).map(i => i.w.kind)
  const tk = window.__V157B.trailKinds()
  const refused = F.concat(G).filter(id => !C.grant(id, 'earned') && !C.grant(id, 'pass')).length
  return { nF: fi.length, nG: gi.length, catOk: fi.every(i => i.cat === 'trail' && i.tr && i.tr.fx) && gi.every(i => i.cat === 'wings' && i.w),
    mythic: fi.concat(gi).filter(i => i.rarity === 'mythic').length, sup: fi.concat(gi).filter(i => i.source === 'super').length,
    fx: new Set(fi.map(i => i.tr.fx)).size, fxReg: fi.filter(i => tk.includes(i.tr.fx)).length,
    kinds: new Set(gi.map(i => i.w.kind)).size, clash: gi.filter(i => otherKinds.includes(i.w.kind)).map(i => i.id),
    owned: fi.concat(gi).filter(i => C.owned(i.id)).length, listed: fi.concat(gi).filter(i => C.listed(i)).length,
    how: fi.concat(gi).filter(i => /^Super challenge: \S/.test(C.howTo(i))).length, sample: C.howTo(gi[0]) + ' | ' + C.howTo(fi[1]), refused,
    superItems: F.concat(G).filter(id => C.superItems().includes(id)).length }
})
ok(cat.nF === 10 && cat.nG === 10 && cat.catOk, '10 new footprints and 10 new wings are in the catalogue', { F: cat.nF, G: cat.nG })
ok(cat.mythic === 20 && cat.sup === 20 && cat.superItems === 20, 'all twenty are mythic SUPER looks (on RIB_COSMETICS.superItems())', { mythic: cat.mythic, super: cat.sup, superItems: cat.superItems })
ok(cat.fx === 10 && cat.fxReg === 10 && cat.kinds === 10 && cat.clash.length === 0, 'each footprint is its own program (registered with v157 B\'s trails) and each wing its own new kind', { fx: cat.fx, reg: cat.fxReg, kinds: cat.kinds, clash: cat.clash })
ok(cat.owned === 0 && cat.listed === 20 && cat.how === 20 && cat.refused === 20, 'locked until a super challenge pays: listed, "Super challenge: …", an earned or pass grant refused', { owned: cat.owned, how: cat.sample })

// ================= 2. the footprints draw, each its own, and animate =================
const tr = await E(() => { const V = window.__V177F, H = window.__h177, out = { ink: {}, hs: {}, moved: 0 }
  V.ids().forEach(id => { const a = V.sample(id, 20000), b = V.sample(id, 20330); const ha = H(a), hb = H(b); out.ink[id] = ha.ink; out.hs[id] = ha.h; if (ha.h !== hb.h) out.moved++ })
  const T = window.RIB_TUNE = window.RIB_TUNE || {}; T.v177Ftrail = 0; out.off = V.ids().filter(id => { const c = V.sample(id, 20000), h = H(c); return h.ink > 20 && h.h !== out.hs[id] }).length; delete T.v177Ftrail
  return out })
const minInk = Math.min(...Object.values(tr.ink))
ok(minInk > 150 && new Set(Object.values(tr.hs)).size === 10, 'every new footprint draws its own picture (10 distinct pixel signatures, each inked)', { minInk, ink: tr.ink })
ok(tr.moved === 10, 'every new footprint animates (a third of a second later it draws differently)', { moved: tr.moved })
ok(tr.off === 10, 'TU v177Ftrail 0: each draws as its base v153 G kind instead (still inked, a different picture)', { off: tr.off })

// ================= 3. the wings =================
const wg = await E(() => { const C = window.RIB_COSMETICS, G = window.__V177G, H = window.__h177, all = C.catalog().filter(i => i.cat === 'wings' && i.w && !/^pass\./.test(i.id)), out = { ink: {}, anim: 0, cyc: 0 }
  const hs = {}; all.forEach(i => { hs[i.id] = H(C.wingArt(i.w, 0).cv).h })
  G.ids().forEach(id => { const a = G.art(id, 0), b = G.art(id, 1); out.ink[id] = H(a.cv).ink; if (H(a.cv).h !== H(b.cv).h) out.anim++
    const k = all.find(i => i.id === id).w.kind, fr = new Set(); for (let t = 5e5; t < 5e5 + 3000; t += 37) fr.add(G.frame(k, t)); if (fr.size === G.frames(k)) out.cyc++ })
  out.uniq = new Set(Object.values(hs)).size; out.n = all.length; out.clash = G.ids().filter(id => all.some(o => o.id !== id && hs[o.id] === hs[id]))
  const T = window.RIB_TUNE = window.RIB_TUNE || {}; T.v177Gwings = 0; out.offFrames = G.ids().map(id => all.find(i => i.id === id).w.kind).filter(k => { const s = new Set(); for (let t = 5e5; t < 5e5 + 2000; t += 41) s.add(G.frame(k, t)); return s.size === 1 && s.has(0) }).length; delete T.v177Gwings
  return out })
ok(Math.min(...Object.values(wg.ink)) > 120 && wg.clash.length === 0 && wg.uniq === wg.n, 'every new wing is well inked and its own picture (no catalogue wing shares its pixels)', { minInk: Math.min(...Object.values(wg.ink)), uniq: wg.uniq + '/' + wg.n, clash: wg.clash })
ok(wg.anim === 10 && wg.cyc === 10, 'every new wing animates: its frames differ and the frame clock runs through them', { anim: wg.anim, cycles: wg.cyc })
ok(wg.offFrames === 10, 'TU v177Gwings 0: they hold their first frame', { off: wg.offFrames })

// ================= 4. the super challenges =================
const sc = await E(() => { const C = window.RIB_COSMETICS, V = window.__V156C, R = window.RIB_SUPER, A = window.__GRIDIRON_AUDIT__, F = window.__V177F
  C._reset(); V.resetSuper(); const cnt = id => window.__V151B.grants.filter(g => g.id === id).length
  const S = A.freshState(); S.tutorialSeen = true; A.setState(S)
  const list = R.list(), mine = F.challenges(), rows = R.progress()
  const out = { n: list.length, mineIn: mine.filter(c => list.some(l => l.id === c.id && l.item === c.wings)).length, old: ['ladder10', 'allPositions', 'mvpInterstellar', 'goldRush', 'ultimate'].filter(id => list.some(l => l.id === id)).length,
    pairs: mine.filter(c => /^wings_/.test(c.wings) && /^trail_/.test(c.trail)).length, named: rows.filter(r => mine.some(c => c.id === r.id) && / \+ /.test(r.itemName)).length }
  S.careersCompleted = 29; R.tick(S); out.at29 = [C.owned('wings_bass'), C.owned('trail_gravity'), R.progress().find(r => r.id === 'careers30').have]
  S.careersCompleted = 30; R.tick(S); R.tick(S); window.RIB_COSMETICS.checkEarned(S)
  out.at30 = [C.owned('wings_bass'), C.owned('trail_gravity'), cnt('wings_bass'), cnt('trail_gravity'), window.__V151B.grants.filter(g => g.id === 'trail_gravity').map(g => g.source).join()]
  out.others = mine.filter(c => c.id !== 'careers30' && (C.owned(c.wings) || C.owned(c.trail))).length
  out.row = R.progress().find(r => r.id === 'careers30'); out.inSave = /wings_bass|trail_gravity/.test(localStorage.getItem('gridiron_save_v1') || '')
  return out })
ok(sc.mineIn === 10 && sc.old === 5 && sc.n >= 15 && sc.pairs === 10 && sc.named === 10, 'ten new super challenges join v156 C\'s five, each paying a wing + a footprint (the row names both)', { n: sc.n, mine: sc.mineIn, old: sc.old, named: sc.named })
ok(sc.at29[0] === false && sc.at29[2] === 29 && sc.at30[0] && sc.at30[1] && sc.at30[2] === 1 && sc.at30[3] === 1 && sc.at30[4] === 'super' && sc.others === 0 && sc.row.owned && !sc.inSave,
  'Thirty Careers: 29 progresses, the 30th grants Bass Drop + Gravity Well — once each, from the super challenge, outside the save', { at29: sc.at29, at30: sc.at30, others: sc.others })

// ================= 5. the Locker =================
await E(() => window.go('locker')); await page.waitForTimeout(900)
await E(() => { const t = document.querySelector('.hubv75-tab[data-sec="style"]'); t && t.click() }); await page.waitForTimeout(500)
const lock = async (cat, ids) => E(({ cat, ids }) => new Promise(r => { window.cosCatV151B(cat); setTimeout(() => {
  const rows = ids.map(id => document.querySelector('.cos-item-v151b[data-cos="' + id + '"]')).filter(Boolean)
  const first = rows[0]; first && first.scrollIntoView({ block: 'start' })
  r({ shown: rows.length, cv: rows.filter(e => e.querySelector('canvas')).length, txt: rows.filter(e => /Super challenge/i.test(e.textContent)).length, locked: rows.filter(e => e.classList.contains('locked') || !e.classList.contains('on')).length }) }, 900) }), { cat, ids })
const ids = await E(() => ({ F: window.__V177F.ids(), G: window.__V177G.ids() }))
const lw = await lock('wings', ids.G); await page.waitForTimeout(400); await shot('v177G_locker')
const lt = await lock('trail', ids.F); await page.waitForTimeout(400); await shot('v177F_locker')
ok(lw.shown === 10 && lw.cv >= 10 && lt.shown === 10 && lt.cv >= 10, 'the Locker lists every new wing and footprint with a drawn preview', { wings: lw, trails: lt })
ok(lw.txt + lt.txt >= 18, 'and their lock line names the super challenge', { wings: lw.txt, trails: lt.txt })

// ================= 6. every hat floats =================
const hat = await E(() => { const C = window.RIB_COSMETICS, H = window.__V177H, T = window.RIB_TUNE = window.RIB_TUNE || {}
  const crowns = C.catalog().filter(i => i.cat === 'crown' && i.cr && !/^pass\./.test(i.id))
  const low = (cd, t) => { const cv = document.createElement('canvas'); cv.width = 120; cv.height = 140; const x = cv.getContext('2d'); H.paint(x, cd, { top: 90, bot: 134, cx: 60, h: 44 }, 2, t)
    const d = x.getImageData(0, 0, 120, 140).data; let lo = -1, ink = 0; for (let y = 0; y < 140; y++) for (let xx = 0; xx < 120; xx++) { const a = d[(y * 120 + xx) * 4 + 3]; if (a >= 250) { lo = y; ink++ } } return { lo, ink } }
  const out = { n: crowns.length, above: 0, offNeg: 0, bad: [], shadow: 0 }
  crowns.forEach(i => { const offs = [0, 400, 900, 1300].map(t => H.off(i.cr.kind, 7e5 + t)), r = low(i.cr, 7e5)
    if (offs.every(o => o < -1.5)) out.offNeg++
    if (r.lo >= 0 && r.lo < 90) out.above++; else out.bad.push(i.id + ':' + r.lo) })
  // the shadow / glow: drawn under the hat, on the helmet (rows 86..94 carry translucent ink with the hover on, none with it off)
  const band = (cd) => { const cv = document.createElement('canvas'); cv.width = 120; cv.height = 140; const x = cv.getContext('2d'); H.paint(x, cd, { top: 90, bot: 134, cx: 60, h: 44 }, 2, 7e5); const d = x.getImageData(40, 88, 40, 6).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10 && d[i] < 250) n++; return n }
  const gold = crowns.find(i => i.id === 'crown_gold') || crowns[0]
  out.shadow = band(gold.cr)
  const bob = []; for (let t = 7e5; t < 7e5 + 2000; t += 50) bob.push(H.off('crown', t)); out.bob = +(Math.max(...bob) - Math.min(...bob)).toFixed(2)
  T.v177Hfloat = 0; out.offKill = H.off('crown', 7e5); const k = low(gold.cr, 7e5); out.killLow = k.lo; out.killShadow = band(gold.cr); delete T.v177Hfloat
  return out })
ok(hat.n >= 25 && hat.offNeg === hat.n && hat.above === hat.n, 'every catalogue hat hovers: its baseline is above the helmet and its opaque ink ends over the helmet top', { n: hat.n, offNeg: hat.offNeg, above: hat.above, bad: hat.bad.slice(0, 5) })
ok(hat.bob > 1 && hat.shadow > 20, 'it bobs like the halo, with a soft shadow / glow under it on the helmet', { bob: hat.bob, shadowPx: hat.shadow })
ok(hat.offKill === null && hat.killLow >= 90 && hat.shadow > hat.killShadow + 20, 'TU v177Hfloat 0: the crown sits on the helmet again (no hover, no shadow)', { off: hat.offKill, low: hat.killLow, shadow: hat.killShadow })
await page.emulateMedia({ reducedMotion: 'reduce' })
const still = await E(() => { const H = window.__V177H, s = new Set(); for (let t = 7e5; t < 7e5 + 2000; t += 50) s.add(H.off('crown', t).toFixed(3)); return { n: s.size, v: [...s][0] } })
await page.emulateMedia({ reducedMotion: 'no-preference' })
ok(still.n === 1 && +still.v < 0, 'prefers-reduced-motion: it still hovers, without the bob', still)
// the profile card: a crown and a new wing
await E(() => { window.RIB_COSMETICS.equip('crown', 'crown_pixel') })
await E(() => { const C = window.RIB_COSMETICS; C.equip('wings', 'wings_bass'); window.__V177H.card = 0; window.go('profile') }); await page.waitForTimeout(1500)
const card = await E(() => { const f = document.querySelector('#screen .pc-fl-v153g.front'), b = document.querySelector('#screen .pc-fl-v153g.back'); const H = window.__h177
  return { front: !!f, crown: f && f.getAttribute('data-crown'), wings: b && b.getAttribute('data-wings'), ink: f ? H(f).ink : 0, hov: window.__V177H.card } })
await E(() => { const f = document.querySelector('#screen .pc-fl-v153g.front'); f && f.scrollIntoView({ block: 'center' }) }); await page.waitForTimeout(300); await shot('v177H_profile')
ok(card.front && card.crown && card.ink > 50 && card.hov > 0 && card.wings === 'wings_bass', 'the profile card draws the hovering hat (and a new wing behind him)', card)

// ================= 7. the live field =================
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
let onField = false
for (let i = 0; i < 150; i++) { onField = await E(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.some(m => m && m.team === 'you'))); if (onField) break
  await E(() => { const g = document.getElementById('gv42go'); if (g && g.offsetParent) g.click() })
  if (i === 20 || i === 50 || i === 90) { await step('CONTINUE TO MATCH'); await step('Continue') }
  await page.waitForTimeout(500) }
if (!onField) onField = await E(() => { const s = window.__gridironScene; return !!(s && s.markers && s.markers.length >= 12) })
ok(onField, 'a new career reached the live field')
await page.waitForTimeout(1500)
await E((all) => { const C = window.RIB_COSMETICS; all.forEach(id => C.grant(id, 'super')) }, ids.F.concat(ids.G))
await E(() => { const s = window.__gridironScene; if (!window.__upd177) { window.__upd177 = s.update; s.update = function () {} } s.time.paused = true; try { s.tweens.pauseAll() } catch (e) {} })
const walk = (looks, snap) => E(async ({ looks, snap }) => {
  const C = window.RIB_COSMETICS, s = window.__gridironScene, G = window.__V153G, V = window.__V157B
  G.freeze = false
  ;['trail', 'wings', 'crown', 'aura', 'numfont'].forEach(k => C.equip(k, null))
  looks.forEach(id => { const it = C.catalog().find(i => i.id === id); if (it) C.equip(it.cat, id) })
  let m = s.markers.find(q => q && q.team === 'you'); if (!m) { s.highlight(s.markers[5], true); m = s.markers[5] }
  if (!window.__home177) window.__home177 = { sx: m.sx, sy: m.sy }
  const Hm = window.__home177, t0 = 1e6 + (window.__walk177 = (window.__walk177 || 0) + 1) * 1e4
  m.forceState = null; m._launchUntil = 0; if (m.body) { m.body.setRotation(0); m.body.setVisible(true) }
  V.trailId = null; V.trailPrims = 0; window.__V157A.field = null; window.__V177H.field = null
  let rnd = 0; const orig = Math.random; Math.random = function () { if (/28-cosmetics/.test(String(new Error().stack))) rnd++; return orig() }
  try { for (let k = 0; k < 28; k++) { s.time.now = t0 + k * 16; m._spdPx = 170; s.placeMarker(m, Hm.sx + k * 0.9, Hm.sy + k * 0.15, 16) } } finally { Math.random = orig }
  G.freeze = true
  const out = { rnd, lt: G.lastTrail, fx: V.trailId, prims: V.trailPrims, wing: window.__V157A.field && window.__V157A.field.kind, hat: window.__V177H.field, sh: !!(m._crShV177H && m._crShV177H.visible), errs: G.errs.concat(V.errs, window.__V177F.errs, window.__V177H.errs) }
  if (!snap) return out
  const holdAt = () => { try { s.placeMarker(m, Hm.sx + 27 * 0.9, Hm.sy + 27 * 0.15, 16) } catch (e) {} }
  if (window.__hold177) s.game.events.off('prerender', window.__hold177); window.__hold177 = holdAt; s.game.events.on('prerender', holdAt)
  const c = s.cameras.main; try { c.stopFollow() } catch (e) {} c.useBounds = false
  c.setZoom(3.2 / Math.max(0.2, m.root.scale)); c.centerOn(m.root.x - 10 * m.root.scale, m.root.y - 8 * m.root.scale)
  await new Promise(r => setTimeout(r, 120))
  const RW = s.game.renderer.width, RH = s.game.renderer.height, gx = (m.root.x - c.worldView.x) * c.zoom + c.x, gy = (m.root.y - c.worldView.y) * c.zoom + c.y
  const S = Math.min(300, RW, RH), x0 = Math.max(0, Math.min(RW - S, Math.round(gx - S * 0.7))), y0 = Math.max(0, Math.min(RH - S, Math.round(gy - S * 0.6)))
  const url = await new Promise(r => s.game.renderer.snapshotArea(x0, y0, S, S, img => { const cv = document.createElement('canvas'); cv.width = S; cv.height = S; cv.getContext('2d').drawImage(img, 0, 0); r(cv.toDataURL()) }))
  const px = await new Promise(r => { const im = new Image(); im.onload = () => { const cv = document.createElement('canvas'); cv.width = S; cv.height = S; const x = cv.getContext('2d'); x.drawImage(im, 0, 0); r(Array.from(x.getImageData(0, 0, S, S).data)) }; im.src = url })
  let hsh = 2166136261 >>> 0; for (let i = 0; i < px.length; i += 4) { hsh ^= (px[i] >> 4) | ((px[i + 1] >> 4) << 4) | ((px[i + 2] >> 4) << 8); hsh = Math.imul(hsh, 16777619) >>> 0 }
  return Object.assign(out, { url, hash: hsh })
}, { looks, snap })
const res = {}
for (const id of ids.F) { const w = await walk([id], true); res[id] = w; saveUrl('v177F_field_' + id.replace('trail_', ''), w.url) }
const behind = (l) => l && l.n > 5 ? ((l.cx - l.hx) * l.vx + (l.cy - l.hy) * l.vy) < 0 : false
const fOk = ids.F.filter(id => { const w = res[id]; return w.lt && w.lt.id === id && w.lt.drawn >= 3 && w.fx && w.prims > 5 && behind(w.lt) })
ok(fOk.length === 10 && new Set(ids.F.map(id => res[id].hash)).size === 10, 'every new footprint draws on the live field behind him (its own drawer, 10 distinct frames)', { ok: fOk.length, bad: ids.F.filter(id => !fOk.includes(id)).map(id => [id, res[id].lt && res[id].lt.drawn, res[id].prims]) })
ok(Math.max(...ids.F.map(id => res[id].prims)) <= 160, 'under v157 B\'s per-frame primitive cap', Object.fromEntries(ids.F.map(id => [id, res[id].prims])))
const kinds = await E(() => Object.fromEntries(window.__V177G.ids().map(id => [id, window.RIB_COSMETICS.catalog().find(i => i.id === id).w.kind])))
const wres = {}
for (const id of ids.G) { const w = await walk([id], true); wres[id] = w; saveUrl('v177G_field_' + id.replace('wings_', ''), w.url) }
ok(ids.G.every(id => wres[id].wing === kinds[id]) && new Set(ids.G.map(id => wres[id].hash)).size === 10, 'every new wing is worn on the live field (posed by the flap, 10 distinct frames)', Object.fromEntries(ids.G.map(id => [id, wres[id].wing])))
const hw = await walk(['crown_pixel', 'wings_peacock', 'trail_constellation'], true); saveUrl('v177H_field', hw.url)
const hw2 = await walk(['crown_pixel'], true); saveUrl('v177H_field_crown', hw2.url)
ok(hw2.hat && hw2.hat.crownY < hw2.hat.top - 1 && hw2.sh && hw2.hat.shY >= hw2.hat.top - 0.5 && hw2.hat.bob != null && hw2.hat.bob < hw2.hat.crownTop, 'the crown hovers over his helmet on the field, its shadow / glow on the helmet under it, the plumbob above it', hw2.hat)
const rnd = Object.values(res).concat(Object.values(wres), [hw, hw2]).reduce((s, w) => s + w.rnd, 0), fe = Object.values(res).concat(Object.values(wres), [hw, hw2]).reduce((s, w) => s.concat(w.errs), [])
ok(rnd === 0 && fe.length === 0, 'no Math.random from src/28 and no fx error while the new looks draw', { rnd, errs: fe.slice(0, 3) })
await E(() => { const s = window.__gridironScene; if (window.__hold177) s.game.events.off('prerender', window.__hold177); s.update = window.__upd177; s.time.paused = false; window.__V153G.freeze = false })

// ================= 8. no gameplay change =================
const neutral = await E((looks) => { const C = window.RIB_COSMETICS
  const seedRun = () => { let s = 9001; const orig = Math.random; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let v = Math.imul(s ^ s >>> 15, 1 | s); v = v + Math.imul(v ^ v >>> 7, 61 | v) ^ v; return ((v ^ v >>> 14) >>> 0) / 4294967296 }
    const out = []; try { for (let g = 0; g < 4; g++) { const r = window.__simGameV2(52 + g * 5, ['QB', 'RB', 'WR', 'LB'][g]); out.push([r.usScore, r.themScore, r.plays.length]) } } finally { Math.random = orig } return JSON.stringify(out) }
  ;['trail', 'wings', 'crown'].forEach(k => C.equip(k, null)); const a = seedRun()
  looks.forEach(id => { const it = C.catalog().find(i => i.id === id); if (it) C.equip(it.cat, id) }); const b = seedRun()
  return { same: a === b, a: a.slice(0, 60) } }, ['trail_chrome', 'wings_magma', 'crown_pixel'])
ok(neutral.same, 'seeded games are identical with nothing and with the new looks equipped', neutral)
ok(errs.length === 0, 'no page errors', errs.slice(0, 4))
await browser.close()
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
process.exit(fail || errs.length ? 1 : 0)
