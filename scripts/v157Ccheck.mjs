// Dev check: v157 C — ONE FACE EVERYWHERE (src/28-cosmetics.js, src/29-seasons.js, src/31-legacy.js, 07 growOneFaceV157C),
// at a 400x860 phone:
//   1. icons: >= 40 profile icons, every one EARNED (none free / shop / member / founder / super / pass-bought), each with
//      an earn rule the Locker quotes; the Career Pass draws no icon (rawKind still knows which tiers were); a pass icon a
//      device already owned keeps its slot after a reload (grandfathered); a gameplay event (a Pee Wee title in the season
//      log) and season challenges completed grant their icons; an earned icon is its own badge on the card
//   2. the figure: on the profile card his number is on the chest — the number font changes those pixels; the equipped
//      helmet changes the helmet pixels (vs the team shell)
//   3. the growth (year-older) screen draws THE SAME figure as the profile (identical pixels at the same age)
//   4. the live screen: his badge wears the figure in his kit colours; the "you" sprite's texture carries the team /
//      uniform colours; his number on the field wears the number font, drawn bigger, and its pixels change
//   5. the medal: the circling light is gone from the profile's medal box (and the menu box's rays hold still); tapping the
//      medal (profile box, main menu, trophy case) opens the % card; the % is monotone (ranks 1, 50, 200, 500), rank 1 =
//      100%, rank 500 < 0.01%; the live hook answers when configured
//   6. seeded games identical with the v157 C switches on and off; no page errors
// Screenshots go to $SHOTS (default /tmp/claude-0/shots/).
//   node scripts/v157Ccheck.mjs        (GAME_URL=http://localhost:5173/)
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
  await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && window.RIB_COSMETICS && window.RIB_SEASONS && window.RIB_LEGACY, null, { timeout: 60000 })
  await page.waitForTimeout(600)
}
await boot(); await page.goto(GAME_URL, { waitUntil: 'networkidle' }); await boot()   // warm past vite's one-time reload
const shot = async (name, sel) => { try { if (sel) { const el = await page.$(sel); if (el) { await el.screenshot({ path: SHOTS + 'v157C-' + name + '.png' }); return } } await page.screenshot({ path: SHOTS + 'v157C-' + name + '.png' }) } catch {} }
const fits = () => E(() => { const se = document.scrollingElement; return { page: se.scrollHeight <= innerHeight + 2 && se.scrollWidth <= innerWidth + 2, w: se.scrollWidth } })

// ================= 1. icons =================
const ic = await E(() => { const C = window.RIB_COSMETICS, S = window.RIB_SEASONS, all = C.catalog().filter(i => i.cat === 'icon' && i.glyph)
  const R = S.rewards(S.current().id), rw = R.free.concat(R.premium)
  const raw = rw.filter(r => S.rawKind(r.id) === 'icon').map(r => r.id)
  const how = all.map(i => C.howTo(i))
  return { n: all.length, srcs: [...new Set(all.map(i => i.source))], bad: all.filter(i => !/^(earned)$/.test(i.source) && !(i.source === 'pass' && C.owned(i.id))).map(i => i.id + ':' + i.source),
    rules: all.filter(i => /^Earn it: .{8,}/.test(C.howTo(i))).length, how: how.slice(0, 3), passIcons: rw.filter(r => r.kind === 'icon').length, raw, rawN: raw.length,
    listedLocked: all.filter(i => C.listed(i) && !C.owned(i.id)).length, uniq: new Set(all.map(i => i.glyph + '|' + i.col + '|' + i.col2 + '|' + i.tag)).size,
    kinds: { titles: all.filter(i => /^ico_t\d/.test(i.id)).length, legacy: all.filter(i => /^ico_lg_/.test(i.id)).length, sc: all.filter(i => /^ico_sc_/.test(i.id)).length, sup: all.filter(i => /^ico_super_/.test(i.id)).length } } })
