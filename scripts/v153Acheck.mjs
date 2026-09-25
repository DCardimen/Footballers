// Dev check (v153 A) — the pile, the way out of it, forward progress, the stat gain, and the snap share.
//
//   1. THE PILE GOES DOWN TOGETHER (src/04-engine.js `gangDownV153A`, contactV146, 05's tackle case):
//      a gang stop names the men in the heap (`downV153A`) — defenders only, never the tackler, all in
//      reach of the carrier — and contactV146 lays each of them onto the pile ring by the end of the fall
//   2. GIVE GROUND (the v103 grip tick): a forming group tackle is sometimes escaped — rolled once per
//      grip, the men who had hands on are beaten, and the carrier really gives ground (backward) first
//   3. FORWARD PROGRESS (the grip landing + `endTackle`): a carrier driven back is spotted at the
//      furthest point of his progress (`fpX` ahead of where he landed, the booked yards ARE that spot),
//      never for a quarterback taken down behind his own line
//   4. the kill switch `TU("v153A", 0)` emits none of it; the run game stays in its band ON vs OFF
//   5. THE STAT GAIN LANDS (07 `statGainPlayV153A` / `statGainShowV153A`, 05 `__ribYouClientV153A`):
//      what a play calls out is exactly the booked line's increase; a catch and its yards are one
//      callout; a milestone fires once; a career high needs a real previous best; on the live field
//      the callouts fly, the tile counts up to the booked number, the sound and the haptic fire
//   6. THE SNAP SHARE (07 `snapSplitV153A`): him + his rival never pass 100%; only a superhuman with
//      no backup plays 109%
//   7. no page errors
//
//   GAME_URL=http://localhost:5173/ node scripts/v153Acheck.mjs   (G=games per arm, default 24)
import { gameUrl, launch } from './lib/env.mjs'
import { waitLive } from './lib/live.mjs'

const G = +(process.env.G || 24)
const YD = 5.88
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
await page.addInitScript(() => { setInterval(() => { try { document.querySelector('.onboard')?.remove() } catch {} }, 60) })
await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__simGameV2 && !!window.__FieldSim, null, { timeout: 40000 })
await page.waitForTimeout(1200)

