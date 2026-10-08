// Dev check: v193 Q HIS SKIN, HIS NUMBER, HIS KIT (src/05-field-renderer.js, src/07-career-app.js, src/28-cosmetics.js).
//   A. the skin: the creation screen has nine swatches (the ninth opens a depth / undertone picker held to plausible
//      skin: hue 15-40, saturation 25-60%, lightness 18-85%); a preset and a custom hex both survive a reload;
//      cleanSaveV150 keeps 0-7 / #rrggbb and drops anything else (player and fathers), checkSaveV150 refuses an object;
//      the son inherits the father's tone; every painter wears the custom hex — the field's resolver and the you-marker's
//      skin layer on a live field (SKIP_LIVE=1 skips), the field preview's skin mask, the profile card's face, the
//      growth screen's own full-size recolour (07 growHiCellV134: no kit colour on his face) — and v193Q off reads as before
//   B. the number: the profile card, the Season & Pass TROPHIES card, a leaderboard card (markup) all show his number
//      (pixels against the same figure drawn without one); before a position the card wears the menu's number
//   C. the uniform previews: EVERY uniform x a light and a dark team palette, and every helmet, through the Locker's own
//      painter: drawn (crisp: whole device-pixel blocks, the whole man — boots included), the on-field build (every pixel
//      off the skin and the print is the field texture's), his skin only on the skin mask (no kit on the face / arms,
//      no skin tone off it), a pattern visible and never above the collar, the number printed. Contact sheet:
//      scripts/_v193Q_uniforms.png (gitignored) — LOOK at it.
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v193Qcheck.mjs
import fs from 'node:fs'
import path from 'node:path'
import { gameUrl, launch } from './lib/env.mjs'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const info = (m, d) => console.log('info ' + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : ''))
const errs = []
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
await page.addInitScript(() => { setInterval(() => { for (const s of ['.onboard', '#growthV42', '#gv139gate']) document.querySelector(s)?.remove() }, 80) })
const boot = async () => {
  await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.RIB_COSMETICS && !!window.__V193Q && !!window.__V193Q.app && !!window.__V193Q.cos && !!window.__V193Q.fieldPreview, null, { timeout: 60000 })
  await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  await page.evaluate(() => document.getElementById('splash')?.remove())
  await page.waitForFunction(() => window.__CHASE_V94 && window.__CHASE_V94.ready && window.__V176 && window.__V176.cell('idle_dn'), null, { timeout: 30000 }).catch(() => null)
  await page.waitForTimeout(600)
}
await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 })
await boot()
const M = (fn, arg) => page.evaluate(fn, arg)
const setup = (o) => M((o) => {
  const X = window.__GRIDIRON_AUDIT__, S = X.freshState(); X.setState(S); S.tutorialSeen = true
  S.player = X.newPlayer(); const p = S.player
  p.pos = o.pos === undefined ? 'RB' : o.pos; p.level = 2; p.name = o.name || 'Joe Tester'; p.personaV13 = p.personaV13 || { loyalty: 5 }
  if (o.skin !== undefined) p.skinTone = o.skin
  return true
}, o)
// the shared pixel helpers, on every page load (a reload drops them)
const QFN = () => {
  window.__Q = {
    hx: (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)],
    // a pixel that is the tone times some light (v151 D's grey x tone): its channels keep the tone's ratios
    isTone: (r, g, b, T, tol) => { tol = tol || 0.09; if (r + g + b < 30) return false; const k = (r + g + b) / (T[0] + T[1] + T[2]); if (k < 0.12 || k > 1.25) return false
      return Math.abs(r / (T[0] * k) - 1) < tol * 2.2 && Math.abs(g / (T[1] * k) - 1) < tol * 2.2 && Math.abs(b / (T[2] * k) - 1) < tol * 3 },
    data: (cv) => cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data,
    toneCount: (cv, hex) => { const T = window.__Q.hx(hex), d = window.__Q.data(cv); let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && window.__Q.isTone(d[i], d[i + 1], d[i + 2], T)) n++; return n },
    diff: (a, b) => { const A = window.__Q.data(a), B = window.__Q.data(b); let n = 0; for (let i = 0; i < Math.min(A.length, B.length); i += 4) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) + Math.abs(A[i + 3] - B[i + 3]) > 40) n++; return n },
    hsl: (h) => { const [r, g, b] = window.__Q.hx(h).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2, d = mx - mn, S = d ? d / (1 - Math.abs(2 * L - 1)) : 0
      let H = 0; if (d) H = mx === r ? (60 * ((g - b) / d) + 360) % 360 : mx === g ? 60 * ((b - r) / d) + 120 : 60 * ((r - g) / d) + 240; return { h: +H.toFixed(1), s: +(S * 100).toFixed(1), l: +(L * 100).toFixed(1) } }
  }
}
await page.addInitScript(QFN); await M(QFN)

