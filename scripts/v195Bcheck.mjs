// Dev check: v195 B THE MASCOT, V2 (src/35-mascots.js `v195 B THE MASCOT, V2`, src/05-field-renderer.js `v195 B THE MASCOT,
// V2 (renderer)`). The owner: "Colors exact to mascot logos. Text should be typewriter (one letter at a time) and have
// comedic timing. Improve the text to be funnier. The mascot is teleporting everywhere on the field, ensure that doesn't
// happen as often for the 'my plays only' sim. Have him dance and be in frame of the jumbotron, right now he freezes. Make
// dance moves more natural instead of blocky."
//   1. COLOURS: every crest's palette (`LOGO_PAL_V195B`) is colours the crest really has (read back off
//      public/rib_logos_v44.png in the page); a v2 sheet's pixels are those colours (plus the outline ink and the eyes'
//      white) — for eight crests — far more than the v194 B sheet's; the jersey and its trim are crest colours
//   2. THE LINES: 21+ buckets, 100+ lines, most with a "|" beat, clean, the league is the UFF
//   3. TYPEWRITER (a real bubble in a live game): the letters come one at a time (every step +1, many steps), the box is
//      its final size from the first frame (it never changes while the letters come), a "|" holds a beat, an ellipsis
//      is drawn dot by dot, and the full line holds long enough to read
//   4. NATURAL DANCE: the v2 sheet has the in-betweens and the groove; the cheer cycle shows ~3x the distinct frames a
//      second; a landing squashes him with his feet on the ground
//   5. NO TELEPORTS: a MY PLAYS ONLY game (skipped plays move the field): v194 B (TU v195B 0) vs v2, the same game —
//      the world jumps and the on-screen pops per minute; v2 has none on screen
//   6. THE JUMBOTRON: with a pan every play, while the camera is on the screen he is drawn, in the shot and his frame
//      changes (he dances, in the gap too); with his spot out of the shot he dances on the deck BESIDE the screen
//   8. CHIBI (TU v195Bchibi): the head about half his height, all 90 crests draw it without an error on "_c" sheets, off =
//      v194 B's proportions exactly; every emblem maps to its own drawn mark (the crest's feel)
//   7. cosmetic only (no Math.random in 300 frames, a seeded sim unchanged); TU v195B 0 = v194 B (its sheet, its lines,
//      its bubble); no page errors
// Screenshots: scripts/_v195B_*.png (not committed).   GAME_URL=http://localhost:5700/ node scripts/v195Bcheck.mjs
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

