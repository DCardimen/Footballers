// Dev check: v189 (src/07-career-app.js).
//   A: ONE STAT LINE — a tapped Quick Play's card opens on the same YOUR GAME tiles as the live card (every box-score line,
//      the season, the pace) and the season race; the season is summed from every played week, simmed or watched
//   B: THE MEDAL REWARD COMES TO YOU — new medals open the chooser on the next screen (hub / season / prestige), once a
//      batch ("Later" is respected); off under an automated browser unless `v189medalPrompt` is 1
//   C: THE BANK, AT THE SEASON'S END — the top bar's 🏦 does not count up mid-season; the season's end records it, the
//      season report and the prestige screen show the 🏦 BANKED pot (the season's gain counting up); the career's end rains
//      it into the Vault
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v189check.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const ctx = await browser.newContext({ viewport: { width: 400, height: 860 } })
await ctx.addInitScript(() => {
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, {})
  try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
  setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80)
})
const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(String(e.message || e)))
await page.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V178 && !!window.__V189, null, { timeout: 40000 })
await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
await page.evaluate(() => document.getElementById('splash')?.remove())
const M = (fn, arg) => page.evaluate(fn, arg)
const seed = (o = {}) => M((o) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; S.tree = S.tree || {}; A.setState(S)
  S.player = A.newPlayer(); const p = S.player; p.name = 'Card Man'; p.pos = o.pos || 'RB'; p.age = 14; p.originV11 = 'walk-on'; p._wonShown = true
  p.level = o.level != null ? o.level : 3; p.training = 'balanced'; p.points = 0; p.traits = []; A.startSeasonGames()
  window.go('season'); window.GridironStorage.save(S)
  return { weeks: p.weekResults.length }
}, o)

// A1: the season box sums every played week's line (simmed or watched), the current game once
await seed({ level: 3, pos: 'RB' })
const A1 = await M(() => {
  const p = window.S.player, V = window.__V189
  p.weekResults[0].played = true; p.weekResults[0].statLine = { rush: 80, carries: 15, td: 1, longest: 22 }
  p.weekResults[1].played = true; p.weekResults[1].statLine = { rush: 40, carries: 10, td: 0, longest: 35 }
  const cur = { rush: 100, carries: 20, td: 2, longest: 18 }
  const S1 = V.seasonBox(p, cur, p.weekResults[2])
  const html = V.hero(p, cur, S1.box, S1.n)
  for (const i of [0, 1]) { p.weekResults[i].played = false; p.weekResults[i].statLine = null }
  return { box: S1.box, n: S1.n, tiles: (html.match(/pg-hero-tile-v186/g) || []).length, pace: /on pace/.test(html) }
})
ok(A1.box.rush === 220 && A1.box.td === 3 && A1.box.longest === 35 && A1.n === 3, 'the season is every played week\'s line plus this game (sums; the longest is a best)', A1)
ok(A1.tiles >= 3 && A1.pace, 'the YOUR GAME tiles carry the season and the pace', A1)

// A2: a tapped Quick Play opens the card with the same tiles and the season race
const A2 = await M(async () => {
  const p = window.S.player; p.points = 0; p.payBankV178 = 0.95
  window.go('season'); await new Promise((r) => setTimeout(r, 300))
  const b = [...document.querySelectorAll('#dock button')].find((x) => /Quick Play/.test(x.textContent))
  b && b.click()
  for (let k = 0; k < 80 && !document.getElementById('simCardV178'); k++) {
    const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none' && g.getBoundingClientRect().height) g.click()
    await new Promise((r) => setTimeout(r, 150))
  }
  const card = document.getElementById('simCardV178'), w = p.weekResults.find((x) => x.played && x.statLine)
  return { card: !!card, hero: !!(card && card.querySelector('#pgHeroV186')), tiles: card ? card.querySelectorAll('.pg-hero-tile-v186').length : 0, race: !!(card && /SEASON|WIN|LOSS/.test(card.textContent)), line: !!w }
})
ok(A2.card && A2.hero && A2.tiles >= 3 && A2.line, 'a Quick Play card opens on YOUR GAME — the same tiles as the live card', A2)
await M(() => { try { window.__V178.closeCard() } catch (e) {} document.querySelectorAll('.decision-overlay').forEach((x) => x.remove()) })

