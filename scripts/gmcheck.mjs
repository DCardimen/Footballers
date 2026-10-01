// v166 I check: FOURTH DOWN BY THE NUMBERS. Loads the engine without the image payloads (no dev server), plays seeded
// simGameV2 games at the UFF (window.__V166I.log) and asserts:
//   1. short yardage in plus-ish territory is a go, long yardage in his own end is a kick;
//   2. trailing late goes more than leading late;
//   3. a Pee Wee staff keeps the old instinct (the model makes no decisions there);
//   4. the kill switch (v166Igm 0) makes none at the UFF either.
//   node scripts/gmcheck.mjs   (GAMES, default 16)
import { gameScripts } from './lib/layout.mjs'
import { launch } from './lib/env.mjs'
const runtime = gameScripts(['inline:0','inline:1','inline:2','src/03-splash.js','src/04-engine.js','src/07-career-app.js']).map(s=>s.replace(/data:image\/[^;"']+;base64,[A-Za-z0-9+/=]+/g,'data:image/png;base64,'))
const browser = await launch(); const page = await browser.newPage()
const errs=[]; page.on('pageerror', e=>errs.push(e.message))
await page.setContent(`<!doctype html><html><body><div id="splash"><div class="splash-title"><b></b></div></div><div id="app"><span id="prestigeCount"></span><span id="ppCount"></span><div id="screen"></div><div id="dock"></div></div><div id="pwaStatus"></div><div id="toast"></div><div id="cinemaFlash"></div><div id="momentBanner"></div></body></html>`)
for (const s of runtime) await page.addScriptTag({ content: s })
await page.waitForFunction(()=>window.__simGameV2)
const GAMES = Math.max(6, Number(process.env.GAMES || 16))
const out = await page.evaluate((GAMES) => {
  let seed=0; const reseed=s=>{seed=s; Math.random=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let v=Math.imul(seed^seed>>>15,1|seed);v=v+Math.imul(v^v>>>7,61|v)^v;return((v^v>>>14)>>>0)/4294967296}}
  const st=window.__getGridironState(); st.prestige=0; st.tree={}
  const names=['speed','acceleration','quickness','agility','strength','catching','throwing','tackling','blocking','awareness','vision','grit','stamina','jumping','ballControl','discipline','injuryResist']
  const cell=(level,tu)=>{ window.RIB_TUNE=Object.assign({},tu||{}); st.player={level,pos:'LB',name:'P',attrs:Object.fromEntries(names.map(n=>[n,150]))}
    window.__V166I={decisions:0,go:0,log:[]}
    for (let g=0; g<GAMES; g++) { reseed(7100+g*13); window.__simGameV2(9+g,'LB') }
    const W=window.__V166I; window.__V166I={decisions:0,go:0,log:null}; return W }
  const uff=cell(7), kid=cell(0), off=cell(7,{v166Igm:0})
  const L=uff.log, rate=a=>a.length?+(100*a.filter(e=>e.go).length/a.length).toFixed(1):null
  const shortPlus=L.filter(e=>e.toGo<=2&&e.pos>=35&&e.pos<=85), longOwn=L.filter(e=>e.toGo>=8&&e.pos<=45&&!(e.quarter>=4&&e.margin<0))
  const behindLate=L.filter(e=>e.quarter>=4&&e.margin<0&&e.toGo<=6), aheadLate=L.filter(e=>e.quarter>=4&&e.margin>0&&e.toGo<=6)
  window.RIB_TUNE={}
  return { uff:{decisions:uff.decisions, go:uff.go}, shortPlus:{n:shortPlus.length, go:rate(shortPlus)}, longOwn:{n:longOwn.length, go:rate(longOwn)},
    behindLate:{n:behindLate.length, go:rate(behindLate)}, aheadLate:{n:aheadLate.length, go:rate(aheadLate)}, kid:kid.decisions, off:off.decisions } }, GAMES)
await browser.close()
const checks=[], ok=(n,p)=>checks.push({n,p:!!p}), R=out
ok(`short yardage between his 35 and the 15 is a go (${R.shortPlus.go}% of ${R.shortPlus.n}), long yardage in his own end a kick (${R.longOwn.go}% of ${R.longOwn.n})`, R.shortPlus.n >= 5 && R.shortPlus.go >= 60 && R.longOwn.n >= 10 && R.longOwn.go <= 10)
ok(`trailing late goes more than leading late (${R.behindLate.go}% of ${R.behindLate.n} vs ${R.aheadLate.go}% of ${R.aheadLate.n})`, R.behindLate.n >= 3 && (R.aheadLate.n === 0 || R.behindLate.go > R.aheadLate.go))
ok(`and it is a staff, not a gambler: it goes on ${(100*R.uff.go/Math.max(1,R.uff.decisions)).toFixed(1)}% of ${R.uff.decisions} fourth downs`, R.uff.go / Math.max(1, R.uff.decisions) <= 0.4)
ok(`a Pee Wee staff keeps its instinct (${R.kid} model decisions) and the kill switch makes none (${R.off})`, R.kid === 0 && R.off === 0 && R.uff.decisions > 20)
ok('no page errors', errs.length===0)
for (const c of checks) console.log((c.p?'ok   ':'FAIL ')+c.n)
const fails=checks.filter(c=>!c.p).length
console.log(JSON.stringify({pass:checks.length-fails,fail:fails,pageErrors:errs.length,out:R,errs:errs.slice(0,2)}))
process.exit(fails?1:0)
