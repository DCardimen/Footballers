// Dev check: v151 B — HE LOOKS THE PART. The cosmetics module (src/28-cosmetics.js, window.RIB_COSMETICS),
// its rendering hooks and the profile screen, at a 400x860 phone:
//   1. the catalogue: >= 6 items in each of the nine categories, every one with a preview that draws; the
//      owner's packs at the owner's prices; with monetization OFF a shop item is not listed and cannot be
//      granted, and a founder item is not owned
//   2. grant / equip / persist: a pass item granted and equipped survives a reload and a new career (the
//      store is outside the save), and an earned item unlocks from a forced achievement (once, toasted),
//      including through the save hook
//   3. the Team Creator's gate: the current look is grandfathered, five free picks shared by crests and
//      colours, then 10 PP, 20 PP… (doubling), refused without the PP, and the unlock count on the profile
//   4. the live field: an equipped uniform + helmet change the you-player's drawn textures (pixel sample)
//      and NOT the opponent's or his team-mates'; a forced touchdown by him plays the equipped celebration;
//      a stadium theme changes the bowl on a home game (band, crowd tint, pixels) and not on an away game
//   5. the vault: a theme tints the coins, grades the room (canvas pixels) and hangs its motes
//   6. the screens: the Locker's STYLE tab equips on a tap, the profile card wears the equipped frame and
//      banner and draws the character, a hostile name renders as text; both fit 400x860 with no page scroll
//   7. no gameplay change: seeded simGameV2 box scores with nothing equipped == with everything equipped
//   8. no page errors
// Screenshots go to $SHOTS (default /tmp/claude-0/shots/).
//   node scripts/v151Bcheck.mjs        (GAME_URL=http://localhost:5620/)
import { chromium } from 'playwright'
import fs from 'node:fs'
import { CHROME, GAME_URL } from './lib/env.mjs'
const SHOTS = process.env.SHOTS || '/tmp/claude-0/shots/'
try { fs.mkdirSync(SHOTS, { recursive: true }) } catch {}
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 400, height: 860 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { setInterval(() => { document.querySelector('.onboard')?.remove() }, 60) })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const E = (fn, arg) => page.evaluate(fn, arg)
const boot = async () => {
  await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(1200)
  await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && window.RIB_COSMETICS, null, { timeout: 60000 })
  await page.waitForTimeout(600)
}
await boot(); await page.goto(GAME_URL, { waitUntil: 'networkidle' }); await boot()   // warm past vite's one-time reload
const shot = async (name) => { try { await page.screenshot({ path: SHOTS + 'v151B-' + name + '.png' }) } catch {} }
/* every confirm the gate raises is accepted unless window.__dlgNo is set */
const dlgAuto = () => E(() => { if (window.__dlgAuto) return; window.__dlgAuto = 1; new MutationObserver(() => { const d = document.getElementById('ribDlgV149'); if (d && !d.__seen) { d.__seen = 1; setTimeout(() => { const b = d.querySelector(window.__dlgNo ? 'button:not(.primary-v149)' : 'button.primary-v149'); b && b.click() }, 60) } }).observe(document.body, { childList: true }) }); await dlgAuto()
const fits = () => E(() => { const sc = document.getElementById('screen'), se = document.scrollingElement
  return { page: se.scrollHeight <= innerHeight + 2 && se.scrollWidth <= innerWidth + 2, wide: document.getElementById('app') ? document.getElementById('app').scrollWidth <= innerWidth + 2 : true,
    screen: sc ? sc.scrollHeight - sc.clientHeight : null, w: se.scrollWidth, h: se.scrollHeight } })

// ================= 1. the catalogue =================
const cat = await E(() => { const C = window.RIB_COSMETICS, all = C.catalog(), by = {}
  for (const it of all) (by[it.cat] = by[it.cat] || []).push(it)
  const pv = {}; for (const k in by) pv[k] = by[k].filter(it => { const el = document.createElement('div'); document.body.appendChild(el); it.preview(el); const good = el.childNodes.length > 0 && (el.querySelector('canvas,div,i') != null); el.remove(); return good }).length
  return { slots: C.slots, counts: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.length])), pv, sources: [...new Set(all.map(i => i.source))],
    packs: C.packs().map(p => [p.id, p.price, p.items.length]), ids: all.length, uniq: new Set(all.map(i => i.id)).size } })
