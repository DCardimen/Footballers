// Dev check: v157 B — AURAS ALIVE, TRAILS YOU CAN SPOT (src/28-cosmetics.js, the v157 B block), at a 400x860 phone:
//   1. the catalogue: 19 new auras + 15 new footprint trails, each with its own art program (unique `fx`), a rarity, a
//      source (member / earned / free — the owner's "nicest looks are hard") and the Locker's lock line for it
//      ("🔒 Membership", "🔒 Earn it: …"); OFF-store member looks are listed, never owned
//   2. every new look draws a distinct picture (hashes of rendered canvases), and every aura MOVES (two times differ)
//   3. the profile card animates the equipped aura (two frames of its layer differ) — a new one and a v153 G one — and
//      draws one still frame under prefers-reduced-motion; the Locker previews of auras and footprints animate
//   4. the live field: each new trail draws behind him and each looks different; a new aura adds its particle layers;
//      no Math.random from src/28; a perf probe (frame time with the busiest trail + aura vs nothing equipped)
//   5. the kill switches (TU v157Baura / v157Btrail 0) restore the v153 G path; seeded games identical; no page errors
// Screenshots (the galleries, the card, a live-field frame) go to $SHOTS (default /tmp/claude-0/shots/).
//   node scripts/v157Bcheck.mjs        (GAME_URL=http://localhost:5173/)
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
  await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && window.RIB_COSMETICS && window.__V157B && window.__V157B.sample, null, { timeout: 60000 })
  await page.waitForTimeout(600)
}
await boot(); await page.goto(GAME_URL, { waitUntil: 'networkidle' }); await boot()   // warm past vite's one-time reload
const shot = async (name) => { try { await page.screenshot({ path: SHOTS + 'v157B-' + name + '.png' }) } catch {} }
/* he owns a look: member looks by the v156 C grandfather list (the store is OFF here), earned ones by a grant */
const own = (ids) => E((ids) => {
  const C = window.RIB_COSMETICS, all = C.catalog(), k = 'rib.cosmetics.v1'
  const mem = ids.filter(id => (all.find(i => i.id === id) || {}).source === 'member')
  if (mem.length) { const d = JSON.parse(localStorage.getItem(k) || 'null') || { v: 1, owned: {}, equipped: {}, ach: {} }; d.gf156 = d.gf156 || {}; mem.forEach(id => { d.gf156[id] = 1 }); d.v156C = d.v156C || Date.now(); localStorage.setItem(k, JSON.stringify(d)); window.__V156C.reloadCosmetics() }
  ids.forEach(id => { const it = all.find(i => i.id === id); if (it && it.source === 'earned') C.grant(id, 'earned') })
  return ids.filter(id => C.owned(id)).length
}, ids)

