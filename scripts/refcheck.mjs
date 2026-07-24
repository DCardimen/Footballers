// Dev check: drive into a live game, then verify the referee crew (v45):
//   - 7 officials exist on the field
//   - they MOVE during a play (not frozen)
//   - a foul spot draws a flag from an official
//   - screenshots the canvas so the zebra kit can be eyeballed
import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => {
  setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60)
})
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(1000)

const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  const ok = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t === 'ARCH') el = els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
    else el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false
  }, { t, visSrc: vis })
  console.log(`>> ${t} -> ${ok ? 'ok' : 'MISS'}`)
  await page.waitForTimeout(850)
}
for (const s of ['START NEW CAREER', 'ARCH', 'QB Quarterback', 'Lock In Personality', 'PLAY 8-GAME SEASON',
  'Balanced Program', 'PLAY WEEK 1 LIVE', 'CONTINUE TO MATCH', 'Continue']) await click(s)

// wait for the Phaser scene + referee crew
let report = null
for (let i = 0; i < 40; i++) {
  report = await page.evaluate(() => {
    const sc = window.__gridironScene
    if (!sc) return { scene: false }
    const refs = sc.refs || []
    return {
      scene: true, hasRefTex: !!(sc.textures && sc.textures.exists('spr_ref_dn_idle')),
      refCount: refs.length, roles: refs.map(r => r.role),
      pos: refs.map(r => ({ x: Math.round(r.sx), y: Math.round(r.sy) })),
      playing: !!sc.play,
    }
  })
  if (report && report.scene && report.refCount >= 7) break
  await page.waitForTimeout(400)
}
console.log('scene report:', JSON.stringify(report))

// sample ref positions across ~2.5s to prove they move during a play
async function snapPos() {
  return page.evaluate(() => (window.__gridironScene?.refs || []).map(r => [Math.round(r.sx), Math.round(r.sy)]))
}
const p0 = await snapPos()
await page.waitForTimeout(1400)
const p1 = await snapPos()
let moved = 0, maxD = 0
if (p0.length && p0.length === p1.length) {
  for (let i = 0; i < p0.length; i++) {
    const d = Math.hypot(p1[i][0] - p0[i][0], p1[i][1] - p0[i][1])
    if (d > 1.5) moved++
    maxD = Math.max(maxD, d)
  }
}
console.log(`refs that moved in 1.4s: ${moved}/${p0.length}  maxDelta=${maxD.toFixed(1)}px`)

// fire a flag through the nearest official at a made-up spot and confirm the throw animates
const flag = await page.evaluate(() => {
  const sc = window.__gridironScene
  if (!sc || !sc.refThrowFlag) return 'no-scene'
  const before = (sc.refs || []).map(r => r.forceState)
  const ok = sc.refThrowFlag(360, 220)
  const after = (sc.refs || []).map(r => r.forceState)
  return { ok, threw: after.filter(s => s === 'throwSeq').length, before, after }
})
console.log('flag throw:', JSON.stringify(flag))

// screenshot the canvas region a few times
const box = await page.evaluate(() => { const c = document.querySelector('canvas'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height } })
if (box) for (let i = 0; i < 4; i++) { await page.screenshot({ path: `scripts/_ref_${i}.png`, clip: box }); await page.waitForTimeout(500) }

console.log('page errors:', errs.length ? '\n' + errs.slice(0, 12).join('\n') : 'NONE')
await browser.close()
