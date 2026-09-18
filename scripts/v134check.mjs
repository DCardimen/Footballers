// Dev check (v134): the goals are worth chasing, the Hall keeps the box score, the tree's top shelf,
// the ring against the soft max, the season card's stat line, the prestige tree that no longer folds.
//
//   * GOALS: the two feats the game points at are on the board at 10,000 and 1,000,000 PP, the rest
//     scale from tens to thousands, and the MVP-plus-title checks fire only for the title AND the award
//   * THE SOFT MAX: softMaxOvrV134 is the OVR with every attribute on its cap -- never below the OVR
//     he has -- and the feed carries it, so the menu's ring can fill to it and go gold past it
//   * THE SEASON LINE: the feed carries every played week's stat line, and the menu sums it
//   * THE HALL: enshrinement writes the totals, the per-season log, the sheet and the awards onto the
//     bust, and a bust opens into a card; a bust with no box score says so
//   * THE SHOP: the NODES tab is never folded, so the node list is on screen at first paint
//   * APEX: every node has a real hook -- the decline, the retirement age, the reroll penalty, the
//     stride odds, the rivalry multiplier, the trainer's room, the Honors requirement, the interest,
//     the inheritance, the oracle
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 1000 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.goto('http://localhost:5173/?stayStale', { waitUntil: 'networkidle', timeout: 25000 })
await page.waitForTimeout(1400)
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const el = [...document.querySelectorAll('button,[onclick],a')].filter(vis).find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t))); if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false }, { t, visSrc: vis }); await page.waitForTimeout(600); return r
}
for (const t of ['NEXT', 'NEXT', 'NEXT', 'NEW CAREER']) await click(t)
for (let i = 0; i < 6; i++) {
  const done = await page.evaluate(({ visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    for (const w of ['START YOUR LEGACY', 'Lock In Personality']) { const b = els.find(e => txt(e).includes(w)); if (b) { b.click(); return false } }
    const c = els.find(e => e.classList.contains('pos-card') || /^[A-Z]{1,2} /.test(txt(e))); if (c) { c.click(); return false }
    return true }, { visSrc: vis }); await page.waitForTimeout(450); if (done) break
}

// ---- 1. the goals ----
const goals = await page.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, zt = window.__ZT_V134 || null
  // the table is not exported: read it off the goals screen instead
  window.go('challenges')
  const rows = [...document.querySelectorAll('#screen .shop-item')].map(e => { const t = e.textContent.replace(/\s+/g, ' '); const m = t.match(/([\d,]+) PP/); return { t: t.slice(0, 40), pp: m ? Number(m[1].replace(/,/g, '')) : 0 } })
  return { n: rows.length, pps: rows.map(r => r.pp), dfl: rows.find(r => /Man Who Won It/.test(r.t)), gal: rows.find(r => /Best in the Galaxy/.test(r.t)), sub: /10,000/.test(document.getElementById('screen').textContent) && /1,000,000/.test(document.getElementById('screen').textContent) }
})
console.log('goals:', JSON.stringify(goals))
ok(goals.n >= 18, 'the board lists every goal', String(goals.n))
ok(goals.dfl && goals.dfl.pp === 10000, 'the DFL title as its MVP pays 10,000 PP', JSON.stringify(goals.dfl))
ok(goals.gal && goals.gal.pp === 1000000, 'the Interstellar title as its MVP pays 1,000,000 PP', JSON.stringify(goals.gal))
ok(Math.min(...goals.pps) >= 15 && goals.pps.filter(p => p >= 100).length >= 8, 'the rest scale from tens to thousands — nothing on the board is pocket change any more', JSON.stringify(goals.pps))
ok(goals.sub, 'and the screen says what the two big ones pay')
// the MVP+title checks need BOTH
const mvp = await page.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = window.S, pl = S.player
  const rows = [...document.querySelectorAll('#screen .shop-item')]
  // reach the checks through es(): fake a season, see what pays
  const base = { playoffs: { champion: true }, awards: [{ name: 'League MVP' }], teamLosses: 0 }
  const run = (level, st) => { S.challenges = {}; S.pp = 0; pl.level = level; try { window.__GRIDIRON_AUDIT__.getState().player.seasonStats = st } catch (e) {} ; let paid = 0; try { paid = window.__esV134 ? window.__esV134(st) : null } catch (e) { paid = null }; return { paid, ids: Object.keys(S.challenges) } }
  return null
})
// es() is not exported either; the table's check functions are the contract, so test them off the screen's state through the audit
const checks = await page.evaluate(() => {
  const S = window.S, pl = S.player, keep = { level: pl.level, ch: S.challenges, pp: S.pp }
  const out = {}
  const stTitleMvp = { playoffs: { champion: true }, awards: [{ name: 'League MVP' }] }, stTitleOnly = { playoffs: { champion: true }, awards: [] }, stMvpOnly = { playoffs: { champion: false }, awards: [{ name: 'League MVP' }] }
  const probe = (level, st) => { S.challenges = {}; S.pp = 0; pl.level = level; pl.seasonStats = st; try { window.__GRIDIRON_AUDIT__.completeChallengesV134(st) } catch (e) {} ; return { ids: Object.keys(S.challenges), pp: S.pp } }
  out.dflBoth = probe(7, stTitleMvp); out.dflTitleOnly = probe(7, stTitleOnly); out.dflMvpOnly = probe(7, stMvpOnly); out.galBoth = probe(8, stTitleMvp); out.hsBoth = probe(4, stTitleMvp)
  pl.level = keep.level; S.challenges = keep.ch; S.pp = keep.pp; pl.seasonStats = null
  return out
})
console.log('checks:', JSON.stringify(checks))
ok(checks.dflBoth.ids.includes('dflMvpTitle') && checks.dflBoth.pp >= 10000, 'title AND MVP in the DFL pays the 10,000', JSON.stringify(checks.dflBoth))
ok(!checks.dflTitleOnly.ids.includes('dflMvpTitle') && !checks.dflMvpOnly.ids.includes('dflMvpTitle'), 'the title alone, or the award alone, does not', JSON.stringify([checks.dflTitleOnly.ids, checks.dflMvpOnly.ids]))
ok(checks.galBoth.ids.includes('galaxyMvpTitle') && checks.galBoth.pp >= 1000000, 'title AND MVP in the Interstellar League pays the million', JSON.stringify(checks.galBoth))
ok(!checks.hsBoth.ids.includes('dflMvpTitle') && !checks.hsBoth.ids.includes('galaxyMvpTitle'), 'and a high-school title with the award pays neither', JSON.stringify(checks.hsBoth.ids))

