// Dev check: v196 C AN INJURY IS A CHOICE (src/07-career-app.js).
// The owner: "Sometimes injuries are instantly cleared, please fix this. Once injured, tell how many weeks, make obvious.
// 2 choices dont make much sense as they stand now. One should be play through it with stat losses during, or rest and
// recover x weeks. I think clicking off the injury screen ignore it."
//   1. NEVER INSTANT: a one-game injury from a played week is still there after that week (TU v196C 0: gone at once, for
//      the record); a knock is one game, never cleared in the game it happened in
//   2. the pop-up opens on a big "N WEEKS" and offers exactly PLAY THROUGH IT / REST N WEEKS; a tap outside or Escape
//      does not close it
//   3. REST: he sits the N games (DNP), then is cleared; PLAY THROUGH: he plays every game (no DNP) at −15% attributes
//      (severity 2) and heals a game a game; the season dock says it
//   4. a season-ender: "OUT FOR THE SEASON", no choice; no page errors
// GAME_URL=http://localhost:5173/ node scripts/v196Ccheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const ctx = await browser.newContext({ viewport: { width: 420, height: 880 } })
await ctx.addInitScript(() => {
  // no random injuries: only the check's forced ones land; the pop-up on under the automated browser
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { injPlanMin: 0, injPlanMax: 0, v193WinjPrompt: 1 })
  try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
  setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80)
})
const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(String(e.message || e)))
await page.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V196C && !!window.__V193W, null, { timeout: 40000 })
await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
await page.evaluate(() => document.getElementById('splash')?.remove())
const M = (fn, arg) => page.evaluate(fn, arg)
const seed = () => M(() => {
  try { window.ribDialog && window.ribDialog.isOpen && window.ribDialog.close() } catch {}
  document.querySelectorAll('#growthV42,#pregameV1513,.decision-overlay,#simCardV178').forEach((x) => x.remove())
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; S.tree = S.tree || {}; A.setState(S)
  S.player = A.newPlayer(); const p = S.player; p.name = 'Hurt Man'; p.pos = 'RB'; p.age = 14; p.originV11 = 'walk-on'; p._wonShown = true
  p.level = 3; p.training = 'balanced'; p.points = 0; p.traits = []; p.injQV193W = []; A.startSeasonGames(); window.go('season'); return p.weekResults.length
})
const simWeek = (force) => M((force) => { const p = window.__getGridironState().player, i = p.weekResults.findIndex((w) => !w.played); if (i < 0) return -1; if (force) window.__V193W.force(force); window.__silentWeekV85(p, p.weekResults[i]); return i }, force)
const inj = () => M(() => { const j = window.__getGridironState().player.conditionV11.injury; return j ? { name: j.name, weeks: j.weeksRemaining, sev: j.severity, through: !!j.playThroughV196C, resting: !!j.resting } : null })
const readDlg = () => M(() => { const r = document.getElementById('ribDlgV149'); if (!r || !r.querySelector('.card-v149')) return null; const b = r.querySelector('.inj-weeks-v196c')
  return { choice: !!r.querySelector('.inj-choice-v196c'), heal: !!r.querySelector('.inj-heal-v193w'), banner: b ? b.innerText.replace(/\s+/g, ' ').trim() : null, weeks: b ? +b.dataset.weeks : null, buttons: [...r.querySelectorAll('button[data-i]')].map((x) => x.textContent.trim()) } })
const waitDlg = async (ms = 6000) => { await page.waitForFunction(() => !!document.querySelector('#ribDlgV149 .inj-pop-v193w, #ribDlgV149 .inj-heal-v193w'), null, { timeout: ms }).catch(() => {}); return readDlg() }
const clickBtn = (re) => M((src) => { const re = new RegExp(src, 'i'); const b = [...document.querySelectorAll('#ribDlgV149 button[data-i]')].find((x) => re.test(x.textContent)); b && b.click(); return !!b }, re)
const toSeason = () => M(() => window.go('season'))

// ---- 1. the kill switch first: the old instant clear (the bug, for the record)
await seed()
await M(() => { window.RIB_TUNE.v196C = 0 })
await simWeek({ name: 'Turf toe', weeks: 1, severity: 2 })
const OLD = await inj()
await M(() => { window.RIB_TUNE.v196C = 1; window.__getGridironState().player.injQV193W = []; try { window.ribDialog.isOpen && window.ribDialog.close() } catch {} })
console.log('info TU v196C 0: a 1-game injury right after its own game:', JSON.stringify(OLD))

