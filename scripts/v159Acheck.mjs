// Dev check: v159 A — THE WHOLE TEAM WEARS IT (src/28-cosmetics.js + src/05 ribTeamKitV159A / numPlaceV104), at a 400x860 phone:
//   1. the Locker: next to the uniforms a "Colours: Uniform's own · Team palette" choice, stored in the cosmetics store
//      (outside the save); the uniform previews repaint in the chosen mode
//   2. team palette on the profile figure: a patterned uniform (Electric Blue's chest band) drawn in its own colours carries
//      none of the team's two hues; in "Team palette" the jersey is the primary and the band the secondary (hue sampling)
//   3. the live field (a linebacker, so both possessions are broadcast — kitsidecheck's way), the whole team: with a uniform + helmet equipped, every team-mate's CURRENT texture changes and
//      every opponent's does not — sampled on a possession of ours AND one of theirs; the sideline's backups rebind;
//      the "you" textures are a copy of the team's (one recolour per kit, re-equipping the same kit costs nothing)
//   4. team palette on the field: the pattern's pixels on the team's texture point along the team's secondary colour
//   5. numbers: the profile chest number carries the jersey's shading (its luminance tracks the torso's, correlation
//      well above the flat v158 A sticker's) and every number pixel lies inside the jersey; the field's numbers take the
//      kit's contrast (a white kit -> a dark number), hide on side views (label and a number-font image), turn on a
//      quarter view, let the fabric through
//   6. perf: the team recolour and the "you" copy are bounded; frame time with the whole team dressed is within bounds of
//      the undressed; seeded games identical (kit, palette, switches off); no Math.random from src/28; no page errors
// Screenshots go to $SHOTS (default /tmp/claude-0/shots/), prefixed v159A-.
//   node scripts/v159Acheck.mjs        (GAME_URL=http://localhost:5173/)
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
  await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && window.RIB_COSMETICS && window.__V159A && window.__CHASE_V94 && window.__CHASE_V94.ready, null, { timeout: 60000 })
  await page.waitForTimeout(600)
}
await boot(); await page.goto(GAME_URL, { waitUntil: 'networkidle' }); await boot()   // warm past vite's one-time reload
const shot = async (name, sel) => { try { if (sel) { const el = await page.$(sel); if (el) { await el.screenshot({ path: SHOTS + 'v159A-' + name + '.png' }); return } } await page.screenshot({ path: SHOTS + 'v159A-' + name + '.png' }) } catch {} }
const saveUrl = (name, url) => { try { if (url) fs.writeFileSync(SHOTS + 'v159A-' + name + '.png', Buffer.from(url.split(',')[1], 'base64')) } catch {} }
// Math.random is watched from here on: a look must never draw from the game's stream (draws made from inside src/28)
await E(() => { const o = Math.random; window.__mr159 = 0; Math.random = function () { if (/28-cosmetics/.test(String(new Error().stack))) window.__mr159++; return o.apply(this, arguments) } })
await E(() => { const C = window.RIB_COSMETICS; ['uni_electric', 'uni_road', 'uni_camo', 'hel_star', 'hel_gloss_white'].forEach(id => C.grant(id, 'earned')) })

// ================= 2. team palette on the profile figure =================
const fig = await E(async () => { const C = window.RIB_COSMETICS, V = window.__V159A, tc = window.__GRIDIRON_TEAM_CUSTOM__ || (window.__GRIDIRON_TEAM_CUSTOM__ = {}), keep = tc.col
  await new Promise(r => { let n = 0; const f = () => (window.__V153E && window.__V153E.fig.img) || n++ > 40 ? r() : (C.drawCharacter(document.createElement('canvas'), { j: '#1f4fd0', p: '#e8c86a' }, 22, {}), setTimeout(f, 150)); f() })
  tc.col = ['#c8102e', '#12a84a']   // red / green: far from Electric Blue's blues
  C.equip('uniform', 'uni_electric'); C.equip('helmet', null)
  const hue = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx === mn) return [0, 0]; let h = mx === r ? (60 * ((g - b) / (mx - mn)) + 360) % 360 : mx === g ? 60 * ((b - r) / (mx - mn)) + 120 : 60 * ((r - g) / (mx - mn)) + 240; return [h, (mx - mn) / mx] }
  const draw = (mode) => { V.setUniColour(mode); const cv = document.createElement('canvas'); const res = C.drawCharacter(cv, C.profile().cosmetics.kit, 22, {}); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, W = cv.width, H = cv.height
    let red = 0, green = 0, blue = 0; const g = res && res.geo, y0 = g ? Math.round(g.by * (g.dpr || 1)) : 0, y1 = g ? Math.round((g.by + g.bh * 0.45) * (g.dpr || 1)) : H   // the torso rows
    for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (d[i + 3] < 200) continue; const [h, s] = hue(d[i], d[i + 1], d[i + 2]); if (s < 0.4) continue; if (h < 10 || h > 350) red++; else if (h > 110 && h < 170) green++; else if (h > 200 && h < 235) blue++ }
    return { red, green, blue, url: cv.toDataURL(), kit: C.profile().cosmetics.kit } }
  const own = draw('own'), team = draw('team'); V.setUniColour('own'); tc.col = keep
  return { own, team } })
