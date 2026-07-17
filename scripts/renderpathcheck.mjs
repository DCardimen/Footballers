// Dev check: what fraction of run/pass plays actually render from the FieldSim
// agent log (meta.fieldSim) vs falling back to the buildPlayScript choreographer.
// Low numbers mean sim-level changes aren't reaching the screen. node scripts/renderpathcheck.mjs
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport: { width: 520, height: 900 } })
await page.addInitScript(() => { setInterval(() => { try { const s=window.__getGridironState&&window.__getGridironState(); if (s) s.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1000)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t){await page.evaluate(({t,visSrc})=>{const vis=eval(visSrc);const els=[...document.querySelectorAll('button,[onclick],a')].filter(vis);let el;if(t==='ARCH')el=els.find(e=>/^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText||'').trim()));else el=els.find(e=>((e.innerText||e.textContent||'').replace(/\s+/g,' ').includes(t)));if(el)el.click()},{t,visSrc:vis});await page.waitForTimeout(450)}
for (const s of ["START NEW CAREER","ARCH","QB Quarterback","PLAY 8-GAME SEASON","Balanced Program"]) await click(s)
const r = await page.evaluate(() => {
  const bps = window.buildPlayScript
  const dims = { PLAY_L:6, PLAY_R:714, F_TOP:14, F_BOT:426 }
  const B={run:[0,0],pass:[0,0],incomplete:[0,0]}
  for (let g=0; g<25; g++){
    const gm = window.__simGameV2(60, "RB")
    for (const p of gm.plays){
      let scr; try { scr = bps(Object.assign({}, p), { dims, rand: Math.random }); } catch(e){ continue }
      if (!B[p.event]) continue
      const hit = scr && scr.meta && scr.meta.fieldSim ? 0 : 1
      B[p.event][hit]++   // [0]=fieldSim, [1]=fallback
    }
  }
  const pct=a=>a[0]+a[1]?+(a[0]/(a[0]+a[1])*100).toFixed(0):0
  return { run:{n:B.run[0]+B.run[1], fsPct:pct(B.run)}, pass:{n:B.pass[0]+B.pass[1], fsPct:pct(B.pass)}, incomplete:{n:B.incomplete[0]+B.incomplete[1], fsPct:pct(B.incomplete)} }
})
console.log('ACTUAL render path:', JSON.stringify(r))
await b.close()
