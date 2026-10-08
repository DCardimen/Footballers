// Dev check: v193 W (src/05-field-renderer.js, src/07-career-app.js).
//   SLOW MOTION — the live HUD has no 🐢 slider; at 4× a forced big play drops the play clock to the setting's rate
//     (subtle: 1×) for under ~1.5 s of WALL time and returns to 4× (the window is a ceiling, never a factor — the applied
//     rate is never below the slower of it and the v37/v102 slow-mo); Settings Off does nothing; 1× under Subtle is
//     untouched, Dramatic slows 1× to ½×; Settings › LIVE GAME has the "Big-play slow motion" row (Subtle by default,
//     Off stores `bigSlowV193W: "off"`)
//   THE RECAP — the post-game card's PLAY-BY-PLAY RECAP is folded by default under the YOUR GAME tiles and the reel,
//     opens on a tap and is remembered (localStorage `rib.recapOpen.v193`); the Quick Play card's fold reads it
//   INJURIES — a knock taken into a WATCHED game that became an injury in it opens the pop-up after the post-game card
//     (never over it), naming the snap it happened on; a forced injury in a SIMMED week opens it once on the season
//     screen with HOW LONG matching the real weeks (the games he then sits, the week he is back), the heal opens the
//     "cleared to play" pop-up, two injuries in a quick-simmed run show in order (hurt, healed, hurt, healed), nothing
//     shows over the Quick Play card; `seenV193W`; no page errors.
//   Screens: scripts/_v193W_{card,recap,injury,heal,settings}.png
//   node scripts/v193Wcheck.mjs        (GAME_URL=http://localhost:5173/)
import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'
import { waitLive } from './lib/live.mjs'
const browser = await chromium.launch({ executablePath: CHROME })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
// no random injuries: the plan multiplier is 0, so only the check's forced ones land
await page.addInitScript(() => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { dayNightV144: 0, wxV144: 0, speedGateV151A: 0, v172jumbo: 0, injPlanMin: 0, injPlanMax: 0, v193WinjPrompt: 1 })
  try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch (e) {}
  setInterval(() => { document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(1200)
await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && !!window.__V193W, null, { timeout: 60000 })
const clickText = async (t) => {
  await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    const el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t)); if (el) { el.scrollIntoView({ block: 'center' }); el.click() } }, { t, visSrc: vis }).catch(() => {})
}
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING']) { await clickText(t); await page.waitForTimeout(900) }
// a knock taken into the watched game: it plays, and turns into an injury IN the game (the week's condition update)
await page.evaluate(() => window.__V193W.force({ knock: true, name: 'Ankle sprain' }))
for (const t of ['PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) { await clickText(t); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900) }
const live = await waitLive(page, 90000)
ok(live, 'the live field is up')
await page.waitForFunction(() => window.__gridironScene && window.__gridironScene.markers.length >= 20, null, { timeout: 60000 }).catch(() => {})

// ---- the HUD: no turtle
const hud = await page.evaluate(() => ({ dial: !!document.querySelector('.slow-dial-v164f'), turtle: [...document.querySelectorAll('.speed-row, .slow-dial-v164f')].some(e => /🐢/.test(e.textContent || '')), range: !!document.querySelector('#screen input[type=range]'), speeds: [...document.querySelectorAll('.speed-btn[data-spd]')].map(b => b.dataset.spd) }))
ok(!hud.dial && !hud.turtle && !hud.range && hud.speeds.includes('4'), 'the live HUD has no 🐢 slow-motion slider (the speed buttons stay)', hud)

// ---- slow motion at 4×: forced, measured in wall time on the frames the play clock advances
const waitPlay = () => page.waitForFunction(() => { const sc = window.__gridironScene; return !!(sc && sc.play && !sc.play.done && sc.play.t > (sc.play.delay || 0) + 50) }, null, { timeout: 30000 }).then(() => true).catch(() => false)
await page.evaluate(() => window.setSpeed(4))
await waitPlay()
const slow = await page.evaluate(async () => {
  const sc = window.__gridironScene, B = window.__V193W_SLOW = window.__V193W_SLOW || { fired: 0, skipped: 0, samples: [], log: [] }
  sc._bigSlowV193W = null; B.samples = []; B.rec = true
  const fired = sc.bigSlowV193W('touchdown', { force: true }), W = Object.assign({}, sc._bigSlowV193W || {})
  await new Promise(r => setTimeout(r, 2600)); B.rec = false
  const S = B.samples.slice(), t0 = W.at || 0
  const slowS = S.filter(s => s.w < 3.9), lo = Math.min(...S.map(s => s.r)), wlo = Math.min(...S.map(s => s.w))
  const span = slowS.length ? slowS[slowS.length - 1].at - slowS[0].at : 0
  const after = S.filter(s => s.at > (W.until || 0) + 30)
  const floorOK = S.every(s => s.r >= Math.min(s.w, s.ch) * 0.2 - 1e-6 && s.r > 0)   // never a freeze: the applied rate stays live
  return { fired, mode: W.mode, target: W.target, ms: Math.round((W.until || 0) - t0), n: S.length, nSlow: slowS.length, span, lo: +lo.toFixed(3), wlo: +wlo.toFixed(3), afterN: after.length, afterW: after.length ? Math.min(...after.map(s => s.w)) : null, floorOK }
})
console.log('slow:', JSON.stringify(slow))
ok(slow.fired && slow.mode === 'subtle' && slow.target === 1, 'at 4× a big play opens the Subtle window (1×) by default', slow)
ok(slow.nSlow >= 5 && slow.span > 300 && slow.span < 1500 && slow.ms <= 1500, 'the play clock runs slow for under 1.5 s of wall time', { span: slow.span, ms: slow.ms, nSlow: slow.nSlow })
ok(slow.wlo <= 1.02 && slow.lo <= 1.02, 'it drops to 1× (the window\'s ceiling, and the rate applied)', { wlo: slow.wlo, lo: slow.lo })
ok(slow.afterN === 0 || slow.afterW >= 3.99, 'then back to 4×', { afterN: slow.afterN, afterW: slow.afterW })
ok(slow.floorOK, 'it never stacks into a freeze (the applied rate stays live)')
// the setting and the speeds
const modes = await page.evaluate(async () => {
  const sc = window.__gridironScene, st = window.__getGridironState(); st.settings = st.settings || {}
  const out = {}
  st.settings.bigSlowV193W = 'off'; sc._bigSlowV193W = null; out.off = sc.bigSlowV193W('touchdown', { force: true })
  st.settings.bigSlowV193W = 'subtle'; window.setSpeed(1); sc._bigSlowV193W = null; out.sub1x = sc.bigSlowV193W('touchdown', { force: true })
  st.settings.bigSlowV193W = 'dramatic'; sc._bigSlowV193W = null; out.dram1x = sc.bigSlowV193W('touchdown', { force: true }); out.dramTarget = sc._bigSlowV193W && sc._bigSlowV193W.target; out.dramMs = sc._bigSlowV193W && Math.round(sc._bigSlowV193W.until - sc._bigSlowV193W.at)
  sc._bigSlowV193W = null; window.setSpeed(4); out.dram4 = sc.bigSlowV193W('touchdown', { force: true }); out.again = sc.bigSlowV193W('sack', { force: true })   // one at a time, never extended
  sc._bigSlowV193W = null; delete st.settings.bigSlowV193W
  return out
})
console.log('modes:', JSON.stringify(modes))
ok(modes.off === false, 'Settings Off: no slow motion at 4×', modes)
ok(modes.sub1x === false, 'Subtle leaves 1× play unchanged', modes)
ok(modes.dram1x === true && modes.dramTarget === 0.5 && modes.dram4 === true && modes.again === false, 'Dramatic slows 1× to ½× too; a second moment never extends an open window', modes)
// let the game play at 4× for a few plays: the plan opens windows on its own on the big ones (informational)
await page.waitForTimeout(6000)
const nat = await page.evaluate(() => { const B = window.__V193W_SLOW; return { fired: B.fired, kinds: (B.log || []).map(l => l.kind) } })
console.log('INFO natural windows at 4×:', JSON.stringify(nat))

// ---- the post-game card: the recap is folded
await page.evaluate(() => { try { localStorage.removeItem('rib.recapOpen.v193') } catch (e) {} ; window.skipLive && window.skipLive() })
await page.waitForFunction(() => !!document.getElementById('pgOverlayV13'), null, { timeout: 60000 }).catch(() => {})
await page.waitForTimeout(1500)
const card = await page.evaluate(() => {
  const o = document.getElementById('pgOverlayV13'); if (!o) return null
  const f = o.querySelector('.recap-v193w'), body = f && f.querySelector('.recap-body-v193w'), hero = o.querySelector('#pgHeroV186'), reel = o.querySelector('#reelV178')
  return { fold: !!f, open: f && f.classList.contains('open'), bodyH: body ? body.getBoundingClientRect().height : -1, head: f && f.querySelector('.recap-head-v193w').innerText.replace(/\s+/g, ' ').trim(), hero: !!hero && hero.getBoundingClientRect().height > 0, reel: !reel || reel.getBoundingClientRect().height > 0, seasonInside: !!(f && f.querySelector('.fullbox')), pbp: f ? f.querySelectorAll('.pbp-row-v193w').length : 0, dlg: !!document.querySelector('#ribDlgV149 .inj-pop-v193w') }
})
console.log('card:', JSON.stringify(card)); await page.screenshot({ path: 'scripts/_v193W_card.png' }).catch(() => {})
ok(card && card.fold && !card.open && card.bodyH === 0 && /PLAY-BY-PLAY RECAP/.test(card.head || ''), 'the post-game recap is folded by default behind ▸ PLAY-BY-PLAY RECAP', card)
ok(card && card.hero && card.reel && card.seasonInside, 'the YOUR GAME tiles and the reel stay up; the season / game box is inside the fold', card)
const tap = await page.evaluate(async () => { const o = document.getElementById('pgOverlayV13'), f = o.querySelector('.recap-v193w'); f.querySelector('.recap-head-v193w').click(); await new Promise(r => setTimeout(r, 120))
  return { open: f.classList.contains('open'), h: f.querySelector('.recap-body-v193w').getBoundingClientRect().height, ls: localStorage.getItem('rib.recapOpen.v193'), rows: f.querySelectorAll('.pbp-row-v193w').length } })
await page.evaluate(() => document.querySelector('#pgOverlayV13 .recap-v193w').scrollIntoView({ block: 'start' })); await page.screenshot({ path: 'scripts/_v193W_recap.png' }).catch(() => {})
ok(tap.open && tap.h > 40 && tap.ls === '1', 'a tap opens it (the play-by-play and the box) and the device remembers', tap)
ok(card && !card.dlg, 'no injury pop-up over the post-game card', card)
await page.waitForTimeout(2000)
ok(!(await page.evaluate(() => !!document.querySelector('#ribDlgV149 .inj-pop-v193w'))), 'still none while the card is up')

// ---- the watched game's injury: after the card
const pre = await page.evaluate(() => ({ q: window.__V193W.queue.map(q => q.k + ':' + q.name + ':' + q.src) }))
await page.evaluate(() => window.__pgContinueV13 && window.__pgContinueV13())
// the season's growth decision (v42) may come up first — a decision on screen: the pop-up waits for it, so play it
for (let k = 0, t0 = Date.now(); Date.now() - t0 < 45000; k++) {
  const st = await page.evaluate(() => { if (document.querySelector('#ribDlgV149 .inj-pop-v193w')) return 'pop'
    const w = document.getElementById('growthV42'); if (w) { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none' && g.getBoundingClientRect().width > 0) g.click(); return 'wheel' }
    if (document.getElementById('pregameV1513') && window.continuePregameV1513) { window.continuePregameV1513(); return 'pregame' }
    return 'wait' })
  if (st === 'pop') break
  await page.waitForTimeout(400)
}
const L = await page.evaluate(() => {
  const d = document.querySelector('#ribDlgV149 .inj-pop-v193w'); if (!d) return { none: true, q: window.__V193W.queue, blocked: window.__V193W.blocked(), view: window.__getGridironState().view, other: (document.getElementById('ribDlgV149') || {}).innerText, ov: [...document.querySelectorAll('.decision-overlay,.gameplan-overlay,#pregameV1513,#growthV42,#growV132,.life-event-overlay-v12,#personaV13')].map(e => e.id + '.' + e.className) }
  const p = window.__getGridironState().player, c = p.conditionV11, inj = c && c.injury, sit = window.__mustSitV18(p)
  return { name: d.querySelector('.inj-name-v193w').textContent, what: d.querySelector('.inj-what-v193w').textContent, how: d.querySelector('.inj-how-v193w').textContent, out: +d.dataset.out, id: d.dataset.id, cur: inj && { id: inj.idV193W, name: inj.name, wr: inj.weeksRemaining, sev: inj.severity }, sit, view: window.__getGridironState().view, means: d.querySelector('.inj-means-v193w').textContent }
})
console.log('live injury:', JSON.stringify(pre), JSON.stringify(L)); await page.screenshot({ path: 'scripts/_v193W_injury.png' }).catch(() => {})
ok(!L.none && L.cur && L.id === L.cur.id && L.name === L.cur.name, 'the knock that became an injury in the watched game opens the pop-up after the card', L)
ok(!L.none && /(1st|2nd|3rd|4th) quarter|overtime|in the game/.test(L.what), 'WHAT HAPPENED names the snap (quarter and clock) — or the game', L.what)
ok(!L.none && L.cur && (L.sit ? new RegExp('Out ' + (L.cur.wr) + ' game').test(L.how) : L.cur.wr > 0 ? new RegExp('next ' + L.cur.wr + ' game').test(L.how) : /through it/.test(L.how)), 'HOW LONG is the injury\'s own weeks', { how: L.how, cur: L.cur, sit: L.sit })
ok(!L.none && /SNAPS/.test(L.means) && /attribute/.test(L.means) && /RE-INJURY/.test(L.means) && /Miracle Hands/.test(L.means) && /Trainer's Room/.test(L.means), 'WHAT IT MEANS: snaps, attributes, re-injury, what shortens it', L.means)
await page.evaluate(() => { const b = document.querySelector('#ribDlgV149 button.primary-v149'); b && b.click() })
await page.waitForTimeout(800)
const seenL = await page.evaluate(() => { const p = window.__getGridironState().player, inj = p.conditionV11 && p.conditionV11.injury; return { seen: inj ? inj.seenV193W : null, shown: window.__V193W.shown.length } })
ok(seenL.seen === true || seenL.seen === null, 'the injury is marked seen', seenL)

// ---- the simmed path: a fresh career, the injuries forced into quick-simmed weeks
const seed = () => page.evaluate(() => {
  document.getElementById('ribDlgV149') && window.ribDialog.close()
  document.querySelectorAll('#growthV42,#pregameV1513,.decision-overlay,#simCardV178').forEach(x => x.remove())   // the last career's screens
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; S.tree = S.tree || {}; A.setState(S)
  S.player = A.newPlayer(); const p = S.player; p.name = 'Sim Hurt'; p.pos = 'RB'; p.age = 14; p.originV11 = 'walk-on'; p._wonShown = true
  p.level = 3; p.training = 'balanced'; p.points = 0; p.traits = []; A.startSeasonGames(); window.go('season'); return p.weekResults.length })
const simWeek = (force) => page.evaluate((force) => { const p = window.__getGridironState().player, i = p.weekResults.findIndex(w => !w.played); if (i < 0) return -1; if (force) window.__V193W.force(force); window.__silentWeekV85(p, p.weekResults[i]); return i }, force)
const readDlg = () => page.evaluate(() => { const r = document.getElementById('ribDlgV149'); if (!r) return null; const h = r.querySelector('.inj-pop-v193w'), g = r.querySelector('.inj-heal-v193w')
  return { kind: h ? 'hurt' : g ? 'heal' : 'other', title: (r.querySelector('h3') || {}).textContent, name: h ? h.querySelector('.inj-name-v193w').textContent : null, how: h ? h.querySelector('.inj-how-v193w').textContent : null, out: h ? +h.dataset.out : null, back: +(h || g || { dataset: {} }).dataset.backWi, txt: (g || h || r).innerText.replace(/\s+/g, ' ').slice(0, 200) } })
const waitDlg = async (ms = 6000) => { await page.waitForFunction(() => !!document.querySelector('#ribDlgV149 .inj-pop-v193w, #ribDlgV149 .inj-heal-v193w'), null, { timeout: ms }).catch(() => {}); return readDlg() }
const okDlg = () => page.evaluate(() => { const b = document.querySelector('#ribDlgV149 button.primary-v149'); b && b.click() })
await page.waitForTimeout(600)
await seed()
await simWeek(null)
const wi = await simWeek({ name: 'MCL sprain', weeks: 2, severity: 2 })
await page.evaluate(() => window.go('season'))
const d1 = await waitDlg()
console.log('sim injury:', JSON.stringify(d1))
ok(d1 && d1.kind === 'hurt' && d1.name === 'MCL sprain' && d1.out === 2 && /Out 2 games/.test(d1.how) && d1.back === wi + 2, 'a simmed week\'s injury opens the pop-up on the season screen: Out 2 games, back two weeks on', d1)
const lab = await page.evaluate((b) => { const p = window.__getGridironState().player, w = p.weekResults[b]; return 'Week ' + (p.weekResults.filter(x => !x.playoff).indexOf(w) + 1) }, d1 ? d1.back : 0)
ok(d1 && d1.how.includes('back for ' + lab), 'and names the week he is back for', { how: d1 && d1.how, lab })
await okDlg(); await page.waitForTimeout(1800)
ok(!(await readDlg()), 'it shows once (a re-render does not bring it back)')
await page.evaluate(() => window.go('season')); await page.waitForTimeout(1800)
ok(!(await readDlg()), 'still once after another screen')
const w2 = await simWeek(null)
await page.evaluate(() => window.go('season'))
const d2 = await waitDlg()
console.log('heal:', JSON.stringify(d2)); await page.screenshot({ path: 'scripts/_v193W_heal.png' }).catch(() => {})
ok(d2 && d2.kind === 'heal' && /CLEARED TO PLAY/.test(d2.txt) && d2.back === wi + 2, 'the heal opens the "cleared to play" pop-up, back for the same week', d2)
await okDlg(); await page.waitForTimeout(500)
const w3 = await simWeek(null)
const real = await page.evaluate(({ wi, w3 }) => { const p = window.__getGridironState().player; return { sat: p.weekResults.filter(w => w.satOut && w.injName === 'MCL sprain').length, back: !p.weekResults[w3].satOut, w3 } }, { wi, w3 })
ok(real.sat === 2 && real.back && real.w3 === wi + 2, 'HOW LONG was the real layoff: he sat 2 games and played the week it named', real)
// two injuries in one quick-simmed run: they queue, in order
await page.evaluate(() => { document.getElementById('ribDlgV149') && window.ribDialog.close() })
await simWeek({ name: 'Turf toe', weeks: 1, severity: 2 })
await simWeek({ name: 'Concussion', weeks: 2, severity: 2 })
await simWeek(null)
const q2 = await page.evaluate(() => window.__V193W.queue.map(q => q.k + ':' + q.name))
await page.evaluate(() => window.go('season'))
const seq = []
for (let k = 0; k < 5; k++) { const d = await waitDlg(5000); if (!d) break; seq.push(d.kind + ':' + (d.name || (/(Turf toe|Concussion)/.exec(d.txt) || [])[1])); if (d.kind === 'hurt') seq.push('out' + d.out); await okDlg(); await page.waitForTimeout(400) }
console.log('queue:', JSON.stringify(q2), 'shown:', JSON.stringify(seq))
ok(JSON.stringify(seq) === JSON.stringify(['hurt:Turf toe', 'out1', 'heal:Turf toe', 'hurt:Concussion', 'out2', 'heal:Concussion']), 'a quick-simmed run with two injuries shows both, in order, each with its own weeks', seq)
// the Quick Play card: its fold reads the device's choice; an injury waits for the card to close
await page.evaluate(() => { window.go('season') }); await page.waitForTimeout(600)
await page.evaluate(() => window.__V193W.force({ knock: true, name: 'Bruised ribs' }))
const qp = await page.evaluate(async () => {
  const b = [...document.querySelectorAll('#dock button')].find((x) => /Quick Play/.test(x.textContent)); if (!b) return { btn: false }
  b.click(); for (let k = 0; k < 80 && !document.getElementById('simCardV178'); k++) await new Promise(r => setTimeout(r, 100))
  const c = document.getElementById('simCardV178'); if (!c) return { btn: true, card: false }
  await new Promise(r => setTimeout(r, 2200))
  const f = c.querySelector('.recap-v193w')
  return { btn: true, card: true, fold: !!f, open: !!(f && f.classList.contains('open')), dlg: !!document.querySelector('#ribDlgV149 .inj-pop-v193w'), q: window.__V193W.queue.map(q => q.k + ':' + q.name + ':' + q.src) }
})
console.log('quick play:', JSON.stringify(qp))
ok(qp.card && qp.fold && qp.open, 'the Quick Play card has the fold, open — the device remembered the tap', qp)
ok(qp.card && !qp.dlg && qp.q.some(x => /^hurt:.*:game$/.test(x)), 'the injury from that game waits — nothing over the Quick Play card', qp)
await page.evaluate(() => window.__V178 && window.__V178.closeCard && window.__V178.closeCard())
const d3 = await waitDlg(8000)
ok(d3 && d3.kind === 'hurt' && /in the game/.test(d3.txt + ''), 'the card closed: the pop-up opens (hurt in the game, the week and the opponent)', d3)
await okDlg()

// ---- Settings › LIVE GAME › Big-play slow motion
await page.evaluate(() => { document.getElementById('ribDlgV149') && window.ribDialog.close(); window.go('settings') }); await page.waitForTimeout(700)
const set = await page.evaluate(async () => { const r = document.getElementById('bigSlowRowV193W'); if (!r) return { row: false }
  const act = () => [...r.querySelectorAll('button[data-mode]')].filter(b => b.classList.contains('secondary')).map(b => b.dataset.mode)
  const out = { row: true, live: !!r.closest('.card') && /LIVE GAME/.test(r.closest('.card').textContent), modes: [...r.querySelectorAll('button[data-mode]')].map(b => b.dataset.mode), active: act() }
  r.querySelector('button[data-mode=off]').click(); await new Promise(res => setTimeout(res, 200))
  const r2 = document.getElementById('bigSlowRowV193W'); out.after = r2 && [...r2.querySelectorAll('button[data-mode]')].filter(b => b.classList.contains('secondary')).map(b => b.dataset.mode); out.stored = window.__getGridironState().settings.bigSlowV193W
  return out })
console.log('settings:', JSON.stringify(set)); await page.evaluate(() => document.getElementById('bigSlowRowV193W')?.scrollIntoView({ block: 'center' })); await page.screenshot({ path: 'scripts/_v193W_settings.png' }).catch(() => {})
ok(set.row && set.live && set.modes.join() === 'off,subtle,dramatic' && set.active.join() === 'subtle', 'Settings › LIVE GAME has the "Big-play slow motion" row: Off · Subtle · Dramatic, Subtle by default', set)
ok(set.after && set.after.join() === 'off' && set.stored === 'off', 'Off is stored and drawn', set)

console.log('page errors:', errs.length ? '\n' + errs.slice(0, 10).join('\n') : 'NONE')
ok(!errs.length, 'no page errors')
console.log(`\n${pass} passed, ${fail} failed`)
console.log('VERDICT:', fail ? 'FAIL' : 'PASS')
await browser.close()
process.exit(fail ? 1 : 0)