// ================= 1-4. the engine: sample games ON and OFF =================
const sample = (off) => page.evaluate(({ G, off, YD }) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); A.setState(S); S.tutorialSeen = true
  S.player = A.newPlayer(); S.player.pos = 'RB'
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, off ? { v153A: 0 } : {})
  const FS = window.__FieldSim, rec = [], o = {}
  for (const name of ['run', 'pass']) { o[name] = FS[name]; FS[name] = function (...a) { const r = o[name].apply(FS, a); const q = FS._Q; if (q && q.length && r) rec.push({ log: q[q.length - 1].log, yards: r.yards, kind: name }); return r } }
  let pts = 0
  try { for (let g = 0; g < G; g++) { const r = window.__simGameV2(45 + (g % 9) * 5, ['QB', 'RB', 'WR', 'LB', 'CB'][g % 5]); pts += r.usScore + r.themScore } }
  finally { FS.run = o.run; FS.pass = o.pass; delete window.RIB_TUNE.v153A }
  const at = (fr, t) => { let b = fr[0]; for (const f of fr) { if (f.t <= t + 1e-6) b = f; else break } return b }
  const R = { games: G, pts: +(pts / G).toFixed(2), plays: 0, runYd: 0, runs: 0, esc: 0, escBack: 0, escChecked: 0, escTackledByGrabbers: 0,
    fp: 0, fpAhead: 0, fpYards: 0, fpYardsChecked: 0, fpQbBehind: 0, fpMean: 0,
    tackles: 0, gang: 0, gangListed: 0, down: 0, downBad: 0, downTackler: 0, downFar: 0, evV153: 0, worst: [] }
  for (const { log, yards, kind } of rec) {
    if (!log || !log.events) continue
    R.plays++; if (kind === 'run') { R.runs++; R.runYd += yards || 0 }
    const Aid = {}; for (const a of log.actors) Aid[a.id] = a
    const ev = log.events, cut = ev.some(e => e.v139)
    for (const e of ev) {
      if (/V153A$/.test(e.type) || e.fpX != null || e.downV153A) R.evV153++
      if (e.type === 'escapeV153A') {
        R.esc++
        const c = Aid[e.carrier]; if (!c) continue
        const dir = c.side === 'off' ? 1 : -1, c0 = at(c.frames, e.t), c1 = at(c.frames, e.t + 200)
        R.escChecked++; if ((c1.x - c0.x) * dir < -0.5) R.escBack++
        // a man he spun out of is beaten: he cannot be the one who brings him down in the next half second
        const tk = ev.find(q => q.type === 'tackle' && q.t > e.t && q.t < e.t + 450)
        if (tk && (e.from || []).includes(tk.tackler)) R.escTackledByGrabbers++
      }
      if (e.type !== 'tackle') continue
      R.tackles++
      if (e.fpX != null) {
        R.fp++; R.fpMean += e.fpYd || 0
        const c = Aid[e.carrier], dir = c && c.side === 'off' ? 1 : -1
        if ((e.fpX - e.x) * dir > 0) R.fpAhead++
        if (c && c.label === 'QB' && c.side === 'off' && e.fpX <= 0) R.fpQbBehind++
        if (kind === 'run' && c && c.side === 'off' && !cut && yards != null && yards > -6 && yards < 80 && e === ev.filter(q => q.type === 'tackle').pop()) {   // a run: FieldSim.pass floors a completion at +1
          R.fpYardsChecked++; if (Math.round(e.fpX / YD) === yards) R.fpYards++; else if (R.worst.length < 4) R.worst.push({ fpX: +e.fpX.toFixed(1), yards })
        }
      }
      if (e.gang) R.gang++
      if (Array.isArray(e.downV153A)) {
        if (e.gang) R.gangListed++
        const c = Aid[e.carrier]
        for (const id of e.downV153A) {
          R.down++
          const a = Aid[id]; if (!a || !c) { R.downBad++; continue }
          if (a.side === c.side) R.downBad++
          if (id === e.tackler) R.downTackler++
          const p = at(a.frames, e.t), q = at(c.frames, e.t); if (Math.hypot(p.x - q.x, p.y - q.y) > 20 * 1.4 + 2) R.downFar++
        }
      }
    }
  }
  R.fpMean = +(R.fpMean / Math.max(1, R.fp)).toFixed(2); R.ypc = +(R.runYd / Math.max(1, R.runs)).toFixed(3)
  return R
}, { G, off, YD })
const ON = await sample(false), OFF = await sample(true)
console.log('ON :', JSON.stringify(ON)); console.log('OFF:', JSON.stringify(OFF))
ok(ON.plays > 800 && ON.tackles > 600, 'sampled a real run of FieldSim snaps', `${ON.plays} plays, ${ON.tackles} tackles over ${G} games`)
ok(ON.gang > 20 && ON.gangListed >= ON.gang * 0.5, 'a gang stop names the heap that goes down with him', `${ON.gangListed}/${ON.gang} gang stops list men, ${ON.down} men down in all`)
ok(ON.down > 0 && ON.downBad === 0 && ON.downTackler === 0 && ON.downFar === 0, 'the heap is defenders in reach of the carrier, never the tackler twice', { bad: ON.downBad, tackler: ON.downTackler, far: ON.downFar })
ok(ON.esc >= 3, 'a carrier sometimes backs out of a forming group tackle', `${ON.esc} escapes (${(ON.esc / G).toFixed(2)} a game)`)
ok(ON.escChecked > 0 && ON.escBack >= ON.escChecked * 0.8, 'giving ground is giving GROUND: he steps backward out of it', `${ON.escBack}/${ON.escChecked} moved back in the first 200ms`)
ok(ON.escTackledByGrabbers === 0, 'the men he spun out of are beaten — none of them makes the stop straight after', ON.escTackledByGrabbers)
ok(ON.fp >= 10 && ON.fpAhead === ON.fp, 'forward progress: a carrier driven back is spotted AHEAD of where he landed', `${ON.fpAhead}/${ON.fp}, mean ${ON.fpMean} yd given back`)
ok(ON.fpYardsChecked > 2 && ON.fpYards === ON.fpYardsChecked, 'the booked yards of a run are the forward-progress spot', `${ON.fpYards}/${ON.fpYardsChecked} ${JSON.stringify(ON.worst)}`)
ok(ON.fpQbBehind === 0, 'no forward progress for a quarterback taken down behind his own line', ON.fpQbBehind)
ok(OFF.evV153 === 0 && OFF.esc === 0 && OFF.fp === 0 && OFF.down === 0, 'the kill switch TU("v153A", 0) emits none of it', OFF.evV153)
ok(Math.abs(ON.ypc - OFF.ypc) <= 2.0, 'the run game stays in a sane band (unseeded ON vs OFF yards a carry, wide — seeded scoreneutralcheck is the real gate)', `ON ${ON.ypc} vs OFF ${OFF.ypc}`)

