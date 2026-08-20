// Dev check: the post-game card (v13 `pgOverlayV13`, reordered in v53).
//   - SEASON TOTALS leads the card: what a player wants after a whistle is where
//     the year stands, with the single-game box as detail underneath
//   - the season line states how many games it covers and the record
//   - THIS game is included in that record: the week is only finalised AFTER the
//     card is dismissed, so its result has to come off the live scoreboard
//   - and it is counted exactly once — a second game must read "through 2 games"
// node scripts/postgamecheck.mjs   (needs `npm run dev` on :5173)
import { chromium } from 'playwright'

const fails = []
const ok = (c, label, detail) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${label}${detail ? '  ' + detail : ''}`); if (!c) fails.push(label) }

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport: { width: 520, height: 1100 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1200)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t === 'ARCH') el = els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
    else el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click() }
  }, { t, visSrc: vis })
  await page.waitForTimeout(650)
}
const tap = async (text, ms = 4000) => { try { await page.locator('button', { hasText: text }).first().click({ timeout: ms }); return true } catch (e) { return false } }
const clearWheel = async () => { for (let i = 0; i < 50; i++) { const d = await page.evaluate(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') { g.click(); return true } if (window.continuePregameV1513 && document.getElementById('pregameV1513')) { window.continuePregameV1513(); return false } return !document.getElementById('growthV42') }); if (d) break; await page.waitForTimeout(300) } }

for (const s of ['START NEW CAREER', 'ARCH', 'QB Quarterback', 'Lock In Personality', 'PLAY 8-GAME SEASON']) await click(s)
await clearWheel()
await click('Balanced Program')

// The quick sim bypasses this card entirely, so every week here is played LIVE
// and skipped to the whistle.
const dumpBtns = async (tag) => { if (!process.env.PG_DEBUG) return; console.log(tag, JSON.stringify(await page.evaluate(visSrc => {
  const vis = eval(visSrc)
  return [...document.querySelectorAll('button,[onclick],a')].filter(vis).map(e => (e.innerText||'').replace(/\s+/g,' ').trim().slice(0,28)).filter(Boolean).slice(0,16)
}, vis))) }
async function playLiveWeek(n) {
  await dumpBtns('  [before wk' + n + ']')
  const got = await tap('PLAY WEEK ' + n + ' LIVE')
  if (process.env.PG_DEBUG) console.log('  [tap PLAY WEEK ' + n + ' LIVE] ->', got)
  // One polling loop rather than fixed waits: the strategy chooser, the pregame
  // wheel and the players-to-watch panel each appear on their own schedule, and a
  // timed tap races whichever is slowest. Keep clearing whatever is in front of us
  // until the post-game card shows up.
  // a live game can run long even with SKIP, so give it a generous budget
  for (let i = 0; i < 200; i++) {
    if (await page.evaluate(() => !!document.getElementById('pgOverlayV13'))) return true
    const stage = await page.evaluate(() => {
      if (document.getElementById('growthV42')) {
        const g = document.getElementById('gv42go')
        return g && g.style.display !== 'none' ? (g.click(), 'wheel-continue') : 'wheel-spinning'
      }
      if (document.getElementById('pregameV1513')) { window.continuePregameV1513 && window.continuePregameV1513(); return 'players-to-watch' }
      return null
    })
    if (!stage) {
      if (await tap('CONTINUE TO MATCH', 700)) { await page.waitForTimeout(400); continue }
      if (await tap('SKIP', 700)) { await page.waitForTimeout(400); continue }
    }
    await page.waitForTimeout(400)
  }
  await dumpBtns('  [stuck wk' + n + ']')
  if (process.env.PG_DEBUG) console.log('  [state]', JSON.stringify(await page.evaluate(() => {
    const st = window.__GRIDIRON_AUDIT__?.getState?.() || window.o
    return { view: st.view, scene: !!window.__gridironScene, wheel: !!document.getElementById('growthV42'),
      played: (st.player.weekResults||[]).filter(w=>w&&w.played).length, week: st.player.currentWeek }
  })))
  return false
}
const readCard = () => page.evaluate(() => {
  const el = document.getElementById('pgOverlayV13'); if (!el) return null
  const panel = el.querySelector('.decision-panel')
  const labels = [...panel.children].map(c => (c.innerText || '').replace(/\s+/g, ' ').trim())
  const idx = re => labels.findIndex(t => re.test(t))
  const season = labels.find(t => /SEASON TOTALS/.test(t)) || ''
  const m = season.match(/through (\d+) game s? ?·? ?(\d+)–(\d+)/) || season.match(/through (\d+) games? · (\d+)–(\d+)/)
  const title = labels.find(t => /WIN|LOSS|TIE/.test(t)) || ''
  const sc = title.match(/(\d+)\s*–\s*(\d+)/)
  return {
    iSeason: idx(/SEASON TOTALS/), iGrade: idx(/GAME GRADE/), iThis: idx(/^THIS GAME/),
    games: m ? +m[1] : null, w: m ? +m[2] : null, l: m ? +m[3] : null,
    win: /WIN/.test(title), us: sc ? +sc[1] : null, them: sc ? +sc[2] : null,
    seasonLabel: season.slice(0, 70),
  }
})

// ---- week 1 --------------------------------------------------------------
ok(await playLiveWeek(1), 'a live game reaches the post-game card')
let c1 = await readCard()
console.log('card 1:', JSON.stringify(c1))
if (!c1) { console.log('VERDICT: FAIL (no card)'); await b.close(); process.exit(1) }
await page.screenshot({ path: 'scripts/_postgame.png' })
ok(c1.iSeason >= 0, 'the card carries a SEASON TOTALS block')
ok(c1.iSeason < c1.iThis, 'SEASON TOTALS leads the single-game box', `season@${c1.iSeason} thisGame@${c1.iThis}`)
ok(c1.iSeason < c1.iGrade, 'SEASON TOTALS leads the game grade', `season@${c1.iSeason} grade@${c1.iGrade}`)
ok(c1.games === 1, 'the season line says how many games it covers', c1.seasonLabel)
// the week is only finalised after the card is dismissed, so this game has to be
// counted off the live scoreboard or a win shows up as 0-1
ok(c1.win ? c1.w === 1 && c1.l === 0 : c1.w === 0 && c1.l === 1,
  'this game is already in the record on its own card', `${c1.us}-${c1.them} -> ${c1.w}–${c1.l}`)

// ---- week 2: counted once, not twice ------------------------------------
await page.evaluate(() => window.__pgContinueV13 && window.__pgContinueV13())
await page.waitForTimeout(1200)
await clearWheel()
ok(await playLiveWeek(2), 'a second live game reaches the post-game card')
const c2 = await readCard()
console.log('card 2:', JSON.stringify(c2))
if (c2) {
  ok(c2.games === 2, 'the second game reads through 2 games — counted once, not twice', c2.seasonLabel)
  ok(c2.w + c2.l === 2, 'the record totals the games played', `${c2.w}–${c2.l}`)
  ok(c2.iSeason < c2.iThis && c2.iSeason < c2.iGrade, 'the order holds on the second card')
}

console.log('page errors:', errs.length ? '\n' + errs.slice(0, 10).join('\n') : 'NONE')
console.log('VERDICT:', fails.length || errs.length ? 'FAIL ' + JSON.stringify(fails) : 'PASS')
if (fails.length || errs.length) process.exitCode = 1
await b.close()
