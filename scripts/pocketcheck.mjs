// v166 E check: POCKET PRESENCE. Loads the engine without the image payloads (no dev server), runs the readcheck roster with a
// strong front through __FieldSim.pass over three seeded streams and asserts:
//   1. under a strong rush a sharp passer moves and the ball still comes out (completions), and moving costs him no more
//      than a few hits (a FieldSim sack is the smart passer's choice — v82 — so sacks are not the measure here);
//   2. a sharp, mobile passer escapes a caving pocket and a dull one drifts back into it;
//   4. an ordinary passer's pocket does not lurch (hits a snap within a band of the old movement);
//   5. the kill switch (v166Epocket 0) feels, escapes and bails nothing.
//   node scripts/pocketcheck.mjs
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
    if(pos==='QB')Object.assign(a,{throwing:69,awareness:65,agility:66,speed:62}); if(pos==='WR')Object.assign(a,{speed:67,agility:66,catching:63})
    if(pos==='OL')Object.assign(a,{blocking:58,strength:60,speed:43,agility:44}); if(pos==='CB')Object.assign(a,{coverage:62,speed:66,agility:63})
    if(pos==='LB')Object.assign(a,{tackling:62,awareness:57,strength:63,speed:57}); if(pos==='DL')Object.assign(a,{strength:78,tackling:66,quickness:76,agility:72,speed:66,awareness:70})
    Object.assign(a,(over&&over[pos])||{}); return {id:side+pos+i,pos,attrs:a,body:{height:73}} }
  const att=(p,k)=>Number(p&&p.attrs&&p.attrs[k]!=null?p.attrs[k]:55)
  const FS=window.__FieldSim
  const cell=(offO,tu)=>{ window.RIB_TUNE=Object.assign({},tu||{}); const V0={...(window.__V166E||{})}; let n=0,hits=0,sacks=0,cmp=0
    for (const s0 of [0xC0FFEE,0xBEEF,0xD00D]) { reseed(s0); for (let i=0;i<150;i++) {
      const off=POS_OFF.map((p,j)=>player(p,j,'off',offO)), def=POS_DEF.map((p,j)=>player(p,j,'def'))
      const r=FS.pass(true,{off},{def},off[8],off[0],def[0],att,'dropback',{down:1,toGo:10,fieldPos:40}); if(!r) continue; n++
      if (r.sack) sacks++; if (r.complete) cmp++
      const evs=(FS._Q[FS._Q.length-1].log||{}).events||[]; if (evs.some(e=>e.type==='qbHit')) hits++ } }
    const V1=window.__V166E||{}
    return { n, hitPct:+(100*hits/Math.max(1,n)).toFixed(1), sackPct:+(100*sacks/Math.max(1,n)).toFixed(1), cmpPct:+(100*cmp/Math.max(1,n)).toFixed(1),
      escapes:(V1.escapes||0)-(V0.escapes||0), bails:(V1.bails||0)-(V0.bails||0), felt:(V1.felt||0)-(V0.felt||0) } }
  const R={}
  R.sharp=cell({QB:{awareness:95}}); R.dull=cell({QB:{awareness:30}})
  R.base=cell({}); R.baseOff=cell({},{v166Epocket:0}); R.sharpOff=cell({QB:{awareness:95}},{v166Epocket:0})
  window.RIB_TUNE={}; return R })
await browser.close()
const checks=[], ok=(n,p)=>checks.push({n,p:!!p}), R=out
ok(`under a strong rush a sharp passer moves and the ball still comes out: ${R.sharp.cmpPct}% completed, a dull one ${R.dull.cmpPct}%`, R.sharp.cmpPct >= R.dull.cmpPct + 10)
ok(`moving is not free, but it is not a beating either: hit on ${R.sharp.hitPct}% of snaps (dull ${R.dull.hitPct}%, an ordinary passer ${R.base.hitPct}%)`, R.sharp.hitPct <= R.base.hitPct + 8)
ok(`a sharp, mobile passer escapes a caving pocket (${R.sharp.escapes}) and a dull one drifts back into it (${R.dull.bails} bails, ${R.dull.escapes} escapes)`, R.sharp.escapes > 10 && R.dull.escapes === 0 && R.dull.bails > 10)
ok(`an ordinary passer's pocket holds: hit ${R.baseOff.hitPct}% -> ${R.base.hitPct}%, sacked ${R.baseOff.sackPct}% -> ${R.base.sackPct}%`, Math.abs(R.base.hitPct - R.baseOff.hitPct) <= 8 && Math.abs(R.base.sackPct - R.baseOff.sackPct) <= 4)
ok(`kill switch v166Epocket 0: nothing felt, escaped or bailed (${R.baseOff.felt}, ${R.sharpOff.escapes}, ${R.baseOff.bails})`, R.baseOff.felt === 0 && R.sharpOff.escapes === 0 && R.baseOff.bails === 0)
ok('no page errors', errs.length===0)
for (const c of checks) console.log((c.p?'ok   ':'FAIL ')+c.n)
const fails=checks.filter(c=>!c.p).length
console.log(JSON.stringify({pass:checks.length-fails,fail:fails,pageErrors:errs.length,out:R,errs:errs.slice(0,2)}))
process.exit(fails?1:0)
