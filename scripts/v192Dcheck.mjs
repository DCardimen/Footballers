// Dev check: v192 D (public/rib-menu.js + rib-menu-v89.css, public/rib-vault.js + rib-vault.css).
//   1. EVEN TILES — every main-menu option is the same size, in one grid: 3 across on a phone (360 / 390 / 430 px),
//      6 across on a desktop; no label clipped, no sideways scroll. RIB_TUNE.v192D = 0 brings back the mixed layout
//      (the full-width HOW TO PLAY strip, the double-wide PROFILE).
//   2. THE HOLD FOLLOWS THE FINGER — in the Prestige Vault a hold that pours into an upgrade survives the finger
//      moving (touch and mouse): it keeps pouring and climbing the x2..x16 ramp, `touch` (the light, the kicks, the
//      pops) follows the finger, and off the pile the coins fly from the finger itself. Lifting ends it; a fully
//      funded hold buys through `window.buy` exactly once. With nothing to pour into a travelling press is still
//      v137 B's drag, and RIB_TUNE.v192D = 0 restores the 13 px drag for every press.
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v192Dcheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []

async function bootMenu (w, h, tune) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 700 })
  if (tune) await ctx.addInitScript((t) => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, t) }, tune)
  await ctx.addInitScript(() => { setInterval(() => { try { document.querySelector('.onboard')?.remove() } catch {} }, 60) })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
  await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('#rib-main-menu-v2 .rib9-tiles', { state: 'visible', timeout: 30000 })
  await page.waitForTimeout(600)
  return { ctx, page }
}
const measureTiles = (page) => page.evaluate(() => {
  const nav = document.querySelector('#rib-main-menu-v2 .rib9-tiles'), nr = nav.getBoundingClientRect()
  const tiles = [...nav.querySelectorAll(':scope > .rib9-tile')].map(t => {
    const r = t.getBoundingClientRect(), b = t.querySelector('b')
    return { label: (b && b.textContent || '').trim(), w: r.width, h: r.height, x: Math.round(r.left), y: Math.round(r.top), right: r.right,
      clipped: b ? b.scrollWidth > b.clientWidth + 1 : false }
  })
  return { even: nav.classList.contains('rib9-even-v192d'), tiles, cols: new Set(tiles.map(t => t.x)).size, navRight: nr.right,
    hscroll: document.documentElement.scrollWidth > window.innerWidth + 1 }
})

// ---------- 1. the menu: every option the same size ----------
for (const [w, h, cols] of [[360, 760, 3], [390, 844, 3], [430, 932, 3], [1280, 800, 6]]) {
  const { ctx, page } = await bootMenu(w, h)
  const m = await measureTiles(page)
  const ws = m.tiles.map(t => t.w), hs = m.tiles.map(t => t.h)
  const spreadW = Math.max(...ws) - Math.min(...ws), spreadH = Math.max(...hs) - Math.min(...hs)
  ok(m.even && m.tiles.length >= 12, `${w}px: the tiles carry the even grid (${m.tiles.length} options)`, { even: m.even, n: m.tiles.length })
  ok(spreadW <= 1 && spreadH <= 1, `${w}px: every option is the same size`, { w: [Math.min(...ws), Math.max(...ws)].map(Math.round), h: [Math.min(...hs), Math.max(...hs)].map(Math.round) })
  ok(m.cols === cols, `${w}px: ${cols} across`, { cols: m.cols })
  ok(!m.tiles.some(t => t.clipped) && !m.hscroll && m.tiles.every(t => t.right <= m.navRight + 1), `${w}px: no label clipped, nothing past the edge, no sideways scroll`,
    m.tiles.filter(t => t.clipped).map(t => t.label))
  ok(Math.min(...hs) >= 110, `${w}px: the tiles keep a thumb-sized height`, Math.round(Math.min(...hs)))
  await ctx.close()
}
{
  const { ctx, page } = await bootMenu(390, 844, { v192D: 0 })
  const m = await measureTiles(page)
  const guide = m.tiles.find(t => /HOW TO PLAY/.test(t.label)), card = m.tiles.find(t => /CAREER/.test(t.label))
  ok(!m.even && guide && guide.w > card.w * 2, 'RIB_TUNE.v192D = 0: the old mixed layout (the full-width guide strip) comes back', { even: m.even, guide: guide && Math.round(guide.w), tile: Math.round(card.w) })
  await ctx.close()
}