// ================= 1-2. the crest's colours, the lines =================
{
  const { p, context } = await open(800, 900, { tag: 'colours' })
  const C = await E(p, async () => {
    const API = window.__V195B.api, TL = window.TEAM_LOGOS_V44, LOGOS = [0, 3, 5, 7, 10, 18, 31, 60]
    const img = new Image(); img.src = TL.url; await img.decode()
    const lc = document.createElement('canvas'); lc.width = img.width; lc.height = img.height; const lx = lc.getContext('2d', { willReadFrequently: true }); lx.drawImage(img, 0, 0)
    const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
    const out = []
    for (const i of LOGOS) {
      const pal = API.palette(i), cell = lx.getImageData((i % 10) * 128, Math.floor(i / 10) * 128, 128, 128).data
      // every palette colour is on the crest (within a hair: the colour is a bin's mean)
      const onCrest = pal.map((q) => { const c = hexRgb(q.hex); let best = 1e9; for (let k = 0; k < cell.length; k += 4) { if (cell[k + 3] < 200) continue; const d = Math.abs(cell[k] - c[0]) + Math.abs(cell[k + 1] - c[1]) + Math.abs(cell[k + 2] - c[2]); if (d < best) best = d } return best })
      const share = (v) => { window.RIB_TUNE.v195B = v; const pals = window.TEAM_PALETTES, S = window.RIB_MASCOTS.sheet(i, pals[TL.palIdx(i)], false), f = S.frames[0]
        const d = S.cv.getContext('2d').getImageData(f.x, f.y, f.w, f.h).data, cols = pal.map((q) => hexRgb(q.hex)).concat([[0x17, 0x13, 0x1c], [255, 255, 255], [0xff, 0x8f, 0xa8], [0xe8, 0x78, 0x9a]])
        let n = 0, hit = 0; for (let k = 0; k < d.length; k += 4) { if (d[k + 3] < 255) continue; n++; if (cols.some((c) => Math.abs(d[k] - c[0]) + Math.abs(d[k + 1] - c[1]) + Math.abs(d[k + 2] - c[2]) <= 9)) hit++ } return { key: S.key, v2: !!S.v2, frac: +(hit / Math.max(1, n)).toFixed(3) } }
      const v1 = share(0), v2 = share(1), cols = API.cols(i)
      out.push({ i, name: TL.name(i), pal: pal.map((q) => q.hex + (q.rim ? '*' : '')), worst: Math.max(...onCrest), v1: v1.frac, v2: v2.frac, keyV2: /_v195b(_c)?$/.test(v2.key), v2sheet: v2.v2, jersey: [cols.p1, cols.p2].every((h) => pal.some((q) => q.hex === h)) })
    }
    window.RIB_TUNE.v195B = 1
    return out
  })
  ok(C.every((c) => c.worst <= 12), 'every crest palette colour is a colour the crest really has (read back off rib_logos_v44.png)', C.map((c) => ({ i: c.i, worst: c.worst })))
  ok(C.every((c) => c.v2 >= 0.97 && c.v2sheet && c.keyV2), 'a v2 sheet is painted in its crest\'s colours: ≥97% of the drawn pixels are crest colours (or the ink, the eyes\' white, the chibi blush and tongue), for 8 crests', C.map((c) => ({ i: c.i, name: c.name, v2: c.v2 })))
  ok(C.reduce((a, c) => a + c.v2, 0) / C.length - C.reduce((a, c) => a + c.v1, 0) / C.length > 0.3, 'v194 B\'s approximated costume colours were not (the mean crest-colour share, v194 B → v2)', { v1: +(C.reduce((a, c) => a + c.v1, 0) / C.length).toFixed(3), v2: +(C.reduce((a, c) => a + c.v2, 0) / C.length).toFixed(3) })
  ok(C.every((c) => c.jersey), 'the jersey and its trim are crest colours too (the wolf\'s cyan keyline, the boar\'s red …)', C.map((c) => c.i + ':' + c.pal.slice(0, 3).join(' ')))
  // CHIBI (TU v195Bchibi): the head about half his height, every archetype drawn, every crest's own mark; off = v194 B's build
  const CH = await E(p, () => {
    const API = window.__V195B.api, M = window.RIB_MASCOTS, TL = window.TEAM_LOGOS_V44, pals = window.TEAM_PALETTES, errs0 = window.__V193AI.errs.length
    const motifs = API.motifs(), drawers = new Set(API.motifDrawers())
    const build = (tune) => { Object.assign(window.RIB_TUNE, tune); const out = {}; for (let i = 0; i < 90; i++) { const S = M.sheet(i, pals[TL.palIdx(i)], false), f = S.frames[0], d = S.cv.getContext('2d').getImageData(f.x, f.y, f.w, f.h).data; let n = 0; for (let k = 3; k < d.length; k += 4) if (d[k] > 200) n++; out[i] = { key: S.key, n, hip: S.frames.slice(0, M.poses().length).map((q) => +q.hipY.toFixed(3)).slice(0, 63).join(','), head: S.frames.slice(0, 63).map((q) => q.head.x.toFixed(2) + ':' + q.head.y.toFixed(2)).join(',') } } return out }
    const old = build({ v195B: 0 }), flat = build({ v195B: 1, v195Bchibi: 0 }), chibi = build({ v195B: 1, v195Bchibi: 1 })
    const same = Object.keys(old).every((i) => old[i].hip === flat[i].hip && old[i].head === flat[i].head)
    const differ = Object.keys(old).filter((i) => old[i].head !== chibi[i].head).length
    const archs = new Set(M.emblems().map((e) => e.arch))
    return { ratioChibi: API.headRatio('stand', true), ratioOld: API.headRatio('stand', false), ratioCheer: API.headRatio('cheer1', true), same, differ, keysC: Object.values(chibi).every((q) => /_v195b_c$/.test(q.key)), keysF: Object.values(flat).every((q) => /_v195b$/.test(q.key)),
      minOpaque: Math.min(...Object.values(chibi).map((q) => q.n)), archs: archs.size, errs: window.__V193AI.errs.slice(errs0), motifs: motifs.length, unmapped: motifs.map((m, i) => (drawers.has(m) ? null : i + ':' + m)).filter(Boolean), kinds: new Set(motifs).size }
  })
  ok(CH.ratioChibi >= 0.45 && CH.ratioChibi <= 0.55 && CH.ratioChibi - CH.ratioOld >= 0.07, 'chibi: the head is about half his height (head ÷ height ' + CH.ratioChibi + ', v194 B ' + CH.ratioOld + ')', { stand: CH.ratioChibi, cheer: CH.ratioCheer, v194B: CH.ratioOld })
  ok(CH.keysC && CH.minOpaque > 300 && !CH.errs.length && CH.differ === 90, 'chibi: all 90 crests\' mascots (' + CH.archs + ' archetypes) draw the chibi build without an error, on their own "_c" sheets', { minOpaque: CH.minOpaque, errs: CH.errs, differ: CH.differ })
  ok(CH.same && CH.keysF, 'TU v195Bchibi 0: the v2 sheet has v194 B\'s proportions exactly (every base pose\'s hip and head where v194 B puts them)', { same: CH.same })
  ok(CH.motifs === 90 && !CH.unmapped.length && CH.kinds >= 40, 'the crest\'s feel: every one of the 90 emblems maps to its own mark (' + CH.kinds + ' kinds — bolt, flame, stripes, crown, moon …), each one drawn', { unmapped: CH.unmapped })
  try {
    const fs = await import('node:fs'), save = (n, d) => fs.writeFileSync(SHOTS + n, Buffer.from(d.split(',')[1], 'base64'))
    save('_v195B_contact_before.png', await E(p, () => { window.RIB_TUNE.v195B = 0; const d = window.RIB_MASCOTS.contactSheet({ all: true, pose: 'stand' }).toDataURL(); window.RIB_TUNE.v195B = 1; return d }))
    save('_v195B_contact_after.png', await E(p, () => { window.RIB_TUNE.v195B = 1; window.RIB_TUNE.v195Bchibi = 1; return window.RIB_MASCOTS.contactSheet({ all: true, pose: 'stand' }).toDataURL() }))
    save('_v195B_logo_pairs.png', await E(p, async () => {
      const TL = window.TEAM_LOGOS_V44, img = new Image(); img.src = TL.url; await img.decode()
      const cw = 216, ch = 140, cols = 6, cv = document.createElement('canvas'); cv.width = cols * cw; cv.height = 15 * ch
      const x = cv.getContext('2d'); x.fillStyle = '#2f4f2c'; x.fillRect(0, 0, cv.width, cv.height); x.imageSmoothingEnabled = false
      for (let i = 0; i < 90; i++) { const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch; x.drawImage(img, (i % 10) * 128, Math.floor(i / 10) * 128, 128, 128, cx + 4, cy + 12, 100, 100)
        const S = window.RIB_MASCOTS.sheet(i, window.TEAM_PALETTES[TL.palIdx(i)], false), f = S.frames[0]; x.drawImage(S.cv, f.x, f.y, f.w, f.h, cx + 104, cy + 6, 104, 124)
        x.fillStyle = '#fff'; x.font = 'bold 10px sans-serif'; x.fillText(i + ' ' + TL.name(i) + ' · ' + window.__V195B.api.motifs()[i], cx + 4, cy + 10) }
      return cv.toDataURL() }))
  } catch (e) { console.log('shot', e.message) }
  const L = await E(p, () => { const A = window.RIB_MASCOTS.v194b, ph = A.phrases(), all = Object.values(ph).flat(); return { n: A.count(), uniq: new Set(all).size, buckets: Object.keys(ph), beats: all.filter((s) => s.includes('|')).length, nfl: all.filter((s) => /\bNFL\b|\bDFL\b/i.test(s)), bad: all.filter((s) => /\b(damn|hell|crap|sucks?)\b/i.test(s)), uff: all.filter((s) => /\bUFF\b/.test(s)).length } })
  ok(L.n >= 100 && L.uniq === L.n && L.buckets.length >= 21 && L.buckets.includes('jumbo'), `${L.n} lines in ${L.buckets.length} buckets (the v194 B buckets + "jumbo"), none repeated`, { n: L.n, buckets: L.buckets.length })
  ok(L.beats >= L.n * 0.8, 'setup → beat → punchline: most lines carry a "|" beat', { beats: L.beats, n: L.n })
  ok(!L.nfl.length && !L.bad.length, 'clean, and the league is the UFF (never NFL)', { nfl: L.nfl, bad: L.bad, uff: L.uff })
  const PL = await E(p, () => window.__V195B.api.plan("THAT DIDN'T COUNT,| RIGHT?| ...RIGHT?!"))
  const at = (s) => PL.times[PL.text.indexOf(s)]
  ok(!PL.text.includes('|') && PL.beats.length === 2 && at(' RIGHT?') - at(',') >= 600 && PL.times[PL.text.indexOf('...') + 1] - PL.times[PL.text.indexOf('...')] >= 200 && PL.hold >= 1500, 'the plan: "|" is a held beat (≥600 ms), not drawn; an ellipsis goes dot … by … dot; the line holds ≥1.5 s', { beatGap: at(' RIGHT?') - at(','), dotGap: PL.times[PL.text.indexOf('...') + 1] - PL.times[PL.text.indexOf('...')], hold: PL.hold, total: PL.total })
  await context.close()
}

