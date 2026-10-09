// v193 AE — the ⏭ season sim picks every card. The owner: "Not sure the season sim is picking up random cards each game."
// A 12-game ⏭ sim used to deal 12 cards and apply 1 (the summary card's reel only showed, and Continue only picked, the last
// week's deck). This presses the REAL ⏭ button on the season dock and counts: every simmed game but the last is picked for
// him (marked `auto`, in the season's card log) before the card opens; the card says how many; Continue picks the last;
// a summary card that expires unseen picks its weeks before it is dropped; v193AE 0 restores the old one-card behaviour.
import { gameUrl, launch } from './lib/env.mjs'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const page = await browser.newPage({ viewport: { width: 360, height: 800 } })
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
await page.addInitScript(() => { setInterval(() => { try { document.querySelector('.onboard')?.remove() } catch {} }, 60) })
await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V193AB && !!window.__V178 && !!window.__V193AE, null, { timeout: 40000 })
await page.waitForTimeout(800)

const run = (off) => page.evaluate(async (off) => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  window.RIB_TUNE = window.RIB_TUNE || {}
  if (off) window.RIB_TUNE.v193AE = 0; else delete window.RIB_TUNE.v193AE
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S); S.tree = {}
  const p = A.newPlayer(); p.pos = 'RB'; p.name = 'Sim Man'; p.originV11 = 'walk-on'; p.level = 5; S.player = p; p.training = 'balanced'
  p.stars = 4; p.potentialCeil = 150; for (const k in p.attrs) p.attrs[k] = 70; p.points = 0; p.totalSeasons = 2
  document.querySelectorAll('#splash,#growthV42,#gv139gate,#growV132,.decision-overlay').forEach((o) => o.remove())
  A.startSeasonGames(); document.querySelectorAll('.decision-overlay').forEach((o) => o.remove())
  S.view = 'season'; window.render(); await wait(300)
  const btn = [...document.querySelectorAll('#dock button')].find((b) => /⏭/.test(b.textContent))
  const r = { btn: !!btn }
  btn && btn.click(); await wait(2000)
  const games = () => (p.weekResults || []).filter((w) => w.played && !w.satOut)
  const picked = () => games().filter((w) => w.payV178 && w.payV178.flip && w.payV178.flip.picked.length >= w.payV178.flip.n).length
  const autos = () => games().reduce((a, w) => a + ((w.payV178 && w.payV178.flip && w.payV178.flip.picked.filter((k) => k.auto).length) || 0), 0)
  const logN = () => ((window.__V193AB.log() || {}).list || []).length
  r.games = games().length
  r.card = !!document.getElementById('simCardV178')
  r.pickedBefore = picked(); r.autoBefore = autos(); r.logBefore = logN()
  r.line = (document.getElementById('batchCardsV193AE') || {}).textContent || ''
  r.width = document.scrollingElement.scrollWidth
  const cont = document.querySelector('#simCardV178 .btn'); cont && cont.click(); await wait(600)
  r.pickedAfter = picked(); r.logAfter = logN()
  // a summary card nobody saw in time: dropped, its weeks picked first
  const ws = [{ payV178: { flip: { deck: ['pt1', 'hot:rare:speed:20:4'], n: 1, picked: [] } } }, { payV178: { flip: { deck: ['pt1'], n: 1, picked: [] } } }]
  p.weekResults.push(...ws.map((w, i) => Object.assign(w, { played: true, week: 90 + i, opp: 'X' + i })))
  window.__V193AE.drop({ weeks: ws })
  r.dropped = ws.map((w) => w.payV178.flip.picked.length).join(',')
  r.dropBest = ws[0].payV178.flip.picked[0] && ws[0].payV178.flip.picked[0].id
  delete window.RIB_TUNE.v193AE
  return r
}, off)

const on = await run(false)
ok(on.btn && on.games >= 8, 'the season dock\'s ⏭ sims the regular season', { button: on.btn, games: on.games })
ok(on.card, 'the summary card opens')
ok(on.pickedBefore === on.games - 1 && on.autoBefore === on.games - 1, 'every simmed game but the last has its card picked for him (auto) before the card opens', on)
ok(on.logBefore === on.games - 1, 'each of those is in the season\'s card log', { log: on.logBefore, games: on.games })
ok(new RegExp('🃏 ' + (on.games - 1) + ' cards picked for you').test(on.line), 'the card says how many were picked for him', on.line)
ok(on.pickedAfter === on.games && on.logAfter === on.games, 'Continue picks the last game\'s card: one card a game, every game', { picked: on.pickedAfter, log: on.logAfter, games: on.games })
ok(on.dropped === '1,1' && /^hot:/.test(on.dropBest || ''), 'a summary card that expires unseen picks its weeks (the best by rarity) before it is dropped', { dropped: on.dropped, best: on.dropBest })
ok(on.width <= 360, 'no overflow at 360 px with the line', on.width)

const off = await run(true)
ok(off.pickedBefore === 0 && off.pickedAfter === 1 && !off.line, 'v193AE 0: the old behaviour (only the last week\'s card is picked)', off)

ok(!errs.length, 'no page errors', errs.slice(0, 3))
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