ok(ic.n >= 40 && ic.bad.length === 0 && ic.srcs.join() === 'earned', '>= 40 profile icons, every one EARNED — none free, shop, member, founder, super or pass-bought', { n: ic.n, srcs: ic.srcs, bad: ic.bad.slice(0, 5) })
ok(ic.rules === ic.n && ic.listedLocked === ic.n && ic.uniq === ic.n, 'each icon has an earn rule the Locker quotes (listed locked until earned) and its own emblem', { rules: ic.rules, how: ic.how, uniq: ic.uniq })
ok(ic.kinds.titles >= 32 && ic.kinds.legacy === 9 && ic.kinds.sc >= 10 && ic.kinds.sup === 5, 'titles at every level (×1/3/5/10), a Legacy medal of every colour, season-challenge and super-challenge icons', ic.kinds)
ok(ic.passIcons === 0 && ic.rawN >= 2, 'the Career Pass draws no icon any more (its icon tiers are badges; rawKind still names them)', { passIcons: ic.passIcons, raw: ic.raw })
const seeded = await E(() => { const S = window.RIB_SEASONS; const c = S.challenges(); return { n: c.length, ids: c.map(x => x.id).join() } })
ok(seeded.n === 20, 'the season still picks its 20 challenges from the seeded pool (nothing appended)', seeded)
// grandfathering: a pass icon this device owned before v157 C keeps the icon slot after a reload
const gfId = ic.raw[0]
await E((id) => { const k = 'rib.cosmetics.v1', d = JSON.parse(localStorage.getItem(k) || '{"v":1,"owned":{},"equipped":{},"ach":{}}'); d.owned[id] = { source: 'pass', at: Date.now() }; d.equipped = d.equipped || {}; d.equipped.icon = id; localStorage.setItem(k, JSON.stringify(d)) }, gfId)
await boot()
const gf = await E((id) => { const C = window.RIB_COSMETICS, it = C.catalog().find(i => i.id === id); return { cat: it && it.cat, owned: C.owned(id), eq: C.equipped('icon') } }, gfId)
ok(gf.cat === 'icon' && gf.owned && gf.eq === gfId, 'a pass icon the device already owned stays an icon, owned and equipped (grandfathered)', gf)

// a career (the rest needs one)
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
const hasCareer = await E(() => { const s = window.__getGridironState(); return !!(s && s.player && s.player.pos) })
ok(hasCareer, 'a new career started')

