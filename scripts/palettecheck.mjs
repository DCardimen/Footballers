// Dev check: v174 — THE PALETTE (src/28-cosmetics.js `v174 THE PALETTE`), at a 400x860 phone and a 1280x800 desktop:
//   1. the Locker's STYLE tab is the palette: the live card on top, three groups, and a row for EVERY cosmetic
//      category (all eighteen slots) plus TEAM COLOURS and TEAM CREST — each row showing what he wears and how many he has
//   2. every category opens from the palette (cosCatV151B and a tap on its row): one section open at a time, its grid
//      lists exactly that category's listed items with drawn previews, its row's preview draws when it comes into view
//   3. equipping from it works in every category he owns a second look in (a grant for the earned ones): a tap equips,
//      the row names it, the item reads EQUIPPED, the card redraws; a locked look (🔒 Membership) cannot be equipped;
//      with monetization OFF no shop look is listed and RIB_MONETIZE stays disabled
//   4. TEAM COLOURS: the v159 A uniform-colour choice, every team palette; a locked palette goes through the Team
//      Creator's gate (a free pick asked for, spent, applied), "Not now" changes nothing; TEAM CREST: every crest, a
//      pick keeps the colours
//   5. the old doors: cosOpenStyleV151B(sec) lands on the palette at that section, in view; the profile's button reads
//      "The Palette"; with a player, the top bar's 🎨 opens the palette at TEAM COLOURS and the Team Creator links to it
//   6. phones: no horizontal scroll, no visible palette text under 12px (rows 15px, names 13px); the desktop scrolls
//      the palette as ONE box (no grid squeezed inside it)
//   7. TU v174palette 0 restores v151 B's tabbed panel and the 🎨 opens the Team Creator again
//   8. no Math.random from src/28, no page errors
// Screenshots go to $SHOTS (default /tmp/claude-0/shots/), prefixed palette-.
//   node scripts/palettecheck.mjs        (GAME_URL=http://localhost:5173/)
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
const wait = (ms) => page.waitForTimeout(ms)
const boot = async () => {
  await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 45000 }); await wait(1200)
  await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && window.RIB_COSMETICS && window.__V174 && window.__CHASE_V94 && window.__CHASE_V94.ready, null, { timeout: 60000 })
  await wait(1500)
}
await boot(); await page.goto(GAME_URL, { waitUntil: 'networkidle' }); await boot()   // warm past vite's one-time reload
const shot = async (name) => { try { await page.screenshot({ path: SHOTS + 'palette-' + name + '.png' }) } catch {} }
/* every confirm the Team Creator's gate raises is answered: accepted unless window.__dlgNo is set */
await E(() => { new MutationObserver(() => { const d = document.getElementById('ribDlgV149'); if (d && !d.__seen) { d.__seen = 1; window.__dlgText = d.innerText; setTimeout(() => { const b = d.querySelector(window.__dlgNo ? 'button:not(.primary-v149)' : 'button.primary-v149'); b && b.click() }, 60) } }).observe(document.body, { childList: true }) })
// Math.random is watched from here on: a look never draws from the game's stream
await E(() => { const o = Math.random; window.__mrPal = 0; Math.random = function () { if (/28-cosmetics/.test(String(new Error().stack))) window.__mrPal++; return o.apply(this, arguments) } })
const openStyle = async () => {
  await E(() => window.go('locker'))
  await page.waitForFunction(() => document.querySelector('.hubv75-tab[data-sec="style"]'), null, { timeout: 15000 }).catch(() => {})
  await wait(250)
  await E(() => { const t = document.querySelector('.hubv75-tab[data-sec="style"]'); t && t.click() }); await wait(900)
}

