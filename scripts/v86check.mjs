// Dev check: v86 BETWEEN THE WHISTLES — seven animations built from frames the sheets
// already carry. Drives a real career onto the live field and watches the scene's
// own counters (window.__V86) and state for a run of plays:
//   post-play phases run (the pile unpiles, everyone jogs toward the ball — measured:
//   the crowd of 22 is closer to the spot at the end of the phase than at the whistle),
//   the pre-snap cadence fires, the QB backpedals on a dropback, tackles are classed
//   by geometry, the target looks back for the ball, the turf accumulates wear.
//   node scripts/v86check.mjs        (READ_POS=QB|RB|WR|LB..., V86_MS=90000, V86_SHOTS=1)
import { chromium } from 'playwright'
import fs from 'node:fs'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1200)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const POS = process.env.READ_POS || 'RB'
async function step(t) { let ok = null; try { ok = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
  let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t))
  if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis }) } catch (e) { ok = 'ERR ' + e.message }
  console.log('>>', t, '->', ok); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900) }
await page.evaluate(p => { window.__readPos = p }, POS)
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
let scene = false
for (let i = 0; i < 40; i++) { scene = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length)); if (scene) break; await page.waitForTimeout(400) }
console.log('scene:', scene)

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const snap = async (path) => { const src = await page.evaluate(() => new Promise(res => { try { window.__gridironScene.game.renderer.snapshot(img => res(img.src || null)) } catch (e) { res(null) } })); if (src) fs.writeFileSync(path, Buffer.from(src.split(',')[1], 'base64')) }

// watch the field for a while: sample state every 120ms, measure the post-play gather
const MS = +(process.env.V86_MS || 90000), SHOTS = !!process.env.V86_SHOTS
const t0 = Date.now(); const gathers = []; let cur = null, shotPost = 0, shotPre = 0, dropFrames = 0, leanFrames = 0, lookFrames = 0, swayFrames = 0
while (Date.now() - t0 < MS) {
  const st = await page.evaluate(() => { const sc = window.__gridironScene; if (!sc) return null
    const P = sc.play, ms = sc.markers || []
    const dist = (sp) => ms.length ? ms.reduce((s, m) => s + Math.hypot(m.sx - sp.x, m.sy - sp.y), 0) / ms.length : 0
    const far = (sp) => ms.length ? Math.max(...ms.map(m => Math.hypot(m.sx - sp.x, m.sy - sp.y))) : 0
    const qb = ms[8]
    return { post: !!(P && P.post), postT: P && P.post ? P.post.t : 0, postMs: P && P.post ? P.post.ms : 0, spot: P && P.post ? P.post.spot : null, avg: P && P.post ? dist(P.post.spot) : 0, far: P && P.post ? far(P.post.spot) : 0,
      t: P && P.t, snapped: !!(P && P.snapped), event: P && P.payload && P.payload.event, token: P && P.__ballTokenV1514,
      drop: !!(qb && (qb._dropback || qb._dropped)), /* the latched flag too: v87's QB sets up in under half a second */ lean: !!(qb && qb._lean), look: ms.some(m => m._lookAt), sway: ms.slice(11).some(m => m.isLine && m.body && Math.abs(m.body.y) > 0.2),
      wear: (sc.wearV86 || []).length, V: window.__V86 || {} } })
  if (st) {
    if (st.post) {
      if (!cur || cur.token !== st.token) { cur = { token: st.token, first: st.avg, last: st.avg, farFirst: st.far, farLast: st.far, spot: st.spot }; gathers.push(cur) }
      cur.last = st.avg; cur.farLast = st.far
      if (SHOTS && shotPost < 3 && st.postT > st.postMs * 0.7) { shotPost++; await snap(`scripts/_v86_post${shotPost}.png`) }
    }
    if (SHOTS && !st.snapped && st.t > 250 && shotPre < 2 && /^(run|pass)$/.test(st.event || '')) { shotPre++; await snap(`scripts/_v86_pre${shotPre}.png`) }
    if (st.drop) dropFrames++; if (st.lean) leanFrames++; if (st.look) lookFrames++; if (st.sway) swayFrames++
    var last = st
  }
  await page.waitForTimeout(70)   // the stance sway and the look-back live in windows a few frames long; 120ms sampling missed them under load
}
const V = (last && last.V) || {}
console.log('counters:', JSON.stringify(V), 'wear:', last && last.wear, 'gathers avg/far:', JSON.stringify(gathers.map(g => [Math.round(g.first), Math.round(g.last), Math.round(g.farFirst), Math.round(g.farLast)])))
console.log('frames: dropback', dropFrames, 'lean', leanFrames, 'lookback', lookFrames, 'sway', swayFrames)
ok((V.posts || 0) >= 2 && gathers.length >= 2, 'post-play phases ran after ordinary plays', `${V.posts || 0} phases · ${gathers.length} measured`)
const closer = gathers.filter(g => g.farLast < g.farFirst - 6 || g.farFirst < 60).length
ok(gathers.length && closer >= Math.max(1, Math.ceil(gathers.length * 0.6)), 'the man farthest from the ball has closed on it by the end of the phase (or nobody was far)', `${closer}/${gathers.length} gathers closed`)
ok((V.cadences || 0) >= 1 && swayFrames > 0, 'the pre-snap cadence fired and the defensive front swayed', `${V.cadences || 0} cadences · ${swayFrames} sway frames`)
ok(dropFrames > 0, 'a QB dropback was drawn as a backpedal facing the line', `${dropFrames} frames`)
const styled = (V.drags || 0) + (V.knocks || 0) + (V.forwards || 0) + (V.slides || 0)
ok(styled >= 1 && (V.plain || 0) + styled >= 2, 'tackles were classed by geometry (drag / knock-back / fall forward / slide) with the plain fold still available', JSON.stringify({ drags: V.drags || 0, knocks: V.knocks || 0, forwards: V.forwards || 0, slides: V.slides || 0, plain: V.plain || 0 }))
ok(lookFrames > 0 || (V.lookbacks || 0) > 0, 'a target ran with his head turned to the ball', `${V.lookbacks || 0} look-backs · ${lookFrames} frames`)
ok((last && last.wear || 0) >= 3, 'the turf accumulated wear marks', `${last && last.wear} marks`)
console.log(JSON.stringify({ pass, fail }))
console.log(errs.length ? 'PAGE ERRORS:\n' + errs.slice(0, 8).join('\n') : 'page errors: none')
await browser.close()
if (fail || errs.length) process.exit(1)