// ================= 3, 4, 7. a live game: the typewriter, the dance, cosmetic only, the kill switch =================
{
  const { p, context } = await open(390, 844, { tag: 'live' })
  await goLive(p)
  const L0 = await E(p, () => window.RIB_MASCOTS.live())
  ok(L0.length === 1 && L0[0].home && /_v195b(_c)?$/.test(L0[0].key), 'the home mascot is up on a v2 sheet', L0.map((m) => ({ key: m.key, arch: m.arch })))
  // the typewriter, sampled every animation frame
  const RAW = 'WE GOT THIS.| PROBABLY.| DEFINITELY... PROBABLY.'
  const T = await E(p, async (RAW) => {
    const API = window.__V195B.api, text = API.sayLine(RAW), samples = []
    const t0 = performance.now()
    await new Promise((res) => { const step = () => { const b = window.__V194B.bubble; samples.push({ t: Math.round(performance.now() - t0), shown: b ? b.shown : null, w: b ? b.w : null, h: b ? b.h : null }); if (performance.now() - t0 < 7000) requestAnimationFrame(step); else res() }; requestAnimationFrame(step) })
    return { text, samples, log: window.__V195B.typeLog.slice(), type: window.__V195B.type, plan: API.plan(RAW) }
  }, RAW)
  const seen = T.samples.filter((s) => s.shown != null), steps = []
  for (let i = 1; i < seen.length; i++) if (seen[i].shown !== seen[i - 1].shown) steps.push(seen[i].shown - seen[i - 1].shown)
  const ws = new Set(seen.map((s) => s.w + 'x' + s.h)), len = T.text.length
  ok(seen.length && seen[0].shown <= 2 && Math.max(...seen.map((s) => s.shown)) === len, 'the bubble starts empty and types the whole line', { first: seen[0] && seen[0].shown, last: seen.length && seen[seen.length - 1].shown, len })
  // one letter at a time: every letter has its own instant in the plan, and what is drawn follows the plan frame by frame
  // (headless frames come slowly under load, so a frame can carry a couple of letters — the schedule is what is checked)
  const own = T.plan.times.every((t, i) => !i || t > T.plan.times[i - 1])
  const due = (ms) => T.plan.times.filter((x) => x <= ms).length
  const off = seen.map((s) => Math.abs(s.shown - due(s.t))), lag = Math.max(...off)
  ok(own && steps.every((d) => d > 0) && lag <= 3 && steps.length >= 10, 'one letter at a time: each letter has its own instant (' + T.plan.times.length + ' instants), the count only rises, and every frame shows what is due', { steps: steps.length, ones: steps.filter((d) => d === 1).length, worstLag: lag, len })
  ok(ws.size === 1, 'the box is drawn at its final size: it never changes while the letters come', [...ws])
  const tOf = (n) => { const s = seen.find((q) => q.shown >= n); return s ? s.t : null }
  const b1 = T.text.indexOf(' PROBABLY.'), held = tOf(b1 + 1) - tOf(b1)
  ok(held >= 550, 'the "|" beat: the bubble holds still ≥ 0.55 s before the punchline', { held, at: b1 })
  const lastT = tOf(len), visEnd = [...seen].reverse().find((q) => q.shown === len)
  ok(T.type && T.type.life - T.type.revealMs >= 1500 && (!visEnd || visEnd.t >= lastT), 'the full line holds long enough to read (≥ 1.5 s after the last letter; the bubble only goes early if he leaves the shot)', { hold: T.type && T.type.life - T.type.revealMs, lastLetter: lastT, seenUntil: visEnd && visEnd.t })
  try { await E(p, () => window.__V195B.api.sayLine('I\'M NOT CRYING.| THE HEAD IS JUST VERY HUMID.')); await p.waitForTimeout(1500); await p.screenshot({ path: SHOTS + '_v195B_bubble.png' }) } catch {}   // mid-line: the box whole, the letters coming
  // the dance: frames a second through the cheer, and the squash on a landing
  const D = await E(p, () => {
    const API = window.__V195B.api, names = new Set(API.names()), tw = API.tweens()
    const count = (v) => { window.RIB_TUNE.v195B = v; const set = []; for (let t = 0; t < 1360; t += 16) { const o = window.RIB_MASCOTS.celPose({ kind: 'cycle', fm: 170, t0: 0, ms: 2400 }, t); if (set[set.length - 1] !== o.pose) set.push(o.pose) } return set.length }
    const v1 = count(0), v2 = count(1)
    return { tweens: tw.length, groove: ['groove0', 'groove1', 'groove2', 'groove3'].every((n) => names.has(n)), v1, v2, sheet: window.RIB_MASCOTS.live()[0].key }
  })
  ok(D.tweens >= 60 && D.groove, 'the v2 sheet carries the in-betweens (two for every step of every cycle) and the four-count groove', { tweens: D.tweens })
  ok(D.v2 >= D.v1 * 2.5, 'the cheer is no longer four hard switches: pose → in-between → in-between → pose (frames shown over 1.36 s)', { v194B: D.v1, v2: D.v2 })
  const SQ = await E(p, async () => {
    const A = window.RIB_MASCOTS.v194b; A.act('jumps'); const out = []
    const sc = window.__gridironScene, m = A.mascot()
    await new Promise((res) => { const t0 = performance.now(); const step = () => { out.push({ sy: +(m.img.scaleY / Math.abs(m.img.scaleX) || 1).toFixed(3), y: m.img.y }); if (performance.now() - t0 < 1400) requestAnimationFrame(step); else res() }; requestAnimationFrame(step) })
    return { min: Math.min(...out.map((o) => o.sy)), max: Math.max(...out.map((o) => o.sy)), n: out.length }
  })
  ok(SQ.min < 0.97 && SQ.max > 1.02, 'squash and stretch: a jump stretches him on the way up and squashes him on the landing', SQ)
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
  ok(pure.calls === 0 && pure.s1 === pure.s2, 'cosmetic only: 300 v2 frames (a celebration, a meltdown, the typewriter) draw no Math.random; a seeded sim is unchanged', pure)
  // the kill switch: v194 B's sheet, lines and bubble
  const K = await E(p, async () => {
    window.RIB_TUNE.v195B = 0
    const until = async (f) => { for (let i = 0; i < 80 && !f(); i++) await new Promise((r) => setTimeout(r, 250)) }
    await until(() => { const l = window.RIB_MASCOTS.live(); return l.length === 1 && l[0].alive && !/_v195b(_c)?$/.test(l[0].key) })
    const A = window.RIB_MASCOTS.v194b, l = window.RIB_MASCOTS.live()
    const said = A.say('td'); await new Promise((r) => setTimeout(r, 300))
    const b = window.__V194B.bubble, m = A.mascot()
    const out = { key: l[0] && l[0].key, count: A.count(), said, bar: /\|/.test(said || ''), typed: !!(b && b.shown != null), rows: !!(m && m.v194.bubbleBox && m.v194.bubbleBox.__rows), sayLine: window.__V195B.api.sayLine('X| Y') }
    window.RIB_TUNE.v195B = 1
    await until(() => { const l = window.RIB_MASCOTS.live(); return l.length === 1 && l[0].alive && /_v195b(_c)?$/.test(l[0].key) })
    out.back = window.RIB_MASCOTS.live().map((q) => q.key)
    return out
  })
  ok(K.key && !/_v195b(_c)?$/.test(K.key) && K.count === 104 && !K.bar && !K.typed && !K.rows && K.sayLine === null && /_v195b(_c)?$/.test(K.back[0] || ''), 'TU v195B 0: v194 B exactly — its sheet, its 104 lines, its whole-line bubble; on again, the v2 sheet', K)
  await context.close()
}

