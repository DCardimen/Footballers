// Dev check: v177 D THE RIM IS A CLEAN LINE (src/05-field-renderer.js, `rimV177D` after buildCrowd).
//   The top of the stands was whatever the crowd strip's top rows left after v57's per-slice sweep: a sawtooth up the
//   sidelines and a row of notches across the far bowl. Now one parapet runs round the whole bowl. On a live game, with the
//   line of scrimmage on the own 10, at midfield and on the opponent's 10 (the bowl re-projects every snap):
//     1. the rim is ONE chain round the bowl (left sideline → the far end → right sideline), with no gap between samples;
//     2. it is SMOOTH: the turn between consecutive segments of its top edge stays small everywhere (no step, no notch),
//        and its top edge's second differences are a fraction of the raw crowd skyline's;
//     3. it COVERS the ragged edge: the crowd sections' own topmost opaque pixels (read off their canvases) lie inside the
//        band (between its top and bottom edges) — the jag is under the fascia, not above it;
//     4. it sits just over the crowd and under the bowl's base band; TU v177Drim 0 draws nothing. No page errors.
//   Screenshots: scripts/_rim_<on|off>_<los>.png.   GAME_URL=… node scripts/rimcheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
async function open (tune, tag) {
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
  await p.waitForFunction(() => window.S && window.S.view === 'live' && window.__gridironScene && window.__gridironScene.crowd && window.__gridironScene.crowd.built && window.__FIELDMAP_V72, null, { timeout: 60000 }).catch(() => null)
  await p.waitForTimeout(1500)
  await p.evaluate(() => window.__gridironScene.scene.pause())
  return { ctx, p }
}
const lay = (p, a) => p.evaluate((a) => {
  const sc = window.__gridironScene, M = window.__FIELDMAP_V72
  const vd = M.pj(M.PLAY_R, 220).y < M.pj(M.PLAY_L, 220).y ? 1 : -1, fyd = (x) => vd > 0 ? x : 100 - x
  sc._fieldKeyV162A = null; sc.drawField(fyd(a), fyd(Math.min(100, a + 10))); sc._camSoftV109 = 0; sc.resetCamera()
  const C = sc.crowd, R = window.__V177D && window.__V177D.rim ? window.__V177D.rim() : null
  // the crowd's own skyline: each section's topmost opaque pixel per column, in world px
  const sky = []
  for (let i = 0; i < C.built; i++) {
    const s = C.secs[i], cv = s.cv && s.cv.idle; if (!cv) continue
    const w = Math.min(cv.width, Math.ceil(s.bw)), h = Math.min(cv.height, Math.ceil(s.bh)); if (w < 2 || h < 2) continue
    const d = cv.getContext('2d').getImageData(0, 0, w, h).data, col = []
    for (let x = 1; x < w - 1; x += 2) { let y = -1; for (let yy = 0; yy < h; yy++) if (d[(yy * w + x) * 4 + 3] > 100) { y = yy; break } if (y >= 0) col.push([s.bx + x, s.by + y]) }
    sky.push(col)
  }
  const g = C.rimG
  return { a, R, sky, depth: g ? g.depth : null, vis: !!(g && g.visible), crowd: TU('crowdDepth', 3.45), trim: C.trimG ? C.trimG.depth : null, cmds: g && g.commandBuffer ? g.commandBuffer.length : 0 }
  function TU (k, d) { const T = window.RIB_TUNE || {}; return T[k] != null ? T[k] : d }
}, a)
const shot = async (p, name) => { try { const box = await p.evaluate(() => { const r = window.__gridironScene.game.canvas.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }); await p.screenshot({ path: `scripts/_rim_${name}.png`, clip: box }) } catch (e) {} }

// point in the band's quad j (top_j, top_j+1, bot_j+1, bot_j)
const inQuad = (P, q) => { let c = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) { const [xi, yi] = q[i], [xj, yj] = q[j]; if ((yi > P[1]) !== (yj > P[1]) && P[0] < (xj - xi) * (P[1] - yi) / (yj - yi) + xi) c = !c } return c }
const rough = (pts) => { let s = 0, n = 0; for (let i = 1; i < pts.length - 1; i++) { const dx1 = pts[i][0] - pts[i - 1][0], dx2 = pts[i + 1][0] - pts[i][0]; if (dx1 <= 0 || dx2 <= 0 || dx1 > 6 || dx2 > 6) continue; s += Math.abs((pts[i + 1][1] - pts[i][1]) / dx2 - (pts[i][1] - pts[i - 1][1]) / dx1); n++ } return n ? s / n : 0 }
const yAt = (poly, x) => { for (let i = 0; i < poly.length - 1; i++) { const a = poly[i], b = poly[i + 1]; if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]) } return null }

