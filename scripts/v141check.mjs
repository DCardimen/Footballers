// v141 dev check: EVERY STAT IS ON THE FIELD. Loads the engine without the image payloads (no dev
// server), patches FieldSim's makeAgents to hand back the agents it built, and asserts:
//   1. every one of the 17 sheet stats moves its own agent field when swung 10 -> 350, at Pee Wee AND
//      at the DFL (the nine that used to be a flat 45 included), and durability moves the FieldSim
//      speed-through-contact read;
//   2. the AI's average on every agent field sits in a league-neutral band at both levels (no field
//      parks at 80 for kids and 21 for pros any more);
//   3. the 5x band has resolution: 250 vs 350 on the sheet lands >= 8 agent points apart at the DFL;
//   4. simScaleV141 / kneeV141 / the star floor read as documented.
// Usage: node scripts/v141check.mjs   (GAMES per cell via CELLS, default 1)
import fs from 'node:fs'
import { chromium } from 'playwright'
import { readGameHtml } from './lib/layout.mjs'   // v149 A: index.html + src/ put back together
const html = readGameHtml()
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1])
const needle = 'return { off, def, all: off.concat(def) };'
const patch = 'if(root.__AP){root.__AP.push(off.concat(def).map(a=>({lb:a.lb,you:!!(a.player&&a.player.you),spdA:a.spdA,burst:a.burst,accel:a.accel,quick:a.quick,agi:a.agi,str:a.str,cat:a.cat,thr:a.thr,tkl:a.tkl,blk:a.blk,aware:a.aware,vis:a.vis,grit:a.grit,stam:a.stam,dur:a.dur,jump:a.jump,bc:a.bc,disc:a.disc,cov:a.cov})))}' + needle
let hit = 0
const runtime = [0,1,2,3,4,7].map(i=>scripts[i]).map(s=>{ let l=s.replace(/data:image\/[^;"']+;base64,[A-Za-z0-9+/=]+/g,'data:image/png;base64,'); if(l.includes(needle)){l=l.replace(needle,patch);hit++} return l })
if(!hit) throw new Error('could not patch makeAgents')
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport:{width:520,height:900} })
const errs=[]; page.on('pageerror', e=>errs.push(e.message))
await page.setContent(`<!doctype html><html><body><div id="splash"><div class="splash-title"><b></b></div></div><div id="app"><span id="prestigeCount"></span><span id="ppCount"></span><div id="screen"></div><div id="dock"></div></div><div id="pwaStatus"></div><div id="toast"></div><div id="cinemaFlash"></div><div id="momentBanner"></div></body></html>`)
for (const s of runtime) await page.addScriptTag({ content: s })
await page.waitForFunction(()=>typeof window.__simGameV2==='function' && typeof window.__getGridironState==='function')
const CELLS = Math.max(1, Number(process.env.CELLS || 1))
const out = await page.evaluate((CELLS)=>{
  const SHEET={speed:'spdA',acceleration:'burst',quickness:'quick',agility:'agi',strength:'str',catching:'cat',throwing:'thr',tackling:'tkl',blocking:'blk',awareness:'aware',vision:'vis',grit:'grit',stamina:'stam',jumping:'jump',ballControl:'bc',discipline:'disc'}
  const names=Object.keys(SHEET).concat(['injuryResist'])
  const st=window.__getGridironState(); st.prestige=0; st.tree={}; st.rosterPrestigeV158={}; st._tempStatBuffsV25=null
  window.__youStatBoostPctV20=0; window.__youTempBuffsV25=null; window.__gameScriptBiasV23=null
  let seed=0x51a7e; Math.random=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let v=Math.imul(seed^seed>>>15,1|seed);v=v+Math.imul(v^v>>>7,61|v)^v;return((v^v>>>14)>>>0)/4294967296}
  const avg=(a,k)=>a.length?a.reduce((s,x)=>s+x[k],0)/a.length:null
  const run=(level,pos,attrs)=>{ st.player={level,pos,name:'P',attrs}; window.__AP=[]; window.__V141F=null
    for(let g=0;g<CELLS;g++) window.__simGameV2(9+g,pos)
    const you=[],ai=[]; window.__AP.forEach(sn=>sn.forEach(a=>{(a.you?you:ai).push(a)})); return {you,ai,F:window.__V141F} }
  const flat=v=>Object.fromEntries(names.map(n=>[n,v]))
  const runN=(level,pos,attrs)=>{ st.player={level,pos,name:'P',attrs}; window.__AP=[]; window.__V141F=null; for(let g=0;g<4;g++) window.__simGameV2(9+g,pos); const you=[],ai=[]; window.__AP.forEach(sn=>sn.forEach(a=>{(a.you?you:ai).push(a)})); return {you,ai,F:window.__V141F} }
  const res={swing:[],aiBands:[],band250:{},curve:{},durability:{},errors:[]}
  for (const level of [0,7]) {
    for (const [key,field] of Object.entries(SHEET)) {
      const lo=run(level,'LB',Object.assign(flat(200),{[key]:10})), hi=run(level,'LB',Object.assign(flat(200),{[key]:350}))
      res.swing.push({level,key,field,lo:+avg(lo.you,field).toFixed(1),hi:+avg(hi.you,field).toFixed(1)})
    }
    const base=run(level,'LB',flat(200))
    for (const field of ['spdA','burst','accel','quick','agi','str','cat','thr','tkl','blk','aware','vis','grit','stam','dur','jump','bc','disc','cov'])
      res.aiBands.push({level,field,ai:+avg(base.ai,field).toFixed(1)})
  }
  // the 5x band, at the DFL, for the most compressed position (RB)
  const a250=run(7,'RB',flat(250)), a350=run(7,'RB',flat(350)), l250=run(7,'LB',flat(250)), l350=run(7,'LB',flat(350))
  res.band250={spd250:+avg(a250.you,'spdA').toFixed(1),spd350:+avg(a350.you,'spdA').toFixed(1),grit250:+avg(a250.you,'grit').toFixed(1),grit350:+avg(a350.you,'grit').toFixed(1),lbSpd250:+avg(l250.you,'spdA').toFixed(1),lbSpd350:+avg(l350.you,'spdA').toFixed(1)}
  // durability: carriers at 10 vs 350 keep a different share of their speed through a hit
  const dLo=runN(7,'RB',Object.assign(flat(200),{injuryResist:10})), dHi=runN(7,'RB',Object.assign(flat(200),{injuryResist:350}))
  res.durability={durLo:+avg(dLo.you,'dur').toFixed(1),durHi:+avg(dHi.you,'dur').toFixed(1),hitsLo:dLo.F&&dLo.F.youHits,keepLo:dLo.F&&dLo.F.youHits?+(dLo.F.youKeep/dLo.F.youHits).toFixed(3):null,hitsHi:dHi.F&&dHi.F.youHits,keepHi:dHi.F&&dHi.F.youHits?+(dHi.F.youKeep/dHi.F.youHits).toFixed(3):null}
  const V=window.__V141; res.curve={s100:+V.simScale(100).toFixed(1),s215:+V.simScale(215).toFixed(1),s250:+V.simScale(250).toFixed(1),s350:+V.simScale(350).toFixed(1),knee100:window.__kneeV141(100),knee150:window.__kneeV141(150),floorMin:V.floorMin(),rosterKeys:V.rosterKeys().length}
  return res
}, CELLS)
await browser.close()
const checks=[]
const ok=(name,pass,detail)=>checks.push({name,pass:!!pass,detail})
for (const s of out.swing) ok(`L${s.level} ${s.key} -> ${s.field} moves (10: ${s.lo}, 350: ${s.hi})`, s.hi-s.lo>=12, s)
for (const b of out.aiBands) ok(`L${b.level} AI ${b.field} league-neutral (${b.ai})`, b.ai>=34&&b.ai<=68, b)
ok(`DFL RB 250 vs 350 speed >= 3 apart under the carrier ceiling (${out.band250.spd250} -> ${out.band250.spd350})`, out.band250.spd350-out.band250.spd250>=3)
ok(`DFL LB 250 vs 350 speed >= 8 apart (${out.band250.lbSpd250} -> ${out.band250.lbSpd350})`, out.band250.lbSpd350-out.band250.lbSpd250>=8)
ok(`DFL RB 250 vs 350 grit >= 3 apart under the carrier ceiling (${out.band250.grit250} -> ${out.band250.grit350})`, out.band250.grit350-out.band250.grit250>=3)
ok(`durability reaches the agent (${out.durability.durLo} -> ${out.durability.durHi})`, out.durability.durHi-out.durability.durLo>=12)
ok(`durability keeps speed through contact (keep ${out.durability.keepLo} -> ${out.durability.keepHi}, hits ${out.durability.hitsLo}/${out.durability.hitsHi})`, out.durability.hitsHi>0 && out.durability.keepHi>out.durability.keepLo+0.12)
ok(`simScale 250 ~ 116, 350 ~ 172 (${out.curve.s250}, ${out.curve.s350})`, Math.abs(out.curve.s250-115.5)<3 && Math.abs(out.curve.s350-172)<4)
ok(`knee eases to 99 (100 -> ${out.curve.knee100}, 150 -> ${out.curve.knee150})`, out.curve.knee100>=88&&out.curve.knee100<=92&&out.curve.knee150>93&&out.curve.knee150<=99)
ok(`roster carries every key (${out.curve.rosterKeys})`, out.curve.rosterKeys>=21)
ok('no page errors', errs.length===0, errs.slice(0,3))
console.log(JSON.stringify({band250:out.band250,durability:out.durability,curve:out.curve,pageErrors:errs.length}))
for (const c of checks) console.log((c.pass?'PASS  ':'FAIL  ')+c.name)
const fails=checks.filter(c=>!c.pass).length
console.log(`${checks.length-fails}/${checks.length} passed`)
process.exit(fails?1:0)