// B: the medal chooser comes to you on the next screen
const B = await M(async () => {
  const A = window.__GRIDIRON_AUDIT__, S = A.getState(), Md = window.__V179.medals, st = Md.store()
  document.querySelectorAll('.decision-overlay').forEach((x) => x.remove())
  st.pending = []; st.seen = 0; st.promptedV189 = null
  window.RIB_TUNE.v189medalPrompt = 1
  S.honorsV156A = { floor: 3 }; S.view = 'result'
  window.go('hub'); await new Promise((r) => setTimeout(r, 700))
  const opened = !!document.getElementById('medalPickV179'), pending = st.pending.length
  Md.close(); window.go('hub'); await new Promise((r) => setTimeout(r, 700))
  const again = !!document.getElementById('medalPickV179')
  delete window.RIB_TUNE.v189medalPrompt
  st.promptedV189 = null; window.go('hub'); await new Promise((r) => setTimeout(r, 700))
  const auto = !!document.getElementById('medalPickV179')
  st.pending = []
  return { opened, pending, again, auto }
})
ok(B.opened && B.pending >= 1, 'new medals: the hub opens the reward chooser by itself', B)
ok(!B.again, '"Later" is respected until another medal comes', B)
ok(!B.auto, 'under an automated browser it stays off unless the tune asks for it', B)

// C: the bank — hidden mid-season, shown at the season's end, rained at the career's end
const C = await M(async () => {
  const A = window.__GRIDIRON_AUDIT__, S = A.getState(), V = window.__V189, p = S.player
  S.bankShownV189 = 0; S.bankSeasonV189 = null
  window.__V136_C.bank(500, 'test')
  const midChip = (document.getElementById('ppBankChipV139') || {}).hidden, midShown = V.shown(), banked = window.__V136_C.banked()
  // the season's end
  p.weekResults.forEach((w) => { w.played = true; if (!w.statLine) w.statLine = {} })
  window.finishSeasonGames(); await new Promise((r) => setTimeout(r, 300))
  const rec = S.bankSeasonV189 && { from: S.bankSeasonV189.from, to: S.bankSeasonV189.to }
  const res = document.getElementById('bankResultV189'), view = S.view
  await new Promise((r) => setTimeout(r, 1600))
  const num = res ? res.querySelector('.num').textContent : null
  window.go('shop'); await new Promise((r) => setTimeout(r, 400))
  const shop = !!document.getElementById('bankShopV189')
  // the career's end: the pot rains into the Vault
  p._vaultPayV137 = 1234; p._vaultRainV189 = null
  const rained = V.rain(p), rain = !!document.getElementById('bankRainV189'), coins = document.querySelectorAll('#bankRainV189 b').length
  const twice = V.rain(p)
  return { midChip, midShown, banked, rec, view, res: !!res, num, shop, rained, rain, coins, twice, after: V.shown() }
})
ok(C.banked >= 500 && C.midShown === 0, 'mid-season the bank is not counted up on screen (the 🏦 waits for the season\'s end)', C)
ok(C.view === 'result' && C.rec && C.rec.from === 0 && C.rec.to >= 500 && C.res && C.num && C.num !== '0', 'the season\'s end: the report opens on the 🏦 BANKED pot, counting up the season\'s gain', C)
ok(C.shop, 'the prestige screen shows the pot', C.shop)
ok(C.rained && C.rain && C.coins >= 12 && !C.twice && C.after === 0, 'the career\'s end rains it into the Vault — once a payout', C)

console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
if (errors.length) console.log('page errors:', errors.slice(0, 6))
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