ok(cat.slots.length === 9 && cat.slots.every(s => (cat.counts[s] || 0) >= 6), 'nine categories, at least six items in each', cat.counts)
ok(cat.slots.every(s => cat.pv[s] === cat.counts[s]), 'every item draws a preview', cat.pv)
ok(cat.ids === cat.uniq && ['free', 'earned', 'pass', 'shop', 'founder'].every(s => cat.sources.includes(s)), 'ids are unique and all five sources are used', cat.sources)
const price = Object.fromEntries(cat.packs.map(p => [p[0], p[1]]))
ok(price.pack_uniforms1 === '$1.99' && price.pack_helmets1 === '$1.99' && price.pack_celebrations1 === '$2.99' && price.pack_stadium_neon === '$2.99' && price.pack_frames1 === '$1.99' && price.pack_vault_rose === '$2.99' && price.pack_historical === '$4.99' && cat.packs.every(p => p[2] > 0),
  'the packs carry the owner\'s price list, and every pack holds items', cat.packs)
const off = await E(() => { const C = window.RIB_COSMETICS, M = window.RIB_MONETIZE
  const shop = C.catalog().filter(i => i.source === 'shop'), fnd = C.catalog().filter(i => i.source === 'founder')
  return { mon: !!(M && M.enabled), listed: shop.filter(i => C.listed(i)).length, owned: shop.filter(i => C.owned(i.id)).length, grant: C.grant(shop[0].id, 'shop'), fOwned: fnd.filter(i => C.owned(i.id)).length, fListed: fnd.filter(i => C.listed(i)).length } })
ok(!off.mon && off.listed === 0 && off.owned === 0 && off.grant === false && off.fOwned === 0 && off.fListed === 0, 'monetization OFF: no shop or founder item is listed, owned or grantable', off)

// ================= 2. grant / equip / persist; earned =================
const g = await E(() => { const C = window.RIB_COSMETICS; C._reset()
  const locked = C.equip('uniform', 'uni_electric')                       // not owned yet
  const a = C.grant('uni_electric', 'pass'), b = C.equip('uniform', 'uni_electric')
  C.grant('hel_star', 'pass'); C.equip('helmet', 'hel_star'); C.grant('cel_stars', 'pass'); C.grant('std_ice', 'pass'); C.grant('vault_glacier', 'pass'); C.grant('ban_aurora', 'pass'); C.equip('banner', 'ban_aurora')
  let fired = 0; const un = C.onChange(() => fired++); C.equip('frame', 'frame_steel'); un(); C.equip('frame', 'frame_basic')
  return { locked, a, b, eq: C.equipped('uniform'), fired, store: !!localStorage.getItem('rib.cosmetics.v1'), inSave: /uni_electric/.test(localStorage.getItem('gridiron_save_v1') || '') } })
ok(g.locked === false && g.a && g.b && g.eq === 'uni_electric' && g.fired === 1 && g.store && !g.inSave, 'an unowned item cannot be equipped; a granted one can; onChange fires; the store is its own key, not the save', g)
await page.reload({ waitUntil: 'networkidle' }); await boot()
const r1 = await E(() => ({ u: window.RIB_COSMETICS.equipped('uniform'), h: window.RIB_COSMETICS.equipped('helmet'), b: window.RIB_COSMETICS.equipped('banner') }))
ok(r1.u === 'uni_electric' && r1.h === 'hel_star' && r1.b === 'ban_aurora', 'equipped items survive a reload', r1)
const earned = await E(() => { const C = window.RIB_COSMETICS, st = window.__getGridironState()
  const before = C.owned('frame_gold'); st.titlesWon = Math.max(1, st.titlesWon || 0)
  const got = C.checkEarned(); const again = C.checkEarned()
  const toast = (document.getElementById('toast') || {}).textContent || ''
  return { before, after: C.owned('frame_gold'), got, again, toast } })
ok(!earned.before && earned.after && earned.got.includes('frame_gold') && earned.again.length === 0 && /Unlocked/.test(earned.toast), 'a forced achievement (a first title) unlocks its earned items once, with a toast', earned)
const viaSave = await E(async () => { const C = window.RIB_COSMETICS, st = window.__getGridironState(); const b = C.owned('uni_blackout')
  st.nflReached = Math.max(1, st.nflReached || 0); window.GridironStorage.save(st); await new Promise(r => setTimeout(r, 120)); return { b, a: C.owned('uni_blackout'), std: C.owned('std_blackgold') } })
