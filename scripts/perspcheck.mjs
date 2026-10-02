// Dev check: v177 E THE FAR END HOLDS ITS SHAPE (src/05-field-renderer.js, buildPersp / warpField).
//   v148 paid for the warp canvas with the ground behind the anchor: past ~33 yards behind the line it RECEDED toward the
//   viewer (rows and widths shrinking down the screen), harder the further north the drive was — a frame that looks back
//   down the field (a return, a wide shot) showed the touchlines pinching in at the bottom. Now the world grows instead.
//   Drives a live game, freezes the scene, re-lays the field with the line of scrimmage on the own 10 … the opponent's 1,
//   and frames a WIDE camera on the line and 20 / 40 / 60 yards behind it (where a return would take it). At the frame's
//   bottom row and its middle row it measures the field's width (touchline to touchline) and the screen height of ten
//   yards, and asserts:
//     1. no taper runs at any line of scrimmage, and the world (camera bounds, warp canvas) is tall enough for the field;
//     2. the PERSPECTIVE IS THE SAME WHEREVER THE LINE IS: for each camera offset, bottom/middle width and spacing ratios
//        match the own-30 reference within 3% (frames that run off the painted field at the near end are skipped);
//     3. nothing in front of the line moved: the LOS row's yard density and width are identical at every line (v148);
//     4. KILL=1 (TU v177E 0) shows the old failure: the taper, and a bottom narrower than the middle (ratio < 0.8).
//   Screenshots: scripts/_persp_<on|off>_a90_back40.png.   GAME_URL=… node scripts/perspcheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const LOS = [10, 30, 50, 70, 90, 99], BACK = [0, 20, 40, 60]
async function measure (tune, tag) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } })
  await ctx.addInitScript((tune) => {
    window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { dayNightV144: 0, wxV144: 0 }, tune || {})
    try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off'); localStorage.setItem('rib.sprayHint.v170', '1') } catch {}
    setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80)
  }, tune || {})
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(tag + ': ' + (e.message || e)))
  await p.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
  await p.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V170, null, { timeout: 40000 })
  await p.waitForTimeout(600); await p.evaluate(() => document.getElementById('splash')?.remove())
  await p.evaluate(() => {
    const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S)
    S.player = A.newPlayer(); const pl = S.player; pl.name = 'Test Man'; pl.pos = 'WR'; pl.age = 16; pl.originV11 = 'walk-on'; pl._wonShown = true; pl.level = 3
    for (const k in pl.attrs) pl.attrs[k] = 60; A.startSeasonGames(); window.go('season')
  })
  await p.waitForTimeout(400)
  await p.evaluate(() => window.prepareWeek103(true)); await p.waitForTimeout(1200)
  await p.evaluate(() => window.__v112SkipD())
  await p.waitForFunction(() => window.S && window.S.view === 'live' && window.__gridironScene && window.__FIELDMAP_V72 && window.__gridironScene.fieldSpr, null, { timeout: 60000 }).catch(() => null)
  await p.waitForTimeout(1500)
  await p.evaluate(() => window.__gridironScene.scene.pause())
  const rows = []
  for (const a of LOS) for (const back of BACK) {
    rows.push(await p.evaluate(({ a, back }) => {
      const sc = window.__gridironScene, M = window.__FIELDMAP_V72
      const vd = M.pj(M.PLAY_R, 220).y < M.pj(M.PLAY_L, 220).y ? 1 : -1
      const fyd = (x) => vd > 0 ? x : 100 - x, fx = (y) => M.PLAY_L + fyd(y) / 100 * (M.PLAY_R - M.PLAY_L)
      sc.drawField(fyd(a), fyd(Math.min(100, a + 10)))
      const c = sc.cameras.main, at = M.pj(fx(a - back), 220)
      c.setZoom(0.62); c.centerOn(360, at.y - 60); if (c.preRender) c.preRender()
      const wv = c.worldView, H = c.height
      const pts = []; for (let y = -12; y <= 112; y += 0.25) { const P = M.pj(fx(y), 220), L = M.pj(fx(y), 20), R = M.pj(fx(y), 420); pts.push({ y, sy: (P.y - wv.y) * c.zoom, w: (R.x - L.x) * c.zoom }) }
      const near = (sy) => pts.reduce((b, q) => Math.abs(q.sy - sy) < Math.abs(b.sy - sy) ? q : b)
      const span = (yd) => Math.abs(M.pj(fx(yd - 5), 220).y - M.pj(fx(yd + 5), 220).y) * c.zoom
      const bot = near(H - 4), mid = near(H / 2), los = { ten: +span(a + 5).toFixed(2), w: +((M.pj(fx(a), 420).x - M.pj(fx(a), 20).x) * c.zoom).toFixed(2) }
      const E = window.__V177E || {}, b = c._bounds
      return { a, back, worldH: E.worldH || 2800, need: E.need || null, taper: !!(window.__V148 || {}).taper, bounds: b ? b.height : null, canvasH: sc._warpCv ? sc._warpCv.height : null,
        lastRow: (window.__V148 || {}).lastRow, bot: { yd: bot.y, w: bot.w, ten: span(bot.y) }, mid: { yd: mid.y, w: mid.w, ten: span(mid.y) },
        clamped: Math.abs(c.midPoint.y - (at.y - 60)) > 2, wR: +(bot.w / mid.w).toFixed(4), tR: +(span(bot.y) / span(mid.y)).toFixed(4), los }
    }, { a, back }))
    if (a === 90 && back === 40) { await p.waitForTimeout(200); try { const box = await p.evaluate(() => { const r = window.__gridironScene.game.canvas.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }); await p.screenshot({ path: `scripts/_persp_${tag}_a90_back40.png`, clip: box }) } catch (e) {} }
  }
  await ctx.close()
  return rows
}

