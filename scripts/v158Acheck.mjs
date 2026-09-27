// Dev check: v158 A — THE CARD, DRESSED (src/28-cosmetics.js), at a 400x860 phone:
//   1. the catalogue: >= 20 new banners and >= 8 new items in every other card slot (titles, badges, nameplates, frames,
//      shelves, recaps, vault themes, stadiums, celebrations, number fonts); every new item free, earned (a real rule the
//      Locker quotes) or member; each slot has free + earned + member; no mythic is free; member looks are listed
//      "🔒 Membership", never owned or granted with the store OFF; an icon-earned look is granted once its icon is held
//   2. banners: every banner (new and old) has a painter with its own art (pixel hash per banner), animates (t -> t+0.7
//      changes pixels), is deterministic (same t, same pixels), no Math.random draw; on the profile card the band
//      animates, and under prefers-reduced-motion it holds one still frame
//   3. the other slots on the card: a rarity-styled title, a drawn badge, a material nameplate, an animated frame ring,
//      a shelf; the Locker draws a preview for each new item (banners animate), member items read "🔒 Membership"
//   4. number fonts: >= 8 new faces; every face renders distinct art (hash) and >= 12 distinct glyph SHAPES; legible
//      (ink height >= 85% of the asked height, fill vs outline luminance contrast); the profile chest wears the drawn
//      face (and the old text with TU v158Anf 0); the Locker preview draws it
//   5. helmet stripes: on the field sprite art, front / back frames carry the stripe down the middle of the helmet, side
//      frames along the top edge (front-to-back); the old centre-column stripe (TU v158Ahelm 0) failed the side frames;
//      twin stripes and decals follow; the profile figure draws the decal / twin stripe
//   6. the live field: his number is the drawn face (an image over the label); the "you" texture's helmet stripe follows
//      the facing on the real registered textures
//   7. seeded games identical with every v158 A look equipped and with the switches off; no page errors
// Screenshots go to $SHOTS (default /tmp/claude-0/shots/), prefixed v158A-.
//   node scripts/v158Acheck.mjs        (GAME_URL=http://localhost:5173/)
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
  await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && window.RIB_COSMETICS && window.__V158A && window.__CHASE_V94 && window.__CHASE_V94.ready, null, { timeout: 60000 })
  await page.waitForTimeout(600)
}
await boot(); await page.goto(GAME_URL, { waitUntil: 'networkidle' }); await boot()   // warm past vite's one-time reload
const shot = async (name, sel) => { try { if (sel) { const el = await page.$(sel); if (el) { await el.screenshot({ path: SHOTS + 'v158A-' + name + '.png' }); return } } await page.screenshot({ path: SHOTS + 'v158A-' + name + '.png' }) } catch {} }
// Math.random is watched from here on: a look must never draw from the game's stream
await E(() => { const o = Math.random; window.__mr158 = 0; Math.random = function () { if (window.__mr158on) window.__mr158++; return o.apply(this, arguments) } })

// ================= 1. the catalogue =================
const cat = await E(() => { const C = window.RIB_COSMETICS, V = window.__V158A, all = C.catalog(), mine = V.items(), by = {}
  mine.forEach(i => { (by[i.cat] = by[i.cat] || []).push(i) })
  const counts = Object.fromEntries(Object.keys(by).map(k => [k, by[k].length]))
  const srcs = Object.fromEntries(Object.keys(by).map(k => [k, [...new Set(by[k].map(i => i.source))].sort().join(',')]))
  const bad = mine.filter(i => !/^(free|earned|member)$/.test(i.source)).map(i => i.id)
  const earned = mine.filter(i => i.source === 'earned'), how = earned.filter(i => !/^Earn it: .{8,}/.test(C.howTo(all.find(q => q.id === i.id)))).map(i => i.id)
  const mem = mine.filter(i => i.source === 'member')
  const memState = mem.map(i => ({ id: i.id, listed: C.listed(all.find(q => q.id === i.id)), owned: C.owned(i.id), grant: C.grant(i.id, 'earned'), how: C.howTo(all.find(q => q.id === i.id)) }))
  const freeMythic = mine.filter(i => i.source === 'free' && i.rarity === 'mythic').map(i => i.id)
  const flashy = mine.filter(i => /legendary|mythic/.test(i.rarity)), flashyFree = flashy.filter(i => i.source === 'free').length
  const ids = mine.map(i => i.id), dup = ids.length - new Set(ids).size
  const old = ['ban_charcoal', 'ban_gridiron', 'ban_lights', 'ban_lineage', 'ban_sunset', 'ban_aurora', 'ban_founder', 'frame_basic', 'plate_none', 'title_none', 'badge_none', 'nf_varsity', 'nf_gold'].filter(id => !all.some(q => q.id === id))
  return { counts, srcs, bad, how, mem: memState.length, memListed: memState.filter(m => m.listed && /Membership/.test(m.how)).length, memOwned: memState.filter(m => m.owned || m.grant).length, freeMythic, flashy: flashy.length, flashyFree, dup, old } })
