// Dev check: v177 I/J/K — TEN NEW CELEBRATIONS, TEN NEW UNIFORMS, TEN NEW BANNERS (src/28-cosmetics.js), at a 400x860 phone:
//   1. the catalogue: 10 + 10 + 10 new items, every one mythic and source "super" (v156 C's super looks): not owned on a
//      fresh device, a grant from anything but a super source is refused, the Locker lists them (super challenge), and
//      each names the super ladder rung that pays it
//   2. the celebrations: the generator's art loads (10 bodies, every frame with a rect, a foot anchor, a centre, a helmet,
//      gloves); each body's timeline runs 1.9-2.9 s through >= 4 different drawn frames; the travelling ones move (the
//      moonwalk goes BACK, the worm forward), the leaping ones leave the ground, the robot's tilts are stepped; the props
//      draw (the blade, the bow and arrow, the phone, the Z's); each effect is a v159 C plan with real particles that
//      draws ink; a frame recoloured to a red kit has a red jersey; reduced motion is one pose; no Math.random
//   3. the Locker: each celebration preview plays ITS body (all ten seen), the uniforms and banners draw — screenshots
//   4. the uniforms: each design changes the field sprite's jersey (kitDeco) AND the card figure (figCell) from the plain
//      jersey; the number's ink reads on each (contrast against the patterned jersey >= 2.6:1)
//   5. the banners: each painter draws a full, non-flat band and animates (two times differ)
//   6. the super ladders: three rows in RIB_SUPER.progress; a state with enough touchdowns / titles / seasons grants the
//      rungs (once, from "super"), and a grant from a ladder is owned and equips
//   7. the live field: a forced touchdown by HIM with each new celebration equipped plays its body on his marker (in his
//      kit), v159 C's effect around him, and hands the marker back; strips to $SHOTS
//   8. seeded simGameV2 box scores identical with the celebrations / uniforms off and on; no page errors
//   node scripts/v177IJKcheck.mjs        (GAME_URL=http://localhost:5173/)  SHOTS=<dir> for the screenshots
import fs from 'node:fs'
import { gameUrl, launch } from './lib/env.mjs'
const SHOTS = process.env.SHOTS || '/tmp/claude-0/shots/'
try { fs.mkdirSync(SHOTS, { recursive: true }) } catch {}
const browser = await launch()
const page = await browser.newPage({ viewport: { width: 400, height: 860 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 4).join(' | ')))
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { setInterval(() => { document.querySelector('.onboard')?.remove() }, 60) })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : '')); c ? pass++ : fail++ }
const E = (fn, arg) => page.evaluate(fn, arg)
const savePng = (name, dataUrl) => { try { fs.writeFileSync(SHOTS + name + '.png', Buffer.from(String(dataUrl).split(',')[1], 'base64')) } catch {} }
const boot = async () => {
  await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(1200)
  await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && window.RIB_COSMETICS && window.__V177I && window.__V177I.load, null, { timeout: 60000 })
  await E(() => new Promise(r => { let n = 0; const d = () => { if (++n === 2) r() }; window.__V177I.load(d); window.__V161A.load(d); setTimeout(r, 15000) }))
}
await boot(); await page.goto(gameUrl(), { waitUntil: 'networkidle' }); await boot()   // warm past vite's one-time reload

