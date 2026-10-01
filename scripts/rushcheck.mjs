// v166 D check: THE RUSH HAS MOVES. Loads the engine without the image payloads (no dev server), runs the readcheck roster
// through __FieldSim.pass over three seeded streams and asserts:
//   1. a smart rusher attacks the weakness in front of him: against a weak-anchored line he bull-rushes, against a
//      heavy-footed one he goes finesse (speed / swim / spin);
//   2. reading the man pays: smart rushers win more often than dull ones with the same body;
//   3. a smart tackle sets for the edge speed rush: fewer speed moves against him;
//   4. the pass rush as a whole does not lurch: wins a snap within a band of the old blend;
//   5. the kill switch (v166Drush 0) plans nothing.
//   node scripts/rushcheck.mjs
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
    if(pos==='QB')Object.assign(a,{throwing:69,awareness:65}); if(pos==='WR')Object.assign(a,{speed:67,agility:66,catching:63})
    if(pos==='OL')Object.assign(a,{blocking:65,strength:67,speed:43,agility:44}); if(pos==='CB')Object.assign(a,{coverage:62,speed:66,agility:63})
    if(pos==='LB')Object.assign(a,{tackling:62,awareness:57,strength:63,speed:57}); if(pos==='DL')Object.assign(a,{strength:66,tackling:62,quickness:62,agility:60,speed:60})
    Object.assign(a,(over&&over[pos])||{}); return {id:side+pos+i,pos,attrs:a,body:{height:73}} }
  const att=(p,k)=>Number(p&&p.attrs&&p.attrs[k]!=null?p.attrs[k]:55)
  const FS=window.__FieldSim
  const cell=(offO,defO,tu)=>{ window.RIB_TUNE=Object.assign({},tu||{}); const V=window.__V166D||{moves:{}}; const m0={...(V.moves||{})}, p0=V.plans||0; let n=0, sheds=0
    for (const s0 of [0xC0FFEE,0xBEEF,0xD00D]) { reseed(s0); for (let i=0;i<150;i++) {
      const off=POS_OFF.map((p,j)=>player(p,j,'off',offO)), def=POS_DEF.map((p,j)=>player(p,j,'def',defO))
      const r=FS.pass(true,{off},{def},off[8],off[0],def[0],att,'dropback',{down:1,toGo:10,fieldPos:40}); if(!r) continue; n++
      const evs=(FS._Q[FS._Q.length-1].log||{}).events||[]; sheds+=evs.filter(e=>e.type==='shed'||e.type==='swim').length } }
    const V1=window.__V166D||{moves:{}}, mv={}; for (const k of Object.keys(V1.moves||{})) mv[k]=(V1.moves[k]||0)-(m0[k]||0)
    const tot=Object.values(mv).reduce((a,b)=>a+b,0)||1, pct=k=>+(100*(mv[k]||0)/tot).toFixed(1)
    return { n, winsPerSnap:+(sheds/Math.max(1,n)).toFixed(3), plans:(V1.plans||0)-p0, bull:pct('bull'), speed:pct('speed'), swim:pct('swim'), spin:pct('spin') } }
  const R={}
  const smart={DL:{awareness:90}}, dull={DL:{awareness:30}}
  R.weakAnchor=cell({OL:{strength:40,blocking:60}},smart); R.heavyFeet=cell({OL:{agility:25,quickness:30}},smart)
  R.smart=cell({OL:{strength:55,agility:35}},smart); R.dull=cell({OL:{strength:55,agility:35}},dull)
  R.dumbOL=cell({OL:{awareness:30}},smart); R.smartOL=cell({OL:{awareness:95}},smart)
  R.base=cell({},{}); R.off=cell({},{},{v166Drush:0})
  window.RIB_TUNE={}; return R })
await browser.close()
const checks=[], ok=(n,p)=>checks.push({n,p:!!p}), R=out, fin=c=>+(c.speed+c.swim+c.spin).toFixed(1)
ok(`a smart rusher attacks the weakness: bull ${R.weakAnchor.bull}% against a weak anchor, finesse ${fin(R.heavyFeet)}% against heavy feet`, R.weakAnchor.bull >= 60 && fin(R.heavyFeet) >= 60)
ok(`reading the man pays: smart rushers win ${R.smart.winsPerSnap} a snap, dull ones ${R.dull.winsPerSnap} (same bodies, a line weak on its feet)`, R.smart.winsPerSnap > R.dull.winsPerSnap * 1.1)
ok(`a smart tackle sets for the speed rush: speed moves ${R.dumbOL.speed}% -> ${R.smartOL.speed}%`, R.smartOL.speed < R.dumbOL.speed)
ok(`the rush as a whole holds: ${R.off.winsPerSnap} wins a snap before, ${R.base.winsPerSnap} now`, Math.abs(R.base.winsPerSnap - R.off.winsPerSnap) <= Math.max(0.12, R.off.winsPerSnap * 0.3))
ok(`kill switch v166Drush 0: no plans (${R.off.plans})`, R.off.plans === 0)
ok('no page errors', errs.length===0)
for (const c of checks) console.log((c.p?'ok   ':'FAIL ')+c.n)
const fails=checks.filter(c=>!c.p).length
console.log(JSON.stringify({pass:checks.length-fails,fail:fails,pageErrors:errs.length,out:R,errs:errs.slice(0,2)}))
process.exit(fails?1:0)
