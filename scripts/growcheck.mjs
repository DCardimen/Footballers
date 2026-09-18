// Dev check: v132 A YEAR OLDER — the offseason body screen over the season report card.
//
// The season roll turns the man a year older, moves his frame along the v112 growth curve and, past his
// prime, takes attributes off him — and the report card never showed any of it. The v132 screen opens
// over the report card the first time it renders for a finished season and shows exactly what the roll
// did, read back from the same functions the sheet uses. Asserts:
//   * it opens on the report card, once, a year older, with last year's body and this year's from bodyNowV112
//   * the finished tiles carry this year's height / weight / muscle, formatted as the sheet formats them
//   * the height rule's NOW mark sits above the WAS mark when he grew
//   * the season's gains are the season's gains (seasonStats.gains > 0), one pill each
//   * the coach (v119) waits at its door while it is up
//   * closing it marks the season seen and saves; a re-render of the report card does not bring it back
//   * a veteran's year reads as decline — the red section, the title, the profile's own words
//   * ?noGrowV132 / TU("growScreenV132",0) keep it off
//   node scripts/growcheck.mjs
import { chromium } from 'playwright'

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const URL = process.env.SPLASH_URL || 'http://localhost:5173/'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`

async function toReportCard(q = '') {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } })
  const page = await ctx.newPage(); const errs = []
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 160)) })
  await page.addInitScript(() => { try { localStorage.setItem('rib.coachTour.v119', 'on') } catch {} setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
  await page.goto(URL + '?noFilmV114' + q, { waitUntil: 'networkidle', timeout: 60000 })
  for (let i = 0; i < 200; i++) { if (await page.evaluate(() => !document.getElementById('splash'))) break; await page.waitForTimeout(100) }
  const step = async (t) => { await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim(); const el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : els.find(e => txt(e).includes(t)); if (el) { el.scrollIntoView({ block: 'center' }); el.click() } }, { t, visSrc: vis }); await page.waitForTimeout(900) }
  for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON']) await step(t)
  for (let i = 0; i < 60; i++) { const d = await page.evaluate(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') { g.click(); return false } return !document.getElementById('growthV42') }); if (d) break; await page.waitForTimeout(300) }
  await step('CONFIRM TRAINING')
  for (let i = 0; i < 30; i++) {
    const v = await page.evaluate(() => { try { return window.__GRIDIRON_AUDIT__.getState().view } catch (e) { return null } })
    if (v === 'result') break
    await page.evaluate(() => { try { window.simRemainingWeeks && window.simRemainingWeeks() } catch (e) {} }); await page.waitForTimeout(400)
    await page.evaluate(() => { const A = window.__GRIDIRON_AUDIT__, p = A.getState().player; for (const w of (p.weekResults || [])) { if (!w || w.played) continue; try { A.resolveSequentialWeekV11(p, w, 'balanced') } catch (e) {} w.played = true; w.won = !!(w.us > w.them) } }); await page.waitForTimeout(200)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^\s*(CONTINUE|OK|CLOSE|NEXT)\s*$/i.test((x.innerText || '').trim()) && x.getBoundingClientRect().height > 0 && !x.closest('#rib-coach-v119')); if (b) b.click() }); await page.waitForTimeout(300)
    await page.evaluate(() => { try { window.finishSeasonGames && window.finishSeasonGames() } catch (e) {} }); await page.waitForTimeout(600)
  }
  // a story wheel left over the report card is answered first, as a player would
  for (let i = 0; i < 20; i++) { const d = await page.evaluate(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none' && g.getBoundingClientRect().height > 0) { g.click(); return false } return !document.getElementById('growthV42') }); if (d) break; await page.waitForTimeout(400) }
  const view = await page.evaluate(() => { try { return window.__GRIDIRON_AUDIT__.getState().view } catch (e) { return null } })
  return { page, ctx, errs, view }
}

// ---- 1. the screen over the report card
{
  const { page, ctx, errs, view } = await toReportCard()
  ok(view === 'result', 'a season was played to the report card', String(view))
  const st = await page.evaluate(() => { const G = window.__GROW_V132, p = window.__GRIDIRON_AUDIT__.getState().player, d = G && G.last
    if (!G || !d) return null
    const el = document.getElementById('growV132')
    return { open: G.open, el: !!el, mode: d.mode, age: d.age, prev: d.prev, pAge: p.age, b0: [d.b0.height, d.b0.weight, d.b0.muscle], b1: [d.b1.height, d.b1.weight, d.b1.muscle],
      gains: d.gains.length, gainsTruth: Object.values(p.seasonStats.gains || {}).filter(v => v > 0).length, seen: p.growSeenV132, total: p.totalSeasons, z: el && getComputedStyle(el).zIndex,
      title: el && el.querySelector('.gw-title').textContent, eyebrow: el && el.querySelector('.gw-eyebrow').textContent } })
  ok(st && st.open && st.el, 'the offseason body screen opens over the report card', JSON.stringify(st && { open: st.open, el: st.el, z: st.z }))
  ok(st && st.age === st.pAge && st.prev === st.pAge - 1, 'a year older: it counts from last year to the age the roll set', st && `${st.prev} -> ${st.age} (player.age ${st.pAge})`)
  ok(st && st.mode === 'grown' && (st.b1[0] > st.b0[0] || st.b1[1] > st.b0[1]), 'a kid grew: this year\'s frame from bodyNowV112 is larger than last year\'s', st && `${st.b0} -> ${st.b1}`)
  ok(st && st.gains === st.gainsTruth, 'the season\'s gains on it are the season\'s gains — one pill per attribute that moved', st && `${st.gains} vs ${st.gainsTruth}`)
  ok(st && st.seen === st.total, 'it marks the season seen the moment it opens (a reload does not replay it)', st && `${st.seen} of ${st.total}`)
  ok(st && /A YEAR OLDER/.test(st.title || '') && /OFFSEASON/.test(st.eyebrow || ''), 'and it says so', st && st.title)
  const coach = await page.evaluate(() => { const C = window.__RIB_COACH; return C ? { open: C.isOpen, enabled: C.enabled } : null })
  ok(coach && !coach.open, 'the coach waits at his door while it is up', JSON.stringify(coach))
  // fast-forward, then read the finished sheet
  await page.evaluate(() => window.__GROW_V132.finish()); await page.waitForTimeout(1500)
  const fin = await page.evaluate(() => { const el = document.getElementById('growV132'), d = window.__GROW_V132.last, A = window.__GRIDIRON_AUDIT__
    const n = (k) => el.querySelector(`[data-gw-n="${k}"]`).textContent
    const rule = (c) => parseFloat(el.querySelector('.gw-rule.' + c).style.bottom)
    const zs = (h) => Math.floor(h / 12) + "'" + (h % 12) + '"'
    return { ht: n('ht'), wt: n('wt'), ms: n('ms'), wantHt: zs(d.b1.height), wantWt: d.b1.weight + ' lb', wantMs: d.b1.muscle + '%', ruleWas: rule('was'), ruleNow: rule('now'), age: el.querySelector('[data-gw-age]').textContent, wantAge: String(d.age),
      chips: [...el.querySelectorAll('.gw-tile i')].map(i => i.textContent), pillsOn: el.querySelectorAll('.gw-pill.on').length, pills: el.querySelectorAll('.gw-pill').length, go: !!el.querySelector('.gw-go.on'), finished: window.__GROW_V132.finished } })
  ok(fin.ht === fin.wantHt && fin.wt === fin.wantWt && fin.ms === fin.wantMs, 'finished, the tiles carry THIS year\'s height, weight and muscle as the sheet formats them', JSON.stringify({ ht: fin.ht, wt: fin.wt, ms: fin.ms }))
  ok(fin.age === fin.wantAge, 'and the age has landed', fin.age)
  ok(fin.ruleNow > fin.ruleWas, 'the height rule\'s NOW mark sits above last year\'s', `${fin.ruleWas}px -> ${fin.ruleNow}px`)
  ok(fin.chips.some(c => /^\+\d+"$/.test(c)) || fin.chips.some(c => /^\+\d+ lb$/.test(c)), 'the deltas are stamped on the tiles', fin.chips.join(' · '))
  ok(fin.pillsOn === fin.pills && fin.go && fin.finished, 'every pill is in and the door button is up', `${fin.pillsOn}/${fin.pills} go=${fin.go}`)
  // the door
  await page.evaluate(() => document.querySelector('#growV132 [data-gw-go]').click()); await page.waitForTimeout(700)
  const after = await page.evaluate(() => ({ el: !!document.getElementById('growV132'), open: window.__GROW_V132.open, view: window.__GRIDIRON_AUDIT__.getState().view,
    saved: (() => { try { const s = JSON.parse(localStorage.getItem('gridiron_state_v11') || localStorage.getItem(Object.keys(localStorage).find(k => /gridiron|rib/i.test(k) && /\{/.test(localStorage.getItem(k))) || 'null') || 'null'); return s && s.player ? s.player.growSeenV132 : 'no-save' } catch (e) { return 'err' } })() }))
  ok(!after.el && !after.open && after.view === 'result', 'the button hands over to the report card', JSON.stringify(after))
  await page.evaluate(() => window.render()); await page.waitForTimeout(500)
  const again = await page.evaluate(() => ({ el: !!document.getElementById('growV132'), seen: window.__GRIDIRON_AUDIT__.getState().player.growSeenV132 }))
  ok(!again.el, 'a re-render of the report card does not bring it back this season', JSON.stringify(again))
  // ---- a veteran: the same screen reads as decline
  const vet = await page.evaluate(() => { const p = window.__GRIDIRON_AUDIT__.getState().player
    p.age = 42; p.level = 7; p.seasonStats.ageProfile = null; p.seasonStats.ageChanges = { speed: { from: 70, to: 68, delta: -2 }, strength: { from: 66, to: 65, delta: -1 }, awareness: { from: 60, to: 61, delta: 1 } }
    const d = window.__GROW_V132.show({ instant: true }); const el = document.getElementById('growV132')
    return { mode: d.mode, title: el.querySelector('.gw-title').textContent, cls: el.className, red: !!el.querySelector('.gw-h.red'), neg: el.querySelectorAll('.gw-pill.neg').length, lift: el.querySelectorAll('.gw-pill.lift').length,
      stage: el.querySelector('[data-gw-stage]').textContent, chips: [...el.querySelectorAll('.gw-tile i')].map(i => i.textContent), b0: [d.b0.height, d.b0.weight], b1: [d.b1.height, d.b1.weight], note: (el.querySelector('.gw-note') || {}).textContent || '' } })
  ok(vet.mode === 'decline' && /decline/.test(vet.cls) && /YEARS ARE TALKING/.test(vet.title), 'a veteran\'s year is DECLINE — the red screen, the title', JSON.stringify({ mode: vet.mode, title: vet.title }))
  ok(vet.red && vet.neg === 2 && vet.lift === 1, 'what the years took is listed in red, one pill per attribute, and what they gave in gold', `neg=${vet.neg} lift=${vet.lift}`)
  ok(vet.b0[0] === vet.b1[0] && vet.b0[1] === vet.b1[1] && vet.chips.every(c => c === '—'), 'a grown man\'s frame does not move — the tiles say so', vet.chips.join(' · '))
  ok(/LEGENDARY|LONGEVITY/i.test(vet.stage) && vet.note.length > 20, 'the age profile\'s own name and words are on it', vet.stage)
  await page.evaluate(() => window.__GROW_V132.close())
  ok(errs.length === 0, 'no page errors', errs.join(' | ') || 'none')
  await ctx.close()
}

// ---- 2. switched off
{
  const { page, ctx, errs, view } = await toReportCard('&noGrowV132')
  ok(view === 'result', '?noGrowV132: a season was played to the report card', String(view))
  const st = await page.evaluate(() => ({ el: !!document.getElementById('growV132'), open: !!(window.__GROW_V132 && window.__GROW_V132.open) }))
  ok(!st.el && !st.open, 'and the screen stays off', JSON.stringify(st))
  ok(errs.length === 0, 'no page errors', errs.join(' | ') || 'none')
  await ctx.close()
}

console.log(JSON.stringify({ pass, fail }))
await browser.close()
process.exit(fail ? 1 : 0)
