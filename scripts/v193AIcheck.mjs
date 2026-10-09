// Dev check: v193 AI THE MASCOTS DANCE (src/35-mascots.js; one call from src/05's updateSideline; src/28's MASCOTS
// slot and previewInto branch). The owner: "Add dancing mascots for every single team logo … unlockable with the
// membership … the same celebrations as the players, but dressed as a knight, animal, etc."
//   1. every team has a mascot: all 90 crests map to one of the 16 archetypes (each archetype used), and every name the
//      game builds — school sides (town + mascot), colleges, the fifty UFF / Interstellar clubs, the combine — resolves
//      to a crest and so to a costume; the name's animal or figure is the costume (Knights → knight, Grizzlies → bear …);
//      every sheet builds every pose without an error
//   2. the membership, store OFF (as shipped): "Team Mascots" is a member look — listed, locked "🔒 Membership" in the
//      Locker's MASCOTS row (its preview still dances), never owned / granted / equipped; nothing on this path calls
//      RIB_MONETIZE; no store key or node; and the live broadcast draws NO mascot (the hook runs and stands down)
//   3. TU mascotPreviewV193AI 1: a mascot on each bench in the live broadcast (its crest's costume, drawn, idle-bouncing);
//      a touchdown's celebrateSeq starts the scorer's team's mascot on the drawn cheer cycle at celebrateFrameMs; HIS drawn
//      body (v161 A backflip) is mirrored pose for pose (the tuck, the spin); the opponent's score moves the other bench
//   4. the season hero shows his mascot beside his crest; the Interstellar League puts a bubble on every mascot
//   5. TU v193AI 0: no mascots anywhere (the sprites go, the card goes); back on, they return
//   6. the membership, store ON (the owner's EXPERIENCE preview = member): owned, equips, drawn in the broadcast without
//      the preview tune; F2P (store ON, no membership): locked, not drawn
//   7. the cost: the per-frame update and the sheet builds, measured; no page errors
// Screenshots (MASCOT_SHOTS, default $SHOTS): mascots_sheet.png (all 90 crests), mascots_archetypes.png (the 16 dancing),
// mascot_live_390.png / mascot_live_1280.png, mascot_locker.png, mascot_card.png.
//   GAME_URL=http://localhost:9701/ node scripts/v193AIcheck.mjs
import fs from 'node:fs'
import { launch, gameUrl } from './lib/env.mjs'
const SHOTS = process.env.MASCOT_SHOTS || process.env.SHOTS || '/tmp/claude-0/shots/'
try { fs.mkdirSync(SHOTS, { recursive: true }) } catch {}
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const url = gameUrl('index.html')
const U = (...q) => url + (url.includes('?') ? '&' : '?') + ['stayStale', 'noFilmV114'].concat(q).join('&')
const savePng = (name, dataUrl) => { try { fs.writeFileSync(SHOTS + name, Buffer.from(String(dataUrl).split(',')[1], 'base64')) } catch {} }
async function open (W, H, { exp = null, preview = 0, tag = 'p', benches = 0 } = {}) {
  const context = await browser.newContext({ viewport: { width: W, height: H } })
  await context.addInitScript(({ preview, benches }) => {
    if (benches) window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v194B: 0 })   // v194 B's kill switch: v193 AI's two benches
    try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
    if (preview) window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { mascotPreviewV193AI: 1 })
    setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove(); document.getElementById('growV132')?.remove() }, 60)
  }, { preview, benches })
  const p = await context.newPage(); p.on('pageerror', (e) => errors.push(tag + ': ' + (e.message || e)))
  await p.goto(U(), { waitUntil: 'networkidle', timeout: 60000 })
  await p.evaluate((exp) => { if (exp) localStorage.setItem('rib.experience.v158', exp); else localStorage.removeItem('rib.experience.v158') }, exp)
  await p.reload({ waitUntil: 'networkidle', timeout: 60000 })
  await p.waitForFunction(() => window.__GRIDIRON_AUDIT__ && window.RIB_COSMETICS && window.RIB_MASCOTS && window.RIB_MONETIZE, null, { timeout: 60000 })
  await p.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  await p.waitForTimeout(900)
  return { p, context }
}
const E = (p, fn, arg) => p.evaluate(fn, arg)
// a career at `level` with a season in hand, then week 1 live (the v159 B route)
async function goLive (p, level = 4) {
  await E(p, (level) => { const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true
    S.player = A.newPlayer(); S.player.name = 'Test Man'; S.player.pos = 'RB'; S.player.level = level; A.setState(S)
    try { window.startSeasonGames() } catch (e) {} }, level)
  await E(p, () => { const S = window.S, t = S.player; t.currentWeek = 0; const w = t.weekResults[0]
    S._liveGame = window.__simGameV2(w.perf, t.pos); S._oppName = w.opp; window.go('live') })
  for (let i = 0; i < 120; i++) { if (await E(p, () => !!(window.__gridironScene && window.__gridironScene.side && window.__gridironScene.markers && window.__gridironScene.markers.length >= 12))) break; await p.waitForTimeout(250) }
  await p.waitForTimeout(1500)
}
// the mascots as the page sees them, with their spot on the screen
const where = (p) => E(p, () => { const sc = window.__gridironScene; if (!sc) return []; const c = sc.cameras.main, cv = sc.game.canvas.getBoundingClientRect(), k = cv.width / sc.scale.width
  return window.RIB_MASCOTS.live().map((m) => Object.assign(m, { sx: Math.round(cv.left + (m.x - c.worldView.x) * c.zoom * k), sy: Math.round(cv.top + (m.y - c.worldView.y) * c.zoom * k), sh: Math.round(m.h * c.zoom * k), cv: [Math.round(cv.left), Math.round(cv.top), Math.round(cv.width), Math.round(cv.height)] })) })
