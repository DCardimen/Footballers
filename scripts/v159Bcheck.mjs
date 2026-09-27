// Dev check (v159 B MY PLAYS ONLY IS THE MEMBER'S) — src/07 `v159 B` (the box's gate, the member's ×1.5 season sims,
// `simRewardsV159B`), src/27 `v159 B` (the `playsOnly` placement and sheet), src/31 `v159 B` (the medals' reward table).
//
//   1. OFF (the shipping build): My Plays Only is free — a tick just works; the live field's MY PLAYS ONLY row, the
//      Settings LIVE GAME card and the profile's ⏭ SIMS tab (SEASON SIMS · THE MEDALS' REWARD) are the SAME markup as a boot with 27-monetize.js blocked;
//      the card is the free table only (no MEMBERS column, no "50% more"); playoffs force the box off.
//   2. F2P preview: the box reads "🔒 MY PLAYS ONLY · AD / MEMBER" (a tap never ticks it), the tap opens the member-perk
//      sheet, its button opens the 15 s placeholder, skip grants `playsOnly` for 30 min and the box is ticked ("30 MIN")
//      — the live filter is his snaps only from then; the fake clock moves 31 min and at the next play boundary it
//      turns off with a toast (the saved choice kept), the box locked again; the Settings row is locked and its tap
//      opens the sheet without flipping the choice; playoffs force it off; TU v159Bplays 0 frees it; the store's
//      rewarded rung has "MY PLAYS ONLY 30 MIN"; the medals section shows the MEMBERS column and "Members get 50% more".
//   3. MEMBER preview: the box is free (no lock, no tag, no sheet), playoffs force it off; season sims ×1.5 — the
//      math: each piece rounded half to even (base 1 → 2, bronze 1 → 2, silver…amethyst 2 → 3, diamond / grand 3 → 4):
//      a fresh member 2, BRONZE done 4 (next SILVER +3), all nine 2+2+6·3+2·4 = 30; TU memberSimMultV158B 2 → 40 (v158 B);
//      the medals card says "YOUR MEMBERSHIP"; the per-group table sums to 20 free / 30 member and marks completion.
//   4. no page errors. Screenshots ($SHOTS, prefix v159B-): the locked box, the member sheet, the medals reward table.
//
//   GAME_URL=http://localhost:5451/index.html node scripts/v159Bcheck.mjs
import fs from 'node:fs'
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = (...q) => url + (url.includes('?') ? '&' : '?') + ['stayStale', 'noFilmV114'].concat(q).join('&')
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const W = 400, H = 860
const SHOTS = process.env.SHOTS || ''
const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/v159B-${name}.png` }) } }
const context = await browser.newContext({ viewport: { width: W, height: H } })
await context.addInitScript(() => {
  try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
  setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove(); document.getElementById('growV132')?.remove() }, 60)
})
const M = (page, fn, arg) => page.evaluate(fn, arg)
const booted = (page, mz = true) => page.waitForFunction((mz) => !!window.__GRIDIRON_AUDIT__ && (!mz || !!window.RIB_MONETIZE) && !!window.__V159B && !!window.__V156D, mz, { timeout: 40000 })
  .then(() => page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null))
  .then(() => page.waitForTimeout(900))
const open = async (tag, { block = false, exp = null } = {}) => {
  const p = await context.newPage(); p.on('pageerror', (e) => errors.push(tag + ': ' + (e.message || e)))
  if (block) await p.route(/27-monetize\.js/, (r) => r.abort())
  await p.goto(U(), { waitUntil: 'networkidle', timeout: 60000 })
  await M(p, (exp) => { if (exp) localStorage.setItem('rib.experience.v158', exp); else localStorage.removeItem('rib.experience.v158') }, exp)
  await p.reload({ waitUntil: 'networkidle', timeout: 60000 }); await booted(p, !block)
  return p
}
// a linebacker with a regular season in hand (the v156Dcheck route), and a fresh Legacy
const seed = (p) => M(p, () => { const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true
  S.player = A.newPlayer(); S.player.name = 'Test Man'; S.player.pos = 'LB'; S.player.level = 3; A.setState(S)
  try { window.startSeasonGames() } catch (e) {} document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove()
  if (window.S.legacyV152) window.S.legacyV152.xp = 0
  window.S.view = 'season'; window.GridironStorage.save(window.S); return !!(window.S.player.weekResults && window.S.player.weekResults.length) })
// the live game for week `wk` (optionally a playoff week), the way playWeek(true) builds it — with several of his snaps
const goLive = (p, wk, imp) => M(p, async ({ wk, imp }) => { const S = window.S, t = S.player; t.currentWeek = wk
  const w = t.weekResults[wk]
  if (imp) { w.playoff = true; w.opponentV11 = Object.assign({}, w.opponentV11 || {}, { importance: imp }) }
  const mine = (x) => x.plays.filter((q) => q.involved).length
  let g = window.__simGameV2(w.perf, t.pos)
  for (const o of t.weekResults) { if (mine(g) >= 4) break; const h = window.__simGameV2(o.perf, t.pos); if (mine(h) > mine(g)) g = h }
  S._liveGame = g; S._oppName = w.opp; window.go('live')
  for (let i = 0; i < 60 && !document.querySelector('.speed-row'); i++) await new Promise((r) => setTimeout(r, 150))
  return !!document.querySelector('#myPlaysV156D') }, { wk, imp: imp || null })
const box = (p) => M(p, () => { const b = document.getElementById('myPlaysV156D'), i = document.getElementById('myPlaysInputV156D')
  return b ? { text: b.textContent.replace(/\s+/g, ' ').trim(), cls: b.className, checked: i.checked, disabled: i.disabled, pref: window.__V156D.pref(), saved: !!(window.S.settings || {}).myPlaysV156D, active: window.__V156D.active() } : null })
const rowHtml = (p) => M(p, () => { const r = document.getElementById('myPlaysRowV156D'); return r ? r.outerHTML.replace(/\s+/g, ' ') : null })
const settingsHtml = (p) => M(p, async () => { window.go('settings'); for (let i = 0; i < 25 && !document.getElementById('experienceV158B'); i++) await new Promise((r) => setTimeout(r, 120)); await new Promise((r) => setTimeout(r, 900))
  // the LIVE GAME card (the My plays only row lives there); the shell's fill height / section split is layout, not markup
  const t = document.querySelector('#screen .toggle-row[onclick*="myPlaysV156D"]'), c = t && t.closest('.card'); return c ? c.outerHTML.replace(/\s+/g, ' ').replace(/ fill-v146/g, '').replace(/ style="max-height: \d+px; overflow-y: auto;"/g, '') : null })
const medals = (p, shotName) => M(p, async () => { window.go('profile'); await new Promise((r) => setTimeout(r, 1400))
  for (let k = 0; k < 4; k++) { const t = document.querySelector('.hubv75-tab[data-sec="sims"]'); if (t && t.classList.contains('on') && k) break; t && t.click(); await new Promise((r) => setTimeout(r, 700)) }
  const c = document.getElementById('legacySimsV159B'); if (!c) return null
  let sc = c.parentElement; while (sc && !(sc.scrollHeight > sc.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement
  if (sc) sc.scrollTop += c.getBoundingClientRect().top - sc.getBoundingClientRect().top - 8; else c.scrollIntoView({ block: 'start' }); await new Promise((r) => setTimeout(r, 250)); const rc = c.getBoundingClientRect()
  const rows = [...c.querySelectorAll('.lgs9-row:not(.lgs9-hd)')].map((r) => ({ key: r.dataset.key, done: r.classList.contains('done'), free: +r.querySelector('.lgs9-free').textContent.replace('+', ''), mem: r.querySelector('.lgs9-mem') ? +r.querySelector('.lgs9-mem').textContent.replace('+', '') : null, text: r.textContent.replace(/\s+/g, ' ') }))
  const pt = document.querySelector('.lgb-pt small')
  return { html: c.outerHTML.replace(/\s+/g, ' '), text: c.textContent.replace(/\s+/g, ' '), head: c.querySelector('.lgk-head').textContent, rows, memCol: !!c.querySelector('.lgs9-hd .lgs9-mem'), visible: rc.width > 200 && rc.height > 150, fit: rc.height >= c.scrollHeight - 2 && rc.bottom <= innerHeight, tabs: [...document.querySelectorAll('.hubv75-tab')].map((t) => t.dataset.sec).join(','), tab: (c.closest('[data-hsec]') || c).dataset?.hsec || null, page: pt ? pt.textContent : '', sw: document.scrollingElement.scrollWidth <= innerWidth + 1 } })
  .then(async (r) => { if (shotName) await shot(p, shotName); return r })
const pay = (p, rank) => M(p, (rank) => { const V = window.__V152A; if (rank <= 1) { window.S.legacyV152.xp = 0; return 0 } V.pay(null, Math.max(0, V.xpAt(rank) - V.state().xp), 'check'); return window.__V156B.skips().medals }, rank)
const sum = (a, k) => a.reduce((t, r) => t + (r[k] || 0), 0)

// ============================== 1. OFF ==============================
{
  const b = await open('blocked', { block: true })
  await seed(b); await goLive(b, 0); await b.waitForTimeout(1500)
  const rb = await rowHtml(b); const sb = await settingsHtml(b); const mb = await medals(b)
  await b.close()
  const p = await open('off')
  await seed(p); await goLive(p, 0); await p.waitForTimeout(1500)
  const ra = await rowHtml(p)
  ok(!!ra && ra === rb, 'OFF: the live field\'s MY PLAYS ONLY row is the same markup as with 27 blocked', ra === rb ? '' : { a: ra, b: rb })
  const k0 = await box(p)
  ok(k0 && /^MY PLAYS ONLY$/.test(k0.text.replace(/^[✓🔒]\s*/u, '')) && !/gated/.test(k0.cls) && !/AD \/ MEMBER/.test(k0.text), 'OFF: the box is the plain v156 D box — no lock, no tag', k0)
  const sa = await settingsHtml(p)
  ok(sa === sb && /My plays only/.test(sa) && !/AD \/ MEMBER/.test(sa), 'OFF: the Settings markup is identical with the module blocked', sa === sb ? '' : (() => { let i = 0; while (sa[i] === sb[i]) i++; return { a: sa.slice(i - 80, i + 80), b: sb.slice(i - 80, i + 80) } })())
  await goLive(p, 0); await p.waitForTimeout(1500)
  await p.click('#myPlaysV156D'); await p.waitForTimeout(300)
  const k1 = await box(p), sheet = await M(p, () => !!document.getElementById('mz149Sheet'))
  ok(k1.pref && k1.checked && k1.saved && k1.active && !sheet, 'OFF: My Plays Only is free — a tick just works (no sheet)', k1)
  const ma = await medals(p, 'medals-off')
  ok(ma && mb && ma.html === mb.html, 'OFF: the medals\' SEASON SIMS card is the same markup with 27 blocked', ma && mb ? (ma.html === mb.html ? '' : { a: ma.html.slice(0, 200), b: mb.html.slice(0, 200) }) : { ma: !!ma, mb: !!mb })
  ok(ma && !ma.memCol && !/MEMBER|50%/.test(ma.text) && ma.rows.length === 10 && sum(ma.rows, 'free') === 20 && ma.rows.every((r) => r.mem === null), 'OFF: the card is the free table alone — 10 rows (every career + nine groups) that add to 20, no member column', ma && { rows: ma.rows.map((r) => r.free).join(','), text: ma.text.slice(0, 120) })
  ok(ma && /COMPLETE SILVER/.test(ma.text) && ma.rows.find((r) => r.key === 'silver').free === 2 && ma.rows.find((r) => r.key === 'bronze').free === 1 && ma.rows.find((r) => r.key === 'grand').free === 3 && /1 A CAREER/.test(ma.head), 'OFF: each colour\'s reward is named ("COMPLETE SILVER" +2, bronze +1, grand +3) and the allowance in the head (1 a career)', ma && ma.head)
  ok(ma && ma.visible && ma.fit && ma.tabs === 'card,case,book,sims' && ma.sw && /⏭/.test(ma.page), 'OFF: the card has its own ⏭ SIMS tab (card, case, book, sims) and shows whole, no sideways scroll; the book\'s page line names its reward (⏭)', ma && { vis: ma.visible, fit: ma.fit, tabs: ma.tabs, page: ma.page })
  // completion follows the medals
  await pay(p, 130)
  const mc = await medals(p)
  ok(mc && mc.rows.filter((r) => r.done && r.key !== 'start').map((r) => r.key).join(',') === 'bronze,silver' && /2 of 9/.test(mc.text) && /4 A CAREER/.test(mc.head), 'OFF: completion follows the medals — rank 130: BRONZE and SILVER done, 2 of 9, 4 a career', mc && { done: mc.rows.filter((r) => r.done).map((r) => r.key), head: mc.head })
  // playoffs force it off
  await goLive(p, 1, 'playoff'); await p.waitForTimeout(1200)
  const po = await box(p)
  ok(po && po.disabled && !po.checked && !po.active && /locked/.test(po.cls) && po.saved, 'OFF: playoffs force it off (disabled, the saved choice kept)', po)
  await p.close()
}

// ============================== 2. F2P preview ==============================
{
  const p = await open('f2p', { exp: 'f2p' })
  const pv = await M(p, () => ({ on: RIB_MONETIZE.enabled, pv: RIB_MONETIZE.preview, plays: RIB_MONETIZE.has('playsOnly'), gate: window.__V159B.gateOn(), pl: RIB_MONETIZE.config.placements.playsOnly && RIB_MONETIZE.config.placements.playsOnly.label }))
  ok(pv.on && pv.pv === 'f2p' && !pv.plays && pv.gate && pv.pl === 'MY PLAYS ONLY FOR 30 MIN', 'F2P: the store is ON (preview), no playsOnly held, the gate is on, the placement is "MY PLAYS ONLY FOR 30 MIN"', pv)
  await seed(p)
  await M(p, () => { window.S.settings.myPlaysV156D = false; window.GridironStorage.save(window.S) })
  await goLive(p, 0); await p.waitForTimeout(2500)
  const k0 = await box(p)
  ok(k0 && /🔒/.test(k0.text) && /MY PLAYS ONLY · AD \/ MEMBER/.test(k0.text) && /gated-v159b/.test(k0.cls) && !k0.checked && !k0.pref, 'F2P: the box reads "🔒 MY PLAYS ONLY · AD / MEMBER", unticked', k0)
  await p.waitForFunction(() => { const b = document.getElementById('myPlaysV156D'); if (!b) return false; const r = b.getBoundingClientRect(), el = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2); return !!(el && el.closest && el.closest('#myPlaysV156D')) }, null, { timeout: 20000 }).catch(() => null)   // the live game's loader lifts
  await shot(p, 'locked-box')
  // the saved choice alone does not turn it on
  const pre = await M(p, () => { window.S.settings.myPlaysV156D = true; const r = { pref: window.__V156D.pref(), active: window.__V156D.active() }; window.S.settings.myPlaysV156D = false; return r })
  ok(!pre.pref && !pre.active, 'F2P: a saved tick without the perk does nothing (the filter is the side of the ball)', pre)
  await p.click('#myPlaysV156D'); await p.waitForTimeout(400)
  const sh = await M(p, () => { const s = document.getElementById('mz149Sheet'); return s ? { text: s.textContent.replace(/\s+/g, ' '), yes: s.querySelector('[data-yes]').textContent } : null })
  const k1 = await box(p)
  ok(sh && /MY PLAYS ONLY IS A MEMBER PERK/.test(sh.text) && /MY PLAYS ONLY 30 MIN/.test(sh.yes) && !k1.pref && !k1.saved && !k1.checked, 'F2P: the tap opens the member-perk sheet ("▶ WATCH · MY PLAYS ONLY 30 MIN") and does not tick the box', { sh, k1 })
  await shot(p, 'member-sheet')
  await p.click('#mz149Sheet [data-yes]')
  const ad = await p.waitForSelector('#mz149Ad', { timeout: 5000 }).then(() => M(p, () => document.getElementById('mz149Ad').textContent.replace(/\s+/g, ' '))).catch(() => null)
  ok(ad && /An ad will be placed here/.test(ad) && /MY PLAYS ONLY FOR 30 MIN/.test(ad), 'F2P: the sheet opens the 15 s placeholder, naming the reward', ad && ad.slice(0, 160))
  await p.click('#mz149Ad [data-skip]')
  await p.waitForFunction(() => window.__V159B.ok() && !document.getElementById('mz149Ad'), null, { timeout: 8000 }).catch(() => null); await p.waitForTimeout(500)
  const k2 = await box(p), min = await M(p, () => Math.round((RIB_MONETIZE.until('playsOnly') - RIB_MONETIZE.dev.now()) / 60e3))
  ok(k2.pref && k2.checked && k2.saved && k2.active && /30 MIN/.test(k2.text) && !/gated/.test(k2.cls) && min === 30, 'F2P: after the reward the box is ticked for 30 minutes ("30 MIN")', { k2, min })
  // the filter: from the next play only his snaps are drawn
  const at = await M(p, () => { const l = window.__V156D.log(); return l ? l.length : 0 })
  await p.waitForFunction((at) => { const l = window.__V156D.log(); return l && l.length > at + 3 }, at, { timeout: 30000 }).catch(() => null)
  const drawn = await M(p, (at) => { const l = window.__V156D.log() || [], g = window.S._liveGame; const after = l.slice(at + 1); return { n: after.length, mine: after.every((e) => e.mine), wrong: after.filter((e) => !e.skip && !(g.plays[e.i] || {}).involved).length } }, at)
  ok(drawn.n > 0 && drawn.mine && drawn.wrong === 0, 'F2P: while it runs, the live game draws only his snaps', drawn)
  // 31 minutes later: off at the next play boundary, with a toast; the saved choice is kept
  const at2 = await M(p, () => { window.__toasts159 = []; const T = window.showToast; if (!window.__tw159 && typeof T === 'function') { window.__tw159 = 1; const o = T; window.showToast = function (m) { window.__toasts159.push(String(m)); return o.apply(this, arguments) } }
    const obs = new MutationObserver(() => { const t = document.body.textContent; if (/30 minutes are up/.test(t)) window.__seen159 = 1 }); obs.observe(document.body, { childList: true, subtree: true, characterData: true })
    RIB_MONETIZE.dev.advance(31 * 60e3); const l = window.__V156D.log(); return l ? l.length : 0 })
  await p.waitForFunction((at) => { const l = window.__V156D.log(); return l && l.length > at + 2 }, at2, { timeout: 30000 }).catch(() => null)
  await p.waitForTimeout(300)
  const ex = await M(p, (at) => { const l = window.__V156D.log() || []; return { expired: window.__V159B.expired, seen: !!window.__seen159, after: l.slice(at).map((e) => e.mine), ok: window.__V159B.ok(), pref: window.__V156D.pref(), saved: !!window.S.settings.myPlaysV156D } }, at2)
  const k3 = await box(p)
  ok(ex.expired === 1 && ex.seen && !ex.ok && !ex.pref && ex.saved && ex.after.length && ex.after.every((m) => !m), 'F2P: 31 minutes later it turns off at the next play boundary, with a toast (the saved choice kept)', ex)
  ok(k3 && /🔒/.test(k3.text) && /AD \/ MEMBER/.test(k3.text) && !k3.checked, 'F2P: the box is locked again', k3)
  // Settings: the row is locked and its tap opens the sheet
  const st = await M(p, async () => { window.go('settings'); await new Promise((r) => setTimeout(r, 900)); const r = document.getElementById('myPlaysSettingV159B'); const before = window.S.settings.myPlaysV156D
    window.toggleSetting('myPlaysV156D'); await new Promise((r) => setTimeout(r, 300)); const s = document.getElementById('mz149Sheet'); const o = { row: r ? r.textContent.replace(/\s+/g, ' ') : null, sheet: !!s, same: window.S.settings.myPlaysV156D === before }; s && s.querySelector('[data-no]').click(); return o })
  ok(st.row && /🔒 My plays only · AD \/ MEMBER/.test(st.row) && st.sheet && st.same, 'F2P: the Settings row is locked ("🔒 My plays only · AD / MEMBER"), its tap opens the sheet and flips nothing', st)
  // the store: the rewarded rung offers it; the free rung explains it
  const so = await M(p, async () => { RIB_MONETIZE.openStore(); await new Promise((r) => setTimeout(r, 400)); const s = document.getElementById('mz149Store'), b = s && s.querySelector('[data-ad="playsOnly"]'), t = s ? s.textContent : ''; const club = RIB_MONETIZE.config.products.find((x) => x.membership); RIB_MONETIZE.closeStore()
    return { btn: b ? b.textContent : '', free: /My Plays Only \(only your snaps\): a member perk, or 30 min for an ad/.test(t), side: /Your side of the ball — free/.test(t), club: club.blurb.join(' | ') } })
  ok(/MY PLAYS ONLY 30 MIN/.test(so.btn) && so.free && so.side && /My Plays Only/.test(so.club) && /50% more season sims/.test(so.club), 'F2P: the store offers "▶ WATCH · MY PLAYS ONLY 30 MIN", the free rung says it is a member perk (your side of the ball free), the Club lists it and 50% more season sims', so)
  // playoffs force it off, even with the perk
  await M(p, () => RIB_MONETIZE.grant('playsOnly', { minutes: 30, source: 'check' }))
  await goLive(p, 1, 'playoff'); await p.waitForTimeout(1200)
  const po = await box(p)
  ok(po && po.disabled && !po.checked && !po.active && /locked/.test(po.cls) && !/gated/.test(po.cls), 'F2P: playoffs force it off for everyone', po)
  // the kill switch frees it
  const ks = await M(p, () => { RIB_MONETIZE.revoke('playsOnly'); window.RIB_TUNE = window.RIB_TUNE || {}; window.RIB_TUNE.v159Bplays = 0; const r = { ok: window.__V159B.ok(), gate: window.__V159B.gate() }; delete window.RIB_TUNE.v159Bplays; r.back = window.__V159B.ok(); return r })
  ok(ks.ok && ks.gate === null && !ks.back, 'F2P: TU v159Bplays 0 makes it free again (the v158 B rule)', ks)
  // season sims are the medals' for a free player; the medals section shows the member column
  const s0 = await M(p, () => { const s = window.__V156B.skips(); return { mult: s.mult, allowed: s.allowed } })
  ok(s0.mult === 1 && s0.allowed === 1, 'F2P: a free player\'s season sims are the medals\' (1 on a fresh account)', s0)
  const mf = await medals(p, 'medals-f2p')
  ok(mf && mf.memCol && /MEMBERS GET 50% MORE/.test(mf.text) && sum(mf.rows, 'free') === 20 && sum(mf.rows, 'mem') === 30 && mf.rows.map((r) => r.mem).join(',') === '2,2,3,3,3,3,3,3,4,4', 'F2P: the medals section adds the MEMBERS column (+2 +2 +3×6 +4 +4 = 30) and "Members get 50% more"', mf && { mem: mf.rows.map((r) => r.mem).join(','), text: mf.text.slice(0, 200) })
  const sc = await M(p, () => { const c = window.RIB_LEGACY.shareCard(130); const t = c ? c.textContent.replace(/\s+/g, ' ') : ''; c && c.remove(); return t })
  ok(/⏭ COMPLETE [A-Z]+ → \+2 SEASON SIMS A CAREER · MEMBERS \+3/.test(sc), 'F2P: the medal card names its colour\'s reward ("COMPLETE GOLD → +2 … · MEMBERS +3")', sc.slice(0, 200))
  await p.close()
}

// ============================== 3. MEMBER preview ==============================
{
  const p = await open('member', { exp: 'member' })
  const pv = await M(p, () => ({ pv: RIB_MONETIZE.preview, member: RIB_MONETIZE.has('member'), plays: RIB_MONETIZE.until('playsOnly') === Infinity }))
  ok(pv.pv === 'member' && pv.member && pv.plays, 'MEMBER: member held — My Plays Only for good (member ⇒ playsOnly)', pv)
  await seed(p)
  await M(p, () => { window.S.settings.myPlaysV156D = false; window.GridironStorage.save(window.S) })
  await goLive(p, 0); await p.waitForTimeout(2500)
  const k0 = await box(p)
  ok(k0 && k0.text.replace(/^[✓]\s*/u, '') === 'MY PLAYS ONLY' && !/gated/.test(k0.cls), 'MEMBER: the box is the plain box — no lock, no tag', k0)
  await p.click('#myPlaysV156D'); await p.waitForTimeout(300)
  const k1 = await box(p), sheet = await M(p, () => !!document.getElementById('mz149Sheet'))
  ok(k1.pref && k1.checked && k1.active && !sheet, 'MEMBER: a tick just works, always', k1)
  await goLive(p, 1, 'championship'); await p.waitForTimeout(1200)
  const po = await box(p)
  ok(po && po.disabled && !po.checked && !po.active, 'MEMBER: the championship forces it off too', po)
  // season sims ×1.5, rounded half to even
  const ss = await M(p, () => { const V = window.__V159B, out = {}; out.rate = V.rate(); out.scale = [1, 2, 3, 20].map((n) => V.scale(n, 1.5)); window.S.legacyV152.xp = 0
    const a = window.__V156B.skips(); out.fresh = a.allowed; out.mult = a.mult; out.cap = a.cap; return out })
  ok(ss.rate === 1.5 && ss.mult === 1.5 && ss.scale.join(',') === '2,3,4,30' && ss.fresh === 2 && ss.cap === 30, 'MEMBER: ×1.5 (TU memberSimMultV158B 1.5), half-to-even pieces 1→2, 2→3, 3→4, cap 20→30; a fresh member has 2', ss)
  await pay(p, 59)
  const sb = await M(p, () => { const s = window.__V156B.skips(); return { allowed: s.allowed, next: s.next && s.next.bonus, nextName: s.next && s.next.name } })
  ok(sb.allowed === 4 && sb.next === 3 && sb.nextName === 'SILVER', 'MEMBER: BRONZE done → 4 (2 + 2); the next group (SILVER) +3', sb)
  const mm = await medals(p, 'medals-member')
  ok(mm && mm.memCol && /YOUR MEMBERSHIP: 50% MORE — 4 A CAREER/.test(mm.text) && /4 A CAREER/.test(mm.head) && mm.rows.filter((r) => r.done).map((r) => r.key).join(',') === 'start,bronze', 'MEMBER: the medals card: "YOUR MEMBERSHIP: 50% MORE", 4 a career, BRONZE complete', mm && { head: mm.head, done: mm.rows.filter((r) => r.done).map((r) => r.key) })
  await pay(p, 500)
  const sa = await M(p, () => { const out = { all: window.__V156B.skips().allowed, r: window.__V159B.rewards() }; window.RIB_TUNE = window.RIB_TUNE || {}; window.RIB_TUNE.memberSimMultV158B = 2; out.x2 = window.__V156B.skips().allowed; out.x2fresh = null; delete window.RIB_TUNE.memberSimMultV158B
    return { all: out.all, x2: out.x2, freeAll: out.r.freeAll, memberAll: out.r.memberAll, memberNow: out.r.memberNow, done: out.r.groupsDone } })
  ok(sa.all === 30 && sa.memberNow === 30 && sa.memberAll === 30 && sa.freeAll === 20 && sa.done === 9, 'MEMBER: all nine groups → 30 (2 + 2 + 6×3 + 2×4), free 20', sa)
  ok(sa.x2 === 40, 'MEMBER: TU memberSimMultV158B 2 restores v158 B\'s doubling (40)', sa.x2)
  await M(p, () => { window.S.legacyV152.xp = 0; localStorage.removeItem('rib.experience.v158'); Object.keys(localStorage).filter((k) => /^rib\.monetize\.preview\.v158\./.test(k)).forEach((k) => localStorage.removeItem(k)) })
  await p.close()
}

ok(!errors.length, 'no page errors', errors.slice(0, 5))
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
