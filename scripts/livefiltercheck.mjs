// Dev check (v141 "MY PLAYS ONLY" WAS HIDING THE WHOLE GAME).
//
// `involved` is STAT TRUTH — true only where the play NAMES the you-player as the actor. The
// renderer gates "that man is YOU" on it and creditcheck enforces it, so it has to stay that narrow.
//
// The broadcast's filter read that same flag. Measured over full games, `involved` is true on 0.7%
// to 7.5% of snaps — a level-4 WR got 0 of 125 — so switching on MY PLAYS ONLY, which promised
// "jump straight to plays you're personally involved in", hid every play, ran the index to the end
// and dropped you on the post-game card. The whole live game, skipped, with nothing said.
//
// Asserts: `involved` stays narrow (it is still the stat-truth flag, not widened); MY PLAYS ONLY
// now keeps the snaps his unit is on the field for; SKIP OPPONENT DRIVES still means what it says;
// and NO combination of the two — including the contradictory one a defender can pick — leaves a
// game with less than a game in it.
//
//   node scripts/livefiltercheck.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
const url = process.env.GAME_URL || 'http://localhost:5173/index.html'
const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errs = []
page.on('pageerror', e => errs.push(e.message || String(e)))
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
await page.goto(url + (url.includes('?') ? '&' : '?') + 'stayStale', { waitUntil: 'networkidle', timeout: 40000 })
await page.waitForTimeout(2500)

ok(await page.evaluate(() => !!(window.__V141 && window.__V141.your && window.__V141.filter)), 'window.__V141 is mounted')

const CASES = [[1, 'RB'], [4, 'RB'], [4, 'WR'], [4, 'TE'], [4, 'LB'], [4, 'CB'], [7, 'QB'], [7, 'CB'], [7, 'DL'], [8, 'WR']]
const rows = await page.evaluate((cases) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.getState(), sim = window.__simGameV2, V = window.__V141, out = []
  for (const [lvl, pos] of cases) {
    const pl = A.newPlayer(); pl.pos = pos; pl.level = lvl; S.player = pl
    const g = sim(55, pos), plays = g.plays || []
    const snaps = plays.filter(x => x && !x.header && x.event !== 'drive')
    const row = { lvl, pos, snaps: snaps.length, involved: snaps.filter(x => x.involved).length }
    for (const mode of ['off', 'onlyInvolved', 'skipOpp', 'both']) {
      S.settings = S.settings || {}
      S.settings.onlyInvolved = mode === 'onlyInvolved' || mode === 'both'
      S.settings.skipOpp = mode === 'skipOpp' || mode === 'both'
      S._liveFilterOffV141 = !V.filter(g)
      row[mode] = snaps.reduce((n, x) => n + (V.vl(x) ? 0 : 1), 0)
      if (mode === 'both') row.stoodDown = !!S._liveFilterOffV141
    }
    S.settings.onlyInvolved = false; S.settings.skipOpp = false; S._liveFilterOffV141 = false
    out.push(row)
  }
  return out
}, CASES)
for (const r of rows) console.log('  ', JSON.stringify(r))

ok(rows.every(r => r.off === r.snaps), 'with both switches off the broadcast shows every snap', `${rows.length} games`)
// the bug, stated as the assertion that would have caught it
const starved = rows.filter(r => r.onlyInvolved < 12)
ok(!starved.length, 'MY PLAYS ONLY leaves a real game — his unit\'s snaps, not just the handful the box score names him on', starved.length ? JSON.stringify(starved) : rows.map(r => `${r.pos}${r.lvl}:${r.onlyInvolved}/${r.snaps}`).join(' '))
const wide = rows.filter(r => r.onlyInvolved >= r.involved + 8)
ok(wide.length === rows.length, '…and it is WIDER than the stat-truth flag in every game (that is the whole bug)', `${wide.length}/${rows.length}`)
// no combination can empty a game
const empty = rows.filter(r => Math.min(r.onlyInvolved, r.skipOpp, r.both) < 8)
ok(!empty.length, 'no combination of the two switches can leave a game with less than a game in it', empty.length ? JSON.stringify(empty) : 'all four modes, every game')
// and the stat-truth flag was NOT widened
ok(rows.every(r => r.involved <= r.snaps * 0.25), '`involved` itself is untouched — still the narrow stat-truth flag the renderer and creditcheck read', rows.map(r => `${r.involved}/${r.snaps}`).join(' '))
const src = await page.evaluate(() => fetch(location.pathname + location.search).then(r => r.text()))
ok(/involved:me,big:/.test(src) && /function yourPlayV141/.test(src) && /liveFilterMinV141/.test(src), 'the stat row still carries `involved: me`, and the presentation flag is its own function on a TU dial')

console.log('page errors:', errs.length ? errs.join('\n') : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