// ================= 1. the catalogue =================
await E(() => window.RIB_COSMETICS._reset())
const cat = await E(() => {
  const C = window.RIB_COSMETICS, V = window.__V157B, all = C.catalog(), ids = V.ids(), mine = ids.map(id => all.find(i => i.id === id)).filter(Boolean)
  const au = mine.filter(i => i.cat === 'aura'), tr = mine.filter(i => i.cat === 'trail')
  const src = {}; mine.forEach(i => { src[i.source] = (src[i.source] || 0) + 1 })
  const how = mine.map(i => ({ id: i.id, s: i.source, h: C.howTo(i), l: C.listed(i), o: C.owned(i.id) }))
  return { n: mine.length, ids: ids.length, au: au.length, tr: tr.length, auFx: new Set(au.map(i => i.au.fx)).size, trFx: new Set(tr.map(i => i.tr.fx)).size,
    kinds: [V.auraKinds().length, V.trailKinds().length], known: au.every(i => V.auraKinds().includes(i.au.fx)) && tr.every(i => V.trailKinds().includes(i.tr.fx)),
    uniq: new Set(all.map(i => i.id)).size === all.length, rar: mine.every(i => /^(common|rare|epic|legendary|mythic)$/.test(i.rarity)), src,
    memberHard: mine.filter(i => i.source === 'member').every(i => /epic|legendary|mythic/.test(i.rarity)),
    howOk: how.every(x => x.s === 'member' ? x.h === 'Membership' && x.l && !x.o : x.s === 'earned' ? /^Earn it: /.test(x.h) && x.l && !x.o : x.s === 'free' ? x.h === 'Free' && x.l && x.o : false),
    bad: how.filter(x => !(x.s === 'member' ? x.h === 'Membership' && x.l && !x.o : x.s === 'earned' ? /^Earn it: /.test(x.h) && x.l && !x.o : x.h === 'Free' && x.l && x.o)).slice(0, 4),
    counts: { aura: all.filter(i => i.cat === 'aura').length, trail: all.filter(i => i.cat === 'trail').length } }
})
ok(cat.n === 34 && cat.au === 19 && cat.tr === 15 && cat.uniq, '19 new auras and 15 new footprint trails, every id unique', { au: cat.au, tr: cat.tr, all: cat.counts })
ok(cat.auFx === 19 && cat.trFx === 15 && cat.kinds[0] === 19 && cat.kinds[1] === 15 && cat.known, 'each has its own art program (unique fx keys, each one drawn)', { auFx: cat.auFx, trFx: cat.trFx, kinds: cat.kinds })
ok(cat.rar && cat.src.member >= 18 && cat.src.earned >= 6 && cat.src.free >= 3 && cat.memberHard, 'the owner\'s split: most flashy ones member (epic or better), a few earned late, a couple free', cat.src)
ok(cat.howOk, 'the Locker\'s line per source: member "Membership" (listed, not owned with the store OFF), earned "Earn it: …", free owned', cat.bad)
await E(() => window.go('locker')); await page.waitForTimeout(900)
await E(() => { const t = document.querySelector('.hubv75-tab[data-sec="style"]'); t && t.click() }); await page.waitForTimeout(500)
const lk = await E(() => new Promise(r => { window.cosCatV151B('aura'); setTimeout(() => {
  const V = window.__V157B, ids = V.ids().filter(id => /^aura_/.test(id)), rows = ids.map(id => document.querySelector('.cos-item-v151b[data-cos="' + id + '"]'))
  const txt = (id) => { const e = document.querySelector('.cos-item-v151b[data-cos="' + id + '"] .cos-src-v151b'); return e ? e.textContent : '' }
  r({ shown: rows.filter(Boolean).length, cv: ids.filter(id => document.querySelector('.cos-item-v151b[data-cos="' + id + '"] canvas[data-v157b]')).length,
    storm: txt('aura_storm'), galaxy: txt('aura_galaxy'), sakura: txt('aura_sakura'), lockedStorm: !!document.querySelector('.cos-item-v151b.locked[data-cos="aura_storm"]') }) }, 900) }))
ok(lk.shown === 19 && lk.cv === 19 && /🔒 Membership/.test(lk.storm) && /🔒 Earn it/.test(lk.galaxy) && /TAP TO EQUIP/.test(lk.sakura) && lk.lockedStorm, 'the Locker lists every new aura with its drawn preview and its lock line', lk)

// ================= 2. distinct pictures, and they move =================
const sig = await E(() => {
  const V = window.__V157B, h = (c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let x = 2166136261 >>> 0, ink = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 30) ink++; x ^= (d[i] >> 3) | ((d[i + 1] >> 3) << 5) | ((d[i + 2] >> 3) << 10) | ((d[i + 3] >> 5) << 15); x = Math.imul(x, 16777619) >>> 0 } return { x, ink } }
  const out = { au: {}, tr: {}, moveAu: 0, moveTr: 0, inkAu: 1e9, inkTr: 1e9 }
  for (const id of V.ids()) { const a = V.sample(id, 20000), b = V.sample(id, 20330); if (!a || !b) continue; const ha = h(a), hb = h(b), k = /^aura_/.test(id) ? 'au' : 'tr'
    out[k][id] = ha.x; if (ha.x !== hb.x) out[k === 'au' ? 'moveAu' : 'moveTr']++; out[k === 'au' ? 'inkAu' : 'inkTr'] = Math.min(out[k === 'au' ? 'inkAu' : 'inkTr'], ha.ink) }
  // the old ones too: every v153 G aura animates on the card
  const olds = ['aura_glow', 'aura_team', 'aura_frost', 'aura_gold', 'aura_flame', 'aura_holy', 'aura_void', 'aura_founder', 'aura_supernova']
  out.oldMove = olds.filter(id => { const a = V.sample(id, 20000), b = V.sample(id, 20330); return a && b && h(a).x !== h(b).x }).length; out.olds = olds.length
  return out })