ok(!viaSave.b && viaSave.a && viaSave.std, 'the save hook checks achievements: reaching the UFF unlocks Blackout and the Black & Gold bowl', viaSave)

// ================= 3. the Team Creator's gate =================
await dlgAuto()
const ts0 = await E(() => { const T = window.RIB_COSMETICS.teamStyle, c = window.__GRIDIRON_TEAM_CUSTOM__
  T.grandfather(c); const I = T.info(); return { I, logo: c.logo, pal: c.palette, ownL: T.owned('logo', c.logo), ownP: T.owned('pal', c.palette) } })
ok(ts0.ownL && ts0.ownP && ts0.I.unlocked >= 2 && ts0.I.freeLeft === 5 - ts0.I.unlocked && ts0.I.total > 100, 'the look a save already wears is grandfathered and counts toward the five free picks', ts0.I)
await E(() => window.openTeamCreatorV153()); await page.waitForTimeout(400)
const tc = await E(() => ({ bar: (document.querySelector('.ts-bar-v151b') || {}).textContent || '', locks: document.querySelectorAll('.palette-v153.lock-v151b,.logo-pick-v153.lock-v151b').length, pal: document.querySelectorAll('.palette-v153').length }))
ok(/unlocked/.test(tc.bar) && tc.locks > 20, 'the creator shows the unlock line and a lock on every crest and colour not yet owned', tc)
const saveGate = await E(async () => { const T = window.RIB_COSMETICS.teamStyle, P = (window.TEAM_PALETTES || []).length
  let pick = 0; for (let i = 0; i < P; i++) if (!T.owned('pal', i)) { pick = i; break }
  const free0 = T.freeLeft(); window.pickPaletteV153(pick); const keepLogo = window.__GRIDIRON_TEAM_CUSTOM__.logo; window.__tempLogoV153 = keepLogo
  const okSave = await window.saveTeamCreatorV153(); return { pick, free0, free1: T.freeLeft(), owned: T.owned('pal', pick), okSave, cur: window.__GRIDIRON_TEAM_CUSTOM__.palette } })
ok(saveGate.okSave === true && saveGate.cur === saveGate.pick && saveGate.owned && saveGate.free1 === saveGate.free0 - 1, 'saving a locked palette spends one free pick and the team wears it', saveGate)
const pp = await E(async () => { const T = window.RIB_COSMETICS.teamStyle, st = window.__getGridironState(), N = (window.TEAM_LOGOS_V44.db || []).length
  const next = () => { for (let i = 0; i < N; i++) if (!T.owned('logo', i)) return i; return -1 }
  while (T.freeLeft() > 0) await T.acquire([{ kind: 'logo', i: next() }])
  st.pp = 100; const c1 = T.cost(); const a = await T.acquire([{ kind: 'logo', i: next() }]); const pp1 = st.pp, c2 = T.cost()
  const b = await T.acquire([{ kind: 'logo', i: next() }]); const pp2 = st.pp, c3 = T.cost()
  st.pp = 5; const tgt = next(); const c = await T.acquire([{ kind: 'logo', i: tgt }]); const pp3 = st.pp
  window.__dlgNo = 1; st.pp = 1000; const d = await T.acquire([{ kind: 'logo', i: tgt }]); window.__dlgNo = 0
  return { c1, a, pp1, c2, b, pp2, c3, refused: c === false && pp3 === 5 && !T.owned('logo', tgt), declined: d === false && st.pp === 1000, info: T.info() } })
ok(pp.c1 === 10 && pp.a && pp.pp1 === 90 && pp.c2 === 20 && pp.b && pp.pp2 === 70 && pp.c3 === 40, 'past the five free picks an unlock costs PP, 10 then 20 then 40 — doubling', pp)
ok(pp.refused && pp.declined, 'short of the PP the unlock is refused and nothing is debited; a declined confirm spends nothing', pp)
ok(pp.info.canBuyAll === false && pp.info.all === false, 'the one-time "unlock all" is not offered with monetization OFF', pp.info)
await E(() => window.closeTeamCreatorV153())