const SLOTS = ['title', 'badge', 'nameplate', 'frame', 'shelf', 'recap', 'vault', 'stadium', 'celebration', 'numfont']
ok(cat.counts.banner >= 20 && SLOTS.every(s => (cat.counts[s] || 0) >= 8), '>= 20 new banners and >= 8 new items in every other card slot', cat.counts)
ok(cat.bad.length === 0 && cat.how.length === 0 && cat.dup === 0 && cat.old.length === 0, 'every new item is free, earned (with a rule the Locker quotes) or member; ids unique; the old ids still exist (saves equip them)', { bad: cat.bad, how: cat.how.slice(0, 5), old: cat.old })
ok(['banner'].concat(SLOTS).every(s => /earned/.test(cat.srcs[s]) && /free/.test(cat.srcs[s]) && /member/.test(cat.srcs[s])), 'each slot mixes free, earned and member looks', cat.srcs)
ok(cat.freeMythic.length === 0 && cat.flashyFree === 0 && cat.flashy >= 30, 'the nicest are hard or membership: no legendary / mythic look is free', { flashy: cat.flashy, free: cat.flashyFree })
ok(cat.mem >= 15 && cat.memListed === cat.mem && cat.memOwned === 0, 'store OFF: every member look is listed "🔒 Membership", never owned, never granted', { n: cat.mem, listed: cat.memListed, owned: cat.memOwned })
const ic = await E(() => { const C = window.RIB_COSMETICS, k = 'rib.cosmetics.v1', d = JSON.parse(localStorage.getItem(k) || '{"v":1,"owned":{},"equipped":{},"ach":{}}')
  const before = C.owned('ban_scoreboard'); d.owned.ico_t4_1 = { source: 'earned', at: Date.now() }; localStorage.setItem(k, JSON.stringify(d)); window.__V156C.reloadCosmetics()
  const got = window.__V158A.iconEarnedTick(); return { before, after: C.owned('ban_scoreboard'), plate: C.owned('plate_varsity'), got, again: window.__V158A.iconEarnedTick().length } })
ok(!ic.before && ic.after && ic.plate && ic.again === 0, 'a look earned by an icon is granted once the icon is held (Varsity champion → Scoreboard banner, Varsity Felt plate)', ic)

// ================= 2. banners =================
const ban = await E(() => { const C = window.RIB_COSMETICS, V = window.__V158A, all = C.catalog().filter(i => i.cat === 'banner' && i.b158)
  window.__mr158on = true
  const px = (id, t) => { const cv = document.createElement('canvas'); cv.width = 160; cv.height = 58; V.paintBanner(cv, id, t); return cv.getContext('2d').getImageData(0, 0, 160, 58).data }
  const hash = (d) => { let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) } return h >>> 0 }
  const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) n++; return n }
  const rows = all.map(it => { const a = px(it.id, 11.3), a2 = px(it.id, 11.3), b = px(it.id, 12.0); let ink = 0; for (let i = 3; i < a.length; i += 4) if (a[i] > 200) ink++; return { id: it.id, kind: it.b158, h: hash(a), same: hash(a2) === hash(a), moved: diff(a, b), ink } })
  window.__mr158on = false
  return { n: rows.length, kinds: new Set(rows.map(r => r.kind)).size, uniq: new Set(rows.map(r => r.h)).size, det: rows.filter(r => !r.same).map(r => r.id), still: rows.filter(r => r.moved < 20).map(r => r.id + ':' + r.moved), empty: rows.filter(r => r.ink < 160 * 58 * 0.9).map(r => r.id), mr: window.__mr158 } })
ok(ban.n >= 33 && ban.kinds === ban.n && ban.uniq === ban.n && ban.empty.length === 0, 'every banner (26 new, 7 redrawn) has its own painter and its own art (a pixel hash each), filling the band', { n: ban.n, kinds: ban.kinds, uniq: ban.uniq, empty: ban.empty })
ok(ban.still.length === 0 && ban.det.length === 0 && ban.mr === 0, 'every banner animates (t → t+0.7s moves pixels), is deterministic from time, and draws no Math.random', { still: ban.still, det: ban.det, mathRandom: ban.mr })
// the gallery
await E(() => { const C = window.RIB_COSMETICS, V = window.__V158A, all = C.catalog().filter(i => i.cat === 'banner')
  const w = document.createElement('div'); w.id = 'g158'; w.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#0b0f16;width:400px;padding:4px;display:grid;grid-template-columns:1fr 1fr;gap:4px;font:9px Oswald,sans-serif;color:#dfe6ef'
  all.forEach(it => { const b = document.createElement('div'); const cv = document.createElement('canvas'); cv.width = 190; cv.height = 40; cv.style.cssText = 'display:block;width:190px;height:40px;border-radius:5px;background:' + it.bg; V.paintBanner(cv, it.id, 3.3); b.appendChild(cv); b.appendChild(document.createTextNode(it.name + ' · ' + it.rarity + ' · ' + it.source)); w.appendChild(b) })
  document.body.appendChild(w) })
await page.setViewportSize({ width: 400, height: 1400 }); await shot('banner-gallery', '#g158'); await page.setViewportSize({ width: 400, height: 860 })
await E(() => document.getElementById('g158')?.remove())
// on the profile card: the band animates; reduced motion holds one frame
const cardBan = async () => E(async () => { const C = window.RIB_COSMETICS; C.grant('ban_stadium_nights', 'earned'); C.equip('banner', 'ban_stadium_nights'); window.go('menu'); await new Promise(r => setTimeout(r, 200)); window.go('profile'); await new Promise(r => setTimeout(r, 1500))
  const cv = document.querySelector('#screen .pc-ban-v151b > canvas.pc-bcv-v158a'); if (!cv) return null
  const g = () => Array.from(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data); const a = g(); await new Promise(r => setTimeout(r, 700)); const b = g()
  let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 16) n++
  return { moved: n, w: cv.width, band: document.querySelector('#screen .pc-ban-v151b').dataset.b158, reg: window.__V158A.loop.list.length } })
