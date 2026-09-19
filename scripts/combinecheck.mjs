// Dev check (v139 THE COMBINE IS DRILLS, NOT GAMES).
//
// The DFL Combine was up to three more seasons of football games against "COMBINE FIELD", scored
// like any other week and summed into a season — and the national leaders board invented
// twenty-five rushing lines for a year in which nobody played a down.
//
// It is ONE year now, and what happens in it is the six drills every scout actually writes down,
// measured off the attributes they measure, on the SAME curves the skills sheet already prints.
//
// Asserts: the combine is one season; the six drills exist and read off the right attributes; a
// fast man tests fast and a slow man tests slow, in the right direction for a time vs a rep count;
// the season screen shows the drill board instead of a fixture list; the leaders board shows those
// numbers instead of invented box scores, and only at the combine.
//
//   node scripts/combinecheck.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
const url = process.env.GAME_URL || 'http://localhost:5173/index.html'
const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(url + (url.includes('?') ? '&' : '?') + 'stayStale', { waitUntil: 'networkidle', timeout: 25000 })
await page.waitForTimeout(1300)
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const step = async (t, w = 850) => { await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis).filter(e => !e.closest('#rib-coach-v119')); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim(); const el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : els.find(e => txt(e).includes(t)); if (el) { el.scrollIntoView({ block: 'center' }); el.click() } }, { t, visSrc: vis }).catch(() => {}); await page.waitForTimeout(w) }
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS']) await step(t)

ok(await page.evaluate(() => !!window.__COMBINE_V139), 'window.__COMBINE_V139 is mounted')

// ---- 1. the model ----
const model = await page.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = window.S, C = window.__COMBINE_V139
  const p = S.player; p.level = 6
  const seasons = A.maxSeasonsAllowed()
  const set = (v) => { for (const k in p.attrs) p.attrs[k] = v }
  set(92); const hi = C.all(p)
  set(22); const lo = C.all(p)
  set(92)
  const byK = (R, k) => R.rows.filter(r => r.k === k)[0]
  return { seasons, year6: C.year(p), year5: C.year({ level: 5 }), n: C.drills.length,
    attrs: C.drills.map(d => d.attr),
    hi: { grade: hi.grade, score: hi.score, forty: byK(hi, 'forty').value, bench: byK(hi, 'bench').value, vert: byK(hi, 'vert').value },
    lo: { grade: lo.grade, score: lo.score, forty: byK(lo, 'forty').value, bench: byK(lo, 'bench').value, vert: byK(lo, 'vert').value } }
})
console.log('model:', JSON.stringify(model))
ok(model.seasons === 1, 'the combine is ONE year — a draft week, not a season', `${model.seasons} season(s)`)
ok(model.year6 && !model.year5, 'and it is the combine level and only that', JSON.stringify([model.year6, model.year5]))
ok(model.n === 6, 'six drills', String(model.n))
ok(['speed', 'acceleration', 'strength', 'jumping', 'quickness', 'agility'].every(a => model.attrs.indexOf(a) >= 0),
  'measuring speed, acceleration, strength, jumping, quickness and agility — the things a combine measures', model.attrs.join(' · '))
ok(Number(model.hi.forty) < Number(model.lo.forty), 'a fast man runs a FASTER forty — a time goes down, not up', `${model.hi.forty}s vs ${model.lo.forty}s`)
ok(Number(model.hi.bench) > Number(model.lo.bench) && Number(model.hi.vert) > Number(model.lo.vert),
  'while reps and inches go up', `bench ${model.lo.bench}→${model.hi.bench}, vert ${model.lo.vert}→${model.hi.vert}`)
ok(model.hi.score > model.lo.score + 30, 'and the overall grade follows the man', `${model.lo.grade} (${model.lo.score}) vs ${model.hi.grade} (${model.hi.score})`)
ok(Number(model.hi.forty) > 4 && Number(model.hi.forty) < 6 && Number(model.hi.bench) < 45 && Number(model.hi.vert) < 48,
  'every number is one a scout could actually write down', `${model.hi.forty}s · ${model.hi.bench} reps · ${model.hi.vert}"`)

// ---- 2. the season screen is a drill board ----
const board = await page.evaluate(() => { window.go('season'); return null })
await page.waitForTimeout(700)
const sb = await page.evaluate(() => {
  const el = document.getElementById('combineV139')
  const t = document.getElementById('screen').innerText.replace(/\s+/g, ' ')
  return { board: !!el, h1: (document.querySelector('#screen .h1') || {}).textContent || '', fixtures: document.querySelectorAll('.sched-row .sched-opp').length,
    vs: /\bvs\b|@ /.test(t), drills: /40-Yard Dash/.test(t) && /Bench Press/.test(t) }
})
console.log('season:', JSON.stringify(sb))
ok(sb.board && /Combine/i.test(sb.h1), 'the combine year opens on the drills, not a schedule', sb.h1)
ok(sb.drills, 'the six drills are on it', String(sb.drills))

// ---- 2b. the weeks ARE the drills ----
const sched = await page.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, p = window.S.player
  const lvl = p.level; p.level = 6
  const six = A.buildSeasonSchedule(p).map(w => ({ opp: w.opp, k: w.combineV139 }))
  p.level = 4; const games = A.buildSeasonSchedule(p).map(w => ({ opp: w.opp, k: w.combineV139 }))
  p.level = lvl
  return { six, games, weeks: A.LEVELS[6].games }
})
console.log('schedule:', JSON.stringify(sched))
ok(sched.weeks === 6 && sched.six.length === 6, 'the combine year is six weeks — one per drill', `${sched.weeks} weeks`)
ok(sched.six.every(w => w.k) && new Set(sched.six.map(w => w.k)).size === 6 && /40-YARD DASH/.test(sched.six[0].opp),
  'and every week is a named drill, each one once — no opponent to play', sched.six.map(w => w.opp).join(' · '))
ok(sched.games.every(w => !w.k), 'a level that plays football still draws opponents', sched.games[0].opp)

// ---- 3. the leaders board invents nothing ----
const lead = async (lvl) => { await page.evaluate((l) => { window.S.player.level = l; try { window.setStatsTab && window.setStatsTab('leaders') } catch (e) {} window.go('stats') }, lvl); await page.waitForTimeout(750)
  return page.evaluate(() => { const t = document.getElementById('screen').innerText.replace(/\s+/g, ' ')
    return { combine: /COMBINE RESULTS/.test(t), invented: /Rush Yds|Rec Yds|Yds\/Carry|Pass Yds/i.test(t) } }) }
const L6 = await lead(6), L4 = await lead(4)
console.log('leaders:', JSON.stringify({ L6, L4 }))
ok(L6.combine && !L6.invented, 'the combine year has no statistical leaderboard — it has combine numbers', JSON.stringify(L6))
ok(!L4.combine && L4.invented, 'and a level that actually plays games still has its stat leaders', JSON.stringify(L4))

console.log('page errors:', errs.length ? errs.join('\n') : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