// ================= 1. the palette =================
await openStyle()
const SLOTS = await E(() => window.RIB_COSMETICS.slots)
const pal = await E(() => {
  const root = document.querySelector('.pal-v174'), secs = [...document.querySelectorAll('.pal-v174 [data-pal-sec]')].map(s => s.dataset.palSec)
  const live = root && root.querySelector('.pal-live-v174 .pcard-v151b')
  return { root: !!root, inStyle: !!(root && root.closest('.hubv75-sec[data-sec="style"]')), visible: !!(root && root.getClientRects().length), secs, groups: [...document.querySelectorAll('.pal-gh-v174')].map(g => g.firstChild.textContent),
    card: !!live, cardCv: !!(live && live.querySelector('canvas')), heads: [...document.querySelectorAll('.pal-v174 .pal-hd-v174')].map(h => ({ k: h.closest('[data-pal-sec]').dataset.palSec, t: h.querySelector('b').textContent, sub: h.querySelector('small').textContent, n: h.querySelector('.pal-hdn-v174').textContent })) }
})
const want = SLOTS.concat(['colours', 'crest'])
ok(pal.root && pal.inStyle && pal.visible, 'the Locker\'s STYLE tab is the palette (.pal-v174, the v75 sectioner\'s STYLE section)', { root: pal.root, inStyle: pal.inStyle })
ok(want.every(k => pal.secs.includes(k)) && pal.secs.length === want.length, 'every cosmetic category has its row in the palette — the eighteen slots plus TEAM COLOURS and TEAM CREST', { missing: want.filter(k => !pal.secs.includes(k)), n: pal.secs.length })
ok(pal.groups.length === 3 && pal.secs[0] === 'uniform' && pal.secs[1] === 'colours' && pal.secs.indexOf('celebration') < pal.secs.indexOf('banner'), 'grouped ON THE FIELD / HIS CARD / HIS WORLD, uniform then colours first, the celebration before the banner', pal.groups)
ok(pal.heads.every(h => h.t.length > 3 && h.sub.length > 0 && /^(\d+\/\d+|ALL)$/.test(h.n)), 'each row names its section, what he wears now and how many of it he has', pal.heads.slice(0, 4))
ok(pal.card && pal.cardCv, 'the live card (his figure, banner, frame) sits on top of the palette')
await shot('phone-top')

// ================= 2. every category opens =================
const cats = {}
for (const k of SLOTS) {
  cats[k] = await E(async (k) => {
    window.cosCatV151B(k); await new Promise(r => setTimeout(r, 650))
    const C = window.RIB_COSMETICS, all = C.catalog(), want = all.filter(it => it.cat === k && C.listed(it)).map(it => it.id)
    const open = [...document.querySelectorAll('.pal-v174 .pal-sec-v174.on')].map(s => s.dataset.palSec)
    const items = [...document.querySelectorAll('.cos-item-v151b')].map(el => el.dataset.cos)
    const drawn = [...document.querySelectorAll('.cos-item-v151b .cos-pvbox-v151b')].filter(b => b.childNodes.length > 0).length
    const head = document.querySelector('.pal-v174 [data-pal-sec="' + k + '"] .pal-hd-v174'), hr = head && head.getBoundingClientRect()
    const pv = document.querySelector('.pal-v174 [data-pal-sec="' + k + '"] [data-pv174]')
    return { open, n: items.length, want: want.length, same: items.length === want.length && want.every(id => items.includes(id)), drawn, rowPv: !!(pv && pv.childNodes.length), headTop: hr ? Math.round(hr.top) : null }
  }, k)
}
const bad = Object.entries(cats).filter(([k, c]) => !(c.open.length === 1 && c.open[0] === k && c.same && c.n > 0))
ok(!bad.length, 'every category opens on its own in the palette, its grid exactly the category\'s listed looks', bad.length ? Object.fromEntries(bad) : Object.fromEntries(Object.entries(cats).map(([k, c]) => [k, c.n])))
ok(Object.values(cats).every(c => c.drawn >= Math.min(c.n, 6)), 'the open grid draws its previews', Object.fromEntries(Object.entries(cats).map(([k, c]) => [k, c.drawn + '/' + c.n])))
ok(Object.values(cats).every(c => c.rowPv), 'each row\'s own preview (what he wears) draws once the row is in view', Object.fromEntries(Object.entries(cats).filter(([, c]) => !c.rowPv)))
ok(Object.values(cats).every(c => c.headTop != null && c.headTop >= 0 && c.headTop < 300), 'opening a section brings its row into view (the jump clears the sticky section bar)', Object.fromEntries(Object.entries(cats).map(([k, c]) => [k, c.headTop])))
const tap = await E(async () => { const h = document.querySelector('.pal-v174 [data-pal-sec="banner"] .pal-hd-v174'); h.click(); await new Promise(r => setTimeout(r, 400)); const a = window.__V174.open(); document.querySelector('.pal-v174 [data-pal-sec="banner"] .pal-hd-v174').click(); await new Promise(r => setTimeout(r, 300)); return { a, b: window.__V174.open(), items: document.querySelectorAll('.cos-item-v151b').length } })
ok(tap.a === 'banner' && tap.b === null && tap.items === 0, 'a tap on a row opens it, a second tap folds it', tap)