const cb = await cardBan()
await shot('profile-card', '#screen .pcard-v151b')
ok(cb && cb.band === 'stadium' && cb.moved > 50, 'the profile card\'s band is the painter, and it animates', cb)
await page.emulateMedia({ reducedMotion: 'reduce' })
const cbR = await cardBan()
ok(cbR && cbR.band === 'stadium' && cbR.moved === 0, 'prefers-reduced-motion: the band holds one still frame', cbR)
await page.emulateMedia({ reducedMotion: 'no-preference' })

// ================= 3. the other slots on the card; the Locker =================
const slots = await E(async () => { const C = window.RIB_COSMETICS; const eq = { title: 'title_mvp', badge: 'badge_mvp', nameplate: 'plate_gold', frame: 'frame_aurora', shelf: 'shelf_walnut', banner: 'ban_marble' }
  Object.keys(eq).forEach(s => { C.grant(eq[s], 'earned'); C.equip(s, eq[s]) })
  window.go('menu'); await new Promise(r => setTimeout(r, 200)); window.go('profile'); await new Promise(r => setTimeout(r, 1500))
  const q = (s) => document.querySelector('#screen ' + s), cs = (el, p) => el ? getComputedStyle(el, p) : null
  const ti = q('.pc-title-v151b'), bd = q('.pc-bdg-v151b'), nm = q('.pc-name-v151b'), card = q('.pcard-v151b'), sh = q('.pc-shelf-v151b')
  const out = { title: ti && ti.className, titleAnim: cs(ti) && cs(ti).animationName, badge: bd && bd.className, badgeClip: cs(bd) && cs(bd).clipPath, plate: nm && nm.className, plateBg: cs(nm) && cs(nm).backgroundImage.slice(0, 40),
    frame: card && card.dataset.frame, ring: cs(card, '::after') && cs(card, '::after').animationName, ringBg: cs(card, '::after') && cs(card, '::after').backgroundImage.slice(0, 30), shelf: sh && sh.className }
  // every new frame's ring is its own
  const rings = window.__V158A.frames().map(k => { const d = document.createElement('div'); d.className = 'pcard-v151b fr-' + k; d.style.cssText = 'position:fixed;left:-500px;width:60px;height:60px'; document.body.appendChild(d); const c = getComputedStyle(d, '::after'), r = c.backgroundImage + '|' + c.animationName; d.remove(); return r })
  out.rings = rings.length; out.ringUniq = new Set(rings).size; out.ringNone = rings.filter(r => /^none/.test(r)).length
  return out })
await shot('profile-card-slots', '#screen .pcard-v151b')
ok(/t158-legendary/.test(slots.title) && slots.titleAnim === 't158Pan', 'the title wears its rarity (a legendary title shimmers in gold)', { cls: slots.title, anim: slots.titleAnim })
ok(/b158-star/.test(slots.badge) && /polygon/.test(slots.badgeClip || ''), 'the badge is a drawn pin (a star-shaped enamel)', { cls: slots.badge })
ok(/np158-gold/.test(slots.plate) && /gradient/.test(slots.plateBg || ''), 'the nameplate is a material (gold leaf)', { cls: slots.plate, bg: slots.plateBg })
ok(slots.frame === 'frame_aurora' && slots.ring === 'fr158Pan' && /gradient/.test(slots.ringBg || '') && slots.rings >= 12 && slots.ringUniq === slots.rings && slots.ringNone === 0, 'the frame is an animated ring round the card, every new frame its own ring', { ring: slots.ring, rings: slots.rings, uniq: slots.ringUniq })
ok(/sh-walnut158/.test(slots.shelf || ''), 'the shelf wears its new material', slots.shelf)
await E(() => window.go('locker')); await page.waitForTimeout(900)
await E(() => { const t = document.querySelector('.hubv75-tab[data-sec="style"]'); t && t.click() }); await page.waitForTimeout(500)
const gal = {}
for (const c of ['banner', 'title', 'badge', 'nameplate', 'frame', 'shelf', 'recap', 'numfont', 'vault', 'stadium', 'celebration']) {
  gal[c] = await E((c) => new Promise(r => { window.cosCatV151B(c); setTimeout(() => { const ids = window.__V158A.items().filter(i => i.cat === c).map(i => i.id), items = [...document.querySelectorAll('.cos-item-v151b')].filter(el => ids.includes(el.dataset.cos))
    const drawn = items.filter(el => { const b = el.querySelector('.cos-pvbox-v151b'); return b && b.children.length > 0 }).length
    const member = items.filter(el => /🔒 Membership/.test(el.textContent)).length, memWant = window.__V158A.items().filter(i => i.cat === c && i.source === 'member').length
    r({ n: items.length, want: ids.length, drawn, member, memWant, cv: document.querySelectorAll('.cos-item-v151b canvas.cos-ban-v158a').length }) }, 600) }), c)
  await shot('locker-' + c, '.cos-style-v151b')
}
ok(Object.values(gal).every(g => g.n === g.want && g.drawn === g.n && g.member === g.memWant), 'the Locker lists every new item in its slot with a drawn preview; member looks read "🔒 Membership"', gal)
const lockAnim = await E(async () => { window.cosCatV151B('banner'); await new Promise(r => setTimeout(r, 500)); const cv = document.querySelector('.cos-item-v151b[data-cos="ban_galaxy"] canvas'); if (!cv) return null
  const g = () => Array.from(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data); const a = g(); await new Promise(r => setTimeout(r, 600)); const b = g(); let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1]) n++; return n })