async function waitVisible (p, team, ms = 20000) {
  const t0 = Date.now(); let L = []
  while (Date.now() - t0 < ms) { L = await where(p); const m = L.find((q) => q.team === team && q.visible && q.sx > q.cv[0] && q.sx < q.cv[0] + q.cv[2] && q.sy > q.cv[1] && q.sy < q.cv[1] + q.cv[3]); if (m) return m; await p.waitForTimeout(300) }
  return null
}
async function shotLive (p, name, m) {
  try {
    await p.screenshot({ path: SHOTS + name + '.png' })
    if (m) console.log('     ' + name + ': the ' + m.team + ' mascot (' + m.arch + ':' + m.variant + ') at ' + m.sx + ',' + m.sy + ', ' + m.sh + ' px tall')
  } catch {}
}

// ================= 1. every team has a mascot =================
{
  const { p, context } = await open(400, 860, { tag: 'map' })
  const map = await E(p, () => {
    const M = window.RIB_MASCOTS, all = M.mapAll(), arch = M.archetypes().map((a) => a.id), N = window.__NAMES_V123
    const em = all.emblems, names = Object.entries(all.names)
    const forName = (n) => M.forTeam(n).arch
    const want = { 'Fairview Knights': 'knight', 'Riverton Paladins': 'knight', 'Oak Hill Pirates': 'pirate', 'Bayside Corsairs': 'pirate', 'Summit Vikings': 'viking', 'Clayton Spartans': 'spartan',
      'Harlan Wolves': 'wolf', 'Calder Grizzlies': 'bear', 'Dunmore Eagles': 'bird', 'Jessup Tigers': 'cat', 'Kestrel Lions': 'cat', 'Upton Sharks': 'sea', 'Yarrow Invaders': 'alien',
      'Ansley Anvils': 'robot', 'Braxton Golems': 'robot', 'Copperfield Bees': 'bug', 'Glenmoor Dragons': 'reptile', 'Ironbark Bulls': 'horned', 'Lone Pine Inferno': 'elemental', 'Marbury Reapers': 'spook', 'Overlook Krakens': 'sea' }
    const bad = Object.keys(want).filter((n) => forName(n) !== want[n]).map((n) => n + ' → ' + forName(n))
    // every pose of a few sheets, and one sheet per archetype
    const errs0 = window.__V193AI.errs.length, firsts = {}
    em.forEach((e) => { if (firsts[e.arch] == null) firsts[e.arch] = e.logo })
    const sheets = Object.values(firsts).map((logo) => M.sheet(logo, ['#1f4fd0', '#e8c86a'], false))
    const full = sheets.every((S) => S.frames.length === M.poses().length)
    // a drawn frame really has pixels: count opaque pixels of the stand pose of each
    const opaque = sheets.map((S) => { const f = S.frames[M.poses().indexOf('stand')], d = S.cv.getContext('2d').getImageData(f.x, f.y, f.w, f.h).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 200) n++; return n })
    return { nEm: em.length, emOk: em.every((e) => arch.includes(e.arch) && e.name), archN: arch.length, used: [...new Set(em.map((e) => e.arch))].length, byArch: Object.fromEntries(Object.entries(all.byArch).map(([k, v]) => [k, v.length])),
      nNames: names.length, namesOk: names.every(([, v]) => arch.includes(v.arch)), mascots: N.mascots().length, dfl: N.dfl().length, colleges: N.towns().length * N.colleges().length,
      bad, full, minOpaque: Math.min(...opaque), errs: window.__V193AI.errs.slice(errs0),
      sheetAll: M.contactSheet({ all: true, pose: 'stand', cols: 10 }).toDataURL(),
      sheetArch: M.contactSheet({ pose: ['cheer0', 'flex2', 'pumpR', 'armsUp', 'cheer2', 'guard', 'wave0', 'cheer3'] }).toDataURL() }
  })
  savePng('mascots_sheet.png', map.sheetAll); savePng('mascots_archetypes.png', map.sheetArch)
  ok(map.nEm === 90 && map.emOk, 'all 90 crests (the v44 emblems every team wears) map to a named costume', { n: map.nEm })
  ok(map.archN >= 10 && map.archN <= 16 && map.used === map.archN, `${map.archN} archetypes, each one worn by at least one crest`, map.byArch)
  ok(map.namesOk && map.nNames >= map.mascots * 3 + map.dfl + 4, `every name the game builds resolves to a mascot (${map.nNames}: school sides of all ${map.mascots} mascots, ${map.colleges} college names, the ${map.dfl} UFF / Interstellar clubs, the combine)`, { n: map.nNames })
  ok(!map.bad.length, 'the name\'s animal or figure is the costume (Knights → knight, Grizzlies → bear, Invaders → alien …)', map.bad)
  ok(map.full && map.minOpaque > 300 && !map.errs.length, 'every archetype\'s sheet builds every pose, drawn (opaque pixels in the stand pose ≥ 300), with no error', { minOpaque: map.minOpaque, errs: map.errs })
  await context.close()
}