const uAu = new Set(Object.values(sig.au)).size, uTr = new Set(Object.values(sig.tr)).size
ok(Object.keys(sig.au).length === 19 && uAu === 19 && sig.inkAu > 400, 'every new aura draws its own picture (19 distinct pixel signatures, each well inked)', { distinct: uAu, minInk: sig.inkAu })
ok(Object.keys(sig.tr).length === 15 && uTr === 15 && sig.inkTr > 150, 'every new trail draws its own picture (15 distinct pixel signatures)', { distinct: uTr, minInk: sig.inkTr })
ok(sig.moveAu === 19 && sig.moveTr === 15 && sig.oldMove === sig.olds, 'they are animated: every new aura and trail, and every v153 G aura, draws differently a third of a second later', { au: sig.moveAu, tr: sig.moveTr, old: sig.oldMove + '/' + sig.olds })
// the galleries (screenshots): every new aura and every new footprint, animated previews at 2x
const gallery = async (prefix, name) => {
  await E((prefix) => { document.getElementById('g157')?.remove(); (window.RIB_TUNE = window.RIB_TUNE || {}).v157BpvRes = 3; const V = window.__V157B, C = window.RIB_COSMETICS, all = C.catalog(), g = document.createElement('div'); g.id = 'g157'
    g.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0b1320;display:grid;grid-template-columns:repeat(4,1fr);align-content:start;gap:4px;padding:6px;overflow:auto;font:700 10px Oswald,sans-serif;color:#e8edf4'
    V.ids().filter(id => id.startsWith(prefix)).forEach(id => { const it = all.find(i => i.id === id), c = document.createElement('div'); c.style.cssText = 'display:flex;flex-direction:column;align-items:center;background:#16202e;border-radius:8px;padding:3px'
      const b = document.createElement('div'); b.className = 'cos-pvbox-v151b'; b.style.cssText = 'width:92px;height:92px'; c.appendChild(b); it.preview(b); const cv = b.querySelector('canvas'); if (cv) cv.style.cssText = 'width:92px;height:92px;image-rendering:pixelated'
      const t = document.createElement('div'); t.textContent = it.name + ' · ' + it.source; t.style.cssText = 'text-align:center;line-height:1.1'; c.appendChild(t); g.appendChild(c) })
    document.body.appendChild(g) }, prefix)
  await page.waitForTimeout(700); await shot(name)
  const mv = await E(() => new Promise(r => { const cv = [...document.querySelectorAll('#g157 canvas')], grab = () => cv.map(c => c.toDataURL().length + ':' + c.toDataURL().slice(-40)); const a = grab(); setTimeout(() => { const b = grab(); r({ n: cv.length, moved: a.filter((x, i) => x !== b[i]).length }) }, 350) }))
  await E(() => { document.getElementById('g157')?.remove(); delete window.RIB_TUNE.v157BpvRes })
  return mv
}
const gA = await gallery('aura_', 'gallery-auras'), gT = await gallery('trail_', 'gallery-trails')
ok(gA.n === 19 && gA.moved >= 18 && gT.n === 15 && gT.moved >= 14, 'the Locker previews animate (auras and footprints; the prints stream away behind him)', { auras: gA, trails: gT })

// ================= 3. the profile card =================
await own(['aura_storm', 'aura_galaxy', 'aura_prism', 'trail_inferno', 'trail_meteor', 'aura_borealis'])
const card = async (id) => { await E((id) => window.RIB_COSMETICS.equip('aura', id), id); await E(() => window.go('profile')); await page.waitForTimeout(1300)
  return E(() => new Promise(r => { const b = document.querySelector('#screen .pc-au-v157b.back'), f = document.querySelector('#screen .pc-au-v157b.front')
    if (!b) return r({ back: false, anim: window.__V157B.animating() })
    const ink = (c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 30) n++; return n }
    const a = b.toDataURL(), af = f.toDataURL(), i0 = ink(b); setTimeout(() => r({ back: true, front: !!f, id: b.dataset.aura, moved: a !== b.toDataURL() || af !== f.toDataURL(), ink: i0, anim: window.__V157B.animating(), frames: (window.__V157B.card || {}).frames }), 400) })) }
