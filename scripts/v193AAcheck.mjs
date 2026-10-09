// Dev check: v193 AA THE ROSTER MOVES, AND YOU FEEL IT (src/07-career-app.js + src/10's carry hook, src/11, src/24).
//   1 a season turnover at the same program with a star SR on the roster: he graduates, a new face takes his slot,
//     ONE ROSTER MOVES card queues and opens at the season screen (v193AAprompt 1 — the automated-browser rule): the
//     departure in red with a negative "−N TEAM" chip, the arrival in green, the big number ticks DOWN then UP and
//     settles on the real after-OVR (teamPair before → after), "TEAM a → b (±d)"; the season card's chip says it;
//     shown once; tap to skip; reduced motion draws the end state
//   2 RECRUIT A PLAYER: three real recruits for the weakest units (named, positioned, rated above the man each
//     replaces), priced in percents of the attributes the position needs least; the confirm names the loss, the gain,
//     TEAM before → after and the 3-season lock; confirming subtracts exactly those points, puts him on src/10's roster
//     (teamPair and the watched game's roster see him), locks him, plays the card; one a season; he survives the next
//     turnovers and his lock runs out after 3 seasons
//   3 The Franchise Recruiter: 1,000,000 PP at Lv 1 (QUICK BUY carries it, v193 Y draws its icon); every level makes
//     the price 25% smaller, the recruit +3 OVR, the lock a season longer
//   4 kill switch TU v193AA 0; nothing overflows at 360 px; no page errors
// GAME_URL=http://localhost:5173/ node scripts/v193AAcheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
await page.addInitScript(() => { setInterval(() => { for (const s of ['.onboard', '#personaV13', '#gv139gate', '#teamModalV153', '.team-modal-v153', '#lockerPopV153B'].concat(window.__keepGrowthAA ? [] : ['#growthV42'])) document.querySelector(s)?.remove() }, 80) })
await page.goto(gameUrl('index.html?stayStale&noFilmV114'), { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V193AA && !!window.ribDialog && !!window.__V158_KEY, null, { timeout: 40000 })
await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
await page.evaluate(() => document.getElementById('splash')?.remove())
await page.waitForTimeout(500)
const M = (fn, arg) => page.evaluate(fn, arg)

// a Varsity RB in his 4th season, the card allowed under the automated browser
const setup = (o = {}) => M((o) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true
  S.tree = o.tree || {}; S.pp = o.pp || 0
  S.player = A.newPlayer(); const p = S.player
  p.name = 'Test Man'; p.pos = o.pos || 'RB'; p.level = o.level != null ? o.level : 4; p.totalSeasons = 3; p.seasonsAtLevel = 1
  p.personaV13 = { aggression: 5, iq: 5, eq: 5, longterm: 5, workethic: 5, loyalty: 5, confidence: 5, coachability: 5 }; p.traits = []
  A.setState(S)
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v193AA: 1, v193AAprompt: 1, v193WinjPrompt: 0 }, o.tune || {})
  window.startSeasonGames()
  return true
}, o)
const pair = () => M(() => window.__TEAMPAIR_V76().us)
const closeCard = () => M(() => { const b = document.getElementById('rmGoV193AA'); b && b.click() })
const waitCard = (ms = 8000) => page.waitForFunction(() => !!document.getElementById('rmV193AA'), null, { timeout: ms }).then(() => true).catch(() => false)
const waitDone = (ms = 15000) => page.waitForFunction(() => document.getElementById('rmV193AA')?.classList.contains('done'), null, { timeout: ms }).then(() => true).catch(() => false)
// the next season: the year rolls over, the season starts (a new season key → src/10 carries the roster)
const nextSeason = (o = {}) => M((o) => {
  const p = window.__GRIDIRON_AUDIT__.getState().player
  p.totalSeasons++; p.seasonsAtLevel++
  window.startSeasonGames()
  return true
}, o)

