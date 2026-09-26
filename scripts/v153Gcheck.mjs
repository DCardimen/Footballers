// Dev check: v153 G — THE FULL LOCKER. The expanded cosmetics (src/28-cosmetics.js) and the 50-tier Career Pass
// (src/29-seasons.js), at a 400x860 phone:
//   1. the catalogue: the five new kinds (footprints, wings, crowns, auras, number fonts) hold >= 8 items each with a
//      rarity and a Locker preview that draws a canvas; more jerseys / helmets / frames / celebrations; new slots equip;
//      with monetization OFF the founder flair is neither listed nor owned
//   2. the Career Pass: 50 tiers, 37 free + 50 premium rewards, a highlight every fifth tier, a showcase at 50 (mythic
//      wings on premium, a legendary crown on free), every new kind on the track and its named style drawn by src/28;
//      the XP pacing stays believable; validateReward still refuses anything that is not cosmetic; a claimed flair
//      reward reaches the locker and equips
//   3. the card: equipped wings, crown and aura are drawn around the profile figure (their own layers), and the STYLE
//      tab lists the new kinds and fits 400x860
//   4. the live field: footprints are drawn BEHIND him while he moves (pixels + geometry), wings and a crown are drawn
//      on him (objects + pixels), the number font is his, and unequipping takes every piece off again
//   5. a new celebration plays on his touchdown
//   6. fieldFx spends no Math.random, and seeded simGameV2 box scores are identical with nothing / everything equipped
//   7. no page errors
// Screenshots go to $SHOTS (default /tmp/claude-0/shots/).
//   node scripts/v153Gcheck.mjs        (GAME_URL=http://localhost:5173/)
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
  await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && window.RIB_COSMETICS && window.RIB_SEASONS, null, { timeout: 60000 })
  await page.waitForTimeout(600)
}
await boot(); await page.goto(GAME_URL, { waitUntil: 'networkidle' }); await boot()   // warm past vite's one-time reload
const shot = async (name) => { try { await page.screenshot({ path: SHOTS + 'v153G-' + name + '.png' }) } catch {} }
const fits = () => E(() => { const se = document.scrollingElement
  return { page: se.scrollHeight <= innerHeight + 2 && se.scrollWidth <= innerWidth + 2, wide: document.getElementById('app') ? document.getElementById('app').scrollWidth <= innerWidth + 2 : true, w: se.scrollWidth, h: se.scrollHeight } })
const NEW = ['trail', 'wings', 'crown', 'aura', 'numfont']

// ================= 1. the catalogue =================
const cat = await E((NEW) => { const C = window.RIB_COSMETICS, all = C.catalog(), by = {}, st = {}
  for (const it of all) { (by[it.cat] = by[it.cat] || []).push(it); if (it.source !== 'pass' || !it.season) (st[it.cat] = st[it.cat] || []).push(it) }
  const pv = {}; for (const k of NEW) pv[k] = (by[k] || []).filter(it => { const el = document.createElement('div'); document.body.appendChild(el); it.preview(el); const cv = el.querySelector('canvas'); let ink = 0
    if (cv) { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) ink++ } el.remove(); return ink > 60 }).length
  const rar = NEW.every(k => (by[k] || []).every(it => /^(common|rare|epic|legendary|mythic)$/.test(it.rarity)))
  const looks = NEW.every(k => (st[k] || []).filter(it => it.id !== C.cats[k].def).every(it => it.tr || it.w || it.cr || it.au || it.nf))
  const M = window.RIB_MONETIZE, fnd = all.filter(i => i.source === 'founder' && NEW.includes(i.cat))
  const free = NEW.map(k => (st[k] || []).find(it => it.source === 'free' && it.id !== C.cats[k].def)).filter(Boolean)
  const eq = free.map(it => C.equip(it.cat, it.id) && C.equipped(it.cat) === it.id); NEW.forEach(k => C.equip(k, null))
  return { slots: C.slots, counts: Object.fromEntries(NEW.concat(['uniform', 'helmet', 'frame', 'celebration']).map(k => [k, (st[k] || []).length])), pv, all: Object.fromEntries(NEW.map(k => [k, (by[k] || []).length])),
    rar, looks, mon: !!(M && M.enabled), fnd: fnd.length, fListed: fnd.filter(i => C.listed(i)).length, fOwned: fnd.filter(i => C.owned(i.id)).length, eq, defs: NEW.map(k => C.equipped(k)), uniq: new Set(all.map(i => i.id)).size === all.length } }, NEW)
