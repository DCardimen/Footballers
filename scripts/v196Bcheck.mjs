// Dev check: v196 B THE MASCOT, SMALLER AND GROUNDED (src/35-mascots.js).
// The owner: "I want to keep the mascot smaller, and dont teleport him in the air by the jumbotron... keep on ground. His
// text bubbles are massive and distracting. Make like 70 percent smaller."
//   1. SMALLER: his on-screen scale is mascotScaleV196B / v194 B's 1.8 (~0.64) of TU v196B 0's
//   2. BUBBLES: the same line's box covers ≤ 40% of the old box's screen area (~70% smaller)
//   3. GROUNDED: a forced jumbotron pan (every whistle) never puts him on the bowl's deck (no `jumboV195B`, entered 0),
//      and TU v196B 0 (v195 B) still does; no page errors
// GAME_URL=http://localhost:5173/ node scripts/v196Bcheck.mjs
import { launch, gameUrl } from './lib/env.mjs'
const SHOTS = new URL('./', import.meta.url).pathname
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const info = (m, d) => console.log('info ' + m + (d !== undefined ? '  ' + JSON.stringify(d) : ''))
const errors = []
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114'
const MP_MS = +(process.env.V195B_MP_MS || 45000)
async function open (W, H, { tune = {}, tag = 'p' } = {}) {
  const context = await browser.newContext({ viewport: { width: W, height: H } })
  await context.addInitScript((tune) => {
    try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
    window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { mascotPreviewV193AI: 1 }, tune)
    setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove(); document.getElementById('growV132')?.remove() }, 60)
  }, tune)
  const p = await context.newPage(); p.on('pageerror', (e) => errors.push(tag + ': ' + (e.message || e)))
  await p.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
  await p.waitForFunction(() => window.__GRIDIRON_AUDIT__ && window.RIB_MASCOTS && window.__V195B && window.__V195B.api, null, { timeout: 60000 })
  await p.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  await p.waitForTimeout(900)
  return { p, context }
}
const E = (p, fn, arg) => p.evaluate(fn, arg)
async function goLive (p, { myPlays = false, pos = 'RB' } = {}) {
  await E(p, ({ myPlays, pos }) => { const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true
    S.player = A.newPlayer(); S.player.name = 'Test Man'; S.player.pos = pos; S.player.level = 4; S.settings = Object.assign(S.settings || {}, { myPlaysV156D: myPlays }); A.setState(S)
    try { window.startSeasonGames() } catch (e) {}
    const t = window.S.player; t.currentWeek = 0; const w = t.weekResults[0]
    window.S._liveGame = window.__simGameV2(w.perf, t.pos); window.S._oppName = w.opp; window.__homeGameV93 = true; window.go('live') }, { myPlays, pos })
  for (let i = 0; i < 120; i++) { if (await E(p, () => !!(window.__gridironScene && window.__gridironScene.side && window.__gridironScene.markers && window.__gridironScene.markers.length >= 12))) break; await p.waitForTimeout(250) }
  for (let i = 0; i < 80 && !(await E(p, () => window.RIB_MASCOTS.live().length)); i++) await p.waitForTimeout(250)
  await p.waitForTimeout(800)
}


const RAW = 'WE GOT THIS.| PROBABLY.| DEFINITELY... PROBABLY.'
const measure = (p, px) => E(p, async ({ RAW, px }) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const m = window.RIB_MASCOTS.v194b.mascot(), A = m.v194
  let b = null
  for (let i = 0; i < 40 && !b; i++) { A.bubble = null; A.sayAt = -1e9; window.__V195B.api.sayLine(RAW); await sleep(250); b = A.bubbleBox && A.bubbleBox.visible ? A.bubbleBox : null }
  // the bubble is held at a constant CSS size: its box in text units × (css px / 20)
  return { sc: Math.abs(m.img.scaleY), w0: b && b.__w, h0: b && b.__h, bw: b ? (b.__w * px) / 20 : null, bh: b ? (b.__h * px) / 20 : null }
}, { RAW, px })
// ================= 1-2. smaller, and the bubble =================
{
  const { p, context } = await open(390, 844, { tag: 'size' })
  await goLive(p)
  const ON = await measure(p, 6.5)
  try { await p.screenshot({ path: SHOTS + '_v196B_on.png' }) } catch {}
  await E(p, () => { window.RIB_TUNE.v196B = 0 }); await p.waitForTimeout(3500)
  const OFF = await measure(p, 12)
  await E(p, () => { window.RIB_TUNE.v196B = 1 })
  const k = ON.sc / OFF.sc, area = (ON.bw * ON.bh) / (OFF.bw * OFF.bh)
  ok(Math.abs(k - 1.15 / 1.8) < 0.04, 'he is drawn ~a third smaller (1.15 of v194 B\'s 1.8)', { k: +k.toFixed(3), on: ON, off: OFF })
  ok(area > 0.15 && area <= 0.33, 'the same line\'s bubble covers ~70% less of the screen', { area: +area.toFixed(3), on: [ON.bw, ON.bh], off: [OFF.bw, OFF.bh] })
  await context.close()
}
// ================= 3. grounded: no deck by the jumbotron =================
async function pan (tune) {
  const { p, context } = await open(390, 844, { tune: Object.assign({ screenPanChanceV175: 1, screenPanGapV175: 0 }, tune), tag: 'jumbo' })
  await goLive(p, { pos: 'WR' })
  let D = null
  for (let i = 0; i < 200 && !(D && (D.on || D.panned >= 600)); i++) {
    D = await E(p, (prev) => {
      const sc = window.__gridironScene, PN = sc && sc._panV175, m = window.RIB_MASCOTS.v194b.mascot(), A = m && m.v194
      const d = prev || { panned: 0, on: false }
      if (!A) return d
      if (!PN) { return d }
      d.panned += 1
      // his spot in the far corner, where the screen shot never looks (the case v195 B lifted him to the deck)
      if (!A.jumboV195B) { A.pos = { u: 5, w: -Math.abs(A.pos.w) }; A.tgt = { u: 5, w: A.pos.w, ez: true }; A.path = []; A.tgtAt = performance.now(); m.vis = false }
      d.on = d.on || !!A.jumboV195B; d.entered = window.__V195B.jumbo.entered
      return d
    }, D)
    if (!(D && D.on)) await p.waitForTimeout(100)
  }
  await context.close()
  return D
}
const G = await pan({})
ok(G && G.panned >= 20 && !G.on && !G.entered, 'a jumbotron pan never lifts him to the deck: he keeps to the ground', G)
const O = await pan({ v196B: 0 })
ok(O && O.on, 'TU v196B 0: v195 B\'s deck beside the screen', O)
ok(errors.length === 0, 'no page errors', errors.slice(0, 5))
console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
await browser.close()
process.exit(fail ? 1 : 0)
