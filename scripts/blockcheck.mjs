// v166 A check: THE BLOCK HOLDS. Loads the engine without the image payloads (no dev server) and runs the readcheck roster
// through __FieldSim.run / .pass over three seeded streams with the offense's blockers (WR, TE, OL: blocking, strength,
// awareness) at 40, 65 and 90, and asserts that blocking decides the run game (elite vs poor, elite vs average, elite now vs
// elite before v166 A), that a sealed man is out of the play (runs and catch-and-runs with a seal against without), that the
// receivers block on a catch-and-run, that ratings decide the shed rate, and the kill switch.
//   node scripts/blockcheck.mjs
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
  const player=(pos,i,side,blk)=>{ const a=Object.fromEntries(SK.map(k=>[k,side==='off'?58:57]))
    if(pos==='QB')Object.assign(a,{throwing:69,awareness:65,vision:64}); if(pos==='RB')Object.assign(a,{speed:68,acceleration:70,burst:69,agility:72,quickness:70,vision:75,ballControl:64})
    if(pos==='WR')Object.assign(a,{speed:67,agility:66,catching:63}); if(pos==='OL')Object.assign(a,{blocking:65,strength:67,speed:43})
    if(pos==='CB')Object.assign(a,{coverage:62,speed:66,agility:63}); if(pos==='LB')Object.assign(a,{tackling:62,awareness:57,strength:63,speed:57}); if(pos==='DL')Object.assign(a,{strength:66,tackling:62})
    if(side==='off'&&blk!=null&&['WR','TE','OL'].includes(pos))Object.assign(a,{blocking:blk,strength:blk-5,awareness:blk-10})
    return {id:side+pos+i,pos,attrs:a,body:{height:73}} }
  const att=(p,k)=>Number(p&&p.attrs&&p.attrs[k]!=null?p.attrs[k]:55)
  const FS=window.__FieldSim, V=window.__V166A||{}
  const cell=(kind,blk,tu,seeds)=>{ window.RIB_TUNE=Object.assign({},tu); let y=0,n=0,sy=0,sn=0,uy=0,un=0; cell._s=(window.__V166A||{}).sealed||0; const v0={...(window.__V166A||{})}
    for(const s0 of seeds){ reseed(s0); for(let i=0;i<160;i++){ const off=POS_OFF.map((p,j)=>player(p,j,'off',blk)), def=POS_DEF.map((p,j)=>player(p,j,'def'))
      const r= kind==='run'? FS.run(true,{off},{def},off[9],att,'inside',{down:1,toGo:10,fieldPos:40}) : FS.pass(true,{off},{def},off[8],off[0],def[0],att,'quick',{down:1,toGo:10,fieldPos:40})
      if(!r)continue; if(kind==='run'||r.complete){ n++; y+=Number(r.yards)||0
        const sl=(window.__V166A||{}).sealed||0, d=sl-(cell._s||0); cell._s=sl; if(d>=9){ sy+=Number(r.yards)||0; sn++ } else { uy+=Number(r.yards)||0; un++ } } } }
    const v1=window.__V166A||{}; return {avg:+(y/Math.max(1,n)).toFixed(2), n, sealedAvg:+(sy/Math.max(1,sn)).toFixed(2), sealedN:sn, unsealedAvg:+(uy/Math.max(1,un)).toFixed(2), blocks:(v1.blocks||0)-(v0.blocks||0), sheds:(v1.sheds||0)-(v0.sheds||0), held:(v1.heldTackles||0)-(v0.heldTackles||0)} }
  const S3=[0xC0FFEE,0xBEEF,0xD00D], res={}
  for (const b of [40,65,90]) res['onRun'+b]=cell('run',b,{},S3)
  res.offRun90=cell('run',90,{v166Ablock:0},S3); res.onPass65=cell('pass',65,{},S3)
  return res })
await browser.close()
const checks = [], ok = (n, p) => checks.push({ n, p: !!p })
const R40 = out.onRun40, R65 = out.onRun65, R90 = out.onRun90, O90 = out.offRun90, P = out.onPass65
ok(`elite blockers against poor ones: a different run game (${R40.avg} -> ${R90.avg} YPC)`, R90.avg >= R40.avg + 3)
ok(`elite blockers beat average ones (${R65.avg} -> ${R90.avg})`, R90.avg >= R65.avg + 0.4)
ok(`blocking past 65 pays now — it used to saturate (elite ${O90.avg} before -> ${R90.avg})`, R90.avg >= O90.avg + 0.8)
ok(`a sealed man is out of the play: runs with a seal gain far more (${R65.sealedAvg} sealed vs ${R65.unsealedAvg} not, average blockers)`, R65.sealedAvg >= R65.unsealedAvg + 3)
ok(`on a catch-and-run the men near him block (${P.blocks} blocks over ${P.n} catches), and a seal springs him (${P.sealedAvg} vs ${P.unsealedAvg} a catch)`, P.blocks > 0.3 * P.n && P.sealedAvg >= 2 * P.unsealedAvg)
ok(`ratings decide the block: elite blockers are shed far less (${(R90.sheds / R90.blocks).toFixed(2)} vs ${(R40.sheds / R40.blocks).toFixed(2)} a block)`, R90.sheds / R90.blocks < 0.5 * R40.sheds / R40.blocks)
ok(`kill switch v166Ablock 0: no v166 blocks (${O90.blocks})`, O90.blocks === 0)
ok('no page errors', errs.length === 0)
for (const c of checks) console.log((c.p ? 'ok   ' : 'FAIL ') + c.n)
const fails = checks.filter(c => !c.p).length
console.log(JSON.stringify({ pass: checks.length - fails, fail: fails, pageErrors: errs.length, out }))
process.exit(fails ? 1 : 0)