ok(NEW.every(k => cat.slots.includes(k)) && NEW.every(k => cat.counts[k] >= 8), 'five new kinds — footprints, wings, crowns, auras, number fonts — each with >= 8 catalogue items', cat.counts)
ok(cat.counts.uniform >= 25 && cat.counts.helmet >= 20 && cat.counts.frame >= 20 && cat.counts.celebration >= 16, 'more jerseys, helmets, card frames and celebrations', cat.counts)
ok(NEW.every(k => cat.pv[k] === cat.all[k]) && cat.rar && cat.looks && cat.uniq, 'every new item (the pass\'s too) has a rarity, a look and a Locker preview that draws', { pv: cat.pv, all: cat.all })
ok(cat.eq.length === 5 && cat.eq.every(Boolean) && cat.defs.join() === 'trail_none,wings_none,crown_none,aura_none,nf_team', 'a free item of each new kind equips into its slot, and each slot has a do-nothing default', cat.defs)
ok(!cat.mon && cat.fnd >= 5 && cat.fListed === 0 && cat.fOwned === 0, 'monetization OFF: the founder flair is neither listed nor owned', { fnd: cat.fnd })

// ================= 2. the Career Pass =================
const ps = await E((NEW) => { const S = window.RIB_SEASONS, C = window.RIB_COSMETICS, P = S.pass(), sid = S.current().id, R = S.rewards(sid)
  const all = R.free.concat(R.premium), kinds = {}; all.forEach(r => { kinds[r.kind] = (kinds[r.kind] || 0) + 1 })
  const hi = R.premium.filter(r => r.highlight).map(r => r.tier), fhi = R.free.filter(r => r.highlight).map(r => r.tier)
  const showP = R.premium.find(r => r.tier === 50), showF = R.free.find(r => r.tier === 50)
  const drawn = all.filter(r => r.style && NEW.concat(['jersey', 'helmet']).includes(r.kind)).every(r => { const it = C.passItem(r); if (!it) return false
    return r.kind === 'trail' ? it.tr.kind === r.style : r.kind === 'wings' ? it.w.kind === r.style : r.kind === 'crown' ? it.cr.kind === r.style : r.kind === 'aura' ? it.au.kind === r.style
      : r.kind === 'numfont' ? it.nf.style === r.style : r.kind === 'jersey' ? it.cat === 'uniform' && it.k.pat === r.style : it.cat === 'helmet' && it.h.f === r.style })
  const V = S.validateReward, bad = all.filter(r => !V(r).ok).map(r => r.id)
  const refuse = [{ id: 'pass.s1.free.1', kind: 'pp' }, { id: 'pass.s1.free.1', kind: 'wings', boost: 2 }, { id: 'pass.s1.free.1', kind: 'gear' }, { id: 'pass.s1.free.1', kind: 'crown', stat: 1 },
    { id: 'pass.s1.free.1', kind: 'trail', speed: 3 }, { id: 'wings_angel', kind: 'wings' }, { id: 'pass.s1.free.1', kind: 'attributes' }].map(r => V(r).ok)
  return { tiers: P.tiers, xpPerTier: P.xpPerTier, freeN: R.free.length, premN: R.premium.length, kinds, hi, fhi, showP: showP && [showP.kind, showP.rarity, showP.style, showP.name], showF: showF && [showF.kind, showF.rarity, showF.name],
    drawn, bad, refuse, emptyFree: 50 - R.free.length, T: S.xpTable } }, NEW)