// ================= A. the skin =================
await setup({ pos: null })
const CR = await M(async () => {
  window.go('choosePos'); await new Promise(r => setTimeout(r, 500))
  const row = document.querySelector('.skin-row-v193c'), sw = row ? [...row.querySelectorAll('.skin-sw-v193c')] : []
  const own = row && row.querySelector('.skin-own-v193q'); own && own.click(); await new Promise(r => setTimeout(r, 300))
  const pick = document.getElementById('skinPickV193Q')
  return { view: window.__GRIDIRON_AUDIT__.getState().view, n: sw.length, own: !!own, pick: !!pick, sliders: pick ? pick.querySelectorAll('input[type=range]').length : 0,
    fig: pick ? (() => { const c = pick.querySelector('.skp-fig-v193q'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let k = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 30) k++; return k })() : 0,
    spr: pick ? pick.querySelector('.skp-spr-v193q').width : 0, tone: window.__GRIDIRON_AUDIT__.getState().player.skinTone }
})
ok(CR.view === 'choosePos' && CR.n === 9 && CR.own, 'the creation screen (name + skin) carries nine swatches, the ninth his own tone', CR)
ok(CR.pick && CR.sliders === 2 && CR.fig > 500 && CR.spr > 0 && /^#[0-9a-f]{6}$/.test(CR.tone), 'the ninth opens the picker: depth and undertone, his figure and his field sprite drawn live, a hex stored', CR)
const RANGE = await M(() => {
  const A = window.__V193Q.app, out = []
  for (const d of [0, 25, 50, 75, 100]) for (const w of [0, 50, 100]) out.push({ d, w, hex: A.fromSliders(d, w), hsl: window.__Q.hsl(A.fromSliders(d, w)) })
  const rt = A.toSliders(A.fromSliders(30, 70))
  return { out, rt, set: A.set(80, 20) }
})
const bad = RANGE.out.filter(o => o.hsl.h < 13.5 || o.hsl.h > 41.5 || o.hsl.s < 24 || o.hsl.s > 61 || o.hsl.l < 17.5 || o.hsl.l > 85.5)   // the 8-bit hex rounds the hue by up to ~1.5° at the deepest end
ok(!bad.length, 'every slider position is a plausible skin: hue 15-40, saturation 25-60%, lightness 18-85%', bad.length ? bad : `${RANGE.out[0].hex} (light, rosy) … ${RANGE.out[RANGE.out.length - 1].hex} (deep, golden)`)
ok(Math.abs(RANGE.rt.depth - 30) <= 2 && Math.abs(RANGE.rt.warm - 70) <= 3 && /^#[0-9a-f]{6}$/.test(RANGE.set), 'the picker reopens where his tone is (hex -> sliders), and a drag sets player.skinTone', RANGE.rt)
const HEX = RANGE.set
// a preset closes the picker; a custom tone survives a reload; so does a preset
const P1 = await M(() => { window.setSkinToneV193C(5); return { t: window.__GRIDIRON_AUDIT__.getState().player.skinTone, pick: !!document.getElementById('skinPickV193Q'), on: [...document.querySelectorAll('.skin-row-v193c .skin-sw-v193c')].findIndex(b => b.classList.contains('on')) } })
ok(P1.t === 5 && !P1.pick && P1.on === 5, 'a preset swatch sets 0-7, rings itself and closes the picker', P1)
const saveNow = () => M(() => { const st = window.__GRIDIRON_AUDIT__.getState(); window.GridironStorage.save(st); return true })
await saveNow()
await page.reload({ waitUntil: 'networkidle' }); await boot()
const R1 = await M(() => window.__GRIDIRON_AUDIT__.getState().player.skinTone)
await M((h) => { const st = window.__GRIDIRON_AUDIT__.getState(); st.player.skinTone = h; window.GridironStorage.save(st) }, HEX)
await page.reload({ waitUntil: 'networkidle' }); await boot()
const R2 = await M(() => { const st = window.__GRIDIRON_AUDIT__.getState(); return { t: st.player.skinTone, view: st.view, own: !!document.querySelector('.skin-own-v193q.on') } })
ok(R1 === 5 && R2.t === HEX, 'a preset (5) and a custom hex both survive a reload', { preset: R1, custom: R2.t, want: HEX })
const SV = await M((h) => {
  const V = window.__V150A, s = { prestige: 0, player: { name: 'A B', skinTone: 'javascript:1' }, lineageV136: { fathers: [{ name: 'C D', skinTone: { x: 1 } }, { name: 'E F', skinTone: 3 }, { name: 'G H', skinTone: h.toUpperCase() }] } }
  const n = V.cleanSave(s), keep = { prestige: 0, player: { name: 'A B', skinTone: h } }; V.cleanSave(keep)
  const idx = { prestige: 0, player: { name: 'A B', skinTone: 7 } }; V.cleanSave(idx)
  return { n, p: 'skinTone' in s.player, f0: 'skinTone' in s.lineageV136.fathers[0], f1: s.lineageV136.fathers[1].skinTone, f2: s.lineageV136.fathers[2].skinTone, keep: keep.player.skinTone, idx: idx.player.skinTone,
    chkObj: V.checkSave({ prestige: 0, player: { skinTone: { a: 1 } } }), chkHex: V.checkSave({ prestige: 0, player: { skinTone: h } }) }
}, HEX)
ok(!SV.p && !SV.f0 && SV.f1 === 3 && SV.f2 === HEX && SV.keep === HEX && SV.idx === 7 && SV.n >= 2, 'cleanSaveV150 keeps 0-7 and #rrggbb (lower-cased) and drops any other skinTone — the player\'s and every father\'s', SV)
ok(!!SV.chkObj && SV.chkHex === '', 'checkSaveV150 refuses an object skinTone and passes a hex', { obj: SV.chkObj, hex: SV.chkHex })
const LN = await M((h) => {
  const X = window.__GRIDIRON_AUDIT__, st = X.getState(), L = window.__LINEAGE_V136
  st.player.skinTone = h; st.player._lineageDoneV136 = false
  L.end(st.player, st.player.level || 2, 'walked')
  const son = X.newPlayer(); L.birth(son)
  const raw = L.raw(), f = raw.fathers[raw.fathers.length - 1]
  // a father who never chose passes the tone the field gave his name
  const noChoice = window.__V193Q.app.fatherTone({ name: 'Marcus Hill' }), field = window.__skinToneV151D({ name: 'Marcus Hill' })
  return { father: f.skinTone, son: son.skinTone, noChoice, field }
}, HEX)
ok(LN.father === HEX && LN.son === HEX && LN.noChoice === LN.field, 'the line hands the tone down: the father\'s record keeps it, the son is born with it (a father who never chose: his name\'s)', LN)
// every painter wears the custom hex
await setup({ skin: HEX })
const PT = await M(async (h) => {
  const Q = window.__Q, C = window.RIB_COSMETICS, V = window.__V193Q
  const field = { resolve: window.__skinToneV151D({ skinTone: h, name: 'x' }), preset: window.__skinToneV151D({ skinTone: 2, name: 'x' }), hex: V.skinHex(h), idx: V.skinHex(2) }
  // the field's own build, his skin layer: every mask pixel is the tone times the light
  const r = V.fieldPreview('idle_dn', '#1a2a5a', '#e8bc97', null, h, 24, null), T = Q.hx(h), d = Q.data(r.cv)
  let inMask = 0, toneIn = 0; for (let i = 0; i < 2304; i++) if (r.mask && r.mask[i]) { inMask++; if (Q.isTone(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], T, 0.06)) toneIn++ }
  // the profile card: his face in this tone, and not in another
  window.go('profile'); await new Promise(z => setTimeout(z, 1200))
  const cv = document.querySelector('.pc-cv-v151b'), oc = document.createElement('canvas'); C.drawCharacter(oc, C.profile().cosmetics.kit || {}, C.profile().age || 22, { num: C.profile().num, skin: '#f3d2b3' })
  const card = { mine: cv ? Q.toneCount(cv, h) : -1, inLightTone: Q.toneCount(oc, h) }   // the same card in the lightest preset: how many pixels still read as his tone
  // the same figure in another tone differs only on his face (upper half of the canvas)
  const a = document.createElement('canvas'), b = document.createElement('canvas')
  C.drawCharacter(a, {}, 22, { num: null, skin: h }); C.drawCharacter(b, {}, 22, { num: null, skin: '#f3d2b3' })
  const A = Q.data(a), B = Q.data(b); let dn = 0, low = 0; for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 30) { dn++; if ((i / 4 / a.width) > a.height * 0.5) low++ }
  // the growth screen's own full-size recolour (07): the face in his tone, none of it in the kit's second colour
  await new Promise(z => V.app.growLoad(() => z()) || setTimeout(z, 2500)); await new Promise(z => setTimeout(z, 300))
  const kit = ['#1f4fd0', '#e8c86a'], g = V.app.growHi(kit), mk = V.cos.mask()
  let gTone = 0, gKit = 0, gFace = 0
  if (g && mk) { const gd = Q.data(g), Kc = Q.hx(kit[1]); for (let j = 0; j < mk.W * mk.H; j++) { if (!mk.m[j]) continue; gFace++; const i = j * 4; if (Q.isTone(gd[i], gd[i + 1], gd[i + 2], T, 0.08)) gTone++; if (Q.isTone(gd[i], gd[i + 1], gd[i + 2], Kc, 0.05)) gKit++ } }
  return { field, inMask, toneIn, skinPx: r.skinPx, card, dn, low, grow: { drawn: !!g, face: gFace, tone: gTone, kit: gKit, hook: V.growSkin || null } }
}, HEX)
ok(PT.field.resolve === HEX && PT.field.hex === HEX && PT.field.preset === 2 && /^#/.test(PT.field.idx), 'the field resolves his custom hex (src/05 skinToneV151D -> skinHexV193Q), a preset stays an index', PT.field)
ok(PT.inMask > 10 && PT.toneIn === PT.inMask, 'the field build\'s skin layer: every skin pixel is his tone times the light', { mask: PT.inMask, tone: PT.toneIn })
ok(PT.card.mine >= 12 && PT.card.mine > PT.card.inLightTone * 2, 'the profile card\'s face wears his custom tone', PT.card)
ok(PT.dn > 20 && PT.low === 0, 'the card figure in two tones differs only on his face', { diff: PT.dn, belowHalf: PT.low })
ok(PT.grow.drawn && PT.grow.face > 20 && PT.grow.tone >= PT.grow.face * 0.95 && PT.grow.kit === 0, 'the growth screen\'s own figure (07 growHiCellV134): the face in his tone, no pixel of it in the kit\'s second colour', PT.grow)
// v193Q off: the old paths (a hex is no choice; the card keeps the art's face)
const OFF = await M(async (h) => {
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v193Q: 0 })
  const r = { resolve: window.__skinToneV151D({ skinTone: h, name: 'x' }), swatches: (window.__V193C.app.swatches().match(/skin-sw-v193c/g) || []).length }
  const c = document.createElement('canvas'); window.RIB_COSMETICS.drawCharacter(c, {}, 22, { num: null }); r.toneOnCard = window.__Q.toneCount(c, h)
  delete window.RIB_TUNE.v193Q
  return r
}, HEX)
ok(typeof OFF.resolve === 'number' && OFF.swatches === 8 && OFF.toneOnCard < PT.card.mine, 'TU v193Q 0: a hex reads as no choice, eight swatches, the card\'s face is the art\'s', OFF)

