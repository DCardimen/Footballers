// Dev check: v172 THE BIG BOARD (src/05-field-renderer.js). On a live game at phone size (400x860) and desktop (1280x800):
//   - the stadium's screen hangs at the top centre of the broadcast frame on (nearly) every sample of the live game —
//     whatever the follow camera does — fully on the canvas, at a readable CSS size, BEHIND the men (its depth is
//     between the crowd and the players), and the bowl's own screen (frame + feed camera) stands down while it hangs
//   - between moments it is the scoreboard (the two teams, the score, the clock, the down)
//   - a TOUCHDOWN, a TURNOVER (an interception at the whistle, through `badgesWhistleV95`) and a BIG PLAY (+25 at the
//     whistle) each take the board over: mode "event", the title and the yards on it, the panel in the right team's
//     colour, the board grown; it is still up 2.5 s later; a weaker moment does not cut a stronger one (it goes to the
//     ticker); a stronger one replaces it with the v95 promotion (INTERCEPTED → TOUCHDOWN = PICK SIX)
//   - a big moment stays up into the next snap (`bigBoardSnapV172`); live: one fired at the whistle is still up 1.5 s
//     after the next play starts
//   - a short line (a result) takes the panel and then rides the ticker
//   - TU v172jumbo 0: the board is gone, the bowl's screen is back and a line goes the v164 F way; no page errors
//   node scripts/jumbocheck.mjs        (GAME_URL=http://localhost:5173/)    SHOTS=1 writes scripts/_jumbo_*.png
import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'
import { waitLive } from './lib/live.mjs'
const browser = await chromium.launch({ executablePath: CHROME })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const info = (m, d) => console.log('info ' + m + (d !== undefined ? '  ' + JSON.stringify(d) : ''))
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const page = await browser.newPage({ viewport: { width: 400, height: 860 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => {
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { dayNightV144: 0, wxV144: 0, speedGateV151A: 0, v172jumbo: 1 })   // v175: the hung board is off by default — this check measures it switched on
  // the onboarding card and the season-commitment gate would stand over the field: clear them
  setInterval(() => { document.querySelector('.onboard')?.remove(); const g = document.getElementById('gv42go'); if (g) g.click() }, 250)
})
await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(1200)
await page.waitForFunction(() => typeof window.__simGameV2 === 'function', null, { timeout: 60000 })
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) {
  await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    const el = t === 'POS' ? (els.find(e => /^WR\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t)); if (el) { el.scrollIntoView({ block: 'center' }); el.click() } }, { t, visSrc: vis }).catch(() => {})
  await page.waitForTimeout(t === 'PLAN' ? 4000 : 900)
}
const live = await waitLive(page, 90000)
ok(live, 'the live field is up')
await page.waitForFunction(() => window.__V92 && window.__V92.on && window.__gridironScene.markers.length >= 20 && window.__V172 && window.__V172.state, null, { timeout: 60000 }).catch(() => {})
const shot = async (n) => { if (process.env.SHOTS) await page.screenshot({ path: `scripts/_jumbo_${n}.png` }) }
const st = () => page.evaluate(() => window.__V172 && window.__V172.state ? window.__V172.state() : null)

// ---- the board is in the frame, across the live game
async function sample (label, n, gap) {
  const S = []
  for (let i = 0; i < n; i++) {
    S.push(await page.evaluate(() => { const sc = window.__gridironScene, s = window.__V172.state(), cm = sc.cameras.main
      const men = sc.markers.filter(m => m && m.root && m.root.visible).map(m => m.root.depth)
      return Object.assign(s, { zoom: +cm.zoom.toFixed(2), wvY: Math.round(cm.worldView.y), menMin: men.length ? Math.min(...men) : null, bowlTop: sc.stadium && sc.stadium.rect ? Math.round(sc.stadium.rect.y) : null }) }))
    await page.waitForTimeout(gap)
  }
  const good = S.filter(s => s.up && s.visible && s.alpha > 0.5 && s.onCanvas)
  const zooms = [...new Set(S.map(s => s.zoom))]
  // the old screen: how often its panel would have been fully inside the picture (for the record)
  const bowlIn = S.filter(s => s.bowlTop != null && s.bowlTop >= s.wvY).length
  const bad = S.filter(s => !good.includes(s)).map(s => ({ up: s.up, visible: s.visible, alpha: s.alpha, onCanvas: s.onCanvas, rect: s.rect && { x: Math.round(s.rect.x), w: Math.round(s.rect.w), h: Math.round(s.rect.h) }, mode: s.mode }))
  ok(good.length >= Math.ceil(n * 0.9), `${label}: the big board is on the canvas, fully, on ${good.length}/${n} samples of the live game (camera zooms ${zooms.slice(0, 6).join(', ')}${zooms.length > 6 ? '…' : ''})`, { bowlPanelWasInFrame: `${bowlIn}/${n}`, missed: bad.slice(0, 3) })
  const css = S.map(s => s.css && s.css.w).filter(Boolean)
  ok(css.length && Math.min(...css) >= 150, `${label}: at a readable size (CSS width ${Math.min(...css)}–${Math.max(...css)} px)`)
  const d = S.find(s => s.menMin != null)
  ok(d && d.depth > 3.45 && d.depth < d.menMin, `${label}: hung BEHIND the men (depth ${d && d.depth} between the crowd 3.45 and the nearest man ${d && d.menMin && d.menMin.toFixed(2)})`)
  ok(S.every(s => !s.bowl.frame && !s.bowl.cam), `${label}: the bowl's own screen and its feed camera stand down while it hangs`, S.filter(s => s.bowl.frame || s.bowl.cam).length)
  return S
}
const S1 = await sample('phone 400x860', 20, 800)
const sc0 = S1.find(s => s.mode === 'score' && s.score)
ok(sc0 && /\d/.test(sc0.score.us) && /\d/.test(sc0.score.them) && sc0.score.clock && sc0.score.down, 'between moments it is the scoreboard (the teams, the score, the clock, the down)', sc0 && sc0.score)
await shot('idle')