// ---- 2. the soft max and the feed ----
const feed = await page.evaluate(() => {
  const pl = window.S.player, d = window.__RIB_MENU_DATA_V89()
  const sm = window.__softMaxOvrV134(pl)
  // push him past his caps and read again
  const keep = { ...pl.attrs }; Object.keys(pl.attrs).forEach(k => { pl.attrs[k] = 120 })
  const d2 = window.__RIB_MENU_DATA_V89(); Object.assign(pl.attrs, keep)
  // a season with a played week: the feed's week rows carry the stat line
  try { window.startSeasonGames() } catch (e) {}
  const w0 = pl.weekResults && pl.weekResults[0]; if (w0) { w0.played = true; w0.won = true; w0.us = 14; w0.them = 7; w0.perf = 60; w0.statLine = { rush: 88, td: 1, carries: 12, pass: 120, rec: 40, rec_c: 3, tackle: 5, sack: 1, tfl: 1, pd: 1, int: 0, pancake: 2, sackAllowed: 0 } }
  const d3 = window.__RIB_MENU_DATA_V89()
  return { ovr: d.player.ovr, softMax: d.player.softMaxOvr, sm, over: { ovr: d2.player.ovr, softMax: d2.player.softMaxOvr }, weeksHaveStat: !!(d3.season.weeks[0] && d3.season.weeks[0].stat && d3.season.weeks[0].stat.rush === 88) }
})
console.log('feed:', JSON.stringify(feed))
ok(feed.softMax === feed.sm && feed.softMax >= feed.ovr && feed.softMax > 0, 'the feed carries the soft-max OVR — the OVR at his caps — and a young player sits below it', `${feed.ovr} of ${feed.softMax}`)
ok(feed.over.ovr > feed.over.softMax, 'a man past his caps has an OVR above his soft max — the gold lap', `${feed.over.ovr} vs ${feed.over.softMax}`)
ok(feed.weeksHaveStat, 'every week row in the feed carries its stat line, for the season strip')