const c1 = await card('aura_storm'); await shot('profile-storm')
ok(c1.back && c1.front && c1.id === 'aura_storm' && c1.moved && c1.ink > 800 && c1.anim.includes('card'), 'the profile card animates a new aura (Thunderhead) on its own layers: two frames differ', c1)
const c2 = await card('aura_glow')
ok(c2.back && c2.id === 'aura_glow' && c2.moved, 'and a v153 G aura (Soft Glow) animates on the card too', { moved: c2.moved, ink: c2.ink })
await page.emulateMedia({ reducedMotion: 'reduce' })
const c3 = await card('aura_prism')
ok(c3.back && c3.id === 'aura_prism' && !c3.moved && c3.ink > 400 && !c3.anim.includes('card'), 'prefers-reduced-motion: the card draws one still frame (the aura is there, it does not move)', { moved: c3.moved, ink: c3.ink, anim: c3.anim })
await page.emulateMedia({ reducedMotion: 'no-preference' })
const c4 = await card('aura_prism'); await shot('profile-prism')
ok(c4.moved, 'motion allowed again: the same card animates', { moved: c4.moved })
await E(() => window.go('locker')); await page.waitForTimeout(700)
await E(() => { const t = document.querySelector('.hubv75-tab[data-sec="style"]'); t && t.click() }); await page.waitForTimeout(400)
const lp = await E(() => new Promise(r => { window.cosCatV151B('trail'); setTimeout(() => { const c = document.querySelector('.cos-item-v151b[data-cos="trail_inferno"] canvas'); c && c.scrollIntoView({ block: 'center' }); const a = c && c.toDataURL()   // off-screen previews rest
  setTimeout(() => r({ has: !!c, moved: !!c && a !== c.toDataURL(), on: !!document.querySelector('.cos-item-v151b.on[data-cos="trail_none"]') }), 350) }, 700) }))
