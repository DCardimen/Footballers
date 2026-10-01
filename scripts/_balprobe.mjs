import { gameScripts } from './lib/layout.mjs'
import { launch } from './lib/env.mjs'
const runtime = gameScripts(['inline:0','inline:1','inline:2','src/03-splash.js','src/04-engine.js','src/07-career-app.js']).map(s=>s.replace(/data:image\/[^;"']+;base64,[A-Za-z0-9+/=]+/g,'data:image/png;base64,'))
const browser = await launch(); const page = await browser.newPage()
await page.setContent(`<!doctype html><html><body><div id="splash"><div class="splash-title"><b></b></div></div><div id="app"><span id="prestigeCount"></span><span id="ppCount"></span><div id="screen"></div><div id="dock"></div></div><div id="pwaStatus"></div><div id="toast"></div><div id="cinemaFlash"></div><div id="momentBanner"></div></body></html>`)
for (const s of runtime) await page.addScriptTag({ content: s })
await page.waitForFunction(()=>window.__simGameV2)
const cells = JSON.parse(process.env.CELLS || '[["off",{"v166Ablock":0}],["on",{}]]')
const out = await page.evaluate((cells) => {
  let seed=0; const reseed=s=>{seed=s; Math.random=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let v=Math.imul(seed^seed>>>15,1|seed);v=v+Math.imul(v^v>>>7,61|v)^v;return((v^v>>>14)>>>0)/4294967296}}
  const st=window.__getGridironState(); st.prestige=0; st.tree={}
  const names=['speed','acceleration','quickness','agility','strength','catching','throwing','tackling','blocking','awareness','vision','grit','stamina','jumping','ballControl','discipline','injuryResist']
  const res={}
  for (const [k,tu] of cells) { window.RIB_TUNE=Object.assign({},tu); const T={pts:0,ry:0,py:0,n:0}
    for (const L of [3,5,7]) { st.player={level:L,pos:'LB',name:'P',attrs:Object.fromEntries(names.map(n=>[n,90]))}
      for (let g=0; g<14; g++) { reseed(5000+g*7+L); const r=window.__simGameV2(9+g,'LB'); T.pts+=r.usScore+r.themScore; T.n++
        const tm=r.team||{}, ot=r.oppTeam||{}; T.ry+=(tm.rush||0)+(ot.rush||0); T.py+=(tm.pass||0)+(ot.pass||0) } }
    res[k]={pts:+(T.pts/T.n).toFixed(1), rush:+(T.ry/T.n/2).toFixed(1), pass:+(T.py/T.n/2).toFixed(1)} }
  window.RIB_TUNE={}; return res }, cells)
console.log(JSON.stringify(out)); await browser.close()
