// Dev check: v112 F — THE HIT HAS WEIGHT. A violent collision throws a man: he leaves his feet,
// travels back along the line of the hit, comes down under gravity and skids into the spot the sim
// already booked. This asserts, over ~20 headless games plus one live broadcast:
//   * ONLY THE VIOLENT TAIL FLIES — the share of resolved contacts that launch is a few percent
//     (printed), never a hit that did not move him (`launchMinKb`), never out of a crowd
//     (`launchMaxHands`), never off a v103 grip (a man who was carried did not leave his feet).
//   * THE ARC IS THE COLLISION — `launchV112` is swept directly: `flyVz` rises with the momentum
//     mismatch, the strength edge, the knock-back, the hit stick and the leverage, falls for a hit
//     from behind, and rises as the man who is hit gets lighter against the man who hit him. It is
//     a PURE function — the same inputs give the same number twice, and a field it does not read
//     changes nothing.
//   * HEIGHT, DISTANCE AND HANG ALL COME OUT OF ONE NUMBER — the renderer's flight has
//     dur === 2·vz/g and peak === vz²/2g exactly, and the measured lift peaks at that height.
//   * HE ALWAYS LANDS, INSIDE THE FIELD, AND GETS UP — every drawn point of the flight is between
//     where he was and where the script has him (so never off the field), the lift returns to 0,
//     `_flyV112` clears, and he ends in the down/get-up path.
//   * THE SCOREBOARD CANNOT MOVE — the same seeded game with `launchV112` off and on books an
//     identical score and an identical yard on every play.
//   * NOBODY IS LEFT IN THE AIR — across a live broadcast no marker carries a flight or a lift
//     into a snap.
//   GAME_URL=http://localhost:5206/index.html node scripts/v112Fcheck.mjs
import { chromium } from 'playwright'
const URL = process.env.GAME_URL || 'http://localhost:5173/'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const errs = [], bad = []
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const page = await browser.newPage({ viewport: { width: 400, height: 900 } })
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(2500)   // warm past vite's one-time reload after an edit
await page.waitForFunction(() => typeof window.__simGameV2 === 'function', null, { timeout: 60000 })
await page.evaluate(p => { window.__readPos = p }, process.env.READ_POS || 'RB')
async function step(t) {
  const r = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
      : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className) || /RUN THIS PLAN|LOCK IT IN|CHOOSE/i.test(txt(e)))
        : els.find(e => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null
  }, { t, visSrc: vis })
  console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900)
}