// ---------- 1. the turnover ----------
await setup()
await page.waitForTimeout(300)
// a star senior and a plain senior; the rest underclassmen (so the departures are known)
const pre = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), p = S.player, R = p.teamRosterV158, Mt = p.rosterMetaV193AA
  const idx = R.map((m, i) => i).filter((i) => R[i].pos !== 'K' && R[i].pos !== 'P').sort((a, b) => R[b].ovr - R[a].ovr)
  R.forEach((m) => { m.year = 'SO'; m.potential = m.ovr + 6 })
  const st = R[idx[0]]; st.year = 'SR'; st.ovr = st.overall = st.carryOvrV193AA = Math.round(Mt.target + 22)
  const plain = R[idx[10]]; plain.year = 'SR'
  window.__V193AA.dev(p)
  p.rmQV193AA = []
  window.go('hub')
  return { star: st.name, starPos: st.pos, starOvr: st.ovr, plain: plain.name, key: p.teamRosterSeasonV158, target: Mt.target, q: window.__V193AA.rosterQ(), snap: p.teamSnapV193AA && p.teamSnapV193AA.team }
})
const before = await pair()
ok(pre.snap === before, 'the hub took the team\'s number for the next card (the season screen\'s own teamPair)', { snap: pre.snap, before })
await nextSeason()
const after = await pair()
const T1 = await M((pre) => {
  const p = window.__GRIDIRON_AUDIT__.getState().player, R = p.teamRosterV158, Q = (p.rmQV193AA || []).map((q) => ({ kind: q.kind, dep: q.dep.map((d) => ({ n: d.name, c: d.chip, s: !!d.star })), arr: q.arr.map((d) => ({ n: d.name, c: d.chip, o: d.ovr })), imp: q.imp.length, before: q.before }))
  return { key: p.teamRosterSeasonV158, starThere: R.some((m) => m.name === pre.star), plainThere: R.some((m) => m.name === pre.plain), Q, chem: p.worldState && p.worldState.teamChemistry }
}, pre)
console.log('turnover:', JSON.stringify(T1).slice(0, 900))
ok(T1.key !== pre.key && !T1.starThere && !T1.plainThere, 'the new season carried the roster: both seniors graduated', { star: pre.star, plain: pre.plain })
ok(T1.Q.length === 1 && T1.Q[0].kind === 'season' && T1.Q[0].before === before, 'ONE season card queued, its "before" the team OVR the player last saw', T1.Q.map((q) => q.kind + ':' + q.before))
const dStar = T1.Q[0] && T1.Q[0].dep.find((d) => d.n === pre.star)
ok(dStar && dStar.c < 0 && dStar.s, 'the star\'s departure carries a negative team chip and the star flag', dStar)
ok(T1.Q[0] && T1.Q[0].arr.length >= 2 && T1.Q[0].arr.every((a) => a.c > 0 && a.n && a.o > 0), 'the new faces arrive with positive team chips', T1.Q[0] && T1.Q[0].arr)