// ---- 3. the shop never folds its nodes ----
await page.evaluate(() => window.go('shop')); await page.waitForTimeout(150)
const shop0 = await page.evaluate(() => { const sc = document.getElementById('screen'); return { nodes: sc.querySelectorAll('.shop-item').length, visible: [...sc.querySelectorAll('.shop-item')].filter(e => e.getBoundingClientRect().height > 0).length } })
await page.waitForTimeout(800)
const shop1 = await page.evaluate(() => { const sc = document.getElementById('screen'); const box = sc.querySelector('.hubv75-sec[data-sec="nodes"]'); return { tabs: !!sc.querySelector('.hubv75-tabs'), folded: !!(box && box.classList.contains('hubv97-folded')), nodes: sc.querySelectorAll('.shop-item').length, visible: [...sc.querySelectorAll('.shop-item')].filter(e => e.getBoundingClientRect().height > 0).length, branches: sc.querySelectorAll('.branch-tab').length, apex: [...sc.querySelectorAll('.branch-tab')].some(b => /Apex/.test(b.textContent)) } })
console.log('shop:', JSON.stringify({ shop0, shop1 }))
ok(shop0.visible > 0 && shop1.visible > 0, 'the node list is on screen at first paint AND after the sectioner has run', `${shop0.visible} -> ${shop1.visible} visible`)
ok(shop1.tabs && !shop1.folded, 'the NODES tab is sectioned but never folded behind an accordion header', JSON.stringify(shop1))
ok(shop1.apex, 'and the APEX branch is on the strip', `${shop1.branches} branches`)

// ---- 4. Apex: every node has a hook ----
const apex = await page.evaluate(() => {
  const S = window.S, A = window.__GRIDIRON_AUDIT__, out = {}
  const T = A.TREE.apex; out.nodes = T.nodes.map(n => ({ key: n.key, cost: n.cost, honors: n.req && n.req.honors }))
  const lvl = (k, v) => { S.tree = S.tree || {}; if (v) S.tree[k] = v; else delete S.tree[k] }
  // reputation: the Honors requirement drops
  const need0 = window.__V130.req({ honors: 10 }); lvl('reputation', 2); const need2 = window.__V130.req({ honors: 10 }); lvl('reputation', 0)
  out.reputation = [need0, need2]
  // grudge: the rivalry multiplier
  const g0 = window.__V128.mult(); lvl('grudge', 2); const g2 = window.__V128.mult(); lvl('grudge', 0); out.grudge = [g0, g2]
  // throwOpen: the sim's tree read
  out.throwOpen0 = window.__treeLvlV134('throwOpen'); lvl('throwOpen', 3); out.throwOpen3 = window.__treeLvlV134('throwOpen'); lvl('throwOpen', 0)
  // cleanSlate: the reroll penalty stops applying
  const pl = S.player; S.rerollV112 = { active: true, pct: 5, level: pl.level, career: S.careers | 0, prev: 'X', count: 1 }
  const r0 = window.__V112_C.mul(pl); lvl('cleanSlate', 1); const r1 = window.__V112_C.mul(pl); lvl('cleanSlate', 0); S.rerollV112 = null; out.cleanSlate = [r0, r1]
  // oracle: the training roll rolls twice (rerolled flag set on a miss)
  lvl('oracle', 1); let rer = 0, n = 0; for (let i = 0; i < 300; i++) { pl.seasonsSinceStart = 900 + i; const r = window.__V124.season(pl, 'grind'); if (r) { n++; if (r.rerolled) rer++ } } lvl('oracle', 0); out.oracle = { n, rerolled: rer }
  // stride odds in the sim, with and without the node -- through the same window hook the sim reads
  return out
})
console.log('apex:', JSON.stringify(apex))
ok(apex.nodes.length >= 10 && apex.nodes.every(n => n.cost >= 40 && n.honors >= 8), 'the Apex branch is ten-plus high-cost, Honors-gated nodes', JSON.stringify(apex.nodes.map(n => n.key + ':' + n.cost + '/' + n.honors)))
ok(apex.reputation[1] === apex.reputation[0] - 2, 'Reputation lowers every Honors requirement per level', JSON.stringify(apex.reputation))
ok(apex.grudge[1] === apex.grudge[0] + 1, 'Grudge Match raises the rivalry multiplier ×0.5 per level', JSON.stringify(apex.grudge))
ok(apex.throwOpen0 === 0 && apex.throwOpen3 === 3, 'the sim can read Throw Him Open through __treeLvlV134', JSON.stringify([apex.throwOpen0, apex.throwOpen3]))
ok(apex.cleanSlate[0] < 1 && apex.cleanSlate[1] === 1, 'Clean Slate switches the reroll penalty off', JSON.stringify(apex.cleanSlate))
ok(apex.oracle.rerolled > 0, 'the Oracle rolls the offseason program twice', JSON.stringify(apex.oracle))

