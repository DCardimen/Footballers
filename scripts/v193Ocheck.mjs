// Dev check: v193 O — THE SEASON'S GROWTH, FELT · HAPTICS · EVERY POINT LANDS (src/07-career-app.js, src/26-platform.js,
// src/31-legacy.js, src/17-pregame-wheel.js, src/11-pregame-v1513.js, src/05-field-renderer.js).
//   1 the snapshot: `player.attrsAtSeasonStartV193O` is taken when the season's games start; the season's end writes
//     `player.growV193O {from, to}` from it (whole numbers) and re-takes it
//   2 the WHAT CHANGED card on the report (under the report card, on the GRADE tab): every moved attribute, old → new
//     exactly as the record, the biggest gain first; the bars ANIMATE (the width changes over time) and SETTLE on the new
//     values; the chips, the OVR and the total line land; the Legacy medal card sits under it; while it plays the pot and
//     the XP pour wait (`__V193O.busy()`)
//   3 a tap skips to the end state at once
//   4 prefers-reduced-motion: the end state, no transition
//   5 `window.ribHaptic`: a no-op under navigator.webdriver; with ?haptics=1 it calls navigator.vibrate (stubbed) on the
//     growth bars, a node buy, a medal claim and the plan's roll reveal; one per 40 ms (a stronger kind still lands)
//   6 Settings › SOUND › Vibration turns it off (localStorage rib.haptics.v193) and back on
//   7 EVERY POINT LANDS: a +1 on the skill sheet pops; a +1 across a grade tier names it and buzzes a reward
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v193Ocheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const base = gameUrl('index.html')
const Q = (q = '') => base + (base.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132' + q
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
async function open (q, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, ...opts })
  await ctx.addInitScript(() => {
    try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
    setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80)
  })
  const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(String(e.message || e)))
  await page.goto(Q(q), { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V193O && !!window.ribHaptic, null, { timeout: 40000 })
  await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  await page.evaluate(() => document.getElementById('splash')?.remove())
  return { ctx, page }
}
// a season from the audit hooks: the snapshot at the start, three attributes moved in-season, the weeks played, the end
const season = (page) => page.evaluate(() => {
  window.__vib = []; navigator.vibrate = (p) => { window.__vib.push(p); return true }
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; S.tree = S.tree || {}; A.setState(S)
  S.player = A.newPlayer(); const p = S.player; p.name = 'Grow Man'; p.originV11 = 'walk-on'; p.pos = 'RB'; p.age = 14; p._wonShown = true; p.level = 3; p.training = 'balanced'; p.points = 0; p.traits = []
  window.startSeasonGames()
  const snap = Object.assign({}, p.attrsAtSeasonStartV193O)
  p.attrs.speed += 4; p.attrs.agility += 2; p.attrs.throwing = Math.max(1, p.attrs.throwing - 6)   // the points spent between weeks (and a knock)
  window.go('season')
  p.weekResults.forEach((w) => { w.played = true; if (!w.statLine) w.statLine = {} })
  const t0 = performance.now()
  window.finishSeasonGames()
  return { snap, attrs: Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, Math.round(v)])), rec: JSON.parse(JSON.stringify(p.growV193O || null)), view: S.view, t0 }
})

