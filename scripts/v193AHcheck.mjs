// Dev check: v193 AH CHEMISTRY HAS A REASON (src/07-career-app.js + src/10's roster list, src/14's personality page, src/24's art).
//   1 reasons: every departure and arrival on v193 AA's ROSTER MOVES card carries a reason chip decided by real state —
//     paired seeded turnovers (the same men, the same seeds): a TOXIC personality loses MORE men than a neutral one and
//     "Can't stand you" is among them (never for the neutral one); a losing season brings "Tired of losing" (a winning one
//     never); a sour room brings "Bad chemistry"; the same turnover replayed gives the same reasons (seeded, stable on
//     reload); the card draws the chips (.rm-why) and the "why" note; arrivals are Recruited / Transfer in / Came for YOU ★
//   2 followers: the measured distribution over 10,000 rolls (1–3 most of the time, never 0 or more than 10, 10 rare and
//     only with a big pull, Pied Piper shifts it up; a positive personality > neutral > a negative one); a level up
//     carries the followers into the new roster (scaled to the new level), the card says "A NEW TEAM · N followed you from
//     X" with "Followed you ★" rows, the season's team row and MY TEAM say "★ N followers", src/10's roster list marks
//     them; a UFF club change is a NEW FRANCHISE; a locked recruit who follows keeps his lock
//   3 the negative personality's trade-off: the growth multiplier the season reads (growthMulV192C) is ×(1 + 8% a TOXIC
//     point, ≤ 15%), and he arrives at a new team as one of its best (+depth on the depth chart's score, +coach trust,
//     the card's note); the personality page says it
//   4 Pied Piper: Mental branch, priced like its neighbours (nodeCost = 12 × the branch's ×24), v193 Y art, +0.8 pull a
//     level (its desc's numbers are the measured ones), "Can't stand you" −25% a level
//   5 TU v193AH 0: v193 AA as it was (no chips, no followers, no growth or arrival edge); 360 px; no page errors
// GAME_URL=http://localhost:5173/ node scripts/v193AHcheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const SHOT = process.env.AH_SHOT || '/tmp/v193AH-card.png'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e)) + (process.env.AH_STACK ? ' ' + e.stack : '')))
await page.addInitScript(() => { setInterval(() => { for (const s of ['.onboard', '#personaV13', '#gv139gate', '#teamModalV153', '.team-modal-v153', '#lockerPopV153B', '#growthV42', '#sprayHintV170']) document.querySelector(s)?.remove() }, 80) })
await page.goto(gameUrl('index.html?stayStale&noFilmV114'), { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V193AA && !!window.__V193AH && !!window.__V158_KEY, null, { timeout: 40000 })
await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
await page.evaluate(() => document.getElementById('splash')?.remove())
await page.waitForTimeout(500)
const M = (fn, arg) => page.evaluate(fn, arg)

const NEUTRAL = { aggression: 5, iq: 5, eq: 5, longterm: 5, workethic: 5, loyalty: 5, confidence: 5, coachability: 5 }
const TOXIC = Object.assign({}, NEUTRAL, { loyalty: 0, confidence: 10, eq: 0 }) // TOXIC 1 + 0.45 + 0.5 = 1.95
const WARM = Object.assign({}, NEUTRAL, { loyalty: 10, eq: 10, coachability: 10, confidence: 0 }) // TEAM 2 (capped)
// a career at a program, the card allowed under the automated browser; the roster built (seeded by seasonSeed)
const setup = (o = {}) => M((o) => {
  if (document.getElementById('rmV193AA')) window.__V193AA.close() // the last case's card goes with its career
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true
  S.tree = o.tree || {}; S.pp = o.pp || 0; S.path = o.path || null
  S.player = A.newPlayer(); const p = S.player
  p.name = o.name || 'Test Man'; p.pos = o.pos || 'RB'; p.level = o.level != null ? o.level : 5; p.totalSeasons = 3; p.seasonsAtLevel = 1
  p.personaV13 = Object.assign({}, o.persona); p.traits = o.traits || []
  A.setState(S)
  window.RIB_TUNE = window.RIB_TUNE || {}
  for (const k of Object.keys(window.RIB_TUNE)) if (/V193AH$|^v153Broster$/.test(k)) delete window.RIB_TUNE[k] // each case its own dials
  Object.assign(window.RIB_TUNE, { v193AA: 1, v193AH: 1, v193AAprompt: o.prompt ? 1 : 0, v193WinjPrompt: 0 }, o.tune || {})
  window.startSeasonGames()
  p.seasonSeed = o.seed || 424242; p.teamRosterV158 = null; p.teamRosterSeasonV158 = null; p.rosterMetaV193AA = null; p.rmQV193AA = []
  p.seasonLogV77 = o.log || [] // the schedule stays (unplayed): last season's record is the log's
  p.worldState = Object.assign(p.worldState || {}, { teamChemistry: o.chem != null ? o.chem : 50 })
  if (o.club) p.clubV146B = { name: o.club, town: o.club + ' City', mascot: 'Stags' }
  window.__V158_ROSTER()
  window.go('hub')
  return true
}, o)
// the season's end: the year rolls over and the key moves (src/10 carries the roster) — deterministic, no new seed
const seasonEnd = (o = {}) => M((o) => {
  const p = window.__GRIDIRON_AUDIT__.getState().player
  if (o.noGrad) p.teamRosterV158.forEach((m) => { m.year = 'SO' })
  if (o.chem != null) p.worldState.teamChemistry = o.chem
  p.rmQV193AA = []
  p.totalSeasons++; p.seasonsAtLevel++
  window.__V158_ROSTER()
  const q = (p.rmQV193AA || []).find((x) => x.kind === 'season')
  return q ? { dep: q.dep.map((d) => ({ n: d.name, r: d.rsn || null, why: d.why })), arr: q.arr.map((d) => ({ n: d.name, r: d.rsn || null })), chem: q.chem } : { dep: [], arr: [] }
}, o)
const waitCard = (ms = 8000) => page.waitForFunction(() => !!document.getElementById('rmV193AA'), null, { timeout: ms }).then(() => true).catch(() => false)
const closeCard = () => M(() => { window.__V193AA.skip(); const b = document.getElementById('rmGoV193AA'); b && b.click() })
const count = (runs, r) => runs.reduce((a, x) => a + x.dep.filter((d) => d.r === r).length, 0)

// ---------- 1. reasons, decided by real state ----------
const runs = {}
for (const [nm, pn] of [['neutral', NEUTRAL], ['toxic', TOXIC]]) {
  await setup({ persona: pn, level: 5 })
  runs[nm] = []
  for (let k = 0; k < 6; k++) runs[nm].push(await seasonEnd({ noGrad: true, chem: 50 }))
}
const nDep = (k) => runs[k].reduce((a, x) => a + x.dep.length, 0)
console.log('departures over 6 paired seasons:', { neutral: nDep('neutral'), toxic: nDep('toxic'), clashToxic: count(runs.toxic, 'clash'), clashNeutral: count(runs.neutral, 'clash') })
ok(nDep('toxic') > nDep('neutral') && count(runs.toxic, 'clash') > 0 && count(runs.neutral, 'clash') === 0, 'a TOXIC personality loses more men than a neutral one over the same seeded seasons, "Can\'t stand you" among them (never for the neutral one)', { neutral: nDep('neutral'), toxic: nDep('toxic'), clash: count(runs.toxic, 'clash') })
const all = Object.values(runs).flat()
ok(all.every((x) => x.dep.every((d) => d.r) && x.arr.every((a) => a.r)), 'every departure and arrival carries a reason', all.flatMap((x) => x.dep.filter((d) => !d.r)).slice(0, 3))
ok(runs.neutral.every((x) => x.dep.every((d) => ['transfer', 'grad', 'retire'].includes(d.r))) && runs.toxic.every((x) => x.dep.every((d) => ['transfer', 'clash'].includes(d.r))), 'at a neutral room and an even record, only v193 AA\'s own reasons and (for the TOXIC one) "Can\'t stand you"', [...new Set(all.flatMap((x) => x.dep.map((d) => d.r)))])
ok(all.every((x) => x.arr.every((a) => ['recruit', 'transferIn', 'drawn'].includes(a.r))), 'arrivals are Recruited / Transfer in / Came for YOU ★', [...new Set(all.flatMap((x) => x.arr.map((a) => a.r)))])
// the odds say it too
const odds = await M(() => { const p = window.__GRIDIRON_AUDIT__.getState().player; p.worldState.teamChemistry = 50; return window.__V193AH.leaveOdds(p) })
ok(Math.abs(odds.clash - 1.95 * 0.05) < 0.002 && odds.chemP === 0 && odds.loseP === 0, 'the TOXIC share is 5% a TOXIC point (1.95 → 9.75%) at a neutral room and no record', odds)

// a losing season, then a winning one (the same seeds)
await setup({ persona: NEUTRAL, level: 5, log: [{ wins: 1, losses: 9 }] })
const lose = []
for (let k = 0; k < 3; k++) lose.push(await seasonEnd({ noGrad: true, chem: 50 }))
await setup({ persona: NEUTRAL, level: 5, log: [{ wins: 9, losses: 1 }] })
const win = []
for (let k = 0; k < 3; k++) win.push(await seasonEnd({ noGrad: true, chem: 50 }))
const loseWhy = lose.flatMap((x) => x.dep.filter((d) => d.r === 'lose').map((d) => d.why))
ok(count(lose, 'lose') > 0 && count(win, 'lose') === 0 && loseWhy.every((w) => /1-9 last season/.test(w)), 'a 1-9 season brings "Tired of losing" (the record named); a 9-1 season never does', { lose: count(lose, 'lose'), win: count(win, 'lose'), why: loseWhy[0] })
// last season's record: the finished season's weeks first
const rec = await M(() => { const p = window.__GRIDIRON_AUDIT__.getState().player; const w0 = p.weekResults; p.weekResults = [{ played: 1, won: 1 }, { played: 1, won: 0 }, { played: 1, won: 0 }, { played: 0 }, { played: 1, won: 1, playoff: 1 }]; const r = window.__V193AH.record(p); p.weekResults = w0; return r })
ok(rec && rec.w === 1 && rec.l === 2, 'the record is the finished season\'s regular-season weeks (playoffs and unplayed weeks aside)', rec)
// a sour room
await setup({ persona: NEUTRAL, level: 5, chem: 10 })
const sour = []
for (let k = 0; k < 3; k++) sour.push(await seasonEnd({ noGrad: true, chem: 10 }))
ok(count(sour, 'chem') > 0 && count(runs.neutral, 'chem') === 0, 'a sour room (chemistry 10) brings "Bad chemistry" (never at 50)', count(sour, 'chem'))

// stable on reload: the same turnover from the same save gives the same reasons
await setup({ persona: TOXIC, level: 5 })
const snap = await M(() => JSON.stringify(window.__GRIDIRON_AUDIT__.getState().player))
const r1 = await seasonEnd({ noGrad: true, chem: 50 })
await M((snap) => { const S = window.__GRIDIRON_AUDIT__.getState(), p = S.player, q = JSON.parse(snap); Object.keys(p).forEach((k) => delete p[k]); Object.assign(p, q) }, snap)
const r2 = await seasonEnd({ noGrad: true, chem: 50 })
ok(JSON.stringify(r1.dep) === JSON.stringify(r2.dep) && JSON.stringify(r1.arr) === JSON.stringify(r2.arr) && r1.dep.length > 0, 'the same turnover from the same save gives the same men and the same reasons (seeded)', { a: r1.dep.map((d) => d.r).join(','), b: r2.dep.map((d) => d.r).join(',') })

// the card draws them
await setup({ persona: TOXIC, level: 5, prompt: true, log: [{ wins: 2, losses: 8 }] })
await seasonEnd({ noGrad: false, chem: 30 })
await M(() => window.go('season'))
const opened = await waitCard()
await M(() => window.__V193AA.skip())
await page.waitForTimeout(400)
const C = await M(() => {
  const el = document.getElementById('rmV193AA'), card = el && el.querySelector('.rm-card'), T = window.__V193AH.reasons
  const rows = el ? [...el.querySelectorAll('.rm-row.dep,.rm-row.arr')].map((r) => ({ rsn: r.dataset.rsn || '', chip: (r.querySelector('.rm-why') || {}).textContent || '', team: (r.querySelector('.rm-chip') || {}).textContent || '' })) : []
  const chips = el ? [...el.querySelectorAll('.rm-why')] : []
  return { rows, ok: rows.length > 0 && rows.every((r) => r.rsn && T[r.rsn] && r.chip === T[r.rsn][0]), note: (document.getElementById('rmWhyNoteV193AH') || {}).textContent || '', right: card ? Math.round(card.getBoundingClientRect().right) : 999, cardSW: card ? card.scrollWidth - card.clientWidth : 9, sw: document.scrollingElement.scrollWidth - innerWidth, chipsIn: chips.every((c) => c.getBoundingClientRect().right <= card.getBoundingClientRect().right + 0.5) }
})
console.log('season card rows:', JSON.stringify(C.rows.slice(0, 8)), C.note)
ok(opened && C.ok, 'the season card: every row a reason chip that names its reason (the v193 AA ±N TEAM chip kept beside it)', C.rows.slice(0, 4))
ok(C.rows.some((r) => ['clash', 'chem', 'lose', 'grad', 'transfer'].includes(r.rsn)) && /can't stand you|bad chemistry|tired of losing/.test(C.note), 'the note under the number counts why they left: "' + C.note + '"')
ok(C.rows.every((r) => /^[−+]\d+ TEAM$/.test(r.team)), 'v193 AA\'s team chips stay the first chip of each row', C.rows.map((r) => r.team).slice(0, 4))
ok(C.right <= 360 && C.cardSW <= 0 && C.sw <= 0 && C.chipsIn, 'the card with its chips fits 360 px', C)
await M(() => { const t = document.getElementById('toast'); t && t.classList.remove('show') })
await page.screenshot({ path: SHOT.replace(/\.png$/, '_season.png') })
await closeCard()

// ---------- 2. followers ----------
const D = await M(() => {
  const H = window.__V193AH, A = window.__GRIDIRON_AUDIT__, S = A.getState(), p = S.player
  const stat = (c) => { const n = c.reduce((a, b) => a + b, 0); return { n, c, p13: (c[1] + c[2] + c[3]) / n, p4: c.slice(4).reduce((a, b) => a + b, 0) / n, p7: c.slice(7).reduce((a, b) => a + b, 0) / n, p10: c[10] / n, zero: c[0], mean: c.reduce((a, x, i) => a + x * i, 0) / n } }
  const mk = (pn, o = {}) => Object.assign({}, p, { personaV13: pn, traits: o.traits || [], worldState: { teamChemistry: o.chem != null ? o.chem : 50 } })
  const pulls = {}
  const set = (tree, path) => { S.tree = tree || {}; S.path = path || null }
  set({}); pulls.neutral = H.pull(mk({ aggression: 5, iq: 5, eq: 5, longterm: 5, workethic: 5, loyalty: 5, confidence: 5, coachability: 5 })).pull
  pulls.warm = H.pull(mk({ loyalty: 10, eq: 10, coachability: 10, confidence: 0 })).pull
  pulls.toxic = H.pull(mk({ loyalty: 0, confidence: 10, eq: 0 })).pull
  const nodeP = []
  for (let L = 0; L <= 3; L++) { set({ piedPiperV193AH: L }); nodeP.push(H.pull(mk({})).pull) }
  set({ piedPiperV193AH: 3 }, 'captain')
  pulls.max = H.pull(mk({ loyalty: 10, eq: 10, coachability: 10, confidence: 0 }, { traits: ['bornLeader'], chem: 100 })).pull
  set({})
  const dist = {}
  for (const k of ['neutral', 'warm', 'toxic', 'max']) dist[k] = stat(H.dist(pulls[k], 10000, k))
  dist.node = nodeP.map((pl, L) => stat(H.dist(pl, 10000, 'node' + L)))
  return { pulls, nodeP, dist }
})
const pc = (x) => Math.round(x * 1000) / 10
for (const k of ['toxic', 'neutral', 'warm', 'max']) console.log(`distribution ${k} (pull ${D.pulls[k]}): ` + D.dist[k].c.slice(1).map((n, i) => `${i + 1}:${pc(n / 10000)}%`).join(' ') + `  · 1–3 ${pc(D.dist[k].p13)}% · 4+ ${pc(D.dist[k].p4)}% · 10 ${pc(D.dist[k].p10)}% · mean ${D.dist[k].mean.toFixed(2)}`)
D.dist.node.forEach((s, L) => console.log(`Pied Piper Lv ${L} (neutral, pull ${D.nodeP[L]}): ` + s.c.slice(1).map((n, i) => `${i + 1}:${pc(n / 10000)}%`).join(' ') + `  · 1–3 ${pc(s.p13)}% · 4+ ${pc(s.p4)}% · mean ${s.mean.toFixed(2)}`))
const every = [D.dist.neutral, D.dist.warm, D.dist.toxic, D.dist.max, ...D.dist.node]
ok(every.every((s) => s.n === 10000 && s.zero === 0), 'every roll brings 1–10 followers (never 0, never more than 10)')
ok(D.dist.neutral.p13 >= 0.8 && D.dist.neutral.p7 === 0 && D.dist.toxic.p13 >= 0.85, 'most of the time 1–3: neutral ' + pc(D.dist.neutral.p13) + '%, TOXIC ' + pc(D.dist.toxic.p13) + '% (7+ never without a big pull)')
ok(D.dist.max.p10 > 0 && D.dist.max.p10 < 0.02 && D.dist.max.p13 >= 0.5 && D.dist.warm.p10 === 0, '10 only in extremely rare circumstances: ' + pc(D.dist.max.p10) + '% at the maximum pull (great personality, Born Leader, The Captain, chemistry 100, Pied Piper 3) — never for a merely warm one', D.pulls)
ok(D.dist.toxic.mean < D.dist.neutral.mean && D.dist.neutral.mean < D.dist.warm.mean && D.dist.warm.mean < D.dist.max.mean, 'a negative personality brings fewer, a positive one more', [D.dist.toxic.mean, D.dist.neutral.mean, D.dist.warm.mean, D.dist.max.mean].map((x) => x.toFixed(2)))
ok(D.nodeP.every((v, L) => Math.abs(v - 0.8 * L) < 1e-6) && D.dist.node.every((s, L) => !L || s.mean > D.dist.node[L - 1].mean), 'Pied Piper +0.8 pull a level shifts the distribution up', D.dist.node.map((s) => s.mean.toFixed(2)))

// a level up: the followers come along
await setup({ persona: WARM, level: 4, prompt: true, chem: 70, traits: ['bornLeader'], tune: { v153Broster: 0 } }) // no locker-room lift on a follower: his number is the scaled one
const L0 = await M(() => { const p = window.__GRIDIRON_AUDIT__.getState().player; return { R: p.teamRosterV158.map((m) => ({ name: m.name, ovr: m.ovr, pos: m.pos })), T0: p.rosterMetaV193AA.target, team: p.teamSnapV193AA && p.teamSnapV193AA.teamName } })
await M(() => { const p = window.__GRIDIRON_AUDIT__.getState().player; p.level++; p.seasonsAtLevel = 0; p.totalSeasons++; window.startSeasonGames() })
const lvOpen = await waitCard()
const F = await M((L0) => {
  const p = window.__GRIDIRON_AUDIT__.getState().player, R = window.__V158_ROSTER(), F = p.followV193AH, T1 = p.rosterMetaV193AA.target
  const men = R.filter((m) => m.followV193AH)
  const scaled = men.map((m) => { const o = L0.R.find((x) => x.name === m.name); return o ? { name: m.name, ovr: m.ovr, want: Math.round(o.ovr / L0.T0 * T1 * 0.97), pos: m.pos === o.pos } : null })
  const top = L0.R.filter((x) => x.pos !== 'K' && x.pos !== 'P').sort((a, b) => b.ovr - a.ovr).slice(0, F.n + 3).map((x) => x.name)
  const el = document.getElementById('rmV193AA')
  return { F, n: men.length, scaled, fromTop: men.every((m) => top.includes(m.name)), T1, text: el ? el.innerText : '', note: (document.getElementById('rmFollowNoteV193AH') || {}).textContent || '', rows: el ? [...el.querySelectorAll('.rm-row.arr')].map((r) => ({ rsn: r.dataset.rsn, chip: (r.querySelector('.rm-why') || {}).textContent || '' })) : [], dep: el ? [...el.querySelectorAll('.rm-row.dep')].map((r) => (r.querySelector('.rm-why') || {}).textContent || '') : [], kind: window.__V193AA.rec.last && window.__V193AA.rec.last.kind, chem: p.worldState.teamChemistry }
}, L0)
console.log('followers:', JSON.stringify({ F: F.F, scaled: F.scaled, note: F.note }))
ok(lvOpen && F.kind === 'team' && F.n === F.F.n && F.n >= 1 && F.n <= 10 && F.fromTop, 'a level up: ' + F.n + ' of his best former teammates follow him into the new roster', F.F)
ok(F.scaled.every((x) => x && x.ovr === x.want && x.pos), 'each follower is in a slot at his position, his rating scaled to the new level (OVR / old target × new target × 0.97)', F.scaled)
ok(F.note === `A NEW TEAM · ${F.n} followed you from ${F.F.from}` && F.F.from && F.F.from === (L0.team || F.F.from), 'the card notes "' + F.note + '"')
ok(F.rows.filter((r) => r.rsn === 'follow').length === Math.min(5, F.n) && F.rows.filter((r) => r.rsn === 'follow').every((r) => r.chip === 'Followed you ★') && F.rows.slice(0, Math.min(5, F.n)).every((r) => r.rsn === 'follow'), 'his followers lead the new team\'s rows as "Followed you ★"', F.rows)
ok(F.dep.length && F.dep.every((t) => t === 'Stayed behind') && F.rows.filter((r) => r.rsn === 'newmate').every((r) => r.chip === 'New teammate'), 'the men he left "Stayed behind", the rest are "New teammate"', { dep: F.dep, rows: F.rows.map((r) => r.chip) })
await M(() => { window.__V193AA.skip(); const t = document.getElementById('toast'); t && t.classList.remove('show') })
await page.waitForTimeout(500)
await page.screenshot({ path: SHOT })
await closeCard()
const SR = await M(() => {
  window.go('season')
  const sc = document.getElementById('screen'), f = sc.querySelector('[id^=rmFollowV193AH_]'), my = sc.querySelector('#myTeamV186 .eyebrow')
  window.openRosterPrestigeV158 && window.openRosterPrestigeV158('roster')
  const list = (document.getElementById('rosterPrestigeV158') || {}).innerText || ''
  window.closeRosterPrestigeV158 && window.closeRosterPrestigeV158()
  const row = sc.querySelector('[id^=rmTeamRowV193AA_]')
  return { f: f ? f.textContent : '', my: my ? my.textContent : '', list: (list.match(/★ followed you/g) || []).length, right: row ? Math.round(row.getBoundingClientRect().right) : 999, sw: document.scrollingElement.scrollWidth - innerWidth }
})
ok(SR.f === `★ ${F.n} follower${F.n === 1 ? '' : 's'}` && /★ \d+ FOLLOWERS?/.test(SR.my), 'the season\'s team row says "' + SR.f + '", MY TEAM says it too', SR.my)
ok(SR.list === F.n, 'src/10\'s roster list marks each follower', SR.list)
ok(SR.right <= 360 && SR.sw <= 0, 'the team row with its followers chip fits 360 px', SR)
await M(() => { window.__GRIDIRON_AUDIT__.getState().player.rmQV193AA = [] })

// a UFF club change is a NEW FRANCHISE; a locked recruit who follows keeps his lock
await setup({ persona: NEUTRAL, level: 7, prompt: true, club: 'Club A', tune: { ahFollowMaxV193AH: 1, ahFollowPoolV193AH: 0 } })
const RC = await M(() => {
  const p = window.__GRIDIRON_AUDIT__.getState().player, r = window.__V193AA.sign(2)
  const m = p.teamRosterV158.find((x) => x.name === r.man.name)
  m.ovr = m.overall = m.carryOvrV193AA = 400 // the best man on the roster: with one follower and no pool, he is the one
  p.rmQV193AA = []; window.go('hub')
  p.clubV146B = { name: 'Club B', town: 'Club B City', mascot: 'Rams' }; p.totalSeasons++; p.seasonsAtLevel++
  window.__V158_ROSTER()
  const q = p.rmQV193AA[0], n = p.teamRosterV158.find((x) => x.name === r.man.name)
  return { name: r.man.name, until0: r.man.lockedUntilV193AA, settled: !!n && n.carryOvrV193AA !== n.ovr && n.carryOvrV193AA < 200, q: q && { kind: q.kind, franchise: q.franchise, follow: q.follow }, there: !!n, fol: !!(n && n.followV193AH), until: n && n.lockedUntilV193AA, left: n ? window.__V193AA.lockLeft(n) : null, followers: window.__V193AH.followers() }
})
ok(RC.q && RC.q.kind === 'team' && RC.q.franchise && RC.q.follow && RC.q.follow.n === 1, 'a new UFF club is a NEW FRANCHISE, its follower counted', RC.q)
ok(RC.there && RC.fol && RC.until === RC.until0 && RC.left > 0, 'the locked recruit who follows keeps his lock (followers never count against it)', RC)
ok(RC.settled, 'in the UFF the club offer stays the first season team rating: the follower settles in (the team term counts him from the next season)', RC)
const FR = (await waitCard()) && (await M(() => ({ eye: document.querySelector('#rmV193AA .rm-eye').textContent, note: (document.getElementById('rmFollowNoteV193AH') || {}).textContent || '' })))
ok(FR && /NEW FRANCHISE/.test(FR.eye) && /^NEW FRANCHISE · 1 followed you from /.test(FR.note), 'the card says NEW FRANCHISE · 1 followed you from …', FR)
await closeCard()

// ---------- 3. the negative personality's trade-off ----------
await setup({ persona: TOXIC, level: 4, prompt: true, tune: { ahArrivePBaseV193AH: 2, ahArrivePMaxV193AH: 1 } })
const G = await M(() => {
  const H = window.__V193AH, p = window.__GRIDIRON_AUDIT__.getState().player, n = Object.assign({}, p, { personaV13: { loyalty: 5 } })
  const on = H.growthMul(p), onN = H.growthMul(n)
  window.RIB_TUNE.v193AH = 0; const off = H.growthMul(p), offN = H.growthMul(n); window.RIB_TUNE.v193AH = 1
  return { tox: H.leans(p).tox, k: on / off, kN: onN / offN, grow: H.grow(p) }
})
ok(Math.abs(G.k - (1 + Math.min(0.15, G.tox * 0.08))) < 1e-9 && Math.abs(G.k - 1.15) < 1e-9 && G.kN === 1, 'the season growth multiplier (growthMulV192C, the sim and its preview) is ×1.15 for TOXIC 1.95 (+8% a point, ≤ 15%), ×1 for a neutral one', G)
const tr0 = await M(() => window.__GRIDIRON_AUDIT__.getState().player.coachTrust)
await M(() => { const p = window.__GRIDIRON_AUDIT__.getState().player; p.level++; p.seasonsAtLevel = 0; p.totalSeasons++; window.startSeasonGames() })
const arOpen = await waitCard()
const AR = await M(() => {
  const H = window.__V193AH, p = window.__GRIDIRON_AUDIT__.getState().player, A = p.arrivalV193AH
  const s1 = H.depthScore(p); window.RIB_TUNE.v193AH = 0; const s0 = H.depthScore(p); window.RIB_TUNE.v193AH = 1
  return { A, d: H.arriveDepth(p), s1, s0, trust: p.coachTrust, note: (document.getElementById('rmArriveNoteV193AH') || {}).textContent || '' }
})
ok(AR.A && AR.A.hit && AR.d >= 6 && AR.d <= 14 && Math.abs(AR.s1 - AR.s0 - AR.d) < 1e-6, 'a TOXIC lean arrives as one of the new team\'s best: +' + AR.d + ' on the depth chart\'s score (his first season there)', AR)
ok(AR.trust === Math.min(100, tr0 + AR.A.trust) && AR.A.trust === Math.round(AR.d * 0.5), 'and +' + AR.A.trust + ' coach trust, once', { tr0, trust: AR.trust })
ok(arOpen && AR.note.includes(`+${AR.d} on the depth chart`), 'the card says it: "' + AR.note + '"')
await closeCard()
const AR2 = await M(() => { const p = window.__GRIDIRON_AUDIT__.getState().player; p.totalSeasons++; return window.__V193AH.arriveDepth(p) })
ok(AR2 === 0, 'the edge is his first season at the program only')
const PV = await M(() => { window.__personaViewV192C(); const t = (document.getElementById('personaViewV192C') || {}).innerText || ''; document.getElementById('personaViewV192C')?.remove(); return t })
ok(/\+15% attribute growth — a chip on his shoulder/.test(PV) && /a new team starts him as one of its best/.test(PV) && /Can't stand you/.test(PV) && /to a new team: 1–3 follow you \d+%, 4\+ \d+%/.test(PV), 'the personality page states the trade-off in whole numbers', (PV.match(/.*(chip on his shoulder|one of its best|Can't stand you|follow you).*/g) || []).join(' | '))
const odds3 = await M(() => { delete window.RIB_TUNE.ahArrivePBaseV193AH; delete window.RIB_TUNE.ahArrivePMaxV193AH; return [window.__V193AH.arriveOdds(1.95), window.__V193AH.arriveOdds(0.5), window.__V193AH.arriveOdds(0.2)] })
ok(odds3[0] === 0.95 && Math.abs(odds3[1] - 0.475) < 1e-9 && odds3[2] === 0, 'arrival odds 30% + 35% a TOXIC point (≤ 95%; none under TOXIC 0.25)', odds3)