saveUrl('profile-uniform-own', fig.own.url); saveUrl('profile-uniform-team', fig.team.url)
ok(fig.own.red < 60 && fig.own.green < 60 && fig.own.blue > 400, 'in its own colours Electric Blue is blue, with none of the team\'s red or green', { red: fig.own.red, green: fig.own.green, blue: fig.own.blue })
ok(fig.team.red > 150 && fig.team.green > 25 && fig.team.blue < fig.own.blue * 0.25 && fig.team.kit.j === '#c8102e' && fig.team.kit.t === '#12a84a' && fig.team.kit.pat === 'chest', 'in "Team palette" the same design is the primary (red jersey) with the secondary chest band (green) on the profile figure', { red: fig.team.red, green: fig.team.green, blue: fig.team.blue, kit: fig.team.kit })

// ================= 5a. the printed chest number (profile) =================
const num = await E(() => { const C = window.RIB_COSMETICS, V = window.__V159A, T = (window.RIB_TUNE = window.RIB_TUNE || {})
  C.equip('uniform', null); C.equip('helmet', null)
  const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
  const one = (kit, nf, on) => { T.v159Anum = on; const a = document.createElement('canvas'), b = document.createElement('canvas')
    const ra = C.drawCharacter(a, kit, 22, { num: 23, numfont: nf }), rb = C.drawCharacter(b, kit, 22, {}); delete T.v159Anum
    const W = a.width, H = a.height, da = a.getContext('2d').getImageData(0, 0, W, H).data, db = b.getContext('2d').getImageData(0, 0, W, H).data
    const mask = V.jerseyMask(rb, W, H)
    let n = 0, outside = 0, xs = [], ys = [], bright = 0
    for (let j = 0; j < W * H; j++) { const i = j * 4; if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) < 40) continue
      n++; if (!mask || mask[i + 3] < 10) outside++
      const la = lum(da, i), lb = lum(db, i); if (la - lb > 60) { bright++; xs.push(la); ys.push(lb) } }   // the numeral's fill (well above the dark jersey under it)
    const mean = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length), mx = mean(xs), my = mean(ys)
    let sxy = 0, sxx = 0, syy = 0; for (let k = 0; k < xs.length; k++) { sxy += (xs[k] - mx) * (ys[k] - my); sxx += (xs[k] - mx) ** 2; syy += (ys[k] - my) ** 2 }
    const r = sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0, sd = Math.sqrt(sxx / Math.max(1, xs.length))
    return { n, outside, bright, r: +r.toFixed(3), sd: +sd.toFixed(1), url: a.toDataURL(), num: ra && ra.num }
  }
  const kit = { j: '#1f4fd0', p: '#e8c86a' }
  const on = one(kit, null, 1), off = one(kit, null, 0), pro = one(kit, 'nf_pro', 1), proOff = one(kit, 'nf_pro', 0)
  // a white kit: the team face picks a dark ink
  const wcv = document.createElement('canvas'); C.drawCharacter(wcv, { j: '#eceef1', p: '#c9ced6', t: '#1c2a44', pat: 'sleeves' }, 22, { num: 23 }); const wInk = V.chest && V.chest.ink
  const bcv = document.createElement('canvas'); C.drawCharacter(bcv, kit, 22, { num: 23 }); const bInk = V.chest && V.chest.ink
  return { on, off, pro, proOff, wInk, bInk, wUrl: wcv.toDataURL(), chest: V.chest, errs: V.errs } })
