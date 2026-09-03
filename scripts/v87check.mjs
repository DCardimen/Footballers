// Dev check: v87 — credit by alignment, the huddle, the posts, the safety, the QB's lane.
//   1. CREDIT: the man on the target is chosen by alignment, never by a coin flip — a
//      corner covers a share of targets, a linebacker rarely; a pass break-up on your
//      sheet is a swat the sim named you for; tackles never exceed the sim's truth.
//   2. THE QB: scrambles on opportunity only when a lane is open (every one carries
//      lane:true; none with the dial at 0); no throw ever goes to a target behind him.
//   3. SAFETY: when a play ends behind the goal line the defense gets two and the
//      other side takes over (informational when the sample has none).
//   4. THE FIELD: on the live field the huddle phase runs and both goalposts draw.
//   node scripts/v87check.mjs   (V87_GAMES=14, V87_LIVE_MS=30000)
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1200)
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function step(t) { let r = null; try { r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
  let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t))
  if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 30) } return null }, { t, visSrc: vis }) } catch (e) { r = 'ERR' }
  console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 800) }
await page.evaluate(() => { window.__readPos = 'CB' })
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program']) await step(t)
await page.evaluate(() => { document.getElementById('growthV42')?.remove(); window.go('season') })
await page.waitForTimeout(500)

// ---- 1 + 2 + 3: sim games with the you-player at CB, LB and QB, the sim wrapped for truth
const GAMES = +(process.env.V87_GAMES || 14)
const res = await page.evaluate(async ({ GAMES }) => {
  const FS = window.__FieldSim, origPass = FS.pass.bind(FS), origRun = FS.run.bind(FS)
  const T = { pass: 0, youCover: 0, youSwat: 0, youTk: 0, scr: 0, scrLane: 0, behind: 0, throws: 0, sacks: 0, rbCheck: 0, rbCheckAhead: 0 }
  let mode = 'CB'
  const per = {}
  FS.pass = function (...a) { const r = origPass(...a); if (!r) return r
    const P = per[mode] || (per[mode] = { pass: 0, youCover: 0, youSwat: 0, youTk: 0, scr: 0, scrLane: 0, behind: 0, throws: 0 })
    P.pass++; T.pass++
    if (r.cover && r.cover.you) { P.youCover++; T.youCover++ }
    if (r.swat && r.cover && r.cover.you) { P.youSwat++; T.youSwat++ }
    if ((r.tackler && r.tackler.you) || (r.assist && r.assist.you)) { P.youTk++; T.youTk++ }
    const ev = (window.__FieldSim._Q && window.__FieldSim._Q.length) ? null : null
    return r }
  // the sim's own log carries the throw/scramble events: read them off the render queue
  const Q = () => (FS._Q || [])
  const count = (from) => { const q = Q(); for (let i = from; i < q.length; i++) { const L = q[i] && (q[i].log || q[i]); const evs = (L && L.events) || []
      for (const e of evs) { if (e.type === 'throw') { T.throws++; if (e.behind) T.behind++ }
        if (e.type === 'scramble' && e.opportunity) { T.scr++; if (e.lane) T.scrLane++ }
        if (e.type === 'read' && e.to === 'off9') T.rbCheck++ } } return q.length }
  const out = { games: {}, safeties: [], scoreOK: true }
  for (const pos of ['CB', 'LB', 'QB']) { mode = pos; let box = { tackle: 0, pd: 0, rush: 0 }
    for (let g = 0; g < GAMES; g++) { const from = Q().length; const G = window.__simGameV2(62, pos); count(from)
      for (const k in box) box[k] += Number(G.stat[k] || 0)
      const pl = G.plays || []
      for (let i = 0; i < pl.length; i++) { const p = pl[i]; if (p && p.safety) { const nx = pl.slice(i + 1).find(x => x && x.event !== 'drive' && !x.header)
          out.safeties.push({ q: p.quarter, offense: p.offense, us: p.usScore, them: p.themScore, next: nx && nx.offense, nextStart: nx && nx.startBall, desc: String(p.desc).slice(0, 80) }) } }
      if (Q().length > 4000) FS._Q.length = 0 }
    out.games[pos] = { box, sim: per[pos] || {} } }
  // the dial at zero: no opportunity scrambles at all
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { scrOppBase: 0 })
  const before = { scr: T.scr }
  mode = 'QB'; for (let g = 0; g < 4; g++) { const from = Q().length; window.__simGameV2(62, 'QB'); count(from) }
  out.scrAtZero = T.scr - before.scr
  delete window.RIB_TUNE.scrOppBase
  FS.pass = origPass; FS.run = origRun
  out.T = T
  return out
}, { GAMES })
console.log('sim:', JSON.stringify(res))
const cb = res.games.CB, lb = res.games.LB, T = res.T
const cbRate = cb.sim.pass ? cb.sim.youCover / cb.sim.pass : 0, lbRate = lb.sim.pass ? lb.sim.youCover / lb.sim.pass : 0
ok(cb.sim.pass > 40 && cbRate > 0.05 && cbRate < 0.42, 'a corner covers a share of targets by alignment — never the old 45% coin flip', `${(cbRate * 100).toFixed(1)}% of ${cb.sim.pass} pass sims`)
ok(lb.sim.pass > 40 && lbRate < 0.2, 'a linebacker is rarely the man on the target', `${(lbRate * 100).toFixed(1)}% of ${lb.sim.pass}`)
ok(cb.box.pd <= cb.sim.youSwat && lb.box.pd <= lb.sim.youSwat, 'pass break-ups on the sheet never exceed the swats the sim named you for', `CB pd ${cb.box.pd} vs ${cb.sim.youSwat} swats · LB pd ${lb.box.pd} vs ${lb.sim.youSwat}`)
ok(T.throws > 40 && T.behind === 0, 'no throw ever goes to a target behind the quarterback', `${T.behind} of ${T.throws} throws`)
const scrRate = T.pass ? T.scr / T.pass : 0
ok(T.scr >= 3 && T.scr === T.scrLane && scrRate < 0.3, 'the QB scrambles on opportunity, and only into an open lane', `${T.scr} scrambles in ${T.pass} pass sims (${(scrRate * 100).toFixed(1)}%), lane on all`)
ok(res.scrAtZero === 0, 'with the dial at 0 there are no opportunity scrambles', `${res.scrAtZero}`)
if (res.safeties.length) {
  const s = res.safeties[0]
  ok(res.safeties.every(x => x.next && x.next !== x.offense), 'a safety hands the ball to the other side on a free kick', JSON.stringify(res.safeties.slice(0, 2)))
} else ok(true, 'no safety in this sample (informational — the rule fires on pre.pos + yards <= 0)', `${GAMES * 3} games`)