{
  const { ctx, p } = await open({}, 'on')
  for (const a of [10, 50, 90]) {
    const r = await lay(p, a)
    await p.waitForTimeout(200); await shot(p, 'on_' + a)
    const R = r.R
    ok(!!R && R.visible && R.n >= 100, `own ${a}: one rim chain round the bowl`, R && { n: R.n, h: R.h })
    if (!R) continue
    // what a camera can show: the world's width and a follow cam's reach past either side
    const IN = (x) => x > -200 && x < 920
    let gap = 0; for (let i = 1; i < R.top.length; i++) if (IN(R.top[i][0]) || IN(R.top[i - 1][0])) gap = Math.max(gap, Math.hypot(R.top[i][0] - R.top[i - 1][0], R.top[i][1] - R.top[i - 1][1]) / Math.max(1, R.h / 4))
    ok(gap < 25, `own ${a}: no gap along it (segment length over the band's height)`, { maxSeg: +gap.toFixed(1) })
    let turn = 0; for (let i = 1; i < R.top.length - 1; i++) { if (!IN(R.top[i][0])) continue; const A = Math.atan2(R.top[i][1] - R.top[i - 1][1], R.top[i][0] - R.top[i - 1][0]), B = Math.atan2(R.top[i + 1][1] - R.top[i][1], R.top[i + 1][0] - R.top[i][0]); let d = Math.abs(B - A); if (d > Math.PI) d = 2 * Math.PI - d; turn = Math.max(turn, d) }
    ok(turn < 0.45, `own ${a}: its top edge turns smoothly where a camera can see it (no step or notch)`, { maxTurnRad: +turn.toFixed(3), chainMax: R.maxTurn })
    // coverage: the crowd's own topmost pixels are inside the band
    const quads = []; for (let j = 0; j < R.top.length - 1; j++) quads.push([R.top[j], R.top[j + 1], R.bot[j + 1], R.bot[j]])
    let inside = 0, above = 0, total = 0
    for (const col of r.sky) for (const P of col) { if (!IN(P[0])) continue; total++; let hit = false; for (const q of quads) if (inQuad(P, q)) { hit = true; break } if (hit) inside++; else { const yt = yAt(R.top, P[0]); if (yt != null && P[1] < yt - 1.5) above++ } }
    ok(total > 50 && inside / total >= 0.85 && above / total <= 0.01, `own ${a}: the crowd's ragged top lies under the fascia`, { samples: total, inside: +(inside / total).toFixed(3), poking: +(above / total).toFixed(3) })
    // smoothness against the raw skyline, section by section
    const rawR = r.sky.map(rough).filter((v) => v > 0), raw = rawR.reduce((s, v) => s + v, 0) / Math.max(1, rawR.length)
    const rimPts = r.sky.map((col) => col.map((P) => [P[0], yAt(R.top, P[0])]).filter((q) => q[1] != null)).map(rough).filter((v) => v > 0), rim = rimPts.reduce((s, v) => s + v, 0) / Math.max(1, rimPts.length)
    ok(rim < raw * 0.35, `own ${a}: the skyline is a clean line — its slope wanders a fraction of the raw crowd edge's`, { raw: +raw.toFixed(3), rim: +rim.toFixed(3) })
    ok(r.vis && r.depth > r.crowd + 0.005 && (r.trim == null || r.depth < r.trim), `own ${a}: drawn over both crowd poses, under the bowl's base band`, { rim: r.depth, crowd: r.crowd, trim: r.trim })
  }
  await ctx.close()
}
{
  const { ctx, p } = await open({ v177Drim: 0 }, 'off')
  const r = await lay(p, 50)
  await p.waitForTimeout(200); await shot(p, 'off_50')
  ok(r.cmds === 0 && (!r.R || r.R === null || !r.R.n), 'TU v177Drim 0: no rim drawn (the v57 skyline as before)', { cmds: r.cmds })
  await ctx.close()
}
ok(errors.length === 0, 'no page errors', errors.slice(0, 4))
console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
await browser.close()
process.exit(fail ? 1 : 0)
