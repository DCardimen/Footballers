// Dev check: v194 C — THE LIGHTS STAY UP / THE END-ZONE CAMERA / THE JUMBO WEARS THE JERSEY (src/05-field-renderer.js,
// src/28-cosmetics.js — the live broadcast).
//   LIGHTS: at the own 10, midfield and the opponent's 10 the four far masts stand ON the stadium's roof (v193 AG's skyline):
//        each lamp bank clears the skyline under its whole width, each pole's foot sits on the roof under it (never
//        floating, never down in the decks), the masts are drawn over the roof and their bloom and beam BEHIND the
//        stands (so no light crosses a spectator), a re-bake at the same line puts them on the same pixels, a held frame
//        never moves them, and they keep v164 A's field spot (their lateral fraction of the end line). With the kill
//        switch (TU v194Clights 0) the lamp banks hang down over the upper deck again — the bug, reproduced.
//   CAMERA: a kick framed while the men are still jogging from the last play (they stand at the 20, the kick is at the
//        far goal line — a field goal / the try after a touchdown, both ends): the frame never dives into the
//        foreground band (the biggest man on screen stays under 2.4x — the dive was 2.8-3.3x —, the frame's centre stays within the field's
//        anchoring), zoom and position are continuous frame to frame; a play from the 20 to the end line, both ends, keeps
//        the zoom in its band and continuous. The kill switch (TU v194Ccam 0) shows the old dive (INFO).
//   JUMBO: in a patterned uniform and a helmet, the board's celebrating body wears what the field's men wear — the
//        team's ("off") and HIS ("you") textures: the same palette, the helmet's shell and the uniform's stripes; the
//        opponent ("def"): the opponent's palette, never his gear; the hero's kit is the marker's own. Kill switch
//        TU v194Cjumbo 0: a teammate's board body loses the helmet and the stripes (the bug).
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v194Ccheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const info = (m, d) => console.log('INFO ' + m + (d !== undefined ? '  ' + JSON.stringify(d) : ''))
const errors = []
const ctx = await browser.newContext({ viewport: { width: 520, height: 900 } })
await ctx.addInitScript(() => {
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { dayNightV144: 0, wxV144: 0 })
  try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off'); localStorage.setItem('rib.sprayHint.v170', '1') } catch {}
  setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80)
})
const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e.message || e)))
await p.goto(U, { waitUntil: 'networkidle', timeout: 90000 })
await p.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V170, null, { timeout: 60000 })
await p.waitForTimeout(600); await p.evaluate(() => document.getElementById('splash')?.remove())
await p.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S)
  S.player = A.newPlayer(); const pl = S.player; pl.name = 'Test Man'; pl.pos = 'WR'; pl.age = 16; pl.originV11 = 'walk-on'; pl._wonShown = true; pl.level = 3
  for (const k in pl.attrs) pl.attrs[k] = 60; A.startSeasonGames(); window.go('season')
})
await p.waitForTimeout(400)
await p.evaluate(() => window.prepareWeek103(true)); await p.waitForTimeout(1200)
await p.evaluate(() => window.__v112SkipD())
const up = await p.waitForFunction(() => window.S && window.S.view === 'live' && window.__gridironScene && window.__FIELDMAP_V72 && window.__gridironScene.fieldSpr && window.__gridironScene.markers.length >= 20 && window.__gridironScene.stadium && window.__gridironScene.stadium.rect && window.__V193AG && window.__V193AG.stands, null, { timeout: 120000 }).then(() => true).catch(() => false)
ok(up, 'the live broadcast is up')
if (!up) { console.log(JSON.stringify({ pass, fail, pageErrors: errors.length })); await browser.close(); process.exit(1) }

