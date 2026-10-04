// Dev check (v173 THE PILE IS THE BUTTON): a tap on the PILE is the vault's tap — exactly the
// same money as v137's press — and now the pile answers it: it lights, real coins jump off it and
// ring as they land, "+N PP" pops, the quarter marks chime and shake. A hold is still the pour,
// the keyboard can do both, the target is the pile's shape (not a box) and is thumb-sized on a
// phone, and RIB_TUNE.v173pile = 0 puts v137's box back exactly.
//
//   npm run dev, then: node scripts/v173check.mjs        (or GAME_URL=… node scripts/v173check.mjs)
import { chromium } from 'playwright'
import { CHROME, gameUrl } from './lib/env.mjs'

const browser = await chromium.launch({ executablePath: CHROME })
const ctx = await browser.newContext({ viewport: { width: 400, height: 860 } })
// v179 prices the tree by branch (core ×6, Apex ×10); this check's numbers are the vault's own mechanics at the base prices
await ctx.addInitScript(() => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { corePriceV179: 1, apexPriceV179: 1, impossiblePriceV179: 1 }) })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push('CONSOLE: ' + m.text()) })

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d) : '')); c ? pass++ : fail++ }
const E = (fn, a) => page.evaluate(fn, a)

async function boot () {
  await page.goto(gameUrl('?stayStale&noFilmV114'), { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(1800)
  await E(() => { try { window.__splashDoneV94 && window.__splashDoneV94() } catch (e) {} })
  await page.waitForFunction(() => { const s = document.getElementById('splash'); if (!s) return true
    const c = getComputedStyle(s); return c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0 }, null, { timeout: 25000 }).catch(() => {})
  for (let i = 0; i < 4; i++) {
    const h = await E(() => { const b = [...document.querySelectorAll('.onboard button,.onboard [onclick]')].find(e => e.getBoundingClientRect().height > 0); if (b) { b.click(); return true } return false })
    if (!h) break; await page.waitForTimeout(220)
  }
  await E(() => { document.querySelectorAll('.onboard').forEach(e => e.remove())
    try { localStorage.setItem('rib.vaultDoor.v137', '1'); localStorage.setItem('rib.coachTour.v119', '0') } catch (e) {} })
}
const setPP = (pp) => E((pp) => { const o = window.__GRIDIRON_AUDIT__.getState()
  o.pp = pp; o.prestige = 40; window.__V156A && window.__V156A.seed(200); o.tree = {}; window.go('shop'); return o.pp }, pp)
const tune = (v) => E((v) => { window.RIB_TUNE = window.RIB_TUNE || {}; if (v == null) delete window.RIB_TUNE.v173pile; else window.RIB_TUNE.v173pile = v }, v)
const openV = async (key) => { await E((key) => window.__RIB_VAULT_BRIDGE.open(Object.assign({ skipDoor: true }, key ? { key } : {})), key || null); await page.waitForTimeout(700) }
const closeV = async () => { await E(() => window.__RIB_VAULT.close('test')); await page.waitForTimeout(200) }
const st = () => E(() => window.__RIB_VAULT_DEV.state())
const v173 = () => E(() => { const d = window.__RIB_VAULT_DEV.v173(); delete d.shape; return d })
const gamePP = () => E(() => { const o = window.__GRIDIRON_AUDIT__.getState(); return { pp: o.pp, tree: JSON.parse(JSON.stringify(o.tree || {})) } })
const centre = () => E(() => { const V = window.__RIB_VAULT_DEV.v; return V.pileCentreV173() })
const chunk = () => E(() => window.__RIB_VAULT_DEV.v.tapChunk())
async function tapAt (p, ms = 40) { await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up() }

await boot()
ok(await E(() => !!(window.__V173 && window.__RIB_VAULT_DEV.v173 && window.__RIB_VAULT_AUDIO.tapV173)), 'v173 is mounted: the hooks, the dev probe and the tap\'s sound')

// ---------- 1. the target is the pile, and it is a thumb's worth on a phone ----------
const BIG = 'oracle'                        // 300 PP: a tap is 2% of it = 6 PP, so "the same chunk" means something
await setPP(2500)
await openV(BIG)
const v0 = await v173()
ok(v0.on && v0.rootClass, 'the vault opens with the pile as the button (`rv-v173`)', v0)
const geo = await E(() => {
  const V = window.__RIB_VAULT_DEV.v, s = V.scene, h = s.hoardBox(), c = s.corePoint(), e = s.pileShapeV173()
  const t = V.elTgt.getBoundingClientRect(), pb = V.elPile.getBoundingClientRect()
  const corner = { x: h.x0 - 20, y: h.y0 - 12 }
  return { box: h, core: c, tgt: { top: t.top, bottom: t.bottom }, btn: { w: pb.width, h: pb.height }, e: { rx: e.rx, ry: e.ry },
    centreHit: s.onPileV173(e.cx, e.cy), corner, cornerHit: s.onPileV173(corner.x, corner.y), cornerPick: s.pickSurface(corner.x, corner.y).hit,
    farHit: s.onPileV173(s.cw / 2, c.y) }
})
ok(geo.centreHit && !geo.farHit, 'the middle of the pile is on it, and the core above it is not', geo)
ok(!geo.cornerHit && !geo.cornerPick, 'and an empty corner of the OLD box (no coin drawn there) is no longer part of the target', geo.corner)
ok(geo.tgt.top > geo.core.y && geo.tgt.bottom <= geo.box.y0 + 4,
  'the funding card hangs under the core, off the money — the pile is uncovered', { tgt: geo.tgt, pileTop: Math.round(geo.box.y0), core: Math.round(geo.core.y) })
ok(geo.btn.w >= 220 && geo.btn.h >= 160, 'the pile\'s target is at least 220 x 160 px on a 400 x 860 phone', geo.btn)
await closeV()
await setPP(12)
await openV()
const small = await E(() => { const s = window.__RIB_VAULT_DEV.scene(), e = s.pileShapeV173(), h = s.hoardBox(); return { rx: e.rx, ry: e.ry, boxW: Math.round(h.x1 - h.x0), boxH: Math.round(h.y1 - h.y0) } })
ok(small.rx >= 110 && small.ry >= 80, 'and a SMALL hoard is still a big target (never under 220 x 160)', small)
await closeV()

// ---------- 2. a tap: the same money as v137's press, and the pile answers ----------
await setPP(2500)
await openV(BIG)
const c0 = await centre(), ch = await chunk()
const g0 = await gamePP(), p0 = (await st()).pending
const a0 = await v173()
await tapAt(c0)
await page.waitForTimeout(70)
const p1 = (await st()).pending, a1 = await v173()
const popTxt = a1.popLog
ok(p1 - p0 === ch && ch === 6, 'a tap on the pile reserves exactly one tap\'s chunk (2% of 300 = 6 PP), as v137\'s press did', { before: p0, after: p1, chunk: ch })
ok(a1.lastKick >= 3 && a1.airborne >= 1, 'and it knocks REAL coins of the hoard into the air', { kicked: a1.lastKick, airborne: a1.airborne })
ok(a1.audio && a1.audio.taps > a0.audio.taps && a1.audio.played > a0.audio.played, 'with a clink — really voiced, not swallowed by the pour\'s own coin sound', a1.audio)
ok(popTxt.some(t => /^\+6\s*PP$/.test(t.trim())), 'and "+6 PP" pops off the finger', popTxt)
ok(a1.pulse > 0.3, 'and the pile lights up under the tap', { pulse: a1.pulse })
// a frame-starved headless box runs the physics slow (v137 caps a step at 34ms), so wait on the landing, not the clock
await page.waitForFunction((n) => { const d = window.__RIB_VAULT_DEV.v173(); return d.landed >= n && d.airborne === 0 }, a1.landed + a1.lastKick, { timeout: 6000, polling: 50 }).catch(() => {})
const a2 = await v173()
ok(a2.landed >= a1.landed + a1.lastKick && a2.airborne === 0, 'the coins come back DOWN onto the heap — they land (and ring), they do not hang', { landed: a2.landed, airborne: a2.airborne })
ok((await gamePP()).pp === g0.pp, 'and the tap is a reservation, never a debit — the game\'s PP has not moved', [g0.pp, (await gamePP()).pp])
// a press on the empty corner of the old box does nothing at all
const pc = (await st()).pending
await tapAt(geo.corner)
await page.waitForTimeout(80)
ok((await st()).pending === pc, 'a press off the pile (the old box\'s empty corner) reserves nothing', { before: pc, after: (await st()).pending })

// hover: the light follows a mouse over the money
await page.mouse.move(5, 300); await page.waitForTimeout(400)
const off0 = await v173()
await page.mouse.move(c0.x + 10, c0.y + 5); await page.mouse.move(c0.x + 12, c0.y + 6); await page.waitForTimeout(450)
const hov = await v173(), cur = await E(() => window.__RIB_VAULT_DEV.v.cv.style.cursor)
ok(hov.glow > off0.glow + 0.15 && hov.glow >= 0.35 && cur === 'pointer', 'a mouse over the pile lights it and says it can be pressed', { idle: off0.glow, hover: hov.glow, cursor: cur })

// ---------- 3. a hold is still the pour ----------
const hk0 = (await v173()).kicked, hp0 = (await st()).pending
await page.mouse.move(c0.x, c0.y); await page.mouse.down()
await page.waitForTimeout(1350)
const mid = await st(), hv = await v173()
await page.mouse.up()
await page.waitForTimeout(60)
const after = await st()
ok(mid.holding && mid.stage >= 1 && mid.pending - hp0 > ch, 'a HOLD on the pile still climbs the stages and pours past the first tap', { stage: mid.stage, poured: mid.pending - hp0 })
ok(hv.kicked - hk0 > 3 && hv.glow > 0.55, 'and keeps knocking coins loose under a brighter light while it pours', { kicked: hv.kicked - hk0, glow: hv.glow })
ok(!after.holding, 'and letting go stops it', after.holding)
ok((await gamePP()).pp === g0.pp, 'still no debit — a pour is a reservation until it is the whole price', (await gamePP()).pp)
await closeV()
ok((await gamePP()).pp === g0.pp && (await st()).pending === 0, 'and walking out drops the reservation', (await gamePP()).pp)

// ---------- 4. taps fund an upgrade: the quarter marks, then ONE purchase ----------
await setPP(2500)
await openV('gmEye')
const price = await E(() => window.__prestigeNodesV137().price('gmEye'))
const fb = await gamePP()
const c1 = await centre()
let taps = 0
for (; taps < 40; taps++) {
  if ((await st()).committed) break
  await tapAt(c1, 30); await page.waitForTimeout(170)
}
await page.waitForTimeout(300)
const fa = await gamePP(), fv = await st(), fm = await v173()
const unlocked = fm.popLog.some(t => /UNLOCKED/.test(t))
ok(fv.committed && taps === price, `${price} taps of 1 PP fund the ${price} PP node — one tap, one chunk, nothing skipped or doubled`, { taps, price })
ok(fa.pp === fb.pp - price && (fa.tree.gmEye || 0) === (fb.tree.gmEye || 0) + 1, 'and the purchase debits the price ONCE and grants ONE level', { before: fb.pp, after: fa.pp, lv: fa.tree.gmEye })
ok(fm.milestones === 3, 'the 25 / 50 / 75% marks each chimed once', fm.milestones)
ok(fm.shakes >= 4 && unlocked, 'and the room shook at each, and harder (with UNLOCKED) when it landed', { shakes: fm.shakes, unlocked })
ok(fm.audio && fm.audio.chimes >= 3, 'the chimes went through the vault\'s own sound', fm.audio)
await closeV()

// ---------- 5. the keyboard: Enter / Space is a tap, holding it is the hold ----------
await setPP(2500)
await openV(BIG)
const kc = await chunk()
await page.focus('#ribVault .rv-pile')
const lab = await E(() => document.activeElement && document.activeElement.getAttribute('aria-label'))
ok(/The Oracle/.test(lab || '') && /hold/i.test(lab || ''), 'the pile is a focusable button that names what it funds', lab)
let k0 = (await st()).pending
await page.keyboard.press('Enter'); await page.waitForTimeout(60)
let k1 = (await st()).pending
await page.keyboard.press(' '); await page.waitForTimeout(60)
let k2 = (await st()).pending
ok(k1 - k0 === kc && k2 - k1 === kc, 'Enter and Space are each ONE tap — one chunk each, never two', { enter: k1 - k0, space: k2 - k1, chunk: kc })
await page.keyboard.down('Enter'); await page.waitForTimeout(1500)
const kh = await st()
await page.keyboard.up('Enter'); await page.waitForTimeout(60)
const kr = await st()
ok(kh.holding && kh.stage >= 1 && kh.pending - k2 > kc && !kr.holding, 'holding Enter is the hold: it pours, and letting go stops it', { poured: kh.pending - k2, stage: kh.stage })
ok((await v173()).glow >= 0.35, 'and the focused pile is lit', (await v173()).glow)
await closeV()

// ---------- 6. reduced motion: the same money, no coins thrown, no shake ----------
await page.emulateMedia({ reducedMotion: 'reduce' })
await boot()
await setPP(2500)
await openV(BIG)
const rc = await centre(), rch = await chunk(), r0 = (await st()).pending
await tapAt(rc); await page.waitForTimeout(60)
const rv = await v173(), r1 = (await st()).pending
ok(r1 - r0 === rch && rv.lastKick === 0 && rv.taps === 1, 'under reduced motion a tap still reserves its chunk, and throws no coins', { d: r1 - r0, kicked: rv.lastKick })
await closeV()
await page.emulateMedia({ reducedMotion: 'no-preference' })

// ---------- 7. the kill switch: RIB_TUNE.v173pile = 0 is v137's box ----------
await boot()
await tune(0)
await setPP(2500)
await openV(BIG)
const o0 = await v173()
const oGeo = await E(() => { const V = window.__RIB_VAULT_DEV.v, s = V.scene, h = s.hoardBox()
  return { inlineTop: V.elTgt.style.top, btnHidden: V.elPile.hidden, glow: !!s.glowV173, corner: { x: h.x0 - 20, y: h.y0 - 12 }, mid: { x: (h.x0 + h.x1) / 2, y: (h.y0 + h.y1) / 2 } } })
ok(!o0.on && !o0.rootClass && oGeo.inlineTop === '' && oGeo.btnHidden && !oGeo.glow, 'OFF: no pile button, no light, the funding card back in its v137 place', { o0: { on: o0.on, cls: o0.rootClass }, oGeo })
const och = await chunk(), q0 = (await st()).pending
await tapAt(oGeo.mid); await page.waitForTimeout(60)
const q1 = (await st()).pending, ov = await v173()
ok(q1 - q0 === och && ov.taps === 0 && ov.kicked === 0, 'OFF: a press pours the same chunk, with none of v173 on top', { d: q1 - q0, chunk: och, v173: ov })
await tapAt(oGeo.corner); await page.waitForTimeout(60)
ok((await st()).pending - q1 === och, 'OFF: and the old BOX is the target again — its empty corner pours, as v137 did', { d: (await st()).pending - q1 })
await closeV()
await tune(null)

console.log('\npage errors:', errs.length ? errs.slice(0, 6) : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