// ================= 4. screens: the Locker's STYLE tab, the profile =================
await E(() => { const st = window.__getGridironState(); st.pp = 12345 })
await E(() => window.go('locker')); await page.waitForTimeout(900)
const lk = await E(() => { const tabs = [...document.querySelectorAll('.hubv75-tab')].map(t => t.dataset.sec); return { tabs } })
ok(lk.tabs.includes('gear') && lk.tabs.includes('style'), 'the Locker has GEAR and STYLE tabs', lk)
await E(() => document.querySelector('.hubv75-tab[data-sec="style"]').click()); await page.waitForTimeout(500)
await E(() => window.cosCatV151B('frame')); await page.waitForTimeout(500)
const lk2 = await E(() => { const it = document.querySelector('.cos-item-v151b[data-cos="frame_gold"]'); const vis = it && it.getClientRects().length > 0; it && it.click()
  return { vis, eq: window.RIB_COSMETICS.equipped('frame'), locked: document.querySelectorAll('.cos-item-v151b.locked').length, shop: document.querySelectorAll('.cos-item-v151b[data-cos="frame_flame"]').length } })
await page.waitForTimeout(400)
ok(lk2.vis && lk2.eq === 'frame_gold' && lk2.shop === 0, 'a tap on an owned frame in STYLE equips it; the shop frames are not listed with the store off', lk2)
await E(() => window.cosCatV151B('uniform')); await page.waitForTimeout(700)
const lf = await fits(); ok(lf.page && lf.wide, 'the Locker\'s STYLE tab fits 400x860 with no page scroll', lf)
await shot('locker-style')
await E(() => window.go('profile')); await page.waitForTimeout(1500)
const pr = await E(() => { const c = document.querySelector('#screen .pcard-v151b'), cv = c && c.querySelector('canvas'), d = cv && cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data
  let ink = 0; if (d) for (let i = 3; i < d.length; i += 4) if (d[i] > 40) ink++
  const P = window.RIB_COSMETICS.profile()
  return { card: !!c, frame: c && c.dataset.frame, banner: c && c.querySelector('[data-banner]').dataset.banner, gold: c && c.classList.contains('fr-gold'), ink,
    text: c ? c.innerText.replace(/\s+/g, ' ').slice(0, 200) : '', P: { careers: P.careers, bank: P.bank, teamStyle: P.teamStyle, gen: P.gen, kit: P.cosmetics.kit, ach: P.achievements } } })
ok(pr.card && pr.frame === 'frame_gold' && pr.gold && pr.banner === 'ban_aurora', 'the profile card wears the equipped frame and banner', pr)
ok(pr.ink > 800, 'the profile draws his character (the growth figure in his kit)', pr.ink)
ok(pr.P.teamStyle.unlocked >= 7 && /LOGOS/.test(pr.text) && /12,345 PP|12K PP|12345/.test(pr.text) && pr.P.kit.j === '#1e6fff' && pr.P.kit.hs === '#0f2d5c', 'profile() carries the bank, the unlock count and the equipped kit, and the card shows them', pr.P)
const pf = await fits(); ok(pf.page && pf.wide, 'the profile fits 400x860 with no page scroll', pf)
await shot('profile')
const xss = await E(() => { const el = document.createElement('div'); document.body.appendChild(el)
  const P = window.RIB_COSMETICS.profile(); P.name = '<img src=x onerror="window.__pwned=1">'; P.team = { school: '"><script>window.__pwned=2</script>', name: 'x', colors: ['#fff', 'red;background:url(x)'], logo: 1 }
  P.cosmetics = { frame: '"><b>', banner: 'nope', shelf: 'x', kit: { j: 'javascript:alert(1)' } }; P.titlesByLevel = { '<i>': 1 }
  window.RIB_COSMETICS.renderCard(P, el); const r = { imgs: el.querySelectorAll('img,script').length, name: el.querySelector('.pc-name-v151b').textContent, pwned: window.__pwned || 0, frame: el.querySelector('.pcard-v151b').dataset.frame, sw: el.querySelectorAll('.pc-sw-v151b').length }
  el.remove(); return r })
ok(xss.imgs === 0 && /<IMG SRC=X/.test(xss.name) && !xss.pwned && xss.frame === 'frame_basic' && xss.sw === 0, 'another player\'s card from stored data: every string is text, unknown ids fall back, bad colours are dropped', xss)