ok(lp.has && lp.moved, 'the Locker\'s FOOTPRINTS tab animates the Inferno preview', lp)
await shot('locker-trails')

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
const allNew = await E(() => window.__V157B.ids())
const owned = await own(allNew)
ok(owned === 34, 'every new look can be owned (member ones grandfathered, earned ones granted) for the field pass', { owned })
await E(() => { const sc = window.__gridironScene; if (!window.__updV157B) { window.__updV157B = sc.update; sc.update = function () {} } sc.time.paused = true; try { sc.tweens.pauseAll() } catch (e) {} })
const walk = (looks, snap) => E(async ({ looks, snap }) => {
  const C = window.RIB_COSMETICS, sc = window.__gridironScene, G = window.__V153G, V = window.__V157B
  G.freeze = false
  ;['trail', 'wings', 'crown', 'aura', 'numfont'].forEach(s => C.equip(s, null))
  looks.forEach(id => { const it = C.catalog().find(i => i.id === id); if (it) C.equip(it.cat, id) })
  let m = sc.markers.find(q => q && q.team === 'you'); if (!m) { sc.highlight(sc.markers[5], true); m = sc.markers[5] }
  if (!window.__homeV157B) window.__homeV157B = { sx: m.sx, sy: m.sy }
  const H = window.__homeV157B, t0 = 1e6 + (window.__walkN157 = (window.__walkN157 || 0) + 1) * 1e4
  m.forceState = null; m._launchUntil = 0; if (m.body) { m.body.setRotation(0); m.body.setVisible(true) }
  V.trailId = null; V.trailPrims = 0
  let rnd = 0; const orig = Math.random; Math.random = function () { if (/28-cosmetics/.test(String(new Error().stack))) rnd++; return orig() }
  try { for (let k = 0; k < 28; k++) { sc.time.now = t0 + k * 16; m._spdPx = 170; sc.placeMarker(m, H.sx + k * 0.9, H.sy + k * 0.15, 16) } } finally { Math.random = orig }
  G.freeze = true
  const out = { rnd, lt: G.lastTrail, fx: V.trailId, prims: V.trailPrims, auB: !!(m._auBV157B && m._auBV157B.parentContainer === m.root), auF: !!(m._auFV157B && m._auFV157B.parentContainer === m.root), auraPrims: V.field.auraPrims || 0, errs: G.errs.concat(V.errs) }
  if (!snap) return out
  // hold him where the walk left him while the frame is taken (his idle motion would walk him back to the whistle's spot)
  const holdAt = () => { try { sc.placeMarker(m, H.sx + 27 * 0.9, H.sy + 27 * 0.15, 16) } catch (e) {} }
  if (window.__hold157) sc.game.events.off('prerender', window.__hold157); window.__hold157 = holdAt; sc.game.events.on('prerender', holdAt)
  const c = sc.cameras.main; try { c.stopFollow() } catch (e) {} c.useBounds = false   /* the field edge would stop the camera short of him */
  c.setZoom(3.2 / Math.max(0.2, m.root.scale)); c.centerOn(m.root.x - 10 * m.root.scale, m.root.y - 6 * m.root.scale)
  await new Promise(r => setTimeout(r, 120))
  const RW = sc.game.renderer.width, RH = sc.game.renderer.height, gx = (m.root.x - c.worldView.x) * c.zoom + c.x, gy = (m.root.y - c.worldView.y) * c.zoom + c.y
  const S = Math.min(300, RW, RH), x0 = Math.max(0, Math.min(RW - S, Math.round(gx - S * 0.7))), y0 = Math.max(0, Math.min(RH - S, Math.round(gy - S * 0.6)))
  const url = await new Promise(r => sc.game.renderer.snapshotArea(x0, y0, S, S, img => { const cv = document.createElement('canvas'); cv.width = S; cv.height = S; cv.getContext('2d').drawImage(img, 0, 0); r(cv.toDataURL()) }))
  const px = await new Promise(r => { const im = new Image(); im.onload = () => { const cv = document.createElement('canvas'); cv.width = S; cv.height = S; const x = cv.getContext('2d'); x.drawImage(im, 0, 0); r(Array.from(x.getImageData(0, 0, S, S).data)) }; im.src = url })
  let hsh = 2166136261 >>> 0; for (let i = 0; i < px.length; i += 4) { hsh ^= (px[i] >> 4) | ((px[i + 1] >> 4) << 4) | ((px[i + 2] >> 4) << 8); hsh = Math.imul(hsh, 16777619) >>> 0 }
  return Object.assign(out, { url, hash: hsh })
}, { looks, snap })
const save = (name, r) => { try { if (r.url) fs.writeFileSync(SHOTS + 'v157B-' + name + '.png', Buffer.from(r.url.split(',')[1], 'base64')) } catch {} }
const w0 = await walk([], true); save('field-none', w0)
const trails = allNew.filter(id => id.startsWith('trail_')), res = {}
for (const id of trails) { const w = await walk([id], true); res[id] = w; if (id === 'trail_inferno' || id === 'trail_meteor' || id === 'trail_tron') save('field-' + id, w)
  if (id === 'trail_inferno') save('field-wide-inferno', await E(async () => {   // a wider broadcast frame (the whole canvas) for the eye
    const sc = window.__gridironScene, m = sc.markers.find(q => q && q.team === 'you') || sc.markers[5], c = sc.cameras.main; c.setZoom(1.6 / Math.max(0.2, m.root.scale)); c.centerOn(m.root.x - 14 * m.root.scale, m.root.y - 4 * m.root.scale)
    await new Promise(r => setTimeout(r, 150)); const R = sc.game.renderer
    return { url: await new Promise(r => R.snapshotArea(0, 0, R.width, R.height, img => { const cv = document.createElement('canvas'); cv.width = R.width; cv.height = R.height; cv.getContext('2d').drawImage(img, 0, 0); r(cv.toDataURL()) })) } })) }