// ================= 2. the membership with the store OFF (as shipped) =================
{
  const { p, context } = await open(400, 860, { tag: 'off' })
  const off = await E(p, () => {
    const C = window.RIB_COSMETICS, R = window.RIB_MONETIZE, M = window.RIB_MASCOTS
    let calls = 0; const h = R.has; R.has = function () { calls++; return h.apply(this, arguments) }
    try {
      const it = C.catalog().find((i) => i.id === 'mascot_team'), none = C.catalog().find((i) => i.id === 'mascot_none')
      return { enabled: R.enabled, slot: C.slots.includes('mascot'), it: it && { source: it.source, rarity: it.rarity, cat: it.cat }, none: none && none.source, listed: C.listed(it), owned: C.owned('mascot_team'),
        grant: C.grant('mascot_team', 'earned'), equip: C.equip('mascot', 'mascot_team'), eq: C.equipped('mascot'), how: C.howTo(it), active: M.active(true), member: C.member(),
        keys: Object.keys(localStorage).filter((k) => /monetize/.test(k)), nodes: document.querySelectorAll('[id^="mz149"],[class*="mz149"],[class*="mz151"],#mz158Chip').length, calls }
    } finally { R.has = h }
  })
  ok(off.slot && off.it && off.it.source === 'member' && off.it.cat === 'mascot' && off.none === 'free', 'the Locker has a MASCOTS slot: "No Mascot" free, "Team Mascots" a v156 C member look', off.it)
  ok(!off.enabled && off.listed && !off.owned && !off.grant && !off.equip && off.eq === 'mascot_none' && off.how === 'Membership' && !off.active && !off.member, 'store OFF: listed, never owned / granted / equipped ("Membership"), and the mascots are not his', off)
  ok(off.calls === 0 && !off.keys.length && !off.nodes, 'store OFF: nothing on the mascots\' path calls RIB_MONETIZE; no store key, no store node', { calls: off.calls, keys: off.keys, nodes: off.nodes })
  // the Locker: the MASCOTS row, its tile locked "🔒 Membership", its preview dancing
  await E(p, () => window.go('locker')); await p.waitForTimeout(900)
  await E(p, () => { const t = document.querySelector('.hubv75-tab[data-sec="style"]'); t && t.click() }); await p.waitForTimeout(600)
  await E(p, () => window.cosCatV151B('mascot')); await p.waitForTimeout(900)
  const lk = await E(p, async () => {
    const row = document.querySelector('.pal-v174 [data-pal-sec="mascot"]'), tile = document.querySelector('.cos-item-v151b[data-cos="mascot_team"]'), eq0 = window.RIB_COSMETICS.equipped('mascot')
    const cv = tile && tile.querySelector('canvas.mascot-pv-v193ai'), poses = new Set()
    for (let i = 0; i < 14; i++) { if (cv) poses.add(cv.dataset.pose); await new Promise((r) => setTimeout(r, 250)) }
    tile && tile.click(); await new Promise((r) => setTimeout(r, 300))
    let px = 0; if (cv) { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 200) px++ }
    if (tile) tile.scrollIntoView({ block: 'center' })
    return { row: !!row, group: row ? row.closest('.pal-v174') && [...document.querySelectorAll('.pal-gh-v174')].map((g) => g.firstChild.textContent).join('|') : '', head: row ? row.querySelector('.pal-hd-v174').textContent.replace(/\s+/g, ' ') : '',
      gal: [...document.querySelectorAll('.mascot-gal-v193ai img')].filter((im) => im.complete && im.naturalWidth > 0).length, tile: tile ? tile.textContent.replace(/\s+/g, ' ') : null, locked: !!(tile && tile.classList.contains('locked')), canvas: !!cv, px, poses: [...poses], mascot: cv ? cv.dataset.mascot : '', eq: window.RIB_COSMETICS.equipped('mascot'), eq0 }
  })
  ok(lk.row && /MASCOTS/.test(lk.head) && lk.locked && /🔒 Membership/.test(lk.tile || '') && lk.eq === lk.eq0 && lk.eq === 'mascot_none', 'the Locker\'s MASCOTS row lists "Team Mascots" locked "🔒 Membership" — a tap equips nothing', lk)
  ok(lk.canvas && lk.px > 200 && lk.poses.length >= 3 && /:/.test(lk.mascot), 'its tile previews his crest\'s mascot, dancing (the owner\'s way to see them)', { px: lk.px, poses: lk.poses, mascot: lk.mascot })
  ok(lk.gal === 16, 'under the tiles, a gallery shows every costume (one per archetype, each in its crest\'s colours)', { gal: lk.gal })
  await p.waitForTimeout(400); try { await p.screenshot({ path: SHOTS + 'mascot_locker.png' }) } catch {}
  // the broadcast draws nothing for him: the hook runs and stands down
  await goLive(p, 4)
  const c0 = await E(p, () => (window.__V193AI.calls || 0)); await p.waitForTimeout(2500)
  const lv = await E(p, () => ({ calls: window.__V193AI.calls || 0, live: window.RIB_MASCOTS.live().length, keys: Object.keys(localStorage).filter((k) => /monetize/.test(k)) }))
  ok(lv.calls > c0 && lv.live === 0 && !lv.keys.length, 'store OFF, not previewed: the broadcast\'s hook runs every frame and draws no mascot', { calls: lv.calls - c0, live: lv.live })
  await context.close()
}

