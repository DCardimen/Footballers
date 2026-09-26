// Dev check (v156 B SEASON SIMS ARE EARNED, PLAYOFFS ARE PLAYED) — src/07-career-app.js's v156 B block, the v151 A
// skip functions it takes over, simSeasonV147 / postV147 / screenSeason / the live SKIP, and src/27-monetize.js's
// `simUnlimited` placement. docs/MONETIZATION.md.
//
// OFF (the default):
//   - the ⏭ allowance is a CAREER's: 1 on a fresh account; Legacy XP that completes the BRONZE medals makes it 2, every
//     group 20 (the `skipsMaxV156B` cap holds); one sim is spent a use, 0 left refuses with the explanation (the next
//     group, the table); a new career starts at 0 used; there is no day; Quick Play is unlimited and never counted
//   - a playoff week: the dock offers only "▶ Play … Live" (no Quick Play, no ⏭), the live SKIP is gone, and
//     playWeek(false) / prepareWeek103(false) / seasonSkipV151A / simRemainingWeeks / __silentWeekV85 cannot play it;
//     an injured DNP week is still sat out
//   - the UFF's sim stops at the playoffs (spending one sim) and a missed-playoffs season still finishes
//   - the kill switches (TU v156Bskips 0, v156Bplayoffs 0) bring the old paths back
//   - the store module stays a no-op (no key, no node)
// ON (`?monetize=1`, dev host): none left → the store's sheet; the rewarded ad makes every sim free for 30 minutes
//   ("∞ for 30 min"), then it expires on the module's clock; Pro +3 a career; the Club (member) never counts a sim.
// No page errors.
//   GAME_URL=http://localhost:5451/index.html node scripts/v156Bcheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = (...q) => url + (url.includes('?') ? '&' : '?') + ['stayStale', 'noFilmV114', 'noGrowV132'].concat(q).join('&')
const ON = ['monetize=1', 'monetizeAdMs=300']
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const newCtx = async () => {
  const context = await browser.newContext({ viewport: { width: 400, height: 860 } })
  await context.addInitScript(() => {
    window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, {})
    try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
    setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 60)
  })
  return context
}
const booted = (page) => page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V156B && !!window.__V151A, null, { timeout: 40000 })
  .then(() => page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null))
  .then(() => page.waitForTimeout(900))
const open = async (ctx, tag, q = []) => {
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(tag + ': ' + (e.message || e)))
  await p.goto(U(...q), { waitUntil: 'networkidle', timeout: 60000 }); await booted(p); await p.evaluate(() => document.getElementById('splash')?.remove()); return p
}
const M = (page, fn, arg) => page.evaluate(fn, arg)
// a career with a season in hand: below the UFF a plain player, at 7 a signed UFF man (the v147Acheck route)
const seed = (page, o = {}) => M(page, (o) => {
  const A = window.__GRIDIRON_AUDIT__, S = o.keep ? A.getState() : A.freshState(); S.tutorialSeen = true; S.tree = S.tree || {}
  if (!o.keep) A.setState(S)
  S.player = A.newPlayer(); const p = S.player; p.name = 'Test Man'; p.pos = 'QB'; p.age = 22; p.originV11 = p.originV11 || 'walk-on'; p._wonShown = true
  if ((o.level || 0) >= 7) { p.level = 6; p.totalSeasons = 12; p.career = []; S.view = 'hub'; A.advance(); window.__V146B.sign(2); for (const k in p.attrs) p.attrs[k] = 280; p.age = 27; if (p.nflStateV11) { p.nflStateV11.security = 90; p.nflStateV11.status = 'starter' } }
  else p.level = o.level || 0
  p.training = 'balanced'; A.startSeasonGames()
  document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove()
  window.go('season'); window.GridironStorage.save(S)
  return { level: p.level, weeks: (p.weekResults || []).length }
}, o)
const played = (page) => M(page, () => window.S.player.weekResults.filter((w) => w.played).length)
const dockOf = (page) => M(page, () => { const d = document.getElementById('dock'); return { txt: (d.innerText || '').replace(/\s+/g, ' '), sim: !!d.querySelector('[onclick^="seasonSkipV151A"]'), quick: !!d.querySelector('[onclick*="(false)"]'), note: !!d.querySelector('.playoff-live-v156b') } })
// the regular season decided by hand (won or lost), the season screen drawn (it books the first playoff round)
const decide = (page, won, leave = 0) => M(page, ({ won, leave }) => { const p = window.S.player, r = p.weekResults.filter((w) => !w.playoff)
  r.slice(0, r.length - leave).forEach((w) => { w.played = true; w.won = won; w.us = won ? 31 : 10; w.them = won ? 10 : 31; w.perf = won ? 80 : 40 }); window.go('season')
  return p.weekResults.map((w) => (w.played ? 'P' : '.') + (w.playoff ? 'p' : '')).join('') }, { won, leave })