// ================= 4. the live screen =================
for (const t of ['LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
let scene = false
for (let i = 0; i < 150; i++) { scene = await E(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.some(m => m && m.team === 'you'))); if (scene) break
  await E(() => { const g = document.getElementById('gv42go'); if (g && g.offsetParent) g.click() })
  if (i === 10 || i === 40 || i === 80) { await step('LIVE'); await step('PLAN') }
  if (i === 20 || i === 50 || i === 90) { await step('CONTINUE TO MATCH'); await step('Continue') }
  await page.waitForTimeout(500) }
if (!scene) await shot('no-live')
ok(scene, 'a new career reached the live field')
if (!scene) { console.log(JSON.stringify({ pass, fail, errors: errs.length })); await browser.close(); process.exit(1) }
await page.waitForTimeout(1500)
await E(() => { document.getElementById('gv139gate')?.remove(); document.getElementById('growthV42')?.remove() })
const badge = await E(() => { const b = document.querySelector('.watch-badge'); if (!b) return null; const cv = b.querySelector('canvas.wb-fig-v157c'), k = window.RIB_COSMETICS.face().kit
  const near = (d, hex, tol) => { const t = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && Math.abs(d[i] - t[0]) + Math.abs(d[i + 1] - t[1]) + Math.abs(d[i + 2] - t[2]) < tol) n++; return n }
  const d = cv ? cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data : []
  const rgb = (h) => 'rgb(' + [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(', ') + ')'
  return { fig: !!cv, cls: b.className, tag: (b.querySelector('.wb-pos-v157c') || {}).textContent, kit: [k.j, k.p], j: near(d, k.j, 90), p: near(d, k.p, 90), ring: getComputedStyle(b).borderTopColor === rgb(k.p) } })
await shot('live-badge', '.live-down')
ok(badge && badge.fig && badge.tag === 'RB' && badge.j + badge.p > 40 && badge.ring, 'the live screen\'s badge wears HIS figure in his kit colours (ringed in them, the position on a tab)', badge)
const tex = await E(() => { const sc = window.__gridironScene, K = window.__V151B.kit, src = sc.textures.exists('spr_you_dn_idle') ? sc.textures.get('spr_you_dn_idle').getSourceImage() : null
  const k = window.RIB_COSMETICS.face().kit
  if (!src) return null; const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const x = c.getContext('2d'); x.drawImage(src, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data
  const hue = (h) => { const t = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return t }
  const near = (hex, tol) => { const t = hue(hex); let n = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; const L = Math.max(1, d[i] + d[i + 1] + d[i + 2]), T = Math.max(1, t[0] + t[1] + t[2]); const dd = Math.abs(d[i] / L - t[0] / T) + Math.abs(d[i + 1] / L - t[1] / T) + Math.abs(d[i + 2] / L - t[2] / T); if (dd < tol) n++ } return n }
  return { kit: [k.j, k.p], j: near(k.j, 0.12), p: near(k.p, 0.12), K } })
ok(tex && tex.j > 60 && tex.p > 60, 'the live "you" sprite wears the same kit colours as his card and badge (jersey and pants hues on the texture)', tex && { kit: tex.kit, j: tex.j, p: tex.p })
// his number on the field: hold the broadcast still and walk him by hand (v153 G's harness)
await E(() => { const sc = window.__gridironScene; if (!window.__upd157) { window.__upd157 = sc.update; sc.update = function () {} } sc.time.paused = true; try { sc.tweens.pauseAll() } catch (e) {} })
const walk = (nf) => E(async (nf) => {
  const C = window.RIB_COSMETICS, sc = window.__gridironScene
  if (nf) C.grant(nf, 'earned'); C.equip('numfont', nf || null)
  let m = sc.markers.find(q => q && q.team === 'you'); if (!m) { sc.highlight(sc.markers[9], true); m = sc.markers[9] }
  if (!window.__home157) window.__home157 = { sx: m.sx, sy: m.sy }
  const H = window.__home157; m.forceState = null; m._launchUntil = 0; m.dirKey = 'dn'; if (m.body) { m.body.setRotation(0); m.body.setVisible(true) }
  const t0 = 2e6 + (window.__walk157 = (window.__walk157 || 0) + 1) * 1e4   // walked by hand, v153 G's way: a runner shows his number (a stance hides it)
  for (let k = 0; k < 28; k++) { sc.time.now = t0 + k * 16; m._spdPx = 170; sc.placeMarker(m, H.sx + k * 0.9, H.sy + k * 0.15, 16) }
  m.dirKey = 'dn'; sc.placeMarker(m, H.sx + 27 * 0.9, H.sy + 27 * 0.15, 16)
  const L = m.label, lc = L.canvas, ld = lc.getContext('2d').getImageData(0, 0, lc.width, lc.height).data
  let h = 2166136261; for (let i = 0; i < ld.length; i++) { h ^= ld[i]; h = Math.imul(h, 16777619) }
  let lgold = 0; for (let i = 0; i < ld.length; i += 4) if (ld[i + 3] > 200 && ld[i] > 200 && ld[i + 1] > 150 && ld[i + 1] < 235 && ld[i + 2] < 140) lgold++
  const lb = L.getBounds(), bb = m.body.getBounds(), onChest = lb.centerX > bb.left && lb.centerX < bb.right && lb.centerY > bb.top + bb.height * 0.2 && lb.centerY < bb.bottom - bb.height * 0.3
  const c = sc.cameras.main; try { c.stopFollow() } catch (e) {} try { c.removeBounds() } catch (e) {} c.setZoom(4 / Math.max(0.2, m.root.scale)); c.centerOn(m.root.x, m.root.y - 6 * m.root.scale)
  let gx = 0, gy = 0
  for (let t = 0; t < 8; t++) {   // something else may move the camera between frames: re-centre until he is in the middle
    await new Promise(r => setTimeout(r, 80))
    gx = (m.root.x - c.scrollX - c.width * c.originX) * c.zoom + c.width * c.originX; gy = (m.root.y - c.scrollY - c.height * c.originY) * c.zoom + c.height * c.originY
    if (Math.abs(gx - c.width / 2) < 12 && Math.abs(gy - (c.height / 2 + 6 * m.root.scale * c.zoom)) < 30) break
    try { c.stopFollow(); c.removeBounds() } catch (e) {} c.setZoom(4 / Math.max(0.2, m.root.scale)); c.centerOn(m.root.x, m.root.y - 6 * m.root.scale)
  }
  const S = 160, x0 = Math.max(0, Math.min(c.width - S, Math.round(gx - S / 2))), y0 = Math.max(0, Math.min(c.height - S, Math.round(gy - S / 2)))
  const url = await new Promise(r => sc.game.renderer.snapshotArea(x0, y0, S, S, img => { const cv = document.createElement('canvas'); cv.width = S; cv.height = S; cv.getContext('2d').drawImage(img, 0, 0); r(cv.toDataURL()) }))
  const px = await new Promise(r => { const im = new Image(); im.onload = () => { const cv = document.createElement('canvas'); cv.width = S; cv.height = S; const x = cv.getContext('2d'); x.drawImage(im, 0, 0); r(Array.from(x.getImageData(0, 0, S, S).data)) }; im.src = url })
  // the chest box under him (the plumbob above his head is gold too, and spins): centred on his body, below the helmet
  const cx = Math.round(gx - x0), cy = Math.round(gy - y0); let gold = 0
  for (let y = Math.max(0, cy - 30); y < Math.min(S, cy + 20); y++) for (let x = Math.max(0, cx - 22); x < Math.min(S, cx + 22); x++) { const i = (y * S + x) * 4; if (px[i] > 200 && px[i + 1] > 150 && px[i + 1] < 235 && px[i + 2] < 140) gold++ }
  return { url, cxy: [cx, cy, x0, y0], lgold, onChest, lh: +lb.height.toFixed(1), bh: +bb.height.toFixed(1), hash: h >>> 0, font: L.style.fontFamily, col: L.style.color, vis: L.visible, scale: L.scaleX, base: m._numScaleV104, gold, fn: window.__V157C.fieldNum, px } }, nf)
const w0 = await walk(null), w1 = await walk('nf_gold')
const saveUrl = (name, r) => { try { fs.writeFileSync(SHOTS + 'v157C-' + name + '.png', Buffer.from(r.url.split(',')[1], 'base64')) } catch {} }
saveUrl('field-number-team', w0); saveUrl('field-number-gold', w1)
ok(w1.vis && w1.hash !== w0.hash && /Georgia/.test(w1.font) && w1.col === '#ffd76f' && w1.scale > w1.base * 1.1, 'on the field his number wears the number font (a gold serif), drawn bigger than the team numbers', { font: w1.font, col: w1.col, scale: +w1.scale.toFixed(3), base: +(w1.base || 0).toFixed(3), vis: w1.vis, hash: [w0.hash, w1.hash] })
ok(w0.lgold === 0 && w1.lgold > 40 && w1.onChest && w1.lh > w0.lh * 1.15, 'and its pixels change: the gold numerals are rasterised on his chest, taller than the team numbers', { gold: [w0.lgold, w1.lgold], chest: w1.onChest, h: [w0.lh, w1.lh], body: w1.bh, screen: [w0.gold, w1.gold] })
await E(() => { const sc = window.__gridironScene; window.RIB_COSMETICS.equip('numfont', null); sc.time.paused = false; try { sc.tweens.resumeAll() } catch (e) {} if (window.__upd157) { sc.update = window.__upd157; delete window.__upd157 } })
const fe = await E(() => ({ c: window.__V157C.errs, g: window.__V153G ? window.__V153G.errs : [] }))
ok(fe.c.length === 0, 'the v157 C code ran without an error', fe)

// a gameplay event grants its icon: a Pee Wee title in the season log
const gp = await E(() => { const C = window.RIB_COSMETICS, st = window.__getGridironState(), e = st.player, keep = JSON.stringify(e.seasonLogV77 || [])
  const before = C.owned('ico_t0_1'); e.seasonLogV77 = (e.seasonLogV77 || []).concat([{ n: 99, level: 0, levelName: 'Pee Wee', champion: true, statLine: { rushYds: 900, rushTD: 12 }, awards: [] }])
  C.checkEarned(); const after = C.owned('ico_t0_1'), three = C.owned('ico_t0_3'); e.seasonLogV77 = JSON.parse(keep)
  return { before, after, three, grants: window.__V157C.lastIcons } })
ok(!gp.before && gp.after && !gp.three, 'a gameplay event grants its icon: a Pee Wee title unlocks "Pee Wee Champion" (and not the ×3)', gp)
// season challenges: play a few games (the pass observer's events) → the challenge icons
const sc = await E(() => { const S = window.RIB_SEASONS, C = window.RIB_COSMETICS; const t0 = S.challengeTotals().total, b = C.owned('ico_sc_1')
  for (let i = 0; i < 40; i++) S.event('game', { live: true, won: true, stat: { rushYds: 160, rushTD: 2, tackles: 7 }, pos: 'RB' })
  const T = S.challengeTotals(); C.iconTick(); return { t0, t1: T.total, byTitle: T.byTitle, before: b, after: C.owned('ico_sc_1'), five: C.owned('ico_sc_5') === (T.total >= 5) } })
ok(!sc.before && sc.t1 > sc.t0 && sc.after && sc.five, 'completing season challenges grants the challenge icons (1 completed → "Challenger")', { t: [sc.t0, sc.t1], titles: Object.keys(sc.byTitle).slice(0, 6) })
// the icon on the card is its own badge
await E(() => { window.RIB_COSMETICS.equip('icon', 'ico_t0_1') })
await E(() => window.go('profile')); await page.waitForTimeout(1800)
const cardIco = await E(() => { const el = document.querySelector('#screen .pc-ico-v151b'); return el ? { cls: el.className, id: el.dataset.icon, g: (el.querySelector('.ico157-g') || {}).textContent, t: (el.querySelector('.ico157-t') || {}).textContent } : null })
ok(cardIco && /ico157/.test(cardIco.cls) && cardIco.id === 'ico_t0_1' && cardIco.g && cardIco.t === 'PW', 'the equipped earned icon is its own badge on the card (glyph, disc, tag)', cardIco)

// the Locker's icon gallery: earned ones to equip, the rest locked with how to earn them
await E(() => window.go('locker')); await page.waitForTimeout(900)
await E(() => { const t = document.querySelector('.hubv75-tab[data-sec="style"]'); t && t.click() }); await page.waitForTimeout(500)
const gal = await E(() => new Promise(r => { window.cosCatV151B('icon'); setTimeout(() => { const items = [...document.querySelectorAll('.cos-item-v151b')]
  r({ n: items.length, discs: document.querySelectorAll('.cos-item-v151b .ico157').length, locked: items.filter(i => i.classList.contains('locked')).length, how: (items.find(i => i.classList.contains('locked')) || {}).innerText }) }, 700) }))
await shot('icon-gallery')
ok(gal.n >= 40 && gal.discs >= 40 && gal.locked >= 30 && /Earn it/.test(gal.how || ''), 'the Locker\'s PROFILE ICONS: every icon drawn as its badge, the locked ones say how to earn them', { n: gal.n, discs: gal.discs, locked: gal.locked })

// ================= 2. the figure: number font + helmet on the profile card =================
const cardFig = (nf, hel) => E(async ([nf, hel]) => { const C = window.RIB_COSMETICS; ['nf_gold', 'hel_chrome_gold'].forEach(id => C.grant(id, 'earned')); C.equip('numfont', nf); C.equip('helmet', hel)
  window.go('menu'); await new Promise(r => setTimeout(r, 200)); window.go('profile'); await new Promise(r => setTimeout(r, 1500))
  const cv = document.querySelector('#screen .pc-cv-v151b'); if (!cv) return null
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data
  let h = 2166136261; for (let i = 0; i < d.length; i += 7) { h ^= d[i]; h = Math.imul(h, 16777619) }
  return { w: cv.width, h: cv.height, hash: h >>> 0, px: Array.from(d), num: window.__V157C.figs } }, [nf, hel])
await E(() => { (window.RIB_TUNE = window.RIB_TUNE || {}).v156Ccos = 0 })   // chrome gold / gold foil are member looks under v156 C: the drawing is what is tested
const f0 = await cardFig('nf_team', 'hel_team'), f1 = await cardFig('nf_gold', 'hel_team'), f2 = await cardFig('nf_gold', 'hel_chrome_gold')
await shot('profile-numfont-helmet', '#screen .pcard-v151b')
const region = (a, b, W, H, y0, y1, x0, x1) => { let n = 0; for (let y = Math.floor(H * y0); y < H * y1; y++) for (let x = Math.floor(W * x0); x < W * x1; x++) { const i = (y * W + x) * 4; if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) n++ } return n }
const chest = f0 && f1 ? region(f0.px, f1.px, f0.w, f0.h, 0.38, 0.62, 0.25, 0.75) : 0, chestElse = f0 && f1 ? region(f0.px, f1.px, f0.w, f0.h, 0, 0.3, 0, 1) + region(f0.px, f1.px, f0.w, f0.h, 0.7, 1, 0, 1) : -1
ok(chest > 40 && chestElse === 0, 'the number font changes his number on the profile figure\'s chest (and nothing else)', { chest, elsewhere: chestElse })
const helm = f1 && f2 ? region(f1.px, f2.px, f1.w, f1.h, 0.02, 0.3, 0.2, 0.8) : 0
ok(helm > 300, 'the equipped helmet renders on the profile figure (the helmet pixels change vs the team shell)', { helm })
const gold = f2 ? (() => { let n = 0; for (let i = 0; i < f2.px.length; i += 4) { const r = f2.px[i], g = f2.px[i + 1], b = f2.px[i + 2]; if (r > 170 && g > 130 && b < 110 && r > b + 80) n++ } return n })() : 0
ok(gold > 200, 'the chrome gold shell reads gold on the card', { gold })