// the card, at the season screen
const opened = await waitCard()
const C0 = await M(() => {
  const el = document.getElementById('rmV193AA'), R = window.__V193AA.rec
  return { view: window.__GRIDIRON_AUDIT__.getState().view, n0: +document.getElementById('rmNumV193AA').textContent, rows: [...el.querySelectorAll('.rm-row')].map((r) => ({ cls: r.className, nm: r.querySelector('.rm-nm').textContent, chip: (r.querySelector('.rm-chip') || {}).textContent || '' })), last: R.last && R.last.n }
})
ok(opened && C0.view === 'season', 'the ROSTER MOVES card opened by itself at the season screen', C0.view)
const depRow = C0.rows.find((r) => /dep/.test(r.cls) && r.nm.includes(pre.star))
ok(depRow && /star/.test(depRow.cls) && /^−\d+ TEAM$/.test(depRow.chip), 'the star leaves in a red row with a "−N TEAM" chip', depRow)
ok(C0.rows.some((r) => /\barr\b/.test(r.cls) && /^\+\d+ TEAM$/.test(r.chip)), 'an arrival slides in with a green "+N TEAM" chip', C0.rows.filter((r) => /arr/.test(r.cls)).map((r) => r.chip))
ok(C0.last && C0.last.n0 === before && C0.last.n3 === after && C0.last.n1 < C0.last.n0, 'the card walks from the team OVR before to the real after-OVR, dipping on the departures', C0.last)
await waitDone()
await page.waitForTimeout(450)
const C1 = await M(() => {
  const R = window.__V193AA.rec, el = document.getElementById('rmV193AA')
  return { samples: R.samples.slice(), end: document.getElementById('rmEndV193AA').textContent.trim(), num: +document.getElementById('rmNumV193AA').textContent, endShown: getComputedStyle(document.getElementById('rmEndV193AA')).opacity, skipped: R.skipped, right: Math.round(el.querySelector('.rm-card').getBoundingClientRect().right), sw: document.scrollingElement.scrollWidth - innerWidth, cardSW: el.querySelector('.rm-card').scrollWidth - el.querySelector('.rm-card').clientWidth, haptic: window.ribHaptic && window.ribHaptic.stats ? window.ribHaptic.stats().asked : null }
})
const S = C1.samples, minAt = S.indexOf(Math.min(...S))
const dec = S.slice(0, minAt + 1).every((v, i, a) => !i || v <= a[i - 1]) && S[minAt] < S[0]
const inc = S.slice(minAt).some((v, i, a) => i && v > a[i - 1])
ok(dec && inc, 'the big number ticked DOWN digit by digit, then climbed back', S.join(' '))
ok(S.every((v, i, a) => !i || Math.abs(v - a[i - 1]) <= 1 || v === after), 'one digit at a time (whole numbers)', S.join(' '))
ok(C1.num === after && C1.end === `TEAM ${before} → ${after} (${after - before > 0 ? '+' : after - before < 0 ? '−' : '±'}${Math.abs(after - before)})`, 'it settles on the real after-OVR: "TEAM a → b (±d)"', { end: C1.end, before, after })
ok(+C1.endShown > 0.9 && !C1.skipped, 'the end line is shown when the walk is done', C1.endShown)
ok(C1.right <= 360 && C1.sw <= 0 && C1.cardSW <= 0, 'the card fits 360 px', C1)
await page.screenshot({ path: '/tmp/v193AA-card.png' })
await closeCard()
await page.waitForTimeout(400)
const C2 = await M(() => {
  const p = window.__GRIDIRON_AUDIT__.getState().player, sc = document.getElementById('screen'), chip = sc.querySelector('#teamQualV192B .rm-dchip')
  window.go('season')
  return { open: !!document.getElementById('rmV193AA'), q: (p.rmQV193AA || []).length, chip: chip ? chip.textContent.trim() : '', btn: !!document.querySelector('#screen #rmRecruitBtnV193AA_season'), last: p.rmLastV193AA, shown: window.__V193AA.rec.shown.length }
})
const d = after - before
ok(!C2.open && C2.q === 0, 'Continue closes it and empties the queue', C2)
ok(C2.chip === `${d > 0 ? '▲' : d < 0 ? '▼' : '='} ${Math.abs(d)} since last season`, 'the season screen\'s team card says the delta: "' + C2.chip + '"', C2.last)
ok(C2.btn, 'the team card carries RECRUIT A PLAYER')
const W2 = await M(() => { const r = document.querySelector('#screen #rmTeamRowV193AA_season'), b = document.querySelector('#screen #rmRecruitBtnV193AA_season'); return { right: r ? Math.round(r.getBoundingClientRect().right) : 999, bh: b ? Math.round(b.getBoundingClientRect().height) : 0, sw: document.scrollingElement.scrollWidth - innerWidth } })
ok(W2.right <= 360 && W2.sw <= 0 && W2.bh >= 36, 'the row fits 360 px and the button is a 36 px target', W2)
await M(() => document.querySelector('#teamQualV192B')?.scrollIntoView({ block: 'center' }))
await page.screenshot({ path: '/tmp/v193AA-season.png' })
await page.waitForTimeout(2200)
ok(!(await M(() => !!document.getElementById('rmV193AA'))) && (await M(() => window.__V193AA.rec.shown.length)) === C2.shown, 'shown once: a redraw does not bring it back')

// the key moves twice a season (the end's seasonsAtLevel, the start's seed): ONE turnover a season
const twice = await M(() => {
  const p = window.__GRIDIRON_AUDIT__.getState().player, a = window.__V158_ROSTER().map((m) => m.name + m.ovr).join()
  p.seasonsAtLevel++; window.__V158_ROSTER(); window.startSeasonGames(); window.__V158_ROSTER()
  return { same: window.__V158_ROSTER().map((m) => m.name + m.ovr).join() === a, q: (p.rmQV193AA || []).length }
})
ok(twice.same && twice.q === 0, 'a second rebuild in the same season keeps the men (one turnover a season, no second card)', twice)