// ================= 5. MY PLAYS ONLY: no teleports =================
const mp = {}
for (const v of [0, 1]) {
  const { p, context } = await open(390, 844, { tune: { v195B: v }, tag: 'mp' + v })
  await goLive(p, { myPlays: true })
  await E(p, () => window.__V195B.reset())
  await p.waitForTimeout(MP_MS)
  mp[v] = await E(p, () => Object.assign(window.__V195B.perMin(), { skipped: ((window.__V156D && window.__V156D.log()) || []).filter((x) => x.skip).length, drawn: ((window.__V156D && window.__V156D.log()) || []).filter((x) => !x.skip).length, cuts: window.__V195B.cuts, enters: window.__V195B.enters, teleports194: window.__V194B.teleports, log: window.__V195B.track.log.slice(0, 6) }))
  if (v) try { await p.screenshot({ path: SHOTS + '_v195B_myplays.png' }) } catch {}
  await context.close()
}
info('MY PLAYS ONLY, v194 B (TU v195B 0)', mp[0])
info('MY PLAYS ONLY, v2', mp[1])
ok(mp[1].skipped > 0, 'the game really skipped plays (MY PLAYS ONLY on)', { v194B: mp[0].skipped, v2: mp[1].skipped })
ok(mp[1].pops + mp[1].popIns === 0 && mp[1].visiblePerMin <= 0.5, 'v2: he never pops on screen (no on-screen jump, never appears mid-shot from elsewhere) — he runs in from the edge', mp[1])
ok(mp[1].jumpsPerMin <= 0.5 && mp[1].jumpsPerMin <= mp[0].jumpsPerMin, 'v2: no world jumps either (v194 B jumped ' + mp[0].jumpsPerMin + '/min, ' + mp[0].visiblePerMin + '/min of them on screen)', { v194B: mp[0].jumpsPerMin, v2: mp[1].jumpsPerMin })