// ================= 1. the catalogue =================
const cat = await E(() => {
  const C = window.RIB_COSMETICS, I = window.__V177I.items(), J = window.__V177J.items(), K = window.__V177K.items(), all = [...I, ...J, ...K], items = C.catalog()
  const by = {}; items.forEach(it => { by[it.id] = it })
  return { n: [I.length, J.length, K.length], cats: [...new Set(I.map(id => by[id] && by[id].cat))].join() + '|' + [...new Set(J.map(id => by[id] && by[id].cat))].join() + '|' + [...new Set(K.map(id => by[id] && by[id].cat))].join(),
    bad: all.filter(id => !by[id] || by[id].rarity !== 'mythic' || by[id].source !== 'super'), owned: all.filter(id => C.owned(id)), refused: all.filter(id => C.grant(id, 'earned') || C.grant(id, 'pass') || C.grant(id, 'shop')).length,
    listed: all.filter(id => C.listed(by[id])).length, how: all.filter(id => !/^Super challenge: The (Showman|Dynasty Closet|Long Haul) — /.test(C.howTo(by[id]))), price: all.filter(id => by[id].price || (by[id].packs || []).length) }
})
ok(cat.n.join() === '10,10,10' && cat.cats === 'celebration|uniform|banner', 'ten new celebrations, ten uniforms, ten banners', cat.n)
ok(cat.bad.length === 0 && cat.price.length === 0, 'every one is a SUPER look (mythic, source "super") and none has a price or a pack', { bad: cat.bad, priced: cat.price })
ok(cat.owned.length === 0 && cat.refused === 0, 'a fresh device owns none, and an earned / pass / shop grant is refused', { owned: cat.owned })
ok(cat.listed === 30 && cat.how.length === 0, 'the Locker lists all thirty, each naming its super ladder rung', cat.how.slice(0, 3))

// ================= 2. the celebrations =================
const cel = await E(() => {
  const V = window.__V177I, M = V.manifest(), out = { anims: Object.keys(M.anims), bad: [], per: {} }
  let rnd = 0; const orig = Math.random; Math.random = function () { rnd++; return orig.apply(this, arguments) }
  try {
    for (const [name, A] of Object.entries(M.anims)) {
      A.frames.forEach(f => { if (!(f.r && f.r2 && f.a2 && isFinite(f.ax) && isFinite(f.ay) && isFinite(f.cx) && f.helm && f.helm.length === 4 && Array.isArray(f.hands))) out.bad.push(name + f.k) })
      const T = V.timeline(name), ks = new Set(), xs = [], lifts = [], rots = []
      for (let t = 0; t < T.total; t += 20) { const o = V.pose(name, t); ks.add(o.k); xs.push(o.x); lifts.push(o.lift); rots.push(o.rot) }
      const cv = document.createElement('canvas'); cv.width = 240; cv.height = 200; let props = 0
      for (let t = 0; t < T.total; t += 60) props += V.props(name, t, cv)
      const calm = V.timeline(name, true), co = V.pose(name, 300, true)
      // the kit: one frame recoloured to red / white
      const px = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data, mid = T.segs[Math.floor(T.segs.length / 2)].fr[0]
      const a = px(V.frameCanvas(name, mid, 1, null)), b = px(V.frameCanvas(name, mid, 1, { p1: '#c82830', p2: '#eeeeee' })); let navy = 0, red = 0 /* lit navy → reddish */
      for (let i = 0; i < a.length; i += 4) { if (a[i + 3] < 200) continue; const L = (Math.max(a[i], a[i + 1], a[i + 2]) + Math.min(a[i], a[i + 1], a[i + 2])) / 2; if (a[i + 2] > a[i] + 25 && L >= 38) { navy++; if (b[i] > b[i + 1] + 40 && b[i] > b[i + 2] + 40) red++ } }
      out.per[name] = { total: T.total, frames: ks.size, xMin: +Math.min(...xs).toFixed(1), xMax: +Math.max(...xs).toFixed(1), lift: +Math.max(...lifts).toFixed(1), rots: [...new Set(rots.map(r => Math.round(r)))].length, props, calm: { total: calm.total, segs: calm.segs.length, lift: co.lift, x: co.x }, navy, red }
    }
    // the effect: a v159 C plan per item, drawing ink at the burst and the linger
    const P = window.__V159C; out.fx = V.items().map(id => { const p = P.plan(id, 777), c = document.createElement('canvas'); c.width = 200; c.height = 180
      const ink = [p.T.a + 240, (p.T.b + p.T.l) / 2].map(t => { P.renderAt(c, id, t, 777); const d = c.getContext('2d').getImageData(0, 0, 200, 180).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 24) n++; return n })
      return { id, kind: p.kind, parts: p.parts, ink, body: V.bodyOf(id) } })
  } finally { Math.random = orig }
  out.rnd = rnd; out.errs = V.errs.slice()
  return out
})
ok(cel.anims.length === 10 && cel.bad.length === 0, 'the generator\'s art loads: ten bodies, every frame with its rects, foot anchor, centre, helmet and gloves', { anims: cel.anims, bad: cel.bad })
const P = cel.per
for (const n of cel.anims) console.log('     ' + n + ': ' + JSON.stringify(P[n]))
ok(cel.anims.every(n => P[n].total >= 1900 && P[n].total <= 2900 && P[n].frames >= 4), 'each body runs 1.9-2.9 s through at least four drawn frames', cel.anims.map(n => n + ':' + Math.round(P[n].total) + '/' + P[n].frames).join(' '))
ok(P.moonwalk.xMin < -60 && P.moonwalk.xMax <= 0.01 && P.worm.xMax > 60, 'the moonwalk glides BACK (' + P.moonwalk.xMin + ' px), the worm travels forward (' + P.worm.xMax + ' px)')
ok(P.leap.lift > 50 && P.quake.lift > 10 && P.nap.lift > 4 && P.robot.rots >= 4, 'the crowd leap leaves the ground (' + P.leap.lift + ' px), the quake hops into the slam, the robot snaps through stepped tilts', { leap: P.leap.lift, quake: P.quake.lift, robot: P.robot.rots })
ok(['saber', 'archer', 'phone', 'nap', 'moonwalk', 'griddy', 'robot'].every(n => P[n].props > 20), 'the props draw: the blade, the bow and arrow, the phone, the Z\'s, the glints, the beats, the sparks', Object.fromEntries(cel.anims.map(n => [n, P[n].props])))
ok(cel.anims.every(n => P[n].navy > 40 && P[n].red > P[n].navy * 0.85), 'a frame recoloured to a red kit wears it (the art\'s navy jersey becomes red)', Object.fromEntries(cel.anims.map(n => [n, P[n].red + '/' + P[n].navy])))
ok(cel.anims.every(n => P[n].calm.segs === 1 && P[n].calm.lift === 0 && P[n].calm.x === 0), 'reduced motion: one calm pose, no travel, no lift')
ok(cel.fx.every(f => f.parts >= 12 && f.ink[0] > 40 && f.ink[1] > 40 && /^v177/.test(f.kind) && f.body), 'each celebration is a v159 C plan of its own kind with real particles that draws ink at the burst and the linger', cel.fx.map(f => f.id + ':' + f.kind + ':' + f.parts + ':' + f.ink.join('/')).join(' '))
ok(cel.rnd === 0 && cel.errs.length === 0, 'none of it spends Math.random or raises', { rnd: cel.rnd, errs: cel.errs })