const behind = (lt) => lt && lt.n > 5 ? ((lt.cx - lt.hx) * lt.vx + (lt.cy - lt.hy) * lt.vy) < 0 : false
const tOk = trails.filter(id => { const w = res[id]; return w.lt && w.lt.id === id && w.lt.drawn >= 3 && w.fx && w.prims > 5 && behind(w.lt) && w.hash !== w0.hash })
const hashes = new Set(trails.map(id => res[id].hash))
ok(tOk.length === 15, 'every new trail draws on the live field BEHIND him while he moves (its own drawer, primitives drawn)', { ok: tOk.length, bad: trails.filter(id => !tOk.includes(id)).map(id => [id, res[id].lt && res[id].lt.drawn, res[id].prims]) })
ok(hashes.size === 15, 'and each looks different on the field (15 distinct frames)', { distinct: hashes.size })
ok(Math.max(...trails.map(id => res[id].prims)) <= 160, 'the per-frame primitive cap holds (TU v157BtrailCap 160)', Object.fromEntries(trails.map(id => [id, res[id].prims])))
const wa = await walk(['aura_storm', 'trail_meteor'], true); save('field-storm-meteor', wa)
ok(wa.auB && wa.auF && wa.auraPrims > 10 && wa.auraPrims <= 135, 'a new aura adds its particle layers to HIS marker (behind and in front), under its cap', { auB: wa.auB, auF: wa.auF, prims: wa.auraPrims })
const rnd = Object.values(res).reduce((s, w) => s + w.rnd, 0) + wa.rnd, fe = Object.values(res).reduce((s, w) => s.concat(w.errs), []).concat(wa.errs)
ok(rnd === 0 && fe.length === 0, 'no Math.random from src/28 and no fx error while the new looks draw', { rnd, errs: fe.slice(0, 3) })

// the perf probe: the broadcast runs (his marker walked every frame by the stubbed update); a frame = prestep → postrender
const perf = (looks) => E(async (looks) => {
  const C = window.RIB_COSMETICS, sc = window.__gridironScene, G = window.__V153G, game = sc.game
  if (window.__hold157) { game.events.off('prerender', window.__hold157); window.__hold157 = null }   // the snapshots' hold lets go of him
  G.freeze = false; ['trail', 'wings', 'crown', 'aura', 'numfont'].forEach(s => C.equip(s, null)); looks.forEach(id => { const it = C.catalog().find(i => i.id === id); if (it) C.equip(it.cat, id) })
  const m = sc.markers.find(q => q && q.team === 'you') || sc.markers[5], H = window.__homeV157B
  let k = 0, t0 = 0, fx = 0; const T = [], F = []
  sc.update = function () { sc.time.now = 3e6 + k * 16; m._spdPx = 170; const a = performance.now(); sc.placeMarker(m, H.sx + (k % 60) * 0.9, H.sy + (k % 60) * 0.15, 16); F.push(performance.now() - a); k++ }
  const pre = () => { t0 = performance.now() }, post = () => { if (t0) T.push(performance.now() - t0); t0 = 0 }
  game.events.on('prestep', pre); game.events.on('postrender', post)
  await new Promise(r => setTimeout(r, 2600))
  game.events.off('prestep', pre); game.events.off('postrender', post); sc.update = function () {}
  const b0 = performance.now(); for (let j = 0; j < 400; j++) { sc.time.now = 4e6 + j * 16; m._spdPx = 170; sc.placeMarker(m, H.sx + (j % 60) * 0.9, H.sy + (j % 60) * 0.15, 16) } fx = (performance.now() - b0) / 400   // his placeMarker (flair included), per call
  const med = (a) => { const s = a.slice(20).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0 }
  const mean = (a) => { const s = a.slice(20); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : 0 }
  return { frames: T.length, med: +med(T).toFixed(2), mean: +mean(T).toFixed(2), fx: +fx.toFixed(4) }
}, looks)
const busy = ['trail_inferno', 'aura_borealis']
const P = { none: [], busy: [] }
for (let r = 0; r < 3; r++) { P.none.push(await perf([])); P.busy.push(await perf(busy)) }
const avg = (a, k) => a.reduce((s, x) => s + x[k], 0) / a.length, best = (a, k) => Math.min(...a.map(x => x[k]))   // the quietest run of each: a machine under load (parallel checks) only ever adds time
const pn = best(P.none, 'mean'), pb = best(P.busy, 'mean'), fn = avg(P.none, 'fx'), fb = avg(P.busy, 'fx')
ok(P.none.every(p => p.frames > 20) && P.busy.every(p => p.frames > 20) && pb <= pn * 1.5 + 2, 'perf: a frame with the busiest trail + aura (Inferno + Aurora Borealis) stays within 50% (+2 ms) of nothing equipped', { none: +pn.toFixed(2), busy: +pb.toFixed(2), placeMarkerMs: [+fn.toFixed(4), +fb.toFixed(4)], runs: P })