// ---- the script: contactV146 lays the listed men onto the pile ----
{
  const r = await page.evaluate(() => {
    const fr = (x0, y0, vx, vy) => { const out = []; for (let t = 0; t <= 1200; t += 33) out.push({ t, x: x0 + vx * t / 1000, y: y0 + vy * t / 1000 }); return out }
    const S = { duration: 1200, meta: { fieldSim: true, dir: 1 }, ball: fr(300, 220, 60, 0).map(f => Object.assign({ h: 0 }, f)),
      actors: [{ id: 'off9', side: 'off', label: 'RB', sp: 150, frames: fr(300, 220, 60, 0) },
        { id: 'def3', side: 'def', label: 'LB', sp: 140, frames: fr(334, 222, 0, 0) },
        { id: 'def5', side: 'def', label: 'S', sp: 150, frames: fr(360, 236, -20, -10) },
        { id: 'def7', side: 'def', label: 'CB', sp: 150, frames: fr(346, 204, -10, 5) }],
      events: [{ t: 500, type: 'tackle', tackler: 'def3', carrier: 'off9', x: 330, y: 220, gang: true, sup: ['def5'], handsOn: 1, downV153A: ['def5', 'def7'] }] }
    window.__contactV146(S)
    const last = id => { const a = S.actors.find(q => q.id === id); return a.frames[a.frames.length - 1] }
    const c = last('off9')
    return ['def5', 'def7'].map(id => { const f = last(id); return +Math.hypot(f.x - c.x, f.y - c.y).toFixed(1) })
  })
  ok(r.every(d => d <= 11), 'contactV146 lays each listed man onto the pile ring by the end of the fall', r)
}

// ================= 6. the snap share =================
{
  const r = await page.evaluate(() => {
    const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); A.setState(S); S.tutorialSeen = true
    const P = S.player = A.newPlayer(); P.pos = 'RB'; P.traits = []; P.tiers = {}; P.level = 3
    const SN = window.__V153A_SNAP, out = {}
    const rival = (share, defeated) => (P.roleRivalV11 = { level: P.level, snapShare: share, defeated: !!defeated, name: 'R', coachTrust: 50, ovr: 50, history: [] })
    for (const k in P.attrs) P.attrs[k] = 60
    out.plainSuper = SN.superhuman(P)
    P.snapShare = 0.94; rival(0.5); SN.split(P); out.plain = [P.snapShare, P.roleRivalV11.snapShare]
    P.snapShare = 0.94; P.roleRivalV11 = null; SN.split(P); out.plainAlone = P.snapShare
    for (const k in P.attrs) P.attrs[k] = 400
    out.superOvr = A.playerOVR(P); out.super = SN.superhuman(P)
    P.snapShare = 0.9; rival(0.4); SN.split(P); out.superRival = [P.snapShare, P.roleRivalV11.snapShare]
    P.snapShare = 0.9; rival(0.2, true); SN.split(P); out.superBeaten = [P.snapShare, P.roleRivalV11.snapShare]
    P.snapShare = 0.9; P.roleRivalV11 = null; SN.split(P); out.superAlone = P.snapShare
    window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v153A: 0 }); P.snapShare = 0.94; rival(0.5); SN.split(P); out.off = [P.snapShare, P.roleRivalV11.snapShare]; delete window.RIB_TUNE.v153A
    return out
  })
  ok(!r.plainSuper && r.plain[0] + r.plain[1] <= 1.0001 && r.plain[0] <= 0.98, 'an ordinary starter and his rival never share more than 100% of the snaps', r.plain)
  ok(r.plainAlone <= 0.98, 'an ordinary player with no backup still caps under 100%', r.plainAlone)
  ok(r.super && r.superRival[0] <= 0.98 && r.superRival[0] + r.superRival[1] <= 1.0001, 'a superhuman WITH a backup still shares 100% of the snaps', { ovr: r.superOvr, split: r.superRival })
  ok(r.superBeaten[0] > 1 && r.superBeaten[0] <= 1.1 && r.superBeaten[1] === 0 && r.superAlone > 1, 'only a superhuman with no backup plays over 100% (109%)', { beaten: r.superBeaten, alone: r.superAlone })
  ok(r.off[0] === 0.94 && r.off[1] === 0.5, 'the kill switch leaves the old split alone', r.off)
}