// ---- a touchdown takes it over
await page.evaluate(() => window.__V172.clear())
const td = await page.evaluate(async () => { const sc = window.__gridironScene
  const t0 = Date.now(), r = window.__BADGE_V95.show('touchdown', { sub: '42 YARDS', scene: sc, token: 'jchk:td:' + Date.now(), force: true })
  const until = async (ms) => { while (Date.now() < t0 + ms) await new Promise(r => setTimeout(r, 30)) }
  // the board grows over a few frames (frames come slowly on a loaded box): wait for it, up to 2 s
  await until(450); let a = window.__V172.state()
  while (a.grow < 1.1 && Date.now() < t0 + 2000) { await new Promise(r => setTimeout(r, 40)); a = window.__V172.state() }
  await until(2500); const b = Object.assign(window.__V172.state(), { since: Date.now() - t0 })
  return { r, a, b } })
console.log('td:', JSON.stringify({ a: { mode: td.a.mode, title: td.a.title, sub: td.a.sub, grow: td.a.grow, ev: td.a.ev }, b: { mode: td.b.mode, left: td.b.ev && td.b.ev.left } }))
ok(td.r && td.a.mode === 'event' && td.a.title === 'TOUCHDOWN!' && /42 YARDS/.test(td.a.sub || '') && td.a.grow > 1.1 && td.a.onCanvas, 'a TOUCHDOWN takes the board over: the title, the yards, the board grown — still on the canvas', { title: td.a.title, sub: td.a.sub, grow: td.a.grow, onCanvas: td.a.onCanvas })
ok(td.b.ev && td.b.ev.kind === 'touchdown' && td.b.ev.left > 0 && td.b.ev.left + td.b.since >= 4400, 'and it is still up 2.5 s later, held for 4.5 s in all (long enough to read)', { since: td.b.since, left: td.b.ev && td.b.ev.left, mode: td.b.mode })
await shot('td')
// a weaker moment does not cut it: it rides the ticker
const weak = await page.evaluate(async () => { const sc = window.__gridironScene; window.__V172.clear()
  window.__BADGE_V95.show('touchdown', { sub: '9 YARDS', scene: sc, token: 'jchk:td2:' + Date.now(), force: true })
  window.__BADGE_V95.show('bigplay', { sub: '+21 YARDS', scene: sc, token: 'jchk:weak:' + Date.now(), force: true }); await new Promise(r => setTimeout(r, 120)); return window.__V172.state() })
ok(weak.mode === 'event' && weak.title === 'TOUCHDOWN!' && /BIG PLAY/.test(weak.tick || ''), 'a weaker moment (BIG PLAY) does not cut the TOUCHDOWN — it rides the ticker', { title: weak.title, tick: weak.tick })

// ---- a turnover: an interception at the whistle, through the renderer's own whistle badges
await page.evaluate(() => window.__V172.clear())
const to = await page.evaluate(async () => { const sc = window.__gridironScene
  const told = sc.badgesWhistleV95({ payload: { event: 'pass', yards: 0, offense: 'us', desc: 'Deep shot — INTERCEPTED by Moss at the 30.' }, __ballTokenV1514: 'jchk:int:' + Date.now(), carrierId: null })
  await new Promise(r => setTimeout(r, 450)); const pay = (sc.play && sc.play.payload) || sc._payV172 || {}
  return { told, s: window.__V172.state(), def: pay.offense === 'us' ? 'them' : 'us' } })