// one real play's payload to replay (the live game's own, at 4x), then the live game is held
const got = await p.evaluate(async () => {
  const sc = window.__gridironScene, orig = sc.animatePlay, book = window.__playsV194C = []
  window.setSpeed(4)
  sc.animatePlay = function (et) { if (window.__holdV194C && !this.__oursV194C) return; const r = orig.apply(this, arguments); if (!this.__oursV194C && book.length < 2 && /^(run|pass|scramble|sack)$/.test(String(et && et.event))) book.push(structuredClone(et)); return r }   // a scrimmage play (a kick's payload carries its own camera keys)
  const t0 = performance.now()
  while (book.length < 1 && performance.now() - t0 < 200000) await new Promise(r => setTimeout(r, 250))
  window.__holdV194C = true
  await new Promise(r => setTimeout(r, 2500))
  return book.length
})
ok(got >= 1, 'a live play was captured to replay', got)

// ---------------- LIGHTS
const lights = (los, tune, fresh) => p.evaluate(({ los, tune, fresh }) => {
  Object.assign(window.RIB_TUNE, tune || {})
  const sc = window.__gridironScene, ST = sc.stadium
  if (fresh && window.__V194C && window.__V194C.lights && window.__V194C.lights.reset) window.__V194C.lights.reset()   // forget the halves' seats
  sc.drawField(los, los + 10)
  const L = window.__V194C && window.__V194C.lights, AG = window.__V193AG.stands
  const sky = L && L.skyline ? L.skyline() : []
  const skyMin = (x0, x1) => { let y = Infinity; for (let i = 0; i < sky.length - 1; i++) { const a = sky[i], b = sky[i + 1], lo = Math.max(x0, Math.min(a[0], b[0])), hi = Math.min(x1, Math.max(a[0], b[0])); if (lo > hi) continue; const at = (x) => Math.abs(b[0] - a[0]) < 1e-6 ? Math.min(a[1], b[1]) : a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); y = Math.min(y, at(lo), at(hi)) } return y }
  const T = (ST.towers || []).filter(t => t && t.scene && t.visible).sort((a, b) => a._bx - b._bx).map(t => {
    const w = t.displayWidth, h = t.displayHeight, x0 = t._bx - w / 2, face = t._face, P = face === 1 ? [82 / 128, 115 / 128] : [5 / 128, 38 / 128]
    return { x: Math.round(t._bx), foot: +t._by.toFixed(1), h: Math.round(h), head: +(t._by - h * 41 / 160).toFixed(1), sky: +skyMin(x0, x0 + w).toFixed(1), pole: +skyMin(x0 + w * P[0], x0 + w * P[1]).toFixed(1), depth: t.depth }
  })
  const rigs = (ST.lights || []).filter(R => R && R.glow && R.glow.scene && R.glow.visible).map(R => ({ glow: R.glow.depth, beam: R.beam.depth }))
  const half = sc.crowdProject(728, 426).x - 360
  return { los, seated: !!(L && L.masts && L.masts.length && L.masts.every(m => m.seated)), on: !!(L && L.on), standsOn: !!AG.on, standsDepth: AG.depth, crowd: window.RIB_TUNE.crowdDepth || 3.45, T, rigs, frac: T.map(t => +((t.x - 360) / half).toFixed(3)) }
}, { los, tune, fresh })
const geo = []
for (const los of [10, 50, 90]) geo.push(await lights(los, null, true))   // each the first snap of its half: the masts are seated on its roof
console.log('lights:', JSON.stringify(geo))
ok(geo.every(g => g.on && g.standsOn && g.seated && g.T.length === 4), 'LIGHTS: four far masts are seated on the stadium\'s roof at the own 10, midfield and the opponent\'s 10', geo.map(g => [g.on, g.standsOn, g.T.length]))
ok(geo.every(g => g.T.every(t => t.head <= t.sky + 1)), 'LIGHTS: every lamp bank clears the skyline under its whole width (nothing over the upper deck)', geo.map(g => g.T.map(t => t.head + '<=' + t.sky).join(' ')))
ok(geo.every(g => g.T.every(t => t.foot >= t.pole - 0.12 * t.h && t.foot <= t.pole + 0.08 * t.h)), 'LIGHTS: every pole\'s foot sits on the roof under it — not floating, not sunk into the decks', geo.map(g => g.T.map(t => t.foot + '~' + t.pole).join(' ')))
ok(geo.every(g => g.T.every(t => t.depth < g.standsDepth) && g.rigs.length === 4 && g.rigs.every(r => r.glow < g.standsDepth && r.beam < g.standsDepth)), 'LIGHTS: the masts, their bloom and their beam are drawn behind the stands — nothing of theirs ever crosses a spectator', geo.map(g => ({ stands: g.standsDepth, masts: g.T.map(t => t.depth), rigs: g.rigs })))
ok(geo.every(g => g.frac.every((v, i) => Math.abs(v - geo[0].frac[i]) < 0.06)), 'LIGHTS: each mast keeps its field spot (its lateral fraction of the end line) at every line — part of the stadium, not the screen', geo.map(g => g.frac))
{
  // the same half, snap after snap: the drive advances and the perspective re-anchors, the masts stay where they were seated
  const H = [await lights(20, null, true), await lights(25), await lights(33), await lights(41)]
  ok(H.every(g => JSON.stringify(g.T.map(t => [t.x, t.foot])) === JSON.stringify(H[0].T.map(t => [t.x, t.foot]))) && H[0].seated && !H[3].seated, 'LIGHTS: snap to snap from the same side the masts keep their spot (seated once, at the 20)', H.map(g => g.los + ':' + g.T.map(t => t.foot).join(',')))
  ok(H.every(g => g.T.every(t => t.depth < g.standsDepth)), 'LIGHTS: and as the roof rises past their feet the stands hide the poles — they read as standing on it', H.map(g => g.T.map(t => t.foot + '/' + t.pole).join(' ')))
  const O2 = await lights(70)
  ok(!O2.seated && JSON.stringify(O2.T.map(t => [t.x, t.foot])) === JSON.stringify(H[0].T.map(t => [t.x, t.foot])) && O2.T.every(t => t.depth < O2.standsDepth), 'LIGHTS: across midfield too (same end of the ground far): they stay put, behind the risen roof', O2.T.map(t => t.foot + '/' + t.pole))
  // a line BEHIND every line seen from this side: the roof drops below the held feet — they step down onto it, never float
  await lights(33, null, true); const B2 = await lights(18)
  ok(B2.T.every(t => t.head <= t.sky + 1 && t.foot >= t.pole - 0.12 * t.h), 'LIGHTS: a line behind every one seen from this side steps the masts DOWN onto the lower roof (they never float over sky)', B2.T.map(t => t.foot + '~' + t.pole))
  const S2 = await lights(76, null, true)
  ok(S2.seated && S2.T.every(t => t.head <= t.sky + 1), 'LIGHTS: seated afresh (a new side), they sit on that frame\'s roof', S2.T.map(t => t.foot + '~' + t.pole))
  const a = await lights(50, null, true), b = await lights(50)
  ok(JSON.stringify(a.T.map(t => [t.x, t.foot])) === JSON.stringify(b.T.map(t => [t.x, t.foot])), 'LIGHTS: a re-bake at the same line puts every mast on the same spot', [a.T.map(t => [t.x, t.foot]), b.T.map(t => [t.x, t.foot])])
  const held = await p.evaluate(async () => { const ST = window.__gridironScene.stadium, out = []
    for (let i = 0; i < 6; i++) { out.push(ST.towers.filter(t => t && t.visible).map(t => [Math.round(t._bx), Math.round(t._by), Math.round(t.y)]).join(';')); await new Promise(r => setTimeout(r, 250)) }
    return out })
  ok(new Set(held).size === 1, 'LIGHTS: frame to frame the masts stand still (the foot never moves)', held[0])
  const off = await lights(50, { v194Clights: 0 })
  ok(!off.on && off.T.length === 4 && off.T.some(t => t.head > t.sky + 4) && off.T.every(t => t.depth > off.standsDepth), 'KILL: TU v194Clights 0 — the lamp banks hang down over the upper deck again (the bug the owner saw)', off.T.map(t => t.head + ' vs ' + t.sky))
  await p.evaluate(() => { window.RIB_TUNE.v194Clights = 1 })
}