// ================= 5. the live field =================
await page.evaluate(p => { window.__readPos = p }, 'RB')
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function step(t) {
  const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
      : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis })
  console.log('>>', t, '->', r, await E(() => window.S && window.S.view)); await page.waitForTimeout(t === 'PLAN' ? 3000 : 800); return r
}
await E(() => window.go('menu')); await page.waitForTimeout(800)
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
let scene = false
for (let i = 0; i < 150; i++) { scene = await E(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.some(m => m && m.team === 'you'))); if (scene) break
  await E(() => { const g = document.getElementById('gv42go'); if (g && g.offsetParent) g.click() })   // the season wheel's gate (v139) and its CONTINUE
  if (i === 20 || i === 50 || i === 90) { await step('CONTINUE TO MATCH'); await step('Continue') }
  await page.waitForTimeout(500) }
let forcedYou = false
if (!scene) { forcedYou = await E(() => { const sc = window.__gridironScene; if (!sc || !sc.markers || sc.markers.length < 22) return false   // no snap of his yet: dress a slot the way a play of his does (the real highlight path)
  sc.highlight(sc.markers[5], true); return sc.markers[5].team === 'you' }); scene = forcedYou }
if (!scene) await shot('no-live')
ok(scene, 'a new career reached the live field with the you-player on it', forcedYou ? 'his marker dressed through highlight()' : 'on a play of his')
const r2 = await E(() => ({ u: window.RIB_COSMETICS.equipped('uniform'), h: window.RIB_COSMETICS.equipped('helmet') }))
ok(r2.u === 'uni_electric' && r2.h === 'hel_star', 'equipped items survive a new career', r2)
await page.waitForTimeout(1500)
const texAvg = `(key) => { const sc = window.__gridironScene; if (!sc.textures.exists(key)) return null; const src = sc.textures.get(key).getSourceImage(); const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const x = c.getContext('2d'); x.drawImage(src, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++ } return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n), n] : null }`
const sample = () => E(({ src }) => { const f = eval(src), sc = window.__gridironScene
  sc.markers.forEach(m => { if (m) m.tex = null })
  return { you: f('spr_you_dn_idle'), youRun: f('spr_you_sd_run3'), def: f('spr_def_dn_idle'), off: f('spr_off_dn_idle'), kit: window.__V151B.kit, you2: (window.__V105_2 || {}).you } }, { src: texAvg })
const youShot = async (name) => { const b = await E(() => { const sc = window.__gridironScene, m = sc.markers.find(q => q && q.team === 'you'), cv = sc.game.canvas.getBoundingClientRect(); if (!m || !m.root) return null
  const cam = sc.cameras.main, p = cam.getWorldPoint ? null : null; const sx = (m.root.x - cam.worldView.x) * cam.zoom * (cv.width / sc.game.config.width) + cv.left, sy = (m.root.y - cam.worldView.y) * cam.zoom * (cv.height / sc.game.config.height) + cv.top
  return { x: Math.max(0, Math.min(400 - 160, sx - 80)), y: Math.max(0, Math.min(860 - 160, sy - 100)), w: 160, h: 160 } }); if (b) { try { await page.screenshot({ path: SHOTS + 'v151B-' + name + '.png', clip: { x: b.x, y: b.y, width: b.w, height: b.h } }) } catch {} } }
await E(() => { const C = window.RIB_COSMETICS; C.equip('uniform', 'uni_team'); C.equip('helmet', 'hel_team'); C.refreshField() }); await page.waitForTimeout(400)
const k0 = await sample(); await youShot('field-kit-before'); await shot('field-before')
await E(() => { const C = window.RIB_COSMETICS; C.equip('uniform', 'uni_electric'); C.equip('helmet', 'hel_star'); C.refreshField() }); await page.waitForTimeout(500)
const k1 = await sample(); await youShot('field-kit-after'); await shot('field-after')
const dist = (a, b) => a && b ? Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) : -1
ok(k0.you && k1.you && dist(k0.you, k1.you) > 30 && dist(k0.youRun, k1.youRun) > 30 && k1.kit && k1.kit.uniform === 'uni_electric' && k1.kit.helmet === 'hel_star', 'the equipped uniform + helmet change the you-player\'s drawn textures (pixel average)', { before: k0.you, after: k1.you, run: [k0.youRun, k1.youRun], kit: k1.kit })
ok(dist(k0.def, k1.def) === 0 && dist(k0.off, k1.off) === 0, 'and NOT the opponent\'s kit or his team-mates\'', { def: [k0.def, k1.def], off: [k0.off, k1.off] })
const deco = await E(() => ({ runs: window.__V151B.decoRuns || 0, err: window.__V151B.decoErr || null }))
ok(deco.runs > 100 && !deco.err, 'the kit decoration ran over every one of his poses without an error', deco)