const goLive = (page) => M(page, async () => { const S = window.S, t = S.player, a = t.weekResults.findIndex((n) => !n.played); t.currentWeek = a
  S._liveGame = window.__simGameV2(t.weekResults[a].perf || 60, t.pos); S._oppName = t.weekResults[a].opp; window.go('live')
  for (let i = 0; i < 40 && !document.querySelector('.speed-row'); i++) await new Promise((r) => setTimeout(r, 150))
  return { skip: !!document.querySelector('.speed-row [onclick="skipLive()"]'), row: !!document.querySelector('.speed-row'), playoff: !!t.weekResults[a].playoff } })
// out of a live game through its own SKIP (a playoff game's only with the kill switch — it books the game)
const leaveLive = (page) => M(page, async () => { const k = window.RIB_TUNE.v156Bplayoffs; window.RIB_TUNE.v156Bplayoffs = 0; try { window.skipLive() } finally { if (k == null) delete window.RIB_TUNE.v156Bplayoffs; else window.RIB_TUNE.v156Bplayoffs = k }
  await new Promise((r) => setTimeout(r, 600)); document.querySelectorAll('.decision-overlay').forEach((e) => e.remove()); window.go('season') })

// ============================== 1. OFF: the allowance is a career's, earned with medals ==============================
{
  const c = await newCtx(), a = await open(c, 'off')
  const off = await M(a, () => ({ on: window.RIB_MONETIZE.enabled, keys: Object.keys(localStorage).filter((k) => /monetize/.test(k)), nodes: document.querySelectorAll('[id^="mz149"],[class*="mz149"],[class*="mz151"]').length, unl: window.RIB_MONETIZE.has('simUnlimited') }))
  ok(!off.on && !off.keys.length && !off.nodes && !off.unl, 'OFF: the store module is a no-op — no key, no node, no simUnlimited', off)
  await seed(a)
  const s0 = await M(a, () => window.__V156B.skips())
  ok(s0.model === 'career' && s0.allowed === 1 && s0.left === 1 && s0.used === 0 && s0.medals <= 1 && s0.groups.length === 9, 'OFF: a fresh account has 1 season sim this career', { allowed: s0.allowed, left: s0.left, medals: s0.medals })
  const g = await M(a, () => { const V = window.__V152A, pay = (m) => V.pay(null, Math.max(0, V.xpAt(m) - V.state().xp), 'check'), out = {}
    pay(59); out.bronze = window.__V156B.skips().allowed; out.medals = window.__V156B.medals(); out.line = window.__V156B.line()
    pay(120); out.silver = window.__V156B.skips().allowed
    pay(500); out.all = window.__V156B.skips().allowed; out.next = window.__V156B.skips().next
    window.RIB_TUNE.skipsMaxV156B = 8; out.capped = window.__V156B.skips().allowed; delete window.RIB_TUNE.skipsMaxV156B
    out.table = window.__V156B.table(); window.S.legacyV152.xp = 0; out.back = window.__V156B.skips().allowed; return out })
  ok(g.medals === 59 && g.bronze === 2 && g.silver === 4 && g.all === 20 && g.next === null && g.capped === 8 && g.back === 1, 'OFF: completing BRONZE makes it 2, SILVER 4, every group 20 (the skipsMaxV156B cap holds)', g)
  ok(/BRONZE/.test(g.table) && /GRAND/.test(g.table) && (g.table.match(/\+\d/g) || []).length === 9, 'OFF: the per-group bonus table lists the nine groups')
  // the button, the spend, the refusal
  const btn = await M(a, () => { window.go('season'); const b = document.querySelector('[onclick^="seasonSkipV151A"]'); return b ? b.textContent.replace(/\s+/g, ' ') : null })
  ok(btn && /Sim Remaining Regular Season/i.test(btn) && /1 left this career/.test(btn), 'OFF: the ⏭ button says "1 left this career"', btn)
  const q0 = await M(a, async () => { const p = window.S.player, n0 = p.weekResults.filter((w) => w.played).length; window.playWeek(false); await new Promise((r) => setTimeout(r, 1500)); window.playWeek(false); await new Promise((r) => setTimeout(r, 1500))
    return { n0, n1: p.weekResults.filter((w) => w.played).length, used: window.__V156B.skips().used } })
  ok(q0.n1 === q0.n0 + 2 && q0.used === 0, 'OFF: Quick Play sims week after week and is never counted', q0)
  const sp = await M(a, async () => { const p = window.S.player, n0 = p.weekResults.filter((w) => w.played).length; window.seasonSkipV151A(); await new Promise((r) => setTimeout(r, 2500))
    return { n0, n1: p.weekResults.filter((w) => w.played).length, reg: p.weekResults.filter((w) => !w.playoff && !w.played).length, used: p.simsUsedV156B, s: window.__V156B.skips() } })
  ok(sp.n1 > sp.n0 && sp.reg === 0 && sp.used === 1 && sp.s.left === 0, 'OFF: the ⏭ sims the rest of the regular season and spends the career\'s one', { n0: sp.n0, n1: sp.n1, reg: sp.reg, used: sp.used, left: sp.s.left })
  // a new season in the same career: nothing left, the tap explains
  await M(a, () => { const A = window.__GRIDIRON_AUDIT__; window.S.player.training = 'balanced'; A.startSeasonGames(); window.go('season') })
  const rf = await M(a, async () => { const p = window.S.player, n0 = p.weekResults.filter((w) => w.played).length; window.seasonSkipV151A(); await new Promise((r) => setTimeout(r, 400))
    const d = document.getElementById('ribDlgV149'), txt = d ? d.textContent.replace(/\s+/g, ' ') : ''; d?.querySelector('button')?.click()
    const b = document.querySelector('[onclick^="seasonSkipV151A"]')
    return { n0, n1: p.weekResults.filter((w) => w.played).length, txt, btn: b ? b.textContent.replace(/\s+/g, ' ') : '', used: p.simsUsedV156B } })
  ok(rf.n1 === rf.n0 && rf.used === 1 && /No season sims left this career/.test(rf.txt) && /BRONZE/.test(rf.txt) && /\+1/.test(rf.txt) && /Quick Play/.test(rf.txt) && /None left · complete the BRONZE medals for \+1/.test(rf.btn), 'OFF: with none left the ⏭ refuses and explains the next medal group (and the table)', rf)
  const day = await M(a, () => { window.S.skipsV151A = { day: '1999-1-1', used: 0 }; return window.__V156B.skips().left })
  ok(day === 0, 'OFF: there is no day — an old day record gives nothing back', day)
  const qp = await M(a, async () => { const p = window.S.player, n0 = p.weekResults.filter((w) => w.played).length; window.playWeek(false); await new Promise((r) => setTimeout(r, 1500)); return { n0, n1: p.weekResults.filter((w) => w.played).length, used: p.simsUsedV156B } })
  ok(qp.n1 === qp.n0 + 1 && qp.used === 1, 'OFF: with no sims left Quick Play still plays a week, free', qp)
  // a new career: the used count lives on the player
  await seed(a, { keep: true })
  const nc = await M(a, () => ({ used: window.__V156B.skips().used, left: window.__V156B.skips().left, field: 'simsUsedV156B' in window.S.player }))
  ok(nc.used === 0 && nc.left === 1 && !nc.field, 'OFF: a new career starts with the whole allowance again', nc)
  // kill switch: the old ladder
  const ks = await M(a, () => { window.RIB_TUNE.v156Bskips = 0; const s = window.__V151A.skips(); delete window.RIB_TUNE.v156Bskips; return { model: s.model || null, perDay: s.perDay, lifetime: s.lifetime != null } })
  ok(ks.model === null && typeof ks.perDay === 'number' && ks.lifetime, 'OFF: TU v156Bskips 0 brings back v151 A\'s day ladder', ks)
  await c.close()
}