// ================= 3/4/5. the preview tune: the broadcast, the celebrations, the card, the kill switch =================
// (v194 B: by default only the HOME team's mascot is drawn — v194Bcheck. These two-bench assertions run under its kill
// switch TU v194B 0, which is v193 AI exactly.)
let perf = null
for (const [W, H] of [[390, 844], [1280, 800]]) {
  const { p, context } = await open(W, H, { preview: 1, tag: 'live' + W, benches: 1 })
  await goLive(p, 4)
  const m0 = await waitVisible(p, 'off', 25000) || await waitVisible(p, 'def', 8000)
  for (let i = 0; i < 60 && (await where(p)).length < 2; i++) await p.waitForTimeout(250)   // the second bench's sheet is drawn a slice a frame
  const L0 = await where(p)
  if (W === 390) {
    const names = await E(p, () => ({ opp: window.S._oppName, us: window.__gridironScene.teamNames().us }))
    ok(L0.length === 2 && L0.every((m) => m.alive && m.frame >= 0 && m.h > 10) && L0.find((m) => m.team === 'off') && L0.find((m) => m.team === 'def'), 'TU mascotPreviewV193AI 1: a mascot on each bench (his team\'s and the opponent\'s), drawn', L0.map((m) => ({ team: m.team, arch: m.arch + ':' + m.variant, h: m.h })))
    const def = L0.find((m) => m.team === 'def'), want = await E(p, (n) => window.RIB_MASCOTS.forTeam(n), names.opp)
    ok(def && def.logo === want.logo, 'the opponent\'s mascot is its crest\'s costume', { opp: names.opp, got: def && def.arch + ':' + def.variant, want: want.arch + ':' + want.variant })
    ok(!!m0, 'a mascot comes into the camera\'s view (the bench stretch nearest the ball that is on screen)', m0 && { team: m0.team, sx: m0.sx, sy: m0.sy, h: m0.sh })
    const idle = new Set(); for (let i = 0; i < 10; i++) { (await where(p)).forEach((m) => idle.add(m.pose)); await p.waitForTimeout(150) }
    ok([...idle].some((x) => /^idle|^wave/.test(x)) && idle.size >= 2, 'between scores they idle-bounce (two steps, or a wave when the bench is up)', [...idle])
  }
  // a touchdown by one of his team: the scorer enters celebrateSeq, the mascot plays the drawn cheer cycle on its clock
  const fired = await E(p, () => { const sc = window.__gridironScene; sc.__mascotHold = [sc.update, sc.animatePlay]; sc.animatePlay = function () {}   // no next play starts while it is watched
    const P = sc.play || (sc.play = { payload: {}, t: 0 }); const i = sc.markers.findIndex((m) => m && m.root && (m.kit || m.team) === 'off'); P.carrierId = i; const m = sc.markers[i]; sc.celebrate(m.sx, m.sy)
    return { i, state: m.forceState, fm: (window.RIB_TUNE || {}).celebrateFrameMs || 170 } })
  const cyc = []; const ct0 = Date.now()
  for (let i = 0; i < 16; i++) { const L = await where(p), m = L.find((q) => q.team === 'off'); cyc.push({ t: Date.now() - ct0, pose: m && m.pose, cel: m && m.cel }); if (i === 4) { await shotLive(p, 'mascot_live_' + W, (await waitVisible(p, 'off', 50)) || (await waitVisible(p, 'def', 50))) } await p.waitForTimeout(70) }
  const cheer = new Set(cyc.filter((c) => /^cheer/.test(c.pose || '')).map((c) => c.pose))
  if (W === 390) {
    ok(fired.state === 'celebrateSeq' && cyc.some((c) => c.cel && c.cel.kind === 'cycle') && cheer.size >= 3, 'a touchdown: the scorer\'s celebrateSeq starts his team\'s mascot on the drawn cheer cycle (≥ 3 of its 4 frames seen)', { state: fired.state, cel: (cyc.find((c) => c.cel) || {}).cel, cheer: [...cheer] })
    const tl = await E(p, () => { const M = window.RIB_MASCOTS, fm = 170, seq = []; for (let t = 0; t < 4 * fm; t += fm / 2) seq.push(M.celPose({ kind: 'cycle', fm }, t).pose); return seq })
    ok(tl.join() === 'cheer0,cheer0,cheer1,cheer1,cheer2,cheer2,cheer3,cheer3', 'the cycle runs on the players\' own frame time (celebrateFrameMs)', tl)
  }
  // HIS drawn body: v161 A's backflip, mirrored pose for pose
  const body = await E(p, async () => {
    const C = window.RIB_COSMETICS, B = C.boardCel; B.load(); for (let i = 0; i < 60 && !B.ready(); i++) await new Promise((r) => setTimeout(r, 100))
    const sc = window.__gridironScene; let m = sc.markers.find((q) => q && q.root && q.team === 'you') || sc.markers.find((q) => q && q.root && (q.kit || q.team) === 'off')
    window.__V193AI_bodyRun = C.celebrateBody(sc, m, { name: 'backflip', tok: 'v193AI' })
    const run = window.__V193AI_bodyRun, seen = [], rots = []
    if (!run) return { run: false, ready: B.ready() }
    const t0 = performance.now()
    while (performance.now() - t0 < run.total + 200) { const L = window.RIB_MASCOTS.live(), q = L.find((x) => x.team === 'off'); if (q) { seen.push(q.pose); const st = sc.__mascotV193AI.list.find((x) => x.team === 'off'); rots.push(Math.round(st.img.rotation * 57.3)) } await new Promise((r) => setTimeout(r, 40)) }
    return { run: true, ready: B.ready(), name: run.name, total: Math.round(run.total), kinds: window.__V193AI.cels.slice(-3).map((c) => c.kind + ':' + (c.name || '')), poses: [...new Set(seen)], maxRot: Math.max(...rots.map(Math.abs)) }
  })
  if (W === 390) ok(body.run && body.kinds.includes('body:backflip') && body.poses.includes('tuck') && body.poses.includes('armsUp') && body.maxRot > 90, 'HIS drawn body (v161 A backflip) is mirrored: the mascot loads, tucks and spins through the air on the same timeline, and lands arms up', body)
  // the other bench: an opponent's score moves the opponent's mascot
  const opp = await E(p, async () => { const sc = window.__gridironScene, P = sc.play; const i = sc.markers.findIndex((m) => m && m.root && (m.kit || m.team) === 'def'); P.carrierId = i; const m = sc.markers[i]; m.forceState = null; await new Promise((r) => setTimeout(r, 120)); sc.celebrate(m.sx, m.sy); await new Promise((r) => setTimeout(r, 200))
    const L = window.RIB_MASCOTS.live(); return { def: (L.find((q) => q.team === 'def') || {}).cel, i } })
  if (W === 390) ok(opp.def && opp.def.kind === 'cycle', 'an opponent\'s touchdown sets the OTHER bench\'s mascot dancing', opp)
  // the cost: the per-frame update (after the sheets are built)
  const st = await E(p, () => { const V = window.__V193AI, ms = (V.steady || V.ms).slice().sort((a, b) => a - b); return { n: ms.length, p50: ms[Math.floor(ms.length * 0.5)] || 0, p95: ms[Math.floor(ms.length * 0.95)] || 0, max: ms[ms.length - 1] || 0, builds: V.builds, buildMax: +V.buildMax.toFixed(1), buildAvg: V.builds ? +(V.buildMs / V.builds).toFixed(1) : 0, stepMax: +(V.stepMax || 0).toFixed(1), culled: V.culled, shown: V.shown } })
  if (W === 390) perf = st
  if (W === 1280) ok(st.p50 < 0.5 && st.p95 < 5, 'the steady per-frame cost is small (two sprites: a frame index, a spot, a bob — no sheet drawn) — p50 under 0.5 ms, p95 under 5 ms (wall time on a shared headless box)', st)
  if (W === 390) {
    // the cull: a mascot too small to read (the camera far) is hidden, then shown again
    const cull = await E(p, async () => { window.RIB_TUNE.mascotMinPxV193AI = 9999; await new Promise((r) => setTimeout(r, 600)); const a = window.RIB_MASCOTS.live().map((m) => m.visible)
      delete window.RIB_TUNE.mascotMinPxV193AI; await new Promise((r) => setTimeout(r, 600)); return { hidden: a, culled: window.__V193AI.culled } })
    ok(cull.hidden.length === 2 && cull.hidden.every((v) => v === false) && cull.culled > 0, 'a mascot under mascotMinPxV193AI on screen (the camera far) is not drawn', cull)
    // the season hero: his mascot beside his crest
    await E(p, () => { const sc = window.__gridironScene; if (sc.__mascotHold) sc.animatePlay = sc.__mascotHold[1]; window.go('season') }); await p.waitForTimeout(1600)
    const card = await E(p, async () => { const c = document.querySelector('.sx-hero-v168 .mascot-card-v193ai'), poses = new Set(); for (let i = 0; i < 12 && c; i++) { poses.add(c.dataset.pose); await new Promise((r) => setTimeout(r, 200)) } return { card: !!c, mascot: c ? c.dataset.mascot : null, poses: [...poses], hero: !!document.querySelector('.sx-hero-v168') } })
    ok(card.card && /:/.test(card.mascot || '') && card.poses.length >= 2, 'the season hero shows his mascot beside his crest, animated', card)
    await p.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') || getComputedStyle(sp).display === 'none' }, null, { timeout: 20000 }).catch(() => null)
    try { await p.addStyleTag({ content: '#personaV13,#splash{display:none!important}' }); await E(p, () => { document.querySelectorAll('#personaV13, .lgm-v152, .onboard, .decision-overlay').forEach((x) => x.remove()); const h = document.querySelector('.sx-hero-v168'); h && h.scrollIntoView({ block: 'start' }) }); await p.waitForTimeout(300)
      const r = await E(p, () => { const h = document.querySelector('.sx-hero-v168'); if (!h) return null; const b = h.getBoundingClientRect(); return { x: Math.max(0, b.left), y: Math.max(0, b.top), width: Math.min(innerWidth, b.width), height: Math.min(innerHeight - Math.max(0, b.top), b.height) } })
      if (r && r.width > 10 && r.height > 10) await p.screenshot({ path: SHOTS + 'mascot_card.png', clip: r }) } catch {}
    // the kill switch
    const kill = await E(p, async () => { window.RIB_TUNE.v193AI = 0; window.RIB_MASCOTS.refresh(); await new Promise((r) => setTimeout(r, 400)); window.go('live'); await new Promise((r) => setTimeout(r, 2500))
      const out = { active: window.RIB_MASCOTS.active(true), live: window.RIB_MASCOTS.live().filter((m) => m.alive).length, card: document.querySelectorAll('.mascot-card-v193ai').length }
      window.RIB_TUNE.v193AI = 1; window.RIB_MASCOTS.refresh(); await new Promise((r) => setTimeout(r, 2500)); out.back = window.RIB_MASCOTS.live().filter((m) => m.alive).length; return out })
    ok(!kill.active && kill.live === 0 && kill.card === 0 && kill.back === 2, 'TU v193AI 0: no mascots anywhere (the benches, the card); back on, both return', kill)
  }
  await context.close()
}
// the Interstellar League: every mascot wears the bubble
{
  const { p, context } = await open(400, 860, { preview: 1, tag: 'ist' })
  await goLive(p, 8); for (let i = 0; i < 80 && (await where(p)).length < 1; i++) await p.waitForTimeout(250)
  await p.waitForTimeout(500)
  const L = await where(p)
  ok(L.length === 1 && L.every((m) => m.space), 'in the Interstellar League the (home) mascot wears a space bubble', L.map((m) => m.arch + ':' + m.space))
  await context.close()
}