// tap to skip
await nextSeason()
ok(await waitCard(), 'the next season\'s card opens')
await page.waitForTimeout(250)
const K = await M(() => { document.querySelector('#rmCardV193AA .rm-big').click(); const R = window.__V193AA.rec; return { done: R.done, skipped: R.skipped, num: +document.getElementById('rmNumV193AA').textContent, n3: R.nums.n3, end: getComputedStyle(document.getElementById('rmEndV193AA')).opacity, rows: [...document.querySelectorAll('#rmV193AA .rm-row')].every((r) => r.classList.contains('in')) } })
await page.waitForTimeout(400)
const K2 = await M(() => ({ end: +getComputedStyle(document.getElementById('rmEndV193AA')).opacity, num: +document.getElementById('rmNumV193AA').textContent }))
ok(K.done && K.skipped && K.num === K.n3 && K.rows && K2.end > 0.9 && K2.num === K.n3, 'a tap skips to the end state at once', { K, K2 })
await closeCard()

// reduced motion: the end state, no walk
await page.emulateMedia({ reducedMotion: 'reduce' })
await nextSeason()
ok(await waitCard(), 'the card opens under reduced motion')
const RM = await M(() => { const R = window.__V193AA.rec; return { done: R.done, reduced: R.last && R.last.reduced, samples: R.samples.length, num: +document.getElementById('rmNumV193AA').textContent, n3: R.nums.n3 } })
ok(RM.done && RM.reduced && RM.samples <= 2 && RM.num === RM.n3, 'reduced motion draws the end state straight away', RM)
await closeCard()
await page.emulateMedia({ reducedMotion: 'no-preference' })

