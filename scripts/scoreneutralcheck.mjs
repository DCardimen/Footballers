// v109 dev check: the realism suite must not move the scoreboard. Sims N full games through
// window.__simGameV2 and prints one JSON row of the numbers the suite is NOT allowed to change
// (points, plays, yards, completion %, ypc, sacks, turnovers, punts, FGs). Run before and after a
// change and diff: `GAMES=300 node scripts/scoreneutralcheck.mjs > before.json`.
// Env: GAMES (default 200), POS (default cycles QB/RB/WR/DL/CB), OUT (write JSON to file), GAME_URL.
// v109: `snaps` counts the rows that are plays from scrimmage or kicks — the header-like rows (toss, period, warning,
// timeout) and the try rows (xp, twopt) that v109 added inflate `plays`/`scrim` by design; compare `snaps` to the
// pre-v109 `scrim` (80.4 ±2 on the 300-game baseline).
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
const URL = process.env.GAME_URL || 'http://localhost:5173/'
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(2500)   // v109: warm past vite's one-time reload after an edit, like the other checks
await page.waitForFunction(() => typeof window.__simGameV2 === 'function', null, { timeout: 60000 })
await page.waitForTimeout(500)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  await page.evaluate(({t, visSrc}) => { const vis = eval(visSrc)
    const els=[...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t==='ARCH') el = els.find(e=>/^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText||'').trim()))
    else el = els.find(e=>((e.innerText||e.textContent||'').replace(/\s+/g,' ').includes(t)))
    if(el) el.click() }, {t, visSrc:vis})
  await page.waitForTimeout(400)
}
for (const s of ["START NEW CAREER","ARCH","QB Quarterback","Lock In Personality","PLAY 8-GAME SEASON","Balanced Program","CONFIRM TRAINING"]) await click(s)
const N = Math.max(1, Number(process.env.GAMES || 200))
const POS = process.env.POS || ''
const res = await page.evaluate(({N, POS}) => {
  const a = { games:0, us:0, them:0, total:0, margin:0, plays:0, scrim:0, snaps:0, drives:0, yds:0, oppYds:0, pass:0, rush:0, first:0,
    sacks:0, turn:0, punts:0, fgAtt:0, fgGood:0, tds:0, runs:0, runYds:0, passes:0, passYds:0, inc:0, scr:0, pen:0, ot:0, safeties:0,
    runDist:{neg:0,z2:0,m3to6:0,m7to14:0,x15:0}, passDist:{z5:0,m6to14:0,m15to29:0,x30:0}, errors:[] }
  const poss=["QB","RB","WR","DL","CB"]
  for (let g=0; g<N; g++) {
    try {
      const r = window.__simGameV2(45 + (g%9)*5, POS || poss[g%5])
      a.games++; a.us+=r.usScore; a.them+=r.themScore; a.total+=r.usScore+r.themScore; a.margin+=Math.abs(r.usScore-r.themScore)
      const pl=r.plays; a.plays+=pl.length; a.drives+=pl.filter(x=>x.header).length; a.scrim+=pl.length-pl.filter(x=>x.header).length
      a.snaps+=pl.filter(x=>!x.header&&!/^(xp|twopt|timeout|warning|period|toss)$/.test(x.event)).length   // v109: the snaps — header-like rows and the try are not plays from scrimmage
      a.yds+=r.team.yds; a.oppYds+=r.oppTeam.yds; a.pass+=r.team.pass; a.rush+=r.team.rush; a.first+=r.team.first; a.sacks+=r.team.sacks; a.turn+=r.team.turn
      let lastQ=0
      for (const p of pl) { lastQ=Math.max(lastQ,p.quarter||0)
        const isRet=/KICKOFF|RETURN/i.test(p.desc||"")
        if (p.event==="run"&&!isRet&&Math.abs(p.yards)<=80){a.runs++;a.runYds+=p.yards;const y=p.yards;y<0?a.runDist.neg++:y<=2?a.runDist.z2++:y<=6?a.runDist.m3to6++:y<=14?a.runDist.m7to14++:a.runDist.x15++}
        if (p.event==="pass"){a.passes++;a.passYds+=p.yards;const y=p.yards;y<=5?a.passDist.z5++:y<=14?a.passDist.m6to14++:y<=29?a.passDist.m15to29++:a.passDist.x30++}
        if (p.event==="incomplete")a.inc++
        if (p.event==="scramble")a.scr++
        if (p.event==="punt")a.punts++
        if (p.event==="fg"){a.fgAtt++;if(p.scored)a.fgGood++}
        if (p.event==="penalty")a.pen++
        if (/SAFETY/i.test(p.desc||""))a.safeties++
        if (p.scored&&p.event!=="fg"&&!/EXTRA|PAT|2-PT/i.test(p.desc||""))a.tds++
      }
      if (lastQ>4)a.ot++
    } catch(e){ a.errors.push(String(e&&e.stack||e).slice(0,400)) }
  }
  return a
}, {N, POS})
const g=res.games||1, f=(v,d=2)=>+(v/g).toFixed(d)
const out = { games:g, us:f(res.us), them:f(res.them), total:f(res.total), absMargin:f(res.margin), plays:f(res.plays,1), scrim:f(res.scrim,1), snaps:f(res.snaps,1), drives:f(res.drives,1),
  yds:f(res.yds,1), oppYds:f(res.oppYds,1), passYds:f(res.pass,1), rushYds:f(res.rush,1), first:f(res.first), sacks:f(res.sacks), turn:f(res.turn), punts:f(res.punts),
  fgAtt:f(res.fgAtt), fgPct:+(100*res.fgGood/Math.max(1,res.fgAtt)).toFixed(1), tds:f(res.tds), runs:f(res.runs,1), ypc:+(res.runYds/Math.max(1,res.runs)).toFixed(2),
  passes:f(res.passes,1), inc:f(res.inc,1), compPct:+(100*res.passes/Math.max(1,res.passes+res.inc)).toFixed(1), ypa:+(res.passYds/Math.max(1,res.passes+res.inc)).toFixed(2),
  scrambles:f(res.scr), pen:f(res.pen), otPct:+(100*res.ot/g).toFixed(1), safeties:f(res.safeties,3),
  runDist:Object.fromEntries(Object.entries(res.runDist).map(([k,v])=>[k,+(100*v/Math.max(1,res.runs)).toFixed(1)])),
  passDist:Object.fromEntries(Object.entries(res.passDist).map(([k,v])=>[k,+(100*v/Math.max(1,res.passes)).toFixed(1)])),
  errors:res.errors.length, pageErrors:errs.length }
console.log(JSON.stringify(out))
if (res.errors.length) console.log('ENGINE ERRORS:\n'+res.errors.slice(0,3).join('\n---\n'))
if (errs.length) console.log('PAGE ERRORS:\n' + errs.slice(0, 5).join('\n'))
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out, null, 1))
await browser.close()