// ================= 3. the Locker =================
await E(() => { const C = window.RIB_COSMETICS; [...window.__V177I.items(), ...window.__V177J.items(), ...window.__V177K.items()].forEach(id => C.grant(id, 'super')) })
const own = await E(() => [...window.__V177I.items(), ...window.__V177J.items(), ...window.__V177K.items()].filter(id => window.RIB_COSMETICS.owned(id)).length)
ok(own === 30, 'a super grant owns each of the thirty', own)
await E(() => window.go('locker')); await page.waitForTimeout(900)
await E(() => { const t = document.querySelector('.hubv75-tab[data-sec="style"]'); t && t.click() }); await page.waitForTimeout(500)
const openCat = async (c) => { await E((c) => { window.cosCatV151B && window.cosCatV151B(c) }, c); await page.waitForTimeout(1600) }
await openCat('celebration')
const lk = await E(async () => { const seen = new Set(); for (let i = 0; i < 14; i++) { window.__V177I.previewList().forEach(r => { if (r.connected && r.body) seen.add(r.id + ':' + r.body.name) }); await new Promise(r => setTimeout(r, 220)) }
  return { seen: [...seen].sort(), pf: window.__V177I.prevFrames } })
const seenBodies = new Set(lk.seen.map(s => s.split(':')[1]))
ok(seenBodies.size === 10, 'the Locker\'s celebration previews play each item\'s own body (all ten)', lk.seen)
const shotSection = async (name, ids) => {
  // the tiles of the new items, scrolled into view, then a page screenshot of each third
  const box = await E((ids) => { const els = ids.map(id => document.querySelector('[data-id="' + id + '"], [data-cos="' + id + '"]')).filter(Boolean); if (!els.length) return null
    els[0].scrollIntoView({ block: 'start' }); const r = els.map(e => e.getBoundingClientRect()); const y0 = Math.max(0, Math.min(...r.map(q => q.top)) - 6), y1 = Math.min(860, Math.max(...r.map(q => q.bottom)) + 6); return { x: 0, y: y0, width: 400, height: Math.max(40, y1 - y0) } }, ids)
  await page.waitForTimeout(700)
  try { await page.screenshot({ path: SHOTS + name + '.png', clip: box || undefined }) } catch {}
  return !!box
}
const celIds = await E(() => window.__V177I.items())
await shotSection('v177I_locker', celIds)
{ const strip = await E(async (ids) => { const cvs = ids.map(id => { const el = document.querySelector('[data-id="' + id + '"] canvas.cos-cel-v159c, [data-cos="' + id + '"] canvas.cos-cel-v159c'); return el }).filter(Boolean), n = 12, W = 128, H = 120, out = document.createElement('canvas'); out.width = W * n; out.height = H * Math.max(1, cvs.length)
    const x = out.getContext('2d'); x.fillStyle = '#10151e'; x.fillRect(0, 0, out.width, out.height)
    for (let f = 0; f < n; f++) { cvs.forEach((c, i) => x.drawImage(c, f * W, i * H, W, H)); await new Promise(r => setTimeout(r, 230)) }
    return { url: out.toDataURL(), n: cvs.length } }, celIds); savePng('v177I_locker_strips', strip.url); console.log('     locker strip rows: ' + strip.n) }