// ---------- 2. RECRUIT A PLAYER ----------
await page.waitForTimeout(300)
const O = await M(() => {
  const A = window.__GRIDIRON_AUDIT__, p = A.getState().player, R = p.teamRosterV158, O = window.__V193AA.offers(), w = A.POSITIONS[p.pos].w
  const pool = Object.keys(p.attrs).filter((k) => typeof p.attrs[k] === 'number' && k !== 'injuryResist' && p.attrs[k] > 1 && (w[k] || 0) > 0)
  const least = pool.slice().sort((a, b) => (w[a] || 0) - (w[b] || 0))
  return {
    n: O.offers.length, T: O.T, weak: O.weak,
    offers: O.offers.map((o) => ({ name: o.man.name, pos: o.man.pos, ovr: o.man.ovr, slot: o.slot, old: o.old, onRoster: R.some((m) => m.name === o.man.name), slotPos: R[o.slot].pos, cost: o.cost, before: o.before, after: o.after, lock: o.lock, unit: o.unit, tier: o.tier })),
    leastW: least.slice(0, 3).map((k) => w[k] || 0), attrs: Object.assign({}, p.attrs), w
  }
})
console.log('offers:', JSON.stringify(O.offers.map((o) => [o.tier, o.name, o.pos, o.ovr, o.old.ovr, o.cost.map((c) => c.k + ' ' + c.pct + '% ' + c.pts).join(','), o.before + '→' + o.after])))
ok(O.n === 3 && new Set(O.offers.map((o) => o.slot)).size === 3, 'three recruits, three different slots', O.offers.map((o) => o.slot))
ok(O.offers.every((o) => /^[A-Z][A-Za-z'-]+ [A-Z][A-Za-z'-]+$/.test(o.name) && !o.onRoster && o.pos === o.slotPos && o.ovr > o.old.ovr && o.ovr >= Math.round(O.T * 0.98)), 'each a named man at the replaced man\'s position, rated above him and at the roster\'s level', O.offers.map((o) => o.name + ' ' + o.pos + ' ' + o.ovr + ' > ' + o.old.ovr))
ok(O.offers[0].unit === O.weak[0].k, 'the first recruit fills the weakest unit (' + O.weak[0].k + ')', O.weak)
const costOk = O.offers.every((o) => o.cost.length >= 2 && o.cost.length <= 3 && o.cost.every((c) => Number.isInteger(c.pct) && Number.isInteger(c.pts) && c.pts === Math.max(1, Math.round(O.attrs[c.k] * c.pct / 100)) && (O.w[c.k] || 0) > 0 && (O.w[c.k] || 0) <= O.leastW[o.cost.length - 1]))
ok(costOk, 'the price is whole percents of the 2–3 attributes the position needs least among those it reads (the points beside them)', O.offers.map((o) => o.cost.map((c) => `${c.k}(w${O.w[c.k] || 0}) −${c.pct}% −${c.pts}`).join(' ')))
// the sheet, then the confirm
await M(() => window.go('season'))
await page.waitForTimeout(300)
await M(() => document.querySelector('#screen #rmRecruitBtnV193AA_season').click())
await page.waitForFunction(() => document.querySelectorAll('#ribDlgV149 .rc-card').length === 3, null, { timeout: 5000 }).catch(() => null)
const SH = await M(() => { const d = document.getElementById('ribDlgV149'), c = d && d.querySelector('.card-v149'); return { n: d ? d.querySelectorAll('.rc-card').length : 0, text: d ? d.innerText : '', right: c ? Math.round(c.getBoundingClientRect().right) : 0, sw: c ? c.scrollWidth - c.clientWidth : 0 } })
ok(SH.n === 3 && SH.text.includes(O.offers[0].name) && /PRICE: −\d+% /.test(SH.text) && SH.text.includes('TEAM ' + O.offers[0].before), 'RECRUIT A PLAYER opens the sheet: three recruits, their prices, TEAM before → after', SH.text.slice(0, 200))
ok(SH.right <= 360 && SH.sw <= 0, 'the sheet fits 360 px', SH)
await page.screenshot({ path: '/tmp/v193AA-sheet.png' })
await M(() => document.getElementById('rcPickV193AA1').click())
await page.waitForFunction(() => { const d = document.getElementById('ribDlgV149'); return d && /LOCKED/.test(d.innerText) }, null, { timeout: 5000 }).catch(() => null)
const CF = await M(() => { const d = document.getElementById('ribDlgV149'); return d ? d.innerText : '' })
const o1 = O.offers[1]
ok(/YOU LOSE/.test(CF) && o1.cost.every((c) => CF.includes(`−${c.pct}%`) && CF.includes(`(−${c.pts})`)) && CF.includes(o1.name) && CF.includes(o1.old.name) && CF.includes(`TEAM ${o1.before} → ${o1.after}`) && /LOCKED to your team for 3 seasons/.test(CF) && /can't follow/.test(CF), 'the confirm names the loss, the gain, the team before → after, and the 3-season lock (and when it ends)', CF.slice(0, 400))
await page.screenshot({ path: '/tmp/v193AA-confirm.png' })
const attrs0 = await M(() => Object.assign({}, window.__GRIDIRON_AUDIT__.getState().player.attrs))
await M(() => document.querySelector('#ribDlgV149 button.primary-v149').click())
await page.waitForTimeout(300)
const SG = await M((o1) => {
  const p = window.__GRIDIRON_AUDIT__.getState().player, R = p.teamRosterV158, man = R[o1.slot]
  const pv = window.__previewMatchupV22(p.pos), inGame = pv && pv.us.players.find((x) => x.name === o1.name)
  return { attrs: Object.assign({}, p.attrs), name: man && man.name, until: man && man.lockedUntilV193AA, ts: p.totalSeasons, us: window.__TEAMPAIR_V76().us, inGame, why: window.__V193AA.whyNot(), left: window.__V193AA.lockLeft(man) }
}, o1)
const diffs = Object.keys(attrs0).filter((k) => attrs0[k] !== SG.attrs[k]).map((k) => [k, SG.attrs[k] - attrs0[k]])
ok(diffs.length === o1.cost.length && o1.cost.every((c) => SG.attrs[c.k] === attrs0[c.k] - c.pts), 'signing subtracted exactly those points, nothing else', diffs)
ok(SG.name === o1.name && SG.until === SG.ts + 3 && SG.left === 3, 'he is on src/10\'s roster in the replaced man\'s slot, lockedUntilV193AA = totalSeasons + 3', { name: SG.name, until: SG.until, ts: SG.ts })
ok(SG.us === o1.after, 'teamPair sees him: the team OVR is the one the confirm promised', { us: SG.us, promised: o1.after })
ok(SG.inGame && SG.inGame.recruit === 3, 'the watched game\'s roster plays him by name, flagged as the locked recruit', SG.inGame)
const rcOpen = await waitCard(4000)
const RC = await M(() => { const el = document.getElementById('rmV193AA'); return el ? { text: el.innerText } : null })
ok(rcOpen && RC && /YOU SIGNED A RECRUIT/.test(RC.text) && RC.text.includes(o1.name) && RC.text.includes(o1.old.name), 'the ROSTER MOVES card plays it: the replaced man out, the recruit in', RC && RC.text.slice(0, 160))
await waitDone()
await page.screenshot({ path: '/tmp/v193AA-recruit-card.png' })
await closeCard()
await page.waitForTimeout(300)
const one = await M(() => { window.go('season'); const sc = document.getElementById('screen'); return { btn: !!sc.querySelector('#rmRecruitBtnV193AA_season'), done: (sc.querySelector('.rm-recdone') || {}).textContent || '', lock: (sc.querySelector('.rm-lock-v193aa') || {}).textContent || '', sign: window.__V193AA.sign(0), why: window.__V193AA.whyNot(), row: window.__V193AA.row('pregame') } })
ok(!one.btn && /Recruited this season/.test(one.done) && one.sign == null && /One recruit a season/.test(one.why), 'one recruit a season: the button is gone and a second signing is refused', { done: one.done, why: one.why })
ok(one.lock.includes(o1.name) && /locked 3 more seasons/.test(one.lock) && one.row.includes('locked 3 more seasons') && one.row.includes('rmTeamRowV193AA_pregame'), 'the team card and the pregame YOUR TEAM row show the lock', one.lock)
// the pregame's YOUR TEAM page: the row, and the recruit in the eleven with his lock
await M(() => { window.__keepGrowthAA = true; window.go('season'); window.chooseGamePlanV11('balanced', true) })
for (let i = 0; i < 40 && !(await M(() => !!document.getElementById('pregameV1513'))); i++) {
  await M(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') g.click() })
  await page.waitForTimeout(250)
}
const PG = await M(async (nm) => {
  const host = document.getElementById('pregameV1513')
  if (!host || !window.__V136_PAGES) return null
  const P = window.__V136_PAGES.active(); window.__V112_D.go(P.indexOf('v112PageTeam'))
  await new Promise((r) => setTimeout(r, 400))
  const row = document.querySelector('#v193Team #rmTeamRowV193AA_pregame'), man = [...document.querySelectorAll('#v193Roster .v193-man')].find((m) => m.querySelector('.nm').textContent === nm)
  const wide = [...host.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > document.documentElement.clientWidth + 1 }).length
  const over = host.scrollHeight - host.clientHeight
  const mine = [...document.querySelectorAll('#v193Team .rm-teamrow-v193aa, #v193Team .rm-lock-v193aa')]
  const marks = mine.map((el) => { const c = document.createComment('rm'); el.replaceWith(c); return [c, el] })
  const over0 = host.scrollHeight - host.clientHeight
  marks.forEach(([c, el]) => c.replaceWith(el))
  return { row: !!row, lock: ((document.querySelector('#v193Team .rm-lock-v193aa') || {}).textContent || ''), chips: man ? [...man.querySelectorAll('.chips i')].map((i) => i.textContent) : null, fits: over <= Math.max(2, over0 + 2), over, over0, wide }
}, o1.name)
ok(PG && PG.row && PG.lock.includes(o1.name) && PG.chips && PG.chips.some((c) => /🔒 RECRUIT · 3 seasons/.test(c)), 'the pregame YOUR TEAM page: the row, the lock, and the recruit in the eleven with a 🔒 chip', PG)
ok(PG && PG.fits && PG.wide === 0, 'the row adds no page scroll (the roster box gives the room) and nothing is wider than 360 px', PG && { fits: PG.fits, over: PG.over, over0: PG.over0, wide: PG.wide })
await page.screenshot({ path: '/tmp/v193AA-pregame.png' })
await M(() => { window.__keepGrowthAA = false; window.closePregameV1513 && window.closePregameV1513(); window.go('season') })
// he survives the turnovers while locked (even as a senior), and the lock runs out after 3 seasons
const life = []
await M(() => { window.RIB_TUNE.v193AAprompt = 0 })
for (let k = 1; k <= 3; k++) {
  await M((nm) => { const R = window.__GRIDIRON_AUDIT__.getState().player.teamRosterV158; const m = R.find((x) => x.name === nm); if (m) m.year = 'SR' }, o1.name)
  await nextSeason()
  life.push(await M((nm) => { const p = window.__GRIDIRON_AUDIT__.getState().player, m = window.__V158_ROSTER().find((x) => x.name === nm); return { ts: p.totalSeasons, there: !!m, left: m ? window.__V193AA.lockLeft(m) : null, recruitsLeft: window.__V193AA.left() } }, o1.name))
}
ok(life[0].there && life[1].there && life[0].left === 2 && life[1].left === 1, 'locked, he stays through the next two turnovers (2, then 1 season left)', life)
ok(!life[2].there, 'three seasons on, the lock has run out — a senior again, he graduates', life[2])
ok(life[0].recruitsLeft === 1, 'a new season opens a new recruit', life[0])
await M(() => { window.RIB_TUNE.v193AAprompt = 1; window.__GRIDIRON_AUDIT__.getState().player.rmQV193AA = [] })

// ---------- 3. The Franchise Recruiter ----------
const ND = await M(() => {
  const A = window.__GRIDIRON_AUDIT__, S = A.getState(), N = A.TREE_NODES.recruiterV193AA
  S.tree = S.tree || {}; delete S.tree.recruiterV193AA
  const c0 = A.nodeCost(N), t0 = window.__V193AA.terms(), o0 = window.__V193AA.offers().offers
  S.tree.recruiterV193AA = 1
  const c1 = A.nodeCost(N), t1 = window.__V193AA.terms(), o1 = window.__V193AA.offers().offers
  S.tree.recruiterV193AA = 3
  const t3 = window.__V193AA.terms(), o3 = window.__V193AA.offers().offers
  delete S.tree.recruiterV193AA
  return { c0, c1, max: N.max, branch: N.branch, desc: N.desc, t0, t1, t3, p0: o0.map((o) => o.cost.map((c) => c.pct)), p1: o1.map((o) => o.cost.map((c) => c.pct)), p3: o3.map((o) => o.cost.map((c) => c.pct)), v0: o0.map((o) => o.man.ovr), v1: o1.map((o) => o.man.ovr), v3: o3.map((o) => o.man.ovr), l: [o0[0] && o0[0].lock, o1[0] && o1[0].lock, o3[0] && o3[0].lock] }
})
console.log('node:', JSON.stringify(ND))
ok(ND.branch === 'impossible' && ND.c0 === 1000000, 'The Franchise Recruiter is an Impossible node at exactly 1,000,000 PP for Lv 1', ND.c0)
ok(ND.c1 > ND.c0 && ND.max === 3 && /25%/.test(ND.desc) && /\+3 OVR/.test(ND.desc) && /1 season/.test(ND.desc) && /Lv 3: 75% off the price, \+9 OVR, a 6-season lock/.test(ND.desc), 'its levels climb in price, and the desc says all three numbers and the totals at max', ND.desc)
ok(ND.t0.lv === 0 && ND.t1.lv === 1 && ND.t1.costK === 0.75 && ND.t1.ovrAdd === 3 && ND.t1.lock === 4 && ND.t3.costK === 0.25 && ND.t3.ovrAdd === 9 && ND.t3.lock === 6, 'read through treeFx: −25% price, +3 OVR, +1 season a level (Lv 3: 25% of the price, +9, 6 seasons)', { t1: ND.t1, t3: ND.t3 })
ok(ND.p0.length === 3 && ND.p0.every((p, i) => p.every((v, j) => ND.p1[i][j] === Math.max(1, Math.round(v * 0.75)) && ND.p3[i][j] === Math.max(1, Math.round(v * 0.25)))) && ND.v0.every((v, i) => ND.v1[i] === v + 3 && ND.v3[i] === v + 9) && ND.l.join() === '3,4,6', 'the offers follow: smaller percents, +3 / +9 OVR, a 3 → 4 → 6 season lock', { p0: ND.p0, p1: ND.p1, p3: ND.p3, v: [ND.v0, ND.v1, ND.v3], l: ND.l })
const QB = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(); window.__V156A && window.__V156A.seed(500); S.prestige = 100; S.pp = 2e6
  window.RIB_TUNE.quickPagesV193L = 200
  const pages = window.__V193L.pages(), flat = pages.flat(), it = flat.find((x) => x.key === 'recruiterV193AA')
  const imp = flat.filter((x) => x.branch === 'impossible').map((x) => x.cost)
  delete window.RIB_TUNE.quickPagesV193L
  return { it: it && { cost: it.cost, page: pages.findIndex((p) => p.includes(it)) }, sorted: imp.every((c, i) => !i || c >= imp[i - 1]), map: window.NODE_ART_V193Y && window.NODE_ART_V193Y['📇'] }
})
ok(QB.it && QB.it.cost === 1000000 && QB.sorted, 'QUICK BUY deals it in price order like every node', QB)
ok(QB.map === 'handshake', 'v193 Y draws its 📇 as the handshake', QB)
await M(() => { window.go('shop'); window.setBranch && window.setBranch('impossible') })
await page.waitForTimeout(400)
const TR = await M(() => { const it = [...document.querySelectorAll('#branchNodes .shop-item')].find((x) => /Franchise Recruiter/.test(x.textContent)); return it ? { buy: (it.querySelector('.buy') || {}).textContent, art: !!it.querySelector('.ra-v193y'), fx2: /×2 effect/.test(it.textContent) } : null })
ok(TR && /1M PP/.test(TR.buy) && TR.art && !TR.fx2, 'the tree draws it at 1M PP with its art (its desc states what it pays — no ×2 tag)', TR)