// ================= 3. equip from the palette =================
await E(() => { const C = window.RIB_COSMETICS; C.catalog().filter(it => it.source === 'earned').forEach(it => C.grant(it.id, 'earned')) })   // every earned look, so each category has one to wear
const eq = {}
for (const k of SLOTS) {
  eq[k] = await E(async (k) => {
    const C = window.RIB_COSMETICS
    window.cosCatV151B(k); await new Promise(r => setTimeout(r, 450))
    const el = [...document.querySelectorAll('.pal-v174 .cos-item-v151b:not(.on):not(.locked)')][0]
    if (!el) return { none: true }
    const id = el.dataset.cos, name = (C.catalog().find(i => i.id === id) || {}).name
    el.click(); await new Promise(r => setTimeout(r, 450))
    const row = document.querySelector('.pal-v174 [data-pal-sec="' + k + '"] .pal-hd-v174 small'), on = document.querySelector('.pal-v174 .cos-item-v151b.on[data-cos="' + id + '"]')
    const card = document.querySelector('.pal-v174 .pal-live-v174 .pcard-v151b')
    return { id, eq: C.equipped(k) === id, row: row && row.textContent === name, on: !!on && /EQUIPPED/.test(on.textContent), card: card ? { frame: card.dataset.frame, banner: (card.querySelector('[data-banner]') || {}).dataset?.banner } : null }
  }, k)
}
const eqd = Object.entries(eq).filter(([, r]) => !r.none), eqBad = eqd.filter(([, r]) => !(r.eq && r.row && r.on))
ok(eqd.length >= 15 && !eqBad.length, 'a tap equips in every category he owns a second look in: equipped, the row names it, the look reads EQUIPPED', { equipped: eqd.length, bad: Object.fromEntries(eqBad), none: Object.keys(eq).filter(k => eq[k].none) })
ok(eq.banner.card && eq.banner.card.banner === eq.banner.id && eq.frame.card && eq.frame.card.frame === eq.frame.id, 'the live card redraws in the picked banner and frame', { banner: eq.banner, frame: eq.frame })
await shot('phone-equipped')
const lock = await E(async () => {
  const C = window.RIB_COSMETICS, M = window.RIB_MONETIZE
  window.cosCatV151B('wings'); await new Promise(r => setTimeout(r, 450))
  const before = C.equipped('wings'), el = document.querySelector('.pal-v174 .cos-item-v151b.locked'), txt = el ? el.querySelector('.cos-src-v151b').textContent : ''
  el && el.click(); await new Promise(r => setTimeout(r, 250))
  const shopIds = C.catalog().filter(it => it.source === 'shop').map(it => it.id), shown = shopIds.filter(id => document.querySelector('.pal-v174 [data-cos="' + id + '"]'))
  let shopAny = 0; for (const k of C.slots) { window.cosCatV151B(k); shopAny += shopIds.filter(id => document.querySelector('.pal-v174 [data-cos="' + id + '"]')).length }
  return { locked: !!el, txt, same: C.equipped('wings') === before, shopAny, monet: !!(M && M.enabled) }
})
ok(lock.locked && /🔒/.test(lock.txt) && lock.same, 'a locked look shows its lock and how to get it, and a tap does not equip it', lock)
ok(lock.shopAny === 0 && !lock.monet, 'with monetization OFF no shop look is listed anywhere in the palette and the store stays disabled', lock)
await E(() => { const C = window.RIB_COSMETICS; C.slots.forEach(s => C.equip(s, null)) })