console.log('turnover:', JSON.stringify({ told: to.told, mode: to.s.mode, title: to.s.title, sub: to.s.sub, ev: to.s.ev, pal: to.s.pal }))
ok(to.told && to.s.mode === 'event' && to.s.title === 'TURNOVER!' && /INTERCEPTION/.test(to.s.sub || ''), 'an INTERCEPTION at the whistle puts TURNOVER! · INTERCEPTION on the board', { title: to.s.title, sub: to.s.sub })
ok(to.s.ev && to.s.ev.side === to.def && to.s.pal && to.s.ev.col === to.s.pal[to.def], 'in the colours of the team that took it (the defense on the field)', { side: to.s.ev && to.s.ev.side, def: to.def, col: to.s.ev && to.s.ev.col, pal: to.s.pal })
await shot('turnover')

// ---- a big play at the whistle (after the v95 badge's own repeat guard: the BIG PLAY above was 2.5 s ago at most)
await page.waitForTimeout(2700)
await page.evaluate(() => window.__V172.clear())
const bp = await page.evaluate(async () => { const sc = window.__gridironScene
  const told = sc.badgesWhistleV95({ payload: { event: 'run', yards: 25, offense: 'us', desc: 'Toss — run for 25.' }, __ballTokenV1514: 'jchk:big:' + Date.now(), carrierId: null })
  await new Promise(r => setTimeout(r, 450)); return { told, s: window.__V172.state() } })
ok(bp.told && bp.s.mode === 'event' && bp.s.title === 'BIG PLAY!' && /\+25 YARDS/.test(bp.s.sub || '') && /^(us|them)$/.test(bp.s.ev.side) && bp.s.ev.col === bp.s.pal[bp.s.ev.side], 'a +25 run at the whistle puts BIG PLAY! · +25 YARDS on the board, in the ball carrier\'s team colours', { title: bp.s.title, sub: bp.s.sub, side: bp.s.ev && bp.s.ev.side })
// the promotion: INTERCEPTED, then a TOUCHDOWN on the same return = PICK SIX
await page.evaluate(() => window.__V172.clear())
const six = await page.evaluate(async () => { const sc = window.__gridironScene, B = window.__BADGE_V95, t = Date.now()
  B.show('intercepted', { scene: sc, token: 'jchk:six1:' + t, force: true }); await new Promise(r => setTimeout(r, 150))
  B.show('touchdown', { sub: '', scene: sc, token: 'jchk:six2:' + t, force: true }); await new Promise(r => setTimeout(r, 200)); return window.__V172.state() })
ok(six.title === 'TOUCHDOWN!' && /PICK SIX/.test(six.sub || ''), 'INTERCEPTED then TOUCHDOWN on the return reads TOUCHDOWN! · PICK SIX (the v95 promotion)', { title: six.title, sub: six.sub })

// ---- into the next snap
await page.evaluate(() => window.__V172.clear())
const snapU = await page.evaluate(() => { const sc = window.__gridironScene
  window.__BADGE_V95.show('turnover', { sub: 'FUMBLE', scene: sc, token: 'jchk:snap:' + Date.now(), force: true })
  const B = sc._bbV172; B.ev.until = Date.now() + 300; sc.bigBoardSnapV172(); const left1 = B.ev.until - Date.now()
  sc.bigBoardSnapV172(); B.ev.until = Date.now() + 200; sc.bigBoardSnapV172(); const left2 = B.ev.until - Date.now()
  return { left1, left2 } })
ok(snapU.left1 >= 2800 && snapU.left2 < 400, 'a big moment still up at the snap is held 3 s into the play (once — not again at the snap after)', snapU)
// live: one fired at the whistle is still on the board after the next play starts
await page.evaluate(() => window.__V172.clear())
const liveSnap = await page.evaluate(async () => { const sc = window.__gridironScene, t0 = Date.now()
  while (!(sc.play && sc.play.done) && Date.now() - t0 < 25000) await new Promise(r => setTimeout(r, 60))
  if (!(sc.play && sc.play.done)) return { whistle: false }
  const P0 = sc.play; window.__BADGE_V95.show('bigplay', { sub: '+31 YARDS', scene: sc, token: 'jchk:live:' + Date.now(), force: true }); const fired = Date.now()
  while ((sc.play === P0 || !sc.play) && Date.now() - fired < 25000) await new Promise(r => setTimeout(r, 40))
  const s0 = window.__V172.state(), snapAt = (s0.ev && s0.ev.snapAt) || Date.now(), upAtSnap = !!(s0.ev && s0.ev.snapAt)
  // measured from the snap the board saw (the poll above can lag it under load)
  while (Date.now() < snapAt + 1500) await new Promise(r => setTimeout(r, 30))
  const s = window.__V172.state()
  return { whistle: true, snapAfterMs: snapAt - fired, upAtSnap, after: { mode: s.mode, title: s.title, left: s.ev && s.ev.left, sinceSnap: Date.now() - snapAt } } })