// ================= 1. the sim: who flies, and how often =================
const S = await page.evaluate(() => {
  const FS = window.__FieldSim
  const RESOLVE = { tackleWhiff: 1, hurdle: 1, stiffarm: 1, brokenTackle: 1, bounce: 1, stagger: 1, grab: 1, tackle: 1 }
  const A = {
    plays: 0, contacts: 0, tackles: 0, brokens: 0, flyT: 0, flyB: 0, flyOnDragged: 0, flyBadWho: 0, flyMissingFields: 0,
    flyLowKb: 0, flyOutOfRange: 0, vzOffFormula: 0, vzByPow: {}, vzMulti: 0, minVz: 9, maxVz: 0, minPow: 1e9, maxPow: 0, kbMin: 99
  }
  const scan = (entry) => {
    const log = entry && entry.log ? entry.log : entry; if (!log || !log.events) return
    A.plays++
    for (const e of log.events) {
      if (RESOLVE[e.type] && e.cid != null) A.contacts++
      if (e.type === 'tackle' && e.cid != null && !e.dragged) A.tackles++
      if (e.type === 'brokenTackle') A.brokens++
      if (!e.flyVz) continue
      if (e.type === 'tackle') { A.flyT++; if (e.dragged) A.flyOnDragged++; if (e.flyWho !== e.carrier) A.flyBadWho++ }
      else { A.flyB++; if (e.flyWho !== e.who) A.flyBadWho++ }
      if (!(Number.isFinite(e.flyVz) && Number.isFinite(e.flyPow) && e.flyWho)) A.flyMissingFields++
      if (!(e.kb >= 5)) A.flyLowKb++
      if (e.flyVz < 0.1 - 1e-9 || e.flyVz > 0.17 + 1e-9) A.flyOutOfRange++
      const k = String(e.flyPow); (A.vzByPow[k] = A.vzByPow[k] || {})[String(e.flyVz)] = 1
      // the event alone re-derives the arc: vz = clamp(base + (pow − gate)·K)
      const T = window.TU, want = Math.min(T('launchVzMax', .17), Math.max(T('launchVzMin', .1),
        T('launchVzBase', .1) + (e.flyPow - T('launchGate', 168)) * T('launchVzK', .0011)))
      if (Math.abs(e.flyVz - want) > 5e-5) A.vzOffFormula++
      A.minVz = Math.min(A.minVz, e.flyVz); A.maxVz = Math.max(A.maxVz, e.flyVz)
      A.minPow = Math.min(A.minPow, e.flyPow); A.maxPow = Math.max(A.maxPow, e.flyPow)
      A.kbMin = Math.min(A.kbMin, e.kb)
    }
  }
  const wrap = (name) => {
    const o = FS[name].bind(FS); FS[name] = function (...a) {
      const before = (FS._Q || []).length; const r = o(...a)
      const q = FS._Q || []; for (let i = before; i < q.length; i++) scan(q[i]); return r
    }
  }
  wrap('run'); wrap('pass')
  for (let i = 0; i < Number(window.__V112F_GAMES || 20); i++) window.__simGameV2(400 + i, 'RB')
  // one vz per pow, and vz never falls as pow rises
  const pows = Object.keys(A.vzByPow).map(Number).sort((a, b) => a - b)
  let mono = true, last = -1
  for (const p of pows) { const vs = Object.keys(A.vzByPow[p]); if (vs.length > 1) A.vzMulti++; const v = Number(vs[0]); if (v < last - 1e-9) mono = false; last = v }
  return { ...A, pows: pows.length, mono, vzByPow: undefined }
})
const frac = 100 * (S.flyT + S.flyB) / Math.max(1, S.contacts)
console.log('sim:', JSON.stringify({ plays: S.plays, contacts: S.contacts, launches: S.flyT + S.flyB, carriers: S.flyT, defenders: S.flyB, pctOfContacts: +frac.toFixed(2), perGame: +((S.flyT + S.flyB) / 20).toFixed(2), vz: [S.minVz, S.maxVz], pow: [S.minPow, S.maxPow], distinctPow: S.pows }))
ok(S.plays > 900 && S.contacts > 1500, 'sampled a real body of contact', `${S.plays} plays, ${S.contacts} resolved contacts`)
ok(S.flyT > 10 && S.flyB > 5, 'both men are candidates — carriers stuck, and defenders run through', `${S.flyT} carriers, ${S.flyB} defenders`)
ok(frac > 0.5 && frac < 6, 'ONLY THE VIOLENT TAIL LEAVES HIS FEET (a cartoon is a fail, and so is never)', `${frac.toFixed(2)}% of resolved contacts, ${((S.flyT + S.flyB) / 20).toFixed(1)} per game`)
ok(S.flyMissingFields === 0 && S.flyBadWho === 0, 'every launch names the man who was HIT and carries flyVz/flyPow', `${S.flyBadWho} wrong man, ${S.flyMissingFields} short of fields`)
ok(S.flyOnDragged === 0, 'a man carried in a v103 grip never launches — he was set down, not thrown')
ok(S.flyLowKb === 0 && S.kbMin >= 5, 'a hit that does not MOVE him never launches him', `smallest kb on a launch ${S.kbMin}`)
ok(S.flyOutOfRange === 0, 'flyVz stays inside [launchVzMin, launchVzMax]', `${S.minVz} .. ${S.maxVz}`)
ok(S.pows > 20 && S.vzMulti === 0 && S.mono, 'flyVz is a PURE, non-decreasing function of the collision it measured — nothing else moves it', `${S.pows} distinct powers, ${S.vzMulti} ambiguous`)
ok(S.vzOffFormula === 0, 'and every flyVz re-derives exactly from the flyPow the same event published', `${S.vzOffFormula} off the formula`)