// ================= 6. the membership with the store ON (the owner's EXPERIENCE preview) =================
{
  const { p, context } = await open(400, 860, { exp: 'member', tag: 'member' })
  const mem = await E(p, () => { const C = window.RIB_COSMETICS, R = window.RIB_MONETIZE; const o = { on: R.enabled, pv: R.preview, member: R.has('member'), owned: C.owned('mascot_team'), equip: C.equip('mascot', 'mascot_team') }; o.eq = C.equipped('mascot'); o.active = window.RIB_MASCOTS.active(true); o.tune = !!(window.RIB_TUNE || {}).mascotPreviewV193AI; return o })
  ok(mem.on && mem.pv === 'member' && mem.member && mem.owned && mem.equip && mem.eq === 'mascot_team' && mem.active && !mem.tune, 'store ON with a membership: Team Mascots is owned and equips — the mascots are his (no preview tune)', mem)
  await goLive(p, 4); for (let i = 0; i < 80 && (await where(p)).length < 1; i++) await p.waitForTimeout(250); await p.waitForTimeout(500)
  const L = await where(p)
  ok(L.length === 1 && L.every((m) => m.alive && m.home), 'a member\'s broadcast draws the home mascot (v194 B: only the home team\'s)', L.map((m) => m.team + ':' + m.arch))
  await context.close()
}
{
  const { p, context } = await open(400, 860, { exp: 'f2p', tag: 'f2p' })
  const f2p = await E(p, () => { const C = window.RIB_COSMETICS, R = window.RIB_MONETIZE; return { on: R.enabled, pv: R.preview, owned: C.owned('mascot_team'), equip: C.equip('mascot', 'mascot_team'), active: window.RIB_MASCOTS.active(true), how: C.howTo(C.catalog().find((i) => i.id === 'mascot_team')) } })
  ok(f2p.on && f2p.pv === 'f2p' && !f2p.owned && !f2p.equip && !f2p.active && f2p.how === 'Membership', 'store ON without a membership: locked, not equippable, not drawn', f2p)
  await context.close()
}

// ================= 7. the cost, no errors =================
if (perf) console.log('     perf (390x844 live): per-frame p50 ' + perf.p50 + ' ms, p95 ' + perf.p95 + ' ms, max ' + perf.max + ' ms over ' + perf.n + ' frames; ' + perf.builds + ' sheet builds, avg ' + perf.buildAvg + ' ms, max ' + perf.buildMax + ' ms, spread over frames (worst slice ' + perf.stepMax + ' ms); culled ' + perf.culled + ' / shown ' + perf.shown)
ok(errors.length === 0, 'no page errors', errors.slice(0, 5))
console.log(JSON.stringify({ pass, fail, shots: SHOTS }))
await browser.close()
process.exit(fail ? 1 : 0)