ok(lockAnim > 20, 'the Locker\'s banner previews animate (a member banner too — the incentive is visible)', { moved: lockAnim })

// ================= 4. number fonts =================
const nf = await E(() => { const V = window.__V158A, faces = V.faces(), C = window.RIB_COSMETICS
  window.__mr158on = true
  const hash = (d) => { let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) } return h >>> 0 }
  const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
  const rows = faces.map(f => { const r = V.numRender(f, '23', 30), r8 = V.numRender(f, '80', 30), m = V.numMask(f, '23', 30), m8 = V.numMask(f, '80', 30)
    const d = r.cv.getContext('2d').getImageData(0, 0, r.w, r.h).data, mk = V.numMask(f, '23', 30)
    // the fill is the glyph mask's pixels; the ring the opaque pixels just outside it
    const inM = new Uint8Array(r.w * r.h), mw = mk.w, off = [r.ix - mk.bb[0], r.iy - mk.bb[1]]
    for (let y = 0; y < mk.h; y++) for (let x = 0; x < mk.w; x++) if (mk.m[y * mw + x]) { const X = x + off[0], Y = y + off[1]; if (X >= 0 && Y >= 0 && X < r.w && Y < r.h) inM[Y * r.w + X] = 1 }
    let fl = 0, fn = 0, rl = 0, rn = 0
    for (let y = 1; y < r.h - 1; y++) for (let x = 1; x < r.w - 1; x++) { const j = y * r.w + x, i = j * 4; if (inM[j]) { const core = inM[j - 1] && inM[j + 1] && inM[j - r.w] && inM[j + r.w]; if (core) { fl += lum(d, i); fn++ } } else if (d[i + 3] > 200 && (inM[j - 1] || inM[j + 1] || inM[j - r.w] || inM[j + r.w])) { rl += lum(d, i); rn++ } }
    const small = V.numRender(f, '23', 16)
    return { f, art: hash(d) ^ hash(r8.cv.getContext('2d').getImageData(0, 0, r8.w, r8.h).data), shape: hash(m.m) ^ (m.w * 131) ^ hash(m8.m), contrast: Math.round(Math.abs((fn ? fl / fn : 0) - (rn ? rl / rn : 0))), ih: small.ih, ihAsk: 16 }
  })
  window.__mr158on = false
  const items = C.catalog().filter(i => i.cat === 'numfont'), styles = items.filter(i => i.nf).map(i => i.nf.style), missing = [...new Set(styles)].filter(s => !faces.includes(s))
  return { n: faces.length, art: new Set(rows.map(r => r.art)).size, shape: new Set(rows.map(r => r.shape)).size, low: rows.filter(r => r.contrast < 40).map(r => r.f + ':' + r.contrast), short: rows.filter(r => r.ih < r.ihAsk * 0.85).map(r => r.f + ':' + r.ih), missing, newN: window.__V158A.items().filter(i => i.cat === 'numfont').length, mr: window.__mr158 } })
ok(nf.newN >= 8 && nf.missing.length === 0, '>= 8 new number fonts, and every numfont in the catalogue (the old nf_* included) has a drawn face', { newN: nf.newN, faces: nf.n, missing: nf.missing })
ok(nf.art === nf.n && nf.shape >= 12, 'every face renders its own art (a hash each) and >= 12 distinct glyph shapes', { faces: nf.n, art: nf.art, shapes: nf.shape })
ok(nf.low.length === 0 && nf.short.length === 0 && nf.mr === 0, 'legible: the ink fills the asked height at 16 px, the fill contrasts with its outline; no Math.random', { low: nf.low, short: nf.short })
// the sheet
await E(() => { const V = window.__V158A, w = document.createElement('div'); w.id = 's158'; w.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#1f4fd0;width:400px;padding:6px;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font:9px Oswald,sans-serif;color:#fff'
  V.faces().forEach(f => { const b = document.createElement('div'); b.style.cssText = 'background:rgba(0,0,0,.25);border-radius:6px;padding:3px;text-align:center'; [['23', 34], ['80', 16]].forEach(q => { const r = V.numRender(f, q[0], q[1]); const c = document.createElement('canvas'); c.width = r.w; c.height = r.h; c.getContext('2d').drawImage(r.cv, 0, 0); c.style.cssText = 'image-rendering:pixelated;margin:0 3px;vertical-align:middle'; b.appendChild(c) }); b.appendChild(document.createElement('br')); b.appendChild(document.createTextNode(f)); w.appendChild(b) })
  document.body.appendChild(w) })
