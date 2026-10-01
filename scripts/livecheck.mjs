// v166 B check: EVERY ROUTE IS LIVE. Loads the engine without the image payloads (no dev server), runs the readcheck roster
// through __FieldSim.pass over three seeded streams with v166 B on and off, and asserts:
//   1. the scan's windows are live: a decoy the QB looks at twice in a play can read two different windows (before: one
//      number from the snap, every look);
//   2. a second defender on the target squeezes his window (help ticks happen) and the check-down / throw-ahead reads
//      choose off the live field;
//   3. the passing game does not lurch: completion rate and YPA stay within a band of the old engine's;
//   4. the kill switch (v166Blive 0) freezes the decoy windows again.
//   node scripts/livecheck.mjs
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
  const player=(pos,i,side)=>{ const a=Object.fromEntries(SK.map(k=>[k,side==='off'?58:57]))
    if(pos==='QB')Object.assign(a,{throwing:69,awareness:75,vision:64}); if(pos==='WR')Object.assign(a,{speed:67,agility:66,catching:63})
    if(pos==='OL')Object.assign(a,{blocking:65,strength:67,speed:43}); if(pos==='CB')Object.assign(a,{coverage:62,speed:66,agility:63}); if(pos==='S')Object.assign(a,{coverage:60,speed:63,awareness:61})
    if(pos==='LB')Object.assign(a,{tackling:62,awareness:57,strength:63,speed:57}); if(pos==='DL')Object.assign(a,{strength:66,tackling:62})
    return {id:side+pos+i,pos,attrs:a,body:{height:73}} }
  const att=(p,k)=>Number(p&&p.attrs&&p.attrs[k]!=null?p.attrs[k]:55)
  const FS=window.__FieldSim
  const cell=(tu)=>{ window.RIB_TUNE=Object.assign({},tu); const V0={...(window.__V166B||{})}; let n=0,cmp=0,yds=0,multi=0,varied=0
    for (const s0 of [0xC0FFEE,0xBEEF,0xD00D]) { reseed(s0); for (let i=0;i<180;i++) {
      const off=POS_OFF.map((p,j)=>player(p,j,'off')), def=POS_DEF.map((p,j)=>player(p,j,'def'))
      const r=FS.pass(true,{off},{def},off[8],off[0],def[0],att,'dropback',{down:1,toGo:10,fieldPos:40}); if(!r) continue
      n++; if (r.complete) { cmp++; yds+=Number(r.yards)||0 }
      const evs=(FS._Q[FS._Q.length-1].log||{}).events||[], by={}
      for (const e of evs) if (e.type==='look' && e.to) (by[e.to]=by[e.to]||[]).push(e.sep)
      for (const k in by) if (by[k].length>=2) { multi++; if (new Set(by[k].map(v=>(+v).toFixed(2))).size>1) varied++ } } }
    const V1=window.__V166B||{}
    return { n, cmpPct:+(100*cmp/Math.max(1,n)).toFixed(1), ypa:+(yds/Math.max(1,n)).toFixed(2), multi, variedPct:+(100*varied/Math.max(1,multi)).toFixed(1),
      help:(V1.helpTicks||0)-(V0.helpTicks||0), liveCd:(V1.liveCheckdowns||0)-(V0.liveCheckdowns||0) } }
  const on=cell({}), off=cell({v166Blive:0}); window.RIB_TUNE={}; return {on,off} })
await browser.close()
const checks=[], ok=(n,p)=>checks.push({n,p:!!p}), {on,off}=out
ok(`the scan is live: a read looked at twice can show two windows (${on.variedPct}% of ${on.multi} repeat looks; ${off.variedPct}% with it off)`, on.variedPct >= 30 && on.variedPct > off.variedPct + 20)
ok(`a second man on the target squeezes his window (${on.help} help ticks) and the check-down reads the live field (${on.liveCd} live check-downs)`, on.help > 50 && on.liveCd > 0)
ok(`the passing game does not lurch: completions ${off.cmpPct}% -> ${on.cmpPct}%, ${off.ypa} -> ${on.ypa} yards an attempt`, Math.abs(on.cmpPct-off.cmpPct) <= 8 && Math.abs(on.ypa-off.ypa) <= 1.6)
ok(`kill switch v166Blive 0: no help, no live check-downs (${off.help}, ${off.liveCd})`, off.help === 0 && off.liveCd === 0)
ok('no page errors', errs.length===0)
for (const c of checks) console.log((c.p?'ok   ':'FAIL ')+c.n)
const fails=checks.filter(c=>!c.p).length
console.log(JSON.stringify({pass:checks.length-fails,fail:fails,pageErrors:errs.length,out,errs:errs.slice(0,2)}))
process.exit(fails?1:0)