// ================= 2. the arc is the collision: sweep the real function =================
const W = await page.evaluate(() => {
  const L = window.__V112_F_SIM && window.__V112_F_SIM.launch
  if (!L) return { err: 'launchV112 not exposed' }
  const base = { fly: 'CB', by: 'RB', impact: 90, strEdge: 20, kb: 12, stick: false, lev: 0, behind: false, hands: 0 }
  const vz = o => { const r = L(Object.assign({}, base, o)); return r ? r.vz : 0 }
  const g = window.TU('launchG', .001)
  const shape = v => ({ vz: v, dur: v > 0 ? +(2 * v / g).toFixed(1) : 0, peak: v > 0 ? +(v * v / (2 * g)).toFixed(2) : 0 })
  return {
    impact: [40, 70, 100, 130, 170].map(x => vz({ impact: x })),
    strEdge: [-20, 0, 20, 40, 70].map(x => vz({ strEdge: x })),
    kb: [4, 6, 9, 13, 18].map(x => vz({ kb: x })),
    stick: [vz({ stick: false }), vz({ stick: true })],
    lev: [-6, 0, 4, 8].map(x => vz({ lev: x })),
    behind: [vz({ behind: false }), vz({ behind: true })],
    mass: ['DL', 'LB', 'CB'].map(p => vz({ fly: p })),     // heavier man, same hit: he goes less far
    hands: [vz({ hands: 0 }), vz({ hands: 1 }), vz({ hands: 2 })],
    twice: [vz({}), vz({})],
    unrelated: [vz({}), vz({ nonsense: 12345, style: 'high' })],
    off: (() => { window.RIB_TUNE.launchV112 = 0; const v = vz({}); delete window.RIB_TUNE.launchV112; return v })(),
    shapes: [0.1, 0.135, 0.17].map(shape), g
  }
})
console.log('sweep:', JSON.stringify(W))
const rises = a => a.every((v, i) => i === 0 || v >= a[i - 1]) && a[a.length - 1] > a[0]
const falls = a => a.every((v, i) => i === 0 || v <= a[i - 1]) && a[a.length - 1] < a[0]
ok(!W.err, 'the sim\'s launchV112 is reachable for the sweep', W.err || 'ok')
ok(rises(W.impact), 'a bigger momentum mismatch throws him further', JSON.stringify(W.impact))
ok(rises(W.strEdge), 'and so does a bigger strength edge', JSON.stringify(W.strEdge))
ok(rises(W.kb) && W.kb[0] === 0, 'and a bigger knock-back — below launchMinKb he does not leave his feet at all', JSON.stringify(W.kb))
ok(W.stick[1] > W.stick[0], 'a hit stick throws him further than the same hit without one', JSON.stringify(W.stick))
ok(rises(W.lev), 'a hitter who got under his pads throws him further', JSON.stringify(W.lev))
ok(W.behind[1] < W.behind[0], 'a hit from behind hauls him down instead of launching him', JSON.stringify(W.behind))
ok(rises(W.mass), 'the LIGHTER the man who is hit, the further the same hit moves him (DL → LB → CB)', JSON.stringify(W.mass))
ok(W.hands[0] > 0 && W.hands[1] > 0 && W.hands[2] === 0, 'nobody is launched out of a crowd', JSON.stringify(W.hands))
ok(W.twice[0] === W.twice[1] && W.twice[0] > 0, 'the same collision gives the same number twice — no roll, no drift', JSON.stringify(W.twice))
ok(W.unrelated[0] === W.unrelated[1], 'and a field it does not read changes nothing', JSON.stringify(W.unrelated))
ok(W.off === 0, 'launchV112 at 0 turns every launch off')
ok(W.shapes.every(s => Math.abs(s.dur - 2 * s.vz / W.g) < .05 && Math.abs(s.peak - s.vz * s.vz / (2 * W.g)) < .01)
  && W.shapes[2].dur > W.shapes[0].dur && W.shapes[2].peak > W.shapes[0].peak,
  'height AND hang both come out of the one launch speed (2v/g, v²/2g) — they cannot fight each other', JSON.stringify(W.shapes))

