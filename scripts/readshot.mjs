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
// the career flow: walk it by whichever forward button is on screen, position pinned
const POS = process.env.READ_POS || 'LB'
const FORWARD = ['CONTINUE TO MATCH', 'START NEW CAREER', 'Lock In Personality', 'START YOUR LEGACY', 'PLAY 8-GAME SEASON', 'Balanced Program', 'PLAY WEEK 1 LIVE', 'Continue', 'CONTINUE', 'Skip', 'SKIP', 'Next', 'NEXT', 'Begin', 'BEGIN']
let last = '', repeats = 0
for (let step = 0; step < 24; step++) {
  let done
  try { done = await page.evaluate(({ visSrc, POS, FORWARD }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    const big = [...document.querySelectorAll('canvas')].some(c => { const r = c.getBoundingClientRect(); return r.width > 300 && r.height > 200 })
    if (big && window.__gridironScene) return 'live'
    // the v51 pregame wheel: a plan card is on screen — pick one, the wheel rolls it
    const plan = els.find(e => /gs-card|gameplan|plan-card/i.test(e.className))
    if (plan && !window.__readshotPlanned) { window.__readshotPlanned = true; plan.click(); return 'plan:' + txt(plan).slice(0, 20) }
    for (const want of FORWARD) { const b = els.find(e => txt(e).includes(want)); if (b) { b.scrollIntoView({ block: 'center' }); b.click(); return want } }
    const card = els.find(e => new RegExp('^' + POS + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card'))
    if (card) { card.click(); return 'pos:' + txt(card).slice(0, 20) }
    return 'stuck: ' + els.slice(0, 6).map(txt).map(t => t.slice(0, 18)).join(' | ')
  }, { visSrc: vis, POS, FORWARD }) } catch (e) { console.log('>> (page navigated, retrying)'); await page.waitForTimeout(1500); continue }
  console.log('>>', done)
  if (done === 'live') break
  if (done === last) { repeats++; if (repeats === 2) console.log('   visible:', await page.evaluate(({ visSrc }) => { const vis = eval(visSrc); return [...document.querySelectorAll('button,[onclick],a,.gameplan-overlay *')].filter(vis).slice(0, 14).map(e => (e.className || '') + '=' + (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 24)).join(' || ') }, { visSrc: vis })) } else { repeats = 0; last = done }
  await page.waitForTimeout(done.startsWith('plan') ? 4000 : 850)
}
let scene = false
for (let i = 0; i < 40; i++) { scene = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length)); if (scene) break; await page.waitForTimeout(400) }
console.log('scene:', scene)
let qMax = 0, qFrames = 0, shots = 0, evSeen = {}, qShot = false
for (let i = 0; i < 40; i++) {
  const st = await page.evaluate(() => { const sc = window.__gridironScene; if (!sc) return null
    const q = (sc.markers || []).filter(m => m && m._qTxt && m._qTxt.visible).length
    const P = sc.play; const ev = P && P.evIdx != null && sc.play.__S ? null : null
    return { q, t: P && P.t, snapped: !!(P && P.snapped) } })
  // capture the GAME'S OWN framebuffer (a DOM screenshot grabs whatever overlay sits on top)
  const snap = async (path) => { const src = await page.evaluate(() => new Promise(res => { try { window.__gridironScene.game.renderer.snapshot(img => res(img.src || null)) } catch (e) { res(null) } }));
    if (src) fs.writeFileSync(path, Buffer.from(src.split(',')[1], 'base64')) }
  if (st) { qMax = Math.max(qMax, st.q); if (st.q) { qFrames++; if (!qShot) { qShot = true; await snap('scripts/_read_q.png') } } }
  if (i % 2 === 0) await snap(`scripts/_read_${shots++}.png`)
  await page.waitForTimeout(qShot ? 350 : 120)
}
// which v81 events reached fireEvent (instrumented after the fact through the scene's play log)
const evs = await page.evaluate(() => { const sc = window.__gridironScene; const S = sc && sc.play && sc.play.script; const out = {}
  const list = (S && S.events) || []; for (const e of list) out[e.type] = (out[e.type] || 0) + 1; return out })
console.log('question marks: max on screen', qMax, '| frames with any', qFrames, '/ 40')
console.log('current play events:', JSON.stringify(evs))
console.log(errs.length ? 'PAGE ERRORS:\n' + errs.slice(0, 8).join('\n') : 'page errors: none')
await browser.close()