// ---------- the locker room's moves ride the card; a new level is A NEW TEAM (and a lock ends there) ----------
await setup()
await page.waitForTimeout(300)
const LK = await M(() => { const out = window.__V153B.roll('story', { force: 'leave', dir: 'leave', count: 1 }); window.go('season'); return out.map((v) => v.name) })
const lkOpen = await waitCard()
if (!lkOpen) console.log('locker debug:', JSON.stringify(await M(() => ({ q: window.__V193AA.queue.map((q) => q.kind), blocked: window.__V193AA.blocked(window.__V193AA.queue[0]), view: window.__GRIDIRON_AUDIT__.getState().view, L: window.__V153B.locker(), ov: [...document.body.children].filter((x) => getComputedStyle(x).position === 'fixed' && x.getBoundingClientRect().height > 0).map((x) => x.id || x.className).slice(0, 10) }))))
ok(lkOpen, 'a teammate walking out mid-season opens the card (not the old pop)')
const LK2 = await M(() => ({ text: document.getElementById('rmV193AA').innerText, pop: !!document.getElementById('lockerPopV153B'), kind: window.__V193AA.rec.last.kind }))
ok(LK.length === 1 && LK2.kind === 'locker' && /THE LOCKER ROOM/.test(LK2.text) && LK2.text.includes(LK[0]) && !LK2.pop, 'THE LOCKER ROOM card names the man who left and his replacement', { left: LK, kind: LK2.kind })
await M(() => window.__V193AA.skip())
await closeCard()
const NT = await M(() => {
  const p = window.__GRIDIRON_AUDIT__.getState().player, r = window.__V193AA.sign(0)
  p.rmQV193AA = []
  window.go('hub')
  const before = window.__TEAMPAIR_V76().us
  p.level++; p.seasonsAtLevel = 0; p.totalSeasons++
  window.startSeasonGames()
  return { name: r && r.man.name, before }
})
ok(await waitCard(), 'moving up a level opens the card at the new team')
const NT2 = await M((nm) => { const p = window.__GRIDIRON_AUDIT__.getState().player, R = window.__V193AA.rec, m = window.__V158_ROSTER().find((x) => x.name === nm); return { text: document.getElementById('rmV193AA').innerText, kind: R.last.kind, n: R.nums, after: window.__TEAMPAIR_V76().us, there: !!m && !m.followV193AH /* v193 AH: a locked recruit may come along as one of his followers (his lock with him) */, followed: !!(m && m.followV193AH), left: m ? window.__V193AA.lockLeft(m) : null } }, NT.name)
if (NT2.followed) console.log('the recruit followed him (v193 AH), his lock left:', NT2.left)
ok(NT2.kind === 'team' && /A NEW TEAM/.test(NT2.text) && /YOU LEFT/.test(NT2.text) && /YOUR NEW TEAM/.test(NT2.text) && NT2.n.n0 === NT.before && NT2.n.n3 === NT2.after, 'A NEW TEAM: the men you leave, the men you join, the old team OVR → the new one', NT2.n)
ok(NT.name && !NT2.there, 'the recruit could not follow to the new level: his lock ended there', NT.name)
await M(() => window.__V193AA.skip())
await closeCard()

// ---------- 4. kill switch ----------
await setup({ tune: { v193AA: 0 } })
await page.waitForTimeout(300)
await M(() => { window.go('hub') })
await nextSeason()
await page.waitForTimeout(1500)
const KS = await M(() => { const p = window.__GRIDIRON_AUDIT__.getState().player, sc = document.getElementById('screen'); window.__V158_ROSTER(); return { q: (p.rmQV193AA || []).length, card: !!document.getElementById('rmV193AA'), btn: !!sc.querySelector('[id^=rmRecruitBtnV193AA]'), rq: window.__V193AA.rosterQ(), carried: p.teamRosterV158.some((m) => m.carryOvrV193AA != null && m.newV193AA != null) } })
ok(KS.q === 0 && !KS.card && !KS.btn && KS.rq === 0 && !KS.carried, 'TU v193AA 0: the old rebuild, no card, no recruit, no team term', KS)
await M(() => { window.RIB_TUNE.v193AA = 1 })

console.log('page errors:', errs.length ? errs.join('\n') : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
