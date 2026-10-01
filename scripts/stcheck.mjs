// v166 K check: SPECIAL TEAMS THINK. Loads the engine without the image payloads (no dev server) and asserts:
//   1. a sharp returner reads the coverage: with a gunner on him he fair-catches (a dull one keeps the flat roll), and with
//      room he returns it (the yards after the catch are the coverage's, so the decision is what is measured);
//   2. an ordinary returner's fair-catch rate stays in the old band;
//   3. a staff with the sense for it fakes a punt (the dial forced up), the row says "Fake punt!", and the play is a real
//      run or pass.
//   node scripts/stcheck.mjs
import { gameScripts } from './lib/layout.mjs'
import { launch } from './lib/env.mjs'
const runtime = gameScripts(['inline:0','inline:1','inline:2','src/03-splash.js','src/04-engine.js','src/07-career-app.js']).map(s=>s.replace(/data:image\/[^;"']+;base64,[A-Za-z0-9+/=]+/g,'data:image/png;base64,'))
const browser = await launch(); const page = await browser.newPage()
const errs=[]; page.on('pageerror', e=>errs.push(e.message))
await page.setContent(`<!doctype html><html><body><div id="splash"><div class="splash-title"><b></b></div></div><div id="app"><span id="prestigeCount"></span><span id="ppCount"></span><div id="screen"></div><div id="dock"></div></div><div id="pwaStatus"></div><div id="toast"></div><div id="cinemaFlash"></div><div id="momentBanner"></div></body></html>`)
for (const s of runtime) await page.addScriptTag({ content: s })
await page.waitForFunction(()=>window.__FieldSim && window.__simGameV2)
const out = await page.evaluate(() => {
  let seed=0; const reseed=s=>{seed=s; Math.random=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let v=Math.imul(seed^seed>>>15,1|seed);v=v+Math.imul(v^v>>>7,61|v)^v;return((v^v>>>14)>>>0)/4294967296}}
  const st=window.__getGridironState(); st.player={level:4,pos:'LB',name:'P',attrs:{}}
  const POS_OFF=['WR','WR','TE','OL','OL','OL','OL','OL','QB','RB','WR'], POS_DEF=['CB','CB','S','S','LB','LB','LB','DL','DL','DL','DL']
  const SK=['speed','quickness','acceleration','burst','strength','blocking','tackling','coverage','agility','awareness','catching','jumping','throwing','vision','stamina','grit','discipline','ballControl']
  const player=(pos,i,side,over)=>{ const a=Object.fromEntries(SK.map(k=>[k,side==='off'?58:57])); Object.assign(a,(over&&over[pos])||{}); return {id:side+pos+i,pos,attrs:a,body:{height:73}} }
  const att=(p,k)=>Number(p&&p.attrs&&p.attrs[k]!=null?p.attrs[k]:55)
  const FS=window.__FieldSim
  const punts=(defO,tu)=>{ window.RIB_TUNE=Object.assign({},tu||{}); const KS={...(window.__V166K||{})}, K0=KS.reads||0; let n=0,fair=0,ret=0,stuffed=0,retY=0
    for (const s0 of [0xF00D,0xBEEF,0xD00D]) { reseed(s0); for (let i=0;i<200;i++) {
      const off=POS_OFF.map((p,j)=>player(p,j,'off')), def=POS_DEF.map((p,j)=>player(p,j,'def',defO))
      const r=FS.punt(true,{off},{def},att,{gross:40,deep:35,pos:35,goalLx:-35*5.88}); if(!r) continue; n++
      if (r.fair) fair++; else { ret++; retY += (r.ret||0); if ((r.ret||0) <= 1) stuffed++ } } }
    return { n, fairPct:+(100*fair/Math.max(1,n)).toFixed(1), stuffedPct:+(100*stuffed/Math.max(1,ret)).toFixed(1), avgRet:+(retY/Math.max(1,ret)).toFixed(2), reads:(((window.__V166K||{}).reads)||0)-K0,
      ...(()=>{ const K=window.__V166K||{}, d=k=>(K[k]||0)-(KS[k]||0), pct=(a,b)=>+(100*d(a)/Math.max(1,d(b))).toFixed(1)
        return { closeFc: Math.max(pct('sCloseFc','sClose'), pct('dCloseFc','dClose')), roomRet: Math.max(pct('sRoomRet','sRoom'), pct('dRoomRet','dRoom')), close: d('sClose')+d('dClose') } })() } }
  const R={}
  const ret=v=>Object.fromEntries(['CB','S'].map(p=>[p,{awareness:v,discipline:v}]))
  R.sharp=punts(ret(92)); R.dull=punts(ret(30)); R.base=punts({}); R.baseOff=punts({},{v166Kst:0})
  // the fake: forced on, UFF games
  const names=['speed','acceleration','quickness','agility','strength','catching','throwing','tackling','blocking','awareness','vision','grit','stamina','jumping','ballControl','discipline','injuryResist']
  window.RIB_TUNE={fakeRateV166K:1}; st.player={level:7,pos:'LB',name:'P',attrs:Object.fromEntries(names.map(n=>[n,150]))}; window.__V166K=Object.assign(window.__V166K||{},{fakes:0})
  let rows=[]; for (let g=0; g<10; g++) { reseed(9300+g); const r=window.__simGameV2(9+g,'LB'); rows=rows.concat((r.plays||[]).filter(p=>/Fake punt!/.test(String(p.desc||'')))) }
  R.fakes={ count:(window.__V166K||{}).fakes||0, rows:rows.length, kinds:[...new Set(rows.map(p=>p.event))].join(',') }
  window.RIB_TUNE={}; return R })
await browser.close()
const checks=[], ok=(n,p)=>checks.push({n,p:!!p}), R=out
ok(`a sharp returner reads the coverage: with a gunner on him he fair-catches ${R.sharp.closeFc}% (a dull one rolls the flat 70%: ${R.dull.closeFc}% here) — he does not return into the man (${R.sharp.reads} reads)`, R.sharp.closeFc >= 90 && R.sharp.reads > 100)   // the dull one's is the flat 70% roll over a handful of gunner-on-him punts (noisy)
ok(`and with room he returns it: ${R.sharp.roomRet}% of open punts returned (dull ${R.dull.roomRet}%; return yards are the coverage's — ${R.sharp.avgRet} vs ${R.dull.avgRet})`, R.sharp.roomRet >= 60)
ok(`an ordinary returner's fair catches stay in the old band (${R.baseOff.fairPct}% -> ${R.base.fairPct}%) and the kill switch reads nothing (${R.baseOff.reads})`, Math.abs(R.base.fairPct - R.baseOff.fairPct) <= 8 && R.baseOff.reads === 0)
ok(`a staff fakes a punt (dial forced: ${R.fakes.count} fakes), the row says so (${R.fakes.rows} — a scoring row keeps its own words) and it is a real play (${R.fakes.kinds})`, R.fakes.count > 0 && R.fakes.rows > 0 && /run|pass|incomplete|sack|scramble|turnover/.test(R.fakes.kinds))
ok('no page errors', errs.length===0)
for (const c of checks) console.log((c.p?'ok   ':'FAIL ')+c.n)
const fails=checks.filter(c=>!c.p).length
console.log(JSON.stringify({pass:checks.length-fails,fail:fails,pageErrors:errs.length,out:R,errs:errs.slice(0,2)}))
process.exit(fails?1:0)