// ============================== 2. OFF: the playoffs are played live ==============================
{
  const c = await newCtx(), a = await open(c, 'playoffs')
  await seed(a)
  const reg = await goLive(a)
  ok(reg.row && reg.skip && !reg.playoff, 'a regular-season live game keeps its SKIP', reg)
  await leaveLive(a)
  const wk = await decide(a, true); await a.waitForTimeout(500)
  const d = await dockOf(a)
  ok(/p$/.test(wk) && /\.p$/.test(wk) && /Play .*Live/i.test(d.txt) && !/Quick Play/i.test(d.txt) && !d.sim && !d.quick && d.note, 'a playoff week\'s dock offers only "▶ Play … Live" — no Quick Play, no ⏭', { wk, d })
  const tries = await M(a, async () => { const p = window.S.player, n0 = p.weekResults.filter((w) => w.played).length, w = p.weekResults.find((x) => !x.played)
    const out = { pw: window.playWeek(false), pp: window.prepareWeek103(false), sk: window.seasonSkipV151A(), sr: window.simRemainingWeeks(), sw: window.__silentWeekV85(p, w) }
    await new Promise((r) => setTimeout(r, 1500)); document.querySelector('.gameplan-overlay')?.remove()
    return { n0, n1: p.weekResults.filter((w) => w.played).length, sw: out.sw, used: p.simsUsedV156B | 0, refused: window.__V156B.refused, lock: window.__V156B.playoffLock() } })
  ok(tries.n1 === tries.n0 && tries.sw === false && tries.used === 0 && tries.refused >= 3 && tries.lock, 'playWeek(false), prepareWeek103(false), the ⏭, simRemainingWeeks and __silentWeekV85 cannot play a playoff game unwatched — and no sim is spent', tries)
  const inj = await M(a, () => { const p = window.S.player, c = p.conditionV11 || (p.conditionV11 = {}), keep = c.injury; c.injury = { name: 'Ankle sprain', weeksRemaining: 2, severity: 2 }; const lock = window.__V156B.playoffLock(); c.injury = keep; return lock })
  ok(inj === false, 'an injured DNP playoff week is not locked (it sits out by itself)', inj)
  const ksw = await M(a, async () => { window.RIB_TUNE.v156Bplayoffs = 0; window.go('season'); await new Promise((r) => setTimeout(r, 300)); const t = document.getElementById('dock').innerText; delete window.RIB_TUNE.v156Bplayoffs; window.go('season'); return /Quick Play/i.test(t) })
  ok(ksw, 'TU v156Bplayoffs 0 gives the playoff week its Quick Play back', ksw)
  const po = await goLive(a)
  const sk = await M(a, async () => { const v0 = window.S.view; window.skipLive(); await new Promise((r) => setTimeout(r, 300)); return { v0, v1: window.S.view, played: window.S.player.weekResults.find((w) => w.playoff).played } })
  ok(po.row && po.playoff && !po.skip && sk.v1 === 'live' && !sk.played, 'a playoff game on the field has no SKIP, and skipLive() refuses', { po, sk })
  await leaveLive(a)
  // below the UFF, a missed-playoffs season still finishes
  await seed(a)
  await decide(a, false); await a.waitForTimeout(400)
  const miss = await M(a, async () => { const t = document.getElementById('dock').innerText; window.finishSeasonGames(); await new Promise((r) => setTimeout(r, 800)); return { finish: /Finish Season/i.test(t), view: window.S.view, po: window.S.player.playoffState } })
  ok(miss.finish && miss.view === 'result' && miss.po && !miss.po.qualified, 'a season that misses the playoffs finishes to the report', miss)
  await c.close()
}