// ================= 3. the scoreboard cannot move =================
// __simGameV2 draws from Math.random, so a bare seed does not reproduce a game. Pin Math.random to
// a seeded generator and every roll in the engine repeats exactly — which is the only way to prove
// that turning the launch on changes NOTHING about a play the sim has already resolved.
const N = await page.evaluate(() => {
  const real = Math.random
  const seedRandom = (s) => { let x = s >>> 0; Math.random = () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296 } }
  const one = (off) => {
    if (off) Object.assign(window.RIB_TUNE, { launchV112: 0, flyV112: 0 })
    else { delete window.RIB_TUNE.launchV112; delete window.RIB_TUNE.flyV112 }
    const rows = []
    for (let g = 0; g < 8; g++) {
      seedRandom(981723 + g * 7717)
      const r = window.__simGameV2(400 + g, 'RB')
      rows.push(r.usScore + ':' + r.themScore + '|' + r.team.yds + '/' + r.oppTeam.yds + '|' +
        r.plays.map(p => (p.event || '') + ',' + (p.yards ?? '') + ',' + (p.scored ? 1 : 0)).join(';'))
    }
    return rows
  }
  let out
  try {
    const a = one(false), b = one(true), c = one(false)
    let same = 0, diffAt = null, launched = 0
    for (let i = 0; i < a.length; i++) { if (a[i] === b[i]) same++; else if (diffAt == null) diffAt = i }
    out = { games: a.length, same, diffAt, selfSame: a.every((r, i) => r === c[i]), len: a[0].length, launched }
  } finally { Math.random = real; delete window.RIB_TUNE.launchV112; delete window.RIB_TUNE.flyV112 }
  return out
})
console.log('neutral:', JSON.stringify(N))
ok(N.selfSame, 'the seeded game is reproducible at all (the comparison means something)', `${N.games} games re-run identically`)
ok(N.same === N.games, 'THE SPOT IS SET BEFORE THE ARC PLAYS OUT — every seeded play books the identical yard with the launch off and on', `${N.same}/${N.games} games byte-identical`)

// ================= 4. the renderer: the flight, the landing, the skid =================
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN']) await step(t)
let live = false
for (let i = 0; i < 6 && !live; i++) {
  for (const t of ['CONTINUE TO MATCH', 'Continue to Match', 'PLAY', 'CONTINUE']) {
    live = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length)); if (live) break
    await step(t)
  }
  live = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length))
  if (!live) await page.waitForTimeout(2500)
}
ok(live, 'the broadcast came up')