// ================= 3. the growth screen is the profile figure =================
const gr = await E(async () => { const C = window.RIB_COSMETICS, G = window.__GROW_V132, st = window.__getGridironState()
  const pc = document.querySelector('#screen .pc-cv-v151b'), age = st.player.age
  G.show(); await new Promise(r => setTimeout(r, 900))
  const gc = document.querySelector('#growV132 .gw-man canvas.gw-cv'), last = G.last
  if (!gc || !pc) return { gc: !!gc, pc: !!pc }
  const hash = (cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) } return h >>> 0 }
  const fresh = document.createElement('canvas'); C.drawFigure(fresh, last.age)
  const fresh2 = document.createElement('canvas'); C.drawFigure(fresh2, age)
  return { gc: true, pc: true, gAge: last.age, pAge: age, g: hash(gc), f: hash(fresh), p: hash(pc), f2: hash(fresh2), dims: [gc.width, gc.height, pc.width, pc.height], one: window.__V157C.growth, fig: G.fig && G.fig.mode, num: window.__V157C.lastGrowth } })
await shot('growth')
ok(gr.gc && gr.g === gr.f && gr.p === gr.f2 && (gr.gAge !== gr.pAge || gr.g === gr.p), 'the growth screen draws the SAME figure as the profile card (identical pixels from the one renderer; the same age → the same canvas)', gr)
ok(gr.one >= 1 && gr.num && gr.num.numfont === 'nf_gold' && gr.num.helmet === 'hel_chrome_gold', 'the growth figure wears his helmet and his number font', gr.num)
await E(() => { try { window.__GROW_V132.close() } catch (e) {} document.getElementById('growV132')?.remove() })