// ============================== 3. OFF: the UFF's season sim stops at the playoffs ==============================
{
  const c = await newCtx(), a = await open(c, 'uff')
  await seed(a, { level: 7 })
  await decide(a, true, 1); await a.waitForTimeout(400)
  const b0 = await dockOf(a)
  ok(/Sim the Rest of the Regular Season/i.test(b0.txt) && /1 left this career/i.test(b0.txt), 'UFF: the dock\'s ⏭ says "Sim the Rest of the Regular Season · 1 left this career"', b0.txt)
  const u = await M(a, async () => { window.seasonSkipV151A(); await new Promise((r) => setTimeout(r, 2500)); const p = window.S.player
    return { view: window.S.view, last: window.__V147A.lastSim, wk: p.weekResults.map((w) => (w.played ? 'P' : '.') + (w.playoff ? 'p' : '')).join(''), used: p.simsUsedV156B } })
  const d = await dockOf(a)
  ok(u.view === 'season' && u.last && u.last.why === 'playoffs' && u.last.po === 0 && /\.p$/.test(u.wk) && u.used === 1, 'UFF: the sim plays the regular season, stops before the playoffs and spends one sim', u)
  ok(/Play .*Live/i.test(d.txt) && !/Quick Play/i.test(d.txt) && !d.sim, 'UFF: the playoff week\'s dock offers only the live game (postV147 adds no ⏭)', d)
  const again = await M(a, async () => { const p = window.S.player, n0 = p.weekResults.filter((w) => w.played).length; window.__V147A.sim(); window.seasonSkipV151A(); await new Promise((r) => setTimeout(r, 800)); return { n0, n1: p.weekResults.filter((w) => w.played).length, used: p.simsUsedV156B, view: window.S.view } })
  ok(again.n1 === again.n0 && again.used === 1 && again.view === 'season', 'UFF: the season sim and the ⏭ cannot play the playoffs', again)
  // a missed-playoffs UFF season: the sim finishes the season
  await seed(a, { level: 7, keep: true })
  await decide(a, false, 1); await a.waitForTimeout(400)
  const m = await M(a, async () => { window.seasonSkipV151A(); for (let i = 0; i < 40 && window.S.view !== 'result'; i++) await new Promise((r) => setTimeout(r, 250)); return { view: window.S.view, last: window.__V147A.lastSim } })
  ok(m.view === 'result' && m.last && m.last.left === 0 && !m.last.why, 'UFF: a season that misses the playoffs sims to the report card', m)
  await c.close()
}