// ---- 1-2. on: the 1-game injury is still there; the pop-up's banner and choice; no click-off
await seed()
const wi = await simWeek({ name: 'Turf toe', weeks: 1, severity: 2 })
const J1 = await inj()
ok(J1 && J1.weeks === 1, 'a 1-game injury is still there after the game it happened in (never cleared at once)', { on: J1, off: OLD })
await toSeason()
const D1 = await waitDlg()
await page.screenshot({ path: 'scripts/_v196C_choice.png' }).catch(() => {})
ok(D1 && D1.choice && D1.weeks === 1 && /1 WEEK/.test(D1.banner), 'the pop-up opens on a big "1 WEEK"', D1)
ok(D1 && D1.buttons.length === 2 && /Play through/i.test(D1.buttons[0]) && /Rest 1 week/i.test(D1.buttons[1]), 'exactly two choices: Play through it / Rest 1 week', D1 && D1.buttons)
await M(() => { const r = document.getElementById('ribDlgV149'); r.dispatchEvent(new MouseEvent('click', { bubbles: true })); r.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
await page.waitForTimeout(500)
const D1b = await readDlg()
ok(D1b && D1b.choice, 'a tap outside (or Escape) does not close it — he has to pick', D1b)
// ---- 3. REST
await clickBtn('Rest'); await page.waitForTimeout(400)
const R0 = await inj()
const dock = await M(() => { window.go('season'); return (document.querySelector('.inj-dock-v196c') || {}).innerText || '' })
ok(R0 && R0.resting && /OUT 1 WEEK/i.test(dock), 'Rest: he is resting, and the season dock says OUT 1 WEEK', { R0, dock })
const w2 = await simWeek(null)
const R1 = await M((w2) => { const p = window.__getGridironState().player; return { sat: !!p.weekResults[w2].satOut, inj: p.conditionV11.injury ? p.conditionV11.injury.weeksRemaining : null } }, w2)
ok(R1.sat && R1.inj === null && w2 === wi + 1, 'he sat the 1 game (DNP), then is cleared', R1)
await M(() => { window.__getGridironState().player.injQV193W = []; try { window.ribDialog.isOpen && window.ribDialog.close() } catch {} })

// ---- 3. PLAY THROUGH (a 2-game injury)
await seed()
await simWeek({ name: 'MCL sprain', weeks: 2, severity: 2 })
await toSeason()
const D2 = await waitDlg()
ok(D2 && D2.choice && D2.weeks === 2 && /2 WEEKS/.test(D2.banner) && /Rest 2 weeks/i.test(D2.buttons[1]) && /−15%/.test(D2.buttons[0]), 'a 2-week injury: "2 WEEKS", Play through it (−15%) / Rest 2 weeks', D2)
await clickBtn('Play through'); await page.waitForTimeout(400)
const T0 = await M(() => { const p = window.__getGridironState().player, j = p.conditionV11.injury; window.go('season'); return { through: !!j.playThroughV196C, sit: window.__mustSitV18(p), mul: +window.__fatigueMulV120(10, j).toFixed(3), dock: (document.querySelector('.inj-dock-v196c') || {}).innerText || '' } })
ok(T0.through && !T0.sit && T0.mul === 0.85 && /PLAYING HURT/i.test(T0.dock) && /2 WEEKS LEFT/i.test(T0.dock), 'Play through: he plays, at −15% to every attribute, and the dock says PLAYING HURT · 2 WEEKS LEFT', T0)
const a = await simWeek(null), b = await simWeek(null), c = await simWeek(null)
const T1 = await M(({ a, b, c }) => { const p = window.__getGridironState().player; return { satA: !!p.weekResults[a].satOut, satB: !!p.weekResults[b].satOut, inj: p.conditionV11.injury ? p.conditionV11.injury.weeksRemaining : null, playedC: p.weekResults[c].played && !p.weekResults[c].satOut } }, { a, b, c })
ok(!T1.satA && !T1.satB && T1.inj === null && T1.playedC, 'he played both games hurt (no DNP), healed a game a game, and is cleared after', T1)
await M(() => { window.__getGridironState().player.injQV193W = []; try { window.ribDialog.isOpen && window.ribDialog.close() } catch {} })

// ---- 1. a knock is one game, not cleared in its own game
await seed()
await simWeek({ knock: true, name: 'Bruised ribs' })
const K = await inj()
ok(K && K.weeks === 1, 'a knock is one game hurt — still there after the game it happened in', K)
await M(() => { window.__getGridironState().player.injQV193W = []; try { window.ribDialog.isOpen && window.ribDialog.close() } catch {} })

// ---- 4. a season-ender: no choice
await seed()
await simWeek({ name: 'Torn ACL', seasonEnding: true })
await toSeason()
const D4 = await waitDlg()
ok(D4 && !D4.choice && /OUT FOR THE SEASON/.test(D4.banner || '') && D4.buttons.length === 1, 'a season-ender: "OUT FOR THE SEASON", one button, no choice', D4)
await clickBtn('Got it')
ok(errors.length === 0, 'no page errors', errors.slice(0, 4))
await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