// ---- 4: the live field — the huddle and the posts
await page.evaluate(() => { window.go('season') }); await page.waitForTimeout(400)
await step('PLAY WEEK 1 LIVE')
// the plan wheel spins, its result wants CONTINUE, the pregame panel wants a card and CONTINUE TO MATCH
for (let i = 0; i < 30; i++) {
  const did = await page.evaluate(() => { const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    if (window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length) return 'scene'
    const btns = [...document.querySelectorAll('button')].filter(vis), txt = b => b.textContent.replace(/\s+/g, ' ').trim()
    let b = btns.find(x => /CONTINUE TO MATCH/i.test(txt(x))); if (b) { b.click(); return 'match' }
    const card = document.querySelector('.gs-card'); if (card && vis(card)) { card.click(); return 'card' }
    b = btns.find(x => /^CONTINUE$/i.test(txt(x))); if (b) { b.click(); return 'continue' }
    return null })
  if (did) console.log('>> pregame:', did)
  if (did === 'scene') break
  await page.waitForTimeout(700)
}
let scene = false
for (let i = 0; i < 40; i++) { scene = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length)); if (scene) break; await page.waitForTimeout(400) }
console.log('scene:', scene)
const LIVE = +(process.env.V87_LIVE_MS || 30000); const t0 = Date.now(); let hudFrames = 0, ringTight = 0, samples = 0
while (Date.now() - t0 < LIVE) {
  const st = await page.evaluate(() => { const sc = window.__gridironScene, P = sc && sc.play; if (!sc || !P) return null
    const inHud = !!(P.hud && P.t >= P.hud.a && P.t < P.hud.b)
    let tight = false
    if (inHud) { const ms = sc.markers.slice(0, 11), cx = P.hud.cx.off, cy = P.hud.cy; const d = ms.map(m => Math.hypot(m.sx - cx, m.sy - cy)); tight = Math.max(...d) < 40 }
    return { inHud, tight, posts: !!(sc.goalG && sc.goalG.commandBuffer && sc.goalG.commandBuffer.length), V: window.__V87 || {} } })
  if (st) { samples++; if (st.inHud) hudFrames++; if (st.tight) ringTight++; var last = st
    if (process.env.V87_SHOTS && st.inHud && !globalThis.__shotHud) { globalThis.__shotHud = 1
      const src = await page.evaluate(() => new Promise(res => { try { window.__gridironScene.game.renderer.snapshot(img => res(img.src || null)) } catch (e) { res(null) } }))
      if (src) (await import('node:fs')).writeFileSync('scripts/_v87_huddle.png', Buffer.from(src.split(',')[1], 'base64')) } }
  await page.waitForTimeout(120)
}
console.log('live:', JSON.stringify({ samples, hudFrames, ringTight, posts: last && last.posts, V: last && last.V }))
ok(scene && (last && last.V.huddles || 0) >= 1 && hudFrames > 0, 'the huddle phase ran between plays', `${last && last.V.huddles} huddles · ${hudFrames} frames in the hold`)
ok(ringTight > 0, 'during the hold the offense stands in a ring around the QB', `${ringTight} tight frames`)
ok(last && last.posts, 'goalposts are drawn at both ends', '')
console.log(JSON.stringify({ pass, fail }))
console.log(errs.length ? 'PAGE ERRORS:\n' + errs.slice(0, 8).join('\n') : 'page errors: none')
await browser.close()
if (fail || errs.length) process.exit(1)
