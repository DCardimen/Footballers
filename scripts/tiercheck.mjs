// Dev check (v139 THE PROGRAM YOU PICKED IS THE TEAMS YOU FACE).
//
// A program's `comp` moved exactly one number — the divisor inside `qt` that decides how hard it is
// to stand out nationally — and nothing else. The schedule was identical at a Blue-Blood and a
// Mid-Major, so "Competition Brutal" was a word on a card. And the extra recruit star the top tier
// promised was handed over the moment you committed, before you had played a down.
//
// Asserts: the opponents really do get stronger with the tier; the number each card states is the
// mean the game actually generates; every card says what it pays and when; nothing is granted at
// the door; the star is paid at the end of a season graded C or better, once, and appears as an
// award; a worse grade pays nothing and leaves it on offer.
//
//   node scripts/tiercheck.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
const url = process.env.GAME_URL || 'http://localhost:5173/index.html'
const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.goto(url + (url.includes('?') ? '&' : '?') + 'stayStale', { waitUntil: 'networkidle', timeout: 25000 })
await page.waitForTimeout(1400)
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }

ok(await page.evaluate(() => !!window.__TIER_V139), 'window.__TIER_V139 is mounted')

// ---- 1. the schedule really moves with the tier, and the card states the mean ----
const sched = await page.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = window.S, V = window.__TIER_V139
  const p = A.newPlayer(S, 'RB'); S.player = p; p.level = 5; p.tiers = {}
  const run = (key) => { p.tiers = { college: key }
    let sum = 0; const N = 300
    for (let w = 0; w < N; w++) sum += V.opp('X', 5, (w % 12) + 1, 1000 + w, undefined).rating
    const tier = V.of(p)
    return { key, name: tier.name, mean: +(sum / N).toFixed(1), stated: V.oppOvr(5, tier) } }
  const rows = ['blue', 'p5', 'mid'].map(run)
  p.tiers = {}
  const none = (() => { let sum = 0; for (let w = 0; w < 300; w++) sum += V.opp('X', 5, (w % 12) + 1, 1000 + w, undefined).rating; return +(sum / 300).toFixed(1) })()
  return { rows, none }
})
console.log('schedule:', JSON.stringify(sched))
ok(sched.rows[0].mean > sched.rows[1].mean + 2 && sched.rows[1].mean > sched.rows[2].mean + 2,
  'the opponents really do get stronger with the program', sched.rows.map(r => `${r.key} ${r.mean}`).join(' · '))
ok(sched.rows.every(r => Math.abs(r.mean - r.stated) <= 1),
  'and the number on the card is the mean the game generates, not a decoration', sched.rows.map(r => `${r.key} says ${r.stated}, generates ${r.mean}`).join(' · '))
ok(Math.abs(sched.none - sched.rows[1].mean) <= 6, 'a player with no program committed is unaffected', `no tier ${sched.none}`)

// ---- 2. the cards say what they pay and when ----
const cards = await page.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = window.S
  const p = A.newPlayer(S, 'RB'); S.player = p; p.level = 5; p.tiers = {}; S.view = 'tier'
  let err = null; try { (window.render || window.q)() } catch (e) { err = String(e && e.message) }
  const html = document.getElementById('screen').innerHTML
  return { err, ovrs: (html.match(/Opponents ~\d+ OVR/g) || []), pays: (html.match(/Pays <b>[^<]+<\/b>[^<]*/g) || []) }
})
console.log('cards:', JSON.stringify(cards))
ok(cards.ovrs.length === 3, 'every program states the average opponent you will face', cards.ovrs.join(' · '))
ok(cards.pays.length === 3 && /recruit ★/.test(cards.pays[0]) && /grade C or better/.test(cards.pays[0]),
  'and what it pays, with the ★ named as a season-end reward you have to earn', cards.pays[0])

// ---- 3. nothing at the door; the star at the end of a season you held your own in ----
const reward = await page.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = window.S, V = window.__TIER_V139
  const p = A.newPlayer(S, 'RB'); S.player = p; p.level = 5; p.tiers = {}; p.stars = 2; p.awards = []
  // the commit renders the hub on its way out, which a bare fixture cannot draw — the tier is written first
  try { window.chooseTier('blue') } catch (e) {}
  const atDoor = p.stars
  const season = (grade) => { const t = { grade, awards: [] }; V.reward(p, t); return { stars: p.stars, paid: t.tierRewardV139, awards: t.awards.length } }
  const flunked = season('F')
  const held = season('C')
  const again = season('A')
  return { atDoor, flunked, held, again, awardName: (p.awards[p.awards.length - 1] || {}).name }
})
console.log('reward:', JSON.stringify(reward))
ok(reward.atDoor === 2, 'committing to the program grants nothing on its own', `★${reward.atDoor}`)
ok(reward.flunked.stars === 2 && reward.flunked.paid && !reward.flunked.paid.ok, 'an F season pays nothing and says so', JSON.stringify(reward.flunked.paid))
ok(reward.held.stars === 3 && reward.held.paid.ok && reward.held.awards === 1, 'a C or better pays the ★ at the end of that season, as an award', `★${reward.held.stars} · ${reward.awardName}`)
ok(reward.again.stars === 3, 'and it is paid once, not every season', `★${reward.again.stars}`)

console.log('page errors:', errs.length ? errs.join('\n') : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