// ---------- 2. the vault: a hold you can steer ----------
const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, hasTouch: true })
await ctx.addInitScript(() => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { corePriceV179: 1, apexPriceV179: 1, impossiblePriceV179: 1, v191price: 0 }) })
const page = await ctx.newPage()
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
const E = (fn, a) => page.evaluate(fn, a)
await page.goto(gameUrl('?stayStale&noFilmV114'), { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(1500)
await E(() => { try { window.__splashDoneV94 && window.__splashDoneV94() } catch (e) {} })
await page.waitForFunction(() => { const s = document.getElementById('splash'); if (!s) return true
  const c = getComputedStyle(s); return c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0 }, null, { timeout: 25000 }).catch(() => {})
await E(() => { document.querySelectorAll('.onboard').forEach(e => e.remove())
  try { localStorage.setItem('rib.vaultDoor.v137', '1'); localStorage.setItem('rib.coachTour.v119', '0') } catch (e) {} })
const setPP = (pp) => E((pp) => { const o = window.__GRIDIRON_AUDIT__.getState()
  o.pp = pp; o.prestige = 40; window.__V156A && window.__V156A.seed(200); o.tree = {}; window.go('shop'); return o.pp }, pp)
const openV = async (key) => { await E((key) => window.__RIB_VAULT_BRIDGE.open(Object.assign({ skipDoor: true }, key ? { key } : {})), key || null); await page.waitForTimeout(700) }
const closeV = async () => { await E(() => window.__RIB_VAULT.close('test')); await page.waitForTimeout(200) }
const st = () => E(() => Object.assign(window.__RIB_VAULT_DEV.state(), { d: window.__RIB_VAULT_DEV.v192D() }))
const centre = () => E(() => window.__RIB_VAULT_DEV.v.pileCentreV173())
const tune = (v) => E((v) => { window.RIB_TUNE = window.RIB_TUNE || {}; if (v == null) delete window.RIB_TUNE.v192D; else window.RIB_TUNE.v192D = v }, v)
const cdp = await ctx.newCDPSession(page)
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] })
ok(await E(() => !!(window.__RIB_VAULT_DEV && window.__RIB_VAULT_DEV.v192D && window.__RIB_VAULT_DEV.v.steerV192D)), 'v192 D is mounted on the vault')

// a pricey node, so a few seconds of x16 pour does not fund it
await setPP(200000)
const BIG = await E(() => { const X = window.__GRIDIRON_AUDIT__, N = X.TREE_NODES
  const ks = Object.keys(N).filter(k => X.nodeCost(N[k]) >= 20000 && X.nodeCost(N[k]) <= 150000 && (!X.nodeUnlocked || X.nodeUnlocked(N[k])))
  ks.sort((a, b) => X.nodeCost(N[b]) - X.nodeCost(N[a])); return ks[0] || 'oracle' })
await openV(BIG)
ok(await E(() => { const s = window.__RIB_VAULT_DEV.state(); return !!s.target && s.target.cost >= 20000 }), 'the vault is open on a pricey upgrade', BIG)
// a TOUCH hold that wanders over the pile and then off it
const c = await centre()
await touch('touchStart', c.x, c.y)
await page.waitForTimeout(150)
const t0 = await st()
const path = []
for (let i = 1; i <= 12; i++) { const p = { x: Math.round(c.x + i * 6), y: Math.round(c.y - i * 3) }; path.push(p); await touch('touchMove', p.x, p.y); await page.waitForTimeout(30) }
await page.waitForTimeout(80)
const mid = await st()
ok(t0.holding && mid.holding && !mid.dragging && mid.d.steering, 'touch: the hold survives the finger sliding 70 px across the pile — still pouring, never a drag', { holding: mid.holding, dragging: mid.dragging, steering: mid.d.steering })
const last = path[path.length - 1]
ok(Math.abs(mid.d.touch.x - last.x) <= 16 && Math.abs(mid.d.touch.y - last.y) <= 16 /* the milestone shake scales the canvas 2.5% */, 'and the pour\'s point (light, kicks, pops) is where the finger is now', { touch: mid.d.touch, finger: last })
ok(mid.pending > t0.pending && mid.stage >= 1, 'it kept pouring and climbed the ramp while moving', { pending: [t0.pending, mid.pending], stage: mid.stage })
// off the pile: up toward the core, the coins leave from the finger
const off = await E(() => { const s = window.__RIB_VAULT_DEV.scene(), h = s.hoardBox(); return { x: (h.x0 + h.x1) / 2 - 40, y: Math.max(40, h.y0 - 120) } })
const offOnPile = await E((p) => window.__RIB_VAULT_DEV.scene().onPileV173(p.x, p.y), off)
// the x16 pour funds any upgrade in a few seconds (its rate is a share of the price) — hand most of the reservation
// back so the second leg of the same hold has room to pour (test only: a reservation is never a debit)
await E(() => { const V = window.__RIB_VAULT_DEV.v; V.pending = Math.min(V.pending, Math.round(V.target.cost * 0.05)); V.scene.setBalance(V.balance - V.pending, true) })
const mid2 = await st()
for (let i = 1; i <= 6; i++) { await touch('touchMove', Math.round(last.x + (off.x - last.x) * i / 6), Math.round(last.y + (off.y - last.y) * i / 6)); await page.waitForTimeout(25) }
await page.waitForTimeout(220)
const o1 = await st()
ok(!offOnPile && o1.holding && !o1.dragging && !o1.committed && o1.pending > mid2.pending, 'off the pile the hold still pours (pointer capture)', { offPile: !offOnPile, pending: [mid2.pending, o1.pending] })
ok(o1.d.fromFinger > 0 && o1.d.lastFly && Math.abs(o1.d.lastFly.x - off.x) <= 24 && Math.abs(o1.d.lastFly.y - off.y) <= 20, 'and the coins fly from the FINGER, not the pile', { fromFinger: o1.d.fromFinger, lastFly: o1.d.lastFly, finger: off })
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT })
await touch('touchEnd')
await page.waitForTimeout(120)
const o2 = await st()
ok(!o2.holding && !o2.d.steering, 'lifting the finger ends the hold', { holding: o2.holding })
const g0 = await E(() => window.__GRIDIRON_AUDIT__.getState().pp)
ok(g0 === 200000, 'and a hold is still a reservation — the game\'s PP has not moved', g0)
await closeV()