// ================= 4. team colours, team crest =================
const col = await E(async () => {
  window.cosCatV151B('colours'); await new Promise(r => setTimeout(r, 500))
  const P = window.TEAM_PALETTES, b = [...document.querySelectorAll('.pal-v174 .pal-tp-v174')], on = b.filter(x => x.classList.contains('on')).map(x => +x.dataset.i)
  return { row: !!document.querySelector('.pal-v174 [data-pal-sec="colours"] .cos-unicol-v159a'), n: b.length, want: P.length, on, cur: window.__GRIDIRON_TEAM_CUSTOM__.palette, locked: b.filter(x => x.classList.contains('locked')).length }
})
ok(col.row && col.n === col.want && col.on.length === 1 && col.on[0] === col.cur, 'TEAM COLOURS: the uniform-colour choice and every team palette, the one he wears marked', col)
await shot('phone-colours')
const pick = await E(async () => {
  const T = window.RIB_COSMETICS.teamStyle, before = T.info(), cur = window.__GRIDIRON_TEAM_CUSTOM__.palette, logo = window.__GRIDIRON_TEAM_CUSTOM__.logo
  const tgt = [...document.querySelectorAll('.pal-v174 .pal-tp-v174.locked')].map(x => +x.dataset.i).find(i => i !== cur)
  window.__dlgText = ''; window.__dlgNo = 0
  await window.palTeamV174('pal', tgt); await new Promise(r => setTimeout(r, 700))
  const after = T.info(), now = window.__GRIDIRON_TEAM_CUSTOM__
  const r = { tgt, dlg: window.__dlgText, pal: now.palette, logo: now.logo, logoBefore: logo, free: [before.freeLeft, after.freeLeft], pals: [before.pals, after.pals], on: !!document.querySelector('.pal-v174 .pal-tp-v174.on[data-i="' + tgt + '"]'), open: window.__V174.open() }
  const tgt2 = [...document.querySelectorAll('.pal-v174 .pal-tp-v174.locked')].map(x => +x.dataset.i)[0]
  window.__dlgNo = 1; const res2 = await window.palTeamV174('pal', tgt2); await new Promise(r => setTimeout(r, 500)); window.__dlgNo = 0
  r.no = { tgt2, res2, pal: window.__GRIDIRON_TEAM_CUSTOM__.palette, free: T.info().freeLeft }
  return r
})
ok(/free pick/i.test(pick.dlg) && pick.pal === pick.tgt && pick.on && pick.free[1] === pick.free[0] - 1 && pick.pals[1] === pick.pals[0] + 1 && pick.logo === pick.logoBefore && pick.open === 'colours', 'a locked team palette goes through the Team Creator\'s gate: a free pick asked for and spent, the colours applied, the crest kept', pick)
ok(pick.no.res2 === false && pick.no.pal === pick.tgt && pick.no.free === pick.free[1], '"Not now" changes nothing and spends nothing', pick.no)
const crest = await E(async () => {
  window.cosCatV151B('crest'); await new Promise(r => setTimeout(r, 600))
  const E = window.TEAM_LOGOS_V44, b = [...document.querySelectorAll('.pal-v174 .pal-cr-v174')], pal = window.__GRIDIRON_TEAM_CUSTOM__.palette, cur = window.__GRIDIRON_TEAM_CUSTOM__.logo
  const tgt = b.map(x => +x.dataset.i).find(i => i !== cur)
  await window.palTeamV174('logo', tgt); await new Promise(r => setTimeout(r, 700))
  return { n: b.length, want: E.db.length, tgt, logo: window.__GRIDIRON_TEAM_CUSTOM__.logo, pal: [pal, window.__GRIDIRON_TEAM_CUSTOM__.palette], row: (document.querySelector('.pal-v174 [data-pal-sec="crest"] .pal-hd-v174 small') || {}).textContent, name: E.name(tgt) }
})
ok(crest.n === crest.want && crest.logo === crest.tgt && crest.pal[0] === crest.pal[1] && crest.row === crest.name, 'TEAM CREST: every crest; a pick wears it, keeps the colours and names it on the row', crest)
await shot('phone-crest')