// ================= 5. kill switches, no gameplay change =================
const ks = await E(async () => {
  const C = window.RIB_COSMETICS, sc = window.__gridironScene, V = window.__V157B, G = window.__V153G, m = sc.markers.find(q => q && q.team === 'you') || sc.markers[5], H = window.__homeV157B
  window.RIB_TUNE = window.RIB_TUNE || {}; window.RIB_TUNE.v157Baura = 0; window.RIB_TUNE.v157Btrail = 0
  G.freeze = false; C.equip('trail', 'trail_inferno'); C.equip('aura', 'aura_storm'); V.trailId = null
  for (let k = 0; k < 20; k++) { sc.time.now = 5e6 + k * 16; m._spdPx = 170; sc.placeMarker(m, H.sx + k * 0.9, H.sy + k * 0.15, 16) }
  const out = { trailFx: V.trailId, auB: !!m._auBV157B, kind: G.lastTrail && G.lastTrail.kind, drawn: G.lastTrail && G.lastTrail.drawn }
  const el = document.createElement('div'); document.body.appendChild(el); C.renderCard(C.profile(), el); await new Promise(r => setTimeout(r, 200))
  out.cardLayer = el.querySelectorAll('.pc-au-v157b').length; const b = el.querySelector('.pc-fl-v153g.back'); out.cardStatic = !!b && b.dataset.aura === 'aura_storm'; el.remove()
  const pv = document.createElement('div'); document.body.appendChild(pv); C.catalog().find(i => i.id === 'aura_storm').preview(pv); out.pv = !!pv.querySelector('canvas') && !pv.querySelector('canvas[data-v157b]'); pv.remove()
  delete window.RIB_TUNE.v157Baura; delete window.RIB_TUNE.v157Btrail; C.equip('trail', null); C.equip('aura', null)
  return out })
ok(ks.trailFx == null && ks.kind === 'flame' && ks.drawn > 0 && !ks.auB && ks.cardLayer === 0 && ks.cardStatic && ks.pv, 'TU v157Baura / v157Btrail 0: the v153 G path (Inferno draws as flame, the aura static, no particle layers, still previews)', ks)
await E(() => { const sc = window.__gridironScene; sc.time.paused = false; try { sc.tweens.resumeAll() } catch (e) {} if (window.__updV157B) { sc.update = window.__updV157B; delete window.__updV157B } window.__V153G.freeze = false })
const neutral = await E(() => { const C = window.RIB_COSMETICS, st = window.__getGridironState(), keep = JSON.stringify(st.player || null)
  const seedRun = () => { let s = 4242; const orig = Math.random; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let v = Math.imul(s ^ s >>> 15, 1 | s); v = v + Math.imul(v ^ v >>> 7, 61 | v) ^ v; return ((v ^ v >>> 14) >>> 0) / 4294967296 }
    const out = []; try { for (let g = 0; g < 5; g++) { const r = window.__simGameV2(50 + g * 4, ['QB', 'RB', 'WR', 'LB', 'CB'][g]); out.push([r.usScore, r.themScore, r.plays.length, r.team.yds, r.oppTeam.yds]) } } finally { Math.random = orig }
    return JSON.stringify(out) }
  C.equip('trail', null); C.equip('aura', null); const a = seedRun(); st.player = JSON.parse(keep)
  C.equip('trail', 'trail_meteor'); C.equip('aura', 'aura_prism'); const b = seedRun(); st.player = JSON.parse(keep)
  return { same: a === b, a: a.slice(0, 60), eq: [C.equipped('trail'), C.equipped('aura')] } })
ok(neutral.same && neutral.eq.join() === 'trail_meteor,aura_prism', 'seeded games score identically with nothing and with a new trail + aura equipped', neutral)
const fe2 = await E(() => window.__V157B.errs.concat(window.__V153G.errs)); ok(fe2.length === 0, 'the v157 B drawers ran without an error', fe2)

console.log(JSON.stringify({ pass, fail, errors: errs.length }))
console.log('page errors:', errs.length ? errs.slice(0, 8) : 'none')
ok(errs.length === 0, 'no page errors')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