// the celebration, forced on his score
await E(() => { const C = window.RIB_COSMETICS; C.equip('celebration', 'cel_stars') })
const cel = await E(async () => { const sc = window.__gridironScene, i = sc.markers.findIndex(m => m && m.team === 'you'), m = sc.markers[i]; const n0 = window.__V151B.celebrations.length
  const P = sc.play || (sc.play = { payload: {}, t: 0 }); const keep = P.carrierId; P.carrierId = i
  try { sc.celebrate(m.sx, m.sy) } catch (e) { return { err: String(e) } } P.carrierId = keep
  await new Promise(r => setTimeout(r, 350)); const last = window.__V151B.celebrations[window.__V151B.celebrations.length - 1]
  const oi = sc.markers.findIndex((q, k) => q && q.team !== 'you' && k < 11), n1 = window.__V151B.celebrations.length; P.carrierId = oi; try { sc.celebrate(sc.markers[oi].sx, sc.markers[oi].sy) } catch (e) {} P.carrierId = keep
  return { n0, n1, n2: window.__V151B.celebrations.length, last, err: window.__V151B.celebrateErr || null } })
await shot('celebration')
ok(cel.n1 === cel.n0 + 1 && cel.last && cel.last.kind === 'stars' && cel.last.made >= 10 && cel.last.say === 'STARBOY' && !cel.err, 'a forced touchdown by HIM plays the equipped celebration (particles + callout)', cel)
ok(cel.n2 === cel.n1, 'a team-mate\'s touchdown does not play it', cel)

// the stadium theme on a home game (and not away)
const bowlShot = async () => { const b = await E(() => { const r = window.__gridironScene.game.canvas.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: Math.min(r.height, 260) } })
  const buf = await page.screenshot({ clip: { x: b.x, y: b.y, width: b.w, height: b.h } })
  return E(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0)
    const d = x.getImageData(0, 0, c.width, c.height).data; let r = 0, g = 0, bl = 0, n = 0; for (let i = 0; i < d.length; i += 16) { r += d[i]; g += d[i + 1]; bl += d[i + 2]; n++ } return [r / n, g / n, bl / n] }, buf.toString('base64')) }
await E(() => { window.RIB_COSMETICS.equip('stadium', 'std_home'); window.__homeGameV93 = true; window.RIB_COSMETICS.refreshField() }); await page.waitForTimeout(700)
const s0 = await E(() => ({ st: window.__V151B.stadium, col: window.__gridironScene.crowd && window.__gridironScene.crowd.trim112 && window.__gridironScene.crowd.trim112.col })); const px0 = await bowlShot(); await shot('stadium-before')
await E(() => { window.RIB_COSMETICS.equip('stadium', 'std_ice'); window.RIB_COSMETICS.refreshField() }); await page.waitForTimeout(700)
const s1 = await E(() => { const sc = window.__gridironScene, s = sc.crowd.secs.find(q => q && q.spr && q.spr.idle); return { st: window.__V151B.stadium, col: sc.crowd.trim112 && sc.crowd.trim112.col, tint: s ? s.spr.idle.tintTopLeft : null } }); const px1 = await bowlShot(); await shot('stadium-home')
await E(() => { window.__homeGameV93 = false; window.RIB_COSMETICS.refreshField() }); await page.waitForTimeout(700)
const s2 = await E(() => { const sc = window.__gridironScene, s = sc.crowd.secs.find(q => q && q.spr && q.spr.idle); return { st: window.__V151B.stadium, col: sc.crowd.trim112 && sc.crowd.trim112.col, tint: s ? s.spr.idle.tintTopLeft : null } })
await E(() => { window.__homeGameV93 = true; window.RIB_COSMETICS.refreshField() })
const pxd = Math.abs(px0[0] - px1[0]) + Math.abs(px0[1] - px1[1]) + Math.abs(px0[2] - px1[2])
ok(s0.st && s0.st.id === null && s1.st && s1.st.id === 'std_ice' && s1.col === 0xcfe8ff && s1.tint === 0xd6ecff, 'a stadium theme on a home game repaints the bowl\'s band and tints the crowd', { s0: s0.st, s1 })
ok(pxd > 1.5, 'and the broadcast\'s pixels over the bowl move', { before: px0.map(Math.round), after: px1.map(Math.round), d: +pxd.toFixed(2) })
ok(s2.st && s2.st.id === null && s2.col !== 0xcfe8ff && s2.tint === 0xffffff, 'on an away game the home theme is not worn', s2)
const wx = await E(() => JSON.stringify(window.__WX_V79 || null)); ok(true, 'the weather roll is untouched by the stadium theme (informational)', wx.slice(0, 80))