// arm an in-page sampler: every flight records its own shape, frame by frame, from placeMarker's own numbers
await page.evaluate(() => {
  const sc = window.__gridironScene
  window.__V112F_TRACE = []
  const o = sc.flyStartV112.bind(sc)
  sc.flyStartV112 = function (m, vz, spin) {
    const r = o(m, vz, spin); if (!r) return r
    const F = m._flyV112, T = { vz, dur: F.dur, peak: F.peak, pts: [], states: [], done: false, who: sc.markers.indexOf(m) }
    window.__V112F_TRACE.push(T)
    const tick = () => {
      const FL = m._flyV112
      T.states.push(String(m.forceState || ''))
      // only sample points placeMarker actually DREW (fx/fy are written there) — the first rAF can
      // land before the next draw, and a sample with nothing in it would quietly pass every test
      if (FL) { if (Number.isFinite(FL.fx)) T.pts.push({ lift: FL.lift || 0, fx: FL.fx, fy: FL.fy, sx: m.sx, sy: m.sy, x0: FL.x0, y0: FL.y0, k: FL.k }); requestAnimationFrame(tick) }
      else { T.done = true; T.endLift = 0; T.endState = String(m.forceState || ''); T.grounded = !!m._groundT }
    }
    requestAnimationFrame(tick); return r
  }
})
// drive a launched tackle at three launch speeds, plus a launched truck, on the live field
const R = await page.evaluate(async (vzs) => {
  const sc = window.__gridironScene
  const wait = ms => new Promise(r => setTimeout(r, ms))
  const ready = async () => {
    for (let i = 0; i < 600; i++) {
      const P = sc.play
      if (P && P.script && P.snapped && P.carrierId >= 0 && P.carrierId < 11 && sc.markers.length >= 22 && sc.markers[P.carrierId] && sc.markers[13] && sc.markers[13].root) return P
      const b = [...document.querySelectorAll('button')].find(x => /^CONTINUE$/i.test((x.innerText || '').trim()) && x.offsetParent); if (b) b.click()
      await wait(40)
    }
    return null
  }
  const out = []
  for (const vz of vzs) {
    const P = await ready(); if (!P) { out.push({ err: 'no live play' }); continue }
    const cmI = P.carrierId, cm = sc.markers[cmI], tk = sc.markers[13], carrier = 'off' + cmI
    tk.sx = cm.sx + 9; tk.sy = cm.sy + 5
    const x = cm.sx, y = cm.sy
    sc.fireEvent({
      t: P.t, type: 'tackle', tackler: 'def2', carrier, x, y, gang: false, bigHit: true, bothFall: false, stayUp: false,
      kb: 15, drive: 0, sup: [], style: 'even', hitStick: true, handsOn: 0,
      cid: 7100 + Math.round(vz * 1000), ix: (x + tk.sx) / 2, iy: (y + tk.sy) / 2, nx: -0.86, ny: -0.5, impact: 120, side: 1,
      flyWho: carrier, flyVz: vz, flyPow: 330
    }, P)
    out.push({ vz, armed: !!cm._flyV112 })
    await wait(2400)
  }
  // the defender's half: a truck that takes him off his feet
  const P = await ready()
  let truck = { err: 'no live play' }
  if (P) {
    const d = sc.markers[15], cm = sc.markers[P.carrierId]
    sc.fireEvent({
      t: P.t, type: 'brokenTackle', who: 'def4', carrier: 'off' + P.carrierId, x: d.sx, y: d.sy, kb: 16, hitStick: true, quiet: false,
      cid: 7300, ix: d.sx, iy: d.sy, nx: .7, ny: -.7, impact: 110, side: -1, flyWho: 'def4', flyVz: 0.15, flyPow: 300
    }, P)
    truck = { armed: !!d._flyV112, dur: d._flyV112 && Math.round(d._flyV112.dur) }
    await wait(2400)
  }
  return { out, truck, hook: JSON.parse(JSON.stringify(window.__V112_F || {})), trace: window.__V112F_TRACE.map(t => ({ ...t, pts: t.pts })) }
}, [0.1, 0.135, 0.17])
const F_TOP = 14, F_BOT = 426
const T = (R.trace || []).filter(t => t.pts.length > 4)
const shape = T.map(t => {
  const maxLift = Math.max(...t.pts.map(p => p.lift))
  let offSegX = 0, offSegY = 0, offField = 0, notFinite = 0, worst = null
  for (const p of t.pts) {
    if (!(Number.isFinite(p.fx) && Number.isFinite(p.fy))) { notFinite++; worst = worst || p; continue }
    if (p.fx < Math.min(p.x0, p.sx) - .01 || p.fx > Math.max(p.x0, p.sx) + .01) { offSegX++; worst = worst || p }
    if (p.fy < Math.min(p.y0, p.sy) - .01 || p.fy > Math.max(p.y0, p.sy) + .01) { offSegY++; worst = worst || p }
    if (p.fy < F_TOP - .01 || p.fy > F_BOT + .01) { offField++; worst = worst || p }
  }
  return {
    vz: t.vz, dur: Math.round(t.dur), peak: +t.peak.toFixed(2), maxLift: +maxLift.toFixed(2), frames: t.pts.length,
    kEnd: +t.pts[t.pts.length - 1].k.toFixed(3), done: t.done, endState: t.endState, grounded: t.grounded,
    between: !offSegX && !offSegY && !offField && !notFinite, offSegX, offSegY, offField, notFinite, worst,
    fy: [Math.min(...t.pts.map(p => p.fy)).toFixed(1), Math.max(...t.pts.map(p => p.fy)).toFixed(1)],
    sawDive: t.states.indexOf('dive') >= 0, sawDown: t.states.indexOf('down') >= 0
  }
})
console.log('flights:', JSON.stringify(shape))
console.log('hook:', JSON.stringify(R.hook), 'truck:', JSON.stringify(R.truck))
ok(R.out.every(o => o.armed) && R.out.length === 3, 'a launched tackle arms the flight on the carrier at every launch speed', JSON.stringify(R.out))
ok(R.truck && R.truck.armed, 'and a launched truck arms it on the DEFENDER who was run through', JSON.stringify(R.truck))
ok(shape.length >= 4, 'every flight was sampled frame by frame', `${shape.length} traced`)
ok(shape.every(s => Math.abs(s.dur - 2 * s.vz / W.g) < 1 && Math.abs(s.peak - s.vz * s.vz / (2 * W.g)) < .02),
  'the renderer\'s hang and height are exactly 2v/g and v²/2g', JSON.stringify(shape.map(s => [s.vz, s.dur, s.peak])))