console.log('live snap:', JSON.stringify(liveSnap))
if (liveSnap.whistle && liveSnap.upAtSnap) ok(liveSnap.after.mode === 'event' && liveSnap.after.title === 'BIG PLAY!', `live: a BIG PLAY at the whistle is still on the board 1.5 s into the next play (the snap came ${liveSnap.snapAfterMs} ms after it)`, liveSnap.after)
else info('live: the next snap came after the moment had run its time (no snap hold to measure)', liveSnap)

// ---- a short line: the panel, then the ticker
await page.evaluate(() => window.__V172.clear())
const msg = await page.evaluate(async () => { const sc = window.__gridironScene
  const t0 = Date.now(), r = sc.jumboSayV164F('GAIN OF 6', { kind: 'result', ms: 300 }); const s0 = window.__V172.state()
  for (let a = window.__V172.state(); a.mode !== 'msg' && Date.now() - t0 < 2000; a = window.__V172.state()) await new Promise(r => setTimeout(r, 40))
  const a = window.__V172.state()
  // the live game keeps talking: a real result line may replace ours (a line replaces a line) — then it is the one on the ticker
  let b = a; while (b.msg && b.msg.text === 'GAIN OF 6' && Date.now() - t0 < 8000) { await new Promise(r => setTimeout(r, 40)); b = window.__V172.state() }
  const held = Date.now() - t0, replaced = !!(b.msg && b.msg.text !== 'GAIN OF 6')
  return { r, s0: { left: s0.msg && s0.msg.left, tick: s0.tick }, a: { mode: a.mode, title: a.title }, held, replaced, b: { msg: b.msg && b.msg.text, tick: b.tick } } })
ok(msg.r && msg.s0.left >= 1700 && /GAIN OF 6/.test(msg.s0.tick || '') && msg.a.mode === 'msg' && msg.a.title === 'GAIN OF 6', 'a result line takes the panel for at least 1.8 s (asked for 0.3 s) and goes on the ticker', msg)
ok(msg.replaced || (msg.held >= 1700 && /GAIN OF 6/.test(msg.b.tick || '')), 'and after its time the panel is the scoreboard again with the line still on the ticker (or a newer live line took over)', { held: msg.held, replaced: msg.replaced, b: msg.b })

// ---- desktop
await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(1500)
await sample('desktop 1280x800', 10, 700)
await page.evaluate(() => { const sc = window.__gridironScene; window.__V172.clear(); window.__BADGE_V95.show('touchdown', { sub: '12 YARDS', scene: sc, token: 'jchk:dtd:' + Date.now(), force: true }) })
await page.waitForTimeout(500)
const dtd = await st()
ok(dtd.mode === 'event' && dtd.onCanvas && dtd.css.w >= 150 && dtd.css.w <= 360, 'desktop: the touchdown board is on the canvas at a readable size', { css: dtd.css, onCanvas: dtd.onCanvas })
await shot('desktop_td')
await page.setViewportSize({ width: 400, height: 860 }); await page.waitForTimeout(800)

// ---- the kill switch: the v164 F screen
const kill = await page.evaluate(async () => { const sc = window.__gridironScene; window.RIB_TUNE.v172jumbo = 0
  // a few frames (polled: under load the frames come slowly)
  for (let t0 = Date.now(), f0 = sc.game.loop.frame; Date.now() - t0 < 5000 && (sc.game.loop.frame - f0 < 4 || window.__V172.state().visible);) await new Promise(r => setTimeout(r, 50))
  const s = window.__V172.state(), ST = sc.stadium
  const r = sc.jumboSayV164F('OLD WAY', { kind: 'result', ms: 400 }); const old = { mode: ST.mode, last: window.__V164F.last }
  await new Promise(r => setTimeout(r, 200)); window.RIB_TUNE.v172jumbo = 1
  for (let t0 = Date.now(), f0 = sc.game.loop.frame; Date.now() - t0 < 5000 && (sc.game.loop.frame - f0 < 4 || window.__V172.state().bowl.frame);) await new Promise(r => setTimeout(r, 50))
  const back = window.__V172.state()
  return { up: s.up, visible: s.visible, frame: s.bowl.frame, hung: s.bowl.hung, r, old: { mode: old.mode, board: !!(old.last && old.last.board), text: old.last && old.last.text }, back: { visible: back.visible, frame: back.bowl.frame } } })
ok(!kill.up && !kill.visible && kill.frame && !kill.hung && kill.r && !kill.old.board && kill.old.text === 'OLD WAY', 'TU v172jumbo 0: the board is gone, the bowl\'s screen is back and a line goes the v164 F way (its screen or the ribbon)', kill)
ok(kill.back.visible && !kill.back.frame, 'and back on, the board hangs again', kill.back)
ok(!errs.length, 'no page errors', errs.slice(0, 4))
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
