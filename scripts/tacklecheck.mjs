// Dev check: boot the game, capture each FieldSim play's tackle events, and report the
// solo/gang split, whiff/truck/big-hit rates. Usage: npm run dev, then: node scripts/tacklecheck.mjs
// solo/gang split, whiff/truck rates, and run yardage.
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.addInitScript(() => { setInterval(() => { try { const s=window.__getGridironState&&window.__getGridironState(); if (s) s.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1000)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  await page.evaluate(({t, visSrc}) => { const vis = eval(visSrc)
    const els=[...document.querySelectorAll('button,[onclick],a')].filter(vis); let el
    if (t==='ARCH') el = els.find(e=>/^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText||'').trim()))
    else el = els.find(e=>((e.innerText||e.textContent||'').replace(/\s+/g,' ').includes(t)))
    if(el)el.click() }, {t, visSrc:vis})
  await page.waitForTimeout(450)
}
for (const s of ["START NEW CAREER","ARCH","QB Quarterback","PLAY 8-GAME SEASON","Balanced Program"]) await click(s)
const res = await page.evaluate(() => {
  const FS = window.__FieldSim
  const rec = []
  const wrap = (name) => { const orig = FS[name].bind(FS);
    FS[name] = function(...a){ const r = orig(...a); const q = FS._Q;
      if (q && q.length) rec.push({ kind:name, yards: r && r.yards, ev: q[q.length-1].log.events }); return r } }
  wrap('run'); wrap('pass')
  for (let g=0; g<80; g++) window.__simGameV2(60, "RB")
  // analyze RUN plays that ended in a tackle
  const runs = rec.filter(p => p.kind==='run')
  let solo=0, gang=0, tackled=0, whiffPlays=0, brokenPlays=0, stiffPlays=0, stagPlays=0, bigHit=0, bothFall=0
  let lunges=0, whiffs=0, brokens=0, stiffs=0, stags=0
  for (const p of runs) {
    const evs = p.ev
    const tk = [...evs].reverse().find(e => e.type==='tackle')
    const wl = evs.filter(e=>e.type==='tackleWhiff').length
    const bk = evs.filter(e=>e.type==='brokenTackle').length
    const sa = evs.filter(e=>e.type==='stiffarm').length
    const sg = evs.filter(e=>e.type==='stagger').length
    const lu = evs.filter(e=>e.type==='tackleLunge').length
    lunges+=lu; whiffs+=wl; brokens+=bk; stiffs+=sa; stags+=sg
    if (wl>0) whiffPlays++
    if (bk>0) brokenPlays++
    if (sa>0) stiffPlays++
    if (sg>0) stagPlays++
    if (tk) { tackled++; if (tk.gang) gang++; else solo++; if (tk.bigHit) bigHit++; if (tk.bothFall) bothFall++ }
  }
  const pct = (n,d) => d? +(n/d*100).toFixed(0) : 0
  return { runPlays: runs.length, tackled,
    soloPct: pct(solo,tackled), gangPct: pct(gang,tackled),
    whiffPlayPct: pct(whiffPlays,runs.length), brokenPlayPct: pct(brokenPlays,runs.length),
    stiffArmPlayPct: pct(stiffPlays,runs.length), staggerPlayPct: pct(stagPlays,runs.length),
    bigHitPct: pct(bigHit,tackled), bothFallPct: pct(bothFall,tackled),
    whiffsPerPlay: +(whiffs/runs.length).toFixed(2), brokensPerPlay: +(brokens/runs.length).toFixed(2),
    stiffsPerPlay: +(stiffs/runs.length).toFixed(2), stagsPerPlay: +(stags/runs.length).toFixed(2),
    lungesPerPlay: +(lunges/runs.length).toFixed(2) }
})
console.log('RUN tackling:', JSON.stringify(res, null, 0))
console.log(errs.length ? 'ERRORS:\n'+errs.slice(0,5).join('\n') : 'no page errors')
await browser.close()