await openCat('uniform'); const uniIds = await E(() => window.__V177J.items()); await shotSection('v177J_locker', uniIds)
await openCat('banner'); const banIds = await E(() => window.__V177K.items()); await shotSection('v177K_locker', banIds)

// ================= 4. the uniforms =================
const uni = await E(() => {
  const C = window.RIB_COSMETICS, Ch = window.__CHASE_V94, J = window.__V177J, out = []
  const lum = (c) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
  const by = {}; C.catalog().forEach(it => { by[it.id] = it })
  const sheet = (k) => { const dyed = Ch.cell('idle_dn', [k.j, k.p]), raw = Ch.cell('idle_dn', 'raw'), c = document.createElement('canvas'); c.width = 48; c.height = 48; c.getContext('2d').drawImage(dyed, 0, 0); C.kitDeco(k, null)(c, 'idle_dn', null, raw); return c.getContext('2d').getImageData(0, 0, 48, 48).data }
  const card = (k) => { const c = document.createElement('canvas'); C.drawCharacter(c, k, 22); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data }
  const big = document.createElement('canvas'); big.width = 10 * 140; big.height = 320; const bx = big.getContext('2d'); bx.fillStyle = '#1d5a2c'; bx.fillRect(0, 0, big.width, big.height)
  J.items().forEach((id, i) => {
    const k = by[id].k, plain = Object.assign({}, k, { pat: 'solid' }), a = sheet(k), b = sheet(plain), ca = card(k), cb = card(plain)
    let field = 0, sum = [0, 0, 0], n = 0; for (let q = 0; q < a.length; q += 4) { if (a[q + 3] < 20) continue; if (a[q] !== b[q] || a[q + 1] !== b[q + 1] || a[q + 2] !== b[q + 2]) field++ }
    let cardDiff = 0; for (let q = 0; q < Math.min(ca.length, cb.length); q += 4) if (ca[q + 3] > 20 && (Math.abs(ca[q] - cb[q]) + Math.abs(ca[q + 1] - cb[q + 1]) + Math.abs(ca[q + 2] - cb[q + 2]) > 30)) cardDiff++
    // the chest the number is printed on: the plain sprite's jersey-coloured rows 14..26, read on the patterned one
    const J0 = hex(k.j); for (let y = 14; y < 27; y++) for (let x = 16; x < 32; x++) { const q = (y * 48 + x) * 4; if (b[q + 3] < 20) continue; const d = Math.abs(b[q] - J0[0] * 0) ; void d
      const L = (Math.max(b[q], b[q + 1], b[q + 2]) + Math.min(b[q], b[q + 1], b[q + 2])) / 2; if (L < 30) continue
      const isJ = Math.abs(b[q] - J0[0]) + Math.abs(b[q + 1] - J0[1]) + Math.abs(b[q + 2] - J0[2]) < 140; if (!isJ) continue; sum[0] += a[q]; sum[1] += a[q + 1]; sum[2] += a[q + 2]; n++ }
    const avg = n ? sum.map(v => v / n) : J0, ink = J.ink(id), Li = lum(hex(ink.fill)), La = lum(avg), cr = (Math.max(Li, La) + 0.05) / (Math.min(Li, La) + 0.05)
    out.push({ id, field, card: cardDiff, chest: n, contrast: +cr.toFixed(2), ink: ink.fill })
    // the proof: the sprite at 4x and the card figure
    const sc = document.createElement('canvas'); sc.width = 48; sc.height = 48; const sx = sc.getContext('2d'), im = sx.createImageData(48, 48); im.data.set(a); sx.putImageData(im, 0, 0)
    bx.imageSmoothingEnabled = false; bx.drawImage(sc, 4, 0, 40, 44, i * 140 + 10, 6, 120, 132)
    const cf = document.createElement('canvas'); C.drawCharacter(cf, k, 22, { num: 27 }); bx.drawImage(cf, i * 140 + 10, 142, 120, 150)
  })
  return { out, img: big.toDataURL() }
})
savePng('v177J_sprites_and_cards', uni.img)
ok(uni.out.every(u => u.field > 15), 'each design changes the field sprite\'s jersey (kitDeco: his textures, his team\'s, the Locker\'s sprite)', uni.out.map(u => u.id + ':' + u.field).join(' '))
ok(uni.out.every(u => u.card > 150), 'each design is on the card\'s figure too (figCell, the jersey\'s own pixels)', uni.out.map(u => u.id + ':' + u.card).join(' '))
ok(uni.out.every(u => u.chest >= 3 && u.contrast >= 2.6), 'the number\'s ink reads on every design (contrast against the patterned chest >= 2.6:1)', uni.out.map(u => u.id + ':' + u.contrast + ' ' + u.ink + ' n' + u.chest).join(' '))

