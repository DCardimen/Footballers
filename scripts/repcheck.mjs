// v166 J check: THE FILM ROOM. Loads the engine without the image payloads (no dev server), plays seeded simGameV2 games for a
// UFF back with a hot and a cold last four weeks (`player.weekResults[].perf`) and asserts:
//   1. the defense that has watched a hot back's film keys him from the first snaps; a cold back's does not;
//   2. reading the film never writes the save (weekResults unchanged by the games);
//   3. the kill switch (v166Jfilm 0) leaves the early key at the game's own reading.
//   node scripts/repcheck.mjs
import { gameScripts } from './lib/layout.mjs'
import { launch } from './lib/env.mjs'
const runtime = gameScripts(['inline:0','inline:1','inline:2','src/03-splash.js','src/04-engine.js','src/07-career-app.js']).map(s=>s.replace(/data:image\/[^;"']+;base64,[A-Za-z0-9+/=]+/g,'data:image/png;base64,'))
const browser = await launch(); const page = await browser.newPage()
const errs=[]; page.on('pageerror', e=>errs.push(e.message))
await page.setContent(`<!doctype html><html><body><div id="splash"><div class="splash-title"><b></b></div></div><div id="app"><span id="prestigeCount"></span><span id="ppCount"></span><div id="screen"></div><div id="dock"></div></div><div id="pwaStatus"></div><div id="toast"></div><div id="cinemaFlash"></div><div id="momentBanner"></div></body></html>`)
for (const s of runtime) await page.addScriptTag({ content: s })
await page.waitForFunction(()=>window.__simGameV2)
const out = await page.evaluate(() => {
  let seed=0; const reseed=s=>{seed=s; Math.random=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let v=Math.imul(seed^seed>>>15,1|seed);v=v+Math.imul(v^v>>>7,61|v)^v;return((v^v>>>14)>>>0)/4294967296}}
  const st=window.__getGridironState(); st.prestige=0; st.tree={}
  const names=['speed','acceleration','quickness','agility','strength','catching','throwing','tackling','blocking','awareness','vision','grit','stamina','jumping','ballControl','discipline','injuryResist']
  const weeks=perf=>[1,2,3,4].map(i=>({week:i,played:true,perf,won:true})).concat([{week:5,played:false}])
  const cell=(perf,tu)=>{ window.RIB_TUNE=Object.assign({},tu||{}); st.player={level:7,pos:'RB',name:'P',attrs:Object.fromEntries(names.map(n=>[n,250])),weekResults:weeks(perf)}
    const before=JSON.stringify(st.player.weekResults); window.__V165Dlog=[]
    for (let g=0; g<4; g++) { reseed(8100+g*7); window.__simGameV2(9+g,'RB') }
    const early=window.__V165Dlog.filter(e=>e.def==='them' && e.n<4); window.__V165Dlog=null
    return { rep:(window.__V166J||{}).rep, earlyKey:+(early.reduce((a,e)=>a+e.keyYou,0)/Math.max(1,early.length)).toFixed(3), n:early.length, unchanged: JSON.stringify(st.player.weekResults)===before } }
  const R={ hot:cell(92), cold:cell(45), off:cell(92,{v166Jfilm:0}) }; window.RIB_TUNE={}; return R })
await browser.close()
const checks=[], ok=(n,p)=>checks.push({n,p:!!p}), R=out
ok(`a hot back is keyed from the first snaps (rep ${R.hot.rep}, early key ${R.hot.earlyKey}); a cold one is not (rep ${R.cold.rep}, ${R.cold.earlyKey})`, R.hot.earlyKey >= 0.4 && R.cold.earlyKey <= 0.05 && R.hot.n > 10)
ok(`reading the film never writes the save (${R.hot.unchanged && R.cold.unchanged})`, R.hot.unchanged && R.cold.unchanged)
ok(`kill switch v166Jfilm 0: the early key is the game's own (${R.off.earlyKey})`, R.off.earlyKey <= 0.05)
ok('no page errors', errs.length===0)
for (const c of checks) console.log((c.p?'ok   ':'FAIL ')+c.n)
const fails=checks.filter(c=>!c.p).length
console.log(JSON.stringify({pass:checks.length-fails,fail:fails,pageErrors:errs.length,out:R,errs:errs.slice(0,2)}))
process.exit(fails?1:0)