const KILL = !!process.env.KILL
const ON = await measure(KILL ? { v177E: 0 } : {}, KILL ? 'off' : 'on')
const OFF = KILL ? ON : await measure({ v177E: 0 }, 'off')
const onField = (r) => r.bot.yd > 0.5 && r.mid.yd > 0.5 && !r.clamped   // the frame is on the painted field (the near end of the world is its own edge) and not stopped by the world's top
const table = (R) => R.map((r) => `${r.a}/${r.back}: w ${r.wR} ten ${r.tR}${r.taper ? ' TAPER' : ''}${onField(r) ? '' : ' (off the field)'}`).join(' · ')
console.log('on : ' + table(ON)); if (!KILL) console.log('off: ' + table(OFF))

// 1. no taper; the world holds the field
ok(ON.every((r) => !r.taper), 'no taper at any line of scrimmage (the ground behind the line keeps its scale)', ON.filter((r) => r.taper).map((r) => r.a))
ok(ON.every((r) => r.bounds === r.worldH && r.canvasH >= r.worldH && r.lastRow < r.worldH), 'the world (camera bounds, warp canvas) is tall enough for the whole field', ON.filter((r) => r.back === 0).map((r) => ({ a: r.a, worldH: r.worldH, bounds: r.bounds, canvas: r.canvasH, lastRow: r.lastRow })))
// 2. the same perspective wherever the line is
const ref = {}; for (const r of ON) if (onField(r) && !ref[r.back]) ref[r.back] = r   // the southmost line whose frame is on the field
for (const back of BACK) {
  const R0 = ref[back]; if (!R0) continue
  const cmp = ON.filter((r) => r.back === back && onField(r))
  const bad = cmp.filter((r) => Math.abs(r.wR / R0.wR - 1) > 0.03 || Math.abs(r.tR / R0.tR - 1) > 0.03)
  ok(cmp.length >= 2 && bad.length === 0, `camera ${back} yards behind the line: bottom/middle width and ten-yard ratios match at every line (ref own ${R0.a}: w ${R0.wR}, ten ${R0.tR})`, bad.map((r) => ({ a: r.a, wR: r.wR, tR: r.tR })))
}
// 3. in front of the line, nothing moved
const L0 = ON.find((r) => r.a === 10 && r.back === 0).los
ok(ON.filter((r) => r.back === 0).every((r) => Math.abs(r.los.ten - L0.ten) < 0.05 && Math.abs(r.los.w - L0.w) < 0.05), 'the LOS row keeps the same yard density and width at every line of scrimmage', ON.filter((r) => r.back === 0).map((r) => r.los))
if (!KILL) {
  const same = ON.every((r, i) => r.back !== 0 || (Math.abs(r.wR - OFF[i].wR) < 0.002 && Math.abs(r.tR - OFF[i].tR) < 0.002))
  ok(same, 'the frame on the line is exactly the frame v148 drew (the change is only behind it)')
  // 4. the old failure, for the record
  const o = OFF.find((r) => r.a === 90 && r.back === 40), n = ON.find((r) => r.a === 90 && r.back === 40)
  ok(o.taper && o.wR < 0.8 && n.wR > 0.97, 'TU v177E 0 (v148): the taper pinches the bottom of a frame 40 yards behind the line on the opponent 10; now it holds', { off: { wR: o.wR, tR: o.tR }, on: { wR: n.wR, tR: n.tR } })
}
ok(errors.length === 0, 'no page errors', errors.slice(0, 4))
console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
await browser.close()
process.exit(fail ? 1 : 0)