// ================= 5. the banners =================
const ban = await E(() => {
  const C = window.RIB_COSMETICS, out = [], big = document.createElement('canvas'); big.width = 340; big.height = 64 * 10; const bx = big.getContext('2d')
  window.__V177K.items().forEach((id, i) => {
    const c = document.createElement('canvas'); c.width = 340; c.height = 58; const kind = C.paintBanner(c, id, 3.3), d1 = c.getContext('2d').getImageData(0, 0, 340, 58).data.slice()
    bx.drawImage(c, 0, i * 64)
    C.paintBanner(c, id, 4.1); const d2 = c.getContext('2d').getImageData(0, 0, 340, 58).data
    let opaque = 0, diff = 0; const cols = new Set(); for (let q = 0; q < d1.length; q += 4) { if (d1[q + 3] > 200) opaque++; if (Math.abs(d1[q] - d2[q]) + Math.abs(d1[q + 1] - d2[q + 1]) + Math.abs(d1[q + 2] - d2[q + 2]) > 24) diff++; if (q % 40 === 0) cols.add((d1[q] >> 4) + ',' + (d1[q + 1] >> 4) + ',' + (d1[q + 2] >> 4)) }
    out.push({ id, kind, opaque: +(opaque / (340 * 58)).toFixed(2), anim: diff, cols: cols.size })
  })
  return { out, img: big.toDataURL() }
})
savePng('v177K_banners', ban.img)
ok(ban.out.every(b => b.kind && b.opaque > 0.97 && b.cols >= 12), 'each banner\'s painter draws a full, varied band', ban.out.map(b => b.id + ':' + b.opaque + '/' + b.cols).join(' '))
ok(ban.out.every(b => b.anim > 300), 'each banner animates (two times differ)', ban.out.map(b => b.id + ':' + b.anim).join(' '))