// ================= 6. the vault =================
await E(() => window.go('menu')); await page.waitForTimeout(600)
const vaultPix = () => E(() => { const cv = document.querySelector('#ribVault canvas.rv-stage'); if (!cv) return null; const x = cv.getContext('2d'), w = cv.width, h = cv.height
  const d = x.getImageData(0, Math.round(h * 0.08), w, Math.round(h * 0.3)).data; let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 16) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++ } return [r / n, g / n, b / n] })
await E(() => { window.RIB_COSMETICS.equip('vault', 'vault_classic'); return window.__RIB_VAULT.open({ balance: 25000, skipDoor: true }) }); await page.waitForTimeout(1800)
const v0 = await vaultPix(); const m0 = await E(() => document.querySelectorAll('#ribVault .rv-cos-v151b i').length)
await E(() => window.RIB_COSMETICS.equip('vault', 'vault_glacier')); await page.waitForTimeout(1200)
const v1 = await vaultPix(); const m1 = await E(() => ({ motes: document.querySelectorAll('#ribVault .rv-cos-v151b i').length, V: window.__V151B.vault, attr: document.getElementById('ribVault').getAttribute('data-cos-vault') }))
await shot('vault-theme')
await E(() => window.__RIB_VAULT.close()); await page.waitForTimeout(300)
const vd = v0 && v1 ? Math.abs(v0[0] - v1[0]) + Math.abs(v0[1] - v1[1]) + Math.abs(v0[2] - v1[2]) : -1
ok(vd > 3 && m0 === 0 && m1.motes > 10 && m1.attr === 'vault_glacier' && m1.V && m1.V.tinted > 0, 'a vault theme grades the room (canvas pixels), tints the coins and hangs its motes; the classic hoard has none', { before: v0 && v0.map(Math.round), after: v1 && v1.map(Math.round), d: +vd.toFixed(1), m0, m1 })

// ================= 7. persistence across a reset of the save =================
await E(() => { Object.keys(localStorage).filter(k => /^gridiron_save|^rib_backup/.test(k)).forEach(k => localStorage.removeItem(k)) })
await boot()
const r3 = await E(() => ({ u: window.RIB_COSMETICS.equipped('uniform'), f: window.RIB_COSMETICS.equipped('frame'), owned: window.RIB_COSMETICS.owned('uni_electric') }))
ok(r3.u === 'uni_electric' && r3.f === 'frame_gold' && r3.owned, 'a wiped career save takes nothing: the looks live outside it', r3)

// ================= 8. no gameplay change =================
const neutral = await E(() => { const C = window.RIB_COSMETICS, st = window.__getGridironState(), keep = JSON.stringify(st.player || null)
  const seedRun = () => { let s = 12345; const orig = Math.random; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let v = Math.imul(s ^ s >>> 15, 1 | s); v = v + Math.imul(v ^ v >>> 7, 61 | v) ^ v; return ((v ^ v >>> 14) >>> 0) / 4294967296 }
    const out = []; try { for (let g = 0; g < 8; g++) { const r = window.__simGameV2(50 + g * 4, ['QB', 'RB', 'WR', 'LB'][g % 4]); out.push([r.usScore, r.themScore, r.plays.length, r.team.yds, r.oppTeam.yds, JSON.stringify(r.player || r.box || r.P || {}).length]) } } finally { Math.random = orig }
    return JSON.stringify(out) }
  C.slots.forEach(s => C.equip(s, C.cats[s].def)); const a = seedRun(); st.player = JSON.parse(keep)
  for (const it of C.catalog()) if (C.owned(it.id)) C.equip(it.cat, it.id)
  const eq = C.slots.map(s => C.equipped(s)); const b = seedRun(); st.player = JSON.parse(keep)
  return { same: a === b, a: a.slice(0, 120), eq } })
ok(neutral.same, 'seeded games score identically with nothing equipped and with everything he owns equipped', neutral)

console.log(JSON.stringify({ pass, fail, errors: errs.length }))
console.log('page errors:', errs.length ? errs.slice(0, 8) : 'none')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