// ============================== 4. ON: the ad, Pro, the Club ==============================
{
  const c = await newCtx(), p = await open(c, 'on', ON)
  await seed(p)
  const pl = await M(p, () => ({ place: Object.keys(window.RIB_MONETIZE.config.placements).join(','), allowed: window.RIB_MONETIZE.keyAllowed('simUnlimited'), extra: window.RIB_MONETIZE.keyAllowed('simExtra') }))
  ok(pl.place === 'speed4,simUnlimited,cosTrial' && pl.allowed && !pl.extra, 'ON: the sim placement is simUnlimited (simExtra is gone)', pl)
  const sh = await M(p, async () => { window.S.player.simsUsedV156B = 1; window.seasonSkipV151A(); await new Promise((r) => setTimeout(r, 300)); const s = document.getElementById('mz149Sheet'), t = s ? s.textContent : ''; s?.remove(); return t })
  ok(/NO SEASON SIMS LEFT THIS CAREER/.test(sh) && /BRONZE medals/.test(sh) && /30 minutes/.test(sh) && /played live/.test(sh), 'ON: none left → the store\'s sheet explains the medals and offers 30 minutes of unlimited sims', sh)
  const ad = await M(p, async () => { const r = await window.RIB_MONETIZE.rewardSim(), s = window.__V156B.skips(); window.go('season')
    const b = document.querySelector('[onclick^="seasonSkipV151A"]'); const n0 = window.S.player.weekResults.filter((w) => w.played).length
    window.seasonSkipV151A(); await new Promise((r) => setTimeout(r, 2500))
    return { r: r.rewarded, min: r.reward && r.reward.minutes, unl: s.unlimited, left: s.left, ml: s.minutesLeft, btn: b ? b.textContent.replace(/\s+/g, ' ') : '', n0, n1: window.S.player.weekResults.filter((w) => w.played).length, used: window.S.player.simsUsedV156B } })
  ok(ad.r && ad.min === 30 && ad.unl && ad.left === Infinity && ad.ml === 30 && /∞ for 30 min/.test(ad.btn), 'ON: the rewarded ad makes sims unlimited for 30 minutes — the button says "∞ for 30 min"', ad)
  ok(ad.n1 > ad.n0 && ad.used === 1, 'ON: a sim while boosted runs and is not counted', { n0: ad.n0, n1: ad.n1, used: ad.used })
  const ex = await M(p, () => { const R = window.RIB_MONETIZE; R.dev.advance(29 * 60e3); const mid = window.__V156B.skips().unlimited; R.dev.advance(2 * 60e3); const s = window.__V156B.skips(); R.dev.advance(-31 * 60e3); return { mid, after: s.unlimited, left: s.left } })
  ok(ex.mid && !ex.after && ex.left === 0, 'ON: the boost expires after 30 minutes and the count is back to none left', ex)
  const pro = await M(p, () => { const R = window.RIB_MONETIZE; R.grant('pro', { source: 'check' }); const a = window.__V156B.skips(); R.revoke('pro'); R.grant('member', { periodDays: 31, source: 'check' }); const b = window.__V156B.skips(); const line = window.__V156B.line(); R.revoke('member'); return { pro: a.pro, allowed: a.allowed, club: b.club, unl: b.unlimited, line } })
  ok(pro.pro === 3 && pro.allowed === 4 && pro.club && pro.unl && /Club/.test(pro.line), 'ON: Pro adds 3 sims a career; the Club membership never counts a sim', pro)
  await M(p, () => window.RIB_MONETIZE.openStore()); await p.waitForTimeout(400)
  const st = await M(p, () => { const s = document.getElementById('mz149Store'), t = s ? s.textContent : ''; const b = s && s.querySelector('[data-ad="simUnlimited"]'); window.RIB_MONETIZE.closeStore(); return { btn: !!b, sims: /a career/.test(t), pro: /\+3 season sims every career/.test(t) } })
  ok(st.btn && st.sims && st.pro, 'ON: the store\'s free rung counts sims a career, the ad rung offers the 30-minute boost, Pro says +3 a career', st)
  await c.close()
}

console.log(JSON.stringify({ pass, fail }))
console.log('page errors:', errors.length ? errors : 'none')
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