await page.setViewportSize({ width: 400, height: 1100 }); await shot('numfont-sheet', '#s158'); await page.setViewportSize({ width: 400, height: 860 })
await E(() => document.getElementById('s158')?.remove())
const chest = await E(() => { const C = window.RIB_COSMETICS, T = (window.RIB_TUNE = window.RIB_TUNE || {})
  const kit = { j: '#1f4fd0', p: '#e8c86a' }
  const draw = (numfont) => { const cv = document.createElement('canvas'); C.drawCharacter(cv, kit, 22, { num: 23, numfont }); return { d: Array.from(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data), w: cv.width, h: cv.height } }
  const t = draw('nf_team'), p = draw('nf_pro'), g = draw('nf_gothic'), info = window.__V158A.chest; T.v158Anf = 0; const old = draw('nf_pro'); delete T.v158Anf
  const region = (a, b, W, H) => { let n = 0, out = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) { if (y > H * 0.38 && y < H * 0.62 && x > W * 0.25 && x < W * 0.75) n++; else out++ } } return [n, out] }
  return { tp: region(t.d, p.d, t.w, t.h), pg: region(p.d, g.d, t.w, t.h), po: region(p.d, old.d, t.w, t.h), info } })
ok(chest.tp[0] > 40 && chest.tp[1] === 0 && chest.pg[0] > 20 && chest.po[0] > 20 && chest.info && chest.info.style === 'gothic', 'the profile chest wears the drawn face (it differs from the team numbers, between faces, and from the v157 C text with TU v158Anf 0) — and nothing but the chest changes', chest)

// ================= 5. helmet stripes per facing =================
const helm = await E(() => { const C = window.RIB_COSMETICS, CH = window.__CHASE_V94, T = (window.RIB_TUNE = window.RIB_TUNE || {})
  const H = { s: '#f1f3f5', st: '#c8102e', f: 'gloss' }
  const cellOut = (n, h) => { const raw = CH.cell(n, 'raw'), dy = CH.cell(n, ['#1f4fd0', '#e8c86a']); if (!raw || !dy) return new Uint8ClampedArray(48 * 48 * 4); const c = document.createElement('canvas'); c.width = 48; c.height = 48; c.getContext('2d').drawImage(dy, 0, 0); C.kitDeco(null, h || H)(c, n, null, raw); return c.getContext('2d').getImageData(0, 0, 48, 48).data }
  const measure = (d) => { // stripe = the red; helmet = red + the light grey shell, in the head's rows
    let top = -1; for (let y = 0; y < 48 && top < 0; y++) for (let x = 0; x < 48; x++) if (d[(y * 48 + x) * 4 + 3] > 40) { top = y; break }
    const isRed = (i) => d[i] > 110 && d[i + 1] < 90 && d[i + 2] < 100 && d[i] > d[i + 1] * 1.8, isShell = (i) => { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); return mx > 95 && mx - mn < 40 }
    const st = [], hl = []; for (let y = top; y < top + 18; y++) for (let x = 0; x < 48; x++) { const i = (y * 48 + x) * 4; if (d[i + 3] < 40) continue; if (isRed(i)) { st.push([x, y]); hl.push([x, y]) } else if (isShell(i)) hl.push([x, y]) }
    if (!st.length || !hl.length) return { st: st.length }
    const xs = hl.map(p => p[0]), ys = hl.map(p => p[1]), hx0 = Math.min(...xs), hx1 = Math.max(...xs), hy0 = Math.min(...ys), hy1 = Math.max(...ys), hw = hx1 - hx0 + 1, hh = hy1 - hy0 + 1
    const sx = st.reduce((s, p) => s + p[0], 0) / st.length, sy = st.reduce((s, p) => s + p[1], 0) / st.length
    // how many stripe pixels ride the helmet's top edge (<= 2 px under the first helmet pixel of their column)
    const colTop = {}; hl.forEach(p => { if (colTop[p[0]] == null || p[1] < colTop[p[0]]) colTop[p[0]] = p[1] })
    const hug = st.filter(p => p[1] - colTop[p[0]] <= 2).length / st.length
    // and how many ride the silhouette (<= 3 px from outside the figure): a stripe over the crown and down the front does
    const out = (x, y) => x < 0 || y < 0 || x >= 48 || y >= 48 || d[(y * 48 + x) * 4 + 3] < 40
    const rim = st.filter(p => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (out(p[0] + dx, p[1] + dy)) return true; return false }).length / st.length
    const sxs = st.map(p => p[0]), sys = st.map(p => p[1])
    return { st: st.length, cxRel: +((sx - hx0) / hw).toFixed(2), cyRel: +((sy - hy0) / hh).toFixed(2), wRel: +((Math.max(...sxs) - Math.min(...sxs) + 1) / hw).toFixed(2), hRel: +((Math.max(...sys) - Math.min(...sys) + 1) / hh).toFixed(2), hug: +hug.toFixed(2), rim: +rim.toFixed(2) }
  }
  const FR = { front: ['run_dn2', 'run_dn5', 'walk_dn0'], back: ['run_up2', 'idle_up', 'run_up6'], side: ['run_sd0', 'run_sd2', 'run_sd5', 'cut_sd'] }
  const out = {}, old = {}
  Object.keys(FR).forEach(k => { out[k] = FR[k].map(n => Object.assign({ n }, measure(cellOut(n)))) })
  T.v158Ahelm = 0; Object.keys(FR).forEach(k => { old[k] = FR[k].map(n => Object.assign({ n }, measure(cellOut(n)))) }); delete T.v158Ahelm
  // twin: two red runs across a front row; the decal lands on the shell
  const tw = cellOut('run_up2', { s: '#f1f3f5', st: '#c8102e', sk: 'twin', f: 'gloss' }), dec = cellOut('run_sd0', { s: '#1b1d22', st: '#c8102e', f: 'gloss', d: '#ffffff', dk: 'star' })
  let runs = 0; for (let y = 3; y < 9; y++) { let r = 0, prev = false; for (let x = 0; x < 48; x++) { const i = (y * 48 + x) * 4, red = tw[i] > 110 && tw[i + 1] < 90 && tw[i] > tw[i + 1] * 1.8; if (red && !prev) r++; prev = red } runs = Math.max(runs, r) }
  let white = 0; for (let y = 0; y < 20; y++) for (let x = 0; x < 48; x++) { const i = (y * 48 + x) * 4; if (dec[i] > 235 && dec[i + 1] > 235 && dec[i + 2] > 235) white++ }
  // the profile figure: the decal and the twin stripe change its helmet
  const fig = (h) => { const cv = document.createElement('canvas'); C.drawCharacter(cv, Object.assign({ j: '#1f4fd0', p: '#e8c86a' }, h), 22); return Array.from(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data) }
  const f0 = fig({ hs: '#1b1d22', hst: '#c8102e', hf: 'gloss' }), f1 = fig({ hs: '#1b1d22', hst: '#c8102e', hf: 'gloss', hd: '#ffffff', hdk: 'star' }), f2 = fig({ hs: '#1b1d22', hst: '#c8102e', hf: 'gloss', hsk: 'twin' })
  const dd = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) n++; return n }
  return { out, old, twinRuns: runs, decalWhite: white, figDecal: dd(f0, f1), figTwin: dd(f0, f2), fd: window.__V158A.figDecal } })