// ================= the live field (his custom tone on the you-marker) =================
if (!process.env.SKIP_LIVE) {
  const vis = '(e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden" }'
  await M(() => { localStorage.clear(); return true }); await page.reload({ waitUntil: 'networkidle' }); await boot()
  const step = async (t) => {
    const r = await M(({ t, visSrc }) => {
      const v = eval(visSrc), els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(v), txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
      const el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className) || /RUN THIS PLAN|LOCK IT IN|CHOOSE/i.test(txt(e))) : els.find(e => txt(e).includes(t))
      if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null
    }, { t, visSrc: vis })
    await page.waitForTimeout(t === 'PLAN' ? 3500 : 800); return r
  }
  for (const t of ['START NEW CAREER', 'Lock In Personality']) await step(t)
  await M((h) => { const st = window.__GRIDIRON_AUDIT__.getState(); if (st.player) { st.player.skinTone = h; window.GridironStorage.save(st) } }, HEX)
  for (const t of ['POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN']) await step(t)
  let live = false
  for (let i = 0; i < 8 && !live; i++) {
    for (const t of ['CONTINUE TO MATCH', 'Continue to Match', 'NEXT', 'KICK OFF', 'PLAY', 'CONTINUE']) { live = await M(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length)); if (live) break; await step(t) }
    if (!live) await page.waitForTimeout(1500)
  }
  if (!live) info('the broadcast never came up — the live skin read is skipped')
  else {
    await page.waitForTimeout(2500)
    const LV = await M((h) => {
      const sc = window.__gridironScene, you = sc.markers.filter(m => m && (m.team === 'you' || m.kit === 'you'))
      const m = you[0]; if (!m) return { you: 0 }
      const lt = m.body && m.body.isTinted ? m.body.tintTopLeft : 0xffffff, tv = parseInt(h.slice(1), 16)
      const want = (((((tv >> 16) & 255) * ((lt >> 16) & 255) / 255) | 0) << 16)
      return { you: you.length, tone: m.skinTone, skin: !!m.skin, tint: m.skin ? m.skin._tintV151 : null, lt, wantR: Math.round(((tv >> 16) & 255) * ((lt >> 16) & 255) / 255), gotR: m.skin && m.skin._tintV151 != null ? (m.skin._tintV151 >> 16) & 255 : null, want }
    }, HEX)
    ok(LV.you >= 1 && LV.tone === HEX && (LV.tint == null || Math.abs(LV.gotR - LV.wantR) <= 1), 'on the live field the you-marker wears his custom hex (m.skinTone, the skin layer\'s tint = tone x light)', LV)
  }
  await M(() => { try { window.__gridironScene && window.__gridironScene.cancel && window.__gridironScene.cancel() } catch (e) {} return true })
  await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 }); await boot()
}