ok(shape.every(s => s.maxLift > s.peak * 0.7 && s.maxLift <= s.peak + 1e-6), 'and the MEASURED lift actually reaches that height', JSON.stringify(shape.map(s => [s.peak, s.maxLift])))
{
  const byVz = shape.filter(s => s.vz === 0.1 || s.vz === 0.17)
  const lo = byVz.find(s => s.vz === 0.1), hi = byVz.find(s => s.vz === 0.17)
  ok(!!lo && !!hi && hi.peak > lo.peak && hi.dur > lo.dur, 'a harder hit goes higher AND hangs longer, off the one number', JSON.stringify([lo && [lo.peak, lo.dur], hi && [hi.peak, hi.dur]]))
}
ok(shape.every(s => s.between), 'EVERY drawn point of the flight is between where he was and where the script has him — he can never land off the field',
  JSON.stringify(shape.map(s => ({ x: s.offSegX, y: s.offSegY, field: s.offField, nan: s.notFinite, fy: s.fy }))))
ok(shape.every(s => s.done && s.kEnd > 0.98), 'he always lands: the flight pays off the whole ground it held back, and clears itself', JSON.stringify(shape.map(s => s.kEnd)))
ok(shape.every(s => s.sawDive && s.sawDown), 'he is in the air on the dive frames and on the turf the moment he lands')
ok(shape.every(s => s.grounded || /^(down|tackleSeq|getupSeq)$/.test(s.endState)), 'and he hands off to the down / get-up path', JSON.stringify(shape.map(s => s.endState)))
ok(R.hook.launches >= 4 && R.hook.lands === R.hook.launches && R.hook.ends === R.hook.launches,
  'every launch landed and every landing finished — nobody is left in the air', JSON.stringify({ launches: R.hook.launches, lands: R.hook.lands, ends: R.hook.ends }))

// ================= 5. nobody carries a flight into the next snap =================
const A = await page.evaluate(async () => {
  const sc = window.__gridironScene, wait = ms => new Promise(r => setTimeout(r, ms))
  const a = { polls: 0, presnap: 0, midairAtSnap: 0, liftAtSnap: 0, worst: 0, plays: 0 }
  let lastTok = null
  for (let i = 0; i < 700; i++) {
    const b = [...document.querySelectorAll('button')].find(x => /^CONTINUE$/i.test((x.innerText || '').trim()) && x.offsetParent); if (b) b.click()
    const P = sc.play; a.polls++
    if (P && P.__ballTokenV1514 !== lastTok) { lastTok = P.__ballTokenV1514; a.plays++ }
    if (P && !P.snapped) {
      a.presnap++
      for (const m of sc.markers) {
        if (!m) continue
        if (m._flyV112) a.midairAtSnap++
        const lift = (m._flyV112 && m._flyV112.lift) || 0
        if (lift > 0.01) { a.liftAtSnap++; a.worst = Math.max(a.worst, lift) }
      }
    }
    await wait(45)
  }
  return a
})
console.log('presnap watch:', JSON.stringify(A))
ok(A.presnap > 20, 'watched a real run of pre-snap frames', `${A.presnap} of ${A.polls} polls, ~${A.plays} plays`)
ok(A.midairAtSnap === 0 && A.liftAtSnap === 0, 'NO MAN IS EVER DRAWN IN THE AIR WHEN THE NEXT PLAY STARTS', `${A.midairAtSnap} flights, ${A.liftAtSnap} lifted (worst ${A.worst})`)

console.log(JSON.stringify({ pass, fail, errors: errs.length, badRequests: bad.length }))
if (errs.length) console.log('page errors:\n' + errs.slice(0, 8).join('\n')); else console.log('page errors: none')
if (bad.length) console.log('bad requests:\n' + bad.slice(0, 5).join('\n'))
await browser.close()
process.exit(fail ? 1 : 0)
