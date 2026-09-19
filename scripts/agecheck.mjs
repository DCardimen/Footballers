// Dev check (v139 THE YEARS TAKE THEIR CUT): age is worth something now.
//
// Two things used to decline a man and both were DFL-only: a flat multiplier that started at 30
// and topped out at 6% a season, and a handful of coin flips in `dc` for a point here and there.
// A 33-year-old held his speed for a decade. Now the first season past his ATHLETIC PRIME takes
// 5% of every physical attribute, steepening through the bands `mn()` already described, at every
// level — and the two endgame nodes that answer it are real: SECOND WIND reads the curve a year
// younger per level, EARLY DECLARATION takes a season off the minimum at this level.
//
// Asserts: nothing is taken before the prime is over; the first year past it is at least 5%; the
// cut steepens band by band and stops at the cap; the mind is exempt; the cut reaches the sheet
// through `dc` (so the v132 year-older screen shows it) and is booked attribute by attribute; the
// floor never LIFTS a stat that is already under it; Second Wind pushes the whole curve back;
// Evergreen still halves what is left; and the new endgame nodes exist at the prices asked for.
//
//   node scripts/agecheck.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
const url = process.env.GAME_URL || 'http://localhost:5173/index.html'
const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined })
const page = await browser.newPage({ viewport: { width: 520, height: 1000 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.goto(url + (url.includes('?') ? '&' : '?') + 'stayStale', { waitUntil: 'networkidle', timeout: 25000 })
await page.waitForTimeout(1200)
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }

ok(await page.evaluate(() => !!window.__ageV139), 'window.__ageV139 is mounted')

// ---- 1. the curve ----
const curve = await page.evaluate(() => {
  const V = window.__ageV139, S = window.S
  const at = (tree) => { S.tree = tree; const r = {}; for (const a of [18, 24, 27, 28, 31, 32, 35, 36, 39, 40, 44]) r[a] = +(V.cut({ age: a }) * 100).toFixed(1); return r }
  const plain = at({}), wind = at({ secondWind: 8 }), half = at({ evergreen: 1 }), none = at({ evergreen: 2 })
  S.tree = {}
  return { plain, wind, half, none, bands: [27, 28, 32, 36, 40].map(a => V.profile({ age: a }).key) }
})
console.log('curve:', JSON.stringify(curve.plain))
ok(curve.plain[18] === 0 && curve.plain[24] === 0 && curve.plain[27] === 0, 'the prime years take nothing', `18/24/27 → ${curve.plain[18]}/${curve.plain[24]}/${curve.plain[27]}%`)
ok(curve.plain[28] >= 5, 'the first season past the prime is at least 5% off every physical attribute', `${curve.plain[28]}%`)
ok(curve.plain[32] > curve.plain[28] && curve.plain[36] > curve.plain[32] && curve.plain[40] > curve.plain[36], 'and it steepens band by band', [28, 32, 36, 40].map(a => curve.plain[a] + '%').join(' → '))
ok(curve.plain[44] === curve.plain[40] && curve.plain[40] <= 16.01, 'with a cap, so the last years do not erase him in one season', `${curve.plain[40]}% at 40 and 44`)
ok(curve.bands.join() === 'prime,veteran,decline,late,legend', 'the bands are the age profile\'s own', curve.bands.join(' · '))

// ---- 2. the nodes that answer it ----
ok(curve.wind[28] === 0 && curve.wind[35] === 0 && curve.wind[36] > 0, 'Second Wind at Lv 8 reads the curve eight years younger', `28→${curve.wind[28]}% · 35→${curve.wind[35]}% · 36→${curve.wind[36]}%`)
ok(Math.abs(curve.half[32] - curve.plain[32] / 2) < 0.06, 'Evergreen still halves what is left, per level', `${curve.plain[32]}% → ${curve.half[32]}%`)
ok(curve.none[40] === 0, 'and at Lv 2 the years never take a point off him, as its card says', `${curve.none[40]}% at 40`)

const nodes = await page.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__
  return ['secondWind', 'earlyDeclare', 'apexOutput', 'apexCeiling', 'goldenAge', 'inevitable']
    .map(k => { const n = A.TREE_NODES[k]; return n ? { k, cost: A.nodeCost(n), max: n.max } : { k, missing: true } })
})
console.log('nodes:', JSON.stringify(nodes))
ok(nodes.every(n => !n.missing), 'every endgame node is on the tree', nodes.map(n => n.k).join(' · '))
ok(nodes[0].cost === 5000 && nodes[0].max === 8, 'Second Wind starts at 5,000 PP and buys eight years', `${nodes[0].cost} PP · max ${nodes[0].max}`)
ok(nodes[1].cost === 10000, 'Early Declaration starts at 10,000 PP', `${nodes[1].cost} PP`)
ok(nodes.slice(2).every(n => n.cost >= 15000), 'and the rest of the tier is a real money sink', nodes.slice(2).map(n => n.k + ' ' + n.cost).join(' · '))

