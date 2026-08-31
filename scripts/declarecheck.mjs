// Dev check: v77 — a failed declare is the end of the career.
//   - the miss routes to `declineResult`, and that screen is an EPITAPH: no
//     "back to career", no Determination bonus, one way out (See Career Result)
//   - it summarises the whole career (totals across every finished season) and
//     the single best season, both read from the new seasonLogV77 archive
//   - the archive itself is written once per finished season, and rates are
//     averaged rather than summed (eight years of 4.8 YPC is not 38.4)
//   - the stakes are stated BEFORE the roll, on both screens that offer it
// node scripts/declarecheck.mjs   (needs `npm run dev` on :5173)
import { chromium } from 'playwright'

const fails = []
const ok = (c, label, detail) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${label}${detail ? '  ' + detail : ''}`); if (!c) fails.push(label) }

const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport: { width: 520, height: 1100 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => { setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(process.env.DECLARE_URL || 'http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1200)

const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const click = async (t, ms = 700) => {
  const hit = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t === 'ARCH') el = els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
    else el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').toUpperCase().includes(t.toUpperCase())))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false
  }, { t, visSrc: vis })
  await page.waitForTimeout(ms)
  return hit
}
const clearWheel = async () => {
  for (let i = 0; i < 60; i++) {
    const done = await page.evaluate(() => {
      const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') { g.click(); return false }
      if (document.getElementById('pregameV1513')) { window.continuePregameV1513 && window.continuePregameV1513(); return false }
      return !document.getElementById('growthV42')
    })
    if (done) return
    await page.waitForTimeout(250)
  }
}
const view = () => page.evaluate(() => window.S && window.S.view)
const screenText = () => page.evaluate(() => (document.getElementById('screen') || {}).innerText || '')
const declareButton = () => page.evaluate(visSrc => {
  const vis = eval(visSrc)
  const el = [...document.querySelectorAll('button,[onclick]')].filter(vis)
    .find(e => /declare|interstellar call/i.test((e.getAttribute('onclick') || '') + ' ' + (e.innerText || '')))
  return el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : null
}, vis)
const dockText = () => page.evaluate(() => (document.getElementById('dock') || {}).innerText || '')

for (const s of ['START NEW CAREER', 'ARCH', 'RB Running Back', 'Lock In Personality']) await click(s)
await click('PLAY 8-GAME SEASON', 900) || await click('Season', 900)
await clearWheel()
await click('Balanced Program', 900)

// Burn whole seasons with the quick sim until the declare is on offer. Each
// season leaves the result screen, where the declare button lives.
let seasonsPlayed = 0, sawStakes = false
for (let s = 0; s < 6; s++) {
  for (let i = 0; i < 80; i++) {
    if (await view() === 'result') break
    await clearWheel()
    let moved = false
    for (const label of ['SIM REMAINING', 'QUICK PLAY', 'FINISH SEASON', 'SEASON RESULTS', 'CONTINUE'])
      if (await click(label, 450)) { moved = true; break }
    if (!moved) await page.waitForTimeout(250)
  }
  if (await view() !== 'result') break
  seasonsPlayed++
  // the word "declare" also appears in the odds explainer, so look for the BUTTON
  const dec = await declareButton()
  if (process.env.DECLARE_DEBUG) console.log('  [season]', seasonsPlayed, 'declare button:', JSON.stringify(dec))
  if (dec) { if (/one shot/i.test((await screenText()) + ' ' + (await dockText()))) sawStakes = true; break }
  // no declare yet — leave the result screen, take the next season
  for (let i = 0; i < 40; i++) {
    if (await view() === 'training') break
    await clearWheel()
    if (await click('CONTINUE', 500)) continue
    if (await click('PLAY ', 500)) continue
    await page.waitForTimeout(200)
  }
  await clearWheel()
  await click('Balanced Program', 700)
}
ok(seasonsPlayed > 0, 'the walk reached a declare', `${seasonsPlayed} season(s) played`)

const archive = await page.evaluate(() => {
  const p = window.S && window.S.player
  return { log: (p && p.seasonLogV77) || [], total: p && p.totalSeasons, pos: p && p.pos }
})
ok(archive.log.length > 0, 'seasonLogV77 records finished seasons', `${archive.log.length} row(s)`)
ok(archive.log.length === archive.total, 'one row per finished season', `${archive.log.length} vs totalSeasons ${archive.total}`)
ok(archive.log.every(r => r.record && r.grade && r.statLine && Object.keys(r.statLine).length),
  'every row carries record, grade and a stat line')

const totals = await page.evaluate(() => {
  const p = window.S.player, T = window.__CAREER_V77 ? window.__CAREER_V77.totals(p) : null
  return T ? { seasons: T.seasons, lines: T.lines.map(l => ({ name: l.name, rate: l.rate, total: l.total, per: l.per })) } : null
})

ok(sawStakes, 'the season-result declare card states the one-shot stakes')

// ---- the miss. 0.999 fails every roll: the chance is capped at 97 (or 99.5 on
// the national-rank floor), so nothing can clear 99.9.
await page.evaluate(() => { window.__realRandom = Math.random; Math.random = () => 0.999 })
const beforeSeasons = archive.log.length
await click('Declare', 1200)
await page.evaluate(() => { if (window.__realRandom) Math.random = window.__realRandom })

const v = await view()
ok(v === 'declineResult', 'a failed declare lands on the career-end screen', 'view=' + v)
const txt = await screenText(), dock = await dockText()
ok(/Didn't Make the Cut/i.test(txt), 'the screen says the climb is over')
ok(/one shot/i.test(txt), 'it states there is no second attempt')
ok(/Career Totals/i.test(txt), 'career totals are summarised')
ok(/Best Season/i.test(txt), 'the best season is summarised')
ok(/Career Log/i.test(txt), 'the level-by-level log is shown')
ok(/See Career Result/i.test(dock), 'the only way out is the career result')
ok(!/Back to Career/i.test(dock) && !/Play Another Season/i.test(dock), 'no path back into the career')

const after = await page.evaluate(() => {
  const p = window.S.player
  return { bonus: p.declareBonus || 0, fail: p.declareFailV77 || null, best: window.__CAREER_V77 ? window.__CAREER_V77.best(p) : null }
})
ok(!after.bonus, 'no Determination bonus is banked — there is nothing left to spend it on', 'declareBonus=' + after.bonus)
ok(after.fail && after.fail.chance > 0, 'the odds that missed are kept for the epitaph', after.fail ? Math.round(after.fail.chance) + '%' : 'none')
ok(!!after.best, 'a best season resolves off the archive', after.best ? `${after.best.levelName} grade ${after.best.grade}` : '')

// ---- rates are averaged, totals are summed
if (totals) {
  const rate = totals.lines.find(l => l.rate), sumd = totals.lines.find(l => !l.rate)
  ok(!rate || rate.total < 40, 'a rate stat is averaged, not summed', rate ? `${rate.name}=${rate.total.toFixed(1)}` : 'n/a')
  ok(!sumd || sumd.total >= sumd.per - 0.001, 'a counting stat is summed', sumd ? `${sumd.name}=${Math.round(sumd.total)} over ${beforeSeasons} season(s)` : 'n/a')
}

await clearWheel()
try { await page.locator('#screen').screenshot({ path: 'scripts/_declare.png' }) } catch (e) { await page.screenshot({ path: 'scripts/_declare.png' }) }

// ---- and the settlement screen still works from here
await click('See Career Result', 1200)
ok(await view() === 'gameover', 'the career result screen still follows', 'view=' + await view())

console.log('page errors:', errs.length ? '\n' + errs.join('\n') : 'none')
await b.close()
if (fails.length || errs.length) { console.log('\nFAILED:', fails.join(', ')); process.exit(1) }
console.log('\nall good')