saveUrl('number-profile-after', num.on.url); saveUrl('number-profile-before', num.off.url); saveUrl('number-profile-font-after', num.pro.url); saveUrl('number-profile-font-before', num.proOff.url); saveUrl('number-profile-white-kit', num.wUrl)
ok(num.on.n > 60 && num.on.outside === 0 && num.pro.n > 60 && num.pro.outside === 0, 'the chest number is clipped to the jersey: every pixel it changes lies on the jersey\'s own torso (the team face and a number font)', { team: [num.on.n, num.on.outside], font: [num.pro.n, num.pro.outside], sticker: [num.off.n, num.off.outside] })
ok(num.on.bright > 20 && num.on.r > 0.45 && num.on.sd > 4 && num.on.r > num.off.r + 0.25, 'the number carries the jersey\'s shading: its fill\'s luminance tracks the torso under it (the flat sticker does not)', { r: [num.on.r, num.off.r], sd: [num.on.sd, num.off.sd], px: num.on.bright })
ok(/^#(0|1|2)/.test(num.wInk || '') && num.bInk === '#ffffff', 'the team face picks its colour from the kit: dark on a white jersey, white on a dark one', { white: num.wInk, dark: num.bInk })

// ================= 1. the Locker's choice =================
await E(() => window.go('menu')); await page.waitForTimeout(1500); await E(() => window.go('locker')); await page.waitForTimeout(900)
await E(() => { const t = document.querySelector('.hubv75-tab[data-sec="style"]'); t && t.click() }); await page.waitForTimeout(500)
const pvHash = `() => { const out = {}; document.querySelectorAll('.cos-item-v151b[data-cos^="uni_"] .cos-pvbox-v151b canvas').forEach(cv => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) } out[cv.closest('.cos-item-v151b').dataset.cos] = h >>> 0 }); return out }`
const lk0 = await E(async (src) => { window.cosCatV151B('uniform'); await new Promise(r => setTimeout(r, 700)); const row = document.querySelector('.cos-unicol-v159a'), b = row ? [...row.querySelectorAll('button')] : []
  return { row: !!row, btn: b.map(x => x.textContent.trim()), on: b.map(x => x.classList.contains('on')), mode: window.__V159A.uniColour(), pv: eval(src)() } }, pvHash)
await shot('locker-own', '.cos-style-v151b')
const lk1 = await E(async (src) => { const b = [...document.querySelectorAll('.cos-unicol-v159a button')]; b[1] && b[1].click(); await new Promise(r => setTimeout(r, 900))
  const st = JSON.parse(localStorage.getItem('rib.cosmetics.v1') || '{}'), save = JSON.stringify(window.__getGridironState() || {})
  return { mode: window.__V159A.uniColour(), stored: st.uniColV159A, inSave: /uniColV159A/.test(save), on: [...document.querySelectorAll('.cos-unicol-v159a button')].map(x => x.classList.contains('on')), pv: eval(src)() } }, pvHash)
await shot('locker-team', '.cos-style-v151b')
const pvChanged = Object.keys(lk1.pv).filter(k => k !== 'uni_team' && lk0.pv[k] !== lk1.pv[k]).length, pvN = Object.keys(lk1.pv).length
ok(lk0.row && lk0.btn.length === 2 && /own/i.test(lk0.btn[0]) && /team palette/i.test(lk0.btn[1]) && lk0.on[0] && !lk0.on[1] && lk0.mode === 'own', 'the Locker shows "Colours: Uniform\'s own · Team palette" next to the uniforms (own by default)', lk0.btn)
ok(lk1.mode === 'team' && lk1.stored === 'team' && !lk1.inSave && lk1.on[1], 'choosing "Team palette" is stored in the cosmetics store, not the career save', { mode: lk1.mode, stored: lk1.stored, inSave: lk1.inSave })
ok(pvN >= 5 && pvChanged >= pvN - 2, 'the uniform previews repaint in the chosen colours', { changed: pvChanged, of: pvN })
await E(() => window.__V159A.setUniColour('own'))

// ================= 3. the live field =================
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function step (t) {
  const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    const el = t === 'POS' ? (els.find(e => /^LB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : t === 'LIVE' ? els.find(e => /PLAY WEEK \d+ LIVE/.test(txt(e))) : els.find(e => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis })
  await page.waitForTimeout(t === 'PLAN' ? 3000 : 800); return r
}
await E(() => window.go('menu')); await page.waitForTimeout(800)
const tBoot0 = Date.now()
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING']) await step(t)
// dressed from the start: the team's first registration is the kit
await E(() => { const C = window.RIB_COSMETICS; C.equip('uniform', 'uni_electric'); C.equip('helmet', 'hel_star') })
// every snap on both sides of the ball (not only his side's — v153 B's default): the check needs a possession of each
await E(() => { const st = window.__getGridironState(); if (st) { st.settings = st.settings || {}; st.settings.playsDefaultV153B = 1; st.settings.onlyInvolved = false; st.settings.skipOpp = false; st.settings.myPlaysV156D = false } })
for (const t of ['LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
let scene = false
for (let i = 0; i < 150; i++) { scene = await E(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length >= 22)); if (scene) break
  await E(() => { const g = document.getElementById('gv42go'); if (g && g.offsetParent) g.click() })
  if (i === 10 || i === 40 || i === 80) { await step('LIVE'); await step('PLAN') }
  if (i === 20 || i === 50 || i === 90) { await step('CONTINUE TO MATCH'); await step('Continue') }
  await page.waitForTimeout(500) }
ok(scene, 'a new career reached the live field', { sec: Math.round((Date.now() - tBoot0) / 1000) })
if (scene) {
  await page.waitForTimeout(1500)
  await E(() => { document.getElementById('gv139gate')?.remove(); document.getElementById('growthV42')?.remove() })
  const reg0 = await E(() => ({ F: Object.assign({}, window.__V159A_FIELD), kit: window.__V151B.kit }))
  ok(reg0.F.kit && reg0.F.regs >= 1, 'the team was dressed when the field came up (its first registration is the kit, not the plain palette then a re-dress)', { regs: reg0.F.regs, coldMs: reg0.F.lastMs, clones: reg0.F.clones, kit: reg0.kit && reg0.kit.uniform })
  // the undressed textures, per key (the "off" / "def" / "you" sets), for the comparisons below
  const snapTex = `(sc, pre) => { const out = {}; sc.textures.getTextureKeys().filter(k => pre.some(p => k.indexOf(p) === 0)).forEach(k => { const src = sc.textures.get(k).getSourceImage(); const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const x = c.getContext('2d'); x.drawImage(src, 0, 0); out[k] = x.getImageData(0, 0, c.width, c.height).data }); return out }`
  const diffN = `(a, b) => { if (!a || !b || a.length !== b.length) return -1; let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) + Math.abs(a[i + 3] - b[i + 3]) > 24) n++; return n }`
  const base = await E(async ({ snapSrc }) => { const sc = window.__gridironScene, C = window.RIB_COSMETICS, snap = eval(snapSrc)
    window.__V159A_BASE = null; C.equip('uniform', null); C.equip('helmet', null); await new Promise(r => setTimeout(r, 300))
    window.__V159A_BASE = snap(sc, ['spr_off_', 'spr_def_', 'spr_you_'])
    const F0 = window.__V159A_FIELD.regs, t0 = performance.now(); C.equip('uniform', 'uni_electric'); C.equip('helmet', 'hel_star'); const ms = performance.now() - t0
    await new Promise(r => setTimeout(r, 300))
    const F = Object.assign({}, window.__V159A_FIELD); C.refreshField(); const again = window.__V159A_FIELD.regs - F.regs
    // the same registration with the kit off (TU v159Ateam 0 registers the team's plain palette): the deco's own cost
    const T = (window.RIB_TUNE = window.RIB_TUNE || {}); T.v159Ateam = 0; C.refreshField(); const plainMs = window.__V159A_FIELD.lastMs; delete T.v159Ateam; C.refreshField(); const dressedMs = window.__V159A_FIELD.lastMs
    return { n: Object.keys(window.__V159A_BASE).length, equipMs: +ms.toFixed(1), regs: F.regs - F0, cloneMs: F.cloneMs, lastMs: F.lastMs, plainMs, dressedMs, cloned: F.cloned, again } }, { snapSrc: snapTex })
  ok(base.n > 1000 && base.again === 0 && base.cloned > 300 && base.cloneMs < Math.max(150, base.plainMs), 'one recolour per kit: the same kit again costs nothing; "you" is a copy (cheaper than a plain recolour)', base)
  ok(base.dressedMs <= base.plainMs * 6 + 400, 'the dressed recolour is bounded against the plain one (paid once per kit, never per frame)', { plainMs: base.plainMs, dressedMs: base.dressedMs, cloneMs: base.cloneMs })

  // the screenshot taken with each side's sample: the whole team, offence and defence
  const teamShot = `async () => { const sc = window.__gridironScene, c = sc.cameras.main, us = window.__V105_2 && window.__V105_2.you; const mates = sc.markers.filter(m => m && m.kit !== 'def' && m.root)
    const cx = mates.reduce((s, m) => s + m.root.x, 0) / mates.length, cy = mates.reduce((s, m) => s + m.root.y, 0) / mates.length
    try { c.stopFollow(); c.removeBounds() } catch (e) {} for (let t = 0; t < 3; t++) { c.setZoom(2.6); c.centerOn(cx, cy); await new Promise(r => setTimeout(r, 90)) }
    return await new Promise(r => sc.game.renderer.snapshotArea(0, 0, c.width, c.height, img => { const cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height; cv.getContext('2d').drawImage(img, 0, 0); r(cv.toDataURL()) })) }`
  // both possession sides: every marker's current texture against the undressed one of the same key
  const sides = await E(async ({ diffSrc, shotSrc }) => { const sc = window.__gridironScene, diff = eval(diffSrc), shotF = eval(shotSrc), B = window.__V159A_BASE, out = { ours: null, theirs: null }
    const read = (k) => { if (!sc.textures.exists(k)) return null; const src = sc.textures.get(k).getSourceImage(), c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const x = c.getContext('2d'); x.drawImage(src, 0, 0); return x.getImageData(0, 0, c.width, c.height).data }
    for (let i = 0; i < 2000 && (!out.ours || !out.theirs); i++) {
      const P = sc.play, et = P && P.payload
      if (et && sc.markers.length >= 22 && P.snapped) { const usOff = et.offense !== 'them', side = usOff ? 'ours' : 'theirs'
        if (!out[side]) { const rows = sc.markers.slice(0, 22).map((m, k) => { const key = m.body && m.body.texture && m.body.texture.key, mate = (m.team === 'off') === usOff || m.team === 'you'
            return { k, mate, kit: m.kit, key, d: key && B[key] ? diff(read(key), B[key]) : null } }).filter(r => r.key && r.key !== 'rib_player_fallback')
          out[side] = { rows: rows.length, mates: rows.filter(r => r.mate).map(r => r.d), opps: rows.filter(r => !r.mate).map(r => r.d), kits: rows.map(r => (r.mate ? 'M' : 'O') + r.kit[0]).join('') }
          const upd = sc.update, cam = sc.cameras.main, z = cam.zoom, sx = cam.scrollX, sy = cam.scrollY; sc.update = function () {}; try { out[side].url = await shotF() } catch (e) {} cam.setZoom(z); cam.setScroll(sx, sy); sc.update = upd } }   // the picture, the moment it is sampled
      await new Promise(r => setTimeout(r, 150)) }
    return out }, { diffSrc: diffN, shotSrc: teamShot })
  saveUrl('field-team-offence', sides.ours && sides.ours.url); saveUrl('field-team-defence', sides.theirs && sides.theirs.url)
  const good = (s) => s && s.mates.length >= 8 && s.opps.length >= 8 && s.mates.every(d => d > 60) && s.opps.every(d => d === 0)
  ok(good(sides.ours), 'our ball: every team-mate\'s texture wears the uniform + helmet, every opponent\'s is untouched', sides.ours ? { mates: sides.ours.mates, opps: sides.ours.opps } : null)
  ok(good(sides.theirs), 'their ball: the same — his team is dressed on defence too, the opponent keeps its own kit', sides.theirs ? { mates: sides.theirs.mates, opps: sides.theirs.opps } : null)
  const side = await E(() => { const sc = window.__gridironScene, S = sc.side, items = S && S.items ? S.items.filter(im => im && im.texture && /^spr_off_/.test(im.texture.key)) : []; window.RIB_COSMETICS.refreshField()
    return { n: items.length, live: items.filter(im => im.texture && im.texture.key !== '__MISSING' && sc.textures.exists(im.texture.key)).length, rebound: window.__V159A_FIELD.side } })
  ok(side.n === 0 || (side.live === side.n && side.rebound === side.n), 'our sideline\'s backups wear the team\'s (re-dressed) textures', side)


  // ================= 4. team palette on the field =================
  const fpal = await E(async ({ diffSrc }) => { const sc = window.__gridironScene, C = window.RIB_COSMETICS, V = window.__V159A, F = window.__V159A_FIELD, base = F.base()
    const read = (k) => { const src = sc.textures.get(k).getSourceImage(), c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const x = c.getContext('2d'); x.drawImage(src, 0, 0); return x.getImageData(0, 0, c.width, c.height).data }
    const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], cos = (a, b) => { const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2], n = Math.hypot(...a) * Math.hypot(...b); return n ? d / n : 0 }
    C.equip('helmet', null); C.equip('uniform', null); await new Promise(r => setTimeout(r, 200)); const plain = read('spr_off_dn_run2')
    C.equip('uniform', 'uni_electric'); V.setUniColour('team'); await new Promise(r => setTimeout(r, 300)); const team = read('spr_off_dn_run2'), kit = Object.assign({}, window.__V151B.kit)
    V.setUniColour('own'); await new Promise(r => setTimeout(r, 300)); const own = read('spr_off_dn_run2'), ownClash = !!(window.__V151B.kit && window.__V151B.kit.clash)   // its own jersey may read as this opponent's: then it is not worn
    const t2 = hx(base[1]), far = Math.abs(t2[0] - hx(base[0])[0]) + Math.abs(t2[1] - hx(base[0])[1]) + Math.abs(t2[2] - hx(base[0])[2]) >= 90
    let changed = 0, along = 0, ownDiff = 0
    for (let i = 0; i < team.length; i += 4) { if (team[i + 3] < 40) continue
      if (Math.abs(team[i] - own[i]) + Math.abs(team[i + 1] - own[i + 1]) + Math.abs(team[i + 2] - own[i + 2]) > 24) ownDiff++
      if (Math.abs(team[i] - plain[i]) + Math.abs(team[i + 1] - plain[i + 1]) + Math.abs(team[i + 2] - plain[i + 2]) <= 24) continue
      changed++; if (cos([team[i], team[i + 1], team[i + 2]], t2) > 0.97) along++ }
    return { base, far, changed, along, ownDiff, ownClash, kit } }, { diffSrc: diffN })
  ok(fpal.kit.p1 === fpal.base[0] && fpal.kit.p2 === fpal.base[1] && fpal.changed >= 20 && (fpal.ownDiff > 200 || fpal.ownClash) && (!fpal.far || fpal.along >= fpal.changed * 0.8), 'on the field "Team palette" wears the uniform\'s pattern in the team\'s two colours (the chest band points along the secondary; the jersey stays the primary)', fpal)

  // ================= 5b. numbers on the field =================
  const fnum = await E(async () => { const sc = window.__gridironScene, C = window.RIB_COSMETICS, T = (window.RIB_TUNE = window.RIB_TUNE || {})
    if (!window.__upd159b) { window.__upd159b = sc.update; sc.update = function () {} } sc.time.paused = true; try { sc.tweens.pauseAll() } catch (e) {}
    C.equip('uniform', 'uni_road'); C.equip('helmet', null); C.equip('numfont', null); await new Promise(r => setTimeout(r, 300))
    const kitRoad = Object.assign({}, window.__V151B.kit)   // (a white kit — unless it would read as the opponent's this game: then the team's own)
    let me = sc.markers.find(q => q && q.team === 'you'); if (!me) { sc.highlight(sc.markers[9], true); me = sc.markers[9] }
    const mate = sc.markers.find(q => q && q !== me && q.kit === 'off'), opp = sc.markers.find(q => q && q.kit === 'def')
    const walk = (m, dir) => { m.forceState = null; m._launchUntil = 0; if (!m.__h159) m.__h159 = { sx: m.sx, sy: m.sy }; const H = m.__h159, t0 = 4e6 + (window.__w159 = (window.__w159 || 0) + 1) * 1e4
      for (let k = 0; k < 20; k++) { sc.time.now = t0 + k * 16; m._spdPx = 170; m.dirKey = dir; sc.placeMarker(m, H.sx + k * 0.9, H.sy + k * 0.15, 16) } m.dirKey = dir; sc.placeMarker(m, H.sx + 19 * 0.9, H.sy + 19 * 0.15, 16)
      const L = m.label, img = m._nfImgV158A; return { dir: m.dirKey, vis: L.visible, a: +L.alpha.toFixed(2), col: L.style.color, sx: +L.scaleX.toFixed(3), sy: +L.scaleY.toFixed(3), x: +L.x.toFixed(2), img: !!(img && img.scene), imgVis: !!(img && img.scene && img.visible) } }
    const mDn = walk(mate, 'dn'), mSd = walk(mate, 'sd'), mDr = walk(mate, 'dr'), oDn = walk(opp, 'dn')
    C.grant('nf_pro', 'earned'); C.equip('numfont', 'nf_pro')
    const yDn = walk(me, 'dn'), ySd = walk(me, 'sd'), yUp = walk(me, 'up')
    C.equip('numfont', null)
    T.v159Anum = 0; const offDn = walk(mate, 'dn'); delete T.v159Anum; walk(mate, 'dn')
    const lum = (h) => { const n = parseInt(String(h).slice(1), 16); return 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255) }
    const tm = window.__V159A_FIELD.teams(), want = window.__V159A.ink(tm.off[0], tm.off[1], null), wantOpp = window.__V159A.ink(tm.def[0], tm.def[1], null)
    return { mDn, mSd, mDr, oDn, yDn, ySd, yUp, offDn, mLum: lum(mDn.col), oCol: oDn.col, want, wantOpp, kit: kitRoad, jersey: tm.off[0] } })
  ok(fnum.mDn.vis && fnum.mDn.col === fnum.want.fill && fnum.oCol === fnum.wantOpp.fill && (!fnum.want.light || fnum.mLum < 90) && (fnum.kit.clash || fnum.want.light) && fnum.mDn.a > 0.8 && fnum.mDn.a < 1, 'every man\'s number takes his kit\'s contrast (white Road kit → a dark number) and lets the fabric through', { col: fnum.mDn.col, want: fnum.want, jersey: fnum.jersey, a: fnum.mDn.a, opp: [fnum.oCol, fnum.wantOpp.fill], clash: fnum.kit.clash })
  ok(!fnum.mSd.vis && !fnum.ySd.vis && fnum.yDn.imgVis && !fnum.ySd.imgVis && fnum.yUp.imgVis, 'no number on a side view — the label and his number-font image both hide; front and back show it', { mate: fnum.mSd.vis, you: [fnum.yDn.imgVis, fnum.ySd.imgVis, fnum.yUp.imgVis] })
  ok(fnum.mDr.vis && fnum.mDr.sx < fnum.mDr.sy * 0.9 && Math.abs(fnum.mDr.x) > 0.3 && fnum.mDn.x === 0, 'a quarter view turns the number with the shirt (narrower, slid to the side the camera sees)', { dr: [fnum.mDr.sx, fnum.mDr.sy, fnum.mDr.x], dn: fnum.mDn.x })
  ok(fnum.offDn.a === 1 && fnum.offDn.x === 0 && fnum.offDn.col === '#ffffff', 'TU v159Anum 0 restores the old sticker (white, full alpha, centred)', fnum.offDn)
  await E(() => { const sc = window.__gridironScene; sc.time.paused = false; try { sc.tweens.resumeAll() } catch (e) {} if (window.__upd159b) { sc.update = window.__upd159b; delete window.__upd159b } })

  // ================= 6. perf: the cost of a frame (game.step: every scene's update + the render), whole team dressed vs his textures only =================
  // step time, not rAF spacing: under a loaded box (the runner at --jobs 3) rAF gaps measure the scheduler; the modes are
  // interleaved (dressed, alone, dressed, alone) and each keeps its best window's median
  const perf = await E(async () => { const sc = window.__gridironScene, C = window.RIB_COSMETICS, T = (window.RIB_TUNE = window.RIB_TUNE || {}), G = sc.game
    const steps = (ms) => new Promise(r => { const Y = sc.sys, os = Y.step, orr = Y.render, u = [], d = []
      Y.step = function () { const t = performance.now(); const res = os.apply(this, arguments); u.push(performance.now() - t); return res }
      Y.render = function () { const t = performance.now(); const res = orr.apply(this, arguments); d.push(performance.now() - t); return res }
      setTimeout(() => { delete Y.step; delete Y.render; if (Y.step !== os) Y.step = os; if (Y.render !== orr) Y.render = orr
        const med = (a) => { a.sort((x, y) => x - y); return a.length ? a[a.length >> 1] : 0 }, n = Math.min(u.length, d.length)
        r({ n, med: +(med(u) + med(d)).toFixed(2), upd: +med(u.slice()).toFixed(2), draw: +med(d.slice()).toFixed(2) }) }, ms) })
    // the per-frame hook itself: placing all 22 men, with and without the printed numbers
    const place = (on) => { if (!on) T.v159Anum = 0; const t0 = performance.now(); for (let k = 0; k < 20; k++) sc.markers.slice(0, 22).forEach(m => { try { sc.numPlaceV104(m, false) } catch (e) {} }); const ms = performance.now() - t0; delete T.v159Anum; return +(ms / 20).toFixed(3) }
    const mode = async (team) => { if (team) delete T.v159Ateam; else T.v159Ateam = 0; C.refreshField(); await new Promise(r => setTimeout(r, 400)); return steps(1500) }
    C.equip('uniform', 'uni_electric'); C.equip('helmet', 'hel_star')
    const runs = { dressed: [], alone: [] }
    for (let k = 0; k < 2; k++) { runs.dressed.push(await mode(1)); runs.alone.push(await mode(0)) }
    const pOn = place(true), pOff = place(false)
    delete T.v159Ateam; C.refreshField(); C.equip('uniform', null); C.equip('helmet', null)
    const best = (a) => a.filter(r => r.n >= 5).sort((x, y) => x.med - y.med)[0] || a[0]
    return { dressed: best(runs.dressed), alone: best(runs.alone), runs, placeOn: pOn, placeOff: pOff } })
  ok(perf.dressed.n >= 5 && perf.dressed.med <= perf.alone.med * 1.5 + 3, 'a frame with the whole team dressed costs what a frame with his textures only does (the recolour is paid once per kit, never per frame)', { dressed: perf.dressed, alone: perf.alone, placeOn: perf.placeOn })
  ok(perf.placeOn < 3, 'the printed-number hook costs well under a frame for 22 men', { msPer22: perf.placeOn, without: perf.placeOff })
}
const fe = await E(() => window.__V159A.errs)
ok(fe.length === 0, 'the v159 A code ran without an error', fe)

