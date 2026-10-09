// Dev check: v194 B THE MASCOT COMES ALIVE (src/35-mascots.js `v194 B THE MASCOT COMES ALIVE`). The owner: "Only the home
// team's mascot should be there. On great plays celebrate and on bad plays cry, act mad, run around. Have his personality
// be dictated by how well the home team is doing … near the endzone most times … throwing merch in the stands … cartwheels.
// Jumping. Steering. Holding signs … text bubbles (over 50) giving quippy phrases."
//   1. the lines: 50+ phrases (bucketed: touchdown, big play, takeaway, sack, bad play, opponent TD, flag, red zone, third
//      down, idles, blowouts …), the league is the UFF (never NFL); every new pose is in the sheet
//   2. store OFF, not previewed: the hook still stands down (no mascot) — the membership gate is untouched
//   3. preview (TU mascotPreviewV193AI 1, the owner's / checks' way in): ONE mascot, the HOME team's (his team at home);
//      an away week shows the OPPONENT's mascot instead
//   4. mood: a forced great play (touchdown) raises the mood and starts a celebration (cartwheel / backflip / merch …); a
//      forced bad play (opponent TD) lowers it and starts crying / temper / circles; a run of bad plays makes him
//      furious or desperate, a run of good ones ecstatic
//   5. merch spawns from his hand and lands IN the stands (a crowd section's own box); a bubble is shown, never two
//      at once; he never stands inside the painted field
//   6. cosmetic only: hundreds of mascot frames draw no Math.random, and a seeded sim gives the same result before and
//      after them; TU v194B 0 gives v193 AI's two benches back; no page errors
// Screenshots: scripts/_v194B_*.png (not committed).   GAME_URL=http://localhost:5661/ node scripts/v194Bcheck.mjs
import { launch, gameUrl } from './lib/env.mjs'
const SHOTS = new URL('./', import.meta.url).pathname
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114'
async function open (W, H, { preview = 0, tag = 'p' } = {}) {
  const context = await browser.newContext({ viewport: { width: W, height: H } })
  await context.addInitScript(({ preview }) => {
    try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
    if (preview) window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { mascotPreviewV193AI: 1 })
    setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove(); document.getElementById('growV132')?.remove() }, 60)
  }, { preview })
  const p = await context.newPage(); p.on('pageerror', (e) => errors.push(tag + ': ' + (e.message || e)))
  await p.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
  await p.waitForFunction(() => window.__GRIDIRON_AUDIT__ && window.RIB_COSMETICS && window.RIB_MASCOTS && window.__V194B, null, { timeout: 60000 })
  await p.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  await p.waitForTimeout(900)
  return { p, context }
}
const E = (p, fn, arg) => p.evaluate(fn, arg)
async function goLive (p, { home = true } = {}) {
  await E(p, (home) => { const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true
    S.player = A.newPlayer(); S.player.name = 'Test Man'; S.player.pos = 'RB'; S.player.level = 4; A.setState(S)
    try { window.startSeasonGames() } catch (e) {}
    const t = window.S.player; t.currentWeek = 0; const w = t.weekResults[0]
    window.S._liveGame = window.__simGameV2(w.perf, t.pos); window.S._oppName = w.opp; window.__homeGameV93 = home; window.go('live') }, home)
  for (let i = 0; i < 120; i++) { if (await E(p, () => !!(window.__gridironScene && window.__gridironScene.side && window.__gridironScene.markers && window.__gridironScene.markers.length >= 12))) break; await p.waitForTimeout(250) }
  for (let i = 0; i < 80 && !(await E(p, () => window.RIB_MASCOTS.live().length)); i++) await p.waitForTimeout(250)
  await p.waitForTimeout(800)
}
const live = (p) => E(p, () => window.RIB_MASCOTS.live())
const PAY = { td: { event: 'pass', yards: 30, scored: true, offense: 'us', desc: 'TOUCHDOWN' }, otd: { event: 'run', yards: 12, scored: true, offense: 'them', desc: 'TOUCHDOWN' },
  pick: { event: 'pass', yards: 0, offense: 'us', desc: 'INTERCEPTED by the defense' }, sack: { event: 'sack', yards: -7, offense: 'us', desc: 'SACKED' }, big: { event: 'run', yards: 34, offense: 'us', desc: 'run for 34' } }