// ================= B. the number =================
await setup({ pos: 'RB', skin: 3 })
const NB = await M(async () => {
  const Q = window.__Q, C = window.RIB_COSMETICS, wait = (ms) => new Promise(z => setTimeout(z, ms))
  const vsBare = (cv) => { if (!cv || !cv.width) return -1; const b = document.createElement('canvas'), d = C.profile(), cz = d.cosmetics || {}; C.drawCharacter(b, cz.kit || {}, d.age || 22, { num: null, numfont: cz.numfont }); return b.width === cv.width ? Q.diff(cv, b) : -2 }
  const ink = (cv) => { const d = Q.data(cv); let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 30) n++; return n }
  const out = {}
  window.go('profile'); await wait(1500)
  let cv = document.querySelector('.pc-cv-v151b'); out.profile = { ink: ink(cv), num: vsBare(cv), want: C.profile().num }
  window.go('seasons'); await wait(700); window.__seasonsUI && window.__seasonsUI.go('trophies'); await wait(1500)
  cv = document.querySelector('.ss151-profile .pc-cv-v151b'); out.trophies = { found: !!cv, ink: cv ? ink(cv) : 0, num: vsBare(cv), done: cv ? cv.getAttribute('data-fig193q-done') : null }
  // a leaderboard card: markup handed back, then put in the page
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;width:360px;z-index:99'; document.body.appendChild(host)
  const data = Object.assign({}, C.profile(), { name: 'Rival Guy', pos: 'WR', num: null })
  host.innerHTML = C.renderCard(data, { compact: true, context: 'leaderboard' }); await wait(1200)
  cv = host.querySelector('.pc-cv-v151b'); out.board = { ink: cv ? ink(cv) : 0, tagged: cv ? cv.getAttribute('data-fig193q') : null, done: cv ? cv.getAttribute('data-fig193q-done') : null, last: window.__V193Q.cos.last }
  host.remove()
  // before a position: the menu's number for his name
  const st = window.__GRIDIRON_AUDIT__.getState(); st.player.pos = null
  window.go('profile'); await wait(1500)
  cv = document.querySelector('.pc-cv-v151b'); out.noPos = { num: C.profile().num, menu: window.__RIB_MENU_V89.jerseyFor(st.player.name, ''), px: vsBare(cv) }
  st.player.pos = 'RB'
  // the growth (year-older) figure and the live badge go through the same figure
  const g = document.createElement('canvas'), gr = C.growFigure(g, 15, ['#1f4fd0', '#e8c86a']); out.growth = { num: gr && gr.num ? gr.num.num : null }
  return out
})
ok(NB.profile.ink > 2000 && NB.profile.num > 60 && NB.profile.want === 24, 'the profile card: the figure and his number on the chest (pixels against the same man drawn without one)', NB.profile)
ok(NB.trophies.found && NB.trophies.ink > 2000 && NB.trophies.num > 60, 'the Season & Pass TROPHIES card paints its man and his number (it was an empty frame)', NB.trophies)
ok(NB.board.ink > 2000 && NB.board.tagged && NB.board.done === '1' && NB.board.last && NB.board.last.num === '80', 'a leaderboard card handed back as markup is painted once it is in the page — his figure, his number (WR 80)', NB.board)
ok(NB.noPos.num != null && NB.noPos.num === NB.noPos.menu && NB.noPos.px > 40, 'before a position the card wears the menu\'s number for his name (it had none)', NB.noPos)
ok(NB.growth.num === '24', 'the growth screen\'s figure carries the same number', NB.growth)