// ---------- 4. Pied Piper ----------
const N = await M(() => {
  const A = window.__GRIDIRON_AUDIT__, S = A.getState(), H = window.__V193AH, nd = A.TREE_NODES.piedPiperV193AH, nb = A.TREE_NODES.personaPlus
  S.tree = {}; const c0 = A.nodeCost(nd), cIdent = A.nodeCost(nb)
  const p = S.player; p.personaV13 = { loyalty: 0, confidence: 10, eq: 0 }; p.worldState.teamChemistry = 50; p.seasonLogV77 = []; p.weekResults = []
  const cl = []
  for (let L = 0; L <= 3; L++) { S.tree = { piedPiperV193AH: L }; cl.push(H.leaveOdds(p).clash) }
  S.tree = {}
  const say = [0, 1, 2, 3].map((L) => Math.round(H.weights(0.8 * L).slice(3).reduce((a, b) => a + b, 0) * 100))
  return { branch: nd.branch, c0, cIdent, max: nd.max, desc: nd.desc, cl, say, art: window.NODE_ART_V193Y && window.NODE_ART_V193Y[nd.icon], icon: nd.icon }
})
ok(N.branch === 'mental' && N.c0 === 12 * 24 && N.c0 === N.cIdent && N.max === 3, 'Pied Piper sits in the Mental branch, priced like Identity Coach beside it (12 × the branch\'s ×24 = 288 PP), max 3', N)
ok(N.art === 'megaphone', 'v193 Y draws its ' + N.icon + ' (megaphone)')
ok(N.cl.every((v, L) => Math.abs(v - N.cl[0] * (1 - 0.25 * L)) < 1e-9) && N.cl[3] > 0, '"Can\'t stand you" −25% a level', N.cl)
ok(N.desc.includes(N.say.map((x) => x + '%').join(' → ')) && /\+0\.8 follow pull/.test(N.desc) && /−25%/.test(N.desc), 'its desc states the real numbers: 4+ followers ' + N.say.join(' → '), N.desc)
await M(() => { window.go('shop'); window.setBranch && window.setBranch('mental') })
await page.waitForTimeout(400)
const TR = await M(() => { const it = [...document.querySelectorAll('#branchNodes .shop-item')].find((x) => /Pied Piper/.test(x.textContent)); return it ? { buy: (it.querySelector('.buy') || {}).textContent, art: !!it.querySelector('.ra-v193y'), right: Math.round(it.getBoundingClientRect().right), sw: document.scrollingElement.scrollWidth - innerWidth } : null })
ok(TR && TR.art && /288/.test(TR.buy || '') && TR.right <= 360 && TR.sw <= 0, 'the tree draws it with its art at 288 PP, inside 360 px', TR)