// ================= 5. the old doors =================
const door = await E(async () => {
  window.go('profile'); await new Promise(r => setTimeout(r, 900))
  const btn = [...document.querySelectorAll('#dock button')].find(b => /cosOpenStyleV151B/.test(b.getAttribute('onclick') || ''))
  const label = btn ? btn.textContent.trim() : null
  window.cosOpenStyleV151B('banner'); for (let i = 0; i < 40 && (i < 4 || window.__V174.stats.pend); i++) await new Promise(r => setTimeout(r, 200)); await new Promise(r => setTimeout(r, 300))   // the jump waits for the split screen (slow on a loaded box)
  const h = document.querySelector('.pal-v174 [data-pal-sec="banner"] .pal-hd-v174'), r = h && h.getBoundingClientRect()
  return { label, view: window.S.view, open: window.__V174.open(), styleOn: !!document.querySelector('.hubv75-sec.on[data-sec="style"] .pal-v174'), top: r ? Math.round(r.top) : null }
})
ok(/The Palette/.test(door.label || '') && door.view === 'locker' && door.styleOn && door.open === 'banner' && door.top != null && door.top >= 0 && door.top < 300, 'the profile\'s button reads "The Palette"; cosOpenStyleV151B(sec) lands on the palette at that section, in view', door)
await shot('phone-door-banner')

// ================= 6. phone fit, type sizes =================
const fit = await E(async () => {
  window.cosCatV151B('uniform'); await new Promise(r => setTimeout(r, 600))
  const se = document.scrollingElement, root = document.querySelector('.pal-v174')
  let small = [], minHead = 99, minName = 99
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n; (n = walk.nextNode());) {
    const t = n.textContent.trim(); if (!t) continue
    const el = n.parentElement; if (!el || !el.getClientRects().length) continue
    const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 12) small.push(t.slice(0, 20) + '@' + fs)
  }
  document.querySelectorAll('.pal-v174 .pal-hdtx-v174 b').forEach(b => { minHead = Math.min(minHead, parseFloat(getComputedStyle(b).fontSize)) })
  document.querySelectorAll('.pal-v174 .cos-nm-v151b').forEach(b => { minName = Math.min(minName, parseFloat(getComputedStyle(b).fontSize)) })
  const wide = [...root.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('.pcard-v151b')).length
  return { sw: se.scrollWidth, iw: innerWidth, app: document.getElementById('app') ? document.getElementById('app').scrollWidth : 0, small: small.slice(0, 6), nSmall: small.length, minHead, minName, wide }
})
ok(fit.sw <= fit.iw + 1 && fit.app <= fit.iw + 1 && fit.wide === 0, 'a 400px phone: no horizontal scroll, nothing in the palette runs past the edge', fit)
ok(fit.nSmall === 0 && fit.minHead >= 15 && fit.minName >= 13, 'the palette reads on a phone: no visible text under 12px, rows 15px, look names 13px', fit)

// ================= 7. the kill switch =================
const off = await E(async () => {
  (window.RIB_TUNE = window.RIB_TUNE || {}).v174palette = 0
  window.go('locker'); await new Promise(r => setTimeout(r, 900)); const t = document.querySelector('.hubv75-tab[data-sec="style"]'); t && t.click(); await new Promise(r => setTimeout(r, 400))
  window.cosCatV151B('banner'); await new Promise(r => setTimeout(r, 400))
  const r = { pal: !!document.querySelector('.pal-v174'), strip: document.querySelectorAll('.cos-cats-v151b .cos-cat-v151b').length, items: document.querySelectorAll('.cos-item-v151b[data-cos^="ban_"]').length, allBan: [...document.querySelectorAll('.cos-item-v151b')].every(e => /^ban_|banner/.test(e.dataset.cos) || window.RIB_COSMETICS.catalog().find(i => i.id === e.dataset.cos)?.cat === 'banner') }
  delete window.RIB_TUNE.v174palette
  return r
})
ok(!off.pal && off.strip >= 18 && off.items > 0 && off.allBan, 'TU v174palette 0: v151 B\'s tabbed STYLE panel exactly (the strip, one category\'s grid)', off)