ok(ps.tiers === 50 && ps.premN === 50 && ps.freeN === 37, 'the pass runs 50 tiers: a premium reward on every tier, a free one on 37', { tiers: ps.tiers, free: ps.freeN, prem: ps.premN })
ok(ps.hi.join() === '5,10,15,20,25,30,35,40,45,50' && ps.fhi.every(t => t % 5 === 0) && ps.fhi.length >= 7, 'a highlight every fifth tier (premium: 5…50; free on its fives)', { prem: ps.hi, free: ps.fhi })
ok(ps.showP && ps.showP[0] === 'wings' && ps.showP[1] === 'mythic' && ps.showP[2] === 'seraph' && ps.showF && ps.showF[0] === 'crown' && ps.showF[1] === 'legendary', 'the showcase at tier 50: mythic seraph wings (premium), a legendary crown (free)', { prem: ps.showP, free: ps.showF })
ok(NEW.concat(['jersey', 'helmet']).every(k => ps.kinds[k] >= 3) && ps.drawn, 'every new kind is on the track (>= 3 a season) and src/28 draws each reward\'s named style', ps.kinds)
const xpTotal = ps.tiers * ps.xpPerTier, perSeason = ps.T.game * 10 + ps.T.win * 5 + ps.T.season
ok(xpTotal >= 30000 && xpTotal <= 50000 && ps.xpPerTier >= perSeason * 0.4, 'XP pacing stays believable: ' + xpTotal + ' XP for the track (' + ps.xpPerTier + ' a tier; a 10-game season books ~' + perSeason + ' before challenges)', { xpTotal })
ok(ps.bad.length === 0 && ps.refuse.every(v => v === false), 'validateReward: every reward validates as cosmetic; PP, a boost, gear, a stat, a speed field, an id outside the pass and a non-cosmetic kind are refused', { bad: ps.bad, refuse: ps.refuse })
const cl = await E(() => { const S = window.RIB_SEASONS, C = window.RIB_COSMETICS
  S.dev.addXp(Math.max(0, 5 * S.pass().xpPerTier - S.pass().xp) + 10)
  const c = S.claim('premium', 5); S.grantPremium(S.current().id); const c2 = S.claim('premium', 5)
  const id = c2.ok ? c2.reward.id : null, it = id && C.catalog().find(i => i.id === id)
  return { t: S.pass().tier, locked: c.reason, ok: c2.ok, kind: c2.reward && c2.reward.kind, owned: id && C.owned(id), eq: it ? C.equip(it.cat, id) && C.equipped(it.cat) === id : false, cat: it && it.cat } })
ok(cl.t >= 5 && cl.locked === 'premium not owned' && cl.ok && cl.kind === 'trail' && cl.owned && cl.eq, 'claiming the tier-5 highlight (footprints) lands it in the locker and it equips — premium stays gated without the entitlement', cl)
await E(() => window.RIB_COSMETICS.equip('trail', null))

// ================= 3. the card and the STYLE tab =================
// v156 C made most of these looks member-only (never granted while the store is off) and angel wings a super look;
// the drawing is what is tested from here on, so the v156 C sources are switched off (TU v156Ccos 0 — v156Ccheck
// covers them). Sections 1–2 above ran with them on.
await E(() => { (window.RIB_TUNE = window.RIB_TUNE || {}).v156Ccos = 0 })
await E(() => { const C = window.RIB_COSMETICS; ['wings_angel', 'crown_halo', 'aura_gold', 'trail_flame', 'nf_neon', 'nf_gold', 'trail_lightning', 'wings_seraph', 'crown_star', 'wings_bat', 'crown_gold', 'cel_feathers', 'aura_void'].forEach(id => C.grant(id, 'earned')) })
await E(() => { const C = window.RIB_COSMETICS; C.equip('wings', 'wings_angel'); C.equip('crown', 'crown_halo'); C.equip('aura', 'aura_gold') })
await E(() => window.go('profile')); await page.waitForTimeout(1800)
const card = await E(() => { const c = document.querySelector('#screen .pcard-v151b'), b = c && c.querySelector('.pc-fl-v153g.back'), f = c && c.querySelector('.pc-fl-v153g.front')
  const P = window.RIB_COSMETICS.profile().cosmetics, G0 = Object.assign({}, window.__V153G.card)
  const el = document.createElement('div'); document.body.appendChild(el); const d = window.RIB_COSMETICS.profile(); d.cosmetics = Object.assign({}, d.cosmetics, { wings: 'nope', crown: '"><img src=x>', aura: null })
  window.RIB_COSMETICS.renderCard(d, el); const other = el.querySelectorAll('.pc-fl-v153g').length; el.remove()
  return { back: !!b, front: !!f, wings: b && b.dataset.wings, crown: f && f.dataset.crown, G: G0, P: [P.wings, P.crown, P.aura, P.trail, P.numfont], other } })