// ================= 1. the lines and the poses =================
{
  const { p, context } = await open(400, 860, { tag: 'lines' })
  const L = await E(p, () => { const A = window.RIB_MASCOTS.v194b, ph = A.phrases(), all = Object.values(ph).flat(); return { n: A.count(), uniq: new Set(all).size, buckets: Object.keys(ph), nfl: all.filter((s) => /\bNFL\b|\bDFL\b/i.test(s)), poses: window.RIB_MASCOTS.poses(), acts: A.acts() } })
  const want = ['td', 'big', 'takeaway', 'sack', 'bad', 'oppTd', 'penalty', 'idleConfident', 'idleNervous', 'blowoutWin', 'blowoutLoss', 'redZone', 'thirdDown']
  ok(L.n >= 50 && L.uniq >= 60, `${L.n} quippy lines (${L.uniq} distinct) — over 50`, { n: L.n, uniq: L.uniq })
  ok(want.every((b) => L.buckets.includes(b)), 'bucketed by context (TD, big play, turnover, sack, bad play, opp TD, flag, idles, blowouts, red zone, 3rd down …)', L.buckets)
  ok(!L.nfl.length, 'the league is the UFF: no line says NFL', L.nfl)
  const np = ['run0', 'run1', 'run2', 'run3', 'star', 'jump', 'cry0', 'cry1', 'mad0', 'mad1', 'sign0', 'sign1', 'throw0', 'throw1', 'steer0', 'steer1', 'steer2', 'kick', 'slump0', 'nails0', 'hips0', 'bump', 'point']
  ok(np.every((x) => L.poses.includes(x)) && ['cartwheel', 'backflip', 'jumps', 'steer', 'merch', 'sign', 'cry', 'mad', 'circles', 'kick'].every((a) => L.acts.includes(a)), 'the new poses are in the sheet (run cycle, cartwheel star, jump, cry, mad, sign, throw, steer, kick …) and every act exists', { poses: L.poses.length })
  await context.close()
}

// ================= 2. store OFF, not previewed: still a no-op =================
{
  const { p, context } = await open(400, 860, { tag: 'off' })
  await goLive(p)
  await p.waitForTimeout(1500)
  const o = await E(p, () => ({ active: window.RIB_MASCOTS.active(true), live: window.RIB_MASCOTS.live().length, enabled: window.RIB_MONETIZE.enabled, keys: Object.keys(localStorage).filter((k) => /monetize/.test(k)) }))
  ok(!o.enabled && !o.active && o.live === 0 && !o.keys.length, 'store OFF, not a member, no preview: no mascot in the broadcast (the membership gate is untouched)', o)
  await context.close()
}