const midOk = (r) => r.st > 3 && Math.abs(r.cxRel - 0.5) <= 0.14 && r.hRel >= 0.45
const topOk = (r) => r.st > 3 && r.rim >= 0.65 && r.cyRel <= 0.45 && r.wRel >= 0.35 && Math.abs(r.cxRel - 0.5) >= 0.15
ok(helm.out.front.every(midOk), 'FRONT frames: the stripe runs down the middle of the helmet', helm.out.front)
ok(helm.out.back.every(midOk), 'BACK frames: the stripe runs down the middle of the helmet', helm.out.back)
ok(helm.out.side.every(topOk), 'SIDE frames: the stripe runs along the top of the helmet, front to back (it rides the crown\'s silhouette, off the middle)', helm.out.side)
ok(helm.old.side.filter(topOk).length === 0, 'the old centre-column stripe (TU v158Ahelm 0) fails every side frame — the bug this fixes', helm.old.side)
ok(helm.twinRuns >= 2 && helm.decalWhite >= 3, 'a twin stripe is two stripes; the decal lands on the shell', { twin: helm.twinRuns, decal: helm.decalWhite })
ok(helm.figDecal > 20 && helm.figTwin > 40, 'the profile figure draws the decal and the twin stripe', { decal: helm.figDecal, twin: helm.figTwin, at: helm.fd })
// before / after, 5x
for (const [nm, off] of [['helmet-after', false], ['helmet-before', true]]) {
  await E((off) => { const C = window.RIB_COSMETICS, CH = window.__CHASE_V94, T = (window.RIB_TUNE = window.RIB_TUNE || {}); if (off) T.v158Ahelm = 0
    const H = { s: '#f1f3f5', st: '#c8102e', f: 'gloss', d: '#1c2a44', dk: 'star' }, w = document.createElement('div'); w.id = 'h158'; w.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#3a6a3a;display:flex;flex-wrap:wrap;gap:4px;padding:4px;width:400px;font:9px monospace;color:#fff'
    ;['run_dn2', 'idle_dn', 'run_dr2', 'run_sd0', 'run_sd2', 'run_ur2', 'run_up2', 'idle_up'].forEach(n => { const raw = CH.cell(n, 'raw'), dy = CH.cell(n, ['#1f4fd0', '#e8c86a']); const c = document.createElement('canvas'); c.width = 48; c.height = 48; c.getContext('2d').drawImage(dy, 0, 0); C.kitDeco(null, H)(c, n, null, raw)
      const o = document.createElement('canvas'); o.width = 90; o.height = 90; const x = o.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(c, 12, 0, 18, 18, 0, 0, 90, 90); const b = document.createElement('div'); b.appendChild(o); b.appendChild(document.createElement('br')); b.appendChild(document.createTextNode(n)); w.appendChild(b) })
    document.body.appendChild(w); delete T.v158Ahelm }, off)
  await shot(nm, '#h158'); await E(() => document.getElementById('h158')?.remove())
}