// ================= 6. the super ladders =================
const lad = await E(() => {
  const C = window.RIB_COSMETICS, V = window.__V177I, R = window.RIB_SUPER, all = [...V.items(), ...window.__V177J.items(), ...window.__V177K.items()]
  localStorage.removeItem('rib.cosmetics.v1'); window.__V156C.reloadCosmetics(); window.__V156C.resetSuper()
  const rows0 = R.progress().filter(r => r.ladder), owned0 = all.filter(id => C.owned(id)).length
  // a record: one Hall career with 16 seasons, 2 titles, 70 touchdowns, and the live one with 30 more seasons
  const row = (n, ch, td) => ({ n, level: 3, champion: ch, line: { rushTD: td }, statLine: { rushTD: td }, awards: [] })
  const hof = [{ pos: 'RB', box: { log: Array.from({ length: 16 }, (_, i) => row(i + 1, i < 2, i < 10 ? 7 : 0)) } }]
  const st = { hof, player: { pos: 'RB', seasonLogV77: Array.from({ length: 30 }, (_, i) => row(i + 1, i < 9, 2)) } }
  const g1 = V.ladderTick(st), g2 = V.ladderTick(st), rows = R.progress().filter(r => r.ladder)
  const eq = C.equip('celebration', g1.find(id => /^cel_/.test(id)) || 'none')
  return { rows0: rows0.map(r => r.id + ':' + r.have + '/' + r.goal), owned0, g1, g2, rows: rows.map(r => r.id + ':' + r.have + '/' + r.goal + ' next ' + r.item), m: V.metrics(st), eq,
    srcs: g1.map(id => (JSON.parse(localStorage.getItem('rib.cosmetics.v1') || '{}').owned || {})[id]).map(o => o && o.source), inSave: /l177|showman177/.test(localStorage.getItem('gridiron_save_v1') || '') }
})
ok(lad.rows0.length === 3 && lad.owned0 === 0, 'three super ladders sit in the super challenges (The Showman, The Dynasty Closet, The Long Haul)', lad.rows0)
ok(lad.g1.length === 2 + 2 + 3 && lad.g2.length === 0 && lad.srcs.every(s => s === 'super'), 'a record of 130 touchdowns, 11 titles and 46 seasons pays 2 + 2 + 3 rungs, once, from "super"', { got: lad.g1, again: lad.g2, metrics: lad.m })
ok(lad.eq && !lad.inSave, 'a laddered look equips, and nothing lands in the career save', { rows: lad.rows })

// ================= 7. the live field =================
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
await E(() => { const C = window.RIB_COSMETICS; [...window.__V177I.items(), ...window.__V177J.items(), ...window.__V177K.items()].forEach(id => C.grant(id, 'super')) })
await E(() => window.go('menu')); await page.waitForTimeout(800)
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
let scene = false
for (let i = 0; i < 150; i++) { scene = await E(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.some(m => m && m.team === 'you'))); if (scene) break
  await E(() => { const g = document.getElementById('gv42go'); if (g && g.offsetParent) g.click() })
  if (i === 20 || i === 50 || i === 90) { await step('CONTINUE TO MATCH'); await step('Continue') }
  await page.waitForTimeout(500) }