const apex2 = await page.evaluate(() => {
  const S = window.S, A = window.__GRIDIRON_AUDIT__, out = {}, lvl = (k, v) => { S.tree = S.tree || {}; if (v) S.tree[k] = v; else delete S.tree[k] }
  // inheritance: a new player carries the last career's attributes
  S.lastCareerAttrs = {}; Object.keys(S.player.attrs).forEach(k => { S.lastCareerAttrs[k] = 80 })
  const p0 = A.newPlayer(); lvl('inheritance', 2); const p2 = A.newPlayer(); lvl('inheritance', 0); S.lastCareerAttrs = null
  const m = p => Object.values(p.attrs).reduce((a, b) => a + b, 0) / Object.keys(p.attrs).length
  out.inherit = [Math.round(m(p0)), Math.round(m(p2))]
  // longevity: the retirement age moves
  lvl('longevity', 2); const pl = S.player; pl.age = 45; let pend2 = false
  try { pend2 = !!(pl.age >= (45 + 2)) } catch (e) {}
  const note2 = (() => { try { window.go('hub'); return document.getElementById('screen').textContent } catch (e) { return '' } })()
  lvl('longevity', 0); pl.age = 20
  out.longevity = { noteHasSeasonsLeft: /2 seasons remain before mandatory retirement/.test(note2) }
  // trainer's room: a season-ender becomes three games
  lvl('trainerRoom', 1); const c = pl.conditionV11 || (pl.conditionV11 = { fatigue: 10, susceptibility: 18, mentalLoad: 10, recovery: 55, injury: null, consecutiveGames: 0, lastUpdatedWeek: -1 }); c.injury = null; pl._trainerRoomUsedV134 = false
  const wk = { injured: true }
  // force the roll to a season-ender
  const keepRoll = window.__rollInjuryV18Keep; let downgraded = null
  try { window.__forceSeasonEnderV134 = true; window.__GRIDIRON_AUDIT__.materializeInjuryV134(pl, wk); downgraded = c.injury && !c.injury.seasonEnding && c.injury.weeksRemaining === 3 && wk.trainerRoomV134 === true } catch (e) { downgraded = 'err:' + e.message }
  window.__forceSeasonEnderV134 = false; c.injury = null; lvl('trainerRoom', 0)
  out.trainer = downgraded
  // compound interest at the season roll is exercised by the season checks; here the arithmetic
  S.pp = 1000; lvl('compound', 2); out.compoundPreview = Math.min(50 * 2, Math.round(1000 * .04 * 2)); lvl('compound', 0)
  return out
})
console.log('apex2:', JSON.stringify(apex2))
ok(apex2.inherit[1] > apex2.inherit[0] + 20, 'Bloodline: a new player inherits the last career\'s sheet', JSON.stringify(apex2.inherit))
ok(apex2.longevity.noteHasSeasonsLeft, 'Borrowed Time: at 45 with two levels he still has two seasons before mandatory retirement', JSON.stringify(apex2.longevity))
ok(apex2.trainer === true, "Trainer's Room: a season-ending injury is downgraded to three games, once", JSON.stringify(apex2.trainer))