// ================= 6b. no gameplay change =================
const neutral = await E(() => { const st = window.__getGridironState(), keep = JSON.stringify(st.player || null), T = (window.RIB_TUNE = window.RIB_TUNE || {}), C = window.RIB_COSMETICS, V = window.__V159A
  const seedRun = () => { let s = 5959; const orig = Math.random; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let v = Math.imul(s ^ s >>> 15, 1 | s); v = v + Math.imul(v ^ v >>> 7, 61 | v) ^ v; return ((v ^ v >>> 14) >>> 0) / 4294967296 }
    const out = []; try { for (let g = 0; g < 6; g++) { const r = window.__simGameV2(50 + g * 4, ['QB', 'RB', 'WR', 'LB'][g % 4]); out.push([r.usScore, r.themScore, r.plays.length, r.team.yds, r.oppTeam.yds]) } } finally { Math.random = orig }
    return JSON.stringify(out) }
  C.equip('uniform', null); C.equip('helmet', null); V.setUniColour('own')
  const a = seedRun(); st.player = JSON.parse(keep)
  C.equip('uniform', 'uni_camo'); C.equip('helmet', 'hel_gloss_white'); V.setUniColour('team')
  const b = seedRun(); st.player = JSON.parse(keep)
  T.v159Ateam = 0; T.v159Apal = 0; T.v159Anum = 0; const c = seedRun(); st.player = JSON.parse(keep); delete T.v159Ateam; delete T.v159Apal; delete T.v159Anum
  V.setUniColour('own'); C.equip('uniform', null); C.equip('helmet', null)
  return { same: a === b && b === c, a: a.slice(0, 60), mr: window.__mr159 } })
ok(neutral.same, 'seeded games score identically with nothing equipped, with the whole team in a team-palette uniform, and with the switches off', neutral)
ok(neutral.mr === 0, 'no Math.random draw was made from inside src/28 across the whole check', { draws: neutral.mr })

console.log(JSON.stringify({ pass, fail, errors: errs.length }))
console.log('page errors:', errs.length ? errs.slice(0, 8) : 'none')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