// ---- 3. the cut reaching the sheet ----
const sheet = await page.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = window.S, V = window.__ageV139
  S.tree = {}
  const run = (age, level, seed) => {
    const p = A.newPlayer(S, 'RB'); S.player = p; p.age = age; p.level = level
    for (const k of V.attrs()) if (p.attrs[k] != null) p.attrs[k] = 80
    p.attrs.awareness = 80; p.attrs.vision = 80; p.attrs.grit = 80
    const before = { ...p.attrs }, w = {}
    V.year(p, w)
    return { speed: [before.speed, p.attrs.speed], aware: [before.awareness, p.attrs.awareness],
      changed: Object.keys(w.ageChanges || {}).length, prof: (w.ageProfile || {}).key,
      anyUp: Object.values(w.ageChanges || {}).some(c => c.delta > 0 && c.from >= 10) }
  }
  const young = run(24, 7), vet = run(30, 7), college = run(30, 4)
  // a stat already under the floor is never lifted by it
  const p = A.newPlayer(S, 'RB'); S.player = p; p.age = 36; p.level = 7; p.attrs.speed = 6
  V.year(p, {})
  return { young, vet, college, floor: p.attrs.speed }
})
console.log('sheet:', JSON.stringify(sheet))
ok(sheet.young.speed[0] === sheet.young.speed[1], 'a man in his prime loses nothing to the year', `${sheet.young.speed.join(' → ')}`)
ok(sheet.vet.speed[1] <= 76, 'a 30-year-old gives up at least 5% of his speed', `${sheet.vet.speed.join(' → ')}`)
ok(sheet.vet.aware[0] <= sheet.vet.aware[1], 'while the mind is exempt — awareness never falls to age', `${sheet.vet.aware.join(' → ')}`)
ok(sheet.vet.changed >= 8, 'and the year-older screen gets it attribute by attribute', `${sheet.vet.changed} attributes booked`)
ok(sheet.college.speed[1] <= 76, 'the years reach a college veteran too, not just the DFL', `level 4: ${sheet.college.speed.join(' → ')}`)
ok(!sheet.vet.anyUp && !sheet.college.anyUp, 'no physical attribute is RAISED by the age model')
ok(sheet.floor === 6, 'the floor never lifts a stat that is already under it', `6 → ${sheet.floor}`)

// ---- 4. the declare ----
const decl = await page.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = window.S
  const p = A.newPlayer(S, 'RB'); S.player = p; p.level = 3
  S.tree = {}; const base = A.minSeasonsRequired()
  S.tree = { earlyDeclare: 1 }; const one = A.minSeasonsRequired()
  S.tree = { earlyDeclare: 9 }; const lots = A.minSeasonsRequired()
  S.tree = {}
  return { base, one, lots }
})
console.log('declare:', JSON.stringify(decl))
ok(decl.one === Math.max(1, decl.base - 1), 'Early Declaration takes a season off the minimum at this level', `${decl.base} → ${decl.one}`)
ok(decl.lots >= 1, 'and it can never take him below one season', String(decl.lots))

console.log('page errors:', errs.length ? errs.join('\n') : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