ok(card.back && card.front && card.wings === 'wings_angel' && card.crown === 'crown_halo' && card.G && card.G.back > 300 && card.G.front > 20, 'the profile card draws his wings and aura behind the figure and the halo over his head', { G: card.G && { back: card.G.back, front: card.G.front } })
ok(card.P.join() === 'wings_angel,crown_halo,aura_gold,trail_none,nf_team' && card.other === 0, 'profile() carries the flair for the boards; unknown ids from stored data draw nothing', card.P)
const pf = await fits(); ok(pf.page && pf.wide, 'the profile with flair fits 400x860 with no page scroll', pf)
await shot('profile-flair')
await E(() => window.go('locker')); await page.waitForTimeout(900)
await E(() => { const t = document.querySelector('.hubv75-tab[data-sec="style"]'); t && t.click() }); await page.waitForTimeout(500)
const lk = await E(() => { window.cosCatV151B('wings'); return new Promise(r => setTimeout(() => { const items = [...document.querySelectorAll('.cos-item-v151b')]
  const cats = [...document.querySelectorAll('.cos-cat-v151b')].map(b => b.textContent)
  r({ n: items.length, canv: document.querySelectorAll('.cos-item-v151b canvas.cos-fl-v153g').length, cats: cats.filter(t => /FOOTPRINTS|WINGS|CROWNS|AURAS|NUMBER FONTS/.test(t)).length, eq: !!document.querySelector('.cos-item-v151b.on[data-cos="wings_angel"]') }) }, 900)) })
ok(lk.cats === 5 && lk.n >= 8 && lk.canv >= 8 && lk.eq, 'the Locker\'s STYLE tab has the five new kinds; WINGS lists its items with drawn previews and the equipped one marked', lk)
const lf = await fits(); ok(lf.page && lf.wide, 'the STYLE tab fits 400x860 with no page scroll', lf)
await shot('locker-wings')

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
/* hold the broadcast still: the scene's update stubbed, its clock and tweens paused; he is then walked by hand
 * (placeMarker, the real per-frame path) with a hand-set clock, and the camera parked close on him */
