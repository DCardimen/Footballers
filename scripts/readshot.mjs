// Visual QA for v81 BALL AWARENESS: drive into a live game and screenshot the
// broadcast every ~350ms for a few plays, so the "?" over defenders still reading,
// the read/bite/driven-block pops and the lane flash can be eyeballed. Also counts
// the "?" markers actually on screen and reports page errors.
//   node scripts/readshot.mjs            -> scripts/_read_<n>.png
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
async function click(t) {
  const hit = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t === 'ARCH') el = els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
    else el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false
  }, { t, visSrc: vis })
  console.log(`>> ${t} -> ${hit ? 'ok' : 'MISS'}`)
  await page.waitForTimeout(850)
}
// the career flow (same walk livediag proved): position pinned, the plan wheel rolled
const POS = process.env.READ_POS || 'LB'
async function step(t) { let ok = null; try { ok = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const txt = e => (e.innerText || '').replace(/\s+/g, ' ').trim()
  let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t)); if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 30) } return null }, { t, visSrc: vis }) } catch (e) { await page.waitForLoadState('networkidle').catch(() => {}); }
  console.log('>>', t, '->', ok); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900) }
await page.evaluate(p => { window.__readPos = p }, POS)
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
let scene = false
for (let i = 0; i < 40; i++) { scene = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length)); if (scene) break; await page.waitForTimeout(400) }
console.log('scene:', scene)
let qMax = 0, qFrames = 0, shots = 0, evSeen = {}, qShot = false, kickShots = {}
const FRAMES = +(process.env.READ_FRAMES || 160)
for (let i = 0; i < FRAMES; i++) {
  const st = await page.evaluate(() => { const sc = window.__gridironScene; if (!sc) return null
    const q = (sc.markers || []).filter(m => m && m._qTxt && m._qTxt.visible).length
    const P = sc.play
    return { q, t: P && P.t, snapped: !!(P && P.snapped), event: P && P.payload && P.payload.event, fs: !!(P && P.script && P.script.meta && P.script.meta.fieldSim) } })
  // capture the GAME'S OWN framebuffer (a DOM screenshot grabs whatever overlay sits on top)
  const snap = async (path) => { const src = await page.evaluate(() => new Promise(res => { try { window.__gridironScene.game.renderer.snapshot(img => res(img.src || null)) } catch (e) { res(null) } }));
    if (src) fs.writeFileSync(path, Buffer.from(src.split(',')[1], 'base64')) }
  if (st && process.env.READ_DEBUG && i % 3 === 0) console.log('frame', i, JSON.stringify(st))
  if (st) { qMax = Math.max(qMax, st.q); if (st.q) { qFrames++; if (!qShot) { qShot = true; await snap('scripts/_read_q.png') } } }
  if (st && (st.event === 'run' || st.event === 'pass' || st.event === 'incomplete') && st.fs && st.t > 560 && st.t < 1300 && !kickShots.block) { kickShots.block = 1; await snap('scripts/_read_block.png'); console.log('captured block frame at', st.t) }
  if (st && st.event && /^(punt|kickoff|fg)$/.test(st.event)) { evSeen[st.event] = (evSeen[st.event] || 0) + 1; if (!kickShots[st.event] && st.t > 900) { kickShots[st.event] = 1; await snap(`scripts/_read_${st.event}.png`); console.log('captured', st.event, 'fieldsim=', st.fs) } }
  if (i % 8 === 0) await snap(`scripts/_read_${shots++}.png`)
  await page.waitForTimeout(150)
}
// which v81 events reached fireEvent (instrumented after the fact through the scene's play log)
const evs = await page.evaluate(() => { const sc = window.__gridironScene; const S = sc && sc.play && sc.play.script; const out = {}
  const list = (S && S.events) || []; for (const e of list) out[e.type] = (out[e.type] || 0) + 1; return out })
console.log('question marks: max on screen', qMax, '| frames with any', qFrames, '/', FRAMES, '| kick frames seen', JSON.stringify(evSeen))
console.log('current play events:', JSON.stringify(evs))
console.log(errs.length ? 'PAGE ERRORS:\n' + errs.slice(0, 8).join('\n') : 'page errors: none')
await browser.close()