// a MOUSE hold that wanders, held until funded: the buy goes through window.buy once
await setPP(200000)
const cheap = await E(() => { const X = window.__GRIDIRON_AUDIT__, N = X.TREE_NODES; return ['lkLine', 'genetics', 'lkSkill'].find(k => N[k] && X.nodeCost(N[k]) <= 400) || 'lkLine' })
await E(() => { window.__buysV192D = 0; const b = window.buy; window.__origBuyV192D = b; window.buy = function () { window.__buysV192D++; return b.apply(this, arguments) } })
await openV(cheap)
const lv0 = await E((k) => (window.__GRIDIRON_AUDIT__.getState().tree || {})[k] || 0, cheap)
const c2 = await centre()
await page.mouse.move(c2.x, c2.y); await page.mouse.down()
for (let i = 1; i <= 30; i++) { await page.mouse.move(c2.x + Math.sin(i / 3) * 50, c2.y + Math.cos(i / 4) * 22); await page.waitForTimeout(60) }
const m1 = await st()
await page.waitForFunction(() => { const s = window.__RIB_VAULT_DEV.state(); return s.committed || !s.holding }, null, { timeout: 15000 }).catch(() => null)
await page.mouse.up(); await page.waitForTimeout(300)
const m2 = await st()
const buys = await E(() => window.__buysV192D)
const lv1 = await E((k) => (window.__GRIDIRON_AUDIT__.getState().tree || {})[k] || 0, cheap)
ok(m1.d.steers > 0 && !m2.dragging, 'mouse: a wandering hold is steered, never a drag', { steers: m1.d.steers, travel: m1.d.travel })
ok(m2.committed && buys === 1 && lv1 === lv0 + 1, 'held to full it buys ONCE, through window.buy', { node: cheap, committed: m2.committed, buys, lv: [lv0, lv1] })
await E(() => { if (window.__origBuyV192D) window.buy = window.__origBuyV192D })
await closeV()

// nothing to pour into: a travelling press is still v137 B's drag
await setPP(200000)
await openV(null)
const c3 = await centre()
await page.mouse.move(c3.x, c3.y); await page.mouse.down()
for (let i = 1; i <= 8; i++) { await page.mouse.move(c3.x + i * 6, c3.y - i * 6); await page.waitForTimeout(20) }
const n1 = await st()
await page.mouse.up(); await page.waitForTimeout(200)
ok(n1.dragging && !n1.holding, 'no upgrade picked: a press that travels still picks up a coin (v137 B)', { dragging: n1.dragging, holding: n1.holding })
await closeV()

// the kill switch
await tune(0)
await openV(BIG)
const c4 = await centre()
await page.mouse.move(c4.x, c4.y); await page.mouse.down()
for (let i = 1; i <= 8; i++) { await page.mouse.move(c4.x + i * 4, c4.y - i * 3); await page.waitForTimeout(20) }
const k1 = await st()
await page.mouse.up(); await page.waitForTimeout(200)
ok(k1.dragging && !k1.holding && !k1.d.on, 'RIB_TUNE.v192D = 0: the old 13 px drag ends the hold', { dragging: k1.dragging, holding: k1.holding })
await tune(null)
await closeV()

ok(errs.length === 0, 'no page errors', errs.slice(0, 5))
await browser.close()
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
process.exit(fail ? 1 : 0)
