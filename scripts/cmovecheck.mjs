// v166 F check: THE MOVE IS A CHOICE. Loads the engine without the image payloads (no dev server), runs the readcheck roster
// through __FieldSim.run over three seeded streams with the back's vision (his football IQ for this) at 35 and 90 and the same
// body, and asserts:
//   1. a sharp back picks the move that fits the tackler in front of him (fit rate) and a dull one runs his best move;
//   2. choosing pays: the sharp back wins more of his contacts (cut / hurdle / stiff-arm / broken tackle per contact);
//   3. the run game does not lurch for an ordinary back (YPC within a band of the old cascade);
//   4. the kill switch (v166Fmove 0) plans nothing.
//   node scripts/cmovecheck.mjs
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
  const FS=window.__FieldSim, WIN=new Set(['cut','hurdle','stiffarm','brokenTackle'])
  const cell=(offO,tu)=>{ window.RIB_TUNE=Object.assign({},tu||{}); const V0={...(window.__V166F||{})}; let n=0,y=0,contacts=0,wins=0
    for (const s0 of [0xC0FFEE,0xBEEF,0xD00D]) { reseed(s0); for (let i=0;i<160;i++) {
      const off=POS_OFF.map((p,j)=>player(p,j,'off',offO)), def=POS_DEF.map((p,j)=>player(p,j,'def'))
      const r=FS.run(true,{off},{def},off[9],att,'inside',{down:1,toGo:10,fieldPos:40}); if(!r) continue; n++; y+=Number(r.yards)||0
      const evs=(FS._Q[FS._Q.length-1].log||{}).events||[]
      for (const e of evs) { if (e.type==='tackleLunge' && e.carrier==='off9') contacts++; if (WIN.has(e.type) && (e.carrier==='off9'||e.who==='off9')) wins++ } } }
    const V1=window.__V166F||{}
    return { n, ypc:+(y/Math.max(1,n)).toFixed(2), winPct:+(100*wins/Math.max(1,contacts)).toFixed(1), contacts, plans:(V1.plans||0)-(V0.plans||0), fitPct:+(100*((V1.fit||0)-(V0.fit||0))/Math.max(1,(V1.plans||0)-(V0.plans||0))).toFixed(1) } }
  const R={}
  R.sharp=cell({RB:{vision:90}}); R.dull=cell({RB:{vision:35}}); R.base=cell({}); R.off=cell({},{v166Fmove:0})
  window.RIB_TUNE={}; return R })
await browser.close()
const checks=[], ok=(n,p)=>checks.push({n,p:!!p}), R=out
ok(`a sharp back picks the move that fits the tackler (${R.sharp.fitPct}% fit) and a dull one runs his best move (${R.dull.fitPct}%)`, R.sharp.fitPct >= 99 && R.dull.fitPct < 80)
ok(`choosing pays: the sharp back wins ${R.sharp.winPct}% of his contacts, the dull one ${R.dull.winPct}% (same body)`, R.sharp.winPct > R.dull.winPct + 2)
ok(`the run game holds for an ordinary back: ${R.off.ypc} -> ${R.base.ypc} YPC`, Math.abs(R.base.ypc - R.off.ypc) <= 1.2)
ok(`kill switch v166Fmove 0: no plans (${R.off.plans})`, R.off.plans === 0)
ok('no page errors', errs.length===0)
for (const c of checks) console.log((c.p?'ok   ':'FAIL ')+c.n)
const fails=checks.filter(c=>!c.p).length
console.log(JSON.stringify({pass:checks.length-fails,fail:fails,pageErrors:errs.length,out:R,errs:errs.slice(0,2)}))
process.exit(fails?1:0)