// ================= 5a. the medal box, the % card =================
await E(() => window.go('profile')); await page.waitForTimeout(1500)
const mb = await E(() => { const b = document.querySelector('#screen .pc-medal-v152'); if (!b) return null; const cs = getComputedStyle(b, '::before'); const md = b.querySelector('.lg-medal-v152'), mcs = md ? getComputedStyle(md, '::before') : null
  return { disp: cs.display, anim: cs.animationName, content: cs.content, medalAnim: mcs ? mcs.animationName : 'none' } })
ok(mb && (mb.disp === 'none' || mb.content === 'none') && mb.medalAnim === 'none', 'the circling light is gone from the profile\'s medal box (no ::before spin, the medal\'s own rays hold still)', mb)
const L = await E(() => { const L = window.RIB_LEGACY; return [1, 2, 50, 100, 200, 300, 500, 700].map(r => ({ r, p: L.share(r).pct, t: L.share(r).text })) })
const mono = L.every((x, i) => i === 0 || x.p < L[i - 1].p)
ok(mono && L[0].p === 100 && L.find(x => x.r === 500).p < 0.01 && L.find(x => x.r === 50).p < 20 && L.find(x => x.r === 50).p > 2, 'the % falls monotonically with rank: rank 1 = 100%, rank 500 < 0.01%', L.map(x => x.r + ':' + x.t).join(' '))
await E(() => document.querySelector('#screen .pc-medal-v152').click()); await page.waitForTimeout(500)   // (a growth-wheel overlay can sit over the screen: a DOM click, the same event path)
const card = await E(() => { const o = document.querySelector('.lgs-v157c'); return o ? { txt: o.innerText.replace(/\s+/g, ' ').slice(0, 220), src: o.querySelector('.lgs-pct').dataset.src, view: window.__getGridironState().view } : null })
ok(card && /%/.test(card.txt) && /LEGACY RANK 1/.test(card.txt) && /BRONZE/.test(card.txt) && card.view === 'profile', 'tapping the profile\'s medal box opens the % card (the medal, its rank, tier, colour, the share)', card)
await shot('medal-card')
await E(() => document.querySelector('.lgs-v157c .lgs-ok').click())
await E(() => window.RIB_LEGACY.shareCard(200)); await page.waitForTimeout(400); await shot('medal-card-200')
const c200 = await E(() => { const o = document.querySelector('.lgs-v157c'); const t = o ? o.innerText.replace(/\s+/g, ' ') : ''; o && o.remove(); return t.slice(0, 160) })
ok(/TOP ≈0\.15%/.test(c200) && /Only ≈0\.15% of players/.test(c200) && /GOLD/.test(c200), 'a rank-200 medal reads "Top ≈0.15%" — "Only ≈0.15% of players have reached this medal" (gold)', c200)
// the trophy case's medal
await E(() => { const t = document.querySelector('.hubv75-tab[data-sec="case"]'); t && t.click() }); await page.waitForTimeout(700)
const cs2 = await E(async () => { const s = document.querySelector('.lgk-slot'); if (!s) return null; s.click(); await new Promise(r => setTimeout(r, 300)); const o = document.querySelector('.lgs-v157c'); const r = !!o; o && o.remove(); return r })
ok(cs2 === true, 'tapping the trophy case\'s medal opens the % card', cs2)
// the live hook
const live = await E(async () => { window.__LEGACY_SHARE_V157C = (r) => r === 1 ? 100 : 4.2; const L = window.RIB_LEGACY; const a = await L.shareLive(50); const b = L.share(50); delete window.__LEGACY_SHARE_V157C; return { a: a && a.text, src: b.source, text: b.text } })
ok(live.a === '4.2%' && live.src === 'live', 'with a live source configured the card shows the live share instead of the model', live)
// the main menu's medal
await E(() => window.go('menu')); await page.waitForTimeout(1500)
const mm = await E(async () => { const s = document.querySelector('.rib9-medalbox-v153d .lgbox-medal .lg-medal-v152') || document.querySelector('.rib9-medalbox-v153d .lgbox-stage'); if (!s) return { box: false }; s.click(); return { box: true } })
await page.waitForTimeout(600)
const mm2 = await E(() => { const o = document.querySelector('.lgs-v157c'), v = window.__getGridironState().view; const r = { card: !!o, view: v, spin: (() => { const m = document.querySelector('.rib9-medalbox-v153d .lg-medal-v152'); return m ? getComputedStyle(m, '::before').animationName : 'none' })() }; return r })
await shot('menu-medal-card')
await E(() => { const o = document.querySelector('.lgs-v157c'); o && o.remove() })
ok(mm.box && mm2.card && mm2.view === 'menu' && mm2.spin === 'none', 'tapping the main menu\'s medal opens the % card (the rest of the box still opens the profile)', mm2)