// ================= 6. the live field =================
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function step (t) {
  const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    const el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : t === 'LIVE' ? els.find(e => /PLAY WEEK \d+ LIVE/.test(txt(e))) : els.find(e => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis })
  await page.waitForTimeout(t === 'PLAN' ? 3000 : 800); return r
}
await E(() => window.go('menu')); await page.waitForTimeout(800)
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING']) await step(t)
for (const t of ['LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
let scene = false
for (let i = 0; i < 150; i++) { scene = await E(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.some(m => m && m.team === 'you'))); if (scene) break
  await E(() => { const g = document.getElementById('gv42go'); if (g && g.offsetParent) g.click() })
  if (i === 10 || i === 40 || i === 80) { await step('LIVE'); await step('PLAN') }
  if (i === 20 || i === 50 || i === 90) { await step('CONTINUE TO MATCH'); await step('Continue') }
  await page.waitForTimeout(500) }
ok(scene, 'a new career reached the live field')
if (scene) {
  await page.waitForTimeout(1200)
  await E(() => { document.getElementById('gv139gate')?.remove(); document.getElementById('growthV42')?.remove() })
  await E(() => { const sc = window.__gridironScene; if (!window.__upd158) { window.__upd158 = sc.update; sc.update = function () {} } sc.time.paused = true; try { sc.tweens.pauseAll() } catch (e) {} })
  const walk = (nf) => E(async (nf) => { const C = window.RIB_COSMETICS, sc = window.__gridironScene
    if (nf) { C.grant(nf, 'earned') } C.equip('numfont', nf || null)
    let m = sc.markers.find(q => q && q.team === 'you'); if (!m) { sc.highlight(sc.markers[9], true); m = sc.markers[9] }
    if (!window.__home158) window.__home158 = { sx: m.sx, sy: m.sy }
    const H = window.__home158; m.forceState = null; m._launchUntil = 0; m.dirKey = 'dn'; if (m.body) { m.body.setRotation(0); m.body.setVisible(true) }
    const t0 = 3e6 + (window.__walk158 = (window.__walk158 || 0) + 1) * 1e4
    for (let k = 0; k < 28; k++) { sc.time.now = t0 + k * 16; m._spdPx = 170; sc.placeMarker(m, H.sx + k * 0.9, H.sy + k * 0.15, 16) }
    m.dirKey = 'dn'; sc.placeMarker(m, H.sx + 27 * 0.9, H.sy + 27 * 0.15, 16)
    const img = m._nfImgV158A, L = m.label
    const r = { img: !!(img && img.scene), vis: !!(img && img.visible), key: img && img.texture.key, labelA: L.alpha, labelVis: L.visible, field: window.__V158A.field }
    if (img && img.scene) { const lb = img.getBounds(), bb = m.body.getBounds(); r.onChest = lb.centerX > bb.left && lb.centerX < bb.right && lb.centerY > bb.top + bb.height * 0.2 && lb.centerY < bb.bottom - bb.height * 0.3; r.h = +lb.height.toFixed(1); r.bh = +bb.height.toFixed(1) }
    return r }, nf)
  const w0 = await walk(null), w1 = await walk('nf_pro'), w2 = await walk('nf_digital'), w3 = await walk(null)
  ok(!w0.img && w1.img && w1.vis && w1.labelA === 0 && w1.onChest && w2.key !== w1.key && w2.field.style === 'digital', 'on the field his number is the drawn face (an image on his chest over the label, which goes clear), one texture per face', { w0: w0.img, w1: { vis: w1.vis, a: w1.labelA, chest: w1.onChest, h: w1.h, body: w1.bh }, keys: [w1.key, w2.key] })
  ok(!w3.img && w3.labelA >= 0.85, 'taking the number font off restores the league\'s label (v159 A prints it at TU v159AnumA, the fabric showing through)', { img: w3.img, a: w3.labelA })
  for (const nfId of ['nf_pro', 'nf_digital', 'nf_gold']) {
    const url = await E(async (nfId) => { const sc = window.__gridironScene, C = window.RIB_COSMETICS; C.grant(nfId, 'earned'); C.equip('numfont', nfId); const m = sc.markers.find(q => q && q.team === 'you'); if (!m) return null
      m.dirKey = 'dn'; sc.placeMarker(m, window.__home158.sx + 27 * 0.9, window.__home158.sy + 27 * 0.15, 16)
      const c = sc.cameras.main; let gx = 0, gy = 0, S = 200
      for (let t = 0; t < 10; t++) {   // something else may move the camera between frames: re-centre until he is in the middle
        try { c.stopFollow(); c.removeBounds() } catch (e) {} c.setZoom(5 / Math.max(0.2, m.root.scale)); c.centerOn(m.root.x, m.root.y - 6 * m.root.scale)
        await new Promise(r => setTimeout(r, 90))
        gx = (m.root.x - c.scrollX - c.width * c.originX) * c.zoom + c.width * c.originX; gy = (m.root.y - c.scrollY - c.height * c.originY) * c.zoom + c.height * c.originY
        if (Math.abs(gx - c.width / 2) < 12 && Math.abs(gy - (c.height / 2 + 6 * m.root.scale * c.zoom)) < 30) break }
      const x0 = Math.max(0, Math.min(c.width - S, Math.round(gx - S / 2))), y0 = Math.max(0, Math.min(c.height - S, Math.round(gy - S * 0.6)))
      return await new Promise(r => sc.game.renderer.snapshotArea(x0, y0, S, S, img => { const cv = document.createElement('canvas'); cv.width = S; cv.height = S; cv.getContext('2d').drawImage(img, 0, 0); r(cv.toDataURL()) })) }, nfId)
    if (url) try { fs.writeFileSync(SHOTS + 'v158A-field-number-' + nfId + '.png', Buffer.from(url.split(',')[1], 'base64')) } catch {}
  }
  // the real registered "you" textures: equip a striped helmet and read the side / front / back frames
  const tex = await E(async () => { const C = window.RIB_COSMETICS, sc = window.__gridironScene; C.equip('helmet', 'hel_gloss_white'); C.refreshField(); await new Promise(r => setTimeout(r, 300))
    const read = (k) => { if (!sc.textures.exists(k)) return null; const src = sc.textures.get(k).getSourceImage(), c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data }
    const m = (d) => { if (!d) return null; let top = -1; for (let y = 0; y < 48 && top < 0; y++) for (let x = 0; x < 48; x++) if (d[(y * 48 + x) * 4 + 3] > 40) { top = y; break }
      const st = [], hl = [], isRed = (i) => d[i] > 110 && d[i + 1] < 90 && d[i] > d[i + 1] * 1.8, isShell = (i) => { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); return mx > 95 && mx - mn < 40 }
      for (let y = top; y < top + 18; y++) for (let x = 0; x < 48; x++) { const i = (y * 48 + x) * 4; if (d[i + 3] < 40) continue; if (isRed(i)) { st.push([x, y]); hl.push([x, y]) } else if (isShell(i)) hl.push([x, y]) }
      if (!st.length) return { st: 0 }
      const colTop = {}; hl.forEach(p => { if (colTop[p[0]] == null || p[1] < colTop[p[0]]) colTop[p[0]] = p[1] }); const xs = hl.map(p => p[0]), hx0 = Math.min(...xs), hw = Math.max(...xs) - hx0 + 1
      const out = (x, y) => x < 0 || y < 0 || x >= 48 || y >= 48 || d[(y * 48 + x) * 4 + 3] < 40
      const rim = st.filter(p => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (out(p[0] + dx, p[1] + dy)) return true; return false }).length / st.length
      return { st: st.length, rim: +rim.toFixed(2), cxRel: +((st.reduce((s, p) => s + p[0], 0) / st.length - hx0) / hw).toFixed(2) } }
    return { sd: m(read('spr_you_sd_run0')), dn: m(read('spr_you_dn_run2')), up: m(read('spr_you_up_run2')), kit: window.__V151B.kit } })
  ok(tex.sd && tex.sd.rim >= 0.65 && Math.abs(tex.sd.cxRel - 0.5) >= 0.15 && tex.dn && Math.abs(tex.dn.cxRel - 0.5) <= 0.14 && tex.up && Math.abs(tex.up.cxRel - 0.5) <= 0.14, 'the live "you" textures: the side frame\'s stripe rides the top, the front and back frames\' run down the middle', tex)
  await E(() => { const sc = window.__gridironScene, C = window.RIB_COSMETICS; C.equip('numfont', null); C.equip('helmet', null); sc.time.paused = false; try { sc.tweens.resumeAll() } catch (e) {} if (window.__upd158) { sc.update = window.__upd158; delete window.__upd158 } })
}
const fe = await E(() => window.__V158A.errs)
ok(fe.length === 0, 'the v158 A code ran without an error', fe)