const HOLD = () => E(() => { const sc = window.__gridironScene; if (!window.__updV153G) { window.__updV153G = sc.update; sc.update = function () {} } sc.time.paused = true; try { sc.tweens.pauseAll() } catch (e) {} })
const walk = (looks) => E(async (looks) => {
  const C = window.RIB_COSMETICS, sc = window.__gridironScene, G = window.__V153G
  G.freeze = false
  ;['trail', 'wings', 'crown', 'aura', 'numfont'].forEach(s => C.equip(s, null))
  looks.forEach(id => { const it = C.catalog().find(i => i.id === id); if (it) C.equip(it.cat, id) })
  let m = sc.markers.find(q => q && q.team === 'you'); if (!m) { sc.highlight(sc.markers[5], true); m = sc.markers[5] }
  if (!window.__homeV153G) window.__homeV153G = { sx: m.sx, sy: m.sy }
  const H = window.__homeV153G, t0 = 1e6 + (window.__walkN153 = (window.__walkN153 || 0) + 1) * 1e4
  m.forceState = null; m._launchUntil = 0; if (m.body) { m.body.setRotation(0); m.body.setVisible(true) }
  let rnd = 0, all = 0; const orig = Math.random; Math.random = function () { all++; if (/28-cosmetics/.test(String(new Error().stack))) rnd++; return orig() }   // draws made from inside src/28 (the engine's own turf puffs draw too)
  try { for (let k = 0; k < 28; k++) { sc.time.now = t0 + k * 16; m._spdPx = 170; sc.placeMarker(m, H.sx + k * 0.9, H.sy + k * 0.15, 16) } } finally { Math.random = orig }
  G.freeze = true
  const c = sc.cameras.main; try { c.stopFollow() } catch (e) {} c.setZoom(3.2 / Math.max(0.2, m.root.scale)); c.centerOn(m.root.x, m.root.y - 6 * m.root.scale)
  await new Promise(r => setTimeout(r, 120))
  const gx = (m.root.x - c.scrollX - c.width * c.originX) * c.zoom + c.width * c.originX, gy = (m.root.y - c.scrollY - c.height * c.originY) * c.zoom + c.height * c.originY
  const S = 300, x0 = Math.max(0, Math.min(720 - S, Math.round(gx - S / 2))), y0 = Math.max(0, Math.min(576 - S, Math.round(gy - S / 2)))
  const url = await new Promise(r => sc.game.renderer.snapshotArea(x0, y0, S, S, img => { const cv = document.createElement('canvas'); cv.width = S; cv.height = S; cv.getContext('2d').drawImage(img, 0, 0); r(cv.toDataURL()) }))
  const px = await new Promise(r => { const im = new Image(); im.onload = () => { const cv = document.createElement('canvas'); cv.width = S; cv.height = S; const x = cv.getContext('2d'); x.drawImage(im, 0, 0); r(Array.from(x.getImageData(0, 0, S, S).data)) }; im.src = url })
  const cnt = (f) => { let n = 0; for (let i = 0; i < px.length; i += 4) if (f(px[i], px[i + 1], px[i + 2])) n++; return n }
  const bob = m.bob && m.bob.active ? m.bob.depth : null
  return { url, rnd, all, orange: cnt((r, g, b) => r > 200 && g > 60 && g < 175 && b < 90), bat: cnt((r, g, b) => r > 70 && r < 140 && g < 60 && b > 35 && b < 90 && r > b), lav: cnt((r, g, b) => r > 150 && b > 200 && g > 130 && g < 200 && b > r),
    cyan: cnt((r, g, b) => r < 150 && g > 215 && b > 215),
    lt: G.lastTrail, wl: !!(m._wlV153G && m._wlV153G.visible && m._wlV153G.parentContainer === m.root), wr: !!(m._wrV153G && m._wrV153G.visible), crD: m._crV153G ? m._crV153G.depth : null, crY: m._crV153G ? m._crV153G.y - m.root.y : null, bob,
    font: m.label && m.label.style.fontFamily, col: m.label && m.label.style.color, hasFx: !!m._cosV153G, s: m.root.scale }
}, looks)
const save = (name, r) => { try { fs.writeFileSync(SHOTS + 'v153G-' + name + '.png', Buffer.from(r.url.split(',')[1], 'base64')) } catch {} }
await HOLD()
const w0 = await walk([]); save('field-none', w0)
const w1 = await walk(['trail_flame']); save('field-trail-flame', w1)
const lt = w1.lt || {}, back = lt.n > 5 ? ((lt.cx - lt.hx) * lt.vx + (lt.cy - lt.hy) * lt.vy) : 1
ok(w1.orange > w0.orange + 40 && lt.kind === 'flame' && lt.drawn >= 10, 'footprints: the flame trail\'s pixels appear on the field while he moves', { none: w0.orange, flame: w1.orange, drawn: lt.drawn })
ok(lt.n > 5 && back < 0 && Math.hypot(lt.vx, lt.vy) > 5, 'and they lie BEHIND him (the trail\'s centre is back along his path, not ahead)', { back: Math.round(back), v: [Math.round(lt.vx), Math.round(lt.vy)] })
const w2 = await walk(['wings_bat', 'crown_star', 'nf_gold']); save('field-wings-crown', w2)
ok(w2.wl && w2.wr && w2.bat > w0.bat + 60, 'wings: a pair on HIS marker, drawn (the bat membrane\'s pixels appear)', { none: w0.bat, bat: w2.bat })
ok(w2.crD != null && w2.bob != null && w2.crD > w2.bob && w2.crY < 0 && w2.lav > w0.lav + 15, 'a crown sits over his head, above the plumbob\'s depth, and is drawn (its pixels appear)', { none: w0.lav, star: w2.lav, depth: [w2.crD, w2.bob], y: w2.crY })
ok(/Georgia/.test(w2.font) && w2.col === '#ffd76f' && !/Georgia/.test(w0.font), 'his number wears the equipped number font (Gold Foil: a gold serif)', { font: w2.font, col: w2.col, before: w0.font })
const w3 = await walk(['trail_lightning', 'wings_seraph', 'crown_gold', 'aura_void', 'nf_neon']); save('field-full', w3)
const w4 = await walk([])
ok(!w4.wl && !w4.wr && w4.crD == null && !w4.hasFx && !/Georgia/.test(w4.font) && w4.col !== '#6ff7ff', 'unequipping takes every piece off him again (identity with nothing equipped)', { wl: w4.wl, crown: w4.crD, fx: w4.hasFx, col: w4.col })
ok(w1.rnd === 0 && w2.rnd === 0 && w3.rnd === 0 && w3.all >= 0, 'the flair spends no Math.random: not one draw is made from inside src/28 while it draws footprints, wings, a crown, an aura, a number', { trail: w1.rnd, wings: w2.rnd, full: w3.rnd, engine: [w0.all, w1.all, w3.all] })
const fxe = await E(() => window.__V153G.errs); ok(fxe.length === 0, 'fieldFx ran without an error', fxe)

