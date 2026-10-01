// v166 G check: THE DEFENSE PURSUES AS ONE. Loads the engine without the image payloads (no dev server), runs the readcheck
// roster through __FieldSim.run over three seeded streams with the DEFENSE's awareness and discipline at 35 and 90 (same
// bodies) and asserts:
//   1. a sharp defense keeps inside leverage (leverage ticks) and a dull one's last man is not exempt from his angle;
//   2. a sharp defense gives up fewer yards a carry and fewer house calls (runs of 25+) than a dull one;
//   3. an ordinary defense holds (YPC within a band of the old pursuit);
//   4. the kill switch (v166Gteam 0) does nothing.
//   node scripts/teamdefcheck.mjs
import { gameScripts } from './lib/layout.mjs'
import { launch } from './lib/env.mjs'
const runtime = gameScripts(['inline:0','inline:1','inline:2','src/03-splash.js','src/04-engine.js','src/07-career-app.js']).map(s=>s.replace(/data:image\/[^;"']+;base64,[A-Za-z0-9+/=]+/g,'data:image/png;base64,'))
const browser = await launch(); const page = await browser.newPage()
const errs=[]; page.on('pageerror', e=>errs.push(e.message))
await page.setContent(`<!doctype html><html><body><div id="splash"><div class="splash-title"><b></b></div></div><div id="app"><span id="prestigeCount"></span><span id="ppCount"></span><div id="screen"></div><div id="dock"></div></div><div id="pwaStatus"></div><div id="toast"></div><div id="cinemaFlash"></div><div id="momentBanner"></div></body></html>`)
for (const s of runtime) await page.addScriptTag({ content: s })
await page.waitForFunction(()=>window.__FieldSim)
const out = await page.evaluate(() => {
  let seed=0; const reseed=s=>{seed=s; Math.random=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let v=Math.imul(seed^seed>>>15,1|seed);v=v+Math.imul(v^v>>>7,61|v)^v;return((v^v>>>14)>>>0)/4294967296}}
  const st=window.__getGridironState(); st.player={level:4,pos:'LB',name:'P',attrs:{}}
  const POS_OFF=['WR','WR','TE','OL','OL','OL','OL','OL','QB','RB','WR'], POS_DEF=['CB','CB','S','S','LB','LB','LB','DL','DL','DL','DL']
  const SK=['speed','quickness','acceleration','burst','strength','blocking','tackling','coverage','agility','awareness','catching','jumping','throwing','vision','stamina','grit','discipline','ballControl']
  const player=(pos,i,side,over)=>{ const a=Object.fromEntries(SK.map(k=>[k,side==='off'?58:57]))
    if(pos==='RB')Object.assign(a,{speed:68,acceleration:70,burst:69,agility:72,quickness:70,vision:64,ballControl:64,strength:66,jumping:66})
    if(pos==='WR')Object.assign(a,{speed:67,agility:66}); if(pos==='OL')Object.assign(a,{blocking:65,strength:67,speed:43})
    if(pos==='CB')Object.assign(a,{coverage:62,speed:66,agility:63}); if(pos==='LB')Object.assign(a,{tackling:62,awareness:57,strength:63,speed:57}); if(pos==='DL')Object.assign(a,{strength:66,tackling:62})
    Object.assign(a,(over&&over[pos])||{}); return {id:side+pos+i,pos,attrs:a,body:{height:73}} }
  const att=(p,k)=>Number(p&&p.attrs&&p.attrs[k]!=null?p.attrs[k]:55)
  const FS=window.__FieldSim
  const cell=(defO,tu)=>{ window.RIB_TUNE=Object.assign({},tu||{}); const V0={...(window.__V166G||{})}; let n=0,y=0,big=0
    for (const s0 of [0xC0FFEE,0xBEEF,0xD00D]) { reseed(s0); for (let i=0;i<200;i++) {
      const off=POS_OFF.map((p,j)=>player(p,j,'off')), def=POS_DEF.map((p,j)=>player(p,j,'def',defO))
      const r=FS.run(true,{off},{def},off[9],att,i%2?'inside':'sweep',{down:1,toGo:10,fieldPos:40}); if(!r) continue; n++; const yy=Number(r.yards)||0; y+=yy; if (yy>=25) big++ } }
    const V1=window.__V166G||{}
    return { n, ypc:+(y/Math.max(1,n)).toFixed(2), bigPct:+(100*big/Math.max(1,n)).toFixed(1), lev:(V1.levTicks||0)-(V0.levTicks||0), dullLast:(V1.dullLastMen||0)-(V0.dullLastMen||0) } }
  const IQ=v=>Object.fromEntries(['CB','S','LB','DL'].map(p=>[p,{awareness:v,discipline:v}]))
  const R={}
  R.sharp=cell(IQ(90)); R.dull=cell(IQ(35)); R.base=cell({}); R.off=cell({},{v166Gteam:0})
  window.RIB_TUNE={}; return R })
await browser.close()
const checks=[], ok=(n,p)=>checks.push({n,p:!!p}), R=out
ok(`a sharp defense keeps inside leverage (${R.sharp.lev} ticks, dull ${R.dull.lev}) and a dull last man is not exempt from his angle (${R.dull.dullLast} plays)`, R.sharp.lev > 200 && R.dull.lev === 0 && R.dull.dullLast > 50)
ok(`a sharp defense gives up less: ${R.sharp.ypc} YPC / ${R.sharp.bigPct}% house calls, a dull one ${R.dull.ypc} / ${R.dull.bigPct}%`, R.sharp.ypc < R.dull.ypc - 0.5 && R.sharp.bigPct <= R.dull.bigPct)
ok(`an ordinary defense holds: ${R.off.ypc} -> ${R.base.ypc} YPC`, Math.abs(R.base.ypc - R.off.ypc) <= 1.0)
ok(`kill switch v166Gteam 0: nothing (${R.off.lev}, ${R.off.dullLast})`, R.off.lev === 0 && R.off.dullLast === 0)
ok('no page errors', errs.length===0)
for (const c of checks) console.log((c.p?'ok   ':'FAIL ')+c.n)
const fails=checks.filter(c=>!c.p).length
console.log(JSON.stringify({pass:checks.length-fails,fail:fails,pageErrors:errs.length,out:R,errs:errs.slice(0,2)}))
process.exit(fails?1:0)