// ================= 8. with a player: the top bar's 🎨 and the Team Creator's link =================
const pl = await E(async () => {
  try { window.startCareer(); window.pickPos('RB') } catch (e) {}
  await new Promise(r => setTimeout(r, 600)); document.querySelectorAll('#growthV42,#personaV13').forEach(e => e.remove())
  window.go('profile'); await new Promise(r => setTimeout(r, 900))
  const out = { player: !!window.S.player }
  const b = document.getElementById('teamCreatorBtnV153')
  out.btn = !!b; b && b.click(); await new Promise(r => setTimeout(r, 1500))
  out.afterBtn = { view: window.S.view, open: window.__V174.open(), modal: !!document.getElementById('teamModalV153'), styleOn: !!document.querySelector('.hubv75-sec.on[data-sec="style"] .pal-v174') }
  window.openTeamCreatorV153(); await new Promise(r => setTimeout(r, 400))
  const link = document.querySelector('#teamModalV153 .pal-link-v174'); out.link = link ? link.textContent : null
  link && link.click(); await new Promise(r => setTimeout(r, 1300))
  out.afterLink = { view: window.S.view, open: window.__V174.open(), modal: !!document.getElementById('teamModalV153') }
  window.RIB_TUNE.v174palette = 0
  window.go('profile'); await new Promise(r => setTimeout(r, 700)); const b2 = document.getElementById('teamCreatorBtnV153'); b2 && b2.click(); await new Promise(r => setTimeout(r, 500))
  out.off = { view: window.S.view, modal: !!document.getElementById('teamModalV153'), link: !!document.querySelector('#teamModalV153 .pal-link-v174') }
  window.closeTeamCreatorV153 && window.closeTeamCreatorV153(); delete window.RIB_TUNE.v174palette
  return out
})
ok(pl.player && pl.btn && pl.afterBtn.view === 'locker' && pl.afterBtn.styleOn && pl.afterBtn.open === 'colours' && !pl.afterBtn.modal, 'with a player the top bar\'s 🎨 opens the palette at TEAM COLOURS', pl.afterBtn)
ok(/Palette/.test(pl.link || '') && pl.afterLink.view === 'locker' && !pl.afterLink.modal && pl.afterLink.open === 'uniform', 'the Team Creator links to the palette (uniform, helmet, celebration, banner & more)', pl.afterLink)
ok(pl.off.modal && !pl.off.link && pl.off.view === 'profile', 'TU v174palette 0: the 🎨 opens the Team Creator again, with no link', pl.off)

// ================= 9. the desktop =================
await page.setViewportSize({ width: 1280, height: 800 }); await wait(500)
await openStyle(); await E(() => window.cosCatV151B('celebration')); await wait(900)
const desk = await E(() => {
  const s = document.getElementById('screen'), inner = [...s.querySelectorAll('*')].filter(e => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 4).map(e => String(e.className).slice(0, 40))
  const g = document.querySelector('.pal-v174 .cos-grid-v151b'), it = g && g.querySelector('.cos-item-v151b')
  return { inner, gridH: g ? Math.round(g.getBoundingClientRect().height) : 0, itemH: it ? Math.round(it.getBoundingClientRect().height) : 0, sw: document.scrollingElement.scrollWidth, iw: innerWidth }
})
ok(desk.inner.length <= 1 && !desk.inner.some(c => /cos-grid/.test(c)) && desk.gridH > desk.itemH * 2 && desk.sw <= desk.iw + 1, 'the desktop scrolls the palette as one box — no grid squeezed inside it, no horizontal scroll', desk)
await shot('desktop')

const mr = await E(() => window.__mrPal)
ok(mr === 0, 'no Math.random draw was made from inside src/28 across the check', { draws: mr })
const st = await E(() => window.__V174.stats)
ok(st.errs === 0, 'the palette caught no errors of its own', st)

console.log(JSON.stringify({ pass, fail, errors: errs.length }))
console.log('page errors:', errs.length ? errs.slice(0, 8) : 'none')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