// ================= 5. a new celebration on his touchdown =================
await E(() => { const sc = window.__gridironScene; sc.time.paused = false; try { sc.tweens.resumeAll() } catch (e) {} if (window.__updV153G) { sc.update = window.__updV153G; delete window.__updV153G } window.__V153G.freeze = false })
await E(() => window.RIB_COSMETICS.equip('celebration', 'cel_feathers'))
const cel = await E(async () => { const sc = window.__gridironScene; let i = sc.markers.findIndex(m => m && m.team === 'you'); if (i < 0) { sc.highlight(sc.markers[5], true); i = 5 } const m = sc.markers[i], n0 = window.__V151B.celebrations.length
  const P = sc.play || (sc.play = { payload: {}, t: 0 }); const keep = P.carrierId; P.carrierId = i
  try { sc.celebrate(m.sx, m.sy) } catch (e) { return { err: String(e) } } P.carrierId = keep
  await new Promise(r => setTimeout(r, 300)); const last = window.__V151B.celebrations[window.__V151B.celebrations.length - 1]
  return { n0, n1: window.__V151B.celebrations.length, last, err: window.__V151B.celebrateErr || null } })
ok(cel.n1 === cel.n0 + 1 && cel.last && cel.last.kind === 'feathers' && cel.last.made >= 10 && cel.last.say === 'HEAVEN SENT' && !cel.err, 'a new celebration (Angel Descends) plays on his touchdown', cel.last)
await shot('celebration')

// ================= 6. no gameplay change =================
const neutral = await E(() => { const C = window.RIB_COSMETICS, st = window.__getGridironState(), keep = JSON.stringify(st.player || null)
  const seedRun = () => { let s = 4242; const orig = Math.random; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let v = Math.imul(s ^ s >>> 15, 1 | s); v = v + Math.imul(v ^ v >>> 7, 61 | v) ^ v; return ((v ^ v >>> 14) >>> 0) / 4294967296 }
    const out = []; try { for (let g = 0; g < 6; g++) { const r = window.__simGameV2(50 + g * 4, ['QB', 'RB', 'WR', 'LB'][g % 4]); out.push([r.usScore, r.themScore, r.plays.length, r.team.yds, r.oppTeam.yds]) } } finally { Math.random = orig }
    return JSON.stringify(out) }
  C.slots.forEach(s => C.equip(s, C.cats[s].def)); const a = seedRun(); st.player = JSON.parse(keep)
  for (const it of C.catalog()) if (C.owned(it.id)) C.equip(it.cat, it.id)
  const eq = ['trail', 'wings', 'crown', 'aura', 'numfont'].map(s => C.equipped(s)); const b = seedRun(); st.player = JSON.parse(keep)
  return { same: a === b, a: a.slice(0, 80), eq } })
ok(neutral.same && neutral.eq.every(id => !/_none$|^nf_team$/.test(id)), 'seeded games score identically with nothing equipped and with every flair he owns equipped', neutral)

console.log(JSON.stringify({ pass, fail, errors: errs.length }))
console.log('page errors:', errs.length ? errs.slice(0, 8) : 'none')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