// ================= 3-6. preview: one mascot, his moods, the merch, the bubbles =================
{
  const { p, context } = await open(390, 844, { preview: 1, tag: 'home' })
  await goLive(p, { home: true })
  const L0 = await live(p), us = await E(p, () => window.RIB_MASCOTS.forTeam(window.__gridironScene.teamNames().us).arch)
  ok(L0.length === 1 && L0[0].team === 'off' && L0[0].home && L0[0].alive, 'a home week: ONE mascot, his own team\'s (the home team)', L0.map((m) => ({ team: m.team, arch: m.arch, mood: m.mood })))
  // a great play then a bad one
  const g = await E(p, (P) => { const A = window.RIB_MASCOTS.v194b; const s0 = A.state().moodScore; const r = A.react(P); return { s0, r } }, PAY.td)
  await p.waitForTimeout(250)
  const gAct = await E(p, () => window.RIB_MASCOTS.v194b.state())
  try { await p.screenshot({ path: SHOTS + '_v194B_td.png' }) } catch {}
  ok(g.r && g.r.kind === 'td' && g.r.moodScore > g.s0 && g.r.acts.includes('merch') && g.r.acts.some((a) => ['cartwheel', 'backflip', 'jumps', 'airbump', 'steer'].includes(a)) && ['cartwheel', 'backflip', 'jumps', 'airbump', 'steer', 'merch'].includes(gAct.act), 'a forced home touchdown: the mood rises and he celebrates (cartwheel / backflip / jumps / steering + merch)', { s0: g.s0, s1: g.r.moodScore, acts: g.r.acts, now: gAct.act, said: g.r.said })
  // the merch lands in the stands
  let mc = null
  for (let i = 0; i < 40; i++) { mc = await E(p, () => window.__V194B.merch); if (mc.landed >= 1 && mc.flying === 0) break; await p.waitForTimeout(200) }
  ok(mc.spawned >= 1 && mc.landed >= 1 && mc.inStands === mc.landed, 'merch arcs out of his hand and every item lands IN the stands (inside a crowd section\'s box)', mc)
  const b = await E(p, (P) => { const A = window.RIB_MASCOTS.v194b; const s0 = A.state().moodScore; const r = A.react(P); return { s0, r } }, PAY.otd)
  await p.waitForTimeout(400)
  const bAct = await E(p, () => window.RIB_MASCOTS.v194b.state())
  try { await p.screenshot({ path: SHOTS + '_v194B_opptd.png' }) } catch {}
  ok(b.r && b.r.kind === 'oppTd' && b.r.moodScore < b.s0 && b.r.acts.some((a) => ['cry', 'mad', 'circles'].includes(a)) && ['cry', 'mad', 'circles', 'headhands', 'kick', 'slump'].includes(bAct.act), 'a forced opponent touchdown: the mood falls and he cries / storms / runs in circles', { s0: b.s0, s1: b.r.moodScore, acts: b.r.acts, now: bAct.act, said: b.r.said })
  const bad = await E(p, (L) => { const A = window.RIB_MASCOTS.v194b; L.forEach((x) => A.react(x)); return A.state().mood }, [PAY.pick, PAY.sack, Object.assign({}, PAY.otd, { usScore: 0, themScore: 21, quarter: 4 })])
  const good = await E(p, (L) => { const A = window.RIB_MASCOTS.v194b; L.forEach((x) => A.react(x)); return A.state().mood }, [PAY.td, PAY.big, Object.assign({}, PAY.td, { usScore: 28, themScore: 7, quarter: 3 })])
  ok(['furious', 'desperate'].includes(bad) && good === 'ecstatic', 'his personality follows the home team: a run of bad plays → furious / desperate, a run of good ones → ecstatic', { bad, good })
  // bubbles: one at a time
  await E(p, () => window.RIB_MASCOTS.v194b.say('redZone')); await p.waitForTimeout(300)
  const bb = await E(p, () => ({ bubble: window.__V194B.bubble, max: window.__V194B.maxBubbles, n: window.__V194B.bubbles }))
  try { await p.screenshot({ path: SHOTS + '_v194B_bubble.png' }) } catch {}
  ok(bb.bubble && bb.bubble.text && bb.max <= 1 && bb.n >= 2, 'a speech bubble over his head, never two at once', bb)
  // watch a while of real play: never inside the painted field
  await p.waitForTimeout(5000)
  const fl = await E(p, () => ({ onField: window.__V194B.onField, ez: window.__V194B.ez, side: window.__V194B.side, judged: window.__V194B.judged, spot: window.__V194B.spot }))
  ok(fl.onField === 0, 'he never stands inside the painted field (end-zone corners and sidelines only; bank switches go round behind the end line)', fl)
  // cosmetic only
  const pure = await E(p, () => {
    const sc = window.__gridironScene, st = sc.__mascotV193AI, A = window.RIB_MASCOTS.v194b
    const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
    const R0 = Math.random, w = window.S.player.weekResults[0]
    Math.random = seeded(42); const s1 = JSON.stringify(window.__simGameV2(w.perf, 'RB')).length; Math.random = R0
    let calls = 0; Math.random = function () { calls++; return R0() }
    try { A.react({ event: 'pass', yards: 30, scored: true, offense: 'us', desc: 'TOUCHDOWN' }); for (let i = 0; i < 300; i++) { if (i === 150) A.react({ event: 'run', yards: 12, scored: true, offense: 'them', desc: 'TOUCHDOWN' }); window.RIB_MASCOTS.frame(sc, 16, st.geom) } } finally { Math.random = R0 }
    Math.random = seeded(42); const s2 = JSON.stringify(window.__simGameV2(w.perf, 'RB')).length; Math.random = R0
    return { calls, s1, s2 }
  })
  ok(pure.calls === 0 && pure.s1 === pure.s2, 'cosmetic only: 300 mascot frames (a celebration, a meltdown) draw no Math.random, and a seeded sim is unchanged around them', pure)
  // the kill switch: v193 AI's two benches
  // (polled, not a fixed wait: the second bench's sheet is drawn a slice a frame, slow under load)
  const kill = await E(p, async () => { const L = () => window.RIB_MASCOTS.live().filter((m) => m.alive).map((m) => m.team + (m.home ? '*' : ''))
    const until = async (f) => { for (let i = 0; i < 60 && !f(L()); i++) await new Promise((r) => setTimeout(r, 250)); return L() }
    window.RIB_TUNE.v194B = 0; const a = await until((x) => x.length === 2)
    window.RIB_TUNE.v194B = 1; const b = await until((x) => x.length === 1 && x[0] === 'off*'); return { off: a, back: b } })
  ok(kill.off.length === 2 && kill.back.length === 1 && kill.back[0] === 'off*', 'TU v194B 0: v193 AI\'s two benches come back; on again, only the home mascot', kill)
  await context.close()
}
{
  const { p, context } = await open(390, 844, { preview: 1, tag: 'away' })
  await goLive(p, { home: false })
  const L = await live(p), want = await E(p, () => window.RIB_MASCOTS.forTeam(window.S._oppName).logo)
  const r = await E(p, (P) => window.RIB_MASCOTS.v194b.react(P), PAY.td)
  await p.waitForTimeout(500)
  try { await p.screenshot({ path: SHOTS + '_v194B_away.png' }) } catch {}
  ok(L.length === 1 && L[0].team === 'def' && L[0].logo === want, 'an away week: ONE mascot, the home side\'s — the opponent\'s crest', L.map((m) => ({ team: m.team, arch: m.arch, logo: m.logo, want })))
  ok(r && r.kind === 'oppTd' && r.v < 0, 'on the road HIS touchdown is the home mascot\'s bad play', r && { kind: r.kind, acts: r.acts })
  await context.close()
}
ok(errors.length === 0, 'no page errors', errors.slice(0, 5))
console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
await browser.close()
process.exit(fail ? 1 : 0)
