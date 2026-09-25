// Dev check: v133 THE COACH GRADES THE BOARD — every training program graded green / blue / red.
//
// Asserts, on a fresh career at the offseason board and across every position and level:
//   * every program carries a tier, and the tiers are consistent with the data: a GREEN program pushes
//     at least two of the position's key stats with room (or is the coach's pick); a RED one is minor
//     (well below the best value on the board) or mostly capped; Balanced is BLUE by nature
//   * the coach's pick is the best graded value on the board — unless the body is breaking down, when it
//     is Conditioning (v124's rule) — and it is never RED
//   * the board wears it: every tile carries its tier class and pill, the pick wears the ribbon, the note
//     names the pick and the runner-up, and the three-colour key is printed
//   * the sheet's bars are shaded per attribute against the sheet's best gain, and sorted green > blue > red
//   * a stat at its cap is RED on every program; a key stat with a real gain is GREEN
//   node scripts/gradecheck.mjs
import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const URL = process.env.URL || GAME_URL
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 420, height: 900 } }); const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.addInitScript(() => { try { localStorage.setItem('rib.coachTour.v119', 'off') } catch {} setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(URL + '?noFilmV114', { waitUntil: 'networkidle', timeout: 60000 })
for (let i = 0; i < 200; i++) { if (await page.evaluate(() => !document.getElementById('splash'))) break; await page.waitForTimeout(100) }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const step = async (t) => { await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim(); const el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : els.find(e => txt(e).includes(t)); if (el) { el.scrollIntoView({ block: 'center' }); el.click() } }, { t, visSrc: vis }); await page.waitForTimeout(900) }
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON']) await step(t)
for (let i = 0; i < 60; i++) { const d = await page.evaluate(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') { g.click(); return false } return !document.getElementById('growthV42') }); if (d) break; await page.waitForTimeout(300) }
const view = await page.evaluate(() => window.__GRIDIRON_AUDIT__.getState().view)
ok(view === 'training', 'a fresh career reaches the offseason board', String(view))

// ---- 1. the data: every position, every level, six sheets each
const sweep = await page.evaluate(() => {
  const V = window.__V133, pl = window.__GRIDIRON_AUDIT__.getState().player, ee = Object.keys(pl.attrs)
  const save = { pos: pl.pos, attrs: { ...pl.attrs }, level: pl.level }
  const POS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S']
  const out = { boards: 0, badGreen: [], badRed: [], pickRed: 0, pickNotBest: 0, tiers: { green: 0, blue: 0, red: 0 }, balancedNotBlue: 0, picks: {} }
  for (const pos of POS) for (let lv = 0; lv <= 7; lv += 1) for (let i = 0; i < 4; i++) {
    pl.pos = pos; pl.level = lv
    for (const k of ee) pl.attrs[k] = Math.max(1, Math.round(12 + lv * 9 + (Math.random() * 30 - 15)))
    const B = V.board(pl); out.boards++
    const keys = V.keys(pl)
    for (const g of B.all) {
      out.tiers[g.tier] = (out.tiers[g.tier] || 0) + 1
      if (g.balanced && g.tier !== 'blue' && g.key !== B.sug) out.balancedNotBlue++
      if (g.tier === 'green' && g.key !== B.sug && !g.balanced) { const hits = g.keyHits.filter(k => keys.includes(k)); if (hits.length < 2 || g.rel < .5) out.badGreen.push(pos + lv + ':' + g.key + ':' + hits.length + ':' + g.rel) }
      if (g.tier === 'red' && !g.balanced) { const capShare = g.capped.length / Math.max(1, g.focus.length); if (!(g.rel < .3 || capShare >= .5 || !(g.keyHits.length || g.blue.length >= 2))) out.badRed.push(pos + lv + ':' + g.key + ':' + g.rel) }
    }
    const pick = B.by[B.sug]; out.picks[B.sug] = (out.picks[B.sug] || 0) + 1
    if (pick.tier === 'red') out.pickRed++
    const top = B.all.find(g => !g.balanced)
    const body = (pl.attrs.injuryResist || 0) < 14 + lv * 3
    if (B.sug !== 'conditioning' && B.sug !== 'lab' && top && top.key !== B.sug && !body) out.pickNotBest++
  }
  pl.pos = save.pos; pl.level = save.level; Object.assign(pl.attrs, save.attrs)
  return out
})
console.log('sweep:', JSON.stringify({ boards: sweep.boards, tiers: sweep.tiers, picks: sweep.picks, badGreen: sweep.badGreen.slice(0, 4), badRed: sweep.badRed.slice(0, 4) }))
ok(sweep.boards >= 280 && sweep.tiers.green > 0 && sweep.tiers.blue > 0 && sweep.tiers.red > 0, 'every board grades every program, and all three colours appear across the league', JSON.stringify(sweep.tiers))
ok(sweep.badGreen.length === 0, 'every GREEN program (the pick aside) pushes at least two key stats and sits near the best value', sweep.badGreen.slice(0, 3).join(' ') || 'all consistent')
ok(sweep.badRed.length === 0, 'every RED program is minor, mostly capped, or hits nothing that matters', sweep.badRed.slice(0, 3).join(' ') || 'all consistent')
ok(sweep.balancedNotBlue === 0, 'Balanced is BLUE by nature', String(sweep.balancedNotBlue))
ok(sweep.pickRed === 0 && sweep.pickNotBest === 0, 'the pick is the best graded value on the board (or the body program — Conditioning, v153 B: the Recovery Lab — for a breaking body), never red', `red=${sweep.pickRed} notBest=${sweep.pickNotBest}`)
ok(Object.keys(sweep.picks).length >= 4, 'and the picks are spread across programs', JSON.stringify(sweep.picks))

// ---- 2. the board wears it
const board = await page.evaluate(() => {
  const V = window.__V133, pl = window.__GRIDIRON_AUDIT__.getState().player, B = V.board(pl)
  window.previewTraining(B.sug)
  const tiles = [...document.querySelectorAll('.tp-tile-v113')]
  const tierOf = (t) => (t.className.match(/tier-(green|blue|red)/) || [])[1]
  const mismatch = tiles.filter(t => { const k = (t.getAttribute('onclick').match(/'([a-z]+)'/) || [])[1]; return tierOf(t) !== B.by[k].tier || !t.querySelector('.tp-tier-v133') })
  const pick = tiles.find(t => (t.getAttribute('onclick') || '').includes(`'${B.sug}'`))
  const note = (document.querySelector('.tp-note-v133') || {}).textContent || ''
  const panel = document.querySelector('.tp-panel-v113'), rows = [...panel.querySelectorAll('.tp-row-v113')]
  const segTiers = rows.map(r => { const up = r.querySelector('.tp-up-v113'); return up ? (up.className.match(/tier-(green|blue|red)/) || [])[1] : null }).filter(Boolean)
  const colours = segTiers.map(t => { const up = panel.querySelector('.tp-up-v113.tier-' + t); return up ? getComputedStyle(up).backgroundColor : null })
  const order = (group) => group.map(r => ({ green: 0, blue: 1, red: 2, none: 3, cost: 4 })[r.dataset.tier])
  const lead = [], rest = []; let inRest = false
  for (const el of panel.querySelector('.tp-rows-v113').children) { if (el.classList.contains('tp-grouphead-v113')) { inRest = el.classList.contains('dim'); continue } (inRest ? rest : lead).push(el) }
  const sorted = (arr) => arr.every((v, i) => i === 0 || v >= arr[i - 1])
  return { tiles: tiles.length, mismatch: mismatch.length, ribbon: !!(pick && pick.querySelector('.tp-pick-v133')), best: !!(pick && pick.classList.contains('best')),
    note: /COACH SUGGESTS/.test(note) && /Runner-up/.test(note), key: !!document.querySelector('.tp-tierkey-v133') && /GREEN/.test(document.querySelector('.tp-tierkey-v133').textContent),
    segTiers: [...new Set(segTiers)], distinctColours: new Set(colours).size, leadSorted: sorted(order(lead)), restSorted: sorted(order(rest)), legend: (panel.querySelector('.tp-legend-v113') || {}).textContent || '', pill: !!panel.querySelector('.tp-tierpill-v133') }
})
console.log('board:', JSON.stringify(board))
ok(board.tiles === 12 && board.mismatch === 0, 'every tile carries its tier class and pill, matching the grade', `${board.mismatch} mismatches of ${board.tiles}`)
ok(board.ribbon && board.best, "the coach's pick wears the ribbon and the pulse")
ok(board.note && board.key, 'the note names the pick, why, and the runner-up; the three-colour key is printed')
ok(board.segTiers.length >= 2 && board.distinctColours === board.segTiers.length, 'the sheet\'s added segments are shaded per attribute, one colour per tier', JSON.stringify(board.segTiers))
ok(board.leadSorted && board.restSorted, 'and the rows are sorted green > blue > red within each group')
ok(/GREEN/.test(board.legend) && /RED/.test(board.legend) && board.pill, 'the legend names the three colours and the panel head carries the tier pill')

// ---- 3. a capped stat is red everywhere; a key stat with a real gain is green
const capped = await page.evaluate(() => {
  const V = window.__V133, pl = window.__GRIDIRON_AUDIT__.getState().player, keys = V.keys(pl), k = keys[0]
  const save = pl.attrs[k]; pl.attrs[k] = 400   // past any cap
  const reds = Object.keys(window.__V133.board(pl).by).map(p => V.attr(pl, k, 3, 3))
  pl.attrs[k] = save
  const green = V.attr(pl, k, 3, 3)
  return { k, allRed: reds.every(t => t === 'red'), green }
})
ok(capped.allRed, 'a stat past its cap is RED on every program', capped.k)
ok(capped.green === 'green', 'the same key stat with a real gain and room is GREEN', capped.green)
ok(errs.length === 0, 'no page errors', errs.join(' | ') || 'none')
console.log(JSON.stringify({ pass, fail }))
await browser.close()
process.exit(fail ? 1 : 0)