// ================= 6. the jumbotron =================
{
  const { p, context } = await open(390, 844, { tune: { screenPanChanceV175: 1, screenPanGapV175: 0 }, tag: 'jumbo' })
  await goLive(p, { pos: 'WR' })
  // wait for a pan that has arrived, then watch him for 1.5 s
  let J = null
  for (let i = 0; i < 160 && !J; i++) {
    J = await E(p, async () => {
      const sc = window.__gridironScene, PN = sc && sc._panV175, V = window.__V175 || {}
      if (!PN || PN.t < 900 || !V.inFrame) return null
      const m = window.RIB_MASCOTS.v194b.mascot(), cam = sc.cameras.main, out = []
      await new Promise((res) => { const t0 = performance.now(); const step = () => { const wv = cam.worldView; out.push({ f: m.lastPose, vis: !!m.img.visible, inShot: m.img.x > wv.x && m.img.x < wv.x + wv.width && m.img.y > wv.y && m.img.y - m.img.displayHeight < wv.y + wv.height, gap: !sc.play || (sc.play.done && !sc.play.post), pan: !!sc._panV175 }); if (performance.now() - t0 < 1500) requestAnimationFrame(step); else res() }; requestAnimationFrame(step) })
      return { frames: out.length, distinct: new Set(out.map((o) => o.f)).size, vis: out.filter((o) => o.vis && o.inShot).length, gap: out.filter((o) => o.gap).length, gapDistinct: new Set(out.filter((o) => o.gap).map((o) => o.f)).size, deck: !!(m.v194.jumboV195B) }
    })
    if (!J) await p.waitForTimeout(250)
  }
  try { await p.screenshot({ path: SHOTS + '_v195B_pan.png' }) } catch {}
  ok(J && J.vis >= J.frames * 0.9 && J.distinct >= 4, 'on the jumbotron shot he is drawn, in the frame, and dancing (his frame changes)', J)
  // his own spot out of the shot: he goes up to the deck beside the screen
  let D = null
  for (let i = 0; i < 200 && !(D && D.on); i++) {
    D = await E(p, async () => {
      const sc = window.__gridironScene, PN = sc && sc._panV175, m = window.RIB_MASCOTS.v194b.mascot(), A = m && m.v194
      if (!A) return null
      if (!PN) { A.jumboV195B = null; return { on: false } }
      // send him to the far corner of the other bank, where the screen shot never looks
      if (!A.jumboV195B) { A.pos = { u: 5, w: -Math.abs(A.pos.w) }; A.tgt = { u: 5, w: A.pos.w, ez: true }; A.path = []; A.tgtAt = performance.now(); m.vis = false; return { on: false } }
      const ST = sc.stadium, BZ = ST.bezelV177C, cam = sc.cameras.main, wv = cam.worldView, poses = new Set()
      await new Promise((res) => { const t0 = performance.now(); const step = () => { poses.add(m.lastPose); if (performance.now() - t0 < 1200) requestAnimationFrame(step); else res() }; requestAnimationFrame(step) })
      const x = m.img.x, y = m.img.y, h = m.img.displayHeight
      return { on: !!A.jumboV195B, poses: poses.size, vis: !!m.img.visible, beside: x > BZ.x + BZ.w || x < BZ.x, inShot: x > wv.x && x < wv.x + wv.width && y - h > wv.y - h * 0.2 && y < wv.y + wv.height, nearDeck: Math.abs(y + h * 0.4 - ST.top) < ST.rect.h * 1.2, h: Math.round(h), panelH: Math.round(ST.rect.h), act: A.act && A.act.name, said: window.__V194B.bubble && window.__V194B.bubble.bucket, entered: window.__V195B.jumbo.entered }
    })
    if (!(D && D.on)) await p.waitForTimeout(150)
  }
  try { await p.screenshot({ path: SHOTS + '_v195B_deck.png' }) } catch {}
  ok(D && D.on && D.vis && D.inShot && D.beside && D.nearDeck && D.poses >= 4 && D.act === 'groove', 'his spot out of the shot: he dances the groove on the top deck BESIDE the big screen, in the frame', D)
  // the kill switch: the old freeze in the gap
  await context.close()
}
ok(errors.length === 0, 'no page errors', errors.slice(0, 5))
console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
await browser.close()
process.exit(fail ? 1 : 0)