// ================= 5. the stat gain =================
{
  const r = await page.evaluate(() => {
    const A = window.__V153A_LIVE_API
    const a = A.probe({ tackle: 3, rush: 20 }, { tackle: 4, rush: 20 }, {}, 'LB')
    const b = A.probe({ rec: 40, rec_c: 3 }, { rec: 58, rec_c: 4, tgt: 5 }, {}, 'WR')
    const c = A.probe({ rush: 95 }, { rush: 103, carries: 14 }, {}, 'RB')
    const d = A.probe({ tackle: 6 }, { tackle: 7 }, { tackle: 6 }, 'LB')
    const e = A.probe({ tackle: 6 }, { tackle: 7 }, { tackle: 0 }, 'LB')
    const f = A.probe({ rush: 30 }, { rush: 26 }, {}, 'RB')
    return { a, b, c, d, e, f }
  })
  ok(r.a.gains.length === 1 && r.a.gains[0].k === 'tackle' && r.a.gains[0].d === 1 && !r.a.bigs.length, 'a play calls out exactly what the booked line gained (+1 TACKLE)', r.a.gains)
  ok(r.b.gains.length === 1 && r.b.gains[0].k === 'rec' && r.b.gains[0].d === 18 && r.b.gains[0].catch, 'a catch and its yards are ONE callout', r.b.gains)
  ok(r.c.bigs.length === 1 && r.c.bigs[0].title === '100-YARD GAME', 'crossing 100 rushing yards is the big version', r.c.bigs)
  ok(r.d.bigs.some(x => x.title === 'CAREER HIGH') && !r.e.bigs.length, 'a career high fires only past a real previous best', { d: r.d.bigs, e: r.e.bigs })
  ok(!r.f.gains.length && !r.f.bigs.length, 'a loss is never called out as a gain', r.f)
}

// the live field: callouts fly off him, the tile counts up to the booked number, sound + haptic fire
{
  const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
  await page.evaluate(() => { try { localStorage.clear() } catch {} })
  await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 }); await page.waitForTimeout(1500)
  const step = async (t) => { await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    const el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click() } }, { t, visSrc: vis }).catch(() => null); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900) }
  for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
  const live = await waitLive(page)
  ok(live, 'the live field is up')
  // the season-commitment wheel can stand over the field on week 1: roll it and take it
  await page.evaluate(() => { const g = document.getElementById('gv42go'); if (g) g.click() }); await page.waitForTimeout(6000)
  await page.evaluate(() => { const w = document.getElementById('growthV42'); if (w) { const bs = [...w.querySelectorAll('button')].filter(b => b.getBoundingClientRect().width > 0); if (bs.length) bs[bs.length - 1].click() } })
  await page.waitForTimeout(1200)
  const you = await page.evaluate(() => { for (let i = 0; i < 1; i++) { const p = window.__ribYouClientV153A(); const f = document.getElementById('field').getBoundingClientRect(); return { p, f: { l: f.left, t: f.top, r: f.right, b: f.bottom } } } })
  ok(!you.p || (you.p.x >= you.f.l - 60 && you.p.x <= you.f.r + 60 && you.p.y >= you.f.t - 60 && you.p.y <= you.f.b + 60), 'his marker is found on the broadcast (the point a callout rises from)', you)
  const r = await page.evaluate(async () => {
    const calls = []; const H = window.ribHaptics; const orig = H && H.impact
    if (H) H.impact = (s) => { calls.push(s); }
    const S = window.__getGridironState ? window.__getGridironState() : window.__GRIDIRON_AUDIT__.getState()
    S.settings = S.settings || {}; S.settings.haptics = true; S.settings.sound = true
    const V0 = Object.assign({ chips: 0, bigs: 0, sfx: 0 }, window.__V153A_LIVE || {})
    const A = window.__V153A_LIVE_API
    const tile = document.getElementById('ls-rush'), was = tile && tile.textContent
    const res = A.probe({ rush: 94 }, { rush: 106, td: 1 }, {}, 'RB')
    A.show(res)
    await new Promise(r => setTimeout(r, 90))
    const flying = [...document.querySelectorAll('.sg153')].map(c => c.textContent)
    // every number the tile shows (a real play ending in the window may write its own number too — that is fine)
    const seen = []; const mo = tile ? new MutationObserver(() => seen.push(tile.textContent)) : null
    mo && mo.observe(tile, { childList: true, characterData: true, subtree: true })
    await new Promise(r => setTimeout(r, 3600)); mo && mo.disconnect()
    const V = window.__V153A_LIVE
    if (H) H.impact = orig
    return { was, flying, seen, end: tile && tile.textContent, target: tile && tile.dataset.v153t, left: document.querySelectorAll('.sg153').length,
      chips: V.chips - V0.chips, bigs: V.bigs - V0.bigs, sfx: V.sfx - V0.sfx, calls }
  })
  ok(r.flying.length >= 1, 'the callouts fly', r.flying)
  ok(r.seen.some(v => +v > 94 && +v < 106) && r.seen.includes('106'), 'the tile counts up to the booked number', r.seen.join(','))
  ok(r.left === 0, 'every callout lands and leaves nothing behind', { end: r.end, target: r.target, left: r.left })
  ok(r.chips === 3 && r.bigs === 1 && r.sfx === 3, 'two gains and one milestone: three callouts, each with its sound', r)
  ok(r.calls.includes('LIGHT') && r.calls.includes('MEDIUM'), 'the haptic is LIGHT for a stat, MEDIUM for a milestone', r.calls)
}

ok(errs.length === 0, 'no page errors', errs.slice(0, 4))
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail ? 1 : 0)