// ================= C. the uniform previews =================
const PAL = [['light', ['#f2f2ee', '#c8102e']], ['dark', ['#12161c', '#f0bb45']]]
const UV = await M(async (PAL) => {
  const Q = window.__Q, C = window.RIB_COSMETICS, V = window.__V193Q, cos = V.cos, wait = (ms) => new Promise(z => setTimeout(z, ms))
  const st = window.__GRIDIRON_AUDIT__.getState(), tone = cos.playerSkin(), T = Q.hx(tone)
  const cat = C.catalog(), unis = cat.filter(i => i.cat === 'uniform'), helms = cat.filter(i => i.cat === 'helmet')
  const torso = window.__V176.torso('idle_dn', 'dn'), raw = window.__V176.cell('idle_dn'), rawD = raw.getContext('2d').getImageData(0, 0, 48, 48).data
  let srcBot = 0, head = -1; for (let i = 0; i < 2304; i++) if (rawD[i * 4 + 3] > 24) { srcBot = Math.max(srcBot, (i / 48) | 0); if (head < 0) head = (i / 48) | 0 }
  // the helmet: the dome — every row from the crown down that is no wider than the dome's first seven rows (the
  // shoulders widen the row below it; beside the facemask the pads are shirt, and a pattern may ride them)
  const span = (y) => { let a = 99, b = -1; for (let x = 0; x < 48; x++) if (rawD[(y * 48 + x) * 4 + 3] >= 40) { a = Math.min(a, x); b = Math.max(b, x) } return b < 0 ? 0 : b - a + 1 }
  let hw = 0; for (let y = head; y <= head + 6; y++) hw = Math.max(hw, span(y))
  let domeEnd = head; while (domeEnd + 1 < torso.y0 && span(domeEnd + 1) <= hw + 2) domeEnd++
  const helm = (i) => ((i / 48) | 0) <= domeEnd
  const tiles = [], rows = [], keep = window.__GRIDIRON_TEAM_CUSTOM__ ? JSON.parse(JSON.stringify(window.__GRIDIRON_TEAM_CUSTOM__)) : null
  const pv = (it) => { const b = document.createElement('div'); b.className = 'cos-pvbox-v151b'; b.dataset.pv = it.id; document.body.appendChild(b); C.paintPreviews(b.parentNode); const cv = b.querySelector('canvas'); b.remove(); return cv }
  for (const [pname, pal] of PAL) {
    window.__GRIDIRON_TEAM_CUSTOM__ = Object.assign({}, window.__GRIDIRON_TEAM_CUSTOM__ || {}, { col: pal })
    for (const it of unis.concat(helms)) {
      const cv = pv(it), R = { id: it.id, cat: it.cat, pal: pname, pat: (it.k && it.k.pat) || 'solid' }
      R.v193q = !!(cv && cv.__v193q); R.ink = 0; R.crisp = false; R.whole = false
      if (cv) {
        const d = Q.data(cv), s = cv.__v193q ? cv.__v193q.scale : 1; let bad = 0
        for (let i = 3; i < d.length; i += 4) if (d[i] > 24) R.ink++
        for (let y = 0; y < cv.height; y += s) for (let x = 0; x < cv.width; x += s) { const i0 = (y * cv.width + x) * 4; for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) { const i = ((y + dy) * cv.width + x + dx) * 4; if (d[i] !== d[i0] || d[i + 1] !== d[i0 + 1] || d[i + 2] !== d[i0 + 2] || d[i + 3] !== d[i0 + 3]) bad++ } }
        R.crisp = bad === 0 && s >= 1 && Math.abs(parseFloat(cv.style.width) * (cv.__v193q ? cv.__v193q.dpr : 1) - cv.width) < 0.5
        R.whole = cv.__v193q ? (cv.__v193q.crop[1] + cv.__v193q.crop[3] - 1 >= srcBot) : false
        R.scale = s; R.size = [cv.width, cv.height]
        tiles.push({ cv, label: it.id.replace(/^(uni|hel)_/, '').slice(0, 12) + (pname === 'dark' ? '·D' : '·L') })
      }
      // the 48px truth: the same kit, built as the field builds it
      const U = it.cat === 'uniform' ? cos.resolveU(it.k, pal) || { j: pal[0], p: pal[1], pat: 'solid' } : (cos.resolveU((cat.find(i => i.id === C.equipped('uniform')) || {}).k, pal) || { j: pal[0], p: pal[1], pat: 'solid' })
      const H = it.cat === 'helmet' ? it.h : null, num = 24
      const r = cos.fieldCell(U, H, num, tone), fd = Q.data(r.cv)
      const kd = Q.data(V.fieldTex('idle_dn', U.j, U.p, cos.kitDeco(U, H)))
      // on-field: every pixel off the skin and the print is the field texture's
      let off = 0, skinBad = 0, toneOut = 0, kitOnSkin = 0
      const J = Q.hx(U.j), P2 = Q.hx(U.p)
      for (let i = 0; i < 2304; i++) {
        const sk = r.mask && r.mask[i], nm = r.num && r.num[i], a = i * 4
        if (!sk && !nm && (Math.abs(fd[a] - kd[a]) + Math.abs(fd[a + 1] - kd[a + 1]) + Math.abs(fd[a + 2] - kd[a + 2]) + Math.abs(fd[a + 3] - kd[a + 3]) > 6)) off++
        if (sk) { if (!Q.isTone(fd[a], fd[a + 1], fd[a + 2], T, 0.06)) skinBad++; if (Q.isTone(fd[a], fd[a + 1], fd[a + 2], P2, 0.03) && !Q.isTone(fd[a], fd[a + 1], fd[a + 2], T, 0.06)) kitOnSkin++ }
        else if (!nm && fd[a + 3] > 200 && Q.isTone(fd[a], fd[a + 1], fd[a + 2], T, 0.04) && !Q.isTone(fd[a], fd[a + 1], fd[a + 2], J, 0.12) && !Q.isTone(fd[a], fd[a + 1], fd[a + 2], P2, 0.12)) toneOut++
      }
      R.off = off; R.skinPx = r.skinPx; R.skinBad = skinBad; R.kitOnSkin = kitOnSkin; R.toneOut = toneOut; R.numPx = r.numPx
      // the print's contrast: the numeral's median lightness against the shirt's under the same rows
      if (r.num) { const lum = (a) => 0.299 * fd[a] + 0.587 * fd[a + 1] + 0.114 * fd[a + 2], nl = [], jl = []; let y0 = 48, y1 = -1
        for (let i = 0; i < 2304; i++) if (r.num[i]) { nl.push(lum(i * 4)); y0 = Math.min(y0, (i / 48) | 0); y1 = Math.max(y1, (i / 48) | 0) }
        for (let i = 0; i < 2304; i++) { const y = (i / 48) | 0; if (y >= y0 && y <= y1 && !r.num[i] && !(r.mask && r.mask[i]) && Math.abs((i % 48) - torso.cx) <= 4 && fd[i * 4 + 3] > 200) jl.push(lum(i * 4)) }
        const med = (a) => { a.sort((p, q) => p - q); return a.length ? a[a.length >> 1] : 0 }; R.numContrast = Math.round(Math.abs(med(nl) - med(jl))) }
      // the pattern: visible, and never above the collar or off the body
      if (R.pat !== 'solid' && it.cat === 'uniform') {
        const s0 = cos.fieldCell(Object.assign({}, U, { pat: 'solid' }), H, null, tone), r1 = cos.fieldCell(U, H, null, tone), A = Q.data(r1.cv), B = Q.data(s0.cv)
        let n = 0, above = 0, outside = 0
        for (let i = 0; i < 2304; i++) { const a = i * 4; if (Math.abs(A[a] - B[a]) + Math.abs(A[a + 1] - B[a + 1]) + Math.abs(A[a + 2] - B[a + 2]) > 18) { n++; if (helm(i)) above++; if (rawD[a + 3] < 20) outside++ } }
        R.patPx = n; R.patAbove = above; R.patOutside = outside
        // the old deco (v193Q off) for the record
        window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v193Q: 0 })
        try { const OA = Q.data(V.fieldTex('idle_dn', U.j, U.p, cos.kitDeco(U, H))), OB = Q.data(V.fieldTex('idle_dn', U.j, U.p, cos.kitDeco(Object.assign({}, U, { pat: 'solid' }), H)))
          let ab = 0; for (let i = 0; i < 2304; i++) { const a = i * 4; if (helm(i) && Math.abs(OA[a] - OB[a]) + Math.abs(OA[a + 1] - OB[a + 1]) + Math.abs(OA[a + 2] - OB[a + 2]) > 18) ab++ } R.oldAbove = ab } finally { delete window.RIB_TUNE.v193Q }
      }
      rows.push(R)
    }
  }
  if (keep) window.__GRIDIRON_TEAM_CUSTOM__ = keep
  // the old chase-cell preview for the record: its jersey's darkest folds stay the art's navy whatever the kit
  const old = cos.oldSprite({ U: { j: '#c8102e', p: '#f2f2ee', pat: 'solid' }, H: null }, 64), od = Q.data(old); let navy = 0
  for (let i = 0; i < od.length; i += 4) { if (od[i + 3] < 200) continue; const r = od[i], g = od[i + 1], b = od[i + 2]; if (b > r + 12 && b > g && b < 120) navy++ }
  // the contact sheet: every preview at its own pixels x2, labelled
  const cell = 2, W = 12, colW = 78, rowH = 112, sheet = document.createElement('canvas'), nR = Math.ceil(tiles.length / W)
  sheet.width = W * colW; sheet.height = nR * rowH; const x = sheet.getContext('2d'); x.imageSmoothingEnabled = false
  x.fillStyle = '#1b2230'; x.fillRect(0, 0, sheet.width, sheet.height)
  tiles.forEach((t, i) => { const cx = (i % W) * colW, cy = Math.floor(i / W) * rowH; x.fillStyle = i % 2 ? '#253042' : '#1f2838'; x.fillRect(cx + 1, cy + 1, colW - 2, rowH - 2)
    const k = Math.max(1, Math.floor(Math.min((colW - 6) / t.cv.width, (rowH - 16) / t.cv.height) * 1)) ; const w = t.cv.width * k / (t.cv.__v193q ? t.cv.__v193q.scale : 1) * (t.cv.__v193q ? t.cv.__v193q.scale : 1) / k
    const sc = Math.min((colW - 6) / t.cv.width, (rowH - 16) / t.cv.height), dw = Math.floor(t.cv.width * sc), dh = Math.floor(t.cv.height * sc)
    x.drawImage(t.cv, cx + ((colW - dw) >> 1), cy + 3, dw, dh); x.fillStyle = '#dfe6ef'; x.font = '9px sans-serif'; x.fillText(t.label, cx + 3, cy + rowH - 4) })
  return { rows, tone, torsoY0: torso.y0, domeEnd, srcBot, oldNavy: navy, sheet: sheet.toDataURL('image/png'), n: tiles.length }
}, PAL)
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '_v193Q_uniforms.png')
fs.writeFileSync(OUT, Buffer.from(UV.sheet.split(',')[1], 'base64'))
info('contact sheet', `${OUT} — ${UV.n} previews (every uniform and helmet, light and dark palette), his tone ${UV.tone}`)
const R = UV.rows, U2 = R.filter(r => r.cat === 'uniform')
const f = (pred) => R.filter(pred).map(r => r.id + '·' + r.pal)
ok(R.length >= 2 * 40 && R.every(r => r.v193q && r.ink > 300), 'every uniform and helmet preview draws through the field build (the Locker\'s own painter)', { n: R.length, notV193Q: f(r => !r.v193q || r.ink <= 300).slice(0, 8) })
ok(R.every(r => r.crisp), 'every preview is crisp pixel art: whole device-pixel blocks, no smoothing, shown at its own size', { blurry: f(r => !r.crisp).slice(0, 8), scales: [...new Set(R.map(r => r.scale))] })
ok(R.every(r => r.whole), 'the whole man is in every preview — boots included (the old 64x70 draw into a 64x64 canvas cut them off)', { clipped: f(r => !r.whole).slice(0, 8), srcBottom: UV.srcBot })
ok(R.every(r => r.off === 0), 'every preview is the on-field look: off the skin and the print, each pixel is the field texture\'s (ribRegisterTeam\'s kitCellV193C, its band)', { differ: f(r => r.off > 0).slice(0, 8) })
ok(R.every(r => r.skinPx > 10 && r.skinBad === 0 && r.kitOnSkin === 0), 'his skin sits on the skin mask in his tone — no kit colour on the face or arms', { bad: R.filter(r => r.skinBad || r.kitOnSkin || r.skinPx <= 10).slice(0, 6).map(r => [r.id, r.pal, r.skinPx, r.skinBad, r.kitOnSkin]) })
ok(R.every(r => r.toneOut <= 2), 'no skin-tone pixel off the skin mask', { worst: R.slice().sort((a, b) => b.toneOut - a.toneOut).slice(0, 4).map(r => [r.id, r.pal, r.toneOut]) })
const pats = U2.filter(r => r.pat !== 'solid')
ok(pats.length >= 20 && pats.every(r => r.patPx >= 6), 'every patterned uniform shows its pattern on the jersey', { n: pats.length, faint: pats.filter(r => r.patPx < 6).map(r => [r.id, r.pal, r.patPx]) })
ok(pats.every(r => r.patAbove === 0 && r.patOutside === 0), 'no pattern pixel on the helmet\'s dome or off the body', { bleed: pats.filter(r => r.patAbove || r.patOutside).map(r => [r.id, r.pal, r.patAbove, r.patOutside]) })
info('before v193 Q: patterns painted the bare helmet (field texture pixels)', pats.filter(r => r.oldAbove > 0).map(r => r.id + '·' + r.pal + ':' + r.oldAbove).filter((v, i, a) => a.indexOf(v) === i).slice(0, 14).join(' '))
ok(R.every(r => r.numPx >= 8), 'his number is printed on every preview\'s chest', { missing: f(r => r.numPx < 8).slice(0, 8) })
ok(R.every(r => (r.numContrast || 0) >= 40), 'the print reads on every shirt: the numeral and the shirt differ by 40+ in lightness', { low: R.filter(r => (r.numContrast || 0) < 40).map(r => [r.id, r.pal, r.numContrast]) })
info('the print\'s contrast (numeral vs shirt lightness), the lowest', R.slice().sort((a, b) => (a.numContrast || 0) - (b.numContrast || 0)).slice(0, 10).map(r => r.id + '·' + r.pal + ':' + r.numContrast).join(' '))
info('the old chase-cell preview (a red kit): navy fold pixels left on the jersey', UV.oldNavy)

ok(errs.length === 0, 'no page errors', errs.slice(0, 5))
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
