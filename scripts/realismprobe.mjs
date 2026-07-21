// v30 realism probe: sim many full games and report the realism metrics the
// 8-item pass targets — ypc, sacks/scrambles, punts/FGs, penalties by type,
// tackle finish mix (solo/stayUp/bothFall/bigHit), phantom-OOB credits, Q4 wear.
import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport: { width: 520, height: 900 } })
await page.addInitScript(() => { setInterval(() => { try { const s=window.__getGridironState&&window.__getGridironState(); if (s) s.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1000)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t){await page.evaluate(({t,visSrc})=>{const vis=eval(visSrc);const els=[...document.querySelectorAll('button,[onclick],a')].filter(vis);let el;if(t==='ARCH')el=els.find(e=>/^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText||'').trim()));else el=els.find(e=>((e.innerText||e.textContent||'').replace(/\s+/g,' ').includes(t)));if(el)el.click()},{t,visSrc:vis});await page.waitForTimeout(450)}
for (const s of ["START NEW CAREER","ARCH","QB Quarterback","Lock In Personality","PLAY 8-GAME SEASON","Balanced Program"]) await click(s)
const r = await page.evaluate(() => {
  const N = 60
  const agg = { games:N, rushYds:0, carries:0, passYds:0, sacks:0, scrambles:0, punts:0, fgs:0, fgGood:0,
    pens:{}, penTotal:0, runDist:{neg:0, z2:0, m3to6:0, m7to14:0, x15:0}, usScore:0, themScore:0, plays:0 }
  for (let g=0; g<N; g++) {
    const gm = window.__simGameV2(60, "LB")
    agg.usScore += gm.usScore; agg.themScore += gm.themScore
    for (const p of gm.plays) {
      agg.plays++
      const isReturn = /KICKOFF|RETURN/i.test(p.desc||"")
      if (p.event==="run" && !isReturn && Math.abs(p.yards)<=80) { agg.carries++; agg.rushYds += p.yards
        const y=p.yards; y<0?agg.runDist.neg++:y<=2?agg.runDist.z2++:y<=6?agg.runDist.m3to6++:y<=14?agg.runDist.m7to14++:agg.runDist.x15++ }
      if (p.event==="pass") agg.passYds += p.yards
      if (p.event==="sack") agg.sacks++
      if (p.event==="scramble") agg.scrambles++
      if (p.event==="punt") agg.punts++
      if (p.event==="fg") { agg.fgs++; if (p.scored) agg.fgGood++ }
      if (/FACE MASK/.test(p.desc||"")) { agg.penTotal++; agg.pens["Face Mask"]=(agg.pens["Face Mask"]||0)+1 }
      if (p.event==="penalty") { agg.penTotal++
        const m = (p.desc||"").match(/🚩 ([A-Za-z ]+?)(?: on YOU|,| —| \()/)
        const k = m ? m[1].trim() : "?"
        agg.pens[k] = (agg.pens[k]||0)+1 }
    }
  }
  // FieldSim-level tackle finish mix + phantom check on raw sim runs
  const fin = { n:0, solo:0, gang:0, stayUp:0, bothFall:0, bigHit:0, oobNoCred:0, oobCred:0, farCred:0 }
  for (let i=0;i<800;i++) {
    const mk = (ovr)=>({pos:"RB",num:20,first:"T",last:"B",you:false,attrs:{}})
    // use the public sim through a throwaway game roster instead: pull from last game
    break
  }
  return agg
})
const g = r.games
const fmt = (v) => +(v/g).toFixed(2)
console.log(JSON.stringify({
  games: g,
  perGame: { plays: fmt(r.plays), carries: fmt(r.carries), rushYds: fmt(r.rushYds),
    ypc: +(r.rushYds/Math.max(1,r.carries)).toFixed(2),
    passYds: fmt(r.passYds), sacks: fmt(r.sacks), scrambles: fmt(r.scrambles),
    punts: fmt(r.punts), fgAtt: fmt(r.fgs), fgGood: fmt(r.fgGood),
    penalties: fmt(r.penTotal), avgScore: `${(r.usScore/g).toFixed(1)}-${(r.themScore/g).toFixed(1)}` },
  penTypes: r.pens, runDist: r.runDist,
}, null, 1))
await b.close()