// ================= 6. no gameplay change =================
const neutral = await E(() => { const st = window.__getGridironState(), keep = JSON.stringify(st.player || null), T = (window.RIB_TUNE = window.RIB_TUNE || {})
  const seedRun = () => { let s = 4242; const orig = Math.random; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let v = Math.imul(s ^ s >>> 15, 1 | s); v = v + Math.imul(v ^ v >>> 7, 61 | v) ^ v; return ((v ^ v >>> 14) >>> 0) / 4294967296 }
    const out = []; try { for (let g = 0; g < 6; g++) { const r = window.__simGameV2(50 + g * 4, ['QB', 'RB', 'WR', 'LB'][g % 4]); out.push([r.usScore, r.themScore, r.plays.length, r.team.yds, r.oppTeam.yds]) } } finally { Math.random = orig }
    return JSON.stringify(out) }
  const a = seedRun(); st.player = JSON.parse(keep)
  T.v157Cfig = 0; T.v157Cicons = 0; T.v157Cmedal = 0; const b = seedRun(); st.player = JSON.parse(keep); delete T.v157Cfig; delete T.v157Cicons; delete T.v157Cmedal
  return { same: a === b, a: a.slice(0, 60) } })
ok(neutral.same, 'seeded games score identically with the v157 C switches on and off', neutral)

console.log(JSON.stringify({ pass, fail, errors: errs.length }))
console.log('page errors:', errs.length ? errs.slice(0, 8) : 'none')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