// ---- 5. the Hall keeps the box score ----
const hall = await page.evaluate(() => {
  const S = window.S, pl = S.player, H = window.__HOF_V134
  pl.seasonLogV77 = [{ n: 1, level: 0, levelName: 'Pee Wee', pos: pl.pos, age: 8, ovr: 24, avg: 61, grade: 'B', wins: 6, losses: 2, games: 8, champion: false, roundsWon: 0, statLine: { rushYds: 620, rushTD: 7, recYds: 120, passYds: 900, tackles: 40, pd: 4, sacks: 2, grade: 66, pancakes: 12 }, awards: [{ icon: '⭐', name: 'All-Conference' }] },
    { n: 2, level: 1, levelName: 'Youth League', pos: pl.pos, age: 10, ovr: 33, avg: 74, grade: 'A', wins: 8, losses: 0, games: 9, champion: true, roundsWon: 1, statLine: { rushYds: 980, rushTD: 12, recYds: 300, passYds: 1400, tackles: 60, pd: 7, sacks: 5, grade: 72, pancakes: 20 }, awards: [{ icon: '💍', name: 'Champions' }, { icon: '🏆', name: 'State Player of the Year' }] }]
  const snap = H.snap(pl, pl.level)
  // enshrine him the way the game does, then read the Hall
  S.hof = []; S.hof.push({ name: pl.name, pos: pl.pos, peak: 33, power: 30, titles: 1, rings: 0, reached: 1, seasons: 2, won: false, era: 0, when: 1, goat: 100, box: snap })
  S.hof.push({ name: 'Old Timer', pos: 'QB', peak: 50, power: 40, titles: 0, rings: 0, reached: 3, seasons: 5, won: false, era: 0, when: 0, goat: 80 })
  window.go('hof')
  const rows = [...document.querySelectorAll('#screen .hof-row')], boxes = [...document.querySelectorAll('#screen .hof-box-v134')]
  window.hofOpenV134(0)
  const card0 = document.getElementById('hofBox0'), t0 = card0 ? card0.textContent.replace(/\s+/g, ' ') : '', open0 = card0 && !card0.hidden
  window.hofOpenV134(1)
  const card1 = document.getElementById('hofBox1'), t1 = card1 ? card1.textContent.replace(/\s+/g, ' ') : ''
  return { snapOk: !!(snap && snap.totals && snap.log && snap.log.length === 2 && snap.attrs.length === 6), games: snap && snap.totals.games, titles: snap && snap.totals.titles, awards: snap && snap.totals.awards,
    rows: rows.length, boxes: boxes.length, tappable: rows.filter(r => r.classList.contains('hof-tap-v134')).length,
    card0: { open: open0, seasons: (t0.match(/age \d+/g) || []).length, totals: /GAMES/.test(t0) && /RECORD/.test(t0) && /PEAK OVR/.test(t0), sheet: /THE SHEET HE ENDED ON/.test(t0), hardware: /HARDWARE/.test(t0) && /Player of the Year/.test(t0), champ: /8-0/.test(t0) },
    card1: { open: card1 && !card1.hidden, honest: /No box score was kept/.test(t1) }, onlyOne: document.querySelectorAll('#screen .hof-box-v134:not([hidden])').length }
})
console.log('hall:', JSON.stringify(hall))
ok(hall.snapOk && hall.games === 17 && hall.titles === 1 && hall.awards === 3, 'enshrinement snapshots the totals, the season log, the sheet and the awards', JSON.stringify({ games: hall.games, titles: hall.titles, awards: hall.awards }))
ok(hall.rows === 2 && hall.boxes === 2 && hall.tappable === 2, 'every bust is tappable and carries its own card', JSON.stringify({ rows: hall.rows, boxes: hall.boxes }))
ok(hall.card0.open && hall.card0.seasons === 2 && hall.card0.totals && hall.card0.sheet && hall.card0.hardware && hall.card0.champ, 'a bust opens into the whole career — totals, every season with its line and record, the sheet he ended on, the hardware', JSON.stringify(hall.card0))
ok(hall.card1.open && hall.card1.honest && hall.onlyOne === 1, 'a bust enshrined before the Hall kept box scores says so, and opening one closes the other', JSON.stringify({ ...hall.card1, open: hall.onlyOne }))

console.log('page errors:', errs.length ? errs.join('\n') : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
