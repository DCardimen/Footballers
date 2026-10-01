// v166 H check: THE OFFENSE HAS A COORDINATOR. Loads the engine without the image payloads (no dev server), plays seeded
// simGameV2 games with the defenses' blitz dial turned up and down (`dcBlitzMulV165D`), and asserts:
//   1. a UFF offense that keeps facing the blitz goes to the quick game and the screen far more than one that does not;
//   2. a Pee Wee coordinator adapts much less (the level's sense);
//   3. the kill switch (v166Hoc 0) leaves the concept mix where the blitz cannot move it.
//   node scripts/occheck.mjs   (GAMES per cell, default 6)
import { gameScripts } from './lib/layout.mjs'
import { launch } from './lib/env.mjs'
const runtime = gameScripts(['inline:0','inline:1','inline:2','src/03-splash.js','src/04-engine.js','src/07-career-app.js']).map(s=>s.replace(/data:image\/[^;"']+;base64,[A-Za-z0-9+/=]+/g,'data:image/png;base64,'))
const browser = await launch(); const page = await browser.newPage()
const errs=[]; page.on('pageerror', e=>errs.push(e.message))
await page.setContent(`<!doctype html><html><body><div id="splash"><div class="splash-title"><b></b></div></div><div id="app"><span id="prestigeCount"></span><span id="ppCount"></span><div id="screen"></div><div id="dock"></div></div><div id="pwaStatus"></div><div id="toast"></div><div id="cinemaFlash"></div><div id="momentBanner"></div></body></html>`)
for (const s of runtime) await page.addScriptTag({ content: s })
await page.waitForFunction(()=>window.__simGameV2)
const GAMES = Math.max(3, Number(process.env.GAMES || 6))
const out = await page.evaluate((GAMES) => {
  let seed=0; const reseed=s=>{seed=s; Math.random=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let v=Math.imul(seed^seed>>>15,1|seed);v=v+Math.imul(v^v>>>7,61|v)^v;return((v^v>>>14)>>>0)/4294967296}}
  const st=window.__getGridironState(); st.prestige=0; st.tree={}
  const names=['speed','acceleration','quickness','agility','strength','catching','throwing','tackling','blocking','awareness','vision','grit','stamina','jumping','ballControl','discipline','injuryResist']
  const cell=(level,tu)=>{ window.RIB_TUNE=Object.assign({},tu); st.player={level,pos:'LB',name:'P',attrs:Object.fromEntries(names.map(n=>[n,200]))}; window.__V166Hlog=[]
    for (let g=0; g<GAMES; g++) { reseed(6000+g*11); window.__simGameV2(9+g,'LB') }
    const late=window.__V166Hlog.filter(e=>e.pass && e.n>=8); window.__V166Hlog=null
    const q=late.filter(e=>e.concept==='quick'||e.concept==='screen').length
    return { n: late.length, quickPct: +(100*q/Math.max(1,late.length)).toFixed(1), blitzSeen: +(late.reduce((a,e)=>a+e.blitzSeen,0)/Math.max(1,late.length)).toFixed(3) } }
  const R={}
  R.uffHot=cell(7,{dcBlitzMulV165D:2.6}); R.uffCold=cell(7,{dcBlitzMulV165D:0.3})
  R.kidHot=cell(0,{dcBlitzMulV165D:2.6}); R.kidCold=cell(0,{dcBlitzMulV165D:0.3})
  R.offHot=cell(7,{dcBlitzMulV165D:2.6,v166Hoc:0}); R.offCold=cell(7,{dcBlitzMulV165D:0.3,v166Hoc:0})
  window.RIB_TUNE={}; return R }, GAMES)
await browser.close()
const checks=[], ok=(n,p)=>checks.push({n,p:!!p}), R=out
const dU=+(R.uffHot.quickPct-R.uffCold.quickPct).toFixed(1), dK=+(R.kidHot.quickPct-R.kidCold.quickPct).toFixed(1), dO=+(R.offHot.quickPct-R.offCold.quickPct).toFixed(1)
ok(`a UFF offense that keeps facing the blitz gets the ball out: quick game and screens ${R.uffCold.quickPct}% -> ${R.uffHot.quickPct}% of late passes (blitz seen ${R.uffCold.blitzSeen} -> ${R.uffHot.blitzSeen})`, dU >= 8)
ok(`a Pee Wee coordinator adapts far less (+${dK} points against +${dU})`, dK < dU * 0.6)
ok(`kill switch v166Hoc 0: the blitz no longer moves the mix much (+${dO} points)`, dO < dU * 0.5)
ok('no page errors', errs.length===0)
for (const c of checks) console.log((c.p?'ok   ':'FAIL ')+c.n)
const fails=checks.filter(c=>!c.p).length
console.log(JSON.stringify({pass:checks.length-fails,fail:fails,pageErrors:errs.length,out:R,errs:errs.slice(0,2)}))
process.exit(fails?1:0)
