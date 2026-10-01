// v166 C check: THE ZONE IS A PLACE. Loads the engine without the image payloads (no dev server), runs the readcheck roster
// through __FieldSim.pass over three seeded streams with a called shell (man / cover 2 / cover 3) and asserts:
//   1. zone defenders play landmarks: at the throw, cover-3 corners stand deeper than man corners and cover-2 corners
//      shallower than cover-3 ones; zone ticks happen only in zone;
//   2. the shell shows on the field: go routes complete less against cover 3 than against man, and the curl's edge on the
//      go route (cover 3's soft spot underneath) is bigger against cover 3 than against man;
//   3. a zone man breaks on the ball once it is thrown;
//   4. the kill switch (v166Czone 0) leaves every shell on the old movement.
//   node scripts/zonecheck.mjs
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
    if(pos==='QB')Object.assign(a,{throwing:69,awareness:65,vision:64}); if(pos==='WR')Object.assign(a,{speed:67,agility:66,catching:63})
    if(pos==='OL')Object.assign(a,{blocking:65,strength:67,speed:43}); if(pos==='CB')Object.assign(a,{coverage:62,speed:66,agility:63}); if(pos==='S')Object.assign(a,{coverage:60,speed:63,awareness:61})
    if(pos==='LB')Object.assign(a,{tackling:62,awareness:57,strength:63,speed:57}); if(pos==='DL')Object.assign(a,{strength:66,tackling:62})
    return {id:side+pos+i,pos,attrs:a,body:{height:73}} }
  const att=(p,k)=>Number(p&&p.attrs&&p.attrs[k]!=null?p.attrs[k]:55)
  const FS=window.__FieldSim
  const dc=shell=>({runKey:0,keyYou:0,blitzP:0,iq:1,blitz:false,shell})
  const cell=(shell,routes,tu)=>{ window.RIB_TUNE=Object.assign({},tu||{}); const V0={...(window.__V166C||{})}; let n=0,cmp=0,yds=0,cbDepth=[],thr=0
    for (const s0 of [0xC0FFEE,0xBEEF,0xD00D]) { reseed(s0); for (let i=0;i<150;i++) {
      const off=POS_OFF.map((p,j)=>player(p,j,'off')), def=POS_DEF.map((p,j)=>player(p,j,'def'))
      const r=FS.pass(true,{off},{def},off[8],off[0],def[0],att,'dropback',{down:1,toGo:10,fieldPos:40,dcV165D:dc(shell),routes}); if(!r) continue
      n++; if (r.complete) { cmp++; yds+=Number(r.yards)||0 }
      const L=FS._Q[FS._Q.length-1].log, ev=(L.events||[]).find(e=>e.type==='throw'&&!e.away); if(!ev) continue; thr++
      const c5=(L.actors||[]).find(a=>a.id==='off5'), los=c5&&c5.frames[0]?c5.frames[0].x:0
      for (const id of ['def0','def1']) { const a=(L.actors||[]).find(x=>x.id===id); if(!a) continue; let f=a.frames[0]; for (const g of a.frames) if (g.t<=ev.t) f=g; cbDepth.push(f.x-los) } } }
    const V1=window.__V166C||{}; const m=a=>a.length?+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1):null
    return { n, cmpPct:+(100*cmp/Math.max(1,n)).toFixed(1), ypa:+(yds/Math.max(1,n)).toFixed(2), cbDepth:m(cbDepth), zone:(V1.zoneTicks||0)-(V0.zoneTicks||0), breaks:(V1.breaks||0)-(V0.breaks||0) } }
  const R={}
  R.man=cell('man'); R.c2=cell('cover2'); R.c3=cell('cover3')
  R.goMan=cell('man',['go','go','go','go']); R.goC3=cell('cover3',['go','go','go','go']); R.curlC3=cell('cover3',['curl','curl','curl','curl']); R.curlMan=cell('man',['curl','curl','curl','curl'])
  R.c3off=cell('cover3',null,{v166Czone:0})
  window.RIB_TUNE={}; return R })
await browser.close()
const checks=[], ok=(n,p)=>checks.push({n,p:!!p}), R=out
ok(`zone defenders play landmarks: corners at the throw stand ${R.man.cbDepth} px deep in man, ${R.c2.cbDepth} in cover 2, ${R.c3.cbDepth} in cover 3`, R.c3.cbDepth > R.man.cbDepth + 10 && R.c2.cbDepth < R.c3.cbDepth - 20)
ok(`zone ticks happen only in zone (man ${R.man.zone}, cover 2 ${R.c2.zone}, cover 3 ${R.c3.zone})`, R.man.zone === 0 && R.c2.zone > 1000 && R.c3.zone > 1000)
ok(`go routes die against cover 3 (${R.goMan.cmpPct}% / ${R.goMan.ypa} against man -> ${R.goC3.cmpPct}% / ${R.goC3.ypa})`, R.goC3.cmpPct < R.goMan.cmpPct && R.goC3.ypa < R.goMan.ypa - 1)
ok(`and cover 3's soft spot is underneath: the curl's edge on the go route is bigger against cover 3 (${R.curlC3.cmpPct}% vs ${R.goC3.cmpPct}%) than against man (${R.curlMan.cmpPct}% vs ${R.goMan.cmpPct}%)`, (R.curlC3.cmpPct - R.goC3.cmpPct) > (R.curlMan.cmpPct - R.goMan.cmpPct) + 2)
ok(`a zone man breaks on the ball (${R.c2.breaks + R.c3.breaks} breaks)`, R.c2.breaks + R.c3.breaks > 50)
ok(`the passing game holds: man ${R.man.cmpPct}% / ${R.man.ypa}, cover 2 ${R.c2.cmpPct}% / ${R.c2.ypa}, cover 3 ${R.c3.cmpPct}% / ${R.c3.ypa}`, [R.c2, R.c3].every(c => Math.abs(c.cmpPct - R.man.cmpPct) <= 12 && Math.abs(c.ypa - R.man.ypa) <= 3))
ok(`kill switch v166Czone 0: no zone ticks (${R.c3off.zone})`, R.c3off.zone === 0)
ok('no page errors', errs.length===0)
for (const c of checks) console.log((c.p?'ok   ':'FAIL ')+c.n)
const fails=checks.filter(c=>!c.p).length
console.log(JSON.stringify({pass:checks.length-fails,fail:fails,pageErrors:errs.length,out:R,errs:errs.slice(0,2)}))
process.exit(fails?1:0)