// ---------- 5. kill switch ----------
await setup({ persona: TOXIC, level: 4, prompt: false, log: [{ wins: 0, losses: 10 }], tune: { v193AH: 0 } })
const K1 = await seasonEnd({ noGrad: false, chem: 10 })
await M(() => { const p = window.__GRIDIRON_AUDIT__.getState().player; p.rmQV193AA = []; p.level++; p.seasonsAtLevel = 0; p.totalSeasons++; window.startSeasonGames() })
const K2 = await M(() => {
  const p = window.__GRIDIRON_AUDIT__.getState().player, H = window.__V193AH, q = (p.rmQV193AA || []).find((x) => x.kind === 'team')
  const h = (() => { window.RIB_TUNE.v193AAprompt = 1; window.go('season'); return 1 })()
  return { fol: p.teamRosterV158.filter((m) => m.followV193AH).length, follow: p.followV193AH || null, q: q && { follow: q.follow, arr: q.arr.map((a) => a.rsn || null) }, grow: H.grow(p), depth: H.arriveDepth(p), arrival: p.arrivalV193AH || null, on: H.on(), h }
})
ok(K1.dep.length && K1.dep.every((d) => !d.r && !/can't stand|tired of losing|went sour/.test(d.why)) && K1.arr.every((a) => !a.r), 'TU v193AH 0: v193 AA\'s turnover, no reasons and no extra departures', K1.dep.map((d) => d.why))
ok(!K2.on && K2.fol === 0 && !K2.follow && K2.q && !K2.q.follow && K2.q.arr.every((r) => !r) && K2.grow === 1 && K2.depth === 0 && !K2.arrival, 'TU v193AH 0: a new level is all new (no followers), no growth or arrival edge', K2)
const K3 = (await waitCard()) && (await M(() => { const el = document.getElementById('rmV193AA'); return { chips: el.querySelectorAll('.rm-why').length, notes: el.querySelectorAll('.rm-note').length, eye: el.querySelector('.rm-eye').textContent } }))
ok(K3 && K3.chips === 0 && K3.notes === 0 && /A NEW TEAM/.test(K3.eye), 'TU v193AH 0: the card is v193 AA\'s (no chips, no notes)', K3)
await closeCard()
await M(() => { window.RIB_TUNE.v193AH = 1; window.RIB_TUNE.v193AAprompt = 0 })

console.log('page errors:', errs.length ? errs.join('\n') : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