// ---------------- CAMERA
const kick = (off, ev, sb, from, tune) => p.evaluate(async ({ off, ev, sb, from, tune }) => {
  // the slow-motion cuts zoom in on purpose (a big hit, a cutback) — not what is measured here
  Object.assign(window.RIB_TUNE, { slomoV102: 0, v193Wslow: 0 }, tune || {})
  const sc = window.__gridironScene, et = structuredClone(window.__playsV194C[0])
  // the men stand where the last play left them (the 20), then the next play is at the goal line
  sc.play = null; try { sc.renderStatic({ offense: off, startBall: from, preToGo: 10 }) } catch (e) {}
  await new Promise(r => setTimeout(r, 300))
  et.offense = off; et.startBall = sb; et.preToGo = Math.min(10, 100 - sb); et.event = ev; if (ev === 'fg') et.made = true
  window.setSpeed(1)
  const rows = []
  await new Promise(res => {
    let done = false; const fin = () => { if (!done) { done = true; res() } }
    sc.__oursV194C = true; try { sc.animatePlay(et, fin) } catch (e) { fin() } sc.__oursV194C = false
    const t0 = performance.now(); let P0 = null
    const tick = () => {
      if (done) return
      const P = sc.play, c = sc.cameras.main, wv = c.worldView
      if (!P0 && P && P.script && performance.now() - t0 < 4000) P0 = P
      if (!P0) { if (performance.now() - t0 > 4000) setTimeout(fin, 100); else requestAnimationFrame(tick); return }
      if (!P || P !== P0 || P.done) { setTimeout(fin, 100); return }   // this play's frames only (the next state re-frames from scratch)
      let s = 0; for (const m of sc.markers) { if (!m || !m.root || !m.root.visible) continue; const x = m.root.x, y = m.root.y; if (x > wv.x && x < wv.x + wv.width && y > wv.y && y < wv.y + wv.height) s = Math.max(s, m.root.scaleY || m.root.scale) }
      rows.push({ z: c.zoom, y: c.midPoint.y, x: c.midPoint.x, s, snapped: !!(P && P.snapped) })
      if (!P || P.done || performance.now() - t0 > 9000) { setTimeout(fin, 100); return }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  let dz = 0, dy = 0; for (let i = 1; i < rows.length; i++) { dz = Math.max(dz, Math.abs(Math.log(rows[i].z / rows[i - 1].z))); if (!rows[i].snapped) dy = Math.max(dy, Math.abs(rows[i].y - rows[i - 1].y)) }
  const pre = rows.filter(r => !r.snapped)
  return { off, ev, sb, n: rows.length, pre: pre.length, sMax: +Math.max(0, ...rows.map(r => r.s)).toFixed(2), yMax: Math.round(Math.max(...rows.map(r => r.y))), zMin: +Math.min(...rows.map(r => r.z)).toFixed(3), zMax: +Math.max(...rows.map(r => r.z)).toFixed(3), dz: +dz.toFixed(3), dyPre: Math.round(dy), kicks: window.__V194C && window.__V194C.cam ? window.__V194C.cam.kickSpots : 0 }
}, { off, ev, sb, from, tune })
const K = []
for (const off of ['us', 'them']) for (const ev of ['fg', 'xp']) K.push(await kick(off, ev, ev === 'xp' ? 98 : 95, 20))
console.log('kicks:', JSON.stringify(K))
ok(K.every(r => r.n >= 5) && K.filter(r => r.pre > 3).length >= 3, 'CAMERA: a field goal and a try replayed at the far goal line, from both ends', K.map(r => [r.off, r.ev, r.n, r.pre]))
ok(K.every(r => r.sMax < 2.4), 'CAMERA: the frame never dives into the foreground band — the biggest man on screen stays under 2.4x (the men jog INTO a frame already on the kick; the dive was 2.8-3.3x)', K.map(r => r.off + ' ' + r.ev + ' ' + r.sMax))
ok(K.every(r => r.yMax < 1300), 'CAMERA: the frame\'s centre stays up the field with the kick, never in the foreground', K.map(r => r.off + ' ' + r.ev + ' ' + r.yMax))
ok(K.every(r => r.dz < 0.08 && r.dyPre < 90), 'CAMERA: zoom and position are continuous frame to frame through the glide in', K.map(r => [r.dz, r.dyPre]))
ok(K[K.length - 1].kicks > 0, 'CAMERA: the glide frames the kicker\'s own spot (the hook counts it)', K[K.length - 1].kicks)
{
  const O = await kick('us', 'fg', 95, 20, { v194Ccam: 0 })
  info('KILL: TU v194Ccam 0 — the same field goal framed on the jogging kicker', { sMax: O.sMax, yMax: O.yMax, on: { sMax: K[0].sMax, yMax: K[0].yMax } })
  await p.evaluate(() => { window.RIB_TUNE.v194Ccam = 1 })
}
const R = []
for (const off of ['us', 'them']) for (const sb of [80, 90, 95, 99]) R.push(await kick(off, 'run', sb, sb))
console.log('runs:', JSON.stringify(R))
ok(R.every(r => r.zMin >= 0.6 && r.zMax <= 1.4 && r.dz < 0.09), 'CAMERA: from the 20 to the end line, both ends, the zoom stays in its band and continuous', R.map(r => [r.off, r.sb, r.zMin, r.zMax, r.dz]))
ok(R.every(r => r.sMax < 2.4), 'CAMERA: and no man on screen is blown up past 2.4x near either goal line', R.map(r => r.off + r.sb + ' ' + r.sMax))

await p.evaluate(() => { delete window.RIB_TUNE.slomoV102; delete window.RIB_TUNE.v193Wslow })

// ---------------- JUMBO
await p.evaluate(async () => { const BC = window.RIB_COSMETICS.boardCel; BC.load(); await new Promise((r) => { const t0 = Date.now(); const w = () => (BC.ready() || Date.now() - t0 > 15000) ? r() : setTimeout(w, 100); w() }) })
const eq = await p.evaluate(() => { const CO = window.RIB_COSMETICS, out = []
  for (const [s, id] of [['uniform', 'uni_cream_stripes'], ['helmet', 'hel_matte_black']]) { try { CO.grant(id, 'test') } catch (x) {} out.push(CO.equip(s, id)) }
  try { window.__COS_FIELD_V151B.resync(window.__gridironScene) } catch (x) {} return out })
await p.waitForTimeout(1500)
const board = (kit, tune) => p.evaluate(async ({ kit, tune }) => {
  Object.assign(window.RIB_TUNE, tune || {})
  const sc = window.__gridironScene, V = window.__V177C
  V.play('touchdown', { hero: { idx: -1, you: kit === 'you', kit, name: 'TEST', tone: 1 }, tok: 'v194C' + kit })
  await new Promise(r => setTimeout(r, 500))
  const st = V.state(), key = st.body && st.body.key, PT = sc._partyV177C
  const tex = (PT && PT.tex && PT.tex.keys && PT.tex.keys[0]) || key
  // how a frame dresses: the helmet's dark shell in the top rows, the stripes' maroon across the chest
  const read = (k) => {
    if (!k || !sc.textures.exists(k)) return null
    const src = sc.textures.get(k).getSourceImage(), cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height
    const x = cv.getContext('2d'); x.drawImage(src, 0, 0); const d = x.getImageData(0, 0, cv.width, cv.height).data
    let y0 = 1e9, y1 = -1; for (let y = 0; y < cv.height; y++) for (let xx = 0; xx < cv.width; xx++) if (d[(y * cv.width + xx) * 4 + 3] > 200) { y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
    const H = y1 - y0 + 1; let hn = 0, hd = 0, tn = 0, tm = 0
    for (let y = y0; y <= y1; y++) for (let xx = 0; xx < cv.width; xx++) { const i = (y * cv.width + xx) * 4; if (d[i + 3] <= 200) continue; const f = (y - y0) / H, r = d[i], g = d[i + 1], b = d[i + 2]
      if (f < 0.16) { hn++; if (Math.max(r, g, b) < 60) hd++ }
      if (f > 0.3 && f < 0.55) { tn++; if (r > 60 && r > 2.2 * g && r > 1.6 * b) tm++ } }
    return { helmDark: +(hd / Math.max(1, hn)).toFixed(3), chestTrim: +(tm / Math.max(1, tn)).toFixed(3) }
  }
  const out = { kit, tex, board: read(tex), field: read('spr_' + kit + '_dn_idle'), last: window.__V194C && window.__V194C.jumbo ? window.__V194C.jumbo.last : null, field2: window.__V159A_FIELD.teams()[kit], state: st.state }
  try { sc.partyEndV177C('replaced') } catch (e) {}
  return out
}, { kit, tune })
const J = {}
for (const kit of ['off', 'you', 'def']) J[kit] = await board(kit)
console.log('jumbo:', JSON.stringify({ eq, J }))
ok(eq.every(Boolean), 'JUMBO: a striped uniform and a matte-black helmet are equipped', eq)
ok(['off', 'you', 'def'].every(k => J[k].state === 'board' && J[k].board && J[k].field && J[k].last && J[k].last.kit === k), 'JUMBO: the board plays a celebrating body for our team, for him and for the opponent', ['off', 'you', 'def'].map(k => [k, J[k].state, !!J[k].board, J[k].last && J[k].last.kit]))
ok(['off', 'you', 'def'].every(k => J[k].last.p1 === J[k].field2[0] && J[k].last.p2 === J[k].field2[1]), 'JUMBO: each body is recoloured in its team\'s field palette (home and away alike)', ['off', 'you', 'def'].map(k => [k, J[k].last.p1, J[k].last.p2, J[k].field2]))
ok(['off', 'you'].every(k => J[k].field.helmDark > 0.25 && J[k].board.helmDark > 0.25), 'JUMBO: our team\'s and his board bodies wear the helmet the field\'s men wear', ['off', 'you'].map(k => [k, J[k].board.helmDark, J[k].field.helmDark]))
ok(['off', 'you'].every(k => J[k].field.chestTrim > 0.05 && J[k].board.chestTrim > 0.05), 'JUMBO: and the uniform\'s stripes, as on the field', ['off', 'you'].map(k => [k, J[k].board.chestTrim, J[k].field.chestTrim]))
ok(J.def.last.helmet == null && J.def.last.pattern == null && !J.def.last.dressed, 'JUMBO: the opponent wears his own kit on the board, as on the field — never our gear', { last: J.def.last, board: J.def.board, field: J.def.field })
const hero = await p.evaluate(() => { const sc = window.__gridironScene, out = []
  sc.markers.forEach((m, i) => { if (!m || !m.root) return; const h = sc.partyHeroV177C('touchdown', { _heroV177C: { idx: i, kind: 'touchdown' } }); out.push([i, m.team, m.kit, h.kit]) })
  return out })
ok(hero.length >= 20 && hero.every(([i, team, kit, hk]) => hk === (team === 'you' ? 'you' : kit)), 'JUMBO: the hero on the board wears his own marker\'s kit (the side with the ball does not decide it)', hero.filter(h => h[3] !== (h[1] === 'you' ? 'you' : h[2])).slice(0, 4))
{
  const O = await board('off', { v194Cjumbo: 0 })
  ok(O.board && (O.board.helmDark < 0.25 || O.board.chestTrim < 0.05), 'KILL: TU v194Cjumbo 0 — a teammate\'s board body loses the helmet / the stripes the field shows (the bug)', O.board)
  await p.evaluate(() => { window.RIB_TUNE.v194Cjumbo = 1 })
}

ok(errors.length === 0, 'no page errors', errors.slice(0, 3))
console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