// ============================== 1-2: the record and the card, animated (haptics on) ==============================
{
  const { ctx, page } = await open('&haptics=1')
  const H0 = await page.evaluate(() => ({ fn: typeof window.ribHaptic, kinds: window.ribHaptic.kinds, s: window.ribHaptic.stats() }))
  ok(H0.fn === 'function' && ['tick', 'tap', 'select', 'success', 'warning', 'error', 'heavy', 'reward'].every((k) => H0.kinds.includes(k)), 'window.ribHaptic exists with every kind', H0.kinds)
  const R = await season(page)
  ok(R.view === 'result' && R.rec && R.snap && Object.keys(R.snap).length >= 10, 'the season start took the snapshot; the season\'s end wrote the record', { view: R.view, keys: Object.keys(R.snap).length })
  const keys = Object.keys(R.rec.from)
  ok(keys.every((k) => R.rec.from[k] === Math.round(R.snap[k]) && R.rec.to[k] === R.attrs[k]), 'the record is the snapshot → the attributes now, whole numbers', keys.filter((k) => R.rec.from[k] !== Math.round(R.snap[k]) || R.rec.to[k] !== R.attrs[k]))
  ok(R.rec.to.speed - R.rec.from.speed >= 4 && R.rec.to.throwing < R.rec.from.throwing, 'the points spent mid-season count (speed +4) and so does a decline (throwing −6)', { speed: [R.rec.from.speed, R.rec.to.speed], throwing: [R.rec.from.throwing, R.rec.to.throwing] })
  // the card, while it plays
  const samples = await page.evaluate(async () => {
    const card = document.getElementById('growCardV193O'), out = []
    const g = card && card.querySelector('.g93-row.up .g93-gain'), tr = g && g.parentElement
    for (let i = 0; i < 24 && card; i++) { out.push({ w: g ? +(g.getBoundingClientRect().width / tr.getBoundingClientRect().width * 100).toFixed(2) : null, busy: window.__V193O.busy(), done: window.__V193O.state().done }); await new Promise((r) => setTimeout(r, 90)) }
    return out
  })
  await page.waitForFunction(() => window.__V193O.state().done, null, { timeout: 8000 }).catch(() => null)
  await page.waitForTimeout(450)
  const C = await page.evaluate(() => {
    const card = document.getElementById('growCardV193O'), D = window.__V193O.data(), sc = document.getElementById('screen')
    const rows = card ? [...card.querySelectorAll('.g93-row')].map((r) => { const tr = r.querySelector('.g93-track'), f = r.querySelector('.g93-gain') || r.querySelector('.g93-fill'); return { k: r.dataset.k, from: +r.dataset.from, to: +r.dataset.to, v: r.querySelector('.g93-v').textContent, chip: r.querySelector('.g93-chip').textContent, chipOp: +getComputedStyle(r.querySelector('.g93-chip')).opacity, w: +(f.getBoundingClientRect().width / tr.getBoundingClientRect().width * 100).toFixed(2) } }) : []
    const prev = card && card.previousElementSibling, next = card && card.nextElementSibling
    return { card: !!card, rows, want: D && D.rows.map((r) => ({ k: r.k, w1: +r.w1.toFixed(2), d: r.d })), sec: card && card.closest('.hubv75-sec') && card.closest('.hubv75-sec').dataset.sec, prevGrade: !!(prev && prev.querySelector('.season-grade')), next: next && (next.id || next.className), ovr: card && card.querySelector('.g93-ovn').textContent, ovr1: D && D.ovr1, total: card && card.querySelector('.g93-total').innerText, gained: D && D.gained, done: card && card.classList.contains('g93-done'), busy: window.__V193O.busy(), vib: window.__vib.slice(), log: window.ribHaptic.log.slice() }
  })
  const moved = Object.keys(R.rec.from).filter((k) => R.rec.from[k] !== R.rec.to[k])
  ok(C.card && C.sec === 'grade' && C.prevGrade, 'the WHAT CHANGED card is on the report\'s GRADE tab, right under the report card', { sec: C.sec, prevGrade: C.prevGrade })
  ok(C.rows.length === moved.length && moved.every((k) => C.rows.some((r) => r.k === k && r.from === R.rec.from[k] && r.to === R.rec.to[k])), 'it lists every attribute that moved, old → new exactly as the record', C.rows.map((r) => `${r.k} ${r.from}→${r.to}`).join(', '))
  ok(C.rows.every((r, i) => !i || (r.to - r.from) <= (C.rows[i - 1].to - C.rows[i - 1].from)), 'the biggest gain first, declines last', C.rows.map((r) => r.to - r.from).join(' '))
  const ws = samples.map((s) => s.w).filter((w) => w != null), first = C.want && C.want[0]
  ok(ws.length > 5 && new Set(ws.map((w) => Math.round(w))).size >= 3 && ws[0] < first.w1 - 0.5, 'the bars animate: the first bar\'s width changes over time, from the old value', ws.map((w) => Math.round(w)).join(' '))
  ok(Math.max(...ws) > first.w1 + 0.3 || ws.some((w, i) => i && w > ws[i - 1]), 'it grows with an overshoot-and-settle ease', { max: Math.max(...ws), w1: first.w1 })
  ok(C.done && C.rows.every((r, i) => Math.abs(r.w - C.want[i].w1) < 0.8 && r.v === String(r.to) && r.chipOp > 0.9), 'and settles: every bar at its new value, the number counted to it, the chip on', C.rows.map((r, i) => `${r.k} ${r.w}/${C.want[i].w1} ${r.v} ${r.chip}`).join(' | '))
  ok(C.ovr === String(C.ovr1) && new RegExp('\\+' + C.gained + ' attribute point').test(C.total), 'the OVR counts to the new rating and the total line says "+N attribute points this season"', { ovr: C.ovr, total: C.total })
  ok(samples.some((s) => s.busy) && !C.busy, 'while it plays the pot and the XP pour wait (busy), then let go', samples.map((s) => s.busy ? 1 : 0).join(''))
  ok(/legacy-card-v152/.test(C.next || ''), 'the Legacy medal card sits under it (v190 D order kept)', C.next)
  const ticks = C.log.filter((k) => k === 'tick').length
  ok(ticks >= C.rows.length && C.log.includes('reward') && C.vib.length >= C.rows.length + 1, 'haptics: a tick per bar, a reward at the OVR burst (navigator.vibrate called)', { log: C.log.slice(0, 12), vib: C.vib.length })

  // 3: a tap skips to the end
  const T = await page.evaluate(async () => {
    const p = window.__GRIDIRON_AUDIT__.getState().player
    p.growV193O.seen = false; document.getElementById('growCardV193O').remove(); window.__V193O.card()
    await new Promise((r) => setTimeout(r, 450))
    const card = document.getElementById('growCardV193O'), D = window.__V193O.data()
    const mid = window.__V193O.state().done
    card.click()
    const rows = [...card.querySelectorAll('.g93-row')].map((r, i) => { const tr = r.querySelector('.g93-track'), f = r.querySelector('.g93-gain') || r.querySelector('.g93-fill'); return { w: +(f.getBoundingClientRect().width / tr.getBoundingClientRect().width * 100).toFixed(2), w1: +D.rows[i].w1.toFixed(2), v: r.querySelector('.g93-v').textContent, to: String(D.rows[i].to) } })
    return { mid, done: window.__V193O.state().done, skips: window.__V193O.state().skips, rows, ovr: card.querySelector('.g93-ovn').textContent, ovr1: D.ovr1, seen: p.growV193O.seen, total: getComputedStyle(card.querySelector('.g93-total')).opacity }
  })
  ok(!T.mid && T.done && T.skips >= 1 && T.rows.every((r) => Math.abs(r.w - r.w1) < 0.8 && r.v === r.to) && T.ovr === String(T.ovr1) && T.seen, 'a tap mid-play skips to the end state at once (bars, numbers, OVR) and marks it seen', T.rows.map((r) => `${r.w}/${r.w1} ${r.v}`).join(' | '))
  // a re-render of a seen season draws the end state, no replay
  const RR = await page.evaluate(() => { window.go('result'); const card = document.getElementById('growCardV193O'); return { card: !!card, done: card && card.classList.contains('g93-done'), plays: window.__V193O.state().plays } })
  ok(RR.card && RR.done, 'the report drawn again shows the finished card (no replay)', RR)

  // 5: haptics at a node buy, a medal claim, the plan roll
  const B = await page.evaluate(() => {
    const A = window.__GRIDIRON_AUDIT__, S = A.getState(), out = {}
    window.go('shop'); S.pp = 1e9
    const key = Object.keys(A.TREE_NODES).find((k) => A.nodeUnlocked(A.TREE_NODES[k]) && A.nodeLvl(k) < A.TREE_NODES[k].max)
    let n0 = window.__vib.length; const lv0 = A.nodeLvl(key)
    window.buy(key)
    out.buy = { key, bought: A.nodeLvl(key) > lv0, calls: window.__vib.length - n0, last: window.ribHaptic.log[window.ribHaptic.log.length - 1] }
    const Md = window.__V179.medals, st = Md.store(); st.pending = []; st.seen = 0; S.honorsV156A = { floor: 3 }
    Md.sync(); const pend = st.pending.length
    n0 = window.__vib.length
    const c = pend ? Md.claim(0) : null
    out.medal = { pend, claimed: !!c, calls: window.__vib.length - n0, last: window.ribHaptic.log[window.ribHaptic.log.length - 1] }
    Md.close(); st.pending = []
    return out
  })
  ok(B.buy.bought && B.buy.calls >= 1 && B.buy.last === 'success', 'a tree node bought buzzes a success (navigator.vibrate called)', B.buy)
  ok(B.medal.claimed && B.medal.calls >= 1 && B.medal.last === 'reward', 'a medal reward claimed buzzes a reward', B.medal)
  const P = await page.evaluate(async () => {
    const A = window.__GRIDIRON_AUDIT__, S = A.getState(), p = S.player
    window.startSeasonGames(); window.go('season'); await new Promise((r) => setTimeout(r, 300))
    const b = [...document.querySelectorAll('#dock button')].find((x) => /playWeek\(true\)/.test(x.getAttribute('onclick') || ''))
    b && b.click()
    for (let k = 0; k < 60 && !document.getElementById('pregameV1513'); k++) { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none' && g.getBoundingClientRect().height) g.click(); await new Promise((r) => setTimeout(r, 200)) }
    await new Promise((r) => setTimeout(r, 60))
    const V = window.__PREGAME_V51, h = V && V.hold(), n0 = window.__vib.length
    const rv = h && h.dice ? V.reveal() : null
    const want = rv ? (rv.band === 'green' ? 'success' : rv.band === 'neutral' ? 'warning' : 'error') : null
    const n1 = window.__vib.length; const again = V && V.reveal()
    return { pg: !!document.getElementById('pregameV1513'), band: rv && rv.band, want, calls: n1 - n0, last: window.ribHaptic.log[window.ribHaptic.log.length - 1], again: window.__vib.length - n1 }
  })
  ok(P.pg && P.band && P.calls >= 1 && P.last === P.want && P.again === 0, 'the plan\'s roll reveal buzzes by its band (clicks = success, it\'ll do = warning, backfires = error) — once', P)
  // the limiter: one per 40 ms, a stronger kind still lands
  await page.waitForTimeout(120)
  const L = await page.evaluate(() => { const s0 = window.ribHaptic.stats(); const a = window.ribHaptic('tick'), b = window.ribHaptic('tick'), c = window.ribHaptic('success'), d = window.ribHaptic('tap'); return { a, b, c, d, limited: window.ribHaptic.stats().limited - s0.limited } })
  ok(L.a && !L.b && L.c && !L.d && L.limited === 2, 'one buzz per 40 ms — a second tick is dropped, a success right after still lands', L)

  // 6: the Settings switch
  await page.evaluate(() => document.getElementById('pregameV1513')?.remove())
  const W = await page.evaluate(async () => {
    window.go('settings'); await new Promise((r) => setTimeout(r, 300))
    const row = document.getElementById('vibRowV193O'), inSound = !!(row && row.closest('#soundCardV151E')), was = row && row.querySelector('.switch').classList.contains('on')
    const oldRow = [...document.querySelectorAll('.toggle-label')].some((l) => /Haptic feedback/.test(l.textContent))
    row && row.click()
    const off = { store: localStorage.getItem('rib.haptics.v193'), sw: document.getElementById('vibRowV193O').querySelector('.switch').classList.contains('on'), save: window.__GRIDIRON_AUDIT__.getState().settings.haptics }
    const n0 = window.__vib.length, fired = window.ribHaptic('heavy'), calls = window.__vib.length - n0
    window.go('settings'); await new Promise((r) => setTimeout(r, 200))
    const redrawn = document.getElementById('vibRowV193O').querySelector('.switch').classList.contains('on')
    document.getElementById('vibRowV193O').click()
    await new Promise((r) => setTimeout(r, 60))
    const back = { store: localStorage.getItem('rib.haptics.v193'), fired: window.ribHaptic('heavy') }
    return { row: !!row, inSound, was, oldRow, off, fired, calls, redrawn, back }
  })
  ok(W.row && W.inSound && W.was && !W.oldRow, 'Settings › SOUND has the Vibration row, ON by default (the old LIVE GAME "Haptic feedback" row is gone)', W)
  ok(W.off.store === 'off' && !W.off.sw && W.off.save === false && !W.fired && W.calls === 0 && !W.redrawn, 'switched off: stored per device, the save\'s old switch follows, nothing vibrates, the row redraws off', W.off)
  ok(W.back.store === null && W.back.fired, 'and back on', W.back)

  // 7: EVERY POINT LANDS on the skill sheet
  const E = await page.evaluate(async () => {
    const S = window.__GRIDIRON_AUDIT__.getState(), p = S.player
    p.points = 500; window.go('upgrade'); await new Promise((r) => setTimeout(r, 300))
    const f0 = window.__V193O.state().feels
    window.alloc('speed', 1)
    const uv = document.getElementById('uv-speed'), pop = uv && uv.classList.contains('uv-pop-v193o'), f1 = window.__V193O.state().feels
    await new Promise((r) => setTimeout(r, 60))
    p.attrs.agility = 79; window.go('upgrade'); await new Promise((r) => setTimeout(r, 300))
    window.alloc('agility', 1)
    const L = window.__V193O.state().lastFeel, tag = document.querySelector('.lvl-tag-v193o')
    return { pop, felt: f1 - f0, L, tag: tag && tag.textContent, last: window.ribHaptic.log[window.ribHaptic.log.length - 1] }
  })
  ok(E.pop && E.felt === 1, 'a +1 on the skill sheet pops the number', E)
  ok(E.L && E.L.v1 === 80 && /LEVEL UP · MID TIER/.test(E.tag || '') && E.last === 'reward', 'a +1 across a grade tier names it on the row and buzzes a reward', { tag: E.tag, last: E.last })
  await ctx.close()
}

// ============================== 5: a no-op under the automated browser (no ?haptics=1) ==============================
{
  const { ctx, page } = await open('')
  const N = await page.evaluate(() => { let calls = 0; navigator.vibrate = () => { calls++; return true }; const r = window.ribHaptic('success'); window.__V193O.buzz('reward'); return { r, calls, s: window.ribHaptic.stats() } })
  ok(N.r === false && N.calls === 0 && N.s.headless === true && N.s.webdriver >= 2 && N.s.fired === 0, 'under navigator.webdriver ribHaptic is a complete no-op', N)
  await ctx.close()
}

// ============================== 4: reduced motion — the end state, no transition ==============================
{
  const { ctx, page } = await open('', { reducedMotion: 'reduce' })
  await season(page)
  const M = await page.evaluate(() => {
    const card = document.getElementById('growCardV193O'), D = window.__V193O.data()
    if (!card) return null
    const rows = [...card.querySelectorAll('.g93-row')].map((r, i) => { const tr = r.querySelector('.g93-track'), f = r.querySelector('.g93-gain') || r.querySelector('.g93-fill'); return { w: +(f.getBoundingClientRect().width / tr.getBoundingClientRect().width * 100).toFixed(2), w1: +D.rows[i].w1.toFixed(2), v: r.querySelector('.g93-v').textContent, to: String(D.rows[i].to), tr: getComputedStyle(f).transitionDuration } })
    return { done: card.classList.contains('g93-done'), stat: card.classList.contains('g93-static'), rows, plays: window.__V193O.state().plays, ovr: card.querySelector('.g93-ovn').textContent, ovr1: D.ovr1 }
  })
  ok(M && M.done && M.stat && M.plays === 0, 'reduced motion: the card is drawn finished, nothing played', M && { done: M.done, plays: M.plays })
  ok(M && M.rows.every((r) => Math.abs(r.w - r.w1) < 0.8 && r.v === r.to && /^0s/.test(r.tr)) && M.ovr === String(M.ovr1), 'every bar at its new value with no transition', M && M.rows.map((r) => `${r.w}/${r.w1} ${r.tr}`).join(' | '))
  await ctx.close()
}

console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
if (errors.length) console.log('page errors:', errors.slice(0, 6))
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