// ================= 7. no gameplay change =================
const neutral = await E(() => { const st = window.__getGridironState(), keep = JSON.stringify(st.player || null), T = (window.RIB_TUNE = window.RIB_TUNE || {}), C = window.RIB_COSMETICS
  const seedRun = () => { let s = 5858; const orig = Math.random; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let v = Math.imul(s ^ s >>> 15, 1 | s); v = v + Math.imul(v ^ v >>> 7, 61 | v) ^ v; return ((v ^ v >>> 14) >>> 0) / 4294967296 }
    const out = []; try { for (let g = 0; g < 6; g++) { const r = window.__simGameV2(50 + g * 4, ['QB', 'RB', 'WR', 'LB'][g % 4]); out.push([r.usScore, r.themScore, r.plays.length, r.team.yds, r.oppTeam.yds]) } } finally { Math.random = orig }
    return JSON.stringify(out) }
  const look = { banner: 'ban_inferno', frame: 'frame_prism', nameplate: 'plate_galaxy', title: 'title_immortal', badge: 'badge_phoenix', shelf: 'shelf_galaxy', numfont: 'nf_galaxy', recap: 'recap_cosmic', vault: 'vault_solar', stadium: 'std_galaxy', celebration: 'cel_blackhole', helmet: 'hel_twin_red' }
  Object.keys(look).forEach(s => C.equip(s, null))
  const a = seedRun(); st.player = JSON.parse(keep)
  Object.keys(look).forEach(s => { C.grant(look[s], 'earned'); C.equip(s, look[s]) })   // member looks stay locked with the store off: what equips, equips
  const b = seedRun(); st.player = JSON.parse(keep)
  T.v158Aban = 0; T.v158Anf = 0; T.v158Ahelm = 0; T.v158Acard = 0; const c = seedRun(); st.player = JSON.parse(keep); delete T.v158Aban; delete T.v158Anf; delete T.v158Ahelm; delete T.v158Acard
  return { same: a === b && b === c, a: a.slice(0, 60) } })
ok(neutral.same, 'seeded games score identically with nothing equipped, with the v158 A looks on, and with the switches off', neutral)

console.log(JSON.stringify({ pass, fail, errors: errs.length }))
console.log('page errors:', errs.length ? errs.slice(0, 8) : 'none')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