ok(scene, 'a new career reached the live field')
if (scene) {
  await page.waitForTimeout(1500)
  const yi = await E(() => { const sc = window.__gridironScene; let i = sc.markers.findIndex(m => m && m.team === 'you' && m.root); if (i < 0) i = 5; return i })
  await E(() => { const C = window.RIB_COSMETICS, T = (window.RIB_TUNE = window.RIB_TUNE || {}); T.cosKitClashV151B = 0; T.v175pan = 0
    C.equip('uniform', 'uni_bengal'); window.__COS_FIELD_V151B && window.__COS_FIELD_V151B.resync(window.__gridironScene) })
  await page.waitForTimeout(600)
  await E(() => { const sc = window.__gridironScene; if (!window.__updV177) { window.__updV177 = [sc.update, sc.killAllFx, sc.animatePlay]; sc.update = function () {}; sc.killAllFx = function () {}; sc.animatePlay = function () {} } })
  const live = await E(async (yi) => {
    const sc = window.__gridironScene, m = sc.markers[yi], V = window.__V177I, C = window.RIB_COSMETICS, out = {}, cv = sc.game.canvas, cam = sc.cameras.main
    const P = sc.play || (sc.play = { payload: {}, t: 0 }), keep = P.carrierId; P.carrierId = yi
    let rnd = 0; const orig = Math.random
    for (const id of V.items()) {
      C.equip('celebration', id); const name = V.bodyOf(id)
      Math.random = function () { rnd++; return orig.apply(this, arguments) }
      try { C.celebrate(sc, m.root.x, m.root.y, m) } finally { Math.random = orig }
      const run = V.active, c159 = window.__V159C.active
      const tex = run && sc.textures.get(run.tex).getSourceImage(); let orange = 0
      if (tex) { const d = tex.getContext('2d').getImageData(0, 0, tex.width, tex.height).data; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i] > 170 && d[i + 1] > 70 && d[i + 1] < 150 && d[i + 2] < 60) orange++ }
      await new Promise(r => { const w = () => (!run || !run.alive ? r() : setTimeout(w, 60)); setTimeout(w, 200) })
      out[name] = run ? { name: run.name, ended: run.ended, frames: run.frames, ks: [...new Set(run.seq.map(s => s.k))].length, props: run.props, c159: c159 ? c159.kind : null, skipped: c159 ? c159.body161 || 0 : 0, orange,
        back: (m.body.originX === 0.5 && m.body.rotation === 0) || /^spr_|^rib_player_fallback$/.test(m.body.texture.key) /* placeMarker re-dressed him */ || !!(m.__v161a && m.__v161a !== run && m.__v161a.alive) /* another body (a v164 G dance) took him */, bo: [+m.body.originX.toFixed(2), +m.body.rotation.toFixed(2), m.__v161a ? m.__v161a.name : null], med: run.ms.slice().sort((a, b) => a - b)[run.ms.length >> 1] || 0 } : null
    }
    // strips: each body held at 8 times, a close-up on his spot
    const strips = {}, fol = cam._follow || null; try { cam.stopFollow() } catch (e) {}
    const hid = sc.markers.filter((q, i) => q && q.root && i !== yi && q.root.visible); hid.forEach(q => q.root.setVisible(false)); try { sc.tweens.pauseAll(); sc.time.paused = true } catch (e) {}
    for (const name of V.anims) {
      const T = V.timeline(name), ts = Array.from({ length: 8 }, (_, i) => T.total * (i + 0.5) / 8), z0 = cam.zoom, s0 = [cam.scrollX, cam.scrollY], fx = m.root.x, fy = m.root.y - 30 * m.root.scaleY
      C.equip('celebration', V.items()[V.anims.indexOf(name)]); C.celebrate(sc, m.root.x, m.root.y, m)
      const run = V.active, r159 = window.__V159C.active; if (!run) { strips[name] = null; continue }
      const W = 190, H = 210, c = document.createElement('canvas'); c.width = W * ts.length; c.height = H; const x = c.getContext('2d'); x.imageSmoothingEnabled = false
      for (let k = 0; k < ts.length; k++) { run.setHold(ts[k]); if (r159) r159.setHold(ts[k]); cam.setZoom(z0 * 2.4); cam.centerOn(fx, fy); await new Promise(r => setTimeout(r, 70)); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
        const z = cam.zoom, sx = (fx - cam.worldView.x) * z, sy = (fy - cam.worldView.y) * z, kx = cv.width / (sc.scale ? sc.scale.width : cv.width)
        x.drawImage(cv, (sx - W / 2) * kx, (sy - H * 0.5) * kx, W * kx, H * kx, k * W, 0, W, H); x.fillStyle = '#fff'; x.font = '13px monospace'; x.fillText(name + ' ' + Math.round(ts[k]) + 'ms', k * W + 4, 14) }
      run.setHold(null); run.stop('strip'); if (r159) r159.stop('strip'); cam.setZoom(z0); cam.setScroll(s0[0], s0[1]); strips[name] = c.toDataURL()
    }
    try { if (fol) cam.startFollow(fol) } catch (e) {}
    hid.forEach(q => q.root.setVisible(true)); try { sc.tweens.resumeAll(); sc.time.paused = false } catch (e) {}
    P.carrierId = keep
    return { out, rnd, errs: V.errs.slice(), strips }
  }, yi)
  for (const [n, u] of Object.entries(live.strips)) if (u) savePng('v177I_field_' + n, u)
  for (const [n, r] of Object.entries(live.out)) console.log('     field ' + n + ': ' + JSON.stringify(r))
  const L = Object.values(live.out)
  ok(L.length === 10 && L.every(r => r && r.ended === 'done' && r.ks >= 3 && r.frames >= 8), 'a forced touchdown by HIM plays each new celebration\'s own body on his marker, through its frames, and it ends by itself', Object.keys(live.out))
  ok(L.every(r => r.c159 && /^v177/.test(r.c159) && r.skipped > 5), 'v159 C\'s new effect plays around him, its pose standing down for the body', L.map(r => r.c159 + ':' + r.skipped).join(' '))
  ok(L.every(r => r.orange > 30), 'he celebrates in the uniform he wears (the Bengal orange is on the body\'s texture)', L.map(r => r.name + ':' + r.orange).join(' '))
  ok(L.every(r => r.back) && live.rnd === 0 && live.errs.length === 0 && L.every(r => r.med < 2.5), 'the marker is handed back; no Math.random; no error; the draw cost stays small', { rnd: live.rnd, errs: live.errs, back: L.map(r => r.back), med: L.map(r => +r.med.toFixed(2)) })
  await E(() => { const sc = window.__gridironScene; if (window.__updV177) { sc.update = window.__updV177[0]; sc.killAllFx = window.__updV177[1]; sc.animatePlay = window.__updV177[2]; delete window.__updV177 } })
}

// ================= 8. no gameplay change =================
const neutral = await E(() => { const st = window.__getGridironState(), keep = JSON.stringify(st.player || null)
  const seedRun = () => { let s = 4242; const orig = Math.random; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let v = Math.imul(s ^ s >>> 15, 1 | s); v = v + Math.imul(v ^ v >>> 7, 61 | v) ^ v; return ((v ^ v >>> 14) >>> 0) / 4294967296 }
    const out = []; try { for (let g = 0; g < 6; g++) { const r = window.__simGameV2(50 + g * 4, ['QB', 'RB', 'WR', 'LB'][g % 4]); out.push([r.usScore, r.themScore, r.plays.length, r.team.yds, r.oppTeam.yds]) } } finally { Math.random = orig }
    return JSON.stringify(out) }
  const T = (window.RIB_TUNE = window.RIB_TUNE || {}); T.v177I = 0; T.v177J = 0; const a = seedRun(); st.player = JSON.parse(keep)
  T.v177I = 1; T.v177J = 1; const b = seedRun(); st.player = JSON.parse(keep)
  return { same: a === b } })
ok(neutral.same, 'seeded games score identically with v177 I/J off and on', neutral)

console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
console.log('page errors:', errs.length ? errs.slice(0, 8) : 'none')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
